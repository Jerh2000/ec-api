'use strict';

/**
 * @file server.js
 * @description Arranca el servidor HTTP. Separado de app.js para facilitar tests.
 */

require('dotenv').config();

const app = require('./app');
const logger = require('./utils/logger');
const { initAuthDatabase } = require('./config/database');

const PORT = process.env.PORT || 3000;

/**
 * Función principal de arranque.
 * Inicializa conexiones a BD antes de levantar el servidor.
 */
async function bootstrap() {
  try {
    // 1. Verificar conexión a la base de datos de autenticación
    logger.info('Inicializando conexión a la base de datos de autenticación...');
    await initAuthDatabase();
    logger.info('Base de datos de autenticación conectada.');

    // 2. Levantar servidor HTTP
    const server = app.listen(PORT, () => {
      logger.info(`Servidor corriendo en http://localhost:${PORT}`);
      logger.info(`Entorno: ${process.env.NODE_ENV}`);
      logger.info(`API versión: ${process.env.API_VERSION || 'v1'}`);
    });

    // 3. Manejo de cierre graceful (Graceful Shutdown)
    const gracefulShutdown = (signal) => {
      logger.info(`Señal ${signal} recibida. Cerrando servidor...`);
      server.close(() => {
        logger.info('Servidor cerrado correctamente.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Error fatal al iniciar el servidor:', error);
    process.exit(1);
  }
}

bootstrap();