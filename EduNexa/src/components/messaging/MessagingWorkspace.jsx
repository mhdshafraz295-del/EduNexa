import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest, fetchProtectedAssetBlobUrl, revokeProtectedAssetBlobUrl, downloadAuthenticatedFile } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import GlassCard from '../common/GlassCard';
import StatusBadge from '../common/StatusBadge';
import {
  MessageSquare,
  Send,
  Paperclip,
  Search,
  Archive,
  ArchiveRestore,
  Trash2,
  Reply,
  Edit2,
  X,
  Check,
  CheckCheck,
  FileText,
  Image as ImageIcon,
  Download,
  AlertCircle,
  RefreshCw,
  User,
  GraduationCap,
  Users,
  ShieldCheck,
  ChevronLeft,
  Eye,
  Megaphone,
  Radio,
  BarChart2,
  CheckCircle2,
  AlertTriangle,
  Building,
} from 'lucide-react';

export default function MessagingWorkspace({ portalRole = 'ADMIN' }) {
  const { user } = useAuth();
  const isAdmin = portalRole === 'ADMIN' || user?.role === 'ADMIN';

  // Navigation Mode: 'DIRECT' | 'BROADCAST'
  const [workspaceMode, setWorkspaceMode] = useState('DIRECT');

  // =========================================================================
  // DIRECT MESSAGING STATE
  // =========================================================================
  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [activeThread, setActiveThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread' | 'archived'
  const [searchQuery, setSearchQuery] = useState('');
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);
  const [directUnreadCount, setDirectUnreadCount] = useState(0);
  const [broadcastUnreadCount, setBroadcastUnreadCount] = useState(0);

  // Direct Composer State
  const [messageText, setMessageText] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [sending, setSending] = useState(false);
  const [composerError, setComposerError] = useState('');

  // Edit Message State
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // New Direct Message Modal State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientRoleFilter, setRecipientRoleFilter] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newFile, setNewFile] = useState(null);
  const [newModalError, setNewModalError] = useState('');

  // =========================================================================
  // BROADCAST MESSAGING STATE
  // =========================================================================
  const [broadcasts, setBroadcasts] = useState([]);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState(null);
  const [activeBroadcast, setActiveBroadcast] = useState(null);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastFilter, setBroadcastFilter] = useState('all'); // 'all' | 'unread' | 'archived' (or 'sent' | 'withdrawn' for Admin)
  const [broadcastSearch, setBroadcastSearch] = useState('');

  // Admin Broadcast Composer Modal
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [audienceType, setAudienceType] = useState('ALL_STUDENTS');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [allowReplies, setAllowReplies] = useState(false);
  const [broadcastFile, setBroadcastFile] = useState(null);
  const [previewStats, setPreviewStats] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showSendConfirmation, setShowSendConfirmation] = useState(false);
  const [broadcastModalError, setBroadcastModalError] = useState('');
  const [classesList, setClassesList] = useState([]);

  // Shared Image Preview Modal
  const [previewImage, setPreviewImage] = useState(null);
  const [imageLoadingId, setImageLoadingId] = useState(null);

  // Refs
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const newFileInputRef = useRef(null);
  const broadcastFileInputRef = useRef(null);
  const pollingTimerRef = useRef(null);

  // Scroll messages to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  }, []);

  // Fetch Global Unread Count
  const fetchGlobalUnread = async () => {
    try {
      const res = await apiRequest('/messages/unread-count');
      if (res.success) {
        setGlobalUnreadCount(res.unreadCount || 0);
        setDirectUnreadCount(res.directUnreadCount || 0);
        setBroadcastUnreadCount(res.broadcastUnreadCount || 0);
      }
    } catch (err) {
      // non-blocking
    }
  };

  // Fetch Direct Conversations List
  const fetchConversations = async (silent = false) => {
    if (!silent) setListLoading(true);
    try {
      const queryParams = new URLSearchParams({
        filter: activeFilter,
        search: searchQuery,
      });
      const res = await apiRequest(`/messages/conversations?${queryParams.toString()}`);
      if (res.success) {
        setConversations(res.conversations || []);
      }
    } catch (err) {
      console.warn('Failed to load conversations:', err.message);
    } finally {
      if (!silent) setListLoading(false);
    }
  };

  // Fetch Active Thread
  const fetchThread = async (convId, silent = false) => {
    if (!convId) return;
    if (!silent) setThreadLoading(true);
    try {
      const res = await apiRequest(`/messages/conversations/${convId}`);
      if (res.success) {
        setActiveThread(res);
        if (!silent) {
          setTimeout(() => scrollToBottom(false), 50);
        }
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
        );
        fetchGlobalUnread();
      }
    } catch (err) {
      console.warn('Failed to fetch thread:', err.message);
    } finally {
      if (!silent) setThreadLoading(false);
    }
  };

  // Fetch Broadcasts List
  const fetchBroadcasts = async (silent = false) => {
    if (!silent) setListLoading(true);
    try {
      const endpoint = isAdmin ? '/messages/broadcasts/admin' : '/messages/broadcasts';
      const queryParams = new URLSearchParams({
        filter: broadcastFilter,
        search: broadcastSearch,
      });
      const res = await apiRequest(`${endpoint}?${queryParams.toString()}`);
      if (res.success) {
        setBroadcasts(res.broadcasts || []);
      }
    } catch (err) {
      console.warn('Failed to fetch broadcasts:', err.message);
    } finally {
      if (!silent) setListLoading(false);
    }
  };

  // Fetch Single Broadcast Detail
  const fetchBroadcastDetail = async (bId, silent = false) => {
    if (!bId) return;
    if (!silent) setBroadcastLoading(true);
    try {
      const res = await apiRequest(`/messages/broadcasts/${bId}`);
      if (res.success) {
        setActiveBroadcast(res.broadcast);
        if (!isAdmin) {
          setBroadcasts((prev) =>
            prev.map((b) => (b.broadcastId === bId ? { ...b, isRead: true } : b))
          );
          fetchGlobalUnread();
        }
      }
    } catch (err) {
      console.warn('Failed to load broadcast detail:', err.message);
    } finally {
      if (!silent) setBroadcastLoading(false);
    }
  };

  // Fetch Classes for Broadcast composer
  const fetchClasses = async () => {
    try {
      const res = await apiRequest('/academic/classes');
      if (res.success && res.data) {
        setClassesList(res.data);
      }
    } catch (err) {
      // non-blocking
    }
  };

  // Live Audience Preview Counter
  const fetchAudiencePreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await apiRequest('/messages/broadcasts/preview', {
        method: 'POST',
        body: JSON.stringify({
          audienceType,
          classId: selectedClassId || undefined,
        }),
      });
      if (res.success) {
        setPreviewStats(res);
      }
    } catch (err) {
      setPreviewStats(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Effects
  useEffect(() => {
    fetchGlobalUnread();
    if (workspaceMode === 'DIRECT') {
      fetchConversations();
    } else {
      fetchBroadcasts();
    }
  }, [workspaceMode, activeFilter, searchQuery, broadcastFilter, broadcastSearch]);

  useEffect(() => {
    if (isBroadcastModalOpen) {
      fetchClasses();
      fetchAudiencePreview();
    }
  }, [isBroadcastModalOpen, audienceType, selectedClassId]);

  // REST Polling Setup
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === 'visible') {
        fetchGlobalUnread();
        if (workspaceMode === 'DIRECT') {
          fetchConversations(true);
          if (selectedConvId) fetchThread(selectedConvId, true);
        } else {
          fetchBroadcasts(true);
          if (selectedBroadcastId) fetchBroadcastDetail(selectedBroadcastId, true);
        }
      }
    };

    pollingTimerRef.current = setInterval(poll, 15000);
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [workspaceMode, selectedConvId, selectedBroadcastId, activeFilter, broadcastFilter]);

  // Allowed Recipients for Direct Message Modal
  const fetchRecipients = async () => {
    setRecipientsLoading(true);
    setNewModalError('');
    try {
      const queryParams = new URLSearchParams();
      if (recipientSearch) queryParams.set('search', recipientSearch);
      if (recipientRoleFilter) queryParams.set('role', recipientRoleFilter);
      queryParams.set('limit', '50');

      const res = await apiRequest(`/messages/recipients?${queryParams.toString()}`);
      if (res.success) {
        setRecipients(res.recipients || []);
      }
    } catch (err) {
      setNewModalError(err.message || 'Unable to load allowed recipients.');
    } finally {
      setRecipientsLoading(false);
    }
  };

  useEffect(() => {
    if (isNewModalOpen) {
      fetchRecipients();
    }
  }, [isNewModalOpen, recipientSearch, recipientRoleFilter]);

  // Send Direct Reply
  const handleSendReply = async (e) => {
    if (e) e.preventDefault();
    if ((!messageText.trim() && !attachedFile) || sending || !selectedConvId) return;

    setSending(true);
    setComposerError('');

    try {
      const formData = new FormData();
      if (messageText.trim()) formData.append('body', messageText.trim());
      if (replyToMessage) formData.append('replyToMessageId', replyToMessage.id);
      if (attachedFile) formData.append('file', attachedFile);

      const res = await apiRequest(`/messages/conversations/${selectedConvId}/messages`, {
        method: 'POST',
        body: formData,
      });

      if (res.success) {
        setMessageText('');
        setAttachedFile(null);
        setReplyToMessage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        fetchThread(selectedConvId, true);
        fetchConversations(true);
        setTimeout(() => scrollToBottom(true), 50);
      }
    } catch (err) {
      setComposerError(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleCloseNewModal = () => {
    setIsNewModalOpen(false);
    setSelectedRecipient(null);
    setNewSubject('');
    setNewBody('');
    setNewFile(null);
    setRecipientSearch('');
    setRecipientRoleFilter('');
    setNewModalError('');
    if (newFileInputRef.current) newFileInputRef.current.value = '';
  };

  // Submit New Direct Conversation
  const handleCreateNewConversation = async (e) => {
    if (e) e.preventDefault();
    if (!selectedRecipient) {
      setNewModalError('Please select a recipient.');
      return;
    }
    if (!newBody.trim() && !newFile) {
      setNewModalError('Please enter a message or attach a file.');
      return;
    }

    setSending(true);
    setNewModalError('');

    try {
      const formData = new FormData();
      formData.append('recipientId', selectedRecipient.id);
      if (newSubject.trim()) formData.append('subject', newSubject.trim());
      if (newBody.trim()) formData.append('body', newBody.trim());
      if (newFile) formData.append('file', newFile);

      const res = await apiRequest('/messages/conversations', {
        method: 'POST',
        body: formData,
      });

      if (res.success && res.conversationId) {
        handleCloseNewModal();

        setWorkspaceMode('DIRECT');
        setSelectedConvId(res.conversationId);
        fetchConversations();
        fetchThread(res.conversationId);
        fetchGlobalUnread();
      }
    } catch (err) {
      setNewModalError(err.message || 'Failed to create conversation.');
    } finally {
      setSending(false);
    }
  };

  // Submit New Broadcast (Admin Only)
  const handleSendBroadcast = async (e) => {
    if (e) e.preventDefault();
    if (!broadcastTitle.trim()) {
      setBroadcastModalError('Broadcast title is required.');
      return;
    }
    if (!broadcastBody.trim()) {
      setBroadcastModalError('Broadcast message body is required.');
      return;
    }
    if (audienceType.startsWith('CLASS_') && !selectedClassId) {
      setBroadcastModalError('Please select a specific class for this audience.');
      return;
    }

    setSending(true);
    setBroadcastModalError('');

    try {
      const formData = new FormData();
      formData.append('title', broadcastTitle.trim());
      formData.append('body', broadcastBody.trim());
      formData.append('audienceType', audienceType);
      if (selectedClassId) formData.append('classId', selectedClassId);
      formData.append('allowReplies', allowReplies ? 'true' : 'false');
      if (broadcastFile) formData.append('file', broadcastFile);

      const res = await apiRequest('/messages/broadcasts', {
        method: 'POST',
        body: formData,
      });

      if (res.success && res.broadcastId) {
        setIsBroadcastModalOpen(false);
        setShowSendConfirmation(false);
        setBroadcastTitle('');
        setBroadcastBody('');
        setBroadcastFile(null);
        setAllowReplies(false);
        setSelectedClassId('');
        if (broadcastFileInputRef.current) broadcastFileInputRef.current.value = '';

        setWorkspaceMode('BROADCAST');
        setSelectedBroadcastId(res.broadcastId);
        fetchBroadcasts();
        fetchBroadcastDetail(res.broadcastId);
        fetchGlobalUnread();
      }
    } catch (err) {
      setBroadcastModalError(err.message || 'Failed to send broadcast.');
      setShowSendConfirmation(false);
    } finally {
      setSending(false);
    }
  };

  // Admin Withdraw Broadcast
  const handleWithdrawBroadcast = async (bId) => {
    if (!window.confirm('Are you sure you want to withdraw this broadcast? Recipients will no longer be able to view it.')) return;
    try {
      const res = await apiRequest(`/messages/broadcasts/${bId}`, {
        method: 'DELETE',
      });
      if (res.success) {
        fetchBroadcasts(true);
        if (selectedBroadcastId === bId) {
          fetchBroadcastDetail(bId, true);
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to withdraw broadcast.');
    }
  };

  // Recipient Reply to Admin privately (when allowReplies = true)
  const handleReplyPrivatelyToAdmin = (broadcast) => {
    setWorkspaceMode('DIRECT');
    setIsNewModalOpen(true);
    setNewSubject(`Re: ${broadcast.title}`);
    setNewBody('');
    if (broadcast.senderAdminId) {
      setSelectedRecipient({
        id: broadcast.senderAdminId,
        displayName: 'Institute Administration',
        role: 'ADMIN',
        context: 'Institute Administrator',
      });
    }
  };

  // Image Preview Handler
  const handlePreviewImage = async (attachment, isBroadcast = false) => {
    try {
      setImageLoadingId(attachment.id);
      const url = isBroadcast
        ? `/messages/broadcasts/attachments/${attachment.id}/content`
        : `/messages/attachments/${attachment.id}/content`;
      const blobUrl = await fetchProtectedAssetBlobUrl(url);
      setPreviewImage({ blobUrl, name: attachment.originalName });
    } catch (err) {
      alert('Unable to load image preview.');
    } finally {
      setImageLoadingId(null);
    }
  };

  const handleCloseImagePreview = () => {
    if (previewImage?.blobUrl) {
      revokeProtectedAssetBlobUrl(previewImage.blobUrl);
    }
    setPreviewImage(null);
  };

  // File Download Handler
  const handleDownloadFile = async (attachment, isBroadcast = false) => {
    try {
      const url = isBroadcast
        ? `/messages/broadcasts/attachments/${attachment.id}/content?download=1`
        : `/messages/attachments/${attachment.id}/content?download=1`;
      await downloadAuthenticatedFile(url, attachment.originalName);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  // Timestamp Formatter
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (isYesterday) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-[calc(100vh-140px)] min-h-[550px] flex flex-col rounded-2xl overflow-hidden border border-slate-200/80 bg-white/70 backdrop-blur-md shadow-soft">
      {/* Top Workspace Mode Selector (Direct Messages vs Broadcasts) */}
      <div className="bg-white/90 border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl">
          <button
            onClick={() => {
              setWorkspaceMode('DIRECT');
              setSelectedBroadcastId(null);
              setActiveBroadcast(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              workspaceMode === 'DIRECT'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Direct Messages</span>
            {directUnreadCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-extrabold bg-[#FFD978] text-slate-900 rounded-full border border-[#E6BC50]">
                {directUnreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setWorkspaceMode('BROADCAST');
              setSelectedConvId(null);
              setActiveThread(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              workspaceMode === 'BROADCAST'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5 text-amber-600" />
            <span>{isAdmin ? 'Institute Broadcasts' : 'Announcements & Broadcasts'}</span>
            {broadcastUnreadCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-extrabold bg-amber-500 text-white rounded-full">
                {broadcastUnreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2">
          {workspaceMode === 'DIRECT' ? (
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 active:scale-95 transition-all shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>New Message</span>
            </button>
          ) : (
            isAdmin && (
              <button
                onClick={() => setIsBroadcastModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-black hover:bg-amber-400 active:scale-95 transition-all shadow-xs"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>+ New Broadcast</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Main Split-View Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: LIST (DIRECT CONVERSATIONS OR BROADCASTS)                   */}
        {/* ========================================================================= */}
        <aside
          className={`w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col border-r border-slate-200/80 bg-slate-50/50 ${
            (workspaceMode === 'DIRECT' && selectedConvId) || (workspaceMode === 'BROADCAST' && selectedBroadcastId)
              ? 'hidden md:flex'
              : 'flex'
          }`}
        >
          {/* List Search & Filter Header */}
          <div className="p-3.5 border-b border-slate-200/80 bg-white/80 space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={workspaceMode === 'DIRECT' ? 'Search messages...' : 'Search announcements...'}
                value={workspaceMode === 'DIRECT' ? searchQuery : broadcastSearch}
                onChange={(e) =>
                  workspaceMode === 'DIRECT' ? setSearchQuery(e.target.value) : setBroadcastSearch(e.target.value)
                }
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FFD978] text-slate-800"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 p-1 bg-slate-200/60 rounded-xl text-xs font-semibold">
              {(workspaceMode === 'DIRECT'
                ? [
                    { key: 'all', label: 'All' },
                    { key: 'unread', label: 'Unread' },
                    { key: 'archived', label: 'Archived' },
                  ]
                : isAdmin
                ? [
                    { key: 'all', label: 'All Sent' },
                    { key: 'sent', label: 'Active' },
                    { key: 'withdrawn', label: 'Withdrawn' },
                  ]
                : [
                    { key: 'all', label: 'All' },
                    { key: 'unread', label: 'Unread' },
                    { key: 'archived', label: 'Archived' },
                  ]
              ).map((f) => (
                <button
                  key={f.key}
                  onClick={() =>
                    workspaceMode === 'DIRECT' ? setActiveFilter(f.key) : setBroadcastFilter(f.key)
                  }
                  className={`flex-1 py-1 text-center rounded-lg transition-all text-[11px] ${
                    (workspaceMode === 'DIRECT' ? activeFilter : broadcastFilter) === f.key
                      ? 'bg-white text-slate-900 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* List Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {workspaceMode === 'DIRECT' ? (
              /* Direct Conversation Cards */
              conversations.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-3">
                  <MessageSquare className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
                  <div>
                    <p className="text-xs font-semibold text-slate-600">No conversations found</p>
                    <p className="text-[11px] text-slate-400">Click "New Message" to begin a private conversation.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNewModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>+ New Message</span>
                  </button>
                </div>
              ) : (
                conversations.map((conv) => {
                  const isSelected = selectedConvId === conv.id;
                  const other = conv.otherParticipant;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        setSelectedConvId(conv.id);
                        fetchThread(conv.id);
                      }}
                      className={`p-3.5 cursor-pointer transition-all flex items-start gap-3 hover:bg-slate-100/70 relative ${
                        isSelected ? 'bg-white shadow-2xs border-l-4 border-slate-900' : ''
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-200 to-slate-100 flex items-center justify-center flex-shrink-0 text-slate-700 font-bold text-sm shadow-2xs border border-slate-200">
                        {other?.displayName ? other.displayName.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {other?.displayName || other?.username || 'User'}
                          </h4>
                          <span className="text-[10px] text-slate-400 flex-shrink-0 font-medium">
                            {formatTime(conv.lastMessageAt)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md uppercase bg-slate-100 text-slate-700 border border-slate-200">
                            {other?.role}
                          </span>
                          {other?.context && (
                            <span className="text-[10px] text-slate-500 truncate max-w-[140px]">
                              {other.context}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                            {conv.lastMessage?.hasAttachment && <Paperclip className="w-3 h-3 inline mr-1 text-slate-400" />}
                            {conv.lastMessage?.body || conv.subject || 'No messages yet'}
                          </p>
                          {conv.unreadCount > 0 && (
                            <span className="px-1.5 py-0.2 text-[10px] font-extrabold bg-[#FFD978] text-slate-900 rounded-full border border-[#E6BC50] flex-shrink-0">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              /* Broadcast Cards */
              broadcasts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <Megaphone className="w-8 h-8 mx-auto text-amber-300 stroke-[1.5]" />
                  <p className="text-xs font-semibold text-slate-600">No broadcasts found</p>
                  <p className="text-[11px] text-slate-400">
                    {isAdmin ? 'Click "+ New Broadcast" to send a campus announcement.' : 'No active institute announcements.'}
                  </p>
                </div>
              ) : (
                broadcasts.map((b) => {
                  const bId = b.broadcastId || b.id;
                  const isSelected = selectedBroadcastId === bId;
                  const isUnread = !b.isRead && !isAdmin;

                  return (
                    <div
                      key={bId}
                      onClick={() => {
                        setSelectedBroadcastId(bId);
                        fetchBroadcastDetail(bId);
                      }}
                      className={`p-3.5 cursor-pointer transition-all flex items-start gap-3 hover:bg-amber-50/40 relative ${
                        isSelected ? 'bg-white shadow-2xs border-l-4 border-amber-500' : ''
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center flex-shrink-0 font-bold shadow-2xs border border-amber-200">
                        <Megaphone className="w-5 h-5 text-amber-700" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h4 className={`text-xs truncate ${isUnread ? 'font-black text-slate-900' : 'font-bold text-slate-800'}`}>
                            {b.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 flex-shrink-0 font-medium">
                            {formatTime(b.createdAt)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 uppercase">
                            Broadcast
                          </span>
                          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                            {b.audienceType?.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs text-slate-500 truncate">
                            {b.body}
                          </p>
                          {isAdmin ? (
                            <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                              {b.readCount}/{b.recipientCount} Read
                            </span>
                          ) : (
                            isUnread && (
                              <span className="px-1.5 py-0.2 text-[9px] font-black bg-amber-500 text-white rounded-full">
                                NEW
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: DETAIL VIEW (ACTIVE CONVERSATION OR BROADCAST)              */}
        {/* ========================================================================= */}
        <main
          className={`flex-1 flex flex-col bg-white ${
            (!selectedConvId && workspaceMode === 'DIRECT') || (!selectedBroadcastId && workspaceMode === 'BROADCAST')
              ? 'hidden md:flex'
              : 'flex'
          }`}
        >
          {workspaceMode === 'DIRECT' ? (
            /* DIRECT CONVERSATION THREAD */
            selectedConvId && activeThread ? (
              <>
                {/* Active Header */}
                <div className="px-4 py-3 border-b border-slate-200/80 bg-white/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedConvId(null)}
                      className="md:hidden p-1.5 -ml-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-sm border border-slate-200">
                      {activeThread.conversation?.otherParticipant?.displayName?.charAt(0).toUpperCase() || <User className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs md:text-sm font-bold text-slate-900">
                          {activeThread.conversation?.otherParticipant?.displayName || 'Conversation'}
                        </h3>
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 uppercase">
                          {activeThread.conversation?.otherParticipant?.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {activeThread.conversation?.otherParticipant?.context || activeThread.conversation?.subject || 'Direct Message'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Message Stream */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40">
                  {activeThread.messages?.map((msg) => {
                    const isMine = msg.isMine;
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group`}>
                        {!isMine && (
                          <span className="text-[10px] font-bold text-slate-500 mb-1 ml-1">
                            {msg.sender?.displayName || msg.sender?.username || 'User'}
                          </span>
                        )}
                        <div
                          className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-3.5 text-xs shadow-2xs relative ${
                            isMine
                              ? 'bg-slate-900 text-white rounded-br-none'
                              : 'bg-white border border-slate-200/80 text-slate-900 rounded-bl-none'
                          }`}
                        >
                          {msg.replyTo && (
                            <div className="mb-2 p-2 rounded-lg text-[11px] bg-black/10 border-l-2 border-[#FFD978]">
                              <p className="font-bold text-[10px] opacity-80">{msg.replyTo.senderName}</p>
                              <p className="truncate italic">{msg.replyTo.body}</p>
                            </div>
                          )}
                          <p className={`whitespace-pre-wrap leading-relaxed ${msg.isDeleted ? 'italic opacity-60' : ''}`}>
                            {msg.body}
                          </p>

                          {msg.attachments?.map((att) => (
                            <div
                              key={att.id}
                              className={`mt-2 flex items-center justify-between gap-2 p-2 rounded-xl border ${
                                isMine ? 'bg-white/10 border-white/10' : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                {att.isImage ? <ImageIcon className="w-4 h-4 text-[#FFD978]" /> : <FileText className="w-4 h-4 text-blue-400" />}
                                <span className="text-[11px] font-semibold truncate">{att.originalName}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {att.isImage && (
                                  <button onClick={() => handlePreviewImage(att, false)} className="p-1 hover:bg-white/20 rounded">
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button onClick={() => handleDownloadFile(att, false)} className="p-1 hover:bg-white/20 rounded">
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}

                          <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] opacity-70">
                            {msg.isEdited && <span className="italic">Edited</span>}
                            <span>{formatTime(msg.createdAt)}</span>
                            {isMine && !msg.isDeleted && (
                              <span>{msg.status === 'READ' ? <CheckCheck className="w-3.5 h-3.5 text-[#FFD978]" /> : <Check className="w-3.5 h-3.5" />}</span>
                            )}
                          </div>
                        </div>

                        {!msg.isDeleted && (
                          <div className="flex items-center gap-1 mt-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setReplyToMessage(msg)} className="p-1 text-slate-400 hover:text-slate-700 text-[10px] flex items-center gap-0.5">
                              <Reply className="w-3 h-3" />
                              <span>Reply</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Composer */}
                <div className="p-3 border-t border-slate-200/80 bg-white/90 space-y-2">
                  {replyToMessage && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100 text-xs">
                      <span className="font-bold text-slate-700">Replying to {replyToMessage.sender?.displayName}:</span>
                      <button onClick={() => setReplyToMessage(null)}><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                  {attachedFile && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50 text-xs text-amber-900 border border-amber-200">
                      <span>{attachedFile.name}</span>
                      <button onClick={() => setAttachedFile(null)}><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                  <form onSubmit={handleSendReply} className="flex items-end gap-2">
                    <input type="file" ref={fileInputRef} onChange={(e) => setAttachedFile(e.target.files?.[0] || null)} className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-xl border hover:bg-slate-100">
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <textarea
                      rows={1}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                    />
                    <button type="submit" disabled={(!messageText.trim() && !attachedFile) || sending} className="p-2.5 rounded-xl bg-slate-900 text-white font-bold">
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
                <MessageSquare className="w-12 h-12 stroke-[1.5] text-slate-300" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-700">Select a conversation</p>
                  <p className="text-xs text-slate-500">Or start a new direct message with allowed campus members.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>+ New Message</span>
                </button>
              </div>
            )
          ) : (
            /* BROADCAST DETAIL VIEW */
            selectedBroadcastId && activeBroadcast ? (
              <div className="flex-1 flex flex-col overflow-y-auto">
                {/* Broadcast Detail Header */}
                <div className="p-5 border-b border-slate-200 bg-white/95 sticky top-0 z-10 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedBroadcastId(null)}
                        className="md:hidden p-1.5 -ml-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-black">
                        <Megaphone className="w-5 h-5 text-amber-700" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm md:text-base font-black text-slate-900">{activeBroadcast.title}</h2>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-500 text-slate-950 uppercase">
                            Official Broadcast
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          From: {activeBroadcast.senderAdminName || 'Institute Administration'} • {formatTime(activeBroadcast.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* Admin Action: Withdraw */}
                    {isAdmin && activeBroadcast.status === 'SENT' && (
                      <button
                        onClick={() => handleWithdrawBroadcast(activeBroadcast.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Withdraw</span>
                      </button>
                    )}
                  </div>

                  {/* Admin Stats Banner */}
                  {isAdmin && (
                    <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Audience</p>
                        <p className="text-xs font-bold text-slate-800">{activeBroadcast.audienceType?.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Total Delivered</p>
                        <p className="text-xs font-black text-slate-900">{activeBroadcast.recipientCount}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Read Status</p>
                        <p className="text-xs font-black text-emerald-600">
                          {activeBroadcast.readCount} Read <span className="text-slate-400 font-normal">({activeBroadcast.unreadCount} Unread)</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Broadcast Content Body */}
                <div className="p-6 space-y-6 flex-1 bg-slate-50/30">
                  <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-4">
                    <p className="text-xs md:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {activeBroadcast.body}
                    </p>

                    {/* Attachments */}
                    {activeBroadcast.attachments?.length > 0 && (
                      <div className="pt-4 border-t border-slate-100 space-y-2">
                        <p className="text-xs font-bold text-slate-700">Attached Documents & Media:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {activeBroadcast.attachments.map((att) => (
                            <div
                              key={att.id}
                              className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2 truncate">
                                {att.isImage ? <ImageIcon className="w-4 h-4 text-amber-600" /> : <FileText className="w-4 h-4 text-blue-500" />}
                                <span className="text-xs font-semibold truncate">{att.originalName}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {att.isImage && (
                                  <button
                                    onClick={() => handlePreviewImage(att, true)}
                                    className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg text-xs"
                                    title="Preview Image"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDownloadFile(att, true)}
                                  className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg text-xs"
                                  title="Download File"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Replies Policy Banner */}
                  {!isAdmin && (
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-4 flex-wrap">
                      {activeBroadcast.allowReplies ? (
                        <div className="flex items-center justify-between w-full gap-2">
                          <div>
                            <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>Direct Replies Allowed</span>
                            </p>
                            <p className="text-[11px] text-slate-500">
                              You can send a private response directly to Institute Administration.
                            </p>
                          </div>
                          <button
                            onClick={() => handleReplyPrivatelyToAdmin(activeBroadcast)}
                            className="px-3.5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-xs flex-shrink-0"
                          >
                            <Reply className="w-3.5 h-3.5" />
                            <span>Reply Privately to Admin</span>
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-slate-400" />
                          <span>This is an official announcement. Replies are disabled.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
                <Megaphone className="w-12 h-12 stroke-[1.5] text-amber-300" />
                <p className="text-sm font-bold text-slate-700">Select an announcement</p>
                <p className="text-xs text-slate-500">
                  {isAdmin
                    ? 'Select a broadcast from the list or send a new one to the campus.'
                    : 'Select an announcement from the list to view its full details.'}
                </p>
              </div>
            )
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* ADMIN BROADCAST COMPOSER MODAL                                            */}
      {/* ========================================================================= */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-amber-50/50 flex-shrink-0">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-700" />
                <span>Compose Institute Broadcast</span>
              </h3>
              <button onClick={() => setIsBroadcastModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setShowSendConfirmation(true); }} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 overflow-y-auto space-y-4 flex-1 min-h-0">
                {broadcastModalError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{broadcastModalError}</span>
                  </div>
                )}

                {/* Target Audience Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Target Audience *</label>
                  <select
                    value={audienceType}
                    onChange={(e) => setAudienceType(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978] font-medium"
                  >
                    <option value="ALL_STUDENTS">All Students (Active)</option>
                    <option value="ALL_TEACHERS">All Faculty & Teachers (Active)</option>
                    <option value="ALL_PARENTS">All Parents / Guardians (Active)</option>
                    <option value="ALL_USERS">All Institute Members (Admins, Teachers, Students, Parents)</option>
                    <option value="CLASS_STUDENTS">Students of Specific Class</option>
                    <option value="CLASS_TEACHERS">Teachers assigned to Specific Class</option>
                    <option value="CLASS_PARENTS">Parents of Students in Specific Class</option>
                  </select>
                </div>

                {/* Specific Class Selector if CLASS_* selected */}
                {audienceType.startsWith('CLASS_') && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Select Academic Class *</label>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                    >
                      <option value="">-- Choose Class --</option>
                      {classesList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.section ? `(${c.section})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Live Audience Preview Counter Badge */}
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-700" />
                    <span className="font-bold text-slate-800">Estimated Delivery:</span>
                  </div>
                  <div className="font-black text-amber-900 font-mono">
                    {previewLoading ? 'Calculating...' : `${previewStats?.recipientCount || 0} Recipients`}
                  </div>
                </div>

                {/* Broadcast Title */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Broadcast Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Mid-Term Assessment Schedule & Guidelines"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>

                {/* Broadcast Message Body */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Message Content *</label>
                  <textarea
                    rows={4}
                    placeholder="Write the official announcement message here..."
                    value={broadcastBody}
                    onChange={(e) => setBroadcastBody(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                  />
                </div>

                {/* Attachment */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Attachment (Optional)</label>
                  <input
                    type="file"
                    ref={broadcastFileInputRef}
                    onChange={(e) => setBroadcastFile(e.target.files?.[0] || null)}
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800"
                  />
                  <p className="text-[10px] text-slate-400">Accepted: PDF, JPG, PNG, WEBP, DOC, DOCX (Max 10MB)</p>
                </div>

                {/* Allow Direct Replies Toggle */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <input
                    type="checkbox"
                    id="allowRepliesCheck"
                    checked={allowReplies}
                    onChange={(e) => setAllowReplies(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-amber-400"
                  />
                  <label htmlFor="allowRepliesCheck" className="text-xs text-slate-700 font-medium cursor-pointer">
                    Allow recipients to reply privately to Institute Administration
                  </label>
                </div>
              </div>

              {/* Modal Footer (Sticky / Always Visible at Bottom) */}
              <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsBroadcastModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!broadcastTitle.trim() || !broadcastBody.trim() || (previewStats && previewStats.recipientCount === 0)}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Review & Send</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showSendConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center mx-auto">
              <Megaphone className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Confirm Broadcast Delivery</h3>
              <p className="text-xs text-slate-500 mt-1">
                You are about to deliver this announcement to <span className="font-bold text-slate-900">{previewStats?.recipientCount || 0} eligible recipients</span>.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setShowSendConfirmation(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Go Back
              </button>
              <button
                onClick={handleSendBroadcast}
                disabled={sending}
                className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500 text-slate-950 hover:bg-amber-400 flex items-center gap-1.5 shadow-xs"
              >
                {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{sending ? 'Sending...' : 'Confirm & Send'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NEW DIRECT MESSAGE MODAL                                                  */}
      {/* ========================================================================= */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-[#FFD978]" />
                <h3 className="text-sm font-black tracking-tight">New Direct Message</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseNewModal}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateNewConversation} className="p-4 overflow-y-auto space-y-4 flex-1">
              {/* Error Banner */}
              {newModalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{newModalError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchRecipients}
                    className="px-2 py-0.5 bg-rose-600 text-white font-bold rounded text-[10px] shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Step 1: Recipient Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Recipient <span className="text-rose-500">*</span>
                </label>

                {selectedRecipient ? (
                  /* Selected Recipient Card */
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {selectedRecipient.displayName?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900">{selectedRecipient.displayName}</h4>
                          <span
                            className={`px-2 py-0.2 rounded text-[10px] font-black uppercase ${
                              selectedRecipient.role === 'ADMIN'
                                ? 'bg-indigo-100 text-indigo-800'
                                : selectedRecipient.role === 'TEACHER'
                                ? 'bg-emerald-100 text-emerald-800'
                                : selectedRecipient.role === 'STUDENT'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {selectedRecipient.role}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {selectedRecipient.context || selectedRecipient.email}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRecipient(null)}
                      className="text-xs font-bold text-slate-500 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-white/60 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  /* Recipient Directory Picker */
                  <div className="space-y-2">
                    {/* Search and Role Filter */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search by name, email, or ID..."
                          value={recipientSearch}
                          onChange={(e) => setRecipientSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FFD978]"
                        />
                      </div>
                      {isAdmin && (
                        <select
                          value={recipientRoleFilter}
                          onChange={(e) => setRecipientRoleFilter(e.target.value)}
                          className="p-2 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                        >
                          <option value="">All Roles</option>
                          <option value="TEACHER">Faculty</option>
                          <option value="STUDENT">Students</option>
                          <option value="PARENT">Parents</option>
                          <option value="ADMIN">Admins</option>
                        </select>
                      )}
                    </div>

                    {/* Recipient Results Dropdown / List */}
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-100">
                      {recipientsLoading ? (
                        <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                          <span>Loading eligible recipients...</span>
                        </div>
                      ) : recipients.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          No eligible recipients found matching your search.
                        </div>
                      ) : (
                        recipients.map((r) => (
                          <div
                            key={r.id}
                            onClick={() => setSelectedRecipient(r)}
                            className="p-2.5 hover:bg-white cursor-pointer transition-colors flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                                {r.displayName?.charAt(0)?.toUpperCase() || 'U'}
                              </div>
                              <div className="truncate">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-900 truncate">{r.displayName}</span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                      r.role === 'ADMIN'
                                        ? 'bg-indigo-100 text-indigo-800'
                                        : r.role === 'TEACHER'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : r.role === 'STUDENT'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-purple-100 text-purple-800'
                                    }`}
                                  >
                                    {r.role}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 truncate">{r.context || r.email}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-amber-700 hover:underline shrink-0">
                              Select
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Subject (Optional) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Subject <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Question regarding semester timetable"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                />
              </div>

              {/* Step 3: Message Body (Required) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Message <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Type your message here..."
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-[#FFD978]"
                  required={!newFile}
                />
              </div>

              {/* Step 4: Attachment (Optional) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Attachment <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={newFileInputRef}
                    onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800"
                  />
                  {newFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewFile(null);
                        if (newFileInputRef.current) newFileInputRef.current.value = '';
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      title="Remove Attachment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">Accepted: PDF, JPG, PNG, WEBP, DOC, DOCX (Max 10MB)</p>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseNewModal}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedRecipient || (!newBody.trim() && !newFile) || sending}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {sending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Message</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shared Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="relative max-w-3xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 flex flex-col">
            <div className="p-3 bg-slate-800 text-white flex items-center justify-between">
              <span className="text-xs font-bold truncate max-w-xs">{previewImage.name}</span>
              <button onClick={handleCloseImagePreview} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 overflow-auto flex items-center justify-center">
              <img src={previewImage.blobUrl} alt={previewImage.name} className="max-h-[75vh] object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
