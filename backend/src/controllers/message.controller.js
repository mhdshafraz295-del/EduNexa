import path from 'path';
import * as messageService from '../services/message.service.js';
import * as relationshipService from '../services/messageRelationship.service.js';
import { getStorageResource } from '../services/storage/storageResolver.js';

export const getRecipients = async (req, res, next) => {
  try {
    const { search, role, page, limit } = req.query;
    const data = await relationshipService.getAllowedRecipients(req.instituteId, req.user, {
      search,
      role,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 50,
    });
    res.json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
};

export const createConversation = async (req, res, next) => {
  try {
    const { recipientId, subject, body, replyToMessageId } = req.body;
    const file = req.file;

    const result = await messageService.createConversation(req.instituteId, req.user, {
      recipientId,
      subject,
      body,
      file,
      replyToMessageId,
    });

    res.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const listConversations = async (req, res, next) => {
  try {
    const { page, limit, filter, search } = req.query;
    const result = await messageService.listConversations(req.instituteId, req.user.id, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      filter,
      search,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const getConversationThread = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page, limit } = req.query;
    const result = await messageService.getConversationThread(req.instituteId, req.user.id, id, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 50,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const sendReply = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { body, replyToMessageId } = req.body;
    const file = req.file;

    const result = await messageService.sendReply(req.instituteId, req.user, id, {
      body,
      file,
      replyToMessageId,
    });

    res.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const markConversationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await messageService.markConversationRead(req.instituteId, req.user.id, id);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const getGlobalUnreadCount = async (req, res, next) => {
  try {
    const result = await messageService.getGlobalUnreadCount(req.instituteId, req.user.id);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const archiveConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isArchived } = req.body;
    const result = await messageService.archiveConversation(
      req.instituteId,
      req.user.id,
      id,
      isArchived !== undefined ? isArchived : true
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const deleteConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await messageService.deleteConversationForUser(req.instituteId, req.user.id, id);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const editMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { body } = req.body;
    const result = await messageService.editMessage(req.instituteId, req.user.id, id, body);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const deleteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await messageService.deleteMessage(req.instituteId, req.user.id, id);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const streamAttachment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { download } = req.query;

    const fileInfo = await messageService.getAttachmentStream(req.instituteId, req.user.id, id);

    let storageRef = fileInfo.filePath;
    if (!storageRef.startsWith('r2://') && !storageRef.startsWith('/')) {
      storageRef = path.join(process.cwd(), 'uploads', 'messages', 'protected', fileInfo.filePath);
    }

    const resource = await getStorageResource(storageRef);
    if (!resource || !resource.stream) {
      return res.status(404).json({ success: false, message: 'Attachment file missing on storage server.' });
    }

    const safeFilename = fileInfo.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const dispositionType = download === '1' || download === 'true' ? 'attachment' : 'inline';

    res.setHeader('Content-Type', fileInfo.mimeType || resource.contentType || 'application/octet-stream');
    if (resource.contentLength) {
      res.setHeader('Content-Length', resource.contentLength);
    }
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeFilename}"`);

    resource.stream.pipe(res);
  } catch (error) {
    next(error);
  }
};
