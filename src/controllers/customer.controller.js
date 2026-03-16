import { submitInspectionRequest, getInspectionRequests, getInspectionRequestById, requestCancellation, requestReschedule } from '../services/customer.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

export async function createInspectionRequest(req, res) {
  try {
    const result = await submitInspectionRequest(req.body, req.userId);

    return successResponse(
      res,
      result,
      'Inspection request saved. Awaiting payment confirmation.',
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
    const requests = await getInspectionRequests(req.userId);
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

export async function cancelInspectionRequest(req, res) {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return errorResponse(res, 'Cancellation reason is required', 400);
    }

    const trimmedReason = reason.trim().slice(0, 500);
    const result = await requestCancellation(requestId, req.userId, trimmedReason);

    return successResponse(res, result, 'Cancellation request submitted. Awaiting admin approval.');
  } catch (error) {
    logger.error(
      { event: 'cancel_inspection_request_failed', requestId: req.params.requestId, error: error.message },
      'Cancel inspection request failed'
    );
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

export async function rescheduleInspectionRequest(req, res) {
  try {
    const { requestId } = req.params;
    const { schedule, reason } = req.body;

    if (!schedule?.date || !schedule?.slot) {
      return errorResponse(res, 'Schedule date and slot are required', 400);
    }

    const scheduleDate = new Date(schedule.date);
    if (isNaN(scheduleDate.getTime()) || scheduleDate <= new Date()) {
      return errorResponse(res, 'Schedule date must be a valid future date', 400);
    }

    const trimmedReason = (reason || '').trim().slice(0, 500);

    const result = await requestReschedule(requestId, req.userId, {
      date: scheduleDate,
      slot: schedule.slot.trim(),
    }, trimmedReason);

    return successResponse(res, result, 'Reschedule request submitted. We\'ll notify you soon.');
  } catch (error) {
    logger.error(
      { event: 'reschedule_inspection_request_failed', requestId: req.params.requestId, error: error.message },
      'Reschedule inspection request failed'
    );
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}
