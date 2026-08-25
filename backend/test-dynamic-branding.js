/**
 * Comprehensive Dynamic Institute Logo & Branding Test Suite
 * Tests all 20 required verification points including storage security and cross-tenant isolation.
 */
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:5000/api';
const STATIC_URL = 'http://localhost:5000';

// Minimal 1x1 valid PNG buffer helper
const createDummyPngBuffer = () => {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
};

// Create a mock multipart form body
const createMultipartFormData = (fieldname, filename, mimeType, buffer, extraFields = {}) => {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';
  let body = Buffer.from('');

  // Extra text fields
  for (const [key, value] of Object.entries(extraFields)) {
    const fieldHeader = `--${boundary}${crlf}Content-Disposition: form-data; name="${key}"${crlf}${crlf}${value}${crlf}`;
    body = Buffer.concat([body, Buffer.from(fieldHeader)]);
  }

  // File part
  const fileHeader = `--${boundary}${crlf}Content-Disposition: form-data; name="${fieldname}"; filename="${filename}"${crlf}Content-Type: ${mimeType}${crlf}${crlf}`;
  const fileFooter = `${crlf}--${boundary}--${crlf}`;

  body = Buffer.concat([body, Buffer.from(fileHeader), buffer, Buffer.from(fileFooter)]);

  return {
    boundary,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  };
};

async function runDynamicBrandingTests() {
  console.log('🧪 Starting EduNexa Dynamic Institute Branding & Security Test Suite...\n');
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
  // 1. Authenticate Seeded Accounts
  // -------------------------------------------------------------
  console.log('1. Authenticating Seeded Accounts...');

  // Super Admin
  const saRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@edunexa.com', password: 'SuperAdmin123!' }),
  });
  const saData = await saRes.json();
  assert(saData.success && saData.user.role === 'SUPER_ADMIN', 'Super Admin authentication');
  const superAdminToken = saData.token;

  // Institute A Admin (Demo Institute)
  const aRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@edunexa.com', password: 'Admin123!' }),
  });
  const aData = await aRes.json();
  assert(aData.success && aData.user.role === 'ADMIN', 'Institute A Admin authentication');
  const instAToken = aData.token;
  const instAId = aData.institute.id;

  // Teacher (Institute A)
  const tRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teacher@edunexa.com', password: 'Teacher123!' }),
  });
  const tData = await tRes.json();
  assert(tData.success && tData.user.role === 'TEACHER', 'Teacher authentication');
  const teacherToken = tData.token;

  // Student (Institute A)
  const sRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@edunexa.com', password: 'Student123!' }),
  });
  const sData = await sRes.json();
  assert(sData.success && sData.user.role === 'STUDENT', 'Student authentication');
  const studentToken = sData.token;

  // -------------------------------------------------------------
  // Test 1: Super Admin creates institute without logo (Clean Fallback)
  // -------------------------------------------------------------
  console.log('\n2. Testing Super Admin Institute Provisioning...');
  const uniqueCodeNoLogo = `TST${Date.now().toString().slice(-4)}`;
  const createNoLogoRes = await fetch(`${BASE_URL}/super-admin/institutes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      name: 'Alpha Horizon Institute',
      code: uniqueCodeNoLogo,
      email: `alpha_${uniqueCodeNoLogo}@test.com`,
      phone: '+94 11 999 0001',
      address: '100 Horizon Blvd, Colombo',
      website: 'https://alphahorizon.edu',
      principalName: 'Prof. Alan Vance',
      adminEmail: `admin_${uniqueCodeNoLogo}@test.com`,
      adminPassword: 'Password123!',
      adminUsername: `alpha_admin_${uniqueCodeNoLogo}`,
    }),
  });
  const createNoLogoData = await createNoLogoRes.json();
  assert(createNoLogoData.success, 'Super Admin creates institute without logo successfully');
  assert(createNoLogoData.data.logo === null, 'Institute logo is null (not hardcoded to fake demo logo)');
  assert(createNoLogoData.data.website === 'https://alphahorizon.edu', 'Institute website stored');
  assert(createNoLogoData.data.principalName === 'Prof. Alan Vance', 'Principal name stored');
  const instituteBId = createNoLogoData.data.id;

  // Login as Institute B Admin
  const bRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `admin_${uniqueCodeNoLogo}@test.com`, password: 'Password123!' }),
  });
  const bData = await bRes.json();
  assert(bData.success && bData.user.role === 'ADMIN', 'Institute B Admin authenticated');
  const instBToken = bData.token;

  // -------------------------------------------------------------
  // Test 2: Super Admin updates institute with custom branding & logo
  // -------------------------------------------------------------
  const dummyPng = createDummyPngBuffer();
  const saUploadForm = createMultipartFormData('file', 'sa-brand-logo.png', 'image/png', dummyPng, { type: 'logo' });
  const saUploadRes = await fetch(`${BASE_URL}/super-admin/institutes/${instituteBId}/upload`, {
    method: 'POST',
    headers: {
      ...saUploadForm.headers,
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: saUploadForm.body,
  });
  const saUploadData = await saUploadRes.json();
  assert(saUploadData.success, 'Super Admin uploads logo for Institute B');
  assert(saUploadData.data.logo && saUploadData.data.logo.includes('/uploads/branding/logos/public/'), 'Public logo path saved for Institute B');

  // -------------------------------------------------------------
  // Test 3: Institute Admin uploads own logo
  // -------------------------------------------------------------
  console.log('\n3. Testing Institute Admin Branding Uploads (Tenant A)...');
  const instALogoForm = createMultipartFormData('file', 'institute-a-logo.png', 'image/png', dummyPng, { type: 'logo' });
  const instALogoRes = await fetch(`${BASE_URL}/portal/settings/upload`, {
    method: 'POST',
    headers: {
      ...instALogoForm.headers,
      Authorization: `Bearer ${instAToken}`,
    },
    body: instALogoForm.body,
  });
  const instALogoData = await instALogoRes.json();
  assert(instALogoData.success, 'Institute A Admin uploads own logo');
  assert(instALogoData.data.logo && instALogoData.data.logo.includes('/uploads/branding/logos/public/'), 'Institute A logo saved in public folder');

  // -------------------------------------------------------------
  // Test 4: Institute Admin replaces own logo
  // -------------------------------------------------------------
  const instAReplaceForm = createMultipartFormData('file', 'institute-a-logo-v2.png', 'image/png', dummyPng, { type: 'logo' });
  const instAReplaceRes = await fetch(`${BASE_URL}/portal/settings/upload`, {
    method: 'POST',
    headers: {
      ...instAReplaceForm.headers,
      Authorization: `Bearer ${instAToken}`,
    },
    body: instAReplaceForm.body,
  });
  const instAReplaceData = await instAReplaceRes.json();
  assert(instAReplaceData.success, 'Institute A Admin replaces own logo successfully');

  // -------------------------------------------------------------
  // Test 5: Institute Admin uploads protected signature
  // -------------------------------------------------------------
  const instASigForm = createMultipartFormData('file', 'principal-signature.png', 'image/png', dummyPng, { type: 'signature' });
  const instASigRes = await fetch(`${BASE_URL}/portal/settings/upload`, {
    method: 'POST',
    headers: {
      ...instASigForm.headers,
      Authorization: `Bearer ${instAToken}`,
    },
    body: instASigForm.body,
  });
  const instASigData = await instASigRes.json();
  assert(instASigData.success, 'Institute A Admin uploads authorized principal signature');
  assert(instASigData.data.hasSignature === true, 'hasSignature is true');
  assert(instASigData.data.signatureUrl === '/api/portal/branding-assets/signature', 'Protected signature endpoint returned');

  // -------------------------------------------------------------
  // Test 6: Institute Admin uploads protected stamp
  // -------------------------------------------------------------
  const instAStampForm = createMultipartFormData('file', 'official-seal.png', 'image/png', dummyPng, { type: 'stamp' });
  const instAStampRes = await fetch(`${BASE_URL}/portal/settings/upload`, {
    method: 'POST',
    headers: {
      ...instAStampForm.headers,
      Authorization: `Bearer ${instAToken}`,
    },
    body: instAStampForm.body,
  });
  const instAStampData = await instAStampRes.json();
  assert(instAStampData.success, 'Institute A Admin uploads official stamp');
  assert(instAStampData.data.hasStamp === true, 'hasStamp is true');
  assert(instAStampData.data.stampUrl === '/api/portal/branding-assets/stamp', 'Protected stamp endpoint returned');

  // -------------------------------------------------------------
  // Test 7: Institute Admin removes logo
  // -------------------------------------------------------------
  const instARemoveLogoRes = await fetch(`${BASE_URL}/portal/settings/branding-asset/logo`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${instAToken}`,
    },
    body: JSON.stringify({ type: 'logo' }),
  });
  const instARemoveLogoData = await instARemoveLogoRes.json();
  assert(instARemoveLogoData.success, 'Institute A Admin removes own logo');
  assert(instARemoveLogoData.data.logo === null, 'Institute A logo is null after removal');

  // Re-upload logo for subsequent tests
  await fetch(`${BASE_URL}/portal/settings/upload`, {
    method: 'POST',
    headers: {
      ...instALogoForm.headers,
      Authorization: `Bearer ${instAToken}`,
    },
    body: instALogoForm.body,
  });

  // -------------------------------------------------------------
  // Test 8: Invalid MIME type rejected
  // -------------------------------------------------------------
  console.log('\n4. Testing Upload Validations & Rejections...');
  const fakeTxtBuffer = Buffer.from('this is not an image');
  const invalidMimeForm = createMultipartFormData('file', 'malicious.txt', 'text/plain', fakeTxtBuffer, { type: 'logo' });
  const invalidMimeRes = await fetch(`${BASE_URL}/portal/settings/upload`, {
    method: 'POST',
    headers: {
      ...invalidMimeForm.headers,
      Authorization: `Bearer ${instAToken}`,
    },
    body: invalidMimeForm.body,
  });
  assert(invalidMimeRes.status >= 400, 'Invalid MIME type (text/plain) rejected with 4xx error');

  // -------------------------------------------------------------
  // Test 9: Oversized file rejected (> 5MB)
  // -------------------------------------------------------------
  const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024, 0); // 6 MB
  const oversizedForm = createMultipartFormData('file', 'huge-image.png', 'image/png', oversizedBuffer, { type: 'logo' });
  const oversizedRes = await fetch(`${BASE_URL}/portal/settings/upload`, {
    method: 'POST',
    headers: {
      ...oversizedForm.headers,
      Authorization: `Bearer ${instAToken}`,
    },
    body: oversizedForm.body,
  });
  assert(oversizedRes.status >= 400, 'Oversized file (> 5MB) rejected with 4xx error');

  // -------------------------------------------------------------
  // Test 10: Teacher / Student / Parent cannot modify branding
  // -------------------------------------------------------------
  console.log('\n5. Testing RBAC Security & Non-Admin Modifications...');
  const teacherModRes = await fetch(`${BASE_URL}/portal/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({ name: 'Hacked by Teacher' }),
  });
  assert(teacherModRes.status === 403, 'Teacher cannot modify institute branding (403 Forbidden)');

  const studentModRes = await fetch(`${BASE_URL}/portal/settings/upload`, {
    method: 'POST',
    headers: {
      ...instALogoForm.headers,
      Authorization: `Bearer ${studentToken}`,
    },
    body: instALogoForm.body,
  });
  assert(studentModRes.status === 403, 'Student cannot upload institute branding (403 Forbidden)');

  // -------------------------------------------------------------
  // Test 11: Cross-Tenant Protection (Institute B Admin cannot modify Institute A)
  // -------------------------------------------------------------
  console.log('\n6. Testing Multi-Tenant Isolation & Cross-Tenant Attacks...');
  // Institute B tries to modify settings using its own token - it must only modify Institute B
  const instBSettingsRes = await fetch(`${BASE_URL}/portal/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${instBToken}`,
    },
    body: JSON.stringify({ name: 'Institute B Updated Name', website: 'https://b.edu' }),
  });
  const instBSettingsData = await instBSettingsRes.json();
  assert(instBSettingsData.success && instBSettingsData.data.id === instituteBId, 'Institute B Admin updates only Institute B');

  // Verify Institute A remains unaffected
  const checkAAfterB = await fetch(`${BASE_URL}/portal/settings`, {
    headers: { Authorization: `Bearer ${instAToken}` },
  });
  const checkAData = await checkAAfterB.json();
  assert(checkAData.data.id === instAId && checkAData.data.name !== 'Institute B Updated Name', 'Institute A data is isolated and untouched');

  // -------------------------------------------------------------
  // Test 12 & 13: Cross-Tenant Protected Asset Isolation
  // -------------------------------------------------------------
  // User A requests protected signature: Institute A has signature
  const instASigStreamRes = await fetch(`${BASE_URL}/portal/branding-assets/signature`, {
    headers: { Authorization: `Bearer ${instAToken}` },
  });
  assert(instASigStreamRes.status === 200, 'Institute A Admin can stream own protected signature');
  const sigContentType = instASigStreamRes.headers.get('content-type');
  assert(sigContentType && sigContentType.startsWith('image/'), 'Signature stream has valid image Content-Type');

  // User B requests protected signature: Institute B does NOT have signature uploaded -> returns 404 (Never leaks Institute A!)
  const instBSigStreamRes = await fetch(`${BASE_URL}/portal/branding-assets/signature`, {
    headers: { Authorization: `Bearer ${instBToken}` },
  });
  assert(instBSigStreamRes.status === 404, 'Institute B cannot access Institute A signature (returns 404 tenant isolation)');

  // Institute B stamp check
  const instBStampStreamRes = await fetch(`${BASE_URL}/portal/branding-assets/stamp`, {
    headers: { Authorization: `Bearer ${instBToken}` },
  });
  assert(instBStampStreamRes.status === 404, 'Institute B cannot access Institute A stamp (returns 404 tenant isolation)');

  // -------------------------------------------------------------
  // Test 14 & 15: Public Logo vs Protected Asset Storage Security
  // -------------------------------------------------------------
  console.log('\n7. Testing Static Asset Exposure & Protection...');
  // Public logo MUST be reachable via static URL
  const publicLogoUrl = `${STATIC_URL}${checkAData.data.logo}`;
  const publicLogoRes = await fetch(publicLogoUrl);
  assert(publicLogoRes.status === 200, 'Public logo is accessible via static URL path');

  // Protected signatures/stamps must NOT be accessible directly via public static route
  const protectedStaticSigRes = await fetch(`${STATIC_URL}/uploads/branding/protected/signatures/principal-signature.png`);
  assert(protectedStaticSigRes.status === 404, 'Protected signatures directory is NOT exposed via static Express middleware (404)');

  const protectedStaticStampRes = await fetch(`${STATIC_URL}/uploads/branding/protected/stamps/official-seal.png`);
  assert(protectedStaticStampRes.status === 404, 'Protected stamps directory is NOT exposed via static Express middleware (404)');

  // -------------------------------------------------------------
  // Test 16: Auth Profile & Portal Payloads Contain Dynamic Branding
  // -------------------------------------------------------------
  console.log('\n8. Testing Auth Payload & Invoices Dynamic Branding...');
  const meRes = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${instAToken}` },
  });
  const meData = await meRes.json();
  assert(meData.success && meData.institute.hasSignature === true, 'Auth /me contains hasSignature: true');
  assert(meData.institute.hasStamp === true, 'Auth /me contains hasStamp: true');
  assert(meData.institute.signatureUrl === '/api/portal/branding-assets/signature', 'Auth /me contains signatureUrl');

  // -------------------------------------------------------------
  // Test 17: Invoices contain dynamic institute tenant branding
  // -------------------------------------------------------------
  const invoicesRes = await fetch(`${BASE_URL}/fees/invoices`, {
    headers: { Authorization: `Bearer ${instAToken}` },
  });
  const invoicesData = await invoicesRes.json();
  assert(invoicesData.success && Array.isArray(invoicesData.data), 'Invoices retrieved');
  if (invoicesData.data.length > 0) {
    const inv = invoicesData.data[0];
    assert(inv.institute && inv.institute.id === instAId, 'Invoice includes dynamic institute relation');
  }

  // -------------------------------------------------------------
  // Test 18: Fallback verification for Institute with no logo
  // -------------------------------------------------------------
  const instBSettingsCheck = await fetch(`${BASE_URL}/portal/settings`, {
    headers: { Authorization: `Bearer ${instBToken}` },
  });
  const instBSettingsData2 = await instBSettingsCheck.json();
  // Remove logo if present to test fallback
  await fetch(`${BASE_URL}/portal/settings/branding-asset/logo`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instBToken}` },
    body: JSON.stringify({ type: 'logo' }),
  });
  const instBNoLogoRes = await fetch(`${BASE_URL}/portal/settings`, {
    headers: { Authorization: `Bearer ${instBToken}` },
  });
  const instBNoLogoData = await instBNoLogoRes.json();
  assert(instBNoLogoData.data.logo === null, 'Institute without logo has logo: null cleanly for fallback monogram');

  // -------------------------------------------------------------
  // Test 19 & 20: Missing signature/stamp does not crash queries
  // -------------------------------------------------------------
  assert(instBNoLogoData.data.hasSignature === false, 'Institute B hasSignature is false');
  assert(instBNoLogoData.data.hasStamp === false, 'Institute B hasStamp is false');
  assert(instBNoLogoData.data.signatureUrl === null, 'Institute B signatureUrl is null');

  console.log(`\n============================================================`);
  console.log(`🎉 ALL ${passedTests} OF ${totalTests} DYNAMIC BRANDING TESTS PASSED!`);
  console.log(`============================================================\n`);
}

runDynamicBrandingTests().catch((err) => {
  console.error('\n❌ Test suite failed with error:', err);
  process.exit(1);
});
