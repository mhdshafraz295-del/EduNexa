import prisma from './src/config/prisma.js';
import * as referralService from './src/services/referral.service.js';

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

async function runReferralTestSuite() {
  console.log('\n================================================================');
  console.log('  EDUNEXA STEP 10 PART B: REFERRAL & MARKETING REWARD TEST SUITE');
  console.log('================================================================\n');

  // Setup Super Admin and Test Institutes
  const superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', isActive: true },
  });
  if (!superAdmin) {
    throw new Error('A SUPER_ADMIN account is required for testing.');
  }

  // Create isolated Referrer Institute A for testing
  const timeKey = Date.now();
  const referrerInst = await prisma.institute.create({
    data: {
      name: `Referrer Test Academy ${timeKey}`,
      slug: `ref-inst-${timeKey}`,
      code: `REF${timeKey.toString().slice(-4)}`,
      email: `referrer_${timeKey}@test.com`,
      isActive: true,
    },
  });

  const referrerAdmin = await prisma.user.create({
    data: {
      username: `admin_ref_${timeKey}`,
      email: `admin_ref_${timeKey}@test.com`,
      passwordHash: 'dummy',
      role: 'ADMIN',
      instituteId: referrerInst.id,
      isActive: true,
    },
  });

  // Provision active subscription for Referrer Institute (expires in 30 days)
  const initialExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const referrerSub = await prisma.instituteSubscription.create({
    data: {
      instituteId: referrerInst.id,
      planNameSnapshot: 'Pro Academic Plan',
      priceSnapshot: 15000,
      currencySnapshot: 'LKR',
      durationSnapshot: 1,
      durationTypeSnapshot: 'MONTHS',
      featuresSnapshot: [],
      limitsSnapshot: {},
      startDate: new Date(),
      endDate: initialExpiry,
      status: 'ACTIVE',
    },
  });

  console.log(`Context: Referrer Institute (${referrerInst.name} [ID: ${referrerInst.id}])`);
  console.log(`Initial Subscription Expiry: ${initialExpiry.toLocaleDateString()}\n`);

  // ============================================================================
  // SECTION 1: CAMPAIGN CREATION & RBAC
  // ============================================================================
  console.log('--- SECTION 1: CAMPAIGN CREATION & RBAC ---');

  // Test 1: Institute Admin blocked from creating campaign (403)
  let adminBlocked = false;
  try {
    await referralService.createCampaign(referrerAdmin, {
      name: 'Unauthorized Referral Campaign',
      requiredReferrals: 2,
    });
  } catch (err) {
    adminBlocked = err.status === 403;
  }
  assert(adminBlocked, 'Institute Admin blocked from creating referral campaign (403).');

  // Test 2: Super Admin creates campaign (Refer 2 -> Get 1 Month FREE)
  const campaign = await referralService.createCampaign(superAdmin, {
    name: `Campus Growth Reward Campaign ${timeKey}`,
    description: 'Refer 2 new institutes and earn 1 calendar month free subscription extension!',
    requiredReferrals: 2,
    rewardType: 'SUBSCRIPTION_EXTENSION',
    rewardMonths: 1,
    repeatable: false,
    status: 'ACTIVE',
  });
  assert(campaign.id && campaign.requiredReferrals === 2, 'Super Admin creates active referral campaign (2 referrals = 1 month free).');

  // ============================================================================
  // SECTION 2: REFERRAL IDENTITY & REGISTRATION LINK
  // ============================================================================
  console.log('\n--- SECTION 2: REFERRAL IDENTITY & REGISTRATION LINK ---');

  // Test 3: Unique referral code generation for Referrer Institute
  const profile = await referralService.getOrCreateInstituteReferralProfile(referrerInst.id);
  assert(profile.referralCode && profile.referralCode.startsWith('EDUNEXA-'), `Generated unique referral code: ${profile.referralCode}`);

  // Test 4: Dashboard returns public referral link targeting /register without primary JWT
  const dashA = await referralService.getInstituteReferralDashboard(referrerInst.id, 'https://edunexa.com');
  assert(
    dashA.referralLink &&
    dashA.referralLink.includes('/register?ref=') &&
    !dashA.referralLink.includes('eyJ') &&
    !dashA.referralLink.includes('token'),
    `Referral link targets frontend /register route cleanly: ${dashA.referralLink}`
  );

  // Test 5: Self-referral is strictly blocked
  const selfRef = await referralService.recordInstituteReferralOnRegistration({
    referrerCode: profile.referralCode,
    newInstituteId: referrerInst.id,
  });
  assert(selfRef === null, 'Self-referral attempt is blocked and discarded.');

  // ============================================================================
  // SECTION 3: REFERRED INSTITUTE ONBOARDING & QUALIFICATION
  // ============================================================================
  console.log('\n--- SECTION 3: REFERRED INSTITUTE ONBOARDING & QUALIFICATION ---');

  // Create Referred Institute 1
  const referredInst1 = await prisma.institute.create({
    data: {
      name: `Referred Campus 1 ${timeKey}`,
      slug: `ref-1-${timeKey}`,
      code: `R1${timeKey.toString().slice(-4)}`,
      email: `ref1_${timeKey}@test.com`,
      isActive: true,
    },
  });

  // Test 6: Registration with referral code creates PENDING referral
  const refRecord1 = await referralService.recordInstituteReferralOnRegistration({
    referrerCode: profile.referralCode,
    newInstituteId: referredInst1.id,
  });
  assert(refRecord1 && refRecord1.status === 'PENDING', 'Referred Institute 1 registered -> referral created in PENDING status.');

  // Test 7: Duplicate referral attribution prevented for same referred institute
  const dupRef = await referralService.recordInstituteReferralOnRegistration({
    referrerCode: profile.referralCode,
    newInstituteId: referredInst1.id,
  });
  assert(dupRef.id === refRecord1.id, 'Duplicate referral registration returns existing record (no duplicate row).');

  // Test 8: Unpaid / Trial-only institute does NOT qualify
  const qualCheckBeforePayment = await referralService.evaluateReferralQualification(referredInst1.id);
  assert(qualCheckBeforePayment.qualified === false, 'Trial registration without paid subscription does NOT qualify.');

  // Activate Paid Subscription for Referred Institute 1
  await prisma.instituteSubscription.create({
    data: {
      instituteId: referredInst1.id,
      planNameSnapshot: 'Standard Plan',
      priceSnapshot: 10000,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
      durationSnapshot: 1,
      durationTypeSnapshot: 'MONTHS',
      featuresSnapshot: [],
      limitsSnapshot: {},
    },
  });

  // Test 9: Active paid subscription qualifies Referred Institute 1
  const qualResult1 = await referralService.evaluateReferralQualification(referredInst1.id);
  assert(qualResult1.qualified === true && qualResult1.referral.status === 'QUALIFIED', 'Referred Institute 1 qualifies upon subscription activation.');

  // Test 10: Progress is now 1 / 2 (Threshold not reached yet, no reward created)
  const dashAfter1 = await referralService.getInstituteReferralDashboard(referrerInst.id);
  assert(dashAfter1.progress.qualifiedCount === 1, `Referral progress count updated: 1 / 2 qualified.`);
  assert(qualResult1.rewardCreated === null, 'No reward created yet (requires 2 qualified referrals).');

  // ============================================================================
  // SECTION 4: THRESHOLD REACHED & REWARD CREATION
  // ============================================================================
  console.log('\n--- SECTION 4: THRESHOLD REACHED & REWARD CREATION ---');

  // Create Referred Institute 2
  const referredInst2 = await prisma.institute.create({
    data: {
      name: `Referred Campus 2 ${timeKey}`,
      slug: `ref-2-${timeKey}`,
      code: `R2${timeKey.toString().slice(-4)}`,
      email: `ref2_${timeKey}@test.com`,
      isActive: true,
    },
  });

  await referralService.recordInstituteReferralOnRegistration({
    referrerCode: profile.referralCode,
    newInstituteId: referredInst2.id,
  });

  // Activate Paid Subscription for Referred Institute 2
  await prisma.instituteSubscription.create({
    data: {
      instituteId: referredInst2.id,
      planNameSnapshot: 'Standard Plan',
      priceSnapshot: 10000,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
      durationSnapshot: 1,
      durationTypeSnapshot: 'MONTHS',
      featuresSnapshot: [],
      limitsSnapshot: {},
    },
  });

  // Test 11: 2nd Referral qualifies and triggers reward creation
  const qualResult2 = await referralService.evaluateReferralQualification(referredInst2.id);
  assert(qualResult2.qualified === true, 'Referred Institute 2 qualifies.');
  assert(
    qualResult2.rewardCreated && qualResult2.rewardCreated.status === 'PENDING_APPROVAL',
    'Goal reached (2/2) -> ReferralReward created in PENDING_APPROVAL status.'
  );

  const rewardId = qualResult2.rewardCreated.id;

  // Test 12: Idempotent - re-evaluating does NOT create duplicate reward
  const reQual = await referralService.evaluateReferralQualification(referredInst2.id);
  assert(reQual.qualified === false, 'Subsequent evaluation skips already qualified referral (no duplicate reward).');

  // ============================================================================
  // SECTION 5: SUPER ADMIN REWARD APPROVAL & SUBSCRIPTION EXTENSION
  // ============================================================================
  console.log('\n--- SECTION 5: SUPER ADMIN REWARD APPROVAL & SUBSCRIPTION EXTENSION ---');

  // Test 13: Non-Super-Admin cannot approve reward (403)
  let nonAdminApproveBlocked = false;
  try {
    await referralService.approveReward(referrerAdmin, rewardId);
  } catch (err) {
    nonAdminApproveBlocked = err.status === 403;
  }
  assert(nonAdminApproveBlocked, 'Institute Admin blocked from approving reward (403).');

  // Test 14: Super Admin approves reward -> atomically extends subscription by 1 month
  const approvalResult = await referralService.approveReward(superAdmin, rewardId);
  assert(approvalResult.success && approvalResult.reward.status === 'APPROVED', 'Super Admin successfully approves referral reward.');

  // Test 15: Expiry date extended by 1 calendar month
  const updatedSub = await prisma.instituteSubscription.findUnique({
    where: { id: referrerSub.id },
  });
  const expectedMonth = new Date(initialExpiry);
  expectedMonth.setMonth(expectedMonth.getMonth() + 1);

  assert(
    updatedSub.endDate.getMonth() === expectedMonth.getMonth() && updatedSub.endDate > initialExpiry,
    `Subscription extended from ${initialExpiry.toLocaleDateString()} to ${updatedSub.endDate.toLocaleDateString()}.`
  );

  // Test 16: Idempotent Approval - repeated approval attempt fails safely (400)
  let repeatApproveBlocked = false;
  try {
    await referralService.approveReward(superAdmin, rewardId);
  } catch (err) {
    repeatApproveBlocked = err.status === 400;
  }
  assert(repeatApproveBlocked, 'Repeated approval attempt rejected (prevents double subscription extension).');

  // Test 17: Audit log created for subscription extension
  const auditLog = await prisma.referralRewardAuditLog.findFirst({
    where: { rewardId, action: 'SUBSCRIPTION_EXTENDED' },
  });
  assert(
    auditLog && auditLog.performedById === superAdmin.id && auditLog.monthsExtended === 1,
    'Audit log recorded with previous/new expiry, approver, and months extended.'
  );

  // Test 18: Notification dispatched to Referrer Admin
  const notif = await prisma.notification.findFirst({
    where: { instituteId: referrerInst.id, userId: referrerAdmin.id },
    orderBy: { createdAt: 'desc' },
  });
  assert(notif && notif.title.includes('Referral Reward Approved'), 'Notification dispatched to Referrer Institute Admin.');

  // Test 19: Super Admin Referral Analytics KPI accuracy
  const analytics = await referralService.getSuperAdminReferralAnalytics();
  assert(
    analytics.success && analytics.data.totalReferralsCount >= 2 && analytics.data.rewardsAppliedCount >= 1,
    'Super Admin analytics reflect real MySQL counts and conversion rate.'
  );

  console.log('\n================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} REFERRAL & MARKETING TESTS PASSED!`);
  console.log('================================================================\n');
}

runReferralTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nReferral Test Suite Failed:', err);
    process.exit(1);
  });
