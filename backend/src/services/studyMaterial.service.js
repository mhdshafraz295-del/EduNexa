import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma.js';
import {
  PROTECTED_STUDY_MATERIAL_DIR,
  PROTECTED_NOTE_RECEIPT_DIR,
  validatePdfMagicBytes,
  validateReceiptMagicBytes,
} from '../middleware/upload.middleware.js';

/**
 * Safely resolves and validates that a target file path resides inside the designated base directory.
 * Prevents directory traversal attacks (e.g. ../, encoded sequences, external paths).
 */
export function resolveSafePath(baseDir, filePath) {
  if (!filePath || typeof filePath !== 'string') return null;
  const normalizedBase = path.resolve(baseDir);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(normalizedBase)) {
    return null;
  }
  return resolved;
}

/**
 * Validates that class and optional subject belong to the same institute and are properly mapped.
 */
export async function validateClassAndSubject(instituteId, classId, subjectId) {
  const targetClass = await prisma.class.findFirst({
    where: { id: parseInt(classId, 10), instituteId },
  });

  if (!targetClass) {
    throw new Error('Selected class does not exist in your institute.');
  }

  if (subjectId) {
    const sId = parseInt(subjectId, 10);
    const subject = await prisma.subject.findFirst({
      where: { id: sId, instituteId },
    });

    if (!subject) {
      throw new Error('Selected subject does not exist in your institute.');
    }

    // Validate subject is mapped to this class (either direct classId or via ClassSubject join)
    const isDirectMatch = subject.classId === targetClass.id;
    const isClassSubjectMatch = await prisma.classSubject.findFirst({
      where: { classId: targetClass.id, subjectId: sId, instituteId },
    });

    if (!isDirectMatch && !isClassSubjectMatch) {
      throw new Error('Selected subject is not assigned or mapped to this class.');
    }
  }

  return targetClass;
}

/**
 * Helper to get all active class IDs for a student
 */
export async function getStudentActiveClasses(studentId, instituteId) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, instituteId },
    include: {
      studentEnrollments: {
        where: { status: 'ACTIVE' },
      },
    },
  });

  if (!student) return [];

  const classIds = new Set();
  if (student.classId) {
    classIds.add(student.classId);
  }
  if (Array.isArray(student.studentEnrollments)) {
    student.studentEnrollments.forEach((e) => {
      if (e.classId) classIds.add(e.classId);
    });
  }

  return Array.from(classIds);
}

/**
 * Get or create institute study material bank payment settings
 */
export async function getInstitutePaymentSettings(instituteId) {
  let settings = await prisma.studyMaterialPaymentSettings.findUnique({
    where: { instituteId },
  });

  return settings;
}

/**
 * Save / update institute study material bank payment settings
 */
export async function upsertInstitutePaymentSettings(instituteId, data) {
  const { bankName, accountName, accountNumber, branchName, instructions, isEnabled } = data;

  if (!bankName || !accountName || !accountNumber) {
    throw new Error('Bank name, account holder name, and account number are required.');
  }

  const settings = await prisma.studyMaterialPaymentSettings.upsert({
    where: { instituteId },
    create: {
      instituteId,
      bankName: bankName.trim(),
      accountName: accountName.trim(),
      accountNumber: accountNumber.trim(),
      branchName: branchName ? branchName.trim() : null,
      instructions: instructions ? instructions.trim() : null,
      isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true,
    },
    update: {
      bankName: bankName.trim(),
      accountName: accountName.trim(),
      accountNumber: accountNumber.trim(),
      branchName: branchName ? branchName.trim() : null,
      instructions: instructions ? instructions.trim() : null,
      isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true,
    },
  });

  return settings;
}

/**
 * Admin: List study materials with filtering, search, and pagination
 */
export async function getAdminStudyMaterials(instituteId, filters = {}) {
  const {
    language,
    classId,
    subjectId,
    accessType,
    status,
    search,
    page = 1,
    limit = 20,
  } = filters;

  const where = { instituteId };

  if (language && ['TAMIL', 'ENGLISH', 'SINHALA'].includes(language.toUpperCase())) {
    where.language = language.toUpperCase();
  }

  if (classId) {
    where.classId = parseInt(classId, 10);
  }

  if (subjectId) {
    where.subjectId = parseInt(subjectId, 10);
  }

  if (accessType && ['FREE', 'PAID'].includes(accessType.toUpperCase())) {
    where.accessType = accessType.toUpperCase();
  }

  if (status && ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status.toUpperCase())) {
    where.status = status.toUpperCase();
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
      { subject: { name: { contains: q } } },
      { class: { name: { contains: q } } },
    ];
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);

  const [total, materials] = await Promise.all([
    prisma.studyMaterial.count({ where }),
    prisma.studyMaterial.findMany({
      where,
      include: {
        class: { select: { id: true, name: true, section: true } },
        subject: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, username: true } },
        _count: {
          select: {
            purchases: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ]);

  // Safe mapping (do not expose physical pdfFilePath)
  const safeMaterials = materials.map((m) => ({
    id: m.id,
    instituteId: m.instituteId,
    title: m.title,
    description: m.description,
    language: m.language,
    accessType: m.accessType,
    price: m.price ? parseFloat(m.price) : null,
    currency: m.currency,
    originalFileName: m.originalFileName,
    mimeType: m.mimeType,
    fileSize: m.fileSize,
    status: m.status,
    previewEnabled: m.previewEnabled,
    publishedAt: m.publishedAt,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    class: m.class,
    subject: m.subject,
    createdBy: m.createdBy,
    totalPurchases: m._count.purchases,
  }));

  return {
    total,
    page: parseInt(page, 10),
    limit: take,
    totalPages: Math.ceil(total / take) || 1,
    materials: safeMaterials,
  };
}

/**
 * Admin: Get single study material by ID
 */
export async function getAdminStudyMaterialById(instituteId, materialId) {
  const material = await prisma.studyMaterial.findFirst({
    where: { id: parseInt(materialId, 10), instituteId },
    include: {
      class: { select: { id: true, name: true, section: true } },
      subject: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, username: true } },
      _count: {
        select: {
          purchases: true,
        },
      },
    },
  });

  if (!material) {
    throw new Error('Study note not found.');
  }

  return {
    id: material.id,
    instituteId: material.instituteId,
    title: material.title,
    description: material.description,
    language: material.language,
    accessType: material.accessType,
    price: material.price ? parseFloat(material.price) : null,
    currency: material.currency,
    originalFileName: material.originalFileName,
    mimeType: material.mimeType,
    fileSize: material.fileSize,
    status: material.status,
    previewEnabled: material.previewEnabled,
    publishedAt: material.publishedAt,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
    class: material.class,
    subject: material.subject,
    createdBy: material.createdBy,
    totalPurchases: material._count.purchases,
  };
}

/**
 * Admin: Create Study Material (Draft or Published)
 */
export async function createStudyMaterial(instituteId, userId, data, file) {
  const {
    title,
    description,
    language,
    classId,
    subjectId,
    accessType,
    price,
    currency = 'LKR',
    status = 'DRAFT',
    previewEnabled = false,
  } = data;

  if (!title || !title.trim()) {
    throw new Error('Material title is required.');
  }

  if (!language || !['TAMIL', 'ENGLISH', 'SINHALA'].includes(language.toUpperCase())) {
    throw new Error('Valid language (TAMIL, ENGLISH, SINHALA) is required.');
  }

  if (!classId) {
    throw new Error('Target class is required.');
  }

  if (!accessType || !['FREE', 'PAID'].includes(accessType.toUpperCase())) {
    throw new Error('Access type (FREE or PAID) is required.');
  }

  const isPaid = accessType.toUpperCase() === 'PAID';
  const numericPrice = isPaid ? parseFloat(price) : null;

  if (isPaid && (numericPrice === null || isNaN(numericPrice) || numericPrice <= 0)) {
    throw new Error('A valid positive price is required for paid materials.');
  }

  if (!file) {
    throw new Error('PDF file is required for the study material.');
  }

  // Validate PDF magic bytes
  const isMagicValid = validatePdfMagicBytes(file.path);
  if (!isMagicValid) {
    if (fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (e) {}
    }
    throw new Error('Invalid or corrupted PDF file. Magic header check failed.');
  }

  // Validate Class & Subject multi-tenant consistency
  await validateClassAndSubject(instituteId, classId, subjectId);

  // If publishing a PAID note, verify bank settings exist and are enabled
  const targetStatus = status.toUpperCase() === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
  if (targetStatus === 'PUBLISHED' && isPaid) {
    const bankSettings = await prisma.studyMaterialPaymentSettings.findUnique({
      where: { instituteId },
    });

    if (!bankSettings || !bankSettings.isEnabled || !bankSettings.bankName || !bankSettings.accountNumber) {
      throw new Error('Please configure and enable your Institute Bank Payment Settings before publishing paid materials.');
    }
  }

  const publishedAt = targetStatus === 'PUBLISHED' ? new Date() : null;

  const newMaterial = await prisma.studyMaterial.create({
    data: {
      instituteId,
      classId: parseInt(classId, 10),
      subjectId: subjectId ? parseInt(subjectId, 10) : null,
      title: title.trim(),
      description: description ? description.trim() : null,
      language: language.toUpperCase(),
      accessType: isPaid ? 'PAID' : 'FREE',
      price: isPaid ? numericPrice : null,
      currency: currency ? currency.trim().toUpperCase() : 'LKR',
      pdfFilePath: file.path,
      originalFileName: file.originalname,
      mimeType: file.mimetype || 'application/pdf',
      fileSize: file.size,
      status: targetStatus,
      previewEnabled: Boolean(previewEnabled),
      createdById: userId,
      publishedAt,
    },
    include: {
      class: { select: { id: true, name: true, section: true } },
      subject: { select: { id: true, name: true, code: true } },
    },
  });

  return newMaterial;
}

/**
 * Admin: Update Study Material Metadata or PDF
 */
export async function updateStudyMaterial(instituteId, materialId, data, file) {
  const material = await prisma.studyMaterial.findFirst({
    where: { id: parseInt(materialId, 10), instituteId },
    include: {
      _count: { select: { purchases: true } },
    },
  });

  if (!material) {
    throw new Error('Study material not found.');
  }

  const {
    title,
    description,
    language,
    classId,
    subjectId,
    accessType,
    price,
    currency,
    status,
    previewEnabled,
  } = data;

  const updateData = {};

  if (title && title.trim()) updateData.title = title.trim();
  if (description !== undefined) updateData.description = description ? description.trim() : null;

  if (language) {
    if (!['TAMIL', 'ENGLISH', 'SINHALA'].includes(language.toUpperCase())) {
      throw new Error('Valid language (TAMIL, ENGLISH, SINHALA) is required.');
    }
    updateData.language = language.toUpperCase();
  }

  const targetClassId = classId ? parseInt(classId, 10) : material.classId;
  const targetSubjectId = subjectId !== undefined ? (subjectId ? parseInt(subjectId, 10) : null) : material.subjectId;

  if (classId || subjectId !== undefined) {
    await validateClassAndSubject(instituteId, targetClassId, targetSubjectId);
    updateData.classId = targetClassId;
    updateData.subjectId = targetSubjectId;
  }

  if (accessType) {
    const isPaid = accessType.toUpperCase() === 'PAID';
    updateData.accessType = isPaid ? 'PAID' : 'FREE';
    if (isPaid) {
      const numericPrice = price !== undefined ? parseFloat(price) : (material.price ? parseFloat(material.price) : 0);
      if (isNaN(numericPrice) || numericPrice <= 0) {
        throw new Error('A valid positive price is required for paid materials.');
      }
      updateData.price = numericPrice;
    } else {
      updateData.price = null;
    }
  } else if (price !== undefined && material.accessType === 'PAID') {
    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      throw new Error('A valid positive price is required for paid materials.');
    }
    updateData.price = numericPrice;
  }

  if (currency) updateData.currency = currency.trim().toUpperCase();
  if (previewEnabled !== undefined) updateData.previewEnabled = Boolean(previewEnabled);

  if (status && ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status.toUpperCase())) {
    const targetStatus = status.toUpperCase();
    if (targetStatus === 'PUBLISHED' && (updateData.accessType === 'PAID' || material.accessType === 'PAID')) {
      const bankSettings = await prisma.studyMaterialPaymentSettings.findUnique({
        where: { instituteId },
      });
      if (!bankSettings || !bankSettings.isEnabled || !bankSettings.bankName || !bankSettings.accountNumber) {
        throw new Error('Please configure and enable your Institute Bank Payment Settings before publishing paid materials.');
      }
    }

    updateData.status = targetStatus;
    if (targetStatus === 'PUBLISHED' && !material.publishedAt) {
      updateData.publishedAt = new Date();
    }
  }

  // Handle PDF file replacement
  if (file) {
    const isMagicValid = validatePdfMagicBytes(file.path);
    if (!isMagicValid) {
      if (fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch (e) {}
      }
      throw new Error('Invalid or corrupted PDF file. Magic header check failed.');
    }

    const oldFilePath = material.pdfFilePath;
    updateData.pdfFilePath = file.path;
    updateData.originalFileName = file.originalname;
    updateData.mimeType = file.mimetype || 'application/pdf';
    updateData.fileSize = file.size;

    // Safely delete old physical file if it differs
    if (oldFilePath && oldFilePath !== file.path && fs.existsSync(oldFilePath)) {
      try { fs.unlinkSync(oldFilePath); } catch (e) {}
    }
  }

  const updatedMaterial = await prisma.studyMaterial.update({
    where: { id: material.id },
    data: updateData,
    include: {
      class: { select: { id: true, name: true, section: true } },
      subject: { select: { id: true, name: true, code: true } },
    },
  });

  return updatedMaterial;
}

/**
 * Admin: Update Status (DRAFT, PUBLISHED, ARCHIVED)
 */
export async function updateStudyMaterialStatus(instituteId, materialId, newStatus) {
  const targetStatus = newStatus?.toUpperCase();
  if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(targetStatus)) {
    throw new Error('Invalid status. Allowed values: DRAFT, PUBLISHED, ARCHIVED.');
  }

  const material = await prisma.studyMaterial.findFirst({
    where: { id: parseInt(materialId, 10), instituteId },
  });

  if (!material) {
    throw new Error('Study material not found.');
  }

  if (targetStatus === 'PUBLISHED' && material.accessType === 'PAID') {
    const bankSettings = await prisma.studyMaterialPaymentSettings.findUnique({
      where: { instituteId },
    });
    if (!bankSettings || !bankSettings.isEnabled || !bankSettings.bankName || !bankSettings.accountNumber) {
      throw new Error('Please configure and enable your Institute Bank Payment Settings before publishing paid materials.');
    }
  }

  const updateData = { status: targetStatus };
  if (targetStatus === 'PUBLISHED' && !material.publishedAt) {
    updateData.publishedAt = new Date();
  }

  const updated = await prisma.studyMaterial.update({
    where: { id: material.id },
    data: updateData,
  });

  return updated;
}

/**
 * Admin: Delete or Archive Study Material
 */
export async function deleteStudyMaterial(instituteId, materialId) {
  const material = await prisma.studyMaterial.findFirst({
    where: { id: parseInt(materialId, 10), instituteId },
    include: {
      _count: { select: { purchases: true } },
    },
  });

  if (!material) {
    throw new Error('Study material not found.');
  }

  // If purchase history exists, do NOT delete - archive instead to preserve records
  if (material._count.purchases > 0) {
    const archived = await prisma.studyMaterial.update({
      where: { id: material.id },
      data: { status: 'ARCHIVED' },
    });
    return {
      success: true,
      action: 'ARCHIVED',
      message: 'Material has existing student purchase records and has been safely ARCHIVED instead of deleted.',
      material: archived,
    };
  }

  // If no purchases exist, safely delete physical file and DB row
  if (material.pdfFilePath && fs.existsSync(material.pdfFilePath)) {
    try { fs.unlinkSync(material.pdfFilePath); } catch (e) {}
  }

  await prisma.studyMaterial.delete({
    where: { id: material.id },
  });

  return {
    success: true,
    action: 'DELETED',
    message: 'Study material deleted successfully.',
  };
}

/**
 * Student: Get list of eligible study materials based on enrolled classes
 */
export async function getStudentStudyMaterials(instituteId, userId, filters = {}) {
  const student = await prisma.student.findFirst({
    where: { userId, instituteId },
    include: {
      studentEnrollments: {
        where: { status: 'ACTIVE' },
      },
    },
  });

  if (!student) {
    throw new Error('Student profile not found for this account.');
  }

  const activeClassIds = new Set();
  if (student.classId) activeClassIds.add(student.classId);
  if (student.studentEnrollments) {
    student.studentEnrollments.forEach((e) => {
      if (e.classId) activeClassIds.add(e.classId);
    });
  }

  const classIdList = Array.from(activeClassIds);

  const {
    language,
    accessType,
    subjectId,
    purchaseFilter,
    search,
    page = 1,
    limit = 24,
  } = filters;

  // Student can see PUBLISHED materials in their active classes,
  // OR ARCHIVED materials if they previously purchased them
  const where = {
    instituteId,
    classId: { in: classIdList.length > 0 ? classIdList : [-1] },
    OR: [
      { status: 'PUBLISHED' },
      {
        status: 'ARCHIVED',
        purchases: {
          some: {
            studentId: student.id,
            status: 'APPROVED',
          },
        },
      },
    ],
  };

  if (language && ['TAMIL', 'ENGLISH', 'SINHALA'].includes(language.toUpperCase())) {
    where.language = language.toUpperCase();
  }

  if (accessType && ['FREE', 'PAID'].includes(accessType.toUpperCase())) {
    where.accessType = accessType.toUpperCase();
  }

  if (subjectId) {
    where.subjectId = parseInt(subjectId, 10);
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.AND = [
      {
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
          { subject: { name: { contains: q } } },
        ],
      },
    ];
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);

  const [total, materials] = await Promise.all([
    prisma.studyMaterial.count({ where }),
    prisma.studyMaterial.findMany({
      where,
      include: {
        class: { select: { id: true, name: true, section: true } },
        subject: { select: { id: true, name: true, code: true } },
        purchases: {
          where: { studentId: student.id },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ]);

  // Compute student-specific access state
  const mapped = materials.map((m) => {
    const purchase = m.purchases?.[0] || null;
    const isFree = m.accessType === 'FREE';
    const isApproved = purchase?.status === 'APPROVED';
    const isPending = purchase?.status === 'PENDING';
    const isRejected = purchase?.status === 'REJECTED';

    const canView = isFree || isApproved;
    const canDownload = isFree || isApproved;

    return {
      id: m.id,
      title: m.title,
      description: m.description,
      language: m.language,
      accessType: m.accessType,
      price: m.price ? parseFloat(m.price) : null,
      currency: m.currency,
      mimeType: m.mimeType,
      fileSize: m.fileSize,
      status: m.status,
      publishedAt: m.publishedAt,
      class: m.class,
      subject: m.subject,
      purchaseStatus: purchase ? purchase.status : null,
      purchaseId: purchase ? purchase.id : null,
      rejectionReason: isRejected ? purchase.rejectionReason : null,
      submittedAt: purchase ? purchase.createdAt : null,
      approvedAt: purchase ? purchase.approvedAt : null,
      canView,
      canDownload,
    };
  });

  // Handle client-side / query-level purchaseFilter (e.g. 'PURCHASED', 'PENDING', 'FREE', 'PAID')
  let filteredMaterials = mapped;
  if (purchaseFilter) {
    const pf = purchaseFilter.toUpperCase();
    if (pf === 'PURCHASED') {
      filteredMaterials = mapped.filter((m) => m.purchaseStatus === 'APPROVED');
    } else if (pf === 'PENDING') {
      filteredMaterials = mapped.filter((m) => m.purchaseStatus === 'PENDING');
    } else if (pf === 'REJECTED') {
      filteredMaterials = mapped.filter((m) => m.purchaseStatus === 'REJECTED');
    } else if (pf === 'UNLOCKED') {
      filteredMaterials = mapped.filter((m) => m.canView);
    }
  }

  return {
    total,
    page: parseInt(page, 10),
    limit: take,
    totalPages: Math.ceil(total / take) || 1,
    materials: filteredMaterials,
  };
}

/**
 * Student: Get details of a single study material, including institute bank details if paid
 */
export async function getStudentMaterialDetails(instituteId, userId, materialId) {
  const student = await prisma.student.findFirst({
    where: { userId, instituteId },
    include: {
      studentEnrollments: { where: { status: 'ACTIVE' } },
    },
  });

  if (!student) {
    throw new Error('Student profile not found.');
  }

  const activeClassIds = await getStudentActiveClasses(student.id, instituteId);

  const material = await prisma.studyMaterial.findFirst({
    where: {
      id: parseInt(materialId, 10),
      instituteId,
      classId: { in: activeClassIds.length > 0 ? activeClassIds : [-1] },
    },
    include: {
      class: { select: { id: true, name: true, section: true } },
      subject: { select: { id: true, name: true, code: true } },
      purchases: {
        where: { studentId: student.id },
        take: 1,
      },
    },
  });

  if (!material) {
    throw new Error('Study material not found or you are not enrolled in the associated class.');
  }

  const purchase = material.purchases?.[0] || null;
  const isFree = material.accessType === 'FREE';
  const isApproved = purchase?.status === 'APPROVED';
  const isPending = purchase?.status === 'PENDING';
  const isRejected = purchase?.status === 'REJECTED';

  const canView = isFree || isApproved;
  const canDownload = isFree || isApproved;

  // Retrieve institute bank details if note is PAID
  let bankSettings = null;
  if (material.accessType === 'PAID') {
    const rawBank = await prisma.studyMaterialPaymentSettings.findUnique({
      where: { instituteId },
    });
    if (rawBank && rawBank.isEnabled) {
      bankSettings = {
        bankName: rawBank.bankName,
        accountName: rawBank.accountName,
        accountNumber: rawBank.accountNumber,
        branchName: rawBank.branchName,
        instructions: rawBank.instructions,
      };
    }
  }

  return {
    id: material.id,
    title: material.title,
    description: material.description,
    language: material.language,
    accessType: material.accessType,
    price: material.price ? parseFloat(material.price) : null,
    currency: material.currency,
    mimeType: material.mimeType,
    fileSize: material.fileSize,
    status: material.status,
    publishedAt: material.publishedAt,
    class: material.class,
    subject: material.subject,
    purchaseStatus: purchase ? purchase.status : null,
    purchaseId: purchase ? purchase.id : null,
    rejectionReason: isRejected ? purchase.rejectionReason : null,
    submittedAt: purchase ? purchase.createdAt : null,
    approvedAt: purchase ? purchase.approvedAt : null,
    canView,
    canDownload,
    bankSettings,
  };
}

/**
 * Student: Submit Bank Transfer Payment Receipt for Paid Study Material
 * Handles duplicate prevention, receipt replacement for pending/rejected status, and price snapshotting.
 */
export async function submitStudentMaterialPurchase(instituteId, userId, materialId, file) {
  const student = await prisma.student.findFirst({
    where: { userId, instituteId },
    include: {
      studentEnrollments: { where: { status: 'ACTIVE' } },
      user: { select: { username: true, email: true } },
    },
  });

  if (!student) {
    throw new Error('Student profile not found.');
  }

  const activeClassIds = await getStudentActiveClasses(student.id, instituteId);

  const material = await prisma.studyMaterial.findFirst({
    where: {
      id: parseInt(materialId, 10),
      instituteId,
      classId: { in: activeClassIds.length > 0 ? activeClassIds : [-1] },
      status: 'PUBLISHED',
    },
  });

  if (!material) {
    if (file && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (e) {}
    }
    throw new Error('Study material not found, not published, or you are not eligible for this class.');
  }

  if (material.accessType !== 'PAID') {
    if (file && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (e) {}
    }
    throw new Error('This study material is FREE. No payment is required.');
  }

  if (!file) {
    throw new Error('Payment receipt file (JPG, PNG, WebP, or PDF) is required.');
  }

  // Validate receipt magic bytes
  const isMagicValid = validateReceiptMagicBytes(file.path);
  if (!isMagicValid) {
    if (fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (e) {}
    }
    throw new Error('Invalid or corrupted receipt file format. Please upload a clear photo or PDF.');
  }

  // Check existing purchase
  const existingPurchase = await prisma.studyMaterialPurchase.findUnique({
    where: {
      materialId_studentId: {
        materialId: material.id,
        studentId: student.id,
      },
    },
  });

  if (existingPurchase && existingPurchase.status === 'APPROVED') {
    if (fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (e) {}
    }
    throw new Error('You have already purchased and unlocked this note.');
  }

  let purchase;
  const now = new Date();

  if (existingPurchase) {
    // Replace old receipt if status is PENDING or REJECTED
    const oldReceiptPath = existingPurchase.receiptFilePath;

    purchase = await prisma.studyMaterialPurchase.update({
      where: { id: existingPurchase.id },
      data: {
        amount: existingPurchase.status === 'PENDING' ? existingPurchase.amount : (material.price || 0),
        currency: material.currency,
        status: 'PENDING',
        receiptFilePath: file.path,
        receiptOriginalName: file.originalname,
        receiptMimeType: file.mimetype,
        receiptFileSize: file.size,
        receiptUploadedAt: now,
        rejectionReason: null,
        reviewedById: null,
        reviewedAt: null,
        approvedAt: null,
      },
    });

    // Safely remove old receipt file if different
    if (oldReceiptPath && oldReceiptPath !== file.path && fs.existsSync(oldReceiptPath)) {
      try { fs.unlinkSync(oldReceiptPath); } catch (e) {}
    }
  } else {
    // Create new purchase with price snapshot
    purchase = await prisma.studyMaterialPurchase.create({
      data: {
        instituteId,
        materialId: material.id,
        studentId: student.id,
        amount: material.price || 0,
        currency: material.currency,
        status: 'PENDING',
        receiptFilePath: file.path,
        receiptOriginalName: file.originalname,
        receiptMimeType: file.mimetype,
        receiptFileSize: file.size,
        receiptUploadedAt: now,
      },
    });
  }

  // Dispatch In-App Notification to Institute Admin(s)
  try {
    const adminUsers = await prisma.user.findMany({
      where: { instituteId, role: 'ADMIN', isActive: true },
      select: { id: true },
    });

    const studentDisplayName = student.name || student.user?.name || student.user?.username || 'Student';

    for (const admin of adminUsers) {
      await prisma.notification.create({
        data: {
          instituteId,
          userId: admin.id,
          title: 'New Note Payment Receipt',
          message: `${studentDisplayName} uploaded a payment receipt for "${material.title}" (${material.currency} ${parseFloat(material.price || 0).toFixed(2)}).`,
          link: '/admin/study-materials?tab=payments',
        },
      });
    }
  } catch (notifErr) {
    console.error('Failed to dispatch receipt notification:', notifErr);
  }

  return {
    id: purchase.id,
    materialId: purchase.materialId,
    studentId: purchase.studentId,
    amount: parseFloat(purchase.amount),
    currency: purchase.currency,
    status: purchase.status,
    receiptUploadedAt: purchase.receiptUploadedAt,
    message: 'Payment receipt submitted successfully. Your note will unlock once verified by your institute.',
  };
}

/**
 * Student: Get personal study note purchase history
 */
export async function getStudentPurchases(instituteId, userId, filters = {}) {
  const student = await prisma.student.findFirst({
    where: { userId, instituteId },
  });

  if (!student) {
    throw new Error('Student profile not found.');
  }

  const { status, page = 1, limit = 20 } = filters;

  const where = {
    instituteId,
    studentId: student.id,
  };

  if (status && ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status.toUpperCase())) {
    where.status = status.toUpperCase();
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);

  const [total, purchases] = await Promise.all([
    prisma.studyMaterialPurchase.count({ where }),
    prisma.studyMaterialPurchase.findMany({
      where,
      include: {
        material: {
          select: {
            id: true,
            title: true,
            language: true,
            accessType: true,
            class: { select: { id: true, name: true, section: true } },
            subject: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ]);

  const safePurchases = purchases.map((p) => ({
    id: p.id,
    materialId: p.materialId,
    materialTitle: p.material.title,
    language: p.material.language,
    class: p.material.class,
    subject: p.material.subject,
    amount: parseFloat(p.amount),
    currency: p.currency,
    status: p.status,
    receiptUploadedAt: p.receiptUploadedAt,
    reviewedAt: p.reviewedAt,
    approvedAt: p.approvedAt,
    rejectionReason: p.rejectionReason,
    createdAt: p.createdAt,
  }));

  return {
    total,
    page: parseInt(page, 10),
    limit: take,
    totalPages: Math.ceil(total / take) || 1,
    purchases: safePurchases,
  };
}

/**
 * Admin: List Note Payment Transactions
 */
export async function getAdminPayments(instituteId, filters = {}) {
  const {
    status,
    language,
    classId,
    search,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = filters;

  const where = { instituteId };

  if (status && ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status.toUpperCase())) {
    where.status = status.toUpperCase();
  }

  if (language && ['TAMIL', 'ENGLISH', 'SINHALA'].includes(language.toUpperCase())) {
    where.material = { ...where.material, language: language.toUpperCase() };
  }

  if (classId) {
    where.material = { ...where.material, classId: parseInt(classId, 10) };
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { material: { title: { contains: q } } },
      { student: { name: { contains: q } } },
      { student: { rollNo: { contains: q } } },
      { student: { admissionNumber: { contains: q } } },
      { student: { user: { username: { contains: q } } } },
    ];
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);

  const [total, payments] = await Promise.all([
    prisma.studyMaterialPurchase.count({ where }),
    prisma.studyMaterialPurchase.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            rollNo: true,
            admissionNumber: true,
            user: { select: { id: true, username: true, email: true } },
          },
        },
        material: {
          select: {
            id: true,
            title: true,
            language: true,
            price: true,
            currency: true,
            class: { select: { id: true, name: true, section: true } },
            subject: { select: { id: true, name: true, code: true } },
          },
        },
        reviewedBy: {
          select: { id: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ]);

  const safePayments = payments.map((p) => ({
    id: p.id,
    instituteId: p.instituteId,
    materialId: p.materialId,
    studentId: p.studentId,
    amount: parseFloat(p.amount),
    currency: p.currency,
    status: p.status,
    hasReceipt: Boolean(p.receiptFilePath),
    receiptOriginalName: p.receiptOriginalName,
    receiptMimeType: p.receiptMimeType,
    receiptFileSize: p.receiptFileSize,
    receiptUploadedAt: p.receiptUploadedAt,
    reviewedById: p.reviewedById,
    reviewedBy: p.reviewedBy,
    reviewedAt: p.reviewedAt,
    approvedAt: p.approvedAt,
    rejectionReason: p.rejectionReason,
    createdAt: p.createdAt,
    student: {
      id: p.student.id,
      name: p.student.name || p.student.user?.username || 'Student',
      rollNo: p.student.rollNo,
      admissionNumber: p.student.admissionNumber,
      username: p.student.user?.username,
      email: p.student.user?.email,
    },
    material: {
      id: p.material.id,
      title: p.material.title,
      language: p.material.language,
      currentPrice: p.material.price ? parseFloat(p.material.price) : null,
      currency: p.material.currency,
      class: p.material.class,
      subject: p.material.subject,
    },
  }));

  return {
    total,
    page: parseInt(page, 10),
    limit: take,
    totalPages: Math.ceil(total / take) || 1,
    payments: safePayments,
  };
}

/**
 * Admin: Get single payment transaction detail
 */
export async function getAdminPaymentById(instituteId, purchaseId) {
  const payment = await prisma.studyMaterialPurchase.findFirst({
    where: { id: parseInt(purchaseId, 10), instituteId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          rollNo: true,
          admissionNumber: true,
          user: { select: { id: true, username: true, email: true } },
        },
      },
      material: {
        select: {
          id: true,
          title: true,
          language: true,
          price: true,
          currency: true,
          class: { select: { id: true, name: true, section: true } },
          subject: { select: { id: true, name: true, code: true } },
        },
      },
      reviewedBy: {
        select: { id: true, username: true },
      },
    },
  });

  if (!payment) {
    throw new Error('Payment transaction not found.');
  }

  return {
    id: payment.id,
    instituteId: payment.instituteId,
    materialId: payment.materialId,
    studentId: payment.studentId,
    amount: parseFloat(payment.amount),
    currency: payment.currency,
    status: payment.status,
    hasReceipt: Boolean(payment.receiptFilePath),
    receiptOriginalName: payment.receiptOriginalName,
    receiptMimeType: payment.receiptMimeType,
    receiptFileSize: payment.receiptFileSize,
    receiptUploadedAt: payment.receiptUploadedAt,
    reviewedById: payment.reviewedById,
    reviewedBy: payment.reviewedBy,
    reviewedAt: payment.reviewedAt,
    approvedAt: payment.approvedAt,
    rejectionReason: payment.rejectionReason,
    createdAt: payment.createdAt,
    student: {
      id: payment.student.id,
      name: payment.student.name || payment.student.user?.username || 'Student',
      rollNo: payment.student.rollNo,
      admissionNumber: payment.student.admissionNumber,
      username: payment.student.user?.username,
      email: payment.student.user?.email,
    },
    material: {
      id: payment.material.id,
      title: payment.material.title,
      language: payment.material.language,
      currentPrice: payment.material.price ? parseFloat(payment.material.price) : null,
      currency: payment.material.currency,
      class: payment.material.class,
      subject: payment.material.subject,
    },
  };
}

/**
 * Admin: Approve Note Payment Receipt
 */
export async function approveStudentPayment(instituteId, reviewerUserId, purchaseId) {
  const purchase = await prisma.studyMaterialPurchase.findFirst({
    where: { id: parseInt(purchaseId, 10), instituteId },
    include: {
      material: { select: { id: true, title: true } },
      student: { select: { id: true, userId: true, name: true } },
    },
  });

  if (!purchase) {
    throw new Error('Payment transaction not found.');
  }

  if (purchase.status === 'APPROVED') {
    return {
      success: true,
      message: 'Payment is already approved.',
      purchase,
    };
  }

  const now = new Date();

  const updatedPurchase = await prisma.studyMaterialPurchase.update({
    where: { id: purchase.id },
    data: {
      status: 'APPROVED',
      reviewedById: reviewerUserId,
      reviewedAt: now,
      approvedAt: now,
      rejectionReason: null,
    },
  });

  // Dispatch In-App Notification to Student
  try {
    await prisma.notification.create({
      data: {
        instituteId,
        userId: purchase.student.userId,
        title: 'Note Payment Approved',
        message: `Your payment for "${purchase.material.title}" has been approved. The note is now permanently unlocked!`,
        link: '/student/study-materials',
      },
    });
  } catch (notifErr) {
    console.error('Failed to dispatch approval notification:', notifErr);
  }

  return {
    success: true,
    message: 'Payment approved successfully. Material is now permanently unlocked for the student.',
    purchase: updatedPurchase,
  };
}

/**
 * Admin: Reject Note Payment Receipt
 */
export async function rejectStudentPayment(instituteId, reviewerUserId, purchaseId, rejectionReason) {
  if (!rejectionReason || !rejectionReason.trim()) {
    throw new Error('A valid rejection reason is required.');
  }

  const purchase = await prisma.studyMaterialPurchase.findFirst({
    where: { id: parseInt(purchaseId, 10), instituteId },
    include: {
      material: { select: { id: true, title: true } },
      student: { select: { id: true, userId: true, name: true } },
    },
  });

  if (!purchase) {
    throw new Error('Payment transaction not found.');
  }

  const now = new Date();

  const updatedPurchase = await prisma.studyMaterialPurchase.update({
    where: { id: purchase.id },
    data: {
      status: 'REJECTED',
      reviewedById: reviewerUserId,
      reviewedAt: now,
      rejectionReason: rejectionReason.trim(),
    },
  });

  // Dispatch In-App Notification to Student
  try {
    await prisma.notification.create({
      data: {
        instituteId,
        userId: purchase.student.userId,
        title: 'Note Payment Rejected',
        message: `Your payment for "${purchase.material.title}" was rejected. Reason: ${rejectionReason.trim()}`,
        link: '/student/study-materials',
      },
    });
  } catch (notifErr) {
    console.error('Failed to dispatch rejection notification:', notifErr);
  }

  return {
    success: true,
    message: 'Payment rejected. Student has been notified and can upload a replacement receipt.',
    purchase: updatedPurchase,
  };
}

/**
 * Stream Protected Study Material PDF
 * Accessible by Admin (same institute) OR Student (same institute, enrolled in class, and Free/Approved).
 */
export async function getStudyMaterialPdfStream(instituteId, user, materialId) {
  const mId = parseInt(materialId, 10);
  const material = await prisma.studyMaterial.findFirst({
    where: { id: mId, instituteId },
    include: {
      class: true,
    },
  });

  if (!material) {
    throw new Error('Study material not found in your institute.');
  }

  // Admin access
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    const safePath = resolveSafePath(PROTECTED_STUDY_MATERIAL_DIR, material.pdfFilePath);
    if (!safePath || !fs.existsSync(safePath)) {
      throw new Error('Study material PDF file could not be found on storage.');
    }
    return {
      filePath: safePath,
      fileName: material.originalFileName || `material_${material.id}.pdf`,
      fileSize: material.fileSize,
      mimeType: material.mimeType || 'application/pdf',
    };
  }

  // Student access
  if (user.role === 'STUDENT') {
    if (material.status !== 'PUBLISHED' && material.status !== 'ARCHIVED') {
      throw new Error('This study material is not published.');
    }

    const student = await prisma.student.findFirst({
      where: { userId: user.id, instituteId },
      include: {
        studentEnrollments: { where: { status: 'ACTIVE' } },
      },
    });

    if (!student) {
      throw new Error('Student profile not found.');
    }

    const activeClassIds = await getStudentActiveClasses(student.id, instituteId);
    if (!activeClassIds.includes(material.classId)) {
      throw new Error('You are not eligible to access study materials for this class.');
    }

    if (material.accessType === 'PAID') {
      const purchase = await prisma.studyMaterialPurchase.findUnique({
        where: {
          materialId_studentId: {
            materialId: material.id,
            studentId: student.id,
          },
        },
      });

      if (!purchase || purchase.status !== 'APPROVED') {
        const status = purchase?.status || 'UNPAID';
        throw new Error(`This paid note is locked. Payment status: ${status}.`);
      }
    }

    const safePath = resolveSafePath(PROTECTED_STUDY_MATERIAL_DIR, material.pdfFilePath);
    if (!safePath || !fs.existsSync(safePath)) {
      throw new Error('Study material PDF file could not be found on storage.');
    }

    return {
      filePath: safePath,
      fileName: material.originalFileName || `material_${material.id}.pdf`,
      fileSize: material.fileSize,
      mimeType: material.mimeType || 'application/pdf',
    };
  }

  throw new Error('Access denied. Role not authorized to access study materials.');
}

/**
 * Stream Protected Purchase Receipt
 * Accessible ONLY by Admin of the institute OR the purchasing Student.
 */
export async function getPurchaseReceiptStream(instituteId, user, purchaseId) {
  const pId = parseInt(purchaseId, 10);
  const purchase = await prisma.studyMaterialPurchase.findFirst({
    where: { id: pId, instituteId },
    include: {
      student: { select: { userId: true } },
    },
  });

  if (!purchase) {
    throw new Error('Purchase record not found.');
  }

  if (!purchase.receiptFilePath) {
    throw new Error('No receipt file was uploaded for this purchase.');
  }

  // Authorization check
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const isOwnerStudent = user.role === 'STUDENT' && purchase.student.userId === user.id;

  if (!isAdmin && !isOwnerStudent) {
    throw new Error('Access denied. You do not have permission to view this receipt.');
  }

  const safePath = resolveSafePath(PROTECTED_NOTE_RECEIPT_DIR, purchase.receiptFilePath);
  if (!safePath || !fs.existsSync(safePath)) {
    throw new Error('Receipt file could not be found on storage.');
  }

  return {
    filePath: safePath,
    fileName: purchase.receiptOriginalName || `receipt_${purchase.id}`,
    fileSize: purchase.receiptFileSize,
    mimeType: purchase.receiptMimeType || 'image/jpeg',
  };
}

/**
 * Admin Analytics: Real MySQL aggregations for Notes, Languages, Purchases, and Monthly Revenue
 */
export async function getAdminStudyMaterialAnalytics(instituteId, dateFilter = {}) {
  const { startDate, endDate } = dateFilter;

  // Material Counts
  const [
    totalNotes,
    tamilNotes,
    englishNotes,
    sinhalaNotes,
    freeNotes,
    paidNotes,
    publishedNotes,
    draftNotes,
    archivedNotes,
  ] = await Promise.all([
    prisma.studyMaterial.count({ where: { instituteId } }),
    prisma.studyMaterial.count({ where: { instituteId, language: 'TAMIL' } }),
    prisma.studyMaterial.count({ where: { instituteId, language: 'ENGLISH' } }),
    prisma.studyMaterial.count({ where: { instituteId, language: 'SINHALA' } }),
    prisma.studyMaterial.count({ where: { instituteId, accessType: 'FREE' } }),
    prisma.studyMaterial.count({ where: { instituteId, accessType: 'PAID' } }),
    prisma.studyMaterial.count({ where: { instituteId, status: 'PUBLISHED' } }),
    prisma.studyMaterial.count({ where: { instituteId, status: 'DRAFT' } }),
    prisma.studyMaterial.count({ where: { instituteId, status: 'ARCHIVED' } }),
  ]);

  // Payment Status Counts
  const [pendingPayments, approvedPurchases, rejectedPayments] = await Promise.all([
    prisma.studyMaterialPurchase.count({ where: { instituteId, status: 'PENDING' } }),
    prisma.studyMaterialPurchase.count({ where: { instituteId, status: 'APPROVED' } }),
    prisma.studyMaterialPurchase.count({ where: { instituteId, status: 'REJECTED' } }),
  ]);

  // Total Lifetime Revenue (Approved purchases only)
  const totalRevenueAgg = await prisma.studyMaterialPurchase.aggregate({
    where: {
      instituteId,
      status: 'APPROVED',
    },
    _sum: {
      amount: true,
    },
  });
  const totalRevenue = parseFloat(totalRevenueAgg._sum.amount || 0);

  // Date Range / Monthly Analytics
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const rangeStart = startDate ? new Date(startDate) : startOfMonth;
  const rangeEnd = endDate ? new Date(endDate) : endOfMonth;

  const [monthlyApprovedPurchases, monthlyPending, monthlyRejected, monthlyRevenueAgg] = await Promise.all([
    prisma.studyMaterialPurchase.count({
      where: {
        instituteId,
        status: 'APPROVED',
        approvedAt: { gte: rangeStart, lte: rangeEnd },
      },
    }),
    prisma.studyMaterialPurchase.count({
      where: {
        instituteId,
        status: 'PENDING',
        createdAt: { gte: rangeStart, lte: rangeEnd },
      },
    }),
    prisma.studyMaterialPurchase.count({
      where: {
        instituteId,
        status: 'REJECTED',
        reviewedAt: { gte: rangeStart, lte: rangeEnd },
      },
    }),
    prisma.studyMaterialPurchase.aggregate({
      where: {
        instituteId,
        status: 'APPROVED',
        approvedAt: { gte: rangeStart, lte: rangeEnd },
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  const monthlyRevenue = parseFloat(monthlyRevenueAgg._sum.amount || 0);

  // Top Selling Notes
  const topNotes = await prisma.studyMaterial.findMany({
    where: {
      instituteId,
      accessType: 'PAID',
    },
    select: {
      id: true,
      title: true,
      language: true,
      price: true,
      currency: true,
      _count: {
        select: {
          purchases: {
            where: { status: 'APPROVED' },
          },
        },
      },
    },
    orderBy: {
      purchases: {
        _count: 'desc',
      },
    },
    take: 5,
  });

  const formattedTopNotes = topNotes
    .filter((n) => n._count.purchases > 0)
    .map((n) => ({
      id: n.id,
      title: n.title,
      language: n.language,
      price: n.price ? parseFloat(n.price) : 0,
      currency: n.currency,
      approvedSales: n._count.purchases,
      revenue: (n.price ? parseFloat(n.price) : 0) * n._count.purchases,
    }));

  return {
    kpis: {
      totalNotes,
      tamilNotes,
      englishNotes,
      sinhalaNotes,
      freeNotes,
      paidNotes,
      publishedNotes,
      draftNotes,
      archivedNotes,
      pendingPayments,
      approvedPurchases,
      rejectedPayments,
      totalRevenue,
    },
    dateRange: {
      startDate: rangeStart.toISOString(),
      endDate: rangeEnd.toISOString(),
      approvedPurchases: monthlyApprovedPurchases,
      pendingPayments: monthlyPending,
      rejectedPayments: monthlyRejected,
      revenue: monthlyRevenue,
    },
    topSelling: formattedTopNotes,
  };
}
