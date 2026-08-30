import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import prisma from '../config/prisma.js';
import {
  saveMarkingResult,
  publishResult,
  unpublishResult,
  publishAllMarkedResults,
  bulkSaveMarks,
  generateMarksCsvTemplate,
  validateMarksCsv,
  confirmImportMarksCsv,
  calculatePercentage,
  calculateGrade,
  calculatePassFail,
  getInstituteGradingRules,
} from '../services/result.service.js';
import { generateOfficialResultPdf } from '../services/resultPdf.service.js';
import { PROTECTED_WRITTEN_ANSWER_DIR } from '../middleware/upload.middleware.js';

/**
 * Helper: Validates actual file magic bytes on disk (preventing renamed .exe or spoofed files)
 */
export function validateFileMagicBytes(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { valid: false, type: 'missing' };
    const stat = fs.statSync(filePath);
    if (stat.size < 4) return { valid: false, type: 'too_small' };

    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    // PDF magic bytes: %PDF
    if (buffer.slice(0, 4).toString() === '%PDF') {
      return { valid: true, type: 'application/pdf', ext: '.pdf' };
    }

    // JPEG magic bytes: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return { valid: true, type: 'image/jpeg', ext: '.jpg' };
    }

    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0D &&
      buffer[5] === 0x0A &&
      buffer[6] === 0x1A &&
      buffer[7] === 0x0A
    ) {
      return { valid: true, type: 'image/png', ext: '.png' };
    }

    // WebP magic bytes: RIFF .... WEBP
    if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') {
      return { valid: true, type: 'image/webp', ext: '.webp' };
    }

    return { valid: false, type: 'unsupported' };
  } catch (err) {
    console.error('Error validating magic bytes:', err);
    return { valid: false, type: 'error' };
  }
}

/**
 * Helper: Compiles multiple images into a single A4 PDF preserving resolution & aspect ratio
 */
export async function compileImagesToPdf(imagePaths, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
      const writeStream = fs.createWriteStream(outputPath);

      doc.pipe(writeStream);

      for (const imgPath of imagePaths) {
        // Standard A4 dimensions: 595.28 x 841.89 points
        doc.addPage({ size: 'A4', margin: 20 });
        const printableWidth = 595.28 - 40; // 555.28
        const printableHeight = 841.89 - 40; // 801.89

        try {
          doc.image(imgPath, 20, 20, {
            fit: [printableWidth, printableHeight],
            align: 'center',
            valign: 'center',
          });
        } catch (imgErr) {
          console.error('Error inserting image into PDF:', imgErr);
        }
      }

      doc.end();

      writeStream.on('finish', () => resolve(outputPath));
      writeStream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Helper: Validates whether a teacher is authorized for an exam (Author or Assigned)
 */
export async function verifyTeacherExamAccess(teacherUserId, exam, instituteId) {
  const teacher = await prisma.teacher.findFirst({
    where: { userId: teacherUserId, instituteId },
  });

  if (!teacher) return false;
  if (exam.teacherId === teacher.id) return true;

  const isAssigned = await prisma.teacherAssignment.findFirst({
    where: {
      teacherId: teacher.id,
      classId: exam.classId,
      subjectId: exam.subjectId,
      instituteId,
    },
  });

  return Boolean(isAssigned);
}

/**
 * Helper: Finalizes an expired attempt server-side (Idempotent)
 */
export async function finalizeExpiredAttempt(attempt, exam = null) {
  if (!attempt || attempt.status !== 'IN_PROGRESS') return attempt;

  if (!exam) {
    exam = await prisma.exam.findUnique({
      where: { id: attempt.examId },
      include: { questions: true },
    });
  }

  if (!exam) return attempt;

  const now = new Date();
  const deadline = attempt.serverDeadline ? new Date(attempt.serverDeadline) : new Date(attempt.startedAt.getTime() + (exam.durationMinutes || 60) * 60000);

  // Check if expired
  if (now < deadline) {
    return attempt; // Not expired yet
  }

  // Handle WRITTEN Exam Timeout
  if (exam.examType === 'WRITTEN') {
    const updatedAttempt = await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'AUTO_SUBMITTED',
        submittedAt: deadline,
      },
      include: { student: true },
    });

    // Ensure Result record in PENDING state
    await prisma.result.upsert({
      where: {
        examId_studentId: {
          examId: exam.id,
          studentId: attempt.studentId,
        },
      },
      create: {
        instituteId: exam.instituteId,
        examId: exam.id,
        studentId: attempt.studentId,
        marks: 0,
        percentage: 0,
        status: 'FAIL',
        resultStatus: 'PENDING',
      },
      update: {},
    });

    return updatedAttempt;
  }

  // Load questions and answers for MCQ
  const questions = exam.questions || await prisma.examQuestion.findMany({ where: { examId: exam.id } });
  const savedAnswers = await prisma.examAnswer.findMany({ where: { attemptId: attempt.id } });
  const answerMap = new Map(savedAnswers.map((a) => [a.questionId, a]));

  let totalScore = 0;

  for (const q of questions) {
    const ans = answerMap.get(q.id);
    const selected = ans ? ans.answer : null;
    const isCorrect = selected && q.correctAnswer && String(selected).trim().toUpperCase() === String(q.correctAnswer).trim().toUpperCase();
    const marksAwarded = isCorrect ? (q.marks || 1) : 0;
    totalScore += marksAwarded;

    if (ans) {
      await prisma.examAnswer.update({
        where: { id: ans.id },
        data: { isCorrect, marksAwarded },
      });
    }
  }

  const percentage = exam.totalMarks > 0 ? (totalScore / exam.totalMarks) * 100 : 0;
  
  // Calculate Pass/Fail according to explicit passMarkType
  let isPassed = false;
  if (exam.passMarkType === 'PERCENTAGE') {
    isPassed = percentage >= (exam.passingMarks || 50);
  } else {
    // Default: MARKS
    isPassed = totalScore >= (exam.passingMarks || 0);
  }

  // Finalize attempt
  const updatedAttempt = await prisma.examAttempt.update({
    where: { id: attempt.id },
    data: {
      status: 'AUTO_SUBMITTED',
      submittedAt: deadline,
      score: totalScore,
      percentage: Math.round(percentage * 100) / 100,
      isPassed,
    },
    include: { student: true, answers: true },
  });

  // Upsert Result record
  await prisma.result.upsert({
    where: {
      examId_studentId: {
        examId: exam.id,
        studentId: attempt.studentId,
      },
    },
    create: {
      instituteId: exam.instituteId,
      examId: exam.id,
      studentId: attempt.studentId,
      marks: totalScore,
      percentage: Math.round(percentage * 100) / 100,
      status: isPassed ? 'PASS' : 'FAIL',
    },
    update: {
      marks: totalScore,
      percentage: Math.round(percentage * 100) / 100,
      status: isPassed ? 'PASS' : 'FAIL',
    },
  });

  return updatedAttempt;
}

/**
 * -------------------------------------------------------------
 * 1. Admin & Teacher: Exams List
 * -------------------------------------------------------------
 */
export const getExams = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const { classId, subjectId, academicYearId, status } = req.query;

    const where = { instituteId };

    if (classId) where.classId = parseInt(classId);
    if (subjectId) where.subjectId = parseInt(subjectId);
    if (academicYearId) where.academicYearId = parseInt(academicYearId);
    if (status && status !== 'all' && !['UPCOMING', 'LIVE', 'COMPLETED'].includes(status)) {
      where.status = status;
    }

    // Role-specific scoping for Teacher
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, instituteId },
      });

      if (!teacher) {
        return res.status(403).json({ success: false, message: 'Teacher profile not found.' });
      }

      // Teacher can see exams authored by them OR assigned to them via TeacherAssignment
      const assignments = await prisma.teacherAssignment.findMany({
        where: { teacherId: teacher.id, instituteId },
        select: { classId: true, subjectId: true },
      });

      const assignmentFilters = assignments.map((a) => ({
        classId: a.classId,
        subjectId: a.subjectId,
      }));

      where.OR = [
        { teacherId: teacher.id },
        ...(assignmentFilters.length > 0 ? assignmentFilters : [{ id: -1 }]),
      ];
    }

    const exams = await prisma.exam.findMany({
      where,
      include: {
        class: { select: { id: true, name: true, section: true } },
        subject: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, name: true, isCurrent: true } },
        teacher: { select: { id: true, name: true, employeeId: true } },
        _count: {
          select: {
            questions: true,
            attempts: true,
            results: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const enrichedExams = exams.map((exam) => {
      let dynamicStatus = exam.status; // 'DRAFT', 'CLOSED', 'ARCHIVED'
      if (exam.status === 'PUBLISHED') {
        const start = exam.startDateTime ? new Date(exam.startDateTime) : null;
        const end = exam.endDateTime ? new Date(exam.endDateTime) : null;
        if (end && now >= end) {
          dynamicStatus = 'COMPLETED';
        } else if (start && now < start) {
          dynamicStatus = 'UPCOMING';
        } else {
          dynamicStatus = 'LIVE';
        }
      } else if (exam.status === 'CLOSED') {
        dynamicStatus = 'COMPLETED';
      }
      return {
        ...exam,
        dynamicStatus,
      };
    });

    let filtered = enrichedExams;
    if (status && status !== 'all') {
      if (status === 'UPCOMING') {
        filtered = enrichedExams.filter((e) => e.dynamicStatus === 'UPCOMING');
      } else if (status === 'LIVE') {
        filtered = enrichedExams.filter((e) => e.dynamicStatus === 'LIVE');
      } else if (status === 'COMPLETED') {
        filtered = enrichedExams.filter((e) => e.dynamicStatus === 'COMPLETED' || e.status === 'CLOSED');
      } else if (status === 'DRAFT') {
        filtered = enrichedExams.filter((e) => e.status === 'DRAFT');
      } else if (status === 'PUBLISHED') {
        filtered = enrichedExams.filter((e) => e.status === 'PUBLISHED');
      }
    }

    res.json({ success: true, data: filtered });
  } catch (error) {
    console.error('Error fetching exams:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch exams.' });
  }
};

/**
 * -------------------------------------------------------------
 * 2. Admin & Teacher: Get Exam By ID
 * -------------------------------------------------------------
 */
export const getExamById = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
      include: {
        class: { select: { id: true, name: true, section: true } },
        subject: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, name: true, isCurrent: true } },
        teacher: { select: { id: true, name: true, employeeId: true } },
        questions: {
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: {
            questions: true,
            attempts: true,
            results: true,
          },
        },
      },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    // Teacher authorization check
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, instituteId },
      });

      if (!teacher) {
        return res.status(403).json({ success: false, message: 'Teacher profile not found.' });
      }

      const isAuthor = exam.teacherId === teacher.id;
      const isAssigned = await prisma.teacherAssignment.findFirst({
        where: {
          teacherId: teacher.id,
          classId: exam.classId,
          subjectId: exam.subjectId,
          instituteId,
        },
      });

      if (!isAuthor && !isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to view or manage this exam.',
        });
      }
    }

    const now = new Date();
    let dynamicStatus = exam.status;
    if (exam.status === 'PUBLISHED') {
      const start = exam.startDateTime ? new Date(exam.startDateTime) : null;
      const end = exam.endDateTime ? new Date(exam.endDateTime) : null;
      if (end && now >= end) {
        dynamicStatus = 'COMPLETED';
      } else if (start && now < start) {
        dynamicStatus = 'UPCOMING';
      } else {
        dynamicStatus = 'LIVE';
      }
    } else if (exam.status === 'CLOSED') {
      dynamicStatus = 'COMPLETED';
    }

    res.json({ success: true, data: { ...exam, dynamicStatus } });
  } catch (error) {
    console.error('Error fetching exam by ID:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch exam details.' });
  }
};

/**
 * -------------------------------------------------------------
 * 3. Create Live Exam (MCQ or Written)
 * -------------------------------------------------------------
 */
export const createExam = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const {
      title,
      description,
      instructions,
      academicYearId,
      classId,
      subjectId,
      totalMarks,
      passingMarks,
      passMarkType = 'MARKS',
      startDateTime,
      endDateTime,
      durationMinutes = 60,
      maxAttempts = 1,
      randomizeQuestions = false,
      randomizeOptions = false,
      publishResult = true,
      status = 'DRAFT',
      questions = [],
    } = req.body;

    if (!title || !classId || !subjectId || totalMarks === undefined || passingMarks === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Title, class, subject, total marks, and passing marks are required.',
      });
    }

    const cId = parseInt(classId);
    const sId = parseInt(subjectId);
    const ayId = academicYearId ? parseInt(academicYearId) : null;

    // Verify class and subject belong to tenant
    const targetClass = await prisma.class.findFirst({ where: { id: cId, instituteId } });
    const targetSubject = await prisma.subject.findFirst({ where: { id: sId, instituteId } });

    if (!targetClass || !targetSubject) {
      return res.status(400).json({ success: false, message: 'Invalid class or subject for this institute.' });
    }

    // Verify subject is mapped to class if classSubject records exist
    const classSubjectCount = await prisma.classSubject.count({
      where: { classId: cId, instituteId },
    });
    if (classSubjectCount > 0) {
      const isMapped = await prisma.classSubject.findFirst({
        where: { classId: cId, subjectId: sId, instituteId },
      });
      if (!isMapped) {
        return res.status(400).json({
          success: false,
          message: 'The selected subject is not mapped to this class.',
        });
      }
    }

    // Verify academic year belongs to institute if provided
    if (ayId) {
      const validYear = await prisma.academicYear.findFirst({
        where: { id: ayId, instituteId },
      });
      if (!validYear) {
        return res.status(400).json({
          success: false,
          message: 'Academic Year does not belong to this institute.',
        });
      }
    }

    let teacherId = null;

    // Teacher authorization verification
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, instituteId },
      });

      if (!teacher) {
        return res.status(403).json({ success: false, message: 'Teacher profile not found.' });
      }

      teacherId = teacher.id;

      // Verify TeacherAssignment
      const assignment = await prisma.teacherAssignment.findFirst({
        where: {
          teacherId: teacher.id,
          classId: cId,
          subjectId: sId,
          instituteId,
        },
      });

      if (!assignment) {
        return res.status(403).json({
          success: false,
          message: 'Teacher is not assigned to this class and subject.',
        });
      }
    } else if (req.body.teacherId) {
      const parsedTeacherId = parseInt(req.body.teacherId);
      const validTeacher = await prisma.teacher.findFirst({
        where: { id: parsedTeacherId, instituteId },
      });
      if (!validTeacher) {
        return res.status(400).json({ success: false, message: 'Selected teacher does not belong to this institute.' });
      }
      teacherId = parsedTeacherId;
    }

    // Validate passMarkType and marks
    const normalizedPassType = passMarkType === 'PERCENTAGE' ? 'PERCENTAGE' : 'MARKS';
    const parsedTotal = parseFloat(totalMarks);
    const parsedPass = parseFloat(passingMarks);

    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      return res.status(400).json({ success: false, message: 'Total marks must be greater than 0.' });
    }
    if (isNaN(parsedPass) || parsedPass < 0) {
      return res.status(400).json({ success: false, message: 'Pass marks cannot be negative.' });
    }
    if (normalizedPassType === 'PERCENTAGE' && parsedPass > 100) {
      return res.status(400).json({ success: false, message: 'Pass mark percentage must be between 0 and 100.' });
    }
    if (normalizedPassType === 'MARKS' && parsedPass > parsedTotal) {
      return res.status(400).json({ success: false, message: 'Pass marks cannot exceed total marks.' });
    }

    // Validate Schedule
    let startDt = null;
    let endDt = null;
    const parsedDuration = parseInt(durationMinutes) || 60;
    if (parsedDuration <= 0) {
      return res.status(400).json({ success: false, message: 'Duration must be greater than 0 minutes.' });
    }

    if (startDateTime && endDateTime) {
      startDt = new Date(startDateTime);
      endDt = new Date(endDateTime);
      if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid start or end date/time format.' });
      }
      if (startDt >= endDt) {
        return res.status(400).json({ success: false, message: 'End time must be after start time.' });
      }
      const windowMinutes = (endDt.getTime() - startDt.getTime()) / (1000 * 60);
      if (windowMinutes < parsedDuration) {
        return res.status(400).json({
          success: false,
          message: `Exam duration (${parsedDuration} mins) cannot exceed the scheduled window between start and end time (${Math.round(windowMinutes)} mins).`,
        });
      }
    } else if (startDateTime) {
      startDt = new Date(startDateTime);
      if (isNaN(startDt.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid start date/time format.' });
      }
    } else if (endDateTime) {
      endDt = new Date(endDateTime);
      if (isNaN(endDt.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid end date/time format.' });
      }
    }

    const examType = req.body.examType === 'WRITTEN' ? 'WRITTEN' : 'MCQ';

    // If publishing immediately as MCQ, validate questions
    const isPublishing = status === 'PUBLISHED';
    if (isPublishing && examType === 'MCQ') {
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot publish MCQ exam without questions. Please add at least one question.',
        });
      }

      let qMarksSum = 0;
      for (let idx = 0; idx < questions.length; idx++) {
        const q = questions[idx];
        if (!q.question || !q.question.trim()) {
          return res.status(400).json({ success: false, message: `Question #${idx + 1} is missing question text.` });
        }
        const opts = Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? JSON.parse(q.options) : []);
        if (!opts || opts.length < 2) {
          return res.status(400).json({ success: false, message: `Question #${idx + 1} must have at least 2 options.` });
        }
        if (!q.correctAnswer) {
          return res.status(400).json({ success: false, message: `Question #${idx + 1} must have a correct answer selected.` });
        }
        const qm = parseFloat(q.marks);
        if (isNaN(qm) || qm <= 0) {
          return res.status(400).json({ success: false, message: `Question #${idx + 1} marks must be greater than 0.` });
        }
        qMarksSum += qm;
      }

      if (Math.abs(qMarksSum - parsedTotal) > 0.01) {
        return res.status(400).json({
          success: false,
          message: `The sum of question marks (${qMarksSum}) must equal the exam total marks (${parsedTotal}).`,
        });
      }
    }

    // Atomic transaction for Exam + Questions
    const createdExam = await prisma.$transaction(async (tx) => {
      const exam = await tx.exam.create({
        data: {
          instituteId,
          academicYearId: ayId || targetClass.academicYearId,
          classId: cId,
          subjectId: sId,
          teacherId,
          title: title.trim(),
          description: description?.trim() || null,
          instructions: instructions?.trim() || null,
          examType,
          totalMarks: parsedTotal,
          passingMarks: parsedPass,
          passMarkType: normalizedPassType,
          startDateTime: startDt,
          endDateTime: endDt,
          examDate: startDt || new Date(),
          durationMinutes: parsedDuration,
          maxAttempts: parseInt(maxAttempts) || 1,
          randomizeQuestions: Boolean(randomizeQuestions),
          randomizeOptions: Boolean(randomizeOptions),
          publishResult: publishResult !== undefined ? Boolean(publishResult) : true,
          status: isPublishing ? 'PUBLISHED' : 'DRAFT',
        },
      });

      if (examType === 'MCQ' && Array.isArray(questions) && questions.length > 0) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const opts = Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? JSON.parse(q.options) : []);
          await tx.examQuestion.create({
            data: {
              examId: exam.id,
              question: (q.question || '').trim(),
              options: opts,
              correctAnswer: q.correctAnswer ? String(q.correctAnswer).trim() : null,
              marks: parseFloat(q.marks) || 1,
              explanation: q.explanation?.trim() || null,
              image: q.image || null,
              displayOrder: q.displayOrder !== undefined ? parseInt(q.displayOrder) : i + 1,
              questionType: q.questionType || 'MCQ_SINGLE',
            },
          });
        }
      }

      return tx.exam.findUnique({
        where: { id: exam.id },
        include: {
          class: { select: { id: true, name: true, section: true } },
          subject: { select: { id: true, name: true, code: true } },
          academicYear: { select: { id: true, name: true, isCurrent: true } },
          teacher: { select: { id: true, name: true } },
          questions: { orderBy: { displayOrder: 'asc' } },
          _count: { select: { questions: true, attempts: true } },
        },
      });
    });

    res.status(201).json({
      success: true,
      message: `${examType} Exam ${isPublishing ? 'published' : 'created as draft'} successfully.`,
      data: createdExam,
    });
  } catch (error) {
    console.error('Error creating exam:', error);
    res.status(500).json({ success: false, message: 'Failed to create exam.' });
  }
};

/**
 * -------------------------------------------------------------
 * 4. Update Exam (MCQ or Written)
 * -------------------------------------------------------------
 */
export const updateExam = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    const existing = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
      include: {
        _count: { select: { attempts: true } },
        questions: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    // Teacher check
    if (req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user.id, instituteId },
      });

      if (!teacher || (existing.teacherId !== teacher.id)) {
        // Also check if assigned
        const isAssigned = await prisma.teacherAssignment.findFirst({
          where: { teacherId: teacher?.id, classId: existing.classId, subjectId: existing.subjectId, instituteId },
        });

        if (!isAssigned) {
          return res.status(403).json({ success: false, message: 'Not authorized to modify this exam.' });
        }
      }
    }

    const {
      title,
      description,
      instructions,
      academicYearId,
      classId,
      subjectId,
      teacherId,
      totalMarks,
      passingMarks,
      passMarkType,
      startDateTime,
      endDateTime,
      durationMinutes,
      maxAttempts,
      randomizeQuestions,
      randomizeOptions,
      publishResult,
      status,
      questions,
    } = req.body;

    const hasAttempts = existing._count.attempts > 0;

    // Prevent changing class/subject if attempts exist
    if (hasAttempts && classId && parseInt(classId) !== existing.classId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change target class because students have already attempted this exam.',
      });
    }

    let targetClassId = existing.classId;
    let targetSubjectId = existing.subjectId;

    if (!hasAttempts && classId) {
      const cId = parseInt(classId);
      const validClass = await prisma.class.findFirst({ where: { id: cId, instituteId } });
      if (!validClass) return res.status(400).json({ success: false, message: 'Class not found in this institute.' });
      targetClassId = cId;
    }

    if (!hasAttempts && subjectId) {
      const sId = parseInt(subjectId);
      const validSubject = await prisma.subject.findFirst({ where: { id: sId, instituteId } });
      if (!validSubject) return res.status(400).json({ success: false, message: 'Subject not found in this institute.' });
      targetSubjectId = sId;
    }

    // Validate schedule if provided
    let startDt = existing.startDateTime;
    let endDt = existing.endDateTime;
    const durMins = durationMinutes !== undefined ? parseInt(durationMinutes) : existing.durationMinutes;

    if (startDateTime !== undefined) {
      startDt = startDateTime ? new Date(startDateTime) : null;
    }
    if (endDateTime !== undefined) {
      endDt = endDateTime ? new Date(endDateTime) : null;
    }

    if (startDt && endDt) {
      if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid start or end datetime format.' });
      }
      if (startDt >= endDt) {
        return res.status(400).json({ success: false, message: 'End time must be after start time.' });
      }
      const windowMinutes = (endDt.getTime() - startDt.getTime()) / (1000 * 60);
      if (windowMinutes < durMins) {
        return res.status(400).json({
          success: false,
          message: `Exam duration (${durMins} mins) cannot exceed the scheduled window (${Math.round(windowMinutes)} mins).`,
        });
      }
    }

    const parsedTotal = totalMarks !== undefined ? parseFloat(totalMarks) : existing.totalMarks;
    const parsedPass = passingMarks !== undefined ? parseFloat(passingMarks) : existing.passingMarks;
    const normalizedPassType = passMarkType !== undefined ? (passMarkType === 'PERCENTAGE' ? 'PERCENTAGE' : 'MARKS') : existing.passMarkType;

    if (parsedTotal <= 0) return res.status(400).json({ success: false, message: 'Total marks must be greater than 0.' });
    if (parsedPass < 0) return res.status(400).json({ success: false, message: 'Pass marks cannot be negative.' });
    if (normalizedPassType === 'MARKS' && parsedPass > parsedTotal) {
      return res.status(400).json({ success: false, message: 'Pass marks cannot exceed total marks.' });
    }
    if (normalizedPassType === 'PERCENTAGE' && parsedPass > 100) {
      return res.status(400).json({ success: false, message: 'Pass mark percentage must be between 0 and 100.' });
    }

    // Atomic update
    const updated = await prisma.$transaction(async (tx) => {
      const exam = await tx.exam.update({
        where: { id: examId },
        data: {
          title: title !== undefined ? title.trim() : existing.title,
          description: description !== undefined ? description?.trim() || null : existing.description,
          instructions: instructions !== undefined ? instructions?.trim() || null : existing.instructions,
          academicYearId: academicYearId !== undefined ? (academicYearId ? parseInt(academicYearId) : null) : existing.academicYearId,
          classId: targetClassId,
          subjectId: targetSubjectId,
          teacherId: teacherId !== undefined ? (teacherId ? parseInt(teacherId) : null) : existing.teacherId,
          totalMarks: parsedTotal,
          passingMarks: parsedPass,
          passMarkType: normalizedPassType,
          startDateTime: startDt,
          endDateTime: endDt,
          examDate: startDt || existing.examDate,
          durationMinutes: durMins,
          maxAttempts: maxAttempts !== undefined ? parseInt(maxAttempts) : existing.maxAttempts,
          randomizeQuestions: randomizeQuestions !== undefined ? Boolean(randomizeQuestions) : existing.randomizeQuestions,
          randomizeOptions: randomizeOptions !== undefined ? Boolean(randomizeOptions) : existing.randomizeOptions,
          publishResult: publishResult !== undefined ? Boolean(publishResult) : existing.publishResult,
          status: status !== undefined ? status : existing.status,
        },
      });

      // If questions are provided and no attempts exist, sync questions
      if (!hasAttempts && Array.isArray(questions)) {
        await tx.examQuestion.deleteMany({ where: { examId } });
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const opts = Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? JSON.parse(q.options) : []);
          await tx.examQuestion.create({
            data: {
              examId: exam.id,
              question: (q.question || '').trim(),
              options: opts,
              correctAnswer: q.correctAnswer ? String(q.correctAnswer).trim() : null,
              marks: parseFloat(q.marks) || 1,
              explanation: q.explanation?.trim() || null,
              image: q.image || null,
              displayOrder: q.displayOrder !== undefined ? parseInt(q.displayOrder) : i + 1,
              questionType: q.questionType || 'MCQ_SINGLE',
            },
          });
        }
      }

      return tx.exam.findUnique({
        where: { id: examId },
        include: {
          class: { select: { id: true, name: true, section: true } },
          subject: { select: { id: true, name: true, code: true } },
          academicYear: { select: { id: true, name: true, isCurrent: true } },
          teacher: { select: { id: true, name: true } },
          questions: { orderBy: { displayOrder: 'asc' } },
          _count: { select: { questions: true, attempts: true } },
        },
      });
    });

    res.json({
      success: true,
      message: 'Exam updated successfully.',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating exam:', error);
    res.status(500).json({ success: false, message: 'Failed to update exam.' });
  }
};

/**
 * -------------------------------------------------------------
 * 5. Safe Delete / Archive Exam
 * -------------------------------------------------------------
 */
export const deleteExam = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    const existing = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
      include: { _count: { select: { attempts: true } } },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    if (existing._count.attempts > 0) {
      // Soft-archive if attempts exist to protect student records
      await prisma.exam.update({
        where: { id: examId },
        data: { status: 'ARCHIVED' },
      });
      return res.json({
        success: true,
        archived: true,
        message: 'Exam has student attempts and was safely archived rather than hard deleted.',
      });
    }

    await prisma.exam.delete({ where: { id: examId } });

    res.json({
      success: true,
      message: 'Exam deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting exam:', error);
    res.status(500).json({ success: false, message: 'Failed to delete exam.' });
  }
};

/**
 * -------------------------------------------------------------
 * 6. Publish Exam (with Validation)
 * -------------------------------------------------------------
 */
export const publishExam = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
      include: { questions: true },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    // MCQ Question Validations only for MCQ exams
    if (exam.examType !== 'WRITTEN') {
      // 1. Check at least 1 question exists
      if (!exam.questions || exam.questions.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot publish exam without any questions. Please add at least one question.',
        });
      }

      // 2. Validate every question has options & a correct answer
      for (const q of exam.questions) {
        const options = Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? JSON.parse(q.options) : []);
        if (!options || options.length < 2) {
          return res.status(400).json({
            success: false,
            message: `Question "${q.question.slice(0, 30)}..." must have at least 2 options.`,
          });
        }

        if (!q.correctAnswer) {
          return res.status(400).json({
            success: false,
            message: `Question "${q.question.slice(0, 30)}..." does not have a correct answer selected.`,
          });
        }
      }

      // 3. Question marks validation
      const questionMarksSum = exam.questions.reduce((acc, q) => acc + (q.marks || 0), 0);
      if (Math.abs(questionMarksSum - exam.totalMarks) > 0.01) {
        return res.status(400).json({
          success: false,
          message: `Cannot publish exam: The sum of question marks (${questionMarksSum}) does not match the configured exam total marks (${exam.totalMarks}).`,
        });
      }
    }

    // 4. Pass mark validation
    if (exam.passMarkType === 'PERCENTAGE' && (exam.passingMarks < 0 || exam.passingMarks > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Passing mark percentage must be between 0 and 100.',
      });
    }

    if (exam.passMarkType === 'MARKS' && exam.passingMarks > exam.totalMarks) {
      return res.status(400).json({
        success: false,
        message: 'Passing mark cannot exceed total marks.',
      });
    }

    const published = await prisma.exam.update({
      where: { id: examId },
      data: { status: 'PUBLISHED' },
    });

    res.json({
      success: true,
      message: 'Exam published successfully. Eligible students can now see and take this exam.',
      data: published,
    });
  } catch (error) {
    console.error('Error publishing exam:', error);
    res.status(500).json({ success: false, message: 'Failed to publish exam.' });
  }
};

/**
 * -------------------------------------------------------------
 * 7. Close Exam
 * -------------------------------------------------------------
 */
export const closeExam = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    const closed = await prisma.exam.update({
      where: { id: examId },
      data: { status: 'CLOSED' },
    });

    res.json({
      success: true,
      message: 'Exam closed. New student attempts are now blocked.',
      data: closed,
    });
  } catch (error) {
    console.error('Error closing exam:', error);
    res.status(500).json({ success: false, message: 'Failed to close exam.' });
  }
};

/**
 * -------------------------------------------------------------
 * 8. Question Builder: Add Question
 * -------------------------------------------------------------
 */
export const addExamQuestion = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
      include: { _count: { select: { attempts: true } } },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    // Preserve attempt integrity: block editing questions if attempts exist
    if (exam._count.attempts > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add questions to an exam that has already been attempted by students.',
      });
    }

    const { question, options, correctAnswer, marks = 1, explanation, image, displayOrder } = req.body;

    if (!question || !options || !correctAnswer) {
      return res.status(400).json({
        success: false,
        message: 'Question text, options, and correct answer are required.',
      });
    }

    // Determine display order
    let order = displayOrder;
    if (order === undefined) {
      const maxOrder = await prisma.examQuestion.aggregate({
        where: { examId },
        _max: { displayOrder: true },
      });
      order = (maxOrder._max.displayOrder || 0) + 1;
    }

    const newQuestion = await prisma.examQuestion.create({
      data: {
        examId,
        question: question.trim(),
        options: Array.isArray(options) ? options : JSON.parse(options),
        correctAnswer: String(correctAnswer).trim(),
        marks: parseFloat(marks) || 1,
        explanation: explanation?.trim() || null,
        image: image || null,
        displayOrder: order,
        questionType: 'MCQ_SINGLE',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Question added successfully.',
      data: newQuestion,
    });
  } catch (error) {
    console.error('Error adding exam question:', error);
    res.status(500).json({ success: false, message: 'Failed to add question.' });
  }
};

/**
 * -------------------------------------------------------------
 * 9. Question Builder: Update Question
 * -------------------------------------------------------------
 */
export const updateExamQuestion = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);
    const questionId = parseInt(req.params.questionId);

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
      include: { _count: { select: { attempts: true } } },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    if (exam._count.attempts > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify questions for an exam with active or completed attempts.',
      });
    }

    const { question, options, correctAnswer, marks, explanation, image, displayOrder } = req.body;

    const updated = await prisma.examQuestion.update({
      where: { id: questionId },
      data: {
        question: question !== undefined ? question.trim() : undefined,
        options: options !== undefined ? (Array.isArray(options) ? options : JSON.parse(options)) : undefined,
        correctAnswer: correctAnswer !== undefined ? String(correctAnswer).trim() : undefined,
        marks: marks !== undefined ? parseFloat(marks) : undefined,
        explanation: explanation !== undefined ? explanation?.trim() || null : undefined,
        image: image !== undefined ? image : undefined,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder) : undefined,
      },
    });

    res.json({
      success: true,
      message: 'Question updated successfully.',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating exam question:', error);
    res.status(500).json({ success: false, message: 'Failed to update question.' });
  }
};

/**
 * -------------------------------------------------------------
 * 10. Question Builder: Delete Question
 * -------------------------------------------------------------
 */
export const deleteExamQuestion = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);
    const questionId = parseInt(req.params.questionId);

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
      include: { _count: { select: { attempts: true } } },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    if (exam._count.attempts > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete questions from an exam with existing attempts.',
      });
    }

    await prisma.examQuestion.delete({ where: { id: questionId } });

    res.json({
      success: true,
      message: 'Question deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting exam question:', error);
    res.status(500).json({ success: false, message: 'Failed to delete question.' });
  }
};

/**
 * -------------------------------------------------------------
 * 11. Student Portal: Eligible Exams
 * -------------------------------------------------------------
 */
export const getStudentExams = async (req, res) => {
  try {
    const instituteId = req.instituteId;

    const student = await prisma.student.findFirst({
      where: { userId: req.user.id, instituteId },
      include: {
        studentEnrollments: {
          where: { status: 'ACTIVE' },
        },
        studentSubjects: true,
      },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const enrolledClassIds = Array.from(
      new Set([
        ...student.studentEnrollments.map((e) => e.classId),
        student.classId,
      ].filter(Boolean))
    );

    if (enrolledClassIds.length === 0) {
      return res.json({
        success: true,
        data: { upcoming: [], available: [], completed: [] },
      });
    }

    const exams = await prisma.exam.findMany({
      where: {
        instituteId,
        classId: { in: enrolledClassIds },
        status: { in: ['PUBLISHED', 'CLOSED'] },
      },
      include: {
        class: { select: { id: true, name: true, section: true } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, name: true } },
        attempts: {
          where: { studentId: student.id },
          orderBy: { attemptNumber: 'desc' },
        },
        results: {
          where: { studentId: student.id },
        },
        _count: { select: { questions: true } },
      },
      orderBy: { startDateTime: 'asc' },
    });

    const now = new Date();
    const upcoming = [];
    const available = [];
    const completed = [];

    const assignedSubjectIds = student.subjectsConfigured
      ? new Set(student.studentSubjects.map((ss) => ss.subjectId))
      : null;

    for (const exam of exams) {
      // Per-student subject enrollment check
      if (student.subjectsConfigured && exam.subjectId) {
        if (!assignedSubjectIds.has(exam.subjectId)) {
          continue; // Student is not enrolled in this exam's subject
        }
      }

      const startTime = exam.startDateTime ? new Date(exam.startDateTime) : new Date(exam.createdAt);
      const endTime = exam.endDateTime ? new Date(exam.endDateTime) : null;
      const userAttempts = exam.attempts || [];
      const latestAttempt = userAttempts[0] || null;

      // Check if active in_progress attempt has expired
      if (latestAttempt && latestAttempt.status === 'IN_PROGRESS') {
        const finalized = await finalizeExpiredAttempt(latestAttempt, exam);
        if (finalized.status !== 'IN_PROGRESS') {
          userAttempts[0] = finalized;
        }
      }

      const activeAttempt = userAttempts.find((a) => a.status === 'IN_PROGRESS');
      const submittedAttempts = userAttempts.filter((a) => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED' || a.status === 'MARKED');

      const isClosed = exam.status === 'CLOSED' || (endTime && now >= endTime);
      const maxAttemptsReached = submittedAttempts.length >= exam.maxAttempts;

      const examPayload = {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        instructions: exam.instructions,
        class: exam.class,
        subject: exam.subject,
        teacher: exam.teacher,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
        passMarkType: exam.passMarkType,
        durationMinutes: exam.durationMinutes,
        maxAttempts: exam.maxAttempts,
        startDateTime: exam.startDateTime,
        endDateTime: exam.endDateTime,
        status: exam.status,
        questionCount: exam._count.questions,
        publishResult: Boolean(exam.publishResult || (exam.results.length > 0 && exam.results[0].resultStatus === 'PUBLISHED')),
        attemptsCount: userAttempts.length,
        hasActiveAttempt: Boolean(activeAttempt),
        activeAttemptId: activeAttempt ? activeAttempt.id : null,
        latestResult: (exam.publishResult || (exam.results.length > 0 && exam.results[0].resultStatus === 'PUBLISHED')) && exam.results.length > 0 ? exam.results[0] : null,
      };

      if (maxAttemptsReached || (isClosed && !activeAttempt)) {
        completed.push(examPayload);
      } else if (now < startTime) {
        upcoming.push(examPayload);
      } else {
        available.push(examPayload);
      }
    }

    res.json({
      success: true,
      data: { upcoming, available, completed },
    });
  } catch (error) {
    console.error('Error fetching student exams:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch student exams.' });
  }
};

/**
 * -------------------------------------------------------------
 * 11B. Student: Get Exam Instructions & Metadata (Pre-Attempt)
 * -------------------------------------------------------------
 */
export const getStudentExamInstructions = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    const student = await prisma.student.findFirst({
      where: { userId: req.user.id, instituteId },
      include: {
        studentEnrollments: { where: { status: 'ACTIVE' } },
        studentSubjects: true,
      },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, section: true } },
        teacher: { select: { id: true, name: true } },
        institute: { select: { id: true, name: true, logo: true, code: true } },
        attempts: {
          where: { studentId: student.id },
          orderBy: { attemptNumber: 'desc' },
        },
        _count: { select: { questions: true } },
      },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    if (exam.status !== 'PUBLISHED') {
      return res.status(400).json({ success: false, message: 'This exam is not published.' });
    }

    const isEnrolled = student.studentEnrollments.some((e) => e.classId === exam.classId) || student.classId === exam.classId;
    if (!isEnrolled) {
      return res.status(403).json({ success: false, message: 'You are not enrolled in the class for this exam.' });
    }

    if (student.subjectsConfigured && exam.subjectId) {
      const isEnrolledInSubject = student.studentSubjects.some((ss) => ss.subjectId === exam.subjectId);
      if (!isEnrolledInSubject) {
        return res.status(403).json({ success: false, message: 'You are not enrolled in the subject for this exam.' });
      }
    }

    const activeAttempt = (exam.attempts || []).find((a) => a.status === 'IN_PROGRESS');

    res.json({
      success: true,
      data: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        instructions: exam.instructions,
        examType: exam.examType,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
        passMarkType: exam.passMarkType,
        durationMinutes: exam.durationMinutes,
        startDateTime: exam.startDateTime,
        endDateTime: exam.endDateTime,
        maxAttempts: exam.maxAttempts,
        questionCount: exam._count.questions,
        subject: exam.subject,
        class: exam.class,
        teacher: exam.teacher,
        institute: exam.institute,
        hasActiveAttempt: Boolean(activeAttempt),
        activeAttemptId: activeAttempt ? activeAttempt.id : null,
      },
    });
  } catch (error) {
    console.error('Error fetching student exam instructions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch exam instructions.' });
  }
};

/**
 * -------------------------------------------------------------
 * 12. Student: Start or Resume Timed Exam
 * -------------------------------------------------------------
 */
export const startOrResumeStudentExam = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    const student = await prisma.student.findFirst({
      where: { userId: req.user.id, instituteId },
      include: {
        studentEnrollments: { where: { status: 'ACTIVE' } },
        studentSubjects: true,
      },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
      include: {
        questions: true,
        institute: {
          select: { id: true, name: true, code: true, logo: true },
        },
      },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    if (exam.status !== 'PUBLISHED') {
      return res.status(400).json({ success: false, message: 'This exam is not currently available.' });
    }

    // Verify student enrollment in target class
    const isEnrolled = student.studentEnrollments.some((e) => e.classId === exam.classId) || student.classId === exam.classId;
    if (!isEnrolled) {
      return res.status(403).json({
        success: false,
        message: 'You are not enrolled in the class for this exam.',
      });
    }

    if (student.subjectsConfigured && exam.subjectId) {
      const isEnrolledInSubject = student.studentSubjects.some((ss) => ss.subjectId === exam.subjectId);
      if (!isEnrolledInSubject) {
        return res.status(403).json({
          success: false,
          message: 'You are not enrolled in the subject for this exam.',
        });
      }
    }

    const now = new Date();

    // Check Start Time
    if (exam.startDateTime && now < new Date(exam.startDateTime)) {
      return res.status(400).json({
        success: false,
        message: 'This exam has not started yet.',
      });
    }

    // Check End Time
    if (exam.endDateTime && now >= new Date(exam.endDateTime)) {
      return res.status(400).json({
        success: false,
        message: 'This exam is no longer available (submission window closed).',
      });
    }

    // Find existing attempts
    const existingAttempts = await prisma.examAttempt.findMany({
      where: { examId, studentId: student.id },
      orderBy: { attemptNumber: 'asc' },
    });

    let currentAttempt = existingAttempts.find((a) => a.status === 'IN_PROGRESS');

    if (currentAttempt) {
      // Check if existing attempt has expired
      currentAttempt = await finalizeExpiredAttempt(currentAttempt, exam);

      if (currentAttempt.status !== 'IN_PROGRESS') {
        return res.status(400).json({
          success: false,
          message: 'Your previous exam attempt has timed out and was automatically submitted.',
        });
      }
    } else {
      // No active attempt: verify attempt count limit
      const completedCount = existingAttempts.filter((a) => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED').length;
      if (completedCount >= exam.maxAttempts) {
        return res.status(400).json({
          success: false,
          message: `You have reached the maximum attempt limit (${exam.maxAttempts}) for this exam.`,
        });
      }

      // Calculate authoritative server deadline
      const startedAt = now;
      const durationMs = (exam.durationMinutes || 60) * 60000;
      let serverDeadline = new Date(startedAt.getTime() + durationMs);

      if (exam.endDateTime && serverDeadline > new Date(exam.endDateTime)) {
        serverDeadline = new Date(exam.endDateTime);
      }

      // Question order randomization
      let questionIds = exam.questions.map((q) => q.id);
      if (exam.randomizeQuestions) {
        // Fisher-Yates shuffle
        for (let i = questionIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [questionIds[i], questionIds[j]] = [questionIds[j], questionIds[i]];
        }
      } else {
        exam.questions.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        questionIds = exam.questions.map((q) => q.id);
      }

      // Option order randomization per question
      const optionOrder = {};
      for (const q of exam.questions) {
        let opts = Array.isArray(q.options) ? [...q.options] : JSON.parse(q.options || '[]');
        if (exam.randomizeOptions && opts.length > 0) {
          for (let i = opts.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [opts[i], opts[j]] = [opts[j], opts[i]];
          }
        }
        optionOrder[q.id] = opts.map((o) => (typeof o === 'object' ? o.id || o.key || o.text : o));
      }

      currentAttempt = await prisma.examAttempt.create({
        data: {
          instituteId,
          examId,
          studentId: student.id,
          attemptNumber: existingAttempts.length + 1,
          startedAt,
          serverDeadline,
          status: 'IN_PROGRESS',
          questionOrder: questionIds,
          optionOrder,
        },
      });
    }

    // Build question list according to persisted attempt questionOrder and optionOrder
    const rawQuestionsMap = new Map(exam.questions.map((q) => [q.id, q]));
    const qIds = Array.isArray(currentAttempt.questionOrder)
      ? currentAttempt.questionOrder
      : exam.questions.map((q) => q.id);
    const optOrders = currentAttempt.optionOrder || {};

    const studentQuestions = [];

    for (const qId of qIds) {
      const q = rawQuestionsMap.get(qId);
      if (!q) continue;

      let opts = Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]');
      const customOptOrder = optOrders[q.id];

      if (customOptOrder && Array.isArray(customOptOrder)) {
        // Reorder opts to match customOptOrder
        const optMap = new Map(opts.map((o) => [(typeof o === 'object' ? o.id || o.key || o.text : o), o]));
        const sortedOpts = [];
        for (const key of customOptOrder) {
          if (optMap.has(key)) sortedOpts.push(optMap.get(key));
        }
        // append any remaining
        for (const o of opts) {
          if (!sortedOpts.includes(o)) sortedOpts.push(o);
        }
        opts = sortedOpts;
      }

      // CRITICAL: NEVER EXPOSE correctAnswer or explanation to Student frontend!
      studentQuestions.push({
        id: q.id,
        question: q.question,
        image: q.image,
        marks: q.marks,
        displayOrder: q.displayOrder,
        options: opts,
      });
    }

    // Load saved answers for this attempt
    const savedAnswers = await prisma.examAnswer.findMany({
      where: { attemptId: currentAttempt.id },
      select: { questionId: true, answer: true, updatedAt: true },
    });

    const remainingMs = Math.max(0, new Date(currentAttempt.serverDeadline).getTime() - Date.now());
    const remainingSeconds = Math.floor(remainingMs / 1000);

    res.json({
      success: true,
      data: {
        attemptId: currentAttempt.id,
        attemptNumber: currentAttempt.attemptNumber,
        startedAt: currentAttempt.startedAt,
        serverDeadline: currentAttempt.serverDeadline,
        remainingSeconds,
        questions: studentQuestions,
        savedAnswers: savedAnswers.reduce((acc, curr) => {
          acc[curr.questionId] = curr.answer;
          return acc;
        }, {}),
        exam: {
          id: exam.id,
          title: exam.title,
          description: exam.description,
          instructions: exam.instructions,
          totalMarks: exam.totalMarks,
          passingMarks: exam.passingMarks,
          passMarkType: exam.passMarkType,
          durationMinutes: exam.durationMinutes,
          institute: exam.institute,
        },
      },
    });
  } catch (error) {
    console.error('Error starting student exam:', error);
    res.status(500).json({ success: false, message: 'Failed to start or resume exam attempt.' });
  }
};

/**
 * -------------------------------------------------------------
 * 13. Student: Incremental Answer Saving
 * -------------------------------------------------------------
 */
export const saveStudentAnswer = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);
    const questionId = parseInt(req.params.questionId);
    const { answer } = req.body;

    const student = await prisma.student.findFirst({
      where: { userId: req.user.id, instituteId },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const attempt = await prisma.examAttempt.findFirst({
      where: { examId, studentId: student.id, status: 'IN_PROGRESS' },
    });

    if (!attempt) {
      return res.status(400).json({
        success: false,
        message: 'No active in-progress exam attempt found.',
      });
    }

    // Authoritative Server Deadline Check
    const now = new Date();
    if (attempt.serverDeadline && now >= new Date(attempt.serverDeadline)) {
      await finalizeExpiredAttempt(attempt);
      return res.status(400).json({
        success: false,
        code: 'EXAM_TIMEOUT',
        message: 'Exam time has expired. Your attempt has been automatically submitted.',
      });
    }

    // Verify question belongs to this exam
    const question = await prisma.examQuestion.findFirst({
      where: { id: questionId, examId },
    });

    if (!question) {
      return res.status(400).json({
        success: false,
        message: 'Question does not belong to this examination.',
      });
    }

    // If options are configured, ensure answer is a valid option key
    if (question.options) {
      const opts = Array.isArray(question.options) ? question.options : JSON.parse(question.options || '[]');
      const validKeys = opts.map((o) => (typeof o === 'object' ? String(o.id || o.key || o.text) : String(o)));
      if (validKeys.length > 0 && !validKeys.includes(String(answer))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid option selected for this question.',
        });
      }
    }

    // Upsert answer
    await prisma.examAnswer.upsert({
      where: {
        attemptId_questionId: {
          attemptId: attempt.id,
          questionId,
        },
      },
      create: {
        attemptId: attempt.id,
        questionId,
        answer: String(answer || ''),
      },
      update: {
        answer: String(answer || ''),
        updatedAt: now,
      },
    });

    res.json({
      success: true,
      savedAt: now,
      questionId,
    });
  } catch (error) {
    console.error('Error saving student answer:', error);
    res.status(500).json({ success: false, message: 'Failed to save answer.' });
  }
};

/**
 * -------------------------------------------------------------
 * 14. Student: Submit Exam & Auto-Grading
 * -------------------------------------------------------------
 */
export const submitStudentExam = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    const student = await prisma.student.findFirst({
      where: { userId: req.user.id, instituteId },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const attempt = await prisma.examAttempt.findFirst({
      where: { examId, studentId: student.id, status: 'IN_PROGRESS' },
    });

    if (!attempt) {
      // Check if already submitted
      const submitted = await prisma.examAttempt.findFirst({
        where: { examId, studentId: student.id },
        orderBy: { attemptNumber: 'desc' },
      });

      if (submitted && (submitted.status === 'SUBMITTED' || submitted.status === 'AUTO_SUBMITTED')) {
        return res.json({
          success: true,
          message: 'Exam already submitted.',
          data: {
            score: submitted.score,
            percentage: submitted.percentage,
            isPassed: submitted.isPassed,
            status: submitted.status,
          },
        });
      }

      return res.status(400).json({ success: false, message: 'No active attempt found to submit.' });
    }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: true },
    });

    const now = new Date();
    const isTimeout = attempt.serverDeadline && now > new Date(attempt.serverDeadline);
    const finalStatus = isTimeout ? 'AUTO_SUBMITTED' : 'SUBMITTED';

    // Grade all saved answers against server-side true correct answers
    const savedAnswers = await prisma.examAnswer.findMany({
      where: { attemptId: attempt.id },
    });
    const answerMap = new Map(savedAnswers.map((a) => [a.questionId, a]));

    let totalScore = 0;
    let correctCount = 0;

    for (const q of exam.questions) {
      const ans = answerMap.get(q.id);
      const selected = ans ? ans.answer : null;
      const isCorrect = selected && q.correctAnswer && String(selected).trim().toUpperCase() === String(q.correctAnswer).trim().toUpperCase();
      const marksAwarded = isCorrect ? (q.marks || 1) : 0;

      totalScore += marksAwarded;
      if (isCorrect) correctCount++;

      if (ans) {
        await prisma.examAnswer.update({
          where: { id: ans.id },
          data: { isCorrect, marksAwarded },
        });
      }
    }

    const percentage = exam.totalMarks > 0 ? (totalScore / exam.totalMarks) * 100 : 0;
    
    // Explicit pass mark calculation
    let isPassed = false;
    if (exam.passMarkType === 'PERCENTAGE') {
      isPassed = percentage >= (exam.passingMarks || 50);
    } else {
      isPassed = totalScore >= (exam.passingMarks || 0);
    }

    const finalizedAttempt = await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        status: finalStatus,
        submittedAt: now,
        score: totalScore,
        percentage: Math.round(percentage * 100) / 100,
        isPassed,
      },
    });

    // Record Result
    await prisma.result.upsert({
      where: {
        examId_studentId: {
          examId: exam.id,
          studentId: student.id,
        },
      },
      create: {
        instituteId,
        examId: exam.id,
        studentId: student.id,
        marks: totalScore,
        percentage: Math.round(percentage * 100) / 100,
        status: isPassed ? 'PASS' : 'FAIL',
      },
      update: {
        marks: totalScore,
        percentage: Math.round(percentage * 100) / 100,
        status: isPassed ? 'PASS' : 'FAIL',
      },
    });

    // Result Release response
    if (exam.publishResult) {
      res.json({
        success: true,
        message: 'Exam submitted successfully.',
        data: {
          score: totalScore,
          totalMarks: exam.totalMarks,
          percentage: Math.round(percentage * 100) / 100,
          isPassed,
          passMarkType: exam.passMarkType,
          passingMarks: exam.passingMarks,
          status: finalStatus,
          correctCount,
          totalQuestions: exam.questions.length,
        },
      });
    } else {
      res.json({
        success: true,
        message: 'Exam submitted successfully. Results will be released by your instructor.',
        data: {
          status: finalStatus,
          submittedAt: now,
        },
      });
    }
  } catch (error) {
    console.error('Error submitting student exam:', error);
    res.status(500).json({ success: false, message: 'Failed to submit exam.' });
  }
};

/**
 * -------------------------------------------------------------
 * 15. Student: Get Exam Result
 * -------------------------------------------------------------
 */
export const getStudentExamResult = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    const student = await prisma.student.findFirst({
      where: { userId: req.user.id, instituteId },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, section: true } },
      },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    if (!exam.publishResult) {
      return res.json({
        success: true,
        published: false,
        message: 'Exam results have not been released by the instructor yet.',
      });
    }

    const attempt = await prisma.examAttempt.findFirst({
      where: { examId, studentId: student.id },
      orderBy: { attemptNumber: 'desc' },
      include: { answers: true },
    });

    const result = await prisma.result.findFirst({
      where: { examId, studentId: student.id },
    });

    res.json({
      success: true,
      published: true,
      data: {
        exam,
        attempt,
        result,
      },
    });
  } catch (error) {
    console.error('Error fetching student result:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch exam result.' });
  }
};

/**
 * -------------------------------------------------------------
 * 16. Admin & Teacher: Exam Attempts & Live Monitor
 * -------------------------------------------------------------
 */
export const getExamAttempts = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    const attempts = await prisma.examAttempt.findMany({
      where: { examId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            admissionNumber: true,
            rollNo: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Check for any expired in_progress attempts and finalize on the fly
    for (let i = 0; i < attempts.length; i++) {
      if (attempts[i].status === 'IN_PROGRESS') {
        const finalized = await finalizeExpiredAttempt(attempts[i], exam);
        attempts[i] = finalized;
      }
    }

    res.json({ success: true, data: attempts });
  } catch (error) {
    console.error('Error fetching exam attempts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch attempts.' });
  }
};

/**
 * -------------------------------------------------------------
 * 17. Admin & Teacher: Exam Real-Time Analytics
 * -------------------------------------------------------------
 */
export const getExamAnalytics = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

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
        attempts: true,
        results: true,
      },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    const totalEligible = exam.class?.studentEnrollments?.length || 0;
    const attemptedStudentIds = new Set(exam.attempts.map((a) => a.studentId));
    const totalAttempted = attemptedStudentIds.size;
    const notAttempted = Math.max(0, totalEligible - totalAttempted);

    const scores = exam.results.map((r) => r.marks).filter((m) => m !== null && m !== undefined);
    const averageScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0;
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

    const passCount = exam.results.filter((r) => r.status === 'PASS').length;
    const failCount = exam.results.filter((r) => r.status === 'FAIL').length;
    const passRate = exam.results.length > 0 ? Math.round((passCount / exam.results.length) * 100) : 0;

    // Score distribution bins
    const distribution = [
      { range: '0-39%', count: 0 },
      { range: '40-59%', count: 0 },
      { range: '60-79%', count: 0 },
      { range: '80-100%', count: 0 },
    ];

    for (const r of exam.results) {
      const pct = r.percentage !== null && r.percentage !== undefined ? r.percentage : (exam.totalMarks > 0 ? (r.marks / exam.totalMarks) * 100 : 0);
      if (pct < 40) distribution[0].count++;
      else if (pct < 60) distribution[1].count++;
      else if (pct < 80) distribution[2].count++;
      else distribution[3].count++;
    }

    res.json({
      success: true,
      data: {
        totalEligible,
        totalAttempted,
        notAttempted,
        averageScore,
        highestScore,
        lowestScore,
        passCount,
        failCount,
        passRate,
        distribution,
      },
    });
  } catch (error) {
    console.error('Error fetching exam analytics:', error);
    res.status(500).json({ success: false, message: 'Failed to generate exam analytics.' });
  }
};

/**
 * -------------------------------------------------------------
 * 18. Parent Portal: Child Released Exam Results
 * -------------------------------------------------------------
 */
export const getParentChildExamResults = async (req, res) => {
  try {
    const instituteId = req.instituteId;

    const parent = await prisma.parent.findFirst({
      where: { userId: req.user.id, instituteId },
      include: {
        students: {
          include: {
            student: {
              include: {
                results: {
                  where: {
                    OR: [
                      { resultStatus: 'PUBLISHED' },
                      { exam: { publishResult: true } },
                    ],
                    exam: { instituteId },
                  },
                  include: {
                    exam: {
                      select: {
                        id: true,
                        title: true,
                        totalMarks: true,
                        passingMarks: true,
                        passMarkType: true,
                        subject: { select: { name: true, code: true } },
                        class: { select: { name: true, section: true } },
                        startDateTime: true,
                      },
                    },
                  },
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
          },
        },
      },
    });

    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent guardian profile not found.' });
    }

    const childrenResults = (parent.students || []).map((c) => ({
      childId: c.student.id,
      childName: c.student.name,
      admissionNumber: c.student.admissionNumber,
      results: c.student.results,
    }));

    res.json({ success: true, data: childrenResults });
  } catch (error) {
    console.error('Error fetching parent child results:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch exam results for linked children.' });
  }
};

/**
 * -------------------------------------------------------------
 * 18B. Parent Portal: Child Online Examinations (Upcoming / Available / Completed)
 * -------------------------------------------------------------
 */
export const getParentChildExams = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const studentIdParam = req.params.studentId || req.query.studentId;
    const studentId = studentIdParam ? parseInt(studentIdParam) : null;

    const parent = await prisma.parent.findFirst({
      where: { userId: req.user.id, instituteId },
      include: {
        students: {
          include: {
            student: {
              include: {
                studentEnrollments: { where: { status: 'ACTIVE' } },
                studentSubjects: true,
              },
            },
          },
        },
      },
    });

    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent guardian profile not found.' });
    }

    let targetChild = null;
    if (studentId) {
      const match = parent.students.find((s) => s.student.id === studentId);
      if (!match) {
        return res.status(403).json({ success: false, message: 'Access denied. Student is not linked to your parent account.' });
      }
      targetChild = match.student;
    } else if (parent.students.length > 0) {
      targetChild = parent.students[0].student;
    }

    if (!targetChild) {
      return res.json({
        success: true,
        data: { upcoming: [], available: [], completed: [] },
      });
    }

    const enrolledClassIds = Array.from(
      new Set([
        ...targetChild.studentEnrollments.map((e) => e.classId),
        targetChild.classId,
      ].filter(Boolean))
    );

    if (enrolledClassIds.length === 0) {
      return res.json({
        success: true,
        data: { upcoming: [], available: [], completed: [] },
      });
    }

    const exams = await prisma.exam.findMany({
      where: {
        instituteId,
        classId: { in: enrolledClassIds },
        status: { in: ['PUBLISHED', 'CLOSED'] },
      },
      include: {
        class: { select: { id: true, name: true, section: true } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, name: true } },
        attempts: {
          where: { studentId: targetChild.id },
          orderBy: { attemptNumber: 'desc' },
        },
        results: {
          where: { studentId: targetChild.id },
        },
        _count: { select: { questions: true } },
      },
      orderBy: { startDateTime: 'asc' },
    });

    const now = new Date();
    const upcoming = [];
    const available = [];
    const completed = [];

    const assignedSubjectIds = targetChild.subjectsConfigured
      ? new Set(targetChild.studentSubjects.map((ss) => ss.subjectId))
      : null;

    for (const exam of exams) {
      // Per-student subject enrollment check
      if (targetChild.subjectsConfigured && exam.subjectId) {
        if (!assignedSubjectIds.has(exam.subjectId)) {
          continue; // Student is not enrolled in this exam's subject
        }
      }
      const startTime = exam.startDateTime ? new Date(exam.startDateTime) : new Date(exam.createdAt);
      const endTime = exam.endDateTime ? new Date(exam.endDateTime) : null;
      const userAttempts = exam.attempts || [];
      const submittedAttempts = userAttempts.filter((a) => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED');

      const isClosed = exam.status === 'CLOSED' || (endTime && now >= endTime);
      const maxAttemptsReached = submittedAttempts.length >= exam.maxAttempts;

      const examPayload = {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        instructions: exam.instructions,
        class: exam.class,
        subject: exam.subject,
        teacher: exam.teacher,
        examType: exam.examType,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
        passMarkType: exam.passMarkType,
        durationMinutes: exam.durationMinutes,
        maxAttempts: exam.maxAttempts,
        startDateTime: exam.startDateTime,
        endDateTime: exam.endDateTime,
        status: exam.status,
        questionCount: exam._count.questions,
        publishResult: exam.publishResult,
        attemptsCount: userAttempts.length,
        hasAttempted: userAttempts.length > 0,
        latestResult: exam.publishResult && exam.results.length > 0 ? exam.results[0] : null,
      };

      if (maxAttemptsReached || isClosed) {
        completed.push(examPayload);
      } else if (now < startTime) {
        upcoming.push(examPayload);
      } else {
        available.push(examPayload);
      }
    }

    return res.json({
      success: true,
      data: { upcoming, available, completed },
    });
  } catch (error) {
    console.error('Error fetching parent child exams:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch online examinations for linked child.' });
  }
};

/**
 * -------------------------------------------------------------
 * 19. Student: Stage or Submit Written Exam Answer Paper (PDF / Images)
 * -------------------------------------------------------------
 */
function cleanupRequestFiles(req) {
  const filesToDelete = [];
  if (req.file?.path) filesToDelete.push(req.file.path);
  if (req.files) {
    if (Array.isArray(req.files)) {
      req.files.forEach((f) => f.path && filesToDelete.push(f.path));
    } else {
      Object.values(req.files).forEach((arr) => {
        if (Array.isArray(arr)) arr.forEach((f) => f.path && filesToDelete.push(f.path));
      });
    }
  }
  filesToDelete.forEach((p) => {
    try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {}
  });
}

export const submitWrittenExamAnswer = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    // Extract all uploaded files (single file or array of images/files)
    const allFiles = [];
    if (req.file) allFiles.push(req.file);
    if (req.files) {
      if (Array.isArray(req.files)) {
        allFiles.push(...req.files);
      } else {
        if (Array.isArray(req.files.file)) allFiles.push(...req.files.file);
        if (Array.isArray(req.files.images)) allFiles.push(...req.files.images);
      }
    }

    if (allFiles.length === 0) {
      return res.status(400).json({ success: false, message: 'No answer file or images uploaded. Please select a PDF or answer photos.' });
    }

    // Check total request size limit: 35 MB
    const totalBytes = allFiles.reduce((acc, f) => acc + (f.size || 0), 0);
    const MAX_TOTAL_BYTES = 35 * 1024 * 1024;
    if (totalBytes > MAX_TOTAL_BYTES) {
      cleanupRequestFiles(req);
      return res.status(400).json({
        success: false,
        message: `Total answer file size (${Math.round(totalBytes / 1024 / 1024)}MB) exceeds the maximum allowed limit (35MB). Please compress your images or reduce the page count.`,
      });
    }

    const student = await prisma.student.findFirst({
      where: { userId: req.user.id, instituteId },
      include: {
        studentSubjects: true,
      },
    });

    if (!student) {
      cleanupRequestFiles(req);
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
      include: {
        class: {
          include: {
            studentEnrollments: {
              where: { studentId: student.id, status: 'ACTIVE' },
            },
          },
        },
      },
    });

    if (!exam) {
      cleanupRequestFiles(req);
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    if (exam.status !== 'PUBLISHED') {
      cleanupRequestFiles(req);
      return res.status(400).json({ success: false, message: 'This examination is currently not open for submissions.' });
    }

    if (exam.examType !== 'WRITTEN') {
      cleanupRequestFiles(req);
      return res.status(400).json({ success: false, message: 'This examination is an MCQ exam and does not accept written answer uploads.' });
    }

    const isEnrolled = (exam.class?.studentEnrollments?.length > 0) || student.classId === exam.classId;
    if (!isEnrolled) {
      cleanupRequestFiles(req);
      return res.status(403).json({ success: false, message: 'You are not enrolled in this exam class.' });
    }

    if (student.subjectsConfigured && exam.subjectId) {
      const isEnrolledInSubject = student.studentSubjects.some((ss) => ss.subjectId === exam.subjectId);
      if (!isEnrolledInSubject) {
        cleanupRequestFiles(req);
        return res.status(403).json({ success: false, message: 'You are not enrolled in the subject for this exam.' });
      }
    }

    // Validate active attempt & deadline
    let attempt = await prisma.examAttempt.findFirst({
      where: { examId, studentId: student.id, instituteId },
      orderBy: { attemptNumber: 'desc' },
    });

    const now = new Date();

    if (attempt && (attempt.status === 'SUBMITTED' || attempt.status === 'AUTO_SUBMITTED' || attempt.status === 'MARKED')) {
      cleanupRequestFiles(req);
      return res.status(400).json({
        success: false,
        code: 'ALREADY_SUBMITTED',
        message: 'This examination has already been permanently submitted and cannot be modified.',
      });
    }

    // Check Server Deadline
    let deadline = attempt?.serverDeadline ? new Date(attempt.serverDeadline) : null;
    if (!deadline) {
      const durationMs = (exam.durationMinutes || 60) * 60000;
      deadline = new Date(now.getTime() + durationMs);
      if (exam.endDateTime && deadline > new Date(exam.endDateTime)) {
        deadline = new Date(exam.endDateTime);
      }
    }

    if (now >= deadline) {
      cleanupRequestFiles(req);
      if (attempt) await finalizeExpiredAttempt(attempt, exam);
      return res.status(400).json({
        success: false,
        code: 'EXAM_TIMEOUT',
        message: 'The examination time has expired. New answer uploads are no longer accepted.',
      });
    }

    // Validate magic bytes on all files to prevent renamed .exe or spoofed files
    for (const f of allFiles) {
      const mb = validateFileMagicBytes(f.path);
      if (!mb.valid) {
        cleanupRequestFiles(req);
        return res.status(400).json({
          success: false,
          message: `The file "${f.originalname}" is corrupted or contains an unsupported format signature. Only valid PDF, JPG, and PNG documents are allowed.`,
        });
      }
    }

    let finalFilename = '';
    let finalOriginalName = '';
    let finalMimeType = 'application/pdf';
    let finalSize = 0;

    // Case 1: Single direct PDF upload
    if (allFiles.length === 1 && (allFiles[0].mimetype === 'application/pdf' || path.extname(allFiles[0].originalname).toLowerCase() === '.pdf')) {
      const pdfFile = allFiles[0];
      finalFilename = path.basename(pdfFile.path);
      finalOriginalName = pdfFile.originalname;
      finalMimeType = 'application/pdf';
      finalSize = pdfFile.size;
    } else {
      // Case 2: One or multiple images -> compile into single A4 PDF via PDFKit
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      finalFilename = `written_exam_${examId}_std${student.id}_${uniqueSuffix}.pdf`;
      const targetPdfPath = path.resolve(PROTECTED_WRITTEN_ANSWER_DIR, finalFilename);

      const imagePaths = allFiles.map((f) => f.path);
      await compileImagesToPdf(imagePaths, targetPdfPath);

      if (!fs.existsSync(targetPdfPath)) {
        cleanupRequestFiles(req);
        return res.status(500).json({ success: false, message: 'Failed to assemble images into an answer document.' });
      }

      const stat = fs.statSync(targetPdfPath);
      finalSize = stat.size;
      finalOriginalName = `Answer_Document_${exam.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      finalMimeType = 'application/pdf';

      // Clean temporary raw uploaded image files from disk
      for (const imgPath of imagePaths) {
        try { if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath); } catch (e) {}
      }
    }

    // Safely remove previous unfinalized staged file if different
    if (attempt?.answerPaperFile && attempt.answerPaperFile !== finalFilename) {
      const oldPath = path.resolve(PROTECTED_WRITTEN_ANSWER_DIR, path.basename(attempt.answerPaperFile));
      try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch (e) {}
    }

    const isFinal = req.body.isFinal === undefined ? true : (req.body.isFinal === true || req.body.isFinal === 'true' || req.body.isFinal === '1' || req.body.isFinal === 1);
    const status = isFinal ? 'SUBMITTED' : 'IN_PROGRESS';
    const submittedAt = isFinal ? now : null;

    if (!attempt) {
      attempt = await prisma.examAttempt.create({
        data: {
          instituteId,
          examId,
          studentId: student.id,
          attemptNumber: 1,
          startedAt: now,
          serverDeadline: deadline,
          status,
          submittedAt,
          answerPaperFile: finalFilename,
          answerPaperOriginalName: finalOriginalName,
          answerPaperMimeType: finalMimeType,
          answerPaperSize: finalSize,
          answerUploadedAt: now,
        },
      });
    } else {
      attempt = await prisma.examAttempt.update({
        where: { id: attempt.id },
        data: {
          status,
          submittedAt: isFinal ? now : attempt.submittedAt,
          serverDeadline: deadline,
          answerPaperFile: finalFilename,
          answerPaperOriginalName: finalOriginalName,
          answerPaperMimeType: finalMimeType,
          answerPaperSize: finalSize,
          answerUploadedAt: now,
        },
      });
    }

    // If final submission, ensure Result record in PENDING state
    if (isFinal) {
      await prisma.result.upsert({
        where: { examId_studentId: { examId, studentId: student.id } },
        create: {
          instituteId,
          examId,
          studentId: student.id,
          marks: 0,
          percentage: 0,
          grade: 'F',
          status: 'FAIL',
          resultStatus: 'PENDING',
        },
        update: {},
      });
    }

    const remainingMs = Math.max(0, deadline.getTime() - Date.now());

    return res.status(200).json({
      success: true,
      message: isFinal ? 'Answer paper submitted successfully for evaluation.' : 'Answer paper uploaded and staged successfully.',
      data: {
        attemptId: attempt.id,
        fileName: attempt.answerPaperOriginalName,
        fileSize: attempt.answerPaperSize,
        uploadedAt: attempt.answerUploadedAt,
        status: attempt.status,
        canReplace: attempt.status === 'IN_PROGRESS' && now < deadline,
        serverDeadline: attempt.serverDeadline,
        remainingSeconds: Math.floor(remainingMs / 1000),
      },
    });
  } catch (error) {
    cleanupRequestFiles(req);
    console.error('Error submitting written exam answer:', error);
    return res.status(500).json({ success: false, message: 'Failed to process written answer submission.' });
  }
};

/**
 * -------------------------------------------------------------
 * 19B. Student: Get Staged Written Exam Submission Status
 * -------------------------------------------------------------
 */
export const getStudentWrittenSubmission = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    const student = await prisma.student.findFirst({
      where: { userId: req.user.id, instituteId },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    let attempt = await prisma.examAttempt.findFirst({
      where: { examId, studentId: student.id, instituteId },
      orderBy: { attemptNumber: 'desc' },
    });

    if (attempt && attempt.status === 'IN_PROGRESS') {
      attempt = await finalizeExpiredAttempt(attempt, exam);
    }

    const now = new Date();
    const deadline = attempt?.serverDeadline ? new Date(attempt.serverDeadline) : null;
    const remainingMs = deadline ? Math.max(0, deadline.getTime() - now.getTime()) : 0;
    const isTimeout = deadline ? now >= deadline : false;

    return res.json({
      success: true,
      data: {
        hasAttempt: Boolean(attempt),
        attemptId: attempt?.id || null,
        status: attempt?.status || 'NOT_STARTED',
        hasStagedAnswer: Boolean(attempt?.answerPaperFile),
        fileName: attempt?.answerPaperOriginalName || null,
        fileSize: attempt?.answerPaperSize || null,
        uploadedAt: attempt?.answerUploadedAt || null,
        submittedAt: attempt?.submittedAt || null,
        serverDeadline: attempt?.serverDeadline || null,
        remainingSeconds: Math.floor(remainingMs / 1000),
        canReplace: Boolean(attempt && attempt.status === 'IN_PROGRESS' && !isTimeout),
        canSubmit: Boolean(attempt && attempt.status === 'IN_PROGRESS' && attempt.answerPaperFile && !isTimeout),
      },
    });
  } catch (error) {
    console.error('Error fetching student written submission:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch submission details.' });
  }
};

/**
 * -------------------------------------------------------------
 * 19C. Student: Delete Staged Written Exam Answer Before Submit
 * -------------------------------------------------------------
 */
export const deleteStudentWrittenSubmission = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    const student = await prisma.student.findFirst({
      where: { userId: req.user.id, instituteId },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const attempt = await prisma.examAttempt.findFirst({
      where: { examId, studentId: student.id, instituteId },
      orderBy: { attemptNumber: 'desc' },
    });

    if (!attempt) {
      return res.status(400).json({ success: false, message: 'No active attempt found.' });
    }

    if (attempt.status !== 'IN_PROGRESS') {
      return res.status(400).json({ success: false, message: 'Cannot delete an answer paper from a finalized or closed submission.' });
    }

    const now = new Date();
    if (attempt.serverDeadline && now >= new Date(attempt.serverDeadline)) {
      return res.status(400).json({ success: false, code: 'EXAM_TIMEOUT', message: 'Exam time has expired. Cannot remove answer.' });
    }

    if (attempt.answerPaperFile) {
      const filePath = path.resolve(PROTECTED_WRITTEN_ANSWER_DIR, path.basename(attempt.answerPaperFile));
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
    }

    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        answerPaperFile: null,
        answerPaperOriginalName: null,
        answerPaperMimeType: null,
        answerPaperSize: null,
        answerUploadedAt: null,
      },
    });

    return res.json({ success: true, message: 'Staged answer paper removed successfully.' });
  } catch (error) {
    console.error('Error deleting staged written answer:', error);
    return res.status(500).json({ success: false, message: 'Failed to remove staged answer.' });
  }
};

/**
 * -------------------------------------------------------------
 * 19D. Student: Finalize Written Exam Submission (Lock & Hand In)
 * -------------------------------------------------------------
 */
export const finalizeStudentWrittenSubmission = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    const student = await prisma.student.findFirst({
      where: { userId: req.user.id, instituteId },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const attempt = await prisma.examAttempt.findFirst({
      where: { examId, studentId: student.id, instituteId },
      orderBy: { attemptNumber: 'desc' },
    });

    if (!attempt) {
      return res.status(400).json({ success: false, message: 'No active exam attempt found to finalize.' });
    }

    // Idempotent submit
    if (attempt.status === 'SUBMITTED' || attempt.status === 'AUTO_SUBMITTED' || attempt.status === 'MARKED') {
      return res.json({
        success: true,
        message: 'Written examination already submitted.',
        data: {
          attemptId: attempt.id,
          status: attempt.status,
          submittedAt: attempt.submittedAt,
          fileName: attempt.answerPaperOriginalName,
        },
      });
    }

    const now = new Date();
    if (attempt.serverDeadline && now >= new Date(attempt.serverDeadline)) {
      const finalized = await finalizeExpiredAttempt(attempt);
      return res.status(400).json({
        success: false,
        code: 'EXAM_TIMEOUT',
        message: 'Exam deadline has expired. Your attempt has been automatically finalized.',
        data: finalized,
      });
    }

    if (!attempt.answerPaperFile) {
      return res.status(400).json({
        success: false,
        message: 'Please upload your answer document before submitting.',
      });
    }

    const finalized = await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: now,
      },
    });

    // Ensure Result record in PENDING state
    await prisma.result.upsert({
      where: { examId_studentId: { examId, studentId: student.id } },
      create: {
        instituteId,
        examId,
        studentId: student.id,
        marks: 0,
        percentage: 0,
        grade: 'F',
        status: 'FAIL',
        resultStatus: 'PENDING',
      },
      update: {},
    });

    return res.json({
      success: true,
      message: 'Written examination submitted successfully. Your submission is now awaiting teacher evaluation.',
      data: {
        attemptId: finalized.id,
        status: finalized.status,
        submittedAt: finalized.submittedAt,
        fileName: finalized.answerPaperOriginalName,
      },
    });
  } catch (error) {
    console.error('Error finalizing written exam:', error);
    return res.status(500).json({ success: false, message: 'Failed to finalize written exam submission.' });
  }
};

/**
 * -------------------------------------------------------------
 * 20. Admin & Teacher: View Exam Submissions List
 * -------------------------------------------------------------
 */
export const getExamSubmissions = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
      include: {
        class: {
          include: {
            students: {
              select: {
                id: true,
                instituteId: true,
                name: true,
                admissionNumber: true,
                rollNo: true,
              },
            },
            studentEnrollments: {
              where: { status: 'ACTIVE' },
              include: {
                student: {
                  select: {
                    id: true,
                    instituteId: true,
                    name: true,
                    admissionNumber: true,
                    rollNo: true,
                    user: { select: { email: true } },
                  },
                },
              },
            },
          },
        },
        attempts: {
          include: {
            student: {
              select: { id: true, instituteId: true, name: true, admissionNumber: true, rollNo: true },
            },
          },
          orderBy: { startedAt: 'desc' },
        },
        results: {
          include: {
            markedByUser: { select: { id: true, username: true } },
            publishedByUser: { select: { id: true, username: true } },
          },
        },
      },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    if (req.user.role === 'TEACHER') {
      const isAuthorized = await verifyTeacherExamAccess(req.user.id, exam, instituteId);
      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'You are not authorized to evaluate this exam.' });
      }
    }

    const attemptsMap = new Map();
    exam.attempts.forEach((a) => {
      if (!attemptsMap.has(a.studentId)) attemptsMap.set(a.studentId, a);
    });

    const resultsMap = new Map();
    exam.results.forEach((r) => {
      resultsMap.set(r.studentId, r);
    });

    // Gather candidate students from all enrollment sources and actual exam attempts for this tenant
    const studentMap = new Map();

    (exam.class?.studentEnrollments || []).forEach((e) => {
      if (e.student && e.student.id && e.student.instituteId === instituteId) {
        studentMap.set(e.student.id, e.student);
      }
    });

    (exam.class?.students || []).forEach((std) => {
      if (std && std.id && std.instituteId === instituteId && !studentMap.has(std.id)) {
        studentMap.set(std.id, std);
      }
    });

    (exam.attempts || []).forEach((a) => {
      if (a.student && a.student.id && a.student.instituteId === instituteId && !studentMap.has(a.student.id)) {
        studentMap.set(a.student.id, a.student);
      }
    });

    const candidateStudents = Array.from(studentMap.values());

    const submissions = candidateStudents.map((std) => {
      const attempt = attemptsMap.get(std.id) || null;
      const resRecord = resultsMap.get(std.id) || null;

      return {
        studentId: std.id,
        studentName: std.name,
        admissionNumber: std.admissionNumber,
        rollNo: std.rollNo,
        hasSubmission: Boolean(attempt && (attempt.answerPaperFile || attempt.status === 'SUBMITTED' || attempt.status === 'AUTO_SUBMITTED' || attempt.status === 'MARKED')),
        attempt: attempt ? {
          id: attempt.id,
          status: attempt.status,
          submittedAt: attempt.submittedAt || attempt.answerUploadedAt,
          answerPaperFile: attempt.answerPaperFile ? true : false,
          answerOriginalName: attempt.answerPaperOriginalName,
          score: attempt.score,
          percentage: attempt.percentage,
          isPassed: attempt.isPassed,
        } : null,
        result: resRecord ? {
          id: resRecord.id,
          marks: resRecord.marks,
          percentage: resRecord.percentage,
          grade: resRecord.grade,
          status: resRecord.status,
          resultStatus: resRecord.resultStatus,
          teacherFeedback: resRecord.teacherFeedback,
          markedBy: resRecord.markedByUser?.username || null,
          markedAt: resRecord.markedAt,
          publishedBy: resRecord.publishedByUser?.username || null,
          publishedAt: resRecord.publishedAt,
        } : null,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        exam: {
          id: exam.id,
          title: exam.title,
          examType: exam.examType,
          totalMarks: exam.totalMarks,
          passingMarks: exam.passingMarks,
          passMarkType: exam.passMarkType,
          status: exam.status,
          publishResult: exam.publishResult,
        },
        submissions,
      },
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch exam submissions.' });
  }
};

/**
 * -------------------------------------------------------------
 * 21. Protected Answer Paper PDF Viewer / Stream
 * -------------------------------------------------------------
 */
export const getProtectedAnswerPdf = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);
    const studentId = parseInt(req.params.studentId);

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    // Role checks: Admin, authorized Teacher, or the Student themselves
    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: { userId: req.user.id, instituteId },
      });
      if (!student || student.id !== studentId) {
        return res.status(403).json({ success: false, message: 'You are not authorized to view this answer paper.' });
      }
    } else if (req.user.role === 'TEACHER') {
      const isAuthorized = await verifyTeacherExamAccess(req.user.id, exam, instituteId);
      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'You are not authorized to evaluate this exam.' });
      }
    }

    const attempt = await prisma.examAttempt.findFirst({
      where: { examId, studentId, instituteId },
      orderBy: { attemptNumber: 'desc' },
    });

    if (!attempt || !attempt.answerPaperFile) {
      return res.status(404).json({ success: false, message: 'No submitted answer paper found for this student.' });
    }

    const safeBasename = path.basename(attempt.answerPaperFile);
    const filePath = path.resolve(PROTECTED_WRITTEN_ANSWER_DIR, safeBasename);

    if (!filePath.startsWith(path.resolve(PROTECTED_WRITTEN_ANSWER_DIR)) || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Physical answer paper file not found on server.' });
    }

    const mime = attempt.answerPaperMimeType || 'application/pdf';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${attempt.answerPaperOriginalName || safeBasename}"`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    const stream = fs.createReadStream(filePath);
    return stream.pipe(res);
  } catch (error) {
    console.error('Error streaming answer paper:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve answer paper.' });
  }
};

/**
 * -------------------------------------------------------------
 * 22. Admin & Teacher: Individual Student Marking
 * -------------------------------------------------------------
 */
export const markWrittenExamSubmission = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);
    const studentId = parseInt(req.params.studentId);
    const { marks, feedback, isDraft, reason } = req.body;

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    if (req.user.role === 'TEACHER') {
      const isAuthorized = await verifyTeacherExamAccess(req.user.id, exam, instituteId);
      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'You are not authorized to mark this exam.' });
      }
    }

    const savedResult = await saveMarkingResult({
      instituteId,
      examId,
      studentId,
      marks,
      feedback,
      markerId: req.user.id,
      isDraft: Boolean(isDraft),
      reason,
    });

    return res.status(200).json({
      success: true,
      message: isDraft ? 'Marking draft saved.' : 'Student submission evaluated and marked successfully.',
      data: savedResult,
    });
  } catch (error) {
    console.error('Error marking submission:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to evaluate submission.' });
  }
};

/**
 * -------------------------------------------------------------
 * 23. Admin & Teacher: Bulk Marks Entry
 * -------------------------------------------------------------
 */
export const bulkSaveWrittenExamMarks = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);
    const marksList = req.body.marksList || req.body.marksData || [];
    const reason = req.body.reason;

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    if (req.user.role === 'TEACHER') {
      const isAuthorized = await verifyTeacherExamAccess(req.user.id, exam, instituteId);
      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'You are not authorized to mark this exam.' });
      }
    }

    const savedResults = await bulkSaveMarks({
      instituteId,
      examId,
      marksList,
      markerId: req.user.id,
      reason,
    });

    return res.status(200).json({
      success: true,
      message: `Successfully evaluated and saved marks for ${savedResults.length} students.`,
      data: savedResults,
    });
  } catch (error) {
    console.error('Error in bulk marks save:', error);
    return res.status(400).json({ success: false, message: error.message || 'Bulk marks entry failed.' });
  }
};

/**
 * -------------------------------------------------------------
 * 24. Admin & Teacher: CSV Export Template
 * -------------------------------------------------------------
 */
export const exportMarksCsvTemplate = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
      include: {
        subject: true,
        results: true,
        attempts: {
          include: {
            student: {
              select: {
                id: true,
                instituteId: true,
                name: true,
                admissionNumber: true,
                rollNo: true,
              },
            },
          },
        },
        class: {
          include: {
            students: {
              select: {
                id: true,
                instituteId: true,
                name: true,
                admissionNumber: true,
                rollNo: true,
              },
            },
            studentEnrollments: {
              where: { status: 'ACTIVE' },
              include: {
                student: {
                  select: {
                    id: true,
                    instituteId: true,
                    name: true,
                    admissionNumber: true,
                    rollNo: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    if (req.user.role === 'TEACHER') {
      const isAuthorized = await verifyTeacherExamAccess(req.user.id, exam, instituteId);
      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'You are not authorized for this exam.' });
      }
    }

    const attemptsMap = new Map();
    (exam.attempts || []).forEach((a) => {
      if (!attemptsMap.has(a.studentId)) attemptsMap.set(a.studentId, a);
    });

    const resultsMap = new Map();
    (exam.results || []).forEach((r) => {
      resultsMap.set(r.studentId, r);
    });

    // Gather candidate students from all enrollment sources and actual exam attempts for this tenant
    const studentMap = new Map();

    (exam.class?.studentEnrollments || []).forEach((e) => {
      if (e.student && e.student.id && e.student.instituteId === instituteId) {
        studentMap.set(e.student.id, e.student);
      }
    });

    (exam.class?.students || []).forEach((std) => {
      if (std && std.id && std.instituteId === instituteId && !studentMap.has(std.id)) {
        studentMap.set(std.id, std);
      }
    });

    (exam.attempts || []).forEach((a) => {
      if (a.student && a.student.id && a.student.instituteId === instituteId && !studentMap.has(a.student.id)) {
        studentMap.set(a.student.id, a.student);
      }
    });

    const candidateStudents = Array.from(studentMap.values());

    const csvData = generateMarksCsvTemplate(exam, candidateStudents, resultsMap, attemptsMap);

    const classNameClean = (exam.class?.name || 'Class').replace(/[^a-zA-Z0-9]/g, '_');
    const examNameClean = (exam.title || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Marks_${classNameClean}_${examNameClean}.csv"`);
    return res.send(csvData);
  } catch (error) {
    console.error('Error exporting CSV template:', error);
    return res.status(500).json({ success: false, message: 'Failed to export CSV template.' });
  }
};

/**
 * -------------------------------------------------------------
 * 25. Admin & Teacher: CSV Import Preview (Dry-Run / Phase 1)
 * -------------------------------------------------------------
 */
export const previewImportMarksCsv = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    let csvContent = '';
    if (req.file) {
      csvContent = req.file.buffer.toString('utf-8');
    } else if (req.body.csvContent) {
      csvContent = req.body.csvContent;
    } else {
      return res.status(400).json({ success: false, message: 'Please upload a valid CSV file.' });
    }

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
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    if (req.user.role === 'TEACHER') {
      const isAuthorized = await verifyTeacherExamAccess(req.user.id, exam, instituteId);
      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'You are not authorized for this exam.' });
      }
    }

    const eligibleStudents = (exam.class?.studentEnrollments || []).map((e) => e.student);
    const previewResult = await validateMarksCsv(exam, csvContent, eligibleStudents);

    return res.status(200).json({
      success: true,
      data: previewResult,
    });
  } catch (error) {
    console.error('Error in CSV preview:', error);
    return res.status(400).json({ success: false, message: error.message || 'Invalid CSV format.' });
  }
};

/**
 * -------------------------------------------------------------
 * 26. Admin & Teacher: CSV Import Confirm (Phase 2 - Persist)
 * -------------------------------------------------------------
 */
export const confirmImportMarksCsvController = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);
    const { rows, reason } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid rows provided for confirmation.' });
    }

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    if (req.user.role === 'TEACHER') {
      const isAuthorized = await verifyTeacherExamAccess(req.user.id, exam, instituteId);
      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'You are not authorized for this exam.' });
      }
    }

    const saved = await confirmImportMarksCsv({
      instituteId,
      examId,
      rows,
      markerId: req.user.id,
      reason,
    });

    return res.status(200).json({
      success: true,
      message: `Successfully imported and saved marks for ${saved.length} students.`,
      data: saved,
    });
  } catch (error) {
    console.error('Error confirming CSV import:', error);
    return res.status(400).json({ success: false, message: error.message || 'CSV Import confirmation failed.' });
  }
};

/**
 * -------------------------------------------------------------
 * 27. Admin & Teacher: Single Result Publish
 * -------------------------------------------------------------
 */
export const publishExamResult = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);
    const studentId = parseInt(req.params.studentId);

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    if (req.user.role === 'TEACHER') {
      const isAuthorized = await verifyTeacherExamAccess(req.user.id, exam, instituteId);
      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'You are not authorized for this exam.' });
      }
    }

    const published = await publishResult({
      instituteId,
      examId,
      studentId,
      publisherId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: 'Student result published successfully.',
      data: published,
    });
  } catch (error) {
    console.error('Error publishing result:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to publish result.' });
  }
};

/**
 * -------------------------------------------------------------
 * 28. Admin & Teacher: Single Result Unpublish
 * -------------------------------------------------------------
 */
export const unpublishExamResult = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);
    const studentId = parseInt(req.params.studentId);

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    if (req.user.role === 'TEACHER') {
      const isAuthorized = await verifyTeacherExamAccess(req.user.id, exam, instituteId);
      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'You are not authorized for this exam.' });
      }
    }

    const unpublished = await unpublishResult({
      instituteId,
      examId,
      studentId,
      unpublisherId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: 'Student result unpublished. Marks preserved internally.',
      data: unpublished,
    });
  } catch (error) {
    console.error('Error unpublishing result:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to unpublish result.' });
  }
};

/**
 * -------------------------------------------------------------
 * 29. Admin & Teacher: Bulk Publish All Marked Results
 * -------------------------------------------------------------
 */
export const publishAllExamResults = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    if (req.user.role === 'TEACHER') {
      const isAuthorized = await verifyTeacherExamAccess(req.user.id, exam, instituteId);
      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'You are not authorized for this exam.' });
      }
    }

    const outcome = await publishAllMarkedResults({
      instituteId,
      examId,
      publisherId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      ...outcome,
    });
  } catch (error) {
    console.error('Error publishing all results:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to publish all results.' });
  }
};

/**
 * -------------------------------------------------------------
 * 30. Download Official Result PDF (Admin / Teacher / Student)
 * -------------------------------------------------------------
 */
export const downloadOfficialResultPdf = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const examId = parseInt(req.params.id);
    const studentId = parseInt(req.params.studentId);

    const exam = await prisma.exam.findFirst({
      where: { id: examId, instituteId },
      include: {
        subject: true,
        class: true,
        academicYear: true,
      },
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    // Role checks
    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: { userId: req.user.id, instituteId },
      });
      if (!student || student.id !== studentId) {
        return res.status(403).json({ success: false, message: 'Access denied to result PDF.' });
      }
    } else if (req.user.role === 'PARENT') {
      const parent = await prisma.parent.findFirst({
        where: { userId: req.user.id, instituteId },
        include: {
          students: {
            where: { studentId },
          },
        },
      });
      if (!parent || !parent.students || parent.students.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied. Student is not linked to your parent account.' });
      }
    } else if (req.user.role === 'TEACHER') {
      const isAuthorized = await verifyTeacherExamAccess(req.user.id, exam, instituteId);
      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'You are not authorized for this exam.' });
      }
    }

    const student = await prisma.student.findFirst({
      where: { id: studentId, instituteId },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const result = await prisma.result.findFirst({
      where: { examId, studentId, instituteId },
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Result has not been generated for this student yet.' });
    }

    if ((req.user.role === 'STUDENT' || req.user.role === 'PARENT') && result.resultStatus !== 'PUBLISHED') {
      return res.status(403).json({ success: false, message: 'This result has not been released yet.' });
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
    });

    const doc = await generateOfficialResultPdf({
      result,
      student,
      exam,
      institute,
      academicYear: exam.academicYear,
      classData: exam.class,
      subject: exam.subject,
    });

    const admSafe = (student.admissionNumber || String(student.id)).replace(/[^a-zA-Z0-9]/g, '_');
    const subjSafe = (exam.subject?.name || 'Subject').replace(/[^a-zA-Z0-9]/g, '_');
    const examSafe = (exam.title || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Result_${admSafe}_${subjSafe}_${examSafe}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return doc.pipe(res);
  } catch (error) {
    console.error('Error generating official result PDF:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate result PDF.' });
  }
};

/**
 * -------------------------------------------------------------
 * 31. Student: Unified Released Results List (MCQ + Written)
 * -------------------------------------------------------------
 */
export const getStudentUnifiedResults = async (req, res) => {
  try {
    const instituteId = req.instituteId;

    const student = await prisma.student.findFirst({
      where: { userId: req.user.id, instituteId },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const results = await prisma.result.findMany({
      where: {
        studentId: student.id,
        instituteId,
        resultStatus: 'PUBLISHED',
      },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            examType: true,
            totalMarks: true,
            passingMarks: true,
            passMarkType: true,
            startDateTime: true,
            subject: { select: { id: true, name: true, code: true } },
            class: { select: { id: true, name: true, section: true } },
            academicYear: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Error fetching student unified results:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch results.' });
  }
};

/**
 * -------------------------------------------------------------
 * 32. Student: Download Own Result PDF by Result ID
 * -------------------------------------------------------------
 */
export const getStudentResultPdf = async (req, res) => {
  try {
    const instituteId = req.instituteId;
    const resultId = parseInt(req.params.resultId);

    const student = await prisma.student.findFirst({
      where: { userId: req.user.id, instituteId },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const result = await prisma.result.findFirst({
      where: {
        id: resultId,
        studentId: student.id,
        instituteId,
        resultStatus: 'PUBLISHED',
      },
      include: {
        exam: {
          include: {
            subject: true,
            class: true,
            academicYear: true,
          },
        },
      },
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Published result not found or access denied.' });
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
    });

    const doc = await generateOfficialResultPdf({
      result,
      student,
      exam: result.exam,
      institute,
      academicYear: result.exam?.academicYear,
      classData: result.exam?.class,
      subject: result.exam?.subject,
    });

    const admSafe = (student.admissionNumber || String(student.id)).replace(/[^a-zA-Z0-9]/g, '_');
    const subjSafe = (result.exam?.subject?.name || 'Subject').replace(/[^a-zA-Z0-9]/g, '_');
    const examSafe = (result.exam?.title || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Result_${admSafe}_${subjSafe}_${examSafe}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return doc.pipe(res);
  } catch (error) {
    console.error('Error generating student result PDF:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate result PDF.' });
  }
};

