import { confirmCancellation, confirmReschedule } from '../services/customer.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

export async function adminCancelConfirmed(req, res) {
  try {
    const { requestNumber } = req.params;
    const { adminNote } = req.body;

    const result = await confirmCancellation(requestNumber, adminNote);

    return successResponse(res, {
      requestId: result.requestNumber,
      status: result.status,
      cancellation: result.cancellation,
    }, 'Cancellation confirmed');
  } catch (error) {
    logger.error(
      { event: 'admin_cancel_confirmed_failed', requestNumber: req.params.requestNumber, error: error.message },
      'Admin cancel confirmation failed'
    );
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

export async function adminRescheduleConfirmed(req, res) {
  try {
    const { requestNumber } = req.params;
    const { adminNote } = req.body;

    const result = await confirmReschedule(requestNumber, adminNote);

    return successResponse(res, {
      requestId: result.requestNumber,
      status: result.status,
      schedule: result.schedule,
      reschedule: result.reschedule,
    }, 'Reschedule confirmed');
  } catch (error) {
    logger.error(
      { event: 'admin_reschedule_confirmed_failed', requestNumber: req.params.requestNumber, error: error.message },
      'Admin reschedule confirmation failed'
    );
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}
