const prisma = require('../config/database');
const { parsePatient, parseJson } = require('../utils/jsonField');

// ─── Perfil ──────────────────────────────────────────────────

const getProfile = async (userId) => {
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    include: { user: { select: { email: true, createdAt: true } } },
  });
  if (!doctor) throw Object.assign(new Error('Médico não encontrado'), { status: 404 });
  return doctor;
};

const updateProfile = async (userId, data) => {
  const doctor = await prisma.doctor.findUnique({ where: { userId } });
  if (!doctor) throw Object.assign(new Error('Médico não encontrado'), { status: 404 });

  return prisma.doctor.update({
    where: { userId },
    data: {
      fullName:  data.fullName,
      specialty: data.specialty,
      phone:     data.phone,
      bio:       data.bio,
    },
  });
};

const updateAvatar = async (userId, avatarUrl) =>
  prisma.doctor.update({ where: { userId }, data: { avatarUrl } });

// ─── Pacientes vinculados ────────────────────────────────────

const getPatients = async (doctorId, { page = 1, limit = 20, search } = {}) => {
  const p = Number(page)  || 1;
  const l = Number(limit) || 20;
  const where = {
    doctorLinks: { some: { doctorId } },
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { cpf:      { contains: search } },
          ],
        }
      : {}),
  };

  const [total, patients] = await Promise.all([
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      where,
      skip:  (p - 1) * l,
      take:  l,
      select: {
        id: true, fullName: true, dateOfBirth: true,
        gender: true, avatarUrl: true, bloodType: true,
        chronicConds: true,
      },
      orderBy: { fullName: 'asc' },
    }),
  ]);

  return {
    total, page, limit,
    patients: patients.map((p) => ({ ...p, chronicConds: parseJson(p.chronicConds, []) })),
  };
};

const getPatientDetail = async (doctorId, patientId) => {
  // Verifica vínculo
  const link = await prisma.doctorPatient.findUnique({
    where: { doctorId_patientId: { doctorId, patientId } },
  });
  if (!link) throw Object.assign(new Error('Paciente não vinculado'), { status: 403 });

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      user:       { select: { email: true } },
      vitalSigns: { orderBy: { recordedAt: 'desc' }, take: 10 },
      exams:      { orderBy: { uploadedAt: 'desc'  }, take: 5, include: { examResult: true } },
      aiReports:  { orderBy: { generatedAt: 'desc' }, take: 5 },
    },
  });
  if (!patient) throw Object.assign(new Error('Paciente não encontrado'), { status: 404 });

  const parsed = parsePatient(patient);
  parsed.aiReports = (patient.aiReports || []).map((r) => ({ ...r, suggestions: parseJson(r.suggestions, null) }));
  parsed.exams    = (patient.exams || []).map((e) => ({
    ...e,
    examResult: e.examResult ? { ...e.examResult, findings: parseJson(e.examResult.findings, []) } : null,
  }));
  return parsed;
};

const linkPatient = async (doctorId, patientId) => {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw Object.assign(new Error('Paciente não encontrado'), { status: 404 });

  return prisma.doctorPatient.upsert({
    where:  { doctorId_patientId: { doctorId, patientId } },
    update: {},
    create: { doctorId, patientId },
  });
};

const unlinkPatient = async (doctorId, patientId) => {
  const link = await prisma.doctorPatient.findUnique({
    where: { doctorId_patientId: { doctorId, patientId } },
  });
  if (!link) throw Object.assign(new Error('Vínculo não encontrado'), { status: 404 });

  return prisma.doctorPatient.delete({
    where: { doctorId_patientId: { doctorId, patientId } },
  });
};

// ─── Dashboard ───────────────────────────────────────────────

const getDashboard = async (doctorId) => {
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfWeek    = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    totalPatients,
    criticalAlerts,
    todayAppointments,
    upcomingAppointments,
    recentReports,
    appointmentsThisWeek,
    linkedPatients,
  ] = await Promise.all([
    prisma.doctorPatient.count({ where: { doctorId } }),
    prisma.aiReport.count({
      where: {
        doctorId,
        riskLevel: { in: ['HIGH', 'CRITICAL'] },
        generatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.appointment.count({
      where: {
        doctorId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        scheduledAt: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.appointment.findMany({
      where: {
        doctorId,
        status:      { in: ['SCHEDULED', 'CONFIRMED'] },
        scheduledAt: { gte: now },
      },
      take:    5,
      orderBy: { scheduledAt: 'asc' },
      include: { patient: { select: { fullName: true, avatarUrl: true } } },
    }),
    prisma.aiReport.findMany({
      where:   { doctorId },
      take:    5,
      orderBy: { generatedAt: 'desc' },
      include: { patient: { select: { id: true, fullName: true } } },
    }),
    prisma.appointment.findMany({
      where: {
        doctorId,
        status:      { in: ['SCHEDULED', 'CONFIRMED'] },
        scheduledAt: { gte: startOfToday, lt: endOfWeek },
      },
      select: { scheduledAt: true, status: true },
    }),
    prisma.patient.findMany({
      where: { doctorLinks: { some: { doctorId } } },
      select: {
        id: true, fullName: true, avatarUrl: true, chronicConds: true,
        aiReports: {
          where:   { riskLevel: { in: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] } },
          orderBy: { generatedAt: 'desc' },
          take:    1,
          select:  { riskLevel: true, generatedAt: true },
        },
      },
    }),
  ]);

  // Distribuição de risco entre pacientes (baseado no último report de cada)
  const riskDistribution = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0, NONE: 0 };
  const criticalPatients = [];
  for (const p of linkedPatients) {
    const last = p.aiReports[0];
    if (!last) { riskDistribution.NONE += 1; continue; }
    riskDistribution[last.riskLevel] = (riskDistribution[last.riskLevel] || 0) + 1;
    if (last.riskLevel === 'HIGH' || last.riskLevel === 'CRITICAL') {
      criticalPatients.push({
        id: p.id, fullName: p.fullName, avatarUrl: p.avatarUrl,
        riskLevel: last.riskLevel, generatedAt: last.generatedAt,
      });
    }
  }

  // Consultas agrupadas por dia da semana (0=hoje, 6=daqui 7d)
  const appointmentsByDay = Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(startOfToday.getTime() + i * 24 * 60 * 60 * 1000);
    const dayEnd   = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const count = appointmentsThisWeek.filter(
      (a) => a.scheduledAt >= dayStart && a.scheduledAt < dayEnd,
    ).length;
    return { date: dayStart, count };
  });

  return {
    totalPatients,
    criticalAlerts,
    todayAppointments,
    upcomingAppointments,
    recentReports,
    riskDistribution,
    appointmentsByDay,
    criticalPatients,
  };
};

// ─── Consolidado e histórico (para abas Wearable / Histórico / Relatório) ───
const assertLink = async (doctorId, patientId) => {
  const link = await prisma.doctorPatient.findUnique({
    where: { doctorId_patientId: { doctorId, patientId } },
  });
  if (!link) throw Object.assign(new Error('Paciente não vinculado'), { status: 403 });
};

const getPatientConsolidated = async (doctorId, patientId) => {
  await assertLink(doctorId, patientId);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [patient, latestVital, vitalsTrend, exams, aiReports, goals, lastTriage] = await Promise.all([
    prisma.patient.findUnique({
      where: { id: patientId },
      include: { user: { select: { email: true } } },
    }),
    prisma.vitalSign.findFirst({ where: { patientId }, orderBy: { recordedAt: 'desc' } }),
    prisma.vitalSign.findMany({
      where:   { patientId, recordedAt: { gte: thirtyDaysAgo } },
      orderBy: { recordedAt: 'asc' },
      select: { recordedAt: true, heartRate: true, systolic: true, diastolic: true, oxygenSat: true, glucose: true },
    }),
    prisma.exam.findMany({
      where:   { patientId },
      orderBy: { uploadedAt: 'desc' },
      take: 5,
      include: { examResult: true },
    }),
    prisma.aiReport.findMany({
      where:   { patientId },
      orderBy: { generatedAt: 'desc' },
      take: 3,
    }),
    prisma.healthGoal.findMany({
      where:   { patientId },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.triageAnswer.findFirst({
      where:   { patientId, status: 'COMPLETED' },
      orderBy: { finishedAt: 'desc' },
    }),
  ]);

  return {
    patient: parsePatient(patient),
    latestVital,
    vitalsTrend,
    exams: exams.map((e) => ({
      ...e,
      examResult: e.examResult ? { ...e.examResult, findings: parseJson(e.examResult.findings, []) } : null,
    })),
    aiReports: aiReports.map((r) => ({ ...r, suggestions: parseJson(r.suggestions, null) })),
    goals,
    lastTriage,
  };
};

const getPatientHistory = async (doctorId, patientId) => {
  await assertLink(doctorId, patientId);

  const [appointments, exams, aiReports, goals, notifications, triages] = await Promise.all([
    prisma.appointment.findMany({ where: { patientId }, orderBy: { scheduledAt: 'desc' } }),
    prisma.exam.findMany({ where: { patientId }, orderBy: { uploadedAt: 'desc' }, include: { examResult: true } }),
    prisma.aiReport.findMany({ where: { patientId }, orderBy: { generatedAt: 'desc' } }),
    prisma.healthGoal.findMany({ where: { patientId, status: 'DONE' }, orderBy: { completedAt: 'desc' } }),
    prisma.notification.findMany({
      where:   { userId: (await prisma.patient.findUnique({ where: { id: patientId }, select: { userId: true } }))?.userId, type: { in: ['ALERT', 'CRITICAL'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.triageAnswer.findMany({ where: { patientId, status: 'COMPLETED' }, orderBy: { finishedAt: 'desc' } }),
  ]);

  const events = [];

  for (const a of appointments) {
    events.push({
      kind:    'appointment',
      at:      a.scheduledAt,
      status:  a.status,
      title:   a.status === 'COMPLETED' ? 'Consulta realizada' : a.status === 'CANCELLED' ? 'Consulta cancelada' : 'Consulta agendada',
      detail:  a.notes || `${a.duration} min`,
      payload: { id: a.id, duration: a.duration },
    });
  }
  for (const e of exams) {
    events.push({
      kind:    'exam',
      at:      e.uploadedAt,
      title:   `Exame: ${e.title}`,
      detail:  e.examResult?.summary || (e.status === 'PROCESSING' ? 'Processando…' : null),
      risk:    e.examResult?.riskLevel || null,
      payload: { id: e.id },
    });
  }
  for (const r of aiReports) {
    events.push({
      kind:    'aiReport',
      at:      r.generatedAt,
      title:   r.type === 'full' ? 'Relatório completo gerado' : `Análise ${r.type}`,
      detail:  null,
      risk:    r.riskLevel || null,
      payload: { id: r.id },
    });
  }
  for (const g of goals) {
    events.push({
      kind:    'goal',
      at:      g.completedAt || g.startedAt,
      title:   `Meta concluída: ${g.title}`,
      detail:  `+${g.coinsReward} health-coins`,
      payload: { id: g.id },
    });
  }
  for (const n of notifications) {
    events.push({
      kind:    n.type === 'CRITICAL' ? 'critical' : 'alert',
      at:      n.createdAt,
      title:   n.title,
      detail:  n.message,
      payload: { id: n.id },
    });
  }
  for (const t of triages) {
    events.push({
      kind:    'triage',
      at:      t.finishedAt || t.startedAt,
      title:   'Triagem realizada',
      detail:  t.score != null ? `Score ${t.score}` : null,
      risk:    t.riskLevel || null,
      payload: { id: t.id },
    });
  }

  events.sort((a, b) => new Date(b.at) - new Date(a.at));
  return events;
};

module.exports = {
  getProfile, updateProfile, updateAvatar,
  getPatients, getPatientDetail, linkPatient, unlinkPatient,
  getDashboard,
  getPatientConsolidated, getPatientHistory,
};
