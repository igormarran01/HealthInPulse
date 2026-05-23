const { Router } = require('express');
const triageService  = require('../services/triageService');
const patientService = require('../services/patientService');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

// ─── Controller ──────────────────────────────────────────────

const getQuestions = (_req, res) => res.json(triageService.getQuestions());

const submit = async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    const triage  = await triageService.submitTriage(patient.id, req.body.answers);
    res.status(202).json({ message: 'Triagem recebida e sendo analisada', triage });
  } catch (err) { next(err); }
};

const history = async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    res.json(await triageService.getTriageHistory(patient.id, req.query));
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    res.json(await triageService.getTriageById(req.params.triageId, patient.id));
  } catch (err) { next(err); }
};

// ─── Routes ──────────────────────────────────────────────────

const router = Router();
router.use(authenticate);
router.use(authorize('PATIENT'));

router.get('/questions',        getQuestions);
router.get('/',                 history);
router.get('/:triageId',        getOne);
router.post('/', submit);

module.exports = router;
