import InspectionRequest from '../models/InspectionRequest.js';
import { createRazorpayOrder, verifyWebhookSignature, markPaymentSuccessful } from '../services/payment.service.js';
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
    const { requestNumber } = req.body;

    if (!requestNumber) {
      return errorResponse(res, 'Request number is required', 400);
    }

    // Fetch inspection request
    const inspectionRequest = await InspectionRequest.findOne({
      requestNumber,
    });

    if (!inspectionRequest) {
      return errorResponse(res, 'Inspection request not found', 404);
    }

    // Check if already paid
    if (inspectionRequest.payment.status === 'PAID') {
      return errorResponse(res, 'Payment already completed for this request', 400);
    }

    // Check if request has a valid price
    const amount = inspectionRequest.vehicleSnapshot?.price;
    if (!amount || amount <= 0) {
      logger.warn(
        {
          event: 'invalid_payment_amount',
          requestNumber,
          amount,
        },
        'Cannot create payment order without valid vehicle price'
      );
      return errorResponse(res, 'Vehicle price not available for this request', 400);
    }

    // Convert amount to paise (smallest currency unit)
    const amountInPaise = Math.round(amount * 100);

    // Create Razorpay order
    const razorpayOrder = await createRazorpayOrder({
      amount: amountInPaise,
      receipt: requestNumber,
    });

    // Save order details to inspection request
    await InspectionRequest.findByIdAndUpdate(
      inspectionRequest._id,
      {
        'payment.status': 'PENDING',
        'payment.razorpayOrderId': razorpayOrder.id,
        'payment.amount': amount,
        'payment.currency': 'INR',
      },
      { new: true }
    );

    logger.info(
      {
        event: 'payment_order_created_in_db',
        requestNumber,
        razorpayOrderId: razorpayOrder.id,
        amount,
        webhookUrl: getWebhookUrl('/api/customer/payments/webhook'),
      },
      'Payment order created and saved'
    );

    return successResponse(
      res,
      {
        orderId: razorpayOrder.id,
        amount,
        currency: 'INR',
        key: env.razorpayKeyId,
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
