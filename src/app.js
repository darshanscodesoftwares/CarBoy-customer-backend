import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import customerRoutes from './routes/customer.routes.js';
import vehicleMasterRoutes from './routes/vehicleMaster.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import authRoutes from './routes/auth.routes.js';
import { env } from './config/env.js';
import logger from './utils/logger.js';

const app = express();

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow any origin in development for ngrok + localhost flexibility
    // In production, use env.corsOrigins to restrict
    if (env.nodeEnv === 'development') {
      return callback(null, true);
    }

    // Production: strict allowlist
    const normalized = origin.replace(/\/$/, '');
    if (env.corsOrigins.includes(normalized)) {
      return callback(null, true);
    }

    console.error('❌ CORS BLOCKED:', origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'ngrok-skip-browser-warning'
  ],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// Capture raw body for webhook signature verification BEFORE JSON parsing
app.use('/api/customer/payments/webhook', express.raw({ type: 'application/json' }));

// Parse JSON for all other routes
app.use(express.json());

app.use(morgan('combined'));

app.use((req, res, next) => {
  logger.info(
    {
      event: 'incoming_request',
      method: req.method,
      path: req.originalUrl,
    },
    'Incoming request'
  );
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    time: new Date().toISOString(),
  });
});

app.use('/api/customer/auth', authRoutes);
app.use('/api/customer/vehicle-master', vehicleMasterRoutes);
app.use('/api/customer/payments', paymentRoutes);
app.use('/api/customer', customerRoutes);

export default app;
