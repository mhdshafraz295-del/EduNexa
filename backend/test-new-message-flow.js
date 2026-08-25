import prisma from './src/config/prisma.js';
import * as messageService from './src/services/message.service.js';
import * as relationshipService from './src/services/messageRelationship.service.js';

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

async function runNewMessageFlowVerification() {
  console.log('\n================================================================');
  console.log('  EDUNEXA: NEW DIRECT MESSAGE FLOW & RELATIONSHIP VERIFICATION');
  console.log('================================================================\n');

  const timeKey = Date.now();

  // 1. Create Institute A & Institute B
  const instA = await prisma.institute.create({
    data: {
      name: `Msg Flow Campus A ${timeKey}`,
      slug: `msg-campus-a-${timeKey}`,
      code: `MA${timeKey.toString().slice(-4)}`,
      email: `adminA_${timeKey}@test.com`,
      isActive: true,
    },
  });

  const instB = await prisma.institute.create({
    data: {
      name: `Msg Flow Campus B ${timeKey}`,
      slug: `msg-campus-b-${timeKey}`,
      code: `MB${timeKey.toString().slice(-4)}`,
      email: `adminB_${timeKey}@test.com`,
      isActive: true,
    },
  });

  // Admin A
  const adminA = await prisma.user.create({
    data: {
      username: `admin_a_${timeKey}`,
      email: `admin_a_${timeKey}@test.com`,
      passwordHash: 'dummy',
      role: 'ADMIN',
      instituteId: instA.id,
      isActive: true,
    },
  });

  // Admin B (Cross-tenant)
  const adminB = await prisma.user.create({
    data: {
      username: `admin_b_${timeKey}`,
      email: `admin_b_${timeKey}@test.com`,
      passwordHash: 'dummy',
      role: 'ADMIN',
      instituteId: instB.id,
      isActive: true,
    },
  });

  // Class 10-A in Institute A
  const class10A = await prisma.class.create({
    data: {
      name: 'Grade 10',
      section: 'A',
      instituteId: instA.id,
    },
  });

  // Teacher 1 in Institute A
  const teacherUser1 = await prisma.user.create({
    data: {
      username: `teacher1_${timeKey}`,
      email: `teacher1_${timeKey}@test.com`,
      passwordHash: 'dummy',
      role: 'TEACHER',
      instituteId: instA.id,
      isActive: true,
    },
  });
  const teacher1 = await prisma.teacher.create({
    data: {
      userId: teacherUser1.id,
      instituteId: instA.id,
      name: 'Prof. Albert Einstein',
      employeeId: `T${timeKey.toString().slice(-4)}`,
    },
  });

  // Assign Teacher 1 to Class 10-A
  await prisma.class.update({
    where: { id: class10A.id },
    data: { classTeacherId: teacher1.id },
  });

  // Student 1 in Class 10-A
  const studentUser1 = await prisma.user.create({
    data: {
      username: `student1_${timeKey}`,
      email: `student1_${timeKey}@test.com`,
      passwordHash: 'dummy',
      role: 'STUDENT',
      instituteId: instA.id,
      isActive: true,
    },
  });
  const student1 = await prisma.student.create({
    data: {
      userId: studentUser1.id,
      instituteId: instA.id,
      classId: class10A.id,
      name: 'Isaac Newton',
      admissionNumber: `STU${timeKey.toString().slice(-4)}`,
    },
  });

  // Parent 1 linked to Student 1
  const parentUser1 = await prisma.user.create({
    data: {
      username: `parent1_${timeKey}`,
      email: `parent1_${timeKey}@test.com`,
      passwordHash: 'dummy',
      role: 'PARENT',
      instituteId: instA.id,
      isActive: true,
    },
  });
  const parent1 = await prisma.parent.create({
    data: {
      userId: parentUser1.id,
      instituteId: instA.id,
      name: 'Hannah Newton',
    },
  });
  await prisma.parentStudent.create({
    data: {
      parentId: parent1.id,
      studentId: student1.id,
      relationship: 'Mother',
    },
  });

  // ============================================================================
  // SECTION 1: RECIPIENT DIRECTORY & RELATIONSHIP MATRIX
  // ============================================================================
  console.log('--- SECTION 1: RECIPIENT DIRECTORY MATRIX ---');

  // Test 1: Admin A recipient directory returns teachers, students, parents
  const adminRecipients = await relationshipService.getAllowedRecipients(instA.id, adminA, { limit: 50 });
  assert(
    adminRecipients.recipients.some((r) => r.id === teacherUser1.id) &&
    adminRecipients.recipients.some((r) => r.id === studentUser1.id) &&
    adminRecipients.recipients.some((r) => r.id === parentUser1.id),
    'Admin A receives full same-tenant directory (Teachers, Students, Parents).'
  );

  // Test 2: Cross-tenant recipient (Admin B) is strictly absent from Admin A's directory
  assert(
    !adminRecipients.recipients.some((r) => r.id === adminB.id),
    'Cross-tenant user Admin B is strictly absent from Admin A directory.'
  );

  // Test 3: Teacher 1 recipient directory returns assigned Student 1 and Parent 1
  const teacherRecipients = await relationshipService.getAllowedRecipients(instA.id, teacherUser1, { limit: 50 });
  assert(
    teacherRecipients.recipients.some((r) => r.id === adminA.id) &&
    teacherRecipients.recipients.some((r) => r.id === studentUser1.id) &&
    teacherRecipients.recipients.some((r) => r.id === parentUser1.id),
    'Teacher 1 recipient directory includes Admin, assigned Student, and linked Parent.'
  );

  // Test 4: Student 1 directory includes assigned Teacher 1 and Admin A
  const studentRecipients = await relationshipService.getAllowedRecipients(instA.id, studentUser1, { limit: 50 });
  assert(
    studentRecipients.recipients.some((r) => r.id === teacherUser1.id) &&
    studentRecipients.recipients.some((r) => r.id === adminA.id),
    'Student 1 recipient directory includes assigned Teacher 1 and Admin.'
  );

  // Test 5: Parent 1 directory includes child Teacher 1 and Admin A
  const parentRecipients = await relationshipService.getAllowedRecipients(instA.id, parentUser1, { limit: 50 });
  assert(
    parentRecipients.recipients.some((r) => r.id === teacherUser1.id) &&
    parentRecipients.recipients.some((r) => r.id === adminA.id),
    'Parent 1 recipient directory includes linked child Teacher 1 and Admin.'
  );

  // ============================================================================
  // SECTION 2: NEW DIRECT CONVERSATION CREATION & ONE-MESSAGE RULE
  // ============================================================================
  console.log('\n--- SECTION 2: NEW MESSAGE CONVERSATION CREATION ---');

  // Test 6: Admin A sends New Message to Teacher 1
  const newMsgRes1 = await messageService.createConversation(instA.id, adminA, {
    recipientId: teacherUser1.id,
    subject: 'Welcome to Term 1',
    body: 'Hello Professor Einstein, please review your syllabus.',
  });
  assert(
    newMsgRes1.success && Boolean(newMsgRes1.conversationId) && !newMsgRes1.isReused,
    `New direct conversation created (ID: ${newMsgRes1.conversationId}).`
  );

  // Test 7: Verify exactly ONE message was created in the conversation
  const threadMessages1 = await prisma.message.findMany({
    where: { conversationId: newMsgRes1.conversationId },
  });
  assert(threadMessages1.length === 1, `Exactly ONE initial message created in new thread (Count: ${threadMessages1.length}).`);
  assert(threadMessages1[0].body === 'Hello Professor Einstein, please review your syllabus.', 'Message body matches input text.');

  // Test 8: Notification created for Teacher 1
  const notif1 = await prisma.notification.findFirst({
    where: { userId: teacherUser1.id, instituteId: instA.id },
    orderBy: { createdAt: 'desc' },
  });
  assert(Boolean(notif1), `Notification created for recipient Teacher 1 (Title: "${notif1?.title}")`);

  // ============================================================================
  // SECTION 3: DIRECT CONVERSATION REUSE (NO DUPLICATE THREADS)
  // ============================================================================
  console.log('\n--- SECTION 3: CONVERSATION REUSE & DEDUPLICATION ---');

  // Test 9: Admin A sends another New Message to same Teacher 1 -> must REUSE conversation
  const newMsgRes2 = await messageService.createConversation(instA.id, adminA, {
    recipientId: teacherUser1.id,
    body: 'Follow-up regarding the staff meeting.',
  });
  assert(
    newMsgRes2.success && newMsgRes2.conversationId === newMsgRes1.conversationId && newMsgRes2.isReused === true,
    `Existing conversation reused without creating duplicate thread (Reused ID: ${newMsgRes2.conversationId}).`
  );

  // Test 10: Verify total conversation count between this pair remains 1
  const pairConvs = await prisma.conversation.findMany({
    where: {
      instituteId: instA.id,
      type: 'DIRECT',
      AND: [
        { participants: { some: { userId: adminA.id } } },
        { participants: { some: { userId: teacherUser1.id } } },
      ],
    },
  });
  assert(pairConvs.length === 1, `Direct thread deduplication verified (Pair Thread Count: ${pairConvs.length}).`);

  // Test 11: Total messages in reused thread is now 2
  const threadMessages2 = await prisma.message.findMany({
    where: { conversationId: newMsgRes1.conversationId },
  });
  assert(threadMessages2.length === 2, `Thread has exactly 2 messages after append (Count: ${threadMessages2.length}).`);

  // ============================================================================
  // SECTION 4: SOFT-DELETE & ARCHIVE RESTORATION
  // ============================================================================
  console.log('\n--- SECTION 4: SOFT-DELETE & ARCHIVE RESTORATION ---');

  // Soft-delete participant for Admin A
  await prisma.conversationParticipant.updateMany({
    where: { conversationId: newMsgRes1.conversationId, userId: adminA.id },
    data: { isDeleted: true },
  });

  // Test 12: Sending New Message restores visibility for sender
  const newMsgRes3 = await messageService.createConversation(instA.id, adminA, {
    recipientId: teacherUser1.id,
    body: 'Re-opening conversation after hiding.',
  });
  assert(newMsgRes3.conversationId === newMsgRes1.conversationId, 'Soft-deleted conversation reused cleanly.');

  const participantCheck = await prisma.conversationParticipant.findFirst({
    where: { conversationId: newMsgRes1.conversationId, userId: adminA.id },
  });
  assert(participantCheck && participantCheck.isDeleted === false, 'Sender participant visibility restored (isDeleted: false).');

  // ============================================================================
  // SECTION 5: VALIDATIONS & REJECTIONS
  // ============================================================================
  console.log('\n--- SECTION 5: VALIDATIONS & PERMISSION ENFORCEMENT ---');

  // Test 13: Empty message body rejected with HTTP 400
  let emptyRejected = false;
  try {
    await messageService.createConversation(instA.id, adminA, {
      recipientId: teacherUser1.id,
      body: '   ',
    });
  } catch (err) {
    emptyRejected = err.status === 400;
  }
  assert(emptyRejected, 'Whitespace-only message rejected with HTTP 400.');

  // Test 14: Cross-tenant messaging blocked with HTTP 403
  let crossTenantBlocked = false;
  try {
    await messageService.createConversation(instA.id, adminA, {
      recipientId: adminB.id,
      body: 'Cross-tenant message attempt',
    });
  } catch (err) {
    crossTenantBlocked = err.status === 403;
  }
  assert(crossTenantBlocked, 'Cross-tenant message attempt strictly blocked with HTTP 403.');

  // Test 15: Optional subject omitted succeeds
  const noSubjectRes = await messageService.createConversation(instA.id, teacherUser1, {
    recipientId: studentUser1.id,
    body: 'Your homework submission is approved.',
  });
  assert(noSubjectRes.success && Boolean(noSubjectRes.conversationId), 'Message sent successfully with optional subject omitted.');

  console.log('\n================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} NEW MESSAGE FLOW TESTS PASSED!`);
  console.log('================================================================\n');
}

await runNewMessageFlowVerification();
await prisma.$disconnect();
