'use strict';

/**
 * @file models/userTenantModel.js
 * @description Modelo de la tabla user_tenants en AUTH DB.
 *
 * Tabla de relación many-to-many entre users y tenants.
 * Aquí vive el ROL del usuario dentro de cada tenant.
 *
 * TABLA: user_tenants
 *   user_id    VARCHAR(36)  FK → users.id     NOT NULL
 *   tenant_id  VARCHAR(36)  FK → tenants.id   NOT NULL
 *   role_id    INT          FK → roles.id      NOT NULL
 *   is_active  BIT          DEFAULT 1
 *   created_at DATETIME     NOT NULL
 *   updated_at DATETIME     NOT NULL
 *
 *   PRIMARY KEY (user_id, tenant_id)
 *
 * Ejemplos:
 *   Juan (user 001) → Empresa A como empleado  (role_id: 3)
 *   Juan (user 001) → Empresa B como cliente   (role_id: 2)
 *   Ana  (user 002) → Empresa A como admin     (role_id: 1)
 */

const { getAuthDatabase } = require('../config/database');

const TABLE = 'user_tenants';

/**
 * Obtiene la membresía de un usuario en un tenant específico.
 * Incluye el nombre del rol via JOIN.
 *
 * @param {string} userId
 * @param {string} tenantId
 * @returns {object|null} { user_id, tenant_id, role_id, role_nombre, is_active }
 */
async function findMembership(userId, tenantId) {
  const db = getAuthDatabase();
  return db(TABLE)
    .join('roles', 'user_tenants.role_id', 'roles.id')
    .where({ 'user_tenants.user_id': userId, 'user_tenants.tenant_id': tenantId })
    .select(
      'user_tenants.user_id',
      'user_tenants.tenant_id',
      'user_tenants.role_id',
      'user_tenants.is_active',
      'roles.nombre as role_nombre'
    )
    .first();
}

/**
 * Lista todos los tenants a los que pertenece un usuario.
 * Útil al hacer login para mostrar en qué empresas está registrado.
 *
 * @param {string} userId
 * @returns {Array} [{ tenant_id, tenant_name, tenant_slug, role_nombre, is_active }]
 */
async function findTenantsByUser(userId) {
  const db = getAuthDatabase();
  return db(TABLE)
    .join('tenants', 'user_tenants.tenant_id', 'tenants.id')
    .join('roles', 'user_tenants.role_id', 'roles.id')
    .where({ 'user_tenants.user_id': userId, 'tenants.deleted_at': null })
    .select(
      'tenants.id as tenant_id',
      'tenants.name as tenant_name',
      'tenants.slug as tenant_slug',
      'roles.id as role_id',
      'roles.nombre as role_nombre',
      'user_tenants.is_active'
    )
    .orderBy('tenants.name', 'asc');
}

/**
 * Lista todos los usuarios de un tenant con paginación.
 *
 * @param {string} tenantId
 * @param {object} pagination - { page, limit }
 * @returns {{ data: Array, total: number }}
 */
async function findUsersByTenant(tenantId, { page = 1, limit = 20 } = {}) {
  const db = getAuthDatabase();
  const offset = (page - 1) * limit;

  const [data, [{ total }]] = await Promise.all([
    db(TABLE)
      .join('users', 'user_tenants.user_id', 'users.id')
      .join('roles', 'user_tenants.role_id', 'roles.id')
      .where({
        'user_tenants.tenant_id': tenantId,
        'users.deleted_at': null,
      })
      .orderBy('users.nombre', 'asc')
      .limit(limit)
      .offset(offset)
      .select(
        'users.id',
        'users.email',
        'users.nombre',
        'users.is_active as user_active',
        'user_tenants.is_active as tenant_active',
        'roles.id as role_id',
        'roles.nombre as role_nombre',
        'user_tenants.created_at as member_since'
      ),

    db(TABLE)
      .join('users', 'user_tenants.user_id', 'users.id')
      .where({ 'user_tenants.tenant_id': tenantId, 'users.deleted_at': null })
      .count('user_tenants.user_id as total'),
  ]);

  return { data, total: parseInt(total) };
}

/**
 * Agrega un usuario a un tenant con un rol específico.
 * Si ya existía la relación (aunque inactiva), la reactiva.
 *
 * @param {string} userId
 * @param {string} tenantId
 * @param {number} roleId
 */
async function addUserToTenant(userId, tenantId, roleId) {
  const db = getAuthDatabase();
  const now = new Date();

  // Verificar si ya existe la relación (puede estar inactiva)
  const existing = await db(TABLE)
    .where({ user_id: userId, tenant_id: tenantId })
    .first();

  if (existing) {
    // Reactivar y actualizar rol
    return db(TABLE)
      .where({ user_id: userId, tenant_id: tenantId })
      .update({ role_id: roleId, is_active: true, updated_at: now });
  }

  // Crear nueva membresía
  return db(TABLE).insert({
    user_id: userId,
    tenant_id: tenantId,
    role_id: roleId,
    is_active: true,
    created_at: now,
    updated_at: now,
  });
}

/**
 * Actualiza el rol de un usuario dentro de un tenant.
 *
 * @param {string} userId
 * @param {string} tenantId
 * @param {number} roleId
 */
async function updateMembershipRole(userId, tenantId, roleId) {
  const db = getAuthDatabase();
  return db(TABLE)
    .where({ user_id: userId, tenant_id: tenantId })
    .update({ role_id: roleId, updated_at: new Date() });
}

/**
 * Desactiva la membresía de un usuario en un tenant.
 * El usuario sigue existiendo como identidad y en otros tenants.
 *
 * @param {string} userId
 * @param {string} tenantId
 */
async function removeUserFromTenant(userId, tenantId) {
  const db = getAuthDatabase();
  return db(TABLE)
    .where({ user_id: userId, tenant_id: tenantId })
    .update({ is_active: false, updated_at: new Date() });
}

/**
 * Verifica si un usuario ya es miembro activo de un tenant.
 *
 * @param {string} userId
 * @param {string} tenantId
 * @returns {boolean}
 */
async function isMember(userId, tenantId) {
  const db = getAuthDatabase();
  const row = await db(TABLE)
    .where({ user_id: userId, tenant_id: tenantId, is_active: true })
    .select('user_id')
    .first();
  return !!row;
}

module.exports = {
  findMembership,
  findTenantsByUser,
  findUsersByTenant,
  addUserToTenant,
  updateMembershipRole,
  removeUserFromTenant,
  isMember,
};