import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest, fetchProtectedAssetBlobUrl, revokeProtectedAssetBlobUrl } from '../../services/api';
import CountdownTimer from '../../components/common/CountdownTimer';
import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  ArrowLeft,
  Clock,
  Award,
  Check,
  X,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  WifiOff,
  BookOpen,
  Camera,
  Image as ImageIcon,
  FileText,
  Trash2,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Eye,
  Upload,
  Plus,
  Lock,
} from 'lucide-react';

export default function LiveExamPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preExamData, setPreExamData] = useState(null);
  const [instructionsRead, setInstructionsRead] = useState(false);
  const [examStarted, setExamStarted] = useState(false);

  // Active attempt state
  const [examData, setExamData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [saveStatus, setSaveStatus] = useState({}); // { [qId]: 'saving' | 'saved' | 'error' }
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Written Exam Workspace State
  const [writtenPages, setWrittenPages] = useState([]); // [{ id, file, previewUrl, name, size }]
  const [stagedSubmission, setStagedSubmission] = useState(null);
  const [uploadingAnswer, setUploadingAnswer] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [previewModalPage, setPreviewModalPage] = useState(null);
  const [stagedPdfBlobUrl, setStagedPdfBlobUrl] = useState(null);
  const [loadingStagedPdf, setLoadingStagedPdf] = useState(false);
  const [replacingPageIndex, setReplacingPageIndex] = useState(null);
  const [isTimedOut, setIsTimedOut] = useState(false);

  // In-App Camera Modal State
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState('environment'); // 'environment' | 'user'
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturedImageBlob, setCapturedImageBlob] = useState(null);
  const [capturedImagePreview, setCapturedImagePreview] = useState(null);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const galleryInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // Network offline/online detection
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Stop camera stream utility (Stops all tracks and releases camera hardware)
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {
        console.warn('Error stopping camera tracks:', e);
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStream(null);
  }, []);

  // Cleanup Object URLs and Camera Stream upon unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
      writtenPages.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
      if (stagedPdfBlobUrl) {
        revokeProtectedAssetBlobUrl(stagedPdfBlobUrl);
      }
    };
  }, [stopCameraStream]);

  // Anti-accident navigation protection during active examination
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (examStarted && !resultData && !submitting) {
        e.preventDefault();
        e.returnValue = 'Your examination is currently in progress. The timer will continue running.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [examStarted, resultData, submitting]);

  // 1. Initial Load: Check for active attempt or load instructions
  const checkInitialExamState = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch pre-attempt metadata & instructions
      const res = await apiRequest(`/exams/student/${id}/instructions`);
      if (res.success && res.data) {
        setPreExamData(res.data);

        // If an active in-progress attempt already exists, resume immediately
        if (res.data.hasActiveAttempt) {
          await startOrResumeExam();
        }
      } else {
        setError(res.message || 'Unable to load examination details.');
      }
    } catch (err) {
      setError(err.message || 'Unable to access online examination.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    checkInitialExamState();
  }, [checkInitialExamState]);

  // 2. Start or Resume Exam Attempt
  const startOrResumeExam = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest(`/exams/student/${id}/start`, {
        method: 'POST',
      });

      if (res.success && res.data) {
        setExamData(res.data);
        setQuestions(res.data.questions || []);
        setAnswers(res.data.savedAnswers || {});
        setExamStarted(true);

        // If Written Exam, check for any existing staged submission
        if (res.data.exam?.examType === 'WRITTEN' || preExamData?.examType === 'WRITTEN') {
          await fetchStagedWrittenSubmission();
        }
      } else {
        setError(res.message || 'Failed to start examination session.');
      }
    } catch (err) {
      setError(err.message || 'Unable to initialize live exam session.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Staged Written Submission Details
  const fetchStagedWrittenSubmission = async () => {
    try {
      const res = await apiRequest(`/exams/student/${id}/written-submission`);
      if (res.success && res.data) {
        if (res.data.hasStagedAnswer) {
          setStagedSubmission(res.data);
        }
        if (res.data.status === 'SUBMITTED' || res.data.status === 'AUTO_SUBMITTED' || res.data.status === 'MARKED') {
          setResultData({
            status: res.data.status,
            submittedAt: res.data.submittedAt,
            fileName: res.data.fileName,
          });
        }
      }
    } catch (err) {
      console.warn('Failed to fetch staged written submission:', err);
    }
  };

  // Incremental Autosave for MCQ
  const saveAnswer = async (questionId, selectedOption) => {
    setAnswers((prev) => ({ ...prev, [questionId]: selectedOption }));
    setSaveStatus((prev) => ({ ...prev, [questionId]: 'saving' }));

    try {
      await apiRequest(`/exams/student/${id}/answers/${questionId}`, {
        method: 'PUT',
        body: JSON.stringify({ answer: selectedOption }),
      });
      setSaveStatus((prev) => ({ ...prev, [questionId]: 'saved' }));
    } catch (err) {
      console.error('Failed to save answer:', err);
      setSaveStatus((prev) => ({ ...prev, [questionId]: 'error' }));
    }
  };

  // Submit Exam (MCQ or Timeout)
  const handleSubmitExam = async (isAuto = false) => {
    try {
      setSubmitting(true);
      setError('');
      stopCameraStream();
      const res = await apiRequest(`/exams/student/${id}/submit`, {
        method: 'POST',
      });

      if (res.success) {
        setResultData(res.data || { status: isAuto ? 'AUTO_SUBMITTED' : 'SUBMITTED' });
        setShowSubmitConfirm(false);
      } else {
        setError(res.message || 'Failed to submit exam.');
      }
    } catch (err) {
      setError(err.message || 'Error submitting exam.');
    } finally {
      setSubmitting(false);
    }
  };

  // Timeout Handler from CountdownTimer
  const handleTimeout = async () => {
    setIsTimedOut(true);
    stopCameraStream();
    setCameraModalOpen(false);
    const isWritten = (examData?.exam?.examType || preExamData?.examType) === 'WRITTEN';

    if (isWritten) {
      // For written exam: if staged answer exists, server will auto-finalize
      await fetchStagedWrittenSubmission();
    } else {
      if (!resultData && !submitting) {
        handleSubmitExam(true);
      }
    }
  };

  // -------------------------------------------------------------
  // In-App Camera Stream & Capture Logic (getUserMedia)
  // -------------------------------------------------------------

  const startCameraStream = useCallback(async (mode = 'environment') => {
    stopCameraStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is unavailable in this browser or connection. Please use Gallery instead.');
      return;
    }

    try {
      setCameraStarting(true);
      setCameraError('');

      let stream;
      try {
        // Preferred: Rear camera on mobile, or active camera mode
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch (idealErr) {
        // Fallback: any available video input (e.g. laptop webcam)
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      setCameraStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video play warning:', playErr);
        }
      }
    } catch (err) {
      console.error('Camera stream access failed:', err);
      let msg = 'Failed to access camera. Please choose an image from Gallery.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission was denied. Please allow camera access in your browser settings or choose an image from Gallery.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera was detected on this device. Please choose an image from Gallery.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'The camera is currently being used by another application. Please close it and try again.';
      } else if (err.name === 'OverconstrainedError') {
        msg = 'Camera constraints could not be satisfied. Retrying with basic camera...';
      }
      setCameraError(msg);
    } finally {
      setCameraStarting(false);
    }
  }, [stopCameraStream]);

  // Open In-App Camera Modal
  const openCameraModal = (forPageIndex = null) => {
    if (isTimedOut) return;
    setReplacingPageIndex(forPageIndex);
    if (capturedImagePreview) {
      URL.revokeObjectURL(capturedImagePreview);
    }
    setCapturedImageBlob(null);
    setCapturedImagePreview(null);
    setCameraModalOpen(true);
    setCameraError('');
    // Start camera stream
    setTimeout(() => {
      startCameraStream(cameraFacingMode);
    }, 50);
  };

  // Close Camera Modal
  const closeCameraModal = () => {
    stopCameraStream();
    if (capturedImagePreview) {
      URL.revokeObjectURL(capturedImagePreview);
    }
    setCapturedImageBlob(null);
    setCapturedImagePreview(null);
    setCameraModalOpen(false);
    setReplacingPageIndex(null);
    setCameraError('');
  };

  // Switch Front / Rear Camera
  const switchCamera = () => {
    const nextMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextMode);
    startCameraStream(nextMode);
  };

  // Capture Current Video Frame to Canvas
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || 1920;
    const height = video.videoHeight || 1080;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError('Failed to capture frame from video. Please try again.');
          return;
        }
        const previewUrl = URL.createObjectURL(blob);
        setCapturedImageBlob(blob);
        setCapturedImagePreview(previewUrl);
        // Turn off live camera stream during captured preview review
        stopCameraStream();
      },
      'image/jpeg',
      0.90
    );
  };

  // Retake Photo (Resume live stream)
  const retakePhoto = () => {
    if (capturedImagePreview) {
      URL.revokeObjectURL(capturedImagePreview);
    }
    setCapturedImageBlob(null);
    setCapturedImagePreview(null);
    startCameraStream(cameraFacingMode);
  };

  // Accept Captured Photo and Add/Replace Page
  const acceptCapturedPhoto = () => {
    if (!capturedImageBlob || !capturedImagePreview) return;

    const fileName = `answer_page_${Date.now()}.jpg`;
    const file = new File([capturedImageBlob], fileName, { type: 'image/jpeg' });

    const newPage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: capturedImagePreview, // Retain object URL for thumbnail
      name: fileName,
      size: file.size,
    };

    if (replacingPageIndex !== null && replacingPageIndex >= 0 && replacingPageIndex < writtenPages.length) {
      // Replace single page
      const updated = [...writtenPages];
      const old = updated[replacingPageIndex];
      if (old?.previewUrl && old.previewUrl !== capturedImagePreview) {
        URL.revokeObjectURL(old.previewUrl);
      }
      updated[replacingPageIndex] = newPage;
      setWrittenPages(updated);
      setReplacingPageIndex(null);
    } else {
      // Append page
      setWrittenPages((prev) => {
        const combined = [...prev, newPage];
        if (combined.length > 30) {
          setError('Maximum 30 answer pages allowed per submission.');
          return combined.slice(0, 30);
        }
        return combined;
      });
    }

    // Close modal without revoking previewUrl since it is now owned by writtenPages
    setCapturedImageBlob(null);
    setCapturedImagePreview(null);
    setCameraModalOpen(false);
    stopCameraStream();
  };

  // -------------------------------------------------------------
  // Written Exam Handlers (Camera, Gallery, PDF, Reorder, Delete)
  // -------------------------------------------------------------

  // Handle image selection (Camera or Gallery)
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setError('');
    const newPages = [];

    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'heic' || ext === 'heif' || file.type === 'image/heic') {
        setError('HEIC/HEIF format is not supported. Please capture as JPG/PNG or select a PDF.');
        continue;
      }

      if (!file.type.startsWith('image/')) {
        setError(`File "${file.name}" is not a valid image.`);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      newPages.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl,
        name: file.name,
        size: file.size,
      });
    }

    if (newPages.length > 0) {
      if (replacingPageIndex !== null && replacingPageIndex >= 0 && replacingPageIndex < writtenPages.length) {
        // Replace single page
        const updated = [...writtenPages];
        const old = updated[replacingPageIndex];
        if (old?.previewUrl) URL.revokeObjectURL(old.previewUrl);
        updated[replacingPageIndex] = newPages[0];
        setWrittenPages(updated);
        setReplacingPageIndex(null);
      } else {
        // Append new pages (up to 30 pages max)
        setWrittenPages((prev) => {
          const combined = [...prev, ...newPages];
          if (combined.length > 30) {
            setError('Maximum 30 answer pages allowed per submission.');
            return combined.slice(0, 30);
          }
          return combined;
        });
      }
    }

    // Reset input value
    e.target.value = '';
  };

  // Handle direct PDF upload
  const handlePdfSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Invalid file type. Please select an official PDF document.');
      return;
    }

    // Clear any image pages and stage PDF directly
    writtenPages.forEach((p) => {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    });
    setWrittenPages([]);

    // Immediately upload and stage PDF
    await uploadAnswerFiles([file], file.name);
    e.target.value = '';
  };

  // Move Page Up or Down
  const movePage = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= writtenPages.length) return;

    const updated = [...writtenPages];
    const item = updated[index];
    updated[index] = updated[target];
    updated[target] = item;
    setWrittenPages(updated);
  };

  // Delete Page
  const deletePage = (index) => {
    const target = writtenPages[index];
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    setWrittenPages((prev) => prev.filter((_, i) => i !== index));
  };

  // Trigger Page Replacement
  const triggerReplacePage = (index) => {
    setReplacingPageIndex(index);
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  // Upload/Stage Answer Files (Images or PDF)
  const uploadAnswerFiles = async (filesToUpload = null, customOriginalName = null, isFinal = false) => {
    try {
      setUploadingAnswer(true);
      setError('');
      setUploadMessage(isFinal ? 'Finalizing and submitting written exam...' : 'Assembling and staging answer document...');

      const formData = new FormData();

      if (filesToUpload && filesToUpload.length === 1 && filesToUpload[0].type === 'application/pdf') {
        formData.append('file', filesToUpload[0]);
      } else {
        const pages = filesToUpload || writtenPages.map((p) => p.file);
        if (pages.length === 0) {
          setError('Please take at least one photo or select an answer PDF first.');
          setUploadingAnswer(false);
          return;
        }
        pages.forEach((file) => {
          formData.append('images', file);
        });
      }

      if (isFinal) {
        formData.append('isFinal', 'true');
      }

      const res = await apiRequest(`/exams/student/${id}/upload-answer`, {
        method: 'POST',
        body: formData,
      });

      if (res.success && res.data) {
        setStagedSubmission(res.data);
        setUploadMessage('');

        if (isFinal || res.data.status === 'SUBMITTED') {
          setResultData({
            status: 'SUBMITTED',
            submittedAt: res.data.uploadedAt || new Date().toISOString(),
            fileName: res.data.fileName,
          });
          setShowSubmitConfirm(false);
        } else {
          // Revoke local object URLs once staged successfully
          writtenPages.forEach((p) => {
            if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
          });
          setWrittenPages([]);
        }
      } else {
        setError(res.message || 'Failed to upload answer paper.');
      }
    } catch (err) {
      setError(err.message || 'Error uploading answer document.');
    } finally {
      setUploadingAnswer(false);
      setUploadMessage('');
    }
  };

  // Finalize Staged Submission
  const handleFinalSubmitWrittenExam = async () => {
    try {
      setSubmitting(true);
      setError('');

      const res = await apiRequest(`/exams/student/${id}/written-submission/finalize`, {
        method: 'POST',
      });

      if (res.success && res.data) {
        setResultData({
          status: 'SUBMITTED',
          submittedAt: res.data.submittedAt,
          fileName: res.data.fileName,
        });
        setShowSubmitConfirm(false);
      } else {
        setError(res.message || 'Failed to finalize written exam submission.');
      }
    } catch (err) {
      setError(err.message || 'Error finalizing submission.');
    } finally {
      setSubmitting(false);
    }
  };

  // Remove Staged Submission
  const handleRemoveStagedSubmission = async () => {
    if (!window.confirm('Are you sure you want to remove your staged answer paper? You can upload a new one before the deadline.')) {
      return;
    }

    try {
      setLoading(true);
      const res = await apiRequest(`/exams/student/${id}/written-submission`, {
        method: 'DELETE',
      });
      if (res.success) {
        setStagedSubmission(null);
        if (stagedPdfBlobUrl) {
          revokeProtectedAssetBlobUrl(stagedPdfBlobUrl);
          setStagedPdfBlobUrl(null);
        }
      } else {
        setError(res.message || 'Failed to remove staged submission.');
      }
    } catch (err) {
      setError(err.message || 'Error removing staged submission.');
    } finally {
      setLoading(false);
    }
  };

  // Open Protected Staged PDF Preview
  const handleOpenStagedPdfPreview = async () => {
    try {
      setLoadingStagedPdf(true);
      const studentId = preExamData?.studentId || examData?.studentId || 'std';
      const blobUrl = await fetchProtectedAssetBlobUrl(`/exams/${id}/submissions/${studentId}/answer-pdf`);
      setStagedPdfBlobUrl(blobUrl);
    } catch (err) {
      setError('Unable to load staged answer document for preview.');
    } finally {
      setLoadingStagedPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-[#FFD978] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-300">Loading secure exam session...</p>
      </div>
    );
  }

  if (error && !examData && !preExamData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Exam Unavailable</h3>
          <p className="text-xs text-slate-500 mb-6">{error}</p>
          <button
            onClick={() => navigate('/student')}
            className="w-full py-3 rounded-2xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
          >
            Return to Student Portal
          </button>
        </div>
      </div>
    );
  }

  // Result / Completed View
  if (resultData) {
    const isWritten = (examData?.exam?.examType || preExamData?.examType) === 'WRITTEN';
    const isPassed = resultData.isPassed;
    const isPendingRelease = isWritten || resultData.score === undefined;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-3xl p-8 border border-slate-200/80 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-300">
          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-inner ${
            isPendingRelease ? 'bg-slate-900 text-[#FFD978]' : (isPassed ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200')
          }`}>
            {isPendingRelease ? (
              <CheckCircle2 className="w-8 h-8" />
            ) : isPassed ? (
              <Award className="w-8 h-8" />
            ) : (
              <AlertTriangle className="w-8 h-8" />
            )}
          </div>

          <h2 className="text-2xl font-black text-slate-900 mb-1">
            {isWritten ? 'Written Exam Submitted Successfully' : (isPendingRelease ? 'Exam Completed & Submitted' : (isPassed ? 'Congratulations! Exam Passed' : 'Exam Attempt Completed'))}
          </h2>

          <p className="text-xs text-slate-500 mb-6">
            {examData?.exam?.title || preExamData?.title} • {examData?.exam?.subject?.name || preExamData?.subject?.name || 'Subject'}
          </p>

          {isWritten ? (
            <div className="bg-emerald-50/80 p-5 rounded-2xl border border-emerald-200 text-xs text-emerald-900 mb-6 space-y-2 text-left">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-950">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Your answer document has been recorded.</span>
              </div>
              <p className="text-emerald-800 text-[11px] leading-relaxed">
                Your submitted answer paper is safely stored and queued for faculty evaluation in the Marking Hub. Official marks will appear in your portal once evaluated and released.
              </p>
              {resultData.submittedAt && (
                <p className="text-[10px] text-emerald-700 font-mono pt-1">
                  Submitted At: {new Date(resultData.submittedAt).toLocaleString()}
                </p>
              )}
            </div>
          ) : !isPendingRelease ? (
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/80 mb-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <span className="text-xs font-semibold text-slate-500">Your Score</span>
                <span className="text-xl font-black text-slate-900">
                  {resultData.score} / {resultData.totalMarks}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <span className="text-xs font-semibold text-slate-500">Percentage</span>
                <span className="text-base font-black text-slate-800">
                  {resultData.percentage}%
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <span className="text-xs font-semibold text-slate-500">Passing Requirement</span>
                <span className="text-xs font-bold text-slate-700">
                  {resultData.passingMarks} {resultData.passMarkType === 'PERCENTAGE' ? '%' : 'Marks'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-slate-500">Official Result</span>
                <span className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                  isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {isPassed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50/60 p-5 rounded-2xl border border-amber-200/60 text-xs text-amber-900 mb-6">
              <p className="font-semibold">Results will be released after evaluation by your instructor.</p>
              <p className="text-[11px] text-amber-700 mt-1">Status: {resultData.status}</p>
            </div>
          )}

          <button
            onClick={() => navigate('/student')}
            className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4 text-[#FFD978]" />
            <span>Return to Student Portal</span>
          </button>
        </div>
      </div>
    );
  }

  // Pre-Attempt Instructions Screen
  if (!examStarted && preExamData) {
    const isWritten = preExamData.examType === 'WRITTEN';

    return (
      <div className="min-h-screen bg-slate-50/80 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl w-full mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden">
          {/* Header Banner */}
          <div className="bg-slate-900 px-6 sm:px-8 py-6 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFD978] text-slate-950 flex items-center justify-center font-bold text-base shadow-xs">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#FFD978]">
                  {isWritten ? 'Written Examination Instructions' : 'Online Examination Instructions'}
                </span>
                <h2 className="text-base sm:text-lg font-black text-white">{preExamData.title}</h2>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-800 text-[#FFD978] border border-slate-700">
              {preExamData.durationMinutes} Minutes
            </span>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Exam Quick Specs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                <p className="text-[10px] uppercase font-bold text-slate-400">Subject</p>
                <p className="text-xs font-bold text-slate-900 truncate">{preExamData.subject?.name || 'Subject'}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                <p className="text-[10px] uppercase font-bold text-slate-400">Class / Batch</p>
                <p className="text-xs font-bold text-slate-900 truncate">
                  {preExamData.class?.name} {preExamData.class?.section || ''}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                <p className="text-[10px] uppercase font-bold text-slate-400">Exam Type</p>
                <p className="text-xs font-bold text-slate-900">
                  {isWritten ? 'WRITTEN (Upload)' : 'MCQ (Live)'}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                <p className="text-[10px] uppercase font-bold text-slate-400">Total Marks</p>
                <p className="text-xs font-bold text-slate-900">{preExamData.totalMarks} Marks</p>
              </div>
            </div>

            {/* Instructions Content */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Assessment Instructions & Guidelines
              </h4>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed space-y-2 whitespace-pre-line font-medium">
                {preExamData.instructions || (
                  isWritten
                    ? '1. Write your answers clearly on physical answer sheets.\n2. When finished, take photos of each page with your camera, choose from gallery, or upload a PDF.\n3. Verify all pages are readable and in correct order.\n4. Click Final Submit before the countdown timer reaches 00:00:00.'
                    : '1. Choose the best answer for each question.\n2. Answers are saved automatically in real-time.\n3. The timer runs continuously on the server.\n4. You must submit before the countdown timer reaches 00:00:00.'
                )}
              </div>
            </div>

            {/* Critical Server-Timing Warning */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 space-y-1">
                <p className="font-bold">Important Notice:</p>
                <p className="leading-relaxed">
                  Once you start the examination, the timer will continue running on the server even if you refresh or close your browser window. You can resume your session and replace your staged answer at any time before the deadline.
                </p>
              </div>
            </div>

            {/* Acknowledgment Checkbox */}
            <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={instructionsRead}
                onChange={(e) => setInstructionsRead(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-slate-900 rounded focus:ring-slate-900"
              />
              <span className="text-xs font-bold text-slate-800">
                I have read and understood all examination rules and instructions.
              </span>
            </label>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/student')}
                className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
              >
                Back to Dashboard
              </button>
              <button
                type="button"
                disabled={!instructionsRead || loading}
                onClick={startOrResumeExam}
                className="flex-1 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-[#FFD978]" />
                <span>Start Written Examination</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isWrittenExam = (examData?.exam?.examType || preExamData?.examType) === 'WRITTEN';

  // -------------------------------------------------------------
  // WRITTEN EXAM WORKSPACE RENDER
  // -------------------------------------------------------------
  if (isWrittenExam) {
    return (
      <div className="min-h-screen bg-slate-100/70 flex flex-col">
        {/* Network Disconnection Banner */}
        {!isOnline && (
          <div className="bg-rose-600 text-white px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 sticky top-0 z-50 animate-pulse">
            <WifiOff className="w-4 h-4" />
            <span>Connection lost. The exam timer is still running on the server. Reconnecting...</span>
          </div>
        )}

        {/* Sticky Top Header */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs px-4 sm:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-[#FFD978] flex items-center justify-center font-bold text-xs shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                {examData?.exam?.title}
              </h1>
              <p className="text-[10px] text-slate-400 font-medium truncate">
                Written Examination • {examData?.exam?.subject?.name || 'Subject'}
              </p>
            </div>
          </div>

          {/* Server Authoritative Timer */}
          <div className="flex items-center gap-3">
            <CountdownTimer
              serverDeadline={examData?.serverDeadline}
              remainingSeconds={examData?.remainingSeconds}
              onTimeout={handleTimeout}
            />
            {stagedSubmission?.hasStagedAnswer && !isTimedOut && (
              <button
                onClick={() => setShowSubmitConfirm(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Final Submit</span>
              </button>
            )}
          </div>
        </header>

        {/* Hidden Multi-Page File Inputs (Gallery & PDF only) */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleImageSelect}
          className="hidden"
        />
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          onChange={handlePdfSelect}
          className="hidden"
        />

        {/* Main Written Workspace Container */}
        <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError('')} className="p-1 hover:bg-rose-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Timeout Alert Banner */}
          {isTimedOut && (
            <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-sm">Examination Time Has Expired</p>
                <p className="text-amber-800 mt-0.5">
                  Answer upload and modification actions are now disabled. Any staged answer has been automatically finalized.
                </p>
              </div>
            </div>
          )}

          {/* SECTION 1: Question Paper / Instructions */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs">
                  Question Paper & Instructions
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Total Marks: <strong>{examData?.exam?.totalMarks}</strong>
                </span>
              </div>
            </div>

            {examData?.exam?.instructions && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed whitespace-pre-line font-medium">
                {examData.exam.instructions}
              </div>
            )}

            {questions.length > 0 && (
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Written Assessment Questions ({questions.length})
                </h4>
                <div className="space-y-3">
                  {questions.map((q, idx) => (
                    <div key={q.id || idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">
                          Question {idx + 1}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed font-medium">
                        {q.question}
                      </p>
                      {q.image && (
                        <div className="max-w-sm rounded-xl overflow-hidden border border-slate-200 mt-2">
                          <img src={q.image} alt="Question figure" className="w-full h-auto object-contain" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: Staged Answer Paper Status (If uploaded) */}
          {stagedSubmission?.hasStagedAnswer && (
            <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200/80 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900">
                      Answer Document Staged & Ready
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">{stagedSubmission.fileName}</h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenStagedPdfPreview}
                    disabled={loadingStagedPdf}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-950 font-bold text-xs shadow-2xs hover:bg-emerald-100/50 transition"
                  >
                    {loadingStagedPdf ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-emerald-700" />
                    )}
                    <span>Preview Staged PDF</span>
                  </button>

                  {!isTimedOut && (
                    <button
                      onClick={handleRemoveStagedSubmission}
                      className="p-2 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition"
                      title="Remove staged answer to upload new one"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <div className="flex items-center gap-4">
                  {stagedSubmission.fileSize && (
                    <span>Size: <strong>{Math.round(stagedSubmission.fileSize / 1024)} KB</strong></span>
                  )}
                  {stagedSubmission.uploadedAt && (
                    <span>Staged at: <strong>{new Date(stagedSubmission.uploadedAt).toLocaleTimeString()}</strong></span>
                  )}
                </div>

                {!isTimedOut && (
                  <button
                    onClick={() => setShowSubmitConfirm(true)}
                    className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition flex items-center gap-2"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Hand In & Final Submit</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* SECTION 3: Answer Upload & Multi-Page Workspace */}
          {!isTimedOut && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {stagedSubmission?.hasStagedAnswer ? 'Replace Your Answer Paper' : 'Upload Your Answer Paper'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Capture photos with your device camera, pick multiple pages from your gallery, or choose a prepared PDF document.
                </p>
              </div>

              {/* Three Obvious Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => openCameraModal(null)}
                  className="p-5 rounded-2xl border-2 border-slate-200 hover:border-slate-900 hover:bg-slate-50 transition-all flex flex-col items-center justify-center text-center gap-2 group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 group-hover:bg-[#FFD978] text-slate-900 flex items-center justify-center transition-colors">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">📷 Take Photo</span>
                    <span className="text-[10px] text-slate-400">Live Camera / Webcam</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setReplacingPageIndex(null);
                    galleryInputRef.current?.click();
                  }}
                  className="p-5 rounded-2xl border-2 border-slate-200 hover:border-slate-900 hover:bg-slate-50 transition-all flex flex-col items-center justify-center text-center gap-2 group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 text-blue-900 flex items-center justify-center transition-colors">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">🖼 Choose from Gallery</span>
                    <span className="text-[10px] text-slate-400">Select multiple images</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="p-5 rounded-2xl border-2 border-slate-200 hover:border-slate-900 hover:bg-slate-50 transition-all flex flex-col items-center justify-center text-center gap-2 group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 group-hover:bg-emerald-100 text-emerald-900 flex items-center justify-center transition-colors">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">📄 Choose PDF File</span>
                    <span className="text-[10px] text-slate-400">Single compiled PDF</span>
                  </div>
                </button>
              </div>

              {/* Multi-Page Answer Grid */}
              {writtenPages.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                        Answer Pages Ordered ({writtenPages.length} {writtenPages.length === 1 ? 'Page' : 'Pages'})
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Review handwriting readability and arrange pages in correct order using the controls.
                      </p>
                    </div>

                    <button
                      onClick={() => openCameraModal(null)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-2xs transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#FFD978]" />
                      <span>Take Another Photo</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {writtenPages.map((page, idx) => (
                      <div
                        key={page.id}
                        className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between shadow-2xs group relative"
                      >
                        {/* Page Header Tag */}
                        <div className="p-2 bg-slate-900 text-white flex items-center justify-between text-[11px]">
                          <span className="font-mono font-bold text-[#FFD978]">Page {idx + 1}</span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[80px]">
                            {Math.round(page.size / 1024)} KB
                          </span>
                        </div>

                        {/* Thumbnail Image with Lightbox Trigger */}
                        <div
                          onClick={() => setPreviewModalPage({ ...page, index: idx })}
                          className="h-44 bg-slate-200 relative overflow-hidden cursor-pointer flex items-center justify-center group-hover:opacity-95 transition"
                        >
                          <img
                            src={page.previewUrl}
                            alt={`Page ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-900/80 text-white font-bold text-[10px] flex items-center gap-1">
                              <Eye className="w-3 h-3 text-[#FFD978]" /> Zoom
                            </span>
                          </div>
                        </div>

                        {/* Page Controls (Reorder, Replace, Delete) */}
                        <div className="p-2 bg-white border-t border-slate-200 flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1">
                            <button
                              disabled={idx === 0}
                              onClick={() => movePage(idx, -1)}
                              className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-700"
                              title="Move Page Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              disabled={idx === writtenPages.length - 1}
                              onClick={() => movePage(idx, 1)}
                              className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-700"
                              title="Move Page Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openCameraModal(idx)}
                              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 text-[10px] font-bold"
                              title="Replace this page with camera"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deletePage(idx)}
                              className="p-1 rounded-lg hover:bg-rose-50 text-rose-600"
                              title="Delete this page"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Stage & Compile Action Button */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">
                      Total: <strong>{writtenPages.length} Pages</strong> ready to compile into one answer document.
                    </span>

                    <button
                      type="button"
                      disabled={uploadingAnswer}
                      onClick={() => uploadAnswerFiles()}
                      className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {uploadingAnswer ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-[#FFD978]" />
                          <span>{uploadMessage || 'Assembling Answer PDF...'}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-[#FFD978]" />
                          <span>Stage & Save Answer Document</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Real In-App Camera Capture Modal */}
        {cameraModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-4">
            <div className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#FFD978] text-slate-950 flex items-center justify-center font-bold">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs sm:text-sm text-white">
                      {replacingPageIndex !== null
                        ? `Retake / Replace Page ${replacingPageIndex + 1}`
                        : `Capture Answer Sheet — Page ${writtenPages.length + 1}`}
                    </h3>
                    <p className="text-[10px] text-slate-400">Position your physical paper clearly within frame</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeCameraModal}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                  title="Close Camera"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Camera Error Message */}
              {cameraError && (
                <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p>{cameraError}</p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startCameraStream(cameraFacingMode)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-bold"
                      >
                        Try Again
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          closeCameraModal();
                          galleryInputRef.current?.click();
                        }}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-[11px] font-bold"
                      >
                        Choose from Gallery Instead
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Video Viewport / Capture Preview */}
              <div className="relative bg-slate-950 aspect-[4/3] sm:aspect-[16/10] w-full flex items-center justify-center overflow-hidden">
                {/* Hidden Canvas for Frame Capture */}
                <canvas ref={canvasRef} className="hidden" />

                {capturedImagePreview ? (
                  /* Captured Photo Preview (Awaiting confirmation) */
                  <div className="w-full h-full relative flex items-center justify-center bg-slate-900">
                    <img
                      src={capturedImagePreview}
                      alt="Captured Answer Sheet"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-[#FFD978] px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>Photo Captured — Ready for Review</span>
                    </div>
                  </div>
                ) : (
                  /* Live Stream Feed */
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {cameraStarting && (
                      <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-white gap-2 z-10">
                        <RefreshCw className="w-6 h-6 animate-spin text-[#FFD978]" />
                        <span className="text-xs font-bold">Initializing camera stream...</span>
                      </div>
                    )}

                    {/* Camera Switch button (if stream is live) */}
                    {!cameraStarting && !cameraError && (
                      <button
                        type="button"
                        onClick={switchCamera}
                        className="absolute top-3 right-3 p-2.5 rounded-2xl bg-slate-900/70 hover:bg-slate-900 text-white backdrop-blur-md transition shadow-md flex items-center gap-1.5 text-xs font-bold cursor-pointer z-10"
                        title="Switch Camera (Front / Rear)"
                      >
                        <RefreshCw className="w-4 h-4 text-[#FFD978]" />
                        <span className="hidden sm:inline">Flip Camera</span>
                      </button>
                    )}

                    {/* Document alignment overlay hint */}
                    {!cameraStarting && !cameraError && (
                      <div className="absolute inset-6 sm:inset-10 border-2 border-white/40 rounded-2xl pointer-events-none flex items-center justify-center">
                        <span className="text-[11px] font-bold text-white/80 bg-black/50 px-3 py-1 rounded-full backdrop-blur-xs">
                          Align full answer sheet inside frame
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Actions Footer */}
              <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                {capturedImagePreview ? (
                  /* Post-Capture Actions */
                  <>
                    <button
                      type="button"
                      onClick={retakePhoto}
                      className="px-5 py-3 rounded-2xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition flex items-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4 text-slate-500" />
                      <span>Retake Photo</span>
                    </button>

                    <button
                      type="button"
                      onClick={acceptCapturedPhoto}
                      className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Use This Photo</span>
                    </button>
                  </>
                ) : (
                  /* Live Stream Actions */
                  <>
                    <button
                      type="button"
                      onClick={closeCameraModal}
                      className="px-5 py-3 rounded-2xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      disabled={cameraStarting || Boolean(cameraError)}
                      onClick={capturePhoto}
                      className="px-7 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-lg transition flex items-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed group cursor-pointer"
                    >
                      <div className="w-3.5 h-3.5 rounded-full bg-[#FFD978] group-hover:scale-110 transition-transform" />
                      <span>Capture Photo</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Large Page Lightbox Modal */}
        {previewModalPage && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between text-white">
                <span className="font-bold text-xs text-[#FFD978]">
                  Enlarged Preview — Page {previewModalPage.index + 1}
                </span>
                <button
                  onClick={() => setPreviewModalPage(null)}
                  className="p-1 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950">
                <img
                  src={previewModalPage.previewUrl}
                  alt={`Page ${previewModalPage.index + 1}`}
                  className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl"
                />
              </div>
            </div>
          </div>
        )}

        {/* Staged Answer Protected PDF Viewer Modal */}
        {stagedPdfBlobUrl && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-4xl h-[85vh] bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 flex flex-col">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#FFD978]" />
                  <span className="font-bold text-xs text-white">
                    Staged Answer PDF Preview
                  </span>
                </div>
                <button
                  onClick={() => {
                    revokeProtectedAssetBlobUrl(stagedPdfBlobUrl);
                    setStagedPdfBlobUrl(null);
                  }}
                  className="p-1 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 bg-slate-950">
                <iframe
                  src={stagedPdfBlobUrl}
                  title="Staged PDF Viewer"
                  className="w-full h-full border-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Final Submission Confirmation Modal */}
        {showSubmitConfirm && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <h3 className="text-lg font-black text-slate-900 mb-2">
                Submit Written Live Exam?
              </h3>

              <div className="text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6 space-y-2 text-left">
                <p><strong>Document:</strong> {stagedSubmission?.fileName || 'Answer Paper'}</p>
                <p className="text-amber-800 font-bold">
                  ⚠️ After final submission, your answer paper will be permanently locked and cannot be replaced or edited.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
                >
                  Continue Reviewing
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleFinalSubmitWrittenExam}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Submit Final</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // MCQ EXAM WORKSPACE RENDER (PRESERVED STEP 2)
  // -------------------------------------------------------------
  const currentQ = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col">
      {/* Network Disconnection Banner */}
      {!isOnline && (
        <div className="bg-rose-600 text-white px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 sticky top-0 z-50 animate-pulse">
          <WifiOff className="w-4 h-4" />
          <span>Connection lost. Your saved answers remain safe locally. Reconnecting...</span>
        </div>
      )}

      {/* Sticky Top Assessment Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-[#FFD978] flex items-center justify-center font-bold text-xs shrink-0">
            {examData?.exam?.institute?.logo ? (
              <img src={examData.exam.institute.logo} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              (examData?.exam?.institute?.name?.slice(0, 2) || 'EX').toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-black text-slate-900 truncate">
              {examData?.exam?.title}
            </h1>
            <p className="text-[10px] text-slate-400 font-medium truncate">
              {examData?.exam?.institute?.name} • Multi-Tenant Online Exam System
            </p>
          </div>
        </div>

        {/* Server Authoritative Timer */}
        <div className="flex items-center gap-3">
          <CountdownTimer
            serverDeadline={examData?.serverDeadline}
            remainingSeconds={examData?.remainingSeconds}
            onTimeout={handleTimeout}
          />
          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Finish Exam</span>
          </button>
        </div>
      </header>

      {/* Main Exam Workspace */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left / Center Column: Active Question */}
        <div className="lg:col-span-3 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {currentQ ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
              {/* Question Header & Meta */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs">
                    Question {currentIndex + 1} of {totalQuestions}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-semibold text-[11px]">
                    {currentQ.marks} {currentQ.marks === 1 ? 'Mark' : 'Marks'}
                  </span>
                </div>

                {/* Save status badge */}
                <div className="text-[11px] font-semibold flex items-center gap-1.5">
                  {saveStatus[currentQ.id] === 'saving' && (
                    <span className="text-amber-600 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3 animate-spin" /> Saving...
                    </span>
                  )}
                  {saveStatus[currentQ.id] === 'saved' && (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Answer saved
                    </span>
                  )}
                  {saveStatus[currentQ.id] === 'error' && (
                    <span className="text-rose-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Save failed! Retrying...
                    </span>
                  )}
                </div>
              </div>

              {/* Question Text */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed select-none">
                  {currentQ.question}
                </h3>
                {currentQ.image && (
                  <div className="max-w-md rounded-2xl overflow-hidden border border-slate-200">
                    <img src={currentQ.image} alt="Question diagram" className="w-full h-auto object-contain" />
                  </div>
                )}
              </div>

              {/* MCQ Options with Radio Semantics & Large Tap Targets */}
              <div className="space-y-3 pt-2" role="radiogroup" aria-label={`Question ${currentIndex + 1} options`}>
                {(currentQ.options || []).map((opt, idx) => {
                  const optId = typeof opt === 'object' ? (opt.id || opt.key || opt.text) : opt;
                  const optText = typeof opt === 'object' ? opt.text : opt;
                  const isSelected = String(answers[currentQ.id]) === String(optId);

                  return (
                    <label
                      key={idx}
                      onClick={() => saveAnswer(currentQ.id, optId)}
                      className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 transition-all cursor-pointer select-none ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900/5 shadow-xs'
                          : 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQ.id}`}
                        value={optId}
                        checked={isSelected}
                        onChange={() => saveAnswer(currentQ.id, optId)}
                        className="mt-1 w-4 h-4 text-slate-900 focus:ring-slate-900"
                      />
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-bold mr-2 ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                          {String.fromCharCode(65 + idx)}.
                        </span>
                        <span className={`text-sm font-medium ${isSelected ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>
                          {optText}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Navigation Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                <button
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPaletteOpen(!paletteOpen)}
                    className="lg:hidden px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                  >
                    Question Grid ({answeredCount}/{totalQuestions})
                  </button>

                  {currentIndex < totalQuestions - 1 ? (
                    <button
                      onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4 text-[#FFD978]" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowSubmitConfirm(true)}
                      className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Finish & Submit</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <p className="text-xs text-slate-400">No questions found in this assessment.</p>
            </div>
          )}
        </div>

        {/* Right Column: Question Palette Navigation */}
        <div className={`lg:col-span-1 ${paletteOpen ? 'block' : 'hidden lg:block'}`}>
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-5 sticky top-20">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Question Palette
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                Answered: <span className="font-bold text-emerald-600">{answeredCount}</span> of {totalQuestions}
              </p>
            </div>

            {/* Questions Grid */}
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '';
                const isCurrent = currentIndex === idx;

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setPaletteOpen(false);
                    }}
                    className={`h-10 rounded-xl font-bold text-xs transition-all flex flex-col items-center justify-center relative ${
                      isCurrent
                        ? 'bg-slate-900 text-[#FFD978] ring-2 ring-slate-900 ring-offset-2'
                        : isAnswered
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {isAnswered && !isCurrent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="border-t border-slate-100 pt-4 space-y-2 text-[10px] font-semibold text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-slate-900 text-[#FFD978] text-[8px] flex items-center justify-center font-bold">●</span>
                <span>Current Question</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 text-[8px] font-bold">✓</span>
                <span>Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-slate-100 border border-slate-200" />
                <span>Unanswered ({unansweredCount})</span>
              </div>
            </div>

            {/* Mobile Submit Button */}
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 mt-4"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Entire Exam</span>
            </button>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
              unansweredCount > 0 ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
            }`}>
              {unansweredCount > 0 ? <AlertTriangle className="w-7 h-7" /> : <CheckCircle2 className="w-7 h-7" />}
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Ready to submit your exam?
            </h3>

            {unansweredCount > 0 ? (
              <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200 mb-6">
                You still have <strong>{unansweredCount} unanswered</strong> {unansweredCount === 1 ? 'question' : 'questions'}. Are you sure you want to submit?
              </p>
            ) : (
              <p className="text-xs text-slate-500 mb-6">
                All {totalQuestions} questions answered. Once submitted, your answers will be finalized and graded.
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
              >
                Review Answers
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmitExam(false)}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Yes, Submit</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
