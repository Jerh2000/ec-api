'use strict';

/**
 * @file routes/tenantRoutes.js
 * @description Rutas de gestión de tenants. Solo superadmin.
 *
 *   POST    /tenants        → Crear tenant
 *   GET     /tenants        → Listar tenants
 *   GET     /tenants/:id    → Obtener tenant
 *   PUT     /tenants/:id    → Actualizar tenant
 *   DELETE  /tenants/:id    → Eliminar tenant
 */

const router = require('express').Router();
const { authenticate, authorize } = require('../middlewares/authenticate');

// Placeholder — el controlador de tenants se crea en la siguiente fase
const tenantController = require('../controllers/tenantController');

router.use(authenticate, authorize('admin'));

router.post('/', tenantController.createTenant);
router.get('/', tenantController.listTenants);
router.get('/:id', tenantController.getTenantById);
router.put('/:id', tenantController.updateTenant);
router.delete('/:id', tenantController.deleteTenant);

module.exports = router;