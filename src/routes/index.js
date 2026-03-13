'use strict';

/**
 * @file routes/index.js
 * @description Router principal. Agrega todos los sub-routers.
 *
 *   /api/v1/auth/...     ← Autenticación
 *   /api/v1/roles/...    ← Gestión de roles
 *   /api/v1/users/...    ← Gestión de usuarios
 *   /api/v1/tenants/...  ← Gestión de tenants (superadmin)
 */

const router = require('express').Router();

const authRoutes = require('./authRoutes');
const roleRoutes = require('./roleRoutes');
const userRoutes = require('./userRoutes');
const tenantRoutes = require('./tenantRoutes');

router.use('/auth', authRoutes);
router.use('/roles', roleRoutes);
router.use('/users', userRoutes);
router.use('/tenants', tenantRoutes);

module.exports = router;

// ── Rutas del Tenant (operan sobre la BD de cada empresa) ───
const productRoutes = require('./tenant/productRoutes');
router.use('/tenant/products', productRoutes);