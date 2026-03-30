import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import logger from './logger.js';

const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.in',
  port: 465,
  secure: true,
  auth: {
    user: env.zohoUser,
    pass: env.zohoPass,
  },
});

export function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOTPEmail(to, otp) {
  const mailOptions = {
    from: `"MyCarBoy" <${env.zohoUser}>`,
    to,
    subject: 'Verify your email - MyCarBoy',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #2d6a4f;">MyCarBoy</h2>
        <p>Your verification code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background: #f0f0f0; border-radius: 8px; margin: 16px 0;">
          ${otp}
        </div>
        <p style="color: #666; font-size: 14px;">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info({ event: 'otp_email_sent', to }, 'OTP email sent');
  } catch (error) {
    logger.error({ event: 'otp_email_failed', to, error: error.message }, 'Failed to send OTP email');
    throw error;
  }
}
