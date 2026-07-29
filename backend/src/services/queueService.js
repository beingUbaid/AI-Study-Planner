import Job from '../models/Job.js';
import logger from '../utils/logger.js';

class QueueService {
  constructor() {
    this.queue = [];
    this.activeCount = 0;
    this.concurrency = 2;
  }

  // Create a new job record in the database
  async createJob(userId, type) {
    return await Job.create({
      user: userId,
      type,
      status: 'pending',
      progress: 0
    });
  }

  // Enqueue a job execution function
  enqueue(jobId, taskFn) {
    this.queue.push({ jobId, taskFn });
    logger.info(`Enqueued job ${jobId}. Queue length: ${this.queue.length}`);
    this.processQueue();
  }

  // Process next jobs in the queue
  async processQueue() {
    if (this.activeCount >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const { jobId, taskFn } = this.queue.shift();
    this.activeCount++;

    try {
      logger.info(`Starting execution of job ${jobId}`);
      
      // Update job status to processing
      await Job.findByIdAndUpdate(jobId, { status: 'processing', progress: 10 });

      // Run task function with a progress updater
      const updateProgress = async (progressPercent) => {
        await Job.findByIdAndUpdate(jobId, { progress: Math.min(100, Math.max(0, progressPercent)) });
      };

      const result = await taskFn(updateProgress);

      // Completed successfully
      await Job.findByIdAndUpdate(jobId, {
        status: 'completed',
        progress: 100,
        result
      });
      logger.info(`Job ${jobId} completed successfully`);

    } catch (error) {
      logger.error(`Job ${jobId} failed`, error);
      await Job.findByIdAndUpdate(jobId, {
        status: 'failed',
        error: error.message || 'Unknown internal error occurred during processing'
      });
    } finally {
      this.activeCount--;
      this.processQueue();
    }
  }
}

export default new QueueService();
