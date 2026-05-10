import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const today = () => new Date().toISOString().split('T')[0];

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  return <span className={`badge badge-${s}`}>{status}</span>;
}

function Modal({ isOpen, title, size = '', onClose, children, footer }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

/* ===== CSV EXPORT ===== */
const toCSV = (rows) =>
  rows.map(row =>
    row.map(cell => {
      if (cell == null) return '';
      const s = String(cell);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  ).join('\n');

const downloadCSV = (content, filename) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
};

/* ===== CREDENTIALS TAB ===== */
const emptyCredential = () => ({
  platform: '', username: '', password_encrypted: '', pin: '',
  security_q1: '', security_a1: '',
  security_q2: '', security_a2: '',
  security_q3: '', security_a3: '',
  notes: '',
});

function CredentialsTab({ clientId }) {
  const [creds, setCreds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPass, setShowPass] = useState({});
  const [modal, setModal] = useState({ open: false, mode: 'add', data: null });
  const [form, setForm] = useState(emptyCredential());
  const [saving, setSaving] = useState(false);
  const [showFormPass, setShowFormPass] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('client_credentials').select('*').eq('client_id', clientId).order('platform');
    setCreds(data || []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(emptyCredential()); setModal({ open: true, mode: 'add', data: null }); };
  const openEdit = (c) => { setForm({ ...c }); setModal({ open: true, mode: 'edit', data: c }); };
  const closeModal = () => { setModal({ open: false, mode: 'add', data: null }); setShowFormPass(false); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.platform.trim()) return;
    setSaving(true);
    const payload = { ...form, client_id: clientId };
    delete payload.id;
    if (modal.mode === 'add') await supabase.from('client_credentials').insert(payload);
    else await supabase.from('client_credentials').update(payload).eq('id', modal.data.id);
    setSaving(false); closeModal(); load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this credential entry?')) return;
    await supabase.from('client_credentials').delete().eq('id', id);
    load();
  };

  const togglePass = (id) => setShowPass(p => ({ ...p, [id]: !p[id] }));

  if (loading) return <div className="loading-state"><div className="spinner" /></div>;

  return (
    <div>
      <div className="section-header">
        <h4>Stored Credentials</h4>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <span className="material-symbols-outlined">add</span> Add Credential
        </button>
      </div>

      {creds.length === 0 ? (
        <div className="empty-state">
          <span className="material-symbols-outlined">lock</span>
          <p>No credentials stored for this client</p>
        </div>
      ) : creds.map(c => (
        <div className="credential-card" key={c.id}>
          <div className="credential-card-header">
            <div className="credential-platform">{c.platform}</div>
            <div className="btn-group">
              <button className="btn-icon" onClick={() => openEdit(c)}><span className="material-symbols-outlined">edit</span></button>
              <button className="btn-icon danger" onClick={() => handleDelete(c.id)}><span className="material-symbols-outlined">delete</span></button>
            </div>
          </div>
          <div className="credential-grid">
            {c.username && (
              <div className="credential-field">
                <span className="credential-field-label">Username</span>
                <span className="credential-field-value">{c.username}</span>
              </div>
            )}
            {c.password_encrypted && (
              <div className="credential-field">
                <span className="credential-field-label">Password</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="credential-field-value">{showPass[c.id] ? c.password_encrypted : '••••••••'}</span>
                  <button className="btn-icon" style={{ width: 24, height: 24 }} onClick={() => togglePass(c.id)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{showPass[c.id] ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>
            )}
            {c.pin && <div className="credential-field"><span className="credential-field-label">PIN</span><span className="credential-field-value">{showPass[c.id] ? c.pin : '••••'}</span></div>}
            {c.security_q1 && <div className="credential-field" style={{ gridColumn: 'span 2' }}><span className="credential-field-label">Security Q1</span><span className="credential-field-value" style={{ fontFamily: 'inherit' }}>{c.security_q1} → {showPass[c.id] ? c.security_a1 : '••••'}</span></div>}
            {c.security_q2 && <div className="credential-field" style={{ gridColumn: 'span 2' }}><span className="credential-field-label">Security Q2</span><span className="credential-field-value" style={{ fontFamily: 'inherit' }}>{c.security_q2} → {showPass[c.id] ? c.security_a2 : '••••'}</span></div>}
            {c.security_q3 && <div className="credential-field" style={{ gridColumn: 'span 2' }}><span className="credential-field-label">Security Q3</span><span className="credential-field-value" style={{ fontFamily: 'inherit' }}>{c.security_q3} → {showPass[c.id] ? c.security_a3 : '••••'}</span></div>}
            {c.notes && <div className="credential-field" style={{ gridColumn: 'span 2' }}><span className="credential-field-label">Notes</span><span className="credential-field-value" style={{ fontFamily: 'inherit' }}>{c.notes}</span></div>}
          </div>
        </div>
      ))}

      <Modal
        isOpen={modal.open}
        title={modal.mode === 'add' ? 'Add Credential' : 'Edit Credential'}
        size="modal-lg"
        onClose={closeModal}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-group form-col-span-2">
              <label className="form-label">Platform / Service <span className="required">*</span></label>
              <input className="form-input" value={form.platform} onChange={e => setF('platform', e.target.value)} placeholder="e.g. IRS.gov, State Portal, QuickBooks…" required />
            </div>
            <div className="form-group">
              <label className="form-label">Username / Email</label>
              <input className="form-input" value={form.username} onChange={e => setF('username', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="password-input-wrapper">
                <input type={showFormPass ? 'text' : 'password'} className="form-input" value={form.password_encrypted} onChange={e => setF('password_encrypted', e.target.value)} />
                <button type="button" className="password-toggle-btn" onClick={() => setShowFormPass(v => !v)}>
                  <span className="material-symbols-outlined">{showFormPass ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">PIN</label>
              <input className="form-input" value={form.pin} onChange={e => setF('pin', e.target.value)} placeholder="4-digit PIN" maxLength={10} />
            </div>
          </div>
          <div style={{ marginTop: 16, padding: 14, background: '#f7f9fc', borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Security Questions</div>
            {[['security_q1','security_a1','1'],['security_q2','security_a2','2'],['security_q3','security_a3','3']].map(([qk, ak, n]) => (
              <div className="form-grid" style={{ marginBottom: 8 }} key={qk}>
                <div className="form-group">
                  <label className="form-label">Question {n}</label>
                  <input className="form-input" value={form[qk]} onChange={e => setF(qk, e.target.value)} placeholder={`Security question ${n}`} />
                </div>
                <div className="form-group">
                  <label className="form-label">Answer {n}</label>
                  <input className="form-input" value={form[ak]} onChange={e => setF(ak, e.target.value)} placeholder="Answer" />
                </div>
              </div>
            ))}
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} />
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ===== PAYMENT MODAL (inline) ===== */
function InlinePayModal({ invoice, onClose, onSaved, user }) {
  const balance = Math.max(0, (invoice.total || 0) - (invoice._paid || 0));
  const [form, setForm] = useState({ amount: balance.toFixed(2), date: today(), method: 'Check', reference: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSave = async (e) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    await supabase.from('payments').insert({ invoice_id: invoice.id, client_id: invoice.client_id, amount: amt, payment_date: form.date, method: form.method, reference_num: form.reference || null, notes: form.notes || null });
    const newStatus = amt >= balance ? 'paid' : 'partial';
    await supabase.from('invoices').update({ status: newStatus }).eq('id', invoice.id);
    await supabase.from('activity_log').insert({ client_id: invoice.client_id, user_id: user?.id, action: 'Payment Recorded', details: `Payment of ${fmt(amt)} on invoice ${invoice.invoice_number}` });
    setSaving(false); onSaved(); onClose();
  };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><h3>Record Payment — {invoice.invoice_number}</h3><button className="btn-icon" onClick={onClose}><span className="material-symbols-outlined">close</span></button></div>
        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div style={{ background: 'var(--danger-bg)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Balance Due</span>
              <strong style={{ color: 'var(--danger)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.1rem' }}>{fmt(balance)}</strong>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Amount ($)</label><input type="number" step="0.01" className="form-input" value={form.amount} onChange={e => setF('amount', e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={form.date} onChange={e => setF('date', e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Method</label><select className="form-select" value={form.method} onChange={e => setF('method', e.target.value)}>{['Check','ACH / Bank Transfer','Credit Card','Zelle','Cash'].map(m => <option key={m}>{m}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Reference</label><input className="form-input" value={form.reference} onChange={e => setF('reference', e.target.value)} /></div>
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</button></div>
        </form>
      </div>
    </div>
  );
}

/* ===== MAIN COMPONENT ===== */
export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [client, setClient] = useState(null);
  const [owners, setOwners] = useState([]);
  const [clientServices, setClientServices] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [lockOwner, setLockOwner] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [payModal, setPayModal] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAll = useCallback(async () => {
    try {
      const [
        { data: cl },
        { data: ow },
        { data: cs },
        { data: sv },
        { data: inv },
        { data: pay },
        { data: act },
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase.from('client_owners').select('*').eq('client_id', id),
        supabase.from('client_services').select('*, services(name, category, default_price, frequency)').eq('client_id', id),
        supabase.from('services').select('*').eq('active', true).order('name'),
        supabase.from('invoices').select('*').eq('client_id', id).order('issue_date', { ascending: false }),
        supabase.from('payments').select('*, invoices(invoice_number)').eq('client_id', id).order('payment_date', { ascending: false }),
        supabase.from('activity_log').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
      ]);

      setClient(cl);
      setOwners(ow || []);
      setClientServices(cs || []);
      setAllServices(sv || []);
      setPayments(pay || []);
      setActivity(act || []);

      const paidMap = {};
      (pay || []).forEach(p => { paidMap[p.invoice_id] = (paidMap[p.invoice_id] || 0) + p.amount; });
      setInvoices((inv || []).map(i => ({ ...i, _paid: paidMap[i.id] || 0, _balance: Math.max(0, (i.total || 0) - (paidMap[i.id] || 0)) })));

      if (cl?.locked_by && cl.locked_by !== user?.id) setLockOwner(cl.locked_by);
      else setLockOwner(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const startEdit = async () => {
    setEditForm({ ...client });
    try {
      await supabase.from('clients').update({ locked_by: user?.id, locked_at: new Date().toISOString() }).eq('id', id);
    } catch (_) {}
    setIsEditing(true);
  };

  const cancelEdit = async () => {
    try { await supabase.from('clients').update({ locked_by: null, locked_at: null }).eq('id', id); } catch (_) {}
    setIsEditing(false);
  };

  const saveEdit = async () => {
    setSaving(true);
    const { error } = await supabase.from('clients').update({ ...editForm, locked_by: null, locked_at: null }).eq('id', id);
    if (error) { showToast(error.message, 'error'); setSaving(false); return; }
    await supabase.from('activity_log').insert({ client_id: id, user_id: user?.id, action: 'Client Updated', details: 'Client information updated' });
    setSaving(false);
    setIsEditing(false);
    loadAll();
    showToast('Client saved successfully');
  };

  const handleToggleStatus = async () => {
    const newStatus = client.status === 'active' ? 'inactive' : 'active';
    await supabase.from('clients').update({ status: newStatus }).eq('id', id);
    await supabase.from('activity_log').insert({ client_id: id, user_id: user?.id, action: `Client ${newStatus === 'active' ? 'Activated' : 'Deactivated'}`, details: `Status changed to ${newStatus}` });
    loadAll();
    showToast(`Client set to ${newStatus}`);
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently delete ${client.business_name}? This cannot be undone.`)) return;
    await supabase.from('activity_log').delete().eq('client_id', id);
    await supabase.from('client_credentials').delete().eq('client_id', id);
    await supabase.from('client_services').delete().eq('client_id', id);
    await supabase.from('client_owners').delete().eq('client_id', id);
    await supabase.from('payments').delete().eq('client_id', id);
    const { data: invIds } = await supabase.from('invoices').select('id').eq('client_id', id);
    if (invIds?.length) {
      for (const inv of invIds) await supabase.from('invoice_lines').delete().eq('invoice_id', inv.id);
    }
    await supabase.from('invoices').delete().eq('client_id', id);
    await supabase.from('clients').delete().eq('id', id);
    navigate('/clients');
  };

  const exportCSV = () => {
    const paidByInv = {};
    payments.forEach(p => { paidByInv[p.invoice_id] = (paidByInv[p.invoice_id] || 0) + p.amount; });

    const sections = [
      ['=== CLIENT INFORMATION ==='],
      ['Name','Type','EIN','Email','Phone','Address','Status'],
      [client.business_name, client.entity_type, client.ein, client.primary_email, client.primary_phone,
        client.business_address, client.status],
      [],
      ['=== OWNERS ==='],
      ['Name','Email','Phone','Ownership %'],
      ...owners.map(o => [o.name, o.email, o.phone, o.ownership_percent]),
      [],
      ['=== SERVICES ==='],
      ['Service','Category','Price','Frequency'],
      ...clientServices.map(cs => [cs.services?.name, cs.services?.category, cs.price || cs.services?.default_price, cs.frequency || cs.services?.frequency]),
      [],
      ['=== INVOICES ==='],
      ['Invoice #','Date','Due Date','Total','Paid','Balance','Status'],
      ...invoices.map(i => [i.invoice_number, i.issue_date, i.due_date, i.total, i._paid, i._balance, i.status]),
      [],
      ['=== PAYMENTS ==='],
      ['Date','Amount','Method','Reference','Invoice #'],
      ...payments.map(p => [p.payment_date, p.amount, p.method, p.reference_num, p.invoices?.invoice_number]),
    ];

    downloadCSV(toCSV(sections), `${(client.business_name || 'client').replace(/[^a-z0-9]/gi, '_')}_export.csv`);
    showToast('CSV exported');
  };

  const setEF = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  const TABS = [
    { id: 'overview', icon: 'info', label: 'Overview' },
    { id: 'invoices', icon: 'receipt_long', label: `Invoices (${invoices.length})` },
    { id: 'payments', icon: 'payments', label: `Payments (${payments.length})` },
    { id: 'services', icon: 'inventory_2', label: 'Services' },
    { id: 'credentials', icon: 'lock', label: 'Credentials' },
    { id: 'activity', icon: 'history', label: 'Activity' },
  ];

  if (loading) return (
    <div className="page-wrapper">
      <div className="loading-state"><div className="spinner" /><span className="loading-text">Loading client…</span></div>
    </div>
  );

  if (!client) return (
    <div className="page-wrapper">
      <div className="empty-state"><span className="material-symbols-outlined">person_off</span><p>Client not found</p></div>
    </div>
  );

  return (
    <div className="page-wrapper">
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <span className="material-symbols-outlined">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
            {toast.msg}
          </div>
        </div>
      )}

      {lockOwner && (
        <div className="lock-banner">
          <span className="material-symbols-outlined">lock</span>
          <strong>Record Locked:</strong> Another user is currently editing this client. Proceed with caution — changes may conflict.
        </div>
      )}

      <div className="client-detail-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/clients')} style={{ padding: '4px 8px' }}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            {!isEditing ? (
              <h1 className="client-detail-name">{client.business_name}</h1>
            ) : (
              <input className="form-input" value={editForm.business_name || ''} onChange={e => setEF('business_name', e.target.value)} style={{ fontSize: '1.5rem', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, width: 380 }} />
            )}
            <StatusBadge status={client.status} />
          </div>
          <div className="client-detail-meta">
            {client.entity_type && <span className="client-detail-meta-item"><span className="material-symbols-outlined">business</span>{client.entity_type}</span>}
            {client.primary_email && <span className="client-detail-meta-item"><span className="material-symbols-outlined">mail</span>{client.primary_email}</span>}
            {client.primary_phone && <span className="client-detail-meta-item"><span className="material-symbols-outlined">phone</span>{client.primary_phone}</span>}
            {client.business_address && <span className="client-detail-meta-item"><span className="material-symbols-outlined">location_on</span>{client.business_address}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {isEditing ? (
            <>
              <button className="btn btn-secondary" onClick={cancelEdit} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving…' : <><span className="material-symbols-outlined">save</span>Save</>}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary btn-sm" onClick={startEdit}>
                <span className="material-symbols-outlined">edit</span> Edit
              </button>
              <button className="btn btn-secondary btn-sm" onClick={exportCSV}>
                <span className="material-symbols-outlined">download</span> CSV
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleToggleStatus}>
                <span className="material-symbols-outlined">{client.status === 'active' ? 'person_off' : 'person'}</span>
                {client.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => navigate(`/invoices?new=1&client_id=${id}`)}>
                <span className="material-symbols-outlined">add</span> New Invoice
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleDelete}>
                <span className="material-symbols-outlined">delete</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="tabs-container">
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)}>
            <span className="material-symbols-outlined">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div className="card-header"><h3>Business Information</h3></div>
            <div className="card-body">
              {isEditing ? (
                <div className="form-grid">
                  {[
                    ['Business Name','business_name'], ['Entity Type','entity_type'],
                    ['EIN','ein'], ['Engagement Type','engagement_type'], ['Status','status'],
                    ['Business Address','business_address'], ['Preferred Payment Method','preferred_payment_method'],
                  ].map(([label, key]) => (
                    <div className="form-group" key={key}>
                      <label className="form-label">{label}</label>
                      <input className="form-input" value={editForm[key] || ''} onChange={e => setEF(key, e.target.value)} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="info-grid">
                  {[
                    ['Business Name', client.business_name],
                    ['Entity Type', client.entity_type],
                    ['EIN', client.ein],
                    ['Engagement Type', client.engagement_type],
                    ['Status', client.status],
                    ['Business Address', client.business_address],
                    ['Preferred Payment Method', client.preferred_payment_method],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div className="info-item" key={k}>
                      <span className="info-label">{k}</span>
                      <span className="info-value">{v || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Contact Information</h3></div>
            <div className="card-body">
              {isEditing ? (
                <div className="form-grid">
                  {[['Email','primary_email'],['Phone','primary_phone'],['Business Address','business_address'],['Preferred Payment','preferred_payment_method']].map(([label, key]) => (
                    <div className="form-group" key={key}>
                      <label className="form-label">{label}</label>
                      <input className="form-input" value={editForm[key] || ''} onChange={e => setEF(key, e.target.value)} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="info-grid">
                  {[
                    ['Email', client.primary_email],
                    ['Phone', client.primary_phone],
                    ['Business Address', client.business_address],
                    ['Preferred Payment', client.preferred_payment_method],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div className="info-item" key={k}>
                      <span className="info-label">{k}</span>
                      <span className="info-value">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Principal Owner(s)</h3></div>
            <div className="card-body">
              {owners.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No owners on file</p> : (
                <div>
                  {owners.map(o => (
                    <div key={o.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{o.name} {o.ownership_percent ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({o.ownership_percent}%)</span> : ''}</div>
                      {o.email && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{o.email}</div>}
                      {o.phone && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{o.phone}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {client.notes && (
            <div className="card">
              <div className="card-header"><h3>Notes</h3></div>
              <div className="card-body">
                {isEditing ? (
                  <textarea className="form-textarea" rows={5} value={editForm.notes || ''} onChange={e => setEF('notes', e.target.value)} style={{ width: '100%' }} />
                ) : (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{client.notes}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="table-container">
          <div className="table-header">
            <h3>Invoices</h3>
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/invoices?new=1&client_id=${id}`)}>
              <span className="material-symbols-outlined">add</span> New Invoice
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Invoice #</th><th>Date</th><th>Due Date</th><th className="text-right">Total</th><th className="text-right">Balance</th><th>Status</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><span className="material-symbols-outlined">receipt_long</span><p>No invoices yet</p></div></td></tr>
                ) : invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="font-mono" style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.82rem' }}>{inv.invoice_number}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{fmtDate(inv.issue_date)}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{fmtDate(inv.due_date)}</td>
                    <td className="text-right" style={{ fontWeight: 600 }}>{fmt(inv.total)}</td>
                    <td className="text-right" style={{ fontWeight: 700, color: inv._balance > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(inv._balance)}</td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td>
                      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                        {inv.status !== 'paid' && (
                          <button className="btn-icon success" title="Record Payment" onClick={() => setPayModal(inv)}>
                            <span className="material-symbols-outlined">payments</span>
                          </button>
                        )}
                        <button className="btn-icon" title="View in Invoices" onClick={() => navigate('/invoices')}>
                          <span className="material-symbols-outlined">open_in_new</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="table-container">
          <div className="table-header"><h3>Payment History</h3></div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Date</th><th>Invoice #</th><th className="text-right">Amount</th><th>Method</th><th>Reference</th></tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={5}><div className="empty-state"><span className="material-symbols-outlined">payments</span><p>No payments recorded</p></div></td></tr>
                ) : payments.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{fmtDate(p.payment_date)}</td>
                    <td className="font-mono" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{p.invoices?.invoice_number || '—'}</td>
                    <td className="text-right" style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(p.amount)}</td>
                    <td><span className="badge badge-draft">{p.method || '—'}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{p.reference_num || '—'}</td>
                  </tr>
                ))}
              </tbody>
              {payments.length > 0 && (
                <tfoot>
                  <tr><td colSpan={2} style={{ fontWeight: 700 }}>Total</td><td className="text-right" style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(payments.reduce((s, p) => s + p.amount, 0))}</td><td colSpan={2} /></tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {activeTab === 'services' && (
        <div className="table-container">
          <div className="table-header">
            <h3>Services Enrolled</h3>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Service</th><th>Category</th><th className="text-right">Price</th><th>Frequency</th></tr>
              </thead>
              <tbody>
                {clientServices.length === 0 ? (
                  <tr><td colSpan={4}><div className="empty-state"><span className="material-symbols-outlined">inventory_2</span><p>No services enrolled</p></div></td></tr>
                ) : clientServices.map(cs => (
                  <tr key={cs.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>{cs.services?.name || '—'}</td>
                    <td><span className="badge badge-draft">{cs.services?.category || '—'}</span></td>
                    <td className="text-right" style={{ fontWeight: 600 }}>{fmt(cs.price || cs.services?.default_price)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{cs.frequency || cs.services?.frequency || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'credentials' && <CredentialsTab clientId={id} />}

      {activeTab === 'activity' && (
        <div className="card">
          <div className="card-header"><h3>Activity Log</h3></div>
          <div className="card-body">
            {activity.length === 0 ? (
              <div className="empty-state"><span className="material-symbols-outlined">history</span><p>No activity recorded</p></div>
            ) : activity.map(a => (
              <div className="activity-item" key={a.id}>
                <div className="activity-dot" />
                <div className="activity-content">
                  <div className="activity-action">{a.action}</div>
                  {a.details && <div className="activity-meta">{a.details}</div>}
                  <div className="activity-meta">{a.created_at ? new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {payModal && (
        <InlinePayModal
          invoice={payModal}
          onClose={() => setPayModal(null)}
          onSaved={loadAll}
          user={user}
        />
      )}
    </div>
  );
}
