'use strict';

/**
 * @file controllers/roleController.js
 * @description Controlador CRUD de roles.
 * Los roles son globales a la plataforma (no por tenant).
 * Solo superadmin puede crear/modificar/eliminar roles.
 * Cualquier usuario autenticado puede listarlos (para crear usuarios).
 */

const roleModel = require('../models/roleModel');
const AppError = require('../utils/AppError');
const { success, created } = require('../utils/apiResponse');

/**
 * GET /roles
 * Lista todos los roles activos. Accesible para cualquier usuario autenticado.
 */
async function listRoles(req, res, next) {
  try {
    const roles = await roleModel.findAll();
    return success(res, { data: roles });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /roles/:id
 */
async function getRoleById(req, res, next) {
  try {
    const role = await roleModel.findById(req.params.id);
    if (!role) throw new AppError('Rol no encontrado.', 404);
    return success(res, { data: role });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /roles
 * Solo superadmin.
 */
async function createRole(req, res, next) {
  try {
    const { nombre, descripcion } = req.body;

    const existing = await roleModel.findByNombre(nombre);
    if (existing) throw new AppError(`El rol "${nombre}" ya existe.`, 409);

    const id = await roleModel.create({ nombre, descripcion });
    const role = await roleModel.findById(id);

    return created(res, { message: 'Rol creado exitosamente.', data: role });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /roles/:id
 * Solo superadmin.
 */
async function updateRole(req, res, next) {
  try {
    const role = await roleModel.findById(req.params.id);
    if (!role) throw new AppError('Rol no encontrado.', 404);

    await roleModel.updateById(req.params.id, req.body);
    const updated = await roleModel.findById(req.params.id);

    return success(res, { message: 'Rol actualizado.', data: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /roles/:id
 * Solo superadmin. Desactiva el rol (soft).
 */
async function deleteRole(req, res, next) {
  try {
    const role = await roleModel.findById(req.params.id);
    if (!role) throw new AppError('Rol no encontrado.', 404);

    await roleModel.deactivateById(req.params.id);
    return success(res, { message: 'Rol desactivado.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { listRoles, getRoleById, createRole, updateRole, deleteRole };