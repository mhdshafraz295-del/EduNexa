import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import {
  apiRequest,
  fetchStudyMaterialPdfBlobUrl,
  fetchPurchaseReceiptBlobUrl,
  downloadStudyMaterialPdf,
} from '../../services/api';
import GlassCard from '../../components/common/GlassCard';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Eye,
  Download,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  FileText,
  Building,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Layers,
  Archive,
  Send,
  X,
  Upload,
  Check,
  CreditCard,
  User,
  Calendar,
} from 'lucide-react';

const LANGUAGE_CONFIG = {
  TAMIL: { label: 'தமிழ்', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ENGLISH: { label: 'English', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  SINHALA: { label: 'සිංහල', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export default function StudyMaterialsPage() {
  const { user } = useAuth();
  const { hasFeature } = useSubscription();

  // Navigation and active tab
  const [activeTab, setActiveTab] = useState('all'); // all, TAMIL, ENGLISH, SINHALA, FREE, PAID, DRAFT, PUBLISHED, ARCHIVED, payments, settings
  const [paymentSubTab, setPaymentSubTab] = useState('PENDING'); // PENDING, APPROVED, REJECTED, ALL

  // Data states
  const [materialsData, setMaterialsData] = useState({ total: 0, materials: [], page: 1, totalPages: 1 });
  const [paymentsData, setPaymentsData] = useState({ total: 0, payments: [], page: 1, totalPages: 1 });
  const [analytics, setAnalytics] = useState(null);
  const [classesList, setClassesList] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [bankSettings, setBankSettings] = useState({
    bankName: '',
    accountName: '',
    accountNumber: '',
    branchName: '',
    instructions: '',
    isEnabled: true,
  });

  // Filter and Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [pdfPreviewModal, setPdfPreviewModal] = useState({ open: false, url: null, title: '', loading: false });
  const [receiptPreviewModal, setReceiptPreviewModal] = useState({ open: false, url: null, payment: null, loading: false, isPdf: false });
  const [approveConfirmModal, setApproveConfirmModal] = useState({ open: false, payment: null, processing: false });
  const [rejectModal, setRejectModal] = useState({ open: false, payment: null, reason: '', processing: false });

  // Add/Edit Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    language: 'TAMIL',
    classId: '',
    subjectId: '',
    accessType: 'FREE',
    price: '',
    currency: 'LKR',
    status: 'PUBLISHED',
    previewEnabled: false,
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef(null);

  // Fetch Academic Classes & Subjects
  const fetchAcademicData = useCallback(async () => {
    try {
      const [classesRes, subjectsRes] = await Promise.all([
        apiRequest('/academic/classes').catch(() => ({ success: false, data: [] })),
        apiRequest('/academic/subjects').catch(() => ({ success: false, data: [] })),
      ]);
      if (classesRes.success) setClassesList(classesRes.data || []);
      if (subjectsRes.success) setSubjectsList(subjectsRes.data || []);
    } catch (err) {
      console.warn('Academic data lookup warning:', err);
    }
  }, []);

  // Fetch Bank Payment Settings
  const fetchBankSettings = useCallback(async () => {
    try {
      const res = await apiRequest('/study-materials/admin/payment-settings');
      if (res.success && res.data) {
        setBankSettings({
          bankName: res.data.bankName || '',
          accountName: res.data.accountName || '',
          accountNumber: res.data.accountNumber || '',
          branchName: res.data.branchName || '',
          instructions: res.data.instructions || '',
          isEnabled: res.data.isEnabled !== undefined ? res.data.isEnabled : true,
        });
      }
    } catch (err) {
      console.warn('Could not fetch bank settings:', err);
    }
  }, []);

  // Fetch Analytics & KPIs
  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await apiRequest('/study-materials/admin/analytics');
      if (res.success) {
        setAnalytics(res.data);
      }
    } catch (err) {
      console.warn('Analytics fetch error:', err);
    }
  }, []);

  // Fetch Materials List
  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedClassFilter) params.append('classId', selectedClassFilter);
      if (selectedSubjectFilter) params.append('subjectId', selectedSubjectFilter);

      // Tab mappings
      if (['TAMIL', 'ENGLISH', 'SINHALA'].includes(activeTab)) {
        params.append('language', activeTab);
      } else if (['FREE', 'PAID'].includes(activeTab)) {
        params.append('accessType', activeTab);
      } else if (['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(activeTab)) {
        params.append('status', activeTab);
      }

      const res = await apiRequest(`/study-materials/admin?${params.toString()}`);
      if (res.success) {
        setMaterialsData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load study materials.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, selectedClassFilter, selectedSubjectFilter]);

  // Fetch Payments List
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (paymentSubTab !== 'ALL') {
        params.append('status', paymentSubTab);
      }
      if (searchQuery) params.append('search', searchQuery);
      if (selectedClassFilter) params.append('classId', selectedClassFilter);

      const res = await apiRequest(`/study-materials/admin/payments?${params.toString()}`);
      if (res.success) {
        setPaymentsData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load payment transactions.');
    } finally {
      setLoading(false);
    }
  }, [paymentSubTab, searchQuery, selectedClassFilter]);

  // Main reload effect
  useEffect(() => {
    fetchAcademicData();
    fetchBankSettings();
    fetchAnalytics();
  }, [fetchAcademicData, fetchBankSettings, fetchAnalytics]);

  useEffect(() => {
    if (activeTab === 'payments') {
      fetchPayments();
    } else if (activeTab === 'settings') {
      fetchBankSettings();
    } else {
      fetchMaterials();
    }
  }, [activeTab, fetchMaterials, fetchPayments, fetchBankSettings]);

  // Filter subjects mapped to selected class in the form
  const availableFormSubjects = React.useMemo(() => {
    if (!formData.classId) return subjectsList;
    const cid = parseInt(formData.classId, 10);
    return subjectsList.filter((s) => s.classId === cid || s.classes?.some((c) => c.id === cid));
  }, [formData.classId, subjectsList]);

  // Handlers for Add/Edit Form
  const openAddModal = () => {
    setEditingMaterial(null);
    setFormData({
      title: '',
      description: '',
      language: 'TAMIL',
      classId: classesList[0]?.id ? String(classesList[0].id) : '',
      subjectId: '',
      accessType: 'FREE',
      price: '',
      currency: 'LKR',
      status: 'PUBLISHED',
      previewEnabled: false,
    });
    setSelectedFile(null);
    setFormError('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (material) => {
    setEditingMaterial(material);
    setFormData({
      title: material.title || '',
      description: material.description || '',
      language: material.language || 'TAMIL',
      classId: material.class?.id ? String(material.class.id) : '',
      subjectId: material.subject?.id ? String(material.subject.id) : '',
      accessType: material.accessType || 'FREE',
      price: material.price ? String(material.price) : '',
      currency: material.currency || 'LKR',
      status: material.status || 'PUBLISHED',
      previewEnabled: Boolean(material.previewEnabled),
    });
    setSelectedFile(null);
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError('');

    try {
      if (!formData.title.trim()) {
        throw new Error('Please enter a title for the study note.');
      }
      if (!formData.classId) {
        throw new Error('Please select a target class.');
      }
      if (formData.accessType === 'PAID') {
        const p = parseFloat(formData.price);
        if (isNaN(p) || p <= 0) {
          throw new Error('Please specify a valid price greater than 0 for paid notes.');
        }
        if (formData.status === 'PUBLISHED' && (!bankSettings.bankName || !bankSettings.accountNumber)) {
          throw new Error('You must configure Bank Payment Settings before publishing paid notes.');
        }
      }
      if (!editingMaterial && !selectedFile) {
        throw new Error('Please select a PDF file to upload.');
      }

      const postData = new FormData();
      postData.append('title', formData.title.trim());
      postData.append('description', formData.description ? formData.description.trim() : '');
      postData.append('language', formData.language);
      postData.append('classId', formData.classId);
      if (formData.subjectId) postData.append('subjectId', formData.subjectId);
      postData.append('accessType', formData.accessType);
      if (formData.accessType === 'PAID') {
        postData.append('price', formData.price);
      }
      postData.append('currency', formData.currency);
      postData.append('status', formData.status);
      postData.append('previewEnabled', formData.previewEnabled ? 'true' : 'false');
      if (selectedFile) {
        postData.append('pdfFile', selectedFile);
      }

      let res;
      if (editingMaterial) {
        res = await apiRequest(`/study-materials/admin/${editingMaterial.id}`, {
          method: 'PUT',
          body: postData,
        });
      } else {
        res = await apiRequest('/study-materials/admin', {
          method: 'POST',
          body: postData,
        });
      }

      if (res.success) {
        setSuccessMessage(res.message || 'Study material saved successfully!');
        setIsAddModalOpen(false);
        fetchMaterials();
        fetchAnalytics();
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (err) {
      setFormError(err.message || 'Failed to save study material.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Status Change (DRAFT, PUBLISHED, ARCHIVED)
  const handleStatusChange = async (materialId, newStatus) => {
    try {
      const res = await apiRequest(`/study-materials/admin/${materialId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.success) {
        setSuccessMessage(`Note status changed to ${newStatus}.`);
        fetchMaterials();
        fetchAnalytics();
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      setError(err.message || 'Failed to update note status.');
    }
  };

  // Safe Delete / Archive
  const handleDeleteMaterial = async (material) => {
    const confirmText = material.totalPurchases > 0
      ? `This note has ${material.totalPurchases} purchases. Deleting will ARCHIVE it to preserve transaction history. Proceed?`
      : `Are you sure you want to permanently delete "${material.title}"?`;

    if (!window.confirm(confirmText)) return;

    try {
      const res = await apiRequest(`/study-materials/admin/${material.id}`, {
        method: 'DELETE',
      });
      if (res.success) {
        setSuccessMessage(res.message || 'Material deleted successfully.');
        fetchMaterials();
        fetchAnalytics();
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      setError(err.message || 'Failed to delete material.');
    }
  };

  // Save Bank Settings
  const handleSaveBankSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!bankSettings.bankName.trim() || !bankSettings.accountName.trim() || !bankSettings.accountNumber.trim()) {
        throw new Error('Bank name, account holder, and account number are required.');
      }
      const res = await apiRequest('/study-materials/admin/payment-settings', {
        method: 'PUT',
        body: JSON.stringify(bankSettings),
      });
      if (res.success) {
        setSuccessMessage('Institute Bank Payment Settings saved successfully!');
        fetchBankSettings();
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (err) {
      setError(err.message || 'Failed to save bank settings.');
    } finally {
      setLoading(false);
    }
  };

  // Preview Protected PDF
  const handlePreviewPdf = async (material) => {
    setPdfPreviewModal({ open: true, url: null, title: material.title, loading: true });
    try {
      const blobUrl = await fetchStudyMaterialPdfBlobUrl(material.id, true);
      setPdfPreviewModal({ open: true, url: blobUrl, title: material.title, loading: false });
    } catch (err) {
      setError(err.message || 'Failed to load PDF preview.');
      setPdfPreviewModal({ open: false, url: null, title: '', loading: false });
    }
  };

  // Download Protected PDF
  const handleDownloadPdf = async (material) => {
    try {
      const filename = `${material.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      await downloadStudyMaterialPdf(material.id, filename, true);
    } catch (err) {
      setError(err.message || 'Failed to download PDF.');
    }
  };

  // View Receipt Modal
  const handleViewReceipt = async (payment) => {
    setReceiptPreviewModal({ open: true, url: null, payment, loading: true, isPdf: false });
    try {
      const blobUrl = await fetchPurchaseReceiptBlobUrl(payment.id);
      const isPdf = payment.receiptMimeType === 'application/pdf' || (payment.receiptOriginalName && payment.receiptOriginalName.toLowerCase().endsWith('.pdf'));
      setReceiptPreviewModal({ open: true, url: blobUrl, payment, loading: false, isPdf });
    } catch (err) {
      setError(err.message || 'Failed to load payment receipt.');
      setReceiptPreviewModal({ open: false, url: null, payment: null, loading: false, isPdf: false });
    }
  };

  // Execute Payment Approval
  const handleApprovePayment = async () => {
    if (!approveConfirmModal.payment) return;
    setApproveConfirmModal((prev) => ({ ...prev, processing: true }));
    try {
      const res = await apiRequest(`/study-materials/admin/payments/${approveConfirmModal.payment.id}/approve`, {
        method: 'POST',
      });
      if (res.success) {
        setSuccessMessage('Payment approved successfully! The student now has permanent access to this note.');
        setApproveConfirmModal({ open: false, payment: null, processing: false });
        fetchPayments();
        fetchAnalytics();
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (err) {
      setError(err.message || 'Failed to approve payment.');
      setApproveConfirmModal((prev) => ({ ...prev, processing: false }));
    }
  };

  // Execute Payment Rejection
  const handleRejectPayment = async () => {
    if (!rejectModal.payment || !rejectModal.reason.trim()) {
      setError('Please provide a reason for rejecting the receipt.');
      return;
    }
    setRejectModal((prev) => ({ ...prev, processing: true }));
    try {
      const res = await apiRequest(`/study-materials/admin/payments/${rejectModal.payment.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ rejectionReason: rejectModal.reason.trim() }),
      });
      if (res.success) {
        setSuccessMessage('Payment rejected. The student has been notified to re-upload.');
        setRejectModal({ open: false, payment: null, reason: '', processing: false });
        fetchPayments();
        fetchAnalytics();
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (err) {
      setError(err.message || 'Failed to reject payment.');
      setRejectModal((prev) => ({ ...prev, processing: false }));
    }
  };

  const kpis = analytics?.kpis || {};

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 px-3 sm:px-6">
      {/* Top Header Banner */}
      <GlassCard className="p-6 md:p-8 bg-gradient-to-r from-amber-500/10 via-white/80 to-amber-200/20 border-amber-200/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-800 mb-1">
              <BookOpen className="w-4 h-4 text-amber-600" />
              <span>EduNexa Multi-Language Learning Materials</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Study Notes & Tutes
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Distribute and sell digital PDF notes across <strong className="text-emerald-700">தமிழ் (Tamil)</strong>, <strong className="text-blue-700">English</strong>, and <strong className="text-purple-700">සිංහල (Sinhala)</strong> with bank transfer receipt verification.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                fetchAnalytics();
                if (activeTab === 'payments') fetchPayments();
                else fetchMaterials();
              }}
              className="p-2.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-2xl shadow-xs transition-all active:scale-95"
              title="Refresh Workspace"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs md:text-sm font-bold border transition-all ${
                activeTab === 'settings'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200 shadow-xs'
              }`}
            >
              <Building className="w-4 h-4 text-amber-500" />
              <span>Payment Settings</span>
            </button>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs md:text-sm font-black bg-[#FFD978] text-slate-900 hover:bg-[#F2CD6A] border border-[#E6BC50] shadow-sm transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Note / Tute</span>
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Notifications / Alerts */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-500 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Real DB Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <GlassCard className="p-4 bg-white/90">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Notes</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{kpis.totalNotes ?? 0}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">{kpis.publishedNotes ?? 0} published</span>
        </GlassCard>

        <GlassCard className="p-4 bg-emerald-50/50 border-emerald-200/60">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">தமிழ் (Tamil)</span>
          <span className="text-2xl font-black text-emerald-900 mt-1 block">{kpis.tamilNotes ?? 0}</span>
          <span className="text-[10px] text-emerald-600 mt-0.5 block">Tamil section</span>
        </GlassCard>

        <GlassCard className="p-4 bg-blue-50/50 border-blue-200/60">
          <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">English</span>
          <span className="text-2xl font-black text-blue-900 mt-1 block">{kpis.englishNotes ?? 0}</span>
          <span className="text-[10px] text-blue-600 mt-0.5 block">English section</span>
        </GlassCard>

        <GlassCard className="p-4 bg-purple-50/50 border-purple-200/60">
          <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider block">සිංහල (Sinhala)</span>
          <span className="text-2xl font-black text-purple-900 mt-1 block">{kpis.sinhalaNotes ?? 0}</span>
          <span className="text-[10px] text-purple-600 mt-0.5 block">Sinhala section</span>
        </GlassCard>

        <GlassCard className="p-4 bg-amber-50/50 border-amber-200/60">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Pending Receipts</span>
          <span className="text-2xl font-black text-amber-900 mt-1 block">{kpis.pendingPayments ?? 0}</span>
          <button
            onClick={() => {
              setActiveTab('payments');
              setPaymentSubTab('PENDING');
            }}
            className="text-[10px] text-amber-700 font-bold hover:underline mt-0.5 flex items-center gap-0.5"
          >
            <span>Review now</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </GlassCard>

        <GlassCard className="p-4 bg-slate-900 text-white border-slate-800">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">Notes Revenue</span>
          <span className="text-xl font-black text-white mt-1 block truncate">
            LKR {parseFloat(kpis.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-300 mt-0.5 block">{kpis.approvedPurchases ?? 0} approved sales</span>
        </GlassCard>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 text-xs md:text-sm font-bold">
        {[
          { key: 'all', label: 'All Notes' },
          { key: 'TAMIL', label: 'தமிழ் (Tamil)', badge: kpis.tamilNotes },
          { key: 'ENGLISH', label: 'English', badge: kpis.englishNotes },
          { key: 'SINHALA', label: 'සිංහල (Sinhala)', badge: kpis.sinhalaNotes },
          { key: 'FREE', label: 'Free Notes' },
          { key: 'PAID', label: 'Paid Notes' },
          { key: 'DRAFT', label: 'Drafts' },
          { key: 'ARCHIVED', label: 'Archived' },
          {
            key: 'payments',
            label: 'Note Payments',
            badge: kpis.pendingPayments > 0 ? `${kpis.pendingPayments} pending` : null,
            badgeClass: 'bg-amber-500 text-white',
          },
          { key: 'settings', label: 'Bank Payment Settings' },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#FFD978] text-slate-900 shadow-xs border border-[#E6BC50]'
                  : 'bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900 border border-slate-200/80'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                    tab.badgeClass || (isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700')
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* 1. NOTES MANAGEMENT TABLE VIEW                             */}
      {/* ========================================================= */}
      {activeTab !== 'payments' && activeTab !== 'settings' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <GlassCard className="p-4 bg-white/90">
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, subject, or class..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="px-3 py-2 text-xs md:text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">All Classes</option>
                  {classesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.section ? `(${c.section})` : ''}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="px-3 py-2 text-xs md:text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">All Subjects</option>
                  {subjectsList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </GlassCard>

          {/* Table of Notes */}
          <GlassCard className="overflow-hidden bg-white/90 p-0 border border-slate-200/80">
            {loading ? (
              <div className="py-16 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                <span>Loading study materials...</span>
              </div>
            ) : materialsData.materials.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">No study notes found.</p>
                <p className="text-xs text-slate-400 mt-1">
                  {activeTab === 'TAMIL'
                    ? 'No Tamil notes are available.'
                    : activeTab === 'ENGLISH'
                    ? 'No English notes are available.'
                    : activeTab === 'SINHALA'
                    ? 'No Sinhala notes are available.'
                    : 'Get started by creating your first study material.'}
                </p>
                <button
                  onClick={openAddModal}
                  className="mt-4 px-4 py-2 bg-[#FFD978] text-slate-900 font-bold rounded-xl text-xs hover:bg-[#F2CD6A]"
                >
                  + Add New Note
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs md:text-sm">
                  <thead className="bg-slate-50/90 text-slate-600 font-bold uppercase text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Language</th>
                      <th className="px-4 py-3">Material Title</th>
                      <th className="px-4 py-3">Class & Subject</th>
                      <th className="px-4 py-3">Access & Price</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Purchases</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {materialsData.materials.map((m) => {
                      const langConfig = LANGUAGE_CONFIG[m.language] || { label: m.language, badge: 'bg-slate-100 text-slate-700' };
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Language */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${langConfig.badge}`}>
                              {langConfig.label}
                            </span>
                          </td>

                          {/* Title */}
                          <td className="px-4 py-3.5 max-w-xs">
                            <div className="font-bold text-slate-900 truncate">{m.title}</div>
                            {m.description && (
                              <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{m.description}</div>
                            )}
                            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                              <span>{(m.fileSize / (1024 * 1024)).toFixed(2)} MB PDF</span>
                              <span>•</span>
                              <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                            </div>
                          </td>

                          {/* Class & Subject */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="font-semibold text-slate-800">
                              {m.class?.name} {m.class?.section ? `(${m.class.section})` : ''}
                            </div>
                            <div className="text-xs text-slate-500">
                              {m.subject?.name || 'General Class Material'}
                            </div>
                          </td>

                          {/* Access Type & Price */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {m.accessType === 'FREE' ? (
                              <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-xs font-black">
                                FREE
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 text-xs font-black">
                                {m.currency} {parseFloat(m.price || 0).toFixed(2)}
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <select
                              value={m.status}
                              onChange={(e) => handleStatusChange(m.id, e.target.value)}
                              className={`text-xs font-bold rounded-lg px-2.5 py-1 border focus:outline-none ${
                                m.status === 'PUBLISHED'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : m.status === 'DRAFT'
                                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              <option value="PUBLISHED">Published</option>
                              <option value="DRAFT">Draft</option>
                              <option value="ARCHIVED">Archived</option>
                            </select>
                          </td>

                          {/* Purchases */}
                          <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs font-bold text-slate-600">
                            {m.totalPurchases || 0} sales
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-right space-x-1">
                            <button
                              onClick={() => handlePreviewPdf(m)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-all"
                              title="Preview PDF"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDownloadPdf(m)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-all"
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditModal(m)}
                              className="p-1.5 text-blue-600 hover:text-blue-900 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg transition-all"
                              title="Edit Note"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMaterial(m)}
                              className="p-1.5 text-rose-600 hover:text-rose-900 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg transition-all"
                              title="Delete or Archive Note"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. NOTE PAYMENTS & RECEIPT VERIFICATION WORKSPACE          */}
      {/* ========================================================= */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          {/* Sub tabs: Pending, Approved, Rejected, All */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {[
                { key: 'PENDING', label: 'Pending Verification', badge: kpis.pendingPayments },
                { key: 'APPROVED', label: 'Approved Purchases', badge: kpis.approvedPurchases },
                { key: 'REJECTED', label: 'Rejected Receipts', badge: kpis.rejectedPayments },
                { key: 'ALL', label: 'All Transactions' },
              ].map((st) => (
                <button
                  key={st.key}
                  onClick={() => setPaymentSubTab(st.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold border transition-all ${
                    paymentSubTab === st.key
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <span>{st.label}</span>
                  {st.badge !== undefined && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                        paymentSubTab === st.key ? 'bg-amber-400 text-slate-900' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {st.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student or note..."
                className="w-full pl-9 pr-4 py-1.5 text-xs md:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Payments Table */}
          <GlassCard className="overflow-hidden bg-white/90 p-0 border border-slate-200/80">
            {loading ? (
              <div className="py-16 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                <span>Loading payments...</span>
              </div>
            ) : paymentsData.payments.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">No payment transactions found.</p>
                <p className="text-xs text-slate-400 mt-1">
                  {paymentSubTab === 'PENDING'
                    ? 'No pending note payments awaiting review.'
                    : 'No payment records match the current filter.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs md:text-sm">
                  <thead className="bg-slate-50/90 text-slate-600 font-bold uppercase text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Admission / Roll</th>
                      <th className="px-4 py-3">Study Note</th>
                      <th className="px-4 py-3">Language</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Receipt</th>
                      <th className="px-4 py-3">Submitted At</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {paymentsData.payments.map((p) => {
                      const langConfig = LANGUAGE_CONFIG[p.material?.language] || { label: p.material?.language, badge: 'bg-slate-100 text-slate-700' };
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Student */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="font-bold text-slate-900">{p.student.name}</div>
                            <div className="text-[10px] text-slate-400">@{p.student.username}</div>
                          </td>

                          {/* Admission No */}
                          <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-slate-600">
                            {p.student.admissionNumber || p.student.rollNo || 'N/A'}
                          </td>

                          {/* Note Title & Class */}
                          <td className="px-4 py-3.5 max-w-xs">
                            <div className="font-bold text-slate-900 truncate">{p.material.title}</div>
                            <div className="text-[11px] text-slate-500">{p.material.class?.name}</div>
                          </td>

                          {/* Language */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${langConfig.badge}`}>
                              {langConfig.label}
                            </span>
                          </td>

                          {/* Amount */}
                          <td className="px-4 py-3.5 whitespace-nowrap font-mono font-bold text-slate-900">
                            {p.currency} {parseFloat(p.amount).toFixed(2)}
                          </td>

                          {/* Receipt */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {p.hasReceipt ? (
                              <button
                                onClick={() => handleViewReceipt(p)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs font-bold transition-all"
                              >
                                <Eye className="w-3.5 h-3.5 text-amber-700" />
                                <span>View Receipt</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-xs">No file</span>
                            )}
                          </td>

                          {/* Date */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500">
                            {new Date(p.receiptUploadedAt || p.createdAt).toLocaleString()}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-black ${
                                p.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : p.status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-900 animate-pulse'
                              }`}
                            >
                              {p.status}
                            </span>
                            {p.rejectionReason && (
                              <p className="text-[10px] text-rose-600 mt-1 max-w-xs truncate" title={p.rejectionReason}>
                                Reason: {p.rejectionReason}
                              </p>
                            )}
                          </td>

                          {/* Review Actions */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-right space-x-1.5">
                            {p.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => setApproveConfirmModal({ open: true, payment: p, processing: false })}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all active:scale-95"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => setRejectModal({ open: true, payment: p, reason: '', processing: false })}
                                  className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all active:scale-95"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {p.status === 'APPROVED' && (
                              <span className="text-xs text-emerald-700 font-bold flex items-center justify-end gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approved</span>
                              </span>
                            )}
                            {p.status === 'REJECTED' && (
                              <span className="text-xs text-rose-700 font-bold flex items-center justify-end gap-1">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Rejected</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. INSTITUTE BANK PAYMENT SETTINGS TAB                     */}
      {/* ========================================================= */}
      {activeTab === 'settings' && (
        <GlassCard className="p-6 md:p-8 bg-white/90 max-w-3xl mx-auto space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-800 mb-1">
              <Building className="w-4 h-4 text-amber-600" />
              <span>Institute Bank Account Configuration</span>
            </div>
            <h2 className="text-xl font-black text-slate-900">
              Student Note Bank Transfer Settings
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              These official bank account details are presented to students when purchasing paid notes. Students transfer money via online banking/ATM and submit the slip.
            </p>
          </div>

          <form onSubmit={handleSaveBankSettings} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Bank Name *
                </label>
                <input
                  type="text"
                  required
                  value={bankSettings.bankName}
                  onChange={(e) => setBankSettings({ ...bankSettings, bankName: e.target.value })}
                  placeholder="e.g. Commercial Bank of Ceylon / Bank of Ceylon"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Account Holder Name *
                </label>
                <input
                  type="text"
                  required
                  value={bankSettings.accountName}
                  onChange={(e) => setBankSettings({ ...bankSettings, accountName: e.target.value })}
                  placeholder="e.g. IEC Education Center (Pvt) Ltd"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Account Number *
                </label>
                <input
                  type="text"
                  required
                  value={bankSettings.accountNumber}
                  onChange={(e) => setBankSettings({ ...bankSettings, accountNumber: e.target.value })}
                  placeholder="e.g. 100012345678"
                  className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={bankSettings.branchName}
                  onChange={(e) => setBankSettings({ ...bankSettings, branchName: e.target.value })}
                  placeholder="e.g. Colombo City Branch"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Payment Instructions (Shown to Students)
              </label>
              <textarea
                rows={3}
                value={bankSettings.instructions}
                onChange={(e) => setBankSettings({ ...bankSettings, instructions: e.target.value })}
                placeholder="e.g. Please put your Student Name and Admission Number in the transfer remarks/reference."
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="flex items-center gap-3 p-3 bg-amber-50/60 rounded-xl border border-amber-200/60">
              <input
                type="checkbox"
                id="enableBankPayments"
                checked={bankSettings.isEnabled}
                onChange={(e) => setBankSettings({ ...bankSettings, isEnabled: e.target.checked })}
                className="w-4 h-4 text-amber-600 rounded focus:ring-amber-400"
              />
              <label htmlFor="enableBankPayments" className="text-xs font-bold text-slate-800 cursor-pointer">
                Enable Bank Transfer Payments for Paid Study Materials
              </label>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-[#FFD978] hover:bg-[#F2CD6A] text-slate-900 font-black rounded-xl text-sm border border-[#E6BC50] shadow-sm transition-all"
              >
                Save Bank Settings
              </button>
            </div>
          </form>
        </GlassCard>
      )}

      {/* ========================================================= */}
      {/* 4. ADD / EDIT NOTE MODAL                                  */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <GlassCard className="w-full max-w-2xl bg-white p-6 md:p-8 rounded-3xl shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingMaterial ? 'Edit Study Note / Tute' : 'Upload New Study Note / Tute'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Distribute learning materials in Tamil, English, or Sinhala
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium mt-4">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4 mt-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Material Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Grade 10 Tamil Grammar Complete Revision Tute"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description / Topic Notes
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Summary of topics covered, unit details..."
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* Language Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Language Section *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'TAMIL', label: 'தமிழ் (Tamil)', color: 'border-emerald-300 bg-emerald-50/60 text-emerald-800' },
                    { key: 'ENGLISH', label: 'English', color: 'border-blue-300 bg-blue-50/60 text-blue-800' },
                    { key: 'SINHALA', label: 'සිංහල (Sinhala)', color: 'border-purple-300 bg-purple-50/60 text-purple-800' },
                  ].map((lang) => (
                    <button
                      type="button"
                      key={lang.key}
                      onClick={() => setFormData({ ...formData, language: lang.key })}
                      className={`py-2 px-3 rounded-xl border text-xs font-black transition-all ${
                        formData.language === lang.key
                          ? `${lang.color} ring-2 ring-amber-400 shadow-xs`
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Class & Subject Cascading */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Target Class / Batch *
                  </label>
                  <select
                    required
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value, subjectId: '' })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">-- Select Class --</option>
                    {classesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.section ? `(${c.section})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Subject (Optional)
                  </label>
                  <select
                    value={formData.subjectId}
                    onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">-- General / All Class Subjects --</option>
                    {availableFormSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Access Type & Price */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Access Type *
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, accessType: 'FREE' })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        formData.accessType === 'FREE'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      FREE NOTE
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, accessType: 'PAID' })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        formData.accessType === 'PAID'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      PAID / PREMIUM
                    </button>
                  </div>
                </div>

                {formData.accessType === 'PAID' && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Price Amount *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        required
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="750.00"
                        className="w-full px-3 py-1.5 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Currency
                      </label>
                      <input
                        type="text"
                        disabled
                        value="LKR"
                        className="w-full px-3 py-1.5 text-sm font-mono bg-slate-100 border border-slate-200 rounded-xl text-slate-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* PDF File Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  PDF File * {editingMaterial && '(Select only if replacing existing PDF)'}
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-amber-400 bg-slate-50/60 hover:bg-amber-50/30 rounded-2xl p-4 text-center cursor-pointer transition-colors"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="application/pdf,.pdf"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                    }}
                    className="hidden"
                  />
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  {selectedFile ? (
                    <div>
                      <p className="text-xs font-bold text-slate-800">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB PDF selected
                      </p>
                    </div>
                  ) : editingMaterial ? (
                    <div>
                      <p className="text-xs font-semibold text-slate-700">
                        Current: {editingMaterial.originalFileName}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Click to upload a replacement PDF</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Click to choose PDF note</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Maximum size: 25MB (application/pdf)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Publish or Draft Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={formSubmitting}
                  onClick={(e) => {
                    setFormData((prev) => ({ ...prev, status: 'DRAFT' }));
                    setTimeout(() => handleFormSubmit(e), 50);
                  }}
                  className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                >
                  Save as Draft
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  onClick={() => setFormData((prev) => ({ ...prev, status: 'PUBLISHED' }))}
                  className="px-5 py-2 text-xs font-black bg-[#FFD978] hover:bg-[#F2CD6A] text-slate-900 border border-[#E6BC50] rounded-xl shadow-xs"
                >
                  {formSubmitting ? 'Processing...' : 'Publish Note'}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. PDF PREVIEW MODAL                                      */}
      {/* ========================================================= */}
      {pdfPreviewModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="w-full max-w-5xl h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900 truncate max-w-md">
                  {pdfPreviewModal.title}
                </h3>
              </div>
              <button
                onClick={() => setPdfPreviewModal({ open: false, url: null, title: '', loading: false })}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 relative">
              {pdfPreviewModal.loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              ) : pdfPreviewModal.url ? (
                <iframe
                  src={pdfPreviewModal.url}
                  title="PDF Preview"
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                  Failed to load PDF content.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. RECEIPT PREVIEW LIGHTBOX MODAL                         */}
      {/* ========================================================= */}
      {receiptPreviewModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Payment Receipt Verification
                </h3>
                <p className="text-xs text-slate-500">
                  Student: <strong>{receiptPreviewModal.payment?.student?.name}</strong> • Amount: <strong>{receiptPreviewModal.payment?.currency} {receiptPreviewModal.payment?.amount}</strong>
                </p>
              </div>
              <button
                onClick={() => setReceiptPreviewModal({ open: false, url: null, payment: null, loading: false, isPdf: false })}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-4 bg-slate-100 overflow-auto flex items-center justify-center min-h-[300px]">
              {receiptPreviewModal.loading ? (
                <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
              ) : receiptPreviewModal.isPdf ? (
                <iframe src={receiptPreviewModal.url} className="w-full h-96 border-0" title="Receipt PDF" />
              ) : (
                <img
                  src={receiptPreviewModal.url}
                  alt="Receipt Preview"
                  className="max-h-[60vh] object-contain rounded-xl shadow-xs"
                />
              )}
            </div>

            {receiptPreviewModal.payment?.status === 'PENDING' && (
              <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    const p = receiptPreviewModal.payment;
                    setReceiptPreviewModal({ open: false, url: null, payment: null, loading: false, isPdf: false });
                    setRejectModal({ open: true, payment: p, reason: '', processing: false });
                  }}
                  className="px-4 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl"
                >
                  Reject Receipt
                </button>
                <button
                  onClick={() => {
                    const p = receiptPreviewModal.payment;
                    setReceiptPreviewModal({ open: false, url: null, payment: null, loading: false, isPdf: false });
                    setApproveConfirmModal({ open: true, payment: p, processing: false });
                  }}
                  className="px-5 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
                >
                  Approve Payment
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. APPROVAL CONFIRMATION MODAL                            */}
      {/* ========================================================= */}
      {approveConfirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <GlassCard className="w-full max-w-md bg-white p-6 rounded-3xl shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <CheckCircle2 className="w-8 h-8 flex-shrink-0" />
              <div>
                <h3 className="text-base font-black text-slate-900">Approve Note Payment?</h3>
                <p className="text-xs text-slate-500">Student will permanently unlock this note.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Student:</span>
                <strong className="text-slate-800">{approveConfirmModal.payment?.student?.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Material:</span>
                <strong className="text-slate-800">{approveConfirmModal.payment?.material?.title}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <strong className="text-emerald-700 font-mono">
                  {approveConfirmModal.payment?.currency} {approveConfirmModal.payment?.amount}
                </strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={approveConfirmModal.processing}
                onClick={() => setApproveConfirmModal({ open: false, payment: null, processing: false })}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={approveConfirmModal.processing}
                onClick={handleApprovePayment}
                className="px-5 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
              >
                {approveConfirmModal.processing ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. REJECT PAYMENT MODAL                                   */}
      {/* ========================================================= */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <GlassCard className="w-full max-w-md bg-white p-6 rounded-3xl shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <XCircle className="w-8 h-8 flex-shrink-0" />
              <div>
                <h3 className="text-base font-black text-slate-900">Reject Note Payment</h3>
                <p className="text-xs text-slate-500">Please provide a reason for the student.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Rejection Reason *
              </label>
              <textarea
                rows={3}
                required
                value={rejectModal.reason}
                onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                placeholder="e.g. Bank receipt image is unclear / transaction reference does not match institute records."
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={rejectModal.processing}
                onClick={() => setRejectModal({ open: false, payment: null, reason: '', processing: false })}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectModal.processing || !rejectModal.reason.trim()}
                onClick={handleRejectPayment}
                className="px-5 py-2 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs"
              >
                {rejectModal.processing ? 'Rejecting...' : 'Reject Payment'}
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
