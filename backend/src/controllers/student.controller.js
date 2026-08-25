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
        classId: classId ? parseInt(classId, 10) : null,
        phone: phone || null,
        gender: gender || null,
        address: address || null,
      },
      include: {
        class: true,
        user: { select: { id: true, email: true } },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Student registered successfully.',
      data: student,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
