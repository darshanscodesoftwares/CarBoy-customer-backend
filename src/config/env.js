import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodeEnv = process.env.NODE_ENV || 'development';

// Load environment-specific .env file
const envFile = nodeEnv === 'production' ? '.env.production' : '.env';
dotenv.config({ path: path.resolve(__dirname, '../../', envFile) });

export const env = {
  nodeEnv,
  port: Number(process.env.PORT) || 5005,
  mongoUri: process.env.MONGODB_URI,
  adminBaseUrl: process.env.ADMIN_BASE_URL,
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  publicBaseUrl: process.env.PUBLIC_BASE_URL,
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean),
  adminTimeoutMs: Number(process.env.ADMIN_TIMEOUT_MS) || 10000,
  logLevel: process.env.LOG_LEVEL || 'info',
};

// Validate required environment variables
function validateEnv() {
  const required = ['MONGODB_URI', 'ADMIN_BASE_URL', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const errorMsg = `Missing required environment variables: ${missing.join(', ')}`;
    console.error(`❌ ${errorMsg}`);
    if (nodeEnv === 'production') {
      throw new Error(errorMsg);
    }
  }
}

validateEnv();
