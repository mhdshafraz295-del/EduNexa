import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';

export const getTeachers = async (req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({
      where: { instituteId: req.instituteId },
      include: {
        user: { select: { id: true, email: true, username: true, isActive: true } },
        classes: true,
        subjects: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ success: true, data: teachers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createTeacher = async (req, res) => {
  try {
    const { name, email, password, phone, designation, qualification, employeeId } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Teacher name and email are required.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email is already registered in the platform.' });
    }

    const passwordHash = await bcrypt.hash(password || 'Teacher123!', 10);
    const user = await prisma.user.create({
      data: {
        username: email.split('@')[0] + Math.floor(Math.random() * 1000),
        email,
        passwordHash,
        role: 'TEACHER',
        instituteId: req.instituteId,
        isActive: true,
      },
    });

    const empId = employeeId || `EMP-${Date.now().toString().slice(-4)}`;
    const teacher = await prisma.teacher.create({
      data: {
        userId: user.id,
        instituteId: req.instituteId,
        name,
        employeeId: empId,
        phone: phone || null,
        designation: designation || 'Teacher',
        qualification: qualification || null,
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    return res.status(201).json({ success: true, message: 'Teacher created successfully.', data: teacher });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
