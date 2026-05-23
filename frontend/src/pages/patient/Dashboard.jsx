import { useFetch } from '@/hooks';
import { useLiveVitals } from '@/hooks/useLiveVitals';
import { useCountUp } from '@/hooks/useCountUp';
import { patientService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import {
  Heart, Activity, Thermometer, Droplets, FileText, Calendar, Brain, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Bell, ChevronRight, Target, Coins, Gift,
} from 'lucide-react';
import { goalService } from '@/services';
import { format, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const RISK_CLASS = {
  LOW:      'badge-low',
  MODERATE: 'badge-moderate',
  HIGH:     'badge-high',
  CRITICAL: 'badge-critical',
};
const RISK_LABEL = { LOW: 'Baixo', MODERATE: 'Moderado', HIGH: 'Alto', CRITICAL: 'Crítico' };

const RANGES = {
  HR:   { ok: [60, 100],    unit: 'bpm',   label: 'Freq. Cardíaca' },
  SYS:  { ok: [90, 130],    unit: 'mmHg',  label: 'Pressão Sist.'  },
  SPO2: { ok: [95, 100],    unit: '%',     label: 'Saturação O₂'   },
  TEMP: { ok: [35.8, 37.3], unit: '°C',    label: 'Temperatura'    },
  GLU:  { ok: [70, 110],    unit: 'mg/dL', label: 'Glicose'        },
};

function chipStatus(v, [lo, hi]) {
  if (v == null) return { text: 'sem leitura', color: 'text-surface-400' };
  if (v < lo)    return { text: 'abaixo', color: 'text-blue-600' };
  if (v > hi)    return { text: 'acima',  color: 'text-orange-600' };
  return { text: 'normal', color: 'text-green-600' };
}

function trendArrow(series) {
  const vals = (series || []).map((s) => s.v).filter((v) => v != null);
  if (vals.length < 2) return { Icon: Minus, color: 'text-surface-400', label: '—' };
  const half  = Math.floor(vals.length / 2);
  const first = vals.slice(0, Math.max(1, half));
  const last  = vals.slice(half);
  const avg   = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const delta = avg(last) - avg(first);
  const pct   = Math.abs((delta / Math.max(1, avg(first))) * 100);
  if (pct < 3) return { Icon: Minus, color: 'text-surface-400', label: 'estável' };
  if (delta > 0) return { Icon: TrendingUp,   color: 'text-orange-500', label: `↑ ${pct.toFixed(0)}%` };
  return            { Icon: TrendingDown, color: 'text-green-600',  label: `↓ ${pct.toFixed(0)}%` };
}

function Sparkline({ data, color }) {
  const filtered = (data || []).filter((d) => d.v != null);
  if (filtered.length < 2) return <div className="h-8" />;
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={filtered} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function VitalCard({ icon: Icon, label, value, unit, ok, color, series, decimals = 0 }) {
  const status   = chipStatus(value, ok);
  const trend    = trendArrow(series);
  const animated = useCountUp(value, { duration: 700, decimals });
  return (
    <div className="glass card-hover p-4 flex flex-col gap-3 transition-transform">
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
          <Icon size={16} style={{ color }} />
        </div>
        <span className={`text-[10px] font-medium uppercase tracking-wide ${status.color}`}>
          {status.text}
        </span>
      </div>
      <div>
        <p className="text-xs text-surface-500">{label}</p>
        <p className="font-display font-bold text-2xl text-surface-900 leading-none mt-1 tabular-nums">
          {animated ?? '—'}
          {value != null && <span className="text-xs font-sans font-medium text-surface-400 ml-1">{unit}</span>}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex-1 max-w-[80px]"><Sparkline data={series} color={color} /></div>
        <div className={`flex items-center gap-1 text-[11px] font-medium ${trend.color}`}>
          <trend.Icon size={11} /> {trend.label}
        </div>
      </div>
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

const tooltipStyle = {
  background:   '#ffffff',
  border:       '1px solid rgb(226,232,240)',
  borderRadius: 10,
  fontSize:     12,
  boxShadow:    '0 4px 12px rgba(15,23,42,0.08)',
};

export default function PatientDashboard() {
  const { user }          = useAuth();
  const { data, loading } = useFetch(patientService.getDashboard);
  const { data: goals }   = useFetch(goalService.list);

  // ─── Hooks sempre executam antes de qualquer early-return ────
  // Pulseira Care Plus — leituras simuladas a cada 1s
  const { current: vitals, spark } = useLiveVitals(data?.latestVitals, data?.vitalsTrend, {
    intervalMs: 1000,
    sparkSize:  30,
  });

  // Score de saúde geral
  const score = (() => {
    if (!vitals) return null;
    let pts = 0, total = 0;
    const checks = [
      [vitals.heartRate,   ...RANGES.HR.ok],
      [vitals.systolic,    ...RANGES.SYS.ok],
      [vitals.oxygenSat,   ...RANGES.SPO2.ok],
      [vitals.temperature, ...RANGES.TEMP.ok],
      [vitals.glucose,     ...RANGES.GLU.ok],
    ];
    for (const [v, lo, hi] of checks) {
      if (v == null) continue;
      total += 1;
      if (v >= lo && v <= hi) pts += 1;
    }
    return total ? Math.round((pts / total) * 100) : null;
  })();
  const scoreAnimated = useCountUp(score, { duration: 1200, decimals: 0 });

  // ─── Daqui em diante: derivados (não-hooks) e early-return ───
  if (loading) return (
    <div className="space-y-4">
      <div className="glass h-32 animate-pulse bg-surface-100" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => <div key={i} className="glass h-32 animate-pulse bg-surface-100" />)}
      </div>
      <div className="glass h-64 animate-pulse bg-surface-100" />
    </div>
  );

  const trend        = data?.vitalsTrend || [];
  const appointments = data?.upcomingAppointments || [];
  const reports      = data?.recentReports || [];
  const exams        = data?.recentExams || [];
  const pendingExams = data?.pendingExams || 0;
  const unread       = data?.unreadNotifs || 0;

  // Sparklines vêm da janela ao vivo (últimas 30 leituras da pulseira)
  const seriesHR   = spark.map((v) => ({ t: v.recordedAt, v: v.heartRate }));
  const seriesSYS  = spark.map((v) => ({ t: v.recordedAt, v: v.systolic  }));
  const seriesSPO2 = spark.map((v) => ({ t: v.recordedAt, v: v.oxygenSat }));
  const seriesGLU  = spark.map((v) => ({ t: v.recordedAt, v: v.glucose   }));

  // Histórico (30 dias) — estático, do backend
  const bpData = trend.map((v) => ({
    t:   format(new Date(v.recordedAt), 'dd/MM'),
    sys: v.systolic,
    dia: v.diastolic,
  }));
  const gluData = trend.map((v) => ({
    t: format(new Date(v.recordedAt), 'dd/MM'),
    v: v.glucose,
  }));

  const scoreColor = score == null ? '#94a3b8' : score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';
  const scoreLabel = score == null ? 'sem dados' : score >= 80 ? 'Bom estado' : score >= 60 ? 'Atenção'    : 'Crítico';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Hero: saudação + score ──────────────────────────── */}
      <div className="glass p-6 flex flex-col md:flex-row items-start md:items-center gap-6 bg-gradient-to-br from-white to-brand-50/40">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest text-surface-400 font-medium">Bem-vindo de volta</p>
          <h1 className="font-display text-2xl md:text-3xl font-bold mt-1">
            Olá, <span className="text-brand-700">{user?.fullName?.split(' ')[0] || 'paciente'}</span>
          </h1>
          <p className="text-sm text-surface-500 mt-2">
            Aqui está o resumo da sua saúde com base nas últimas leituras da sua pulseira Care Plus.
          </p>
          {unread > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 text-xs text-brand-700 bg-brand-50 px-3 py-1.5 rounded-full border border-brand-200">
              <Bell size={11} /> {unread} notificação(ões) não lida(s)
            </div>
          )}
        </div>

        {/* Score gauge */}
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-24">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(241,245,249)" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke={scoreColor} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(scoreAnimated ?? 0) * 2.64} 264`}
                style={{ transition: 'stroke-dasharray 0.4s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-bold tabular-nums" style={{ color: scoreColor }}>
                {scoreAnimated ?? '—'}
              </span>
              <span className="text-[10px] text-surface-400 uppercase tracking-wider">score</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-surface-400 uppercase tracking-wide">Estado geral</p>
            <p className="font-display font-semibold text-lg" style={{ color: scoreColor }}>{scoreLabel}</p>
            <p className="text-xs text-surface-500 mt-0.5">
              {trend.length} leituras nos últimos 30 dias
            </p>
          </div>
        </div>
      </div>

      {/* ── Mini-cards: Metas + Coins + Recompensas ─────────── */}
      {(() => {
        const allGoals = Array.isArray(goals) ? goals : [];
        const active   = allGoals.filter((g) => g.status === 'ACTIVE');
        const done     = allGoals.filter((g) => g.status === 'DONE');
        const avgProg  = active.length
          ? Math.round(active.reduce((a, g) => a + (g.progress || 0), 0) / active.length)
          : 0;
        return (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Link to="/patient/goals" className="glass card-hover p-4 flex items-center gap-4 group">
              <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center text-brand-700 shrink-0">
                <Target size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-surface-400 uppercase tracking-wide font-medium">Metas ativas</p>
                <p className="font-display font-bold text-xl text-surface-900 mt-0.5">
                  {active.length}
                  <span className="text-xs font-sans font-medium text-surface-400 ml-2">
                    {done.length} concluída(s)
                  </span>
                </p>
                <div className="w-full h-1.5 rounded-full bg-surface-100 mt-2 overflow-hidden">
                  <div className="h-full bg-brand-700 transition-all duration-700" style={{ width: `${avgProg}%` }} />
                </div>
              </div>
              <ChevronRight size={14} className="text-surface-300 group-hover:text-brand-700 transition-colors" />
            </Link>

            <div className="glass p-4 flex items-center gap-4 bg-gradient-to-br from-white to-amber-50/40 border-amber-200/60">
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                <Coins size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-amber-700/80 uppercase tracking-wide font-medium">Health Coins</p>
                <p className="font-display font-bold text-2xl text-amber-700 mt-0.5">{user?.healthCoins ?? 0}</p>
                <p className="text-[11px] text-surface-500 mt-0.5">trocáveis por recompensas</p>
              </div>
            </div>

            <Link to="/patient/rewards" className="glass card-hover p-4 flex items-center gap-4 group">
              <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center text-brand-700 shrink-0">
                <Gift size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-surface-400 uppercase tracking-wide font-medium">Loja Care Plus</p>
                <p className="text-sm font-semibold text-surface-800 mt-0.5">Trocar coins</p>
                <p className="text-[11px] text-surface-500 mt-0.5">consultas, descontos, itens</p>
              </div>
              <ChevronRight size={14} className="text-surface-300 group-hover:text-brand-700 transition-colors" />
            </Link>
          </section>
        );
      })()}

      {/* ── Alertas ─────────────────────────────────────────── */}
      {pendingExams > 0 && (
        <div className="glass p-4 flex items-center gap-3 border-amber-200 bg-amber-50/40">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={16} className="text-amber-600" />
          </div>
          <p className="text-sm text-surface-700 flex-1">
            Você tem <span className="font-semibold">{pendingExams}</span> exame(s) sendo processado(s).
          </p>
          <Link to="/patient/exams" className="text-xs font-medium text-amber-700 hover:text-amber-800">
            Ver exames →
          </Link>
        </div>
      )}

      {/* ── Cards de vitais ─────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Últimas medições</h2>
          <span className="inline-flex items-center gap-2 text-[11px] font-medium text-accent-700">
            <span className="live-dot" />
            Pulseira Care Plus · {vitals?.recordedAt ? format(new Date(vitals.recordedAt), 'HH:mm:ss') : 'ao vivo'}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <VitalCard icon={Heart}       label={RANGES.HR.label}   value={vitals?.heartRate}   unit={RANGES.HR.unit}   ok={RANGES.HR.ok}   color="#dc2626" series={seriesHR}   decimals={0} />
          <VitalCard icon={Activity}    label={RANGES.SYS.label}  value={vitals?.systolic}    unit={RANGES.SYS.unit}  ok={RANGES.SYS.ok}  color="#003F7E" series={seriesSYS}  decimals={0} />
          <VitalCard icon={Droplets}    label={RANGES.SPO2.label} value={vitals?.oxygenSat}   unit={RANGES.SPO2.unit} ok={RANGES.SPO2.ok} color="#00A0DC" series={seriesSPO2} decimals={1} />
          <VitalCard icon={Thermometer} label={RANGES.TEMP.label} value={vitals?.temperature} unit={RANGES.TEMP.unit} ok={RANGES.TEMP.ok} color="#d97706" series={[]}         decimals={1} />
          <VitalCard icon={Activity}    label={RANGES.GLU.label}  value={vitals?.glucose}     unit={RANGES.GLU.unit}  ok={RANGES.GLU.ok}  color="#a855f7" series={seriesGLU}  decimals={0} />
        </div>
      </section>

      {/* ── Gráficos grandes ────────────────────────────────── */}
      <section className="grid lg:grid-cols-2 gap-4">
        {/* Pressão arterial */}
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-surface-400 uppercase tracking-wide font-medium">Pressão arterial</p>
              <p className="font-display text-lg font-semibold text-surface-800">Últimos 30 dias</p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-surface-600">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-600" /> Sistólica
              </span>
              <span className="flex items-center gap-1.5 text-surface-600">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-300" /> Diastólica
              </span>
            </div>
          </div>
          {bpData.length === 0 ? (
            <EmptyState icon={Activity} message="Sem dados de pressão ainda" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={bpData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="sysGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#003F7E" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#003F7E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgb(241,245,249)" strokeDasharray="0" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: 'rgb(100,116,139)' }} tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis tick={{ fontSize: 10, fill: 'rgb(100,116,139)' }} tickLine={false} axisLine={false} width={32} domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'rgb(71,85,105)' }} />
                <Area type="monotone" dataKey="sys" stroke="#003F7E" strokeWidth={2} fill="url(#sysGrad)" name="Sistólica" />
                <Line type="monotone" dataKey="dia" stroke="#5BCDED" strokeWidth={2} dot={false} name="Diastólica" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Glicose */}
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-surface-400 uppercase tracking-wide font-medium">Glicose</p>
              <p className="font-display text-lg font-semibold text-surface-800">Últimos 30 dias</p>
            </div>
            <span className="text-[11px] text-surface-500">faixa normal: 70–110 mg/dL</span>
          </div>
          {gluData.length === 0 ? (
            <EmptyState icon={Activity} message="Sem dados de glicose ainda" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={gluData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="rgb(241,245,249)" strokeDasharray="0" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: 'rgb(100,116,139)' }} tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis tick={{ fontSize: 10, fill: 'rgb(100,116,139)' }} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'rgb(71,85,105)' }} />
                <Line type="monotone" dataKey="v" stroke="#a855f7" strokeWidth={2} dot={{ r: 3, fill: '#a855f7' }} activeDot={{ r: 5 }} name="Glicose (mg/dL)" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ── Linha inferior: consultas + relatórios + exames ── */}
      <section className="grid lg:grid-cols-3 gap-4">
        {/* Consultas */}
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-brand-600" />
              <h2 className="section-title">Próximas Consultas</h2>
            </div>
            <Link to="/patient/appointments" className="text-xs text-brand-600 hover:text-brand-700">Ver tudo</Link>
          </div>
          {appointments.length === 0 ? (
            <EmptyState icon={Calendar} message="Nenhuma consulta agendada" />
          ) : appointments.map((a) => {
            const d = new Date(a.scheduledAt);
            const when = isToday(d) ? 'Hoje' : isTomorrow(d) ? 'Amanhã' : format(d, "dd 'de' MMM", { locale: ptBR });
            return (
              <div key={a.id} className="py-3 border-b border-surface-100 last:border-0 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-brand-50 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] text-brand-700 uppercase font-semibold">{format(d, 'MMM', { locale: ptBR })}</span>
                  <span className="font-display font-bold text-brand-700 leading-none">{format(d, 'dd')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-800 truncate">{a.doctor?.fullName}</p>
                  <p className="text-xs text-surface-500">{a.doctor?.specialty}</p>
                  <p className="text-xs text-brand-700 mt-0.5">{when} · {format(d, 'HH:mm')}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Relatórios IA */}
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain size={14} className="text-brand-600" />
              <h2 className="section-title">Relatórios IA</h2>
            </div>
            <Link to="/patient/reports" className="text-xs text-brand-600 hover:text-brand-700">Ver tudo</Link>
          </div>
          {reports.length === 0 ? (
            <EmptyState icon={Brain} message="Nenhum relatório gerado" />
          ) : reports.map((r) => (
            <div key={r.id} className="py-3 border-b border-surface-100 last:border-0 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-surface-800 capitalize">
                  {r.type === 'full' ? 'Relatório completo' : r.type}
                </p>
                <p className="text-xs text-surface-500">
                  {format(new Date(r.generatedAt), "dd MMM", { locale: ptBR })}
                </p>
              </div>
              {r.riskLevel && <span className={RISK_CLASS[r.riskLevel]}>{RISK_LABEL[r.riskLevel]}</span>}
            </div>
          ))}
        </div>

        {/* Exames recentes */}
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-brand-600" />
              <h2 className="section-title">Exames Recentes</h2>
            </div>
            <Link to="/patient/exams" className="text-xs text-brand-600 hover:text-brand-700">Ver tudo</Link>
          </div>
          {exams.length === 0 ? (
            <EmptyState icon={FileText} message="Nenhum exame enviado" />
          ) : exams.map((e) => (
            <div key={e.id} className="py-3 border-b border-surface-100 last:border-0 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-800 truncate">{e.title}</p>
                <p className="text-xs text-surface-500">
                  {format(new Date(e.uploadedAt), "dd MMM yyyy", { locale: ptBR })}
                </p>
              </div>
              {e.examResult?.riskLevel
                ? <span className={RISK_CLASS[e.examResult.riskLevel]}>{RISK_LABEL[e.examResult.riskLevel]}</span>
                : <span className="text-[10px] text-surface-400 uppercase">{e.status === 'PROCESSING' ? 'Processando' : 'Aguardando'}</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
