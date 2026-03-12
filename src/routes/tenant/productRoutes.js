'use strict';

/**
 * @file routes/tenant/productRoutes.js
 * @description Rutas de productos del tenant.
 *
 *   GET     /tenant/products              → Listar con filtros y paginación
 *   GET     /tenant/products/:ids          → Obtener producto completo
 *   POST    /tenant/products              → Crear producto
 *   PUT     /tenant/products/:id          → Actualizar producto
 *   DELETE  /tenant/products/:id          → Eliminar producto
 *   PATCH   /tenant/products/:id/toggle-active → Activar/desactivar
 *
 * Permisos:
 *   - Lectura (GET): admin, empleado
 *   - Escritura (POST, PUT, DELETE): admin
 */

const router = require('express').Router();
const productController = require('../../controllers/tenant/productController');
const { authenticate, authorize } = require('../../middlewares/authenticate');
const validate = require('../../middlewares/validate');
const {
  createProductSchema,
  updateProductSchema,
  productFiltersSchema,
} = require('../../validators/tenant/productValidators');

// Todas las rutas requieren autenticación
router.use(authenticate);

router.get(
  '/',
  authorize('admin', 'empleado'),
  validate(productFiltersSchema, 'query'),
  productController.listProducts
);

router.get(
  '/:id',
  authorize('admin', 'empleado'),
  productController.getProductById
);

router.post(
  '/',
  authorize('admin'),
  validate(createProductSchema),
  productController.createProduct
);

router.put(
  '/:id',
  authorize('admin'),
  validate(updateProductSchema),
  productController.updateProduct
);

router.delete(
  '/:id',
  authorize('admin'),
  productController.deleteProduct
);

router.patch(
  '/:id/toggle-active',
  authorize('admin'),
  productController.toggleActive
);

module.exports = router;