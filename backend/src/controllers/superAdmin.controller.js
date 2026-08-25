import bcrypt from 'bcryptjs';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import prisma from '../config/prisma.js';
import { PUBLIC_LOGO_DIR, PROTECTED_SIGNATURE_DIR, PROTECTED_STAMP_DIR } from '../middleware/upload.middleware.js';
import { recordInstituteReferralOnRegistration, getOrCreateInstituteReferralProfile } from '../services/referral.service.js';

const safeDeleteFile = (baseDir, filePathOrName) => {
  if (!filePathOrName) return;
  try {
    const filename = path.basename(filePathOrName);
    const resolvedPath = path.resolve(baseDir, filename);
    if (resolvedPath.startsWith(path.resolve(baseDir)) && fs.existsSync(resolvedPath)) {
      fs.unlinkSync(resolvedPath);
    }
  } catch (err) {
    console.error('Failed to safely delete file:', err);
  }
};

// Helper to generate unique institute code (e.g. EDU0004)
const generateInstituteCode = async () => {
  const count = await prisma.institute.count();
  const nextNum = count + 1;
  let code = `EDU${String(nextNum).padStart(4, '0')}`;
  
  let exists = await prisma.institute.findUnique({ where: { code } });
  let suffix = 1;
  while (exists) {
    code = `EDU${String(nextNum + suffix).padStart(4, '0')}`;
    exists = await prisma.institute.findUnique({ where: { code } });
    suffix++;
  }
  return code;
};

// Helper to generate slug from name
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// 1. Dashboard Stats
export const getDashboardStats = async (req, res) => {
  try {
    const [totalInstitutes, activeInstitutes, inactiveInstitutes, totalUsers, usersByRole, recentInstitutes] = await Promise.all([
      prisma.institute.count(),
      prisma.institute.count({ where: { isActive: true } }),
      prisma.institute.count({ where: { isActive: false } }),
      prisma.user.count(),
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
      prisma.institute.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
              students: true,
              teachers: true,
            },
          },
        },
      }),
    ]);

    const roleCounts = usersByRole.reduce((acc, curr) => {
      acc[curr.role] = curr._count.id;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: {
        totalInstitutes,
        activeInstitutes,
        inactiveInstitutes,
        totalUsers,
        roleCounts: {
          SUPER_ADMIN: roleCounts.SUPER_ADMIN || 0,
          ADMIN: roleCounts.ADMIN || 0,
          TEACHER: roleCounts.TEACHER || 0,
          STUDENT: roleCounts.STUDENT || 0,
          PARENT: roleCounts.PARENT || 0,
        },
        recentInstitutes: recentInstitutes.map(inst => ({
          id: inst.id,
          name: inst.name,
          slug: inst.slug,
          code: inst.code,
          email: inst.email,
          phone: inst.phone,
          logo: inst.logo,
          isActive: inst.isActive,
          createdAt: inst.createdAt,
          userCount: inst._count.users,
          studentCount: inst._count.students,
          teacherCount: inst._count.teachers,
        })),
      },
    });
  } catch (error) {
    console.error('Super admin stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load Super Admin dashboard metrics.',
      error: error.message,
    });
  }
};

// 1b. Super Admin Dashboard Analytics (Real Aggregations)
export const getSuperAdminAnalytics = async (req, res) => {
  try {
    const [institutes, activeSubscriptions, usersByRole, activeCount, inactiveCount] = await Promise.all([
      prisma.institute.findMany({
        select: { id: true, createdAt: true, isActive: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.instituteSubscription.findMany({
        where: { status: 'ACTIVE' },
        select: { planNameSnapshot: true },
      }),
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
      prisma.institute.count({ where: { isActive: true } }),
      prisma.institute.count({ where: { isActive: false } }),
    ]);

    // 1. Institute Growth: Monthly grouping with real createdAt
    const growthMap = new Map();
    institutes.forEach(inst => {
      const d = new Date(inst.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!growthMap.has(key)) {
        growthMap.set(key, { key, label, count: 0 });
      }
      growthMap.get(key).count += 1;
    });

    const sortedGrowth = Array.from(growthMap.values()).sort((a, b) => a.key.localeCompare(b.key));
    let cumulative = 0;
    const instituteGrowth = sortedGrowth.map(item => {
      cumulative += item.count;
      return {
        month: item.label,
        count: item.count,
        cumulative,
      };
    });

    // 2. Institute Status Distribution
    const instituteStatus = [
      { name: 'Active', value: activeCount, fill: '#10B981' },
      { name: 'Inactive', value: inactiveCount, fill: '#EF4444' },
    ];

    // 3. Platform Users by Role
    const roleCounts = usersByRole.reduce((acc, curr) => {
      acc[curr.role] = curr._count.id;
      return acc;
    }, {});

    const usersByRoleData = [
      { role: 'ADMIN', name: 'Admins', count: roleCounts.ADMIN || 0, fill: '#FFD978' },
      { role: 'TEACHER', name: 'Teachers', count: roleCounts.TEACHER || 0, fill: '#10B981' },
      { role: 'STUDENT', name: 'Students', count: roleCounts.STUDENT || 0, fill: '#3B82F6' },
      { role: 'PARENT', name: 'Parents', count: roleCounts.PARENT || 0, fill: '#A855F7' },
    ];

    // 4. Subscription Distribution
    const subMap = new Map();
    activeSubscriptions.forEach(sub => {
      const name = sub.planNameSnapshot || 'Trial Plan';
      subMap.set(name, (subMap.get(name) || 0) + 1);
    });

    const subscriptionDistribution = Array.from(subMap.entries()).map(([planName, count]) => ({
      name: planName,
      count,
    }));

    return res.status(200).json({
      success: true,
      data: {
        instituteGrowth,
        instituteStatus,
        usersByRole: usersByRoleData,
        subscriptionDistribution,
      },
    });
  } catch (error) {
    console.error('Super admin analytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load Super Admin analytics data.',
      error: error.message,
    });
  }
};

// 2. List Institutes
export const listInstitutes = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;

    const where = {};
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { email: { contains: search } },
        { slug: { contains: search } },
      ];
    }

    const [total, institutes] = await Promise.all([
      prisma.institute.count({ where }),
      prisma.institute.findMany({
        where,
        skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
        take: parseInt(limit, 10),
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
              students: true,
              teachers: true,
              classes: true,
            },
          },
          users: {
            where: { role: 'ADMIN' },
            select: { id: true, email: true, username: true, isActive: true },
            take: 1,
          },
        },
      }),
    ]);

    const formattedInstitutes = institutes.map(inst => ({
      id: inst.id,
      name: inst.name,
      slug: inst.slug,
      code: inst.code,
      email: inst.email,
      phone: inst.phone,
      address: inst.address,
      logo: inst.logo,
      isActive: inst.isActive,
      createdAt: inst.createdAt,
      updatedAt: inst.updatedAt,
      stats: {
        users: inst._count.users,
        students: inst._count.students,
        teachers: inst._count.teachers,
        classes: inst._count.classes,
      },
      admin: inst.users[0] || null,
    }));

    return res.status(200).json({
      success: true,
      data: formattedInstitutes,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve institutes list.',
      error: error.message,
    });
  }
};

// 3. Create Institute
const createInstituteSchema = z.object({
  name: z.string().min(2, 'Institute name must be at least 2 characters'),
  code: z.string().optional(),
  slug: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().optional().or(z.literal('')),
  principalName: z.string().optional().or(z.literal('')),
  logo: z.string().optional().nullable(),
  signatureImage: z.string().optional().nullable(),
  stampImage: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  // Optional initial admin
  adminEmail: z.string().email().optional().or(z.literal('')),
  adminPassword: z.string().min(6).optional().or(z.literal('')),
  adminUsername: z.string().optional(),
  referrerCode: z.string().optional().or(z.literal('')),
});

export const createInstitute = async (req, res) => {
  try {
    const parseResult = createInstituteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid institute creation data.',
        errors: parseResult.error.flatten(),
      });
    }

    const {
      name,
      email,
      phone,
      address,
      website,
      principalName,
      logo,
      signatureImage,
      stampImage,
      isActive = true,
      adminEmail,
      adminPassword,
      adminUsername,
      referrerCode,
    } = parseResult.data;

    let code = parseResult.data.code ? parseResult.data.code.trim().toUpperCase() : await generateInstituteCode();
    let slug = parseResult.data.slug ? generateSlug(parseResult.data.slug) : generateSlug(name);

    // Ensure code uniqueness
    let existingCode = await prisma.institute.findUnique({ where: { code } });
    if (existingCode) {
      return res.status(409).json({
        success: false,
        message: `Institute Code '${code}' is already in use. Please provide a unique code.`,
      });
    }

    // Ensure slug uniqueness
    let existingSlug = await prisma.institute.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
    }

    // Create Institute
    const newInstitute = await prisma.institute.create({
      data: {
        name,
        code,
        slug,
        email: email || null,
        phone: phone || null,
        address: address || null,
        website: website || null,
        principalName: principalName || null,
        logo: logo || null,
        signatureImage: signatureImage || null,
        stampImage: stampImage || null,
        isActive,
      },
    });

    let createdAdmin = null;
    if (adminEmail && adminPassword) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      createdAdmin = await prisma.user.create({
        data: {
          username: adminUsername || adminEmail.split('@')[0],
          email: adminEmail,
          passwordHash,
          role: 'ADMIN',
          instituteId: newInstitute.id,
          isActive: true,
        },
      });
    }

    // Provision an initial onboarding subscription snapshot for the new institute
    const starterPlan = await prisma.subscriptionPlan.findFirst({
      where: { isActive: true },
      include: {
        features: {
          where: { isEnabled: true },
          include: { feature: true },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    if (starterPlan) {
      const featuresSnapshot = starterPlan.features.map((pf) => ({
        id: pf.feature.id,
        code: pf.feature.code,
        name: pf.feature.name,
      }));

      const limitsSnapshot = {
        students: starterPlan.studentLimit,
        teachers: starterPlan.teacherLimit,
        admins: starterPlan.adminLimit,
        classes: starterPlan.classLimit,
        courses: starterPlan.courseLimit,
        storageGb: starterPlan.storageLimitGb,
        branches: starterPlan.branchLimit,
      };

      const now = new Date();
      const trialEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await prisma.instituteSubscription.create({
        data: {
          instituteId: newInstitute.id,
          planId: starterPlan.id,
          planNameSnapshot: `${starterPlan.name} (Trial)`,
          priceSnapshot: starterPlan.price,
          currencySnapshot: starterPlan.currency,
          durationSnapshot: starterPlan.duration,
          durationTypeSnapshot: starterPlan.durationType,
          featuresSnapshot,
          limitsSnapshot,
          startDate: now,
          endDate: trialEndDate,
          status: 'ACTIVE',
        },
      });
    }

    // Automatically provision unique referral profile for the new institute
    try {
      await getOrCreateInstituteReferralProfile(newInstitute.id);
      if (referrerCode) {
        await recordInstituteReferralOnRegistration({
          referrerCode,
          newInstituteId: newInstitute.id,
        });
      }
    } catch (refErr) {
      console.warn('Referral profile provisioning notice:', refErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Institute created successfully.',
      data: {
        ...newInstitute,
        admin: createdAdmin ? { id: createdAdmin.id, email: createdAdmin.email, username: createdAdmin.username } : null,
      },
    });
  } catch (error) {
    console.error('Create institute error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create institute.',
      error: error.message,
    });
  }
};

// 4. Get Institute Detail
export const getInstituteById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const institute = await prisma.institute.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            students: true,
            teachers: true,
            parents: true,
            classes: true,
            subjects: true,
            exams: true,
            invoices: true,
          },
        },
        users: {
          where: { role: 'ADMIN' },
          select: {
            id: true,
            username: true,
            email: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!institute) {
      return res.status(404).json({
        success: false,
        message: 'Institute not found.',
      });
    }

    // Get Subscription Entitlement and Real-time Usage stats
    const { getInstituteUsageStats } = await import('../services/entitlement.service.js');
    const usageStats = await getInstituteUsageStats(id);

    return res.status(200).json({
      success: true,
      data: {
        ...institute,
        hasSignature: Boolean(institute.signatureImage),
        hasStamp: Boolean(institute.stampImage),
        signatureUrl: institute.signatureImage ? `/api/super-admin/institutes/${id}/branding-assets/signature` : null,
        stampUrl: institute.stampImage ? `/api/super-admin/institutes/${id}/branding-assets/stamp` : null,
        admins: institute.users,
        subscription: usageStats.entitlement,
        usage: usageStats.usage,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch institute details.',
      error: error.message,
    });
  }
};

// 5. Update Institute
export const updateInstitute = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, email, phone, address, website, principalName, logo, signatureImage, stampImage, isActive } = req.body;

    const existing = await prisma.institute.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Institute not found.',
      });
    }

    const updated = await prisma.institute.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(website !== undefined && { website }),
        ...(principalName !== undefined && { principalName }),
        ...(logo !== undefined && { logo }),
        ...(signatureImage !== undefined && { signatureImage }),
        ...(stampImage !== undefined && { stampImage }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Institute updated successfully.',
      data: {
        ...updated,
        hasSignature: Boolean(updated.signatureImage),
        hasStamp: Boolean(updated.stampImage),
        signatureUrl: updated.signatureImage ? `/api/super-admin/institutes/${id}/branding-assets/signature` : null,
        stampUrl: updated.stampImage ? `/api/super-admin/institutes/${id}/branding-assets/stamp` : null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update institute.',
      error: error.message,
    });
  }
};

// 5b. Super Admin Upload Branding Asset
export const uploadSuperAdminBrandingAsset = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No valid image file uploaded.' });
    }

    const assetType = (req.body.type || req.query.type || 'logo').toLowerCase();
    if (!['logo', 'signature', 'stamp'].includes(assetType)) {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Invalid branding asset type. Allowed: logo, signature, stamp.' });
    }

    const institute = await prisma.institute.findUnique({ where: { id } });
    if (!institute) {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Institute not found.' });
    }

    const updateData = {};
    const filename = path.basename(req.file.path || req.file.filename);

    if (assetType === 'logo') {
      if (institute.logo && institute.logo.includes('/uploads/branding/logos/public/')) {
        safeDeleteFile(PUBLIC_LOGO_DIR, institute.logo);
      }
      updateData.logo = `/uploads/branding/logos/public/${filename}`;
    } else if (assetType === 'signature') {
      if (institute.signatureImage) {
        safeDeleteFile(PROTECTED_SIGNATURE_DIR, institute.signatureImage);
      }
      updateData.signatureImage = filename;
    } else if (assetType === 'stamp') {
      if (institute.stampImage) {
        safeDeleteFile(PROTECTED_STAMP_DIR, institute.stampImage);
      }
      updateData.stampImage = filename;
    }

    const updated = await prisma.institute.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: `${assetType.charAt(0).toUpperCase() + assetType.slice(1)} uploaded successfully.`,
      assetType,
      url: assetType === 'logo' ? updateData.logo : `/api/super-admin/institutes/${id}/branding-assets/${assetType}`,
      data: {
        ...updated,
        hasSignature: Boolean(updated.signatureImage),
        hasStamp: Boolean(updated.stampImage),
        signatureUrl: updated.signatureImage ? `/api/super-admin/institutes/${id}/branding-assets/signature` : null,
        stampUrl: updated.stampImage ? `/api/super-admin/institutes/${id}/branding-assets/stamp` : null,
      },
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 5c. Super Admin Remove Branding Asset
export const removeSuperAdminBrandingAsset = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const assetType = (req.params.type || req.body.type || '').toLowerCase();
    if (!['logo', 'signature', 'stamp'].includes(assetType)) {
      return res.status(400).json({ success: false, message: 'Invalid branding asset type. Allowed: logo, signature, stamp.' });
    }

    const institute = await prisma.institute.findUnique({ where: { id } });
    if (!institute) {
      return res.status(404).json({ success: false, message: 'Institute not found.' });
    }

    const updateData = {};
    if (assetType === 'logo') {
      if (institute.logo && institute.logo.includes('/uploads/branding/logos/public/')) {
        safeDeleteFile(PUBLIC_LOGO_DIR, institute.logo);
      }
      updateData.logo = null;
    } else if (assetType === 'signature') {
      if (institute.signatureImage) {
        safeDeleteFile(PROTECTED_SIGNATURE_DIR, institute.signatureImage);
      }
      updateData.signatureImage = null;
    } else if (assetType === 'stamp') {
      if (institute.stampImage) {
        safeDeleteFile(PROTECTED_STAMP_DIR, institute.stampImage);
      }
      updateData.stampImage = null;
    }

    const updated = await prisma.institute.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: `${assetType.charAt(0).toUpperCase() + assetType.slice(1)} removed successfully.`,
      assetType,
      data: {
        ...updated,
        hasSignature: Boolean(updated.signatureImage),
        hasStamp: Boolean(updated.stampImage),
        signatureUrl: updated.signatureImage ? `/api/super-admin/institutes/${id}/branding-assets/signature` : null,
        stampUrl: updated.stampImage ? `/api/super-admin/institutes/${id}/branding-assets/stamp` : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 5d. Super Admin Get Protected Branding Asset
export const getSuperAdminProtectedBrandingAsset = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const assetType = req.params.type.toLowerCase();
    if (!['signature', 'stamp'].includes(assetType)) {
      return res.status(400).json({ success: false, message: 'Invalid protected asset type.' });
    }

    const institute = await prisma.institute.findUnique({
      where: { id },
      select: { id: true, signatureImage: true, stampImage: true },
    });

    if (!institute) {
      return res.status(404).json({ success: false, message: 'Institute not found.' });
    }

    const filename = assetType === 'signature' ? institute.signatureImage : institute.stampImage;
    if (!filename) {
      return res.status(404).json({ success: false, message: `${assetType} has not been uploaded for this institute.` });
    }

    const safeBasename = path.basename(filename);
    const targetDir = assetType === 'signature' ? PROTECTED_SIGNATURE_DIR : PROTECTED_STAMP_DIR;
    const filePath = path.resolve(targetDir, safeBasename);

    if (!filePath.startsWith(path.resolve(targetDir)) || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Requested asset file not found on server.' });
    }

    const ext = path.extname(safeBasename).toLowerCase();
    let contentType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.webp') contentType = 'image/webp';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    const stream = fs.createReadStream(filePath);
    return stream.pipe(res);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Toggle Institute Status (Activate / Deactivate)
export const updateInstituteStatus = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Parameter isActive must be a boolean (true or false).',
      });
    }

    const updated = await prisma.institute.update({
      where: { id },
      data: { isActive },
    });

    return res.status(200).json({
      success: true,
      message: `Institute has been ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle institute status.',
      error: error.message,
    });
  }
};

// 7. List Platform Users
export const listPlatformUsers = async (req, res) => {
  try {
    const { instituteId, role, search } = req.query;

    const where = {};
    if (instituteId) where.instituteId = parseInt(instituteId, 10);
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { username: { contains: search } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        institute: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        institute: u.institute,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to list platform users.',
      error: error.message,
    });
  }
};
