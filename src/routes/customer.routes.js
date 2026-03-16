import express from 'express';
import { createInspectionRequest, listInspectionRequests, getInspectionRequestDetail, cancelInspectionRequest, rescheduleInspectionRequest } from '../controllers/customer.controller.js';
import { validateInspectionRequest } from '../middlewares/validateRequest.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// All customer routes require authentication
router.use(authenticate);

router.post('/inspection-request', validateInspectionRequest, createInspectionRequest);
router.get('/inspection-requests', listInspectionRequests);
router.get('/inspection-requests/:requestId', getInspectionRequestDetail);
router.post('/inspection-requests/:requestId/cancel', cancelInspectionRequest);
router.post('/inspection-requests/:requestId/reschedule', rescheduleInspectionRequest);

export default router;
