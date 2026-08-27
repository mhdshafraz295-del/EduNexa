import prisma from '../config/prisma.js';
import {
  promoteDraftCmsAsset,
  cleanupUnreferencedPublishedAssets,
  validateCmsImageMagicBytes,
  PROTECTED_CMS_DRAFT_DIR,
} from '../middleware/upload.middleware.js';
import { isR2Configured, uploadToR2 } from './storage/r2Storage.service.js';
import path from 'path';
import fs from 'fs';

/**
 * Validates that a URL string is safe (https:// or approved internal path).
 * Strictly rejects javascript:, data:, file:, vbscript:, etc.
 */
export function validateSafeUrl(url, fieldName = 'URL') {
  if (!url || typeof url !== 'string' || url.trim() === '') return true;
  const trimmed = url.trim();

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:') ||
    lower.startsWith('vbscript:')
  ) {
    const error = new Error(`Unsafe URL scheme in ${fieldName}. Only secure URLs (https://) or internal paths are permitted.`);
    error.status = 400;
    throw error;
  }

  if (trimmed.startsWith('/') || trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return true;
  }

  const error = new Error(`Invalid URL format for ${fieldName}. Must start with https:// or /.`);
  error.status = 400;
  throw error;
}

/**
 * Validates all social, action, and team member URLs in a CMS payload
 */
export function validateCmsUrls(payload) {
  validateSafeUrl(payload.heroCtaUrl, 'Hero CTA URL');
  validateSafeUrl(payload.websiteUrl, 'Website URL');
  validateSafeUrl(payload.facebookUrl, 'Facebook URL');
  validateSafeUrl(payload.instagramUrl, 'Instagram URL');
  validateSafeUrl(payload.youtubeUrl, 'YouTube URL');
  validateSafeUrl(payload.linkedinUrl, 'LinkedIn URL');
  validateSafeUrl(payload.twitterUrl, 'Twitter/X URL');
  validateSafeUrl(payload.termsUrl, 'Terms & Conditions URL');
  validateSafeUrl(payload.privacyUrl, 'Privacy Policy URL');

  if (Array.isArray(payload.teamMembers)) {
    for (let i = 0; i < payload.teamMembers.length; i++) {
      const member = payload.teamMembers[i];
      if (member.fullName && !member.fullName.trim()) {
        const error = new Error(`Team member at index ${i + 1} must have a valid full name.`);
        error.status = 400;
        throw error;
      }
      if (member.position && !member.position.trim()) {
        const error = new Error(`Team member at index ${i + 1} must have a valid position / role.`);
        error.status = 400;
        throw error;
      }
      validateSafeUrl(member.linkedinUrl, `Team Member (${member.fullName || i + 1}) LinkedIn URL`);
      validateSafeUrl(member.websiteUrl, `Team Member (${member.fullName || i + 1}) Website URL`);

      if (member.email && typeof member.email === 'string' && member.email.trim()) {
        const emailTrimmed = member.email.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailTrimmed)) {
          const error = new Error(`Invalid email address for team member (${member.fullName || i + 1}).`);
          error.status = 400;
          throw error;
        }
      }
    }
  }
}

/**
 * Returns the currently live published Platform CMS content for readers (Public & Role Portals).
 * Strictly isolates and never exposes draft data.
 */
export async function getPublishedCms() {
  const published = await prisma.platformCmsContent.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    include: {
      features: {
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      },
      teamMembers: {
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      },
      publishedBy: {
        select: { id: true, username: true, email: true },
      },
    },
  });

  if (!published) {
    return null;
  }

  return {
    id: published.id,
    version: published.version,
    heroTitle: published.heroTitle,
    heroSubtitle: published.heroSubtitle,
    heroImage: published.heroImage,
    heroCtaLabel: published.heroCtaLabel,
    heroCtaUrl: published.heroCtaUrl,
    aboutTitle: published.aboutTitle,
    aboutBody: published.aboutBody,
    vision: published.vision,
    mission: published.mission,
    storyTitle: published.storyTitle,
    storyContent: published.storyContent,
    storyImage: published.storyImage,
    contactEmail: published.contactEmail,
    contactPhone: published.contactPhone,
    contactAddress: published.contactAddress,
    websiteUrl: published.websiteUrl,
    facebookUrl: published.facebookUrl,
    instagramUrl: published.instagramUrl,
    youtubeUrl: published.youtubeUrl,
    linkedinUrl: published.linkedinUrl,
    twitterUrl: published.twitterUrl,
    termsUrl: published.termsUrl,
    privacyUrl: published.privacyUrl,
    publishedAt: published.publishedAt,
    publishedBy: published.publishedBy,
    features: (published.features || []).map((f) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      iconKey: f.iconKey,
      displayOrder: f.displayOrder,
    })),
    teamMembers: (published.teamMembers || []).map((m) => ({
      id: m.id,
      fullName: m.fullName,
      position: m.position,
      bio: m.bio,
      profileImage: m.profileImage,
      linkedinUrl: m.linkedinUrl,
      websiteUrl: m.websiteUrl,
      email: m.email,
      displayOrder: m.displayOrder,
    })),
  };
}

/**
 * Returns the Super Admin editable draft record, creating a fresh one seeded from published if none exists.
 */
export async function getAdminCmsDraft(user) {
  let draft = await prisma.platformCmsContent.findFirst({
    where: { status: 'DRAFT' },
    include: {
      features: {
        orderBy: { displayOrder: 'asc' },
      },
      teamMembers: {
        orderBy: { displayOrder: 'asc' },
      },
      updatedBy: {
        select: { id: true, username: true, email: true },
      },
      createdBy: {
        select: { id: true, username: true, email: true },
      },
    },
  });

  const livePublished = await prisma.platformCmsContent.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    include: {
      features: {
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      },
      teamMembers: {
        orderBy: { displayOrder: 'asc' },
      },
      publishedBy: {
        select: { id: true, username: true, email: true },
      },
    },
  });

  if (!draft) {
    if (livePublished) {
      // Seed draft from current live published record
      draft = await prisma.platformCmsContent.create({
        data: {
          status: 'DRAFT',
          version: livePublished.version,
          heroTitle: livePublished.heroTitle,
          heroSubtitle: livePublished.heroSubtitle,
          heroImage: livePublished.heroImage,
          heroCtaLabel: livePublished.heroCtaLabel,
          heroCtaUrl: livePublished.heroCtaUrl,
          aboutTitle: livePublished.aboutTitle,
          aboutBody: livePublished.aboutBody,
          vision: livePublished.vision,
          mission: livePublished.mission,
          storyTitle: livePublished.storyTitle,
          storyContent: livePublished.storyContent,
          storyImage: livePublished.storyImage,
          contactEmail: livePublished.contactEmail,
          contactPhone: livePublished.contactPhone,
          contactAddress: livePublished.contactAddress,
          websiteUrl: livePublished.websiteUrl,
          facebookUrl: livePublished.facebookUrl,
          instagramUrl: livePublished.instagramUrl,
          youtubeUrl: livePublished.youtubeUrl,
          linkedinUrl: livePublished.linkedinUrl,
          twitterUrl: livePublished.twitterUrl,
          termsUrl: livePublished.termsUrl,
          privacyUrl: livePublished.privacyUrl,
          createdById: user?.id,
          updatedById: user?.id,
        },
        include: {
          features: { orderBy: { displayOrder: 'asc' } },
          teamMembers: { orderBy: { displayOrder: 'asc' } },
        },
      });

      // Copy features to draft
      const publishedFeatures = await prisma.platformCmsFeature.findMany({
        where: { cmsId: livePublished.id },
        orderBy: { displayOrder: 'asc' },
      });

      for (const feat of publishedFeatures) {
        await prisma.platformCmsFeature.create({
          data: {
            cmsId: draft.id,
            title: feat.title,
            description: feat.description,
            iconKey: feat.iconKey,
            displayOrder: feat.displayOrder,
            isActive: feat.isActive,
          },
        });
      }

      // Copy team members to draft
      const publishedTeamMembers = await prisma.platformCmsTeamMember.findMany({
        where: { cmsId: livePublished.id },
        orderBy: { displayOrder: 'asc' },
      });

      for (const member of publishedTeamMembers) {
        await prisma.platformCmsTeamMember.create({
          data: {
            cmsId: draft.id,
            fullName: member.fullName,
            position: member.position,
            bio: member.bio,
            profileImage: member.profileImage,
            linkedinUrl: member.linkedinUrl,
            websiteUrl: member.websiteUrl,
            email: member.email,
            displayOrder: member.displayOrder,
            isActive: member.isActive,
          },
        });
      }

      draft = await prisma.platformCmsContent.findUnique({
        where: { id: draft.id },
        include: {
          features: { orderBy: { displayOrder: 'asc' } },
          teamMembers: { orderBy: { displayOrder: 'asc' } },
          updatedBy: { select: { id: true, username: true, email: true } },
          createdBy: { select: { id: true, username: true, email: true } },
        },
      });
    } else {
      // Create empty draft
      draft = await prisma.platformCmsContent.create({
        data: {
          status: 'DRAFT',
          version: 1,
          aboutTitle: 'About EduNexa',
          createdById: user?.id,
          updatedById: user?.id,
        },
        include: {
          features: { orderBy: { displayOrder: 'asc' } },
          teamMembers: { orderBy: { displayOrder: 'asc' } },
        },
      });
    }
  }

  return {
    draft,
    liveMetadata: livePublished
      ? {
          publishedAt: livePublished.publishedAt,
          publishedBy: livePublished.publishedBy,
          version: livePublished.version,
        }
      : null,
  };
}

/**
 * Saves Super Admin edits to the DRAFT record without affecting the live published content.
 */
export async function saveAdminCmsDraft(user, draftData) {
  validateCmsUrls(draftData);

  let draft = await prisma.platformCmsContent.findFirst({
    where: { status: 'DRAFT' },
  });

  let resolvedHeroImage = undefined;
  if (draftData.heroImage === null) {
    resolvedHeroImage = null; // explicit removal
  } else if (typeof draftData.heroImage === 'string' && draftData.heroImage.trim() !== '') {
    resolvedHeroImage = draftData.heroImage.trim();
  }

  let resolvedStoryImage = undefined;
  if (draftData.storyImage === null) {
    resolvedStoryImage = null; // explicit removal
  } else if (typeof draftData.storyImage === 'string' && draftData.storyImage.trim() !== '') {
    resolvedStoryImage = draftData.storyImage.trim();
  }

  const dataToUpdate = {
    heroTitle: draftData.heroTitle !== undefined ? draftData.heroTitle : undefined,
    heroSubtitle: draftData.heroSubtitle !== undefined ? draftData.heroSubtitle : undefined,
    heroImage: resolvedHeroImage,
    heroCtaLabel: draftData.heroCtaLabel !== undefined ? draftData.heroCtaLabel : undefined,
    heroCtaUrl: draftData.heroCtaUrl !== undefined ? draftData.heroCtaUrl : undefined,
    aboutTitle: draftData.aboutTitle !== undefined ? draftData.aboutTitle : undefined,
    aboutBody: draftData.aboutBody !== undefined ? draftData.aboutBody : undefined,
    vision: draftData.vision !== undefined ? draftData.vision : undefined,
    mission: draftData.mission !== undefined ? draftData.mission : undefined,
    storyTitle: draftData.storyTitle !== undefined ? draftData.storyTitle : undefined,
    storyContent: draftData.storyContent !== undefined ? draftData.storyContent : undefined,
    storyImage: resolvedStoryImage,
    contactEmail: draftData.contactEmail !== undefined ? draftData.contactEmail : undefined,
    contactPhone: draftData.contactPhone !== undefined ? draftData.contactPhone : undefined,
    contactAddress: draftData.contactAddress !== undefined ? draftData.contactAddress : undefined,
    websiteUrl: draftData.websiteUrl !== undefined ? draftData.websiteUrl : undefined,
    facebookUrl: draftData.facebookUrl !== undefined ? draftData.facebookUrl : undefined,
    instagramUrl: draftData.instagramUrl !== undefined ? draftData.instagramUrl : undefined,
    youtubeUrl: draftData.youtubeUrl !== undefined ? draftData.youtubeUrl : undefined,
    linkedinUrl: draftData.linkedinUrl !== undefined ? draftData.linkedinUrl : undefined,
    twitterUrl: draftData.twitterUrl !== undefined ? draftData.twitterUrl : undefined,
    termsUrl: draftData.termsUrl !== undefined ? draftData.termsUrl : undefined,
    privacyUrl: draftData.privacyUrl !== undefined ? draftData.privacyUrl : undefined,
    updatedById: user.id,
  };

  if (!draft) {
    draft = await prisma.platformCmsContent.create({
      data: {
        ...dataToUpdate,
        status: 'DRAFT',
        version: 1,
        createdById: user.id,
      },
    });
  } else {
    draft = await prisma.platformCmsContent.update({
      where: { id: draft.id },
      data: dataToUpdate,
    });
  }

  // Synchronize dynamic features if provided
  if (Array.isArray(draftData.features)) {
    // Delete existing draft features
    await prisma.platformCmsFeature.deleteMany({
      where: { cmsId: draft.id },
    });

    // Create updated features
    for (let i = 0; i < draftData.features.length; i++) {
      const feat = draftData.features[i];
      if (feat.title && feat.title.trim()) {
        await prisma.platformCmsFeature.create({
          data: {
            cmsId: draft.id,
            title: feat.title.trim(),
            description: feat.description || '',
            iconKey: feat.iconKey || 'graduation-cap',
            displayOrder: feat.displayOrder !== undefined ? feat.displayOrder : i,
            isActive: feat.isActive !== undefined ? Boolean(feat.isActive) : true,
          },
        });
      }
    }
  }

  // Synchronize dynamic team members if provided
  if (Array.isArray(draftData.teamMembers)) {
    // Look up existing draft team members to preserve photos if omitted in payload
    const existingDraftMembers = await prisma.platformCmsTeamMember.findMany({
      where: { cmsId: draft.id },
    });
    const existingMemberMap = new Map(existingDraftMembers.map((m) => [m.id, m]));

    // Delete existing draft team members
    await prisma.platformCmsTeamMember.deleteMany({
      where: { cmsId: draft.id },
    });

    // Create updated team members
    for (let i = 0; i < draftData.teamMembers.length; i++) {
      const member = draftData.teamMembers[i];
      if (member.fullName && member.fullName.trim() && member.position && member.position.trim()) {
        const existingRecord = member.id ? existingMemberMap.get(member.id) : null;
        let memberImage = null;

        if (member.profileImage === null) {
          memberImage = null; // explicit removal
        } else if (typeof member.profileImage === 'string' && member.profileImage.trim() !== '') {
          memberImage = member.profileImage.trim();
        } else if (existingRecord?.profileImage) {
          memberImage = existingRecord.profileImage; // preserve existing photo on text-only update
        }

        await prisma.platformCmsTeamMember.create({
          data: {
            cmsId: draft.id,
            fullName: member.fullName.trim(),
            position: member.position.trim(),
            bio: member.bio ? member.bio.trim() : null,
            profileImage: memberImage,
            linkedinUrl: member.linkedinUrl ? member.linkedinUrl.trim() : null,
            websiteUrl: member.websiteUrl ? member.websiteUrl.trim() : null,
            email: member.email ? member.email.trim() : null,
            displayOrder: member.displayOrder !== undefined ? member.displayOrder : i,
            isActive: member.isActive !== undefined ? Boolean(member.isActive) : true,
          },
        });
      }
    }

    await prisma.platformCmsAuditLog.create({
      data: {
        action: 'PLATFORM_CMS_TEAM_MEMBER_UPDATED',
        performedById: user.id,
        details: JSON.stringify({ draftId: draft.id, count: draftData.teamMembers.length }),
      },
    });
  }

  // Audit log
  await prisma.platformCmsAuditLog.create({
    data: {
      action: 'PLATFORM_CMS_DRAFT_SAVED',
      performedById: user.id,
      details: JSON.stringify({ draftId: draft.id, updatedAt: new Date() }),
    },
  });

  return getAdminCmsDraft(user);
}

/**
 * Atomically publishes the current DRAFT into the authoritative PUBLISHED record.
 * Promotes referenced draft assets to public storage and safely cleans unreferenced assets.
 */
export async function publishAdminCms(user, publishPayload = {}) {
  // If payload sent along with publish, save draft first
  if (Object.keys(publishPayload).length > 0) {
    await saveAdminCmsDraft(user, publishPayload);
  }

  const draft = await prisma.platformCmsContent.findFirst({
    where: { status: 'DRAFT' },
    include: {
      features: { orderBy: { displayOrder: 'asc' } },
      teamMembers: { orderBy: { displayOrder: 'asc' } },
    },
  });

  if (!draft) {
    const error = new Error('No draft CMS content found to publish.');
    error.status = 400;
    throw error;
  }

  // Validate all URLs before publishing
  validateCmsUrls(draft);

  // Promote referenced draft images to public storage (supports R2 copy & local disk fallback)
  const promotedHeroImage = draft.heroImage ? await promoteDraftCmsAsset(draft.heroImage) : null;
  const promotedStoryImage = draft.storyImage ? await promoteDraftCmsAsset(draft.storyImage) : null;

  // Promote team member profile images
  const promotedTeamMembers = await Promise.all(
    (draft.teamMembers || []).map(async (m) => ({
      ...m,
      promotedProfileImage: m.profileImage ? await promoteDraftCmsAsset(m.profileImage) : null,
    }))
  );

  // Identify existing live published record and its assets for safe cleanup
  const existingPublished = await prisma.platformCmsContent.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    include: { features: true, teamMembers: true },
  });

  const oldPublishedAssets = existingPublished
    ? [
        existingPublished.heroImage,
        existingPublished.storyImage,
        ...(existingPublished.teamMembers || []).map((m) => m.profileImage),
      ].filter(Boolean)
    : [];

  const newPublishedAssets = [
    promotedHeroImage,
    promotedStoryImage,
    ...promotedTeamMembers.map((m) => m.promotedProfileImage),
  ].filter(Boolean);

  const nextVersion = (existingPublished?.version || 0) + 1;

  // Execute atomic Prisma transaction
  const publishedResult = await prisma.$transaction(async (tx) => {
    let liveRecord;
    if (existingPublished) {
      // Clear existing published features and team members
      await tx.platformCmsFeature.deleteMany({
        where: { cmsId: existingPublished.id },
      });
      await tx.platformCmsTeamMember.deleteMany({
        where: { cmsId: existingPublished.id },
      });

      // Update published record with draft values & promoted assets
      liveRecord = await tx.platformCmsContent.update({
        where: { id: existingPublished.id },
        data: {
          version: nextVersion,
          heroTitle: draft.heroTitle,
          heroSubtitle: draft.heroSubtitle,
          heroImage: promotedHeroImage,
          heroCtaLabel: draft.heroCtaLabel,
          heroCtaUrl: draft.heroCtaUrl,
          aboutTitle: draft.aboutTitle,
          aboutBody: draft.aboutBody,
          vision: draft.vision,
          mission: draft.mission,
          storyTitle: draft.storyTitle,
          storyContent: draft.storyContent,
          storyImage: promotedStoryImage,
          contactEmail: draft.contactEmail,
          contactPhone: draft.contactPhone,
          contactAddress: draft.contactAddress,
          websiteUrl: draft.websiteUrl,
          facebookUrl: draft.facebookUrl,
          instagramUrl: draft.instagramUrl,
          youtubeUrl: draft.youtubeUrl,
          linkedinUrl: draft.linkedinUrl,
          twitterUrl: draft.twitterUrl,
          termsUrl: draft.termsUrl,
          privacyUrl: draft.privacyUrl,
          publishedAt: new Date(),
          publishedById: user.id,
          updatedById: user.id,
        },
      });
    } else {
      // Create fresh published record
      liveRecord = await tx.platformCmsContent.create({
        data: {
          status: 'PUBLISHED',
          version: nextVersion,
          heroTitle: draft.heroTitle,
          heroSubtitle: draft.heroSubtitle,
          heroImage: promotedHeroImage,
          heroCtaLabel: draft.heroCtaLabel,
          heroCtaUrl: draft.heroCtaUrl,
          aboutTitle: draft.aboutTitle,
          aboutBody: draft.aboutBody,
          vision: draft.vision,
          mission: draft.mission,
          storyTitle: draft.storyTitle,
          storyContent: draft.storyContent,
          storyImage: promotedStoryImage,
          contactEmail: draft.contactEmail,
          contactPhone: draft.contactPhone,
          contactAddress: draft.contactAddress,
          websiteUrl: draft.websiteUrl,
          facebookUrl: draft.facebookUrl,
          instagramUrl: draft.instagramUrl,
          youtubeUrl: draft.youtubeUrl,
          linkedinUrl: draft.linkedinUrl,
          twitterUrl: draft.twitterUrl,
          termsUrl: draft.termsUrl,
          privacyUrl: draft.privacyUrl,
          publishedAt: new Date(),
          publishedById: user.id,
          createdById: user.id,
          updatedById: user.id,
        },
      });
    }

    // Clone active draft features into published record
    for (const feat of draft.features) {
      await tx.platformCmsFeature.create({
        data: {
          cmsId: liveRecord.id,
          title: feat.title,
          description: feat.description,
          iconKey: feat.iconKey,
          displayOrder: feat.displayOrder,
          isActive: feat.isActive,
        },
      });
    }

    // Clone active draft team members into published record
    for (const member of promotedTeamMembers) {
      if (member.isActive) {
        await tx.platformCmsTeamMember.create({
          data: {
            cmsId: liveRecord.id,
            fullName: member.fullName,
            position: member.position,
            bio: member.bio,
            profileImage: member.promotedProfileImage,
            linkedinUrl: member.linkedinUrl,
            websiteUrl: member.websiteUrl,
            email: member.email,
            displayOrder: member.displayOrder,
            isActive: true,
          },
        });
      }

      // Update draft team member record with promoted image URL
      await tx.platformCmsTeamMember.update({
        where: { id: member.id },
        data: {
          profileImage: member.promotedProfileImage,
        },
      });
    }

    // Update draft with promoted paths & version so draft mirrors published
    await tx.platformCmsContent.update({
      where: { id: draft.id },
      data: {
        heroImage: promotedHeroImage,
        storyImage: promotedStoryImage,
        version: nextVersion,
        updatedById: user.id,
      },
    });

    // Record audit log
    await tx.platformCmsAuditLog.create({
      data: {
        action: 'PLATFORM_CMS_PUBLISHED',
        performedById: user.id,
        details: JSON.stringify({
          publishedCmsId: liveRecord.id,
          version: nextVersion,
          publishedAt: new Date(),
        }),
      },
    });

    return liveRecord;
  });

  // Safely cleanup old published assets AFTER transaction successfully commits
  await cleanupUnreferencedPublishedAssets(oldPublishedAssets, newPublishedAssets);

  return getPublishedCms();
}

/**
 * Handles uploaded draft image, verifies magic bytes, uploads to Cloudflare R2 if configured
 * (with fallback to local volume disk), and records audit log.
 */
export async function handleDraftImageUpload(user, file, field = 'hero') {
  if (!file) {
    const error = new Error('No image file uploaded.');
    error.status = 400;
    throw error;
  }

  const filePath = file.path;

  // Validate magic bytes
  const isValid = validateCmsImageMagicBytes(filePath);
  if (!isValid) {
    // Delete invalid file immediately
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
    const error = new Error('Invalid or corrupted image file. Magic bytes check failed.');
    error.status = 400;
    throw error;
  }

  const filename = path.basename(filePath);
  let draftUrl = `/api/platform-cms/admin/draft-asset/${filename}`;

  // Attempt Cloudflare R2 upload if configured
  if (isR2Configured()) {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const ext = path.extname(filename).toLowerCase() || '.jpg';
      const cleanField = String(field).toLowerCase().includes('team') ? 'team' : 'cms';

      const r2Key = cleanField === 'team'
        ? `platform-cms/draft/team/cms_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`
        : `platform-cms/draft/cms_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;

      await uploadToR2({
        buffer: fileBuffer,
        key: r2Key,
        contentType: file.mimetype || 'image/jpeg',
      });

      draftUrl = `r2://${r2Key}`;

      // Remove temporary disk upload after successful R2 upload
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    } catch (r2Err) {
      console.error('[R2 Storage Warning] Failed to upload draft image to R2, falling back to volume disk:', r2Err.message);
      draftUrl = `/api/platform-cms/admin/draft-asset/${filename}`;
    }
  }

  // Log image audit
  await prisma.platformCmsAuditLog.create({
    data: {
      action: 'PLATFORM_CMS_IMAGE_CHANGED',
      performedById: user.id,
      details: JSON.stringify({ field, filename, draftUrl, size: file.size, mimetype: file.mimetype }),
    },
  });

  return {
    success: true,
    draftUrl,
    filename,
    field,
  };
}

/**
 * Resets current draft by explicitly copying from current live published record.
 */
export async function resetAdminCmsDraft(user) {
  const livePublished = await prisma.platformCmsContent.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    include: {
      features: {
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      },
      teamMembers: {
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      },
    },
  });

  // Delete existing draft if present
  const existingDraft = await prisma.platformCmsContent.findFirst({
    where: { status: 'DRAFT' },
  });

  if (existingDraft) {
    await prisma.platformCmsFeature.deleteMany({
      where: { cmsId: existingDraft.id },
    });
    await prisma.platformCmsTeamMember.deleteMany({
      where: { cmsId: existingDraft.id },
    });
    await prisma.platformCmsContent.delete({
      where: { id: existingDraft.id },
    });
  }

  // Reload/reseed draft
  return getAdminCmsDraft(user);
}

