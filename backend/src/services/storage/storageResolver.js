import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import {
  isR2Configured,
  uploadToR2,
  getObjectFromR2,
  deleteFromR2,
} from './r2Storage.service.js';

/**
 * Unified storage process helper.
 * Attempts upload to Cloudflare R2 if configured, verifies object existence,
 * and falls back to Railway Volume disk storage if R2 is unavailable or fails.
 *
 * @param {Object} params
 * @param {Buffer} [params.buffer] - Binary file buffer
 * @param {string} [params.filePath] - Local temp file path on disk
 * @param {string} params.r2Key - Target R2 object key (e.g. institutes/15/gallery/abc.jpg)
 * @param {string} params.localDir - Local target directory fallback (e.g. uploads/gallery/protected)
 * @param {string} params.localFilename - Local filename fallback
 * @param {string} params.mimeType - File MIME type
 * @param {string} [params.moduleName] - Safe module identifier for logging (e.g. gallery, study-materials)
 * @returns {Promise<{ storageRef: string, isR2: boolean, localPath?: string }>}
 */
export async function processStorageUpload({
  buffer,
  filePath,
  r2Key,
  localDir,
  localFilename,
  mimeType,
  moduleName = 'general',
}) {
  let fileBuffer = buffer || null;
  if (!fileBuffer && filePath && fs.existsSync(filePath)) {
    try {
      fileBuffer = fs.readFileSync(filePath);
    } catch (readErr) {
      console.error(`[storage] Failed to read file buffer from '${filePath}':`, readErr.message);
    }
  }

  // 1. Attempt Cloudflare R2 Upload if configured
  if (isR2Configured() && fileBuffer) {
    try {
      await uploadToR2({
        buffer: fileBuffer,
        key: r2Key,
        contentType: mimeType,
      });

      // Verification Step: Confirm object is readable from R2
      const verification = await getObjectFromR2(r2Key);
      if (verification && verification.Body) {
        console.log(`[storage] R2 upload success module=${moduleName} key=${r2Key}`);

        // Cleanup local temp file if created by Multer diskStorage
        if (filePath && fs.existsSync(filePath) && (filePath.includes('temp') || filePath.includes('tmp') || filePath.includes('multer'))) {
          try { fs.unlinkSync(filePath); } catch (e) {}
        }

        return {
          storageRef: `r2://${r2Key}`,
          isR2: true,
        };
      } else {
        throw new Error('Uploaded object verification failed on R2.');
      }
    } catch (r2Err) {
      console.warn(`[storage] R2 upload failed module=${moduleName}; using volume fallback. Error:`, r2Err.message);
    }
  }

  // 2. Fallback to Railway Volume disk storage
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  const targetLocalPath = path.join(localDir, localFilename);

  if (filePath && filePath !== targetLocalPath && fs.existsSync(filePath)) {
    try {
      fs.copyFileSync(filePath, targetLocalPath);
      if (filePath.includes('temp') || filePath.includes('tmp') || filePath.includes('multer')) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    } catch (copyErr) {
      console.error(`[storage] Failed to move fallback temp file to '${targetLocalPath}':`, copyErr.message);
    }
  } else if (fileBuffer && !fs.existsSync(targetLocalPath)) {
    fs.writeFileSync(targetLocalPath, fileBuffer);
  }

  const relativePath = path.relative(process.cwd(), targetLocalPath).replace(/\\/g, '/');
  const normalizedRef = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

  console.log(`[storage] Local volume storage success module=${moduleName} path=${normalizedRef}`);
  return {
    storageRef: normalizedRef,
    isR2: false,
    localPath: targetLocalPath,
  };
}

/**
 * Physical storage transport resolver.
 * Resolves a storage reference (r2://... or local disk path) to a stream/buffer.
 * DOES NOT perform user authorization. Authorization MUST be performed by caller.
 *
 * @param {string} storageRef - Storage reference string (r2://... or /uploads/...)
 * @param {Object} [options]
 * @param {string} [options.range] - HTTP Range header string (e.g. bytes=0-1024)
 * @returns {Promise<{ type: 'R2'|'LOCAL', stream: import('stream').Readable, contentType: string, contentLength?: number, contentRange?: string, statusCode?: number }|null>}
 */
export async function getStorageResource(storageRef, options = {}) {
  if (!storageRef || typeof storageRef !== 'string') {
    return null;
  }

  // 1. Resolve Cloudflare R2 object
  if (storageRef.startsWith('r2://')) {
    const key = storageRef.slice(5); // strip 'r2://'
    try {
      const r2Object = await getObjectFromR2(key, options.range);
      const mimeType = r2Object.ContentType || mime.lookup(key) || 'application/octet-stream';
      return {
        type: 'R2',
        stream: r2Object.Body,
        contentType: mimeType,
        contentLength: r2Object.ContentLength,
        contentRange: r2Object.ContentRange,
        statusCode: r2Object.StatusCode || (options.range ? 206 : 200),
      };
    } catch (err) {
      console.error(`[storage] Failed to retrieve R2 object key '${key}':`, err.message);
      return null;
    }
  }

  // 2. Resolve local Railway Volume file
  let resolvedPath = storageRef;
  if (storageRef.startsWith('/') || storageRef.startsWith('\\')) {
    const candidate1 = path.join(process.cwd(), storageRef.slice(1));
    const candidate2 = path.join(process.cwd(), 'backend', storageRef.slice(1));
    if (fs.existsSync(candidate1)) {
      resolvedPath = candidate1;
    } else if (fs.existsSync(candidate2)) {
      resolvedPath = candidate2;
    } else {
      resolvedPath = candidate1;
    }
  } else if (!path.isAbsolute(storageRef)) {
    const candidate1 = path.join(process.cwd(), storageRef);
    const candidate2 = path.join(process.cwd(), 'backend', storageRef);
    if (fs.existsSync(candidate1)) {
      resolvedPath = candidate1;
    } else if (fs.existsSync(candidate2)) {
      resolvedPath = candidate2;
    } else {
      resolvedPath = candidate1;
    }
  }

  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    const stat = fs.statSync(resolvedPath);
    const mimeType = mime.lookup(resolvedPath) || 'application/octet-stream';

    let streamOptions = {};
    let statusCode = 200;
    let contentRange = undefined;
    let contentLength = stat.size;

    if (options.range) {
      const parts = options.range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

      if (!isNaN(start) && !isNaN(end) && start <= end && end < stat.size) {
        streamOptions = { start, end };
        statusCode = 206;
        contentLength = end - start + 1;
        contentRange = `bytes ${start}-${end}/${stat.size}`;
      }
    }

    const fileStream = fs.createReadStream(resolvedPath, streamOptions);
    return {
      type: 'LOCAL',
      stream: fileStream,
      filePath: resolvedPath,
      contentType: mimeType,
      contentLength,
      contentRange,
      statusCode,
    };
  }

  return null;
}

/**
 * Safe non-blocking storage cleanup helper.
 * Removes underlying file from R2 or local disk.
 * Errors are logged safely so they never corrupt database operations.
 *
 * @param {string} storageRef - Storage reference (r2://... or /uploads/...)
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function deleteStorageResource(storageRef) {
  if (!storageRef || typeof storageRef !== 'string') {
    return { success: true };
  }

  if (storageRef.startsWith('r2://')) {
    const key = storageRef.slice(5);
    try {
      return await deleteFromR2(key);
    } catch (err) {
      console.error(`[storage] Non-fatal error deleting R2 object key '${key}':`, err.message);
      return { success: false, error: err.message };
    }
  }

  const cleanPath = storageRef.startsWith('/') ? storageRef.slice(1) : storageRef;
  const resolvedPath = path.isAbsolute(storageRef)
    ? storageRef
    : path.join(process.cwd(), cleanPath);

  if (fs.existsSync(resolvedPath)) {
    try {
      fs.unlinkSync(resolvedPath);
      return { success: true };
    } catch (err) {
      console.error(`[storage] Non-fatal error deleting local file '${resolvedPath}':`, err.message);
      return { success: false, error: err.message };
    }
  }

  return { success: true };
}
