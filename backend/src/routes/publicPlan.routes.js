import express from 'express';
import * as planController from '../controllers/plan.controller.js';

const router = express.Router();

// Read-only endpoint for active subscription plans
router.get('/', planController.getPublicPlans);

export default router;
