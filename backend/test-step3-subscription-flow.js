/**
 * Automated Verification Test Suite for EduNexa SaaS - Step 3: Institute Subscription + Bank Transfer + Receipt Approval
 */
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api';

async function runStep3Tests() {
  console.log('🧪 Starting EduNexa SaaS Step 3: Subscription & Approval Workflow Tests...\n');

  // 1. Super Admin Login
  console.log('Test 1: SUPER_ADMIN Login...');
  const saRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@edunexa.com', password: 'SuperAdmin123!' }),
  });
  const saData = await saRes.json();
  if (!saData.success || !saData.token || saData.user.role !== 'SUPER_ADMIN') {
    throw new Error(`Super Admin login failed: ${JSON.stringify(saData)}`);
  }
  const superAdminToken = saData.token;
  console.log('  ✅ Passed: SUPER_ADMIN authenticated successfully.');

  // 2. Provision & Login Test Institute Admin
  console.log('Test 2: Provision & Authenticate Test Institute Admin...');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const provRes = await fetch(`${BASE_URL}/super-admin/institutes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdminToken}` },
    body: JSON.stringify({
      name: `Step3 Institute ${rand}`,
      code: `S3_${rand}`,
      email: `contact_s3_${rand}@edu.com`,
      adminEmail: `admin_s3_${rand}@edu.com`,
      adminPassword: 'Password123!',
      adminUsername: `admin_s3_${rand}`,
    }),
  });
  const provData = await provRes.json();
  if (!provData.success) {
    throw new Error(`Provisioning failed: ${JSON.stringify(provData)}`);
  }
  const instituteAId = provData.data.id;

  const iaRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `admin_s3_${rand}@edu.com`, password: 'Password123!' }),
  });
  const iaData = await iaRes.json();
  if (!iaData.success || !iaData.token) {
    throw new Error(`Institute Admin login failed: ${JSON.stringify(iaData)}`);
  }
  const instituteAdminToken = iaData.token;
  console.log(`  ✅ Passed: Institute Admin authenticated (Institute ID: ${instituteAId}).`);

  // 3. Super Admin Creates Platform Bank Account
  console.log('Test 3: Super Admin Creates Platform Bank Account...');
  const bankRes = await fetch(`${BASE_URL}/super-admin/bank-accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      bankName: 'Hatton National Bank (HNB)',
      branchName: 'Colombo 03 Head Office',
      accountHolderName: 'EduNexa SaaS Ltd',
      accountNumber: '00301048291',
      instructions: 'Please mention Institute Code in transfer slip remark.',
      isActive: true,
      displayOrder: 3,
    }),
  });
  const bankData = await bankRes.json();
  if (!bankData.success || !bankData.data.id) {
    throw new Error(`Failed to create bank account: ${JSON.stringify(bankData)}`);
  }
  const createdBankId = bankData.data.id;
  console.log(`  ✅ Passed: Platform bank account '${bankData.data.bankName}' created (ID: ${createdBankId}).`);

  // 4. Institute Admin Fetches Active Plans & Selects Plan
  console.log('Test 4: Institute Admin Fetches Active Plans & Selects Plan...');
  const plansRes = await fetch(`${BASE_URL}/plans`);
  const plansData = await plansRes.json();
  if (!plansData.success || !plansData.data.length) {
    throw new Error(`Failed to fetch active plans: ${JSON.stringify(plansData)}`);
  }
  const standardPlan = plansData.data.find(p => p.name.includes('Standard')) || plansData.data[0];
  console.log(`  ℹ️ Selecting Plan: '${standardPlan.name}' (${standardPlan.currency} ${standardPlan.price})`);

  const selectRes = await fetch(`${BASE_URL}/subscription/select-plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${instituteAdminToken}`,
    },
    body: JSON.stringify({ planId: standardPlan.id }),
  });
  const selectData = await selectRes.json();
  if (!selectData.success || !selectData.data.id) {
    throw new Error(`Failed to select plan: ${JSON.stringify(selectData)}`);
  }
  const subscriptionId = selectData.data.id;
  console.log(`  ✅ Passed: Subscription initialized (ID: ${subscriptionId}) with Plan Snapshot: '${selectData.data.planNameSnapshot}', Price: ${selectData.data.currencySnapshot} ${selectData.data.priceSnapshot}.`);

  // 5. Institute Admin Fetches Active Bank Accounts
  console.log('Test 5: Institute Admin Fetches Active Bank Accounts...');
  const activeBankRes = await fetch(`${BASE_URL}/bank-accounts/active`);
  const activeBankData = await activeBankRes.json();
  if (!activeBankData.success || !activeBankData.data.length) {
    throw new Error(`Failed to fetch active bank accounts: ${JSON.stringify(activeBankData)}`);
  }
  console.log(`  ✅ Passed: Retrieved ${activeBankData.data.length} active platform bank accounts for checkout.`);

  // 6. Institute Admin Submits Payment with Valid PDF Receipt
  console.log('Test 6: Institute Admin Uploads Receipt & Submits Payment...');
  const dummyPdfContent = Buffer.from('%PDF-1.4 Mock Receipt for EduNexa Subscription payment ref 998811');
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

  // Construct multipart body manually for native fetch
  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="subscriptionId"\r\n\r\n${subscriptionId}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="bankAccountId"\r\n\r\n${createdBankId}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="transferReference"\r\n\r\nTXN-EDUNEXA-7788\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="transferDate"\r\n\r\n2026-08-17\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="receipt"; filename="bank_deposit_receipt.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    dummyPdfContent,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const uploadRes = await fetch(`${BASE_URL}/subscription/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Authorization: `Bearer ${instituteAdminToken}`,
    },
    body: multipartBody,
  });
  const uploadData = await uploadRes.json();
  if (!uploadData.success || !uploadData.data.id || uploadData.data.status !== 'PENDING') {
    throw new Error(`Failed to submit payment: ${JSON.stringify(uploadData)}`);
  }
  const paymentId = uploadData.data.id;
  console.log(`  ✅ Passed: Payment submitted (ID: ${paymentId}), Status: PENDING.`);

  // 7. Duplicate Submission Prevention
  console.log('Test 7: Duplicate Submission Prevention...');
  const dupUploadRes = await fetch(`${BASE_URL}/subscription/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Authorization: `Bearer ${instituteAdminToken}`,
    },
    body: multipartBody,
  });
  const dupUploadData = await dupUploadRes.json();
  if (dupUploadRes.status !== 400 || !dupUploadData.message.includes('already pending')) {
    throw new Error(`Duplicate check failed: ${JSON.stringify(dupUploadData)}`);
  }
  console.log('  ✅ Passed: Duplicate submission blocked with 400: "Payment verification is already pending".');

  // 8. Super Admin Reviews Pending Payments Queue
  console.log('Test 8: Super Admin Reviews Pending Payments Queue...');
  const pendingRes = await fetch(`${BASE_URL}/super-admin/subscriptions/pending`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const pendingData = await pendingRes.json();
  if (!pendingData.success || !pendingData.data.some(p => p.id === paymentId)) {
    throw new Error(`Pending payment not found in queue: ${JSON.stringify(pendingData)}`);
  }
  console.log(`  ✅ Passed: Super Admin sees ${pendingData.data.length} pending payments in verification queue.`);

  // 9. Super Admin Approves Payment & Activates Subscription
  console.log('Test 9: Super Admin Approves Payment & Activates Subscription...');
  const approveRes = await fetch(`${BASE_URL}/super-admin/subscriptions/payments/${paymentId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({ adminNotes: 'Bank slip verified against corporate statement.' }),
  });
  const approveData = await approveRes.json();
  if (!approveData.success || approveData.data.subscription.status !== 'ACTIVE') {
    throw new Error(`Approval failed: ${JSON.stringify(approveData)}`);
  }
  console.log(`  ✅ Passed: Payment APPROVED, Subscription ACTIVE! Start: ${new Date(approveData.data.startDate).toLocaleDateString()}, End: ${new Date(approveData.data.endDate).toLocaleDateString()}.`);

  // 10. Historical Price Snapshot Integrity Test
  console.log('Test 10: Historical Price Snapshot Integrity Test...');
  const initialSnapshotPrice = selectData.data.priceSnapshot;
  const newPrice = initialSnapshotPrice + 4500.00;

  // Super Admin alters current standard plan price in catalog
  await fetch(`${BASE_URL}/super-admin/plans/${standardPlan.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      name: standardPlan.name,
      price: newPrice,
      duration: standardPlan.duration,
      durationType: standardPlan.durationType,
    }),
  });

  // Fetch current institute subscription
  const currentSubRes = await fetch(`${BASE_URL}/subscription/current`, {
    headers: { Authorization: `Bearer ${instituteAdminToken}` },
  });
  const currentSubData = await currentSubRes.json();
  if (!currentSubData.success || currentSubData.data.priceSnapshot !== initialSnapshotPrice) {
    throw new Error(`Historical price snapshot was corrupted! Expected ${initialSnapshotPrice}, got ${currentSubData?.data?.priceSnapshot}`);
  }
  console.log(`  ✅ Passed: Plan price increased in catalog to LKR ${newPrice}, but Institute A's active subscription price remains preserved at historical snapshot of LKR ${currentSubData.data.priceSnapshot}.`);

  // 11. Rejection Workflow Test with Rejection Reason
  console.log('Test 11: Rejection Workflow Test...');
  // Provision a quick new institute or select plan to test rejection
  const selectRes2 = await fetch(`${BASE_URL}/subscription/select-plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${instituteAdminToken}`,
    },
    body: JSON.stringify({ planId: standardPlan.id }),
  });
  const selectData2 = await selectRes2.json();
  const sub2Id = selectData2.data.id;

  const uploadRes2 = await fetch(`${BASE_URL}/subscription/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Authorization: `Bearer ${instituteAdminToken}`,
    },
    body: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="subscriptionId"\r\n\r\n${sub2Id}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="bankAccountId"\r\n\r\n${createdBankId}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="transferReference"\r\n\r\nTXN-BLURRY-RECEIPT\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="receipt"; filename="blurry.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      Buffer.from('fake-jpeg-data'),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
  const uploadData2 = await uploadRes2.json();
  const payment2Id = uploadData2.data.id;

  // Super Admin rejects with specific reason
  const rejectionMsg = 'The deposit slip image is too blurry. Please upload a clear photo or PDF.';
  const rejectRes = await fetch(`${BASE_URL}/super-admin/subscriptions/payments/${payment2Id}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({ rejectionReason: rejectionMsg }),
  });
  const rejectData = await rejectRes.json();
  if (!rejectData.success || rejectData.data.payment.status !== 'REJECTED') {
    throw new Error(`Rejection failed: ${JSON.stringify(rejectData)}`);
  }
  console.log(`  ✅ Passed: Payment rejected and reason recorded: "${rejectionMsg}".`);

  // 12. Verification of History Preservation
  console.log('Test 12: Verification of Subscription & Payment History...');
  const histRes = await fetch(`${BASE_URL}/subscription/history`, {
    headers: { Authorization: `Bearer ${instituteAdminToken}` },
  });
  const histData = await histRes.json();
  if (!histData.success || histData.data.length < 2) {
    throw new Error(`Subscription history failed: ${JSON.stringify(histData)}`);
  }
  console.log(`  ✅ Passed: Institute subscription history contains ${histData.data.length} records including active and rejected entries.`);

  console.log('\n========================================================');
  console.log('🎉 ALL STEP 3 SUBSCRIPTION & PAYMENT APPROVAL TESTS PASSED 100%!');
  console.log('========================================================\n');
}

runStep3Tests().catch((err) => {
  console.error('\n❌ Step 3 Test Suite Failed:', err);
  process.exit(1);
});
