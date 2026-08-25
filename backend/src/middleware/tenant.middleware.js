export const tenantMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthenticated tenant request.',
    });
  }

  // If SUPER_ADMIN, they may optionally target an institute or operate globally
  if (req.user.role === 'SUPER_ADMIN') {
    const targetInstituteId = req.headers['x-institute-id'] || req.query.instituteId;
    req.instituteId = targetInstituteId ? parseInt(targetInstituteId, 10) : null;
    return next();
  }

  // Normal institute users (ADMIN, TEACHER, STUDENT, PARENT)
  // NEVER trust client-provided instituteId - strictly enforce authenticated user's instituteId
  if (!req.user.instituteId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: User is not linked to any valid institute.',
    });
  }

  req.instituteId = req.user.instituteId;
  next();
};

export const requireInstituteScope = (req, res, next) => {
  if (!req.instituteId) {
    return res.status(400).json({
      success: false,
      message: 'An explicit institute context is required for this operation.',
    });
  }
  next();
};
