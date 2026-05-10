import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

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

export default function ARAging() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const current = items.filter(r => r.daysOld <= 15);
  const warning = items.filter(r => r.daysOld > 15 && r.daysOld <= 30);
  const overdue = items.filter(r => r.daysOld > 30);

  const sumBalance = (arr) => arr.reduce((s, r) => s + r.balance, 0);

  if (loading) return (
    <div className="page-wrapper">
      <div className="loading-state"><div className="spinner" /><span className="loading-text">Loading AR aging…</span></div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h2>AR Aging Report</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>As of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
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
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <span className="material-symbols-outlined" style={{ color: 'var(--success)' }}>check_circle</span>
                      <p style={{ color: 'var(--success)' }}>All invoices are current — no outstanding AR</p>
                    </div>
                  </td>
                </tr>
              ) : items.map(row => (
                <tr
                  key={row.id}
                  className={`clickable ${rowClass(row.daysOld)}`}
                  onClick={() => navigate(`/clients/${row.client_id}`)}
                >
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{row.clientName}</td>
                  <td className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>{row.invoice_number}</td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{fmtDate(row.issue_date)}</td>
                  <td style={{ fontSize: '0.82rem', color: row.daysOld > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{fmtDate(row.due_date)}</td>
                  <td className="text-right" style={{ color: 'var(--text-secondary)' }}>{fmt(row.total)}</td>
                  <td className="text-right" style={{ color: 'var(--success)' }}>{fmt(row.paid)}</td>
                  <td className="text-right" style={{ fontWeight: 700, color: row.daysOld > 30 ? 'var(--danger)' : 'var(--text)' }}>{fmt(row.balance)}</td>
                  <td style={{ fontWeight: 600, color: row.daysOld > 30 ? 'var(--danger)' : row.daysOld > 15 ? 'var(--warning)' : 'var(--success)' }}>
                    {row.daysOld > 0 ? `${row.daysOld}d overdue` : row.daysOld === 0 ? 'Due today' : `${Math.abs(row.daysOld)}d remaining`}
                  </td>
                  <td><AgingBucket days={row.daysOld} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
