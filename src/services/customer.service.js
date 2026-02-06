import InspectionRequest from '../models/InspectionRequest.js';
import logger from '../utils/logger.js';

export async function submitInspectionRequest(payload) {
  try {
    const inspectionRequest = await InspectionRequest.create({
      ...payload,
      adminJobId: null,
      status: 'PENDING',
    });

    logger.info(
      {
        event: 'create_inspection_request',
        requestNumber: inspectionRequest.requestNumber,
        status: inspectionRequest.status,
      },
      'Inspection request saved'
    );

    return {
      requestId: inspectionRequest.requestNumber,
      adminJobId: null,
      status: inspectionRequest.status,
    };
  } catch (error) {
    logger.error(
      {
        event: 'create_inspection_request_failed',
        error: error.message,
      },
      'Mongo save failed for inspection request'
    );

    throw error;
  }
}

export async function getInspectionRequests() {
  const requests = await InspectionRequest.find()
    .sort({ createdAt: -1 })
    .select('requestNumber serviceType status schedule.date createdAt');

  return requests.map((item) => ({
    requestId: item.requestNumber,
    serviceType: item.serviceType,
    status: item.status,
    scheduledDate: item.schedule.date,
    createdAt: item.createdAt,
  }));
}
