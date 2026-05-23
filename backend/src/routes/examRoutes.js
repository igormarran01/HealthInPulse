const { Router } = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/examController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validationMiddleware');
const { examUpload } = require('../config/multer');

const router = Router();

router.use(authenticate);

// ─── Paciente ────────────────────────────────────────────────
router.post(
  '/',
  authorize('PATIENT'),
  examUpload.single('file'),
  [body('title').notEmpty().trim()],
  validate,
  ctrl.upload,
);

router.get('/',           authorize('PATIENT'), ctrl.list);
router.get('/:examId',    authorize('PATIENT'), ctrl.getOne);
router.delete('/:examId', authorize('PATIENT'), ctrl.remove);

// ─── Médico ──────────────────────────────────────────────────
router.get('/doctor/:examId', authorize('DOCTOR'), ctrl.getForDoctor);

module.exports = router;
