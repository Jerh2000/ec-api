'use strict';

/**
 * @file utils/logger.js
 * @description Logger centralizado usando Winston.
 * - En desarrollo: logs coloridos en consola.
 * - En producción: logs en formato JSON a archivos rotativos.
 */

const winston = require('winston');
const path = require('path');

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Formato para consola (legible para humanos)
const consoleFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Formato para archivos (JSON estructurado, fácil de parsear)
const fileFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const transports = [];

// Siempre loguear en consola
transports.push(
  new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'HH:mm:ss' }),
      errors({ stack: true }),
      consoleFormat
    ),
  })
);

// En producción, también escribir a archivos
if (process.env.NODE_ENV === 'production') {
  const logDir = process.env.LOG_FILE_PATH || './logs';

  transports.push(
    // Todos los logs >= info
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      format: fileFormat,
    }),
    // Solo errores
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports,
  // No detener la app si el logger falla
  exitOnError: false,
});

module.exports = logger;
