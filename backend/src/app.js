import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import superAdminRoutes from './routes/superAdmin.routes.js';
import planRoutes from './routes/plan.routes.js';
import publicPlanRoutes from './routes/publicPlan.routes.js';
import bankAccountRoutes from './routes/bankAccount.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import subscriptionAdminRoutes from './routes/subscriptionAdmin.routes.js';
import academicRoutes from './routes/academic.routes.js';
import studentRoutes from './routes/student.routes.js';
import teacherRoutes from './routes/teacher.routes.js';
import feeRoutes from './routes/fee.routes.js';
import portalRoutes from './routes/portal.routes.js';
import timetableRoutes from './routes/timetable.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import examRoutes from './routes/exam.routes.js';
import examGroupRoutes from './routes/examGroup.routes.js';
import galleryRoutes from './routes/gallery.routes.js';
import messageRoutes from './routes/message.routes.js';
import platformAnnouncementRoutes from './routes/platformAnnouncement.routes.js';
import referralRoutes from './routes/referral.routes.js';
import platformCmsRoutes from './routes/platformCms.routes.js';
import studyMaterialRoutes from './routes/studyMaterial.routes.js';
import pollRoutes from './routes/poll.routes.js';
import parentRoutes from './routes/parent.routes.js';

import path from 'path';

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
  exposedHeaders: [
    'Content-Disposition',
    'Content-Type',
    'Content-Length'
  ],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Strictly expose ONLY public institute logos (signatures/stamps remain protected)
app.use('/uploads/branding/logos/public', express.static(path.join(process.cwd(), 'uploads', 'branding', 'logos', 'public')));

// Strictly expose ONLY published Platform CMS assets (draft assets remain protected)
app.use('/uploads/platform-cms/public', express.static(path.join(process.cwd(), 'uploads', 'platform-cms', 'public')));

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    platform: 'EduNexa Multi-Institute SaaS',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/super-admin', planRoutes);
app.use('/api/super-admin/bank-accounts', bankAccountRoutes);
app.use('/api/super-admin/subscriptions', subscriptionAdminRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);
app.use('/api/plans', publicPlanRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/invoices', feeRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/exam-groups', examGroupRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/platform-announcements', platformAnnouncementRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/platform-cms', platformCmsRoutes);
app.use('/api/study-materials', studyMaterialRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/portal', portalRoutes);

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.method} ${req.originalUrl} not found.`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An unexpected internal server error occurred.',
  });
});

export default app;
