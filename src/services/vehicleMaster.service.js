import axios from 'axios';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { getAdminToken } from './adminAuth.service.js';

const BASE_URL = `${env.adminBaseUrl}/vehicle-master`;

/**
 * Fetch all active car brands from admin service
 * @returns {Promise<Array>} Array of brand objects with id and name
 */
export async function getBrands() {
  try {
    const token = await getAdminToken();
    const url = `${BASE_URL}/brands`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: env.adminTimeoutMs,
    });

    const brands = response.data.data?.brands || [];

    logger.info(
      { event: 'fetch_brands_success', totalBrands: brands.length },
      'Brands fetched successfully'
    );

    return brands;
  } catch (error) {
    const statusCode = error.response?.status || 502;
    const message = error.response?.data?.message || error.message || 'Failed to fetch brands';

    logger.error(
      { event: 'fetch_brands_failed', statusCode, error: message },
      'Failed to fetch brands from admin'
    );

    throw new AppError(`Failed to fetch brands: ${message}`, statusCode);
  }
}

/**
 * Fetch all active models for a specific brand
 * @param {string} brandId - The brand ID
 * @returns {Promise<Array>} Array of model objects with id, name, and price
 */
export async function getModelsByBrand(brandId) {
  if (!brandId || typeof brandId !== 'string') {
    throw new AppError('Invalid brand ID provided', 400);
  }

  try {
    const token = await getAdminToken();
    const url = `${BASE_URL}/brands/${brandId}/models`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: env.adminTimeoutMs,
    });

    const models = response.data.data?.models || [];

    logger.info(
      { event: 'fetch_models_success', brandId, totalModels: models.length },
      'Models fetched successfully'
    );

    return models;
  } catch (error) {
    const statusCode = error.response?.status || 502;
    const message = error.response?.data?.message || error.message || 'Failed to fetch models';

    logger.error(
      { event: 'fetch_models_failed', brandId, statusCode, error: message },
      'Failed to fetch models from admin'
    );

    throw new AppError(`Failed to fetch models: ${message}`, statusCode);
  }
}
