import express from 'express';
import * as subAdminController from '../controllers/subscriptionAdmin.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireSuperAdmin } from '../middleware/role.middleware.js';

const router = express.Router();

// All endpoints in this router are restricted to SUPER_ADMIN
router.use(authenticate, requireSuperAdmin);

// Cross-tenant subscriptions & payment reviews
router.get('/', subAdminController.getSubscriptions);
router.get('/pending', subAdminController.getPendingPayments);
router.get('/:id', subAdminController.getSubscriptionById);
router.post('/payments/:id/approve', subAdminController.approvePayment);
router.post('/payments/:id/reject', subAdminController.rejectPayment);

export default router;
