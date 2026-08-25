import { z } from 'zod';
import prisma from '../config/prisma.js';

// Validation Schema for creating/updating a subscription plan
const planSchema = z.object({
  name: z.string().min(2, 'Plan name must be at least 2 characters'),
  description: z.string().optional().nullable(),
  price: z.preprocess((val) => parseFloat(val), z.number().min(0, 'Price cannot be negative')),
  currency: z.string().default('LKR'),
  duration: z.preprocess((val) => parseInt(val, 10), z.number().int().min(1, 'Duration must be at least 1')),
  durationType: z.enum(['DAYS', 'MONTHS', 'YEARS']).default('MONTHS'),
  isActive: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  displayOrder: z.preprocess((val) => (val !== undefined && val !== null ? parseInt(val, 10) : 0), z.number().int()).default(0),

  // Configurable usage limits (null = unlimited)
  studentLimit: z.preprocess((val) => (val === '' || val === null || val === undefined ? null : parseInt(val, 10)), z.number().int().min(0, 'Student limit cannot be negative').nullable()),
  teacherLimit: z.preprocess((val) => (val === '' || val === null || val === undefined ? null : parseInt(val, 10)), z.number().int().min(0, 'Teacher limit cannot be negative').nullable()),
  adminLimit: z.preprocess((val) => (val === '' || val === null || val === undefined ? null : parseInt(val, 10)), z.number().int().min(0, 'Admin limit cannot be negative').nullable()),
  classLimit: z.preprocess((val) => (val === '' || val === null || val === undefined ? null : parseInt(val, 10)), z.number().int().min(0, 'Class limit cannot be negative').nullable()),
  courseLimit: z.preprocess((val) => (val === '' || val === null || val === undefined ? null : parseInt(val, 10)), z.number().int().min(0, 'Course limit cannot be negative').nullable()),
  storageLimitGb: z.preprocess((val) => (val === '' || val === null || val === undefined ? null : parseInt(val, 10)), z.number().int().min(0, 'Storage limit cannot be negative').nullable()),
  branchLimit: z.preprocess((val) => (val === '' || val === null || val === undefined ? null : parseInt(val, 10)), z.number().int().min(0, 'Branch limit cannot be negative').nullable()),

  // Array of feature IDs enabled for this plan
  featureIds: z.array(z.number().int()).optional(),
});

// GET /api/super-admin/features - Central Feature Catalog
export const getFeatures = async (req, res, next) => {
  try {
    const features = await prisma.feature.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Group features by category
    const grouped = features.reduce((acc, feat) => {
      acc[feat.category] = acc[feat.category] || [];
      acc[feat.category].push(feat);
      return acc;
    }, {});

    res.json({
      success: true,
      data: features,
      grouped,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/super-admin/plans - All plans for Super Admin management
export const getPlans = async (req, res, next) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        features: {
          include: {
            feature: true,
          },
        },
      },
    });

    const formatted = plans.map((p) => ({
      ...p,
      price: parseFloat(p.price),
      enabledFeaturesCount: p.features.filter((f) => f.isEnabled).length,
      totalFeaturesCount: p.features.length,
    }));

    res.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/super-admin/plans/:id - Single Plan Details
export const getPlanById = async (req, res, next) => {
  try {
    const planId = parseInt(req.params.id, 10);
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
      include: {
        features: {
          include: {
            feature: true,
          },
        },
      },
    });

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found.' });
    }

    res.json({
      success: true,
      data: {
        ...plan,
        price: parseFloat(plan.price),
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/super-admin/plans - Create a new dynamic plan
export const createPlan = async (req, res, next) => {
  try {
    const parsed = planSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Validation failed.',
        errors: parsed.error.errors,
      });
    }

    const { featureIds, ...planData } = parsed.data;
    const allFeatures = await prisma.feature.findMany();

    const newPlan = await prisma.$transaction(async (tx) => {
      const plan = await tx.subscriptionPlan.create({
        data: planData,
      });

      if (allFeatures.length > 0) {
        const featureRecords = allFeatures.map((f) => ({
          planId: plan.id,
          featureId: f.id,
          isEnabled: featureIds ? featureIds.includes(f.id) : true,
        }));

        await tx.planFeature.createMany({
          data: featureRecords,
        });
      }

      return plan;
    });

    const fullPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: newPlan.id },
      include: {
        features: {
          include: { feature: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Subscription plan created successfully.',
      data: {
        ...fullPlan,
        price: parseFloat(fullPlan.price),
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/super-admin/plans/:id - Update an existing plan
export const updatePlan = async (req, res, next) => {
  try {
    const planId = parseInt(req.params.id, 10);
    const existing = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found.' });
    }

    const parsed = planSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Validation failed.',
        errors: parsed.error.errors,
      });
    }

    const { featureIds, ...planData } = parsed.data;
    const allFeatures = await prisma.feature.findMany();

    await prisma.$transaction(async (tx) => {
      await tx.subscriptionPlan.update({
        where: { id: planId },
        data: planData,
      });

      if (featureIds !== undefined) {
        for (const feat of allFeatures) {
          const isEnabled = featureIds.includes(feat.id);
          await tx.planFeature.upsert({
            where: {
              planId_featureId: { planId, featureId: feat.id },
            },
            update: { isEnabled },
            create: { planId, featureId: feat.id, isEnabled },
          });
        }
      }
    });

    const updated = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
      include: {
        features: {
          include: { feature: true },
        },
      },
    });

    res.json({
      success: true,
      message: 'Subscription plan updated successfully.',
      data: {
        ...updated,
        price: parseFloat(updated.price),
      },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/super-admin/plans/:id/status - Toggle active/inactive
export const togglePlanStatus = async (req, res, next) => {
  try {
    const planId = parseInt(req.params.id, 10);
    const existing = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found.' });
    }

    const isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !existing.isActive;

    const updated = await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: { isActive },
    });

    res.json({
      success: true,
      message: `Plan status updated to ${isActive ? 'Active' : 'Inactive'}.`,
      data: {
        ...updated,
        price: parseFloat(updated.price),
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/super-admin/plans/:id/duplicate - Clone plan
export const duplicatePlan = async (req, res, next) => {
  try {
    const planId = parseInt(req.params.id, 10);
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
      include: {
        features: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found to duplicate.' });
    }

    const cloned = await prisma.$transaction(async (tx) => {
      const newPlan = await tx.subscriptionPlan.create({
        data: {
          name: `${existing.name} (Copy)`,
          description: existing.description,
          price: existing.price,
          currency: existing.currency,
          duration: existing.duration,
          durationType: existing.durationType,
          isActive: false, // Default inactive until customized
          isPopular: false,
          displayOrder: existing.displayOrder + 1,
          studentLimit: existing.studentLimit,
          teacherLimit: existing.teacherLimit,
          adminLimit: existing.adminLimit,
          classLimit: existing.classLimit,
          courseLimit: existing.courseLimit,
          storageLimitGb: existing.storageLimitGb,
          branchLimit: existing.branchLimit,
        },
      });

      if (existing.features.length > 0) {
        const featureClones = existing.features.map((f) => ({
          planId: newPlan.id,
          featureId: f.featureId,
          isEnabled: f.isEnabled,
        }));

        await tx.planFeature.createMany({
          data: featureClones,
        });
      }

      return newPlan;
    });

    const fullClone = await prisma.subscriptionPlan.findUnique({
      where: { id: cloned.id },
      include: {
        features: {
          include: { feature: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Plan duplicated successfully.',
      data: {
        ...fullClone,
        price: parseFloat(fullClone.price),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/plans - Public / Institute Active Plans Catalog
export const getPublicPlans = async (req, res, next) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { price: 'asc' }],
      include: {
        features: {
          where: { isEnabled: true },
          include: {
            feature: true,
          },
        },
      },
    });

    const formatted = plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: parseFloat(p.price),
      currency: p.currency,
      duration: p.duration,
      durationType: p.durationType,
      isPopular: p.isPopular,
      displayOrder: p.displayOrder,
      limits: {
        students: p.studentLimit,
        teachers: p.teacherLimit,
        admins: p.adminLimit,
        classes: p.classLimit,
        courses: p.courseLimit,
        storageGb: p.storageLimitGb,
        branches: p.branchLimit,
      },
      features: p.features.map((f) => ({
        id: f.feature.id,
        code: f.feature.code,
        name: f.feature.name,
        category: f.feature.category,
        description: f.feature.description,
      })),
    }));

    res.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};
