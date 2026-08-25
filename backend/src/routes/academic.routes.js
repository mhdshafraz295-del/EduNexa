import { Router } from 'express';
import {
  // Academic Years
  getAcademicYears,
  createAcademicYear,
  updateAcademicYear,
  setCurrentAcademicYear,
  toggleAcademicYearStatus,

  // Academic Levels
  getAcademicLevels,
  createAcademicLevel,
  updateAcademicLevel,
  deleteAcademicLevel,

  // Classes
  getClasses,
  createClass,
  updateClass,
  deleteClass,

  // Subjects & Class-Subjects
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getClassSubjects,
  assignClassSubjects,
  removeClassSubject,

  // Teacher Assignments
  getTeacherAssignments,
  createTeacherAssignment,
  deleteTeacherAssignment,
  getTeacherWorkload,

  // Student Enrollments
  getEnrollments,
  createEnrollment,
  bulkEnrollStudents,
  updateEnrollmentStatus,
} from '../controllers/academic.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { requireAdminOrTeacher } from '../middleware/role.middleware.js';
import { requireActiveSubscription, checkLimit } from '../middleware/subscription.middleware.js';

const router = Router();

router.use(authenticate, tenantMiddleware, requireActiveSubscription);

// Academic Years
router.get('/years', getAcademicYears);
router.post('/years', requireAdminOrTeacher, createAcademicYear);
router.put('/years/:id', requireAdminOrTeacher, updateAcademicYear);
router.patch('/years/:id/current', requireAdminOrTeacher, setCurrentAcademicYear);
router.patch('/years/:id/status', requireAdminOrTeacher, toggleAcademicYearStatus);

// Academic Levels / Grades
router.get('/levels', getAcademicLevels);
router.post('/levels', requireAdminOrTeacher, createAcademicLevel);
router.put('/levels/:id', requireAdminOrTeacher, updateAcademicLevel);
router.delete('/levels/:id', requireAdminOrTeacher, deleteAcademicLevel);

// Classes / Batches
router.get('/classes', getClasses);
router.post('/classes', requireAdminOrTeacher, checkLimit('classes'), createClass);
router.put('/classes/:id', requireAdminOrTeacher, updateClass);
router.delete('/classes/:id', requireAdminOrTeacher, deleteClass);

// Subjects & Curriculum
router.get('/subjects', getSubjects);
router.post('/subjects', requireAdminOrTeacher, createSubject);
router.put('/subjects/:id', requireAdminOrTeacher, updateSubject);
router.delete('/subjects/:id', requireAdminOrTeacher, deleteSubject);

// Class-Subject Mappings
router.get('/classes/:id/subjects', getClassSubjects);
router.post('/classes/:id/subjects', requireAdminOrTeacher, assignClassSubjects);
router.delete('/classes/:id/subjects/:subjectId', requireAdminOrTeacher, removeClassSubject);

// Teacher Assignments & Workload
router.get('/teacher-assignments', getTeacherAssignments);
router.post('/teacher-assignments', requireAdminOrTeacher, createTeacherAssignment);
router.delete('/teacher-assignments/:id', requireAdminOrTeacher, deleteTeacherAssignment);
router.get('/teacher-assignments/workload/:teacherId', getTeacherWorkload);

// Student Enrollments & Bulk Operations
router.get('/enrollments', getEnrollments);
router.post('/enrollments', requireAdminOrTeacher, createEnrollment);
router.post('/enrollments/bulk', requireAdminOrTeacher, bulkEnrollStudents);
router.patch('/enrollments/:id/status', requireAdminOrTeacher, updateEnrollmentStatus);

export default router;
