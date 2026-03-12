'use strict';

/**
 * @file validators/authValidators.js
 */

const Joi = require('joi');

// Login en un solo paso (tenant conocido)
const loginSchema = Joi.object({
  email:    Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(6).required(),
  tenantId: Joi.string().uuid().required()
    .messages({ 'any.required': 'tenantId requerido. Si no lo conoces, usa /auth/verify-identity.' }),
});

// Paso 1: verificar identidad
const verifyIdentitySchema = Joi.object({
  email:    Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(6).required(),
});

// Paso 2: seleccionar empresa
const selectTenantSchema = Joi.object({
  userId:   Joi.string().uuid().required(),
  tenantId: Joi.string().uuid().required(),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword:     Joi.string().min(8).required(),
});

module.exports = {
  loginSchema,
  verifyIdentitySchema,
  selectTenantSchema,
  refreshTokenSchema,
  changePasswordSchema,
};
