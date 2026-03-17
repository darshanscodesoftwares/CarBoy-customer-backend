import axios from 'axios';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

export async function notifyAdminCancellation(payload) {
  const url = `${env.adminBaseUrl}/inspection-requests/${payload.requestNumber}/cancel`;

  try {
    const response = await axios.post(url, payload, {
      timeout: env.adminTimeoutMs,
    });

    logger.info({ event: 'admin_cancel_notify_success', requestNumber: payload.requestNumber }, 'Admin notified of cancellation');
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to notify admin of cancellation';
    logger.error({ event: 'admin_cancel_notify_failed', requestNumber: payload.requestNumber, error: message }, 'Admin cancellation notification failed');
    throw new AppError(`Failed to notify admin of cancellation: ${message}`, error.response?.status || 502);
  }
}

export async function notifyAdminReschedule(payload) {
  const url = `${env.adminBaseUrl}/inspection-requests/${payload.requestNumber}/reschedule`;

  try {
    const response = await axios.post(url, payload, {
      timeout: env.adminTimeoutMs,
    });

    logger.info({ event: 'admin_reschedule_notify_success', requestNumber: payload.requestNumber }, 'Admin notified of reschedule');
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to notify admin of reschedule';
    logger.error({ event: 'admin_reschedule_notify_failed', requestNumber: payload.requestNumber, error: message }, 'Admin reschedule notification failed');
    throw new AppError(`Failed to notify admin of reschedule: ${message}`, error.response?.status || 502);
  }
}

export async function getCancellationPolicy() {
  const url = `${env.adminBaseUrl}/settings/cancellation-policy`;

  try {
    const response = await axios.get(url, {
      timeout: env.adminTimeoutMs,
    });

    logger.info({ event: 'fetch_cancellation_policy_success' }, 'Cancellation policy fetched from admin');
    return response.data?.data || response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to fetch cancellation policy';
    logger.error({ event: 'fetch_cancellation_policy_failed', error: message }, 'Failed to fetch cancellation policy');
    throw new AppError(`Failed to fetch cancellation policy: ${message}`, error.response?.status || 502);
  }
}

export async function forwardEnquiry(payload) {
  const url = `${env.adminBaseUrl}/enquiries`;

  try {
    const response = await axios.post(url, payload, {
      timeout: env.adminTimeoutMs,
    });

    logger.info({ event: 'enquiry_forwarded_success' }, 'Enquiry forwarded to admin');
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to forward enquiry';
    logger.error({ event: 'enquiry_forward_failed', error: message }, 'Enquiry forward to admin failed');
    throw new AppError(`Failed to forward enquiry: ${message}`, error.response?.status || 502);
  }
}

export async function createAdminJob(jobPayload) {
  const url = `${env.adminBaseUrl}/inspection-requests`;

  try {
    const response = await axios.post(url, jobPayload, {
      timeout: env.adminTimeoutMs,
    });

    logger.info({ event: 'admin_job_create_success', adminStatusCode: response.status }, 'Admin job created successfully');
    return response.data;
  } catch (error) {
    const statusCode = error.response?.status || 502;
    const message = error.response?.data?.message || error.message || 'Failed to create admin job';
    logger.error({ event: 'admin_job_create_failed', statusCode, error: message }, 'Admin job creation failed');
    throw new AppError(`Failed to forward request to Admin BE: ${message}`, statusCode);
  }
}
