'use strict';

/**
 * @file app.js
 * @description Punto de entrada principal de la aplicación.
 * Configura Express, middlewares globales y rutas.
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const { globalRateLimiter } = require('./middlewares/rateLimiter');
const logger = require('./utils/logger');
const routes = require('./routes');

const app = express();

// -----------------------------------------------
// MIDDLEWARES DE SEGURIDAD
// -----------------------------------------------

// Cabeceras HTTP de seguridad (XSS, clickjacking, etc.)
app.use(helmet());

// CORS - Configurar según entornos permitidos
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
}));

// Compresión GZIP para respuestas grandes
app.use(compression());

// -----------------------------------------------
// MIDDLEWARES DE PARSEO
// -----------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// -----------------------------------------------
// LOGGING DE PETICIONES HTTP
// -----------------------------------------------
app.use(morgan('combined', {
  stream: { write: (message) => logger.http(message.trim()) },
}));

// -----------------------------------------------
// RATE LIMITING GLOBAL
// -----------------------------------------------
app.use(globalRateLimiter);

// -----------------------------------------------
// HEALTH CHECK (sin autenticación)
// -----------------------------------------------
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// -----------------------------------------------
// RUTAS PRINCIPALES
// -----------------------------------------------
app.use(`/api/${process.env.API_VERSION || 'v1'}`, routes);

// -----------------------------------------------
// MANEJO DE ERRORES GLOBALES
// -----------------------------------------------
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;