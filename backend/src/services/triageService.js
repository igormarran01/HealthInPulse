// ─── Triage Service (motor adaptativo) ──────────────────────────────
// Implementa o fluxo descrito na Documentação de triagem:
//
//   1. Coleta perfil demográfico (priors bayesianos)
//   2. Lê evidência objetiva da pulseira Care Plus (IAH, SpO₂ noturna,
//      PA, HRV, FC repouso, eventos paroxísticos) e injeta no Bayes com
//      peso máximo
//   3. Seleciona a próxima pergunta por Information Gain ponderado por
//      custo, com penalização de redundância e modo "alvo" quando uma
//      hipótese lidera
//   4. Após cada resposta verifica RED FLAGS — se disparar, interrompe
//      e devolve urgência
//   5. Em paralelo calcula STOP-BANG / PHQ-9 / FINDRISC / Framingham
//      como âncoras de calibração
//   6. Encerra quando posterior ≥ 80% OU atinge 18 perguntas
//
// O TriageAnswer.answers serializa o estado completo da sessão para que
// /answer possa retomar entre requests sem in-memory state.

const prisma         = require('../config/database');
const goalService    = require('./goalService');
const { getIO }      = require('../config/socket');
const { stringifyJson, parseTriage, parseJson } = require('../utils/jsonField');

const matrix    = require('./clinical/matrix');
const bayes     = require('./clinical/bayes');
const redFlags  = require('./clinical/redFlags');
const scales    = require('./clinical/scales');
const questions = require('./clinical/questions');
const wearable  = require('./clinical/wearableEvidence');

// ─── Perguntas estáticas (compat) ──────────────────────────────────
// O frontend antigo chama GET /triage/questions. Hoje a triagem é
// adaptativa — devolvemos só o schema demográfico para a primeira tela.
const getQuestions = () => ({
  mode: 'adaptive',
  demographic: questions.demographicSchema(),
  totalSymptoms: questions.SYMPTOM_QUESTIONS.length,
  conditions: matrix.listConditions().map(c => ({ code: c.code, label: c.label })),
});

// ─── Estado da sessão (persistido em TriageAnswer.answers) ─────────
const newSessionState = () => ({
  version:    2,
  profile:    {},          // demografia
  answers:    {},          // sintoma → 0/1 (binarizado)
  rawAnswers: {},          // sintoma → resposta crua (likert, follow-ups, ...)
  asked:      [],          // ordem em que foram perguntados
  wearable:   null,        // snapshot da pulseira no início
  evidence:   {},          // evidência efetiva injetada no Bayes (sintomas + wearable)
  redFlag:    null,
  status:     'COLLECT_PROFILE',
});

const loadState = (triage) => {
  const persisted = parseJson(triage.answers, null);
  if (persisted && persisted.version === 2) return persisted;
  return newSessionState();
};

const saveState = (triageId, state, extra = {}) =>
  prisma.triageAnswer.update({
    where: { id: triageId },
    data:  { answers: stringifyJson(state), ...extra },
  });

// ─── Cria sessão de triagem ────────────────────────────────────────
const startTriage = async (patientId) => {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      fullName: true, dateOfBirth: true, gender: true,
      height: true, weight: true, chronicConds: true, allergies: true,
    },
  });

  const wearableSnap = await wearable.collectFromDatabase(patientId);

  const state = newSessionState();
  state.wearable = wearableSnap;
  // Pré-preenche perfil com o que já temos cadastrado
  if (patient?.dateOfBirth) state.profile.age = ageFromDob(patient.dateOfBirth);
  if (patient?.gender) state.profile.sex = mapGender(patient.gender);
  if (patient?.height && patient?.weight) {
    state.profile.bmi = computeBmi(patient.height, patient.weight);
    state.profile.height = patient.height;
    state.profile.weight = patient.weight;
  }

  const triage = await prisma.triageAnswer.create({
    data: {
      patientId,
      status:  'IN_PROGRESS',
      answers: stringifyJson(state),
    },
  });

  return buildResponse(triage.id, state, { patient });
};

// ─── Próxima pergunta (após uma resposta) ──────────────────────────
const answerTriage = async (patientId, triageId, payload) => {
  const triage = await prisma.triageAnswer.findFirst({
    where: { id: triageId, patientId },
  });
  if (!triage) throw Object.assign(new Error('Triagem não encontrada'), { status: 404 });
  if (triage.status === 'COMPLETED') {
    return buildResponse(triage.id, loadState(triage), { completed: true });
  }

  const state = loadState(triage);

  // ─── 1. Recebe demografia (lote inteiro de uma vez) ──────────────
  if (state.status === 'COLLECT_PROFILE' && payload?.profile) {
    Object.assign(state.profile, payload.profile);
    state.profile.bmi = state.profile.bmi
      || computeBmi(state.profile.height, state.profile.weight);
    state.status = 'INTERVIEW';
    // Re-injetar evidência da pulseira (pode depender de perfil)
    state.evidence = wearable.toBayesianEvidence(state.wearable);
  }

  // ─── 2. Recebe resposta a um sintoma ─────────────────────────────
  if (state.status === 'INTERVIEW' && payload?.symptom != null) {
    const qDef = questions.getQuestionForSymptom(payload.symptom) || followUpDef(payload.symptom);
    const rawVal = payload.value;
    state.rawAnswers[payload.symptom] = rawVal;

    const bin = qDef ? questions.toBinary(qDef, rawVal) : binarizeFallback(rawVal);
    if (bin === 0 || bin === 1) {
      // Mantém evidência da pulseira mas deixa resposta sobrescrever
      // exceto se a evidência vier com weight ≥ 2 (objetiva).
      const existing = state.evidence[payload.symptom];
      if (!existing || (existing.weight ?? 1) < 2) {
        state.evidence[payload.symptom] = bin;
      }
      state.answers[payload.symptom] = bin;
      if (!state.asked.includes(payload.symptom)) state.asked.push(payload.symptom);
    }

    // Follow-ups (se a pergunta principal dispara filhos)
    if (qDef?.followUps?.length && Array.isArray(payload.followUps)) {
      for (const fu of payload.followUps) {
        state.rawAnswers[fu.id] = fu.value;
        const fuVal = binarizeFallback(fu.value);
        if (fuVal === 0 || fuVal === 1) {
          state.evidence[fu.id] = fuVal;
          state.answers[fu.id]  = fuVal;
        }
      }
    }
  }

  // ─── 3. Red flag? ────────────────────────────────────────────────
  const rf = redFlags.detectRedFlag({
    answers:  state.rawAnswers,
    wearable: state.wearable,
  });
  if (rf) {
    state.redFlag = rf;
    state.status  = 'RED_FLAG';
    await finalizeWithRedFlag(triage, state, patientId);
    return buildResponse(triage.id, state, { completed: true });
  }

  // ─── 4. Condição de parada por confiança/limite ──────────────────
  const post = bayes.computePosterior(state.evidence, state.profile);
  const stop = bayes.shouldStop(post, state.asked.length, {
    maxQuestions: 18, minQuestions: 6, confidenceCutoff: 0.80,
  });

  if (stop.stop && state.status === 'INTERVIEW') {
    state.status = 'COMPLETED';
    await finalize(triage, state, patientId);
    return buildResponse(triage.id, state, { completed: true });
  }

  await saveState(triage.id, state);
  return buildResponse(triage.id, state, {});
};

// ─── Finalizadores ─────────────────────────────────────────────────
const finalize = async (triage, state, patientId) => {
  const post   = bayes.computePosterior(state.evidence, state.profile);
  const verdict = bayes.classifyRisk(post);
  const computedScales = scales.runAll({
    answers:  state.rawAnswers,
    profile:  state.profile,
    wearable: state.wearable,
  });

  // Reforço por escalas validadas (Fase 4): a escala domina quando
  // muito alta — ex.: PHQ-9 ≥ 20 → garante level CRITICAL.
  let level = verdict.riskLevel;
  let score = verdict.score;
  if (computedScales.phq9.severity === 'SEVERE')          level = 'CRITICAL';
  if (computedScales.stopBang.risk === 'HIGH'   && rank(level) < rank('HIGH'))     level = 'HIGH';
  if (computedScales.findrisc.risk === 'VERY_HIGH' && rank(level) < rank('HIGH'))  level = 'HIGH';
  if (computedScales.framingham.risk === 'HIGH'  && rank(level) < rank('HIGH'))    level = 'HIGH';

  const summary = buildSummary(state, verdict.ranking, computedScales);
  const suggestions = buildSuggestions(level, verdict.ranking, computedScales, state.wearable);

  state.result = {
    riskLevel: level,
    score,
    posterior: post,
    ranking:   verdict.ranking,
    scales:    computedScales,
    summary,
    suggestions,
  };

  await saveState(triage.id, state, {
    status:    'COMPLETED',
    riskLevel: level,
    score,
    finishedAt: new Date(),
  });

  const report = await prisma.aiReport.create({
    data: {
      patientId,
      triageId:   triage.id,
      type:       'triage',
      content:    summary,
      riskLevel:  level,
      suggestions: stringifyJson(suggestions),
    },
  });

  try {
    await goalService.generateGoalsFromTriage(
      patientId,
      { riskLevel: level, score, summary, suggestions },
      triage.id,
    );
  } catch (e) { console.error('Erro ao gerar metas:', e.message); }

  emitCompleted(patientId, triage.id, level, report.id);
};

const finalizeWithRedFlag = async (triage, state, patientId) => {
  const rf = state.redFlag;
  const level = rf.urgency === 'EMERGENCY' ? 'CRITICAL' : 'HIGH';
  const summary = `🚨 ${rf.label}. Ação imediata: ${rf.action}.`;
  const suggestions = [
    { type: 'warning', text: rf.action },
    { type: 'info',    text: `Sinal detectado: ${rf.label}` },
  ];

  state.result = {
    riskLevel: level,
    score:     99,
    redFlag:   rf,
    summary,
    suggestions,
  };

  await saveState(triage.id, state, {
    status:    'COMPLETED',
    riskLevel: level,
    score:     99,
    finishedAt: new Date(),
  });

  const report = await prisma.aiReport.create({
    data: {
      patientId,
      triageId:   triage.id,
      type:       'triage',
      content:    summary,
      riskLevel:  level,
      suggestions: stringifyJson(suggestions),
    },
  });

  emitCompleted(patientId, triage.id, level, report.id, true);
};

// ─── Construção da resposta para o frontend ────────────────────────
const buildResponse = (triageId, state, extra = {}) => {
  const profileComplete = !!(state.profile.age != null && state.profile.sex && state.profile.bmi);

  // Etapa 1 — perfil
  if (state.status === 'COLLECT_PROFILE' || !profileComplete) {
    return {
      triageId,
      stage:      'PROFILE',
      profile:    state.profile,
      schema:     questions.demographicSchema(),
      wearableSummary: wearable.summarizeForPatient(state.wearable),
      hasWearable: !!state.wearable?.hasData,
      progress: { asked: 0, max: 18 },
    };
  }

  // Etapa final
  if (state.status === 'COMPLETED' || state.status === 'RED_FLAG' || extra.completed) {
    return {
      triageId,
      stage: 'RESULT',
      profile: state.profile,
      result: state.result,
      redFlag: state.redFlag,
      wearableSummary: wearable.summarizeForPatient(state.wearable),
      progress: { asked: state.asked.length, max: 18 },
    };
  }

  // Etapa de pergunta — calcula a próxima
  const profile    = state.profile;
  const candidates = questions.candidatesForProfile(profile);
  const next = bayes.selectNextSymptom(candidates, state.evidence, profile, { targetThreshold: 0.5 });

  const post   = bayes.computePosterior(state.evidence, profile);
  const ranking = bayes.classifyRisk(post).ranking;

  if (!next) {
    // Não tem mais o que perguntar — força fechamento
    state.status = 'COMPLETED';
    return { triageId, stage: 'RESULT', profile, progress: { asked: state.asked.length, max: 18 } };
  }

  return {
    triageId,
    stage: 'QUESTION',
    question: next.question,
    explanation: explainPick(next, ranking[0]),
    progress: { asked: state.asked.length, max: 18 },
    leaderboard: ranking.slice(0, 3),
    wearableSummary: wearable.summarizeForPatient(state.wearable),
  };
};

// ─── Helpers de finalização ────────────────────────────────────────
const rank = (level) => ({ INCONCLUSIVE: 0, LOW: 1, MODERATE: 2, HIGH: 3, CRITICAL: 4 }[level] ?? 0);

const buildSummary = (state, ranking, computedScales) => {
  const top = ranking[0];
  const wearLine = (state.wearable?.hasData ? wearable.summarizeForPatient(state.wearable) : [])
    .map(l => `- ${l}`).join('\n') || '- Sem dados recentes da pulseira';
  return [
    `Hipótese principal: **${top.label}** (probabilidade ${(top.posterior * 100).toFixed(0)}%).`,
    `Top 3 hipóteses: ${ranking.slice(0, 3).map(h => `${h.label} (${Math.round(h.posterior * 100)}%)`).join(' · ')}.`,
    '',
    '**Dados da pulseira Care Plus:**',
    wearLine,
    '',
    '**Escalas validadas:**',
    `- STOP-BANG: ${computedScales.stopBang.score}/8 (${computedScales.stopBang.risk})`,
    `- PHQ-9: ${computedScales.phq9.score}/27 (${computedScales.phq9.severity})`,
    `- FINDRISC: ${computedScales.findrisc.score}/26 (${computedScales.findrisc.risk}) — ${(computedScales.findrisc.prob10y * 100).toFixed(0)}% em 10 anos`,
    `- Framingham: ${(computedScales.framingham.prob10y * 100).toFixed(0)}% risco CV em 10 anos (${computedScales.framingham.risk})`,
  ].join('\n');
};

const buildSuggestions = (level, ranking, computedScales, _wearableSnap) => {
  const out = [];
  const top = ranking[0];

  if (level === 'CRITICAL' || level === 'HIGH') {
    out.push({ type: 'action',  text: `Procurar avaliação médica nas próximas 24h focando em ${top.label}` });
    out.push({ type: 'warning', text: 'Se sintomas se intensificarem, ir ao pronto-socorro' });
  } else if (level === 'MODERATE') {
    out.push({ type: 'action',  text: `Agendar consulta de acompanhamento em até 7 dias (${top.label})` });
  } else {
    out.push({ type: 'info',    text: 'Sinais clínicos estáveis — manter rotina de monitoramento' });
  }

  if (computedScales.phq9.suicidalIdeation) {
    out.unshift({ type: 'warning', text: 'Procurar suporte de saúde mental imediato — CVV 188' });
  }
  if (computedScales.stopBang.risk === 'HIGH') {
    out.push({ type: 'exam', text: 'Solicitar polissonografia (STOP-BANG ≥ 3)' });
  }
  if (computedScales.findrisc.risk === 'HIGH' || computedScales.findrisc.risk === 'VERY_HIGH') {
    out.push({ type: 'exam', text: 'Solicitar glicemia em jejum + HbA1c (FINDRISC elevado)' });
  }
  if (computedScales.framingham.risk === 'HIGH') {
    out.push({ type: 'exam', text: 'Solicitar perfil lipídico + ECG (Framingham > 20% em 10 anos)' });
  }
  return out;
};

const explainPick = (next, leader) => {
  if (!leader) return null;
  return {
    ig: Number(next.ig.toFixed(3)),
    targetHypothesis: leader.label,
    targetProb: Number((leader.posterior * 100).toFixed(0)),
    cost: next.cost,
  };
};

const followUpDef = (id) => {
  for (const q of questions.SYMPTOM_QUESTIONS) {
    if (q.followUps?.some(fu => fu.id === id)) {
      return { type: 'boolean' };
    }
  }
  return null;
};

const binarizeFallback = (raw) => {
  if (raw === true || raw === 1 || raw === '1' || raw === 'Sim' || raw === 'sim') return 1;
  if (raw === false || raw === 0 || raw === '0' || raw === 'Não' || raw === 'nao' || raw === 'não') return 0;
  return null;
};

const ageFromDob = (dob) => {
  const ms = Date.now() - new Date(dob).getTime();
  return Math.floor(ms / (365.25 * 24 * 3600 * 1000));
};

const mapGender = (g) => {
  if (!g) return null;
  const s = String(g).toLowerCase();
  if (['m', 'male', 'masculino', 'h'].includes(s)) return 'male';
  if (['f', 'female', 'feminino'].includes(s))     return 'female';
  return s;
};

const computeBmi = (heightCm, weightKg) => {
  if (!heightCm || !weightKg) return null;
  const h = heightCm > 3 ? heightCm / 100 : heightCm; // aceita m ou cm
  if (!h) return null;
  return Number((weightKg / (h * h)).toFixed(1));
};

const emitCompleted = (patientId, triageId, riskLevel, reportId, isRedFlag = false) => {
  try {
    const io = getIO();
    io.to(`user:${patientId}`).emit('triage:completed', {
      triageId, riskLevel, reportId, isRedFlag,
    });
    if (['HIGH', 'CRITICAL'].includes(riskLevel)) {
      io.to('doctors').emit('triage:alert', { patientId, riskLevel, triageId, isRedFlag });
    }
  } catch (_) {}
};

// ─── Histórico e consulta (compat) ────────────────────────────────
const getTriageHistory = async (patientId, { page = 1, limit = 10 } = {}) => {
  const [total, items] = await Promise.all([
    prisma.triageAnswer.count({ where: { patientId } }),
    prisma.triageAnswer.findMany({
      where:   { patientId },
      skip:    (Number(page) - 1) * Number(limit),
      take:    Number(limit),
      orderBy: { startedAt: 'desc' },
    }),
  ]);
  return { total, page, limit, items: items.map(parseTriage) };
};

const getTriageById = async (triageId, patientId) => {
  const triage = await prisma.triageAnswer.findFirst({
    where:   { id: triageId, patientId },
    include: { aiReport: true },
  });
  if (!triage) throw Object.assign(new Error('Triagem não encontrada'), { status: 404 });
  const state = loadState(triage);
  const enriched = parseTriage(triage);
  enriched.session = state;
  return enriched;
};

module.exports = {
  getQuestions,
  startTriage,
  answerTriage,
  getTriageHistory,
  getTriageById,
};
