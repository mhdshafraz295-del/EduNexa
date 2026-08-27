import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';
import PageHeader from '../../../components/common/PageHeader';
import GlassCard from '../../../components/common/GlassCard';
import PlatformAboutViewer, { ICON_MAP, resolveCmsAssetUrl, CmsImage, LinkedInIcon } from '../../../components/cms/PlatformAboutViewer';
import {
  Sparkles,
  Save,
  Send,
  Eye,
  RotateCcw,
  Image as ImageIcon,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  HelpCircle,
  ExternalLink,
  Upload,
  Layers,
  Compass,
  Target,
  BookMarked,
  Mail,
  FileText,
  X,
  Users,
  Edit3,
  Globe,
} from 'lucide-react';

const SECTIONS = [
  { id: 'hero', label: 'Hero Banner', icon: Sparkles },
  { id: 'about', label: 'About EduNexa', icon: Layers },
  { id: 'vision_mission', label: 'Vision & Mission', icon: Compass },
  { id: 'story', label: 'Our Story', icon: BookMarked },
  { id: 'features', label: 'Why Choose Us', icon: Target },
  { id: 'team', label: 'Team & Leadership', icon: Users },
  { id: 'contact_social', label: 'Contact & Social', icon: Mail },
  { id: 'legal', label: 'Legal Links', icon: FileText },
  { id: 'preview', label: 'Live Preview', icon: Eye },
];

const AVAILABLE_ICONS = Object.keys(ICON_MAP);

const INITIAL_TEAM_MEMBER = {
  id: null,
  fullName: '',
  position: '',
  bio: '',
  profileImage: '',
  linkedinUrl: '',
  websiteUrl: '',
  email: '',
  displayOrder: 0,
  isActive: true,
};

export default function PlatformCmsPage() {
  const [activeSection, setActiveSection] = useState('hero');
  const [formData, setFormData] = useState({
    heroTitle: '',
    heroSubtitle: '',
    heroImage: '',
    heroCtaLabel: '',
    heroCtaUrl: '',
    aboutTitle: '',
    aboutBody: '',
    vision: '',
    mission: '',
    storyTitle: '',
    storyContent: '',
    storyImage: '',
    contactEmail: '',
    contactPhone: '',
    contactAddress: '',
    websiteUrl: '',
    facebookUrl: '',
    instagramUrl: '',
    youtubeUrl: '',
    linkedinUrl: '',
    twitterUrl: '',
    termsUrl: '',
    privacyUrl: '',
    features: [],
    teamMembers: [],
  });

  const [liveMetadata, setLiveMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingField, setUploadingField] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Team Member Modal State
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeamMemberIndex, setEditingTeamMemberIndex] = useState(null);
  const [teamMemberForm, setTeamMemberForm] = useState(INITIAL_TEAM_MEMBER);
  const [uploadingTeamImage, setUploadingTeamImage] = useState(false);
  const [teamModalError, setTeamModalError] = useState('');

  const fetchDraftData = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const res = await apiRequest('/platform-cms/admin');
      if (res.success && res.data) {
        const draft = res.data.draft || {};
        setFormData({
          heroTitle: draft.heroTitle || '',
          heroSubtitle: draft.heroSubtitle || '',
          heroImage: draft.heroImage || '',
          heroCtaLabel: draft.heroCtaLabel || '',
          heroCtaUrl: draft.heroCtaUrl || '',
          aboutTitle: draft.aboutTitle || '',
          aboutBody: draft.aboutBody || '',
          vision: draft.vision || '',
          mission: draft.mission || '',
          storyTitle: draft.storyTitle || '',
          storyContent: draft.storyContent || '',
          storyImage: draft.storyImage || '',
          contactEmail: draft.contactEmail || '',
          contactPhone: draft.contactPhone || '',
          contactAddress: draft.contactAddress || '',
          websiteUrl: draft.websiteUrl || '',
          facebookUrl: draft.facebookUrl || '',
          instagramUrl: draft.instagramUrl || '',
          youtubeUrl: draft.youtubeUrl || '',
          linkedinUrl: draft.linkedinUrl || '',
          twitterUrl: draft.twitterUrl || '',
          termsUrl: draft.termsUrl || '',
          privacyUrl: draft.privacyUrl || '',
          features: (draft.features || []).map((f) => ({
            id: f.id,
            title: f.title || '',
            description: f.description || '',
            iconKey: f.iconKey || 'graduation-cap',
            displayOrder: f.displayOrder || 0,
            isActive: f.isActive !== undefined ? f.isActive : true,
          })),
          teamMembers: (draft.teamMembers || []).map((m) => ({
            id: m.id,
            fullName: m.fullName || '',
            position: m.position || '',
            bio: m.bio || '',
            profileImage: m.profileImage || '',
            linkedinUrl: m.linkedinUrl || '',
            websiteUrl: m.websiteUrl || '',
            email: m.email || '',
            displayOrder: m.displayOrder || 0,
            isActive: m.isActive !== undefined ? m.isActive : true,
          })),
        });
        setLiveMetadata(res.data.liveMetadata);
        setIsDirty(false);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load CMS draft.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetDraft = async () => {
    if (!window.confirm('Reset draft to currently live published content? Any unsaved draft changes will be discarded.')) {
      return;
    }
    try {
      setLoading(true);
      setErrorMessage('');
      const res = await apiRequest('/platform-cms/admin/reset-draft', { method: 'POST' });
      if (res.success && res.data) {
        const draft = res.data.draft || {};
        setFormData({
          heroTitle: draft.heroTitle || '',
          heroSubtitle: draft.heroSubtitle || '',
          heroImage: draft.heroImage || '',
          heroCtaLabel: draft.heroCtaLabel || '',
          heroCtaUrl: draft.heroCtaUrl || '',
          aboutTitle: draft.aboutTitle || '',
          aboutBody: draft.aboutBody || '',
          vision: draft.vision || '',
          mission: draft.mission || '',
          storyTitle: draft.storyTitle || '',
          storyContent: draft.storyContent || '',
          storyImage: draft.storyImage || '',
          contactEmail: draft.contactEmail || '',
          contactPhone: draft.contactPhone || '',
          contactAddress: draft.contactAddress || '',
          websiteUrl: draft.websiteUrl || '',
          facebookUrl: draft.facebookUrl || '',
          instagramUrl: draft.instagramUrl || '',
          youtubeUrl: draft.youtubeUrl || '',
          linkedinUrl: draft.linkedinUrl || '',
          twitterUrl: draft.twitterUrl || '',
          termsUrl: draft.termsUrl || '',
          privacyUrl: draft.privacyUrl || '',
          features: (draft.features || []).map((f) => ({
            id: f.id,
            title: f.title || '',
            description: f.description || '',
            iconKey: f.iconKey || 'graduation-cap',
            displayOrder: f.displayOrder || 0,
            isActive: f.isActive !== undefined ? f.isActive : true,
          })),
          teamMembers: (draft.teamMembers || []).map((m) => ({
            id: m.id,
            fullName: m.fullName || '',
            position: m.position || '',
            bio: m.bio || '',
            profileImage: m.profileImage || '',
            linkedinUrl: m.linkedinUrl || '',
            websiteUrl: m.websiteUrl || '',
            email: m.email || '',
            displayOrder: m.displayOrder || 0,
            isActive: m.isActive !== undefined ? m.isActive : true,
          })),
        });
        setLiveMetadata(res.data.liveMetadata);
        setIsDirty(false);
        setSuccessMessage('Draft reset to live published content.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to reset draft.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDraftData();
  }, []);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setSuccessMessage('');
  };

  // Image Upload Handler
  const handleImageUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|png|webp)$/i)) {
      setErrorMessage('Unsupported image type. Only JPG, PNG, and WebP are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image size exceeds maximum allowed 5MB limit.');
      return;
    }

    const uploadPayload = new FormData();
    uploadPayload.append('image', file);
    uploadPayload.append('field', field);

    setUploadingField(field);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await apiRequest('/platform-cms/admin/upload-image', {
        method: 'POST',
        body: uploadPayload,
      });

      if (res.success && res.data?.draftUrl) {
        handleChange(field, res.data.draftUrl);
        setSuccessMessage(`${field === 'heroImage' ? 'Hero' : 'Story'} image uploaded to draft.`);
      } else {
        setErrorMessage(res.message || 'Failed to upload image.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Image upload error.');
    } finally {
      setUploadingField(null);
      e.target.value = '';
    }
  };

  // Save Draft Action
  const handleSaveDraft = async () => {
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await apiRequest('/platform-cms/admin/draft', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      if (res.success) {
        setSuccessMessage('Platform CMS draft saved successfully.');
        setIsDirty(false);
        if (res.data?.liveMetadata) {
          setLiveMetadata(res.data.liveMetadata);
        }
      } else {
        setErrorMessage(res.message || 'Failed to save draft.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error saving draft.');
    } finally {
      setSaving(false);
    }
  };

  // Publish Action
  const handlePublish = async () => {
    if (!window.confirm('Are you sure you want to publish these changes live to all EduNexa portals and public viewers?')) {
      return;
    }

    setPublishing(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await apiRequest('/platform-cms/admin/publish', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      if (res.success) {
        setSuccessMessage(`Platform CMS published successfully! (Version ${res.data?.version || 'Live'})`);
        setIsDirty(false);
        await fetchDraftData();
      } else {
        setErrorMessage(res.message || 'Failed to publish CMS.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error publishing content.');
    } finally {
      setPublishing(false);
    }
  };

  // Feature Card CRUD Operations
  const handleAddFeature = () => {
    setFormData((prev) => ({
      ...prev,
      features: [
        ...prev.features,
        {
          title: '',
          description: '',
          iconKey: 'graduation-cap',
          displayOrder: prev.features.length,
          isActive: true,
        },
      ],
    }));
    setIsDirty(true);
  };

  const handleUpdateFeature = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.features];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, features: updated };
    });
    setIsDirty(true);
  };

  const handleRemoveFeature = (index) => {
    setFormData((prev) => {
      const updated = prev.features.filter((_, i) => i !== index);
      return {
        ...prev,
        features: updated.map((f, i) => ({ ...f, displayOrder: i })),
      };
    });
    setIsDirty(true);
  };

  const handleMoveFeature = (index, direction) => {
    setFormData((prev) => {
      const features = [...prev.features];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= features.length) return prev;
      const temp = features[index];
      features[index] = features[targetIndex];
      features[targetIndex] = temp;
      return {
        ...prev,
        features: features.map((f, i) => ({ ...f, displayOrder: i })),
      };
    });
    setIsDirty(true);
  };

  // ==========================================
  // Team Member Management Handlers
  // ==========================================
  const openAddTeamMemberModal = () => {
    setTeamMemberForm({
      ...INITIAL_TEAM_MEMBER,
      displayOrder: formData.teamMembers.length,
    });
    setEditingTeamMemberIndex(null);
    setTeamModalError('');
    setShowTeamModal(true);
  };

  const openEditTeamMemberModal = (index) => {
    const member = formData.teamMembers[index];
    if (!member) return;
    setTeamMemberForm({ ...member });
    setEditingTeamMemberIndex(index);
    setTeamModalError('');
    setShowTeamModal(true);
  };

  const handleSaveTeamMemberModal = () => {
    if (!teamMemberForm.fullName.trim()) {
      setTeamModalError('Full Name is required.');
      return;
    }
    if (!teamMemberForm.position.trim()) {
      setTeamModalError('Position / Role is required.');
      return;
    }

    // URL validation
    const checkUrl = (url, name) => {
      if (!url || typeof url !== 'string' || !url.trim()) return true;
      const lower = url.trim().toLowerCase();
      if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('file:')) {
        setTeamModalError(`Unsafe URL detected for ${name}.`);
        return false;
      }
      return true;
    };

    if (!checkUrl(teamMemberForm.linkedinUrl, 'LinkedIn URL')) return;
    if (!checkUrl(teamMemberForm.websiteUrl, 'Website URL')) return;

    if (teamMemberForm.email && teamMemberForm.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(teamMemberForm.email.trim())) {
        setTeamModalError('Please enter a valid email address.');
        return;
      }
    }

    setFormData((prev) => {
      const updated = [...prev.teamMembers];
      if (editingTeamMemberIndex !== null) {
        updated[editingTeamMemberIndex] = {
          ...teamMemberForm,
          fullName: teamMemberForm.fullName.trim(),
          position: teamMemberForm.position.trim(),
        };
      } else {
        updated.push({
          ...teamMemberForm,
          fullName: teamMemberForm.fullName.trim(),
          position: teamMemberForm.position.trim(),
          displayOrder: updated.length,
        });
      }
      return {
        ...prev,
        teamMembers: updated.map((m, idx) => ({ ...m, displayOrder: idx })),
      };
    });

    setIsDirty(true);
    setShowTeamModal(false);
  };

  const handleRemoveTeamMember = (index) => {
    if (!window.confirm('Are you sure you want to remove this team member?')) return;
    setFormData((prev) => {
      const updated = prev.teamMembers.filter((_, i) => i !== index);
      return {
        ...prev,
        teamMembers: updated.map((m, i) => ({ ...m, displayOrder: i })),
      };
    });
    setIsDirty(true);
  };

  const handleMoveTeamMember = (index, direction) => {
    setFormData((prev) => {
      const team = [...prev.teamMembers];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= team.length) return prev;
      const temp = team[index];
      team[index] = team[targetIndex];
      team[targetIndex] = temp;
      return {
        ...prev,
        teamMembers: team.map((m, i) => ({ ...m, displayOrder: i })),
      };
    });
    setIsDirty(true);
  };

  const handleToggleTeamMemberActive = (index) => {
    setFormData((prev) => {
      const updated = [...prev.teamMembers];
      updated[index] = { ...updated[index], isActive: !updated[index].isActive };
      return { ...prev, teamMembers: updated };
    });
    setIsDirty(true);
  };

  const handleTeamImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setTeamModalError('Team profile photo must be less than 5MB.');
      return;
    }

    setUploadingTeamImage(true);
    setTeamModalError('');
    try {
      const uploadForm = new FormData();
      uploadForm.append('image', file);
      uploadForm.append('field', 'team');

      const res = await apiRequest('/platform-cms/admin/upload-image', {
        method: 'POST',
        body: uploadForm,
      });

      if (res.success && res.data?.draftUrl) {
        setTeamMemberForm((prev) => ({
          ...prev,
          profileImage: res.data.draftUrl,
        }));
      } else {
        setTeamModalError(res.message || 'Failed to upload profile photo.');
      }
    } catch (err) {
      setTeamModalError(err.message || 'Error uploading profile photo.');
    } finally {
      setUploadingTeamImage(false);
      e.target.value = '';
    }
  };

  const handleRemoveTeamMemberImage = () => {
    setTeamMemberForm((prev) => ({
      ...prev,
      profileImage: null,
    }));
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Loading Platform CMS workspace...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Page Header */}
      <PageHeader
        title="EduNexa Platform CMS"
        description="Manage the official platform about, vision, mission, story, dynamic features, contact, and branding content across all portals."
        badge="Platform Governance"
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowPreviewModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 hover:text-slate-900 transition-all shadow-2xs"
            >
              <Eye className="w-4 h-4 text-slate-500" />
              <span>Preview</span>
            </button>

            <button
              onClick={handleSaveDraft}
              disabled={saving || publishing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs hover:bg-slate-800 transition-all shadow-2xs disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Draft...' : 'Save Draft'}</span>
            </button>

            <button
              onClick={handlePublish}
              disabled={saving || publishing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFD978] text-slate-900 font-black text-xs hover:bg-[#ffe39c] transition-all shadow-xs border border-[#E6BC50] disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{publishing ? 'Publishing...' : 'Publish Live'}</span>
            </button>
          </div>
        }
      />

      {/* Publication Status & Audit Strip */}
      <GlassCard padding="p-4 sm:p-5" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-900">
                {liveMetadata?.version ? `Live Published Version: v${liveMetadata.version}` : 'Status: No Live Version Published'}
              </span>
              {isDirty && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                  Unsaved Draft Changes
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {liveMetadata?.publishedAt
                ? `Last published on ${new Date(liveMetadata.publishedAt).toLocaleString()} by ${liveMetadata.publishedBy?.username || 'Super Admin'}`
                : 'Saving a draft keeps edits private until explicitly published.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDraft}
            title="Reset draft from live published version"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Draft</span>
          </button>
        </div>
      </GlassCard>

      {/* Feedback Messages */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Section Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 text-xs sm:text-sm font-bold">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-slate-900 text-[#FFD978] shadow-xs'
                  : 'bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900 border border-slate-200/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{section.label}</span>
            </button>
          );
        })}
      </div>

      {/* Section Content Area */}
      <div className="pt-2">
        {/* 1. HERO SECTION EDITOR */}
        {activeSection === 'hero' && (
          <GlassCard padding="p-6 sm:p-8" className="space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900">Hero & Headline Banner</h3>
              <p className="text-xs text-slate-500">Configure the top platform showcase headline, subtitle, and primary call-to-action.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hero Title</label>
                  <input
                    type="text"
                    value={formData.heroTitle}
                    onChange={(e) => handleChange('heroTitle', e.target.value)}
                    placeholder="e.g. Welcome to EduNexa NextGen Learning"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hero Subtitle</label>
                  <textarea
                    rows={4}
                    value={formData.heroSubtitle}
                    onChange={(e) => handleChange('heroSubtitle', e.target.value)}
                    placeholder="e.g. Empowering institutes, educators, and students with state-of-the-art management tools."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">CTA Button Label</label>
                    <input
                      type="text"
                      value={formData.heroCtaLabel}
                      onChange={(e) => handleChange('heroCtaLabel', e.target.value)}
                      placeholder="e.g. Get Started"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">CTA URL</label>
                    <input
                      type="text"
                      value={formData.heroCtaUrl}
                      onChange={(e) => handleChange('heroCtaUrl', e.target.value)}
                      placeholder="e.g. /register or https://..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                    />
                  </div>
                </div>
              </div>

              {/* Hero Image Upload & Preview */}
              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-700">Hero Banner Background Image</label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-3 bg-slate-50/50">
                  {formData.heroImage ? (
                    <div className="space-y-3">
                      <div className="rounded-xl overflow-hidden max-h-48 border border-slate-200 shadow-xs">
                        <CmsImage
                          src={formData.heroImage}
                          alt="Hero Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleChange('heroImage', null)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold"
                      >
                        Remove Hero Image
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 py-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-100/80 text-slate-800 flex items-center justify-center mx-auto">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <p className="text-xs text-slate-600 font-semibold">JPG, PNG, or WebP up to 5MB</p>
                    </div>
                  )}

                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-[#FFD978] text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingField === 'heroImage' ? 'Uploading Image...' : formData.heroImage ? 'Change Image' : 'Upload Banner'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'heroImage')}
                      disabled={uploadingField !== null}
                    />
                  </label>
                </div>
              </div>
            </div>
          </GlassCard>
        )}

        {/* 2. ABOUT EDUNEXA EDITOR */}
        {activeSection === 'about' && (
          <GlassCard padding="p-6 sm:p-8" className="space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900">About EduNexa Information</h3>
              <p className="text-xs text-slate-500">Official description of the EduNexa multi-tenant management ecosystem.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">About Section Title</label>
                <input
                  type="text"
                  value={formData.aboutTitle}
                  onChange={(e) => handleChange('aboutTitle', e.target.value)}
                  placeholder="e.g. About EduNexa Platform"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">About Body Description</label>
                <textarea
                  rows={8}
                  value={formData.aboutBody}
                  onChange={(e) => handleChange('aboutBody', e.target.value)}
                  placeholder="Comprehensive description of EduNexa features, institutional benefits, and technological foundations..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                />
              </div>
            </div>
          </GlassCard>
        )}

        {/* 3. VISION & MISSION EDITOR */}
        {activeSection === 'vision_mission' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GlassCard padding="p-6 sm:p-8" className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Vision Statement</h3>
                  <p className="text-[11px] text-slate-500">Long-term aspiration for the platform</p>
                </div>
              </div>

              <textarea
                rows={6}
                value={formData.vision}
                onChange={(e) => handleChange('vision', e.target.value)}
                placeholder="To revolutionize academic administration globally with seamless digital workflows..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
              />
            </GlassCard>

            <GlassCard padding="p-6 sm:p-8" className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Mission Statement</h3>
                  <p className="text-[11px] text-slate-500">Core purpose and daily objective</p>
                </div>
              </div>

              <textarea
                rows={6}
                value={formData.mission}
                onChange={(e) => handleChange('mission', e.target.value)}
                placeholder="To empower educators, students, and institutions with accessible cloud intelligence..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
              />
            </GlassCard>
          </div>
        )}

        {/* 4. OUR STORY EDITOR */}
        {activeSection === 'story' && (
          <GlassCard padding="p-6 sm:p-8" className="space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900">Our Story & Heritage</h3>
              <p className="text-xs text-slate-500">The founding history, challenges solved, and platform roadmap.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Story Section Title</label>
                  <input
                    type="text"
                    value={formData.storyTitle}
                    onChange={(e) => handleChange('storyTitle', e.target.value)}
                    placeholder="e.g. The Story of EduNexa"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Story Content</label>
                  <textarea
                    rows={6}
                    value={formData.storyContent}
                    onChange={(e) => handleChange('storyContent', e.target.value)}
                    placeholder="Narrative describing how EduNexa originated and evolved..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>
              </div>

              {/* Story Image Upload */}
              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-700">Story Illustration / Photo</label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-3 bg-slate-50/50">
                  {formData.storyImage ? (
                    <div className="space-y-3">
                      <div className="rounded-xl overflow-hidden max-h-48 border border-slate-200 shadow-xs">
                        <CmsImage
                          src={formData.storyImage}
                          alt="Story Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleChange('storyImage', null)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold"
                      >
                        Remove Story Image
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 py-4">
                      <div className="w-12 h-12 rounded-2xl bg-purple-100/80 text-purple-800 flex items-center justify-center mx-auto">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <p className="text-xs text-slate-600 font-semibold">JPG, PNG, or WebP up to 5MB</p>
                    </div>
                  )}

                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-[#FFD978] text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingField === 'storyImage' ? 'Uploading Image...' : formData.storyImage ? 'Change Image' : 'Upload Photo'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'storyImage')}
                      disabled={uploadingField !== null}
                    />
                  </label>
                </div>
              </div>
            </div>
          </GlassCard>
        )}

        {/* 5. WHY CHOOSE EDUNEXA / DYNAMIC FEATURE CARDS */}
        {activeSection === 'features' && (
          <div className="space-y-4">
            <GlassCard padding="p-6 sm:p-8" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Why Choose EduNexa (Feature Cards)</h3>
                <p className="text-xs text-slate-500">Create, customize, reorder, or deactivate highlight cards shown on the platform About viewer.</p>
              </div>
              <button
                onClick={handleAddFeature}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFD978] text-slate-900 font-black text-xs hover:bg-[#ffe39c] transition-all shadow-xs border border-[#E6BC50]"
              >
                <Plus className="w-4 h-4" />
                <span>Add Feature Card</span>
              </button>
            </GlassCard>

            {formData.features.length === 0 ? (
              <GlassCard padding="p-8" className="text-center text-slate-500 text-sm">
                No feature cards configured. Click "Add Feature Card" to showcase key platform benefits.
              </GlassCard>
            ) : (
              <div className="space-y-3">
                {formData.features.map((feat, index) => {
                  const IconComp = ICON_MAP[feat.iconKey] || Sparkles;
                  return (
                    <GlassCard key={index} padding="p-5" className="space-y-4">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[#FFD978]/40 border border-[#FFD978]/80 text-slate-900 flex items-center justify-center">
                            <IconComp className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-black text-slate-900">Card #{index + 1}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${feat.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                            {feat.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleMoveFeature(index, -1)}
                            disabled={index === 0}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30"
                            title="Move Up"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleMoveFeature(index, 1)}
                            disabled={index === formData.features.length - 1}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30"
                            title="Move Down"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveFeature(index)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            title="Delete Card"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-slate-700 mb-1">Feature Title</label>
                          <input
                            type="text"
                            value={feat.title}
                            onChange={(e) => handleUpdateFeature(index, 'title', e.target.value)}
                            placeholder="e.g. Multi-Tenant School Ecosystem"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Icon Style</label>
                          <select
                            value={feat.iconKey}
                            onChange={(e) => handleUpdateFeature(index, 'iconKey', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold bg-white focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                          >
                            {AVAILABLE_ICONS.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                        <textarea
                          rows={2}
                          value={feat.description}
                          onChange={(e) => handleUpdateFeature(index, 'description', e.target.value)}
                          placeholder="Short summary highlighting this capability..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`active-feat-${index}`}
                          checked={feat.isActive}
                          onChange={(e) => handleUpdateFeature(index, 'isActive', e.target.checked)}
                          className="rounded text-slate-900 focus:ring-[#FFD978]"
                        />
                        <label htmlFor={`active-feat-${index}`} className="text-xs font-semibold text-slate-700 cursor-pointer">
                          Display this feature card to public and portal readers
                        </label>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TEAM & LEADERSHIP EDITOR */}
        {activeSection === 'team' && (
          <div className="space-y-6">
            <GlassCard padding="p-6 sm:p-8" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Leadership & Team Members</h3>
                <p className="text-xs text-slate-500">
                  Introduce EduNexa founders, executives, engineers, designers, and key contributors.
                </p>
              </div>

              <button
                onClick={openAddTeamMemberModal}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs hover:bg-slate-800 transition-all shadow-xs shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Team Member</span>
              </button>
            </GlassCard>

            {formData.teamMembers.length === 0 ? (
              <GlassCard padding="p-10" className="text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-600">No team members added yet.</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Click "Add Team Member" above to add founders, leadership, and developers to the official EduNexa about page.
                </p>
              </GlassCard>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.teamMembers.map((member, index) => {
                  const resolvedImgUrl = resolveCmsAssetUrl(member.profileImage);
                  return (
                    <GlassCard key={index} padding="p-5" className="space-y-4 flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                          {/* Avatar preview */}
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-amber-100 to-amber-200 border border-slate-200 shrink-0 flex items-center justify-center relative text-slate-800 font-black text-xs">
                            <span>
                              {member.fullName
                                .split(' ')
                                .filter(Boolean)
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase() || 'TM'}
                            </span>
                            {member.profileImage && (
                              <CmsImage
                                src={member.profileImage}
                                alt={member.fullName}
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                            )}
                          </div>

                          <div>
                            <h4 className="text-sm font-black text-slate-900 leading-tight">
                              {member.fullName || 'Untitled Member'}
                            </h4>
                            <p className="text-xs font-bold text-amber-700">
                              {member.position || 'No Role Set'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMoveTeamMember(index, -1)}
                            disabled={index === 0}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30"
                            title="Move Up"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleMoveTeamMember(index, 1)}
                            disabled={index === formData.teamMembers.length - 1}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30"
                            title="Move Down"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditTeamMemberModal(index)}
                            className="p-1.5 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            title="Edit Member"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveTeamMember(index)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            title="Delete Member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {member.bio && (
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                          {member.bio}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleTeamMemberActive(index)}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors ${
                              member.isActive
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {member.isActive ? 'Active (Visible)' : 'Inactive (Hidden)'}
                          </button>
                        </div>

                        <div className="flex items-center gap-2 text-slate-400">
                          {member.linkedinUrl && <LinkedInIcon className="w-3.5 h-3.5 text-blue-600" title="LinkedIn added" />}
                          {member.websiteUrl && <Globe className="w-3.5 h-3.5 text-amber-600" title="Website added" />}
                          {member.email && <Mail className="w-3.5 h-3.5 text-emerald-600" title="Email added" />}
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 6. CONTACT & SOCIAL EDITOR */}
        {activeSection === 'contact_social' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GlassCard padding="p-6 sm:p-8" className="space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Official Platform Contacts</h3>
                <p className="text-xs text-slate-500">Platform-level communication channels (not institute-specific).</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official Email</label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => handleChange('contactEmail', e.target.value)}
                    placeholder="contact@edunexa.edu"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official Phone</label>
                  <input
                    type="text"
                    value={formData.contactPhone}
                    onChange={(e) => handleChange('contactPhone', e.target.value)}
                    placeholder="+1-800-EDUNEXA"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Physical / Headquarter Address</label>
                  <textarea
                    rows={3}
                    value={formData.contactAddress}
                    onChange={(e) => handleChange('contactAddress', e.target.value)}
                    placeholder="100 Innovation Way, Silicon Plaza"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Platform Website URL</label>
                  <input
                    type="text"
                    value={formData.websiteUrl}
                    onChange={(e) => handleChange('websiteUrl', e.target.value)}
                    placeholder="https://edunexa.edu"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>
              </div>
            </GlassCard>

            <GlassCard padding="p-6 sm:p-8" className="space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Social Media Channels</h3>
                <p className="text-xs text-slate-500">Must be secure HTTPS URLs.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Facebook URL</label>
                  <input
                    type="text"
                    value={formData.facebookUrl}
                    onChange={(e) => handleChange('facebookUrl', e.target.value)}
                    placeholder="https://facebook.com/edunexa"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Instagram URL</label>
                  <input
                    type="text"
                    value={formData.instagramUrl}
                    onChange={(e) => handleChange('instagramUrl', e.target.value)}
                    placeholder="https://instagram.com/edunexa"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">YouTube URL</label>
                  <input
                    type="text"
                    value={formData.youtubeUrl}
                    onChange={(e) => handleChange('youtubeUrl', e.target.value)}
                    placeholder="https://youtube.com/@edunexa"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">LinkedIn URL</label>
                  <input
                    type="text"
                    value={formData.linkedinUrl}
                    onChange={(e) => handleChange('linkedinUrl', e.target.value)}
                    placeholder="https://linkedin.com/company/edunexa"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">X / Twitter URL</label>
                  <input
                    type="text"
                    value={formData.twitterUrl}
                    onChange={(e) => handleChange('twitterUrl', e.target.value)}
                    placeholder="https://x.com/edunexa"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {/* 7. LEGAL LINKS EDITOR */}
        {activeSection === 'legal' && (
          <GlassCard padding="p-6 sm:p-8" className="space-y-6 max-w-2xl">
            <div>
              <h3 className="text-lg font-black text-slate-900">Platform Legal Links</h3>
              <p className="text-xs text-slate-500">Provide external HTTPS URLs or internal routes (e.g. /terms, /privacy).</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Terms & Conditions URL</label>
                <input
                  type="text"
                  value={formData.termsUrl}
                  onChange={(e) => handleChange('termsUrl', e.target.value)}
                  placeholder="e.g. /terms or https://..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Privacy Policy URL</label>
                <input
                  type="text"
                  value={formData.privacyUrl}
                  onChange={(e) => handleChange('privacyUrl', e.target.value)}
                  placeholder="e.g. /privacy or https://..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                />
              </div>
            </div>
          </GlassCard>
        )}

        {/* 8. EMBEDDED LIVE PREVIEW */}
        {activeSection === 'preview' && (
          <div className="space-y-4">
            <GlassCard padding="p-4" className="bg-amber-50/70 border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-700" />
                <span>Live Draft Preview (Shows exactly how content will look upon publish)</span>
              </div>
              <button
                onClick={handlePublish}
                className="px-3 py-1 bg-slate-900 text-[#FFD978] rounded-lg text-xs font-bold hover:bg-slate-800"
              >
                Publish Now
              </button>
            </GlassCard>

            <PlatformAboutViewer previewData={formData} isSuperAdmin={true} />
          </div>
        )}
      </div>

      {/* FULLSCREEN / MODAL PREVIEW */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex flex-col justify-between overflow-y-auto p-4 sm:p-6 md:p-10 animate-fade-in">
          <div className="max-w-5xl w-full mx-auto bg-white rounded-3xl p-6 sm:p-10 shadow-2xl border border-slate-200 space-y-6 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-slate-700" />
                <h3 className="text-lg font-black text-slate-900">Platform About — Draft Preview</h3>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <PlatformAboutViewer previewData={formData} isSuperAdmin={true} />

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  handlePublish();
                }}
                className="px-5 py-2 rounded-xl bg-[#FFD978] text-slate-900 font-black text-xs hover:bg-[#ffe39c] transition-all shadow-xs border border-[#E6BC50]"
              >
                Publish Live
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEAM MEMBER ADD / EDIT MODAL */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex flex-col justify-center items-center overflow-y-auto p-4 sm:p-6 animate-fade-in">
          <div className="max-w-lg w-full bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {editingTeamMemberIndex !== null ? 'Edit Team Member' : 'Add Team Member'}
                </h3>
                <p className="text-xs text-slate-500">Configure profile, custom role, bio, and social links.</p>
              </div>
              <button
                onClick={() => setShowTeamModal(false)}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {teamModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{teamModalError}</span>
              </div>
            )}

            {/* Profile Photo Upload */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Profile Photo</label>
              <div className="flex items-center gap-4 p-3 border border-slate-200 rounded-2xl bg-slate-50/50">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs relative text-slate-400">
                  <ImageIcon className="w-6 h-6" />
                  {teamMemberForm.profileImage && (
                    <CmsImage
                      src={teamMemberForm.profileImage}
                      alt="Profile preview"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                </div>

                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-[#FFD978] text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingTeamImage ? 'Uploading...' : teamMemberForm.profileImage ? 'Change Photo' : 'Upload Photo'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleTeamImageUpload}
                        disabled={uploadingTeamImage}
                      />
                    </label>

                    {teamMemberForm.profileImage && (
                      <button
                        type="button"
                        onClick={handleRemoveTeamMemberImage}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">JPG, PNG, or WebP up to 5MB</p>
                </div>
              </div>
            </div>

            {/* Full Name & Position */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={teamMemberForm.fullName}
                  onChange={(e) => setTeamMemberForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  placeholder="e.g. Naseerdeen Mohamed Safras"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Position / Role <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={teamMemberForm.position}
                  onChange={(e) => setTeamMemberForm((prev) => ({ ...prev, position: e.target.value }))}
                  placeholder="e.g. Founder & CEO or Lead Engineer"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                />
                {/* Quick suggestions */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {['Founder & CEO', 'Co-Founder', 'CTO', 'Lead Designer', 'Software Engineer'].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setTeamMemberForm((prev) => ({ ...prev, position: role }))}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Short Bio */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Short Bio / Narrative</label>
              <textarea
                rows={3}
                value={teamMemberForm.bio || ''}
                onChange={(e) => setTeamMemberForm((prev) => ({ ...prev, bio: e.target.value }))}
                placeholder="Brief description of background, achievements, or vision..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
              />
            </div>

            {/* Social & Contact Links */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">LinkedIn URL (optional)</label>
                <input
                  type="text"
                  value={teamMemberForm.linkedinUrl || ''}
                  onChange={(e) => setTeamMemberForm((prev) => ({ ...prev, linkedinUrl: e.target.value }))}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Website URL (optional)</label>
                  <input
                    type="text"
                    value={teamMemberForm.websiteUrl || ''}
                    onChange={(e) => setTeamMemberForm((prev) => ({ ...prev, websiteUrl: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address (optional)</label>
                  <input
                    type="email"
                    value={teamMemberForm.email || ''}
                    onChange={(e) => setTeamMemberForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="name@edunexa.edu"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <input
                type="checkbox"
                id="team-member-active-check"
                checked={teamMemberForm.isActive}
                onChange={(e) => setTeamMemberForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                className="rounded text-slate-900 focus:ring-[#FFD978]"
              />
              <label htmlFor="team-member-active-check" className="text-xs font-semibold text-slate-700 cursor-pointer">
                Display this member in public and portal "Meet Our Team" section
              </label>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTeamModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTeamMemberModal}
                className="px-5 py-2 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs hover:bg-slate-800 transition-all shadow-xs"
              >
                {editingTeamMemberIndex !== null ? 'Update Member' : 'Save Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
