import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { InvoiceModal } from './Invoices';

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
  item_name: '', user_id: '', login_url: '', password: '', pin: '',
  security_question_1: '', security_answer_1: '',
  security_question_2: '', security_answer_2: '',
  security_question_3: '', security_answer_3: '',
  notes: '',
});

function CredentialsTab({ clientId }) {
  const [creds, setCreds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPass, setShowPass] = useState({});
  const [showPin, setShowPin] = useState({});
  const [modal, setModal] = useState({ open: false, mode: 'add', data: null });
  const [form, setForm] = useState(emptyCredential());
  const [saving, setSaving] = useState(false);
  const [showFormPass, setShowFormPass] = useState(false);
  const [copied, setCopied] = useState(null);

  const copyToClipboard = async (text, label) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const CopyBtn = ({ text, label }) => (
    <button onClick={() => copyToClipboard(text, label)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied === label ? 'var(--success)' : 'var(--text-muted)', padding: 0, lineHeight: 1, flexShrink: 0 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{copied === label ? 'check_circle' : 'content_copy'}</span>
    </button>
  );

  const load = useCallback(async () => {
    const { data } = await supabase.from('client_credentials').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
    setCreds(data || []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(emptyCredential()); setModal({ open: true, mode: 'add', data: null }); };
  const openEdit = (c) => { setForm({ ...c }); setModal({ open: true, mode: 'edit', data: c }); };
  const openView = (c) => { setForm({ ...c }); setModal({ open: true, mode: 'view', data: c }); };
  const closeModal = () => { setModal({ open: false, mode: 'add', data: null }); setShowFormPass(false); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (modal.mode === 'view') return;
    if (!form.item_name.trim()) return;
    setSaving(true);
    const payload = {
      client_id: clientId,
      item_name: form.item_name,
      user_id: form.user_id,
      password: form.password,
      pin: form.pin,
      login_url: form.login_url,
      security_question_1: form.security_question_1,
      security_answer_1: form.security_answer_1,
      security_question_2: form.security_question_2,
      security_answer_2: form.security_answer_2,
      security_question_3: form.security_question_3,
      security_answer_3: form.security_answer_3,
      notes: form.notes,
    };

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
            <div className="credential-platform">{c.item_name}</div>
            <div className="btn-group">
              <button className="btn-icon" title="View" onClick={() => openView(c)}><span className="material-symbols-outlined">visibility</span></button>
              <button className="btn-icon" title="Edit" onClick={() => openEdit(c)}><span className="material-symbols-outlined">edit</span></button>
              <button className="btn-icon danger" title="Delete" onClick={() => handleDelete(c.id)}><span className="material-symbols-outlined">delete</span></button>
            </div>
          </div>
          <div className="credential-grid">
            {c.user_id && (
              <div className="credential-field">
                <span className="credential-field-label">User ID</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="credential-field-value">{c.user_id}</span>
                  <CopyBtn text={c.user_id} label={`${c.id}-userid`} />
                </div>
              </div>
            )}
            {c.login_url && (
              <div className="credential-field">
                <span className="credential-field-label">Login URL</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <a href={c.login_url.startsWith('http') ? c.login_url : `https://${c.login_url}`} target="_blank" rel="noopener noreferrer" className="credential-field-value" style={{ color: 'var(--primary)', textDecoration: 'none' }}>{c.login_url}</a>
                  <CopyBtn text={c.login_url} label={`${c.id}-login_url`} />
                </div>
              </div>
            )}
            {c.password && (
              <div className="credential-field">
                <span className="credential-field-label">Password</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="credential-field-value">{showPass[c.id] ? c.password : '••••••••'}</span>
                  <button className="btn-icon" style={{ width: 24, height: 24 }} onClick={() => togglePass(c.id)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{showPass[c.id] ? 'visibility_off' : 'visibility'}</span>
                  </button>
                  <CopyBtn text={c.password} label={`${c.id}-password`} />
                </div>
              </div>
            )}
            {c.pin && (
              <div className="credential-field">
                <span className="credential-field-label">PIN</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="credential-field-value">{showPin[c.id] ? c.pin : '••••'}</span>
                  <button className="btn-icon" style={{ width: 24, height: 24 }} onClick={() => setShowPin(p => ({ ...p, [c.id]: !p[c.id] }))}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{showPin[c.id] ? 'visibility_off' : 'visibility'}</span>
                  </button>
                  <CopyBtn text={c.pin} label={`${c.id}-pin`} />
                </div>
              </div>
            )}
            {c.notes && <div className="credential-field" style={{ gridColumn: 'span 2' }}><span className="credential-field-label">Notes</span><span className="credential-field-value" style={{ fontFamily: 'inherit' }}>{c.notes}</span></div>}
          </div>
        </div>
      ))}

      <Modal
        isOpen={modal.open}
        title={modal.mode === 'add' ? 'Add Credential' : modal.mode === 'edit' ? 'Edit Credential' : 'View Credential'}
        size="modal-lg"
        onClose={closeModal}
        footer={
          modal.mode === 'view' ? (
            <button className="btn btn-secondary" onClick={closeModal}>Close</button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          )
        }
      >
        <form onSubmit={handleSave} autoComplete="off">
          <div className="form-grid">
            <div className="form-group form-col-span-2">
              <label className="form-label">Item Name <span className="required">*</span></label>
              <input className="form-input" value={form.item_name} onChange={e => setF('item_name', e.target.value)} placeholder="e.g. IRS.gov, State Portal, QuickBooks…" required readOnly={modal.mode === 'view'} autoComplete="off" />
            </div>
            <div className="form-group">
              <label className="form-label">User ID</label>
              <input className="form-input" value={form.user_id} onChange={e => setF('user_id', e.target.value)} readOnly={modal.mode === 'view'} autoComplete="off" />
            </div>
            <div className="form-group">
              <label className="form-label">Login URL</label>
              <input className="form-input" value={form.login_url || ''} onChange={e => setF('login_url', e.target.value)} placeholder="https://…" readOnly={modal.mode === 'view'} autoComplete="off" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="password-input-wrapper">
                <input type={showFormPass ? 'text' : 'password'} className="form-input" value={form.password} onChange={e => setF('password', e.target.value)} readOnly={modal.mode === 'view'} autoComplete="new-password" />
                <button type="button" className="password-toggle-btn" onClick={() => setShowFormPass(v => !v)}>
                  <span className="material-symbols-outlined">{showFormPass ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">PIN</label>
              <input className="form-input" value={form.pin} onChange={e => setF('pin', e.target.value)} placeholder="4-digit PIN" maxLength={10} readOnly={modal.mode === 'view'} autoComplete="new-password" />
            </div>
          </div>
          <div style={{ marginTop: 16, padding: 14, background: '#f7f9fc', borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Security Questions</div>
            {[['security_question_1','security_answer_1','1'],['security_question_2','security_answer_2','2'],['security_question_3','security_answer_3','3']].map(([qk, ak, n]) => (
              <div className="form-grid" style={{ marginBottom: 8 }} key={qk}>
                <div className="form-group">
                  <label className="form-label">Question {n}</label>
                  <input className="form-input" value={form[qk]} onChange={e => setF(qk, e.target.value)} placeholder={`Security question ${n}`} readOnly={modal.mode === 'view'} autoComplete="off" />
                </div>
                <div className="form-group">
                  <label className="form-label">Answer {n}</label>
                  <input className="form-input" value={form[ak]} onChange={e => setF(ak, e.target.value)} placeholder="Answer" readOnly={modal.mode === 'view'} autoComplete="off" />
                </div>
              </div>
            ))}
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} readOnly={modal.mode === 'view'} autoComplete="off" />
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
    await supabase.from('activity_log').insert({ client_id: invoice.client_id, created_by: user?.id, type: 'Payment Recorded', description: `Payment of ${fmt(amt)} on invoice ${invoice.invoice_number}` });
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

/* ===== INTAKE TAB ===== */
const FIRM = { name: 'S&T Tax and Advisory LLC', email: 'hello.sttax@gmail.com', phone: '929-367-8799', address: 'Mineola, NY' };

const maskSSN = (ssn) => {
  if (!ssn) return '—';
  const d = ssn.replace(/\D/g, '');
  return d.length >= 9 ? `XXX-XX-${d.slice(-4)}` : 'XXX-XX-XXXX';
};

function IntakeTab({ client, clientId, user, onSaved }) {
  const [form, setForm] = useState({
    is_new_entity: client?.is_new_entity || false,
    proposed_name_1: client?.proposed_name_1 || '',
    proposed_name_2: client?.proposed_name_2 || '',
    proposed_name_3: client?.proposed_name_3 || '',
    business_address: client?.business_address || '',
    ein: client?.ein || '',
    business_type: client?.business_type || '',
    entity_type: client?.entity_type || '',
    owner_name: client?.owner_name || '',
    owner_ssn: client?.owner_ssn || '',
    owner_dob: client?.owner_dob || '',
    owner_address: client?.owner_address || '',
    primary_phone: client?.primary_phone || '',
    primary_email: client?.primary_email || '',
    intake_notes: client?.intake_notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [showSSN, setShowSSN] = useState(false);
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, owner_dob: form.owner_dob || null };
    const { error } = await supabase.from('clients').update(payload).eq('id', clientId);
    if (error) { alert(error.message); setSaving(false); return; }
    await supabase.from('activity_log').insert({ client_id: clientId, created_by: user?.id, type: 'Intake Sheet Updated', description: 'Intake information saved' });
    setSaving(false);
    onSaved();
  };

  const downloadPDF = () => {
    if (!window.jspdf) { alert('PDF library not loaded. Check your internet connection.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const primary = [13, 78, 166];
    const lightBlue = [240, 245, 255];
    const gray = [100, 100, 100];
    const black = [0, 0, 0];

    doc.setFillColor(...primary);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(FIRM.name, 14, 14);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`${FIRM.email}  •  ${FIRM.phone}  •  ${FIRM.address}`, 14, 22);
    doc.setFontSize(20); doc.setFont('helvetica', 'bold');
    doc.text('CLIENT INTAKE SHEET', 14, 34);

    doc.setTextColor(...gray);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`Date Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 14, 48);

    let y = 58;
    const checkPage = () => { if (y > 268) { doc.addPage(); y = 20; } };

    const section = (title) => {
      checkPage();
      doc.setFillColor(...lightBlue);
      doc.rect(14, y - 5, 182, 9, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primary);
      doc.text(title, 16, y + 1);
      y += 10;
    };

    const row = (label, value) => {
      checkPage();
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...gray);
      doc.text(`${label}:`, 16, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...black);
      const val = value || '—';
      const wrapped = doc.splitTextToSize(val, 110);
      doc.text(wrapped, 82, y);
      y += Math.max(7, wrapped.length * 5);
    };

    section('SECTION 1 — ENTITY INFORMATION');
    row('New Entity Formation', form.is_new_entity ? 'Yes' : 'No');
    if (form.is_new_entity) {
      row('Proposed Name 1 (1st choice)', form.proposed_name_1);
      row('Proposed Name 2 (2nd choice)', form.proposed_name_2);
      row('Proposed Name 3 (3rd choice)', form.proposed_name_3);
    } else {
      row('Business Name', client?.business_name);
    }
    row('Business / Company Address', form.business_address);
    row('EIN', form.ein);
    row('Type of Business / Industry', form.business_type);
    row('Entity Type', form.entity_type);

    y += 4;
    section('SECTION 2 — OWNER INFORMATION');
    row('Owner Full Name', form.owner_name);
    row('Owner SSN', maskSSN(form.owner_ssn));
    row('Date of Birth', form.owner_dob ? new Date(form.owner_dob + 'T00:00:00').toLocaleDateString('en-US') : '');
    row('Owner Home Address', form.owner_address);
    row('Contact Phone', form.primary_phone);
    row('Main Email Address', form.primary_email);

    if (form.intake_notes) {
      y += 4;
      section('SECTION 3 — ADDITIONAL NOTES');
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...black);
      const noteLines = doc.splitTextToSize(form.intake_notes, 178);
      noteLines.forEach(line => { checkPage(); doc.text(line, 16, y); y += 5.5; });
    }

    doc.setFontSize(7); doc.setTextColor(...gray); doc.setFont('helvetica', 'italic');
    doc.text(`${FIRM.name} — Confidential Client Document`, 105, 290, { align: 'center' });

    const safeName = (client?.business_name || form.proposed_name_1 || 'client').replace(/[^a-z0-9]/gi, '_');
    doc.save(`${safeName}_intake.pdf`);
  };

  const downloadExcel = () => {
    const rows = [
      ['CLIENT INTAKE SHEET — ' + FIRM.name],
      ['Generated:', new Date().toLocaleDateString()],
      [],
      ['SECTION 1 — ENTITY INFORMATION'],
      ['New Entity Formation', form.is_new_entity ? 'Yes' : 'No'],
      ...(form.is_new_entity
        ? [['Proposed Name 1 (1st choice)', form.proposed_name_1], ['Proposed Name 2 (2nd choice)', form.proposed_name_2], ['Proposed Name 3 (3rd choice)', form.proposed_name_3]]
        : [['Business Name', client?.business_name || '']]),
      ['Business / Company Address', form.business_address],
      ['EIN', form.ein],
      ['Type of Business / Industry', form.business_type],
      ['Entity Type', form.entity_type],
      [],
      ['SECTION 2 — OWNER INFORMATION'],
      ['Owner Full Name', form.owner_name],
      ['Owner SSN (masked)', maskSSN(form.owner_ssn)],
      ['Date of Birth', form.owner_dob],
      ['Owner Home Address', form.owner_address],
      ['Contact Phone', form.primary_phone],
      ['Main Email Address', form.primary_email],
      [],
      ['SECTION 3 — ADDITIONAL NOTES'],
      ['Notes', form.intake_notes],
    ];
    const safeName = (client?.business_name || 'client').replace(/[^a-z0-9]/gi, '_');
    downloadCSV(toCSV(rows), `${safeName}_intake.csv`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>Client Intake Sheet</h4>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fill out and save — then generate PDF or Excel for client records.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={downloadExcel}>
            <span className="material-symbols-outlined">table_view</span> Excel
          </button>
          <button className="btn btn-secondary btn-sm" onClick={downloadPDF}>
            <span className="material-symbols-outlined">picture_as_pdf</span> PDF
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            <span className="material-symbols-outlined">save</span> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* SECTION 1 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h3>Section 1 — Entity Information</h3></div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Is this a new entity formation?</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${form.is_new_entity ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setF('is_new_entity', true)}
                  style={{ minWidth: 60 }}
                >Yes</button>
                <button
                  type="button"
                  className={`btn btn-sm ${!form.is_new_entity ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setF('is_new_entity', false)}
                  style={{ minWidth: 60 }}
                >No</button>
              </div>
            </div>

            {form.is_new_entity ? (
              <>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Proposed Business Name — 1st Choice</label>
                  <input className="form-input" value={form.proposed_name_1} onChange={e => setF('proposed_name_1', e.target.value)} placeholder="First preference" />
                </div>
                <div className="form-group">
                  <label className="form-label">Proposed Business Name — 2nd Choice</label>
                  <input className="form-input" value={form.proposed_name_2} onChange={e => setF('proposed_name_2', e.target.value)} placeholder="Second preference" />
                </div>
                <div className="form-group">
                  <label className="form-label">Proposed Business Name — 3rd Choice</label>
                  <input className="form-input" value={form.proposed_name_3} onChange={e => setF('proposed_name_3', e.target.value)} placeholder="Third preference" />
                </div>
              </>
            ) : (
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Business Name</label>
                <input className="form-input" value={client?.business_name || ''} readOnly style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', cursor: 'default' }} />
              </div>
            )}

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Business / Company Address</label>
              <input className="form-input" value={form.business_address} onChange={e => setF('business_address', e.target.value)} placeholder="Street, City, State, ZIP" />
            </div>
            <div className="form-group">
              <label className="form-label">EIN</label>
              <input className="form-input" value={form.ein} onChange={e => setF('ein', e.target.value)} placeholder="XX-XXXXXXX" />
            </div>
            <div className="form-group">
              <label className="form-label">Type of Business / Industry</label>
              <input className="form-input" value={form.business_type} onChange={e => setF('business_type', e.target.value)} placeholder="e.g. Retail, Consulting, Healthcare…" />
            </div>
            <div className="form-group">
              <label className="form-label">Entity Type</label>
              <select className="form-select" value={form.entity_type} onChange={e => setF('entity_type', e.target.value)}>
                <option value="">— Select —</option>
                {['Sole Proprietorship','Partnership','S-Corp','C-Corp','LLC','Disregarded Entity'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h3>Section 2 — Owner Information</h3></div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Owner Full Name</label>
              <input className="form-input" autoComplete="off" value={form.owner_name} onChange={e => setF('owner_name', e.target.value)} placeholder="First and Last Name" />
            </div>
            <div className="form-group">
              <label className="form-label">Owner SSN</label>
              <div className="password-input-wrapper">
                <input
                  type={showSSN ? 'text' : 'password'}
                  className="form-input"
                  autoComplete="new-password"
                  name="intake-ssn"
                  value={form.owner_ssn}
                  onChange={e => setF('owner_ssn', e.target.value)}
                  placeholder="XXX-XX-XXXX"
                />
                <button type="button" className="password-toggle-btn" onClick={() => setShowSSN(v => !v)}>
                  <span className="material-symbols-outlined">{showSSN ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input type="date" className="form-input" autoComplete="off" value={form.owner_dob} onChange={e => setF('owner_dob', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Owner Home Address</label>
              <input className="form-input" autoComplete="off" value={form.owner_address} onChange={e => setF('owner_address', e.target.value)} placeholder="Street, City, State, ZIP" />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Phone</label>
              <input className="form-input" autoComplete="off" value={form.primary_phone} onChange={e => setF('primary_phone', e.target.value)} placeholder="(XXX) XXX-XXXX" />
            </div>
            <div className="form-group">
              <label className="form-label">Main Email Address</label>
              <input type="email" className="form-input" autoComplete="off" value={form.primary_email} onChange={e => setF('primary_email', e.target.value)} placeholder="email@example.com" />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3 */}
      <div className="card">
        <div className="card-header"><h3>Section 3 — Additional Notes</h3></div>
        <div className="card-body">
          <textarea
            className="form-textarea"
            rows={6}
            value={form.intake_notes}
            onChange={e => setF('intake_notes', e.target.value)}
            placeholder="Any additional notes, special circumstances, referral source, or instructions…"
            style={{ width: '100%' }}
          />
        </div>
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
  const [showSSN, setShowSSN] = useState(false);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [lockOwner, setLockOwner] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [payModal, setPayModal] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [editInvoice, setEditInvoice] = useState(null);
  const [toast, setToast] = useState(null);
  const [otherEditors, setOtherEditors] = useState([]);
  const [serviceModal, setServiceModal] = useState(false);
  const [serviceForm, setServiceForm] = useState({});
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [savingService, setSavingService] = useState(false);
  const presenceChannelRef = useRef(null);
  const isLockHolderRef = useRef(false);

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
        { data: act },
        { data: cn },
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase.from('client_owners').select('*').eq('client_id', id),
        supabase.from('client_services').select('*, services(name, category, price, frequency)').eq('client_id', id),
        supabase.from('services').select('*').eq('is_active', true).order('name'),
        supabase.from('invoices').select('*').eq('client_id', id).order('issue_date', { ascending: false }),
        supabase.from('activity_log').select('*').eq('client_id', id).order('timestamp', { ascending: false }).limit(50),
        supabase.from('client_notes').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      ]);

      const invoiceIds = (inv || []).map(i => i.id);
      const { data: pay } = invoiceIds.length > 0
        ? await supabase.from('payments').select('*, invoices(invoice_number)').in('invoice_id', invoiceIds)
        : { data: [] };

      setClient(cl);
      setNotes(cn || []);
      setOwners(ow || []);
      setClientServices(cs || []);
      setAllServices(sv || []);
      setPayments(pay || []);
      setActivity(act || []);

      const paidMap = {};
      (pay || []).forEach(p => { paidMap[p.invoice_id] = (paidMap[p.invoice_id] || 0) + p.amount; });
      setInvoices((inv || []).map(i => ({ ...i, _paid: paidMap[i.id] || 0, _balance: Math.max(0, (i.total || 0) - (paidMap[i.id] || 0)) })));

      if (cl?.locked_by && cl.locked_by !== user?.id) {
        const lockedAt = cl.locked_at ? new Date(cl.locked_at) : null;
        const isStale = !lockedAt || (Date.now() - lockedAt.getTime() > 30 * 1000);
        if (isStale) {
          setLockOwner(null);
          supabase.from('clients').update({ locked_by: null, locked_at: null }).eq('id', id).catch(() => {});
        } else {
          setLockOwner(cl.locked_by);
        }
      } else {
        setLockOwner(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const currentEmail = user?.email;
    if (!currentEmail || !id) return;
    const channel = supabase.channel(`editing-client-${id}`);
    presenceChannelRef.current = channel;
    channel.on('presence', { event: 'sync' }, () => {
      const others = Object.values(channel.presenceState()).flat().filter(p => p.email !== currentEmail);
      setOtherEditors(others);
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ email: currentEmail, online_at: new Date().toISOString() });
      }
    });
    return () => { supabase.removeChannel(channel); };
  }, [id, user?.email]);

  useEffect(() => {
    return () => {
      if (isLockHolderRef.current) {
        supabase.from('clients').update({ locked_by: null, locked_at: null }).eq('id', id).catch(() => {});
        isLockHolderRef.current = false;
      }
    };
  }, [id]);

  const startEdit = async () => {
    setEditForm({ ...client });
    try {
      await supabase.from('clients').update({ locked_by: user?.id, locked_at: new Date().toISOString() }).eq('id', id);
      isLockHolderRef.current = true;
    } catch (_) {}
    setIsEditing(true);
  };

  const cancelEdit = async () => {
    try {
      await supabase.from('clients').update({ locked_by: null, locked_at: null }).eq('id', id);
    } catch (_) {}
    isLockHolderRef.current = false;
    setIsEditing(false);
  };

  const saveEdit = async () => {
    setSaving(true);
    const { error } = await supabase.from('clients').update({ ...editForm, locked_by: null, locked_at: null }).eq('id', id);
    if (error) { showToast(error.message, 'error'); setSaving(false); return; }
    await supabase.from('activity_log').insert({ client_id: id, created_by: user?.id, type: 'Client Updated', description: 'Client information updated' });
    isLockHolderRef.current = false;
    setSaving(false);
    setIsEditing(false);
    loadAll();
    showToast('Client saved successfully');
  };

  const postNote = async () => {
    const content = newNote.trim();
    if (!content) return;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const { error } = await supabase.from('client_notes').insert({ client_id: id, content, created_by: authUser?.email || '' });
    if (error) { showToast(error.message, 'error'); return; }
    setNewNote('');
    const { data: cn } = await supabase.from('client_notes').select('*').eq('client_id', id).order('created_at', { ascending: false });
    setNotes(cn || []);
  };

  const deleteNote = async (noteId) => {
    if (!window.confirm('Delete this note?')) return;
    await supabase.from('client_notes').delete().eq('id', noteId);
    setNotes(prev => prev.filter(n => n.id !== noteId));
  };

  const handleToggleStatus = async () => {
    const isActive = (client.status || '').toLowerCase() === 'active';
    const newStatus = isActive ? 'Inactive' : 'Active';
    await supabase.from('clients').update({ status: newStatus }).eq('id', id);
    await supabase.from('activity_log').insert({ client_id: id, created_by: user?.id, type: isActive ? 'Client Deactivated' : 'Client Activated', description: `Status changed to ${newStatus}` });
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
      ...owners.map(o => [o.owner_name, o.email, o.phone, o.ownership_pct]),
      [],
      ['=== SERVICES ==='],
      ['Service','Category','Price','Frequency'],
      ...clientServices.map(cs => [cs.services?.name, cs.services?.category, cs.custom_price || cs.services?.price, cs.frequency || cs.services?.frequency]),
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

  const toggleQB = async (invId, current) => {
    const newVal = !current;
    await supabase.from('invoices').update({ in_quickbooks: newVal }).eq('id', invId);
    setInvoices(prev => prev.map(i => i.id === invId ? { ...i, in_quickbooks: newVal } : i));
  };

  const recalcInvoiceAfterPaymentDelete = async (invoiceId) => {
    const { data: remaining } = await supabase.from('payments').select('amount').eq('invoice_id', invoiceId);
    const totalPaid = (remaining || []).reduce((sum, p) => sum + p.amount, 0);
    const { data: inv } = await supabase.from('invoices').select('total').eq('id', invoiceId).single();
    const newBalance = (inv?.total || 0) - totalPaid;
    const newStatus = newBalance <= 0 ? 'Paid' : totalPaid > 0 ? 'Partial' : 'Unpaid';
    await supabase.from('invoices').update({ balance_due: newBalance, status: newStatus }).eq('id', invoiceId);
  };

  const handlePaymentDelete = async (paymentId) => {
    if (!confirm('Delete this payment record?')) return;
    const payment = payments.find(p => p.id === paymentId);
    await supabase.from('payments').delete().eq('id', paymentId);
    if (payment?.invoice_id) await recalcInvoiceAfterPaymentDelete(payment.invoice_id);
    loadAll();
    showToast('Payment deleted');
  };

  const setSF = (k, v) => setServiceForm(f => ({ ...f, [k]: v }));

  const openAddService = () => {
    setEditingServiceId(null);
    setServiceForm({ service_id: '', custom_price: '', frequency: '', start_date: '', end_date: '', status: 'Active', notes: '' });
    setServiceModal(true);
  };

  const openEditService = (cs) => {
    setEditingServiceId(cs.id);
    setServiceForm({
      service_id: cs.service_id || '',
      custom_price: cs.custom_price != null ? String(cs.custom_price) : '',
      frequency: cs.frequency || '',
      start_date: cs.start_date || '',
      end_date: cs.end_date || '',
      status: cs.status || 'Active',
      notes: cs.notes || '',
    });
    setServiceModal(true);
  };

  const handleServiceSave = async () => {
    if (!serviceForm.service_id) { showToast('Please select a service', 'error'); return; }
    setSavingService(true);
    const payload = {
      client_id: id,
      service_id: serviceForm.service_id,
      custom_price: serviceForm.custom_price !== '' ? parseFloat(serviceForm.custom_price) : null,
      frequency: serviceForm.frequency || null,
      start_date: serviceForm.start_date || null,
      end_date: serviceForm.end_date || null,
      status: serviceForm.status || 'Active',
      notes: serviceForm.notes || null,
    };
    if (editingServiceId) {
      await supabase.from('client_services').update(payload).eq('id', editingServiceId);
    } else {
      await supabase.from('client_services').insert(payload);
    }
    setSavingService(false);
    setServiceModal(false);
    loadAll();
    showToast(editingServiceId ? 'Service updated' : 'Service added');
  };

  const handleServiceDelete = async (csId) => {
    if (!confirm('Remove this service from the client?')) return;
    await supabase.from('client_services').delete().eq('id', csId);
    loadAll();
    showToast('Service removed');
  };

  const TABS = [
    { id: 'overview', icon: 'info', label: 'Overview' },
    { id: 'intake', icon: 'assignment', label: 'Intake Sheet' },
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

      {otherEditors.length > 0 && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>warning</span>
          <span><strong>{otherEditors[0].email}</strong> is currently viewing this record. Saving may overwrite their changes.</span>
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
                <span className="material-symbols-outlined">{(client.status || '').toLowerCase() === 'active' ? 'person_off' : 'person'}</span>
                {(client.status || '').toLowerCase() === 'active' ? 'Deactivate' : 'Activate'}
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
                  <div className="form-group">
                    <label className="form-label">Business Name</label>
                    <input className="form-input" value={editForm.business_name || ''} onChange={e => setEF('business_name', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Entity Type</label>
                    <select className="form-select" value={editForm.entity_type || ''} onChange={e => setEF('entity_type', e.target.value)}>
                      <option value="">— Select —</option>
                      {['Sole Proprietorship','Partnership','S-Corp','C-Corp','LLC','Disregarded Entity','Individual'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">EIN</label>
                    <input className="form-input" value={editForm.ein || ''} onChange={e => setEF('ein', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Engagement Type</label>
                    <input className="form-input" value={editForm.engagement_type || ''} onChange={e => setEF('engagement_type', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <input className="form-input" value={editForm.status || ''} onChange={e => setEF('status', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Business Address</label>
                    <input className="form-input" value={editForm.business_address || ''} onChange={e => setEF('business_address', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Preferred Payment Method</label>
                    <input className="form-input" value={editForm.preferred_payment_method || ''} onChange={e => setEF('preferred_payment_method', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Annual Tax Filing Year End</label>
                    <input className="form-input" value={editForm.tax_year_end || ''} onChange={e => setEF('tax_year_end', e.target.value)} placeholder="e.g. December 31" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payroll Frequency</label>
                    <select className="form-select" value={editForm.payroll_frequency || ''} onChange={e => setEF('payroll_frequency', e.target.value)}>
                      <option value="">— Select —</option>
                      {['None','Weekly','Bi-Weekly','Semi-Monthly','Monthly'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Federal 941 Deposit Frequency</label>
                    <select className="form-select" value={editForm.payroll_tax_deposit_frequency || ''} onChange={e => setEF('payroll_tax_deposit_frequency', e.target.value)}>
                      <option value="">— Select —</option>
                      {['None','Semi-Weekly','Monthly','Quarterly'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
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
                    ['Annual Tax Filing Year End', client.tax_year_end],
                    ['Payroll Frequency', client.payroll_frequency],
                    ['Federal 941 Deposit Frequency', client.payroll_tax_deposit_frequency],
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
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{o.owner_name} {o.ownership_pct ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({o.ownership_pct}%)</span> : ''}</div>
                      {o.email && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{o.email}</div>}
                      {o.phone && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{o.phone}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {(client.owner_name || client.owner_ssn || client.owner_dob || client.owner_address) && (
            <div className="card">
              <div className="card-header"><h3>Owner Information</h3></div>
              <div className="card-body">
                <div className="info-grid">
                  {client.owner_name && (
                    <div className="info-item" key="owner-name">
                      <span className="info-label">Owner Name</span>
                      <span className="info-value">{client.owner_name}</span>
                    </div>
                  )}
                  {client.owner_ssn && (
                    <div className="info-item" key="owner-ssn">
                      <span className="info-label">SSN</span>
                      <span className="info-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {showSSN ? client.owner_ssn : '•••-••-' + client.owner_ssn.slice(-4)}
                        <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={() => setShowSSN(v => !v)}>
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{showSSN ? 'visibility_off' : 'visibility'}</span>
                        </button>
                      </span>
                    </div>
                  )}
                  {client.owner_dob && (
                    <div className="info-item" key="owner-dob">
                      <span className="info-label">Date of Birth</span>
                      <span className="info-value">{new Date(client.owner_dob + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  )}
                  {client.owner_address && (
                    <div className="info-item" key="owner-address">
                      <span className="info-label">Owner Home Address</span>
                      <span className="info-value">{client.owner_address}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-header"><h3>Notes</h3></div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  style={{ flex: 1, resize: 'vertical' }}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postNote(); }}
                />
                <button className="btn btn-primary btn-sm" onClick={postNote} disabled={!newNote.trim()} style={{ alignSelf: 'flex-end' }}>
                  <span className="material-symbols-outlined">send</span> Post Note
                </button>
              </div>
              {notes.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>No notes added yet</p>
              ) : (
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {notes.map((n, i) => (
                    <div key={n.id} style={{ paddingBottom: 14, marginBottom: 14, borderBottom: i < notes.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{n.created_by}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {n.created_at ? new Date(n.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                          <button onClick={() => deleteNote(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px 4px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                          </button>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{n.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'intake' && (
        <IntakeTab client={client} clientId={id} user={user} onSaved={loadAll} />
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
                <tr><th>Invoice #</th><th>Date</th><th>Due Date</th><th className="text-right">Total</th><th className="text-right">Balance</th><th>Status</th><th style={{ textAlign: 'center' }}>QB</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><span className="material-symbols-outlined">receipt_long</span><p>No invoices yet</p></div></td></tr>
                ) : invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="font-mono" style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.82rem' }}>
                      {inv.invoice_number}
                      {inv.in_quickbooks && <span style={{ fontSize: '0.6rem', background: '#22c55e', color: 'white', borderRadius: 3, padding: '1px 4px', marginLeft: 5, fontWeight: 700, verticalAlign: 'middle' }}>QB</span>}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{fmtDate(inv.issue_date)}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{fmtDate(inv.due_date)}</td>
                    <td className="text-right" style={{ fontWeight: 600 }}>{fmt(inv.total)}</td>
                    <td className="text-right" style={{ fontWeight: 700, color: (inv.status || '').toLowerCase() === 'paid' || inv._balance <= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {(inv.status || '').toLowerCase() === 'paid' ? fmt(0) : fmt(inv._balance)}
                    </td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={!!inv.in_quickbooks}
                        onChange={() => toggleQB(inv.id, inv.in_quickbooks)}
                        title="Synced to QuickBooks"
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                      />
                    </td>
                    <td>
                      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                        {!['paid', 'void'].includes((inv.status || '').toLowerCase()) && (
                          <>
                            <button className="btn-icon" title="Edit Invoice" onClick={() => setEditInvoice(inv)}>
                              <span className="material-symbols-outlined">edit</span>
                            </button>
                            <button className="btn-icon success" title="Record Payment" onClick={() => setPayModal(inv)}>
                              <span className="material-symbols-outlined">payments</span>
                            </button>
                          </>
                        )}
                        <button className="btn-icon" title="View Invoice" onClick={() => setViewInvoice(inv)}>
                          <span className="material-symbols-outlined">visibility</span>
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
                <tr><th>Date</th><th>Invoice #</th><th className="text-right">Amount</th><th>Method</th><th>Reference</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-state"><span className="material-symbols-outlined">payments</span><p>No payments recorded</p></div></td></tr>
                ) : payments.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{fmtDate(p.payment_date)}</td>
                    <td className="font-mono" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{p.invoices?.invoice_number || '—'}</td>
                    <td className="text-right" style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(p.amount)}</td>
                    <td><span className="badge badge-draft">{p.method || '—'}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{p.reference_num || '—'}</td>
                    <td>
                      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn-icon danger" title="Delete" onClick={() => handlePaymentDelete(p.id)}>
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {payments.length > 0 && (
                <tfoot>
                  <tr><td colSpan={2} style={{ fontWeight: 700 }}>Total</td><td className="text-right" style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(payments.reduce((s, p) => s + p.amount, 0))}</td><td colSpan={3} /></tr>
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
            <button className="btn btn-primary btn-sm" onClick={openAddService}>
              <span className="material-symbols-outlined">add</span>
              Add Service
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Service</th><th>Category</th><th className="text-right">Price</th><th>Frequency</th><th>Start Date</th><th>Status</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {clientServices.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><span className="material-symbols-outlined">inventory_2</span><p>No services enrolled</p></div></td></tr>
                ) : clientServices.map(cs => (
                  <tr key={cs.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>{cs.services?.name || '—'}</td>
                    <td><span className="badge badge-draft">{cs.services?.category || '—'}</span></td>
                    <td className="text-right" style={{ fontWeight: 600 }}>{fmt(cs.custom_price ?? cs.services?.price)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{cs.frequency || cs.services?.frequency || '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{fmtDate(cs.start_date)}</td>
                    <td><span className={`badge badge-${(cs.status || 'active').toLowerCase()}`}>{cs.status || 'Active'}</span></td>
                    <td>
                      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn-icon" title="Edit" onClick={() => openEditService(cs)}>
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                        <button className="btn-icon danger" title="Remove" onClick={() => handleServiceDelete(cs.id)}>
                          <span className="material-symbols-outlined">delete</span>
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
                  <div className="activity-action">{a.type}</div>
                  {a.description && <div className="activity-meta">{a.description}</div>}
                  <div className="activity-meta">{a.timestamp ? new Date(a.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editInvoice && (
        <InvoiceModal
          mode="edit"
          invoice={editInvoice}
          clients={client ? [client] : []}
          onClose={() => setEditInvoice(null)}
          onSaved={loadAll}
        />
      )}

      {viewInvoice && (
        <Modal
          isOpen={!!viewInvoice}
          title={`Invoice ${viewInvoice.invoice_number}`}
          onClose={() => setViewInvoice(null)}
          footer={<button className="btn btn-secondary" onClick={() => setViewInvoice(null)}>Close</button>}
        >
          <div className="info-grid">
            <div className="info-item"><span className="info-label">Invoice Date</span><span className="info-value">{fmtDate(viewInvoice.issue_date)}</span></div>
            <div className="info-item"><span className="info-label">Due Date</span><span className="info-value">{fmtDate(viewInvoice.due_date)}</span></div>
            <div className="info-item"><span className="info-label">Total</span><span className="info-value" style={{ fontWeight: 700 }}>{fmt(viewInvoice.total)}</span></div>
            <div className="info-item"><span className="info-label">Paid</span><span className="info-value" style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(viewInvoice._paid)}</span></div>
            <div className="info-item"><span className="info-label">Balance Due</span><span className="info-value" style={{ color: viewInvoice._balance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>{fmt(viewInvoice._balance)}</span></div>
            <div className="info-item"><span className="info-label">Status</span><span className="info-value"><StatusBadge status={viewInvoice.status} /></span></div>
            <div className="info-item"><span className="info-label">QuickBooks</span><span className="info-value">{viewInvoice.in_quickbooks ? '✅ Synced' : '⬜ Not synced'}</span></div>
          </div>
          {viewInvoice.notes && (
            <div style={{ marginTop: 16 }}>
              <div className="info-label">Notes</div>
              <p style={{ marginTop: 4, fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{viewInvoice.notes}</p>
            </div>
          )}
        </Modal>
      )}

      {payModal && (
        <InlinePayModal
          invoice={payModal}
          onClose={() => setPayModal(null)}
          onSaved={loadAll}
          user={user}
        />
      )}

      {serviceModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setServiceModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editingServiceId ? 'Edit Service' : 'Add Service'}</h3>
              <button className="btn-icon" onClick={() => setServiceModal(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Service *</label>
                  <select className="form-input" value={serviceForm.service_id} onChange={e => setSF('service_id', e.target.value)} disabled={!!editingServiceId}>
                    <option value="">Select a service…</option>
                    {allServices.map(s => <option key={s.id} value={s.id}>{s.name}{s.category ? ` (${s.category})` : ''}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Custom Price</label>
                  <input type="number" className="form-input" placeholder="Leave blank to use default" value={serviceForm.custom_price} onChange={e => setSF('custom_price', e.target.value)} step="0.01" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Frequency</label>
                  <select className="form-input" value={serviceForm.frequency} onChange={e => setSF('frequency', e.target.value)}>
                    <option value="">Use service default</option>
                    <option>Monthly</option>
                    <option>Quarterly</option>
                    <option>Annual</option>
                    <option>One-time</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input type="date" className="form-input" value={serviceForm.start_date} onChange={e => setSF('start_date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input type="date" className="form-input" value={serviceForm.end_date} onChange={e => setSF('end_date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={serviceForm.status} onChange={e => setSF('status', e.target.value)}>
                    <option>Active</option>
                    <option>Inactive</option>
                    <option>Paused</option>
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Notes</label>
                  <textarea className="form-input" rows={2} value={serviceForm.notes} onChange={e => setSF('notes', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setServiceModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleServiceSave} disabled={savingService}>
                {savingService ? 'Saving…' : editingServiceId ? 'Save Changes' : 'Add Service'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
