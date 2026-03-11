'use strict';

/**
 * @file models/tenantModel.js
 * @description Modelo de acceso a datos de tenants en la AUTH DB.
 *
 * TABLA ESPERADA EN AUTH DB: tenants
 *   id            UUID / VARCHAR PK
 *   name          VARCHAR NOT NULL
 *   slug          VARCHAR UNIQUE NOT NULL  (identificador URL-friendly)
 *   db_client     VARCHAR  (mssql | mysql2)
 *   db_host       VARCHAR
 *   db_port       INT
 *   db_user       VARCHAR
 *   db_password   VARCHAR  (encriptado en producción)
 *   db_name       VARCHAR
 *   is_active     BIT DEFAULT 1
 *   created_at    DATETIME
 *   updated_at    DATETIME
 *   deleted_at    DATETIME NULL
 */

const { getAuthDatabase } = require('../config/database');

const TABLE = 'tenants';

async function findById(id) {
  const db = getAuthDatabase();
  return db(TABLE).where({ id, deleted_at: null }).first();
}

async function findBySlug(slug) {
  const db = getAuthDatabase();
  return db(TABLE).where({ slug, deleted_at: null }).first();
}

async function findAll({ page = 1, limit = 20 } = {}) {
  const db = getAuthDatabase();
  const offset = (page - 1) * limit;

  const [data, [{ total }]] = await Promise.all([
    db(TABLE)
      .where({ deleted_at: null })
      .orderBy('name', 'asc')
      .limit(limit)
      .offset(offset)
      .select('id', 'name', 'slug', 'is_active', 'created_at'),
    db(TABLE).where({ deleted_at: null }).count('id as total'),
  ]);

  return { data, total: parseInt(total) };
}

async function create(tenantData) {
  const db = getAuthDatabase();
  const [id] = await db(TABLE).insert(tenantData);
  return id || tenantData.id;
}

async function updateById(id, updates) {
  const db = getAuthDatabase();
  return db(TABLE)
    .where({ id, deleted_at: null })
    .update({ ...updates, updated_at: new Date() });
}

async function softDeleteById(id) {
  const db = getAuthDatabase();
  return db(TABLE)
    .where({ id, deleted_at: null })
    .update({ deleted_at: new Date(), updated_at: new Date(), is_active: false });
}

module.exports = {
  findById,
  findBySlug,
  findAll,
  create,
  updateById,
  softDeleteById,
};