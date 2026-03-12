'use strict';

/**
 * @file services/authService.js
 * @description Servicio de autenticación con modelo many-to-many.
 *
 * FLUJO DE LOGIN:
 *   1. Verificar identidad del usuario (email + password) en tabla users
 *   2. Si no se provee tenantId → retornar lista de tenants disponibles
 *      para que el cliente seleccione a cuál ingresar
 *   3. Si se provee tenantId → verificar membresía y generar tokens
 *
 * Esto permite un login en dos pasos (UX más limpia) o en uno solo
 * si el cliente ya conoce el tenantId (ej: viene del subdominio).
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const jwtConfig = require('../config/jwt');
const AppError = require('../utils/AppError');
const userModel = require('../models/userModel');
const userTenantModel = require('../models/userTenantModel');
const refreshTokenModel = require('../models/refreshTokenModel');

const SALT_ROUNDS = 12;

// -----------------------------------------------
// HELPERS PRIVADOS
// -----------------------------------------------

/**
 * Genera access + refresh token.
 * El payload incluye el tenantId y el rol del usuario EN ese tenant.
 */
function generateTokenPair(user, membership) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: membership.role_nombre,
    tenantId: membership.tenant_id,
  };

  const accessToken = jwt.sign(payload, jwtConfig.access.secret, {
    expiresIn: jwtConfig.access.expiresIn,
  });

  const refreshToken = jwt.sign(
    { sub: user.id, tenantId: membership.tenant_id },
    jwtConfig.refresh.secret,
    { expiresIn: jwtConfig.refresh.expiresIn }
  );

  return { accessToken, refreshToken };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// -----------------------------------------------
// SERVICIO PÚBLICO
// -----------------------------------------------

/**
 * PASO 1 DEL LOGIN — Verifica identidad (email + password).
 * Retorna la lista de tenants a los que pertenece el usuario.
 *
 * El frontend puede usar esto para mostrar un selector de empresa
 * antes de llamar a loginToTenant().
 *
 * @param {string} email
 * @param {string} password
 * @returns {{ userId, nombre, tenants: Array }}
 */
async function verifyIdentity(email, password) {
  const user = await userModel.findByEmail(email);
  if (!user) throw new AppError('Credenciales incorrectas.', 401);
  if (!user.is_active) throw new AppError('Cuenta desactivada.', 403);

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) throw new AppError('Credenciales incorrectas.', 401);

  // Retornar los tenants disponibles para este usuario
  const tenants = await userTenantModel.findTenantsByUser(user.id);
  const activeTenants = tenants.filter(t => t.is_active);

  if (activeTenants.length === 0) {
    throw new AppError('Este usuario no pertenece a ninguna empresa activa.', 403);
  }

  return {
    userId: user.id,
    nombre: user.nombre,
    tenants: activeTenants,
  };
}

/**
 * PASO 2 DEL LOGIN — Genera tokens para un tenant específico.
 * Verifica que el usuario tenga membresía activa en ese tenant.
 *
 * @param {string} userId
 * @param {string} tenantId
 * @returns {{ accessToken, refreshToken, user }}
 */
async function loginToTenant(userId, tenantId) {
  const user = await userModel.findById(userId);
  if (!user || !user.is_active) throw new AppError('Usuario no encontrado o inactivo.', 401);

  // Verificar membresía en el tenant solicitado
  const membership = await userTenantModel.findMembership(userId, tenantId);
  if (!membership || !membership.is_active) {
    throw new AppError('No tienes acceso a esta empresa.', 403);
  }

  const { accessToken, refreshToken } = generateTokenPair(user, membership);

  // Guardar refresh token
  const decoded = jwt.decode(refreshToken);
  await refreshTokenModel.create({
    id: uuidv4(),
    user_id: user.id,
    token_hash: hashToken(refreshToken),
    expires_at: new Date(decoded.exp * 1000),
    created_at: new Date(),
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      role: membership.role_nombre,
      tenantId: membership.tenant_id,
    },
  };
}

/**
 * LOGIN EN UN SOLO PASO — Para cuando el tenantId ya se conoce.
 * (Ej: login desde subdominio empresa-a.miapp.com)
 *
 * @param {string} email
 * @param {string} password
 * @param {string} tenantId
 * @returns {{ accessToken, refreshToken, user }}
 */
async function login(email, password, tenantId) {
  // 1. Verificar identidad
  const user = await userModel.findByEmail(email);
  if (!user) throw new AppError('Credenciales incorrectas.', 401);
  if (!user.is_active) throw new AppError('Cuenta desactivada.', 403);

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) throw new AppError('Credenciales incorrectas.', 401);

  // 2. Verificar membresía en el tenant
  const membership = await userTenantModel.findMembership(user.id, tenantId);
  if (!membership || !membership.is_active) {
    throw new AppError('No tienes acceso a esta empresa.', 403);
  }

  // 3. Generar tokens
  const { accessToken, refreshToken } = generateTokenPair(user, membership);

  const decoded = jwt.decode(refreshToken);
  await refreshTokenModel.create({
    id: uuidv4(),
    user_id: user.id,
    token_hash: hashToken(refreshToken),
    expires_at: new Date(decoded.exp * 1000),
    created_at: new Date(),
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      role: membership.role_nombre,
      tenantId: membership.tenant_id,
    },
  };
}

/**
 * Renueva el par de tokens.
 */
async function refreshTokens(refreshToken) {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, jwtConfig.refresh.secret);
  } catch {
    throw new AppError('Refresh token inválido o expirado.', 401);
  }

  const storedToken = await refreshTokenModel.findByTokenHash(hashToken(refreshToken));
  if (!storedToken) throw new AppError('Refresh token revocado o no encontrado.', 401);

  await refreshTokenModel.revokeByTokenHash(hashToken(refreshToken));

  const user = await userModel.findById(decoded.sub);
  if (!user || !user.is_active) throw new AppError('Usuario no encontrado o inactivo.', 401);

  // El refresh token incluye el tenantId para renovar en el mismo contexto
  const membership = await userTenantModel.findMembership(user.id, decoded.tenantId);
  if (!membership || !membership.is_active) {
    throw new AppError('Ya no tienes acceso a esta empresa.', 403);
  }

  const tokens = generateTokenPair(user, membership);

  const newDecoded = jwt.decode(tokens.refreshToken);
  await refreshTokenModel.create({
    id: uuidv4(),
    user_id: user.id,
    token_hash: hashToken(tokens.refreshToken),
    expires_at: new Date(newDecoded.exp * 1000),
    created_at: new Date(),
  });

  return tokens;
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  await refreshTokenModel.revokeByTokenHash(hashToken(refreshToken));
}

async function logoutAllSessions(userId) {
  await refreshTokenModel.revokeAllByUserId(userId);
}

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

module.exports = {
  verifyIdentity,
  loginToTenant,
  login,
  refreshTokens,
  logout,
  logoutAllSessions,
  hashPassword,
};
