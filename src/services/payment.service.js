import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import InspectionRequest from '../models/InspectionRequest.js';
import { forwardInspectionRequestToAdmin } from './customer.service.js';

// Initialize Razorpay instance
const razorpayInstance = new Razorpay({
  key_id: env.razorpayKeyId,
  key_secret: env.razorpayKeySecret,
});

/**
 * Create a Razorpay order for payment
 * @param {Object} params - Order parameters
 * @param {number} params.amount - Amount in paise (smallest unit)
 * @param {string} params.receipt - Receipt identifier (e.g., requestNumber)
 * @returns {Promise<Object>} Razorpay order object
 */
export async function createRazorpayOrder({ amount, receipt }) {
  try {
    if (!amount || amount <= 0) {
      throw new AppError('Invalid amount provided', 400);
    }

    const options = {
      amount: Math.round(amount), // Ensure integer value in paise
      currency: 'INR',
      receipt,
    };

    const order = await razorpayInstance.orders.create(options);

    logger.info(
      {
        event: 'razorpay_order_created',
        orderId: order.id,
        amount: order.amount,
        receipt,
      },
      'Razorpay order created successfully'
    );

    return order;
  } catch (error) {
    logger.error(
      {
        event: 'razorpay_order_creation_failed',
        error: error.message,
        amount,
        receipt,
      },
      'Failed to create Razorpay order'
    );

    throw new AppError(
      `Failed to create payment order: ${error.message}`,
      error.statusCode || 500
    );
  }
}

/**
 * Verify Razorpay webhook signature
 * @param {string} rawBody - Raw request body as string
 * @param {string} signature - Razorpay signature from header
 * @returns {boolean} True if signature is valid
 */
export function verifyWebhookSignature(rawBody, signature) {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', env.razorpayWebhookSecret)
      .update(rawBody)
      .digest('hex');

    const isValid = expectedSignature === signature;

    logger.info(
      {
        event: 'webhook_signature_verification',
        isValid,
      },
      isValid ? 'Webhook signature verified' : 'Invalid webhook signature'
    );

    return isValid;
  } catch (error) {
    logger.error(
      {
        event: 'webhook_signature_verification_failed',
        error: error.message,
      },
      'Failed to verify webhook signature'
    );

    return false;
  }
}

/**
 * Mark payment as successful and update inspection request
 * @param {string} razorpayOrderId - Razorpay order ID
 * @param {string} razorpayPaymentId - Razorpay payment ID
 * @returns {Promise<Object>} Updated inspection request
 */
export async function markPaymentSuccessful(razorpayOrderId, razorpayPaymentId) {
  try {
    if (!razorpayOrderId || !razorpayPaymentId) {
      throw new AppError('Invalid order or payment ID', 400);
    }

    // Find inspection request by razorpayOrderId
    const inspectionRequest = await InspectionRequest.findOne({
      'payment.razorpayOrderId': razorpayOrderId,
    });

    if (!inspectionRequest) {
      throw new AppError('Inspection request not found for this order', 404);
    }

    // Idempotency: if request already forwarded, skip processing
    if (inspectionRequest.status === 'FORWARDED') {
      logger.warn(
        {
          event: 'duplicate_payment_confirmation_already_forwarded',
          razorpayOrderId,
          requestNumber: inspectionRequest.requestNumber,
        },
        'Request already forwarded, skipping duplicate payment webhook processing'
      );

      return inspectionRequest;
    }

    let paidRequest = inspectionRequest;

    // Update payment details and request status to PAID
    if (inspectionRequest.payment.status !== 'PAID' || inspectionRequest.status !== 'PAID') {
      paidRequest = await InspectionRequest.findByIdAndUpdate(
        inspectionRequest._id,
        {
          status: 'PAID',
          'payment.status': 'PAID',
          'payment.razorpayPaymentId': razorpayPaymentId,
          'payment.paidAt': new Date(),
        },
        { new: true }
      );
    } else {
      logger.info(
        {
          event: 'payment_already_marked_paid',
          razorpayOrderId,
          requestNumber: inspectionRequest.requestNumber,
        },
        'Payment and request status already marked as PAID, attempting admin forwarding'
      );
    }

    if (!paidRequest) {
      throw new AppError('Failed to update inspection request after payment', 500);
    }

    // Forward to admin ONLY after payment is confirmed (status = PAID)
    // Admin payload will include status: 'PAID' so admin can assign technician
    const adminResponse = await forwardInspectionRequestToAdmin(paidRequest);

    let finalRequest = paidRequest;
    if (adminResponse) {
      const forwardedUpdate = { status: 'FORWARDED' };
      if (adminResponse.data?.id) {
        forwardedUpdate.adminJobId = adminResponse.data.id;
      }

      finalRequest = await InspectionRequest.findByIdAndUpdate(
        paidRequest._id,
        forwardedUpdate,
        { new: true }
      );
    }

    logger.info(
      {
        event: 'payment_marked_successful',
        razorpayOrderId,
        razorpayPaymentId,
        requestNumber: inspectionRequest.requestNumber,
      },
      'Payment marked as successful'
    );

    return finalRequest;
  } catch (error) {
    logger.error(
      {
        event: 'mark_payment_successful_failed',
        razorpayOrderId,
        razorpayPaymentId,
        error: error.message,
      },
      'Failed to mark payment as successful'
    );

    throw error;
  }
}
