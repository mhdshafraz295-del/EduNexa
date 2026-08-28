import { Router } from 'express';
import { getStudents, getStudentById, createStudent, updateStudent } from '../controllers/student.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { requireRoles } from '../middleware/role.middleware.js';
import { requireFeature, checkLimit } from '../middleware/subscription.middleware.js';

const router = Router();

router.use(authenticate, tenantMiddleware, requireFeature('STUDENT_MANAGEMENT'));

router.get('/', getStudents);
router.get('/:id', getStudentById);
router.post('/', requireRoles('ADMIN', 'SUPER_ADMIN'), checkLimit('students'), createStudent);
router.put('/:id', requireRoles('ADMIN', 'SUPER_ADMIN'), updateStudent);

export default router;
