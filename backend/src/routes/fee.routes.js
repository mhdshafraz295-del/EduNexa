import { Router } from 'express';
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  getAnalytics,
  recordPayment,
  verifyTransaction,
  rejectTransaction,
  getPaymentMethods,
} from '../controllers/fee.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { requireInstituteAdmin } from '../middleware/role.middleware.js';
import { requireFeature } from '../middleware/subscription.middleware.js';

const router = Router();

// Base middleware for all invoice/fee routes: Auth + Tenant Isolation + Subscription Feature Guard
router.use(authenticate, tenantMiddleware, requireFeature('INVOICES'));

// Analytics Endpoint
router.get('/analytics', requireInstituteAdmin, getAnalytics);
router.get('/invoices/analytics', requireInstituteAdmin, getAnalytics);

// Invoices CRUD & Details
router.get('/invoices', getInvoices);
router.get('/invoices/:id', getInvoiceById);
router.post('/invoices', requireInstituteAdmin, createInvoice);

// Payment Recording against Invoices
router.post('/invoices/:id/payments', requireInstituteAdmin, recordPayment);

// Transaction Verification & Rejection
router.patch('/transactions/:transactionId/verify', requireInstituteAdmin, verifyTransaction);
router.patch('/transactions/:transactionId/reject', requireInstituteAdmin, rejectTransaction);

// Payment Methods
router.get('/payment-methods', getPaymentMethods);

export default router;
