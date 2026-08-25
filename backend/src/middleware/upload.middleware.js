import multer from 'multer';
import path from 'path';
import fs from 'fs';

// 1. Ensure upload directories exist
const receiptUploadDir = path.join(process.cwd(), 'uploads', 'receipts');
export const PUBLIC_LOGO_DIR = path.join(process.cwd(), 'uploads', 'branding', 'logos', 'public');
export const PROTECTED_SIGNATURE_DIR = path.join(process.cwd(), 'uploads', 'branding', 'protected', 'signatures');
export const PROTECTED_STAMP_DIR = path.join(process.cwd(), 'uploads', 'branding', 'protected', 'stamps');
export const PROTECTED_WRITTEN_ANSWER_DIR = path.join(process.cwd(), 'uploads', 'exams', 'answers', 'protected');
export const PROTECTED_GALLERY_DIR = path.join(process.cwd(), 'uploads', 'gallery', 'protected');
export const PROTECTED_MESSAGE_DIR = path.join(process.cwd(), 'uploads', 'messages', 'protected');
export const PUBLIC_CMS_DIR = path.join(process.cwd(), 'uploads', 'platform-cms', 'public');
export const PROTECTED_CMS_DRAFT_DIR = path.join(process.cwd(), 'uploads', 'platform-cms', 'draft');
export const PROTECTED_STUDY_MATERIAL_DIR = path.join(process.cwd(), 'uploads', 'study-materials', 'protected');
export const PROTECTED_NOTE_RECEIPT_DIR = path.join(process.cwd(), 'uploads', 'study-materials', 'receipts', 'protected');

[receiptUploadDir, PUBLIC_LOGO_DIR, PROTECTED_SIGNATURE_DIR, PROTECTED_STAMP_DIR, PROTECTED_WRITTEN_ANSWER_DIR, PROTECTED_GALLERY_DIR, PROTECTED_MESSAGE_DIR, PUBLIC_CMS_DIR, PROTECTED_CMS_DRAFT_DIR, PROTECTED_STUDY_MATERIAL_DIR, PROTECTED_NOTE_RECEIPT_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage Configuration for Receipts
const receiptStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, receiptUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `receipt-${uniqueSuffix}${ext}`);
  },
});

const receiptFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only PDF, JPG, JPEG, and PNG receipt files are accepted.'), false);
  }
};

export const uploadReceipt = multer({
  storage: receiptStorage,
  fileFilter: receiptFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum
  },
});

// Storage Configuration for Dynamic Branding Assets (Logo, Signature, Stamp)
const brandingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const assetType = (req.body?.type || req.query?.type || file.fieldname || 'logo').toLowerCase();
    if (assetType === 'signature') {
      cb(null, PROTECTED_SIGNATURE_DIR);
    } else if (assetType === 'stamp') {
      cb(null, PROTECTED_STAMP_DIR);
    } else {
      cb(null, PUBLIC_LOGO_DIR);
    }
  },
  filename: (req, file, cb) => {
    const assetType = (req.body?.type || req.query?.type || file.fieldname || 'logo').toLowerCase();
    const instId = req.instituteId || req.params?.id || req.user?.instituteId || 'inst';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${assetType}-${instId}-${uniqueSuffix}${ext}`);
  },
});

const brandingFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only JPG, JPEG, PNG, and WebP images are accepted.'), false);
  }
};

export const uploadBrandingAsset = multer({
  storage: brandingStorage,
  fileFilter: brandingFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB maximum
  },
});

// Storage Configuration for Protected Written Exam Answer Papers
const writtenAnswerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PROTECTED_WRITTEN_ANSWER_DIR);
  },
  filename: (req, file, cb) => {
    const examId = req.params.id || req.params.examId || 'exam';
    const studentId = req.user?.id || 'student';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `answer-exam${examId}-std${studentId}-${uniqueSuffix}${ext}`);
  },
});

const writtenAnswerFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.heic' || ext === '.heif' || file.mimetype === 'image/heic' || file.mimetype === 'image/heif') {
    return cb(new Error('HEIC/HEIF image format is not supported. Please capture or export your answer photos as JPEG or PNG, or select a PDF.'), false);
  }

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only PDF, JPG, JPEG, and PNG answer files are accepted.'), false);
  }
};

export const uploadWrittenAnswer = multer({
  storage: writtenAnswerStorage,
  fileFilter: writtenAnswerFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB maximum per file
    files: 32,                  // Up to 30 images + 1 file
  },
});

// CSV Upload (Memory storage for parsing preview / confirm)
export const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

// Storage Configuration for Protected Gallery Media
const galleryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PROTECTED_GALLERY_DIR);
  },
  filename: (req, file, cb) => {
    const instId = req.instituteId || req.user?.instituteId || 'inst';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `gallery_${instId}_${uniqueSuffix}${ext}`);
  },
});

const galleryFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm'];

  if (!allowedExtensions.includes(ext)) {
    return cb(new Error(`Unsupported file extension: ${ext}. Allowed: JPG, JPEG, PNG, WEBP, MP4, WEBM.`), false);
  }

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid MIME type: ${file.mimetype}. Only JPG, JPEG, PNG, WebP images and MP4, WebM videos are accepted.`), false);
  }
};

export const uploadGalleryMedia = multer({
  storage: galleryStorage,
  fileFilter: galleryFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB max per file
    files: 20,                  // Up to 20 files per request
  },
});

/**
 * Validates file magic bytes on disk
 */
export function validateMediaMagicBytes(filePath, expectedType = 'AUTO') {
  if (!fs.existsSync(filePath)) return false;
  try {
    const stats = fs.statSync(filePath);
    if (stats.size < 8) return false;

    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    // JPEG: FF D8 FF
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    // WEBP: 'RIFF' at 0..3 and 'WEBP' at 8..11
    const isWebp = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    // MP4: 'ftyp' at offset 4..8
    const isMp4 = buffer.toString('ascii', 4, 8) === 'ftyp';
    // WebM: 1A 45 DF A3 (EBML ID)
    const isWebm = buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3;

    if (expectedType === 'IMAGE') {
      return isJpeg || isPng || isWebp;
    }
    if (expectedType === 'VIDEO') {
      return isMp4 || isWebm;
    }
    return isJpeg || isPng || isWebp || isMp4 || isWebm;
  } catch (err) {
    console.error('Error checking magic bytes:', err);
    return false;
  }
}

// Storage Configuration for Secure Protected Message Attachments
const messageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PROTECTED_MESSAGE_DIR);
  },
  filename: (req, file, cb) => {
    const instId = req.instituteId || req.user?.instituteId || 'inst';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `msg_${instId}_${uniqueSuffix}${ext}`);
  },
});

const messageFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx'];

  if (!allowedExtensions.includes(ext)) {
    return cb(new Error(`Unsupported attachment extension '${ext}'. Allowed: PDF, JPG, PNG, WEBP, DOC, DOCX.`), false);
  }

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid MIME type '${file.mimetype}'. Allowed: PDF, JPG, PNG, WEBP, DOC, DOCX.`), false);
  }
};

const maxAttachmentMb = parseInt(process.env.MESSAGE_ATTACHMENT_MAX_MB || '10', 10);

export const uploadMessageAttachment = multer({
  storage: messageStorage,
  fileFilter: messageFileFilter,
  limits: {
    fileSize: maxAttachmentMb * 1024 * 1024,
    files: 1,
  },
});

/**
 * Validates magic bytes for message attachments on disk
 */
export function validateMessageAttachmentMagicBytes(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const stats = fs.statSync(filePath);
    if (stats.size < 4) return false;

    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    // PDF: %PDF (25 50 44 46)
    const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
    // JPEG: FF D8 FF
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    // PNG: 89 50 4E 47
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    // WEBP: RIFF...WEBP
    const isWebp = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    // DOC (OLE Compound File): D0 CF 11 E0
    const isDoc = buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;
    // DOCX (ZIP archive header): PK\x03\x04 (50 4B 03 04)
    const isDocx = buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;

    return isPdf || isJpeg || isPng || isWebp || isDoc || isDocx;
  } catch (err) {
    console.error('Error checking message attachment magic bytes:', err);
    return false;
  }
}

// Storage Configuration for Draft Platform CMS Images
const cmsDraftStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PROTECTED_CMS_DRAFT_DIR);
  },
  filename: (req, file, cb) => {
    const field = (req.body?.field || req.query?.field || file.fieldname || 'cms').replace(/[^a-zA-Z0-9_-]/g, '');
    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `cms_draft_${field}_${uniqueSuffix}${ext}`);
  },
});

const cmsImageFileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported image type. Only JPG, JPEG, PNG, and WebP images are allowed.'), false);
  }
};

export const uploadPlatformCmsDraftImage = multer({
  storage: cmsDraftStorage,
  fileFilter: cmsImageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB maximum
  },
});

/**
 * Validates magic bytes for CMS images (JPEG, PNG, WebP)
 */
export function validateCmsImageMagicBytes(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const stats = fs.statSync(filePath);
    if (stats.size < 12) return false;

    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    // JPEG: FF D8 FF
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    // PNG: 89 50 4E 47
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    // WEBP: RIFF...WEBP
    const isWebp = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';

    return isJpeg || isPng || isWebp;
  } catch (err) {
    console.error('Error validating CMS image magic bytes:', err);
    return false;
  }
}

/**
 * Promotes a draft CMS asset to public storage upon successful publish
 */
export function promoteDraftCmsAsset(draftUrlOrPath) {
  if (!draftUrlOrPath || typeof draftUrlOrPath !== 'string') return draftUrlOrPath;

  // If already in public storage, keep as is
  const cleanUrl = draftUrlOrPath.split('?')[0].split('#')[0];
  if (cleanUrl.startsWith('/uploads/platform-cms/public/')) {
    return cleanUrl;
  }

  // If pointing to draft endpoint or draft folder
  const filename = path.basename(cleanUrl);
  const draftFilePath = path.join(PROTECTED_CMS_DRAFT_DIR, filename);

  if (!fs.existsSync(draftFilePath)) {
    return cleanUrl;
  }

  // Validate magic bytes before promoting
  if (!validateCmsImageMagicBytes(draftFilePath)) {
    throw new Error(`Draft asset ${filename} failed image validation check.`);
  }

  const ext = path.extname(filename).toLowerCase();
  const publicFilename = `platform_cms_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
  const publicFilePath = path.join(PUBLIC_CMS_DIR, publicFilename);

  fs.copyFileSync(draftFilePath, publicFilePath);

  return `/uploads/platform-cms/public/${publicFilename}`;
}

/**
 * Cleans up old published assets that are no longer referenced in the newly published version.
 * Ensures that live assets are never deleted before publish confirmation.
 */
export function cleanupUnreferencedPublishedAssets(oldAssetUrls = [], currentReferencedUrls = []) {
  const referencedSet = new Set(currentReferencedUrls.filter(Boolean));
  oldAssetUrls.filter(Boolean).forEach((oldUrl) => {
    if (!referencedSet.has(oldUrl) && oldUrl.startsWith('/uploads/platform-cms/public/')) {
      const filename = path.basename(oldUrl);
      const filePath = path.join(PUBLIC_CMS_DIR, filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.warn('Failed to clean up old published asset:', filePath, e.message);
        }
      }
    }
  });
}

// -------------------------------------------------------------
// Storage Configuration for Protected Study Material PDFs
// -------------------------------------------------------------
const studyMaterialPdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PROTECTED_STUDY_MATERIAL_DIR);
  },
  filename: (req, file, cb) => {
    const instId = req.instituteId || req.user?.instituteId || 'inst';
    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
    cb(null, `material_${instId}_${uniqueSuffix}.pdf`);
  },
});

const studyMaterialPdfFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.mimetype === 'application/pdf' && ext === '.pdf') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only PDF files (.pdf) with application/pdf MIME type are accepted.'), false);
  }
};

const maxStudyMaterialMb = parseInt(process.env.STUDY_MATERIAL_MAX_MB || '25', 10);

export const uploadStudyMaterialPdf = multer({
  storage: studyMaterialPdfStorage,
  fileFilter: studyMaterialPdfFilter,
  limits: {
    fileSize: maxStudyMaterialMb * 1024 * 1024,
    files: 1,
  },
});

// -------------------------------------------------------------
// Storage Configuration for Protected Study Note Purchase Receipts
// -------------------------------------------------------------
const noteReceiptStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PROTECTED_NOTE_RECEIPT_DIR);
  },
  filename: (req, file, cb) => {
    const instId = req.instituteId || req.user?.instituteId || 'inst';
    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `receipt_${instId}_${uniqueSuffix}${ext}`);
  },
});

const noteReceiptFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid receipt format. Only JPG, JPEG, PNG, WebP, and PDF receipt files are accepted.'), false);
  }
};

const maxNoteReceiptMb = parseInt(process.env.NOTE_PAYMENT_RECEIPT_MAX_MB || '10', 10);

export const uploadNotePurchaseReceipt = multer({
  storage: noteReceiptStorage,
  fileFilter: noteReceiptFilter,
  limits: {
    fileSize: maxNoteReceiptMb * 1024 * 1024,
    files: 1,
  },
});

/**
 * Validates magic bytes for PDF files (%PDF-)
 */
export function validatePdfMagicBytes(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 4) return false;

    // %PDF- (25 50 44 46)
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  } catch (err) {
    console.error('Error validating PDF magic bytes:', err);
    return false;
  }
}

/**
 * Validates magic bytes for Study Note Purchase Receipts (JPEG, PNG, WEBP, PDF)
 * Strictly rejects fake/spoofed files (EXE, ZIP, APK, HTML, JS, etc.)
 */
export function validateReceiptMagicBytes(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 4) return false;

    // PDF: %PDF (25 50 44 46)
    const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
    // JPEG: FF D8 FF
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    // PNG: 89 50 4E 47
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    // WEBP: RIFF...WEBP
    const isWebp = buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';

    return isPdf || isJpeg || isPng || isWebp;
  } catch (err) {
    console.error('Error validating receipt magic bytes:', err);
    return false;
  }
}
