const { Router } = require('express');
const { body, query } = require('express-validator');
const ctrl = require('../controllers/patientController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validationMiddleware');
const { avatarUpload } = require('../config/multer');

const router = Router();

router.use(authenticate);
router.use(authorize('PATIENT'));

// ─── Perfil ──────────────────────────────────────────────────
router.get('/',          ctrl.getProfile);
router.put(
  '/',
  [body('fullName').optional().notEmpty().trim()],
  validate,
  ctrl.updateProfile,
);
router.patch('/avatar', avatarUpload.single('avatar'), ctrl.updateAvatar);

// ─── Dashboard ───────────────────────────────────────────────
router.get('/dashboard', ctrl.getDashboard);

// ─── Sinais Vitais ───────────────────────────────────────────
router.get('/vitals',        ctrl.getVitalSigns);
router.get('/vitals/latest', ctrl.getLatestVitals);
router.post(
  '/vitals',
  [
    body('heartRate').optional().isInt({ min: 20, max: 300 }),
    body('systolic').optional().isInt({ min: 50, max: 300 }),
    body('diastolic').optional().isInt({ min: 30, max: 200 }),
    body('oxygenSat').optional().isFloat({ min: 50, max: 100 }),
    body('temperature').optional().isFloat({ min: 30, max: 45 }),
    body('glucose').optional().isFloat({ min: 20, max: 600 }),
  ],
  validate,
  ctrl.addVitalSign,
);

module.exports = router;
