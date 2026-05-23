import {
  BookOpen, Thermometer, Heart, Droplets, Activity,
  AlertCircle, Info, ExternalLink,
} from 'lucide-react';

// Base clínica extraída do livro de referência usado no projeto.
// Documentado em /Docs/Dados do Livro.docx
const REFERENCES = [
  {
    id:        'temperature',
    icon:      Thermometer,
    color:     '#d97706',
    title:     'Temperatura corporal',
    normal:    '37,0 °C',
    range:     'até 37,4 °C',
    alert:     '≥ 37,5 °C indica febre na prática clínica',
    chapter:   'Capítulo 74',
    pages:     ['p. 53 (tabela de valores normais)', 'p. 2626 (capítulo sobre controle térmico e febre)'],
    notes:     'O livro reforça 37,0 °C como valor normal. A definição prática de febre varia entre 37,5–38 °C.',
  },
  {
    id:        'heartRate',
    icon:      Heart,
    color:     '#dc2626',
    title:     'Frequência cardíaca',
    normal:    '60 a 100 bpm',
    range:     '72 bpm (exemplo fisiológico padrão)',
    alert:     '> 100 bpm = taquicardia · < 60 bpm = bradicardia',
    chapter:   'Cap. fisiologia cardiovascular',
    pages:     ['p. 357–358 (exemplo fisiológico de 72 bpm)', 'p. 413 (referência adicional)', 'p. 474–475 (definição de taquicardia/bradicardia)'],
    notes:     '72 bpm é usado como exemplo, não como limite fixo. Os limites clínicos são 60 e 100 bpm em adultos.',
  },
  {
    id:        'oxygenSat',
    icon:      Droplets,
    color:     '#003F7E',
    title:     'Saturação de O₂',
    normal:    '95% a 99%',
    range:     '98% (valor de referência arterial)',
    alert:     '< 95% requer atenção clínica',
    chapter:   'Cap. gases sanguíneos / hemoglobina',
    pages:     ['p. 3135 (tabela de gases sanguíneos: SatO₂ arterial 98%, faixa 95–99%)', 'p. 1480 e 1647 (saturação da hemoglobina com O₂)'],
    notes:     'Saturações abaixo de 95% podem indicar comprometimento respiratório, mesmo sem sintomas evidentes.',
  },
  {
    id:        'movement',
    icon:      Activity,
    color:     '#00A0DC',
    title:     'Movimento',
    normal:    '—',
    range:     'sem critério quantitativo no livro',
    alert:     'regra de inatividade definida pelo sistema',
    chapter:   'Contexto fisiológico e neuromuscular',
    pages:     ['(referências fisiológicas dispersas, sem regra de negócio pronta)'],
    notes:     'O livro discute movimento em contexto neuromuscular, sem definir uma regra do tipo "sem movimento por X minutos". A regra de inatividade fica a critério do HealthInPulse — ex: alerta após 4h sem variação significativa.',
  },
];

function RefCard({ item }) {
  const Icon = item.icon;
  return (
    <div className="glass card-hover p-5">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: item.color + '18' }}>
          <Icon size={20} style={{ color: item.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-lg text-surface-900 leading-tight">{item.title}</h3>
          <p className="text-xs text-surface-500 mt-0.5">{item.chapter}</p>
        </div>
      </div>

      {/* Valores */}
      <div className="grid grid-cols-3 gap-3 mt-5">
        <div className="rounded-xl bg-surface-50 border border-surface-200 p-3">
          <p className="text-[10px] uppercase tracking-wide text-surface-400 font-semibold">Valor normal</p>
          <p className="font-display font-bold text-base text-surface-900 mt-1">{item.normal}</p>
        </div>
        <div className="rounded-xl bg-surface-50 border border-surface-200 p-3">
          <p className="text-[10px] uppercase tracking-wide text-surface-400 font-semibold">Faixa / referência</p>
          <p className="text-sm font-medium text-surface-800 mt-1">{item.range}</p>
        </div>
        <div className="rounded-xl border p-3" style={{ backgroundColor: item.color + '0F', borderColor: item.color + '40' }}>
          <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: item.color }}>Atenção clínica</p>
          <p className="text-sm font-medium mt-1" style={{ color: item.color }}>{item.alert}</p>
        </div>
      </div>

      {/* Páginas */}
      <div className="mt-5">
        <p className="text-[10px] uppercase tracking-wide text-surface-400 font-semibold mb-2">Referências no livro</p>
        <ul className="space-y-1">
          {item.pages.map((p, i) => (
            <li key={i} className="text-xs text-surface-600 flex items-start gap-2">
              <span className="text-surface-300 mt-[1px]">•</span> {p}
            </li>
          ))}
        </ul>
      </div>

      {/* Observação */}
      <div className="mt-4 pt-4 border-t border-surface-100 flex items-start gap-2">
        <Info size={13} className="text-surface-400 shrink-0 mt-[3px]" />
        <p className="text-xs text-surface-600 leading-relaxed">{item.notes}</p>
      </div>
    </div>
  );
}

export default function DoctorReference() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-surface-400 font-medium">Manual clínico</p>
          <h1 className="font-display text-2xl md:text-3xl font-bold mt-1 flex items-center gap-3">
            <BookOpen size={26} className="text-brand-700" />
            Base de Referência
          </h1>
          <p className="text-sm text-surface-500 mt-2 max-w-2xl">
            Valores fisiológicos de referência extraídos do livro-base do HealthInPulse.
            Estes parâmetros sustentam as regras de atenção e alertas clínicos do sistema.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-brand-700 bg-brand-50 px-3 py-2 rounded-full border border-brand-200">
          <BookOpen size={13} /> Livro de fisiologia · referência interna
        </div>
      </div>

      {/* Cards */}
      <div className="grid lg:grid-cols-2 gap-4">
        {REFERENCES.map((r) => <RefCard key={r.id} item={r} />)}
      </div>

      {/* Observações gerais */}
      <div className="glass p-5 bg-amber-50/30 border-amber-200">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <AlertCircle size={16} className="text-amber-700" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-semibold text-surface-900 mb-2">Observações importantes</h3>
            <ul className="space-y-2 text-sm text-surface-700 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold mt-[1px]">›</span>
                O valor de <strong>72 bpm</strong> é usado como exemplo fisiológico padrão, não como limite fixo.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold mt-[1px]">›</span>
                A saturação de O₂ abaixo de <strong>95%</strong> já pode indicar atenção clínica.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold mt-[1px]">›</span>
                Para temperatura, o livro reforça <strong>37 °C</strong> como normal, mas a definição prática de febre varia (≥ 37,5–38 °C).
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold mt-[1px]">›</span>
                Movimento não possui critério quantitativo direto no livro. O sistema deve definir regras próprias (ex: inatividade prolongada).
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer informativo */}
      <div className="text-center text-xs text-surface-400">
        Esta página é a fonte de verdade clínica do HealthInPulse. Os limites usados no dashboard dos pacientes derivam destes parâmetros.
      </div>
    </div>
  );
}
