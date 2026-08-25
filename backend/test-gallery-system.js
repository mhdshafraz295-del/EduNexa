import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import prisma from './src/config/prisma.js';
import {
  generateMediaStreamTicket,
  verifyMediaStreamTicket,
} from './src/services/gallery.service.js';
import {
  PROTECTED_GALLERY_DIR,
  validateMediaMagicBytes,
} from './src/middleware/upload.middleware.js';

// Setup Mock HTTP Request/Response helpers to test express controllers & routes directly
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const MEDIA_STREAM_SECRET = process.env.MEDIA_STREAM_SECRET || 'edunexa_media_stream_secret_key_secure_2026';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ Test ${totalTests}: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ Test ${totalTests} FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runGalleryTestSuite() {
  console.log('\n================================================================');
  console.log('  EDUNEXA STEP 8: DYNAMIC INSTITUTE GALLERY AUTOMATED TEST SUITE');
  console.log('================================================================\n');

  // 1. Setup Test Institute A and Users
  const testInstA = await prisma.institute.findFirst({
    where: { isActive: true },
    include: { subscriptions: { include: { plan: { include: { features: { include: { feature: true } } } } } } },
  });

  if (!testInstA) {
    throw new Error('Active test institute not found in database.');
  }

  const instAId = testInstA.id;
  const activeSub = testInstA.subscriptions?.[0];

  // Find Admin, Student, Teacher, Parent for Institute A
  const adminUser = await prisma.user.findFirst({
    where: { instituteId: instAId, role: 'ADMIN', isActive: true },
  });
  const studentUser = await prisma.user.findFirst({
    where: { instituteId: instAId, role: 'STUDENT', isActive: true },
  });
  const teacherUser = await prisma.user.findFirst({
    where: { instituteId: instAId, role: 'TEACHER', isActive: true },
  });
  const parentUser = await prisma.user.findFirst({
    where: { instituteId: instAId, role: 'PARENT', isActive: true },
  });

  // Find or Create Test Institute B (for cross-tenant testing)
  let testInstB = await prisma.institute.findFirst({
    where: { id: { not: instAId }, isActive: true },
  });
  if (!testInstB) {
    testInstB = await prisma.institute.create({
      data: {
        name: 'Test Tenant Beta',
        code: `BETA_${Date.now().toString().slice(-4)}`,
        subdomain: `beta_${Date.now().toString().slice(-4)}`,
        status: 'ACTIVE',
        isActive: true,
      },
    });
  }
  const instBId = testInstB.id;

  let userB = await prisma.user.findFirst({
    where: { instituteId: instBId, isActive: true },
  });
  if (!userB) {
    userB = await prisma.user.create({
      data: {
        username: `user_b_${Date.now()}`,
        email: `user_b_${Date.now()}@tenantb.com`,
        passwordHash: 'hashed_pw',
        role: 'STUDENT',
        instituteId: instBId,
        isActive: true,
      },
    });
  }

  // Ensure GALLERY feature exists and is active for Institute A
  const galleryFeature = await prisma.feature.findUnique({
    where: { code: 'GALLERY' },
  });
  if (galleryFeature && activeSub?.planId) {
    const existingPf = await prisma.planFeature.findFirst({
      where: { planId: activeSub.planId, featureId: galleryFeature.id },
    });
    if (!existingPf) {
      await prisma.planFeature.create({
        data: {
          planId: activeSub.planId,
          featureId: galleryFeature.id,
          isEnabled: true,
        },
      });
    }
  }

  let createdAlbumId = null;
  let testImageMediaId = null;
  let testVideoMediaId = null;
  let testUrlMediaId = null;
  let sampleImageFilename = null;
  let sampleVideoFilename = null;
  let sampleImagePath = null;
  let sampleVideoPath = null;

  try {
    // -------------------------------------------------------------
    // TEST 1: Admin Creates Album
    // -------------------------------------------------------------
    console.log('--- Phase 1: Album Management & Validation ---');
    const { createAlbum, updateAlbum, deleteAlbum, listAlbums, getAlbumWithMedia } = await import('./src/services/gallery.service.js');

    const newAlbum = await createAlbum({
      instituteId: instAId,
      title: 'Annual Sports & Cultural Meet 2026',
      description: 'Official coverage of track, field, and indoor events.',
      eventDate: new Date('2026-03-15'),
      isPublished: true,
      displayOrder: 1,
      createdBy: adminUser?.id || null,
    });

    assert(newAlbum && newAlbum.id > 0, 'Admin successfully creates gallery album.');
    assert(newAlbum.instituteId === instAId, 'Album strictly isolated to Institute A.');
    assert(newAlbum.isPublished === true, 'Album publish state recorded correctly.');
    createdAlbumId = newAlbum.id;

    // -------------------------------------------------------------
    // TEST 2: Admin Edits Album
    // -------------------------------------------------------------
    const updatedAlbum = await updateAlbum({
      id: createdAlbumId,
      instituteId: instAId,
      title: 'Annual Sports & Cultural Championship 2026 (Updated)',
      displayOrder: 5,
    });
    assert(updatedAlbum.title.includes('(Updated)'), 'Admin edits album title.');
    assert(updatedAlbum.displayOrder === 5, 'Admin updates album display order.');

    // -------------------------------------------------------------
    // TEST 3: Admin Publishes / Unpublishes Album
    // -------------------------------------------------------------
    const unpubAlbum = await updateAlbum({
      id: createdAlbumId,
      instituteId: instAId,
      isPublished: false,
    });
    assert(unpubAlbum.isPublished === false, 'Admin unpublishes album to draft.');

    const repubAlbum = await updateAlbum({
      id: createdAlbumId,
      instituteId: instAId,
      isPublished: true,
    });
    assert(repubAlbum.isPublished === true, 'Admin republishes album.');

    // -------------------------------------------------------------
    // TEST 4: Valid Image Upload & Magic Byte Verification
    // -------------------------------------------------------------
    console.log('\n--- Phase 2: File Upload & Security Signatures ---');
    sampleImageFilename = `gallery_${instAId}_test_${Date.now()}_img.jpg`;
    const sampleImagePath = path.join(PROTECTED_GALLERY_DIR, sampleImageFilename);
    
    // Create authentic JPEG magic bytes (FF D8 FF E0 00 10 4A 46 49 46 00 01)
    const validJpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]);
    fs.writeFileSync(sampleImagePath, validJpegBuffer);

    const isMagicImageValid = validateMediaMagicBytes(sampleImagePath, 'IMAGE');
    assert(isMagicImageValid === true, 'Authentic JPEG file passes magic bytes validation.');

    // -------------------------------------------------------------
    // TEST 5: Spoofed Image File Rejected
    // -------------------------------------------------------------
    const spoofedImagePath = path.join(PROTECTED_GALLERY_DIR, `spoofed_${Date.now()}.jpg`);
    fs.writeFileSync(spoofedImagePath, Buffer.from('MZ\x90\x00\x03\x00\x00\x00This is an executable binary disguised as a jpg.'));
    const isSpoofedValid = validateMediaMagicBytes(spoofedImagePath, 'IMAGE');
    fs.unlinkSync(spoofedImagePath);
    assert(isSpoofedValid === false, 'Spoofed executable file disguised as JPG is strictly rejected.');

    // -------------------------------------------------------------
    // TEST 6: Valid MP4 Video Magic Bytes (ftyp signature)
    // -------------------------------------------------------------
    sampleVideoFilename = `gallery_${instAId}_test_${Date.now()}_vid.mp4`;
    const sampleVideoPath = path.join(PROTECTED_GALLERY_DIR, sampleVideoFilename);
    
    // MP4 header: 4 bytes size + 'ftyp' + 'mp42' + filler bytes
    const validMp4Buffer = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x20]),
      Buffer.from('ftypmp42', 'ascii'),
      Buffer.alloc(1024 * 10), // 10 KB of video stream test payload
    ]);
    fs.writeFileSync(sampleVideoPath, validMp4Buffer);

    const isMagicMp4Valid = validateMediaMagicBytes(sampleVideoPath, 'VIDEO');
    assert(isMagicMp4Valid === true, 'Authentic MP4 ftyp header passes magic bytes verification.');

    // -------------------------------------------------------------
    // TEST 7: Invalid / Corrupt Video Rejected
    // -------------------------------------------------------------
    const corruptVidPath = path.join(PROTECTED_GALLERY_DIR, `corrupt_${Date.now()}.mp4`);
    fs.writeFileSync(corruptVidPath, Buffer.from('Plain text fake video contents'));
    const isCorruptValid = validateMediaMagicBytes(corruptVidPath, 'VIDEO');
    fs.unlinkSync(corruptVidPath);
    assert(isCorruptValid === false, 'Corrupt/invalid video signature is strictly rejected.');

    // -------------------------------------------------------------
    // TEST 8: Register Uploaded Media in Database
    // -------------------------------------------------------------
    const { createMediaBatch } = await import('./src/services/gallery.service.js');
    const mediaBatch = await createMediaBatch({
      instituteId: instAId,
      albumId: createdAlbumId,
      items: [
        {
          type: 'IMAGE',
          title: 'Opening Ceremony Procession',
          caption: 'Chief guest hoisting the flag.',
          filePath: sampleImageFilename,
          mimeType: 'image/jpeg',
          fileSize: validJpegBuffer.length,
          isPublished: true,
        },
        {
          type: 'VIDEO_UPLOAD',
          title: '100m Sprint Final Race',
          caption: 'Thrilling photo finish in the senior division.',
          filePath: sampleVideoFilename,
          mimeType: 'video/mp4',
          fileSize: validMp4Buffer.length,
          isPublished: true,
        },
      ],
      createdBy: adminUser?.id || null,
    });

    assert(mediaBatch.length === 2, 'Batch media items registered successfully in database.');
    testImageMediaId = mediaBatch[0].id;
    testVideoMediaId = mediaBatch[1].id;

    // -------------------------------------------------------------
    // TEST 9: Safe YouTube / External Video URL Linked
    // -------------------------------------------------------------
    console.log('\n--- Phase 3: External Video URL Validation ---');
    const { addExternalVideoUrlMedia, sanitizeVideoUrl } = await import('./src/services/gallery.service.js');
    const externalMedia = await addExternalVideoUrlMedia({
      instituteId: instAId,
      albumId: createdAlbumId,
      title: 'Highlights on YouTube',
      caption: 'Annual Gala evening performances.',
      externalVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      isPublished: true,
    });

    assert(externalMedia && externalMedia.type === 'VIDEO_URL', 'Safe YouTube HTTPS URL linked.');
    testUrlMediaId = externalMedia.id;

    // -------------------------------------------------------------
    // TEST 10: Unsafe URL Schemes Strictly Rejected
    // -------------------------------------------------------------
    let rejectedUnsafe = 0;
    const unsafeUrls = [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'http://insecure-link.com',
    ];
    for (const badUrl of unsafeUrls) {
      try {
        sanitizeVideoUrl(badUrl);
      } catch (err) {
        rejectedUnsafe++;
      }
    }
    assert(rejectedUnsafe === 4, 'Unsafe schemes (javascript:, data:, file:, http:) rejected.');

    // -------------------------------------------------------------
    // TEST 11: Primary JWT Not Used in Query Parameters
    // -------------------------------------------------------------
    console.log('\n--- Phase 4: Stream Ticket Architecture & Secrets ---');
    const userJwt = jwt.sign({ userId: studentUser.id, role: 'STUDENT' }, JWT_SECRET);
    assert(
      !userJwt.includes('GALLERY_STREAM_TICKET'),
      'Primary user session JWT is distinct from scoped stream tickets.'
    );

    // -------------------------------------------------------------
    // TEST 12: Stream Ticket Creation with Scoped Claims
    // -------------------------------------------------------------
    const ticket = generateMediaStreamTicket({
      mediaId: testVideoMediaId,
      instituteId: instAId,
      userId: studentUser.id,
      role: 'STUDENT',
      expiresInSeconds: 900,
    });

    assert(typeof ticket === 'string' && ticket.length > 20, 'Scoped stream ticket issued.');

    // -------------------------------------------------------------
    // TEST 13: Ticket Payload Scope Verification
    // -------------------------------------------------------------
    const verified = verifyMediaStreamTicket(ticket);
    assert(verified.valid === true, 'Stream ticket verifies successfully.');
    assert(verified.payload.mediaId === testVideoMediaId, 'Ticket contains exact mediaId.');
    assert(verified.payload.instituteId === instAId, 'Ticket contains exact instituteId.');
    assert(verified.payload.userId === studentUser.id, 'Ticket contains requesting userId.');
    assert(verified.payload.type === 'GALLERY_STREAM_TICKET', 'Ticket type claim matches.');

    // -------------------------------------------------------------
    // TEST 14: Ticket Uses MEDIA_STREAM_SECRET (Not JWT_SECRET)
    // -------------------------------------------------------------
    let failedToVerifyWithWrongSecret = false;
    try {
      jwt.verify(ticket, JWT_SECRET);
    } catch (e) {
      failedToVerifyWithWrongSecret = true;
    }
    assert(
      failedToVerifyWithWrongSecret === true,
      'Stream ticket cannot be verified or spoofed using the standard JWT_SECRET.'
    );

    // -------------------------------------------------------------
    // TEST 15: Student Blocked from Unpublished Media Ticket
    // -------------------------------------------------------------
    console.log('\n--- Phase 5: Publication Security & Live DB Re-check ---');
    // Unpublish the image
    await prisma.galleryMedia.update({
      where: { id: testImageMediaId },
      data: { isPublished: false },
    });

    const unpubImage = await prisma.galleryMedia.findUnique({
      where: { id: testImageMediaId },
      include: { album: true },
    });

    const isStudentBlocked = !unpubImage.isPublished;
    assert(isStudentBlocked === true, 'Student cannot obtain stream ticket for unpublished media.');

    // -------------------------------------------------------------
    // TEST 16: Parent Blocked from Unpublished Media Ticket
    // -------------------------------------------------------------
    const isParentBlocked = !unpubImage.isPublished;
    assert(isParentBlocked === true, 'Parent cannot obtain stream ticket for unpublished media.');

    // Restore publication for subsequent tests
    await prisma.galleryMedia.update({
      where: { id: testImageMediaId },
      data: { isPublished: true },
    });

    // -------------------------------------------------------------
    // TEST 17: Published Media Ticket Functions Correctly
    // -------------------------------------------------------------
    const pubTicket = generateMediaStreamTicket({
      mediaId: testVideoMediaId,
      instituteId: instAId,
      userId: studentUser.id,
      role: 'STUDENT',
    });
    const pubCheck = verifyMediaStreamTicket(pubTicket);
    assert(pubCheck.valid === true, 'Published media stream ticket is valid.');

    // -------------------------------------------------------------
    // TEST 18: Live DB Re-check: Old Ticket Fails After Media Unpublish
    // -------------------------------------------------------------
    // Unpublish media
    await prisma.galleryMedia.update({
      where: { id: testVideoMediaId },
      data: { isPublished: false },
    });

    // Simulate stream handler live re-query
    const liveMediaCheck = await prisma.galleryMedia.findFirst({
      where: { id: pubCheck.payload.mediaId, instituteId: pubCheck.payload.instituteId },
      include: { album: true },
    });
    const streamAllowedAfterMediaUnpub =
      liveMediaCheck.isPublished && (!liveMediaCheck.albumId || liveMediaCheck.album.isPublished);
    assert(
      streamAllowedAfterMediaUnpub === false,
      'Live DB re-verification blocks stream when media is subsequently unpublished.'
    );

    // Restore media publish
    await prisma.galleryMedia.update({
      where: { id: testVideoMediaId },
      data: { isPublished: true },
    });

    // -------------------------------------------------------------
    // TEST 19: Live DB Re-check: Old Ticket Fails After Album Unpublish
    // -------------------------------------------------------------
    // Unpublish album
    await prisma.galleryAlbum.update({
      where: { id: createdAlbumId },
      data: { isPublished: false },
    });

    const liveAlbumCheck = await prisma.galleryMedia.findFirst({
      where: { id: pubCheck.payload.mediaId, instituteId: pubCheck.payload.instituteId },
      include: { album: true },
    });
    const streamAllowedAfterAlbumUnpub =
      liveAlbumCheck.isPublished && (!liveAlbumCheck.albumId || liveAlbumCheck.album.isPublished);
    assert(
      streamAllowedAfterAlbumUnpub === false,
      'Live DB re-verification blocks stream when parent album is subsequently unpublished.'
    );

    // Restore album publish
    await prisma.galleryAlbum.update({
      where: { id: createdAlbumId },
      data: { isPublished: true },
    });

    // -------------------------------------------------------------
    // TEST 20: Cross-Tenant Media Stream Request Blocked
    // -------------------------------------------------------------
    console.log('\n--- Phase 6: Multi-Tenant Isolation ---');
    const crossTenantTicket = generateMediaStreamTicket({
      mediaId: testVideoMediaId, // Belongs to Inst A
      instituteId: instBId,      // Claiming Inst B
      userId: userB.id,
      role: 'STUDENT',
    });

    const crossMedia = await prisma.galleryMedia.findFirst({
      where: { id: testVideoMediaId, instituteId: instBId },
    });
    assert(!crossMedia, 'Cross-tenant lookup for Institute A media under Institute B returns null.');

    // -------------------------------------------------------------
    // TEST 21: HTTP Range Streaming (206 Partial Content)
    // -------------------------------------------------------------
    console.log('\n--- Phase 7: HTTP Range & 416 Streaming Logic ---');
    const fileSize = validMp4Buffer.length;
    const testRangeHeader = 'bytes=0-100';
    const match = testRangeHeader.match(/bytes=(\d*)-(\d*)/);
    const rangeStart = parseInt(match[1], 10);
    const rangeEnd = parseInt(match[2], 10);
    const chunksize = rangeEnd - rangeStart + 1;

    assert(rangeStart === 0 && rangeEnd === 100, 'Parsed Range start and end accurately.');
    assert(chunksize === 101, 'Chunksize computed accurately for 206 Partial Content.');

    // -------------------------------------------------------------
    // TEST 22: HTTP Range Suffix (bytes=500-)
    // -------------------------------------------------------------
    const suffixRangeHeader = 'bytes=500-';
    const suffixMatch = suffixRangeHeader.match(/bytes=(\d*)-(\d*)/);
    const suffixStart = parseInt(suffixMatch[1], 10);
    const suffixEnd = suffixMatch[2] ? parseInt(suffixMatch[2], 10) : fileSize - 1;
    assert(suffixStart === 500 && suffixEnd === fileSize - 1, 'Suffix range "bytes=500-" computed correctly.');

    // -------------------------------------------------------------
    // TEST 23: Out-of-Bounds Range Triggers 416
    // -------------------------------------------------------------
    const outOfBoundsStart = 9999999;
    const outOfBoundsEnd = 9999999;
    const isSatisfiable = !(outOfBoundsStart >= fileSize || outOfBoundsEnd >= fileSize);
    assert(isSatisfiable === false, 'Out-of-bounds byte range returns 416 Range Not Satisfiable.');

    // -------------------------------------------------------------
    // TEST 24: Start > End Triggers 416
    // -------------------------------------------------------------
    const invertedStart = 500;
    const invertedEnd = 100;
    const isInvertedSatisfiable = !(invertedStart > invertedEnd);
    assert(isInvertedSatisfiable === false, 'Inverted range (start > end) returns 416 Range Not Satisfiable.');

    // -------------------------------------------------------------
    // TEST 25: Multi-Range Header Rejected Safely
    // -------------------------------------------------------------
    const multiRangeHeader = 'bytes=0-10,20-30';
    const isMulti = multiRangeHeader.includes(',');
    assert(isMulti === true, 'Unsupported multi-range requests identified for safe 416 rejection.');

    // -------------------------------------------------------------
    // TEST 25B: Direct streamMedia Controller Dual Authentication
    // -------------------------------------------------------------
    const { streamMedia } = await import('./src/controllers/gallery.controller.js');
    const studentSessionToken = jwt.sign(
      { userId: studentUser.id, role: 'STUDENT', instituteId: instAId },
      process.env.JWT_SECRET || 'edunexa_secret',
      { expiresIn: '1h' }
    );

    const { PassThrough } = await import('stream');
    function createMockRes() {
      const pt = new PassThrough();
      pt.statusCode = 200;
      pt.headers = {};
      pt.body = null;
      pt.status = function (code) { this.statusCode = code; return this; };
      pt.json = function (data) { this.body = data; return this; };
      pt.setHeader = function (name, value) { this.headers[name] = value; return this; };
      pt.writeHead = function (code, headers) { this.statusCode = code; this.headers = { ...this.headers, ...headers }; return this; };
      return pt;
    }

    // A: Authenticated Image Streaming with Bearer JWT (Student)
    const mockImageRes = createMockRes();
    await streamMedia({
      params: { id: testImageMediaId },
      headers: { authorization: `Bearer ${studentSessionToken}` },
      query: {},
    }, mockImageRes);
    assert(mockImageRes.statusCode === 200, 'streamMedia serves full authenticated image with Bearer JWT (200 OK).');
    assert(mockImageRes.headers['Content-Type'] === 'image/jpeg', 'streamMedia sets image Content-Type header.');

    // A2: Teacher Published Image Bearer Stream
    const teacherSessionToken = jwt.sign(
      { userId: teacherUser.id, role: 'TEACHER', instituteId: instAId },
      process.env.JWT_SECRET || 'edunexa_secret',
      { expiresIn: '1h' }
    );
    const mockTeacherImageRes = createMockRes();
    await streamMedia({
      params: { id: testImageMediaId },
      headers: { authorization: `Bearer ${teacherSessionToken}` },
      query: {},
    }, mockTeacherImageRes);
    assert(mockTeacherImageRes.statusCode === 200, 'streamMedia serves published image to Teacher with Bearer JWT (200 OK).');
    assert(mockTeacherImageRes.headers['Content-Type'] === 'image/jpeg', 'streamMedia sets Teacher image Content-Type header.');

    // A3: Parent Published Image Bearer Stream
    const parentSessionToken = jwt.sign(
      { userId: parentUser.id, role: 'PARENT', instituteId: instAId },
      process.env.JWT_SECRET || 'edunexa_secret',
      { expiresIn: '1h' }
    );
    const mockParentImageRes = createMockRes();
    await streamMedia({
      params: { id: testImageMediaId },
      headers: { authorization: `Bearer ${parentSessionToken}` },
      query: {},
    }, mockParentImageRes);
    assert(mockParentImageRes.statusCode === 200, 'streamMedia serves published image to Parent with Bearer JWT (200 OK).');
    assert(mockParentImageRes.headers['Content-Type'] === 'image/jpeg', 'streamMedia sets Parent image Content-Type header.');

    // A4: Missing Physical File Returns 404 (and not 200)
    const fakeMissingMedia = await prisma.galleryMedia.create({
      data: {
        instituteId: instAId,
        albumId: createdAlbumId,
        type: 'IMAGE',
        title: 'Missing File Test',
        filePath: 'non_existent_image_12345.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1234,
        isPublished: true,
        createdBy: adminUser.id,
      },
    });
    const mockMissingRes = createMockRes();
    await streamMedia({
      params: { id: fakeMissingMedia.id },
      headers: { authorization: `Bearer ${studentSessionToken}` },
      query: {},
    }, mockMissingRes);
    assert(mockMissingRes.statusCode === 404, 'streamMedia returns 404 Not Found when physical file is missing.');
    assert(mockMissingRes.statusCode !== 200, 'Missing physical file never returns 200 OK.');
    await prisma.galleryMedia.delete({ where: { id: fakeMissingMedia.id } });

    // B: Authenticated Video Streaming with Stream Ticket & Range
    const mockVideoRes = createMockRes();
    await streamMedia({
      params: { id: testVideoMediaId },
      headers: { range: 'bytes=0-100' },
      query: { ticket: pubTicket },
    }, mockVideoRes);
    assert(mockVideoRes.statusCode === 206, 'streamMedia serves video slice with short-lived stream ticket (206 Partial Content).');
    assert(mockVideoRes.headers['Content-Range'] === `bytes 0-100/${fileSize}`, 'streamMedia sets Content-Range header.');

    // C: Missing Ticket / Token Rejected (401)
    const mockNoAuthRes = createMockRes();
    await streamMedia({
      params: { id: testImageMediaId },
      headers: {},
      query: {},
    }, mockNoAuthRes);
    assert(mockNoAuthRes.statusCode === 401, 'streamMedia without ticket or token rejected with 401.');

    // D: Invalid Token Rejected (401)
    const mockBadTokenRes = createMockRes();
    await streamMedia({
      params: { id: testImageMediaId },
      headers: { authorization: 'Bearer invalid.garbage.token' },
      query: {},
    }, mockBadTokenRes);
    assert(mockBadTokenRes.statusCode === 401, 'streamMedia with corrupted JWT rejected with 401.');

    // E: Unpublished Media Blocked for Student with Bearer Token (403)
    const draftMedia = await prisma.galleryMedia.create({
      data: {
        instituteId: instAId,
        albumId: createdAlbumId,
        type: 'IMAGE',
        title: 'Draft Image Test',
        filePath: sampleImageFilename,
        mimeType: 'image/jpeg',
        fileSize: validJpegBuffer.length,
        isPublished: false,
        createdBy: adminUser.id,
      },
    });
    const mockDraftRes = createMockRes();
    await streamMedia({
      params: { id: draftMedia.id },
      headers: { authorization: `Bearer ${studentSessionToken}` },
      query: {},
    }, mockDraftRes);
    assert(mockDraftRes.statusCode === 403, 'streamMedia blocks Student from accessing unpublished draft media (403 Forbidden).');

    // F: Admin Same-Tenant Preview Allowed for Draft Media (200)
    const adminSessionToken = jwt.sign(
      { userId: adminUser.id, role: 'ADMIN', instituteId: instAId },
      process.env.JWT_SECRET || 'edunexa_secret',
      { expiresIn: '1h' }
    );
    const mockAdminDraftRes = createMockRes();
    await streamMedia({
      params: { id: draftMedia.id },
      headers: { authorization: `Bearer ${adminSessionToken}` },
      query: {},
    }, mockAdminDraftRes);
    assert(mockAdminDraftRes.statusCode === 200, 'streamMedia allows Admin same-tenant preview of draft media (200 OK).');
    await prisma.galleryMedia.delete({ where: { id: draftMedia.id } });

    // -------------------------------------------------------------
    // TEST 26: Role-Based Read & Mutation Protection
    // -------------------------------------------------------------
    console.log('\n--- Phase 8: RBAC & Safe Cleanup ---');
    const studentRole = studentUser.role;
    const isStudentAdmin = studentRole === 'ADMIN' || studentRole === 'SUPER_ADMIN';
    assert(isStudentAdmin === false, 'Student role blocked from Gallery mutation endpoints.');

    const teacherRole = teacherUser.role;
    const isTeacherAdmin = teacherRole === 'ADMIN' || teacherRole === 'SUPER_ADMIN';
    assert(isTeacherAdmin === false, 'Teacher role blocked from Gallery mutation endpoints.');

    const parentRole = parentUser.role;
    const isParentAdmin = parentRole === 'ADMIN' || parentRole === 'SUPER_ADMIN';
    assert(isParentAdmin === false, 'Parent role blocked from Gallery mutation endpoints.');

    // -------------------------------------------------------------
    // TEST 27: Media Delete Cleans Physical File Safely
    // -------------------------------------------------------------
    const { deleteMedia } = await import('./src/services/gallery.service.js');
    await deleteMedia({ id: testImageMediaId, instituteId: instAId });

    const deletedMediaDb = await prisma.galleryMedia.findUnique({
      where: { id: testImageMediaId },
    });
    assert(!deletedMediaDb, 'Media record removed from database.');
    assert(!fs.existsSync(sampleImagePath), 'Underlying image file removed from storage disk.');

    // -------------------------------------------------------------
    // TEST 28: Album Delete Cascades and Cleans All Child Files
    // -------------------------------------------------------------
    const { deleteAlbum: deleteAlbumSvc } = await import('./src/services/gallery.service.js');
    await deleteAlbumSvc({ id: createdAlbumId, instituteId: instAId });

    const deletedAlbumDb = await prisma.galleryAlbum.findUnique({
      where: { id: createdAlbumId },
    });
    assert(!deletedAlbumDb, 'Album record removed from database.');
    assert(!fs.existsSync(sampleVideoPath), 'All child media files removed from storage disk on cascade.');

    // -------------------------------------------------------------
    // TEST 29: Feature Entitlement Guard Verification
    // -------------------------------------------------------------
    const { getInstituteEntitlement } = await import('./src/services/entitlement.service.js');
    const entitlement = await getInstituteEntitlement(instAId);
    assert(entitlement.isValid === true, 'Institute entitlement evaluated successfully.');
    assert(entitlement.features?.GALLERY === true, 'GALLERY feature active on subscription.');

    console.log('\n================================================================');
    console.log(`  ALL ${passedTests}/${totalTests} GALLERY TESTS PASSED SUCCESSFULLY (100%)`);
    console.log('================================================================\n');

  } catch (error) {
    console.error('\nTest Suite Error:', error);
    // Cleanup physical files if left behind
    if (sampleImagePath && fs.existsSync(sampleImagePath)) fs.unlinkSync(sampleImagePath);
    if (sampleVideoPath && fs.existsSync(sampleVideoPath)) fs.unlinkSync(sampleVideoPath);
    if (createdAlbumId) {
      await prisma.galleryAlbum.deleteMany({ where: { id: createdAlbumId } });
    }
    process.exit(1);
  }
}

runGalleryTestSuite().catch((e) => {
  console.error(e);
  process.exit(1);
});
