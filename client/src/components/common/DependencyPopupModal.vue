<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.self="handleCancel"
      >
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
          <!-- Modal Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
              <p v-if="description" class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ description }}</p>
            </div>
            <button
              @click="handleCancel"
              class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Modal Body -->
          <div class="flex-1 overflow-y-auto p-6">
            <div v-if="loading" class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>

            <div v-else-if="fields.length === 0" class="text-center py-12">
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('common.dependencyNoFields') }}</p>
            </div>

            <div v-else class="space-y-4">
              <DynamicFormField
@picklist-option-created="onPicklistOptionCreated"
                v-for="field in fields"
                :key="field.key"
                :field="field"
                :value="formData[field.key]"
                @update:value="updateField(field.key, $event)"
                :errors="errors"
                :dependency-state="getFieldDependencyState(field, formData, allFields, { moduleKey: props.moduleKey })"
              />
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <button
              @click="handleCancel"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              @click="handleSave"
              :disabled="saving"
              class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {{ saving ? t('states.saving') : t('actions.save') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import DynamicFormField from './DynamicFormField.vue';
import { appendCreatedPicklistOption } from '@/utils/picklistInlineOptionCreate';
import { getFieldDependencyState } from '@/utils/dependencyEvaluation';

function onPicklistOptionCreated(payload) {
  appendCreatedPicklistOption(payload?.field, payload?.option);
}

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Update Fields'
  },
  description: {
    type: String,
    default: ''
  },
  fields: {
    type: Array,
    default: () => []
  },
  initialData: {
    type: Object,
    default: () => ({})
  },
  allFields: {
    type: Array,
    default: () => []
  },
  moduleKey: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close', 'save']);

const saving = ref(false);
const loading = ref(false);
const formData = ref({});
const errors = ref({});

// Helper function to get field value from record data (handles case-insensitive and populated fields)
const getFieldValue = (field, recordData) => {
  if (!recordData || !field || !field.key) {
    return field?.defaultValue !== undefined ? field.defaultValue : null;
  }
  
  const fieldKey = field.key;
  const fieldKeyLower = fieldKey.toLowerCase();
  
  // Try exact match first
  let value = recordData[fieldKey];
  
  // If not found, try case-insensitive match
  if (value === undefined) {
    const keys = Object.keys(recordData);
    const matchingKey = keys.find(k => k.toLowerCase() === fieldKeyLower);
    if (matchingKey) {
      value = recordData[matchingKey];
    }
  }
  
  // Handle populated lookup fields (objects with _id)
  if (value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value)) {
    // If it's a populated field, extract the _id
    if (value._id) {
      value = value._id;
    }
  }
  
  // Handle arrays - keep them as-is (for Multi-Picklist, etc.)
  // Arrays should already be in the correct format
  
  // If still no value, use default
  if (value === undefined || value === null) {
    value = field.defaultValue !== undefined ? field.defaultValue : null;
  }
  
  return value;
};

// Initialize form data when modal opens or fields change
watch([() => props.isOpen, () => props.fields, () => props.initialData], () => {
  if (props.isOpen && props.fields.length > 0) {
    // Initialize form data with current values from the record
    const initial = {};
    props.fields.forEach(field => {
      // Get value from initialData, handling case-insensitive keys and populated fields
      initial[field.key] = getFieldValue(field, props.initialData || {});
    });
    formData.value = { ...initial };
    errors.value = {};
  }
}, { immediate: true, deep: true });

const updateField = (fieldKey, value) => {
  formData.value[fieldKey] = value;
};

const handleCancel = () => {
  if (!saving.value) {
    emit('close');
  }
};

const handleSave = () => {
  saving.value = true;
  // Emit the updated form data
  emit('save', { ...formData.value });
  // Close modal after a short delay to show saving state
  setTimeout(() => {
    saving.value = false;
    emit('close');
  }, 300);
};
</script>

<style scoped>
/* Modal transition animations */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .bg-white,
.modal-leave-active .bg-white {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from .bg-white,
.modal-leave-to .bg-white {
  opacity: 0;
  transform: scale(0.95);
}
</style>

