import InspectionRequest from '../models/InspectionRequest.js';
import { getBrands, getModelsByBrand } from './vehicleMaster.service.js';
import { createAdminJob, notifyAdminCancellation, notifyAdminReschedule } from '../integrations/adminClient.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * Submit inspection request - ONLY creates local record
 * Admin forwarding happens ONLY after Razorpay payment confirmation
 * @param {Object} payload - Inspection request payload
 * @returns {Promise<Object>} { requestId, adminJobId: null, status: 'PENDING_PAYMENT' }
 */
export async function submitInspectionRequest(payload, userId) {
  try {
    // Extract and trim customerNotes from payload or customerSnapshot
    const customerNotes = (payload.customerNotes || payload.customerSnapshot?.notes || '').toString().trim().slice(0, 1000);

    const addOnVSH = payload.serviceType === 'UCI' && payload.addOnVSH === true;
    const addOnVSHPrice = addOnVSH ? (payload.addOnVSHPrice || 499) : 0;

    // Enrich vehicleSnapshot with price - skip for VSH (no brand/model master data)
    let enrichedVehicleSnapshot;
    if (payload.serviceType === 'VSH') {
      enrichedVehicleSnapshot = { ...payload.vehicleSnapshot, price: null };
    } else {
      try {
        enrichedVehicleSnapshot = await enrichVehicleSnapshotWithPrice(payload.vehicleSnapshot);
      } catch (enrichError) {
        logger.warn(
          { event: 'price_enrichment_failed', error: enrichError.message },
          'Failed to enrich vehicle price, continuing with price: null'
        );
        enrichedVehicleSnapshot = { ...payload.vehicleSnapshot, price: null };
      }
    }

    const enrichedPayload = {
      ...payload,
      vehicleSnapshot: enrichedVehicleSnapshot,
      customerNotes,
      addOnVSH,
      addOnVSHPrice,
    };

    // Derive district from address if not provided — availability service
    // filters bookings by district, so an empty string makes the booking invisible
    if (!enrichedPayload.district) {
      const addressLower = (enrichedPayload.location?.address || '').toLowerCase();
      if (addressLower.includes('coimbatore')) {
        enrichedPayload.district = 'Coimbatore';
      } else if (addressLower.includes('chennai')) {
        enrichedPayload.district = 'Chennai';
      }
    }

    // Save to database with PENDING_PAYMENT status
    // Admin will receive this request ONLY after payment is confirmed via webhook
    const inspectionRequest = await InspectionRequest.create({
      ...enrichedPayload,
      userId: userId || null,
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

  if (inspectionRequest.adminJobId) {
    logger.info(
      {
        event: 'admin_forwarding_skipped_already_forwarded',
        requestNumber: inspectionRequest.requestNumber,
      },
      'Inspection request already forwarded to admin'
    );
    return null;
  }

  if (inspectionRequest.status !== 'PAID' && inspectionRequest.status !== 'PARTIALLY_PAID') {
    logger.warn(
      {
        event: 'admin_forwarding_skipped_not_paid',
        requestNumber: inspectionRequest.requestNumber,
        status: inspectionRequest.status,
      },
      'Skipping admin forwarding because request is not PAID or PARTIALLY_PAID'
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
    status: inspectionRequest.status,
    serviceType: inspectionRequest.serviceType,
    customerSnapshot: customerSnapshotWithNotes,
    vehicleSnapshot: inspectionRequest.vehicleSnapshot,
    schedule: inspectionRequest.schedule,
    district: inspectionRequest.district || '',
    location: inspectionRequest.location,
    customerNotes,
    requestNumber: inspectionRequest.requestNumber,
    paymentType: inspectionRequest.payment?.type || 'FULL',
    paidAmount: inspectionRequest.payment?.paidAmount || 0,
    remainingAmount: inspectionRequest.payment?.remainingAmount || 0,
    addOnVSH: inspectionRequest.addOnVSH || false,
    addOnVSHPrice: inspectionRequest.addOnVSHPrice || 0,
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

export async function getInspectionRequests(userId) {
  const filter = userId ? { userId } : {};
  // Hide VSH requests still in PENDING_PAYMENT (user abandoned payment)
  filter.$nor = [{ serviceType: 'VSH', status: 'PENDING_PAYMENT' }];
  const requests = await InspectionRequest.find(filter)
    .sort({ createdAt: -1 })
    .select('requestNumber serviceType status schedule vehicleSnapshot location createdAt cancellation reschedule assignmentFailure refund payment vshFile');

  return requests.map((item) => ({
    requestId: item.requestNumber,
    serviceType: item.serviceType,
    status: item.status,
    schedule: item.schedule?.date ? item.schedule : null,
    scheduledDate: item.schedule?.date || null,
    vehicleSnapshot: item.vehicleSnapshot || null,
    location: item.location?.address ? item.location : null,
    createdAt: item.createdAt,
    cancellation: item.cancellation || null,
    reschedule: item.reschedule || null,
    assignmentFailure: item.assignmentFailure || null,
    refund: item.refund || null,
    payment: item.payment || null,
    vshFile: item.vshFile?.url ? item.vshFile : null,
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

    // Fetch vehicle price — skip for VSH (no brand/model master data)
    let vehicleSnapshotWithPrice;
    if (inspectionRequest.serviceType === 'VSH') {
      vehicleSnapshotWithPrice = inspectionRequest.vehicleSnapshot;
    } else {
      vehicleSnapshotWithPrice = await enrichVehicleSnapshotWithPrice(inspectionRequest.vehicleSnapshot);
    }

    return {
      requestId: inspectionRequest.requestNumber,
      serviceType: inspectionRequest.serviceType,
      customerSnapshot: inspectionRequest.customerSnapshot,
      vehicleSnapshot: vehicleSnapshotWithPrice,
      schedule: inspectionRequest.schedule?.date ? inspectionRequest.schedule : null,
      location: inspectionRequest.location?.address ? inspectionRequest.location : null,
      status: inspectionRequest.status,
      payment: inspectionRequest.payment,
      customerNotes: inspectionRequest.customerNotes,
      adminJobId: inspectionRequest.adminJobId,
      cancellation: inspectionRequest.cancellation || null,
      reschedule: inspectionRequest.reschedule || null,
      assignmentFailure: inspectionRequest.assignmentFailure || null,
      refund: inspectionRequest.refund || null,
      statusHistory: inspectionRequest.statusHistory || [],
      vshFile: inspectionRequest.vshFile?.url ? inspectionRequest.vshFile : null,
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

const CANCELLABLE_STATUSES = ['RESCHEDULED', 'PAID', 'PARTIALLY_PAID'];
const RESCHEDULABLE_STATUSES = ['PAID', 'PARTIALLY_PAID'];

export async function requestCancellation(requestNumber, userId, reason) {
  const request = await InspectionRequest.findOneAndUpdate(
    { requestNumber, userId, status: { $in: CANCELLABLE_STATUSES } },
    {
      $set: {
        status: 'CANCELLATION_REQUESTED',
        'cancellation.reason': reason,
        'cancellation.requestedAt': new Date(),
      },
      $push: {
        statusHistory: {
          from: undefined, // will be set below
          to: 'CANCELLATION_REQUESTED',
          changedAt: new Date(),
          changedBy: 'CUSTOMER',
          note: reason,
        },
      },
    },
    { new: false } // return old doc to get previous status
  );

  if (!request) {
    const exists = await InspectionRequest.findOne({ requestNumber, userId });
    if (!exists) throw new AppError('Inspection request not found', 404);
    throw new AppError(`Cannot cancel a request with status: ${exists.status}`, 400);
  }

  // Fix statusHistory.from with actual previous status
  await InspectionRequest.updateOne(
    { requestNumber, 'statusHistory.from': null },
    { $set: { 'statusHistory.$.from': request.status } }
  );

  // Fire-and-forget admin notification
  notifyAdminCancellation({
    requestNumber,
    reason,
    customerSnapshot: request.customerSnapshot,
    requestedAt: new Date(),
  }).catch((err) => {
    logger.warn({ event: 'admin_cancel_notify_failed_silent', requestNumber, error: err.message }, 'Admin cancel notification failed (non-blocking)');
  });

  const updated = await InspectionRequest.findOne({ requestNumber });
  logger.info({ event: 'cancellation_requested', requestNumber }, 'Cancellation requested');

  return {
    requestId: updated.requestNumber,
    status: updated.status,
    cancellation: updated.cancellation,
  };
}

export async function requestReschedule(requestNumber, userId, newSchedule, reason) {
  const request = await InspectionRequest.findOneAndUpdate(
    { requestNumber, userId, status: { $in: RESCHEDULABLE_STATUSES } },
    {
      $set: {
        status: 'RESCHEDULE_REQUESTED',
        'reschedule.reason': reason || '',
        'reschedule.originalSchedule': undefined, // set below
        'reschedule.requestedSchedule': newSchedule,
        'reschedule.requestedAt': new Date(),
      },
      $push: {
        statusHistory: {
          from: undefined,
          to: 'RESCHEDULE_REQUESTED',
          changedAt: new Date(),
          changedBy: 'CUSTOMER',
          note: reason || `Reschedule to ${newSchedule.date} ${newSchedule.slot}`,
        },
      },
    },
    { new: false }
  );

  if (!request) {
    const exists = await InspectionRequest.findOne({ requestNumber, userId });
    if (!exists) throw new AppError('Inspection request not found', 404);
    throw new AppError(`Cannot reschedule a request with status: ${exists.status}`, 400);
  }

  // Set originalSchedule and fix statusHistory.from
  await InspectionRequest.updateOne(
    { requestNumber },
    {
      $set: {
        'reschedule.originalSchedule': request.schedule,
      },
    }
  );
  await InspectionRequest.updateOne(
    { requestNumber, 'statusHistory.from': null },
    { $set: { 'statusHistory.$.from': request.status } }
  );

  // Fire-and-forget admin notification
  notifyAdminReschedule({
    requestNumber,
    reason: reason || '',
    originalSchedule: request.schedule,
    requestedSchedule: newSchedule,
    customerSnapshot: request.customerSnapshot,
    requestedAt: new Date(),
  }).catch((err) => {
    logger.warn({ event: 'admin_reschedule_notify_failed_silent', requestNumber, error: err.message }, 'Admin reschedule notification failed (non-blocking)');
  });

  const updated = await InspectionRequest.findOne({ requestNumber });
  logger.info({ event: 'reschedule_requested', requestNumber }, 'Reschedule requested');

  return {
    requestId: updated.requestNumber,
    status: updated.status,
    reschedule: updated.reschedule,
  };
}

export async function confirmCancellation(requestNumber, adminNote) {
  const request = await InspectionRequest.findOneAndUpdate(
    { requestNumber, status: 'CANCELLATION_REQUESTED' },
    {
      $set: {
        status: 'CANCELLED',
        'cancellation.confirmedAt': new Date(),
      },
      $push: {
        statusHistory: {
          from: 'CANCELLATION_REQUESTED',
          to: 'CANCELLED',
          changedAt: new Date(),
          changedBy: 'ADMIN',
          note: adminNote || 'Cancellation approved by admin',
        },
      },
    },
    { new: true }
  );

  if (!request) {
    throw new AppError('Request not found or not in CANCELLATION_REQUESTED status', 404);
  }

  logger.info({ event: 'cancellation_confirmed', requestNumber }, 'Cancellation confirmed by admin');
  return request;
}

export async function confirmReschedule(requestNumber, adminNote) {
  const request = await InspectionRequest.findOne({ requestNumber, status: 'RESCHEDULE_REQUESTED' });

  if (!request) {
    throw new AppError('Request not found or not in RESCHEDULE_REQUESTED status', 404);
  }

  const updated = await InspectionRequest.findOneAndUpdate(
    { requestNumber, status: 'RESCHEDULE_REQUESTED' },
    {
      $set: {
        status: 'RESCHEDULED',
        schedule: request.reschedule.requestedSchedule,
        'reschedule.confirmedAt': new Date(),
      },
      $push: {
        statusHistory: {
          from: 'RESCHEDULE_REQUESTED',
          to: 'RESCHEDULED',
          changedAt: new Date(),
          changedBy: 'ADMIN',
          note: adminNote || 'Reschedule approved by admin',
        },
      },
    },
    { new: true }
  );

  logger.info({ event: 'reschedule_confirmed', requestNumber }, 'Reschedule confirmed by admin');
  return updated;
}

export async function handleAssignmentFailed(requestNumber) {
  const request = await InspectionRequest.findOneAndUpdate(
    { requestNumber, status: { $nin: ['CANCELLED', 'REFUNDED', 'ASSIGNMENT_FAILED'] } },
    {
      $set: {
        status: 'ASSIGNMENT_FAILED',
        'assignmentFailure.reason': 'No expert was assigned within the required time',
        'assignmentFailure.failedAt': new Date(),
      },
      $push: {
        statusHistory: {
          from: undefined,
          to: 'ASSIGNMENT_FAILED',
          changedAt: new Date(),
          changedBy: 'ADMIN',
          note: 'No expert was assigned within the required time',
        },
      },
    },
    { new: false }
  );

  if (!request) {
    throw new AppError('Request not found or already in a terminal status', 404);
  }

  // Fix statusHistory.from
  await InspectionRequest.updateOne(
    { requestNumber, 'statusHistory.from': null },
    { $set: { 'statusHistory.$.from': request.status } }
  );

  const updated = await InspectionRequest.findOne({ requestNumber });
  logger.info({ event: 'assignment_failed', requestNumber }, 'Assignment failed — no expert assigned');
  return updated;
}

export async function handleRefundConfirmation(requestNumber, refundData) {
  const request = await InspectionRequest.findOneAndUpdate(
    { requestNumber },
    {
      $set: {
        'payment.status': 'REFUNDED',
        'refund.razorpayRefundId': refundData.razorpayRefundId,
        'refund.amount': refundData.amount,
        'refund.cancellationFee': refundData.cancellationFee ?? 0,
        'refund.cancellationFeePercent': refundData.cancellationFeePercent ?? 0,
        'refund.isLateCancellation': refundData.isLateCancellation ?? false,
        'refund.processedAt': refundData.processedAt || new Date(),
      },
      $push: {
        statusHistory: {
          from: undefined,
          to: 'REFUNDED',
          changedAt: new Date(),
          changedBy: 'ADMIN',
          note: `Refund of ₹${refundData.amount} processed${refundData.cancellationFee ? ` (₹${refundData.cancellationFee} fee deducted)` : ''}`,
        },
      },
    },
    { new: false }
  );

  if (!request) {
    throw new AppError('Inspection request not found', 404);
  }

  // Fix statusHistory.from
  await InspectionRequest.updateOne(
    { requestNumber, 'statusHistory.from': null },
    { $set: { 'statusHistory.$.from': request.status } }
  );

  const updated = await InspectionRequest.findOne({ requestNumber });
  logger.info({ event: 'refund_confirmed', requestNumber, amount: refundData.amount }, 'Refund confirmed');
  return updated;
}
