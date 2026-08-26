import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Image as ImageIcon,
  Video,
  Play,
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  UploadCloud,
  X,
  Calendar,
  Layers,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Film,
  Link,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ExternalLink,
  FileCheck,
} from 'lucide-react';
import {
  apiRequest,
  fetchGalleryMediaBlobUrl,
  revokeProtectedAssetBlobUrl,
  getGalleryStreamTicket,
  getGalleryVideoStreamUrl,
} from '../../../services/api';
import { getEmbedUrl } from '../../../components/gallery/InstituteGalleryViewer';
import GlassCard from '../../../components/common/GlassCard';
import EmptyState from '../../../components/common/EmptyState';

export default function GalleryManagementPage() {
  const [activeTab, setActiveTab] = useState('ALBUMS'); // 'ALBUMS' | 'MEDIA'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [albums, setAlbums] = useState([]);
  const [mediaList, setMediaList] = useState([]);

  // Filters
  const [selectedAlbumFilter, setSelectedAlbumFilter] = useState('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL'); // 'ALL' | 'PUBLISHED' | 'DRAFT'
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [albumModalOpen, setAlbumModalOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState(null);
  const [albumFormData, setAlbumFormData] = useState({
    title: '',
    description: '',
    eventDate: '',
    displayOrder: 0,
    isPublished: true,
  });

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadTargetAlbumId, setUploadTargetAlbumId] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadIsPublished, setUploadIsPublished] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [videoUrlModalOpen, setVideoUrlModalOpen] = useState(false);
  const [videoUrlFormData, setVideoUrlFormData] = useState({
    albumId: '',
    title: '',
    caption: '',
    externalVideoUrl: '',
    displayOrder: 0,
    isPublished: true,
  });

  const [editMediaModalOpen, setEditMediaModalOpen] = useState(false);
  const [editingMedia, setEditingMedia] = useState(null);
  const [mediaFormData, setMediaFormData] = useState({
    title: '',
    caption: '',
    albumId: '',
    displayOrder: 0,
    isPublished: true,
  });

  // Blob URLs Cache
  const [blobUrls, setBlobUrls] = useState({});
  const blobUrlsRef = useRef({});

  // Lightbox & Preview States
  const [lightboxItem, setLightboxItem] = useState(null);
  const [lightboxBlobUrl, setLightboxBlobUrl] = useState(null);
  const [activeVideo, setActiveVideo] = useState(null);
  const [videoStreamUrl, setVideoStreamUrl] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);

  useEffect(() => {
    fetchData();
    return () => {
      Object.values(blobUrlsRef.current).forEach((url) => {
        revokeProtectedAssetBlobUrl(url);
      });
      blobUrlsRef.current = {};
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [albumsRes, mediaRes] = await Promise.all([
        apiRequest('/gallery/albums'),
        apiRequest('/gallery/media'),
      ]);

      if (albumsRes.success) setAlbums(albumsRes.data || []);
      if (mediaRes.success) setMediaList(mediaRes.data || []);
    } catch (err) {
      console.error('Failed to fetch gallery data:', err);
      setError(err.message || 'Unable to load gallery management data.');
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Thumbnail loader
  const loadThumbnail = async (mediaId) => {
    if (blobUrlsRef.current[mediaId]) return;
    try {
      const blobUrl = await fetchGalleryMediaBlobUrl(mediaId);
      blobUrlsRef.current[mediaId] = blobUrl;
      setBlobUrls((prev) => ({ ...prev, [mediaId]: blobUrl }));
    } catch (e) {
      console.warn(`Failed to load thumbnail for media ${mediaId}:`, e);
    }
  };

  useEffect(() => {
    mediaList.forEach((m) => {
      if (m.type === 'IMAGE' || m.type === 'VIDEO_UPLOAD') {
        loadThumbnail(m.id);
      }
    });
  }, [mediaList]);

  // =========================================================================
  // ALBUM HANDLERS
  // =========================================================================
  const openCreateAlbumModal = () => {
    setEditingAlbum(null);
    setAlbumFormData({
      title: '',
      description: '',
      eventDate: new Date().toISOString().split('T')[0],
      displayOrder: 0,
      isPublished: true,
    });
    setAlbumModalOpen(true);
  };

  const openEditAlbumModal = (album) => {
    setEditingAlbum(album);
    setAlbumFormData({
      title: album.title,
      description: album.description || '',
      eventDate: album.eventDate ? new Date(album.eventDate).toISOString().split('T')[0] : '',
      displayOrder: album.displayOrder || 0,
      isPublished: album.isPublished,
    });
    setAlbumModalOpen(true);
  };

  const handleSaveAlbum = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingAlbum) {
        const res = await apiRequest(`/gallery/albums/${editingAlbum.id}`, {
          method: 'PUT',
          body: JSON.stringify(albumFormData),
        });
        if (res.success) {
          showSuccess('Album updated successfully.');
          setAlbumModalOpen(false);
          fetchData();
        }
      } else {
        const res = await apiRequest('/gallery/albums', {
          method: 'POST',
          body: JSON.stringify(albumFormData),
        });
        if (res.success) {
          showSuccess('Album created successfully.');
          setAlbumModalOpen(false);
          fetchData();
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to save album.');
    }
  };

  const handleDeleteAlbum = async (albumId) => {
    if (!window.confirm('Are you sure you want to delete this album? All media within it will be deleted.')) return;
    try {
      const res = await apiRequest(`/gallery/albums/${albumId}`, { method: 'DELETE' });
      if (res.success) {
        showSuccess('Album deleted successfully.');
        fetchData();
      }
    } catch (err) {
      setError(err.message || 'Failed to delete album.');
    }
  };

  const handleToggleAlbumStatus = async (albumId) => {
    try {
      const res = await apiRequest(`/gallery/albums/${albumId}/status`, { method: 'PATCH' });
      if (res.success) {
        showSuccess(res.message || 'Album status updated.');
        fetchData();
      }
    } catch (err) {
      setError(err.message || 'Failed to toggle album status.');
    }
  };

  // =========================================================================
  // MULTI-IMAGE & VIDEO UPLOAD HANDLERS
  // =========================================================================
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check count
    if (uploadFiles.length + files.length > 20) {
      alert('You can upload a maximum of 20 files at once.');
      return;
    }

    const validated = [];
    for (const f of files) {
      const isVideo = f.type.startsWith('video/');
      if (!isVideo && f.size > 10 * 1024 * 1024) {
        alert(`File "${f.name}" is larger than 10MB. Images must be under 10MB.`);
        continue;
      }
      if (isVideo && f.size > 50 * 1024 * 1024) {
        alert(`Video "${f.name}" is larger than 50MB. Videos must be under 50MB.`);
        continue;
      }

      validated.push({
        file: f,
        previewUrl: URL.createObjectURL(f),
        name: f.name,
        size: f.size,
        type: isVideo ? 'VIDEO' : 'IMAGE',
      });
    }

    setUploadFiles((prev) => [...prev, ...validated]);
  };

  const removeUploadFile = (index) => {
    setUploadFiles((prev) => {
      const item = prev[index];
      if (item && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (uploadFiles.length === 0) {
      alert('Please select at least one image or video to upload.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      uploadFiles.forEach((item) => {
        formData.append('files', item.file);
      });

      if (uploadTargetAlbumId) formData.append('albumId', uploadTargetAlbumId);
      if (uploadTitle) formData.append('title', uploadTitle);
      if (uploadCaption) formData.append('caption', uploadCaption);
      formData.append('isPublished', uploadIsPublished ? 'true' : 'false');

      const res = await apiRequest('/gallery/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.success) {
        showSuccess(res.message || 'Media uploaded successfully.');
        // Cleanup local preview URLs
        uploadFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
        setUploadFiles([]);
        setUploadModalOpen(false);
        setUploadTitle('');
        setUploadCaption('');
        fetchData();
      }
    } catch (err) {
      setError(err.message || 'Failed to upload media.');
    } finally {
      setUploading(false);
    }
  };

  // =========================================================================
  // EXTERNAL VIDEO URL HANDLER
  // =========================================================================
  const handleSaveVideoUrl = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiRequest('/gallery/media/video-url', {
        method: 'POST',
        body: JSON.stringify(videoUrlFormData),
      });

      if (res.success) {
        showSuccess('External video added successfully.');
        setVideoUrlModalOpen(false);
        setVideoUrlFormData({
          albumId: '',
          title: '',
          caption: '',
          externalVideoUrl: '',
          displayOrder: 0,
          isPublished: true,
        });
        fetchData();
      }
    } catch (err) {
      setError(err.message || 'Failed to link video URL.');
    }
  };

  // =========================================================================
  // MEDIA EDIT & DELETE HANDLERS
  // =========================================================================
  const openEditMediaModal = (media) => {
    setEditingMedia(media);
    setMediaFormData({
      title: media.title || '',
      caption: media.caption || '',
      albumId: media.albumId || '',
      displayOrder: media.displayOrder || 0,
      isPublished: media.isPublished,
    });
    setEditMediaModalOpen(true);
  };

  const handleSaveMediaEdit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiRequest(`/gallery/media/${editingMedia.id}`, {
        method: 'PUT',
        body: JSON.stringify(mediaFormData),
      });

      if (res.success) {
        showSuccess('Media details updated.');
        setEditMediaModalOpen(false);
        fetchData();
      }
    } catch (err) {
      setError(err.message || 'Failed to update media details.');
    }
  };

  const handleDeleteMedia = async (mediaId) => {
    if (!window.confirm('Are you sure you want to delete this media item?')) return;
    try {
      const res = await apiRequest(`/gallery/media/${mediaId}`, { method: 'DELETE' });
      if (res.success) {
        showSuccess('Media item deleted.');
        fetchData();
      }
    } catch (err) {
      setError(err.message || 'Failed to delete media item.');
    }
  };

  const handleToggleMediaStatus = async (mediaId) => {
    try {
      const res = await apiRequest(`/gallery/media/${mediaId}/status`, { method: 'PATCH' });
      if (res.success) {
        showSuccess(res.message || 'Media publish status updated.');
        fetchData();
      }
    } catch (err) {
      setError(err.message || 'Failed to toggle media status.');
    }
  };

  // =========================================================================
  // PREVIEW / LIGHTBOX HANDLERS
  // =========================================================================
  const [videoError, setVideoError] = useState('');

  const openPreview = async (media) => {
    if (media.type === 'IMAGE') {
      setLightboxItem(media);
      let url = blobUrlsRef.current[media.id];
      if (!url) {
        try {
          url = await fetchGalleryMediaBlobUrl(media.id);
          blobUrlsRef.current[media.id] = url;
          setBlobUrls((prev) => ({ ...prev, [media.id]: url }));
        } catch (e) {
          console.warn('Failed to load image for lightbox:', e);
        }
      }
      setLightboxBlobUrl(url);
    } else {
      setActiveVideo(media);
      setVideoError('');
      setVideoStreamUrl(null);
      if (media.type === 'VIDEO_UPLOAD') {
        setVideoLoading(true);
        try {
          const ticket = await getGalleryStreamTicket(media.id);
          setVideoStreamUrl(getGalleryVideoStreamUrl(media.id, ticket));
        } catch (err) {
          console.error('Failed to get ticket:', err);
          setVideoError(err.message || 'Unable to play this video.');
        } finally {
          setVideoLoading(false);
        }
      }
    }
  };

  // Keyboard navigation for Admin Preview
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (lightboxItem) setLightboxItem(null);
        if (activeVideo) setActiveVideo(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxItem, activeVideo]);

  // Filtered Media List for Admin View
  const filteredMedia = useMemo(() => {
    return mediaList.filter((item) => {
      if (selectedAlbumFilter !== 'ALL' && item.albumId !== Number(selectedAlbumFilter)) {
        return false;
      }
      if (selectedTypeFilter === 'IMAGE' && item.type !== 'IMAGE') return false;
      if (selectedTypeFilter === 'VIDEO' && item.type !== 'VIDEO_UPLOAD' && item.type !== 'VIDEO_URL') return false;
      if (selectedStatusFilter === 'PUBLISHED' && !item.isPublished) return false;
      if (selectedStatusFilter === 'DRAFT' && item.isPublished) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const titleMatch = item.title && item.title.toLowerCase().includes(query);
        const captionMatch = item.caption && item.caption.toLowerCase().includes(query);
        if (!titleMatch && !captionMatch) return false;
      }
      return true;
    });
  }, [mediaList, selectedAlbumFilter, selectedTypeFilter, selectedStatusFilter, searchTerm]);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header Banner */}
      <GlassCard className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Campus Management</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Institute Gallery & Media Hub
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Organize campus event photo albums, upload high-res highlights, and manage video showcases.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={openCreateAlbumModal}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Album</span>
            </button>
            <button
              onClick={() => {
                setUploadFiles([]);
                setUploadModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-xs transition active:scale-95"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload Media</span>
            </button>
            <button
              onClick={() => setVideoUrlModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border border-slate-200"
            >
              <Link className="w-3.5 h-3.5" />
              <span>Link Video URL</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('ALBUMS')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'ALBUMS'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Albums ({albums.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('MEDIA')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'MEDIA'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>All Media ({mediaList.length})</span>
          </button>
        </div>
      </GlassCard>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. ALBUMS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'ALBUMS' && (
        <div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-64 rounded-3xl bg-slate-100 animate-pulse border border-slate-200" />
              ))}
            </div>
          ) : albums.length === 0 ? (
            <GlassCard className="p-12 text-center">
              <EmptyState
                icon={Layers}
                title="No Gallery Albums Found"
                description="Create your first album to start organizing campus event media."
              />
              <button
                onClick={openCreateAlbumModal}
                className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Album</span>
              </button>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {albums.map((album) => (
                <GlassCard key={album.id} className="overflow-hidden flex flex-col justify-between border-slate-200/80">
                  <div className="p-5">
                    {/* Status & Date */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className={`text-[10px] uppercase tracking-wider font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                          album.isPublished
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {album.isPublished ? (
                          <>
                            <Eye className="w-2.5 h-2.5" /> Published
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-2.5 h-2.5" /> Draft
                          </>
                        )}
                      </span>
                      {album.eventDate && (
                        <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(album.eventDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-black text-slate-900 tracking-tight mb-1">
                      {album.title}
                    </h3>
                    {album.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                        {album.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs font-bold text-slate-500 pt-3 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                        <span>{album.mediaCount || 0} Media Items</span>
                      </span>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="bg-slate-50/80 px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleToggleAlbumStatus(album.id)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                        album.isPublished
                          ? 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600'
                      }`}
                    >
                      {album.isPublished ? 'Unpublish' : 'Publish'}
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditAlbumModal(album)}
                        className="p-2 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition"
                        title="Edit Album"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAlbum(album.id)}
                        className="p-2 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 transition"
                        title="Delete Album"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ALL MEDIA TAB */}
      {/* ========================================================================= */}
      {activeTab === 'MEDIA' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <GlassCard className="p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {/* Album Filter */}
                <select
                  value={selectedAlbumFilter}
                  onChange={(e) => setSelectedAlbumFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-700 focus:bg-white focus:outline-none"
                >
                  <option value="ALL">All Albums</option>
                  {albums.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>

                {/* Type Filter */}
                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-700 focus:bg-white focus:outline-none"
                >
                  <option value="ALL">All Media Types</option>
                  <option value="IMAGE">Photos Only</option>
                  <option value="VIDEO">Videos Only</option>
                </select>

                {/* Status Filter */}
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-700 focus:bg-white focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PUBLISHED">Published Only</option>
                  <option value="DRAFT">Draft Only</option>
                </select>
              </div>

              {/* Search */}
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search media..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </GlassCard>

          {/* Media Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="h-48 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
              ))}
            </div>
          ) : filteredMedia.length === 0 ? (
            <GlassCard className="p-12 text-center">
              <EmptyState
                icon={ImageIcon}
                title="No Media Found"
                description={
                  searchTerm
                    ? `No media matches your search "${searchTerm}".`
                    : 'No media uploaded yet. Click "Upload Media" or "Link Video URL" to get started.'
                }
              />
            </GlassCard>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredMedia.map((item) => {
                const isImage = item.type === 'IMAGE';
                const isVideo = item.type === 'VIDEO_UPLOAD' || item.type === 'VIDEO_URL';
                const blobUrl = blobUrls[item.id];

                return (
                  <div
                    key={item.id}
                    className="group relative bg-white rounded-2xl overflow-hidden border border-slate-200/80 hover:border-amber-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    {/* Thumbnail View */}
                    <div
                      onClick={() => openPreview(item)}
                      className="relative aspect-square bg-slate-900 overflow-hidden cursor-pointer flex items-center justify-center"
                    >
                      {isImage ? (
                        blobUrl ? (
                          <img
                            src={blobUrl}
                            alt={item.title || 'Image'}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-slate-600 animate-pulse" />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-950 text-white">
                          <Play className="w-8 h-8 fill-current text-amber-400" />
                        </div>
                      )}

                      {/* Status Badge */}
                      <span
                        className={`absolute top-2 left-2 text-[9px] font-black px-2 py-0.5 rounded-md backdrop-blur-xs ${
                          item.isPublished
                            ? 'bg-emerald-500/90 text-white'
                            : 'bg-slate-900/80 text-amber-300'
                        }`}
                      >
                        {item.isPublished ? 'Published' : 'Draft'}
                      </span>

                      {/* Type Badge */}
                      <span className="absolute bottom-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-white uppercase">
                        {item.type === 'VIDEO_URL' ? 'Link' : isVideo ? 'Video' : 'Photo'}
                      </span>
                    </div>

                    {/* Metadata & Controls */}
                    <div className="p-3 bg-white flex flex-col justify-between flex-1">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {item.title || 'Untitled'}
                        </h4>
                        {item.album && (
                          <span className="text-[10px] text-slate-400 font-semibold truncate block">
                            {item.album.title}
                          </span>
                        )}
                      </div>

                      {/* Row Action Buttons */}
                      <div className="flex items-center justify-between gap-1 mt-2.5 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleToggleMediaStatus(item.id)}
                          className={`p-1.5 rounded-lg border text-[10px] font-bold transition ${
                            item.isPublished
                              ? 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                          }`}
                          title={item.isPublished ? 'Unpublish' : 'Publish'}
                        >
                          {item.isPublished ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditMediaModal(item)}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition"
                            title="Edit Media"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteMedia(item.id)}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-rose-600 border border-rose-200 transition"
                            title="Delete Media"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE / EDIT ALBUM */}
      {/* ========================================================================= */}
      {albumModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-900">
                {editingAlbum ? 'Edit Gallery Album' : 'Create Gallery Album'}
              </h3>
              <button
                onClick={() => setAlbumModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAlbum} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Album Title *
                </label>
                <input
                  type="text"
                  required
                  value={albumFormData.title}
                  onChange={(e) => setAlbumFormData({ ...albumFormData, title: e.target.value })}
                  placeholder="e.g. Annual Sports Day 2026"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={albumFormData.description}
                  onChange={(e) => setAlbumFormData({ ...albumFormData, description: e.target.value })}
                  placeholder="Brief summary of the album..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Event Date
                  </label>
                  <input
                    type="date"
                    value={albumFormData.eventDate}
                    onChange={(e) => setAlbumFormData({ ...albumFormData, eventDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={albumFormData.displayOrder}
                    onChange={(e) => setAlbumFormData({ ...albumFormData, displayOrder: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="albumPublishCheck"
                  checked={albumFormData.isPublished}
                  onChange={(e) => setAlbumFormData({ ...albumFormData, isPublished: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0 border-slate-300"
                />
                <label htmlFor="albumPublishCheck" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Publish this album (visible to Students, Teachers, and Parents)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAlbumModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-xs transition"
                >
                  {editingAlbum ? 'Save Changes' : 'Create Album'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: MULTI-IMAGE & VIDEO UPLOAD */}
      {/* ========================================================================= */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Upload Campus Media</h3>
                <p className="text-xs text-slate-500">Supports JPG, PNG, WebP (up to 10MB) and MP4, WebM (up to 50MB).</p>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assign to Album (Optional)
                </label>
                <select
                  value={uploadTargetAlbumId}
                  onChange={(e) => setUploadTargetAlbumId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:outline-none"
                >
                  <option value="">-- No Album (Standalone Media) --</option>
                  {albums.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Drag & Drop Box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 rounded-2xl border-2 border-dashed border-slate-200 hover:border-amber-400 bg-slate-50/60 hover:bg-amber-50/20 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900">Click or Drag & Drop media here</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">Select up to 20 images or videos</p>
                </div>
              </div>

              {/* File Previews */}
              {uploadFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Selected Files ({uploadFiles.length})</span>
                    <button
                      type="button"
                      onClick={() => setUploadFiles([])}
                      className="text-rose-600 hover:underline text-[11px]"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1 bg-slate-50 rounded-2xl border border-slate-200">
                    {uploadFiles.map((f, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-slate-900 group">
                        {f.type === 'IMAGE' ? (
                          <img src={f.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-white p-1 text-center">
                            <Video className="w-6 h-6 text-amber-400 mb-1" />
                            <span className="text-[9px] truncate max-w-full font-mono">{f.name}</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeUploadFile(idx)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-rose-600 text-white opacity-90 hover:opacity-100 transition shadow-xs"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="uploadPublishCheck"
                  checked={uploadIsPublished}
                  onChange={(e) => setUploadIsPublished(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0 border-slate-300"
                />
                <label htmlFor="uploadPublishCheck" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Publish uploaded media immediately
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  disabled={uploading}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || uploadFiles.length === 0}
                  className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-xs transition disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{uploading ? 'Uploading...' : `Upload ${uploadFiles.length} Item(s)`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EXTERNAL VIDEO URL */}
      {/* ========================================================================= */}
      {videoUrlModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-900">Link External Video</h3>
              <button
                onClick={() => setVideoUrlModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVideoUrl} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assign to Album (Optional)
                </label>
                <select
                  value={videoUrlFormData.albumId}
                  onChange={(e) => setVideoUrlFormData({ ...videoUrlFormData, albumId: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:outline-none"
                >
                  <option value="">-- No Album (Standalone) --</option>
                  {albums.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Video Title *
                </label>
                <input
                  type="text"
                  required
                  value={videoUrlFormData.title}
                  onChange={(e) => setVideoUrlFormData({ ...videoUrlFormData, title: e.target.value })}
                  placeholder="e.g. Science Fair Highlights 2026"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  External Video URL (HTTPS) *
                </label>
                <input
                  type="url"
                  required
                  value={videoUrlFormData.externalVideoUrl}
                  onChange={(e) => setVideoUrlFormData({ ...videoUrlFormData, externalVideoUrl: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Caption (Optional)
                </label>
                <textarea
                  rows={2}
                  value={videoUrlFormData.caption}
                  onChange={(e) => setVideoUrlFormData({ ...videoUrlFormData, caption: e.target.value })}
                  placeholder="Additional context..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="videoUrlPublishCheck"
                  checked={videoUrlFormData.isPublished}
                  onChange={(e) => setVideoUrlFormData({ ...videoUrlFormData, isPublished: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0 border-slate-300"
                />
                <label htmlFor="videoUrlPublishCheck" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Publish video immediately
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVideoUrlModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-xs transition"
                >
                  Add Video Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: EDIT MEDIA METADATA */}
      {/* ========================================================================= */}
      {editMediaModalOpen && editingMedia && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-900">Edit Media Details</h3>
              <button
                onClick={() => setEditMediaModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMediaEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={mediaFormData.title}
                  onChange={(e) => setMediaFormData({ ...mediaFormData, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Album Assignment
                </label>
                <select
                  value={mediaFormData.albumId}
                  onChange={(e) => setMediaFormData({ ...mediaFormData, albumId: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:outline-none"
                >
                  <option value="">-- Standalone (No Album) --</option>
                  {albums.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Caption
                </label>
                <textarea
                  rows={2}
                  value={mediaFormData.caption}
                  onChange={(e) => setMediaFormData({ ...mediaFormData, caption: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="mediaEditPublishCheck"
                  checked={mediaFormData.isPublished}
                  onChange={(e) => setMediaFormData({ ...mediaFormData, isPublished: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0 border-slate-300"
                />
                <label htmlFor="mediaEditPublishCheck" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Publish this media item
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditMediaModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-xs transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: LIGHTBOX PREVIEW */}
      {/* ========================================================================= */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setLightboxItem(null)}
        >
          <div className="flex items-center justify-between text-white z-10" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs font-bold text-slate-200">
              {lightboxItem.title || 'Preview Image'}
            </span>
            <button
              onClick={() => setLightboxItem(null)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {lightboxBlobUrl ? (
              <img
                src={lightboxBlobUrl}
                alt="Preview"
                className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl"
              />
            ) : (
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
            )}
          </div>

          {lightboxItem.caption && (
            <div className="bg-black/40 backdrop-blur-md rounded-2xl p-3 text-center max-w-xl mx-auto w-full text-white text-xs">
              {lightboxItem.caption}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: VIDEO PLAYER PREVIEW */}
      {/* ========================================================================= */}
      {activeVideo && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setActiveVideo(null)}
        >
          <div
            className="bg-slate-900 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2 truncate pr-2">
                <Video className="w-4 h-4 text-amber-400 shrink-0" />
                <h3 className="text-sm font-bold truncate">{activeVideo.title || 'Video Player'}</h3>
              </div>
              <div className="flex items-center gap-2">
                {activeVideo.type === 'VIDEO_URL' && activeVideo.externalVideoUrl && (
                  <button
                    onClick={() => window.open(activeVideo.externalVideoUrl, '_blank', 'noopener,noreferrer')}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition text-xs flex items-center gap-1 font-semibold cursor-pointer"
                    title="Open Original Video"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Open Link</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveVideo(null)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                  aria-label="Close Preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              {videoLoading ? (
                <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                  <span>Preparing video...</span>
                </div>
              ) : videoError ? (
                <div className="p-6 text-center text-rose-400 text-xs font-semibold flex flex-col items-center gap-3">
                  <AlertCircle className="w-7 h-7" />
                  <span>{videoError}</span>
                  <button
                    onClick={() => openPreview(activeVideo)}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : activeVideo.type === 'VIDEO_UPLOAD' ? (
                videoStreamUrl ? (
                  <video
                    src={videoStreamUrl}
                    controls
                    autoPlay
                    playsInline
                    controlsList="nodownload"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-500">Stream initializing...</span>
                )
              ) : (
                <iframe
                  src={getEmbedUrl(activeVideo.externalVideoUrl)}
                  title={activeVideo.title || 'Video'}
                  className="w-full h-full border-0"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>

            {activeVideo.caption && (
              <div className="p-4 bg-slate-950/60 border-t border-slate-800 text-slate-300 text-xs">
                <p>{activeVideo.caption}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
