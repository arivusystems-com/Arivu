<template>
  <div class="space-y-4">
    <div class="flex gap-4">
      <label class="inline-flex items-center">
        <input
          type="radio"
          :name="question.questionId"
          value="Yes"
          :checked="value === 'Yes'"
          @change="handleAnswerChange('Yes')"
          :required="question.mandatory"
          class="form-radio text-indigo-600 focus:ring-indigo-500"
        />
        <span class="ml-2 text-gray-700 dark:text-gray-300">{{ t('forms.answerYes') }}</span>
      </label>
      <label class="inline-flex items-center">
        <input
          type="radio"
          :name="question.questionId"
          value="No"
          :checked="value === 'No'"
          @change="handleAnswerChange('No')"
          :required="question.mandatory"
          class="form-radio text-indigo-600 focus:ring-indigo-500"
        />
        <span class="ml-2 text-gray-700 dark:text-gray-300">{{ t('forms.answerNo') }}</span>
      </label>
    </div>

    <!-- Evidence Inputs (only for Audit forms, after answer is selected) -->
    <div
      v-if="showEvidence && activeEvidenceRule"
      class="mt-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 space-y-4"
    >
      <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        {{ t('forms.evidenceRequiredHeading') }}
      </div>

      <!-- Comment -->
      <div v-if="activeEvidenceRule.comment.required !== 'hidden'">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ t('forms.evidenceCommentLabel') }}
          <span v-if="activeEvidenceRule.comment.required === 'required'" class="text-red-500">*</span>
        </label>
        <textarea
          :value="evidenceData.comment"
          @input="updateEvidence('comment', $event.target.value)"
          :required="activeEvidenceRule.comment.required === 'required'"
          rows="3"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          :placeholder="t('forms.evidenceCommentPh')"
        ></textarea>
        <div v-if="evidenceErrors.comment" class="mt-1 text-xs text-red-600 dark:text-red-400">
          {{ evidenceErrors.comment }}
        </div>
      </div>

      <!-- Image Upload -->
      <div v-if="activeEvidenceRule.image.required !== 'hidden'">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ t('forms.evidenceImageUploadLabel') }}
          <span v-if="activeEvidenceRule.image.required === 'required'" class="text-red-500">*</span>
        </label>
        <input
          type="file"
          accept="image/*"
          @change="handleImageUpload"
          :required="activeEvidenceRule.image.required === 'required'"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <div v-if="evidenceData.image" class="mt-2 text-xs text-gray-600 dark:text-gray-400">
          {{ t('forms.evidenceSelectedPrefix') }}
          {{ evidenceData.image.name || t('forms.evidenceImageUploaded') }}
        </div>
        <div v-if="evidenceErrors.image" class="mt-1 text-xs text-red-600 dark:text-red-400">
          {{ evidenceErrors.image }}
        </div>
      </div>

      <!-- Video Upload -->
      <div v-if="activeEvidenceRule.video.required !== 'hidden'">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ t('forms.evidenceVideoUploadLabel') }}
          <span v-if="activeEvidenceRule.video.required === 'required'" class="text-red-500">*</span>
        </label>
        <input
          type="file"
          accept="video/*"
          @change="handleVideoUpload"
          :required="activeEvidenceRule.video.required === 'required'"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <div v-if="evidenceData.video" class="mt-2 text-xs text-gray-600 dark:text-gray-400">
          {{ t('forms.evidenceSelectedPrefix') }}
          {{ evidenceData.video.name || t('forms.evidenceVideoUploaded') }}
        </div>
        <div v-if="evidenceErrors.video" class="mt-1 text-xs text-red-600 dark:text-red-400">
          {{ evidenceErrors.video }}
        </div>
      </div>

      <!-- Validation Message -->
      <div v-if="hasEvidenceErrors" class="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
        {{ t('forms.evidenceAddRequiredHint') }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  question: {
    type: Object,
    required: true
  },
  value: {
    type: String,
    default: ''
  },
  form: {
    type: Object,
    default: null
  },
  formType: {
    type: String,
    default: 'audit'
  }
});

const emit = defineEmits(['update', 'evidence-update']);

const { t, locale } = useI18n();

const evidenceData = ref({
  comment: '',
  image: null,
  video: null
});

const evidenceErrors = ref({
  comment: '',
  image: '',
  video: ''
});

// Check if this is an Audit form
const isAuditForm = computed(() => {
  return (props.formType?.toLowerCase() === 'audit') || (props.form?.formType?.toLowerCase() === 'audit');
});

// Check if evidence is enabled and configured
const hasEvidenceConfig = computed(() => {
  return isAuditForm.value && 
         props.question.evidence?.enabled && 
         props.question.evidence?.rules?.length > 0;
});

// Find the active evidence rule based on current answer
const activeEvidenceRule = computed(() => {
  if (!hasEvidenceConfig.value || !props.value) return null;
  
  const rules = props.question.evidence.rules || [];
  return rules.find(rule => rule.when === props.value) || null;
});

// Show evidence inputs if answer is selected and rule exists
const showEvidence = computed(() => {
  return hasEvidenceConfig.value && props.value && activeEvidenceRule.value !== null;
});

function syncEvidenceErrors() {
  const rule = activeEvidenceRule.value;
  if (!rule) return;

  if (rule.comment.required === 'required' && !evidenceData.value.comment.trim()) {
    evidenceErrors.value.comment = t('forms.evidenceCommentRequired');
    return;
  }
  evidenceErrors.value.comment = '';

  if (rule.image.required === 'required' && !evidenceData.value.image) {
    evidenceErrors.value.image = t('forms.evidenceImageRequired');
    return;
  }
  evidenceErrors.value.image = '';

  if (rule.video.required === 'required' && !evidenceData.value.video) {
    evidenceErrors.value.video = t('forms.evidenceVideoRequired');
    return;
  }
  evidenceErrors.value.video = '';
}

watch(
  () => [
    activeEvidenceRule.value,
    evidenceData.value.comment,
    evidenceData.value.image,
    evidenceData.value.video,
    locale.value
  ],
  syncEvidenceErrors,
  { immediate: true }
);

const hasEvidenceErrors = computed(() =>
  Boolean(evidenceErrors.value.comment || evidenceErrors.value.image || evidenceErrors.value.video)
);

const handleAnswerChange = (answer) => {
  emit('update', answer);
  
  // Reset evidence data when answer changes
  evidenceData.value = {
    comment: '',
    image: null,
    video: null
  };
  evidenceErrors.value = {
    comment: '',
    image: '',
    video: ''
  };
  
  // Emit evidence update
  emit('evidence-update', {
    questionId: props.question.questionId,
    evidence: evidenceData.value
  });
};

const updateEvidence = (type, value) => {
  evidenceData.value[type] = value;
  
  // Clear error for this field
  evidenceErrors.value[type] = '';
  
  // Emit evidence update
  emit('evidence-update', {
    questionId: props.question.questionId,
    evidence: evidenceData.value
  });
};

const handleImageUpload = (event) => {
  const file = event.target.files[0];
  if (file) {
    evidenceData.value.image = file;
    evidenceErrors.value.image = '';
    
    // Emit evidence update
    emit('evidence-update', {
      questionId: props.question.questionId,
      evidence: evidenceData.value
    });
  }
};

const handleVideoUpload = (event) => {
  const file = event.target.files[0];
  if (file) {
    evidenceData.value.video = file;
    evidenceErrors.value.video = '';
    
    // Emit evidence update
    emit('evidence-update', {
      questionId: props.question.questionId,
      evidence: evidenceData.value
    });
  }
};

// Watch for value changes from parent
watch(() => props.value, (newValue) => {
  if (!newValue) {
    // Reset evidence when answer is cleared
    evidenceData.value = {
      comment: '',
      image: null,
      video: null
    };
  }
});
</script>
