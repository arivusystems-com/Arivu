<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
    <!-- Header (always visible, clickable when collapsed) -->
    <button
      @click="isExpanded = !isExpanded"
      class="w-full p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
    >
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.correctiveActionsHeading') }}</h2>
        <svg
          class="w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform duration-200"
          :class="{ 'rotate-180': isExpanded }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </button>

    <!-- Content Area -->
    <div v-show="isExpanded" class="p-6">
      <!-- Success State: No Failed Questions -->
      <div v-if="failedQuestions.length === 0" class="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <svg class="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-sm font-medium text-green-800 dark:text-green-300">
          {{ t('forms.correctiveAllPassed') }}
        </p>
      </div>

      <!-- Failed Questions with Corrective Actions -->
      <div v-else class="space-y-4">
        <div
          v-for="question in failedQuestions"
          :key="question.questionId"
          class="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
        >
          <!-- Question Header -->
          <div class="flex items-start justify-between mb-4">
            <div class="flex-1">
              <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-1">
                {{ question.questionText }}
              </h3>
              <p class="text-xs text-gray-600 dark:text-gray-400">
                {{ t('forms.correctiveAnswerLabel') }} {{ formatAnswer(question.answer) }}
              </p>
            </div>
            <BadgeCell
              :value="t('forms.correctivePassFailFail')"
              :variant-map="failBadgeVariantMap"
            />
          </div>

          <!-- Existing Corrective Actions (grouped by question) -->
          <div v-if="getCorrectiveAction(question.questionId)" class="mb-4 space-y-3">
            <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
              <!-- Action Title -->
              <div class="mb-3">
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-1">{{ t('forms.correctiveActionTitle') }}</h4>
                <p class="text-sm text-gray-700 dark:text-gray-300">
                  {{ getCorrectiveAction(question.questionId).managerAction?.comment || t('forms.correctiveNoDescription') }}
                </p>
              </div>

              <!-- Action Details Grid -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                <!-- Last Updated By -->
                <div>
                  <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('forms.correctiveLastUpdatedBy') }}</p>
                  <p class="text-sm text-gray-900 dark:text-white">
                    {{ getLastUpdatedByName(question.questionId) || '—' }}
                  </p>
                </div>

                <!-- Status -->
                <div>
                  <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('forms.fieldStatus') }}</p>
                  <BadgeCell
                    :value="mapStatus(getCorrectiveAction(question.questionId).managerAction?.status)"
                    :variant-map="correctiveStatusVariantMap"
                  />
                </div>

                <!-- Due Date (placeholder for future) -->
                <div>
                  <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('forms.correctiveDueDate') }}</p>
                  <p class="text-sm text-gray-900 dark:text-white">
                    {{ formatDate(getCorrectiveAction(question.questionId).managerAction?.addedAt) || t('forms.correctiveNotSet') }}
                  </p>
                </div>
              </div>

              <!-- Proof Files -->
              <div v-if="getCorrectiveAction(question.questionId).managerAction?.proof?.length" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{{ t('forms.correctiveProofFiles') }}</p>
                <div class="flex flex-wrap gap-2">
                  <a
                    v-for="(proof, pIndex) in getCorrectiveAction(question.questionId).managerAction.proof"
                    :key="pIndex"
                    :href="proof"
                    target="_blank"
                    class="inline-flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    {{ proof.split('/').pop() }}
                  </a>
                </div>
              </div>
            </div>

            <!-- Edit Button (only for corrective action owners) -->
            <button
              v-if="canUpdateCorrectiveActions === true && editingQuestionId !== question.questionId"
              @click="startEdit(question.questionId)"
              class="px-3 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
            >
              {{ t('forms.correctiveEditAction') }}
            </button>
          </div>

          <!-- Add/Edit Corrective Action Form (inline) -->
          <div
            v-if="canUpdateCorrectiveActions === true && (!getCorrectiveAction(question.questionId) || editingQuestionId === question.questionId)"
            class="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4"
          >
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('forms.correctiveActionTitleField') }} <span class="text-red-500">*</span>
              </label>
              <textarea
                v-model="getCorrectiveActionData(question.questionId).comment"
                rows="3"
                :placeholder="t('forms.correctiveActionTitlePh')"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              ></textarea>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ t('forms.fieldStatus') }} <span class="text-red-500">*</span>
                </label>
                <select
                  v-model="getCorrectiveActionData(question.questionId).status"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                >
                  <option value="open">{{ t('forms.correctiveStatusOpen') }}</option>
                  <option value="in_progress">{{ t('forms.correctiveStatusInProgress') }}</option>
                  <option value="completed">{{ t('forms.correctiveStatusCompleted') }}</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('forms.correctiveUploadProof') }}
              </label>
              <input
                type="file"
                @change="handleFileUpload($event, question.questionId)"
                multiple
                class="w-full text-sm text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/20 dark:file:text-indigo-400"
              />
              <div v-if="getCorrectiveActionData(question.questionId).proofFiles.length" class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="(file, fIndex) in getCorrectiveActionData(question.questionId).proofFiles"
                  :key="fIndex"
                  class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                >
                  {{ file.name }}
                  <button
                    @click="removeProofFile(question.questionId, fIndex)"
                    class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    type="button"
                  >
                    ×
                  </button>
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                @click="saveCorrectiveAction(question.questionId)"
                :disabled="saving || !getCorrectiveActionData(question.questionId).comment.trim()"
                class="px-4 py-2 bg-indigo-600 text-white dark:text-white dark:bg-indigo-700 rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm ring-1 ring-black/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ saving ? t('states.saving') : (getCorrectiveAction(question.questionId) ? t('actions.update') : t('actions.add')) }}
                {{ t('forms.correctiveActionNoun') }}
              </button>
              <button
                v-if="editingQuestionId === question.questionId"
                @click="cancelEdit"
                class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors"
              >
                {{ t('actions.cancel') }}
              </button>
            </div>
          </div>

          <!-- Read-only message for non-owners -->
          <div
            v-else-if="canUpdateCorrectiveActions === false"
            class="border-t border-gray-200 dark:border-gray-700 pt-4"
          >
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ t('forms.correctiveReadOnly', { ownersField: t('forms.correctiveOwnersField') }) }}
            </p>
          </div>
          <div
            v-else-if="canUpdateCorrectiveActions === null"
            class="border-t border-gray-200 dark:border-gray-700 pt-4"
          >
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ t('forms.correctiveLoadingPermissions') }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import { useAuthStore } from '@/stores/authRegistry';

import { useNotifications } from '@/composables/useNotifications';
import { formatUserDate } from '@/utils/localeFormat';
const { t } = useI18n();
const notifications = useNotifications();


const failBadgeVariantMap = computed(() => ({
  [t('forms.correctivePassFailFail')]: 'danger',
}));

const correctiveStatusVariantMap = computed(() => ({
  [t('forms.correctiveStatusOpen')]: 'default',
  [t('forms.correctiveStatusInProgress')]: 'warning',
  [t('forms.correctiveStatusCompleted')]: 'success',
}));

const props = defineProps({
  response: {
    type: Object,
    required: true
  },
  form: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['updated']);

// State
const saving = ref(false);
const editingQuestionId = ref(null);
const correctiveActions = ref({});
const isExpanded = ref(false); // Collapsed by default

const authStore = useAuthStore();

// Authorization: only the linked Event.correctiveOwnerId can update corrective actions
const linkedEvent = computed(() => {
  if (props.response?.linkedTo?.type !== 'Event') return null;
  // When populated, this is the full Event doc. Otherwise it's an ObjectId/string.
  return props.response?.linkedTo?.id || null;
});

// null = unknown (e.g., linked event not populated yet)
const canUpdateCorrectiveActions = computed(() => {
  const currentUserId = authStore.user?._id;
  if (!currentUserId) return false;

  // If we don't have an expanded linked event doc, we can't reliably determine owners.
  const isPopulatedEventDoc =
    linkedEvent.value &&
    typeof linkedEvent.value === 'object' &&
    (linkedEvent.value._id || linkedEvent.value.correctiveOwnerId);
  if (!isPopulatedEventDoc) return null;

  const assignedTo = String(linkedEvent.value?.correctiveOwnerId?._id || linkedEvent.value?.correctiveOwnerId || '');
  if (!assignedTo) return false;
  return assignedTo === String(currentUserId);
});

// Computed
const failedQuestions = computed(() => {
  if (!props.response || !props.response.responseDetails || !props.form) return [];
  
  return props.response.responseDetails
    .filter(rd => rd.passFail === 'Fail')
    .map(rd => {
      // Find question in form structure
      let question = null;
      for (const section of props.form.sections || []) {
        for (const subsection of section.subsections || []) {
          const q = subsection.questions?.find(q => q.questionId === rd.questionId);
          if (q) {
            question = { ...q, answer: rd.answer };
            break;
          }
        }
        if (question) break;
      }
      return question;
    })
    .filter(q => q !== null);
});

// Watch failed questions and expand if they exist
watch(failedQuestions, (newVal) => {
  // Expand if there are failed questions, collapse if none
  isExpanded.value = newVal.length > 0;
}, { immediate: true });

// Methods
const getCorrectiveAction = (questionId) => {
  if (!props.response || !props.response.correctiveActions) return null;
  return props.response.correctiveActions.find(ca => ca.questionId === questionId) || null;
};

const getCorrectiveActionData = (questionId) => {
  // Initialize if not exists
  if (!correctiveActions.value[questionId]) {
    const existing = getCorrectiveAction(questionId);
    correctiveActions.value[questionId] = {
      comment: existing?.managerAction?.comment || '',
      // Stored values are enum: open | in_progress | completed
      status: existing?.managerAction?.status || 'open',
      proofFiles: []
    };
  }
  return correctiveActions.value[questionId];
};

const formatAnswer = (answer) => {
  if (answer === null || answer === undefined) return t('forms.correctiveNoAnswer');
  if (Array.isArray(answer)) return answer.join(', ');
  return String(answer);
};

const formatDate = (date) => {
  if (!date) return null;
  return formatUserDate(date);
};

const mapStatus = (status) => {
  const statusMap = {
    open: t('forms.correctiveStatusOpen'),
    in_progress: t('forms.correctiveStatusInProgress'),
    completed: t('forms.correctiveStatusCompleted'),
    Pending: t('forms.correctiveStatusOpen'),
    'In Progress': t('forms.correctiveStatusInProgress'),
    Resolved: t('forms.correctiveStatusCompleted'),
  };
  return statusMap[status] || status;
};

const getLastUpdatedByName = (questionId) => {
  const action = getCorrectiveAction(questionId);
  if (!action || !action.managerAction?.addedBy) return null;
  
  const user = action.managerAction.addedBy;
  if (typeof user === 'object') {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || t('forms.correctiveUnknownUser');
  }
  return null;
};

const startEdit = (questionId) => {
  editingQuestionId.value = questionId;
  getCorrectiveActionData(questionId);
};

const cancelEdit = () => {
  editingQuestionId.value = null;
};

const handleFileUpload = (event, questionId) => {
  const files = Array.from(event.target.files);
  const actionData = getCorrectiveActionData(questionId);
  actionData.proofFiles.push(...files);
};

const removeProofFile = (questionId, fileIndex) => {
  const actionData = getCorrectiveActionData(questionId);
  if (actionData && actionData.proofFiles) {
    actionData.proofFiles.splice(fileIndex, 1);
  }
};

const saveCorrectiveAction = async (questionId) => {
  const actionData = getCorrectiveActionData(questionId);
  
  if (!actionData.comment.trim()) {
    notifications.warning(t('forms.correctiveTitleRequired'));
    return;
  }

  saving.value = true;
  try {
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('questionId', questionId);
    formData.append('comment', actionData.comment);
    formData.append('status', actionData.status);
    
    // Append proof files
    if (actionData.proofFiles && actionData.proofFiles.length > 0) {
      actionData.proofFiles.forEach((file) => {
        formData.append('proof', file);
      });
    }

    // Use fetch for FormData (apiClient sets JSON headers; FormData needs custom handling)
    const token = authStore.user?.token;
    
    const response = await fetch(`/api/forms/${props.form._id}/responses/${props.response._id}/corrective-action`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    // Some failures return HTML (proxy/error pages). Parse safely.
    const contentType = response.headers.get('content-type') || '';
    let result = null;
    if (contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const text = await response.text();
      console.error('Non-JSON response received from corrective-action endpoint:', {
        status: response.status,
        contentType,
        bodyPreview: text?.slice(0, 300)
      });
      throw new Error(t('forms.correctiveServerError', { status: response.status }));
    }

    if (result.success) {
      editingQuestionId.value = null;
      // Clear proof files after successful upload
      correctiveActions.value[questionId].proofFiles = [];
      // Emit updated event - this will trigger response status recalculation via backend
      emit('updated');
    } else {
      throw new Error(result.error || result.message || t('forms.correctiveSaveFailed'));
    }
  } catch (error) {
    console.error('Error saving corrective action:', error);
    notifications.error(error?.message || t('forms.correctiveSaveFailedRetry'));
  } finally {
    saving.value = false;
  }
};

// Lifecycle
onMounted(() => {
  // Expand if there are failed questions
  isExpanded.value = failedQuestions.value.length > 0;
});
</script>
