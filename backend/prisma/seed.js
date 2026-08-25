import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed and migration for EduNexa SaaS...');

  // 1. Create or Find Default Demo Institute
  let demoInstitute = await prisma.institute.findFirst({
    where: {
      OR: [
        { code: 'EDU0001' },
        { slug: 'edunexa-demo' }
      ]
    }
  });

  if (!demoInstitute) {
    demoInstitute = await prisma.institute.create({
      data: {
        name: 'EduNexa Demo Institute',
        slug: 'edunexa-demo',
        code: 'EDU0001',
        email: 'contact@edunexa-demo.lk',
        phone: '+94 11 234 5678',
        address: '123 Innovation Way, Colombo 03, Sri Lanka',
        logo: '/logo.png',
        isActive: true,
      }
    });
    console.log(`✅ Created default demo institute: ${demoInstitute.name} (${demoInstitute.code})`);
  } else {
    console.log(`ℹ️ Found existing demo institute: ${demoInstitute.name} (${demoInstitute.code})`);
  }

  // 2. Create Platform SUPER_ADMIN (instituteId = null)
  const superAdminPasswordHash = await bcrypt.hash('SuperAdmin123!', 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@edunexa.com' },
    update: {
      role: 'SUPER_ADMIN',
      instituteId: null,
      isActive: true,
    },
    create: {
      username: 'superadmin',
      email: 'superadmin@edunexa.com',
      passwordHash: superAdminPasswordHash,
      role: 'SUPER_ADMIN',
      instituteId: null,
      isActive: true,
    }
  });
  console.log(`✅ Configured Platform SUPER_ADMIN: ${superAdmin.email}`);

  // 3. Create or Link Institute Admin for Demo Institute
  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
  const demoAdmin = await prisma.user.upsert({
    where: { email: 'admin@edunexa.com' },
    update: {
      role: 'ADMIN',
      instituteId: demoInstitute.id,
      isActive: true,
    },
    create: {
      username: 'demoadmin',
      email: 'admin@edunexa.com',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      instituteId: demoInstitute.id,
      isActive: true,
    }
  });
  console.log(`✅ Configured Demo Institute Admin: ${demoAdmin.email}`);

  // Preserved pre-existing user
  await prisma.user.upsert({
    where: { email: 'mhdshafraz295@gmail.com' },
    update: {
      role: 'ADMIN',
      instituteId: demoInstitute.id,
      isActive: true,
    },
    create: {
      username: 'mhdshafraz295@gmail.com',
      email: 'mhdshafraz295@gmail.com',
      passwordHash: '$2a$10$NpTCW3HHZRtpUBIH2fE3POXn8bGbfwnqYWVrVcYvq9BMc6jEyNeBG',
      role: 'ADMIN',
      instituteId: demoInstitute.id,
      isActive: true,
    }
  });
  console.log(`✅ Preserved pre-existing admin user: mhdshafraz295@gmail.com`);

  // 4. Create or Link Demo Teacher
  const teacherPasswordHash = await bcrypt.hash('Teacher123!', 10);
  const demoTeacherUser = await prisma.user.upsert({
    where: { email: 'teacher@edunexa.com' },
    update: {
      role: 'TEACHER',
      instituteId: demoInstitute.id,
      isActive: true,
    },
    create: {
      username: 'demoteacher',
      email: 'teacher@edunexa.com',
      passwordHash: teacherPasswordHash,
      role: 'TEACHER',
      instituteId: demoInstitute.id,
      isActive: true,
    }
  });

  const demoTeacher = await prisma.teacher.upsert({
    where: { userId: demoTeacherUser.id },
    update: {
      name: 'Sarah Jenkins',
      instituteId: demoInstitute.id,
      employeeId: 'EMP-001',
      phone: '+94 77 123 4567',
      designation: 'Senior Mathematics Instructor',
      qualification: 'M.Sc. in Applied Mathematics',
    },
    create: {
      userId: demoTeacherUser.id,
      instituteId: demoInstitute.id,
      employeeId: 'EMP-001',
      name: 'Sarah Jenkins',
      phone: '+94 77 123 4567',
      designation: 'Senior Mathematics Instructor',
      qualification: 'M.Sc. in Applied Mathematics',
    }
  });
  console.log(`✅ Configured Demo Teacher: ${demoTeacher.name}`);

  // 5. Create Demo Classes & Subjects for Demo Institute
  let class10A = await prisma.class.findFirst({
    where: { instituteId: demoInstitute.id, name: 'Grade 10', section: 'A' }
  });
  if (!class10A) {
    class10A = await prisma.class.create({
      data: {
        instituteId: demoInstitute.id,
        name: 'Grade 10',
        section: 'A',
        classTeacherId: demoTeacher.id,
      }
    });
  }

  let class11A = await prisma.class.findFirst({
    where: { instituteId: demoInstitute.id, name: 'Grade 11', section: 'A' }
  });
  if (!class11A) {
    class11A = await prisma.class.create({
      data: {
        instituteId: demoInstitute.id,
        name: 'Grade 11',
        section: 'A',
        classTeacherId: demoTeacher.id,
      }
    });
  }

  const subjects = [
    { name: 'Mathematics', code: 'MATH-10' },
    { name: 'Science & Physics', code: 'SCI-10' },
    { name: 'English Literature', code: 'ENG-10' },
    { name: 'Information Technology', code: 'IT-10' },
  ];

  for (const s of subjects) {
    const existingSub = await prisma.subject.findFirst({
      where: { instituteId: demoInstitute.id, code: s.code }
    });
    if (!existingSub) {
      await prisma.subject.create({
        data: {
          instituteId: demoInstitute.id,
          name: s.name,
          code: s.code,
          classId: class10A.id,
        }
      });
    }
  }

  // 6. Create Demo Student & Parent
  const studentPasswordHash = await bcrypt.hash('Student123!', 10);
  const demoStudentUser = await prisma.user.upsert({
    where: { email: 'student@edunexa.com' },
    update: {
      role: 'STUDENT',
      instituteId: demoInstitute.id,
      isActive: true,
    },
    create: {
      username: 'demostudent',
      email: 'student@edunexa.com',
      passwordHash: studentPasswordHash,
      role: 'STUDENT',
      instituteId: demoInstitute.id,
      isActive: true,
    }
  });

  const demoStudent = await prisma.student.upsert({
    where: { userId: demoStudentUser.id },
    update: {
      name: 'Alex Morgan',
      instituteId: demoInstitute.id,
      admissionNumber: 'ADM-2026-001',
      classId: class10A.id,
      gender: 'Male',
      phone: '+94 71 987 6543',
      address: '45 Palm Grove, Colombo',
    },
    create: {
      userId: demoStudentUser.id,
      instituteId: demoInstitute.id,
      admissionNumber: 'ADM-2026-001',
      name: 'Alex Morgan',
      classId: class10A.id,
      gender: 'Male',
      phone: '+94 71 987 6543',
      address: '45 Palm Grove, Colombo',
    }
  });

  const parentPasswordHash = await bcrypt.hash('Parent123!', 10);
  const demoParentUser = await prisma.user.upsert({
    where: { email: 'parent@edunexa.com' },
    update: {
      role: 'PARENT',
      instituteId: demoInstitute.id,
      isActive: true,
    },
    create: {
      username: 'demoparent',
      email: 'parent@edunexa.com',
      passwordHash: parentPasswordHash,
      role: 'PARENT',
      instituteId: demoInstitute.id,
      isActive: true,
    }
  });

  const demoParent = await prisma.parent.upsert({
    where: { userId: demoParentUser.id },
    update: {
      name: 'David Morgan',
      instituteId: demoInstitute.id,
      phone: '+94 70 555 1234',
      occupation: 'Civil Engineer',
    },
    create: {
      userId: demoParentUser.id,
      instituteId: demoInstitute.id,
      name: 'David Morgan',
      phone: '+94 70 555 1234',
      occupation: 'Civil Engineer',
    }
  });

  // Link Parent & Student
  await prisma.parentStudent.upsert({
    where: {
      parentId_studentId: {
        parentId: demoParent.id,
        studentId: demoStudent.id,
      }
    },
    update: {},
    create: {
      parentId: demoParent.id,
      studentId: demoStudent.id,
      relationship: 'Father',
    }
  });

  // 7. Seed second institute for multi-tenancy verification: "Royal Academy"
  let royalInstitute = await prisma.institute.findFirst({
    where: { code: 'EDU0002' }
  });
  if (!royalInstitute) {
    royalInstitute = await prisma.institute.create({
      data: {
        name: 'Royal International Academy',
        slug: 'royal-academy',
        code: 'EDU0002',
        email: 'info@royalacademy.edu',
        phone: '+94 11 999 8888',
        address: '500 Royal Way, Kandy, Sri Lanka',
        logo: '/logo.png',
        isActive: true,
      }
    });

    const royalAdminPassword = await bcrypt.hash('RoyalAdmin123!', 10);
    const royalAdminUser = await prisma.user.create({
      data: {
        username: 'royaladmin',
        email: 'admin@royalacademy.edu',
        passwordHash: royalAdminPassword,
        role: 'ADMIN',
        instituteId: royalInstitute.id,
        isActive: true,
      }
    });

    // Create Grade 10-A in Royal Academy (proving composite uniqueness across institutes)
    await prisma.class.create({
      data: {
        instituteId: royalInstitute.id,
        name: 'Grade 10',
        section: 'A',
      }
    });
    console.log(`✅ Seeded secondary institute for multi-tenancy verification: ${royalInstitute.name}`);
  }

  // 8. Assign any unassigned existing users to Demo Institute if they are not SUPER_ADMIN
  const unassignedUsers = await prisma.user.findMany({
    where: {
      instituteId: null,
      role: { not: 'SUPER_ADMIN' }
    }
  });

  for (const u of unassignedUsers) {
    await prisma.user.update({
      where: { id: u.id },
      data: { instituteId: demoInstitute.id }
    });
  }

  // 9. Seed Centralized Feature Catalog
  console.log('📦 Seeding Dynamic Feature Catalog...');
  const featureCatalog = [
    // Academic
    { code: 'ATTENDANCE', name: 'Daily Attendance Tracking', category: 'Academic', description: 'Student and teacher daily digital attendance marking & SMS alerts' },
    { code: 'TIMETABLE', name: 'Class Timetables & Schedules', category: 'Academic', description: 'Interactive timetable matrix and room allocation scheduler' },
    { code: 'ASSIGNMENTS', name: 'Homework & Assignments', category: 'Academic', description: 'Digital assignment creation, student submissions, and grading' },
    { code: 'ONLINE_EXAMS', name: 'Online Computer-Based Exams', category: 'Academic', description: 'Automated MCQ exams with timer and instant result calculation' },
    { code: 'WRITTEN_EXAMS', name: 'Term & Written Exams', category: 'Academic', description: 'Custom examination structures, marks entry, and GPA computation' },
    { code: 'BULK_MARK_ENTRY', name: 'Bulk Marks Entry Sheet', category: 'Academic', description: 'Fast spreadsheet-style marks entry for entire batches' },
    { code: 'PDF_REPORTS', name: 'PDF Report Cards & Transcripts', category: 'Academic', description: 'Customizable branded academic report cards and student profiles' },
    { code: 'CSV_EXPORT', name: 'CSV & Excel Data Export', category: 'Academic', description: 'One-click full dataset exports for offline reporting' },

    // Learning
    { code: 'STUDY_MATERIALS', name: 'Study Notes & Tutes (Multi-Language)', category: 'Learning', description: 'Digital PDF notes, tutes, and materials in Tamil, English, and Sinhala' },
    { code: 'LMS', name: 'Learning Management System (LMS)', category: 'Learning', description: 'Video lessons, study modules, and structured digital curriculums' },
    { code: 'COURSES', name: 'Online Courses & Materials', category: 'Learning', description: 'Course management, PDF notes, and downloadable study kits' },
    { code: 'ZOOM_CLASSES', name: 'Live Zoom / Online Classes', category: 'Learning', description: 'One-click live classroom meetings and session recording links' },

    // Finance
    { code: 'FEES', name: 'Fee Structures & Collections', category: 'Finance', description: 'Tuition fees, lab fees, admission fees, and installment plans' },
    { code: 'INVOICES', name: 'Invoicing & Official Receipts', category: 'Finance', description: 'Automated billing, printable invoices, and official payment receipts' },
    { code: 'PAYMENT_METHODS', name: 'Multiple Payment Methods', category: 'Finance', description: 'Support for cash, card, bank transfer, and gateway receipts' },

    // Communication
    { code: 'INTERNAL_MESSAGES', name: 'Internal Direct Messaging', category: 'Communication', description: 'In-app secure communications between teachers, students, and admins' },
    { code: 'ANNOUNCEMENTS', name: 'Notice Board & Announcements', category: 'Communication', description: 'Broadcast urgent circulars to specific classes or entire institute' },
    { code: 'SUPPORT_DESK', name: 'Helpdesk & Support Tickets', category: 'Communication', description: 'In-house ticketing system for student and parent inquiries' },
    { code: 'WHATSAPP', name: 'WhatsApp Business API Integration', category: 'Communication', description: 'Automated WhatsApp alerts for fees, attendance, and exam marks' },

    // Engagement & Administration
    { code: 'STUDENT_MANAGEMENT', name: 'Full Student Lifecycle Management', category: 'Engagement', description: 'Admissions, profiles, parent linkages, and transfer certificates' },
    { code: 'TEACHER_MANAGEMENT', name: 'Faculty & Teacher Management', category: 'Engagement', description: 'Staff directory, payroll profiles, and subject assignments' },
    { code: 'PARENT_PORTAL', name: 'Parent Guardian Portal', category: 'Engagement', description: 'Real-time parent access to marks, attendance, and fee invoices' },
    { code: 'LIBRARY', name: 'Library & Book Issue Management', category: 'Engagement', description: 'Book inventory, barcode tracking, and overdue fine calculations' },
    { code: 'GALLERY', name: 'Campus Photo Gallery', category: 'Engagement', description: 'Events gallery and campus activity showcase' },
    { code: 'POLLS', name: 'Student & Staff Polls', category: 'Engagement', description: 'Interactive feedback surveys and voting polls' },
    { code: 'MARKETING', name: 'Marketing & Admission Popups', category: 'Engagement', description: 'Promotional popups and new batch registration announcements' },

    // Advanced
    { code: 'ADVANCED_ANALYTICS', name: 'Advanced Performance Analytics', category: 'Advanced', description: 'Deep charts, cohort analysis, and trend projections' },
    { code: 'CERTIFICATES', name: 'Automated Certificate Generator', category: 'Advanced', description: 'One-click course completion and achievement certificate issuance' },
    { code: 'ID_CARDS', name: 'Student & Staff ID Card Designer', category: 'Advanced', description: 'Printable barcode-enabled student and staff identity cards' },
    { code: 'MULTI_BRANCH', name: 'Multi-Campus / Multi-Branch', category: 'Advanced', description: 'Manage multiple physical branches under a unified master dashboard' },
  ];

  for (const f of featureCatalog) {
    await prisma.feature.upsert({
      where: { code: f.code },
      update: { name: f.name, category: f.category, description: f.description },
      create: { code: f.code, name: f.name, category: f.category, description: f.description },
    });
  }
  console.log(`✅ Seeded ${featureCatalog.length} platform features.`);

  // 10. Seed Demo Subscription Plans
  console.log('💳 Seeding Demo Subscription Plans...');
  const allFeatures = await prisma.feature.findMany();
  const featureMap = allFeatures.reduce((acc, f) => { acc[f.code] = f.id; return acc; }, {});

  // Plan 1: Starter
  const starterPlan = await prisma.subscriptionPlan.upsert({
    where: { id: 1 },
    update: {
      name: 'Starter Tier',
      description: 'Ideal for small learning centres, tuition classes, and emerging academies',
      price: 2500.00,
      currency: 'LKR',
      duration: 1,
      durationType: 'MONTHS',
      isActive: true,
      isPopular: false,
      displayOrder: 1,
      studentLimit: 150,
      teacherLimit: 10,
      adminLimit: 2,
      classLimit: 10,
      courseLimit: 5,
      storageLimitGb: 5,
      branchLimit: 1,
    },
    create: {
      id: 1,
      name: 'Starter Tier',
      description: 'Ideal for small learning centres, tuition classes, and emerging academies',
      price: 2500.00,
      currency: 'LKR',
      duration: 1,
      durationType: 'MONTHS',
      isActive: true,
      isPopular: false,
      displayOrder: 1,
      studentLimit: 150,
      teacherLimit: 10,
      adminLimit: 2,
      classLimit: 10,
      courseLimit: 5,
      storageLimitGb: 5,
      branchLimit: 1,
    },
  });

  // Plan 2: Standard (Popular)
  const standardPlan = await prisma.subscriptionPlan.upsert({
    where: { id: 2 },
    update: {
      name: 'Standard Institute',
      description: 'Complete academic management for medium-sized schools and institutes',
      price: 5000.00,
      currency: 'LKR',
      duration: 1,
      durationType: 'MONTHS',
      isActive: true,
      isPopular: true,
      displayOrder: 2,
      studentLimit: 500,
      teacherLimit: 30,
      adminLimit: 5,
      classLimit: 30,
      courseLimit: 20,
      storageLimitGb: 25,
      branchLimit: 2,
    },
    create: {
      id: 2,
      name: 'Standard Institute',
      description: 'Complete academic management for medium-sized schools and institutes',
      price: 5000.00,
      currency: 'LKR',
      duration: 1,
      durationType: 'MONTHS',
      isActive: true,
      isPopular: true,
      displayOrder: 2,
      studentLimit: 500,
      teacherLimit: 30,
      adminLimit: 5,
      classLimit: 30,
      courseLimit: 20,
      storageLimitGb: 25,
      branchLimit: 2,
    },
  });

  // Plan 3: Premium Enterprise
  const premiumPlan = await prisma.subscriptionPlan.upsert({
    where: { id: 3 },
    update: {
      name: 'Premium Enterprise',
      description: 'Unlimited power, automated WhatsApp alerts, and multi-branch control',
      price: 9500.00,
      currency: 'LKR',
      duration: 1,
      durationType: 'MONTHS',
      isActive: true,
      isPopular: false,
      displayOrder: 3,
      studentLimit: null, // Unlimited
      teacherLimit: null, // Unlimited
      adminLimit: 15,
      classLimit: null,
      courseLimit: null,
      storageLimitGb: 100,
      branchLimit: 5,
    },
    create: {
      id: 3,
      name: 'Premium Enterprise',
      description: 'Unlimited power, automated WhatsApp alerts, and multi-branch control',
      price: 9500.00,
      currency: 'LKR',
      duration: 1,
      durationType: 'MONTHS',
      isActive: true,
      isPopular: false,
      displayOrder: 3,
      studentLimit: null,
      teacherLimit: null,
      adminLimit: 15,
      classLimit: null,
      courseLimit: null,
      storageLimitGb: 100,
      branchLimit: 5,
    },
  });

  // Link Features to Plans
  const starterFeatures = ['STUDENT_MANAGEMENT', 'TEACHER_MANAGEMENT', 'PARENT_PORTAL', 'ATTENDANCE', 'TIMETABLE', 'ASSIGNMENTS', 'WRITTEN_EXAMS', 'PDF_REPORTS', 'FEES', 'INVOICES', 'ANNOUNCEMENTS', 'GALLERY', 'STUDY_MATERIALS'];
  const standardFeatures = [...starterFeatures, 'ONLINE_EXAMS', 'BULK_MARK_ENTRY', 'CSV_EXPORT', 'LMS', 'COURSES', 'PAYMENT_METHODS', 'LIBRARY', 'SUPPORT_DESK', 'INTERNAL_MESSAGES', 'POLLS', 'MARKETING'];
  
  // Link Starter Features
  for (const feat of allFeatures) {
    await prisma.planFeature.upsert({
      where: { planId_featureId: { planId: starterPlan.id, featureId: feat.id } },
      update: { isEnabled: starterFeatures.includes(feat.code) },
      create: { planId: starterPlan.id, featureId: feat.id, isEnabled: starterFeatures.includes(feat.code) },
    });
  }

  // Link Standard Features
  for (const feat of allFeatures) {
    await prisma.planFeature.upsert({
      where: { planId_featureId: { planId: standardPlan.id, featureId: feat.id } },
      update: { isEnabled: standardFeatures.includes(feat.code) },
      create: { planId: standardPlan.id, featureId: feat.id, isEnabled: standardFeatures.includes(feat.code) },
    });
  }

  // Link Premium Features (All Enabled)
  for (const feat of allFeatures) {
    await prisma.planFeature.upsert({
      where: { planId_featureId: { planId: premiumPlan.id, featureId: feat.id } },
      update: { isEnabled: true },
      create: { planId: premiumPlan.id, featureId: feat.id, isEnabled: true },
    });
  }

  // 11. Seed Platform Bank Accounts for Manual Bank Transfers
  console.log('🏦 Seeding Platform Bank Accounts...');
  await prisma.platformBankAccount.upsert({
    where: { id: 1 },
    update: {
      bankName: 'Commercial Bank of Ceylon',
      branchName: 'Colombo Super Branch',
      accountHolderName: 'EduNexa Technologies (Pvt) Ltd',
      accountNumber: '8004592019',
      instructions: 'Please include your Institute Code in the deposit slip / transfer remark.',
      isActive: true,
      displayOrder: 1,
    },
    create: {
      id: 1,
      bankName: 'Commercial Bank of Ceylon',
      branchName: 'Colombo Super Branch',
      accountHolderName: 'EduNexa Technologies (Pvt) Ltd',
      accountNumber: '8004592019',
      instructions: 'Please include your Institute Code in the deposit slip / transfer remark.',
      isActive: true,
      displayOrder: 1,
    },
  });

  await prisma.platformBankAccount.upsert({
    where: { id: 2 },
    update: {
      bankName: 'Bank of Ceylon (BOC)',
      branchName: 'Kandy Corporate City Branch',
      accountHolderName: 'EduNexa Technologies (Pvt) Ltd',
      accountNumber: '1004829103',
      instructions: 'Online banking transfers & cash deposits accepted. Upload receipt immediately.',
      isActive: true,
      displayOrder: 2,
    },
    create: {
      id: 2,
      bankName: 'Bank of Ceylon (BOC)',
      branchName: 'Kandy Corporate City Branch',
      accountHolderName: 'EduNexa Technologies (Pvt) Ltd',
      accountNumber: '1004829103',
      instructions: 'Online banking transfers & cash deposits accepted. Upload receipt immediately.',
      isActive: true,
      displayOrder: 2,
    },
  });

  console.log('✅ Configured Starter, Standard, and Premium demo subscription plans with feature bindings.');
  console.log('✅ Configured Official EduNexa Platform Bank Accounts.');
  console.log('🎉 EduNexa SaaS database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
