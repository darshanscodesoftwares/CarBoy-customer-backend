import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import InspectionRequest from '../models/InspectionRequest.js';
import { forwardInspectionRequestToAdmin } from './customer.service.js';
import { markCouponUsed } from '../integrations/adminClient.js';

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
      // Could be a payment link payment — no order associated, handle gracefully
      logger.warn(
        { event: 'no_request_for_order', razorpayOrderId },
        'No inspection request found for this order ID (may be a payment link payment)'
      );
      return null;
    }

    // Idempotency: if request already forwarded, skip processing
    if (inspectionRequest.adminJobId) {
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

    const isPartial = inspectionRequest.payment.type === 'PARTIAL';
    let paidRequest = inspectionRequest;

    if (isPartial) {
      // PARTIAL: mark as PARTIALLY_PAID, set paidAmount
      const paidAmount = inspectionRequest.payment.amount - inspectionRequest.payment.remainingAmount;
      paidRequest = await InspectionRequest.findByIdAndUpdate(
        inspectionRequest._id,
        {
          status: 'PARTIALLY_PAID',
          'payment.status': 'PARTIALLY_PAID',
          'payment.razorpayPaymentId': razorpayPaymentId,
          'payment.paidAt': new Date(),
          'payment.paidAmount': paidAmount,
        },
        { new: true }
      );
    } else {
      // FULL: mark as PAID (existing behavior)
      if (inspectionRequest.payment.status !== 'PAID' || inspectionRequest.status !== 'PAID') {
        paidRequest = await InspectionRequest.findByIdAndUpdate(
          inspectionRequest._id,
          {
            status: 'PAID',
            'payment.status': 'PAID',
            'payment.razorpayPaymentId': razorpayPaymentId,
            'payment.paidAt': new Date(),
            'payment.paidAmount': inspectionRequest.payment.amount,
            'payment.remainingAmount': 0,
          },
          { new: true }
        );
      }
    }

    if (!paidRequest) {
      throw new AppError('Failed to update inspection request after payment', 500);
    }

    // Mark coupon as used if one was applied
    if (paidRequest.appliedCoupon?.code) {
      await markCouponUsed(paidRequest.appliedCoupon.code, paidRequest.customerSnapshot?.phone);
    }

    // Forward to admin after payment (PAID or PARTIALLY_PAID)
    const adminResponse = await forwardInspectionRequestToAdmin(paidRequest);

    let finalRequest = paidRequest;
    if (adminResponse && adminResponse.data?.id) {
      finalRequest = await InspectionRequest.findByIdAndUpdate(
        paidRequest._id,
        { adminJobId: adminResponse.data.id },
        { new: true }
      );
    }

    logger.info(
      {
        event: 'payment_marked_successful',
        razorpayOrderId,
        razorpayPaymentId,
        paymentType: inspectionRequest.payment.type,
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

/**
 * Mark remaining payment as successful (from Razorpay Payment Link)
 * @param {string} paymentLinkId - Razorpay payment link ID
 * @param {string} razorpayPaymentId - Razorpay payment ID
 * @returns {Promise<Object>} Updated inspection request
 */
export async function markRemainingPaymentSuccessful(paymentLinkId, razorpayPaymentId) {
  try {
    if (!paymentLinkId) {
      throw new AppError('Invalid payment link ID', 400);
    }

    const inspectionRequest = await InspectionRequest.findOne({
      'payment.razorpayPaymentLinkId': paymentLinkId,
    });

    if (!inspectionRequest) {
      logger.warn(
        { event: 'no_request_for_payment_link', paymentLinkId },
        'No inspection request found for this payment link'
      );
      return null;
    }

    // Idempotency: skip if already fully paid
    if (inspectionRequest.payment.status === 'PAID') {
      logger.info(
        { event: 'remaining_payment_already_paid', paymentLinkId, requestNumber: inspectionRequest.requestNumber },
        'Remaining payment already marked as paid'
      );
      return inspectionRequest;
    }

    const updated = await InspectionRequest.findByIdAndUpdate(
      inspectionRequest._id,
      {
        'payment.status': 'PAID',
        'payment.paidAmount': inspectionRequest.payment.amount,
        'payment.remainingAmount': 0,
        'payment.remainingRazorpayPaymentId': razorpayPaymentId,
        'payment.remainingPaidAt': new Date(),
      },
      { new: true }
    );

    logger.info(
      {
        event: 'remaining_payment_successful',
        paymentLinkId,
        razorpayPaymentId,
        requestNumber: inspectionRequest.requestNumber,
      },
      'Remaining payment marked as successful'
    );

    return updated;
  } catch (error) {
    logger.error(
      { event: 'mark_remaining_payment_failed', paymentLinkId, error: error.message },
      'Failed to mark remaining payment as successful'
    );
    throw error;
  }
}

/**
 * Store Razorpay payment link details (called by admin backend)
 * @param {string} requestNumber - Inspection request number
 * @param {string} paymentLinkId - Razorpay payment link ID
 * @param {string} paymentLinkUrl - Razorpay payment link URL
 * @returns {Promise<Object>} Updated inspection request
 */
export async function storePaymentLinkDetails(requestNumber, paymentLinkId, paymentLinkUrl) {
  const request = await InspectionRequest.findOneAndUpdate(
    { requestNumber, 'payment.type': 'PARTIAL' },
    {
      $set: {
        'payment.razorpayPaymentLinkId': paymentLinkId,
        'payment.razorpayPaymentLinkUrl': paymentLinkUrl,
      },
    },
    { new: true }
  );

  if (!request) {
    throw new AppError('Request not found or not a partial payment', 404);
  }

  logger.info(
    { event: 'payment_link_stored', requestNumber, paymentLinkId },
    'Payment link details stored'
  );

  return request;
}
