import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Image as ImageIcon,
  Video,
  Play,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  AlertCircle,
  Film,
  ExternalLink,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  apiRequest,
  fetchGalleryMediaBlobUrl,
  revokeProtectedAssetBlobUrl,
  getGalleryStreamTicket,
  getGalleryVideoStreamUrl,
} from '../../services/api';
import GlassCard from '../common/GlassCard';
import EmptyState from '../common/EmptyState';

/**
 * Safely parse and normalize external video URLs to embed format (YouTube / Vimeo)
 */
export function getEmbedUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    // 1. YouTube
    if (host.includes('youtube.com') || host.includes('youtube-nocookie.com') || host.includes('youtu.be')) {
      let videoId = null;
      if (host.includes('youtu.be')) {
        videoId = parsed.pathname.slice(1).split('/')[0];
      } else if (parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.replace('/embed/', '').split('/')[0];
      } else if (parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.replace('/shorts/', '').split('/')[0];
      } else {
        videoId = parsed.searchParams.get('v');
      }

      if (videoId && /^[a-zA-Z0-9_-]{6,15}$/.test(videoId)) {
        return `https://www.youtube.com/embed/${videoId}?rel=0`;
      }
    }

    // 2. Vimeo
    if (host.includes('vimeo.com')) {
      if (host.includes('player.vimeo.com')) {
        return trimmed;
      }
      const match = parsed.pathname.match(/\/(\d+)/);
      if (match && match[1]) {
        return `https://player.vimeo.com/video/${match[1]}`;
      }
    }

    return trimmed;
  } catch (e) {
    return trimmed;
  }
}

export default function InstituteGalleryViewer({ role = 'STUDENT' }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [albums, setAlbums] = useState([]);
  const [mediaList, setMediaList] = useState([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);
  const [selectedType, setSelectedType] = useState('ALL'); // 'ALL' | 'IMAGE' | 'VIDEO'
  const [searchTerm, setSearchTerm] = useState('');

  // Blob URL Cache to avoid re-fetching and memory leaks
  const [blobUrls, setBlobUrls] = useState({});
  const blobUrlsRef = useRef({});

  // Lightbox State (Images)
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [lightboxBlobUrl, setLightboxBlobUrl] = useState(null);
  const [lightboxLoading, setLightboxLoading] = useState(false);
  const [lightboxError, setLightboxError] = useState('');

  // Video Player Modal State
  const [activeVideo, setActiveVideo] = useState(null);
  const [videoStreamUrl, setVideoStreamUrl] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState('');

  useEffect(() => {
    fetchGalleryData();
    return () => {
      // Cleanup all cached blob URLs on unmount
      Object.values(blobUrlsRef.current).forEach((url) => {
        revokeProtectedAssetBlobUrl(url);
      });
      blobUrlsRef.current = {};
    };
  }, []);

  const fetchGalleryData = async () => {
    setLoading(true);
    setError('');
    try {
      const [albumsRes, mediaRes] = await Promise.all([
        apiRequest('/gallery/albums'),
        apiRequest('/gallery/media'),
      ]);

      if (albumsRes.success) {
        setAlbums(albumsRes.data || []);
      }
      if (mediaRes.success) {
        setMediaList(mediaRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load gallery:', err);
      setError(err.message || 'Unable to load institute gallery.');
    } finally {
      setLoading(false);
    }
  };

  // Filtered Media List
  const filteredMedia = useMemo(() => {
    return mediaList.filter((item) => {
      if (selectedAlbumId !== null && item.albumId !== selectedAlbumId) {
        return false;
      }
      if (selectedType === 'IMAGE' && item.type !== 'IMAGE') {
        return false;
      }
      if (selectedType === 'VIDEO' && item.type !== 'VIDEO_UPLOAD' && item.type !== 'VIDEO_URL') {
        return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const titleMatch = item.title && item.title.toLowerCase().includes(query);
        const captionMatch = item.caption && item.caption.toLowerCase().includes(query);
        if (!titleMatch && !captionMatch) return false;
      }
      return true;
    });
  }, [mediaList, selectedAlbumId, selectedType, searchTerm]);

  // Track failed thumbnail fetches
  const [failedThumbnailIds, setFailedThumbnailIds] = useState({});

  // Load thumbnail blob on demand (Images only)
  const loadThumbnail = useCallback(async (mediaId, forceFresh = false) => {
    if (blobUrlsRef.current[mediaId] && !forceFresh) return;
    try {
      const blobUrl = await fetchGalleryMediaBlobUrl(mediaId);
      blobUrlsRef.current[mediaId] = blobUrl;
      setBlobUrls((prev) => ({ ...prev, [mediaId]: blobUrl }));
      setFailedThumbnailIds((prev) => {
        const next = { ...prev };
        delete next[mediaId];
        return next;
      });
    } catch (e) {
      console.warn(`Failed to load thumbnail blob for media ${mediaId}:`, e);
      delete blobUrlsRef.current[mediaId];
      setFailedThumbnailIds((prev) => ({ ...prev, [mediaId]: true }));
    }
  }, []);

  // Preload visible image thumbnails
  useEffect(() => {
    filteredMedia.forEach((m) => {
      if (m.type === 'IMAGE') {
        loadThumbnail(m.id);
      }
    });
  }, [filteredMedia, loadThumbnail]);

  // Image Lightbox Navigation
  const imageItems = useMemo(() => {
    return filteredMedia.filter((m) => m.type === 'IMAGE');
  }, [filteredMedia]);

  const loadLightboxImage = useCallback(async (mediaItem, forceFresh = false) => {
    if (!mediaItem) return;
    setLightboxLoading(true);
    setLightboxError('');
    try {
      let url = blobUrlsRef.current[mediaItem.id];
      if (!url || forceFresh) {
        if (forceFresh && url) {
          revokeProtectedAssetBlobUrl(url);
          delete blobUrlsRef.current[mediaItem.id];
        }
        url = await fetchGalleryMediaBlobUrl(mediaItem.id);
        blobUrlsRef.current[mediaItem.id] = url;
        setBlobUrls((prev) => ({ ...prev, [mediaItem.id]: url }));
      }
      setLightboxBlobUrl(url);
    } catch (err) {
      console.error('Failed to load lightbox image:', err);
      delete blobUrlsRef.current[mediaItem.id];
      setLightboxBlobUrl(null);
      setLightboxError('Unable to load image.');
    } finally {
      setLightboxLoading(false);
    }
  }, []);

  const openLightbox = (mediaItem) => {
    const idx = imageItems.findIndex((m) => m.id === mediaItem.id);
    if (idx !== -1) {
      setLightboxIndex(idx);
      loadLightboxImage(mediaItem);
    }
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    setLightboxBlobUrl(null);
    setLightboxError('');
  };

  const handlePrevImage = useCallback(() => {
    if (lightboxIndex === null || imageItems.length === 0) return;
    const newIdx = (lightboxIndex - 1 + imageItems.length) % imageItems.length;
    setLightboxIndex(newIdx);
    loadLightboxImage(imageItems[newIdx]);
  }, [lightboxIndex, imageItems, loadLightboxImage]);

  const handleNextImage = useCallback(() => {
    if (lightboxIndex === null || imageItems.length === 0) return;
    const newIdx = (lightboxIndex + 1) % imageItems.length;
    setLightboxIndex(newIdx);
    loadLightboxImage(imageItems[newIdx]);
  }, [lightboxIndex, imageItems, loadLightboxImage]);

  // Video Player Handler
  const openVideoModal = async (mediaItem) => {
    if (videoLoading) return;
    setActiveVideo(mediaItem);
    setVideoError('');
    setVideoStreamUrl(null);

    if (mediaItem.type === 'VIDEO_UPLOAD') {
      setVideoLoading(true);
      try {
        // Request short-lived ticket
        const ticket = await getGalleryStreamTicket(mediaItem.id);
        setVideoStreamUrl(getGalleryVideoStreamUrl(mediaItem.id, ticket));
      } catch (err) {
        console.error('Failed to get video stream ticket:', err);
        setVideoError(err.message || 'Unable to play this video.');
      } finally {
        setVideoLoading(false);
      }
    }
  };

  const closeVideoModal = () => {
    setActiveVideo(null);
    setVideoStreamUrl(null);
    setVideoError('');
    setVideoLoading(false);
  };

  // Keyboard navigation for Lightbox & Video Modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxIndex !== null) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeLightbox();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handlePrevImage();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleNextImage();
        }
      }
      if (activeVideo && e.key === 'Escape') {
        e.preventDefault();
        closeVideoModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, activeVideo, handlePrevImage, handleNextImage]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Controls */}
      <GlassCard className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Campus Showcase</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Institute Media Gallery
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Explore official campus events, extracurricular activities, and achievement highlights.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchGalleryData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition disabled:opacity-50"
              title="Refresh Gallery"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-5 border-t border-slate-100">
          {/* Type Filter Buttons */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 w-full sm:w-auto">
            <button
              onClick={() => setSelectedType('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                selectedType === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All ({mediaList.length})
            </button>
            <button
              onClick={() => setSelectedType('IMAGE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                selectedType === 'IMAGE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Photos ({mediaList.filter((m) => m.type === 'IMAGE').length})
            </button>
            <button
              onClick={() => setSelectedType('VIDEO')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                selectedType === 'VIDEO'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              Videos ({mediaList.filter((m) => m.type === 'VIDEO_UPLOAD' || m.type === 'VIDEO_URL').length})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search title or caption..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-amber-400 transition"
            />
          </div>
        </div>

        {/* Album Category Badges */}
        {albums.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 mt-4 pt-3 border-t border-slate-100 no-scrollbar">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
              Albums:
            </span>
            <button
              onClick={() => setSelectedAlbumId(null)}
              className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition ${
                selectedAlbumId === null
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Albums
            </button>
            {albums.map((album) => (
              <button
                key={album.id}
                onClick={() => setSelectedAlbumId(album.id)}
                className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
                  selectedAlbumId === album.id
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{album.title}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 font-black">
                  {album.mediaCount || 0}
                </span>
              </button>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Media Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="h-56 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
          ))}
        </div>
      ) : filteredMedia.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <EmptyState
            icon={Layers}
            title="No Published Media Available"
            description={
              searchTerm
                ? `No media matches your search "${searchTerm}".`
                : selectedAlbumId
                ? 'No published items found in this album.'
                : 'No published gallery albums or media have been shared yet.'
            }
          />
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4.5">
          {filteredMedia.map((item) => {
            const isImage = item.type === 'IMAGE';
            const isVideoUpload = item.type === 'VIDEO_UPLOAD';
            const isVideoUrl = item.type === 'VIDEO_URL';
            const blobUrl = blobUrls[item.id];

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`View ${item.title || (isImage ? 'photo' : 'video')}`}
                onClick={() => {
                  if (isImage) openLightbox(item);
                  else openVideoModal(item);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (isImage) openLightbox(item);
                    else openVideoModal(item);
                  }
                }}
                className="group relative bg-white rounded-2xl overflow-hidden border border-slate-200/80 hover:border-amber-300 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {/* Media Thumbnail Container */}
                <div className="relative aspect-4/3 bg-slate-900 overflow-hidden flex items-center justify-center">
                  {isImage ? (
                    blobUrl ? (
                      <img
                        src={blobUrl}
                        alt={item.title || 'Gallery image'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                        loading="lazy"
                      />
                    ) : failedThumbnailIds[item.id] ? (
                      <div className="flex flex-col items-center justify-center text-rose-400 text-xs pointer-events-none p-2 text-center">
                        <AlertCircle className="w-6 h-6 mb-1 opacity-80" />
                        <span className="text-[10px] font-semibold">Unable to load</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-500 text-xs pointer-events-none">
                        <ImageIcon className="w-8 h-8 opacity-40 mb-1" />
                        <span className="text-[10px]">Loading image...</span>
                      </div>
                    )
                  ) : isVideoUpload ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-slate-950 pointer-events-none">
                      <Film className="w-10 h-10 text-slate-700 pointer-events-none" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/20 transition-colors pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform pointer-events-none">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>
                      <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-black/70 text-white font-mono text-[10px] font-bold pointer-events-none">
                        Video
                      </span>
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-950 to-slate-950 pointer-events-none">
                      <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform pointer-events-none">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                      <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-black/70 text-white font-mono text-[10px] font-bold flex items-center gap-1 pointer-events-none">
                        <ExternalLink className="w-2.5 h-2.5" /> Web Video
                      </span>
                    </div>
                  )}

                  {/* Album Tag */}
                  {item.album && (
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold pointer-events-none">
                      {item.album.title}
                    </span>
                  )}
                </div>

                {/* Media Details */}
                <div className="p-3.5 flex-1 flex flex-col justify-between bg-white pointer-events-none">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-amber-600 transition-colors">
                      {item.title || 'Untitled Item'}
                    </h4>
                    {item.caption && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                        {item.caption}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mt-2.5 pt-2 border-t border-slate-100">
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                      {isImage ? 'Photo' : 'Video'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LIGHTBOX MODAL (Photos) */}
      {lightboxIndex !== null && imageItems[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col justify-between p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={closeLightbox}
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between text-white z-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold bg-white/10 px-2.5 py-1 rounded-lg">
                {lightboxIndex + 1} / {imageItems.length}
              </span>
              <span className="text-xs font-bold text-slate-200 truncate max-w-[200px] sm:max-w-md">
                {imageItems[lightboxIndex].title || 'Campus Image'}
              </span>
            </div>
            <button
              onClick={closeLightbox}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition active:scale-95 cursor-pointer"
              aria-label="Close Lightbox"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Central Image View */}
          <div
            className="relative flex-1 flex items-center justify-center my-2 sm:my-4 overflow-hidden w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxLoading ? (
              <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
                <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
                <span>Loading image...</span>
              </div>
            ) : lightboxError ? (
              <div className="flex flex-col items-center gap-3 text-rose-400 text-xs font-semibold bg-rose-950/40 p-6 rounded-2xl border border-rose-800/50">
                <AlertCircle className="w-7 h-7" />
                <span>{lightboxError}</span>
                <button
                  onClick={() => loadLightboxImage(imageItems[lightboxIndex], true)}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : lightboxBlobUrl ? (
              <img
                src={lightboxBlobUrl}
                alt={imageItems[lightboxIndex].title || 'Lightbox'}
                className="max-h-[70vh] sm:max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl select-none"
              />
            ) : (
              <div className="text-slate-400 text-xs">Image unavailable.</div>
            )}

            {/* Prev Button */}
            {imageItems.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevImage();
                }}
                className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-xs transition active:scale-90 cursor-pointer shadow-lg z-20"
                aria-label="Previous Image"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}

            {/* Next Button */}
            {imageItems.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextImage();
                }}
                className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-xs transition active:scale-90 cursor-pointer shadow-lg z-20"
                aria-label="Next Image"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
          </div>

          {/* Caption & Metadata Footer */}
          <div
            className="bg-black/50 backdrop-blur-md rounded-2xl p-3 sm:p-4 text-center max-w-2xl mx-auto w-full z-10 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {imageItems[lightboxIndex].caption && (
              <p className="text-xs sm:text-sm text-slate-200 font-medium mb-1 line-clamp-2">
                {imageItems[lightboxIndex].caption}
              </p>
            )}
            <div className="flex items-center justify-center flex-wrap gap-2 sm:gap-3 text-[10px] sm:text-[11px] text-slate-400 font-semibold">
              {imageItems[lightboxIndex].album && (
                <span>Album: {imageItems[lightboxIndex].album.title}</span>
              )}
              {imageItems[lightboxIndex].album && <span>•</span>}
              <span>{new Date(imageItems[lightboxIndex].createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* VIDEO PLAYER MODAL */}
      {activeVideo && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={closeVideoModal}
        >
          <div
            className="bg-slate-900 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2 truncate pr-2">
                <Video className="w-4 h-4 text-amber-400 shrink-0" />
                <h3 className="text-sm font-bold truncate">
                  {activeVideo.title || 'Video Player'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {activeVideo.type === 'VIDEO_URL' && activeVideo.externalVideoUrl && (
                  <button
                    onClick={() => window.open(activeVideo.externalVideoUrl, '_blank', 'noopener,noreferrer')}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition text-xs flex items-center gap-1 font-semibold"
                    title="Open Original Video"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Open Link</span>
                  </button>
                )}
                <button
                  onClick={closeVideoModal}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                  aria-label="Close Video"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Video Container (16:9) */}
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
                    onClick={() => openVideoModal(activeVideo)}
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
                  title={activeVideo.title || 'Video Embed'}
                  className="w-full h-full border-0"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>

            {/* Video Caption Footer */}
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

