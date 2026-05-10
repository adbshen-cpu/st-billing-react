import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/clients', icon: 'people', label: 'Clients' },
  { to: '/invoices', icon: 'receipt_long', label: 'Invoices' },
  { to: '/payments', icon: 'payments', label: 'Payments' },
  { to: '/ar-aging', icon: 'schedule', label: 'AR Aging' },
  { to: '/services', icon: 'inventory_2', label: 'Services' },
  { to: '/reports', icon: 'bar_chart', label: 'Reports' },
  { to: '/settings', icon: 'settings', label: 'Settings' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-title">
          <span>S&T</span> Tax & Advisory
        </div>
        <div className="sidebar-logo-sub">Billing System</div>
      </div>

      <nav style={{ paddingTop: 8 }}>
        <div className="nav-section-label">Main Menu</div>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user-email">{user?.email}</div>
        <button className="sidebar-logout" onClick={handleLogout}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
