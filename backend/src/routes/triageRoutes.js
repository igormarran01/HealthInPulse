const { Router }    = require('express');
const triageService  = require('../services/triageService');
const patientService = require('../services/patientService');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

// ─── Controller ──────────────────────────────────────────────

// Schema da triagem adaptativa (perfil + condições conhecidas).
// Mantém a rota antiga para o frontend antigo não quebrar.
const getQuestions = (_req, res) => res.json(triageService.getQuestions());

const start = async (req, res, next) => {
  try {
    const patient  = await patientService.getProfile(req.user.id);
    const session  = await triageService.startTriage(patient.id);
    res.status(201).json(session);
  } catch (err) { next(err); }
};

const answer = async (req, res, next) => {
  try {
    const patient = await patientService.getProfile(req.user.id);
    const session = await triageService.answerTriage(
      patient.id,
      req.params.triageId,
      req.body || {},
    );
    res.json(session);
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

router.get('/questions',          getQuestions);
router.get('/',                   history);
router.post('/start',             start);
router.post('/:triageId/answer',  answer);
router.get('/:triageId',          getOne);

module.exports = router;
