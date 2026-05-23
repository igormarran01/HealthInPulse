const { Router } = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validationMiddleware');

const router = Router();

// ─── validações reutilizáveis ────────────────────────────────

const emailRule    = body('email').isEmail().normalizeEmail();
const passwordRule = body('password').isLength({ min: 8 }).withMessage('Senha mínima de 8 caracteres');

// ─── rotas públicas ──────────────────────────────────────────

router.post(
  '/register',
  [
    emailRule,
    passwordRule,
    body('role').isIn(['PATIENT', 'DOCTOR']),
    body('fullName').notEmpty().trim(),
  ],
  validate,
  authController.register,
);

router.post(
  '/login',
  [emailRule, body('password').notEmpty()],
  validate,
  authController.login,
);

router.post('/refresh', authController.refresh);

// ─── rotas protegidas ────────────────────────────────────────

router.use(authenticate);

router.get('/me', authController.me);

router.post('/logout', authController.logout);

router.post(
  '/change-password',
  [
    body('currentPassword').notEmpty(),
    passwordRule.withMessage('Nova senha mínima de 8 caracteres').bail().custom((val, { req }) => {
      if (val === req.body.currentPassword)
        throw new Error('Nova senha não pode ser igual à atual');
      return true;
    }),
  ],
  validate,
  authController.changePassword,
);

module.exports = router;
