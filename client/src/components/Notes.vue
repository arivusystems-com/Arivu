<template>
  <div class="notes-component">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
        <p class="mt-4 text-sm text-gray-600 dark:text-gray-400">{{ t('records.notesLoadingNotes') }}</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">{{ t('records.notesErrorLoadingNotes') }}</h3>
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
          <h3 class="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">{{ t('records.notesCannotLoadNotes') }}</h3>
          <p class="text-sm text-yellow-700 dark:text-yellow-300">
            {{ blockedReason || t('records.notesBlockedContext') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Notes Content -->
    <div v-else>
      <!-- Create Note Form (if user has permission) -->
      <div v-if="canCreate" class="mb-6">
        <form @submit.prevent="createNote" class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('records.notesAddNote') }}</label>
            <textarea
              v-model="newNoteContent"
              rows="3"
              :placeholder="t('records.notesWriteANote')"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              :disabled="creating"
            ></textarea>
          </div>
          <div v-if="createError" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p class="text-sm text-red-700 dark:text-red-300">{{ createError }}</p>
          </div>
          <div class="flex items-center justify-end gap-2">
            <button
              type="button"
              @click="newNoteContent = ''; createError = null"
              :disabled="creating"
              class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >{{ t('settings.modFieldsClear') }}</button>
            <button
              type="submit"
              :disabled="creating || !newNoteContent.trim()"
              class="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              <svg v-if="creating" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              {{ creating ? t('records.notesAdding') : t('records.notesAddNoteBtn') }}
            </button>
          </div>
        </form>
      </div>

      <!-- Notes List -->
      <div v-if="notes && notes.length > 0" class="space-y-4">
        <div
          v-for="(note, index) in notes"
          :key="note.id || index"
          class="border-l-4 border-indigo-500 pl-4 py-2"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{{ note.content }}</p>
              <div class="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span class="font-medium">{{ note.authorName || t('records.notesUserFallback') }}</span>
                <span>•</span>
                <span>{{ formatDate(note.createdAt) }}</span>
                <span v-if="note.appContext" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                  {{ note.appContext }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!loading && !error && !blocked" class="text-center py-8">
        <p class="text-sm text-gray-500 dark:text-gray-400 italic">{{ t('records.notesNoNotesYet') }}<span v-if="canCreate" class="text-indigo-600 dark:text-indigo-400">{{ t('records.notesAddANoteAboveToGet') }}</span>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'RecordNotes' });
import { useI18n } from 'vue-i18n';
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { formatUserDateTime } from '@/utils/localeFormat';

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
  canCreate: {
    type: Boolean,
    default: true
  }
});

const { t } = useI18n();

const route = useRoute();

// State
const loading = ref(true);
const error = ref(null);
const notes = ref([]);
const blocked = ref(false);
const blockedReason = ref(null);
const appContext = ref(null);
const newNoteContent = ref('');
const creating = ref(false);
const createError = ref(null);

// Methods
const loadNotes = async () => {
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

    // Load notes from API
    const response = await apiClient.get(`/notes/${props.entityType}/${props.entityId}`, {
      params: {
        routePath: route.path,
        routeName: route.name,
        appKey: props.appKey || route.query.appKey || null
      }
    });

    if (response.success && response.data) {
      notes.value = response.data.notes || [];
      appContext.value = response.data.appContext;
      
      // Check if notes were blocked
      if (response.data.blocked) {
        blocked.value = true;
        blockedReason.value = response.data.reason || 'App context is ambiguous. Cannot determine which notes to show.';
      }
    } else {
      throw new Error('Failed to load notes');
    }
  } catch (err) {
    console.error('Error loading notes:', err);
    error.value = err.message || 'Failed to load notes';
  } finally {
    loading.value = false;
  }
};

const createNote = async () => {
  if (!newNoteContent.value.trim()) {
    createError.value = 'Note content is required.';
    return;
  }

  try {
    creating.value = true;
    createError.value = null;

    const response = await apiClient.post(`/notes/${props.entityType}/${props.entityId}`, {
      content: newNoteContent.value.trim()
    }, {
      params: {
        routePath: route.path,
        routeName: route.name,
        appKey: props.appKey || route.query.appKey || null
      }
    });

    if (response.success && response.data) {
      // Clear form
      newNoteContent.value = '';
      
      // Reload notes to show the new one
      await loadNotes();
      
      // Emit event for parent component (e.g., to refresh Activity timeline)
      emit('noteCreated', response.data);
    } else {
      createError.value = response.message || 'Failed to create note';
    }
  } catch (err) {
    console.error('Error creating note:', err);
    createError.value = err.message || 'Failed to create note';
    
    // Handle specific error codes
    if (err.response?.data?.code === 'AMBIGUOUS_APP_CONTEXT') {
      createError.value = 'App context is ambiguous. Cannot create note without explicit app context.';
    }
  } finally {
    creating.value = false;
  }
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
      return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else {
      return formatUserDateTime(date);
    }
  } catch (e) {
    return String(dateValue);
  }
};

// Emit events
const emit = defineEmits(['noteCreated']);

// Watch for prop changes
watch(() => props.entityId, () => {
  if (props.entityId) {
    loadNotes();
  }
});

watch(() => props.appKey, () => {
  if (props.entityId) {
    loadNotes();
  }
});

// Lifecycle
onMounted(() => {
  if (props.entityId) {
    loadNotes();
  }
});
</script>

<style scoped>
.notes-component {
  /* Component-specific styles if needed */
}
</style>

