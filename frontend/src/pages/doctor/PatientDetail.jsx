import { useFetch } from '@/hooks';
import { doctorService } from '@/services';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Heart, FileText, Brain, Activity,
  Thermometer, Droplets, Loader, AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const RISK_CLASS = { LOW:'badge-low', MODERATE:'badge-moderate', HIGH:'badge-high', CRITICAL:'badge-critical' };
const RISK_LABEL = { LOW:'Baixo', MODERATE:'Moderado', HIGH:'Alto', CRITICAL:'Crítico' };

function VitalMini({ icon: Icon, label, value, unit }) {
  if (!value) return null;
  return (
    <div className="glass p-3 flex items-center gap-3">
      <Icon size={14} className="text-brand-600 shrink-0" />
      <div>
        <p className="text-[10px] text-surface-500">{label}</p>
        <p className="text-sm font-semibold">{value}<span className="text-surface-400 text-xs ml-1">{unit}</span></p>
      </div>
    </div>
  );
}


export default function PatientDetail() {
  const { patientId }     = useParams();
  const { data, loading } = useFetch(() => doctorService.getPatientDetail(patientId), [patientId]);

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-surface-400 text-sm">
      <Loader size={18} className="animate-spin mr-2" /> Carregando…
    </div>
  );

  if (!data) return (
    <div className="text-center py-20 text-surface-400">
      <AlertTriangle size={28} className="mx-auto mb-2" />
      <p>Paciente não encontrado ou sem acesso</p>
    </div>
  );

  const latestVital = data.vitalSigns?.[0];
  const chartData   = [...(data.vitalSigns || [])].reverse().map((v) => ({
    t: format(new Date(v.recordedAt), 'dd/MM'),
    hr: v.heartRate,
    o2: v.oxygenSat,
  }));

  const calcAge = (dob) => Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/doctor/patients" className="btn-ghost p-2">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-xl font-bold">{data.fullName}</h1>
          <p className="text-surface-500 text-sm">
            {calcAge(data.dateOfBirth)} anos · {data.bloodType || 'Tipo sang. não informado'}
          </p>
        </div>
        <Link to="/doctor/reports" className="btn-primary">
          <Brain size={14} /> Gerar relatório
        </Link>
      </div>

      {/* Info chips */}
      <div className="flex flex-wrap gap-2">
        {data.chronicConds?.map((c) => (
          <span key={c} className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600">{c}</span>
        ))}
        {data.allergies?.map((a) => (
          <span key={a} className="text-xs px-2.5 py-0.5 rounded-full bg-red-50 text-red-600">⚠ {a}</span>
        ))}
      </div>

      {/* Últimos vitais */}
      {latestVital && (
        <section>
          <h2 className="section-title mb-3">Últimos Sinais Vitais</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <VitalMini icon={Heart}       label="Freq. Cardíaca" value={latestVital.heartRate}   unit="bpm" />
            <VitalMini icon={Activity}    label="Pressão"        value={latestVital.systolic ? `${latestVital.systolic}/${latestVital.diastolic}` : null} unit="mmHg" />
            <VitalMini icon={Droplets}    label="SpO₂"           value={latestVital.oxygenSat}   unit="%" />
            <VitalMini icon={Thermometer} label="Temperatura"    value={latestVital.temperature} unit="°C" />
          </div>
        </section>
      )}

      {/* Gráfico FC */}
      {chartData.length > 1 && (
        <div className="glass p-5">
          <p className="text-sm text-surface-500 mb-4">Frequência Cardíaca — últimas medições</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: 'rgb(100,116,139)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'rgb(100,116,139)' }} tickLine={false} axisLine={false} width={30} />
              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid rgb(226,232,240)', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: 'rgb(71,85,105)' }}
              />
              <Line type="monotone" dataKey="hr" stroke="#ef4444" strokeWidth={2} dot={false} name="FC (bpm)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Exames recentes */}
      {data.exams?.length > 0 && (
        <section>
          <h2 className="section-title mb-3">Exames Recentes</h2>
          <div className="space-y-2">
            {data.exams.map((e) => (
              <div key={e.id} className="glass p-3 flex items-center gap-3">
                <FileText size={15} className="text-brand-600 shrink-0" />
                <p className="text-sm text-surface-700 flex-1">{e.title}</p>
                <span className="text-xs text-surface-400">
                  {format(new Date(e.uploadedAt), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
                {e.examResult?.riskLevel && (
                  <span className={RISK_CLASS[e.examResult.riskLevel]}>
                    {RISK_LABEL[e.examResult.riskLevel]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Relatórios IA recentes */}
      {data.aiReports?.length > 0 && (
        <section>
          <h2 className="section-title mb-3">Relatórios IA Anteriores</h2>
          <div className="space-y-2">
            {data.aiReports.map((r) => (
              <div key={r.id} className="glass p-3 flex items-center gap-3">
                <Brain size={15} className="text-brand-600 shrink-0" />
                <p className="text-sm text-surface-700 flex-1 capitalize">{r.type}</p>
                <span className="text-xs text-surface-400">
                  {format(new Date(r.generatedAt), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
                {r.riskLevel && <span className={RISK_CLASS[r.riskLevel]}>{RISK_LABEL[r.riskLevel]}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
