const { verifyAccessToken } = require('../config/jwt');

/**
 * Verifica o Bearer token e injeta req.user
 */
const authenticate = (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      return res.status(401).json({ error: 'Token não fornecido' });

    const token   = header.split(' ')[1];
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    res.status(401).json({
      error: expired ? 'Token expirado' : 'Token inválido',
    });
  }
};

/**
 * Restringe acesso a roles específicas
 * Uso: authorize('DOCTOR', 'ADMIN')
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ error: 'Não autenticado' });

  if (!roles.includes(req.user.role))
    return res.status(403).json({ error: 'Acesso negado' });

  next();
};

/**
 * Garante que o usuário só acessa seus próprios recursos
 * Compara req.user.id com o :userId da rota
 */
const authorizeOwnerOrDoctor = (req, res, next) => {
  const { role, id } = req.user;
  if (role === 'DOCTOR' || role === 'ADMIN') return next();
  if (id === req.params.userId || id === req.params.patientId) return next();
  res.status(403).json({ error: 'Acesso negado' });
};

module.exports = { authenticate, authorize, authorizeOwnerOrDoctor };
