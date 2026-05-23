const authService = require('../services/authService');
const prisma      = require('../config/database');

/**
 * POST /auth/register
 */
const register = async (req, res, next) => {
  try {
    const { email, password, role, ...profileData } = req.body;
    const result = await authService.register({ email, password, role, profileData });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/refresh
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(400).json({ error: 'refreshToken obrigatório' });

    const tokens = await authService.refresh(refreshToken);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken, req.user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    await authService.changePassword(req.user.id, req.body);
    res.json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /auth/me
 */
const me = async (req, res) => {
  const { id, email, role } = req.user;

  let fullName = null;
  let healthCoins = null;
  if (role === 'PATIENT') {
    const p = await prisma.patient.findUnique({
      where:  { userId: id },
      select: { fullName: true, healthCoins: true },
    });
    fullName    = p?.fullName    ?? null;
    healthCoins = p?.healthCoins ?? 0;
  } else if (role === 'DOCTOR') {
    const d = await prisma.doctor.findUnique({ where: { userId: id }, select: { fullName: true } });
    fullName = d?.fullName ?? null;
  }

  res.json({ user: { id, email, role, fullName, healthCoins } });
};

module.exports = { register, login, refresh, logout, changePassword, me };
