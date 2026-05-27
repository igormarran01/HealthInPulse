// ─── Triage.jsx ───────────────────────────────────────────────
// Fluxo adaptativo: PROFILE → QUESTION (loop) → RESULT.
// Cada round o backend devolve a próxima pergunta + ranking parcial
// das hipóteses + resumo do que a pulseira Care Plus detectou.

import { useState, useEffect } from 'react';
import { useFetch } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { triageService } from '@/services';
import {
  ClipboardList, ChevronRight, CheckCircle, Sparkles, Coins, Target,
  HelpCircle, Activity, AlertTriangle, Watch, TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import confetti from 'canvas-confetti';

const RISK_CLASS = {
  LOW: 'badge-low', MODERATE: 'badge-moderate',
  HIGH: 'badge-high', CRITICAL: 'badge-critical',
  INCONCLUSIVE: 'inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-surface-100 text-surface-700 border border-surface-200 font-medium',
};
const RISK_LABEL = {
  LOW: 'Baixo', MODERATE: 'Moderado',
  HIGH: 'Alto', CRITICAL: 'Crítico', INCONCLUSIVE: 'Inconclusivo',
};

export function Triage() {
  const { refreshCoins } = useAuth();
  const { data: history, refetch } = useFetch(() => triageService.getHistory({ limit: 5 }));

  const [session, setSession]   = useState(null);   // payload do backend
  const [busy, setBusy]         = useState(false);
  const [profileForm, setProfileForm] = useState({});

  const start = async () => {
    setBusy(true);
    try {
      const { data } = await triageService.start();
      setSession(data);
      setProfileForm({ ...(data.profile || {}) });
    } catch { toast.error('Não foi possível iniciar a triagem'); }
    finally { setBusy(false); }
  };

  const sendProfile = async () => {
    if (!session?.triageId) return;
    setBusy(true);
    try {
      const { data } = await triageService.answer(session.triageId, { profile: profileForm });
      setSession(data);
    } catch { toast.error('Erro ao enviar perfil'); }
    finally { setBusy(false); }
  };

  const answerSymptom = async (value, followUps = null) => {
    if (!session?.triageId || !session?.question) return;
    setBusy(true);
    try {
      const payload = { symptom: session.question.symptom, value };
      if (followUps) payload.followUps = followUps;
      const { data } = await triageService.answer(session.triageId, payload);
      setSession(data);
      if (data.stage === 'RESULT' && data.result?.riskLevel && data.result.riskLevel !== 'INCONCLUSIVE' && !data.redFlag) {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 },
          colors: ['#003F7E', '#00A0DC', '#fbbf24', '#16a34a'] });
        refreshCoins();
        refetch();
      } else if (data.stage === 'RESULT') {
        refetch();
      }
    } catch { toast.error('Erro ao enviar resposta'); }
    finally { setBusy(false); }
  };

  const restart = () => { setSession(null); setProfileForm({}); };

  // ─── Header padrão ───────────────────────────────────────
  const Header = (
    <div>
      <h1 className="font-display text-2xl font-bold flex items-center gap-2">
        <ClipboardList size={22} /> Triagem clínica
      </h1>
      <p className="text-surface-500 text-sm mt-0.5">
        Motor bayesiano com 8 condições + dados da pulseira Care Plus
      </p>
    </div>
  );

  // ─── Tela inicial ────────────────────────────────────────
  if (!session) {
    return (
      <div className="space-y-6 animate-fade-in max-w-2xl">
        {Header}
        <div className="glass p-8 text-center space-y-4">
          <Sparkles size={40} className="text-brand-700 mx-auto" />
          <p className="font-display font-semibold text-lg">Pronto para começar?</p>
          <p className="text-surface-500 text-sm">
            Esta triagem usa dados da sua pulseira + um motor adaptativo
            que escolhe perguntas com maior poder discriminativo. Demora cerca
            de 2 minutos.
          </p>
          <button onClick={start} disabled={busy} className="btn-primary mx-auto">
            {busy ? 'Iniciando…' : 'Iniciar triagem'}
          </button>
        </div>
        {history?.items?.length > 0 && <History items={history.items} />}
      </div>
    );
  }

  // ─── Wearable snapshot (mostrado em todas as etapas) ────────
  const wearableBox = session.wearableSummary?.length ? (
    <div className="glass p-4 border-brand-100 bg-brand-50/30">
      <div className="flex items-center gap-2 text-brand-700 font-medium text-sm mb-2">
        <Watch size={14} /> Sua pulseira Care Plus detectou:
      </div>
      <ul className="text-xs text-surface-700 space-y-1 list-disc list-inside">
        {session.wearableSummary.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    </div>
  ) : null;

  // ─── Etapa: PERFIL ───────────────────────────────────────
  if (session.stage === 'PROFILE') {
    return (
      <div className="space-y-6 animate-fade-in max-w-2xl">
        {Header}
        {wearableBox}
        <div className="glass p-6 space-y-4">
          <p className="font-medium text-surface-800">Confirme seus dados (isso ajusta a probabilidade base)</p>
          <div className="grid grid-cols-2 gap-3">
            {session.schema.map((field) => (
              <ProfileField
                key={field.id}
                field={field}
                value={profileForm[field.field]}
                onChange={(v) => setProfileForm({ ...profileForm, [field.field]: v })}
                visible={!field.showIfField || profileForm[field.showIfField]}
              />
            ))}
          </div>
          <button onClick={sendProfile} disabled={busy} className="btn-primary w-full justify-center">
            {busy ? 'Enviando…' : <>Iniciar perguntas <ChevronRight size={15} /></>}
          </button>
        </div>
      </div>
    );
  }

  // ─── Etapa: PERGUNTA ─────────────────────────────────────
  if (session.stage === 'QUESTION') {
    return (
      <div className="space-y-6 animate-fade-in max-w-2xl">
        {Header}
        {wearableBox}
        <QuestionCard
          session={session}
          busy={busy}
          onAnswer={answerSymptom}
        />
        {session.leaderboard?.length > 0 && (
          <Leaderboard items={session.leaderboard} />
        )}
      </div>
    );
  }

  // ─── Etapa: RESULTADO ────────────────────────────────────
  if (session.stage === 'RESULT') {
    return (
      <div className="space-y-6 animate-fade-in max-w-2xl">
        {Header}
        {session.redFlag ? (
          <RedFlagCard redFlag={session.redFlag} onRestart={restart} />
        ) : (
          <ResultCard result={session.result} onRestart={restart} />
        )}
        {history?.items?.length > 0 && <History items={history.items} />}
      </div>
    );
  }

  return null;
}

// ─── Campo de perfil ─────────────────────────────────────────
function ProfileField({ field, value, onChange, visible }) {
  if (!visible) return null;

  if (field.type === 'boolean') {
    return (
      <div className="col-span-2">
        <p className="text-sm text-surface-700 mb-1">{field.label}</p>
        <div className="flex gap-2">
          {[{ v: true, l: 'Sim' }, { v: false, l: 'Não' }].map((o) => (
            <button key={o.l}
              onClick={() => onChange(o.v)}
              className={`flex-1 py-2 rounded-xl text-sm border ${
                value === o.v ? 'bg-brand-100 border-brand-500 text-brand-600' : 'border-surface-200 text-surface-500 hover:border-surface-300'
              }`}>{o.l}</button>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className="col-span-2">
        <label className="text-sm text-surface-700">{field.label}</label>
        <div className="flex gap-2 mt-1">
          {field.options.map((o) => (
            <button key={o.value}
              onClick={() => onChange(o.value)}
              className={`flex-1 py-2 rounded-xl text-sm border ${
                value === o.value ? 'bg-brand-100 border-brand-500 text-brand-600' : 'border-surface-200 text-surface-500 hover:border-surface-300'
              }`}>{o.label}</button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-sm text-surface-700">{field.label}</label>
      <input
        type="number"
        className="input mt-1"
        min={field.min} max={field.max} step={field.step || 1}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    </div>
  );
}

// ─── Card de pergunta adaptativa ─────────────────────────────
function QuestionCard({ session, busy, onAnswer }) {
  const q = session.question;
  const [followUps, setFollowUps] = useState({});

  useEffect(() => { setFollowUps({}); }, [q?.id]);

  if (!q) return null;
  const progress = session.progress;
  const exp      = session.explanation;

  const triggerSubmit = (value) => {
    if (Array.isArray(q.followUps) && q.followUps.length > 0 && value === 1) {
      // Para tipos com follow-up: precisa coletar todos antes de enviar
      if (q.followUps.every(fu => followUps[fu.id] != null)) {
        const fus = Object.entries(followUps).map(([id, v]) => ({ id, value: v }));
        onAnswer(value, fus);
      }
      return;
    }
    onAnswer(value);
  };

  return (
    <div className="glass p-6 space-y-5">
      <div className="flex gap-1">
        {Array.from({ length: progress.max }).map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
            i < progress.asked ? 'bg-brand-600' : 'bg-surface-100'
          }`} />
        ))}
      </div>
      <p className="text-xs text-surface-400">
        {progress.asked} de até {progress.max} perguntas
        {exp && (
          <span className="ml-2 text-surface-500">
            · IG {exp.ig} · foco: {exp.targetHypothesis} ({exp.targetProb}%)
          </span>
        )}
      </p>

      <div className="space-y-3">
        <p className="font-medium text-surface-800">{q.text}</p>

        {/* Boolean */}
        {q.type === 'boolean' && (
          <div className="flex gap-3">
            {[{ v: 1, l: 'Sim' }, { v: 0, l: 'Não' }].map((o) => (
              <button key={o.l}
                onClick={() => triggerSubmit(o.v)}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-surface-200 hover:bg-brand-50 hover:border-brand-400">
                {o.l}
              </button>
            ))}
          </div>
        )}

        {/* Likert 0-3 */}
        {q.type === 'likert' && (
          <div className="grid grid-cols-2 gap-2">
            {q.options.map((o) => (
              <button key={o.value}
                onClick={() => onAnswer(o.value)}
                disabled={busy}
                className="py-2.5 rounded-xl text-sm border border-surface-200 hover:bg-brand-50 hover:border-brand-400 text-left px-3">
                <span className="text-xs text-surface-400 mr-1">{o.value}</span> {o.label}
              </button>
            ))}
          </div>
        )}

        {/* Follow-ups condicionais */}
        {q.followUps?.length > 0 && (
          <div className="border-t border-surface-100 pt-3 mt-3 space-y-2">
            <p className="text-xs text-surface-500">Se sim, responda também:</p>
            {q.followUps.map((fu) => (
              <div key={fu.id}>
                <p className="text-sm text-surface-700 mb-1">{fu.text}</p>
                <div className="flex gap-2">
                  {[{ v: 1, l: 'Sim' }, { v: 0, l: 'Não' }].map((o) => (
                    <button key={o.l}
                      onClick={() => setFollowUps((f) => ({ ...f, [fu.id]: o.v }))}
                      className={`flex-1 py-2 rounded-xl text-xs border ${
                        followUps[fu.id] === o.v ? 'bg-brand-100 border-brand-500 text-brand-600' : 'border-surface-200 text-surface-500 hover:border-surface-300'
                      }`}>{o.l}</button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={() => triggerSubmit(1)}
              disabled={busy || q.followUps.some(fu => followUps[fu.id] == null)}
              className="btn-primary w-full justify-center mt-2">
              Confirmar respostas
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Leaderboard parcial de hipóteses ─────────────────────
function Leaderboard({ items }) {
  return (
    <div className="glass p-4">
      <p className="text-xs text-surface-500 mb-2 flex items-center gap-1">
        <TrendingUp size={12} /> Hipóteses com maior probabilidade no momento
      </p>
      <div className="space-y-2">
        {items.map((h) => (
          <div key={h.code} className="flex items-center gap-2">
            <span className="text-xs text-surface-700 flex-1 truncate">{h.label}</span>
            <div className="w-32 h-1.5 bg-surface-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500"
                style={{ width: `${Math.round(h.posterior * 100)}%` }}
              />
            </div>
            <span className="text-xs text-surface-500 w-10 text-right">
              {Math.round(h.posterior * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Resultado final ──────────────────────────────────────
function ResultCard({ result, onRestart }) {
  if (!result || !result.riskLevel) {
    return (
      <div className="glass p-8 text-center space-y-3">
        <Sparkles size={36} className="text-brand-700 mx-auto animate-pulse" />
        <p className="font-display font-semibold">Calculando resultado…</p>
      </div>
    );
  }

  if (result.riskLevel === 'INCONCLUSIVE') {
    return (
      <div className="glass p-8 text-center space-y-4">
        <HelpCircle size={40} className="text-surface-400 mx-auto" />
        <p className="font-display font-semibold text-lg">Resultado inconclusivo</p>
        <p className="text-surface-500 text-sm">
          As respostas e os dados da pulseira não foram suficientes para um padrão claro.
        </p>
        <button onClick={onRestart} className="btn-ghost">Refazer triagem</button>
      </div>
    );
  }

  return (
    <div className="glass p-6 space-y-4">
      <div className="text-center">
        <CheckCircle size={36} className="text-green-600 mx-auto" />
        <p className="font-display font-semibold text-lg mt-2">Triagem concluída</p>
        <p className="text-surface-500 text-sm mt-1">
          Risco: <span className={RISK_CLASS[result.riskLevel]}>{RISK_LABEL[result.riskLevel]}</span>
          {result.score != null && (
            <span className="ml-2 text-surface-400">confiança {result.score}%</span>
          )}
        </p>
      </div>

      {result.ranking?.length > 0 && (
        <div>
          <p className="section-title mb-2">Top hipóteses</p>
          <div className="space-y-2">
            {result.ranking.slice(0, 3).map((h) => (
              <div key={h.code} className="flex items-center gap-2">
                <span className="text-sm text-surface-700 flex-1 truncate">{h.label}</span>
                <div className="w-32 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500"
                    style={{ width: `${Math.round(h.posterior * 100)}%` }} />
                </div>
                <span className="text-xs text-surface-500 w-10 text-right">
                  {Math.round(h.posterior * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.scales && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <ScaleChip s={result.scales.stopBang}   label="STOP-BANG" />
          <ScaleChip s={result.scales.phq9}       label="PHQ-9" />
          <ScaleChip s={result.scales.findrisc}   label="FINDRISC" />
          <ScaleChip s={result.scales.framingham} label="Framingham" />
        </div>
      )}

      {result.suggestions?.length > 0 && (
        <div className="space-y-1.5">
          <p className="section-title">Recomendações</p>
          {result.suggestions.map((s, i) => (
            <div key={i} className="text-sm text-surface-700 flex items-start gap-2">
              <span className={
                s.type === 'warning' ? 'text-red-600' :
                s.type === 'action'  ? 'text-amber-600' :
                s.type === 'exam'    ? 'text-brand-600' :
                'text-surface-400'
              }>•</span>
              <span>{s.text}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
          <Coins size={18} className="text-amber-600 mx-auto" />
          <p className="font-display font-bold text-2xl text-amber-700 mt-1">+20</p>
          <p className="text-[10px] uppercase tracking-wider text-amber-700/80">health coins</p>
        </div>
        <Link to="/patient/goals" className="rounded-xl border border-brand-200 bg-brand-50 p-3 hover:bg-brand-100/50 text-center">
          <Target size={18} className="text-brand-700 mx-auto" />
          <p className="font-display font-bold text-2xl text-brand-700 mt-1">Metas</p>
          <p className="text-[10px] uppercase tracking-wider text-brand-700/80">geradas →</p>
        </Link>
      </div>

      <button onClick={onRestart} className="btn-ghost w-full justify-center">
        Nova triagem
      </button>
    </div>
  );
}

function ScaleChip({ s, label }) {
  if (!s) return null;
  return (
    <div className="rounded-lg border border-surface-100 bg-surface-50 p-2">
      <p className="text-[10px] uppercase tracking-wider text-surface-400">{label}</p>
      <p className="text-sm font-semibold text-surface-800">
        {s.score}{s.max ? `/${s.max}` : ''}{' '}
        <span className="text-xs text-surface-500 font-normal">
          ({s.severity || s.risk})
        </span>
      </p>
    </div>
  );
}

// ─── Red flag (interrupção emergencial) ────────────────────
function RedFlagCard({ redFlag, onRestart }) {
  const isEmergency = redFlag.urgency === 'EMERGENCY';
  return (
    <div className={`glass p-6 space-y-3 border-2 ${
      isEmergency ? 'border-red-400 bg-red-50/40' : 'border-amber-400 bg-amber-50/40'
    }`}>
      <div className="flex items-center gap-2">
        <AlertTriangle size={28} className={isEmergency ? 'text-red-600' : 'text-amber-600'} />
        <div>
          <p className={`font-display font-bold ${isEmergency ? 'text-red-700' : 'text-amber-700'}`}>
            {isEmergency ? 'Sinal de emergência detectado' : 'Sinal de alerta urgente'}
          </p>
          <p className="text-sm text-surface-700">{redFlag.label}</p>
        </div>
      </div>
      <div className={`rounded-lg p-3 ${isEmergency ? 'bg-red-100' : 'bg-amber-100'}`}>
        <p className="text-sm font-semibold text-surface-800">
          Ação recomendada: {redFlag.action}
        </p>
      </div>
      <button onClick={onRestart} className="btn-ghost w-full justify-center">
        Iniciar nova triagem
      </button>
    </div>
  );
}

// ─── Histórico ────────────────────────────────────────────
function History({ items }) {
  return (
    <div className="glass p-5">
      <h3 className="section-title mb-3 flex items-center gap-1">
        <Activity size={12} /> Histórico de triagens
      </h3>
      <div className="divide-y divide-surface-100">
        {items.map((t) => (
          <div key={t.id} className="py-3 flex items-center justify-between">
            <p className="text-xs text-surface-500">
              {format(new Date(t.startedAt), 'dd MMM yyyy', { locale: ptBR })}
            </p>
            {t.riskLevel
              ? <span className={RISK_CLASS[t.riskLevel]}>{RISK_LABEL[t.riskLevel]}</span>
              : <span className="text-xs text-surface-400">Processando</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Triage;
