// ─── Banco de perguntas adaptativo ──────────────────────────────────
// Cada pergunta liga a 1 sintoma da matriz. Tipo, opções, custo (1-5 —
// quanto mais íntima/desconfortável, maior o custo), follow-ups condicionais
// e mensagem opcional explicando por que perguntamos.
//
// Perguntas demográficas + RED-FLAG entram primeiro (não custam IG).
// PHQ-9, STOP-BANG e FINDRISC têm itens marcados com scaleTag para que o
// service consiga, depois, calcular as escalas com as mesmas respostas.

const { S } = require('./matrix');

// ─── Demografia (sempre coletada antes de tudo) ─────────────────────
const DEMOGRAPHIC_QUESTIONS = [
  { id: 'age',          field: 'age',          type: 'number', label: 'Qual a sua idade?', min: 0, max: 120, required: true },
  { id: 'sex',          field: 'sex',          type: 'select', label: 'Sexo biológico',
    options: [{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Feminino' }], required: true },
  { id: 'height',       field: 'height',       type: 'number', label: 'Altura (cm)', min: 100, max: 230, step: 1, required: true },
  { id: 'weight',       field: 'weight',       type: 'number', label: 'Peso (kg)',  min: 30,  max: 250, step: 0.1, required: true },
  { id: 'familyHistoryDm', field: 'familyHistoryDm', type: 'boolean',
    label: 'Tem histórico familiar de diabetes (pais ou irmãos)?' },
  { id: 'familyHistoryCv', field: 'familyHistoryCv', type: 'boolean',
    label: 'Tem histórico familiar de IAM ou AVC antes dos 60 anos em parente de 1º grau?' },
  { id: 'smoker',       field: 'smoker',       type: 'boolean', label: 'Você fuma ou já fumou regularmente?' },
  { id: 'packYears',    field: 'packYears',    type: 'number',  label: 'Maços-ano (média de maços/dia × anos de tabagismo)',
    min: 0, max: 100, step: 0.5,
    showIf: (p) => p.smoker === true || p.smoker === 'true' || p.smoker === 1 },
];

// ─── Perguntas vinculadas a sintomas (alimentam o motor) ────────────
const SYMPTOM_QUESTIONS = [
  // ── Apneia do sono / sono
  q(S.RONCO_ALTO, 'Você ronca alto a ponto de ser ouvido fora do quarto?', 'boolean', { cost: 1, scaleTag: 'stop-bang' }),
  q(S.APNEIA_OBSERVADA, 'Alguém já observou você parar de respirar durante o sono?', 'boolean', { cost: 2, scaleTag: 'stop-bang' }),
  q(S.FADIGA_DIURNA, 'Sente-se frequentemente cansado(a) ou sonolento(a) durante o dia?', 'boolean', { cost: 1, scaleTag: 'stop-bang' }),
  q(S.CEFALEIA_MATINAL, 'Acorda com dor de cabeça pela manhã com frequência?', 'boolean', { cost: 1 }),
  q(S.PESCOCO_LARGO, 'Sua circunferência do pescoço é maior que 40 cm (homens) ou 35 cm (mulheres)?', 'boolean', { cost: 2, scaleTag: 'stop-bang' }),
  q(S.PALPITACOES_NOTURNAS, 'Tem palpitações durante o sono?', 'boolean', { cost: 1 }),

  // ── Cardiovascular
  q(S.HAS_CONHECIDA, 'Você tem diagnóstico de pressão alta (hipertensão)?', 'boolean', { cost: 1, scaleTag: 'stop-bang' }),
  q(S.DIABETES_DX, 'Você tem diagnóstico de diabetes?', 'boolean', { cost: 1, scaleTag: 'framingham' }),
  q(S.TABAGISMO, 'Você fuma atualmente?', 'boolean', { cost: 1, scaleTag: 'framingham' }),
  q(S.COLESTEROL_ALTO, 'Já recebeu diagnóstico de colesterol alto?', 'boolean', { cost: 1, scaleTag: 'framingham' }),
  q(S.HIST_FAM_CV, 'Histórico familiar de infarto ou AVC antes dos 60 anos?', 'boolean', { cost: 1, scaleTag: 'framingham' }),
  q(S.DOR_TORACICA_TIPICA, 'Tem dor no peito que piora ao esforço e melhora com repouso?', 'boolean', { cost: 2 },
    {
      followUps: [
        { id: 'irradiacao_braco_mandibula', text: 'A dor irradia para braço, ombro ou mandíbula?', type: 'boolean', triggerIf: 1 },
        { id: 'sudorese_fria', text: 'Vem acompanhada de suor frio?', type: 'boolean', triggerIf: 1 },
      ],
    }),
  q(S.DISPNEIA_ESFORCO, 'Sente falta de ar ao subir escadas ou caminhar rápido?', 'boolean', { cost: 1 }),
  q(S.PALPITACOES, 'Sente palpitações (coração acelerado ou irregular)?', 'boolean', { cost: 1 },
    { followUps: [
        { id: S.PALP_PAROXISTICAS, text: 'As palpitações vêm e passam de forma súbita?', type: 'boolean', triggerIf: 1 },
      ],
    }),
  q(S.EDEMA_MMII, 'Apresenta inchaço nas pernas com frequência?', 'boolean', { cost: 1 }),
  q(S.SINCOPE, 'Já teve episódio de desmaio (síncope)?', 'boolean', { cost: 1 },
    { followUps: [
        { id: 'sincope_durante_esforco', text: 'O desmaio ocorreu durante esforço físico?', type: 'boolean', triggerIf: 1 },
      ],
    }),
  q(S.DISPNEIA_SUBITA, 'Já teve falta de ar súbita sem esforço prévio?', 'boolean', { cost: 1 }),
  q(S.TONTURA_RECORRENTE, 'Tem tontura recorrente?', 'boolean', { cost: 1 }),
  q(S.HIST_ICC, 'Tem diagnóstico de insuficiência cardíaca ou cardiopatia estrutural?', 'boolean', { cost: 1 }),

  // ── Diabetes
  q(S.POLIURIA, 'Tem urinado muito mais que o usual (poliúria)?', 'boolean', { cost: 1 }),
  q(S.POLIDIPSIA, 'Sente sede excessiva ao longo do dia?', 'boolean', { cost: 1 }),
  q(S.POLIFAGIA, 'Sente fome excessiva mesmo após refeições?', 'boolean', { cost: 1 }),
  q(S.PERDA_PESO, 'Perdeu mais de 5 kg sem causa aparente nos últimos 3 meses?', 'boolean', { cost: 1 },
    { followUps: [
        { id: 'sudorese_noturna', text: 'Vem acompanhada de sudorese noturna intensa?', type: 'boolean', triggerIf: 1 },
      ],
    }),
  q(S.VISAO_TURVA, 'Notou visão turva ou embaçada recentemente?', 'boolean', { cost: 1 }),
  q(S.FERIDAS_LENTAS, 'Notou que feridas demoram mais para cicatrizar?', 'boolean', { cost: 1 }),
  q(S.SEDENTARISMO, 'Faz menos de 30 minutos de atividade física por dia?', 'boolean', { cost: 1, scaleTag: 'findrisc' }),
  q(S.POUCAS_FRUTAS_VEG, 'Consome frutas e vegetais menos que uma vez por dia?', 'boolean', { cost: 1, scaleTag: 'findrisc' }),
  q(S.USO_ANTI_HAS, 'Faz uso regular de medicação para pressão alta?', 'boolean', { cost: 1, scaleTag: 'findrisc' }),
  q(S.GLICEMIA_ALTERADA, 'Já teve glicemia alterada em algum exame?', 'boolean', { cost: 1, scaleTag: 'findrisc' }),
  q(S.HIST_FAM_DM, 'Pais, irmãos ou filhos têm diabetes?', 'boolean', { cost: 1, scaleTag: 'findrisc' }),
  q(S.CINTURA_AUMENTADA, 'Sua circunferência abdominal é > 94 cm (homem) ou > 80 cm (mulher)?', 'boolean', { cost: 2, scaleTag: 'findrisc' }),

  // ── Hipotireoidismo
  q(S.GANHO_PESO, 'Notou ganho de peso sem causa aparente nos últimos meses?', 'boolean', { cost: 1 }),
  q(S.INTOL_FRIO, 'Sente frio com mais facilidade que as pessoas ao seu redor?', 'boolean', { cost: 1 }),
  q(S.CONSTIPACAO, 'Tem intestino preso (constipação) com frequência?', 'boolean', { cost: 1 }),
  q(S.PELE_SECA, 'Sua pele anda mais ressecada que o habitual?', 'boolean', { cost: 1 }),
  q(S.QUEDA_CABELO, 'Notou queda ou afinamento de cabelo?', 'boolean', { cost: 1 }),
  q(S.IRREG_MENSTRUAL, 'Mulheres: notou irregularidade menstrual recente?', 'boolean', { cost: 2,
    showIf: (p) => p.sex === 'female' }),
  q(S.ROUQUIDAO, 'Tem notado rouquidão persistente?', 'boolean', { cost: 1 }),
  q(S.MUDANCA_7_SINTOMAS, 'Houve mudança em vários (≥7) desses sintomas no último ano?', 'boolean', { cost: 1 }),

  // ── DPOC
  q(S.TABAGISMO_PESADO, 'Já fumou ou fuma o equivalente a mais de 10 maços-ano?', 'boolean', { cost: 1 }),
  q(S.TOSSE_CRONICA, 'Tem tosse crônica (> 3 meses por ano)?', 'boolean', { cost: 1 }),
  q(S.EXPECTORACAO, 'Tem expectoração (catarro) crônica?', 'boolean', { cost: 1 }),
  q(S.DISPNEIA_REPOUSO, 'Sente falta de ar mesmo em repouso?', 'boolean', { cost: 2 }),
  q(S.SIBILANCIA, 'Sente chiado no peito (sibilância)?', 'boolean', { cost: 1 }),
  q(S.USO_BRONCODIL, 'Faz uso regular de bombinha (broncodilatador)?', 'boolean', { cost: 1 }),
  q(S.INF_RESP_FREQ, 'Tem infecções respiratórias frequentes?', 'boolean', { cost: 1 }),

  // ── Síndrome metabólica
  q(S.ACANTHOSIS, 'Notou manchas escuras na pele do pescoço ou axilas (acantose nigricans)?', 'boolean', { cost: 1 }),
  q(S.HIST_FAM_SINDMET, 'Histórico familiar de síndrome metabólica?', 'boolean', { cost: 1 }),

  // ── Red flag auxiliares (perguntadas se houver suspeita)
  q('deficit_neurologico_subito', 'Teve recentemente fraqueza ou dormência súbita em um lado do corpo, ou dificuldade para falar?', 'boolean', { cost: 1, redFlagProbe: true }),
  q('cefaleia_pior_da_vida', 'Teve recentemente "a pior dor de cabeça da vida", de início súbito?', 'boolean', { cost: 1, redFlagProbe: true }),

  // ── PHQ-9 (likert 0–3)
  phq9Q(S.PHQ9_HUMOR,        'Pouco interesse ou prazer em fazer as coisas?'),
  phq9Q(S.PHQ9_ANEDONIA,     'Sente-se "para baixo", deprimido(a) ou sem esperança?'),
  phq9Q(S.PHQ9_SONO,         'Dificuldade para pegar no sono, manter o sono ou dormir demais?'),
  phq9Q(S.PHQ9_FADIGA,       'Sente-se cansado(a) ou com pouca energia?'),
  phq9Q(S.PHQ9_APETITE,      'Falta de apetite ou comendo demais?'),
  phq9Q(S.PHQ9_CULPA,        'Sentir-se mal consigo mesmo(a) — fracasso ou desapontou a família?'),
  phq9Q(S.PHQ9_CONCENTRACAO, 'Dificuldade para se concentrar em coisas como ler ou ver TV?'),
  phq9Q(S.PHQ9_AGITACAO,     'Movimentos/fala muito lentos ou agitação anormal observada por outros?'),
  phq9Q(S.PHQ9_IDEACAO,      'Pensamentos de que seria melhor estar morto(a) ou de se ferir?'),
];

// Wrapper para perguntas de sintomas booleanos
function q(symptom, text, type, opts = {}, more = {}) {
  return {
    id:        symptom,
    symptom,
    text,
    type,
    cost:      opts.cost ?? 1,
    scaleTag:  opts.scaleTag,
    redFlagProbe: opts.redFlagProbe ?? false,
    showIf:    opts.showIf,
    followUps: more.followUps || [],
  };
}

// Wrapper para item PHQ-9 (likert 0–3, vira sintoma binário com threshold)
function phq9Q(symptom, text) {
  return {
    id:       symptom,
    symptom,
    text:     `Nas últimas 2 semanas: ${text}`,
    type:     'likert',
    cost:     1,
    scaleTag: 'phq9',
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Alguns dias' },
      { value: 2, label: 'Mais da metade dos dias' },
      { value: 3, label: 'Quase todos os dias' },
    ],
    // Threshold para virar sintoma binário no motor bayesiano
    binaryThreshold: 2,
  };
}

// Resolve uma resposta likert/boolean/select em valor binário (0|1) usado
// pelo motor bayesiano.
const toBinary = (question, raw) => {
  if (raw == null || raw === '') return null;
  if (question.type === 'boolean') {
    if (raw === true || raw === 1 || raw === '1' || raw === 'Sim' || raw === 'sim') return 1;
    if (raw === false || raw === 0 || raw === '0' || raw === 'Não' || raw === 'nao' || raw === 'não') return 0;
    return null;
  }
  if (question.type === 'likert') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return n >= (question.binaryThreshold ?? 2) ? 1 : 0;
  }
  if (question.type === 'select') {
    return raw ? 1 : 0; // genérico
  }
  return null;
};

const byId = new Map(SYMPTOM_QUESTIONS.map(q => [q.id, q]));
const getQuestionForSymptom = (sx) => byId.get(sx) || null;

// Candidatos para o motor (sintomas + custo) — filtra por showIf
const candidatesForProfile = (profile = {}) => {
  return SYMPTOM_QUESTIONS
    .filter(q => !q.redFlagProbe)
    .filter(q => !q.showIf || q.showIf(profile))
    .map(q => ({ symptom: q.symptom, cost: q.cost, question: serializeQuestion(q) }));
};

const serializeQuestion = (q) => ({
  id:        q.id,
  symptom:   q.symptom,
  text:      q.text,
  type:      q.type,
  options:   q.options,
  followUps: q.followUps,
  scaleTag:  q.scaleTag,
});

// Demografia serializada para o frontend (sem `showIf` que é função)
const demographicSchema = () => DEMOGRAPHIC_QUESTIONS.map(({ showIf, ...rest }) => ({
  ...rest,
  showIfField: showIf ? extractShowIfField(showIf) : null,
}));

// Extrai trivialmente o nome do campo de uma função tipo (p) => p.smoker
const extractShowIfField = (fn) => {
  const src = fn.toString();
  const m = src.match(/p\.(\w+)/);
  return m ? m[1] : null;
};

module.exports = {
  DEMOGRAPHIC_QUESTIONS,
  SYMPTOM_QUESTIONS,
  candidatesForProfile,
  getQuestionForSymptom,
  serializeQuestion,
  demographicSchema,
  toBinary,
};
