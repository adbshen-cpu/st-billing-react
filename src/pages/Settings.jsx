import { useState } from 'react';
import { supabase } from '../lib/supabase';

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];

const downloadCSV = (content, filename) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const toCSV = (rows) =>
  rows.map(row =>
    row.map(cell => {
      if (cell == null) return '';
      const s = String(cell);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  ).join('\n');

export default function Settings() {
  const [firm, setFirm] = useState({
    name: 'S&T Tax and Advisory LLC',
    address: '', city: '', state: '', zip: '',
    phone: '', email: '', website: '',
    ein: '',
  });
  const [saved, setSaved] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  const setF = (k, v) => setFirm(f => ({ ...f, [k]: v }));

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const [
        { data: clients },
        { data: owners },
        { data: invoices },
        { data: lines },
        { data: payments },
        { data: services },
        { data: cServices },
      ] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('client_owners').select('*'),
        supabase.from('invoices').select('*').order('date', { ascending: false }),
        supabase.from('invoice_lines').select('*'),
        supabase.from('payments').select('*').order('date', { ascending: false }),
        supabase.from('services').select('*'),
        supabase.from('client_services').select('*'),
      ]);

      const sections = [
        ['=== CLIENTS ==='],
        ['id','name','dba','business_type','ein','email','phone','address','city','state','zip','status','created_at'],
        ...(clients || []).map(c => [c.id,c.name,c.dba,c.business_type,c.ein,c.email,c.phone,c.address,c.city,c.state,c.zip,c.status,c.created_at]),
        [],
        ['=== CLIENT OWNERS ==='],
        ['id','client_id','name','email','phone','ssn','ownership_percent'],
        ...(owners || []).map(o => [o.id,o.client_id,o.name,o.email,o.phone,o.ssn,o.ownership_percent]),
        [],
        ['=== INVOICES ==='],
        ['id','invoice_number','client_id','date','due_date','subtotal','late_fee','total','status','quickbooks_synced'],
        ...(invoices || []).map(i => [i.id,i.invoice_number,i.client_id,i.date,i.due_date,i.subtotal,i.late_fee,i.total,i.status,i.quickbooks_synced]),
        [],
        ['=== INVOICE LINES ==='],
        ['id','invoice_id','description','quantity','rate','proration_factor','amount'],
        ...(lines || []).map(l => [l.id,l.invoice_id,l.description,l.quantity,l.rate,l.proration_factor,l.amount]),
        [],
        ['=== PAYMENTS ==='],
        ['id','invoice_id','client_id','amount','date','method','reference','notes'],
        ...(payments || []).map(p => [p.id,p.invoice_id,p.client_id,p.amount,p.date,p.method,p.reference,p.notes]),
        [],
        ['=== SERVICES ==='],
        ['id','name','category','default_price','frequency','active'],
        ...(services || []).map(s => [s.id,s.name,s.category,s.default_price,s.frequency,s.active]),
        [],
        ['=== CLIENT SERVICES ==='],
        ['id','client_id','service_id','price','frequency'],
        ...(cServices || []).map(cs => [cs.id,cs.client_id,cs.service_id,cs.price,cs.frequency]),
      ];

      const dateStr = new Date().toISOString().split('T')[0];
      downloadCSV(toCSV(sections), `st-billing-backup-${dateStr}.csv`);
    } catch (err) {
      console.error('Backup error:', err);
      alert('Backup failed: ' + err.message);
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header"><h2>Settings</h2></div>

      <form onSubmit={handleSave}>
        <div className="settings-section">
          <div className="settings-section-title">
            <span className="material-symbols-outlined">business</span>
            Firm Information
          </div>
          <div className="form-grid">
            <div className="form-group form-col-span-2">
              <label className="form-label">Firm Name</label>
              <input className="form-input" value={firm.name} onChange={e => setF('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={firm.phone} onChange={e => setF('phone', e.target.value)} placeholder="(555) 555-5555" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" value={firm.email} onChange={e => setF('email', e.target.value)} placeholder="info@staxadvisory.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Website</label>
              <input className="form-input" value={firm.website} onChange={e => setF('website', e.target.value)} placeholder="https://staxadvisory.com" />
            </div>
            <div className="form-group">
              <label className="form-label">EIN</label>
              <input className="form-input" value={firm.ein} onChange={e => setF('ein', e.target.value)} placeholder="XX-XXXXXXX" />
            </div>
            <div className="form-group form-col-span-2">
              <label className="form-label">Address</label>
              <input className="form-input" value={firm.address} onChange={e => setF('address', e.target.value)} placeholder="123 Main St" />
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" value={firm.city} onChange={e => setF('city', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">State</label>
              <select className="form-select" value={firm.state} onChange={e => setF('state', e.target.value)}>
                <option value="">Select…</option>
                {US_STATES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">ZIP</label>
              <input className="form-input" value={firm.zip} onChange={e => setF('zip', e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button type="submit" className="btn btn-primary">
              <span className="material-symbols-outlined">save</span>
              Save Settings
            </button>
            {saved && <span style={{ color: 'var(--success)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>Saved!</span>}
          </div>
        </div>
      </form>

      <div className="settings-section">
        <div className="settings-section-title">
          <span className="material-symbols-outlined">download</span>
          Data Backup
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          Download a full backup of all your billing data (clients, invoices, payments, services) as a CSV file.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={handleBackup} disabled={backingUp}>
            {backingUp ? (
              <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />Preparing backup…</>
            ) : (
              <><span className="material-symbols-outlined">download</span>Download Full Backup (CSV)</>
            )}
          </button>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>All clients, invoices, payments, and services</span>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">
          <span className="material-symbols-outlined">info</span>
          System Information
        </div>
        <div className="info-grid">
          {[
            ['Application', 'S&T Tax and Advisory — Billing v1.0'],
            ['Database', 'Supabase (PostgreSQL)'],
            ['Invoice Numbering', 'ST-YYYY-### (auto-generated)'],
            ['Tech Stack', 'React 19 + Vite + Supabase'],
          ].map(([k, v]) => (
            <div className="info-item" key={k}>
              <span className="info-label">{k}</span>
              <span className="info-value">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
