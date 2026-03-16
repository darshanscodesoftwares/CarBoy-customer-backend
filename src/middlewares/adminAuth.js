import { env } from '../config/env.js';

export function authenticateAdmin(req, res, next) {
  const apiKey = req.headers['x-admin-api-key'];

  if (!apiKey || apiKey !== env.adminApiKey) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or missing admin API key',
    });
  }

  next();
}
