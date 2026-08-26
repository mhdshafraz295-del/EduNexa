import prisma from '../config/prisma.js';
import { evaluateReferralQualification } from '../services/referral.service.js';

// Precise Calendar Date Arithmetic Helper
export const calculateSubscriptionEndDate = (startDate, duration, durationType) => {
  const end = new Date(startDate.getTime());

  if (durationType === 'YEARS') {
    end.setFullYear(end.getFullYear() + duration);
  } else if (durationType === 'MONTHS') {
    const targetMonth = end.getMonth() + duration;
    end.setMonth(targetMonth);
  } else if (durationType === 'DAYS') {
    end.setDate(end.getDate() + duration);
  } else {
    // Default fallback: 1 month
    end.setMonth(end.getMonth() + duration);
  }

  return end;
};

// GET /api/super-admin/subscriptions - Cross-tenant list of all subscriptions
export const getSubscriptions = async (req, res, next) => {
  try {
    const { status, search } = req.query;

    const where = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.institute = {
        OR: [
          { name: { contains: search } },
          { code: { contains: search } },
        ],
      };
    }

    const subscriptions = await prisma.instituteSubscription.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        institute: {
          select: { id: true, name: true, code: true, email: true, phone: true, isActive: true },
        },
        plan: true,
        payments: {
          orderBy: { submittedAt: 'desc' },
          include: {
            bankAccount: true,
            reviewer: { select: { id: true, username: true, email: true } },
          },
        },
      },
    });

    const formatted = subscriptions.map((s) => ({
      ...s,
      priceSnapshot: parseFloat(s.priceSnapshot),
      latestPayment: s.payments[0] || null,
    }));

    res.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/super-admin/subscriptions/pending - List all pending payments awaiting verification
export const getPendingPayments = async (req, res, next) => {
  try {
    const pendingPayments = await prisma.subscriptionPayment.findMany({
      where: { status: 'PENDING' },
      orderBy: { submittedAt: 'asc' },
      include: {
        institute: {
          select: { id: true, name: true, code: true, email: true, phone: true },
        },
        subscription: true,
        bankAccount: true,
      },
    });

    const formatted = pendingPayments.map((p) => ({
      ...p,
      amount: parseFloat(p.amount),
      subscription: {
        ...p.subscription,
        priceSnapshot: parseFloat(p.subscription.priceSnapshot),
      },
    }));

    res.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/super-admin/subscriptions/:id - Detailed subscription view
export const getSubscriptionById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const subscription = await prisma.instituteSubscription.findUnique({
      where: { id },
      include: {
        institute: true,
        plan: true,
        payments: {
          orderBy: { submittedAt: 'desc' },
          include: {
            bankAccount: true,
            reviewer: { select: { id: true, username: true, email: true } },
          },
        },
      },
    });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription record not found.' });
    }

    res.json({
      success: true,
      data: {
        ...subscription,
        priceSnapshot: parseFloat(subscription.priceSnapshot),
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/super-admin/subscriptions/:id/approve - Approve payment & activate subscription
export const approvePayment = async (req, res, next) => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    const adminNotes = req.body.adminNotes?.trim() || null;

    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: { subscription: true, institute: true },
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    if (payment.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Payment is already ${payment.status}. Cannot approve.`,
      });
    }

    const startDate = new Date();
    const duration = payment.subscription.durationSnapshot;
    const durationType = payment.subscription.durationTypeSnapshot;
    const endDate = calculateSubscriptionEndDate(startDate, duration, durationType);

    // Perform atomic approval in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Payment record
      const updatedPayment = await tx.subscriptionPayment.update({
        where: { id: paymentId },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedBy: req.user.id,
          adminNotes,
        },
      });

      // 2. Update Subscription record
      const updatedSubscription = await tx.instituteSubscription.update({
        where: { id: payment.subscriptionId },
        data: {
          status: 'ACTIVE',
          startDate,
          endDate,
        },
      });

      // Find an admin user of this institute to address notification to
      const instAdmin = await tx.user.findFirst({
        where: { instituteId: payment.instituteId, role: 'ADMIN' },
      });

      // 3. Create In-App Notification for Institute Admin
      await tx.notification.create({
        data: {
          instituteId: payment.instituteId || null,
          userId: instAdmin?.id || req.user.id,
          title: 'EduNexa Subscription Approved & Activated',
          message: `Your EduNexa subscription for '${payment.subscription.planNameSnapshot}' has been verified and activated. Valid until ${endDate.toLocaleDateString()}.`,
        },
      });

      return { updatedPayment, updatedSubscription };
    });

    // Evaluate referral qualification if this institute was referred
    try {
      await evaluateReferralQualification(payment.instituteId);
    } catch (refErr) {
      console.warn('Referral qualification evaluation notice:', refErr.message);
    }

    res.json({
      success: true,
      message: 'Payment approved and subscription activated successfully!',
      data: {
        payment: result.updatedPayment,
        subscription: result.updatedSubscription,
        startDate,
        endDate,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/super-admin/subscriptions/:id/reject - Reject payment with reason
export const rejectPayment = async (req, res, next) => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    const rejectionReason = req.body.rejectionReason?.trim();
    const adminNotes = req.body.adminNotes?.trim() || null;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'A detailed rejection reason is required so the institute can correct and resubmit their payment.',
      });
    }

    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: { subscription: true, institute: true },
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    if (payment.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Payment is already ${payment.status}. Cannot reject.`,
      });
    }

    // Perform atomic rejection in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Payment record
      const updatedPayment = await tx.subscriptionPayment.update({
        where: { id: paymentId },
        data: {
          status: 'REJECTED',
          rejectionReason,
          reviewedAt: new Date(),
          reviewedBy: req.user.id,
          adminNotes,
        },
      });

      // 2. Update Subscription record
      const updatedSubscription = await tx.instituteSubscription.update({
        where: { id: payment.subscriptionId },
        data: {
          status: 'REJECTED',
        },
      });

      // Find an admin user of this institute
      const instAdmin = await tx.user.findFirst({
        where: { instituteId: payment.instituteId, role: 'ADMIN' },
      });

      // 3. Create In-App Notification for Institute Admin
      await tx.notification.create({
        data: {
          instituteId: payment.instituteId || null,
          userId: instAdmin?.id || req.user.id,
          title: 'Subscription Payment Verification Rejected',
          message: `Your payment receipt for plan '${payment.subscription.planNameSnapshot}' was rejected. Reason: ${rejectionReason}. Please visit your Subscription portal to resubmit with a valid receipt.`,
        },
      });

      return { updatedPayment, updatedSubscription };
    });

    res.json({
      success: true,
      message: 'Payment rejected and institute notified.',
      data: {
        payment: result.updatedPayment,
        subscription: result.updatedSubscription,
      },
    });
  } catch (error) {
    next(error);
  }
};
