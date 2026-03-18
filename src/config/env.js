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
  appBaseUrl: process.env.APP_BASE_URL || `http://localhost:${Number(process.env.PORT) || 5005}`,
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '', // For ngrok or production, leave empty for localhost
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean),
  adminApiKey: process.env.ADMIN_API_KEY || 'carboy-dev-admin-api-key',
  adminTimeoutMs: Number(process.env.ADMIN_TIMEOUT_MS) || 10000,
  logLevel: process.env.LOG_LEVEL || 'info',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,

  // Auth / JWT
  jwtSecret: process.env.JWT_SECRET || 'carboy-dev-jwt-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // OAuth - Google
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',

  // OAuth - Apple
  appleClientId: process.env.APPLE_CLIENT_ID || '', // Your app's Services ID (e.g. com.carboy.auth)

  // Email (Gmail Nodemailer)
  gmailUser: process.env.GMAIL_USER || '',
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',
};

// Validate required environment variables
function validateEnv() {
  const required = ['MONGODB_URI', 'ADMIN_BASE_URL', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];
  const requiredInProduction = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'JWT_SECRET', 'GOOGLE_CLIENT_ID'];

  const missing = required.filter((key) => !process.env[key]);
  const missingInProd = nodeEnv === 'production' ? requiredInProduction.filter((key) => !process.env[key]) : [];

  const allMissing = [...missing, ...missingInProd];
  if (allMissing.length > 0) {
    const errorMsg = `Missing required environment variables: ${allMissing.join(', ')}`;
    console.error(`❌ ${errorMsg}`);
    if (nodeEnv === 'production') {
      throw new Error(errorMsg);
    }
  }
}

validateEnv();
