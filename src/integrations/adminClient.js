import axios from 'axios';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

export async function createAdminJob(jobPayload) {
  const url = `${env.adminBaseUrl}/jobs`;

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
