import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma.js';
import { validateMessageAttachmentMagicBytes, PROTECTED_MESSAGE_DIR } from '../middleware/upload.middleware.js';

/**
 * Resolves the eligible recipient user IDs for a given audience specification within an institute.
 * Strictly filters by instituteId, isActive: true, and excludes SUPER_ADMIN.
 */
export async function resolveEligibleRecipients(instituteId, { audienceType, classId }) {
  const instId = parseInt(instituteId, 10);
  const parsedClassId = classId ? parseInt(classId, 10) : null;

  let userRecords = [];

  switch (audienceType) {
    case 'ALL_TEACHERS': {
      userRecords = await prisma.user.findMany({
        where: {
          instituteId: instId,
          role: 'TEACHER',
          isActive: true,
        },
        select: { id: true, role: true },
      });
      break;
    }

    case 'ALL_STUDENTS': {
      userRecords = await prisma.user.findMany({
        where: {
          instituteId: instId,
          role: 'STUDENT',
          isActive: true,
        },
        select: { id: true, role: true },
      });
      break;
    }

    case 'ALL_PARENTS': {
      userRecords = await prisma.user.findMany({
        where: {
          instituteId: instId,
          role: 'PARENT',
          isActive: true,
        },
        select: { id: true, role: true },
      });
      break;
    }

    case 'ALL_USERS': {
      userRecords = await prisma.user.findMany({
        where: {
          instituteId: instId,
          role: { in: ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] },
          isActive: true,
        },
        select: { id: true, role: true },
      });
      break;
    }

    case 'CLASS_STUDENTS': {
      if (!parsedClassId) {
        throw new Error('Class selection is required for Class Students audience.');
      }
      // Find students enrolled or assigned to this class
      const enrollments = await prisma.studentEnrollment.findMany({
        where: {
          instituteId: instId,
          classId: parsedClassId,
          status: 'ACTIVE',
        },
        include: {
          student: {
            include: { user: true },
          },
        },
      });

      // Also check Student.classId fallback
      const directStudents = await prisma.student.findMany({
        where: {
          instituteId: instId,
          classId: parsedClassId,
        },
        include: { user: true },
      });

      const userMap = new Map();
      enrollments.forEach((e) => {
        if (e.student?.user && e.student.user.isActive) {
          userMap.set(e.student.user.id, { id: e.student.user.id, role: 'STUDENT' });
        }
      });
      directStudents.forEach((s) => {
        if (s.user && s.user.isActive) {
          userMap.set(s.user.id, { id: s.user.id, role: 'STUDENT' });
        }
      });

      userRecords = Array.from(userMap.values());
      break;
    }

    case 'CLASS_TEACHERS': {
      if (!parsedClassId) {
        throw new Error('Class selection is required for Class Teachers audience.');
      }
      const assignments = await prisma.teacherAssignment.findMany({
        where: {
          instituteId: instId,
          classId: parsedClassId,
        },
        include: {
          teacher: {
            include: { user: true },
          },
        },
      });

      // Also check class teacher
      const classRecord = await prisma.class.findFirst({
        where: { id: parsedClassId, instituteId: instId },
        include: { classTeacher: { include: { user: true } } },
      });

      const teacherMap = new Map();
      assignments.forEach((a) => {
        if (a.teacher?.user && a.teacher.user.isActive) {
          teacherMap.set(a.teacher.user.id, { id: a.teacher.user.id, role: 'TEACHER' });
        }
      });
      if (classRecord?.classTeacher?.user && classRecord.classTeacher.user.isActive) {
        teacherMap.set(classRecord.classTeacher.user.id, {
          id: classRecord.classTeacher.user.id,
          role: 'TEACHER',
        });
      }

      userRecords = Array.from(teacherMap.values());
      break;
    }

    case 'CLASS_PARENTS': {
      if (!parsedClassId) {
        throw new Error('Class selection is required for Class Parents audience.');
      }
      // Find students in this class
      const enrollments = await prisma.studentEnrollment.findMany({
        where: {
          instituteId: instId,
          classId: parsedClassId,
          status: 'ACTIVE',
        },
        select: { studentId: true },
      });
      const directStudents = await prisma.student.findMany({
        where: { instituteId: instId, classId: parsedClassId },
        select: { id: true },
      });

      const studentIds = Array.from(
        new Set([...enrollments.map((e) => e.studentId), ...directStudents.map((s) => s.id)])
      );

      if (studentIds.length === 0) {
        userRecords = [];
      } else {
        const parentLinks = await prisma.parentStudent.findMany({
          where: {
            studentId: { in: studentIds },
          },
          include: {
            parent: {
              include: { user: true },
            },
          },
        });

        const parentMap = new Map();
        parentLinks.forEach((pl) => {
          if (pl.parent?.user && pl.parent.user.isActive && pl.parent.user.instituteId === instId) {
            parentMap.set(pl.parent.user.id, { id: pl.parent.user.id, role: 'PARENT' });
          }
        });
        userRecords = Array.from(parentMap.values());
      }
      break;
    }

    default:
      throw new Error(`Unsupported audience type: ${audienceType}`);
  }

  // Calculate role counts
  const roleCounts = {};
  userRecords.forEach((u) => {
    roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
  });

  return {
    recipientUserIds: userRecords.map((u) => u.id),
    recipientCount: userRecords.length,
    roleCounts,
  };
}

/**
 * Preview recipient count and role breakdown before sending broadcast.
 */
export async function previewAudience(instituteId, { audienceType, classId }) {
  if (!audienceType) {
    const error = new Error('Audience type is required.');
    error.status = 400;
    throw error;
  }

  const { recipientCount, roleCounts } = await resolveEligibleRecipients(instituteId, {
    audienceType,
    classId,
  });

  return {
    success: true,
    recipientCount,
    roleCounts,
  };
}

/**
 * Creates and delivers an Institute Admin Broadcast.
 */
export async function createBroadcast(instituteId, senderUser, { title, body, audienceType, classId, allowReplies, file }) {
  if (senderUser.role !== 'ADMIN') {
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    const error = new Error('Only Institute Administrators can send broadcast messages.');
    error.status = 403;
    throw error;
  }

  const cleanTitle = title ? String(title).trim() : '';
  const cleanBody = body ? String(body).trim() : '';

  if (!cleanTitle) {
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    const error = new Error('Broadcast title is required.');
    error.status = 400;
    throw error;
  }

  if (cleanTitle.length > 255) {
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    const error = new Error('Broadcast title cannot exceed 255 characters.');
    error.status = 400;
    throw error;
  }

  if (!cleanBody) {
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    const error = new Error('Broadcast message body is required.');
    error.status = 400;
    throw error;
  }

  if (cleanBody.length > 10000) {
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    const error = new Error('Broadcast message exceeds maximum length of 10,000 characters.');
    error.status = 400;
    throw error;
  }

  // Resolve eligible recipients
  const { recipientUserIds, recipientCount, roleCounts } = await resolveEligibleRecipients(
    instituteId,
    { audienceType, classId }
  );

  if (recipientCount === 0) {
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    const error = new Error('No eligible recipients were found for this broadcast.');
    error.status = 400;
    throw error;
  }

  // Validate magic bytes if attachment provided
  if (file) {
    const isValidMagic = validateMessageAttachmentMagicBytes(file.path);
    if (!isValidMagic) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      const error = new Error('Invalid attachment content or corrupted file.');
      error.status = 400;
      throw error;
    }
  }

  const parsedClassId = classId ? parseInt(classId, 10) : null;
  const parseAllowReplies = Boolean(allowReplies === true || allowReplies === 'true' || allowReplies === '1');

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create BroadcastMessage
      const broadcast = await tx.broadcastMessage.create({
        data: {
          instituteId,
          senderId: senderUser.id,
          title: cleanTitle,
          body: cleanBody,
          audienceType,
          classId: parsedClassId,
          allowReplies: parseAllowReplies,
          status: 'SENT',
          recipientCount,
        },
      });

      // 2. Create Attachment if present
      let attachment = null;
      if (file) {
        attachment = await tx.broadcastAttachment.create({
          data: {
            instituteId,
            broadcastId: broadcast.id,
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            fileSize: file.size,
            filePath: file.path,
          },
        });
      }

      // 3. Create BroadcastRecipient records
      const recipientData = recipientUserIds.map((uId) => ({
        broadcastId: broadcast.id,
        userId: uId,
        readAt: null,
        isArchived: false,
        isDeleted: false,
      }));

      await tx.broadcastRecipient.createMany({
        data: recipientData,
        skipDuplicates: true,
      });

      return { broadcast, attachment };
    });

    // 4. Dispatch Notifications in batches (best effort)
    try {
      const notifData = recipientUserIds.map((uId) => ({
        instituteId,
        userId: uId,
        title: `New Institute Broadcast: ${cleanTitle}`,
        message: cleanBody.length > 80 ? `${cleanBody.slice(0, 77)}...` : cleanBody,
        link: `/messages`,
        isRead: false,
      }));

      // Split into batches of 200 for safety
      for (let i = 0; i < notifData.length; i += 200) {
        await prisma.notification.createMany({
          data: notifData.slice(i, i + 200),
          skipDuplicates: true,
        });
      }
    } catch (notifErr) {
      console.warn('Broadcast notification creation failed:', notifErr.message);
    }

    return {
      success: true,
      broadcastId: result.broadcast.id,
      recipientCount,
      roleCounts,
      title: result.broadcast.title,
      createdAt: result.broadcast.createdAt,
    };
  } catch (err) {
    if (file?.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (e) {}
    }
    throw err;
  }
}

/**
 * List broadcasts created by Admin for management.
 */
export async function listAdminBroadcasts(instituteId, adminUserId, { filter, search, page = 1, limit = 20 }) {
  const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

  const whereClause = {
    instituteId,
  };

  if (filter === 'sent') {
    whereClause.status = 'SENT';
  } else if (filter === 'withdrawn') {
    whereClause.status = 'WITHDRAWN';
  }

  if (search && String(search).trim()) {
    const q = String(search).trim();
    whereClause.OR = [
      { title: { contains: q } },
      { body: { contains: q } },
    ];
  }

  const [total, broadcasts] = await Promise.all([
    prisma.broadcastMessage.count({ where: whereClause }),
    prisma.broadcastMessage.findMany({
      where: whereClause,
      include: {
        sender: {
          select: { id: true, username: true, email: true, role: true },
        },
        class: {
          select: { id: true, name: true, section: true },
        },
        attachments: {
          select: { id: true, originalName: true, mimeType: true, fileSize: true, createdAt: true },
        },
        recipients: {
          select: { readAt: true, user: { select: { role: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
  ]);

  const formatted = broadcasts.map((b) => {
    const totalRecipients = b.recipients.length;
    const readCount = b.recipients.filter((r) => r.readAt !== null).length;
    const unreadCount = totalRecipients - readCount;

    // Role breakdown
    const roleCounts = {};
    b.recipients.forEach((r) => {
      const rRole = r.user?.role || 'UNKNOWN';
      roleCounts[rRole] = (roleCounts[rRole] || 0) + 1;
    });

    return {
      id: b.id,
      title: b.title,
      body: b.body,
      audienceType: b.audienceType,
      class: b.class ? `${b.class.name}${b.class.section ? ` (${b.class.section})` : ''}` : null,
      classId: b.classId,
      allowReplies: b.allowReplies,
      status: b.status,
      recipientCount: totalRecipients,
      readCount,
      unreadCount,
      roleCounts,
      attachments: b.attachments,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      sender: {
        id: b.sender.id,
        username: b.sender.username,
        role: b.sender.role,
      },
    };
  });

  return {
    success: true,
    total,
    page: Math.max(parseInt(page, 10) || 1, 1),
    limit: take,
    broadcasts: formatted,
  };
}

/**
 * List broadcasts delivered to a recipient user.
 */
export async function listUserBroadcasts(instituteId, userId, { filter = 'all', search = '', page = 1, limit = 20 }) {
  const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

  const whereClause = {
    userId,
    isDeleted: false,
    broadcast: {
      instituteId,
      status: 'SENT',
    },
  };

  if (filter === 'unread') {
    whereClause.readAt = null;
  } else if (filter === 'archived') {
    whereClause.isArchived = true;
  } else {
    whereClause.isArchived = false;
  }

  if (search && String(search).trim()) {
    const q = String(search).trim();
    whereClause.broadcast = {
      ...whereClause.broadcast,
      OR: [
        { title: { contains: q } },
        { body: { contains: q } },
      ],
    };
  }

  const [total, recipientRecords] = await Promise.all([
    prisma.broadcastRecipient.count({ where: whereClause }),
    prisma.broadcastRecipient.findMany({
      where: whereClause,
      include: {
        broadcast: {
          include: {
            sender: {
              select: { id: true, username: true, role: true },
            },
            class: {
              select: { id: true, name: true, section: true },
            },
            attachments: {
              select: { id: true, originalName: true, mimeType: true, fileSize: true, createdAt: true },
            },
          },
        },
      },
      orderBy: { broadcast: { createdAt: 'desc' } },
      take,
      skip,
    }),
  ]);

  const formatted = recipientRecords.map((r) => {
    const b = r.broadcast;
    return {
      recipientRecordId: r.id,
      broadcastId: b.id,
      title: b.title,
      body: b.body,
      audienceType: b.audienceType,
      class: b.class ? `${b.class.name}${b.class.section ? ` (${b.class.section})` : ''}` : null,
      allowReplies: b.allowReplies,
      senderAdminId: b.senderId,
      senderAdminName: 'Institute Administration',
      attachments: b.attachments.map((att) => ({
        ...att,
        isImage: att.mimeType.startsWith('image/'),
      })),
      isRead: Boolean(r.readAt),
      readAt: r.readAt,
      isArchived: r.isArchived,
      createdAt: b.createdAt,
    };
  });

  return {
    success: true,
    total,
    page: Math.max(parseInt(page, 10) || 1, 1),
    limit: take,
    broadcasts: formatted,
  };
}

/**
 * Get single broadcast detail and mark read for recipient.
 */
export async function getBroadcastDetail(instituteId, userId, userRole, broadcastId) {
  const bId = parseInt(broadcastId, 10);
  if (!bId || isNaN(bId)) {
    const error = new Error('Invalid broadcast ID.');
    error.status = 400;
    throw error;
  }

  const broadcast = await prisma.broadcastMessage.findFirst({
    where: { id: bId, instituteId },
    include: {
      sender: { select: { id: true, username: true, role: true } },
      class: { select: { id: true, name: true, section: true } },
      attachments: {
        select: { id: true, originalName: true, mimeType: true, fileSize: true, createdAt: true },
      },
      recipients: userRole === 'ADMIN' ? {
        select: { readAt: true, user: { select: { role: true } } },
      } : false,
    },
  });

  if (!broadcast) {
    const error = new Error('Broadcast message not found.');
    error.status = 404;
    throw error;
  }

  if (userRole === 'ADMIN') {
    const totalRecipients = broadcast.recipients.length;
    const readCount = broadcast.recipients.filter((r) => r.readAt !== null).length;
    const unreadCount = totalRecipients - readCount;

    return {
      success: true,
      broadcast: {
        id: broadcast.id,
        title: broadcast.title,
        body: broadcast.body,
        audienceType: broadcast.audienceType,
        class: broadcast.class ? `${broadcast.class.name}${broadcast.class.section ? ` (${broadcast.class.section})` : ''}` : null,
        allowReplies: broadcast.allowReplies,
        status: broadcast.status,
        recipientCount: totalRecipients,
        readCount,
        unreadCount,
        attachments: broadcast.attachments.map((att) => ({
          ...att,
          isImage: att.mimeType.startsWith('image/'),
        })),
        createdAt: broadcast.createdAt,
      },
    };
  }

  // Recipient view
  const recipientRecord = await prisma.BroadcastRecipient.findFirst({
    where: { broadcastId: bId, userId, isDeleted: false },
  });

  if (!recipientRecord || broadcast.status === 'WITHDRAWN') {
    const error = new Error('Broadcast not found or has been withdrawn.');
    error.status = 404;
    throw error;
  }

  // Mark read if unread
  if (!recipientRecord.readAt) {
    await prisma.BroadcastRecipient.update({
      where: { id: recipientRecord.id },
      data: { readAt: new Date() },
    });
  }

  return {
    success: true,
    broadcast: {
      id: broadcast.id,
      title: broadcast.title,
      body: broadcast.body,
      audienceType: broadcast.audienceType,
      class: broadcast.class ? `${broadcast.class.name}${broadcast.class.section ? ` (${broadcast.class.section})` : ''}` : null,
      allowReplies: broadcast.allowReplies,
      senderAdminId: broadcast.senderId,
      senderAdminName: 'Institute Administration',
      attachments: broadcast.attachments.map((att) => ({
        ...att,
        isImage: att.mimeType.startsWith('image/'),
      })),
      isRead: true,
      createdAt: broadcast.createdAt,
    },
  };
}

/**
 * Mark a broadcast as read by a recipient.
 */
export async function markBroadcastRead(instituteId, userId, broadcastId) {
  const bId = parseInt(broadcastId, 10);
  const recipientRecord = await prisma.BroadcastRecipient.findFirst({
    where: {
      broadcastId: bId,
      userId,
      broadcast: { instituteId },
    },
  });

  if (!recipientRecord) {
    const error = new Error('Broadcast recipient record not found.');
    error.status = 404;
    throw error;
  }

  if (!recipientRecord.readAt) {
    await prisma.BroadcastRecipient.update({
      where: { id: recipientRecord.id },
      data: { readAt: new Date() },
    });
  }

  return { success: true };
}

/**
 * Archive / Unarchive broadcast for user.
 */
export async function archiveBroadcastForUser(instituteId, userId, broadcastId, isArchived) {
  const bId = parseInt(broadcastId, 10);
  const recipientRecord = await prisma.BroadcastRecipient.findFirst({
    where: {
      broadcastId: bId,
      userId,
      broadcast: { instituteId },
    },
  });

  if (!recipientRecord) {
    const error = new Error('Broadcast not found.');
    error.status = 404;
    throw error;
  }

  await prisma.BroadcastRecipient.update({
    where: { id: recipientRecord.id },
    data: { isArchived: Boolean(isArchived) },
  });

  return { success: true, isArchived: Boolean(isArchived) };
}

/**
 * Soft delete / Hide broadcast for user.
 */
export async function deleteBroadcastForUser(instituteId, userId, broadcastId) {
  const bId = parseInt(broadcastId, 10);
  const recipientRecord = await prisma.BroadcastRecipient.findFirst({
    where: {
      broadcastId: bId,
      userId,
      broadcast: { instituteId },
    },
  });

  if (!recipientRecord) {
    const error = new Error('Broadcast not found.');
    error.status = 404;
    throw error;
  }

  await prisma.BroadcastRecipient.update({
    where: { id: recipientRecord.id },
    data: { isDeleted: true },
  });

  return { success: true };
}

/**
 * Admin withdraws broadcast (prevents recipient access).
 */
export async function withdrawBroadcast(instituteId, adminUserId, broadcastId) {
  const bId = parseInt(broadcastId, 10);
  const broadcast = await prisma.broadcastMessage.findFirst({
    where: { id: bId, instituteId },
  });

  if (!broadcast) {
    const error = new Error('Broadcast not found.');
    error.status = 404;
    throw error;
  }

  await prisma.broadcastMessage.update({
    where: { id: bId },
    data: { status: 'WITHDRAWN' },
  });

  return { success: true, message: 'Broadcast withdrawn successfully.' };
}

/**
 * Authenticated protected attachment streaming for Broadcasts.
 */
export async function getBroadcastAttachmentStream(instituteId, userId, userRole, attachmentId) {
  const attId = parseInt(attachmentId, 10);
  if (!attId || isNaN(attId)) {
    const error = new Error('Invalid attachment ID.');
    error.status = 400;
    throw error;
  }

  const attachment = await prisma.broadcastAttachment.findFirst({
    where: {
      id: attId,
      instituteId,
    },
    include: {
      broadcast: {
        include: {
          recipients: {
            where: { userId },
          },
        },
      },
    },
  });

  if (!attachment) {
    const error = new Error('Attachment not found.');
    error.status = 404;
    throw error;
  }

  // Check authorization: User is Admin sender OR is a valid recipient of this broadcast
  const isSender = attachment.broadcast.senderId === userId || userRole === 'ADMIN';
  const isRecipient = attachment.broadcast.recipients.length > 0;

  if (!isSender && !isRecipient) {
    const error = new Error('You are not authorized to access this attachment.');
    error.status = 403;
    throw error;
  }

  if (!attachment.filePath || !fs.existsSync(attachment.filePath)) {
    const error = new Error('File not found on server disk.');
    error.status = 404;
    throw error;
  }

  return {
    filePath: attachment.filePath,
    mimeType: attachment.mimeType,
    originalName: attachment.originalName,
    fileSize: attachment.fileSize,
  };
}
