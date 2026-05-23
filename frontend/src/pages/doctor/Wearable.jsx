import { useState } from 'react';
import { useFetch } from '@/hooks';
import { doctorService } from '@/services';
import PatientSelector from './PatientSelector';
import {
  Heart, Activity, Thermometer, Droplets, FileText, Brain, Target,
  TrendingUp, AlertCircle, Watch,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const RISK_CLASS = { LOW:'badge-low', MODERATE:'badge-moderate', HIGH:'badge-high', CRITICAL:'badge-critical' };
const RISK_LABEL = { LOW:'Baixo', MODERATE:'Moderado', HIGH:'Alto', CRITICAL:'Crítico', INCONCLUSIVE:'Inconclusivo' };

const tooltipStyle = {
  background: '#ffffff', border: '1px solid rgb(226,232,240)',
  borderRadius: 10, fontSize: 12, boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
};

function VitalCell({ icon: Icon, label, value, unit, color }) {
  return (
    <div className="rounded-xl bg-surface-50 border border-surface-200 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
          <Icon size={13} style={{ color }} />
        </span>
        <span className="text-[10px] uppercase tracking-wide text-surface-400 font-semibold">{label}</span>
      </div>
      <p className="font-display font-bold text-2xl text-surface-900 leading-none">
        {value ?? '—'}
        {value != null && <span className="text-xs font-sans font-medium text-surface-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

export default function DoctorWearable() {
  const [patientId, setPatientId] = useState(null);
  const { data, loading } = useFetch(
    () => patientId ? doctorService.getConsolidated(patientId) : Promise.resolve({ data: null }),
    [patientId],
  );

  const patient     = data?.patient;
  const lv          = data?.latestVital;
  const trend       = data?.vitalsTrend || [];
  const exams       = data?.exams || [];
  const aiReports   = data?.aiReports || [];
  const goals       = data?.goals || [];
  const activeGoals = goals.filter((g) => g.status === 'ACTIVE');

  const bpData = trend.map((v) => ({
    t: format(new Date(v.recordedAt), 'dd/MM'),
    sys: v.systolic, dia: v.diastolic,
  }));
  const hrData = trend.map((v) => ({
    t: format(new Date(v.recordedAt), 'dd/MM'),
    v: v.heartRate,
  }));
  const gluData = trend.map((v) => ({
    t: format(new Date(v.recordedAt), 'dd/MM'),
    v: v.glucose,
  }));

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-xs uppercase tracking-widest text-surface-400 font-medium">Pulseira Care Plus</p>
        <h1 className="font-display text-2xl md:text-3xl font-bold mt-1 flex items-center gap-3">
          <Watch size={26} className="text-brand-700" />
          Consolidado do paciente
        </h1>
        <p className="text-sm text-surface-500 mt-2 max-w-2xl">
          Resumo clínico baseado nos últimos dados coletados pela pulseira e nos exames recentes.
        </p>
      </div>

      <PatientSelector value={patientId} onChange={setPatientId} />

      {loading ? (
        <div className="glass h-64 animate-pulse bg-surface-100" />
      ) : !patient ? (
        <div className="glass p-10 text-center text-surface-400">
          <AlertCircle size={28} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Selecione um paciente acima</p>
        </div>
      ) : (
        <>
          {/* Identificação */}
          <div className="glass p-5 flex flex-wrap items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-700 font-bold flex items-center justify-center text-lg shrink-0">
              {patient.fullName?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-lg text-surface-900">{patient.fullName}</p>
              <p className="text-xs text-surface-500">
                {patient.user?.email} · {patient.gender === 'MALE' ? 'Masculino' : patient.gender === 'FEMALE' ? 'Feminino' : 'Outro'}
                {patient.bloodType && ` · ${patient.bloodType}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {patient.chronicConds?.map((c) => (
                <span key={c} className="badge-moderate">{c}</span>
              ))}
              {patient.allergies?.map((a) => (
                <span key={a} className="badge-critical">⚠ {a}</span>
              ))}
            </div>
          </div>

          {/* Últimos vitais */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title">Últimas medições</h2>
              {lv?.recordedAt && (
                <span className="text-xs text-surface-500">
                  {format(new Date(lv.recordedAt), "dd MMM 'às' HH:mm", { locale: ptBR })}
                </span>
              )}
            </div>
            {lv ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <VitalCell icon={Heart}       label="Freq. Cardíaca" value={lv.heartRate}   unit="bpm"   color="#dc2626" />
                <VitalCell icon={Activity}    label="Pressão sist." value={lv.systolic ? `${lv.systolic}/${lv.diastolic}` : null} unit="mmHg" color="#003F7E" />
                <VitalCell icon={Droplets}    label="SpO₂"          value={lv.oxygenSat}   unit="%"     color="#00A0DC" />
                <VitalCell icon={Thermometer} label="Temperatura"   value={lv.temperature} unit="°C"    color="#d97706" />
                <VitalCell icon={Activity}    label="Glicose"       value={lv.glucose}     unit="mg/dL" color="#a855f7" />
              </div>
            ) : (
              <p className="text-sm text-surface-400">Sem leituras registradas.</p>
            )}
          </section>

          {/* Tendências 30d */}
          <section className="grid lg:grid-cols-3 gap-3">
            <div className="glass p-4">
              <p className="text-xs text-surface-400 uppercase tracking-wide font-medium mb-2">Pressão arterial · 30d</p>
              {bpData.length === 0 ? (
                <p className="text-sm text-surface-400 py-10 text-center">sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={bpData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                    <defs>
                      <linearGradient id="sysGradW" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#003F7E" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#003F7E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgb(241,245,249)" strokeDasharray="0" vertical={false} />
                    <XAxis dataKey="t" tick={{ fontSize: 9, fill: 'rgb(100,116,139)' }} tickLine={false} axisLine={false} minTickGap={30} />
                    <YAxis tick={{ fontSize: 9, fill: 'rgb(100,116,139)' }} tickLine={false} axisLine={false} width={28} domain={['dataMin - 5', 'dataMax + 5']} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="sys" stroke="#003F7E" strokeWidth={2} fill="url(#sysGradW)" />
                    <Line type="monotone" dataKey="dia" stroke="#5BCDED" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="glass p-4">
              <p className="text-xs text-surface-400 uppercase tracking-wide font-medium mb-2">Frequência cardíaca · 30d</p>
              {hrData.length === 0 ? (
                <p className="text-sm text-surface-400 py-10 text-center">sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={hrData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                    <CartesianGrid stroke="rgb(241,245,249)" strokeDasharray="0" vertical={false} />
                    <XAxis dataKey="t" tick={{ fontSize: 9, fill: 'rgb(100,116,139)' }} tickLine={false} axisLine={false} minTickGap={30} />
                    <YAxis tick={{ fontSize: 9, fill: 'rgb(100,116,139)' }} tickLine={false} axisLine={false} width={28} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="v" stroke="#dc2626" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="glass p-4">
              <p className="text-xs text-surface-400 uppercase tracking-wide font-medium mb-2">Glicose · 30d</p>
              {gluData.length === 0 ? (
                <p className="text-sm text-surface-400 py-10 text-center">sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={gluData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                    <CartesianGrid stroke="rgb(241,245,249)" strokeDasharray="0" vertical={false} />
                    <XAxis dataKey="t" tick={{ fontSize: 9, fill: 'rgb(100,116,139)' }} tickLine={false} axisLine={false} minTickGap={30} />
                    <YAxis tick={{ fontSize: 9, fill: 'rgb(100,116,139)' }} tickLine={false} axisLine={false} width={28} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="v" stroke="#a855f7" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* Exames + IA + Metas */}
          <section className="grid lg:grid-cols-3 gap-3">
            <div className="glass p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={14} className="text-brand-700" />
                <h3 className="section-title">Exames recentes</h3>
              </div>
              {exams.length === 0 ? (
                <p className="text-sm text-surface-400">Nenhum exame</p>
              ) : exams.slice(0, 4).map((e) => (
                <div key={e.id} className="py-2.5 border-b border-surface-100 last:border-0 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-surface-800 truncate">{e.title}</p>
                    <p className="text-[11px] text-surface-500">{format(new Date(e.uploadedAt), 'dd MMM', { locale: ptBR })}</p>
                  </div>
                  {e.examResult?.riskLevel && (
                    <span className={RISK_CLASS[e.examResult.riskLevel]}>{RISK_LABEL[e.examResult.riskLevel]}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="glass p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={14} className="text-brand-700" />
                <h3 className="section-title">Relatórios IA</h3>
              </div>
              {aiReports.length === 0 ? (
                <p className="text-sm text-surface-400">Nenhum relatório</p>
              ) : aiReports.map((r) => (
                <div key={r.id} className="py-2.5 border-b border-surface-100 last:border-0 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-surface-800 capitalize">{r.type === 'full' ? 'Relatório completo' : r.type}</p>
                    <p className="text-[11px] text-surface-500">{format(new Date(r.generatedAt), 'dd MMM', { locale: ptBR })}</p>
                  </div>
                  {r.riskLevel && <span className={RISK_CLASS[r.riskLevel]}>{RISK_LABEL[r.riskLevel]}</span>}
                </div>
              ))}
            </div>

            <div className="glass p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target size={14} className="text-brand-700" />
                <h3 className="section-title">Metas ativas</h3>
              </div>
              {activeGoals.length === 0 ? (
                <p className="text-sm text-surface-400">Sem metas ativas</p>
              ) : activeGoals.slice(0, 4).map((g) => (
                <div key={g.id} className="py-2.5 border-b border-surface-100 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-surface-800 truncate flex-1">{g.title}</p>
                    <span className="text-xs text-surface-500 ml-2">{Math.round(g.progress || 0)}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-100 overflow-hidden">
                    <div className="h-full bg-brand-700 transition-all" style={{ width: `${g.progress || 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
