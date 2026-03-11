'use strict';

/**
 * @file models/roleModel.js
 * @description Modelo de acceso a datos de la tabla roles en AUTH DB.
 *
 * Tener roles en tabla (en vez de VARCHAR fijo) permite:
 * - Agregar/renombrar roles sin tocar código
 * - Asignar permisos granulares por rol en el futuro
 * - Auditar qué roles existen en el sistema
 *
 * TABLA EN AUTH DB: roles
 *   id          INT           PK AUTOINCREMENT
 *   nombre      VARCHAR(50)   UNIQUE NOT NULL   (admin | cliente | empleado)
 *   descripcion VARCHAR(200)  NULL
 *   is_active   BIT           DEFAULT 1
 *   created_at  DATETIME      NOT NULL
 */

const { getAuthDatabase } = require('../config/database');

const TABLE = 'roles';

/**
 * Retorna todos los roles activos.
 * @returns {Array}
 */
async function findAll() {
  const db = getAuthDatabase();
  return db(TABLE)
    .where({ is_active: true })
    .orderBy('nombre', 'asc')
    .select('id', 'nombre', 'descripcion');
}

/**
 * Busca un rol por su ID.
 * @param {number} id
 * @returns {object|null}
 */
async function findById(id) {
  const db = getAuthDatabase();
  return db(TABLE).where({ id, is_active: true }).first();
}

/**
 * Busca un rol por su nombre.
 * @param {string} nombre
 * @returns {object|null}
 */
async function findByNombre(nombre) {
  const db = getAuthDatabase();
  return db(TABLE).where({ nombre, is_active: true }).first();
}

/**
 * Crea un nuevo rol.
 * @param {object} data - { nombre, descripcion }
 * @returns {number} ID del rol creado
 */
async function create({ nombre, descripcion = null }) {
  const db = getAuthDatabase();
  const [id] = await db(TABLE).insert({
    nombre,
    descripcion,
    is_active: true,
    created_at: new Date(),
  });
  return id;
}

/**
 * Actualiza un rol.
 * @param {number} id
 * @param {object} updates
 */
async function updateById(id, updates) {
  const db = getAuthDatabase();
  return db(TABLE).where({ id }).update(updates);
}

/**
 * Desactiva un rol (no elimina físicamente).
 * PRECAUCIÓN: verificar que ningún usuario tenga este rol antes de desactivar.
 * @param {number} id
 */
async function deactivateById(id) {
  const db = getAuthDatabase();
  return db(TABLE).where({ id }).update({ is_active: false });
}

module.exports = {
  findAll,
  findById,
  findByNombre,
  create,
  updateById,
  deactivateById,
};