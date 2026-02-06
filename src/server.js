import app from './app.js';
import connectDB from './config/db.js';
import { env } from './config/env.js';
import logger from './utils/logger.js';

async function startServer() {
  await connectDB();

  app.listen(env.port, () => {
    logger.info({ event: 'server_started', port: env.port }, `Server running on port ${env.port}`);
  });
}

startServer();
