import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { apiRequest, downloadAuthenticatedFile } from '../../services/api';
import EduNexaLogo from '../../components/common/EduNexaLogo';
import InstituteBrandingHeader from '../../components/common/InstituteBrandingHeader';
import GlassCard from '../../components/common/GlassCard';
import StatCard from '../../components/common/StatCard';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import LockedFeaturePage from '../../components/common/LockedFeaturePage';
import InstituteGalleryViewer from '../../components/gallery/InstituteGalleryViewer';
import MessagingWorkspace from '../../components/messaging/MessagingWorkspace';
import PlatformAboutViewer from '../../components/cms/PlatformAboutViewer';
import RecipientPollsTab from '../../components/common/RecipientPollsTab';
import {
  AnalyticsCard,
  ResponsiveBarChart,
  ResponsiveDonutChart,
} from '../../components/charts';
import {
  Users,
  GraduationCap,
  Calendar,
  LogOut,
  Clock,
  MapPin,
  School,
  BookOpen,
  Receipt,
  User,
  RefreshCw,
  CalendarRange,
  PieChart as PieIcon,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Award,
  FileText,
  Download,
  Eye,
  Image as GalleryIcon,
  MessageSquare,
  Info,
  Vote,
} from 'lucide-react';

const DAYS_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const TAB_MAPPING = {
  overview: 'overview',
  schedule: 'overview',
  dashboard: 'overview',
  exams: 'exams',
  results: 'exams',
  'online-exams': 'exams',
  'term-reports': 'term_reports',
  term_reports: 'term_reports',
  attendance: 'attendance',
  gallery: 'gallery',
  subjects: 'subjects',
  timetable: 'timetable',
  invoices: 'invoices',
  fees: 'invoices',
  profile: 'profile',
  messages: 'messages',
  polls: 'polls',
};

export default function ParentPortal() {
  const { user, institute, logout } = useAuth();
  const { hasFeature } = useSubscription();
  const { tab: urlTab } = useParams();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Fetch unread messages count periodically if feature enabled
  useEffect(() => {
    if (!hasFeature('INTERNAL_MESSAGES')) return;
    let isMounted = true;
    const fetchUnread = async () => {
      try {
        const res = await apiRequest('/messages/unread-count');
        if (res.success && isMounted) {
          setUnreadMessages(res.unreadCount || 0);
        }
      } catch {
        // non-blocking
      }
    };
    fetchUnread();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchUnread();
    }, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [hasFeature]);

  // Tab State & URL Routing Sync
  const initialTab = urlTab ? TAB_MAPPING[urlTab.toLowerCase()] || 'overview' : 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (urlTab && TAB_MAPPING[urlTab.toLowerCase()]) {
      setActiveTab(TAB_MAPPING[urlTab.toLowerCase()]);
    }
  }, [urlTab]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    navigate(`/parent/${newTab}`, { replace: true });
  };

  const [selectedDay, setSelectedDay] = useState('');
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState('');
  const [analyticsError, setAnalyticsError] = useState('');

  // Attendance State
  const [attendanceData, setAttendanceData] = useState(null);
  const [attLoading, setAttLoading] = useState(false);
  const [attError, setAttError] = useState('');

  // Online Examinations State
  const [childExamsData, setChildExamsData] = useState({ upcoming: [], available: [], completed: [] });
  const [childExamsLoading, setChildExamsLoading] = useState(false);
  const [childExamsError, setChildExamsError] = useState('');

  // Released Exam Results State
  const [childExamResults, setChildExamResults] = useState([]);
  const [examResultsLoading, setExamResultsLoading] = useState(false);
  const [examResultsError, setExamResultsError] = useState('');

  // Term Reports State
  const [childTermReports, setChildTermReports] = useState([]);
  const [childTermReportsLoading, setChildTermReportsLoading] = useState(false);
  const [childTermReportsError, setChildTermReportsError] = useState('');

  // Download Action Spinners
  const [downloadingChildResultPdf, setDownloadingChildResultPdf] = useState({});
  const [downloadingChildTermPdf, setDownloadingChildTermPdf] = useState({});

  const fetchParentData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/portal/parent/dashboard');
      if (res.success) {
        setDashboardData(res.data);
        setSelectedDay(res.data.todayDayOfWeek || 'MONDAY');
      }
    } catch (err) {
      setError(err.message || 'Failed to load parent workspace.');
    } finally {
      setLoading(false);
    }
  };

  const fetchParentAnalytics = async (studentId) => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError('');
      const query = studentId ? `?studentId=${studentId}` : '';
      const res = await apiRequest(`/portal/parent/analytics${query}`);
      if (res.success) {
        setAnalytics(res.data);
      }
    } catch (err) {
      setAnalyticsError(err.message || 'Unable to load child timetable analytics.');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    fetchParentData();
  }, []);

  const children = dashboardData?.children || [];
  const activeChild = children[selectedChildIndex] || children[0] || null;

  const fetchChildAttendance = async (childId) => {
    if (!childId) return;
    setAttLoading(true);
    setAttError('');
    try {
      const res = await apiRequest(`/attendance/parent?studentId=${childId}`);
      if (res.success) {
        setAttendanceData(res.data);
      } else {
        setAttError(res.message);
      }
    } catch (err) {
      setAttError(err.message || 'Failed to load attendance.');
    } finally {
      setAttLoading(false);
    }
  };

  const fetchChildExams = async (childId) => {
    if (!childId) return;
    setChildExamsLoading(true);
    setChildExamsError('');
    try {
      const res = await apiRequest(`/exams/parent/child-exams/${childId}`);
      if (res.success && res.data) {
        setChildExamsData(res.data);
      } else {
        setChildExamsError(res.message || 'Failed to load online examinations.');
      }
    } catch (err) {
      setChildExamsError(err.message || 'Failed to load online examinations.');
    } finally {
      setChildExamsLoading(false);
    }
  };

  const fetchChildExamResults = async () => {
    setExamResultsLoading(true);
    setExamResultsError('');
    try {
      const res = await apiRequest('/exams/parent/child-results');
      if (res.success && res.data) {
        setChildExamResults(res.data);
      } else {
        setExamResultsError(res.message);
      }
    } catch (err) {
      setExamResultsError(err.message || 'Failed to load exam results.');
    } finally {
      setExamResultsLoading(false);
    }
  };

  const fetchChildTermReports = async (childId) => {
    if (!childId) return;
    setChildTermReportsLoading(true);
    setChildTermReportsError('');
    try {
      const res = await apiRequest(`/exam-groups/parent/child-reports/${childId}`);
      if (res.success && res.data) {
        setChildTermReports(res.data);
      } else {
        setChildTermReportsError(res.message);
      }
    } catch (err) {
      setChildTermReportsError(err.message || 'Failed to load term reports.');
    } finally {
      setChildTermReportsLoading(false);
    }
  };

  useEffect(() => {
    if (activeChild?.id) {
      fetchParentAnalytics(activeChild.id);
      if (activeTab === 'attendance') {
        fetchChildAttendance(activeChild.id);
      } else if (activeTab === 'exams') {
        fetchChildExams(activeChild.id);
        fetchChildExamResults();
      } else if (activeTab === 'term_reports') {
        fetchChildTermReports(activeChild.id);
      }
    }
  }, [activeChild?.id, activeTab]);

  const parent = dashboardData?.parent;

  const currentClass = activeChild?.currentClass;
  const subjects = activeChild?.subjects || [];
  const todaySessions = activeChild?.todaySessions || [];
  const weeklyTimetable = activeChild?.weeklyTimetable || [];
  const invoices = activeChild?.invoices || [];

  // Group timetable sessions by day of week for active child
  const sessionsByDay = weeklyTimetable.reduce((acc, sess) => {
    const day = sess.dayOfWeek;
    if (!acc[day]) acc[day] = [];
    acc[day].push(sess);
    return acc;
  }, {});

  const currentDaySessions = sessionsByDay[selectedDay] || [];

  // Define Navigation Tabs with Feature Guard Enforcement
  const allTabs = useMemo(() => [
    { key: 'overview', label: "Child's Daily Schedule", icon: Clock, feature: 'TIMETABLE' },
    { key: 'exams', label: 'Online Exams & Results', icon: Award, feature: 'ONLINE_EXAMS' },
    { key: 'term_reports', label: 'Term Report Cards', icon: FileText, feature: 'ONLINE_EXAMS' },
    { key: 'attendance', label: 'Attendance Record', icon: UserCheck, feature: 'ATTENDANCE' },
    {
      key: 'messages',
      label: unreadMessages > 0 ? `Messages (${unreadMessages})` : 'Messages',
      icon: MessageSquare,
      feature: 'INTERNAL_MESSAGES',
    },
    { key: 'gallery', label: 'Campus Gallery', icon: GalleryIcon, feature: 'GALLERY' },
    { key: 'polls', label: 'Polls & Voting', icon: Vote, feature: 'POLLS' },
    { key: 'subjects', label: `Subjects (${subjects.length})`, icon: BookOpen, feature: null },
    { key: 'timetable', label: `Weekly Timetable (${weeklyTimetable.length})`, icon: Calendar, feature: 'TIMETABLE' },
    { key: 'invoices', label: `Fees & Invoices (${invoices.length})`, icon: Receipt, feature: 'INVOICES' },
    { key: 'profile', label: 'Parent Profile', icon: User, feature: null },
    { key: 'about', label: 'About EduNexa', icon: Info, feature: null },
  ], [subjects.length, weeklyTimetable.length, invoices.length, unreadMessages]);

  const visibleTabs = useMemo(() => {
    return allTabs.filter((tab) => !tab.feature || hasFeature(tab.feature));
  }, [allTabs, hasFeature]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-3">
          <InstituteBrandingHeader
            institute={institute}
            variant="portal"
            showPlatformBadge={true}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-900">{parent?.name || user?.name || user?.email}</p>
            <p className="text-[10px] text-purple-700 font-semibold">Guardian / Parent</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 flex-1 w-full">
        {/* Welcome Card */}
        <GlassCard padding="p-6 md:p-8" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FFD978]/40 text-slate-900 border border-[#FFD978]/60">
                Parent Dashboard
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                {children.length} {children.length === 1 ? 'Child Linked' : 'Children Linked'}
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mt-2">
              Welcome, {parent?.name || user?.name || 'Guardian'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Monitoring Student Progress at <strong className="text-slate-700">{institute?.name}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchParentData}
              className="p-2.5 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors shadow-2xs"
              title="Refresh Workspace"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-50/80 text-xs text-amber-900 font-bold border border-amber-200 shadow-2xs">
              <Calendar className="w-4 h-4 text-amber-700" />
              <span>Child's Classes: {todaySessions.length} Today</span>
            </div>
          </div>
        </GlassCard>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Child Switcher (If children linked) */}
        {children.length > 0 && (
          <GlassCard padding="p-4" className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Child:</span>
            <div className="flex flex-wrap items-center gap-2">
              {children.map((child, idx) => {
                const isSelected = selectedChildIndex === idx;
                return (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChildIndex(idx)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-[#FFD978] text-slate-900 shadow-xs border border-[#E6BC50]'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>{child.name}</span>
                    {child.currentClass && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-slate-900 text-[#FFD978]' : 'bg-slate-100 text-slate-600'}`}>
                        {child.currentClass.name}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </GlassCard>
        )}

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 text-sm font-semibold">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
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

        {/* Tab Content Area */}
        {loading && !dashboardData ? (
          <div className="py-16 flex justify-center">
            <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
          </div>
        ) : !activeChild ? (
          <EmptyState
            icon={Users}
            title="No Linked Students Found"
            description="Please contact your institute administration to link your student profile."
          />
        ) : (
          <>
            {/* 1. OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Child Snapshot Banner */}
                <div className="glass-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-[#FFD978]">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-[#FFD978] flex items-center justify-center font-black text-base shadow-xs shrink-0">
                      {activeChild.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">{activeChild.name}</h3>
                      <p className="text-xs text-slate-600 font-medium mt-0.5">
                        Class: <strong>{currentClass ? `${currentClass.name} ${currentClass.section ? `(${currentClass.section})` : ''}` : 'Unassigned'}</strong> • Adm No: <strong>{activeChild.admissionNumber || activeChild.rollNo || 'N/A'}</strong>
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 bg-white text-slate-800 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto">
                    Relationship: {activeChild.relationship}
                  </span>
                </div>

                {/* Child Real Analytics Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
                  {/* Child's Weekly Class Sessions */}
                  <AnalyticsCard
                    title={`${activeChild.name}'s Weekly Timetable`}
                    subtitle="Class periods scheduled across the week"
                    icon={CalendarRange}
                    loading={analyticsLoading}
                    error={analyticsError}
                    isEmpty={!analytics?.weeklySessions || analytics.weeklySessions.every((d) => d.sessions === 0)}
                    emptyMessage="No timetable sessions scheduled."
                  >
                    <ResponsiveBarChart
                      data={analytics?.weeklySessions || []}
                      xKey="day"
                      yKey="sessions"
                      unit="periods"
                      barColor="#FFD978"
                    />
                  </AnalyticsCard>

                  {/* Child's Subject Load */}
                  <AnalyticsCard
                    title="Curriculum Subjects Load"
                    subtitle="Weekly class periods allocated per subject"
                    icon={PieIcon}
                    loading={analyticsLoading}
                    error={analyticsError}
                    isEmpty={!analytics?.subjectsDistribution || analytics.subjectsDistribution.length === 0}
                    emptyMessage="No subject periods mapped."
                  >
                    <ResponsiveBarChart
                      data={analytics?.subjectsDistribution || []}
                      xKey="name"
                      yKey="periodsCount"
                      unit="periods"
                      barColor="#94a3b8"
                    />
                  </AnalyticsCard>
                </div>

                {/* Today's Schedule */}
                <GlassCard padding="p-6 md:p-8" className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-slate-900 text-[#FFD978] flex items-center justify-center font-bold shadow-xs shrink-0">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900">
                          Child's Daily Timetable ({dashboardData?.todayDayOfWeek || 'Today'})
                        </h3>
                        <p className="text-xs text-slate-400">Live view of lectures and class periods scheduled for today.</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                      {todaySessions.length} Sessions Today
                    </span>
                  </div>

                  {todaySessions.length === 0 ? (
                    <EmptyState
                      icon={Clock}
                      title="No Scheduled Classes Today"
                      description="Your child has no timetable sessions scheduled for today."
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {todaySessions.map((sess) => (
                        <div
                          key={sess.id}
                          className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 shadow-2xs space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-black px-2.5 py-1 rounded-xl bg-slate-900 text-[#FFD978]">
                                {sess.startTime} - {sess.endTime}
                              </span>
                              <StatusBadge status={sess.classType} />
                            </div>

                            {sess.room && (
                              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                {sess.room}
                              </span>
                            )}
                          </div>

                          <div>
                            <h4 className="text-base font-black text-slate-900">{sess.subject?.name}</h4>
                            <p className="text-xs text-slate-600 font-semibold mt-0.5">
                              Class: {sess.class?.name} {sess.class?.section ? `(${sess.class?.section})` : ''}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-slate-200 text-xs text-slate-500 font-medium">
                            Instructor: {sess.teacher ? sess.teacher.name || `${sess.teacher.firstName || ''} ${sess.teacher.lastName || ''}`.trim() : 'Class Instructor'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              </div>
            )}

            {/* 2. SUBJECTS TAB */}
            {activeTab === 'subjects' && (
              <GlassCard padding="p-6 md:p-8" className="space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="text-base font-black text-slate-900">Child's Enrolled Subjects</h3>
                  <p className="text-xs text-slate-400">Curriculum subjects mapped to {activeChild.name}'s class.</p>
                </div>

                {subjects.length === 0 ? (
                  <EmptyState
                    icon={BookOpen}
                    title="No Subjects Configured"
                    description="No subjects have been configured for this class yet."
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {subjects.map((sub) => (
                      <div key={sub.id} className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-900 text-base">{sub.name}</h4>
                          <span className="text-xs font-mono font-bold px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded">
                            {sub.code}
                          </span>
                        </div>
                        {sub.description && (
                          <p className="text-xs text-slate-500 leading-relaxed">{sub.description}</p>
                        )}
                        {sub.teacherAssignments && sub.teacherAssignments.length > 0 && (
                          <div className="pt-2 border-t border-slate-200 text-xs text-slate-600 font-medium">
                            Teacher: <strong>{sub.teacherAssignments[0]?.teacher?.name}</strong>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            )}

            {/* 3. WEEKLY TIMETABLE TAB */}
            {activeTab === 'timetable' && (
              <GlassCard padding="p-6 md:p-8" className="space-y-6">
                <div>
                  <h3 className="text-base font-black text-slate-900">Child's Weekly Timetable</h3>
                  <p className="text-xs text-slate-400">Full 7-day lecture schedule for {activeChild.name}.</p>
                </div>

                {/* Day selector */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
                  {DAYS_ORDER.map((day) => {
                    const count = (sessionsByDay[day] || []).length;
                    const isSelected = selectedDay === day;
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#FFD978] text-slate-900 border border-[#E6BC50] shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <span>{day.slice(0, 3)}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-slate-900 text-[#FFD978]' : 'bg-white text-slate-600'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Day's Sessions */}
                {currentDaySessions.length === 0 ? (
                  <EmptyState
                    icon={Calendar}
                    title={`No sessions scheduled for ${selectedDay}`}
                    description="No lectures or classes are scheduled for your child on this day."
                  />
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {currentDaySessions.map((sess) => (
                      <div key={sess.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-900 text-[#FFD978]">
                            {sess.startTime} - {sess.endTime}
                          </span>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{sess.subject?.name}</h4>
                            <p className="text-xs text-slate-500">
                              Teacher: {sess.teacher?.name || 'Class Instructor'} {sess.room ? `• Rm: ${sess.room}` : ''}
                            </p>
                          </div>
                        </div>

                        <StatusBadge status={sess.classType} />
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            )}

            {/* ATTENDANCE RECORD TAB */}
            {activeTab === 'attendance' && (
              <div className="space-y-6">
                {/* StatCards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    title="Child Attendance Rate"
                    value={`${attendanceData?.attendanceRate || 0}%`}
                    subtitle="Present + Late / Total"
                    icon={UserCheck}
                  />
                  <StatCard
                    title="Total Classes Held"
                    value={attendanceData?.totalClassesHeld || 0}
                    subtitle="Recorded class sessions"
                    icon={Calendar}
                  />
                  <StatCard
                    title="Present / Late"
                    value={(attendanceData?.counts?.present || 0) + (attendanceData?.counts?.late || 0)}
                    subtitle={`${attendanceData?.counts?.present || 0} on-time, ${attendanceData?.counts?.late || 0} late`}
                    icon={CheckCircle2}
                  />
                  <StatCard
                    title="Unexcused Absences"
                    value={attendanceData?.counts?.absent || 0}
                    subtitle={`${attendanceData?.counts?.excused || 0} excused leaves`}
                    icon={XCircle}
                  />
                </div>

                {/* Detailed Logs Card */}
                <GlassCard padding="p-6" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        Attendance Logs for {activeChild?.name}
                      </h3>
                      <p className="text-xs text-slate-400">Class attendance recorded by verified faculty instructors.</p>
                    </div>
                    <button
                      onClick={() => fetchChildAttendance(activeChild?.id)}
                      className="p-2 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                      title="Refresh Logs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${attLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {attLoading ? (
                    <div className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                      <p className="text-xs font-bold uppercase">Loading Child Attendance Records...</p>
                    </div>
                  ) : !attendanceData || attendanceData.records?.length === 0 ? (
                    <EmptyState
                      icon={Calendar}
                      title="No Attendance Records"
                      description={`No attendance sessions recorded yet for ${activeChild?.name}.`}
                    />
                  ) : (
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 text-slate-400 font-bold uppercase">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Subject</th>
                            <th className="py-2.5 px-3">Instructor</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3">Faculty Remark</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {attendanceData.records.map((rec) => (
                            <tr key={rec.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                {new Date(rec.date).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-700">{rec.subject}</td>
                              <td className="py-2.5 px-3 text-slate-500">{rec.teacher}</td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
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
                              <td className="py-2.5 px-3 text-slate-500">{rec.remark || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </GlassCard>
              </div>
            )}

            {/* 5. ONLINE EXAMS & RESULTS TAB */}
            {activeTab === 'exams' && (
              <div className="space-y-6">
                {/* Information Header & Read-Only Notice */}
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
                  <Eye className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Guardian Read-Only Examination Access</strong>
                    <span>
                      You can monitor scheduled upcoming examinations, active testing windows, and official graded results for {activeChild?.name}. Live examinations must be started and attempted from the student's personal portal account.
                    </span>
                  </div>
                </div>

                {/* Section A: Active & Upcoming Online Examinations */}
                <GlassCard padding="p-6 md:p-8" className="space-y-4">
                  <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900">Scheduled Online Examinations</h3>
                      <p className="text-xs text-slate-400">Class examinations configured for {activeChild?.name}'s enrolled curriculum.</p>
                    </div>
                    <button
                      onClick={() => fetchChildExams(activeChild?.id)}
                      className="p-2 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                      title="Refresh Examinations"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${childExamsLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {childExamsError && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold">
                      {childExamsError}
                    </div>
                  )}

                  {childExamsLoading ? (
                    <div className="py-12 flex justify-center">
                      <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Available Now */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                            Available Examination Windows ({childExamsData.available?.length || 0})
                          </h4>
                        </div>

                        {childExamsData.available?.length === 0 ? (
                          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-400 text-center">
                            No active examination windows currently open for {activeChild?.name}.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {childExamsData.available.map((ex) => (
                              <div key={ex.id} className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h5 className="font-bold text-slate-900 text-sm">{ex.title}</h5>
                                    <p className="text-xs text-slate-500">{ex.subject?.name} • {ex.class?.name}</p>
                                  </div>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                                    OPEN
                                  </span>
                                </div>
                                <div className="text-xs text-slate-600 flex items-center justify-between pt-2 border-t border-emerald-100">
                                  <span>Marks: <strong>{ex.totalMarks}</strong></span>
                                  <span>Duration: <strong>{ex.durationMinutes} mins</strong></span>
                                  <span>Questions: <strong>{ex.questionCount || '—'}</strong></span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Upcoming Scheduled */}
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3">
                          Upcoming Scheduled Exams ({childExamsData.upcoming?.length || 0})
                        </h4>

                        {childExamsData.upcoming?.length === 0 ? (
                          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-400 text-center">
                            No upcoming online examinations scheduled at this time.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {childExamsData.upcoming.map((ex) => (
                              <div key={ex.id} className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2 shadow-2xs">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h5 className="font-bold text-slate-900 text-sm">{ex.title}</h5>
                                    <p className="text-xs text-slate-500">{ex.subject?.name} • {ex.class?.name}</p>
                                  </div>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800">
                                    UPCOMING
                                  </span>
                                </div>
                                <div className="text-xs text-slate-600 flex items-center justify-between pt-2 border-t border-slate-100">
                                  <span>Date: <strong>{ex.startDateTime ? new Date(ex.startDateTime).toLocaleDateString() : 'TBD'}</strong></span>
                                  <span>Marks: <strong>{ex.totalMarks}</strong></span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </GlassCard>

                {/* Section B: Released Graded Results & Official Scorecards */}
                <GlassCard padding="p-6 md:p-8" className="space-y-4">
                  <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900">Released Exam Scorecards & Results</h3>
                      <p className="text-xs text-slate-400">Official published grade reports and verified test results for {activeChild?.name}.</p>
                    </div>
                    <button
                      onClick={fetchChildExamResults}
                      className="p-2 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                      title="Refresh Results"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${examResultsLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {examResultsError && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold">
                      {examResultsError}
                    </div>
                  )}

                  {examResultsLoading ? (
                    <div className="py-12 flex justify-center">
                      <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
                    </div>
                  ) : (() => {
                    const currentChildData = (childExamResults || []).find((c) => c.childId === activeChild?.id) || { results: [] };
                    const results = currentChildData.results || [];

                    if (results.length === 0) {
                      return (
                        <EmptyState
                          icon={Award}
                          title="No Released Exam Results"
                          description="There are no published online examination scorecards on record for this student."
                        />
                      );
                    }

                    return (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                        {results.map((res) => (
                          <div key={res.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-900 text-sm">{res.exam?.title}</p>
                                {res.grade && (
                                  <span className="px-2 py-0.5 rounded font-black text-xs bg-amber-100 text-amber-900 border border-amber-200">
                                    Grade {res.grade}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {res.exam?.subject?.name} • Score: <strong>{res.marks} / {res.exam?.totalMarks}</strong> ({res.percentage}%)
                              </p>
                              {res.teacherFeedback && (
                                <p className="text-xs text-slate-600 font-medium italic mt-1 bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                                  Feedback: "{res.teacherFeedback}"
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 self-end sm:self-auto">
                              <div className="text-right">
                                <span className={`text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                  res.status === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {res.status}
                                </span>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  {new Date(res.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              <button
                                disabled={downloadingChildResultPdf[`${res.exam?.id || res.examId}_${activeChild.id}`]}
                                onClick={async () => {
                                  const key = `${res.exam?.id || res.examId}_${activeChild.id}`;
                                  if (downloadingChildResultPdf[key]) return;
                                  setDownloadingChildResultPdf((prev) => ({ ...prev, [key]: true }));
                                  try {
                                    await downloadAuthenticatedFile(
                                      `/exams/${res.exam?.id || res.examId}/results/${activeChild.id}/pdf`,
                                      `Result_${(activeChild.name || activeChild.id).toString().replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
                                    );
                                  } catch (err) {
                                    alert(err.message || 'Failed to download result PDF.');
                                  } finally {
                                    setDownloadingChildResultPdf((prev) => ({ ...prev, [key]: false }));
                                  }
                                }}
                                title="Download Official Result PDF"
                                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-[#FFD978] shadow-xs transition disabled:opacity-50"
                              >
                                {downloadingChildResultPdf[`${res.exam?.id || res.examId}_${activeChild.id}`] ? (
                                  <RefreshCw className="w-4 h-4 animate-spin text-[#FFD978]" />
                                ) : (
                                  <Download className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </GlassCard>
              </div>
            )}

            {/* TERM REPORT CARDS TAB */}
            {activeTab === 'term_reports' && (
              <div className="space-y-6">
                {childTermReportsLoading ? (
                  <div className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-[#FFD978]" />
                    <p className="text-xs font-bold uppercase tracking-wider">Loading Child's Official Term Report Cards...</p>
                  </div>
                ) : childTermReports.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No Released Term Report Cards"
                    description={`No published term report cards found for ${activeChild?.name}. They will appear here once released by the institute.`}
                  />
                ) : (
                  <div className="space-y-6">
                    {childTermReports.map((report) => (
                      <GlassCard key={report.examGroupId} padding="p-6 md:p-8" className="space-y-6">
                        {/* Report Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                          <div>
                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-900 text-[#FFD978] tracking-wider">
                              Official Term Assessment
                            </span>
                            <h3 className="text-lg font-black text-slate-900 mt-1">{report.examGroupName}</h3>
                            <p className="text-xs text-slate-500">
                              Academic Year: {report.academicYear} • Class: {report.className}
                            </p>
                          </div>

                          <button
                            disabled={downloadingChildTermPdf[report.examGroupId]}
                            onClick={async () => {
                              if (downloadingChildTermPdf[report.examGroupId]) return;
                              setDownloadingChildTermPdf((prev) => ({ ...prev, [report.examGroupId]: true }));
                              try {
                                await downloadAuthenticatedFile(
                                  `/exam-groups/${report.examGroupId}/pdf/${report.studentReport.studentId}`,
                                  `ReportCard_${report.examGroupName?.replace(/[^a-zA-Z0-9]/g, '_') || report.examGroupId}.pdf`
                                );
                              } catch (err) {
                                alert(err.message || 'Failed to download child report card PDF.');
                              } finally {
                                setDownloadingChildTermPdf((prev) => ({ ...prev, [report.examGroupId]: false }));
                              }
                            }}
                            className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-xs transition self-start md:self-auto disabled:opacity-50"
                          >
                            {downloadingChildTermPdf[report.examGroupId] ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                            <span>
                              {downloadingChildTermPdf[report.examGroupId] ? 'Downloading...' : 'Download Official PDF'}
                            </span>
                          </button>
                        </div>

                        {/* Subject Marks Table */}
                        <div className="border border-slate-200 rounded-2xl overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-900 text-white">
                              <tr>
                                <th className="py-2.5 px-3 text-[#FFD978]">Subject</th>
                                <th className="py-2.5 px-3 text-right">Marks</th>
                                <th className="py-2.5 px-3 text-right">Total</th>
                                <th className="py-2.5 px-3 text-right">Percentage</th>
                                <th className="py-2.5 px-3 text-center">Grade</th>
                                <th className="py-2.5 px-3 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {report.studentReport.subjectResults.map((sub) => (
                                <tr key={sub.examId} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="py-2.5 px-3 font-bold text-slate-900">{sub.subjectName}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
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

                        {/* Overall Metrics Card */}
                        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                          <div>
                            <span className="text-[10px] font-bold text-amber-900 uppercase block">Total Marks</span>
                            <span className="text-sm font-black text-slate-900">
                              {report.studentReport.totalObtainedMarks} / {report.studentReport.totalPossibleMarks}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-amber-900 uppercase block">Overall Average</span>
                            <span className="text-sm font-black text-slate-900">{report.studentReport.overallAverage}%</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-amber-900 uppercase block">Overall Grade</span>
                            <span className="text-sm font-black text-amber-900">{report.studentReport.overallGrade}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-amber-900 uppercase block">Pass / Fail</span>
                            <span
                              className={`text-xs font-black px-2 py-0.5 rounded-full inline-block ${
                                report.studentReport.overallPassStatus === 'PASS'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {report.studentReport.overallPassStatus}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-amber-900 uppercase block">Class Rank</span>
                            <span className="text-sm font-black text-slate-900">
                              {report.studentReport.rankDisplay ? `#${report.studentReport.rankDisplay}` : '—'}
                            </span>
                          </div>
                        </div>

                        {/* Teacher & Principal Remarks if available */}
                        {(report.studentReport.teacherRemark || report.studentReport.principalRemark) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            {report.studentReport.teacherRemark && (
                              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="font-bold text-slate-700 block mb-0.5">Teacher Remark:</span>
                                <p className="text-slate-600 italic">"{report.studentReport.teacherRemark}"</p>
                              </div>
                            )}
                            {report.studentReport.principalRemark && (
                              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="font-bold text-slate-700 block mb-0.5">Principal Remark:</span>
                                <p className="text-slate-600 italic">"{report.studentReport.principalRemark}"</p>
                              </div>
                            )}
                          </div>
                        )}
                      </GlassCard>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. INVOICES TAB */}
            {activeTab === 'invoices' && (
              <GlassCard padding="p-6 md:p-8" className="space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="text-base font-black text-slate-900">Child's Fee Invoices</h3>
                  <p className="text-xs text-slate-400">Tuition and fee statements issued for {activeChild.name}.</p>
                </div>

                {invoices.length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title="No Fee Invoices"
                    description="There are no fee invoices on record for this student."
                  />
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {invoices.map((inv) => (
                      <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-slate-50/80">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{inv.title}</p>
                          <p className="text-xs font-mono text-slate-400 mt-0.5">Invoice #{inv.invoiceNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900 text-sm">${inv.totalAmount?.toFixed(2)}</p>
                          <StatusBadge status={inv.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            )}

            {/* 5. PARENT PROFILE TAB */}
            {activeTab === 'profile' && (
              <GlassCard padding="p-6 md:p-8" className="space-y-6">
                <div>
                  <h3 className="text-base font-black text-slate-900">Guardian Profile Information</h3>
                  <p className="text-xs text-slate-400">Registered guardian record on file at {institute?.name}.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase">Parent / Guardian Name</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{parent?.name || 'N/A'}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase">Occupation</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{parent?.occupation || 'N/A'}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase">Contact Phone</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{parent?.phone || 'N/A'}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase">Contact Email</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{parent?.email || user?.email || 'N/A'}</p>
                  </div>
                </div>
              </GlassCard>
            )}

            {/* 6. CAMPUS GALLERY TAB */}
            {activeTab === 'gallery' && (
              hasFeature('GALLERY') ? (
                <InstituteGalleryViewer role="PARENT" />
              ) : (
                <LockedFeaturePage featureCode="GALLERY" featureName="Campus Gallery" />
              )
            )}

            {/* 6b. POLLS & VOTING TAB */}
            {activeTab === 'polls' && (
              hasFeature('POLLS') ? (
                <RecipientPollsTab portalName="Parent" />
              ) : (
                <LockedFeaturePage featureCode="POLLS" featureName="Polls & Voting" />
              )
            )}

            {/* 7. SECURE INTERNAL MESSAGING */}
            {activeTab === 'messages' && (
              hasFeature('INTERNAL_MESSAGES') ? (
                <MessagingWorkspace portalRole="PARENT" />
              ) : (
                <LockedFeaturePage featureCode="INTERNAL_MESSAGES" featureName="Internal Messages" />
              )
            )}

            {/* 8. ABOUT EDUNEXA (READ-ONLY PLATFORM CMS) */}
            {activeTab === 'about' && (
              <PlatformAboutViewer />
            )}
          </>
        )}
      </main>
    </div>
  );
}
