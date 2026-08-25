import React, { useState, useEffect, useRef } from 'react';
import { apiRequest, fetchProtectedAssetBlobUrl, revokeProtectedAssetBlobUrl } from '../../services/api';
import { Upload, Trash2, RefreshCw, Check, AlertCircle, Image as ImageIcon, ShieldCheck } from 'lucide-react';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export default function BrandingImageUploader({
  type = 'logo', // 'logo' | 'signature' | 'stamp'
  title = 'Branding Asset',
  description = 'Upload a high-resolution PNG, JPG, or WebP image.',
  currentUrl = null,
  hasAsset = false,
  uploadEndpoint = '/portal/settings/upload',
  removeEndpoint = `/portal/settings/branding-asset/${type}`,
  previewShape = 'square', // 'square' | 'rect' | 'circle'
  onUploadSuccess,
  onRemoveSuccess,
  disabled = false,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewSrc, setPreviewSrc] = useState(null);
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef(null);
  const activeBlobUrlRef = useRef(null);

  // Sync state & fetch protected blob preview if necessary
  useEffect(() => {
    let active = true;

    const syncPreview = async () => {
      // 1. If logo, standard public URL or null
      if (type === 'logo') {
        setPreviewSrc(currentUrl || null);
        setImgError(false);
        return;
      }

      // 2. If signature / stamp and configured, fetch protected blob URL if needed
      if (hasAsset) {
        if (currentUrl && (currentUrl.startsWith('blob:') || currentUrl.startsWith('data:'))) {
          setPreviewSrc(currentUrl);
          setImgError(false);
        } else {
          try {
            const endpoint = type === 'signature' ? '/portal/branding-assets/signature' : '/portal/branding-assets/stamp';
            const blobUrl = await fetchProtectedAssetBlobUrl(endpoint);
            if (active) {
              // Revoke previous blob if tracked
              if (activeBlobUrlRef.current && activeBlobUrlRef.current.startsWith('blob:')) {
                revokeProtectedAssetBlobUrl(activeBlobUrlRef.current);
              }
              activeBlobUrlRef.current = blobUrl;
              setPreviewSrc(blobUrl);
              setImgError(false);
            } else {
              revokeProtectedAssetBlobUrl(blobUrl);
            }
          } catch (err) {
            if (active) setImgError(true);
          }
        }
      } else {
        if (activeBlobUrlRef.current && activeBlobUrlRef.current.startsWith('blob:')) {
          revokeProtectedAssetBlobUrl(activeBlobUrlRef.current);
          activeBlobUrlRef.current = null;
        }
        setPreviewSrc(null);
        setImgError(false);
      }
    };

    syncPreview();

    return () => {
      active = false;
    };
  }, [type, currentUrl, hasAsset]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current && activeBlobUrlRef.current.startsWith('blob:')) {
        revokeProtectedAssetBlobUrl(activeBlobUrlRef.current);
      }
    };
  }, []);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Client-side MIME Type validation
    if (!ALLOWED_TYPES.includes(file.mimetype || file.type)) {
      setError('Invalid file type. Only PNG, JPG, JPEG, and WebP images are allowed.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Client-side File Size validation
    if (file.size > MAX_SIZE_BYTES) {
      setError(`File size exceeds the maximum limit of ${MAX_SIZE_MB} MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    // Create immediate local object preview
    const localUrl = URL.createObjectURL(file);
    if (activeBlobUrlRef.current && activeBlobUrlRef.current.startsWith('blob:')) {
      revokeProtectedAssetBlobUrl(activeBlobUrlRef.current);
    }
    activeBlobUrlRef.current = localUrl;
    setPreviewSrc(localUrl);
    setImgError(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const res = await apiRequest(uploadEndpoint, {
        method: 'POST',
        body: formData,
      });

      if (res.success) {
        setSuccess(`${title} uploaded successfully!`);
        if (onUploadSuccess) onUploadSuccess(res);
      }
    } catch (err) {
      setError(err.message || 'Upload failed. Please check file format.');
      // Revert preview on failure
      setPreviewSrc(null);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (disabled || loading) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const res = await apiRequest(removeEndpoint, {
        method: 'DELETE',
        body: JSON.stringify({ type }),
      });

      if (res.success) {
        if (activeBlobUrlRef.current && activeBlobUrlRef.current.startsWith('blob:')) {
          revokeProtectedAssetBlobUrl(activeBlobUrlRef.current);
          activeBlobUrlRef.current = null;
        }
        setPreviewSrc(null);
        setImgError(false);
        setSuccess(`${title} removed.`);
        if (onRemoveSuccess) onRemoveSuccess(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to remove asset.');
    } finally {
      setLoading(false);
    }
  };

  // Preview container styling based on shape
  let shapeClass = 'w-24 h-24 rounded-2xl';
  if (previewShape === 'rect') {
    shapeClass = 'w-44 h-20 rounded-xl';
  } else if (previewShape === 'circle') {
    shapeClass = 'w-24 h-24 rounded-full';
  }

  const isConfigured = Boolean((hasAsset || previewSrc) && !imgError);

  return (
    <div className="bg-slate-50/75 border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <span>{title}</span>
              {type !== 'logo' && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 border border-amber-200 px-1.5 py-0.2 rounded">
                  Protected Asset
                </span>
              )}
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
          </div>
        </div>

        {error && (
          <div className="my-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="my-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Preview Area */}
        <div className="my-3.5 flex items-center gap-4">
          <div
            className={`${shapeClass} bg-white border-2 border-dashed ${
              isConfigured ? 'border-slate-300 shadow-xs' : 'border-slate-200'
            } flex items-center justify-center overflow-hidden p-1.5 relative shrink-0`}
          >
            {isConfigured && previewSrc ? (
              <img
                src={previewSrc}
                alt={title}
                onError={() => setImgError(true)}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-300 text-center p-2">
                <ImageIcon className="w-6 h-6 mb-1" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Not Configured
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">
              {isConfigured ? 'Active & Configured' : 'No Asset Uploaded'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Formats: PNG, JPG, JPEG, WebP (Max: 5MB)
            </p>
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div className="pt-3 border-t border-slate-200/60 flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || loading}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || loading}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-2xs transition-colors disabled:opacity-50"
        >
          {loading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5 text-[#FFD978]" />
          )}
          <span>{isConfigured ? 'Replace Asset' : 'Upload Image'}</span>
        </button>

        {isConfigured && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled || loading}
            className="p-2 rounded-xl border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-500 hover:text-rose-600 transition-colors"
            title="Remove Image"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
