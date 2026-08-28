import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Search,
  Upload,
  Download,
  Eye,
  Edit3,
  Send,
  Save,
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  Award,
  BarChart2,
  Table,
  FileCheck,
  AlertTriangle,
  User,
  Check,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import {
  api,
  downloadAuthenticatedFile,
  fetchProtectedAssetBlobUrl,
  revokeProtectedAssetBlobUrl,
  openAuthenticatedFileInNewWindow,
} from '../../../services/api';

export default function WrittenMarkingPage() {
  const { id: examId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingPdfMap, setDownloadingPdfMap] = useState({});
  const [exam, setExam] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, SUBMITTED, MARKED, PUBLISHED, PENDING
  const [activeTab, setActiveTab] = useState('queue'); // queue, split_marking, bulk_table, csv_import, analytics

  // Split-screen Marking Workspace State
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [marksInput, setMarksInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [savingMark, setSavingMark] = useState(false);
  const [auditReason, setAuditReason] = useState('');
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'SAVE_PUBLISHED' | 'PUBLISH_SINGLE'

  // PDF Preview State
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  useEffect(() => {
    let active = true;
    let currentBlob = null;

    const loadAnswerPdf = async () => {
      if (!selectedStudent || !selectedStudent.hasSubmission || !examId) {
        setPdfBlobUrl(null);
        setPdfError(null);
        setLoadingPdf(false);
        return;
      }

      setLoadingPdf(true);
      setPdfError(null);
      try {
        const url = await fetchProtectedAssetBlobUrl(`/exams/${examId}/submissions/${selectedStudent.studentId}/answer-pdf`);
        if (active) {
          currentBlob = url;
          setPdfBlobUrl(url);
        } else {
          revokeProtectedAssetBlobUrl(url);
        }
      } catch (err) {
        if (active) {
          setPdfError(err.message || 'Failed to load answer document');
        }
      } finally {
        if (active) {
          setLoadingPdf(false);
        }
      }
    };

    loadAnswerPdf();

    return () => {
      active = false;
      if (currentBlob) {
        revokeProtectedAssetBlobUrl(currentBlob);
      }
    };
  }, [selectedStudent?.studentId, selectedStudent?.hasSubmission, examId]);

  // Spreadsheet Bulk Table State
  const [bulkMarksMap, setBulkMarksMap] = useState({});
  const [bulkFeedbackMap, setBulkFeedbackMap] = useState({});
  const [savingBulk, setSavingBulk] = useState(false);

  // CSV Import State (Two-Stage)
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreviewData, setCsvPreviewData] = useState(null);
  const [csvPreviewing, setCsvPreviewing] = useState(false);
  const [csvConfirming, setCsvConfirming] = useState(false);
  const [csvAuditReason, setCsvAuditReason] = useState('');

  // Bulk Publish State
  const [publishingAll, setPublishingAll] = useState(false);

  // Message notifications
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    fetchSubmissions();
  }, [examId]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/exams/${examId}/submissions`);
      if (res.data && res.data.success) {
        setExam(res.data.data.exam);
        const subs = res.data.data.submissions || [];
        setSubmissions(subs);

        // Pre-fill bulk maps
        const bMarks = {};
        const bFeedback = {};
        subs.forEach((s) => {
          if (s.result?.marks !== undefined && s.result?.marks !== null) {
            bMarks[s.studentId] = s.result.marks;
          }
          if (s.result?.teacherFeedback) {
            bFeedback[s.studentId] = s.result.teacherFeedback;
          }
        });
        setBulkMarksMap(bMarks);
        setBulkFeedbackMap(bFeedback);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load submissions', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtered Submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      const matchesSearch =
        s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.admissionNumber && s.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.rollNo && s.rollNo.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterStatus === 'SUBMITTED') return s.hasSubmission && s.result?.resultStatus !== 'PUBLISHED';
      if (filterStatus === 'MARKED') return s.result?.resultStatus === 'MARKED';
      if (filterStatus === 'PUBLISHED') return s.result?.resultStatus === 'PUBLISHED';
      if (filterStatus === 'PENDING') return !s.result || s.result.resultStatus === 'PENDING';
      return true;
    });
  }, [submissions, searchTerm, filterStatus]);

  // Real Analytics Calculations
  const analytics = useMemo(() => {
    const totalEnrolled = submissions.length;
    const evaluatedResults = submissions.filter((s) => s.result && s.result.marks !== undefined && s.result.marks !== null);
    const markedCount = evaluatedResults.length;
    const publishedCount = submissions.filter((s) => s.result?.resultStatus === 'PUBLISHED').length;

    if (markedCount === 0) {
      return {
        totalEnrolled,
        markedCount: 0,
        publishedCount: 0,
        avgMarks: 0,
        avgPercentage: 0,
        passCount: 0,
        failCount: 0,
        passRate: 0,
        highestMark: 0,
        lowestMark: 0,
        gradeDistribution: { A: 0, B: 0, C: 0, S: 0, F: 0 },
      };
    }

    const marksList = evaluatedResults.map((s) => Number(s.result.marks));
    const sumMarks = marksList.reduce((a, b) => a + b, 0);
    const avgMarks = Math.round((sumMarks / markedCount) * 100) / 100;
    const avgPercentage = exam?.totalMarks ? Math.round(((avgMarks / exam.totalMarks) * 100) * 100) / 100 : 0;

    const passCount = evaluatedResults.filter((s) => s.result.status === 'PASS').length;
    const failCount = markedCount - passCount;
    const passRate = Math.round((passCount / markedCount) * 100);

    const highestMark = Math.max(...marksList);
    const lowestMark = Math.min(...marksList);

    const gradeDistribution = { A: 0, B: 0, C: 0, S: 0, F: 0 };
    evaluatedResults.forEach((s) => {
      const g = s.result.grade || 'F';
      if (gradeDistribution[g] !== undefined) {
        gradeDistribution[g]++;
      } else {
        gradeDistribution.F++;
      }
    });

    return {
      totalEnrolled,
      markedCount,
      publishedCount,
      avgMarks,
      avgPercentage,
      passCount,
      failCount,
      passRate,
      highestMark,
      lowestMark,
      gradeDistribution,
    };
  }, [submissions, exam]);

  // Select student for split workspace
  const handleSelectStudent = (sub) => {
    const latest = submissions.find((s) => s.studentId === sub.studentId) || sub;
    setSelectedStudent(latest);
    const existingMarks = latest.result?.marks ?? latest.attempt?.score;
    const existingFeedback = latest.result?.teacherFeedback ?? latest.attempt?.teacherFeedback;
    setMarksInput(existingMarks !== undefined && existingMarks !== null ? String(existingMarks) : '');
    setFeedbackInput(existingFeedback || '');
    setActiveTab('split_marking');
  };

  // Synchronize form inputs when active selected student changes
  useEffect(() => {
    if (selectedStudent) {
      const current = submissions.find((s) => s.studentId === selectedStudent.studentId) || selectedStudent;
      const existingMarks = current.result?.marks ?? current.attempt?.score;
      const existingFeedback = current.result?.teacherFeedback ?? current.attempt?.teacherFeedback;
      setMarksInput(existingMarks !== undefined && existingMarks !== null ? String(existingMarks) : '');
      setFeedbackInput(existingFeedback || '');
    }
  }, [selectedStudent?.studentId]);

  // Individual Marking Save (with Published Warning Audit)
  const handleSaveIndividualMark = async (isDraft = false) => {
    if (!selectedStudent || !exam) return;

    const numMarks = parseFloat(marksInput);
    if (isNaN(numMarks) || numMarks < 0 || numMarks > exam.totalMarks) {
      showToast(`Marks must be a valid number between 0 and ${exam.totalMarks}`, 'error');
      return;
    }

    // Check if result is already published and marks changed
    const wasPublished = selectedStudent.result?.resultStatus === 'PUBLISHED';
    const marksChanged = selectedStudent.result?.marks !== numMarks;

    if (wasPublished && marksChanged && !auditReason) {
      setPendingAction({ type: 'SAVE_PUBLISHED', isDraft });
      setShowAuditModal(true);
      return;
    }

    setSavingMark(true);
    try {
      const res = await api.put(`/exams/${examId}/submissions/${selectedStudent.studentId}/mark`, {
        marks: numMarks,
        feedback: feedbackInput,
        isDraft,
        reason: auditReason || null,
      });

      if (res.data?.success) {
        showToast(res.data.message || 'Marks saved successfully', 'success');
        setAuditReason('');
        setShowAuditModal(false);
        setPendingAction(null);
        await fetchSubmissions();
        const updatedResult = res.data.data;
        setSelectedStudent((prev) => (prev ? { ...prev, result: updatedResult } : null));
        setMarksInput(updatedResult?.marks !== undefined && updatedResult?.marks !== null ? String(updatedResult.marks) : '');
        setFeedbackInput(updatedResult?.teacherFeedback || '');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save marks', 'error');
    } finally {
      setSavingMark(false);
    }
  };

  // Publish / Unpublish Single Result
  const handleTogglePublish = async (sub) => {
    const isPub = sub.result?.resultStatus === 'PUBLISHED';
    try {
      const url = `/exams/${examId}/results/${sub.studentId}/${isPub ? 'unpublish' : 'publish'}`;
      const res = await api.patch(url);
      if (res.data?.success) {
        showToast(res.data.message, 'success');
        fetchSubmissions();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Action failed', 'error');
    }
  };

  // Bulk Publish All
  const handlePublishAll = async () => {
    if (!window.confirm('Are you sure you want to publish all evaluated marks? Students and Parents will immediately be able to view their results.')) {
      return;
    }

    setPublishingAll(true);
    try {
      const res = await api.patch(`/exams/${examId}/results/publish-all`);
      if (res.data?.success) {
        showToast(res.data.message || 'All evaluated results published', 'success');
        fetchSubmissions();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to publish all results', 'error');
    } finally {
      setPublishingAll(false);
    }
  };

  // Bulk Save Spreadsheet Entries
  const handleSaveBulkSpreadsheet = async () => {
    const marksList = [];
    for (const sub of submissions) {
      const markVal = bulkMarksMap[sub.studentId];
      if (markVal !== undefined && markVal !== '' && markVal !== null) {
        const num = parseFloat(markVal);
        if (isNaN(num) || num < 0 || num > exam.totalMarks) {
          showToast(`Invalid mark for ${sub.studentName}. Must be between 0 and ${exam.totalMarks}`, 'error');
          return;
        }
        marksList.push({
          studentId: sub.studentId,
          marks: num,
          feedback: bulkFeedbackMap[sub.studentId] || null,
        });
      }
    }

    if (marksList.length === 0) {
      showToast('No marks entered to save.', 'info');
      return;
    }

    setSavingBulk(true);
    try {
      const res = await api.post(`/exams/${examId}/submissions/bulk`, {
        marksList,
        reason: 'Spreadsheet batch marks entry',
      });
      if (res.data?.success) {
        showToast(res.data.message || 'Bulk marks saved successfully', 'success');
        fetchSubmissions();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save bulk marks', 'error');
    } finally {
      setSavingBulk(false);
    }
  };

  // Export CSV Template
  const handleDownloadCsvTemplate = async () => {
    if (downloadingCsv) return;
    setDownloadingCsv(true);
    try {
      await downloadAuthenticatedFile(
        `/exams/${examId}/submissions/export-csv`,
        `Marks_Template_${exam?.title?.replace(/[^a-zA-Z0-9]/g, '_') || examId}.csv`
      );
      showToast('CSV template downloaded successfully', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to download CSV template', 'error');
    } finally {
      setDownloadingCsv(false);
    }
  };

  // Stage 1: Upload & Preview CSV (Dry Run)
  const handleCsvPreview = async (e) => {
    e.preventDefault();
    if (!csvFile) {
      showToast('Please select a CSV file first', 'error');
      return;
    }

    setCsvPreviewing(true);
    setCsvPreviewData(null);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);

      const res = await api.post(`/exams/${examId}/submissions/preview-csv`, formData);

      if (res.data?.success) {
        setCsvPreviewData(res.data.data);
        showToast('CSV validated successfully. Review preview before confirming.', 'success');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'CSV validation failed', 'error');
    } finally {
      setCsvPreviewing(false);
    }
  };

  // Stage 2: Confirm CSV Import (Persist)
  const handleCsvConfirmImport = async () => {
    if (!csvPreviewData || !csvPreviewData.validRows || csvPreviewData.validRows.length === 0) {
      showToast('No valid rows to import', 'error');
      return;
    }

    setCsvConfirming(true);
    try {
      const res = await api.post(`/exams/${examId}/submissions/confirm-csv`, {
        rows: csvPreviewData.validRows,
        reason: csvAuditReason || 'CSV Bulk Import',
      });

      if (res.data?.success) {
        showToast(res.data.message || 'CSV imported successfully', 'success');
        setCsvFile(null);
        setCsvPreviewData(null);
        setCsvAuditReason('');
        await fetchSubmissions();
        setActiveTab('queue');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to confirm CSV import', 'error');
    } finally {
      setCsvConfirming(false);
    }
  };

  // Download Official PDF
  const handleDownloadPdf = async (sub) => {
    if (downloadingPdfMap[sub.studentId]) return;
    setDownloadingPdfMap((prev) => ({ ...prev, [sub.studentId]: true }));
    try {
      await downloadAuthenticatedFile(
        `/exams/${examId}/results/${sub.studentId}/pdf`,
        `Result_${(sub.studentName || sub.studentId).toString().replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      );
    } catch (err) {
      showToast(err.message || 'Failed to download result PDF', 'error');
    } finally {
      setDownloadingPdfMap((prev) => ({ ...prev, [sub.studentId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-600 font-semibold text-sm">Loading Examination Marking Hub...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toast.show && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 transition-all ${
            toast.type === 'error'
              ? 'bg-rose-600 text-white'
              : toast.type === 'info'
              ? 'bg-indigo-600 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      {/* Top Header & Breadcrumbs (Indigo/Violet Glass Card) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-6 md:p-8 rounded-3xl border border-indigo-100/80 shadow-[0_10px_35px_rgba(79,70,229,0.06)]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 mb-2">
            <Link to="/admin/exams" className="hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> All Examinations
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-slate-500">Written Exam Evaluation</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{exam?.title}</h1>
          <div className="flex flex-wrap items-center gap-2.5 mt-3 text-xs">
            <span className="px-3 py-1 rounded-xl bg-indigo-50/90 border border-indigo-100 text-indigo-900 font-bold">
              Total Marks: {exam?.totalMarks}
            </span>
            <span className="px-3 py-1 rounded-xl bg-indigo-50/90 border border-indigo-100 text-indigo-900 font-bold">
              Pass Marks: {exam?.passingMarks} ({exam?.passMarkType || 'MARKS'})
            </span>
            <span className="px-3 py-1 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 font-bold">
              Written Assessment
            </span>
            <span className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold">
              {submissions.length} Enrolled Students
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchSubmissions}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-2 border border-slate-200 shadow-2xs transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={handlePublishAll}
            disabled={publishingAll || analytics.markedCount === 0}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50 transition"
          >
            <Send className="w-3.5 h-3.5" /> {publishingAll ? 'Publishing...' : 'Publish All Evaluated'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-indigo-100/80 pb-2">
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
            activeTab === 'queue'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 border border-indigo-600'
              : 'bg-white/80 backdrop-blur-md text-slate-600 hover:text-slate-900 hover:bg-white border border-indigo-50 shadow-2xs'
          }`}
        >
          <FileCheck className="w-4 h-4" /> Submissions Queue ({submissions.length})
        </button>

        <button
          onClick={() => setActiveTab('split_marking')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
            activeTab === 'split_marking'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 border border-indigo-600'
              : 'bg-white/80 backdrop-blur-md text-slate-600 hover:text-slate-900 hover:bg-white border border-indigo-50 shadow-2xs'
          }`}
        >
          <Edit3 className="w-4 h-4" /> Interactive PDF Workspace
        </button>

        <button
          onClick={() => setActiveTab('bulk_table')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
            activeTab === 'bulk_table'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 border border-indigo-600'
              : 'bg-white/80 backdrop-blur-md text-slate-600 hover:text-slate-900 hover:bg-white border border-indigo-50 shadow-2xs'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" /> Batch Spreadsheet Entry
        </button>

        <button
          onClick={() => setActiveTab('csv_import')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
            activeTab === 'csv_import'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 border border-indigo-600'
              : 'bg-white/80 backdrop-blur-md text-slate-600 hover:text-slate-900 hover:bg-white border border-indigo-50 shadow-2xs'
          }`}
        >
          <Upload className="w-4 h-4" /> 2-Stage CSV Import & Export
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
            activeTab === 'analytics'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 border border-indigo-600'
              : 'bg-white/80 backdrop-blur-md text-slate-600 hover:text-slate-900 hover:bg-white border border-indigo-50 shadow-2xs'
          }`}
        >
          <BarChart2 className="w-4 h-4" /> Real Analytics Hub
        </button>
      </div>

      {/* TAB 1: Submissions Queue */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-indigo-100/80 shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search student or admission no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 font-bold">Filter:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-bold focus:outline-none focus:border-indigo-500 focus:bg-white transition"
              >
                <option value="ALL">All Enrolled ({submissions.length})</option>
                <option value="SUBMITTED">Submitted Papers</option>
                <option value="MARKED">Evaluated (Unpublished)</option>
                <option value="PUBLISHED">Published Results</option>
                <option value="PENDING">Pending Evaluation</option>
              </select>
            </div>
          </div>

          {/* Submissions Table */}
          <div className="overflow-x-auto rounded-3xl border border-indigo-100/80 bg-white/80 backdrop-blur-md shadow-[0_10px_35px_rgba(79,70,229,0.05)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white border-b border-indigo-950 uppercase tracking-wider font-bold">
                  <th className="p-4 text-[#FFD978]">Student Particulars</th>
                  <th className="p-4 text-white">Paper Submission</th>
                  <th className="p-4 text-white">Score & Percentage</th>
                  <th className="p-4 text-white">Grade & Outcome</th>
                  <th className="p-4 text-white">Status</th>
                  <th className="p-4 text-right text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-50 font-medium text-slate-700">
                {filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No matching student submissions found for this examination.
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((sub) => {
                    const isPub = sub.result?.resultStatus === 'PUBLISHED';
                    const isMarked = sub.result?.resultStatus === 'MARKED';
                    const hasMarks = sub.result?.marks !== undefined && sub.result?.marks !== null;

                    return (
                      <tr key={sub.studentId} className="hover:bg-indigo-50/40 transition">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-xs border border-indigo-100 shadow-2xs">
                              {sub.studentName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-slate-900 font-bold text-sm">{sub.studentName}</p>
                              <p className="text-[11px] text-slate-400">
                                Adm: {sub.admissionNumber || '—'} {sub.rollNo ? `• Roll: ${sub.rollNo}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          {sub.hasSubmission ? (
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold text-[11px]">
                                PDF Paper Uploaded
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">No Submission</span>
                          )}
                        </td>

                        <td className="p-4">
                          {hasMarks ? (
                            <div>
                              <span className="text-slate-900 font-bold text-sm">
                                {sub.result.marks} <span className="text-xs text-slate-400">/ {exam.totalMarks}</span>
                              </span>
                              <p className="text-[11px] text-slate-500 font-semibold">{sub.result.percentage}%</p>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-semibold">—</span>
                          )}
                        </td>

                        <td className="p-4">
                          {hasMarks ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-md font-black text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {sub.result.grade}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  sub.result.status === 'PASS'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {sub.result.status}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="p-4">
                          {isPub ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              PUBLISHED
                            </span>
                          ) : isMarked ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              EVALUATED
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              PENDING
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleSelectStudent(sub)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Grade Paper
                            </button>

                            {hasMarks && (
                              <button
                                onClick={() => handleTogglePublish(sub)}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition ${
                                  isPub
                                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {isPub ? 'Unpublish' : 'Publish'}
                              </button>
                            )}

                            {hasMarks && (
                              <button
                                disabled={downloadingPdfMap[sub.studentId]}
                                onClick={() => handleDownloadPdf(sub)}
                                title="Download Official Result PDF"
                                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition disabled:opacity-50"
                              >
                                {downloadingPdfMap[sub.studentId] ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#FFD978]" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Interactive Split-Screen Marking Workspace */}
      {activeTab === 'split_marking' && (
        <div className="space-y-4">
          {!selectedStudent ? (
            <div className="bg-white/80 backdrop-blur-md p-12 text-center rounded-3xl border border-indigo-100 shadow-[0_10px_35px_rgba(79,70,229,0.06)]">
              <User className="w-12 h-12 text-indigo-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-900 mb-1">Select a Student to Begin Evaluation</h3>
              <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto">
                Choose any student from the queue to view their uploaded answer paper alongside the evaluation panel.
              </p>
              <button
                onClick={() => setActiveTab('queue')}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition"
              >
                Go to Submissions Queue
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Protected PDF Viewer (7 Cols) */}
              <div className="lg:col-span-7 bg-white rounded-3xl border border-indigo-100 flex flex-col h-[750px] overflow-hidden shadow-[0_10px_35px_rgba(79,70,229,0.06)]">
                <div className="p-4 bg-slate-900 border-b border-indigo-950 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#FFD978]" />
                    <span className="font-bold text-xs text-white">
                      Answer Document: {selectedStudent.studentName}
                    </span>
                  </div>

                  {selectedStudent.hasSubmission && (
                    <button
                      type="button"
                      onClick={() => openAuthenticatedFileInNewWindow(`/exams/${examId}/submissions/${selectedStudent.studentId}/answer-pdf`)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Open in New Tab
                    </button>
                  )}
                </div>

                <div className="flex-1 bg-slate-50 relative">
                  {selectedStudent.hasSubmission ? (
                    loadingPdf ? (
                      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
                        <p className="text-xs font-bold text-slate-600">Loading answer document...</p>
                      </div>
                    ) : pdfError ? (
                      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                        <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
                        <p className="text-xs font-bold text-rose-600 mb-1">Failed to load preview</p>
                        <p className="text-[11px] text-slate-500">{pdfError}</p>
                      </div>
                    ) : pdfBlobUrl ? (
                      <iframe
                        src={pdfBlobUrl}
                        title="Answer Paper Preview"
                        className="w-full h-full border-none"
                      />
                    ) : null
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                      <AlertCircle className="w-12 h-12 text-amber-500 mb-3" />
                      <h4 className="text-slate-900 font-bold text-sm mb-1">No Physical Answer Paper Uploaded</h4>
                      <p className="text-xs text-slate-500 max-w-sm">
                        This student has not submitted a digital PDF/image paper. You can still evaluate and record marks directly using the right-hand panel.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Marks & Feedback Entry Panel (5 Cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white/90 backdrop-blur-md p-6 md:p-7 rounded-3xl border border-indigo-100 shadow-[0_10px_35px_rgba(79,70,229,0.08)] space-y-5">
                  <div className="border-b border-indigo-100/80 pb-4">
                    <span className="text-[10px] uppercase tracking-wider text-indigo-600 font-black">
                      Student Evaluation Panel
                    </span>
                    <h2 className="text-lg font-black text-slate-900 mt-1">{selectedStudent.studentName}</h2>
                    <p className="text-xs text-slate-400 font-medium">
                      Admission No: {selectedStudent.admissionNumber || '—'}
                    </p>
                  </div>

                  {/* Marks Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Marks Awarded (Max: {exam?.totalMarks}) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max={exam?.totalMarks}
                        value={marksInput}
                        onChange={(e) => setMarksInput(e.target.value)}
                        placeholder={`0 - ${exam?.totalMarks}`}
                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-lg font-black text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                        / {exam?.totalMarks}
                      </span>
                    </div>
                  </div>

                  {/* Real-time Computed Grade & Outcome Preview */}
                  {marksInput !== '' && !isNaN(parseFloat(marksInput)) && (
                    <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-bold">Percentage:</span>
                        <span className="text-indigo-900 font-black">
                          {Math.round((parseFloat(marksInput) / exam.totalMarks) * 10000) / 100}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-bold">Estimated Outcome:</span>
                        <span
                          className={`font-black ${
                            (exam.passMarkType === 'PERCENTAGE'
                              ? (parseFloat(marksInput) / exam.totalMarks) * 100 >= exam.passingMarks
                              : parseFloat(marksInput) >= exam.passingMarks)
                              ? 'text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md'
                              : 'text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md'
                          }`}
                        >
                          {(exam.passMarkType === 'PERCENTAGE'
                            ? (parseFloat(marksInput) / exam.totalMarks) * 100 >= exam.passingMarks
                            : parseFloat(marksInput) >= exam.passingMarks)
                            ? 'PASS'
                            : 'FAIL'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Teacher Feedback / Remarks */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Teacher Remarks & Constructive Feedback (Optional)
                    </label>
                    <textarea
                      rows={4}
                      value={feedbackInput}
                      onChange={(e) => setFeedbackInput(e.target.value)}
                      placeholder="e.g. Well argued steps in Question 3. Need to focus on algebra formulas."
                      className="w-full p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white resize-none transition"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2.5 pt-2">
                    <button
                      onClick={() => handleSaveIndividualMark(false)}
                      disabled={savingMark || marksInput === ''}
                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-black text-xs shadow-md shadow-indigo-500/20 disabled:opacity-50 transition flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" /> {savingMark ? 'Saving Marks...' : 'Save & Finalize Evaluation'}
                    </button>

                    <button
                      onClick={() => handleSaveIndividualMark(true)}
                      disabled={savingMark || marksInput === ''}
                      className="w-full py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 shadow-2xs disabled:opacity-50 transition"
                    >
                      Save as Evaluation Draft
                    </button>
                  </div>
                </div>

                {/* Quick Next / Prev navigation */}
                <div className="flex items-center justify-between px-2">
                  <button
                    onClick={() => {
                      const idx = submissions.findIndex((s) => s.studentId === selectedStudent.studentId);
                      if (idx > 0) handleSelectStudent(submissions[idx - 1]);
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-900 transition"
                  >
                    ← Previous Student
                  </button>

                  <button
                    onClick={() => {
                      const idx = submissions.findIndex((s) => s.studentId === selectedStudent.studentId);
                      if (idx < submissions.length - 1) handleSelectStudent(submissions[idx + 1]);
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition"
                  >
                    Next Student →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Batch Spreadsheet Marks Entry */}
      {activeTab === 'bulk_table' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-indigo-100/80 shadow-2xs">
            <div>
              <h3 className="text-sm font-black text-slate-900">Batch Spreadsheet Marks Entry</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Directly type marks and remarks into the grid and click save to evaluate all students in one batch transaction.
              </p>
            </div>

            <button
              onClick={handleSaveBulkSpreadsheet}
              disabled={savingBulk}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-black text-xs shadow-md shadow-indigo-500/20 disabled:opacity-50 transition flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> {savingBulk ? 'Saving Batch...' : 'Save All Entered Marks'}
            </button>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-indigo-100/80 bg-white/80 backdrop-blur-md shadow-[0_10px_35px_rgba(79,70,229,0.05)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white border-b border-indigo-950 uppercase tracking-wider font-bold">
                  <th className="p-3.5 text-[#FFD978]">#</th>
                  <th className="p-3.5 text-white">Student</th>
                  <th className="p-3.5 text-white">Admission No</th>
                  <th className="p-3.5 w-32 text-white">Marks (/{exam.totalMarks})</th>
                  <th className="p-3.5 text-white">Teacher Feedback</th>
                  <th className="p-3.5 text-white">Current Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-50 font-medium text-slate-700">
                {submissions.map((sub, idx) => (
                  <tr key={sub.studentId} className="hover:bg-indigo-50/40 transition">
                    <td className="p-3.5 text-slate-400 font-bold">{idx + 1}</td>
                    <td className="p-3.5 text-slate-900 font-bold">{sub.studentName}</td>
                    <td className="p-3.5 text-slate-500 font-medium">{sub.admissionNumber || '—'}</td>
                    <td className="p-3.5">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max={exam.totalMarks}
                        value={bulkMarksMap[sub.studentId] !== undefined ? bulkMarksMap[sub.studentId] : ''}
                        onChange={(e) =>
                          setBulkMarksMap((prev) => ({
                            ...prev,
                            [sub.studentId]: e.target.value,
                          }))
                        }
                        placeholder="0"
                        className="w-24 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                      />
                    </td>
                    <td className="p-3.5">
                      <input
                        type="text"
                        value={bulkFeedbackMap[sub.studentId] || ''}
                        onChange={(e) =>
                          setBulkFeedbackMap((prev) => ({
                            ...prev,
                            [sub.studentId]: e.target.value,
                          }))
                        }
                        placeholder="Remarks..."
                        className="w-full max-w-md px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                      />
                    </td>
                    <td className="p-3.5">
                      {sub.result?.resultStatus === 'PUBLISHED' ? (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                          PUBLISHED
                        </span>
                      ) : sub.result?.resultStatus === 'MARKED' ? (
                        <span className="text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                          EVALUATED
                        </span>
                      ) : (
                        <span className="text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                          PENDING
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: 2-Stage CSV Import & Export */}
      {activeTab === 'csv_import' && (
        <div className="space-y-6">
          {/* Download CSV Template Card */}
          <div className="bg-white/80 backdrop-blur-md p-6 md:p-7 rounded-3xl border border-indigo-100/80 shadow-[0_10px_35px_rgba(79,70,229,0.06)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Download Pre-Formatted CSV Template</h3>
              <p className="text-xs text-slate-500 mt-1">
                Generates a clean CSV file pre-populated with all enrolled student admission numbers and names.
              </p>
            </div>

            <button
              disabled={downloadingCsv}
              onClick={handleDownloadCsvTemplate}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 flex items-center gap-2 transition disabled:opacity-50"
            >
              {downloadingCsv ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Download className="w-4 h-4 text-white" />
              )}
              <span>{downloadingCsv ? 'Downloading...' : 'Download CSV Template'}</span>
            </button>
          </div>

          {/* Phase 1: Upload & Validate (Dry Run) */}
          <div className="bg-white/80 backdrop-blur-md p-6 md:p-7 rounded-3xl border border-indigo-100/80 shadow-[0_10px_35px_rgba(79,70,229,0.06)] space-y-4">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-indigo-600 font-black">
                Phase 1: CSV Validation & Dry-Run Preview
              </span>
              <h3 className="text-base font-black text-slate-900 mt-0.5">Upload Completed Marks CSV</h3>
              <p className="text-xs text-slate-500">
                This stage only validates the file format, student admission numbers, and mark limits without saving to the database.
              </p>
            </div>

            <form onSubmit={handleCsvPreview} className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  setCsvFile(e.target.files[0]);
                  setCsvPreviewData(null);
                }}
                className="w-full sm:w-auto flex-1 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 text-xs text-slate-500 cursor-pointer"
              />

              <button
                type="submit"
                disabled={csvPreviewing || !csvFile}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-black text-xs shadow-md shadow-indigo-500/20 disabled:opacity-50 transition"
              >
                {csvPreviewing ? 'Validating...' : 'Validate CSV File'}
              </button>
            </form>
          </div>

          {/* Preview Results & Phase 2 Confirm Button */}
          {csvPreviewData && (
            <div className="space-y-4 bg-white/90 backdrop-blur-md p-6 md:p-7 rounded-3xl border border-indigo-100 shadow-[0_10px_35px_rgba(79,70,229,0.08)]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <p className="text-xs text-slate-500 font-bold">Total Rows in File</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{csvPreviewData.totalRows}</p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                  <p className="text-xs text-emerald-700 font-bold">Valid Rows</p>
                  <p className="text-2xl font-black text-emerald-800 mt-1">{csvPreviewData.validRows.length}</p>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center">
                  <p className="text-xs text-rose-700 font-bold">Invalid Rows / Errors</p>
                  <p className="text-2xl font-black text-rose-800 mt-1">{csvPreviewData.invalidRows.length}</p>
                </div>
              </div>

              {/* Invalid Rows Table if errors exist */}
              {csvPreviewData.invalidRows.length > 0 && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                  <h4 className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" /> Row-Level Validation Errors:
                  </h4>
                  <ul className="text-xs text-rose-700 space-y-1 list-disc pl-5 font-medium">
                    {csvPreviewData.invalidRows.map((inv, i) => (
                      <li key={i}>
                        Row {inv.row}: Admission No "{inv.admissionNumber || '—'}" — {inv.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Phase 2 Confirm Controls */}
              {csvPreviewData.canImport && (
                <div className="pt-4 border-t border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="w-full sm:w-96">
                    <input
                      type="text"
                      placeholder="Audit Reason (Optional, e.g. Midterm CSV Upload)"
                      value={csvAuditReason}
                      onChange={(e) => setCsvAuditReason(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                  </div>

                  <button
                    onClick={handleCsvConfirmImport}
                    disabled={csvConfirming}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {csvConfirming ? 'Importing...' : `Confirm Import of ${csvPreviewData.validRows.length} Records`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Real Analytics Hub */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/80 backdrop-blur-md p-5 md:p-6 rounded-3xl border border-indigo-100/80 shadow-[0_10px_35px_rgba(79,70,229,0.06)]">
              <span className="text-xs text-slate-500 font-bold">Evaluation Completion</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {analytics.markedCount} <span className="text-xs text-slate-400">/ {analytics.totalEnrolled}</span>
              </p>
              <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all"
                  style={{ width: `${(analytics.markedCount / (analytics.totalEnrolled || 1)) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-md p-5 md:p-6 rounded-3xl border border-indigo-100/80 shadow-[0_10px_35px_rgba(79,70,229,0.06)]">
              <span className="text-xs text-slate-500 font-bold">Class Pass Rate</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">{analytics.passRate}%</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                {analytics.passCount} Passed • {analytics.failCount} Failed
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-md p-5 md:p-6 rounded-3xl border border-indigo-100/80 shadow-[0_10px_35px_rgba(79,70,229,0.06)]">
              <span className="text-xs text-slate-500 font-bold">Class Average Score</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {analytics.avgMarks} <span className="text-xs text-slate-400">/ {exam.totalMarks}</span>
              </p>
              <p className="text-xs text-slate-400 mt-1 font-medium">Average Percentage: {analytics.avgPercentage}%</p>
            </div>

            <div className="bg-white/80 backdrop-blur-md p-5 md:p-6 rounded-3xl border border-indigo-100/80 shadow-[0_10px_35px_rgba(79,70,229,0.06)]">
              <span className="text-xs text-slate-500 font-bold">Score Range</span>
              <p className="text-2xl font-black text-amber-600 mt-1">
                {analytics.highestMark} <span className="text-xs text-slate-400 font-bold">High</span>
              </p>
              <p className="text-xs text-slate-400 mt-1 font-medium">Lowest Score: {analytics.lowestMark}</p>
            </div>
          </div>

          {/* Grade Distribution Breakdown */}
          <div className="bg-white/80 backdrop-blur-md p-6 md:p-7 rounded-3xl border border-indigo-100/80 shadow-[0_10px_35px_rgba(79,70,229,0.06)] space-y-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" /> Real Grade Distribution
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Object.entries(analytics.gradeDistribution).map(([grade, count]) => (
                <div key={grade} className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-center">
                  <span className="text-base font-black text-indigo-700">Grade {grade}</span>
                  <p className="text-2xl font-black text-slate-900 mt-1">{count}</p>
                  <p className="text-[11px] text-slate-500 mt-1 font-medium">
                    {analytics.markedCount > 0
                      ? `${Math.round((count / analytics.markedCount) * 100)}% of evaluated`
                      : '0%'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Audit Reason Modal (Prompted when modifying already published results) */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white p-6 md:p-7 rounded-3xl border border-indigo-100 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-black text-slate-900">Modify Published Academic Result</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This student's result is currently <strong className="text-emerald-600">PUBLISHED</strong> and visible to the student and parent. Modifying these marks will update live academic transcripts and create an immutable audit record.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Audit Reason for Mark Adjustment *
              </label>
              <textarea
                rows={3}
                value={auditReason}
                onChange={(e) => setAuditReason(e.target.value)}
                placeholder="e.g. Question 4 marks recount requested by student during scrutiny."
                className="w-full p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white resize-none transition"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowAuditModal(false);
                  setPendingAction(null);
                  setAuditReason('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Cancel
              </button>

              <button
                onClick={() => handleSaveIndividualMark(pendingAction?.isDraft || false)}
                disabled={!auditReason.trim()}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 transition"
              >
                Confirm & Log Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
