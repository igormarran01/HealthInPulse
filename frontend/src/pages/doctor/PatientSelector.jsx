import { useEffect } from 'react';
import { useFetch, useLocalStorage } from '@/hooks';
import { doctorService } from '@/services';
import { User } from 'lucide-react';

// Dropdown reutilizado nas abas Wearable / Relatório / Histórico.
// Persiste a seleção em localStorage para manter entre abas.
export default function PatientSelector({ value, onChange }) {
  const { data, loading } = useFetch(() => doctorService.getPatients({ limit: 200 }));
  const patients = data?.patients || [];
  const [stored, setStored] = useLocalStorage('doctor:selectedPatientId', null);

  // Restaura seleção persistida, ou pega o primeiro da lista
  useEffect(() => {
    if (value) return;
    if (stored && patients.some((p) => p.id === stored)) onChange(stored);
    else if (patients.length > 0) {
      onChange(patients[0].id);
      setStored(patients[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients.length]);

  const handle = (id) => {
    onChange(id);
    setStored(id);
  };

  return (
    <div className="glass p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-700 shrink-0">
        <User size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-surface-400 font-semibold">Paciente</p>
        <select
          value={value || ''}
          onChange={(e) => handle(e.target.value)}
          disabled={loading || patients.length === 0}
          className="mt-0.5 w-full bg-transparent font-display text-lg font-semibold text-surface-900 focus:outline-none"
        >
          {patients.length === 0 && <option>{loading ? 'Carregando…' : 'Nenhum paciente'}</option>}
          {patients.map((p) => (
            <option key={p.id} value={p.id}>{p.fullName}</option>
          ))}
        </select>
      </div>
      <span className="text-xs text-surface-400">{patients.length} vinculados</span>
    </div>
  );
}
