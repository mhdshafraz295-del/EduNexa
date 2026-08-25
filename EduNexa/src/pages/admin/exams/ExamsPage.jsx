import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { apiRequest } from '../../../services/api';
import PageHeader from '../../../components/common/PageHeader';
import GlassCard from '../../../components/common/GlassCard';
import StatCard from '../../../components/common/StatCard';
import EmptyState from '../../../components/common/EmptyState';
import {
  Award,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  CheckCircle2,
  FileQuestion,
  FileText,
  Users,
  BarChart3,
  Edit2,
  Trash2,
  Eye,
  Send,
  X,
  AlertTriangle,
  Layers,
  ChevronRight,
  TrendingUp,
  RotateCcw,
  Check,
  Percent,
  Radio,
  ArrowUp,
  ArrowDown,
  Copy,
  BookOpen,
  GraduationCap,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

export default function ExamsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [exams, setExams] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [academicLevels, setAcademicLevels] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classSubjectsMap, setClassSubjectsMap] = useState({});
  const [allSubjects, setAllSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [examToEdit, setExamToEdit] = useState(null);
  const [questionBuilderExam, setQuestionBuilderExam] = useState(null);
  const [monitorExam, setMonitorExam] = useState(null);
  const [analyticsExam, setAnalyticsExam] = useState(null);
  const [publishConfirmExam, setPublishConfirmExam] = useState(null);
  const [publishingAction, setPublishingAction] = useState(false);

  // Form data for creating/editing exam
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    instructions: 'Choose the single best option for each question. Answers auto-submit when the timer expires.',
    examType: 'MCQ', // 'MCQ' | 'WRITTEN'
    academicYearId: '',
    academicLevelId: '',
    classId: '',
    subjectId: '',
    teacherId: '',
    totalMarks: 100,
    passingMarks: 40,
    passMarkType: 'MARKS', // 'MARKS' | 'PERCENTAGE'
    startDateTime: '',
    endDateTime: '',
    durationMinutes: 60,
    maxAttempts: 1,
    randomizeQuestions: false,
    randomizeOptions: false,
    publishResult: true,
    questions: [],
  });

  const [classSubjectsLoading, setClassSubjectsLoading] = useState(false);
  const [savingExam, setSavingExam] = useState(false);
  const [examFormError, setExamFormError] = useState('');

  // 1. Fetch Foundation Data
  const fetchFoundationData = useCallback(async () => {
    try {
      const [ayRes, lvlRes, clsRes, subRes, tchRes] = await Promise.all([
        apiRequest('/academic/years').catch(() => ({ success: false })),
        apiRequest('/academic/levels').catch(() => ({ success: false })),
        apiRequest('/academic/classes').catch(() => ({ success: false })),
        apiRequest('/academic/subjects').catch(() => ({ success: false })),
        apiRequest('/teachers').catch(() => ({ success: false })),
      ]);

      if (ayRes.success) setAcademicYears(ayRes.data || []);
      if (lvlRes.success) setAcademicLevels(lvlRes.data || []);
      if (clsRes.success) setClasses(clsRes.data || []);
      if (subRes.success) setAllSubjects(subRes.data || []);
      if (tchRes.success) setTeachers(tchRes.data || []);
    } catch (err) {
      console.error('Failed to load academic foundation:', err);
    }
  }, []);

  // 2. Fetch Exams List
  const fetchExams = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/exams');
      if (res.success) {
        setExams(res.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load exams.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFoundationData();
    fetchExams();
  }, [fetchFoundationData, fetchExams]);

  // Dynamically load class-specific subjects when classId changes in form
  const loadClassSubjects = useCallback(async (cId) => {
    if (!cId) return;
    if (classSubjectsMap[cId]) return;
    try {
      setClassSubjectsLoading(true);
      const res = await apiRequest(`/academic/classes/${cId}/subjects`);
      if (res.success && Array.isArray(res.data)) {
        const mapped = res.data.map((item) => item.subject || item);
        setClassSubjectsMap((prev) => ({ ...prev, [cId]: mapped }));
      }
    } catch (err) {
      console.warn('Class subjects load fallback:', err);
    } finally {
      setClassSubjectsLoading(false);
    }
  }, [classSubjectsMap]);

  // Handle Class change in form
  const handleClassChange = (selectedClassId) => {
    const targetClass = classes.find((c) => String(c.id) === String(selectedClassId));
    setFormData((prev) => ({
      ...prev,
      classId: selectedClassId,
      subjectId: '', // reset subject when class changes
      academicLevelId: targetClass?.levelId || prev.academicLevelId,
    }));
    if (selectedClassId) {
      loadClassSubjects(selectedClassId);
    }
  };

  // Open Create Live Exam Modal
  const openCreateModal = () => {
    const currentYear = academicYears.find((y) => y.isCurrent) || academicYears[0];
    const firstClass = classes[0];
    setExamToEdit(null);
    setFormData({
      title: '',
      description: '',
      instructions: 'Choose the single best option for each question. Answers auto-submit when the timer expires.',
      examType: 'MCQ',
      academicYearId: currentYear ? currentYear.id : '',
      academicLevelId: firstClass?.levelId || '',
      classId: firstClass?.id || '',
      subjectId: '',
      teacherId: '',
      totalMarks: 100,
      passingMarks: 40,
      passMarkType: 'MARKS',
      startDateTime: '',
      endDateTime: '',
      durationMinutes: 60,
      maxAttempts: 1,
      randomizeQuestions: false,
      randomizeOptions: false,
      publishResult: true,
      questions: [
        {
          question: '',
          options: [
            { id: 'A', text: '' },
            { id: 'B', text: '' },
            { id: 'C', text: '' },
            { id: 'D', text: '' },
          ],
          correctAnswer: 'A',
          marks: 10,
          explanation: '',
        },
      ],
    });
    setExamFormError('');
    if (firstClass?.id) {
      loadClassSubjects(firstClass.id);
    }
    setCreateModalOpen(true);
  };

  // Auto-open create modal if navigated with ?action=create or location.state.openCreate
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'create' || location.state?.openCreate) {
      openCreateModal();
    }
  }, [location.search, location.state, academicYears, classes]);

  // Open Edit Modal
  const openEditModal = async (exam) => {
    setExamToEdit(exam);
    try {
      const res = await apiRequest(`/exams/${exam.id}`);
      const fullExam = res.success ? res.data : exam;
      const loadedQuestions = (fullExam.questions || []).map((q) => {
        const rawOpts = Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? JSON.parse(q.options || '[]') : []);
        const formattedOpts = ['A', 'B', 'C', 'D'].map((key, idx) => {
          const matched = rawOpts.find((o) => (o.id || o.key) === key) || rawOpts[idx];
          return {
            id: key,
            text: typeof matched === 'object' ? matched?.text || '' : (matched || ''),
          };
        });
        return {
          id: q.id,
          question: q.question || '',
          options: formattedOpts,
          correctAnswer: q.correctAnswer || 'A',
          marks: q.marks || 1,
          explanation: q.explanation || '',
        };
      });

      setFormData({
        title: fullExam.title || '',
        description: fullExam.description || '',
        instructions: fullExam.instructions || '',
        examType: fullExam.examType || 'MCQ',
        academicYearId: fullExam.academicYearId || '',
        academicLevelId: fullExam.class?.levelId || '',
        classId: fullExam.classId || '',
        subjectId: fullExam.subjectId || '',
        teacherId: fullExam.teacherId || '',
        totalMarks: fullExam.totalMarks || 100,
        passingMarks: fullExam.passingMarks || 40,
        passMarkType: fullExam.passMarkType || 'MARKS',
        startDateTime: fullExam.startDateTime ? fullExam.startDateTime.slice(0, 16) : '',
        endDateTime: fullExam.endDateTime ? fullExam.endDateTime.slice(0, 16) : '',
        durationMinutes: fullExam.durationMinutes || 60,
        maxAttempts: fullExam.maxAttempts || 1,
        randomizeQuestions: fullExam.randomizeQuestions || false,
        randomizeOptions: fullExam.randomizeOptions || false,
        publishResult: fullExam.publishResult ?? true,
        questions: loadedQuestions.length > 0 ? loadedQuestions : (fullExam.examType === 'MCQ' ? [
          {
            question: '',
            options: [
              { id: 'A', text: '' },
              { id: 'B', text: '' },
              { id: 'C', text: '' },
              { id: 'D', text: '' },
            ],
            correctAnswer: 'A',
            marks: 10,
            explanation: '',
          },
        ] : []),
      });

      if (fullExam.classId) {
        loadClassSubjects(fullExam.classId);
      }
    } catch (err) {
      console.error('Failed to load full exam for editing:', err);
    }
    setExamFormError('');
    setCreateModalOpen(true);
  };

  // Save (Create / Update) Exam with target status ('DRAFT' or 'PUBLISHED')
  const handleSaveExam = async (targetStatus = 'DRAFT') => {
    if (!formData.title.trim()) {
      setExamFormError('Please enter an Exam Title.');
      return;
    }
    if (!formData.classId) {
      setExamFormError('Please select a Target Class / Batch.');
      return;
    }
    if (!formData.subjectId) {
      setExamFormError('Please select an Academic Subject.');
      return;
    }

    const total = parseFloat(formData.totalMarks);
    const pass = parseFloat(formData.passingMarks);
    if (isNaN(total) || total <= 0) {
      setExamFormError('Total Marks must be greater than 0.');
      return;
    }
    if (isNaN(pass) || pass < 0) {
      setExamFormError('Pass Marks cannot be negative.');
      return;
    }
    if (formData.passMarkType === 'MARKS' && pass > total) {
      setExamFormError('Pass Marks cannot exceed Total Marks.');
      return;
    }

    // Schedule window checks
    if (formData.startDateTime && formData.endDateTime) {
      const s = new Date(formData.startDateTime);
      const e = new Date(formData.endDateTime);
      if (s >= e) {
        setExamFormError('Schedule End Time must be strictly after Start Time.');
        return;
      }
      const dur = parseInt(formData.durationMinutes) || 60;
      const windowMins = (e.getTime() - s.getTime()) / (1000 * 60);
      if (windowMins < dur) {
        setExamFormError(`Duration (${dur} mins) cannot exceed the scheduled window (${Math.round(windowMins)} mins).`);
        return;
      }
    }

    // MCQ Questions validation if publishing
    if (formData.examType === 'MCQ' && targetStatus === 'PUBLISHED') {
      if (!formData.questions || formData.questions.length === 0) {
        setExamFormError('Cannot publish an MCQ exam without questions. Please add at least one question.');
        return;
      }

      let qSum = 0;
      for (let i = 0; i < formData.questions.length; i++) {
        const q = formData.questions[i];
        if (!q.question || !q.question.trim()) {
          setExamFormError(`Question #${i + 1} is missing question text.`);
          return;
        }
        const validOpts = (q.options || []).filter((o) => o.text && o.text.trim());
        if (validOpts.length < 2) {
          setExamFormError(`Question #${i + 1} must have at least 2 valid options (A & B).`);
          return;
        }
        if (!q.correctAnswer) {
          setExamFormError(`Question #${i + 1} must have a correct answer selected.`);
          return;
        }
        const qm = parseFloat(q.marks);
        if (isNaN(qm) || qm <= 0) {
          setExamFormError(`Question #${i + 1} marks must be greater than 0.`);
          return;
        }
        qSum += qm;
      }

      if (Math.abs(qSum - total) > 0.01) {
        setExamFormError(`The sum of question marks (${qSum}) must equal the configured Total Marks (${total}).`);
        return;
      }
    }

    try {
      setSavingExam(true);
      setExamFormError('');

      const cleanQuestions = (formData.questions || []).map((q, idx) => ({
        question: q.question.trim(),
        options: (q.options || []).filter((o) => o.text && o.text.trim()),
        correctAnswer: q.correctAnswer,
        marks: parseFloat(q.marks) || 1,
        explanation: q.explanation?.trim() || null,
        displayOrder: idx + 1,
      }));

      const payload = {
        title: formData.title.trim(),
        description: formData.description?.trim() || null,
        instructions: formData.instructions?.trim() || null,
        examType: formData.examType,
        academicYearId: formData.academicYearId || null,
        classId: formData.classId,
        subjectId: formData.subjectId,
        teacherId: formData.teacherId || null,
        totalMarks: total,
        passingMarks: pass,
        passMarkType: formData.passMarkType,
        startDateTime: formData.startDateTime ? new Date(formData.startDateTime).toISOString() : null,
        endDateTime: formData.endDateTime ? new Date(formData.endDateTime).toISOString() : null,
        durationMinutes: parseInt(formData.durationMinutes) || 60,
        maxAttempts: parseInt(formData.maxAttempts) || 1,
        randomizeQuestions: formData.randomizeQuestions,
        randomizeOptions: formData.randomizeOptions,
        publishResult: formData.publishResult,
        status: targetStatus,
        questions: formData.examType === 'MCQ' ? cleanQuestions : [],
      };

      if (examToEdit) {
        await apiRequest(`/exams/${examToEdit.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/exams', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setCreateModalOpen(false);
      fetchExams();
    } catch (err) {
      setExamFormError(err.message || 'Failed to save exam.');
    } finally {
      setSavingExam(false);
    }
  };

  // Publish existing draft exam
  const handleDirectPublish = async (examId) => {
    try {
      setPublishingAction(true);
      const res = await apiRequest(`/exams/${examId}/publish`, { method: 'PATCH' });
      if (res.success) {
        setPublishConfirmExam(null);
        fetchExams();
      }
    } catch (err) {
      alert(err.message || 'Failed to publish exam.');
    } finally {
      setPublishingAction(false);
    }
  };

  // Delete / Archive Exam
  const handleDeleteExam = async (examId) => {
    if (!window.confirm('Are you sure you want to delete or archive this exam?')) return;
    try {
      await apiRequest(`/exams/${examId}`, { method: 'DELETE' });
      fetchExams();
    } catch (err) {
      alert(err.message || 'Failed to delete exam.');
    }
  };

  // Available subjects for the currently selected class in form
  const availableClassSubjects = useMemo(() => {
    if (!formData.classId) return [];
    if (classSubjectsMap[formData.classId] && classSubjectsMap[formData.classId].length > 0) {
      return classSubjectsMap[formData.classId];
    }
    return allSubjects;
  }, [formData.classId, classSubjectsMap, allSubjects]);

  // Filtered classes by Academic Level if selected in form
  const filteredFormClasses = useMemo(() => {
    if (!formData.academicLevelId) return classes;
    return classes.filter((c) => String(c.levelId) === String(formData.academicLevelId));
  }, [classes, formData.academicLevelId]);

  // Filtered Exams List for table / grid
  const filteredExams = useMemo(() => {
    return exams.filter((e) => {
      // Dynamic status filter
      if (statusFilter !== 'all') {
        const dynStatus = e.dynamicStatus || e.status;
        if (statusFilter === 'DRAFT' && e.status !== 'DRAFT') return false;
        if (statusFilter === 'UPCOMING' && dynStatus !== 'UPCOMING') return false;
        if (statusFilter === 'LIVE' && dynStatus !== 'LIVE') return false;
        if (statusFilter === 'COMPLETED' && dynStatus !== 'COMPLETED' && e.status !== 'CLOSED') return false;
        if (statusFilter === 'ARCHIVED' && e.status !== 'ARCHIVED') return false;
      }
      if (classFilter !== 'all' && String(e.classId) !== String(classFilter)) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesTitle = e.title?.toLowerCase().includes(q);
        const matchesClass = e.class?.name?.toLowerCase().includes(q);
        const matchesSub = e.subject?.name?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesClass && !matchesSub) return false;
      }
      return true;
    });
  }, [exams, statusFilter, classFilter, searchTerm]);

  // Counts for filter pills
  const counts = useMemo(() => {
    let draft = 0;
    let upcoming = 0;
    let live = 0;
    let completed = 0;
    let archived = 0;

    for (const e of exams) {
      const ds = e.dynamicStatus || e.status;
      if (e.status === 'DRAFT') draft++;
      else if (e.status === 'ARCHIVED') archived++;
      else if (ds === 'UPCOMING') upcoming++;
      else if (ds === 'LIVE') live++;
      else if (ds === 'COMPLETED' || e.status === 'CLOSED') completed++;
    }

    return {
      all: exams.length,
      draft,
      upcoming,
      live,
      completed,
      archived,
    };
  }, [exams]);

  // Inline Question Builder state helpers
  const handleAddQuestion = () => {
    setFormData((prev) => ({
      ...prev,
      questions: [
        ...(prev.questions || []),
        {
          question: '',
          options: [
            { id: 'A', text: '' },
            { id: 'B', text: '' },
            { id: 'C', text: '' },
            { id: 'D', text: '' },
          ],
          correctAnswer: 'A',
          marks: 10,
          explanation: '',
        },
      ],
    }));
  };

  const handleUpdateQuestion = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.questions];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, questions: updated };
    });
  };

  const handleUpdateOption = (qIndex, optId, text) => {
    setFormData((prev) => {
      const updated = [...prev.questions];
      const opts = [...(updated[qIndex].options || [])];
      const optIdx = opts.findIndex((o) => o.id === optId);
      if (optIdx >= 0) {
        opts[optIdx] = { ...opts[optIdx], text };
      } else {
        opts.push({ id: optId, text });
      }
      updated[qIndex] = { ...updated[qIndex], options: opts };
      return { ...prev, questions: updated };
    });
  };

  const handleDeleteQuestion = (index) => {
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  };

  const handleMoveQuestion = (index, direction) => {
    setFormData((prev) => {
      const list = [...prev.questions];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      return { ...prev, questions: list };
    });
  };

  const calculatedQuestionTotal = useMemo(() => {
    return (formData.questions || []).reduce((acc, q) => acc + (parseFloat(q.marks) || 0), 0);
  }, [formData.questions]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        badge="Online Examinations"
        title="Live Exam & Assessment Hub"
        description="Schedule, configure, and publish timed MCQ and Written Live examinations across academic batches."
        action={
          <div className="flex items-center gap-2.5">
            <Link
              to="/admin/exams/term-reports"
              className="px-4 py-2.5 rounded-2xl bg-[#FFD978] hover:bg-[#F2CD6D] text-slate-950 font-black text-xs shadow-xs transition-all flex items-center gap-2 border border-[#E6BC50]"
            >
              <Layers className="w-4 h-4" />
              <span>Term Report Cards</span>
            </Link>
            <button
              onClick={openCreateModal}
              className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4 text-[#FFD978]" />
              <span>+ Create Live Exam</span>
            </button>
          </div>
        }
      />

      {/* Analytics Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Examinations"
          value={counts.all}
          icon={Award}
          trend="Real Institute Tenant Data"
          color="slate"
        />
        <StatCard
          title="Live & Upcoming"
          value={counts.live + counts.upcoming}
          icon={CheckCircle2}
          trend={`${counts.live} Active • ${counts.upcoming} Scheduled`}
          color="emerald"
        />
        <StatCard
          title="Draft In Preparation"
          value={counts.draft}
          icon={FileQuestion}
          trend="Unpublished"
          color="amber"
        />
        <StatCard
          title="Total Submissions"
          value={exams.reduce((acc, curr) => acc + (curr._count?.attempts || 0), 0)}
          icon={Users}
          trend="Student Attempts Logged"
          color="blue"
        />
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>
          {[
            { key: 'all', label: 'All Exams', count: counts.all },
            { key: 'DRAFT', label: 'Draft', count: counts.draft },
            { key: 'UPCOMING', label: 'Upcoming', count: counts.upcoming },
            { key: 'LIVE', label: 'Live Now', count: counts.live },
            { key: 'COMPLETED', label: 'Completed', count: counts.completed },
            { key: 'ARCHIVED', label: 'Archived', count: counts.archived },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === tab.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                statusFilter === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Class Dropdown */}
        <div className="flex items-center gap-2.5 flex-1 max-w-md justify-end">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, subject, class..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
            />
          </div>

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
          >
            <option value="all">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.section ? `(${c.section})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Exams Grid */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
        </div>
      ) : filteredExams.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="No Live Examinations Found"
          description="Create and schedule your first MCQ or Written Live assessment to deliver timed exams to enrolled students."
          action={
            <button
              onClick={openCreateModal}
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-xs"
            >
              + Create Live Exam
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredExams.map((exam) => {
            const dynStatus = exam.dynamicStatus || exam.status;
            const isLive = dynStatus === 'LIVE';
            const isUpcoming = dynStatus === 'UPCOMING';
            const isDraft = exam.status === 'DRAFT';
            const isCompleted = dynStatus === 'COMPLETED' || exam.status === 'CLOSED';

            return (
              <div
                key={exam.id}
                className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Header Badge Row */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg tracking-wider flex items-center gap-1.5 ${
                        isLive
                          ? 'bg-emerald-100 text-emerald-800'
                          : isUpcoming
                          ? 'bg-sky-100 text-sky-800'
                          : isDraft
                          ? 'bg-amber-100 text-amber-800'
                          : isCompleted
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {isLive && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />}
                        {dynStatus}
                      </span>

                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                        exam.examType === 'WRITTEN'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {exam.examType || 'MCQ'}
                      </span>
                    </div>

                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-600 font-mono">
                      {exam.durationMinutes} Mins
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1 line-clamp-1">
                    {exam.title}
                  </h3>
                  <p className="text-xs text-slate-500 mb-4 line-clamp-2 font-medium">
                    {exam.description || (exam.examType === 'WRITTEN' ? 'Written paper assessment with answer upload.' : 'Standard timed multiple-choice assessment.')}
                  </p>

                  {/* Meta Details Box */}
                  <div className="bg-slate-50 rounded-2xl p-3.5 space-y-2 text-xs text-slate-600 border border-slate-100 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold text-[11px]">Class & Subject</span>
                      <span className="font-bold text-slate-800 truncate max-w-[170px]">
                        {exam.class?.name} • {exam.subject?.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold text-[11px]">Marks / Pass Rule</span>
                      <span className="font-bold text-slate-800">
                        {exam.totalMarks} Total / Pass: {exam.passingMarks} ({exam.passMarkType})
                      </span>
                    </div>
                    {exam.startDateTime && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-semibold">Scheduled Window</span>
                        <span className="font-medium text-slate-700 font-mono">
                          {new Date(exam.startDateTime).toLocaleDateString([], { month: 'short', day: 'numeric' })} {new Date(exam.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-slate-400 font-semibold text-[11px]">
                        {exam.examType === 'WRITTEN' ? 'Submissions' : 'Questions / Attempts'}
                      </span>
                      <span className="font-bold text-slate-800">
                        {exam.examType === 'WRITTEN'
                          ? `${exam._count?.attempts || 0} Papers Uploaded`
                          : `${exam._count?.questions || 0} Qs • ${exam._count?.attempts || 0} Submissions`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {isDraft ? (
                    <button
                      onClick={() => setPublishConfirmExam(exam)}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Publish Live</span>
                    </button>
                  ) : exam.examType === 'WRITTEN' ? (
                    <button
                      onClick={() => navigate(`/admin/exams/${exam.id}/marking`)}
                      className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Marking Hub</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setQuestionBuilderExam(exam)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <FileQuestion className="w-3.5 h-3.5 text-[#FFD978]" />
                      <span>Questions ({exam._count?.questions || 0})</span>
                    </button>
                  )}

                  <button
                    onClick={() => setMonitorExam(exam)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                    title="View Submissions & Attempts"
                  >
                    <Users className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setAnalyticsExam(exam)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                    title="Performance Analytics"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => openEditModal(exam)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                    title="Edit Exam Configuration"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteExam(exam.id)}
                    className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                    title="Delete or Archive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* -------------------------------------------------------------
          Modal: Create / Edit Live Exam
      ------------------------------------------------------------- */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFD978] text-slate-900 flex items-center justify-center font-bold shadow-xs">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">
                    {examToEdit ? `Configure Live Exam: ${examToEdit.title}` : 'Create New Live Examination'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Real MySQL tenant-scoped academic examination
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {examFormError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{examFormError}</span>
                </div>
              )}

              {/* SECTION 1: ACADEMIC CONTEXT */}
              <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <GraduationCap className="w-4 h-4 text-slate-900" />
                  <span>Section 1 — Academic Context & Batch Routing</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Academic Year *
                    </label>
                    <select
                      required
                      value={formData.academicYearId}
                      onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    >
                      <option value="">Select Academic Year</option>
                      {academicYears.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name} {y.isCurrent ? '(Current Year)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {academicLevels.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Academic Level / Grade (Optional Filter)
                      </label>
                      <select
                        value={formData.academicLevelId}
                        onChange={(e) => setFormData({ ...formData, academicLevelId: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                      >
                        <option value="">All Levels</option>
                        {academicLevels.map((lvl) => (
                          <option key={lvl.id} value={lvl.id}>
                            {lvl.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Target Class / Batch *
                    </label>
                    <select
                      required
                      value={formData.classId}
                      onChange={(e) => handleClassChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    >
                      <option value="">Select Class / Batch</option>
                      {filteredFormClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.section ? `(${c.section})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Academic Subject *</span>
                      {classSubjectsLoading && <span className="text-[10px] text-slate-400 font-normal">Loading mapped subjects...</span>}
                    </label>
                    <select
                      required
                      value={formData.subjectId}
                      onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    >
                      <option value="">Select Subject</option>
                      {availableClassSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code || 'SUB'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Assigned Teacher / Examiner (Optional)
                    </label>
                    <select
                      value={formData.teacherId}
                      onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    >
                      <option value="">Institute Admin / Default</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.employeeId ? `(${t.employeeId})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: EXAM DETAILS & FORMAT */}
              <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <BookOpen className="w-4 h-4 text-slate-900" />
                  <span>Section 2 — Exam Details & Format</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Examination Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Grade 10 Mathematics Mid-Term Live Assessment"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    />
                  </div>

                  {/* Exam Type Selector */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Examination Format / Mode *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, examType: 'MCQ' })}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                          formData.examType === 'MCQ'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Radio className={`w-4 h-4 mt-0.5 shrink-0 ${formData.examType === 'MCQ' ? 'text-[#FFD978]' : 'text-slate-400'}`} />
                        <div>
                          <p className="text-xs font-bold">MCQ / Objective Live Exam</p>
                          <p className={`text-[11px] mt-0.5 ${formData.examType === 'MCQ' ? 'text-slate-300' : 'text-slate-500'}`}>
                            Automated timed evaluation with multiple-choice questions.
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, examType: 'WRITTEN' })}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                          formData.examType === 'WRITTEN'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <FileText className={`w-4 h-4 mt-0.5 shrink-0 ${formData.examType === 'WRITTEN' ? 'text-white' : 'text-indigo-500'}`} />
                        <div>
                          <p className="text-xs font-bold">Written Live Exam</p>
                          <p className={`text-[11px] mt-0.5 ${formData.examType === 'WRITTEN' ? 'text-indigo-100' : 'text-slate-500'}`}>
                            Students download question paper & upload PDF answer scripts to Marking Hub.
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Instructions for Students *
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Read each question carefully. Once time expires, answers will automatically submit."
                      value={formData.instructions}
                      onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: LIVE SCHEDULE & TIMING */}
              <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <Clock className="w-4 h-4 text-slate-900" />
                  <span>Section 3 — Live Schedule & Availability Window</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Start Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.startDateTime}
                      onChange={(e) => setFormData({ ...formData, startDateTime: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      End Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.endDateTime}
                      onChange={(e) => setFormData({ ...formData, endDateTime: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Duration (Minutes) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.durationMinutes}
                      onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Max Attempts
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={formData.maxAttempts}
                      onChange={(e) => setFormData({ ...formData, maxAttempts: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: MARK SETTINGS */}
              <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <Award className="w-4 h-4 text-slate-900" />
                  <span>Section 4 — Marks & Passing Threshold</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Total Marks *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.totalMarks}
                      onChange={(e) => setFormData({ ...formData, totalMarks: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pass Mark *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formData.passingMarks}
                      onChange={(e) => setFormData({ ...formData, passingMarks: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pass Calculation Mode
                    </label>
                    <select
                      value={formData.passMarkType}
                      onChange={(e) => setFormData({ ...formData, passMarkType: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    >
                      <option value="MARKS">Absolute Marks</option>
                      <option value="PERCENTAGE">Percentage (%)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 5: MCQ QUESTION BUILDER (ONLY WHEN MCQ) */}
              {formData.examType === 'MCQ' && (
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                      <FileQuestion className="w-4 h-4 text-slate-900" />
                      <span>Section 5 — MCQ Questions Bank</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                        Math.abs(calculatedQuestionTotal - parseFloat(formData.totalMarks || 0)) < 0.01
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}>
                        Questions Total: {calculatedQuestionTotal} / {formData.totalMarks} Marks
                      </span>
                    </div>
                  </div>

                  {/* Questions List */}
                  <div className="space-y-4">
                    {(formData.questions || []).map((q, qIdx) => (
                      <div key={qIdx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-slate-900 text-[#FFD978] flex items-center justify-center font-bold text-xs">
                              {qIdx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-800">Question #{qIdx + 1}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1 mr-2">
                              <span className="text-[11px] font-semibold text-slate-500">Marks:</span>
                              <input
                                type="number"
                                min="0.5"
                                step="0.5"
                                value={q.marks}
                                onChange={(e) => handleUpdateQuestion(qIdx, 'marks', e.target.value)}
                                className="w-14 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleMoveQuestion(qIdx, -1)}
                              disabled={qIdx === 0}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-900 disabled:opacity-30"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveQuestion(qIdx, 1)}
                              disabled={qIdx === (formData.questions.length - 1)}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-900 disabled:opacity-30"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(qIdx)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600"
                              title="Delete Question"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <textarea
                            rows={2}
                            placeholder="Enter question statement here..."
                            value={q.question}
                            onChange={(e) => handleUpdateQuestion(qIdx, 'question', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                          />
                        </div>

                        {/* Options A, B, C, D */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {['A', 'B', 'C', 'D'].map((optKey) => {
                            const optObj = (q.options || []).find((o) => o.id === optKey) || { id: optKey, text: '' };
                            const isCorrect = q.correctAnswer === optKey;

                            return (
                              <div
                                key={optKey}
                                className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 ${
                                  isCorrect
                                    ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400'
                                    : 'bg-slate-50/50 border-slate-200'
                                }`}
                              >
                                <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                                  <input
                                    type="radio"
                                    name={`correct_${qIdx}`}
                                    checked={isCorrect}
                                    onChange={() => handleUpdateQuestion(qIdx, 'correctAnswer', optKey)}
                                    className="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span className={`text-[11px] font-mono font-bold ${isCorrect ? 'text-emerald-800' : 'text-slate-600'}`}>
                                    {optKey}:
                                  </span>
                                </label>
                                <input
                                  type="text"
                                  placeholder={`Option ${optKey} text...`}
                                  value={optObj.text || ''}
                                  onChange={(e) => handleUpdateOption(qIdx, optKey, e.target.value)}
                                  className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 hover:border-slate-400 text-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-2 bg-white"
                    >
                      <Plus className="w-4 h-4 text-slate-900" />
                      <span>+ Add MCQ Question</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SECTION 6: ASSESSMENT TOGGLES */}
              <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Randomize Questions Sequence for Students</span>
                  <input
                    type="checkbox"
                    checked={formData.randomizeQuestions}
                    onChange={(e) => setFormData({ ...formData, randomizeQuestions: e.target.checked })}
                    className="w-4 h-4 rounded text-slate-900 focus:ring-[#FFD978]"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Randomize Option Choices (A, B, C, D)</span>
                  <input
                    type="checkbox"
                    checked={formData.randomizeOptions}
                    onChange={(e) => setFormData({ ...formData, randomizeOptions: e.target.checked })}
                    className="w-4 h-4 rounded text-slate-900 focus:ring-[#FFD978]"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Display Result & Scorecard to Student Upon Submission</span>
                  <input
                    type="checkbox"
                    checked={formData.publishResult}
                    onChange={(e) => setFormData({ ...formData, publishResult: e.target.checked })}
                    className="w-4 h-4 rounded text-slate-900 focus:ring-[#FFD978]"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white text-xs font-semibold transition-colors"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={savingExam}
                  onClick={() => handleSaveExam('DRAFT')}
                  className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  <span>Save as Draft</span>
                </button>

                <button
                  type="button"
                  disabled={savingExam}
                  onClick={() => handleSaveExam('PUBLISHED')}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {savingExam ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Publish Live Exam</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          Modal: Publish Confirmation Dialog
      ------------------------------------------------------------- */}
      {publishConfirmExam && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Send className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Publish Live Examination?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                <strong>{publishConfirmExam.title}</strong> will be published. Eligible students enrolled in <strong>{publishConfirmExam.class?.name}</strong> will see this examination according to its scheduled start and end time.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPublishConfirmExam(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={publishingAction}
                onClick={() => handleDirectPublish(publishConfirmExam.id)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {publishingAction ? 'Publishing...' : 'Confirm & Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          Modal: Question Builder (Standalone)
      ------------------------------------------------------------- */}
      {questionBuilderExam && (
        <QuestionBuilderModal
          exam={questionBuilderExam}
          onClose={() => {
            setQuestionBuilderExam(null);
            fetchExams();
          }}
        />
      )}

      {/* -------------------------------------------------------------
          Modal: Submissions & Attempt Monitor
      ------------------------------------------------------------- */}
      {monitorExam && (
        <AttemptMonitorModal
          exam={monitorExam}
          onClose={() => setMonitorExam(null)}
        />
      )}

      {/* -------------------------------------------------------------
          Modal: Real-time Analytics
      ------------------------------------------------------------- */}
      {analyticsExam && (
        <ExamAnalyticsModal
          exam={analyticsExam}
          onClose={() => setAnalyticsExam(null)}
        />
      )}
    </div>
  );
}

/**
 * Question Builder Component Modal
 */
function QuestionBuilderModal({ exam, onClose }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);

  // Add / Edit Question Form
  const [isAdding, setIsAdding] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [qForm, setQForm] = useState({
    question: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: 'A',
    marks: 1,
    explanation: '',
  });

  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest(`/exams/${exam.id}`);
      if (res.success && res.data) {
        setQuestions(res.data.questions || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load questions.');
    } finally {
      setLoading(false);
    }
  }, [exam.id]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const openNewQuestion = () => {
    setEditingQuestionId(null);
    setQForm({
      question: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctAnswer: 'A',
      marks: 1,
      explanation: '',
    });
    setIsAdding(true);
  };

  const openEditQuestion = (q) => {
    const opts = Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]');
    setEditingQuestionId(q.id);
    setQForm({
      question: q.question,
      optionA: opts[0]?.text || opts[0] || '',
      optionB: opts[1]?.text || opts[1] || '',
      optionC: opts[2]?.text || opts[2] || '',
      optionD: opts[3]?.text || opts[3] || '',
      correctAnswer: q.correctAnswer || 'A',
      marks: q.marks || 1,
      explanation: q.explanation || '',
    });
    setIsAdding(true);
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!qForm.question.trim() || !qForm.optionA.trim() || !qForm.optionB.trim()) {
      alert('Question text and at least Options A and B are required.');
      return;
    }

    const options = [
      { id: 'A', text: qForm.optionA.trim() },
      { id: 'B', text: qForm.optionB.trim() },
      ...(qForm.optionC.trim() ? [{ id: 'C', text: qForm.optionC.trim() }] : []),
      ...(qForm.optionD.trim() ? [{ id: 'D', text: qForm.optionD.trim() }] : []),
    ];

    const payload = {
      question: qForm.question.trim(),
      options,
      correctAnswer: qForm.correctAnswer,
      marks: parseFloat(qForm.marks) || 1,
      explanation: qForm.explanation?.trim() || null,
    };

    try {
      if (editingQuestionId) {
        await apiRequest(`/exams/${exam.id}/questions/${editingQuestionId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest(`/exams/${exam.id}/questions`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setIsAdding(false);
      fetchQuestions();
    } catch (err) {
      alert(err.message || 'Failed to save question.');
    }
  };

  const handleDeleteQuestion = async (qId) => {
    if (!window.confirm('Delete this question from the bank?')) return;
    try {
      await apiRequest(`/exams/${exam.id}/questions/${qId}`, { method: 'DELETE' });
      fetchQuestions();
    } catch (err) {
      alert(err.message || 'Failed to delete question.');
    }
  };

  // Publish / Close Actions
  const handlePublish = async () => {
    try {
      setPublishing(true);
      const res = await apiRequest(`/exams/${exam.id}/publish`, { method: 'PATCH' });
      if (res.success) {
        alert('Exam published successfully!');
        onClose();
      }
    } catch (err) {
      alert(err.message || 'Failed to publish exam.');
    } finally {
      setPublishing(false);
    }
  };

  const calculatedMarksTotal = questions.reduce((acc, q) => acc + (q.marks || 0), 0);
  const isMarksMatching = Math.abs(calculatedMarksTotal - exam.totalMarks) < 0.01;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <FileQuestion className="w-5 h-5 text-[#FFD978]" />
              <span>Question Bank: {exam.title}</span>
            </h3>
            <p className="text-xs text-slate-400">
              Configure and validate multiple choice questions
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Validation Bar */}
        <div className={`px-6 py-3 border-b flex items-center justify-between text-xs font-semibold ${
          isMarksMatching
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-amber-50 text-amber-900 border-amber-200'
        }`}>
          <div className="flex items-center gap-3">
            <span>Questions: <strong>{questions.length}</strong></span>
            <span>•</span>
            <span>Calculated Marks: <strong>{calculatedMarksTotal}</strong></span>
            <span>•</span>
            <span>Configured Total: <strong>{exam.totalMarks}</strong></span>
          </div>

          {!isMarksMatching && (
            <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Marks mismatch
            </span>
          )}
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Question Form */}
          {isAdding ? (
            <form onSubmit={handleSaveQuestion} className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {editingQuestionId ? 'Edit Question' : 'Add MCQ Question'}
              </h4>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Question Text *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Which of the following is a primary color?"
                  value={qForm.question}
                  onChange={(e) => setQForm({ ...qForm, question: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                />
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {['A', 'B', 'C', 'D'].map((key) => {
                  const fieldKey = `option${key}`;
                  const isCorrect = qForm.correctAnswer === key;

                  return (
                    <div key={key} className={`p-3 rounded-2xl border transition-all ${
                      isCorrect ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-400' : 'bg-white border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-700">Option {key}</span>
                        <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 cursor-pointer">
                          <input
                            type="radio"
                            name="correctAnswerRadio"
                            checked={isCorrect}
                            onChange={() => setQForm({ ...qForm, correctAnswer: key })}
                            className="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className={isCorrect ? 'text-emerald-700' : ''}>Correct</span>
                        </label>
                      </div>
                      <input
                        type="text"
                        placeholder={`Option ${key} text...`}
                        value={qForm[fieldKey]}
                        onChange={(e) => setQForm({ ...qForm, [fieldKey]: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Marks Awarded *
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    required
                    value={qForm.marks}
                    onChange={(e) => setQForm({ ...qForm, marks: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Explanation (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Solution rationale..."
                    value={qForm.explanation}
                    onChange={(e) => setQForm({ ...qForm, explanation: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800"
                >
                  Save Question
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={openNewQuestion}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 hover:border-slate-400 text-slate-600 hover:text-slate-900 font-bold text-xs transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 text-[#FFD978]" />
              <span>Add New Question to Bank</span>
            </button>
          )}

          {/* Questions List */}
          <div className="space-y-3">
            {questions.map((q, idx) => {
              const opts = Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]');
              return (
                <div key={q.id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-900 text-[#FFD978] flex items-center justify-center font-bold text-xs">
                        {idx + 1}
                      </span>
                      <h5 className="text-xs font-bold text-slate-900">{q.question}</h5>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                        {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                      </span>
                      <button
                        onClick={() => openEditQuestion(q)}
                        className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    {opts.map((o, optIdx) => {
                      const optId = typeof o === 'object' ? (o.id || o.key) : String.fromCharCode(65 + optIdx);
                      const optText = typeof o === 'object' ? o.text : o;
                      const isCorrect = String(q.correctAnswer).trim().toUpperCase() === String(optId).trim().toUpperCase();

                      return (
                        <div key={optIdx} className={`p-2 rounded-xl border flex items-center gap-2 ${
                          isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : 'bg-slate-50 border-slate-100 text-slate-600'
                        }`}>
                          <span className="w-4 h-4 rounded-full bg-white flex items-center justify-center text-[10px] shadow-2xs font-mono">
                            {optId}
                          </span>
                          <span className="truncate">{optText}</span>
                          {isCorrect && <Check className="w-3 h-3 text-emerald-600 ml-auto shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-white text-xs font-semibold"
          >
            Close
          </button>

          <button
            onClick={handlePublish}
            disabled={publishing || !isMarksMatching || questions.length === 0}
            className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-40 flex items-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publish Exam Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Submissions & Attempts Monitor Modal
 */
function AttemptMonitorModal({ exam, onClose }) {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        setLoading(true);
        const res = await apiRequest(`/exams/${exam.id}/attempts`);
        if (res.success) setAttempts(res.data || []);
      } catch (err) {
        console.error('Failed to load attempts:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAttempts();
  }, [exam.id]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-[#FFD978]" />
              <span>Student Submissions: {exam.title}</span>
            </h3>
            <p className="text-xs text-slate-400">
              Live audit of student attempts, marks & completion statuses
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
            </div>
          ) : attempts.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No students have attempted this examination yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Started</th>
                    <th className="py-3 px-4">Submitted</th>
                    <th className="py-3 px-4 text-right">Score</th>
                    <th className="py-3 px-4 text-center">Result</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attempts.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{att.student?.name}</p>
                        <p className="text-[10px] text-slate-400">{att.student?.admissionNumber || att.student?.rollNo}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {new Date(att.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {att.submittedAt ? new Date(att.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {att.score !== null ? `${att.score} / ${exam.totalMarks}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {att.isPassed !== null ? (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            att.isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {att.isPassed ? 'PASS' : 'FAIL'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                          att.status === 'SUBMITTED' ? 'bg-emerald-50 text-emerald-700' : (att.status === 'AUTO_SUBMITTED' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600')
                        }`}>
                          {att.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Performance Analytics Modal
 */
function ExamAnalyticsModal({ exam, onClose }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const res = await apiRequest(`/exams/${exam.id}/analytics`);
        if (res.success) setAnalytics(res.data);
      } catch (err) {
        console.error('Failed to load exam analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [exam.id]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#FFD978]" />
              <span>Assessment Analytics: {exam.title}</span>
            </h3>
            <p className="text-xs text-slate-400">
              Aggregated real-time metrics and score distribution
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
            </div>
          ) : analytics ? (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Eligible</span>
                  <p className="text-xl font-black text-slate-900 mt-1">{analytics.totalEligible}</p>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 text-center">
                  <span className="text-[10px] font-bold uppercase text-emerald-700">Attempted</span>
                  <p className="text-xl font-black text-emerald-800 mt-1">{analytics.totalAttempted}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Average Score</span>
                  <p className="text-xl font-black text-slate-900 mt-1">{analytics.averageScore}</p>
                </div>
                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 text-center">
                  <span className="text-[10px] font-bold uppercase text-blue-700">Pass Rate</span>
                  <p className="text-xl font-black text-blue-800 mt-1">{analytics.passRate}%</p>
                </div>
              </div>

              {/* Pass / Fail Breakdown */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Performance Breakdown
                </h4>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Passed Candidates</span>
                  <span className="font-black text-emerald-600">{analytics.passCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Failed Candidates</span>
                  <span className="font-black text-rose-600">{analytics.failCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Highest Score Achieved</span>
                  <span className="font-black text-slate-900">{analytics.highestScore} / {exam.totalMarks}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Lowest Score Recorded</span>
                  <span className="font-black text-slate-900">{analytics.lowestScore} / {exam.totalMarks}</span>
                </div>
              </div>

              {/* Distribution Bins */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Score Distribution
                </h4>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {(analytics.distribution || []).map((bin, idx) => (
                    <div key={idx} className="p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500">{bin.range}</span>
                      <p className="text-lg font-black text-slate-900 mt-1">{bin.count}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              No analytics data available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
