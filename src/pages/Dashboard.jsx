import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  return <span className={`badge badge-${s}`}>{status}</span>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ activeClients: 0, billedMTD: 0, collectedMTD: 0, outstandingAR: 0 });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [overdueInvoices, setoverdueInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];

      const [clientsRes, invoicesRes, paymentsRes] = await Promise.all([
        supabase.from('clients').select('id, status'),
        supabase.from('invoices').select('id, client_id, invoice_number, issue_date, due_date, total, balance_due, status, clients(business_name)'),
        supabase.from('payments').select('id, invoice_id, amount, payment_date'),
      ]);

      const clients = clientsRes.data || [];
      const invoices = invoicesRes.data || [];
      const payments = paymentsRes.data || [];

      const activeClients = clients.filter(c => (c.status || '').toLowerCase() === 'active').length;

      const billedMTD = invoices
        .filter(inv => inv.issue_date && inv.issue_date >= startOfMonth)
        .reduce((sum, inv) => sum + (inv.total || 0), 0);

      const collectedMTD = payments
        .filter(p => p.payment_date && p.payment_date >= startOfMonth)
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      const paidByInvoice = {};
      payments.forEach(p => {
        paidByInvoice[p.invoice_id] = (paidByInvoice[p.invoice_id] || 0) + p.amount;
      });

      const outstandingAR = invoices
        .filter(inv => ['Unpaid', 'Partial'].includes(inv.status))
        .reduce((sum, inv) => sum + (inv.balance_due || 0), 0);

      const sorted = [...invoices].sort((a, b) => (b.issue_date || '').localeCompare(a.issue_date || ''));
      setRecentInvoices(sorted.slice(0, 8).map(inv => ({
        ...inv,
        balance: inv.balance_due || 0,
        clientName: inv.clients?.business_name || '—',
      })));

      const overdue = invoices
        .filter(inv => inv.due_date && inv.due_date < today && !['Paid', 'paid'].includes(inv.status) && (inv.balance_due || 0) > 0)
        .map(inv => ({
          ...inv,
          balance: inv.balance_due || 0,
          daysOverdue: Math.floor((new Date(today) - new Date(inv.due_date)) / 86400000),
          clientName: inv.clients?.business_name || '—',
        }))
        .sort((a, b) => b.daysOverdue - a.daysOverdue);
      setoverdueInvoices(overdue);

      setStats({ activeClients, billedMTD, collectedMTD, outstandingAR });
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="page-wrapper">
      <div className="loading-state"><div className="spinner" /><span className="loading-text">Loading dashboard…</span></div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h2>Dashboard</h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-content">
            <div className="stat-card-label">Active Clients</div>
            <div className="stat-card-value">{stats.activeClients}</div>
            <div className="stat-card-sub">Currently active</div>
          </div>
          <div className="stat-card-icon blue"><span className="material-symbols-outlined">people</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-card-content">
            <div className="stat-card-label">Billed MTD</div>
            <div className="stat-card-value">{fmt(stats.billedMTD)}</div>
            <div className="stat-card-sub">This month</div>
          </div>
          <div className="stat-card-icon yellow"><span className="material-symbols-outlined">receipt_long</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-card-content">
            <div className="stat-card-label">Collected MTD</div>
            <div className="stat-card-value">{fmt(stats.collectedMTD)}</div>
            <div className="stat-card-sub">This month</div>
          </div>
          <div className="stat-card-icon green"><span className="material-symbols-outlined">payments</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-card-content">
            <div className="stat-card-label">Outstanding AR</div>
            <div className="stat-card-value">{fmt(stats.outstandingAR)}</div>
            <div className="stat-card-sub">Across all invoices</div>
          </div>
          <div className="stat-card-icon red"><span className="material-symbols-outlined">account_balance_wallet</span></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="table-container">
          <div className="table-header">
            <h3>Recent Invoices</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/invoices')}>
              View all <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th className="text-right">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 16px' }}>No invoices yet</td></tr>
                ) : recentInvoices.map(inv => (
                  <tr key={inv.id} className="clickable" onClick={() => navigate('/invoices')}>
                    <td className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>{inv.invoice_number}</td>
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>{inv.clientName}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{fmtDate(inv.issue_date)}</td>
                    <td className="text-right" style={{ fontWeight: 600 }}>{fmt(inv.total)}</td>
                    <td><StatusBadge status={inv.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="table-container">
          <div className="table-header">
            <h3 style={{ color: 'var(--danger)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 6 }}>warning</span>
              Overdue Invoices
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/ar-aging')}>
              AR Aging <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Invoice</th>
                  <th>Days</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {overdueInvoices.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--success)', padding: '32px 16px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 24, display: 'block', marginBottom: 6 }}>check_circle</span>
                    No overdue invoices
                  </td></tr>
                ) : overdueInvoices.map(inv => (
                  <tr key={inv.id} className="clickable row-overdue" onClick={() => navigate('/ar-aging')}>
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>{inv.clientName}</td>
                    <td className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>{inv.invoice_number}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{inv.daysOverdue}d</td>
                    <td className="text-right" style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmt(inv.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
