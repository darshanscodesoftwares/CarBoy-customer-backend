import { errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

function isValidDateInput(dateInput) {
  const parsedDate = new Date(dateInput);
  return !Number.isNaN(parsedDate.getTime());
}

export function validateInspectionRequest(req, res, next) {
  const { serviceType, customerSnapshot, vehicleSnapshot, schedule, location } = req.body;

  if (!['PDI', 'UCI'].includes(serviceType)) {
    logger.warn({ event: 'validation_failed', reason: 'invalid_service_type' }, 'Validation failed');
    return errorResponse(res, 'serviceType must be either PDI or UCI', 400);
  }

  if (!customerSnapshot?.name || !customerSnapshot?.phone || !customerSnapshot?.email) {
    logger.warn({ event: 'validation_failed', reason: 'invalid_customer_snapshot' }, 'Validation failed');
    return errorResponse(res, 'customerSnapshot.name, phone, and email are required', 400);
  }

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
