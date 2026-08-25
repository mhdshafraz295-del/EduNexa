import prisma from './src/config/prisma.js';
import * as announcementService from './src/services/platformAnnouncement.service.js';
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

async function runStep10CrudVerification() {
  console.log('\n================================================================');
  console.log('  EDUNEXA STEP 10: REAL MYSQL DATA & CRUD ENDPOINT VERIFICATION');
  console.log('================================================================\n');

  const superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', isActive: true },
  });
  if (!superAdmin) throw new Error('SUPER_ADMIN account required.');

  const institutes = await prisma.institute.findMany({
    where: { isActive: true },
    take: 3,
  });
  if (institutes.length === 0) throw new Error('At least one active institute required.');

  const timeKey = Date.now();

  // ============================================================================
  // SECTION 1: PLATFORM ANNOUNCEMENTS CRUD & MYSQL VERIFICATION
  // ============================================================================
  console.log('--- SECTION 1: PLATFORM ANNOUNCEMENTS REAL DATA & CRUD ---');

  // 1. Create Announcement (All Institutes)
  const ann1Title = `System Upgrade Notice ${timeKey}`;
  const createdAnn1 = await announcementService.createAnnouncement(superAdmin, {
    title: ann1Title,
    message: 'All campuses will experience a scheduled 5-minute upgrade tonight.',
    priority: 'IMPORTANT',
    targetType: 'ALL_INSTITUTES',
    status: 'PUBLISHED',
  });

  const dbAnn1 = await prisma.platformAnnouncement.findUnique({
    where: { id: createdAnn1.id },
  });
  assert(dbAnn1 && dbAnn1.title === ann1Title, `Announcement row persisted in MySQL (ID: ${dbAnn1?.id}, Title: "${dbAnn1?.title}")`);

  // 2. Create Targeted Announcement (Selected Institutes)
  const targetInst = institutes[0];
  const ann2Title = `Campus Exclusive Grant ${timeKey}`;
  const createdAnn2 = await announcementService.createAnnouncement(superAdmin, {
    title: ann2Title,
    message: 'Exclusive grant opportunity available for your campus.',
    priority: 'URGENT',
    targetType: 'SELECTED_INSTITUTES',
    targetInstituteIds: [targetInst.id],
    status: 'PUBLISHED',
  });

  const dbTargetRow = await prisma.platformAnnouncementTarget.findUnique({
    where: {
      announcementId_instituteId: {
        announcementId: createdAnn2.id,
        instituteId: targetInst.id,
      },
    },
  });
  assert(Boolean(dbTargetRow), `Targeted announcement mapping persisted in MySQL for Institute ID: ${targetInst.id}`);

  // 3. Query Super Admin Announcements List
  const adminAnnList = await announcementService.listSuperAdminAnnouncements({ page: 1, limit: 10 });
  assert(adminAnnList.success && Array.isArray(adminAnnList.announcements), 'Admin announcements list returns success and real MySQL array.');
  const foundAnn1 = adminAnnList.announcements.find((a) => a.id === createdAnn1.id);
  assert(Boolean(foundAnn1), 'Created announcement is present in real database response.');

  // 4. Update Announcement
  const updatedTitle = `${ann1Title} (Updated)`;
  const updatedAnn = await announcementService.updateAnnouncement(superAdmin, createdAnn1.id, {
    title: updatedTitle,
    priority: 'URGENT',
  });
  assert(updatedAnn.title === updatedTitle && updatedAnn.priority === 'URGENT', 'Announcement updated successfully in MySQL.');

  // ============================================================================
  // SECTION 2: REFERRAL CAMPAIGNS CRUD & MYSQL VERIFICATION
  // ============================================================================
  console.log('\n--- SECTION 2: REFERRAL CAMPAIGNS REAL DATA & CRUD ---');

  // 5. Create Custom Referral Campaign
  const campName = `Custom Q4 Expansion Campaign ${timeKey}`;
  const createdCamp = await referralService.createCampaign(superAdmin, {
    name: campName,
    description: 'Refer 5 new institutes and receive 2 calendar months free extension.',
    requiredReferrals: 5,
    rewardType: 'SUBSCRIPTION_EXTENSION',
    rewardMonths: 2,
    repeatable: true,
    status: 'ACTIVE',
  });

  const dbCamp = await prisma.referralCampaign.findUnique({
    where: { id: createdCamp.id },
  });
  assert(
    dbCamp && dbCamp.name === campName && dbCamp.requiredReferrals === 5 && dbCamp.rewardMonths === 2,
    `Campaign persisted in MySQL (ID: ${dbCamp?.id}, Required: ${dbCamp?.requiredReferrals}, Months: ${dbCamp?.rewardMonths})`
  );

  // 6. Query Super Admin Campaigns List
  const adminCampList = await referralService.listSuperAdminCampaigns();
  assert(adminCampList.success && Array.isArray(adminCampList.campaigns), 'Admin campaigns list returns real MySQL array.');
  const foundCamp = adminCampList.campaigns.find((c) => c.id === createdCamp.id);
  assert(Boolean(foundCamp), 'Created custom campaign is present in real database response.');

  // 7. Toggle Campaign Status (ACTIVE -> PAUSED)
  const pausedCamp = await referralService.setCampaignStatus(superAdmin, createdCamp.id, 'PAUSED');
  assert(pausedCamp.status === 'PAUSED', 'Campaign status updated to PAUSED in MySQL.');

  // 8. Super Admin Analytics Metrics
  const refAnalytics = await referralService.getSuperAdminReferralAnalytics();
  assert(
    refAnalytics.success && typeof refAnalytics.data.totalReferralsCount === 'number',
    `Real KPI analytics computed directly from MySQL (Total Referrals: ${refAnalytics.data.totalReferralsCount})`
  );

  const annAnalytics = await announcementService.getSuperAdminAnnouncementAnalytics();
  assert(
    annAnalytics.success && typeof annAnalytics.data.totalAnnouncements === 'number',
    `Real Announcement KPI analytics computed directly from MySQL (Total Announcements: ${annAnalytics.data.totalAnnouncements})`
  );

  console.log('\n================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} REAL MYSQL DATA & CRUD TESTS PASSED!`);
  console.log('================================================================\n');
}

runStep10CrudVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nVerification Failed:', err);
    process.exit(1);
  });
