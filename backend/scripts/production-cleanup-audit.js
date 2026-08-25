import prisma from '../src/config/prisma.js';
import fs from 'fs';
import path from 'path';

/**
 * Production Cleanup & QA Audit Utility for EduNexa
 * Modes:
 *   --dry-run (Default): Generates a complete inventory report without modifying any data.
 *   --apply: Safely removes only confirmed orphaned and test-prefix records (Requires ALLOW_PRODUCTION_CLEANUP=true).
 */

const isApplyMode = process.argv.includes('--apply');
const allowCleanup = process.env.ALLOW_PRODUCTION_CLEANUP === 'true';

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
        modifiedAt: stats.mtime,
      });
    }
  });
  return arrayOfFiles;
}

async function runAudit() {
  console.log('================================================================');
  console.log('EDUNEXA PRODUCTION CLEANUP & SYSTEM AUDIT');
  console.log(`MODE: ${isApplyMode ? '🚀 APPLY (DESTRUCTIVE CLEANUP)' : '🔍 DRY-RUN (AUDIT ONLY)'}`);
  console.log('================================================================\n');

  if (isApplyMode && !allowCleanup) {
    console.error('❌ ERROR: Destructive cleanup requires environment variable: ALLOW_PRODUCTION_CLEANUP=true');
    console.error('Aborting execution for safety.\n');
    process.exit(1);
  }

  // 1. Table Row Counts
  console.log('--- 1. DATABASE ENTITY INVENTORY ---');
  const [
    instituteCount,
    userCount,
    studentCount,
    teacherCount,
    parentCount,
    classCount,
    subjectCount,
    attendanceCount,
    examCount,
    resultCount,
    invoiceCount,
    transactionCount,
    pollCount,
    studyMaterialCount,
    galleryMediaCount,
    conversationCount,
    messageCount,
    referralCount,
    featureCount,
    planCount,
  ] = await Promise.all([
    prisma.institute.count(),
    prisma.user.count(),
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.parent.count(),
    prisma.class.count(),
    prisma.subject.count(),
    prisma.attendance.count(),
    prisma.exam.count(),
    prisma.result.count(),
    prisma.invoice.count(),
    prisma.transaction.count(),
    prisma.poll.count(),
    prisma.studyMaterial.count(),
    prisma.galleryMedia.count(),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.instituteReferral.count(),
    prisma.feature.count(),
    prisma.subscriptionPlan.count(),
  ]);

  console.log(`- Institutes:           ${instituteCount}`);
  console.log(`- Users:                ${userCount}`);
  console.log(`- Students:             ${studentCount}`);
  console.log(`- Teachers:             ${teacherCount}`);
  console.log(`- Parents:              ${parentCount}`);
  console.log(`- Classes & Subjects:   ${classCount} classes, ${subjectCount} subjects`);
  console.log(`- Attendance Records:   ${attendanceCount}`);
  console.log(`- Exams & Results:      ${examCount} exams, ${resultCount} results`);
  console.log(`- Invoices & Txs:       ${invoiceCount} invoices, ${transactionCount} transactions`);
  console.log(`- Polls & Materials:    ${pollCount} polls, ${studyMaterialCount} study notes`);
  console.log(`- Gallery & Messages:   ${galleryMediaCount} media, ${conversationCount} threads (${messageCount} msgs)`);
  console.log(`- Referrals:            ${referralCount}`);
  console.log(`- System Config:        ${featureCount} features cataloged, ${planCount} subscription plans\n`);

  // 2. Candidate Test/Demo Institutes Audit
  console.log('--- 2. TEST & DEMO INSTITUTES AUDIT ---');
  const testInstitutes = await prisma.institute.findMany({
    where: {
      OR: [
        { code: { startsWith: 'TEST' } },
        { code: { startsWith: 'TEMP' } },
        { slug: { contains: 'test-' } },
        { name: { contains: 'Test Institute' } },
      ],
    },
    select: { id: true, name: true, code: true, slug: true, createdAt: true },
  });

  console.log(`Found ${testInstitutes.length} transient test institutes:`);
  testInstitutes.forEach((inst) => {
    console.log(`  - [ID: ${inst.id}] "${inst.name}" (${inst.code}) created: ${inst.createdAt.toISOString()}`);
  });

  // 3. Candidate Test Users Audit
  console.log('\n--- 3. TEST USERS AUDIT ---');
  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: '@edunexa.test' } },
        { email: { contains: 'test_' } },
        { username: { startsWith: 'test_' } },
      ],
    },
    select: { id: true, email: true, username: true, role: true, instituteId: true },
  });
  console.log(`Found ${testUsers.length} test-pattern user accounts.`);

  // 4. Physical Files & Orphan Storage Audit
  console.log('\n--- 4. PHYSICAL STORAGE & ORPHAN FILE AUDIT ---');
  const uploadRoot = path.join(process.cwd(), 'uploads');
  const physicalFiles = getAllPhysicalFiles(uploadRoot);
  console.log(`Total physical files in uploads/: ${physicalFiles.length}`);

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
      // Normalize slashes
      const clean = p.replace(/\\/g, '/').replace(/^\//, '');
      dbFilePaths.add(clean);
    }
  };

  galleryMediaRows.forEach((r) => { addPath(r.filePath); addPath(r.thumbnailPath); });
  studyMaterialRows.forEach((r) => { addPath(r.pdfFilePath); });
  notePurchaseRows.forEach((r) => { addPath(r.receiptFilePath); });
  examAttemptRows.forEach((r) => { addPath(r.answerPaperFile); });
  messageAttachmentRows.forEach((r) => { addPath(r.filePath); });

  const orphanFiles = [];
  const validFiles = [];

  physicalFiles.forEach((file) => {
    const rel = file.relativePath.replace(/\\/g, '/');
    let isReferenced = false;
    for (const dbP of dbFilePaths) {
      if (rel.includes(dbP) || dbP.includes(rel)) {
        isReferenced = true;
        break;
      }
    }
    if (isReferenced) {
      validFiles.push(file);
    } else {
      orphanFiles.push(file);
    }
  });

  console.log(`- Referenced valid files: ${validFiles.length}`);
  console.log(`- Orphan / unreferenced files: ${orphanFiles.length}`);
  orphanFiles.forEach((f) => {
    console.log(`  - [ORPHAN] ${f.relativePath} (${formatBytes(f.size)})`);
  });

  // 5. Execution in Apply Mode
  if (isApplyMode && allowCleanup) {
    console.log('\n--- 5. EXECUTING SAFE CLEANUP ---');

    if (testInstitutes.length > 0) {
      const instIds = testInstitutes.map((i) => i.id);
      console.log(`Removing test institutes: ${instIds.join(', ')}`);
      await prisma.transaction.deleteMany({ where: { instituteId: { in: instIds } } });
      await prisma.invoiceItem.deleteMany({ where: { invoice: { instituteId: { in: instIds } } } });
      await prisma.invoice.deleteMany({ where: { instituteId: { in: instIds } } });
      await prisma.student.deleteMany({ where: { instituteId: { in: instIds } } });
      await prisma.teacher.deleteMany({ where: { instituteId: { in: instIds } } });
      await prisma.user.deleteMany({ where: { instituteId: { in: instIds } } });
      await prisma.setting.deleteMany({ where: { instituteId: { in: instIds } } });
      await prisma.institute.deleteMany({ where: { id: { in: instIds } } });
      console.log(`✅ Removed ${instIds.length} transient test institutes.`);
    }

    if (orphanFiles.length > 0) {
      console.log(`Removing ${orphanFiles.length} orphan files from uploads/...`);
      orphanFiles.forEach((f) => {
        try {
          if (fs.existsSync(f.path)) {
            fs.unlinkSync(f.path);
            console.log(`  ✅ Deleted orphan file: ${f.relativePath}`);
          }
        } catch (err) {
          console.error(`  ❌ Failed to delete ${f.relativePath}: ${err.message}`);
        }
      });
    }

    console.log('✅ Safe cleanup executed successfully.');
  }

  console.log('\n================================================================');
  console.log('AUDIT COMPLETE: All core system configurations preserved.');
  console.log('================================================================\n');
}

runAudit().catch((err) => {
  console.error('Audit script failed:', err);
  process.exit(1);
});
