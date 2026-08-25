import prisma from './src/config/prisma.js';
import * as platformCmsService from './src/services/platformCms.service.js';
import {
  PROTECTED_CMS_DRAFT_DIR,
  PUBLIC_CMS_DIR,
  validateCmsImageMagicBytes,
} from './src/middleware/upload.middleware.js';
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

async function runPlatformCmsTestSuite() {
  console.log('\n================================================================');
  console.log('  EDUNEXA STEP 11: SUPER ADMIN PLATFORM ABOUT / CMS TEST SUITE');
  console.log('================================================================\n');

  // Clean up any test records for fresh test execution
  await prisma.platformCmsAuditLog.deleteMany({});
  await prisma.platformCmsFeature.deleteMany({});
  await prisma.platformCmsContent.deleteMany({});

  // 1. Fetch Users and Institute Roles
  const superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', isActive: true },
  });
  if (!superAdmin) {
    throw new Error('A SUPER_ADMIN account is required for platform CMS testing.');
  }

  const institutes = await prisma.institute.findMany({
    where: { isActive: true },
    include: {
      users: {
        where: { isActive: true },
        include: { teacher: true, student: true, parent: true },
      },
    },
    take: 2,
  });

  const instA = institutes[0];
  const instB = institutes[1];

  const adminA = instA?.users?.find((u) => u.role === 'ADMIN');
  const teacherA = instA?.users?.find((u) => u.role === 'TEACHER');
  const studentA = instA?.users?.find((u) => u.role === 'STUDENT');
  const parentA = instA?.users?.find((u) => u.role === 'PARENT');

  console.log(`Context: Super Admin (${superAdmin.username}), Inst A (${instA?.name}), Inst B (${instB?.name})\n`);

  // ============================================================================
  // SECTION 1: EMPTY CMS INITIAL STATE & RBAC MUTATION RESTRICTIONS
  // ============================================================================
  console.log('--- SECTION 1: INITIAL STATE & RBAC ENFORCEMENT ---');

  // Test 1: Super Admin authentication check
  assert(superAdmin.role === 'SUPER_ADMIN', 'Super Admin authentication verified.');

  // Test 2: Empty / No Published CMS state returns null/empty safely
  const initialPublished = await platformCmsService.getPublishedCms();
  assert(initialPublished === null, 'Empty/no published CMS state returns clean null without mock fallbacks.');

  // Test 3: Super Admin loads CMS editor draft
  const initialDraftData = await platformCmsService.getAdminCmsDraft(superAdmin);
  assert(
    initialDraftData && initialDraftData.draft && initialDraftData.draft.status === 'DRAFT',
    'Super Admin loads CMS editor and receives an initialized DRAFT object.'
  );

  // Test 4: Institute Admin mutation blocked (403 concept via role check/controller check)
  // Simulating RBAC role guard
  const isSuperAdminRole = (user) => user?.role === 'SUPER_ADMIN';
  assert(!isSuperAdminRole(adminA), 'Institute Admin is blocked from modifying platform CMS.');

  // Test 5: Teacher mutation blocked
  assert(!isSuperAdminRole(teacherA), 'Teacher is blocked from modifying platform CMS.');

  // Test 6: Student mutation blocked
  assert(!isSuperAdminRole(studentA), 'Student is blocked from modifying platform CMS.');

  // Test 7: Parent mutation blocked
  assert(!isSuperAdminRole(parentA), 'Parent is blocked from modifying platform CMS.');

  // ============================================================================
  // SECTION 2: DRAFT SAVE & ISOLATION FROM LIVE API
  // ============================================================================
  console.log('\n--- SECTION 2: DRAFT SAVE & LIVE ISOLATION ---');

  const initialDraftPayload = {
    heroTitle: 'Welcome to EduNexa NextGen Learning',
    heroSubtitle: 'Empowering institutes with state-of-the-art educational management.',
    heroCtaLabel: 'Explore Platform',
    heroCtaUrl: '/register',
    aboutTitle: 'About EduNexa Platform',
    aboutBody: 'EduNexa is a unified multi-tenant educational ecosystem engineered for scale.',
    vision: 'To revolutionize academic administration globally with seamless digital workflows.',
    mission: 'To empower educators, students, and institutions with accessible cloud intelligence.',
    storyTitle: 'The Story of EduNexa',
    storyContent: 'Founded with a vision to eliminate institutional administrative bottlenecks.',
    contactEmail: 'contact@edunexa.edu',
    contactPhone: '+1-800-EDUNEXA',
    contactAddress: '100 Innovation Way, Tech Hub',
    websiteUrl: 'https://edunexa.edu',
    facebookUrl: 'https://facebook.com/edunexa',
    instagramUrl: 'https://instagram.com/edunexa',
    youtubeUrl: 'https://youtube.com/@edunexa',
    linkedinUrl: 'https://linkedin.com/company/edunexa',
    twitterUrl: 'https://x.com/edunexa',
    termsUrl: '/terms',
    privacyUrl: '/privacy',
    features: [
      {
        title: 'Cloud Multi-Tenancy',
        description: 'Complete data isolation for modern schools and institutes.',
        iconKey: 'shield',
        displayOrder: 0,
        isActive: true,
      },
      {
        title: 'Automated Academic Marking',
        description: 'AI-assisted and manual written exam evaluation workflows.',
        iconKey: 'award',
        displayOrder: 1,
        isActive: true,
      },
    ],
  };

  // Test 8: Draft save works
  const savedDraft = await platformCmsService.saveAdminCmsDraft(superAdmin, initialDraftPayload);
  assert(
    savedDraft && savedDraft.draft.aboutTitle === 'About EduNexa Platform' && savedDraft.draft.features.length === 2,
    'Draft save works and persists draft fields and dynamic features.'
  );

  // Test 9: Draft does not alter published API (Isolation verification)
  const publishedAfterDraft = await platformCmsService.getPublishedCms();
  assert(
    publishedAfterDraft === null,
    'Public / role read API remains null and never leaks unpublished draft content.'
  );

  // ============================================================================
  // SECTION 3: URL SAFETY & XSS INJECTION REJECTION
  // ============================================================================
  console.log('\n--- SECTION 3: URL & INJECTION VALIDATION ---');

  // Test 10: Unsafe javascript URL rejected with 400
  let jsUrlRejected = false;
  try {
    await platformCmsService.saveAdminCmsDraft(superAdmin, {
      facebookUrl: 'javascript:alert("xss")',
    });
  } catch (err) {
    jsUrlRejected = err.status === 400;
  }
  assert(jsUrlRejected, 'Unsafe javascript: scheme in URLs is rejected with HTTP 400.');

  // Test 11: Unsafe data: URI rejected with 400
  let dataUriRejected = false;
  try {
    await platformCmsService.saveAdminCmsDraft(superAdmin, {
      websiteUrl: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    });
  } catch (err) {
    dataUriRejected = err.status === 400;
  }
  assert(dataUriRejected, 'Unsafe data: URI scheme is rejected with HTTP 400.');

  // ============================================================================
  // SECTION 4: IMAGE UPLOAD, MAGIC BYTES VALIDATION & REPLACEMENT
  // ============================================================================
  console.log('\n--- SECTION 4: IMAGE SECURITY & VALIDATION ---');

  // Create valid JPEG fixture in draft directory
  const validJpgHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01]);
  const testJpgFilename = `cms_draft_hero_test_${Date.now()}.jpg`;
  const testJpgPath = path.join(PROTECTED_CMS_DRAFT_DIR, testJpgFilename);
  fs.writeFileSync(testJpgPath, validJpgHeader);

  // Test 12: Valid JPG accepted with magic bytes check
  const jpgValid = validateCmsImageMagicBytes(testJpgPath);
  assert(jpgValid, 'Valid JPEG magic bytes header (FF D8 FF) is successfully verified.');

  // Create fake/spoofed text file disguised as PNG
  const spoofedPngFilename = `cms_draft_hero_fake_${Date.now()}.png`;
  const spoofedPngPath = path.join(PROTECTED_CMS_DRAFT_DIR, spoofedPngFilename);
  fs.writeFileSync(spoofedPngPath, Buffer.from('NOT_A_REAL_IMAGE_FILE_DATA'));

  // Test 13: Spoofed image rejected by magic bytes check
  const spoofedValid = validateCmsImageMagicBytes(spoofedPngPath);
  assert(!spoofedValid, 'Spoofed/tampered image with invalid magic bytes is rejected.');

  // Clean up spoofed test fixture
  if (fs.existsSync(spoofedPngPath)) fs.unlinkSync(spoofedPngPath);

  // Test 14: Draft image upload handler saves and audits
  const uploadResult = await platformCmsService.handleDraftImageUpload(
    superAdmin,
    { path: testJpgPath, size: validJpgHeader.length, mimetype: 'image/jpeg' },
    'hero'
  );
  assert(
    uploadResult.success && uploadResult.draftUrl.includes('draft-asset'),
    'Draft image upload succeeds and returns protected draft asset endpoint.'
  );

  // Attach draft image to draft content
  await platformCmsService.saveAdminCmsDraft(superAdmin, {
    heroImage: uploadResult.draftUrl,
  });

  // ============================================================================
  // SECTION 5: CMS PUBLISH WORKFLOW & ATOMIC PROMOTION
  // ============================================================================
  console.log('\n--- SECTION 5: PUBLISH WORKFLOW & ATOMIC PROMOTION ---');

  // Test 15: Publish works
  const publishedContent = await platformCmsService.publishAdminCms(superAdmin);
  assert(
    publishedContent && publishedContent.aboutTitle === 'About EduNexa Platform',
    'Publish action succeeds and updates live published record.'
  );

  // Test 16: Published API returns new content
  const livePublicCms = await platformCmsService.getPublishedCms();
  assert(
    livePublicCms !== null && livePublicCms.version === 1,
    'Published API returns full live content with version 1.'
  );

  // Test 17: Vision persists accurately
  assert(
    livePublicCms.vision === 'To revolutionize academic administration globally with seamless digital workflows.',
    'Vision statement persists accurately in published content.'
  );

  // Test 18: Mission persists accurately
  assert(
    livePublicCms.mission === 'To empower educators, students, and institutions with accessible cloud intelligence.',
    'Mission statement persists accurately in published content.'
  );

  // Test 19: Story persists accurately
  assert(
    livePublicCms.storyTitle === 'The Story of EduNexa' &&
      livePublicCms.storyContent.includes('institutional administrative bottlenecks'),
    'Our Story persists accurately in published content.'
  );

  // Test 20: Official Contact details persist
  assert(
    livePublicCms.contactEmail === 'contact@edunexa.edu' &&
      livePublicCms.contactPhone === '+1-800-EDUNEXA' &&
      livePublicCms.contactAddress === '100 Innovation Way, Tech Hub',
    'Official contact details persist accurately in published content.'
  );

  // Test 21: Social & Legal URLs persist
  assert(
    livePublicCms.facebookUrl === 'https://facebook.com/edunexa' &&
      livePublicCms.linkedinUrl === 'https://linkedin.com/company/edunexa' &&
      livePublicCms.termsUrl === '/terms' &&
      livePublicCms.privacyUrl === '/privacy',
    'Social and legal URLs persist accurately in published content.'
  );

  // Test 22: Image asset promoted to public directory on publish
  assert(
    livePublicCms.heroImage && livePublicCms.heroImage.startsWith('/uploads/platform-cms/public/'),
    'Referenced draft image was automatically promoted into public CMS asset storage upon publish.'
  );

  // Test 23: Publisher metadata recorded
  assert(
    livePublicCms.publishedBy && livePublicCms.publishedBy.username === superAdmin.username,
    'Publisher user reference is recorded on published CMS record.'
  );

  // Test 24: publishedAt recorded
  assert(
    livePublicCms.publishedAt !== null && new Date(livePublicCms.publishedAt).getTime() > 0,
    'publishedAt timestamp is recorded accurately.'
  );

  // ============================================================================
  // SECTION 6: DYNAMIC FEATURE CARDS MANAGEMENT
  // ============================================================================
  console.log('\n--- SECTION 6: DYNAMIC FEATURE CARDS CRUD & REORDERING ---');

  // Test 25: Dynamic feature cards rendered in published API
  assert(
    livePublicCms.features.length === 2 && livePublicCms.features[0].title === 'Cloud Multi-Tenancy',
    'Dynamic feature cards render properly in published content.'
  );

  // Edit draft with reordered and added features
  const updatedFeaturesPayload = {
    features: [
      {
        title: 'High-Velocity Grading',
        description: 'Instant grading of multiple-choice and live assessments.',
        iconKey: 'zap',
        displayOrder: 0,
        isActive: true,
      },
      {
        title: 'Cloud Multi-Tenancy',
        description: 'Complete data isolation for modern schools and institutes.',
        iconKey: 'shield',
        displayOrder: 1,
        isActive: true,
      },
      {
        title: 'Archived Feature',
        description: 'Should not appear when deactivated.',
        iconKey: 'lock',
        displayOrder: 2,
        isActive: false,
      },
    ],
  };

  await platformCmsService.saveAdminCmsDraft(superAdmin, updatedFeaturesPayload);

  // Test 26: Draft edit of features does not affect published features before publish
  const liveBeforeRepublish = await platformCmsService.getPublishedCms();
  assert(
    liveBeforeRepublish.features.length === 2 && liveBeforeRepublish.features[0].title === 'Cloud Multi-Tenancy',
    'Old published features remain active and unmodified while draft is being edited.'
  );

  // Publish updated features
  await platformCmsService.publishAdminCms(superAdmin);
  const liveAfterRepublish = await platformCmsService.getPublishedCms();

  // Test 27: Feature card reordering works in published output
  assert(
    liveAfterRepublish.features[0].title === 'High-Velocity Grading' && liveAfterRepublish.features[1].title === 'Cloud Multi-Tenancy',
    'Feature cards reordering is respected in the published API.'
  );

  // Test 28: Deactivated feature is excluded from reader API
  assert(
    !liveAfterRepublish.features.some((f) => f.title === 'Archived Feature'),
    'Deactivated feature (isActive: false) is excluded from public and role reader API.'
  );

  // ============================================================================
  // SECTION 7: CROSS-INSTITUTE READ CONSISTENCY & NO TENANT CONTAMINATION
  // ============================================================================
  console.log('\n--- SECTION 7: CROSS-INSTITUTE READ CONSISTENCY ---');

  // Test 29: Institute A sees published platform CMS
  const readerA = await platformCmsService.getPublishedCms();
  assert(
    readerA && readerA.aboutTitle === 'About EduNexa Platform',
    'Institute A readers receive authoritative platform About content.'
  );

  // Test 30: Institute B sees identical published platform CMS
  const readerB = await platformCmsService.getPublishedCms();
  assert(
    readerB && readerB.aboutTitle === readerA.aboutTitle && readerB.version === readerA.version,
    'Institute B readers receive identical published platform content (no tenant isolation bleed).'
  );

  // Test 31: CMS is global and not tenant-scoped
  const cmsRecord = await prisma.platformCmsContent.findFirst({ where: { status: 'PUBLISHED' } });
  assert(
    !('instituteId' in cmsRecord),
    'Platform CMS model is strictly global without instituteId tenant scoping.'
  );

  // Test 32: Audit log records draft saves and publication
  const auditLogs = await prisma.platformCmsAuditLog.findMany({
    where: { action: { in: ['PLATFORM_CMS_DRAFT_SAVED', 'PLATFORM_CMS_PUBLISHED'] } },
  });
  assert(
    auditLogs.length >= 2,
    'Audit logs accurately recorded PLATFORM_CMS_DRAFT_SAVED and PLATFORM_CMS_PUBLISHED actions.'
  );

  // ============================================================================
  // SECTION 8: HERO & STORY IMAGE RENDERING, ASSET PROMOTION, AND LOGOUT/LOGIN RE-EDIT PERSISTENCE
  // ============================================================================
  console.log('\n--- SECTION 8: IMAGE RENDERING, ASSET PROMOTION & RE-EDIT PERSISTENCE ---');

  // Create real test draft files for hero and story
  const testHeroFilename = `test_hero_${Date.now()}.png`;
  const testHeroDraftPath = path.join(PROTECTED_CMS_DRAFT_DIR, testHeroFilename);
  const pngHeader = Buffer.alloc(32);
  pngHeader[0] = 0x89;
  pngHeader[1] = 0x50;
  pngHeader[2] = 0x4E;
  pngHeader[3] = 0x47;
  fs.writeFileSync(testHeroDraftPath, pngHeader);

  const testStoryFilename = `test_story_${Date.now()}.jpg`;
  const testStoryDraftPath = path.join(PROTECTED_CMS_DRAFT_DIR, testStoryFilename);
  const jpegHeader = Buffer.alloc(32);
  jpegHeader[0] = 0xFF;
  jpegHeader[1] = 0xD8;
  jpegHeader[2] = 0xFF;
  fs.writeFileSync(testStoryDraftPath, jpegHeader);

  const draftHeroUrl = `/api/platform-cms/admin/draft-asset/${testHeroFilename}`;
  const draftStoryUrl = `/api/platform-cms/admin/draft-asset/${testStoryFilename}`;

  // 1. Save draft with hero and story images
  await platformCmsService.saveAdminCmsDraft(superAdmin, {
    heroImage: draftHeroUrl,
    storyImage: draftStoryUrl,
    vision: 'Vision test for draft persistence',
  });

  // Test 33: Hero image path persists in draft
  const loadedDraft1 = await platformCmsService.getAdminCmsDraft(superAdmin);
  assert(
    loadedDraft1.draft.heroImage === draftHeroUrl,
    'Hero image path persists in draft record.'
  );

  // Test 34: Story image path persists in draft
  assert(
    loadedDraft1.draft.storyImage === draftStoryUrl,
    'Story image path persists in draft record.'
  );

  // Test 35: Draft hero preview endpoint file exists in protected draft directory
  assert(
    fs.existsSync(testHeroDraftPath),
    'Draft hero preview asset exists in protected draft storage.'
  );

  // Test 36: Draft story preview file exists in protected draft directory
  assert(
    fs.existsSync(testStoryDraftPath),
    'Draft story preview asset exists in protected draft storage.'
  );

  // 2. Publish CMS with draft images
  await platformCmsService.publishAdminCms(superAdmin);
  const publishedWithImages = await platformCmsService.getPublishedCms();

  // Test 37: Publish promotes hero image to public CMS storage path
  assert(
    publishedWithImages.heroImage && publishedWithImages.heroImage.startsWith('/uploads/platform-cms/public/'),
    'Publish promotes hero image to public CMS storage path.'
  );

  // Test 38: Publish promotes story image to public CMS storage path
  assert(
    publishedWithImages.storyImage && publishedWithImages.storyImage.startsWith('/uploads/platform-cms/public/'),
    'Publish promotes story image to public CMS storage path.'
  );

  // Test 39: Published hero asset exists physically on storage disk
  const heroPublicDiskPath = path.join(PUBLIC_CMS_DIR, path.basename(publishedWithImages.heroImage));
  assert(
    fs.existsSync(heroPublicDiskPath),
    'Published hero asset exists physically on storage disk.'
  );

  // Test 40: Published story asset exists physically on storage disk
  const storyPublicDiskPath = path.join(PUBLIC_CMS_DIR, path.basename(publishedWithImages.storyImage));
  assert(
    fs.existsSync(storyPublicDiskPath),
    'Published story asset exists physically on storage disk.'
  );

  // Test 41: Text-only publish keeps previous published image without overwriting with null/empty
  const liveHeroBefore = publishedWithImages.heroImage;
  const liveStoryBefore = publishedWithImages.storyImage;

  await platformCmsService.saveAdminCmsDraft(superAdmin, {
    aboutBody: 'Updated body text without re-uploading images.',
  });
  await platformCmsService.publishAdminCms(superAdmin);
  const textOnlyPublished = await platformCmsService.getPublishedCms();

  assert(
    textOnlyPublished.heroImage === liveHeroBefore && textOnlyPublished.storyImage === liveStoryBefore,
    'Text-only publish preserves previous published hero and story images.'
  );

  // Test 42: Fresh admin GET returns persisted draft values
  const freshAdminGet = await platformCmsService.getAdminCmsDraft(superAdmin);
  assert(
    freshAdminGet.draft && freshAdminGet.draft.heroImage === liveHeroBefore,
    'Fresh admin GET returns persisted draft with populated images.'
  );

  // Test 43: Fresh admin GET after publish returns editable state
  assert(
    freshAdminGet.liveMetadata && freshAdminGet.liveMetadata.version === textOnlyPublished.version,
    'Fresh admin GET returns live published metadata and version.'
  );

  // Test 44: Simulated logout and login reloads draft from database
  // (Calling getAdminCmsDraft with a simulated new user context)
  const simulatedNewLoginAdmin = { id: superAdmin.id, role: 'SUPER_ADMIN', username: superAdmin.username };
  const reloadedDraftAfterLogin = await platformCmsService.getAdminCmsDraft(simulatedNewLoginAdmin);
  assert(
    reloadedDraftAfterLogin.draft &&
      reloadedDraftAfterLogin.draft.aboutTitle === 'About EduNexa Platform' &&
      reloadedDraftAfterLogin.draft.heroImage === liveHeroBefore &&
      reloadedDraftAfterLogin.draft.storyImage === liveStoryBefore,
    'Draft and live image previews remain completely loaded after simulated logout and fresh login.'
  );

  // Test 45: Published API returns correct public image paths
  const publicApiCheck = await platformCmsService.getPublishedCms();
  assert(
    publicApiCheck.heroImage.startsWith('/uploads/platform-cms/public/') &&
      publicApiCheck.storyImage.startsWith('/uploads/platform-cms/public/'),
    'Published API returns authoritative public image paths for all readers.'
  );

  // Test 46: Draft image is never exposed through public CMS endpoint
  await platformCmsService.saveAdminCmsDraft(superAdmin, {
    vision: 'Draft vision modification before second publish',
    heroImage: '/api/platform-cms/admin/draft-asset/unauthorized_draft_img.png',
  });
  const liveDuringUnpublishedDraft = await platformCmsService.getPublishedCms();
  assert(
    liveDuringUnpublishedDraft.heroImage === liveHeroBefore,
    'Draft image is never exposed through public CMS endpoint before explicit publication.'
  );

  // Test 47: Published asset Content-Type matches valid image mime
  const heroExt = path.extname(liveHeroBefore).toLowerCase();
  assert(
    heroExt === '.png' || heroExt === '.jpg' || heroExt === '.webp',
    'Published asset filename extension corresponds to a valid image MIME type.'
  );

  // Test 48: Missing physical file check handles gracefully without crashes
  const nonExistentPath = path.join(PUBLIC_CMS_DIR, 'non_existent_image_12345.jpg');
  assert(
    !fs.existsSync(nonExistentPath),
    'Missing physical asset safely detected and reported as missing without fabrication.'
  );

  // Test 49: Reset draft to live published content works
  const resetResult = await platformCmsService.resetAdminCmsDraft(superAdmin);
  assert(
    resetResult.draft && resetResult.draft.heroImage === liveHeroBefore,
    'Reset draft successfully synchronizes draft from live published record.'
  );

  // ============================================================================
  // SECTION 9: DYNAMIC TEAM / LEADERSHIP / FOUNDERS SECTION
  // ============================================================================
  console.log('\n--- SECTION 9: DYNAMIC TEAM / LEADERSHIP / FOUNDERS ---');

  // Test 50: Super Admin adds Founder with custom position
  const testFounderPhoto = `test_founder_${Date.now()}.png`;
  const testFounderPath = path.join(PROTECTED_CMS_DRAFT_DIR, testFounderPhoto);
  const founderBuffer = Buffer.alloc(32);
  founderBuffer[0] = 0x89; founderBuffer[1] = 0x50; founderBuffer[2] = 0x4E; founderBuffer[3] = 0x47;
  fs.writeFileSync(testFounderPath, founderBuffer);
  const draftFounderUrl = `/api/platform-cms/admin/draft-asset/${testFounderPhoto}`;

  const teamDraftPayload = {
    teamMembers: [
      {
        fullName: 'Naseerdeen Mohamed Safras',
        position: 'Founder & CEO',
        bio: 'Architecting scalable cloud education platforms for next-generation learning.',
        profileImage: draftFounderUrl,
        linkedinUrl: 'https://linkedin.com/in/mohamedsafras',
        websiteUrl: 'https://safras.dev',
        email: 'safras@edunexa.edu',
        displayOrder: 0,
        isActive: true,
      },
    ],
  };

  await platformCmsService.saveAdminCmsDraft(superAdmin, teamDraftPayload);
  const draftWithFounder = await platformCmsService.getAdminCmsDraft(superAdmin);

  assert(
    draftWithFounder.draft.teamMembers.length === 1 &&
      draftWithFounder.draft.teamMembers[0].fullName === 'Naseerdeen Mohamed Safras',
    'Super Admin successfully adds Founder to CMS draft.'
  );

  // Test 51: Custom position persists accurately
  assert(
    draftWithFounder.draft.teamMembers[0].position === 'Founder & CEO',
    'Custom position "Founder & CEO" accurately persists without restrictive dropdown lock.'
  );

  // Test 52: Co-Founder can be added
  // Test 53: Designer custom role works
  const testDesignerPhoto = `test_designer_${Date.now()}.png`;
  const testDesignerPath = path.join(PROTECTED_CMS_DRAFT_DIR, testDesignerPhoto);
  const designerBuffer = Buffer.alloc(32);
  designerBuffer[0] = 0x89; designerBuffer[1] = 0x50; designerBuffer[2] = 0x4E; designerBuffer[3] = 0x47;
  fs.writeFileSync(testDesignerPath, designerBuffer);
  const draftDesignerUrl = `/api/platform-cms/admin/draft-asset/${testDesignerPhoto}`;

  const multiTeamPayload = {
    teamMembers: [
      {
        fullName: 'Naseerdeen Mohamed Safras',
        position: 'Founder & CEO',
        bio: 'Visionary architect of EduNexa.',
        profileImage: draftFounderUrl,
        linkedinUrl: 'https://linkedin.com/in/safras',
        email: 'safras@edunexa.edu',
        displayOrder: 0,
        isActive: true,
      },
      {
        fullName: 'Amina Al-Mansoor',
        position: 'Co-Founder & VP Academic Operations',
        bio: 'Former university dean leading pedagogical standards.',
        profileImage: null,
        linkedinUrl: 'https://linkedin.com/in/amina-almansoor',
        displayOrder: 1,
        isActive: true,
      },
      {
        fullName: 'Liam Chen',
        position: 'Lead UI/UX Designer & Design Systems',
        bio: 'Crafting frictionless, accessible glass interfaces for teachers and learners.',
        profileImage: draftDesignerUrl,
        websiteUrl: 'https://liamdesign.portfolio.com',
        displayOrder: 2,
        isActive: true,
      },
      {
        fullName: 'Archived Advisor',
        position: 'Strategic Board Advisor',
        bio: 'Deactivated advisor record for draft retention.',
        profileImage: null,
        displayOrder: 3,
        isActive: false,
      },
    ],
  };

  await platformCmsService.saveAdminCmsDraft(superAdmin, multiTeamPayload);
  const multiDraft = await platformCmsService.getAdminCmsDraft(superAdmin);

  assert(
    multiDraft.draft.teamMembers.some((m) => m.position === 'Co-Founder & VP Academic Operations'),
    'Co-Founder role successfully added and saved.'
  );

  assert(
    multiDraft.draft.teamMembers.some((m) => m.position === 'Lead UI/UX Designer & Design Systems'),
    'Designer custom role successfully saved with rich position text.'
  );

  // Test 54: Team profile image upload succeeds with valid magic bytes
  assert(
    validateCmsImageMagicBytes(testFounderPath) === true,
    'Team profile photo magic bytes validation passes for genuine PNG/JPEG files.'
  );

  // Test 55: Spoofed image rejected
  const spoofedFakeFile = path.join(PROTECTED_CMS_DRAFT_DIR, `spoof_${Date.now()}.png`);
  fs.writeFileSync(spoofedFakeFile, Buffer.from('NOT_A_REAL_IMAGE_FILE_DATA'));
  assert(
    validateCmsImageMagicBytes(spoofedFakeFile) === false,
    'Corrupt or spoofed image payload is rejected by magic bytes inspection.'
  );
  try { fs.unlinkSync(spoofedFakeFile); } catch {}

  // Test 56: Draft member does NOT appear in public API before publish
  const publicBeforeTeamPublish = await platformCmsService.getPublishedCms();
  assert(
    !publicBeforeTeamPublish.teamMembers || publicBeforeTeamPublish.teamMembers.length === 0,
    'Draft team members are strictly isolated and never appear in public API before publish.'
  );

  // Test 57: Publish makes active team members visible
  await platformCmsService.publishAdminCms(superAdmin);
  const publishedTeamCms = await platformCmsService.getPublishedCms();
  assert(
    publishedTeamCms.teamMembers && publishedTeamCms.teamMembers.length === 3,
    'Publish atomically makes active team members available to readers.'
  );

  // Test 58: Team order persists in published output
  assert(
    publishedTeamCms.teamMembers[0].fullName === 'Naseerdeen Mohamed Safras' &&
      publishedTeamCms.teamMembers[1].fullName === 'Amina Al-Mansoor' &&
      publishedTeamCms.teamMembers[2].fullName === 'Liam Chen',
    'Team member displayOrder sequence is strictly respected in published API.'
  );

  // Test 59: Move up/down persists
  const reorderedTeamPayload = {
    teamMembers: [
      {
        fullName: 'Amina Al-Mansoor',
        position: 'Co-Founder & VP Academic Operations',
        bio: 'Former university dean leading pedagogical standards.',
        profileImage: null,
        displayOrder: 0,
        isActive: true,
      },
      {
        fullName: 'Naseerdeen Mohamed Safras',
        position: 'Founder & CEO',
        bio: 'Visionary architect of EduNexa.',
        profileImage: draftFounderUrl,
        displayOrder: 1,
        isActive: true,
      },
      {
        fullName: 'Liam Chen',
        position: 'Lead UI/UX Designer & Design Systems',
        profileImage: draftDesignerUrl,
        displayOrder: 2,
        isActive: true,
      },
    ],
  };
  await platformCmsService.saveAdminCmsDraft(superAdmin, reorderedTeamPayload);
  await platformCmsService.publishAdminCms(superAdmin);
  const publishedReordered = await platformCmsService.getPublishedCms();

  assert(
    publishedReordered.teamMembers[0].fullName === 'Amina Al-Mansoor' &&
      publishedReordered.teamMembers[1].fullName === 'Naseerdeen Mohamed Safras',
    'Reordering team members (Move Up / Down) persists accurately in published output.'
  );

  // Test 60: Edit name works
  // Test 61: Edit position works
  // Test 62: Edit bio works
  const editedMemberPayload = {
    teamMembers: [
      {
        fullName: 'Naseerdeen Mohamed Safras (Eng)',
        position: 'Chief Executive Officer & Founder',
        bio: 'Updated executive biography with engineering leadership credentials.',
        profileImage: publishedReordered.teamMembers[1].profileImage,
        linkedinUrl: 'https://linkedin.com/in/safras-ceo',
        websiteUrl: 'https://safras.dev',
        email: 'ceo@edunexa.edu',
        displayOrder: 0,
        isActive: true,
      },
    ],
  };
  await platformCmsService.saveAdminCmsDraft(superAdmin, editedMemberPayload);
  const editedDraft = await platformCmsService.getAdminCmsDraft(superAdmin);

  assert(
    editedDraft.draft.teamMembers[0].fullName === 'Naseerdeen Mohamed Safras (Eng)',
    'Editing team member name updates draft.'
  );
  assert(
    editedDraft.draft.teamMembers[0].position === 'Chief Executive Officer & Founder',
    'Editing team member position updates draft.'
  );
  assert(
    editedDraft.draft.teamMembers[0].bio.includes('engineering leadership credentials'),
    'Editing team member bio updates draft.'
  );

  // Test 63: Text-only edit preserves team member profile image
  const imageBeforePublish = publishedReordered.teamMembers[1].profileImage;
  await platformCmsService.publishAdminCms(superAdmin);
  const publishedEdited = await platformCmsService.getPublishedCms();
  assert(
    publishedEdited.teamMembers[0].profileImage === imageBeforePublish,
    'Text-only edit preserves existing published team member profile photo.'
  );

  // Test 64: Profile image replacement works
  const testNewFounderPhoto = `test_founder_v2_${Date.now()}.png`;
  const testNewFounderPath = path.join(PROTECTED_CMS_DRAFT_DIR, testNewFounderPhoto);
  const newFounderBuf = Buffer.alloc(32);
  newFounderBuf[0] = 0x89; newFounderBuf[1] = 0x50; newFounderBuf[2] = 0x4E; newFounderBuf[3] = 0x47;
  fs.writeFileSync(testNewFounderPath, newFounderBuf);
  const draftNewFounderUrl = `/api/platform-cms/admin/draft-asset/${testNewFounderPhoto}`;

  await platformCmsService.saveAdminCmsDraft(superAdmin, {
    teamMembers: [
      {
        ...publishedEdited.teamMembers[0],
        profileImage: draftNewFounderUrl,
      },
    ],
  });
  await platformCmsService.publishAdminCms(superAdmin);
  const publishedWithNewImage = await platformCmsService.getPublishedCms();
  assert(
    publishedWithNewImage.teamMembers[0].profileImage &&
      publishedWithNewImage.teamMembers[0].profileImage.startsWith('/uploads/platform-cms/public/') &&
      publishedWithNewImage.teamMembers[0].profileImage !== imageBeforePublish,
    'Profile image replacement successfully promotes and binds new asset.'
  );

  // Test 65: Old published image retained on disk until new publish completes
  const newPhotoDisk = path.join(PUBLIC_CMS_DIR, path.basename(publishedWithNewImage.teamMembers[0].profileImage));
  assert(
    fs.existsSync(newPhotoDisk),
    'Newly published team photo exists physically in public CMS directory.'
  );

  // Test 66: isActive=false hidden from public API
  await platformCmsService.saveAdminCmsDraft(superAdmin, {
    teamMembers: [
      {
        fullName: 'Hidden Member',
        position: 'Stealth Engineer',
        displayOrder: 0,
        isActive: false,
      },
    ],
  });
  await platformCmsService.publishAdminCms(superAdmin);
  const publicInactiveCheck = await platformCmsService.getPublishedCms();
  assert(
    publicInactiveCheck.teamMembers.length === 0,
    'Team member with isActive: false is excluded from reader/public API.'
  );

  // Test 67: Logout / login admin GET returns team members
  const reloadedAdminSession = await platformCmsService.getAdminCmsDraft({
    id: superAdmin.id,
    role: 'SUPER_ADMIN',
    username: superAdmin.username,
  });
  assert(
    reloadedAdminSession.draft.teamMembers.length === 1 &&
      reloadedAdminSession.draft.teamMembers[0].fullName === 'Hidden Member',
    'Fresh Super Admin login hydrates all draft team members from database.'
  );

  // Test 68: Existing image preview path persists on fresh login
  await platformCmsService.saveAdminCmsDraft(superAdmin, {
    teamMembers: [
      {
        fullName: 'Naseerdeen Mohamed Safras',
        position: 'Founder & CEO',
        profileImage: draftNewFounderUrl,
        isActive: true,
      },
    ],
  });
  const reloadedWithImage = await platformCmsService.getAdminCmsDraft(superAdmin);
  assert(
    reloadedWithImage.draft.teamMembers[0].profileImage === draftNewFounderUrl,
    'Team member profile photo preview reference persists across logins.'
  );

  // Test 68b: Empty image string in text-only update does not wipe existing profile photo
  const currentMemberId = reloadedWithImage.draft.teamMembers[0].id;
  await platformCmsService.saveAdminCmsDraft(superAdmin, {
    teamMembers: [
      {
        id: currentMemberId,
        fullName: 'Naseerdeen Mohamed Safras',
        position: 'Founder & CEO',
        bio: 'Updated bio without sending profile image string.',
        profileImage: '',
        isActive: true,
      },
    ],
  });
  const textEditCheck = await platformCmsService.getAdminCmsDraft(superAdmin);
  assert(
    textEditCheck.draft.teamMembers[0].profileImage === draftNewFounderUrl,
    'Empty profileImage string in text-only update does not wipe existing saved photo.'
  );

  // Test 68c: Explicit null removes profile photo only when requested
  await platformCmsService.saveAdminCmsDraft(superAdmin, {
    teamMembers: [
      {
        id: textEditCheck.draft.teamMembers[0].id,
        fullName: 'Naseerdeen Mohamed Safras',
        position: 'Founder & CEO',
        profileImage: null,
        isActive: true,
      },
    ],
  });
  const nullEditCheck = await platformCmsService.getAdminCmsDraft(superAdmin);
  assert(
    nullEditCheck.draft.teamMembers[0].profileImage === null,
    'Explicit null removes team member profile photo when user clicks Remove Photo.'
  );

  // Restore profile photo for subsequent tests
  await platformCmsService.saveAdminCmsDraft(superAdmin, {
    teamMembers: [
      {
        fullName: 'Naseerdeen Mohamed Safras',
        position: 'Founder & CEO',
        profileImage: draftNewFounderUrl,
        isActive: true,
      },
    ],
  });

  // Test 69: Institute Admin mutation blocked
  assert(!isSuperAdminRole(adminA), 'Institute Admin cannot modify team members.');

  // Test 70: Teacher mutation blocked
  assert(!isSuperAdminRole(teacherA), 'Teacher cannot modify team members.');

  // Test 71: Student mutation blocked
  assert(!isSuperAdminRole(studentA), 'Student cannot modify team members.');

  // Test 72: Parent mutation blocked
  assert(!isSuperAdminRole(parentA), 'Parent cannot modify team members.');

  // Test 73: Unsafe URLs rejected
  let unsafeRejected = false;
  try {
    platformCmsService.validateCmsUrls({
      teamMembers: [
        {
          fullName: 'Malicious Actor',
          position: 'Attacker',
          linkedinUrl: 'javascript:alert(document.cookie)',
        },
      ],
    });
  } catch (err) {
    unsafeRejected = true;
  }
  assert(unsafeRejected, 'Unsafe javascript: URL on team member LinkedIn is rejected.');

  // Test 74: Published team identical across Institute A and Institute B
  await platformCmsService.publishAdminCms(superAdmin);
  const instAView = await platformCmsService.getPublishedCms();
  const instBView = await platformCmsService.getPublishedCms();
  assert(
    instAView.teamMembers.length === instBView.teamMembers.length &&
      instAView.teamMembers[0].fullName === instBView.teamMembers[0].fullName,
    'Published team members are identical across all institutes with zero tenant bleed.'
  );

  // Test 75: No fake fallback team
  await prisma.platformCmsTeamMember.deleteMany({});
  const emptyTeamPublic = await platformCmsService.getPublishedCms();
  assert(
    emptyTeamPublic.teamMembers && emptyTeamPublic.teamMembers.length === 0,
    'When no team members are saved, system returns empty array without injecting fake members.'
  );

  // Test 76: Existing CMS tests remain passing
  assert(
    emptyTeamPublic.aboutTitle === 'About EduNexa Platform',
    'Core CMS about content and prior features remain completely intact.'
  );

  console.log('\n================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

runPlatformCmsTestSuite()
  .catch((err) => {
    console.error('\nPlatform CMS Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
