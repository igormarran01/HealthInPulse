const { Router }    = require('express');
const prisma         = require('../config/database');
const openaiService  = require('../services/openaiService');
const patientService = require('../services/patientService');
const doctorService  = require('../services/doctorService');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const { parseAiReport, parseJson, stringifyJson } = require('../utils/jsonField');

// ─── Service ─────────────────────────────────────────────────

const generateFullReport = async (patientId, doctorId) => {
  const [patient, vitals, exams, triageAnswers] = await Promise.all([
    prisma.patient.findUnique({ where: { id: patientId } }),
    prisma.vitalSign.findMany({
      where:   { patientId },
      orderBy: { recordedAt: 'desc' },
      take: 10,
    }),
    prisma.exam.findMany({
      where:   { patientId, status: 'DONE' },
      orderBy: { uploadedAt: 'desc' },
      take: 5,
      include: { examResult: true },
    }),
    prisma.triageAnswer.findMany({
      where:   { patientId, status: 'COMPLETED' },
      orderBy: { startedAt: 'desc' },
      take: 3,
    }),
  ]);

  const analysis = await openaiService.generateHealthReport({ patient, vitals, exams, triageAnswers });

  const report = await prisma.aiReport.create({
    data: {
      patientId,
      doctorId: doctorId || null,
      type:      'full',
      content:   analysis.content,
      riskLevel: analysis.riskLevel,
      suggestions: stringifyJson(analysis.suggestions),
    },
  });
  return parseAiReport(report);
};

const listReports = async (patientId, { page = 1, limit = 10, type } = {}) => {
  const where = { patientId, ...(type ? { type } : {}) };
  const [total, items] = await Promise.all([
    prisma.aiReport.count({ where }),
    prisma.aiReport.findMany({
      where,
      skip:    (Number(page) - 1) * Number(limit),
      take:    Number(limit),
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true, type: true, riskLevel: true, generatedAt: true,
        suggestions: true,
        doctor: { select: { fullName: true } },
      },
    }),
  ]);
  return {
    total, page, limit,
    items: items.map((r) => ({ ...r, suggestions: parseJson(r.suggestions, null) })),
  };
};

const getReportById = async (reportId, patientId) => {
  const report = await prisma.aiReport.findFirst({
    where: { id: reportId, patientId },
    include: { doctor: { select: { fullName: true, specialty: true } } },
  });
  if (!report) throw Object.assign(new Error('Relatório não encontrado'), { status: 404 });
  return parseAiReport(report);
};

const getReportForDoctor = async (reportId, doctorId) => {
  const report = await prisma.aiReport.findUnique({
    where:   { id: reportId },
    include: {
      patient: { include: { doctorLinks: { where: { doctorId } } } },
    },
  });
  if (!report) throw Object.assign(new Error('Relatório não encontrado'), { status: 404 });
  if (!report.patient.doctorLinks.length)
    throw Object.assign(new Error('Acesso negado'), { status: 403 });
  return parseAiReport(report);
};

// ─── Router ──────────────────────────────────────────────────

const router = Router();
router.use(authenticate);

// Paciente: lista e detalha seus próprios relatórios
router.get('/', authorize('PATIENT'), async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    res.json(await listReports(patient.id, req.query));
  } catch (e) { next(e); }
});

router.get('/my/:reportId', authorize('PATIENT'), async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    res.json(await getReportById(req.params.reportId, patient.id));
  } catch (e) { next(e); }
});

// Médico: gera relatório completo para um paciente vinculado
router.post('/generate/:patientId', authorize('DOCTOR'), async (req, res, next) => {
  try {
    const doctor = await doctorService.getProfile(req.user.id);

    // Verifica vínculo
    const link = await prisma.doctorPatient.findUnique({
      where: { doctorId_patientId: { doctorId: doctor.id, patientId: req.params.patientId } },
    });
    if (!link) return res.status(403).json({ error: 'Paciente não vinculado' });

    const report = await generateFullReport(req.params.patientId, doctor.id);
    res.status(201).json(report);
  } catch (e) { next(e); }
});

// Médico: lê relatório de paciente vinculado
router.get('/doctor/:reportId', authorize('DOCTOR'), async (req, res, next) => {
  try {
    const doctor = await doctorService.getProfile(req.user.id);
    res.json(await getReportForDoctor(req.params.reportId, doctor.id));
  } catch (e) { next(e); }
});

module.exports = { router, generateFullReport, listReports };
