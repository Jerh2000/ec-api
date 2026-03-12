'use strict';

/**
 * @file services/tenant/productService.js
 * @description Lógica de negocio para productos.
 *
 * Con IDs numéricos ya no se genera uuidv4().
 * SQL Server asigna el ID automáticamente con IDENTITY(1,1).
 * Knex retorna ese ID en el resultado del insert.
 */

const AppError = require('../../utils/AppError');
const productModel = require('../../models/tenant/productModel');

const TIPOS_VALIDOS = ['fisico', 'comida', 'digital', 'servicio'];

// -----------------------------------------------
// HELPERS PRIVADOS
// -----------------------------------------------

/**
 * Genera slug URL-friendly desde el nombre del producto.
 * "Camiseta Roja XL" → "camiseta-roja-xl"
 */
function generarSlug(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // quitar tildes
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function validarCamposPorTipo(tipo, data) {
  if (tipo === 'fisico' && data.stock !== undefined && data.stock < 0) {
    throw new AppError('El stock no puede ser negativo.', 400);
  }
  if (tipo === 'comida' && data.nutrition?.calorias < 0) {
    throw new AppError('Las calorías no pueden ser negativas.', 400);
  }
}

// -----------------------------------------------
// SERVICIO PÚBLICO
// -----------------------------------------------

async function listProducts(db, filters, pagination) {
  return productModel.findAll(db, filters, pagination);
}

async function getProductById(db, id) {
  const product = await productModel.findById(db, id);
  if (!product) throw new AppError('Producto no encontrado.', 404);
  return product;
}

/**
 * Crea un producto completo en una sola transacción.
 * SQL Server genera el ID automáticamente — no hay uuidv4().
 */
async function createProduct(db, data) {
  const { tipo, nombre, images = [], variants = [], extras = [], toppings = [], nutrition } = data;

  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw new AppError(`Tipo inválido. Opciones: ${TIPOS_VALIDOS.join(', ')}.`, 400);
  }

  validarCamposPorTipo(tipo, data);

  // Slug único
  let slug = data.slug || generarSlug(nombre);
  if (await productModel.slugExists(db, slug)) {
    slug = `${slug}-${Date.now()}`;
  }

  let productId;

  await db.transaction(async (trx) => {
    // 1. Insertar base — SQL Server retorna el INT generado
    productId = await productModel.create(trx, {
      tipo,
      nombre,
      slug,
      descripcion:     data.descripcion    || null,
      precio:          data.precio         || 0,
      precio_anterior: data.precio_anterior || null,
      stock:           tipo === 'fisico' ? (data.stock ?? null) : null,
      categoria_id:    data.categoria_id   || null,
      marca_id:        data.marca_id       || null,
      tags:            data.tags           || null,
      is_active:       data.is_active  !== undefined ? (data.is_active  ? 1 : 0) : 1,
      is_destacado:    data.is_destacado !== undefined ? (data.is_destacado ? 1 : 0) : 0,
      created_at:      new Date(),
      updated_at:      new Date(),
    });

    // 2. Imágenes
    if (images.length) {
      await productModel.insertImages(trx, images.map((url, i) => ({
        product_id: productId,
        url,
        orden:      i + 1,
        created_at: new Date(),
      })));
    }

    // 3. Variantes
    if (variants.length) {
      await productModel.insertVariants(trx, productId, variants);
    }

    // 4. Extras (no aplica a comida)
    if (tipo !== 'comida' && extras.length) {
      await productModel.insertExtras(trx, productId, extras);
    }

    // 5. Toppings (solo comida)
    if (tipo === 'comida' && toppings.length) {
      await productModel.insertToppings(trx, productId, toppings);
    }

    // 6. Nutrición (solo comida)
    if (tipo === 'comida' && nutrition) {
      await productModel.upsertNutrition(trx, productId, nutrition);
    }
  });

  return productModel.findById(db, productId);
}

/**
 * Actualiza un producto. Las relaciones enviadas se reemplazan completamente.
 */
async function updateProduct(db, id, data) {
  const existing = await productModel.findById(db, id);
  if (!existing) throw new AppError('Producto no encontrado.', 404);

  const tipo = data.tipo || existing.tipo;
  validarCamposPorTipo(tipo, data);

  if (data.slug && data.slug !== existing.slug) {
    const taken = await productModel.slugExists(db, data.slug, id);
    if (taken) throw new AppError('El slug ya está en uso por otro producto.', 409);
  }

  await db.transaction(async (trx) => {
    // Campos base
    const baseFields = ['tipo', 'nombre', 'slug', 'descripcion', 'precio',
      'precio_anterior', 'stock', 'categoria_id', 'marca_id',
      'tags', 'is_active', 'is_destacado'];

    const baseUpdates = {};
    for (const field of baseFields) {
      if (data[field] !== undefined) baseUpdates[field] = data[field];
    }
    if (Object.keys(baseUpdates).length) {
      await productModel.updateById(trx, id, baseUpdates);
    }

    // Reemplazar relaciones si vienen en el body
    if (data.images !== undefined) {
      await productModel.deleteImages(trx, id);
      if (data.images.length) {
        await productModel.insertImages(trx, data.images.map((url, i) => ({
          product_id: id, url, orden: i + 1, created_at: new Date(),
        })));
      }
    }

    if (data.variants !== undefined) {
      await productModel.deleteVariants(trx, id);
      if (data.variants.length) await productModel.insertVariants(trx, id, data.variants);
    }

    if (data.extras !== undefined && tipo !== 'comida') {
      await productModel.deleteExtras(trx, id);
      if (data.extras.length) await productModel.insertExtras(trx, id, data.extras);
    }

    if (data.toppings !== undefined && tipo === 'comida') {
      await productModel.deleteToppings(trx, id);
      if (data.toppings.length) await productModel.insertToppings(trx, id, data.toppings);
    }

    if (data.nutrition !== undefined && tipo === 'comida') {
      await productModel.upsertNutrition(trx, id, data.nutrition);
    }
  });

  return productModel.findById(db, id);
}

async function deleteProduct(db, id) {
  const product = await productModel.findById(db, id);
  if (!product) throw new AppError('Producto no encontrado.', 404);
  await productModel.softDeleteById(db, id);
}

async function toggleActive(db, id) {
  const product = await productModel.findById(db, id);
  if (!product) throw new AppError('Producto no encontrado.', 404);
  const newState = product.is_active ? 0 : 1;
  await productModel.updateById(db, id, { is_active: newState });
  return { id, is_active: !!newState };
}

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleActive,
};
