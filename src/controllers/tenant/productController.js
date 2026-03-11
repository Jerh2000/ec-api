'use strict';

/**
 * @file controllers/tenant/productController.js
 * @description Controlador de productos del tenant.
 *
 * Obtiene la conexión a la BD del tenant desde req.tenantContext.db
 * que fue cargada por el middleware authenticate.
 *
 * Todos los endpoints requieren autenticación (el middleware ya validó el JWT
 * y cargó el tenantContext con la conexión correcta a la BD de la empresa).
 */

const productService = require('../../services/tenant/productService');
const { success, created, paginated } = require('../../utils/apiResponse');

/**
 * GET /tenant/products
 * Lista productos con filtros y paginación.
 *
 * Query params: tipo, categoriaId, marcaId, isActive, search, page, limit
 */
async function listProducts(req, res, next) {
  try {
    const db = req.tenantContext.db;
    const { page, limit, ...filters } = req.query;

    const { data, total } = await productService.listProducts(
      db,
      filters,
      { page: parseInt(page) || 1, limit: parseInt(limit) || 20 }
    );

    return paginated(res, {
      data,
      total,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      message: 'Productos obtenidos correctamente.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /tenant/products/:id
 * Obtiene un producto completo (con imágenes, variantes, extras, etc.)
 */
async function getProductById(req, res, next) {
  try {
    const db = req.tenantContext.db;
    const product = await productService.getProductById(db, req.params.id);
    return success(res, { data: product });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /tenant/products
 * Crea un nuevo producto con todas sus relaciones.
 *
 * Body incluye: datos base + images[] + variants[] + extras[]
 * y opcionalmente toppings[] y nutrition (solo tipo comida).
 */
async function createProduct(req, res, next) {
  try {
    const db = req.tenantContext.db;
    const product = await productService.createProduct(db, req.body);
    return created(res, {
      message: 'Producto creado exitosamente.',
      data: product,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /tenant/products/:id
 * Actualiza un producto. Solo enviar los campos que cambian.
 * Las relaciones (images, variants, extras) se reemplazan si se envían.
 */
async function updateProduct(req, res, next) {
  try {
    const db = req.tenantContext.db;
    const product = await productService.updateProduct(db, req.params.id, req.body);
    return success(res, {
      message: 'Producto actualizado exitosamente.',
      data: product,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /tenant/products/:id
 * Soft delete del producto.
 */
async function deleteProduct(req, res, next) {
  try {
    const db = req.tenantContext.db;
    await productService.deleteProduct(db, req.params.id);
    return success(res, { message: 'Producto eliminado exitosamente.' });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /tenant/products/:id/toggle-active
 * Activa o desactiva un producto rápidamente.
 */
async function toggleActive(req, res, next) {
  try {
    const db = req.tenantContext.db;
    const result = await productService.toggleActive(db, req.params.id);
    return success(res, {
      message: `Producto ${result.is_active ? 'activado' : 'desactivado'}.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleActive,
};