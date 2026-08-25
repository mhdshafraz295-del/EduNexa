/**
 * Test Suite: Live Exam Step 1 - Admin Create, Schedule & Publish Live Exam
 */
import prisma from 'file:///c:/xampp/htdocs/online_education_management_system/backend/src/config/prisma.js';

const BASE_URL = 'http://localhost:5000/api';

async function runLiveExamCreateTests() {
  console.log('🧪 Starting EduNexa Live Exam Step 1 Test Suite...\n');
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

  // 1. Authenticate Seeded Test Accounts
  console.log('1. Authenticating Seeded Test Accounts...');
  const aLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@edunexa.com', password: 'Admin123!' }),
  });
  const aData = await aLogin.json();
  assert(aData.success && aData.user.role === 'ADMIN', 'Institute A Admin authenticated');
  const adminTokenA = aData.token;

  const tLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teacher@edunexa.com', password: 'Teacher123!' }),
  });
  const tData = await tLogin.json();
  assert(tData.success && tData.user.role === 'TEACHER', 'Teacher authenticated');
  const teacherToken = tData.token;

  const sLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@edunexa.com', password: 'Student123!' }),
  });
  const sData = await sLogin.json();
  assert(sData.success && sData.user.role === 'STUDENT', 'Student authenticated');
  const studentToken = sData.token;

  const pLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'parent@edunexa.com', password: 'Parent123!' }),
  });
  const pData = await pLogin.json();
  assert(pData.success && pData.user.role === 'PARENT', 'Parent authenticated');
  const parentToken = pData.token;

  // Super Admin for creating second tenant for isolation testing
  const saLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@edunexa.com', password: 'SuperAdmin123!' }),
  });
  const superAdminToken = (await saLogin.json()).token;

  const codeB = `TB${Date.now().toString().slice(-4)}`;
  await fetch(`${BASE_URL}/super-admin/institutes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdminToken}` },
    body: JSON.stringify({
      name: `Academy ${codeB}`,
      code: codeB,
      email: `admin_${codeB}@test.com`,
      adminEmail: `admin_${codeB}@test.com`,
      adminPassword: 'Password123!',
      adminUsername: `admin_${codeB}`,
    }),
  });

  const bLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `admin_${codeB}@test.com`, password: 'Password123!' }),
  });
  const adminTokenB = (await bLogin.json()).token;
  assert(Boolean(adminTokenB), 'Institute B Admin authenticated for isolation testing');

  // 2. Fetch Foundation Data
  console.log('\n2. Verifying Tenant-Scoped Academic Foundation...');
  const yearsRes = await fetch(`${BASE_URL}/academic/years`, {
    headers: { Authorization: `Bearer ${adminTokenA}` },
  });
  const yearsData = await yearsRes.json();
  assert(yearsData.success && yearsData.data.length > 0, 'Academic Years fetched for Institute A');
  const academicYearId = yearsData.data[0].id;

  const classesRes = await fetch(`${BASE_URL}/academic/classes`, {
    headers: { Authorization: `Bearer ${adminTokenA}` },
  });
  const classesData = await classesRes.json();
  assert(classesData.success && classesData.data.length > 0, 'Classes fetched for Institute A');
  const testClass = classesData.data[0];

  const subjectsRes = await fetch(`${BASE_URL}/academic/subjects`, {
    headers: { Authorization: `Bearer ${adminTokenA}` },
  });
  const subjectsData = await subjectsRes.json();
  assert(subjectsData.success && subjectsData.data.length > 0, 'Subjects fetched for Institute A');
  const testSubject = subjectsData.data[0];

  // Map Subject to Class if needed
  await fetch(`${BASE_URL}/academic/classes/${testClass.id}/subjects`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminTokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subjectIds: [testSubject.id] }),
  });

  // 3. Validation Tests: Invalid Schedule & Marks
  console.log('\n3. Testing Schedule & Marks Validation...');
  const badMarksRes = await fetch(`${BASE_URL}/exams`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminTokenA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Invalid Marks Exam',
      academicYearId,
      classId: testClass.id,
      subjectId: testSubject.id,
      totalMarks: 50,
      passingMarks: 60,
      passMarkType: 'MARKS',
    }),
  });
  assert(badMarksRes.status === 400, 'Pass marks exceeding total marks rejected (400)');

  const badSchedRes = await fetch(`${BASE_URL}/exams`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminTokenA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Invalid Schedule Exam',
      academicYearId,
      classId: testClass.id,
      subjectId: testSubject.id,
      totalMarks: 100,
      passingMarks: 40,
      startDateTime: '2026-10-15T12:00:00.000Z',
      endDateTime: '2026-10-15T11:00:00.000Z',
    }),
  });
  assert(badSchedRes.status === 400, 'Schedule where end is before start rejected (400)');

  const badDurRes = await fetch(`${BASE_URL}/exams`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminTokenA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Invalid Duration Exam',
      academicYearId,
      classId: testClass.id,
      subjectId: testSubject.id,
      totalMarks: 100,
      passingMarks: 40,
      startDateTime: '2026-10-15T10:00:00.000Z',
      endDateTime: '2026-10-15T10:30:00.000Z',
      durationMinutes: 60,
    }),
  });
  assert(badDurRes.status === 400, 'Duration exceeding schedule window rejected (400)');

  // 4. Create MCQ Exam Draft
  console.log('\n4. Testing Create MCQ Live Exam as DRAFT...');
  const createDraftRes = await fetch(`${BASE_URL}/exams`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminTokenA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Term 1 Mathematics Live Assessment',
      description: 'Official live timed multiple choice examination.',
      instructions: 'Choose the best answer. Time is monitored.',
      academicYearId,
      classId: testClass.id,
      subjectId: testSubject.id,
      examType: 'MCQ',
      totalMarks: 100,
      passingMarks: 40,
      passMarkType: 'MARKS',
      startDateTime: new Date(Date.now() + 86400000).toISOString(),
      endDateTime: new Date(Date.now() + 93600000).toISOString(),
      durationMinutes: 60,
      status: 'DRAFT',
      questions: [
        {
          question: 'What is 15 * 4?',
          options: [
            { id: 'A', text: '60' },
            { id: 'B', text: '50' },
            { id: 'C', text: '45' },
            { id: 'D', text: '70' },
          ],
          correctAnswer: 'A',
          marks: 50,
        },
        {
          question: 'What is the square root of 144?',
          options: [
            { id: 'A', text: '10' },
            { id: 'B', text: '12' },
            { id: 'C', text: '14' },
            { id: 'D', text: '16' },
          ],
          correctAnswer: 'B',
          marks: 50,
        },
      ],
    }),
  });
  const draftData = await createDraftRes.json();
  assert(createDraftRes.status === 201 && draftData.success, 'MCQ Exam Draft created successfully');
  const mcqExamId = draftData.data.id;
  assert(draftData.data.status === 'DRAFT', 'Exam created with status DRAFT');
  assert(draftData.data.questions?.length === 2, 'Atomic creation saved 2 questions');

  // 5. Verify Student Cannot See Draft Exam
  console.log('\n5. Testing Student Visibility of DRAFT Exam...');
  const studentExamsRes = await fetch(`${BASE_URL}/exams/student/list`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const studentExamsData = await studentExamsRes.json();
  const allStudentExams = [
    ...(studentExamsData.data?.upcoming || []),
    ...(studentExamsData.data?.available || []),
    ...(studentExamsData.data?.completed || []),
  ];
  const foundDraft = allStudentExams.find((e) => e.id === mcqExamId);
  assert(!foundDraft, 'Draft exam is NOT visible to students');

  // 6. Test Publish Validations & Success
  console.log('\n6. Testing MCQ Exam Publishing Lifecycle...');
  const publishRes = await fetch(`${BASE_URL}/exams/${mcqExamId}/publish`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminTokenA}` },
  });
  const publishData = await publishRes.json();
  assert(publishRes.status === 200 && publishData.success, 'MCQ Exam published successfully');

  // 7. Dynamic Status Verification on Admin Side
  console.log('\n7. Testing Dynamic Status Calculation in Admin Exams List...');
  const getExamRes = await fetch(`${BASE_URL}/exams/${mcqExamId}`, {
    headers: { Authorization: `Bearer ${adminTokenA}` },
  });
  const getExamData = await getExamRes.json();
  assert(getExamData.data.dynamicStatus === 'UPCOMING', 'Future scheduled exam dynamicStatus is UPCOMING');

  // 8. Verify Eligible Student Sees Published Upcoming Exam
  console.log('\n8. Testing Student Upcoming Exam Visibility...');
  const studentUser = await prisma.user.findUnique({ where: { email: 'student@edunexa.com' } });
  const studentProf = await prisma.student.findFirst({ where: { userId: studentUser.id } });
  await prisma.studentEnrollment.upsert({
    where: {
      studentId_academicYearId_classId: {
        studentId: studentProf.id,
        academicYearId,
        classId: testClass.id,
      },
    },
    create: {
      instituteId: 1,
      studentId: studentProf.id,
      academicYearId,
      classId: testClass.id,
      status: 'ACTIVE',
      enrollmentDate: new Date(),
    },
    update: { status: 'ACTIVE' },
  });

  const studentUpcomingRes = await fetch(`${BASE_URL}/exams/student/list`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const studentUpcomingData = await studentUpcomingRes.json();
  const studentUpcomingFound = studentUpcomingData.data?.upcoming?.find((e) => e.id === mcqExamId);
  assert(Boolean(studentUpcomingFound), 'Eligible student sees published exam in upcoming schedule');

  // 9. Parent Read-Only Exam Visibility
  console.log('\n9. Testing Parent Read-Only Exam Schedule Visibility...');
  const parentExamsRes = await fetch(`${BASE_URL}/exams/parent/child-exams/${studentProf.id}`, {
    headers: { Authorization: `Bearer ${parentToken}` },
  });
  const parentExamsData = await parentExamsRes.json();
  const parentUpcomingFound = parentExamsData.data?.upcoming?.find((e) => e.id === mcqExamId);
  assert(Boolean(parentUpcomingFound), 'Linked parent sees published exam schedule for child');

  const parentStartRes = await fetch(`${BASE_URL}/exams/student/${mcqExamId}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${parentToken}` },
  });
  assert(parentStartRes.status === 403, 'Parent blocked from attempting exam (403)');

  // 10. Create & Publish Written Live Exam
  console.log('\n10. Testing Create & Publish Written Live Exam...');
  const createWrittenRes = await fetch(`${BASE_URL}/exams`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminTokenA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Physics Written Mid-Term Exam',
      description: 'Structured essay & descriptive problem solving assessment.',
      instructions: 'Write answers on sheets, take clear scan, and upload single PDF.',
      academicYearId,
      classId: testClass.id,
      subjectId: testSubject.id,
      examType: 'WRITTEN',
      totalMarks: 100,
      passingMarks: 50,
      passMarkType: 'MARKS',
      durationMinutes: 120,
      status: 'PUBLISHED',
    }),
  });
  const writtenData = await createWrittenRes.json();
  assert(createWrittenRes.status === 201 && writtenData.success, 'Written Live Exam created and published');
  assert(writtenData.data.examType === 'WRITTEN', 'Exam type is WRITTEN');
  assert(writtenData.data.status === 'PUBLISHED', 'Written exam published');

  // 11. Multi-Tenant Isolation Security
  console.log('\n11. Testing Multi-Tenant & Relational Security...');
  const crossTenantGet = await fetch(`${BASE_URL}/exams/${mcqExamId}`, {
    headers: { Authorization: `Bearer ${adminTokenB}` },
  });
  assert(crossTenantGet.status === 404 || crossTenantGet.status === 403, 'Institute B Admin cannot view Institute A exam (404/403)');

  const crossTenantUpdate = await fetch(`${BASE_URL}/exams/${mcqExamId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminTokenB}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Hacked Title' }),
  });
  assert(crossTenantUpdate.status === 404 || crossTenantUpdate.status === 403, 'Institute B Admin cannot update Institute A exam (404/403)');

  const crossClassRes = await fetch(`${BASE_URL}/exams`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminTokenB}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Cross Tenant Exam',
      classId: testClass.id,
      subjectId: testSubject.id,
      totalMarks: 100,
      passingMarks: 40,
    }),
  });
  assert(crossClassRes.status === 400 || crossClassRes.status === 403 || crossClassRes.status === 404, 'Using cross-tenant class ID rejected (400/403/404)');

  console.log('\n============================================================');
  console.log(`🎉 ALL ${passedTests} OF ${totalTests} LIVE EXAM STEP 1 TESTS PASSED!`);
  console.log('============================================================\n');
}

runLiveExamCreateTests()
  .catch((err) => {
    console.error('Test Suite Failed with error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
