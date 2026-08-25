import prisma from '../config/prisma.js';
import { checkTimetableConflicts, timeToMinutes } from '../services/timetableConflict.service.js';

const DAYS_MAP = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

// ==========================================
// TIMETABLE CONTROLLER
// ==========================================

export const getTimetable = async (req, res) => {
  try {
    const { classId, teacherId, academicYearId, dayOfWeek } = req.query;

    const whereClause = {
      instituteId: req.instituteId,
      isActive: true,
      ...(academicYearId ? { academicYearId: parseInt(academicYearId, 10) } : {}),
      ...(dayOfWeek ? { dayOfWeek: dayOfWeek.toUpperCase() } : {}),
    };

    // Role-specific enforcement
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, instituteId: req.instituteId },
      });
      if (teacher) {
        whereClause.teacherId = teacher.id;
      }
    } else if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: { userId: req.user.id, instituteId: req.instituteId },
      });
      if (student && student.classId) {
        whereClause.classId = student.classId;
      }
    } else if (req.user.role === 'PARENT') {
      const parent = await prisma.parent.findFirst({
        where: { userId: req.user.id, instituteId: req.instituteId },
        include: { students: { include: { student: true } } },
      });
      if (parent && parent.students.length > 0) {
        const studentClassIds = parent.students
          .map((ps) => ps.student?.classId)
          .filter(Boolean);
        whereClause.classId = { in: studentClassIds };
      }
    } else {
      // Admin query filters
      if (classId) whereClause.classId = parseInt(classId, 10);
      if (teacherId) whereClause.teacherId = parseInt(teacherId, 10);
    }

    const sessions = await prisma.timetableSession.findMany({
      where: whereClause,
      include: {
        class: true,
        subject: true,
        teacher: true,
        academicYear: true,
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    // If plan does not include ZOOM_CLASSES feature, sanitize meeting links
    const hasZoomFeature = req.entitlement?.features?.ZOOM_CLASSES || req.user.role === 'SUPER_ADMIN';
    const sanitizedSessions = sessions.map((s) => {
      if (!hasZoomFeature) {
        return { ...s, meetingUrl: null, meetingId: null, meetingPassword: null };
      }
      return s;
    });

    return res.status(200).json({ success: true, data: sanitizedSessions });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createTimetableSession = async (req, res) => {
  try {
    const {
      academicYearId,
      classId,
      subjectId,
      teacherId,
      dayOfWeek,
      startTime,
      endTime,
      classType,
      room,
      meetingUrl,
      meetingId,
      meetingPassword,
      notes,
    } = req.body;

    if (!classId || !subjectId || !dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Class, Subject, Day of Week, Start Time, and End Time are required.',
      });
    }

    const upperDay = dayOfWeek.trim().toUpperCase();
    if (!DAYS_MAP.includes(upperDay)) {
      return res.status(400).json({
        success: false,
        message: `Invalid day of week: ${dayOfWeek}. Must be one of: ${DAYS_MAP.join(', ')}`,
      });
    }

    // Validate HTTPS protocol for meeting URL if provided
    if (meetingUrl) {
      const url = meetingUrl.trim();
      if (!url.startsWith('https://')) {
        return res.status(400).json({
          success: false,
          message: 'Online class link must be a secure HTTPS URL (e.g. https://zoom.us/j/... or https://meet.google.com/...).',
        });
      }

      // Feature Check: ZOOM_CLASSES
      const hasZoomFeature = req.entitlement?.features?.ZOOM_CLASSES || req.user.role === 'SUPER_ADMIN';
      if (!hasZoomFeature) {
        return res.status(403).json({
          success: false,
          code: 'FEATURE_NOT_INCLUDED',
          message: 'Online Class Links (Zoom/Meet) are not included in your current subscription plan.',
        });
      }
    }

    // Verify all referenced foreign entities belong strictly to req.instituteId
    const [cls, sub] = await Promise.all([
      prisma.class.findFirst({ where: { id: parseInt(classId, 10), instituteId: req.instituteId } }),
      prisma.subject.findFirst({ where: { id: parseInt(subjectId, 10), instituteId: req.instituteId } }),
    ]);

    if (!cls || !sub) {
      return res.status(404).json({
        success: false,
        message: 'Class or Subject not found in your institute.',
      });
    }

    let validTeacherId = teacherId ? parseInt(teacherId, 10) : null;
    if (validTeacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: { id: validTeacherId, instituteId: req.instituteId },
      });
      if (!teacher) {
        return res.status(404).json({ success: false, message: 'Teacher not found in your institute.' });
      }
    }

    let validYearId = academicYearId ? parseInt(academicYearId, 10) : null;
    if (validYearId) {
      const year = await prisma.academicYear.findFirst({
        where: { id: validYearId, instituteId: req.instituteId },
      });
      if (!year) {
        return res.status(404).json({ success: false, message: 'Academic Year not found in your institute.' });
      }
    } else {
      const currentYear = await prisma.academicYear.findFirst({
        where: { instituteId: req.instituteId, isCurrent: true },
      });
      if (currentYear) validYearId = currentYear.id;
    }

    // Conflict Detection (Scoped strictly to req.instituteId)
    const conflictResult = await checkTimetableConflicts({
      instituteId: req.instituteId,
      academicYearId: validYearId,
      classId: parseInt(classId, 10),
      teacherId: validTeacherId,
      dayOfWeek: upperDay,
      startTime: startTime.trim(),
      endTime: endTime.trim(),
    });

    if (conflictResult.hasConflict) {
      return res.status(409).json({
        success: false,
        code: 'TIMETABLE_CONFLICT',
        conflictType: conflictResult.conflictType,
        message: conflictResult.message,
      });
    }

    const session = await prisma.timetableSession.create({
      data: {
        instituteId: req.instituteId,
        academicYearId: validYearId,
        classId: parseInt(classId, 10),
        subjectId: parseInt(subjectId, 10),
        teacherId: validTeacherId,
        dayOfWeek: upperDay,
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        classType: classType || (meetingUrl ? 'ONLINE' : 'PHYSICAL'),
        room: room || null,
        meetingUrl: meetingUrl ? meetingUrl.trim() : null,
        meetingId: meetingId ? meetingId.trim() : null,
        meetingPassword: meetingPassword ? meetingPassword.trim() : null,
        notes: notes || null,
        isActive: true,
      },
      include: {
        class: true,
        subject: true,
        teacher: true,
        academicYear: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Timetable session created successfully.',
      data: session,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTimetableSession = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      academicYearId,
      classId,
      subjectId,
      teacherId,
      dayOfWeek,
      startTime,
      endTime,
      classType,
      room,
      meetingUrl,
      meetingId,
      meetingPassword,
      notes,
      isActive,
    } = req.body;

    const existing = await prisma.timetableSession.findFirst({
      where: { id, instituteId: req.instituteId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Timetable session not found in your institute.' });
    }

    if (meetingUrl) {
      if (!meetingUrl.trim().startsWith('https://')) {
        return res.status(400).json({ success: false, message: 'Meeting URL must begin with https://' });
      }

      const hasZoomFeature = req.entitlement?.features?.ZOOM_CLASSES || req.user.role === 'SUPER_ADMIN';
      if (!hasZoomFeature) {
        return res.status(403).json({
          success: false,
          code: 'FEATURE_NOT_INCLUDED',
          message: 'Online Class Links are not included in your current subscription plan.',
        });
      }
    }

    const targetClassId = classId ? parseInt(classId, 10) : existing.classId;
    const targetTeacherId = teacherId !== undefined ? (teacherId ? parseInt(teacherId, 10) : null) : existing.teacherId;
    const targetDay = dayOfWeek ? dayOfWeek.trim().toUpperCase() : existing.dayOfWeek;
    const targetStart = startTime ? startTime.trim() : existing.startTime;
    const targetEnd = endTime ? endTime.trim() : existing.endTime;
    const targetYearId = academicYearId !== undefined ? (academicYearId ? parseInt(academicYearId, 10) : null) : existing.academicYearId;

    // Check conflicts excluding this session
    const conflictResult = await checkTimetableConflicts({
      instituteId: req.instituteId,
      academicYearId: targetYearId,
      classId: targetClassId,
      teacherId: targetTeacherId,
      dayOfWeek: targetDay,
      startTime: targetStart,
      endTime: targetEnd,
      excludeSessionId: id,
    });

    if (conflictResult.hasConflict) {
      return res.status(409).json({
        success: false,
        code: 'TIMETABLE_CONFLICT',
        conflictType: conflictResult.conflictType,
        message: conflictResult.message,
      });
    }

    const updated = await prisma.timetableSession.update({
      where: { id },
      data: {
        academicYearId: targetYearId,
        classId: targetClassId,
        subjectId: subjectId ? parseInt(subjectId, 10) : undefined,
        teacherId: targetTeacherId,
        dayOfWeek: targetDay,
        startTime: targetStart,
        endTime: targetEnd,
        classType: classType || undefined,
        room: room !== undefined ? room : undefined,
        meetingUrl: meetingUrl !== undefined ? (meetingUrl ? meetingUrl.trim() : null) : undefined,
        meetingId: meetingId !== undefined ? (meetingId ? meetingId.trim() : null) : undefined,
        meetingPassword: meetingPassword !== undefined ? (meetingPassword ? meetingPassword.trim() : null) : undefined,
        notes: notes !== undefined ? notes : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
      include: {
        class: true,
        subject: true,
        teacher: true,
        academicYear: true,
      },
    });

    return res.status(200).json({ success: true, message: 'Timetable session updated.', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTimetableSession = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const session = await prisma.timetableSession.findFirst({
      where: { id, instituteId: req.instituteId },
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Timetable session not found in your institute.' });
    }

    await prisma.timetableSession.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Timetable session deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// TODAY'S SESSIONS (ROLE-TAILORED)
// ==========================================

export const getTodaySessions = async (req, res) => {
  try {
    const now = new Date();
    const todayDayOfWeek = DAYS_MAP[now.getDay()]; // e.g. "MONDAY"

    const whereClause = {
      instituteId: req.instituteId,
      dayOfWeek: todayDayOfWeek,
      isActive: true,
    };

    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, instituteId: req.instituteId },
      });
      if (!teacher) {
        return res.status(200).json({ success: true, data: [], day: todayDayOfWeek });
      }
      whereClause.teacherId = teacher.id;
    } else if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: { userId: req.user.id, instituteId: req.instituteId },
      });
      if (!student || !student.classId) {
        return res.status(200).json({ success: true, data: [], day: todayDayOfWeek });
      }
      whereClause.classId = student.classId;
    } else if (req.user.role === 'PARENT') {
      const parent = await prisma.parent.findFirst({
        where: { userId: req.user.id, instituteId: req.instituteId },
        include: { students: { include: { student: true } } },
      });
      const classIds = parent?.students.map((ps) => ps.student?.classId).filter(Boolean) || [];
      if (classIds.length === 0) {
        return res.status(200).json({ success: true, data: [], day: todayDayOfWeek });
      }
      whereClause.classId = { in: classIds };
    }

    const sessions = await prisma.timetableSession.findMany({
      where: whereClause,
      include: {
        class: true,
        subject: true,
        teacher: true,
      },
      orderBy: { startTime: 'asc' },
    });

    const hasZoomFeature = req.entitlement?.features?.ZOOM_CLASSES || req.user.role === 'SUPER_ADMIN';
    const sanitized = sessions.map((s) => {
      if (!hasZoomFeature) {
        return { ...s, meetingUrl: null, meetingId: null, meetingPassword: null };
      }
      return s;
    });

    return res.status(200).json({
      success: true,
      day: todayDayOfWeek,
      date: now.toISOString(),
      count: sanitized.length,
      data: sanitized,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUpcomingSessions = async (req, res) => {
  try {
    const now = new Date();
    const currentDay = DAYS_MAP[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const todayRes = await prisma.timetableSession.findMany({
      where: {
        instituteId: req.instituteId,
        dayOfWeek: currentDay,
        isActive: true,
      },
      include: { class: true, subject: true, teacher: true },
      orderBy: { startTime: 'asc' },
    });

    const upcoming = todayRes.filter((s) => timeToMinutes(s.startTime) >= currentMinutes);

    return res.status(200).json({
      success: true,
      currentMinutes,
      data: upcoming,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
