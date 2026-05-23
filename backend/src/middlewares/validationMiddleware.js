const { validationResult } = require('express-validator');

/**
 * Coleta os erros do express-validator e retorna 422 se houver algum
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  res.status(422).json({
    error:  'Dados inválidos',
    fields: errors.array().map(({ path, msg }) => ({ field: path, message: msg })),
  });
};

module.exports = { validate };
