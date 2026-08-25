import express from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { requireActiveSubscription, requireFeature } from '../middleware/subscription.middleware.js';
import {
  createAdminPoll,
  getAdminPolls,
  getAdminPollById,
  updateAdminPoll,
  updateAdminPollStatus,
  deleteAdminPoll,
  getAdminAnalytics,
  getRecipientPolls,
  getRecipientPollDetails,
  submitRecipientVote,
} from '../controllers/poll.controller.js';

const router = express.Router();

// Apply authentication, tenant middleware, subscription check, and POLLS feature guard to all routes
router.use(authenticate);
router.use(tenantMiddleware);
router.use(requireActiveSubscription);
router.use(requireFeature('POLLS'));

// ==========================================
// ADMIN POLL MANAGEMENT ROUTES
// ==========================================
router.get('/admin/analytics/overview', authorizeRoles('ADMIN', 'SUPER_ADMIN'), getAdminAnalytics);
router.get('/admin', authorizeRoles('ADMIN', 'SUPER_ADMIN'), getAdminPolls);
router.post('/admin', authorizeRoles('ADMIN', 'SUPER_ADMIN'), createAdminPoll);
router.get('/admin/:id', authorizeRoles('ADMIN', 'SUPER_ADMIN'), getAdminPollById);
router.put('/admin/:id', authorizeRoles('ADMIN', 'SUPER_ADMIN'), updateAdminPoll);
router.patch('/admin/:id/status', authorizeRoles('ADMIN', 'SUPER_ADMIN'), updateAdminPollStatus);
router.delete('/admin/:id', authorizeRoles('ADMIN', 'SUPER_ADMIN'), deleteAdminPoll);

// ==========================================
// RECIPIENT POLL FEED & VOTING ROUTES
// ==========================================
router.get('/my', getRecipientPolls);
router.get('/:id', getRecipientPollDetails);
router.post('/:id/vote', submitRecipientVote);

export default router;
