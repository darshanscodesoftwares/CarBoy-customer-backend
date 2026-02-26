import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import customerRoutes from './routes/customer.routes.js';
import vehicleMasterRoutes from './routes/vehicleMaster.routes.js';
import { env } from './config/env.js';
import logger from './utils/logger.js';

const app = express();

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const normalized = origin.replace(/\/$/, '');

    if (env.corsOrigins.includes(normalized)) {
      return callback(null, true);
    }

    console.error('❌ CORS BLOCKED:', origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
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

app.use('/api/customer/vehicle-master', vehicleMasterRoutes);
app.use('/api/customer', customerRoutes);

export default app;
