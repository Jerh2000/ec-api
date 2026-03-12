'use strict';

/**
 * @file validators/tenant/productValidators.js
 * @description Esquemas Joi para productos.
 * IDs numéricos en referencias (categoria_id, marca_id, etc.)
 */

const Joi = require('joi');

const TIPOS = ['fisico', 'comida', 'digital', 'servicio'];

// ── Sub-esquemas ─────────────────────────────────────────────

const variantOptionSchema = Joi.object({
  nombre:       Joi.string().trim().max(100).required(),
  precio_extra: Joi.number().min(0).default(0),
  orden:        Joi.number().integer().min(1),
});

const variantSchema = Joi.object({
  nombre:       Joi.string().trim().max(100).required(),
  tipo:         Joi.string().default('personalizado'),
  es_obligatia: Joi.boolean().default(false),
  orden:        Joi.number().integer().min(1).default(1),
  opciones:     Joi.array().items(variantOptionSchema).default([]),
});

const extraSchema = Joi.object({
  nombre:        Joi.string().trim().max(100).required(),
  precio:        Joi.number().min(0).default(0),
  es_obligatorio: Joi.boolean().default(false),
  orden:         Joi.number().integer().min(1),
});

const toppingSchema = Joi.object({
  nombre:        Joi.string().trim().max(100).required(),
  precio:        Joi.number().min(0).default(0),
  categoria:     Joi.string().trim().max(100).allow(null, '').default(null),
  es_obligatorio: Joi.boolean().default(false),
  orden:         Joi.number().integer().min(1),
});

const nutritionSchema = Joi.object({
  tiempo_preparacion: Joi.number().integer().min(0).allow(null),
  calorias:           Joi.number().integer().min(0).allow(null),
  alergenos:          Joi.string().trim().max(500).allow(null, ''),
});

// ── Esquema principal ────────────────────────────────────────

const createProductSchema = Joi.object({
  tipo:            Joi.string().valid(...TIPOS).required(),
  nombre:          Joi.string().trim().min(2).max(200).required(),
  slug:            Joi.string().trim().max(200).lowercase().allow(null, ''),
  descripcion:     Joi.string().allow(null, ''),
  precio:          Joi.number().min(0).required(),
  precio_anterior: Joi.number().min(0).allow(null),
  stock:           Joi.number().integer().min(0).allow(null),
  categoria_id:    Joi.number().integer().positive().allow(null),  // INT
  marca_id:        Joi.number().integer().positive().allow(null),  // INT
  tags:            Joi.string().trim().max(500).allow(null, ''),
  is_active:       Joi.boolean().default(true),
  is_destacado:    Joi.boolean().default(false),
  images:          Joi.array().items(Joi.string().uri()).default([]),
  variants:        Joi.array().items(variantSchema).default([]),
  extras:          Joi.array().items(extraSchema).default([]),
  toppings:        Joi.array().items(toppingSchema).default([]),
  nutrition:       nutritionSchema.allow(null),
});

const updateProductSchema = createProductSchema.fork(
  ['tipo', 'nombre', 'precio'],
  (schema) => schema.optional()
);

const productFiltersSchema = Joi.object({
  tipo:        Joi.string().valid(...TIPOS),
  categoriaId: Joi.number().integer().positive(),
  marcaId:     Joi.number().integer().positive(),
  isActive:    Joi.boolean(),
  search:      Joi.string().trim().max(100),
  page:        Joi.number().integer().min(1).default(1),
  limit:       Joi.number().integer().min(1).max(100).default(20),
});

module.exports = { createProductSchema, updateProductSchema, productFiltersSchema };
