'use strict';

/**
 * @file config/jwt.js
 * @description Configuración centralizada de JSON Web Tokens.
 *
 * Se usan DOS tokens:
 * - Access Token: vida corta (8h), para autenticar peticiones.
 * - Refresh Token: vida larga (7d), para renovar el access token sin re-login.
 */

module.exports = {
  access: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  refresh: {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
};