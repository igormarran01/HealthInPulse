import { useState } from 'react';
import { useFetch } from '@/hooks';
import { doctorService } from '@/services';
import PatientSelector from './PatientSelector';
import {
  Calendar, FileText, Brain, Target, AlertTriangle, AlertCircle,
  Activity, ClipboardList, History as HistoryIcon,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const RISK_CLASS = { LOW:'badge-low', MODERATE:'badge-moderate', HIGH:'badge-high', CRITICAL:'badge-critical', INCONCLUSIVE:'badge-moderate' };
const RISK_LABEL = { LOW:'Baixo', MODERATE:'Moderado', HIGH:'Alto', CRITICAL:'Crítico', INCONCLUSIVE:'Inconclusivo' };

const KIND_META = {
  appointment: { icon: Calendar,       color: '#003F7E', label: 'Consulta' },
  exam:        { icon: FileText,       color: '#0d9488', label: 'Exame' },
  aiReport:    { icon: Brain,          color: '#7c3aed', label: 'Relatório IA' },
  goal:        { icon: Target,         color: '#16a34a', label: 'Meta' },
  triage:      { icon: ClipboardList,  color: '#00A0DC', label: 'Triagem' },
  alert:       { icon: AlertTriangle,  color: '#d97706', label: 'Alerta' },
  critical:    { icon: AlertCircle,    color: '#dc2626', label: 'Crítico' },
};

function dayLabel(d) {
  const dt = new Date(d);
  if (isToday(dt))     return 'Hoje';
  if (isYesterday(dt)) return 'Ontem';
  return format(dt, "EEEE, dd 'de' MMM 'de' yyyy", { locale: ptBR });
}

function groupByDay(events) {
  const groups = {};
  for (const e of events) {
    const key = format(new Date(e.at), 'yyyy-MM-dd');
    if (!groups[key]) groups[key] = { date: e.at, events: [] };
    groups[key].events.push(e);
  }
  return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
}

export default function DoctorHistory() {
  const [patientId, setPatientId] = useState(null);
  const [filter, setFilter]       = useState('all');

  const { data, loading } = useFetch(
    () => patientId ? doctorService.getHistory(patientId) : Promise.resolve({ data: [] }),
    [patientId],
  );

  const all = Array.isArray(data) ? data : [];
  const filtered = filter === 'all' ? all : all.filter((e) => e.kind === filter);
  const grouped = groupByDay(filtered);

  const FILTERS = [
    { id: 'all',         label: 'Tudo' },
    { id: 'appointment', label: 'Consultas' },
    { id: 'exam',        label: 'Exames' },
    { id: 'aiReport',    label: 'Relatórios' },
    { id: 'triage',      label: 'Triagens' },
    { id: 'goal',        label: 'Metas' },
    { id: 'alert',       label: 'Alertas' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-xs uppercase tracking-widest text-surface-400 font-medium">Linha do tempo</p>
        <h1 className="font-display text-2xl md:text-3xl font-bold mt-1 flex items-center gap-3">
          <HistoryIcon size={26} className="text-brand-700" />
          Histórico do paciente
        </h1>
        <p className="text-sm text-surface-500 mt-2 max-w-2xl">
          Visão cronológica de todos os eventos clínicos do paciente: consultas, exames, relatórios,
          alertas da pulseira e metas concluídas.
        </p>
      </div>

      <PatientSelector value={patientId} onChange={setPatientId} />

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
              filter === f.id
                ? 'bg-brand-700 border-brand-700 text-white'
                : 'bg-white border-surface-200 text-surface-600 hover:border-surface-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="glass h-20 animate-pulse bg-surface-100" />)}
        </div>
      ) : !patientId ? (
        <div className="glass p-10 text-center text-surface-400">
          <AlertCircle size={28} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Selecione um paciente acima</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass p-10 text-center text-surface-400">
          <HistoryIcon size={28} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum evento {filter !== 'all' ? `do tipo "${FILTERS.find(f=>f.id===filter)?.label.toLowerCase()}"` : ''} encontrado</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.date.toString()}>
              <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2 sticky top-0 bg-surface-50 py-1">
                {dayLabel(group.date)}
              </p>
              <ol className="relative border-l-2 border-surface-200 ml-3 space-y-3">
                {group.events.map((e, idx) => {
                  const meta = KIND_META[e.kind] || KIND_META.appointment;
                  const Icon = meta.icon;
                  return (
                    <li key={idx} className="ml-5 relative">
                      <span
                        className="absolute -left-[33px] top-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-card"
                        style={{ backgroundColor: meta.color + '20', color: meta.color }}
                      >
                        <Icon size={11} style={{ color: meta.color }} />
                      </span>
                      <div className="glass p-3 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] uppercase tracking-wide font-bold" style={{ color: meta.color }}>
                              {meta.label}
                            </span>
                            <span className="text-xs text-surface-400">·</span>
                            <span className="text-xs text-surface-500">{format(new Date(e.at), 'HH:mm')}</span>
                          </div>
                          <p className="text-sm font-medium text-surface-800 mt-0.5">{e.title}</p>
                          {e.detail && (
                            <p className="text-xs text-surface-500 mt-1">{e.detail}</p>
                          )}
                        </div>
                        {e.risk && <span className={RISK_CLASS[e.risk]}>{RISK_LABEL[e.risk]}</span>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
