import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest, fetchProtectedAssetBlobUrl, revokeProtectedAssetBlobUrl } from '../../services/api';
import BrandingImageUploader from '../../components/common/BrandingImageUploader';
import InstituteBrandingHeader, { resolveInstituteLogoUrl } from '../../components/common/InstituteBrandingHeader';
import {
  Building,
  Mail,
  Phone,
  MapPin,
  Globe,
  UserCheck,
  Check,
  AlertCircle,
  Save,
  Sparkles,
  Eye,
  FileText,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export default function InstituteSettingsPage() {
  const { institute, updateInstituteContext } = useAuth();
  const [activeTab, setActiveTab] = useState('branding'); // 'branding' | 'profile' | 'preview'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    principalName: '',
  });

  const [brandingState, setBrandingState] = useState({
    logo: null,
    hasSignature: false,
    hasStamp: false,
    signatureUrl: null,
    stampUrl: null,
  });

  // Authenticated Object URLs for Protected Signature & Stamp
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState(null);
  const [stampPreviewUrl, setStampPreviewUrl] = useState(null);

  const [loading, setLoading] = useState(false);
  const [fetchingSettings, setFetchingSettings] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Track active blob URLs to clean up without leaks
  const signatureBlobRef = useRef(null);
  const stampBlobRef = useRef(null);

  // Helper to fetch protected signature blob
  const loadSignatureBlob = useCallback(async () => {
    try {
      const url = await fetchProtectedAssetBlobUrl('/portal/branding-assets/signature');
      if (signatureBlobRef.current) revokeProtectedAssetBlobUrl(signatureBlobRef.current);
      signatureBlobRef.current = url;
      setSignaturePreviewUrl(url);
    } catch (e) {
      console.error('Failed to load signature preview blob:', e);
      setSignaturePreviewUrl(null);
    }
  }, []);

  // Helper to fetch protected stamp blob
  const loadStampBlob = useCallback(async () => {
    try {
      const url = await fetchProtectedAssetBlobUrl('/portal/branding-assets/stamp');
      if (stampBlobRef.current) revokeProtectedAssetBlobUrl(stampBlobRef.current);
      stampBlobRef.current = url;
      setStampPreviewUrl(url);
    } catch (e) {
      console.error('Failed to load stamp preview blob:', e);
      setStampPreviewUrl(null);
    }
  }, []);

  const fetchCurrentSettings = async () => {
    try {
      setFetchingSettings(true);
      const res = await apiRequest('/portal/settings');
      if (res.success && res.data) {
        const data = res.data;
        setFormData({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          website: data.website || '',
          principalName: data.principalName || '',
        });
        setBrandingState({
          logo: data.logo || null,
          hasSignature: data.hasSignature || false,
          hasStamp: data.hasStamp || false,
          signatureUrl: data.signatureUrl || null,
          stampUrl: data.stampUrl || null,
        });

        // Load protected blob previews if configured
        if (data.hasSignature) {
          loadSignatureBlob();
        } else {
          if (signatureBlobRef.current) revokeProtectedAssetBlobUrl(signatureBlobRef.current);
          signatureBlobRef.current = null;
          setSignaturePreviewUrl(null);
        }

        if (data.hasStamp) {
          loadStampBlob();
        } else {
          if (stampBlobRef.current) revokeProtectedAssetBlobUrl(stampBlobRef.current);
          stampBlobRef.current = null;
          setStampPreviewUrl(null);
        }

        updateInstituteContext(data);
      }
    } catch (err) {
      console.error('Failed to load institute settings:', err);
    } finally {
      setFetchingSettings(false);
    }
  };

  useEffect(() => {
    fetchCurrentSettings();

    // Clean up on component unmount
    return () => {
      if (signatureBlobRef.current) revokeProtectedAssetBlobUrl(signatureBlobRef.current);
      if (stampBlobRef.current) revokeProtectedAssetBlobUrl(stampBlobRef.current);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      setMessage('');

      const res = await apiRequest('/portal/settings', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });

      if (res.success) {
        setMessage('Institute profile and signatory details saved successfully!');
        updateInstituteContext(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to update settings.');
    } finally {
      setLoading(false);
    }
  };

  // Immediate refresh after uploading asset
  const handleAssetUploadSuccess = async (type, res) => {
    if (res.data) {
      updateInstituteContext(res.data);
      setBrandingState({
        logo: res.data.logo || null,
        hasSignature: res.data.hasSignature || false,
        hasStamp: res.data.hasStamp || false,
        signatureUrl: res.data.signatureUrl || null,
        stampUrl: res.data.stampUrl || null,
      });

      if (type === 'signature') {
        await loadSignatureBlob();
      } else if (type === 'stamp') {
        await loadStampBlob();
      }
    }
  };

  // Immediate refresh after removing asset
  const handleAssetRemoveSuccess = (type, res) => {
    if (res.data) {
      updateInstituteContext(res.data);
      setBrandingState({
        logo: res.data.logo || null,
        hasSignature: res.data.hasSignature || false,
        hasStamp: res.data.hasStamp || false,
        signatureUrl: res.data.signatureUrl || null,
        stampUrl: res.data.stampUrl || null,
      });

      if (type === 'signature') {
        if (signatureBlobRef.current) revokeProtectedAssetBlobUrl(signatureBlobRef.current);
        signatureBlobRef.current = null;
        setSignaturePreviewUrl(null);
      } else if (type === 'stamp') {
        if (stampBlobRef.current) revokeProtectedAssetBlobUrl(stampBlobRef.current);
        stampBlobRef.current = null;
        setStampPreviewUrl(null);
      }
    }
  };

  // Preview Object dynamically compiled from form + current branding + active blob URLs
  const previewInstitute = {
    name: formData.name || institute?.name || 'Your Institute Name',
    code: institute?.code || 'EDU0001',
    slug: institute?.slug || 'institute',
    logo: brandingState.logo,
    email: formData.email,
    phone: formData.phone,
    address: formData.address,
    website: formData.website,
    principalName: formData.principalName,
    hasSignature: brandingState.hasSignature,
    hasStamp: brandingState.hasStamp,
    signaturePreviewUrl,
    stampPreviewUrl,
  };

  return (
    <div className="space-y-6 max-w-5xl pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Institute Profile & Dynamic Branding
          </h2>
          <p className="text-sm text-slate-500">
            Customize your tenant's logo, signatures, official seals, and public identity
          </p>
        </div>

        <button
          onClick={fetchCurrentSettings}
          disabled={fetchingSettings}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold self-start sm:self-auto transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${fetchingSettings ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Alerts */}
      {message && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('branding')}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'branding'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Brand Assets & Logo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'profile'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Identity & Information</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'preview'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Live Document Preview</span>
        </button>
      </div>

      {/* TAB 1: BRAND ASSETS UPLOAD (Logo, Signature, Stamp) */}
      {activeTab === 'branding' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Logo Uploader */}
            <BrandingImageUploader
              type="logo"
              title="Official Institute Logo"
              description="Primary emblem used across portals, invoices, and reports."
              currentUrl={brandingState.logo}
              hasAsset={Boolean(brandingState.logo)}
              previewShape="square"
              onUploadSuccess={(res) => handleAssetUploadSuccess('logo', res)}
              onRemoveSuccess={(res) => handleAssetRemoveSuccess('logo', res)}
            />

            {/* 2. Signature Uploader */}
            <BrandingImageUploader
              type="signature"
              title="Authorized Signature"
              description="Principal/Director signature for official certificates and invoices."
              currentUrl={signaturePreviewUrl}
              hasAsset={brandingState.hasSignature}
              previewShape="rect"
              onUploadSuccess={(res) => handleAssetUploadSuccess('signature', res)}
              onRemoveSuccess={(res) => handleAssetRemoveSuccess('signature', res)}
            />

            {/* 3. Stamp Uploader */}
            <BrandingImageUploader
              type="stamp"
              title="Official Institute Stamp"
              description="Certified institutional seal for invoices and verification."
              currentUrl={stampPreviewUrl}
              hasAsset={brandingState.hasStamp}
              previewShape="circle"
              onUploadSuccess={(res) => handleAssetUploadSuccess('stamp', res)}
              onRemoveSuccess={(res) => handleAssetRemoveSuccess('stamp', res)}
            />
          </div>

          {/* Quick Identity Information Form */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
              Signatory & Official Details
            </h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Principal / Director Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Arthur Pendelton"
                    value={formData.principalName}
                    onChange={(e) => setFormData({ ...formData, principalName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Appears under the signature block on generated documents.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Official Website URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://www.academy.edu"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-sm transition-all"
                >
                  <Save className="w-4 h-4 text-[#FFD978]" />
                  <span>{loading ? 'Saving...' : 'Save Signatory Details'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: PROFILE & CONTACT DETAILS */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-xs">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center font-bold text-amber-800 text-xl overflow-hidden shrink-0">
                {brandingState.logo ? (
                  <img src={resolveInstituteLogoUrl(brandingState.logo, brandingState.updatedAt, institute?.id)} alt={formData.name} className="w-full h-full object-contain p-1" />
                ) : (
                  <Building className="w-8 h-8 text-amber-600" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{formData.name || institute?.name}</h3>
                <p className="text-xs font-mono text-slate-500">
                  Tenant Code: <span className="font-bold text-slate-800">{institute?.code}</span> • Slug: /{institute?.slug}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Institute Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Official Contact Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Official Phone Number
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Official Website
                </label>
                <input
                  type="url"
                  placeholder="https://www.academy.edu"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Principal / Director Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Arthur Pendelton"
                  value={formData.principalName}
                  onChange={(e) => setFormData({ ...formData, principalName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Campus / Physical Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-sm transition-all"
              >
                <Save className="w-4 h-4 text-[#FFD978]" />
                <span>{loading ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: LIVE PREVIEW OF DOCUMENTS & PORTAL HEADERS */}
      {activeTab === 'preview' && (
        <div className="space-y-6">
          {/* Document Header Preview Box */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-10 shadow-md">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Official Document & Report Header (Live Dynamic Layout)
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Real-time Simulation
              </span>
            </div>

            <InstituteBrandingHeader
              institute={previewInstitute}
              variant="document"
              showPlatformBadge={true}
              showSignatures={true}
              signaturePreviewUrl={signaturePreviewUrl}
              stampPreviewUrl={stampPreviewUrl}
            />

            {/* Sample invoice dummy body to visualize context */}
            <div className="mt-8 pt-6 border-t border-dashed border-slate-200 opacity-60">
              <div className="h-4 bg-slate-100 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-50 rounded w-2/3 mb-4" />
              <div className="h-20 bg-slate-50 rounded-xl border border-slate-100" />
            </div>
          </div>

          {/* Portal Header Simulation */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
              Portal Header Variant (Teacher / Student / Parent / Admin Navigation)
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <InstituteBrandingHeader
                institute={previewInstitute}
                variant="portal"
                showPlatformBadge={true}
              />
              <span className="text-xs font-bold text-slate-500">Live Navigation View</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
