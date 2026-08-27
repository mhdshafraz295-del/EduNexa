import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

let s3ClientInstance = null;
let mockHandlers = null;

/**
 * Registers custom mock handlers for testing.
 * @param {Object|null} handlers
 */
export function setR2MockHandlers(handlers) {
  mockHandlers = handlers;
}

/**
 * Validates if all mandatory Cloudflare R2 environment variables are present.
 * @returns {boolean} True if R2 configuration is complete.
 */
export function isR2Configured() {
  const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME } = process.env;
  return Boolean(
    R2_ACCESS_KEY_ID &&
    R2_SECRET_ACCESS_KEY &&
    R2_ENDPOINT &&
    R2_BUCKET_NAME
  );
}

/**
 * Returns a cached S3Client instance configured for Cloudflare R2.
 * @returns {S3Client|null} AWS S3Client instance or null if unconfigured.
 */
export function getR2Client() {
  if (!isR2Configured()) {
    return null;
  }

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: process.env.R2_REGION || 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  return s3ClientInstance;
}

/**
 * Uploads a buffer to Cloudflare R2 storage.
 * @param {Object} params
 * @param {Buffer} params.buffer - File binary content
 * @param {string} params.key - R2 object key (e.g. platform-cms/draft/abc.jpg)
 * @param {string} params.contentType - MIME type (image/jpeg, image/png, image/webp)
 * @returns {Promise<{success: boolean, key: string}>}
 */
export async function uploadToR2({ buffer, key, contentType }) {
  if (mockHandlers?.uploadToR2) {
    return mockHandlers.uploadToR2({ buffer, key, contentType });
  }

  const client = getR2Client();
  if (!client) {
    throw new Error('Cloudflare R2 storage is not configured.');
  }

  const bucket = process.env.R2_BUCKET_NAME;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);
  return { success: true, key };
}

/**
 * Retrieves an object from Cloudflare R2.
 * @param {string} key - R2 object key
 * @param {string} [range] - Optional HTTP Range header string (e.g. bytes=0-1024)
 * @returns {Promise<{Body: import('stream').Readable, ContentType: string, ContentLength: number, ContentRange?: string, StatusCode?: number}>}
 */
export async function getObjectFromR2(key, range) {
  if (mockHandlers?.getObjectFromR2) {
    return mockHandlers.getObjectFromR2(key, range);
  }

  const client = getR2Client();
  if (!client) {
    throw new Error('Cloudflare R2 storage is not configured.');
  }

  const bucket = process.env.R2_BUCKET_NAME;
  const commandInput = {
    Bucket: bucket,
    Key: key,
  };
  if (range) {
    commandInput.Range = range;
  }

  const command = new GetObjectCommand(commandInput);

  const response = await client.send(command);
  return {
    Body: response.Body,
    ContentType: response.ContentType || 'application/octet-stream',
    ContentLength: response.ContentLength,
    ContentRange: response.ContentRange,
    StatusCode: response.$metadata?.httpStatusCode || (range ? 206 : 200),
  };
}

/**
 * Copies an R2 object (e.g. promoting from draft to public key).
 * @param {string} sourceKey - Source object key (e.g. platform-cms/draft/abc.jpg)
 * @param {string} destKey - Destination object key (e.g. platform-cms/public/abc.jpg)
 * @returns {Promise<{success: boolean, key: string}>}
 */
export async function copyR2Object(sourceKey, destKey) {
  if (mockHandlers?.copyR2Object) {
    return mockHandlers.copyR2Object(sourceKey, destKey);
  }

  const client = getR2Client();
  if (!client) {
    throw new Error('Cloudflare R2 storage is not configured.');
  }

  const bucket = process.env.R2_BUCKET_NAME;
  const command = new CopyObjectCommand({
    Bucket: bucket,
    CopySource: `${bucket}/${sourceKey}`,
    Key: destKey,
  });

  await client.send(command);
  return { success: true, key: destKey };
}

/**
 * Deletes an R2 object.
 * @param {string} key - R2 object key to delete
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteFromR2(key) {
  if (mockHandlers?.deleteFromR2) {
    return mockHandlers.deleteFromR2(key);
  }

  const client = getR2Client();
  if (!client) {
    return { success: false };
  }

  try {
    const bucket = process.env.R2_BUCKET_NAME;
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    await client.send(command);
    return { success: true };
  } catch (err) {
    console.error(`[R2 Storage Warning] Failed to delete R2 object key '${key}':`, err.message);
    return { success: false, error: err.message };
  }
}
