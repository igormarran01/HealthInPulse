import { useState, useEffect } from 'react';
import { useFetch, useAsync } from '@/hooks';
import { doctorService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { Save, Stethoscope } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DoctorProfile() {
  const { user }                   = useAuth();
  const { data, loading, refetch } = useFetch(doctorService.getProfile);
  const { run, loading: saving }   = useAsync(doctorService.updateProfile);

  const [form, setForm] = useState({ fullName: '', specialty: '', phone: '', bio: '' });

  useEffect(() => {
    if (data) setForm({
      fullName:  data.fullName  || '',
      specialty: data.specialty || '',
      phone:     data.phone     || '',
      bio:       data.bio       || '',
    });
  }, [data]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    try {
      await run(form);
      toast.success('Perfil atualizado!');
      refetch();
    } catch { toast.error('Erro ao salvar'); }
  };

  if (loading) return <div className="text-surface-400 text-sm text-center py-8">Carregando…</div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-lg">
      <div>
        <h1 className="font-display text-2xl font-bold">Perfil</h1>
        <p className="text-surface-500 text-sm mt-0.5">Suas informações profissionais</p>
      </div>

      {/* Card de identidade */}
      <div className="glass p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600 text-xl font-bold shrink-0">
          {form.fullName?.[0]?.toUpperCase() || <Stethoscope size={22} />}
        </div>
        <div>
          <p className="font-medium text-surface-800">{form.fullName}</p>
          <p className="text-xs text-surface-500">{user?.email}</p>
          {data?.crm && <p className="text-xs text-brand-600/70 mt-0.5">{data.crm}</p>}
        </div>
      </div>

      <form onSubmit={submit} className="glass p-5 space-y-4">
        <h3 className="font-display font-semibold text-sm text-surface-500 uppercase tracking-wider">
          Dados Profissionais
        </h3>

        <div>
          <label className="label">Nome completo</label>
          <input className="input" value={form.fullName} onChange={set('fullName')} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Especialidade</label>
            <input className="input" value={form.specialty} onChange={set('specialty')} required />
          </div>
          <div>
            <label className="label">Telefone</label>
            <input className="input" value={form.phone} onChange={set('phone')} placeholder="11 9xxxx-xxxx" />
          </div>
        </div>

        <div>
          <label className="label">Bio / Apresentação</label>
          <textarea
            className="input h-24 resize-none"
            value={form.bio}
            onChange={set('bio')}
            placeholder="Descreva brevemente sua experiência e abordagem…"
          />
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
          <Save size={14} /> {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </form>
    </div>
  );
}
