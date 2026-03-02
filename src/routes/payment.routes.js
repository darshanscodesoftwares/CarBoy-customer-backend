import express from 'express';
import { createPaymentOrder, handlePaymentWebhook } from '../controllers/payment.controller.js';

const router = express.Router();

/**
 * POST /api/customer/payments/create-order
 * Create a Razorpay order for inspection request payment
 *
 * Body: { requestNumber }
 * Response: { orderId, amount, currency, key }
 */
router.post('/create-order', createPaymentOrder);

/**
 * POST /api/customer/payments/webhook
 * Handle Razorpay webhook for payment confirmation
 *
 * Requires: x-razorpay-signature header
 * Body: { event, payload }
 */
router.post('/webhook', handlePaymentWebhook);

export default router;
