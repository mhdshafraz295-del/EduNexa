import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { api, apiRequest, downloadAuthenticatedFile } from '../../../services/api';
import PageHeader from '../../../components/common/PageHeader';
import GlassCard from '../../../components/common/GlassCard';
import StatCard from '../../../components/common/StatCard';
import EmptyState from '../../../components/common/EmptyState';
import StatusBadge from '../../../components/common/StatusBadge';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Printer,
  RefreshCw,
  Save,
  Search,
  Send,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  X,
  AlertTriangle,
  ArrowLeft,
  Check,
  Edit3,
  BarChart3,
} from 'lucide-react';

export default function TermReportCardPage() {
  const { id: routeGroupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Foundation Data
  const [examGroups, setExamGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(routeGroupId || '');
  const [examGroup, setExamGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingMap, setDownloadingMap] = useState({});

  const handleDownload = async (key, endpoint, defaultFilename) => {
    if (!isValidId(selectedGroupId)) return;
    if (downloadingMap[key]) return;
    setDownloadingMap((prev) => ({ ...prev, [key]: true }));
    try {
      await downloadAuthenticatedFile(endpoint, defaultFilename);
    } catch (err) {
      console.error('Download error:', err);
      alert(err.message || 'Failed to download file.');
    } finally {
      setDownloadingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Active Tab
  const [activeTab, setActiveTab] = useState('matrix'); // 'bulk_marks' | 'matrix' | 'preview' | 'analytics' | 'export'

  // 1. Bulk Marks State
  const [selectedSubjectExamId, setSelectedSubjectExamId] = useState('');
  const [bulkStudents, setBulkStudents] = useState([]);
  const [bulkMarks, setBulkMarks] = useState({}); // { [studentId]: { marks: '', feedback: '' } }
  const [hasUnsavedMarks, setHasUnsavedMarks] = useState(false);
  const [savingBulkMarks, setSavingBulkMarks] = useState(false);
  const [bulkSaveSuccess, setBulkSaveSuccess] = useState(false);
  const markInputRefs = useRef({});

  // 2. Class Matrix State
  const [rankingData, setRankingData] = useState(null);
  const [matrixSearch, setMatrixSearch] = useState('');
  const [matrixLoading, setMatrixLoading] = useState(false);

  // 3. Single Student Preview State
  const [previewStudentId, setPreviewStudentId] = useState(null);
  const [studentReportData, setStudentReportData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [teacherRemark, setTeacherRemark] = useState('');
  const [principalRemark, setPrincipalRemark] = useState('');
  const [savingRemarks, setSavingRemarks] = useState(false);

  // 4. Analytics State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const isValidId = (value) => {
    if (!value || value === 'undefined' || value === 'null') return false;
    const id = Number(value);
    return Number.isInteger(id) && id > 0;
  };

  // Fetch all Exam Groups
  const fetchExamGroups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/exam-groups');
      if (res.data.success) {
        setExamGroups(res.data.data);
        if (!isValidId(selectedGroupId) && res.data.data.length > 0) {
          setSelectedGroupId(String(res.data.data[0].id));
        }
      }
    } catch (err) {
      console.error('Error fetching exam groups:', err);
      setError(err.message || 'Failed to load term examination groups.');
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    fetchExamGroups();
  }, [fetchExamGroups]);

  // Fetch Selected Exam Group Details
  const fetchGroupDetails = useCallback(async (groupId) => {
    if (!isValidId(groupId)) {
      setExamGroup(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get(`/exam-groups/${groupId}`);
      if (res.data.success) {
        setExamGroup(res.data.data);
        // Default to first attached subject exam for bulk marks
        if (res.data.data.items?.length > 0) {
          setSelectedSubjectExamId(String(res.data.data.items[0].examId));
        }
      }
    } catch (err) {
      console.error('Error fetching group details:', err);
      setError(err.message || 'Failed to load group details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isValidId(selectedGroupId)) {
      fetchGroupDetails(selectedGroupId);
    } else {
      setExamGroup(null);
      setLoading(false);
    }
  }, [selectedGroupId, fetchGroupDetails]);

  // Fetch Class Matrix Data
  const fetchClassMatrix = useCallback(async (groupId) => {
    if (!isValidId(groupId)) return;
    try {
      setMatrixLoading(true);
      const res = await api.get(`/exam-groups/${groupId}/class-sheet`);
      if (res.data.success) {
        setRankingData(res.data.data);
      }
    } catch (err) {
      console.error('Error loading class matrix:', err);
    } finally {
      setMatrixLoading(false);
    }
  }, []);

  // Fetch Analytics
  const fetchAnalytics = useCallback(async (groupId) => {
    if (!isValidId(groupId)) return;
    try {
      setAnalyticsLoading(true);
      const res = await api.get(`/exam-groups/${groupId}/analytics`);
      if (res.data.success) {
        setAnalyticsData(res.data.data);
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // Load Tab Content on Change
  useEffect(() => {
    if (isValidId(selectedGroupId)) {
      if (activeTab === 'matrix') fetchClassMatrix(selectedGroupId);
      if (activeTab === 'analytics') fetchAnalytics(selectedGroupId);
    }
  }, [selectedGroupId, activeTab, fetchClassMatrix, fetchAnalytics]);

  // Load Enrolled Students for Selected Subject Exam
  const loadBulkMarksData = useCallback(async (examId) => {
    if (!examId) return;
    try {
      setLoading(true);
      const res = await api.get(`/exams/${examId}/submissions`);
      if (res.data.success) {
        const classStudents = res.data.data.class?.studentEnrollments?.map((e) => e.student) || [];
        setBulkStudents(classStudents);

        // Populate existing results
        const existingResults = res.data.data.results || [];
        const initialMarks = {};
        classStudents.forEach((st) => {
          const r = existingResults.find((resItem) => resItem.studentId === st.id);
          initialMarks[st.id] = {
            marks: r ? (r.marks !== null ? String(r.marks) : '') : '',
            feedback: r?.teacherFeedback || '',
          };
        });
        setBulkMarks(initialMarks);
        setHasUnsavedMarks(false);
      }
    } catch (err) {
      console.error('Error loading bulk marks data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSubjectExamId) {
      loadBulkMarksData(selectedSubjectExamId);
    }
  }, [selectedSubjectExamId, loadBulkMarksData]);

  // Save All Marks for Current Subject
  const handleSaveAllMarks = async () => {
    if (!selectedSubjectExamId) return;
    try {
      setSavingBulkMarks(true);
      setBulkSaveSuccess(false);

      const marksList = Object.entries(bulkMarks)
        .filter(([_, data]) => data.marks !== '' && data.marks !== undefined)
        .map(([studentId, data]) => ({
          studentId: Number(studentId),
          marks: Number(data.marks),
          feedback: data.feedback ? data.feedback.trim() : undefined,
        }));

      const res = await api.post(`/exams/${selectedSubjectExamId}/bulk-marks`, {
        marksData: marksList,
      });

      if (res.data.success) {
        setBulkSaveSuccess(true);
        setHasUnsavedMarks(false);
        setTimeout(() => setBulkSaveSuccess(false), 3000);
        // Refresh class matrix in background
        if (selectedGroupId) fetchClassMatrix(selectedGroupId);
      }
    } catch (err) {
      console.error('Error saving bulk marks:', err);
      alert(err.response?.data?.message || err.message || 'Failed to save marks.');
    } finally {
      setSavingBulkMarks(false);
    }
  };

  // Keyboard Navigation: Enter / Tab / Arrow Down focuses next student
  const handleKeyDown = (e, index) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextStudent = bulkStudents[index + 1];
      if (nextStudent && markInputRefs.current[nextStudent.id]) {
        markInputRefs.current[nextStudent.id].focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevStudent = bulkStudents[index - 1];
      if (prevStudent && markInputRefs.current[prevStudent.id]) {
        markInputRefs.current[prevStudent.id].focus();
      }
    }
  };

  // Load Single Student Preview
  const handleOpenStudentPreview = async (studentId) => {
    if (!isValidId(selectedGroupId) || !studentId) return;
    setPreviewStudentId(studentId);
    setActiveTab('preview');
    try {
      setPreviewLoading(true);
      const res = await api.get(`/exam-groups/${selectedGroupId}/student-report/${studentId}`);
      if (res.data.success) {
        setStudentReportData(res.data.data.studentReport);
        setTeacherRemark(res.data.data.studentReport.teacherRemark || '');
        setPrincipalRemark(res.data.data.studentReport.principalRemark || '');
      }
    } catch (err) {
      console.error('Error loading student report:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Save Remarks
  const handleSaveRemarks = async () => {
    if (!isValidId(selectedGroupId) || !previewStudentId) return;
    try {
      setSavingRemarks(true);
      const res = await api.patch(`/exam-groups/${selectedGroupId}/remarks/${previewStudentId}`, {
        teacherRemark,
        principalRemark,
      });
      if (res.data.success) {
        alert('Remarks saved successfully.');
      }
    } catch (err) {
      console.error('Error saving remarks:', err);
      alert(err.message || 'Failed to save remarks.');
    } finally {
      setSavingRemarks(false);
    }
  };

  // Release / Unrelease Exam Group
  const handleToggleRelease = async () => {
    if (!examGroup || !isValidId(examGroup.id)) return;
    const isReleased = examGroup.status === 'RELEASED';
    const confirmMsg = isReleased
      ? 'Are you sure you want to unpublish this term report card? Students and Parents will lose access.'
      : 'Release this term report card to Student and Parent portals? All published subject results will be visible.';

    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);
      const endpoint = isReleased ? `/exam-groups/${examGroup.id}/unrelease` : `/exam-groups/${examGroup.id}/release`;
      const res = await api.patch(endpoint, {});
      if (res.data.success) {
        fetchGroupDetails(examGroup.id);
      }
    } catch (err) {
      console.error('Error toggling release:', err);
      alert(err.message || 'Failed to update release status.');
    } finally {
      setLoading(false);
    }
  };

  const attachedItems = examGroup?.items || [];
  const currentExamObj = attachedItems.find((i) => String(i.examId) === String(selectedSubjectExamId))?.exam;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* -------------------------------------------------------------
          Header & Term Group Selector
      ------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/exams')}
            className="p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
            title="Back to Examinations"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-black text-slate-900">
                {examGroup?.name || 'Term Report Cards & Transcripts'}
              </h1>
              {examGroup && (
                <span
                  className={`px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wider ${
                    examGroup.status === 'RELEASED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-900 border border-amber-200'
                  }`}
                >
                  {examGroup.status}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {examGroup?.class?.name ? `Class: ${examGroup.class.name}` : 'Academic Term'} •{' '}
              {examGroup?.academicYear?.name || 'Academic Year'} • {attachedItems.length} Attached Subjects
            </p>
          </div>
        </div>

        {/* Group Selector & Release Action */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          {examGroups.length > 1 && (
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#FFD978]"
            >
              {examGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.class?.name})
                </option>
              ))}
            </select>
          )}

          {examGroup && (
            <button
              onClick={handleToggleRelease}
              disabled={loading}
              className={`px-4 py-2 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 ${
                examGroup.status === 'RELEASED'
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{examGroup.status === 'RELEASED' ? 'Unrelease to Draft' : 'Release to Portals'}</span>
            </button>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------
          Navigation Tabs (Theme: #FFD978 active accent)
      ------------------------------------------------------------- */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 text-sm font-semibold">
        {[
          { key: 'bulk_marks', label: '1. Subject Bulk Marks Entry', icon: FileSpreadsheet },
          { key: 'matrix', label: '2. Class Result Sheet & Ranks', icon: Layers },
          { key: 'preview', label: '3. Official Report Card Preview', icon: FileText },
          { key: 'analytics', label: '4. Performance Analytics', icon: BarChart3 },
          { key: 'export', label: '5. Bulk PDF & CSV Hub', icon: Printer },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs md:text-sm ${
                isActive
                  ? 'bg-[#FFD978] text-slate-900 shadow-xs border border-[#E6BC50]'
                  : 'bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900 border border-slate-200/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* -------------------------------------------------------------
          TAB 1: SUBJECT-BY-SUBJECT BULK MARKS SPREADSHEET
      ------------------------------------------------------------- */}
      {activeTab === 'bulk_marks' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Subject Bar */}
          <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase">Select Subject Exam:</span>
              <select
                value={selectedSubjectExamId}
                onChange={(e) => {
                  if (hasUnsavedMarks) {
                    if (!window.confirm('You have unsaved marks! Switching subject will discard unsaved inputs. Proceed?')) {
                      return;
                    }
                  }
                  setSelectedSubjectExamId(e.target.value);
                }}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#FFD978]"
              >
                {attachedItems.map((item) => (
                  <option key={item.examId} value={item.examId}>
                    {item.exam.subject?.name} ({item.exam.subject?.code}) — Max: {item.exam.totalMarks}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              {hasUnsavedMarks && (
                <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Unsaved Changes
                </span>
              )}

              {bulkSaveSuccess && (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-bounce">
                  <CheckCircle2 className="w-4 h-4" /> All Marks Saved & Calculated!
                </span>
              )}

              <button
                onClick={handleSaveAllMarks}
                disabled={savingBulkMarks || bulkStudents.length === 0}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {savingBulkMarks ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4 text-[#FFD978]" />
                    <span>Save All Marks ({bulkStudents.length} Students)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Fast Keyboard Entry Grid */}
          {bulkStudents.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Enrolled Students"
              description="No active enrolled students found in this class."
            />
          ) : (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-900 text-white sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center text-[#FFD978]">#</th>
                      <th className="py-3 px-4 w-32">Adm No</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4 w-40 text-center text-[#FFD978]">
                        Marks (Max: {currentExamObj?.totalMarks || 100})
                      </th>
                      <th className="py-3 px-4">Teacher Remark / Feedback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bulkStudents.map((st, index) => {
                      const marksVal = bulkMarks[st.id]?.marks || '';
                      const feedbackVal = bulkMarks[st.id]?.feedback || '';

                      return (
                        <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-4 text-center font-bold text-slate-400">{index + 1}</td>
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-700">
                            {st.admissionNumber || st.rollNo || '—'}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">{st.name}</td>
                          <td className="py-2.5 px-4 text-center">
                            <input
                              ref={(el) => (markInputRefs.current[st.id] = el)}
                              type="number"
                              min="0"
                              max={currentExamObj?.totalMarks || 100}
                              step="0.5"
                              value={marksVal}
                              placeholder="Type mark"
                              onChange={(e) => {
                                setBulkMarks((prev) => ({
                                  ...prev,
                                  [st.id]: { ...prev[st.id], marks: e.target.value },
                                }));
                                setHasUnsavedMarks(true);
                              }}
                              onKeyDown={(e) => handleKeyDown(e, index)}
                              className="w-24 text-center py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#FFD978] focus:border-amber-400"
                            />
                          </td>
                          <td className="py-2.5 px-4">
                            <input
                              type="text"
                              value={feedbackVal}
                              placeholder="Optional remarks..."
                              onChange={(e) => {
                                setBulkMarks((prev) => ({
                                  ...prev,
                                  [st.id]: { ...prev[st.id], feedback: e.target.value },
                                }));
                                setHasUnsavedMarks(true);
                              }}
                              className="w-full py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-[#FFD978]"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 2: CLASS RESULT SHEET & RANKS MATRIX
      ------------------------------------------------------------- */}
      {activeTab === 'matrix' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Matrix Actions Bar */}
          <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search student or admission no..."
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={downloadingMap['csv_matrix']}
                onClick={() =>
                  handleDownload(
                    'csv_matrix',
                    `/exam-groups/${selectedGroupId}/export-csv`,
                    `Class_Results_${examGroup?.name || selectedGroupId}.csv`
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadingMap['csv_matrix'] ? 'Exporting...' : 'Export CSV'}</span>
              </button>
              <button
                disabled={downloadingMap['class_pdf_matrix']}
                onClick={() =>
                  handleDownload(
                    'class_pdf_matrix',
                    `/exam-groups/${selectedGroupId}/class-pdf`,
                    `ClassResultSheet_${examGroup?.name || selectedGroupId}.pdf`
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5 text-[#FFD978]" />
                <span>{downloadingMap['class_pdf_matrix'] ? 'Generating...' : 'Class Sheet PDF'}</span>
              </button>
            </div>
          </div>

          {/* Matrix Table */}
          {matrixLoading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-[#FFD978]" />
              <p className="text-xs font-bold uppercase tracking-wider">Calculating Class Results & Ranks...</p>
            </div>
          ) : !rankingData || rankingData.studentReports?.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No Result Data Available"
              description="No student marks found for this term examination group."
            />
          ) : (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="py-3 px-3 text-center text-[#FFD978] w-10">#</th>
                      <th className="py-3 px-3 w-28">Adm No</th>
                      <th className="py-3 px-3 min-w-[140px]">Student Name</th>
                      {attachedItems.map((item) => (
                        <th key={item.examId} className="py-3 px-2 text-center text-[#FFD978]">
                          {item.exam.subject?.name?.slice(0, 10)}
                        </th>
                      ))}
                      <th className="py-3 px-3 text-right">Total</th>
                      <th className="py-3 px-3 text-right">Avg %</th>
                      <th className="py-3 px-3 text-center">Grade</th>
                      <th className="py-3 px-3 text-center">Result</th>
                      <th className="py-3 px-3 text-center text-[#FFD978]">Rank</th>
                      <th className="py-3 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rankingData.studentReports
                      .filter(
                        (r) =>
                          r.studentName.toLowerCase().includes(matrixSearch.toLowerCase()) ||
                          r.admissionNumber.toLowerCase().includes(matrixSearch.toLowerCase())
                      )
                      .map((rep, idx) => (
                        <tr key={rep.studentId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{rep.admissionNumber}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{rep.studentName}</td>
                          {attachedItems.map((item) => {
                            const sub = rep.subjectResults.find((s) => s.examId === item.examId);
                            return (
                              <td key={item.examId} className="py-2.5 px-2 text-center font-mono font-semibold">
                                {sub && sub.isCompleted ? (
                                  <span className="text-slate-800">{sub.marksObtained}</span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-3 text-right font-black text-slate-900">
                            {rep.totalObtainedMarks} / {rep.totalPossibleMarks}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-800">{rep.overallAverage}%</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded font-black text-[10px] bg-amber-100 text-amber-900">
                              {rep.overallGrade}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                                rep.overallPassStatus === 'PASS'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {rep.overallPassStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-black text-slate-900">
                            {rep.rankDisplay ? (
                              <span className="px-2 py-0.5 rounded-md bg-[#FFD978] text-slate-950 font-black">
                                #{rep.rankDisplay}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenStudentPreview(rep.studentId)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                title="View Official Report Card"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                              <button
                                disabled={downloadingMap[`student_pdf_${rep.studentId}`]}
                                onClick={() =>
                                  handleDownload(
                                    `student_pdf_${rep.studentId}`,
                                    `/exam-groups/${selectedGroupId}/pdf/${rep.studentId}`,
                                    `ReportCard_${rep.admissionNumber || rep.studentId}.pdf`
                                  )
                                }
                                className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 transition disabled:opacity-50"
                                title="Download PDF"
                              >
                                {downloadingMap[`student_pdf_${rep.studentId}`] ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-800" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 3: OFFICIAL STUDENT REPORT CARD PREVIEW
      ------------------------------------------------------------- */}
      {activeTab === 'preview' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {!studentReportData ? (
            <div className="p-8 rounded-3xl bg-white border border-slate-100 text-center space-y-3">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Select a student from the Class Sheet to preview their report card.</p>
              <button
                onClick={() => setActiveTab('matrix')}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Go to Class Result Sheet
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Paper Document Surface */}
              <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-slate-200 shadow-md space-y-6">
                {/* Header Badge */}
                <div className="text-center pb-4 border-b border-slate-200">
                  <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-slate-900 text-[#FFD978] tracking-wider">
                    OFFICIAL EXAMINATION REPORT CARD
                  </span>
                  <h2 className="text-lg font-black text-slate-900 mt-2">{examGroup?.name}</h2>
                  <p className="text-xs text-slate-500">
                    Class: {examGroup?.class?.name} • Academic Year: {examGroup?.academicYear?.name}
                  </p>
                </div>

                {/* Student Particulars */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-bold uppercase text-[10px]">Student Full Name</span>
                    <span className="font-bold text-slate-900 text-sm">{studentReportData.studentName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold uppercase text-[10px]">Admission Number</span>
                    <span className="font-mono font-bold text-slate-900">{studentReportData.admissionNumber}</span>
                  </div>
                </div>

                {/* Subject Results Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-white">
                      <tr>
                        <th className="py-2.5 px-3 text-[#FFD978]">Subject</th>
                        <th className="py-2.5 px-3 text-right">Marks</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-right">Percent</th>
                        <th className="py-2.5 px-3 text-center">Grade</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentReportData.subjectResults?.map((sub) => (
                        <tr key={sub.examId} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{sub.subjectName}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {sub.isCompleted ? sub.marksObtained : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">{sub.totalMarks}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                            {sub.isCompleted ? `${sub.percentage}%` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold">
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px]">
                              {sub.grade}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                                sub.passStatus === 'PASS'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {sub.passStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Overall Performance Card */}
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 grid grid-cols-5 gap-2 text-center">
                  <div>
                    <span className="text-[10px] font-bold text-amber-900 uppercase block">Total Score</span>
                    <span className="text-sm font-black text-slate-900">
                      {studentReportData.totalObtainedMarks} / {studentReportData.totalPossibleMarks}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-amber-900 uppercase block">Average</span>
                    <span className="text-sm font-black text-slate-900">{studentReportData.overallAverage}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-amber-900 uppercase block">Overall Grade</span>
                    <span className="text-sm font-black text-amber-900">{studentReportData.overallGrade}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-amber-900 uppercase block">Outcome</span>
                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded-full inline-block ${
                        studentReportData.overallPassStatus === 'PASS'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {studentReportData.overallPassStatus}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-amber-900 uppercase block">Class Rank</span>
                    <span className="text-sm font-black text-slate-900">
                      {studentReportData.rankDisplay ? `#${studentReportData.rankDisplay}` : '—'}
                    </span>
                  </div>
                </div>

                {/* Attendance Summary */}
                {studentReportData.attendanceSummary && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                    <span className="font-bold text-slate-700">Attendance Record:</span>
                    <span className="text-slate-600 font-mono font-medium">
                      Present: {studentReportData.attendanceSummary.presentCount} • Absent:{' '}
                      {studentReportData.attendanceSummary.absentCount} • Rate:{' '}
                      <strong>{studentReportData.attendanceSummary.attendanceRate}%</strong>
                    </span>
                  </div>
                )}

                {/* Download PDF Action */}
                <div className="pt-2 flex justify-end">
                  <button
                    disabled={downloadingMap[`preview_pdf_${previewStudentId}`]}
                    onClick={() =>
                      handleDownload(
                        `preview_pdf_${previewStudentId}`,
                        `/exam-groups/${selectedGroupId}/pdf/${previewStudentId}`,
                        `ReportCard_${studentReportData?.studentAdmissionNo || previewStudentId}.pdf`
                      )
                    }
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-2 shadow-xs transition disabled:opacity-50"
                  >
                    {downloadingMap[`preview_pdf_${previewStudentId}`] ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>
                      {downloadingMap[`preview_pdf_${previewStudentId}`]
                        ? 'Generating PDF...'
                        : 'Download Official Institute PDF'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Right Col: Remarks Editor */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 h-fit">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-[#FFD978]" />
                  <h3 className="text-sm font-black text-slate-900">Per-Student Remarks</h3>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Class Teacher Remark</label>
                  <textarea
                    rows="3"
                    value={teacherRemark}
                    onChange={(e) => setTeacherRemark(e.target.value)}
                    placeholder="e.g. Excellent progress in core subjects."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Principal / Director Remark</label>
                  <textarea
                    rows="3"
                    value={principalRemark}
                    onChange={(e) => setPrincipalRemark(e.target.value)}
                    placeholder="e.g. Commended for academic excellence."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>

                <button
                  onClick={handleSaveRemarks}
                  disabled={savingRemarks}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5 text-[#FFD978]" />
                  <span>{savingRemarks ? 'Saving...' : 'Save Remarks'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 4: PERFORMANCE ANALYTICS
      ------------------------------------------------------------- */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {analyticsLoading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-[#FFD978]" />
              <p className="text-xs font-bold uppercase tracking-wider">Loading Analytics Summary...</p>
            </div>
          ) : !analyticsData ? (
            <EmptyState icon={BarChart3} title="No Analytics Data" description="Not enough data to compute statistics." />
          ) : (
            <>
              {/* StatCards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Class Average"
                  value={`${analyticsData.classAverage}%`}
                  subtitle="Average percentage across class"
                  icon={TrendingUp}
                />
                <StatCard
                  title="Overall Pass Rate"
                  value={`${analyticsData.overallPassRate}%`}
                  subtitle={`${analyticsData.passedCount} Passed, ${analyticsData.failedCount} Failed`}
                  icon={CheckCircle2}
                />
                <StatCard
                  title="Highest Average"
                  value={`${analyticsData.highestAverage}%`}
                  subtitle="Top scoring student"
                  icon={Award}
                />
                <StatCard
                  title="Fully Completed"
                  value={`${analyticsData.fullyCompletedCount} / ${analyticsData.totalStudents}`}
                  subtitle="All subjects marked"
                  icon={Users}
                />
              </div>

              {/* Subject Breakdown Cards */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Subject-Wise Performance Breakdown
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analyticsData.subjectSummaries?.map((sub) => (
                    <div key={sub.examId} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900 text-sm">{sub.subjectName}</h4>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800">
                          {sub.subjectCode}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Average Mark</span>
                          <span className="font-bold text-slate-900 text-sm">
                            {sub.averageMark} / {sub.totalMarks}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Pass Rate</span>
                          <span className="font-bold text-emerald-600 text-sm">{sub.passRate}%</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Highest Mark</span>
                          <span className="font-bold text-slate-700">{sub.highestMark}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Lowest Mark</span>
                          <span className="font-bold text-slate-700">{sub.lowestMark}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 5: BULK PRINT & EXPORT HUB
      ------------------------------------------------------------- */}
      {activeTab === 'export' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-150">
          {/* Card 1: Bulk All Students PDF */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#FFD978] text-slate-950 flex items-center justify-center font-black mb-3">
                <Printer className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900">All Student Report Cards (PDF)</h3>
              <p className="text-xs text-slate-500 mt-1">
                Generates a single multi-page PDF containing official branded report cards for every student in the class.
              </p>
            </div>
            <button
              disabled={downloadingMap['hub_bulk_pdf']}
              onClick={() =>
                handleDownload(
                  'hub_bulk_pdf',
                  `/exam-groups/${selectedGroupId}/bulk-pdf`,
                  `Bulk_Report_Cards_${examGroup?.name || selectedGroupId}.pdf`
                )
              }
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-50"
            >
              {downloadingMap['hub_bulk_pdf'] ? (
                <RefreshCw className="w-4 h-4 animate-spin text-[#FFD978]" />
              ) : (
                <Printer className="w-4 h-4 text-[#FFD978]" />
              )}
              <span>{downloadingMap['hub_bulk_pdf'] ? 'Generating Combined PDF...' : 'Download Combined PDF'}</span>
            </button>
          </div>

          {/* Card 2: Class Result Matrix PDF */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-black mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900">Class Result Sheet (PDF)</h3>
              <p className="text-xs text-slate-500 mt-1">
                Landscape tabular transcript comparing student performance, grades, and class rank across all subjects.
              </p>
            </div>
            <button
              disabled={downloadingMap['hub_class_pdf']}
              onClick={() =>
                handleDownload(
                  'hub_class_pdf',
                  `/exam-groups/${selectedGroupId}/class-pdf`,
                  `ClassResultSheet_${examGroup?.name || selectedGroupId}.pdf`
                )
              }
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-50"
            >
              {downloadingMap['hub_class_pdf'] ? (
                <RefreshCw className="w-4 h-4 animate-spin text-[#FFD978]" />
              ) : (
                <Download className="w-4 h-4 text-[#FFD978]" />
              )}
              <span>{downloadingMap['hub_class_pdf'] ? 'Generating Class PDF...' : 'Download Class PDF'}</span>
            </button>
          </div>

          {/* Card 3: Class CSV Export */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black mb-3">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900">Class Results Spreadsheet (CSV)</h3>
              <p className="text-xs text-slate-500 mt-1">
                Export raw authoritative multi-subject marks, averages, grades, and ranks for spreadsheets or archival.
              </p>
            </div>
            <button
              disabled={downloadingMap['hub_csv']}
              onClick={() =>
                handleDownload(
                  'hub_csv',
                  `/exam-groups/${selectedGroupId}/export-csv`,
                  `Class_Results_${examGroup?.name || selectedGroupId}.csv`
                )
              }
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-50"
            >
              {downloadingMap['hub_csv'] ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{downloadingMap['hub_csv'] ? 'Exporting Class CSV...' : 'Export Class CSV'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
