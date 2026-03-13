'use strict';

/**
 * @file routes/userRoutes.js
 * @description Rutas de usuarios y gestión de membresías.
 *
 * IDENTIDAD (tabla users):
 *   POST    /users                              → Crear usuario         (admin)
 *   GET     /users/:id                          → Obtener usuario       (admin)
 *   PUT     /users/:id                          → Actualizar usuario    (admin)
 *   DELETE  /users/:id                          → Eliminar usuario      (admin)
 *   PATCH   /users/:id/password                 → Cambiar contraseña    (propio)
 *
 * MEMBRESÍAS (tabla user_tenants):
 *   GET     /users/:id/tenants                  → Tenants del usuario   (admin)
 *   POST    /users/:id/tenants                  → Agregar a tenant      (admin)
 *   PATCH   /users/:id/tenants/:tenantId/role   → Cambiar rol           (admin)
 *   DELETE  /users/:id/tenants/:tenantId        → Quitar de tenant      (admin)
 */

const router = require('express').Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middlewares/authenticate');
const validate = require('../middlewares/validate');
const { createUserSchema, updateUserSchema, addToTenantSchema, updateRoleSchema } = require('../validators/userValidators');
const { changePasswordSchema } = require('../validators/authValidators');

router.use(authenticate);

// ── Identidad ────────────────────────────────────────────────
router.post('/',authorize('admin'), validate(createUserSchema),userController.createUser);
router.get('/:id',authorize('admin'),userController.getUserById);
router.put('/:id',authorize('admin'), validate(updateUserSchema),userController.updateUser);
router.delete('/:id',authorize('admin'),userController.deleteUser);
router.patch('/:id/password',validate(changePasswordSchema),userController.changePassword);

// ── Membresías ───────────────────────────────────────────────
router.get('/:id/tenants',authorize('admin'), userController.listUserTenants);
router.post('/:id/tenants',authorize('admin'), validate(addToTenantSchema), userController.addUserToTenant);
router.patch('/:id/tenants/:tenantId/role',authorize('admin'), validate(updateRoleSchema),  userController.updateUserRoleInTenant);
router.delete('/:id/tenants/:tenantId',authorize('admin'), userController.removeUserFromTenant);

module.exports = router;