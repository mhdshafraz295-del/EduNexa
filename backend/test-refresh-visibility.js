/**
 * Verification Test Suite for Step 5 Data-Loading, Refresh & Visibility Fixes
 */
import prisma from './src/config/prisma.js';

const BASE_URL = 'http://localhost:5000/api';

async function runRefreshVisibilityTests() {
  console.log('🧪 Starting EduNexa Step 5 Data Refresh & Visibility Verification Tests...\n');

  // Authenticate SUPER_ADMIN
  const saRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@edunexa.com', password: 'SuperAdmin123!' }),
  });
  const saData = await saRes.json();
  const superAdminToken = saData.token;

  const suffix = Date.now().toString().slice(-4);
  console.log(`Setting up Test Institute (Suffix: ${suffix})...`);

  const instRes = await fetch(`${BASE_URL}/super-admin/institutes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      name: `Visibility Academy ${suffix}`,
      code: `VIS${suffix}`,
      email: `admin_vis_${suffix}@test.com`,
      adminEmail: `admin_vis_${suffix}@test.com`,
      adminPassword: 'Password123!',
      adminUsername: `vis_admin_${suffix}`,
    }),
  });
  const instData = await instRes.json();
  const instId = instData.data.id;
  const adminEmail = instData.data.admin.email;

  // Log in Admin
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: 'Password123!' }),
  });
  const adminToken = (await loginRes.json()).token;

  // Active Subscription
  await prisma.instituteSubscription.create({
    data: {
      instituteId: instId,
      planNameSnapshot: 'Visibility Test Pro',
      priceSnapshot: 15000.00,
      currencySnapshot: 'LKR',
      durationSnapshot: 1,
      durationTypeSnapshot: 'MONTHS',
      featuresSnapshot: [
        { code: 'STUDENT_MANAGEMENT', name: 'Students' },
        { code: 'TEACHER_MANAGEMENT', name: 'Teachers' },
        { code: 'TIMETABLE', name: 'Timetable' },
        { code: 'ZOOM_CLASSES', name: 'Zoom Classes' },
      ],
      limitsSnapshot: { students: 100, teachers: 50, classes: 20 },
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
    },
  });

  // 1. Create Academic Year and verify immediate appearance in GET /academic/years
  console.log('1. Testing Academic Year creation & immediate GET visibility...');
  const createYrRes = await fetch(`${BASE_URL}/academic/years`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `2026/2027-${suffix}`,
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      isCurrent: true,
      status: 'ACTIVE',
    }),
  });
  const yrCreated = await createYrRes.json();
  if (!yrCreated.success || !yrCreated.data?.id) throw new Error('Create Year failed');

  const getYrRes = await fetch(`${BASE_URL}/academic/years`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const getYrData = await getYrRes.json();
  const foundYear = getYrData.data.find((y) => y.id === yrCreated.data.id);
  if (!foundYear) throw new Error('Created year not visible in GET /academic/years');
  console.log(`  ✅ Academic Year visible immediately (ID: ${foundYear.id}, isCurrent: ${foundYear.isCurrent}).`);

  // 2. Create Academic Level and verify immediate appearance in GET /academic/levels
  console.log('2. Testing Academic Level creation & immediate GET visibility...');
  const createLvlRes = await fetch(`${BASE_URL}/academic/levels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Advanced Level Maths',
      code: `ALM_${suffix}`,
      description: 'G.C.E. Advanced Level Physical Science Stream',
      displayOrder: 1,
    }),
  });
  const lvlCreated = await createLvlRes.json();
  if (!lvlCreated.success || !lvlCreated.data?.id) throw new Error('Create Level failed');

  const getLvlRes = await fetch(`${BASE_URL}/academic/levels`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const getLvlData = await getLvlRes.json();
  const foundLvl = getLvlData.data.find((l) => l.id === lvlCreated.data.id);
  if (!foundLvl) throw new Error('Created level not visible in GET /academic/levels');
  console.log(`  ✅ Academic Level visible immediately (ID: ${foundLvl.id}, code: ${foundLvl.code}).`);

  // 3. Create Class and verify immediate appearance in GET /academic/classes
  console.log('3. Testing Class creation with full relation payload & GET visibility...');
  const createClsRes = await fetch(`${BASE_URL}/academic/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'AL 2026 Batch',
      section: 'Combined Maths',
      academicLevelId: foundLvl.id,
      academicYearId: foundYear.id,
      medium: 'English',
      classType: 'PHYSICAL',
      capacity: 50,
    }),
  });
  const clsCreated = await createClsRes.json();
  if (!clsCreated.success || !clsCreated.data?.id) throw new Error('Create Class failed');
  if (!clsCreated.data.academicLevel || !clsCreated.data.academicYear) {
    throw new Error('Class response missing nested relation payload');
  }

  const getClsRes = await fetch(`${BASE_URL}/academic/classes`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const getClsData = await getClsRes.json();
  const foundCls = getClsData.data.find((c) => c.id === clsCreated.data.id);
  if (!foundCls) throw new Error('Created class not visible in GET /academic/classes');
  console.log(`  ✅ Class visible immediately with full relations (ID: ${foundCls.id}, name: ${foundCls.name}).`);

  // 4. Create Subject & Assign to Class and verify in GET /academic/subjects
  console.log('4. Testing Subject creation with classId assignment & GET visibility...');
  const createSubRes = await fetch(`${BASE_URL}/academic/subjects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Combined Mathematics',
      code: `CMATH_${suffix}`,
      classId: foundCls.id,
    }),
  });
  const subCreated = await createSubRes.json();
  if (!subCreated.success || !subCreated.data?.id) throw new Error('Create Subject failed');

  const getSubRes = await fetch(`${BASE_URL}/academic/subjects`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const getSubData = await getSubRes.json();
  const foundSub = getSubData.data.find((s) => s.id === subCreated.data.id);
  if (!foundSub) throw new Error('Created subject not visible in GET /academic/subjects');
  console.log(`  ✅ Subject visible immediately (ID: ${foundSub.id}, Code: ${foundSub.code}).`);

  // 5. Create Teacher & Teacher Assignment and verify in GET /academic/teacher-assignments
  console.log('5. Testing Teacher Assignment creation & GET visibility...');
  const createTchRes = await fetch(`${BASE_URL}/teachers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Eng. Bandara',
      email: `bandara_${suffix}@test.com`,
      employeeId: `EMP-${suffix}`,
    }),
  });
  const tchCreated = await createTchRes.json();
  const teacherId = tchCreated.data.id;

  const createAsgRes = await fetch(`${BASE_URL}/academic/teacher-assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      academicYearId: foundYear.id,
      classId: foundCls.id,
      subjectId: foundSub.id,
      teacherId,
      role: 'PRIMARY',
    }),
  });
  const asgCreated = await createAsgRes.json();
  if (!asgCreated.success || !asgCreated.data?.id) throw new Error('Create Assignment failed');

  const getAsgRes = await fetch(`${BASE_URL}/academic/teacher-assignments`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const getAsgData = await getAsgRes.json();
  const foundAsg = getAsgData.data.find((a) => a.id === asgCreated.data.id);
  if (!foundAsg) throw new Error('Created teacher assignment not visible in GET');
  console.log(`  ✅ Teacher Assignment visible immediately (ID: ${foundAsg.id}, Role: ${foundAsg.role}).`);

  // 6. Create Student & Bulk Enroll and verify in GET /academic/enrollments
  console.log('6. Testing Student Bulk Enrollment & GET visibility...');
  const createStRes = await fetch(`${BASE_URL}/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      firstName: 'Kavindu',
      lastName: 'Perera',
      email: `kavindu_${suffix}@test.com`,
      admissionNumber: `ADM-${suffix}`,
    }),
  });
  const stCreated = await createStRes.json();
  const studentId = stCreated.data.id;

  const bulkRes = await fetch(`${BASE_URL}/academic/enrollments/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      studentIds: [studentId],
      classId: foundCls.id,
      academicYearId: foundYear.id,
    }),
  });
  const bulkData = await bulkRes.json();
  if (!bulkData.success || bulkData.enrolledCount !== 1) throw new Error('Bulk Enroll failed');

  const getEnrRes = await fetch(`${BASE_URL}/academic/enrollments?classId=${foundCls.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const getEnrData = await getEnrRes.json();
  const foundEnr = getEnrData.data.find((e) => e.studentId === studentId);
  if (!foundEnr) throw new Error('Enrolled student not visible in GET /academic/enrollments');
  console.log(`  ✅ Student Enrollment visible immediately (ID: ${foundEnr.id}, Student: ${foundEnr.student?.firstName}).`);

  // 7. Create Timetable Session and verify in GET /timetable
  console.log('7. Testing Timetable Session creation & GET visibility...');
  const createTtRes = await fetch(`${BASE_URL}/timetable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      academicYearId: foundYear.id,
      classId: foundCls.id,
      subjectId: foundSub.id,
      teacherId,
      dayOfWeek: 'TUESDAY',
      startTime: '08:00',
      endTime: '10:00',
      classType: 'ONLINE',
      meetingUrl: 'https://zoom.us/j/9988776655',
    }),
  });
  const ttCreated = await createTtRes.json();
  if (!ttCreated.success || !ttCreated.data?.id) throw new Error('Create Timetable Session failed');

  const getTtRes = await fetch(`${BASE_URL}/timetable`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const getTtData = await getTtRes.json();
  const foundTt = getTtData.data.find((t) => t.id === ttCreated.data.id);
  if (!foundTt) throw new Error('Created timetable session not visible in GET /timetable');
  console.log(`  ✅ Timetable Session visible immediately (ID: ${foundTt.id}, Day: ${foundTt.dayOfWeek}, Time: ${foundTt.startTime}-${foundTt.endTime}).`);

  console.log('\n================================================================');
  console.log('🎉 ALL DATA-LOADING, REFRESH & VISIBILITY TESTS PASSED 100%!');
  console.log('================================================================\n');
}

runRefreshVisibilityTests().catch((err) => {
  console.error('\n❌ Refresh & Visibility Test Suite Failed:', err);
  process.exit(1);
});
