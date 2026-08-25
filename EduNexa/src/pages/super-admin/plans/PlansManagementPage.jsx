import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';
import PlanModal from './PlanModal';
import {
  CreditCard,
  Plus,
  Search,
  Copy,
  Edit2,
  CheckCircle2,
  XCircle,
  Sparkles,
  LayoutGrid,
  List,
  Shield,
  Layers,
  Check,
  X,
  Users,
  Eye,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export default function PlansManagementPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlanToEdit, setSelectedPlanToEdit] = useState(null);
  const [previewPlan, setPreviewPlan] = useState(null);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/super-admin/plans');
      if (res.success) {
        setPlans(res.data);
      }
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleToggleStatus = async (plan) => {
    try {
      const nextStatus = !plan.isActive;
      const res = await apiRequest(`/super-admin/plans/${plan.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextStatus }),
      });
      if (res.success) {
        fetchPlans();
      }
    } catch (err) {
      alert(err.message || 'Failed to update plan status.');
    }
  };

  const handleDuplicate = async (plan) => {
    if (!window.confirm(`Duplicate '${plan.name}' into a new draft plan?`)) return;
    try {
      const res = await apiRequest(`/super-admin/plans/${plan.id}/duplicate`, {
        method: 'POST',
      });
      if (res.success) {
        fetchPlans();
      }
    } catch (err) {
      alert(err.message || 'Failed to duplicate plan.');
    }
  };

  const handleOpenEdit = (plan) => {
    setSelectedPlanToEdit(plan);
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setSelectedPlanToEdit(null);
    setIsModalOpen(true);
  };

  // Filtered plans
  const filteredPlans = plans.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === 'active') return p.isActive;
    if (statusFilter === 'inactive') return !p.isActive;
    return true;
  });

  const totalPlans = plans.length;
  const activePlans = plans.filter((p) => p.isActive).length;
  const popularPlan = plans.find((p) => p.isPopular);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900">Subscription Plans Management</h2>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900 bg-[#FFD978] px-2.5 py-0.5 rounded-full shadow-xs">
              SaaS Engine
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Configure dynamic pricing tiers, multi-duration packages, usage limits, and modular feature bindings
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 text-[#FFD978]" />
          <span>Create New Plan</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400">Configured Plans</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{totalPlans} Tiers</h3>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400">Active Offerings</span>
            <h3 className="text-2xl font-black text-emerald-600 mt-0.5">{activePlans} Live</h3>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400">Popular Tier</span>
            <h3 className="text-sm font-bold text-slate-900 mt-0.5 truncate max-w-[140px]">
              {popularPlan ? popularPlan.name : 'None Set'}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-100/70 border border-amber-300 flex items-center justify-center text-amber-900">
            <Sparkles className="w-5 h-5 fill-amber-500" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400">Catalog Modules</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">29 Features</h3>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and View Toggle Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search plans by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {/* Status Filters */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {['all', 'active', 'inactive'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                  statusFilter === s
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400 hover:text-slate-900'
              }`}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Plans Presentation */}
      {loading ? (
        <div className="py-16 flex justify-center bg-white rounded-3xl border border-slate-200">
          <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200">
          <CreditCard className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h4 className="text-base font-bold text-slate-800">No subscription plans found</h4>
          <p className="text-xs text-slate-400 mt-1">
            Create a custom plan to make dynamic packages available to institutes.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-6">Plan Name</th>
                  <th className="py-3.5 px-6">Price</th>
                  <th className="py-3.5 px-6">Duration</th>
                  <th className="py-3.5 px-6">Student Limit</th>
                  <th className="py-3.5 px-6">Features</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredPlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-base">{plan.name}</span>
                            {plan.isPopular && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FFD978] text-amber-950 border border-amber-300 flex items-center gap-1 shadow-2xs">
                                <Sparkles className="w-2.5 h-2.5 fill-amber-900" />
                                POPULAR
                              </span>
                            )}
                          </div>
                          {plan.description && (
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 max-w-xs">
                              {plan.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6 font-black text-slate-900">
                      <span className="text-xs font-mono text-slate-400 mr-1">{plan.currency}</span>
                      {plan.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-4 px-6 text-xs font-semibold text-slate-700">
                      {plan.duration}{' '}
                      {plan.durationType === 'MONTHS'
                        ? plan.duration > 1
                          ? 'Months'
                          : 'Month'
                        : plan.durationType === 'YEARS'
                        ? plan.duration > 1
                          ? 'Years'
                          : 'Year'
                        : 'Days'}
                    </td>

                    <td className="py-4 px-6">
                      {plan.studentLimit === null ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          Unlimited
                        </span>
                      ) : (
                        <span className="text-xs font-mono font-bold text-slate-800">
                          {plan.studentLimit.toLocaleString()} Students
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                        <Layers className="w-3.5 h-3.5 text-slate-500" />
                        {plan.enabledFeaturesCount} / {plan.totalFeaturesCount}
                      </span>
                    </td>

                    <td className="py-4 px-6">
                      <button
                        onClick={() => handleToggleStatus(plan)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                          plan.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            plan.isActive ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setPreviewPlan(plan)}
                          className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                          title="Preview Tier"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(plan)}
                          className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                          title="Duplicate Plan"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(plan)}
                          className="p-2 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-colors"
                          title="Edit Configuration"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-3xl border-2 p-6 shadow-xs flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-md ${
                plan.isPopular ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-200/80'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute top-0 right-0 bg-[#FFD978] text-amber-950 px-3.5 py-0.5 rounded-bl-2xl font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                  <Sparkles className="w-3 h-3 fill-amber-900" />
                  POPULAR
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${plan.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {plan.isActive ? '● Live Tier' : '○ Inactive'}
                  </span>
                </div>

                <h3 className="text-xl font-black text-slate-900">{plan.name}</h3>
                <p className="text-xs text-slate-500 mt-1 min-h-[32px] line-clamp-2">
                  {plan.description || 'Dynamic subscription tier for educational institutes.'}
                </p>

                <div className="my-5 pb-5 border-b border-slate-100">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-mono font-bold text-slate-400">{plan.currency}</span>
                    <span className="text-3xl font-black text-slate-900">
                      {plan.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      / {plan.duration}{' '}
                      {plan.durationType === 'MONTHS'
                        ? plan.duration > 1
                          ? 'months'
                          : 'month'
                        : plan.durationType === 'YEARS'
                        ? plan.duration > 1
                          ? 'years'
                          : 'year'
                        : 'days'}
                    </span>
                  </div>
                </div>

                {/* Key Limits */}
                <div className="space-y-2 text-xs text-slate-700 mb-6">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>{plan.studentLimit === null ? 'Unlimited' : `Up to ${plan.studentLimit}`}</strong> Students
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>{plan.teacherLimit === null ? 'Unlimited' : `Up to ${plan.teacherLimit}`}</strong> Teachers
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>{plan.enabledFeaturesCount}</strong> Active Modules Enabled
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleToggleStatus(plan)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    plan.isActive
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {plan.isActive ? 'Deactivate' : 'Activate'}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDuplicate(plan)}
                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
                    title="Duplicate Plan"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(plan)}
                    className="p-2 text-slate-700 hover:text-amber-900 hover:bg-amber-100 rounded-xl font-bold text-xs inline-flex items-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plan Modal (Create & Edit) */}
      <PlanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={fetchPlans}
        planToEdit={selectedPlanToEdit}
      />

      {/* Quick Preview Modal */}
      {previewPlan && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-[#FFD978] uppercase">Plan Inspector</span>
                <h3 className="text-lg font-bold">{previewPlan.name}</h3>
              </div>
              <button
                onClick={() => setPreviewPlan(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">
                  {previewPlan.currency} {previewPlan.price.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500 font-semibold">
                  / {previewPlan.duration} {previewPlan.durationType}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl text-xs">
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[10px]">Student Capacity</span>
                  <p className="font-bold text-slate-900">
                    {previewPlan.studentLimit === null ? 'Unlimited' : `${previewPlan.studentLimit} Students`}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[10px]">Faculty Capacity</span>
                  <p className="font-bold text-slate-900">
                    {previewPlan.teacherLimit === null ? 'Unlimited' : `${previewPlan.teacherLimit} Teachers`}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[10px]">Cloud Storage</span>
                  <p className="font-bold text-slate-900">
                    {previewPlan.storageLimitGb === null ? 'Unlimited' : `${previewPlan.storageLimitGb} GB`}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[10px]">Campus Branches</span>
                  <p className="font-bold text-slate-900">
                    {previewPlan.branchLimit === null ? 'Unlimited' : `${previewPlan.branchLimit} Branches`}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Active Bound Features ({previewPlan.enabledFeaturesCount})
                </p>
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-2">
                  {(previewPlan.features || [])
                    .filter((pf) => pf.isEnabled)
                    .map((pf) => (
                      <div key={pf.id} className="flex items-center gap-2 text-xs text-slate-800">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{pf.feature?.name || pf.feature?.code}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setPreviewPlan(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
