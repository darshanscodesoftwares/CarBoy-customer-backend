import pino from 'pino';
import { env } from '../config/env.js';

const logger = pino({
  name: 'customer-backend',
  level: env.logLevel,
  base: { service: 'customer-backend' },
});

export default logger;
