'use strict';

/**
 * @file models/userModel.js
 * @description Modelo de la tabla users en AUTH DB.
 *
 * DISEÑO: users es una tabla de IDENTIDADES (personas).
 *   - Un usuario existe una sola vez como persona.
 *   - Su pertenencia a tenants y su rol en cada uno vive en user_tenants.
 *   - La unicidad es simplemente UNIQUE(email).
 *
 * TABLA: users
 *   id            VARCHAR(36)  PK
 *   email         VARCHAR(200) UNIQUE NOT NULL
 *   password_hash VARCHAR(200) NOT NULL
 *   nombre        VARCHAR(100) NOT NULL
 *   is_active     BIT          DEFAULT 1   (desactiva acceso a toda la plataforma)
 *   created_at    DATETIME     NOT NULL
 *   updated_at    DATETIME     NOT NULL
 *   deleted_at    DATETIME     NULL
 */

const { getAuthDatabase } = require('../config/database');

const TABLE = 'users';

/**
 * Busca un usuario por email (para login).
 * Incluye password_hash para verificación de credenciales.
 */
async function findByEmail(email) {
  const db = getAuthDatabase();
  return db(TABLE)
    .where({ email, deleted_at: null })
    .first();
}

/**
 * Busca un usuario por ID.
 */
async function findById(id) {
  const db = getAuthDatabase();
  return db(TABLE)
    .where({ id, deleted_at: null })
    .first();
}

/**
 * Verifica si un email ya existe en la plataforma.
 */
async function existsByEmail(email) {
  const db = getAuthDatabase();
  const row = await db(TABLE)
    .where({ email, deleted_at: null })
    .select('id')
    .first();
  return !!row;
}

/**
 * Crea un nuevo usuario (identidad).
 */
async function create(userData) {
  const db = getAuthDatabase();
  await db(TABLE).insert(userData);
}

/**
 * Actualiza datos personales del usuario.
 */
async function updateById(id, updates) {
  const db = getAuthDatabase();
  return db(TABLE)
    .where({ id, deleted_at: null })
    .update({ ...updates, updated_at: new Date() });
}

/**
 * Soft delete — desactiva al usuario de TODA la plataforma.
 */
async function softDeleteById(id) {
  const db = getAuthDatabase();
  return db(TABLE)
    .where({ id, deleted_at: null })
    .update({ deleted_at: new Date(), updated_at: new Date(), is_active: false });
}

module.exports = {
  findByEmail,
  findById,
  existsByEmail,
  create,
  updateById,
  softDeleteById,
};