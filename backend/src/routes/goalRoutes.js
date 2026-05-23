const { Router } = require('express');
const { body } = require('express-validator');
const goalService    = require('../services/goalService');
const coinService    = require('../services/coinService');
const patientService = require('../services/patientService');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validationMiddleware');

const router = Router();
router.use(authenticate);
router.use(authorize('PATIENT'));

router.get('/', async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    const status  = req.query.status;
    res.json(await goalService.listGoals(patient.id, status ? { status } : {}));
  } catch (e) { next(e); }
});

router.post(
  '/',
  [body('title').notEmpty().trim()],
  validate,
  async (req, res, next) => {
    try {
      const patient = await patientService.getProfile(req.user.id);
      res.status(201).json(await goalService.createGoal(patient.id, req.body));
    } catch (e) { next(e); }
  },
);

router.patch(
  '/:id/progress',
  [body('current').isFloat()],
  validate,
  async (req, res, next) => {
    try {
      const patient = await patientService.getProfile(req.user.id);
      res.json(await goalService.updateProgress(req.params.id, req.body.current, patient.id));
    } catch (e) { next(e); }
  },
);

// Saldo e histórico de coins (paciente)
router.get('/coins/balance', async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    res.json({ balance: await coinService.balance(patient.id) });
  } catch (e) { next(e); }
});

router.get('/coins/transactions', async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    res.json(await coinService.history(patient.id, { limit: 50 }));
  } catch (e) { next(e); }
});

module.exports = router;
