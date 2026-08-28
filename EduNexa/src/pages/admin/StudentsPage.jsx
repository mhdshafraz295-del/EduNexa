import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { GraduationCap, Plus, Search, UserPlus, X, Check, AlertCircle, Edit3, BookOpen } from 'lucide-react';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);

  // Registration Form State
  const [formData, setFormData] = useState({
    name: '',
    admissionNumber: '',
    email: '',
    password: '',
    classId: '',
    phone: '',
    gender: 'Male',
    address: '',
  });
  const [registerClassSubjects, setRegisterClassSubjects] = useState([]);
  const [registerSelectedSubjectIds, setRegisterSelectedSubjectIds] = useState([]);
  const [loadingRegisterClassSubjects, setLoadingRegisterClassSubjects] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit Form State
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    gender: 'Male',
    address: '',
    classId: '',
  });
  const [editClassSubjects, setEditClassSubjects] = useState([]);
  const [editSelectedSubjectIds, setEditSelectedSubjectIds] = useState([]);
  const [loadingEditClassSubjects, setLoadingEditClassSubjects] = useState(false);
  const [editFormLoading, setEditFormLoading] = useState(false);
  const [editFormError, setEditFormError] = useState('');

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await apiRequest(`/students?search=${encodeURIComponent(search)}`);
      if (res.success) setStudents(res.data);
    } catch (err) {
      console.error('Fetch students error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await apiRequest('/academic/classes');
      if (res.success) setClasses(res.data);
    } catch (err) {
      console.error('Fetch classes error:', err);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchStudents();
  };

  // Cascading class selection for Registration Modal
  const handleRegisterClassChange = async (selectedClassId) => {
    setFormData((prev) => ({ ...prev, classId: selectedClassId }));
    setRegisterSelectedSubjectIds([]);

    if (!selectedClassId) {
      setRegisterClassSubjects([]);
      return;
    }

    try {
      setLoadingRegisterClassSubjects(true);
      const res = await apiRequest(`/academic/classes/${selectedClassId}/subjects`);
      if (res.success && Array.isArray(res.data)) {
        const subjects = res.data.map((item) => item.subject).filter(Boolean);
        setRegisterClassSubjects(subjects);
        // Pre-select all subjects by default for convenience
        setRegisterSelectedSubjectIds(subjects.map((s) => s.id));
      } else {
        setRegisterClassSubjects([]);
      }
    } catch (err) {
      console.error('Error fetching class subjects:', err);
      setRegisterClassSubjects([]);
    } finally {
      setLoadingRegisterClassSubjects(false);
    }
  };

  const toggleRegisterSubject = (subjectId) => {
    if (registerSelectedSubjectIds.includes(subjectId)) {
      setRegisterSelectedSubjectIds(registerSelectedSubjectIds.filter((id) => id !== subjectId));
    } else {
      setRegisterSelectedSubjectIds([...registerSelectedSubjectIds, subjectId]);
    }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setFormError('Student name and email are required.');
      return;
    }

    try {
      setFormLoading(true);
      setFormError('');
      const payload = {
        ...formData,
        subjectIds: registerSelectedSubjectIds,
      };

      const res = await apiRequest('/students', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setIsModalOpen(false);
        setFormData({
          name: '',
          admissionNumber: '',
          email: '',
          password: '',
          classId: '',
          phone: '',
          gender: 'Male',
          address: '',
        });
        setRegisterClassSubjects([]);
        setRegisterSelectedSubjectIds([]);
        fetchStudents();
      }
    } catch (err) {
      setFormError(err.message || 'Failed to register student.');
    } finally {
      setFormLoading(false);
    }
  };

  // Open Edit Modal and pre-fill details
  const openEditModal = async (student) => {
    setEditingStudent(student);
    const initialClassId = student.classId ? student.classId.toString() : '';

    setEditFormData({
      name: student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim(),
      phone: student.phone || '',
      gender: student.gender || 'Male',
      address: student.address || '',
      classId: initialClassId,
    });

    setEditFormError('');
    setIsEditModalOpen(true);

    if (initialClassId) {
      await fetchEditClassSubjects(initialClassId, student);
    } else {
      setEditClassSubjects([]);
      setEditSelectedSubjectIds([]);
    }
  };

  const fetchEditClassSubjects = async (targetClassId, studentObj = editingStudent) => {
    if (!targetClassId) {
      setEditClassSubjects([]);
      setEditSelectedSubjectIds([]);
      return;
    }

    try {
      setLoadingEditClassSubjects(true);
      const res = await apiRequest(`/academic/classes/${targetClassId}/subjects`);
      if (res.success && Array.isArray(res.data)) {
        const subjects = res.data.map((item) => item.subject).filter(Boolean);
        setEditClassSubjects(subjects);

        // Check if student was explicitly subject-configured
        if (studentObj && studentObj.subjectsConfigured) {
          const currentlyEnrolledIds = (studentObj.studentSubjects || []).map((ss) => ss.subjectId);
          setEditSelectedSubjectIds(currentlyEnrolledIds);
        } else {
          // Legacy unconfigured student: pre-select all class subjects as initial draft
          setEditSelectedSubjectIds(subjects.map((s) => s.id));
        }
      } else {
        setEditClassSubjects([]);
        setEditSelectedSubjectIds([]);
      }
    } catch (err) {
      console.error('Error loading edit class subjects:', err);
      setEditClassSubjects([]);
      setEditSelectedSubjectIds([]);
    } finally {
      setLoadingEditClassSubjects(false);
    }
  };

  const handleEditClassChange = async (newClassId) => {
    setEditFormData((prev) => ({ ...prev, classId: newClassId }));
    setEditSelectedSubjectIds([]);
    await fetchEditClassSubjects(newClassId, null);
  };

  const toggleEditSubject = (subjectId) => {
    if (editSelectedSubjectIds.includes(subjectId)) {
      setEditSelectedSubjectIds(editSelectedSubjectIds.filter((id) => id !== subjectId));
    } else {
      setEditSelectedSubjectIds([...editSelectedSubjectIds, subjectId]);
    }
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;

    try {
      setEditFormLoading(true);
      setEditFormError('');

      const payload = {
        name: editFormData.name,
        phone: editFormData.phone,
        gender: editFormData.gender,
        address: editFormData.address,
        classId: editFormData.classId || null,
        subjectIds: editSelectedSubjectIds,
      };

      const res = await apiRequest(`/students/${editingStudent.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setIsEditModalOpen(false);
        setEditingStudent(null);
        fetchStudents();
      }
    } catch (err) {
      setEditFormError(err.message || 'Failed to update student.');
    } finally {
      setEditFormLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Students Directory</h2>
          <p className="text-sm text-slate-500">Manage enrolled student records within your institute</p>
        </div>
        <button
          onClick={() => {
            setFormData({
              name: '',
              admissionNumber: '',
              email: '',
              password: '',
              classId: '',
              phone: '',
              gender: 'Male',
              address: '',
            });
            setRegisterClassSubjects([]);
            setRegisterSelectedSubjectIds([]);
            setFormError('');
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#FFD978]" />
          <span>Register Student</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, admission no, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
          />
        </form>
        <span className="text-xs text-slate-500 font-semibold px-2 sm:px-4 self-start sm:self-auto">
          Total: {students.length} Students
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
          </div>
        ) : students.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <GraduationCap className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-bold text-slate-700">No students found</p>
            <p className="text-xs text-slate-400 mt-1">Register a new student to populate this directory.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-6">Student</th>
                  <th className="py-3 px-6">Admission No</th>
                  <th className="py-3 px-6">Class / Division</th>
                  <th className="py-3 px-6">Subjects</th>
                  <th className="py-3 px-6">Contact</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {students.map((st) => {
                  const hasExplicitSubjects = st.subjectsConfigured;
                  const enrolledCount = (st.studentSubjects || []).length;

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center font-bold text-xs">
                            {st.name?.slice(0, 2).toUpperCase() || 'ST'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{st.name || `${st.firstName || ''} ${st.lastName || ''}`}</p>
                            <p className="text-xs text-slate-400">{st.user?.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {st.admissionNumber || st.rollNo}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        {st.class ? (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                            {st.class.name} {st.class.section ? `(${st.class.section})` : ''}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        {hasExplicitSubjects ? (
                          enrolledCount > 0 ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                              {enrolledCount} {enrolledCount === 1 ? 'Subject' : 'Subjects'}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">
                              0 Subjects (Custom)
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            All Class Subjects (Default)
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-xs text-slate-600">
                        {st.phone || 'N/A'}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => openEditModal(st)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-900 hover:text-white font-bold text-xs text-slate-700 transition-all cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFD978] text-slate-900 flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Register Student</h3>
                  <p className="text-xs text-slate-400">Scoped strictly to your institute</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="p-6 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Admission Number</label>
                  <input
                    type="text"
                    placeholder="Auto-generated if empty"
                    value={formData.admissionNumber}
                    onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Class</label>
                  <select
                    value={formData.classId}
                    onChange={(e) => handleRegisterClassChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  >
                    <option value="">Select Class...</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.section ? `(${c.section})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Per-Student Subject Selection */}
              {formData.classId && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Select Subjects ({registerSelectedSubjectIds.length} Selected)
                    </label>
                  </div>

                  {loadingRegisterClassSubjects ? (
                    <div className="py-4 text-center text-xs text-slate-400">
                      Loading class subjects...
                    </div>
                  ) : registerClassSubjects.length === 0 ? (
                    <p className="text-xs text-slate-400 italic p-3 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-center">
                      No subjects are assigned to this class yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-2xl bg-slate-50">
                      {registerClassSubjects.map((sub) => {
                        const isChecked = registerSelectedSubjectIds.includes(sub.id);
                        return (
                          <label
                            key={sub.id}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-white border-slate-900 text-slate-900 shadow-xs'
                                : 'bg-transparent border-slate-200 text-slate-600 hover:bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleRegisterSubject(sub.id)}
                              className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                            />
                            <span className="truncate">
                              {sub.name} <span className="text-[10px] text-slate-400">({sub.code})</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="alex@student.edu"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Password</label>
                  <input
                    type="password"
                    placeholder="Student123!"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+94 77 123 4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  {formLoading ? 'Registering...' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {isEditModalOpen && editingStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFD978] text-slate-900 flex items-center justify-center font-bold">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Edit Student Profile</h3>
                  <p className="text-xs text-slate-400">
                    Admission: {editingStudent.admissionNumber || editingStudent.rollNo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingStudent(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStudent} className="p-6 space-y-4 overflow-y-auto">
              {editFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student Email</label>
                  <input
                    type="text"
                    disabled
                    value={editingStudent.user?.email || ''}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-mono text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Class</label>
                  <select
                    value={editFormData.classId}
                    onChange={(e) => handleEditClassChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  >
                    <option value="">Select Class...</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.section ? `(${c.section})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Per-Student Subject Selection for Edit */}
              {editFormData.classId && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Selected Subjects ({editSelectedSubjectIds.length} Selected)
                    </label>
                  </div>

                  {loadingEditClassSubjects ? (
                    <div className="py-4 text-center text-xs text-slate-400">
                      Loading class subjects...
                    </div>
                  ) : editClassSubjects.length === 0 ? (
                    <p className="text-xs text-slate-400 italic p-3 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-center">
                      No subjects are assigned to this class yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-2xl bg-slate-50">
                      {editClassSubjects.map((sub) => {
                        const isChecked = editSelectedSubjectIds.includes(sub.id);
                        return (
                          <label
                            key={sub.id}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-white border-slate-900 text-slate-900 shadow-xs'
                                : 'bg-transparent border-slate-200 text-slate-600 hover:bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleEditSubject(sub.id)}
                              className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                            />
                            <span className="truncate">
                              {sub.name} <span className="text-[10px] text-slate-400">({sub.code})</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+94 77 123 4567"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingStudent(null);
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editFormLoading}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  {editFormLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
