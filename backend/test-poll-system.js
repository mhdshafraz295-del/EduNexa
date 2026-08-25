import prisma from './src/config/prisma.js';
import * as pollService from './src/services/poll.service.js';
import { getInstituteEntitlement } from './src/services/entitlement.service.js';

let passed = 0;
let total = 0;

function assert(condition, msg) {
  total++;
  if (condition) {
    console.log(`  ✓ Test ${total}: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ Test ${total} FAILED: ${msg}`);
    throw new Error(`Failed test: ${msg}`);
  }
}

async function runPollTestSuite() {
  console.log('\n================================================================');
  console.log('  EDUNEXA STEP 12: POLL & VOTING SYSTEM TEST SUITE');
  console.log('================================================================\n');

  // Phase 1: Setup Test Institutes, Users, Classes
  console.log('--- Phase 1: Setup & Isolation Fixtures ---');
  const timestamp = Date.now();

  const plan = await prisma.subscriptionPlan.findFirst({
    where: { name: 'Starter Tier' },
  });

  const instituteA = await prisma.institute.create({
    data: {
      name: `Poll Academy A ${timestamp}`,
      code: `PAA_${timestamp.toString().slice(-4)}`,
      slug: `paa-${timestamp.toString().slice(-4)}`,
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

  const instituteB = await prisma.institute.create({
    data: {
      name: `Poll Academy B ${timestamp}`,
      code: `PAB_${timestamp.toString().slice(-4)}`,
      slug: `pab-${timestamp.toString().slice(-4)}`,
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

  // Users for Institute A
  const adminAUser = await prisma.user.create({
    data: {
      username: `admin_a_${timestamp}`,
      email: `admin_a_${timestamp}@test.com`,
      passwordHash: 'hashed_pwd',
      role: 'ADMIN',
      instituteId: instituteA.id,
    },
  });

  const studentA1User = await prisma.user.create({
    data: {
      username: `student_a1_${timestamp}`,
      email: `student_a1_${timestamp}@test.com`,
      passwordHash: 'hashed_pwd',
      role: 'STUDENT',
      instituteId: instituteA.id,
    },
  });

  const studentA2User = await prisma.user.create({
    data: {
      username: `student_a2_${timestamp}`,
      email: `student_a2_${timestamp}@test.com`,
      passwordHash: 'hashed_pwd',
      role: 'STUDENT',
      instituteId: instituteA.id,
    },
  });

  const teacherAUser = await prisma.user.create({
    data: {
      username: `teacher_a_${timestamp}`,
      email: `teacher_a_${timestamp}@test.com`,
      passwordHash: 'hashed_pwd',
      role: 'TEACHER',
      instituteId: instituteA.id,
    },
  });

  const parentAUser = await prisma.user.create({
    data: {
      username: `parent_a_${timestamp}`,
      email: `parent_a_${timestamp}@test.com`,
      passwordHash: 'hashed_pwd',
      role: 'PARENT',
      instituteId: instituteA.id,
    },
  });

  // User for Institute B (Cross-tenant)
  const studentBUser = await prisma.user.create({
    data: {
      username: `student_b_${timestamp}`,
      email: `student_b_${timestamp}@test.com`,
      passwordHash: 'hashed_pwd',
      role: 'STUDENT',
      instituteId: instituteB.id,
    },
  });

  // Create Classes and Profile bindings
  const classA1 = await prisma.class.create({
    data: {
      instituteId: instituteA.id,
      name: `Grade 10-A ${timestamp}`,
      section: 'A',
    },
  });

  const classA2 = await prisma.class.create({
    data: {
      instituteId: instituteA.id,
      name: `Grade 10-B ${timestamp}`,
      section: 'B',
    },
  });

  const studentProfileA1 = await prisma.student.create({
    data: {
      userId: studentA1User.id,
      instituteId: instituteA.id,
      classId: classA1.id,
      name: 'Alice Student',
      admissionNumber: `ADM_${timestamp}_1`,
    },
  });

  const studentProfileA2 = await prisma.student.create({
    data: {
      userId: studentA2User.id,
      instituteId: instituteA.id,
      classId: classA2.id,
      name: 'Bob Student',
      admissionNumber: `ADM_${timestamp}_2`,
    },
  });

  const teacherProfileA = await prisma.teacher.create({
    data: {
      userId: teacherAUser.id,
      instituteId: instituteA.id,
      name: 'Mr. John Teacher',
      employeeId: `EMP_${timestamp}`,
    },
  });

  // Assign teacher to Class A1
  await prisma.class.update({
    where: { id: classA1.id },
    data: { classTeacherId: teacherProfileA.id },
  });

  const parentProfileA = await prisma.parent.create({
    data: {
      userId: parentAUser.id,
      instituteId: instituteA.id,
      name: 'Alice Parent',
    },
  });

  // Link Parent to Student A1
  await prisma.parentStudent.create({
    data: {
      parentId: parentProfileA.id,
      studentId: studentProfileA1.id,
      relationship: 'Mother',
    },
  });

  assert(instituteA.id && instituteB.id, 'Test institutes and relation fixtures initialized.');

  // Phase 2: Feature Entitlement
  console.log('\n--- Phase 2: POLLS Feature Entitlement ---');
  const entA = await getInstituteEntitlement(instituteA.id);
  assert(entA.isValid && entA.features.POLLS === true, 'POLLS feature enabled for active institute subscription.');

  // Phase 3: Poll Validation Rules
  console.log('\n--- Phase 3: Admin Poll Validation Rules ---');
  // Less than 2 options
  let errThrown = false;
  try {
    await pollService.createPoll(instituteA.id, adminAUser.id, {
      title: 'Invalid Poll',
      options: ['Only One Option'],
    });
  } catch (e) {
    errThrown = true;
  }
  assert(errThrown, 'Poll creation with < 2 options strictly rejected.');

  // Blank title
  errThrown = false;
  try {
    await pollService.createPoll(instituteA.id, adminAUser.id, {
      title: '   ',
      options: ['Option 1', 'Option 2'],
    });
  } catch (e) {
    errThrown = true;
  }
  assert(errThrown, 'Poll creation with blank title rejected.');

  // Invalid date range (startsAt >= endsAt)
  errThrown = false;
  try {
    await pollService.createPoll(instituteA.id, adminAUser.id, {
      title: 'Date Test Poll',
      options: ['Opt 1', 'Opt 2'],
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 43200000),
    });
  } catch (e) {
    errThrown = true;
  }
  assert(errThrown, 'Poll creation with start time >= end time rejected.');

  // Cross-tenant class ID
  errThrown = false;
  try {
    await pollService.createPoll(instituteA.id, adminAUser.id, {
      title: 'Cross Tenant Class Poll',
      audienceType: 'CLASS_STUDENTS',
      classId: 999999,
      options: ['Opt 1', 'Opt 2'],
    });
  } catch (e) {
    errThrown = true;
  }
  assert(errThrown, 'Poll creation with cross-tenant/invalid classId rejected.');

  // Phase 4: Create & Manage Polls
  console.log('\n--- Phase 4: Create Draft, Scheduled & Active Polls ---');
  // 1. ALL_USERS Active Poll
  const allUsersPoll = await pollService.createPoll(instituteA.id, adminAUser.id, {
    title: 'Annual Day Theme 2026',
    description: 'Vote for your favorite theme',
    audienceType: 'ALL_USERS',
    status: 'ACTIVE',
    anonymous: true,
    resultVisibility: 'LIVE',
    allowVoteChange: true,
    options: ['Science & Futurism', 'Cultural Heritage', 'Eco Green Earth'],
  });
  assert(allUsersPoll.id && allUsersPoll.options.length === 3, 'Created ALL_USERS active poll with 3 options.');

  // 2. CLASS_STUDENTS Active Poll for Class A1
  const classStudentsPoll = await pollService.createPoll(instituteA.id, adminAUser.id, {
    title: 'Grade 10-A Class Trip Destination',
    description: 'Select your preferred trip location',
    audienceType: 'CLASS_STUDENTS',
    classId: classA1.id,
    status: 'ACTIVE',
    anonymous: true,
    resultVisibility: 'AFTER_VOTE',
    allowVoteChange: false,
    options: ['Kandy Botanical Garden', 'Sigiriya Rock Fortress', 'Galle Fort Beach'],
  });
  assert(classStudentsPoll.id && classStudentsPoll.classId === classA1.id, 'Created CLASS_STUDENTS targeted poll for Class A1.');

  // 3. CLASS_TEACHERS Poll
  const classTeachersPoll = await pollService.createPoll(instituteA.id, adminAUser.id, {
    title: 'Grade 10-A Meeting Time',
    audienceType: 'CLASS_TEACHERS',
    classId: classA1.id,
    status: 'ACTIVE',
    options: ['Monday 3 PM', 'Wednesday 2 PM'],
  });
  assert(classTeachersPoll.id, 'Created CLASS_TEACHERS poll.');

  // 4. CLASS_PARENTS Poll
  const classParentsPoll = await pollService.createPoll(instituteA.id, adminAUser.id, {
    title: 'Grade 10-A Parent Workshop Day',
    audienceType: 'CLASS_PARENTS',
    classId: classA1.id,
    status: 'ACTIVE',
    options: ['Saturday Morning', 'Sunday Afternoon'],
  });
  assert(classParentsPoll.id, 'Created CLASS_PARENTS poll.');

  // Phase 5: Eligibility Verification
  console.log('\n--- Phase 5: Server-Authoritative Eligibility Checks ---');
  // ALL_USERS
  const a1AllEligible = await pollService.checkUserPollEligibility(instituteA.id, allUsersPoll, studentA1User);
  const teacherAllEligible = await pollService.checkUserPollEligibility(instituteA.id, allUsersPoll, teacherAUser);
  const parentAllEligible = await pollService.checkUserPollEligibility(instituteA.id, allUsersPoll, parentAUser);
  const adminAllEligible = await pollService.checkUserPollEligibility(instituteA.id, allUsersPoll, adminAUser);
  const crossTenantEligible = await pollService.checkUserPollEligibility(instituteA.id, allUsersPoll, studentBUser);

  assert(a1AllEligible && teacherAllEligible && parentAllEligible && adminAllEligible, 'All tenant roles eligible for ALL_USERS poll.');
  assert(!crossTenantEligible, 'Cross-tenant user strictly NOT eligible for Institute A poll.');

  // CLASS_STUDENTS
  const a1ClassEligible = await pollService.checkUserPollEligibility(instituteA.id, classStudentsPoll, studentA1User);
  const a2ClassEligible = await pollService.checkUserPollEligibility(instituteA.id, classStudentsPoll, studentA2User);
  const teacherClassEligible = await pollService.checkUserPollEligibility(instituteA.id, classStudentsPoll, teacherAUser);

  assert(a1ClassEligible, 'Enrolled student in Class A1 is eligible for CLASS_STUDENTS poll.');
  assert(!a2ClassEligible, 'Student in Class A2 is NOT eligible for Class A1 poll.');
  assert(!teacherClassEligible, 'Teacher is NOT eligible for CLASS_STUDENTS poll.');

  // CLASS_TEACHERS
  const teacherEligible = await pollService.checkUserPollEligibility(instituteA.id, classTeachersPoll, teacherAUser);
  const studentInTeacherPoll = await pollService.checkUserPollEligibility(instituteA.id, classTeachersPoll, studentA1User);
  assert(teacherEligible, 'Assigned class teacher is eligible for CLASS_TEACHERS poll.');
  assert(!studentInTeacherPoll, 'Student is NOT eligible for CLASS_TEACHERS poll.');

  // CLASS_PARENTS
  const parentEligible = await pollService.checkUserPollEligibility(instituteA.id, classParentsPoll, parentAUser);
  const studentInParentPoll = await pollService.checkUserPollEligibility(instituteA.id, classParentsPoll, studentA1User);
  assert(parentEligible, 'Linked parent of Class A1 student is eligible for CLASS_PARENTS poll.');
  assert(!studentInParentPoll, 'Student is NOT eligible for CLASS_PARENTS poll.');

  // Phase 6: Voting Mechanics & One User One Vote
  console.log('\n--- Phase 6: Voting Mechanics & One User = One Vote ---');
  const opt1 = allUsersPoll.options[0].id;
  const opt2 = allUsersPoll.options[1].id;
  const opt3 = allUsersPoll.options[2].id;

  // First vote by Student A1
  const voteRes1 = await pollService.submitVote(instituteA.id, studentA1User, allUsersPoll.id, opt1);
  assert(voteRes1.success && voteRes1.votedOptionId === opt1, 'Student A1 voted for Option 1 successfully.');

  // Verify exactly 1 vote in database
  const votesCount1 = await prisma.pollVote.count({
    where: { pollId: allUsersPoll.id, userId: studentA1User.id },
  });
  assert(votesCount1 === 1, 'Database confirms exactly 1 vote row created.');

  // Student A1 changes vote to Option 2 (allowVoteChange = true)
  const changeRes = await pollService.submitVote(instituteA.id, studentA1User, allUsersPoll.id, opt2);
  assert(changeRes.success && changeRes.votedOptionId === opt2, 'Student A1 successfully changed vote to Option 2.');

  const votesCountAfterChange = await prisma.pollVote.count({
    where: { pollId: allUsersPoll.id, userId: studentA1User.id },
  });
  assert(votesCountAfterChange === 1, 'Database confirms still exactly 1 vote row after vote change.');

  // Student A2 votes on Class Students poll (allowVoteChange = false)
  const classOpt1 = classStudentsPoll.options[0].id;
  const classOpt2 = classStudentsPoll.options[1].id;

  const classVoteRes = await pollService.submitVote(instituteA.id, studentA1User, classStudentsPoll.id, classOpt1);
  assert(classVoteRes.success, 'Student A1 voted in Class Students poll.');

  // Student A1 attempts duplicate vote with allowVoteChange = false
  let duplicateBlocked = false;
  try {
    await pollService.submitVote(instituteA.id, studentA1User, classStudentsPoll.id, classOpt2);
  } catch (e) {
    if (e.statusCode === 409 || e.message?.includes('already voted')) {
      duplicateBlocked = true;
    }
  }
  assert(duplicateBlocked, 'Duplicate vote strictly blocked with 409 when allowVoteChange is false.');

  // Invalid option from another poll
  let invalidOptBlocked = false;
  try {
    await pollService.submitVote(instituteA.id, studentA1User, classStudentsPoll.id, opt1);
  } catch (e) {
    invalidOptBlocked = true;
  }
  assert(invalidOptBlocked, 'Submitting optionId from another poll rejected.');

  // Ineligible user voting attempt (Student A2 on Class A1 poll)
  let ineligibleVoteBlocked = false;
  try {
    await pollService.submitVote(instituteA.id, studentA2User, classStudentsPoll.id, classOpt1);
  } catch (e) {
    ineligibleVoteBlocked = true;
  }
  assert(ineligibleVoteBlocked, 'Ineligible student voting attempt rejected.');

  // Cross-tenant voting attempt
  let crossTenantVoteBlocked = false;
  try {
    await pollService.submitVote(instituteA.id, studentBUser, allUsersPoll.id, opt1);
  } catch (e) {
    crossTenantVoteBlocked = true;
  }
  assert(crossTenantVoteBlocked, 'Cross-tenant vote attempt strictly rejected.');

  // Phase 7: Result Visibility Policies
  console.log('\n--- Phase 7: Result Visibility Policies (NEVER, AFTER_VOTE, LIVE, AFTER_CLOSE) ---');
  // 1. LIVE Results visibility on allUsersPoll
  const feedForStudentA1 = await pollService.getRecipientEligiblePolls(instituteA.id, studentA1User, { status: 'ACTIVE' });
  const livePollView = feedForStudentA1.polls.find((p) => p.id === allUsersPoll.id);
  assert(livePollView && livePollView.canViewResults === true && livePollView.totalVotes === 1, 'LIVE poll exposes aggregate counts.');

  // 2. AFTER_VOTE Results visibility on classStudentsPoll
  // Student A1 has voted -> canViewResults is true
  const feedVoted = await pollService.getRecipientEligiblePolls(instituteA.id, studentA1User, { status: 'ACTIVE' });
  const classPollViewVoted = feedVoted.polls.find((p) => p.id === classStudentsPoll.id);
  assert(classPollViewVoted && classPollViewVoted.canViewResults === true, 'AFTER_VOTE exposes results to user who has voted.');

  // Create another AFTER_VOTE poll where student has NOT voted
  const afterVoteUnvotedPoll = await pollService.createPoll(instituteA.id, adminAUser.id, {
    title: 'Unvoted Secret Poll',
    audienceType: 'ALL_USERS',
    status: 'ACTIVE',
    resultVisibility: 'AFTER_VOTE',
    options: ['Secret A', 'Secret B'],
  });

  const feedUnvoted = await pollService.getRecipientEligiblePolls(instituteA.id, studentA2User, { status: 'ACTIVE' });
  const unvotedPollView = feedUnvoted.polls.find((p) => p.id === afterVoteUnvotedPoll.id);
  assert(unvotedPollView && unvotedPollView.canViewResults === false && unvotedPollView.options[0].voteCount === undefined, 'AFTER_VOTE masks result counts before user votes.');

  // 3. NEVER Results visibility
  const neverPoll = await pollService.createPoll(instituteA.id, adminAUser.id, {
    title: 'Anonymous Confidential Feedback',
    audienceType: 'ALL_USERS',
    status: 'ACTIVE',
    resultVisibility: 'NEVER',
    options: ['Great', 'Needs Improvement'],
  });
  await pollService.submitVote(instituteA.id, studentA1User, neverPoll.id, neverPoll.options[0].id);
  const feedNever = await pollService.getRecipientEligiblePolls(instituteA.id, studentA1User, { status: 'ACTIVE' });
  const neverPollView = feedNever.polls.find((p) => p.id === neverPoll.id);
  assert(neverPollView && neverPollView.canViewResults === false && neverPollView.options[0].voteCount === undefined, 'NEVER policy hides result counts even after voting.');

  // 4. AFTER_CLOSE Results visibility
  const afterClosePoll = await pollService.createPoll(instituteA.id, adminAUser.id, {
    title: 'Secret Election 2026',
    audienceType: 'ALL_USERS',
    status: 'ACTIVE',
    resultVisibility: 'AFTER_CLOSE',
    options: ['Candidate X', 'Candidate Y'],
  });
  await pollService.submitVote(instituteA.id, studentA1User, afterClosePoll.id, afterClosePoll.options[0].id);

  // Active state: results hidden
  const feedBeforeClose = await pollService.getRecipientEligiblePolls(instituteA.id, studentA1User, { status: 'ACTIVE' });
  const viewBeforeClose = feedBeforeClose.polls.find((p) => p.id === afterClosePoll.id);
  assert(viewBeforeClose && viewBeforeClose.canViewResults === false, 'AFTER_CLOSE hides results while poll is ACTIVE.');

  // Close poll now
  await pollService.updatePollStatus(instituteA.id, afterClosePoll.id, 'CLOSED');
  const feedAfterClose = await pollService.getRecipientEligiblePolls(instituteA.id, studentA1User, { status: 'COMPLETED' });
  const viewAfterClose = feedAfterClose.polls.find((p) => p.id === afterClosePoll.id);
  assert(viewAfterClose && viewAfterClose.canViewResults === true && viewAfterClose.totalVotes === 1, 'AFTER_CLOSE unmasks results once poll is CLOSED.');

  // Phase 8: Status Lifecycle & Scheduling
  console.log('\n--- Phase 8: Status Lifecycle, Scheduling & Manual Close ---');
  // Scheduled poll in future
  const scheduledPoll = await pollService.createPoll(instituteA.id, adminAUser.id, {
    title: 'Future Poll Tomorrow',
    audienceType: 'ALL_USERS',
    status: 'ACTIVE',
    startsAt: new Date(Date.now() + 86400000),
    endsAt: new Date(Date.now() + 172800000),
    options: ['Future 1', 'Future 2'],
  });
  assert(scheduledPoll.status === 'SCHEDULED', 'Poll with future startsAt is derived as SCHEDULED.');

  // Voting on SCHEDULED poll blocked
  let earlyVoteBlocked = false;
  try {
    await pollService.submitVote(instituteA.id, studentA1User, scheduledPoll.id, scheduledPoll.options[0].id);
  } catch (e) {
    earlyVoteBlocked = true;
  }
  assert(earlyVoteBlocked, 'Voting on SCHEDULED poll rejected.');

  // Voting on CLOSED poll blocked
  let closedVoteBlocked = false;
  try {
    await pollService.submitVote(instituteA.id, studentA2User, afterClosePoll.id, afterClosePoll.options[0].id);
  } catch (e) {
    closedVoteBlocked = true;
  }
  assert(closedVoteBlocked, 'Voting on CLOSED poll rejected.');

  // Phase 9: Admin Analytics & Anonymous Privacy
  console.log('\n--- Phase 9: Real Admin Analytics & Privacy ---');
  // Add votes to allUsersPoll
  await pollService.submitVote(instituteA.id, studentA2User, allUsersPoll.id, opt2);
  await pollService.submitVote(instituteA.id, teacherAUser, allUsersPoll.id, opt3);

  const adminAnalytics = await pollService.getAdminPollById(instituteA.id, allUsersPoll.id);
  assert(adminAnalytics.totalVotes === 3, 'Admin analytics accurately reports 3 total votes.');
  assert(adminAnalytics.options[1].voteCount === 2, 'Option 2 accurately reports 2 votes.');
  assert(adminAnalytics.options[2].voteCount === 1, 'Option 3 accurately reports 1 vote.');
  assert(adminAnalytics.eligibleUsersCount >= 5, 'Eligible user count calculated from real MySQL users.');
  assert(adminAnalytics.participationPercent > 0, 'Participation percentage calculated correctly.');

  // Overall KPIs
  const overallKPIs = await pollService.getAdminOverallAnalytics(instituteA.id);
  assert(overallKPIs.totalPolls >= 5 && overallKPIs.totalVotes >= 5, 'Overall institute KPIs aggregated from real MySQL data.');

  // Phase 10: Non-Interference & Regressions
  console.log('\n--- Phase 10: Non-Interference Verification ---');
  const studyMaterialsCount = await prisma.studyMaterial.count();
  assert(studyMaterialsCount !== undefined, 'Study materials module and database tables intact.');

  const conversationsCount = await prisma.conversation.count();
  assert(conversationsCount !== undefined, 'Messaging module and database tables intact.');

  console.log('\n================================================================');
  console.log(`  🎉 ALL ${passed}/${total} TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

runPollTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Test Suite Error:', err);
    process.exit(1);
  });
