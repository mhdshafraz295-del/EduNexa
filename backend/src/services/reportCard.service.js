import prisma from '../config/prisma.js';
import {
  getInstituteGradingRules,
  calculatePercentage,
  calculateGrade,
  calculatePassFail,
} from './result.service.js';

/**
 * Normalizes date to ISO beginning of day
 */
const normalizeDate = (dateInput) => {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return d;
};

/**
 * Calculates a single student's term examination report card.
 * Reads authoritative published results for all subject exams attached to the ExamGroup.
 *
 * @param {Object} examGroup - ExamGroup with items.exam
 * @param {Object} student - Student record with enrollments
 * @param {Boolean} isDraftPreview - If true (admin/teacher), includes marked/draft results. If false, only PUBLISHED results.
 */
export async function calculateStudentTermReport(examGroup, student, isDraftPreview = false) {
  if (!examGroup || !student) {
    throw new Error('Invalid examGroup or student record provided.');
  }

  const gradingRules = await getInstituteGradingRules(examGroup.instituteId);
  const attachedItems = examGroup.items || [];
  const studentResults = [];

  let totalObtainedMarks = 0;
  let totalPossibleMarks = 0;
  let allSubjectsCompleted = true;
  let allSubjectsPassed = true;

  for (const item of attachedItems) {
    const exam = item.exam;
    if (!exam) continue;

    // Query result for this exam and student
    const result = await prisma.result.findUnique({
      where: {
        examId_studentId: {
          examId: exam.id,
          studentId: student.id,
        },
      },
    });

    const isEligibleResult = result && (isDraftPreview || result.resultStatus === 'PUBLISHED');

    if (isEligibleResult) {
      const marks = Number(result.marks);
      const examTotal = Number(exam.totalMarks);
      const pct = Number(result.percentage) || calculatePercentage(marks, examTotal);
      const grade = result.grade || calculateGrade(pct, gradingRules);
      const passStatus = result.status || calculatePassFail(marks, pct, exam);

      totalObtainedMarks += marks;
      totalPossibleMarks += examTotal;

      if (passStatus !== 'PASS') {
        allSubjectsPassed = false;
      }

      studentResults.push({
        examId: exam.id,
        examTitle: exam.title,
        examType: exam.examType,
        subjectId: exam.subjectId,
        subjectName: exam.subject?.name || 'Subject',
        subjectCode: exam.subject?.code || 'SUB',
        marksObtained: marks,
        totalMarks: examTotal,
        percentage: pct,
        grade,
        passStatus,
        teacherFeedback: result.teacherFeedback || null,
        resultStatus: result.resultStatus,
        isCompleted: true,
      });
    } else {
      allSubjectsCompleted = false;
      allSubjectsPassed = false;
      totalPossibleMarks += Number(exam.totalMarks || 100);

      studentResults.push({
        examId: exam.id,
        examTitle: exam.title,
        examType: exam.examType,
        subjectId: exam.subjectId,
        subjectName: exam.subject?.name || 'Subject',
        subjectCode: exam.subject?.code || 'SUB',
        marksObtained: null,
        totalMarks: Number(exam.totalMarks || 100),
        percentage: null,
        grade: '—',
        passStatus: 'NOT_SUBMITTED',
        teacherFeedback: null,
        resultStatus: result ? result.resultStatus : 'PENDING',
        isCompleted: false,
      });
    }
  }

  // Calculate Overall Average & Grade
  const overallAverage = totalPossibleMarks > 0
    ? calculatePercentage(totalObtainedMarks, totalPossibleMarks)
    : 0;

  const overallGrade = allSubjectsCompleted && attachedItems.length > 0
    ? calculateGrade(overallAverage, gradingRules)
    : '—';

  const overallPassStatus = (allSubjectsCompleted && attachedItems.length > 0 && allSubjectsPassed)
    ? 'PASS'
    : (attachedItems.length === 0 ? 'PENDING' : 'FAIL');

  // Real Attendance Summary
  let attendanceSummary = null;
  if (examGroup.startDate && examGroup.endDate) {
    const startDate = normalizeDate(examGroup.startDate);
    const endDate = normalizeDate(examGroup.endDate);
    if (startDate && endDate) {
      endDate.setUTCHours(23, 59, 59, 999);

      const attendanceRecords = await prisma.attendanceRecord.findMany({
        where: {
          studentId: student.id,
          attendanceSession: {
            instituteId: examGroup.instituteId,
            classId: examGroup.classId,
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        include: { attendanceSession: true },
      });

      const totalSessions = attendanceRecords.length;
      if (totalSessions > 0) {
        const presentCount = attendanceRecords.filter((r) => r.status === 'PRESENT').length;
        const lateCount = attendanceRecords.filter((r) => r.status === 'LATE').length;
        const absentCount = attendanceRecords.filter((r) => r.status === 'ABSENT').length;
        const excusedCount = attendanceRecords.filter((r) => r.status === 'EXCUSED' || r.status === 'HALF_DAY').length;
        const attendanceRate = totalSessions > 0
          ? Math.round(((presentCount + lateCount) / totalSessions) * 1000) / 10
          : 0;

        attendanceSummary = {
          totalSessions,
          presentCount,
          lateCount,
          absentCount,
          excusedCount,
          attendanceRate,
        };
      }
    }
  }

  // Student Remarks
  const remarksRecord = await prisma.examGroupStudentRemark.findUnique({
    where: {
      examGroupId_studentId: {
        examGroupId: examGroup.id,
        studentId: student.id,
      },
    },
  });

  return {
    studentId: student.id,
    studentName: student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student',
    admissionNumber: student.admissionNumber || student.rollNo || '—',
    rollNo: student.rollNo || '—',
    subjectResults: studentResults,
    totalObtainedMarks,
    totalPossibleMarks,
    overallAverage,
    overallGrade,
    overallPassStatus,
    isComplete: allSubjectsCompleted && attachedItems.length > 0,
    attendanceSummary,
    teacherRemark: remarksRecord?.teacherRemark || null,
    principalRemark: remarksRecord?.principalRemark || null,
  };
}

/**
 * Authoritative Server-Side Class Ranking with Dense Ranking.
 * Only ranks students who have completed all mandatory subject results.
 *
 * @param {Number} examGroupId
 * @param {Number} instituteId
 * @param {Boolean} isDraftPreview
 */
export async function calculateClassRanking(examGroupId, instituteId, isDraftPreview = false) {
  const examGroup = await prisma.examGroup.findFirst({
    where: { id: examGroupId, instituteId },
    include: {
      items: {
        include: {
          exam: {
            include: { subject: true },
          },
        },
      },
      class: true,
      academicYear: true,
    },
  });

  if (!examGroup) {
    throw new Error('Exam group not found or tenant unauthorized.');
  }

  // 1. Fetch ALL enrolled active students for this class and academic year (NO fixed limits!)
  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      instituteId,
      academicYearId: examGroup.academicYearId,
      classId: examGroup.classId,
      status: 'ACTIVE',
    },
    include: {
      student: {
        include: { user: true },
      },
    },
    orderBy: [
      { rollNo: 'asc' },
      { student: { name: 'asc' } },
    ],
  });

  const studentReports = [];

  for (const enrollment of enrollments) {
    const student = enrollment.student;
    if (!student) continue;

    const report = await calculateStudentTermReport(examGroup, student, isDraftPreview);
    report.enrollmentId = enrollment.id;
    studentReports.push(report);
  }

  // 2. Perform Dense Ranking for complete students
  const completeReports = studentReports.filter((r) => r.isComplete);

  // Sort descending by overallAverage, then totalObtainedMarks
  completeReports.sort((a, b) => {
    if (b.overallAverage !== a.overallAverage) {
      return b.overallAverage - a.overallAverage;
    }
    return b.totalObtainedMarks - a.totalObtainedMarks;
  });

  // Assign dense ranks: 1st, 2nd, 2nd, 3rd...
  let currentRank = 1;
  for (let i = 0; i < completeReports.length; i++) {
    if (i > 0) {
      const prev = completeReports[i - 1];
      const curr = completeReports[i];
      if (curr.overallAverage < prev.overallAverage) {
        currentRank += 1;
      }
    }
    completeReports[i].rankPosition = currentRank;
    completeReports[i].rankDisplay = `${currentRank}`;
  }

  // Assign null/unavailable rank for incomplete students
  for (const report of studentReports) {
    if (!report.isComplete) {
      report.rankPosition = null;
      report.rankDisplay = 'Rank not available yet';
    }
  }

  return {
    examGroup,
    totalEnrolledStudents: enrollments.length,
    completedStudentsCount: completeReports.length,
    incompleteStudentsCount: studentReports.length - completeReports.length,
    studentReports,
  };
}

/**
 * Computes Class Performance & Subject Performance Summary
 */
export async function getClassSummaryAnalytics(examGroupId, instituteId) {
  const rankingData = await calculateClassRanking(examGroupId, instituteId, true);
  const { studentReports, examGroup } = rankingData;

  const totalStudents = studentReports.length;
  const completedReports = studentReports.filter((r) => r.isComplete);
  const passedReports = completedReports.filter((r) => r.overallPassStatus === 'PASS');
  const failedReports = completedReports.filter((r) => r.overallPassStatus === 'FAIL');

  const averages = completedReports.map((r) => r.overallAverage);
  const classAverage = averages.length > 0
    ? Math.round((averages.reduce((sum, val) => sum + val, 0) / averages.length) * 100) / 100
    : 0;
  const highestAverage = averages.length > 0 ? Math.max(...averages) : 0;
  const lowestAverage = averages.length > 0 ? Math.min(...averages) : 0;
  const overallPassRate = completedReports.length > 0
    ? Math.round((passedReports.length / completedReports.length) * 1000) / 10
    : 0;

  // Subject-Wise Aggregations
  const subjectSummaries = [];
  const attachedItems = examGroup.items || [];

  for (const item of attachedItems) {
    const exam = item.exam;
    if (!exam) continue;

    const subjectResults = [];
    for (const report of studentReports) {
      const subRes = report.subjectResults.find((s) => s.examId === exam.id && s.isCompleted);
      if (subRes && subRes.marksObtained !== null) {
        subjectResults.push(subRes);
      }
    }

    const marksList = subjectResults.map((s) => s.marksObtained);
    const avgMark = marksList.length > 0
      ? Math.round((marksList.reduce((a, b) => a + b, 0) / marksList.length) * 100) / 100
      : 0;
    const highestMark = marksList.length > 0 ? Math.max(...marksList) : 0;
    const lowestMark = marksList.length > 0 ? Math.min(...marksList) : 0;
    const passCount = subjectResults.filter((s) => s.passStatus === 'PASS').length;
    const failCount = subjectResults.filter((s) => s.passStatus === 'FAIL').length;
    const passRate = subjectResults.length > 0
      ? Math.round((passCount / subjectResults.length) * 1000) / 10
      : 0;

    subjectSummaries.push({
      examId: exam.id,
      examTitle: exam.title,
      subjectId: exam.subjectId,
      subjectName: exam.subject?.name || 'Subject',
      subjectCode: exam.subject?.code || 'SUB',
      totalMarks: exam.totalMarks,
      totalSubmissions: subjectResults.length,
      averageMark: avgMark,
      highestMark,
      lowestMark,
      passCount,
      failCount,
      passRate,
    });
  }

  return {
    examGroup: {
      id: examGroup.id,
      name: examGroup.name,
      academicYear: examGroup.academicYear?.name,
      className: examGroup.class?.name,
      status: examGroup.status,
      releasedAt: examGroup.releasedAt,
    },
    totalStudents,
    fullyCompletedCount: completedReports.length,
    incompleteCount: studentReports.length - completedReports.length,
    passedCount: passedReports.length,
    failedCount: failedReports.length,
    classAverage,
    highestAverage,
    lowestAverage,
    overallPassRate,
    subjectSummaries,
    studentReports,
  };
}

/**
 * Generates authoritative class multi-subject CSV export.
 */
export async function generateClassResultCsv(examGroupId, instituteId) {
  const rankingData = await calculateClassRanking(examGroupId, instituteId, true);
  const { studentReports, examGroup } = rankingData;
  const attachedItems = examGroup.items || [];

  // Build CSV Header
  const headers = ['No', 'Admission Number', 'Student Name', 'Roll Number'];
  for (const item of attachedItems) {
    headers.push(`${item.exam.subject?.name || 'Subject'} (${item.exam.totalMarks})`);
  }
  headers.push('Total Obtained', 'Total Possible', 'Overall Average (%)', 'Overall Grade', 'Result', 'Class Rank');

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = [];
  rows.push(headers.map(escapeCsv).join(','));

  studentReports.forEach((report, index) => {
    const row = [
      index + 1,
      report.admissionNumber,
      report.studentName,
      report.rollNo,
    ];

    for (const item of attachedItems) {
      const subRes = report.subjectResults.find((s) => s.examId === item.examId);
      if (subRes && subRes.isCompleted) {
        row.push(subRes.marksObtained);
      } else {
        row.push('—');
      }
    }

    row.push(
      report.totalObtainedMarks,
      report.totalPossibleMarks,
      `${report.overallAverage}%`,
      report.overallGrade,
      report.overallPassStatus,
      report.rankDisplay || '—',
    );

    rows.push(row.map(escapeCsv).join(','));
  });

  return rows.join('\r\n');
}
