import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';
import EduNexaLogo from '../../../components/common/EduNexaLogo';
import {
  X,
  Sparkles,
  Check,
  AlertCircle,
  Eye,
  Sliders,
  Shield,
  Layers,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Zap,
} from 'lucide-react';

export default function PlanModal({ isOpen, onClose, onSaved, planToEdit }) {
  const [categories, setCategories] = useState({});
  const [allFeatures, setAllFeatures] = useState([]);
  const [loadingFeatures, setLoadingFeatures] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'limits' | 'features' | 'preview'

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '5000',
    currency: 'LKR',
    duration: 1,
    durationType: 'MONTHS',
    isActive: true,
    isPopular: false,
    displayOrder: 0,
    // Limits (null means unlimited)
    studentLimit: 500,
    teacherLimit: 30,
    adminLimit: 5,
    classLimit: 30,
    courseLimit: 20,
    storageLimitGb: 25,
    branchLimit: 1,
    // Unlimited toggles
    unlimitedStudents: false,
    unlimitedTeachers: false,
    unlimitedAdmins: false,
    unlimitedClasses: false,
    unlimitedCourses: false,
    unlimitedStorage: false,
    unlimitedBranches: false,
    // Selected feature IDs
    selectedFeatureIds: [],
  });

  // Fetch feature catalog
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        setLoadingFeatures(true);
        const res = await apiRequest('/super-admin/features');
        if (res.success) {
          setAllFeatures(res.data);
          setCategories(res.grouped || {});
        }
      } catch (err) {
        console.error('Error fetching features:', err);
      } finally {
        setLoadingFeatures(false);
      }
    };

    if (isOpen) {
      fetchCatalog();
    }
  }, [isOpen]);

  // Populate form if editing
  useEffect(() => {
    if (planToEdit) {
      const enabledIds = (planToEdit.features || [])
        .filter((pf) => pf.isEnabled)
        .map((pf) => pf.featureId || pf.feature?.id);

      setFormData({
        name: planToEdit.name || '',
        description: planToEdit.description || '',
        price: planToEdit.price !== undefined ? String(planToEdit.price) : '0',
        currency: planToEdit.currency || 'LKR',
        duration: planToEdit.duration || 1,
        durationType: planToEdit.durationType || 'MONTHS',
        isActive: planToEdit.isActive !== undefined ? planToEdit.isActive : true,
        isPopular: planToEdit.isPopular || false,
        displayOrder: planToEdit.displayOrder || 0,
        studentLimit: planToEdit.studentLimit,
        teacherLimit: planToEdit.teacherLimit,
        adminLimit: planToEdit.adminLimit,
        classLimit: planToEdit.classLimit,
        courseLimit: planToEdit.courseLimit,
        storageLimitGb: planToEdit.storageLimitGb,
        branchLimit: planToEdit.branchLimit,
        unlimitedStudents: planToEdit.studentLimit === null,
        unlimitedTeachers: planToEdit.teacherLimit === null,
        unlimitedAdmins: planToEdit.adminLimit === null,
        unlimitedClasses: planToEdit.classLimit === null,
        unlimitedCourses: planToEdit.courseLimit === null,
        unlimitedStorage: planToEdit.storageLimitGb === null,
        unlimitedBranches: planToEdit.branchLimit === null,
        selectedFeatureIds: enabledIds,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        price: '5000',
        currency: 'LKR',
        duration: 1,
        durationType: 'MONTHS',
        isActive: true,
        isPopular: false,
        displayOrder: 0,
        studentLimit: 500,
        teacherLimit: 30,
        adminLimit: 5,
        classLimit: 30,
        courseLimit: 20,
        storageLimitGb: 25,
        branchLimit: 1,
        unlimitedStudents: false,
        unlimitedTeachers: false,
        unlimitedAdmins: false,
        unlimitedClasses: false,
        unlimitedCourses: false,
        unlimitedStorage: false,
        unlimitedBranches: false,
        selectedFeatureIds: allFeatures.map((f) => f.id),
      });
    }
  }, [planToEdit, allFeatures]);

  if (!isOpen) return null;

  const toggleFeature = (id) => {
    setFormData((prev) => {
      const exists = prev.selectedFeatureIds.includes(id);
      return {
        ...prev,
        selectedFeatureIds: exists
          ? prev.selectedFeatureIds.filter((fid) => fid !== id)
          : [...prev.selectedFeatureIds, id],
      };
    });
  };

  const toggleCategory = (catName) => {
    const catFeatures = categories[catName] || [];
    const catFeatureIds = catFeatures.map((f) => f.id);
    const allCatSelected = catFeatureIds.every((id) =>
      formData.selectedFeatureIds.includes(id)
    );

    setFormData((prev) => ({
      ...prev,
      selectedFeatureIds: allCatSelected
        ? prev.selectedFeatureIds.filter((id) => !catFeatureIds.includes(id))
        : Array.from(new Set([...prev.selectedFeatureIds, ...catFeatureIds])),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Plan name is required.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: parseFloat(formData.price) || 0,
        currency: formData.currency,
        duration: parseInt(formData.duration, 10) || 1,
        durationType: formData.durationType,
        isActive: formData.isActive,
        isPopular: formData.isPopular,
        displayOrder: parseInt(formData.displayOrder, 10) || 0,
        studentLimit: formData.unlimitedStudents ? null : parseInt(formData.studentLimit, 10) || 0,
        teacherLimit: formData.unlimitedTeachers ? null : parseInt(formData.teacherLimit, 10) || 0,
        adminLimit: formData.unlimitedAdmins ? null : parseInt(formData.adminLimit, 10) || 0,
        classLimit: formData.unlimitedClasses ? null : parseInt(formData.classLimit, 10) || 0,
        courseLimit: formData.unlimitedCourses ? null : parseInt(formData.courseLimit, 10) || 0,
        storageLimitGb: formData.unlimitedStorage ? null : parseInt(formData.storageLimitGb, 10) || 0,
        branchLimit: formData.unlimitedBranches ? null : parseInt(formData.branchLimit, 10) || 0,
        featureIds: formData.selectedFeatureIds,
      };

      const url = planToEdit
        ? `/super-admin/plans/${planToEdit.id}`
        : '/super-admin/plans';

      const method = planToEdit ? 'PUT' : 'POST';

      const res = await apiRequest(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (res.success) {
        onSaved();
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to save subscription plan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFD978] text-slate-900 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">
                {planToEdit ? `Edit Plan: ${planToEdit.name}` : 'Create Subscription Plan'}
              </h3>
              <p className="text-xs text-slate-400">
                Dynamic pricing, duration, usage limits, and modular feature bindings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 bg-slate-50/75 shrink-0 overflow-x-auto">
          {[
            { id: 'details', label: '1. Plan Details & Pricing' },
            { id: 'limits', label: '2. Usage Limits' },
            { id: 'features', label: `3. Features (${formData.selectedFeatureIds.length} Active)` },
            { id: 'preview', label: '4. Live Preview' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: Plan Details */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Plan Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Standard Institute, Gold Academy, Starter Tier"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Marketing Description
                  </label>
                  <textarea
                    rows="2"
                    placeholder="e.g. Complete academic management for medium-sized schools with exam reports"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Price ({formData.currency}) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="5000.00"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full pl-3.5 pr-16 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                      {formData.currency}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  >
                    <option value="LKR">LKR (Sri Lankan Rupee)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="GBP">GBP (British Pound)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Duration Period *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Duration Unit *
                  </label>
                  <select
                    value={formData.durationType}
                    onChange={(e) => setFormData({ ...formData, durationType: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  >
                    <option value="MONTHS">Months (e.g. 1 Month, 3 Months, 6 Months)</option>
                    <option value="YEARS">Years (e.g. 1 Year, 2 Years)</option>
                    <option value="DAYS">Days (e.g. 14 Days Free Trial)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Display Order / Sequence
                  </label>
                  <input
                    type="number"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  />
                </div>
              </div>

              {/* Status and Flags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <label className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.isPopular}
                    onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                    className="w-4 h-4 rounded text-slate-900 focus:ring-[#FFD978]"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      Mark as 'Popular / Recommended'
                    </span>
                    <p className="text-[11px] text-slate-400">Highlights this plan with a golden badge</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-slate-900 focus:ring-[#FFD978]"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900">
                      Active Status (Available to Institutes)
                    </span>
                    <p className="text-[11px] text-slate-400">When disabled, this plan is hidden from selection</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: Usage Limits */}
          {activeTab === 'limits' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs flex items-center gap-2.5">
                <Shield className="w-4 h-4 shrink-0 text-amber-700" />
                <span>
                  Configure usage limits for this tier. Toggle <strong>Unlimited</strong> for enterprise or unbounded tiers. (Step 2 configuration).
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Students */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">Maximum Students</label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.unlimitedStudents}
                        onChange={(e) =>
                          setFormData({ ...formData, unlimitedStudents: e.target.checked })
                        }
                        className="rounded text-slate-900 focus:ring-[#FFD978]"
                      />
                      <span>Unlimited</span>
                    </label>
                  </div>
                  {!formData.unlimitedStudents && (
                    <input
                      type="number"
                      min="1"
                      value={formData.studentLimit || ''}
                      onChange={(e) => setFormData({ ...formData, studentLimit: e.target.value })}
                      placeholder="e.g. 500"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    />
                  )}
                </div>

                {/* Teachers */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">Maximum Teachers / Faculty</label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.unlimitedTeachers}
                        onChange={(e) =>
                          setFormData({ ...formData, unlimitedTeachers: e.target.checked })
                        }
                        className="rounded text-slate-900 focus:ring-[#FFD978]"
                      />
                      <span>Unlimited</span>
                    </label>
                  </div>
                  {!formData.unlimitedTeachers && (
                    <input
                      type="number"
                      min="1"
                      value={formData.teacherLimit || ''}
                      onChange={(e) => setFormData({ ...formData, teacherLimit: e.target.value })}
                      placeholder="e.g. 30"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    />
                  )}
                </div>

                {/* Admins */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">Maximum Institute Admins</label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.unlimitedAdmins}
                        onChange={(e) =>
                          setFormData({ ...formData, unlimitedAdmins: e.target.checked })
                        }
                        className="rounded text-slate-900 focus:ring-[#FFD978]"
                      />
                      <span>Unlimited</span>
                    </label>
                  </div>
                  {!formData.unlimitedAdmins && (
                    <input
                      type="number"
                      min="1"
                      value={formData.adminLimit || ''}
                      onChange={(e) => setFormData({ ...formData, adminLimit: e.target.value })}
                      placeholder="e.g. 5"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    />
                  )}
                </div>

                {/* Classes */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">Maximum Classes & Sections</label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.unlimitedClasses}
                        onChange={(e) =>
                          setFormData({ ...formData, unlimitedClasses: e.target.checked })
                        }
                        className="rounded text-slate-900 focus:ring-[#FFD978]"
                      />
                      <span>Unlimited</span>
                    </label>
                  </div>
                  {!formData.unlimitedClasses && (
                    <input
                      type="number"
                      min="1"
                      value={formData.classLimit || ''}
                      onChange={(e) => setFormData({ ...formData, classLimit: e.target.value })}
                      placeholder="e.g. 30"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    />
                  )}
                </div>

                {/* Courses */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">Maximum Online Courses</label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.unlimitedCourses}
                        onChange={(e) =>
                          setFormData({ ...formData, unlimitedCourses: e.target.checked })
                        }
                        className="rounded text-slate-900 focus:ring-[#FFD978]"
                      />
                      <span>Unlimited</span>
                    </label>
                  </div>
                  {!formData.unlimitedCourses && (
                    <input
                      type="number"
                      min="1"
                      value={formData.courseLimit || ''}
                      onChange={(e) => setFormData({ ...formData, courseLimit: e.target.value })}
                      placeholder="e.g. 20"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    />
                  )}
                </div>

                {/* Storage */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">Storage Limit (GB)</label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.unlimitedStorage}
                        onChange={(e) =>
                          setFormData({ ...formData, unlimitedStorage: e.target.checked })
                        }
                        className="rounded text-slate-900 focus:ring-[#FFD978]"
                      />
                      <span>Unlimited</span>
                    </label>
                  </div>
                  {!formData.unlimitedStorage && (
                    <input
                      type="number"
                      min="1"
                      value={formData.storageLimitGb || ''}
                      onChange={(e) => setFormData({ ...formData, storageLimitGb: e.target.value })}
                      placeholder="e.g. 25"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    />
                  )}
                </div>

                {/* Branches */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">Maximum Branches / Campuses</label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.unlimitedBranches}
                        onChange={(e) =>
                          setFormData({ ...formData, unlimitedBranches: e.target.checked })
                        }
                        className="rounded text-slate-900 focus:ring-[#FFD978]"
                      />
                      <span>Unlimited</span>
                    </label>
                  </div>
                  {!formData.unlimitedBranches && (
                    <input
                      type="number"
                      min="1"
                      value={formData.branchLimit || ''}
                      onChange={(e) => setFormData({ ...formData, branchLimit: e.target.value })}
                      placeholder="e.g. 2"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Features */}
          {activeTab === 'features' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Feature Catalog Bindings</h4>
                  <p className="text-xs text-slate-500">
                    Enable or disable modular features for this subscription plan
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        selectedFeatureIds: allFeatures.map((f) => f.id),
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        selectedFeatureIds: [],
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {loadingFeatures ? (
                <div className="py-8 flex justify-center">
                  <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(categories).map(([catName, features]) => {
                    const catFeatureIds = features.map((f) => f.id);
                    const allSelected = catFeatureIds.every((id) =>
                      formData.selectedFeatureIds.includes(id)
                    );
                    const someSelected =
                      !allSelected &&
                      catFeatureIds.some((id) => formData.selectedFeatureIds.includes(id));

                    return (
                      <div
                        key={catName}
                        className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 sm:p-5"
                      >
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/60">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                            <h5 className="text-xs font-black uppercase tracking-wider text-slate-800">
                              {catName} Module ({features.length} Features)
                            </h5>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleCategory(catName)}
                            className="text-xs font-bold text-amber-800 hover:underline"
                          >
                            {allSelected ? 'Deselect Category' : 'Toggle Category All'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {features.map((feat) => {
                            const isChecked = formData.selectedFeatureIds.includes(feat.id);
                            return (
                              <label
                                key={feat.id}
                                className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                  isChecked
                                    ? 'bg-white border-slate-900 shadow-xs ring-1 ring-slate-900/10'
                                    : 'bg-white/60 border-slate-200 text-slate-400 hover:border-slate-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleFeature(feat.id)}
                                  className="mt-0.5 w-4 h-4 rounded text-slate-900 focus:ring-[#FFD978]"
                                />
                                <div className="space-y-0.5">
                                  <p
                                    className={`text-xs font-bold ${
                                      isChecked ? 'text-slate-900' : 'text-slate-500'
                                    }`}
                                  >
                                    {feat.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-mono">
                                    {feat.code}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Live Plan Preview */}
          {activeTab === 'preview' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 text-xs">
                💡 <strong>Real-time Institute Preview</strong>: This preview demonstrates exactly how Institute Admins will view and compare this plan during subscription selection.
              </div>

              <div className="flex justify-center">
                <div
                  className={`w-full max-w-md bg-white rounded-3xl border-2 p-6 sm:p-8 shadow-xl transition-all relative overflow-hidden ${
                    formData.isPopular ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-200'
                  }`}
                >
                  {formData.isPopular && (
                    <div className="absolute top-0 right-0 bg-[#FFD978] text-amber-950 px-4 py-1 rounded-bl-2xl font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-xs">
                      <Sparkles className="w-3 h-3 fill-amber-900" />
                      POPULAR
                    </div>
                  )}

                  <div className="mb-6">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Tier Level
                    </span>
                    <h3 className="text-2xl font-black text-slate-900 mt-1">
                      {formData.name || 'Tier Name'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {formData.description || 'No description provided'}
                    </p>
                  </div>

                  <div className="pb-6 mb-6 border-b border-slate-100">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-mono font-bold text-slate-400">
                        {formData.currency}
                      </span>
                      <span className="text-4xl font-black text-slate-900">
                        {parseFloat(formData.price || 0).toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">
                        / {formData.duration}{' '}
                        {formData.durationType === 'MONTHS'
                          ? formData.duration > 1
                            ? 'months'
                            : 'month'
                          : formData.durationType === 'YEARS'
                          ? formData.duration > 1
                            ? 'years'
                            : 'year'
                          : 'days'}
                      </span>
                    </div>
                  </div>

                  {/* Limits summary */}
                  <div className="space-y-2 mb-6 text-xs text-slate-700">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>
                          {formData.unlimitedStudents
                            ? 'Unlimited'
                            : `Up to ${formData.studentLimit || 0}`}
                        </strong>{' '}
                        Enrolled Students
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>
                          {formData.unlimitedTeachers
                            ? 'Unlimited'
                            : `Up to ${formData.teacherLimit || 0}`}
                        </strong>{' '}
                        Teachers & Faculty
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>
                          {formData.unlimitedStorage
                            ? 'Unlimited'
                            : `${formData.storageLimitGb || 0} GB`}
                        </strong>{' '}
                        Cloud Document Storage
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>
                          {formData.unlimitedBranches
                            ? 'Unlimited'
                            : `${formData.branchLimit || 1}`}
                        </strong>{' '}
                        Campus Branch{formData.branchLimit > 1 ? 'es' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Included features preview */}
                  <div className="space-y-2 pt-4 border-t border-slate-100 text-xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Included Modules ({formData.selectedFeatureIds.length} Features)
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
                      {allFeatures.map((feat) => {
                        const isIncluded = formData.selectedFeatureIds.includes(feat.id);
                        return (
                          <div
                            key={feat.id}
                            className={`flex items-center gap-2 ${
                              isIncluded ? 'text-slate-800' : 'text-slate-300 line-through'
                            }`}
                          >
                            {isIncluded ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                            )}
                            <span className="truncate">{feat.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'limits') setActiveTab('details');
                  else if (activeTab === 'features') setActiveTab('limits');
                  else if (activeTab === 'preview') setActiveTab('features');
                }}
                disabled={activeTab === 'details'}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold disabled:opacity-40"
              >
                Previous Step
              </button>

              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'details') setActiveTab('limits');
                  else if (activeTab === 'limits') setActiveTab('features');
                  else if (activeTab === 'features') setActiveTab('preview');
                }}
                disabled={activeTab === 'preview'}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold disabled:opacity-40"
              >
                Next Step
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all active:scale-95"
              >
                {saving ? 'Saving Plan...' : planToEdit ? 'Update Plan' : 'Create Plan'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
