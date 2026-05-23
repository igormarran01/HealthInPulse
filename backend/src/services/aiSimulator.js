// Simulador local de IA — usado quando OPENAI_API_KEY não está configurada.
// Determinístico (mesma entrada → mesma saída de palavra-chave) com pequena variação
// para que a triagem pareça realista em apresentações offline.

const KEYWORDS_RED = [
  'dor no peito', 'dor de peito', 'pressão no peito',
  'falta de ar grave', 'dispneia', 'sufoco',
  'sangramento', 'tontura forte', 'desmaio',
  'paralisia', 'fala enrolada',
];
const KEYWORDS_YELLOW = [
  'febre', 'náusea', 'vômito', 'tontura',
  'dor de cabeça', 'cefaleia', 'fraqueza',
  'cansaço', 'fadiga', 'palpitação',
];

const includesAny = (text, list) => {
  const t = (text || '').toLowerCase();
  return list.some((kw) => t.includes(kw));
};

const flatten = (answers) => {
  if (!Array.isArray(answers)) return '';
  return answers.map((a) => (typeof a === 'object' ? Object.values(a).join(' ') : String(a))).join(' ').toLowerCase();
};

const detectSymptomLevel = (answers) => {
  const text = flatten(answers);
  if (!text.trim() || text.length < 8) return 'INCONCLUSIVE';
  if (includesAny(text, KEYWORDS_RED))    return 'HIGH';
  if (includesAny(text, KEYWORDS_YELLOW)) return 'MODERATE';
  return 'LOW';
};

const buildSuggestions = (level) => {
  if (level === 'HIGH') return [
    { type: 'action',  text: 'Procurar atendimento médico em até 24h' },
    { type: 'warning', text: 'Caso piore, ir a um pronto-socorro imediatamente' },
    { type: 'info',    text: 'Manter monitoramento contínuo via pulseira Care Plus' },
  ];
  if (level === 'MODERATE') return [
    { type: 'action',  text: 'Agendar consulta de retorno em 7 dias' },
    { type: 'info',    text: 'Aumentar hidratação e descanso' },
    { type: 'info',    text: 'Acompanhar evolução via pulseira Care Plus' },
  ];
  if (level === 'LOW') return [
    { type: 'info',    text: 'Sinais clínicos dentro do esperado' },
    { type: 'info',    text: 'Manter rotina e hábitos saudáveis' },
  ];
  // INCONCLUSIVE
  return [
    { type: 'info',    text: 'Respostas insuficientes para fechar um padrão clínico' },
    { type: 'action',  text: 'Refazer a triagem em 3–7 dias com mais detalhes' },
    { type: 'info',    text: 'Continuar monitorando os sinais vitais via pulseira' },
  ];
};

const buildSummary = (level, patientContext) => {
  const name = patientContext?.fullName?.split(' ')[0] || 'O paciente';
  if (level === 'HIGH') {
    return `${name} apresentou sintomas com sinais de alerta que requerem avaliação médica rápida. A combinação relatada sugere possível quadro agudo.`;
  }
  if (level === 'MODERATE') {
    return `${name} reportou sintomas leves a moderados, sem sinais de gravidade no momento. Recomenda-se observação clínica e nova avaliação se persistirem.`;
  }
  if (level === 'LOW') {
    return `${name} não apresentou sintomas relevantes na triagem. Continuar o monitoramento de rotina.`;
  }
  return `As respostas fornecidas não foram suficientes para uma análise conclusiva. Recomenda-se uma nova triagem com mais detalhes.`;
};

const scoreFromLevel = (level) => {
  if (level === 'HIGH')         return 78 + Math.floor(Math.random() * 12);
  if (level === 'MODERATE')     return 45 + Math.floor(Math.random() * 25);
  if (level === 'LOW')          return 15 + Math.floor(Math.random() * 20);
  return null;
};

const urgencyFromLevel = (level) => ({
  HIGH:         'urgente',
  MODERATE:     'consultar em breve',
  LOW:          'pode aguardar',
  INCONCLUSIVE: 'sem urgência definida',
}[level]);

const analyzeTriage = (answers, patientContext) => {
  const level = detectSymptomLevel(answers);
  return {
    riskLevel:   level,
    score:       scoreFromLevel(level),
    summary:     buildSummary(level, patientContext),
    suggestions: buildSuggestions(level),
    urgency:     urgencyFromLevel(level),
  };
};

module.exports = { analyzeTriage };
