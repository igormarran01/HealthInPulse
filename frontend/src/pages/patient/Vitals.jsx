import { useState } from 'react';
import { useFetch, useAsync } from '@/hooks';
import { patientService } from '@/services';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Heart } from 'lucide-react';
import toast from 'react-hot-toast';

const FIELDS = [
  { key: 'heartRate',   label: 'Freq. Cardíaca', unit: 'bpm',  color: '#ef4444' },
  { key: 'systolic',    label: 'Sistólica',       unit: 'mmHg', color: '#20a7b0' },
  { key: 'oxygenSat',   label: 'Saturação O₂',   unit: '%',    color: '#3b82f6' },
  { key: 'temperature', label: 'Temperatura',     unit: '°C',   color: '#f59e0b' },
  { key: 'glucose',     label: 'Glicose',         unit: 'mg/dL',color: '#a855f7' },
];

function AddVitalModal({ onClose, onSaved }) {
  const [form, setForm] = useState({});
  const { run, loading } = useAsync(patientService.addVital);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value ? Number(e.target.value) : undefined }));

  const submit = async (e) => {
    e.preventDefault();
    try {
      await run(form);
      toast.success('Sinal vital registrado!');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao registrar');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/30 backdrop-blur-sm">
      <div className="glass p-6 w-full max-w-sm animate-slide-up">
        <h3 className="font-display font-semibold text-lg mb-4">Registrar Sinal Vital</h3>
        <form onSubmit={submit} className="space-y-3">
          {FIELDS.map(({ key, label, unit }) => (
            <div key={key}>
              <label className="label">{label} ({unit})</label>
              <input className="input" type="number" step="0.1" onChange={set(key)} placeholder="—" />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PatientVitals() {
  const [showAdd, setShowAdd]     = useState(false);
  const [active,  setActive]      = useState('heartRate');
  const { data, loading, refetch } = useFetch(
    () => patientService.getVitals({ limit: 30 }),
  );

  const items    = data?.items || [];
  const field    = FIELDS.find((f) => f.key === active);
  const chartData = [...items].reverse().map((v) => ({
    t: format(new Date(v.recordedAt), 'dd/MM HH:mm'),
    v: v[active],
  }));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Sinais Vitais</h1>
          <p className="text-surface-500 text-sm mt-0.5">Histórico e registro manual</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={15} /> Registrar
        </button>
      </div>

      {/* Selector */}
      <div className="flex flex-wrap gap-2">
        {FIELDS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActive(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              active === f.key
                ? 'text-surface-900'
                : 'text-surface-500 hover:text-surface-600 glass'
            }`}
            style={active === f.key ? { backgroundColor: f.color + '25', color: f.color, border: `1px solid ${f.color}40` } : {}}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Gráfico */}
      <div className="glass p-5">
        <p className="text-sm text-surface-500 mb-4">{field?.label} — últimas medições</p>
        {loading ? (
          <div className="h-48 flex items-center justify-center text-surface-300 text-sm">Carregando…</div>
        ) : chartData.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2 text-surface-300">
            <Heart size={28} />
            <p className="text-sm">Nenhum dado ainda</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: 'rgb(100,116,139)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'rgb(100,116,139)' }} tickLine={false} axisLine={false} width={35} />
              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid rgb(226,232,240)', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: 'rgb(71,85,105)' }}
                itemStyle={{ color: field?.color }}
              />
              <Line type="monotone" dataKey="v" stroke={field?.color} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tabela recente */}
      {items.length > 0 && (
        <div className="glass overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-200">
            <p className="text-sm font-medium text-surface-600">Histórico recente</p>
          </div>
          <div className="divide-y divide-surface-100">
            {items.slice(0, 10).map((v) => (
              <div key={v.id} className="px-5 py-3 grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                <span className="text-surface-500 col-span-3 md:col-span-1">
                  {format(new Date(v.recordedAt), "dd/MM HH:mm")}
                </span>
                {v.heartRate   && <span><span className="text-surface-400">FC </span>{v.heartRate} bpm</span>}
                {v.systolic    && <span><span className="text-surface-400">PA </span>{v.systolic}/{v.diastolic}</span>}
                {v.oxygenSat   && <span><span className="text-surface-400">SpO₂ </span>{v.oxygenSat}%</span>}
                {v.temperature && <span><span className="text-surface-400">T° </span>{v.temperature}°C</span>}
                {v.glucose     && <span><span className="text-surface-400">Gli </span>{v.glucose} mg/dL</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdd && <AddVitalModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); refetch(); }} />}
    </div>
  );
}
