import { submitInspectionRequest, getInspectionRequests } from '../services/customer.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

export async function createInspectionRequest(req, res) {
  try {
    const result = await submitInspectionRequest(req.body);

    return successResponse(
      res,
      result,
      'Inspection request saved. Awaiting admin assignment.',
      201
    );
  } catch (error) {
    logger.error(
      { event: 'create_inspection_request_controller_failed', error: error.message },
      'Create inspection request failed'
    );
    return errorResponse(res, error.message || 'Unable to save inspection request', error.statusCode || 500);
  }
}

export async function listInspectionRequests(req, res) {
  try {
    const requests = await getInspectionRequests();
    return successResponse(res, requests, 'Inspection requests fetched successfully');
  } catch (error) {
    logger.error(
      { event: 'list_inspection_requests_failed', error: error.message },
      'List inspection requests failed'
    );
    return errorResponse(res, 'Unable to fetch inspection requests', 500);
  }
}
