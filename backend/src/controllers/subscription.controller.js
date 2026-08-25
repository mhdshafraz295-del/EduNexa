import path from 'path';
import fs from 'fs';
import prisma from '../config/prisma.js';
import { z } from 'zod';
import { getInstituteEntitlement, getInstituteUsageStats } from '../services/entitlement.service.js';

// GET /api/subscription/entitlement - Real-time feature permissions and status
export const getEntitlement = async (req, res, next) => {
  try {
    if (req.user.role === 'SUPER_ADMIN') {
      return res.json({
        success: true,
        data: {
          isValid: true,
          status: 'ACTIVE',
          isSuperAdmin: true,
          planName: 'Platform Super Admin',
          features: {},
          limits: {},
          remainingDays: 9999,
          isExpiringSoon: false,
        },
      });
    }

    const entitlement = await getInstituteEntitlement(req.user.instituteId);
    res.json({
      success: true,
      data: entitlement,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/subscription/usage - Real-time usage counts vs snapshot limits
export const getUsage = async (req, res, next) => {
  try {
    if (req.user.role === 'SUPER_ADMIN') {
      return res.json({
        success: true,
        data: { usage: {}, entitlement: { isValid: true, isSuperAdmin: true } },
      });
    }

    const stats = await getInstituteUsageStats(req.user.instituteId);
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// Helper to calculate remaining days
const getRemainingDays = (endDate) => {
  if (!endDate) return null;
  const now = new Date();
  const diffTime = new Date(endDate) - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

// GET /api/subscription/current - Current active or latest subscription for logged-in institute
export const getCurrentSubscription = async (req, res, next) => {
  try {
    const instituteId = req.user.instituteId;

    if (!instituteId) {
      return res.status(400).json({
        success: false,
        message: 'No institute association found for current user.',
      });
    }

    // Fetch active subscription first, otherwise fetch latest created
    let subscription = await prisma.instituteSubscription.findFirst({
      where: { instituteId, status: 'ACTIVE' },
      include: {
        plan: true,
        payments: {
          orderBy: { submittedAt: 'desc' },
          include: { bankAccount: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      subscription = await prisma.instituteSubscription.findFirst({
        where: { instituteId },
        include: {
          plan: true,
          payments: {
            orderBy: { submittedAt: 'desc' },
            include: { bankAccount: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!subscription) {
      return res.json({
        success: true,
        data: null,
        message: 'No subscription found for this institute.',
      });
    }

    const remainingDays = getRemainingDays(subscription.endDate);
    const isExpired = subscription.endDate && new Date(subscription.endDate) < new Date();

    res.json({
      success: true,
      data: {
        ...subscription,
        priceSnapshot: parseFloat(subscription.priceSnapshot),
        remainingDays,
        isExpired,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/subscription/history - Complete subscription and payment audit trail
export const getSubscriptionHistory = async (req, res, next) => {
  try {
    const instituteId = req.user.instituteId;

    const subscriptions = await prisma.instituteSubscription.findMany({
      where: { instituteId },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
        payments: {
          orderBy: { submittedAt: 'desc' },
          include: { bankAccount: true, reviewer: { select: { id: true, username: true, email: true } } },
        },
      },
    });

    const formatted = subscriptions.map((s) => ({
      ...s,
      priceSnapshot: parseFloat(s.priceSnapshot),
      remainingDays: getRemainingDays(s.endDate),
    }));

    res.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/subscription/select-plan - Institute selects a plan and creates snapshot
export const selectPlan = async (req, res, next) => {
  try {
    const instituteId = req.user.instituteId;
    const planId = parseInt(req.body.planId, 10);

    if (!planId) {
      return res.status(400).json({ success: false, message: 'Plan ID is required.' });
    }

    // Fetch plan with currently enabled features
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
      include: {
        features: {
          where: { isEnabled: true },
          include: { feature: true },
        },
      },
    });

    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, message: 'Selected plan is not available.' });
    }

    // Check if there is an existing PENDING payment
    const existingPendingPayment = await prisma.subscriptionPayment.findFirst({
      where: {
        instituteId,
        status: 'PENDING',
      },
    });

    if (existingPendingPayment) {
      return res.status(400).json({
        success: false,
        message: 'You already have a subscription payment awaiting verification. Please wait for Super Admin approval.',
      });
    }

    // Build immutable Plan Snapshots
    const featuresSnapshot = plan.features.map((pf) => ({
      id: pf.feature.id,
      code: pf.feature.code,
      name: pf.feature.name,
      category: pf.feature.category,
      description: pf.feature.description,
    }));

    const limitsSnapshot = {
      students: plan.studentLimit,
      teachers: plan.teacherLimit,
      admins: plan.adminLimit,
      classes: plan.classLimit,
      courses: plan.courseLimit,
      storageGb: plan.storageLimitGb,
      branches: plan.branchLimit,
    };

    // Create or initialize Subscription in PENDING_PAYMENT status
    const subscription = await prisma.instituteSubscription.create({
      data: {
        instituteId,
        planId: plan.id,
        planNameSnapshot: plan.name,
        priceSnapshot: plan.price,
        currencySnapshot: plan.currency,
        durationSnapshot: plan.duration,
        durationTypeSnapshot: plan.durationType,
        featuresSnapshot,
        limitsSnapshot,
        status: 'PENDING_PAYMENT',
      },
      include: {
        plan: true,
      },
    });

    res.status(201).json({
      success: true,
      message: `Plan '${plan.name}' selected. Please proceed with bank transfer.`,
      data: {
        ...subscription,
        priceSnapshot: parseFloat(subscription.priceSnapshot),
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/subscription/payment - Upload receipt and submit payment for review
export const submitPayment = async (req, res, next) => {
  try {
    const instituteId = req.user.instituteId;
    const subscriptionId = req.body.subscriptionId ? parseInt(req.body.subscriptionId, 10) : null;
    const bankAccountId = req.body.bankAccountId ? parseInt(req.body.bankAccountId, 10) : null;
    const transferReference = req.body.transferReference?.trim();
    const transferDateStr = req.body.transferDate;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Payment transfer receipt file (PDF, JPG, or PNG) is required.',
      });
    }

    if (!transferReference) {
      return res.status(400).json({
        success: false,
        message: 'Bank transfer reference / deposit slip number is required.',
      });
    }

    // Verify Subscription exists and belongs to this institute
    let subscription = null;
    if (subscriptionId) {
      subscription = await prisma.instituteSubscription.findFirst({
        where: { id: subscriptionId, instituteId },
      });
    } else {
      // Find latest pending or unapproved subscription
      subscription = await prisma.instituteSubscription.findFirst({
        where: { instituteId, status: { in: ['PENDING_PAYMENT', 'REJECTED'] } },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active plan selection found. Please select a plan before submitting payment.',
      });
    }

    // Check if there is already a PENDING payment for this institute
    const existingPendingPayment = await prisma.subscriptionPayment.findFirst({
      where: {
        instituteId,
        status: 'PENDING',
      },
    });

    if (existingPendingPayment) {
      // Clean up uploaded file if rejected
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Payment verification is already pending for this institute. Please wait for Super Admin review.',
      });
    }

    // Create Subscription Payment & update Subscription state in a transaction
    const transferDate = transferDateStr ? new Date(transferDateStr) : new Date();

    const payment = await prisma.$transaction(
      async (tx) => {
        const p = await tx.subscriptionPayment.create({
          data: {
            instituteId,
            subscriptionId: subscription.id,
            bankAccountId: bankAccountId || null,
            amount: subscription.priceSnapshot,
            currency: subscription.currencySnapshot,
            transferReference,
            transferDate,
            receiptFile: req.file.filename,
            receiptMimeType: req.file.mimetype,
            receiptOriginalName: req.file.originalname,
            status: 'PENDING',
          },
        });

        await tx.instituteSubscription.update({
          where: { id: subscription.id },
          data: {
            status: 'PAYMENT_SUBMITTED',
          },
        });

        // Emit notification for Super Admins
        const institute = await tx.institute.findUnique({ where: { id: instituteId } });
        await tx.notification.create({
          data: {
            userId: req.user.id,
            title: 'New Subscription Payment Submitted',
            message: `${institute?.name || 'An institute'} has submitted a payment receipt for plan '${subscription.planNameSnapshot}' (${subscription.currencySnapshot} ${parseFloat(subscription.priceSnapshot).toLocaleString()}). Reference: ${transferReference}`,
          },
        });

        return p;
      },
      { timeout: 20000, maxWait: 10000 }
    );

    res.status(201).json({
      success: true,
      message: 'Payment receipt submitted successfully! Awaiting Super Admin review.',
      data: payment,
    });
  } catch (error) {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    next(error);
  }
};

// GET /api/subscription/payments/:id/receipt - Secure stream of receipt file
export const getReceiptFile = async (req, res, next) => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment || !payment.receiptFile) {
      return res.status(404).json({ success: false, message: 'Receipt document not found.' });
    }

    // Security check: Only SUPER_ADMIN or the matching institute's users can view this receipt
    if (req.user.role !== 'SUPER_ADMIN' && req.user.instituteId !== payment.instituteId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You cannot access receipts from another institute.',
      });
    }

    const filePath = path.join(process.cwd(), 'uploads', 'receipts', payment.receiptFile);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Receipt file not found on disk.' });
    }

    if (payment.receiptMimeType) {
      res.setHeader('Content-Type', payment.receiptMimeType);
    }
    res.setHeader('Content-Disposition', `inline; filename="${payment.receiptOriginalName || payment.receiptFile}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};
