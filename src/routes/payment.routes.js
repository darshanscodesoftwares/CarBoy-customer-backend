import express from 'express';
import { createPaymentOrder, handlePaymentWebhook } from '../controllers/payment.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

/**
 * POST /api/customer/payments/create-order
 * Create a Razorpay order for inspection request payment
 *
 * Body: { requestNumber }
 * Response: { orderId, amount, currency, key }
 */
router.post('/create-order', authenticate, createPaymentOrder);

/**
 * POST /api/customer/payments/webhook
 * Handle Razorpay webhook for payment confirmation
 * NOTE: No auth middleware - Razorpay sends this directly with signature verification
 *
 * Requires: x-razorpay-signature header
 * Body: { event, payload }
 */
router.post('/webhook', handlePaymentWebhook);

export default router;
