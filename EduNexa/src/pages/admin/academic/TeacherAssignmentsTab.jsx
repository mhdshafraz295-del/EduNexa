import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';
import { Users, Plus, Trash2, BookOpen, School, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

export default function TeacherAssignmentsTab({ years, classes, subjects, onRefresh }) {
  const [assignments, setAssignments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedYearFilter, setSelectedYearFilter] = useState('');
  const [formData, setFormData] = useState({
    academicYearId: '',
    classId: '',
    subjectId: '',
    teacherId: '',
    role: 'PRIMARY',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchAssignments = async (yearFilter = selectedYearFilter) => {
    try {
      setLoading(true);
      const url = yearFilter
        ? `/academic/teacher-assignments?academicYearId=${yearFilter}`
        : '/academic/teacher-assignments';
      const [assignRes, teachRes] = await Promise.all([
        apiRequest(url),
        apiRequest('/teachers'),
      ]);

      if (assignRes.success && Array.isArray(assignRes.data)) setAssignments(assignRes.data);
      if (teachRes.success && Array.isArray(teachRes.data)) setTeachers(teachRes.data);
    } catch (err) {
      console.error('Error fetching teacher assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments(selectedYearFilter);
  }, [selectedYearFilter]);

  const openCreateModal = () => {
    const currentYear = years.find((y) => y.isCurrent) || years[0];
    setFormData({
      academicYearId: selectedYearFilter || (currentYear ? currentYear.id.toString() : ''),
      classId: classes[0] ? classes[0].id.toString() : '',
      subjectId: subjects[0] ? subjects[0].id.toString() : '',
      teacherId: teachers[0] ? teachers[0].id.toString() : '',
      role: 'PRIMARY',
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setSubmitting(true);
      const res = await apiRequest('/academic/teacher-assignments', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (res.success) {
        setIsModalOpen(false);
        // If year filter is active and doesn't match, align it or clear it
        if (selectedYearFilter && formData.academicYearId && selectedYearFilter !== formData.academicYearId.toString()) {
          setSelectedYearFilter(formData.academicYearId.toString());
        } else {
          // Immediate local state update
          if (res.data) {
            setAssignments((prev) => [res.data, ...prev.filter((a) => a.id !== res.data.id)]);
          }
          await fetchAssignments(selectedYearFilter);
        }
        onRefresh?.();
      }
    } catch (err) {
      setError(err.message || 'Failed to create teacher assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this teacher assignment?')) return;
    try {
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      const res = await apiRequest(`/academic/teacher-assignments/${id}`, { method: 'DELETE' });
      if (res.success) {
        fetchAssignments(selectedYearFilter);
        onRefresh?.();
      }
    } catch (err) {
      alert(err.message || 'Failed to remove assignment.');
      fetchAssignments(selectedYearFilter);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-900">Faculty & Subject Assignments</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Assign primary and assistant teachers to specific academic years, classes, and subjects.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedYearFilter}
            onChange={(e) => setSelectedYearFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white"
          >
            <option value="">All Academic Years</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} {y.isCurrent ? '(Current)' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Assign Teacher</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
          <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-700">No Teacher Assignments Found</p>
          <p className="text-xs text-slate-400 mt-1">
            Assign subject teachers to classes so they can view their assigned curriculum and timetable sessions.
          </p>
          <button
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Assign Teacher</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignments.map((asg) => (
            <div
              key={asg.id}
              className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3 relative group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 font-black text-xs flex items-center justify-center">
                    {(asg.teacher?.name || asg.teacher?.firstName || 'T').charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      {asg.teacher?.name || `${asg.teacher?.firstName || ''} ${asg.teacher?.lastName || ''}`}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-mono">
                      EMP: {asg.teacher?.employeeId || 'N/A'} • {asg.academicYear?.name || 'All Years'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(asg.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Remove Assignment"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Class & Batch</span>
                  <p className="font-bold text-slate-800">
                    {asg.class?.name} {asg.class?.section ? `(${asg.class?.section})` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Subject</span>
                  <p className="font-bold text-slate-800">{asg.subject?.name}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span className="px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-[10px]">
                  Role: {asg.role}
                </span>
                <span className="font-mono text-[10px] text-slate-400">Code: {asg.subject?.code}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Assign Teacher to Class & Subject</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Academic Year</label>
                <select
                  required
                  value={formData.academicYearId}
                  onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 bg-white"
                >
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.isCurrent ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Class / Batch</label>
                <select
                  required
                  value={formData.classId}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 bg-white"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.section ? `(${c.section})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Subject</label>
                <select
                  required
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 bg-white"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Teacher</label>
                <select
                  required
                  value={formData.teacherId}
                  onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 bg-white"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name || `${t.firstName || ''} ${t.lastName || ''}`} ({t.employeeId || 'Teacher'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Assignment Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 bg-white"
                >
                  <option value="PRIMARY">PRIMARY TEACHER</option>
                  <option value="ASSISTANT">ASSISTANT / CO-TEACHER</option>
                  <option value="VISITING">VISITING LECTURER</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs"
                >
                  {submitting ? 'Assigning...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
