// ─── Motor bayesiano + Information Gain ─────────────────────────────
// Implementa:
//  - Posterior bayesiano para múltiplas condições simultâneas:
//      posterior(D) ∝ prior(D) × ∏ P(sᵢ | D)^xᵢ × P(sᵢ | ¬D)^(1-xᵢ)
//  - Entropia de Shannon sobre a distribuição de hipóteses
//  - Information Gain ponderado por custo da pergunta
//  - Penalização de redundância para sintomas correlacionados
//  - Modo "alvo": quando uma hipótese lidera, prioriza perguntas que
//    confirmem ou excluam ESSA hipótese (em vez de balancear todas)

const { CONDITIONS, getCorrelation, resolvePrior } = require('./matrix');

const EPS = 1e-9;

// ─── Posterior bayesiano ─────────────────────────────────────────────
//
// evidence: { [symptomKey]: 0 | 1 | { value: 0|1, weight: number } }
//   weight permite que uma evidência da pulseira "pese mais" que um
//   sintoma autorrelatado — basta repetir o termo no produto.
// profile: { age, sex, bmi, smoker, packYears, familyHistoryDm, ... }
const computePosterior = (evidence = {}, profile = {}) => {
  const result = {};

  for (const cond of Object.values(CONDITIONS)) {
    const prior = clamp01(resolvePrior(cond.code, profile));
    let logOdds = Math.log(Math.max(prior, EPS) / Math.max(1 - prior, EPS));

    for (const [sx, raw] of Object.entries(evidence)) {
      const def = cond.symptoms[sx];
      if (!def) continue; // sintoma não pertinente a essa condição

      const value  = typeof raw === 'object' ? raw.value  : raw;
      const weight = typeof raw === 'object' ? Math.max(0, raw.weight ?? 1) : 1;
      if (value == null || (value !== 0 && value !== 1)) continue;

      const pSx     = clamp01(def.pSx);
      const pNoSx   = clamp01(def.pNoSx);
      const lr = value === 1
        ? Math.max(pSx, EPS)     / Math.max(pNoSx, EPS)
        : Math.max(1 - pSx, EPS) / Math.max(1 - pNoSx, EPS);

      logOdds += weight * Math.log(lr);
    }

    const odds = Math.exp(logOdds);
    const post = odds / (1 + odds);
    result[cond.code] = {
      code:  cond.code,
      label: cond.label,
      prior,
      posterior: clamp01(post),
    };
  }

  return result;
};

// Probabilidade de o sintoma estar presente, marginalizada sobre as
// condições atuais. Usada para calcular IG sem pular para o futuro.
const predictiveSymptomProb = (sx, posteriors) => {
  let p = 0;
  for (const [code, h] of Object.entries(posteriors)) {
    const def = CONDITIONS[code].symptoms[sx];
    if (!def) continue;
    p += h.posterior * def.pSx + (1 - h.posterior) * def.pNoSx;
  }
  // Normalizado pelo número de condições que enxergam o sintoma
  const n = Object.values(CONDITIONS).filter(c => c.symptoms[sx]).length;
  return n === 0 ? 0.5 : clamp01(p / n);
};

// Atualiza posteriores hipotéticos como se o sintoma viesse com valor v.
const projectPosteriorOnSymptom = (sx, value, evidence, profile) => {
  return computePosterior({ ...evidence, [sx]: value }, profile);
};

// ─── Entropia e Information Gain ─────────────────────────────────────
const shannon = (probs) => {
  let h = 0;
  for (const p of probs) {
    if (p <= EPS) continue;
    h -= p * Math.log2(p);
  }
  return h;
};

const distribution = (posteriors) => {
  const ps = Object.values(posteriors).map(h => h.posterior);
  const sum = ps.reduce((a, b) => a + b, 0) + EPS;
  return ps.map(p => p / sum);
};

const informationGain = (sx, evidence, profile) => {
  const basePost = computePosterior(evidence, profile);
  const Hbase    = shannon(distribution(basePost));

  const pPos = predictiveSymptomProb(sx, basePost);
  const pNeg = 1 - pPos;

  const Hpos = shannon(distribution(projectPosteriorOnSymptom(sx, 1, evidence, profile)));
  const Hneg = shannon(distribution(projectPosteriorOnSymptom(sx, 0, evidence, profile)));

  const Hcond = pPos * Hpos + pNeg * Hneg;
  return Math.max(0, Hbase - Hcond);
};

// ─── Seleção de próxima pergunta ────────────────────────────────────
//
// candidates: lista de { symptom, cost (1-5), question (qualquer payload) }
// asked: Set<symptomKey>
//
// Aplica:
//  - IG ponderado: IG / cost
//  - Penalização de redundância contra sintomas já respondidos
//  - Modo "alvo": se top hipótese > 0.5, dá bônus para sintomas mais
//    discriminativos para essa condição específica
const selectNextSymptom = (candidates, evidence, profile, opts = {}) => {
  const askedSet = new Set(Object.keys(evidence));
  const filtered = candidates.filter(c => !askedSet.has(c.symptom));
  if (filtered.length === 0) return null;

  const posts = computePosterior(evidence, profile);
  const top   = Object.values(posts).sort((a, b) => b.posterior - a.posterior)[0];
  const targetMode = top && top.posterior > (opts.targetThreshold ?? 0.5);

  let best = null;
  for (const cand of filtered) {
    const ig = informationGain(cand.symptom, evidence, profile);
    const cost = Math.max(1, cand.cost ?? 1);

    // Penalização de redundância: reduz IG conforme correlação média
    // com os sintomas já respondidos.
    let redundancy = 0;
    for (const askedSx of askedSet) {
      const r = getCorrelation(cand.symptom, askedSx);
      if (r > redundancy) redundancy = r;
    }
    const redundancyFactor = 1 - redundancy * 0.7;

    // Bônus por modo alvo: peso extra se o sintoma é específico para a
    // hipótese líder (LR+ alto).
    let targetBonus = 1;
    if (targetMode) {
      const def = CONDITIONS[top.code].symptoms[cand.symptom];
      if (def && def.lrPos >= 5) targetBonus = 1.4;
      else if (def && def.lrPos >= 3) targetBonus = 1.2;
      else if (!def) targetBonus = 0.8; // sintoma não fala da hipótese líder
    }

    const score = (ig / cost) * redundancyFactor * targetBonus;

    if (!best || score > best.score) {
      best = { ...cand, ig, score, redundancyFactor, targetBonus };
    }
  }

  return best;
};

// ─── Classificação de risco a partir do top posterior ───────────────
const classifyRisk = (posteriors) => {
  const sorted = Object.values(posteriors).sort((a, b) => b.posterior - a.posterior);
  const top = sorted[0];
  if (!top) return { riskLevel: 'INCONCLUSIVE', score: null, ranking: [] };

  let level;
  if (top.posterior >= 0.85) level = 'CRITICAL';
  else if (top.posterior >= 0.65) level = 'HIGH';
  else if (top.posterior >= 0.35) level = 'MODERATE';
  else if (top.posterior >= 0.15) level = 'LOW';
  else level = 'INCONCLUSIVE';

  return {
    riskLevel: level,
    score:     Math.round(top.posterior * 100),
    ranking:   sorted.slice(0, 5).map(h => ({
      code:      h.code,
      label:     h.label,
      posterior: Number(h.posterior.toFixed(3)),
      prior:     Number(h.prior.toFixed(3)),
    })),
  };
};

// Condição de parada da sessão adaptativa
const shouldStop = (posteriors, askedCount, opts = {}) => {
  const maxQ          = opts.maxQuestions      ?? 18;
  const minQ          = opts.minQuestions      ?? 6;
  const confThreshold = opts.confidenceCutoff  ?? 0.80;

  if (askedCount >= maxQ) return { stop: true, reason: 'max_questions' };
  if (askedCount < minQ)  return { stop: false };

  const top = Object.values(posteriors).sort((a, b) => b.posterior - a.posterior)[0];
  if (top && top.posterior >= confThreshold) {
    return { stop: true, reason: 'confidence_reached' };
  }
  return { stop: false };
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));

module.exports = {
  computePosterior,
  predictiveSymptomProb,
  informationGain,
  selectNextSymptom,
  classifyRisk,
  shouldStop,
  shannon,
};
