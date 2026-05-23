// Reports.jsx
import { useFetch } from '@/hooks';
import { aiReportService } from '@/services';
import { Brain, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

const RISK_CLASS = { LOW: 'badge-low', MODERATE: 'badge-moderate', HIGH: 'badge-high', CRITICAL: 'badge-critical' };
const RISK_LABEL = { LOW: 'Baixo', MODERATE: 'Moderado', HIGH: 'Alto', CRITICAL: 'Crítico' };

function ReportModal({ report, onClose }) {
  if (!report) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-sm">
      <div className="glass p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-lg capitalize">{report.type}</h3>
          <button onClick={onClose} className="btn-ghost p-1">✕</button>
        </div>
        {report.riskLevel && (
          <span className={`${RISK_CLASS[report.riskLevel]} mb-4 inline-block`}>
            Risco {RISK_LABEL[report.riskLevel]}
          </span>
        )}
        <div className="prose prose-invert prose-sm max-w-none text-surface-600 leading-relaxed whitespace-pre-wrap font-sans text-sm">
          {report.content}
        </div>
        {report.suggestions?.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wide">Recomendações</p>
            {report.suggestions.map((s, i) => (
              <div key={i} className="glass p-3 text-sm text-surface-600">{s.text}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Reports() {
  const { data, loading } = useFetch(() => aiReportService.list({ limit: 20 }));
  const [selected, setSelected] = useState(null);

  const [detail, setDetail] = useState(null);
  const openReport = async (r) => {
    const { data: d } = await aiReportService.getOne(r.id);
    setDetail(d);
  };

  const reports = data?.items || [];
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Relatórios IA</h1>
        <p className="text-surface-500 text-sm mt-0.5">Análises geradas pela inteligência artificial</p>
      </div>
      <div className="space-y-2">
        {loading && <p className="text-surface-400 text-sm text-center py-8">Carregando…</p>}
        {!loading && reports.length === 0 && (
          <div className="glass p-8 text-center text-surface-400 text-sm">
            <Brain size={28} className="mx-auto mb-2 opacity-30" />
            Nenhum relatório gerado ainda
          </div>
        )}
        {reports.map((r) => (
          <button key={r.id} onClick={() => openReport(r)} className="glass p-4 w-full flex items-center gap-4 hover:border-brand-200 transition-all text-left">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
              <Brain size={18} className="text-brand-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium capitalize">{r.type === 'full' ? 'Relatório Completo' : r.type}</p>
              <p className="text-xs text-surface-500">{format(new Date(r.generatedAt), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}</p>
            </div>
            {r.riskLevel && <span className={RISK_CLASS[r.riskLevel]}>{RISK_LABEL[r.riskLevel]}</span>}
            <ChevronRight size={14} className="text-surface-300" />
          </button>
        ))}
      </div>
      <ReportModal report={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
export default Reports;
