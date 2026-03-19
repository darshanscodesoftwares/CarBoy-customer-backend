import express from 'express';
import { adminCancelConfirmed, adminRescheduleConfirmed, adminAssignmentFailed, adminRefundConfirmed, adminPaymentLinkCreated, adminVshFileUploaded } from '../controllers/admin.controller.js';

const router = express.Router();

// These are internal service-to-service callbacks from admin backend — no JWT auth
router.post('/:requestNumber/confirm-cancellation', adminCancelConfirmed);
router.post('/:requestNumber/confirm-reschedule', adminRescheduleConfirmed);
router.post('/:requestNumber/assignment-failed', adminAssignmentFailed);
router.post('/:requestNumber/confirm-refund', adminRefundConfirmed);
router.post('/:requestNumber/payment-link', adminPaymentLinkCreated);
router.post('/:requestNumber/vsh-file-uploaded', adminVshFileUploaded);

export default router;
