import { Router } from 'express';
import {
  getTimetable,
  createTimetableSession,
  updateTimetableSession,
  deleteTimetableSession,
  getTodaySessions,
  getUpcomingSessions,
} from '../controllers/timetable.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { requireAdminOrTeacher } from '../middleware/role.middleware.js';
import { requireActiveSubscription, requireFeature } from '../middleware/subscription.middleware.js';

const router = Router();

router.use(authenticate, tenantMiddleware, requireActiveSubscription);

router.get('/', requireFeature('TIMETABLE'), getTimetable);
router.post('/', requireAdminOrTeacher, requireFeature('TIMETABLE'), createTimetableSession);
router.put('/:id', requireAdminOrTeacher, requireFeature('TIMETABLE'), updateTimetableSession);
router.delete('/:id', requireAdminOrTeacher, requireFeature('TIMETABLE'), deleteTimetableSession);

router.get('/today', requireFeature('TIMETABLE'), getTodaySessions);
router.get('/upcoming', requireFeature('TIMETABLE'), getUpcomingSessions);

export default router;
