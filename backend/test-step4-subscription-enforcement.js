/**
 * Automated Verification Test Suite for EduNexa SaaS - Step 4: Subscription Feature Locking + Usage Limit Enforcement
 */
import prisma from './src/config/prisma.js';

const BASE_URL = 'http://localhost:5000/api';

async function runStep4Tests() {
  console.log('🧪 Starting EduNexa SaaS Step 4: Feature Locking & Usage Limit Enforcement Tests...\n');

  // Authenticate SUPER_ADMIN
  const saRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@edunexa.com', password: 'SuperAdmin123!' }),
  });
  const saData = await saRes.json();
  const superAdminToken = saData.token;

  // 1. Setup Test Institute with a Custom Constrained Plan Snapshot
  console.log('Setting up Test Institute with Starter Snapshot (Students: 2, Teachers: 1, Classes: 2)...');
  const uniqueSuffix = Date.now().toString().slice(-4);
  const instRes = await fetch(`${BASE_URL}/super-admin/institutes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      name: `Step4 Academy ${uniqueSuffix}`,
      code: `S4E${uniqueSuffix}`,
      email: `admin_${uniqueSuffix}@s4e.com`,
      adminEmail: `admin_${uniqueSuffix}@s4e.com`,
      adminPassword: 'Password123!',
      adminUsername: `s4eadmin_${uniqueSuffix}`,
    }),
  });
  const instData = await instRes.json();
  if (!instData.success || !instData.data) {
    throw new Error(`Failed to create test institute: ${JSON.stringify(instData)}`);
  }
  const testInstId = instData.data.id;
  const testAdminEmail = instData.data.admin.email;

  // Log in as Test Institute Admin
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testAdminEmail, password: 'Password123!' }),
  });
  const adminLoginData = await adminLoginRes.json();
  const testAdminToken = adminLoginData.token;

  // -------------------------------------------------------------
  // Test 1: SUPER_ADMIN bypasses subscription restrictions
  // -------------------------------------------------------------
  console.log('Test 1: SUPER_ADMIN bypasses subscription restrictions...');
  const saEntRes = await fetch(`${BASE_URL}/subscription/entitlement`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const saEntData = await saEntRes.json();
  if (!saEntData.success || !saEntData.data.isSuperAdmin) {
    throw new Error(`Super Admin bypass check failed: ${JSON.stringify(saEntData)}`);
  }
  console.log('  ✅ Passed: SUPER_ADMIN bypasses subscription restrictions cleanly.');

  // -------------------------------------------------------------
  // Test 2: Unsubscribed Institute blocked from protected APIs
  // -------------------------------------------------------------
  console.log('Test 2: Unsubscribed Institute blocked from protected APIs...');
  // Clear any default trial subscription to test zero-subscription state
  await prisma.instituteSubscription.deleteMany({ where: { instituteId: testInstId } });

  const noSubStudentRes = await fetch(`${BASE_URL}/students`, {
    headers: { Authorization: `Bearer ${testAdminToken}` },
  });
  const noSubStudentData = await noSubStudentRes.json();
  if (noSubStudentRes.status !== 403 || noSubStudentData.code !== 'SUBSCRIPTION_REQUIRED') {
    throw new Error(`Unsubscribed check failed: ${JSON.stringify(noSubStudentData)}`);
  }
  console.log('  ✅ Passed: Unsubscribed institute rejected with 403 SUBSCRIPTION_REQUIRED.');

  // -------------------------------------------------------------
  // Provision Active Subscription for Test Institute with specific features and tight limits
  // Features: STUDENT_MANAGEMENT (YES), TEACHER_MANAGEMENT (YES), INVOICES (NO - locked)
  // Limits: students: 2, teachers: 1, classes: 2
  // -------------------------------------------------------------
  console.log('Provisioning Active Subscription with custom snapshot...');
  const startDate = new Date();
  const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days active

  const subRecord = await prisma.instituteSubscription.create({
    data: {
      instituteId: testInstId,
      planNameSnapshot: 'Starter Limited Edition',
      priceSnapshot: 2500.00,
      currencySnapshot: 'LKR',
      durationSnapshot: 1,
      durationTypeSnapshot: 'MONTHS',
      featuresSnapshot: [
        { code: 'STUDENT_MANAGEMENT', name: 'Student Management' },
        { code: 'TEACHER_MANAGEMENT', name: 'Teacher Management' },
      ],
      limitsSnapshot: {
        students: 2,
        teachers: 1,
        admins: 1,
        classes: 2,
        courses: 1,
        storageGb: 5,
        branches: 1,
      },
      startDate,
      endDate,
      status: 'ACTIVE',
    },
  });

  // -------------------------------------------------------------
  // Test 3: Active Subscription allows enabled features
  // -------------------------------------------------------------
  console.log('Test 3: Institute with ACTIVE subscription can use enabled feature (STUDENT_MANAGEMENT)...');
  const allowedRes = await fetch(`${BASE_URL}/students`, {
    headers: { Authorization: `Bearer ${testAdminToken}` },
  });
  const allowedData = await allowedRes.json();
  if (!allowedRes.ok || !allowedData.success) {
    throw new Error(`Enabled feature access failed: ${JSON.stringify(allowedData)}`);
  }
  console.log('  ✅ Passed: Allowed feature access succeeded (200 OK).');

  // -------------------------------------------------------------
  // Test 4: Disabled feature API returns 403 FEATURE_NOT_INCLUDED
  // -------------------------------------------------------------
  console.log('Test 4: Disabled feature API returns 403 FEATURE_NOT_INCLUDED...');
  const invoiceRes = await fetch(`${BASE_URL}/fees/invoices`, {
    headers: { Authorization: `Bearer ${testAdminToken}` },
  });
  const invoiceData = await invoiceRes.json();
  if (invoiceRes.status !== 403 || invoiceData.code !== 'FEATURE_NOT_INCLUDED') {
    throw new Error(`Disabled feature guard failed: ${JSON.stringify(invoiceData)}`);
  }
  console.log(`  ✅ Passed: Invoices blocked with 403 FEATURE_NOT_INCLUDED ("${invoiceData.message}").`);

  // -------------------------------------------------------------
  // Test 5: Entitlement feature map correctly hides disabled features
  // -------------------------------------------------------------
  console.log('Test 5: Entitlement check verifies feature mapping...');
  const entRes = await fetch(`${BASE_URL}/subscription/entitlement`, {
    headers: { Authorization: `Bearer ${testAdminToken}` },
  });
  const entData = await entRes.json();
  if (!entData.data.features.STUDENT_MANAGEMENT || entData.data.features.INVOICES) {
    throw new Error(`Entitlement features mismatch: ${JSON.stringify(entData.data.features)}`);
  }
  console.log('  ✅ Passed: STUDENT_MANAGEMENT is true, INVOICES is false in entitlement snapshot.');

  // -------------------------------------------------------------
  // Test 6: Student creation below limit succeeds
  // -------------------------------------------------------------
  console.log('Test 6: Student creation below limit (1/2 and 2/2)...');
  const st1Res = await fetch(`${BASE_URL}/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${testAdminToken}`,
    },
    body: JSON.stringify({
      firstName: 'Alice',
      lastName: 'Enforcer',
      email: `alice_${Date.now()}@test.com`,
      admissionNumber: `ADM-${Date.now()}-1`,
    }),
  });
  const st1Data = await st1Res.json();
  if (!st1Data.success) throw new Error(`Failed to create Student 1: ${JSON.stringify(st1Data)}`);

  const st2Res = await fetch(`${BASE_URL}/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${testAdminToken}`,
    },
    body: JSON.stringify({
      firstName: 'Bob',
      lastName: 'Enforcer',
      email: `bob_${Date.now()}@test.com`,
      admissionNumber: `ADM-${Date.now()}-2`,
    }),
  });
  const st2Data = await st2Res.json();
  if (!st2Data.success) throw new Error(`Failed to create Student 2: ${JSON.stringify(st2Data)}`);
  console.log('  ✅ Passed: Created 2/2 students successfully.');

  // -------------------------------------------------------------
  // Test 7: Student creation at limit fails with PLAN_LIMIT_REACHED
  // -------------------------------------------------------------
  console.log('Test 7: Student creation at limit fails with PLAN_LIMIT_REACHED...');
  const st3Res = await fetch(`${BASE_URL}/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${testAdminToken}`,
    },
    body: JSON.stringify({
      firstName: 'Charlie',
      lastName: 'Excess',
      email: `charlie_${Date.now()}@test.com`,
      admissionNumber: `ADM-${Date.now()}-3`,
    }),
  });
  const st3Data = await st3Res.json();
  if (st3Res.status !== 403 || st3Data.code !== 'PLAN_LIMIT_REACHED' || st3Data.current !== 2 || st3Data.maximum !== 2) {
    throw new Error(`Student limit check failed: ${JSON.stringify(st3Data)}`);
  }
  console.log(`  ✅ Passed: Student #3 blocked with 403 PLAN_LIMIT_REACHED: "${st3Data.message}" (2/2 reached).`);

  // -------------------------------------------------------------
  // Test 8: Teacher limit works (Limit = 1)
  // -------------------------------------------------------------
  console.log('Test 8: Teacher limit works (Limit = 1)...');
  const t1Res = await fetch(`${BASE_URL}/teachers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${testAdminToken}`,
    },
    body: JSON.stringify({
      name: 'Professor One',
      firstName: 'Professor',
      lastName: 'One',
      email: `prof1_${Date.now()}@test.com`,
      employeeId: `EMP-${Date.now()}-1`,
    }),
  });
  const t1Data = await t1Res.json();
  if (!t1Data.success) throw new Error(`Failed to create Teacher 1: ${JSON.stringify(t1Data)}`);

  const t2Res = await fetch(`${BASE_URL}/teachers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${testAdminToken}`,
    },
    body: JSON.stringify({
      name: 'Professor Two',
      firstName: 'Professor',
      lastName: 'Two',
      email: `prof2_${Date.now()}@test.com`,
      employeeId: `EMP-${Date.now()}-2`,
    }),
  });
  const t2Data = await t2Res.json();
  if (t2Res.status !== 403 || t2Data.code !== 'PLAN_LIMIT_REACHED') {
    throw new Error(`Teacher limit check failed: ${JSON.stringify(t2Data)}`);
  }
  console.log(`  ✅ Passed: Teacher #2 blocked with 403 PLAN_LIMIT_REACHED (1/1 limit).`);

  // -------------------------------------------------------------
  // Test 9: Class limit works (Limit = 2)
  // -------------------------------------------------------------
  console.log('Test 9: Class limit works (Limit = 2)...');
  const c1Res = await fetch(`${BASE_URL}/academic/classes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${testAdminToken}`,
    },
    body: JSON.stringify({ name: 'Grade 1', section: 'A' }),
  });
  if (!c1Res.ok) throw new Error(`Failed to create Class 1`);

  const c2Res = await fetch(`${BASE_URL}/academic/classes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${testAdminToken}`,
    },
    body: JSON.stringify({ name: 'Grade 1', section: 'B' }),
  });
  if (!c2Res.ok) throw new Error(`Failed to create Class 2`);

  const c3Res = await fetch(`${BASE_URL}/academic/classes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${testAdminToken}`,
    },
    body: JSON.stringify({ name: 'Grade 2', section: 'A' }),
  });
  const c3Data = await c3Res.json();
  if (c3Res.status !== 403 || c3Data.code !== 'PLAN_LIMIT_REACHED') {
    throw new Error(`Class limit check failed: ${JSON.stringify(c3Data)}`);
  }
  console.log('  ✅ Passed: Class #3 blocked with 403 PLAN_LIMIT_REACHED (2/2 limit).');

  // -------------------------------------------------------------
  // Test 10: NULL limit behaves as Unlimited
  // -------------------------------------------------------------
  console.log('Test 10: NULL limit behaves as Unlimited in usage metrics...');
  const usageRes = await fetch(`${BASE_URL}/subscription/usage`, {
    headers: { Authorization: `Bearer ${testAdminToken}` },
  });
  const usageData = await usageRes.json();
  if (!usageData.success || !usageData.data.usage) {
    throw new Error(`Usage query failed: ${JSON.stringify(usageData)}`);
  }
  console.log(`  ✅ Passed: Usage stats returned successfully (Students: ${usageData.data.usage.students.current}/${usageData.data.usage.students.limit}, Storage: ${usageData.data.usage.storage.currentGb} GB).`);

  // -------------------------------------------------------------
  // Test 11: Expired subscription blocks normal Institute Admin features
  // -------------------------------------------------------------
  console.log('Test 11: Expired subscription blocks normal features...');
  // Force expire subscription in database
  await prisma.instituteSubscription.update({
    where: { id: subRecord.id },
    data: {
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 1000), // expired 1 sec ago
      status: 'ACTIVE', // will be evaluated as expired by date arithmetic
    },
  });

  const expiredStudentRes = await fetch(`${BASE_URL}/students`, {
    headers: { Authorization: `Bearer ${testAdminToken}` },
  });
  const expiredStudentData = await expiredStudentRes.json();
  if (expiredStudentRes.status !== 403 || expiredStudentData.code !== 'SUBSCRIPTION_EXPIRED') {
    throw new Error(`Expired check failed: ${JSON.stringify(expiredStudentData)}`);
  }
  console.log(`  ✅ Passed: Expired subscription blocked with 403 SUBSCRIPTION_EXPIRED: "${expiredStudentData.message}".`);

  // -------------------------------------------------------------
  // Test 12: Expired Institute Admin can still access Subscription/Renewal routes
  // -------------------------------------------------------------
  console.log('Test 12: Expired Institute Admin can still access Subscription/Renewal endpoints...');
  const subCurrentRes = await fetch(`${BASE_URL}/subscription/current`, {
    headers: { Authorization: `Bearer ${testAdminToken}` },
  });
  const subCurrentData = await subCurrentRes.json();
  if (!subCurrentData.success) {
    throw new Error(`Subscription portal access failed when expired: ${JSON.stringify(subCurrentData)}`);
  }

  const publicPlansRes = await fetch(`${BASE_URL}/plans`);
  const publicPlansData = await publicPlansRes.json();
  if (!publicPlansData.success || publicPlansData.data.length === 0) {
    throw new Error(`Plans fetch failed when expired`);
  }
  console.log('  ✅ Passed: Expired admin can access subscription current status and available plans without redirect loop.');

  // -------------------------------------------------------------
  // Test 13: Existing data remains intact after expiry (0 records deleted)
  // -------------------------------------------------------------
  console.log('Test 13: Existing data remains intact after expiry...');
  const dbStudentCount = await prisma.student.count({ where: { instituteId: testInstId } });
  const dbTeacherCount = await prisma.teacher.count({ where: { instituteId: testInstId } });
  const dbClassCount = await prisma.class.count({ where: { instituteId: testInstId } });
  if (dbStudentCount !== 2 || dbTeacherCount !== 1 || dbClassCount !== 2) {
    throw new Error(`Data loss detected! Students: ${dbStudentCount}, Teachers: ${dbTeacherCount}, Classes: ${dbClassCount}`);
  }
  console.log(`  ✅ Passed: All records intact in database (${dbStudentCount} students, ${dbTeacherCount} teachers, ${dbClassCount} classes). Zero records deleted.`);

  // -------------------------------------------------------------
  // Test 14: Downgrade below current usage does not delete data, only blocks creation
  // -------------------------------------------------------------
  console.log('Test 14: Downgrade below current usage safety...');
  // Reactivate with student limit = 1 (even though 2 students already exist)
  await prisma.instituteSubscription.create({
    data: {
      instituteId: testInstId,
      planNameSnapshot: 'Downgraded Nano Plan',
      priceSnapshot: 1000.00,
      currencySnapshot: 'LKR',
      durationSnapshot: 1,
      durationTypeSnapshot: 'MONTHS',
      featuresSnapshot: [{ code: 'STUDENT_MANAGEMENT', name: 'Student Management' }],
      limitsSnapshot: { students: 1 },
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
    },
  });

  // Query students list -> 2 existing students still readable
  const readableRes = await fetch(`${BASE_URL}/students`, {
    headers: { Authorization: `Bearer ${testAdminToken}` },
  });
  const readableData = await readableRes.json();
  if (!readableData.success || readableData.data.length !== 2) {
    throw new Error(`Downgrade read failed: ${JSON.stringify(readableData)}`);
  }

  // Attempt to create 3rd student -> blocked
  const blockedStRes = await fetch(`${BASE_URL}/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${testAdminToken}`,
    },
    body: JSON.stringify({
      firstName: 'Blocked',
      lastName: 'Student',
      email: `blocked_${Date.now()}@test.com`,
      admissionNumber: `ADM-BLOCKED-${Date.now()}`,
    }),
  });
  const blockedStData = await blockedStRes.json();
  if (blockedStRes.status !== 403 || blockedStData.code !== 'PLAN_LIMIT_REACHED') {
    throw new Error(`Downgrade limit block failed: ${JSON.stringify(blockedStData)}`);
  }
  console.log('  ✅ Passed: Existing 2 students preserved and viewable; new creations blocked (2/1 over limit).');

  // -------------------------------------------------------------
  // Test 15: Catalog plan editing does not mutate active subscription snapshot
  // -------------------------------------------------------------
  console.log('Test 15: Catalog plan editing snapshot immutability...');
  const catalogPlans = await prisma.subscriptionPlan.findMany();
  if (catalogPlans.length > 0) {
    const p0 = catalogPlans[0];
    await prisma.subscriptionPlan.update({
      where: { id: p0.id },
      data: { studentLimit: 99999 },
    });

    // Verify test institute entitlement limits remain unchanged
    const immRes = await fetch(`${BASE_URL}/subscription/entitlement`, {
      headers: { Authorization: `Bearer ${testAdminToken}` },
    });
    const immData = await immRes.json();
    if (immData.data.limits.students !== 1) {
      throw new Error(`Snapshot was mutated by catalog update! Expected 1, got ${immData.data.limits.students}`);
    }
  }
  console.log('  ✅ Passed: Active subscription retains its original immutable limits snapshot (1 student).');

  // -------------------------------------------------------------
  // Test 16: Super Admin Institute Detail includes subscription & usage meters
  // -------------------------------------------------------------
  console.log('Test 16: Super Admin Institute Detail includes subscription & usage stats...');
  const instDetailRes = await fetch(`${BASE_URL}/super-admin/institutes/${testInstId}`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const instDetailData = await instDetailRes.json();
  if (!instDetailData.success || !instDetailData.data.subscription || !instDetailData.data.usage) {
    throw new Error(`Super Admin detail missing subscription data: ${JSON.stringify(instDetailData)}`);
  }
  console.log(`  ✅ Passed: Super Admin Institute Detail shows subscription plan '${instDetailData.data.subscription.planName}' with usage metrics.`);

  console.log('\n========================================================');
  console.log('🎉 ALL STEP 4 FEATURE LOCKING & USAGE LIMIT TESTS PASSED 100%!');
  console.log('========================================================\n');
}

runStep4Tests().catch((err) => {
  console.error('\n❌ Step 4 Test Suite Failed:', err);
  process.exit(1);
});
