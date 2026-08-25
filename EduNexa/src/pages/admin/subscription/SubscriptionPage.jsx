import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';
import EduNexaLogo from '../../../components/common/EduNexaLogo';
import ReceiptPreviewModal from '../../../components/subscription/ReceiptPreviewModal';
import {
  CreditCard,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Building,
  UploadCloud,
  FileText,
  Copy,
  Check,
  AlertCircle,
  ArrowRight,
  Shield,
  Layers,
  Calendar,
  X,
  Eye,
  RefreshCw,
  HelpCircle,
  Check as CheckIcon,
} from 'lucide-react';

export default function SubscriptionPage() {
  const [currentSub, setCurrentSub] = useState(null);
  const [history, setHistory] = useState([]);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Workflow State: 'overview' | 'select-plan' | 'checkout'
  const [viewState, setViewState] = useState('overview');
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState(null);
  const [activeSubscriptionId, setActiveSubscriptionId] = useState(null);

  // Form State for Payment Submission
  const [selectedBankId, setSelectedBankId] = useState('');
  const [transferReference, setTransferReference] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [formError, setFormError] = useState('');
  const [copiedBankId, setCopiedBankId] = useState(null);
  const [previewReceiptPaymentId, setPreviewReceiptPaymentId] = useState(null);

  const [usageStats, setUsageStats] = useState(null);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      const [currRes, histRes, plansRes, banksRes, useRes] = await Promise.all([
        apiRequest('/subscription/current'),
        apiRequest('/subscription/history'),
        apiRequest('/plans'),
        apiRequest('/bank-accounts/active'),
        apiRequest('/subscription/usage'),
      ]);

      if (currRes.success) setCurrentSub(currRes.data);
      if (histRes.success) setHistory(histRes.data);
      if (plansRes.success) setAvailablePlans(plansRes.data);
      if (useRes.success) setUsageStats(useRes.data?.usage || null);
      if (banksRes.success) {
        setBankAccounts(banksRes.data);
        if (banksRes.data.length > 0) {
          setSelectedBankId(banksRes.data[0].id);
        }
      }

      // Automatically determine initial view state
      if (!currRes.data || currRes.data.status === 'REJECTED') {
        setViewState('overview');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const handleSelectPlan = async (plan) => {
    try {
      setLoading(true);
      setFormError('');
      const res = await apiRequest('/subscription/select-plan', {
        method: 'POST',
        body: JSON.stringify({ planId: plan.id }),
      });

      if (res.success) {
        setSelectedPlanForCheckout(res.data);
        setActiveSubscriptionId(res.data.id);
        setViewState('checkout');
      }
    } catch (err) {
      alert(err.message || 'Failed to select plan.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setFormError('Invalid file type. Please upload a PDF, JPG, JPEG, or PNG receipt.');
      return;
    }

    // Check size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setFormError('File size exceeds 10MB limit.');
      return;
    }

    setFormError('');
    setReceiptFile(file);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setReceiptPreview(event.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      setReceiptPreview(null);
    }
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!receiptFile) {
      setFormError('Please select or drag-and-drop a transfer receipt file.');
      return;
    }

    if (!transferReference.trim()) {
      setFormError('Please enter the bank transfer reference or deposit slip number.');
      return;
    }

    try {
      setSubmittingPayment(true);
      setFormError('');

      const formData = new FormData();
      if (activeSubscriptionId) {
        formData.append('subscriptionId', activeSubscriptionId);
      }
      formData.append('bankAccountId', selectedBankId);
      formData.append('transferReference', transferReference.trim());
      formData.append('transferDate', transferDate);
      formData.append('receipt', receiptFile);

      // Use fetch directly for multipart formData with auth token
      const token = localStorage.getItem('edunexa_token');
      const response = await fetch('/api/subscription/payment', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const res = await response.json();

      if (!response.ok || !res.success) {
        throw new Error(res.message || 'Payment submission failed.');
      }

      setViewState('overview');
      setReceiptFile(null);
      setReceiptPreview(null);
      setTransferReference('');
      fetchSubscriptionData();
    } catch (err) {
      setFormError(err.message || 'Failed to submit payment receipt.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleCopyAccount = (number, id) => {
    navigator.clipboard.writeText(number);
    setCopiedBankId(id);
    setTimeout(() => setCopiedBankId(null), 2000);
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
      </div>
    );
  }

  const latestPayment = currentSub?.payments?.[0];
  const isPendingVerification = currentSub?.status === 'PAYMENT_SUBMITTED' || latestPayment?.status === 'PENDING';
  const isRejected = currentSub?.status === 'REJECTED' || latestPayment?.status === 'REJECTED';
  const isActive = currentSub?.status === 'ACTIVE';

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Top Banner */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900 bg-[#FFD978] px-2.5 py-0.5 rounded-full">
              SaaS Subscription
            </span>
            <span className="text-xs font-mono text-slate-400 font-semibold">Institute Billing Portal</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-2">
            Plan & Billing Management
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Choose your subscription tier, complete manual bank deposits, and review active package entitlements
          </p>
        </div>

        {isActive && (
          <button
            onClick={() => setViewState('select-plan')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all active:scale-95 shrink-0"
          >
            <Sparkles className="w-4 h-4 text-[#FFD978]" />
            <span>Upgrade or Switch Plan</span>
          </button>
        )}
      </div>

      {/* STATE D: PENDING VERIFICATION ALERT */}
      {isPendingVerification && (
        <div className="p-6 rounded-3xl bg-amber-50/80 border border-amber-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FFD978] text-amber-950 flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <Clock className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Payment Verification Pending</h3>
                <span className="text-[10px] font-bold uppercase bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded-full">
                  Under Review
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Your deposit receipt for <strong>{currentSub.planNameSnapshot}</strong> ({currentSub.currencySnapshot} {parseFloat(currentSub.priceSnapshot).toLocaleString()}) is currently being verified by EduNexa Super Admin.
              </p>
              <p className="text-[11px] font-mono text-slate-500 mt-1">
                Ref: {latestPayment?.transferReference} • Submitted: {new Date(latestPayment?.submittedAt).toLocaleString()}
              </p>
            </div>
          </div>

          <button
            onClick={() => setPreviewReceiptPaymentId(latestPayment?.id)}
            className="px-4 py-2 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 text-xs font-bold transition-colors shrink-0"
          >
            View Uploaded Slip
          </button>
        </div>
      )}

      {/* STATE E: REJECTED ALERT WITH RESUBMIT */}
      {isRejected && !isPendingVerification && (
        <div className="p-6 rounded-3xl bg-rose-50 border border-rose-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-rose-900">Payment Verification Rejected</h3>
              <p className="text-xs text-rose-700 mt-1">
                <strong>Super Admin Reason:</strong> {latestPayment?.rejectionReason || 'The uploaded receipt could not be verified.'}
              </p>
              <p className="text-xs text-rose-600 mt-1">
                Please upload a clear deposit slip or transfer confirmation receipt to proceed.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setSelectedPlanForCheckout(currentSub);
              setActiveSubscriptionId(currentSub.id);
              setViewState('checkout');
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Resubmit Payment Receipt</span>
          </button>
        </div>
      )}

      {/* VIEW STATE: CHECKOUT (BANK DETAILS & RECEIPT UPLOAD) */}
      {viewState === 'checkout' && selectedPlanForCheckout && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Step 2 of 2</span>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">Bank Transfer & Receipt Upload</h3>
            </div>
            <button
              onClick={() => setViewState('overview')}
              className="text-xs font-bold text-slate-500 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Summary & Bank Transfer Instructions */}
            <div className="space-y-5">
              {/* Selected Plan Summary Card */}
              <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">Selected Plan</span>
                <div className="flex items-baseline justify-between mt-1">
                  <h4 className="text-xl font-black text-slate-900">
                    {selectedPlanForCheckout.planNameSnapshot || selectedPlanForCheckout.name}
                  </h4>
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    {selectedPlanForCheckout.currencySnapshot || selectedPlanForCheckout.currency} {parseFloat(selectedPlanForCheckout.priceSnapshot || selectedPlanForCheckout.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Duration: {selectedPlanForCheckout.durationSnapshot || selectedPlanForCheckout.duration} {selectedPlanForCheckout.durationTypeSnapshot || selectedPlanForCheckout.durationType}
                </p>
              </div>

              {/* Bank Accounts List */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Target Platform Bank Account
                </span>

                {bankAccounts.map((bank) => (
                  <label
                    key={bank.id}
                    className={`block p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      selectedBankId === bank.id ? 'border-slate-900 bg-slate-50/80 shadow-xs' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="targetBank"
                          checked={selectedBankId === bank.id}
                          onChange={() => setSelectedBankId(bank.id)}
                          className="mt-1 text-slate-900 focus:ring-[#FFD978]"
                        />
                        <div>
                          <p className="text-sm font-bold text-slate-900">{bank.bankName}</p>
                          {bank.branchName && <p className="text-xs text-slate-500 font-medium">{bank.branchName}</p>}
                          <p className="text-xs text-slate-400 mt-0.5">Account Name: <strong>{bank.accountHolderName}</strong></p>
                        </div>
                      </div>

                      <div className="text-left sm:text-right pl-7 sm:pl-0">
                        <span className="font-mono text-sm font-black text-slate-900 block">{bank.accountNumber}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyAccount(bank.accountNumber, bank.id)}
                          className="block text-[11px] font-bold text-amber-800 hover:underline mt-1 sm:ml-auto"
                        >
                          {copiedBankId === bank.id ? 'Copied!' : 'Copy Number'}
                        </button>
                      </div>
                    </div>

                    {bank.instructions && (
                      <p className="text-[11px] text-slate-500 italic mt-2.5 pt-2 border-t border-slate-200/60">
                        "{bank.instructions}"
                      </p>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Right: Transfer Verification Form */}
            <form onSubmit={handleSubmitPayment} className="space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Bank Transfer Reference / Deposit Slip No *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TXN-89201948 or Slip #0049"
                  value={transferReference}
                  onChange={(e) => setTransferReference(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Deposit / Transfer Date *
                </label>
                <input
                  type="date"
                  required
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              {/* Receipt File Drag & Drop Upload */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Upload Transfer Slip Receipt (PDF, JPG, PNG) *
                </label>

                {!receiptFile ? (
                  <label className="border-2 border-dashed border-slate-300 hover:border-slate-900 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50">
                    <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-xs font-bold text-slate-800">Click or drag & drop deposit slip</span>
                    <span className="text-[11px] text-slate-400 mt-0.5">Maximum file size: 10 MB</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-[#FFD978] flex items-center justify-center font-bold">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 truncate max-w-[180px] sm:max-w-xs">{receiptFile.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{(receiptFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptFile(null);
                          setReceiptPreview(null);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        title="Remove File"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {receiptPreview && (
                      <div className="max-h-40 overflow-hidden rounded-xl border border-slate-200 flex justify-center bg-white p-2">
                        <img src={receiptPreview} alt="Receipt preview" className="max-h-36 object-contain rounded" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setViewState('overview')}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment || !receiptFile}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-40"
                >
                  {submittingPayment ? 'Submitting Receipt...' : 'Submit Payment for Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATE A: ACTIVE SUBSCRIPTION CARD */}
      {isActive && viewState === 'overview' && (
        <div className="bg-white rounded-3xl border-2 border-emerald-500/80 p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  ACTIVE SUBSCRIPTION
                </span>
              </div>
              <h3 className="text-3xl font-black text-slate-900 mt-2">
                {currentSub.planNameSnapshot}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Purchased at {currentSub.currencySnapshot} {parseFloat(currentSub.priceSnapshot).toLocaleString(undefined, { minimumFractionDigits: 2 })} / {currentSub.durationSnapshot} {currentSub.durationTypeSnapshot}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[11px] uppercase font-bold text-slate-400">Remaining Period</span>
              <p className="text-3xl font-black text-slate-900 font-mono">{currentSub.remainingDays} Days</p>
              <p className="text-xs text-slate-500">
                Expires on: <strong>{new Date(currentSub.endDate).toLocaleDateString()}</strong>
              </p>
            </div>
          </div>

          {/* Plan Usage Dashboard */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Plan Usage & Resource Limits
                </h4>
                <p className="text-xs text-slate-500">Live usage metrics against approved subscription capacity</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Students Metric */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Students Enrolled</span>
                  {usageStats?.students?.isLimitReached ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                      Limit Reached
                    </span>
                  ) : usageStats?.students?.isApproachingLimit ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                      80% Used
                    </span>
                  ) : null}
                </div>
                <div className="flex items-baseline justify-between">
                  <p className="text-2xl font-black text-slate-900 font-mono">
                    {usageStats?.students?.current || 0}{' '}
                    <span className="text-xs font-normal text-slate-400 font-sans">
                      / {usageStats?.students?.limit === null || usageStats?.students?.limit === undefined ? 'Unlimited' : usageStats?.students?.limit}
                    </span>
                  </p>
                  {usageStats?.students?.limit !== null && usageStats?.students?.limit !== undefined && (
                    <span className="text-xs font-bold text-slate-500">{usageStats?.students?.percentage}%</span>
                  )}
                </div>
                {usageStats?.students?.limit !== null && usageStats?.students?.limit !== undefined && (
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        usageStats?.students?.isLimitReached ? 'bg-rose-500' : usageStats?.students?.isApproachingLimit ? 'bg-amber-500' : 'bg-slate-900'
                      }`}
                      style={{ width: `${Math.min(100, usageStats?.students?.percentage || 0)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Teachers Metric */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Faculty & Teachers</span>
                  {usageStats?.teachers?.isLimitReached ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                      Limit Reached
                    </span>
                  ) : usageStats?.teachers?.isApproachingLimit ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                      80% Used
                    </span>
                  ) : null}
                </div>
                <div className="flex items-baseline justify-between">
                  <p className="text-2xl font-black text-slate-900 font-mono">
                    {usageStats?.teachers?.current || 0}{' '}
                    <span className="text-xs font-normal text-slate-400 font-sans">
                      / {usageStats?.teachers?.limit === null || usageStats?.teachers?.limit === undefined ? 'Unlimited' : usageStats?.teachers?.limit}
                    </span>
                  </p>
                  {usageStats?.teachers?.limit !== null && usageStats?.teachers?.limit !== undefined && (
                    <span className="text-xs font-bold text-slate-500">{usageStats?.teachers?.percentage}%</span>
                  )}
                </div>
                {usageStats?.teachers?.limit !== null && usageStats?.teachers?.limit !== undefined && (
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        usageStats?.teachers?.isLimitReached ? 'bg-rose-500' : usageStats?.teachers?.isApproachingLimit ? 'bg-amber-500' : 'bg-slate-900'
                      }`}
                      style={{ width: `${Math.min(100, usageStats?.teachers?.percentage || 0)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Classes Metric */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Classes & Batches</span>
                  {usageStats?.classes?.isLimitReached ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                      Limit Reached
                    </span>
                  ) : usageStats?.classes?.isApproachingLimit ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                      80% Used
                    </span>
                  ) : null}
                </div>
                <div className="flex items-baseline justify-between">
                  <p className="text-2xl font-black text-slate-900 font-mono">
                    {usageStats?.classes?.current || 0}{' '}
                    <span className="text-xs font-normal text-slate-400 font-sans">
                      / {usageStats?.classes?.limit === null || usageStats?.classes?.limit === undefined ? 'Unlimited' : usageStats?.classes?.limit}
                    </span>
                  </p>
                  {usageStats?.classes?.limit !== null && usageStats?.classes?.limit !== undefined && (
                    <span className="text-xs font-bold text-slate-500">{usageStats?.classes?.percentage}%</span>
                  )}
                </div>
                {usageStats?.classes?.limit !== null && usageStats?.classes?.limit !== undefined && (
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        usageStats?.classes?.isLimitReached ? 'bg-rose-500' : usageStats?.classes?.isApproachingLimit ? 'bg-amber-500' : 'bg-slate-900'
                      }`}
                      style={{ width: `${Math.min(100, usageStats?.classes?.percentage || 0)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Storage Metric */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Cloud Storage Used</span>
                  {usageStats?.storage?.isLimitReached ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                      Limit Reached
                    </span>
                  ) : null}
                </div>
                <div className="flex items-baseline justify-between">
                  <p className="text-2xl font-black text-slate-900 font-mono">
                    {usageStats?.storage?.currentGb || 0} GB{' '}
                    <span className="text-xs font-normal text-slate-400 font-sans">
                      / {usageStats?.storage?.limitGb === null || usageStats?.storage?.limitGb === undefined ? 'Unlimited' : `${usageStats?.storage?.limitGb} GB`}
                    </span>
                  </p>
                  {usageStats?.storage?.limitGb !== null && usageStats?.storage?.limitGb !== undefined && (
                    <span className="text-xs font-bold text-slate-500">{usageStats?.storage?.percentage}%</span>
                  )}
                </div>
                {usageStats?.storage?.limitGb !== null && usageStats?.storage?.limitGb !== undefined && (
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-900 transition-all"
                      style={{ width: `${Math.min(100, usageStats?.storage?.percentage || 0)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Branches Metric */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Campus Branches</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <p className="text-2xl font-black text-slate-900 font-mono">
                    1{' '}
                    <span className="text-xs font-normal text-slate-400 font-sans">
                      / {usageStats?.branches?.limit === null || usageStats?.branches?.limit === undefined ? 'Unlimited' : usageStats?.branches?.limit}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bound Features list */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Entitled Features & Modules ({Array.isArray(currentSub.featuresSnapshot) ? currentSub.featuresSnapshot.length : 0})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {Array.isArray(currentSub.featuresSnapshot) &&
                currentSub.featuresSnapshot.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-800">
                    <CheckIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate font-semibold">{f.name || f.code}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* STATE B: DYNAMIC PLAN SELECTION (IF NO ACTIVE SUBSCRIPTION OR UPGRADING) */}
      {(!isActive || viewState === 'select-plan') && viewState !== 'checkout' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900">Available Subscription Plans</h3>
              <p className="text-xs text-slate-500">Choose a package tailored for your institute's scale</p>
            </div>
            {isActive && (
              <button
                onClick={() => setViewState('overview')}
                className="text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                Back to Current Subscription
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {availablePlans.map((plan) => (
              <div
                key={plan.id}
                className={`bg-white rounded-3xl border-2 p-6 shadow-xs flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-md ${
                  plan.isPopular ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-200/80'
                }`}
              >
                {plan.isPopular && (
                  <div className="absolute top-0 right-0 bg-[#FFD978] text-amber-950 px-3.5 py-0.5 rounded-bl-2xl font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                    <Sparkles className="w-3 h-3 fill-amber-900" />
                    MOST POPULAR
                  </div>
                )}

                <div>
                  <h4 className="text-xl font-black text-slate-900">{plan.name}</h4>
                  <p className="text-xs text-slate-500 mt-1 min-h-[32px] line-clamp-2">
                    {plan.description || 'Comprehensive institute management tier.'}
                  </p>

                  <div className="my-5 pb-5 border-b border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs font-mono font-bold text-slate-400">{plan.currency}</span>
                      <span className="text-3xl font-black text-slate-900">
                        {plan.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">
                        / {plan.duration} {plan.durationType === 'MONTHS' ? 'Month' : plan.durationType === 'YEARS' ? 'Year' : 'Days'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-700 mb-6">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>{plan.limits?.students === null ? 'Unlimited' : `Up to ${plan.limits?.students}`}</strong> Students
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>{plan.limits?.teachers === null ? 'Unlimited' : `Up to ${plan.limits?.teachers}`}</strong> Teachers
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>{plan.features?.length || 0}</strong> Entitled Modules
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={isPendingVerification}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 ${
                    plan.isPopular
                      ? 'bg-slate-900 hover:bg-slate-800 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                  } disabled:opacity-40`}
                >
                  {isPendingVerification ? 'Verification Pending' : 'Select Plan & Pay'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBSCRIPTION & PAYMENT AUDIT HISTORY */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Subscription & Payment History</h3>
          <p className="text-xs text-slate-400">Complete audit trail of all previous plan purchases and transfer slips</p>
        </div>

        {history.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No previous subscription history found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-6">Plan Purchased</th>
                  <th className="py-3 px-6">Amount</th>
                  <th className="py-3 px-6">Active Period</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Transfer Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {history.map((sub) => {
                  const payment = sub.payments?.[0];
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-900">{sub.planNameSnapshot}</p>
                        <p className="text-xs text-slate-400">
                          {sub.durationSnapshot} {sub.durationTypeSnapshot}
                        </p>
                      </td>

                      <td className="py-4 px-6 font-mono font-bold text-slate-900">
                        {sub.currencySnapshot} {sub.priceSnapshot?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-4 px-6 text-xs text-slate-500">
                        {sub.startDate && sub.endDate ? (
                          <span>{new Date(sub.startDate).toLocaleDateString()} - {new Date(sub.endDate).toLocaleDateString()}</span>
                        ) : (
                          <span className="italic text-slate-400">N/A</span>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
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
                        {payment ? (
                          <button
                            onClick={() => setPreviewReceiptPaymentId(payment.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Slip</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No slip</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Receipt Modal */}
      <ReceiptPreviewModal
        isOpen={Boolean(previewReceiptPaymentId)}
        onClose={() => setPreviewReceiptPaymentId(null)}
        paymentId={previewReceiptPaymentId}
        receiptOriginalName={
          (history.flatMap((h) => h.payments || [])).find((p) => p.id === previewReceiptPaymentId)?.receiptOriginalName ||
          (latestPayment?.id === previewReceiptPaymentId ? latestPayment?.receiptOriginalName : '')
        }
        receiptMimeType={
          (history.flatMap((h) => h.payments || [])).find((p) => p.id === previewReceiptPaymentId)?.receiptMimeType ||
          (latestPayment?.id === previewReceiptPaymentId ? latestPayment?.receiptMimeType : '')
        }
      />
    </div>
  );
}
