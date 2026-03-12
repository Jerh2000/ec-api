'use strict';

/**
 * @file validators/userValidators.js
 */

const Joi = require('joi');

// Crear identidad (sin tenant ni rol — eso va en addToTenantSchema)
const createUserSchema = Joi.object({
  email:    Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(8).required(),
  nombre:   Joi.string().trim().min(2).max(100).required(),
});

// Actualizar datos personales
const updateUserSchema = Joi.object({
  nombre:    Joi.string().trim().min(2).max(100),
  is_active: Joi.boolean(),
}).min(1);

// Agregar usuario a un tenant
const addToTenantSchema = Joi.object({
  tenantId: Joi.string().uuid().required(),
  roleId:   Joi.number().integer().positive().required(),
});

// Cambiar rol en un tenant
const updateRoleSchema = Joi.object({
  roleId: Joi.number().integer().positive().required(),
});

const paginationSchema = Joi.object({
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  addToTenantSchema,
  updateRoleSchema,
  paginationSchema,
};
