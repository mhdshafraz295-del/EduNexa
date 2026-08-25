import { getInstituteEntitlement, checkPlanLimit } from '../services/entitlement.service.js';

/**
 * Middleware: Requires that the authenticated user belongs to an institute with an ACTIVE subscription.
 * SUPER_ADMIN is completely exempt from subscription checks.
 */
export const requireActiveSubscription = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    // SUPER_ADMIN platform bypass
    if (req.user.role === 'SUPER_ADMIN') {
      req.entitlement = { isValid: true, isSuperAdmin: true, features: {}, limits: {} };
      return next();
    }

    if (!req.user.instituteId) {
      return res.status(400).json({
        success: false,
        message: 'No institute associated with this user.',
      });
    }

    const entitlement = await getInstituteEntitlement(req.user.instituteId);

    if (!entitlement.isValid) {
      if (entitlement.status === 'EXPIRED') {
        return res.status(403).json({
          success: false,
          code: 'SUBSCRIPTION_EXPIRED',
          message: 'Your EduNexa subscription has expired. Please renew to continue using the system.',
          endDate: entitlement.endDate,
        });
      }

      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'An active subscription is required to access EduNexa features.',
        status: entitlement.status,
      });
    }

    req.entitlement = entitlement;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware Factory: Enforces that the active subscription snapshot contains a specific feature code.
 * Example: requireFeature('ATTENDANCE'), requireFeature('ONLINE_EXAMS')
 */
export const requireFeature = (featureCode) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }

      // SUPER_ADMIN platform bypass
      if (req.user.role === 'SUPER_ADMIN') {
        req.entitlement = { isValid: true, isSuperAdmin: true };
        return next();
      }

      // Ensure active subscription first
      const entitlement = await getInstituteEntitlement(req.user.instituteId);

      if (!entitlement.isValid) {
        if (entitlement.status === 'EXPIRED') {
          return res.status(403).json({
            success: false,
            code: 'SUBSCRIPTION_EXPIRED',
            message: 'Your EduNexa subscription has expired. Please renew to access features.',
            endDate: entitlement.endDate,
          });
        }

        return res.status(403).json({
          success: false,
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'An active subscription is required to access this feature.',
          status: entitlement.status,
        });
      }

      req.entitlement = entitlement;

      // Check if feature is included in immutable snapshot
      if (!entitlement.features || !entitlement.features[featureCode]) {
        return res.status(403).json({
          success: false,
          code: 'FEATURE_NOT_INCLUDED',
          feature: featureCode,
          message: `${featureCode.replace(/_/g, ' ')} is not included in your current subscription plan.`,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware Factory: Enforces plan capacity limit before creating an entity (e.g. students, teachers, classes)
 */
export const checkLimit = (limitType) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }

      if (req.user.role === 'SUPER_ADMIN') {
        return next();
      }

      const limitCheck = await checkPlanLimit(req.user.instituteId, limitType);

      if (!limitCheck.allowed) {
        return res.status(403).json({
          success: false,
          code: limitCheck.code,
          limit: limitCheck.limit,
          current: limitCheck.current,
          maximum: limitCheck.maximum,
          message: limitCheck.message,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
