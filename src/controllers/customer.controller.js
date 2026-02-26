import { submitInspectionRequest, getInspectionRequests, getInspectionRequestById } from '../services/customer.service.js';
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

export async function getInspectionRequestDetail(req, res) {
  try {
    const { requestId } = req.params;
    const request = await getInspectionRequestById(requestId);

    return successResponse(res, request, 'Inspection request fetched successfully');
  } catch (error) {
    logger.error(
      { event: 'get_inspection_request_detail_failed', requestId: req.params.requestId, error: error.message },
      'Get inspection request detail failed'
    );

    const statusCode = error.statusCode || 500;
    const message = error.message || 'Unable to fetch inspection request';

    return errorResponse(res, message, statusCode);
  }
}
