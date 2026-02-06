import express from 'express';
import { createInspectionRequest, listInspectionRequests } from '../controllers/customer.controller.js';
import { validateInspectionRequest } from '../middlewares/validateRequest.js';

const router = express.Router();

router.post('/inspection-request', validateInspectionRequest, createInspectionRequest);
router.get('/inspection-requests', listInspectionRequests);

export default router;
