import app from './app.js';
import connectDB from './config/db.js';
import { env } from './config/env.js';
import logger from './utils/logger.js';

async function startServer() {
  // Log environment configuration
  logger.info(
    {
      event: 'environment_info',
      environment: env.nodeEnv,
      port: env.port,
      adminBaseUrl: env.adminBaseUrl,
    },
    `Starting Customer Backend in ${env.nodeEnv.toUpperCase()} mode`
  );

  await connectDB();

  app.listen(env.port, () => {
    logger.info(
      {
        event: 'server_started',
        port: env.port,
        environment: env.nodeEnv,
        baseUrl: env.publicBaseUrl,
      },
      `✅ Server running on port ${env.port}`
    );
  });
}

startServer();
