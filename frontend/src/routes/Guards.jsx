import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// ─── Spinner de loading ───────────────────────────────────────
function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-brand-200 border-t-brand-500 animate-spin" />
    </div>
  );
}

// ─── Rota protegida (qualquer usuário autenticado) ────────────
export function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location          = useLocation();

  if (loading) return <Spinner />;
  if (!user)   return <Navigate to="/login" state={{ from: location }} replace />;

  return children;
}

// ─── Rota por role ────────────────────────────────────────────
export function RoleRoute({ role, children }) {
  const { user, loading } = useAuth();
  const location          = useLocation();

  if (loading) return <Spinner />;
  if (!user)   return <Navigate to="/login" state={{ from: location }} replace />;

  if (user.role !== role) {
    const fallback = user.role === 'DOCTOR' ? '/doctor' : '/patient';
    return <Navigate to={fallback} replace />;
  }

  return children;
}

// ─── Rota pública (redireciona se logado) ────────────────────
export function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <Spinner />;
  if (user) {
    const dest = user.role === 'DOCTOR' ? '/doctor' : '/patient';
    return <Navigate to={dest} replace />;
  }

  return children;
}
