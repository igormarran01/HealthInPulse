const logger = require('../utils/logger');

const errorMiddleware = (err, req, res, _next) => {
  const status  = err.status || 500;
  const message = err.message || 'Erro interno do servidor';

  if (status >= 500) {
    logger.error({
      message,
      stack:  err.stack,
      path:   req.path,
      method: req.method,
      user:   req.user?.id,
    });
  }

  res.status(status).json({
    error:   message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorMiddleware;
