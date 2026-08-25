import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchAdminPolls,
  fetchAdminPollById,
  createAdminPoll,
  updateAdminPoll,
  updateAdminPollStatus,
  deleteAdminPoll,
  fetchAdminPollOverview,
  apiRequest,
} from '../../../services/api';
import {
  Vote,
  Plus,
  Search,
  Filter,
  BarChart3,
  Users,
  CheckCircle2,
  Clock,
  Archive,
  Trash2,
  Edit2,
  X,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Eye,
  CheckSquare,
  Lock,
  Calendar,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export default function PollsManagementPage() {
  const [polls, setPolls] = useState([]);
  const [kpis, setKpis] = useState({
    totalPolls: 0,
    activePolls: 0,
    scheduledPolls: 0,
    closedPolls: 0,
    totalVotes: 0,
  });
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters & Pagination
  const [activeTab, setActiveTab] = useState('ALL');
  const [audienceFilter, setAudienceFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedPollAnalytics, setSelectedPollAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [editingPollId, setEditingPollId] = useState(null);
  const [pollToDelete, setPollToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    audienceType: 'ALL_USERS',
    classId: '',
    startsAt: '',
    endsAt: '',
    allowVoteChange: false,
    anonymous: true,
    resultVisibility: 'AFTER_CLOSE',
    options: ['', ''],
  });
  const [submitting, setSubmitting] = useState(false);

  // Load Classes
  const loadClasses = useCallback(async () => {
    try {
      const res = await apiRequest('/academic/classes');
      if (res.success && Array.isArray(res.data)) {
        setClasses(res.data);
      }
    } catch {
      // ignore
    }
  }, []);

  // Load KPIs
  const loadKpis = useCallback(async () => {
    try {
      const res = await fetchAdminPollOverview();
      if (res.success && res.data) {
        setKpis(res.data);
      }
    } catch {
      // ignore
    }
  }, []);

  // Load Polls
  const loadPolls = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        page,
        limit: 12,
        status: activeTab !== 'ALL' ? activeTab : undefined,
        audienceType: audienceFilter !== 'ALL' ? audienceFilter : undefined,
        search: searchQuery.trim() || undefined,
      };

      const res = await fetchAdminPolls(params);
      if (res.success && res.data) {
        setPolls(res.data.polls || []);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      setError(err.message || 'Failed to load polls.');
    } finally {
      setLoading(false);
    }
  }, [page, activeTab, audienceFilter, searchQuery]);

  useEffect(() => {
    loadClasses();
    loadKpis();
  }, [loadClasses, loadKpis]);

  useEffect(() => {
    loadPolls();
  }, [loadPolls]);

  // Handle Option Builder
  const handleAddOption = () => {
    if (formData.options.length >= 15) return;
    setFormData((prev) => ({ ...prev, options: [...prev.options, ''] }));
  };

  const handleRemoveOption = (index) => {
    if (formData.options.length <= 2) return;
    setFormData((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const handleOptionChange = (index, value) => {
    setFormData((prev) => {
      const next = [...prev.options];
      next[index] = value;
      return { ...prev, options: next };
    });
  };

  const handleMoveOption = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= formData.options.length) return;
    setFormData((prev) => {
      const next = [...prev.options];
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
      return { ...prev, options: next };
    });
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingPollId(null);
    setFormData({
      title: '',
      description: '',
      audienceType: 'ALL_USERS',
      classId: '',
      startsAt: '',
      endsAt: '',
      allowVoteChange: false,
      anonymous: true,
      resultVisibility: 'AFTER_CLOSE',
      options: ['', ''],
    });
    setError('');
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const openEditModal = async (poll) => {
    try {
      setEditingPollId(poll.id);
      const res = await fetchAdminPollById(poll.id);
      if (res.success && res.data) {
        const p = res.data;
        setFormData({
          title: p.title || '',
          description: p.description || '',
          audienceType: p.audienceType || 'ALL_USERS',
          classId: p.classId ? String(p.classId) : '',
          startsAt: p.startsAt ? new Date(p.startsAt).toISOString().slice(0, 16) : '',
          endsAt: p.endsAt ? new Date(p.endsAt).toISOString().slice(0, 16) : '',
          allowVoteChange: Boolean(p.allowVoteChange),
          anonymous: Boolean(p.anonymous),
          resultVisibility: p.resultVisibility || 'AFTER_CLOSE',
          options: p.options?.map((o) => o.text) || ['', ''],
        });
        setShowCreateModal(true);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch poll details.');
    }
  };

  // Submit Poll Form (Create or Update)
  const handleSubmitPoll = async (publishImmediate = false) => {
    try {
      setSubmitting(true);
      setError('');

      const cleanOptions = formData.options.map((o) => o.trim()).filter(Boolean);
      if (cleanOptions.length < 2) {
        throw new Error('Please provide at least 2 non-empty options.');
      }

      const payload = {
        ...formData,
        options: cleanOptions,
        classId: formData.classId ? parseInt(formData.classId, 10) : undefined,
        status: publishImmediate ? 'ACTIVE' : 'DRAFT',
      };

      if (editingPollId) {
        await updateAdminPoll(editingPollId, payload);
        setSuccessMsg('Poll updated successfully.');
      } else {
        await createAdminPoll(payload);
        setSuccessMsg(publishImmediate ? 'Poll published successfully!' : 'Poll draft saved.');
      }

      setShowCreateModal(false);
      loadPolls();
      loadKpis();
    } catch (err) {
      setError(err.message || 'Failed to save poll.');
    } finally {
      setSubmitting(false);
    }
  };

  // Change Status (Close / Publish / Archive)
  const handleStatusChange = async (pollId, newStatus) => {
    try {
      await updateAdminPollStatus(pollId, newStatus);
      setSuccessMsg(`Poll status updated to ${newStatus}.`);
      loadPolls();
      loadKpis();
    } catch (err) {
      setError(err.message || 'Failed to update status.');
    }
  };

  // Delete / Archive Modal Handlers
  const handleOpenDeleteModal = (poll) => {
    setPollToDelete(poll);
    setError('');
  };

  const handleConfirmDelete = async () => {
    if (!pollToDelete || isDeleting) return;
    try {
      setIsDeleting(true);
      setError('');
      const res = await deleteAdminPoll(pollToDelete.id);
      setSuccessMsg(res.message || 'Poll deleted successfully.');
      setPollToDelete(null);
      await loadPolls();
      await loadKpis();
    } catch (err) {
      setError(err.message || 'Failed to delete poll.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchiveFromModal = async () => {
    if (!pollToDelete || isDeleting) return;
    try {
      setIsDeleting(true);
      setError('');
      await updateAdminPollStatus(pollToDelete.id, 'ARCHIVED');
      setSuccessMsg('Poll archived safely.');
      setPollToDelete(null);
      await loadPolls();
      await loadKpis();
    } catch (err) {
      setError(err.message || 'Failed to archive poll.');
    } finally {
      setIsDeleting(false);
    }
  };

  // View Detailed Analytics Modal
  const handleOpenAnalytics = async (pollId) => {
    try {
      setShowAnalyticsModal(true);
      setAnalyticsLoading(true);
      const res = await fetchAdminPollById(pollId);
      if (res.success && res.data) {
        setSelectedPollAnalytics(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load poll analytics.');
      setShowAnalyticsModal(false);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-400 to-[#FFD978] rounded-xl shadow-xs text-slate-900">
              <Vote className="w-7 h-7" />
            </div>
            Polls & Voting Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create real-time audience surveys, student elections, and class polls with live result gating.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-[#FFD978] font-semibold text-sm rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create New Poll
        </button>
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Polls</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{kpis.totalPolls || 0}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold uppercase tracking-wider">
            <span>Active Polls</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">{kpis.activePolls || 0}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 text-xs font-semibold uppercase tracking-wider">
            <span>Scheduled</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-600 mt-2">{kpis.scheduledPolls || 0}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-purple-600 text-xs font-semibold uppercase tracking-wider">
            <span>Total Votes</span>
            <Vote className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-black text-purple-600 mt-2">{kpis.totalVotes || 0}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-amber-600 text-xs font-semibold uppercase tracking-wider">
            <span>Closed / Past</span>
            <Archive className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{kpis.closedPolls || 0}</p>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        {/* Tab Row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-100 scrollbar-none">
          {['ALL', 'ACTIVE', 'SCHEDULED', 'DRAFT', 'CLOSED', 'ARCHIVED'].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setPage(1);
              }}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab
                  ? 'bg-slate-900 text-[#FFD978] shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab === 'ALL' ? 'All Polls' : tab}
            </button>
          ))}
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search polls by title..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={audienceFilter}
              onChange={(e) => {
                setAudienceFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            >
              <option value="ALL">All Audiences</option>
              <option value="ALL_USERS">Whole Institute (All Users)</option>
              <option value="STUDENTS">All Students</option>
              <option value="TEACHERS">All Teachers</option>
              <option value="PARENTS">All Parents</option>
              <option value="CLASS_STUDENTS">Class Specific: Students</option>
              <option value="CLASS_TEACHERS">Class Specific: Teachers</option>
              <option value="CLASS_PARENTS">Class Specific: Parents</option>
            </select>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                loadPolls();
                loadKpis();
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Data
            </button>
          </div>
        </div>
      </div>

      {/* Polls Cards Grid */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 mt-3">Loading polls...</p>
        </div>
      ) : polls.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Vote className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No polls found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
            {searchQuery || audienceFilter !== 'ALL' || activeTab !== 'ALL'
              ? 'Try adjusting your filters or search keywords.'
              : 'Create your first interactive poll to start collecting votes.'}
          </p>
          {!searchQuery && (
            <button
              onClick={openCreateModal}
              className="mt-4 px-5 py-2 bg-slate-900 text-[#FFD978] text-sm font-semibold rounded-xl"
            >
              + Create Poll
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {polls.map((p) => {
            const isDraft = p.status === 'DRAFT';
            const isActive = p.status === 'ACTIVE';
            const isScheduled = p.status === 'SCHEDULED';
            const isClosed = p.status === 'CLOSED';

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                {/* Card Top */}
                <div className="p-5 space-y-3">
                  {/* Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : isScheduled
                          ? 'bg-blue-100 text-blue-800'
                          : isDraft
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {p.status}
                    </span>

                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg">
                      {p.audienceType.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Title & Target */}
                  <div>
                    <h3 className="font-bold text-slate-900 text-base line-clamp-1">{p.title}</h3>
                    {p.class && (
                      <p className="text-xs font-semibold text-amber-700 mt-0.5">
                        Target Class: {p.class.name} {p.class.section ? `(${p.class.section})` : ''}
                      </p>
                    )}
                    {p.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">{p.description}</p>
                    )}
                  </div>

                  {/* Options Preview */}
                  <div className="space-y-1.5 pt-1">
                    {p.options?.slice(0, 3).map((opt) => (
                      <div
                        key={opt.id}
                        className="flex items-center justify-between text-xs px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg"
                      >
                        <span className="font-medium text-slate-700 truncate pr-2">{opt.text}</span>
                        <span className="text-slate-500 font-bold shrink-0">
                          {opt.voteCount || 0} ({opt.percentage || 0}%)
                        </span>
                      </div>
                    ))}
                    {p.options?.length > 3 && (
                      <p className="text-[11px] text-slate-400 text-center">
                        +{p.options.length - 3} more options
                      </p>
                    )}
                  </div>

                  {/* Metrics Bar */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-800">
                      {p.totalVotes} Total Votes
                    </span>
                    <span>{p.participationPercent}% Participation</span>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="bg-slate-50/80 px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-1 text-xs">
                  <button
                    onClick={() => handleOpenAnalytics(p.id)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-slate-600" />
                    Analytics
                  </button>

                  <div className="flex items-center gap-1">
                    {isDraft && (
                      <button
                        onClick={() => handleStatusChange(p.id, 'ACTIVE')}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-all cursor-pointer"
                        title="Publish Poll"
                      >
                        Publish
                      </button>
                    )}

                    {isActive && (
                      <button
                        onClick={() => handleStatusChange(p.id, 'CLOSED')}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg font-semibold transition-all cursor-pointer"
                        title="Close Poll Now"
                      >
                        Close
                      </button>
                    )}

                    <button
                      onClick={() => openEditModal(p)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-all"
                      title="Edit Poll"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleOpenDeleteModal(p)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-all cursor-pointer"
                      title="Delete or Archive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Poll Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Vote className="w-5 h-5 text-amber-500" />
                {editingPollId ? 'Edit Poll Configuration' : 'Create New Interactive Poll'}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Poll Title / Question *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Which date is preferred for the Annual Science Fair?"
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description / Context (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Additional background notes or instructions for voters..."
                  className="w-full px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* Audience & Class */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Audience Group *
                  </label>
                  <select
                    value={formData.audienceType}
                    onChange={(e) => setFormData({ ...formData, audienceType: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="ALL_USERS">Whole Institute (All Users)</option>
                    <option value="STUDENTS">All Students</option>
                    <option value="TEACHERS">All Teachers</option>
                    <option value="PARENTS">All Parents</option>
                    <option value="CLASS_STUDENTS">Class Specific: Students Only</option>
                    <option value="CLASS_TEACHERS">Class Specific: Teachers Only</option>
                    <option value="CLASS_PARENTS">Class Specific: Parents Only</option>
                  </select>
                </div>

                {['CLASS_STUDENTS', 'CLASS_TEACHERS', 'CLASS_PARENTS'].includes(formData.audienceType) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Target Class *
                    </label>
                    <select
                      value={formData.classId}
                      onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="">-- Select Class --</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name} {cls.section ? `(${cls.section})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Schedule (Optional) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Start Date & Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startsAt}
                    onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    End Date & Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endsAt}
                    onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Options Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Voting Options (Min 2) *
                  </label>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Option
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-6 text-center text-xs font-bold text-slate-400">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`Option ${idx + 1}`}
                        className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => handleMoveOption(idx, -1)}
                        disabled={idx === 0}
                        className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveOption(idx, 1)}
                        disabled={idx === formData.options.length - 1}
                        className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        disabled={formData.options.length <= 2}
                        className="p-1.5 text-rose-500 hover:text-rose-700 disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Voting Configuration & Policies */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Result Visibility *
                  </label>
                  <select
                    value={formData.resultVisibility}
                    onChange={(e) => setFormData({ ...formData, resultVisibility: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="AFTER_CLOSE">After Poll Closes</option>
                    <option value="AFTER_VOTE">After User Votes</option>
                    <option value="LIVE">Live (Public Realtime)</option>
                    <option value="NEVER">Never (Admin Only)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="allowVoteChange"
                    checked={formData.allowVoteChange}
                    onChange={(e) => setFormData({ ...formData, allowVoteChange: e.target.checked })}
                    className="w-4 h-4 rounded text-slate-900 focus:ring-amber-400"
                  />
                  <label htmlFor="allowVoteChange" className="text-xs font-medium text-slate-700 cursor-pointer">
                    Allow Vote Change
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="anonymous"
                    checked={formData.anonymous}
                    onChange={(e) => setFormData({ ...formData, anonymous: e.target.checked })}
                    className="w-4 h-4 rounded text-slate-900 focus:ring-amber-400"
                  />
                  <label htmlFor="anonymous" className="text-xs font-medium text-slate-700 cursor-pointer">
                    Anonymous Poll
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmitPoll(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                Save as Draft
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmitPoll(true)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-[#FFD978] text-sm font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Publishing...' : 'Publish Poll'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalyticsModal && selectedPollAnalytics && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md uppercase">
                  {selectedPollAnalytics.status}
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">
                  {selectedPollAnalytics.title}
                </h2>
              </div>
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {analyticsLoading ? (
              <div className="py-8 text-center">
                <div className="w-6 h-6 border-2 border-slate-900 border-t-[#FFD978] rounded-full animate-spin mx-auto" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Participation KPI Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                    <p className="text-xs font-semibold text-slate-500">Eligible Voters</p>
                    <p className="text-xl font-extrabold text-slate-900 mt-1">
                      {selectedPollAnalytics.eligibleUsersCount || 0}
                    </p>
                  </div>

                  <div className="p-3.5 bg-purple-50 rounded-2xl border border-purple-100 text-center">
                    <p className="text-xs font-semibold text-purple-700">Total Votes Cast</p>
                    <p className="text-xl font-extrabold text-purple-900 mt-1">
                      {selectedPollAnalytics.totalVotes || 0}
                    </p>
                  </div>

                  <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                    <p className="text-xs font-semibold text-emerald-700">Participation</p>
                    <p className="text-xl font-extrabold text-emerald-900 mt-1">
                      {selectedPollAnalytics.participationPercent || 0}%
                    </p>
                  </div>
                </div>

                {/* Option Distribution Bars */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Option Vote Distribution
                  </h4>
                  {selectedPollAnalytics.options?.map((opt) => (
                    <div key={opt.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-slate-800">
                        <span>{opt.text}</span>
                        <span>{opt.voteCount || 0} votes ({opt.percentage || 0}%)</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                          style={{ width: `${opt.percentage || 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Voter Role Breakdown (Safe aggregation) */}
                {selectedPollAnalytics.roleBreakdown && (
                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Audience Breakdown (Eligible)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      {Object.entries(selectedPollAnalytics.roleBreakdown).map(([role, count]) => (
                        <div key={role} className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                          <p className="text-slate-400 text-[10px] uppercase font-bold">{role}</p>
                          <p className="text-sm font-extrabold text-slate-800 mt-0.5">{count}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="px-5 py-2 bg-slate-900 text-[#FFD978] font-semibold text-xs rounded-xl cursor-pointer"
              >
                Close Analytics
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete / Archive Confirmation Modal */}
      {pollToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {(pollToDelete.totalVotes || 0) > 0 ? 'Archive Poll' : 'Delete Poll'}
                </h3>
              </div>
              <button
                onClick={() => setPollToDelete(null)}
                disabled={isDeleting}
                className="text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">
                "{pollToDelete.title}"
              </p>

              {(pollToDelete.totalVotes || 0) > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5 text-amber-800">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    Poll Contains {pollToDelete.totalVotes} Recorded Vote{(pollToDelete.totalVotes || 0) > 1 ? 's' : ''}
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    To preserve voting history and audit integrity, polls with cast votes cannot be permanently deleted. You can archive this poll to safely hide it from user feeds.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Are you sure you want to permanently delete this poll? This will remove all associated options and configuration. This action cannot be undone.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setPollToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              {(pollToDelete.totalVotes || 0) > 0 ? (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleArchiveFromModal}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  {isDeleting ? 'Archiving...' : 'Archive Poll Safely'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
