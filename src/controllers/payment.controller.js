import InspectionRequest from '../models/InspectionRequest.js';
import { createRazorpayOrder, verifyWebhookSignature, markPaymentSuccessful, markRemainingPaymentSuccessful } from '../services/payment.service.js';
import { validateCoupon } from '../integrations/adminClient.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { env } from '../config/env.js';
import { getWebhookUrl } from '../config/app.config.js';
import logger from '../utils/logger.js';

/**
 * POST /api/customer/payments/create-order
 * Create a Razorpay order for inspection request payment
 *
 * Request body: { requestNumber }
 * Response: { orderId, amount, currency, key }
 */
export async function createPaymentOrder(req, res) {
  try {
    const { requestNumber, paymentType = 'FULL', couponCode } = req.body;

    if (!requestNumber) {
      return errorResponse(res, 'Request number is required', 400);
    }

    if (!['FULL', 'PARTIAL'].includes(paymentType)) {
      return errorResponse(res, 'paymentType must be FULL or PARTIAL', 400);
    }

    // Fetch inspection request
    const inspectionRequest = await InspectionRequest.findOne({
      requestNumber,
    });

    if (!inspectionRequest) {
      return errorResponse(res, 'Inspection request not found', 404);
    }

    // Check if already paid or partially paid
    if (inspectionRequest.payment.status === 'PAID') {
      return errorResponse(res, 'Payment already completed for this request', 400);
    }
    if (inspectionRequest.payment.status === 'PARTIALLY_PAID') {
      return errorResponse(res, 'Initial payment already completed. Awaiting remaining payment.', 400);
    }

    // Check if request has a valid price
    const totalAmount = inspectionRequest.vehicleSnapshot?.price;
    if (!totalAmount || totalAmount <= 0) {
      logger.warn(
        {
          event: 'invalid_payment_amount',
          requestNumber,
          amount: totalAmount,
        },
        'Cannot create payment order without valid vehicle price'
      );
      return errorResponse(res, 'Vehicle price not available for this request', 400);
    }

    // Validate and apply coupon if provided
    let couponData = null;
    let effectiveAmount = totalAmount;

    if (couponCode) {
      try {
        const phone = inspectionRequest.customerSnapshot?.phone;
        couponData = await validateCoupon(couponCode, phone, totalAmount);

        if (!couponData?.valid) {
          return errorResponse(res, 'Invalid coupon code', 400);
        }

        effectiveAmount = couponData.finalAmount;
      } catch (error) {
        return errorResponse(res, error.message, error.statusCode || 400);
      }
    }

    // Calculate charge amount based on payment type
    const chargeAmount = paymentType === 'PARTIAL'
      ? Math.ceil(effectiveAmount / 2)
      : effectiveAmount;
    const remainingAmount = paymentType === 'PARTIAL'
      ? effectiveAmount - chargeAmount
      : 0;

    // Convert charge amount to paise (smallest currency unit)
    const amountInPaise = Math.round(chargeAmount * 100);

    // Create Razorpay order
    const razorpayOrder = await createRazorpayOrder({
      amount: amountInPaise,
      receipt: requestNumber,
    });

    // Save order details to inspection request
    const updateFields = {
      'payment.status': 'PENDING',
      'payment.type': paymentType,
      'payment.razorpayOrderId': razorpayOrder.id,
      'payment.amount': effectiveAmount,
      'payment.paidAmount': 0,
      'payment.remainingAmount': remainingAmount,
      'payment.currency': 'INR',
    };

    if (couponData) {
      updateFields.appliedCoupon = {
        code: couponCode,
        discountType: couponData.discountType,
        discountValue: couponData.discountValue,
        discount: couponData.discount,
        originalAmount: totalAmount,
        finalAmount: couponData.finalAmount,
      };
    }

    await InspectionRequest.findByIdAndUpdate(
      inspectionRequest._id,
      updateFields,
      { new: true }
    );

    logger.info(
      {
        event: 'payment_order_created_in_db',
        requestNumber,
        razorpayOrderId: razorpayOrder.id,
        paymentType,
        chargeAmount,
        totalAmount,
        remainingAmount,
        webhookUrl: getWebhookUrl('/api/customer/payments/webhook'),
      },
      'Payment order created and saved'
    );

    return successResponse(
      res,
      {
        orderId: razorpayOrder.id,
        amount: chargeAmount,
        totalAmount: effectiveAmount,
        originalAmount: totalAmount,
        paymentType,
        remainingAmount,
        currency: 'INR',
        key: env.razorpayKeyId,
        ...(couponData && {
          coupon: {
            code: couponCode,
            discount: couponData.discount,
            discountType: couponData.discountType,
            discountValue: couponData.discountValue,
          },
        }),
      },
      'Payment order created successfully',
      201
    );
  } catch (error) {
    logger.error(
      {
        event: 'create_payment_order_failed',
        error: error.message,
        requestNumber: req.body?.requestNumber,
      },
      'Failed to create payment order'
    );

    const statusCode = error.statusCode || 500;
    const message = error.message || 'Failed to create payment order';

    return errorResponse(res, message, statusCode);
  }
}

/**
 * POST /api/customer/payments/webhook
 * Handle Razorpay webhook for payment confirmation
 *
 * Webhook signature verification required
 * Expects: { event, payload }
 */
export async function handlePaymentWebhook(req, res) {
  try {
    const signature = req.headers['x-razorpay-signature'];

    if (!signature) {
      logger.warn(
        {
          event: 'webhook_missing_signature',
        },
        'Webhook received without signature'
      );
      return errorResponse(res, 'Missing signature', 401);
    }

    // req.body is already the raw Buffer from express.raw()
    const rawBody = req.body;

    logger.info(
      {
        event: 'webhook_signature_verification',
        rawBodyLength: rawBody.length,
        signature: signature.substring(0, 20) + '...',
      },
      'Verifying webhook signature'
    );

    // Verify webhook signature
    const isValid = verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      logger.warn(
        {
          event: 'webhook_signature_invalid',
        },
        'Webhook signature verification failed'
      );
      return errorResponse(res, 'Invalid signature', 401);
    }

    // Parse JSON body after signature verification
    let webhookData;
    try {
      webhookData = JSON.parse(rawBody.toString('utf8'));
    } catch (parseError) {
      logger.error(
        {
          event: 'webhook_json_parse_failed',
          error: parseError.message,
        },
        'Failed to parse webhook JSON'
      );
      return errorResponse(res, 'Invalid JSON in webhook body', 400);
    }

    const { event, payload } = webhookData;

    logger.info(
      {
        event: 'webhook_received',
        eventType: event,
      },
      'Razorpay webhook received'
    );

    // Only process payment.authorized and payment.captured events
    if (event === 'payment.authorized' || event === 'payment.captured') {
      const paymentEntity = payload?.payment?.entity;

      if (!paymentEntity) {
        logger.warn(
          {
            event: 'webhook_invalid_payload',
            eventType: event,
            payload,
          },
          'Webhook payload missing payment entity'
        );
        return successResponse(res, {}, 'Webhook processed', 200);
      }

      const razorpayPaymentId = paymentEntity.id;
      const razorpayOrderId = paymentEntity.order_id;

      logger.info(
        {
          event: 'webhook_processing_payment',
          eventType: event,
          orderId: razorpayOrderId,
          paymentId: razorpayPaymentId,
        },
        'Processing payment from webhook'
      );

      try {
        // Mark payment as successful
        await markPaymentSuccessful(razorpayOrderId, razorpayPaymentId);

        return successResponse(res, {}, 'Payment processed successfully', 200);
      } catch (updateError) {
        logger.error(
          {
            event: 'webhook_payment_update_failed',
            orderId: razorpayOrderId,
            paymentId: razorpayPaymentId,
            error: updateError.message,
          },
          'Failed to update payment status from webhook'
        );

        // Still return 200 to prevent Razorpay retries for non-recoverable errors
        return successResponse(res, {}, 'Webhook acknowledged', 200);
      }
    }

    // Handle payment link paid event (remaining payment for partial)
    if (event === 'payment_link.paid') {
      const linkEntity = payload?.payment_link?.entity;

      if (!linkEntity) {
        logger.warn(
          { event: 'webhook_invalid_payment_link_payload', eventType: event },
          'Webhook payload missing payment_link entity'
        );
        return successResponse(res, {}, 'Webhook processed', 200);
      }

      const paymentLinkId = linkEntity.id;
      const paymentId = linkEntity.payments?.[0]?.payment_id || payload?.payment?.entity?.id;

      logger.info(
        { event: 'webhook_processing_payment_link', paymentLinkId, paymentId },
        'Processing payment link paid event'
      );

      try {
        await markRemainingPaymentSuccessful(paymentLinkId, paymentId);
        return successResponse(res, {}, 'Remaining payment processed successfully', 200);
      } catch (updateError) {
        logger.error(
          { event: 'webhook_payment_link_update_failed', paymentLinkId, error: updateError.message },
          'Failed to update remaining payment from webhook'
        );
        return successResponse(res, {}, 'Webhook acknowledged', 200);
      }
    }

    // For other events, just acknowledge
    logger.info(
      {
        event: 'webhook_acknowledged',
        eventType: event,
      },
      'Webhook acknowledged'
    );

    return successResponse(res, {}, 'Webhook acknowledged', 200);
  } catch (error) {
    logger.error(
      {
        event: 'webhook_processing_failed',
        error: error.message,
      },
      'Failed to process webhook'
    );

    // Return 200 to prevent Razorpay from retrying
    return successResponse(res, {}, 'Webhook acknowledged', 200);
  }
}
