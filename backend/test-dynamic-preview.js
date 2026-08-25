/**
 * Test Suite: Dynamic Document Preview & Protected Signature/Stamp Blob Endpoints
 */
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api';

async function runDynamicPreviewTests() {
  console.log('🧪 Starting Dynamic Document Preview & Protected Assets Test Suite...\n');
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

  // 1. Authenticate Admin (Institute A)
  console.log('1. Authenticating Seeded Accounts...');
  const aLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@edunexa.com', password: 'Admin123!' }),
  });
  const aData = await aLogin.json();
  assert(aData.success && aData.user.role === 'ADMIN', 'Institute A Admin authenticated');
  const adminTokenA = aData.token;

  // Authenticate Super Admin to create Tenant B for cross-tenant checks
  const saLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@edunexa.com', password: 'SuperAdmin123!' }),
  });
  const saData = await saLogin.json();
  const superAdminToken = saData.token;

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

  // 2. Prepare Sample Image Buffers
  console.log('\n2. Testing Protected Asset Uploads...');
  // 1x1 transparent PNG buffer
  const samplePng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  // Upload Signature (Institute A)
  const blobSig = new Blob([samplePng], { type: 'image/png' });
  const formSig = new FormData();
  formSig.append('file', blobSig, 'test_signature.png');
  formSig.append('type', 'signature');

  const upSigRes = await fetch(`${BASE_URL}/portal/settings/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminTokenA}` },
    body: formSig,
  });
  const upSigData = await upSigRes.json();
  assert(upSigData.success && upSigData.data.hasSignature === true, 'Signature uploaded successfully (hasSignature = true)');

  // Upload Stamp (Institute A)
  const blobStamp = new Blob([samplePng], { type: 'image/png' });
  const formStamp = new FormData();
  formStamp.append('file', blobStamp, 'test_stamp.png');
  formStamp.append('type', 'stamp');

  const upStampRes = await fetch(`${BASE_URL}/portal/settings/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminTokenA}` },
    body: formStamp,
  });
  const upStampData = await upStampRes.json();
  assert(upStampData.success && upStampData.data.hasStamp === true, 'Stamp uploaded successfully (hasStamp = true)');

  // 3. Update Principal Name & Contact Info
  console.log('\n3. Testing Signatory and Profile Settings Persistence...');
  const updateSettingsRes = await fetch(`${BASE_URL}/portal/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminTokenA}` },
    body: JSON.stringify({
      principalName: 'Dr. Arthur Pendelton',
      website: 'https://demoacademy.edu',
      address: '123 Education Plaza',
      phone: '+1 (555) 234-5678',
      email: 'contact@demoacademy.edu',
    }),
  });
  const updateSettingsData = await updateSettingsRes.json();
  assert(updateSettingsData.success, 'Settings updated with real principalName and contact details');
  assert(updateSettingsData.data.principalName === 'Dr. Arthur Pendelton', 'Principal Name is Dr. Arthur Pendelton');
  assert(updateSettingsData.data.hasSignature === true, 'hasSignature is true in settings response');
  assert(updateSettingsData.data.hasStamp === true, 'hasStamp is true in settings response');

  // 4. Test Authenticated Blob Fetching
  console.log('\n4. Testing Authenticated Blob Endpoints...');

  // Unauthenticated GET Signature -> 401 Unauthorized
  const unauthSigRes = await fetch(`${BASE_URL}/portal/branding-assets/signature`);
  assert(unauthSigRes.status === 401, 'Unauthenticated request to signature endpoint returns 401 Unauthorized');

  // Authenticated GET Signature (Institute A) -> 200 with image/png
  const authSigRes = await fetch(`${BASE_URL}/portal/branding-assets/signature`, {
    headers: { Authorization: `Bearer ${adminTokenA}` },
  });
  assert(authSigRes.status === 200, 'Authenticated request to signature endpoint returns 200 OK');
  assert(authSigRes.headers.get('content-type').includes('image/'), 'Signature response returns valid image Content-Type');
  const sigBuffer = await authSigRes.arrayBuffer();
  assert(sigBuffer.byteLength > 0, 'Signature binary payload successfully received');

  // Unauthenticated GET Stamp -> 401 Unauthorized
  const unauthStampRes = await fetch(`${BASE_URL}/portal/branding-assets/stamp`);
  assert(unauthStampRes.status === 401, 'Unauthenticated request to stamp endpoint returns 401 Unauthorized');

  // Authenticated GET Stamp (Institute A) -> 200 with image/png
  const authStampRes = await fetch(`${BASE_URL}/portal/branding-assets/stamp`, {
    headers: { Authorization: `Bearer ${adminTokenA}` },
  });
  assert(authStampRes.status === 200, 'Authenticated request to stamp endpoint returns 200 OK');
  assert(authStampRes.headers.get('content-type').includes('image/'), 'Stamp response returns valid image Content-Type');
  const stampBuffer = await authStampRes.arrayBuffer();
  assert(stampBuffer.byteLength > 0, 'Stamp binary payload successfully received');

  // 5. Test Cross-Tenant Isolation
  console.log('\n5. Testing Cross-Tenant Security Isolation...');
  // Institute B Admin attempts to access Institute A Signature -> 404 Not Found
  const bSigRes = await fetch(`${BASE_URL}/portal/branding-assets/signature`, {
    headers: { Authorization: `Bearer ${adminTokenB}` },
  });
  assert(bSigRes.status === 404, 'Institute B cannot access Institute A signature (404 Not Found)');

  // Institute B Admin attempts to access Institute A Stamp -> 404 Not Found
  const bStampRes = await fetch(`${BASE_URL}/portal/branding-assets/stamp`, {
    headers: { Authorization: `Bearer ${adminTokenB}` },
  });
  assert(bStampRes.status === 404, 'Institute B cannot access Institute A stamp (404 Not Found)');

  // 6. Test Asset Removal & Fallback States
  console.log('\n6. Testing Asset Removal & Immediate Fallback State...');

  // Remove Signature
  const remSigRes = await fetch(`${BASE_URL}/portal/settings/branding-asset/signature`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminTokenA}` },
    body: JSON.stringify({ type: 'signature' }),
  });
  const remSigData = await remSigRes.json();
  assert(remSigData.success && remSigData.data.hasSignature === false, 'Signature removed (hasSignature = false)');

  // Verify Signature endpoint now returns 404 for Institute A
  const postRemSigRes = await fetch(`${BASE_URL}/portal/branding-assets/signature`, {
    headers: { Authorization: `Bearer ${adminTokenA}` },
  });
  assert(postRemSigRes.status === 404, 'Removed signature endpoint returns 404');

  // Remove Stamp
  const remStampRes = await fetch(`${BASE_URL}/portal/settings/branding-asset/stamp`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminTokenA}` },
    body: JSON.stringify({ type: 'stamp' }),
  });
  const remStampData = await remStampRes.json();
  assert(remStampData.success && remStampData.data.hasStamp === false, 'Stamp removed (hasStamp = false)');

  // Verify Stamp endpoint now returns 404 for Institute A
  const postRemStampRes = await fetch(`${BASE_URL}/portal/branding-assets/stamp`, {
    headers: { Authorization: `Bearer ${adminTokenA}` },
  });
  assert(postRemStampRes.status === 404, 'Removed stamp endpoint returns 404');

  console.log(`\n============================================================`);
  console.log(`🎉 ALL ${passedTests} OF ${totalTests} DYNAMIC PREVIEW & PROTECTED ASSET TESTS PASSED!`);
  console.log(`============================================================\n`);
}

runDynamicPreviewTests().catch((err) => {
  console.error('\n❌ Test suite failed with error:', err);
  process.exit(1);
});
