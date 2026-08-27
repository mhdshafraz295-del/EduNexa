import React, { useState, useEffect } from 'react';
import EduNexaLogo from './EduNexaLogo';
import { fetchProtectedAssetBlobUrl, revokeProtectedAssetBlobUrl, API_BASE } from '../../services/api';
import { Building, Globe, Mail, Phone, MapPin, Award, CheckCircle2, ShieldCheck } from 'lucide-react';

export const getInstituteInitials = (name) => {
  if (!name) return 'IN';
  const clean = name.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export const resolveInstituteLogoUrl = (rawLogo, updatedAt, instituteId) => {
  if (!rawLogo || typeof rawLogo !== 'string') return null;
  const trimmed = rawLogo.trim();
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const versionParam = updatedAt ? `?v=${new Date(updatedAt).getTime()}` : `?v=${Date.now()}`;
  
  let instId = instituteId;
  if (!instId) {
    const match = trimmed.match(/institutes\/(\d+)\//);
    if (match && match[1]) {
      instId = match[1];
    }
  }

  const targetId = instId || 'current';
  return `${API_BASE}/portal/public-logo/${targetId}${versionParam}`;
};

export default function InstituteBrandingHeader({
  institute,
  variant = 'portal', // 'portal' | 'card' | 'document'
  showPlatformBadge = true,
  showSignatures = false,
  signaturePreviewUrl = null,
  stampPreviewUrl = null,
  className = '',
}) {
  const [imgError, setImgError] = useState(false);
  const [sigError, setSigError] = useState(false);
  const [stampError, setStampError] = useState(false);

  // Internal Object URLs when fetching protected assets on-the-fly
  const [internalSigUrl, setInternalSigUrl] = useState(null);
  const [internalStampUrl, setInternalStampUrl] = useState(null);

  const name = institute?.name || 'EduNexa Institute';
  const code = institute?.code || 'EDU';
  const logo = resolveInstituteLogoUrl(institute?.logo, institute?.updatedAt, institute?.id);
  const initials = getInstituteInitials(name);

  // Effective Signature & Stamp Sources (Prioritize passed props, then institute object URLs, then internal fetched URLs)
  const effectiveSigUrl = signaturePreviewUrl || institute?.signaturePreviewUrl || internalSigUrl;
  const effectiveStampUrl = stampPreviewUrl || institute?.stampPreviewUrl || internalStampUrl;

  // Reset error states whenever institute identity or logo changes
  useEffect(() => {
    setImgError(false);
    setSigError(false);
    setStampError(false);
  }, [institute?.logo, institute?.id, institute?.name]);

  const hasConfiguredSignature = Boolean(institute?.hasSignature || signaturePreviewUrl || institute?.signaturePreviewUrl);
  const hasConfiguredStamp = Boolean(institute?.hasStamp || stampPreviewUrl || institute?.stampPreviewUrl);

  // 1. Fetch Protected Signature Blob if needed and not already provided as an Object URL
  useEffect(() => {
    let active = true;
    let createdUrl = null;

    const loadSignature = async () => {
      // If external preview is already provided, skip
      if (signaturePreviewUrl || institute?.signaturePreviewUrl) return;

      if (institute?.hasSignature) {
        try {
          const url = await fetchProtectedAssetBlobUrl('/portal/branding-assets/signature');
          if (active) {
            createdUrl = url;
            setInternalSigUrl(url);
            setSigError(false);
          } else {
            revokeProtectedAssetBlobUrl(url);
          }
        } catch (err) {
          if (active) setSigError(true);
        }
      } else {
        setInternalSigUrl(null);
      }
    };

    loadSignature();

    return () => {
      active = false;
      if (createdUrl) revokeProtectedAssetBlobUrl(createdUrl);
    };
  }, [institute?.hasSignature, signaturePreviewUrl, institute?.signaturePreviewUrl]);

  // 2. Fetch Protected Stamp Blob if needed and not already provided as an Object URL
  useEffect(() => {
    let active = true;
    let createdUrl = null;

    const loadStamp = async () => {
      // If external preview is already provided, skip
      if (stampPreviewUrl || institute?.stampPreviewUrl) return;

      if (institute?.hasStamp) {
        try {
          const url = await fetchProtectedAssetBlobUrl('/portal/branding-assets/stamp');
          if (active) {
            createdUrl = url;
            setInternalStampUrl(url);
            setStampError(false);
          } else {
            revokeProtectedAssetBlobUrl(url);
          }
        } catch (err) {
          if (active) setStampError(true);
        }
      } else {
        setInternalStampUrl(null);
      }
    };

    loadStamp();

    return () => {
      active = false;
      if (createdUrl) revokeProtectedAssetBlobUrl(createdUrl);
    };
  }, [institute?.hasStamp, stampPreviewUrl, institute?.stampPreviewUrl]);

  // -------------------------------------------------------------
  // 1. Document / Printable Variant (Invoices, Official Reports, Certificates)
  // -------------------------------------------------------------
  if (variant === 'document') {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b-2 border-slate-900/10">
          <div className="flex items-center gap-4">
            {logo && !imgError ? (
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200/80 p-1 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
                <img
                  src={logo}
                  alt={name}
                  onError={() => setImgError(true)}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-[#FFD978] flex items-center justify-center font-black text-xl tracking-wider shadow-sm shrink-0 border border-slate-700">
                {initials}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">{name}</h2>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {code}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1 font-medium">
                {institute?.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{institute.address}</span>
                  </span>
                )}
                {institute?.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{institute.phone}</span>
                  </span>
                )}
                {institute?.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{institute.email}</span>
                  </span>
                )}
                {institute?.website && (
                  <span className="flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{institute.website}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {showPlatformBadge && (
            <div className="sm:text-right shrink-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-[10px] font-semibold text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E6BC50]" />
                <span>Powered by EduNexa SaaS</span>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Document Signatures & Official Stamp Section */}
        {showSignatures && (
          <div className="pt-6 mt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-end justify-between gap-6 text-xs">
            {/* Institute Official Stamp Block */}
            <div className="flex flex-col items-center sm:items-start">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-slate-300 p-1 flex items-center justify-center overflow-hidden bg-slate-50/50">
                {hasConfiguredStamp && effectiveStampUrl && !stampError ? (
                  <img
                    src={effectiveStampUrl}
                    alt="Official Institute Stamp"
                    onError={() => setStampError(true)}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-[10px] font-semibold text-slate-400 text-center px-2">
                    {hasConfiguredStamp ? 'Loading Seal...' : 'Institute Seal not configured'}
                  </div>
                )}
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
                Institute Seal
              </span>
            </div>

            {/* Principal / Authorized Signature Block */}
            <div className="flex flex-col items-center sm:items-end text-right">
              {hasConfiguredSignature && effectiveSigUrl && !sigError ? (
                <div className="h-14 max-w-[200px] mb-1 flex items-center justify-end">
                  <img
                    src={effectiveSigUrl}
                    alt="Authorized Signature"
                    onError={() => setSigError(true)}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-10 border-b border-slate-300 w-44 mb-1 flex items-end justify-center">
                  <span className="text-[10px] text-slate-400 pb-0.5">
                    {hasConfiguredSignature ? 'Loading Signature...' : 'Signature not configured'}
                  </span>
                </div>
              )}
              <p className="font-bold text-slate-900 text-sm">
                {institute?.principalName || 'Principal / Director'}
              </p>
              {institute?.principalName && (
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Principal / Director
                </p>
              )}
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Authorized Signature
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. Card / Sidebar Variant
  // -------------------------------------------------------------
  if (variant === 'card') {
    return (
      <div className={`p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80 flex items-center gap-3 shadow-2xs ${className}`}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-[#FFD978] border border-slate-700 flex items-center justify-center font-bold text-xs shadow-xs shrink-0 overflow-hidden">
          {logo && !imgError ? (
            <img
              src={logo}
              alt={name}
              onError={() => setImgError(true)}
              className="w-full h-full object-contain bg-white"
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-slate-900 truncate">{name}</p>
          <p className="text-[10px] font-mono font-bold text-slate-500 mt-0.5">
            CODE: {code}
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 3. Portal Nav Header Variant (Teacher, Student, Parent, Admin)
  // -------------------------------------------------------------
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {logo && !imgError ? (
        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 p-0.5 flex items-center justify-center shadow-2xs shrink-0 overflow-hidden">
          <img
            src={logo}
            alt={name}
            onError={() => setImgError(true)}
            className="w-full h-full object-contain"
          />
        </div>
      ) : (
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-[#FFD978] border border-slate-700 flex items-center justify-center font-black text-xs shadow-2xs shrink-0">
          {initials}
        </div>
      )}

      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-900 truncate max-w-[200px] sm:max-w-[300px]">
            {name}
          </span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
            {code}
          </span>
        </div>
        {showPlatformBadge && (
          <span className="text-[10px] text-slate-400 font-medium truncate">
            Powered by EduNexa
          </span>
        )}
      </div>
    </div>
  );
}
