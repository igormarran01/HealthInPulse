const { Router }    = require('express');
const prisma         = require('../config/database');
const patientService = require('../services/patientService');
const openaiService  = require('../services/openaiService');
const { getIO }      = require('../config/socket');
const { body }       = require('express-validator');
const { validate }   = require('../middlewares/validationMiddleware');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const { stringifyJson, parseWearable } = require('../utils/jsonField');

// ─── Device Service ──────────────────────────────────────────

const listDevices = async (patientId) =>
  prisma.device.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } });

const registerDevice = async (patientId, data) =>
  prisma.device.create({ data: { patientId, ...data } });

const updateDeviceStatus = async (deviceId, patientId, status) => {
  const device = await prisma.device.findFirst({ where: { id: deviceId, patientId } });
  if (!device) throw Object.assign(new Error('Dispositivo não encontrado'), { status: 404 });
  return prisma.device.update({ where: { id: deviceId }, data: { status, lastSyncAt: new Date() } });
};

const removeDevice = async (deviceId, patientId) => {
  const device = await prisma.device.findFirst({ where: { id: deviceId, patientId } });
  if (!device) throw Object.assign(new Error('Dispositivo não encontrado'), { status: 404 });
  return prisma.device.delete({ where: { id: deviceId } });
};

// ─── Wearable Ingest ─────────────────────────────────────────

/**
 * Recebe payload bruto de wearable, persiste e tenta extrair
 * sinais vitais estruturados do JSON enviado pelo dispositivo.
 */
const ingestWearableData = async (patientId, deviceId, payload) => {
  // Persiste dado bruto
  const raw = await prisma.wearableData.create({
    data: { patientId, deviceId, payload: stringifyJson(payload) },
  });

  // Extrai vitais se o payload tiver campos conhecidos
  const vital = extractVitalsFromPayload(payload);
  if (vital && Object.keys(vital).length > 0) {
    const vitalRecord = await prisma.vitalSign.create({
      data: { patientId, ...vital, source: 'wearable' },
    });

    // Analisa se há alertas com IA (assíncrono, sem bloquear response)
    analyzeAndAlert(patientId, vitalRecord).catch(console.error);

    // Marca como processado
    await prisma.wearableData.update({
      where: { id: raw.id },
      data:  { processedAt: new Date() },
    });

    // Atualiza lastSyncAt do device
    if (deviceId) {
      await prisma.device.update({
        where: { id: deviceId },
        data:  { lastSyncAt: new Date(), status: 'ACTIVE' },
      });
    }

    return { raw, vital: vitalRecord };
  }

  return { raw, vital: null };
};

const extractVitalsFromPayload = (payload) => {
  // Mapeamento de campos comuns de APIs de wearables (Garmin, Apple Health, Fitbit, etc.)
  return {
    ...(payload.heart_rate  != null && { heartRate:   Math.round(payload.heart_rate)  }),
    ...(payload.heartRate   != null && { heartRate:   Math.round(payload.heartRate)   }),
    ...(payload.spo2        != null && { oxygenSat:   payload.spo2                    }),
    ...(payload.oxygen_sat  != null && { oxygenSat:   payload.oxygen_sat              }),
    ...(payload.systolic    != null && { systolic:    payload.systolic                }),
    ...(payload.diastolic   != null && { diastolic:   payload.diastolic               }),
    ...(payload.temperature != null && { temperature: payload.temperature             }),
    ...(payload.weight      != null && { weight:      payload.weight                  }),
    ...(payload.glucose     != null && { glucose:     payload.glucose                 }),
    ...(payload.resp_rate   != null && { respirRate:  payload.resp_rate               }),
  };
};

const analyzeAndAlert = async (patientId, vital) => {
  try {
    const patient = await prisma.patient.findUnique({
      where:  { id: patientId },
      select: { dateOfBirth: true, chronicConds: true },
    });

    const analysis = await openaiService.analyzeVitalSign(vital, patient);

    if (analysis.alert && analysis.severity !== 'none') {
      // Cria notificação persistida
      await prisma.notification.create({
        data: {
          userId:   (await prisma.patient.findUnique({ where: { id: patientId }, select: { userId: true } })).userId,
          type:     analysis.severity === 'high' ? 'CRITICAL' : 'ALERT',
          title:    'Alerta de sinal vital',
          message:  analysis.message,
          metadata: stringifyJson({ vital, severity: analysis.severity }),
        },
      });

      // Push em tempo real
      getIO().to(`user:${patientId}`).emit('vital:alert', {
        severity: analysis.severity,
        message:  analysis.message,
        vital,
      });

      // Se crítico, avisa médicos também
      if (analysis.severity === 'high') {
        getIO().to('doctors').emit('patient:critical', { patientId, vital, message: analysis.message });
      }
    }
  } catch (err) {
    console.error('Erro na análise de vital em tempo real:', err.message);
  }
};

const getWearableHistory = async (patientId, { page = 1, limit = 20 } = {}) => {
  const [total, items] = await Promise.all([
    prisma.wearableData.count({ where: { patientId } }),
    prisma.wearableData.findMany({
      where:   { patientId },
      skip:    (Number(page) - 1) * Number(limit),
      take:    Number(limit),
      orderBy: { createdAt: 'desc' },
      include: { device: { select: { name: true, type: true } } },
    }),
  ]);
  return { total, page, limit, items: items.map(parseWearable) };
};

// ─── Router ──────────────────────────────────────────────────

const router = Router();
router.use(authenticate);
router.use(authorize('PATIENT'));

// Dispositivos
router.get('/devices', async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    res.json(await listDevices(patient.id));
  } catch (e) { next(e); }
});

router.post(
  '/devices',
  [body('name').notEmpty(), body('type').isIn(['SMARTWATCH','OXIMETER','PRESSURE_MONITOR','ECG','GLUCOMETER','OTHER'])],
  validate,
  async (req, res, next) => {
    try {
      const patient = await patientService.getProfile(req.user.id);
      res.status(201).json(await registerDevice(patient.id, req.body));
    } catch (e) { next(e); }
  },
);

router.patch('/devices/:deviceId/status', async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    res.json(await updateDeviceStatus(req.params.deviceId, patient.id, req.body.status));
  } catch (e) { next(e); }
});

router.delete('/devices/:deviceId', async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    await removeDevice(req.params.deviceId, patient.id);
    res.status(204).send();
  } catch (e) { next(e); }
});

// Ingestão de dados brutos de wearable
router.post('/ingest', async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    const result  = await ingestWearableData(patient.id, req.body.deviceId, req.body.payload);
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// Histórico de dados brutos
router.get('/history', async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    res.json(await getWearableHistory(patient.id, req.query));
  } catch (e) { next(e); }
});

module.exports = { router, ingestWearableData };
