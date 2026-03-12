'use strict';

/**
 * @file utils/apiResponse.js
 * @description Helpers para construir respuestas HTTP estandarizadas.
 *
 * Todas las respuestas siguen este formato:
 * {
 *   "success": true | false,
 *   "message": "...",
 *   "data": { ... } | null,
 *   "meta": { ... }    ← opcional (paginación, etc.)
 * }
 */

/**
 * Respuesta exitosa (2xx)
 * @param {object} res - Express response
 * @param {object} options
 * @param {string} options.message
 * @param {*} options.data
 * @param {object} [options.meta]
 * @param {number} [options.statusCode=200]
 */
function success(res, { message = 'Operación exitosa', data = null, meta = null, statusCode = 200 } = {}) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

/**
 * Respuesta de recurso creado (201)
 */
function created(res, { message = 'Recurso creado', data = null } = {}) {
  return success(res, { message, data, statusCode: 201 });
}

/**
 * Respuesta de error (4xx / 5xx)
 * @param {object} res
 * @param {object} options
 * @param {string} options.message
 * @param {number} [options.statusCode=400]
 * @param {*} [options.errors] - Detalle de errores de validación
 */
function error(res, { message = 'Ocurrió un error', statusCode = 400, errors = null } = {}) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

/**
 * Respuesta paginada
 * @param {object} res
 * @param {object} options
 * @param {Array} options.data
 * @param {number} options.total - Total de registros
 * @param {number} options.page - Página actual
 * @param {number} options.limit - Registros por página
 */
function paginated(res, { data, total, page, limit, message = 'Consulta exitosa' } = {}) {
  return success(res, {
    message,
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
}

module.exports = { success, created, error, paginated };
