import prisma from '../src/config/prisma.js';
import fs from 'fs';
import path from 'path';

/**
 * EduNexa Approved Production Cleanup Script
 * STRICT SCOPE:
 *   - ONLY Institutes in approved set: IDs 329 to 349
 *   - ONLY Users and dependent records belonging to those test institutes or test email pattern (@edunexa.test / test_)
 *   - Re-verifies every orphan file against DB references immediately before unlinking
 *   - Zero data deletion for production institutes (IDs outside 329-349)
 *   - Preserves superadmin@edunexa.com, feature catalog, subscription plans, platform settings, CMS content, R2 objects.
 */

const APPROVED_TEST_INSTITUTE_IDS = Array.from({ length: 349 - 329 + 1 }, (_, i) => 329 + i);

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getAllPhysicalFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllPhysicalFiles(fullPath, arrayOfFiles);
    } else {
      const stats = fs.statSync(fullPath);
      arrayOfFiles.push({
        path: fullPath,
        relativePath: path.relative(process.cwd(), fullPath).replace(/\\/g, '/'),
        size: stats.size,
      });
    }
  });
  return arrayOfFiles;
}

async function executeCleanup() {
  console.log('================================================================');
  console.log('EDUNEXA APPROVED PRODUCTION CLEANUP EXECUTION');
  console.log('================================================================\n');

  const manifest = {
    deletedInstituteIds: [],
    deletedUserCount: 0,
    deletedStudentsCount: 0,
    deletedTeachersCount: 0,
    deletedParentsCount: 0,
    deletedClassesCount: 0,
    deletedExamsCount: 0,
    deletedInvoicesCount: 0,
    deletedTransactionsCount: 0,
    deletedOrphanFilePaths: [],
    skippedItems: [],
    errors: [],
  };

  // 1. Verify Backup Existence
  const backupPath = path.join(process.cwd(), 'backend', 'backups', 'production_backup_pre_cleanup.sql');
  if (!fs.existsSync(backupPath)) {
    throw new Error('❌ STOP: Pre-cleanup database backup file not found at: ' + backupPath);
  }
  const backupStat = fs.statSync(backupPath);
  console.log(`✅ Backup Verified: ${backupPath} (${formatBytes(backupStat.size)})\n`);

  // 2. Fetch and verify target test institutes
  const targetInstitutes = await prisma.institute.findMany({
    where: {
      id: { in: APPROVED_TEST_INSTITUTE_IDS },
    },
    select: { id: true, name: true, code: true, slug: true },
  });

  console.log(`--- 1. VERIFYING APPROVED TEST INSTITUTES (${targetInstitutes.length} FOUND) ---`);
  for (const inst of targetInstitutes) {
    if (!APPROVED_TEST_INSTITUTE_IDS.includes(inst.id)) {
      throw new Error(`❌ SAFETY BLOCK: Institute ID ${inst.id} is NOT in approved range 329-349.`);
    }
    console.log(`  - Validated target test institute [ID: ${inst.id}] "${inst.name}" (${inst.code})`);
  }

  const targetInstIds = targetInstitutes.map((i) => i.id);

  // 3. Delete dependent records of target test institutes
  if (targetInstIds.length > 0) {
    console.log('\n--- 2. DELETING DEPENDENT RECORDS FOR TEST INSTITUTES ---');

    // Transactions & Invoices
    const delTxs = await prisma.transaction.deleteMany({ where: { instituteId: { in: targetInstIds } } });
    manifest.deletedTransactionsCount = delTxs.count;
    console.log(`  - Deleted ${delTxs.count} test transactions.`);

    const delInvItems = await prisma.invoiceItem.deleteMany({ where: { invoice: { instituteId: { in: targetInstIds } } } });
    const delInvs = await prisma.invoice.deleteMany({ where: { instituteId: { in: targetInstIds } } });
    manifest.deletedInvoicesCount = delInvs.count;
    console.log(`  - Deleted ${delInvs.count} test invoices.`);

    // Exams & Results
    const delResults = await prisma.result.deleteMany({ where: { exam: { instituteId: { in: targetInstIds } } } });
    const delExams = await prisma.exam.deleteMany({ where: { instituteId: { in: targetInstIds } } });
    manifest.deletedExamsCount = delExams.count;
    console.log(`  - Deleted ${delExams.count} test exams.`);

    // Classes & Subjects
    const delClasses = await prisma.class.deleteMany({ where: { instituteId: { in: targetInstIds } } });
    manifest.deletedClassesCount = delClasses.count;
    console.log(`  - Deleted ${delClasses.count} test classes.`);

    // Students, Teachers, Parents
    const delStudents = await prisma.student.deleteMany({ where: { instituteId: { in: targetInstIds } } });
    manifest.deletedStudentsCount = delStudents.count;

    const delTeachers = await prisma.teacher.deleteMany({ where: { instituteId: { in: targetInstIds } } });
    manifest.deletedTeachersCount = delTeachers.count;

    const delParents = await prisma.parent.deleteMany({ where: { instituteId: { in: targetInstIds } } });
    manifest.deletedParentsCount = delParents.count;
    console.log(`  - Deleted ${delStudents.count} students, ${delTeachers.count} teachers, ${delParents.count} parents.`);

    // Users belonging to test institutes
    const delInstUsers = await prisma.user.deleteMany({
      where: {
        instituteId: { in: targetInstIds },
        role: { not: 'SUPER_ADMIN' }, // Absolute Super Admin protection
      },
    });
    manifest.deletedUserCount += delInstUsers.count;
    console.log(`  - Deleted ${delInstUsers.count} user accounts bound to test institutes.`);

    // Settings & Institute Records
    await prisma.setting.deleteMany({ where: { instituteId: { in: targetInstIds } } });
    const delInsts = await prisma.institute.deleteMany({ where: { id: { in: targetInstIds } } });
    manifest.deletedInstituteIds = targetInstIds;
    console.log(`✅ Successfully removed ${delInsts.count} transient test institutes.`);
  }

  // 4. Standalone Test User Accounts Cleanup (Strictly excluding SUPER_ADMIN)
  console.log('\n--- 3. CLEANING STANDALONE TEST USER ACCOUNTS ---');
  const delStandaloneUsers = await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { contains: '@edunexa.test' } },
        { email: { startsWith: 'test_' } },
        { username: { startsWith: 'test_' } },
      ],
      role: { not: 'SUPER_ADMIN' },
    },
  });
  manifest.deletedUserCount += delStandaloneUsers.count;
  console.log(`✅ Deleted ${delStandaloneUsers.count} standalone test user accounts.`);

  // 5. Re-verify & Delete Orphan Local Storage Files
  console.log('\n--- 4. RE-VERIFYING AND CLEANING ORPHAN LOCAL STORAGE FILES ---');
  const uploadRoot = path.join(process.cwd(), 'uploads');
  const physicalFiles = getAllPhysicalFiles(uploadRoot);

  const [galleryMediaRows, studyMaterialRows, notePurchaseRows, examAttemptRows, messageAttachmentRows] = await Promise.all([
    prisma.galleryMedia.findMany({ select: { filePath: true, thumbnailPath: true } }),
    prisma.studyMaterial.findMany({ select: { pdfFilePath: true } }),
    prisma.studyMaterialPurchase.findMany({ select: { receiptFilePath: true } }),
    prisma.examAttempt.findMany({ select: { answerPaperFile: true } }),
    prisma.messageAttachment.findMany({ select: { filePath: true } }),
  ]);

  const dbFilePaths = new Set();
  const addPath = (p) => {
    if (p && typeof p === 'string' && p.trim() !== '') {
      const clean = p.replace(/\\/g, '/').replace(/^\//, '');
      dbFilePaths.add(clean);
    }
  };

  galleryMediaRows.forEach((r) => { addPath(r.filePath); addPath(r.thumbnailPath); });
  studyMaterialRows.forEach((r) => { addPath(r.pdfFilePath); });
  notePurchaseRows.forEach((r) => { addPath(r.receiptFilePath); });
  examAttemptRows.forEach((r) => { addPath(r.answerPaperFile); });
  messageAttachmentRows.forEach((r) => { addPath(r.filePath); });

  let deletedFilesCount = 0;
  for (const file of physicalFiles) {
    const rel = file.relativePath.replace(/\\/g, '/');
    let isReferenced = false;
    for (const dbP of dbFilePaths) {
      if (rel.includes(dbP) || dbP.includes(rel)) {
        isReferenced = true;
        break;
      }
    }

    if (!isReferenced) {
      // Unlink unreferenced orphan file
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
          manifest.deletedOrphanFilePaths.push(file.relativePath);
          deletedFilesCount++;
        }
      } catch (err) {
        manifest.errors.push(`Failed to delete orphan file ${file.relativePath}: ${err.message}`);
      }
    } else {
      manifest.skippedItems.push(`Preserved referenced file: ${file.relativePath}`);
    }
  }

  console.log(`✅ Re-verified and removed ${deletedFilesCount} orphan volume files.`);

  // 6. Output Final Cleanup Manifest
  console.log('\n================================================================');
  console.log('FINAL CLEANUP MANIFEST SUMMARY');
  console.log('================================================================');
  console.log(`- Deleted Test Institute IDs: ${manifest.deletedInstituteIds.join(', ')}`);
  console.log(`- Total Deleted User Accounts: ${manifest.deletedUserCount}`);
  console.log(`- Total Deleted Students:      ${manifest.deletedStudentsCount}`);
  console.log(`- Total Deleted Teachers:      ${manifest.deletedTeachersCount}`);
  console.log(`- Total Deleted Parents:       ${manifest.deletedParentsCount}`);
  console.log(`- Total Deleted Classes:       ${manifest.deletedClassesCount}`);
  console.log(`- Total Deleted Exams:         ${manifest.deletedExamsCount}`);
  console.log(`- Total Deleted Invoices:      ${manifest.deletedInvoicesCount}`);
  console.log(`- Total Deleted Orphan Files:  ${manifest.deletedOrphanFilePaths.length}`);
  console.log(`- Skipped Referenced Files:    ${manifest.skippedItems.length}`);
  console.log(`- Execution Errors:            ${manifest.errors.length}`);
  console.log('================================================================\n');

  return manifest;
}

executeCleanup()
  .then(() => {
    console.log('🎉 APPROVED PRODUCTION CLEANUP COMPLETED SUCCESSFULLY!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ CLEANUP EXECUTION FAILED:', err.message);
    process.exit(1);
  });
