import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRoles } from '../middleware/role.middleware.js';
import { uploadPlatformCmsDraftImage } from '../middleware/upload.middleware.js';
import {
  getPublishedCms,
  getAdminCmsDraft,
  saveAdminCmsDraft,
  publishAdminCms,
  uploadDraftImage,
  getDraftAsset,
  getPublishedAsset,
  resetAdminCmsDraft,
} from '../controllers/platformCms.controller.js';

const router = express.Router();

// =========================================================================
// 1. PUBLIC / ROLE READ ROUTE (Live Published Content Only)
// =========================================================================
router.get('/public', getPublishedCms);

// Public Proxy Endpoint for Published CMS Assets (with authoritative DB verification)
router.get('/assets/*', getPublishedAsset);
router.get('/assets/:filename', getPublishedAsset);

// =========================================================================
// 2. SUPER ADMIN PROTECTED CMS ROUTES
// =========================================================================
router.get('/admin', authenticate, requireRoles('SUPER_ADMIN'), getAdminCmsDraft);
router.put('/admin/draft', authenticate, requireRoles('SUPER_ADMIN'), saveAdminCmsDraft);
router.post('/admin/publish', authenticate, requireRoles('SUPER_ADMIN'), publishAdminCms);
router.post('/admin/reset-draft', authenticate, requireRoles('SUPER_ADMIN'), resetAdminCmsDraft);

// Upload Draft Image (Validated & Saved to R2 or Local Volume Disk)
router.post(
  '/admin/upload-image',
  authenticate,
  requireRoles('SUPER_ADMIN'),
  uploadPlatformCmsDraftImage.single('image'),
  uploadDraftImage
);

// Protected Draft Image Asset Streaming for Super Admin Preview
router.get(
  '/admin/draft-asset/*',
  authenticate,
  requireRoles('SUPER_ADMIN'),
  getDraftAsset
);
router.get(
  '/admin/draft-asset/:filename',
  authenticate,
  requireRoles('SUPER_ADMIN'),
  getDraftAsset
);

export default router;
