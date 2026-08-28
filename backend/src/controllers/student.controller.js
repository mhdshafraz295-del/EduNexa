import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';

export const getStudents = async (req, res) => {
  try {
    const { classId, search } = req.query;
    const where = { instituteId: req.instituteId };

    if (classId) where.classId = parseInt(classId, 10);
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { admissionNumber: { contains: search } },
        { rollNo: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ];
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, username: true, isActive: true } },
        class: true,
        parents: { include: { parent: true } },
        studentSubjects: { include: { subject: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ success: true, data: students });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getStudentById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    // Strict tenant check
    const student = await prisma.student.findFirst({
      where: {
        id,
        instituteId: req.instituteId,
      },
      include: {
        user: { select: { id: true, email: true, username: true, isActive: true } },
        class: true,
        parents: { include: { parent: true } },
        studentSubjects: { include: { subject: true } },
        attendances: { take: 10, orderBy: { date: 'desc' } },
        invoices: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found in your institute.',
      });
    }

    return res.status(200).json({ success: true, data: student });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createStudent = async (req, res) => {
  try {
    const {
      name,
      firstName,
      lastName,
      admissionNumber,
      rollNo,
      email,
      password,
      classId,
      phone,
      gender,
      address,
      subjectIds,
    } = req.body;

    const studentName = name || `${firstName || ''} ${lastName || ''}`.trim();
    if (!studentName || !email) {
      return res.status(400).json({ success: false, message: 'Student name and email are required.' });
    }

    // Check if email exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email is already registered in the platform.' });
    }

    const admNum = admissionNumber || rollNo || `ADM-${Date.now().toString().slice(-6)}`;

    // Check if admission number is already used in this institute
    const existingAdm = await prisma.student.findFirst({
      where: { instituteId: req.instituteId, admissionNumber: admNum },
    });
    if (existingAdm) {
      return res.status(409).json({ success: false, message: `Admission number '${admNum}' already exists in your institute.` });
    }

    const parsedClassId = classId ? parseInt(classId, 10) : null;

    // Validate class belongs to institute
    if (parsedClassId) {
      const cls = await prisma.class.findFirst({
        where: { id: parsedClassId, instituteId: req.instituteId },
      });
      if (!cls) {
        return res.status(404).json({ success: false, message: 'Selected class not found in your institute.' });
      }
    }

    // Server-side subject validation (Part 10)
    let numericSubjectIds = [];
    const isSubjectSelectionProvided = Array.isArray(subjectIds);
    if (isSubjectSelectionProvided) {
      numericSubjectIds = subjectIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

      if (numericSubjectIds.length > 0) {
        if (!parsedClassId) {
          return res.status(400).json({
            success: false,
            message: 'A class must be selected before assigning subjects to a student.',
          });
        }

        // Verify every subject belongs to institute AND is mapped to selected class in ClassSubject
        const validClassSubjects = await prisma.classSubject.findMany({
          where: {
            classId: parsedClassId,
            subjectId: { in: numericSubjectIds },
            instituteId: req.instituteId,
          },
        });

        if (validClassSubjects.length !== numericSubjectIds.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more selected subjects are not assigned to the selected class.',
          });
        }
      }
    }

    const passwordHash = await bcrypt.hash(password || 'Student123!', 10);

    const user = await prisma.user.create({
      data: {
        username: email.split('@')[0] + Math.floor(Math.random() * 1000),
        email,
        passwordHash,
        role: 'STUDENT',
        instituteId: req.instituteId,
        isActive: true,
      },
    });

    const student = await prisma.student.create({
      data: {
        userId: user.id,
        instituteId: req.instituteId,
        name: studentName,
        firstName: firstName || studentName.split(' ')[0],
        lastName: lastName || studentName.split(' ').slice(1).join(' ') || '',
        admissionNumber: admNum,
        rollNo: rollNo || admNum,
        classId: parsedClassId,
        phone: phone || null,
        gender: gender || null,
        address: address || null,
        subjectsConfigured: isSubjectSelectionProvided,
      },
    });

    if (isSubjectSelectionProvided && numericSubjectIds.length > 0) {
      await prisma.studentSubject.createMany({
        data: numericSubjectIds.map((sid) => ({
          instituteId: req.instituteId,
          studentId: student.id,
          subjectId: sid,
        })),
      });
    }

    const createdStudent = await prisma.student.findUnique({
      where: { id: student.id },
      include: {
        class: true,
        user: { select: { id: true, email: true, username: true } },
        studentSubjects: { include: { subject: true } },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Student registered successfully.',
      data: createdStudent,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStudent = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    // Strict tenant check
    const existing = await prisma.student.findFirst({
      where: { id, instituteId: req.instituteId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Student not found in your institute.',
      });
    }

    const {
      name,
      firstName,
      lastName,
      classId,
      phone,
      gender,
      address,
      subjectIds,
    } = req.body;

    const parsedClassId = classId !== undefined ? (classId ? parseInt(classId, 10) : null) : existing.classId;

    if (classId !== undefined && parsedClassId !== null) {
      const cls = await prisma.class.findFirst({
        where: { id: parsedClassId, instituteId: req.instituteId },
      });
      if (!cls) {
        return res.status(404).json({ success: false, message: 'Selected class not found in your institute.' });
      }
    }

    const isSubjectSelectionProvided = Array.isArray(subjectIds);
    let numericSubjectIds = [];

    if (isSubjectSelectionProvided) {
      numericSubjectIds = subjectIds.map((sid) => parseInt(sid, 10)).filter((sid) => !isNaN(sid));

      if (numericSubjectIds.length > 0) {
        if (!parsedClassId) {
          return res.status(400).json({
            success: false,
            message: 'A class must be assigned before selecting student subjects.',
          });
        }

        // Server-side subject validation (Part 10): Ensure all selected subjects are mapped to class in ClassSubject
        const validClassSubjects = await prisma.classSubject.findMany({
          where: {
            classId: parsedClassId,
            subjectId: { in: numericSubjectIds },
            instituteId: req.instituteId,
          },
        });

        if (validClassSubjects.length !== numericSubjectIds.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more selected subjects are not assigned to the selected class.',
          });
        }
      }
    }

    // Update Student record (Edit Safety Part 11: preserve passwords, admission numbers, user status, parent links, etc.)
    const studentName = name || (firstName || lastName ? `${firstName || ''} ${lastName || ''}`.trim() : undefined);

    await prisma.student.update({
      where: { id },
      data: {
        ...(studentName !== undefined && { name: studentName }),
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(gender !== undefined && { gender }),
        ...(address !== undefined && { address }),
        ...(classId !== undefined && { classId: parsedClassId }),
        ...(isSubjectSelectionProvided && { subjectsConfigured: true }),
      },
    });

    // Synchronize StudentSubject relationships if subject selection was submitted
    if (isSubjectSelectionProvided) {
      // Remove existing student subject links for this student
      await prisma.studentSubject.deleteMany({
        where: { studentId: id, instituteId: req.instituteId },
      });

      // Add newly selected student subject links
      if (numericSubjectIds.length > 0) {
        await prisma.studentSubject.createMany({
          data: numericSubjectIds.map((sid) => ({
            instituteId: req.instituteId,
            studentId: id,
            subjectId: sid,
          })),
        });
      }
    }

    const updatedStudent = await prisma.student.findUnique({
      where: { id },
      include: {
        class: true,
        user: { select: { id: true, email: true, username: true, isActive: true } },
        parents: { include: { parent: true } },
        studentSubjects: { include: { subject: true } },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Student record updated successfully.',
      data: updatedStudent,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
