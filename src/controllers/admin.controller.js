import { confirmCancellation, confirmReschedule, handleAssignmentFailed, handleRefundConfirmation } from '../services/customer.service.js';
import { storePaymentLinkDetails } from '../services/payment.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';
import InspectionRequest from '../models/InspectionRequest.js';

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

export async function adminAssignmentFailed(req, res) {
  try {
    const { requestNumber } = req.params;

    const result = await handleAssignmentFailed(requestNumber);

    return successResponse(res, {
      requestId: result.requestNumber,
      status: result.status,
      assignmentFailure: result.assignmentFailure,
    }, 'Assignment failure recorded');
  } catch (error) {
    logger.error(
      { event: 'admin_assignment_failed_handler_error', requestNumber: req.params.requestNumber, error: error.message },
      'Assignment failed handler error'
    );
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

export async function adminRefundConfirmed(req, res) {
  try {
    const { requestNumber } = req.params;
    const { razorpayRefundId, amount, processedAt } = req.body;

    if (!razorpayRefundId || !amount) {
      return errorResponse(res, 'razorpayRefundId and amount are required', 400);
    }

    const result = await handleRefundConfirmation(requestNumber, {
      razorpayRefundId,
      amount,
      processedAt: processedAt || new Date(),
    });

    return successResponse(res, {
      requestId: result.requestNumber,
      status: result.status,
      payment: result.payment,
      refund: result.refund,
    }, 'Refund confirmed');
  } catch (error) {
    logger.error(
      { event: 'admin_refund_confirmed_failed', requestNumber: req.params.requestNumber, error: error.message },
      'Admin refund confirmation failed'
    );
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

export async function adminVshFileUploaded(req, res) {
  try {
    const { requestNumber } = req.params;
    const { vshFile } = req.body;

    if (!vshFile?.url) {
      return errorResponse(res, 'vshFile.url is required', 400);
    }

    const request = await InspectionRequest.findOneAndUpdate(
      { requestNumber },
      {
        $set: {
          status: 'CONVERTED',
          vshFile: {
            url: vshFile.url,
            originalName: vshFile.originalName || null,
            mimeType: vshFile.mimeType || null,
            uploadedAt: vshFile.uploadedAt || new Date(),
          },
        },
        $push: {
          statusHistory: {
            from: 'PAID',
            to: 'CONVERTED',
            changedAt: new Date(),
            changedBy: 'ADMIN',
            note: 'VSH report uploaded by admin',
          },
        },
      },
      { new: true }
    );

    if (!request) {
      return errorResponse(res, 'Inspection request not found', 404);
    }

    logger.info({ event: 'vsh_file_uploaded', requestNumber }, 'VSH file received from admin');
    return successResponse(res, { requestNumber, status: request.status }, 'VSH file stored');
  } catch (error) {
    logger.error(
      { event: 'vsh_file_upload_failed', requestNumber: req.params.requestNumber, error: error.message },
      'VSH file upload callback failed'
    );
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

export async function adminPaymentLinkCreated(req, res) {
  try {
    const { requestNumber } = req.params;
    const { paymentLinkId, paymentLinkUrl } = req.body;

    if (!paymentLinkId || !paymentLinkUrl) {
      return errorResponse(res, 'paymentLinkId and paymentLinkUrl are required', 400);
    }

    const result = await storePaymentLinkDetails(requestNumber, paymentLinkId, paymentLinkUrl);

    return successResponse(res, {
      requestId: result.requestNumber,
      payment: result.payment,
    }, 'Payment link stored');
  } catch (error) {
    logger.error(
      { event: 'admin_payment_link_failed', requestNumber: req.params.requestNumber, error: error.message },
      'Failed to store payment link'
    );
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}
