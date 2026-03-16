import express from 'express';
import { adminCancelConfirmed, adminRescheduleConfirmed } from '../controllers/admin.controller.js';
import { authenticateAdmin } from '../middlewares/adminAuth.js';

const router = express.Router();

router.use(authenticateAdmin);

router.post('/inspection-requests/:requestNumber/cancel-confirmed', adminCancelConfirmed);
router.post('/inspection-requests/:requestNumber/reschedule-confirmed', adminRescheduleConfirmed);

export default router;
