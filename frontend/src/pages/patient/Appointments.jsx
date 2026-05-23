import { useFetch } from '@/hooks';
import { appointmentService } from '@/services';
import { Calendar, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_META = {
  SCHEDULED:  { label: 'Agendada',   color: 'text-brand-600',  bg: 'bg-brand-50' },
  CONFIRMED:  { label: 'Confirmada', color: 'text-green-600',  bg: 'bg-green-50' },
  CANCELLED:  { label: 'Cancelada',  color: 'text-red-600',    bg: 'bg-red-50'   },
  COMPLETED:  { label: 'Concluída',  color: 'text-surface-500',   bg: 'bg-surface-50' },
};

export default function Appointments() {
  const { data, loading } = useFetch(() => appointmentService.listMy({ limit: 20 }));
  const appointments = data?.items || [];

  const upcoming = appointments.filter((a) => ['SCHEDULED','CONFIRMED'].includes(a.status));
  const past     = appointments.filter((a) => ['COMPLETED','CANCELLED'].includes(a.status));

  const Card = ({ a }) => {
    const meta = STATUS_META[a.status];
    return (
      <div className="glass p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
          <User size={18} className="text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-surface-800">{a.doctor?.fullName}</p>
          <p className="text-xs text-surface-500">{a.doctor?.specialty}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs text-surface-500">
              <Calendar size={11} />
              {format(new Date(a.scheduledAt), "dd MMM yyyy", { locale: ptBR })}
            </span>
            <span className="flex items-center gap-1 text-xs text-surface-500">
              <Clock size={11} />
              {format(new Date(a.scheduledAt), "HH:mm")}
            </span>
          </div>
        </div>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${meta.bg} ${meta.color}`}>
          {meta.label}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Consultas</h1>
        <p className="text-surface-500 text-sm mt-0.5">Suas consultas agendadas e histórico</p>
      </div>

      {loading && <p className="text-surface-400 text-sm text-center py-8">Carregando…</p>}

      {!loading && (
        <>
          <section className="space-y-2">
            <h2 className="section-title">Próximas</h2>
            {upcoming.length === 0
              ? <p className="text-surface-400 text-sm">Nenhuma consulta agendada</p>
              : upcoming.map((a) => <Card key={a.id} a={a} />)}
          </section>

          {past.length > 0 && (
            <section className="space-y-2">
              <h2 className="section-title">Histórico</h2>
              {past.map((a) => <Card key={a.id} a={a} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
