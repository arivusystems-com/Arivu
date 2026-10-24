<template>
  <div class="files-component">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
        <p class="mt-4 text-sm text-gray-600 dark:text-gray-400">{{ t('records.filesLoadingFiles') }}</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">{{ t('records.filesErrorLoadingFiles') }}</h3>
          <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Blocked State (Ambiguous App Context) -->
    <div v-else-if="blocked" class="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">{{ t('records.filesCannotLoadFiles') }}</h3>
          <p class="text-sm text-yellow-700 dark:text-yellow-300">
            {{ blockedReason || 'App context is ambiguous. Cannot determine which files to show.' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Files Content -->
    <div v-else>
      <!-- Upload File Form (if user has permission) -->
      <div v-if="canUpload" class="mb-6">
        <form @submit.prevent="uploadFile" class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('records.filesUploadFile') }}</label>
            <div class="flex items-center gap-3">
              <input
                ref="fileInput"
                type="file"
                @change="handleFileSelect"
                class="block w-full text-sm text-gray-500 dark:text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-indigo-50 file:text-indigo-700
                  hover:file:bg-indigo-100
                  dark:file:bg-indigo-900/40 dark:file:text-indigo-300
                  cursor-pointer"
                :disabled="uploading"
              />
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('records.filesAllowedImagesPdfWordExcelCsv') }}</p>
          </div>
          <div v-if="uploadError" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p class="text-sm text-red-700 dark:text-red-300">{{ uploadError }}</p>
          </div>
          <div v-if="selectedFile" class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span class="text-sm text-gray-900 dark:text-white">{{ selectedFile.name }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-400">({{ formatFileSize(selectedFile.size) }})</span>
            </div>
            <button
              type="button"
              @click="clearFile"
              :disabled="uploading"
              class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >{{ t('settings.assignRulesRemoveTitle') }}</button>
          </div>
          <div v-if="selectedFile" class="flex items-center justify-end gap-2">
            <button
              type="button"
              @click="clearFile"
              :disabled="uploading"
              class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >{{ t('performance.cancelWizard') }}</button>
            <button
              type="submit"
              :disabled="uploading || !selectedFile"
              class="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              <svg v-if="uploading" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {{ uploading ? 'Uploading...' : 'Upload File' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Files List -->
      <div v-if="files && files.length > 0" class="space-y-3">
        <div
          v-for="(file, index) in files"
          :key="file.id || index"
          class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <!-- File Icon -->
            <div class="flex-shrink-0">
              <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <!-- File Info -->
            <div class="flex-1 min-w-0">
              <a
                :href="resolveFileUrl(file)"
                target="_blank"
                class="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate block"
              >
                {{ file.fileName }}
              </a>
              <div class="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{{ formatFileSize(file.fileSize) }}</span>
                <span>•</span>
                <span>{{ formatFileType(file.fileType) }}</span>
                <span>•</span>
                <span>{{ file.uploaderName || 'User' }}</span>
                <span>•</span>
                <span>{{ formatDate(file.createdAt) }}</span>
                <span v-if="file.appContext" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                  {{ file.appContext }}
                </span>
              </div>
            </div>
          </div>
          <!-- Download Button -->
          <div class="flex-shrink-0">
            <a
              :href="resolveFileUrl(file)"
              :download="file.fileName"
              class="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              :title="t('records.filesDownload')"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!loading && !error && !blocked" class="text-center py-8">
        <p class="text-sm text-gray-500 dark:text-gray-400 italic">{{ t('records.filesNoFilesUploadedYet') }}<span v-if="canUpload" class="text-indigo-600 dark:text-indigo-400">{{ t('records.filesUploadAFileAboveToGet') }}</span>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'RecordFiles' });
import { useI18n } from 'vue-i18n';
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch } from '@/config/apiBase';
import { formatUserDate } from '@/utils/localeFormat';

const props = defineProps({
  entityType: {
    type: String,
    required: true,
    default: 'Person'
  },
  entityId: {
    type: String,
    required: true
  },
  appKey: {
    type: String,
    default: null
  },
  canUpload: {
    type: Boolean,
    default: true
  }
});

const { t } = useI18n();

const route = useRoute();
const authStore = useAuthStore();

// State
const loading = ref(true);
const error = ref(null);
const files = ref([]);
const blocked = ref(false);
const blockedReason = ref(null);
const appContext = ref(null);
const selectedFile = ref(null);
const uploading = ref(false);
const uploadError = ref(null);
const fileInput = ref(null);

// Methods
const resolveFileUrl = (file) => {
  const raw = file?.url || file?.storagePath || '';
  if (!raw) return '#';
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
    return raw;
  }
  return getApiUrlForFetch(raw);
};

const loadFiles = async () => {
  try {
    loading.value = true;
    error.value = null;
    blocked.value = false;
    blockedReason.value = null;

    if (!props.entityId) {
      throw new Error('Entity ID is required');
    }

    // Build route info for app context resolution
    const routeInfo = {
      path: route.path,
      name: route.name,
      params: route.params,
      query: route.query,
      meta: route.meta
    };

    // Load files from API
    const response = await apiClient.get(`/files/${props.entityType}/${props.entityId}`, {
      params: {
        routePath: route.path,
        routeName: route.name,
        appKey: props.appKey || route.query.appKey || null
      }
    });

    if (response.success && response.data) {
      files.value = response.data.files || [];
      appContext.value = response.data.appContext;
      
      // Check if files were blocked
      if (response.data.blocked) {
        blocked.value = true;
        blockedReason.value = response.data.reason || 'App context is ambiguous. Cannot determine which files to show.';
      }
    } else {
      throw new Error('Failed to load files');
    }
  } catch (err) {
    console.error('Error loading files:', err);
    error.value = err.message || 'Failed to load files';
  } finally {
    loading.value = false;
  }
};

const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (file) {
    selectedFile.value = file;
    uploadError.value = null;
  }
};

const clearFile = () => {
  selectedFile.value = null;
  uploadError.value = null;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const uploadFile = async () => {
  if (!selectedFile.value) {
    uploadError.value = 'Please select a file to upload.';
    return;
  }

  try {
    uploading.value = true;
    uploadError.value = null;

    // Create FormData for file upload
    const formData = new FormData();
    formData.append('file', selectedFile.value);

    // Build query params for app context
    const params = new URLSearchParams({
      routePath: route.path,
      routeName: route.name || '',
      appKey: props.appKey || route.query.appKey || ''
    });

    // Upload file using fetch (since apiClient doesn't support FormData well)
    const token = authStore.user?.token;
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/files/${props.entityType}/${props.entityId}?${params.toString()}`, {
      method: 'POST',
      headers: headers,
      body: formData
    });

    if (response.status === 401) {
      authStore.logout();
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.data) {
      // Clear form
      clearFile();
      
      // Reload files to show the new one
      await loadFiles();
      
      // Emit event for parent component (e.g., to refresh Activity timeline)
      emit('fileUploaded', result.data);
    } else {
      uploadError.value = result.message || 'Failed to upload file';
    }
  } catch (err) {
    console.error('Error uploading file:', err);
    uploadError.value = err.message || 'Failed to upload file';
    
    // Handle specific error codes
    if (err.response?.data?.code === 'AMBIGUOUS_APP_CONTEXT') {
      uploadError.value = 'App context is ambiguous. Cannot upload file without explicit app context.';
    }
  } finally {
    uploading.value = false;
  }
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const formatFileType = (mimeType) => {
  if (!mimeType) return 'Unknown';
  const parts = mimeType.split('/');
  return parts[parts.length - 1].toUpperCase();
};

const formatDate = (dateValue) => {
  if (!dateValue) return '-';
  try {
    const date = new Date(dateValue);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return formatUserDate(date);
    }
  } catch (e) {
    return String(dateValue);
  }
};

// Emit events
const emit = defineEmits(['fileUploaded']);

// Watch for prop changes
watch(() => props.entityId, () => {
  if (props.entityId) {
    loadFiles();
  }
});

watch(() => props.appKey, () => {
  if (props.entityId) {
    loadFiles();
  }
});

// Lifecycle
onMounted(() => {
  if (props.entityId) {
    loadFiles();
  }
});
</script>

<style scoped>
.files-component {
  /* Component-specific styles if needed */
}
</style>

