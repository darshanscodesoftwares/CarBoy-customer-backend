import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import InspectionRequest from '../models/InspectionRequest.js';

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

    // Prevent duplicate payment status updates
    if (inspectionRequest.payment.status === 'PAID') {
      logger.warn(
        {
          event: 'duplicate_payment_confirmation',
          razorpayOrderId,
          requestNumber: inspectionRequest.requestNumber,
        },
        'Payment already marked as PAID, skipping update'
      );

      return inspectionRequest;
    }

    // Update payment details
    const updatedRequest = await InspectionRequest.findByIdAndUpdate(
      inspectionRequest._id,
      {
        'payment.status': 'PAID',
        'payment.razorpayPaymentId': razorpayPaymentId,
        'payment.paidAt': new Date(),
      },
      { new: true }
    );

    logger.info(
      {
        event: 'payment_marked_successful',
        razorpayOrderId,
        razorpayPaymentId,
        requestNumber: inspectionRequest.requestNumber,
      },
      'Payment marked as successful'
    );

    return updatedRequest;
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
