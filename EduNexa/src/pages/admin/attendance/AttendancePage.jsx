import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Search,
  Filter,
  Save,
  Trash2,
  Edit,
  Eye,
  BarChart3,
  TrendingUp,
  Users,
  GraduationCap,
  BookOpen,
  Sparkles,
  RefreshCw,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState('MARK'); // 'MARK' | 'HISTORY' | 'ANALYTICS'

  // Academic dependencies
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Mark Attendance Form State
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [students, setStudents] = useState([]);
  const [isExistingSession, setIsExistingSession] = useState(false);
  const [existingSessionId, setExistingSessionId] = useState(null);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [searchStudentQuery, setSearchStudentQuery] = useState('');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');
  const [saveErrorMessage, setSaveErrorMessage] = useState('');

  // History State
  const [sessions, setSessions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyClassFilter, setHistoryClassFilter] = useState('');
  const [selectedSessionDetail, setSelectedSessionDetail] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Analytics State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // 1. Fetch metadata on load
  useEffect(() => {
    fetchAcademicMetadata();
  }, []);

  const fetchAcademicMetadata = async () => {
    setLoadingMeta(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [clsRes, subRes, yrRes] = await Promise.all([
        fetch('http://localhost:5000/api/academic/classes', { headers }),
        fetch('http://localhost:5000/api/academic/subjects', { headers }),
        fetch('http://localhost:5000/api/academic/years', { headers }),
      ]);

      const [clsData, subData, yrData] = await Promise.all([
        clsRes.json(),
        subRes.json(),
        yrRes.json(),
      ]);

      if (clsData.success) {
        setClasses(clsData.data || []);
        if (clsData.data?.length > 0) {
          setSelectedClassId(clsData.data[0].id.toString());
        }
      }
      if (subData.success) setSubjects(subData.data || []);
      if (yrData.success) {
        setAcademicYears(yrData.data || []);
        const currentYear = yrData.data?.find((y) => y.isCurrent);
        if (currentYear) setSelectedAcademicYearId(currentYear.id.toString());
      }
    } catch (err) {
      console.error('Failed to load academic metadata:', err);
    } finally {
      setLoadingMeta(false);
    }
  };

  // 2. Fetch Students for Marking when Class/Subject/Date changes
  useEffect(() => {
    if (selectedClassId && attendanceDate) {
      fetchStudentsForMarking();
    }
  }, [selectedClassId, selectedSubjectId, attendanceDate, selectedAcademicYearId]);

  const fetchStudentsForMarking = async () => {
    setLoadingStudents(true);
    setSaveSuccessMessage('');
    setSaveErrorMessage('');
    try {
      const token = localStorage.getItem('token');
      let url = `http://localhost:5000/api/attendance/students-for-marking?classId=${selectedClassId}&date=${attendanceDate}`;
      if (selectedSubjectId) url += `&subjectId=${selectedSubjectId}`;
      if (selectedAcademicYearId) url += `&academicYearId=${selectedAcademicYearId}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (json.success) {
        setStudents(json.data.students || []);
        setIsExistingSession(json.data.isExistingSession);
        setExistingSessionId(json.data.existingSessionId);
        setSessionNotes(json.data.existingNotes || '');
      } else {
        setStudents([]);
        setSaveErrorMessage(json.message);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
      setSaveErrorMessage('Failed to connect to server.');
    } finally {
      setLoadingStudents(false);
    }
  };

  // 3. Fetch Attendance History
  const fetchAttendanceHistory = async () => {
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem('token');
      let url = 'http://localhost:5000/api/attendance/sessions';
      if (historyClassFilter) url += `?classId=${historyClassFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setSessions(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch attendance history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchAttendanceHistory();
    } else if (activeTab === 'ANALYTICS') {
      fetchAttendanceAnalytics();
    }
  }, [activeTab, historyClassFilter]);

  // 4. Fetch Real Analytics
  const fetchAttendanceAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/attendance/analytics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setAnalyticsData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch attendance analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Bulk status toggles
  const handleBulkStatusChange = (status) => {
    setStudents((prev) => prev.map((s) => ({ ...s, status })));
  };

  const handleStudentStatusChange = (studentId, status) => {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, status } : s))
    );
  };

  const handleStudentRemarkChange = (studentId, remark) => {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, remark } : s))
    );
  };

  // Save Attendance Session
  const handleSaveAttendance = async (e) => {
    e.preventDefault();
    if (!selectedClassId || !attendanceDate || students.length === 0) {
      setSaveErrorMessage('Please select a class, date, and ensure students are loaded.');
      return;
    }

    setSavingAttendance(true);
    setSaveSuccessMessage('');
    setSaveErrorMessage('');

    try {
      const token = localStorage.getItem('token');
      const payload = {
        classId: parseInt(selectedClassId, 10),
        subjectId: selectedSubjectId ? parseInt(selectedSubjectId, 10) : null,
        academicYearId: selectedAcademicYearId ? parseInt(selectedAcademicYearId, 10) : null,
        date: attendanceDate,
        notes: sessionNotes,
        records: students.map((s) => ({
          studentId: s.studentId,
          status: s.status,
          remark: s.remark,
        })),
      };

      const res = await fetch('http://localhost:5000/api/attendance/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        setSaveSuccessMessage(json.message || 'Attendance saved successfully!');
        setIsExistingSession(true);
        setExistingSessionId(json.data?.id || existingSessionId);
      } else {
        setSaveErrorMessage(json.message || 'Failed to save attendance.');
      }
    } catch (err) {
      setSaveErrorMessage('Network error while saving attendance.');
    } finally {
      setSavingAttendance(false);
    }
  };

  // Delete Session
  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to delete this attendance session? This cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/attendance/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (selectedSessionDetail?.id === sessionId) {
          setIsDetailModalOpen(false);
        }
      } else {
        alert(json.message || 'Failed to delete session.');
      }
    } catch (err) {
      alert('Network error while deleting session.');
    }
  };

  // Filter students for UI search
  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchStudentQuery.toLowerCase()) ||
      s.rollNo.toLowerCase().includes(searchStudentQuery.toLowerCase())
  );

  // Computed Live Stats for Mark Tab
  const totalCount = students.length;
  const presentCount = students.filter((s) => s.status === 'PRESENT').length;
  const absentCount = students.filter((s) => s.status === 'ABSENT').length;
  const lateCount = students.filter((s) => s.status === 'LATE').length;
  const excusedCount = students.filter((s) => s.status === 'EXCUSED').length;
  const currentAttendanceRate = totalCount > 0
    ? Math.round(((presentCount + lateCount) / totalCount) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <UserCheck className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Attendance Module
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Attendance Management System
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Daily student roster marking, period-wise attendance, historical archives, and real analytics.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center p-1.5 bg-slate-100/80 rounded-xl border border-slate-200/60 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('MARK')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'MARK'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4 text-emerald-500" />
            Mark Roster
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'HISTORY'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4 text-blue-500" />
            History & Logs
          </button>
          <button
            onClick={() => setActiveTab('ANALYTICS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'ANALYTICS'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-purple-500" />
            Analytics
          </button>
        </div>
      </div>

      {/* TAB 1: MARK ATTENDANCE */}
      {activeTab === 'MARK' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              Roster Selection & Filters
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Attendance Date *
                </label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Class */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Class / Section *
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                >
                  <option value="">-- Select Class --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.section ? `(${c.section})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Subject (Optional / General)
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                >
                  <option value="">General Class (Full Day)</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Academic Year */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Academic Year
                </label>
                <select
                  value={selectedAcademicYearId}
                  onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                >
                  <option value="">Current Active Year</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.isCurrent ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isExistingSession && (
              <div className="mt-4 p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl flex items-center gap-3">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-medium text-blue-900">
                  <strong>Notice:</strong> An attendance session already exists for this date and class. Modifying statuses below and clicking Save will update the existing session records.
                </span>
              </div>
            )}
          </div>

          {/* Real-Time Live Stats Bar */}
          {totalCount > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-4 bg-white/80 backdrop-blur-md rounded-xl border border-slate-200/80 shadow-xs">
                <span className="text-xs font-bold text-slate-400 uppercase">Enrolled</span>
                <p className="text-xl font-black text-slate-900 mt-1">{totalCount}</p>
              </div>
              <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/80 shadow-xs">
                <span className="text-xs font-bold text-emerald-600 uppercase">Present</span>
                <p className="text-xl font-black text-emerald-700 mt-1">{presentCount}</p>
              </div>
              <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-200/80 shadow-xs">
                <span className="text-xs font-bold text-rose-600 uppercase">Absent</span>
                <p className="text-xl font-black text-rose-700 mt-1">{absentCount}</p>
              </div>
              <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/80 shadow-xs">
                <span className="text-xs font-bold text-amber-600 uppercase">Late</span>
                <p className="text-xl font-black text-amber-700 mt-1">{lateCount}</p>
              </div>
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/80 shadow-xs">
                <span className="text-xs font-bold text-blue-600 uppercase">Excused</span>
                <p className="text-xl font-black text-blue-700 mt-1">{excusedCount}</p>
              </div>
              <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs">
                <span className="text-xs font-bold text-slate-300 uppercase">Attendance Rate</span>
                <p className="text-xl font-black text-emerald-400 mt-1">{currentAttendanceRate}%</p>
              </div>
            </div>
          )}

          {/* Student Roster Table */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Header & Quick Action Buttons */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by student name or roll..."
                    value={searchStudentQuery}
                    onChange={(e) => setSearchStudentQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-900 bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <span className="text-xs font-bold text-slate-400">
                  {filteredStudents.length} Students
                </span>
              </div>

              {/* Quick Bulk Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase text-slate-400 mr-1">Mark All:</span>
                <button
                  type="button"
                  onClick={() => handleBulkStatusChange('PRESENT')}
                  className="px-2.5 py-1 text-xs font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg transition-all"
                >
                  All Present
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkStatusChange('ABSENT')}
                  className="px-2.5 py-1 text-xs font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-lg transition-all"
                >
                  All Absent
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkStatusChange('LATE')}
                  className="px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg transition-all"
                >
                  All Late
                </button>
              </div>
            </div>

            {/* Notification messages */}
            {saveSuccessMessage && (
              <div className="m-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {saveSuccessMessage}
              </div>
            )}
            {saveErrorMessage && (
              <div className="m-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                {saveErrorMessage}
              </div>
            )}

            {loadingStudents ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Loading Enrolled Student Roster...</span>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">No enrolled students found for this class.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Ensure active student enrollments exist in the Academics Hub.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <th className="py-3 px-4"># Roll</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4 text-center">Attendance Status</th>
                      <th className="py-3 px-4">Remark / Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredStudents.map((st) => (
                      <tr key={st.studentId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs font-bold text-slate-500">
                          {st.rollNo}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs uppercase shrink-0 border border-slate-200">
                              {st.name.slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-xs leading-snug">{st.name}</p>
                              {st.admissionNumber && st.admissionNumber !== st.rollNo && (
                                <p className="text-[10px] text-slate-400">Adm: {st.admissionNumber}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {/* PRESENT */}
                            <button
                              type="button"
                              onClick={() => handleStudentStatusChange(st.studentId, 'PRESENT')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                st.status === 'PRESENT'
                                  ? 'bg-emerald-500 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                              }`}
                            >
                              Present
                            </button>

                            {/* ABSENT */}
                            <button
                              type="button"
                              onClick={() => handleStudentStatusChange(st.studentId, 'ABSENT')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                st.status === 'ABSENT'
                                  ? 'bg-rose-500 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-700'
                              }`}
                            >
                              Absent
                            </button>

                            {/* LATE */}
                            <button
                              type="button"
                              onClick={() => handleStudentStatusChange(st.studentId, 'LATE')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                st.status === 'LATE'
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-700'
                              }`}
                            >
                              Late
                            </button>

                            {/* EXCUSED */}
                            <button
                              type="button"
                              onClick={() => handleStudentStatusChange(st.studentId, 'EXCUSED')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                st.status === 'EXCUSED'
                                  ? 'bg-blue-500 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-700'
                              }`}
                            >
                              Excused
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            placeholder="Optional remark (e.g. sick leave)"
                            value={st.remark || ''}
                            onChange={(e) => handleStudentRemarkChange(st.studentId, e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-900 bg-white focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Session Notes & Save Button */}
            {filteredStudents.length > 0 && (
              <div className="p-4 sm:p-6 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="w-full sm:w-1/2">
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Session Notes / Period Summary (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Completed Chapter 4 review exercises"
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 bg-white"
                  />
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={handleSaveAttendance}
                    disabled={savingAttendance}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingAttendance ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isExistingSession ? 'Update Attendance Session' : 'Save Attendance Session'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ATTENDANCE HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-6">
          {/* History Controls Bar */}
          <div className="bg-white/80 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase text-slate-400">Filter by Class:</span>
              <select
                value={historyClassFilter}
                onChange={(e) => setHistoryClassFilter(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white focus:outline-none"
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.section ? `(${c.section})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchAttendanceHistory}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Logs
            </button>
          </div>

          {/* History List */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {loadingHistory ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Loading Attendance Logs...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">No attendance sessions recorded yet.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Switch to the 'Mark Roster' tab to record your first session.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Marked By</th>
                      <th className="py-3 px-4 text-center">Status Breakdown</th>
                      <th className="py-3 px-4 text-center">Rate</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {sessions.map((sess) => (
                      <tr key={sess.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 text-xs">
                          {new Date(sess.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 text-xs">
                            {sess.class?.name} {sess.class?.section ? `(${sess.class.section})` : ''}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-600">
                          {sess.subject?.name || <span className="text-slate-400 italic">General Class</span>}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {sess.teacher?.name || sess.createdByUser?.username || 'Admin'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold">
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md">
                              {sess.stats.presentCount} P
                            </span>
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md">
                              {sess.stats.absentCount} A
                            </span>
                            {sess.stats.lateCount > 0 && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md">
                                {sess.stats.lateCount} L
                              </span>
                            )}
                            {sess.stats.excusedCount > 0 && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">
                                {sess.stats.excusedCount} E
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-black ${
                              sess.stats.attendanceRate >= 80
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : sess.stats.attendanceRate >= 60
                                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                : 'bg-rose-50 text-rose-600 border border-rose-200'
                            }`}
                          >
                            {sess.stats.attendanceRate}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedSessionDetail(sess);
                                setIsDetailModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="View Student Roster"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSession(sess.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Delete Session"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: REAL ANALYTICS & REPORTS */}
      {activeTab === 'ANALYTICS' && (
        <div className="space-y-6">
          {loadingAnalytics ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
              <span className="text-xs font-bold uppercase tracking-wider">Computing Real Database Analytics...</span>
            </div>
          ) : analyticsData && analyticsData.totalSessions > 0 ? (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-6 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Sessions Conducted</span>
                  <p className="text-3xl font-black text-slate-900 mt-2">{analyticsData.totalSessions}</p>
                  <p className="text-xs text-slate-400 mt-1 font-medium">{analyticsData.totalRecords} total student entries</p>
                </div>

                <div className="p-6 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Overall Attendance Rate</span>
                  <p className="text-3xl font-black text-emerald-600 mt-2">{analyticsData.overallRate}%</p>
                  <p className="text-xs text-slate-400 mt-1 font-medium">Real-time aggregate</p>
                </div>

                <div className="p-6 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Present / Late Count</span>
                  <p className="text-3xl font-black text-slate-900 mt-2">
                    {analyticsData.counts.present + analyticsData.counts.late}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 font-medium">
                    {analyticsData.counts.present} on-time, {analyticsData.counts.late} late
                  </p>
                </div>

                <div className="p-6 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Unexcused Absences</span>
                  <p className="text-3xl font-black text-rose-600 mt-2">{analyticsData.counts.absent}</p>
                  <p className="text-xs text-slate-400 mt-1 font-medium">{analyticsData.counts.excused} excused leaves</p>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Breakdown Donut */}
                <div className="p-6 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-emerald-500" />
                    Attendance Status Breakdown
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analyticsData.statusDistribution}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={4}
                        >
                          {analyticsData.statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-center gap-4 mt-2 flex-wrap">
                    {analyticsData.statusDistribution.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                        {item.name}: {item.value}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Class Rates Bar Chart */}
                <div className="p-6 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-500" />
                    Attendance Rates by Class (%)
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.classAttendanceRates}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="className" stroke="#64748B" fontSize={11} />
                        <YAxis stroke="#64748B" fontSize={11} domain={[0, 100]} />
                        <Tooltip />
                        <Bar dataKey="rate" fill="#10B981" radius={[6, 6, 0, 0]} name="Attendance Rate %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 text-center text-slate-400">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No analytics data available yet.</p>
              <p className="text-xs text-slate-400 mt-1">
                Conduct and record attendance sessions to view dynamic charts and summaries.
              </p>
            </div>
          )}
        </div>
      )}

      {/* DETAIL ROSTER MODAL */}
      {isDetailModalOpen && selectedSessionDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Attendance Roster Details
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedSessionDetail.class?.name} &bull;{' '}
                  {new Date(selectedSessionDetail.date).toLocaleDateString('en-US', {
                    dateStyle: 'medium',
                  })}
                </p>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 bg-emerald-50 rounded-xl text-center">
                  <span className="text-[10px] font-bold uppercase text-emerald-600">Present</span>
                  <p className="text-base font-black text-emerald-700">{selectedSessionDetail.stats.presentCount}</p>
                </div>
                <div className="p-3 bg-rose-50 rounded-xl text-center">
                  <span className="text-[10px] font-bold uppercase text-rose-600">Absent</span>
                  <p className="text-base font-black text-rose-700">{selectedSessionDetail.stats.absentCount}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl text-center">
                  <span className="text-[10px] font-bold uppercase text-amber-600">Late</span>
                  <p className="text-base font-black text-amber-700">{selectedSessionDetail.stats.lateCount}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl text-center">
                  <span className="text-[10px] font-bold uppercase text-blue-600">Excused</span>
                  <p className="text-base font-black text-blue-700">{selectedSessionDetail.stats.excusedCount}</p>
                </div>
              </div>

              {selectedSessionDetail.notes && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Notes</span>
                  <p className="text-xs text-slate-700 mt-0.5">{selectedSessionDetail.notes}</p>
                </div>
              )}

              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-400 font-bold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Roll</th>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSessionDetail.records?.map((rec) => (
                      <tr key={rec.id}>
                        <td className="py-2 px-3 font-mono font-bold text-slate-500">
                          {rec.student?.rollNo || 'N/A'}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900">{rec.student?.name}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              rec.status === 'PRESENT'
                                ? 'bg-emerald-100 text-emerald-700'
                                : rec.status === 'ABSENT'
                                ? 'bg-rose-100 text-rose-700'
                                : rec.status === 'LATE'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-500">{rec.remark || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
