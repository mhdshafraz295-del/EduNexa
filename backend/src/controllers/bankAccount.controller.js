import { z } from 'zod';
import prisma from '../config/prisma.js';

const bankAccountSchema = z.object({
  bankName: z.string().min(2, 'Bank name must be at least 2 characters'),
  branchName: z.string().optional().nullable(),
  accountHolderName: z.string().min(2, 'Account holder name is required'),
  accountNumber: z.string().min(4, 'Account number is required'),
  instructions: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  displayOrder: z.preprocess((val) => (val !== undefined && val !== null ? parseInt(val, 10) : 0), z.number().int()).default(0),
});

// GET /api/super-admin/bank-accounts - All bank accounts
export const getBankAccounts = async (req, res, next) => {
  try {
    const accounts = await prisma.platformBankAccount.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        _count: {
          select: { payments: true },
        },
      },
    });

    res.json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/super-admin/bank-accounts/:id
export const getBankAccountById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const account = await prisma.platformBankAccount.findUnique({
      where: { id },
    });

    if (!account) {
      return res.status(404).json({ success: false, message: 'Bank account not found.' });
    }

    res.json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/super-admin/bank-accounts
export const createBankAccount = async (req, res, next) => {
  try {
    const parsed = bankAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Validation failed.',
        errors: parsed.error.errors,
      });
    }

    const account = await prisma.platformBankAccount.create({
      data: parsed.data,
    });

    res.status(201).json({
      success: true,
      message: 'Platform bank account created successfully.',
      data: account,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/super-admin/bank-accounts/:id
export const updateBankAccount = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.platformBankAccount.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Bank account not found.' });
    }

    const parsed = bankAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Validation failed.',
        errors: parsed.error.errors,
      });
    }

    const updated = await prisma.platformBankAccount.update({
      where: { id },
      data: parsed.data,
    });

    res.json({
      success: true,
      message: 'Platform bank account updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/super-admin/bank-accounts/:id/status
export const toggleBankAccountStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.platformBankAccount.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Bank account not found.' });
    }

    const isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !existing.isActive;

    const updated = await prisma.platformBankAccount.update({
      where: { id },
      data: { isActive },
    });

    res.json({
      success: true,
      message: `Bank account status updated to ${isActive ? 'Active' : 'Inactive'}.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/bank-accounts/active - Public / Tenant Read Endpoint
export const getActiveBankAccounts = async (req, res, next) => {
  try {
    const accounts = await prisma.platformBankAccount.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { bankName: 'asc' }],
    });

    res.json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    next(error);
  }
};
