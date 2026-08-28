import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';

// 1. GET ALL PARENTS (Scoped to Institute Tenant)
export const getParents = async (req, res) => {
  try {
    const { search } = req.query;
    const where = { instituteId: req.instituteId };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { phone: { contains: q } },
        { user: { email: { contains: q } } },
        {
          students: {
            some: {
              student: {
                OR: [
                  { name: { contains: q } },
                  { admissionNumber: { contains: q } },
                ],
              },
            },
          },
        },
      ];
    }

    const parents = await prisma.parent.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, username: true, isActive: true } },
        students: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                admissionNumber: true,
                rollNo: true,
                class: { select: { id: true, name: true, section: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ success: true, data: parents });
  } catch (error) {
    console.error('Error fetching parents:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. GET SINGLE PARENT BY ID
export const getParentById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const parent = await prisma.parent.findFirst({
      where: {
        id,
        instituteId: req.instituteId,
      },
      include: {
        user: { select: { id: true, email: true, username: true, isActive: true } },
        students: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                admissionNumber: true,
                rollNo: true,
                class: { select: { id: true, name: true, section: true } },
              },
            },
          },
        },
      },
    });

    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent guardian record not found in your institute.' });
    }

    return res.status(200).json({ success: true, data: parent });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. CREATE PARENT ACCOUNT (Scoped to Institute Tenant)
export const createParent = async (req, res) => {
  try {
    const {
      name,
      firstName,
      lastName,
      email,
      password,
      phone,
      occupation,
      address,
      studentId,
      relationship,
    } = req.body;

    const parentName = name || `${firstName || ''} ${lastName || ''}`.trim();
    if (!parentName || !email) {
      return res.status(400).json({ success: false, message: 'Parent name and email address are required.' });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email address is already registered in the system.' });
    }

    // If studentId provided, verify student belongs to this institute
    if (studentId) {
      const sId = parseInt(studentId, 10);
      const student = await prisma.student.findFirst({
        where: { id: sId, instituteId: req.instituteId },
      });
      if (!student) {
        return res.status(404).json({ success: false, message: 'Selected student does not exist in your institute.' });
      }
    }

    const passwordHash = await bcrypt.hash(password || 'Parent123!', 10);

    const user = await prisma.user.create({
      data: {
        username: email.split('@')[0] + Math.floor(Math.random() * 1000),
        email,
        passwordHash,
        role: 'PARENT',
        instituteId: req.instituteId,
        isActive: true,
      },
    });

    const parent = await prisma.parent.create({
      data: {
        userId: user.id,
        instituteId: req.instituteId,
        name: parentName,
        firstName: firstName || parentName.split(' ')[0],
        lastName: lastName || parentName.split(' ').slice(1).join(' ') || '',
        phone: phone || null,
        occupation: occupation || null,
        address: address || null,
      },
      include: {
        user: { select: { id: true, email: true, username: true, isActive: true } },
        students: true,
      },
    });

    // Create student link if studentId provided
    if (studentId) {
      const sId = parseInt(studentId, 10);
      await prisma.parentStudent.create({
        data: {
          parentId: parent.id,
          studentId: sId,
          relationship: relationship || 'Parent',
        },
      });
    }

    // Fetch full created parent with links
    const createdParent = await prisma.parent.findUnique({
      where: { id: parent.id },
      include: {
        user: { select: { id: true, email: true, username: true, isActive: true } },
        students: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                admissionNumber: true,
                class: true,
              },
            },
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Parent guardian account created successfully.',
      data: createdParent,
    });
  } catch (error) {
    console.error('Error creating parent:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. UPDATE PARENT & STATUS
export const updateParent = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, phone, occupation, address, isActive } = req.body;

    const parent = await prisma.parent.findFirst({
      where: { id, instituteId: req.instituteId },
    });

    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent record not found in your institute.' });
    }

    // Update Parent profile
    await prisma.parent.update({
      where: { id },
      data: {
        name: name !== undefined ? name : parent.name,
        phone: phone !== undefined ? phone : parent.phone,
        occupation: occupation !== undefined ? occupation : parent.occupation,
        address: address !== undefined ? address : parent.address,
      },
    });

    // Update User active state if passed
    if (typeof isActive === 'boolean') {
      await prisma.user.update({
        where: { id: parent.userId },
        data: { isActive },
      });
    }

    const updated = await prisma.parent.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, username: true, isActive: true } },
        students: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                admissionNumber: true,
                class: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Parent record updated successfully.',
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 5. LINK PARENT TO STUDENT (Tenant Scoped)
export const linkStudent = async (req, res) => {
  try {
    const parentId = parseInt(req.params.id, 10);
    const { studentId, relationship } = req.body;

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required for linking.' });
    }

    const sId = parseInt(studentId, 10);

    // Verify parent belongs to current institute
    const parent = await prisma.parent.findFirst({
      where: { id: parentId, instituteId: req.instituteId },
    });
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent record not found in your institute.' });
    }

    // Verify student belongs to current institute
    const student = await prisma.student.findFirst({
      where: { id: sId, instituteId: req.instituteId },
    });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found in your institute.' });
    }

    const link = await prisma.parentStudent.upsert({
      where: {
        parentId_studentId: { parentId, studentId: sId },
      },
      update: {
        relationship: relationship || 'Parent',
      },
      create: {
        parentId,
        studentId: sId,
        relationship: relationship || 'Parent',
      },
    });

    return res.status(200).json({
      success: true,
      message: `Parent successfully linked to student ${student.name}.`,
      data: link,
    });
  } catch (error) {
    console.error('Error linking parent to student:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6. UNLINK PARENT FROM STUDENT (Tenant Scoped)
export const unlinkStudent = async (req, res) => {
  try {
    const parentId = parseInt(req.params.id, 10);
    const studentId = parseInt(req.params.studentId, 10);

    // Verify parent belongs to current institute
    const parent = await prisma.parent.findFirst({
      where: { id: parentId, instituteId: req.instituteId },
    });
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent record not found in your institute.' });
    }

    const link = await prisma.parentStudent.findFirst({
      where: { parentId, studentId },
    });

    if (!link) {
      return res.status(404).json({ success: false, message: 'Relationship link not found.' });
    }

    await prisma.parentStudent.delete({
      where: { id: link.id },
    });

    return res.status(200).json({
      success: true,
      message: 'Student successfully unlinked from parent profile.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
