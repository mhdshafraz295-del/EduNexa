import prisma from '../config/prisma.js';

// Valid attendance statuses
const VALID_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

// Helper to normalize date to YYYY-MM-DDT00:00:00.000Z
const normalizeDate = (dateInput) => {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

// =========================================================================
// 1. GET ATTENDANCE SESSIONS (List with filters & calculated statistics)
// =========================================================================
export const getAttendanceSessions = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const {
      academicYearId,
      classId,
      subjectId,
      teacherId,
      startDate,
      endDate,
      timetableSessionId,
    } = req.query;

    const where = {
      instituteId,
      ...(academicYearId ? { academicYearId: parseInt(academicYearId, 10) } : {}),
      ...(classId ? { classId: parseInt(classId, 10) } : {}),
      ...(subjectId ? { subjectId: parseInt(subjectId, 10) } : {}),
      ...(timetableSessionId ? { timetableSessionId: parseInt(timetableSessionId, 10) } : {}),
    };

    // Date range filter
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        const start = normalizeDate(startDate);
        if (start) where.date.gte = start;
      }
      if (endDate) {
        const end = normalizeDate(endDate);
        if (end) {
          end.setUTCHours(23, 59, 59, 999);
          where.date.lte = end;
        }
      }
    }

    // Role-specific filtering
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, instituteId },
      });
      if (!teacher) {
        return res.status(403).json({ success: false, message: 'Teacher profile not found.' });
      }

      // Teacher can only see sessions where they are assigned or created
      const assignments = await prisma.teacherAssignment.findMany({
        where: { teacherId: teacher.id, instituteId },
        select: { classId: true, subjectId: true },
      });
      const classTeacherClasses = await prisma.class.findMany({
        where: { classTeacherId: teacher.id, instituteId },
        select: { id: true },
      });

      const allowedClassIds = [
        ...new Set([
          ...assignments.map((a) => a.classId),
          ...classTeacherClasses.map((c) => c.id),
        ]),
      ];

      where.OR = [
        { teacherId: teacher.id },
        { createdBy: req.user.id },
        { classId: { in: allowedClassIds } },
      ];
    } else if (teacherId) {
      where.teacherId = parseInt(teacherId, 10);
    }

    const sessions = await prisma.attendanceSession.findMany({
      where,
      include: {
        class: { select: { id: true, name: true, section: true } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, name: true, employeeId: true } },
        academicYear: { select: { id: true, name: true, isCurrent: true } },
        timetableSession: {
          select: { id: true, dayOfWeek: true, startTime: true, endTime: true, classType: true },
        },
        createdByUser: { select: { id: true, email: true, username: true, role: true } },
        records: {
          select: {
            id: true,
            status: true,
            remark: true,
            studentId: true,
            student: { select: { id: true, name: true, rollNo: true, admissionNumber: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Compute summary stats for each session
    const formattedSessions = sessions.map((sess) => {
      const totalStudents = sess.records.length;
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let excusedCount = 0;

      for (const rec of sess.records) {
        if (rec.status === 'PRESENT') presentCount++;
        else if (rec.status === 'ABSENT') absentCount++;
        else if (rec.status === 'LATE') lateCount++;
        else if (rec.status === 'EXCUSED') excusedCount++;
      }

      const attendanceRate = totalStudents > 0
        ? Math.round(((presentCount + lateCount) / totalStudents) * 100)
        : 0;

      return {
        ...sess,
        stats: {
          totalStudents,
          presentCount,
          absentCount,
          lateCount,
          excusedCount,
          attendanceRate,
        },
      };
    });

    return res.status(200).json({ success: true, data: formattedSessions });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 2. GET ATTENDANCE SESSION BY ID
// =========================================================================
export const getAttendanceSessionById = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const sessionId = parseInt(req.params.id, 10);

    const session = await prisma.attendanceSession.findFirst({
      where: { id: sessionId, instituteId },
      include: {
        class: { select: { id: true, name: true, section: true } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, name: true, employeeId: true } },
        academicYear: { select: { id: true, name: true, isCurrent: true } },
        timetableSession: {
          select: { id: true, dayOfWeek: true, startTime: true, endTime: true, classType: true },
        },
        createdByUser: { select: { id: true, email: true, username: true, role: true } },
        records: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                rollNo: true,
                admissionNumber: true,
                profilePic: true,
              },
            },
          },
          orderBy: { student: { name: 'asc' } },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Attendance session not found.' });
    }

    // Role check for teacher
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, instituteId },
      });
      if (!teacher) {
        return res.status(403).json({ success: false, message: 'Unauthorized teacher access.' });
      }

      const assignments = await prisma.teacherAssignment.findMany({
        where: { teacherId: teacher.id, instituteId },
        select: { classId: true, subjectId: true },
      });
      const isClassTeacher = await prisma.class.findFirst({
        where: { id: session.classId, classTeacherId: teacher.id, instituteId },
      });

      const hasClassAccess = isClassTeacher || assignments.some((a) => a.classId === session.classId);
      if (session.teacherId !== teacher.id && session.createdBy !== req.user.id && !hasClassAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this attendance session.',
        });
      }
    }

    const totalStudents = session.records.length;
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;

    for (const rec of session.records) {
      if (rec.status === 'PRESENT') presentCount++;
      else if (rec.status === 'ABSENT') absentCount++;
      else if (rec.status === 'LATE') lateCount++;
      else if (rec.status === 'EXCUSED') excusedCount++;
    }

    const attendanceRate = totalStudents > 0
      ? Math.round(((presentCount + lateCount) / totalStudents) * 100)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        ...session,
        stats: {
          totalStudents,
          presentCount,
          absentCount,
          lateCount,
          excusedCount,
          attendanceRate,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 3. GET STUDENTS FOR MARKING (Enrolled students list + existing session if any)
// =========================================================================
export const getStudentsForMarking = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { classId, academicYearId, subjectId, date, timetableSessionId } = req.query;

    if (!classId) {
      return res.status(400).json({ success: false, message: 'Class ID is required.' });
    }

    const parsedClassId = parseInt(classId, 10);
    const parsedYearId = academicYearId ? parseInt(academicYearId, 10) : null;
    const parsedSubjectId = subjectId ? parseInt(subjectId, 10) : null;
    const parsedTtId = timetableSessionId ? parseInt(timetableSessionId, 10) : null;

    // Verify class belongs to institute
    const targetClass = await prisma.class.findFirst({
      where: { id: parsedClassId, instituteId },
      include: { academicYear: true },
    });

    if (!targetClass) {
      return res.status(404).json({ success: false, message: 'Class not found in this institute.' });
    }

    // Role check for teacher
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, instituteId },
      });
      if (!teacher) {
        return res.status(403).json({ success: false, message: 'Teacher profile not found.' });
      }

      const isClassTeacher = targetClass.classTeacherId === teacher.id;
      const isAssigned = await prisma.teacherAssignment.findFirst({
        where: {
          instituteId,
          classId: parsedClassId,
          teacherId: teacher.id,
          ...(parsedSubjectId ? { subjectId: parsedSubjectId } : {}),
        },
      });

      if (!isClassTeacher && !isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to mark attendance for this class or subject.',
        });
      }
    }

    // 1. Fetch Enrolled Active Students
    const enrollmentsWhere = {
      instituteId,
      classId: parsedClassId,
      status: 'ACTIVE',
    };
    if (parsedYearId) {
      enrollmentsWhere.academicYearId = parsedYearId;
    }

    let enrollments = await prisma.studentEnrollment.findMany({
      where: enrollmentsWhere,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            rollNo: true,
            admissionNumber: true,
            profilePic: true,
            phone: true,
          },
        },
      },
      orderBy: { student: { name: 'asc' } },
    });

    // Fallback: If no enrollments exist for this year, check direct classId on Student
    if (enrollments.length === 0) {
      const directStudents = await prisma.student.findMany({
        where: { classId: parsedClassId, instituteId },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          rollNo: true,
          admissionNumber: true,
          profilePic: true,
          phone: true,
        },
        orderBy: { name: 'asc' },
      });

      enrollments = directStudents.map((st) => ({
        id: null,
        studentId: st.id,
        rollNo: st.rollNo || st.admissionNumber,
        student: st,
      }));
    }

    // 2. Check if an Attendance Session already exists on the specified date
    let existingSession = null;
    if (date) {
      const targetDate = normalizeDate(date);
      if (targetDate) {
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);

        existingSession = await prisma.attendanceSession.findFirst({
          where: {
            instituteId,
            classId: parsedClassId,
            ...(parsedSubjectId ? { subjectId: parsedSubjectId } : {}),
            ...(parsedTtId ? { timetableSessionId: parsedTtId } : {}),
            date: {
              gte: targetDate,
              lt: nextDay,
            },
          },
          include: {
            records: true,
            teacher: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true } },
          },
        });
      }
    }

    // Map student records with either existing status or default PRESENT
    const studentRecords = enrollments.map((enr) => {
      const st = enr.student;
      const existingRec = existingSession?.records?.find((r) => r.studentId === st.id);

      return {
        studentId: st.id,
        name: st.name || `${st.firstName || ''} ${st.lastName || ''}`.trim() || 'Student',
        rollNo: enr.rollNo || st.rollNo || st.admissionNumber || 'N/A',
        admissionNumber: st.admissionNumber || st.rollNo || 'N/A',
        profilePic: st.profilePic || null,
        phone: st.phone || null,
        status: existingRec ? existingRec.status : 'PRESENT',
        remark: existingRec ? existingRec.remark || '' : '',
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        class: targetClass,
        isExistingSession: Boolean(existingSession),
        existingSessionId: existingSession?.id || null,
        existingNotes: existingSession?.notes || '',
        students: studentRecords,
        totalStudents: studentRecords.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 4. SAVE / CREATE ATTENDANCE SESSION (Batch creation with records)
// =========================================================================
export const saveAttendanceSession = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const userId = req.user.id;
    const {
      classId,
      subjectId,
      teacherId,
      academicYearId,
      date,
      timetableSessionId,
      notes,
      records,
    } = req.body;

    if (!classId || !date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Class ID, Date, and student records are required.',
      });
    }

    const parsedClassId = parseInt(classId, 10);
    const sessionDate = normalizeDate(date);
    if (!sessionDate) {
      return res.status(400).json({ success: false, message: 'Invalid attendance date.' });
    }

    // Verify class belongs to institute
    const targetClass = await prisma.class.findFirst({
      where: { id: parsedClassId, instituteId },
    });
    if (!targetClass) {
      return res.status(404).json({ success: false, message: 'Class not found in this institute.' });
    }

    // Determine teacherId and enforce role guard
    let effectiveTeacherId = teacherId ? parseInt(teacherId, 10) : null;

    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId, instituteId },
      });
      if (!teacher) {
        return res.status(403).json({ success: false, message: 'Teacher profile not found.' });
      }

      effectiveTeacherId = teacher.id;

      // Verify assignment
      const isClassTeacher = targetClass.classTeacherId === teacher.id;
      const isAssigned = await prisma.teacherAssignment.findFirst({
        where: {
          instituteId,
          classId: parsedClassId,
          teacherId: teacher.id,
          ...(subjectId ? { subjectId: parseInt(subjectId, 10) } : {}),
        },
      });

      if (!isClassTeacher && !isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to mark attendance for this class.',
        });
      }
    }

    // Determine academicYearId
    let effectiveYearId = academicYearId ? parseInt(academicYearId, 10) : targetClass.academicYearId;
    if (!effectiveYearId) {
      const currentYear = await prisma.academicYear.findFirst({
        where: { instituteId, isCurrent: true },
      });
      effectiveYearId = currentYear?.id || null;
    }

    const parsedSubjectId = subjectId ? parseInt(subjectId, 10) : null;
    const parsedTtId = timetableSessionId ? parseInt(timetableSessionId, 10) : null;

    // Validate records status
    for (const r of records) {
      if (!r.studentId || !VALID_STATUSES.includes(r.status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid student record or status '${r.status}'. Allowed: ${VALID_STATUSES.join(', ')}`,
        });
      }
    }

    // Perform Upsert of AttendanceSession and AttendanceRecords in a Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Check for existing session on same class, subject, date, timetable slot
      const nextDay = new Date(sessionDate);
      nextDay.setDate(nextDay.getDate() + 1);

      let session = await tx.attendanceSession.findFirst({
        where: {
          instituteId,
          classId: parsedClassId,
          subjectId: parsedSubjectId,
          timetableSessionId: parsedTtId,
          date: {
            gte: sessionDate,
            lt: nextDay,
          },
        },
      });

      if (session) {
        // Update existing session
        session = await tx.attendanceSession.update({
          where: { id: session.id },
          data: {
            teacherId: effectiveTeacherId,
            academicYearId: effectiveYearId,
            notes: notes || session.notes,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new session
        session = await tx.attendanceSession.create({
          data: {
            instituteId,
            classId: parsedClassId,
            subjectId: parsedSubjectId,
            teacherId: effectiveTeacherId,
            academicYearId: effectiveYearId,
            timetableSessionId: parsedTtId,
            date: sessionDate,
            notes: notes || null,
            createdBy: userId,
          },
        });
      }

      // Upsert student attendance records
      for (const rec of records) {
        await tx.attendanceRecord.upsert({
          where: {
            attendanceSessionId_studentId: {
              attendanceSessionId: session.id,
              studentId: parseInt(rec.studentId, 10),
            },
          },
          update: {
            status: rec.status,
            remark: rec.remark || null,
            updatedAt: new Date(),
          },
          create: {
            attendanceSessionId: session.id,
            studentId: parseInt(rec.studentId, 10),
            status: rec.status,
            remark: rec.remark || null,
          },
        });
      }

      return session;
    });

    return res.status(200).json({
      success: true,
      message: `Attendance saved successfully for ${records.length} students.`,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 5. UPDATE ATTENDANCE SESSION
// =========================================================================
export const updateAttendanceSession = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const sessionId = parseInt(req.params.id, 10);
    const { notes, records } = req.body;

    const existingSession = await prisma.attendanceSession.findFirst({
      where: { id: sessionId, instituteId },
    });

    if (!existingSession) {
      return res.status(404).json({ success: false, message: 'Attendance session not found.' });
    }

    // Role check for teacher
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, instituteId },
      });
      if (existingSession.teacherId !== teacher?.id && existingSession.createdBy !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only edit attendance sessions you conducted.',
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      if (notes !== undefined) {
        await tx.attendanceSession.update({
          where: { id: sessionId },
          data: { notes, updatedAt: new Date() },
        });
      }

      if (Array.isArray(records)) {
        for (const rec of records) {
          if (rec.studentId && VALID_STATUSES.includes(rec.status)) {
            await tx.attendanceRecord.upsert({
              where: {
                attendanceSessionId_studentId: {
                  attendanceSessionId: sessionId,
                  studentId: parseInt(rec.studentId, 10),
                },
              },
              update: {
                status: rec.status,
                remark: rec.remark || null,
                updatedAt: new Date(),
              },
              create: {
                attendanceSessionId: sessionId,
                studentId: parseInt(rec.studentId, 10),
                status: rec.status,
                remark: rec.remark || null,
              },
            });
          }
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Attendance session updated successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 6. DELETE ATTENDANCE SESSION
// =========================================================================
export const deleteAttendanceSession = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const sessionId = parseInt(req.params.id, 10);

    const session = await prisma.attendanceSession.findFirst({
      where: { id: sessionId, instituteId },
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Attendance session not found.' });
    }

    // Role check: Only Admin or the creator teacher can delete
    if (req.user.role === 'TEACHER' && session.createdBy !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete attendance sessions you created.',
      });
    }

    await prisma.attendanceSession.delete({
      where: { id: sessionId },
    });

    return res.status(200).json({
      success: true,
      message: 'Attendance session deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 7. GET ATTENDANCE REAL ANALYTICS
// =========================================================================
export const getAttendanceAnalytics = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { classId, academicYearId } = req.query;

    const sessionWhere = {
      instituteId,
      ...(academicYearId ? { academicYearId: parseInt(academicYearId, 10) } : {}),
      ...(classId ? { classId: parseInt(classId, 10) } : {}),
    };

    // Role check for teacher
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, instituteId },
      });
      if (teacher) {
        const assignments = await prisma.teacherAssignment.findMany({
          where: { teacherId: teacher.id, instituteId },
          select: { classId: true },
        });
        const classIds = assignments.map((a) => a.classId);
        sessionWhere.OR = [
          { teacherId: teacher.id },
          { classId: { in: classIds } },
        ];
      }
    }

    const [totalSessions, allRecords, classesList] = await Promise.all([
      prisma.attendanceSession.count({ where: sessionWhere }),
      prisma.attendanceRecord.findMany({
        where: {
          attendanceSession: sessionWhere,
        },
        select: {
          status: true,
          attendanceSession: {
            select: { date: true, classId: true, class: { select: { name: true, section: true } } },
          },
        },
      }),
      prisma.class.findMany({
        where: { instituteId },
        select: { id: true, name: true, section: true },
      }),
    ]);

    // Calculate Status Breakdown
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    // Monthly Trend map (e.g. "Jan", "Feb", etc.)
    const monthlyMap = {};
    const classRateMap = {};

    for (const rec of allRecords) {
      if (rec.status === 'PRESENT') present++;
      else if (rec.status === 'ABSENT') absent++;
      else if (rec.status === 'LATE') late++;
      else if (rec.status === 'EXCUSED') excused++;

      const dateObj = new Date(rec.attendanceSession.date);
      const monthKey = dateObj.toLocaleString('en-US', { month: 'short' });
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { month: monthKey, total: 0, attended: 0 };
      }
      monthlyMap[monthKey].total++;
      if (rec.status === 'PRESENT' || rec.status === 'LATE') {
        monthlyMap[monthKey].attended++;
      }

      // Class rate map
      const cId = rec.attendanceSession.classId;
      const cName = rec.attendanceSession.class
        ? `${rec.attendanceSession.class.name} ${rec.attendanceSession.class.section ? `(${rec.attendanceSession.class.section})` : ''}`.trim()
        : `Class ${cId}`;

      if (!classRateMap[cId]) {
        classRateMap[cId] = { className: cName, total: 0, attended: 0 };
      }
      classRateMap[cId].total++;
      if (rec.status === 'PRESENT' || rec.status === 'LATE') {
        classRateMap[cId].attended++;
      }
    }

    const totalRecords = allRecords.length;
    const overallRate = totalRecords > 0
      ? Math.round(((present + late) / totalRecords) * 100)
      : 0;

    const statusDistribution = [
      { name: 'Present', value: present, fill: '#10B981' },
      { name: 'Late', value: late, fill: '#FFD978' },
      { name: 'Excused', value: excused, fill: '#3B82F6' },
      { name: 'Absent', value: absent, fill: '#EF4444' },
    ].filter((item) => item.value > 0);

    const monthlyTrends = Object.values(monthlyMap).map((m) => ({
      month: m.month,
      rate: m.total > 0 ? Math.round((m.attended / m.total) * 100) : 0,
      totalMarked: m.total,
    }));

    const classAttendanceRates = Object.values(classRateMap).map((c) => ({
      className: c.className,
      rate: c.total > 0 ? Math.round((c.attended / c.total) * 100) : 0,
      totalMarked: c.total,
    }));

    return res.status(200).json({
      success: true,
      data: {
        totalSessions,
        totalRecords,
        overallRate,
        counts: {
          present,
          absent,
          late,
          excused,
        },
        statusDistribution,
        monthlyTrends,
        classAttendanceRates,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 8. GET STUDENT PORTAL ATTENDANCE (For logged-in Student)
// =========================================================================
export const getStudentAttendanceHistory = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const userId = req.user.id;

    const student = await prisma.student.findFirst({
      where: { userId, instituteId },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const records = await prisma.attendanceRecord.findMany({
      where: {
        studentId: student.id,
        attendanceSession: { instituteId },
      },
      include: {
        attendanceSession: {
          include: {
            class: { select: { name: true, section: true } },
            subject: { select: { name: true, code: true } },
            teacher: { select: { name: true } },
          },
        },
      },
      orderBy: { attendanceSession: { date: 'desc' } },
    });

    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    const formattedRecords = records.map((r) => {
      if (r.status === 'PRESENT') present++;
      else if (r.status === 'ABSENT') absent++;
      else if (r.status === 'LATE') late++;
      else if (r.status === 'EXCUSED') excused++;

      return {
        id: r.id,
        date: r.attendanceSession.date,
        status: r.status,
        remark: r.remark,
        subject: r.attendanceSession.subject?.name || 'General Class',
        teacher: r.attendanceSession.teacher?.name || 'Class Teacher',
        className: r.attendanceSession.class?.name || '',
      };
    });

    const total = records.length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return res.status(200).json({
      success: true,
      data: {
        student: { id: student.id, name: student.name },
        totalClassesHeld: total,
        attendanceRate: rate,
        counts: { present, absent, late, excused },
        records: formattedRecords,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 9. GET PARENT PORTAL CHILD ATTENDANCE (For logged-in Parent)
// =========================================================================
export const getParentChildAttendance = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const userId = req.user.id;
    const { studentId } = req.query;

    const parent = await prisma.parent.findFirst({
      where: { userId, instituteId },
      include: { students: { include: { student: true } } },
    });

    if (!parent || parent.students.length === 0) {
      return res.status(404).json({ success: false, message: 'No linked children found.' });
    }

    // Determine target child
    let targetChild = parent.students[0].student;
    if (studentId) {
      const sid = parseInt(studentId, 10);
      const isLinked = parent.students.some((ps) => ps.studentId === sid);
      if (!isLinked) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You can only view attendance for your linked children.',
        });
      }
      targetChild = parent.students.find((ps) => ps.studentId === sid).student;
    }

    const records = await prisma.attendanceRecord.findMany({
      where: {
        studentId: targetChild.id,
        attendanceSession: { instituteId },
      },
      include: {
        attendanceSession: {
          include: {
            class: { select: { name: true, section: true } },
            subject: { select: { name: true, code: true } },
            teacher: { select: { name: true } },
          },
        },
      },
      orderBy: { attendanceSession: { date: 'desc' } },
    });

    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    const formattedRecords = records.map((r) => {
      if (r.status === 'PRESENT') present++;
      else if (r.status === 'ABSENT') absent++;
      else if (r.status === 'LATE') late++;
      else if (r.status === 'EXCUSED') excused++;

      return {
        id: r.id,
        date: r.attendanceSession.date,
        status: r.status,
        remark: r.remark,
        subject: r.attendanceSession.subject?.name || 'General Class',
        teacher: r.attendanceSession.teacher?.name || 'Class Teacher',
        className: r.attendanceSession.class?.name || '',
      };
    });

    const total = records.length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return res.status(200).json({
      success: true,
      data: {
        child: { id: targetChild.id, name: targetChild.name },
        totalClassesHeld: total,
        attendanceRate: rate,
        counts: { present, absent, late, excused },
        records: formattedRecords,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
