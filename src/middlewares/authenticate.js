'use strict';

/**
 * @file middlewares/authenticate.js
 * @description Middleware de autenticación mediante JWT.
 *
 * Verifica el access token en el header Authorization: Bearer <token>
 * y adjunta el payload decodificado a req.user.
 *
 * También carga el tenantContext si el usuario pertenece a un tenant.
 */

const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const AppError = require('../utils/AppError');
const tenantService = require('../services/tenantService');

/**
 * Middleware principal de autenticación.
 * Uso: router.get('/ruta', authenticate, controlador)
 */
async function authenticate(req, res, next) {
  try {
    // 1. Extraer token del header
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Token de autenticación requerido.', 401);
    }

    const token = authHeader.split(' ')[1];

    // 2. Verificar y decodificar el token
    const decoded = jwt.verify(token, jwtConfig.access.secret);

    // 3. Adjuntar información del usuario a la petición
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      tenantId: decoded.tenantId,
    };

    // 4. Cargar la configuración del tenant en la petición
    //    (conexión a su BD específica, etc.)
    if (decoded.tenantId) {
      req.tenantContext = await tenantService.getTenantContext(decoded.tenantId);
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware de autorización por roles.
 * Uso: router.delete('/ruta', authenticate, authorize('admin'), controlador)
 *
 * @param {...string} roles - Roles permitidos
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('No autenticado.', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('No tiene permisos para esta operación.', 403));
    }
    next();
  };
}

module.exports = { authenticate, authorize };