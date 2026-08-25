import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRoles, requireAdminOrTeacher } from '../middleware/role.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { requireActiveSubscription, requireFeature } from '../middleware/subscription.middleware.js';
import { uploadWrittenAnswer, uploadCsv } from '../middleware/upload.middleware.js';
import {
  getExams,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
  publishExam,
  closeExam,
  addExamQuestion,
  updateExamQuestion,
  deleteExamQuestion,
  getStudentExams,
  getStudentExamInstructions,
  startOrResumeStudentExam,
  saveStudentAnswer,
  submitStudentExam,
  getStudentExamResult,
  getExamAttempts,
  getExamAnalytics,
  getParentChildExamResults,
  getParentChildExams,
  submitWrittenExamAnswer,
  getStudentWrittenSubmission,
  deleteStudentWrittenSubmission,
  finalizeStudentWrittenSubmission,
  getExamSubmissions,
  getProtectedAnswerPdf,
  markWrittenExamSubmission,
  bulkSaveWrittenExamMarks,
  exportMarksCsvTemplate,
  previewImportMarksCsv,
  confirmImportMarksCsvController,
  publishExamResult,
  unpublishExamResult,
  publishAllExamResults,
  downloadOfficialResultPdf,
  getStudentUnifiedResults,
  getStudentResultPdf,
} from '../controllers/exam.controller.js';

const router = express.Router();

// Apply authentication, tenant resolution, subscription validation, and ONLINE_EXAMS feature enforcement across all exam endpoints
router.use(authenticate);
router.use(tenantMiddleware);
router.use(requireActiveSubscription);
router.use(requireFeature('ONLINE_EXAMS'));

// -------------------------------------------------------------
// Student Online Exam & Results Routes
// -------------------------------------------------------------
router.get('/student/list', requireRoles('STUDENT'), getStudentExams);
router.get('/student/:id/instructions', requireRoles('STUDENT'), getStudentExamInstructions);
router.post('/student/:id/start', requireRoles('STUDENT'), startOrResumeStudentExam);
router.put('/student/:id/answers/:questionId', requireRoles('STUDENT'), saveStudentAnswer);
router.post('/student/:id/submit', requireRoles('STUDENT'), submitStudentExam);
router.get('/student/:id/result', requireRoles('STUDENT'), getStudentExamResult);

// Step 3 Written Live Exam Submission Routes
router.get('/student/:id/written-submission', requireRoles('STUDENT'), getStudentWrittenSubmission);
router.post('/student/:id/upload-answer', requireRoles('STUDENT'), uploadWrittenAnswer.fields([{ name: 'file', maxCount: 1 }, { name: 'images', maxCount: 30 }]), submitWrittenExamAnswer);
router.delete('/student/:id/written-submission', requireRoles('STUDENT'), deleteStudentWrittenSubmission);
router.post('/student/:id/written-submission/finalize', requireRoles('STUDENT'), finalizeStudentWrittenSubmission);

router.get('/student/results/all', requireRoles('STUDENT'), getStudentUnifiedResults);
router.get('/student/results/:resultId/pdf', requireRoles('STUDENT'), getStudentResultPdf);

// -------------------------------------------------------------
// Parent Portal Exam Results & Online Examinations
// -------------------------------------------------------------
router.get('/parent/child-results', requireRoles('PARENT'), getParentChildExamResults);
router.get('/parent/child-exams', requireRoles('PARENT'), getParentChildExams);
router.get('/parent/child-exams/:studentId', requireRoles('PARENT'), getParentChildExams);

// -------------------------------------------------------------
// Admin & Teacher Exam Management Routes
// -------------------------------------------------------------
router.get('/', requireAdminOrTeacher, getExams);
router.post('/', requireAdminOrTeacher, createExam);
router.get('/:id', requireAdminOrTeacher, getExamById);
router.put('/:id', requireAdminOrTeacher, updateExam);
router.delete('/:id', requireAdminOrTeacher, deleteExam);

// Publish & Close
router.patch('/:id/publish', requireAdminOrTeacher, publishExam);
router.patch('/:id/close', requireAdminOrTeacher, closeExam);

// Question Builder
router.post('/:id/questions', requireAdminOrTeacher, addExamQuestion);
router.put('/:id/questions/:questionId', requireAdminOrTeacher, updateExamQuestion);
router.delete('/:id/questions/:questionId', requireAdminOrTeacher, deleteExamQuestion);

// Monitoring & Analytics
router.get('/:id/attempts', requireAdminOrTeacher, getExamAttempts);
router.get('/:id/analytics', requireAdminOrTeacher, getExamAnalytics);

// -------------------------------------------------------------
// Step 7C: Written Exam Marking & Results Routes
// -------------------------------------------------------------
router.get('/:id/submissions', requireAdminOrTeacher, getExamSubmissions);
router.get('/:id/submissions/:studentId/answer-pdf', getProtectedAnswerPdf); // Supports Admin, Teacher, and submitting Student
router.put('/:id/submissions/:studentId/mark', requireAdminOrTeacher, markWrittenExamSubmission);
router.post('/:id/submissions/bulk', requireAdminOrTeacher, bulkSaveWrittenExamMarks);
router.post('/:id/bulk-marks', requireAdminOrTeacher, bulkSaveWrittenExamMarks);
router.get('/:id/submissions/export-csv', requireAdminOrTeacher, exportMarksCsvTemplate);
router.post('/:id/submissions/preview-csv', requireAdminOrTeacher, uploadCsv.single('file'), previewImportMarksCsv);
router.post('/:id/submissions/confirm-csv', requireAdminOrTeacher, confirmImportMarksCsvController);

// Publish / Unpublish individual & bulk
router.patch('/:id/results/:studentId/publish', requireAdminOrTeacher, publishExamResult);
router.patch('/:id/results/:studentId/unpublish', requireAdminOrTeacher, unpublishExamResult);
router.patch('/:id/results/publish-all', requireAdminOrTeacher, publishAllExamResults);
router.patch('/:id/publish-all', requireAdminOrTeacher, publishAllExamResults);

// Official Result PDF
router.get('/:id/results/:studentId/pdf', downloadOfficialResultPdf);

export default router;
