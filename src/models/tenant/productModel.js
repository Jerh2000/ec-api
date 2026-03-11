'use strict';

/**
 * @file models/tenant/productModel.js
 * @description Modelo de productos sobre la BD del tenant.
 *
 * IMPORTANTE: Este modelo recibe `db` como parámetro.
 * `db` = req.tenantContext.db (conexión knex de la empresa).
 *
 * Compatible con mssql y mysql2 gracias al helper insertAndGetId().
 */

// -----------------------------------------------
// HELPER: INSERT compatible con mssql y mysql2
// -----------------------------------------------

/**
 * Inserta un registro y retorna el ID autogenerado.
 * Abstrae la diferencia de comportamiento entre motores:
 *
 *   mssql  → necesita .returning('id') para obtener el IDENTITY
 *   mysql2 → el insert retorna directamente el insertId en result[0]
 *
 * @param {object} db    - Instancia knex del tenant
 * @param {string} table - Nombre de la tabla
 * @param {object} data  - Datos a insertar
 * @returns {number} ID generado por la BD
 */
async function insertAndGetId(db, table, data) {
  const client = db.client.config.client;

  if (client === 'mssql') {
    // mssql retorna un objeto: [{ id: 5 }] → extraer el valor numérico
    const [row] = await db(table).insert(data).returning('id');
    return typeof row === 'object' ? row.id : row;
  }

  // mysql2: retorna directamente el insertId numérico en [0]
  const [id] = await db(table).insert(data);
  return id;
}

// -----------------------------------------------
// CONSULTAS
// -----------------------------------------------

/**
 * Lista productos con filtros y paginación.
 *
 * @param {object} db
 * @param {object} filters - { tipo, categoriaId, marcaId, isActive, search }
 * @param {object} pagination - { page, limit }
 * @returns {{ data, total }}
 */
async function findAll(db, filters = {}, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;

  let query = db('products')
    .leftJoin('categorias', 'products.categoria_id', 'categorias.id')
    .leftJoin('marcas', 'products.marca_id', 'marcas.id')
    .whereNull('products.deleted_at');

  if (filters.tipo)        query = query.where('products.tipo', filters.tipo);
  if (filters.categoriaId) query = query.where('products.categoria_id', filters.categoriaId);
  if (filters.marcaId)     query = query.where('products.marca_id', filters.marcaId);
  if (filters.isActive !== undefined) query = query.where('products.is_active', filters.isActive);
  if (filters.search) {
    query = query.where(function () {
      this.where('products.nombre', 'like', `%${filters.search}%`)
        .orWhere('products.tags', 'like', `%${filters.search}%`);
    });
  }

  const [data, [{ total }]] = await Promise.all([
    query.clone()
      .orderBy('products.id', 'desc')
      .limit(limit)
      .offset(offset)
      .select(
        'products.id',
        'products.tipo',
        'products.nombre',
        'products.slug',
        'products.precio',
        'products.precio_anterior',
        'products.stock',
        'products.is_active',
        'products.is_destacado',
        'products.tags',
        'products.created_at',
        'categorias.nombre as categoria_nombre',
        'marcas.nombre as marca_nombre'
      ),
    query.clone().count('products.id as total'),
  ]);

  return { data, total: parseInt(total) };
}

/**
 * Obtiene un producto completo con todas sus relaciones.
 *
 * @param {object} db
 * @param {number} id
 * @returns {object|null}
 */
async function findById(db, id) {
  const product = await db('products')
    .leftJoin('categorias', 'products.categoria_id', 'categorias.id')
    .leftJoin('marcas', 'products.marca_id', 'marcas.id')
    .whereNull('products.deleted_at')
    .where('products.id', id)
    .select(
      'products.*',
      'categorias.nombre as categoria_nombre',
      'marcas.nombre as marca_nombre'
    )
    .first();

  if (!product) return null;

  // Cargar relaciones en paralelo
  const [images, variants, extras, toppings, nutrition] = await Promise.all([
    findImages(db, id),
    findVariantsWithOptions(db, id),
    findExtras(db, id),
    product.tipo === 'comida' ? findToppings(db, id) : Promise.resolve([]),
    product.tipo === 'comida' ? findNutrition(db, id) : Promise.resolve(null),
  ]);

  return { ...product, images, variants, extras, toppings, nutrition };
}

/**
 * Verifica si un slug ya existe.
 * @param {object} db
 * @param {string} slug
 * @param {number|null} excludeId - Excluir este ID (para updates)
 */
async function slugExists(db, slug, excludeId = null) {
  let query = db('products').whereNull('deleted_at').where({ slug });
  if (excludeId) query = query.whereNot('id', excludeId);
  const row = await query.select('id').first();
  return !!row;
}

// ── Relaciones ────────────────────────────────────────────────

async function findImages(db, productId) {
  return db('product_images')
    .where({ product_id: productId })
    .orderBy('orden', 'asc')
    .select('id', 'url', 'orden');
}

async function findVariantsWithOptions(db, productId) {
  const variants = await db('product_variants')
    .where({ product_id: productId })
    .orderBy('orden', 'asc')
    .select('id', 'nombre', 'tipo', 'es_obligatia', 'orden');

  for (const variant of variants) {
    variant.opciones = await db('product_variant_options')
      .where({ variant_id: variant.id })
      .orderBy('orden', 'asc')
      .select('id', 'nombre', 'precio_extra', 'orden');
  }

  return variants;
}

async function findExtras(db, productId) {
  return db('product_extras')
    .where({ product_id: productId })
    .orderBy('orden', 'asc')
    .select('id', 'nombre', 'precio', 'es_obligatorio', 'orden');
}

async function findToppings(db, productId) {
  return db('product_toppings')
    .where({ product_id: productId })
    .orderBy('orden', 'asc')
    .select('id', 'nombre', 'precio', 'categoria', 'es_obligatorio', 'orden');
}

async function findNutrition(db, productId) {
  return db('product_nutrition').where({ product_id: productId }).first();
}

// -----------------------------------------------
// MUTACIONES
// -----------------------------------------------

/**
 * Crea el producto base.
 * @returns {number} ID autogenerado por la BD
 *
 * Comportamiento por motor:
 *   mssql   → requiere .returning('id'), retorna el IDENTITY generado
 *   mysql2  → insert() retorna directamente el insertId en [0]
 */
async function create(db, productData) {
  return insertAndGetId(db, 'products', productData);
}

/**
 * Actualiza el producto base.
 */
async function updateById(db, id, updates) {
  return db('products')
    .whereNull('deleted_at')
    .where({ id })
    .update({ ...updates, updated_at: new Date() });
}

/**
 * Soft delete.
 */
async function softDeleteById(db, id) {
  return db('products')
    .where({ id })
    .whereNull('deleted_at')
    .update({ deleted_at: new Date(), updated_at: new Date(), is_active: false });
}

// ── Imágenes ──────────────────────────────────────────────────

async function insertImages(db, images) {
  if (!images?.length) return;
  await db('product_images').insert(images);
}

async function deleteImages(db, productId) {
  return db('product_images').where({ product_id: productId }).delete();
}

// ── Variantes ─────────────────────────────────────────────────

async function insertVariants(db, productId, variants) {
  if (!variants?.length) return;

  for (const variant of variants) {
    // SQL Server retorna el ID autogenerado en [0]
    const variantId = await insertAndGetId(db, 'product_variants', {
      product_id:   productId,
      nombre:       variant.nombre,
      tipo:         variant.tipo || 'personalizado',
      es_obligatia: variant.es_obligatia ? 1 : 0,
      orden:        variant.orden || 1,
      created_at:   new Date(),
    });

    if (variant.opciones?.length) {
      await db('product_variant_options').insert(
        variant.opciones.map((op, i) => ({
          variant_id:   variantId,
          nombre:       op.nombre,
          precio_extra: op.precio_extra || 0,
          orden:        op.orden || i + 1,
        }))
      );
    }
  }
}

async function deleteVariants(db, productId) {
  const variants = await db('product_variants')
    .where({ product_id: productId })
    .select('id');

  const variantIds = variants.map(v => v.id);
  if (variantIds.length) {
    await db('product_variant_options').whereIn('variant_id', variantIds).delete();
  }
  await db('product_variants').where({ product_id: productId }).delete();
}

// ── Extras ────────────────────────────────────────────────────

async function insertExtras(db, productId, extras) {
  if (!extras?.length) return;
  await db('product_extras').insert(
    extras.map((e, i) => ({
      product_id:     productId,
      nombre:         e.nombre,
      precio:         e.precio || 0,
      es_obligatorio: e.es_obligatorio ? 1 : 0,
      orden:          e.orden || i + 1,
      created_at:     new Date(),
    }))
  );
}

async function deleteExtras(db, productId) {
  return db('product_extras').where({ product_id: productId }).delete();
}

// ── Toppings ──────────────────────────────────────────────────

async function insertToppings(db, productId, toppings) {
  if (!toppings?.length) return;
  await db('product_toppings').insert(
    toppings.map((t, i) => ({
      product_id:     productId,
      nombre:         t.nombre,
      precio:         t.precio || 0,
      categoria:      t.categoria || null,
      es_obligatorio: t.es_obligatorio ? 1 : 0,
      orden:          t.orden || i + 1,
      created_at:     new Date(),
    }))
  );
}

async function deleteToppings(db, productId) {
  return db('product_toppings').where({ product_id: productId }).delete();
}

// ── Nutrición ─────────────────────────────────────────────────

async function upsertNutrition(db, productId, nutrition) {
  const existing = await db('product_nutrition')
    .where({ product_id: productId })
    .first();

  if (existing) {
    return db('product_nutrition')
      .where({ product_id: productId })
      .update({ ...nutrition, updated_at: new Date() });
  }

  return db('product_nutrition').insert({
    product_id: productId,
    ...nutrition,
    updated_at: new Date(),
  });
}

async function deleteNutrition(db, productId) {
  return db('product_nutrition').where({ product_id: productId }).delete();
}

module.exports = {
  findAll,
  findById,
  slugExists,
  create,
  updateById,
  softDeleteById,
  insertImages,
  deleteImages,
  insertVariants,
  deleteVariants,
  insertExtras,
  deleteExtras,
  insertToppings,
  deleteToppings,
  upsertNutrition,
  deleteNutrition,
};