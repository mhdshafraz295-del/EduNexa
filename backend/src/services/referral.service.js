import crypto from 'crypto';
import prisma from '../config/prisma.js';
import { calculateSubscriptionEndDate } from '../controllers/subscriptionAdmin.controller.js';

/**
 * Generates a non-sequential, unique, case-normalized referral code.
 * Example format: EDUNEXA-K7A9X2
 */
export async function generateUniqueReferralCode() {
  let isUnique = false;
  let code = '';

  while (!isUnique) {
    const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
    code = `EDUNEXA-${randomPart}`;

    const existing = await prisma.instituteReferralProfile.findUnique({
      where: { referralCode: code },
    });

    if (!existing) {
      isUnique = true;
    }
  }

  return code;
}

/**
 * Gets or creates the Referral Profile for an institute.
 */
export async function getOrCreateInstituteReferralProfile(instituteId) {
  const instId = parseInt(instituteId, 10);

  let profile = await prisma.instituteReferralProfile.findUnique({
    where: { instituteId: instId },
  });

  if (!profile) {
    const referralCode = await generateUniqueReferralCode();
    profile = await prisma.instituteReferralProfile.create({
      data: {
        instituteId: instId,
        referralCode,
        totalReferrals: 0,
        qualifiedReferrals: 0,
      },
    });
  }

  return profile;
}

/**
 * Super Admin creates a referral campaign.
 */
export async function createCampaign(superAdminUser, {
  name,
  description,
  requiredReferrals = 10,
  rewardType = 'SUBSCRIPTION_EXTENSION',
  rewardMonths = 1,
  repeatable = false,
  qualificationRule = 'PAID_SUBSCRIPTION_ACTIVE',
  startsAt,
  endsAt,
  status = 'DRAFT',
}) {
  if (superAdminUser.role !== 'SUPER_ADMIN') {
    const error = new Error('Only Super Administrators can create referral campaigns.');
    error.status = 403;
    throw error;
  }

  const cleanName = name ? String(name).trim() : '';
  if (!cleanName) {
    const error = new Error('Campaign name is required.');
    error.status = 400;
    throw error;
  }

  const numRequired = parseInt(requiredReferrals, 10);
  if (isNaN(numRequired) || numRequired <= 0) {
    const error = new Error('Required referrals must be greater than zero.');
    error.status = 400;
    throw error;
  }

  const numMonths = parseInt(rewardMonths, 10);
  if (isNaN(numMonths) || numMonths <= 0) {
    const error = new Error('Reward months must be greater than zero.');
    error.status = 400;
    throw error;
  }

  const parsedStartsAt = startsAt ? new Date(startsAt) : new Date();
  const parsedEndsAt = endsAt ? new Date(endsAt) : null;

  if (parsedEndsAt && parsedEndsAt <= parsedStartsAt) {
    const error = new Error('Campaign end date must be after start date.');
    error.status = 400;
    throw error;
  }

  return await prisma.referralCampaign.create({
    data: {
      name: cleanName,
      description: description ? String(description).trim() : null,
      requiredReferrals: numRequired,
      rewardType,
      rewardMonths: numMonths,
      repeatable: Boolean(repeatable),
      qualificationRule,
      startsAt: parsedStartsAt,
      endsAt: parsedEndsAt,
      status,
      createdById: superAdminUser.id,
    },
  });
}

/**
 * Super Admin updates a campaign.
 */
export async function updateCampaign(superAdminUser, campaignId, data) {
  if (superAdminUser.role !== 'SUPER_ADMIN') {
    const error = new Error('Only Super Administrators can update referral campaigns.');
    error.status = 403;
    throw error;
  }

  const id = parseInt(campaignId, 10);
  const existing = await prisma.referralCampaign.findUnique({
    where: { id },
  });

  if (!existing) {
    const error = new Error('Campaign not found.');
    error.status = 404;
    throw error;
  }

  const updateData = {};
  if (data.name !== undefined) updateData.name = String(data.name).trim();
  if (data.description !== undefined) updateData.description = data.description ? String(data.description).trim() : null;
  if (data.requiredReferrals !== undefined) updateData.requiredReferrals = parseInt(data.requiredReferrals, 10);
  if (data.rewardMonths !== undefined) updateData.rewardMonths = parseInt(data.rewardMonths, 10);
  if (data.repeatable !== undefined) updateData.repeatable = Boolean(data.repeatable);
  if (data.qualificationRule !== undefined) updateData.qualificationRule = data.qualificationRule;
  if (data.startsAt !== undefined) updateData.startsAt = new Date(data.startsAt);
  if (data.endsAt !== undefined) updateData.endsAt = data.endsAt ? new Date(data.endsAt) : null;
  if (data.status !== undefined) updateData.status = data.status;

  if (updateData.endsAt && updateData.startsAt && updateData.endsAt <= updateData.startsAt) {
    const error = new Error('End date must be after start date.');
    error.status = 400;
    throw error;
  }

  return await prisma.referralCampaign.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Sets campaign status.
 */
export async function setCampaignStatus(superAdminUser, campaignId, status) {
  return await updateCampaign(superAdminUser, campaignId, { status });
}

/**
 * Super Admin lists campaigns with progress metrics.
 */
export async function listSuperAdminCampaigns() {
  const campaigns = await prisma.referralCampaign.findMany({
    include: {
      createdBy: { select: { id: true, username: true, email: true } },
      referrals: {
        select: { id: true, status: true, referrerInstituteId: true },
      },
      rewards: {
        select: { id: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    success: true,
    campaigns: campaigns.map((c) => {
      const totalReferrals = c.referrals.length;
      const qualifiedReferrals = c.referrals.filter((r) => r.status === 'QUALIFIED' || r.status === 'REWARDED').length;
      const pendingReferrals = c.referrals.filter((r) => r.status === 'PENDING').length;
      const participatingInstitutesSet = new Set(c.referrals.map((r) => r.referrerInstituteId));

      const pendingRewards = c.rewards.filter((rw) => rw.status === 'PENDING_APPROVAL').length;
      const appliedRewards = c.rewards.filter((rw) => rw.status === 'APPROVED' || rw.status === 'APPLIED').length;

      return {
        id: c.id,
        name: c.name,
        description: c.description,
        requiredReferrals: c.requiredReferrals,
        rewardType: c.rewardType,
        rewardMonths: c.rewardMonths,
        repeatable: c.repeatable,
        qualificationRule: c.qualificationRule,
        status: c.status,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        createdAt: c.createdAt,
        createdBy: c.createdBy,
        metrics: {
          participatingInstitutesCount: participatingInstitutesSet.size,
          totalReferrals,
          qualifiedReferrals,
          pendingReferrals,
          pendingRewards,
          appliedRewards,
        },
      };
    }),
  };
}

/**
 * Super Admin gets detailed single campaign metrics & referrals list.
 */
export async function getSuperAdminCampaignDetail(campaignId) {
  const id = parseInt(campaignId, 10);
  const campaign = await prisma.referralCampaign.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, username: true, email: true } },
      referrals: {
        include: {
          referrerInstitute: { select: { id: true, name: true, code: true } },
          referredInstitute: { select: { id: true, name: true, code: true, createdAt: true, isActive: true } },
        },
        orderBy: { registeredAt: 'desc' },
      },
      rewards: {
        include: {
          institute: { select: { id: true, name: true, code: true } },
          approvedBy: { select: { id: true, username: true } },
          auditLogs: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!campaign) {
    const error = new Error('Campaign not found.');
    error.status = 404;
    throw error;
  }

  return {
    success: true,
    campaign,
  };
}

/**
 * Super Admin Referral Analytics Dashboard KPI.
 */
export async function getSuperAdminReferralAnalytics() {
  const now = new Date();

  const [
    activeCampaignsCount,
    totalReferralsCount,
    pendingReferralsCount,
    qualifiedReferralsCount,
    rejectedReferralsCount,
    rewardsEarnedCount,
    rewardsAppliedCount,
  ] = await Promise.all([
    prisma.referralCampaign.count({
      where: {
        status: 'ACTIVE',
        startsAt: { lte: now },
        OR: [
          { endsAt: null },
          { endsAt: { gte: now } },
        ],
      },
    }),
    prisma.instituteReferral.count(),
    prisma.instituteReferral.count({ where: { status: 'PENDING' } }),
    prisma.instituteReferral.count({ where: { status: { in: ['QUALIFIED', 'REWARDED'] } } }),
    prisma.instituteReferral.count({ where: { status: 'REJECTED' } }),
    prisma.referralReward.count(),
    prisma.referralReward.count({ where: { status: { in: ['APPROVED', 'APPLIED'] } } }),
  ]);

  const conversionRate = totalReferralsCount > 0
    ? ((qualifiedReferralsCount / totalReferralsCount) * 100).toFixed(1)
    : '0.0';

  return {
    success: true,
    data: {
      activeCampaignsCount,
      totalReferralsCount,
      pendingReferralsCount,
      qualifiedReferralsCount,
      rejectedReferralsCount,
      rewardsEarnedCount,
      rewardsAppliedCount,
      conversionRate: `${conversionRate}%`,
    },
  };
}

/**
 * Records a referral when a new institute registers with an optional referral code.
 * Validates:
 * 1. Referral code format and referrer existence.
 * 2. Anti self-referral.
 * 3. Prevents duplicate referral attribution for the same new institute.
 * 4. Links to current active campaign.
 * 5. Sets status to PENDING (never immediately qualifies).
 */
export async function recordInstituteReferralOnRegistration({ referrerCode, newInstituteId }) {
  if (!referrerCode || !String(referrerCode).trim()) {
    return null;
  }

  const cleanCode = String(referrerCode).trim().toUpperCase();
  const newInstId = parseInt(newInstituteId, 10);

  const referrerProfile = await prisma.instituteReferralProfile.findUnique({
    where: { referralCode: cleanCode },
    include: { institute: true },
  });

  if (!referrerProfile) {
    console.warn(`Referral code '${cleanCode}' not found. Registration proceeds without referral attribution.`);
    return null;
  }

  // Anti Self-Referral Check
  if (referrerProfile.instituteId === newInstId) {
    console.warn('Self-referral attempt blocked.');
    return null;
  }

  // Check if this new institute is already referred
  const existingReferral = await prisma.instituteReferral.findUnique({
    where: { referredInstituteId: newInstId },
  });
  if (existingReferral) {
    return existingReferral;
  }

  // Find currently active referral campaign
  const now = new Date();
  const activeCampaign = await prisma.referralCampaign.findFirst({
    where: {
      status: 'ACTIVE',
      startsAt: { lte: now },
      OR: [
        { endsAt: null },
        { endsAt: { gte: now } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  const referral = await prisma.$transaction(async (tx) => {
    const rec = await tx.instituteReferral.create({
      data: {
        campaignId: activeCampaign ? activeCampaign.id : null,
        referrerInstituteId: referrerProfile.instituteId,
        referredInstituteId: newInstId,
        referralCode: cleanCode,
        status: 'PENDING',
      },
    });

    await tx.instituteReferralProfile.update({
      where: { id: referrerProfile.id },
      data: {
        totalReferrals: { increment: 1 },
      },
    });

    // Notify Referrer Admin
    const referrerAdmin = await tx.user.findFirst({
      where: { instituteId: referrerProfile.instituteId, role: 'ADMIN' },
    });

    if (referrerAdmin) {
      await tx.notification.create({
        data: {
          instituteId: referrerProfile.instituteId,
          userId: referrerAdmin.id,
          title: 'New Institute Registered Via Your Referral Link',
          message: 'A new institute registered using your referral code. Once they activate a paid subscription, your referral progress will update!',
          link: '/admin/referrals',
        },
      });
    }

    return rec;
  });

  return referral;
}

/**
 * Evaluates referral qualification for a referred institute.
 * Called when an institute's paid subscription is activated.
 */
export async function evaluateReferralQualification(referredInstituteId) {
  const referredId = parseInt(referredInstituteId, 10);

  const referral = await prisma.instituteReferral.findFirst({
    where: {
      referredInstituteId: referredId,
      status: 'PENDING',
    },
    include: {
      campaign: true,
      referrerInstitute: {
        include: {
          referralProfile: true,
        },
      },
    },
  });

  if (!referral) {
    return { qualified: false, reason: 'No pending referral found.' };
  }

  // Verify referred institute has an active paid subscription
  const activeSub = await prisma.instituteSubscription.findFirst({
    where: {
      instituteId: referredId,
      status: 'ACTIVE',
    },
  });

  if (!activeSub) {
    return { qualified: false, reason: 'Referred institute does not have an active paid subscription.' };
  }

  // Atomically qualify referral and evaluate reward threshold
  return await prisma.$transaction(async (tx) => {
    // 1. Mark referral as QUALIFIED
    const updatedReferral = await tx.instituteReferral.update({
      where: { id: referral.id },
      data: {
        status: 'QUALIFIED',
        qualifiedAt: new Date(),
      },
    });

    // 2. Increment referrer's qualified count
    await tx.instituteReferralProfile.update({
      where: { instituteId: referral.referrerInstituteId },
      data: {
        qualifiedReferrals: { increment: 1 },
      },
    });

    // 3. Check Campaign Reward Threshold
    const campaign = referral.campaign || await tx.referralCampaign.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    let rewardCreated = null;

    if (campaign) {
      const qualifiedCount = await tx.instituteReferral.count({
        where: {
          referrerInstituteId: referral.referrerInstituteId,
          campaignId: campaign.id,
          status: { in: ['QUALIFIED', 'REWARDED'] },
        },
      });

      const existingRewardsCount = await tx.referralReward.count({
        where: {
          instituteId: referral.referrerInstituteId,
          campaignId: campaign.id,
          status: { not: 'REJECTED' },
        },
      });

      const required = campaign.requiredReferrals;
      const isRepeatable = campaign.repeatable;

      const totalEarnableRewards = isRepeatable
        ? Math.floor(qualifiedCount / required)
        : (qualifiedCount >= required ? 1 : 0);

      if (totalEarnableRewards > existingRewardsCount) {
        // Create new ReferralReward
        rewardCreated = await tx.referralReward.create({
          data: {
            campaignId: campaign.id,
            instituteId: referral.referrerInstituteId,
            qualifiedReferralCount: qualifiedCount,
            rewardType: campaign.rewardType,
            rewardMonths: campaign.rewardMonths,
            status: 'PENDING_APPROVAL',
            earnedAt: new Date(),
          },
        });

        // Create Audit Log
        await tx.referralRewardAuditLog.create({
          data: {
            rewardId: rewardCreated.id,
            campaignId: campaign.id,
            instituteId: referral.referrerInstituteId,
            action: 'REWARD_EARNED',
            notes: `Institute earned reward for achieving ${qualifiedCount} qualified referrals.`,
          },
        });

        // Notify Referrer Admin
        const referrerAdmin = await tx.user.findFirst({
          where: { instituteId: referral.referrerInstituteId, role: 'ADMIN' },
        });

        if (referrerAdmin) {
          await tx.notification.create({
            data: {
              instituteId: referral.referrerInstituteId,
              userId: referrerAdmin.id,
              title: '🎉 Referral Reward Goal Reached!',
              message: `Congratulations! You have reached ${qualifiedCount} qualified referrals. Your ${campaign.rewardMonths} Month(s) Free reward is awaiting approval.`,
              link: '/admin/referrals',
            },
          });
        }
      }
    }

    return {
      qualified: true,
      referral: updatedReferral,
      rewardCreated,
    };
  });
}

/**
 * Super Admin approves reward and extends the referrer institute's subscription.
 * Uses atomic transaction and idempotent state checks.
 */
export async function approveReward(superAdminUser, rewardId) {
  if (superAdminUser.role !== 'SUPER_ADMIN') {
    const error = new Error('Only Super Administrators can approve referral rewards.');
    error.status = 403;
    throw error;
  }

  const rId = parseInt(rewardId, 10);
  const reward = await prisma.referralReward.findUnique({
    where: { id: rId },
    include: {
      campaign: true,
      institute: {
        include: {
          subscriptions: {
            where: { status: 'ACTIVE' },
            orderBy: { endDate: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  if (!reward) {
    const error = new Error('Reward record not found.');
    error.status = 404;
    throw error;
  }

  if (reward.status === 'APPROVED' || reward.status === 'APPLIED') {
    const error = new Error('This reward has already been approved and applied.');
    error.status = 400;
    throw error;
  }

  if (reward.status === 'REJECTED') {
    const error = new Error('Cannot approve a rejected reward.');
    error.status = 400;
    throw error;
  }

  // Find target subscription to extend
  let targetSub = reward.institute.subscriptions[0];

  // If no active subscription, find latest subscription
  if (!targetSub) {
    targetSub = await prisma.instituteSubscription.findFirst({
      where: { instituteId: reward.instituteId },
      orderBy: { createdAt: 'desc' },
    });
  }

  return await prisma.$transaction(async (tx) => {
    let prevEndDate = null;
    let newEndDate = null;

    if (targetSub) {
      prevEndDate = targetSub.endDate ? new Date(targetSub.endDate) : new Date();
      const baseDate = prevEndDate > new Date() ? prevEndDate : new Date();
      newEndDate = calculateSubscriptionEndDate(baseDate, reward.rewardMonths, 'MONTHS');

      await tx.instituteSubscription.update({
        where: { id: targetSub.id },
        data: {
          endDate: newEndDate,
          status: 'ACTIVE',
        },
      });
    }

    // Update reward record
    const updatedReward = await tx.referralReward.update({
      where: { id: rId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: superAdminUser.id,
        appliedAt: new Date(),
        subscriptionId: targetSub?.id || null,
      },
    });

    // Create Audit Log
    await tx.referralRewardAuditLog.create({
      data: {
        rewardId: rId,
        campaignId: reward.campaignId,
        instituteId: reward.instituteId,
        action: 'SUBSCRIPTION_EXTENDED',
        previousExpiryDate: prevEndDate,
        newExpiryDate: newEndDate,
        monthsExtended: reward.rewardMonths,
        performedById: superAdminUser.id,
        notes: `Reward approved by Super Admin (${superAdminUser.username}). Extended subscription by ${reward.rewardMonths} calendar month(s).`,
      },
    });

    // Notify Institute Admin
    const instAdmin = await tx.user.findFirst({
      where: { instituteId: reward.instituteId, role: 'ADMIN' },
    });

    if (instAdmin) {
      await tx.notification.create({
        data: {
          instituteId: reward.instituteId,
          userId: instAdmin.id,
          title: '🎁 Referral Reward Approved & Applied!',
          message: `Your ${reward.rewardMonths} Month(s) FREE subscription reward has been approved! Valid until ${newEndDate ? newEndDate.toLocaleDateString() : 'extended'}.`,
          link: '/admin/subscription',
        },
      });
    }

    return {
      success: true,
      reward: updatedReward,
      previousExpiryDate: prevEndDate,
      newExpiryDate: newEndDate,
    };
  });
}

/**
 * Super Admin rejects reward.
 */
export async function rejectReward(superAdminUser, rewardId, rejectionReason) {
  if (superAdminUser.role !== 'SUPER_ADMIN') {
    const error = new Error('Only Super Administrators can reject referral rewards.');
    error.status = 403;
    throw error;
  }

  const rId = parseInt(rewardId, 10);
  const reward = await prisma.referralReward.findUnique({
    where: { id: rId },
  });

  if (!reward) {
    const error = new Error('Reward record not found.');
    error.status = 404;
    throw error;
  }

  const reason = rejectionReason ? String(rejectionReason).trim() : 'Manual review rejection';

  return await prisma.$transaction(async (tx) => {
    const updatedReward = await tx.referralReward.update({
      where: { id: rId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
      },
    });

    await tx.referralRewardAuditLog.create({
      data: {
        rewardId: rId,
        campaignId: reward.campaignId,
        instituteId: reward.instituteId,
        action: 'REWARD_REJECTED',
        performedById: superAdminUser.id,
        notes: `Reward rejected: ${reason}`,
      },
    });

    return { success: true, reward: updatedReward };
  });
}

/**
 * Institute Admin Referral & Reward Dashboard.
 */
export async function getInstituteReferralDashboard(instituteId, baseUrl = '') {
  const instId = parseInt(instituteId, 10);
  const profile = await getOrCreateInstituteReferralProfile(instId);

  const now = new Date();
  const activeCampaign = await prisma.referralCampaign.findFirst({
    where: {
      status: 'ACTIVE',
      startsAt: { lte: now },
      OR: [
        { endsAt: null },
        { endsAt: { gte: now } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate actual qualified referrals under active campaign
  const campaignWhere = {
    referrerInstituteId: instId,
  };
  if (activeCampaign) {
    campaignWhere.campaignId = activeCampaign.id;
  }

  const [referrals, rewards] = await Promise.all([
    prisma.instituteReferral.findMany({
      where: campaignWhere,
      include: {
        referredInstitute: {
          select: { name: true, code: true, createdAt: true, isActive: true },
        },
      },
      orderBy: { registeredAt: 'desc' },
    }),
    prisma.referralReward.findMany({
      where: { instituteId: instId },
      include: {
        campaign: { select: { name: true, rewardMonths: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const qualifiedCount = referrals.filter((r) => r.status === 'QUALIFIED' || r.status === 'REWARDED').length;
  const pendingCount = referrals.filter((r) => r.status === 'PENDING').length;
  const requiredReferrals = activeCampaign ? activeCampaign.requiredReferrals : 10;
  const progressPercent = Math.min(100, Math.round((qualifiedCount / requiredReferrals) * 100));
  const remainingNeeded = Math.max(0, requiredReferrals - (qualifiedCount % requiredReferrals));

  const cleanBaseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : '';
  const referralLink = `${cleanBaseUrl}/register?ref=${encodeURIComponent(profile.referralCode)}`;

  return {
    success: true,
    referralCode: profile.referralCode,
    referralLink,
    activeCampaign: activeCampaign ? {
      id: activeCampaign.id,
      name: activeCampaign.name,
      description: activeCampaign.description,
      requiredReferrals: activeCampaign.requiredReferrals,
      rewardMonths: activeCampaign.rewardMonths,
      repeatable: activeCampaign.repeatable,
      endsAt: activeCampaign.endsAt,
    } : null,
    progress: {
      qualifiedCount,
      requiredReferrals,
      progressPercent,
      remainingNeeded,
      pendingCount,
      totalSent: referrals.length,
    },
    referrals: referrals.map((r) => ({
      id: r.id,
      instituteName: r.referredInstitute?.name || 'Referred Campus',
      code: r.referredInstitute?.code || '',
      registeredAt: r.registeredAt,
      qualifiedAt: r.qualifiedAt,
      status: r.status,
    })),
    rewards: rewards.map((rw) => ({
      id: rw.id,
      campaignName: rw.campaign?.name || 'Referral Reward',
      rewardMonths: rw.rewardMonths,
      status: rw.status,
      earnedAt: rw.earnedAt,
      approvedAt: rw.approvedAt,
      rejectionReason: rw.rejectionReason,
    })),
  };
}
