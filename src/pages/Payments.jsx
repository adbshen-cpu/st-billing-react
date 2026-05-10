import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const METHODS = ['Check', 'ACH / Bank Transfer', 'Credit Card', 'Zelle', 'Cash'];

export default function Payments() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*, invoices(invoice_number, client_id, clients(business_name))')
        .order('payment_date', { ascending: false });
      if (error) throw error;
      setPayments(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this payment record?')) return;
    await supabase.from('payments').delete().eq('id', id);
    load();
  };

  const filtered = payments.filter(p => {
    const q = search.toLowerCase();
    const clientName = p.invoices?.clients?.name || '';
    const invNum = p.invoices?.invoice_number || '';
    const matchSearch = !q || clientName.toLowerCase().includes(q) || invNum.toLowerCase().includes(q) || (p.reference || '').toLowerCase().includes(q);
    const matchMethod = methodFilter === 'all' || p.method === methodFilter;
    const matchFrom = !dateFrom || p.payment_date >= dateFrom;
    const matchTo = !dateTo || p.payment_date <= dateTo;
    return matchSearch && matchMethod && matchFrom && matchTo;
  });

  const totalFiltered = filtered.reduce((s, p) => s + (p.amount || 0), 0);

  if (loading) return (
    <div className="page-wrapper">
      <div className="loading-state"><div className="spinner" /><span className="loading-text">Loading payments…</span></div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h2>Payments</h2>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Showing: <strong style={{ color: 'var(--text)' }}>{fmt(totalFiltered)}</strong> across {filtered.length} records
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="search-filter-bar" style={{ flex: 1, flexWrap: 'wrap' }}>
            <div className="search-wrapper">
              <span className="material-symbols-outlined">search</span>
              <input className="search-input" placeholder="Search client, invoice, reference…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
              <option value="all">All Methods</option>
              {METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
            <input type="date" className="filter-select" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
            <input type="date" className="filter-select" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" />
            {(dateFrom || dateTo || methodFilter !== 'all' || search) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setMethodFilter('all'); setDateFrom(''); setDateTo(''); }}>
                <span className="material-symbols-outlined">clear</span>
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Invoice #</th>
                <th className="text-right">Amount</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Notes</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state"><span className="material-symbols-outlined">payments</span><p>No payments found</p></div></td></tr>
              ) : filtered.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500, color: 'var(--text)' }}>{fmtDate(p.payment_date)}</td>
                  <td
                    style={{ fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}
                    onClick={() => p.invoices?.client_id && navigate(`/clients/${p.invoices.client_id}`)}
                  >
                    {p.invoices?.clients?.business_name || '—'}
                  </td>
                  <td className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.invoices?.invoice_number || '—'}</td>
                  <td className="text-right" style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(p.amount)}</td>
                  <td><span className="badge badge-draft">{p.method || '—'}</span></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.reference || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', maxWidth: 180 }}>{p.notes || ''}</td>
                  <td>
                    <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn-icon danger" title="Delete" onClick={() => handleDelete(p.id)}>
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ fontWeight: 700, color: 'var(--text)' }}>Total</td>
                  <td className="text-right" style={{ fontWeight: 700, color: 'var(--success)', fontSize: '1rem' }}>{fmt(totalFiltered)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
