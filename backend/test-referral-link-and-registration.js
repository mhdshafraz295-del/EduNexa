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

async function runReferralLinkAndRegistrationTest() {
  console.log('\n================================================================');
  console.log('  EDUNEXA: REFERRAL LINK GENERATION & REGISTRATION FLOW TEST');
  console.log('================================================================\n');

  const timeKey = Date.now();

  // 1. Create Referrer Institute
  const referrerInst = await prisma.institute.create({
    data: {
      name: `Referral Link Test Campus ${timeKey}`,
      slug: `ref-link-campus-${timeKey}`,
      code: `RL${timeKey.toString().slice(-4)}`,
      email: `reflink_${timeKey}@test.com`,
      isActive: true,
    },
  });

  const profile = await referralService.getOrCreateInstituteReferralProfile(referrerInst.id);
  assert(
    profile.referralCode && profile.referralCode.startsWith('EDUNEXA-'),
    `Referrer institute has valid referral code: ${profile.referralCode}`
  );

  // 2. Verify Referral Link Generation
  const dashboardData = await referralService.getInstituteReferralDashboard(referrerInst.id, 'http://localhost:5173');
  assert(
    dashboardData.referralLink.startsWith('http://localhost:5173/register?ref='),
    `Referral link targets frontend /register route: ${dashboardData.referralLink}`
  );
  assert(
    !dashboardData.referralLink.includes('/login') && !dashboardData.referralLink.includes(':5000'),
    'Referral link does NOT contain /login or backend port 5000.'
  );

  // 3. Test HTTP Registration endpoint directly: POST /api/auth/register-institute
  const regEmail = `new_campus_admin_${timeKey}@test.com`;
  const regRes = await fetch('http://localhost:5000/api/auth/register-institute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Referred Campus Via Link ${timeKey}`,
      adminName: 'Dr. Jane Smith',
      adminEmail: regEmail,
      adminPassword: 'Password123!',
      referrerCode: profile.referralCode,
    }),
  });

  const regJson = await regRes.json();
  if (!regJson.success) {
    console.error('Registration failed payload:', regJson);
  }
  assert(regJson.success === true && Boolean(regJson.token), 'Registration via POST /api/auth/register-institute succeeded with token.');

  const newInstituteId = regJson.institute.id;

  // 4. Verify Referral Record created in PENDING status
  const referralRecord = await prisma.instituteReferral.findUnique({
    where: { referredInstituteId: newInstituteId },
  });
  assert(
    referralRecord &&
    referralRecord.referrerInstituteId === referrerInst.id &&
    referralRecord.status === 'PENDING',
    `Referral record created in PENDING status linking new institute ${newInstituteId} to referrer ${referrerInst.id}.`
  );

  // 5. Test Registration with Invalid Referral Code (Graceful fallback)
  const invalidRefEmail = `graceful_campus_${timeKey}@test.com`;
  const invalidRegRes = await fetch('http://localhost:5000/api/auth/register-institute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Graceful Campus ${timeKey}`,
      adminEmail: invalidRefEmail,
      adminPassword: 'Password123!',
      referrerCode: 'EDUNEXA-INVALID999',
    }),
  });

  const invalidJson = await invalidRegRes.json();
  assert(invalidJson.success === true, 'Registration with non-existent referral code succeeds gracefully without server error.');

  console.log('\n================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} REFERRAL LINK & REGISTRATION TESTS PASSED!`);
  console.log('================================================================\n');
}

await runReferralLinkAndRegistrationTest();
await prisma.$disconnect();
