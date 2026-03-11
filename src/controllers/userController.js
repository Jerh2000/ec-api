'use strict';

/**
 * @file controllers/userController.js
 * @description Controlador de usuarios e membresías.
 *
 * Separación clara de responsabilidades:
 *   /users/*              → CRUD de identidades (personas)
 *   /users/:id/tenants/*  → Gestión de membresías de ese usuario
 */

const userService = require('../services/userService');
const { success, created, paginated } = require('../utils/apiResponse');

// ── IDENTIDAD ───────────────────────────────────────────────

/**
 * POST /users
 * Crea una nueva identidad (persona) en la plataforma.
 * No la asigna a ningún tenant todavía.
 */
async function createUser(req, res, next) {
  try {
    const user = await userService.createUser(req.body);
    return created(res, { message: 'Usuario creado. Ahora asígnalo a un tenant.', data: user });
  } catch (error) { next(error); }
}

/**
 * GET /users/:id
 */
async function getUserById(req, res, next) {
  try {
    const user = await userService.getUserById(req.params.id);
    return success(res, { data: user });
  } catch (error) { next(error); }
}

/**
 * PUT /users/:id
 * Actualiza datos personales (nombre, etc.).
 */
async function updateUser(req, res, next) {
  try {
    const user = await userService.updateUser(req.params.id, req.body);
    return success(res, { message: 'Usuario actualizado.', data: user });
  } catch (error) { next(error); }
}

/**
 * DELETE /users/:id
 * Elimina al usuario de toda la plataforma (soft delete).
 */
async function deleteUser(req, res, next) {
  try {
    await userService.deleteUser(req.params.id);
    return success(res, { message: 'Usuario eliminado de la plataforma.' });
  } catch (error) { next(error); }
}

/**
 * PATCH /users/:id/password
 */
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    await userService.changePassword(req.user.id, currentPassword, newPassword);
    return success(res, { message: 'Contraseña actualizada.' });
  } catch (error) { next(error); }
}

// ── MEMBRESÍAS ──────────────────────────────────────────────

/**
 * GET /users/:id/tenants
 * Lista los tenants a los que pertenece un usuario.
 */
async function listUserTenants(req, res, next) {
  try {
    const tenants = await userService.listTenantsByUser(req.params.id);
    return success(res, { data: tenants });
  } catch (error) { next(error); }
}

/**
 * GET /tenants/:tenantId/users
 * Lista usuarios de un tenant con paginación.
 */
async function listTenantUsers(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { data, total } = await userService.listUsersByTenant(
      req.params.tenantId,
      { page: parseInt(page), limit: parseInt(limit) }
    );
    return paginated(res, { data, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) { next(error); }
}

/**
 * POST /users/:id/tenants
 * Agrega al usuario a un tenant con un rol.
 * Body: { tenantId, roleId }
 */
async function addUserToTenant(req, res, next) {
  try {
    const { tenantId, roleId } = req.body;
    const result = await userService.addUserToTenant(req.params.id, tenantId, roleId);
    return created(res, { message: result.message, data: result });
  } catch (error) { next(error); }
}

/**
 * PATCH /users/:id/tenants/:tenantId/role
 * Cambia el rol de un usuario en un tenant específico.
 * Body: { roleId }
 */
async function updateUserRoleInTenant(req, res, next) {
  try {
    const { roleId } = req.body;
    const result = await userService.updateUserRoleInTenant(
      req.params.id,
      req.params.tenantId,
      roleId
    );
    return success(res, { message: 'Rol actualizado.', data: result });
  } catch (error) { next(error); }
}

/**
 * DELETE /users/:id/tenants/:tenantId
 * Desactiva la membresía del usuario en ese tenant.
 */
async function removeUserFromTenant(req, res, next) {
  try {
    await userService.removeUserFromTenant(req.params.id, req.params.tenantId);
    return success(res, { message: 'Usuario desvinculado del tenant.' });
  } catch (error) { next(error); }
}

module.exports = {
  createUser, getUserById, updateUser, deleteUser, changePassword,
  listUserTenants, listTenantUsers, addUserToTenant, updateUserRoleInTenant, removeUserFromTenant,
};