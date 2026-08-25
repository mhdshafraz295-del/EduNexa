import express from 'express';
import {
  createExamGroup,
  getExamGroups,
  getExamGroupDetails,
  updateExamGroup,
  attachExamsToGroup,
  getExamGroupClassSheet,
  getStudentReportCard,
  saveStudentRemarks,
  releaseExamGroup,
  unreleaseExamGroup,
  getExamGroupAnalytics,
  exportClassSheetCsv,
  downloadStudentReportPdf,
  downloadClassResultPdf,
  downloadBulkReportCardsPdf,
  getStudentTermReports,
  getParentChildTermReports,
} from '../controllers/examGroup.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRoles } from '../middleware/role.middleware.js';
import { requireFeature } from '../middleware/subscription.middleware.js';

const router = express.Router();

// Apply Auth to all routes
router.use(authenticate);

// Feature Guard: Online Exams / Exam Management
const examFeatureGuard = requireFeature('ONLINE_EXAMS');

// ==========================================
// STUDENT & PARENT PORTAL ENDPOINTS
// ==========================================
router.get(
  '/student/my-reports',
  requireRoles('STUDENT'),
  examFeatureGuard,
  getStudentTermReports
);

router.get(
  '/parent/child-reports/:studentId',
  requireRoles('PARENT'),
  examFeatureGuard,
  getParentChildTermReports
);

// ==========================================
// ADMIN & TEACHER MANAGEMENT ENDPOINTS
// ==========================================
router.post(
  '/',
  requireRoles('ADMIN', 'SUPER_ADMIN'),
  examFeatureGuard,
  createExamGroup
);

router.get(
  '/',
  requireRoles('ADMIN', 'SUPER_ADMIN', 'TEACHER'),
  examFeatureGuard,
  getExamGroups
);

router.get(
  '/:id',
  requireRoles('ADMIN', 'SUPER_ADMIN', 'TEACHER'),
  examFeatureGuard,
  getExamGroupDetails
);

router.put(
  '/:id',
  requireRoles('ADMIN', 'SUPER_ADMIN'),
  examFeatureGuard,
  updateExamGroup
);

router.post(
  '/:id/exams',
  requireRoles('ADMIN', 'SUPER_ADMIN'),
  examFeatureGuard,
  attachExamsToGroup
);

router.get(
  '/:id/class-sheet',
  requireRoles('ADMIN', 'SUPER_ADMIN', 'TEACHER'),
  examFeatureGuard,
  getExamGroupClassSheet
);

router.get(
  '/:id/student-report/:studentId',
  requireRoles('ADMIN', 'SUPER_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'),
  examFeatureGuard,
  getStudentReportCard
);

router.patch(
  '/:id/remarks/:studentId',
  requireRoles('ADMIN', 'SUPER_ADMIN', 'TEACHER'),
  examFeatureGuard,
  saveStudentRemarks
);

router.patch(
  '/:id/release',
  requireRoles('ADMIN', 'SUPER_ADMIN'),
  examFeatureGuard,
  releaseExamGroup
);

router.patch(
  '/:id/unrelease',
  requireRoles('ADMIN', 'SUPER_ADMIN'),
  examFeatureGuard,
  unreleaseExamGroup
);

router.get(
  '/:id/analytics',
  requireRoles('ADMIN', 'SUPER_ADMIN', 'TEACHER'),
  examFeatureGuard,
  getExamGroupAnalytics
);

router.get(
  '/:id/export-csv',
  requireRoles('ADMIN', 'SUPER_ADMIN', 'TEACHER'),
  examFeatureGuard,
  exportClassSheetCsv
);

// ==========================================
// PDF DOWNLOAD ENDPOINTS
// ==========================================
router.get(
  '/:id/pdf/:studentId',
  requireRoles('ADMIN', 'SUPER_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'),
  examFeatureGuard,
  downloadStudentReportPdf
);

router.get(
  '/:id/class-pdf',
  requireRoles('ADMIN', 'SUPER_ADMIN', 'TEACHER'),
  examFeatureGuard,
  downloadClassResultPdf
);

router.get(
  '/:id/bulk-pdf',
  requireRoles('ADMIN', 'SUPER_ADMIN', 'TEACHER'),
  examFeatureGuard,
  downloadBulkReportCardsPdf
);

export default router;
