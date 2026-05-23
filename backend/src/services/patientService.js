const prisma = require('../config/database');
const { parsePatient, stringifyJson } = require('../utils/jsonField');

// ─── Perfil ──────────────────────────────────────────────────

const getProfile = async (userId) => {
  const patient = await prisma.patient.findUnique({
    where: { userId },
    include: {
      user: { select: { email: true, emailVerified: true, createdAt: true } },
    },
  });
  if (!patient) throw Object.assign(new Error('Paciente não encontrado'), { status: 404 });
  return parsePatient(patient);
};

const getById = async (patientId) => {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      user: { select: { email: true } },
    },
  });
  if (!patient) throw Object.assign(new Error('Paciente não encontrado'), { status: 404 });
  return parsePatient(patient);
};

const updateProfile = async (userId, data) => {
  const patient = await prisma.patient.findUnique({ where: { userId } });
  if (!patient) throw Object.assign(new Error('Paciente não encontrado'), { status: 404 });

  const updated = await prisma.patient.update({
    where: { userId },
    data: {
      fullName:      data.fullName,
      phone:         data.phone,
      bloodType:     data.bloodType,
      height:        data.height,
      weight:        data.weight,
      ...(Array.isArray(data.allergies)    && { allergies:    stringifyJson(data.allergies)    }),
      ...(Array.isArray(data.chronicConds) && { chronicConds: stringifyJson(data.chronicConds) }),
      emergencyName: data.emergencyName,
      emergencyPhone:data.emergencyPhone,
    },
  });
  return parsePatient(updated);
};

const updateAvatar = async (userId, avatarUrl) => {
  return prisma.patient.update({ where: { userId }, data: { avatarUrl } });
};

// ─── Sinais Vitais ───────────────────────────────────────────

const addVitalSign = async (patientId, data) => {
  return prisma.vitalSign.create({
    data: { patientId, ...data },
  });
};

const getVitalSigns = async (patientId, { page = 1, limit = 20, from, to } = {}) => {
  const where = {
    patientId,
    ...(from || to
      ? {
          recordedAt: {
            ...(from && { gte: new Date(from) }),
            ...(to   && { lte: new Date(to)   }),
          },
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.vitalSign.count({ where }),
    prisma.vitalSign.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      skip:  (Number(page) - 1) * Number(limit),
      take:  Number(limit),
    }),
  ]);

  return { total, page, limit, items };
};

const getLatestVitals = async (patientId) => {
  return prisma.vitalSign.findFirst({
    where:   { patientId },
    orderBy: { recordedAt: 'desc' },
  });
};

// ─── Dashboard ───────────────────────────────────────────────

const getDashboard = async (patientId) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    latestVitals,
    pendingExams,
    recentReports,
    upcomingAppointments,
    vitalsTrend,
    recentExams,
    unreadNotifs,
  ] = await Promise.all([
    prisma.vitalSign.findFirst({
      where:   { patientId },
      orderBy: { recordedAt: 'desc' },
    }),
    prisma.exam.count({
      where: { patientId, status: { in: ['PENDING', 'PROCESSING'] } },
    }),
    prisma.aiReport.findMany({
      where:   { patientId },
      orderBy: { generatedAt: 'desc' },
      take: 3,
      select: { id: true, type: true, riskLevel: true, generatedAt: true },
    }),
    prisma.appointment.findMany({
      where: {
        patientId,
        status:      { in: ['SCHEDULED', 'CONFIRMED'] },
        scheduledAt: { gte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 3,
      include: {
        doctor: { select: { fullName: true, specialty: true } },
      },
    }),
    prisma.vitalSign.findMany({
      where:   { patientId, recordedAt: { gte: thirtyDaysAgo } },
      orderBy: { recordedAt: 'asc' },
      select: {
        recordedAt: true,
        heartRate: true,
        systolic: true,
        diastolic: true,
        oxygenSat: true,
        glucose: true,
      },
    }),
    prisma.exam.findMany({
      where:   { patientId },
      orderBy: { uploadedAt: 'desc' },
      take: 3,
      include: { examResult: { select: { riskLevel: true } } },
    }),
    prisma.notification.count({ where: { userId: { in: await getUserIdFromPatient(patientId) }, read: false } }),
  ]);

  return {
    latestVitals,
    pendingExams,
    recentReports,
    upcomingAppointments,
    vitalsTrend,
    recentExams,
    unreadNotifs,
  };
};

const getUserIdFromPatient = async (patientId) => {
  const p = await prisma.patient.findUnique({ where: { id: patientId }, select: { userId: true } });
  return p ? [p.userId] : [];
};

module.exports = {
  getProfile,
  getById,
  updateProfile,
  updateAvatar,
  addVitalSign,
  getVitalSigns,
  getLatestVitals,
  getDashboard,
};
