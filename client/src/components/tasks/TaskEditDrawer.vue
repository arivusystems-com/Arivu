<template>
  <WorkspaceScopedDrawerShell
    :is-open="isOpen"
    draft-module-key="tasks"
    :draft-record-id="taskEditDraftRecordId"
    @backdrop="handleDialogClose"
    @escape="handleDialogClose"
  >
              <div
                :class="[
                  'rounded-tl-xl overflow-hidden flex h-full flex-col bg-white dark:bg-gray-800 shadow-xl w-screen max-w-full transition-[width] duration-200 ease-out',
                  fullMode ? 'sm:max-w-[60rem]' : 'sm:max-w-[30rem]'
                ]"
              >
                <form @submit.prevent="handleSubmit" class="rounded-none relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700">
                  <!-- Header -->
                  <div class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-6 sm:px-6 flex-shrink-0">
                    <div class="flex items-center justify-between">
                      <h2 class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{{ t('tasks.taskEditDrawerEditTask') }}</h2>
                      <button
                        type="button"
                        class="relative rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer"
                        @click="closeDrawer"
                      >
                        <span class="absolute -inset-2.5" />
                        <span class="sr-only">{{ t('forms.previewClosePanelSr') }}</span>
                        <XMarkIcon class="size-6" aria-hidden="true" />
                      </button>
                    </div>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('tasks.taskEditDrawerUpdateTheTaskInformationBelow') }}</p>
                  </div>

                  <!-- Body: scrollable -->
                  <div class="h-0 flex-1 overflow-y-auto">
                    <div v-if="loading" class="flex items-center justify-center py-12">
                      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                    </div>
                    <div v-else-if="loadError" class="p-4">
                      <p class="text-sm text-red-600 dark:text-red-400">{{ loadError }}</p>
                    </div>
                    <template v-else-if="moduleDefinition">
                      <div class="px-4 sm:px-6 py-6 space-y-6">
                        <!-- General error -->
                        <div v-if="errors._general" class="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                          <p class="text-sm text-red-800 dark:text-red-200">{{ errors._general }}</p>
                        </div>

                        <!-- Quick fields: single column in narrow drawer; 2-col grid in full mode -->
                        <div
                          :class="fullMode ? 'grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4' : 'space-y-4'"
                        >
                          <div
                            v-for="field in quickFields"
                            :key="field.key"
                            :class="[
                              'space-y-1',
                              field.key === 'description' ? 'w-full' : '',
                              fullMode && (field.key === 'description' || field.key === 'subtasks' || isLongInput(field)) ? 'md:col-span-2' : ''
                            ]"
                          >
                            <!-- Description: full width, TipTap editor -->
                            <template v-if="field.key === 'description'">
                              <label :for="`field-${field.key}`" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                                {{ getFieldDisplayLabel(field) || 'Description' }}
                                <span v-if="field.required" class="text-red-500">*</span>
                              </label>
                              <TaskDescriptionEditor
                                :model-value="formData[field.key] || ''"
                                :placeholder="t('tasks.taskEditDrawerWriteOrType')"
                                class="w-full"
                                @update:model-value="(v) => updateField(field.key, v)"
                              />
                              <p v-if="errors[field.key]" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ errors[field.key] }}</p>
                            </template>
                            <!-- Related To: combined type + lookup -->
                            <template v-else-if="field.key === 'relatedTo'">
                              <TaskRelatedToField
                                :model-value="normalizedRelatedTo(formData[field.key])"
                                :label="getFieldDisplayLabel(field) || 'Related To'"
                                :required="!!field.required"
                                :error="errors[field.key]"
                                @update:model-value="(v) => updateField(field.key, v)"
                              />
                            </template>
                            <DynamicFormField
@picklist-option-created="onPicklistOptionCreated"
                              v-else
                              :field="field"
                              :value="formData[field.key]"
                              @update:value="(v) => updateField(field.key, v)"
                              :errors="errors"
                              :dependency-state="getFieldState(field)"
                              :module-key="'tasks'"
                              :locked="false"
                            />
                          </div>

                          <!-- Subtasks: only in quick section when it is a quick create field -->
                          <div v-if="showSubtasksInForm" :class="['w-full', fullMode ? 'md:col-span-2' : '']">
                            <TaskSubtasksField
                              :model-value="formData.subtasks || []"
                              :label="t('common.taskSubtasksLabel')"
                              :error="errors.subtasks"
                              @update:model-value="(v) => updateField('subtasks', v)"
                            />
                          </div>
                        </div>

                        <!-- Full mode: divider + remaining in 2-col grid (config order, subtasks included) -->
                        <template v-if="fullMode">
                          <hr class="border-gray-200 dark:border-gray-700" />
                          <div
                            class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4"
                          >
                          <div
                            v-for="field in remainingFields"
                            :key="field.key"
                            :class="[
                              'space-y-1',
                              field.key === 'description' || field.key === 'subtasks' || isLongInput(field) ? 'md:col-span-2' : ''
                            ]"
                          >
                            <!-- Description: full width, TipTap editor -->
                            <template v-if="field.key === 'description'">
                              <label :for="`field-${field.key}`" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                                {{ getFieldDisplayLabel(field) || 'Description' }}
                                <span v-if="field.required" class="text-red-500">*</span>
                              </label>
                              <TaskDescriptionEditor
                                :model-value="formData[field.key] || ''"
                                :placeholder="t('tasks.taskEditDrawerWriteOrType')"
                                class="w-full"
                                @update:model-value="(v) => updateField(field.key, v)"
                              />
                              <p v-if="errors[field.key]" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ errors[field.key] }}</p>
                            </template>
                            <template v-else-if="field.key === 'relatedTo'">
                              <TaskRelatedToField
                                :model-value="normalizedRelatedTo(formData[field.key])"
                                :label="getFieldDisplayLabel(field) || 'Related To'"
                                :required="!!field.required"
                                :error="errors[field.key]"
                                @update:model-value="(v) => updateField(field.key, v)"
                              />
                            </template>
                            <template v-else-if="field.key === 'subtasks'">
                              <TaskSubtasksField
                                :model-value="formData.subtasks || []"
                                :label="t('common.taskSubtasksLabel')"
                                :error="errors.subtasks"
                                @update:model-value="(v) => updateField('subtasks', v)"
                              />
                            </template>
                            <DynamicFormField
@picklist-option-created="onPicklistOptionCreated"
                              v-else
                              :field="field"
                              :value="formData[field.key]"
                              @update:value="(v) => updateField(field.key, v)"
                              :errors="errors"
                              :dependency-state="getFieldState(field)"
                              :module-key="'tasks'"
                              :locked="false"
                            />
                          </div>
                          </div>
                        </template>
                      </div>
                    </template>
                  </div>

                  <!-- Footer: left toggle + right actions -->
                  <div class="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      class="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 cursor-pointer"
                      @click="toggleFullMode"
                    >
                      {{ fullMode ? 'Back to quick edit' : 'Show all fields' }}
                    </button>
                    <div class="flex gap-3">
                      <button
                        type="button"
                        class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        @click="closeDrawer"
                      >{{ t('performance.cancelWizard') }}</button>
                      <button
                        type="submit"
                        :disabled="saving"
                        class="inline-flex justify-center rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {{ saving ? 'Saving...' : 'Update' }}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
  </WorkspaceScopedDrawerShell>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import DynamicFormField from '@/components/common/DynamicFormField.vue';
import { appendCreatedPicklistOption } from '@/utils/picklistInlineOptionCreate';
import WorkspaceScopedDrawerShell from '@/components/common/WorkspaceScopedDrawerShell.vue';
import TaskDescriptionEditor from '@/components/record-page/TaskDescriptionEditor.vue';
import TaskRelatedToField from '@/components/tasks/TaskRelatedToField.vue';
import TaskSubtasksField from '@/components/tasks/TaskSubtasksField.vue';
import apiClient from '@/utils/apiClient';
import { fetchModuleDefinitionCached } from '@/utils/tenantSchemaApiCache';
import { getFieldDisplayLabel } from '@/utils/fieldDisplay';
import { getFieldDependencyState, applyPicklistDependencyValueClears } from '@/utils/dependencyEvaluation';
import { useAuthStore } from '@/stores/authRegistry';
import { getTaskFieldMetadata } from '@/platform/fields/taskFieldModel';
import { isSystemField as isSystemFieldFromEngine, canEditField } from '@/platform/fields/fieldCapabilityEngine';

function onPicklistOptionCreated(payload) {
  appendCreatedPicklistOption(payload?.field, payload?.option);
}

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  record: { type: Object, default: null }
});

const { t } = useI18n();

const emit = defineEmits(['close', 'saved']);

const authStore = useAuthStore();
const moduleDefinition = ref(null);
const loading = ref(true);
const loadError = ref(null);
const formData = ref({});
const errors = ref({});
const saving = ref(false);
const fullMode = ref(false);
const taskEditDraftRecordId = computed(() => {
  const id = props.record?._id || props.record?.id;
  return id != null ? String(id) : null;
});

// Simple rule: always exclude system fields from the edit drawer
const quickCreateKeysSet = computed(() => {
  const qc = moduleDefinition.value?.quickCreate || [];
  const set = new Set(qc.map(k => String(k).toLowerCase().trim()).filter(Boolean));
  if (set.has('relatedtotype') || set.has('relatedtoid')) set.add('relatedto');
  return set;
});

function isTaskSystemField(keyOrField) {
  const field = typeof keyOrField === 'string' ? { key: keyOrField } : keyOrField;
  return field?.key ? isSystemFieldFromEngine('tasks', field) : false;
}

function isEditableField(field) {
  if (!field?.key) return false;
  return canEditField('tasks', field);
}

const allEditableFields = computed(() => {
  const mod = moduleDefinition.value;
  if (!mod?.fields) return [];
  const all = (mod.fields || []).filter((f) => {
    if (!f?.key) return false;
    if (isTaskSystemField(f.key)) return false;
    return isEditableField(f);
  });
  const form = formData.value || {};
  let list = all.filter((f) => {
    if (f.dependencies?.length) {
      const state = getFieldDependencyState(f, form, mod.fields || [], {
        currentUser: authStore.user,
        moduleKey: 'tasks',
      });
      return state.visible !== false;
    }
    return true;
  });
  const hasRelatedTo = list.some((f) => String(f.key).toLowerCase() === 'relatedto');
  if (!hasRelatedTo) {
    list = [...list, { key: 'relatedTo', label: 'Related To', required: false }];
  }
  const hasSubtasks = list.some((f) => String(f.key).toLowerCase() === 'subtasks');
  if (!hasSubtasks) {
    list = [...list, { key: 'subtasks', label: 'Subtasks', required: false, order: 999 }];
  }
  list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return list;
});

const quickFields = computed(() => {
  const mod = moduleDefinition.value;
  if (!mod?.fields) return [];
  const qc = mod.quickCreate || [];
  const qcSet = quickCreateKeysSet.value;
  const requiredKeys = new Set(
    (mod.fields || [])
      .filter((f) => f.required && isEditableField(f) && !isTaskSystemField(f.key))
      .map((f) => f.key?.toLowerCase())
      .filter(Boolean)
  );
  const quickKeys = new Set(qcSet);
  requiredKeys.forEach((k) => quickKeys.add(k));
  const allEditable = allEditableFields.value;
  const byKey = new Map(allEditable.map((f) => [f.key?.toLowerCase(), f]));
  const seen = new Set();
  const result = [];
  for (const key of qc) {
    const keyLower = String(key).toLowerCase().trim();
    if (!keyLower || seen.has(keyLower) || isTaskSystemField(key) || keyLower === 'subtasks') continue;
    const field = byKey.get(keyLower);
    if (field && quickKeys.has(keyLower)) {
      result.push(field);
      seen.add(keyLower);
    }
  }
  for (const key of requiredKeys) {
    if (seen.has(key) || isTaskSystemField(key) || key === 'subtasks') continue;
    if (key?.toLowerCase() === 'relatedto' && !showRelatedToInForm.value) continue;
    const field = byKey.get(key);
    if (field) {
      result.push(field);
      seen.add(key);
    }
  }
  return result;
});

const remainingFields = computed(() => {
  const quickSet = new Set(quickFields.value.map((f) => f.key?.toLowerCase()));
  return allEditableFields.value.filter((f) => {
    const keyLower = f.key?.toLowerCase();
    if (quickSet.has(keyLower) || isTaskSystemField(f.key)) return false;
    return true;
  });
});

const quickCreateKeys = computed(() => {
  const qc = moduleDefinition.value?.quickCreate || [];
  return new Set(qc.map((k) => String(k).toLowerCase().trim()).filter(Boolean));
});

const showRelatedToInForm = computed(() => quickCreateKeys.value.has('relatedto'));
const showSubtasksInForm = computed(() => quickCreateKeys.value.has('subtasks'));

function isLongInput(field) {
  if (!field) return false;
  const t = (field.dataType || '').toLowerCase();
  return t === 'text-area' || t === 'rich text' || t === 'image';
}

function getFieldState(field) {
  if (!field?.dependencies?.length) {
    return { readonly: false, required: !!field?.required, allowedOptions: null, label: null, lookupQuery: null, setValue: null };
  }
  return getFieldDependencyState(
    field,
    formData.value,
    moduleDefinition.value?.fields || [],
    { currentUser: authStore.user, moduleKey: 'tasks' }
  );
}

watch(
  () => [formData.value, moduleDefinition.value?.fields],
  () => {
    const fields = moduleDefinition.value?.fields || [];
    const cleared = applyPicklistDependencyValueClears(fields, formData.value, {
      currentUser: authStore.user,
      moduleKey: 'tasks',
    });
    if (cleared) formData.value = cleared;
  },
  { deep: true }
);

function updateField(key, value) {
  formData.value = { ...formData.value, [key]: value };
}

function normalizedRelatedTo(val) {
  if (!val || typeof val !== 'object') return { type: 'none', id: null };
  const id = val.id != null && typeof val.id === 'object' && val.id._id != null ? val.id._id : (val.id || null);
  return { type: val.type || 'none', id };
}

function closeDrawer() {
  if (!saving.value) {
    fullMode.value = false;
    emit('close');
    setTimeout(() => {
      formData.value = {};
      errors.value = {};
    }, 300);
  }
}

function handleDialogClose() {
  if (saving.value) return;
  closeDrawer();
}

function toggleFullMode() {
  fullMode.value = !fullMode.value;
}

async function fetchModule() {
  loading.value = true;
  loadError.value = null;
  try {
    const mod = await fetchModuleDefinitionCached('tasks');
    if (!mod) {
      loadError.value = 'Tasks module not found';
      return;
    }
    if (!mod.quickCreate) mod.quickCreate = [];
    moduleDefinition.value = mod;
  } catch (e) {
    loadError.value = e?.message || 'Failed to load module';
  } finally {
    loading.value = false;
  }
}

function initializeForm() {
  const mod = moduleDefinition.value;
  const rec = props.record;
  if (!mod) return;
  const initial = {};
  (mod.fields || []).forEach(f => {
    if (f.defaultValue !== null && f.defaultValue !== undefined) {
      initial[f.key] = f.defaultValue;
    } else if (f.dataType === 'Multi-Picklist' || f.key === 'tags') {
      initial[f.key] = [];
    } else if (f.dataType === 'Checkbox') {
      initial[f.key] = false;
    } else {
      initial[f.key] = '';
    }
  });
  if (rec) {
    const recordData = { ...rec };
    Object.keys(recordData).forEach(key => {
      if (key === 'relatedTo') return;
      const v = recordData[key];
      if (v && typeof v === 'object' && !Array.isArray(v) && v._id) recordData[key] = v._id;
    });
    if (recordData.relatedTo && typeof recordData.relatedTo === 'object') {
      const rt = recordData.relatedTo;
      recordData.relatedTo = {
        type: rt.type || 'none',
        id: rt.id && typeof rt.id === 'object' && rt.id._id ? rt.id._id : (rt.id || null)
      };
    } else if (recordData.relatedToType != null || recordData.relatedToId != null) {
      recordData.relatedTo = {
        type: recordData.relatedToType || 'none',
        id: recordData.relatedToId && typeof recordData.relatedToId === 'object' && recordData.relatedToId._id
          ? recordData.relatedToId._id
          : (recordData.relatedToId ?? null)
      };
    }
    (mod.fields || []).forEach(f => {
      if (f.dataType === 'Multi-Picklist') {
        const v = recordData[f.key];
        if (v !== null && v !== undefined && !Array.isArray(v)) recordData[f.key] = [v].filter(Boolean);
        else if (v == null) recordData[f.key] = [];
      }
    });
    Object.assign(initial, recordData);
  }
  formData.value = { ...initial };
}

watch([() => props.isOpen, () => props.record], async ([open, record]) => {
  if (!open) return;
  fullMode.value = false;
  await fetchModule();
  if (moduleDefinition.value && record) {
    initializeForm();
  }
}, { immediate: true });

watch(() => [moduleDefinition.value, props.record], () => {
  if (moduleDefinition.value && props.record) initializeForm();
}, { deep: true });

watch(() => formData.value, () => {
  Object.keys(errors.value).forEach(key => {
    if (key === '_general') return;
    const v = formData.value[key];
    const empty = v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
    if (!empty && errors.value[key]) {
      const next = { ...errors.value };
      delete next[key];
      errors.value = next;
    }
  });
}, { deep: true });

async function handleSubmit() {
  errors.value = {};
  saving.value = true;
  try {
    const mod = moduleDefinition.value;
    const allFields = mod?.fields || [];
    const requiredFields = allFields.filter(f => {
      if (!f.key || isTaskSystemField(f.key)) return false;
      const state = getFieldDependencyState(f, formData.value, allFields, { moduleKey: 'tasks' });
      return state.required === true && state.visible !== false;
    });
    for (const field of requiredFields) {
      const v = formData.value[field.key];
      const empty = v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
      if (empty) {
        errors.value[field.key] = `${getFieldDisplayLabel(field) || field.key} is required`;
      }
    }
    if (Object.keys(errors.value).length > 0) {
      saving.value = false;
      return;
    }

    const standardKeys = [
      'title', 'description', 'relatedTo', 'projectId', 'assignedTo',
      'status', 'priority', 'dueDate', 'startDate', 'completedDate',
      'estimatedHours', 'actualHours', 'subtasks', 'tags', 'reminderDate'
    ];
    const moduleFieldKeys = (allFields || []).map((f) => f?.key).filter(Boolean);
    const allowedUpdates = [...new Set([...standardKeys, ...moduleFieldKeys])].filter(
      (key) => !isTaskSystemField(key)
    );
    const raw = { ...formData.value };
    const normId = (v) => (v && typeof v === 'object' && v._id != null) ? v._id : v;
    const payload = {};
    for (const key of allowedUpdates) {
      if (raw[key] === undefined) continue;
      let value = raw[key];
      if (key === 'relatedTo') {
        value = normalizedRelatedTo(value);
        if (value.type === 'none') value = { type: 'none', id: null };
        else value = { type: value.type, id: normId(value.id) || null };
      } else if (key === 'assignedTo' || key === 'projectId') {
        value = normId(value);
      }
      if (key === 'tags' && !Array.isArray(value)) {
        value = value == null || value === '' ? [] : [value];
      }
      if (key === 'subtasks' && !Array.isArray(value)) {
        value = value == null ? [] : value;
      }
      if (value === '') value = null;
      payload[key] = value;
    }
    const neverSendKeys = ['_id', '__v', 'createdAt', 'updatedAt', 'createdBy', 'organizationId', 'organizationid'];
    neverSendKeys.forEach((k) => delete payload[k]);
    Object.keys(payload).forEach((k) => {
      if (isTaskSystemField(k)) delete payload[k];
    });
    if (payload.status === undefined || payload.status === null || payload.status === '') {
      payload.status = 'todo';
    }

    const id = props.record?._id;
    if (!id) {
      errors.value._general = 'Task ID missing';
      saving.value = false;
      return;
    }

    const response = await apiClient.put(`/tasks/${id}`, payload);
    if (response.success || response.data) {
      saving.value = false;
      emit('saved', response.data || response);
      closeDrawer();
    } else {
      const msg = response.message || response.errors?.[0] || 'Update failed';
      errors.value._general = typeof msg === 'string' ? msg : 'Update failed';
    }
  } catch (e) {
    errors.value._general = e?.response?.data?.message || e?.message || 'Update failed';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
/* Cursor pointer for clickable elements inside the drawer (including DynamicFormField content) */
form :deep(button:not(:disabled)),
form :deep([role="button"]:not([aria-disabled="true"])),
form :deep(a),
form :deep(select),
form :deep(input[type="radio"]),
form :deep(label) {
  cursor: pointer;
}
</style>
