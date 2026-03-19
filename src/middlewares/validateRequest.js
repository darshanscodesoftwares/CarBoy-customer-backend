import { errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

function isValidDateInput(dateInput) {
  const parsedDate = new Date(dateInput);
  return !Number.isNaN(parsedDate.getTime());
}

export function validateInspectionRequest(req, res, next) {
  const { serviceType, customerSnapshot, vehicleSnapshot, schedule, location, addOnVSH } = req.body;

  if (addOnVSH && serviceType !== 'UCI') {
    return errorResponse(res, 'VSH add-on is only available for UCI bookings', 400);
  }

  if (!['PDI', 'UCI', 'VSH'].includes(serviceType)) {
    logger.warn({ event: 'validation_failed', reason: 'invalid_service_type', receivedValue: serviceType }, 'Validation failed');
    return errorResponse(res, `serviceType must be PDI, UCI, or VSH (received: "${serviceType}")`, 400);
  }

  if (!customerSnapshot?.name || !customerSnapshot?.phone || !customerSnapshot?.email) {
    logger.warn({ event: 'validation_failed', reason: 'invalid_customer_snapshot' }, 'Validation failed');
    return errorResponse(res, 'customerSnapshot.name, phone, and email are required', 400);
  }

  if (serviceType === 'VSH') {
    // VSH only needs model and registrationNumber
    if (!vehicleSnapshot?.model || !vehicleSnapshot?.registrationNumber) {
      logger.warn({ event: 'validation_failed', reason: 'invalid_vehicle_snapshot_vsh' }, 'Validation failed');
      return errorResponse(res, 'vehicleSnapshot.model and registrationNumber are required for VSH', 400);
    }
    return next();
  }

  // PDI / UCI validations
  if (!vehicleSnapshot?.brand || !vehicleSnapshot?.model || !vehicleSnapshot?.year) {
    logger.warn({ event: 'validation_failed', reason: 'invalid_vehicle_snapshot' }, 'Validation failed');
    return errorResponse(res, 'vehicleSnapshot.brand, model, and year are required', 400);
  }

  if (!schedule?.date || !schedule?.slot || !isValidDateInput(schedule.date)) {
    logger.warn({ event: 'validation_failed', reason: 'invalid_schedule' }, 'Validation failed');
    return errorResponse(res, 'schedule.date and schedule.slot are required and date must be valid', 400);
  }

  const requestDate = new Date(schedule.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (requestDate < today) {
    logger.warn({ event: 'validation_failed', reason: 'past_schedule_date' }, 'Validation failed');
    return errorResponse(res, 'schedule.date must be today or a future date', 400);
  }

  const lat = location?.coordinates?.lat;
  const lng = location?.coordinates?.lng;

  if (!location?.address || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    logger.warn({ event: 'validation_failed', reason: 'invalid_location' }, 'Validation failed');
    return errorResponse(
      res,
      'location.address, location.coordinates.lat, and location.coordinates.lng are required as valid numbers',
      400
    );
  }

  return next();
}
