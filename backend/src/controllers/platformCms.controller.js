import * as platformCmsService from '../services/platformCms.service.js';
import { PROTECTED_CMS_DRAFT_DIR } from '../middleware/upload.middleware.js';
import path from 'path';
import fs from 'fs';

/**
 * Public & authenticated role read-only endpoint.
 * Returns only authoritative published content. Never leaks draft content.
 */
export async function getPublishedCms(req, res) {
  try {
    const data = await platformCmsService.getPublishedCms();
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('Error fetching published CMS:', err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to fetch platform information.',
    });
  }
}

/**
 * Super Admin endpoint to fetch editable draft and publication status.
 */
export async function getAdminCmsDraft(req, res) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Super Admin access required.' });
    }
    const data = await platformCmsService.getAdminCmsDraft(req.user);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('Error fetching CMS draft:', err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to fetch CMS draft.',
    });
  }
}

/**
 * Super Admin endpoint to save editable draft without publishing.
 */
export async function saveAdminCmsDraft(req, res) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Super Admin access required.' });
    }
    const data = await platformCmsService.saveAdminCmsDraft(req.user, req.body);
    return res.status(200).json({
      success: true,
      message: 'Draft saved successfully.',
      data,
    });
  } catch (err) {
    console.error('Error saving CMS draft:', err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to save CMS draft.',
    });
  }
}

/**
 * Super Admin endpoint to atomically publish draft into live content.
 */
export async function publishAdminCms(req, res) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Super Admin access required.' });
    }
    const data = await platformCmsService.publishAdminCms(req.user, req.body);
    return res.status(200).json({
      success: true,
      message: 'Platform content published successfully.',
      data,
    });
  } catch (err) {
    console.error('Error publishing CMS:', err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to publish platform content.',
    });
  }
}

/**
 * Super Admin endpoint to upload draft images (Hero banner, Story image, etc.)
 */
export async function uploadDraftImage(req, res) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Super Admin access required.' });
    }
    const field = req.body?.field || req.query?.field || 'cms';
    const result = await platformCmsService.handleDraftImageUpload(req.user, req.file, field);
    return res.status(200).json({
      success: true,
      message: 'Draft image uploaded successfully.',
      data: result,
    });
  } catch (err) {
    console.error('Error uploading draft image:', err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to upload image.',
    });
  }
}

/**
 * Serves protected draft images to authenticated Super Admin previewers only.
 */
export async function getDraftAsset(req, res) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Unauthorized draft asset access.' });
    }
    const filename = path.basename(req.params.filename);
    const filePath = path.join(PROTECTED_CMS_DRAFT_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Draft asset not found.' });
    }

    const ext = path.extname(filename).toLowerCase();
    const mimeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    return res.sendFile(filePath);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error streaming draft asset.' });
  }
}

/**
 * Super Admin endpoint to reset draft by copying from current live published record.
 */
export async function resetAdminCmsDraft(req, res) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Super Admin access required.' });
    }
    const data = await platformCmsService.resetAdminCmsDraft(req.user);
    return res.status(200).json({
      success: true,
      message: 'Draft reset to live published state.',
      data,
    });
  } catch (err) {
    console.error('Error resetting CMS draft:', err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to reset CMS draft.',
    });
  }
}

