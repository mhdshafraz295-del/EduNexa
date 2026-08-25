export const requireRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthenticated request.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: requires one of the following roles: [${roles.join(', ')}]. Current role: ${req.user.role}`,
      });
    }

    next();
  };
};

export const requireSuperAdmin = requireRoles('SUPER_ADMIN');
export const requireInstituteAdmin = requireRoles('ADMIN');
export const requireAdminOrTeacher = requireRoles('SUPER_ADMIN', 'ADMIN', 'TEACHER');
export const requireAnyUser = requireRoles('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT');
