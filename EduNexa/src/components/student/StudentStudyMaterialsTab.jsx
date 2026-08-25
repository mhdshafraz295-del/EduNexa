import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  apiRequest,
  fetchStudyMaterialPdfBlobUrl,
  downloadStudyMaterialPdf,
} from '../../services/api';
import GlassCard from '../common/GlassCard';
import {
  BookOpen,
  Search,
  Eye,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  Lock,
  Unlock,
  Building,
  Camera,
  Image as ImageIcon,
  Upload,
  RefreshCw,
  AlertTriangle,
  X,
  FileText,
  CreditCard,
  History,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

const LANGUAGE_CONFIG = {
  TAMIL: { label: 'தமிழ்', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ENGLISH: { label: 'English', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  SINHALA: { label: 'සිංහල', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export default function StudentStudyMaterialsTab({ student, institute }) {
  // Navigation & Filter States
  const [selectedLanguage, setSelectedLanguage] = useState('ALL'); // ALL, TAMIL, ENGLISH, SINHALA
  const [filterType, setFilterType] = useState('ALL'); // ALL, FREE, PAID, PURCHASED, PENDING
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  // Data States
  const [materials, setMaterials] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modals
  const [purchaseModal, setPurchaseModal] = useState({ open: false, material: null, details: null, loadingDetails: false });
  const [purchasesHistoryOpen, setPurchasesHistoryOpen] = useState(false);
  const [pdfModal, setPdfModal] = useState({ open: false, url: null, title: '', loading: false });

  // Receipt Upload Form State
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState(null);
  const [submittingReceipt, setSubmittingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState('');

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Fetch materials for eligible student
  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedLanguage !== 'ALL') {
        params.append('language', selectedLanguage);
      }
      if (filterType === 'FREE') params.append('accessType', 'FREE');
      if (filterType === 'PAID') params.append('accessType', 'PAID');
      if (filterType === 'PURCHASED') params.append('purchaseFilter', 'PURCHASED');
      if (filterType === 'PENDING') params.append('purchaseFilter', 'PENDING');
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedSubject) params.append('subjectId', selectedSubject);

      const res = await apiRequest(`/study-materials/my?${params.toString()}`);
      if (res.success) {
        setMaterials(res.data?.materials || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load study notes.');
    } finally {
      setLoading(false);
    }
  }, [selectedLanguage, filterType, searchQuery, selectedSubject]);

  // Fetch student purchase history
  const fetchPurchases = useCallback(async () => {
    try {
      const res = await apiRequest('/study-materials/my/purchases');
      if (res.success) {
        setPurchases(res.data?.purchases || []);
      }
    } catch (err) {
      console.warn('Purchases history fetch warning:', err);
    }
  }, []);

  useEffect(() => {
    fetchMaterials();
    fetchPurchases();
  }, [fetchMaterials, fetchPurchases]);

  // Collect unique subjects from materials for dropdown filter
  const availableSubjects = React.useMemo(() => {
    const map = new Map();
    materials.forEach((m) => {
      if (m.subject?.id) {
        map.set(m.subject.id, m.subject);
      }
    });
    return Array.from(map.values());
  }, [materials]);

  // Open Buy & Unlock Modal
  const openBuyModal = async (material) => {
    setPurchaseModal({ open: true, material, details: null, loadingDetails: true });
    setReceiptFile(null);
    setReceiptPreviewUrl(null);
    setReceiptError('');

    try {
      const res = await apiRequest(`/study-materials/${material.id}`);
      if (res.success) {
        setPurchaseModal({ open: true, material, details: res.data, loadingDetails: false });
      }
    } catch (err) {
      setReceiptError(err.message || 'Failed to load purchase instructions.');
      setPurchaseModal((prev) => ({ ...prev, loadingDetails: false }));
    }
  };

  // Handle Receipt File Selection
  const handleFileSelect = (file) => {
    if (!file) return;
    setReceiptError('');
    setReceiptFile(file);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setReceiptPreviewUrl(url);
    } else {
      setReceiptPreviewUrl(null);
    }
  };

  // Submit Receipt Purchase Form
  const handleSubmitReceipt = async (e) => {
    e.preventDefault();
    if (!receiptFile) {
      setReceiptError('Please select or capture a payment receipt slip.');
      return;
    }

    setSubmittingReceipt(true);
    setReceiptError('');

    try {
      const formData = new FormData();
      formData.append('receiptFile', receiptFile);

      const res = await apiRequest(`/study-materials/${purchaseModal.material.id}/purchase`, {
        method: 'POST',
        body: formData,
      });

      if (res.success) {
        setSuccessMessage('Payment receipt submitted successfully! Your institute administrator will verify and unlock this note.');
        setPurchaseModal({ open: false, material: null, details: null, loadingDetails: false });
        setReceiptFile(null);
        setReceiptPreviewUrl(null);
        fetchMaterials();
        fetchPurchases();
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (err) {
      setReceiptError(err.message || 'Failed to submit payment receipt.');
    } finally {
      setSubmittingReceipt(false);
    }
  };

  // Open In-App PDF Viewer
  const handleViewPdf = async (material) => {
    setPdfModal({ open: true, url: null, title: material.title, loading: true });
    try {
      const blobUrl = await fetchStudyMaterialPdfBlobUrl(material.id);
      setPdfModal({ open: true, url: blobUrl, title: material.title, loading: false });
    } catch (err) {
      setError(err.message || 'Failed to load study note PDF.');
      setPdfModal({ open: false, url: null, title: '', loading: false });
    }
  };

  // Safe Download PDF
  const handleDownload = async (material) => {
    try {
      const safeFilename = `${material.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      await downloadStudyMaterialPdf(material.id, safeFilename);
    } catch (err) {
      setError(err.message || 'Failed to download study note.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <GlassCard className="p-6 bg-gradient-to-r from-amber-500/10 via-white/90 to-amber-200/20 border-amber-200/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-800 mb-1">
              <BookOpen className="w-4 h-4 text-amber-600" />
              <span>Digital Study Notes & Tutes Hub</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900">
              Study Notes & Learning Materials
            </h2>
            <p className="text-xs md:text-sm text-slate-600 mt-1 max-w-xl">
              Access digital PDF notes, unit revisions, and tutes in <strong className="text-emerald-700">தமிழ்</strong>, <strong className="text-blue-700">English</strong>, and <strong className="text-purple-700">සිංහල</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchMaterials();
                fetchPurchases();
              }}
              className="p-2.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-all active:scale-95"
              title="Refresh Notes"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setPurchasesHistoryOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold shadow-xs transition-all"
            >
              <History className="w-4 h-4 text-amber-600" />
              <span>My Purchases ({purchases.length})</span>
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Notifications */}
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

      {/* 1. PRIMARY LANGUAGE FILTER PILLS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs md:text-sm font-bold">
        <span className="text-slate-400 uppercase text-[11px] font-black mr-1 hidden sm:inline">Language:</span>
        {[
          { key: 'ALL', label: 'All Languages' },
          { key: 'TAMIL', label: 'தமிழ் (Tamil)', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
          { key: 'ENGLISH', label: 'English', badge: 'bg-blue-50 text-blue-800 border-blue-200' },
          { key: 'SINHALA', label: 'සිංහල (Sinhala)', badge: 'bg-purple-50 text-purple-800 border-purple-200' },
        ].map((lang) => {
          const isSelected = selectedLanguage === lang.key;
          return (
            <button
              key={lang.key}
              onClick={() => setSelectedLanguage(lang.key)}
              className={`px-4 py-2 rounded-xl font-black transition-all whitespace-nowrap border ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
            >
              {lang.label}
            </button>
          );
        })}
      </div>

      {/* 2. SUB-FILTERS & SEARCH BAR */}
      <GlassCard className="p-4 bg-white/90">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Sub Filters: All, Free, Paid, Purchased, Pending */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {[
              { key: 'ALL', label: 'All Notes' },
              { key: 'FREE', label: 'Free' },
              { key: 'PAID', label: 'Paid' },
              { key: 'PURCHASED', label: 'Unlocked' },
              { key: 'PENDING', label: 'Pending Verification' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterType(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  filterType === f.key
                    ? 'bg-[#FFD978] text-slate-900 border border-[#E6BC50] shadow-xs'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search & Subject Filters */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="w-full pl-9 pr-3 py-1.5 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            {availableSubjects.length > 0 && (
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              >
                <option value="">All Subjects</option>
                {availableSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </GlassCard>

      {/* 3. STUDY MATERIAL CARDS GRID */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
          <span>Loading study notes...</span>
        </div>
      ) : materials.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-sm bg-white/60 rounded-3xl border border-slate-200/60 p-8">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="font-bold text-slate-700 text-base">No study materials available.</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {selectedLanguage === 'TAMIL'
              ? 'No Tamil notes are currently available for your enrolled classes.'
              : selectedLanguage === 'ENGLISH'
              ? 'No English notes are currently available for your enrolled classes.'
              : selectedLanguage === 'SINHALA'
              ? 'No Sinhala notes are currently available for your enrolled classes.'
              : 'Your teachers and institute administrators have not published notes for your classes yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map((m) => {
            const langConfig = LANGUAGE_CONFIG[m.language] || { label: m.language, badge: 'bg-slate-100 text-slate-700' };
            const isFree = m.accessType === 'FREE';
            const isApproved = m.purchaseStatus === 'APPROVED';
            const isPending = m.purchaseStatus === 'PENDING';
            const isRejected = m.purchaseStatus === 'REJECTED';
            const isUnlocked = isFree || isApproved;

            return (
              <GlassCard
                key={m.id}
                className="p-5 flex flex-col justify-between bg-white/90 hover:shadow-md transition-all border-slate-200/80 rounded-2xl space-y-4"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black border ${langConfig.badge}`}>
                      {langConfig.label}
                    </span>

                    {isFree ? (
                      <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black">
                        FREE NOTE
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-black font-mono">
                        {m.currency} {parseFloat(m.price || 0).toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div className="mt-3">
                    <h3 className="font-bold text-slate-900 text-base line-clamp-2 leading-snug">
                      {m.title}
                    </h3>
                    {m.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{m.description}</p>
                    )}
                  </div>

                  {/* Academic Context Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                      {m.class?.name}
                    </span>
                    {m.subject && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        {m.subject.name}
                      </span>
                    )}
                    <span className="text-slate-400 text-[10px] ml-auto">
                      {(m.fileSize / (1024 * 1024)).toFixed(2)} MB PDF
                    </span>
                  </div>
                </div>

                {/* Bottom Access Status & Action Buttons */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  {/* State 1: Free or Approved Unlocked Note */}
                  {isUnlocked && (
                    <div>
                      {isApproved && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold mb-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Purchased & Unlocked</span>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleViewPdf(m)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View PDF</span>
                        </button>
                        <button
                          onClick={() => handleDownload(m)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* State 2: Paid Locked Note */}
                  {!isUnlocked && !isPending && !isRejected && (
                    <button
                      onClick={() => openBuyModal(m)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FFD978] hover:bg-[#F2CD6A] text-slate-900 border border-[#E6BC50] rounded-xl text-xs font-black shadow-xs transition-all active:scale-95"
                    >
                      <Lock className="w-4 h-4 text-amber-800" />
                      <span>Buy & Unlock • {m.currency} {parseFloat(m.price || 0).toFixed(2)}</span>
                    </button>
                  )}

                  {/* State 3: Payment Verification Pending */}
                  {isPending && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center space-y-2">
                      <div className="flex items-center justify-center gap-1 text-xs text-amber-900 font-bold">
                        <Clock className="w-3.5 h-3.5 text-amber-700 animate-spin" />
                        <span>Payment Verification Pending</span>
                      </div>
                      <p className="text-[10px] text-amber-800 leading-tight">
                        Your receipt is being reviewed by the institute.
                      </p>
                      <button
                        onClick={() => openBuyModal(m)}
                        className="text-[11px] text-amber-900 font-bold hover:underline"
                      >
                        Replace / Re-upload Receipt
                      </button>
                    </div>
                  )}

                  {/* State 4: Payment Rejected */}
                  {isRejected && (
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs text-rose-800 font-bold">
                        <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                        <span>Payment Rejected</span>
                      </div>
                      {m.rejectionReason && (
                        <p className="text-[11px] text-rose-700">
                          <strong>Reason:</strong> {m.rejectionReason}
                        </p>
                      )}
                      <button
                        onClick={() => openBuyModal(m)}
                        className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all"
                      >
                        Upload New Receipt
                      </button>
                    </div>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. BUY & UNLOCK MODAL (BANK TRANSFER + RECEIPT UPLOAD)     */}
      {/* ========================================================= */}
      {purchaseModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <GlassCard className="w-full max-w-lg bg-white p-6 md:p-8 rounded-3xl shadow-2xl my-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base md:text-lg font-black text-slate-900">
                  Buy & Unlock Study Note
                </h3>
                <p className="text-xs text-slate-500">Bank Transfer & Receipt Verification</p>
              </div>
              <button
                onClick={() => setPurchaseModal({ open: false, material: null, details: null, loadingDetails: false })}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {receiptError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                {receiptError}
              </div>
            )}

            {/* Note Summary Card */}
            <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">
                  {purchaseModal.material?.title}
                </span>
                <span className="text-sm font-black font-mono text-amber-900">
                  {purchaseModal.material?.currency} {parseFloat(purchaseModal.material?.price || 0).toFixed(2)}
                </span>
              </div>
              <div className="text-[11px] text-amber-800 flex items-center gap-2">
                <span>Class: {purchaseModal.material?.class?.name}</span>
                <span>•</span>
                <span>Language: {LANGUAGE_CONFIG[purchaseModal.material?.language]?.label || purchaseModal.material?.language}</span>
              </div>
            </div>

            {/* Institute Official Bank Details */}
            {purchaseModal.loadingDetails ? (
              <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                <span>Loading institute bank details...</span>
              </div>
            ) : purchaseModal.details?.bankSettings ? (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-800 border-b border-slate-200 pb-1.5">
                  <Building className="w-4 h-4 text-amber-600" />
                  <span>Transfer to Institute Bank Account</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Bank Name</span>
                    <strong className="font-semibold">{purchaseModal.details.bankSettings.bankName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Account Holder</span>
                    <strong className="font-semibold">{purchaseModal.details.bankSettings.accountName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Account Number</span>
                    <strong className="font-mono font-bold text-slate-900">{purchaseModal.details.bankSettings.accountNumber}</strong>
                  </div>
                  {purchaseModal.details.bankSettings.branchName && (
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Branch</span>
                      <strong className="font-semibold">{purchaseModal.details.bankSettings.branchName}</strong>
                    </div>
                  )}
                </div>

                {purchaseModal.details.bankSettings.instructions && (
                  <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-slate-600">
                    <strong>Instructions:</strong> {purchaseModal.details.bankSettings.instructions}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 font-medium">
                Payment instructions are currently unavailable. Please contact the institute administration.
              </div>
            )}

            {/* Receipt Upload Section */}
            <form onSubmit={handleSubmitReceipt} className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Upload Payment Receipt Slip *
              </label>

              <div className="grid grid-cols-2 gap-2">
                {/* Take Photo Button */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 p-3 bg-slate-50 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-400 rounded-2xl text-xs font-bold text-slate-700 transition-all"
                >
                  <Camera className="w-4 h-4 text-amber-600" />
                  <span>Take Photo</span>
                </button>
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                  }}
                  className="hidden"
                />

                {/* Choose from Gallery / PDF */}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 p-3 bg-slate-50 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-400 rounded-2xl text-xs font-bold text-slate-700 transition-all"
                >
                  <ImageIcon className="w-4 h-4 text-blue-600" />
                  <span>Gallery / File / PDF</span>
                </button>
                <input
                  type="file"
                  ref={galleryInputRef}
                  accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                  }}
                  className="hidden"
                />
              </div>

              {/* Chosen File Preview */}
              {receiptFile && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
                  {receiptPreviewUrl ? (
                    <img
                      src={receiptPreviewUrl}
                      alt="Receipt Preview"
                      className="w-12 h-12 object-cover rounded-xl border border-slate-200 flex-shrink-0"
                    />
                  ) : (
                    <FileText className="w-10 h-10 text-amber-600 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">{receiptFile.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {(receiptFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to submit
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptFile(null);
                      setReceiptPreviewUrl(null);
                    }}
                    className="text-slate-400 hover:text-slate-700 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPurchaseModal({ open: false, material: null, details: null, loadingDetails: false })}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReceipt || !receiptFile}
                  className="px-5 py-2.5 text-xs font-black bg-[#FFD978] hover:bg-[#F2CD6A] text-slate-900 border border-[#E6BC50] rounded-xl shadow-xs transition-all disabled:opacity-50"
                >
                  {submittingReceipt ? 'Submitting Receipt...' : 'Submit Payment Slip'}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. MY PURCHASES HISTORY MODAL                             */}
      {/* ========================================================= */}
      {purchasesHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <GlassCard className="w-full max-w-2xl bg-white p-6 rounded-3xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-black text-slate-900">My Note Purchase History</h3>
              </div>
              <button
                onClick={() => setPurchasesHistoryOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {purchases.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  You haven't submitted any note purchases yet.
                </div>
              ) : (
                purchases.map((p) => {
                  const langConfig = LANGUAGE_CONFIG[p.language] || { label: p.language, badge: 'bg-slate-100 text-slate-700' };
                  return (
                    <div
                      key={p.id}
                      className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${langConfig.badge}`}>
                            {langConfig.label}
                          </span>
                          <strong className="text-slate-900 truncate">{p.materialTitle}</strong>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>Amount: <strong className="text-slate-800">{p.currency} {p.amount.toFixed(2)}</strong></span>
                          <span>•</span>
                          <span>Submitted: {new Date(p.receiptUploadedAt || p.createdAt).toLocaleDateString()}</span>
                        </div>
                        {p.rejectionReason && (
                          <div className="mt-1 text-[11px] text-rose-600 font-medium">
                            Rejection Reason: {p.rejectionReason}
                          </div>
                        )}
                      </div>

                      <div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                            p.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : p.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. IN-APP PDF VIEWER MODAL                                */}
      {/* ========================================================= */}
      {pdfModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="w-full max-w-5xl h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900 truncate max-w-md">
                  {pdfModal.title}
                </h3>
              </div>
              <button
                onClick={() => setPdfModal({ open: false, url: null, title: '', loading: false })}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 relative">
              {pdfModal.loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              ) : pdfModal.url ? (
                <iframe src={pdfModal.url} title="PDF Viewer" className="w-full h-full border-0" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                  Failed to load PDF file.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
