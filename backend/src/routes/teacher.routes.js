import { Router } from 'express';
import { getTeachers, createTeacher } from '../controllers/teacher.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { requireInstituteAdmin } from '../middleware/role.middleware.js';
import { requireFeature, checkLimit } from '../middleware/subscription.middleware.js';

const router = Router();

router.use(authenticate, tenantMiddleware, requireFeature('TEACHER_MANAGEMENT'));

router.get('/', getTeachers);
router.post('/', requireInstituteAdmin, checkLimit('teachers'), createTeacher);

export default router;
