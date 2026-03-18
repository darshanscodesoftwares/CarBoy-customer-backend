import {
  signupLocal,
  loginLocal,
  authenticateGoogle,
  authenticateApple,
  getCurrentUser,
  updateProfile,
} from '../services/auth.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

export async function signup(req, res) {
  try {
    const result = await signupLocal(req.body);
    return successResponse(res, result, 'Account created successfully', 201);
  } catch (error) {
    logger.error({ event: 'signup_failed', error: error.message }, 'Signup failed');
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

export async function login(req, res) {
  try {
    const result = await loginLocal(req.body);
    return successResponse(res, result, 'Login successful');
  } catch (error) {
    logger.error({ event: 'login_failed', error: error.message }, 'Login failed');
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

export async function googleAuth(req, res) {
  try {
    const result = await authenticateGoogle(req.body);
    return successResponse(res, result, 'Google authentication successful');
  } catch (error) {
    logger.error({ event: 'google_auth_failed', error: error.message }, 'Google auth failed');
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

export async function appleAuth(req, res) {
  try {
    const result = await authenticateApple(req.body);
    return successResponse(res, result, 'Apple authentication successful');
  } catch (error) {
    logger.error({ event: 'apple_auth_failed', error: error.message }, 'Apple auth failed');
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

export async function getMe(req, res) {
  try {
    const user = await getCurrentUser(req.userId);
    return successResponse(res, user, 'User profile fetched');
  } catch (error) {
    logger.error({ event: 'get_me_failed', error: error.message }, 'Get profile failed');
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

export async function updateMe(req, res) {
  try {
    const user = await updateProfile(req.userId, req.body);
    return successResponse(res, user, 'Profile updated successfully');
  } catch (error) {
    logger.error({ event: 'update_me_failed', error: error.message }, 'Update profile failed');
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}
