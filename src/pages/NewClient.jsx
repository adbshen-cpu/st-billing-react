import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const initialForm = {
  business_name: '', entity_type: '', status: 'Active', engagement_type: '',
  primary_email: '', primary_phone: '', business_address: '',
  preferred_payment_method: '', retainer_balance: '',
  notes: '',
};

const initialOwner = { name: '', email: '', phone: '', ssn: '', ownership_percent: '' };

export default function NewClient() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [owners, setOwners] = useState([{ ...initialOwner }]);
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('services').select('*').eq('active', true).order('name')
      .then(({ data }) => setServices(data || []));
  }, []);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const updateOwner = (i, field, value) => {
    setOwners(prev => prev.map((o, idx) => idx === i ? { ...o, [field]: value } : o));
  };
  const addOwner = () => setOwners(prev => [...prev, { ...initialOwner }]);
  const removeOwner = (i) => setOwners(prev => prev.filter((_, idx) => idx !== i));

  const toggleService = (id) => {
    setSelectedServices(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.business_name.trim()) { setError('Business name is required'); return; }
    setSaving(true);
    setError('');

    try {
      const { data: lastClient } = await supabase
        .from('clients')
        .select('client_number')
        .order('client_number', { ascending: false })
        .limit(1);
      const lastNum = parseInt(lastClient?.[0]?.client_number?.replace('C-', '') || '0');
      const clientNumber = `C-${String(lastNum + 1).padStart(4, '0')}`;

      const { data: clientData, error: clientErr } = await supabase
        .from('clients')
        .insert({
          client_number: clientNumber,
          business_name: form.business_name, entity_type: form.entity_type || null,
          status: form.status, engagement_type: form.engagement_type || null,
          primary_email: form.primary_email || null, primary_phone: form.primary_phone || null,
          business_address: form.business_address || null,
          preferred_payment_method: form.preferred_payment_method || null,
          retainer_balance: parseFloat(form.retainer_balance) || 0,
          notes: form.notes || null,
        })
        .select()
        .single();
      if (clientErr) throw clientErr;

      const clientId = clientData.id;

      const validOwners = owners.filter(o => o.name.trim());
      if (validOwners.length > 0) {
        await supabase.from('client_owners').insert(
          validOwners.map(o => ({ client_id: clientId, ...o, ownership_percent: parseFloat(o.ownership_percent) || 0 }))
        );
      }

      if (selectedServices.length > 0) {
        await supabase.from('client_services').insert(
          selectedServices.map(sid => ({ client_id: clientId, service_id: sid }))
        );
      }

      await supabase.from('activity_log').insert({
        client_id: clientId, user_id: user?.id,
        action: 'Client Created', details: `New client "${form.business_name}" added`,
      });

      navigate(`/clients/${clientId}`);
    } catch (err) {
      setError(err.message || 'Failed to create client');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/clients')}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2>New Client Intake</h2>
        </div>
      </div>

      {error && (
        <div className="login-error mb-16">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="settings-section">
          <div className="form-section-title">
            <span className="material-symbols-outlined">business</span>
            Business Information
          </div>
          <div className="form-grid">
            <div className="form-group form-col-span-2">
              <label className="form-label">Business Name <span className="required">*</span></label>
              <input className="form-input" value={form.business_name} onChange={e => set('business_name', e.target.value)} placeholder="ABC Company LLC" required />
            </div>
            <div className="form-group">
              <label className="form-label">Entity Type</label>
              <select className="form-select" value={form.entity_type} onChange={e => set('entity_type', e.target.value)}>
                <option value="">Select type…</option>
                <option>LLC</option>
                <option>S-Corporation</option>
                <option>C-Corporation</option>
                <option>Partnership</option>
                <option>Sole Proprietorship</option>
                <option>Non-Profit</option>
                <option>Trust</option>
                <option>Individual</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Engagement Type</label>
              <input className="form-input" value={form.engagement_type} onChange={e => set('engagement_type', e.target.value)} placeholder="e.g. Bookkeeping, Tax Prep…" />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="form-section-title">
            <span className="material-symbols-outlined">contact_phone</span>
            Contact Information
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Primary Email</label>
              <input type="email" className="form-input" value={form.primary_email} onChange={e => set('primary_email', e.target.value)} placeholder="contact@business.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Primary Phone</label>
              <input className="form-input" value={form.primary_phone} onChange={e => set('primary_phone', e.target.value)} placeholder="(555) 555-5555" />
            </div>
            <div className="form-group form-col-span-2">
              <label className="form-label">Business Address</label>
              <input className="form-input" value={form.business_address} onChange={e => set('business_address', e.target.value)} placeholder="123 Main St, Suite 100, City, State ZIP" />
            </div>
            <div className="form-group">
              <label className="form-label">Preferred Payment Method</label>
              <input className="form-input" value={form.preferred_payment_method} onChange={e => set('preferred_payment_method', e.target.value)} placeholder="e.g. ACH, Check…" />
            </div>
            <div className="form-group">
              <label className="form-label">Retainer Balance</label>
              <input type="number" step="0.01" className="form-input" value={form.retainer_balance} onChange={e => set('retainer_balance', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group form-col-span-2">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes…" />
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="form-section-title">
            <span className="material-symbols-outlined">supervisor_account</span>
            Principal Owner(s)
          </div>
          {owners.map((owner, i) => (
            <div key={i} className="owner-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 80px 80px 40px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                {i === 0 && <label className="form-label">Full Name</label>}
                <input className="form-input" value={owner.name} onChange={e => updateOwner(i, 'name', e.target.value)} placeholder="Jane Doe" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                {i === 0 && <label className="form-label">Email</label>}
                <input type="email" className="form-input" value={owner.email} onChange={e => updateOwner(i, 'email', e.target.value)} placeholder="jane@email.com" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                {i === 0 && <label className="form-label">Phone</label>}
                <input className="form-input" value={owner.phone} onChange={e => updateOwner(i, 'phone', e.target.value)} placeholder="(555) 555-5555" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                {i === 0 && <label className="form-label">SSN</label>}
                <input className="form-input" value={owner.ssn} onChange={e => updateOwner(i, 'ssn', e.target.value)} placeholder="XXX-XX-XXXX" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                {i === 0 && <label className="form-label">Own %</label>}
                <input type="number" className="form-input" value={owner.ownership_percent} onChange={e => updateOwner(i, 'ownership_percent', e.target.value)} placeholder="100" min="0" max="100" />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                {owners.length > 1 && (
                  <button type="button" className="btn-icon danger" onClick={() => removeOwner(i)}>
                    <span className="material-symbols-outlined">remove_circle</span>
                  </button>
                )}
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={addOwner} style={{ marginTop: 8 }}>
            <span className="material-symbols-outlined">add</span>
            Add Owner
          </button>
        </div>

        <div className="settings-section">
          <div className="form-section-title">
            <span className="material-symbols-outlined">account_balance</span>
            Payment Method
          </div>
          <div className="form-grid">
            <div className="form-group form-col-span-2">
              <label className="form-label">Preferred Payment Method</label>
              <select className="form-select" value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
                <option value="">Select method…</option>
                <option>Check</option>
                <option>ACH / Bank Transfer</option>
                <option>Credit Card</option>
                <option>Zelle</option>
                <option>Cash</option>
              </select>
            </div>
            {form.payment_method === 'ACH / Bank Transfer' && (
              <>
                <div className="form-group">
                  <label className="form-label">Bank Name</label>
                  <input className="form-input" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Routing Number</label>
                  <input className="form-input" value={form.routing_number} onChange={e => set('routing_number', e.target.value)} />
                </div>
                <div className="form-group form-col-span-2">
                  <label className="form-label">Account Number</label>
                  <input className="form-input" value={form.account_number} onChange={e => set('account_number', e.target.value)} />
                </div>
              </>
            )}
          </div>
        </div>

        {services.length > 0 && (
          <div className="settings-section">
            <div className="form-section-title">
              <span className="material-symbols-outlined">inventory_2</span>
              Services
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {services.map(svc => (
                <label key={svc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: selectedServices.includes(svc.id) ? 'var(--primary-xlight)' : '#f7f9fc', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: `1px solid ${selectedServices.includes(svc.id) ? 'var(--primary)' : 'var(--border)'}`, fontSize: '0.85rem', transition: 'all 0.15s' }}>
                  <input type="checkbox" checked={selectedServices.includes(svc.id)} onChange={() => toggleService(svc.id)} style={{ accentColor: 'var(--primary)' }} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{svc.name}</div>
                    {svc.default_price && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>${svc.default_price}/{svc.frequency || 'mo'}</div>}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="settings-section">
          <div className="form-section-title">
            <span className="material-symbols-outlined">notes</span>
            Internal Notes
          </div>
          <textarea className="form-textarea" rows={4} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes about this client…" style={{ width: '100%' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/clients')}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />Saving…</> : <><span className="material-symbols-outlined">check</span>Create Client</>}
          </button>
        </div>
      </form>
    </div>
  );
}
