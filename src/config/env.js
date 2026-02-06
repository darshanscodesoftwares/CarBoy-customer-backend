import dotenv from 'dotenv';

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5005,
  mongoUri: process.env.MONGODB_URI,
  adminBaseUrl: process.env.ADMIN_BASE_URL,
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean),
  adminTimeoutMs: Number(process.env.ADMIN_TIMEOUT_MS) || 10000,
  logLevel: process.env.LOG_LEVEL || 'info',
};
