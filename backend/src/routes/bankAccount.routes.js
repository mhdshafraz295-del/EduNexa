import express from 'express';
import * as bankController from '../controllers/bankAccount.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireSuperAdmin } from '../middleware/role.middleware.js';

const router = express.Router();

// Public / Active bank accounts for institutes to make transfers
router.get('/active', bankController.getActiveBankAccounts);

// Super Admin bank account management
router.get('/', authenticate, requireSuperAdmin, bankController.getBankAccounts);
router.post('/', authenticate, requireSuperAdmin, bankController.createBankAccount);
router.get('/:id', authenticate, requireSuperAdmin, bankController.getBankAccountById);
router.put('/:id', authenticate, requireSuperAdmin, bankController.updateBankAccount);
router.patch('/:id/status', authenticate, requireSuperAdmin, bankController.toggleBankAccountStatus);

export default router;
