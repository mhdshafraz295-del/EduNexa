import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { getInstituteEntitlement } from '../services/entitlement.service.js';
import {
  generateMediaStreamTicket,
  verifyMediaStreamTicket,
  createAlbum as createAlbumService,
  updateAlbum as updateAlbumService,
  deleteAlbum as deleteAlbumService,
  listAlbums as listAlbumsService,
  getAlbumWithMedia as getAlbumWithMediaService,
  listMedia as listMediaService,
  createMediaBatch as createMediaBatchService,
  addExternalVideoUrlMedia as addExternalVideoUrlService,
  updateMedia as updateMediaService,
  deleteMedia as deleteMediaService,
  safeDeleteGalleryFile,
} from '../services/gallery.service.js';
import {
  PROTECTED_GALLERY_DIR,
  validateMediaMagicBytes,
} from '../middleware/upload.middleware.js';

// =========================================================================
// 1. ALBUMS ENDPOINTS
// =========================================================================

/**
 * GET /api/gallery/albums
 * List albums for the tenant (Admins see all; Non-admins see published only)
 */
export const getAlbums = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const isPublishedOnly = req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN';

    const albums = await listAlbumsService({ instituteId, isPublishedOnly });
    return res.json({ success: true, data: albums });
  } catch (error) {
    console.error('Error fetching gallery albums:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch gallery albums.' });
  }
};

/**
 * GET /api/gallery/albums/:id
 * Get single album details with media
 */
export const getAlbumDetails = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const id = Number(req.params.id);
    const isPublishedOnly = req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN';

    const album = await getAlbumWithMediaService({ id, instituteId, isPublishedOnly });
    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found.' });
    }

    return res.json({ success: true, data: album });
  } catch (error) {
    console.error('Error fetching album details:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch album details.' });
  }
};

/**
 * POST /api/gallery/albums
 * Create new album (Admin only)
 */
export const createAlbum = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { title, description, coverImage, eventDate, isPublished, displayOrder } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Album title is required.' });
    }

    const album = await createAlbumService({
      instituteId,
      title,
      description,
      coverImage,
      eventDate,
      isPublished,
      displayOrder,
      createdBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: 'Gallery album created successfully.',
      data: album,
    });
  } catch (error) {
    console.error('Error creating album:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create album.' });
  }
};

/**
 * PUT /api/gallery/albums/:id
 * Update album (Admin only)
 */
export const updateAlbum = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const id = Number(req.params.id);
    const { title, description, coverImage, eventDate, isPublished, displayOrder } = req.body;

    const album = await updateAlbumService({
      id,
      instituteId,
      title,
      description,
      coverImage,
      eventDate,
      isPublished,
      displayOrder,
    });

    return res.json({
      success: true,
      message: 'Album updated successfully.',
      data: album,
    });
  } catch (error) {
    console.error('Error updating album:', error);
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to update album.',
    });
  }
};

/**
 * DELETE /api/gallery/albums/:id
 * Delete album and member media (Admin only)
 */
export const deleteAlbum = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const id = Number(req.params.id);

    const result = await deleteAlbumService({ id, instituteId });
    return res.json(result);
  } catch (error) {
    console.error('Error deleting album:', error);
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to delete album.',
    });
  }
};

/**
 * PATCH /api/gallery/albums/:id/status
 * Toggle album publish status (Admin only)
 */
export const toggleAlbumStatus = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const id = Number(req.params.id);

    const album = await prisma.galleryAlbum.findFirst({
      where: { id, instituteId },
    });

    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found.' });
    }

    const updated = await prisma.galleryAlbum.update({
      where: { id: album.id },
      data: { isPublished: !album.isPublished },
    });

    return res.json({
      success: true,
      message: `Album ${updated.isPublished ? 'published' : 'unpublished'} successfully.`,
      data: updated,
    });
  } catch (error) {
    console.error('Error toggling album status:', error);
    return res.status(500).json({ success: false, message: 'Failed to toggle album publish status.' });
  }
};

// =========================================================================
// 2. MEDIA ENDPOINTS
// =========================================================================

/**
 * GET /api/gallery/media
 * List media across albums with filters
 */
export const getMediaList = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { albumId, type, search } = req.query;
    const isPublishedOnly = req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN';

    const mediaList = await listMediaService({
      instituteId,
      albumId: albumId ? Number(albumId) : null,
      type: type || null,
      searchTerm: search || null,
      isPublishedOnly,
    });

    return res.json({ success: true, data: mediaList });
  } catch (error) {
    console.error('Error fetching media list:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch media items.' });
  }
};

/**
 * POST /api/gallery/media/upload
 * Multi-file upload for images / video (Admin only)
 */
export const uploadMedia = async (req, res) => {
  const uploadedFiles = req.files || [];
  try {
    const instituteId = req.instituteId;
    const albumId = req.body.albumId ? Number(req.body.albumId) : null;
    const isPublished = req.body.isPublished !== undefined ? req.body.isPublished === 'true' || req.body.isPublished === true : true;
    const title = req.body.title || null;
    const caption = req.body.caption || null;

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded.' });
    }

    const itemsToCreate = [];

    for (const file of uploadedFiles) {
      const isVideo = file.mimetype.startsWith('video/');
      const expectedType = isVideo ? 'VIDEO' : 'IMAGE';

      // 1. Enforce size limits: Image max 10MB, Video max 50MB
      if (!isVideo && file.size > 10 * 1024 * 1024) {
        safeDeleteGalleryFile(file.filename);
        return res.status(400).json({
          success: false,
          message: `File "${file.originalname}" exceeds the maximum image size limit of 10MB.`,
        });
      }

      if (isVideo && file.size > 50 * 1024 * 1024) {
        safeDeleteGalleryFile(file.filename);
        return res.status(400).json({
          success: false,
          message: `Video file "${file.originalname}" exceeds the maximum limit of 50MB.`,
        });
      }

      // 2. Validate magic bytes on disk
      const isValidSignature = validateMediaMagicBytes(file.path, expectedType);
      if (!isValidSignature) {
        safeDeleteGalleryFile(file.filename);
        return res.status(400).json({
          success: false,
          message: `File "${file.originalname}" failed security signature verification. Spoofed or corrupt files are rejected.`,
        });
      }

      itemsToCreate.push({
        type: isVideo ? 'VIDEO_UPLOAD' : 'IMAGE',
        title: title || file.originalname,
        caption,
        filePath: file.filename,
        thumbnailPath: isVideo ? null : file.filename,
        mimeType: file.mimetype,
        fileSize: file.size,
        isPublished,
      });
    }

    const createdRecords = await createMediaBatchService({
      instituteId,
      albumId,
      items: itemsToCreate,
      createdBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: `Successfully uploaded and registered ${createdRecords.length} media items.`,
      data: createdRecords,
    });
  } catch (error) {
    console.error('Error during media upload:', error);
    // Cleanup any uploaded files if creation failed
    for (const file of uploadedFiles) {
      safeDeleteGalleryFile(file.filename);
    }
    return res.status(500).json({ success: false, message: error.message || 'Failed to process media upload.' });
  }
};

/**
 * POST /api/gallery/media/video-url
 * Add external YouTube/Vimeo/HTTPS video URL (Admin only)
 */
export const addExternalVideoUrl = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { albumId, title, caption, externalVideoUrl, isPublished, displayOrder } = req.body;

    if (!externalVideoUrl || !externalVideoUrl.trim()) {
      return res.status(400).json({ success: false, message: 'External video URL is required.' });
    }

    const record = await addExternalVideoUrlService({
      instituteId,
      albumId: albumId ? Number(albumId) : null,
      title,
      caption,
      externalVideoUrl,
      isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
      displayOrder: displayOrder ? Number(displayOrder) : 0,
      createdBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: 'External video linked successfully.',
      data: record,
    });
  } catch (error) {
    console.error('Error adding external video URL:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to add video link.' });
  }
};

/**
 * PUT /api/gallery/media/:id
 * Update media details (Admin only)
 */
export const updateMedia = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const id = Number(req.params.id);
    const { title, caption, albumId, displayOrder, isPublished } = req.body;

    const updated = await updateMediaService({
      id,
      instituteId,
      title,
      caption,
      albumId,
      displayOrder,
      isPublished,
    });

    return res.json({
      success: true,
      message: 'Media details updated successfully.',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating media:', error);
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to update media.',
    });
  }
};

/**
 * DELETE /api/gallery/media/:id
 * Delete media item and clean physical file (Admin only)
 */
export const deleteMedia = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const id = Number(req.params.id);

    const result = await deleteMediaService({ id, instituteId });
    return res.json(result);
  } catch (error) {
    console.error('Error deleting media:', error);
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to delete media.',
    });
  }
};

/**
 * PATCH /api/gallery/media/:id/status
 * Toggle media publish status (Admin only)
 */
export const toggleMediaStatus = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const id = Number(req.params.id);

    const media = await prisma.galleryMedia.findFirst({
      where: { id, instituteId },
    });

    if (!media) {
      return res.status(404).json({ success: false, message: 'Media not found.' });
    }

    const updated = await prisma.galleryMedia.update({
      where: { id: media.id },
      data: { isPublished: !media.isPublished },
    });

    return res.json({
      success: true,
      message: `Media ${updated.isPublished ? 'published' : 'unpublished'} successfully.`,
      data: updated,
    });
  } catch (error) {
    console.error('Error toggling media status:', error);
    return res.status(500).json({ success: false, message: 'Failed to toggle media publish status.' });
  }
};

// =========================================================================
// 3. STREAM TICKET & STREAMING ENDPOINTS
// =========================================================================

/**
 * POST /api/gallery/media/:id/stream-ticket
 * Request a short-lived scoped media stream ticket (Bearer JWT Auth)
 */
export const createStreamTicket = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const mediaId = Number(req.params.id);

    const media = await prisma.galleryMedia.findFirst({
      where: { id: mediaId, instituteId },
      include: { album: true },
    });

    if (!media) {
      return res.status(404).json({ success: false, message: 'Media item not found.' });
    }

    // Role-based publication check
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
    if (!isAdmin) {
      if (!media.isPublished) {
        return res.status(403).json({ success: false, message: 'This media item is not currently published.' });
      }
      if (media.albumId && media.album && !media.album.isPublished) {
        return res.status(403).json({ success: false, message: 'The album containing this media is not published.' });
      }
    }

    const ticket = generateMediaStreamTicket({
      mediaId: media.id,
      instituteId: media.instituteId,
      userId: req.user.id,
      role: req.user.role,
      expiresInSeconds: 900, // 15 minutes
    });

    return res.json({
      success: true,
      ticket,
      mediaId: media.id,
      expiresIn: 900,
    });
  } catch (error) {
    console.error('Error creating stream ticket:', error);
    return res.status(500).json({ success: false, message: 'Failed to issue stream ticket.' });
  }
};

/**
 * GET /api/gallery/media/:id/stream
 * Stream media file using short-lived ticket OR authenticated Bearer session with HTTP Range & 416 validation
 */
export const streamMedia = async (req, res) => {
  try {
    const mediaId = Number(req.params.id);
    let requestingUserId = null;
    let ticketInstituteId = null;

    // 1. Dual Authentication: Stream Ticket OR Primary Session Bearer JWT
    if (req.query.ticket) {
      const verification = verifyMediaStreamTicket(req.query.ticket);
      if (!verification.valid) {
        return res.status(403).json({
          success: false,
          message: verification.error || 'Media stream ticket is invalid or has expired.',
        });
      }

      if (verification.payload.mediaId !== mediaId) {
        return res.status(403).json({
          success: false,
          message: 'Stream ticket is not valid for this media item.',
        });
      }

      requestingUserId = verification.payload.userId;
      ticketInstituteId = verification.payload.instituteId;
    } else if ((req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) || (req.cookies && req.cookies.token)) {
      const token = req.headers.authorization
        ? req.headers.authorization.split(' ')[1]
        : req.cookies.token;

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'edunexa_secret');
        requestingUserId = decoded.userId;
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired session token.',
          error: err.message,
        });
      }
    } else {
      return res.status(401).json({
        success: false,
        message: 'A valid media stream ticket or authorization token is required.',
      });
    }

    // 2. AUTHORITATIVE MEDIA ACCESS PIPELINE
    // Step 2.1: Current User Active Check & Tenant Resolution
    const user = await prisma.user.findUnique({
      where: { id: requestingUserId },
      include: {
        institute: true,
        teacher: true,
        student: true,
        parent: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account no longer exists.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'User access has been revoked or modified.',
      });
    }

    let institute = user.institute;
    if (!institute && user.role !== 'SUPER_ADMIN') {
      const fallbackInstId = user.teacher?.instituteId || user.student?.instituteId || user.parent?.instituteId;
      if (fallbackInstId) {
        institute = await prisma.institute.findUnique({ where: { id: fallbackInstId } });
      }
    }

    if (user.role !== 'SUPER_ADMIN') {
      if (!institute) {
        return res.status(403).json({
          success: false,
          message: 'User is not assigned to any valid institute.',
        });
      }

      if (!institute.isActive) {
        return res.status(403).json({
          success: false,
          isInstituteInactive: true,
          message: 'Your institute account is currently inactive. Please contact EduNexa support.',
        });
      }
    }

    const effectiveInstituteId = institute?.id || user.instituteId;

    // Step 2.2: Live Database Lookup & Tenant Match
    const media = await prisma.galleryMedia.findFirst({
      where: {
        id: mediaId,
        ...(user.role === 'SUPER_ADMIN' ? {} : { instituteId: effectiveInstituteId }),
      },
      include: { album: true },
    });

    if (!media || !media.filePath) {
      return res.status(404).json({ success: false, message: 'Media content not found.' });
    }

    if (ticketInstituteId && user.role !== 'SUPER_ADMIN' && media.instituteId !== ticketInstituteId) {
      return res.status(403).json({ success: false, message: 'Stream ticket is not valid for this tenant.' });
    }

    // Step 2.3: Live Subscription Entitlement Check
    const entitlement = await getInstituteEntitlement(media.instituteId);
    if (!entitlement.isValid || !entitlement.features?.GALLERY) {
      return res.status(403).json({
        success: false,
        code: 'FEATURE_NOT_INCLUDED',
        message: 'Gallery access is no longer active for this institute.',
      });
    }

    // Step 2.4: Live Publication Rules Check
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    if (!isAdmin) {
      if (!media.isPublished) {
        return res.status(403).json({ success: false, message: 'This media item is not published.' });
      }
      if (media.albumId && media.album && !media.album.isPublished) {
        return res.status(403).json({ success: false, message: 'The album containing this media is not published.' });
      }
    }

    // Step 2.5: Resolve physical file path on disk with strict directory traversal prevention
    const safeFilename = path.basename(media.filePath);
    const resolvedProtectedDir = path.resolve(PROTECTED_GALLERY_DIR);
    const fullPath = path.resolve(resolvedProtectedDir, safeFilename);

    if (!fullPath.startsWith(resolvedProtectedDir) || !fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, message: 'Media file missing on storage server.' });
    }

    const stat = fs.statSync(fullPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const mimeType = media.mimeType || 'application/octet-stream';

    // Step 2.6: HTTP Range Processing & 416 Handling
    if (range) {
      // Check for unsupported multi-range (e.g. bytes=0-10,20-30)
      if (range.includes(',')) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).json({ success: false, message: 'Multiple range requests are not supported.' });
      }

      const match = range.match(/bytes=(\d*)-(\d*)/);
      if (!match) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).json({ success: false, message: 'Invalid Range header format.' });
      }

      let start = match[1] ? parseInt(match[1], 10) : 0;
      let end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

      // Handle suffix range (e.g. bytes=-500)
      if (!match[1] && match[2]) {
        const suffixLength = parseInt(match[2], 10);
        start = Math.max(0, fileSize - suffixLength);
        end = fileSize - 1;
      }

      // Validate bounds: start >= fileSize OR end >= fileSize OR start > end OR start < 0
      if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize || start > end || start < 0) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).json({ success: false, message: 'Requested range not satisfiable.' });
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(fullPath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mimeType,
      });

      fileStream.pipe(res);
    } else {
      // Full file delivery (e.g. for authenticated Blob image downloads)
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      });

      const fileStream = fs.createReadStream(fullPath);
      fileStream.pipe(res);
    }
  } catch (error) {
    console.error('Error streaming gallery media:', error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Failed to stream media.' });
    }
  }
};
