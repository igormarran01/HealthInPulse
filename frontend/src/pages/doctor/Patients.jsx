import { useState } from 'react';
import { useFetch, useDebounce } from '@/hooks';
import { doctorService } from '@/services';
import { Users, Search, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DoctorPatients() {
  const [search, setSearch] = useState('');
  const debouncedSearch     = useDebounce(search, 400);

  const { data, loading } = useFetch(
    () => doctorService.getPatients({ search: debouncedSearch || undefined, limit: 30 }),
    [debouncedSearch],
  );

  const patients = data?.patients || [];

  const calcAge = (dob) => {
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Pacientes</h1>
          <p className="text-surface-500 text-sm mt-0.5">
            {data?.total ?? 0} paciente(s) vinculado(s)
          </p>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          className="input pl-9"
          placeholder="Buscar por nome ou CPF…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Lista */}
      {loading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass h-16 animate-pulse bg-surface-50" />
          ))}
        </div>
      )}

      {!loading && patients.length === 0 && (
        <div className="glass p-10 text-center text-surface-400 text-sm">
          <Users size={32} className="mx-auto mb-3 opacity-30" />
          {search ? 'Nenhum paciente encontrado' : 'Nenhum paciente vinculado ainda'}
        </div>
      )}

      <div className="space-y-2">
        {patients.map((p) => (
          <Link
            key={p.id}
            to={`/doctor/patients/${p.id}`}
            className="glass p-4 flex items-center gap-4 hover:border-brand-200 transition-all group"
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0 text-brand-600 font-bold text-sm">
              {p.fullName?.[0]?.toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-800 group-hover:text-surface-900 transition-colors truncate">
                {p.fullName}
              </p>
              <div className="flex items-center gap-3 mt-0.5">
                {p.dateOfBirth && (
                  <span className="text-xs text-surface-500">{calcAge(p.dateOfBirth)} anos</span>
                )}
                {p.bloodType && (
                  <span className="text-xs text-brand-600/70">{p.bloodType}</span>
                )}
                {p.chronicConds?.length > 0 && (
                  <span className="text-xs text-surface-400 truncate">
                    {p.chronicConds.slice(0, 2).join(', ')}
                  </span>
                )}
              </div>
            </div>

            <ChevronRight size={14} className="text-surface-300 group-hover:text-surface-500 shrink-0 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
