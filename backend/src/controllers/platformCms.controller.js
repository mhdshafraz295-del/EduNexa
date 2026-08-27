import * as platformCmsService from '../services/platformCms.service.js';
import { PROTECTED_CMS_DRAFT_DIR, PUBLIC_CMS_DIR } from '../middleware/upload.middleware.js';
import { isR2Configured, getObjectFromR2 } from '../services/storage/r2Storage.service.js';
import prisma from '../config/prisma.js';
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
 * Checks local volume disk first; falls back to Cloudflare R2 bucket.
 */
export async function getDraftAsset(req, res) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Unauthorized draft asset access.' });
    }

    const paramPath = req.params[0] || req.params.filename || req.params.key || '';
    const cleanKey = paramPath.replace(/^r2:\/\//, '').replace(/^\/+/, '');
    const filename = path.basename(cleanKey);
    const localFilePath = path.join(PROTECTED_CMS_DRAFT_DIR, filename);

    // 1. Check local volume disk
    if (fs.existsSync(localFilePath)) {
      const ext = path.extname(filename).toLowerCase();
      const mimeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
      };
      res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
      return res.sendFile(localFilePath);
    }

    // 2. Check Cloudflare R2 if configured
    if (isR2Configured()) {
      const candidateKeys = [
        cleanKey,
        `platform-cms/draft/${filename}`,
        `platform-cms/draft/team/${filename}`,
      ];

      for (const candidateKey of candidateKeys) {
        try {
          const { Body, ContentType, ContentLength } = await getObjectFromR2(candidateKey);
          res.setHeader('Content-Type', ContentType || 'image/jpeg');
          if (ContentLength) res.setHeader('Content-Length', ContentLength);
          return Body.pipe(res);
        } catch {
          // try next candidate key
        }
      }
    }

    return res.status(404).json({ success: false, message: 'Draft asset not found.' });
  } catch (err) {
    console.error('Error streaming draft asset:', err);
    return res.status(500).json({ success: false, message: 'Error streaming draft asset.' });
  }
}

/**
 * Public proxy endpoint for published CMS images (GET /api/platform-cms/assets/*).
 * STRICT SECURITY CHECK: Verifies that the requested asset is currently referenced by the
 * authoritative PUBLISHED Platform CmsContent or TeamMember record before streaming.
 */
export async function getPublishedAsset(req, res) {
  try {
    const rawParam = req.params[0] || req.params.key || req.params.filename || '';
    const cleanKey = rawParam.replace(/^r2:\/\//, '').replace(/^\/+/, '');
    const filename = path.basename(cleanKey);

    // Security Check: Query database for current published assets
    const published = await prisma.platformCmsContent.findFirst({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      include: {
        teamMembers: {
          where: { isActive: true },
        },
      },
    });

    if (!published) {
      return res.status(404).json({ success: false, message: 'No published platform content found.' });
    }

    const activePublishedAssets = [
      published.heroImage,
      published.storyImage,
      ...(published.teamMembers || []).map((m) => m.profileImage),
    ].filter(Boolean);

    // Verify if requested cleanKey or filename matches any active published reference
    const isReferenced = activePublishedAssets.some((ref) => {
      const cleanRef = String(ref).replace(/^r2:\/\//, '').replace(/^\/+/, '');
      return cleanRef === cleanKey || path.basename(cleanRef) === filename;
    });

    if (!isReferenced) {
      return res.status(404).json({ success: false, message: 'Requested asset is not published or access denied.' });
    }

    // 1. Check local volume disk first
    const localFilePath = path.join(PUBLIC_CMS_DIR, filename);
    if (fs.existsSync(localFilePath)) {
      const ext = path.extname(filename).toLowerCase();
      const mimeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
      };
      res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
      return res.sendFile(localFilePath);
    }

    // 2. Fetch from Cloudflare R2 if configured
    if (isR2Configured()) {
      const candidateKeys = [
        cleanKey.startsWith('platform-cms/public/') ? cleanKey : `platform-cms/public/${cleanKey}`,
        `platform-cms/public/${filename}`,
        `platform-cms/public/team/${filename}`,
      ];

      for (const candidateKey of candidateKeys) {
        try {
          const { Body, ContentType, ContentLength } = await getObjectFromR2(candidateKey);
          res.setHeader('Content-Type', ContentType || 'image/jpeg');
          if (ContentLength) res.setHeader('Content-Length', ContentLength);
          return Body.pipe(res);
        } catch {
          // try next candidate
        }
      }
    }

    return res.status(404).json({ success: false, message: 'Published asset not found.' });
  } catch (err) {
    console.error('Error streaming published asset:', err);
    return res.status(500).json({ success: false, message: 'Error streaming published asset.' });
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

