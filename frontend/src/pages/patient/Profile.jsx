import { useState, useEffect } from 'react';
import { useFetch, useAsync } from '@/hooks';
import { patientService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { User, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PatientProfile() {
  const { user }                   = useAuth();
  const { data, loading, refetch } = useFetch(patientService.getProfile);
  const { run, loading: saving }   = useAsync(patientService.updateProfile);

  const [form, setForm] = useState({
    fullName: '', phone: '', bloodType: '', height: '', weight: '',
    emergencyName: '', emergencyPhone: '',
  });

  useEffect(() => {
    if (data) setForm({
      fullName:      data.fullName      || '',
      phone:         data.phone         || '',
      bloodType:     data.bloodType     || '',
      height:        data.height        || '',
      weight:        data.weight        || '',
      emergencyName: data.emergencyName || '',
      emergencyPhone:data.emergencyPhone|| '',
    });
  }, [data]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    try {
      await run({ ...form, height: Number(form.height) || undefined, weight: Number(form.weight) || undefined });
      toast.success('Perfil atualizado!');
      refetch();
    } catch { toast.error('Erro ao salvar'); }
  };

  if (loading) return <div className="text-surface-400 text-sm text-center py-8">Carregando…</div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-lg">
      <div>
        <h1 className="font-display text-2xl font-bold">Perfil</h1>
        <p className="text-surface-500 text-sm mt-0.5">Suas informações pessoais</p>
      </div>

      {/* Avatar */}
      <div className="glass p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600 text-xl font-bold shrink-0">
          {form.fullName?.[0]?.toUpperCase() || <User size={22} />}
        </div>
        <div>
          <p className="font-medium text-surface-800">{form.fullName}</p>
          <p className="text-xs text-surface-500">{user?.email}</p>
        </div>
      </div>

      <form onSubmit={submit} className="glass p-5 space-y-4">
        <h3 className="font-display font-semibold text-sm text-surface-500 uppercase tracking-wider">Dados Pessoais</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Nome completo</label>
            <input className="input" value={form.fullName} onChange={set('fullName')} />
          </div>
          <div>
            <label className="label">Telefone</label>
            <input className="input" value={form.phone} onChange={set('phone')} placeholder="11 9xxxx-xxxx" />
          </div>
          <div>
            <label className="label">Tipo sanguíneo</label>
            <select className="input" value={form.bloodType} onChange={set('bloodType')}>
              <option value="">—</option>
              {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Altura (cm)</label>
            <input className="input" type="number" value={form.height} onChange={set('height')} placeholder="170" />
          </div>
          <div>
            <label className="label">Peso (kg)</label>
            <input className="input" type="number" step="0.1" value={form.weight} onChange={set('weight')} placeholder="70" />
          </div>
        </div>

        <h3 className="font-display font-semibold text-sm text-surface-500 uppercase tracking-wider pt-2">Contato de Emergência</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={form.emergencyName} onChange={set('emergencyName')} />
          </div>
          <div>
            <label className="label">Telefone</label>
            <input className="input" value={form.emergencyPhone} onChange={set('emergencyPhone')} />
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
          <Save size={14} /> {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </form>
    </div>
  );
}
