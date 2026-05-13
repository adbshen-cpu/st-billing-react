import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AuthGuard() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="loading-state" style={{ minHeight: '100vh' }}>
      <div className="spinner" />
      <span className="loading-text">Loading…</span>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
