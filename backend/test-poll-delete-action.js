import prisma from './src/config/prisma.js';
import * as pollService from './src/services/poll.service.js';

let passed = 0;
let total = 0;

function assert(condition, msg) {
  total++;
  if (condition) {
    console.log(`  ✓ Check ${total}: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ Check ${total} FAILED: ${msg}`);
    throw new Error(`Failed check: ${msg}`);
  }
}

async function runPollDeleteActionTests() {
  console.log('\n================================================================');
  console.log('  EDUNEXA POLL DELETE ACTION & VOTE PROTECTION AUDIT');
  console.log('================================================================\n');

  const timestamp = Date.now();

  const plan = await prisma.subscriptionPlan.findFirst({
    where: { name: 'Starter Tier' },
  });

  // Institute A
  const instA = await prisma.institute.create({
    data: {
      name: `Delete Audit Inst A ${timestamp}`,
      code: `DEL_A_${timestamp.toString().slice(-4)}`,
      slug: `del-a-${timestamp.toString().slice(-4)}`,
      isActive: true,
      subscriptions: {
        create: {
          planId: plan.id,
          planNameSnapshot: plan.name,
          priceSnapshot: plan.price,
          currencySnapshot: plan.currency,
          durationSnapshot: plan.duration,
          durationTypeSnapshot: plan.durationType,
          featuresSnapshot: [{ code: 'POLLS' }],
          limitsSnapshot: {},
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 86400000),
          status: 'ACTIVE',
        },
      },
    },
  });

  // Institute B (Cross tenant)
  const instB = await prisma.institute.create({
    data: {
      name: `Delete Audit Inst B ${timestamp}`,
      code: `DEL_B_${timestamp.toString().slice(-4)}`,
      slug: `del-b-${timestamp.toString().slice(-4)}`,
      isActive: true,
      subscriptions: {
        create: {
          planId: plan.id,
          planNameSnapshot: plan.name,
          priceSnapshot: plan.price,
          currencySnapshot: plan.currency,
          durationSnapshot: plan.duration,
          durationTypeSnapshot: plan.durationType,
          featuresSnapshot: [{ code: 'POLLS' }],
          limitsSnapshot: {},
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 86400000),
          status: 'ACTIVE',
        },
      },
    },
  });

  const adminUserA = await prisma.user.create({
    data: {
      username: `admin_del_a_${timestamp}`,
      email: `admin_del_a_${timestamp}@test.com`,
      passwordHash: 'hashed_pwd',
      role: 'ADMIN',
      instituteId: instA.id,
    },
  });

  const studentUserA = await prisma.user.create({
    data: {
      username: `student_del_a_${timestamp}`,
      email: `student_del_a_${timestamp}@test.com`,
      passwordHash: 'hashed_pwd',
      role: 'STUDENT',
      instituteId: instA.id,
    },
  });

  // 1. Create Zero-Vote Draft Poll in Inst A
  const zeroVotePoll = await pollService.createPoll(instA.id, adminUserA.id, {
    title: 'Zero Vote Draft Poll to Delete',
    audienceType: 'ALL_USERS',
    status: 'DRAFT',
    options: ['Option 1', 'Option 2'],
  });

  const optionIds = zeroVotePoll.options.map((o) => o.id);

  // Check 1: Delete zero-vote draft poll
  const deleteResult = await pollService.deletePoll(instA.id, zeroVotePoll.id);
  assert(deleteResult.success === true, 'Admin successfully deletes zero-vote draft poll.');

  // Check 2: Poll row removed from DB
  const pollInDb = await prisma.poll.findUnique({ where: { id: zeroVotePoll.id } });
  assert(!pollInDb, 'Poll row permanently removed from database.');

  // Check 3: Poll options cascade deleted
  const orphanOptions = await prisma.pollOption.findMany({
    where: { id: { in: optionIds } },
  });
  assert(orphanOptions.length === 0, 'Poll options cascade deleted with no orphan rows.');

  // Check 4: Deleted poll absent from admin list
  const adminPolls = await pollService.getAdminPolls(instA.id, {});
  assert(!adminPolls.polls.some((p) => p.id === zeroVotePoll.id), 'Deleted poll absent from admin list.');

  // Check 5: Deleted poll absent from recipient feed
  const recipientFeed = await pollService.getRecipientEligiblePolls(instA.id, studentUserA, {});
  assert(!recipientFeed.polls.some((p) => p.id === zeroVotePoll.id), 'Deleted poll absent from recipient feed.');

  // 2. Create Active Poll and Cast a Vote
  const votedPoll = await pollService.createPoll(instA.id, adminUserA.id, {
    title: 'Voted Active Poll',
    audienceType: 'ALL_USERS',
    status: 'ACTIVE',
    options: ['Choice A', 'Choice B'],
  });

  await pollService.submitVote(instA.id, studentUserA, votedPoll.id, votedPoll.options[0].id);

  // Check 6: Attempting to hard-delete voted poll is blocked with 409 error
  let deleteBlocked = false;
  try {
    await pollService.deletePoll(instA.id, votedPoll.id);
  } catch (err) {
    if (err.statusCode === 409 || err.message?.includes('already has votes')) {
      deleteBlocked = true;
    }
  }
  assert(deleteBlocked, 'Hard delete is blocked with 409 error when poll has votes.');

  // Check 7: Votes remain intact after blocked delete
  const votesAfterAttempt = await prisma.pollVote.count({ where: { pollId: votedPoll.id } });
  assert(votesAfterAttempt === 1, 'Voting record remains intact after blocked hard delete.');

  // Check 8: Voted poll can be archived safely
  const archiveResult = await pollService.updatePollStatus(instA.id, votedPoll.id, 'ARCHIVED');
  assert(archiveResult.status === 'ARCHIVED', 'Voted poll archived safely via archive workflow.');

  // Check 9: Cross-tenant delete blocked
  let crossTenantBlocked = false;
  try {
    await pollService.deletePoll(instB.id, votedPoll.id);
  } catch (err) {
    if (err.statusCode === 404 || err.message?.includes('not found')) {
      crossTenantBlocked = true;
    }
  }
  assert(crossTenantBlocked, 'Cross-tenant admin delete strictly blocked (404 Not Found).');

  // Check 10: Non-existent poll delete returns 404
  let missingPollBlocked = false;
  try {
    await pollService.deletePoll(instA.id, 999999);
  } catch (err) {
    if (err.statusCode === 404 || err.message?.includes('not found')) {
      missingPollBlocked = true;
    }
  }
  assert(missingPollBlocked, 'Non-existent poll delete returns 404.');

  console.log('\n================================================================');
  console.log(`  🎉 ALL ${passed}/${total} POLL DELETE CHECKS PASSED!`);
  console.log('================================================================\n');
}

runPollDeleteActionTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Audit Error:', err);
    process.exit(1);
  });
