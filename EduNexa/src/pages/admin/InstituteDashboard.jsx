import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { apiRequest } from '../../services/api';
import GlassCard from '../../components/common/GlassCard';
import StatCard from '../../components/common/StatCard';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import {
  AnalyticsCard,
  ResponsiveBarChart,
  ResponsiveAreaChart,
} from '../../components/charts';
import {
  School,
  GraduationCap,
  Users,
  Receipt,
  ArrowRight,
  Plus,
  Calendar,
  Clock,
  TrendingUp,
  Layers,
  BarChart3,
  CalendarRange,
  RefreshCw,
  Lock,
  Award,
  Megaphone,
  Gift,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export default function InstituteDashboard() {
  const { institute } = useAuth();
  const { hasFeature } = useSubscription();
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [referralData, setReferralData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState('');
  const [analyticsError, setAnalyticsError] = useState('');

  const hasExamFeature = hasFeature('ONLINE_EXAMS');

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const [dashRes, annRes, refRes] = await Promise.all([
        apiRequest('/portal/dashboard'),
        apiRequest('/platform-announcements/feed?filter=active'),
        apiRequest('/referrals/dashboard'),
      ]);
      if (dashRes.success) setData(dashRes.data);
      if (annRes.success) setAnnouncements(annRes.announcements || []);
      if (refRes.success) setReferralData(refRes);
    } catch (err) {
      setError(err.message || 'Failed to load institute dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAnnouncementRead = async (annId) => {
    try {
      await apiRequest(`/platform-announcements/feed/${annId}/read`, { method: 'PATCH' });
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === annId ? { ...a, isRead: true } : a))
      );
    } catch (err) {
      // silent
    }
  };

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError('');
      const res = await apiRequest('/portal/dashboard/analytics');
      if (res.success) {
        setAnalytics(res.data);
      }
    } catch (err) {
      setAnalyticsError(err.message || 'Unable to load analytics.');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchAnalytics();
  }, []);

  if (loading && !data) {
    return (
      <div className="py-16 flex justify-center">
        <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
      </div>
    );
  }

  const counts = data?.counts || {};
  const currentAcademicYear = data?.currentAcademicYear;
  const todaySessions = data?.todaySessions || [];

  const studentsByLevel = analytics?.studentsByLevel || [];
  const studentsByClass = analytics?.studentsByClass || [];
  const studentGrowth = analytics?.studentGrowth || [];
  const weeklyTimetable = analytics?.weeklyTimetable || [];
  const hasTimetableFeature = analytics?.hasTimetableFeature !== false;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Context Page Header & Actions */}
      <PageHeader
        title={institute?.name || 'Institute Dashboard'}
        description="Monitor institute activities, active curriculum, live lecture schedules, and administrative records."
        badge={institute?.code ? `INSTITUTE • ${institute.code}` : 'TENANT WORKSPACE'}
        action={
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                fetchDashboard();
                fetchAnalytics();
              }}
              className="p-2.5 bg-white text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 transition-colors shadow-2xs"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${loading || analyticsLoading ? 'animate-spin' : ''}`} />
            </button>
            {hasExamFeature && (
              <Link
                to="/admin/exams?action=create"
                className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs bg-slate-900 hover:bg-slate-800 text-[#FFD978]"
              >
                <Plus className="w-4 h-4 text-[#FFD978]" />
                <span>+ Create Live Exam</span>
              </Link>
            )}
            <Link
              to="/admin/students"
              className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold"
            >
              <Plus className="w-4 h-4" />
              <span>Add Student</span>
            </Link>
            <Link
              to="/admin/academic?tab=classes"
              className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold"
            >
              <School className="w-4 h-4 text-slate-500" />
              <span>Classes</span>
            </Link>
          </div>
        }
      />

      {/* Platform Announcements Feed */}
      {announcements.length > 0 && (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <div
              key={ann.id}
              onClick={() => handleMarkAnnouncementRead(ann.id)}
              className={`p-4 rounded-2xl border transition-all shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                ann.priority === 'URGENT'
                  ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                  : ann.priority === 'IMPORTANT'
                  ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                  : 'bg-indigo-50/90 border-indigo-200 text-indigo-950'
              } ${!ann.isRead ? 'ring-2 ring-amber-400/50' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    ann.priority === 'URGENT'
                      ? 'bg-rose-200 text-rose-800'
                      : ann.priority === 'IMPORTANT'
                      ? 'bg-amber-200 text-amber-900'
                      : 'bg-indigo-200 text-indigo-900'
                  }`}
                >
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-black uppercase px-2 py-0.2 rounded-full bg-white/70 shadow-2xs">
                      {ann.priority} Announcement
                    </span>
                    {!ann.isRead && (
                      <span className="text-[9px] font-black px-2 py-0.2 rounded-full bg-amber-500 text-slate-950">
                        NEW
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs md:text-sm font-bold text-slate-900">{ann.title}</h4>
                  <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{ann.message}</p>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-medium shrink-0">
                {new Date(ann.publishedAt || ann.startsAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Referral Program Quick Widget */}
      {referralData?.activeCampaign && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-amber-950 text-white shadow-soft flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-amber-500/20">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0">
              <Gift className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2 py-0.2 rounded-md">
                  Referral Reward
                </span>
                <h4 className="text-xs md:text-sm font-black text-white">{referralData.activeCampaign.name}</h4>
              </div>
              <p className="text-xs text-slate-300">
                {referralData.progress.qualifiedCount} / {referralData.progress.requiredReferrals} Qualified •{' '}
                {referralData.progress.remainingNeeded > 0
                  ? `Refer ${referralData.progress.remainingNeeded} more campus(es) to unlock ${referralData.activeCampaign.rewardMonths} Month FREE!`
                  : 'Goal reached! Reward awaiting approval.'}
              </p>
            </div>
          </div>

          <Link
            to="/admin/referrals"
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black hover:bg-amber-400 transition-all shadow-xs shrink-0"
          >
            <span>View Referral Program</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Active Academic Year Banner */}
      {currentAcademicYear && (
        <div className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-l-[#FFD978]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FFD978]/30 flex items-center justify-center text-slate-900 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Current Academic Session</p>
              <h4 className="text-sm font-black text-slate-900">{currentAcademicYear.name}</h4>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200 self-start sm:self-auto">
            Session Active
          </span>
        </div>
      )}

      {/* Quick Actions Bar */}
      <div className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200/80">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">Quick Actions</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {hasExamFeature && (
            <Link
              to="/admin/exams?action=create"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-[#FFD978] shadow-xs transition-all"
            >
              <Award className="w-4 h-4" />
              <span>+ Create Live Exam</span>
            </Link>
          )}
          <Link
            to="/admin/students"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-all"
          >
            <Users className="w-4 h-4 text-slate-500" />
            <span>Add Student</span>
          </Link>
          <Link
            to="/admin/teachers"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-all"
          >
            <Users className="w-4 h-4 text-slate-500" />
            <span>Add Teacher</span>
          </Link>
          <Link
            to="/admin/academic?tab=classes"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-all"
          >
            <School className="w-4 h-4 text-slate-500" />
            <span>Create Class</span>
          </Link>
          {hasExamFeature && (
            <Link
              to="/admin/exams"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-all"
            >
              <Award className="w-4 h-4 text-slate-500" />
              <span>Exams Hub</span>
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Reusable Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <StatCard
          title="Enrolled Students"
          value={counts.students || 0}
          icon={GraduationCap}
          subtitle="Registered learners"
          linkTo="/admin/students"
          linkLabel="Students Directory"
        />
        <StatCard
          title="Faculty & Teachers"
          value={counts.teachers || 0}
          icon={Users}
          subtitle="Active educators"
          linkTo="/admin/teachers"
          linkLabel="Faculty List"
        />
        <StatCard
          title="Classes & Sections"
          value={counts.classes || 0}
          icon={School}
          subtitle="Active grade batches"
          linkTo="/admin/academic?tab=classes"
          linkLabel="Grade Divisions"
        />
        <StatCard
          title="Fee Invoices"
          value={counts.invoices || 0}
          icon={Receipt}
          subtitle="Invoices generated"
          linkTo="/admin/invoices"
          linkLabel="Fee Ledger"
        />
      </div>

      {/* Institute Analytics Charts: Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
        {/* Students by Academic Level (Dynamic Levels) */}
        <AnalyticsCard
          title="Students by Academic Level"
          subtitle="Enrollment breakdown by institute academic levels"
          icon={Layers}
          loading={analyticsLoading}
          error={analyticsError}
          isEmpty={studentsByLevel.length === 0}
          emptyMessage="No academic levels configured."
          emptyDescription="Configure Academic Levels in Academic Settings to see student distribution."
        >
          <ResponsiveBarChart
            data={studentsByLevel}
            xKey="level"
            yKey="count"
            unit="students"
            barColor="#FFD978"
          />
        </AnalyticsCard>

        {/* Student Growth Over Time */}
        <AnalyticsCard
          title="Student Registration Growth"
          subtitle="Cumulative learner enrollment trend"
          icon={TrendingUp}
          loading={analyticsLoading}
          error={analyticsError}
          isEmpty={studentGrowth.length === 0}
          emptyMessage="No student registration trend available."
        >
          <ResponsiveAreaChart
            data={studentGrowth}
            xKey="month"
            yKey="count"
            areaName="Enrolled Students"
            unit="students"
            strokeColor="#E6BC50"
            fillColor="#FFD978"
          />
        </AnalyticsCard>
      </div>

      {/* Institute Analytics Charts: Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
        {/* Students by Class / Batch */}
        <AnalyticsCard
          title="Students by Class / Batch"
          subtitle="Active enrollment count per grade section"
          icon={BarChart3}
          loading={analyticsLoading}
          error={analyticsError}
          isEmpty={studentsByClass.length === 0}
          emptyMessage="No active classes found."
        >
          <ResponsiveBarChart
            data={studentsByClass}
            xKey="className"
            yKey="count"
            unit="students"
            barColor="#94a3b8"
          />
        </AnalyticsCard>

        {/* Weekly Timetable Sessions (Feature Gated) */}
        <AnalyticsCard
          title="Weekly Timetable Schedule"
          subtitle="Distribution of scheduled periods Monday through Sunday"
          icon={CalendarRange}
          loading={analyticsLoading}
          error={analyticsError}
          isEmpty={!hasTimetableFeature || weeklyTimetable.every((d) => d.sessions === 0)}
          emptyMessage={
            !hasTimetableFeature
              ? 'Timetable feature is disabled in your subscription plan.'
              : 'No timetable sessions have been created yet.'
          }
          emptyDescription={
            !hasTimetableFeature
              ? 'Upgrade your subscription plan to unlock full Timetable management and analytics.'
              : 'Add scheduled lecture periods to visualize weekly distribution.'
          }
          badge={!hasTimetableFeature ? 'PRO FEATURE' : undefined}
          action={
            !hasTimetableFeature ? (
              <Link
                to="/admin/subscription"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold"
              >
                <Lock className="w-3 h-3" />
                <span>Upgrade</span>
              </Link>
            ) : null
          }
        >
          <ResponsiveBarChart
            data={weeklyTimetable}
            xKey="day"
            yKey="sessions"
            unit="sessions"
            barColor="#FFD978"
          />
        </AnalyticsCard>
      </div>

      {/* Today's Institute Timetable Sessions */}
      <GlassCard padding="p-6 md:p-7" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-[#FFD978] flex items-center justify-center font-bold shadow-xs shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Today's Class Schedule ({data?.todayDayOfWeek || 'Today'})
              </h3>
              <p className="text-xs text-slate-500">Live lecture schedule across all institute classes.</p>
            </div>
          </div>
          <Link
            to="/admin/timetable"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 px-3.5 py-2 rounded-xl transition-colors self-start sm:self-auto"
          >
            <span>Full Timetable</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        </div>

        {todaySessions.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No Timetable Sessions Scheduled Today"
            description="There are no classes scheduled on today's calendar for this institute."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {todaySessions.map((sess) => (
              <div
                key={sess.id}
                className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 shadow-2xs space-y-2.5 transition-all hover:bg-slate-50"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-slate-900 text-[#FFD978]">
                    {sess.startTime} - {sess.endTime}
                  </span>
                  <StatusBadge status={sess.classType} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm truncate">{sess.subject?.name}</h4>
                  <p className="text-xs text-slate-500 font-medium">
                    {sess.class?.name} {sess.class?.section ? `(${sess.class?.section})` : ''}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="truncate">{sess.teacher?.name || 'Assigned Faculty'}</span>
                  {sess.room && <span className="font-semibold text-slate-700">Rm: {sess.room}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Recent Students & Invoices Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Students */}
        <GlassCard padding="p-6">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Recent Students</h4>
              <p className="text-xs text-slate-400">Latest students registered in this institute</p>
            </div>
            <Link to="/admin/students" className="text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors">
              View All
            </Link>
          </div>

          {data?.recentStudents?.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {data.recentStudents.map((st) => (
                <div key={st.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-bold text-slate-900">{st.name || `${st.firstName || ''} ${st.lastName || ''}`}</p>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">
                      Adm: {st.admissionNumber || st.rollNo || 'N/A'} • Class: {st.class ? `${st.class.name} ${st.class.section || ''}` : 'Unassigned'}
                    </p>
                  </div>
                  <StatusBadge status="ACTIVE" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-6 text-center">No students registered yet.</p>
          )}
        </GlassCard>

        {/* Recent Invoices */}
        <GlassCard padding="p-6">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Recent Invoices</h4>
              <p className="text-xs text-slate-400">Latest fee records generated</p>
            </div>
            <Link to="/admin/invoices" className="text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors">
              View All
            </Link>
          </div>

          {data?.recentInvoices?.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {data.recentInvoices.map((inv) => (
                <div key={inv.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-bold text-slate-900">{inv.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Invoice: {inv.invoiceNumber} • Student: {inv.student?.name || 'Student'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">${inv.totalAmount?.toFixed(2)}</p>
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-6 text-center">No invoices generated yet.</p>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
