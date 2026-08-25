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
  resetAdminCmsDraft,
} from '../controllers/platformCms.controller.js';

const router = express.Router();

// =========================================================================
// 1. PUBLIC / ROLE READ ROUTE (Live Published Content Only)
// =========================================================================
router.get('/public', getPublishedCms);

// =========================================================================
// 2. SUPER ADMIN PROTECTED CMS ROUTES
// =========================================================================
router.get('/admin', authenticate, requireRoles('SUPER_ADMIN'), getAdminCmsDraft);
router.put('/admin/draft', authenticate, requireRoles('SUPER_ADMIN'), saveAdminCmsDraft);
router.post('/admin/publish', authenticate, requireRoles('SUPER_ADMIN'), publishAdminCms);
router.post('/admin/reset-draft', authenticate, requireRoles('SUPER_ADMIN'), resetAdminCmsDraft);

// Upload Draft Image (Validated & Saved to Protected Draft Storage)
router.post(
  '/admin/upload-image',
  authenticate,
  requireRoles('SUPER_ADMIN'),
  uploadPlatformCmsDraftImage.single('image'),
  uploadDraftImage
);

// Protected Draft Image Asset Streaming for Super Admin Preview
router.get(
  '/admin/draft-asset/:filename',
  authenticate,
  requireRoles('SUPER_ADMIN'),
  getDraftAsset
);

export default router;
