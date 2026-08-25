import prisma from '../config/prisma.js';

/**
 * Derives authoritative poll status considering schedule timestamps and manual closures
 */
export function getAuthoritativePollStatus(poll) {
  if (!poll) return 'CLOSED';
  if (poll.status === 'DRAFT') return 'DRAFT';
  if (poll.status === 'ARCHIVED') return 'ARCHIVED';
  if (poll.status === 'CLOSED') return 'CLOSED';

  const now = new Date();

  // If endsAt is defined and has passed -> CLOSED
  if (poll.endsAt && new Date(poll.endsAt) <= now) {
    return 'CLOSED';
  }

  // If startsAt is defined and in the future -> SCHEDULED
  if (poll.startsAt && new Date(poll.startsAt) > now) {
    return 'SCHEDULED';
  }

  // Otherwise, if published -> ACTIVE
  return 'ACTIVE';
}

/**
 * Validates whether a user is eligible to participate in a specific poll based on audience configuration
 */
export async function checkUserPollEligibility(instituteId, poll, user) {
  if (!user || user.isActive === false) return false;
  if (user.instituteId && instituteId && user.instituteId !== instituteId) return false;

  const role = user.role;
  const audienceType = poll.audienceType || 'ALL_USERS';

  switch (audienceType) {
    case 'ALL_USERS':
      return ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'].includes(role);

    case 'STUDENTS':
      return role === 'STUDENT';

    case 'TEACHERS':
      return role === 'TEACHER';

    case 'PARENTS':
      return role === 'PARENT';

    case 'CLASS_STUDENTS': {
      if (role !== 'STUDENT' || !poll.classId) return false;
      const student = await prisma.student.findFirst({
        where: { userId: user.id, instituteId },
        include: {
          studentEnrollments: { where: { status: 'ACTIVE' } },
        },
      });
      if (!student) return false;
      if (student.classId === poll.classId) return true;
      return student.studentEnrollments.some((e) => e.classId === poll.classId);
    }

    case 'CLASS_TEACHERS': {
      if (role !== 'TEACHER' || !poll.classId) return false;
      const teacher = await prisma.teacher.findFirst({
        where: { userId: user.id, instituteId },
      });
      if (!teacher) return false;

      // 1. Primary class teacher
      const isClassTeacher = await prisma.class.findFirst({
        where: { id: poll.classId, instituteId, classTeacherId: teacher.id },
      });
      if (isClassTeacher) return true;

      // 2. Teacher Assignment
      const hasAssignment = await prisma.teacherAssignment.findFirst({
        where: { teacherId: teacher.id, classId: poll.classId, isActive: true },
      });
      if (hasAssignment) return true;

      // 3. Class Subject Teacher
      const hasClassSubject = await prisma.classSubject.findFirst({
        where: { classId: poll.classId, teacherId: teacher.id },
      });
      return Boolean(hasClassSubject);
    }

    case 'CLASS_PARENTS': {
      if (role !== 'PARENT' || !poll.classId) return false;
      const parent = await prisma.parent.findFirst({
        where: { userId: user.id, instituteId },
        include: {
          students: {
            include: {
              student: {
                include: {
                  studentEnrollments: { where: { status: 'ACTIVE' } },
                },
              },
            },
          },
        },
      });
      if (!parent || !parent.students?.length) return false;

      return parent.students.some((ps) => {
        const s = ps.student;
        if (!s) return false;
        if (s.classId === poll.classId) return true;
        return s.studentEnrollments.some((e) => e.classId === poll.classId);
      });
    }

    default:
      return false;
  }
}

/**
 * Calculates total eligible users count for a poll audience configuration
 */
export async function calculateEligibleUsersCount(instituteId, audienceType, classId) {
  switch (audienceType) {
    case 'ALL_USERS': {
      const counts = await prisma.user.groupBy({
        by: ['role'],
        where: {
          instituteId,
          isActive: true,
          role: { in: ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] },
        },
        _count: { id: true },
      });

      let total = 0;
      const breakdown = { ADMIN: 0, TEACHER: 0, STUDENT: 0, PARENT: 0 };
      counts.forEach((c) => {
        if (breakdown[c.role] !== undefined) {
          breakdown[c.role] = c._count.id;
          total += c._count.id;
        }
      });
      return { total, breakdown };
    }

    case 'STUDENTS': {
      const count = await prisma.user.count({
        where: { instituteId, role: 'STUDENT', isActive: true },
      });
      return { total: count, breakdown: { STUDENT: count } };
    }

    case 'TEACHERS': {
      const count = await prisma.user.count({
        where: { instituteId, role: 'TEACHER', isActive: true },
      });
      return { total: count, breakdown: { TEACHER: count } };
    }

    case 'PARENTS': {
      const count = await prisma.user.count({
        where: { instituteId, role: 'PARENT', isActive: true },
      });
      return { total: count, breakdown: { PARENT: count } };
    }

    case 'CLASS_STUDENTS': {
      if (!classId) return { total: 0, breakdown: { STUDENT: 0 } };
      // Active students enrolled in class
      const students = await prisma.student.findMany({
        where: {
          instituteId,
          user: { isActive: true },
          OR: [
            { classId },
            { studentEnrollments: { some: { classId, status: 'ACTIVE' } } },
          ],
        },
        select: { userId: true },
      });
      const uniqueUserIds = new Set(students.map((s) => s.userId).filter(Boolean));
      return { total: uniqueUserIds.size, breakdown: { STUDENT: uniqueUserIds.size } };
    }

    case 'CLASS_TEACHERS': {
      if (!classId) return { total: 0, breakdown: { TEACHER: 0 } };
      const teacherIds = new Set();

      // Class Teacher
      const cls = await prisma.class.findFirst({
        where: { id: classId, instituteId },
        select: { classTeacherId: true },
      });
      if (cls?.classTeacherId) teacherIds.add(cls.classTeacherId);

      // Teacher assignments
      const assignments = await prisma.teacherAssignment.findMany({
        where: { classId, isActive: true },
        select: { teacherId: true },
      });
      assignments.forEach((a) => teacherIds.add(a.teacherId));

      // Class subjects
      const classSubs = await prisma.classSubject.findMany({
        where: { classId, teacherId: { not: null } },
        select: { teacherId: true },
      });
      classSubs.forEach((cs) => {
        if (cs.teacherId) teacherIds.add(cs.teacherId);
      });

      if (teacherIds.size === 0) return { total: 0, breakdown: { TEACHER: 0 } };

      const teachers = await prisma.teacher.findMany({
        where: {
          id: { in: Array.from(teacherIds) },
          instituteId,
          user: { isActive: true },
        },
        select: { userId: true },
      });
      const count = teachers.length;
      return { total: count, breakdown: { TEACHER: count } };
    }

    case 'CLASS_PARENTS': {
      if (!classId) return { total: 0, breakdown: { PARENT: 0 } };
      // Find students in class
      const students = await prisma.student.findMany({
        where: {
          instituteId,
          OR: [
            { classId },
            { studentEnrollments: { some: { classId, status: 'ACTIVE' } } },
          ],
        },
        select: { id: true },
      });
      const studentIds = students.map((s) => s.id);
      if (studentIds.length === 0) return { total: 0, breakdown: { PARENT: 0 } };

      const parentLinks = await prisma.parentStudent.findMany({
        where: {
          studentId: { in: studentIds },
          parent: { user: { isActive: true }, instituteId },
        },
        select: { parent: { select: { userId: true } } },
      });

      const uniqueParentUserIds = new Set(parentLinks.map((pl) => pl.parent?.userId).filter(Boolean));
      return { total: uniqueParentUserIds.size, breakdown: { PARENT: uniqueParentUserIds.size } };
    }

    default:
      return { total: 0, breakdown: {} };
  }
}

/**
 * Dispatches in-app notifications to eligible voters when a poll is published/active
 */
export async function notifyEligibleVotersOnPublish(instituteId, poll) {
  try {
    const audienceType = poll.audienceType || 'ALL_USERS';
    const classId = poll.classId;

    let userIdsToNotify = [];

    switch (audienceType) {
      case 'ALL_USERS': {
        const users = await prisma.user.findMany({
          where: {
            instituteId,
            isActive: true,
            role: { in: ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] },
          },
          select: { id: true },
        });
        userIdsToNotify = users.map((u) => u.id);
        break;
      }

      case 'STUDENTS': {
        const users = await prisma.user.findMany({
          where: { instituteId, role: 'STUDENT', isActive: true },
          select: { id: true },
        });
        userIdsToNotify = users.map((u) => u.id);
        break;
      }

      case 'TEACHERS': {
        const users = await prisma.user.findMany({
          where: { instituteId, role: 'TEACHER', isActive: true },
          select: { id: true },
        });
        userIdsToNotify = users.map((u) => u.id);
        break;
      }

      case 'PARENTS': {
        const users = await prisma.user.findMany({
          where: { instituteId, role: 'PARENT', isActive: true },
          select: { id: true },
        });
        userIdsToNotify = users.map((u) => u.id);
        break;
      }

      case 'CLASS_STUDENTS': {
        if (classId) {
          const students = await prisma.student.findMany({
            where: {
              instituteId,
              user: { isActive: true },
              OR: [{ classId }, { studentEnrollments: { some: { classId, status: 'ACTIVE' } } }],
            },
            select: { userId: true },
          });
          userIdsToNotify = Array.from(new Set(students.map((s) => s.userId).filter(Boolean)));
        }
        break;
      }

      case 'CLASS_TEACHERS': {
        if (classId) {
          const { total } = await calculateEligibleUsersCount(instituteId, audienceType, classId);
          // Fetch teachers
          const cls = await prisma.class.findFirst({
            where: { id: classId, instituteId },
            include: {
              classTeacher: { select: { userId: true } },
              teacherAssignments: { where: { isActive: true }, include: { teacher: { select: { userId: true } } } },
              classSubjects: { include: { teacher: { select: { userId: true } } } },
            },
          });
          const set = new Set();
          if (cls?.classTeacher?.userId) set.add(cls.classTeacher.userId);
          cls?.teacherAssignments?.forEach((ta) => ta.teacher?.userId && set.add(ta.teacher.userId));
          cls?.classSubjects?.forEach((cs) => cs.teacher?.userId && set.add(cs.teacher.userId));
          userIdsToNotify = Array.from(set);
        }
        break;
      }

      case 'CLASS_PARENTS': {
        if (classId) {
          const students = await prisma.student.findMany({
            where: {
              instituteId,
              OR: [{ classId }, { studentEnrollments: { some: { classId, status: 'ACTIVE' } } }],
            },
            select: { id: true },
          });
          const sIds = students.map((s) => s.id);
          if (sIds.length > 0) {
            const parents = await prisma.parentStudent.findMany({
              where: { studentId: { in: sIds }, parent: { instituteId, user: { isActive: true } } },
              select: { parent: { select: { userId: true } } },
            });
            userIdsToNotify = Array.from(new Set(parents.map((p) => p.parent?.userId).filter(Boolean)));
          }
        }
        break;
      }
    }

    if (userIdsToNotify.length === 0) return;

    // Filter out poll creator
    userIdsToNotify = userIdsToNotify.filter((id) => id !== poll.createdById);

    // Build notifications payload in batches
    const link = '/polls';
    const title = 'New Poll Available';
    const message = `A new poll "${poll.title}" is now open for voting.`;

    const notificationsData = userIdsToNotify.map((userId) => ({
      instituteId,
      userId,
      title,
      message,
      link,
      isRead: false,
    }));

    // Batch insert using createMany
    const chunkSize = 200;
    for (let i = 0; i < notificationsData.length; i += chunkSize) {
      const chunk = notificationsData.slice(i, i + chunkSize);
      await prisma.notification.createMany({
        data: chunk,
      });
    }
  } catch (err) {
    console.warn('Poll publish notifications warning:', err.message);
  }
}

// =========================================================================
// ADMIN POLL MANAGEMENT
// =========================================================================

/**
 * Admin: Create a new Poll (Draft, Scheduled, or Published Active)
 */
export async function createPoll(instituteId, createdById, data) {
  const {
    title,
    description,
    audienceType = 'ALL_USERS',
    classId,
    status = 'DRAFT',
    startsAt,
    endsAt,
    allowVoteChange = false,
    anonymous = true,
    resultVisibility = 'AFTER_CLOSE',
    options = [],
  } = data;

  if (!title || !title.trim()) {
    throw new Error('Poll title is required.');
  }

  const validOptions = (Array.isArray(options) ? options : [])
    .map((opt) => (typeof opt === 'string' ? opt.trim() : opt.text?.trim()))
    .filter(Boolean);

  if (validOptions.length < 2) {
    throw new Error('A poll must have at least 2 valid options.');
  }

  // Validate Class if class-specific audience selected
  if (['CLASS_STUDENTS', 'CLASS_TEACHERS', 'CLASS_PARENTS'].includes(audienceType)) {
    if (!classId) {
      throw new Error('Please select a target class for this audience.');
    }
    const cls = await prisma.class.findFirst({
      where: { id: parseInt(classId, 10), instituteId },
    });
    if (!cls) {
      throw new Error('Selected class does not belong to your institute.');
    }
  }

  // Validate timestamps
  let parsedStartsAt = startsAt ? new Date(startsAt) : null;
  let parsedEndsAt = endsAt ? new Date(endsAt) : null;

  if (parsedStartsAt && isNaN(parsedStartsAt.getTime())) {
    throw new Error('Invalid start date/time.');
  }
  if (parsedEndsAt && isNaN(parsedEndsAt.getTime())) {
    throw new Error('Invalid end date/time.');
  }
  if (parsedStartsAt && parsedEndsAt && parsedStartsAt >= parsedEndsAt) {
    throw new Error('Poll end date/time must be after the start date/time.');
  }

  const now = new Date();
  let finalStatus = status;
  let publishedAt = null;

  if (status === 'ACTIVE' || status === 'SCHEDULED' || status === 'PUBLISHED') {
    publishedAt = now;
    if (parsedStartsAt && parsedStartsAt > now) {
      finalStatus = 'SCHEDULED';
    } else if (parsedEndsAt && parsedEndsAt <= now) {
      finalStatus = 'CLOSED';
    } else {
      finalStatus = 'ACTIVE';
    }
  }

  // Create Poll and Options in transaction
  const poll = await prisma.$transaction(async (tx) => {
    const created = await tx.poll.create({
      data: {
        instituteId,
        title: title.trim(),
        description: description ? description.trim() : null,
        audienceType,
        classId: ['CLASS_STUDENTS', 'CLASS_TEACHERS', 'CLASS_PARENTS'].includes(audienceType) ? parseInt(classId, 10) : null,
        status: finalStatus,
        startsAt: parsedStartsAt,
        endsAt: parsedEndsAt,
        allowVoteChange: Boolean(allowVoteChange),
        anonymous: Boolean(anonymous),
        resultVisibility,
        publishedAt,
        createdById,
        options: {
          create: validOptions.map((text, idx) => ({
            text,
            displayOrder: idx,
          })),
        },
      },
      include: {
        options: { orderBy: { displayOrder: 'asc' } },
        class: { select: { id: true, name: true, section: true } },
      },
    });
    return created;
  });

  // If poll is actively published, notify eligible voters
  if (poll.status === 'ACTIVE') {
    notifyEligibleVotersOnPublish(instituteId, poll);
  }

  return poll;
}

/**
 * Admin: Get Polls List with Real MySQL Aggregates & KPIs
 */
export async function getAdminPolls(instituteId, filters = {}) {
  const {
    status,
    audienceType,
    search,
    classId,
    page = 1,
    limit = 20,
  } = filters;

  const where = { instituteId };

  if (status && status !== 'ALL') {
    if (['DRAFT', 'SCHEDULED', 'ACTIVE', 'CLOSED', 'ARCHIVED'].includes(status.toUpperCase())) {
      where.status = status.toUpperCase();
    }
  }

  if (audienceType && audienceType !== 'ALL') {
    where.audienceType = audienceType;
  }

  if (classId) {
    where.classId = parseInt(classId, 10);
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
    ];
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);

  const [total, polls] = await Promise.all([
    prisma.poll.count({ where }),
    prisma.poll.findMany({
      where,
      include: {
        options: {
          orderBy: { displayOrder: 'asc' },
          include: {
            _count: { select: { votes: true } },
          },
        },
        class: { select: { id: true, name: true, section: true } },
        createdBy: { select: { id: true, username: true } },
        _count: { select: { votes: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ]);

  // Compute calculated metrics per poll
  const enriched = await Promise.all(
    polls.map(async (p) => {
      const derivedStatus = getAuthoritativePollStatus(p);
      const totalVotes = p._count?.votes || 0;

      const { total: eligibleCount } = await calculateEligibleUsersCount(
        instituteId,
        p.audienceType,
        p.classId
      );

      const participationPercent = eligibleCount > 0
        ? Math.min(100, parseFloat(((totalVotes / eligibleCount) * 100).toFixed(1)))
        : 0;

      const optionsWithStats = p.options.map((opt) => {
        const count = opt._count?.votes || 0;
        const pct = totalVotes > 0 ? parseFloat(((count / totalVotes) * 100).toFixed(1)) : 0;
        return {
          id: opt.id,
          text: opt.text,
          displayOrder: opt.displayOrder,
          voteCount: count,
          percentage: pct,
        };
      });

      return {
        id: p.id,
        title: p.title,
        description: p.description,
        audienceType: p.audienceType,
        class: p.class,
        status: derivedStatus,
        rawStatus: p.status,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        allowVoteChange: p.allowVoteChange,
        anonymous: p.anonymous,
        resultVisibility: p.resultVisibility,
        publishedAt: p.publishedAt,
        createdAt: p.createdAt,
        totalVotes,
        eligibleUsersCount: eligibleCount,
        participationPercent,
        options: optionsWithStats,
      };
    })
  );

  return {
    total,
    page: parseInt(page, 10),
    limit: take,
    totalPages: Math.ceil(total / take) || 1,
    polls: enriched,
  };
}

/**
 * Admin: Get Single Poll Details with Analytics & Options Breakdown
 */
export async function getAdminPollById(instituteId, pollId) {
  const pId = parseInt(pollId, 10);
  const poll = await prisma.poll.findFirst({
    where: { id: pId, instituteId },
    include: {
      options: {
        orderBy: { displayOrder: 'asc' },
        include: {
          _count: { select: { votes: true } },
        },
      },
      class: { select: { id: true, name: true, section: true } },
      createdBy: { select: { id: true, username: true } },
      _count: { select: { votes: true } },
    },
  });

  if (!poll) {
    throw new Error('Poll not found in your institute.');
  }

  const derivedStatus = getAuthoritativePollStatus(poll);
  const totalVotes = poll._count?.votes || 0;

  const { total: eligibleCount, breakdown: roleBreakdown } = await calculateEligibleUsersCount(
    instituteId,
    poll.audienceType,
    poll.classId
  );

  const participationPercent = eligibleCount > 0
    ? Math.min(100, parseFloat(((totalVotes / eligibleCount) * 100).toFixed(1)))
    : 0;

  // Options vote distribution
  const optionsWithStats = poll.options.map((opt) => {
    const count = opt._count?.votes || 0;
    const pct = totalVotes > 0 ? parseFloat(((count / totalVotes) * 100).toFixed(1)) : 0;
    return {
      id: opt.id,
      text: opt.text,
      displayOrder: opt.displayOrder,
      voteCount: count,
      percentage: pct,
    };
  });

  // Calculate vote breakdown by user role (anonymous safe: aggregate counts only)
  const votesByRole = await prisma.pollVote.groupBy({
    by: ['userId'],
    where: { pollId: poll.id },
  });

  return {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    audienceType: poll.audienceType,
    classId: poll.classId,
    class: poll.class,
    status: derivedStatus,
    rawStatus: poll.status,
    startsAt: poll.startsAt,
    endsAt: poll.endsAt,
    allowVoteChange: poll.allowVoteChange,
    anonymous: poll.anonymous,
    resultVisibility: poll.resultVisibility,
    publishedAt: poll.publishedAt,
    createdAt: poll.createdAt,
    updatedAt: poll.updatedAt,
    createdBy: poll.createdBy,
    totalVotes,
    eligibleUsersCount: eligibleCount,
    participationPercent,
    roleBreakdown,
    options: optionsWithStats,
  };
}

/**
 * Admin: Update Poll Configuration
 */
export async function updatePoll(instituteId, pollId, data) {
  const pId = parseInt(pollId, 10);
  const poll = await prisma.poll.findFirst({
    where: { id: pId, instituteId },
    include: {
      _count: { select: { votes: true } },
    },
  });

  if (!poll) {
    throw new Error('Poll not found.');
  }

  const hasVotes = (poll._count?.votes || 0) > 0;

  const {
    title,
    description,
    audienceType,
    classId,
    startsAt,
    endsAt,
    allowVoteChange,
    anonymous,
    resultVisibility,
    options,
  } = data;

  const updateData = {};

  if (title && title.trim()) updateData.title = title.trim();
  if (description !== undefined) updateData.description = description ? description.trim() : null;
  if (allowVoteChange !== undefined) updateData.allowVoteChange = Boolean(allowVoteChange);
  if (anonymous !== undefined) updateData.anonymous = Boolean(anonymous);
  if (resultVisibility !== undefined) updateData.resultVisibility = resultVisibility;

  if (startsAt !== undefined) {
    updateData.startsAt = startsAt ? new Date(startsAt) : null;
  }
  if (endsAt !== undefined) {
    updateData.endsAt = endsAt ? new Date(endsAt) : null;
  }

  if (updateData.startsAt && updateData.endsAt && updateData.startsAt >= updateData.endsAt) {
    throw new Error('Poll end date/time must be after start date/time.');
  }

  // If votes exist, lock audience & options
  if (hasVotes) {
    if (audienceType && audienceType !== poll.audienceType) {
      throw new Error('Cannot change audience type after voting has begun.');
    }
    if (classId !== undefined && classId !== poll.classId) {
      throw new Error('Cannot change target class after voting has begun.');
    }
  } else {
    // If no votes exist, allow audience & class changes
    if (audienceType) updateData.audienceType = audienceType;
    if (classId !== undefined) {
      if (['CLASS_STUDENTS', 'CLASS_TEACHERS', 'CLASS_PARENTS'].includes(audienceType || poll.audienceType)) {
        const cls = await prisma.class.findFirst({
          where: { id: parseInt(classId, 10), instituteId },
        });
        if (!cls) throw new Error('Selected class does not belong to your institute.');
        updateData.classId = parseInt(classId, 10);
      } else {
        updateData.classId = null;
      }
    }
  }

  // Update Options if no votes have been cast yet
  const updatedPoll = await prisma.$transaction(async (tx) => {
    if (!hasVotes && Array.isArray(options) && options.length > 0) {
      const validOpts = options
        .map((opt) => (typeof opt === 'string' ? opt.trim() : opt.text?.trim()))
        .filter(Boolean);

      if (validOpts.length < 2) {
        throw new Error('A poll must have at least 2 valid options.');
      }

      // Delete existing options and re-create
      await tx.pollOption.deleteMany({ where: { pollId: pId } });
      await tx.pollOption.createMany({
        data: validOpts.map((text, idx) => ({
          pollId: pId,
          text,
          displayOrder: idx,
        })),
      });
    }

    const res = await tx.poll.update({
      where: { id: pId },
      data: updateData,
      include: {
        options: { orderBy: { displayOrder: 'asc' } },
        class: { select: { id: true, name: true, section: true } },
      },
    });

    return res;
  });

  return updatedPoll;
}

/**
 * Admin: Change Poll Status (Publish Draft, Close, Archive)
 */
export async function updatePollStatus(instituteId, pollId, newStatus) {
  const pId = parseInt(pollId, 10);
  const poll = await prisma.poll.findFirst({
    where: { id: pId, instituteId },
    include: {
      options: true,
      _count: { select: { votes: true } },
    },
  });

  if (!poll) {
    throw new Error('Poll not found.');
  }

  const targetStatus = newStatus.toUpperCase();
  if (!['DRAFT', 'SCHEDULED', 'ACTIVE', 'CLOSED', 'ARCHIVED'].includes(targetStatus)) {
    throw new Error('Invalid poll status.');
  }

  const now = new Date();
  const updateData = { status: targetStatus };

  if (targetStatus === 'ACTIVE' || targetStatus === 'SCHEDULED' || targetStatus === 'PUBLISHED') {
    if (poll.options.length < 2) {
      throw new Error('Poll must have at least 2 options before publishing.');
    }
    if (!poll.publishedAt) {
      updateData.publishedAt = now;
    }

    if (poll.startsAt && new Date(poll.startsAt) > now) {
      updateData.status = 'SCHEDULED';
    } else if (poll.endsAt && new Date(poll.endsAt) <= now) {
      updateData.status = 'CLOSED';
    } else {
      updateData.status = 'ACTIVE';
    }
  }

  if (targetStatus === 'CLOSED') {
    if (!poll.endsAt || new Date(poll.endsAt) > now) {
      updateData.endsAt = now;
    }
  }

  const updated = await prisma.poll.update({
    where: { id: pId },
    data: updateData,
    include: {
      options: { orderBy: { displayOrder: 'asc' } },
      class: { select: { id: true, name: true, section: true } },
    },
  });

  // Notify if newly activated
  if (updated.status === 'ACTIVE' && poll.status === 'DRAFT') {
    notifyEligibleVotersOnPublish(instituteId, updated);
  }

  return updated;
}

/**
 * Admin: Delete Poll (Allowed if 0 votes, otherwise recommends Archive)
 */
export async function deletePoll(instituteId, pollId) {
  const pId = parseInt(pollId, 10);
  if (isNaN(pId)) {
    const error = new Error('Invalid poll ID.');
    error.statusCode = 400;
    throw error;
  }

  const poll = await prisma.poll.findFirst({
    where: { id: pId, instituteId },
    include: { _count: { select: { votes: true } } },
  });

  if (!poll) {
    const error = new Error('Poll not found.');
    error.statusCode = 404;
    throw error;
  }

  if ((poll._count?.votes || 0) > 0) {
    const error = new Error('This poll already has votes and cannot be permanently deleted. Archive it instead.');
    error.statusCode = 409;
    throw error;
  }

  await prisma.poll.delete({ where: { id: pId } });
  return { success: true, message: 'Poll deleted successfully.' };
}

/**
 * Admin: Get Overview Analytics & KPIs across all institute polls
 */
export async function getAdminOverallAnalytics(instituteId) {
  const polls = await prisma.poll.findMany({
    where: { instituteId },
    include: {
      _count: { select: { votes: true } },
    },
  });

  let totalPolls = polls.length;
  let activePolls = 0;
  let scheduledPolls = 0;
  let closedPolls = 0;
  let totalVotes = 0;

  polls.forEach((p) => {
    const derived = getAuthoritativePollStatus(p);
    if (derived === 'ACTIVE') activePolls++;
    else if (derived === 'SCHEDULED') scheduledPolls++;
    else if (derived === 'CLOSED') closedPolls++;

    totalVotes += p._count?.votes || 0;
  });

  return {
    totalPolls,
    activePolls,
    scheduledPolls,
    closedPolls,
    totalVotes,
  };
}

// =========================================================================
// RECIPIENT POLL FEED & VOTING (STUDENT / TEACHER / PARENT / ADMIN)
// =========================================================================

/**
 * Recipient: Get list of eligible polls with user's vote state & permissible results
 */
export async function getRecipientEligiblePolls(instituteId, user, filters = {}) {
  const { status = 'ACTIVE', page = 1, limit = 20 } = filters;

  // Retrieve published non-draft polls
  const polls = await prisma.poll.findMany({
    where: {
      instituteId,
      status: { notIn: ['DRAFT', 'ARCHIVED'] },
    },
    include: {
      options: {
        orderBy: { displayOrder: 'asc' },
        include: {
          _count: { select: { votes: true } },
        },
      },
      class: { select: { id: true, name: true, section: true } },
      votes: {
        where: { userId: user.id },
        select: { id: true, optionId: true, createdAt: true },
      },
      _count: { select: { votes: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Filter eligible polls for this user
  const eligiblePolls = [];

  for (const p of polls) {
    const isEligible = await checkUserPollEligibility(instituteId, p, user);
    if (isEligible) {
      const derivedStatus = getAuthoritativePollStatus(p);
      const userVote = p.votes?.[0] || null;
      const hasVoted = Boolean(userVote);
      const totalVotes = p._count?.votes || 0;

      // Determine result visibility permissions for this recipient
      let canViewResults = false;
      if (p.resultVisibility === 'LIVE') {
        canViewResults = true;
      } else if (p.resultVisibility === 'AFTER_VOTE' && hasVoted) {
        canViewResults = true;
      } else if (p.resultVisibility === 'AFTER_CLOSE' && derivedStatus === 'CLOSED') {
        canViewResults = true;
      }

      // Format options: mask vote counts if results not visible
      const formattedOptions = p.options.map((opt) => {
        const count = opt._count?.votes || 0;
        const pct = totalVotes > 0 ? parseFloat(((count / totalVotes) * 100).toFixed(1)) : 0;
        return {
          id: opt.id,
          text: opt.text,
          displayOrder: opt.displayOrder,
          voteCount: canViewResults ? count : undefined,
          percentage: canViewResults ? pct : undefined,
        };
      });

      eligiblePolls.push({
        id: p.id,
        title: p.title,
        description: p.description,
        audienceType: p.audienceType,
        class: p.class,
        status: derivedStatus,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        allowVoteChange: p.allowVoteChange,
        anonymous: p.anonymous,
        resultVisibility: p.resultVisibility,
        hasVoted,
        userVotedOptionId: userVote?.optionId || null,
        canViewResults,
        totalVotes: canViewResults ? totalVotes : undefined,
        options: formattedOptions,
        createdAt: p.createdAt,
      });
    }
  }

  // Filter by tab: 'ACTIVE', 'UPCOMING', 'COMPLETED'
  let filtered = eligiblePolls;
  if (status === 'ACTIVE') {
    filtered = eligiblePolls.filter((p) => p.status === 'ACTIVE');
  } else if (status === 'UPCOMING' || status === 'SCHEDULED') {
    filtered = eligiblePolls.filter((p) => p.status === 'SCHEDULED');
  } else if (status === 'COMPLETED' || status === 'CLOSED') {
    filtered = eligiblePolls.filter((p) => p.status === 'CLOSED');
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);
  const paginated = filtered.slice(skip, skip + take);

  return {
    total: filtered.length,
    page: parseInt(page, 10),
    limit: take,
    totalPages: Math.ceil(filtered.length / take) || 1,
    polls: paginated,
  };
}

/**
 * Recipient: Get single poll details and voting options
 */
export async function getRecipientPollDetails(instituteId, user, pollId) {
  const pId = parseInt(pollId, 10);
  const poll = await prisma.poll.findFirst({
    where: { id: pId, instituteId },
    include: {
      options: {
        orderBy: { displayOrder: 'asc' },
        include: {
          _count: { select: { votes: true } },
        },
      },
      class: { select: { id: true, name: true, section: true } },
      votes: {
        where: { userId: user.id },
        select: { id: true, optionId: true, createdAt: true },
      },
      _count: { select: { votes: true } },
    },
  });

  if (!poll) {
    throw new Error('Poll not found.');
  }

  const isEligible = await checkUserPollEligibility(instituteId, poll, user);
  if (!isEligible) {
    throw new Error('You are not eligible to participate in this poll.');
  }

  const derivedStatus = getAuthoritativePollStatus(poll);
  const userVote = poll.votes?.[0] || null;
  const hasVoted = Boolean(userVote);
  const totalVotes = poll._count?.votes || 0;

  // Determine result visibility permissions
  let canViewResults = false;
  if (poll.resultVisibility === 'LIVE') {
    canViewResults = true;
  } else if (poll.resultVisibility === 'AFTER_VOTE' && hasVoted) {
    canViewResults = true;
  } else if (poll.resultVisibility === 'AFTER_CLOSE' && derivedStatus === 'CLOSED') {
    canViewResults = true;
  }

  const formattedOptions = poll.options.map((opt) => {
    const count = opt._count?.votes || 0;
    const pct = totalVotes > 0 ? parseFloat(((count / totalVotes) * 100).toFixed(1)) : 0;
    return {
      id: opt.id,
      text: opt.text,
      displayOrder: opt.displayOrder,
      voteCount: canViewResults ? count : undefined,
      percentage: canViewResults ? pct : undefined,
    };
  });

  return {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    audienceType: poll.audienceType,
    class: poll.class,
    status: derivedStatus,
    startsAt: poll.startsAt,
    endsAt: poll.endsAt,
    allowVoteChange: poll.allowVoteChange,
    anonymous: poll.anonymous,
    resultVisibility: poll.resultVisibility,
    hasVoted,
    userVotedOptionId: userVote?.optionId || null,
    canViewResults,
    totalVotes: canViewResults ? totalVotes : undefined,
    options: formattedOptions,
    createdAt: poll.createdAt,
  };
}

/**
 * Recipient: Submit a Vote (Strict ONE USER = ONE VOTE Enforcement with atomic change rules)
 */
export async function submitVote(instituteId, user, pollId, optionId) {
  const pId = parseInt(pollId, 10);
  const optId = parseInt(optionId, 10);

  if (!optId) {
    throw new Error('Please select a voting option.');
  }

  const poll = await prisma.poll.findFirst({
    where: { id: pId, instituteId },
    include: {
      options: true,
    },
  });

  if (!poll) {
    throw new Error('Poll not found.');
  }

  // 1. Check user eligibility server-side
  const isEligible = await checkUserPollEligibility(instituteId, poll, user);
  if (!isEligible) {
    throw new Error('You are not eligible to vote in this poll.');
  }

  // 2. Authoritative status must be ACTIVE
  const derivedStatus = getAuthoritativePollStatus(poll);
  if (derivedStatus === 'DRAFT') {
    throw new Error('This poll is not published yet.');
  }
  if (derivedStatus === 'SCHEDULED') {
    throw new Error('This poll has not started yet.');
  }
  if (derivedStatus === 'CLOSED' || derivedStatus === 'ARCHIVED') {
    throw new Error('This poll is closed and no longer accepting votes.');
  }

  // 3. Verify option belongs to this poll and institute
  const validOption = poll.options.find((o) => o.id === optId);
  if (!validOption) {
    throw new Error('Selected option is not valid for this poll.');
  }

  // 4. Atomic Vote Submission / Change handling
  const voteResult = await prisma.$transaction(async (tx) => {
    // Check existing vote
    const existingVote = await tx.pollVote.findUnique({
      where: { pollId_userId: { pollId: pId, userId: user.id } },
    });

    if (existingVote) {
      if (!poll.allowVoteChange) {
        const err = new Error('You have already voted in this poll.');
        err.statusCode = 409;
        throw err;
      }

      // Update existing vote
      const updated = await tx.pollVote.update({
        where: { id: existingVote.id },
        data: {
          optionId: optId,
          updatedAt: new Date(),
        },
      });

      return {
        action: 'UPDATED',
        vote: updated,
      };
    }

    // Create fresh vote
    const created = await tx.pollVote.create({
      data: {
        pollId: pId,
        optionId: optId,
        userId: user.id,
        instituteId,
      },
    });

    return {
      action: 'CREATED',
      vote: created,
    };
  });

  return {
    success: true,
    message: voteResult.action === 'UPDATED' ? 'Your vote has been updated successfully.' : 'Your vote has been recorded successfully.',
    votedOptionId: optId,
  };
}
