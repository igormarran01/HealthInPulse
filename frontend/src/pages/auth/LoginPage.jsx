import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Heart, Activity, Sparkles, Stethoscope } from 'lucide-react';
import toast from 'react-hot-toast';

const DEMO_USERS = [
  {
    id: 'joao',
    label: 'João Mendes',
    sub:   'paciente · caso grave',
    icon:  Activity,
    email: 'joao@healthinpulse.dev',
    pass:  'Joao@123',
  },
  {
    id: 'marina',
    label: 'Marina Lima',
    sub:   'paciente · preventivo',
    icon:  Sparkles,
    email: 'marina@healthinpulse.dev',
    pass:  'Marina@123',
  },
  {
    id: 'ana',
    label: 'Dra. Ana Beatriz',
    sub:   'médica',
    icon:  Stethoscope,
    email: 'doctor@healthinpulse.dev',
    pass:  'Doctor@123',
  },
];

export default function LoginPage() {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  const from       = location.state?.from?.pathname || null;

  const [form, setForm]     = useState({
    email:    DEMO_USERS[0].email,
    password: DEMO_USERS[0].pass,
  });
  const [show, setShow]     = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const doLogin = async (email, password) => {
    if (!email || !password) return toast.error('Preencha todos os campos');
    setLoading(true);
    try {
      const user = await login(email, password);
      const dest = from || (user.role === 'DOCTOR' ? '/doctor' : '/patient');
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  };

  const submit = (e) => { e.preventDefault(); doLogin(form.email, form.password); };

  const loginAs = (u) => {
    setForm({ email: u.email, password: u.pass });
    doLogin(u.email, u.pass);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-brand-50 blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-50 mb-4">
            <Heart size={22} className="text-brand-700" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Health<span className="text-brand-700">InPulse</span>
          </h1>
          <p className="text-surface-500 text-sm mt-1">Saúde digital · Care Plus</p>
        </div>

        {/* Card */}
        <div className="glass p-6">
          <h2 className="font-display text-lg font-semibold mb-5">Entrar</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">E-mail</label>
              <input
                type="email" value={form.email} onChange={set('email')}
                className="input" placeholder="seu@email.com"
                autoComplete="email" autoFocus
              />
            </div>
            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'} value={form.password} onChange={set('password')}
                  className="input pr-10" placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button" onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-500"
                >
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-1">
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          {/* Demo selector — clique entra direto */}
          <div className="mt-6 pt-5 border-t border-surface-200">
            <p className="text-[10px] uppercase tracking-widest text-surface-400 font-semibold mb-3">
              Demo · clique para entrar
            </p>
            <div className="grid gap-2">
              {DEMO_USERS.map((u) => (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => loginAs(u)}
                  disabled={loading}
                  className="w-full text-left p-3 rounded-xl border border-surface-200 hover:border-brand-300 hover:bg-brand-50/40 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-surface-100 text-surface-500 group-hover:bg-brand-100 group-hover:text-brand-700 transition-colors">
                    <u.icon size={16} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-surface-800">{u.label}</span>
                    <span className="block text-[11px] text-surface-500">{u.sub}</span>
                  </span>
                  <span className="text-surface-300 group-hover:text-brand-600 transition-colors">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-surface-400 text-sm mt-4">
          Não tem conta?{' '}
          <Link to="/register" className="text-brand-700 hover:text-brand-800">Cadastre-se</Link>
        </p>
      </div>
    </div>
  );
}
