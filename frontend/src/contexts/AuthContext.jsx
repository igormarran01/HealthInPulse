import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService, coinService } from '@/services';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setLoading(false); return; }

    authService.me()
      .then(({ data }) => setUser(data.user))
      .catch(() => localStorage.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await authService.login({ email, password });
    localStorage.setItem('accessToken',  data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await authService.logout(); } catch (_) {}
    localStorage.clear();
    setUser(null);
  }, []);

  // Atualiza só o saldo de coins (pra refletir após resgate ou conclusão de meta)
  const refreshCoins = useCallback(async () => {
    if (!user || user.role !== 'PATIENT') return;
    try {
      const { data } = await coinService.balance();
      setUser((u) => (u ? { ...u, healthCoins: data.balance } : u));
    } catch (_) {}
  }, [user]);

  const isPatient = user?.role === 'PATIENT';
  const isDoctor  = user?.role === 'DOCTOR';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshCoins, isPatient, isDoctor }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};
