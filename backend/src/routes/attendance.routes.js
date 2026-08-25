import { Router } from 'express';
import {
  getAttendanceSessions,
  getAttendanceSessionById,
  getStudentsForMarking,
  saveAttendanceSession,
  updateAttendanceSession,
  deleteAttendanceSession,
  getAttendanceAnalytics,
  getStudentAttendanceHistory,
  getParentChildAttendance,
} from '../controllers/attendance.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { requireAdminOrTeacher } from '../middleware/role.middleware.js';
import { requireActiveSubscription, requireFeature } from '../middleware/subscription.middleware.js';

const router = Router();

// Apply auth, tenant resolution, and active subscription middleware to all attendance routes
router.use(authenticate, tenantMiddleware, requireActiveSubscription);

// 1. Sessions listing, marking, and management (guarded by ATTENDANCE feature)
router.get('/sessions', requireFeature('ATTENDANCE'), getAttendanceSessions);
router.get('/sessions/:id', requireFeature('ATTENDANCE'), getAttendanceSessionById);
router.get('/students-for-marking', requireAdminOrTeacher, requireFeature('ATTENDANCE'), getStudentsForMarking);
router.post('/sessions', requireAdminOrTeacher, requireFeature('ATTENDANCE'), saveAttendanceSession);
router.put('/sessions/:id', requireAdminOrTeacher, requireFeature('ATTENDANCE'), updateAttendanceSession);
router.delete('/sessions/:id', requireAdminOrTeacher, requireFeature('ATTENDANCE'), deleteAttendanceSession);

// 2. Real Analytics
router.get('/analytics', requireFeature('ATTENDANCE'), getAttendanceAnalytics);

// 3. Role Portals
router.get('/student', requireFeature('ATTENDANCE'), getStudentAttendanceHistory);
router.get('/parent', requireFeature('ATTENDANCE'), getParentChildAttendance);

export default router;
