import prisma from './src/config/prisma.js';
import * as pollService from './src/services/poll.service.js';
import { getInstituteEntitlement } from './src/services/entitlement.service.js';

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

async function runStudentPollVisibilityAudit() {
  console.log('\n================================================================');
  console.log('  EDUNEXA STUDENT PORTAL POLL VISIBILITY & ROUTING AUDIT');
  console.log('================================================================\n');

  const timestamp = Date.now();

  const plan = await prisma.subscriptionPlan.findFirst({
    where: { name: 'Starter Tier' },
  });

  const institute = await prisma.institute.create({
    data: {
      name: `Student Poll Audit Inst ${timestamp}`,
      code: `SPA_${timestamp.toString().slice(-4)}`,
      slug: `spa-${timestamp.toString().slice(-4)}`,
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

  const adminUser = await prisma.user.create({
    data: {
      username: `admin_sp_${timestamp}`,
      email: `admin_sp_${timestamp}@test.com`,
      passwordHash: 'hashed_pwd',
      role: 'ADMIN',
      instituteId: institute.id,
    },
  });

  // Enrolled Student in Class 1
  const student1User = await prisma.user.create({
    data: {
      username: `student1_sp_${timestamp}`,
      email: `student1_sp_${timestamp}@test.com`,
      passwordHash: 'hashed_pwd',
      role: 'STUDENT',
      instituteId: institute.id,
    },
  });

  // Student in Class 2
  const student2User = await prisma.user.create({
    data: {
      username: `student2_sp_${timestamp}`,
      email: `student2_sp_${timestamp}@test.com`,
      passwordHash: 'hashed_pwd',
      role: 'STUDENT',
      instituteId: institute.id,
    },
  });

  const teacherUser = await prisma.user.create({
    data: {
      username: `teacher_sp_${timestamp}`,
      email: `teacher_sp_${timestamp}@test.com`,
      passwordHash: 'hashed_pwd',
      role: 'TEACHER',
      instituteId: institute.id,
    },
  });

  const parentUser = await prisma.user.create({
    data: {
      username: `parent_sp_${timestamp}`,
      email: `parent_sp_${timestamp}@test.com`,
      passwordHash: 'hashed_pwd',
      role: 'PARENT',
      instituteId: institute.id,
    },
  });

  const class1 = await prisma.class.create({
    data: {
      instituteId: institute.id,
      name: `Grade 11-A ${timestamp}`,
      section: 'A',
    },
  });

  const class2 = await prisma.class.create({
    data: {
      instituteId: institute.id,
      name: `Grade 11-B ${timestamp}`,
      section: 'B',
    },
  });

  await prisma.student.create({
    data: {
      userId: student1User.id,
      instituteId: institute.id,
      classId: class1.id,
      name: 'Student One',
      admissionNumber: `SP_${timestamp}_1`,
    },
  });

  await prisma.student.create({
    data: {
      userId: student2User.id,
      instituteId: institute.id,
      classId: class2.id,
      name: 'Student Two',
      admissionNumber: `SP_${timestamp}_2`,
    },
  });

  // Check 1: POLLS entitlement true for eligible Student institute
  const ent = await getInstituteEntitlement(institute.id);
  assert(ent.isValid && ent.features.POLLS === true, 'POLLS entitlement returns true for active subscription.');

  // Create different types of polls
  // 1. ALL_USERS Active Poll with NULL dates (Start & End empty)
  const allUsersPoll = await pollService.createPoll(institute.id, adminUser.id, {
    title: 'School Spirit Day Poll (Null Dates)',
    audienceType: 'ALL_USERS',
    status: 'ACTIVE',
    startsAt: null,
    endsAt: null,
    options: ['Option Red', 'Option Blue'],
    allowVoteChange: true,
  });

  // 2. STUDENTS Active Poll with NULL dates
  const studentsPoll = await pollService.createPoll(institute.id, adminUser.id, {
    title: 'Student Council President Election (Null Dates)',
    audienceType: 'STUDENTS',
    status: 'ACTIVE',
    startsAt: null,
    endsAt: null,
    options: ['Candidate John', 'Candidate Emma'],
  });

  // 3. CLASS_STUDENTS Active Poll for Class 1 with NULL dates
  const class1Poll = await pollService.createPoll(institute.id, adminUser.id, {
    title: 'Class 11-A Field Trip (Null Dates)',
    audienceType: 'CLASS_STUDENTS',
    classId: class1.id,
    status: 'ACTIVE',
    startsAt: null,
    endsAt: null,
    options: ['Museum', 'Planetarium'],
  });

  // 4. TEACHERS Poll (Must NOT appear to student)
  const teacherOnlyPoll = await pollService.createPoll(institute.id, adminUser.id, {
    title: 'Staff Meeting Reschedule',
    audienceType: 'TEACHERS',
    status: 'ACTIVE',
    options: ['Morning', 'Evening'],
  });

  // 5. PARENTS Poll (Must NOT appear to student)
  const parentOnlyPoll = await pollService.createPoll(institute.id, adminUser.id, {
    title: 'PTA Committee Vote',
    audienceType: 'PARENTS',
    status: 'ACTIVE',
    options: ['Yes', 'No'],
  });

  // 6. Upcoming Scheduled Poll (Future start)
  const upcomingPoll = await pollService.createPoll(institute.id, adminUser.id, {
    title: 'Next Term Sports Poll',
    audienceType: 'STUDENTS',
    status: 'ACTIVE',
    startsAt: new Date(Date.now() + 86400000),
    endsAt: new Date(Date.now() + 172800000),
    options: ['Cricket', 'Basketball'],
  });

  // Simulated req.user from auth middleware
  const simulatedAuthStudent1 = {
    id: student1User.id,
    username: student1User.username,
    email: student1User.email,
    role: 'STUDENT',
    isActive: true,
    instituteId: institute.id,
  };

  // Check 2: Active polls feed for Student 1
  const activeFeed1 = await pollService.getRecipientEligiblePolls(institute.id, simulatedAuthStudent1, { status: 'ACTIVE' });
  const activePollIds1 = activeFeed1.polls.map((p) => p.id);

  assert(activePollIds1.includes(allUsersPoll.id), 'ALL_USERS poll with null dates appears in Student Active Polls feed.');
  assert(activePollIds1.includes(studentsPoll.id), 'STUDENTS poll with null dates appears in Student Active Polls feed.');
  assert(activePollIds1.includes(class1Poll.id), 'CLASS_STUDENTS poll for Class 1 appears for enrolled Student 1.');
  assert(!activePollIds1.includes(teacherOnlyPoll.id), 'TEACHERS poll strictly hidden from Student.');
  assert(!activePollIds1.includes(parentOnlyPoll.id), 'PARENTS poll strictly hidden from Student.');

  // Check 3: Active polls feed for Student 2 (in Class 2)
  const simulatedAuthStudent2 = {
    id: student2User.id,
    username: student2User.username,
    email: student2User.email,
    role: 'STUDENT',
    isActive: true,
    instituteId: institute.id,
  };
  const activeFeed2 = await pollService.getRecipientEligiblePolls(institute.id, simulatedAuthStudent2, { status: 'ACTIVE' });
  const activePollIds2 = activeFeed2.polls.map((p) => p.id);
  assert(!activePollIds2.includes(class1Poll.id), 'CLASS_STUDENTS poll for Class 1 strictly hidden from Student 2 in Class 2.');

  // Check 4: Upcoming polls feed for Student 1
  const upcomingFeed = await pollService.getRecipientEligiblePolls(institute.id, simulatedAuthStudent1, { status: 'UPCOMING' });
  const upcomingPollIds = upcomingFeed.polls.map((p) => p.id);
  assert(upcomingPollIds.includes(upcomingPoll.id), 'Scheduled poll appears in Student Upcoming Polls feed.');

  // Check 5: Voting on ALL_USERS Poll with null dates works cleanly
  const voteResult = await pollService.submitVote(
    institute.id,
    simulatedAuthStudent1,
    allUsersPoll.id,
    allUsersPoll.options[0].id
  );
  assert(voteResult.success === true, 'Student successfully votes in published ALL_USERS poll with null dates.');

  // Check 6: Recipient feed reflects vote state
  const feedAfterVote = await pollService.getRecipientEligiblePolls(institute.id, simulatedAuthStudent1, { status: 'ACTIVE' });
  const votedPoll = feedAfterVote.polls.find((p) => p.id === allUsersPoll.id);
  assert(votedPoll?.hasVoted === true && votedPoll?.userVotedOptionId === allUsersPoll.options[0].id, 'Student feed accurately reports hasVoted: true and chosen option.');

  // Check 7: Completed polls feed
  await pollService.updatePollStatus(institute.id, allUsersPoll.id, 'CLOSED');
  const completedFeed = await pollService.getRecipientEligiblePolls(institute.id, simulatedAuthStudent1, { status: 'COMPLETED' });
  const completedPollIds = completedFeed.polls.map((p) => p.id);
  assert(completedPollIds.includes(allUsersPoll.id), 'Closed poll appears in Student Completed Polls feed.');

  console.log('\n================================================================');
  console.log(`  🎉 ALL ${passed}/${total} STUDENT PORTAL POLL CHECKS PASSED!`);
  console.log('================================================================\n');
}

runStudentPollVisibilityAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Audit Error:', err);
    process.exit(1);
  });
