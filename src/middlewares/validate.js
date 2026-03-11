'use strict';

/**
 * @file middlewares/validate.js
 * @description Middleware genérico de validación usando esquemas Joi.
 *
 * Uso:
 *   router.post('/login', validate(loginSchema), authController.login)
 */

const AppError = require('../utils/AppError');

/**
 * Retorna un middleware que valida req.body con el esquema Joi dado.
 * @param {object} schema - Esquema Joi
 * @param {'body'|'query'|'params'} [source='body'] - Origen de los datos a validar
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,  // Reportar TODOS los errores, no solo el primero
      stripUnknown: true, // Eliminar campos no definidos en el esquema
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/['"]/g, ''),
      }));
      return next(new AppError('Datos de entrada inválidos.', 422, details));
    }

    // Reemplazar req[source] con el valor saneado por Joi
    req[source] = value;
    next();
  };
}

module.exports = validate;