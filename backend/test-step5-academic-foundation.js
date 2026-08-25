import prisma from './src/config/prisma.js';
import bcrypt from 'bcryptjs';

const BASE_URL = 'http://localhost:5000/api';

async function runStep5Tests() {
  console.log('🧪 Starting EduNexa SaaS Step 5: Academic Foundation & Multi-Tenant Tests...\n');

  // Authenticate SUPER_ADMIN
  const saRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@edunexa.com', password: 'SuperAdmin123!' }),
  });
  const saData = await saRes.json();
  const superAdminToken = saData.token;

  // 1. Setup Test Institute A & Institute B
  const suffix = Date.now().toString().slice(-4);
  console.log(`Setting up Test Institute A & B (Suffix: ${suffix})...`);

  // Institute A
  const instARes = await fetch(`${BASE_URL}/super-admin/institutes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      name: `Step5 Academy A ${suffix}`,
      code: `S5A${suffix}`,
      email: `admin_a_${suffix}@test.com`,
      adminEmail: `admin_a_${suffix}@test.com`,
      adminPassword: 'Password123!',
      adminUsername: `s5a_admin_${suffix}`,
    }),
  });
  const instAData = await instARes.json();
  const instAId = instAData.data.id;
  const adminAEmail = instAData.data.admin.email;

  // Institute B
  const instBRes = await fetch(`${BASE_URL}/super-admin/institutes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      name: `Step5 Academy B ${suffix}`,
      code: `S5B${suffix}`,
      email: `admin_b_${suffix}@test.com`,
      adminEmail: `admin_b_${suffix}@test.com`,
      adminPassword: 'Password123!',
      adminUsername: `s5b_admin_${suffix}`,
    }),
  });
  const instBData = await instBRes.json();
  const instBId = instBData.data.id;
  const adminBEmail = instBData.data.admin.email;

  // Log in Admin A and Admin B
  const [loginARes, loginBRes] = await Promise.all([
    fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminAEmail, password: 'Password123!' }),
    }),
    fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminBEmail, password: 'Password123!' }),
    }),
  ]);
  const adminAToken = (await loginARes.json()).token;
  const adminBToken = (await loginBRes.json()).token;

  // Ensure Active Subscriptions for both with all academic features enabled
  const fullFeatures = [
    { code: 'STUDENT_MANAGEMENT', name: 'Student Management' },
    { code: 'TEACHER_MANAGEMENT', name: 'Teacher Management' },
    { code: 'TIMETABLE', name: 'Timetable' },
    { code: 'ZOOM_CLASSES', name: 'Zoom Classes' },
    { code: 'INVOICES', name: 'Invoices' },
  ];

  await prisma.instituteSubscription.create({
    data: {
      instituteId: instAId,
      planNameSnapshot: 'Step5 Full Pro',
      priceSnapshot: 15000.00,
      currencySnapshot: 'LKR',
      durationSnapshot: 1,
      durationTypeSnapshot: 'MONTHS',
      featuresSnapshot: fullFeatures,
      limitsSnapshot: { students: 100, teachers: 50, classes: 20 },
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
    },
  });

  await prisma.instituteSubscription.create({
    data: {
      instituteId: instBId,
      planNameSnapshot: 'Step5 Full Pro',
      priceSnapshot: 15000.00,
      currencySnapshot: 'LKR',
      durationSnapshot: 1,
      durationTypeSnapshot: 'MONTHS',
      featuresSnapshot: fullFeatures,
      limitsSnapshot: { students: 100, teachers: 50, classes: 20 },
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
    },
  });

  // -------------------------------------------------------------
  // Test 1: Institute Admin creates Academic Year 2026
  // -------------------------------------------------------------
  console.log('Test 1: Institute Admin creates Academic Year 2026...');
  const yrRes = await fetch(`${BASE_URL}/academic/years`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAToken}`,
    },
    body: JSON.stringify({
      name: `2026-${suffix}`,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      isCurrent: false,
    }),
  });
  const yrData = await yrRes.json();
  if (!yrData.success) throw new Error(`Create year failed: ${JSON.stringify(yrData)}`);
  const year2026Id = yrData.data.id;
  console.log(`  ✅ Passed: Academic Year '2026-${suffix}' created (ID: ${year2026Id}).`);

  // -------------------------------------------------------------
  // Test 2: Marks 2026 as current year
  // -------------------------------------------------------------
  console.log('Test 2: Marks 2026 as current year...');
  const curRes = await fetch(`${BASE_URL}/academic/years/${year2026Id}/current`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminAToken}` },
  });
  const curData = await curRes.json();
  if (!curData.success) throw new Error(`Set current failed: ${JSON.stringify(curData)}`);
  console.log('  ✅ Passed: Year 2026 marked as current year.');

  // -------------------------------------------------------------
  // Test 3: Creates Grade 10 academic level
  // -------------------------------------------------------------
  console.log('Test 3: Creates Grade 10 academic level...');
  const lvlRes = await fetch(`${BASE_URL}/academic/levels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAToken}`,
    },
    body: JSON.stringify({
      name: 'Grade 10',
      code: `G10_${suffix}`,
      description: 'Secondary High School Ordinary Level Prep',
      displayOrder: 10,
    }),
  });
  const lvlData = await lvlRes.json();
  if (!lvlData.success) throw new Error(`Create level failed: ${JSON.stringify(lvlData)}`);
  const levelG10Id = lvlData.data.id;
  console.log(`  ✅ Passed: Academic Level Grade 10 created (ID: ${levelG10Id}).`);

  // -------------------------------------------------------------
  // Test 4: Creates Grade 10-A and Grade 10-B
  // -------------------------------------------------------------
  console.log('Test 4: Creates Grade 10-A and Grade 10-B classes...');
  const [cls1Res, cls2Res] = await Promise.all([
    fetch(`${BASE_URL}/academic/classes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAToken}`,
      },
      body: JSON.stringify({
        name: 'Grade 10',
        section: 'A',
        academicLevelId: levelG10Id,
        academicYearId: year2026Id,
        medium: 'English',
        classType: 'PHYSICAL',
        capacity: 40,
      }),
    }),
    fetch(`${BASE_URL}/academic/classes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAToken}`,
      },
      body: JSON.stringify({
        name: 'Grade 10',
        section: 'B',
        academicLevelId: levelG10Id,
        academicYearId: year2026Id,
        medium: 'English',
        classType: 'HYBRID',
        capacity: 35,
      }),
    }),
  ]);
  const cls1Data = await cls1Res.json();
  const cls2Data = await cls2Res.json();
  if (!cls1Data.success || !cls2Data.success) throw new Error(`Create classes failed: ${JSON.stringify({ cls1Data, cls2Data })}`);
  const class10AId = cls1Data.data.id;
  const class10BId = cls2Data.data.id;
  console.log(`  ✅ Passed: Created Grade 10-A (ID: ${class10AId}) & Grade 10-B (ID: ${class10BId}).`);

  // -------------------------------------------------------------
  // Test 5: Creates Mathematics and ICT subjects
  // -------------------------------------------------------------
  console.log('Test 5: Creates Mathematics and ICT subjects...');
  const [sub1Res, sub2Res] = await Promise.all([
    fetch(`${BASE_URL}/academic/subjects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAToken}`,
      },
      body: JSON.stringify({
        name: 'Mathematics',
        code: `MATH_${suffix}`,
        description: 'Pure and Applied Mathematics',
      }),
    }),
    fetch(`${BASE_URL}/academic/subjects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAToken}`,
      },
      body: JSON.stringify({
        name: 'Information & Communication Tech',
        code: `ICT_${suffix}`,
        description: 'Computer Science & Software Principles',
      }),
    }),
  ]);
  const sub1Data = await sub1Res.json();
  const sub2Data = await sub2Res.json();
  if (!sub1Data.success || !sub2Data.success) throw new Error(`Create subjects failed: ${JSON.stringify({ sub1Data, sub2Data })}`);
  const subMathId = sub1Data.data.id;
  const subIctId = sub2Data.data.id;
  console.log(`  ✅ Passed: Created Mathematics (ID: ${subMathId}) & ICT (ID: ${subIctId}).`);

  // -------------------------------------------------------------
  // Test 6: Assigns subjects to Grade 10-A
  // -------------------------------------------------------------
  console.log('Test 6: Assigns subjects to Grade 10-A...');
  const mapRes = await fetch(`${BASE_URL}/academic/classes/${class10AId}/subjects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAToken}`,
    },
    body: JSON.stringify({ subjectIds: [subMathId, subIctId] }),
  });
  const mapData = await mapRes.json();
  if (!mapData.success || mapData.data.length !== 2) throw new Error(`Subject assignment failed: ${JSON.stringify(mapData)}`);
  console.log('  ✅ Passed: Assigned Mathematics and ICT to Grade 10-A.');

  // -------------------------------------------------------------
  // Test 7: Create Teacher and Assign to Grade 10-A Mathematics
  // -------------------------------------------------------------
  console.log('Test 7: Assigns Mathematics teacher to Grade 10-A...');
  const teachRes = await fetch(`${BASE_URL}/teachers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAToken}`,
    },
    body: JSON.stringify({
      name: 'Mohamed Aslam',
      email: `aslam_${suffix}@test.com`,
      employeeId: `TCH-${suffix}-1`,
    }),
  });
  const teachData = await teachRes.json();
  if (!teachData.success) throw new Error(`Create teacher failed: ${JSON.stringify(teachData)}`);
  const teacherId = teachData.data.id;
  const teacherUserId = teachData.data.userId;

  const assignRes = await fetch(`${BASE_URL}/academic/teacher-assignments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAToken}`,
    },
    body: JSON.stringify({
      academicYearId: year2026Id,
      classId: class10AId,
      subjectId: subMathId,
      teacherId,
      role: 'PRIMARY',
    }),
  });
  const assignData = await assignRes.json();
  if (!assignData.success) throw new Error(`Teacher assignment failed: ${JSON.stringify(assignData)}`);
  console.log(`  ✅ Passed: Assigned Teacher (ID: ${teacherId}) to Grade 10-A Mathematics.`);

  // -------------------------------------------------------------
  // Test 8: Bulk enrolls students into Grade 10-A
  // -------------------------------------------------------------
  console.log('Test 8: Bulk enrolls students into Grade 10-A...');
  const [st1Res, st2Res] = await Promise.all([
    fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAToken}`,
      },
      body: JSON.stringify({
        firstName: 'Safras',
        lastName: 'Ahmed',
        email: `safras_${suffix}@test.com`,
        admissionNumber: `ADM-${suffix}-01`,
      }),
    }),
    fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAToken}`,
      },
      body: JSON.stringify({
        firstName: 'Fathima',
        lastName: 'Rifka',
        email: `rifka_${suffix}@test.com`,
        admissionNumber: `ADM-${suffix}-02`,
      }),
    }),
  ]);
  const st1Data = await st1Res.json();
  const st2Data = await st2Res.json();
  const student1Id = st1Data.data.id;
  const student2Id = st2Data.data.id;
  const student1UserId = st1Data.data.userId;

  const bulkEnrRes = await fetch(`${BASE_URL}/academic/enrollments/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAToken}`,
    },
    body: JSON.stringify({
      studentIds: [student1Id, student2Id],
      classId: class10AId,
      academicYearId: year2026Id,
    }),
  });
  const bulkEnrData = await bulkEnrRes.json();
  if (!bulkEnrData.success || bulkEnrData.enrolledCount !== 2) {
    throw new Error(`Bulk enrollment failed: ${JSON.stringify(bulkEnrData)}`);
  }
  console.log(`  ✅ Passed: Bulk enrolled 2 students into Grade 10-A.`);

  // -------------------------------------------------------------
  // Test 9: Student enrollment history is preserved
  // -------------------------------------------------------------
  console.log('Test 9: Student enrollment history is preserved across years...');
  const enrHistory = await prisma.studentEnrollment.findMany({
    where: { studentId: student1Id, instituteId: instAId },
  });
  if (enrHistory.length === 0) throw new Error('Enrollment history missing');
  console.log('  ✅ Passed: Student enrollment record is preserved in history table.');

  // -------------------------------------------------------------
  // Test 10: Creates physical timetable session
  // -------------------------------------------------------------
  console.log('Test 10: Creates physical timetable session (Monday 08:00 - 09:30)...');
  const tt1Res = await fetch(`${BASE_URL}/timetable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAToken}`,
    },
    body: JSON.stringify({
      academicYearId: year2026Id,
      classId: class10AId,
      subjectId: subMathId,
      teacherId,
      dayOfWeek: 'MONDAY',
      startTime: '08:00',
      endTime: '09:30',
      classType: 'PHYSICAL',
      room: 'Room 101',
    }),
  });
  const tt1Data = await tt1Res.json();
  if (!tt1Data.success) throw new Error(`Physical timetable failed: ${JSON.stringify(tt1Data)}`);
  const session1Id = tt1Data.data.id;
  console.log(`  ✅ Passed: Created physical timetable session (ID: ${session1Id}).`);

  // -------------------------------------------------------------
  // Test 11: Creates online timetable session with HTTPS meeting URL
  // -------------------------------------------------------------
  console.log('Test 11: Creates online timetable session with HTTPS Zoom link (Monday 10:00 - 11:30)...');
  const tt2Res = await fetch(`${BASE_URL}/timetable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAToken}`,
    },
    body: JSON.stringify({
      academicYearId: year2026Id,
      classId: class10AId,
      subjectId: subIctId,
      teacherId,
      dayOfWeek: 'MONDAY',
      startTime: '10:00',
      endTime: '11:30',
      classType: 'ONLINE',
      meetingUrl: 'https://zoom.us/j/84920391029',
      meetingId: '849 2039 1029',
      meetingPassword: 'edunexa_passcode',
    }),
  });
  const tt2Data = await tt2Res.json();
  if (!tt2Data.success) throw new Error(`Online timetable failed: ${JSON.stringify(tt2Data)}`);
  console.log('  ✅ Passed: Created online timetable session with secure HTTPS meeting link.');

  // -------------------------------------------------------------
  // Test 12: Teacher timetable conflict is detected
  // -------------------------------------------------------------
  console.log('Test 12: Teacher timetable conflict detection (Teacher already teaching at 08:30 - 09:30)...');
  const conflictTeacherRes = await fetch(`${BASE_URL}/timetable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAToken}`,
    },
    body: JSON.stringify({
      academicYearId: year2026Id,
      classId: class10BId,
      subjectId: subMathId,
      teacherId, // same teacher
      dayOfWeek: 'MONDAY',
      startTime: '08:30',
      endTime: '09:30',
      classType: 'PHYSICAL',
    }),
  });
  const conflictTeacherData = await conflictTeacherRes.json();
  if (conflictTeacherRes.status !== 409 || conflictTeacherData.code !== 'TIMETABLE_CONFLICT' || conflictTeacherData.conflictType !== 'TEACHER') {
    throw new Error(`Teacher conflict was not rejected! ${JSON.stringify(conflictTeacherData)}`);
  }
  console.log(`  ✅ Passed: Teacher conflict detected and blocked: "${conflictTeacherData.message}"`);

  // -------------------------------------------------------------
  // Test 13: Class timetable overlap is detected
  // -------------------------------------------------------------
  console.log('Test 13: Class timetable overlap detection (Class 10-A already has session at 09:00 - 10:30)...');
  const conflictClassRes = await fetch(`${BASE_URL}/timetable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAToken}`,
    },
    body: JSON.stringify({
      academicYearId: year2026Id,
      classId: class10AId, // same class
      subjectId: subIctId,
      dayOfWeek: 'MONDAY',
      startTime: '09:00',
      endTime: '10:30',
      classType: 'PHYSICAL',
    }),
  });
  const conflictClassData = await conflictClassRes.json();
  if (conflictClassRes.status !== 409 || conflictClassData.code !== 'TIMETABLE_CONFLICT' || conflictClassData.conflictType !== 'CLASS') {
    throw new Error(`Class conflict was not rejected! ${JSON.stringify(conflictClassData)}`);
  }
  console.log(`  ✅ Passed: Class session conflict detected and blocked: "${conflictClassData.message}"`);

  // -------------------------------------------------------------
  // Test 14: Student dashboard returns only own enrolled class timetable
  // -------------------------------------------------------------
  console.log('Test 14: Student dashboard returns only own class timetable...');
  // Log in as student 1
  const stLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `safras_${suffix}@test.com`, password: 'Student123!' }),
  });
  const stLoginData = await stLoginRes.json();
  const studentToken = stLoginData.token;

  const stTtRes = await fetch(`${BASE_URL}/timetable`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const stTtData = await stTtRes.json();
  if (!stTtData.success || !stTtData.data.every((s) => s.classId === class10AId)) {
    throw new Error(`Student timetable filter failed: ${JSON.stringify(stTtData)}`);
  }
  console.log(`  ✅ Passed: Student receives exactly their enrolled class sessions (${stTtData.data.length} sessions).`);

  // -------------------------------------------------------------
  // Test 15: Teacher dashboard returns only assigned timetable sessions
  // -------------------------------------------------------------
  console.log('Test 15: Teacher dashboard returns only assigned timetable...');
  const tchLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `aslam_${suffix}@test.com`, password: 'Teacher123!' }),
  });
  const tchLoginData = await tchLoginRes.json();
  const teacherToken = tchLoginData.token;

  const tchTtRes = await fetch(`${BASE_URL}/timetable`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  const tchTtData = await tchTtRes.json();
  if (!tchTtData.success || !tchTtData.data.every((s) => s.teacherId === teacherId)) {
    throw new Error(`Teacher timetable filter failed: ${JSON.stringify(tchTtData)}`);
  }
  console.log(`  ✅ Passed: Teacher receives only their assigned sessions (${tchTtData.data.length} sessions).`);

  // -------------------------------------------------------------
  // Test 16: Parent dashboard returns linked child's timetable
  // -------------------------------------------------------------
  console.log('Test 16: Parent dashboard returns linked child timetable...');
  const parentUser = await prisma.user.create({
    data: {
      username: `parent_${suffix}`,
      email: `parent_${suffix}@test.com`,
      passwordHash: await bcrypt.hash('Parent123!', 10),
      role: 'PARENT',
      instituteId: instAId,
      isActive: true,
    },
  });
  const parent = await prisma.parent.create({
    data: {
      userId: parentUser.id,
      instituteId: instAId,
      name: 'Mr. Ahmed',
    },
  });
  await prisma.parentStudent.create({
    data: { parentId: parent.id, studentId: student1Id },
  });

  const parentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `parent_${suffix}@test.com`, password: 'Parent123!' }),
  });
  const parentToken = (await parentLoginRes.json()).token;

  const parentTtRes = await fetch(`${BASE_URL}/timetable`, {
    headers: { Authorization: `Bearer ${parentToken}` },
  });
  const parentTtData = await parentTtRes.json();
  if (!parentTtData.success || !parentTtData.data.every((s) => s.classId === class10AId)) {
    throw new Error(`Parent timetable failed: ${JSON.stringify(parentTtData)}`);
  }
  console.log('  ✅ Passed: Parent receives child class timetable.');

  // -------------------------------------------------------------
  // Test 17: Institute B cannot access Institute A academic records
  // -------------------------------------------------------------
  console.log('Test 17: Tenant Isolation - Institute B cannot query Institute A records...');
  const crossClassRes = await fetch(`${BASE_URL}/academic/classes/${class10AId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminBToken}`,
    },
    body: JSON.stringify({ name: 'Hacked Class' }),
  });
  if (crossClassRes.status !== 404) {
    throw new Error(`Tenant breach: Admin B could modify Institute A class! Status: ${crossClassRes.status}`);
  }
  console.log('  ✅ Passed: Institute B update attempt on Institute A class returned 404 Not Found.');

  // -------------------------------------------------------------
  // Test 18: TIMETABLE-disabled plan is blocked correctly
  // -------------------------------------------------------------
  console.log('Test 18: TIMETABLE-disabled plan blocked with 403 FEATURE_NOT_INCLUDED...');
  await prisma.instituteSubscription.create({
    data: {
      instituteId: instAId,
      planNameSnapshot: 'Starter No Timetable',
      priceSnapshot: 5000.00,
      currencySnapshot: 'LKR',
      durationSnapshot: 1,
      durationTypeSnapshot: 'MONTHS',
      featuresSnapshot: [{ code: 'STUDENT_MANAGEMENT', name: 'Students' }], // no TIMETABLE
      limitsSnapshot: { classes: 5 },
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
    },
  });

  const blockedTtRes = await fetch(`${BASE_URL}/timetable`, {
    headers: { Authorization: `Bearer ${adminAToken}` },
  });
  const blockedTtData = await blockedTtRes.json();
  if (blockedTtRes.status !== 403 || blockedTtData.code !== 'FEATURE_NOT_INCLUDED') {
    throw new Error(`Timetable feature guard failed: ${JSON.stringify(blockedTtData)}`);
  }
  console.log('  ✅ Passed: Timetable access cleanly blocked with 403 FEATURE_NOT_INCLUDED.');

  // -------------------------------------------------------------
  // Test 19: ZOOM_CLASSES-disabled plan cannot use online meeting capability
  // -------------------------------------------------------------
  console.log('Test 19: ZOOM_CLASSES-disabled plan blocks online meeting links...');
  await prisma.instituteSubscription.create({
    data: {
      instituteId: instAId,
      planNameSnapshot: 'Timetable Yes Zoom No',
      priceSnapshot: 8000.00,
      currencySnapshot: 'LKR',
      durationSnapshot: 1,
      durationTypeSnapshot: 'MONTHS',
      featuresSnapshot: [
        { code: 'STUDENT_MANAGEMENT', name: 'Students' },
        { code: 'TIMETABLE', name: 'Timetable' },
        // No ZOOM_CLASSES
      ],
      limitsSnapshot: { classes: 10 },
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
    },
  });

  const zoomBlockedRes = await fetch(`${BASE_URL}/timetable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAToken}`,
    },
    body: JSON.stringify({
      academicYearId: year2026Id,
      classId: class10BId,
      subjectId: subIctId,
      dayOfWeek: 'TUESDAY',
      startTime: '14:00',
      endTime: '15:30',
      classType: 'ONLINE',
      meetingUrl: 'https://zoom.us/j/12345678',
    }),
  });
  const zoomBlockedData = await zoomBlockedRes.json();
  if (zoomBlockedRes.status !== 403 || zoomBlockedData.code !== 'FEATURE_NOT_INCLUDED') {
    throw new Error(`Zoom feature guard failed: ${JSON.stringify(zoomBlockedData)}`);
  }
  console.log('  ✅ Passed: Online Zoom link creation blocked with 403 FEATURE_NOT_INCLUDED.');

  // Restore Pro Subscription on Institute A
  await prisma.instituteSubscription.create({
    data: {
      instituteId: instAId,
      planNameSnapshot: 'Step5 Full Pro Restored',
      priceSnapshot: 15000.00,
      currencySnapshot: 'LKR',
      durationSnapshot: 1,
      durationTypeSnapshot: 'MONTHS',
      featuresSnapshot: fullFeatures,
      limitsSnapshot: { classes: 2, students: 50 }, // strict class limit = 2
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
    },
  });

  // -------------------------------------------------------------
  // Test 20: Class creation respects Step 4 classLimit
  // -------------------------------------------------------------
  console.log('Test 20: Class creation respects Step 4 classLimit (Limit: 2 classes, current: 2)...');
  const excessClassRes = await fetch(`${BASE_URL}/academic/classes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAToken}`,
    },
    body: JSON.stringify({
      name: 'Grade 11',
      section: 'A',
    }),
  });
  const excessClassData = await excessClassRes.json();
  if (excessClassRes.status !== 403 || excessClassData.code !== 'PLAN_LIMIT_REACHED') {
    throw new Error(`Class limit enforcement failed: ${JSON.stringify(excessClassData)}`);
  }
  console.log('  ✅ Passed: Class creation at limit blocked with 403 PLAN_LIMIT_REACHED.');

  // -------------------------------------------------------------
  // Test 21: Historical academic year data remains accessible
  // -------------------------------------------------------------
  console.log('Test 21: Historical academic years remain accessible...');
  const yearsRes = await fetch(`${BASE_URL}/academic/years`, {
    headers: { Authorization: `Bearer ${adminAToken}` },
  });
  const yearsData = await yearsRes.json();
  if (!yearsData.success || yearsData.data.length === 0) throw new Error('Historical years missing');
  console.log(`  ✅ Passed: Retrieved ${yearsData.data.length} academic years.`);

  // -------------------------------------------------------------
  // Test 22: Cross-Tenant Teacher Assignment Rejection
  // -------------------------------------------------------------
  console.log('Test 22: Security - Institute A attempts to assign Institute B teacher...');
  // Create teacher in Institute B via API
  const teachBRes = await fetch(`${BASE_URL}/teachers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminBToken}`,
    },
    body: JSON.stringify({
      name: 'Institute B Faculty',
      email: `tb_${suffix}@test.com`,
      employeeId: `TB-${suffix}`,
    }),
  });
  const teachBData = await teachBRes.json();
  const teachBId = teachBData.data.id;

  const crossTeacherRes = await fetch(`${BASE_URL}/academic/teacher-assignments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAToken}`,
    },
    body: JSON.stringify({
      classId: class10AId,
      subjectId: subMathId,
      teacherId: teachBId, // from Institute B!
    }),
  });
  if (crossTeacherRes.status !== 404) {
    throw new Error(`Cross-tenant teacher assignment was not rejected! Status: ${crossTeacherRes.status}`);
  }
  console.log('  ✅ Passed: Cross-tenant teacher assignment rejected with 404.');

  // -------------------------------------------------------------
  // Test 23: Cross-Tenant Student Enrollment Rejection
  // -------------------------------------------------------------
  console.log('Test 23: Security - Institute A attempts to bulk enroll Institute B student...');
  const studentBRes = await fetch(`${BASE_URL}/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminBToken}`,
    },
    body: JSON.stringify({
      firstName: 'Student',
      lastName: 'B',
      email: `sb_${suffix}@test.com`,
      admissionNumber: `ADM-B-${suffix}`,
    }),
  });
  const studentBData = await studentBRes.json();
  const studentBId = studentBData.data.id;

  const crossEnrollRes = await fetch(`${BASE_URL}/academic/enrollments/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAToken}`,
    },
    body: JSON.stringify({
      studentIds: [studentBId], // from Institute B!
      classId: class10AId,
    }),
  });
  if (crossEnrollRes.status !== 404) {
    throw new Error(`Cross-tenant student enrollment was not rejected! Status: ${crossEnrollRes.status}`);
  }
  console.log('  ✅ Passed: Cross-tenant student enrollment rejected with 404.');

  // -------------------------------------------------------------
  // Test 24: Cross-Tenant Subject Assignment Rejection
  // -------------------------------------------------------------
  console.log('Test 24: Security - Institute A attempts to attach Institute B subject...');
  const subjectBRes = await fetch(`${BASE_URL}/academic/subjects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminBToken}`,
    },
    body: JSON.stringify({
      name: 'Institute B Subject',
      code: `SUB_B_${suffix}`,
    }),
  });
  const subjectBData = await subjectBRes.json();
  const subjectBId = subjectBData.data.id;

  const crossSubMapRes = await fetch(`${BASE_URL}/academic/classes/${class10AId}/subjects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAToken}`,
    },
    body: JSON.stringify({
      subjectIds: [subjectBId], // from Institute B!
    }),
  });
  if (crossSubMapRes.status !== 404) {
    throw new Error(`Cross-tenant subject mapping was not rejected! Status: ${crossSubMapRes.status}`);
  }
  console.log('  ✅ Passed: Cross-tenant subject mapping rejected with 404.');

  // -------------------------------------------------------------
  // Test 25: Cross-Tenant Timetable Session Creation Rejection
  // -------------------------------------------------------------
  console.log('Test 25: Security - Institute A attempts to create session with Institute B class...');
  const classBRes = await fetch(`${BASE_URL}/academic/classes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminBToken}`,
    },
    body: JSON.stringify({
      name: 'Class B Only',
      section: 'B1',
    }),
  });
  const classBData = await classBRes.json();
  const classBId = classBData.data.id;

  const crossTtRes = await fetch(`${BASE_URL}/timetable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAToken}`,
    },
    body: JSON.stringify({
      classId: classBId, // from Institute B!
      subjectId: subMathId,
      dayOfWeek: 'WEDNESDAY',
      startTime: '08:00',
      endTime: '09:00',
    }),
  });
  if (crossTtRes.status !== 404) {
    throw new Error(`Cross-tenant timetable session creation was not rejected! Status: ${crossTtRes.status}`);
  }
  console.log('  ✅ Passed: Cross-tenant timetable session creation rejected with 404.');

  // -------------------------------------------------------------
  // Test 26: Fake frontend instituteId: 999 is ignored
  // -------------------------------------------------------------
  console.log('Test 26: Security - Frontend submits fake instituteId: 999...');
  const fakeRes = await fetch(`${BASE_URL}/academic/levels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAToken}`,
    },
    body: JSON.stringify({
      name: 'Fake Injection Level',
      code: `FAKE_${suffix}`,
      instituteId: 999, // Should be ignored by backend
    }),
  });
  const fakeData = await fakeRes.json();
  if (!fakeData.success || fakeData.data.instituteId !== instAId) {
    throw new Error(`Frontend instituteId was not overridden! ${JSON.stringify(fakeData)}`);
  }
  console.log(`  ✅ Passed: Record created with authenticated instituteId: ${fakeData.data.instituteId} (fake 999 ignored).`);

  // -------------------------------------------------------------
  // Test 27: Conflict Detection Isolation Between Tenants
  // -------------------------------------------------------------
  console.log('Test 27: Conflict Isolation - Same time slot in Institute B creates no false conflict...');
  const ttBRes = await fetch(`${BASE_URL}/timetable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminBToken}`,
    },
    body: JSON.stringify({
      classId: classBId,
      subjectId: subjectBId,
      dayOfWeek: 'MONDAY',
      startTime: '08:00', // Same time slot as Institute A
      endTime: '09:30',
      classType: 'PHYSICAL',
    }),
  });
  const ttBData = await ttBRes.json();
  if (!ttBData.success) {
    throw new Error(`Institute B session creation failed due to false cross-tenant conflict: ${JSON.stringify(ttBData)}`);
  }
  console.log('  ✅ Passed: Institute B session at same time succeeded without false cross-tenant conflict.');

  console.log('\n========================================================');
  console.log('🎉 ALL STEP 5 ACADEMIC & MULTI-TENANT TESTS PASSED 100%!');
  console.log('========================================================\n');
}

runStep5Tests().catch((err) => {
  console.error('\n❌ Step 5 Test Suite Failed:', err);
  process.exit(1);
});
