'use strict';

/**
 * @file routes/authRoutes.js
 * @description Rutas de autenticación.
 *
 * FLUJO 1 — Dos pasos (multi-empresa):
 *   POST  /auth/verify-identity  → verifica credenciales, retorna tenants disponibles
 *   POST  /auth/select-tenant    → selecciona empresa, retorna tokens
 *
 * FLUJO 2 — Un solo paso (tenant conocido por subdominio):
 *   POST  /auth/login            → email + password + tenantId → tokens
 *
 * Protegidos:
 *   GET   /auth/me               → perfil del usuario autenticado
 *   POST  /auth/refresh          → renovar tokens
 *   POST  /auth/logout           → cerrar sesión actual
 *   POST  /auth/logout-all       → cerrar todas las sesiones
 */

const router = require('express').Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/authenticate');
const { authRateLimiter } = require('../middlewares/rateLimiter');
const validate = require('../middlewares/validate');
const { loginSchema, verifyIdentitySchema, selectTenantSchema, refreshTokenSchema } =
  require('../validators/authValidators');

// ── Públicos ────────────────────────────────────────────────
router.post('/verify-identity', authRateLimiter, validate(verifyIdentitySchema), authController.verifyIdentity);
router.post('/select-tenant',   authRateLimiter, validate(selectTenantSchema),   authController.selectTenant);
router.post('/login',           authRateLimiter, validate(loginSchema),           authController.login);
router.post('/refresh',         authRateLimiter, validate(refreshTokenSchema),    authController.refresh);
router.post('/logout',          validate(refreshTokenSchema),                     authController.logout);

// ── Protegidos ──────────────────────────────────────────────
router.get('/me',          authenticate, authController.me);
router.post('/logout-all', authenticate, authController.logoutAll);

module.exports = router;
