import { Router } from 'express';
import {
  getDashboardStats,
  getSuperAdminAnalytics,
  listInstitutes,
  createInstitute,
  getInstituteById,
  updateInstitute,
  updateInstituteStatus,
  listPlatformUsers,
  uploadSuperAdminBrandingAsset,
  removeSuperAdminBrandingAsset,
  getSuperAdminProtectedBrandingAsset,
} from '../controllers/superAdmin.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireSuperAdmin } from '../middleware/role.middleware.js';
import { uploadBrandingAsset } from '../middleware/upload.middleware.js';

const router = Router();

// Protect all Super Admin routes with JWT and SUPER_ADMIN role guard
router.use(authenticate, requireSuperAdmin);

router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard/analytics', getSuperAdminAnalytics);
router.get('/institutes', listInstitutes);
router.post('/institutes', createInstitute);
router.get('/institutes/:id', getInstituteById);
router.put('/institutes/:id', updateInstitute);
router.post('/institutes/:id/upload', uploadBrandingAsset.single('file'), uploadSuperAdminBrandingAsset);
router.delete('/institutes/:id/branding-asset/:type', removeSuperAdminBrandingAsset);
router.get('/institutes/:id/branding-assets/:type', getSuperAdminProtectedBrandingAsset);
router.patch('/institutes/:id/status', updateInstituteStatus);
router.get('/users', listPlatformUsers);

export default router;
