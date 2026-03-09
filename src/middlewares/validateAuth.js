import { errorResponse } from '../utils/response.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignup(req, res, next) {
  const { name, email, password } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return errorResponse(res, 'Name is required and must be at least 2 characters', 400);
  }

  if (!email || !EMAIL_REGEX.test(email)) {
    return errorResponse(res, 'A valid email is required', 400);
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return errorResponse(res, 'Password is required and must be at least 8 characters', 400);
  }

  req.body.name = name.trim();
  req.body.email = email.trim().toLowerCase();
  return next();
}

export function validateLogin(req, res, next) {
  const { email, password } = req.body;

  if (!email || !EMAIL_REGEX.test(email)) {
    return errorResponse(res, 'A valid email is required', 400);
  }

  if (!password) {
    return errorResponse(res, 'Password is required', 400);
  }

  req.body.email = email.trim().toLowerCase();
  return next();
}

export function validateGoogleAuth(req, res, next) {
  const { idToken } = req.body;

  if (!idToken || typeof idToken !== 'string') {
    return errorResponse(res, 'Google ID token is required', 400);
  }

  return next();
}

export function validateAppleAuth(req, res, next) {
  const { idToken } = req.body;

  if (!idToken || typeof idToken !== 'string') {
    return errorResponse(res, 'Apple ID token is required', 400);
  }

  return next();
}
