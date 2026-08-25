import React, { useState, useEffect } from 'react';
import {
  apiRequest,
  fetchProtectedAssetBlobUrl,
  revokeProtectedAssetBlobUrl,
  openAuthenticatedFileInNewWindow,
} from '../../../services/api';
import EduNexaLogo from '../../../components/common/EduNexaLogo';
import {
  X,
  CheckCircle2,
  XCircle,
  FileText,
  ExternalLink,
  Building,
  CreditCard,
  Calendar,
  AlertTriangle,
  Receipt,
  Eye,
  Shield,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

export default function SubscriptionReviewModal({ isOpen, onClose, onActionCompleted, payment }) {
  const [loading, setLoading] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [error, setError] = useState('');

  // Protected Receipt Blob state
  const [receiptBlobUrl, setReceiptBlobUrl] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(true);
  const [receiptError, setReceiptError] = useState('');
  const [openingInNewTab, setOpeningInNewTab] = useState(false);

  const isPdf =
    payment?.receiptMimeType === 'application/pdf' ||
    payment?.receiptOriginalName?.toLowerCase().endsWith('.pdf') ||
    payment?.receiptFile?.toLowerCase().endsWith('.pdf');

  useEffect(() => {
    let currentBlob = null;
    let isMounted = true;

    if (isOpen && payment?.id) {
      setReceiptLoading(true);
      setReceiptError('');
      setReceiptBlobUrl(null);

      fetchProtectedAssetBlobUrl(`/subscription/payments/${payment.id}/receipt`)
        .then((url) => {
          if (!isMounted) {
            revokeProtectedAssetBlobUrl(url);
            return;
          }
          currentBlob = url;
          setReceiptBlobUrl(url);
        })
        .catch((err) => {
          if (!isMounted) return;
          console.error('Failed to load receipt blob:', err);
          if (err.status === 401) {
            setReceiptError('Your session has expired. Please log in again.');
          } else if (err.status === 403) {
            setReceiptError('Access denied. You do not have permission to view this receipt.');
          } else if (err.status === 404) {
            setReceiptError('Receipt file not found on disk.');
          } else {
            setReceiptError(err.message || 'Unable to load payment receipt.');
          }
        })
        .finally(() => {
          if (isMounted) setReceiptLoading(false);
        });
    }

    return () => {
      isMounted = false;
      if (currentBlob) {
        revokeProtectedAssetBlobUrl(currentBlob);
      }
    };
  }, [isOpen, payment?.id]);

  if (!isOpen || !payment) return null;

  const handleOpenReceiptInNewTab = async () => {
    try {
      setOpeningInNewTab(true);
      setError('');
      await openAuthenticatedFileInNewWindow(`/subscription/payments/${payment.id}/receipt`);
    } catch (err) {
      console.error('Failed to open receipt in new tab:', err);
      setError(err.message || 'Failed to open receipt in new tab.');
    } finally {
      setOpeningInNewTab(false);
    }
  };

  const handleApprove = async () => {
    if (
      !window.confirm(
        `Approve subscription payment of ${payment.currency} ${parseFloat(
          payment.amount
        ).toLocaleString()} for ${payment.institute?.name}?`
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await apiRequest(`/super-admin/subscriptions/payments/${payment.id}/approve`, {
        method: 'POST',
      });
      if (res.success) {
        onActionCompleted();
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to approve subscription payment.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setError('Please provide a reason for rejection.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await apiRequest(`/super-admin/subscriptions/payments/${payment.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          rejectionReason: rejectionReason.trim(),
          adminNotes: adminNotes.trim(),
        }),
      });
      if (res.success) {
        onActionCompleted();
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to reject subscription payment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <EduNexaLogo size="sm" />
            <div>
              <h3 className="text-base font-black tracking-tight">Review Bank Transfer Payment</h3>
              <p className="text-xs text-slate-400 font-mono">Ref: {payment.transferReference}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Grid Layout: Details vs Receipt Document */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Transfer & Institute Meta */}
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Building className="w-4 h-4 text-slate-600" />
                  <span>Target Institute</span>
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">{payment.institute?.name}</h4>
                  <p className="text-xs text-slate-500 font-mono">Code: {payment.institute?.code}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                  <CreditCard className="w-4 h-4 text-amber-700" />
                  <span>Payment Amount</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-950 font-mono">
                    {payment.currency} {parseFloat(payment.amount).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-700">
                  Plan: {payment.subscription?.planNameSnapshot || 'Subscription Plan'}
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Bank Deposited To:</span>
                  <span className="font-bold text-slate-800">{payment.bankAccount?.bankName || 'Direct Transfer'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Account Number:</span>
                  <span className="font-mono font-bold text-slate-800">{payment.bankAccount?.accountNumber || '—'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Transfer Date:</span>
                  <span className="font-semibold text-slate-800">
                    {payment.transferDate ? new Date(payment.transferDate).toLocaleDateString() : '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Submitted At:</span>
                  <span className="text-slate-700">{new Date(payment.submittedAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Current Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      payment.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : payment.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {payment.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Receipt File Preview */}
            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Uploaded Transfer Slip
                </span>
                <button
                  type="button"
                  disabled={openingInNewTab || receiptLoading}
                  onClick={handleOpenReceiptInNewTab}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900 underline disabled:opacity-50 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{openingInNewTab ? 'Opening...' : 'Open in New Tab'}</span>
                </button>
              </div>

              <div className="flex-1 min-h-[260px] max-h-[380px] rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center p-2 relative">
                {receiptLoading ? (
                  <div className="flex flex-col items-center justify-center space-y-2 py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                    <p className="text-xs text-slate-500 font-medium">Loading slip document...</p>
                  </div>
                ) : receiptError ? (
                  <div className="p-4 rounded-xl bg-rose-50 text-rose-800 text-xs text-center space-y-2">
                    <AlertCircle className="w-6 h-6 text-rose-600 mx-auto" />
                    <p className="font-bold">Failed to load slip</p>
                    <p className="text-[11px] text-rose-600">{receiptError}</p>
                  </div>
                ) : isPdf ? (
                  <div className="text-center p-6 space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {payment.receiptOriginalName || 'Deposit Slip.pdf'}
                      </p>
                      <p className="text-xs text-slate-400">PDF Document (Protected)</p>
                    </div>
                    <button
                      type="button"
                      disabled={openingInNewTab}
                      onClick={handleOpenReceiptInNewTab}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {openingInNewTab ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Opening PDF...</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          <span>View PDF Receipt</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : receiptBlobUrl ? (
                  <img
                    src={receiptBlobUrl}
                    alt="Deposit Receipt"
                    className="max-h-full max-w-full object-contain rounded-xl shadow-xs"
                  />
                ) : null}
              </div>
            </div>
          </div>

          {/* Rejection Mode View */}
          {rejectMode && (
            <form
              onSubmit={handleReject}
              className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3 animate-in fade-in"
            >
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Specify Rejection Details</span>
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase text-slate-700">
                  Institute-Visible Reason *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Deposit slip reference number does not match our bank statement."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-rose-300 bg-white text-xs text-slate-900 focus:ring-2 focus:ring-rose-400 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase text-slate-700">
                  Internal Super Admin Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Optional internal audit remark..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:ring-2 focus:ring-slate-400 focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRejectMode(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                >
                  {loading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        {payment.status === 'PENDING' && !rejectMode && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={() => setRejectMode(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-all shadow-xs"
            >
              <XCircle className="w-4 h-4" />
              <span>Reject Payment</span>
            </button>

            <button
              type="button"
              onClick={handleApprove}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-md active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Approving...' : 'Approve & Activate Subscription'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
