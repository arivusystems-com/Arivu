<template>
  <WorkspaceScopedDrawerShell
    :is-open="isOpen"
    panel-offset-class="pl-10 sm:pl-16"
    :draft-module-key="moduleKey || 'mass-edit'"
    @backdrop="handleDialogClose"
    @escape="handleDialogClose"
  >
                <div class="rounded-tl-xl overflow-hidden pointer-events-auto flex h-full w-[32rem] max-w-[95vw] flex-col bg-white shadow-xl dark:bg-gray-800">
                  <form class="flex h-full flex-col" @submit.prevent="handleSubmit">
                    <div class="flex-shrink-0 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-6 sm:px-6">
                      <div class="flex items-center justify-between">
                        <h2 class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                          {{ drawerTitle }}
                        </h2>
                        <button
                          ref="closeButtonRef"
                          type="button"
                          class="relative rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer"
                          @click="closeDrawer"
                        >
                          <span class="absolute -inset-2.5" />
                          <span class="sr-only">{{ t('common.closePanel') }}</span>
                          <XMarkIcon class="size-6" aria-hidden="true" />
                        </button>
                      </div>
                      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {{ drawerDescription }}
                      </p>
                    </div>

                    <div class="h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                      <div v-if="loading" class="flex justify-center py-16">
                        <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
                      </div>

                      <div v-else-if="editableFields.length === 0" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
                        {{ t('common.massEditNoEditableFields') }}
                      </div>

                      <template v-else>
                        <div class="mb-4">
                          <label class="sr-only" for="mass-edit-field-search">{{ t('common.massEditSearchFields') }}</label>
                          <div class="relative">
                            <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                            <input
                              id="mass-edit-field-search"
                              v-model="fieldSearch"
                              type="search"
                              class="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                              :placeholder="t('common.massEditSearchFields')"
                            />
                          </div>
                        </div>

                        <div class="space-y-3">
                          <div
                            v-for="field in filteredFields"
                            :key="field.key"
                            class="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                            :class="enabledFields[field.key] ? 'border-indigo-300 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-950/20' : ''"
                          >
                            <label class="flex cursor-pointer items-start gap-3">
                              <HeadlessCheckbox
                                :model-value="!!enabledFields[field.key]"
                                class="mt-0.5"
                                @update:model-value="(checked) => toggleField(field.key, checked)"
                              />
                              <span class="min-w-0 flex-1">
                                <span class="text-sm font-medium text-gray-900 dark:text-white">
                                  {{ resolveFieldLabel(field) }}
                                </span>
                                <span
                                  v-if="isHighImpactField(field.key)"
                                  class="ml-2 text-xs font-medium text-amber-700 dark:text-amber-300"
                                >
                                  {{ t('common.massEditHighImpact') }}
                                </span>
                              </span>
                            </label>

                            <div v-if="enabledFields[field.key]" class="mt-3 pl-7">
                              <DynamicFormField
@picklist-option-created="onPicklistOptionCreated"
                                :field="{ ...field, label: '' }"
                                :value="fieldValues[field.key]"
                                :module-key="moduleKey"
                                :errors="fieldErrors"
                                @update:value="(val) => setFieldValue(field.key, val)"
                              />
                            </div>
                          </div>
                        </div>
                      </template>

                      <p v-if="submitError" class="mt-4 text-sm text-red-600 dark:text-red-400">
                        {{ submitError }}
                      </p>
                    </div>

                    <div class="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-800">
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        {{ reviewHint }}
                      </p>
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                          @click="closeDrawer"
                        >
                          {{ t('actions.cancel') }}
                        </button>
                        <button
                          type="submit"
                          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                          :disabled="!canSubmit || submitting"
                        >
                          {{ submitting ? t('common.massEditUpdating') : submitLabel }}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
  </WorkspaceScopedDrawerShell>
</template>

<script setup>
import { ref, computed, watch, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import DynamicFormField from '@/components/common/DynamicFormField.vue';
import { appendCreatedPicklistOption } from '@/utils/picklistInlineOptionCreate';
import WorkspaceScopedDrawerShell from '@/components/common/WorkspaceScopedDrawerShell.vue';
import { fetchModuleDefinitionCached } from '@/utils/tenantSchemaApiCache';
import { getMassEditableFields } from '@/utils/massEditFieldPolicy';
import { getFieldDisplayLabel } from '@/utils/fieldDisplay';
import { resolveFieldLabel as resolveModuleFieldLabel } from '@/utils/fieldLabelResolver';

function onPicklistOptionCreated(payload) {
  appendCreatedPicklistOption(payload?.field, payload?.option);
}

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  moduleKey: { type: String, required: true },
  selectionCount: { type: Number, default: 0 },
  moduleTitle: { type: String, default: '' },
});

const emit = defineEmits(['close', 'submit']);

const { t, te } = useI18n();

const closeButtonRef = ref(null);
const loading = ref(false);
const submitting = ref(false);
const submitError = ref('');
const fieldSearch = ref('');
const moduleFields = ref([]);
const enabledFields = reactive({});
const fieldValues = reactive({});
const fieldErrors = reactive({});

const editableFields = computed(() =>
  getMassEditableFields(props.moduleKey, moduleFields.value)
);

const filteredFields = computed(() => {
  const q = fieldSearch.value.trim().toLowerCase();
  if (!q) return editableFields.value;
  return editableFields.value.filter((field) => {
    const label = resolveFieldLabel(field).toLowerCase();
    const key = String(field.key || '').toLowerCase();
    return label.includes(q) || key.includes(q);
  });
});

const activeFieldKeys = computed(() =>
  Object.keys(enabledFields).filter((key) => enabledFields[key])
);

const canSubmit = computed(() => activeFieldKeys.value.length > 0 && !loading.value);

const drawerTitle = computed(() =>
  t('common.massEditTitle', { count: props.selectionCount })
);

const drawerDescription = computed(() =>
  t('common.massEditDescription', {
    count: props.selectionCount,
    module: props.moduleTitle || props.moduleKey,
  })
);

const submitLabel = computed(() =>
  t('common.massEditSubmit', { count: props.selectionCount })
);

const reviewHint = computed(() => {
  const count = activeFieldKeys.value.length;
  if (!count) return t('common.massEditSelectFieldHint');
  return t('common.massEditReviewHint', { fields: count, count: props.selectionCount });
});

function resolveFieldLabel(field) {
  const localized = resolveModuleFieldLabel(props.moduleKey, field, t, te);
  if (localized) return localized;
  return getFieldDisplayLabel(field);
}

function isHighImpactField(key) {
  const normalized = String(key || '').toLowerCase();
  return ['owner', 'assignedto', 'assignedto', 'assigned_to', 'case_owner_id'].includes(normalized);
}

function resetState() {
  submitError.value = '';
  fieldSearch.value = '';
  Object.keys(enabledFields).forEach((key) => { delete enabledFields[key]; });
  Object.keys(fieldValues).forEach((key) => { delete fieldValues[key]; });
  Object.keys(fieldErrors).forEach((key) => { delete fieldErrors[key]; });
}

async function loadModuleFields() {
  loading.value = true;
  try {
    const mod = await fetchModuleDefinitionCached(props.moduleKey);
    moduleFields.value = Array.isArray(mod?.fields) ? mod.fields : [];
  } catch (error) {
    console.error('[MassEditDrawer] Failed to load module fields:', error);
    moduleFields.value = [];
    submitError.value = t('common.massEditLoadFieldsFailed');
  } finally {
    loading.value = false;
  }
}

function toggleField(key, checked) {
  enabledFields[key] = checked;
  if (!checked) {
    delete fieldValues[key];
    delete fieldErrors[key];
    return;
  }
  if (fieldValues[key] === undefined) {
    fieldValues[key] = null;
  }
}

function setFieldValue(key, value) {
  fieldValues[key] = value;
  delete fieldErrors[key];
}

function buildUpdatesPayload() {
  const updates = {};
  for (const key of activeFieldKeys.value) {
    if (Object.prototype.hasOwnProperty.call(fieldValues, key)) {
      updates[key] = fieldValues[key];
    }
  }
  return updates;
}

function handleSubmit() {
  submitError.value = '';
  const updates = buildUpdatesPayload();
  if (Object.keys(updates).length === 0) {
    submitError.value = t('common.massEditSelectFieldHint');
    return;
  }
  submitting.value = true;
  emit('submit', updates);
}

function closeDrawer() {
  emit('close');
}

function handleDialogClose() {
  if (!submitting.value) closeDrawer();
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      resetState();
      void loadModuleFields();
    } else {
      submitting.value = false;
    }
  }
);

defineExpose({
  setSubmitting(value) {
    submitting.value = Boolean(value);
  },
  setSubmitError(message) {
    submitError.value = message || '';
    submitting.value = false;
  },
});
</script>
