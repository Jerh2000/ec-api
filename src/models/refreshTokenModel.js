'use strict';

/**
 * @file models/refreshTokenModel.js
 * @description Gestión de refresh tokens en la AUTH DB.
 * Permite revocar tokens y controlar sesiones activas.
 *
 * TABLA ESPERADA EN AUTH DB: refresh_tokens
 *   id          UUID PK
 *   user_id     FK → users.id
 *   token_hash  VARCHAR UNIQUE  (hash del token, no el token en claro)
 *   expires_at  DATETIME
 *   created_at  DATETIME
 *   revoked_at  DATETIME NULL
 */

const { getAuthDatabase } = require('../config/database');

const TABLE = 'refresh_tokens';

async function create(tokenData) {
  const db = getAuthDatabase();
  await db(TABLE).insert(tokenData);
}

async function findByTokenHash(tokenHash) {
  const db = getAuthDatabase();
  return db(TABLE)
    .where({ token_hash: tokenHash, revoked_at: null })
    .where('expires_at', '>', new Date())
    .first();
}

async function revokeByTokenHash(tokenHash) {
  const db = getAuthDatabase();
  return db(TABLE)
    .where({ token_hash: tokenHash })
    .update({ revoked_at: new Date() });
}

/**
 * Revoca todos los tokens activos de un usuario (logout de todas las sesiones).
 */
async function revokeAllByUserId(userId) {
  const db = getAuthDatabase();
  return db(TABLE)
    .where({ user_id: userId, revoked_at: null })
    .update({ revoked_at: new Date() });
}

module.exports = {
  create,
  findByTokenHash,
  revokeByTokenHash,
  revokeAllByUserId,
};