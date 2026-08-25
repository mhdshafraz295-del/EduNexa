const API_BASE = '/api';

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('edunexa_token');
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({ success: false, message: 'Invalid response from server' }));

  if (!response.ok) {
    // If institute is inactive, flag specifically
    if (response.status === 403 && data.isInstituteInactive) {
      const error = new Error(data.message || 'Institute is inactive.');
      error.isInstituteInactive = true;
      error.status = 403;
      throw error;
    }
    const error = new Error(data.message || 'API request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Fetch a protected binary asset (e.g. Signature or Stamp) with Bearer token authentication
 * and return a temporary browser Object URL.
 * 
 * @param {string} endpoint - e.g. '/portal/branding-assets/signature' or full relative path
 * @returns {Promise<string>} - Object URL (blob:...)
 */
export async function fetchProtectedAssetBlobUrl(endpoint) {
  const token = localStorage.getItem('edunexa_token');
  const cleanEndpoint = endpoint.startsWith('/api') ? endpoint.slice(4) : endpoint;

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${API_BASE}${cleanEndpoint}`, {
    method: 'GET',
    headers,
  });

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok || contentType.includes('application/json') || contentType.includes('text/html')) {
    let errMsg = `Protected asset fetch failed with status ${response.status}`;
    if (contentType.includes('application/json')) {
      try {
        const json = await response.json();
        errMsg = json.message || errMsg;
      } catch {
        // ignore json parse error
      }
    }
    throw new Error(errMsg);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/**
 * Safely revoke an Object URL to prevent memory leaks
 * 
 * @param {string|null} url 
 */
export function revokeProtectedAssetBlobUrl(url) {
  if (url && typeof url === 'string' && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Failed to revoke object URL:', e);
    }
  }
}

/**
 * Fetches a protected file with Bearer authentication and opens it in a new browser tab as a Blob.
 * Validates Content-Type, handles errors gracefully without creating fake blobs from JSON errors,
 * and schedules blob cleanup after tab loading.
 * 
 * @param {string} endpoint - e.g. `/subscription/payments/${paymentId}/receipt`
 * @returns {Promise<void>}
 */
export async function openAuthenticatedFileInNewWindow(endpoint) {
  const token = localStorage.getItem('edunexa_token');
  const cleanEndpoint = endpoint.startsWith('/api') ? endpoint.slice(4) : endpoint;

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${API_BASE}${cleanEndpoint}`, {
    method: 'GET',
    headers,
  });

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok || contentType.includes('application/json')) {
    let errMsg = 'Failed to load file.';
    if (response.status === 401) {
      errMsg = 'Your session has expired. Please log in again.';
    } else if (response.status === 403) {
      errMsg = 'Access denied. You do not have permission to view this receipt.';
    } else if (response.status === 404) {
      errMsg = 'Receipt file could not be found.';
    } else {
      try {
        const json = await response.json();
        errMsg = json.message || errMsg;
      } catch {
        // ignore
      }
    }
    const error = new Error(errMsg);
    error.status = response.status;
    throw error;
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  const newWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');
  if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
    // Popup was blocked by browser, trigger fallback anchor
    const link = document.createElement('a');
    link.href = blobUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Revoke blob URL after sufficient time for new window to load (60 seconds)
  setTimeout(() => {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch {
      // ignore
    }
  }, 60000);
}

/**
 * Fetch short-lived stream ticket for native video/media playback
 * 
 * @param {number|string} mediaId 
 * @returns {Promise<string>} - Stream ticket string
 */
export async function getGalleryStreamTicket(mediaId) {
  const res = await apiRequest(`/gallery/media/${mediaId}/stream-ticket`, {
    method: 'POST',
  });
  return res.ticket;
}

/**
 * Fetch a protected gallery image/thumbnail with Bearer authentication and return Object URL
 * 
 * @param {number|string} mediaId 
 * @returns {Promise<string>} - Blob URL
 */
export async function fetchGalleryMediaBlobUrl(mediaId) {
  return await fetchProtectedAssetBlobUrl(`/gallery/media/${mediaId}/stream`);
}

/**
 * Safely download an authenticated binary/text file (PDF, CSV, ID Card, Report Card, etc.)
 * using the stored Bearer token without opening raw JSON windows.
 * 
 * @param {string} endpoint - e.g. '/exam-groups/1/class-pdf' or '/exams/1/results/2/pdf'
 * @param {string} [defaultFilename] - Fallback filename if Content-Disposition header is missing
 * @returns {Promise<{ success: boolean, filename: string }>}
 */
export async function downloadAuthenticatedFile(endpoint, defaultFilename = 'download') {
  const token = localStorage.getItem('edunexa_token');
  const cleanEndpoint = endpoint.startsWith('/api') ? endpoint.slice(4) : endpoint;

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${API_BASE}${cleanEndpoint}`, {
    method: 'GET',
    headers,
  });

  const contentType = response.headers.get('content-type') || '';

  // If response is NOT ok, or if server returned JSON/HTML instead of file stream
  if (!response.ok || contentType.includes('application/json') || contentType.includes('text/html')) {
    let errorMessage = `Download failed with status ${response.status}`;
    try {
      if (contentType.includes('application/json')) {
        const errJson = await response.json();
        errorMessage = errJson.message || errJson.error || errorMessage;
      } else {
        const errText = await response.text();
        if (errText && errText.length < 300) {
          errorMessage = errText;
        }
      }
    } catch {
      // ignore parse errors
    }
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }

  // Extract filename from Content-Disposition header if present
  let filename = defaultFilename;
  const disposition = response.headers.get('content-disposition');
  if (disposition) {
    // 1. Try filename*=UTF-8''encoded_name
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match && utf8Match[1]) {
      try {
        filename = decodeURIComponent(utf8Match[1].trim());
      } catch {
        filename = utf8Match[1].trim();
      }
    } else {
      // 2. Try standard filename="..." or filename=...
      const match = disposition.match(/filename="?([^";]+)"?/i);
      if (match && match[1]) {
        filename = match[1].trim();
      }
    }
  }

  // Sanitize filename to prevent path traversal or invalid characters
  filename = filename.replace(/[<>:"/\\|?*]/g, '_').trim() || defaultFilename;

  // Convert response to Blob
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  // Trigger browser download via temporary anchor
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoke object URL after slight delay to ensure browser handled download
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 1500);

  return { success: true, filename };
}

/**
 * Fetch a protected study material PDF with Bearer authentication and return Object URL
 */
export async function fetchStudyMaterialPdfBlobUrl(materialId, isAdmin = false) {
  const endpoint = isAdmin
    ? `/study-materials/admin/${materialId}/content`
    : `/study-materials/${materialId}/content`;
  return await fetchProtectedAssetBlobUrl(endpoint);
}

/**
 * Fetch a protected note purchase receipt image/PDF with Bearer authentication and return Object URL
 */
export async function fetchPurchaseReceiptBlobUrl(purchaseId) {
  return await fetchProtectedAssetBlobUrl(`/study-materials/payments/${purchaseId}/receipt`);
}

/**
 * Safely download a protected study material PDF with custom filename
 */
export async function downloadStudyMaterialPdf(materialId, filename = 'study_note.pdf', isAdmin = false) {
  const endpoint = isAdmin
    ? `/study-materials/admin/${materialId}/content?download=true`
    : `/study-materials/${materialId}/content?download=true`;
  return await downloadAuthenticatedFile(endpoint, filename);
}

// ==========================================
// POLL & VOTING SYSTEM API HELPERS
// ==========================================
export async function fetchAdminPolls(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.audienceType) query.set('audienceType', params.audienceType);
  if (params.classId) query.set('classId', params.classId);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  return await apiRequest(`/polls/admin?${query.toString()}`);
}

export async function fetchAdminPollById(id) {
  return await apiRequest(`/polls/admin/${id}`);
}

export async function createAdminPoll(data) {
  return await apiRequest('/polls/admin', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAdminPoll(id, data) {
  return await apiRequest(`/polls/admin/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function updateAdminPollStatus(id, status) {
  return await apiRequest(`/polls/admin/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteAdminPoll(id) {
  return await apiRequest(`/polls/admin/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchAdminPollOverview() {
  return await apiRequest('/polls/admin/analytics/overview');
}

export async function fetchRecipientPolls(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  return await apiRequest(`/polls/my?${query.toString()}`);
}

export async function fetchRecipientPollDetails(id) {
  return await apiRequest(`/polls/${id}`);
}

export async function submitRecipientVote(id, optionId) {
  return await apiRequest(`/polls/${id}/vote`, {
    method: 'POST',
    body: JSON.stringify({ optionId }),
  });
}

export const api = {
  get: (url, opts) => apiRequest(url, { method: 'GET', ...opts }).then((data) => ({ data })),
  post: (url, body, opts) =>
    apiRequest(url, {
      method: 'POST',
      body: typeof FormData !== 'undefined' && body instanceof FormData ? body : JSON.stringify(body),
      ...opts,
    }).then((data) => ({ data })),
  put: (url, body, opts) =>
    apiRequest(url, {
      method: 'PUT',
      body: typeof FormData !== 'undefined' && body instanceof FormData ? body : JSON.stringify(body),
      ...opts,
    }).then((data) => ({ data })),
  patch: (url, body, opts) =>
    apiRequest(url, {
      method: 'PATCH',
      body: body ? (typeof FormData !== 'undefined' && body instanceof FormData ? body : JSON.stringify(body)) : undefined,
      ...opts,
    }).then((data) => ({ data })),
  delete: (url, opts) => apiRequest(url, { method: 'DELETE', ...opts }).then((data) => ({ data })),
  defaults: { baseURL: '/api' },
};

export default apiRequest;
