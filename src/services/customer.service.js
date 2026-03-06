import InspectionRequest from '../models/InspectionRequest.js';
import { getBrands, getModelsByBrand } from './vehicleMaster.service.js';
import { createAdminJob } from '../integrations/adminClient.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * Submit inspection request - ONLY creates local record
 * Admin forwarding happens ONLY after Razorpay payment confirmation
 * @param {Object} payload - Inspection request payload
 * @returns {Promise<Object>} { requestId, adminJobId: null, status: 'PENDING_PAYMENT' }
 */
export async function submitInspectionRequest(payload) {
  try {
    // Extract and trim customerNotes from payload or customerSnapshot
    const customerNotes = (payload.customerNotes || payload.customerSnapshot?.notes || '').toString().trim().slice(0, 1000);

    // Enrich vehicleSnapshot with price - gracefully handle admin service failures
    let enrichedVehicleSnapshot;
    try {
      enrichedVehicleSnapshot = await enrichVehicleSnapshotWithPrice(payload.vehicleSnapshot);
    } catch (enrichError) {
      logger.warn(
        { event: 'price_enrichment_failed', error: enrichError.message },
        'Failed to enrich vehicle price, continuing with price: null'
      );
      enrichedVehicleSnapshot = { ...payload.vehicleSnapshot, price: null };
    }

    const enrichedPayload = {
      ...payload,
      vehicleSnapshot: enrichedVehicleSnapshot,
      customerNotes,
    };

    // Save to database with PENDING_PAYMENT status
    // Admin will receive this request ONLY after payment is confirmed via webhook
    const inspectionRequest = await InspectionRequest.create({
      ...enrichedPayload,
      adminJobId: null,
      status: 'PENDING_PAYMENT',
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

export async function forwardInspectionRequestToAdmin(inspectionRequest) {
  if (!inspectionRequest) {
    throw new AppError('Inspection request is required for admin forwarding', 400);
  }

  if (inspectionRequest.status === 'FORWARDED') {
    logger.info(
      {
        event: 'admin_forwarding_skipped_already_forwarded',
        requestNumber: inspectionRequest.requestNumber,
      },
      'Inspection request already forwarded to admin'
    );
    return null;
  }

  if (inspectionRequest.status !== 'PAID') {
    logger.warn(
      {
        event: 'admin_forwarding_skipped_not_paid',
        requestNumber: inspectionRequest.requestNumber,
        status: inspectionRequest.status,
      },
      'Skipping admin forwarding because request is not PAID'
    );
    return null;
  }

  const customerNotes = (inspectionRequest.customerNotes || inspectionRequest.customerSnapshot?.notes || '')
    .toString()
    .trim()
    .slice(0, 1000);

  const customerSnapshotWithNotes = {
    ...inspectionRequest.customerSnapshot,
    notes: customerNotes || '',
  };

  const adminJobPayload = {
    status: 'PAID',
    serviceType: inspectionRequest.serviceType,
    customerSnapshot: customerSnapshotWithNotes,
    vehicleSnapshot: inspectionRequest.vehicleSnapshot,
    schedule: inspectionRequest.schedule,
    location: inspectionRequest.location,
    customerNotes,
    requestNumber: inspectionRequest.requestNumber,
  };

  const adminResponse = await createAdminJob(adminJobPayload);

  logger.info(
    {
      event: 'admin_job_created',
      requestNumber: inspectionRequest.requestNumber,
      adminJobId: adminResponse.data?.id,
    },
    'Inspection request forwarded to admin'
  );

  return adminResponse;
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

/**
 * Fetch a single inspection request by ID with vehicle price
 * @param {string} requestId - The inspection request number
 * @returns {Promise<Object>} Full inspection request with vehicleSnapshot including price
 */
export async function getInspectionRequestById(requestId) {
  try {
    const inspectionRequest = await InspectionRequest.findOne({
      requestNumber: requestId,
    });

    if (!inspectionRequest) {
      throw new AppError('Inspection request not found', 404);
    }

    // Fetch vehicle price and add to vehicleSnapshot
    const vehicleSnapshotWithPrice = await enrichVehicleSnapshotWithPrice(
      inspectionRequest.vehicleSnapshot
    );

    return {
      requestId: inspectionRequest.requestNumber,
      serviceType: inspectionRequest.serviceType,
      customerSnapshot: inspectionRequest.customerSnapshot,
      vehicleSnapshot: vehicleSnapshotWithPrice,
      schedule: inspectionRequest.schedule,
      location: inspectionRequest.location,
      status: inspectionRequest.status,
      payment: inspectionRequest.payment,
      customerNotes: inspectionRequest.customerNotes,
      adminJobId: inspectionRequest.adminJobId,
      createdAt: inspectionRequest.createdAt,
      updatedAt: inspectionRequest.updatedAt,
    };
  } catch (error) {
    logger.error(
      {
        event: 'get_inspection_request_by_id_failed',
        requestId,
        error: error.message,
      },
      'Failed to fetch inspection request by ID'
    );

    throw error;
  }
}

/**
 * Enrich vehicleSnapshot with price from VehicleModel
 * @param {Object} vehicleSnapshot - The vehicle snapshot object
 * @returns {Promise<Object>} Enhanced vehicleSnapshot with price
 */
async function enrichVehicleSnapshotWithPrice(vehicleSnapshot) {
  try {
    // Get all brands
    const brands = await getBrands();

    // Find brand matching the vehicleSnapshot brand name
    const matchedBrand = brands.find(
      (brand) => brand.name.toLowerCase() === vehicleSnapshot.brand.toLowerCase()
    );

    if (!matchedBrand) {
      logger.warn(
        { event: 'brand_not_found', brandName: vehicleSnapshot.brand },
        'Brand not found in vehicle master'
      );
      return { ...vehicleSnapshot, price: null };
    }

    // Get models for the matched brand
    const models = await getModelsByBrand(matchedBrand.id);

    // Find model matching the vehicleSnapshot model name
    const matchedModel = models.find(
      (model) => model.name.toLowerCase() === vehicleSnapshot.model.toLowerCase()
    );

    if (!matchedModel) {
      logger.warn(
        {
          event: 'model_not_found',
          brandName: vehicleSnapshot.brand,
          modelName: vehicleSnapshot.model,
        },
        'Model not found in vehicle master'
      );
      return { ...vehicleSnapshot, price: null };
    }

    return { ...vehicleSnapshot, price: matchedModel.price };
  } catch (error) {
    logger.error(
      {
        event: 'enrich_vehicle_snapshot_failed',
        error: error.message,
        brandName: vehicleSnapshot.brand,
        modelName: vehicleSnapshot.model,
      },
      'Failed to enrich vehicleSnapshot with price'
    );

    // Return vehicleSnapshot with null price on error instead of throwing
    return { ...vehicleSnapshot, price: null };
  }
}
