import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const today = () => new Date().toISOString().split('T')[0];

const FIRM_INFO = {
  name: 'S&T Tax and Advisory LLC',
  email: 'hello.sttax@gmail.com',
  phone: '929-367-8799',
  address: 'Mineola, NY',
};

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  return <span className={`badge badge-${s}`}>{status}</span>;
}

const emptyLine = () => ({ id: crypto.randomUUID(), description: '', quantity: '1', rate: '', proration_factor: '1', amount: 0 });

function calcLineAmount(line) {
  const q = parseFloat(line.quantity) || 0;
  const r = parseFloat(line.rate) || 0;
  const p = parseFloat(line.proration_factor) || 1;
  return q * r * p;
}

function generateInvoicePDF(invoice, lines, clientName) {
  if (!window.jspdf) { alert('PDF library not loaded. Check your internet connection.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const primary = [13, 78, 166];
  const yellow = [247, 196, 48];
  const gray = [100, 100, 100];

  doc.setFillColor(...primary);
  doc.rect(0, 0, 210, 42, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(FIRM_INFO.name, 14, 20);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${FIRM_INFO.email} • ${FIRM_INFO.phone} • ${FIRM_INFO.address}`, 14, 29);
  doc.setTextColor(...yellow);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 140, 26);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 14, 56);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(clientName || '', 14, 63);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  const infoX = 130;
  doc.text('Invoice #:', infoX, 50);
  doc.text('Date:', infoX, 57);
  doc.text('Due Date:', infoX, 64);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.invoice_number || '', 165, 50);
  doc.text(fmtDate(invoice.date), 165, 57);
  doc.text(fmtDate(invoice.due_date), 165, 64);

  const tableBody = lines.map(l => [
    l.description || '',
    l.quantity || '1',
    fmt(l.rate),
    l.proration_factor && parseFloat(l.proration_factor) !== 1 ? `${(parseFloat(l.proration_factor) * 100).toFixed(0)}%` : '100%',
    fmt(l.amount),
  ]);

  doc.autoTable({
    startY: 75,
    head: [['Description', 'Qty', 'Rate', 'Proration', 'Amount']],
    body: tableBody,
    headStyles: { fillColor: primary, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 4: { halign: 'right' } },
    styles: { cellPadding: 4 },
    margin: { left: 14, right: 14 },
  });

  const finalY = doc.lastAutoTable.finalY + 8;
  const rightX = 196;

  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text('Subtotal:', 150, finalY);
  doc.setTextColor(0, 0, 0);
  doc.text(fmt(invoice.subtotal), rightX, finalY, { align: 'right' });

  let y = finalY;
  if (invoice.late_fee > 0) {
    y += 7;
    doc.setTextColor(...gray);
    doc.text('Late Fee:', 150, y);
    doc.setTextColor(200, 50, 50);
    doc.text(fmt(invoice.late_fee), rightX, y, { align: 'right' });
  }

  y += 9;
  doc.setFillColor(240, 245, 255);
  doc.rect(130, y - 5, 66, 10, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primary);
  doc.text('TOTAL:', 150, y + 2);
  doc.text(fmt(invoice.total), rightX, y + 2, { align: 'right' });

  if (invoice.notes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...gray);
    doc.text('Notes:', 14, y + 18);
    doc.setTextColor(0, 0, 0);
    doc.text(invoice.notes, 14, y + 25, { maxWidth: 130 });
  }

  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.setFont('helvetica', 'italic');
  doc.text('Thank you for your business!', 105, 285, { align: 'center' });

  doc.save(`${invoice.invoice_number || 'invoice'}.pdf`);
}

function PaymentModal({ invoice, balance, onClose, onSaved }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ amount: balance.toFixed(2), date: today(), method: 'Check', reference: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { alert('Enter a valid amount'); return; }
    setSaving(true);
    await supabase.from('payments').insert({
      invoice_id: invoice.id, client_id: invoice.client_id,
      amount: amt, date: form.date, method: form.method,
      reference: form.reference || null, notes: form.notes || null,
    });
    const newBalance = balance - amt;
    const newStatus = newBalance <= 0 ? 'paid' : 'partial';
    await supabase.from('invoices').update({ status: newStatus }).eq('id', invoice.id);
    await supabase.from('activity_log').insert({
      client_id: invoice.client_id, user_id: user?.id,
      action: 'Payment Recorded',
      details: `Payment of ${fmt(amt)} recorded for invoice ${invoice.invoice_number}`,
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Record Payment — {invoice.invoice_number}</h3>
          <button className="btn-icon" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div style={{ background: 'var(--primary-xlight)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Outstanding Balance</span>
              <strong style={{ color: 'var(--danger)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.1rem' }}>{fmt(balance)}</strong>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Amount ($) <span className="required">*</span></label>
                <input type="number" step="0.01" min="0.01" className="form-input" value={form.amount} onChange={e => setF('amount', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Date <span className="required">*</span></label>
                <input type="date" className="form-input" value={form.date} onChange={e => setF('date', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Method</label>
                <select className="form-select" value={form.method} onChange={e => setF('method', e.target.value)}>
                  {['Check','ACH / Bank Transfer','Credit Card','Zelle','Cash'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Reference / Check #</label>
                <input className="form-input" value={form.reference} onChange={e => setF('reference', e.target.value)} placeholder="e.g. Check #1234" />
              </div>
              <div className="form-group form-col-span-2">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={saving}>
              {saving ? 'Saving…' : <><span className="material-symbols-outlined">check</span>Record Payment</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InvoiceModal({ mode, invoice, clients, onClose, onSaved }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    client_id: invoice?.client_id || '',
    issue_date: invoice?.issue_date || today(),
    due_date: invoice?.due_date || '',
    notes: invoice?.notes || '',
    late_fee: invoice?.late_fee || '',
    status: invoice?.status || 'draft',
  });
  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingLines, setLoadingLines] = useState(!!invoice);

  useEffect(() => {
    if (invoice) {
      supabase.from('invoice_lines').select('*').eq('invoice_id', invoice.id).order('sort_order')
        .then(({ data }) => {
          setLines((data || []).map(l => ({ ...l, id: l.id || crypto.randomUUID() })));
          setLoadingLines(false);
        });
    } else {
      setLines([emptyLine()]);
    }
  }, [invoice?.id]);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const updateLine = (id, field, value) => {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      updated.amount = calcLineAmount(updated);
      return updated;
    }));
  };

  const addLine = () => setLines(prev => [...prev, emptyLine()]);
  const removeLine = (id) => setLines(prev => prev.filter(l => l.id !== id));

  const subtotal = lines.reduce((s, l) => s + (l.amount || 0), 0);
  const lateFee = parseFloat(form.late_fee) || 0;
  const total = subtotal + lateFee;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.client_id) { alert('Select a client'); return; }
    setSaving(true);

    const invoicePayload = {
      client_id: form.client_id,
      issue_date: form.issue_date, due_date: form.due_date || null,
      notes: form.notes || null, late_fee: lateFee || null,
      subtotal, total, status: form.status,
    };

    let invId = invoice?.id;
    if (mode === 'create') {
      const { data, error } = await supabase.from('invoices').insert(invoicePayload).select().single();
      if (error) { alert(error.message); setSaving(false); return; }
      invId = data.id;
    } else {
      await supabase.from('invoices').update(invoicePayload).eq('id', invId);
      await supabase.from('invoice_lines').delete().eq('invoice_id', invId);
    }

    const lineInserts = lines.filter(l => l.description).map((l, i) => ({
      invoice_id: invId,
      description: l.description,
      quantity: parseFloat(l.quantity) || 1,
      rate: parseFloat(l.rate) || 0,
      proration_factor: parseFloat(l.proration_factor) || 1,
      amount: l.amount,
      sort_order: i,
    }));
    if (lineInserts.length > 0) await supabase.from('invoice_lines').insert(lineInserts);

    await supabase.from('activity_log').insert({
      client_id: form.client_id, user_id: user?.id,
      action: mode === 'create' ? 'Invoice Created' : 'Invoice Updated',
      details: mode === 'create' ? `New invoice created` : `Invoice updated`,
    });

    setSaving(false);
    onSaved();
    onClose();
  };

  const isView = mode === 'view';
  const clientName = clients.find(c => c.id === (invoice?.client_id || form.client_id))?.business_name;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          <div>
            <h3>
              {isView ? `Invoice ${invoice?.invoice_number}` : mode === 'edit' ? `Edit ${invoice?.invoice_number}` : 'New Invoice'}
            </h3>
            {isView && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {FIRM_INFO.name} • {FIRM_INFO.email} • {FIRM_INFO.phone}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isView && invoice && (
              <button className="btn btn-secondary btn-sm" onClick={() => generateInvoicePDF(invoice, lines, clientName)}>
                <span className="material-symbols-outlined">picture_as_pdf</span> PDF
              </button>
            )}
            <button className="btn-icon" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
          </div>
        </div>
        {isView ? (
          <div className="modal-body">
            {loadingLines ? <div className="loading-state"><div className="spinner" /></div> : (
              <>
                <div className="form-grid" style={{ marginBottom: 16 }}>
                  <div className="info-item"><span className="info-label">Client</span><span className="info-value">{clientName || '—'}</span></div>
                  <div className="info-item"><span className="info-label">Status</span><span className="info-value"><StatusBadge status={invoice.status} /></span></div>
                  <div className="info-item"><span className="info-label">Invoice Date</span><span className="info-value">{fmtDate(invoice.issue_date)}</span></div>
                  <div className="info-item"><span className="info-label">Due Date</span><span className="info-value">{fmtDate(invoice.due_date)}</span></div>
                </div>
                <table className="line-items-table">
                  <thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Proration</th><th className="text-right">Amount</th></tr></thead>
                  <tbody>
                    {lines.map(l => (
                      <tr key={l.id}>
                        <td>{l.description}</td>
                        <td>{l.quantity}</td>
                        <td>{fmt(l.rate)}</td>
                        <td>{parseFloat(l.proration_factor) !== 1 ? `${(parseFloat(l.proration_factor) * 100).toFixed(0)}%` : '100%'}</td>
                        <td className="text-right">{fmt(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="invoice-totals">
                  <div className="invoice-total-row"><span className="invoice-total-label">Subtotal</span><span className="invoice-total-value">{fmt(invoice.subtotal)}</span></div>
                  {invoice.late_fee > 0 && <div className="invoice-total-row"><span className="invoice-total-label">Late Fee</span><span className="invoice-total-value" style={{ color: 'var(--danger)' }}>{fmt(invoice.late_fee)}</span></div>}
                  <div className="invoice-total-row grand"><span className="invoice-total-label">Total</span><span className="invoice-total-value">{fmt(invoice.total)}</span></div>
                </div>
                {invoice.notes && <div style={{ marginTop: 16, padding: '10px 14px', background: '#f7f9fc', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}><strong>Notes:</strong> {invoice.notes}</div>}
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave}>
            <div className="modal-body">
              <div className="form-grid" style={{ marginBottom: 20 }}>
                <div className="form-group form-col-span-2">
                  <label className="form-label">Client <span className="required">*</span></label>
                  <select className="form-select" value={form.client_id} onChange={e => setF('client_id', e.target.value)} required disabled={mode === 'edit'}>
                    <option value="">Select client…</option>
                    {clients.filter(c => c.status === 'active').map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Invoice Date</label>
                  <input type="date" className="form-input" value={form.issue_date} onChange={e => setF('issue_date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input type="date" className="form-input" value={form.due_date} onChange={e => setF('due_date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={e => setF('status', e.target.value)}>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Late Fee ($)</label>
                  <input type="number" step="0.01" min="0" className="form-input" value={form.late_fee} onChange={e => setF('late_fee', e.target.value)} placeholder="0.00" />
                </div>
              </div>

              <div className="section-header">
                <h4>Line Items</h4>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}>
                  <span className="material-symbols-outlined">add</span> Add Line
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="line-items-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 200 }}>Description</th>
                      <th style={{ width: 70 }}>Qty</th>
                      <th style={{ width: 100 }}>Rate ($)</th>
                      <th style={{ width: 90 }}>Proration</th>
                      <th className="text-right" style={{ width: 100 }}>Amount</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(l => (
                      <tr key={l.id}>
                        <td><input className="line-item-input" value={l.description} onChange={e => updateLine(l.id, 'description', e.target.value)} placeholder="Service description…" /></td>
                        <td><input type="number" className="line-item-input" value={l.quantity} onChange={e => updateLine(l.id, 'quantity', e.target.value)} min="0" step="0.01" /></td>
                        <td><input type="number" className="line-item-input" value={l.rate} onChange={e => updateLine(l.id, 'rate', e.target.value)} min="0" step="0.01" placeholder="0.00" /></td>
                        <td>
                          <select className="line-item-input" value={l.proration_factor} onChange={e => updateLine(l.id, 'proration_factor', e.target.value)}>
                            <option value="1">100%</option>
                            <option value="0.75">75%</option>
                            <option value="0.5">50%</option>
                            <option value="0.25">25%</option>
                            <option value="0.1667">1/6</option>
                          </select>
                        </td>
                        <td className="text-right" style={{ fontWeight: 600 }}>{fmt(l.amount)}</td>
                        <td><button type="button" className="btn-icon danger" onClick={() => removeLine(l.id)} title="Remove"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span></button></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="text-right">Subtotal</td>
                      <td className="text-right">{fmt(subtotal)}</td>
                      <td />
                    </tr>
                    {lateFee > 0 && (
                      <tr>
                        <td colSpan={4} className="text-right" style={{ color: 'var(--danger)' }}>Late Fee</td>
                        <td className="text-right" style={{ color: 'var(--danger)' }}>{fmt(lateFee)}</td>
                        <td />
                      </tr>
                    )}
                    <tr style={{ borderTop: '2px solid var(--primary)' }}>
                      <td colSpan={4} className="text-right" style={{ color: 'var(--primary)', fontSize: '1rem' }}>Total</td>
                      <td className="text-right" style={{ color: 'var(--primary)', fontSize: '1rem' }}>{fmt(total)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Invoice notes or payment instructions…" />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : <><span className="material-symbols-outlined">check</span>{mode === 'create' ? 'Create Invoice' : 'Save Changes'}</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Invoices() {
  const [searchParams] = useSearchParams();
  const preClientId = searchParams.get('client_id');
  const autoNew = searchParams.get('new') === '1';

  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [payModal, setPayModal] = useState(null);

  const load = useCallback(async () => {
    try {
      const [{ data: inv }, { data: cl }, { data: pay }] = await Promise.all([
        supabase.from('invoices').select('*, clients(business_name)').order('issue_date', { ascending: false }),
        supabase.from('clients').select('id, business_name, status'),
        supabase.from('payments').select('invoice_id, amount'),
      ]);
      setClients(cl || []);
      const paidMap = {};
      (pay || []).forEach(p => { paidMap[p.invoice_id] = (paidMap[p.invoice_id] || 0) + p.amount; });
      setPayments(paidMap);
      setInvoices((inv || []).map(i => ({
        ...i,
        clientName: i.clients?.business_name || '—',
        paid: paidMap[i.id] || 0,
        balance: Math.max(0, (i.total || 0) - (paidMap[i.id] || 0)),
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (autoNew && clients.length > 0) {
      setModal({ mode: 'create', invoice: preClientId ? { client_id: preClientId } : null });
    }
  }, [autoNew, clients.length, preClientId]);

  const filtered = invoices.filter(i => {
    const q = search.toLowerCase();
    const match = !q || i.clientName.toLowerCase().includes(q) || (i.invoice_number || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || i.status === statusFilter;
    return match && matchStatus;
  });

  const toggleQB = async (inv) => {
    await supabase.from('invoices').update({ quickbooks_synced: !inv.quickbooks_synced }).eq('id', inv.id);
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, quickbooks_synced: !inv.quickbooks_synced } : i));
  };

  const handleDelete = async (inv) => {
    if (!confirm(`Delete invoice ${inv.invoice_number}?`)) return;
    await supabase.from('invoice_lines').delete().eq('invoice_id', inv.id);
    await supabase.from('invoices').delete().eq('id', inv.id);
    load();
  };

  if (loading) return (
    <div className="page-wrapper">
      <div className="loading-state"><div className="spinner" /><span className="loading-text">Loading invoices…</span></div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h2>Invoices</h2>
        <button className="btn btn-primary" onClick={() => setModal({ mode: 'create', invoice: null })}>
          <span className="material-symbols-outlined">add</span>
          New Invoice
        </button>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="search-filter-bar" style={{ flex: 1 }}>
            <div className="search-wrapper">
              <span className="material-symbols-outlined">search</span>
              <input className="search-input" placeholder="Search invoices…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              {['Unpaid', 'Paid', 'Partial', 'Draft', 'Void'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {filtered.length} invoices
          </span>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Date</th>
                <th>Due Date</th>
                <th className="text-right">Total</th>
                <th className="text-right">Balance</th>
                <th>Status</th>
                <th className="text-center">QB</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9}><div className="empty-state"><span className="material-symbols-outlined">receipt_long</span><p>No invoices found</p></div></td></tr>
              ) : filtered.map(inv => (
                <tr key={inv.id}>
                  <td className="font-mono" style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 700 }}>{inv.invoice_number}</td>
                  <td style={{ fontWeight: 500, color: 'var(--text)' }}>{inv.clientName}</td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{fmtDate(inv.issue_date)}</td>
                  <td style={{ fontSize: '0.82rem', color: inv.due_date && inv.due_date < today() && inv.status !== 'paid' ? 'var(--danger)' : 'var(--text-muted)' }}>{fmtDate(inv.due_date)}</td>
                  <td className="text-right" style={{ fontWeight: 600 }}>{fmt(inv.total)}</td>
                  <td className="text-right" style={{ fontWeight: 700, color: inv.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {inv.balance > 0 ? fmt(inv.balance) : <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--success)' }}>check_circle</span>}
                  </td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={!!inv.quickbooks_synced}
                      onChange={() => toggleQB(inv)}
                      title="QuickBooks synced"
                    />
                  </td>
                  <td>
                    <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn-icon" title="View" onClick={() => setModal({ mode: 'view', invoice: inv })}>
                        <span className="material-symbols-outlined">visibility</span>
                      </button>
                      <button className="btn-icon" title="Download PDF" onClick={() => {
                        supabase.from('invoice_lines').select('*').eq('invoice_id', inv.id).then(({ data }) => {
                          generateInvoicePDF(inv, data || [], inv.clientName);
                        });
                      }}>
                        <span className="material-symbols-outlined">picture_as_pdf</span>
                      </button>
                      {inv.status !== 'paid' && (
                        <>
                          <button className="btn-icon" title="Edit" onClick={() => setModal({ mode: 'edit', invoice: inv })}>
                            <span className="material-symbols-outlined">edit</span>
                          </button>
                          <button className="btn-icon success" title="Record Payment" onClick={() => setPayModal(inv)}>
                            <span className="material-symbols-outlined">payments</span>
                          </button>
                          <button className="btn-icon danger" title="Delete" onClick={() => handleDelete(inv)}>
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <InvoiceModal
          mode={modal.mode}
          invoice={modal.invoice}
          clients={clients}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}

      {payModal && (
        <PaymentModal
          invoice={payModal}
          balance={payModal.balance}
          onClose={() => setPayModal(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
