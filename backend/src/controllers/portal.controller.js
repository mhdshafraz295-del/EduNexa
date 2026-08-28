import path from 'path';
import fs from 'fs';
import prisma from '../config/prisma.js';
import { timeToMinutes } from '../services/timetableConflict.service.js';
import { PUBLIC_LOGO_DIR, PROTECTED_SIGNATURE_DIR, PROTECTED_STAMP_DIR } from '../middleware/upload.middleware.js';
import { processStorageUpload, getStorageResource, deleteStorageResource } from '../services/storage/storageResolver.js';

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

const formatInstituteBranding = (inst) => {
  if (!inst) return null;
  return {
    id: inst.id,
    name: inst.name,
    code: inst.code,
    slug: inst.slug,
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

const DAYS_MAP = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

// ============================================================
// 1. INSTITUTE ADMIN DASHBOARD
// ============================================================
export const getInstituteDashboard = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const now = new Date();
    const todayDayOfWeek = DAYS_MAP[now.getDay()];

    const [
      studentsCount,
      teachersCount,
      classesCount,
      subjectsCount,
      invoicesCount,
      unpaidInvoicesCount,
      currentAcademicYear,
      todaySessions,
      recentStudents,
      recentInvoices,
      institute,
    ] = await Promise.all([
      prisma.student.count({ where: { instituteId } }),
      prisma.teacher.count({ where: { instituteId } }),
      prisma.class.count({ where: { instituteId } }),
      prisma.subject.count({ where: { instituteId } }),
      prisma.invoice.count({ where: { instituteId } }),
      prisma.invoice.count({ where: { instituteId, status: 'UNPAID' } }),
      prisma.academicYear.findFirst({
        where: { instituteId, isCurrent: true },
      }),
      prisma.timetableSession.findMany({
        where: { instituteId, dayOfWeek: todayDayOfWeek, isActive: true },
        include: { class: true, subject: true, teacher: true },
        orderBy: { startTime: 'asc' },
        take: 8,
      }),
      prisma.student.findMany({
        where: { instituteId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { class: true },
      }),
      prisma.invoice.findMany({
        where: { instituteId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { student: true },
      }),
      prisma.institute.findUnique({
        where: { id: instituteId },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        institute,
        currentAcademicYear,
        counts: {
          students: studentsCount,
          teachers: teachersCount,
          classes: classesCount,
          subjects: subjectsCount,
          invoices: invoicesCount,
          unpaidInvoices: unpaidInvoicesCount,
          todaySessions: todaySessions.length,
        },
        todaySessions,
        todayDayOfWeek,
        recentStudents,
        recentInvoices,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// 2. TEACHER PORTAL DASHBOARD
// ============================================================
export const getTeacherPortalDashboard = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const userId = req.user.id;
    const now = new Date();
    const todayDayOfWeek = DAYS_MAP[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 1. Locate teacher profile
    const teacher = await prisma.teacher.findFirst({
      where: { userId, instituteId },
      include: {
        user: { select: { email: true, username: true } },
      },
    });

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found for this account in this institute.',
      });
    }

    // 2. Query Teacher Assignments & Class Teacher roles
    const [assignments, classTeacherOf, allTimetableSessions] = await Promise.all([
      prisma.teacherAssignment.findMany({
        where: { teacherId: teacher.id, instituteId },
        include: { class: true, subject: true, academicYear: true },
      }),
      prisma.class.findMany({
        where: { classTeacherId: teacher.id, instituteId },
        include: { academicLevel: true, academicYear: true },
      }),
      prisma.timetableSession.findMany({
        where: { teacherId: teacher.id, instituteId, isActive: true },
        include: { class: true, subject: true, academicYear: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
    ]);

    // 3. Filter Zoom link sanitization based on active plan feature
    const hasZoomFeature = req.entitlement?.features?.ZOOM_CLASSES || req.user.role === 'SUPER_ADMIN';
    const sanitizedSessions = allTimetableSessions.map((s) => {
      if (!hasZoomFeature) {
        return { ...s, meetingUrl: null, meetingId: null, meetingPassword: null };
      }
      return s;
    });

    const todaySessions = sanitizedSessions.filter((s) => s.dayOfWeek === todayDayOfWeek);
    const upcomingSessions = todaySessions.filter((s) => timeToMinutes(s.startTime) >= currentMinutes);

    // Extract unique assigned classes and subjects
    const classMap = new Map();
    const subjectMap = new Map();

    for (const a of assignments) {
      if (a.class) classMap.set(a.class.id, a.class);
      if (a.subject) subjectMap.set(a.subject.id, a.subject);
    }
    for (const c of classTeacherOf) {
      classMap.set(c.id, c);
    }

    return res.status(200).json({
      success: true,
      data: {
        teacher: {
          id: teacher.id,
          name: teacher.name,
          employeeId: teacher.employeeId,
          designation: teacher.designation,
          qualification: teacher.qualification,
          phone: teacher.phone,
          email: teacher.user?.email,
          address: teacher.address,
        },
        assignedClasses: Array.from(classMap.values()),
        assignedSubjects: Array.from(subjectMap.values()),
        assignments,
        classTeacherOf,
        todayDayOfWeek,
        todaySessions,
        upcomingSessions,
        weeklyTimetable: sanitizedSessions,
        stats: {
          assignedClassesCount: classMap.size,
          assignedSubjectsCount: subjectMap.size,
          todaySessionsCount: todaySessions.length,
          weeklySessionsCount: sanitizedSessions.length,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// 3. STUDENT PORTAL DASHBOARD
// ============================================================
export const getStudentPortalDashboard = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const userId = req.user.id;
    const now = new Date();
    const todayDayOfWeek = DAYS_MAP[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 1. Locate student record
    const student = await prisma.student.findFirst({
      where: { userId, instituteId },
      include: {
        class: {
          include: {
            academicLevel: true,
            academicYear: true,
            classTeacher: true,
          },
        },
        studentEnrollments: {
          where: { status: 'ACTIVE' },
          include: { academicYear: true, class: true },
          orderBy: { enrollmentDate: 'desc' },
          take: 1,
        },
        user: { select: { email: true, username: true } },
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found for this account in this institute.',
      });
    }

    const currentClass = student.class || (student.studentEnrollments[0]?.class ?? null);
    const activeEnrollment = student.studentEnrollments[0] || null;

    let classSubjects = [];
    let allTimetableSessions = [];

    if (currentClass) {
      const sessionsRes = await prisma.timetableSession.findMany({
        where: { classId: currentClass.id, instituteId, isActive: true },
        include: { subject: true, teacher: true, class: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });

      if (student.subjectsConfigured) {
        // EXPLICITLY CONFIGURED: Return ONLY per-student subject enrollments (even if [])
        const studentSubRes = await prisma.studentSubject.findMany({
          where: { studentId: student.id, instituteId },
          include: {
            subject: {
              include: {
                teacherAssignments: {
                  where: { classId: currentClass.id },
                  include: { teacher: true },
                },
              },
            },
          },
        });
        classSubjects = studentSubRes.map((ss) => ss.subject).filter(Boolean);

        // Filter timetable sessions to match assigned student subjects
        const assignedSubjectIds = new Set(classSubjects.map((s) => s.id));
        allTimetableSessions = sessionsRes.filter((s) => s.subjectId && assignedSubjectIds.has(s.subjectId));
      } else {
        // LEGACY UNCONFIGURED STUDENT: Fallback to all class subjects
        const subjectsRes = await prisma.classSubject.findMany({
          where: { classId: currentClass.id, instituteId },
          include: {
            subject: {
              include: {
                teacherAssignments: {
                  where: { classId: currentClass.id },
                  include: { teacher: true },
                },
              },
            },
          },
        });
        classSubjects = subjectsRes.map((cs) => cs.subject).filter(Boolean);
        allTimetableSessions = sessionsRes;
      }
    }

    // Zoom link sanitization
    const hasZoomFeature = req.entitlement?.features?.ZOOM_CLASSES || req.user.role === 'SUPER_ADMIN';
    const sanitizedSessions = allTimetableSessions.map((s) => {
      if (!hasZoomFeature) {
        return { ...s, meetingUrl: null, meetingId: null, meetingPassword: null };
      }
      return s;
    });

    const todaySessions = sanitizedSessions.filter((s) => s.dayOfWeek === todayDayOfWeek);
    const upcomingSessions = todaySessions.filter((s) => timeToMinutes(s.startTime) >= currentMinutes);

    return res.status(200).json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim(),
          admissionNumber: student.admissionNumber,
          rollNo: student.rollNo,
          gender: student.gender,
          phone: student.phone,
          address: student.address,
          email: student.user?.email,
        },
        currentClass,
        activeEnrollment,
        subjects: classSubjects,
        todayDayOfWeek,
        todaySessions,
        upcomingSessions,
        weeklyTimetable: sanitizedSessions,
        stats: {
          enrolledSubjectsCount: classSubjects.length,
          todaySessionsCount: todaySessions.length,
          weeklySessionsCount: sanitizedSessions.length,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// 4. PARENT PORTAL DASHBOARD
// ============================================================
export const getParentPortalDashboard = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const userId = req.user.id;
    const now = new Date();
    const todayDayOfWeek = DAYS_MAP[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 1. Locate parent profile & linked students
    const parent = await prisma.parent.findFirst({
      where: { userId, instituteId },
      include: {
        students: {
          include: {
            student: {
              include: {
                class: {
                  include: {
                    academicLevel: true,
                    academicYear: true,
                    classTeacher: true,
                  },
                },
                studentEnrollments: {
                  where: { status: 'ACTIVE' },
                  include: { academicYear: true, class: true },
                },
                invoices: {
                  take: 5,
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
          },
        },
        user: { select: { email: true, username: true } },
      },
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent profile not found for this account in this institute.',
      });
    }

    const hasZoomFeature = req.entitlement?.features?.ZOOM_CLASSES || req.user.role === 'SUPER_ADMIN';

    // Process each linked child with full academic details
    const childrenData = await Promise.all(
      parent.students.map(async (ps) => {
        const student = ps.student;
        if (!student) return null;

        const currentClass = student.class || (student.studentEnrollments[0]?.class ?? null);
        let subjects = [];
        let timetableSessions = [];

        if (currentClass) {
          const sessRes = await prisma.timetableSession.findMany({
            where: { classId: currentClass.id, instituteId, isActive: true },
            include: { subject: true, teacher: true, class: true },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          });

          if (student.subjectsConfigured) {
            const studentSubRes = await prisma.studentSubject.findMany({
              where: { studentId: student.id, instituteId },
              include: {
                subject: {
                  include: {
                    teacherAssignments: {
                      where: { classId: currentClass.id },
                      include: { teacher: true },
                    },
                  },
                },
              },
            });
            subjects = studentSubRes.map((ss) => ss.subject).filter(Boolean);
            const assignedSubIds = new Set(subjects.map((s) => s.id));
            const filteredSess = sessRes.filter((s) => s.subjectId && assignedSubIds.has(s.subjectId));

            timetableSessions = filteredSess.map((s) => {
              if (!hasZoomFeature) {
                return { ...s, meetingUrl: null, meetingId: null, meetingPassword: null };
              }
              return s;
            });
          } else {
            const subRes = await prisma.classSubject.findMany({
              where: { classId: currentClass.id, instituteId },
              include: {
                subject: {
                  include: {
                    teacherAssignments: {
                      where: { classId: currentClass.id },
                      include: { teacher: true },
                    },
                  },
                },
              },
            });
            subjects = subRes.map((cs) => cs.subject).filter(Boolean);
            timetableSessions = sessRes.map((s) => {
              if (!hasZoomFeature) {
                return { ...s, meetingUrl: null, meetingId: null, meetingPassword: null };
              }
              return s;
            });
          }
        }

        const todaySessions = timetableSessions.filter((s) => s.dayOfWeek === todayDayOfWeek);
        const upcomingSessions = todaySessions.filter((s) => timeToMinutes(s.startTime) >= currentMinutes);

        return {
          id: student.id,
          name: student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim(),
          admissionNumber: student.admissionNumber,
          rollNo: student.rollNo,
          relationship: ps.relationship || 'Child',
          currentClass,
          subjects,
          invoices: student.invoices || [],
          todaySessions,
          upcomingSessions,
          weeklyTimetable: timetableSessions,
        };
      })
    );

    const validChildren = childrenData.filter(Boolean);

    return res.status(200).json({
      success: true,
      data: {
        parent: {
          id: parent.id,
          name: parent.name,
          phone: parent.phone,
          occupation: parent.occupation,
          email: parent.user?.email,
        },
        children: validChildren,
        todayDayOfWeek,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// 5. INSTITUTE SETTINGS & DYNAMIC BRANDING
// ============================================================
export const getInstituteSettings = async (req, res) => {
  try {
    const institute = await prisma.institute.findUnique({
      where: { id: req.instituteId },
    });
    if (!institute) {
      return res.status(404).json({ success: false, message: 'Institute not found.' });
    }
    return res.status(200).json({ success: true, data: formatInstituteBranding(institute) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateInstituteSettings = async (req, res) => {
  try {
    const { name, email, phone, address, website, principalName, logo } = req.body;
    const existing = await prisma.institute.findUnique({ where: { id: req.instituteId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Institute not found.' });
    }

    const updated = await prisma.institute.update({
      where: { id: req.instituteId },
      data: {
        ...(name && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(website !== undefined && { website }),
        ...(principalName !== undefined && { principalName }),
        ...(logo !== undefined && { logo }),
      },
    });
    return res.status(200).json({
      success: true,
      message: 'Institute settings and branding updated successfully.',
      data: formatInstituteBranding(updated),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadInstituteBrandingAsset = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No valid image file uploaded.' });
    }

    const assetType = (req.body.type || req.query.type || 'logo').toLowerCase();
    if (!['logo', 'signature', 'stamp'].includes(assetType)) {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Invalid branding asset type. Allowed: logo, signature, stamp.' });
    }

    const institute = await prisma.institute.findUnique({ where: { id: req.instituteId } });
    if (!institute) {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Institute not found.' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const targetDir = assetType === 'signature' ? PROTECTED_SIGNATURE_DIR : (assetType === 'stamp' ? PROTECTED_STAMP_DIR : PUBLIC_LOGO_DIR);
    const uniqueFilename = `branding_${assetType}_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    const r2Key = `institutes/${req.instituteId}/branding/${assetType}s/${uniqueFilename}`;

    const uploadResult = await processStorageUpload({
      filePath: req.file.path,
      r2Key,
      localDir: targetDir,
      localFilename: uniqueFilename,
      mimeType: req.file.mimetype,
      moduleName: `branding-${assetType}`,
    });

    const updateData = {};
    if (assetType === 'logo') {
      if (institute.logo) await deleteStorageResource(institute.logo);
      updateData.logo = uploadResult.storageRef;
    } else if (assetType === 'signature') {
      if (institute.signatureImage) await deleteStorageResource(institute.signatureImage);
      updateData.signatureImage = uploadResult.storageRef;
    } else if (assetType === 'stamp') {
      if (institute.stampImage) await deleteStorageResource(institute.stampImage);
      updateData.stampImage = uploadResult.storageRef;
    }

    const updated = await prisma.institute.update({
      where: { id: req.instituteId },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: `${assetType.charAt(0).toUpperCase() + assetType.slice(1)} uploaded successfully.`,
      assetType,
      url: assetType === 'logo' ? updateData.logo : `/api/portal/branding-assets/${assetType}`,
      data: formatInstituteBranding(updated),
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const removeInstituteBrandingAsset = async (req, res) => {
  try {
    const assetType = (req.params.type || req.body.type || '').toLowerCase();
    if (!['logo', 'signature', 'stamp'].includes(assetType)) {
      return res.status(400).json({ success: false, message: 'Invalid branding asset type. Allowed: logo, signature, stamp.' });
    }

    const institute = await prisma.institute.findUnique({ where: { id: req.instituteId } });
    if (!institute) {
      return res.status(404).json({ success: false, message: 'Institute not found.' });
    }

    const updateData = {};
    if (assetType === 'logo') {
      if (institute.logo) await deleteStorageResource(institute.logo);
      updateData.logo = null;
    } else if (assetType === 'signature') {
      if (institute.signatureImage) await deleteStorageResource(institute.signatureImage);
      updateData.signatureImage = null;
    } else if (assetType === 'stamp') {
      if (institute.stampImage) await deleteStorageResource(institute.stampImage);
      updateData.stampImage = null;
    }

    const updated = await prisma.institute.update({
      where: { id: req.instituteId },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: `${assetType.charAt(0).toUpperCase() + assetType.slice(1)} removed successfully.`,
      assetType,
      data: formatInstituteBranding(updated),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPublicInstituteLogo = async (req, res) => {
  try {
    const { instituteId } = req.params;
    let instId = parseInt(instituteId, 10);

    if (isNaN(instId) && req.params.instituteId === 'current') {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        try {
          const jwt = await import('jsonwebtoken');
          const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'edunexa-secret');
          instId = decoded.instituteId;
        } catch (e) {}
      }
    }

    if (isNaN(instId)) {
      return res.status(400).json({ success: false, message: 'Invalid institute ID.' });
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instId },
      select: { logo: true },
    });

    if (!institute || !institute.logo) {
      return res.status(404).json({ success: false, message: 'Logo not found for this institute.' });
    }

    let storageRef = institute.logo;
    if (!storageRef.startsWith('r2://') && !storageRef.startsWith('/')) {
      const safeBasename = path.basename(institute.logo);
      storageRef = path.join(PUBLIC_LOGO_DIR, safeBasename);
    }

    const resource = await getStorageResource(storageRef);
    if (!resource || !resource.stream) {
      return res.status(404).json({ success: false, message: 'Logo file not found.' });
    }

    res.setHeader('Content-Type', resource.contentType || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (resource.contentLength) {
      res.setHeader('Content-Length', resource.contentLength);
    }

    return resource.stream.pipe(res);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getProtectedBrandingAsset = async (req, res) => {
  try {
    const assetType = req.params.type.toLowerCase();
    if (!['signature', 'stamp'].includes(assetType)) {
      return res.status(400).json({ success: false, message: 'Invalid protected branding asset type. Only signature and stamp require authentication.' });
    }

    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(403).json({ success: false, message: 'User is not linked to any valid institute.' });
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      select: { id: true, signatureImage: true, stampImage: true, isActive: true },
    });

    if (!institute) {
      return res.status(404).json({ success: false, message: 'Institute not found.' });
    }

    const filename = assetType === 'signature' ? institute.signatureImage : institute.stampImage;

    if (!filename) {
      return res.status(404).json({ success: false, message: `${assetType} has not been uploaded for this institute.` });
    }

    let storageRef = filename;
    if (!storageRef.startsWith('r2://') && !storageRef.startsWith('/')) {
      const safeBasename = path.basename(filename);
      const targetDir = assetType === 'signature' ? PROTECTED_SIGNATURE_DIR : PROTECTED_STAMP_DIR;
      storageRef = path.join(targetDir, safeBasename);
    }

    const resource = await getStorageResource(storageRef);
    if (!resource || !resource.stream) {
      return res.status(404).json({ success: false, message: 'Requested asset file not found on server.' });
    }

    res.setHeader('Content-Type', resource.contentType || 'image/png');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    if (resource.contentLength) {
      res.setHeader('Content-Length', resource.contentLength);
    }

    return resource.stream.pipe(res);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// 6. ANALYTICS: INSTITUTE ADMIN
// ============================================================
export const getInstituteAdminAnalytics = async (req, res) => {
  try {
    const instituteId = req.instituteId;

    // Verify subscription feature entitlement for TIMETABLE
    const hasTimetableFeature = Boolean(req.entitlement?.features?.TIMETABLE || req.user.role === 'SUPER_ADMIN');

    const [academicLevels, unassignedClasses, classes, enrollments, students, timetableSessions] = await Promise.all([
      prisma.academicLevel.findMany({
        where: { instituteId, isActive: true },
        orderBy: { displayOrder: 'asc' },
        include: {
          classes: {
            where: { isActive: true },
            include: {
              _count: {
                select: {
                  studentEnrollments: { where: { status: 'ACTIVE' } },
                  students: true,
                },
              },
            },
          },
        },
      }),
      prisma.class.findMany({
        where: { instituteId, academicLevelId: null, isActive: true },
        include: {
          _count: {
            select: {
              studentEnrollments: { where: { status: 'ACTIVE' } },
              students: true,
            },
          },
        },
      }),
      prisma.class.findMany({
        where: { instituteId, isActive: true },
        include: {
          _count: {
            select: {
              studentEnrollments: { where: { status: 'ACTIVE' } },
              students: true,
            },
          },
        },
        orderBy: [{ name: 'asc' }, { section: 'asc' }],
      }),
      prisma.studentEnrollment.findMany({
        where: { instituteId, status: 'ACTIVE' },
        select: { id: true, createdAt: true, enrollmentDate: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.student.findMany({
        where: { instituteId },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      hasTimetableFeature
        ? prisma.timetableSession.findMany({
            where: { instituteId, isActive: true },
            select: { dayOfWeek: true },
          })
        : Promise.resolve([]),
    ]);

    // 1. Students by Academic Level (Dynamic institute levels)
    const studentsByLevel = academicLevels.map((level) => {
      let count = 0;
      level.classes.forEach((c) => {
        count += c._count.studentEnrollments > 0 ? c._count.studentEnrollments : c._count.students;
      });
      return {
        level: level.name,
        code: level.code,
        count,
      };
    });

    // Check if there are students in unassigned level classes
    let unassignedCount = 0;
    unassignedClasses.forEach((c) => {
      unassignedCount += c._count.studentEnrollments > 0 ? c._count.studentEnrollments : c._count.students;
    });
    if (unassignedCount > 0) {
      studentsByLevel.push({
        level: 'Other / General',
        code: 'GENERAL',
        count: unassignedCount,
      });
    }

    // 2. Students by Class / Batch
    const studentsByClass = classes.map((c) => {
      const count = c._count.studentEnrollments > 0 ? c._count.studentEnrollments : c._count.students;
      return {
        className: `${c.name}${c.section ? ` (${c.section})` : ''}`,
        name: c.name,
        section: c.section || '',
        count,
      };
    });

    // 3. Student Growth: Real monthly trend from enrollment or registration
    const dateSource = enrollments.length > 0 ? enrollments.map((e) => e.createdAt || e.enrollmentDate) : students.map((s) => s.createdAt);
    const growthMap = new Map();
    dateSource.forEach((dVal) => {
      if (!dVal) return;
      const d = new Date(dVal);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!growthMap.has(key)) {
        growthMap.set(key, { key, label, count: 0 });
      }
      growthMap.get(key).count += 1;
    });

    const sortedGrowth = Array.from(growthMap.values()).sort((a, b) => a.key.localeCompare(b.key));
    let cumulative = 0;
    const studentGrowth = sortedGrowth.map((item) => {
      cumulative += item.count;
      return {
        month: item.label,
        count: item.count,
        cumulative,
      };
    });

    // 4. Weekly Timetable Sessions (Mon - Sun)
    const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const dayLabels = {
      MONDAY: 'Mon',
      TUESDAY: 'Tue',
      WEDNESDAY: 'Wed',
      THURSDAY: 'Thu',
      FRIDAY: 'Fri',
      SATURDAY: 'Sat',
      SUNDAY: 'Sun',
    };

    let weeklyTimetable = [];
    if (hasTimetableFeature) {
      const countsByDay = {};
      dayOrder.forEach((d) => { countsByDay[d] = 0; });
      timetableSessions.forEach((s) => {
        if (countsByDay[s.dayOfWeek] !== undefined) {
          countsByDay[s.dayOfWeek] += 1;
        }
      });

      weeklyTimetable = dayOrder.map((day) => ({
        day: dayLabels[day],
        fullDay: day,
        sessions: countsByDay[day],
      }));
    }

    return res.status(200).json({
      success: true,
      data: {
        studentsByLevel,
        studentsByClass,
        studentGrowth,
        weeklyTimetable,
        hasTimetableFeature,
      },
    });
  } catch (error) {
    console.error('Institute admin analytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load institute analytics data.',
      error: error.message,
    });
  }
};

// ============================================================
// 7. ANALYTICS: TEACHER
// ============================================================
export const getTeacherAnalytics = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const userId = req.user.id;

    const teacher = await prisma.teacher.findFirst({
      where: { userId, instituteId },
    });

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found for this account.',
      });
    }

    const [assignments, classTeacherOf, sessions] = await Promise.all([
      prisma.teacherAssignment.findMany({
        where: { teacherId: teacher.id, instituteId },
        include: {
          class: {
            include: {
              _count: {
                select: {
                  studentEnrollments: { where: { status: 'ACTIVE' } },
                  students: true,
                },
              },
            },
          },
          subject: true,
        },
      }),
      prisma.class.findMany({
        where: { classTeacherId: teacher.id, instituteId },
        include: {
          _count: {
            select: {
              studentEnrollments: { where: { status: 'ACTIVE' } },
              students: true,
            },
          },
        },
      }),
      prisma.timetableSession.findMany({
        where: { teacherId: teacher.id, instituteId, isActive: true },
        include: { subject: true, class: true },
      }),
    ]);

    // 1. Students by Assigned Class (deduplicate classes)
    const classMap = new Map();
    assignments.forEach((a) => {
      if (a.class && !classMap.has(a.class.id)) {
        const count = a.class._count.studentEnrollments > 0 ? a.class._count.studentEnrollments : a.class._count.students;
        classMap.set(a.class.id, {
          className: `${a.class.name}${a.class.section ? ` (${a.class.section})` : ''}`,
          count,
        });
      }
    });

    classTeacherOf.forEach((c) => {
      if (!classMap.has(c.id)) {
        const count = c._count.studentEnrollments > 0 ? c._count.studentEnrollments : c._count.students;
        classMap.set(c.id, {
          className: `${c.name}${c.section ? ` (${c.section})` : ''}`,
          count,
        });
      }
    });

    const studentsByClass = Array.from(classMap.values());

    // 2. Weekly Teaching Sessions
    const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const dayLabels = {
      MONDAY: 'Mon',
      TUESDAY: 'Tue',
      WEDNESDAY: 'Wed',
      THURSDAY: 'Thu',
      FRIDAY: 'Fri',
      SATURDAY: 'Sat',
      SUNDAY: 'Sun',
    };
    const countsByDay = {};
    dayOrder.forEach((d) => { countsByDay[d] = 0; });
    sessions.forEach((s) => {
      if (countsByDay[s.dayOfWeek] !== undefined) {
        countsByDay[s.dayOfWeek] += 1;
      }
    });

    const weeklyTeaching = dayOrder.map((day) => ({
      day: dayLabels[day],
      fullDay: day,
      sessions: countsByDay[day],
    }));

    // 3. Subjects workload distribution
    const subMap = new Map();
    assignments.forEach((a) => {
      if (a.subject) {
        const id = a.subject.id;
        if (!subMap.has(id)) {
          subMap.set(id, {
            name: a.subject.name,
            code: a.subject.code,
            assignedClasses: 0,
            weeklySessions: 0,
          });
        }
        subMap.get(id).assignedClasses += 1;
      }
    });

    sessions.forEach((s) => {
      if (s.subject && subMap.has(s.subject.id)) {
        subMap.get(s.subject.id).weeklySessions += 1;
      }
    });

    const subjects = Array.from(subMap.values());

    return res.status(200).json({
      success: true,
      data: {
        studentsByClass,
        weeklyTeaching,
        subjects,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// 8. ANALYTICS: STUDENT
// ============================================================
export const getStudentAnalytics = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const userId = req.user.id;

    const student = await prisma.student.findFirst({
      where: { userId, instituteId },
      include: {
        class: true,
        studentEnrollments: {
          where: { status: 'ACTIVE' },
          include: { class: true },
          orderBy: { enrollmentDate: 'desc' },
          take: 1,
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found for this account.',
      });
    }

    const currentClass = student.class || (student.studentEnrollments[0]?.class ?? null);

    if (!currentClass) {
      return res.status(200).json({
        success: true,
        data: {
          weeklySessions: [],
          subjectsDistribution: [],
        },
      });
    }

    const [classSubjects, sessions] = await Promise.all([
      prisma.classSubject.findMany({
        where: { classId: currentClass.id, instituteId },
        include: { subject: true },
      }),
      prisma.timetableSession.findMany({
        where: { classId: currentClass.id, instituteId, isActive: true },
        include: { subject: true },
      }),
    ]);

    // Weekly Sessions by Day
    const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const dayLabels = {
      MONDAY: 'Mon',
      TUESDAY: 'Tue',
      WEDNESDAY: 'Wed',
      THURSDAY: 'Thu',
      FRIDAY: 'Fri',
      SATURDAY: 'Sat',
      SUNDAY: 'Sun',
    };
    const countsByDay = {};
    dayOrder.forEach((d) => { countsByDay[d] = 0; });
    sessions.forEach((s) => {
      if (countsByDay[s.dayOfWeek] !== undefined) {
        countsByDay[s.dayOfWeek] += 1;
      }
    });

    const weeklySessions = dayOrder.map((day) => ({
      day: dayLabels[day],
      fullDay: day,
      sessions: countsByDay[day],
    }));

    // Subjects Distribution (periods count)
    const subMap = new Map();
    classSubjects.forEach((cs) => {
      if (cs.subject) {
        subMap.set(cs.subject.id, {
          name: cs.subject.name,
          code: cs.subject.code,
          periodsCount: 0,
        });
      }
    });

    sessions.forEach((s) => {
      if (s.subject && subMap.has(s.subject.id)) {
        subMap.get(s.subject.id).periodsCount += 1;
      }
    });

    const subjectsDistribution = Array.from(subMap.values());

    return res.status(200).json({
      success: true,
      data: {
        weeklySessions,
        subjectsDistribution,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// 9. ANALYTICS: PARENT
// ============================================================
export const getParentAnalytics = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const userId = req.user.id;
    const { studentId } = req.query;

    const parent = await prisma.parent.findFirst({
      where: { userId, instituteId },
      include: {
        students: {
          include: {
            student: {
              include: {
                class: true,
                studentEnrollments: {
                  where: { status: 'ACTIVE' },
                  include: { class: true },
                },
              },
            },
          },
        },
      },
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent profile not found for this account.',
      });
    }

    if (parent.students.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          childName: null,
          weeklySessions: [],
          subjectsDistribution: [],
        },
      });
    }

    let targetPs = parent.students[0];
    if (studentId) {
      const parsedId = parseInt(studentId, 10);
      const found = parent.students.find((ps) => ps.studentId === parsedId);
      if (!found) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not have permission to view analytics for this student.',
        });
      }
      targetPs = found;
    }

    const student = targetPs.student;
    const currentClass = student.class || (student.studentEnrollments[0]?.class ?? null);

    if (!currentClass) {
      return res.status(200).json({
        success: true,
        data: {
          studentId: student.id,
          childName: student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim(),
          weeklySessions: [],
          subjectsDistribution: [],
        },
      });
    }

    const [classSubjects, sessions] = await Promise.all([
      prisma.classSubject.findMany({
        where: { classId: currentClass.id, instituteId },
        include: { subject: true },
      }),
      prisma.timetableSession.findMany({
        where: { classId: currentClass.id, instituteId, isActive: true },
        include: { subject: true },
      }),
    ]);

    const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const dayLabels = {
      MONDAY: 'Mon',
      TUESDAY: 'Tue',
      WEDNESDAY: 'Wed',
      THURSDAY: 'Thu',
      FRIDAY: 'Fri',
      SATURDAY: 'Sat',
      SUNDAY: 'Sun',
    };
    const countsByDay = {};
    dayOrder.forEach((d) => { countsByDay[d] = 0; });
    sessions.forEach((s) => {
      if (countsByDay[s.dayOfWeek] !== undefined) {
        countsByDay[s.dayOfWeek] += 1;
      }
    });

    const weeklySessions = dayOrder.map((day) => ({
      day: dayLabels[day],
      fullDay: day,
      sessions: countsByDay[day],
    }));

    const subMap = new Map();
    classSubjects.forEach((cs) => {
      if (cs.subject) {
        subMap.set(cs.subject.id, {
          name: cs.subject.name,
          code: cs.subject.code,
          periodsCount: 0,
        });
      }
    });

    sessions.forEach((s) => {
      if (s.subject && subMap.has(s.subject.id)) {
        subMap.get(s.subject.id).periodsCount += 1;
      }
    });

    const subjectsDistribution = Array.from(subMap.values());

    return res.status(200).json({
      success: true,
      data: {
        studentId: student.id,
        childName: student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim(),
        weeklySessions,
        subjectsDistribution,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
