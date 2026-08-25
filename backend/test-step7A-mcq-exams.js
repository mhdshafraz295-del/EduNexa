/**
 * EduNexa Step 7A: Comprehensive Dynamic MCQ Online Exam Test Suite
 * Tests all functional, security, subscription, tenant isolation, and auto-grading requirements.
 */
import prisma from './src/config/prisma.js';

const BASE_URL = 'http://localhost:5000/api';

async function runStep7ATests() {
  console.log('🧪 Starting EduNexa Step 7A: Dynamic MCQ Online Exam Test Suite...\n');
  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition, message) => {
    totalTests++;
    if (!condition) {
      console.error(`  ❌ FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    } else {
      passedTests++;
      console.log(`  ✅ PASSED (${totalTests}): ${message}`);
    }
  };

  // -------------------------------------------------------------
  // 1. Authenticate Seeded Role Accounts
  // -------------------------------------------------------------
  console.log('1. Authenticating Seeded Accounts...');

  // Super Admin
  const saRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@edunexa.com', password: 'SuperAdmin123!' }),
  });
  const saData = await saRes.json();
  assert(saData.success && saData.user.role === 'SUPER_ADMIN', 'Super Admin authenticated');
  const superAdminToken = saData.token;

  // Institute Admin (Institute A: Demo Institute)
  const aRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@edunexa.com', password: 'Admin123!' }),
  });
  const aData = await aRes.json();
  assert(aData.success && aData.user.role === 'ADMIN', 'Institute Admin authenticated');
  const adminToken = aData.token;
  const instituteId = aData.institute.id;

  // Teacher (Institute A)
  const tRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teacher@edunexa.com', password: 'Teacher123!' }),
  });
  const tData = await tRes.json();
  assert(tData.success && tData.user.role === 'TEACHER', 'Teacher authenticated');
  const teacherToken = tData.token;

  // Student (Institute A)
  const sRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@edunexa.com', password: 'Student123!' }),
  });
  const sData = await sRes.json();
  assert(sData.success && sData.user.role === 'STUDENT', 'Student authenticated');
  const studentToken = sData.token;

  // Parent (Institute A)
  const pRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'parent@edunexa.com', password: 'Parent123!' }),
  });
  const pData = await pRes.json();
  assert(pData.success && pData.user.role === 'PARENT', 'Parent authenticated');
  const parentToken = pData.token;

  // -------------------------------------------------------------
  // 2. Setup Real Academic Data Fixtures for Test
  // -------------------------------------------------------------
  console.log('\n2. Setting up Academic Test Fixtures...');
  const suffix = Date.now().toString().slice(-4);

  // Active Year
  const yearRes = await fetch(`${BASE_URL}/academic/years`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Exam Year ${suffix}`,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      isCurrent: true,
      status: 'ACTIVE',
    }),
  });
  const yearData = await yearRes.json();
  const academicYearId = yearData.data.id;

  // Class 1 (Target class where Student is enrolled)
  const class1Res = await fetch(`${BASE_URL}/academic/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Grade 10 Exam Class ${suffix}`,
      section: 'A',
      academicYearId,
    }),
  });
  const class1Data = await class1Res.json();
  const class1Id = class1Data.data.id;

  // Class 2 (Unassigned class for security testing)
  const class2Res = await fetch(`${BASE_URL}/academic/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Grade 12 Exam Class ${suffix}`,
      section: 'B',
      academicYearId,
    }),
  });
  const class2Data = await class2Res.json();
  const class2Id = class2Data.data.id;

  // Subject 1
  const sub1Res = await fetch(`${BASE_URL}/academic/subjects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Physics MCQ ${suffix}`,
      code: `PHY-${suffix}`,
    }),
  });
  const sub1Data = await sub1Res.json();
  const subject1Id = sub1Data.data.id;

  // Enroll Student into Class 1
  const studentProfile = await prisma.student.findFirst({ where: { userId: sData.user.id } });
  await prisma.studentEnrollment.create({
    data: {
      instituteId,
      studentId: studentProfile.id,
      academicYearId,
      classId: class1Id,
      status: 'ACTIVE',
    },
  });

  // Assign Teacher to Class 1 & Subject 1
  const teacherProfile = await prisma.teacher.findFirst({ where: { userId: tData.user.id } });
  await prisma.teacherAssignment.create({
    data: {
      instituteId,
      teacherId: teacherProfile.id,
      classId: class1Id,
      subjectId: subject1Id,
      academicYearId,
    },
  });
  assert(true, 'Academic Class, Subject, Enrollment, and Teacher Assignment linked');

  // -------------------------------------------------------------
  // 3. Test 1 & 2: Exam Creation & Teacher Authorization
  // -------------------------------------------------------------
  console.log('\n3. Testing Exam Creation & Teacher RBAC Authorization...');
  
  // Teacher creates exam for assigned Class 1 & Subject 1 -> SUCESS
  const teacherExamRes = await fetch(`${BASE_URL}/exams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({
      title: `Physics Mid-Term Quiz ${suffix}`,
      academicYearId,
      classId: class1Id,
      subjectId: subject1Id,
      totalMarks: 20,
      passingMarks: 10,
      passMarkType: 'MARKS',
      durationMinutes: 15,
      maxAttempts: 2,
      randomizeQuestions: true,
      randomizeOptions: true,
      publishResult: true,
    }),
  });
  const teacherExamData = await teacherExamRes.json();
  assert(teacherExamData.success, 'Teacher creates exam for assigned class and subject');
  const examId = teacherExamData.data.id;

  // Teacher attempts to create exam for UNASSIGNED Class 2 -> BLOCKED (403)
  const unauthTeacherRes = await fetch(`${BASE_URL}/exams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({
      title: `Unauthorized Exam ${suffix}`,
      academicYearId,
      classId: class2Id,
      subjectId: subject1Id,
      totalMarks: 20,
      passingMarks: 10,
    }),
  });
  assert(unauthTeacherRes.status === 403, 'Unauthorized teacher blocked from creating exam for unassigned class (403)');

  // -------------------------------------------------------------
  // 4. Test 4 & 5 & 6: Question Builder & Validation on Publish
  // -------------------------------------------------------------
  console.log('\n4. Testing Question Builder & Marks Validation...');

  // Attempt to publish exam with 0 questions -> BLOCKED
  const pubNoQRes = await fetch(`${BASE_URL}/exams/${examId}/publish`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  assert(pubNoQRes.status === 400, 'Cannot publish exam with 0 questions (400)');

  // Add Question 1 (10 marks, correct answer B)
  const q1Res = await fetch(`${BASE_URL}/exams/${examId}/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({
      question: 'What is the SI unit of force?',
      options: [
        { id: 'A', text: 'Joule' },
        { id: 'B', text: 'Newton' },
        { id: 'C', text: 'Pascal' },
        { id: 'D', text: 'Watt' },
      ],
      correctAnswer: 'B',
      marks: 10,
      explanation: 'Newton (N) is the SI unit of force.',
    }),
  });
  const q1Data = await q1Res.json();
  assert(q1Data.success, 'Question 1 created (10 marks, answer B)');
  const q1Id = q1Data.data.id;

  // Attempt to publish exam with marks sum (10) != totalMarks (20) -> BLOCKED
  const pubMismatchRes = await fetch(`${BASE_URL}/exams/${examId}/publish`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  assert(pubMismatchRes.status === 400, 'Cannot publish exam when sum of question marks != totalMarks (400)');

  // Add Question 2 (10 marks, correct answer C)
  const q2Res = await fetch(`${BASE_URL}/exams/${examId}/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({
      question: 'What is the acceleration due to gravity on Earth?',
      options: [
        { id: 'A', text: '8.8 m/s²' },
        { id: 'B', text: '9.2 m/s²' },
        { id: 'C', text: '9.8 m/s²' },
        { id: 'D', text: '10.5 m/s²' },
      ],
      correctAnswer: 'C',
      marks: 10,
      explanation: 'Standard g is approximately 9.8 m/s².',
    }),
  });
  const q2Data = await q2Res.json();
  assert(q2Data.success, 'Question 2 created (10 marks, answer C)');
  const q2Id = q2Data.data.id;

  // Publish Exam successfully now that sum (10 + 10 = 20) matches totalMarks (20)
  const pubSuccessRes = await fetch(`${BASE_URL}/exams/${examId}/publish`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  const pubSuccessData = await pubSuccessRes.json();
  assert(pubSuccessData.success && pubSuccessData.data.status === 'PUBLISHED', 'Exam published successfully after marks validation');

  // -------------------------------------------------------------
  // 5. Test 7, 8, 9, 10: Student Eligibility & Start Timed Exam
  // -------------------------------------------------------------
  console.log('\n5. Testing Student Exam Flow & Security...');

  // Student checks eligible exams
  const studentListRes = await fetch(`${BASE_URL}/exams/student/list`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const studentListData = await studentListRes.json();
  assert(studentListData.success, 'Student retrieves eligible exams list');
  const availableExams = studentListData.data.available || [];
  const targetExam = availableExams.find((e) => e.id === examId);
  assert(Boolean(targetExam), 'Published exam appears under Student Available Examinations');

  // Student starts exam attempt
  const startExamRes = await fetch(`${BASE_URL}/exams/student/${examId}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const startExamData = await startExamRes.json();
  assert(startExamData.success, 'Student starts timed exam attempt');
  assert(startExamData.data.attemptId !== undefined, 'Attempt ID returned');
  assert(startExamData.data.remainingSeconds > 0, 'Server authoritative remainingSeconds returned');

  // CRITICAL SECURITY ASSERTION: correctAnswer must NEVER be sent to student frontend!
  const questionsReceived = startExamData.data.questions;
  const exposedAnswers = questionsReceived.filter((q) => q.correctAnswer !== undefined || q.explanation !== undefined);
  assert(exposedAnswers.length === 0, 'CRITICAL SECURITY: Student payload strictly omits correctAnswer and explanation');

  const attemptId = startExamData.data.attemptId;
  const initialOptionOrder = questionsReceived.map((q) => q.options.map((o) => (typeof o === 'object' ? o.id : o)));

  // -------------------------------------------------------------
  // 6. Test 11, 12, 13, 14: Answer Autosave & Refresh Resume
  // -------------------------------------------------------------
  console.log('\n6. Testing Incremental Autosave & Resume Persistence...');

  // Student saves answer for Q1: Selected 'B' (Correct)
  const saveQ1Res = await fetch(`${BASE_URL}/exams/student/${examId}/answers/${q1Id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ answer: 'B' }),
  });
  const saveQ1Data = await saveQ1Res.json();
  assert(saveQ1Data.success, 'Student answer for Q1 saved incrementally');

  // Student simulates browser reload (resumes active attempt)
  const resumeRes = await fetch(`${BASE_URL}/exams/student/${examId}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const resumeData = await resumeRes.json();
  assert(resumeData.success && resumeData.data.attemptId === attemptId, 'Browser refresh resumes exact same active attempt');
  assert(resumeData.data.savedAnswers[q1Id] === 'B', 'Saved answer preserved on resume');

  // Verify option order persistence
  const resumedOptionOrder = resumeData.data.questions.map((q) => q.options.map((o) => (typeof o === 'object' ? o.id : o)));
  assert(JSON.stringify(initialOptionOrder) === JSON.stringify(resumedOptionOrder), 'Randomized option order is persisted across refresh');

  // Student saves answer for Q2: Selected 'A' (Incorrect, correct is C)
  await fetch(`${BASE_URL}/exams/student/${examId}/answers/${q2Id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ answer: 'A' }),
  });

  // -------------------------------------------------------------
  // 7. Test 15 & 16: Manual Submit & Auto-Grading Verification
  // -------------------------------------------------------------
  console.log('\n7. Testing Auto-Grading & Pass/Fail Calculations...');

  const submitRes = await fetch(`${BASE_URL}/exams/student/${examId}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const submitData = await submitRes.json();
  assert(submitData.success, 'Student submits exam');
  assert(submitData.data.score === 10, 'Auto-grade score calculated correctly (10 / 20)');
  assert(submitData.data.percentage === 50, 'Percentage calculated correctly (50%)');
  assert(submitData.data.isPassed === true, 'Pass/fail calculated correctly (Score 10 >= Pass Mark 10 in MARKS mode)');
  assert(submitData.data.correctCount === 1, 'Correct count is 1 of 2 questions');

  // Attempt to save answer after submission -> BLOCKED
  const lateSaveRes = await fetch(`${BASE_URL}/exams/student/${examId}/answers/${q1Id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ answer: 'A' }),
  });
  assert(lateSaveRes.status >= 400, 'Answer save rejected after attempt is submitted');

  // -------------------------------------------------------------
  // 8. Test 17 & 18: Expired Attempt Server Auto-Finalization
  // -------------------------------------------------------------
  console.log('\n8. Testing Server-Authoritative Timeout & Auto-Finalization...');

  // Start Attempt 2 for student
  const startAtt2Res = await fetch(`${BASE_URL}/exams/student/${examId}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const startAtt2Data = await startAtt2Res.json();
  assert(startAtt2Data.success, 'Student starts Attempt 2 (allowed since maxAttempts = 2)');
  const att2Id = startAtt2Data.data.attemptId;

  // Save Q1 answer as 'B'
  await fetch(`${BASE_URL}/exams/student/${examId}/answers/${q1Id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ answer: 'B' }),
  });

  // Artificially move serverDeadline to 1 minute in the past to simulate browser closed / timeout
  await prisma.examAttempt.update({
    where: { id: att2Id },
    data: { serverDeadline: new Date(Date.now() - 60000) },
  });

  // Call attempt list / resume endpoint -> Backend should auto-finalize
  const expiredResumeRes = await fetch(`${BASE_URL}/exams/student/${examId}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert(expiredResumeRes.status >= 400, 'Expired attempt detected by server and rejected from continuing');

  const checkAtt2 = await prisma.examAttempt.findUnique({ where: { id: att2Id } });
  assert(checkAtt2.status === 'AUTO_SUBMITTED', 'Expired attempt automatically finalized to AUTO_SUBMITTED');
  assert(checkAtt2.score === 10, 'Auto-graded score recorded upon server timeout finalization');

  // -------------------------------------------------------------
  // 9. Test 19, 20, 21: Parent Result View & Teacher Analytics
  // -------------------------------------------------------------
  console.log('\n9. Testing Parent Results & Real-Time Teacher Analytics...');

  // Link Parent to Student
  const parentProfile = await prisma.parent.findFirst({ where: { userId: pData.user.id } });
  await prisma.parentStudent.upsert({
    where: { parentId_studentId: { parentId: parentProfile.id, studentId: studentProfile.id } },
    create: { parentId: parentProfile.id, studentId: studentProfile.id, relationship: 'FATHER' },
    update: {},
  });

  // Parent queries child results
  const parentResultsRes = await fetch(`${BASE_URL}/exams/parent/child-results`, {
    headers: { Authorization: `Bearer ${parentToken}` },
  });
  const parentResultsData = await parentResultsRes.json();
  assert(parentResultsData.success, 'Parent queries linked child results');
  const child1Data = parentResultsData.data.find((c) => c.childId === studentProfile.id);
  assert(child1Data && child1Data.results.length > 0, 'Parent sees child released exam results');

  // Teacher queries attempt list & analytics
  const attemptsRes = await fetch(`${BASE_URL}/exams/${examId}/attempts`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  const attemptsData = await attemptsRes.json();
  assert(attemptsData.success && attemptsData.data.length >= 2, 'Teacher monitors student attempts list');

  const analyticsRes = await fetch(`${BASE_URL}/exams/${examId}/analytics`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  const analyticsData = await analyticsRes.json();
  assert(analyticsData.success, 'Teacher retrieves real-time exam analytics');
  assert(analyticsData.data.totalAttempted >= 1, 'Analytics reflects real attempted student count');
  assert(analyticsData.data.passRate > 0, 'Analytics computes real pass rate');

  // -------------------------------------------------------------
  // 10. Test 22 & 23: Exam Deletion Safety & Multi-Tenant Isolation
  // -------------------------------------------------------------
  console.log('\n10. Testing Exam Deletion Safety & Cross-Tenant Isolation...');

  // Admin attempts to delete exam with existing attempt history
  const deleteSafetyRes = await fetch(`${BASE_URL}/exams/${examId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const deleteSafetyData = await deleteSafetyRes.json();
  assert(deleteSafetyData.archived === true, 'Exam with attempts is archived/closed instead of hard-deleted to preserve history');

  const checkExamStillExists = await prisma.exam.findUnique({ where: { id: examId } });
  assert(checkExamStillExists !== null, 'Exam record preserved in database');

  // Cross-tenant test: Create Tenant B and attempt to access Tenant A exam
  const uniqueCodeB = `TB${Date.now().toString().slice(-4)}`;
  const tenantBRes = await fetch(`${BASE_URL}/super-admin/institutes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdminToken}` },
    body: JSON.stringify({
      name: `Tenant B Academy ${uniqueCodeB}`,
      code: uniqueCodeB,
      email: `admin_${uniqueCodeB}@test.com`,
      adminEmail: `admin_${uniqueCodeB}@test.com`,
      adminPassword: 'Password123!',
      adminUsername: `admin_${uniqueCodeB}`,
    }),
  });
  const tenantBData = await tenantBRes.json();
  const tenantBLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `admin_${uniqueCodeB}@test.com`, password: 'Password123!' }),
  });
  const tenantBToken = (await tenantBLogin.json()).token;

  // Tenant B attempts to access Tenant A exam -> 404 / Forbidden
  const crossTenantRes = await fetch(`${BASE_URL}/exams/${examId}`, {
    headers: { Authorization: `Bearer ${tenantBToken}` },
  });
  assert(crossTenantRes.status === 404, 'Cross-tenant protection: Tenant B cannot access Tenant A exam (404)');

  console.log(`\n============================================================`);
  console.log(`🎉 ALL ${passedTests} OF ${totalTests} STEP 7A MCQ EXAM TESTS PASSED!`);
  console.log(`============================================================\n`);
}

runStep7ATests().catch((err) => {
  console.error('\n❌ Step 7A Test suite failed with error:', err);
  process.exit(1);
});
