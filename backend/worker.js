import 'dotenv/config';
import { env } from './src/config/env.js';
import mongoose from 'mongoose';
import { startCronJobs } from './src/utils/cronJobs.js';
import logger from './src/utils/logger.js';

logger.info('Starting standalone background worker... ⚙️');

let cronJobs = [];

// Connect to Database
const mongoUri = env.MONGO_URI;
mongoose.connect(mongoUri)
  .then(() => {
    logger.info('Worker connected to MongoDB database successfully ✅');
    
    // Start Cron tasks and retain handles
    cronJobs = startCronJobs();
  })
  .catch(err => {
    logger.error('Worker failed to connect to MongoDB database:', err);
    process.exit(1);
  });

// Graceful Shutdown hooks for worker
const shutdown = (signal) => {
  logger.warn(`Worker received ${signal}. Shutting down worker...`);
  
  // Explicitly stop all cron schedules/reminders
  if (Array.isArray(cronJobs)) {
    cronJobs.forEach((job, idx) => {
      if (job && typeof job.stop === 'function') {
        job.stop();
        logger.info(`Cron task #${idx + 1} stopped.`);
      }
    });
  }

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
