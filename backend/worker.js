import 'dotenv/config';
import mongoose from 'mongoose';
import { startCronJobs } from './src/utils/cronJobs.js';
import logger from './src/utils/logger.js';

logger.info('Starting standalone background worker... ⚙️');

// Connect to Database
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/studyplanner';
mongoose.connect(mongoUri)
  .then(() => {
    logger.info('Worker connected to MongoDB database successfully ✅');
    
    // Start Cron tasks
    startCronJobs();
  })
  .catch(err => {
    logger.error('Worker failed to connect to MongoDB database:', err);
    process.exit(1);
  });

// Graceful Shutdown hooks for worker
const shutdown = (signal) => {
  logger.warn(`Worker received ${signal}. Shutting down worker...`);
  
  mongoose.connection.close()
    .then(() => {
      logger.info('Worker MongoDB database connection closed.');
      logger.info('Worker shutdown completed successfully. Exiting.');
      process.exit(0);
    })
    .catch(err => {
      logger.error('Error closing MongoDB connection in worker shutdown:', err);
      process.exit(1);
    });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
