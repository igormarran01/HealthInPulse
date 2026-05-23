import { useFetch, useAsync } from '@/hooks';
import { appointmentService } from '@/services';
import { Calendar, Clock, User, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

const STATUS_META = {
  SCHEDULED:  { label: 'Agendada',   color: 'text-brand-600',  bg: 'bg-brand-50' },
  CONFIRMED:  { label: 'Confirmada', color: 'text-green-600',  bg: 'bg-green-50' },
  CANCELLED:  { label: 'Cancelada',  color: 'text-red-600',    bg: 'bg-red-50'   },
  COMPLETED:  { label: 'Concluída',  color: 'text-surface-500',   bg: 'bg-surface-50' },
};

export default function DoctorAppointments() {
  const { data, loading, refetch } = useFetch(() => appointmentService.listDoctor({ limit: 30 }));
  const { run: updateStatus }      = useAsync(appointmentService.updateStatus);

  const handleStatus = async (id, status) => {
    try {
      await updateStatus(id, { status });
      toast.success(`Consulta ${status === 'CONFIRMED' ? 'confirmada' : status === 'CANCELLED' ? 'cancelada' : 'concluída'}!`);
      refetch();
    } catch { toast.error('Erro ao atualizar'); }
  };

  const appointments = data?.items || [];
  const upcoming     = appointments.filter((a) => ['SCHEDULED','CONFIRMED'].includes(a.status));
  const past         = appointments.filter((a) => ['COMPLETED','CANCELLED'].includes(a.status));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Agenda</h1>
        <p className="text-surface-500 text-sm mt-0.5">Suas consultas agendadas</p>
      </div>

      {loading && <p className="text-surface-400 text-sm text-center py-8">Carregando…</p>}

      {!loading && (
        <>
          <section className="space-y-2">
            <h2 className="section-title">Próximas</h2>
            {upcoming.length === 0
              ? <p className="text-surface-400 text-sm">Sem consultas agendadas</p>
              : upcoming.map((a) => {
                const meta = STATUS_META[a.status];
                return (
                  <div key={a.id} className="glass p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                        <User size={16} className="text-brand-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-800">{a.patient?.fullName}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="flex items-center gap-1 text-xs text-surface-500">
                            <Calendar size={10} />
                            {format(new Date(a.scheduledAt), "dd MMM yyyy", { locale: ptBR })}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-surface-500">
                            <Clock size={10} />
                            {format(new Date(a.scheduledAt), "HH:mm")}
                          </span>
                          <span className="text-xs text-surface-400">{a.duration} min</span>
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${meta.bg} ${meta.color} shrink-0`}>
                        {meta.label}
                      </span>
                    </div>

                    {/* Notas */}
                    {a.notes && (
                      <p className="text-xs text-surface-400 mt-3 pl-14">{a.notes}</p>
                    )}

                    {/* Ações */}
                    {a.status === 'SCHEDULED' && (
                      <div className="flex gap-2 mt-3 pl-14">
                        <button
                          onClick={() => handleStatus(a.id, 'CONFIRMED')}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-all"
                        >
                          <CheckCircle size={12} /> Confirmar
                        </button>
                        <button
                          onClick={() => handleStatus(a.id, 'CANCELLED')}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                        >
                          <XCircle size={12} /> Cancelar
                        </button>
                      </div>
                    )}
                    {a.status === 'CONFIRMED' && (
                      <div className="flex gap-2 mt-3 pl-14">
                        <button
                          onClick={() => handleStatus(a.id, 'COMPLETED')}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-all"
                        >
                          <CheckCircle size={12} /> Marcar como concluída
                        </button>
                        <button
                          onClick={() => handleStatus(a.id, 'CANCELLED')}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                        >
                          <XCircle size={12} /> Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </section>

          {past.length > 0 && (
            <section className="space-y-2">
              <h2 className="section-title">Histórico</h2>
              {past.map((a) => {
                const meta = STATUS_META[a.status];
                return (
                  <div key={a.id} className="glass p-4 flex items-center gap-4 opacity-60">
                    <div className="w-10 h-10 rounded-xl bg-surface-50 flex items-center justify-center shrink-0">
                      <User size={16} className="text-surface-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-surface-600">{a.patient?.fullName}</p>
                      <p className="text-xs text-surface-400">
                        {format(new Date(a.scheduledAt), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${meta.bg} ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}
    </div>
  );
}
