'use strict';

/**
 * @file services/userService.js
 * @description Lógica de negocio para gestión de usuarios y membresías.
 *
 * Con el modelo many-to-many hay dos operaciones distintas:
 *
 *   1. Gestión de IDENTIDAD (tabla users):
 *      - Crear usuario (persona), actualizar datos personales, eliminar
 *
 *   2. Gestión de MEMBRESÍA (tabla user_tenants):
 *      - Agregar usuario a un tenant con un rol
 *      - Cambiar el rol de un usuario en un tenant
 *      - Desactivar la membresía de un usuario en un tenant
 */

const { v4: uuidv4 } = require('uuid');
const AppError = require('../utils/AppError');
const userModel = require('../models/userModel');
const userTenantModel = require('../models/userTenantModel');
const roleModel = require('../models/roleModel');
const authService = require('./authService');

// -----------------------------------------------
// GESTIÓN DE IDENTIDAD (tabla users)
// -----------------------------------------------

/**
 * Crea un nuevo usuario como identidad en la plataforma.
 * No lo asigna a ningún tenant — eso se hace con addToTenant().
 *
 * @param {object} data - { email, password, nombre }
 * @returns {object} Usuario creado
 */
async function createUser({ email, password, nombre }) {
  const alreadyExists = await userModel.existsByEmail(email);
  if (alreadyExists) {
    throw new AppError(`El email ${email} ya está registrado en la plataforma.`, 409);
  }

  const passwordHash = await authService.hashPassword(password);
  const userId = uuidv4();
  const now = new Date();

  await userModel.create({
    id: userId,
    email,
    password_hash: passwordHash,
    nombre,
    is_active: true,
    created_at: now,
    updated_at: now,
  });

  return { id: userId, email, nombre };
}

/**
 * Obtiene un usuario por ID (sin contraseña).
 */
async function getUserById(id) {
  const user = await userModel.findById(id);
  if (!user) throw new AppError('Usuario no encontrado.', 404);
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

/**
 * Actualiza datos personales del usuario (nombre, etc.).
 * No permite cambiar email ni contraseña por esta vía.
 */
async function updateUser(id, updates) {
  const user = await userModel.findById(id);
  if (!user) throw new AppError('Usuario no encontrado.', 404);

  delete updates.email;
  delete updates.password;
  delete updates.password_hash;

  await userModel.updateById(id, updates);
  return getUserById(id);
}

/**
 * Cambia la contraseña verificando la actual.
 * Al cambiar la contraseña, es válido para TODOS los tenants del usuario.
 */
async function changePassword(id, currentPassword, newPassword) {
  const user = await userModel.findById(id);
  if (!user) throw new AppError('Usuario no encontrado.', 404);

  const bcrypt = require('bcryptjs');
  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) throw new AppError('Contraseña actual incorrecta.', 400);

  const newHash = await authService.hashPassword(newPassword);
  await userModel.updateById(id, { password_hash: newHash });
}

/**
 * Elimina un usuario de toda la plataforma (soft delete).
 * Sus membresías quedan inactivas de facto.
 */
async function deleteUser(id) {
  const user = await userModel.findById(id);
  if (!user) throw new AppError('Usuario no encontrado.', 404);
  await userModel.softDeleteById(id);
}

// -----------------------------------------------
// GESTIÓN DE MEMBRESÍAS (tabla user_tenants)
// -----------------------------------------------

/**
 * Agrega un usuario existente a un tenant con un rol específico.
 * Si el usuario no existe aún en la plataforma, lanzar error
 * (primero se debe crear con createUser()).
 *
 * Caso de uso: Juan ya está en Empresa A y quiere darse de alta en Empresa B.
 * Solo se necesita su userId + el tenantId + el roleId.
 *
 * @param {string} userId
 * @param {string} tenantId
 * @param {number} roleId
 */
async function addUserToTenant(userId, tenantId, roleId) {
  const user = await userModel.findById(userId);
  if (!user) throw new AppError('Usuario no encontrado.', 404);

  const role = await roleModel.findById(roleId);
  if (!role) throw new AppError(`El rol con id ${roleId} no existe.`, 400);

  const alreadyMember = await userTenantModel.isMember(userId, tenantId);
  if (alreadyMember) {
    throw new AppError('El usuario ya es miembro activo de este tenant.', 409);
  }

  await userTenantModel.addUserToTenant(userId, tenantId, roleId);

  return {
    userId,
    tenantId,
    role: role.nombre,
    message: `Usuario agregado a tenant con rol "${role.nombre}".`,
  };
}

/**
 * Cambia el rol de un usuario dentro de un tenant.
 *
 * @param {string} userId
 * @param {string} tenantId
 * @param {number} roleId
 */
async function updateUserRoleInTenant(userId, tenantId, roleId) {
  const membership = await userTenantModel.findMembership(userId, tenantId);
  if (!membership) throw new AppError('El usuario no pertenece a este tenant.', 404);

  const role = await roleModel.findById(roleId);
  if (!role) throw new AppError(`El rol con id ${roleId} no existe.`, 400);

  await userTenantModel.updateMembershipRole(userId, tenantId, roleId);

  return { userId, tenantId, role: role.nombre };
}

/**
 * Lista los usuarios de un tenant con paginación.
 */
async function listUsersByTenant(tenantId, pagination) {
  return userTenantModel.findUsersByTenant(tenantId, pagination);
}

/**
 * Lista todos los tenants a los que pertenece un usuario.
 */
async function listTenantsByUser(userId) {
  const user = await userModel.findById(userId);
  if (!user) throw new AppError('Usuario no encontrado.', 404);
  return userTenantModel.findTenantsByUser(userId);
}

/**
 * Desactiva la membresía de un usuario en un tenant.
 * El usuario sigue existiendo y puede seguir accediendo a otros tenants.
 */
async function removeUserFromTenant(userId, tenantId) {
  const membership = await userTenantModel.findMembership(userId, tenantId);
  if (!membership) throw new AppError('El usuario no pertenece a este tenant.', 404);
  await userTenantModel.removeUserFromTenant(userId, tenantId);
}

module.exports = {
  // Identidad
  createUser,
  getUserById,
  updateUser,
  changePassword,
  deleteUser,
  // Membresías
  addUserToTenant,
  updateUserRoleInTenant,
  listUsersByTenant,
  listTenantsByUser,
  removeUserFromTenant,
};
