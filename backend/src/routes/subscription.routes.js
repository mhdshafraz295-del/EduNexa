import express from 'express';
import * as subController from '../controllers/subscription.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireInstituteAdmin, requireAnyUser } from '../middleware/role.middleware.js';
import { uploadReceipt } from '../middleware/upload.middleware.js';

const router = express.Router();

// Require authenticated session
router.use(authenticate);

// Entitlement & Real-time Usage (available for any authenticated institute user)
router.get('/entitlement', requireAnyUser, subController.getEntitlement);
router.get('/usage', requireAnyUser, subController.getUsage);

// Institute Admin Subscription Management
router.get('/current', requireInstituteAdmin, subController.getCurrentSubscription);
router.get('/history', requireInstituteAdmin, subController.getSubscriptionHistory);
router.post('/select-plan', requireInstituteAdmin, subController.selectPlan);
router.post('/payment', requireInstituteAdmin, uploadReceipt.single('receipt'), subController.submitPayment);

// Secure Receipt Stream (accessible by Super Admin or matching institute users)
router.get('/payments/:id/receipt', requireAnyUser, subController.getReceiptFile);

export default router;
