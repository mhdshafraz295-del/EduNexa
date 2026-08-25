import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../../services/api';
import { X, Building2, UserPlus, Key, Mail, Phone, MapPin, Globe, Check, Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import BrandingImageUploader from '../../components/common/BrandingImageUploader';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE_MB = 5;

export default function InstituteModal({ isOpen, onClose, onSaved, instituteToEdit = null }) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    slug: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    principalName: '',
    logo: null,
    isActive: true,
    // Admin fields
    createAdmin: true,
    adminEmail: '',
    adminPassword: '',
    adminUsername: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (instituteToEdit) {
      setFormData({
        name: instituteToEdit.name || '',
        code: instituteToEdit.code || '',
        slug: instituteToEdit.slug || '',
        email: instituteToEdit.email || '',
        phone: instituteToEdit.phone || '',
        address: instituteToEdit.address || '',
        website: instituteToEdit.website || '',
        principalName: instituteToEdit.principalName || '',
        logo: instituteToEdit.logo || null,
        isActive: instituteToEdit.isActive ?? true,
        createAdmin: false,
        adminEmail: '',
        adminPassword: '',
        adminUsername: '',
      });
      setLogoPreview(instituteToEdit.logo || null);
    } else {
      setFormData({
        name: '',
        code: '',
        slug: '',
        email: '',
        phone: '',
        address: '',
        website: '',
        principalName: '',
        logo: null,
        isActive: true,
        createAdmin: true,
        adminEmail: '',
        adminPassword: '',
        adminUsername: '',
      });
      setLogoPreview(null);
    }
    setError('');
  }, [instituteToEdit, isOpen]);

  const handleNameChange = (e) => {
    const name = e.target.value;
    const autoSlug = name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
    setFormData((prev) => ({
      ...prev,
      name,
      ...(!instituteToEdit ? { slug: autoSlug } : {}),
    }));
  };

  const handleLogoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Invalid image format. Only PNG, JPG, JPEG, and WebP are allowed.');
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Logo file size must be less than ${MAX_SIZE_MB}MB.`);
      return;
    }

    setError('');

    // If editing existing institute, upload immediately
    if (instituteToEdit) {
      try {
        setUploadingLogo(true);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('type', 'logo');

        const res = await apiRequest(`/super-admin/institutes/${instituteToEdit.id}/upload`, {
          method: 'POST',
          body: fd,
        });

        if (res.success && res.url) {
          setLogoPreview(res.url);
          setFormData((prev) => ({ ...prev, logo: res.url }));
        }
      } catch (err) {
        setError(err.message || 'Failed to upload logo.');
      } finally {
        setUploadingLogo(false);
      }
    } else {
      // If creating new institute, generate local preview and we can save as object URL or keep logo
      const localUrl = URL.createObjectURL(file);
      setLogoPreview(localUrl);
    }
  };

  const handleRemoveLogo = async () => {
    if (instituteToEdit && formData.logo) {
      try {
        setUploadingLogo(true);
        await apiRequest(`/super-admin/institutes/${instituteToEdit.id}/branding-asset/logo`, {
          method: 'DELETE',
          body: JSON.stringify({ type: 'logo' }),
        });
        setLogoPreview(null);
        setFormData((prev) => ({ ...prev, logo: null }));
      } catch (err) {
        setError(err.message || 'Failed to remove logo.');
      } finally {
        setUploadingLogo(false);
      }
    } else {
      setLogoPreview(null);
      setFormData((prev) => ({ ...prev, logo: null }));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Institute name is required.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      if (instituteToEdit) {
        // Update
        await apiRequest(`/super-admin/institutes/${instituteToEdit.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            website: formData.website,
            principalName: formData.principalName,
            logo: formData.logo,
            isActive: formData.isActive,
          }),
        });
      } else {
        // Create
        const createPayload = {
          ...formData,
          logo: formData.logo || null,
        };
        await apiRequest('/super-admin/institutes', {
          method: 'POST',
          body: JSON.stringify(createPayload),
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Operation failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFD978] text-slate-900 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">
                {instituteToEdit ? 'Edit Institute & Branding' : 'Provision New Institute'}
              </h3>
              <p className="text-xs text-slate-400">
                {instituteToEdit ? 'Update tenant profile, identity & contact information' : 'Create an isolated SaaS tenant environment'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Section 1: Logo & Branding Upload */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Institute Branding Logo
            </h4>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden p-1 shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-slate-300" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoSelect}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={uploadingLogo}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#FFD978]" />
                    <span>{logoPreview ? 'Change Logo' : 'Upload Logo'}</span>
                  </button>
                  {logoPreview && (
                    <button
                      type="button"
                      disabled={uploadingLogo}
                      onClick={handleRemoveLogo}
                      className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  PNG, JPG, WebP up to 5MB. Logo is optional and can be added later.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Institute Details */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Institute Details & Identity
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Institute Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex International Academy"
                  value={formData.name}
                  onChange={handleNameChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Institute Code {!instituteToEdit && '(Leave empty to auto-generate)'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. EDU0005"
                  disabled={!!instituteToEdit}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Slug / URL Identifier
                </label>
                <input
                  type="text"
                  placeholder="e.g. apex-academy"
                  disabled={!!instituteToEdit}
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Official Email
                </label>
                <input
                  type="email"
                  placeholder="contact@institute.edu"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="+94 11 234 5678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Physical Address
                </label>
                <input
                  type="text"
                  placeholder="Street, City, Postal Code"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Initial Admin Provisioning (New Institute only) */}
          {!instituteToEdit && (
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Initial Institute Admin Provisioning
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-amber-50/50 p-4 rounded-2xl border border-amber-200/60">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Admin Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="admin@institute.edu"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Password
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={formData.adminPassword}
                    onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isActiveToggle"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded text-slate-900 focus:ring-[#FFD978]"
            />
            <label htmlFor="isActiveToggle" className="text-xs font-semibold text-slate-800 cursor-pointer">
              Institute Account Status: <span className={formData.isActive ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>{formData.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
            </label>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 text-[#FFD978]" />
                  <span>{instituteToEdit ? 'Save Changes' : 'Provision Institute'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
