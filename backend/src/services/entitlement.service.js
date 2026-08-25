import prisma from '../config/prisma.js';
import fs from 'fs';
import path from 'path';

/**
 * Calculates remaining days until subscription expiry
 */
export const getRemainingDays = (endDate) => {
  if (!endDate) return 0;
  const diff = new Date(endDate).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
};

/**
 * Retrieves the effective entitlement for an institute based on its immutable snapshot
 */
export const getInstituteEntitlement = async (instituteId) => {
  if (!instituteId) {
    return {
      isValid: false,
      status: 'NO_INSTITUTE',
      planName: null,
      features: {},
      limits: {},
      remainingDays: 0,
      isExpiringSoon: false,
    };
  }

  const now = new Date();

  // Find the latest active subscription
  let subscription = await prisma.instituteSubscription.findFirst({
    where: {
      instituteId,
      status: 'ACTIVE',
      startDate: { lte: now },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Check if subscription has expired
  if (subscription && new Date(subscription.endDate) <= now) {
    // Mark as expired in DB if still flagged ACTIVE
    try {
      await prisma.instituteSubscription.update({
        where: { id: subscription.id },
        data: { status: 'EXPIRED' },
      });
      subscription.status = 'EXPIRED';
    } catch (e) {
      subscription.status = 'EXPIRED';
    }
  }

  // If no active subscription, check for other states
  if (!subscription || subscription.status !== 'ACTIVE') {
    const latestSub = await prisma.instituteSubscription.findFirst({
      where: { instituteId },
      orderBy: { createdAt: 'desc' },
    });

    const isExpired = latestSub?.endDate && new Date(latestSub.endDate) <= now;

    return {
      isValid: false,
      status: isExpired ? 'EXPIRED' : (latestSub?.status || 'NO_SUBSCRIPTION'),
      subscriptionId: latestSub?.id || null,
      planName: latestSub?.planNameSnapshot || null,
      startDate: latestSub?.startDate || null,
      endDate: latestSub?.endDate || null,
      features: {},
      limits: latestSub?.limitsSnapshot || {},
      remainingDays: 0,
      isExpiringSoon: false,
      rejectionReason: latestSub?.status === 'REJECTED' ? 'Payment rejected' : null,
    };
  }

  // Active Subscription: Parse immutable feature map
  const featureMap = {};
  if (Array.isArray(subscription.featuresSnapshot)) {
    for (const f of subscription.featuresSnapshot) {
      if (f.code) {
        featureMap[f.code] = true;
      }
    }
  } else if (typeof subscription.featuresSnapshot === 'object' && subscription.featuresSnapshot !== null) {
    Object.assign(featureMap, subscription.featuresSnapshot);
  }

  // If subscription has a linked planId, also reflect any enabled features configured for that plan
  if (subscription.planId) {
    try {
      const planFeatures = await prisma.planFeature.findMany({
        where: { planId: subscription.planId, isEnabled: true },
        include: { feature: true },
      });
      for (const pf of planFeatures) {
        if (pf.feature?.code) {
          featureMap[pf.feature.code] = true;
        }
      }
    } catch (err) {
      console.warn('Warning fetching plan features for entitlement:', err.message);
    }
  }

  const remaining = getRemainingDays(subscription.endDate);
  const isExpiringSoon = remaining <= 7;

  return {
    isValid: true,
    status: isExpiringSoon ? 'EXPIRING_SOON' : 'ACTIVE',
    rawStatus: subscription.status,
    subscriptionId: subscription.id,
    planName: subscription.planNameSnapshot,
    price: parseFloat(subscription.priceSnapshot),
    currency: subscription.currencySnapshot,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    features: featureMap,
    limits: subscription.limitsSnapshot || {},
    remainingDays: remaining,
    isExpiringSoon,
  };
};

/**
 * Calculates current institute disk storage usage in GB
 */
export const calculateInstituteStorageUsage = async (instituteId) => {
  let totalBytes = 0;
  const receiptsDir = path.join(process.cwd(), 'uploads', 'receipts');

  // Count size of payment receipts uploaded for this institute
  if (fs.existsSync(receiptsDir)) {
    const payments = await prisma.subscriptionPayment.findMany({
      where: { instituteId },
      select: { receiptFile: true },
    });

    for (const p of payments) {
      if (p.receiptFile) {
        const filePath = path.join(receiptsDir, p.receiptFile);
        if (fs.existsSync(filePath)) {
          try {
            const stat = fs.statSync(filePath);
            totalBytes += stat.size;
          } catch (e) {}
        }
      }
    }
  }

  const usedGb = totalBytes / (1024 * 1024 * 1024);
  return {
    usedBytes: totalBytes,
    usedGb: parseFloat(usedGb.toFixed(4)),
  };
};

/**
 * Retrieves full usage stats vs snapshot limits for an institute
 */
export const getInstituteUsageStats = async (instituteId) => {
  const entitlement = await getInstituteEntitlement(instituteId);
  const limits = entitlement.limits || {};

  const [studentCount, teacherCount, adminCount, classCount, courseCount, storageInfo] = await Promise.all([
    prisma.student.count({ where: { instituteId } }),
    prisma.teacher.count({ where: { instituteId } }),
    prisma.user.count({ where: { instituteId, role: 'ADMIN', isActive: true } }),
    prisma.class.count({ where: { instituteId } }),
    prisma.course ? prisma.course.count({ where: { instituteId } }).catch(() => 0) : 0,
    calculateInstituteStorageUsage(instituteId),
  ]);

  return {
    entitlement,
    usage: {
      students: {
        current: studentCount,
        limit: limits.students !== undefined ? limits.students : null,
        percentage: limits.students ? Math.min(100, Math.round((studentCount / limits.students) * 100)) : 0,
        isLimitReached: limits.students !== null && studentCount >= limits.students,
        isApproachingLimit: limits.students !== null && (studentCount / limits.students) >= 0.8,
      },
      teachers: {
        current: teacherCount,
        limit: limits.teachers !== undefined ? limits.teachers : null,
        percentage: limits.teachers ? Math.min(100, Math.round((teacherCount / limits.teachers) * 100)) : 0,
        isLimitReached: limits.teachers !== null && teacherCount >= limits.teachers,
        isApproachingLimit: limits.teachers !== null && (teacherCount / limits.teachers) >= 0.8,
      },
      admins: {
        current: adminCount,
        limit: limits.admins !== undefined ? limits.admins : null,
        percentage: limits.admins ? Math.min(100, Math.round((adminCount / limits.admins) * 100)) : 0,
        isLimitReached: limits.admins !== null && adminCount >= limits.admins,
        isApproachingLimit: limits.admins !== null && (adminCount / limits.admins) >= 0.8,
      },
      classes: {
        current: classCount,
        limit: limits.classes !== undefined ? limits.classes : null,
        percentage: limits.classes ? Math.min(100, Math.round((classCount / limits.classes) * 100)) : 0,
        isLimitReached: limits.classes !== null && classCount >= limits.classes,
        isApproachingLimit: limits.classes !== null && (classCount / limits.classes) >= 0.8,
      },
      courses: {
        current: courseCount,
        limit: limits.courses !== undefined ? limits.courses : null,
        percentage: limits.courses ? Math.min(100, Math.round((courseCount / limits.courses) * 100)) : 0,
        isLimitReached: limits.courses !== null && courseCount >= limits.courses,
        isApproachingLimit: limits.courses !== null && (courseCount / limits.courses) >= 0.8,
      },
      storage: {
        currentGb: storageInfo.usedGb,
        currentBytes: storageInfo.usedBytes,
        limitGb: limits.storageGb !== undefined ? limits.storageGb : null,
        percentage: limits.storageGb ? Math.min(100, Math.round((storageInfo.usedGb / limits.storageGb) * 100)) : 0,
        isLimitReached: limits.storageGb !== null && storageInfo.usedGb >= limits.storageGb,
        isApproachingLimit: limits.storageGb !== null && (storageInfo.usedGb / limits.storageGb) >= 0.8,
      },
      branches: {
        current: 1,
        limit: limits.branches !== undefined ? limits.branches : null,
        percentage: limits.branches ? Math.min(100, Math.round((1 / limits.branches) * 100)) : 0,
        isLimitReached: limits.branches !== null && 1 >= limits.branches,
      },
    },
  };
};

/**
 * Checks if creating an additional entity of a given type violates the active plan limit
 */
export const checkPlanLimit = async (instituteId, limitType, increment = 1) => {
  const stats = await getInstituteUsageStats(instituteId);
  const metric = stats.usage[limitType];

  if (!metric) return { allowed: true };

  // NULL limit means Unlimited
  if (metric.limit === null || metric.limit === undefined) {
    return { allowed: true };
  }

  if (metric.current + increment > metric.limit) {
    return {
      allowed: false,
      code: 'PLAN_LIMIT_REACHED',
      limit: limitType,
      current: metric.current,
      maximum: metric.limit,
      message: `Your current plan supports up to ${metric.limit} ${limitType}. Upgrade your subscription to add more.`,
    };
  }

  return { allowed: true };
};
