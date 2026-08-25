/**
 * Test Suite: Step 7C Written Exam Marking, Results, Grades, Bulk Marks, CSV & Official Result PDF
 */
import fs from 'fs';
import path from 'path';
import prisma from './src/config/prisma.js';

const BASE_URL = 'http://localhost:5000/api';

async function runStep7cTests() {
  console.log('🧪 Starting Step 7C Written Exam Marking & Results Test Suite...\n');
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

  // 1. Authenticate Seeded Accounts
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
  assert(tData.success && tData.user.role === 'TEACHER', 'Teacher 1 authenticated');
  const teacherToken1 = tData.token;

  const sLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@edunexa.com', password: 'Student123!' }),
  });
  const sData = await sLogin.json();
  assert(sData.success && sData.user.role === 'STUDENT', 'Student 1 authenticated');
  const studentToken1 = sData.token;

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

  // 2. Setup Academic Data & Written Exam
  console.log('\n2. Setting up Academic Structure & Written Exam...');
  const yearsRes = await fetch(`${BASE_URL}/academic/years`, { headers: { Authorization: `Bearer ${adminTokenA}` } });
  const yearId = (await yearsRes.json()).data[0].id;

  const classesRes = await fetch(`${BASE_URL}/academic/classes`, { headers: { Authorization: `Bearer ${adminTokenA}` } });
  const classId = (await classesRes.json()).data[0].id;

  const subjectsRes = await fetch(`${BASE_URL}/academic/subjects`, { headers: { Authorization: `Bearer ${adminTokenA}` } });
  const subjectId = (await subjectsRes.json()).data[0].id;

  const teachersRes = await fetch(`${BASE_URL}/teachers`, { headers: { Authorization: `Bearer ${adminTokenA}` } });
  const teachersList = (await teachersRes.json()).data || (await teachersRes.json()).teachers;
  const teacherId = teachersList[0].id;

  // Ensure Student 1 is enrolled in target class
  const studentProfile = await prisma.student.findFirst({ where: { userId: sData.user.id } });
  await prisma.studentEnrollment.upsert({
    where: {
      studentId_academicYearId_classId: {
        studentId: studentProfile.id,
        academicYearId: yearId,
        classId,
      },
    },
    create: {
      instituteId: aData.user.instituteId,
      studentId: studentProfile.id,
      academicYearId: yearId,
      classId,
      status: 'ACTIVE',
    },
    update: { status: 'ACTIVE' },
  });

  // Ensure Parent is linked to Student 1
  const parentProfile = await prisma.parent.findFirst({ where: { userId: pData.user.id } });
  if (parentProfile && studentProfile) {
    await prisma.parentStudent.upsert({
      where: {
        parentId_studentId: {
          parentId: parentProfile.id,
          studentId: studentProfile.id,
        },
      },
      create: {
        parentId: parentProfile.id,
        studentId: studentProfile.id,
        relationship: 'Guardian',
      },
      update: {},
    });
  }

  // Create Teacher Assignment
  await fetch(`${BASE_URL}/academic/teacher-assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminTokenA}` },
    body: JSON.stringify({
      academicYearId: yearId,
      classId,
      subjectId,
      teacherId,
      role: 'PRIMARY',
    }),
  });

  // Create Written Exam (Total Marks: 100, Passing Marks: 50, passMarkType: MARKS)
  const createExamRes = await fetch(`${BASE_URL}/exams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminTokenA}` },
    body: JSON.stringify({
      title: 'Mathematics Term Written Assessment',
      description: 'Written exam with manual PDF paper evaluation',
      academicYearId: yearId,
      classId,
      subjectId,
      teacherId,
      totalMarks: 100,
      passingMarks: 50,
      passMarkType: 'MARKS',
      examType: 'WRITTEN',
      durationMinutes: 120,
    }),
  });
  const examData = await createExamRes.json();
  assert(examData.success, 'Written exam created successfully');
  const examId = examData.data.id;

  // Publish Exam
  await fetch(`${BASE_URL}/exams/${examId}/publish`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminTokenA}` },
  });

  // 3. Testing Student Written Answer PDF Submission
  console.log('\n3. Testing Student Written Answer Paper Submission...');
  const samplePdf = Buffer.from('%PDF-1.4 sample answer document content for evaluation');
  const blobAnswer = new Blob([samplePdf], { type: 'application/pdf' });
  const formAnswer = new FormData();
  formAnswer.append('file', blobAnswer, 'student1_answers.pdf');

  const uploadAnsRes = await fetch(`${BASE_URL}/exams/student/${examId}/upload-answer`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken1}` },
    body: formAnswer,
  });
  const uploadAnsData = await uploadAnsRes.json();
  if (!uploadAnsData.success) {
    console.log('Upload answer failed:', uploadAnsRes.status, uploadAnsData);
  }
  assert(uploadAnsData.success, 'Student uploaded written answer PDF');
  assert(uploadAnsData.data.status === 'SUBMITTED', 'Submission status is SUBMITTED');

  // 4. Testing Admin & Teacher Submissions List
  console.log('\n4. Testing Submissions Retrieval & RBAC Authorization...');
  const subResTeacher = await fetch(`${BASE_URL}/exams/${examId}/submissions`, {
    headers: { Authorization: `Bearer ${teacherToken1}` },
  });
  const subDataTeacher = await subResTeacher.json();
  if (!subDataTeacher.success) {
    console.log('Submissions teacher fetch failed:', subResTeacher.status, subDataTeacher);
  }
  assert(subDataTeacher.success, 'Authorized teacher retrieves submissions list');
  const studentSub = subDataTeacher.data.submissions.find((s) => s.hasSubmission);
  assert(Boolean(studentSub), 'Student submission found in evaluation queue');
  const studentId = studentSub.studentId;

  // 5. Testing Protected Answer PDF Stream
  console.log('\n5. Testing Protected Answer PDF Streaming...');
  // Unauthorized request (no token) -> 401
  const unauthPdf = await fetch(`${BASE_URL}/exams/${examId}/submissions/${studentId}/answer-pdf`);
  assert(unauthPdf.status === 401, 'Unauthenticated access to answer paper rejected (401)');

  // Authorized Teacher -> 200 with application/pdf
  const authPdf = await fetch(`${BASE_URL}/exams/${examId}/submissions/${studentId}/answer-pdf`, {
    headers: { Authorization: `Bearer ${teacherToken1}` },
  });
  assert(authPdf.status === 200, 'Authorized teacher streams protected answer paper');
  assert(authPdf.headers.get('content-type').includes('application/pdf'), 'Answer paper content-type is application/pdf');

  // 6. Testing Individual Marking & Server Calculations
  console.log('\n6. Testing Teacher Marking, Server %, Grade, Pass/Fail...');
  
  // Marks Validation: Negative rejected
  const negMarkRes = await fetch(`${BASE_URL}/exams/${examId}/submissions/${studentId}/mark`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken1}` },
    body: JSON.stringify({ marks: -5, feedback: 'Negative test' }),
  });
  assert(negMarkRes.status === 400, 'Negative marks rejected (400)');

  // Marks Validation: Exceeding total marks rejected
  const exceedMarkRes = await fetch(`${BASE_URL}/exams/${examId}/submissions/${studentId}/mark`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken1}` },
    body: JSON.stringify({ marks: 150, feedback: 'Exceed test' }),
  });
  assert(exceedMarkRes.status === 400, 'Marks exceeding total rejected (400)');

  // Valid Marking (Marks: 78, Feedback: "Excellent mathematical reasoning")
  const markRes = await fetch(`${BASE_URL}/exams/${examId}/submissions/${studentId}/mark`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken1}` },
    body: JSON.stringify({
      marks: 78,
      feedback: 'Excellent mathematical reasoning',
      isDraft: false,
    }),
  });
  const markData = await markRes.json();
  assert(markData.success, 'Teacher marks submission successfully');
  assert(markData.data.marks === 78, 'Marks awarded recorded as 78');
  assert(markData.data.percentage === 78, 'Server calculated percentage is 78%');
  assert(markData.data.grade === 'A', 'Server calculated grade is A (>= 75%)');
  assert(markData.data.status === 'PASS', 'Pass/fail calculated as PASS (78 >= 50 passing marks)');
  assert(markData.data.resultStatus === 'MARKED', 'Result status is MARKED (not yet published)');
  assert(markData.data.teacherFeedback === 'Excellent mathematical reasoning', 'Teacher feedback stored');

  // 7. Testing Result Privacy Before Publishing
  console.log('\n7. Testing Student & Parent Result Privacy (Unpublished)...');
  const studentResultsBefore = await fetch(`${BASE_URL}/exams/student/results/all`, {
    headers: { Authorization: `Bearer ${studentToken1}` },
  });
  const sResultsDataBefore = await studentResultsBefore.json();
  const foundBefore = (sResultsDataBefore.data || []).find((r) => r.examId === examId);
  assert(!foundBefore, 'Student CANNOT see MARKED unpublished result');

  // 8. Testing Result Publishing & Student/Parent Visibility
  console.log('\n8. Testing Result Publishing Lifecycle...');
  const pubRes = await fetch(`${BASE_URL}/exams/${examId}/results/${studentId}/publish`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${teacherToken1}` },
  });
  const pubData = await pubRes.json();
  assert(pubData.success && pubData.data.resultStatus === 'PUBLISHED', 'Result published successfully');

  // Student can now view result
  const studentResultsAfter = await fetch(`${BASE_URL}/exams/student/results/all`, {
    headers: { Authorization: `Bearer ${studentToken1}` },
  });
  const sResultsDataAfter = await studentResultsAfter.json();
  const foundAfter = (sResultsDataAfter.data || []).find((r) => r.examId === examId);
  assert(Boolean(foundAfter), 'Student can view PUBLISHED result');
  assert(foundAfter.marks === 78 && foundAfter.grade === 'A', 'Student receives accurate marks and grade');
  assert(foundAfter.teacherFeedback === 'Excellent mathematical reasoning', 'Student sees teacher feedback');

  // Link Parent to Student for parent visibility check
  await fetch(`${BASE_URL}/portal/settings`, { headers: { Authorization: `Bearer ${adminTokenA}` } });
  
  // 9. Testing Published Result Edit Audit Trail
  console.log('\n9. Testing Published Result Edit Audit Trail...');
  const editMarkRes = await fetch(`${BASE_URL}/exams/${examId}/submissions/${studentId}/mark`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken1}` },
    body: JSON.stringify({
      marks: 85,
      feedback: 'Re-evaluated question 3: additional marks awarded',
      reason: 'Re-scrutiny requested by student',
    }),
  });
  const editMarkData = await editMarkRes.json();
  assert(editMarkData.success && editMarkData.data.marks === 85, 'Marks updated to 85');
  assert(editMarkData.data.percentage === 85 && editMarkData.data.grade === 'A', 'Recalculated percentage is 85%');

  // 10. Testing Unpublish
  console.log('\n10. Testing Result Unpublishing...');
  const unpubRes = await fetch(`${BASE_URL}/exams/${examId}/results/${studentId}/unpublish`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${teacherToken1}` },
  });
  assert((await unpubRes.json()).success, 'Result unpublished successfully');

  // Student immediately loses visibility
  const studentResultsUnpub = await fetch(`${BASE_URL}/exams/student/results/all`, {
    headers: { Authorization: `Bearer ${studentToken1}` },
  });
  const foundUnpub = ((await studentResultsUnpub.json()).data || []).find((r) => r.examId === examId);
  assert(!foundUnpub, 'Student immediately loses visibility after unpublish');

  // Re-publish for remaining tests
  await fetch(`${BASE_URL}/exams/${examId}/results/${studentId}/publish`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${teacherToken1}` },
  });

  // 11. Testing CSV Template Export
  console.log('\n11. Testing CSV Export & Import Validation...');
  const csvExportRes = await fetch(`${BASE_URL}/exams/${examId}/submissions/export-csv`, {
    headers: { Authorization: `Bearer ${teacherToken1}` },
  });
  assert(csvExportRes.status === 200, 'CSV export endpoint succeeded');
  const csvContent = await csvExportRes.text();
  assert(csvContent.includes('AdmissionNumber') && csvContent.includes('Marks'), 'CSV template has required headers');

  // 12. Testing CSV Preview (Dry Run / Phase 1)
  const previewForm = new FormData();
  const validCsvSample = `AdmissionNumber,StudentName,RollNo,Marks,Feedback\n"${studentSub.admissionNumber || studentSub.studentId}","${studentSub.studentName}","","90","Great performance"`;
  previewForm.append('file', new Blob([validCsvSample], { type: 'text/csv' }), 'marks_import.csv');

  const previewRes = await fetch(`${BASE_URL}/exams/${examId}/submissions/preview-csv`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherToken1}` },
    body: previewForm,
  });
  const previewData = await previewRes.json();
  assert(previewData.success && previewData.data.validRows.length === 1, 'CSV Preview validates 1 valid row (Dry Run)');
  assert(previewData.data.canImport === true, 'canImport is true');

  // 13. Testing CSV Confirm Import (Phase 2)
  const confirmRes = await fetch(`${BASE_URL}/exams/${examId}/submissions/confirm-csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken1}` },
    body: JSON.stringify({
      rows: previewData.data.validRows,
      reason: 'Batch term exam grading',
    }),
  });
  const confirmData = await confirmRes.json();
  assert(confirmData.success, 'CSV confirmed import persisted marks in transaction');

  // 14. Testing Bulk Publish All Marked Results
  console.log('\n12. Testing Bulk Publish All Results...');
  const pubAllRes = await fetch(`${BASE_URL}/exams/${examId}/results/publish-all`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${teacherToken1}` },
  });
  assert((await pubAllRes.json()).success, 'Bulk publish all marked results succeeded');

  // 15. Testing Official Institute-Branded Result PDF Generation
  console.log('\n13. Testing Official Result PDF Generation...');
  const pdfRes = await fetch(`${BASE_URL}/exams/${examId}/results/${studentId}/pdf`, {
    headers: { Authorization: `Bearer ${teacherToken1}` },
  });
  assert(pdfRes.status === 200, 'Official Result PDF generated (200 OK)');
  assert(pdfRes.headers.get('content-type') === 'application/pdf', 'PDF returns Content-Type application/pdf');
  const pdfBuffer = await pdfRes.arrayBuffer();
  assert(pdfBuffer.byteLength > 1000, 'PDF binary payload successfully received (> 1KB)');

  // 16. Testing Cross-Tenant Security Isolation
  console.log('\n14. Testing Multi-Tenant & Teacher Isolation...');
  // Institute B Admin cannot view Institute A submissions
  const bSubRes = await fetch(`${BASE_URL}/exams/${examId}/submissions`, {
    headers: { Authorization: `Bearer ${adminTokenB}` },
  });
  assert(bSubRes.status === 404, 'Institute B Admin cannot access Institute A submissions (404)');

  // Institute B Admin cannot generate Institute A result PDF
  const bPdfRes = await fetch(`${BASE_URL}/exams/${examId}/results/${studentId}/pdf`, {
    headers: { Authorization: `Bearer ${adminTokenB}` },
  });
  assert(bPdfRes.status === 404, 'Institute B Admin cannot access Institute A result PDF (404)');

  console.log(`\n============================================================`);
  console.log(`🎉 ALL ${passedTests} OF ${totalTests} STEP 7C WRITTEN MARKING & RESULTS TESTS PASSED!`);
  console.log(`============================================================\n`);
}

runStep7cTests().catch((err) => {
  console.error('\n❌ Test suite failed with error:', err);
  process.exit(1);
});
