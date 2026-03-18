import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import customerRoutes from './routes/customer.routes.js';
import vehicleMasterRoutes from './routes/vehicleMaster.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import couponRoutes from './routes/coupon.routes.js';
import { getCancellationPolicy, forwardEnquiry } from './integrations/adminClient.js';
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

// Public endpoint — no auth needed, proxies cancellation policy from admin
app.get('/api/customer/settings/cancellation-policy', async (req, res) => {
  try {
    const policy = await getCancellationPolicy();
    res.json({ success: true, data: policy });
  } catch (error) {
    logger.error({ event: 'cancellation_policy_fetch_failed', error: error.message }, 'Failed to fetch cancellation policy');
    // Return sensible defaults if admin is unreachable
    res.json({
      success: true,
      data: { cutoffHours: 1, feePercent: 20 },
      fallback: true,
    });
  }
});

// Public — no auth, user may not be logged in when enquiring
app.post('/api/customer/enquiry', async (req, res) => {
  try {
    logger.info({ event: 'enquiry_received', body: req.body }, 'Enquiry payload received');
    const fullName = (req.body.fullName || req.body.name || '').trim();
    const phoneNumber = (req.body.phoneNumber || req.body.phone || '').trim();
    const address = (req.body.address || '').trim();
    const message = (req.body.message || '').trim();

    if (!fullName || !phoneNumber || !address) {
      return res.status(400).json({ success: false, message: 'Full name, phone number, and address are required' });
    }

    await forwardEnquiry({ fullName, phoneNumber, address, message });

    return res.json({ success: true, message: 'Enquiry submitted successfully' });
  } catch (error) {
    logger.error({ event: 'enquiry_submit_failed', error: error.message }, 'Enquiry submission failed');
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

app.use('/api/customer/auth', authRoutes);
app.use('/api/customer/vehicle-master', vehicleMasterRoutes);
app.use('/api/customer/payments', paymentRoutes);
app.use('/api/customer/coupons', couponRoutes);
// Admin callback routes — service-to-service, no JWT auth
// Admin BE calls: /api/customer/inspection-requests/:requestNumber/confirm-cancellation, etc.
app.use('/api/customer/inspection-requests', adminRoutes);
app.use('/api/customer', customerRoutes);

export default app;
