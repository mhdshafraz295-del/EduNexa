import prisma from '../config/prisma.js';
import {
  calculateStudentTermReport,
  calculateClassRanking,
  getClassSummaryAnalytics,
  generateClassResultCsv,
} from '../services/reportCard.service.js';
import {
  generateIndividualReportCardPdf,
  generateClassResultSheetPdf,
  generateBulkReportCardsPdf,
} from '../services/reportCardPdf.service.js';

/**
 * Verifies if teacher has access to the specified class
 */
async function verifyTeacherClassAccess(teacherUserId, instituteId, classId, academicYearId) {
  const teacher = await prisma.teacher.findFirst({
    where: { userId: teacherUserId, instituteId },
  });

  if (!teacher) return false;

  const assignment = await prisma.teacherAssignment.findFirst({
    where: {
      instituteId,
      teacherId: teacher.id,
      classId,
      ...(academicYearId ? { academicYearId } : {}),
    },
  });

  if (assignment) return true;

  // Check if class teacher
  const cls = await prisma.class.findFirst({
    where: { id: classId, instituteId, classTeacherId: teacher.id },
  });

  return Boolean(cls);
}

// =========================================================================
// 1. CREATE EXAM GROUP / TERM
// =========================================================================
export const createExamGroup = async (req, res) => {
  try {
    const instituteId = req.instituteId; // STRICT TENANT ENFORCEMENT
    const { academicYearId, classId, name, description, startDate, endDate } = req.body;

    if (!name || !academicYearId || !classId) {
      return res.status(400).json({
        success: false,
        message: 'Name, Academic Year, and Class are required.',
      });
    }

    // Verify Academic Year & Class belong to institute
    const academicYear = await prisma.academicYear.findFirst({
      where: { id: Number(academicYearId), instituteId },
    });
    if (!academicYear) {
      return res.status(400).json({ success: false, message: 'Invalid Academic Year.' });
    }

    const cls = await prisma.class.findFirst({
      where: { id: Number(classId), instituteId },
    });
    if (!cls) {
      return res.status(400).json({ success: false, message: 'Invalid Class.' });
    }

    const group = await prisma.examGroup.create({
      data: {
        instituteId,
        academicYearId: Number(academicYearId),
        classId: Number(classId),
        name: name.trim(),
        description: description ? description.trim() : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: 'DRAFT',
      },
      include: {
        academicYear: true,
        class: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Term Examination Group created successfully.',
      data: group,
    });
  } catch (error) {
    console.error('Error creating ExamGroup:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// =========================================================================
// 2. GET EXAM GROUPS LIST
// =========================================================================
export const getExamGroups = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { academicYearId, classId, status } = req.query;

    const where = {
      instituteId,
      ...(academicYearId ? { academicYearId: Number(academicYearId) } : {}),
      ...(classId ? { classId: Number(classId) } : {}),
      ...(status ? { status } : {}),
    };

    const groups = await prisma.examGroup.findMany({
      where,
      include: {
        academicYear: true,
        class: true,
        items: {
          include: {
            exam: {
              include: {
                subject: true,
                _count: { select: { results: true } },
              },
            },
          },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: groups });
  } catch (error) {
    console.error('Error fetching ExamGroups:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// =========================================================================
// 3. GET EXAM GROUP DETAILS
// =========================================================================
export const getExamGroupDetails = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const group = await prisma.examGroup.findFirst({
      where: { id: Number(id), instituteId },
      include: {
        academicYear: true,
        class: true,
        items: {
          include: {
            exam: {
              include: {
                subject: true,
                teacher: true,
                _count: { select: { results: true, attempts: true } },
              },
            },
          },
        },
        remarks: true,
      },
    });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Term Exam Group not found.' });
    }

    // Check teacher access
    if (req.user.role === 'TEACHER') {
      const hasAccess = await verifyTeacherClassAccess(
        req.user.id,
        instituteId,
        group.classId,
        group.academicYearId
      );
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied to this class.' });
      }
    }

    // Get total enrolled students in this class
    const enrolledCount = await prisma.studentEnrollment.count({
      where: {
        instituteId,
        academicYearId: group.academicYearId,
        classId: group.classId,
        status: 'ACTIVE',
      },
    });

    return res.json({
      success: true,
      data: {
        ...group,
        totalEnrolledStudents: enrolledCount,
      },
    });
  } catch (error) {
    console.error('Error fetching ExamGroup details:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// =========================================================================
// 4. UPDATE EXAM GROUP
// =========================================================================
export const updateExamGroup = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;
    const { name, description, startDate, endDate } = req.body;

    const group = await prisma.examGroup.findFirst({
      where: { id: Number(id), instituteId },
    });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Term Exam Group not found.' });
    }

    const updated = await prisma.examGroup.update({
      where: { id: Number(id) },
      data: {
        ...(name ? { name: name.trim() } : {}),
        description: description !== undefined ? (description ? description.trim() : null) : undefined,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
        endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
      },
      include: {
        academicYear: true,
        class: true,
      },
    });

    return res.json({ success: true, message: 'Term Exam Group updated.', data: updated });
  } catch (error) {
    console.error('Error updating ExamGroup:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// =========================================================================
// 5. ATTACH SUBJECT EXAMS TO EXAM GROUP (With strict scope validation)
// =========================================================================
export const attachExamsToGroup = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;
    const { examIds } = req.body;

    if (!Array.isArray(examIds)) {
      return res.status(400).json({ success: false, message: 'examIds must be an array of IDs.' });
    }

    const group = await prisma.examGroup.findFirst({
      where: { id: Number(id), instituteId },
    });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Term Exam Group not found.' });
    }

    // Validate each attached exam belongs to this institute, academic year, and class
    for (const examId of examIds) {
      const exam = await prisma.exam.findFirst({
        where: { id: Number(examId), instituteId },
      });

      if (!exam) {
        return res.status(400).json({
          success: false,
          message: `Exam ID ${examId} not found or does not belong to your institute.`,
        });
      }

      if (exam.classId !== group.classId) {
        return res.status(400).json({
          success: false,
          message: `Exam "${exam.title}" belongs to a different class.`,
        });
      }

      if (exam.academicYearId && exam.academicYearId !== group.academicYearId) {
        return res.status(400).json({
          success: false,
          message: `Exam "${exam.title}" belongs to a different Academic Year.`,
        });
      }
    }

    // Sync items in transaction
    await prisma.$transaction(async (tx) => {
      // Remove unselected items
      await tx.examGroupItem.deleteMany({
        where: {
          examGroupId: group.id,
          examId: { notIn: examIds.map((eid) => Number(eid)) },
        },
      });

      // Upsert selected items
      for (const examId of examIds) {
        await tx.examGroupItem.upsert({
          where: {
            examGroupId_examId: {
              examGroupId: group.id,
              examId: Number(examId),
            },
          },
          create: {
            examGroupId: group.id,
            examId: Number(examId),
          },
          update: {},
        });
      }
    });

    const updatedGroup = await prisma.examGroup.findUnique({
      where: { id: group.id },
      include: {
        items: {
          include: {
            exam: { include: { subject: true } },
          },
        },
      },
    });

    return res.json({
      success: true,
      message: 'Subject exams updated for this term.',
      data: updatedGroup,
    });
  } catch (error) {
    console.error('Error attaching exams to group:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// =========================================================================
// 6. GET CLASS RESULT SHEET / MATRIX
// =========================================================================
export const getExamGroupClassSheet = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const group = await prisma.examGroup.findFirst({
      where: { id: Number(id), instituteId },
    });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Term Exam Group not found.' });
    }

    // Teacher access check
    if (req.user.role === 'TEACHER') {
      const hasAccess = await verifyTeacherClassAccess(
        req.user.id,
        instituteId,
        group.classId,
        group.academicYearId
      );
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied to this class.' });
      }
    }

    const rankingData = await calculateClassRanking(group.id, instituteId, true);
    return res.json({ success: true, data: rankingData });
  } catch (error) {
    console.error('Error calculating class sheet:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// =========================================================================
// 7. GET SINGLE STUDENT REPORT CARD
// =========================================================================
export const getStudentReportCard = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { id, studentId } = req.params;

    const group = await prisma.examGroup.findFirst({
      where: { id: Number(id), instituteId },
      include: {
        academicYear: true,
        class: true,
        items: {
          include: {
            exam: { include: { subject: true } },
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Term Exam Group not found.' });
    }

    const student = await prisma.student.findFirst({
      where: { id: Number(studentId), instituteId },
      include: { user: true },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // RBAC & Privacy checks
    const isDraftPreview = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN' || req.user.role === 'TEACHER';

    if (req.user.role === 'STUDENT') {
      if (student.userId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied to this report.' });
      }
      if (group.status !== 'RELEASED') {
        return res.status(403).json({ success: false, message: 'This term report card is not yet released.' });
      }
    } else if (req.user.role === 'PARENT') {
      const parent = await prisma.parent.findFirst({
        where: { userId: req.user.id, instituteId },
      });
      if (!parent) return res.status(403).json({ success: false, message: 'Parent profile not found.' });

      const link = await prisma.parentStudent.findFirst({
        where: { parentId: parent.id, studentId: student.id },
      });
      if (!link) {
        return res.status(403).json({ success: false, message: 'Student is not linked to your parent account.' });
      }
      if (group.status !== 'RELEASED') {
        return res.status(403).json({ success: false, message: 'This term report card is not yet released.' });
      }
    }

    // Fetch class ranking data to get student's rank
    const rankingData = await calculateClassRanking(group.id, instituteId, isDraftPreview);
    const studentReport = rankingData.studentReports.find((r) => r.studentId === student.id);

    if (!studentReport) {
      return res.status(404).json({ success: false, message: 'Student report could not be generated.' });
    }

    return res.json({
      success: true,
      data: {
        examGroup: {
          id: group.id,
          name: group.name,
          academicYear: group.academicYear?.name,
          className: group.class?.name,
          status: group.status,
          releasedAt: group.releasedAt,
        },
        studentReport,
      },
    });
  } catch (error) {
    console.error('Error fetching student report card:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// =========================================================================
// 8. SAVE STUDENT REMARKS (Per-student teacher and principal remarks)
// =========================================================================
export const saveStudentRemarks = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { id, studentId } = req.params;
    const { teacherRemark, principalRemark } = req.body;

    const group = await prisma.examGroup.findFirst({
      where: { id: Number(id), instituteId },
    });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Term Exam Group not found.' });
    }

    const student = await prisma.student.findFirst({
      where: { id: Number(studentId), instituteId },
    });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in your institute.' });
    }

    const record = await prisma.examGroupStudentRemark.upsert({
      where: {
        examGroupId_studentId: {
          examGroupId: group.id,
          studentId: student.id,
        },
      },
      create: {
        instituteId,
        examGroupId: group.id,
        studentId: student.id,
        teacherRemark: teacherRemark !== undefined ? (teacherRemark ? teacherRemark.trim() : null) : null,
        principalRemark: principalRemark !== undefined ? (principalRemark ? principalRemark.trim() : null) : null,
        updatedBy: req.user.id,
      },
      update: {
        teacherRemark: teacherRemark !== undefined ? (teacherRemark ? teacherRemark.trim() : null) : undefined,
        principalRemark: principalRemark !== undefined ? (principalRemark ? principalRemark.trim() : null) : undefined,
        updatedBy: req.user.id,
      },
    });

    return res.json({ success: true, message: 'Remarks saved successfully.', data: record });
  } catch (error) {
    console.error('Error saving remarks:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// =========================================================================
// 9. RELEASE TERM REPORT CARDS
// =========================================================================
export const releaseExamGroup = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const group = await prisma.examGroup.findFirst({
      where: { id: Number(id), instituteId },
    });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Term Exam Group not found.' });
    }

    const updated = await prisma.examGroup.update({
      where: { id: group.id },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
        releasedBy: req.user.id,
      },
    });

    return res.json({
      success: true,
      message: 'Term report cards have been successfully released to Students and Parents.',
      data: updated,
    });
  } catch (error) {
    console.error('Error releasing exam group:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// =========================================================================
// 10. UNRELEASE / REVOKE TERM REPORT CARDS
// =========================================================================
export const unreleaseExamGroup = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const group = await prisma.examGroup.findFirst({
      where: { id: Number(id), instituteId },
    });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Term Exam Group not found.' });
    }

    const updated = await prisma.examGroup.update({
      where: { id: group.id },
      data: {
        status: 'DRAFT',
        releasedAt: null,
        releasedBy: null,
      },
    });

    return res.json({
      success: true,
      message: 'Term report cards unpublished and reverted to Draft.',
      data: updated,
    });
  } catch (error) {
    console.error('Error un-releasing exam group:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// =========================================================================
// 11. GET EXAM GROUP PERFORMANCE ANALYTICS
// =========================================================================
export const getExamGroupAnalytics = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const analytics = await getClassSummaryAnalytics(Number(id), instituteId);
    return res.json({ success: true, data: analytics });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// =========================================================================
// 12. EXPORT CLASS RESULT SHEET CSV
// =========================================================================
export const exportClassSheetCsv = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const group = await prisma.examGroup.findFirst({
      where: { id: Number(id), instituteId },
      include: { class: true },
    });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Term Exam Group not found.' });
    }

    const csvContent = await generateClassResultCsv(group.id, instituteId);
    const filename = `Class_Results_${group.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csvContent);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// =========================================================================
// 13. DOWNLOAD INDIVIDUAL REPORT CARD PDF
// =========================================================================
export const downloadStudentReportPdf = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { id, studentId } = req.params;

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
    });

    const group = await prisma.examGroup.findFirst({
      where: { id: Number(id), instituteId },
      include: { academicYear: true, class: true },
    });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Term Exam Group not found.' });
    }

    const student = await prisma.student.findFirst({
      where: { id: Number(studentId), instituteId },
      include: { user: true },
    });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // Role security
    const isDraftPreview = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN' || req.user.role === 'TEACHER';
    if (req.user.role === 'STUDENT') {
      if (student.userId !== req.user.id || group.status !== 'RELEASED') {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    } else if (req.user.role === 'PARENT') {
      const parent = await prisma.parent.findFirst({ where: { userId: req.user.id, instituteId } });
      const link = parent ? await prisma.parentStudent.findFirst({ where: { parentId: parent.id, studentId: student.id } }) : null;
      if (!link || group.status !== 'RELEASED') {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const rankingData = await calculateClassRanking(group.id, instituteId, isDraftPreview);
    const studentReport = rankingData.studentReports.find((r) => r.studentId === student.id);

    if (!studentReport) {
      return res.status(404).json({ success: false, message: 'Student report unavailable.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ReportCard_${student.admissionNumber || student.id}.pdf"`
    );

    await generateIndividualReportCardPdf(studentReport, group, institute, null, res);
  } catch (error) {
    console.error('Error generating report PDF:', error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  }
};

// =========================================================================
// 14. DOWNLOAD CLASS RESULT SHEET PDF
// =========================================================================
export const downloadClassResultPdf = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
    });

    const group = await prisma.examGroup.findFirst({
      where: { id: Number(id), instituteId },
    });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Term Exam Group not found.' });
    }

    const rankingData = await calculateClassRanking(group.id, instituteId, true);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ClassResultSheet_${group.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`
    );

    await generateClassResultSheetPdf(rankingData, institute, res);
  } catch (error) {
    console.error('Error generating class result PDF:', error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  }
};

// =========================================================================
// 15. DOWNLOAD BULK ALL STUDENT REPORT CARDS PDF
// =========================================================================
export const downloadBulkReportCardsPdf = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
    });

    const group = await prisma.examGroup.findFirst({
      where: { id: Number(id), instituteId },
    });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Term Exam Group not found.' });
    }

    const rankingData = await calculateClassRanking(group.id, instituteId, true);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="BulkReportCards_${group.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`
    );

    await generateBulkReportCardsPdf(rankingData, institute, null, res);
  } catch (error) {
    console.error('Error generating bulk PDF:', error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  }
};

// =========================================================================
// 16. STUDENT PORTAL: GET MY RELEASED TERM REPORTS
// =========================================================================
export const getStudentTermReports = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const student = await prisma.student.findFirst({
      where: { userId: req.user.id, instituteId },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    // Get student active enrollment
    const activeEnrollment = await prisma.studentEnrollment.findFirst({
      where: { studentId: student.id, instituteId, status: 'ACTIVE' },
    });

    if (!activeEnrollment) {
      return res.json({ success: true, data: [] });
    }

    // Find all RELEASED exam groups for this class & academic year
    const releasedGroups = await prisma.examGroup.findMany({
      where: {
        instituteId,
        academicYearId: activeEnrollment.academicYearId,
        classId: activeEnrollment.classId,
        status: 'RELEASED',
      },
      include: {
        academicYear: true,
        class: true,
        items: { include: { exam: { include: { subject: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const termReports = [];
    for (const group of releasedGroups) {
      const rankingData = await calculateClassRanking(group.id, instituteId, false);
      const studentReport = rankingData.studentReports.find((r) => r.studentId === student.id);
      if (studentReport) {
        termReports.push({
          examGroup: {
            id: group.id,
            name: group.name,
            academicYear: group.academicYear?.name,
            className: group.class?.name,
            releasedAt: group.releasedAt,
          },
          report: studentReport,
        });
      }
    }

    return res.json({ success: true, data: termReports });
  } catch (error) {
    console.error('Error fetching student term reports:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// =========================================================================
// 17. PARENT PORTAL: GET LINKED CHILD'S RELEASED TERM REPORTS
// =========================================================================
export const getParentChildTermReports = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { studentId } = req.params;

    const parent = await prisma.parent.findFirst({
      where: { userId: req.user.id, instituteId },
    });
    if (!parent) {
      return res.status(403).json({ success: false, message: 'Parent profile not found.' });
    }

    const link = await prisma.parentStudent.findFirst({
      where: { parentId: parent.id, studentId: Number(studentId) },
    });
    if (!link) {
      return res.status(403).json({ success: false, message: 'Child is not linked to your account.' });
    }

    const activeEnrollment = await prisma.studentEnrollment.findFirst({
      where: { studentId: Number(studentId), instituteId, status: 'ACTIVE' },
    });
    if (!activeEnrollment) {
      return res.json({ success: true, data: [] });
    }

    const releasedGroups = await prisma.examGroup.findMany({
      where: {
        instituteId,
        academicYearId: activeEnrollment.academicYearId,
        classId: activeEnrollment.classId,
        status: 'RELEASED',
      },
      include: {
        academicYear: true,
        class: true,
        items: { include: { exam: { include: { subject: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const termReports = [];
    for (const group of releasedGroups) {
      const rankingData = await calculateClassRanking(group.id, instituteId, false);
      const studentReport = rankingData.studentReports.find((r) => r.studentId === Number(studentId));
      if (studentReport) {
        termReports.push({
          examGroup: {
            id: group.id,
            name: group.name,
            academicYear: group.academicYear?.name,
            className: group.class?.name,
            releasedAt: group.releasedAt,
          },
          report: studentReport,
        });
      }
    }

    return res.json({ success: true, data: termReports });
  } catch (error) {
    console.error('Error fetching parent child term reports:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};
