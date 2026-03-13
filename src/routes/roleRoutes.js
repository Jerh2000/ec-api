'use strict';

/**
 * @file routes/roleRoutes.js
 * @description Rutas de gestión de roles.
 *
 *   GET     /roles        → Listar roles activos      (cualquier usuario autenticado)
 *   GET     /roles/:id    → Obtener rol por ID         (cualquier usuario autenticado)
 *   POST    /roles        → Crear rol                  (superadmin)
 *   PUT     /roles/:id    → Actualizar rol             (superadmin)
 *   DELETE  /roles/:id    → Desactivar rol             (superadmin)
 */

const router = require('express').Router();
const roleController = require('../controllers/roleController');
const { authenticate, authorize } = require('../middlewares/authenticate');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Lectura: cualquier rol autenticado puede consultar los roles disponibles
router.get('/', roleController.listRoles);
router.get('/:id', roleController.getRoleById);

// Escritura: solo superadmin
router.post('/', authorize('admin'), roleController.createRole);
router.put('/:id', authorize('admin'), roleController.updateRole);
router.delete('/:id', authorize('admin'), roleController.deleteRole);

module.exports = router;