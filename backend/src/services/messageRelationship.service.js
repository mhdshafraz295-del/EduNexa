import prisma from '../config/prisma.js';

/**
 * Validates whether the authenticated sender is permitted to initiate/send messages to recipientUserId
 * within the specified institute.
 * 
 * @param {number} instituteId 
 * @param {object} senderUser - { id, role, instituteId }
 * @param {number} recipientUserId 
 * @returns {Promise<{ allowed: boolean, reason?: string, recipientUser?: object }>}
 */
export async function validateUserCanMessage(instituteId, senderUser, recipientUserId) {
  if (!senderUser || !senderUser.id) {
    return { allowed: false, reason: 'Authentication required' };
  }

  if (senderUser.id === recipientUserId) {
    return { allowed: false, reason: 'Cannot message yourself' };
  }

  const recipient = await prisma.user.findFirst({
    where: {
      id: recipientUserId,
      instituteId: instituteId,
      isActive: true,
    },
    include: {
      teacher: true,
      student: {
        include: {
          class: true,
          studentEnrollments: {
            where: { status: 'ACTIVE' },
            include: { class: true },
          },
        },
      },
      parent: {
        include: {
          students: {
            include: {
              student: {
                include: {
                  class: true,
                  studentEnrollments: {
                    where: { status: 'ACTIVE' },
                    include: { class: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!recipient) {
    return { allowed: false, reason: 'Recipient not found in this institute or is inactive' };
  }

  // 1. ADMIN - Permitted to message any Admin, Teacher, Student, Parent in same institute
  if (senderUser.role === 'ADMIN') {
    if (['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'].includes(recipient.role)) {
      return { allowed: true, recipientUser: recipient };
    }
    return { allowed: false, reason: 'Admin cannot message this role' };
  }

  // 2. TEACHER
  if (senderUser.role === 'TEACHER') {
    if (recipient.role === 'ADMIN') {
      return { allowed: true, recipientUser: recipient };
    }

    if (recipient.role === 'TEACHER') {
      // Allowed to communicate with peer faculty members in the same institute
      return { allowed: true, recipientUser: recipient };
    }

    // Get sender teacher profile
    const teacherProfile = await prisma.teacher.findUnique({
      where: { userId: senderUser.id },
      include: {
        classes: true,
        subjects: true,
        teacherAssignments: true,
      },
    });

    if (!teacherProfile) {
      return { allowed: false, reason: 'Teacher profile not found' };
    }

    // Collect class IDs assigned to this teacher
    const assignedClassIds = new Set();
    teacherProfile.classes?.forEach((c) => assignedClassIds.add(c.id));
    teacherProfile.subjects?.forEach((s) => s.classId && assignedClassIds.add(s.classId));
    teacherProfile.teacherAssignments?.forEach((ta) => ta.classId && assignedClassIds.add(ta.classId));

    if (recipient.role === 'STUDENT') {
      // Check if student belongs to any of teacher's assigned classes
      const studentClassId = recipient.student?.classId;
      const enrolledClassIds = recipient.student?.studentEnrollments?.map((e) => e.classId) || [];
      
      const isAssigned = (studentClassId && assignedClassIds.has(studentClassId)) ||
        enrolledClassIds.some((cid) => assignedClassIds.has(cid));

      if (isAssigned) {
        return { allowed: true, recipientUser: recipient };
      }
      return { allowed: false, reason: 'You can only message students in your assigned classes' };
    }

    if (recipient.role === 'PARENT') {
      // Check if parent has any child in teacher's assigned classes
      const linkedStudents = recipient.parent?.students || [];
      const hasAssignedChild = linkedStudents.some((ps) => {
        const childClassId = ps.student?.classId;
        const childEnrolledClasses = ps.student?.studentEnrollments?.map((e) => e.classId) || [];
        return (childClassId && assignedClassIds.has(childClassId)) ||
          childEnrolledClasses.some((cid) => assignedClassIds.has(cid));
      });

      if (hasAssignedChild) {
        return { allowed: true, recipientUser: recipient };
      }
      return { allowed: false, reason: 'You can only message parents of students in your assigned classes' };
    }

    return { allowed: false, reason: 'Teacher is not permitted to message this user' };
  }

  // 3. STUDENT
  if (senderUser.role === 'STUDENT') {
    if (recipient.role === 'ADMIN') {
      return { allowed: true, recipientUser: recipient };
    }

    if (recipient.role === 'TEACHER') {
      // Find student profile and class
      const studentProfile = await prisma.student.findUnique({
        where: { userId: senderUser.id },
        include: {
          studentEnrollments: { where: { status: 'ACTIVE' } },
        },
      });

      if (!studentProfile) {
        return { allowed: false, reason: 'Student profile not found' };
      }

      const studentClassIds = new Set();
      if (studentProfile.classId) studentClassIds.add(studentProfile.classId);
      studentProfile.studentEnrollments?.forEach((e) => studentClassIds.add(e.classId));

      if (studentClassIds.size === 0) {
        return { allowed: false, reason: 'Student is not assigned to an active class' };
      }

      const classIdArray = Array.from(studentClassIds);

      // Check if recipient teacher teaches any of student's classes
      const teacherAssignment = await prisma.teacherAssignment.findFirst({
        where: {
          instituteId,
          teacher: { userId: recipient.id },
          classId: { in: classIdArray },
        },
      });

      const isClassTeacher = await prisma.class.findFirst({
        where: {
          id: { in: classIdArray },
          classTeacher: { userId: recipient.id },
        },
      });

      const teachesSubject = await prisma.subject.findFirst({
        where: {
          classId: { in: classIdArray },
          teacher: { userId: recipient.id },
        },
      });

      if (teacherAssignment || isClassTeacher || teachesSubject) {
        return { allowed: true, recipientUser: recipient };
      }

      return { allowed: false, reason: 'You can only message teachers assigned to your current class or subjects' };
    }

    // Student -> Student or Student -> Parent is blocked
    return { allowed: false, reason: 'Students can only message Administrators and assigned Teachers' };
  }

  // 4. PARENT
  if (senderUser.role === 'PARENT') {
    if (recipient.role === 'ADMIN') {
      return { allowed: true, recipientUser: recipient };
    }

    if (recipient.role === 'TEACHER') {
      // Find parent profile and linked children
      const parentProfile = await prisma.parent.findUnique({
        where: { userId: senderUser.id },
        include: {
          students: {
            include: {
              student: {
                include: {
                  studentEnrollments: { where: { status: 'ACTIVE' } },
                },
              },
            },
          },
        },
      });

      if (!parentProfile || !parentProfile.students?.length) {
        return { allowed: false, reason: 'Parent has no linked students' };
      }

      // Collect all class IDs of all linked children
      const childClassIds = new Set();
      parentProfile.students.forEach((ps) => {
        if (ps.student?.classId) childClassIds.add(ps.student.classId);
        ps.student?.studentEnrollments?.forEach((e) => childClassIds.add(e.classId));
      });

      const classIdArray = Array.from(childClassIds);
      if (classIdArray.length === 0) {
        return { allowed: false, reason: 'Linked children are not enrolled in active classes' };
      }

      const teacherAssignment = await prisma.teacherAssignment.findFirst({
        where: {
          instituteId,
          teacher: { userId: recipient.id },
          classId: { in: classIdArray },
        },
      });

      const isClassTeacher = await prisma.class.findFirst({
        where: {
          id: { in: classIdArray },
          classTeacher: { userId: recipient.id },
        },
      });

      const teachesSubject = await prisma.subject.findFirst({
        where: {
          classId: { in: classIdArray },
          teacher: { userId: recipient.id },
        },
      });

      if (teacherAssignment || isClassTeacher || teachesSubject) {
        return { allowed: true, recipientUser: recipient };
      }

      return { allowed: false, reason: 'You can only message teachers assigned to your linked children' };
    }

    return { allowed: false, reason: 'Parents can only message Administrators and their children’s assigned Teachers' };
  }

  return { allowed: false, reason: 'Unauthorized role for messaging' };
}

/**
 * Retrieves the directory of allowed recipients for a given sender in the institute.
 * Formats user context (role, designation, student class, parent child name).
 * 
 * @param {number} instituteId 
 * @param {object} senderUser 
 * @param {object} options - { search, role, page, limit }
 * @returns {Promise<{ recipients: Array, total: number }>}
 */
export async function getAllowedRecipients(instituteId, senderUser, { search = '', role = '', page = 1, limit = 50 }) {
  const searchTerm = search?.trim().toLowerCase() || '';

  // 1. ADMIN DIRECTORY
  if (senderUser.role === 'ADMIN') {
    const allowedRoles = role ? [role] : ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'];
    const where = {
      instituteId,
      isActive: true,
      id: { not: senderUser.id },
      role: { in: allowedRoles },
    };

    if (searchTerm) {
      where.OR = [
        { username: { contains: searchTerm } },
        { email: { contains: searchTerm } },
        { teacher: { name: { contains: searchTerm } } },
        { teacher: { employeeId: { contains: searchTerm } } },
        { student: { name: { contains: searchTerm } } },
        { student: { admissionNumber: { contains: searchTerm } } },
        { parent: { name: { contains: searchTerm } } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { username: 'asc' },
        include: {
          teacher: true,
          student: { include: { class: true } },
          parent: {
            include: {
              students: {
                include: {
                  student: { include: { class: true } },
                },
              },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const formatted = users.map((u) => formatRecipientInfo(u));
    return { recipients: formatted, total };
  }

  // 2. TEACHER DIRECTORY
  if (senderUser.role === 'TEACHER') {
    const teacherProfile = await prisma.teacher.findUnique({
      where: { userId: senderUser.id },
      include: {
        classes: true,
        subjects: true,
        teacherAssignments: true,
      },
    });

    const assignedClassIds = new Set();
    teacherProfile?.classes?.forEach((c) => assignedClassIds.add(c.id));
    teacherProfile?.subjects?.forEach((s) => s.classId && assignedClassIds.add(s.classId));
    teacherProfile?.teacherAssignments?.forEach((ta) => ta.classId && assignedClassIds.add(ta.classId));
    const classIdList = Array.from(assignedClassIds);

    const conditions = [
      // Admins
      { role: 'ADMIN', instituteId, isActive: true },
      // Peer Teachers
      { role: 'TEACHER', instituteId, isActive: true, id: { not: senderUser.id } },
    ];

    if (classIdList.length > 0) {
      // Students in assigned classes
      conditions.push({
        role: 'STUDENT',
        instituteId,
        isActive: true,
        OR: [
          { student: { classId: { in: classIdList } } },
          { student: { studentEnrollments: { some: { classId: { in: classIdList }, status: 'ACTIVE' } } } },
        ],
      });

      // Parents of students in assigned classes
      conditions.push({
        role: 'PARENT',
        instituteId,
        isActive: true,
        parent: {
          students: {
            some: {
              student: {
                OR: [
                  { classId: { in: classIdList } },
                  { studentEnrollments: { some: { classId: { in: classIdList }, status: 'ACTIVE' } } },
                ],
              },
            },
          },
        },
      });
    }

    let combinedWhere = {
      instituteId,
      isActive: true,
      id: { not: senderUser.id },
      OR: conditions,
    };

    if (role) {
      combinedWhere.role = role;
    }

    if (searchTerm) {
      combinedWhere.AND = [
        {
          OR: [
            { username: { contains: searchTerm } },
            { email: { contains: searchTerm } },
            { teacher: { name: { contains: searchTerm } } },
            { student: { name: { contains: searchTerm } } },
            { parent: { name: { contains: searchTerm } } },
          ],
        },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: combinedWhere,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { username: 'asc' },
        include: {
          teacher: true,
          student: { include: { class: true } },
          parent: {
            include: {
              students: {
                include: {
                  student: { include: { class: true } },
                },
              },
            },
          },
        },
      }),
      prisma.user.count({ where: combinedWhere }),
    ]);

    return {
      recipients: users.map((u) => formatRecipientInfo(u)),
      total,
    };
  }

  // 3. STUDENT DIRECTORY
  if (senderUser.role === 'STUDENT') {
    const studentProfile = await prisma.student.findUnique({
      where: { userId: senderUser.id },
      include: {
        studentEnrollments: { where: { status: 'ACTIVE' } },
      },
    });

    const studentClassIds = new Set();
    if (studentProfile?.classId) studentClassIds.add(studentProfile.classId);
    studentProfile?.studentEnrollments?.forEach((e) => studentClassIds.add(e.classId));
    const classIdList = Array.from(studentClassIds);

    const conditions = [
      // Admins
      { role: 'ADMIN', instituteId, isActive: true },
    ];

    if (classIdList.length > 0) {
      // Teachers assigned to student's class/subjects
      conditions.push({
        role: 'TEACHER',
        instituteId,
        isActive: true,
        teacher: {
          OR: [
            { classes: { some: { id: { in: classIdList } } } },
            { subjects: { some: { classId: { in: classIdList } } } },
            { teacherAssignments: { some: { classId: { in: classIdList } } } },
          ],
        },
      });
    }

    let combinedWhere = {
      instituteId,
      isActive: true,
      id: { not: senderUser.id },
      OR: conditions,
    };

    if (role) combinedWhere.role = role;

    if (searchTerm) {
      combinedWhere.AND = [
        {
          OR: [
            { username: { contains: searchTerm } },
            { email: { contains: searchTerm } },
            { teacher: { name: { contains: searchTerm } } },
          ],
        },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: combinedWhere,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { username: 'asc' },
        include: {
          teacher: {
            include: {
              classes: true,
              subjects: true,
            },
          },
        },
      }),
      prisma.user.count({ where: combinedWhere }),
    ]);

    return {
      recipients: users.map((u) => formatRecipientInfo(u)),
      total,
    };
  }

  // 4. PARENT DIRECTORY
  if (senderUser.role === 'PARENT') {
    const parentProfile = await prisma.parent.findUnique({
      where: { userId: senderUser.id },
      include: {
        students: {
          include: {
            student: {
              include: {
                studentEnrollments: { where: { status: 'ACTIVE' } },
              },
            },
          },
        },
      },
    });

    const childClassIds = new Set();
    parentProfile?.students?.forEach((ps) => {
      if (ps.student?.classId) childClassIds.add(ps.student.classId);
      ps.student?.studentEnrollments?.forEach((e) => childClassIds.add(e.classId));
    });
    const classIdList = Array.from(childClassIds);

    const conditions = [
      // Admins
      { role: 'ADMIN', instituteId, isActive: true },
    ];

    if (classIdList.length > 0) {
      // Teachers assigned to any linked child
      conditions.push({
        role: 'TEACHER',
        instituteId,
        isActive: true,
        teacher: {
          OR: [
            { classes: { some: { id: { in: classIdList } } } },
            { subjects: { some: { classId: { in: classIdList } } } },
            { teacherAssignments: { some: { classId: { in: classIdList } } } },
          ],
        },
      });
    }

    let combinedWhere = {
      instituteId,
      isActive: true,
      id: { not: senderUser.id },
      OR: conditions,
    };

    if (role) combinedWhere.role = role;

    if (searchTerm) {
      combinedWhere.AND = [
        {
          OR: [
            { username: { contains: searchTerm } },
            { email: { contains: searchTerm } },
            { teacher: { name: { contains: searchTerm } } },
          ],
        },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: combinedWhere,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { username: 'asc' },
        include: {
          teacher: {
            include: {
              classes: true,
              subjects: true,
            },
          },
        },
      }),
      prisma.user.count({ where: combinedWhere }),
    ]);

    // Build context with child links
    const formatted = users.map((u) => {
      const info = formatRecipientInfo(u);
      if (u.role === 'TEACHER') {
        const linkedChildNames = parentProfile?.students
          ?.filter((ps) => {
            const cid = ps.student?.classId;
            const enrolCids = ps.student?.studentEnrollments?.map((e) => e.classId) || [];
            const teacherClasses = u.teacher?.classes?.map((c) => c.id) || [];
            const teacherSubjects = u.teacher?.subjects?.map((s) => s.classId) || [];
            const allTClasses = new Set([...teacherClasses, ...teacherSubjects]);
            return (cid && allTClasses.has(cid)) || enrolCids.some((c) => allTClasses.has(c));
          })
          .map((ps) => ps.student?.name || `${ps.student?.firstName || ''} ${ps.student?.lastName || ''}`.trim())
          .filter(Boolean);

        if (linkedChildNames?.length) {
          info.context = `Teacher of ${linkedChildNames.join(', ')}`;
        }
      }
      return info;
    });

    return { recipients: formatted, total };
  }

  return { recipients: [], total: 0 };
}

/**
 * Normalizes user record into displayable recipient object
 */
export function formatRecipientInfo(user) {
  let displayName = user.username;
  let context = '';
  let avatar = null;
  let code = null;

  if (user.role === 'TEACHER' && user.teacher) {
    const t = user.teacher;
    displayName = t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim() || user.username;
    context = t.designation || 'Faculty Member';
    code = t.employeeId;
  } else if (user.role === 'STUDENT' && user.student) {
    const s = user.student;
    displayName = s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim() || user.username;
    context = s.class ? `Class ${s.class.name}${s.class.section ? ` (${s.class.section})` : ''}` : 'Student';
    code = s.admissionNumber || s.rollNo;
    avatar = s.profilePic;
  } else if (user.role === 'PARENT' && user.parent) {
    const p = user.parent;
    displayName = p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || user.username;
    const children = p.students?.map((ps) => {
      const s = ps.student;
      return s ? (s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim()) : null;
    }).filter(Boolean);

    context = children?.length ? `Parent of ${children.join(', ')}` : 'Parent / Guardian';
  } else if (user.role === 'ADMIN') {
    context = 'Institute Administration';
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    displayName,
    context,
    code,
    avatar,
  };
}
