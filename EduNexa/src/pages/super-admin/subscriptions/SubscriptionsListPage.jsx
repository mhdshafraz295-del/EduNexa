import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';
import SubscriptionReviewModal from './SubscriptionReviewModal';
import {
  CreditCard,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Building,
  Eye,
  AlertCircle,
  Sparkles,
  Calendar,
  Layers,
} from 'lucide-react';

export default function SubscriptionsListPage() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending'); // 'pending' | 'active' | 'rejected' | 'all'
  const [search, setSearch] = useState('');
  const [selectedPaymentToReview, setSelectedPaymentToReview] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [subsRes, pendingRes] = await Promise.all([
        apiRequest('/super-admin/subscriptions'),
        apiRequest('/super-admin/subscriptions/pending'),
      ]);

      if (subsRes.success) setSubscriptions(subsRes.data);
      if (pendingRes.success) setPendingPayments(pendingRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenReview = (payment) => {
    setSelectedPaymentToReview(payment);
    setIsReviewModalOpen(true);
  };

  // Filter subscriptions based on tab and search
  const filteredSubscriptions = subscriptions.filter((sub) => {
    const matchesSearch =
      sub.institute?.name?.toLowerCase().includes(search.toLowerCase()) ||
      sub.institute?.code?.toLowerCase().includes(search.toLowerCase()) ||
      sub.planNameSnapshot?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (tab === 'active') return sub.status === 'ACTIVE';
    if (tab === 'rejected') return sub.status === 'REJECTED';
    return true;
  });

  const activeCount = subscriptions.filter((s) => s.status === 'ACTIVE').length;
  const pendingCount = pendingPayments.length;
  const rejectedCount = subscriptions.filter((s) => s.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900">Institute Subscriptions & Approvals</h2>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900 bg-[#FFD978] px-2.5 py-0.5 rounded-full">
              SaaS Billing
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Review manual bank transfer slips, audit historical plan snapshots, and activate subscriptions
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setTab('pending')}
          className={`bg-white p-5 rounded-3xl border-2 cursor-pointer transition-all shadow-xs flex items-center justify-between ${
            tab === 'pending' ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div>
            <span className="text-[11px] font-bold uppercase text-amber-900 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Pending Verifications
            </span>
            <h3 className="text-3xl font-black text-slate-900 mt-0.5">{pendingCount} Waiting</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            {pendingCount}
          </div>
        </div>

        <div
          onClick={() => setTab('active')}
          className={`bg-white p-5 rounded-3xl border-2 cursor-pointer transition-all shadow-xs flex items-center justify-between ${
            tab === 'active' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div>
            <span className="text-[11px] font-bold uppercase text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Active Subscriptions
            </span>
            <h3 className="text-3xl font-black text-emerald-600 mt-0.5">{activeCount} Institutes</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        <div
          onClick={() => setTab('all')}
          className={`bg-white p-5 rounded-3xl border-2 cursor-pointer transition-all shadow-xs flex items-center justify-between ${
            tab === 'all' ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400">Total Records</span>
            <h3 className="text-3xl font-black text-slate-900 mt-0.5">{subscriptions.length} Subscriptions</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs & Search Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
          {[
            { id: 'pending', label: `Pending Queue (${pendingCount})` },
            { id: 'active', label: `Active (${activeCount})` },
            { id: 'rejected', label: `Rejected (${rejectedCount})` },
            { id: 'all', label: `All History (${subscriptions.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search institute name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
          />
        </div>
      </div>

      {/* Presentation: PENDING VERIFICATION QUEUE */}
      {tab === 'pending' ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Pending Deposit Verification Queue</h3>
              <p className="text-xs text-slate-400">Transfers submitted by institutes awaiting receipt verification</p>
            </div>
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
              {pendingPayments.length} Awaiting
            </span>
          </div>

          {loading ? (
            <div className="py-16 flex justify-center">
              <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
            </div>
          ) : pendingPayments.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
              <h4 className="text-base font-bold text-slate-800">All caught up!</h4>
              <p className="text-xs text-slate-400 mt-1">There are no pending subscription payments to verify.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-6">Institute</th>
                    <th className="py-3.5 px-6">Requested Plan</th>
                    <th className="py-3.5 px-6">Amount</th>
                    <th className="py-3.5 px-6">Transfer Reference</th>
                    <th className="py-3.5 px-6">Submitted Date</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {pendingPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold text-xs border border-amber-200">
                            <Building className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{p.institute?.name}</p>
                            <span className="font-mono text-xs text-slate-400 font-semibold">{p.institute?.code}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-800">{p.subscription?.planNameSnapshot}</p>
                        <p className="text-xs text-slate-400">
                          {p.subscription?.durationSnapshot} {p.subscription?.durationTypeSnapshot}
                        </p>
                      </td>

                      <td className="py-4 px-6 font-black text-slate-900 font-mono">
                        {p.currency} {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-4 px-6 font-mono text-xs font-bold text-slate-700">
                        {p.transferReference}
                      </td>

                      <td className="py-4 px-6 text-xs text-slate-500">
                        {new Date(p.submittedAt).toLocaleDateString()}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleOpenReview(p)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all active:scale-95"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#FFD978]" />
                          <span>Review & Approve</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* SUBSCRIPTIONS AUDIT LIST (ACTIVE / REJECTED / ALL) */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-6">Institute</th>
                  <th className="py-3.5 px-6">Plan Snapshot</th>
                  <th className="py-3.5 px-6">Price</th>
                  <th className="py-3.5 px-6">Active Dates</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Receipt Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredSubscriptions.map((sub) => {
                  const latestP = sub.latestPayment;
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-900">{sub.institute?.name}</p>
                        <p className="text-xs font-mono text-slate-400">{sub.institute?.code}</p>
                      </td>

                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-800">{sub.planNameSnapshot}</p>
                        <p className="text-xs text-slate-400">
                          {sub.durationSnapshot} {sub.durationTypeSnapshot}
                        </p>
                      </td>

                      <td className="py-4 px-6 font-mono font-black text-slate-900">
                        {sub.currencySnapshot} {sub.priceSnapshot.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-4 px-6 text-xs text-slate-600">
                        {sub.startDate && sub.endDate ? (
                          <div>
                            <p>{new Date(sub.startDate).toLocaleDateString()} - {new Date(sub.endDate).toLocaleDateString()}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not activated</span>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          sub.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : sub.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {sub.status}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right">
                        {latestP ? (
                          <button
                            onClick={() => handleOpenReview({ ...latestP, subscription: sub, institute: sub.institute })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Slip</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No payments</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Modal */}
      <SubscriptionReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onActionCompleted={fetchData}
        payment={selectedPaymentToReview}
      />
    </div>
  );
}
