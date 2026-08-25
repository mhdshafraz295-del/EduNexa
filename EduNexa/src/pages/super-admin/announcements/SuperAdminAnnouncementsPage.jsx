import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';
import GlassCard from '../../../components/common/GlassCard';
import StatCard from '../../../components/common/StatCard';
import PageHeader from '../../../components/common/PageHeader';
import {
  Megaphone,
  Plus,
  Search,
  CheckCircle,
  Clock,
  Radio,
  X,
  Send,
  RefreshCw,
  Edit2,
  Trash2,
  Users,
  Building,
  AlertTriangle,
  FileText,
} from 'lucide-react';

export default function SuperAdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [institutesList, setInstitutesList] = useState([]);
  const [instituteSearch, setInstituteSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('INFO');
  const [targetType, setTargetType] = useState('ALL_INSTITUTES');
  const [selectedInstituteIds, setSelectedInstituteIds] = useState([]);
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [status, setStatus] = useState('PUBLISHED');
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      setError('');
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);
      if (search) queryParams.set('search', search);

      const [listRes, analyticsRes, instRes] = await Promise.all([
        apiRequest(`/platform-announcements/admin?${queryParams.toString()}`),
        apiRequest('/platform-announcements/admin/analytics'),
        apiRequest('/super-admin/institutes?limit=100'),
      ]);

      if (listRes.success) setAnnouncements(listRes.announcements || []);
      if (analyticsRes.success) setAnalytics(analyticsRes.data);
      if (instRes.success && instRes.data) setInstitutesList(instRes.data);
    } catch (err) {
      console.error('Failed to load announcements:', err);
      setError(err.message || 'Unable to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [statusFilter, search]);

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setTitle('');
    setMessage('');
    setPriority('INFO');
    setTargetType('ALL_INSTITUTES');
    setSelectedInstituteIds([]);
    setStartsAt(new Date().toISOString().slice(0, 16));
    setExpiresAt('');
    setStatus('PUBLISHED');
    setModalError('');
    setInstituteSearch('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (a) => {
    setEditingId(a.id);
    setTitle(a.title);
    setMessage(a.message);
    setPriority(a.priority);
    setTargetType(a.targetType);
    setSelectedInstituteIds(a.targets?.map((t) => t.id) || []);
    setStartsAt(a.startsAt ? new Date(a.startsAt).toISOString().slice(0, 16) : '');
    setExpiresAt(a.expiresAt ? new Date(a.expiresAt).toISOString().slice(0, 16) : '');
    setStatus(a.status);
    setModalError('');
    setInstituteSearch('');
    setIsModalOpen(true);
  };

  const handleSaveAnnouncement = async (e, forcedStatus) => {
    if (e) e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setModalError('Title and message are required.');
      return;
    }

    if (targetType === 'SELECTED_INSTITUTES' && selectedInstituteIds.length === 0) {
      setModalError('Please select at least one target campus.');
      return;
    }

    const effectiveStatus = forcedStatus || status;

    setModalSaving(true);
    setModalError('');

    try {
      const payload = {
        title: title.trim(),
        message: message.trim(),
        priority,
        targetType,
        targetInstituteIds: targetType === 'SELECTED_INSTITUTES' ? selectedInstituteIds : [],
        startsAt: startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        status: effectiveStatus,
      };

      if (editingId) {
        await apiRequest(`/platform-announcements/admin/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/platform-announcements/admin', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setIsModalOpen(false);
      fetchAnnouncements();
    } catch (err) {
      setModalError(err.message || 'Failed to save announcement.');
    } finally {
      setModalSaving(false);
    }
  };

  const handleToggleStatus = async (a) => {
    const nextStatus = a.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
    try {
      await apiRequest(`/platform-announcements/admin/${a.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchAnnouncements();
    } catch (err) {
      alert(err.message || 'Failed to change status.');
    }
  };

  const handleDelete = async (aId) => {
    if (!window.confirm('Are you sure you want to permanently delete this announcement?')) return;
    try {
      await apiRequest(`/platform-announcements/admin/${aId}`, {
        method: 'DELETE',
      });
      fetchAnnouncements();
    } catch (err) {
      alert(err.message || 'Failed to delete announcement.');
    }
  };

  const getPriorityBadgeClass = (p) => {
    switch (p) {
      case 'URGENT':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'IMPORTANT':
        return 'bg-amber-100 text-amber-900 border-amber-200';
      default:
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    }
  };

  const filteredInstitutes = institutesList.filter((inst) => {
    if (!instituteSearch.trim()) return true;
    const q = instituteSearch.toLowerCase();
    return (
      inst.name?.toLowerCase().includes(q) ||
      inst.code?.toLowerCase().includes(q) ||
      inst.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header with prominent + Create Announcement button */}
      <PageHeader
        title="Platform Announcements"
        description="Broadcast authoritative announcements, maintenance alerts, and system updates to campus administrators."
        action={
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs md:text-sm font-black hover:bg-slate-800 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#FFD978]" />
            <span>+ Create Announcement</span>
          </button>
        }
      />

      {/* KPI Stats from Real Database */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Total Announcements"
          value={analytics?.totalAnnouncements ?? 0}
          icon={Megaphone}
        />
        <StatCard
          label="Live Active"
          value={analytics?.activeLiveCount ?? 0}
          icon={Radio}
        />
        <StatCard
          label="Drafts"
          value={analytics?.draftCount ?? 0}
          icon={Clock}
        />
        <StatCard
          label="Total Reads"
          value={analytics?.totalReads ?? 0}
          icon={CheckCircle}
        />
      </div>

      {/* Main Table Card */}
      <GlassCard className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search announcements..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            {['ALL', 'PUBLISHED', 'DRAFT', 'ARCHIVED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchAnnouncements}
              className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Announcements List */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-7 h-7 animate-spin text-slate-400" />
            <p className="text-xs text-slate-500 font-medium">Loading platform announcements...</p>
          </div>
        ) : announcements.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-3">
            <Megaphone className="w-12 h-12 mx-auto text-slate-300 stroke-[1.5]" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-700">No platform announcements have been created yet.</p>
              <p className="text-xs text-slate-500">Create your first broadcast to deliver official notices to campus administrators.</p>
            </div>
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-xs"
            >
              <Plus className="w-4 h-4 text-[#FFD978]" />
              <span>+ Create Announcement</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="py-3 px-3">Title & Priority</th>
                  <th className="py-3 px-3">Target Audience</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Read Tracking</th>
                  <th className="py-3 px-3">Schedule</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {announcements.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-3 max-w-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${getPriorityBadgeClass(a.priority)}`}>
                          {a.priority}
                        </span>
                        <h4 className="font-bold text-slate-900 truncate">{a.title}</h4>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{a.message}</p>
                    </td>

                    <td className="py-3.5 px-3">
                      {a.targetType === 'ALL_INSTITUTES' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          All Institutes ({a.metrics?.eligibleInstitutesCount || 0})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-indigo-700">
                          <Building className="w-3.5 h-3.5" />
                          {a.targets?.length || 0} Targeted Campus(es)
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          a.status === 'PUBLISHED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : a.status === 'DRAFT'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 font-mono text-[11px]">
                      <span className="font-bold text-emerald-700">{a.metrics?.readCount || 0}</span>
                      <span className="text-slate-400"> / {a.metrics?.eligibleInstitutesCount || 0} Read</span>
                    </td>

                    <td className="py-3.5 px-3 text-slate-500 text-[11px]">
                      <div>Starts: {new Date(a.startsAt).toLocaleDateString()}</div>
                      {a.expiresAt && <div className="text-[10px] text-slate-400">Expires: {new Date(a.expiresAt).toLocaleDateString()}</div>}
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggleStatus(a)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                            a.status === 'PUBLISHED'
                              ? 'border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100'
                              : 'border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          {a.status === 'PUBLISHED' ? 'Archive' : 'Publish'}
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(a)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                          title="Edit Announcement"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50"
                          title="Delete Announcement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Compose / Edit Announcement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-600" />
                <span>{editingId ? 'Edit Announcement' : 'Compose Platform Announcement'}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => handleSaveAnnouncement(e)} className="p-4 overflow-y-auto space-y-4 flex-1">
              {modalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {modalError}
                </div>
              )}

              {/* Title */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Announcement Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Important System Maintenance Notice"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                  required
                />
              </div>

              {/* Message Content */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Announcement Message *</label>
                <textarea
                  rows={4}
                  placeholder="Write the official announcement details..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                  required
                />
              </div>

              {/* Priority & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Priority Level</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                  >
                    <option value="INFO">INFO (Standard Blue)</option>
                    <option value="IMPORTANT">IMPORTANT (Notice Amber)</option>
                    <option value="URGENT">URGENT (Alert Rose)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                  >
                    <option value="PUBLISHED">PUBLISHED (Live)</option>
                    <option value="DRAFT">DRAFT (Hidden)</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>

              {/* Target Audience */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Target Audience</label>
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                >
                  <option value="ALL_INSTITUTES">All Institutes (Platform-Wide Broadcast)</option>
                  <option value="SELECTED_INSTITUTES">Selected Institutes Only</option>
                </select>
              </div>

              {/* Institute Multi-select if SELECTED_INSTITUTES */}
              {targetType === 'SELECTED_INSTITUTES' && (
                <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      Select Target Campuses ({selectedInstituteIds.length} selected) *
                    </label>
                    {selectedInstituteIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedInstituteIds([])}
                        className="text-[10px] text-rose-600 hover:underline font-bold"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="Search campuses by name, code, or email..."
                    value={instituteSearch}
                    onChange={(e) => setInstituteSearch(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg bg-white border border-slate-200 focus:ring-1 focus:ring-slate-900"
                  />

                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {filteredInstitutes.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic py-2 text-center">No matching campuses found</p>
                    ) : (
                      filteredInstitutes.map((inst) => {
                        const isChecked = selectedInstituteIds.includes(inst.id);
                        return (
                          <label
                            key={inst.id}
                            className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                              isChecked ? 'bg-amber-100/60 border border-amber-300/60' : 'hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedInstituteIds([...selectedInstituteIds, inst.id]);
                                  } else {
                                    setSelectedInstituteIds(selectedInstituteIds.filter((id) => id !== inst.id));
                                  }
                                }}
                                className="rounded text-amber-500"
                              />
                              <span className="font-semibold text-slate-800">{inst.name}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">{inst.code}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Schedule Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Start Date / Time</label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Expiry Date / Time (Optional)</label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={modalSaving}
                    onClick={() => handleSaveAnnouncement(null, 'DRAFT')}
                    className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 shadow-2xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Save Draft</span>
                  </button>

                  <button
                    type="button"
                    disabled={modalSaving}
                    onClick={() => handleSaveAnnouncement(null, 'PUBLISHED')}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5 shadow-xs"
                  >
                    {modalSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-[#FFD978]" />}
                    <span>{editingId ? 'Update & Publish' : 'Publish Broadcast'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
