import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { apiRequest } from '../../services/api';
import EduNexaLogo from '../../components/common/EduNexaLogo';
import InstituteBrandingHeader from '../../components/common/InstituteBrandingHeader';
import GlassCard from '../../components/common/GlassCard';
import StatCard from '../../components/common/StatCard';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import LockedFeaturePage from '../../components/common/LockedFeaturePage';
import ExamsPage from '../admin/exams/ExamsPage';
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
  BookOpen,
  Users,
  GraduationCap,
  LogOut,
  Calendar,
  Video,
  Clock,
  MapPin,
  ExternalLink,
  School,
  Sparkles,
  Award,
  RefreshCw,
  BarChart3,
  CalendarRange,
  PieChart as PieIcon,
  UserCheck,
  CheckCircle2,
  Save,
  AlertCircle,
  Image as GalleryIcon,
  MessageSquare,
  Info,
  Vote,
} from 'lucide-react';

const DAYS_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export default function TeacherPortal() {
  const { user, institute, logout } = useAuth();
  const { hasFeature } = useSubscription();
  const [dashboardData, setDashboardData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDay, setSelectedDay] = useState('');
  const [loading, setLoading] = useState(true);
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

  const fetchTeacherData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/portal/teacher/dashboard');
      if (res.success) {
        setDashboardData(res.data);
        setSelectedDay(res.data.todayDayOfWeek || 'MONDAY');
      }
    } catch (err) {
      setError(err.message || 'Failed to load teacher workspace.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError('');
      const res = await apiRequest('/portal/teacher/analytics');
      if (res.success) {
        setAnalytics(res.data);
      }
    } catch (err) {
      setAnalyticsError(err.message || 'Unable to load teaching analytics.');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacherData();
    fetchTeacherAnalytics();
  }, []);

  const teacher = dashboardData?.teacher;
  const assignedClasses = dashboardData?.assignedClasses || [];
  const assignedSubjects = dashboardData?.assignedSubjects || [];
  const todaySessions = dashboardData?.todaySessions || [];
  const weeklyTimetable = dashboardData?.weeklyTimetable || [];
  const stats = dashboardData?.stats || {};

  // Attendance Marking State in Teacher Portal
  const [attClassId, setAttClassId] = useState('');
  const [attSubjectId, setAttSubjectId] = useState('');
  const [attDate, setAttDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [attStudents, setAttStudents] = useState([]);
  const [attNotes, setAttNotes] = useState('');
  const [attLoading, setAttLoading] = useState(false);
  const [attSaving, setAttSaving] = useState(false);
  const [attSuccess, setAttSuccess] = useState('');
  const [attError, setAttError] = useState('');
  const [isExistingAttSession, setIsExistingAttSession] = useState(false);

  useEffect(() => {
    if (assignedClasses.length > 0 && !attClassId) {
      setAttClassId(assignedClasses[0].id.toString());
    }
  }, [assignedClasses]);

  const fetchAttendanceRoster = async () => {
    if (!attClassId || !attDate) return;
    setAttLoading(true);
    setAttSuccess('');
    setAttError('');
    try {
      let url = `/attendance/students-for-marking?classId=${attClassId}&date=${attDate}`;
      if (attSubjectId) url += `&subjectId=${attSubjectId}`;
      const res = await apiRequest(url);
      if (res.success) {
        setAttStudents(res.data.students || []);
        setIsExistingAttSession(res.data.isExistingSession);
        setAttNotes(res.data.existingNotes || '');
      } else {
        setAttStudents([]);
        setAttError(res.message);
      }
    } catch (err) {
      setAttError(err.message || 'Failed to load class roster.');
    } finally {
      setAttLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'attendance' && attClassId) {
      fetchAttendanceRoster();
    }
  }, [activeTab, attClassId, attSubjectId, attDate]);

  const handleSaveTeacherAttendance = async () => {
    if (!attClassId || !attDate || attStudents.length === 0) return;
    setAttSaving(true);
    setAttSuccess('');
    setAttError('');
    try {
      const payload = {
        classId: parseInt(attClassId, 10),
        subjectId: attSubjectId ? parseInt(attSubjectId, 10) : null,
        date: attDate,
        notes: attNotes,
        records: attStudents.map((s) => ({
          studentId: s.studentId,
          status: s.status,
          remark: s.remark,
        })),
      };
      const res = await apiRequest('/attendance/sessions', {
        method: 'POST',
        data: payload,
      });
      if (res.success) {
        setAttSuccess(res.message || 'Attendance saved successfully!');
        setIsExistingAttSession(true);
      } else {
        setAttError(res.message || 'Failed to save attendance.');
      }
    } catch (err) {
      setAttError(err.message || 'Network error while saving.');
    } finally {
      setAttSaving(false);
    }
  };

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
            <p className="text-xs font-bold text-slate-900">{teacher?.name || user?.name || user?.email}</p>
            <p className="text-[10px] text-emerald-700 font-semibold">{teacher?.designation || 'Faculty Member'}</p>
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
        {/* Welcome Header */}
        <GlassCard padding="p-6 md:p-8" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FFD978]/40 text-slate-900 border border-[#FFD978]/60">
                Teacher Dashboard
              </span>
              {teacher?.employeeId && (
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  ID: {teacher.employeeId}
                </span>
              )}
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mt-2">
              Welcome, {teacher?.name || user?.name || 'Faculty Member'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {teacher?.designation || 'Instructor'} at <strong className="text-slate-700">{institute?.name}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchTeacherData}
              className="p-2.5 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors shadow-2xs"
              title="Refresh Workspace"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 font-bold shadow-2xs">
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
            { key: 'overview', label: 'Overview & Today', icon: Clock },
            { key: 'exams', label: 'Online Assessments', icon: Award },
            { key: 'attendance', label: 'Mark Attendance', icon: UserCheck },
            { key: 'classes', label: `My Classes (${stats.assignedClassesCount || 0})`, icon: School },
            {
              key: 'messages',
              label: unreadMessages > 0 ? `Messages (${unreadMessages})` : 'Messages',
              icon: MessageSquare,
              feature: 'INTERNAL_MESSAGES',
            },
            { key: 'gallery', label: 'Campus Gallery', icon: GalleryIcon, feature: 'GALLERY' },
            { key: 'polls', label: 'Polls & Voting', icon: Vote, feature: 'POLLS' },
            { key: 'subjects', label: `My Subjects (${stats.assignedSubjectsCount || 0})`, icon: BookOpen },
            { key: 'timetable', label: `Weekly Timetable (${stats.weeklySessionsCount || 0})`, icon: Calendar },
            { key: 'profile', label: 'Faculty Profile', icon: Award },
            { key: 'about', label: 'About EduNexa', icon: Info },
          ]
            .filter((tab) => !tab.feature || hasFeature(tab.feature))
            .map((tab) => {
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

        {/* Tab Content Area */}
        {loading && !dashboardData ? (
          <div className="py-16 flex justify-center">
            <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* 1. OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    title="Assigned Classes"
                    value={stats.assignedClassesCount || 0}
                    icon={School}
                  />
                  <StatCard
                    title="Assigned Subjects"
                    value={stats.assignedSubjectsCount || 0}
                    icon={BookOpen}
                  />
                  <StatCard
                    title="Today's Lectures"
                    value={todaySessions.length}
                    icon={Clock}
                  />
                  <StatCard
                    title="Weekly Periods"
                    value={stats.weeklySessionsCount || 0}
                    icon={Calendar}
                  />
                </div>

                {/* Teacher Dynamic Real Analytics Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
                  {/* Weekly Teaching Sessions */}
                  <AnalyticsCard
                    title="Weekly Teaching Sessions"
                    subtitle="Assigned lecture workload Monday through Sunday"
                    icon={CalendarRange}
                    loading={analyticsLoading}
                    error={analyticsError}
                    isEmpty={!analytics?.weeklyTeaching || analytics.weeklyTeaching.every((d) => d.sessions === 0)}
                    emptyMessage="No weekly teaching sessions found."
                    emptyDescription="Your weekly lecture periods will be plotted here."
                  >
                    <ResponsiveBarChart
                      data={analytics?.weeklyTeaching || []}
                      xKey="day"
                      yKey="sessions"
                      unit="periods"
                      barColor="#FFD978"
                    />
                  </AnalyticsCard>

                  {/* Students by Assigned Class */}
                  <AnalyticsCard
                    title="Students by Assigned Class"
                    subtitle="Student population across your teaching batches"
                    icon={BarChart3}
                    loading={analyticsLoading}
                    error={analyticsError}
                    isEmpty={!analytics?.studentsByClass || analytics.studentsByClass.length === 0}
                    emptyMessage="No students in assigned classes."
                  >
                    <ResponsiveBarChart
                      data={analytics?.studentsByClass || []}
                      xKey="className"
                      yKey="count"
                      unit="students"
                      barColor="#94a3b8"
                    />
                  </AnalyticsCard>
                </div>

                {/* Subject Workload Distribution (If multiple subjects) */}
                {analytics?.subjects && analytics.subjects.length > 0 && (
                  <AnalyticsCard
                    title="Subject Workload Distribution"
                    subtitle="Class allocations and weekly lecture slots per subject"
                    icon={PieIcon}
                    loading={analyticsLoading}
                    error={analyticsError}
                    isEmpty={analytics.subjects.length === 0}
                    emptyMessage="No subject distribution available."
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                      <ResponsiveDonutChart
                        data={analytics.subjects.map((s) => ({
                          name: s.name,
                          value: s.weeklySessions || s.assignedClasses || 1,
                        }))}
                        nameKey="name"
                        dataKey="value"
                        height={220}
                      />
                      <div className="space-y-2">
                        {analytics.subjects.map((sub, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                          >
                            <div>
                              <p className="font-bold text-slate-900">{sub.name}</p>
                              <p className="text-[11px] text-slate-400 font-mono">{sub.code}</p>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-slate-900">{sub.weeklySessions} periods</span>
                              <p className="text-[10px] text-slate-500">{sub.assignedClasses} classes</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </AnalyticsCard>
                )}

                {/* Today's Schedule */}
                <GlassCard padding="p-6 md:p-8" className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-slate-900 text-[#FFD978] flex items-center justify-center font-bold shadow-xs shrink-0">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900">
                          Today's Teaching Schedule ({dashboardData?.todayDayOfWeek || 'Today'})
                        </h3>
                        <p className="text-xs text-slate-400">Live lecture schedule for your assigned classes.</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                      {todaySessions.length} Periods Scheduled
                    </span>
                  </div>

                  {todaySessions.length === 0 ? (
                    <EmptyState
                      icon={Clock}
                      title="No Teaching Sessions Today"
                      description="You have no scheduled timetable slots for today."
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

                          {(sess.classType === 'ONLINE' || sess.classType === 'HYBRID') && sess.meetingUrl && sess.meetingUrl.startsWith('https://') && (
                            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 font-mono">
                                {sess.meetingId ? `ID: ${sess.meetingId}` : 'Online Link Ready'}
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

            {/* 2. MY CLASSES TAB */}
            {activeTab === 'classes' && (
              <GlassCard padding="p-6 md:p-8" className="space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="text-base font-black text-slate-900">My Assigned Classes</h3>
                  <p className="text-xs text-slate-400">Classes and batches where you are assigned as instructor or class teacher.</p>
                </div>

                {assignedClasses.length === 0 ? (
                  <EmptyState
                    icon={School}
                    title="No Classes Assigned Yet"
                    description="You are not currently assigned to any classes in this academic year."
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assignedClasses.map((cls) => (
                      <div key={cls.id} className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-900 text-[#FFD978]">
                            {cls.name}
                          </span>
                          {cls.section && (
                            <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-amber-100 text-amber-900 rounded">
                              Sec {cls.section}
                            </span>
                          )}
                        </div>
                        <div className="pt-2 text-xs text-slate-600 space-y-1">
                          <p>Medium: <strong>{cls.medium || 'English'}</strong></p>
                          <p>Type: <strong>{cls.classType || 'PHYSICAL'}</strong></p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            )}

            {/* 3. MY SUBJECTS TAB */}
            {activeTab === 'subjects' && (
              <GlassCard padding="p-6 md:p-8" className="space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="text-base font-black text-slate-900">My Teaching Curriculum</h3>
                  <p className="text-xs text-slate-400">Subjects assigned to you across all classes.</p>
                </div>

                {assignedSubjects.length === 0 ? (
                  <EmptyState
                    icon={BookOpen}
                    title="No Subjects Assigned"
                    description="No curriculum subjects have been assigned to your profile yet."
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assignedSubjects.map((sub) => (
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
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            )}

            {/* 4. WEEKLY TIMETABLE TAB */}
            {activeTab === 'timetable' && (
              <GlassCard padding="p-6 md:p-8" className="space-y-6">
                <div>
                  <h3 className="text-base font-black text-slate-900">Weekly Lecture Timetable</h3>
                  <p className="text-xs text-slate-400">Full 7-day schedule matrix for all your assigned sessions.</p>
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
                    description="You have no lectures assigned on this day."
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
                              Class: {sess.class?.name} {sess.class?.section ? `(${sess.class?.section})` : ''} {sess.room ? `• Rm: ${sess.room}` : ''}
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
            )}

            {/* ATTENDANCE MARKING TAB */}
            {activeTab === 'attendance' && (
              <GlassCard padding="p-6" className="space-y-6">
                <div>
                  <h3 className="text-base font-black text-slate-900">Mark Student Attendance</h3>
                  <p className="text-xs text-slate-400">Record daily or period-based student attendance for your assigned classes.</p>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Assigned Class *</label>
                    <select
                      value={attClassId}
                      onChange={(e) => setAttClassId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
                    >
                      <option value="">-- Select Class --</option>
                      {assignedClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.section ? `(${c.section})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Subject (Optional)</label>
                    <select
                      value={attSubjectId}
                      onChange={(e) => setAttSubjectId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
                    >
                      <option value="">General Attendance</option>
                      {assignedSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Date *</label>
                    <input
                      type="date"
                      value={attDate}
                      onChange={(e) => setAttDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
                    />
                  </div>
                </div>

                {/* Status Messages */}
                {attSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {attSuccess}
                  </div>
                )}
                {attError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-800">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    {attError}
                  </div>
                )}

                {/* Student Roster */}
                {attLoading ? (
                  <div className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    <p className="text-xs font-bold uppercase">Loading Class Students...</p>
                  </div>
                ) : attStudents.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No Students Found"
                    description="Select an assigned class above to load enrolled students."
                  />
                ) : (
                  <div className="space-y-4">
                    {/* Quick Action Bar */}
                    <div className="flex items-center justify-between gap-3 flex-wrap bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                      <span className="text-xs font-bold text-slate-500">
                        {attStudents.length} Students in Roster
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase mr-1">Mark All:</span>
                        <button
                          type="button"
                          onClick={() => setAttStudents((prev) => prev.map((s) => ({ ...s, status: 'PRESENT' })))}
                          className="px-2.5 py-1 text-xs font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg transition-all"
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() => setAttStudents((prev) => prev.map((s) => ({ ...s, status: 'ABSENT' })))}
                          className="px-2.5 py-1 text-xs font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-lg transition-all"
                        >
                          Absent
                        </button>
                      </div>
                    </div>

                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 text-slate-400 font-bold uppercase">
                          <tr>
                            <th className="py-2.5 px-3">Roll</th>
                            <th className="py-2.5 px-3">Student</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3">Remark</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {attStudents.map((st) => (
                            <tr key={st.studentId} className="hover:bg-slate-50/60">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-500">{st.rollNo}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">{st.name}</td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="inline-flex items-center gap-1">
                                  {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((stat) => (
                                    <button
                                      key={stat}
                                      type="button"
                                      onClick={() =>
                                        setAttStudents((prev) =>
                                          prev.map((s) => (s.studentId === st.studentId ? { ...s, status: stat } : s))
                                        )
                                      }
                                      className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                                        st.status === stat
                                          ? stat === 'PRESENT'
                                            ? 'bg-emerald-500 text-white'
                                            : stat === 'ABSENT'
                                            ? 'bg-rose-500 text-white'
                                            : stat === 'LATE'
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-blue-500 text-white'
                                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                      }`}
                                    >
                                      {stat.slice(0, 3)}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <input
                                  type="text"
                                  placeholder="Optional remark"
                                  value={st.remark || ''}
                                  onChange={(e) =>
                                    setAttStudents((prev) =>
                                      prev.map((s) => (s.studentId === st.studentId ? { ...s, remark: e.target.value } : s))
                                    )
                                  }
                                  className="w-full px-2.5 py-1 rounded-lg border border-slate-200 text-xs bg-white"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                      <input
                        type="text"
                        placeholder="Session notes (e.g. Completed Chapter 5)"
                        value={attNotes}
                        onChange={(e) => setAttNotes(e.target.value)}
                        className="w-full sm:w-1/2 px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleSaveTeacherAttendance}
                        disabled={attSaving}
                        className="w-full sm:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                      >
                        {attSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {isExistingAttSession ? 'Update Attendance' : 'Save Attendance'}
                      </button>
                    </div>
                  </div>
                )}
              </GlassCard>
            )}

            {/* ONLINE ASSESSMENTS TAB */}
            {activeTab === 'exams' && (
              <div className="space-y-6">
                <ExamsPage />
              </div>
            )}

            {/* 5. PROFILE TAB */}
            {activeTab === 'profile' && (
              <GlassCard padding="p-6 md:p-8" className="space-y-6">
                <div>
                  <h3 className="text-base font-black text-slate-900">Faculty Credentials & Information</h3>
                  <p className="text-xs text-slate-400">Verified profile on record at {institute?.name}.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase">Full Name</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{teacher?.name || 'N/A'}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase">Employee / Faculty ID</p>
                    <p className="text-sm font-mono font-bold text-slate-900 mt-1">{teacher?.employeeId || 'N/A'}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase">Designation</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{teacher?.designation || 'Instructor'}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase">Qualification</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{teacher?.qualification || 'Certified Educator'}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase">Contact Phone</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{teacher?.phone || 'N/A'}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase">Email Address</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{teacher?.email || user?.email || 'N/A'}</p>
                  </div>
                </div>
              </GlassCard>
            )}

            {/* TAB: CAMPUS GALLERY */}
            {activeTab === 'gallery' && (
              hasFeature('GALLERY') ? (
                <InstituteGalleryViewer role="TEACHER" />
              ) : (
                <LockedFeaturePage featureCode="GALLERY" featureName="Campus Gallery" />
              )
            )}

            {/* TAB: POLLS & VOTING */}
            {activeTab === 'polls' && (
              hasFeature('POLLS') ? (
                <RecipientPollsTab portalName="Teacher" />
              ) : (
                <LockedFeaturePage featureCode="POLLS" featureName="Polls & Voting" />
              )
            )}

            {/* TAB: SECURE INTERNAL MESSAGING */}
            {activeTab === 'messages' && (
              hasFeature('INTERNAL_MESSAGES') ? (
                <MessagingWorkspace portalRole="TEACHER" />
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
      </main>
    </div>
  );
}
