import 'dotenv/config';
import { env } from './src/config/env.js';
import mongoose from 'mongoose';
import http from 'http';
import { startCronJobs, getActivePromises, setShuttingDown } from './src/utils/cronJobs.js';
import logger from './src/utils/logger.js';

logger.info('Starting standalone background worker... ⚙️');

let cronJobs = [];
let healthServer = null;

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

// Small HTTP health check server for worker
const workerPort = process.env.WORKER_PORT || 8001;
healthServer = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/ready') {
    const dbState = mongoose.connection.readyState;
    if (dbState === 1) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'UP', database: 'connected' }));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'DOWN', database: 'disconnected' }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

healthServer.listen(workerPort, () => {
  logger.info(`Worker health server listening on port ${workerPort} 🏥`);
});

// Process-level unhandled rejection and exception safety handlers
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception in worker 💥', { error: err.message, stack: err.stack });
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, _promise) => {
  logger.error('Unhandled Rejection in worker 💥', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
  shutdown('UNHANDLED_REJECTION');
});

// Graceful Shutdown hooks for worker
const shutdown = async (signal) => {
  logger.warn(`Worker received ${signal}. Shutting down worker gracefully...`);
  
  // 1. Mark worker as shutting down to prevent new claims
  setShuttingDown(true);

  // 2. Explicitly stop all cron schedules/reminders
  if (Array.isArray(cronJobs)) {
    cronJobs.forEach((job, idx) => {
      if (job && typeof job.stop === 'function') {
        job.stop();
        logger.info(`Cron task #${idx + 1} stopped.`);
      }
    });
  }

  // 3. Stop the health server
  if (healthServer) {
    await new Promise(resolve => healthServer.close(resolve));
    logger.info('Worker health server stopped.');
  }

  // 4. Wait safely for active work within a bounded timeout (drain active cron executions)
  const activePromises = getActivePromises();
  const shutdownTimeoutMs = env.WORKER_SHUTDOWN_TIMEOUT_MS || 5000;
  logger.info(`Worker waiting for active delivery tasks to complete (${shutdownTimeoutMs}ms bounded timeout)...`);
  const shutdownTimeout = Date.now() + shutdownTimeoutMs;
  while (activePromises.size > 0 && Date.now() < shutdownTimeout) {
    logger.info(`Active delivery tasks running: ${activePromises.size}. Waiting...`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  logger.info('Draining active delivery tasks complete or timeout reached.');

  // 5. Close MongoDB database connection
  try {
    await mongoose.connection.close();
    logger.info('Worker MongoDB database connection closed.');
  } catch (err) {
    logger.error('Error closing MongoDB connection in worker shutdown:', err);
  }

  // 6. Flush winston logs and exit
  logger.info('Worker shutdown completed successfully. Exiting.');
  logger.end();
  await new Promise(resolve => logger.on('finish', resolve));
  process.exit(signal === 'UNCAUGHT_EXCEPTION' || signal === 'UNHANDLED_REJECTION' ? 1 : 0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
