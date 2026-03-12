'use strict';

/**
 * @file services/tenantService.js
 * @description Servicio de gestión de tenants.
 *
 * Responsable de:
 * - CRUD de tenants
 * - Resolver la conexión a la BD del tenant (tenantContext)
 * - Cachear el contexto para evitar consultas repetidas a la AUTH DB
 */

const { v4: uuidv4 } = require('uuid');
const AppError = require('../utils/AppError');
const tenantModel = require('../models/tenantModel');
const { getTenantDatabase, closeTenantConnection } = require('../config/database');

// Cache de contextos de tenant en memoria
// { tenantId: { tenant, db } }
const tenantContextCache = new Map();

/**
 * Obtiene el contexto completo de un tenant (configuración + conexión a BD).
 * Cachea el resultado para no consultar la AUTH DB en cada petición.
 *
 * @param {string} tenantId
 * @returns {{ tenant: object, db: knexInstance }}
 */
async function getTenantContext(tenantId) {
  // Retornar del caché si existe
  if (tenantContextCache.has(tenantId)) {
    return tenantContextCache.get(tenantId);
  }

  const tenant = await tenantModel.findById(tenantId);
  if (!tenant) {
    throw new AppError('Tenant no encontrado.', 404);
  }
  if (!tenant.is_active) {
    throw new AppError('Tenant inactivo.', 403);
  }

  const db = getTenantDatabase({
    id: tenant.id,
    dbClient: tenant.db_client,
    dbHost: tenant.db_host,
    dbPort: tenant.db_port,
    dbUser: tenant.db_user,
    dbPassword: tenant.db_password,
    dbName: tenant.db_name,
  });

  const context = { tenant, db };
  tenantContextCache.set(tenantId, context);

  return context;
}

/**
 * Invalida el caché de un tenant (usado al actualizar/eliminar).
 * @param {string} tenantId
 */
function invalidateTenantCache(tenantId) {
  tenantContextCache.delete(tenantId);
}

/**
 * Crea un nuevo tenant.
 * @param {object} data
 */
async function createTenant(data) {
  const existing = await tenantModel.findBySlug(data.slug);
  if (existing) {
    throw new AppError('Ya existe un tenant con ese identificador (slug).', 409);
  }

  const tenantId = uuidv4();
  const now = new Date();

  await tenantModel.create({
    id: tenantId,
    name: data.name,
    slug: data.slug,
    db_client: data.dbClient,
    db_host: data.dbHost,
    db_port: data.dbPort,
    db_user: data.dbUser,
    db_password: data.dbPassword,
    db_name: data.dbName,
    is_active: true,
    created_at: now,
    updated_at: now,
  });

  return tenantModel.findById(tenantId);
}

/**
 * Lista todos los tenants (solo para superadmin).
 */
async function listTenants(pagination) {
  return tenantModel.findAll(pagination);
}

/**
 * Actualiza los datos de un tenant.
 */
async function updateTenant(id, updates) {
  const tenant = await tenantModel.findById(id);
  if (!tenant) throw new AppError('Tenant no encontrado.', 404);

  await tenantModel.updateById(id, updates);

  // Invalidar caché y reconectar en la próxima petición
  invalidateTenantCache(id);
  await closeTenantConnection(id);

  return tenantModel.findById(id);
}

/**
 * Elimina (soft delete) un tenant.
 */
async function deleteTenant(id) {
  const tenant = await tenantModel.findById(id);
  if (!tenant) throw new AppError('Tenant no encontrado.', 404);

  await tenantModel.softDeleteById(id);
  invalidateTenantCache(id);
  await closeTenantConnection(id);
}

module.exports = {
  getTenantContext,
  invalidateTenantCache,
  createTenant,
  listTenants,
  updateTenant,
  deleteTenant,
};
