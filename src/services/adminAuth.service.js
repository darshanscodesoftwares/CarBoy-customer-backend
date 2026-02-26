import axios from 'axios';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

let cachedToken = null;
let tokenExpiresAt = null;

/**
 * Authenticate with Admin Backend and get JWT token
 * @returns {Promise<string>} JWT token for API calls
 */
export async function getAdminToken() {
  // Return cached token if still valid
  if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
    logger.debug({ event: 'using_cached_token' }, 'Using cached admin token');
    return cachedToken;
  }

  try {
    const loginUrl = `${env.adminBaseUrl}/auth/login`;
    const response = await axios.post(
      loginUrl,
      {
        email: env.adminEmail,
        password: env.adminPassword,
      },
      {
        timeout: env.adminTimeoutMs,
      }
    );

    const { token, expiresIn } = response.data.data;

    if (!token) {
      throw new AppError('No token received from admin service', 502);
    }

    // Cache the token with expiration buffer (expire 1 minute before actual expiry)
    cachedToken = token;
    const expiryMs = (expiresIn || 3600) * 1000; // Convert to milliseconds
    tokenExpiresAt = Date.now() + expiryMs - 60000; // 1 minute buffer

    logger.info(
      { event: 'admin_auth_success', expiresIn },
      'Successfully authenticated with admin service'
    );

    return token;
  } catch (error) {
    cachedToken = null;
    tokenExpiresAt = null;

    const statusCode = error.response?.status || 502;
    const message = error.response?.data?.message || error.message || 'Failed to authenticate with admin service';

    logger.error(
      { event: 'admin_auth_failed', statusCode, error: message },
      'Admin authentication failed'
    );

    throw new AppError(`Failed to authenticate with admin service: ${message}`, statusCode);
  }
}

/**
 * Clear cached token (useful for testing or forced refresh)
 */
export function clearCachedToken() {
  cachedToken = null;
  tokenExpiresAt = null;
  logger.info({ event: 'token_cache_cleared' }, 'Cached admin token cleared');
}
