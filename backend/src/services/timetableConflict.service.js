import prisma from '../config/prisma.js';

/**
 * Converts a time string "HH:MM" or "H:MM" to minutes from midnight
 */
export const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.trim().split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

/**
 * Determines if two time windows overlap
 */
export const isTimeOverlap = (startA, endA, startB, endB) => {
  const aStart = typeof startA === 'number' ? startA : timeToMinutes(startA);
  const aEnd = typeof endA === 'number' ? endA : timeToMinutes(endA);
  const bStart = typeof startB === 'number' ? startB : timeToMinutes(startB);
  const bEnd = typeof endB === 'number' ? endB : timeToMinutes(endB);

  return aStart < bEnd && aEnd > bStart;
};

/**
 * Validates timetable sessions for class or teacher conflicts within the authenticated institute
 *
 * @param {Object} params
 * @param {number} params.instituteId - Authenticated Institute ID (Strict Tenant Isolation)
 * @param {number} [params.academicYearId] - Academic Year ID
 * @param {number} params.classId - Target Class ID
 * @param {number} [params.teacherId] - Assigned Teacher ID (optional)
 * @param {string} params.dayOfWeek - MONDAY, TUESDAY, etc.
 * @param {string} params.startTime - "HH:MM"
 * @param {string} params.endTime - "HH:MM"
 * @param {number} [params.excludeSessionId] - Session ID to exclude for updates
 * @returns {Promise<{ hasConflict: boolean, conflictType?: string, message?: string }>}
 */
export const checkTimetableConflicts = async ({
  instituteId,
  academicYearId,
  classId,
  teacherId,
  dayOfWeek,
  startTime,
  endTime,
  excludeSessionId,
}) => {
  const newStartMin = timeToMinutes(startTime);
  const newEndMin = timeToMinutes(endTime);

  if (newStartMin >= newEndMin) {
    return {
      hasConflict: true,
      conflictType: 'INVALID_TIME',
      message: 'Start time must be before end time.',
    };
  }

  // 1. Check Class Schedule Overlap (Strictly Scoped to instituteId)
  const classSessions = await prisma.timetableSession.findMany({
    where: {
      instituteId,
      classId,
      dayOfWeek,
      isActive: true,
      ...(academicYearId ? { academicYearId } : {}),
      ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
    },
    include: {
      subject: true,
    },
  });

  for (const session of classSessions) {
    if (isTimeOverlap(newStartMin, newEndMin, session.startTime, session.endTime)) {
      return {
        hasConflict: true,
        conflictType: 'CLASS',
        message: `This class already has another timetable session during this time (${session.subject?.name || 'Class'} at ${session.startTime} - ${session.endTime}).`,
      };
    }
  }

  // 2. Check Teacher Schedule Overlap (Strictly Scoped to instituteId)
  if (teacherId) {
    const teacherSessions = await prisma.timetableSession.findMany({
      where: {
        instituteId,
        teacherId,
        dayOfWeek,
        isActive: true,
        ...(academicYearId ? { academicYearId } : {}),
        ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
      },
      include: {
        class: true,
        subject: true,
      },
    });

    for (const session of teacherSessions) {
      if (isTimeOverlap(newStartMin, newEndMin, session.startTime, session.endTime)) {
        return {
          hasConflict: true,
          conflictType: 'TEACHER',
          message: `Teacher already has another class during this time (${session.class?.name || 'Class'} - ${session.subject?.name || 'Subject'} at ${session.startTime} - ${session.endTime}).`,
        };
      }
    }
  }

  return { hasConflict: false };
};
