import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/prisma.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const formatInstituteBranding = (inst) => {
  if (!inst) return null;
  return {
    id: inst.id,
    name: inst.name,
    slug: inst.slug,
    code: inst.code,
    email: inst.email || '',
    phone: inst.phone || '',
    address: inst.address || '',
    website: inst.website || '',
    principalName: inst.principalName || '',
    logo: inst.logo || null,
    hasSignature: Boolean(inst.signatureImage),
    hasStamp: Boolean(inst.stampImage),
    signatureUrl: inst.signatureImage ? '/api/portal/branding-assets/signature' : null,
    stampUrl: inst.stampImage ? '/api/portal/branding-assets/stamp' : null,
    isActive: inst.isActive,
    createdAt: inst.createdAt,
    updatedAt: inst.updatedAt,
  };
};

export const login = async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password format.',
        errors: parseResult.error.flatten(),
      });
    }

    const { email, password } = parseResult.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        institute: true,
        teacher: true,
        student: true,
        parent: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your email and password.',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your email and password.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your personal account has been deactivated. Please contact support.',
      });
    }

    // Resolve institute with profile fallbacks
    let institute = user.institute;
    if (!institute && user.role !== 'SUPER_ADMIN') {
      const fallbackInstId = user.teacher?.instituteId || user.student?.instituteId || user.parent?.instituteId;
      if (fallbackInstId) {
        institute = await prisma.institute.findUnique({ where: { id: fallbackInstId } });
      }
    }

    // Check institute status if not SUPER_ADMIN
    if (user.role !== 'SUPER_ADMIN') {
      if (!institute) {
        return res.status(403).json({
          success: false,
          message: 'Your account is not linked to any active institute.',
        });
      }

      if (!institute.isActive) {
        return res.status(403).json({
          success: false,
          isInstituteInactive: true,
          message: 'Your institute account is currently inactive. Please contact EduNexa support.',
        });
      }
    }

    // Determine displayName
    let displayName = user.username;
    if (user.teacher?.name) displayName = user.teacher.name;
    else if (user.student?.name || (user.student?.firstName && user.student?.lastName)) {
      displayName = user.student.name || `${user.student.firstName} ${user.student.lastName}`;
    } else if (user.parent?.name || (user.parent?.firstName && user.parent?.lastName)) {
      displayName = user.parent.name || `${user.parent.firstName} ${user.parent.lastName}`;
    }

    const effectiveInstituteId = institute?.id || user.instituteId;

    const token = jwt.sign(
      { userId: user.id, role: user.role, instituteId: effectiveInstituteId },
      process.env.JWT_SECRET || 'edunexa_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const userPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: displayName,
      role: user.role,
      instituteId: effectiveInstituteId,
    };

    const institutePayload = formatInstituteBranding(institute);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: userPayload,
      institute: institutePayload,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
      error: error.message,
    });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        institute: true,
        teacher: true,
        student: true,
        parent: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let displayName = user.username;
    if (user.teacher?.name) displayName = user.teacher.name;
    else if (user.student?.name || (user.student?.firstName && user.student?.lastName)) {
      displayName = user.student.name || `${user.student.firstName} ${user.student.lastName}`;
    } else if (user.parent?.name || (user.parent?.firstName && user.parent?.lastName)) {
      displayName = user.parent.name || `${user.parent.firstName} ${user.parent.lastName}`;
    }

    // Resolve institute with profile fallbacks
    let institute = user.institute;
    if (!institute && user.role !== 'SUPER_ADMIN') {
      const fallbackInstId = user.teacher?.instituteId || user.student?.instituteId || user.parent?.instituteId;
      if (fallbackInstId) {
        institute = await prisma.institute.findUnique({ where: { id: fallbackInstId } });
      }
    }

    const effectiveInstituteId = institute?.id || user.instituteId;

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: displayName,
        role: user.role,
        instituteId: effectiveInstituteId,
      },
      institute: formatInstituteBranding(institute),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch current user profile.',
      error: error.message,
    });
  }
};

export const logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
};

const registerInstituteSchema = z.object({
  name: z.string().min(2, 'Institute name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  adminName: z.string().optional(),
  adminEmail: z.string().email('Valid admin email is required'),
  adminPassword: z.string().min(6, 'Password must be at least 6 characters'),
  referrerCode: z.string().optional().or(z.literal('')),
});

export const registerInstitute = async (req, res) => {
  try {
    const parseResult = registerInstituteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration details.',
        errors: parseResult.error.flatten(),
      });
    }

    const { name, email, phone, adminName, adminEmail, adminPassword, referrerCode } = parseResult.data;

    // Check existing email
    const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Admin email is already registered in EduNexa.',
      });
    }

    // Generate unique code & slug
    const count = await prisma.institute.count();
    let code = `EDU${String(count + 1).padStart(4, '0')}`;
    let existsCode = await prisma.institute.findUnique({ where: { code } });
    let sfx = 1;
    while (existsCode) {
      code = `EDU${String(count + 1 + sfx).padStart(4, '0')}`;
      existsCode = await prisma.institute.findUnique({ where: { code } });
      sfx++;
    }

    let slug = name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
    let existsSlug = await prisma.institute.findUnique({ where: { slug } });
    if (existsSlug) {
      slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
    }

    let baseUsername = (adminName || adminEmail.split('@')[0]).toLowerCase().replace(/[^\w]/g, '');
    if (!baseUsername) baseUsername = 'admin';
    let username = baseUsername;
    let existsUsername = await prisma.user.findUnique({ where: { username } });
    let uSfx = 1;
    while (existsUsername) {
      username = `${baseUsername}${Math.floor(100 + Math.random() * 900)}`;
      existsUsername = await prisma.user.findUnique({ where: { username } });
      uSfx++;
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const { institute, adminUser } = await prisma.$transaction(async (tx) => {
      const inst = await tx.institute.create({
        data: {
          name,
          slug,
          code,
          email: email || adminEmail,
          phone: phone || null,
          isActive: true,
        },
      });

      const user = await tx.user.create({
        data: {
          username,
          email: adminEmail,
          passwordHash,
          role: 'ADMIN',
          instituteId: inst.id,
          isActive: true,
        },
      });

      return { institute: inst, adminUser: user };
    });

    // Provision referral profile
    const { getOrCreateInstituteReferralProfile, recordInstituteReferralOnRegistration } = await import('../services/referral.service.js');
    await getOrCreateInstituteReferralProfile(institute.id);

    // Track referral if referral code passed
    if (referrerCode) {
      await recordInstituteReferralOnRegistration({
        referrerCode,
        newInstituteId: institute.id,
      });
    }

    const token = jwt.sign(
      { userId: adminUser.id, role: adminUser.role, instituteId: institute.id },
      process.env.JWT_SECRET || 'edunexa_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Institute registered successfully!',
      token,
      user: {
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        name: adminUser.username,
        role: adminUser.role,
        instituteId: institute.id,
      },
      institute: formatInstituteBranding(institute),
    });
  } catch (error) {
    console.error('Institute registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete institute registration.',
      error: error.message,
    });
  }
};
