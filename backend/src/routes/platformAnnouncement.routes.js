import express from 'express';
import { authenticate, authorizeRole } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import * as controller from '../controllers/platformAnnouncement.controller.js';

const router = express.Router();

// 1. Super Admin Platform Announcement Management
router.get(
  '/admin/analytics',
  authenticate,
  authorizeRole('SUPER_ADMIN'),
  controller.getSuperAdminAnnouncementAnalytics
);

router.get(
  '/admin',
  authenticate,
  authorizeRole('SUPER_ADMIN'),
  controller.listSuperAdminAnnouncements
);

router.post(
  '/admin',
  authenticate,
  authorizeRole('SUPER_ADMIN'),
  controller.createAnnouncement
);

router.get(
  '/admin/:id',
  authenticate,
  authorizeRole('SUPER_ADMIN'),
  controller.getSuperAdminAnnouncementDetail
);

router.put(
  '/admin/:id',
  authenticate,
  authorizeRole('SUPER_ADMIN'),
  controller.updateAnnouncement
);

router.patch(
  '/admin/:id/status',
  authenticate,
  authorizeRole('SUPER_ADMIN'),
  controller.setAnnouncementStatus
);

router.delete(
  '/admin/:id',
  authenticate,
  authorizeRole('SUPER_ADMIN'),
  controller.deleteAnnouncement
);

// 2. Institute Admin Platform Announcement Feed
router.get(
  '/feed',
  authenticate,
  tenantMiddleware,
  controller.listInstituteAnnouncements
);

router.patch(
  '/feed/:id/read',
  authenticate,
  tenantMiddleware,
  controller.markAnnouncementRead
);

router.patch(
  '/feed/:id/dismiss',
  authenticate,
  tenantMiddleware,
  controller.dismissAnnouncement
);

export default router;
