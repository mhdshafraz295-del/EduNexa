/**
 * Test Suite: Step 7D Term Report Card, Transcripts, Class Ranking, Bulk PDF & Multi-Subject Outputs
 */
import fs from 'fs';
import path from 'path';
import prisma from './src/config/prisma.js';

const BASE_URL = 'http://localhost:5000/api';

async function runStep7DTests() {
  console.log('🧪 Starting Step 7D Term Report Card & Transcripts Test Suite...\n');
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

  try {
    // -------------------------------------------------------------
    // 1. Authenticate Seeded Test Accounts
    // -------------------------------------------------------------
    console.log('1. Authenticating Seeded Test Accounts...');

    // Admin A (Institute A)
    const aLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@edunexa.com', password: 'Admin123!' }),
    });
    const aData = await aLogin.json();
    assert(aData.success && aData.user.role === 'ADMIN', 'Institute A Admin authenticated');
    const adminTokenA = aData.token;
    const instituteAId = aData.user.instituteId;

    // Teacher
    const tLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'teacher@edunexa.com', password: 'Teacher123!' }),
    });
    const tData = await tLogin.json();
    assert(tData.success && tData.user.role === 'TEACHER', 'Teacher 1 authenticated');
    const teacherToken = tData.token;

    // Student 1
    const sLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@edunexa.com', password: 'Student123!' }),
    });
    const sData = await sLogin.json();
    assert(sData.success && sData.user.role === 'STUDENT', 'Student 1 authenticated');
    const studentToken = sData.token;
    const studentUser = sData.user;

    // Parent
    const pLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'parent@edunexa.com', password: 'Parent123!' }),
    });
    const pData = await pLogin.json();
    assert(pData.success && pData.user.role === 'PARENT', 'Parent authenticated');
    const parentToken = pData.token;

    // Super Admin for creating second tenant
    const saLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@edunexa.com', password: 'SuperAdmin123!' }),
    });
    const superAdminToken = (await saLogin.json()).token;

    const codeB = `TD${Date.now().toString().slice(-4)}`;
    const instBRes = await fetch(`${BASE_URL}/super-admin/institutes`, {
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
    const instBData = await instBRes.json();
    const instituteBId = instBData.data?.id;

    const bLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `admin_${codeB}@test.com`, password: 'Password123!' }),
    });
    const bData = await bLogin.json();
    const adminTokenB = bData.token;
    assert(Boolean(adminTokenB), 'Institute B Admin authenticated for isolation testing');

    // -------------------------------------------------------------
    // 2. Setup Academic Structure & Multi-Subject Fixtures
    // -------------------------------------------------------------
    console.log('\n2. Setting up Academic Structure & Multi-Subject Fixtures...');

    const testAcademicYear = await prisma.academicYear.findFirst({
      where: { instituteId: instituteAId },
    });
    const testClass = await prisma.class.findFirst({
      where: { instituteId: instituteAId },
    });
    const studentRecord1 = await prisma.student.findFirst({
      where: { userId: studentUser.id },
    });

    // Ensure student enrollment
    await prisma.studentEnrollment.upsert({
      where: {
        studentId_academicYearId_classId: {
          studentId: studentRecord1.id,
          academicYearId: testAcademicYear.id,
          classId: testClass.id,
        },
      },
      create: {
        instituteId: instituteAId,
        studentId: studentRecord1.id,
        academicYearId: testAcademicYear.id,
        classId: testClass.id,
        rollNo: '01',
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE' },
    });

    // Create 2nd enrolled student in the same class
    let user2 = await prisma.user.findFirst({
      where: { email: 'student2_step7d@edunexa.com' },
    });
    if (!user2) {
      user2 = await prisma.user.create({
        data: {
          username: 'student2_step7d',
          email: 'student2_step7d@edunexa.com',
          passwordHash: '$2b$10$w8.3f6/1t/p/4/2q7XvI2eq5L/n0O7h8sV2xZ8k7A9l0M1n2P3q4r',
          role: 'STUDENT',
          instituteId: instituteAId,
        },
      });
    }

    const studentRecord2 = await prisma.student.upsert({
      where: { userId: user2.id },
      create: {
        userId: user2.id,
        instituteId: instituteAId,
        classId: testClass.id,
        firstName: 'Sarah',
        lastName: 'Connor',
        name: 'Sarah Connor',
        admissionNumber: 'ST-STEP7D-02',
        rollNo: '02',
      },
      update: { classId: testClass.id },
    });

    await prisma.studentEnrollment.upsert({
      where: {
        studentId_academicYearId_classId: {
          studentId: studentRecord2.id,
          academicYearId: testAcademicYear.id,
          classId: testClass.id,
        },
      },
      create: {
        instituteId: instituteAId,
        studentId: studentRecord2.id,
        academicYearId: testAcademicYear.id,
        classId: testClass.id,
        rollNo: '02',
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE' },
    });

    // Create / find 3 subjects
    const mathSubject = await prisma.subject.upsert({
      where: { id: 981 },
      create: {
        id: 981,
        instituteId: instituteAId,
        name: 'Advanced Mathematics',
        code: 'MTH401',
        classId: testClass.id,
      },
      update: { classId: testClass.id },
    });

    const scienceSubject = await prisma.subject.upsert({
      where: { id: 982 },
      create: {
        id: 982,
        instituteId: instituteAId,
        name: 'Integrated Science',
        code: 'SCI401',
        classId: testClass.id,
      },
      update: { classId: testClass.id },
    });

    const englishSubject = await prisma.subject.upsert({
      where: { id: 983 },
      create: {
        id: 983,
        instituteId: instituteAId,
        name: 'English Literature',
        code: 'ENG401',
        classId: testClass.id,
      },
      update: { classId: testClass.id },
    });

    // Create 3 Subject Exams
    const mathExam = await prisma.exam.create({
      data: {
        instituteId: instituteAId,
        academicYearId: testAcademicYear.id,
        classId: testClass.id,
        subjectId: mathSubject.id,
        title: 'Grade 10 Mathematics Term Test',
        examType: 'WRITTEN',
        totalMarks: 100,
        passingMarks: 40,
        passMarkType: 'MARKS',
        status: 'PUBLISHED',
      },
    });

    const scienceExam = await prisma.exam.create({
      data: {
        instituteId: instituteAId,
        academicYearId: testAcademicYear.id,
        classId: testClass.id,
        subjectId: scienceSubject.id,
        title: 'Grade 10 Science Term Test',
        examType: 'WRITTEN',
        totalMarks: 100,
        passingMarks: 40,
        passMarkType: 'MARKS',
        status: 'PUBLISHED',
      },
    });

    const englishExam = await prisma.exam.create({
      data: {
        instituteId: instituteAId,
        academicYearId: testAcademicYear.id,
        classId: testClass.id,
        subjectId: englishSubject.id,
        title: 'Grade 10 English Term Test',
        examType: 'WRITTEN',
        totalMarks: 100,
        passingMarks: 40,
        passMarkType: 'MARKS',
        status: 'PUBLISHED',
      },
    });

    assert(Boolean(mathExam && scienceExam && englishExam), 'Created 3 multi-subject exams');

    // -------------------------------------------------------------
    // 3. Create Term Exam Group (No @default(1) tenant ownership)
    // -------------------------------------------------------------
    console.log('\n3. Testing Term Exam Group Creation...');

    const createGroupRes = await fetch(`${BASE_URL}/exam-groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminTokenA}`,
      },
      body: JSON.stringify({
        name: 'First Term Assessment 2026',
        description: 'Official Multi-Subject First Term Examinations',
        academicYearId: testAcademicYear.id,
        classId: testClass.id,
        startDate: '2026-01-01',
        endDate: '2026-04-30',
      }),
    });

    const groupData = await createGroupRes.json();
    assert(createGroupRes.status === 201, 'Term Exam Group created (201)');
    const testExamGroup = groupData.data;
    assert(testExamGroup.instituteId === instituteAId, 'ExamGroup instituteId assigned strictly from req.instituteId');
    assert(testExamGroup.status === 'DRAFT', 'Initial status is DRAFT');

    // -------------------------------------------------------------
    // 4. Attach Subject Exams to Group (With validation)
    // -------------------------------------------------------------
    console.log('\n4. Testing Subject Exam Attachment & Tenant Scope Validation...');

    // Attempt attaching an exam from another tenant
    const instituteBExam = await prisma.exam.create({
      data: {
        instituteId: instituteBId,
        classId: testClass.id,
        subjectId: mathSubject.id,
        title: 'Institute B Exam',
        totalMarks: 100,
        passingMarks: 50,
      },
    });

    const crossAttachRes = await fetch(`${BASE_URL}/exam-groups/${testExamGroup.id}/exams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminTokenA}`,
      },
      body: JSON.stringify({ examIds: [instituteBExam.id] }),
    });
    assert(crossAttachRes.status === 400, 'Cross-tenant exam attachment rejected with 400 Bad Request');

    // Attach real 3 subjects
    const attachRes = await fetch(`${BASE_URL}/exam-groups/${testExamGroup.id}/exams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminTokenA}`,
      },
      body: JSON.stringify({ examIds: [mathExam.id, scienceExam.id, englishExam.id] }),
    });
    const attachData = await attachRes.json();
    assert(attachRes.status === 200, 'Attached 3 valid subject exams to Term Group');
    assert(attachData.data.items.length === 3, 'Term Group contains 3 exam items');

    // -------------------------------------------------------------
    // 5. Bulk Marks Entry & Authoritative Calculation
    // -------------------------------------------------------------
    console.log('\n5. Testing Bulk Marks Entry (Teacher enters marks only)...');

    // Math Marks: Student 1 = 85, Student 2 = 72
    const mathBulkRes = await fetch(`${BASE_URL}/exams/${mathExam.id}/bulk-marks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminTokenA}`,
      },
      body: JSON.stringify({
        marksData: [
          { studentId: studentRecord1.id, marks: 85, feedback: 'Great math skills' },
          { studentId: studentRecord2.id, marks: 72, feedback: 'Good effort' },
        ],
      }),
    });
    if (mathBulkRes.status !== 200) {
      console.error('mathBulkRes error:', mathBulkRes.status, await mathBulkRes.text());
    }
    assert(mathBulkRes.status === 200, 'Math bulk marks saved');

    // Science Marks: Student 1 = 90, Student 2 = 72
    const sciBulkRes = await fetch(`${BASE_URL}/exams/${scienceExam.id}/bulk-marks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminTokenA}`,
      },
      body: JSON.stringify({
        marksData: [
          { studentId: studentRecord1.id, marks: 90, feedback: 'Excellent lab performance' },
          { studentId: studentRecord2.id, marks: 72, feedback: 'Solid comprehension' },
        ],
      }),
    });
    assert(sciBulkRes.status === 200, 'Science bulk marks saved');

    // English Marks: Student 1 = 80, Student 2 = 72
    const engBulkRes = await fetch(`${BASE_URL}/exams/${englishExam.id}/bulk-marks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminTokenA}`,
      },
      body: JSON.stringify({
        marksData: [
          { studentId: studentRecord1.id, marks: 80, feedback: 'Strong essays' },
          { studentId: studentRecord2.id, marks: 72, feedback: 'Consistent work' },
        ],
      }),
    });
    assert(engBulkRes.status === 200, 'English bulk marks saved');

    // Publish all results for the 3 exams
    await fetch(`${BASE_URL}/exams/${mathExam.id}/publish-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    await fetch(`${BASE_URL}/exams/${scienceExam.id}/publish-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    await fetch(`${BASE_URL}/exams/${englishExam.id}/publish-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });

    // -------------------------------------------------------------
    // 6. Term Aggregation & Dense Ranking Verification
    // -------------------------------------------------------------
    console.log('\n6. Testing Multi-Subject Aggregation & Authoritative Server Ranks...');

    const classSheetRes = await fetch(`${BASE_URL}/exam-groups/${testExamGroup.id}/class-sheet`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    const sheetData = await classSheetRes.json();
    if (classSheetRes.status !== 200) {
      console.error('classSheetRes error:', classSheetRes.status, sheetData);
    }
    assert(classSheetRes.status === 200, 'Fetched class result sheet');

    const student1Report = sheetData.data.studentReports.find((r) => r.studentId === studentRecord1.id);
    const student2Report = sheetData.data.studentReports.find((r) => r.studentId === studentRecord2.id);

    // Student 1: 85 + 90 + 80 = 255 / 300 = 85% -> Grade A, Rank 1
    assert(student1Report.totalObtainedMarks === 255, 'Student 1 total marks is 255');
    assert(student1Report.totalPossibleMarks === 300, 'Student 1 possible marks is 300');
    assert(student1Report.overallAverage === 85, 'Student 1 average is 85%');
    assert(student1Report.overallGrade === 'A', 'Student 1 grade is A (>= 75%)');
    assert(student1Report.overallPassStatus === 'PASS', 'Student 1 overall result is PASS');
    assert(student1Report.rankPosition === 1, 'Student 1 ranked 1st');

    // Student 2: 72 + 72 + 72 = 216 / 300 = 72% -> Grade B, Rank 2
    assert(student2Report.totalObtainedMarks === 216, 'Student 2 total marks is 216');
    assert(student2Report.overallAverage === 72, 'Student 2 average is 72%');
    assert(student2Report.overallGrade === 'B', 'Student 2 grade is B (65-74.99%)');
    assert(student2Report.rankPosition === 2, 'Student 2 ranked 2nd');

    // -------------------------------------------------------------
    // 7. Student Remarks (Per-Student Teacher & Principal Remarks)
    // -------------------------------------------------------------
    console.log('\n7. Testing Per-Student Remarks...');

    const remarksRes = await fetch(`${BASE_URL}/exam-groups/${testExamGroup.id}/remarks/${studentRecord1.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminTokenA}`,
      },
      body: JSON.stringify({
        teacherRemark: 'Outstanding critical thinking and class leadership.',
        principalRemark: 'Commended for academic excellence.',
      }),
    });
    const remarksData = await remarksRes.json();
    assert(remarksRes.status === 200, 'Student remarks saved');
    assert(remarksData.data.teacherRemark.includes('Outstanding'), 'Teacher remark persisted');
    assert(remarksData.data.principalRemark.includes('Commended'), 'Principal remark persisted');

    // -------------------------------------------------------------
    // 8. Privacy & Release Lifecycle (Draft vs Released)
    // -------------------------------------------------------------
    console.log('\n8. Testing Student & Parent Privacy Enforcement...');

    // Student attempts to view DRAFT report card -> must be rejected (403)
    const draftFetch = await fetch(
      `${BASE_URL}/exam-groups/${testExamGroup.id}/student-report/${studentRecord1.id}`,
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );
    assert(draftFetch.status === 403, 'Draft report card rejected from student (403)');

    // Release Term Report Cards
    const releaseRes = await fetch(`${BASE_URL}/exam-groups/${testExamGroup.id}/release`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    assert(releaseRes.status === 200, 'Term Exam Group released successfully');

    // Student views own released report card
    const studentReportRes = await fetch(
      `${BASE_URL}/exam-groups/${testExamGroup.id}/student-report/${studentRecord1.id}`,
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );
    const sReportData = await studentReportRes.json();
    assert(studentReportRes.status === 200, 'Student can view released report card');
    assert(sReportData.data.studentReport.overallAverage === 85, 'Student sees accurate average (85%)');
    assert(sReportData.data.studentReport.rankDisplay === '1', 'Student sees rank 1');
    assert(sReportData.data.studentReport.teacherRemark !== null, 'Student sees teacher remark');

    // Student 1 cannot view Student 2's report card
    const crossStudentRes = await fetch(
      `${BASE_URL}/exam-groups/${testExamGroup.id}/student-report/${studentRecord2.id}`,
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );
    assert(crossStudentRes.status === 403, 'Unauthorized student report access rejected (403)');

    // -------------------------------------------------------------
    // 9. Class Performance Analytics
    // -------------------------------------------------------------
    console.log('\n9. Testing Class Performance Analytics...');

    const analyticsRes = await fetch(`${BASE_URL}/exam-groups/${testExamGroup.id}/analytics`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    const analyticsData = await analyticsRes.json();
    assert(analyticsRes.status === 200, 'Fetched performance analytics');
    assert(analyticsData.data.fullyCompletedCount === 2, '2 students fully completed');
    assert(analyticsData.data.passedCount === 2, '2 students passed');
    assert(analyticsData.data.classAverage === 78.5, 'Class average is 78.5% ((85+72)/2)');
    assert(analyticsData.data.highestAverage === 85, 'Highest average is 85%');
    assert(analyticsData.data.subjectSummaries.length === 3, '3 subject summaries generated');

    // -------------------------------------------------------------
    // 10. Multi-Subject Class CSV Export
    // -------------------------------------------------------------
    console.log('\n10. Testing Class Result CSV Export...');

    const csvRes = await fetch(`${BASE_URL}/exam-groups/${testExamGroup.id}/export-csv`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    assert(csvRes.status === 200, 'CSV export endpoint succeeded');
    assert(csvRes.headers.get('content-type').includes('text/csv'), 'Content-Type is text/csv');
    const csvText = await csvRes.text();
    assert(csvText.includes('Advanced Mathematics'), 'CSV contains Mathematics column');
    assert(csvText.includes('255'), 'CSV contains student total marks (255)');

    // -------------------------------------------------------------
    // 11. PDF Document Generations (Individual, Class, Bulk)
    // -------------------------------------------------------------
    console.log('\n11. Testing Official PDF Generations...');

    // 11a. Individual Report Card PDF
    const indPdfRes = await fetch(
      `${BASE_URL}/exam-groups/${testExamGroup.id}/pdf/${studentRecord1.id}`,
      { headers: { Authorization: `Bearer ${adminTokenA}` } }
    );
    assert(indPdfRes.status === 200, 'Individual Report Card PDF generated (200 OK)');
    assert(indPdfRes.headers.get('content-type').includes('application/pdf'), 'Individual PDF Content-Type application/pdf');
    const indBuffer = await indPdfRes.arrayBuffer();
    assert(indBuffer.byteLength > 1000, 'Individual PDF payload received (> 1KB)');

    // 11b. Class Result Sheet PDF
    const classPdfRes = await fetch(
      `${BASE_URL}/exam-groups/${testExamGroup.id}/class-pdf`,
      { headers: { Authorization: `Bearer ${adminTokenA}` } }
    );
    assert(classPdfRes.status === 200, 'Class Result Sheet PDF generated (200 OK)');
    assert(classPdfRes.headers.get('content-type').includes('application/pdf'), 'Class Sheet PDF Content-Type application/pdf');
    const classBuffer = await classPdfRes.arrayBuffer();
    assert(classBuffer.byteLength > 1000, 'Class Sheet PDF payload received (> 1KB)');

    // 11c. Bulk All Students Report Cards PDF
    const bulkPdfRes = await fetch(
      `${BASE_URL}/exam-groups/${testExamGroup.id}/bulk-pdf`,
      { headers: { Authorization: `Bearer ${adminTokenA}` } }
    );
    assert(bulkPdfRes.status === 200, 'Bulk All Student Report Cards PDF generated (200 OK)');
    assert(bulkPdfRes.headers.get('content-type').includes('application/pdf'), 'Bulk PDF Content-Type application/pdf');
    const bulkBuffer = await bulkPdfRes.arrayBuffer();
    assert(bulkBuffer.byteLength > 2000, 'Bulk PDF contains multi-student pages (> 2KB)');

    // -------------------------------------------------------------
    // 12. Cross-Tenant Security Isolation
    // -------------------------------------------------------------
    console.log('\n12. Testing Cross-Tenant Security Isolation...');

    const bSheetRes = await fetch(`${BASE_URL}/exam-groups/${testExamGroup.id}/class-sheet`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminTokenB}` },
    });
    assert(bSheetRes.status === 404, 'Cross-tenant class sheet blocked with 404 Not Found');

    const bPdfRes = await fetch(
      `${BASE_URL}/exam-groups/${testExamGroup.id}/pdf/${studentRecord1.id}`,
      { headers: { Authorization: `Bearer ${adminTokenB}` } }
    );
    assert(bPdfRes.status === 404, 'Cross-tenant report PDF blocked with 404 Not Found');

    console.log('\n============================================================');
    console.log(`🎉 ALL ${passedTests} OF ${totalTests} STEP 7D REPORT CARD TESTS PASSED!`);
    console.log('============================================================\n');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

runStep7DTests();
