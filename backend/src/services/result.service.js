import prisma from '../config/prisma.js';

// Centralized Default Grading Rules
export const DEFAULT_GRADING_RULES = [
  { grade: 'A', minPercentage: 75, maxPercentage: 100, description: 'Distinction' },
  { grade: 'B', minPercentage: 65, maxPercentage: 74.99, description: 'Very Good' },
  { grade: 'C', minPercentage: 55, maxPercentage: 64.99, description: 'Credit' },
  { grade: 'S', minPercentage: 40, maxPercentage: 54.99, description: 'Simple Pass' },
  { grade: 'F', minPercentage: 0, maxPercentage: 39.99, description: 'Fail' },
];

/**
 * Resolves grading scheme for an institute (custom if configured, else default fallback)
 */
export async function getInstituteGradingRules(instituteId) {
  if (!instituteId) return DEFAULT_GRADING_RULES;

  try {
    const scheme = await prisma.gradingScheme.findFirst({
      where: { instituteId, isDefault: true },
    });

    if (scheme && Array.isArray(scheme.rules) && scheme.rules.length > 0) {
      return scheme.rules;
    }
  } catch (e) {
    console.warn('Failed to fetch institute grading scheme, falling back to default:', e);
  }

  return DEFAULT_GRADING_RULES;
}

/**
 * Authoritative Server Percentage Calculation
 */
export function calculatePercentage(marksAwarded, totalMarks) {
  if (!totalMarks || totalMarks <= 0) return 0;
  if (marksAwarded === null || marksAwarded === undefined || isNaN(marksAwarded)) return 0;
  const pct = (Number(marksAwarded) / Number(totalMarks)) * 100;
  return Math.round(pct * 100) / 100;
}

/**
 * Authoritative Server Grade Calculation
 */
export function calculateGrade(percentage, gradingRules = DEFAULT_GRADING_RULES) {
  const pct = Number(percentage);
  if (isNaN(pct) || pct < 0) return 'F';

  const rules = Array.isArray(gradingRules) && gradingRules.length > 0 ? gradingRules : DEFAULT_GRADING_RULES;

  for (const rule of rules) {
    const min = Number(rule.minPercentage);
    const max = Number(rule.maxPercentage);
    if (pct >= min && pct <= max) {
      return rule.grade;
    }
  }

  // If percentage exceeds top boundary (e.g. bonus marks), return highest grade
  if (pct >= 100 && rules.length > 0) {
    return rules[0].grade;
  }

  return 'F';
}

/**
 * Authoritative Server Pass/Fail Calculation
 */
export function calculatePassFail(marksAwarded, percentage, exam) {
  const passingMarks = exam?.passingMarks !== undefined && exam?.passingMarks !== null ? Number(exam.passingMarks) : 0;
  const passMarkType = (exam?.passMarkType || 'MARKS').toUpperCase();

  if (passMarkType === 'PERCENTAGE') {
    return Number(percentage) >= passingMarks;
  }
  // Default: MARKS
  return Number(marksAwarded) >= passingMarks;
}

/**
 * Atomic Save / Mark Submission (Individual)
 */
export async function saveMarkingResult({
  instituteId,
  examId,
  studentId,
  marks,
  feedback = null,
  markerId = null,
  isDraft = false,
  reason = null,
}) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, instituteId },
  });

  if (!exam) {
    throw new Error('Exam not found or tenant access denied.');
  }

  const numMarks = Number(marks);
  if (isNaN(numMarks) || numMarks < 0 || numMarks > exam.totalMarks) {
    throw new Error(`Marks must be a valid number between 0 and ${exam.totalMarks}.`);
  }

  const gradingRules = await getInstituteGradingRules(instituteId);
  const percentage = calculatePercentage(numMarks, exam.totalMarks);
  const grade = calculateGrade(percentage, gradingRules);
  const isPassed = calculatePassFail(numMarks, percentage, exam);
  const passStatus = isPassed ? 'PASS' : 'FAIL';
  const newResultStatus = isDraft ? 'PENDING' : 'MARKED';

  // Check existing result
  const existingResult = await prisma.result.findFirst({
    where: { examId, studentId },
  });

  const now = new Date();

  const savedResult = await prisma.$transaction(async (tx) => {
    // 1. Audit Trail if previously PUBLISHED or MARKED
    if (existingResult) {
      const wasPublished = existingResult.resultStatus === 'PUBLISHED';
      const marksChanged = existingResult.marks !== numMarks;

      if (wasPublished && marksChanged) {
        await tx.resultAuditLog.create({
          data: {
            instituteId,
            resultId: existingResult.id,
            examId,
            studentId,
            action: 'RESULT_UPDATED',
            previousMarks: existingResult.marks,
            newMarks: numMarks,
            previousPercentage: existingResult.percentage,
            newPercentage: percentage,
            previousGrade: existingResult.grade,
            newGrade: grade,
            previousPassFail: existingResult.status,
            newPassFail: passStatus,
            reason: reason || 'Marks updated after publication.',
            changedBy: markerId,
            changedAt: now,
          },
        });
      }
    }

    // 2. Upsert Result
    const res = await tx.result.upsert({
      where: {
        examId_studentId: { examId, studentId },
      },
      create: {
        instituteId,
        examId,
        studentId,
        marks: numMarks,
        percentage,
        grade,
        status: passStatus,
        resultStatus: newResultStatus,
        teacherFeedback: feedback,
        markedBy: markerId,
        markedAt: now,
      },
      update: {
        marks: numMarks,
        percentage,
        grade,
        status: passStatus,
        resultStatus: existingResult?.resultStatus === 'PUBLISHED' ? 'PUBLISHED' : newResultStatus,
        teacherFeedback: feedback,
        markedBy: markerId,
        markedAt: now,
      },
      include: {
        student: { select: { id: true, name: true, admissionNumber: true, rollNo: true } },
        exam: true,
      },
    });

    // 3. Update corresponding latest ExamAttempt if exists
    const latestAttempt = await tx.examAttempt.findFirst({
      where: { examId, studentId },
      orderBy: { attemptNumber: 'desc' },
    });

    if (latestAttempt) {
      await tx.examAttempt.update({
        where: { id: latestAttempt.id },
        data: {
          score: numMarks,
          percentage,
          isPassed,
          teacherFeedback: feedback,
          markedBy: markerId,
          markedAt: now,
          status: isDraft ? latestAttempt.status : 'MARKED',
        },
      });
    }

    return res;
  });

  return savedResult;
}

/**
 * Publish Single Student Result
 */
export async function publishResult({ instituteId, examId, studentId, publisherId }) {
  const result = await prisma.result.findFirst({
    where: { examId, studentId, instituteId },
  });

  if (!result) {
    throw new Error('Result record not found for student.');
  }

  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.result.update({
      where: { id: result.id },
      data: {
        resultStatus: 'PUBLISHED',
        publishedBy: publisherId,
        publishedAt: now,
      },
      include: { student: true, exam: true },
    });

    await tx.resultAuditLog.create({
      data: {
        instituteId,
        resultId: result.id,
        examId,
        studentId,
        action: 'RESULT_PUBLISHED',
        previousMarks: result.marks,
        newMarks: result.marks,
        previousPercentage: result.percentage,
        newPercentage: result.percentage,
        previousGrade: result.grade,
        newGrade: result.grade,
        previousPassFail: result.status,
        newPassFail: result.status,
        changedBy: publisherId,
        changedAt: now,
      },
    });

    return updated;
  });
}

/**
 * Unpublish Single Student Result
 */
export async function unpublishResult({ instituteId, examId, studentId, unpublisherId }) {
  const result = await prisma.result.findFirst({
    where: { examId, studentId, instituteId },
  });

  if (!result) {
    throw new Error('Result record not found for student.');
  }

  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.result.update({
      where: { id: result.id },
      data: {
        resultStatus: 'MARKED',
        publishedAt: null,
      },
      include: { student: true, exam: true },
    });

    await tx.resultAuditLog.create({
      data: {
        instituteId,
        resultId: result.id,
        examId,
        studentId,
        action: 'RESULT_UNPUBLISHED',
        previousMarks: result.marks,
        newMarks: result.marks,
        previousPercentage: result.percentage,
        newPercentage: result.percentage,
        previousGrade: result.grade,
        newGrade: result.grade,
        previousPassFail: result.status,
        newPassFail: result.status,
        changedBy: unpublisherId,
        changedAt: now,
      },
    });

    return updated;
  });
}

/**
 * Bulk Publish All Marked Results for an Exam
 */
export async function publishAllMarkedResults({ instituteId, examId, publisherId }) {
  const markedResults = await prisma.result.findMany({
    where: {
      examId,
      instituteId,
      resultStatus: 'MARKED',
    },
  });

  if (markedResults.length === 0) {
    return { count: 0, message: 'No marked results waiting to be published.' };
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.result.updateMany({
      where: {
        examId,
        instituteId,
        resultStatus: 'MARKED',
      },
      data: {
        resultStatus: 'PUBLISHED',
        publishedBy: publisherId,
        publishedAt: now,
      },
    });

    for (const r of markedResults) {
      await tx.resultAuditLog.create({
        data: {
          instituteId,
          resultId: r.id,
          examId,
          studentId: r.studentId,
          action: 'RESULT_PUBLISHED',
          previousMarks: r.marks,
          newMarks: r.marks,
          previousPercentage: r.percentage,
          newPercentage: r.percentage,
          previousGrade: r.grade,
          newGrade: r.grade,
          previousPassFail: r.status,
          newPassFail: r.status,
          changedBy: publisherId,
          changedAt: now,
        },
      });
    }
  });

  return { count: markedResults.length, message: `Successfully published ${markedResults.length} results.` };
}

/**
 * Bulk Save Marks (Spreadsheet-style entry)
 */
export async function bulkSaveMarks({ instituteId, examId, marksList, markerId, reason = null }) {
  if (!Array.isArray(marksList) || marksList.length === 0) {
    throw new Error('Marks list must be a non-empty array.');
  }

  const exam = await prisma.exam.findFirst({
    where: { id: examId, instituteId },
  });

  if (!exam) {
    throw new Error('Exam not found or tenant access denied.');
  }

  const gradingRules = await getInstituteGradingRules(instituteId);

  // Validate every entry first
  for (const item of marksList) {
    const marks = Number(item.marks);
    if (isNaN(marks) || marks < 0 || marks > exam.totalMarks) {
      throw new Error(`Invalid marks for student ID ${item.studentId}: Must be between 0 and ${exam.totalMarks}.`);
    }
  }

  const now = new Date();
  const results = [];

  await prisma.$transaction(async (tx) => {
    for (const item of marksList) {
      const studentId = parseInt(item.studentId);
      const marks = Number(item.marks);
      const feedback = item.feedback || null;
      const percentage = calculatePercentage(marks, exam.totalMarks);
      const grade = calculateGrade(percentage, gradingRules);
      const isPassed = calculatePassFail(marks, percentage, exam);
      const passStatus = isPassed ? 'PASS' : 'FAIL';

      const existing = await tx.result.findFirst({
        where: { examId, studentId },
      });

      if (existing && existing.resultStatus === 'PUBLISHED' && existing.marks !== marks) {
        await tx.resultAuditLog.create({
          data: {
            instituteId,
            resultId: existing.id,
            examId,
            studentId,
            action: 'RESULT_UPDATED',
            previousMarks: existing.marks,
            newMarks: marks,
            previousPercentage: existing.percentage,
            newPercentage: percentage,
            previousGrade: existing.grade,
            newGrade: grade,
            previousPassFail: existing.status,
            newPassFail: passStatus,
            reason: reason || 'Bulk marks update after publication.',
            changedBy: markerId,
            changedAt: now,
          },
        });
      }

      const res = await tx.result.upsert({
        where: {
          examId_studentId: { examId, studentId },
        },
        create: {
          instituteId,
          examId,
          studentId,
          marks,
          percentage,
          grade,
          status: passStatus,
          resultStatus: 'MARKED',
          teacherFeedback: feedback,
          markedBy: markerId,
          markedAt: now,
        },
        update: {
          marks,
          percentage,
          grade,
          status: passStatus,
          resultStatus: existing?.resultStatus === 'PUBLISHED' ? 'PUBLISHED' : 'MARKED',
          teacherFeedback: feedback,
          markedBy: markerId,
          markedAt: now,
        },
      });

      results.push(res);
    }
  });

  return results;
}

/**
 * Generate CSV Template with real eligible students and existing saved marks/feedback
 */
export function generateMarksCsvTemplate(exam, students, resultsMap = new Map()) {
  const headers = ['AdmissionNumber', 'StudentName', 'RollNo', 'Marks', 'Feedback'];
  const rows = students.map((s) => {
    const res = resultsMap.get(s.id);
    const marksVal = res?.marks !== undefined && res?.marks !== null ? res.marks : '';
    const rawFeedback = res?.teacherFeedback ? String(res.teacherFeedback) : '';
    const feedbackEscaped = rawFeedback ? `"${rawFeedback.replace(/"/g, '""')}"` : '""';

    return [
      `"${s.admissionNumber || s.id}"`,
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${s.rollNo || ''}"`,
      marksVal !== '' ? marksVal : '',
      feedbackEscaped,
    ];
  });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Phase 1: Parse and Validate Marks CSV (Dry Run / Preview)
 * MUST NOT persist to database
 */
export async function validateMarksCsv(exam, csvContent, eligibleStudents) {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) {
    throw new Error('CSV file is empty or missing data rows.');
  }

  const headerLine = lines[0];
  const headers = headerLine.split(',').map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

  const admissionIdx = headers.findIndex((h) => h.includes('admission') || h.includes('id'));
  const marksIdx = headers.findIndex((h) => h.includes('mark') || h.includes('score'));
  const feedbackIdx = headers.findIndex((h) => h.includes('feedback') || h.includes('comment'));
  const nameIdx = headers.findIndex((h) => h.includes('name'));

  if (admissionIdx === -1 || marksIdx === -1) {
    throw new Error('CSV must contain "AdmissionNumber" and "Marks" columns.');
  }

  const studentMap = new Map();
  eligibleStudents.forEach((s) => {
    if (s.admissionNumber) studentMap.set(String(s.admissionNumber).trim().toUpperCase(), s);
    studentMap.set(String(s.id), s);
  });

  const validRows = [];
  const invalidRows = [];
  const seenStudents = new Set();

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const cells = rawLine.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    const adm = cells[admissionIdx];
    const marksStr = cells[marksIdx];
    const feedback = feedbackIdx !== -1 ? cells[feedbackIdx] : '';
    const name = nameIdx !== -1 ? cells[nameIdx] : '';

    const rowNum = i + 1;

    if (!adm) {
      invalidRows.push({ row: rowNum, admissionNumber: adm, name, marks: marksStr, error: 'Missing Admission Number' });
      continue;
    }

    const matchedStudent = studentMap.get(String(adm).trim().toUpperCase());
    if (!matchedStudent) {
      invalidRows.push({ row: rowNum, admissionNumber: adm, name, marks: marksStr, error: `Student with Admission No "${adm}" is not enrolled in this exam class` });
      continue;
    }

    if (seenStudents.has(matchedStudent.id)) {
      invalidRows.push({ row: rowNum, admissionNumber: adm, name: matchedStudent.name, marks: marksStr, error: 'Duplicate student entry in CSV' });
      continue;
    }
    seenStudents.add(matchedStudent.id);

    if (marksStr === '' || marksStr === null || marksStr === undefined) {
      invalidRows.push({ row: rowNum, admissionNumber: adm, name: matchedStudent.name, marks: marksStr, error: 'Marks value is required' });
      continue;
    }

    const numMarks = Number(marksStr);
    if (isNaN(numMarks)) {
      invalidRows.push({ row: rowNum, admissionNumber: adm, name: matchedStudent.name, marks: marksStr, error: `Invalid numeric marks value: "${marksStr}"` });
      continue;
    }

    if (numMarks < 0) {
      invalidRows.push({ row: rowNum, admissionNumber: adm, name: matchedStudent.name, marks: marksStr, error: 'Marks cannot be negative' });
      continue;
    }

    if (numMarks > exam.totalMarks) {
      invalidRows.push({ row: rowNum, admissionNumber: adm, name: matchedStudent.name, marks: marksStr, error: `Marks (${numMarks}) exceed exam total marks (${exam.totalMarks})` });
      continue;
    }

    validRows.push({
      row: rowNum,
      studentId: matchedStudent.id,
      admissionNumber: matchedStudent.admissionNumber || String(matchedStudent.id),
      studentName: matchedStudent.name,
      marks: numMarks,
      feedback: feedback || null,
    });
  }

  return {
    totalRows: lines.length - 1,
    validRows,
    invalidRows,
    canImport: invalidRows.length === 0 && validRows.length > 0,
  };
}

/**
 * Phase 2: Confirm Import Marks CSV (Revalidates on confirm and persists in transaction)
 */
export async function confirmImportMarksCsv({ instituteId, examId, rows, markerId, reason = null }) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, instituteId },
    include: {
      class: {
        include: {
          studentEnrollments: {
            where: { status: 'ACTIVE' },
            include: { student: true },
          },
        },
      },
    },
  });

  if (!exam) {
    throw new Error('Exam not found or unauthorized.');
  }

  const eligibleStudents = (exam.class?.studentEnrollments || []).map((e) => e.student);
  const eligibleIds = new Set(eligibleStudents.map((s) => s.id));

  // Revalidate every row
  const validatedList = [];
  const seenIds = new Set();

  for (const r of rows) {
    const studentId = parseInt(r.studentId);
    if (!eligibleIds.has(studentId)) {
      throw new Error(`Security validation failed: Student ID ${studentId} does not belong to this exam.`);
    }

    if (seenIds.has(studentId)) {
      throw new Error(`Duplicate entry detected for Student ID ${studentId}.`);
    }
    seenIds.add(studentId);

    const marks = Number(r.marks);
    if (isNaN(marks) || marks < 0 || marks > exam.totalMarks) {
      throw new Error(`Marks validation failed for Student ID ${studentId}: Must be between 0 and ${exam.totalMarks}.`);
    }

    validatedList.push({
      studentId,
      marks,
      feedback: r.feedback || null,
    });
  }

  // Atomically persist
  return await bulkSaveMarks({
    instituteId,
    examId,
    marksList: validatedList,
    markerId,
    reason: reason || 'CSV Confirmed Import',
  });
}
