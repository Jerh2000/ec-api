'use strict';

/**
 * @file middlewares/rateLimiter.js
 * @description Limitadores de tasa de peticiones para proteger la API.
 *
 * - globalRateLimiter: aplica a toda la API.
 * - authRateLimiter: más estricto, aplica solo a endpoints de autenticación.
 */

const rateLimit = require('express-rate-limit');

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 min

/**
 * Rate limiter global: 100 peticiones por ventana de tiempo.
 */
const globalRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,  // Retorna RateLimit-* en headers
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiadas peticiones. Intente de nuevo más tarde.',
  },
});

/**
 * Rate limiter para rutas de autenticación: 10 intentos por ventana.
 * Protege contra fuerza bruta en login.
 */
const authRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiados intentos de autenticación. Intente más tarde.',
  },
});

module.exports = { globalRateLimiter, authRateLimiter };