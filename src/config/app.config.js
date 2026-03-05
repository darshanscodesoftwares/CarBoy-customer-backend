import { env } from './env.js';

/**
 * Get the app base URL for localhost (default)
 * @returns {string} App base URL (e.g., http://localhost:5005)
 */
export function getAppBaseUrl() {
  return `http://localhost:${env.port}`;
}

/**
 * Get the public base URL (for external access, webhooks, ngrok)
 * Falls back to localhost if PUBLIC_BASE_URL is not set
 * @returns {string} Public base URL
 */
export function getPublicBaseUrl() {
  // If PUBLIC_BASE_URL is explicitly set, use it (ngrok or production)
  if (env.publicBaseUrl && env.publicBaseUrl.trim()) {
    return env.publicBaseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  // Otherwise, fall back to localhost
  return getAppBaseUrl();
}

/**
 * Get full webhook URL for external callbacks (Razorpay, admin, etc.)
 * @param {string} path - The webhook path (e.g., /api/customer/payments/webhook)
 * @returns {string} Full webhook URL
 */
export function getWebhookUrl(path) {
  const baseUrl = getPublicBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

/**
 * Check if running with ngrok (public URL configured)
 * @returns {boolean} True if PUBLIC_BASE_URL is set
 */
export function isUsingPublicUrl() {
  return !!(env.publicBaseUrl && env.publicBaseUrl.trim());
}

/**
 * Get configuration info for logging/debugging
 * @returns {Object} Configuration details
 */
export function getAppConfig() {
  return {
    appBaseUrl: getAppBaseUrl(),
    publicBaseUrl: getPublicBaseUrl(),
    isPublicUrl: isUsingPublicUrl(),
    webhookUrl: getWebhookUrl('/api/customer/payments/webhook'),
  };
}
