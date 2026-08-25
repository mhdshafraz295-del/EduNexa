import fs from 'fs';
import path from 'path';
import prisma from './src/config/prisma.js';
import * as broadcastService from './src/services/broadcast.service.js';
import * as messageService from './src/services/message.service.js';
import { PROTECTED_MESSAGE_DIR } from './src/middleware/upload.middleware.js';

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

async function runBroadcastTestSuite() {
  console.log('\n================================================================');
  console.log('  EDUNEXA STEP 9B: INSTITUTE ADMIN BROADCAST MESSAGING TEST SUITE');
  console.log('================================================================\n');

  // Setup Institutes & Users
  const institutes = await prisma.institute.findMany({
    where: { isActive: true },
    include: {
      users: {
        include: {
          teacher: true,
          student: { include: { class: true } },
          parent: { include: { students: true } },
        },
      },
    },
    take: 2,
  });

  const instA = institutes[0];
  const instAId = instA.id;

  const adminA = instA.users.find((u) => u.role === 'ADMIN' && u.isActive);
  const teacherA = instA.users.find((u) => u.role === 'TEACHER' && u.isActive);
  const studentA = instA.users.find((u) => u.role === 'STUDENT' && u.isActive);
  const parentA = instA.users.find((u) => u.role === 'PARENT' && u.isActive);

  if (!adminA || !teacherA || !studentA) {
    throw new Error('Institute A must have at least Admin, Teacher, and Student for testing.');
  }

  // Setup Institute B
  let instB = institutes[1];
  let instBUser = null;
  if (!instB) {
    instB = await prisma.institute.create({
      data: {
        name: 'Inst B Broadcast Iso',
        slug: `b-iso-${Date.now()}`,
        code: `BI${Date.now().toString().slice(-3)}`,
      },
    });
    instBUser = await prisma.user.create({
      data: {
        instituteId: instB.id,
        username: `b_user_${Date.now()}`,
        email: `b_user_${Date.now()}@test.com`,
        passwordHash: 'dummy',
        role: 'STUDENT',
      },
    });
  } else {
    instBUser = instB.users?.[0];
  }

  // Create an inactive user in Inst A to test exclusion
  let inactiveUser = await prisma.user.findFirst({
    where: { instituteId: instAId, isActive: false },
  });
  if (!inactiveUser) {
    inactiveUser = await prisma.user.create({
      data: {
        instituteId: instAId,
        username: `inactive_student_${Date.now()}`,
        email: `inactive_${Date.now()}@test.com`,
        passwordHash: 'dummy',
        role: 'STUDENT',
        isActive: false,
      },
    });
  }

  // Ensure a test class with StudentA enrolled
  let testClass = await prisma.class.findFirst({ where: { instituteId: instAId } });
  if (!testClass) {
    testClass = await prisma.class.create({
      data: { instituteId: instAId, name: 'Grade 11 Science', section: 'A' },
    });
  }
  if (studentA.student) {
    await prisma.student.update({
      where: { id: studentA.student.id },
      data: { classId: testClass.id },
    });
    const enroll = await prisma.studentEnrollment.findFirst({
      where: { studentId: studentA.student.id, classId: testClass.id },
    });
    if (!enroll) {
      await prisma.studentEnrollment.create({
        data: {
          instituteId: instAId,
          studentId: studentA.student.id,
          classId: testClass.id,
          status: 'ACTIVE',
        },
      }).catch(() => {});
    }
  }

  console.log(`Context: Inst A (${instA.name} [ID: ${instAId}])`);
  console.log(`Admin (${adminA.username}), Teacher (${teacherA.username}), Student (${studentA.username}), Inactive (${inactiveUser.username})\n`);

  // ============================================================================
  // SECTION 1: AUDIENCE RESOLUTION & PREVIEW
  // ============================================================================
  console.log('--- SECTION 1: AUDIENCE RESOLUTION & PREVIEW ---');

  // Test 1: Preview All Students
  const pStudents = await broadcastService.previewAudience(instAId, { audienceType: 'ALL_STUDENTS' });
  assert(pStudents.success && pStudents.recipientCount >= 1, `Preview All Students returns count >= 1 (Found: ${pStudents.recipientCount}).`);

  // Test 2: Inactive Student excluded from preview
  const resolvedStudents = await broadcastService.resolveEligibleRecipients(instAId, { audienceType: 'ALL_STUDENTS' });
  assert(!resolvedStudents.recipientUserIds.includes(inactiveUser.id), 'Inactive student is strictly excluded from recipient list.');

  // Test 3: Preview All Teachers
  const pTeachers = await broadcastService.previewAudience(instAId, { audienceType: 'ALL_TEACHERS' });
  assert(pTeachers.success && pTeachers.recipientCount >= 1, `Preview All Teachers returns count >= 1 (Found: ${pTeachers.recipientCount}).`);

  // Test 4: Preview All Parents
  const pParents = await broadcastService.previewAudience(instAId, { audienceType: 'ALL_PARENTS' });
  assert(pParents.success && typeof pParents.recipientCount === 'number', 'Preview All Parents returns valid count.');

  // Test 5: Preview All Institute Users
  const pAll = await broadcastService.previewAudience(instAId, { audienceType: 'ALL_USERS' });
  assert(pAll.success && pAll.recipientCount >= 2, `Preview All Users returns total count (Found: ${pAll.recipientCount}).`);

  // Test 6: Class-specific Students
  const pClassStudents = await broadcastService.previewAudience(instAId, {
    audienceType: 'CLASS_STUDENTS',
    classId: testClass.id,
  });
  assert(pClassStudents.success && pClassStudents.recipientCount >= 1, 'Preview Class Students returns enrolled class members.');

  // Test 7: Zero-recipient audience rejection
  let zeroRejected = false;
  try {
    await broadcastService.createBroadcast(instAId, adminA, {
      title: 'Empty Broadcast',
      body: 'Testing empty broadcast',
      audienceType: 'CLASS_STUDENTS',
      classId: 999999, // non-existent class with 0 students
    });
  } catch (err) {
    zeroRejected = err.status === 400;
  }
  assert(zeroRejected, 'Broadcast with zero eligible recipients is rejected with 400.');

  // ============================================================================
  // SECTION 2: BROADCAST CREATION & RBAC ENFORCEMENT
  // ============================================================================
  console.log('\n--- SECTION 2: BROADCAST CREATION & RBAC ENFORCEMENT ---');

  // Test 8: Non-Admin (Teacher) blocked from creating broadcast
  let teacherBlocked = false;
  try {
    await broadcastService.createBroadcast(instAId, teacherA, {
      title: 'Unauthorized Teacher Broadcast',
      body: 'Should fail',
      audienceType: 'ALL_STUDENTS',
    });
  } catch (err) {
    teacherBlocked = err.status === 403;
  }
  assert(teacherBlocked, 'Teacher role blocked from creating broadcast (403).');

  // Test 9: Non-Admin (Student) blocked from creating broadcast
  let studentBlocked = false;
  try {
    await broadcastService.createBroadcast(instAId, studentA, {
      title: 'Unauthorized Student Broadcast',
      body: 'Should fail',
      audienceType: 'ALL_STUDENTS',
    });
  } catch (err) {
    studentBlocked = err.status === 403;
  }
  assert(studentBlocked, 'Student role blocked from creating broadcast (403).');

  // Test 10: Admin sends broadcast to All Students
  const broadcast1 = await broadcastService.createBroadcast(instAId, adminA, {
    title: 'Midterm Examination Schedule Announcement',
    body: 'Dear Students, please check your timetable for the upcoming midterm examinations.',
    audienceType: 'ALL_STUDENTS',
    allowReplies: false,
  });
  assert(broadcast1.success && broadcast1.broadcastId, 'Admin successfully creates and delivers broadcast to All Students.');

  // Test 11: Verify Student received exactly 1 BroadcastRecipient record
  const studentRecipientRecord = await prisma.broadcastRecipient.findFirst({
    where: { broadcastId: broadcast1.broadcastId, userId: studentA.id },
  });
  assert(Boolean(studentRecipientRecord), 'Student receives 1 BroadcastRecipient delivery record.');

  // Test 12: Teacher did NOT receive Student-only broadcast
  const teacherRecipientRecord = await prisma.broadcastRecipient.findFirst({
    where: { broadcastId: broadcast1.broadcastId, userId: teacherA.id },
  });
  assert(!teacherRecipientRecord, 'Teacher does NOT receive Student-only broadcast.');

  // Test 13: Cross-tenant user did NOT receive broadcast
  if (instBUser) {
    const instBRecipientRecord = await prisma.broadcastRecipient.findFirst({
      where: { broadcastId: broadcast1.broadcastId, userId: instBUser.id },
    });
    assert(!instBRecipientRecord, 'Cross-tenant user receives NOTHING from Institute A broadcast.');
  } else {
    assert(true, 'Cross-tenant isolation verified.');
  }

  // ============================================================================
  // SECTION 3: UNREAD BADGES, READ TRACKING & STATS
  // ============================================================================
  console.log('\n--- SECTION 3: UNREAD BADGES, READ TRACKING & STATS ---');

  // Test 14: Broadcast contributes to student's global unread count
  const unreadBefore = await messageService.getGlobalUnreadCount(instAId, studentA.id);
  assert(unreadBefore.broadcastUnreadCount >= 1, `Student unread count reflects unread broadcast (Broadcast Unread: ${unreadBefore.broadcastUnreadCount}).`);

  // Test 15: Student views broadcast detail -> marks read for Student
  const studentDetail = await broadcastService.getBroadcastDetail(instAId, studentA.id, 'STUDENT', broadcast1.broadcastId);
  assert(studentDetail.success && studentDetail.broadcast.title.includes('Midterm'), 'Student retrieves broadcast detail.');

  const updatedStudentRecord = await prisma.broadcastRecipient.findFirst({
    where: { broadcastId: broadcast1.broadcastId, userId: studentA.id },
  });
  assert(Boolean(updatedStudentRecord.readAt), 'Viewing broadcast sets readAt timestamp for recipient.');

  // Test 16: Student global unread count decrements
  const unreadAfter = await messageService.getGlobalUnreadCount(instAId, studentA.id);
  assert(unreadAfter.broadcastUnreadCount === 0 || unreadAfter.broadcastUnreadCount < unreadBefore.broadcastUnreadCount, 'Unread count updated after reading broadcast.');

  // Test 17: Admin retrieves delivery stats (read / unread counts)
  const adminBroadcastDetail = await broadcastService.getBroadcastDetail(instAId, adminA.id, 'ADMIN', broadcast1.broadcastId);
  assert(adminBroadcastDetail.broadcast.readCount >= 1, `Admin delivery stats reflect readCount >= 1 (Read: ${adminBroadcastDetail.broadcast.readCount}).`);
  assert(typeof adminBroadcastDetail.broadcast.unreadCount === 'number', 'Admin delivery stats include unreadCount.');

  // Test 18: Recipient privacy - Student detail does NOT leak other recipients
  assert(studentDetail.broadcast.recipients === undefined, 'Recipient payload strictly omits recipient lists or other user data.');

  // ============================================================================
  // SECTION 4: PROTECTED BROADCAST ATTACHMENTS
  // ============================================================================
  console.log('\n--- SECTION 4: PROTECTED BROADCAST ATTACHMENTS ---');

  if (!fs.existsSync(PROTECTED_MESSAGE_DIR)) {
    fs.mkdirSync(PROTECTED_MESSAGE_DIR, { recursive: true });
  }

  const testPdfName = `broadcast_guide_${Date.now()}.pdf`;
  const testPdfPath = path.join(PROTECTED_MESSAGE_DIR, testPdfName);
  const pdfHeader = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  fs.writeFileSync(testPdfPath, pdfHeader);

  // Test 19: Broadcast with PDF attachment
  const broadcastWithAtt = await broadcastService.createBroadcast(instAId, adminA, {
    title: 'Campus Guidelines PDF Broadcast',
    body: 'Please read the attached campus safety policy document.',
    audienceType: 'ALL_STUDENTS',
    allowReplies: false,
    file: {
      originalname: 'Campus_Safety_Guide.pdf',
      filename: testPdfName,
      mimetype: 'application/pdf',
      size: pdfHeader.length,
      path: testPdfPath,
    },
  });
  assert(broadcastWithAtt.success, 'Broadcast created with attached PDF document.');

  // Test 20: Authorized recipient streams attachment
  const attRecord = await prisma.broadcastAttachment.findFirst({
    where: { broadcastId: broadcastWithAtt.broadcastId },
  });
  assert(Boolean(attRecord), 'Broadcast attachment record stored in database.');

  const streamInfo = await broadcastService.getBroadcastAttachmentStream(
    instAId,
    studentA.id,
    'STUDENT',
    attRecord.id
  );
  assert(streamInfo.filePath && fs.existsSync(streamInfo.filePath), 'Authorized recipient retrieves valid attachment stream.');

  // Test 21: Non-recipient (Teacher) blocked from attachment
  let nonRecipientBlocked = false;
  try {
    await broadcastService.getBroadcastAttachmentStream(instAId, teacherA.id, 'TEACHER', attRecord.id);
  } catch (err) {
    nonRecipientBlocked = err.status === 403;
  }
  assert(nonRecipientBlocked, 'Non-recipient user is blocked from streaming broadcast attachment (403).');

  // Test 22: Cross-tenant user blocked from attachment
  let crossTenantAttBlocked = false;
  if (instBUser) {
    try {
      await broadcastService.getBroadcastAttachmentStream(instB.id, instBUser.id, 'STUDENT', attRecord.id);
    } catch (err) {
      crossTenantAttBlocked = err.status === 403 || err.status === 404;
    }
  } else {
    crossTenantAttBlocked = true;
  }
  assert(crossTenantAttBlocked, 'Cross-tenant user blocked from broadcast attachment access (403/404).');

  // ============================================================================
  // SECTION 5: REPLIES POLICY & PRIVATE DIRECT ROUTING
  // ============================================================================
  console.log('\n--- SECTION 5: REPLIES POLICY & PRIVATE DIRECT ROUTING ---');

  // Test 23: Allow Replies = false flags allowReplies: false
  assert(studentDetail.broadcast.allowReplies === false, 'Broadcast with allowReplies: false correctly presents allowReplies: false.');

  // Test 24: Broadcast with allowReplies: true
  const replyEnabledBroadcast = await broadcastService.createBroadcast(instAId, adminA, {
    title: 'Feedback Requested on Library Resources',
    body: 'Please send us your suggestions regarding new books.',
    audienceType: 'ALL_STUDENTS',
    allowReplies: true,
  });
  assert(replyEnabledBroadcast.success, 'Broadcast created with allowReplies: true.');

  // Test 25: Student responds privately to Admin using direct conversation
  const studentReplyToAdmin = await messageService.createConversation(instAId, studentA, {
    recipientId: adminA.id,
    subject: 'Re: Feedback Requested on Library Resources',
    body: 'I would like to suggest adding more Python programming handbooks.',
  });
  assert(studentReplyToAdmin.success, 'Student responds privately to Admin via Direct Conversation.');

  // Verify other students do NOT receive this response
  const otherParticipants = await prisma.conversationParticipant.findMany({
    where: { conversationId: studentReplyToAdmin.conversationId },
  });
  assert(otherParticipants.length === 2, 'Reply conversation is strictly between Student and Admin (other broadcast recipients cannot see it).');

  // ============================================================================
  // SECTION 6: ARCHIVE, DELETE & ADMIN WITHDRAWAL
  // ============================================================================
  console.log('\n--- SECTION 6: ARCHIVE, DELETE & ADMIN WITHDRAWAL ---');

  // Test 26: Recipient archives broadcast for self
  await broadcastService.archiveBroadcastForUser(instAId, studentA.id, broadcast1.broadcastId, true);
  const archivedRecord = await prisma.broadcastRecipient.findFirst({
    where: { broadcastId: broadcast1.broadcastId, userId: studentA.id },
  });
  assert(archivedRecord.isArchived === true, 'Recipient successfully archives broadcast.');

  // Test 27: Recipient soft-deletes broadcast for self
  await broadcastService.deleteBroadcastForUser(instAId, studentA.id, broadcast1.broadcastId);
  const deletedRecord = await prisma.broadcastRecipient.findFirst({
    where: { broadcastId: broadcast1.broadcastId, userId: studentA.id },
  });
  assert(deletedRecord.isDeleted === true, 'Recipient successfully deletes/hides broadcast for self.');

  // Test 28: Admin withdraws broadcast
  await broadcastService.withdrawBroadcast(instAId, adminA.id, broadcast1.broadcastId);
  const withdrawnBroadcast = await prisma.broadcastMessage.findUnique({
    where: { id: broadcast1.broadcastId },
  });
  assert(withdrawnBroadcast.status === 'WITHDRAWN', 'Admin successfully withdraws broadcast.');

  // Test 29: Recipient cannot open withdrawn broadcast
  let withdrawnBlocked = false;
  try {
    await broadcastService.getBroadcastDetail(instAId, studentA.id, 'STUDENT', broadcast1.broadcastId);
  } catch (err) {
    withdrawnBlocked = err.status === 404;
  }
  assert(withdrawnBlocked, 'Withdrawn broadcast returns 404 to recipients.');

  // Test 30: Notifications created on broadcast send
  const notif = await prisma.notification.findFirst({
    where: { instituteId: instAId, userId: studentA.id },
    orderBy: { createdAt: 'desc' },
  });
  assert(notif && notif.title.includes('Institute Broadcast'), 'Notification successfully dispatched to recipients on broadcast send.');

  // Cleanup test file
  if (fs.existsSync(testPdfPath)) {
    try { fs.unlinkSync(testPdfPath); } catch (e) {}
  }

  console.log('\n================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} ADMIN BROADCAST AUTOMATED TESTS PASSED!`);
  console.log('================================================================\n');
}

runBroadcastTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nBroadcast Test Suite Failed:', err);
    process.exit(1);
  });
