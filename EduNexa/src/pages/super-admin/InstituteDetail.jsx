import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import InstituteModal from './InstituteModal';
import {
  Building2,
  ArrowLeft,
  Edit2,
  CheckCircle2,
  XCircle,
  Users,
  GraduationCap,
  BookOpen,
  School,
  Receipt,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building,
  Globe,
  UserCheck,
} from 'lucide-react';

export default function InstituteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [institute, setInstitute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchInstitute = async () => {
    try {
      setLoading(true);
      const res = await apiRequest(`/super-admin/institutes/${id}`);
      if (res.success) {
        setInstitute(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch institute.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstitute();
  }, [id]);

  const handleToggleStatus = async () => {
    try {
      const nextStatus = !institute.isActive;
      await apiRequest(`/super-admin/institutes/${institute.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextStatus }),
      });
      fetchInstitute();
    } catch (err) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !institute) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
        <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <h3 className="text-lg font-bold text-slate-900">Institute Not Found</h3>
        <p className="text-sm text-slate-500 mt-1">{error || 'Could not find requested tenant.'}</p>
        <Link
          to="/super-admin/institutes"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Directory</span>
        </Link>
      </div>
    );
  }

  const counts = institute._count || {};

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Navigation & Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/super-admin/institutes"
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-slate-900">{institute.name}</h2>
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
              {institute.code}
            </span>
          </div>
          <p className="text-xs text-slate-500">Tenant Slug: /{institute.slug}</p>
        </div>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-800 text-xl shadow-xs overflow-hidden shrink-0">
              {institute.logo ? (
                <img
                  src={institute.logo}
                  alt={institute.name}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextSibling) {
                      e.currentTarget.nextSibling.style.display = 'flex';
                    }
                  }}
                  className="w-full h-full object-contain p-1"
                />
              ) : null}
              <span className={`w-full h-full bg-gradient-to-br from-slate-900 to-slate-800 text-[#FFD978] items-center justify-center font-black ${institute.logo ? 'hidden' : 'flex'}`}>
                {institute.name ? institute.name.slice(0, 2).toUpperCase() : 'IN'}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-slate-900">{institute.name}</h3>
                <button
                  onClick={handleToggleStatus}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                    institute.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${institute.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {institute.isActive ? 'Active (Operational)' : 'Inactive (Access Blocked)'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                {institute.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {institute.email}
                  </span>
                )}
                {institute.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {institute.phone}
                  </span>
                )}
                {institute.website && (
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    {institute.website}
                  </span>
                )}
                {institute.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {institute.address}
                  </span>
                )}
                {institute.principalName && (
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                    Principal: {institute.principalName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </button>
          </div>
        </div>

        {/* Tenant Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-bold uppercase text-slate-400">Enrolled Students</span>
            <div className="flex items-center justify-between mt-1">
              <p className="text-2xl font-black text-slate-900">{counts.students || 0}</p>
              <GraduationCap className="w-5 h-5 text-slate-400" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-bold uppercase text-slate-400">Faculty & Teachers</span>
            <div className="flex items-center justify-between mt-1">
              <p className="text-2xl font-black text-slate-900">{counts.teachers || 0}</p>
              <Users className="w-5 h-5 text-slate-400" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-bold uppercase text-slate-400">Classes & Sections</span>
            <div className="flex items-center justify-between mt-1">
              <p className="text-2xl font-black text-slate-900">{counts.classes || 0}</p>
              <School className="w-5 h-5 text-slate-400" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-bold uppercase text-slate-400">Invoices & Fees</span>
            <div className="flex items-center justify-between mt-1">
              <p className="text-2xl font-black text-slate-900">{counts.invoices || 0}</p>
              <Receipt className="w-5 h-5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Subscription & Entitlements Card */}
        <div className="mt-6 p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400">Current SaaS Subscription</span>
              <h4 className="text-lg font-black text-slate-900 mt-0.5">
                {institute.subscription?.planName || 'No Active Plan'}
              </h4>
            </div>

            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              institute.subscription?.isValid
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : institute.subscription?.status === 'EXPIRED'
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-amber-50 text-amber-900 border border-amber-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                institute.subscription?.isValid ? 'bg-emerald-500' : 'bg-amber-500'
              }`} />
              {institute.subscription?.status || 'NO_SUBSCRIPTION'}
            </span>
          </div>

          {institute.subscription?.startDate && institute.subscription?.endDate && (
            <p className="text-xs text-slate-500">
              Valid Period: <strong>{new Date(institute.subscription.startDate).toLocaleDateString()}</strong> to{' '}
              <strong>{new Date(institute.subscription.endDate).toLocaleDateString()}</strong> ({institute.subscription.remainingDays} days remaining)
            </p>
          )}

          {/* Usage vs Limits snapshot */}
          {institute.usage && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-white rounded-2xl border border-slate-200 text-xs">
                <span className="text-slate-400 font-medium">Students</span>
                <p className="text-sm font-black text-slate-900 font-mono mt-0.5">
                  {institute.usage.students?.current} / {institute.usage.students?.limit === null ? 'Unlimited' : institute.usage.students?.limit}
                </p>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-slate-200 text-xs">
                <span className="text-slate-400 font-medium">Teachers</span>
                <p className="text-sm font-black text-slate-900 font-mono mt-0.5">
                  {institute.usage.teachers?.current} / {institute.usage.teachers?.limit === null ? 'Unlimited' : institute.usage.teachers?.limit}
                </p>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-slate-200 text-xs">
                <span className="text-slate-400 font-medium">Classes</span>
                <p className="text-sm font-black text-slate-900 font-mono mt-0.5">
                  {institute.usage.classes?.current} / {institute.usage.classes?.limit === null ? 'Unlimited' : institute.usage.classes?.limit}
                </p>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-slate-200 text-xs">
                <span className="text-slate-400 font-medium">Storage</span>
                <p className="text-sm font-black text-slate-900 font-mono mt-0.5">
                  {institute.usage.storage?.currentGb} GB / {institute.usage.storage?.limitGb === null ? 'Unlimited' : `${institute.usage.storage?.limitGb} GB`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Administrators List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-xs">
        <h4 className="text-sm font-bold text-slate-900 mb-4">
          Institute Administrators ({institute.admins?.length || 0})
        </h4>
        {institute.admins && institute.admins.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {institute.admins.map((adm) => (
              <div key={adm.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-900 text-[#FFD978] flex items-center justify-center font-bold text-xs">
                    IA
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{adm.email}</p>
                    <p className="text-xs text-slate-400">Username: {adm.username}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active Admin
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">No administrators currently assigned to this institute.</p>
        )}
      </div>

      <InstituteModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={fetchInstitute}
        instituteToEdit={institute}
      />
    </div>
  );
}
