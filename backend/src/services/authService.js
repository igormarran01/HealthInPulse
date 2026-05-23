const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/database');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../config/jwt');

const SALT_ROUNDS = 12;

// ─── helpers ────────────────────────────────────────────────

const buildTokenPayload = (user) => ({
  id:    user.id,
  email: user.email,
  role:  user.role,
});

const issueTokenPair = async (user) => {
  const payload      = buildTokenPayload(user);
  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Persiste o refresh token
  await prisma.refreshToken.create({
    data: {
      token:     refreshToken,
      userId:    user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7d
    },
  });

  return { accessToken, refreshToken };
};

// ─── register ───────────────────────────────────────────────

const register = async ({ email, password, role, profileData }) => {
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw Object.assign(new Error('E-mail já cadastrado'), { status: 409 });

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role,
      // Cria o perfil vinculado em uma única transação
      ...(role === 'PATIENT' && {
        patient: { create: profileData },
      }),
      ...(role === 'DOCTOR' && {
        doctor: { create: profileData },
      }),
    },
    include: { patient: true, doctor: true },
  });

  const tokens = await issueTokenPair(user);
  return { user: sanitize(user), ...tokens };
};

// ─── login ──────────────────────────────────────────────────

const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      patient: { select: { fullName: true, healthCoins: true } },
      doctor:  { select: { fullName: true } },
    },
  });
  if (!user || !user.isActive)
    throw Object.assign(new Error('Credenciais inválidas'), { status: 401 });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid)
    throw Object.assign(new Error('Credenciais inválidas'), { status: 401 });

  // Log de auditoria
  await prisma.auditLog.create({
    data: { userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id },
  });

  const tokens = await issueTokenPair(user);
  return { user: sanitize(user), ...tokens };
};

// ─── refresh ────────────────────────────────────────────────

const refresh = async (token) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw Object.assign(new Error('Refresh token inválido'), { status: 401 });
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.expiresAt < new Date())
    throw Object.assign(new Error('Refresh token expirado'), { status: 401 });

  // Rotação: invalida o antigo, emite novo par
  await prisma.refreshToken.delete({ where: { token } });

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user || !user.isActive)
    throw Object.assign(new Error('Usuário inativo'), { status: 401 });

  return issueTokenPair(user);
};

// ─── logout ─────────────────────────────────────────────────

const logout = async (token, userId) => {
  await prisma.refreshToken.deleteMany({ where: { token } });
  await prisma.auditLog.create({
    data: { userId, action: 'LOGOUT', entity: 'User', entityId: userId },
  });
};

// ─── changePassword ─────────────────────────────────────────

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid)
    throw Object.assign(new Error('Senha atual incorreta'), { status: 400 });

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  // Invalida todos os refresh tokens ao trocar a senha
  await prisma.refreshToken.deleteMany({ where: { userId } });
};

// ─── sanitize ───────────────────────────────────────────────

const sanitize = (user) => {
  const { passwordHash, patient, doctor, ...safe } = user;
  return {
    ...safe,
    fullName:    patient?.fullName ?? doctor?.fullName ?? null,
    healthCoins: patient?.healthCoins ?? null,
  };
};

module.exports = { register, login, refresh, logout, changePassword };
