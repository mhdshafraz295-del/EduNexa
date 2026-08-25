import prisma from '../config/prisma.js';

// ==========================================
// 1. ACADEMIC YEARS
// ==========================================

export const getAcademicYears = async (req, res) => {
  try {
    const years = await prisma.academicYear.findMany({
      where: { instituteId: req.instituteId },
      include: {
        _count: {
          select: {
            classes: true,
            studentEnrollments: true,
            teacherAssignments: true,
            timetableSessions: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
    return res.status(200).json({ success: true, data: years });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createAcademicYear = async (req, res) => {
  try {
    const { name, startDate, endDate, isCurrent, status } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Name, start date, and end date are required.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return res.status(400).json({ success: false, message: 'Start date must be before end date.' });
    }

    // Check unique name for institute
    const existing = await prisma.academicYear.findUnique({
      where: {
        instituteId_name: {
          instituteId: req.instituteId,
          name: name.trim(),
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Academic Year '${name}' already exists in your institute.`,
      });
    }

    // If marked as current, unset existing current years
    if (isCurrent) {
      await prisma.academicYear.updateMany({
        where: { instituteId: req.instituteId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    const academicYear = await prisma.academicYear.create({
      data: {
        instituteId: req.instituteId,
        name: name.trim(),
        startDate: start,
        endDate: end,
        isCurrent: Boolean(isCurrent),
        status: status || 'ACTIVE',
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Academic Year created successfully.',
      data: academicYear,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAcademicYear = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, startDate, endDate, isCurrent, status } = req.body;

    const existing = await prisma.academicYear.findFirst({
      where: { id, instituteId: req.instituteId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Academic Year not found in your institute.' });
    }

    if (isCurrent) {
      await prisma.academicYear.updateMany({
        where: { instituteId: req.instituteId, isCurrent: true, id: { not: id } },
        data: { isCurrent: false },
      });
    }

    const updated = await prisma.academicYear.update({
      where: { id },
      data: {
        name: name ? name.trim() : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        isCurrent: isCurrent !== undefined ? Boolean(isCurrent) : undefined,
        status: status || undefined,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Academic Year updated successfully.',
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const setCurrentAcademicYear = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const year = await prisma.academicYear.findFirst({
      where: { id, instituteId: req.instituteId },
    });

    if (!year) {
      return res.status(404).json({ success: false, message: 'Academic Year not found in your institute.' });
    }

    await prisma.$transaction([
      prisma.academicYear.updateMany({
        where: { instituteId: req.instituteId },
        data: { isCurrent: false },
      }),
      prisma.academicYear.update({
        where: { id },
        data: { isCurrent: true, status: 'ACTIVE' },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: `'${year.name}' is now set as the Current Academic Year.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleAcademicYearStatus = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;

    const year = await prisma.academicYear.findFirst({
      where: { id, instituteId: req.instituteId },
    });

    if (!year) {
      return res.status(404).json({ success: false, message: 'Academic Year not found in your institute.' });
    }

    const updated = await prisma.academicYear.update({
      where: { id },
      data: { status },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 2. ACADEMIC LEVELS / GRADES
// ==========================================

export const getAcademicLevels = async (req, res) => {
  try {
    const levels = await prisma.academicLevel.findMany({
      where: { instituteId: req.instituteId },
      include: {
        _count: { select: { classes: true } },
      },
      orderBy: { displayOrder: 'asc' },
    });
    return res.status(200).json({ success: true, data: levels });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createAcademicLevel = async (req, res) => {
  try {
    const { name, code, description, displayOrder, isActive } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Level name and code are required.' });
    }

    const existing = await prisma.academicLevel.findUnique({
      where: {
        instituteId_code: {
          instituteId: req.instituteId,
          code: code.trim().toUpperCase(),
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Academic Level with code '${code}' already exists in your institute.`,
      });
    }

    const level = await prisma.academicLevel.create({
      data: {
        instituteId: req.instituteId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description || null,
        displayOrder: displayOrder ? parseInt(displayOrder, 10) : 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Academic Level created successfully.',
      data: level,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAcademicLevel = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, code, description, displayOrder, isActive } = req.body;

    const existing = await prisma.academicLevel.findFirst({
      where: { id, instituteId: req.instituteId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Academic Level not found in your institute.' });
    }

    const updated = await prisma.academicLevel.update({
      where: { id },
      data: {
        name: name ? name.trim() : undefined,
        code: code ? code.trim().toUpperCase() : undefined,
        description: description !== undefined ? description : undefined,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder, 10) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    return res.status(200).json({ success: true, message: 'Academic Level updated.', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAcademicLevel = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.academicLevel.findFirst({
      where: { id, instituteId: req.instituteId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Academic Level not found in your institute.' });
    }

    await prisma.academicLevel.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Academic Level deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 3. CLASSES / BATCHES
// ==========================================

export const getClasses = async (req, res) => {
  try {
    const { academicYearId, academicLevelId } = req.query;

    const classes = await prisma.class.findMany({
      where: {
        instituteId: req.instituteId,
        ...(academicYearId ? { academicYearId: parseInt(academicYearId, 10) } : {}),
        ...(academicLevelId ? { academicLevelId: parseInt(academicLevelId, 10) } : {}),
      },
      include: {
        academicLevel: true,
        academicYear: true,
        classTeacher: true,
        classSubjects: {
          include: { subject: true },
        },
        _count: {
          select: {
            students: true,
            studentEnrollments: true,
            teacherAssignments: true,
            timetableSessions: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }, { section: 'asc' }],
    });

    return res.status(200).json({ success: true, data: classes });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createClass = async (req, res) => {
  try {
    const {
      name,
      section,
      academicLevelId,
      academicYearId,
      classTeacherId,
      medium,
      classType,
      capacity,
      description,
    } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'Class name is required.' });

    // Validate foreign entities belong to this institute
    if (academicLevelId) {
      const level = await prisma.academicLevel.findFirst({
        where: { id: parseInt(academicLevelId, 10), instituteId: req.instituteId },
      });
      if (!level) return res.status(404).json({ success: false, message: 'Referenced Academic Level not found.' });
    }

    if (academicYearId) {
      const year = await prisma.academicYear.findFirst({
        where: { id: parseInt(academicYearId, 10), instituteId: req.instituteId },
      });
      if (!year) return res.status(404).json({ success: false, message: 'Referenced Academic Year not found.' });
    }

    if (classTeacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: { id: parseInt(classTeacherId, 10), instituteId: req.instituteId },
      });
      if (!teacher) return res.status(404).json({ success: false, message: 'Referenced Teacher not found.' });
    }

    // Enforce composite unique check per institute
    const existing = await prisma.class.findFirst({
      where: {
        instituteId: req.instituteId,
        name: name.trim(),
        section: section ? section.trim() : null,
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Class '${name}${section ? ` - ${section}` : ''}' already exists in your institute.`,
      });
    }

    const newClass = await prisma.class.create({
      data: {
        instituteId: req.instituteId,
        name: name.trim(),
        section: section ? section.trim() : null,
        academicLevelId: academicLevelId ? parseInt(academicLevelId, 10) : null,
        academicYearId: academicYearId ? parseInt(academicYearId, 10) : null,
        classTeacherId: classTeacherId ? parseInt(classTeacherId, 10) : null,
        medium: medium || 'English',
        classType: classType || 'PHYSICAL',
        capacity: capacity ? parseInt(capacity, 10) : null,
        description: description || null,
        isActive: true,
      },
      include: {
        academicLevel: true,
        academicYear: true,
        classTeacher: true,
        classSubjects: {
          include: { subject: true },
        },
        _count: {
          select: {
            students: true,
            studentEnrollments: true,
            teacherAssignments: true,
            timetableSessions: true,
          },
        },
      },
    });

    return res.status(201).json({ success: true, message: 'Class created successfully.', data: newClass });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateClass = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      name,
      section,
      academicLevelId,
      academicYearId,
      classTeacherId,
      medium,
      classType,
      capacity,
      description,
      isActive,
    } = req.body;

    const existing = await prisma.class.findFirst({
      where: { id, instituteId: req.instituteId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Class not found in your institute.' });
    }

    // Foreign relationship security validation
    if (academicLevelId) {
      const level = await prisma.academicLevel.findFirst({
        where: { id: parseInt(academicLevelId, 10), instituteId: req.instituteId },
      });
      if (!level) return res.status(404).json({ success: false, message: 'Academic Level not found.' });
    }

    if (academicYearId) {
      const year = await prisma.academicYear.findFirst({
        where: { id: parseInt(academicYearId, 10), instituteId: req.instituteId },
      });
      if (!year) return res.status(404).json({ success: false, message: 'Academic Year not found.' });
    }

    if (classTeacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: { id: parseInt(classTeacherId, 10), instituteId: req.instituteId },
      });
      if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found.' });
    }

    const updated = await prisma.class.update({
      where: { id },
      data: {
        name: name ? name.trim() : undefined,
        section: section !== undefined ? (section ? section.trim() : null) : undefined,
        academicLevelId: academicLevelId !== undefined ? (academicLevelId ? parseInt(academicLevelId, 10) : null) : undefined,
        academicYearId: academicYearId !== undefined ? (academicYearId ? parseInt(academicYearId, 10) : null) : undefined,
        classTeacherId: classTeacherId !== undefined ? (classTeacherId ? parseInt(classTeacherId, 10) : null) : undefined,
        medium: medium || undefined,
        classType: classType || undefined,
        capacity: capacity !== undefined ? (capacity ? parseInt(capacity, 10) : null) : undefined,
        description: description !== undefined ? description : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
      include: {
        academicLevel: true,
        academicYear: true,
        classTeacher: true,
        classSubjects: {
          include: { subject: true },
        },
        _count: {
          select: {
            students: true,
            studentEnrollments: true,
            teacherAssignments: true,
            timetableSessions: true,
          },
        },
      },
    });

    return res.status(200).json({ success: true, message: 'Class updated.', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteClass = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const cls = await prisma.class.findFirst({
      where: { id, instituteId: req.instituteId },
    });

    if (!cls) {
      return res.status(404).json({ success: false, message: 'Class not found in your institute.' });
    }

    await prisma.class.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Class deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 4. SUBJECTS & CLASS-SUBJECT MAPPING
// ==========================================

export const getSubjects = async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      where: { instituteId: req.instituteId },
      include: {
        classSubjects: {
          include: { class: true },
        },
        _count: {
          select: {
            classSubjects: true,
            teacherAssignments: true,
            timetableSessions: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return res.status(200).json({ success: true, data: subjects });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createSubject = async (req, res) => {
  try {
    const { name, code, description, isActive, classId } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Subject name and code are required.' });
    }

    const existing = await prisma.subject.findFirst({
      where: {
        instituteId: req.instituteId,
        code: code.trim().toUpperCase(),
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Subject with code '${code}' already exists in your institute.`,
      });
    }

    const subject = await prisma.subject.create({
      data: {
        instituteId: req.instituteId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    if (classId) {
      const cls = await prisma.class.findFirst({
        where: { id: parseInt(classId, 10), instituteId: req.instituteId },
      });
      if (cls) {
        await prisma.classSubject.create({
          data: {
            instituteId: req.instituteId,
            classId: cls.id,
            subjectId: subject.id,
          },
        });
      }
    }

    const createdWithCount = await prisma.subject.findUnique({
      where: { id: subject.id },
      include: {
        classSubjects: { include: { class: true } },
        _count: { select: { classSubjects: true, teacherAssignments: true, timetableSessions: true } },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Subject created successfully.',
      data: createdWithCount,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSubject = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, code, description, isActive } = req.body;

    const existing = await prisma.subject.findFirst({
      where: { id, instituteId: req.instituteId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Subject not found in your institute.' });
    }

    const updated = await prisma.subject.update({
      where: { id },
      data: {
        name: name ? name.trim() : undefined,
        code: code ? code.trim().toUpperCase() : undefined,
        description: description !== undefined ? description : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
      include: {
        classSubjects: { include: { class: true } },
        _count: { select: { classSubjects: true, teacherAssignments: true, timetableSessions: true } },
      },
    });

    return res.status(200).json({ success: true, message: 'Subject updated.', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSubject = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.subject.findFirst({
      where: { id, instituteId: req.instituteId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Subject not found in your institute.' });
    }

    await prisma.subject.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Subject deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getClassSubjects = async (req, res) => {
  try {
    const classId = parseInt(req.params.id, 10);
    const cls = await prisma.class.findFirst({
      where: { id: classId, instituteId: req.instituteId },
    });
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found in your institute.' });

    const classSubjects = await prisma.classSubject.findMany({
      where: { classId, instituteId: req.instituteId },
      include: { subject: true },
    });

    return res.status(200).json({ success: true, data: classSubjects });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const assignClassSubjects = async (req, res) => {
  try {
    const classId = parseInt(req.params.id, 10);
    const { subjectIds } = req.body; // array of subject IDs

    if (!Array.isArray(subjectIds)) {
      return res.status(400).json({ success: false, message: 'subjectIds array is required.' });
    }

    const cls = await prisma.class.findFirst({
      where: { id: classId, instituteId: req.instituteId },
    });
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found in your institute.' });

    // Validate all subjects belong to this institute
    const validSubjects = await prisma.subject.findMany({
      where: { id: { in: subjectIds.map(Number) }, instituteId: req.instituteId },
    });

    if (validSubjects.length !== subjectIds.length) {
      return res.status(404).json({
        success: false,
        message: 'One or more subjects do not belong to your institute.',
      });
    }

    // Upsert mappings safely
    for (const sid of subjectIds.map(Number)) {
      await prisma.classSubject.upsert({
        where: {
          classId_subjectId: { classId, subjectId: sid },
        },
        create: {
          instituteId: req.instituteId,
          classId,
          subjectId: sid,
        },
        update: {},
      });
    }

    const updatedSubjects = await prisma.classSubject.findMany({
      where: { classId, instituteId: req.instituteId },
      include: { subject: true },
    });

    return res.status(200).json({
      success: true,
      message: 'Subjects successfully assigned to class.',
      data: updatedSubjects,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const removeClassSubject = async (req, res) => {
  try {
    const classId = parseInt(req.params.id, 10);
    const subjectId = parseInt(req.params.subjectId, 10);

    const mapping = await prisma.classSubject.findFirst({
      where: { classId, subjectId, instituteId: req.instituteId },
    });

    if (!mapping) {
      return res.status(404).json({ success: false, message: 'Subject mapping not found for this class.' });
    }

    await prisma.classSubject.delete({ where: { id: mapping.id } });
    return res.status(200).json({ success: true, message: 'Subject removed from class.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 5. TEACHER ASSIGNMENTS & WORKLOAD
// ==========================================

export const getTeacherAssignments = async (req, res) => {
  try {
    const { academicYearId, classId, teacherId, subjectId } = req.query;

    const assignments = await prisma.teacherAssignment.findMany({
      where: {
        instituteId: req.instituteId,
        ...(academicYearId ? { academicYearId: parseInt(academicYearId, 10) } : {}),
        ...(classId ? { classId: parseInt(classId, 10) } : {}),
        ...(teacherId ? { teacherId: parseInt(teacherId, 10) } : {}),
        ...(subjectId ? { subjectId: parseInt(subjectId, 10) } : {}),
      },
      include: {
        teacher: true,
        class: true,
        subject: true,
        academicYear: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ success: true, data: assignments });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createTeacherAssignment = async (req, res) => {
  try {
    const { academicYearId, classId, subjectId, teacherId, role } = req.body;

    if (!classId || !subjectId || !teacherId) {
      return res.status(400).json({ success: false, message: 'Class, Subject, and Teacher are required.' });
    }

    // Verify all referenced entities belong strictly to req.instituteId
    const [cls, sub, teacher] = await Promise.all([
      prisma.class.findFirst({ where: { id: parseInt(classId, 10), instituteId: req.instituteId } }),
      prisma.subject.findFirst({ where: { id: parseInt(subjectId, 10), instituteId: req.instituteId } }),
      prisma.teacher.findFirst({ where: { id: parseInt(teacherId, 10), instituteId: req.instituteId } }),
    ]);

    if (!cls || !sub || !teacher) {
      return res.status(404).json({
        success: false,
        message: 'Class, Subject, or Teacher not found in your institute.',
      });
    }

    let validYearId = academicYearId ? parseInt(academicYearId, 10) : null;
    if (validYearId) {
      const year = await prisma.academicYear.findFirst({
        where: { id: validYearId, instituteId: req.instituteId },
      });
      if (!year) return res.status(404).json({ success: false, message: 'Academic Year not found.' });
    } else {
      // Default to current academic year if available
      const currentYear = await prisma.academicYear.findFirst({
        where: { instituteId: req.instituteId, isCurrent: true },
      });
      if (currentYear) validYearId = currentYear.id;
    }

    // Check duplicate
    const existing = await prisma.teacherAssignment.findFirst({
      where: {
        instituteId: req.instituteId,
        academicYearId: validYearId,
        classId: parseInt(classId, 10),
        subjectId: parseInt(subjectId, 10),
        teacherId: parseInt(teacherId, 10),
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'This teacher is already assigned to this class and subject for this academic year.',
      });
    }

    const assignment = await prisma.teacherAssignment.create({
      data: {
        instituteId: req.instituteId,
        academicYearId: validYearId,
        classId: parseInt(classId, 10),
        subjectId: parseInt(subjectId, 10),
        teacherId: parseInt(teacherId, 10),
        role: role || 'PRIMARY',
      },
      include: {
        teacher: true,
        class: true,
        subject: true,
        academicYear: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Teacher assigned successfully.',
      data: assignment,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTeacherAssignment = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const assignment = await prisma.teacherAssignment.findFirst({
      where: { id, instituteId: req.instituteId },
    });

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Teacher assignment not found in your institute.' });
    }

    await prisma.teacherAssignment.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Teacher assignment removed.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTeacherWorkload = async (req, res) => {
  try {
    const teacherId = parseInt(req.params.teacherId, 10);
    const teacher = await prisma.teacher.findFirst({
      where: { id: teacherId, instituteId: req.instituteId },
    });

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found in your institute.' });
    }

    const [assignments, timetableSessions] = await Promise.all([
      prisma.teacherAssignment.findMany({
        where: { teacherId, instituteId: req.instituteId },
        include: { class: true, subject: true, academicYear: true },
      }),
      prisma.timetableSession.findMany({
        where: { teacherId, instituteId: req.instituteId, isActive: true },
        include: { class: true, subject: true },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        teacher,
        assignments,
        weeklySessionsCount: timetableSessions.length,
        timetableSessions,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 6. STUDENT ENROLLMENTS & BULK ASSIGNMENT
// ==========================================

export const getEnrollments = async (req, res) => {
  try {
    const { academicYearId, classId, status, studentId } = req.query;

    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        instituteId: req.instituteId,
        ...(academicYearId ? { academicYearId: parseInt(academicYearId, 10) } : {}),
        ...(classId ? { classId: parseInt(classId, 10) } : {}),
        ...(status ? { status } : {}),
        ...(studentId ? { studentId: parseInt(studentId, 10) } : {}),
      },
      include: {
        student: true,
        class: true,
        academicYear: true,
      },
      orderBy: { enrollmentDate: 'desc' },
    });

    return res.status(200).json({ success: true, data: enrollments });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createEnrollment = async (req, res) => {
  try {
    const { studentId, academicYearId, classId, rollNo, status } = req.body;

    if (!studentId || !classId) {
      return res.status(400).json({ success: false, message: 'Student and Class are required.' });
    }

    const [student, cls] = await Promise.all([
      prisma.student.findFirst({ where: { id: parseInt(studentId, 10), instituteId: req.instituteId } }),
      prisma.class.findFirst({ where: { id: parseInt(classId, 10), instituteId: req.instituteId } }),
    ]);

    if (!student || !cls) {
      return res.status(404).json({ success: false, message: 'Student or Class not found in your institute.' });
    }

    let validYearId = academicYearId ? parseInt(academicYearId, 10) : null;
    if (validYearId) {
      const year = await prisma.academicYear.findFirst({
        where: { id: validYearId, instituteId: req.instituteId },
      });
      if (!year) return res.status(404).json({ success: false, message: 'Academic Year not found.' });
    } else {
      const currentYear = await prisma.academicYear.findFirst({
        where: { instituteId: req.instituteId, isCurrent: true },
      });
      if (currentYear) validYearId = currentYear.id;
    }

    const existing = await prisma.studentEnrollment.findFirst({
      where: {
        instituteId: req.instituteId,
        studentId: parseInt(studentId, 10),
        academicYearId: validYearId,
        classId: parseInt(classId, 10),
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Student is already enrolled in this class for this academic year.',
      });
    }

    const enrollment = await prisma.studentEnrollment.create({
      data: {
        instituteId: req.instituteId,
        studentId: parseInt(studentId, 10),
        academicYearId: validYearId,
        classId: parseInt(classId, 10),
        rollNo: rollNo || null,
        status: status || 'ACTIVE',
      },
      include: {
        student: true,
        class: true,
        academicYear: true,
      },
    });

    // Also link active classId on student record
    await prisma.student.update({
      where: { id: parseInt(studentId, 10) },
      data: { classId: parseInt(classId, 10) },
    });

    return res.status(201).json({
      success: true,
      message: 'Student enrolled successfully.',
      data: enrollment,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const bulkEnrollStudents = async (req, res) => {
  try {
    const { studentIds, classId, academicYearId } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0 || !classId) {
      return res.status(400).json({
        success: false,
        message: 'Array of studentIds and classId are required for bulk enrollment.',
      });
    }

    const cls = await prisma.class.findFirst({
      where: { id: parseInt(classId, 10), instituteId: req.instituteId },
    });
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found in your institute.' });

    let validYearId = academicYearId ? parseInt(academicYearId, 10) : null;
    if (validYearId) {
      const year = await prisma.academicYear.findFirst({
        where: { id: validYearId, instituteId: req.instituteId },
      });
      if (!year) return res.status(404).json({ success: false, message: 'Academic Year not found.' });
    } else {
      const currentYear = await prisma.academicYear.findFirst({
        where: { instituteId: req.instituteId, isCurrent: true },
      });
      if (currentYear) validYearId = currentYear.id;
    }

    // Verify all students belong strictly to authenticated institute
    const validStudents = await prisma.student.findMany({
      where: {
        id: { in: studentIds.map(Number) },
        instituteId: req.instituteId,
      },
    });

    if (validStudents.length !== studentIds.length) {
      return res.status(404).json({
        success: false,
        message: 'One or more selected students do not belong to your institute.',
      });
    }

    const results = [];
    for (const st of validStudents) {
      const enrollment = await prisma.studentEnrollment.upsert({
        where: {
          studentId_academicYearId_classId: {
            studentId: st.id,
            academicYearId: validYearId,
            classId: parseInt(classId, 10),
          },
        },
        create: {
          instituteId: req.instituteId,
          studentId: st.id,
          academicYearId: validYearId,
          classId: parseInt(classId, 10),
          status: 'ACTIVE',
        },
        update: {
          status: 'ACTIVE',
        },
      });

      // Update current class on student
      await prisma.student.update({
        where: { id: st.id },
        data: { classId: parseInt(classId, 10) },
      });

      results.push(enrollment);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully enrolled ${results.length} students into ${cls.name}.`,
      enrolledCount: results.length,
      data: results,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateEnrollmentStatus = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, rollNo } = req.body;

    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { id, instituteId: req.instituteId },
    });

    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment record not found in your institute.' });
    }

    const updated = await prisma.studentEnrollment.update({
      where: { id },
      data: {
        status: status || undefined,
        rollNo: rollNo !== undefined ? rollNo : undefined,
      },
    });

    return res.status(200).json({ success: true, message: 'Enrollment status updated.', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
