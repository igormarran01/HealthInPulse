const { Router } = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/doctorController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validationMiddleware');
const { avatarUpload } = require('../config/multer');

const router = Router();

router.use(authenticate);
router.use(authorize('DOCTOR'));

// ─── Perfil ──────────────────────────────────────────────────
router.get('/',         ctrl.getProfile);
router.put('/', [body('fullName').optional().notEmpty()], validate, ctrl.updateProfile);
router.patch('/avatar', avatarUpload.single('avatar'), ctrl.updateAvatar);

// ─── Dashboard ───────────────────────────────────────────────
router.get('/dashboard', ctrl.getDashboard);

// ─── Pacientes ───────────────────────────────────────────────
router.get('/patients',            ctrl.getPatients);
router.get('/patients/:patientId', ctrl.getPatientDetail);
router.post(
  '/patients',
  [body('patientId').isUUID()],
  validate,
  ctrl.linkPatient,
);
router.delete('/patients/:patientId', ctrl.unlinkPatient);

// ─── Consolidado / Histórico (abas Wearable / Histórico / Relatório) ──
router.get('/patients/:patientId/consolidated', ctrl.getPatientConsolidated);
router.get('/patients/:patientId/history',      ctrl.getPatientHistory);

module.exports = router;
