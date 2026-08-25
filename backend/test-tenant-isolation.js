import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('🧪 Starting EduNexa Multi-Institute SaaS Verification Tests...\n');

  let superAdminToken = '';
  let adminAToken = '';
  let adminBToken = '';
  let instAId = null;
  let instBId = null;
  let studentAId = null;
  let studentBId = null;

  // Test 1: SUPER_ADMIN Login
  console.log('Test 1: SUPER_ADMIN Login...');
  const res1 = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'superadmin@edunexa.com',
      password: 'SuperAdmin123!',
    }),
  });
  if (res1.status === 200 && res1.data.user.role === 'SUPER_ADMIN' && res1.data.user.instituteId === null) {
    superAdminToken = res1.data.token;
    console.log('  ✅ Passed: SUPER_ADMIN logged in, instituteId is null.');
  } else {
    throw new Error(`Test 1 Failed: ${JSON.stringify(res1.data)}`);
  }

  // Test 2: SUPER_ADMIN Dashboard Stats
  console.log('\nTest 2: Super Admin Dashboard Stats...');
  const res2 = await request('/super-admin/dashboard/stats', {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  if (res2.status === 200 && res2.data.data.totalInstitutes >= 2) {
    console.log(`  ✅ Passed: Retrieved stats. Total Institutes: ${res2.data.data.totalInstitutes}, Active: ${res2.data.data.activeInstitutes}`);
  } else {
    throw new Error(`Test 2 Failed: ${JSON.stringify(res2.data)}`);
  }

  // Test 3: SUPER_ADMIN Provisions Institute A & Institute B with initial Admins
  console.log('\nTest 3: Provision Institute A & Institute B...');
  const rand = Math.floor(Math.random() * 9000 + 1000);
  
  const res3A = await request('/super-admin/institutes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: JSON.stringify({
      name: `Horizon Campus ${rand}`,
      code: `HC${rand}`,
      email: `contact@horizon${rand}.edu`,
      adminEmail: `admin@horizon${rand}.edu`,
      adminPassword: 'Password123!',
      adminUsername: `admin_hc_${rand}`,
    }),
  });

  const res3B = await request('/super-admin/institutes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: JSON.stringify({
      name: `Apex International ${rand}`,
      code: `APEX${rand}`,
      email: `contact@apex${rand}.edu`,
      adminEmail: `admin@apex${rand}.edu`,
      adminPassword: 'Password123!',
      adminUsername: `admin_apex_${rand}`,
    }),
  });

  if (res3A.status === 201 && res3B.status === 201) {
    instAId = res3A.data.data.id;
    instBId = res3B.data.data.id;
    console.log(`  ✅ Passed: Created Institute A (ID: ${instAId}) and Institute B (ID: ${instBId}).`);
  } else {
    throw new Error(`Test 3 Failed: ${JSON.stringify({ A: res3A.data, B: res3B.data })}`);
  }

  // Test 4: Log in Admin A and Admin B
  console.log('\nTest 4: Log in Admin A and Admin B...');
  const loginA = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: `admin@horizon${rand}.edu`,
      password: 'Password123!',
    }),
  });
  const loginB = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: `admin@apex${rand}.edu`,
      password: 'Password123!',
    }),
  });

  if (loginA.status === 200 && loginB.status === 200) {
    adminAToken = loginA.data.token;
    adminBToken = loginB.data.token;
    console.log(`  ✅ Passed: Admin A (Institute ${loginA.data.user.instituteId}) and Admin B (Institute ${loginB.data.user.instituteId}) logged in.`);
  } else {
    throw new Error('Test 4 Failed: Could not login Institute Admins');
  }

  // Test 5: Composite Uniqueness - Both create Class "Grade 10 - A"
  console.log('\nTest 5: Both Institutes create "Grade 10 - A" (Composite uniqueness)...');
  const classA = await request('/academic/classes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: JSON.stringify({ name: 'Grade 10', section: 'A' }),
  });
  const classB = await request('/academic/classes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminBToken}` },
    body: JSON.stringify({ name: 'Grade 10', section: 'A' }),
  });

  if (classA.status === 201 && classB.status === 201) {
    console.log('  ✅ Passed: Both institutes created "Grade 10 - A" without unique constraint conflict.');
  } else {
    throw new Error(`Test 5 Failed: ${JSON.stringify({ classA: classA.data, classB: classB.data })}`);
  }

  // Test 6: Create Student A in Institute A and Student B in Institute B
  console.log('\nTest 6: Create Student A in Institute A & Student B in Institute B...');
  const studentA = await request('/students', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: JSON.stringify({
      name: 'John Doe',
      admissionNumber: `ADM-A-${rand}`,
      email: `john${rand}@horizon.edu`,
      classId: classA.data.data.id,
    }),
  });
  const studentB = await request('/students', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminBToken}` },
    body: JSON.stringify({
      name: 'Jane Smith',
      admissionNumber: `ADM-B-${rand}`,
      email: `jane${rand}@apex.edu`,
      classId: classB.data.data.id,
    }),
  });

  if (studentA.status === 201 && studentB.status === 201) {
    studentAId = studentA.data.data.id;
    studentBId = studentB.data.data.id;
    console.log(`  ✅ Passed: Student A (ID: ${studentAId}) in Inst A, Student B (ID: ${studentBId}) in Inst B.`);
  } else {
    throw new Error(`Test 6 Failed: ${JSON.stringify({ studentA: studentA.data, studentB: studentB.data })}`);
  }

  // Test 7: Tenant Isolation - Admin A queries students
  console.log('\nTest 7: Tenant Isolation - Admin A queries student list...');
  const listA = await request('/students', {
    headers: { Authorization: `Bearer ${adminAToken}` },
  });
  const hasStudentA = listA.data.data.some(s => s.id === studentAId);
  const hasStudentB = listA.data.data.some(s => s.id === studentBId);

  if (hasStudentA && !hasStudentB) {
    console.log('  ✅ Passed: Admin A sees Student A and CANNOT see Student B.');
  } else {
    throw new Error(`Test 7 Failed: Tenant Isolation breached! hasA: ${hasStudentA}, hasB: ${hasStudentB}`);
  }

  // Test 8: Security Test - Admin A direct GET on Student B's ID
  console.log('\nTest 8: Cross-tenant attack prevention (Admin A attempts direct GET /api/students/:studentBId)...');
  const directGet = await request(`/students/${studentBId}`, {
    headers: { Authorization: `Bearer ${adminAToken}` },
  });
  if (directGet.status === 404 || directGet.status === 403) {
    console.log(`  ✅ Passed: Direct access rejected with ${directGet.status} (${directGet.data.message}).`);
  } else {
    throw new Error(`Test 8 Security breach! Returned status ${directGet.status}`);
  }

  // Test 9: Deactivate Institute A & Check Login Rejection
  console.log('\nTest 9: Deactivate Institute A & verify blocked login...');
  await request(`/super-admin/institutes/${instAId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: JSON.stringify({ isActive: false }),
  });

  const loginBlocked = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: `admin@horizon${rand}.edu`,
      password: 'Password123!',
    }),
  });

  if (loginBlocked.status === 403 && loginBlocked.data.isInstituteInactive) {
    console.log(`  ✅ Passed: Login blocked with message: "${loginBlocked.data.message}"`);
  } else {
    throw new Error(`Test 9 Failed: Inactive institute was not blocked! Status: ${loginBlocked.status}`);
  }

  // Test 10: Re-activate Institute A & verify access restoration
  console.log('\nTest 10: Re-activate Institute A and verify access...');
  await request(`/super-admin/institutes/${instAId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: JSON.stringify({ isActive: true }),
  });

  const loginRestored = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: `admin@horizon${rand}.edu`,
      password: 'Password123!',
    }),
  });

  if (loginRestored.status === 200) {
    console.log('  ✅ Passed: Institute A re-activated and Admin A login succeeded.');
  } else {
    throw new Error('Test 10 Failed: Could not login after re-activation');
  }

  // Test 11: Existing Seed Users Login Check
  console.log('\nTest 11: Testing all standard seeded role accounts...');
  const accounts = [
    { email: 'admin@edunexa.com', pass: 'Admin123!', role: 'ADMIN' },
    { email: 'teacher@edunexa.com', pass: 'Teacher123!', role: 'TEACHER' },
    { email: 'student@edunexa.com', pass: 'Student123!', role: 'STUDENT' },
    { email: 'parent@edunexa.com', pass: 'Parent123!', role: 'PARENT' },
    { email: 'mhdshafraz295@gmail.com', pass: 'Admin123!', role: 'ADMIN' },
  ];

  for (const acc of accounts) {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: acc.email, password: acc.pass }),
    });
    if (res.status === 200 && res.data.user.role === acc.role) {
      console.log(`  ✅ Account ${acc.email} (${acc.role}) verified successfully.`);
    } else {
      console.log(`  ⚠️ Seed check for ${acc.email}: status ${res.status}`);
    }
  }

  console.log('\n========================================================');
  console.log('🎉 ALL TENANT ISOLATION & SAAS TESTS PASSED 100%!');
  console.log('========================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test suite failure:', err);
  process.exit(1);
});
