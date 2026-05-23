// ─── Triage.jsx ───────────────────────────────────────────────
import { useState } from 'react';
import { useFetch, useAsync } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { triageService } from '@/services';
import { ClipboardList, ChevronRight, ChevronLeft, CheckCircle, Sparkles, Coins, Target, HelpCircle } from 'lucide-react';
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
  const { data: qs, loading: loadingQ } = useFetch(triageService.getQuestions);
  const { data: history, refetch }      = useFetch(() => triageService.getHistory({ limit: 5 }));
  const { run, loading } = useAsync(triageService.submit);

  const questions = qs || [];
  const [step,    setStep]    = useState(0);
  const [answers, setAnswers] = useState({});
  const [result,  setResult]  = useState(null); // { triage, polling }

  const q        = questions[step];
  const answer   = answers[q?.id] || '';
  const isLast   = step === questions.length - 1;

  const setAnswer = (v) => setAnswers((a) => ({ ...a, [q.id]: v }));

  const pollUntilDone = async (triageId, tries = 10) => {
    for (let i = 0; i < tries; i++) {
      await new Promise((r) => setTimeout(r, 800));
      try {
        const { data: t } = await triageService.getOne(triageId);
        if (t.status === 'COMPLETED' || t.riskLevel) {
          return t;
        }
      } catch (_) {}
    }
    return null;
  };

  const submit = async () => {
    const payload = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
    try {
      const { data } = await run(payload);
      toast.success('Triagem enviada! Analisando…');
      setResult({ triage: data?.triage || data, polling: true });
      // Aguarda IA processar
      const completed = await pollUntilDone(data?.triage?.id || data?.id);
      if (completed) {
        setResult({ triage: completed, polling: false });
        if (completed.riskLevel && completed.riskLevel !== 'INCONCLUSIVE') {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.5 },
            colors: ['#003F7E', '#00A0DC', '#fbbf24', '#16a34a'],
          });
        }
        refreshCoins();
        refetch();
      } else {
        setResult({ triage: data?.triage || data, polling: false });
      }
    } catch { toast.error('Erro ao enviar triagem'); }
  };

  const restart = () => {
    setResult(null);
    setStep(0);
    setAnswers({});
  };

  if (loadingQ) return <div className="text-surface-400 text-sm p-8 text-center">Carregando perguntas…</div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-lg">
      <div>
        <h1 className="font-display text-2xl font-bold">Triagem</h1>
        <p className="text-surface-500 text-sm mt-0.5">Responda para uma avaliação de risco com IA</p>
      </div>

      {result ? (
        result.polling || !result.triage?.riskLevel ? (
          <div className="glass p-8 text-center space-y-3">
            <Sparkles size={36} className="text-brand-700 mx-auto animate-pulse" />
            <p className="font-display font-semibold">Analisando suas respostas…</p>
            <p className="text-surface-500 text-sm">A IA está consolidando o resultado.</p>
          </div>
        ) : result.triage.riskLevel === 'INCONCLUSIVE' ? (
          <div className="glass p-8 text-center space-y-4 max-w-xl">
            <HelpCircle size={40} className="text-surface-400 mx-auto" />
            <div>
              <p className="font-display font-semibold text-lg">Resultado inconclusivo</p>
              <p className="text-surface-500 text-sm mt-2">
                As respostas fornecidas não foram suficientes para um padrão clínico claro.
                Não significa que algo está errado — apenas que precisamos de mais informações.
              </p>
            </div>
            <div className="glass p-3 bg-amber-50/40 border-amber-200 text-sm text-amber-700">
              <Coins size={14} className="inline -mt-0.5" /> Você ainda ganhou <b>+20 coins</b> por completar a triagem
            </div>
            <button onClick={restart} className="btn-ghost">
              Refazer triagem
            </button>
          </div>
        ) : (
          <div className="glass p-8 text-center space-y-4 max-w-xl">
            <CheckCircle size={40} className="text-green-600 mx-auto" />
            <div>
              <p className="font-display font-semibold text-lg">Triagem concluída!</p>
              <p className="text-surface-500 text-sm mt-1">
                Risco classificado como <span className={RISK_CLASS[result.triage.riskLevel]}>{RISK_LABEL[result.triage.riskLevel]}</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <Coins size={18} className="text-amber-600 mx-auto" />
                <p className="font-display font-bold text-2xl text-amber-700 mt-1">+20</p>
                <p className="text-[10px] uppercase tracking-wider text-amber-700/80">health coins</p>
              </div>
              <Link to="/patient/goals" className="rounded-xl border border-brand-200 bg-brand-50 p-3 hover:bg-brand-100/50 transition-colors">
                <Target size={18} className="text-brand-700 mx-auto" />
                <p className="font-display font-bold text-2xl text-brand-700 mt-1">Novas</p>
                <p className="text-[10px] uppercase tracking-wider text-brand-700/80">metas geradas →</p>
              </Link>
            </div>
            <button onClick={restart} className="btn-ghost">
              Nova triagem
            </button>
          </div>
        )
      ) : (
        <div className="glass p-6 space-y-5">
          {/* Progress */}
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? 'bg-brand-600' : 'bg-surface-100'}`} />
            ))}
          </div>
          <p className="text-xs text-surface-400">{step + 1} de {questions.length}</p>

          {q && (
            <div className="space-y-4">
              <p className="font-medium text-surface-800">{q.text}</p>

              {q.type === 'text' && (
                <textarea
                  className="input h-24 resize-none"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Descreva…"
                />
              )}
              {q.type === 'boolean' && (
                <div className="flex gap-3">
                  {['Sim', 'Não'].map((v) => (
                    <button key={v} onClick={() => setAnswer(v)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        answer === v ? 'bg-brand-100 border-brand-500 text-brand-600' : 'border-surface-200 text-surface-500 hover:border-surface-300'
                      }`}>{v}</button>
                  ))}
                </div>
              )}
              {q.type === 'select' && (
                <div className="space-y-2">
                  {q.options?.map((v) => (
                    <button key={v} onClick={() => setAnswer(v)}
                      className={`w-full py-2.5 px-4 rounded-xl text-sm text-left border transition-all ${
                        answer === v ? 'bg-brand-100 border-brand-500 text-brand-600' : 'border-surface-200 text-surface-500 hover:border-surface-300'
                      }`}>{v}</button>
                  ))}
                </div>
              )}
              {q.type === 'scale' && (
                <div className="flex gap-1.5">
                  {[...Array(11)].map((_, i) => (
                    <button key={i} onClick={() => setAnswer(String(i))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                        answer === String(i) ? 'bg-brand-600 text-surface-900' : 'bg-surface-50 text-surface-500 hover:bg-surface-100'
                      }`}>{i}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="btn-ghost">
                <ChevronLeft size={15} />
              </button>
            )}
            <button
              onClick={() => isLast ? submit() : setStep(s => s + 1)}
              disabled={!answer || loading}
              className="btn-primary flex-1 justify-center"
            >
              {loading ? 'Enviando…' : isLast ? 'Finalizar' : <>Próximo <ChevronRight size={15} /></>}
            </button>
          </div>
        </div>
      )}

      {/* Histórico */}
      {history?.items?.length > 0 && (
        <div className="glass p-5">
          <h3 className="section-title mb-3">Histórico de Triagens</h3>
          <div className="divide-y divide-surface-100">
            {history.items.map((t) => (
              <div key={t.id} className="py-3 flex items-center justify-between">
                <p className="text-xs text-surface-500">
                  {format(new Date(t.startedAt), "dd MMM yyyy", { locale: ptBR })}
                </p>
                {t.riskLevel
                  ? <span className={RISK_CLASS[t.riskLevel]}>{RISK_LABEL[t.riskLevel]}</span>
                  : <span className="text-xs text-surface-400">Processando</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
export default Triage;
