/**
 * Test Suite: Auth Session Hydration & Institute Logo Persistence
 * Verifies that institute branding persists cleanly across login, logout, re-login, and /auth/me hydration.
 */
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api';

async function runAuthLogoPersistenceTests() {
  console.log('🧪 Starting Auth Session Hydration & Institute Logo Persistence Test Suite...\n');
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

  // 1. Initial Login of Institute Admin
  console.log('1. Testing POST /api/auth/login Response Payload...');
  const loginRes1 = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@edunexa.com', password: 'Admin123!' }),
  });
  const loginData1 = await loginRes1.json();

  assert(loginData1.success, 'Login response successful');
  assert(loginData1.token !== undefined, 'Bearer token received');
  assert(loginData1.user && loginData1.user.role === 'ADMIN', 'User payload received with role ADMIN');
  assert(loginData1.institute !== null, 'Institute payload present in login response');
  assert(loginData1.institute.name !== undefined, 'Institute name present in login response');
  assert(loginData1.institute.code !== undefined, 'Institute code present in login response');
  assert('logo' in loginData1.institute, 'Institute logo field present in login response');
  assert('hasSignature' in loginData1.institute, 'hasSignature field present in login response');
  assert('hasStamp' in loginData1.institute, 'hasStamp field present in login response');
  assert('principalName' in loginData1.institute, 'principalName field present in login response');
  assert('website' in loginData1.institute, 'website field present in login response');
  assert('phone' in loginData1.institute, 'phone field present in login response');
  assert('email' in loginData1.institute, 'email field present in login response');
  assert('address' in loginData1.institute, 'address field present in login response');

  const token1 = loginData1.token;

  // 2. Testing GET /api/auth/me Session Hydration
  console.log('\n2. Testing GET /api/auth/me Hydration Payload...');
  const meRes1 = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const meData1 = await meRes1.json();

  assert(meData1.success, 'GET /auth/me response successful');
  assert(meData1.user && meData1.user.email === 'admin@edunexa.com', 'User correctly hydrated');
  assert(meData1.institute !== null, 'Institute branding correctly hydrated');
  assert(meData1.institute.code === loginData1.institute.code, 'Hydrated institute code matches login payload');
  assert(meData1.institute.logo === loginData1.institute.logo, 'Hydrated logo matches login payload');

  // 3. Upload a Custom Institute Logo
  console.log('\n3. Uploading Custom Logo & Verifying Immediate Persistence...');
  const samplePng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const blobLogo = new Blob([samplePng], { type: 'image/png' });
  const formLogo = new FormData();
  formLogo.append('file', blobLogo, 'custom_institute_logo.png');
  formLogo.append('type', 'logo');

  const upLogoRes = await fetch(`${BASE_URL}/portal/settings/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token1}` },
    body: formLogo,
  });
  const upLogoData = await upLogoRes.json();
  assert(upLogoData.success, 'Custom logo uploaded successfully');
  const uploadedLogoPath = upLogoData.data.logo;
  assert(uploadedLogoPath && uploadedLogoPath.startsWith('/uploads/branding/logos/public/'), 'Persistent public logo path generated');

  // 4. Verify /auth/me reflects the new logo during active session
  const meRes2 = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const meData2 = await meRes2.json();
  assert(meData2.institute.logo === uploadedLogoPath, 'GET /auth/me returns updated logo path');

  // 5. Simulate Logout & Login Again
  console.log('\n4. Testing Logout → Login Again Flow...');
  const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token1}` },
  });
  assert(logoutRes.status === 200, 'Logout endpoint succeeded');

  // Login Again with fresh session
  const loginRes2 = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@edunexa.com', password: 'Admin123!' }),
  });
  const loginData2 = await loginRes2.json();
  assert(loginData2.success, 'Re-login succeeded');
  assert(loginData2.institute.logo === uploadedLogoPath, 'Re-login returns exact same persistent custom logo');

  // Hydrate fresh session with /auth/me
  const meRes3 = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${loginData2.token}` },
  });
  const meData3 = await meRes3.json();
  assert(meData3.institute.logo === uploadedLogoPath, 'Fresh /auth/me session hydration retains custom logo');

  // 6. Test Multi-Role Institute Branding Resolution (Teacher, Student, Parent)
  console.log('\n5. Testing Multi-Role Institute Context Restoration...');
  
  // Teacher Login
  const teacherLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teacher@edunexa.com', password: 'Teacher123!' }),
  });
  const teacherData = await teacherLogin.json();
  assert(teacherData.success && teacherData.institute !== null, 'Teacher login contains linked institute branding');
  assert(teacherData.institute.logo === uploadedLogoPath, 'Teacher sees same institute logo');

  // Student Login
  const studentLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@edunexa.com', password: 'Student123!' }),
  });
  const studentData = await studentLogin.json();
  assert(studentData.success && studentData.institute !== null, 'Student login contains linked institute branding');
  assert(studentData.institute.logo === uploadedLogoPath, 'Student sees same institute logo');

  // Parent Login
  const parentLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'parent@edunexa.com', password: 'Parent123!' }),
  });
  const parentData = await parentLogin.json();
  assert(parentData.success && parentData.institute !== null, 'Parent login contains linked institute branding');
  assert(parentData.institute.logo === uploadedLogoPath, 'Parent sees same institute logo');

  // 7. Multi-Tenant Isolation: Tenant B Login
  console.log('\n6. Testing Multi-Tenant Branding Isolation...');
  const saLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@edunexa.com', password: 'SuperAdmin123!' }),
  });
  const superAdminToken = (await saLogin.json()).token;

  const codeC = `TC${Date.now().toString().slice(-4)}`;
  await fetch(`${BASE_URL}/super-admin/institutes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdminToken}` },
    body: JSON.stringify({
      name: `Tenant C Academy ${codeC}`,
      code: codeC,
      email: `admin_${codeC}@test.com`,
      adminEmail: `admin_${codeC}@test.com`,
      adminPassword: 'Password123!',
      adminUsername: `admin_${codeC}`,
    }),
  });

  const tenantCLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `admin_${codeC}@test.com`, password: 'Password123!' }),
  });
  const tenantCData = await tenantCLogin.json();
  assert(tenantCData.success, 'Tenant C login succeeded');
  assert(tenantCData.institute.code === codeC, 'Tenant C receives Tenant C code');
  assert(tenantCData.institute.logo === null, 'Tenant C without uploaded logo receives null logo (clean monogram fallback)');
  assert(tenantCData.institute.logo !== uploadedLogoPath, 'Tenant C does NOT receive Tenant A logo');

  console.log(`\n============================================================`);
  console.log(`🎉 ALL ${passedTests} OF ${totalTests} AUTH LOGO PERSISTENCE TESTS PASSED!`);
  console.log(`============================================================\n`);
}

runAuthLogoPersistenceTests().catch((err) => {
  console.error('\n❌ Test suite failed with error:', err);
  process.exit(1);
});
