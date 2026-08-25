import express from 'express';
import * as planController from '../controllers/plan.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireSuperAdmin } from '../middleware/role.middleware.js';

const router = express.Router();

// All endpoints in this router are restricted to SUPER_ADMIN
router.use(authenticate, requireSuperAdmin);

// Feature Catalog
router.get('/features', planController.getFeatures);

// Plans Management
router.get('/plans', planController.getPlans);
router.post('/plans', planController.createPlan);
router.get('/plans/:id', planController.getPlanById);
router.put('/plans/:id', planController.updatePlan);
router.patch('/plans/:id/status', planController.togglePlanStatus);
router.post('/plans/:id/duplicate', planController.duplicatePlan);

export default router;
