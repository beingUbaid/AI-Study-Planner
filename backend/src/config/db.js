import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import { env } from './env.js';

const connectDB = async () => {
  const options = {
    maxPoolSize: 10, // production-safe connection pooling
    serverSelectionTimeoutMS: 5000, // wait 5 seconds before timeout
    socketTimeoutMS: 45000, // close socket after 45 seconds of inactivity
    family: 4 // force IPv4
  };

  const MONGO_URI = env.MONGO_URI;
  const retries = 5;
  const delayMs = 5000;

  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(MONGO_URI, options);
      logger.info('MongoDB Connected successfully ✅');
      return;
    } catch (error) {
      logger.error(`MongoDB connection failed (Attempt ${i + 1}/${retries}): ${error.message}`);
      if (i === retries - 1) {
        logger.error('CRITICAL: MongoDB connection attempts exhausted. Exiting.');
        process.exit(1);
      }
      logger.info(`Retrying connection in ${delayMs / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
};

export default connectDB;