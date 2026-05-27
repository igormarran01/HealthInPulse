// ─── Red flags clínicas ─────────────────────────────────────────────
// Sintomas/sinais que devem INTERROMPER a triagem imediatamente,
// com prioridade absoluta sobre o algoritmo de entropia.
//
// Fonte: Documentação triagem HealthInPulse (Fase 3) + DSM-5 + AHA/SBC.

const { S } = require('./matrix');

const RED_FLAGS = [
  {
    code:    'SCA_IAM',
    label:   'Suspeita de Síndrome Coronariana Aguda / IAM',
    urgency: 'EMERGENCY',
    color:   'red',
    action:  'SAMU (192) imediato',
    rule:    ({ answers }) =>
      yes(answers, S.DOR_TORACICA_TIPICA) &&
      (yes(answers, 'irradiacao_braco_mandibula') || yes(answers, 'sudorese_fria')),
  },
  {
    code:    'AVC',
    label:   'Suspeita de AVC / Hemorragia Subaracnoide',
    urgency: 'EMERGENCY',
    color:   'red',
    action:  'SAMU (192) imediato',
    rule:    ({ answers }) =>
      yes(answers, 'deficit_neurologico_subito') ||
      yes(answers, 'cefaleia_pior_da_vida'),
  },
  {
    code:    'INSUF_RESP',
    label:   'Insuficiência respiratória',
    urgency: 'EMERGENCY',
    color:   'red',
    action:  'UPA / Pronto-socorro',
    rule:    ({ wearable }) =>
      wearable?.restingSpO2 != null && wearable.restingSpO2 < 90,
  },
  {
    code:    'TAQUI_GRAVE',
    label:   'Taquiarritmia grave',
    urgency: 'EMERGENCY',
    color:   'red',
    action:  'Pronto-socorro',
    rule:    ({ wearable }) =>
      wearable?.restingHr != null && wearable.restingHr > 150,
  },
  {
    code:    'HIPERGLICEMIA',
    label:   'Crise hiperglicêmica',
    urgency: 'EMERGENCY',
    color:   'red',
    action:  'Pronto-socorro',
    rule:    ({ wearable }) =>
      wearable?.glucose != null && wearable.glucose > 350,
  },
  {
    code:    'IDEACAO_SUICIDA',
    label:   'Ideação suicida (PHQ-9 item 9)',
    urgency: 'EMERGENCY',
    color:   'red',
    action:  'CVV 188 / Suporte psiquiátrico imediato',
    rule:    ({ answers }) => {
      const v = answers[S.PHQ9_IDEACAO];
      return v != null && Number(v) > 0;
    },
  },
  {
    code:    'SINCOPE_ESFORCO',
    label:   'Síncope durante esforço',
    urgency: 'URGENT',
    color:   'orange',
    action:  'Urgência em horas — cardiologia',
    rule:    ({ answers }) =>
      yes(answers, S.SINCOPE) && yes(answers, 'sincope_durante_esforco'),
  },
  {
    code:    'NEOPLASIA',
    label:   'Suspeita de neoplasia / TB',
    urgency: 'URGENT',
    color:   'orange',
    action:  'Investigação imediata',
    rule:    ({ answers }) =>
      yes(answers, S.PERDA_PESO) && yes(answers, 'sudorese_noturna'),
  },
];

const yes = (answers, key) => {
  const v = answers?.[key];
  return v === 1 || v === '1' || v === true || v === 'Sim' || v === 'sim';
};

// Verifica todos os red flags. Retorna o primeiro disparado (mais grave
// vem primeiro na lista) ou null.
const detectRedFlag = ({ answers = {}, wearable = {} } = {}) => {
  for (const rf of RED_FLAGS) {
    try {
      if (rf.rule({ answers, wearable })) {
        return {
          code:    rf.code,
          label:   rf.label,
          urgency: rf.urgency,
          color:   rf.color,
          action:  rf.action,
        };
      }
    } catch (_) {}
  }
  return null;
};

const listRedFlagDefinitions = () => RED_FLAGS.map(({ rule, ...rest }) => rest);

module.exports = { detectRedFlag, listRedFlagDefinitions, RED_FLAGS };
