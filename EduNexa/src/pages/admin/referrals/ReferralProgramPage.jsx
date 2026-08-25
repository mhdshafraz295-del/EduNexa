import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';
import GlassCard from '../../../components/common/GlassCard';
import StatCard from '../../../components/common/StatCard';
import PageHeader from '../../../components/common/PageHeader';
import {
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  Award,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Building,
} from 'lucide-react';

export default function ReferralProgramPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/referrals/dashboard');
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      console.error('Failed to load referral dashboard:', err);
      setError(err.message || 'Unable to load referral program data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const frontendBaseUrl =
    import.meta.env.VITE_FRONTEND_URL ||
    window.location.origin;

  const referralCode = data?.referralCode || '';
  const referralLink = referralCode
    ? `${frontendBaseUrl}/register?ref=${encodeURIComponent(referralCode)}`
    : '';

  const handleCopyCode = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (!referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join EduNexa',
          text: 'Register your institute on EduNexa using my referral link.',
          url: referralLink,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  if (loading && !data) {
    return (
      <div className="py-16 flex justify-center">
        <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
      </div>
    );
  }

  const campaign = data?.activeCampaign;
  const progress = data?.progress || {};
  const referrals = data?.referrals || [];
  const rewards = data?.rewards || [];

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <PageHeader
        title="Referral & Rewards Program"
        subtitle="Invite partner schools, colleges, and academies to EduNexa and earn free monthly subscription extensions for your campus."
        action={
          <button
            onClick={fetchDashboard}
            className="p-2.5 bg-white text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 transition-colors shadow-2xs cursor-pointer"
            title="Refresh Referral Program"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchDashboard}
            className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Campaign Hero Banner & Progress */}
      {campaign ? (
        <div className="relative overflow-hidden rounded-3xl p-6 md:p-8 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 text-white shadow-xl border border-amber-500/20">
          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black uppercase tracking-wider border border-amber-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Active Campaign</span>
              </div>
              <h2 className="text-xl md:text-3xl font-black tracking-tight text-white">
                {campaign.name}
              </h2>
              <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                {campaign.description || `Refer ${campaign.requiredReferrals} active institutes to unlock ${campaign.rewardMonths} Month(s) FREE subscription.`}
              </p>

              {/* Progress Bar */}
              <div className="pt-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-amber-300 font-bold">
                    {progress.qualifiedCount || 0} / {progress.requiredReferrals || 10} Qualified Campuses
                  </span>
                  <span className="text-slate-300 font-semibold">{progress.progressPercent || 0}% Complete</span>
                </div>

                <div className="w-full h-3.5 rounded-full bg-white/10 p-0.5 border border-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-[#FFD978] transition-all duration-500 shadow-sm"
                    style={{ width: `${Math.max(5, progress.progressPercent || 0)}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-400">
                  {progress.remainingNeeded > 0
                    ? `🎯 ${progress.remainingNeeded} more qualified paid referral(s) needed to unlock your reward!`
                    : '🎉 Goal achieved! Your reward is pending review and application.'}
                </p>
              </div>
            </div>

            {/* Unique Referral Identity Box */}
            <div className="w-full lg:w-80 p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Your Unique Referral Code</span>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-white/10 font-mono text-sm font-black text-[#FFD978]">
                  <span>{data?.referralCode}</span>
                  <button
                    onClick={handleCopyCode}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"
                    title="Copy Code"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-amber-500 text-slate-950 font-black text-xs hover:bg-amber-400 active:scale-95 transition-all shadow-xs"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Referral Link'}</span>
                </button>
                <button
                  onClick={handleNativeShare}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10"
                  title="Share Link"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <GlassCard className="p-6 text-center text-slate-500 space-y-2">
          <Gift className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
          <h3 className="text-sm font-bold text-slate-700">No Active Referral Campaign</h3>
          <p className="text-xs text-slate-400">Check back soon for new platform referral reward programs.</p>
        </GlassCard>
      )}

      {/* Referral Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Total Referred Campuses"
          value={progress.totalSent ?? 0}
          icon={Building}
        />
        <StatCard
          label="Qualified Active"
          value={progress.qualifiedCount ?? 0}
          icon={CheckCircle2}
        />
        <StatCard
          label="Pending Activation"
          value={progress.pendingCount ?? 0}
          icon={Clock}
        />
        <StatCard
          label="Rewards Earned"
          value={rewards.length ?? 0}
          icon={Award}
        />
      </div>

      {/* Split Tables: Referred Institutes & Rewards History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Referred Institutes List */}
        <GlassCard className="p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs md:text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <span>Referred Campuses ({referrals.length})</span>
            </h3>
          </div>

          {referrals.length === 0 ? (
            <div className="py-8 text-center text-slate-400 space-y-1">
              <p className="text-xs font-semibold text-slate-600">No campuses registered yet</p>
              <p className="text-[11px] text-slate-400">Share your referral link with educational institutes to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-2">Campus</th>
                    <th className="py-2.5 px-2">Registered</th>
                    <th className="py-2.5 px-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {referrals.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-2">
                        <span className="font-bold text-slate-900">{r.instituteName}</span>
                        {r.code && <span className="text-[10px] text-slate-400 font-mono block">{r.code}</span>}
                      </td>
                      <td className="py-3 px-2 text-slate-500 text-[11px]">
                        {new Date(r.registeredAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.status === 'QUALIFIED' || r.status === 'REWARDED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {r.status === 'QUALIFIED' ? 'Qualified' : r.status === 'PENDING' ? 'Pending Activation' : r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

        {/* Rewards History */}
        <GlassCard className="p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs md:text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-600" />
              <span>Rewards & Subscription Extensions ({rewards.length})</span>
            </h3>
          </div>

          {rewards.length === 0 ? (
            <div className="py-8 text-center text-slate-400 space-y-1">
              <p className="text-xs font-semibold text-slate-600">No rewards earned yet</p>
              <p className="text-[11px] text-slate-400">Reach the referral threshold to unlock free subscription months.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-2">Reward</th>
                    <th className="py-2.5 px-2">Earned Date</th>
                    <th className="py-2.5 px-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rewards.map((rw) => (
                    <tr key={rw.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-2">
                        <span className="font-bold text-slate-900">+{rw.rewardMonths} Month(s) FREE</span>
                        <span className="text-[10px] text-slate-400 block">{rw.campaignName}</span>
                      </td>
                      <td className="py-3 px-2 text-slate-500 text-[11px]">
                        {new Date(rw.earnedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rw.status === 'APPROVED' || rw.status === 'APPLIED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : rw.status === 'PENDING_APPROVAL'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {rw.status === 'APPROVED' || rw.status === 'APPLIED' ? 'Applied' : 'Pending Approval'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
