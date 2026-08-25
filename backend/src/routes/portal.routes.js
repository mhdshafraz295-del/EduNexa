import { Router } from 'express';
import {
  getInstituteDashboard,
  getInstituteAdminAnalytics,
  getTeacherPortalDashboard,
  getTeacherAnalytics,
  getStudentPortalDashboard,
  getStudentAnalytics,
  getParentPortalDashboard,
  getParentAnalytics,
  getInstituteSettings,
  updateInstituteSettings,
  uploadInstituteBrandingAsset,
  removeInstituteBrandingAsset,
  getProtectedBrandingAsset,
} from '../controllers/portal.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { requireInstituteAdmin } from '../middleware/role.middleware.js';
import { requireActiveSubscription } from '../middleware/subscription.middleware.js';
import { uploadBrandingAsset } from '../middleware/upload.middleware.js';

const router = Router();

router.use(authenticate, tenantMiddleware, requireActiveSubscription);

// Dashboard routes for each role
router.get('/dashboard', getInstituteDashboard);
router.get('/dashboard/analytics', getInstituteAdminAnalytics);
router.get('/admin/analytics', getInstituteAdminAnalytics);
router.get('/analytics', getInstituteAdminAnalytics);

router.get('/teacher/dashboard', getTeacherPortalDashboard);
router.get('/teacher/analytics', getTeacherAnalytics);

router.get('/student/dashboard', getStudentPortalDashboard);
router.get('/student/analytics', getStudentAnalytics);

router.get('/parent/dashboard', getParentPortalDashboard);
router.get('/parent/analytics', getParentAnalytics);

// Settings & Branding
router.get('/settings', getInstituteSettings);
router.put('/settings', requireInstituteAdmin, updateInstituteSettings);
router.post('/settings/upload', requireInstituteAdmin, uploadBrandingAsset.single('file'), uploadInstituteBrandingAsset);
router.delete('/settings/branding-asset/:type', requireInstituteAdmin, removeInstituteBrandingAsset);
router.get('/branding-assets/:type', getProtectedBrandingAsset);

export default router;
