import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
const CATEGORIES = ['Tax Preparation', 'Bookkeeping', 'Advisory', 'Payroll', 'Compliance', 'Other'];
const FREQUENCIES = ['Monthly', 'Quarterly', 'Annual', 'One-time', 'Hourly'];

const emptyForm = { name: '', description: '', category: '', default_price: '', frequency: '', active: true };

function Modal({ isOpen, title, onClose, children, footer }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
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

export default function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, mode: 'add', data: null });
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from('services').select('*').order('name');
    setServices(data || []);
    setLoading(false);
  };

  const openAdd = () => {
    setForm(emptyForm);
    setModal({ open: true, mode: 'add', data: null });
  };

  const openEdit = (svc) => {
    setForm({ ...svc, default_price: svc.default_price ?? '' });
    setModal({ open: true, mode: 'edit', data: svc });
  };

  const closeModal = () => setModal({ open: false, mode: 'add', data: null });

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name, description: form.description || null,
      category: form.category || null, default_price: parseFloat(form.default_price) || null,
      frequency: form.frequency || null, active: form.active,
    };
    if (modal.mode === 'add') {
      await supabase.from('services').insert(payload);
    } else {
      await supabase.from('services').update(payload).eq('id', modal.data.id);
    }
    setSaving(false);
    closeModal();
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this service? It will be removed from the catalog.')) return;
    await supabase.from('services').delete().eq('id', id);
    load();
  };

  const toggleActive = async (svc) => {
    await supabase.from('services').update({ active: !svc.active }).eq('id', svc.id);
    load();
  };

  const filtered = services.filter(s => {
    const q = search.toLowerCase();
    return (!q || s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q)) &&
      (catFilter === 'all' || s.category === catFilter);
  });

  if (loading) return (
    <div className="page-wrapper">
      <div className="loading-state"><div className="spinner" /><span className="loading-text">Loading services…</span></div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h2>Service Catalog</h2>
        <button className="btn btn-primary" onClick={openAdd}>
          <span className="material-symbols-outlined">add</span>
          Add Service
        </button>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="search-filter-bar" style={{ flex: 1 }}>
            <div className="search-wrapper">
              <span className="material-symbols-outlined">search</span>
              <input className="search-input" placeholder="Search services…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Service Name</th>
                <th>Category</th>
                <th>Description</th>
                <th className="text-right">Default Price</th>
                <th>Frequency</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><span className="material-symbols-outlined">inventory_2</span><p>No services found</p></div></td></tr>
              ) : filtered.map(svc => (
                <tr key={svc.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{svc.name}</td>
                  <td><span className="badge badge-draft">{svc.category || '—'}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: 240 }}>{svc.description || '—'}</td>
                  <td className="text-right" style={{ fontWeight: 600 }}>{svc.default_price ? fmt(svc.default_price) : '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{svc.frequency || '—'}</td>
                  <td>
                    <span className={`badge badge-${svc.active ? 'active' : 'inactive'}`}>
                      {svc.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn-icon" title="Edit" onClick={() => openEdit(svc)}>
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button className="btn-icon" title={svc.active ? 'Deactivate' : 'Activate'} onClick={() => toggleActive(svc)}>
                        <span className="material-symbols-outlined">{svc.active ? 'visibility_off' : 'visibility'}</span>
                      </button>
                      <button className="btn-icon danger" title="Delete" onClick={() => handleDelete(svc.id)}>
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

      <Modal
        isOpen={modal.open}
        title={modal.mode === 'add' ? 'Add Service' : 'Edit Service'}
        onClose={closeModal}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Service'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-group form-col-span-2">
              <label className="form-label">Service Name <span className="required">*</span></label>
              <input className="form-input" value={form.name} onChange={e => setF('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={e => setF('category', e.target.value)}>
                <option value="">Select…</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Frequency</label>
              <select className="form-select" value={form.frequency} onChange={e => setF('frequency', e.target.value)}>
                <option value="">Select…</option>
                {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Default Price ($)</label>
              <input type="number" step="0.01" min="0" className="form-input" value={form.default_price} onChange={e => setF('default_price', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={form.active} onChange={e => setF('active', e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                Active in catalog
              </label>
            </div>
            <div className="form-group form-col-span-2">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" rows={3} value={form.description} onChange={e => setF('description', e.target.value)} placeholder="Brief description of this service…" />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
