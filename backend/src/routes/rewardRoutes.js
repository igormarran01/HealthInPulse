const { Router } = require('express');
const rewardService  = require('../services/rewardService');
const patientService = require('../services/patientService');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

const router = Router();
router.use(authenticate);
router.use(authorize('PATIENT'));

router.get('/', async (_req, res, next) => {
  try { res.json(await rewardService.listAvailable()); }
  catch (e) { next(e); }
});

router.post('/:id/redeem', async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    res.status(201).json(await rewardService.redeem(patient.id, req.params.id));
  } catch (e) { next(e); }
});

router.get('/my/redemptions', async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    res.json(await rewardService.myRedemptions(patient.id));
  } catch (e) { next(e); }
});

module.exports = router;
