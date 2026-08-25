import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma.js';
import { validateUserCanMessage, getAllowedRecipients, formatRecipientInfo } from './messageRelationship.service.js';
import { validateMessageAttachmentMagicBytes } from '../middleware/upload.middleware.js';

/**
 * Creates or reuses a direct conversation and appends the initial message.
 */
export async function createConversation(instituteId, senderUser, { recipientId, subject = '', body, file, replyToMessageId }) {
  const targetRecipientId = parseInt(recipientId, 10);
  if (!targetRecipientId || isNaN(targetRecipientId)) {
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    const error = new Error('Valid recipient ID is required.');
    error.status = 400;
    throw error;
  }

  const cleanBody = body ? String(body).trim() : '';
  if (!cleanBody && !file) {
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    const error = new Error('Message body or attachment is required.');
    error.status = 400;
    throw error;
  }

  if (cleanBody.length > 5000) {
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    const error = new Error('Message body exceeds maximum length of 5000 characters.');
    error.status = 400;
    throw error;
  }

  // Server-side relationship and role verification
  const check = await validateUserCanMessage(instituteId, senderUser, targetRecipientId);
  if (!check.allowed) {
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    const error = new Error(check.reason || 'You are not permitted to message this recipient.');
    error.status = 403;
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

  try {
    // Check if an existing DIRECT conversation exists between this pair
    const existingDirect = await prisma.conversation.findFirst({
      where: {
        instituteId,
        type: 'DIRECT',
        AND: [
          { participants: { some: { userId: senderUser.id } } },
          { participants: { some: { userId: targetRecipientId } } },
        ],
      },
      include: {
        participants: true,
      },
    });

    const now = new Date();

    if (existingDirect) {
      // Reuse existing direct conversation
      const conversationId = existingDirect.id;

      const result = await prisma.$transaction(async (tx) => {
        // Restore participant visibility (un-delete and un-archive for sender)
        await tx.conversationParticipant.updateMany({
          where: { conversationId, userId: senderUser.id },
          data: { isDeleted: false, isArchived: false, lastReadAt: now, updatedAt: now },
        });

        // Restore recipient visibility if they had soft-deleted
        await tx.conversationParticipant.updateMany({
          where: { conversationId, userId: targetRecipientId },
          data: { isDeleted: false, updatedAt: now },
        });

        // Update conversation timestamp
        await tx.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: now, updatedAt: now },
        });

        // Create Message
        const message = await tx.message.create({
          data: {
            instituteId,
            conversationId,
            senderId: senderUser.id,
            body: cleanBody,
            replyToMessageId: replyToMessageId ? parseInt(replyToMessageId, 10) : null,
          },
        });

        // Attach file metadata if present
        let attachment = null;
        if (file) {
          attachment = await tx.messageAttachment.create({
            data: {
              instituteId,
              messageId: message.id,
              originalName: file.originalname,
              storedName: file.filename,
              mimeType: file.mimetype,
              fileSize: file.size,
              filePath: file.path,
            },
          });
        }

        return { conversation: existingDirect, message, attachment };
      });

      // Best-effort Notification dispatch
      try {
        const senderName = senderUser.teacher?.name || senderUser.student?.name || senderUser.parent?.name || senderUser.name || senderUser.username || 'User';
        await prisma.notification.create({
          data: {
            instituteId,
            userId: targetRecipientId,
            title: `New message from ${senderName}`,
            message: cleanBody.length > 80 ? `${cleanBody.slice(0, 77)}...` : cleanBody || 'Sent an attachment',
            link: `/messages/${conversationId}`,
            isRead: false,
          },
        });
      } catch (notifErr) {
        console.warn('Failed to create message notification:', notifErr.message);
      }

      return {
        success: true,
        conversationId: existingDirect.id,
        messageId: result.message.id,
        isReused: true,
      };
    }

    // Create New Conversation in a single ACID transaction
    const result = await prisma.$transaction(async (tx) => {
      const conv = await tx.conversation.create({
        data: {
          instituteId,
          type: 'DIRECT',
          subject: subject?.trim() || null,
          createdById: senderUser.id,
          lastMessageAt: now,
        },
      });

      // Sender Participant (already read up to now)
      await tx.conversationParticipant.create({
        data: {
          conversationId: conv.id,
          userId: senderUser.id,
          joinedAt: now,
          lastReadAt: now,
          isArchived: false,
          isDeleted: false,
        },
      });

      // Recipient Participant (unread: lastReadAt set prior to message creation)
      await tx.conversationParticipant.create({
        data: {
          conversationId: conv.id,
          userId: targetRecipientId,
          joinedAt: now,
          lastReadAt: new Date(0), // Epoch ensures initial message is marked unread
          isArchived: false,
          isDeleted: false,
        },
      });

      // Create Message
      const message = await tx.message.create({
        data: {
          instituteId,
          conversationId: conv.id,
          senderId: senderUser.id,
          body: cleanBody,
          replyToMessageId: replyToMessageId ? parseInt(replyToMessageId, 10) : null,
        },
      });

      // Create Attachment if present
      let attachment = null;
      if (file) {
        attachment = await tx.messageAttachment.create({
          data: {
            instituteId,
            messageId: message.id,
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            fileSize: file.size,
            filePath: file.path,
          },
        });
      }

      return { conversation: conv, message, attachment };
    });

    // Best-effort Notification dispatch
    try {
      const senderName = senderUser.teacher?.name || senderUser.student?.name || senderUser.parent?.name || senderUser.name || senderUser.username || 'User';
      await prisma.notification.create({
        data: {
          instituteId,
          userId: targetRecipientId,
          title: `New message from ${senderName}`,
          message: cleanBody.length > 80 ? `${cleanBody.slice(0, 77)}...` : cleanBody || 'Sent an attachment',
          link: `/messages/${result.conversation.id}`,
          isRead: false,
        },
      });
    } catch (notifErr) {
      console.warn('Failed to create message notification:', notifErr.message);
    }

    return {
      success: true,
      conversationId: result.conversation.id,
      messageId: result.message.id,
      isReused: false,
    };
  } catch (dbErr) {
    if (file?.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (e) { /* ignore */ }
    }
    throw dbErr;
  }
}

/**
 * Appends a reply message to an existing conversation.
 */
export async function sendReply(instituteId, senderUser, conversationId, { body, file, replyToMessageId }) {
  const convId = parseInt(conversationId, 10);
  if (!convId || isNaN(convId)) {
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    const error = new Error('Invalid conversation ID.');
    error.status = 400;
    throw error;
  }

  const cleanBody = body ? String(body).trim() : '';
  if (!cleanBody && !file) {
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    const error = new Error('Message body or attachment is required.');
    error.status = 400;
    throw error;
  }

  if (cleanBody.length > 5000) {
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    const error = new Error('Message body exceeds maximum length of 5000 characters.');
    error.status = 400;
    throw error;
  }

  // Verify sender is participant in this conversation and same tenant
  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId: convId,
      userId: senderUser.id,
      conversation: { instituteId },
    },
    include: {
      conversation: {
        include: {
          participants: {
            include: { user: true },
          },
        },
      },
    },
  });

  if (!participant) {
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    const error = new Error('Conversation not found or access denied.');
    error.status = 404;
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

  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Restore sender visibility & update lastReadAt
      await tx.conversationParticipant.update({
        where: { id: participant.id },
        data: { isDeleted: false, isArchived: false, lastReadAt: now, updatedAt: now },
      });

      // Restore other participants' isDeleted flag so new incoming message is visible
      await tx.conversationParticipant.updateMany({
        where: {
          conversationId: convId,
          userId: { not: senderUser.id },
        },
        data: { isDeleted: false, updatedAt: now },
      });

      // Update conversation timestamp
      await tx.conversation.update({
        where: { id: convId },
        data: { lastMessageAt: now, updatedAt: now },
      });

      // Create reply Message
      const message = await tx.message.create({
        data: {
          instituteId,
          conversationId: convId,
          senderId: senderUser.id,
          body: cleanBody,
          replyToMessageId: replyToMessageId ? parseInt(replyToMessageId, 10) : null,
        },
        include: {
          sender: true,
          attachments: true,
          replyToMessage: {
            include: { sender: true },
          },
        },
      });

      // Create Attachment if present
      let attachment = null;
      if (file) {
        attachment = await tx.messageAttachment.create({
          data: {
            instituteId,
            messageId: message.id,
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            fileSize: file.size,
            filePath: file.path,
          },
        });
      }

      return { message, attachment };
    });

    // Notify other participants
    const otherParticipants = participant.conversation.participants.filter((p) => p.userId !== senderUser.id);
    for (const p of otherParticipants) {
      try {
        const senderName = senderUser.teacher?.name || senderUser.student?.name || senderUser.parent?.name || senderUser.name || senderUser.username || 'User';
        await prisma.notification.create({
          data: {
            instituteId,
            userId: p.userId,
            title: `New message from ${senderName}`,
            message: cleanBody.length > 80 ? `${cleanBody.slice(0, 77)}...` : cleanBody || 'Sent an attachment',
            link: `/messages/${convId}`,
            isRead: false,
          },
        });
      } catch (e) {
        // best effort notification
      }
    }

    return {
      success: true,
      messageId: result.message.id,
      message: formatMessageRecord(result.message, senderUser.id),
    };
  } catch (dbErr) {
    if (file?.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (e) { /* ignore */ }
    }
    throw dbErr;
  }
}

/**
 * Lists conversations for the authenticated user with unread counts and participant info.
 */
export async function listConversations(instituteId, userId, { page = 1, limit = 20, filter = 'all', search = '' }) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.max(1, Math.min(50, parseInt(limit, 10) || 20));
  const searchTerm = search?.trim().toLowerCase() || '';

  // Base participant query: must be this user, non-deleted, and matching archive filter
  const participantWhere = {
    userId,
    isDeleted: false,
    conversation: { instituteId },
  };

  if (filter === 'archived') {
    participantWhere.isArchived = true;
  } else {
    participantWhere.isArchived = false;
  }

  // Search filter matching subject, message body, or other participant's name/username
  if (searchTerm) {
    participantWhere.conversation.OR = [
      { subject: { contains: searchTerm } },
      { messages: { some: { body: { contains: searchTerm } } } },
      {
        participants: {
          some: {
            userId: { not: userId },
            user: {
              OR: [
                { username: { contains: searchTerm } },
                { email: { contains: searchTerm } },
                { teacher: { name: { contains: searchTerm } } },
                { student: { name: { contains: searchTerm } } },
                { parent: { name: { contains: searchTerm } } },
              ],
            },
          },
        },
      },
    ];
  }

  // Fetch participant records ordered by conversation's lastMessageAt DESC
  const [participantRecords, totalCount] = await Promise.all([
    prisma.conversationParticipant.findMany({
      where: participantWhere,
      take: l,
      skip: (p - 1) * l,
      orderBy: { conversation: { lastMessageAt: 'desc' } },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  include: {
                    teacher: true,
                    student: { include: { class: true } },
                    parent: {
                      include: {
                        students: {
                          include: {
                            student: { include: { class: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              include: {
                sender: true,
                attachments: true,
              },
            },
          },
        },
      },
    }),
    prisma.conversationParticipant.count({ where: participantWhere }),
  ]);

  // Compute unread count for each conversation
  const formattedConversations = await Promise.all(
    participantRecords.map(async (part) => {
      const conv = part.conversation;
      const otherPart = conv.participants.find((cp) => cp.userId !== userId);
      const otherUser = otherPart?.user ? formatRecipientInfo(otherPart.user) : null;
      const lastMsg = conv.messages?.[0] || null;

      // Unread count: messages created after part.lastReadAt and sent by someone else
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conv.id,
          senderId: { not: userId },
          createdAt: { gt: part.lastReadAt },
        },
      });

      return {
        id: conv.id,
        type: conv.type,
        subject: conv.subject,
        lastMessageAt: conv.lastMessageAt,
        isArchived: part.isArchived,
        unreadCount,
        otherParticipant: otherUser,
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              senderId: lastMsg.senderId,
              senderName: lastMsg.sender?.username || 'User',
              body: lastMsg.deletedAt ? 'Message deleted' : lastMsg.body,
              hasAttachment: (lastMsg.attachments?.length || 0) > 0,
              createdAt: lastMsg.createdAt,
            }
          : null,
      };
    })
  );

  // If filter === 'unread', only return items with unreadCount > 0
  let finalItems = formattedConversations;
  if (filter === 'unread') {
    finalItems = formattedConversations.filter((c) => c.unreadCount > 0);
  }

  return {
    conversations: finalItems,
    pagination: {
      page: p,
      limit: l,
      total: totalCount,
      totalPages: Math.ceil(totalCount / l),
    },
  };
}

/**
 * Returns a conversation thread and marks it as read for the requesting participant.
 */
export async function getConversationThread(instituteId, userId, conversationId, { page = 1, limit = 50 }) {
  const convId = parseInt(conversationId, 10);
  if (!convId || isNaN(convId)) {
    const error = new Error('Invalid conversation ID.');
    error.status = 400;
    throw error;
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));

  // Verify participant membership
  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId: convId,
      userId,
      conversation: { instituteId },
    },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                include: {
                  teacher: true,
                  student: { include: { class: true } },
                  parent: {
                    include: {
                      students: {
                        include: {
                          student: { include: { class: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!participant) {
    const error = new Error('Conversation not found or access denied.');
    error.status = 404;
    throw error;
  }

  // Mark conversation as read
  const now = new Date();
  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { lastReadAt: now, isDeleted: false },
  });

  // Fetch paginated messages
  const [messages, totalMessages] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId: convId },
      take: l,
      skip: (p - 1) * l,
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          include: {
            teacher: true,
            student: true,
            parent: true,
          },
        },
        attachments: true,
        replyToMessage: {
          include: {
            sender: true,
          },
        },
      },
    }),
    prisma.message.count({ where: { conversationId: convId } }),
  ]);

  const conv = participant.conversation;
  const otherPart = conv.participants.find((cp) => cp.userId !== userId);
  const otherUser = otherPart?.user ? formatRecipientInfo(otherPart.user) : null;

  return {
    conversation: {
      id: conv.id,
      type: conv.type,
      subject: conv.subject,
      lastMessageAt: conv.lastMessageAt,
      isArchived: participant.isArchived,
      otherParticipant: otherUser,
      otherParticipantLastReadAt: otherPart?.lastReadAt || null,
      participants: conv.participants.map((cp) => ({
        id: cp.id,
        userId: cp.userId,
        lastReadAt: cp.lastReadAt,
        user: cp.user ? formatRecipientInfo(cp.user) : null,
      })),
    },
    messages: messages.map((m) => formatMessageRecord(m, userId, otherPart?.lastReadAt)),
    pagination: {
      page: p,
      limit: l,
      total: totalMessages,
      totalPages: Math.ceil(totalMessages / l),
    },
  };
}

/**
 * Updates participant's lastReadAt timestamp.
 */
export async function markConversationRead(instituteId, userId, conversationId) {
  const convId = parseInt(conversationId, 10);
  if (!convId || isNaN(convId)) {
    const error = new Error('Invalid conversation ID.');
    error.status = 400;
    throw error;
  }

  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId: convId,
      userId,
      conversation: { instituteId },
    },
  });

  if (!participant) {
    const error = new Error('Conversation not found.');
    error.status = 404;
    throw error;
  }

  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { lastReadAt: new Date() },
  });

  return { success: true };
}

/**
 * Computes global total unread message and broadcast count across all active conversations.
 */
export async function getGlobalUnreadCount(instituteId, userId) {
  const activeParticipants = await prisma.conversationParticipant.findMany({
    where: {
      userId,
      isDeleted: false,
      conversation: { instituteId },
    },
    select: {
      conversationId: true,
      lastReadAt: true,
    },
  });

  let directUnread = 0;
  for (const part of activeParticipants) {
    const count = await prisma.message.count({
      where: {
        conversationId: part.conversationId,
        senderId: { not: userId },
        createdAt: { gt: part.lastReadAt },
      },
    });
    directUnread += count;
  }

  // Count unread broadcasts
  const broadcastUnread = await prisma.broadcastRecipient.count({
    where: {
      userId,
      isDeleted: false,
      readAt: null,
      broadcast: {
        instituteId,
        status: 'SENT',
      },
    },
  });

  return {
    unreadCount: directUnread + broadcastUnread,
    directUnreadCount: directUnread,
    broadcastUnreadCount: broadcastUnread,
  };
}

/**
 * Toggles archive state for current participant only.
 */
export async function archiveConversation(instituteId, userId, conversationId, isArchived) {
  const convId = parseInt(conversationId, 10);
  if (!convId || isNaN(convId)) {
    const error = new Error('Invalid conversation ID.');
    error.status = 400;
    throw error;
  }

  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId: convId,
      userId,
      conversation: { instituteId },
    },
  });

  if (!participant) {
    const error = new Error('Conversation not found.');
    error.status = 404;
    throw error;
  }

  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { isArchived: Boolean(isArchived) },
  });

  return { success: true, isArchived: Boolean(isArchived) };
}

/**
 * Soft deletes/hides conversation for current participant only.
 */
export async function deleteConversationForUser(instituteId, userId, conversationId) {
  const convId = parseInt(conversationId, 10);
  if (!convId || isNaN(convId)) {
    const error = new Error('Invalid conversation ID.');
    error.status = 400;
    throw error;
  }

  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId: convId,
      userId,
      conversation: { instituteId },
    },
  });

  if (!participant) {
    const error = new Error('Conversation not found.');
    error.status = 404;
    throw error;
  }

  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { isDeleted: true },
  });

  return { success: true };
}

/**
 * Sender edits their own message.
 */
export async function editMessage(instituteId, userId, messageId, newBody) {
  const msgId = parseInt(messageId, 10);
  const cleanBody = newBody ? String(newBody).trim() : '';

  if (!cleanBody) {
    const error = new Error('Message body cannot be empty.');
    error.status = 400;
    throw error;
  }

  const message = await prisma.message.findFirst({
    where: {
      id: msgId,
      instituteId,
    },
  });

  if (!message) {
    const error = new Error('Message not found.');
    error.status = 404;
    throw error;
  }

  if (message.senderId !== userId) {
    const error = new Error('You can only edit your own messages.');
    error.status = 403;
    throw error;
  }

  if (message.deletedAt) {
    const error = new Error('Cannot edit a deleted message.');
    error.status = 400;
    throw error;
  }

  const updated = await prisma.message.update({
    where: { id: msgId },
    data: {
      body: cleanBody,
      editedAt: new Date(),
    },
  });

  return {
    success: true,
    messageId: updated.id,
    body: updated.body,
    editedAt: updated.editedAt,
  };
}

/**
 * Sender soft-deletes their own message.
 */
export async function deleteMessage(instituteId, userId, messageId) {
  const msgId = parseInt(messageId, 10);

  const message = await prisma.message.findFirst({
    where: {
      id: msgId,
      instituteId,
    },
  });

  if (!message) {
    const error = new Error('Message not found.');
    error.status = 404;
    throw error;
  }

  if (message.senderId !== userId) {
    const error = new Error('You can only delete your own messages.');
    error.status = 403;
    throw error;
  }

  const updated = await prisma.message.update({
    where: { id: msgId },
    data: {
      deletedAt: new Date(),
      body: 'This message was deleted',
    },
  });

  return {
    success: true,
    messageId: updated.id,
    deletedAt: updated.deletedAt,
  };
}

/**
 * Returns protected file attachment stream and metadata.
 */
export async function getAttachmentStream(instituteId, userId, attachmentId) {
  const attId = parseInt(attachmentId, 10);
  if (!attId || isNaN(attId)) {
    const error = new Error('Invalid attachment ID.');
    error.status = 400;
    throw error;
  }

  const attachment = await prisma.messageAttachment.findFirst({
    where: {
      id: attId,
      instituteId,
    },
    include: {
      message: {
        include: {
          conversation: {
            include: {
              participants: true,
            },
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

  // Verify requesting user is participant in conversation
  const isParticipant = attachment.message.conversation.participants.some((p) => p.userId === userId);
  if (!isParticipant) {
    const error = new Error('You do not have permission to access this attachment.');
    error.status = 403;
    throw error;
  }

  // Block download if message was soft-deleted
  if (attachment.message.deletedAt) {
    const error = new Error('This attachment was deleted.');
    error.status = 404;
    throw error;
  }

  if (!fs.existsSync(attachment.filePath)) {
    const error = new Error('Attachment file missing on server storage.');
    error.status = 404;
    throw error;
  }

  return {
    filePath: attachment.filePath,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    fileSize: attachment.fileSize,
  };
}

/**
 * Normalizes message record for API output
 */
function formatMessageRecord(m, currentUserId, otherLastReadAt = null) {
  const isMine = m.senderId === currentUserId;
  const isDeleted = Boolean(m.deletedAt);
  const isReadByRecipient = isMine && otherLastReadAt && new Date(m.createdAt) <= new Date(otherLastReadAt);

  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    sender: m.sender ? formatRecipientInfo(m.sender) : null,
    isMine,
    body: isDeleted ? 'This message was deleted' : m.body,
    isDeleted,
    isEdited: Boolean(m.editedAt),
    editedAt: m.editedAt,
    createdAt: m.createdAt,
    status: isMine ? (isReadByRecipient ? 'READ' : 'SENT') : null,
    replyTo: m.replyToMessage
      ? {
          id: m.replyToMessage.id,
          senderName: m.replyToMessage.sender?.username || 'User',
          body: m.replyToMessage.deletedAt ? 'Message deleted' : m.replyToMessage.body,
        }
      : null,
    attachments: isDeleted
      ? []
      : (m.attachments || []).map((att) => ({
          id: att.id,
          originalName: att.originalName,
          mimeType: att.mimeType,
          fileSize: att.fileSize,
          isImage: att.mimeType.startsWith('image/'),
          isPdf: att.mimeType === 'application/pdf',
        })),
  };
}
