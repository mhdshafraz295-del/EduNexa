import express from 'express';
import { authenticate, authorizeRole } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import * as controller from '../controllers/referral.controller.js';

const router = express.Router();

// 1. Super Admin Campaign Management & Analytics
router.get(
  '/admin/analytics',
  authenticate,
  authorizeRole('SUPER_ADMIN'),
  controller.getSuperAdminReferralAnalytics
);

router.get(
  '/admin/campaigns',
  authenticate,
  authorizeRole('SUPER_ADMIN'),
  controller.listSuperAdminCampaigns
);

router.post(
  '/admin/campaigns',
  authenticate,
  authorizeRole('SUPER_ADMIN'),
  controller.createCampaign
);

router.get(
  '/admin/campaigns/:id',
  authenticate,
  authorizeRole('SUPER_ADMIN'),
  controller.getSuperAdminCampaignDetail
);

router.put(
  '/admin/campaigns/:id',
  authenticate,
  authorizeRole('SUPER_ADMIN'),
  controller.updateCampaign
);

router.patch(
  '/admin/campaigns/:id/status',
  authenticate,
  authorizeRole('SUPER_ADMIN'),
  controller.setCampaignStatus
);

router.patch(
  '/admin/rewards/:id/approve',
  authenticate,
  authorizeRole('SUPER_ADMIN'),
  controller.approveReward
);

router.patch(
  '/admin/rewards/:id/reject',
  authenticate,
  authorizeRole('SUPER_ADMIN'),
  controller.rejectReward
);

// 2. Institute Admin Referral Dashboard
router.get(
  '/dashboard',
  authenticate,
  tenantMiddleware,
  controller.getInstituteReferralDashboard
);

export default router;
