import 'dotenv/config';
import { env } from './src/config/env.js';
import mongoose from 'mongoose';
import { startCronJobs } from './src/utils/cronJobs.js';
import logger from './src/utils/logger.js';

logger.info('Starting standalone background worker... ⚙️');

let cronJobs = [];

// Connect to Database using env config
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
const shutdown = async (signal) => {
  logger.warn(`Worker received ${signal}. Shutting down worker gracefully...`);
  
  // 1. Explicitly stop all cron schedules/reminders
  if (Array.isArray(cronJobs)) {
    cronJobs.forEach((job, idx) => {
      if (job && typeof job.stop === 'function') {
        job.stop();
        logger.info(`Cron task #${idx + 1} stopped.`);
      }
    });
  }

  // 2. Wait safely for active work within a bounded timeout (drain active cron executions)
  logger.info('Worker waiting for active tasks to complete (bounded timeout: 3 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 3. Close MongoDB database connection
  try {
    await mongoose.connection.close();
    logger.info('Worker MongoDB database connection closed.');
    logger.info('Worker shutdown completed successfully. Exiting.');
    process.exit(0);
  } catch (err) {
    logger.error('Error closing MongoDB connection in worker shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
