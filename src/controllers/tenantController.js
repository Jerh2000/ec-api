'use strict';

/**
 * @file controllers/tenantController.js
 * @description Controlador CRUD de tenants. Solo accesible por superadmin.
 */

const tenantService = require('../services/tenantService');
const { success, created, paginated } = require('../utils/apiResponse');

async function createTenant(req, res, next) {
  try {
    const tenant = await tenantService.createTenant(req.body);
    return created(res, { message: 'Tenant creado exitosamente.', data: tenant });
  } catch (error) { next(error); }
}

async function listTenants(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { data, total } = await tenantService.listTenants({ page, limit });
    return paginated(res, { data, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) { next(error); }
}

async function getTenantById(req, res, next) {
  try {
    const { tenant } = await tenantService.getTenantContext(req.params.id);
    // No exponer credenciales de BD
    const { db_password, db_user, ...safeTenant } = tenant;
    return success(res, { data: safeTenant });
  } catch (error) { next(error); }
}

async function updateTenant(req, res, next) {
  try {
    const tenant = await tenantService.updateTenant(req.params.id, req.body);
    return success(res, { message: 'Tenant actualizado.', data: tenant });
  } catch (error) { next(error); }
}

async function deleteTenant(req, res, next) {
  try {
    await tenantService.deleteTenant(req.params.id);
    return success(res, { message: 'Tenant eliminado.' });
  } catch (error) { next(error); }
}

module.exports = { createTenant, listTenants, getTenantById, updateTenant, deleteTenant };