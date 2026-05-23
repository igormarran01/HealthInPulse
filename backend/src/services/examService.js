const fs      = require('fs');
const path    = require('path');
const prisma  = require('../config/database');
const { getIO } = require('../config/socket');
const openaiService = require('./openaiService');
const { parseExam, stringifyJson } = require('../utils/jsonField');

// ─── Upload ──────────────────────────────────────────────────

const uploadExam = async (patientId, file, { title, description }) => {
  const fileUrl  = `/uploads/exams/${file.filename}`;
  const fileType = file.mimetype === 'application/pdf' ? 'pdf' : 'image';

  const exam = await prisma.exam.create({
    data: { patientId, title, description, fileUrl, fileType, status: 'PENDING' },
  });

  // Processa em background
  processExam(exam.id, file.path, fileType, patientId).catch(console.error);

  return exam;
};

// ─── Processamento assíncrono ────────────────────────────────

const processExam = async (examId, filePath, fileType, patientId) => {
  try {
    await prisma.exam.update({ where: { id: examId }, data: { status: 'PROCESSING' } });

    // Lê o arquivo como base64 para enviar à OpenAI
    const fileBuffer = fs.readFileSync(filePath);
    const base64     = fileBuffer.toString('base64');
    const mimeType   = fileType === 'pdf' ? 'application/pdf' : 'image/jpeg';

    // Extrai texto e analisa com IA
    const analysis = await openaiService.analyzeExam({ base64, mimeType });

    // Salva resultado
    await prisma.$transaction([
      prisma.exam.update({
        where: { id: examId },
        data: {
          status:      'DONE',
          ocrText:     analysis.ocrText,
          processedAt: new Date(),
        },
      }),
      prisma.examResult.create({
        data: {
          examId,
          summary:   analysis.summary,
          findings:  stringifyJson(analysis.findings),
          riskLevel: analysis.riskLevel,
        },
      }),
    ]);

    // Notifica via socket
    try {
      getIO().to(`user:${patientId}`).emit('exam:processed', {
        examId,
        riskLevel: analysis.riskLevel,
      });
    } catch (_) {}

  } catch (err) {
    await prisma.exam.update({
      where: { id: examId },
      data: { status: 'ERROR' },
    });
    console.error(`Erro ao processar exame ${examId}:`, err.message);
  }
};

// ─── Listagem / detalhe ──────────────────────────────────────

const getExams = async (patientId, { page = 1, limit = 20, status } = {}) => {
  const where = { patientId, ...(status ? { status } : {}) };

  const [total, items] = await Promise.all([
    prisma.exam.count({ where }),
    prisma.exam.findMany({
      where,
      skip:    (Number(page) - 1) * Number(limit),
      take:    Number(limit),
      orderBy: { uploadedAt: 'desc' },
      include: { examResult: true },
    }),
  ]);

  return { total, page, limit, items: items.map(parseExam) };
};

const getExamById = async (examId, patientId) => {
  const exam = await prisma.exam.findFirst({
    where:   { id: examId, patientId },
    include: { examResult: true },
  });
  if (!exam) throw Object.assign(new Error('Exame não encontrado'), { status: 404 });
  return parseExam(exam);
};

const deleteExam = async (examId, patientId) => {
  const exam = await getExamById(examId, patientId);

  // Remove arquivo do disco
  const fullPath = path.join(__dirname, '..', exam.fileUrl);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

  return prisma.exam.delete({ where: { id: examId } });
};

// ─── Acesso do médico ────────────────────────────────────────

const getExamForDoctor = async (examId, doctorId) => {
  const exam = await prisma.exam.findUnique({
    where:   { id: examId },
    include: { examResult: true, patient: { include: { doctorLinks: true } } },
  });
  if (!exam) throw Object.assign(new Error('Exame não encontrado'), { status: 404 });

  const hasAccess = exam.patient.doctorLinks.some((l) => l.doctorId === doctorId);
  if (!hasAccess) throw Object.assign(new Error('Acesso negado'), { status: 403 });

  return parseExam(exam);
};

module.exports = { uploadExam, getExams, getExamById, deleteExam, getExamForDoctor };
