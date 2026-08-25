import React, { useState, useEffect } from 'react';
import {
  fetchProtectedAssetBlobUrl,
  revokeProtectedAssetBlobUrl,
  openAuthenticatedFileInNewWindow,
} from '../../services/api';
import {
  X,
  FileText,
  Eye,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

export default function ReceiptPreviewModal({
  isOpen,
  onClose,
  paymentId,
  receiptOriginalName,
  receiptMimeType,
}) {
  const [loading, setLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState(null);
  const [isPdf, setIsPdf] = useState(false);
  const [openingInNewTab, setOpeningInNewTab] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let currentBlob = null;
    let isMounted = true;

    if (isOpen && paymentId) {
      setLoading(true);
      setError('');
      setBlobUrl(null);

      // Determine initial isPdf from prop if available
      const initialPdfCheck =
        receiptMimeType === 'application/pdf' ||
        receiptOriginalName?.toLowerCase().endsWith('.pdf');
      setIsPdf(Boolean(initialPdfCheck));

      fetchProtectedAssetBlobUrl(`/subscription/payments/${paymentId}/receipt`)
        .then((url) => {
          if (!isMounted) {
            revokeProtectedAssetBlobUrl(url);
            return;
          }
          currentBlob = url;
          setBlobUrl(url);

          // If blob URL was created, inspect whether it's PDF
          if (initialPdfCheck || receiptOriginalName?.toLowerCase().endsWith('.pdf')) {
            setIsPdf(true);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          console.error('Failed to load secure receipt asset:', err);
          if (err.status === 401) {
            setError('Your session has expired. Please log in again.');
          } else if (err.status === 403) {
            setError('Access denied. You do not have permission to view this receipt.');
          } else if (err.status === 404) {
            setError('Receipt file could not be found.');
          } else {
            setError(err.message || 'Unable to load payment receipt.');
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }

    return () => {
      isMounted = false;
      if (currentBlob) {
        revokeProtectedAssetBlobUrl(currentBlob);
      }
    };
  }, [isOpen, paymentId, receiptMimeType, receiptOriginalName]);

  if (!isOpen || !paymentId) return null;

  const handleOpenInNewWindow = async () => {
    try {
      setOpeningInNewTab(true);
      setError('');
      await openAuthenticatedFileInNewWindow(`/subscription/payments/${paymentId}/receipt`);
    } catch (err) {
      console.error('Error opening receipt in new tab:', err);
      setError(err.message || 'Failed to open receipt document.');
    } finally {
      setOpeningInNewTab(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#FFD978]" />
            <span className="text-sm font-bold">Uploaded Bank Transfer Receipt</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col items-center justify-center bg-slate-50 min-h-[320px] max-h-[520px] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center space-y-3 py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
              <p className="text-xs font-semibold text-slate-500">Loading secure receipt document...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3 max-w-md">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Unable to Load Receipt</p>
                <p className="leading-relaxed">{error}</p>
              </div>
            </div>
          ) : isPdf ? (
            /* PDF Document View */
            <div className="text-center p-6 space-y-4 max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto shadow-xs">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 truncate">
                  {receiptOriginalName || 'Bank Transfer Deposit Slip.pdf'}
                </p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">PDF Receipt Document</p>
              </div>

              <button
                type="button"
                disabled={openingInNewTab}
                onClick={handleOpenInNewWindow}
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {openingInNewTab ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Opening PDF...</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    <span>Open PDF in New Window</span>
                  </>
                )}
              </button>
            </div>
          ) : blobUrl ? (
            /* Image Document View */
            <div className="space-y-3 w-full flex flex-col items-center">
              <div className="max-h-[380px] max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
                <img
                  src={blobUrl}
                  alt="Deposit Slip"
                  className="max-h-[360px] max-w-full object-contain rounded-lg"
                  onError={() => {
                    // Fallback to PDF view if image rendering fails
                    setIsPdf(true);
                  }}
                />
              </div>
              <button
                type="button"
                disabled={openingInNewTab}
                onClick={handleOpenInNewWindow}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{openingInNewTab ? 'Opening in New Window...' : 'Open Full Size in New Window'}</span>
              </button>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
