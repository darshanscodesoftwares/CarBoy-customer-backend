import { getBrands, getModelsByBrand } from '../services/vehicleMaster.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Get all active car brands
 * GET /api/customer/vehicle-master/brands
 */
export async function fetchBrands(req, res) {
  try {
    const brands = await getBrands();

    // Sanitize response - only return id and name
    const sanitizedBrands = brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
    }));

    return successResponse(res, sanitizedBrands, 'Brands fetched successfully');
  } catch (error) {
    logger.error(
      { event: 'fetch_brands_controller_failed', error: error.message },
      'Fetch brands controller failed'
    );

    const statusCode = error.statusCode || 500;
    const message = error.message || 'Unable to fetch brands';

    return errorResponse(res, message, statusCode);
  }
}

/**
 * Get all active models for a specific brand
 * GET /api/customer/vehicle-master/brands/:brandId/models
 */
export async function fetchModelsByBrand(req, res) {
  try {
    const { brandId } = req.params;

    const models = await getModelsByBrand(brandId);

    // Sanitize response - only return id, name, and price
    const sanitizedModels = models.map((model) => ({
      id: model.id,
      name: model.name,
      price: model.price,
    }));

    return successResponse(res, sanitizedModels, 'Models fetched successfully');
  } catch (error) {
    logger.error(
      { event: 'fetch_models_controller_failed', error: error.message, brandId: req.params.brandId },
      'Fetch models controller failed'
    );

    const statusCode = error.statusCode || 500;
    const message = error.message || 'Unable to fetch models';

    return errorResponse(res, message, statusCode);
  }
}
