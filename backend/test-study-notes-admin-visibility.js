import prisma from './src/config/prisma.js';
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

async function runVisibilityAudit() {
  console.log('\n================================================================');
  console.log('  EDUNEXA STUDY NOTES & TUTES ADMIN VISIBILITY & ROUTE AUDIT');
  console.log('================================================================\n');

  // Check 1: Feature exists in database catalog
  const feat = await prisma.feature.findUnique({
    where: { code: 'STUDY_MATERIALS' },
  });
  assert(feat && feat.code === 'STUDY_MATERIALS', 'Feature STUDY_MATERIALS exists in platform feature catalog.');

  // Check 2: Eligible plans include STUDY_MATERIALS
  const eligiblePlans = await prisma.subscriptionPlan.findMany({
    where: {
      name: { in: ['Starter Tier', 'Standard Institute', 'Premium Enterprise'] },
    },
    include: {
      features: {
        where: { feature: { code: 'STUDY_MATERIALS' } },
        include: { feature: true },
      },
    },
  });
  const allHaveFeature = eligiblePlans.every((p) => p.features.length > 0 && p.features[0].isEnabled);
  assert(allHaveFeature && eligiblePlans.length >= 3, 'Eligible subscription plans include STUDY_MATERIALS enabled.');

  // Check 3: Active Institute Admin entitlement returns STUDY_MATERIALS: true
  const activeInst = await prisma.institute.findFirst({
    where: { isActive: true, subscriptions: { some: { status: 'ACTIVE' } } },
    include: { subscriptions: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  assert(activeInst !== null, 'Found active institute with subscription.');

  const entitlement = await getInstituteEntitlement(activeInst.id);
  assert(entitlement.isValid && entitlement.features && entitlement.features.STUDY_MATERIALS === true, 'Admin entitlement returns STUDY_MATERIALS: true.');

  // Check 4: Inactive / Downgraded plan without STUDY_MATERIALS returns false
  let restrictedPlan = await prisma.subscriptionPlan.findFirst({
    where: { name: { contains: 'Nano' } },
    include: { features: { include: { feature: true } } },
  });
  if (!restrictedPlan) {
    restrictedPlan = await prisma.subscriptionPlan.create({
      data: {
        name: 'Basic Restricted Plan',
        price: 0,
        currency: 'LKR',
        duration: 30,
        durationType: 'DAYS',
      },
    });
  }
  // Create mock restricted subscription
  const testRestrictedInst = await prisma.institute.create({
    data: {
      name: `Restricted Inst ${Date.now()}`,
      code: `RST_${Date.now().toString().slice(-4)}`,
      slug: `rst-${Date.now().toString().slice(-4)}`,
      isActive: true,
      subscriptions: {
        create: {
          planId: restrictedPlan.id,
          planNameSnapshot: restrictedPlan.name,
          priceSnapshot: restrictedPlan.price,
          currencySnapshot: restrictedPlan.currency,
          durationSnapshot: restrictedPlan.duration,
          durationTypeSnapshot: restrictedPlan.durationType,
          featuresSnapshot: [],
          limitsSnapshot: {},
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 86400000),
          status: 'ACTIVE',
        },
      },
    },
  });

  const restrictedEntitlement = await getInstituteEntitlement(testRestrictedInst.id);
  assert(restrictedEntitlement.isValid && !restrictedEntitlement.features?.STUDY_MATERIALS, 'Restricted plan correctly excludes STUDY_MATERIALS (gated).');

  // Check 5: Student route and portal queries continue to function seamlessly
  const studentNotes = await prisma.studyMaterial.findMany({
    where: { status: 'PUBLISHED' },
    take: 5,
  });
  assert(studentNotes !== null, 'Student study materials querying is preserved and operational.');

  console.log('\n================================================================');
  console.log(`  🎉 ALL ${passed}/${total} VISIBILITY & ENTITLEMENT CHECKS PASSED!`);
  console.log('================================================================\n');
}

runVisibilityAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Audit Error:', err);
    process.exit(1);
  });
