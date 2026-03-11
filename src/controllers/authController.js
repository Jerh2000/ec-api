'use strict';

/**
 * @file controllers/authController.js
 * @description Controlador de autenticación.
 *
 * Expone dos flujos de login:
 *
 * FLUJO 1 — DOS PASOS (recomendado para apps multi-empresa):
 *   POST /auth/verify-identity → verifica email+password, retorna lista de tenants
 *   POST /auth/select-tenant   → elige el tenant, retorna tokens
 *
 * FLUJO 2 — UN SOLO PASO (cuando el tenantId ya se conoce):
 *   POST /auth/login           → email+password+tenantId → retorna tokens
 */

const authService = require('../services/authService');
const { success } = require('../utils/apiResponse');

/**
 * POST /auth/verify-identity
 * Body: { email, password }
 * Respuesta: { userId, nombre, tenants: [...] }
 */
async function verifyIdentity(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.verifyIdentity(email, password);

    return success(res, {
      message: 'Identidad verificada. Selecciona la empresa a la que deseas ingresar.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/select-tenant
 * Body: { userId, tenantId }
 * Respuesta: { accessToken, refreshToken, user }
 */
async function selectTenant(req, res, next) {
  try {
    const { userId, tenantId } = req.body;
    const result = await authService.loginToTenant(userId, tenantId);

    return success(res, {
      message: 'Sesión iniciada correctamente.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/login
 * Body: { email, password, tenantId }
 * Login en un solo paso — cuando el tenant ya se conoce (ej: subdominio).
 */
async function login(req, res, next) {
  try {
    const { email, password, tenantId } = req.body;
    const result = await authService.login(email, password, tenantId);

    return success(res, {
      message: 'Inicio de sesión exitoso.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/refresh
 */
async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshTokens(refreshToken);
    return success(res, { message: 'Token renovado.', data: tokens });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/logout
 */
async function logout(req, res, next) {
  try {
    await authService.logout(req.body.refreshToken);
    return success(res, { message: 'Sesión cerrada.' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/logout-all
 */
async function logoutAll(req, res, next) {
  try {
    await authService.logoutAllSessions(req.user.id);
    return success(res, { message: 'Todas las sesiones cerradas.' });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /auth/me
 */
async function me(req, res, next) {
  try {
    return success(res, { data: req.user });
  } catch (error) {
    next(error);
  }
}

module.exports = { verifyIdentity, selectTenant, login, refresh, logout, logoutAll, me };