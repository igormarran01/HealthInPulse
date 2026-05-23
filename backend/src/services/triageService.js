const prisma = require('../config/database');
const openaiService = require('./openaiService');
const goalService   = require('./goalService');
const { getIO } = require('../config/socket');
const { stringifyJson, parseTriage } = require('../utils/jsonField');

// Banco de perguntas de triagem
const TRIAGE_QUESTIONS = [
  { id: 'q1',  text: 'Qual é a sua queixa principal hoje?',          type: 'text'   },
  { id: 'q2',  text: 'Há quanto tempo está com esse sintoma?',       type: 'select', options: ['Hoje', '2-3 dias', '1 semana', 'Mais de 1 semana'] },
  { id: 'q3',  text: 'Intensidade da dor/desconforto (0-10)',        type: 'scale'  },
  { id: 'q4',  text: 'Está com febre?',                              type: 'boolean'},
  { id: 'q5',  text: 'Está com falta de ar?',                        type: 'boolean'},
  { id: 'q6',  text: 'Apresenta dor no peito?',                      type: 'boolean'},
  { id: 'q7',  text: 'Tem náusea ou vômito?',                        type: 'boolean'},
  { id: 'q8',  text: 'Tem alguma doença crônica relevante?',         type: 'text'   },
  { id: 'q9',  text: 'Está tomando alguma medicação?',               type: 'text'   },
  { id: 'q10', text: 'Tem alergia a algum medicamento?',             type: 'text'   },
];

const getQuestions = () => TRIAGE_QUESTIONS;

const submitTriage = async (patientId, answers) => {
  // Busca contexto do paciente para enriquecer a análise
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      fullName: true, dateOfBirth: true, gender: true,
      bloodType: true, allergies: true, chronicConds: true,
    },
  });

  // Cria registro de triagem
  const triage = await prisma.triageAnswer.create({
    data: {
      patientId,
      status:  'IN_PROGRESS',
      answers: stringifyJson(answers),
    },
  });

  // Analisa com IA em background
  processTriageAnalysis(triage.id, answers, patient, patientId).catch(console.error);

  return parseTriage(triage);
};

const processTriageAnalysis = async (triageId, answers, patientContext, patientId) => {
  try {
    const analysis = await openaiService.analyzeTriageAnswers(answers, patientContext);

    // Atualiza triagem com resultado
    const updatedTriage = await prisma.triageAnswer.update({
      where: { id: triageId },
      data: {
        status:    'COMPLETED',
        riskLevel: analysis.riskLevel,
        score:     analysis.score,
        finishedAt: new Date(),
      },
    });

    // Cria relatório de IA
    const report = await prisma.aiReport.create({
      data: {
        patientId,
        triageId:   triageId,
        type:       'triage',
        content:    analysis.summary,
        riskLevel:  analysis.riskLevel,
        suggestions: stringifyJson(analysis.suggestions),
      },
    });

    // Gera metas personalizadas + 20 coins de bônus pela triagem
    let generatedGoals = [];
    try {
      generatedGoals = await goalService.generateGoalsFromTriage(patientId, analysis, triageId);
    } catch (err) {
      console.error('Erro ao gerar metas da triagem:', err.message);
    }

    // Atualiza o registro de triagem com info dos resultados (pra UI consumir)
    await prisma.triageAnswer.update({
      where: { id: triageId },
      data:  {} // mantém só riskLevel/score já gravados
    });

    // Notifica paciente e médicos
    try {
      const io = getIO();
      io.to(`user:${patientId}`).emit('triage:completed', {
        triageId,
        riskLevel: analysis.riskLevel,
        reportId:  report.id,
        goalsCreated: generatedGoals.length,
        coinsEarned:  20,
      });
      if (['HIGH', 'CRITICAL'].includes(analysis.riskLevel)) {
        io.to('doctors').emit('triage:alert', {
          patientId,
          riskLevel: analysis.riskLevel,
          triageId,
        });
      }
    } catch (_) {}

  } catch (err) {
    await prisma.triageAnswer.update({
      where: { id: triageId },
      data:  { status: 'COMPLETED' },
    });
    console.error(`Erro ao processar triagem ${triageId}:`, err.message);
  }
};

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
    where: { id: triageId, patientId },
    include: { aiReport: true },
  });
  if (!triage) throw Object.assign(new Error('Triagem não encontrada'), { status: 404 });
  return parseTriage(triage);
};

module.exports = { getQuestions, submitTriage, getTriageHistory, getTriageById };
