import { ref } from 'vue';
import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch } from '@/config/apiBase';
import { resolveAssetDownloadUrl } from '@/modules/template/composables/useCompanyLogoAsset';
import { useAuthStore } from '@/stores/authRegistry';

export function useDocuments() {
  const documents = ref([]);
  const summary = ref(null);
  const recentDocuments = ref([]);
  const recentActivity = ref([]);
  const folders = ref([]);
  const favoriteDocumentIds = ref(new Set());
  const favoriteCount = ref(0);
  const recentCount = ref(0);
  const sharedCount = ref(0);
  const loading = ref(false);
  const summaryLoading = ref(false);
  const uploading = ref(false);
  const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 1 });

  async function fetchDocuments({
    page = 1,
    limit = 20,
    search = '',
    filterQuery = '',
    status = '',
    documentType = '',
    folderId = '',
    fileType = '',
    assignedTo = '',
    tag = '',
    linkedModuleKey = '',
    linkedRecordId = '',
    linkedAppKey = '',
    favoritesOnly = false,
    recentOnly = false,
    sharedWithMe = false,
    expiringOnly = false,
    relatedToDocumentId = ''
  } = {}) {
    loading.value = true;
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (filterQuery) params.set('filterQuery', filterQuery);
      if (status) params.set('status', status);
      if (documentType) params.set('documentType', documentType);
      if (folderId) params.set('folderId', folderId);
      if (fileType) params.set('fileType', fileType);
      if (assignedTo) params.set('assignedTo', assignedTo);
      if (tag) params.set('tag', tag);
      if (linkedModuleKey) params.set('linkedModuleKey', linkedModuleKey);
      if (linkedRecordId) params.set('linkedRecordId', linkedRecordId);
      if (linkedAppKey) params.set('linkedAppKey', linkedAppKey);
      if (relatedToDocumentId) params.set('relatedToDocumentId', relatedToDocumentId);
      if (favoritesOnly) params.set('favoritesOnly', '1');
      if (recentOnly) params.set('recentOnly', '1');
      if (sharedWithMe) params.set('sharedWithMe', '1');
      if (expiringOnly) params.set('expiringOnly', '1');

      const response = await apiClient.get(`/documents?${params.toString()}`);
      if (response.success) {
        documents.value = response.data || [];
        pagination.value = response.pagination || pagination.value;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchKnowledgeBase({
    page = 1,
    limit = 20,
    search = '',
    status = '',
    documentType = '',
    folderId = '',
    tag = ''
  } = {}) {
    loading.value = true;
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (documentType) params.set('documentType', documentType);
      if (folderId) params.set('folderId', folderId);
      if (tag) params.set('tag', tag);

      const response = await apiClient.get(`/documents/knowledge-base?${params.toString()}`);
      if (response.success) {
        documents.value = response.data || [];
        pagination.value = response.pagination || pagination.value;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchSummary() {
    summaryLoading.value = true;
    try {
      const response = await apiClient.get('/documents/summary');
      if (response.success) {
        summary.value = response.data?.summary || null;
        recentDocuments.value = response.data?.recentDocuments || [];
        recentActivity.value = response.data?.recentActivity || [];
        folders.value = response.data?.folders || [];
        favoriteDocumentIds.value = new Set((response.data?.favoriteDocumentIds || []).map(String));
        favoriteCount.value = response.data?.favoriteCount ?? 0;
        recentCount.value = response.data?.recentCount ?? 0;
        sharedCount.value = response.data?.sharedCount ?? 0;
      }
      return response;
    } finally {
      summaryLoading.value = false;
    }
  }

  async function uploadDocument(file, metadata = {}, attempt = 0) {
    const idempotencyKey = metadata.idempotencyKey || (
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    const formData = new FormData();
    formData.append('file', file);
    if (metadata.title) formData.append('title', metadata.title);
    if (metadata.description) formData.append('description', metadata.description);
    if (metadata.folderId) formData.append('folderId', metadata.folderId);
    if (metadata.duplicateAction) formData.append('duplicateAction', metadata.duplicateAction);
    if (Array.isArray(metadata.tags) && metadata.tags.length) {
      formData.append('tags', metadata.tags.join(','));
    }

    const token = useAuthStore().user?.token;
    const headers = { 'X-Idempotency-Key': idempotencyKey };
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      const response = await fetch(getApiUrlForFetch('/api/documents/upload'), {
        method: 'POST',
        headers,
        body: formData
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          success: false,
          message: data?.message || data?.error || `Upload failed (${response.status})`,
          code: data?.code,
          documentId: data?.documentId,
          documentNumber: data?.documentNumber,
          title: data?.title
        };
      }
      return data;
    } catch (error) {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
        return uploadDocument(file, { ...metadata, idempotencyKey }, attempt + 1);
      }
      return {
        success: false,
        message: error?.message || 'Upload failed'
      };
    }
  }

  async function uploadDocuments(files, metadata = {}) {
    uploading.value = true;
    try {
      const results = [];
      for (const file of files) {
        const idempotencyKey = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const result = await uploadDocument(file, {
          ...metadata,
          idempotencyKey,
          title: metadata.title || file.name
        });
        results.push(result);
      }
      return results;
    } finally {
      uploading.value = false;
    }
  }

  async function createDocument(payload = {}) {
    return apiClient.post('/documents', payload);
  }

  async function updateDocument(documentId, payload = {}) {
    return apiClient.patch(`/documents/${documentId}`, payload);
  }

  async function deleteDocument(documentId) {
    return apiClient.delete(`/documents/${documentId}`);
  }

  async function fetchFolders(parentFolderId = null, options = {}) {
    const params = new URLSearchParams();
    if (options.all) {
      params.set('all', '1');
    } else if (parentFolderId) {
      params.set('parentFolderId', String(parentFolderId));
    }
    const query = params.toString();
    const response = await apiClient.get(`/document-folders${query ? `?${query}` : ''}`);
    if (response.success) {
      folders.value = response.data || [];
    }
    return response;
  }

  async function fetchAllFolders() {
    return fetchFolders(null, { all: true });
  }

  async function createFolder(name, parentFolderId = null) {
    const response = await apiClient.post('/document-folders', {
      name,
      parentFolderId: parentFolderId || undefined
    });
    return response;
  }

  async function deleteFolder(folderId) {
    const response = await apiClient.delete(`/document-folders/${folderId}`);
    return response;
  }

  async function getPreviewUrl(documentId) {
    const response = await apiClient.get(`/documents/${documentId}/preview`);
    if (response.success) {
      const data = response.data || {};
      return {
        ...data,
        url: data.url ? resolveAssetDownloadUrl(data.url) : data.url
      };
    }
    throw new Error(response.message || 'Failed to load preview');
  }

  async function getDownloadUrl(documentId) {
    const response = await apiClient.get(`/documents/${documentId}/download`);
    if (response.success) {
      const data = response.data || {};
      return {
        ...data,
        url: data.url ? resolveAssetDownloadUrl(data.url) : data.url
      };
    }
    throw new Error(response.message || 'Failed to load download');
  }

  async function fetchVersions(documentId) {
    const response = await apiClient.get(`/documents/${documentId}/versions`);
    if (response.success) {
      return response.data || [];
    }
    throw new Error(response.message || 'Failed to load versions');
  }

  async function uploadNewVersion(documentId, file, options = {}) {
    const idempotencyKey = options.idempotencyKey || (
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `version-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    const formData = new FormData();
    formData.append('file', file);
    if (options.changeSummary) formData.append('changeSummary', options.changeSummary);
    if (options.baseVersion != null) formData.append('baseVersion', String(options.baseVersion));
    if (options.forceUpload) formData.append('forceUpload', 'true');

    const token = useAuthStore().user?.token;
    const headers = { 'X-Idempotency-Key': idempotencyKey };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(getApiUrlForFetch(`/api/documents/${documentId}/versions`), {
      method: 'POST',
      headers,
      body: formData
    });
    return response.json();
  }

  async function restoreVersion(documentId, versionNumber) {
    return apiClient.post(`/documents/${documentId}/versions/${versionNumber}/restore`);
  }

  async function toggleFavorite(documentId) {
    const response = await apiClient.post(`/documents/${documentId}/favorite`);
    if (response.success) {
      const id = String(documentId);
      const next = new Set(favoriteDocumentIds.value);
      if (response.data?.favorited) {
        next.add(id);
        favoriteCount.value += 1;
      } else {
        next.delete(id);
        favoriteCount.value = Math.max(0, favoriteCount.value - 1);
      }
      favoriteDocumentIds.value = next;
    }
    return response;
  }

  function isFavorite(documentId) {
    return favoriteDocumentIds.value.has(String(documentId));
  }

  async function reserveDocument(documentId, reason = '') {
    return apiClient.post(`/documents/${documentId}/reserve`, { reason });
  }

  async function releaseReservation(documentId) {
    return apiClient.delete(`/documents/${documentId}/reserve`);
  }

  async function takeoverReservation(documentId, reason = '') {
    return apiClient.post(`/documents/${documentId}/reserve/takeover`, { reason });
  }

  async function notifyReservationHolder(documentId) {
    return apiClient.post(`/documents/${documentId}/reserve/notify`);
  }

  async function fetchDocumentPresence(documentId) {
    const response = await apiClient.get(`/documents/${documentId}/presence`);
    if (response.success) {
      return response.data || [];
    }
    throw new Error(response.message || 'Failed to load presence');
  }

  async function heartbeatDocumentPresence(documentId, activityType = 'viewing') {
    const response = await apiClient.post(`/documents/${documentId}/presence/heartbeat`, {
      activityType
    });
    if (response.success) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to update presence');
  }

  async function clearDocumentPresence(documentId) {
    return apiClient.delete(`/documents/${documentId}/presence`);
  }

  async function fetchDocumentConflicts(documentId) {
    const response = await apiClient.get(`/documents/${documentId}/conflicts`);
    if (response.success) {
      return response.data || [];
    }
    throw new Error(response.message || 'Failed to load conflicts');
  }

  async function resolveDocumentConflict(documentId, conflictId, resolution = '') {
    return apiClient.post(`/documents/${documentId}/conflicts/${conflictId}/resolve`, {
      resolution
    });
  }

  async function checkExternalLink(documentId) {
    return apiClient.post(`/documents/${documentId}/external-link/check`);
  }

  async function fetchActivity({ page = 1, limit = 30, documentId = '' } = {}) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (documentId) params.set('documentId', documentId);
    return apiClient.get(`/documents/activity?${params.toString()}`);
  }

  async function semanticSearchDocuments({ q = '', page = 1, limit = 20 } = {}) {
    loading.value = true;
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (q) params.set('q', q);
      const response = await apiClient.get(`/documents/search/semantic?${params.toString()}`);
      if (response.success) {
        documents.value = response.data || [];
        pagination.value = response.pagination || pagination.value;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchDocumentInlineComments(documentId, { status = '' } = {}) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get(`/documents/${documentId}/comments${suffix}`);
  }

  async function createDocumentInlineComment(documentId, payload = {}) {
    return apiClient.post(`/documents/${documentId}/comments`, payload);
  }

  async function resolveDocumentInlineComment(documentId, commentId) {
    return apiClient.post(`/documents/${documentId}/comments/${commentId}/resolve`);
  }

  async function reopenDocumentInlineComment(documentId, commentId) {
    return apiClient.post(`/documents/${documentId}/comments/${commentId}/reopen`);
  }

  async function fetchDocumentSignatureRequests(documentId) {
    return apiClient.get(`/documents/${documentId}/signatures`);
  }

  async function createDocumentSignatureRequest(documentId, payload = {}) {
    return apiClient.post(`/documents/${documentId}/signatures`, payload);
  }

  async function signDocumentSignatureRequest(documentId, requestId, payload = {}) {
    return apiClient.post(`/documents/${documentId}/signatures/${requestId}/sign`, payload);
  }

  async function cancelDocumentSignatureRequest(documentId, requestId) {
    return apiClient.post(`/documents/${documentId}/signatures/${requestId}/cancel`);
  }

  async function fetchDocumentEditDraft(documentId) {
    return apiClient.get(`/documents/${documentId}/draft`);
  }

  async function fetchDocumentEditDrafts(documentId) {
    return apiClient.get(`/documents/${documentId}/drafts`);
  }

  async function saveDocumentEditDraft(documentId, payload = {}) {
    return apiClient.put(`/documents/${documentId}/draft`, payload);
  }

  async function deleteDocumentEditDraft(documentId) {
    return apiClient.delete(`/documents/${documentId}/draft`);
  }

  async function publishDocumentEditDraft(documentId) {
    return apiClient.post(`/documents/${documentId}/draft/publish`);
  }

  return {
    documents,
    summary,
    recentDocuments,
    recentActivity,
    folders,
    favoriteDocumentIds,
    favoriteCount,
    recentCount,
    sharedCount,
    loading,
    summaryLoading,
    uploading,
    pagination,
    fetchDocuments,
    fetchKnowledgeBase,
    fetchSummary,
    createDocument,
    uploadDocument,
    uploadDocuments,
    updateDocument,
    deleteDocument,
    fetchFolders,
    fetchAllFolders,
    createFolder,
    deleteFolder,
    getPreviewUrl,
    getDownloadUrl,
    fetchVersions,
    uploadNewVersion,
    restoreVersion,
    toggleFavorite,
    isFavorite,
    reserveDocument,
    releaseReservation,
    takeoverReservation,
    notifyReservationHolder,
    fetchDocumentPresence,
    heartbeatDocumentPresence,
    clearDocumentPresence,
    fetchDocumentConflicts,
    resolveDocumentConflict,
    checkExternalLink,
    fetchActivity,
    semanticSearchDocuments,
    fetchDocumentInlineComments,
    createDocumentInlineComment,
    resolveDocumentInlineComment,
    reopenDocumentInlineComment,
    fetchDocumentSignatureRequests,
    createDocumentSignatureRequest,
    signDocumentSignatureRequest,
    cancelDocumentSignatureRequest,
    fetchDocumentEditDraft,
    fetchDocumentEditDrafts,
    saveDocumentEditDraft,
    deleteDocumentEditDraft,
    publishDocumentEditDraft
  };
}
