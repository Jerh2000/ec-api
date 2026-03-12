'use strict';

/**
 * @file utils/AppError.js
 * @description Error personalizado de la aplicación.
 * Permite distinguir errores operacionales (esperados) de bugs inesperados.
 *
 * Uso:
 *   throw new AppError('Usuario no encontrado', 404);
 */

class AppError extends Error {
  /**
   * @param {string} message - Mensaje de error legible
   * @param {number} statusCode - Código HTTP (400, 401, 403, 404, etc.)
   * @param {*} [details] - Información adicional (ej: errores de validación)
   */
  constructor(message, statusCode = 500, details = null) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;

    // Errores operacionales son esperados (ej: 404, 401)
    // Errores de programación son bugs (ej: 500)
    this.isOperational = statusCode < 500;

    // Capturar stack trace limpio
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
