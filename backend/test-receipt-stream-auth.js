import prisma from './src/config/prisma.js';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ Test ${totalTests}: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ Test ${totalTests} FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runReceiptAuthVerification() {
  console.log('\n================================================================');
  console.log('  EDUNEXA: SUBSCRIPTION PAYMENT RECEIPT AUTH & SECURITY VERIFICATION');
  console.log('================================================================\n');

  const timeKey = Date.now();
  const receiptsDir = path.join(process.cwd(), 'uploads', 'receipts');
  if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
  }

  // 1. Create Super Admin User
  let superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', isActive: true },
  });
  if (!superAdmin) {
    superAdmin = await prisma.user.create({
      data: {
        username: `superadmin_${timeKey}`,
        email: `superadmin_${timeKey}@edunexa.com`,
        passwordHash: 'dummyhash',
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
  }

  // 2. Create Institute A & Admin A
  const instA = await prisma.institute.create({
    data: {
      name: `Receipt Test Campus A ${timeKey}`,
      slug: `receipt-campus-a-${timeKey}`,
      code: `RA${timeKey.toString().slice(-4)}`,
      email: `adminA_${timeKey}@test.com`,
      isActive: true,
    },
  });

  const adminA = await prisma.user.create({
    data: {
      username: `admin_a_${timeKey}`,
      email: `admin_a_${timeKey}@test.com`,
      passwordHash: 'dummyhash',
      role: 'ADMIN',
      instituteId: instA.id,
      isActive: true,
    },
  });

  // 3. Create Institute B & Admin B
  const instB = await prisma.institute.create({
    data: {
      name: `Receipt Test Campus B ${timeKey}`,
      slug: `receipt-campus-b-${timeKey}`,
      code: `RB${timeKey.toString().slice(-4)}`,
      email: `adminB_${timeKey}@test.com`,
      isActive: true,
    },
  });

  const adminB = await prisma.user.create({
    data: {
      username: `admin_b_${timeKey}`,
      email: `admin_b_${timeKey}@test.com`,
      passwordHash: 'dummyhash',
      role: 'ADMIN',
      instituteId: instB.id,
      isActive: true,
    },
  });

  // 4. Find or Create SubscriptionPlan & Subscription for Institute A
  let plan = await prisma.subscriptionPlan.findFirst({ where: { isActive: true } });
  if (!plan) {
    plan = await prisma.subscriptionPlan.create({
      data: {
        name: `Test Plan ${timeKey}`,
        price: 5000,
        currency: 'LKR',
        duration: 1,
        durationType: 'MONTHS',
      },
    });
  }

  const subA = await prisma.instituteSubscription.create({
    data: {
      instituteId: instA.id,
      planId: plan.id,
      planNameSnapshot: plan.name,
      priceSnapshot: plan.price,
      currencySnapshot: plan.currency,
      durationSnapshot: plan.duration,
      durationTypeSnapshot: plan.durationType,
      featuresSnapshot: JSON.stringify({ messaging: true }),
      limitsSnapshot: JSON.stringify({ maxStudents: 500 }),
      startDate: new Date(),
      status: 'PENDING_PAYMENT',
    },
  });

  // Create a real physical dummy PDF receipt file
  const testFileName = `test-receipt-${timeKey}.pdf`;
  const testFilePath = path.join(receiptsDir, testFileName);
  fs.writeFileSync(testFilePath, '%PDF-1.4 Mock Receipt PDF Document for Automated Testing');

  // Create SubscriptionPayment record
  const paymentA = await prisma.subscriptionPayment.create({
    data: {
      subscriptionId: subA.id,
      instituteId: instA.id,
      amount: 5000,
      currency: 'LKR',
      transferReference: `REF-${timeKey}`,
      transferDate: new Date(),
      receiptFile: testFileName,
      receiptOriginalName: 'Official_Deposit_Slip.pdf',
      receiptMimeType: 'application/pdf',
      status: 'PENDING',
    },
  });

  // Create JWT tokens
  const jwtSecret = process.env.JWT_SECRET || 'edunexa_secret';
  const tokenSuperAdmin = jwt.sign({ userId: superAdmin.id, role: superAdmin.role }, jwtSecret, { expiresIn: '1h' });
  const tokenAdminA = jwt.sign({ userId: adminA.id, role: adminA.role, instituteId: instA.id }, jwtSecret, { expiresIn: '1h' });
  const tokenAdminB = jwt.sign({ userId: adminB.id, role: adminB.role, instituteId: instB.id }, jwtSecret, { expiresIn: '1h' });

  // ============================================================================
  // TEST CASES
  // ============================================================================

  // Test 1: Raw browser request without Authorization header returns 401
  const res1 = await fetch(`http://localhost:5000/api/subscription/payments/${paymentA.id}/receipt`);
  assert(res1.status === 401, `Unauthenticated request correctly rejected with HTTP 401 (Status: ${res1.status})`);
  const json1 = await res1.json();
  assert(json1.success === false && json1.message.includes('Authentication required'), `Returned clear auth required message: "${json1.message}"`);

  // Test 2: Cross-tenant attack - Admin B attempts to access Institute A receipt
  const res2 = await fetch(`http://localhost:5000/api/subscription/payments/${paymentA.id}/receipt`, {
    headers: { Authorization: `Bearer ${tokenAdminB}` },
  });
  assert(res2.status === 403, `Cross-tenant access attempt by Admin B correctly blocked with HTTP 403 (Status: ${res2.status})`);
  const json2 = await res2.json();
  assert(json2.success === false && json2.message.includes('Access denied'), `Returned access denied message: "${json2.message}"`);

  // Test 3: Authorized Institute A Admin accesses own receipt
  const res3 = await fetch(`http://localhost:5000/api/subscription/payments/${paymentA.id}/receipt`, {
    headers: { Authorization: `Bearer ${tokenAdminA}` },
  });
  assert(res3.status === 200, `Authorized Institute Admin A receives HTTP 200 (Status: ${res3.status})`);
  const contentType3 = res3.headers.get('content-type');
  assert(contentType3 === 'application/pdf', `Content-Type is correctly set to application/pdf (Got: ${contentType3})`);
  const text3 = await res3.text();
  assert(text3.startsWith('%PDF-1.4'), 'Returned real binary PDF data.');

  // Test 4: Authorized Super Admin accesses Institute A receipt
  const res4 = await fetch(`http://localhost:5000/api/subscription/payments/${paymentA.id}/receipt`, {
    headers: { Authorization: `Bearer ${tokenSuperAdmin}` },
  });
  assert(res4.status === 200, `Authorized Super Admin receives HTTP 200 (Status: ${res4.status})`);
  const contentType4 = res4.headers.get('content-type');
  assert(contentType4 === 'application/pdf', `Content-Type is correctly set to application/pdf for Super Admin (Got: ${contentType4})`);

  // Test 5: Missing Physical File on Disk returns 404
  const missingFilePayment = await prisma.subscriptionPayment.create({
    data: {
      subscriptionId: subA.id,
      instituteId: instA.id,
      amount: 5000,
      currency: 'LKR',
      transferReference: `REF-MISSING-${timeKey}`,
      transferDate: new Date(),
      receiptFile: 'non_existent_file.pdf',
      receiptOriginalName: 'Missing.pdf',
      receiptMimeType: 'application/pdf',
      status: 'PENDING',
    },
  });

  const res5 = await fetch(`http://localhost:5000/api/subscription/payments/${missingFilePayment.id}/receipt`, {
    headers: { Authorization: `Bearer ${tokenAdminA}` },
  });
  assert(res5.status === 404, `Missing file on disk correctly returns HTTP 404 (Status: ${res5.status})`);
  const json5 = await res5.json();
  assert(json5.success === false && json5.message.includes('not found on disk'), `Returned clear missing file message: "${json5.message}"`);

  // Cleanup test file
  if (fs.existsSync(testFilePath)) {
    fs.unlinkSync(testFilePath);
  }

  console.log('\n================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} RECEIPT AUTH & SECURITY TESTS PASSED!`);
  console.log('================================================================\n');
}

await runReceiptAuthVerification();
await prisma.$disconnect();
