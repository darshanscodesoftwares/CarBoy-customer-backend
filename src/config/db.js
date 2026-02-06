import mongoose from 'mongoose';
import { env } from './env.js';
import logger from '../utils/logger.js';

export default async function connectDB() {
  try {
    await mongoose.connect(env.mongoUri);
    logger.info({ event: 'db_connected' }, 'MongoDB connected');
  } catch (error) {
    logger.error({ event: 'db_connection_failed', error: error.message }, 'Failed to connect MongoDB');
    process.exit(1);
  }
}
