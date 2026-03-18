import express from 'express';
import { signup, login, googleAuth, appleAuth, getMe, updateMe, verifyEmail, resendVerificationOTP } from '../controllers/auth.controller.js';
import { validateSignup, validateLogin, validateGoogleAuth, validateAppleAuth } from '../middlewares/validateAuth.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Public routes
router.post('/signup', validateSignup, signup);
router.post('/login', validateLogin, login);
router.post('/google', validateGoogleAuth, googleAuth);
router.post('/apple', validateAppleAuth, appleAuth);
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendVerificationOTP);

// Protected routes
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateMe);

export default router;
