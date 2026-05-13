import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => { load(); }, [year]);

  const load = async () => {
    setLoading(true);
    try {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const [{ data: invoiceData }, { data: paymentData }, { count: activeCount }, { data: newClientData }, { data: services }] = await Promise.all([
        supabase.from('invoices').select('total, issue_date, balance_due').gte('issue_date', yearStart).lte('issue_date', yearEnd),
        supabase.from('payments').select('amount, payment_date').gte('payment_date', yearStart).lte('payment_date', yearEnd),
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'Active'),
        supabase.from('clients').select('created_at').gte('created_at', yearStart).lte('created_at', yearEnd),
        supabase.from('client_services').select('id, service_id, custom_price, services(name, category, price)'),
      ]);

      const yearStr = String(year);
      const totalBilled = (invoiceData || []).reduce((s, i) => s + parseFloat(i.total || 0), 0);
      const totalCollected = (paymentData || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0);

      const monthly = MONTHS.map((month, idx) => {
        const mStr = `${yearStr}-${String(idx + 1).padStart(2, '0')}`;
        const billed = (invoiceData || []).filter(i => i.issue_date && i.issue_date.startsWith(mStr)).reduce((s, i) => s + parseFloat(i.total || 0), 0);
        const collected =
          (paymentData || []).filter(p => p.payment_date && p.payment_date.startsWith(mStr)).reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        return { month, billed, collected };
      });

      const catMap = {};
      (services || []).forEach(cs => {
        const cat = cs.services?.category || 'Other';
        catMap[cat] = (catMap[cat] || 0) + parseFloat(cs.custom_price ?? cs.services?.price ?? 0);
      });
      const categories = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

      const totalInvoices = (invoiceData || []).length;
      const avgInvoice = totalInvoices ? totalBilled / totalInvoices : 0;
      const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;
      const newClients = (newClientData || []).length;

      setData({ monthly, categories, ytdBilled: totalBilled, ytdCollected: totalCollected, newClients, activeClients: activeCount || 0, totalInvoices, avgInvoice, collectionRate });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) return (
    <div className="page-wrapper">
      <div className="loading-state"><div className="spinner" /><span className="loading-text">Loading reports…</span></div>
    </div>
  );

  const maxBar = Math.max(...data.monthly.flatMap(m => [m.billed, m.collected]), 1);
  const maxCat = Math.max(...data.categories.map(([, v]) => v), 1);
  const currentMonth = new Date().getMonth();

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h2>Reports & Analytics</h2>
        <div className="page-header-actions">
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Year:</label>
          <select className="filter-select" value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[
          { label: `${year} YTD Billed`, value: fmt(data.ytdBilled), icon: 'receipt_long', color: 'blue' },
          { label: `${year} YTD Collected`, value: fmt(data.ytdCollected), icon: 'payments', color: 'green' },
          { label: 'Collection Rate', value: `${data.collectionRate.toFixed(1)}%`, icon: 'trending_up', color: 'yellow' },
          { label: 'Active Clients', value: data.activeClients, icon: 'people', color: 'red' },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-card-content">
              <div className="stat-card-label">{s.label}</div>
              <div className="stat-card-value">{s.value}</div>
            </div>
            <div className={`stat-card-icon ${s.color}`}><span className="material-symbols-outlined">{s.icon}</span></div>
          </div>
        ))}
      </div>

      <div className="reports-grid">
        <div className="table-container" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <h3>Monthly Billed vs. Collected — {year}</h3>
            <div style={{ display: 'flex', gap: 16 }}>
              <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--primary)' }} />Billed</span>
              <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--yellow)' }} />Collected</span>
            </div>
          </div>
          <div className="chart-wrapper">
            <div className="bar-chart">
              {data.monthly.map((m, i) => (
                <div className="bar-group" key={m.month}>
                  <div className="bar-pair">
                    <div
                      className="bar bar-billed"
                      style={{ height: `${(m.billed / maxBar) * 180}px` }}
                      data-tip={`Billed: ${fmt(m.billed)}`}
                      title={`${m.month}: Billed ${fmt(m.billed)}`}
                    />
                    <div
                      className="bar bar-collected"
                      style={{ height: `${(m.collected / maxBar) * 180}px` }}
                      data-tip={`Collected: ${fmt(m.collected)}`}
                      title={`${m.month}: Collected ${fmt(m.collected)}`}
                    />
                  </div>
                  <div className="bar-label" style={{ color: i === currentMonth && year === new Date().getFullYear() ? 'var(--primary)' : undefined, fontWeight: i === currentMonth && year === new Date().getFullYear() ? 700 : undefined }}>
                    {m.month}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="table-container">
          <div className="card-header"><h3>Revenue by Category</h3></div>
          <div className="card-body">
            {data.categories.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <span className="material-symbols-outlined">bar_chart</span>
                <p>No service data</p>
              </div>
            ) : data.categories.map(([cat, val]) => (
              <div className="category-bar" key={cat}>
                <div className="category-bar-name">{cat}</div>
                <div className="category-bar-bg">
                  <div className="category-bar-fill" style={{ width: `${(val / maxCat) * 100}%` }} />
                </div>
                <div className="category-bar-value">{fmt(val)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="table-container">
          <div className="card-header"><h3>{year} Year-to-Date Summary</h3></div>
          <div className="card-body">
            {[
              { label: 'Total Invoiced', value: fmt(data.ytdBilled) },
              { label: 'Total Collected', value: fmt(data.ytdCollected) },
              { label: 'Outstanding Balance', value: fmt(data.ytdBilled - data.ytdCollected) },
              { label: 'Collection Rate', value: `${data.collectionRate.toFixed(1)}%` },
              { label: 'Total Invoices', value: data.totalInvoices },
              { label: 'Avg Invoice Value', value: fmt(data.avgInvoice) },
              { label: 'New Clients This Year', value: data.newClients },
              { label: 'Active Clients', value: data.activeClients },
            ].map(row => (
              <div className="ytd-stat-row" key={row.label}>
                <div className="ytd-stat-label">{row.label}</div>
                <div className="ytd-stat-value">{row.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
