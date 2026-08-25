import fs from 'fs';
import path from 'path';
import * as broadcastService from '../services/broadcast.service.js';

export const previewAudience = async (req, res) => {
  try {
    const { audienceType, classId } = req.body;
    const data = await broadcastService.previewAudience(req.instituteId, {
      audienceType,
      classId,
    });
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to preview audience.',
    });
  }
};

export const createBroadcast = async (req, res) => {
  try {
    const { title, body, audienceType, classId, allowReplies } = req.body;
    const file = req.file || null;

    const data = await broadcastService.createBroadcast(req.instituteId, req.user, {
      title,
      body,
      audienceType,
      classId,
      allowReplies,
      file,
    });

    res.status(201).json(data);
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to send broadcast.',
    });
  }
};

export const listAdminBroadcasts = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only Institute Administrators can view admin broadcast history.',
      });
    }

    const { filter, search, page, limit } = req.query;
    const data = await broadcastService.listAdminBroadcasts(req.instituteId, req.user.id, {
      filter,
      search,
      page,
      limit,
    });
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to fetch admin broadcasts.',
    });
  }
};

export const listUserBroadcasts = async (req, res) => {
  try {
    const { filter, search, page, limit } = req.query;
    const data = await broadcastService.listUserBroadcasts(req.instituteId, req.user.id, {
      filter,
      search,
      page,
      limit,
    });
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to fetch delivered broadcasts.',
    });
  }
};

export const getBroadcastDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await broadcastService.getBroadcastDetail(
      req.instituteId,
      req.user.id,
      req.user.role,
      id
    );
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to fetch broadcast detail.',
    });
  }
};

export const markBroadcastRead = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await broadcastService.markBroadcastRead(req.instituteId, req.user.id, id);
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to mark broadcast as read.',
    });
  }
};

export const archiveBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    const { isArchived } = req.body;
    const data = await broadcastService.archiveBroadcastForUser(
      req.instituteId,
      req.user.id,
      id,
      isArchived
    );
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to update archive status.',
    });
  }
};

export const deleteBroadcastForUser = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await broadcastService.deleteBroadcastForUser(req.instituteId, req.user.id, id);
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to delete broadcast.',
    });
  }
};

export const withdrawBroadcast = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only Institute Administrators can withdraw broadcasts.',
      });
    }

    const { id } = req.params;
    const data = await broadcastService.withdrawBroadcast(req.instituteId, req.user.id, id);
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to withdraw broadcast.',
    });
  }
};

export const downloadBroadcastAttachment = async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const streamInfo = await broadcastService.getBroadcastAttachmentStream(
      req.instituteId,
      req.user.id,
      req.user.role,
      attachmentId
    );

    const isDownload = req.query.download === '1' || req.query.download === 'true';
    const disposition = isDownload ? 'attachment' : 'inline';

    res.setHeader('Content-Type', streamInfo.mimeType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(streamInfo.originalName)}"`);
    res.setHeader('Content-Length', streamInfo.fileSize);

    const fileStream = fs.createReadStream(streamInfo.filePath);
    fileStream.pipe(res);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to stream broadcast attachment.',
    });
  }
};
