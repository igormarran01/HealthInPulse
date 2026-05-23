import { useState } from 'react';
import { useFetch, useAsync } from '@/hooks';
import { aiReportService, doctorService } from '@/services';
import PatientSelector from './PatientSelector';
import { FileText, Brain, Loader, Sparkles, AlertCircle, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

const RISK_CLASS = { LOW:'badge-low', MODERATE:'badge-moderate', HIGH:'badge-high', CRITICAL:'badge-critical' };
const RISK_LABEL = { LOW:'Baixo', MODERATE:'Moderado', HIGH:'Alto', CRITICAL:'Crítico', INCONCLUSIVE:'Inconclusivo' };

function ReportModal({ report, onClose }) {
  if (!report) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-sm">
      <div className="glass p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-semibold text-lg capitalize">
              {report.type === 'full' ? 'Relatório completo' : `Análise ${report.type}`}
            </h3>
            <p className="text-xs text-surface-500">
              {format(new Date(report.generatedAt), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1">✕</button>
        </div>
        {report.riskLevel && (
          <span className={`${RISK_CLASS[report.riskLevel]} mb-4 inline-block`}>
            Risco {RISK_LABEL[report.riskLevel]}
          </span>
        )}
        <div className="text-sm text-surface-700 leading-relaxed whitespace-pre-wrap font-sans">
          {report.content}
        </div>
        {report.suggestions?.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wide">Recomendações</p>
            {report.suggestions.map((s, i) => (
              <div key={i} className="glass p-3 text-sm text-surface-700">{s.text}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DoctorReports() {
  const [patientId, setPatientId] = useState(null);
  const [detail, setDetail] = useState(null);

  const { data: consolidated, loading, refetch } = useFetch(
    () => patientId ? doctorService.getConsolidated(patientId) : Promise.resolve({ data: null }),
    [patientId],
  );

  const { run: generate, loading: generating } = useAsync(() => aiReportService.generate(patientId));

  const reports = consolidated?.aiReports || [];

  const handleGenerate = async () => {
    try {
      const { data: r } = await generate();
      toast.success('Síntese gerada!');
      setDetail(r);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao gerar síntese');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-xs uppercase tracking-widest text-surface-400 font-medium">Análise clínica</p>
        <h1 className="font-display text-2xl md:text-3xl font-bold mt-1 flex items-center gap-3">
          <Brain size={26} className="text-brand-700" />
          Relatórios
        </h1>
        <p className="text-sm text-surface-500 mt-2 max-w-2xl">
          Síntese clínica automática baseada nos dados da pulseira, exames e triagens recentes do paciente.
        </p>
      </div>

      <PatientSelector value={patientId} onChange={setPatientId} />

      {patientId && (
        <div className="glass p-5 flex flex-col md:flex-row items-start md:items-center gap-4 bg-gradient-to-br from-white to-brand-50/40">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="font-display font-semibold text-surface-900">Gerar nova síntese</p>
              <p className="text-xs text-surface-500">A IA consolida vitais (30d), exames e triagens em um relatório completo.</p>
            </div>
          </div>
          <button onClick={handleGenerate} disabled={generating} className="btn-primary">
            {generating
              ? <><Loader size={14} className="animate-spin" /> Gerando…</>
              : <><Brain size={14} /> Gerar síntese</>}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="glass h-16 animate-pulse bg-surface-100" />)}
        </div>
      ) : !patientId ? (
        <div className="glass p-10 text-center text-surface-400">
          <AlertCircle size={28} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Selecione um paciente acima</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="glass p-10 text-center text-surface-400">
          <FileText size={28} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum relatório gerado ainda para este paciente</p>
        </div>
      ) : (
        <section>
          <h2 className="section-title mb-3">Histórico de relatórios</h2>
          <div className="space-y-2">
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setDetail(r)}
                className="glass card-hover p-4 w-full flex items-center gap-4 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-700 shrink-0">
                  <Brain size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-800 capitalize">
                    {r.type === 'full' ? 'Relatório completo' : `Análise ${r.type}`}
                  </p>
                  <p className="text-xs text-surface-500">
                    {format(new Date(r.generatedAt), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                {r.riskLevel && <span className={RISK_CLASS[r.riskLevel]}>{RISK_LABEL[r.riskLevel]}</span>}
                <ChevronRight size={14} className="text-surface-300" />
              </button>
            ))}
          </div>
        </section>
      )}

      <ReportModal report={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
