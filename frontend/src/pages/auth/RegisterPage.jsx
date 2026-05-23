import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Heart, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';

export default function RegisterPage() {
  const { login }      = useAuth();
  const navigate       = useNavigate();
  const [step, setStep] = useState(1); // 1: role, 2: form
  const [role, setRole] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: '', password: '', fullName: '',
    // patient extras
    cpf: '', dateOfBirth: '',
    // doctor extras
    crm: '', specialty: '',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        email:    form.email,
        password: form.password,
        role,
        fullName: form.fullName,
        ...(role === 'PATIENT' && {
          cpf:         form.cpf,
          dateOfBirth: form.dateOfBirth,
          gender:      'OTHER',
        }),
        ...(role === 'DOCTOR' && {
          crm:       form.crm,
          specialty: form.specialty,
        }),
      };
      await api.post('/auth/register', payload);
      await login(form.email, form.password);
      navigate(role === 'DOCTOR' ? '/doctor' : '/patient', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-brand-50 blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-50 mb-4">
            <Heart size={22} className="text-brand-600" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Health<span className="text-brand-600">InPulse</span>
          </h1>
        </div>

        <div className="glass p-6">
          {step === 1 ? (
            <>
              <h2 className="font-display text-lg font-semibold mb-1">Criar conta</h2>
              <p className="text-surface-500 text-sm mb-5">Você é…</p>
              <div className="space-y-3">
                {[
                  { value: 'PATIENT', label: 'Paciente', desc: 'Monitore sua saúde' },
                  { value: 'DOCTOR',  label: 'Médico',   desc: 'Acompanhe seus pacientes' },
                ].map(({ value, label, desc }) => (
                  <button
                    key={value}
                    onClick={() => { setRole(value); setStep(2); }}
                    className="w-full glass p-4 text-left hover:border-brand-300 transition-all group"
                  >
                    <p className="font-medium text-surface-800 group-hover:text-brand-600 transition-colors">{label}</p>
                    <p className="text-xs text-surface-500">{desc}</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-5">
                <button onClick={() => setStep(1)} className="btn-ghost p-1 text-surface-500">←</button>
                <h2 className="font-display text-lg font-semibold">
                  Cadastro — {role === 'DOCTOR' ? 'Médico' : 'Paciente'}
                </h2>
              </div>
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <label className="label">Nome completo</label>
                  <input className="input" value={form.fullName} onChange={set('fullName')} placeholder="Seu nome" required />
                </div>
                <div>
                  <label className="label">E-mail</label>
                  <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="seu@email.com" required />
                </div>
                <div>
                  <label className="label">Senha</label>
                  <div className="relative">
                    <input className="input pr-10" type={show ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="Mínimo 8 caracteres" required />
                    <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-500">
                      {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {role === 'PATIENT' && <>
                  <div>
                    <label className="label">CPF</label>
                    <input className="input" value={form.cpf} onChange={set('cpf')} placeholder="000.000.000-00" required />
                  </div>
                  <div>
                    <label className="label">Data de nascimento</label>
                    <input className="input" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} required />
                  </div>
                </>}

                {role === 'DOCTOR' && <>
                  <div>
                    <label className="label">CRM</label>
                    <input className="input" value={form.crm} onChange={set('crm')} placeholder="CRM-SP 000000" required />
                  </div>
                  <div>
                    <label className="label">Especialidade</label>
                    <input className="input" value={form.specialty} onChange={set('specialty')} placeholder="Ex: Clínica Geral" required />
                  </div>
                </>}

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-1">
                  {loading ? 'Cadastrando…' : 'Criar conta'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-surface-400 text-sm mt-4">
          Já tem conta?{' '}
          <Link to="/login" className="text-brand-600 hover:text-brand-700">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
