import prisma from './src/config/prisma.js';
import * as announcementService from './src/services/platformAnnouncement.service.js';

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

async function runAnnouncementsTestSuite() {
  console.log('\n================================================================');
  console.log('  EDUNEXA STEP 10 PART A: PLATFORM ANNOUNCEMENTS TEST SUITE');
  console.log('================================================================\n');

  // Setup Super Admin and two distinct institutes
  const superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', isActive: true },
  });
  if (!superAdmin) {
    throw new Error('A SUPER_ADMIN account is required for platform announcement testing.');
  }

  const institutes = await prisma.institute.findMany({
    where: { isActive: true },
    include: { users: { where: { role: 'ADMIN', isActive: true } } },
    take: 2,
  });

  const instA = institutes[0];
  const instB = institutes[1];
  const adminA = instA?.users?.[0];
  const adminB = instB?.users?.[0];

  if (!instA || !instB || !adminA || !adminB) {
    throw new Error('Two active institutes with Admin users are required for testing.');
  }

  console.log(`Context: Super Admin (${superAdmin.username}), Inst A (${instA.name}), Inst B (${instB.name})\n`);

  // ============================================================================
  // SECTION 1: CREATION, RBAC & VALIDATION
  // ============================================================================
  console.log('--- SECTION 1: CREATION, RBAC & VALIDATION ---');

  // Test 1: Institute Admin cannot create platform announcement (403)
  let adminBlocked = false;
  try {
    await announcementService.createAnnouncement(adminA, {
      title: 'Unauthorized Announcement',
      message: 'Should fail',
    });
  } catch (err) {
    adminBlocked = err.status === 403;
  }
  assert(adminBlocked, 'Institute Admin is blocked from creating platform announcement (403).');

  // Test 2: Invalid dates rejected (expiry before start)
  let invalidDateRejected = false;
  try {
    await announcementService.createAnnouncement(superAdmin, {
      title: 'Invalid Date Announcement',
      message: 'Test message',
      startsAt: new Date('2026-09-01'),
      expiresAt: new Date('2026-08-01'),
    });
  } catch (err) {
    invalidDateRejected = err.status === 400;
  }
  assert(invalidDateRejected, 'Invalid expiry date earlier than start date is rejected with 400.');

  // Test 3: Super Admin creates draft announcement
  const draftAnn = await announcementService.createAnnouncement(superAdmin, {
    title: 'Platform Maintenance Notice (Draft)',
    message: 'Scheduled maintenance will be performed this weekend.',
    priority: 'INFO',
    targetType: 'ALL_INSTITUTES',
    status: 'DRAFT',
  });
  assert(draftAnn.id && draftAnn.status === 'DRAFT', 'Super Admin successfully creates draft platform announcement.');

  // Test 4: Draft is NOT visible in Institute Admin feed
  const feedDraftA = await announcementService.listInstituteAnnouncements(instA.id, adminA.id, {});
  const foundDraft = feedDraftA.announcements.find((a) => a.id === draftAnn.id);
  assert(!foundDraft, 'Draft announcement is hidden from Institute Admin feed.');

  // ============================================================================
  // SECTION 2: PUBLISHING & ALL_INSTITUTES TARGETING
  // ============================================================================
  console.log('\n--- SECTION 2: PUBLISHING & ALL_INSTITUTES TARGETING ---');

  // Test 5: Super Admin publishes announcement
  const publishedAnn = await announcementService.createAnnouncement(superAdmin, {
    title: 'EduNexa 2.0 Security Upgrade Available',
    message: 'All campus administrators are advised to review new security settings.',
    priority: 'IMPORTANT',
    targetType: 'ALL_INSTITUTES',
    status: 'PUBLISHED',
    startsAt: new Date(Date.now() - 60000), // 1 min ago
  });
  assert(publishedAnn.status === 'PUBLISHED', 'Super Admin publishes announcement.');

  // Test 6: ALL_INSTITUTES visible to Institute A
  const feedA = await announcementService.listInstituteAnnouncements(instA.id, adminA.id, {});
  const foundInA = feedA.announcements.find((a) => a.id === publishedAnn.id);
  assert(Boolean(foundInA), 'ALL_INSTITUTES announcement is delivered to Institute A.');

  // Test 7: ALL_INSTITUTES visible to Institute B
  const feedB = await announcementService.listInstituteAnnouncements(instB.id, adminB.id, {});
  const foundInB = feedB.announcements.find((a) => a.id === publishedAnn.id);
  assert(Boolean(foundInB), 'ALL_INSTITUTES announcement is delivered to Institute B.');

  // ============================================================================
  // SECTION 3: SELECTED_INSTITUTES TARGETING & ISOLATION
  // ============================================================================
  console.log('\n--- SECTION 3: SELECTED_INSTITUTES TARGETING & ISOLATION ---');

  // Test 8: Super Admin creates targeted announcement for Institute A only
  const targetedAnn = await announcementService.createAnnouncement(superAdmin, {
    title: 'Special Grant Offer for Institute A',
    message: 'Exclusive subscription upgrade grant for your campus.',
    priority: 'URGENT',
    targetType: 'SELECTED_INSTITUTES',
    targetInstituteIds: [instA.id],
    status: 'PUBLISHED',
    startsAt: new Date(Date.now() - 60000),
  });
  assert(targetedAnn.id, 'Targeted announcement for Institute A created.');

  // Test 9: Selected institute (Inst A) sees targeted announcement
  const feedTargetedA = await announcementService.listInstituteAnnouncements(instA.id, adminA.id, {});
  const foundTargetedA = feedTargetedA.announcements.find((a) => a.id === targetedAnn.id);
  assert(Boolean(foundTargetedA), 'Targeted announcement is delivered to selected Institute A.');

  // Test 10: Unselected institute (Inst B) CANNOT see targeted announcement
  const feedTargetedB = await announcementService.listInstituteAnnouncements(instB.id, adminB.id, {});
  const foundTargetedB = feedTargetedB.announcements.find((a) => a.id === targetedAnn.id);
  assert(!foundTargetedB, 'Unselected Institute B is strictly blocked from seeing targeted announcement.');

  // ============================================================================
  // SECTION 4: TIME-BOUND VISIBILITY (FUTURE & EXPIRED)
  // ============================================================================
  console.log('\n--- SECTION 4: TIME-BOUND VISIBILITY (FUTURE & EXPIRED) ---');

  // Test 11: Future announcement is hidden
  const futureAnn = await announcementService.createAnnouncement(superAdmin, {
    title: 'Future Scheduled Release Note',
    message: 'Will go live next month.',
    targetType: 'ALL_INSTITUTES',
    status: 'PUBLISHED',
    startsAt: new Date(Date.now() + 86400000 * 7), // 7 days in future
  });
  const feedFuture = await announcementService.listInstituteAnnouncements(instA.id, adminA.id, {});
  const foundFuture = feedFuture.announcements.find((a) => a.id === futureAnn.id);
  assert(!foundFuture, 'Future-dated announcement is hidden from feed.');

  // Test 12: Expired announcement is hidden
  const expiredAnn = await announcementService.createAnnouncement(superAdmin, {
    title: 'Past Expired Promotion',
    message: 'Expired yesterday.',
    targetType: 'ALL_INSTITUTES',
    status: 'PUBLISHED',
    startsAt: new Date(Date.now() - 86400000 * 3), // 3 days ago
    expiresAt: new Date(Date.now() - 86400000 * 1), // 1 day ago
  });
  const feedExpired = await announcementService.listInstituteAnnouncements(instA.id, adminA.id, {});
  const foundExpired = feedExpired.announcements.find((a) => a.id === expiredAnn.id);
  assert(!foundExpired, 'Expired announcement is hidden from feed.');

  // ============================================================================
  // SECTION 5: READ TRACKING & REAL ANALYTICS
  // ============================================================================
  console.log('\n--- SECTION 5: READ TRACKING & REAL ANALYTICS ---');

  // Test 13: Institute Admin A marks announcement as read
  const markResult = await announcementService.markAnnouncementRead(instA.id, adminA.id, publishedAnn.id);
  assert(markResult.success && markResult.receipt.readAt, 'Institute Admin A marks announcement as read.');

  // Test 14: Institute A feed shows isRead = true
  const feedReadA = await announcementService.listInstituteAnnouncements(instA.id, adminA.id, {});
  const annA = feedReadA.announcements.find((a) => a.id === publishedAnn.id);
  assert(annA.isRead === true, 'Announcement correctly marked as isRead = true for Institute A.');

  // Test 15: Institute B feed remains isRead = false
  const feedReadB = await announcementService.listInstituteAnnouncements(instB.id, adminB.id, {});
  const annB = feedReadB.announcements.find((a) => a.id === publishedAnn.id);
  assert(annB.isRead === false, 'Institute B announcement state remains isRead = false (independent tracking).');

  // Test 16: Super Admin Detail returns real read/unread counts
  const detail = await announcementService.getSuperAdminAnnouncementDetail(publishedAnn.id);
  assert(detail.announcement.metrics.readCount >= 1, `Super Admin metrics show real readCount >= 1 (Found: ${detail.announcement.metrics.readCount}).`);
  assert(detail.announcement.metrics.eligibleInstitutesCount >= 2, 'Super Admin metrics show eligible institute count.');

  // Test 17: Super Admin global announcement analytics
  const globalStats = await announcementService.getSuperAdminAnnouncementAnalytics();
  assert(globalStats.success && globalStats.data.totalAnnouncements >= 4, 'Global announcement analytics compute real database metrics.');

  // ============================================================================
  // SECTION 6: UNPUBLISH / ARCHIVE & CLEANUP
  // ============================================================================
  console.log('\n--- SECTION 6: UNPUBLISH / ARCHIVE & CLEANUP ---');

  // Test 18: Unpublish/Archive removes from feed
  await announcementService.setAnnouncementStatus(superAdmin, publishedAnn.id, 'ARCHIVED');
  const feedArchived = await announcementService.listInstituteAnnouncements(instA.id, adminA.id, {});
  const foundArchived = feedArchived.announcements.find((a) => a.id === publishedAnn.id);
  assert(!foundArchived, 'Archived announcement is removed from institute feed.');

  console.log('\n================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} PLATFORM ANNOUNCEMENT TESTS PASSED!`);
  console.log('================================================================\n');
}

runAnnouncementsTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nPlatform Announcements Test Suite Failed:', err);
    process.exit(1);
  });
