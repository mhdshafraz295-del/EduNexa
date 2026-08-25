import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { PROTECTED_GALLERY_DIR } from '../middleware/upload.middleware.js';

// Dedicated secret for short-lived media stream tickets (distinct from primary JWT)
const MEDIA_STREAM_SECRET = process.env.MEDIA_STREAM_SECRET || 'edunexa_media_stream_secret_key_secure_2026';

/**
 * Generate a short-lived scoped media stream ticket
 */
export function generateMediaStreamTicket({ mediaId, instituteId, userId, role, expiresInSeconds = 900 }) {
  return jwt.sign(
    {
      mediaId: Number(mediaId),
      instituteId: Number(instituteId),
      userId: Number(userId),
      role,
      type: 'GALLERY_STREAM_TICKET',
    },
    MEDIA_STREAM_SECRET,
    { expiresIn: expiresInSeconds }
  );
}

/**
 * Verify a short-lived media stream ticket
 */
export function verifyMediaStreamTicket(ticket) {
  try {
    const decoded = jwt.verify(ticket, MEDIA_STREAM_SECRET);
    if (decoded.type !== 'GALLERY_STREAM_TICKET') {
      return { valid: false, error: 'Invalid ticket type.' };
    }
    return { valid: true, payload: decoded };
  } catch (err) {
    return { valid: false, error: err.message || 'Stream ticket invalid or expired.' };
  }
}

/**
 * Safely removes a file from the protected gallery directory
 */
export function safeDeleteGalleryFile(filename) {
  if (!filename) return false;
  try {
    const safeBase = path.basename(filename);
    const targetPath = path.join(PROTECTED_GALLERY_DIR, safeBase);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      return true;
    }
  } catch (err) {
    console.error(`Failed to delete gallery file: ${filename}`, err);
  }
  return false;
}

/**
 * Create a new Gallery Album
 */
export async function createAlbum({
  instituteId,
  title,
  description = null,
  coverImage = null,
  eventDate = null,
  isPublished = false,
  displayOrder = 0,
  createdBy = null,
}) {
  return await prisma.galleryAlbum.create({
    data: {
      instituteId,
      title: title.trim(),
      description: description ? description.trim() : null,
      coverImage: coverImage ? coverImage.trim() : null,
      eventDate: eventDate ? new Date(eventDate) : null,
      isPublished: Boolean(isPublished),
      displayOrder: Number(displayOrder) || 0,
      createdBy,
    },
  });
}

/**
 * Update an existing Gallery Album
 */
export async function updateAlbum({
  id,
  instituteId,
  title,
  description = null,
  coverImage = null,
  eventDate = null,
  isPublished,
  displayOrder = 0,
}) {
  const existing = await prisma.galleryAlbum.findFirst({
    where: { id: Number(id), instituteId },
  });

  if (!existing) {
    throw new Error('Album not found or access denied.');
  }

  const updateData = {};
  if (title !== undefined) updateData.title = title.trim();
  if (description !== undefined) updateData.description = description ? description.trim() : null;
  if (coverImage !== undefined) updateData.coverImage = coverImage ? coverImage.trim() : null;
  if (eventDate !== undefined) updateData.eventDate = eventDate ? new Date(eventDate) : null;
  if (isPublished !== undefined) updateData.isPublished = Boolean(isPublished);
  if (displayOrder !== undefined) updateData.displayOrder = Number(displayOrder) || 0;

  return await prisma.galleryAlbum.update({
    where: { id: existing.id },
    data: updateData,
  });
}

/**
 * Delete a Gallery Album and safely cleanup its media files
 */
export async function deleteAlbum({ id, instituteId }) {
  const album = await prisma.galleryAlbum.findFirst({
    where: { id: Number(id), instituteId },
    include: { media: true },
  });

  if (!album) {
    throw new Error('Album not found or access denied.');
  }

  const filePathsToDelete = album.media
    .map((m) => m.filePath)
    .filter(Boolean);

  if (album.coverImage) {
    filePathsToDelete.push(album.coverImage);
  }

  // Delete from DB first
  await prisma.galleryAlbum.delete({
    where: { id: album.id },
  });

  // Cleanup physical files after DB transaction commits
  for (const filePath of filePathsToDelete) {
    safeDeleteGalleryFile(filePath);
  }

  return { success: true, message: 'Album and all associated media deleted successfully.' };
}

/**
 * List albums for an institute
 */
export async function listAlbums({ instituteId, isPublishedOnly = false }) {
  const where = {
    instituteId,
    ...(isPublishedOnly ? { isPublished: true } : {}),
  };

  const albums = await prisma.galleryAlbum.findMany({
    where,
    include: {
      _count: {
        select: {
          media: {
            where: isPublishedOnly ? { isPublished: true } : {},
          },
        },
      },
      createdByUser: {
        select: { id: true, username: true, role: true },
      },
    },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
  });

  return albums.map((a) => ({
    ...a,
    mediaCount: a._count.media,
  }));
}

/**
 * Get single album details with its media
 */
export async function getAlbumWithMedia({ id, instituteId, isPublishedOnly = false }) {
  const album = await prisma.galleryAlbum.findFirst({
    where: {
      id: Number(id),
      instituteId,
      ...(isPublishedOnly ? { isPublished: true } : {}),
    },
    include: {
      media: {
        where: isPublishedOnly ? { isPublished: true } : {},
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      },
      createdByUser: {
        select: { id: true, username: true, role: true },
      },
    },
  });

  return album;
}

/**
 * List media items across albums
 */
export async function listMedia({
  instituteId,
  albumId = null,
  type = null,
  searchTerm = null,
  isPublishedOnly = false,
}) {
  const where = {
    instituteId,
    ...(albumId ? { albumId: Number(albumId) } : {}),
    ...(type ? { type } : {}),
    ...(isPublishedOnly
      ? {
          isPublished: true,
          OR: [
            { albumId: null },
            { album: { isPublished: true } },
          ],
        }
      : {}),
  };

  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.trim();
    where.AND = [
      {
        OR: [
          { title: { contains: term } },
          { caption: { contains: term } },
        ],
      },
    ];
  }

  return await prisma.galleryMedia.findMany({
    where,
    include: {
      album: {
        select: { id: true, title: true, isPublished: true },
      },
      createdByUser: {
        select: { id: true, username: true, role: true },
      },
    },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
  });
}

/**
 * Create a media batch (e.g. uploaded images or video)
 */
export async function createMediaBatch({ instituteId, albumId = null, items = [], createdBy = null }) {
  if (!items || items.length === 0) {
    throw new Error('No media items provided for batch creation.');
  }

  // If albumId specified, verify album belongs to tenant
  if (albumId) {
    const album = await prisma.galleryAlbum.findFirst({
      where: { id: Number(albumId), instituteId },
    });
    if (!album) {
      throw new Error('Target album not found or access denied.');
    }
  }

  const createdRecords = [];

  for (const item of items) {
    const record = await prisma.galleryMedia.create({
      data: {
        instituteId,
        albumId: albumId ? Number(albumId) : null,
        type: item.type || 'IMAGE',
        title: item.title ? item.title.trim() : null,
        caption: item.caption ? item.caption.trim() : null,
        filePath: item.filePath || null,
        thumbnailPath: item.thumbnailPath || null,
        externalVideoUrl: item.externalVideoUrl || null,
        mimeType: item.mimeType || null,
        fileSize: item.fileSize ? Number(item.fileSize) : null,
        displayOrder: Number(item.displayOrder) || 0,
        isPublished: item.isPublished !== undefined ? Boolean(item.isPublished) : true,
        createdBy,
      },
    });
    createdRecords.push(record);
  }

  return createdRecords;
}

/**
 * Validate and sanitize external video URL
 */
export function sanitizeVideoUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('A valid HTTPS video URL is required.');
  }

  const trimmed = url.trim();

  // Strictly enforce HTTPS
  if (!trimmed.startsWith('https://')) {
    throw new Error('Video URL must start with https://');
  }

  // Reject unsafe schemes
  const lower = trimmed.toLowerCase();
  if (
    lower.includes('javascript:') ||
    lower.includes('data:') ||
    lower.includes('file:') ||
    lower.includes('vbscript:') ||
    lower.includes('<script')
  ) {
    throw new Error('Unsafe video URL scheme detected.');
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      throw new Error('Only HTTPS protocol is permitted.');
    }
    return trimmed;
  } catch (err) {
    throw new Error('Invalid URL format.');
  }
}

/**
 * Add an external video URL media item
 */
export async function addExternalVideoUrlMedia({
  instituteId,
  albumId = null,
  title,
  caption = null,
  externalVideoUrl,
  displayOrder = 0,
  isPublished = true,
  createdBy = null,
}) {
  const sanitizedUrl = sanitizeVideoUrl(externalVideoUrl);

  if (albumId) {
    const album = await prisma.galleryAlbum.findFirst({
      where: { id: Number(albumId), instituteId },
    });
    if (!album) {
      throw new Error('Target album not found or access denied.');
    }
  }

  return await prisma.galleryMedia.create({
    data: {
      instituteId,
      albumId: albumId ? Number(albumId) : null,
      type: 'VIDEO_URL',
      title: title ? title.trim() : 'Video',
      caption: caption ? caption.trim() : null,
      externalVideoUrl: sanitizedUrl,
      mimeType: 'video/external',
      displayOrder: Number(displayOrder) || 0,
      isPublished: Boolean(isPublished),
      createdBy,
    },
  });
}

/**
 * Update media item details
 */
export async function updateMedia({
  id,
  instituteId,
  title,
  caption,
  albumId,
  displayOrder,
  isPublished,
}) {
  const media = await prisma.galleryMedia.findFirst({
    where: { id: Number(id), instituteId },
  });

  if (!media) {
    throw new Error('Media item not found or access denied.');
  }

  if (albumId !== undefined && albumId !== null) {
    const album = await prisma.galleryAlbum.findFirst({
      where: { id: Number(albumId), instituteId },
    });
    if (!album) {
      throw new Error('Target album not found or access denied.');
    }
  }

  const updateData = {};
  if (title !== undefined) updateData.title = title ? title.trim() : null;
  if (caption !== undefined) updateData.caption = caption ? caption.trim() : null;
  if (albumId !== undefined) updateData.albumId = albumId ? Number(albumId) : null;
  if (displayOrder !== undefined) updateData.displayOrder = Number(displayOrder) || 0;
  if (isPublished !== undefined) updateData.isPublished = Boolean(isPublished);

  return await prisma.galleryMedia.update({
    where: { id: media.id },
    data: updateData,
  });
}

/**
 * Delete a media item and remove physical file
 */
export async function deleteMedia({ id, instituteId }) {
  const media = await prisma.galleryMedia.findFirst({
    where: { id: Number(id), instituteId },
  });

  if (!media) {
    throw new Error('Media item not found or access denied.');
  }

  const filePathToDelete = media.filePath;

  // DB delete first
  await prisma.galleryMedia.delete({
    where: { id: media.id },
  });

  // Physical file cleanup
  if (filePathToDelete) {
    safeDeleteGalleryFile(filePathToDelete);
  }

  return { success: true, message: 'Media item deleted successfully.' };
}
