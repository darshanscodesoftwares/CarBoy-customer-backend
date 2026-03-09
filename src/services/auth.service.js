import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

const googleClient = new OAuth2Client(env.googleClientId);

// ─── Helpers ────────────────────────────────────────────────

function generateToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function buildAuthResponse(user) {
  return {
    token: generateToken(user),
    user: user.toSafeObject(),
  };
}

// ─── Local Signup ───────────────────────────────────────────

export async function signupLocal({ name, email, password, phone }) {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    phone: phone || '',
    authProvider: 'local',
    isEmailVerified: false,
  });

  logger.info({ event: 'user_signup', provider: 'local', userId: user._id }, 'New local user registered');
  return buildAuthResponse(user);
}

// ─── Local Login ────────────────────────────────────────────

export async function loginLocal({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  if (user.authProvider !== 'local') {
    throw new AppError(
      `This account uses ${user.authProvider} sign-in. Please use the ${user.authProvider} button to log in.`,
      400
    );
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Invalid email or password', 401);
  }

  logger.info({ event: 'user_login', provider: 'local', userId: user._id }, 'Local user logged in');
  return buildAuthResponse(user);
}

// ─── Google OAuth ───────────────────────────────────────────

export async function authenticateGoogle({ idToken }) {
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.googleClientId,
    });
    payload = ticket.getPayload();
  } catch (err) {
    logger.error({ event: 'google_token_verify_failed', error: err.message }, 'Google token verification failed');
    throw new AppError('Invalid Google token', 401);
  }

  const { sub: googleId, email, name, picture, email_verified } = payload;

  // Check if user exists by providerId OR by email
  let user = await User.findOne({
    $or: [
      { authProvider: 'google', providerId: googleId },
      { email: email.toLowerCase() },
    ],
  });

  if (user) {
    // If existing user signed up with a different provider, link Google
    if (user.authProvider !== 'google') {
      throw new AppError(
        `An account with this email already exists using ${user.authProvider} sign-in. Please log in with ${user.authProvider}.`,
        409
      );
    }

    // Update profile info from Google if changed
    user.name = name || user.name;
    user.profilePicture = picture || user.profilePicture;
    user.isEmailVerified = email_verified || user.isEmailVerified;
    await user.save();

    logger.info({ event: 'user_login', provider: 'google', userId: user._id }, 'Google user logged in');
  } else {
    // Create new user
    user = await User.create({
      name: name || 'Google User',
      email: email.toLowerCase(),
      authProvider: 'google',
      providerId: googleId,
      profilePicture: picture || null,
      isEmailVerified: email_verified || false,
    });

    logger.info({ event: 'user_signup', provider: 'google', userId: user._id }, 'New Google user registered');
  }

  return buildAuthResponse(user);
}

// ─── Apple OAuth ────────────────────────────────────────────

export async function authenticateApple({ idToken, user: appleUser }) {
  let payload;
  try {
    payload = await appleSignin.verifyIdToken(idToken, {
      audience: env.appleClientId,
      ignoreExpiration: false,
    });
  } catch (err) {
    logger.error({ event: 'apple_token_verify_failed', error: err.message }, 'Apple token verification failed');
    throw new AppError('Invalid Apple token', 401);
  }

  const { sub: appleId, email, email_verified } = payload;

  // Apple only sends name on first sign-in, frontend must pass it
  const appleName = appleUser?.name
    ? `${appleUser.name.firstName || ''} ${appleUser.name.lastName || ''}`.trim()
    : null;

  let user = await User.findOne({
    $or: [
      { authProvider: 'apple', providerId: appleId },
      ...(email ? [{ email: email.toLowerCase() }] : []),
    ],
  });

  if (user) {
    if (user.authProvider !== 'apple') {
      throw new AppError(
        `An account with this email already exists using ${user.authProvider} sign-in. Please log in with ${user.authProvider}.`,
        409
      );
    }

    // Update name if Apple provided it (first sign-in only)
    if (appleName && user.name === 'Apple User') {
      user.name = appleName;
      await user.save();
    }

    logger.info({ event: 'user_login', provider: 'apple', userId: user._id }, 'Apple user logged in');
  } else {
    user = await User.create({
      name: appleName || 'Apple User',
      email: email ? email.toLowerCase() : `apple_${appleId}@privaterelay.appleid.com`,
      authProvider: 'apple',
      providerId: appleId,
      isEmailVerified: email_verified === 'true' || email_verified === true,
    });

    logger.info({ event: 'user_signup', provider: 'apple', userId: user._id }, 'New Apple user registered');
  }

  return buildAuthResponse(user);
}

// ─── Get Current User ───────────────────────────────────────

export async function getCurrentUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user.toSafeObject();
}
