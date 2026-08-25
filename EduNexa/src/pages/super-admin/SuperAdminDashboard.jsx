import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import InstituteModal from './InstituteModal';
import GlassCard from '../../components/common/GlassCard';
import StatCard from '../../components/common/StatCard';
import PageHeader from '../../components/common/PageHeader';
import {
  AnalyticsCard,
  ResponsiveAreaChart,
  ResponsiveBarChart,
  ResponsiveDonutChart,
} from '../../components/charts';
import {
  Building2,
  CheckCircle2,
  XCircle,
  Users,
  Plus,
  ArrowRight,
  Building,
  ExternalLink,
  TrendingUp,
  CreditCard,
  PieChart as PieIcon,
  BarChart3,
  RefreshCw,
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState('');
  const [analyticsError, setAnalyticsError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/super-admin/dashboard/stats');
      if (res.success) {
        setStats(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError('');
      const res = await apiRequest('/super-admin/dashboard/analytics');
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
    fetchStats();
    fetchAnalytics();
  }, []);

  const handleToggleStatus = async (inst) => {
    try {
      const nextStatus = !inst.isActive;
      await apiRequest(`/super-admin/institutes/${inst.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextStatus }),
      });
      fetchStats();
      fetchAnalytics();
    } catch (err) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  if (loading && !stats) {
    return (
      <div className="py-16 flex justify-center">
        <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
      </div>
    );
  }

  const instituteGrowth = analytics?.instituteGrowth || [];
  const subscriptionDistribution = analytics?.subscriptionDistribution || [];
  const usersByRole = analytics?.usersByRole || [];
  const instituteStatus = analytics?.instituteStatus || [];

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Top Header with Action */}
      <PageHeader
        title="SaaS Multi-Institute Governance"
        description="Monitor tenant environments, user distribution, and platform infrastructure."
        badge="PLATFORM GOVERNANCE"
        action={
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                fetchStats();
                fetchAnalytics();
              }}
              className="p-2.5 bg-white text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 transition-colors shadow-2xs"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${loading || analyticsLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs"
            >
              <Plus className="w-4 h-4 text-slate-900" />
              <span>Provision New Institute</span>
            </button>
          </div>
        }
      />

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <StatCard
          title="Total Institutes"
          value={stats?.totalInstitutes || 0}
          icon={Building2}
          subtitle="Tenant Workspaces"
          linkTo="/super-admin/institutes"
          linkLabel="Directory"
        />
        <StatCard
          title="Active Institutes"
          value={stats?.activeInstitutes || 0}
          icon={CheckCircle2}
          subtitle="Operational Tenants"
          linkTo="/super-admin/institutes"
          linkLabel="Manage Active"
        />
        <StatCard
          title="Inactive Institutes"
          value={stats?.inactiveInstitutes || 0}
          icon={XCircle}
          subtitle="Access Suspended"
          linkTo="/super-admin/institutes"
          linkLabel="Review Inactive"
        />
        <StatCard
          title="Platform Users"
          value={stats?.totalUsers || 0}
          icon={Users}
          subtitle="Across all institutes"
          linkTo="/super-admin/users"
          linkLabel="Users Directory"
        />
      </div>

      {/* Real Platform Analytics Charts: Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
        {/* Institute Growth Over Time */}
        <AnalyticsCard
          title="Institute Growth Trend"
          subtitle="New tenant onboarding trajectory over time"
          icon={TrendingUp}
          loading={analyticsLoading}
          error={analyticsError}
          isEmpty={instituteGrowth.length === 0}
          emptyMessage="No institute growth data available yet."
          emptyDescription="As new institutes are provisioned, their registration timeline will appear here."
        >
          <ResponsiveAreaChart
            data={instituteGrowth}
            xKey="month"
            yKey="count"
            areaName="New Institutes"
            unit="institutes"
            strokeColor="#E6BC50"
            fillColor="#FFD978"
          />
        </AnalyticsCard>

        {/* Active Subscription Distribution */}
        <AnalyticsCard
          title="Active Subscriptions by Plan"
          subtitle="Current active plans snapshot distribution"
          icon={CreditCard}
          loading={analyticsLoading}
          error={analyticsError}
          isEmpty={subscriptionDistribution.length === 0}
          emptyMessage="No active subscription data available."
          emptyDescription="Active institute subscriptions will be categorized by plan snapshot."
        >
          <ResponsiveDonutChart
            data={subscriptionDistribution}
            nameKey="name"
            dataKey="count"
          />
        </AnalyticsCard>
      </div>

      {/* Real Platform Analytics Charts: Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
        {/* Platform Users by Role */}
        <AnalyticsCard
          title="Platform Users by Role"
          subtitle="Aggregated tenant user population by role"
          icon={BarChart3}
          loading={analyticsLoading}
          error={analyticsError}
          isEmpty={usersByRole.length === 0}
          emptyMessage="No platform users found."
        >
          <ResponsiveBarChart
            data={usersByRole}
            xKey="name"
            yKey="count"
            unit="users"
          />
        </AnalyticsCard>

        {/* Institute Status Distribution */}
        <AnalyticsCard
          title="Institute Status Breakdown"
          subtitle="Active operational vs suspended tenants"
          icon={PieIcon}
          loading={analyticsLoading}
          error={analyticsError}
          isEmpty={instituteStatus.length === 0}
          emptyMessage="No institute status metrics available."
        >
          <ResponsiveDonutChart
            data={instituteStatus}
            nameKey="name"
            dataKey="value"
          />
        </AnalyticsCard>
      </div>

      {/* Role Distribution Pill List */}
      <GlassCard padding="p-5 md:p-6">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3.5">
          Platform User Distribution Details
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 text-center">
            <span className="text-[11px] font-bold uppercase text-slate-500">Super Admins</span>
            <p className="text-xl font-black text-slate-900 mt-0.5">{stats?.roleCounts?.SUPER_ADMIN || 0}</p>
          </div>
          <div className="p-3 bg-[#FFD978]/15 rounded-xl border border-[#FFD978]/40 text-center">
            <span className="text-[11px] font-bold uppercase text-slate-900">Institute Admins</span>
            <p className="text-xl font-black text-slate-900 mt-0.5">{stats?.roleCounts?.ADMIN || 0}</p>
          </div>
          <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/60 text-center">
            <span className="text-[11px] font-bold uppercase text-emerald-800">Teachers</span>
            <p className="text-xl font-black text-slate-900 mt-0.5">{stats?.roleCounts?.TEACHER || 0}</p>
          </div>
          <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/60 text-center">
            <span className="text-[11px] font-bold uppercase text-blue-800">Students</span>
            <p className="text-xl font-black text-slate-900 mt-0.5">{stats?.roleCounts?.STUDENT || 0}</p>
          </div>
          <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200/60 text-center">
            <span className="text-[11px] font-bold uppercase text-purple-800">Parents</span>
            <p className="text-xl font-black text-slate-900 mt-0.5">{stats?.roleCounts?.PARENT || 0}</p>
          </div>
        </div>
      </GlassCard>

      {/* Recent Institutes Table */}
      <GlassCard padding="p-0" className="overflow-hidden">
        <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900">Recent Institutes</h3>
            <p className="text-xs text-slate-500">Recently onboarded and managed tenant institutes</p>
          </div>
          <Link
            to="/super-admin/institutes"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 hover:text-slate-800 bg-[#FFD978]/40 hover:bg-[#FFD978]/60 px-3.5 py-2 rounded-xl transition-colors border border-[#FFD978]/60"
          >
            <span>View All Institutes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-6">Institute</th>
                <th className="py-3 px-6">Code & Slug</th>
                <th className="py-3 px-6">Users Scoped</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {stats?.recentInstitutes?.map((inst) => (
                <tr key={inst.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#FFD978]/25 border border-[#FFD978]/50 flex items-center justify-center font-bold text-slate-900 text-xs shrink-0">
                        <Building className="w-5 h-5" />
                      </div>
                      <div>
                        <Link
                          to={`/super-admin/institutes/${inst.id}`}
                          className="font-bold text-slate-900 hover:text-slate-700 transition-colors"
                        >
                          {inst.name}
                        </Link>
                        <p className="text-xs text-slate-400">{inst.email || 'No email specified'}</p>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-6">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-bold text-slate-700">{inst.code}</span>
                      <span className="font-mono text-[11px] text-slate-400">/{inst.slug}</span>
                    </div>
                  </td>

                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span><strong>{inst.userCount}</strong> total</span>
                      <span className="text-slate-300">•</span>
                      <span><strong>{inst.studentCount}</strong> students</span>
                    </div>
                  </td>

                  <td className="py-4 px-6">
                    <button
                      onClick={() => handleToggleStatus(inst)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                        inst.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${inst.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {inst.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>

                  <td className="py-4 px-6 text-right">
                    <Link
                      to={`/super-admin/institutes/${inst.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      <span>Manage</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Create Modal */}
      <InstituteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => {
          fetchStats();
          fetchAnalytics();
        }}
      />
    </div>
  );
}
