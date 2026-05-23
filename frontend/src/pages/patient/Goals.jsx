import { useState, useRef } from 'react';
import { useFetch, useAsync } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { goalService } from '@/services';
import { Target, Coins, CheckCircle2, TrendingUp, Heart, Droplets, Activity, Footprints, Moon, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

const METRIC_ICON = {
  heartRate: Heart,
  systolic:  Activity,
  glucose:   Droplets,
  spo2:      Droplets,
  steps:     Footprints,
  weight:    TrendingUp,
  custom:    Sparkles,
};

const METRIC_UNIT = {
  heartRate: 'bpm', systolic: 'mmHg', glucose: 'mg/dL',
  spo2: '%', steps: 'passos/dia', weight: 'kg', custom: '',
};

function GoalCard({ goal, onProgress, justCompleted }) {
  const Icon = METRIC_ICON[goal.metric] || Sparkles;
  const unit = METRIC_UNIT[goal.metric] || '';
  const isDone = goal.status === 'DONE';
  const pct = Math.round(goal.progress || 0);

  const targetText = (() => {
    if (goal.targetCmp === 'lte' && goal.targetValue != null) return `máx ${goal.targetValue} ${unit}`.trim();
    if (goal.targetCmp === 'gte' && goal.targetValue != null) return `mín ${goal.targetValue} ${unit}`.trim();
    if (goal.targetCmp === 'between' && goal.rangeMin != null && goal.rangeMax != null)
      return `entre ${goal.rangeMin} e ${goal.rangeMax} ${unit}`.trim();
    return '';
  })();

  return (
    <div className={`glass card-hover p-5 ${isDone ? 'border-green-200 bg-green-50/40' : ''} ${justCompleted ? 'ring-2 ring-brand-300 ring-offset-2' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isDone ? 'bg-green-100 text-green-700' : 'bg-brand-50 text-brand-700'
        }`}>
          {isDone ? <CheckCircle2 size={18} /> : <Icon size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-surface-900 leading-tight">{goal.title}</h3>
          {goal.description && (
            <p className="text-xs text-surface-500 mt-1">{goal.description}</p>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
          <Coins size={11} /> {goal.coinsReward}
        </span>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-surface-500">
            {isDone ? 'Concluída' : `Progresso · ${pct}%`}
          </span>
          {targetText && <span className="text-xs text-surface-500">{targetText}</span>}
        </div>
        <div className="w-full h-2 rounded-full bg-surface-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              isDone ? 'bg-green-500' : pct >= 80 ? 'bg-brand-700' : 'bg-accent-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {goal.current != null && !isDone && (
          <p className="text-xs text-surface-500 mt-2">
            Atual: <span className="font-semibold text-surface-700">{goal.current} {unit}</span>
          </p>
        )}
      </div>

      {!isDone && onProgress && (
        <div className="mt-4 pt-4 border-t border-surface-100 flex items-center gap-2">
          <button
            onClick={() => onProgress(goal)}
            className="text-xs font-medium text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
          >
            Atualizar progresso →
          </button>
        </div>
      )}
    </div>
  );
}

function UpdateModal({ goal, onClose, onSaved }) {
  const [value, setValue] = useState(goal.current ?? '');
  const { run, loading } = useAsync(goalService.updateProgress);

  const submit = async (e) => {
    e.preventDefault();
    const v = Number(value);
    if (Number.isNaN(v)) return toast.error('Informe um número válido');
    try {
      const { data } = await run(goal.id, v);
      onSaved(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/30 backdrop-blur-sm">
      <div className="glass p-6 w-full max-w-sm animate-slide-up">
        <h3 className="font-display font-semibold text-lg mb-1">Atualizar progresso</h3>
        <p className="text-sm text-surface-500 mb-4">{goal.title}</p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Valor atual {METRIC_UNIT[goal.metric] && `(${METRIC_UNIT[goal.metric]})`}</label>
            <input className="input" type="number" step="0.1" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </div>
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

export default function PatientGoals() {
  const { refreshCoins } = useAuth();
  const { data, loading, refetch } = useFetch(goalService.list);
  const [editing, setEditing] = useState(null);
  const justCompletedRef = useRef(null);

  const goals = Array.isArray(data) ? data : [];
  const active    = goals.filter((g) => g.status === 'ACTIVE');
  const completed = goals.filter((g) => g.status === 'DONE');

  const totalProgress = active.length
    ? Math.round(active.reduce((acc, g) => acc + (g.progress || 0), 0) / active.length)
    : 0;

  const onSaved = ({ goal, justCompleted }) => {
    setEditing(null);
    if (justCompleted) {
      justCompletedRef.current = goal.id;
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.5 },
        colors: ['#003F7E', '#00A0DC', '#fbbf24', '#16a34a'],
      });
      toast.success(`Meta concluída! +${goal.coinsReward} coins`);
      refreshCoins();
    } else {
      toast.success('Progresso atualizado');
    }
    refetch();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="glass p-6 flex flex-col md:flex-row items-start md:items-center gap-6 bg-gradient-to-br from-white to-brand-50/40">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest text-surface-400 font-medium">Minhas metas</p>
          <h1 className="font-display text-2xl md:text-3xl font-bold mt-1 flex items-center gap-3">
            <Target size={26} className="text-brand-700" />
            Metas de saúde
          </h1>
          <p className="text-sm text-surface-500 mt-2 max-w-xl">
            Metas personalizadas geradas pela sua triagem. Cada meta concluída rende health-coins
            que você pode trocar por benefícios no menu de Recompensas.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="font-display font-bold text-3xl text-brand-700 leading-none">{active.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mt-1">ativas</p>
          </div>
          <div className="w-px h-10 bg-surface-200" />
          <div className="text-center">
            <p className="font-display font-bold text-3xl text-green-600 leading-none">{completed.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mt-1">concluídas</p>
          </div>
          <div className="w-px h-10 bg-surface-200" />
          <div className="text-center">
            <p className="font-display font-bold text-3xl text-accent-700 leading-none">{totalProgress}%</p>
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mt-1">progresso médio</p>
          </div>
        </div>
      </div>

      {/* Metas ativas */}
      <section>
        <h2 className="section-title mb-3">Em andamento</h2>
        {loading ? (
          <div className="grid md:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="glass h-44 animate-pulse bg-surface-100" />)}
          </div>
        ) : active.length === 0 ? (
          <div className="glass p-8 text-center text-surface-400">
            <Target size={28} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma meta ativa. Faça uma triagem para gerar metas personalizadas.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {active.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onProgress={(goal) => setEditing(goal)}
                justCompleted={justCompletedRef.current === g.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Concluídas */}
      {completed.length > 0 && (
        <section>
          <h2 className="section-title mb-3">Concluídas</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {completed.map((g) => <GoalCard key={g.id} goal={g} />)}
          </div>
        </section>
      )}

      {editing && (
        <UpdateModal goal={editing} onClose={() => setEditing(null)} onSaved={onSaved} />
      )}
    </div>
  );
}
