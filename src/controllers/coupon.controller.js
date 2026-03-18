import { validateCoupon, markCouponUsed } from '../integrations/adminClient.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

export async function validateCouponCode(req, res) {
  try {
    const { code, phone, orderAmount } = req.body;

    if (!code || !phone || !orderAmount) {
      return errorResponse(res, 'code, phone, and orderAmount are required', 400);
    }

    const result = await validateCoupon(code, phone, orderAmount);
    return successResponse(res, result, 'Coupon validated');
  } catch (error) {
    logger.error({ event: 'validate_coupon_failed', error: error.message }, 'Coupon validation failed');
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

export async function markCouponAsUsed(req, res) {
  try {
    const { code, phone } = req.body;

    if (!code || !phone) {
      return errorResponse(res, 'code and phone are required', 400);
    }

    await markCouponUsed(code, phone);
    return successResponse(res, {}, 'Coupon marked as used');
  } catch (error) {
    logger.error({ event: 'mark_coupon_used_failed', error: error.message }, 'Mark coupon used failed');
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}
