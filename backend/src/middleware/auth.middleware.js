import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { formatInstituteBranding } from '../controllers/auth.controller.js';

export const authenticate = async (req, res, next) => {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in to continue.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'edunexa_secret');
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
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
        message: 'User account no longer exists.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your personal account has been deactivated. Please contact your institute administrator.',
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

    // Tenant active check for non-SUPER_ADMIN users
    if (user.role !== 'SUPER_ADMIN') {
      if (!institute) {
        return res.status(403).json({
          success: false,
          message: 'User is not assigned to any valid institute.',
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

    const effectiveInstituteId = institute?.id || user.instituteId;

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive !== false,
      instituteId: effectiveInstituteId,
      institute: formatInstituteBranding(institute),
    };

    req.instituteId = effectiveInstituteId;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session token.',
      error: error.message,
    });
  }
};

export const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const flatRoles = allowedRoles.flat();
    if (!flatRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role '${req.user.role}' is not authorized to access this resource.`,
      });
    }

    next();
  };
};

export const authorizeRoles = authorizeRole;

