import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import GlassCard from '../common/GlassCard';
import EduNexaLogo from '../common/EduNexaLogo';
import {
  GraduationCap,
  Shield,
  Sparkles,
  Award,
  Users,
  BookOpen,
  CheckCircle2,
  Zap,
  Globe,
  Lock,
  Heart,
  Lightbulb,
  Layers,
  Rocket,
  Star,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Info,
  Compass,
  Target,
  BookMarked,
  ArrowRight,
} from 'lucide-react';

export function LinkedInIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

// Safe Lucide icon registry for feature cards
export const ICON_MAP = {
  'graduation-cap': GraduationCap,
  'shield': Shield,
  'sparkles': Sparkles,
  'award': Award,
  'users': Users,
  'book-open': BookOpen,
  'check-circle': CheckCircle2,
  'zap': Zap,
  'globe': Globe,
  'lock': Lock,
  'heart': Heart,
  'lightbulb': Lightbulb,
  'layers': Layers,
  'rocket': Rocket,
  'star': Star,
};

/**
 * Safely resolves CMS asset URLs for both public published images and private draft preview images.
 * Attaches auth token to draft asset endpoints and normalizes paths.
 */
export function resolveCmsAssetUrl(assetPath) {
  if (!assetPath || typeof assetPath !== 'string' || assetPath.trim() === '') return '';
  const trimmed = assetPath.trim();
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return trimmed;

  const [basePath, search] = trimmed.split('?');

  // If it's a protected draft asset endpoint, attach auth token for browser <img> / CSS loading
  if (basePath.includes('/platform-cms/admin/draft-asset/')) {
    const token = localStorage.getItem('edunexa_token');
    const queryParams = new URLSearchParams(search || '');
    if (token && !queryParams.has('token')) {
      queryParams.set('token', token);
    }
    const qs = queryParams.toString();
    return `${basePath}${qs ? `?${qs}` : ''}`;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Relative path normalization (e.g. /uploads/platform-cms/public/...)
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export default function PlatformAboutViewer({
  previewData = null,
  isSuperAdmin = false,
  showTitle = true,
}) {
  const [cmsData, setCmsData] = useState(previewData);
  const [loading, setLoading] = useState(!previewData);
  const [error, setError] = useState('');
  const [heroImgError, setHeroImgError] = useState(false);
  const [storyImgError, setStoryImgError] = useState(false);

  useEffect(() => {
    if (previewData) {
      setCmsData(previewData);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchPublishedCms = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await apiRequest('/platform-cms/public');
        if (isMounted) {
          setCmsData(res.data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to load Platform CMS.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPublishedCms();

    return () => {
      isMounted = false;
    };
  }, [previewData]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3">
        <div className="w-9 h-9 border-3 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Loading platform information...</p>
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard padding="p-8" className="text-center max-w-lg mx-auto my-8">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <Info className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-black text-slate-900">Unable to Load Platform CMS</h3>
        <p className="text-sm text-slate-500 mt-1 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-slate-900 text-[#FFD978] rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
        >
          Retry
        </button>
      </GlassCard>
    );
  }

  if (!cmsData) {
    return (
      <GlassCard padding="p-10" className="text-center max-w-xl mx-auto my-8">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-black text-slate-900">
          {isSuperAdmin ? 'No Published Platform CMS Yet' : 'Platform Information Coming Soon'}
        </h3>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
          {isSuperAdmin
            ? 'No published Platform CMS version is live yet. Use the editor to compose and publish platform content.'
            : 'Platform information has not been published yet. Please check back soon.'}
        </p>
      </GlassCard>
    );
  }

  const {
    heroTitle,
    heroSubtitle,
    heroImage,
    heroCtaLabel,
    heroCtaUrl,
    aboutTitle,
    aboutBody,
    vision,
    mission,
    storyTitle,
    storyContent,
    storyImage,
    contactEmail,
    contactPhone,
    contactAddress,
    websiteUrl,
    facebookUrl,
    instagramUrl,
    youtubeUrl,
    linkedinUrl,
    twitterUrl,
    termsUrl,
    privacyUrl,
    features = [],
    teamMembers = [],
  } = cmsData;

  const resolvedHeroUrl = resolveCmsAssetUrl(heroImage);
  const resolvedStoryUrl = resolveCmsAssetUrl(storyImage);

  const hasSocials = Boolean(facebookUrl || instagramUrl || youtubeUrl || linkedinUrl || twitterUrl);
  const hasContacts = Boolean(contactEmail || contactPhone || contactAddress || websiteUrl);
  const hasLegals = Boolean(termsUrl || privacyUrl);

  return (
    <div className="space-y-8 w-full max-w-5xl mx-auto">
      {/* 1. HERO SECTION */}
      {(heroTitle || heroSubtitle || heroImage) && (
        <div
          className="relative rounded-3xl overflow-hidden text-white shadow-xl border border-slate-700/50 bg-slate-900 min-h-[300px] flex items-center"
          style={
            resolvedHeroUrl && !heroImgError
              ? {
                  backgroundImage: `url("${resolvedHeroUrl}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }
              : undefined
          }
        >
          {/* Subtle semi-transparent gradient overlay to ensure text contrast while keeping background photo visible */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/75 to-slate-900/40 z-0 pointer-events-none" />

          {/* Hidden image to trigger onError if background URL fails */}
          {resolvedHeroUrl && !heroImgError && (
            <img
              src={resolvedHeroUrl}
              alt=""
              className="hidden"
              onError={() => setHeroImgError(true)}
            />
          )}

          <div className="relative z-10 p-6 sm:p-10 md:p-14 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFD978]/20 border border-[#FFD978]/40 text-[#FFD978] text-xs font-bold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Official Platform Overview</span>
            </div>

            {heroTitle && (
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight drop-shadow-xs">
                {heroTitle}
              </h1>
            )}

            {heroSubtitle && (
              <p className="text-sm sm:text-base md:text-lg text-slate-200 leading-relaxed max-w-2xl whitespace-pre-wrap drop-shadow-xs">
                {heroSubtitle}
              </p>
            )}

            {heroCtaLabel && heroCtaUrl && (
              <div className="pt-2">
                <a
                  href={heroCtaUrl}
                  target={heroCtaUrl.startsWith('http') ? '_blank' : '_self'}
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FFD978] text-slate-900 font-black text-xs sm:text-sm hover:bg-[#ffe39c] transition-all shadow-md hover:scale-[1.02]"
                >
                  <span>{heroCtaLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. ABOUT EDUNEXA */}
      {(aboutTitle || aboutBody) && (
        <GlassCard padding="p-6 sm:p-10" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100/80 border border-amber-300 text-slate-900 flex items-center justify-center shrink-0">
              <EduNexaLogo size="sm" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {aboutTitle || 'About EduNexa'}
              </h2>
              <p className="text-xs text-slate-500 font-semibold">The Unified Education Management Architecture</p>
            </div>
          </div>

          {aboutBody && (
            <div className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-wrap pt-2">
              {aboutBody}
            </div>
          )}
        </GlassCard>
      )}

      {/* 3. VISION & MISSION */}
      {(vision || mission) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {vision && (
            <GlassCard padding="p-6 sm:p-8" className="space-y-3 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0 shadow-2xs">
                  <Compass className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900">Our Vision</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {vision}
              </p>
            </GlassCard>
          )}

          {mission && (
            <GlassCard padding="p-6 sm:p-8" className="space-y-3 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
                  <Target className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900">Our Mission</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {mission}
              </p>
            </GlassCard>
          )}
        </div>
      )}

      {/* 4. OUR STORY */}
      {(storyTitle || storyContent) && (
        <GlassCard padding="p-6 sm:p-10" className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0 shadow-2xs">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">{storyTitle || 'Our Story'}</h3>
              <p className="text-xs text-slate-500 font-semibold">How EduNexa was built and where we are heading</p>
            </div>
          </div>

          <div className={`grid grid-cols-1 ${resolvedStoryUrl ? 'md:grid-cols-3' : ''} gap-6 items-center`}>
            <div className={`${resolvedStoryUrl ? 'md:col-span-2' : ''} text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-wrap`}>
              {storyContent}
            </div>

            {resolvedStoryUrl && (
              <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                {!storyImgError ? (
                  <img
                    src={resolvedStoryUrl}
                    alt="Our Story"
                    className="w-full h-auto object-cover max-h-72 rounded-2xl"
                    onError={() => setStoryImgError(true)}
                  />
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400 font-semibold">
                    Story image unavailable.
                  </div>
                )}
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* 5. WHY CHOOSE EDUNEXA / DYNAMIC FEATURE CARDS */}
      {features.length > 0 && (
        <div className="space-y-4">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#FFD978]/40 text-slate-900 border border-[#FFD978]/60 uppercase tracking-wider">
              Core Capabilities
            </span>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              Why Choose EduNexa
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Engineered from the ground up for institution efficiency and student achievement
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {features.map((feat) => {
              const IconComponent = ICON_MAP[feat.iconKey] || Sparkles;
              return (
                <GlassCard
                  key={feat.id || feat.title}
                  padding="p-5 sm:p-6"
                  hoverEffect={true}
                  className="flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2.5">
                    <div className="w-10 h-10 rounded-xl bg-[#FFD978]/30 border border-[#FFD978]/60 text-slate-900 flex items-center justify-center shadow-2xs">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-black text-slate-900 leading-snug">
                      {feat.title}
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {feat.description}
                    </p>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. MEET OUR TEAM / LEADERSHIP */}
      {teamMembers.length > 0 && (
        <div className="space-y-4">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200 uppercase tracking-wider">
              Leadership & Builders
            </span>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              Meet Our Team
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              The passionate innovators, educators, and engineers powering the EduNexa vision
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 pt-2">
            {teamMembers.map((member) => {
              const resolvedPhotoUrl = resolveCmsAssetUrl(member.profileImage);
              return (
                <GlassCard
                  key={member.id || member.fullName}
                  padding="p-5"
                  hoverEffect={true}
                  className="flex flex-col items-center text-center space-y-3 relative group"
                >
                  {/* Profile Photo */}
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-xs bg-gradient-to-br from-amber-100 to-amber-200 text-slate-800 font-black text-xl flex items-center justify-center shrink-0 relative">
                    <span>
                      {member.fullName
                        .split(' ')
                        .filter(Boolean)
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase() || 'EN'}
                    </span>

                    {resolvedPhotoUrl && (
                      <img
                        src={resolvedPhotoUrl}
                        alt={member.fullName}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                  </div>

                  {/* Name & Position */}
                  <div className="space-y-1 w-full">
                    <h4 className="text-base font-black text-slate-900 leading-snug">
                      {member.fullName}
                    </h4>
                    <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-0.5 inline-block">
                      {member.position}
                    </p>
                  </div>

                  {/* Bio */}
                  {member.bio && (
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap line-clamp-4">
                      {member.bio}
                    </p>
                  )}

                  {/* Social / Contact Icons */}
                  {(member.linkedinUrl || member.websiteUrl || member.email) && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-2 w-full mt-auto">
                      {member.linkedinUrl && (
                        <a
                          href={member.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="LinkedIn Profile"
                          className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-700 flex items-center justify-center transition-colors shadow-2xs"
                        >
                          <LinkedInIcon className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {member.websiteUrl && (
                        <a
                          href={member.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Personal / Portfolio Website"
                          className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors shadow-2xs"
                        >
                          <Globe className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {member.email && (
                        <a
                          href={`mailto:${member.email}`}
                          title={`Send email to ${member.fullName}`}
                          className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-600 hover:text-emerald-700 flex items-center justify-center transition-colors shadow-2xs"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. CONTACT & SOCIAL DETAILS */}
      {(hasContacts || hasSocials) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact Details */}
          {hasContacts && (
            <GlassCard padding="p-6 sm:p-8" className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <h4 className="text-base font-black text-slate-900">Official Contact</h4>
              </div>

              <div className="space-y-3 text-xs sm:text-sm text-slate-700">
                {contactEmail && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <a href={`mailto:${contactEmail}`} className="hover:text-blue-700 font-semibold transition-colors break-all">
                      {contactEmail}
                    </a>
                  </div>
                )}
                {contactPhone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <a href={`tel:${contactPhone}`} className="hover:text-blue-700 font-semibold transition-colors">
                      {contactPhone}
                    </a>
                  </div>
                )}
                {contactAddress && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span className="whitespace-pre-wrap">{contactAddress}</span>
                  </div>
                )}
                {websiteUrl && (
                  <div className="flex items-center gap-3 pt-1">
                    <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 font-bold hover:underline inline-flex items-center gap-1"
                    >
                      <span>Visit Website</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </GlassCard>
          )}

          {/* Social Channels & Legal Links */}
          {(hasSocials || hasLegals) && (
            <GlassCard padding="p-6 sm:p-8" className="space-y-5 flex flex-col justify-between">
              {hasSocials && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-pink-50 border border-pink-200 text-pink-700 flex items-center justify-center shrink-0">
                      <Globe className="w-4 h-4" />
                    </div>
                    <h4 className="text-base font-black text-slate-900">Connect With Us</h4>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {facebookUrl && (
                      <a
                        href={facebookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-all inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        <span>Facebook</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    )}
                    {instagramUrl && (
                      <a
                        href={instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-pink-600 transition-all inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        <span>Instagram</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    )}
                    {youtubeUrl && (
                      <a
                        href={youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-all inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        <span>YouTube</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    )}
                    {linkedinUrl && (
                      <a
                        href={linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-all inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        <span>LinkedIn</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    )}
                    {twitterUrl && (
                      <a
                        href={twitterUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        <span>X / Twitter</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {hasLegals && (
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
                  {termsUrl && (
                    <a
                      href={termsUrl}
                      target={termsUrl.startsWith('http') ? '_blank' : '_self'}
                      rel="noopener noreferrer"
                      className="hover:text-slate-900 transition-colors inline-flex items-center gap-1"
                    >
                      <span>Terms & Conditions</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {privacyUrl && (
                    <a
                      href={privacyUrl}
                      target={privacyUrl.startsWith('http') ? '_blank' : '_self'}
                      rel="noopener noreferrer"
                      className="hover:text-slate-900 transition-colors inline-flex items-center gap-1"
                    >
                      <span>Privacy Policy</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </GlassCard>
          )}
        </div>
      )}
    </div>
  );
}
