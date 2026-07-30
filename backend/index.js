import 'dotenv/config';
import { env } from './src/config/env.js';
import app from './app.js';
import connectDB from './src/config/db.js';
import logger from './src/utils/logger.js';
import mongoose from 'mongoose';

// Connect Database
connectDB();

const PORT = env.PORT;
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} 🚀`);
});

// Graceful Shutdown implementation
const shutdown = (signal) => {
  logger.warn(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(async () => {
    logger.info('HTTP server closed.');
    
    try {
      await mongoose.connection.close();
      logger.info('MongoDB database connection closed.');
      logger.info('Graceful shutdown completed successfully. Exiting.');
      process.exit(0);
    } catch (err) {
      logger.error('Error closing database connection during shutdown:', err);
      process.exit(1);
    }
  });

  // Force close after 10 seconds if hanging
  setTimeout(() => {
    logger.error('Force shutting down: hanging server sockets detected.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));