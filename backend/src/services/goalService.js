const prisma = require('../config/database');
const coinService = require('./coinService');

const computeProgress = (goal, current) => {
  if (current == null) return goal.progress ?? 0;
  if (goal.targetCmp === 'lte' && goal.targetValue != null) {
    // Quanto menor melhor — progresso é 100 quando current <= target
    if (current <= goal.targetValue) return 100;
    // Se baseline > target, progresso é o quanto andou em direção ao alvo a partir de current inicial
    const startedFrom = goal.rangeMax ?? (goal.targetValue * 1.6);
    const total       = startedFrom - goal.targetValue;
    const done        = startedFrom - current;
    return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  }
  if (goal.targetCmp === 'gte' && goal.targetValue != null) {
    if (current >= goal.targetValue) return 100;
    const startedFrom = goal.rangeMin ?? 0;
    const total       = goal.targetValue - startedFrom;
    const done        = current - startedFrom;
    return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  }
  if (goal.targetCmp === 'between' && goal.rangeMin != null && goal.rangeMax != null) {
    if (current >= goal.rangeMin && current <= goal.rangeMax) return 100;
    // Distância proporcional ao centro da faixa
    const center = (goal.rangeMin + goal.rangeMax) / 2;
    const halfRange = (goal.rangeMax - goal.rangeMin) / 2;
    const dist = Math.abs(current - center);
    return Math.max(0, Math.min(100, Math.round(100 * (1 - (dist - halfRange) / Math.max(1, center)))));
  }
  return goal.progress ?? 0;
};

const listGoals = async (patientId, { status } = {}) => {
  const where = { patientId, ...(status ? { status } : {}) };
  return prisma.healthGoal.findMany({
    where,
    orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
  });
};

const createGoal = async (patientId, data) => {
  return prisma.healthGoal.create({
    data: {
      patientId,
      title:       data.title,
      description: data.description || null,
      metric:      data.metric || 'custom',
      targetCmp:   data.targetCmp || 'lte',
      targetValue: data.targetValue ?? null,
      rangeMin:    data.rangeMin    ?? null,
      rangeMax:    data.rangeMax    ?? null,
      current:     data.current     ?? null,
      progress:    0,
      coinsReward: data.coinsReward ?? 50,
      source:      data.source || 'manual',
    },
  });
};

/**
 * Atualiza o valor atual da meta. Se atingir 100% e ainda estiver ACTIVE,
 * marca como DONE e credita os coins.
 */
const updateProgress = async (goalId, current, patientId) => {
  const goal = await prisma.healthGoal.findFirst({
    where: { id: goalId, patientId },
  });
  if (!goal) throw Object.assign(new Error('Meta não encontrada'), { status: 404 });

  const progress = computeProgress(goal, current);
  const justFinished = goal.status === 'ACTIVE' && progress >= 100;

  const updated = await prisma.healthGoal.update({
    where: { id: goalId },
    data: {
      current,
      progress,
      status:      justFinished ? 'DONE'           : goal.status,
      completedAt: justFinished ? new Date()       : goal.completedAt,
    },
  });

  if (justFinished) {
    await coinService.credit(
      patientId,
      goal.coinsReward,
      `Meta concluída: ${goal.title}`,
      { refType: 'goal', refId: goal.id },
    );
  }

  return { goal: updated, justCompleted: justFinished };
};

/**
 * Gera metas iniciais para um paciente a partir do resultado de uma triagem.
 * `analysis` é o objeto retornado pelo openaiService (riskLevel + suggestions + summary).
 */
const generateGoalsFromTriage = async (patientId, analysis, triageId) => {
  const created = [];
  const goalsToCreate = [];

  const risk = analysis?.riskLevel || 'INCONCLUSIVE';

  // Metas universais (sempre criadas no início)
  goalsToCreate.push({
    title:       'Hidratação diária',
    description: 'Beba pelo menos 2 litros de água por dia',
    metric:      'custom',
    targetCmp:   'gte',
    targetValue: 7,
    rangeMin:    0,
    coinsReward: 30,
  });

  goalsToCreate.push({
    title:       'Caminhar 30 min/dia',
    description: 'Atividade aeróbica leve para manter o coração saudável',
    metric:      'steps',
    targetCmp:   'gte',
    targetValue: 7000,
    rangeMin:    0,
    coinsReward: 50,
  });

  // Metas adaptadas pelo nível de risco
  if (risk === 'HIGH' || risk === 'CRITICAL') {
    goalsToCreate.push({
      title:       'Controlar pressão arterial',
      description: 'Manter pressão sistólica abaixo de 130 mmHg',
      metric:      'systolic',
      targetCmp:   'lte',
      targetValue: 130,
      rangeMax:    160,
      coinsReward: 80,
    });
    goalsToCreate.push({
      title:       'Reduzir glicemia em jejum',
      description: 'Trazer glicemia média para abaixo de 130 mg/dL',
      metric:      'glucose',
      targetCmp:   'lte',
      targetValue: 130,
      rangeMax:    200,
      coinsReward: 80,
    });
  } else if (risk === 'MODERATE') {
    goalsToCreate.push({
      title:       'Estabilizar glicemia',
      description: 'Manter glicemia média abaixo de 110 mg/dL',
      metric:      'glucose',
      targetCmp:   'lte',
      targetValue: 110,
      rangeMax:    130,
      coinsReward: 60,
    });
    goalsToCreate.push({
      title:       'Pressão dentro do alvo',
      description: 'Manter pressão sistólica abaixo de 125 mmHg',
      metric:      'systolic',
      targetCmp:   'lte',
      targetValue: 125,
      rangeMax:    140,
      coinsReward: 60,
    });
  } else if (risk === 'LOW') {
    goalsToCreate.push({
      title:       'Manter sono regular',
      description: 'Dormir entre 7 e 9 horas por noite',
      metric:      'custom',
      targetCmp:   'between',
      rangeMin:    7,
      rangeMax:    9,
      coinsReward: 40,
    });
  } else {
    // INCONCLUSIVE: meta de fazer triagem novamente
    goalsToCreate.push({
      title:       'Nova triagem em 7 dias',
      description: 'Refazer a triagem para confirmar tendências',
      metric:      'custom',
      targetCmp:   'gte',
      targetValue: 1,
      rangeMin:    0,
      coinsReward: 25,
    });
  }

  for (const g of goalsToCreate) {
    const goal = await prisma.healthGoal.create({
      data: { patientId, ...g, source: 'triage', progress: 0, status: 'ACTIVE' },
    });
    created.push(goal);
  }

  // Bônus de coins por completar triagem
  await coinService.credit(
    patientId,
    20,
    'Bônus: triagem concluída',
    { refType: 'triage', refId: triageId || null },
  );

  return created;
};

module.exports = { listGoals, createGoal, updateProgress, generateGoalsFromTriage, computeProgress };
