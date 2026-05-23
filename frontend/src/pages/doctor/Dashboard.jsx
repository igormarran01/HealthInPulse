import { useFetch } from '@/hooks';
import { doctorService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import {
  Users, AlertTriangle, Calendar, Brain, ChevronRight, Activity, Stethoscope,
} from 'lucide-react';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const RISK_CLASS = { LOW:'badge-low', MODERATE:'badge-moderate', HIGH:'badge-high', CRITICAL:'badge-critical' };
const RISK_LABEL = { LOW:'Baixo', MODERATE:'Moderado', HIGH:'Alto', CRITICAL:'Crítico' };

const RISK_COLOR = {
  LOW:      '#16a34a',
  MODERATE: '#d97706',
  HIGH:     '#ea580c',
  CRITICAL: '#dc2626',
  NONE:     '#cbd5e1',
};

const tooltipStyle = {
  background: '#ffffff', border: '1px solid rgb(226,232,240)',
  borderRadius: 10, fontSize: 12, boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
};

function KpiCard({ icon: Icon, label, value, accent, hint }) {
  return (
    <div className={`glass card-hover p-5 flex flex-col gap-2 ${accent === 'red' ? 'border-red-200 bg-red-50/30' : ''}`}>
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent === 'red' ? 'bg-red-100' : 'bg-brand-50'}`}>
          <Icon size={18} className={accent === 'red' ? 'text-red-600' : 'text-brand-600'} />
        </div>
        {hint && <span className="text-[10px] text-surface-400 uppercase tracking-wide">{hint}</span>}
      </div>
      <p className="font-display font-bold text-3xl text-surface-900 leading-none">{value ?? '—'}</p>
      <p className="text-xs text-surface-500">{label}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-surface-400">
      <Icon size={24} className="mb-2 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export default function DoctorDashboard() {
  const { user }          = useAuth();
  const { data, loading } = useFetch(doctorService.getDashboard);

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="glass h-28 animate-pulse bg-surface-100" />)}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="glass h-64 animate-pulse bg-surface-100" />)}
      </div>
    </div>
  );

  const upcoming          = data?.upcomingAppointments || [];
  const reports           = data?.recentReports        || [];
  const critical          = data?.criticalPatients     || [];
  const distribution      = data?.riskDistribution     || {};
  const appointmentsByDay = data?.appointmentsByDay    || [];

  const distData = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'NONE'].map((k) => ({
    name: k === 'NONE' ? 'Sem dados' : RISK_LABEL[k],
    key:  k,
    value: distribution[k] || 0,
  })).filter((d) => d.value > 0);

  const totalAssessed = (distribution.LOW || 0) + (distribution.MODERATE || 0)
                      + (distribution.HIGH || 0) + (distribution.CRITICAL || 0);

  const apptData = appointmentsByDay.map((d) => ({
    day:     format(new Date(d.date), 'EEE', { locale: ptBR }).replace('.', ''),
    date:    format(new Date(d.date), 'dd/MM'),
    count:   d.count,
    isToday: isToday(new Date(d.date)),
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-surface-400 font-medium">Visão geral</p>
          <h1 className="font-display text-2xl md:text-3xl font-bold mt-1">
            Olá, <span className="text-brand-700">{user?.fullName || `Dr(a). ${user?.email?.split('@')[0] || ''}`}</span>
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            {data?.totalPatients ?? 0} pacientes ativos · {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <Link to="/doctor/patients" className="btn-primary">
          <Users size={14} /> Ver pacientes
        </Link>
      </div>

      {/* ── KPIs ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Users}         label="Pacientes vinculados" value={data?.totalPatients} />
        <KpiCard icon={Stethoscope}   label="Consultas hoje"       value={data?.todayAppointments} hint="hoje" />
        <KpiCard icon={AlertTriangle} label="Alertas (24h)"        value={data?.criticalAlerts}
                 accent={data?.criticalAlerts > 0 ? 'red' : null}
                 hint={data?.criticalAlerts > 0 ? 'atenção' : null} />
        <KpiCard icon={Activity}      label="Em risco alto"        value={(distribution.HIGH || 0) + (distribution.CRITICAL || 0)}
                 accent={((distribution.HIGH || 0) + (distribution.CRITICAL || 0)) > 0 ? 'red' : null} />
      </div>

      {/* ── Gráficos ────────────────────────────────────────── */}
      <section className="grid lg:grid-cols-3 gap-4">
        {/* Distribuição de risco */}
        <div className="glass p-5 lg:col-span-1">
          <p className="text-xs text-surface-400 uppercase tracking-wide font-medium">Pacientes</p>
          <p className="font-display text-lg font-semibold text-surface-800 mb-1">Distribuição de risco</p>
          <p className="text-xs text-surface-500 mb-3">Baseado no último relatório de cada paciente</p>
          {distData.length === 0 ? (
            <EmptyState icon={Users} message="Sem avaliações ainda" />
          ) : (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={distData} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                      paddingAngle={2} stroke="none"
                    >
                      {distData.map((entry) => (
                        <Cell key={entry.key} fill={RISK_COLOR[entry.key]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="font-display text-2xl font-bold text-surface-900">{totalAssessed}</span>
                  <span className="text-[10px] text-surface-400 uppercase tracking-wider">avaliados</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {distData.map((d) => (
                  <div key={d.key} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: RISK_COLOR[d.key] }} />
                    <span className="text-surface-600 flex-1 truncate">{d.name}</span>
                    <span className="text-surface-900 font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Consultas próximos 7 dias */}
        <div className="glass p-5 lg:col-span-2">
          <p className="text-xs text-surface-400 uppercase tracking-wide font-medium">Agenda</p>
          <p className="font-display text-lg font-semibold text-surface-800 mb-3">Consultas nos próximos 7 dias</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={apptData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="rgb(241,245,249)" strokeDasharray="0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'rgb(100,116,139)' }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'rgb(100,116,139)' }} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: 'rgb(71,85,105)' }}
                formatter={(v) => [`${v} consulta(s)`, 'Total']}
                labelFormatter={(_, p) => p?.[0]?.payload?.date}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {apptData.map((entry, i) => (
                  <Cell key={i} fill={entry.isToday ? '#003F7E' : '#5BCDED'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Pacientes em alerta ─────────────────────────────── */}
      {critical.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-red-600" />
              <h2 className="section-title text-red-700">Pacientes em alerta</h2>
            </div>
            <span className="text-xs text-surface-500">{critical.length} paciente(s)</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {critical.map((p) => (
              <Link key={p.id} to={`/doctor/patients/${p.id}`}
                    className="glass card-hover p-4 flex items-center gap-3 border-red-200/60 bg-red-50/30">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-700 font-bold shrink-0">
                  {p.fullName?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-800 truncate">{p.fullName}</p>
                  <p className="text-xs text-surface-500">
                    {format(new Date(p.generatedAt), "dd MMM", { locale: ptBR })}
                  </p>
                </div>
                <span className={RISK_CLASS[p.riskLevel]}>{RISK_LABEL[p.riskLevel]}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Linha inferior ──────────────────────────────────── */}
      <section className="grid lg:grid-cols-2 gap-4">
        {/* Próximas consultas */}
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-brand-600" />
              <h2 className="section-title">Próximas Consultas</h2>
            </div>
            <Link to="/doctor/appointments" className="text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">
              Ver tudo <ChevronRight size={12} />
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState icon={Calendar} message="Sem consultas agendadas" />
          ) : upcoming.map((a) => {
            const d = new Date(a.scheduledAt);
            return (
              <div key={a.id} className="py-3 border-b border-surface-100 last:border-0 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-brand-50 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] text-brand-700 uppercase font-semibold">{format(d, 'MMM', { locale: ptBR })}</span>
                  <span className="font-display font-bold text-brand-700 leading-none">{format(d, 'dd')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-800 truncate">{a.patient?.fullName}</p>
                  <p className="text-xs text-surface-500 mt-0.5">
                    {isToday(d) ? 'Hoje' : format(d, "dd 'de' MMM", { locale: ptBR })} · {format(d, 'HH:mm')} · {a.duration} min
                  </p>
                </div>
                <span className={`text-[10px] uppercase font-semibold tracking-wide ${a.status === 'CONFIRMED' ? 'text-green-600' : 'text-brand-600'}`}>
                  {a.status === 'CONFIRMED' ? 'Confirmada' : 'Agendada'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Relatórios recentes */}
        <div className="glass p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={15} className="text-brand-600" />
            <h2 className="section-title">Relatórios Recentes</h2>
          </div>
          {reports.length === 0 ? (
            <EmptyState icon={Brain} message="Nenhum relatório" />
          ) : reports.map((r) => (
            <Link
              key={r.id}
              to={`/doctor/patients/${r.patient?.id}`}
              className="py-3 border-b border-surface-100 last:border-0 flex items-center justify-between hover:bg-surface-50 -mx-3 px-3 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-surface-800">{r.patient?.fullName}</p>
                <p className="text-xs text-surface-500">
                  <span className="capitalize">{r.type === 'full' ? 'Completo' : r.type}</span> · {format(new Date(r.generatedAt), "dd MMM", { locale: ptBR })}
                </p>
              </div>
              {r.riskLevel && <span className={RISK_CLASS[r.riskLevel]}>{RISK_LABEL[r.riskLevel]}</span>}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
