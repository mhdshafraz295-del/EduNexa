import prisma from './src/config/prisma.js';
import { isR2Configured, getR2Client, setR2MockHandlers } from './src/services/storage/r2Storage.service.js';
import { processStorageUpload, getStorageResource, deleteStorageResource } from './src/services/storage/storageResolver.js';
import { PROTECTED_GALLERY_DIR, PROTECTED_STUDY_MATERIAL_DIR, PUBLIC_LOGO_DIR } from './src/middleware/upload.middleware.js';
import fs from 'fs';
import path from 'path';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  ✗ Test ${totalTests} FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✓ Test ${totalTests}: ${message}`);
}

async function runPhase2TestSuite() {
  console.log('\n================================================================');
  console.log('  EDUNEXA PHASE 2: COMPLETE CLOUDFLARE R2 MIGRATION TEST SUITE');
  console.log('================================================================\n');

  // Set up in-memory mock R2 bucket for testing
  const inMemoryBucket = new Map();

  setR2MockHandlers({
    uploadToR2: async ({ buffer, key, contentType }) => {
      inMemoryBucket.set(key, { buffer, contentType });
      return { success: true, key };
    },
    getObjectFromR2: async (key, range) => {
      if (!inMemoryBucket.has(key)) {
        const err = new Error('NoSuchKey');
        err.name = 'NoSuchKey';
        throw err;
      }
      const item = inMemoryBucket.get(key);
      const buffer = item.buffer;
      let start = 0;
      let end = buffer.length - 1;
      let statusCode = 200;
      let contentRange = undefined;

      if (range) {
        const match = range.match(/bytes=(\d*)-(\d*)/);
        if (match) {
          start = match[1] ? parseInt(match[1], 10) : 0;
          end = match[2] ? parseInt(match[2], 10) : buffer.length - 1;
          statusCode = 206;
          contentRange = `bytes ${start}-${end}/${buffer.length}`;
        }
      }

      const slicedBuffer = buffer.slice(start, end + 1);

      return {
        Body: {
          pipe: (res) => {
            if (res.setHeader) {
              res.setHeader('Content-Type', item.contentType);
              if (contentRange) res.setHeader('Content-Range', contentRange);
            }
            res.end(slicedBuffer);
          },
        },
        ContentType: item.contentType,
        ContentLength: slicedBuffer.length,
        ContentRange: contentRange,
        StatusCode: statusCode,
      };
    },
    deleteFromR2: async (key) => {
      inMemoryBucket.delete(key);
      return { success: true };
    },
  });

  // Enable R2 env variables for testing
  process.env.R2_ACCESS_KEY_ID = 'test_access_key';
  process.env.R2_SECRET_ACCESS_KEY = 'test_secret_key';
  process.env.R2_ENDPOINT = 'https://test.r2.cloudflarestorage.com';
  process.env.R2_BUCKET_NAME = 'test-edunexa-bucket';

  // ============================================================================
  // SECTION 1: STORAGE RESOLVER & R2 INTEGRATION
  // ============================================================================
  console.log('--- SECTION 1: STORAGE RESOLVER & R2 INTEGRATION ---');

  assert(isR2Configured() === true, 'isR2Configured() validates complete environment configuration.');

  // Test 2: Process Storage Upload to R2
  const sampleImageBuffer = Buffer.from('\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01', 'binary');
  const uploadRes = await processStorageUpload({
    buffer: sampleImageBuffer,
    r2Key: 'institutes/15/gallery/test_image.jpg',
    localDir: PROTECTED_GALLERY_DIR,
    localFilename: 'test_image.jpg',
    mimeType: 'image/jpeg',
    moduleName: 'gallery',
  });

  assert(uploadRes.isR2 === true, 'processStorageUpload detects R2 configuration and uploads to R2.');
  assert(uploadRes.storageRef === 'r2://institutes/15/gallery/test_image.jpg', 'Storage reference format strictly matches r2://<key>.');

  // Test 3: Retrieve Object from Storage Resolver
  const retrievedResource = await getStorageResource(uploadRes.storageRef);
  assert(retrievedResource !== null && retrievedResource.type === 'R2', 'getStorageResource resolves r2:// URI correctly.');
  assert(retrievedResource.contentType === 'image/jpeg', 'R2 resource preserves correct image MIME type.');

  // ============================================================================
  // SECTION 2: GALLERY VIDEO STREAMING & HTTP 206 RANGE HEADERS
  // ============================================================================
  console.log('\n--- SECTION 2: GALLERY VIDEO RANGE STREAMING (HTTP 206) ---');

  const mockVideoBuffer = Buffer.alloc(1000, 'A'); // 1KB sample video buffer
  const videoUploadRes = await processStorageUpload({
    buffer: mockVideoBuffer,
    r2Key: 'institutes/15/gallery/sample_video.mp4',
    localDir: PROTECTED_GALLERY_DIR,
    localFilename: 'sample_video.mp4',
    mimeType: 'video/mp4',
    moduleName: 'gallery',
  });

  assert(videoUploadRes.storageRef === 'r2://institutes/15/gallery/sample_video.mp4', 'Video uploaded to R2 under tenant path.');

  // Test 5: HTTP Range Request for Partial Video Seeking
  const rangeResource = await getStorageResource(videoUploadRes.storageRef, { range: 'bytes=0-499' });
  assert(rangeResource.statusCode === 206, 'Video range request returns status code 206 Partial Content.');
  assert(rangeResource.contentLength === 500, 'Video range stream correctly slices requested chunk size (500 bytes).');
  assert(rangeResource.contentRange === 'bytes 0-499/1000', 'Content-Range header formatted correctly.');

  // ============================================================================
  // SECTION 3: STUDY MATERIALS & RECEIPT ACCESS RULES
  // ============================================================================
  console.log('\n--- SECTION 3: STUDY MATERIALS & SUBSCRIPTION RECEIPTS ---');

  const pdfBuffer = Buffer.from('%PDF-1.4 sample pdf content for testing', 'utf-8');
  const pdfUpload = await processStorageUpload({
    buffer: pdfBuffer,
    r2Key: 'institutes/15/study-materials/math_notes.pdf',
    localDir: PROTECTED_STUDY_MATERIAL_DIR,
    localFilename: 'math_notes.pdf',
    mimeType: 'application/pdf',
    moduleName: 'study-materials',
  });

  assert(pdfUpload.storageRef === 'r2://institutes/15/study-materials/math_notes.pdf', 'Study Material PDF stored under R2 tenant path.');

  // Test 7: Subscription Receipt Tenant-Scoped Key Structure
  const subReceiptBuffer = Buffer.from('%PDF-1.4 bank transfer slip', 'utf-8');
  const subReceiptUpload = await processStorageUpload({
    buffer: subReceiptBuffer,
    r2Key: 'institutes/15/subscriptions/receipts/sub_slip_999.pdf',
    localDir: path.join(process.cwd(), 'uploads', 'receipts'),
    localFilename: 'sub_slip_999.pdf',
    mimeType: 'application/pdf',
    moduleName: 'subscriptions',
  });

  assert(
    subReceiptUpload.storageRef === 'r2://institutes/15/subscriptions/receipts/sub_slip_999.pdf',
    'Subscription receipt key structure is tenant-scoped institutes/<id>/subscriptions/receipts/...'
  );

  // ============================================================================
  // SECTION 4: MESSAGING & BROADCAST ATTACHMENTS
  // ============================================================================
  console.log('\n--- SECTION 4: MESSAGING & BROADCAST ATTACHMENTS ---');

  const msgAttachmentBuffer = Buffer.from('Message attachment document', 'utf-8');
  const msgUpload = await processStorageUpload({
    buffer: msgAttachmentBuffer,
    r2Key: 'institutes/15/messages/doc_abc.pdf',
    localDir: path.join(process.cwd(), 'uploads', 'messages', 'protected'),
    localFilename: 'doc_abc.pdf',
    mimeType: 'application/pdf',
    moduleName: 'messages',
  });

  assert(msgUpload.storageRef === 'r2://institutes/15/messages/doc_abc.pdf', 'Message attachment uploaded to R2 tenant directory.');

  // ============================================================================
  // SECTION 5: INSTITUTE BRANDING (LOGO, SIGNATURE, STAMP)
  // ============================================================================
  console.log('\n--- SECTION 5: INSTITUTE BRANDING ---');

  const logoBuffer = Buffer.from('\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01', 'binary');
  const logoUpload = await processStorageUpload({
    buffer: logoBuffer,
    r2Key: 'institutes/15/branding/logos/logo_15.jpg',
    localDir: PUBLIC_LOGO_DIR,
    localFilename: 'logo_15.jpg',
    mimeType: 'image/jpeg',
    moduleName: 'branding-logo',
  });

  assert(logoUpload.storageRef === 'r2://institutes/15/branding/logos/logo_15.jpg', 'Institute logo stored on R2.');

  // ============================================================================
  // SECTION 6: RAILWAY VOLUME FALLBACK ON R2 FAILURE
  // ============================================================================
  console.log('\n--- SECTION 6: RAILWAY VOLUME FALLBACK ON R2 FAILURE ---');

  // Temporarily simulate R2 upload failure
  setR2MockHandlers({
    uploadToR2: async () => {
      throw new Error('Simulated Cloudflare R2 Outage');
    },
  });

  const fallbackBuffer = Buffer.from('Fallback image content', 'utf-8');
  const fallbackUpload = await processStorageUpload({
    buffer: fallbackBuffer,
    r2Key: 'institutes/15/gallery/fallback_test.jpg',
    localDir: PROTECTED_GALLERY_DIR,
    localFilename: 'fallback_test.jpg',
    mimeType: 'image/jpeg',
    moduleName: 'gallery',
  });

  assert(fallbackUpload.isR2 === false, 'R2 outage triggers fallback to Railway Volume disk.');
  assert(fallbackUpload.storageRef.includes('uploads'), 'Fallback storageRef points to local uploads path.');
  assert(fs.existsSync(fallbackUpload.localPath), 'Local file created successfully on Railway Volume disk.');

  // Restore R2 mock handlers
  setR2MockHandlers({
    uploadToR2: async ({ buffer, key, contentType }) => {
      inMemoryBucket.set(key, { buffer, contentType });
      return { success: true, key };
    },
    getObjectFromR2: async (key, range) => {
      if (!inMemoryBucket.has(key)) throw new Error('NoSuchKey');
      const item = inMemoryBucket.get(key);
      return {
        Body: {
          pipe: (res) => {
            if (res.setHeader) res.setHeader('Content-Type', item.contentType);
            res.end(item.buffer);
          },
        },
        ContentType: item.contentType,
        ContentLength: item.buffer.length,
      };
    },
    deleteFromR2: async (key) => {
      inMemoryBucket.delete(key);
      return { success: true };
    },
  });

  // Clean up test file
  try { fs.unlinkSync(fallbackUpload.localPath); } catch (e) {}

  // ============================================================================
  // SECTION 7: LEGACY FILE COMPATIBILITY
  // ============================================================================
  console.log('\n--- SECTION 7: LEGACY FILE COMPATIBILITY ---');

  const legacyFilePath = path.join(PROTECTED_GALLERY_DIR, 'legacy_media_123.jpg');
  fs.writeFileSync(legacyFilePath, sampleImageBuffer);

  const legacyResource = await getStorageResource(`/uploads/gallery/protected/legacy_media_123.jpg`);
  assert(legacyResource !== null && legacyResource.type === 'LOCAL', 'getStorageResource seamlessly resolves legacy local volume files.');

  // Clean up legacy file
  try { fs.unlinkSync(legacyFilePath); } catch (e) {}

  // ============================================================================
  // SECTION 8: DECOUPLED DELETION SAFETY
  // ============================================================================
  console.log('\n--- SECTION 8: DECOUPLED DELETION SAFETY ---');

  // Test 12: Storage cleanup failure does not throw or crash
  setR2MockHandlers({
    deleteFromR2: async () => {
      throw new Error('Simulated R2 Delete Timeout');
    },
  });

  const deleteRes = await deleteStorageResource('r2://institutes/15/gallery/nonexistent.jpg');
  assert(deleteRes.success === false && deleteRes.error !== undefined, 'Storage deletion failure returns safe status without throwing uncaught exception.');

  console.log('\n================================================================');
  console.log(`  PASSED ALL ${passedTests} / ${totalTests} PHASE 2 STORAGE TEST SCENARIOS!`);
  console.log('================================================================\n');
}

runPhase2TestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nTest Suite Error:', err);
    process.exit(1);
  });
