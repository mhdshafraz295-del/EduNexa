import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { apiRequest } from '../../../services/api';
import AcademicYearsTab from './AcademicYearsTab';
import AcademicLevelsTab from './AcademicLevelsTab';
import TeacherAssignmentsTab from './TeacherAssignmentsTab';
import StudentEnrollmentTab from './StudentEnrollmentTab';
import ClassSubjectsModal from './ClassSubjectsModal';
import {
  Calendar,
  Layers,
  School,
  BookOpen,
  Users,
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function AcademicHubPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Determine initial tab from search params or pathname
  let defaultTab = 'classes';
  if (location.pathname === '/admin/classes') defaultTab = 'classes';
  else if (location.pathname === '/admin/subjects') defaultTab = 'subjects';

  const activeTab = searchParams.get('tab') || defaultTab;

  const [years, setYears] = useState([]);
  const [levels, setLevels] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Class Modal State
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [classFormData, setClassFormData] = useState({
    name: '',
    section: '',
    academicLevelId: '',
    academicYearId: '',
    medium: 'English',
    classType: 'PHYSICAL',
    capacity: 40,
    description: '',
  });

  // Subject Modal State
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [subjectFormData, setSubjectFormData] = useState({
    name: '',
    code: '',
    description: '',
  });

  // Class Subjects Modal
  const [targetClassForSubjects, setTargetClassForSubjects] = useState(null);
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAllAcademicData = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) setLoading(true);
      const [yearsRes, levelsRes, classesRes, subjectsRes] = await Promise.all([
        apiRequest('/academic/years'),
        apiRequest('/academic/levels'),
        apiRequest('/academic/classes'),
        apiRequest('/academic/subjects'),
      ]);

      if (yearsRes.success && Array.isArray(yearsRes.data)) setYears(yearsRes.data);
      if (levelsRes.success && Array.isArray(levelsRes.data)) setLevels(levelsRes.data);
      if (classesRes.success && Array.isArray(classesRes.data)) setClasses(classesRes.data);
      if (subjectsRes.success && Array.isArray(subjectsRes.data)) setSubjects(subjectsRes.data);
    } catch (err) {
      console.error('Failed to fetch academic data:', err);
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAcademicData(true);
  }, []);

  // Sync tab change
  const handleTabChange = (tabKey) => {
    setSearchParams({ tab: tabKey });
  };

  // --- Classes CRUD ---
  const openCreateClassModal = () => {
    setEditingClass(null);
    const currentYear = years.find((y) => y.isCurrent) || years[0];
    setClassFormData({
      name: '',
      section: 'A',
      academicLevelId: levels[0] ? levels[0].id : '',
      academicYearId: currentYear ? currentYear.id : '',
      medium: 'English',
      classType: 'PHYSICAL',
      capacity: 40,
      description: '',
    });
    setModalError('');
    setIsClassModalOpen(true);
  };

  const openEditClassModal = (cls) => {
    setEditingClass(cls);
    setClassFormData({
      name: cls.name,
      section: cls.section || '',
      academicLevelId: cls.academicLevelId || '',
      academicYearId: cls.academicYearId || '',
      medium: cls.medium || 'English',
      classType: cls.classType || 'PHYSICAL',
      capacity: cls.capacity || 40,
      description: cls.description || '',
    });
    setModalError('');
    setIsClassModalOpen(true);
  };

  const handleClassSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      setSubmitting(true);
      const url = editingClass ? `/academic/classes/${editingClass.id}` : '/academic/classes';
      const method = editingClass ? 'PUT' : 'POST';

      const res = await apiRequest(url, {
        method,
        body: JSON.stringify(classFormData),
      });

      if (res.success) {
        setIsClassModalOpen(false);
        // Immediate local state update for instant UI feedback
        if (editingClass) {
          setClasses((prev) => prev.map((c) => (c.id === res.data.id ? res.data : c)));
        } else {
          setClasses((prev) => [res.data, ...prev]);
        }
        // Background sync
        fetchAllAcademicData(false);
      }
    } catch (err) {
      setModalError(err.message || 'Failed to save Class.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClass = async (id) => {
    if (!window.confirm('Delete this class?')) return;
    try {
      setClasses((prev) => prev.filter((c) => c.id !== id));
      const res = await apiRequest(`/academic/classes/${id}`, { method: 'DELETE' });
      if (res.success) {
        fetchAllAcademicData(false);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete class.');
      fetchAllAcademicData(false);
    }
  };

  // --- Subjects CRUD ---
  const openCreateSubjectModal = () => {
    setEditingSubject(null);
    setSubjectFormData({ name: '', code: '', description: '' });
    setModalError('');
    setIsSubjectModalOpen(true);
  };

  const openEditSubjectModal = (sub) => {
    setEditingSubject(sub);
    setSubjectFormData({
      name: sub.name,
      code: sub.code,
      description: sub.description || '',
    });
    setModalError('');
    setIsSubjectModalOpen(true);
  };

  const handleSubjectSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      setSubmitting(true);
      const url = editingSubject ? `/academic/subjects/${editingSubject.id}` : '/academic/subjects';
      const method = editingSubject ? 'PUT' : 'POST';

      const res = await apiRequest(url, {
        method,
        body: JSON.stringify(subjectFormData),
      });

      if (res.success) {
        setIsSubjectModalOpen(false);
        // Immediate local state update
        if (editingSubject) {
          setSubjects((prev) => prev.map((s) => (s.id === res.data.id ? res.data : s)));
        } else {
          setSubjects((prev) => [res.data, ...prev]);
        }
        // Background sync
        fetchAllAcademicData(false);
      }
    } catch (err) {
      setModalError(err.message || 'Failed to save Subject.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubject = async (id) => {
    if (!window.confirm('Delete this subject?')) return;
    try {
      setSubjects((prev) => prev.filter((s) => s.id !== id));
      const res = await apiRequest(`/academic/subjects/${id}`, { method: 'DELETE' });
      if (res.success) {
        fetchAllAcademicData(false);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete subject.');
      fetchAllAcademicData(false);
    }
  };

  const tabs = [
    { key: 'classes', label: 'Classes & Batches', icon: School, count: classes.length },
    { key: 'subjects', label: 'Subjects & Curriculum', icon: BookOpen, count: subjects.length },
    { key: 'teachers', label: 'Teacher Assignments', icon: Users },
    { key: 'enrollments', label: 'Student Enrollments', icon: GraduationCap },
    { key: 'levels', label: 'Levels & Grades', icon: Layers, count: levels.length },
    { key: 'years', label: 'Academic Years', icon: Calendar, count: years.length },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
            Academic Management Foundation
          </span>
          <h2 className="text-2xl font-black text-slate-900 mt-1">Academics Hub</h2>
          <p className="text-xs text-slate-500">
            Configure academic years, grades, classes, subjects, teacher assignments, and student enrollments.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-xs whitespace-nowrap transition-all ${
                isActive
                  ? 'border-slate-900 text-slate-900 bg-white/60 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] ${
                    isActive ? 'bg-slate-900 text-[#FFD978]' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'classes' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Classes & Sections</h3>
                  <p className="text-xs text-slate-500">Manage academic cohorts, streams, and assign curriculum subjects.</p>
                </div>
                <button
                  onClick={openCreateClassModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Class</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classes.length === 0 ? (
                  <div className="col-span-full p-8 text-center bg-white rounded-3xl border border-slate-200">
                    <School className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-700">No Classes Created</p>
                    <p className="text-xs text-slate-400 mt-1">Create your first class to start assigning subjects and students.</p>
                  </div>
                ) : (
                  classes.map((cls) => (
                    <div
                      key={cls.id}
                      className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-sm transition-all space-y-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xl font-black text-slate-900">
                              {cls.name} {cls.section ? `(${cls.section})` : ''}
                            </h4>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                              {cls.medium || 'English'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Level: {cls.academicLevel?.name || 'Unassigned'} • Year: {cls.academicYear?.name || 'Current'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditClassModal(cls)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClass(cls.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400">Class Type</span>
                          <p className="font-bold text-slate-800">{cls.classType || 'PHYSICAL'}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase text-slate-400">Enrolled Students</span>
                          <p className="font-bold text-slate-800">
                            {cls._count?.studentEnrollments || cls._count?.students || 0} / {cls.capacity || '∞'}
                          </p>
                        </div>
                      </div>

                      {/* Assigned Subjects Summary */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-xs text-slate-500">
                          <strong>{cls.classSubjects?.length || 0}</strong> Subjects Assigned
                        </div>
                        <button
                          onClick={() => setTargetClassForSubjects(cls)}
                          className="text-xs font-bold text-slate-900 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-xl transition-colors"
                        >
                          Manage Subjects
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'subjects' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Subjects & Curriculum</h3>
                  <p className="text-xs text-slate-500">Create subject catalog with codes (e.g. MATH, SCI, ENG, ICT).</p>
                </div>
                <button
                  onClick={openCreateSubjectModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Subject</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjects.length === 0 ? (
                  <div className="col-span-full p-8 text-center bg-white rounded-3xl border border-slate-200">
                    <BookOpen className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-700">No Subjects Created</p>
                    <p className="text-xs text-slate-400 mt-1">Add curriculum subjects to assign to classes and faculty.</p>
                  </div>
                ) : (
                  subjects.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-sm transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-black text-slate-900">{sub.name}</h4>
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                              {sub.code}
                            </span>
                          </div>
                          {sub.description && <p className="text-xs text-slate-500 mt-1">{sub.description}</p>}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditSubjectModal(sub)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSubject(sub.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
                        <span>{sub._count?.classSubjects || sub.classSubjects?.length || 0} Classes Teaching</span>
                        <span>{sub._count?.teacherAssignments || 0} Teachers Assigned</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'teachers' && (
            <TeacherAssignmentsTab
              years={years}
              classes={classes}
              subjects={subjects}
              onRefresh={() => fetchAllAcademicData(false)}
            />
          )}

          {activeTab === 'enrollments' && (
            <StudentEnrollmentTab
              years={years}
              classes={classes}
            />
          )}

          {activeTab === 'levels' && (
            <AcademicLevelsTab
              levels={levels}
              onRefresh={() => fetchAllAcademicData(false)}
            />
          )}

          {activeTab === 'years' && (
            <AcademicYearsTab
              years={years}
              onRefresh={() => fetchAllAcademicData(false)}
            />
          )}
        </>
      )}

      {/* Class Create/Edit Modal */}
      {isClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">{editingClass ? 'Edit Class' : 'Create Class'}</h3>
              <button onClick={() => setIsClassModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleClassSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Class Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Grade 10"
                    value={classFormData.name}
                    onChange={(e) => setClassFormData({ ...classFormData, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Section / Batch</label>
                  <input
                    type="text"
                    placeholder="e.g. A, B, Weekend"
                    value={classFormData.section}
                    onChange={(e) => setClassFormData({ ...classFormData, section: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Academic Level</label>
                  <select
                    value={classFormData.academicLevelId}
                    onChange={(e) => setClassFormData({ ...classFormData, academicLevelId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
                  >
                    <option value="">None / Custom</option>
                    {levels.map((lvl) => (
                      <option key={lvl.id} value={lvl.id}>
                        {lvl.name} ({lvl.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Academic Year</label>
                  <select
                    value={classFormData.academicYearId}
                    onChange={(e) => setClassFormData({ ...classFormData, academicYearId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
                  >
                    <option value="">Current Year</option>
                    {years.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.isCurrent ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Medium</label>
                  <select
                    value={classFormData.medium}
                    onChange={(e) => setClassFormData({ ...classFormData, medium: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
                  >
                    <option value="English">English</option>
                    <option value="Sinhala">Sinhala</option>
                    <option value="Tamil">Tamil</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Class Type</label>
                  <select
                    value={classFormData.classType}
                    onChange={(e) => setClassFormData({ ...classFormData, classType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
                  >
                    <option value="PHYSICAL">PHYSICAL</option>
                    <option value="ONLINE">ONLINE</option>
                    <option value="HYBRID">HYBRID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Capacity</label>
                  <input
                    type="number"
                    value={classFormData.capacity}
                    onChange={(e) => setClassFormData({ ...classFormData, capacity: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsClassModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs"
                >
                  {submitting ? 'Saving...' : editingClass ? 'Update Class' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subject Create/Edit Modal */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">{editingSubject ? 'Edit Subject' : 'New Subject'}</h3>
              <button onClick={() => setIsSubjectModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubjectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mathematics, Science, ICT"
                  value={subjectFormData.name}
                  onChange={(e) => setSubjectFormData({ ...subjectFormData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Subject Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MATH, SCI, ICT10"
                  value={subjectFormData.code}
                  onChange={(e) => setSubjectFormData({ ...subjectFormData, code: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 uppercase focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Brief curriculum overview"
                  value={subjectFormData.description}
                  onChange={(e) => setSubjectFormData({ ...subjectFormData, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 resize-none focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsSubjectModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs"
                >
                  {submitting ? 'Saving...' : editingSubject ? 'Update Subject' : 'Create Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Class Subjects Assignment Modal */}
      <ClassSubjectsModal
        isOpen={Boolean(targetClassForSubjects)}
        onClose={() => setTargetClassForSubjects(null)}
        targetClass={targetClassForSubjects}
        allSubjects={subjects}
        onSaved={() => fetchAllAcademicData(false)}
      />
    </div>
  );
}
