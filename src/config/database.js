'use strict';

/**
 * @file config/database.js
 * @description Gestión centralizada de conexiones a bases de datos.
 *
 * ARQUITECTURA MULTITENANT:
 * - Existe una BD de autenticación (AUTH DB) que almacena usuarios y tenants.
 * - Cada tenant tiene su propia BD con idéntica estructura.
 * - Las conexiones a tenants se crean dinámicamente y se cachean en memoria
 *   para no abrir una conexión nueva en cada petición.
 *
 *  AUTH DB ──► usuarios, tenants, refresh_tokens
 *  TENANT DB ──► datos propios de cada empresa/tenant
 */

const knex = require('knex');
const logger = require('../utils/logger');

// Cache de conexiones activas { tenantId: knexInstance }
const connectionPool = new Map();

// -----------------------------------------------
// CONSTRUCTOR DE CONFIGURACIÓN KNEX
// -----------------------------------------------

/**
 * Genera la configuración de knex según el motor de BD.
 * @param {object} params - Parámetros de conexión
 * @param {'mssql'|'mysql2'} params.client - Motor de BD
 * @param {string} params.host
 * @param {number} params.port
 * @param {string} params.user
 * @param {string} params.password
 * @param {string} params.database
 * @returns {object} Configuración knex
 */
function buildKnexConfig({ client, host, port, user, password, database }) {
  const baseConfig = {
    client,
    connection: { host, port, user, password, database },
    pool: {
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      max: parseInt(process.env.DB_POOL_MAX) || 10,
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
      acquireTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT) || 60000,
    },
    // Reconexión automática
    acquireConnectionTimeout: 60000,
  };

  // SQL Server requiere opciones adicionales
  if (client === 'mssql') {
    baseConfig.connection.options = {
      encrypt: process.env.NODE_ENV === 'production',
      trustServerCertificate: process.env.NODE_ENV !== 'production',
    };
  }

  return baseConfig;
}

// -----------------------------------------------
// BASE DE DATOS DE AUTENTICACIÓN
// -----------------------------------------------

let authDb = null;

/**
 * Inicializa y verifica la conexión a la BD de autenticación.
 * Debe llamarse una sola vez al arrancar el servidor.
 */
async function initAuthDatabase() {
  const config = buildKnexConfig({
    client: process.env.AUTH_DB_CLIENT || 'mssql',
    host: process.env.AUTH_DB_HOST,
    port: parseInt(process.env.AUTH_DB_PORT),
    user: process.env.AUTH_DB_USER,
    password: process.env.AUTH_DB_PASSWORD,
    database: process.env.AUTH_DB_NAME,
  });

  authDb = knex(config);

  // Verificar conectividad
  await authDb.raw('SELECT 1');
  logger.info(`Conectado a AUTH DB: ${process.env.AUTH_DB_NAME}`);

  return authDb;
}

/**
 * Retorna la instancia de la BD de autenticación.
 * @throws {Error} Si la BD no ha sido inicializada.
 */
function getAuthDatabase() {
  if (!authDb) {
    throw new Error('La base de datos de autenticación no ha sido inicializada.');
  }
  return authDb;
}

// -----------------------------------------------
// BASES DE DATOS DE TENANTS
// -----------------------------------------------

/**
 * Obtiene o crea la conexión a la BD de un tenant específico.
 * Las conexiones se cachean para reutilizarse entre peticiones.
 *
 * @param {object} tenantConfig - Configuración del tenant obtenida de AUTH DB
 * @param {string} tenantConfig.id - ID único del tenant
 * @param {'mssql'|'mysql2'} tenantConfig.dbClient
 * @param {string} tenantConfig.dbHost
 * @param {number} tenantConfig.dbPort
 * @param {string} tenantConfig.dbUser
 * @param {string} tenantConfig.dbPassword
 * @param {string} tenantConfig.dbName
 * @returns {object} Instancia knex para el tenant
 */
function getTenantDatabase(tenantConfig) {
  const { id } = tenantConfig;

  // Retornar conexión cacheada si ya existe
  if (connectionPool.has(id)) {
    return connectionPool.get(id);
  }

  // Crear nueva conexión para este tenant
  const config = buildKnexConfig({
    client: tenantConfig.dbClient,
    host: tenantConfig.dbHost,
    port: tenantConfig.dbPort,
    user: tenantConfig.dbUser,
    password: tenantConfig.dbPassword,
    database: tenantConfig.dbName,
  });

  const db = knex(config);
  connectionPool.set(id, db);

  logger.info(`Nueva conexión creada para tenant: ${id} (${tenantConfig.dbName})`);

  return db;
}

/**
 * Cierra y elimina del caché la conexión de un tenant.
 * Útil cuando se elimina/desactiva un tenant.
 *
 * @param {string} tenantId
 */
async function closeTenantConnection(tenantId) {
  if (connectionPool.has(tenantId)) {
    const db = connectionPool.get(tenantId);
    await db.destroy();
    connectionPool.delete(tenantId);
    logger.info(`Conexión cerrada para tenant: ${tenantId}`);
  }
}

/**
 * Cierra todas las conexiones activas. Usado en Graceful Shutdown.
 */
async function closeAllConnections() {
  const promises = [];

  if (authDb) {
    promises.push(authDb.destroy());
  }

  for (const [tenantId, db] of connectionPool.entries()) {
    promises.push(db.destroy());
    connectionPool.delete(tenantId);
  }

  await Promise.all(promises);
  logger.info('Todas las conexiones a BD cerradas.');
}

module.exports = {
  initAuthDatabase,
  getAuthDatabase,
  getTenantDatabase,
  closeTenantConnection,
  closeAllConnections,
};