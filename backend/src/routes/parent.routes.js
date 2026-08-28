import { Router } from 'express';
import {
  getParents,
  getParentById,
  createParent,
  updateParent,
  linkStudent,
  unlinkStudent,
} from '../controllers/parent.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { requireInstituteAdmin } from '../middleware/role.middleware.js';
import { requireFeature } from '../middleware/subscription.middleware.js';

const router = Router();

router.use(authenticate, tenantMiddleware, requireInstituteAdmin, requireFeature('PARENT_PORTAL'));

router.get('/', getParents);
router.get('/:id', getParentById);
router.post('/', createParent);
router.put('/:id', updateParent);
router.post('/:id/link-student', linkStudent);
router.delete('/:id/unlink-student/:studentId', unlinkStudent);

export default router;
