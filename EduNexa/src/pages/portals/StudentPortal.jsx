import React, { useState, useEffect } from 'react';
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
import {
  AnalyticsCard,
  ResponsiveBarChart,
  ResponsiveDonutChart,
} from '../../components/charts';
import InstituteGalleryViewer from '../../components/gallery/InstituteGalleryViewer';
import MessagingWorkspace from '../../components/messaging/MessagingWorkspace';
import PlatformAboutViewer from '../../components/cms/PlatformAboutViewer';
import StudentStudyMaterialsTab from '../../components/student/StudentStudyMaterialsTab';
import RecipientPollsTab from '../../components/common/RecipientPollsTab';
import {
  GraduationCap,
  BookOpen,
  Calendar,
  LogOut,
  Video,
  Clock,
  MapPin,
  ExternalLink,
  School,
  Sparkles,
  RefreshCw,
  CalendarRange,
  PieChart as PieIcon,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Award,
  Send,
  Play,
  Check,
  FileText,
  Download,
  RotateCcw,
  ChevronRight,
  Lock,
  Image as GalleryIcon,
  MessageSquare,
  Info,
  Vote,
} from 'lucide-react';

const DAYS_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export default function StudentPortal() {
  const { user, institute, logout } = useAuth();
  const { tab } = useParams();
  const navigate = useNavigate();
  const { hasFeature } = useSubscription();

  const hasExamsFeature = hasFeature('ONLINE_EXAMS');
  const hasAttendanceFeature = hasFeature('ATTENDANCE');
  const hasTimetableFeature = hasFeature('TIMETABLE');

  const [dashboardData, setDashboardData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState(tab || 'overview');
  const [selectedDay, setSelectedDay] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloadingTermPdf, setDownloadingTermPdf] = useState({});
  const [downloadingScorecardPdf, setDownloadingScorecardPdf] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState('');
  const [analyticsError, setAnalyticsError] = useState('');
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

  // Synchronize activeTab state with URL tab param
  useEffect(() => {
    if (tab) {
      setActiveTab(tab);
    } else {
      setActiveTab('overview');
    }
  }, [tab]);

  const handleTabChange = (key) => {
    setActiveTab(key);
    navigate(key === 'overview' ? '/student' : `/student/${key}`);
  };

  // Attendance State
  const [attendanceData, setAttendanceData] = useState(null);
  const [attLoading, setAttLoading] = useState(false);
  const [attError, setAttError] = useState('');

  // Online Exams State
  const [examsData, setExamsData] = useState({ upcoming: [], available: [], completed: [] });
  const [examsLoading, setExamsLoading] = useState(false);
  const [examsError, setExamsError] = useState('');
  const [selectedResult, setSelectedResult] = useState(null);

  const fetchStudentAttendance = async () => {
    setAttLoading(true);
    setAttError('');
    try {
      const res = await apiRequest('/attendance/student');
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

  const fetchStudentExams = async () => {
    setExamsLoading(true);
    setExamsError('');
    try {
      const res = await apiRequest('/exams/student/list');
      if (res.success && res.data) {
        setExamsData(res.data);
      } else {
        setExamsError(res.message);
      }
    } catch (err) {
      setExamsError(err.message || 'Failed to load exams.');
    } finally {
      setExamsLoading(false);
    }
  };

  // Term Reports State
  const [termReports, setTermReports] = useState([]);
  const [termReportsLoading, setTermReportsLoading] = useState(false);
  const [termReportsError, setTermReportsError] = useState('');

  const fetchTermReports = async () => {
    setTermReportsLoading(true);
    setTermReportsError('');
    try {
      const res = await apiRequest('/exam-groups/student/my-reports');
      if (res.success && res.data) {
        setTermReports(res.data);
      } else {
        setTermReportsError(res.message);
      }
    } catch (err) {
      setTermReportsError(err.message || 'Failed to load term reports.');
    } finally {
      setTermReportsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'attendance' && hasAttendanceFeature) {
      fetchStudentAttendance();
    } else if (activeTab === 'exams' && hasExamsFeature) {
      fetchStudentExams();
    } else if (activeTab === 'term_reports' && hasExamsFeature) {
      fetchTermReports();
    }
  }, [activeTab, hasExamsFeature, hasAttendanceFeature]);

  const fetchStudentData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/portal/student/dashboard');
      if (res.success) {
        setDashboardData(res.data);
        setSelectedDay(res.data.todayDayOfWeek || 'MONDAY');
      }
    } catch (err) {
      setError(err.message || 'Failed to load student workspace.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError('');
      const res = await apiRequest('/portal/student/analytics');
      if (res.success) {
        setAnalytics(res.data);
      }
    } catch (err) {
      setAnalyticsError(err.message || 'Unable to load schedule overview.');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
    fetchStudentAnalytics();
    if (hasExamsFeature) {
      fetchStudentExams();
    }
  }, [hasExamsFeature]);

  const student = dashboardData?.student;
  const currentClass = dashboardData?.currentClass;
  const activeEnrollment = dashboardData?.activeEnrollment;
  const subjects = dashboardData?.subjects || [];
  const todaySessions = dashboardData?.todaySessions || [];
  const weeklyTimetable = dashboardData?.weeklyTimetable || [];
  const stats = dashboardData?.stats || {};

  // Group timetable sessions by day of week
  const sessionsByDay = weeklyTimetable.reduce((acc, sess) => {
    const day = sess.dayOfWeek;
    if (!acc[day]) acc[day] = [];
    acc[day].push(sess);
    return acc;
  }, {});

  const currentDaySessions = sessionsByDay[selectedDay] || [];

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
            <p className="text-xs font-bold text-slate-900">{student?.name || user?.name || user?.email}</p>
            <p className="text-[10px] text-blue-700 font-semibold">
              {currentClass ? `${currentClass.name} ${currentClass.section ? `(${currentClass.section})` : ''}` : 'Enrolled Student'}
            </p>
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FFD978]/40 text-slate-900 border border-[#FFD978]/60">
                Student Workspace
              </span>
              {currentClass && (
                <span className="font-bold text-xs px-2.5 py-0.5 rounded-full bg-slate-900 text-[#FFD978]">
                  {currentClass.name} {currentClass.section ? `• Section ${currentClass.section}` : ''}
                </span>
              )}
              {student?.admissionNumber && (
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  Adm: {student.admissionNumber}
                </span>
              )}
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mt-2">
              Welcome, {student?.name || user?.name || 'Student'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Enrolled at <strong className="text-slate-700">{institute?.name}</strong> ({institute?.code})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchStudentData}
              className="p-2.5 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors shadow-2xs"
              title="Refresh Workspace"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-50/80 text-xs text-amber-900 font-bold border border-amber-200 shadow-2xs">
              <Calendar className="w-4 h-4 text-amber-700" />
              <span>Today's Classes: {todaySessions.length}</span>
            </div>
          </div>
        </GlassCard>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 text-sm font-semibold">
          {[
            { key: 'overview', label: 'Today & Overview', icon: Clock },
            {
              key: 'exams',
              label: `Online Exams / Live Exams${(examsData.available?.length || 0) + (examsData.upcoming?.length || 0) > 0 ? ` (${(examsData.available?.length || 0) + (examsData.upcoming?.length || 0)})` : ''}`,
              icon: Award,
              feature: 'ONLINE_EXAMS',
            },
            { key: 'term_reports', label: 'Term Report Cards', icon: FileText, feature: 'ONLINE_EXAMS' },
            { key: 'attendance', label: 'My Attendance', icon: UserCheck, feature: 'ATTENDANCE' },
            {
              key: 'messages',
              label: unreadMessages > 0 ? `Messages (${unreadMessages})` : 'Messages',
              icon: MessageSquare,
              feature: 'INTERNAL_MESSAGES',
            },
            { key: 'gallery', label: 'Campus Gallery', icon: GalleryIcon, feature: 'GALLERY' },
            {
              key: 'study_materials',
              label: 'Study Notes & Tutes',
              icon: BookOpen,
              feature: 'STUDY_MATERIALS',
            },
            { key: 'polls', label: 'Polls & Voting', icon: Vote, feature: 'POLLS' },
            { key: 'subjects', label: `My Subjects (${stats.enrolledSubjectsCount || 0})`, icon: BookOpen },
            { key: 'timetable', label: `Class Timetable (${stats.weeklySessionsCount || 0})`, icon: Calendar, feature: 'TIMETABLE' },
            { key: 'profile', label: 'Student Profile', icon: GraduationCap },
            { key: 'about', label: 'About EduNexa', icon: Info },
          ]
            .filter((t) => !t.feature || hasFeature(t.feature))
            .map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => handleTabChange(t.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs md:text-sm ${
                    isActive
                      ? 'bg-[#FFD978] text-slate-900 shadow-xs border border-[#E6BC50]'
                      : 'bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900 border border-slate-200/80'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
        </div>

        {/* Tab Content Area */}
        {loading && !dashboardData ? (
          <div className="py-16 flex justify-center">
            <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* 1. OVERVIEW & TODAY'S CLASSES */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    title="Current Class"
                    value={currentClass ? currentClass.name : 'Unassigned'}
                    subtitle={currentClass?.section ? `Section ${currentClass.section}` : 'Standard'}
                    icon={School}
                  />
                  <StatCard
                    title="Enrolled Subjects"
                    value={stats.enrolledSubjectsCount || 0}
                    icon={BookOpen}
                  />
                  <StatCard
                    title="Today's Classes"
                    value={todaySessions.length}
                    icon={Clock}
                  />
                  <StatCard
                    title="Weekly Periods"
                    value={stats.weeklySessionsCount || 0}
                    icon={Calendar}
                  />
                </div>

                {/* Real Academic Timetable & Subject Overview Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
                  {/* Weekly Sessions by Day */}
                  <AnalyticsCard
                    title="Weekly Class Schedule Distribution"
                    subtitle="Number of scheduled periods across the week"
                    icon={CalendarRange}
                    loading={analyticsLoading}
                    error={analyticsError}
                    isEmpty={!analytics?.weeklySessions || analytics.weeklySessions.every((d) => d.sessions === 0)}
                    emptyMessage="No scheduled weekly periods."
                  >
                    <ResponsiveBarChart
                      data={analytics?.weeklySessions || []}
                      xKey="day"
                      yKey="sessions"
                      unit="periods"
                      barColor="#FFD978"
                    />
                  </AnalyticsCard>

                  {/* Subjects Distribution */}
                  <AnalyticsCard
                    title="Curriculum Subjects Load"
                    subtitle="Periods allocated per enrolled subject"
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

                {/* Live / Upcoming Exams Quick Section */}
                {hasExamsFeature && (
                  <GlassCard padding="p-6 md:p-8" className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-xs shrink-0">
                          <Award className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-900">
                            Live & Upcoming Examinations
                          </h3>
                          <p className="text-xs text-slate-400">Scheduled online assessments and active tests.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleTabChange('exams')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-2xs transition-colors"
                      >
                        <span>View Exams</span>
                        <ChevronRight className="w-3.5 h-3.5 text-[#FFD978]" />
                      </button>
                    </div>

                    {examsLoading && !examsData.available.length && !examsData.upcoming.length ? (
                      <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-400 font-semibold">
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-900" />
                        <span>Loading exam schedules...</span>
                      </div>
                    ) : examsData.available.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {examsData.available.slice(0, 2).map((exam) => (
                          <div
                            key={exam.id}
                            className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col justify-between space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 tracking-wider">
                                LIVE NOW
                              </span>
                              <span className="text-xs font-mono font-bold text-emerald-900">
                                {exam.durationMinutes} Mins
                              </span>
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-slate-900 line-clamp-1">{exam.title}</h4>
                              <p className="text-xs text-slate-600 font-medium mt-0.5">
                                {exam.subject?.name} {exam.subject?.code ? `(${exam.subject.code})` : ''} • Total Marks: {exam.totalMarks}
                              </p>
                              {exam.class && (
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  Class: {exam.class.name} {exam.class.section ? `• Sec ${exam.class.section}` : ''}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => navigate(`/student/exams/${exam.id}`)}
                              className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors"
                            >
                              {exam.hasActiveAttempt ? (
                                <>
                                  <RotateCcw className="w-3.5 h-3.5 text-[#FFD978]" />
                                  <span>Resume Exam</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3.5 h-3.5 text-[#FFD978]" />
                                  <span>Start Exam</span>
                                </>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : examsData.upcoming.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {examsData.upcoming.slice(0, 2).map((exam) => (
                          <div
                            key={exam.id}
                            className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                                SCHEDULED
                              </span>
                              <span className="text-xs font-mono text-slate-500">
                                {exam.durationMinutes} Mins
                              </span>
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{exam.title}</h4>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {exam.subject?.name} {exam.subject?.code ? `(${exam.subject.code})` : ''} • Starts: {exam.startDateTime ? new Date(exam.startDateTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                              </p>
                            </div>
                            <div className="text-[11px] font-semibold text-slate-500 bg-white p-2 rounded-xl border border-slate-200 text-center">
                              Starts {exam.startDateTime ? new Date(exam.startDateTime).toLocaleString() : 'Soon'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 text-center text-xs text-slate-500 font-medium">
                        No live or upcoming online exams scheduled right now.
                      </div>
                    )}
                  </GlassCard>
                )}

                {/* Today's Classes List */}
                <GlassCard padding="p-6 md:p-8" className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-slate-900 text-[#FFD978] flex items-center justify-center font-bold shadow-xs shrink-0">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900">
                          Today's Class Schedule ({dashboardData?.todayDayOfWeek || 'Today'})
                        </h3>
                        <p className="text-xs text-slate-400">Live lecture schedule for your enrolled class.</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                      {todaySessions.length} Periods Scheduled
                    </span>
                  </div>

                  {todaySessions.length === 0 ? (
                    <EmptyState
                      icon={Clock}
                      title="No Scheduled Classes Today"
                      description="Enjoy your day! Check back tomorrow for your next classes."
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
                            <p className="text-xs text-slate-500 mt-0.5 font-medium">
                              Instructor: {sess.teacher ? sess.teacher.name || `${sess.teacher.firstName || ''} ${sess.teacher.lastName || ''}`.trim() : 'Faculty Member'}
                            </p>
                          </div>

                          {(sess.classType === 'ONLINE' || sess.classType === 'HYBRID') && sess.meetingUrl && sess.meetingUrl.startsWith('https://') && (
                            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 font-mono">
                                {sess.meetingPassword ? `Passcode: ${sess.meetingPassword}` : 'Online Class Ready'}
                              </span>
                              <a
                                href={sess.meetingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs"
                              >
                                <Video className="w-3.5 h-3.5" />
                                <span>Join Online Class</span>
                                <ExternalLink className="w-3 h-3 opacity-70" />
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              </div>
            )}

            {/* 2. MY SUBJECTS TAB */}
            {activeTab === 'subjects' && (
              <GlassCard padding="p-6 md:p-8" className="space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="text-base font-black text-slate-900">Enrolled Curriculum Subjects</h3>
                  <p className="text-xs text-slate-400">All academic subjects assigned to your class.</p>
                </div>

                {subjects.length === 0 ? (
                  <EmptyState
                    icon={BookOpen}
                    title="No Subjects Enrolled"
                    description="No curriculum subjects have been mapped to your class yet."
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

            {/* 3. CLASS TIMETABLE TAB */}
            {activeTab === 'timetable' && (
              !hasTimetableFeature ? (
                <LockedFeaturePage featureCode="TIMETABLE" featureName="Timetable Management" />
              ) : (
                <GlassCard padding="p-6 md:p-8" className="space-y-6">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Class Timetable Matrix</h3>
                    <p className="text-xs text-slate-400">Weekly schedule of lectures and periods for {currentClass?.name || 'your class'}.</p>
                  </div>

                  {/* Day Selector */}
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
                      title={`No classes scheduled for ${selectedDay}`}
                      description="No lectures or sessions are scheduled for this day."
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

                          <div className="flex items-center gap-2">
                            <StatusBadge status={sess.classType} />
                            {(sess.classType === 'ONLINE' || sess.classType === 'HYBRID') && sess.meetingUrl && sess.meetingUrl.startsWith('https://') && (
                              <a
                                href={sess.meetingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold shadow-xs"
                              >
                                <Video className="w-3 h-3" />
                                <span>Join Online Class</span>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              )
            )}

            {/* 3. ATTENDANCE HISTORY TAB */}
            {activeTab === 'attendance' && (
              !hasAttendanceFeature ? (
                <LockedFeaturePage featureCode="ATTENDANCE" featureName="Attendance Management" />
              ) : (
                <div className="space-y-6">
                {/* Attendance Summary StatCards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    title="Overall Attendance"
                    value={`${attendanceData?.attendanceRate || 0}%`}
                    subtitle="Present + Late / Total"
                    icon={UserCheck}
                  />
                  <StatCard
                    title="Classes Held"
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
                    title="Absences"
                    value={attendanceData?.counts?.absent || 0}
                    subtitle={`${attendanceData?.counts?.excused || 0} excused leaves`}
                    icon={XCircle}
                  />
                </div>

                {/* Detailed Logs Card */}
                <GlassCard padding="p-6" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900">Attendance Log History</h3>
                      <p className="text-xs text-slate-400">Chronological history of recorded class sessions.</p>
                    </div>
                    <button
                      onClick={fetchStudentAttendance}
                      className="p-2 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                      title="Refresh Logs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${attLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {attLoading ? (
                    <div className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                      <p className="text-xs font-bold uppercase">Loading Attendance History...</p>
                    </div>
                  ) : !attendanceData || attendanceData.records?.length === 0 ? (
                    <EmptyState
                      icon={Calendar}
                      title="No Attendance Records"
                      description="No attendance sessions have been marked for you yet."
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
                            <th className="py-2.5 px-3">Remark</th>
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
            ))}

            {/* 4. ONLINE EXAMS TAB */}
            {activeTab === 'exams' && (
              !hasExamsFeature ? (
                <LockedFeaturePage featureCode="ONLINE_EXAMS" featureName="Online Examinations" />
              ) : (
                <div className="space-y-6">
                  {examsError && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>Unable to load online exams: {examsError}</span>
                      </div>
                      <button
                        onClick={fetchStudentExams}
                        className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shrink-0 self-start sm:self-auto"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {examsLoading ? (
                    <div className="py-16 flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin text-slate-900" />
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Loading online exams...
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Empty state across all categories */}
                      {(examsData.available?.length || 0) === 0 &&
                      (examsData.upcoming?.length || 0) === 0 &&
                      (examsData.completed?.length || 0) === 0 ? (
                        <GlassCard padding="p-8 md:p-12" className="text-center space-y-4">
                          <EmptyState
                            icon={Award}
                            title="No online exams are available right now."
                            description="Published exams for your enrolled class will appear here."
                          />
                        </GlassCard>
                      ) : (
                        <>
                          {/* 1. Available Now / Live Exams Section */}
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                                Live Exams ({examsData.available?.length || 0})
                              </h3>
                            </div>

                            {examsData.available?.length === 0 ? (
                              <div className="p-6 rounded-2xl bg-white border border-slate-200/80 text-center text-xs text-slate-400">
                                No active examinations are currently open for your enrolled batch.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {examsData.available.map((exam) => (
                                  <GlassCard key={exam.id} padding="p-5" className="flex flex-col justify-between space-y-4">
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 tracking-wider">
                                            LIVE NOW
                                          </span>
                                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                            {exam.examType || 'MCQ'}
                                          </span>
                                        </div>
                                        <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                                          {exam.durationMinutes} Minutes
                                        </span>
                                      </div>

                                      <div>
                                        <h4 className="text-base font-black text-slate-900 line-clamp-1">{exam.title}</h4>
                                        <p className="text-xs text-slate-600 font-semibold mt-0.5">
                                          {exam.subject?.name} {exam.subject?.code ? `(${exam.subject.code})` : ''}
                                        </p>
                                        {exam.class && (
                                          <p className="text-[11px] text-slate-500 mt-0.5">
                                            Class: <strong>{exam.class.name}</strong> {exam.class.section ? `• Sec ${exam.class.section}` : ''}
                                          </p>
                                        )}
                                      </div>

                                      {/* Exam Details Grid */}
                                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                                        <div>
                                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Total Marks</span>
                                          <span className="font-black text-slate-800">{exam.totalMarks} Marks</span>
                                        </div>
                                        <div>
                                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Passing Mark</span>
                                          <span className="font-bold text-slate-800">
                                            {exam.passingMarks} ({exam.passMarkType === 'PERCENTAGE' ? '%' : 'Marks'})
                                          </span>
                                        </div>
                                        {exam.startDateTime && (
                                          <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between text-slate-500">
                                            <span>Window:</span>
                                            <span className="font-mono text-slate-700">
                                              {new Date(exam.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                              {exam.endDateTime ? ` - ${new Date(exam.endDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                      <span className="text-[11px] text-slate-500 font-medium">
                                        Max Attempts: <strong>{exam.maxAttempts || 1}</strong>
                                      </span>
                                      <button
                                        onClick={() => navigate(`/student/exams/${exam.id}`)}
                                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors"
                                      >
                                        {exam.hasActiveAttempt ? (
                                          <>
                                            <RotateCcw className="w-3.5 h-3.5 text-[#FFD978]" />
                                            <span>Resume Exam</span>
                                          </>
                                        ) : (
                                          <>
                                            <Play className="w-3.5 h-3.5 text-[#FFD978]" />
                                            <span>Start Exam</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </GlassCard>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 2. Upcoming Exams Section */}
                          <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-3">
                              Upcoming Exams ({examsData.upcoming?.length || 0})
                            </h3>

                            {examsData.upcoming?.length === 0 ? (
                              <div className="p-6 rounded-2xl bg-white border border-slate-200/80 text-center text-xs text-slate-400">
                                No upcoming online assessments scheduled at this time.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {examsData.upcoming.map((exam) => (
                                  <div key={exam.id} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                                          SCHEDULED
                                        </span>
                                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                          {exam.examType || 'MCQ'}
                                        </span>
                                      </div>
                                      <span className="text-xs font-mono text-slate-500">
                                        {exam.durationMinutes} Mins
                                      </span>
                                    </div>

                                    <div>
                                      <h4 className="text-sm font-bold text-slate-900">{exam.title}</h4>
                                      <p className="text-xs text-slate-600 mt-0.5 font-medium">
                                        {exam.subject?.name} {exam.subject?.code ? `(${exam.subject.code})` : ''}
                                      </p>
                                      {exam.class && (
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                          Class: {exam.class.name} {exam.class.section ? `• Sec ${exam.class.section}` : ''}
                                        </p>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                                      <div>
                                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Total Marks</span>
                                        <span className="font-bold text-slate-800">{exam.totalMarks} Marks</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Passing Mark</span>
                                        <span className="font-bold text-slate-800">{exam.passingMarks}</span>
                                      </div>
                                    </div>

                                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                      <span className="text-slate-400 text-[11px]">Starts at:</span>
                                      <span className="font-semibold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60">
                                        {exam.startDateTime ? new Date(exam.startDateTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 3. Completed Assessments Section */}
                          <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-3">
                              Completed Assessments ({examsData.completed?.length || 0})
                            </h3>

                            {examsData.completed?.length === 0 ? (
                              <div className="p-6 rounded-2xl bg-white border border-slate-200/80 text-center text-xs text-slate-400">
                                No completed exam records yet.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {examsData.completed.map((exam) => (
                                  <div key={exam.id} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-3">
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                          COMPLETED
                                        </span>
                                        {exam.latestResult && (
                                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                            exam.latestResult.status === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                          }`}>
                                            {exam.latestResult.status} ({exam.latestResult.marks}/{exam.totalMarks})
                                          </span>
                                        )}
                                      </div>
                                      <h4 className="text-sm font-bold text-slate-900">{exam.title}</h4>
                                      <p className="text-xs text-slate-500 mt-0.5">
                                        {exam.subject?.name} {exam.subject?.code ? `(${exam.subject.code})` : ''}
                                      </p>
                                      {exam.class && (
                                        <p className="text-[11px] text-slate-400">
                                          Class: {exam.class.name} {exam.class.section ? `• Sec ${exam.class.section}` : ''}
                                        </p>
                                      )}
                                    </div>

                                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                      <span className="text-slate-400">Attempts: {exam.attemptsCount}</span>
                                      {exam.publishResult && exam.latestResult ? (
                                        <button
                                          onClick={() => setSelectedResult({ exam, result: exam.latestResult })}
                                          className="text-xs font-bold text-slate-900 hover:text-amber-700 underline"
                                        >
                                          View Scorecard
                                        </button>
                                      ) : (
                                        <span className="text-[11px] text-amber-700 font-medium">Results Pending</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )
            )}

            {/* TERM REPORT CARDS TAB */}
            {activeTab === 'term_reports' && (
              !hasExamsFeature ? (
                <LockedFeaturePage featureCode="ONLINE_EXAMS" featureName="Online Examinations" />
              ) : (
                <div className="space-y-6">
                  {termReportsLoading ? (
                    <div className="py-16 text-center text-slate-400">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-[#FFD978]" />
                      <p className="text-xs font-bold uppercase tracking-wider">Loading Official Term Report Cards...</p>
                    </div>
                  ) : termReports.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="No Released Report Cards Yet"
                      description="Your term report cards will appear here once finalized and officially released by the institute administration."
                    />
                  ) : (
                    <div className="space-y-6">
                      {termReports.map((report) => (
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
                              disabled={downloadingTermPdf[report.examGroupId]}
                              onClick={async () => {
                                if (downloadingTermPdf[report.examGroupId]) return;
                                setDownloadingTermPdf((prev) => ({ ...prev, [report.examGroupId]: true }));
                                try {
                                  await downloadAuthenticatedFile(
                                    `/exam-groups/${report.examGroupId}/pdf/${report.studentReport.studentId}`,
                                    `ReportCard_${report.examGroupName?.replace(/[^a-zA-Z0-9]/g, '_') || report.examGroupId}.pdf`
                                  );
                                } catch (err) {
                                  alert(err.message || 'Failed to download report card PDF.');
                                } finally {
                                  setDownloadingTermPdf((prev) => ({ ...prev, [report.examGroupId]: false }));
                                }
                              }}
                              className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-xs transition self-start md:self-auto disabled:opacity-50"
                            >
                              {downloadingTermPdf[report.examGroupId] ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                              <span>
                                {downloadingTermPdf[report.examGroupId] ? 'Downloading...' : 'Download Official PDF'}
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
              )
            )}

            {/* 5. STUDENT PROFILE TAB */}
            {activeTab === 'profile' && (
              <GlassCard padding="p-6 md:p-8" className="space-y-6">
                <div>
                  <h3 className="text-base font-black text-slate-900">Student Academic Record</h3>
                  <p className="text-xs text-slate-400">Enrollment and admission details on file at {institute?.name}.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase">Student Full Name</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{student?.name || 'N/A'}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase">Admission Number</p>
                    <p className="text-sm font-mono font-bold text-slate-900 mt-1">{student?.admissionNumber || 'N/A'}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase">Current Class & Section</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">
                      {currentClass ? `${currentClass.name} ${currentClass.section ? `(${currentClass.section})` : ''}` : 'Unassigned'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase">Roll Number</p>
                    <p className="text-sm font-mono font-bold text-slate-900 mt-1">{student?.rollNo || 'N/A'}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase">Enrollment Academic Year</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{activeEnrollment?.academicYear?.name || 'Active'}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase">Contact Email</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{student?.email || user?.email || 'N/A'}</p>
                  </div>
                </div>
              </GlassCard>
            )}

            {/* TAB: CAMPUS GALLERY */}
            {activeTab === 'gallery' && (
              hasFeature('GALLERY') ? (
                <InstituteGalleryViewer role="STUDENT" />
              ) : (
                <LockedFeaturePage featureCode="GALLERY" featureName="Campus Gallery" />
              )
            )}

            {/* TAB: STUDY NOTES & TUTES */}
            {(activeTab === 'study_materials' || activeTab === 'study-materials' || activeTab === 'notes') && (
              hasFeature('STUDY_MATERIALS') ? (
                <StudentStudyMaterialsTab student={student} institute={institute} />
              ) : (
                <LockedFeaturePage featureCode="STUDY_MATERIALS" featureName="Study Notes & Tutes" />
              )
            )}

            {/* TAB: POLLS & VOTING */}
            {activeTab === 'polls' && (
              hasFeature('POLLS') ? (
                <RecipientPollsTab portalName="Student" />
              ) : (
                <LockedFeaturePage featureCode="POLLS" featureName="Polls & Voting" />
              )
            )}

            {/* TAB: SECURE INTERNAL MESSAGING */}
            {activeTab === 'messages' && (
              hasFeature('INTERNAL_MESSAGES') ? (
                <MessagingWorkspace portalRole="STUDENT" />
              ) : (
                <LockedFeaturePage featureCode="INTERNAL_MESSAGES" featureName="Internal Messages" />
              )
            )}

            {/* TAB: ABOUT EDUNEXA (READ-ONLY PLATFORM CMS) */}
            {activeTab === 'about' && (
              <PlatformAboutViewer />
            )}
          </>
        )}

        {/* Student Result View Modal */}
        {selectedResult && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-200">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                selectedResult.result?.status === 'PASS' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'
              }`}>
                <Award className="w-7 h-7" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-1">
                {selectedResult.exam?.title}
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Official Examination Scorecard
              </p>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 mb-6">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Total Score</span>
                  <span className="text-base font-black text-slate-900">
                    {selectedResult.result?.marks} / {selectedResult.exam?.totalMarks}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Percentage</span>
                  <span className="text-sm font-black text-slate-800">
                    {selectedResult.result?.percentage}%
                  </span>
                </div>
                {selectedResult.result?.grade && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold">Grade Achieved</span>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                      Grade {selectedResult.result.grade}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Passing Standard</span>
                  <span className="font-bold text-slate-700">
                    {selectedResult.exam?.passingMarks} ({selectedResult.exam?.passMarkType})
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-semibold">Result</span>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                    selectedResult.result?.status === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {selectedResult.result?.status}
                  </span>
                </div>
                {selectedResult.result?.teacherFeedback && (
                  <div className="pt-2 border-t border-slate-200 text-left">
                    <span className="text-[11px] font-bold text-slate-700 block mb-1">Teacher Feedback:</span>
                    <p className="text-xs text-slate-600 italic bg-white p-2.5 rounded-xl border border-slate-200">
                      "{selectedResult.result.teacherFeedback}"
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {selectedResult.result?.id && (
                  <button
                    disabled={downloadingScorecardPdf}
                    onClick={async () => {
                      if (downloadingScorecardPdf) return;
                      setDownloadingScorecardPdf(true);
                      try {
                        await downloadAuthenticatedFile(
                          `/exams/student/results/${selectedResult.result.id}/pdf`,
                          `Result_${(selectedResult.exam?.title || selectedResult.result.id).toString().replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
                        );
                      } catch (err) {
                        alert(err.message || 'Failed to download result PDF.');
                      } finally {
                        setDownloadingScorecardPdf(false);
                      }
                    }}
                    className="w-full py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-50"
                  >
                    {downloadingScorecardPdf ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>
                      {downloadingScorecardPdf ? 'Generating PDF...' : 'Download Official Institute PDF'}
                    </span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedResult(null)}
                  className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                >
                  Close Scorecard
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
