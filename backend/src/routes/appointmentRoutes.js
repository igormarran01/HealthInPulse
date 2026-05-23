const { Router }    = require('express');
const prisma         = require('../config/database');
const { getIO }      = require('../config/socket');
const patientService = require('../services/patientService');
const doctorService  = require('../services/doctorService');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const { body } = require('express-validator');
const { validate } = require('../middlewares/validationMiddleware');

// ─── Service ─────────────────────────────────────────────────

const create = async ({ patientId, doctorId, scheduledAt, duration, notes }) => {
  // Verifica vínculo
  const link = await prisma.doctorPatient.findUnique({
    where: { doctorId_patientId: { doctorId, patientId } },
  });
  if (!link) throw Object.assign(new Error('Médico não vinculado ao paciente'), { status: 403 });

  // Verifica conflito de agenda do médico
  const conflict = await prisma.appointment.findFirst({
    where: {
      doctorId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      scheduledAt: {
        gte: new Date(new Date(scheduledAt).getTime() - duration * 60000),
        lte: new Date(new Date(scheduledAt).getTime() + duration * 60000),
      },
    },
  });
  if (conflict) throw Object.assign(new Error('Médico já possui consulta neste horário'), { status: 409 });

  const appointment = await prisma.appointment.create({
    data: { patientId, doctorId, scheduledAt: new Date(scheduledAt), duration, notes },
    include: {
      patient: { select: { fullName: true } },
      doctor:  { select: { fullName: true, specialty: true } },
    },
  });

  // Notifica médico em tempo real
  try {
    getIO().to(`user:${appointment.doctor.userId}`).emit('appointment:new', appointment);
  } catch (_) {}

  return appointment;
};

const list = async ({ patientId, doctorId, status, page = 1, limit = 20 }) => {
  const where = {
    ...(patientId ? { patientId } : {}),
    ...(doctorId  ? { doctorId  } : {}),
    ...(status    ? { status    } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      skip:    (Number(page) - 1) * Number(limit),
      take:    Number(limit),
      orderBy: { scheduledAt: 'asc' },
      include: {
        patient: { select: { fullName: true, avatarUrl: true } },
        doctor:  { select: { fullName: true, specialty: true, avatarUrl: true } },
      },
    }),
  ]);

  return { total, page, limit, items };
};

const updateStatus = async (appointmentId, actorId, { status, notes }) => {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) throw Object.assign(new Error('Consulta não encontrada'), { status: 404 });

  // Só médico confirma/cancela; paciente só cancela
  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data:  { status, ...(notes ? { notes } : {}) },
    include: {
      patient: { select: { fullName: true } },
      doctor:  { select: { fullName: true } },
    },
  });

  // Notifica a outra parte
  try {
    const io = getIO();
    io.to(`user:${appt.patientId}`).emit('appointment:updated', updated);
    io.to(`user:${appt.doctorId}`).emit('appointment:updated',  updated);
  } catch (_) {}

  return updated;
};

// ─── Router ──────────────────────────────────────────────────

const router = Router();
router.use(authenticate);

// Paciente: agenda consulta
router.post(
  '/',
  authorize('PATIENT'),
  [
    body('doctorId').isUUID(),
    body('scheduledAt').isISO8601(),
    body('duration').optional().isInt({ min: 15, max: 120 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const patient = await patientService.getProfile(req.user.id);
      res.status(201).json(
        await create({ patientId: patient.id, ...req.body }),
      );
    } catch (e) { next(e); }
  },
);

// Paciente: lista suas consultas
router.get('/my', authorize('PATIENT'), async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    res.json(await list({ patientId: patient.id, ...req.query }));
  } catch (e) { next(e); }
});

// Médico: lista consultas da sua agenda
router.get('/doctor', authorize('DOCTOR'), async (req, res, next) => {
  try {
    const doctor = await doctorService.getProfile(req.user.id);
    res.json(await list({ doctorId: doctor.id, ...req.query }));
  } catch (e) { next(e); }
});

// Médico: confirma / cancela
router.patch(
  '/:id/status',
  authorize('DOCTOR', 'PATIENT'),
  [body('status').isIn(['CONFIRMED', 'CANCELLED', 'COMPLETED'])],
  validate,
  async (req, res, next) => {
    try {
      res.json(await updateStatus(req.params.id, req.user.id, req.body));
    } catch (e) { next(e); }
  },
);

module.exports = { router, create, list };
