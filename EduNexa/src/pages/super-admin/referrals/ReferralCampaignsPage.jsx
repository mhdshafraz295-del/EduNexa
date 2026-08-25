import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';
import GlassCard from '../../../components/common/GlassCard';
import StatCard from '../../../components/common/StatCard';
import PageHeader from '../../../components/common/PageHeader';
import {
  Gift,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Building,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  X,
  Send,
  Calendar,
  Check,
  Ban,
  Radio,
  Edit2,
  FileText,
  Eye,
} from 'lucide-react';

export default function ReferralCampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('campaigns'); // 'campaigns' | 'rewards'

  // Selected Campaign Detail for Rewards Review
  const [selectedCampaignDetail, setSelectedCampaignDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Campaign Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [requiredReferrals, setRequiredReferrals] = useState(10);
  const [rewardMonths, setRewardMonths] = useState(1);
  const [repeatable, setRepeatable] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      setError('');
      const [listRes, analyticsRes] = await Promise.all([
        apiRequest('/referrals/admin/campaigns'),
        apiRequest('/referrals/admin/analytics'),
      ]);

      if (listRes.success) {
        setCampaigns(listRes.campaigns || []);
        if (listRes.campaigns?.length > 0) {
          fetchCampaignDetail(listRes.campaigns[0].id);
        }
      }
      if (analyticsRes.success) {
        setAnalytics(analyticsRes.data);
      }
    } catch (err) {
      console.error('Failed to load referral campaigns:', err);
      setError(err.message || 'Unable to load referral campaigns.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaignDetail = async (cId) => {
    if (!cId) return;
    try {
      setDetailLoading(true);
      const res = await apiRequest(`/referrals/admin/campaigns/${cId}`);
      if (res.success) {
        setSelectedCampaignDetail(res.campaign);
      }
    } catch (err) {
      console.warn('Failed to load campaign detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setRequiredReferrals(10);
    setRewardMonths(1);
    setRepeatable(false);
    setStartsAt(new Date().toISOString().slice(0, 16));
    setEndsAt('');
    setStatus('ACTIVE');
    setModalError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c) => {
    setEditingId(c.id);
    setName(c.name);
    setDescription(c.description || '');
    setRequiredReferrals(c.requiredReferrals);
    setRewardMonths(c.rewardMonths);
    setRepeatable(c.repeatable);
    setStartsAt(c.startsAt ? new Date(c.startsAt).toISOString().slice(0, 16) : '');
    setEndsAt(c.endsAt ? new Date(c.endsAt).toISOString().slice(0, 16) : '');
    setStatus(c.status);
    setModalError('');
    setIsModalOpen(true);
  };

  const handleSaveCampaign = async (e, forcedStatus) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setModalError('Campaign name is required.');
      return;
    }

    const numRequired = parseInt(requiredReferrals, 10);
    if (isNaN(numRequired) || numRequired <= 0) {
      setModalError('Required referrals must be a positive integer.');
      return;
    }

    const numMonths = parseInt(rewardMonths, 10);
    if (isNaN(numMonths) || numMonths <= 0) {
      setModalError('Reward months must be a positive integer.');
      return;
    }

    const effectiveStatus = forcedStatus || status;

    setModalSaving(true);
    setModalError('');

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        requiredReferrals: numRequired,
        rewardType: 'SUBSCRIPTION_EXTENSION',
        rewardMonths: numMonths,
        repeatable: Boolean(repeatable),
        startsAt: startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        status: effectiveStatus,
      };

      if (editingId) {
        await apiRequest(`/referrals/admin/campaigns/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/referrals/admin/campaigns', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setIsModalOpen(false);
      fetchCampaigns();
    } catch (err) {
      setModalError(err.message || 'Failed to save campaign.');
    } finally {
      setModalSaving(false);
    }
  };

  const handleToggleStatus = async (c, nextStatus) => {
    try {
      await apiRequest(`/referrals/admin/campaigns/${c.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchCampaigns();
    } catch (err) {
      alert(err.message || 'Failed to update campaign status.');
    }
  };

  const handleApproveReward = async (rewardId) => {
    if (!window.confirm('Approve this referral reward and extend the institute subscription?')) return;
    try {
      const res = await apiRequest(`/referrals/admin/rewards/${rewardId}/approve`, {
        method: 'PATCH',
      });
      if (res.success) {
        alert('Reward approved and subscription extended successfully!');
        fetchCampaigns();
        if (selectedCampaignDetail) fetchCampaignDetail(selectedCampaignDetail.id);
      }
    } catch (err) {
      alert(err.message || 'Failed to approve reward.');
    }
  };

  const handleRejectReward = async (rewardId) => {
    const reason = window.prompt('Enter rejection reason:');
    if (reason === null) return;
    try {
      const res = await apiRequest(`/referrals/admin/rewards/${rewardId}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ rejectionReason: reason }),
      });
      if (res.success) {
        alert('Reward rejected.');
        fetchCampaigns();
        if (selectedCampaignDetail) fetchCampaignDetail(selectedCampaignDetail.id);
      }
    } catch (err) {
      alert(err.message || 'Failed to reject reward.');
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header with prominent + Create Campaign button */}
      <PageHeader
        title="Referral & Marketing Campaigns"
        description="Manage institute growth campaigns, monitor qualified referrals, and verify subscription extension rewards."
        action={
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-slate-950 rounded-xl text-xs md:text-sm font-black hover:bg-amber-400 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Campaign</span>
          </button>
        }
      />

      {/* Real KPI Stats from MySQL */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Active Campaigns"
          value={analytics?.activeCampaignsCount ?? 0}
          icon={Radio}
        />
        <StatCard
          label="Total Referrals"
          value={analytics?.totalReferralsCount ?? 0}
          icon={Building}
        />
        <StatCard
          label="Qualified Referrals"
          value={analytics?.qualifiedReferralsCount ?? 0}
          icon={CheckCircle2}
        />
        <StatCard
          label="Rewards Applied"
          value={analytics?.rewardsAppliedCount ?? 0}
          icon={Gift}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`pb-3 text-xs md:text-sm font-bold border-b-2 transition-all px-2 cursor-pointer ${
            activeTab === 'campaigns'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Referral Campaigns ({campaigns.length})
        </button>
        <button
          onClick={() => setActiveTab('rewards')}
          className={`pb-3 text-xs md:text-sm font-bold border-b-2 transition-all px-2 cursor-pointer ${
            activeTab === 'rewards'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Rewards Review & Approvals
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchCampaigns}
            className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {activeTab === 'campaigns' ? (
        /* Campaigns Table */
        <GlassCard className="p-4 md:p-6 space-y-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-7 h-7 animate-spin text-slate-400" />
              <p className="text-xs text-slate-500 font-medium">Loading referral campaigns...</p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <Gift className="w-12 h-12 mx-auto text-slate-300 stroke-[1.5]" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-700">No referral campaigns have been created yet.</p>
                <p className="text-xs text-slate-500">Launch a campaign to incentivize campuses with free subscription extensions.</p>
              </div>
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black hover:bg-amber-400 transition-all shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create Campaign</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="py-3 px-3">Campaign Name</th>
                    <th className="py-3 px-3">Requirement & Reward</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Referral Metrics</th>
                    <th className="py-3 px-3">Rewards Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-3 max-w-xs">
                        <h4 className="font-bold text-slate-900">{c.name}</h4>
                        {c.description && <p className="text-[11px] text-slate-500 line-clamp-1">{c.description}</p>}
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="font-mono font-bold text-slate-800">
                          {c.requiredReferrals} Institutes → {c.rewardMonths} Month(s) Free
                        </span>
                        <div className="text-[10px] text-slate-400">{c.repeatable ? 'Repeatable' : 'One-time reward'}</div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.status === 'PAUSED'
                              ? 'bg-amber-100 text-amber-900'
                              : c.status === 'DRAFT'
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 font-mono text-[11px]">
                        <span className="font-bold text-emerald-700">{c.metrics?.qualifiedReferrals || 0}</span>
                        <span className="text-slate-400"> / {c.metrics?.totalReferrals || 0} Qualified</span>
                      </td>

                      <td className="py-3.5 px-3 font-mono text-[11px]">
                        <span className="font-bold text-amber-700">{c.metrics?.pendingRewards || 0} Pending</span>
                        <span className="text-slate-400"> ({c.metrics?.appliedRewards || 0} Applied)</span>
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {c.status === 'ACTIVE' ? (
                            <button
                              onClick={() => handleToggleStatus(c, 'PAUSED')}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100"
                            >
                              Pause
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(c, 'ACTIVE')}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
                            >
                              Activate
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditModal(c)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                            title="Edit Campaign"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCampaignDetail(c);
                              fetchCampaignDetail(c.id);
                              setActiveTab('rewards');
                            }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Review</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      ) : (
        /* Rewards Awaiting Review & Approval */
        <GlassCard className="p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs md:text-sm font-bold text-slate-900">
              Rewards Review for {selectedCampaignDetail?.name || 'Active Campaigns'}
            </h3>
          </div>

          {selectedCampaignDetail?.rewards?.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-300 stroke-[1.5]" />
              <p className="text-xs font-bold text-slate-700">No pending rewards</p>
              <p className="text-[11px] text-slate-500">All referral goals are either in progress or have already been verified.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="py-3 px-3">Institute Name</th>
                    <th className="py-3 px-3">Qualified Progress</th>
                    <th className="py-3 px-3">Reward Earned</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Earned Date</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedCampaignDetail?.rewards?.map((rw) => (
                    <tr key={rw.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-900">{rw.institute?.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{rw.institute?.code}</div>
                      </td>

                      <td className="py-3.5 px-3 font-mono font-bold text-emerald-700">
                        {rw.qualifiedReferralCount} Qualified
                      </td>

                      <td className="py-3.5 px-3 font-semibold text-slate-800">
                        +{rw.rewardMonths} Month(s) Free Subscription
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rw.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : rw.status === 'PENDING_APPROVAL'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {rw.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-slate-500 text-[11px]">
                        {new Date(rw.earnedAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        {rw.status === 'PENDING_APPROVAL' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleApproveReward(rw.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-500 transition-all shadow-2xs cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve & Extend</span>
                            </button>
                            <button
                              onClick={() => handleRejectReward(rw.id)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg text-xs cursor-pointer"
                              title="Reject Reward"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            {rw.status === 'APPROVED' ? 'Applied' : rw.rejectionReason || 'Rejected'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      )}

      {/* Create / Edit Campaign Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-amber-50/50">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Gift className="w-4 h-4 text-amber-600" />
                <span>{editingId ? 'Edit Referral Campaign' : 'Create Referral Campaign'}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => handleSaveCampaign(e)} className="p-4 overflow-y-auto space-y-4 flex-1">
              {modalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {modalError}
                </div>
              )}

              {/* Campaign Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Campaign Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Q4 Campus Growth Reward"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe campaign terms, eligible referrals, and reward criteria..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                />
              </div>

              {/* Required Referrals & Reward Months */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Required Referrals *</label>
                  <input
                    type="number"
                    min="1"
                    value={requiredReferrals}
                    onChange={(e) => setRequiredReferrals(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978] font-mono font-bold"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Number of paid campuses required</span>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Reward Months *</label>
                  <input
                    type="number"
                    min="1"
                    value={rewardMonths}
                    onChange={(e) => setRewardMonths(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978] font-mono font-bold"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Free calendar months granted</span>
                </div>
              </div>

              {/* Repeatable Toggle */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  id="repeatableCheck"
                  checked={repeatable}
                  onChange={(e) => setRepeatable(e.target.checked)}
                  className="rounded text-amber-500"
                />
                <label htmlFor="repeatableCheck" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Allow institutes to earn multiple rewards (e.g. every 10 referrals unlocks 1 additional month)
                </label>
              </div>

              {/* Initial Status */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Initial Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                >
                  <option value="ACTIVE">ACTIVE (Published & Tracking)</option>
                  <option value="DRAFT">DRAFT (Hidden)</option>
                  <option value="PAUSED">PAUSED</option>
                </select>
              </div>

              {/* Schedule Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Start Date / Time</label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">End Date / Time (Optional)</label>
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={modalSaving}
                    onClick={() => handleSaveCampaign(null, 'DRAFT')}
                    className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 shadow-2xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Save Draft</span>
                  </button>

                  <button
                    type="button"
                    disabled={modalSaving}
                    onClick={() => handleSaveCampaign(null, 'ACTIVE')}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500 text-slate-950 hover:bg-amber-400 flex items-center gap-1.5 shadow-xs"
                  >
                    {modalSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{editingId ? 'Update Campaign' : 'Activate Campaign'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
