'use strict';

/**
 * @file middlewares/errorHandler.js
 * @description Middleware centralizado de manejo de errores.
 *
 * Express detecta este middleware por tener 4 parámetros (err, req, res, next).
 * Toda excepción no capturada termina aquí.
 */

const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

/**
 * Middleware para rutas no encontradas (404).
 * Se coloca DESPUÉS de todas las rutas.
 */
function notFoundHandler(req, res, next) {
  next(new AppError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404));
}

/**
 * Manejador global de errores.
 * Transforma cualquier error en una respuesta JSON consistente.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Valores por defecto
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error interno del servidor';

  // ── Errores de Knex / BD ────────────────────────
  if (err.code === 'ECONNREFUSED' || err.code === 'ESOCKET') {
    statusCode = 503;
    message = 'No se puede conectar a la base de datos.';
  }

  // ── Errores de JWT ──────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token inválido.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expirado.';
  }

  // Loguear errores inesperados (bugs) con stack trace completo
  if (statusCode >= 500) {
    logger.error({
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
  } else {
    // Errores operacionales: solo advertencia
    logger.warn(`[${statusCode}] ${message} — ${req.method} ${req.originalUrl}`);
  }

  const body = {
    success: false,
    message,
  };

  // Incluir detalles de validación si existen
  if (err.details) {
    body.errors = err.details;
  }

  // En desarrollo, exponer el stack trace
  if (process.env.NODE_ENV === 'development') {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}

module.exports = { errorHandler, notFoundHandler };