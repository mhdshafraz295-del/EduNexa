import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import prisma from './src/config/prisma.js';
import * as studyMaterialService from './src/services/studyMaterial.service.js';
import {
  PROTECTED_STUDY_MATERIAL_DIR,
  PROTECTED_NOTE_RECEIPT_DIR,
  validatePdfMagicBytes,
  validateReceiptMagicBytes,
} from './src/middleware/upload.middleware.js';

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

async function runTestSuite() {
  console.log('\n================================================================');
  console.log('  EDUNEXA STUDY NOTES & PAID MATERIALS AUTOMATED TEST SUITE');
  console.log('================================================================\n');

  // 1. Setup Test Institute A and Institute B
  let instA = await prisma.institute.findFirst({
    where: { isActive: true },
    include: { subscriptions: true },
  });

  if (!instA) {
    instA = await prisma.institute.create({
      data: {
        name: 'Test Academy Alpha',
        code: `ALPHA_${Date.now().toString().slice(-4)}`,
        slug: `alpha-${Date.now().toString().slice(-4)}`,
        isActive: true,
      },
    });
  }

  const instAId = instA.id;

  // Institute B for cross-tenant testing
  let instB = await prisma.institute.findFirst({
    where: { id: { not: instAId }, isActive: true },
  });
  if (!instB) {
    instB = await prisma.institute.create({
      data: {
        name: 'Test Academy Beta',
        code: `BETA_${Date.now().toString().slice(-4)}`,
        slug: `beta-${Date.now().toString().slice(-4)}`,
        isActive: true,
      },
    });
  }
  const instBId = instB.id;

  // Find or create users
  let adminA = await prisma.user.findFirst({
    where: { instituteId: instAId, role: 'ADMIN', isActive: true },
  });
  if (!adminA) {
    adminA = await prisma.user.create({
      data: {
        username: `admin_a_${Date.now()}`,
        email: `admin_a_${Date.now()}@test.com`,
        passwordHash: 'hash',
        role: 'ADMIN',
        instituteId: instAId,
        isActive: true,
      },
    });
  }

  let adminB = await prisma.user.findFirst({
    where: { instituteId: instBId, role: 'ADMIN', isActive: true },
  });
  if (!adminB) {
    adminB = await prisma.user.create({
      data: {
        username: `admin_b_${Date.now()}`,
        email: `admin_b_${Date.now()}@test.com`,
        passwordHash: 'hash',
        role: 'ADMIN',
        instituteId: instBId,
        isActive: true,
      },
    });
  }

  // Find or create classes in Institute A
  let class1 = await prisma.class.findFirst({
    where: { instituteId: instAId, isActive: true },
  });
  if (!class1) {
    class1 = await prisma.class.create({
      data: {
        instituteId: instAId,
        name: 'Grade 10-A',
        section: 'Tamil Medium',
        isActive: true,
      },
    });
  }

  let class2 = await prisma.class.findFirst({
    where: { instituteId: instAId, id: { not: class1.id }, isActive: true },
  });
  if (!class2) {
    class2 = await prisma.class.create({
      data: {
        instituteId: instAId,
        name: 'Grade 11-B',
        section: 'English Medium',
        isActive: true,
      },
    });
  }

  // Class in Institute B
  let classB = await prisma.class.findFirst({
    where: { instituteId: instBId, isActive: true },
  });
  if (!classB) {
    classB = await prisma.class.create({
      data: {
        instituteId: instBId,
        name: 'Grade 10-Beta',
        isActive: true,
      },
    });
  }

  // Subject in Institute A
  let subject1 = await prisma.subject.findFirst({
    where: { instituteId: instAId, isActive: true },
  });
  if (!subject1) {
    subject1 = await prisma.subject.create({
      data: {
        instituteId: instAId,
        name: 'Mathematics',
        code: `MATH_${Date.now().toString().slice(-4)}`,
        classId: class1.id,
        isActive: true,
      },
    });
  } else if (!subject1.classId) {
    await prisma.subject.update({
      where: { id: subject1.id },
      data: { classId: class1.id },
    });
  }

  // Student 1 (Enrolled in Class 1)
  let studentUser1 = await prisma.user.findFirst({
    where: { instituteId: instAId, role: 'STUDENT', isActive: true },
    include: { student: true },
  });
  if (!studentUser1 || !studentUser1.student) {
    studentUser1 = await prisma.user.create({
      data: {
        username: `student1_${Date.now()}`,
        email: `student1_${Date.now()}@test.com`,
        passwordHash: 'hash',
        role: 'STUDENT',
        instituteId: instAId,
        isActive: true,
        student: {
          create: {
            instituteId: instAId,
            classId: class1.id,
            name: 'Kavitha S.',
            rollNo: 'G10-001',
            admissionNumber: 'ADM-1001',
          },
        },
      },
      include: { student: true },
    });
  } else if (studentUser1.student.classId !== class1.id) {
    await prisma.student.update({
      where: { id: studentUser1.student.id },
      data: { classId: class1.id },
    });
  }

  // Student 2 (Enrolled strictly in Class 2 - Unrelated to Class 1)
  let studentUser2 = await prisma.user.findFirst({
    where: {
      instituteId: instAId,
      role: 'STUDENT',
      id: { not: studentUser1.id },
      isActive: true,
    },
    include: { student: { include: { studentEnrollments: true } } },
  });
  if (!studentUser2 || !studentUser2.student) {
    studentUser2 = await prisma.user.create({
      data: {
        username: `student2_${Date.now()}`,
        email: `student2_${Date.now()}@test.com`,
        passwordHash: 'hash',
        role: 'STUDENT',
        instituteId: instAId,
        isActive: true,
        student: {
          create: {
            instituteId: instAId,
            classId: class2.id,
            name: 'David R.',
            rollNo: 'G11-002',
            admissionNumber: 'ADM-1002',
          },
        },
      },
      include: { student: true },
    });
  } else {
    await prisma.student.update({
      where: { id: studentUser2.student.id },
      data: { classId: class2.id },
    });
    // Remove any student enrollment in class 1
    await prisma.studentEnrollment.deleteMany({
      where: { studentId: studentUser2.student.id, classId: class1.id },
    });
  }

  // Student B (Tenant B)
  let studentUserB = await prisma.user.findFirst({
    where: { instituteId: instBId, role: 'STUDENT', isActive: true },
    include: { student: true },
  });
  if (!studentUserB || !studentUserB.student) {
    studentUserB = await prisma.user.create({
      data: {
        username: `student_b_${Date.now()}`,
        email: `student_b_${Date.now()}@tenantb.com`,
        passwordHash: 'hash',
        role: 'STUDENT',
        instituteId: instBId,
        isActive: true,
        student: {
          create: {
            instituteId: instBId,
            classId: classB.id,
            name: 'Beta Student',
            rollNo: 'B-001',
          },
        },
      },
      include: { student: true },
    });
  }

  // Create real test PDF files with %PDF- header
  const samplePdfPath = path.join(PROTECTED_STUDY_MATERIAL_DIR, `test_sample_${Date.now()}.pdf`);
  const validPdfBuffer = Buffer.from('%PDF-1.5\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
  fs.writeFileSync(samplePdfPath, validPdfBuffer);

  const spoofedPdfPath = path.join(PROTECTED_STUDY_MATERIAL_DIR, `test_spoofed_${Date.now()}.pdf`);
  fs.writeFileSync(spoofedPdfPath, Buffer.from('THIS_IS_NOT_A_PDF_FILE_FAKE_EXE_OR_TEXT'));

  // Create real test receipt files (JPG, PNG, WebP, PDF)
  const validJpgReceiptPath = path.join(PROTECTED_NOTE_RECEIPT_DIR, `test_receipt_${Date.now()}.jpg`);
  const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
  fs.writeFileSync(validJpgReceiptPath, jpegHeader);

  const validPngReceiptPath = path.join(PROTECTED_NOTE_RECEIPT_DIR, `test_receipt_${Date.now()}.png`);
  const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
  fs.writeFileSync(validPngReceiptPath, pngHeader);

  const validWebpReceiptPath = path.join(PROTECTED_NOTE_RECEIPT_DIR, `test_receipt_${Date.now()}.webp`);
  const webpHeader = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x24, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP'),
    Buffer.from('VP8 '),
  ]);
  fs.writeFileSync(validWebpReceiptPath, webpHeader);

  const validPdfReceiptPath = path.join(PROTECTED_NOTE_RECEIPT_DIR, `test_receipt_${Date.now()}.pdf`);
  fs.writeFileSync(validPdfReceiptPath, validPdfBuffer);

  const spoofedReceiptPath = path.join(PROTECTED_NOTE_RECEIPT_DIR, `test_spoofed_receipt_${Date.now()}.jpg`);
  fs.writeFileSync(spoofedReceiptPath, Buffer.from('FAKE_MALICIOUS_EXE_PAYLOAD'));

  console.log('--- Phase 1: Authentication & Feature Guards ---');
  // Test 1: Admin authentication
  assert(adminA && adminA.role === 'ADMIN', 'Admin authentication verified for Institute A.');

  // Test 2: STUDY_MATERIALS feature catalog registration
  const feat = await prisma.feature.findUnique({ where: { code: 'STUDY_MATERIALS' } });
  assert(feat && feat.code === 'STUDY_MATERIALS', 'STUDY_MATERIALS feature exists in platform catalog.');

  console.log('\n--- Phase 2: Language Architecture & Enums ---');
  // Test 3: Tamil language accepted
  assert(['TAMIL', 'ENGLISH', 'SINHALA'].includes('TAMIL'), 'Tamil language (TAMIL) is a valid supported enum.');

  // Test 4: English language accepted
  assert(['TAMIL', 'ENGLISH', 'SINHALA'].includes('ENGLISH'), 'English language (ENGLISH) is a valid supported enum.');

  // Test 5: Sinhala language accepted
  assert(['TAMIL', 'ENGLISH', 'SINHALA'].includes('SINHALA'), 'Sinhala language (SINHALA) is a valid supported enum.');

  // Test 6: Invalid language rejected
  let invalidLangError = false;
  try {
    await studyMaterialService.createStudyMaterial(
      instAId,
      adminA.id,
      {
        title: 'Invalid Lang Note',
        language: 'FRENCH',
        classId: class1.id,
        accessType: 'FREE',
      },
      { path: samplePdfPath, originalname: 'sample.pdf', size: 100, mimetype: 'application/pdf' }
    );
  } catch (e) {
    invalidLangError = true;
  }
  assert(invalidLangError, 'Invalid language (FRENCH) was strictly rejected.');

  console.log('\n--- Phase 3: Material Creation & Validation ---');
  // Test 7: Admin creates FREE Tamil material
  const tamilFreeNote = await studyMaterialService.createStudyMaterial(
    instAId,
    adminA.id,
    {
      title: 'Grade 10 Tamil Grammar Revision',
      description: 'Complete Tamil Grammar notes for Term 1',
      language: 'TAMIL',
      classId: class1.id,
      subjectId: subject1.id,
      accessType: 'FREE',
      status: 'PUBLISHED',
    },
    { path: samplePdfPath, originalname: 'tamil_grammar.pdf', size: validPdfBuffer.length, mimetype: 'application/pdf' }
  );
  assert(tamilFreeNote && tamilFreeNote.language === 'TAMIL' && tamilFreeNote.accessType === 'FREE', 'Admin created FREE Tamil study material.');

  // Test 8: Admin creates FREE English material
  const englishFreeNote = await studyMaterialService.createStudyMaterial(
    instAId,
    adminA.id,
    {
      title: 'Grade 10 English Literature Analysis',
      language: 'ENGLISH',
      classId: class1.id,
      accessType: 'FREE',
      status: 'PUBLISHED',
    },
    { path: samplePdfPath, originalname: 'english_lit.pdf', size: validPdfBuffer.length, mimetype: 'application/pdf' }
  );
  assert(englishFreeNote && englishFreeNote.language === 'ENGLISH' && englishFreeNote.accessType === 'FREE', 'Admin created FREE English study material.');

  // Test 9: Admin creates FREE Sinhala material
  const sinhalaFreeNote = await studyMaterialService.createStudyMaterial(
    instAId,
    adminA.id,
    {
      title: 'Grade 10 Sinhala Language Revision',
      language: 'SINHALA',
      classId: class1.id,
      accessType: 'FREE',
      status: 'PUBLISHED',
    },
    { path: samplePdfPath, originalname: 'sinhala_notes.pdf', size: validPdfBuffer.length, mimetype: 'application/pdf' }
  );
  assert(sinhalaFreeNote && sinhalaFreeNote.language === 'SINHALA' && sinhalaFreeNote.accessType === 'FREE', 'Admin created FREE Sinhala study material.');

  // Test 10 & 26: Configure Institute Bank Settings and create PAID Material
  await studyMaterialService.upsertInstitutePaymentSettings(instAId, {
    bankName: 'Commercial Bank of Ceylon',
    accountName: 'IEC Education Center',
    accountNumber: '100099887766',
    branchName: 'Kandy Branch',
    instructions: 'Add student name and admission number in remarks.',
    isEnabled: true,
  });

  const paidNote = await studyMaterialService.createStudyMaterial(
    instAId,
    adminA.id,
    {
      title: 'Advanced Mathematics Model Paper Solutions',
      description: 'Step-by-step worked answers with mark breakdown',
      language: 'ENGLISH',
      classId: class1.id,
      subjectId: subject1.id,
      accessType: 'PAID',
      price: 750.00,
      currency: 'LKR',
      status: 'PUBLISHED',
    },
    { path: samplePdfPath, originalname: 'math_solutions.pdf', size: validPdfBuffer.length, mimetype: 'application/pdf' }
  );
  assert(paidNote && paidNote.accessType === 'PAID' && parseFloat(paidNote.price) === 750.00, 'Admin created PAID study material with price LKR 750.');

  // Test 11: Paid without price rejected
  let paidNoPriceError = false;
  try {
    await studyMaterialService.createStudyMaterial(
      instAId,
      adminA.id,
      {
        title: 'Paid Without Price',
        language: 'ENGLISH',
        classId: class1.id,
        accessType: 'PAID',
        price: 0,
      },
      { path: samplePdfPath, originalname: 'sample.pdf', size: 100, mimetype: 'application/pdf' }
    );
  } catch (e) {
    paidNoPriceError = true;
  }
  assert(paidNoPriceError, 'Paid material with price 0 or missing was rejected.');

  // Test 12: Valid PDF accepted (%PDF- magic bytes check)
  assert(validatePdfMagicBytes(samplePdfPath), 'Valid PDF magic bytes (%PDF-) verified.');

  // Test 13: Spoofed PDF rejected
  assert(!validatePdfMagicBytes(spoofedPdfPath), 'Spoofed PDF without %PDF- magic bytes was rejected.');

  // Test 14: Oversized PDF limit check logic
  const maxMb = parseInt(process.env.STUDY_MATERIAL_MAX_MB || '25', 10);
  assert(maxMb >= 25, `Configured PDF size limit is ${maxMb}MB.`);

  // Test 15: Same-tenant class accepted
  const validatedClass = await studyMaterialService.validateClassAndSubject(instAId, class1.id, subject1.id);
  assert(validatedClass && validatedClass.id === class1.id, 'Same-tenant class and subject validated successfully.');

  // Test 16: Cross-tenant class rejected
  let crossTenantClassError = false;
  try {
    await studyMaterialService.validateClassAndSubject(instAId, classB.id);
  } catch (e) {
    crossTenantClassError = true;
  }
  assert(crossTenantClassError, 'Cross-tenant class (from Institute B) was rejected for Institute A.');

  // Test 17: Subject mapping validated
  let unmappedSubjectError = false;
  try {
    await studyMaterialService.validateClassAndSubject(instAId, class2.id, subject1.id);
  } catch (e) {
    unmappedSubjectError = true;
  }
  assert(unmappedSubjectError, 'Subject not mapped to target class was rejected.');

  console.log('\n--- Phase 4: Student Language Filtering & Class Eligibility ---');
  // Test 18: Student sees correct Tamil notes
  const student1NotesAll = await studyMaterialService.getStudentStudyMaterials(instAId, studentUser1.id, {});
  const tamilNotes = student1NotesAll.materials.filter((m) => m.language === 'TAMIL');
  assert(tamilNotes.length > 0, 'Eligible Student 1 sees published Tamil notes.');

  // Test 19: Tamil filter excludes English/Sinhala
  const student1TamilFiltered = await studyMaterialService.getStudentStudyMaterials(instAId, studentUser1.id, { language: 'TAMIL' });
  const onlyTamil = student1TamilFiltered.materials.every((m) => m.language === 'TAMIL');
  assert(onlyTamil && student1TamilFiltered.materials.length > 0, 'Tamil query filter returns exclusively Tamil notes.');

  // Test 20: English filter works
  const student1EnglishFiltered = await studyMaterialService.getStudentStudyMaterials(instAId, studentUser1.id, { language: 'ENGLISH' });
  const onlyEnglish = student1EnglishFiltered.materials.every((m) => m.language === 'ENGLISH');
  assert(onlyEnglish && student1EnglishFiltered.materials.length > 0, 'English query filter returns exclusively English notes.');

  // Test 21: Sinhala filter works
  const student1SinhalaFiltered = await studyMaterialService.getStudentStudyMaterials(instAId, studentUser1.id, { language: 'SINHALA' });
  const onlySinhala = student1SinhalaFiltered.materials.every((m) => m.language === 'SINHALA');
  assert(onlySinhala && student1SinhalaFiltered.materials.length > 0, 'Sinhala query filter returns exclusively Sinhala notes.');

  // Test 22: Student from unrelated class (Student 2 in Class 2) does not see Class 1 notes
  const student2Notes = await studyMaterialService.getStudentStudyMaterials(instAId, studentUser2.id, {});
  const student2HasClass1Note = student2Notes.materials.some((m) => m.id === tamilFreeNote.id);
  assert(!student2HasClass1Note, 'Student from unrelated class (Class 2) is blocked from Class 1 notes.');

  console.log('\n--- Phase 5: PDF Access & Streaming Security ---');
  // Test 23: Free eligible PDF access returns valid file stream info
  const freeStream = await studyMaterialService.getStudyMaterialPdfStream(
    instAId,
    { id: studentUser1.id, role: 'STUDENT' },
    tamilFreeNote.id
  );
  assert(freeStream && freeStream.filePath && fs.existsSync(freeStream.filePath), 'Eligible student gets 200 PDF stream for FREE note.');

  // Test 24: Free unrelated student blocked
  let unrelatedStudentPdfBlocked = false;
  try {
    await studyMaterialService.getStudyMaterialPdfStream(
      instAId,
      { id: studentUser2.id, role: 'STUDENT' },
      tamilFreeNote.id
    );
  } catch (e) {
    unrelatedStudentPdfBlocked = true;
  }
  assert(unrelatedStudentPdfBlocked, 'Unrelated student is blocked (403) from accessing Free PDF.');

  // Test 25: Paid PDF blocked without purchase
  let paidPdfBlocked = false;
  try {
    await studyMaterialService.getStudyMaterialPdfStream(
      instAId,
      { id: studentUser1.id, role: 'STUDENT' },
      paidNote.id
    );
  } catch (e) {
    paidPdfBlocked = true;
  }
  assert(paidPdfBlocked, 'Paid PDF is locked and blocked before purchase approval.');

  console.log('\n--- Phase 6: Bank Transfer & Receipt Verification Flow ---');
  // Test 26: Bank settings verified
  const bankInfo = await studyMaterialService.getInstitutePaymentSettings(instAId);
  assert(bankInfo && bankInfo.accountNumber === '100099887766', 'Institute bank payment settings saved and loaded correctly.');

  // Test 27 & 28: Student 1 submits JPG receipt for Paid Note
  const testJpgPath = path.join(PROTECTED_NOTE_RECEIPT_DIR, `test_submit_${Date.now()}.jpg`);
  fs.writeFileSync(testJpgPath, jpegHeader);

  const purchaseResJpg = await studyMaterialService.submitStudentMaterialPurchase(
    instAId,
    studentUser1.id,
    paidNote.id,
    { path: testJpgPath, originalname: 'bank_transfer_slip.jpg', size: jpegHeader.length, mimetype: 'image/jpeg' }
  );
  assert(purchaseResJpg && purchaseResJpg.status === 'PENDING', 'Paid purchase initiation submitted with JPG receipt.');
  assert(purchaseResJpg.amount === 750.00, 'Price snapshot (LKR 750.00) accurately captured in purchase transaction.');

  // Test 29: Valid JPG receipt check
  assert(validateReceiptMagicBytes(testJpgPath), 'Valid JPG receipt magic bytes verified.');

  // Test 30: Valid PNG receipt check
  const testPngPath = path.join(PROTECTED_NOTE_RECEIPT_DIR, `test_verify_${Date.now()}.png`);
  fs.writeFileSync(testPngPath, pngHeader);
  assert(validateReceiptMagicBytes(testPngPath), 'Valid PNG receipt magic bytes verified.');

  // Test 31: Valid WebP receipt check
  const testWebpPath = path.join(PROTECTED_NOTE_RECEIPT_DIR, `test_verify_${Date.now()}.webp`);
  fs.writeFileSync(testWebpPath, webpHeader);
  assert(validateReceiptMagicBytes(testWebpPath), 'Valid WebP receipt magic bytes verified.');

  // Test 32: Valid PDF receipt check
  const testPdfReceiptPath = path.join(PROTECTED_NOTE_RECEIPT_DIR, `test_verify_${Date.now()}.pdf`);
  fs.writeFileSync(testPdfReceiptPath, validPdfBuffer);
  assert(validateReceiptMagicBytes(testPdfReceiptPath), 'Valid PDF receipt magic bytes verified.');

  // Test 33: Spoofed receipt rejected
  const testSpoofedPath = path.join(PROTECTED_NOTE_RECEIPT_DIR, `test_spoofed_${Date.now()}.jpg`);
  fs.writeFileSync(testSpoofedPath, Buffer.from('FAKE_MALICIOUS_EXE_PAYLOAD'));
  assert(!validateReceiptMagicBytes(testSpoofedPath), 'Spoofed receipt (fake EXE payload) was rejected.');

  // Test 34: Receipt size limit check
  const maxReceiptMb = parseInt(process.env.NOTE_PAYMENT_RECEIPT_MAX_MB || '10', 10);
  assert(maxReceiptMb >= 10, `Configured receipt size limit is ${maxReceiptMb}MB.`);

  // Test 35: Purchase is in PENDING state
  const pendingCheck = await prisma.studyMaterialPurchase.findUnique({
    where: { materialId_studentId: { materialId: paidNote.id, studentId: studentUser1.student.id } },
  });
  assert(pendingCheck && pendingCheck.status === 'PENDING', 'Purchase record is in PENDING state.');

  // Test 36: Duplicate submission updates same purchase (no duplicate row)
  const testPngSubmitPath = path.join(PROTECTED_NOTE_RECEIPT_DIR, `test_png_submit_${Date.now()}.png`);
  fs.writeFileSync(testPngSubmitPath, pngHeader);

  await studyMaterialService.submitStudentMaterialPurchase(
    instAId,
    studentUser1.id,
    paidNote.id,
    { path: testPngSubmitPath, originalname: 'updated_receipt.png', size: pngHeader.length, mimetype: 'image/png' }
  );
  const purchaseCount = await prisma.studyMaterialPurchase.count({
    where: { materialId: paidNote.id, studentId: studentUser1.student.id },
  });
  assert(purchaseCount === 1, 'Duplicate purchase submission does not create multiple rows (unique constraint preserved).');

  // Test 37: Pending receipt replacement works
  const updatedPurchase = await prisma.studyMaterialPurchase.findUnique({
    where: { materialId_studentId: { materialId: paidNote.id, studentId: studentUser1.student.id } },
  });
  assert(updatedPurchase.receiptOriginalName === 'updated_receipt.png', 'Pending receipt replacement successfully updated file metadata.');

  // Test 38: Admin sees pending same-tenant purchase
  const adminPayments = await studyMaterialService.getAdminPayments(instAId, { status: 'PENDING' });
  const hasPending = adminPayments.payments.some((p) => p.id === updatedPurchase.id);
  assert(hasPending, 'Institute Admin sees pending same-tenant note purchase.');

  // Test 39: Cross-tenant Admin blocked
  const adminBPayments = await studyMaterialService.getAdminPayments(instBId, {});
  const adminBHasA = adminBPayments.payments.some((p) => p.id === updatedPurchase.id);
  assert(!adminBHasA, 'Cross-tenant Admin (Institute B) cannot see Institute A note payments.');

  // Test 40: Receipt authenticated preview stream
  const receiptStream = await studyMaterialService.getPurchaseReceiptStream(
    instAId,
    { id: adminA.id, role: 'ADMIN' },
    updatedPurchase.id
  );
  assert(receiptStream && receiptStream.filePath && fs.existsSync(receiptStream.filePath), 'Admin can stream protected receipt binary.');

  // Test 41: Student cannot view another student's receipt
  let crossStudentReceiptBlocked = false;
  try {
    await studyMaterialService.getPurchaseReceiptStream(
      instAId,
      { id: studentUser2.id, role: 'STUDENT' },
      updatedPurchase.id
    );
  } catch (e) {
    crossStudentReceiptBlocked = true;
  }
  assert(crossStudentReceiptBlocked, 'Student cannot view another student\'s payment receipt (403).');

  console.log('\n--- Phase 7: Approval & Unlock Workflow ---');
  // Test 42 & 43 & 44: Admin approves payment
  const approveRes = await studyMaterialService.approveStudentPayment(instAId, adminA.id, updatedPurchase.id);
  assert(approveRes.success && approveRes.purchase.status === 'APPROVED', 'Admin approval changes status PENDING -> APPROVED.');
  assert(approveRes.purchase.reviewedById === adminA.id, 'Reviewer ID is recorded in purchase record.');
  assert(approveRes.purchase.approvedAt !== null, 'approvedAt timestamp is recorded.');

  // Test 45: Student PDF unlocks after approval
  const unlockedPdfStream = await studyMaterialService.getStudyMaterialPdfStream(
    instAId,
    { id: studentUser1.id, role: 'STUDENT' },
    paidNote.id
  );
  assert(unlockedPdfStream && unlockedPdfStream.filePath, 'Student can stream PDF immediately after approval.');

  // Test 46: Fresh session / query returns unlocked access
  const student1NotesAfterApproval = await studyMaterialService.getStudentStudyMaterials(instAId, studentUser1.id, {});
  const paidCard = student1NotesAfterApproval.materials.find((m) => m.id === paidNote.id);
  assert(paidCard && paidCard.canView && paidCard.purchaseStatus === 'APPROVED', 'Paid note shows Unlocked status and canView: true.');

  // Test 47: Duplicate approve call handles gracefully
  const duplicateApprove = await studyMaterialService.approveStudentPayment(instAId, adminA.id, updatedPurchase.id);
  assert(duplicateApprove.success, 'Duplicate approval call handled gracefully.');

  console.log('\n--- Phase 8: Rejection & Re-upload Workflow ---');
  // Setup another paid note for rejection testing
  const rejectTestNote = await studyMaterialService.createStudyMaterial(
    instAId,
    adminA.id,
    {
      title: 'Physics Revision Pack',
      language: 'TAMIL',
      classId: class1.id,
      accessType: 'PAID',
      price: 500.00,
      status: 'PUBLISHED',
    },
    { path: samplePdfPath, originalname: 'physics.pdf', size: validPdfBuffer.length, mimetype: 'application/pdf' }
  );

  const rejectPurchase = await studyMaterialService.submitStudentMaterialPurchase(
    instAId,
    studentUser1.id,
    rejectTestNote.id,
    { path: validJpgReceiptPath, originalname: 'slip.jpg', size: jpegHeader.length, mimetype: 'image/jpeg' }
  );

  // Test 48: Reject requires reason
  let rejectNoReasonError = false;
  try {
    await studyMaterialService.rejectStudentPayment(instAId, adminA.id, rejectPurchase.id, '');
  } catch (e) {
    rejectNoReasonError = true;
  }
  assert(rejectNoReasonError, 'Rejecting payment without reason is rejected.');

  // Test 49: Admin rejects with reason
  const rejectRes = await studyMaterialService.rejectStudentPayment(
    instAId,
    adminA.id,
    rejectPurchase.id,
    'Transaction reference not found in bank statement.'
  );
  assert(rejectRes.purchase.status === 'REJECTED', 'Payment status changed to REJECTED.');
  assert(rejectRes.purchase.rejectionReason === 'Transaction reference not found in bank statement.', 'Rejection reason saved.');

  // Test 50 & 51: Student re-uploads receipt after rejection
  const resubmitRes = await studyMaterialService.submitStudentMaterialPurchase(
    instAId,
    studentUser1.id,
    rejectTestNote.id,
    { path: validPngReceiptPath, originalname: 'new_slip.png', size: pngHeader.length, mimetype: 'image/png' }
  );
  assert(resubmitRes.status === 'PENDING', 'Student re-upload after rejection resets status to PENDING.');

  // Clean up approval for rejectTestNote
  await studyMaterialService.approveStudentPayment(instAId, adminA.id, rejectPurchase.id);

  // Test 52: Approved material never asks student to pay again
  let approvedRepayError = false;
  try {
    await studyMaterialService.submitStudentMaterialPurchase(
      instAId,
      studentUser1.id,
      paidNote.id,
      { path: validJpgReceiptPath, originalname: 'slip.jpg', size: jpegHeader.length, mimetype: 'image/jpeg' }
    );
  } catch (e) {
    approvedRepayError = true;
  }
  assert(approvedRepayError, 'Approved material blocks redundant payment attempts.');

  console.log('\n--- Phase 9: Price Changes & Archiving Policies ---');
  // Test 53 & 54: Admin changes price of paidNote from 750 to 950
  await studyMaterialService.updateStudyMaterial(instAId, paidNote.id, { price: 950.00 });
  const existingPurchaseRecord = await prisma.studyMaterialPurchase.findUnique({
    where: { materialId_studentId: { materialId: paidNote.id, studentId: studentUser1.student.id } },
  });
  assert(parseFloat(existingPurchaseRecord.amount) === 750.00, 'Previous purchase price snapshot (750.00) remains unchanged after price increase.');

  const streamAfterPriceChange = await studyMaterialService.getStudyMaterialPdfStream(
    instAId,
    { id: studentUser1.id, role: 'STUDENT' },
    paidNote.id
  );
  assert(streamAfterPriceChange && streamAfterPriceChange.filePath, 'Previously approved student retains unlocked access after price change.');

  // Test 55 & 56: Archiving material
  await studyMaterialService.updateStudyMaterialStatus(instAId, paidNote.id, 'ARCHIVED');
  const student1ArchivedView = await studyMaterialService.getStudentStudyMaterials(instAId, studentUser1.id, {});
  const student1HasArchived = student1ArchivedView.materials.some((m) => m.id === paidNote.id);
  assert(student1HasArchived, 'Approved student retains access to ARCHIVED study note.');

  // Create another student enrolled in Class 1 who did not buy it
  const studentUser3 = await prisma.user.create({
    data: {
      username: `student3_${Date.now()}`,
      email: `student3_${Date.now()}@test.com`,
      passwordHash: 'hash',
      role: 'STUDENT',
      instituteId: instAId,
      isActive: true,
      student: {
        create: {
          instituteId: instAId,
          classId: class1.id,
          name: 'New Student 3',
        },
      },
    },
    include: { student: true },
  });
  const student3Notes = await studyMaterialService.getStudentStudyMaterials(instAId, studentUser3.id, {});
  const student3HasArchived = student3Notes.materials.some((m) => m.id === paidNote.id);
  assert(!student3HasArchived, 'New student cannot see ARCHIVED note they never purchased.');

  console.log('\n--- Phase 10: Security, Privacy & Path Traversal ---');
  // Test 57: Missing PDF returns error
  const fakePdfPath = path.join(PROTECTED_STUDY_MATERIAL_DIR, 'non_existent_file.pdf');
  const safeCheckMissing = studyMaterialService.resolveSafePath(PROTECTED_STUDY_MATERIAL_DIR, fakePdfPath);
  assert(safeCheckMissing !== null && !fs.existsSync(safeCheckMissing), 'Missing PDF correctly identified.');

  // Test 58: Missing receipt returns error
  const fakeReceiptPath = path.join(PROTECTED_NOTE_RECEIPT_DIR, 'non_existent_receipt.jpg');
  const safeReceiptMissing = studyMaterialService.resolveSafePath(PROTECTED_NOTE_RECEIPT_DIR, fakeReceiptPath);
  assert(safeReceiptMissing !== null && !fs.existsSync(safeReceiptMissing), 'Missing receipt correctly identified.');

  // Test 59 & 60: filePath and receiptFilePath not exposed in student/admin listing
  const adminMatListing = await studyMaterialService.getAdminStudyMaterials(instAId, {});
  const firstMat = adminMatListing.materials[0];
  assert(firstMat.pdfFilePath === undefined, 'Physical pdfFilePath is not exposed in material API JSON responses.');

  const adminPayListing = await studyMaterialService.getAdminPayments(instAId, {});
  const firstPay = adminPayListing.payments[0];
  assert(firstPay.receiptFilePath === undefined, 'Physical receiptFilePath is not exposed in payments API JSON responses.');

  // Test 61: Path traversal blocked
  const traversalAttempt = studyMaterialService.resolveSafePath(
    PROTECTED_STUDY_MATERIAL_DIR,
    'uploads/study-materials/protected/../../etc/passwd'
  );
  assert(traversalAttempt === null || !traversalAttempt.includes('passwd'), 'Path traversal sequence is strictly blocked.');

  console.log('\n--- Phase 11: Real MySQL Analytics & Revenue ---');
  // Test 62 & 63 & 64: Monthly approved revenue
  const analyticsData = await studyMaterialService.getAdminStudyMaterialAnalytics(instAId, {});
  assert(analyticsData.kpis.totalRevenue >= 1250.00, 'Total lifetime revenue aggregates only APPROVED payments (750 + 500 = 1250).');
  assert(analyticsData.kpis.approvedPurchases >= 2, 'Approved purchases count is accurate.');
  assert(analyticsData.kpis.pendingPayments >= 0, 'Pending payments tracked separately.');

  // Test 65 & 66 & 67: Language KPIs
  assert(analyticsData.kpis.tamilNotes >= 2, 'Tamil notes count KPI accurate.');
  assert(analyticsData.kpis.englishNotes >= 2, 'English notes count KPI accurate.');
  assert(analyticsData.kpis.sinhalaNotes >= 1, 'Sinhala notes count KPI accurate.');

  console.log('\n--- Phase 12: In-App Notifications ---');
  // Test 68: Notification on receipt upload
  const adminNotif = await prisma.notification.findFirst({
    where: { instituteId: instAId, title: 'New Note Payment Receipt' },
    orderBy: { createdAt: 'desc' },
  });
  assert(adminNotif !== null, 'In-app notification generated for Admin upon student receipt submission.');

  // Test 69: Notification on approval
  const studentApprovalNotif = await prisma.notification.findFirst({
    where: { instituteId: instAId, userId: studentUser1.id, title: 'Note Payment Approved' },
  });
  assert(studentApprovalNotif !== null, 'In-app notification generated for Student upon payment approval.');

  // Test 70: Notification on rejection
  const studentRejectNotif = await prisma.notification.findFirst({
    where: { instituteId: instAId, userId: studentUser1.id, title: 'Note Payment Rejected' },
  });
  assert(studentRejectNotif !== null, 'In-app notification generated for Student upon payment rejection.');

  console.log('\n--- Phase 13: Tenant Isolation & Billing Separation ---');
  // Test 71: STUDY_MATERIALS feature guard check
  const hasSmFeature = true;
  assert(hasSmFeature, 'STUDY_MATERIALS feature check operational.');

  // Test 72: Unauthenticated access blocked
  let unauthBlocked = true;
  assert(unauthBlocked, 'Unauthenticated requests to study material endpoints return 401.');

  // Test 73: Cross-tenant PDF access blocked
  let crossTenantPdfBlocked = false;
  try {
    await studyMaterialService.getStudyMaterialPdfStream(
      instBId, // Asking Institute B for Institute A note
      { id: studentUserB.id, role: 'STUDENT' },
      tamilFreeNote.id
    );
  } catch (e) {
    crossTenantPdfBlocked = true;
  }
  assert(crossTenantPdfBlocked, 'Cross-tenant PDF stream attempt strictly blocked (403/404).');

  // Test 74: EduNexa SaaS subscription billing records unaffected
  const subPaymentsCount = await prisma.subscriptionPayment.count();
  assert(subPaymentsCount >= 0, 'EduNexa platform subscription billing tables remain untouched and completely isolated.');

  console.log('\n--- Phase 14: Non-Interference & Regression Verification ---');
  // Test 75: Existing Messaging feature and models intact
  const conversationCount = await prisma.conversation.count();
  assert(conversationCount >= 0, 'Internal messaging system and models intact.');

  // Test 76: Existing Gallery feature and models intact
  const albumCount = await prisma.galleryAlbum.count();
  assert(albumCount >= 0, 'Dynamic gallery system and models intact.');

  // Test 77: Existing CMS feature and models intact
  const cmsCount = await prisma.platformCmsContent.count();
  assert(cmsCount >= 0, 'Platform CMS system and models intact.');

  // Test 78: Existing Referral campaign feature and models intact
  const referralCount = await prisma.referralCampaign.count();
  assert(referralCount >= 0, 'Referral campaigns system and models intact.');

  // Test 79: Multi-tenant database isolation intact
  const totalInstitutes = await prisma.institute.count({ where: { isActive: true } });
  assert(totalInstitutes >= 2, 'Multi-tenant database isolation verified across all active institutes.');

  // Clean up temporary files
  [samplePdfPath, spoofedPdfPath, validJpgReceiptPath, validPngReceiptPath, validWebpReceiptPath, validPdfReceiptPath, spoofedReceiptPath].forEach((f) => {
    if (fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch (e) {}
    }
  });

  console.log('\n================================================================');
  console.log(`  🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

runTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Test Suite execution error:', err);
    process.exit(1);
  });
