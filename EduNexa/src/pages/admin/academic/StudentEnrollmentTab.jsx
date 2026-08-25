import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';
import { GraduationCap, Plus, Search, CheckSquare, Square, AlertCircle, CheckCircle2, UserCheck, Filter } from 'lucide-react';

export default function StudentEnrollmentTab({ years, classes }) {
  const [enrollments, setEnrollments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');

  // Bulk Enrollment State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkClassId, setBulkClassId] = useState('');
  const [bulkYearId, setBulkYearId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [submittingBulk, setSubmittingBulk] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchEnrollments = async (yearId = selectedYearId, classId = selectedClassId) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (yearId) params.append('academicYearId', yearId);
      if (classId) params.append('classId', classId);

      const [enrRes, stRes] = await Promise.all([
        apiRequest(`/academic/enrollments?${params.toString()}`),
        apiRequest('/students'),
      ]);

      if (enrRes.success && Array.isArray(enrRes.data)) setEnrollments(enrRes.data);
      if (stRes.success && Array.isArray(stRes.data)) setStudents(stRes.data);
    } catch (err) {
      console.error('Error loading enrollments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (years.length > 0 && !selectedYearId) {
      const currentYear = years.find((y) => y.isCurrent) || years[0];
      if (currentYear) setSelectedYearId(currentYear.id.toString());
    }
  }, [years]);

  useEffect(() => {
    fetchEnrollments(selectedYearId, selectedClassId);
  }, [selectedYearId, selectedClassId]);

  const openBulkModal = () => {
    const currentYear = years.find((y) => y.isCurrent) || years[0];
    setBulkYearId(selectedYearId || (currentYear ? currentYear.id.toString() : ''));
    setBulkClassId(selectedClassId || (classes[0] ? classes[0].id.toString() : ''));
    setSelectedStudentIds([]);
    setSearchTerm('');
    setError('');
    setSuccessMessage('');
    setIsBulkModalOpen(true);
  };

  const filteredStudents = students.filter((st) => {
    const q = searchTerm.toLowerCase();
    const fullName = `${st.firstName || ''} ${st.lastName || ''} ${st.name || ''}`.toLowerCase();
    const adm = (st.admissionNumber || '').toLowerCase();
    const email = (st.user?.email || '').toLowerCase();
    return fullName.includes(q) || adm.includes(q) || email.includes(q);
  });

  const toggleStudentSelection = (id) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter((sid) => sid !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredStudents.map((s) => s.id);
    const combined = Array.from(new Set([...selectedStudentIds, ...allFilteredIds]));
    setSelectedStudentIds(combined);
  };

  const handleClearSelection = () => {
    setSelectedStudentIds([]);
  };

  const handleBulkEnrollSubmit = async (e) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0) {
      setError('Please select at least one student.');
      return;
    }
    if (!bulkClassId) {
      setError('Please select a target class.');
      return;
    }

    try {
      setSubmittingBulk(true);
      setError('');
      const targetYearId = bulkYearId ? parseInt(bulkYearId, 10) : undefined;
      const targetClassIdNum = parseInt(bulkClassId, 10);

      const res = await apiRequest('/academic/enrollments/bulk', {
        method: 'POST',
        body: JSON.stringify({
          studentIds: selectedStudentIds,
          classId: targetClassIdNum,
          academicYearId: targetYearId,
        }),
      });

      if (res.success) {
        setSuccessMessage(res.message);
        setSelectedStudentIds([]);
        // Align active filters to the target year and class so new records are immediately in view
        if (targetYearId) setSelectedYearId(targetYearId.toString());
        setSelectedClassId(targetClassIdNum.toString());

        // Refresh immediately with the target filter values
        await fetchEnrollments(targetYearId ? targetYearId.toString() : '', targetClassIdNum.toString());

        setIsBulkModalOpen(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to bulk enroll students.');
    } finally {
      setSubmittingBulk(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-900">Student Class Enrollments</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Enroll students into academic years and classes. Academic history is preserved across grades.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openBulkModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs"
          >
            <UserCheck className="w-4 h-4" />
            <span>Bulk Student Enrollment</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <Filter className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-bold text-slate-700">Filter By:</span>

        <select
          value={selectedYearId}
          onChange={(e) => setSelectedYearId(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white"
        >
          <option value="">All Academic Years</option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name} {y.isCurrent ? '(Current)' : ''}
            </option>
          ))}
        </select>

        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white"
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.section ? `(${c.section})` : ''}
            </option>
          ))}
        </select>

        <span className="ml-auto text-xs text-slate-400 font-medium">
          {enrollments.length} Active Enrollments
        </span>
      </div>

      {/* Enrollments Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
          </div>
        ) : enrollments.length === 0 ? (
          <div className="p-8 text-center">
            <GraduationCap className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">No Student Enrollments Found</p>
            <p className="text-xs text-slate-400 mt-1">
              Use the Bulk Enrollment tool to enroll students into classes for this academic year.
            </p>
            <button
              onClick={openBulkModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Enroll Students Now</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-6 py-3.5">Student</th>
                  <th className="px-6 py-3.5">Admission #</th>
                  <th className="px-6 py-3.5">Academic Year</th>
                  <th className="px-6 py-3.5">Enrolled Class</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enrollments.map((enr) => (
                  <tr key={enr.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-xs">
                          {(enr.student?.firstName || enr.student?.name || 'S').charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">
                            {enr.student?.firstName || enr.student?.name} {enr.student?.lastName || ''}
                          </p>
                          <p className="text-[10px] text-slate-400">{enr.student?.user?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-slate-600 font-bold">
                      {enr.student?.admissionNumber || 'N/A'}
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-slate-800">
                      {enr.academicYear?.name || 'Current'}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {enr.class?.name} {enr.class?.section ? `(${enr.class?.section})` : ''}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">
                      {new Date(enr.enrollmentDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {enr.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Enrollment Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Batch Assignment</span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">Bulk Student Enrollment</h3>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
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

            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleBulkEnrollSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Academic Year</label>
                  <select
                    required
                    value={bulkYearId}
                    onChange={(e) => setBulkYearId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
                  >
                    {years.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.isCurrent ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Target Class</label>
                  <select
                    required
                    value={bulkClassId}
                    onChange={(e) => setBulkClassId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.section ? `(${c.section})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Student Search & Multi-Select */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase text-slate-400">
                    Select Students ({selectedStudentIds.length} Selected)
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="font-bold text-slate-800 hover:text-slate-950 underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by student name, admission #, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 p-1 bg-slate-50/50">
                  {filteredStudents.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">No students match search filter.</p>
                  ) : (
                    filteredStudents.map((st) => {
                      const isSelected = selectedStudentIds.includes(st.id);
                      return (
                        <div
                          key={st.id}
                          onClick={() => toggleStudentSelection(st.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                            isSelected ? 'bg-white shadow-xs font-bold' : 'hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-slate-900">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-slate-900" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-slate-900">
                                {st.firstName || st.name} {st.lastName || ''}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                ADM: {st.admissionNumber || 'N/A'} • {st.user?.email}
                              </p>
                            </div>
                          </div>

                          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                            Current Class: {st.class?.name || 'None'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBulk || selectedStudentIds.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs disabled:opacity-50"
                >
                  {submittingBulk ? 'Enrolling...' : `Enroll ${selectedStudentIds.length} Students`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
