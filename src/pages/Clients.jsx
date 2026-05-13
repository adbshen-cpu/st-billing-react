import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

function StatusBadge({ status }) {
  const s = (status || 'inactive').toLowerCase();
  return <span className={`badge badge-${s}`}>{status || 'inactive'}</span>;
}

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => { loadClients(); }, []);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('business_name');
      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (c.business_name || '').toLowerCase().includes(q) ||
      (c.primary_email || '').toLowerCase().includes(q) ||
      (c.primary_phone || '').includes(q);
    const matchStatus = statusFilter === 'all' || (c.status || '').toLowerCase() === statusFilter.toLowerCase();
    const matchType = typeFilter === 'all' || c.entity_type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const types = [...new Set(clients.map(c => c.entity_type).filter(Boolean))];

  if (loading) return (
    <div className="page-wrapper">
      <div className="loading-state"><div className="spinner" /><span className="loading-text">Loading clients…</span></div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h2>Clients</h2>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => navigate('/clients/new')}>
            <span className="material-symbols-outlined">person_add</span>
            New Client
          </button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="search-filter-bar" style={{ flex: 1 }}>
            <div className="search-wrapper">
              <span className="material-symbols-outlined">search</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search clients…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {filtered.length} of {clients.length}
          </span>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Type</th>
                <th>Email</th>
                <th>Phone</th>
                <th>City / State</th>
                <th>Status</th>
                <th>Since</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <span className="material-symbols-outlined">person_search</span>
                      <p>{search ? 'No clients match your search' : 'No clients yet — add your first client!'}</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(client => (
                <tr
                  key={client.id}
                  className="clickable"
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{client.business_name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{client.entity_type || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{client.primary_email || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{client.primary_phone || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    {client.business_address || '—'}
                  </td>
                  <td><StatusBadge status={client.status} /></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{fmtDate(client.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
