// ─── Matriz clínica de probabilidades ──────────────────────────────────
// Fonte: Documentação triagem HealthInPulse (Fase 1).
// Para cada condição: prior populacional + lista de sintomas com
// P(sintoma | condição) (sensibilidade) e P(sintoma | ¬condição)
// (1 - especificidade). LR+ é redundante mas guardado para inspeção/debug.
//
// Modelos demográficos: priorAdjust permite ajustar o prior em função de
// idade/sexo/IMC/comorbidades sem reescrever o catálogo inteiro.

const COMPARATORS = {
  eq:  (a, b) => a === b,
  gte: (a, b) => a >= b,
  lte: (a, b) => a <= b,
  gt:  (a, b) => a >  b,
  lt:  (a, b) => a <  b,
};

// Símbolos de sintomas — chaves canônicas usadas pelo motor.
// Mantidas em uma constante para evitar typos silenciosos.
const S = {
  // AOS
  RONCO_ALTO:           'ronco_alto',
  APNEIA_OBSERVADA:     'apneia_observada',
  FADIGA_DIURNA:        'fadiga_diurna',
  CEFALEIA_MATINAL:     'cefaleia_matinal',
  HAS_CONHECIDA:        'has_conhecida',
  IMC_OBESIDADE:        'imc_obesidade',          // IMC ≥ 30
  IMC_SOBREPESO:        'imc_sobrepeso',          // IMC ≥ 25
  IDADE_50:             'idade_50_mais',
  IDADE_55_H_65_M:      'idade_55h_65m',
  IDADE_65:             'idade_65_mais',
  SEXO_MASCULINO:       'sexo_masculino',
  PESCOCO_LARGO:        'circunferencia_cervical_aumentada',
  PALPITACOES_NOTURNAS: 'palpitacoes_noturnas',

  // Cardiovascular
  TABAGISMO:            'tabagismo_ativo',
  DIABETES_DX:          'diabetes_diagnosticado',
  COLESTEROL_ALTO:      'colesterol_alto_relato',
  HIST_FAM_CV:          'historico_familiar_cv',
  DOR_TORACICA_TIPICA:  'dor_toracica_tipica',
  DISPNEIA_ESFORCO:     'dispneia_esforco',
  PALPITACOES:          'palpitacoes',
  EDEMA_MMII:           'edema_mmii',
  SINCOPE:              'sincope',

  // Diabetes
  CINTURA_AUMENTADA:    'circunferencia_abdominal_aumentada',
  SEDENTARISMO:         'sedentarismo',
  POUCAS_FRUTAS_VEG:    'baixo_consumo_frutas_vegetais',
  USO_ANTI_HAS:         'uso_anti_hipertensivo',
  GLICEMIA_ALTERADA:    'historico_glicemia_alterada',
  HIST_FAM_DM:          'historico_familiar_dm2',
  POLIURIA:             'poliuria',
  POLIDIPSIA:           'polidipsia',
  POLIFAGIA:            'polifagia',
  PERDA_PESO:           'perda_peso_inexplicada',
  VISAO_TURVA:          'visao_turva',
  FERIDAS_LENTAS:       'feridas_cicatrizacao_lenta',

  // Hipotireoidismo
  GANHO_PESO:           'ganho_peso_inexplicado',
  INTOL_FRIO:           'intolerancia_frio',
  CONSTIPACAO:          'constipacao',
  PELE_SECA:            'pele_seca',
  QUEDA_CABELO:         'queda_cabelo',
  BRADICARDIA:          'bradicardia',
  FRAQ_MUSCULAR:        'fraqueza_muscular_proximal',
  DEPRESSAO_SINTOMA:    'humor_deprimido',
  IRREG_MENSTRUAL:      'irregularidade_menstrual',
  PERDA_SOBRANC:        'perda_terco_lateral_sobrancelha',
  REFLEXOS_LENTOS:      'reflexos_lentos',
  ROUQUIDAO:            'rouquidao',
  EDEMA_PERIORBITARIO:  'edema_periorbitario',
  MUDANCA_7_SINTOMAS:   'mudanca_7_sintomas_ano',

  // Síndrome metabólica (sintomas indiretos)
  ACANTHOSIS:           'acanthosis_nigricans',
  HIST_FAM_SINDMET:     'historico_familiar_sindmet',
  HAS_E_DM:             'has_e_dm_combinados',

  // Depressão (PHQ-9)
  PHQ9_HUMOR:           'phq9_humor_deprimido',
  PHQ9_ANEDONIA:        'phq9_anedonia',
  PHQ9_SONO:            'phq9_alt_sono',
  PHQ9_FADIGA:          'phq9_fadiga',
  PHQ9_APETITE:         'phq9_alt_apetite',
  PHQ9_CULPA:           'phq9_culpa_desvalia',
  PHQ9_CONCENTRACAO:    'phq9_concentracao',
  PHQ9_AGITACAO:        'phq9_agitacao_lentidao',
  PHQ9_IDEACAO:         'phq9_ideacao_morte',

  // Arritmias
  PALP_PAROXISTICAS:    'palpitacoes_paroxisticas',
  DISPNEIA_SUBITA:      'dispneia_subita_sem_esforco',
  TONTURA_RECORRENTE:   'tontura_recorrente',
  DOR_TORACICA_ATIPICA: 'dor_toracica_atipica',
  HIST_ICC:             'historico_icc_ou_cardiopatia',

  // DPOC
  TOSSE_CRONICA:        'tosse_cronica',
  EXPECTORACAO:         'expectoracao_cronica',
  DISPNEIA_REPOUSO:     'dispneia_repouso',
  SIBILANCIA:           'sibilancia',
  USO_BRONCODIL:        'uso_broncodilatador',
  INF_RESP_FREQ:        'infeccoes_respiratorias_frequentes',
  TORAX_BARRIL:         'torax_em_barril',
  TABAGISMO_PESADO:     'tabagismo_acima_10_macos_ano',
};

const SYMPTOMS = S;

// ─── Catálogo das 8 condições clínicas ────────────────────────────────
const CONDITIONS = {
  // 1 — Apneia Obstrutiva do Sono
  AOS: {
    code: 'AOS',
    label: 'Apneia Obstrutiva do Sono',
    prior: { male: 0.32, female: 0.15 },
    priorAdjust: ({ age, sex, bmi }) => {
      let p = sex === 'female' ? 0.15 : 0.32;
      if (age && age > 50) p += sex === 'female' ? 0.10 : 0.13;
      if (bmi && bmi >= 30) p += 0.10;
      return Math.min(0.95, p);
    },
    symptoms: {
      [S.RONCO_ALTO]:           { pSx: 0.95, pNoSx: 0.40, lrPos: 2.4  },
      [S.APNEIA_OBSERVADA]:     { pSx: 0.75, pNoSx: 0.06, lrPos: 12.5 },
      [S.FADIGA_DIURNA]:        { pSx: 0.80, pNoSx: 0.50, lrPos: 1.6  },
      [S.CEFALEIA_MATINAL]:     { pSx: 0.29, pNoSx: 0.15, lrPos: 1.9  },
      [S.HAS_CONHECIDA]:        { pSx: 0.55, pNoSx: 0.30, lrPos: 1.8  },
      [S.IMC_OBESIDADE]:        { pSx: 0.60, pNoSx: 0.35, lrPos: 1.7  },
      [S.IDADE_50]:             { pSx: 0.65, pNoSx: 0.45, lrPos: 1.4  },
      [S.SEXO_MASCULINO]:       { pSx: 0.70, pNoSx: 0.45, lrPos: 1.6  },
      [S.PESCOCO_LARGO]:        { pSx: 0.55, pNoSx: 0.25, lrPos: 2.2  },
      [S.PALPITACOES_NOTURNAS]: { pSx: 0.20, pNoSx: 0.10, lrPos: 2.0  },
    },
  },

  // 2 — Risco Cardiovascular
  CV: {
    code: 'CV',
    label: 'Doença Cardiovascular / HAS',
    prior: { default: 0.20 },
    priorAdjust: ({ age, sex }) => {
      let p = 0.20;
      if (age && age > 45) p = 0.30;
      if (age && age > 60) p = 0.45;
      if (sex === 'male') p += 0.05;
      return Math.min(0.95, p);
    },
    symptoms: {
      [S.TABAGISMO]:           { pSx: 0.40, pNoSx: 0.20, lrPos: 2.0 },
      [S.HAS_CONHECIDA]:       { pSx: 0.65, pNoSx: 0.30, lrPos: 2.2 },
      [S.DIABETES_DX]:         { pSx: 0.35, pNoSx: 0.10, lrPos: 3.5 },
      [S.COLESTEROL_ALTO]:     { pSx: 0.55, pNoSx: 0.35, lrPos: 1.6 },
      [S.HIST_FAM_CV]:         { pSx: 0.45, pNoSx: 0.15, lrPos: 3.0 },
      [S.DOR_TORACICA_TIPICA]: { pSx: 0.75, pNoSx: 0.10, lrPos: 7.5 },
      [S.DISPNEIA_ESFORCO]:    { pSx: 0.55, pNoSx: 0.25, lrPos: 2.2 },
      [S.IDADE_55_H_65_M]:     { pSx: 0.60, pNoSx: 0.40, lrPos: 1.5 },
      [S.SEXO_MASCULINO]:      { pSx: 0.65, pNoSx: 0.45, lrPos: 1.4 },
      [S.PALPITACOES]:         { pSx: 0.30, pNoSx: 0.15, lrPos: 2.0 },
      [S.EDEMA_MMII]:          { pSx: 0.35, pNoSx: 0.10, lrPos: 3.5 },
      [S.SINCOPE]:             { pSx: 0.20, pNoSx: 0.05, lrPos: 4.0 },
    },
  },

  // 3 — Diabetes Mellitus tipo 2
  DM2: {
    code: 'DM2',
    label: 'Diabetes Mellitus tipo 2',
    prior: { default: 0.13 },
    priorAdjust: ({ age, bmi, familyHistoryDm }) => {
      let p = 0.13;
      if (age && age > 40) p = 0.15;
      if (age && age > 60) p = 0.22;
      if (bmi && bmi >= 30) p += 0.08;
      if (familyHistoryDm) p += 0.05;
      return Math.min(0.95, p);
    },
    symptoms: {
      [S.IMC_SOBREPESO]:     { pSx: 0.75, pNoSx: 0.45, lrPos: 1.7  },
      [S.IMC_OBESIDADE]:     { pSx: 0.55, pNoSx: 0.20, lrPos: 2.8  },
      [S.CINTURA_AUMENTADA]: { pSx: 0.70, pNoSx: 0.35, lrPos: 2.0  },
      [S.SEDENTARISMO]:      { pSx: 0.65, pNoSx: 0.40, lrPos: 1.6  },
      [S.POUCAS_FRUTAS_VEG]: { pSx: 0.55, pNoSx: 0.45, lrPos: 1.2  },
      [S.USO_ANTI_HAS]:      { pSx: 0.45, pNoSx: 0.15, lrPos: 3.0  },
      [S.GLICEMIA_ALTERADA]: { pSx: 0.50, pNoSx: 0.05, lrPos: 10.0 },
      [S.HIST_FAM_DM]:       { pSx: 0.45, pNoSx: 0.15, lrPos: 3.0  },
      [S.POLIURIA]:          { pSx: 0.55, pNoSx: 0.05, lrPos: 11.0 },
      [S.POLIDIPSIA]:        { pSx: 0.50, pNoSx: 0.05, lrPos: 10.0 },
      [S.POLIFAGIA]:         { pSx: 0.40, pNoSx: 0.05, lrPos: 8.0  },
      [S.PERDA_PESO]:        { pSx: 0.35, pNoSx: 0.03, lrPos: 11.7 },
      [S.VISAO_TURVA]:       { pSx: 0.30, pNoSx: 0.05, lrPos: 6.0  },
      [S.FERIDAS_LENTAS]:    { pSx: 0.25, pNoSx: 0.03, lrPos: 8.3  },
    },
  },

  // 4 — Hipotireoidismo
  HIPOTIR: {
    code: 'HIPOTIR',
    label: 'Hipotireoidismo',
    prior: { default: 0.05 },
    priorAdjust: ({ age, sex }) => {
      let p = 0.05;
      if (sex === 'female') p = 0.07;
      if (age && age > 60) p = sex === 'female' ? 0.12 : 0.08;
      return Math.min(0.95, p);
    },
    symptoms: {
      [S.FADIGA_DIURNA]:      { pSx: 0.85, pNoSx: 0.65, lrPos: 1.3  },
      [S.GANHO_PESO]:         { pSx: 0.60, pNoSx: 0.30, lrPos: 2.0  },
      [S.INTOL_FRIO]:         { pSx: 0.65, pNoSx: 0.20, lrPos: 3.3  },
      [S.CONSTIPACAO]:        { pSx: 0.55, pNoSx: 0.25, lrPos: 2.2  },
      [S.PELE_SECA]:          { pSx: 0.60, pNoSx: 0.25, lrPos: 2.4  },
      [S.QUEDA_CABELO]:       { pSx: 0.55, pNoSx: 0.25, lrPos: 2.2  },
      [S.BRADICARDIA]:        { pSx: 0.35, pNoSx: 0.08, lrPos: 4.4  },
      [S.FRAQ_MUSCULAR]:      { pSx: 0.45, pNoSx: 0.10, lrPos: 4.5  },
      [S.DEPRESSAO_SINTOMA]:  { pSx: 0.45, pNoSx: 0.25, lrPos: 1.8  },
      [S.IRREG_MENSTRUAL]:    { pSx: 0.40, pNoSx: 0.15, lrPos: 2.7  },
      [S.PERDA_SOBRANC]:      { pSx: 0.30, pNoSx: 0.03, lrPos: 10.0 },
      [S.REFLEXOS_LENTOS]:    { pSx: 0.50, pNoSx: 0.05, lrPos: 10.0 },
      [S.ROUQUIDAO]:          { pSx: 0.40, pNoSx: 0.10, lrPos: 4.0  },
      [S.EDEMA_PERIORBITARIO]:{ pSx: 0.30, pNoSx: 0.05, lrPos: 6.0  },
      [S.MUDANCA_7_SINTOMAS]: { pSx: 0.60, pNoSx: 0.07, lrPos: 8.7  },
    },
  },

  // 5 — Síndrome metabólica (componente sintomático)
  SINDMET: {
    code: 'SINDMET',
    label: 'Síndrome Metabólica',
    prior: { default: 0.40 },
    priorAdjust: ({ age }) => age && age > 40 ? 0.50 : 0.40,
    symptoms: {
      [S.IMC_OBESIDADE]:     { pSx: 0.70, pNoSx: 0.25, lrPos: 2.8 },
      [S.CINTURA_AUMENTADA]: { pSx: 0.80, pNoSx: 0.30, lrPos: 2.7 },
      [S.HAS_E_DM]:          { pSx: 0.55, pNoSx: 0.09, lrPos: 6.0 },
      [S.SEDENTARISMO]:      { pSx: 0.65, pNoSx: 0.32, lrPos: 2.0 },
      [S.ACANTHOSIS]:        { pSx: 0.35, pNoSx: 0.08, lrPos: 4.5 },
      [S.HIST_FAM_SINDMET]:  { pSx: 0.50, pNoSx: 0.20, lrPos: 2.5 },
    },
  },

  // 6 — Depressão (PHQ-9 integrado)
  DEPRESSAO: {
    code: 'DEPRESSAO',
    label: 'Transtorno Depressivo Maior',
    prior: { default: 0.11 },
    priorAdjust: ({ age }) => age && age > 50 ? 0.12 : 0.11,
    // Os pSx/pNoSx aqui são genéricos — o score PHQ-9 (clinicalScales) é
    // a fonte primária de probabilidade. O motor bayesiano usa estes
    // como reforço, mas a regra final é dominada pela escala.
    symptoms: {
      [S.PHQ9_HUMOR]:         { pSx: 0.85, pNoSx: 0.25, lrPos: 3.4 },
      [S.PHQ9_ANEDONIA]:      { pSx: 0.80, pNoSx: 0.20, lrPos: 4.0 },
      [S.PHQ9_SONO]:          { pSx: 0.75, pNoSx: 0.30, lrPos: 2.5 },
      [S.PHQ9_FADIGA]:        { pSx: 0.80, pNoSx: 0.40, lrPos: 2.0 },
      [S.PHQ9_APETITE]:       { pSx: 0.55, pNoSx: 0.20, lrPos: 2.7 },
      [S.PHQ9_CULPA]:         { pSx: 0.65, pNoSx: 0.10, lrPos: 6.5 },
      [S.PHQ9_CONCENTRACAO]:  { pSx: 0.70, pNoSx: 0.25, lrPos: 2.8 },
      [S.PHQ9_AGITACAO]:      { pSx: 0.50, pNoSx: 0.10, lrPos: 5.0 },
      [S.PHQ9_IDEACAO]:       { pSx: 0.45, pNoSx: 0.02, lrPos: 22.5 },
    },
  },

  // 7 — Arritmias / Fibrilação Atrial
  ARRITMIA: {
    code: 'ARRITMIA',
    label: 'Arritmias / Fibrilação Atrial',
    prior: { default: 0.02 },
    priorAdjust: ({ age }) => {
      if (age && age > 65) return 0.08;
      if (age && age > 60) return 0.05;
      return 0.02;
    },
    symptoms: {
      [S.PALPITACOES]:         { pSx: 0.75, pNoSx: 0.15, lrPos: 5.0 },
      [S.PALP_PAROXISTICAS]:   { pSx: 0.60, pNoSx: 0.10, lrPos: 6.0 },
      [S.DISPNEIA_SUBITA]:     { pSx: 0.45, pNoSx: 0.10, lrPos: 4.5 },
      [S.SINCOPE]:             { pSx: 0.30, pNoSx: 0.05, lrPos: 6.0 },
      [S.TONTURA_RECORRENTE]:  { pSx: 0.40, pNoSx: 0.15, lrPos: 2.7 },
      [S.FADIGA_DIURNA]:       { pSx: 0.55, pNoSx: 0.40, lrPos: 1.4 },
      [S.DOR_TORACICA_ATIPICA]:{ pSx: 0.35, pNoSx: 0.10, lrPos: 3.5 },
      [S.HAS_CONHECIDA]:       { pSx: 0.65, pNoSx: 0.35, lrPos: 1.9 },
      [S.IDADE_65]:            { pSx: 0.70, pNoSx: 0.40, lrPos: 1.75 },
      [S.HIST_ICC]:            { pSx: 0.45, pNoSx: 0.05, lrPos: 9.0 },
    },
  },

  // 8 — DPOC
  DPOC: {
    code: 'DPOC',
    label: 'DPOC',
    prior: { default: 0.05 },
    priorAdjust: ({ age, smoker, packYears }) => {
      let p = 0.05;
      if (smoker) p = 0.20;
      if (packYears && packYears >= 10) p = 0.25;
      if (age && age > 40 && smoker) p = 0.30;
      return Math.min(0.95, p);
    },
    symptoms: {
      [S.TABAGISMO_PESADO]:    { pSx: 0.85, pNoSx: 0.25, lrPos: 3.4  },
      [S.TOSSE_CRONICA]:       { pSx: 0.75, pNoSx: 0.20, lrPos: 3.75 },
      [S.EXPECTORACAO]:        { pSx: 0.65, pNoSx: 0.15, lrPos: 4.3  },
      [S.DISPNEIA_ESFORCO]:    { pSx: 0.80, pNoSx: 0.15, lrPos: 5.3  },
      [S.DISPNEIA_REPOUSO]:    { pSx: 0.40, pNoSx: 0.03, lrPos: 13.3 },
      [S.SIBILANCIA]:          { pSx: 0.55, pNoSx: 0.20, lrPos: 2.75 },
      [S.USO_BRONCODIL]:       { pSx: 0.50, pNoSx: 0.05, lrPos: 10.0 },
      [S.INF_RESP_FREQ]:       { pSx: 0.55, pNoSx: 0.15, lrPos: 3.7  },
      [S.IDADE_50]:            { pSx: 0.75, pNoSx: 0.20, lrPos: 3.75 },
      [S.TORAX_BARRIL]:        { pSx: 0.30, pNoSx: 0.02, lrPos: 15.0 },
    },
  },
};

// ─── Correlações entre sintomas (para penalização de redundância) ────
const CORRELATIONS = [
  [S.RONCO_ALTO, S.APNEIA_OBSERVADA, 0.6],
  [S.POLIURIA,   S.POLIDIPSIA,       0.7],
  [S.POLIDIPSIA, S.POLIFAGIA,        0.5],
  [S.DISPNEIA_ESFORCO, S.DISPNEIA_REPOUSO, 0.5],
  [S.TOSSE_CRONICA, S.EXPECTORACAO,  0.6],
  [S.PALPITACOES, S.PALP_PAROXISTICAS, 0.6],
  [S.IMC_SOBREPESO, S.IMC_OBESIDADE, 0.7],
  [S.CINTURA_AUMENTADA, S.IMC_OBESIDADE, 0.6],
  [S.PHQ9_HUMOR, S.PHQ9_ANEDONIA, 0.7],
  [S.PHQ9_FADIGA, S.FADIGA_DIURNA, 0.7],
  [S.FADIGA_DIURNA, S.GANHO_PESO,  0.3],
];

const correlationMap = (() => {
  const m = new Map();
  for (const [a, b, r] of CORRELATIONS) {
    if (!m.has(a)) m.set(a, new Map());
    if (!m.has(b)) m.set(b, new Map());
    m.get(a).set(b, r);
    m.get(b).set(a, r);
  }
  return m;
})();

const getCorrelation = (a, b) => correlationMap.get(a)?.get(b) ?? 0;

// Resolve o prior efetivo de uma condição dado o perfil demográfico
const resolvePrior = (condCode, profile = {}) => {
  const cond = CONDITIONS[condCode];
  if (!cond) return 0.05;
  if (typeof cond.priorAdjust === 'function') return cond.priorAdjust(profile);
  return cond.prior?.default ?? 0.05;
};

const listConditions  = () => Object.values(CONDITIONS);
const getCondition    = (code) => CONDITIONS[code] || null;
const allSymptoms     = () => Object.values(S);

module.exports = {
  CONDITIONS,
  SYMPTOMS,
  S,
  COMPARATORS,
  CORRELATIONS,
  getCorrelation,
  resolvePrior,
  listConditions,
  getCondition,
  allSymptoms,
};
