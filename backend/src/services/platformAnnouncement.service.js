import prisma from '../config/prisma.js';

/**
 * Super Admin creates a platform announcement.
 */
export async function createAnnouncement(superAdminUser, {
  title,
  message,
  priority = 'INFO',
  targetType = 'ALL_INSTITUTES',
  targetInstituteIds = [],
  startsAt,
  expiresAt,
  status = 'DRAFT',
}) {
  if (superAdminUser.role !== 'SUPER_ADMIN') {
    const error = new Error('Only Super Administrators can create platform announcements.');
    error.status = 403;
    throw error;
  }

  const cleanTitle = title ? String(title).trim() : '';
  const cleanMessage = message ? String(message).trim() : '';

  if (!cleanTitle) {
    const error = new Error('Announcement title is required.');
    error.status = 400;
    throw error;
  }

  if (!cleanMessage) {
    const error = new Error('Announcement message is required.');
    error.status = 400;
    throw error;
  }

  const parsedStartsAt = startsAt ? new Date(startsAt) : new Date();
  const parsedExpiresAt = expiresAt ? new Date(expiresAt) : null;

  if (parsedExpiresAt && parsedExpiresAt <= parsedStartsAt) {
    const error = new Error('Expiry date must be after the start date.');
    error.status = 400;
    throw error;
  }

  if (targetType === 'SELECTED_INSTITUTES' && (!targetInstituteIds || targetInstituteIds.length === 0)) {
    const error = new Error('Please select at least one institute for targeted announcements.');
    error.status = 400;
    throw error;
  }

  const isPublished = status === 'PUBLISHED';

  return await prisma.$transaction(async (tx) => {
    const announcement = await tx.platformAnnouncement.create({
      data: {
        title: cleanTitle,
        message: cleanMessage,
        priority,
        targetType,
        status,
        startsAt: parsedStartsAt,
        expiresAt: parsedExpiresAt,
        createdById: superAdminUser.id,
        publishedAt: isPublished ? new Date() : null,
      },
    });

    if (targetType === 'SELECTED_INSTITUTES' && targetInstituteIds.length > 0) {
      const targetsData = targetInstituteIds.map((instId) => ({
        announcementId: announcement.id,
        instituteId: parseInt(instId, 10),
      }));

      await tx.platformAnnouncementTarget.createMany({
        data: targetsData,
        skipDuplicates: true,
      });
    }

    return announcement;
  });
}

/**
 * Super Admin updates an existing platform announcement.
 */
export async function updateAnnouncement(superAdminUser, announcementId, {
  title,
  message,
  priority,
  targetType,
  targetInstituteIds,
  startsAt,
  expiresAt,
  status,
}) {
  if (superAdminUser.role !== 'SUPER_ADMIN') {
    const error = new Error('Only Super Administrators can edit platform announcements.');
    error.status = 403;
    throw error;
  }

  const id = parseInt(announcementId, 10);
  const existing = await prisma.platformAnnouncement.findUnique({
    where: { id },
  });

  if (!existing) {
    const error = new Error('Announcement not found.');
    error.status = 404;
    throw error;
  }

  const updateData = {};
  if (title !== undefined) updateData.title = String(title).trim();
  if (message !== undefined) updateData.message = String(message).trim();
  if (priority !== undefined) updateData.priority = priority;
  if (targetType !== undefined) updateData.targetType = targetType;
  if (startsAt !== undefined) updateData.startsAt = new Date(startsAt);
  if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

  if (status !== undefined) {
    updateData.status = status;
    if (status === 'PUBLISHED' && !existing.publishedAt) {
      updateData.publishedAt = new Date();
    }
  }

  if (updateData.expiresAt && updateData.startsAt && updateData.expiresAt <= updateData.startsAt) {
    const error = new Error('Expiry date must be after the start date.');
    error.status = 400;
    throw error;
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.platformAnnouncement.update({
      where: { id },
      data: updateData,
    });

    if (targetType === 'SELECTED_INSTITUTES' && Array.isArray(targetInstituteIds)) {
      await tx.platformAnnouncementTarget.deleteMany({
        where: { announcementId: id },
      });

      if (targetInstituteIds.length > 0) {
        const targetsData = targetInstituteIds.map((instId) => ({
          announcementId: id,
          instituteId: parseInt(instId, 10),
        }));

        await tx.platformAnnouncementTarget.createMany({
          data: targetsData,
          skipDuplicates: true,
        });
      }
    } else if (targetType === 'ALL_INSTITUTES') {
      await tx.platformAnnouncementTarget.deleteMany({
        where: { announcementId: id },
      });
    }

    return updated;
  });
}

/**
 * Super Admin toggles publish status.
 */
export async function setAnnouncementStatus(superAdminUser, announcementId, status) {
  if (superAdminUser.role !== 'SUPER_ADMIN') {
    const error = new Error('Only Super Administrators can change announcement status.');
    error.status = 403;
    throw error;
  }

  const id = parseInt(announcementId, 10);
  const existing = await prisma.platformAnnouncement.findUnique({
    where: { id },
  });

  if (!existing) {
    const error = new Error('Announcement not found.');
    error.status = 404;
    throw error;
  }

  const updateData = { status };
  if (status === 'PUBLISHED' && !existing.publishedAt) {
    updateData.publishedAt = new Date();
  }

  return await prisma.platformAnnouncement.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Super Admin deletes an announcement.
 */
export async function deleteAnnouncement(superAdminUser, announcementId) {
  if (superAdminUser.role !== 'SUPER_ADMIN') {
    const error = new Error('Only Super Administrators can delete platform announcements.');
    error.status = 403;
    throw error;
  }

  const id = parseInt(announcementId, 10);
  return await prisma.platformAnnouncement.delete({
    where: { id },
  });
}

/**
 * Super Admin lists all announcements with status, dates, and delivery metrics.
 */
export async function listSuperAdminAnnouncements({ status, search, page = 1, limit = 20 }) {
  const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

  const where = {};
  if (status && status !== 'ALL') {
    where.status = status;
  }

  if (search && String(search).trim()) {
    const q = String(search).trim();
    where.OR = [
      { title: { contains: q } },
      { message: { contains: q } },
    ];
  }

  const totalInstitutesCount = await prisma.institute.count({ where: { isActive: true } });

  const [total, announcements] = await Promise.all([
    prisma.platformAnnouncement.count({ where }),
    prisma.platformAnnouncement.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, username: true, email: true },
        },
        targets: {
          include: {
            institute: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        receipts: {
          select: { instituteId: true, userId: true, readAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
  ]);

  const formatted = announcements.map((a) => {
    const isTargetAll = a.targetType === 'ALL_INSTITUTES';
    const eligibleInstitutesCount = isTargetAll ? totalInstitutesCount : a.targets.length;

    // Count unique institutes that have read
    const readInstitutesSet = new Set(
      a.receipts.filter((r) => r.readAt !== null).map((r) => r.instituteId)
    );
    const readCount = readInstitutesSet.size;
    const unreadCount = Math.max(0, eligibleInstitutesCount - readCount);

    const now = new Date();
    const isExpired = a.expiresAt ? a.expiresAt < now : false;
    const isUpcoming = a.startsAt > now;

    return {
      id: a.id,
      title: a.title,
      message: a.message,
      priority: a.priority,
      targetType: a.targetType,
      status: a.status,
      startsAt: a.startsAt,
      expiresAt: a.expiresAt,
      publishedAt: a.publishedAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      createdBy: a.createdBy,
      targets: a.targets.map((t) => t.institute),
      isExpired,
      isUpcoming,
      metrics: {
        eligibleInstitutesCount,
        readCount,
        unreadCount,
        totalReceipts: a.receipts.length,
      },
    };
  });

  return {
    success: true,
    total,
    page: Math.max(parseInt(page, 10) || 1, 1),
    limit: take,
    announcements: formatted,
  };
}

/**
 * Super Admin views a single announcement with real analytics.
 */
export async function getSuperAdminAnnouncementDetail(announcementId) {
  const id = parseInt(announcementId, 10);
  const announcement = await prisma.platformAnnouncement.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { id: true, username: true, email: true },
      },
      targets: {
        include: {
          institute: {
            select: { id: true, name: true, code: true, email: true },
          },
        },
      },
      receipts: {
        include: {
          institute: { select: { id: true, name: true, code: true } },
          user: { select: { id: true, username: true, role: true } },
        },
      },
    },
  });

  if (!announcement) {
    const error = new Error('Announcement not found.');
    error.status = 404;
    throw error;
  }

  const totalInstitutesCount = await prisma.institute.count({ where: { isActive: true } });
  const isTargetAll = announcement.targetType === 'ALL_INSTITUTES';
  const eligibleCount = isTargetAll ? totalInstitutesCount : announcement.targets.length;

  const readInstitutesSet = new Set(
    announcement.receipts.filter((r) => r.readAt !== null).map((r) => r.instituteId)
  );

  return {
    success: true,
    announcement: {
      id: announcement.id,
      title: announcement.title,
      message: announcement.message,
      priority: announcement.priority,
      targetType: announcement.targetType,
      status: announcement.status,
      startsAt: announcement.startsAt,
      expiresAt: announcement.expiresAt,
      publishedAt: announcement.publishedAt,
      createdAt: announcement.createdAt,
      createdBy: announcement.createdBy,
      targets: announcement.targets.map((t) => t.institute),
      receipts: announcement.receipts,
      metrics: {
        eligibleInstitutesCount: eligibleCount,
        readCount: readInstitutesSet.size,
        unreadCount: Math.max(0, eligibleCount - readInstitutesSet.size),
      },
    },
  };
}

/**
 * Super Admin Global Platform Announcement Analytics.
 */
export async function getSuperAdminAnnouncementAnalytics() {
  const now = new Date();

  const [
    totalAnnouncements,
    publishedCount,
    draftCount,
    archivedCount,
    activeLiveCount,
    allReceipts,
  ] = await Promise.all([
    prisma.platformAnnouncement.count(),
    prisma.platformAnnouncement.count({ where: { status: 'PUBLISHED' } }),
    prisma.platformAnnouncement.count({ where: { status: 'DRAFT' } }),
    prisma.platformAnnouncement.count({ where: { status: 'ARCHIVED' } }),
    prisma.platformAnnouncement.count({
      where: {
        status: 'PUBLISHED',
        startsAt: { lte: now },
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: now } },
        ],
      },
    }),
    prisma.platformAnnouncementReceipt.findMany({
      select: { announcementId: true, instituteId: true, readAt: true },
    }),
  ]);

  const totalReads = allReceipts.filter((r) => r.readAt !== null).length;

  return {
    success: true,
    data: {
      totalAnnouncements,
      publishedCount,
      draftCount,
      archivedCount,
      activeLiveCount,
      totalReads,
    },
  };
}

/**
 * Institute Admin queries active announcements visible to their specific institute.
 * Strictly checks server-side:
 * 1. status = PUBLISHED
 * 2. startsAt <= now
 * 3. expiresAt is null OR expiresAt >= now
 * 4. targetType = ALL_INSTITUTES OR instituteId in targets
 */
export async function listInstituteAnnouncements(instituteId, userId, { filter = 'all', page = 1, limit = 20 }) {
  const instId = parseInt(instituteId, 10);
  const now = new Date();

  // Find eligible announcements
  const announcements = await prisma.platformAnnouncement.findMany({
    where: {
      status: 'PUBLISHED',
      startsAt: { lte: now },
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: now } },
      ],
      AND: [
        {
          OR: [
            { targetType: 'ALL_INSTITUTES' },
            { targets: { some: { instituteId: instId } } },
          ],
        },
      ],
    },
    include: {
      receipts: {
        where: { userId },
        select: { readAt: true, dismissedAt: true },
      },
    },
    orderBy: [
      { priority: 'desc' },
      { publishedAt: 'desc' },
    ],
  });

  const formatted = announcements
    .map((a) => {
      const receipt = a.receipts[0] || null;
      const isRead = Boolean(receipt?.readAt);
      const isDismissed = Boolean(receipt?.dismissedAt);

      return {
        id: a.id,
        title: a.title,
        message: a.message,
        priority: a.priority,
        publishedAt: a.publishedAt || a.startsAt,
        startsAt: a.startsAt,
        expiresAt: a.expiresAt,
        isRead,
        isDismissed,
      };
    })
    .filter((a) => {
      if (filter === 'unread') return !a.isRead;
      if (filter === 'active') return !a.isDismissed;
      return true;
    });

  return {
    success: true,
    total: formatted.length,
    announcements: formatted,
  };
}

/**
 * Institute Admin marks announcement as read.
 */
export async function markAnnouncementRead(instituteId, userId, announcementId) {
  const instId = parseInt(instituteId, 10);
  const aId = parseInt(announcementId, 10);

  const announcement = await prisma.platformAnnouncement.findUnique({
    where: { id: aId },
  });

  if (!announcement) {
    const error = new Error('Announcement not found.');
    error.status = 404;
    throw error;
  }

  const receipt = await prisma.platformAnnouncementReceipt.upsert({
    where: {
      announcementId_userId: {
        announcementId: aId,
        userId,
      },
    },
    update: {
      readAt: new Date(),
    },
    create: {
      announcementId: aId,
      instituteId: instId,
      userId,
      readAt: new Date(),
    },
  });

  return { success: true, receipt };
}

/**
 * Institute Admin dismisses announcement.
 */
export async function dismissAnnouncement(instituteId, userId, announcementId) {
  const instId = parseInt(instituteId, 10);
  const aId = parseInt(announcementId, 10);

  const receipt = await prisma.platformAnnouncementReceipt.upsert({
    where: {
      announcementId_userId: {
        announcementId: aId,
        userId,
      },
    },
    update: {
      dismissedAt: new Date(),
    },
    create: {
      announcementId: aId,
      instituteId: instId,
      userId,
      dismissedAt: new Date(),
    },
  });

  return { success: true, receipt };
}
