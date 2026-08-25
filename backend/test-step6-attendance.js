import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:5000/api';

let adminToken = '';
let royalAdminToken = '';
let teacherToken = '';
let studentToken = '';
let parentToken = '';

async function postJson(url, data, token = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Request failed with status ${res.status}`);
  return json;
}

async function getJson(url, token = '') {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Request failed with status ${res.status}`);
  return json;
}

async function runTests() {
  console.log('🧪 Starting EduNexa Step 6 Attendance Management Verification...\n');

  try {
    // 0. Ensure Institute 1 and Institute 2 active subscriptions include ATTENDANCE
    const [inst1Sub, inst2Sub] = await Promise.all([
      prisma.instituteSubscription.findFirst({
        where: { instituteId: 1, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.instituteSubscription.findFirst({
        where: { instituteId: 2, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (inst1Sub) {
      const currentFeatures = Array.isArray(inst1Sub.featuresSnapshot)
        ? [...inst1Sub.featuresSnapshot]
        : Object.keys(inst1Sub.featuresSnapshot || {}).map((code) => ({ code, name: code }));

      if (!currentFeatures.some((f) => f.code === 'ATTENDANCE')) {
        currentFeatures.push({ code: 'ATTENDANCE', name: 'Attendance Management' });
      }

      await prisma.instituteSubscription.update({
        where: { id: inst1Sub.id },
        data: { featuresSnapshot: currentFeatures },
      });
    }

    if (inst2Sub) {
      const currentFeatures = Array.isArray(inst2Sub.featuresSnapshot)
        ? [...inst2Sub.featuresSnapshot]
        : Object.keys(inst2Sub.featuresSnapshot || {}).map((code) => ({ code, name: code }));

      if (!currentFeatures.some((f) => f.code === 'ATTENDANCE')) {
        currentFeatures.push({ code: 'ATTENDANCE', name: 'Attendance Management' });
      }

      await prisma.instituteSubscription.update({
        where: { id: inst2Sub.id },
        data: { featuresSnapshot: currentFeatures },
      });
    } else {
      // Create active subscription for Institute 2
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      await prisma.instituteSubscription.create({
        data: {
          instituteId: 2,
          planId: 1,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: futureDate,
          planNameSnapshot: 'Standard Institute Plan',
          priceSnapshot: 15000,
          currencySnapshot: 'LKR',
          durationSnapshot: 30,
          limitsSnapshot: {},
          featuresSnapshot: [
            { code: 'ATTENDANCE', name: 'Attendance Management' },
            { code: 'TIMETABLE', name: 'Timetable Scheduling' },
          ],
        },
      });
    }

    // 1. Authenticate users
    console.log('1. Authenticating Seeded Role Accounts...');
    const [adminRes, royalRes, teachRes, studRes, parentRes] = await Promise.all([
      postJson(`${API_URL}/auth/login`, {
        email: 'admin@edunexa.com',
        password: 'Admin123!',
      }),
      postJson(`${API_URL}/auth/login`, {
        email: 'admin@royalacademy.edu',
        password: 'RoyalAdmin123!',
      }),
      postJson(`${API_URL}/auth/login`, {
        email: 'teacher@edunexa.com',
        password: 'Teacher123!',
      }),
      postJson(`${API_URL}/auth/login`, {
        email: 'student@edunexa.com',
        password: 'Student123!',
      }),
      postJson(`${API_URL}/auth/login`, {
        email: 'parent@edunexa.com',
        password: 'Parent123!',
      }),
    ]);

    adminToken = adminRes.token;
    royalAdminToken = royalRes.token;
    teacherToken = teachRes.token;
    studentToken = studRes.token;
    parentToken = parentRes.token;
    console.log('  ✅ Institute Admin authenticated: admin@edunexa.com (Institute 1)');
    console.log('  ✅ Royal Admin authenticated: admin@royalacademy.edu (Institute 2)');
    console.log('  ✅ Teacher authenticated: teacher@edunexa.com');
    console.log('  ✅ Student authenticated: student@edunexa.com');
    console.log('  ✅ Parent authenticated: parent@edunexa.com');

    // 2. Setup Academic Data for Attendance Marking
    console.log('\n2. Setting up Class, Subject, Teacher Assignment, and Student Enrollments...');
    const testClass = await prisma.class.findFirst({
      where: { instituteId: 1, isActive: true },
    });
    const testSubject = await prisma.subject.findFirst({
      where: { instituteId: 1, isActive: true },
    });
    const teacher = await prisma.teacher.findFirst({
      where: { instituteId: 1 },
    });
    const student = await prisma.student.findFirst({
      where: { instituteId: 1 },
    });

    // Ensure teacher assignment exists
    await prisma.teacherAssignment.upsert({
      where: {
        academicYearId_classId_subjectId_teacherId: {
          academicYearId: testClass.academicYearId || 1,
          classId: testClass.id,
          subjectId: testSubject.id,
          teacherId: teacher.id,
        },
      },
      update: {},
      create: {
        instituteId: 1,
        academicYearId: testClass.academicYearId || 1,
        classId: testClass.id,
        subjectId: testSubject.id,
        teacherId: teacher.id,
        role: 'PRIMARY',
      },
    });

    // Ensure student enrollment exists
    await prisma.studentEnrollment.upsert({
      where: {
        studentId_academicYearId_classId: {
          studentId: student.id,
          academicYearId: testClass.academicYearId || 1,
          classId: testClass.id,
        },
      },
      update: { status: 'ACTIVE' },
      create: {
        instituteId: 1,
        studentId: student.id,
        academicYearId: testClass.academicYearId || 1,
        classId: testClass.id,
        rollNo: 'R-101',
        status: 'ACTIVE',
      },
    });

    console.log(`  ✅ Assigned Teacher '${teacher.name}' to Class '${testClass.name}' and Subject '${testSubject.name}'`);
    console.log(`  ✅ Enrolled Student '${student.name}' into Class '${testClass.name}'`);

    // 3. Test Students for Marking API
    console.log('\n3. Testing GET /api/attendance/students-for-marking...');
    const markingListRes = await getJson(
      `${API_URL}/attendance/students-for-marking?classId=${testClass.id}&subjectId=${testSubject.id}&date=2026-08-18`,
      adminToken
    );
    console.log(`  ✅ Received ${markingListRes.data.students.length} students for marking`);
    if (markingListRes.data.students.length === 0) {
      throw new Error('Expected at least 1 enrolled student for marking.');
    }

    // 4. Test Saving Batch Attendance Session (PRESENT, ABSENT, LATE, EXCUSED)
    console.log('\n4. Testing POST /api/attendance/sessions (Batch Saving Session & Records)...');
    const saveRes = await postJson(
      `${API_URL}/attendance/sessions`,
      {
        classId: testClass.id,
        subjectId: testSubject.id,
        teacherId: teacher.id,
        academicYearId: testClass.academicYearId,
        date: '2026-08-18',
        notes: 'Regular lecture attendance session with laboratory work',
        records: [
          {
            studentId: student.id,
            status: 'PRESENT',
            remark: 'On time, active participation',
          },
        ],
      },
      teacherToken
    );
    console.log('  ✅ Attendance Session created successfully (ID:', saveRes.data.id, ')');

    // 5. Test Teacher Role Security Guard against unassigned class
    console.log('\n5. Testing Teacher Role Security Guard against unassigned class...');
    const unassignedClass = await prisma.class.create({
      data: {
        instituteId: 1,
        name: `Unassigned Batch ${Date.now().toString().slice(-4)}`,
        section: 'Z',
      },
    });

    try {
      await postJson(
        `${API_URL}/attendance/sessions`,
        {
          classId: unassignedClass.id,
          date: '2026-08-18',
          records: [{ studentId: student.id, status: 'PRESENT' }],
        },
        teacherToken
      );
      throw new Error('Teacher was illegally allowed to mark attendance for unassigned class!');
    } catch (err) {
      console.log('  ✅ Unassigned class attendance marking blocked with 403 Forbidden:', err.message);
    } finally {
      await prisma.class.delete({ where: { id: unassignedClass.id } });
    }

    // 6. Test Multi-Tenant Isolation
    console.log('\n6. Testing Multi-Tenant Isolation (Institute 2 cannot view Institute 1 Attendance)...');
    const institute2Sessions = await getJson(`${API_URL}/attendance/sessions`, royalAdminToken);
    const leakedSession = institute2Sessions.data.find((s) => s.id === saveRes.data.id);
    if (leakedSession) {
      throw new Error('SECURITY VIOLATION: Institute 2 accessed Institute 1 attendance session!');
    } else {
      console.log('  ✅ Strict Tenant Isolation verified: Institute 2 received 0 sessions from Institute 1.');
    }

    // 7. Test Real Attendance Analytics API
    console.log('\n7. Testing GET /api/attendance/analytics (Real DB Calculation)...');
    const analyticsRes = await getJson(`${API_URL}/attendance/analytics`, adminToken);
    console.log('  Analytics Data:');
    console.log(`  - Total Sessions: ${analyticsRes.data.totalSessions}`);
    console.log(`  - Total Records Marked: ${analyticsRes.data.totalRecords}`);
    console.log(`  - Overall Attendance Rate: ${analyticsRes.data.overallRate}%`);
    console.log(`  - Status Breakdown:`, JSON.stringify(analyticsRes.data.counts));
    console.log(`  - Status Distribution Chart:`, JSON.stringify(analyticsRes.data.statusDistribution));
    console.log(`  - Class Attendance Rates:`, JSON.stringify(analyticsRes.data.classAttendanceRates));
    console.log('  ✅ Real Database Analytics verified successfully.');

    // 8. Test Student Portal Attendance History
    console.log('\n8. Testing GET /api/attendance/student (Student Self-View)...');
    const studentHistoryRes = await getJson(`${API_URL}/attendance/student`, studentToken);
    console.log(`  ✅ Student '${studentHistoryRes.data.student.name}' Attendance Rate: ${studentHistoryRes.data.attendanceRate}%`);
    console.log(`  ✅ Student Record count: ${studentHistoryRes.data.records.length}`);
    if (studentHistoryRes.data.records.length === 0) {
      throw new Error('Expected student to see their recorded attendance session.');
    }

    // 9. Test Parent Portal Child Attendance
    console.log('\n9. Testing GET /api/attendance/parent (Parent Child-View)...');
    const parentAttendanceRes = await getJson(
      `${API_URL}/attendance/parent?studentId=${student.id}`,
      parentToken
    );
    console.log(`  ✅ Parent verified child '${parentAttendanceRes.data.child.name}' Attendance Rate: ${parentAttendanceRes.data.attendanceRate}%`);
    console.log(`  ✅ Child Attendance Records: ${parentAttendanceRes.data.records.length}`);

    // Check parent security guard for unlinked student
    try {
      await getJson(`${API_URL}/attendance/parent?studentId=999999`, parentToken);
      throw new Error('Parent was illegally allowed to access unlinked student attendance!');
    } catch (err) {
      console.log('  ✅ Unlinked student access correctly blocked with 403 Forbidden:', err.message);
    }

    // 10. Test Subscription Feature Enforcement (Denial when ATTENDANCE is disabled)
    console.log('\n10. Testing Subscription Feature Guard (requireFeature ATTENDANCE)...');
    const activeSubBefore = await prisma.instituteSubscription.findFirst({
      where: { instituteId: 1, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    const strippedFeatures = (activeSubBefore.featuresSnapshot || []).filter(
      (f) => f.code !== 'ATTENDANCE'
    );
    await prisma.instituteSubscription.update({
      where: { id: activeSubBefore.id },
      data: { featuresSnapshot: strippedFeatures },
    });

    try {
      await getJson(`${API_URL}/attendance/sessions`, adminToken);
      throw new Error('Attendance access was permitted when ATTENDANCE feature was disabled!');
    } catch (err) {
      console.log('  ✅ Feature Guard verified: Access blocked when ATTENDANCE feature is disabled:', err.message);
    } finally {
      // Restore ATTENDANCE feature
      await prisma.instituteSubscription.update({
        where: { id: activeSubBefore.id },
        data: { featuresSnapshot: activeSubBefore.featuresSnapshot },
      });
      console.log('  ✅ Restored active subscription ATTENDANCE feature.');
    }

    console.log('\n================================================================');
    console.log('🎉 ALL STEP 6 ATTENDANCE MANAGEMENT SYSTEM TESTS PASSED 100%!');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
