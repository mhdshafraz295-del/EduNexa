/**
 * Comprehensive Step A Role Portals & Cross-Role Data-Flow Verification Test Suite
 */
const BASE_URL = 'http://localhost:5000/api';

async function runStepAVerification() {
  console.log('🧪 Starting EduNexa Step A Comprehensive Role Portals Verification...\n');

  // =========================================================================
  // 1. Authenticate All Standard Seeded Accounts
  // =========================================================================
  console.log('1. Authenticating Seeded Role Accounts...');
  
  // Super Admin
  const saRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@edunexa.com', password: 'SuperAdmin123!' }),
  });
  const saData = await saRes.json();
  if (!saData.success || saData.user.role !== 'SUPER_ADMIN') throw new Error('Super Admin auth failed');
  const superAdminToken = saData.token;
  console.log(`  ✅ Super Admin: ${saData.user.email} (Role: ${saData.user.role})`);

  // Demo Admin
  const adminRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@edunexa.com', password: 'Admin123!' }),
  });
  const adminData = await adminRes.json();
  if (!adminData.success || adminData.user.role !== 'ADMIN') throw new Error('Admin auth failed');
  const adminToken = adminData.token;
  const demoInstituteId = adminData.institute.id;
  console.log(`  ✅ Institute Admin: ${adminData.user.email} (Institute ID: ${demoInstituteId}, Code: ${adminData.institute.code})`);

  // Demo Teacher
  const teacherRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teacher@edunexa.com', password: 'Teacher123!' }),
  });
  const teacherData = await teacherRes.json();
  if (!teacherData.success || teacherData.user.role !== 'TEACHER') throw new Error('Teacher auth failed');
  const teacherToken = teacherData.token;
  console.log(`  ✅ Teacher: ${teacherData.user.email} (Role: ${teacherData.user.role})`);

  // Demo Student
  const studentRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@edunexa.com', password: 'Student123!' }),
  });
  const studentData = await studentRes.json();
  if (!studentData.success || studentData.user.role !== 'STUDENT') throw new Error('Student auth failed');
  const studentToken = studentData.token;
  console.log(`  ✅ Student: ${studentData.user.email} (Role: ${studentData.user.role})`);

  // Demo Parent
  const parentRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'parent@edunexa.com', password: 'Parent123!' }),
  });
  const parentData = await parentRes.json();
  if (!parentData.success || parentData.user.role !== 'PARENT') throw new Error('Parent auth failed');
  const parentToken = parentData.token;
  console.log(`  ✅ Parent: ${parentData.user.email} (Role: ${parentData.user.role})`);

  // =========================================================================
  // 2. Cross-Portal Academic Data Flow Test (Section 9)
  // =========================================================================
  console.log('\n2. Testing Cross-Portal Unified Data Flow (Step 5 Flow across Portals)...');
  const suffix = Date.now().toString().slice(-4);

  // A. Admin creates Academic Year 2026
  const yrRes = await fetch(`${BASE_URL}/academic/years`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Academic Year 2026-${suffix}`,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      isCurrent: true,
    }),
  });
  const yrData = await yrRes.json();
  if (!yrData.success) throw new Error('Failed to create Academic Year: ' + JSON.stringify(yrData));
  const testYearId = yrData.data.id;
  console.log(`  ✅ Admin created Academic Year: 'Academic Year 2026-${suffix}' (ID: ${testYearId})`);

  // B. Admin creates Academic Level Grade 10
  const lvlRes = await fetch(`${BASE_URL}/academic/levels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Grade 10 Level ${suffix}`,
      code: `G10_${suffix}`,
      description: 'Secondary Education Grade 10',
    }),
  });
  const lvlData = await lvlRes.json();
  if (!lvlData.success) throw new Error('Failed to create Academic Level: ' + JSON.stringify(lvlData));
  const testLevelId = lvlData.data.id;
  console.log(`  ✅ Admin created Academic Level: 'Grade 10 Level ${suffix}' (ID: ${testLevelId})`);

  // C. Admin creates Class Grade 10-A
  const clsRes = await fetch(`${BASE_URL}/academic/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Grade 10-${suffix}`,
      section: 'A',
      academicLevelId: testLevelId,
      academicYearId: testYearId,
      medium: 'English',
      classType: 'PHYSICAL',
      capacity: 40,
    }),
  });
  const clsData = await clsRes.json();
  if (!clsData.success) throw new Error('Failed to create Class: ' + JSON.stringify(clsData));
  const testClassId = clsData.data.id;
  console.log(`  ✅ Admin created Class: 'Grade 10-${suffix} Section A' (ID: ${testClassId})`);

  // D. Admin creates Subject Mathematics & maps to Class
  const subRes = await fetch(`${BASE_URL}/academic/subjects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Mathematics ${suffix}`,
      code: `MATH_${suffix}`,
      description: 'Pure and Applied Mathematics',
      classId: testClassId,
    }),
  });
  const subData = await subRes.json();
  if (!subData.success) throw new Error('Failed to create Subject: ' + JSON.stringify(subData));
  const testSubjectId = subData.data.id;
  console.log(`  ✅ Admin created Subject: 'Mathematics ${suffix}' (ID: ${testSubjectId}) and mapped to Class`);

  // E. Get Teacher Record ID & Assign to Class & Subject
  const teachersRes = await fetch(`${BASE_URL}/teachers`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const teachersData = await teachersRes.json();
  const testTeacher = teachersData.data.find((t) => t.user?.email === 'teacher@edunexa.com') || teachersData.data[0];
  if (!testTeacher) throw new Error('No teacher found in demo institute');

  const assignRes = await fetch(`${BASE_URL}/academic/teacher-assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      academicYearId: testYearId,
      classId: testClassId,
      subjectId: testSubjectId,
      teacherId: testTeacher.id,
      role: 'PRIMARY',
    }),
  });
  const assignData = await assignRes.json();
  if (!assignData.success) throw new Error('Failed to create Teacher Assignment: ' + JSON.stringify(assignData));
  console.log(`  ✅ Admin assigned Teacher '${testTeacher.name}' to Class Grade 10-${suffix} and Subject Mathematics`);

  // F. Get Student Record ID & Enroll into Class Grade 10-A
  const studentsRes = await fetch(`${BASE_URL}/students`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const studentsData = await studentsRes.json();
  const testStudent = studentsData.data.find((s) => s.user?.email === 'student@edunexa.com') || studentsData.data[0];
  if (!testStudent) throw new Error('No student found in demo institute');

  const enrollRes = await fetch(`${BASE_URL}/academic/enrollments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      studentId: testStudent.id,
      academicYearId: testYearId,
      classId: testClassId,
      rollNo: `R-${suffix}`,
      status: 'ACTIVE',
    }),
  });
  const enrollData = await enrollRes.json();
  if (!enrollData.success) throw new Error('Failed to create Student Enrollment: ' + JSON.stringify(enrollData));
  console.log(`  ✅ Admin enrolled Student '${testStudent.name}' into Class Grade 10-${suffix} (Roll: R-${suffix})`);

  // G. Admin creates Timetable Session for Class & Teacher
  const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const todayDay = DAYS[new Date().getDay()];

  // Check if active subscription has ZOOM_CLASSES feature
  const entRes = await fetch(`${BASE_URL}/subscription/entitlement`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const entData = await entRes.json();
  const hasZoom = Boolean(entData.data?.features?.ZOOM_CLASSES);

  const ttPayload = {
    academicYearId: testYearId,
    classId: testClassId,
    subjectId: testSubjectId,
    teacherId: testTeacher.id,
    dayOfWeek: todayDay,
    startTime: '08:30',
    endTime: '09:45',
    classType: hasZoom ? 'ONLINE' : 'PHYSICAL',
    room: 'Room 101',
    ...(hasZoom && {
      meetingUrl: 'https://zoom.us/j/1234567890',
      meetingId: '123-456-7890',
      meetingPassword: 'Pass123',
    }),
  };

  const ttRes = await fetch(`${BASE_URL}/timetable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(ttPayload),
  });
  const ttData = await ttRes.json();
  if (!ttData.success) throw new Error('Failed to create Timetable Session: ' + JSON.stringify(ttData));
  console.log(`  ✅ Admin created Timetable Session: ${todayDay} 08:30-09:45 (Subject: Mathematics, Teacher: ${testTeacher.name}, ClassType: ${ttPayload.classType})`);

  // =========================================================================
  // 3. Verify Same Data across All Role Portals
  // =========================================================================
  console.log('\n3. Verifying Created Step 5 Data across Role Portals:');

  // A. Admin Portal Dashboard & Hub Verification
  const adminHubRes = await fetch(`${BASE_URL}/portal/dashboard`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminHubData = await adminHubRes.json();
  if (!adminHubData.success) throw new Error('Admin portal fetch failed');
  console.log(`  ✅ [ADMIN PORTAL]: Active Year is '${adminHubData.data.currentAcademicYear?.name}', Total Classes: ${adminHubData.data.counts.classes}, Today Sessions: ${adminHubData.data.counts.todaySessions}`);

  // B. Assigned Teacher Portal Verification
  const teacherDashRes = await fetch(`${BASE_URL}/portal/teacher/dashboard`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  const teacherDashData = await teacherDashRes.json();
  if (!teacherDashData.success) throw new Error('Teacher portal fetch failed');
  const teacherHasClass = teacherDashData.data.assignedClasses.some((c) => c.id === testClassId);
  const teacherHasSubject = teacherDashData.data.assignedSubjects.some((s) => s.id === testSubjectId);
  const teacherHasSession = teacherDashData.data.todaySessions.some((s) => s.subjectId === testSubjectId);
  if (!teacherHasClass || !teacherHasSubject || !teacherHasSession) {
    throw new Error(`Teacher portal missing assigned data: Class=${teacherHasClass}, Subject=${teacherHasSubject}, Session=${teacherHasSession}`);
  }
  console.log(`  ✅ [TEACHER PORTAL]: Teacher '${teacherDashData.data.teacher.name}' sees Grade 10-${suffix}, Mathematics ${suffix}, and ${todayDay} lecture period.`);

  // C. Enrolled Student Portal Verification
  const studentDashRes = await fetch(`${BASE_URL}/portal/student/dashboard`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const studentDashData = await studentDashRes.json();
  if (!studentDashData.success) throw new Error('Student portal fetch failed');
  const studentClassMatches = studentDashData.data.currentClass?.id === testClassId;
  const studentHasSubject = studentDashData.data.subjects.some((s) => s.id === testSubjectId);
  const studentHasSession = studentDashData.data.todaySessions.some((s) => s.subjectId === testSubjectId);
  if (!studentClassMatches || !studentHasSubject || !studentHasSession) {
    throw new Error(`Student portal missing enrolled data: Class=${studentClassMatches}, Subject=${studentHasSubject}, Session=${studentHasSession}`);
  }
  console.log(`  ✅ [STUDENT PORTAL]: Student '${studentDashData.data.student.name}' sees Grade 10-${suffix}, Mathematics ${suffix}, and Today's session.`);

  // D. Linked Parent Portal Verification
  const parentDashRes = await fetch(`${BASE_URL}/portal/parent/dashboard`, {
    headers: { Authorization: `Bearer ${parentToken}` },
  });
  const parentDashData = await parentDashRes.json();
  if (!parentDashData.success) throw new Error('Parent portal fetch failed');
  const linkedChild = parentDashData.data.children.find((c) => c.id === testStudent.id);
  if (!linkedChild) throw new Error('Linked child not found in parent dashboard');
  const parentSeesClass = linkedChild.currentClass?.id === testClassId;
  const parentSeesSubject = linkedChild.subjects.some((s) => s.id === testSubjectId);
  const parentSeesSession = linkedChild.todaySessions.some((s) => s.subjectId === testSubjectId);
  if (!parentSeesClass || !parentSeesSubject || !parentSeesSession) {
    throw new Error(`Parent portal missing child data: Class=${parentSeesClass}, Subject=${parentSeesSubject}, Session=${parentSeesSession}`);
  }
  console.log(`  ✅ [PARENT PORTAL]: Parent '${parentDashData.data.parent.name}' sees Child '${linkedChild.name}', Grade 10-${suffix}, Mathematics ${suffix}, and Timetable.`);

  // =========================================================================
  // 4. Cross-Role Security & Route Guards Verification (Section 13)
  // =========================================================================
  console.log('\n4. Verifying Cross-Role Security Enforcement:');

  // Teacher attempts to access Admin-only /api/super-admin or /api/portal/settings (PUT)
  const teacherToAdminRes = await fetch(`${BASE_URL}/portal/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({ name: 'Hacked Name' }),
  });
  if (teacherToAdminRes.status !== 403) throw new Error(`Teacher -> Admin expected 403, got ${teacherToAdminRes.status}`);
  console.log('  ✅ Teacher attempting Admin settings modification -> 403 FORBIDDEN (Blocked)');

  // Student attempts to create Timetable Session (Teacher/Admin only)
  const studentToTimetableRes = await fetch(`${BASE_URL}/timetable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ classId: testClassId, subjectId: testSubjectId }),
  });
  if (studentToTimetableRes.status !== 403) throw new Error(`Student -> Timetable creation expected 403, got ${studentToTimetableRes.status}`);
  console.log('  ✅ Student attempting Timetable creation -> 403 FORBIDDEN (Blocked)');

  // Parent attempts to create Teacher Assignment
  const parentToAssignRes = await fetch(`${BASE_URL}/academic/teacher-assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${parentToken}` },
    body: JSON.stringify({ classId: testClassId }),
  });
  if (parentToAssignRes.status !== 403) throw new Error(`Parent -> Academic assignment expected 403, got ${parentToAssignRes.status}`);
  console.log('  ✅ Parent attempting Teacher Assignment -> 403 FORBIDDEN (Blocked)');

  // Admin attempts to access Super Admin plans creation
  const adminToSuperAdminRes = await fetch(`${BASE_URL}/super-admin/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: 'Illegal Plan' }),
  });
  if (adminToSuperAdminRes.status !== 403) throw new Error(`Admin -> Super Admin expected 403, got ${adminToSuperAdminRes.status}`);
  console.log('  ✅ Admin attempting Super Admin Plan creation -> 403 FORBIDDEN (Blocked)');

  console.log('\n================================================================');
  console.log('🎉 ALL STEP A ROLE PORTALS & DATA FLOW TESTS PASSED 100%!');
  console.log('================================================================\n');
}

runStepAVerification().catch((err) => {
  console.error('❌ Step A Verification Failed:', err);
  process.exit(1);
});
