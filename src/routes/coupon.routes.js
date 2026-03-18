import express from 'express';
import { validateCouponCode, markCouponAsUsed } from '../controllers/coupon.controller.js';

const router = express.Router();

// Public — no JWT auth, admin BE handles all validation
router.post('/validate', validateCouponCode);
router.post('/mark-used', markCouponAsUsed);

export default router;
