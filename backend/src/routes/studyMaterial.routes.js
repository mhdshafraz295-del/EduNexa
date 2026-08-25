import express from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { requireActiveSubscription, requireFeature } from '../middleware/subscription.middleware.js';
import {
  uploadStudyMaterialPdf,
  uploadNotePurchaseReceipt,
} from '../middleware/upload.middleware.js';
import {
  getAdminMaterials,
  getAdminMaterialById,
  createAdminMaterial,
  updateAdminMaterial,
  updateAdminMaterialStatus,
  deleteAdminMaterial,
  getAdminPayments,
  getAdminPaymentById,
  approvePayment,
  rejectPayment,
  getPaymentSettings,
  updatePaymentSettings,
  getAdminAnalytics,
  getMyMaterials,
  getMaterialDetails,
  submitPurchase,
  getMyPurchases,
  streamMaterialPdf,
  streamProtectedReceipt,
} from '../controllers/studyMaterial.controller.js';

const router = express.Router();

// Apply authentication, tenant middleware, subscription check, and feature guard to all routes
router.use(authenticate);
router.use(tenantMiddleware);
router.use(requireActiveSubscription);
router.use(requireFeature('STUDY_MATERIALS'));

// ==========================================
// ADMIN STUDY NOTES ROUTES
// ==========================================
router.get('/admin/payments', authorizeRoles('ADMIN', 'SUPER_ADMIN'), getAdminPayments);
router.get('/admin/payments/:id', authorizeRoles('ADMIN', 'SUPER_ADMIN'), getAdminPaymentById);
router.post('/admin/payments/:id/approve', authorizeRoles('ADMIN', 'SUPER_ADMIN'), approvePayment);
router.post('/admin/payments/:id/reject', authorizeRoles('ADMIN', 'SUPER_ADMIN'), rejectPayment);

router.get('/admin/payment-settings', authorizeRoles('ADMIN', 'SUPER_ADMIN'), getPaymentSettings);
router.put('/admin/payment-settings', authorizeRoles('ADMIN', 'SUPER_ADMIN'), updatePaymentSettings);

router.get('/admin/analytics', authorizeRoles('ADMIN', 'SUPER_ADMIN'), getAdminAnalytics);

router.get('/admin', authorizeRoles('ADMIN', 'SUPER_ADMIN'), getAdminMaterials);
router.post('/admin', authorizeRoles('ADMIN', 'SUPER_ADMIN'), uploadStudyMaterialPdf.single('pdfFile'), createAdminMaterial);
router.get('/admin/:id', authorizeRoles('ADMIN', 'SUPER_ADMIN'), getAdminMaterialById);
router.put('/admin/:id', authorizeRoles('ADMIN', 'SUPER_ADMIN'), uploadStudyMaterialPdf.single('pdfFile'), updateAdminMaterial);
router.patch('/admin/:id/status', authorizeRoles('ADMIN', 'SUPER_ADMIN'), updateAdminMaterialStatus);
router.delete('/admin/:id', authorizeRoles('ADMIN', 'SUPER_ADMIN'), deleteAdminMaterial);
router.get('/admin/:id/content', authorizeRoles('ADMIN', 'SUPER_ADMIN'), streamMaterialPdf);

// ==========================================
// STUDENT STUDY NOTES ROUTES
// ==========================================
router.get('/my/purchases', authorizeRoles('STUDENT'), getMyPurchases);
router.get('/my', authorizeRoles('STUDENT'), getMyMaterials);
router.get('/:id', authorizeRoles('STUDENT'), getMaterialDetails);
router.post('/:id/purchase', authorizeRoles('STUDENT'), uploadNotePurchaseReceipt.single('receiptFile'), submitPurchase);
router.post('/:id/receipt', authorizeRoles('STUDENT'), uploadNotePurchaseReceipt.single('receiptFile'), submitPurchase);

// ==========================================
// PROTECTED STREAMING ENDPOINTS
// ==========================================
router.get('/:id/content', streamMaterialPdf);
router.get('/payments/:id/receipt', streamProtectedReceipt);

export default router;
