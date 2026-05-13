import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { InvoiceModal } from './Invoices';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const today = new Date().toISOString().split('T')[0];
const daysDiff = (d) => Math.floor((new Date(today) - new Date(d)) / 86400000);

function AgingBucket({ days }) {
  if (days <= 0) return <span className="badge badge-sent">Not Due</span>;
  if (days <= 15) return <span className="badge badge-active">0–15 days</span>;
  if (days <= 30) return <span className="badge badge-partial">16–30 days</span>;
  return <span className="badge badge-overdue">30+ days</span>;
}

function rowClass(days) {
  if (days <= 0) return '';
  if (days <= 15) return 'row-current';
  if (days <= 30) return 'row-warning';
  return 'row-overdue';
}


function InvoiceViewModal({ invoice, onClose, onEdit }) {
  if (!invoice) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Invoice {invoice.invoice_number}</h3>
          <button className="btn-icon" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="modal-body">
          <div className="info-grid">
            <div className="info-item"><span className="info-label">Client</span><span className="info-value">{invoice.clientName}</span></div>
            <div className="info-item"><span className="info-label">Aging Bucket</span><span className="info-value"><AgingBucket days={invoice.daysOld} /></span></div>
            <div className="info-item"><span className="info-label">Invoice Date</span><span className="info-value">{fmtDate(invoice.issue_date)}</span></div>
            <div className="info-item"><span className="info-label">Due Date</span><span className="info-value">{fmtDate(invoice.due_date)}</span></div>
            <div className="info-item"><span className="info-label">Total Invoiced</span><span className="info-value" style={{ fontWeight: 700 }}>{fmt(invoice.total)}</span></div>
            <div className="info-item"><span className="info-label">Paid</span><span className="info-value" style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(invoice.paid)}</span></div>
            <div className="info-item"><span className="info-label">Balance Due</span><span className="info-value" style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt(invoice.balance)}</span></div>
            <div className="info-item">
              <span className="info-label">Days Overdue</span>
              <span className="info-value" style={{ fontWeight: 600, color: invoice.daysOld > 30 ? 'var(--danger)' : invoice.daysOld > 15 ? 'var(--warning)' : 'var(--success)' }}>
                {invoice.daysOld > 0 ? `${invoice.daysOld}d overdue` : invoice.daysOld === 0 ? 'Due today' : `${Math.abs(invoice.daysOld)}d remaining`}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">QuickBooks</span>
              <span className="info-value">{invoice.in_quickbooks ? '✅ Synced' : '⬜ Not synced'}</span>
            </div>
          </div>
          {invoice.notes && (
            <div style={{ marginTop: 16 }}>
              <div className="info-label">Notes</div>
              <p style={{ marginTop: 4, fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{invoice.notes}</p>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          {!['paid', 'void'].includes((invoice.status || '').toLowerCase()) && (
            <button className="btn btn-primary" onClick={onEdit}>
              <span className="material-symbols-outlined">edit</span> Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ARAging() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [editInvoice, setEditInvoice] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [{ data: invoices }, { data: payments }] = await Promise.all([
        supabase.from('invoices').select('*, clients(business_name)').in('status', ['Unpaid', 'Partial', 'Overdue']).order('due_date', { ascending: true }),
        supabase.from('payments').select('invoice_id, amount'),
      ]);

      const paidMap = {};
      (payments || []).forEach(p => { paidMap[p.invoice_id] = (paidMap[p.invoice_id] || 0) + p.amount; });

      const rows = (invoices || []).map(inv => {
        const paid = paidMap[inv.id] || 0;
        const balance = Math.max(0, (inv.total || 0) - paid);
        const daysOld = inv.due_date ? daysDiff(inv.due_date) : 0;
        return { ...inv, balance, paid, daysOld, clientName: inv.clients?.business_name || '—' };
      }).filter(r => r.balance > 0).sort((a, b) => b.daysOld - a.daysOld);

      setItems(rows);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleQB = async (e, row) => {
    e.stopPropagation();
    const newVal = !row.in_quickbooks;
    await supabase.from('invoices').update({ in_quickbooks: newVal }).eq('id', row.id);
    setItems(prev => prev.map(r => r.id === row.id ? { ...r, in_quickbooks: newVal } : r));
  };

  const current = items.filter(r => r.daysOld <= 15);
  const warning = items.filter(r => r.daysOld > 15 && r.daysOld <= 30);
  const overdue = items.filter(r => r.daysOld > 30);
  const sumBalance = (arr) => arr.reduce((s, r) => s + r.balance, 0);

  const exportExcel = () => {
    const clientMap = {};
    items.forEach(r => {
      if (!clientMap[r.clientName]) {
        clientMap[r.clientName] = { current: 0, d31_60: 0, d61_90: 0, d91_120: 0, d120plus: 0 };
      }
      const b = r.balance;
      const d = r.daysOld;
      if (d <= 30) clientMap[r.clientName].current += b;
      else if (d <= 60) clientMap[r.clientName].d31_60 += b;
      else if (d <= 90) clientMap[r.clientName].d61_90 += b;
      else if (d <= 120) clientMap[r.clientName].d91_120 += b;
      else clientMap[r.clientName].d120plus += b;
    });

    const money = (n) => parseFloat(n.toFixed(2));
    const rows = Object.entries(clientMap).map(([name, b]) => ({
      'Client': name,
      'Current (0–30d)': money(b.current),
      '31–60 Days': money(b.d31_60),
      '61–90 Days': money(b.d61_90),
      '91–120 Days': money(b.d91_120),
      '120+ Days': money(b.d120plus),
      'Total': money(b.current + b.d31_60 + b.d61_90 + b.d91_120 + b.d120plus),
    }));

    const totals = rows.reduce((acc, r) => ({
      'Client': 'TOTAL',
      'Current (0–30d)': acc['Current (0–30d)'] + r['Current (0–30d)'],
      '31–60 Days': acc['31–60 Days'] + r['31–60 Days'],
      '61–90 Days': acc['61–90 Days'] + r['61–90 Days'],
      '91–120 Days': acc['91–120 Days'] + r['91–120 Days'],
      '120+ Days': acc['120+ Days'] + r['120+ Days'],
      'Total': acc['Total'] + r['Total'],
    }), { 'Client': '', 'Current (0–30d)': 0, '31–60 Days': 0, '61–90 Days': 0, '91–120 Days': 0, '120+ Days': 0, 'Total': 0 });

    const ws = XLSX.utils.json_to_sheet([...rows, totals]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AR Aging');
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `AR_Aging_${date}.xlsx`);
  };

  if (loading) return (
    <div className="page-wrapper">
      <div className="loading-state"><div className="spinner" /><span className="loading-text">Loading AR aging…</span></div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h2>AR Aging Report</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>As of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
        <div className="page-header-actions no-print">
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <span className="material-symbols-outlined">print</span>
            Export PDF
          </button>
          <button className="btn btn-secondary btn-sm" onClick={exportExcel}>
            <span className="material-symbols-outlined">table_view</span>
            Export Excel
          </button>
        </div>
      </div>

      <div className="aging-summary">
        <div className="aging-card green">
          <div className="aging-card-label">0–15 Days</div>
          <div className="aging-card-value">{fmt(sumBalance(current))}</div>
          <div className="aging-card-count">{current.length} invoice{current.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="aging-card amber">
          <div className="aging-card-label">16–30 Days</div>
          <div className="aging-card-value">{fmt(sumBalance(warning))}</div>
          <div className="aging-card-count">{warning.length} invoice{warning.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="aging-card red">
          <div className="aging-card-label">30+ Days</div>
          <div className="aging-card-value">{fmt(sumBalance(overdue))}</div>
          <div className="aging-card-count">{overdue.length} invoice{overdue.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h3>Outstanding Invoices</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Total: <strong style={{ color: 'var(--text)' }}>{fmt(sumBalance(items))}</strong> across {items.length} invoices
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Invoice #</th>
                <th>Invoice Date</th>
                <th>Due Date</th>
                <th className="text-right">Invoiced</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Balance Due</th>
                <th>Age (Days)</th>
                <th>Bucket</th>
                <th style={{ textAlign: 'center' }}>QB</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state">
                      <span className="material-symbols-outlined" style={{ color: 'var(--success)' }}>check_circle</span>
                      <p style={{ color: 'var(--success)' }}>All invoices are current — no outstanding AR</p>
                    </div>
                  </td>
                </tr>
              ) : items.map(row => (
                <tr key={row.id} className={rowClass(row.daysOld)}>
                  <td
                    style={{ fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}
                    onClick={() => navigate(`/clients/${row.client_id}`)}
                    title="Go to client"
                  >
                    {row.clientName}
                  </td>
                  <td
                    className="font-mono"
                    style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => setViewInvoice(row)}
                    title="View invoice"
                  >
                    {row.invoice_number}
                    {row.in_quickbooks && <span style={{ fontSize: '0.6rem', background: '#22c55e', color: 'white', borderRadius: 3, padding: '1px 4px', marginLeft: 5, fontWeight: 700, verticalAlign: 'middle', textDecoration: 'none', display: 'inline-block' }}>QB</span>}
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{fmtDate(row.issue_date)}</td>
                  <td style={{ fontSize: '0.82rem', color: row.daysOld > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{fmtDate(row.due_date)}</td>
                  <td className="text-right" style={{ color: 'var(--text-secondary)' }}>{fmt(row.total)}</td>
                  <td className="text-right" style={{ color: 'var(--success)' }}>{fmt(row.paid)}</td>
                  <td className="text-right" style={{ fontWeight: 700, color: row.daysOld > 30 ? 'var(--danger)' : 'var(--text)' }}>{fmt(row.balance)}</td>
                  <td style={{ fontWeight: 600, color: row.daysOld > 30 ? 'var(--danger)' : row.daysOld > 15 ? 'var(--warning)' : 'var(--success)' }}>
                    {row.daysOld > 0 ? `${row.daysOld}d overdue` : row.daysOld === 0 ? 'Due today' : `${Math.abs(row.daysOld)}d remaining`}
                  </td>
                  <td><AgingBucket days={row.daysOld} /></td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!!row.in_quickbooks}
                      onChange={e => toggleQB(e, row)}
                      title="Synced to QuickBooks"
                      style={{ cursor: 'pointer', width: 16, height: 16 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewInvoice && (
        <InvoiceViewModal
          invoice={viewInvoice}
          onClose={() => setViewInvoice(null)}
          onEdit={() => { setEditInvoice(viewInvoice); setViewInvoice(null); }}
        />
      )}

      {editInvoice && (
        <InvoiceModal
          mode="edit"
          invoice={editInvoice}
          clients={[{ id: editInvoice.client_id, business_name: editInvoice.clientName }]}
          onClose={() => setEditInvoice(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
