import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { requireRoles } from '../middleware/role.middleware.js';
import { requireFeature } from '../middleware/subscription.middleware.js';
import { uploadGalleryMedia } from '../middleware/upload.middleware.js';
import {
  getAlbums,
  getAlbumDetails,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  toggleAlbumStatus,
  getMediaList,
  uploadMedia,
  addExternalVideoUrl,
  updateMedia,
  deleteMedia,
  toggleMediaStatus,
  createStreamTicket,
  streamMedia,
} from '../controllers/gallery.controller.js';

const router = express.Router();

// =========================================================================
// 1. STREAMING ROUTE (Dedicated Ticket Verification & Range Streaming)
// Note: This route must NOT be blocked by Bearer-only middleware for <video> tags
// =========================================================================
router.get('/media/:id/stream', streamMedia);

// =========================================================================
// 2. STREAM TICKET ISSUANCE (Protected by Bearer JWT & Feature Entitlement)
// =========================================================================
router.post(
  '/media/:id/stream-ticket',
  authenticate,
  tenantMiddleware,
  requireFeature('GALLERY'),
  createStreamTicket
);

// =========================================================================
// 3. ALBUMS ROUTES (Read for all authorized roles; Mutations for Admin)
// =========================================================================
router.get(
  '/albums',
  authenticate,
  tenantMiddleware,
  requireFeature('GALLERY'),
  getAlbums
);

router.get(
  '/albums/:id',
  authenticate,
  tenantMiddleware,
  requireFeature('GALLERY'),
  getAlbumDetails
);

router.post(
  '/albums',
  authenticate,
  tenantMiddleware,
  requireFeature('GALLERY'),
  requireRoles('ADMIN', 'SUPER_ADMIN'),
  createAlbum
);

router.put(
  '/albums/:id',
  authenticate,
  tenantMiddleware,
  requireFeature('GALLERY'),
  requireRoles('ADMIN', 'SUPER_ADMIN'),
  updateAlbum
);

router.delete(
  '/albums/:id',
  authenticate,
  tenantMiddleware,
  requireFeature('GALLERY'),
  requireRoles('ADMIN', 'SUPER_ADMIN'),
  deleteAlbum
);

router.patch(
  '/albums/:id/status',
  authenticate,
  tenantMiddleware,
  requireFeature('GALLERY'),
  requireRoles('ADMIN', 'SUPER_ADMIN'),
  toggleAlbumStatus
);

// =========================================================================
// 4. MEDIA MANAGEMENT ROUTES (Read for all roles; Mutations for Admin)
// =========================================================================
router.get(
  '/media',
  authenticate,
  tenantMiddleware,
  requireFeature('GALLERY'),
  getMediaList
);

router.post(
  '/media/upload',
  authenticate,
  tenantMiddleware,
  requireFeature('GALLERY'),
  requireRoles('ADMIN', 'SUPER_ADMIN'),
  uploadGalleryMedia.array('files', 20),
  uploadMedia
);

router.post(
  '/media/video-url',
  authenticate,
  tenantMiddleware,
  requireFeature('GALLERY'),
  requireRoles('ADMIN', 'SUPER_ADMIN'),
  addExternalVideoUrl
);

router.put(
  '/media/:id',
  authenticate,
  tenantMiddleware,
  requireFeature('GALLERY'),
  requireRoles('ADMIN', 'SUPER_ADMIN'),
  updateMedia
);

router.delete(
  '/media/:id',
  authenticate,
  tenantMiddleware,
  requireFeature('GALLERY'),
  requireRoles('ADMIN', 'SUPER_ADMIN'),
  deleteMedia
);

router.patch(
  '/media/:id/status',
  authenticate,
  tenantMiddleware,
  requireFeature('GALLERY'),
  requireRoles('ADMIN', 'SUPER_ADMIN'),
  toggleMediaStatus
);

export default router;
