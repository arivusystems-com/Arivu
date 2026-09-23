<template>
  <div class="space-y-6">
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
    
    <!-- Error state -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
    </div>
    
    <!-- Form content -->
    <template v-else-if="moduleDefinition">
    <!-- Advanced Layout Mode (Grid-based) -->
    <template v-if="useAdvancedLayout && layout && layout.rows && layout.rows.length > 0">
      <div v-for="(row, ri) in layout.rows" :key="ri" class="grid grid-cols-12 gap-4">
        <div 
          v-for="(col, ci) in row.cols" 
          :key="ci"
          :class="getSpanClass(col.span)"
          :data-field-key="col.fieldKey || ''"
          v-if="col.fieldKey && getFieldByKey(col.fieldKey) && shouldShowField(getFieldByKey(col.fieldKey))"
        >
          <template v-if="props.moduleKey === 'tasks' && col.fieldKey === 'description'">
            <label :for="`field-${col.fieldKey}`" class="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1.5">
              {{ getFieldDisplayLabel(getFieldByKey(col.fieldKey)) || t('common.taskDescriptionFallback') }}
              <span v-if="getFieldByKey(col.fieldKey)?.required" class="text-red-500">*</span>
            </label>
            <TaskDescriptionEditor
              :model-value="localFormData[col.fieldKey] || ''"
              :placeholder="t('common.taskDescriptionPlaceholder')"
              class="w-full"
              @update:model-value="(v) => updateField(col.fieldKey, v)"
            />
            <p v-if="errors[col.fieldKey]" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ errors[col.fieldKey] }}</p>
          </template>
          <DynamicFormField
            v-else
            :field="getFieldByKey(col.fieldKey)"
            :value="localFormData[col.fieldKey]"
            @update:value="updateField(col.fieldKey, $event)"
            :currency-code="getCurrencyCodeForField(getFieldByKey(col.fieldKey))"
            :currency-code-editable="Boolean(resolveCurrencyCompanionFieldKey(getFieldByKey(col.fieldKey)))"
            @update:currency-code="updateCurrencyCodeForField(getFieldByKey(col.fieldKey), $event)"
            :errors="errors"
            :dependency-state="getFieldState(getFieldByKey(col.fieldKey))"
            :locked="props.lockedFields.includes(col.fieldKey)"
            :module-key="props.moduleKey"
            :form-context="localFormData"
            @update:form-context="applyFormContextPatch"
            :salutation-value="localFormData.salutation ?? ''"
            :salutation-options="peopleSalutationOptions"
            @update:salutation-value="onSalutationFieldUpdate"
          />
        </div>
      </div>
    </template>
    
    <!-- Simple Mode (List-based) -->
    <template v-else>
      <!-- Full mode: Field Configuration sections + composite slots -->
      <template v-if="useFieldLayoutFullForm">
        <div class="flex flex-col gap-8">
          <template v-for="(block, blockIdx) in createSurfaceBlocks" :key="block.type === 'fields' ? `fields-${block.sectionId}` : `composite-${block.id}`">
            <CreateDrawerCollapsibleSection
              v-if="block.type === 'fields'"
              :title="block.label"
              :storage-key="createSectionStorageKey(block.sectionId)"
              :default-open="true"
              content-class="space-y-3"
            >
              <div :class="['grid gap-4', props.singleColumn ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2']">
                <div
                  v-for="field in block.fields"
                  :key="field.key"
                  :class="fieldGridCellClass(field)"
                  :data-field-key="field.key"
                >
                  <template v-if="props.moduleKey === 'tasks' && field.key === 'description'">
                    <label :for="`field-${field.key}`" class="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1.5">
                      {{ getFieldDisplayLabel(field) || t('common.taskDescriptionFallback') }}
                      <span v-if="field.required" class="text-red-500">*</span>
                    </label>
                    <TaskDescriptionEditor
                      :model-value="localFormData[field.key] || ''"
                      :placeholder="t('common.taskDescriptionPlaceholder')"
                      class="w-full"
                      @update:model-value="(v) => updateField(field.key, v)"
                    />
                    <p v-if="errors[field.key]" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ errors[field.key] }}</p>
                  </template>
                  <template v-else-if="props.moduleKey === 'tasks' && field.key === 'relatedTo'">
                    <TaskRelatedToField
                      :model-value="normalizedRelatedTo(localFormData[field.key])"
                      :label="getFieldDisplayLabel(field) || t('common.taskRelatedToFallback')"
                      :required="!!field.required"
                      :error="errors[field.key]"
                      @update:model-value="(v) => updateField(field.key, v)"
                    />
                  </template>
                  <template v-else-if="props.moduleKey === 'tasks' && field.key === 'subtasks'">
                    <TaskSubtasksField
                      :model-value="localFormData.subtasks || []"
                      :label="t('common.taskSubtasksLabel')"
                      :error="errors.subtasks"
                      @update:model-value="(v) => updateField('subtasks', v)"
                    />
                  </template>
                  <DynamicFormField
                    v-else
                    :field="field"
                    :value="localFormData[field.key]"
                    @update:value="updateField(field.key, $event)"
                    :currency-code="getCurrencyCodeForField(field)"
                    :currency-code-editable="Boolean(resolveCurrencyCompanionFieldKey(field))"
                    @update:currency-code="updateCurrencyCodeForField(field, $event)"
                    :errors="errors"
                    :dependency-state="getFieldState(field)"
                    :locked="props.lockedFields.includes(field.key)"
                    :module-key="props.moduleKey"
                    :form-context="localFormData"
                    @update:form-context="applyFormContextPatch"
                    :salutation-value="localFormData.salutation ?? ''"
                    :salutation-options="peopleSalutationOptions"
                    @update:salutation-value="onSalutationFieldUpdate"
                  />
                </div>
              </div>
            </CreateDrawerCollapsibleSection>
            <div v-else-if="block.type === 'composite'">
              <slot v-if="block.id === 'lines'" name="lines">
                <slot name="after-quick-create" />
              </slot>
              <slot v-else-if="block.id === 'app_participation'" name="app_participation" />
              <slot v-else-if="block.id === 'deal_relationships'" name="deal_relationships" />
              <slot v-else-if="block.id === 'vendor_catalog'" name="vendor_catalog" />
            </div>
          </template>
          <!-- Inventory / specialty panels that are not field-layout composites -->
          <div v-if="showLegacyAfterQuickCreateSlot">
            <slot name="after-quick-create" />
          </div>
        </div>
      </template>
      <!-- Quick create first layout: quick fields at top, divider, remaining in 2-col (like edit drawer) -->
      <template v-else-if="useQuickCreateFirstLayout">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div
            v-for="field in quickCreateFields"
            :key="field.key"
            :class="[
              'space-y-1',
              field.key === 'description' ? 'w-full' : '',
              (field.dataType === 'Text-Area' || field.dataType === 'Rich Text' || field.dataType === 'Image' || (props.moduleKey === 'tasks' && (field.key === 'description' || field.key === 'subtasks'))) ? 'md:col-span-2' : ''
            ]"
            :data-field-key="field.key"
          >
            <template v-if="props.moduleKey === 'tasks' && field.key === 'description'">
              <label :for="`field-${field.key}`" class="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1.5">
                {{ getFieldDisplayLabel(field) || t('common.taskDescriptionFallback') }}
                <span v-if="field.required" class="text-red-500">*</span>
              </label>
              <TaskDescriptionEditor
                :model-value="localFormData[field.key] || ''"
                :placeholder="t('common.taskDescriptionPlaceholder')"
                class="w-full"
                @update:model-value="(v) => updateField(field.key, v)"
              />
              <p v-if="errors[field.key]" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ errors[field.key] }}</p>
            </template>
            <template v-else-if="props.moduleKey === 'tasks' && field.key === 'relatedTo'">
              <TaskRelatedToField
                :model-value="normalizedRelatedTo(localFormData[field.key])"
                :label="getFieldDisplayLabel(field) || t('common.taskRelatedToFallback')"
                :required="!!field.required"
                :error="errors[field.key]"
                @update:model-value="(v) => updateField(field.key, v)"
              />
            </template>
            <template v-else-if="props.moduleKey === 'tasks' && field.key === 'subtasks'">
              <TaskSubtasksField
                :model-value="localFormData.subtasks || []"
                :label="t('common.taskSubtasksLabel')"
                :error="errors.subtasks"
                @update:model-value="(v) => updateField('subtasks', v)"
              />
            </template>
            <DynamicFormField
              v-else
              :field="field"
              :value="localFormData[field.key]"
              @update:value="updateField(field.key, $event)"
              :currency-code="getCurrencyCodeForField(field)"
              :currency-code-editable="Boolean(resolveCurrencyCompanionFieldKey(field))"
              @update:currency-code="updateCurrencyCodeForField(field, $event)"
              :errors="errors"
              :dependency-state="getFieldState(field)"
              :locked="props.lockedFields.includes(field.key)"
              :module-key="props.moduleKey"
              :form-context="localFormData"
              @update:form-context="applyFormContextPatch"
              :salutation-value="localFormData.salutation ?? ''"
              :salutation-options="peopleSalutationOptions"
              @update:salutation-value="onSalutationFieldUpdate"
            />
          </div>
        </div>
        <slot name="after-quick-create" />
        <div
          v-if="remainingFields.length"
          class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4"
        >
          <div
            v-for="field in remainingFields"
            :key="field.key"
            :class="[
              'space-y-1',
              (field.dataType === 'Text-Area' || field.dataType === 'Rich Text' || field.dataType === 'Image' || (props.moduleKey === 'tasks' && (field.key === 'description' || field.key === 'subtasks'))) ? 'md:col-span-2' : ''
            ]"
            :data-field-key="field.key"
          >
            <template v-if="props.moduleKey === 'tasks' && field.key === 'description'">
              <label :for="`field-${field.key}`" class="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1.5">
                {{ getFieldDisplayLabel(field) || t('common.taskDescriptionFallback') }}
                <span v-if="field.required" class="text-red-500">*</span>
              </label>
              <TaskDescriptionEditor
                :model-value="localFormData[field.key] || ''"
                :placeholder="t('common.taskDescriptionPlaceholder')"
                class="w-full"
                @update:model-value="(v) => updateField(field.key, v)"
              />
              <p v-if="errors[field.key]" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ errors[field.key] }}</p>
            </template>
            <template v-else-if="props.moduleKey === 'tasks' && field.key === 'relatedTo'">
              <TaskRelatedToField
                :model-value="normalizedRelatedTo(localFormData[field.key])"
                :label="getFieldDisplayLabel(field) || t('common.taskRelatedToFallback')"
                :required="!!field.required"
                :error="errors[field.key]"
                @update:model-value="(v) => updateField(field.key, v)"
              />
            </template>
            <template v-else-if="props.moduleKey === 'tasks' && field.key === 'subtasks'">
              <TaskSubtasksField
                :model-value="localFormData.subtasks || []"
                :label="t('common.taskSubtasksLabel')"
                :error="errors.subtasks"
                @update:model-value="(v) => updateField('subtasks', v)"
              />
            </template>
            <DynamicFormField
              v-else
              :field="field"
              :value="localFormData[field.key]"
              @update:value="updateField(field.key, $event)"
              :currency-code="getCurrencyCodeForField(field)"
              :currency-code-editable="Boolean(resolveCurrencyCompanionFieldKey(field))"
              @update:currency-code="updateCurrencyCodeForField(field, $event)"
              :errors="errors"
              :dependency-state="getFieldState(field)"
              :locked="props.lockedFields.includes(field.key)"
              :module-key="props.moduleKey"
              :form-context="localFormData"
              @update:form-context="applyFormContextPatch"
              :salutation-value="localFormData.salutation ?? ''"
              :salutation-options="peopleSalutationOptions"
              @update:salutation-value="onSalutationFieldUpdate"
            />
          </div>
        </div>
      </template>
      <!-- Default: single or 2-col grid -->
      <div v-else :class="['grid gap-4', props.singleColumn ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2']">
        <div 
          v-for="field in displayOrderedFields" 
          :key="field.key"
          :class="[
            (field.dataType === 'Text-Area' || field.dataType === 'Rich Text' || field.dataType === 'Image' || (props.moduleKey === 'tasks' && field.key === 'description')) && !props.singleColumn ? 'md:col-span-2' : '',
            props.moduleKey === 'tasks' && field.key === 'description' ? 'w-full' : ''
          ]"
          :data-field-key="field.key"
        >
          <!-- Task description: full-width TipTap editor (same as edit drawer) -->
          <template v-if="props.moduleKey === 'tasks' && field.key === 'description'">
            <label :for="`field-${field.key}`" class="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1.5">
              {{ getFieldDisplayLabel(field) || t('common.taskDescriptionFallback') }}
              <span v-if="field.required" class="text-red-500">*</span>
            </label>
            <TaskDescriptionEditor
              :model-value="localFormData[field.key] || ''"
              :placeholder="t('common.taskDescriptionPlaceholder')"
              class="w-full"
              @update:model-value="(v) => updateField(field.key, v)"
            />
            <p v-if="errors[field.key]" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ errors[field.key] }}</p>
          </template>
          <template v-else-if="props.moduleKey === 'tasks' && field.key === 'relatedTo'">
            <TaskRelatedToField
              :model-value="normalizedRelatedTo(localFormData[field.key])"
              :label="getFieldDisplayLabel(field) || t('common.taskRelatedToFallback')"
              :required="!!field.required"
              :error="errors[field.key]"
              @update:model-value="(v) => updateField(field.key, v)"
            />
          </template>
          <template v-else-if="props.moduleKey === 'tasks' && field.key === 'subtasks'">
            <TaskSubtasksField
              :model-value="localFormData.subtasks || []"
              :label="t('common.taskSubtasksLabel')"
              :error="errors.subtasks"
              @update:model-value="(v) => updateField('subtasks', v)"
            />
          </template>
          <DynamicFormField
            v-else
            :field="field"
            :value="localFormData[field.key]"
            @update:value="updateField(field.key, $event)"
            :currency-code="getCurrencyCodeForField(field)"
            :currency-code-editable="Boolean(resolveCurrencyCompanionFieldKey(field))"
            @update:currency-code="updateCurrencyCodeForField(field, $event)"
            :errors="errors"
            :dependency-state="getFieldState(field)"
            :locked="props.lockedFields.includes(field.key)"
            :module-key="props.moduleKey"
            :form-context="localFormData"
            @update:form-context="applyFormContextPatch"
            :salutation-value="localFormData.salutation ?? ''"
            :salutation-options="peopleSalutationOptions"
            @update:salutation-value="onSalutationFieldUpdate"
          />
        </div>
        <slot name="after-quick-create" />
      </div>
    </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, defineAsyncComponent, useSlots } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import DynamicFormField from './DynamicFormField.vue';
import CreateDrawerCollapsibleSection from './CreateDrawerCollapsibleSection.vue';

// Lazy-load to avoid circular chunk-settings ↔ record-activity init (production TDZ on _export_sfc).
const TaskDescriptionEditor = defineAsyncComponent(
  () => import('@/components/record-page/TaskDescriptionEditor.vue')
);
import TaskRelatedToField from '@/components/tasks/TaskRelatedToField.vue';
import TaskSubtasksField from '@/components/tasks/TaskSubtasksField.vue';
import apiClient from '@/utils/apiClient';
import { fetchModuleDefinitionCached } from '@/utils/tenantSchemaApiCache';
import { getFieldDependencyState, applyPicklistDependencyValueClears } from '@/utils/dependencyEvaluation';
import {
  mergeOrgContactLookupForField,
  resolveOrgContactPair,
  getOrgContactCoordinatedPatches,
  unwrapRecordFromListOrGetResponse,
} from '@/utils/orgContactFormPairing';
import {
  getFormFieldValue,
  setFieldValue,
  syncPeopleVirtualFieldKeys,
  getPeopleRegistryItem,
} from '@/utils/getFieldValue';
import { mergePeopleVirtualFieldDefinitions } from '@/platform/fields/peopleFieldModel';
import {
  getPeopleSalutationOptionsFromModuleFields,
  shouldHidePeopleSalutationFormField,
} from '@/platform/fields/peopleSalutationField';
import { getFieldDisplayLabel } from '@/utils/fieldDisplay';
import { resolveOrgCurrencyCode } from '@/utils/currencyOptions';
import { useAuthStore } from '@/stores/authRegistry';
import { useRoute } from 'vue-router';
import { resolveFieldContext, filterFieldsByContext } from '@/utils/fieldContextFilter';
import {
  getGlobalSystemFieldKeys,
  normalizeFieldKeyForSystemMatch,
  isSystemField,
  canEditField,
  isFieldVisibleInConfig
} from '@/platform/fields/fieldCapabilityEngine';
import { isAuditEventType } from '@/utils/eventUtils';
import { getQuoteFieldMetadata } from '@/platform/fields/quoteFieldModel';
import {
  buildCreateSurfaceBlocks,
  getModuleCompositeAnchors
} from '@/platform/fields/createSurface';
import {
  shouldShowOrganizationFieldForTypes,
  ORGANIZATION_INTENT_STATUS_FIELD_KEYS,
} from '@/platform/fields/organizationFieldModel';
import { getAllowedStatusesForOrganizationStatusField } from '@/platform/organizations/organizationIntents';
import { useOrganizationTypes } from '@/composables/useOrganizationTypes';
import { organizationTypeDefsToPicklistOptions } from '@/utils/organizationTypeConfig';

const _c = globalThis.console;
function formDbg(...args) {
  if (import.meta.env.DEV) _c.log(...args);
}
function formWarn(...args) {
  if (import.meta.env.DEV) _c.warn(...args);
}

const props = defineProps({
  moduleKey: {
    type: String,
    required: true
  },
  formData: {
    type: Object,
    required: true,
    default: () => ({})
  },
  errors: {
    type: Object,
    default: () => ({})
  },
  excludeFields: {
    type: Array,
    default: () => [] // Fields to exclude from the form
  },
  lockedFields: {
    type: Array,
    default: () => [] // Fields that should be readonly/locked
  },
  showAllFields: {
    type: Boolean,
    default: false // If true, show all fields instead of just quickCreate fields
  },
  quickCreateMode: {
    type: Boolean,
    default: false // If true, strictly respect quickCreate config (no fallback to required fields)
  },
  useQuickCreateOrder: {
    type: Boolean,
    default: false // If true, use quickCreate array order even when showAllFields is true
  },
  context: {
    type: String,
    default: null // Optional context override. If not provided, uses route-based context
  },
  fieldsOverride: {
    type: Array,
    default: null // STEP 3: Optional field list override (bypasses module config)
  },
  moduleOverride: {
    type: Object,
    default: null // When provided, use this module instead of fetching (skips API call)
  },
  singleColumn: {
    type: Boolean,
    default: false // If true, use single column layout (grid-cols-1) instead of 2-col grid
  },
  quickCreateFirstWhenExpanded: {
    type: Boolean,
    default: false // When true and showAllFields, render quick create fields at top, then divider, then remaining (like edit drawer)
  },
  /** When set, only these create-surface composites are inserted (else inferred from slots). */
  createSurfaceComposites: {
    type: Array,
    default: null
  },
  /** When set, only fields whose label or key match (case-insensitive) are shown */
  fieldSearch: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:formData', 'submit', 'ready']);

const moduleDefinition = ref(null);
const loading = ref(true);
const localFormData = ref({ ...props.formData });
const error = ref(null);
const authStore = useAuthStore();
const { typeDefs: organizationTypeDefs } = useOrganizationTypes();
const route = useRoute();

// Get current context from route or use provided context prop
const currentContext = computed(() => {
  if (props.context) {
    return props.context;
  }
  return resolveFieldContext(route.path, route.query);
});

const INTERNAL_FALLBACK_SYSTEM_KEYS = new Set([
  'organizationid',
  'createdat',
  'updatedat',
  '_id',
  '__v',
  'createdby',
  'eventid',
  'createdtime',
  'modifiedby',
  'modifiedtime',
  'audithistory',
  ...getGlobalSystemFieldKeys()
]);

const isFormSystemField = (field) => {
  if (!field?.key) return true;
  const moduleKey = props.moduleKey || '';
  const key = String(field.key);
  const fieldKeyNorm = normalizeFieldKeyForSystemMatch(field.key);

  if (INTERNAL_FALLBACK_SYSTEM_KEYS.has(fieldKeyNorm)) return true;
  if (moduleKey?.toLowerCase() === 'events' && key.includes('.')) {
    const parentKey = key.split('.')[0];
    const parentField = (moduleDefinition.value?.fields || []).find(
      (f) => String(f?.key || '').toLowerCase() === String(parentKey).toLowerCase()
    );
    // Unknown nested paths are treated as system/internal.
    if (!parentField) return true;
    // Respect capability-engine decisions based on parent field metadata.
    if (!isFieldVisibleInConfig(moduleKey, parentField)) return true;
    if (isSystemField(moduleKey, parentField)) return true;
    if (!canEditField(moduleKey, parentField)) return true;
    // Keep nested paths only for participation/audit parent fields.
    const parentOwner = String(parentField.owner || '').toLowerCase();
    const parentScope = String(parentField.fieldScope || '').toUpperCase();
    return !(parentOwner === 'participation' || parentScope === 'AUDIT');
  }
  // Events status: non-audit types are editable vocabulary (Scheduled/No Show/…).
  // Audit types keep system-controlled status (hide from create/edit forms).
  if (moduleKey?.toLowerCase() === 'events' && fieldKeyNorm === 'status') {
    const eventType = localFormData.value?.eventType;
    return isAuditEventType(eventType);
  }
  if (!isFieldVisibleInConfig(moduleKey, field)) return true;
  if (isSystemField(moduleKey, field)) return true;
  if (!canEditField(moduleKey, field)) return true;
  return false;
};

// Field rendering helpers - case-insensitive lookup
const fieldMap = computed(() => {
  if (!moduleDefinition.value?.fields) return {};
  const map = {};
  for (const field of moduleDefinition.value.fields) {
    if (field.key) {
      // Store with lowercase key for case-insensitive lookup
      map[field.key.toLowerCase()] = field;
      // Also store with original key for backward compatibility
      map[field.key] = field;
    }
  }
  return map;
});

// Helper function to get field by key (case-insensitive)
const getFieldByKey = (key) => {
  if (!key || !moduleDefinition.value?.fields) return null;
  const keyLower = key.toLowerCase();
  // Try exact match first
  let field = moduleDefinition.value.fields.find(f => f.key === key);
  if (!field) {
    // Try case-insensitive match
    field = moduleDefinition.value.fields.find(f => f.key?.toLowerCase() === keyLower);
  }
  return field || null;
};

const layout = computed(() => moduleDefinition.value?.quickCreateLayout);

function advancedLayoutHasVisibleFields() {
  const lay = layout.value;
  if (!lay?.rows?.length) return false;
  for (const row of lay.rows) {
    for (const col of row.cols || []) {
      if (!col?.fieldKey) continue;
      const field = getFieldByKey(col.fieldKey);
      if (field && shouldShowField(field)) return true;
    }
  }
  return false;
}

// When showAllFields is true (e.g. "Show all fields" in create drawer), bypass advanced layout
// so we can render ALL fields - advanced layout only shows fields in layout rows
const useAdvancedLayout = computed(() => {
  if (props.showAllFields) return false;
  // Strict quick create renders from quickCreate keys only (layout rows can include extra fields).
  if (props.quickCreateMode) return false;
  if (!layout.value?.rows?.length) return false;
  return advancedLayoutHasVisibleFields();
});

const orderedFields = computed(() => {
  if (!moduleDefinition.value) return [];
  const quickCreate = moduleDefinition.value.quickCreate || [];
  
  // STEP 3: Add fieldsOverride support (MANDATORY)
  // This must run before any quickCreate or module config logic
  if (props.fieldsOverride?.length) {
    formDbg('[DynamicForm] Using fieldsOverride:', {
      overrideCount: props.fieldsOverride.length,
      fields: props.fieldsOverride
    });
    // Map override field keys to actual field objects from module definition
    // (respect current context and dependency visibility, same as default path)
    let allFields = filterFieldsByContext(moduleDefinition.value?.fields || [], currentContext.value);
    allFields = filterPeopleCompanionFields(props.moduleKey, allFields);
    if (props.moduleKey?.toLowerCase() === 'tasks') {
      const hasRelatedTo = allFields.some((f) => String(f?.key).toLowerCase() === 'relatedto');
      if (!hasRelatedTo) {
        allFields = [...allFields, { key: 'relatedTo', label: t('common.taskRelatedToFallback'), required: false }];
      }
      const hasSubtasks = allFields.some((f) => String(f?.key).toLowerCase() === 'subtasks');
      if (!hasSubtasks) {
        allFields = [...allFields, { key: 'subtasks', label: t('common.taskSubtasksLabel'), required: false, order: 999 }];
      }
    }
    const systemFieldKeys = Array.from(INTERNAL_FALLBACK_SYSTEM_KEYS);
    const currentFormData = localFormData.value || {};
    const fieldMapByKey = new Map();
    for (const field of allFields) {
      if (field.key) {
        const keyLower = field.key.toLowerCase();
        if (!fieldMapByKey.has(keyLower)) {
          fieldMapByKey.set(keyLower, field);
        }
      }
    }
    
    const ordered = [];
    const seen = new Set();
    for (const fieldKey of props.fieldsOverride) {
      if (!fieldKey) continue;
      const keyLower = String(fieldKey).toLowerCase();
      if (seen.has(keyLower)) continue;
      
      const field = fieldMapByKey.get(keyLower);
      if (field) {
        const fieldKeyNorm = normalizeFieldKeyForSystemMatch(field.key);
        const isSystem = isFormSystemField(field);
        const isExcluded = props.excludeFields.some(
          excluded => normalizeFieldKeyForSystemMatch(excluded) === fieldKeyNorm
        );
        let isVisible = true;
        if (field.dependencies && Array.isArray(field.dependencies) && field.dependencies.length > 0) {
          const depState = getFieldDependencyState(field, currentFormData, allFields, {
            currentUser: authStore.user,
            organization: authStore.organization,
            moduleKey: props.moduleKey,
          });
          isVisible = depState.visible !== false;
        }
        if (isSystem || isExcluded || !isVisible) continue;
        ordered.push(field);
        seen.add(keyLower);
      } else {
        formWarn('[DynamicForm] fieldsOverride field not found in module:', fieldKey);
      }
    }
    
    formDbg('[DynamicForm] fieldsOverride result:', {
      inputCount: props.fieldsOverride.length,
      outputCount: ordered.length,
      fields: ordered.map(f => f.key)
    });
    
    return ordered;
  }
  
  formDbg('🔍 orderedFields computed - START:', {
    moduleKey: props.moduleKey,
    quickCreateMode: props.quickCreateMode,
    showAllFields: props.showAllFields,
    quickCreate: quickCreate,
    quickCreateLength: quickCreate.length,
    fieldsOverride: props.fieldsOverride
  });
  
  // Filter fields by context first
  let allFields = filterFieldsByContext(moduleDefinition.value.fields || [], currentContext.value);
  allFields = filterPeopleCompanionFields(props.moduleKey, allFields);
  // For tasks: ensure relatedTo and subtasks are in the list (like edit drawer) so they render in config order
  if (props.moduleKey?.toLowerCase() === 'tasks') {
    const hasRelatedTo = allFields.some((f) => String(f?.key).toLowerCase() === 'relatedto');
    if (!hasRelatedTo) {
      allFields = [...allFields, { key: 'relatedTo', label: t('common.taskRelatedToFallback'), required: false }];
    }
    const hasSubtasks = allFields.some((f) => String(f?.key).toLowerCase() === 'subtasks');
    if (!hasSubtasks) {
      allFields = [...allFields, { key: 'subtasks', label: t('common.taskSubtasksLabel'), required: false, order: 999 }];
    }
  }
  
    // Exclude system fields and hidden fields (module-aware: status only for Events)
    // assignedTo should be visible in Quick Create forms (admin can assign)
    // Note: createdby is excluded from Quick Create (set by backend automatically)
    // Note: status is system-controlled only for Events; for Tasks it is user-editable and can be in Quick Create
    // RULE: Global system fields (trash: deletedAt, deletedBy, deletionReason) never show in create/edit
    const systemFieldKeys = Array.from(INTERNAL_FALLBACK_SYSTEM_KEYS);
  
  // Access localFormData.value to ensure Vue tracks this dependency for reactivity
  const currentFormData = localFormData.value || {};
  
  // Create a case-insensitive field map for lookup (supports "Deleted By", "deletedBy", "deleted-by")
  const fieldMapByKey = new Map();
  for (const field of allFields) {
    if (field.key) {
      const keyLower = field.key.toLowerCase();
      const keyNorm = normalizeFieldKeyForSystemMatch(field.key);
      if (!fieldMapByKey.has(keyLower)) fieldMapByKey.set(keyLower, field);
      if (!fieldMapByKey.has(keyNorm)) fieldMapByKey.set(keyNorm, field);
    }
  }
  
  // If showAllFields is true (edit mode or expanded create), show all fields instead of just quickCreate
  // CRITICAL: When quickCreateMode is true and showAllFields is false, we MUST respect quickCreate config
  // When showAllFields is true (e.g. fullMode in create drawer), show all fields - useQuickCreateOrder handles ordering
  formDbg('🔍 Checking showAllFields condition:', {
    showAllFields: props.showAllFields,
    quickCreateMode: props.quickCreateMode,
    willShowAllFields: props.showAllFields
  });
  
  if (props.showAllFields) {
    formDbg('⚠️ showAllFields is true - showing ALL fields (edit mode)');
    const ordered = [];
    const seen = new Set();
    
    // If useQuickCreateOrder is true, order fields by quickCreate array
    if (props.useQuickCreateOrder && quickCreate.length > 0) {
      // Create a map of all fields by key (case-insensitive, supports "Deleted By" -> "deletedby")
      const fieldMapByKey = new Map();
      for (const field of allFields) {
        if (field.key) {
          const keyLower = field.key.toLowerCase();
          const keyNorm = normalizeFieldKeyForSystemMatch(field.key);
          if (!fieldMapByKey.has(keyLower)) fieldMapByKey.set(keyLower, field);
          if (!fieldMapByKey.has(keyNorm)) fieldMapByKey.set(keyNorm, field);
        }
      }
      
      // First, add fields in quickCreate order
      for (const key of quickCreate) {
        if (!key) continue;
        const keyNorm = normalizeFieldKeyForSystemMatch(key);
        if (seen.has(keyNorm)) continue;
        
        let field = fieldMapByKey.get(keyNorm) || fieldMapByKey.get(key.toLowerCase().trim());
        if (!field) {
          // Try normalization (snake_case, camelCase, etc.)
          const camelCaseKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          field = fieldMapByKey.get(camelCaseKey.toLowerCase());
          if (!field && key.includes('_')) {
            const camelFromSnake = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            field = fieldMapByKey.get(camelFromSnake.toLowerCase());
          }
          if (!field && /[A-Z]/.test(key)) {
            const snakeFromCamel = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            field = fieldMapByKey.get(snakeFromCamel);
          }
        }
        
        if (field) {
          const fieldKeyNorm = normalizeFieldKeyForSystemMatch(field.key);
          const isSystem = isFormSystemField(field);
          const isExcluded = props.excludeFields.some(excluded => normalizeFieldKeyForSystemMatch(excluded) === fieldKeyNorm);
          
          // Check dependency-based visibility
          let isVisible = true;
          if (field.dependencies && Array.isArray(field.dependencies) && field.dependencies.length > 0) {
            const depState = getFieldDependencyState(field, currentFormData, allFields, {
              moduleKey: props.moduleKey,
            });
            isVisible = depState.visible !== false;
          }
          
          if (!isSystem && !isExcluded && isVisible) {
            ordered.push(field);
            seen.add(normalizeFieldKeyForSystemMatch(field.key));
          }
        }
      }
      
      // Then add any remaining fields that weren't in quickCreate (but are eligible)
      for (const field of allFields) {
        const fieldKeyNorm = normalizeFieldKeyForSystemMatch(field.key);
        if (seen.has(fieldKeyNorm)) continue;
        
        const isSystem = isFormSystemField(field);
        const isExcluded = props.excludeFields.some(excluded => normalizeFieldKeyForSystemMatch(excluded) === fieldKeyNorm);
        
        // Check dependency-based visibility
        let isVisible = true;
        if (field.dependencies && Array.isArray(field.dependencies) && field.dependencies.length > 0) {
          const depState = getFieldDependencyState(field, currentFormData, allFields, {
            moduleKey: props.moduleKey,
          });
          isVisible = depState.visible !== false;
        }
        
        if (!isSystem && !isExcluded && isVisible) {
          ordered.push(field);
          seen.add(fieldKeyNorm);
        }
      }
      
      // Full form mode: use config order (field.order from settings, or array index)
      const configOrderMap = new Map();
      allFields.forEach((f, idx) => {
        if (f?.key) configOrderMap.set(f.key.toLowerCase(), idx);
      });
      return ordered.sort((a, b) => {
        const orderA = a.order ?? configOrderMap.get(a.key?.toLowerCase()) ?? 999;
        const orderB = b.order ?? configOrderMap.get(b.key?.toLowerCase()) ?? 999;
        return orderA - orderB;
      });
    }
    
    // Default: Add all fields (excluding system fields and excluded fields)
    // Preserve config order: use array index so fields follow Settings → Fields configuration order
    const configOrderMap = new Map();
    allFields.forEach((f, idx) => {
      if (f?.key) configOrderMap.set(f.key.toLowerCase(), idx);
    });
    for (const field of allFields) {
      const fieldKeyNorm = normalizeFieldKeyForSystemMatch(field.key);
      const isSystem = isFormSystemField(field);
      const isExcluded = props.excludeFields.some(excluded => normalizeFieldKeyForSystemMatch(excluded) === fieldKeyNorm);
      
      // Check dependency-based visibility
      let isVisible = true;
      if (field.dependencies && Array.isArray(field.dependencies) && field.dependencies.length > 0) {
        const depState = getFieldDependencyState(field, currentFormData, allFields, {
          moduleKey: props.moduleKey,
        });
        isVisible = depState.visible !== false;
      }
      
      if (!isSystem && !isExcluded && isVisible && !seen.has(fieldKeyNorm)) {
        ordered.push(field);
        seen.add(fieldKeyNorm);
      }
    }
    
    // Sort by config order (field.order from settings, or array index as fallback)
    return ordered.sort((a, b) => {
      const orderA = a.order ?? configOrderMap.get(a.key?.toLowerCase()) ?? 999;
      const orderB = b.order ?? configOrderMap.get(b.key?.toLowerCase()) ?? 999;
      return orderA - orderB;
    });
  }
  
  // Get fields in quickCreate order, respecting main field order
  formDbg('🔍 Entering quickCreate processing path (not showAllFields)');
  const ordered = [];
  const seen = new Set(); // Use Set with lowercase keys for case-insensitive deduplication
  
  const quickCreateKeysSet = new Set(quickCreate.map(k => k?.toLowerCase().trim()).filter(Boolean));
  
  formDbg('🔍 Processing quickCreate fields:', {
    quickCreateArray: quickCreate,
    quickCreateLength: quickCreate.length,
    quickCreateKeysSet: Array.from(quickCreateKeysSet),
    fieldMapByKeySize: fieldMapByKey.size,
    systemFieldKeys: Array.from(INTERNAL_FALLBACK_SYSTEM_KEYS),
    currentFormData: currentFormData,
    moduleKey: props.moduleKey,
    allFieldKeys: Array.from(fieldMapByKey.keys()).slice(0, 30),
    quickCreateKeys: quickCreate.slice(0, 10),
    quickCreateMode: props.quickCreateMode,
    showAllFields: props.showAllFields,
    willRespectQuickCreate: !props.showAllFields || props.quickCreateMode,
    strictMode: props.quickCreateMode ? 'ONLY quickCreate fields' : 'May include other fields'
  });
  
  // First, add fields from quickCreate array in the exact order they appear
  // Check dependency visibility based on current form data
  // In quickCreateMode, ONLY process fields from quickCreate array
  for (const key of quickCreate) {
    if (!key) continue;
    const keyLower = key.toLowerCase().trim();
    if (seen.has(keyLower)) {
      formDbg(`⏭️  Skipping duplicate: "${key}"`);
      continue; // Skip duplicates
    }
    
    let field = fieldMapByKey.get(keyLower);
    if (!field) {
      // Try kebab-case to camelCase conversion (event-type -> eventType)
      const camelCaseKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      const camelCaseKeyLower = camelCaseKey.toLowerCase();
      field = fieldMapByKey.get(camelCaseKeyLower);
      
      // Also try snake_case to camelCase conversion (first_name -> firstName)
      if (!field && key.includes('_')) {
        const camelFromSnake = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        const camelFromSnakeLower = camelFromSnake.toLowerCase();
        field = fieldMapByKey.get(camelFromSnakeLower);
        if (field) {
          formDbg(`✅ Normalized snake_case field key "${key}" to "${field.key}"`);
        }
      }
      
      // Also try camelCase to snake_case conversion (firstName -> first_name)
      if (!field && /[A-Z]/.test(key)) {
        const snakeFromCamel = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        field = fieldMapByKey.get(snakeFromCamel);
        if (field) {
          formDbg(`✅ Normalized camelCase field key "${key}" to "${field.key}"`);
        }
      }
      
      if (field) {
        if (!camelCaseKeyLower) {
          formDbg(`✅ Found field "${key}" after normalization`);
        }
      } else {
        formWarn(`⚠️  Field "${key}" (${keyLower}) from quickCreate not found in module fields`, {
          availableKeys: Array.from(fieldMapByKey.keys()).slice(0, 30),
          keyLower: keyLower,
          camelCaseAttempt: camelCaseKey,
          snakeCaseAttempt: key.includes('_') ? key.replace(/_([a-z])/g, (g) => g[1].toUpperCase()).toLowerCase() : null,
          camelToSnakeAttempt: /[A-Z]/.test(key) ? key.replace(/([A-Z])/g, '_$1').toLowerCase() : null,
          moduleKey: props.moduleKey,
          quickCreateArray: quickCreate
        });
        continue;
      }
    }
    
    const fieldKeyNorm = normalizeFieldKeyForSystemMatch(field.key);
    
    // Exclude system fields (handles "Deleted By" -> "deletedby")
    const isSystem = isFormSystemField(field);
    
    // Check dependency-based visibility using current form data
    let isVisible = true;
    if (field.dependencies && Array.isArray(field.dependencies) && field.dependencies.length > 0) {
      const depState = getFieldDependencyState(field, currentFormData, allFields, {
        moduleKey: props.moduleKey,
      });
      isVisible = depState.visible !== false; // Default to visible if undefined
    }
    
    formDbg(`✅ Processing field "${key}":`, {
      found: !!field,
      fieldKey: field.key,
      fieldLabel: field.label,
      isSystem: isSystem,
      isVisible: isVisible,
      hasDependencies: !!(field.dependencies && field.dependencies.length > 0),
      willInclude: !isSystem && isVisible
    });
    
    if (!isSystem && isVisible) {
      ordered.push(field);
      seen.add(fieldKeyNorm);
      formDbg(`✅ Added field "${key}" to ordered list`);
    } else {
      if (isSystem) {
        formDbg(`⏭️  Excluding system field "${key}"`);
      } else {
        formDbg(`⏭️  Excluding hidden field "${key}" (dependency not met)`);
      }
    }
  }
  
  formDbg('📋 Ordered fields after quickCreate processing:', {
    count: ordered.length,
    fields: ordered.map(f => ({ key: f.key, label: f.label, required: f.required })),
    quickCreateMode: props.quickCreateMode,
    quickCreateLength: quickCreate.length,
    strictMode: props.quickCreateMode ? 'ONLY quickCreate fields (no fallback)' : 'May include fallback fields'
  });
  
  // Always include mandatory fields in quick create, even when not in quickCreate config
  for (const field of allFields) {
    const fieldKeyNorm = normalizeFieldKeyForSystemMatch(field.key);
    const isSystem = isFormSystemField(field);
    const isExcluded = props.excludeFields.some(
      excluded => normalizeFieldKeyForSystemMatch(excluded) === fieldKeyNorm
    );

    let isVisible = true;
    if (field.dependencies && Array.isArray(field.dependencies) && field.dependencies.length > 0) {
      const depState = getFieldDependencyState(field, currentFormData, allFields, {
        moduleKey: props.moduleKey,
      });
      isVisible = depState.visible !== false;
    }

    if (field.required &&
        !seen.has(fieldKeyNorm) &&
        !isSystem &&
        !isExcluded &&
        isVisible) {
      ordered.push(field);
      seen.add(fieldKeyNorm);
    }
  }
  
  // Prioritize quickCreate order - only use field.order as tiebreaker for fields not in quickCreate
  // This ensures the order set in Settings > Modules & Fields > Quick Create is respected
  ordered.sort((a, b) => {
    // First, check if both fields are in quickCreate array
    const idxA = quickCreate.findIndex(k => k?.toLowerCase() === a.key?.toLowerCase());
    const idxB = quickCreate.findIndex(k => k?.toLowerCase() === b.key?.toLowerCase());
    
    // If both are in quickCreate, use their order in the array
    if (idxA >= 0 && idxB >= 0) {
      return idxA - idxB;
    }
    
    // If only one is in quickCreate, it comes first
    if (idxA >= 0) return -1;
    if (idxB >= 0) return 1;
    
    // If neither is in quickCreate, use field.order as tiebreaker
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });
  
  formDbg('📊 Final ordered fields result (before filtering):', {
    count: ordered.length,
    fields: ordered.map(f => ({ key: f.key, label: f.label, required: f.required })),
    quickCreateMode: props.quickCreateMode,
    showAllFields: props.showAllFields,
    quickCreateLength: quickCreate.length,
    strictMode: props.quickCreateMode ? 'ONLY showing quickCreate fields' : 'May include fallback fields'
  });
  
  if (props.quickCreateMode) {
    const filtered = ordered.filter(f => {
      const fieldKeyLower = f.key?.toLowerCase();
      const inQuickCreate = fieldKeyLower && quickCreateKeysSet.has(fieldKeyLower);
      const isRequired = f.required === true;
      return inQuickCreate || isRequired;
    });
    formDbg('✅ quickCreateMode enabled - filtered to quickCreate + required fields:', {
      before: ordered.length,
      after: filtered.length,
      fields: filtered.map(f => ({ 
        key: f.key, 
        label: f.label, 
        required: f.required,
        dataType: f.dataType
      })),
      requiredFields: filtered.filter(f => f.required).map(f => ({ key: f.key, label: f.label }))
    });
    return filtered;
  }
  
  return ordered;
});

// For quickCreateFirstWhenExpanded: split into quick create (top) and remaining (below divider).
// Required fields are force-included in orderedFields for create; treat them as quick-create
// for sectioning so they don't drop into "Core Fields".
const quickCreateKeysForLayout = computed(() => {
  const qc = moduleDefinition.value?.quickCreate || [];
  const set = new Set(qc.map((k) => String(k).toLowerCase().trim()).filter(Boolean));
  if (props.quickCreateFirstWhenExpanded && props.showAllFields) {
    for (const field of moduleDefinition.value?.fields || []) {
      if (!field?.required || !field?.key) continue;
      set.add(String(field.key).toLowerCase().trim());
    }
  }
  return set;
});

const fieldMatchesSearch = (field) => {
  const q = String(props.fieldSearch || '').trim().toLowerCase();
  if (!q) return true;
  if (!field) return false;
  const label = String(getFieldDisplayLabel(field) || field.label || '').toLowerCase();
  const key = String(field.key || '').toLowerCase();
  return label.includes(q) || key.includes(q);
};

const displayOrderedFields = computed(() =>
  orderedFields.value.filter((field) => shouldShowField(field))
);

const quickCreateFields = computed(() => {
  if (!props.quickCreateFirstWhenExpanded || !props.showAllFields) return [];
  const set = quickCreateKeysForLayout.value;
  return displayOrderedFields.value.filter(f => f?.key && set.has(f.key.toLowerCase()));
});

const remainingFields = computed(() => {
  if (!props.quickCreateFirstWhenExpanded || !props.showAllFields) return [];
  const set = quickCreateKeysForLayout.value;
  return displayOrderedFields.value.filter(f => f?.key && !set.has(f.key.toLowerCase()));
});

const slots = useSlots();

function hasCreateSurfaceSlot(id) {
  if (id === 'lines') return !!(slots.lines || slots['after-quick-create']);
  return !!slots[id];
}

const useFieldLayoutFullForm = computed(() => {
  if (!props.showAllFields) return false;
  // Partial override lists keep legacy flat rendering (People/Org compose their own surface).
  if (Array.isArray(props.fieldsOverride) && props.fieldsOverride.length > 0) return false;
  return true;
});

const useQuickCreateFirstLayout = computed(() =>
  !useFieldLayoutFullForm.value &&
  props.quickCreateFirstWhenExpanded &&
  props.showAllFields &&
  quickCreateKeysForLayout.value.size > 0
);

function fieldGridCellClass(field) {
  return [
    (field.dataType === 'Text-Area' || field.dataType === 'RichText' || field.dataType === 'Image' || (props.moduleKey === 'tasks' && field.key === 'description')) && !props.singleColumn ? 'md:col-span-2' : '',
    props.moduleKey === 'tasks' && field.key === 'description' ? 'w-full' : ''
  ];
}

function createSectionStorageKey(sectionId) {
  const moduleKey = String(props.moduleKey || 'module').toLowerCase();
  const id = String(sectionId || 'section');
  return `create-drawer-section:${moduleKey}:${id}`;
}

const filterQuoteFullFormFields = (fields) => {
  return fields.filter((field) => {
    const meta = getQuoteFieldMetadata(field.key);
    if (meta) {
      if (meta.owner === 'system' || meta.isComputed === true) return false;
      return meta.owner === 'core';
    }
    return !isSystemField('quotes', field);
  });
};

const createSurfaceBlocks = computed(() => {
  if (!useFieldLayoutFullForm.value) return [];
  const moduleKeyLower = String(props.moduleKey || '').toLowerCase();
  let sourceFields = displayOrderedFields.value;
  if (moduleKeyLower === 'quotes') {
    sourceFields = filterQuoteFullFormFields(sourceFields);
  }

  const includeComposites = Array.isArray(props.createSurfaceComposites)
    ? props.createSurfaceComposites.filter((id) => hasCreateSurfaceSlot(id))
    : getModuleCompositeAnchors(moduleKeyLower)
      .map((a) => a.id)
      .filter((id) => hasCreateSurfaceSlot(id));

  const excludeParticipation =
    (moduleKeyLower === 'people' || moduleKeyLower === 'organizations') &&
    includeComposites.includes('app_participation');

  return buildCreateSurfaceBlocks({
    moduleKey: moduleKeyLower,
    fields: sourceFields,
    fieldLayout: moduleDefinition.value?.fieldLayout || null,
    t,
    includeComposites,
    excludeParticipationOwner: excludeParticipation,
    includeField: (field) => shouldShowField(field)
  });
});

const showLegacyAfterQuickCreateSlot = computed(() => {
  if (!useFieldLayoutFullForm.value) return false;
  if (!slots['after-quick-create']) return false;
  // Commercial / deal lines already consume after-quick-create via #lines fallback.
  return !createSurfaceBlocks.value.some(
    (block) => block.type === 'composite' && block.id === 'lines'
  );
});


const getSpanClass = (span) => {
  const spanMap = {
    1: 'col-span-1',
    2: 'col-span-2',
    3: 'col-span-3',
    4: 'col-span-4',
    5: 'col-span-5',
    6: 'col-span-6',
    7: 'col-span-7',
    8: 'col-span-8',
    9: 'col-span-9',
    10: 'col-span-10',
    11: 'col-span-11',
    12: 'col-span-12'
  };
  return spanMap[span] || 'col-span-12';
};

const getFieldComponent = (field) => {
  return DynamicFormField;
};

const shouldShowField = (field) => {
  if (!field || !field.key) return false;
  if (!fieldMatchesSearch(field)) return false;

  if (shouldHidePeopleSalutationFormField(props.moduleKey, field.key)) return false;

  const moduleKeyLower = String(props.moduleKey || '').toLowerCase();
  if (moduleKeyLower === 'organizations') {
    const selectedTypes = Array.isArray(localFormData.value?.types) ? localFormData.value.types : [];
    if (!shouldShowOrganizationFieldForTypes(field.key, selectedTypes, organizationTypeDefs.value)) {
      return false;
    }
  }
  
  // Exclude fields specified in excludeFields prop
  if (props.excludeFields && props.excludeFields.length > 0) {
    const fieldKeyNorm = normalizeFieldKeyForSystemMatch(field.key);
    if (props.excludeFields.some(excluded => normalizeFieldKeyForSystemMatch(excluded) === fieldKeyNorm)) {
      return false;
    }
  }
  
  // Exclude system/infrastructure and non-editable fields via capability engine
  if (isFormSystemField(field)) return false;
  
  // Evaluate dependency-based visibility using getFieldState for consistency
  // Access localFormData.value to ensure Vue tracks this dependency
  const currentFormData = localFormData.value || {};
  if (field.dependencies && Array.isArray(field.dependencies) && field.dependencies.length > 0) {
    const depState = getFieldDependencyState(field, currentFormData, moduleDefinition.value?.fields || [], {
      moduleKey: props.moduleKey,
    });
    // Only hide if explicitly set to false, default to visible if undefined
    if (depState.visible === false) return false;
  }
  
  return true;
};

// Get field dependency state for a field (reactive)
const getFieldState = (field) => {
  if (!field) {
    return {
      readonly: false,
      required: false,
      allowedOptions: null,
      label: null,
      lookupQuery: null,
      setValue: null,
    };
  }
  // Access localFormData.value to ensure reactivity - Vue tracks this dependency
  const currentFormData = localFormData.value;
  const fields = moduleDefinition.value?.fields || [];
  const base = getFieldDependencyState(field, currentFormData, fields, {
    currentUser: authStore.user,
    organization: authStore.organization,
    moduleKey: props.moduleKey,
  });
  let state = mergeOrgContactLookupForField(field, base, currentFormData, props.moduleKey, fields);
  // PO / inventory vendorId → Vendor orgs via PLATFORM list (Sales-gated endpoint; not appKey=INVENTORY).
  if (String(field.key || '').toLowerCase().replace(/[^a-z0-9]+/g, '') === 'vendorid') {
    const prevQ =
      state.lookupQuery && typeof state.lookupQuery === 'object' ? { ...state.lookupQuery } : {};
    state = {
      ...state,
      lookupQuery: {
        ...prevQ,
        appKey: prevQ.appKey || 'PLATFORM',
        type: prevQ.type || 'Vendor',
      },
    };
  }
  if (
    String(props.moduleKey || '').toLowerCase() === 'organizations' &&
    ORGANIZATION_INTENT_STATUS_FIELD_KEYS.has(field.key)
  ) {
    const selectedTypes = Array.isArray(currentFormData?.types) ? currentFormData.types : [];
    const allowed = getAllowedStatusesForOrganizationStatusField(field.key, selectedTypes);
    if (allowed.length > 0) {
      state = { ...state, allowedOptions: allowed };
    }
  }
  return state;
};

function normalizedRelatedTo(val) {
  if (!val || typeof val !== 'object') return { type: 'none', id: null };
  const id = val.id != null && typeof val.id === 'object' && val.id._id != null ? val.id._id : (val.id ?? null);
  return { type: val.type || 'none', id };
}

const applyFormContextPatch = (patch) => {
  if (!patch || typeof patch !== 'object') return;
  localFormData.value = { ...localFormData.value, ...patch };
  emit('update:formData', { ...localFormData.value });
};

const updateField = async (key, value) => {
  const afterPrimary = (() => {
    if (props.moduleKey?.toLowerCase() === 'people' && getPeopleRegistryItem(key)?.setValue) {
      const next = { ...localFormData.value };
      setFieldValue(next, key, value);
      return next;
    }
    return { ...localFormData.value, [key]: value };
  })();

  localFormData.value = afterPrimary;

  const fields = moduleDefinition.value?.fields || [];
  const pair = resolveOrgContactPair(props.moduleKey, fields);
  if (pair) {
    const fetchPersonById = async (id) => {
      if (!id) return null;
      try {
        const r = await apiClient.get(`/people/${id}`);
        return unwrapRecordFromListOrGetResponse(r);
      } catch {
        return null;
      }
    };
    const patches = await getOrgContactCoordinatedPatches({
      pair,
      formAfter: { ...afterPrimary },
      changedKey: key,
      newValue: value,
      fetchPersonById,
    });
    if (patches && Object.keys(patches).length > 0) {
      localFormData.value = { ...afterPrimary, ...patches };
    }
  }

  emit('update:formData', { ...localFormData.value });
};

function findMatchingKeyInObject(obj, candidateKey) {
  if (!obj || !candidateKey) return null;
  const candidateNorm = String(candidateKey).toLowerCase();
  return Object.keys(obj).find((k) => String(k).toLowerCase() === candidateNorm) || null;
}

function filterPeopleCompanionFields(moduleKey, fields) {
  if (String(moduleKey || '').toLowerCase() !== 'people' || !Array.isArray(fields)) return fields;
  return fields.filter((field) => !shouldHidePeopleSalutationFormField(moduleKey, field?.key));
}

const peopleSalutationOptions = computed(() =>
  getPeopleSalutationOptionsFromModuleFields(moduleDefinition.value?.fields)
);

function onSalutationFieldUpdate(value) {
  const next = value == null || value === '' ? null : String(value);
  updateField('salutation', next);
}

function findMatchingFieldKeyInModule(candidateKey) {
  const fields = moduleDefinition.value?.fields || [];
  const candidateNorm = String(candidateKey || '').toLowerCase();
  const matched = fields.find((f) => String(f?.key || '').toLowerCase() === candidateNorm);
  return matched?.key || null;
}

function resolveCurrencyCompanionFieldKey(field) {
  if (!field || field.dataType !== 'Currency') return null;
  const baseKey = String(field.key || '').trim();
  const candidates = [
    `${baseKey}CurrencyCode`,
    `${baseKey}Currency`,
    `${baseKey}_currency_code`,
    `${baseKey}_currency`,
    'currencyCode',
    'currency',
  ];

  for (const candidate of candidates) {
    const keyInFormData = findMatchingKeyInObject(localFormData.value, candidate);
    if (keyInFormData) return keyInFormData;
  }

  for (const candidate of candidates) {
    const keyInModule = findMatchingFieldKeyInModule(candidate);
    if (keyInModule) return keyInModule;
  }

  return null;
}

function getOrgDefaultCurrencyCode() {
  return resolveOrgCurrencyCode(authStore.organization);
}

function getCurrencyCodeForField(field) {
  if (!field || field.dataType !== 'Currency') return '';
  const companionKey = resolveCurrencyCompanionFieldKey(field);
  if (companionKey) {
    const value = localFormData.value?.[companionKey];
    if (value) return String(value).toUpperCase();
  }
  const explicit = field?.numberSettings?.currencyCode || field?.numberSettings?.currency;
  if (explicit) return String(explicit).toUpperCase();
  return getOrgDefaultCurrencyCode();
}

function updateCurrencyCodeForField(field, currencyCode) {
  if (!field || field.dataType !== 'Currency') return;
  const companionKey = resolveCurrencyCompanionFieldKey(field);
  if (!companionKey) return;
  updateField(companionKey, String(currencyCode || getOrgDefaultCurrencyCode()).toUpperCase());
}

// Generic dependency-driven value enforcement:
// If a field becomes readonly + required, ensure its value is set to a safe default.
// (Used to keep audit GEO UI accurate without event-type hardcoding.)
// Also clears dependent picklist values that fall outside allowedOptions (multi-level chains).
watch(
  () => [moduleDefinition.value?.fields, localFormData.value, authStore.user?.organizationId, authStore.organization?._id, authStore.organization?.id],
  () => {
    const fields = moduleDefinition.value?.fields || [];
    if (!Array.isArray(fields) || fields.length === 0) return;

    const depContext = {
      currentUser: authStore.user,
      organization: authStore.organization,
      moduleKey: props.moduleKey,
    };

    let changed = false;
    for (const field of fields) {
      if (!field?.key) continue;
      const depState = getFieldDependencyState(field, localFormData.value, fields, depContext);

      // 1) Forced values (dependency-driven)
      if (depState && depState.setValue !== null && depState.setValue !== undefined) {
        const current =
          props.moduleKey?.toLowerCase() === 'people' && getPeopleRegistryItem(field.key)?.setValue
            ? getFormFieldValue(localFormData.value, field.key, field, { moduleKey: props.moduleKey })
            : localFormData.value[field.key];
        const currentNorm = (current && typeof current === 'object' && current._id) ? String(current._id) : (current == null ? null : String(current));
        const forcedNorm = (depState.setValue && typeof depState.setValue === 'object' && depState.setValue._id)
          ? String(depState.setValue._id)
          : (depState.setValue == null ? null : String(depState.setValue));
        if (currentNorm !== forcedNorm) {
          if (props.moduleKey?.toLowerCase() === 'people' && getPeopleRegistryItem(field.key)?.setValue) {
            const next = { ...localFormData.value };
            setFieldValue(next, field.key, depState.setValue);
            localFormData.value = next;
          } else {
            localFormData.value[field.key] = depState.setValue;
          }
          changed = true;
        }
      }

      // 2) Readonly+required checkbox => true (generic)
      if (field.dataType === 'Checkbox' && depState?.readonly === true && depState?.required === true) {
        const current =
          props.moduleKey?.toLowerCase() === 'people' && getPeopleRegistryItem(field.key)?.setValue
            ? getFormFieldValue(localFormData.value, field.key, field, { moduleKey: props.moduleKey })
            : localFormData.value[field.key];
        if (current !== true) {
          if (props.moduleKey?.toLowerCase() === 'people' && getPeopleRegistryItem(field.key)?.setValue) {
            const next = { ...localFormData.value };
            setFieldValue(next, field.key, true);
            localFormData.value = next;
          } else {
            localFormData.value[field.key] = true;
          }
          changed = true;
        }
      }
    }

    // 3) Clear invalid dependent picklist values (Country → State → City cascades)
    const cleared = applyPicklistDependencyValueClears(fields, localFormData.value, depContext);
    if (cleared) {
      localFormData.value = cleared;
      changed = true;
    }

    if (changed) {
      emit('update:formData', { ...localFormData.value });
    }
  },
  { deep: true }
);

// Watch for external formData changes
watch(() => props.formData, (newData) => {
  const merged = newData && typeof newData === 'object' ? { ...newData } : {};
  if (props.moduleKey?.toLowerCase() === 'people') {
    syncPeopleVirtualFieldKeys(merged);
  }
  localFormData.value = merged;
}, { deep: true });


function enrichOrganizationModuleTypesField(mod, typeDefs) {
  if (!mod || String(mod.key || '').toLowerCase() !== 'organizations' || !Array.isArray(mod.fields)) {
    return mod;
  }
  const typeOptions = organizationTypeDefsToPicklistOptions(typeDefs, {
    enabledApps: authStore.organization?.enabledApps,
  });
  if (!typeOptions.length) return mod;
  return {
    ...mod,
    fields: mod.fields.map((field) => {
      if (String(field?.key || '').toLowerCase() !== 'types') return field;
      return {
        ...field,
        options: typeOptions,
        enum: typeOptions.map((option) => option.value),
      };
    }),
  };
}

function applyModule(mod, { emitReady = true } = {}) {
  if (!mod) return;
  let next = mod;
  if ((mod.key || '').toLowerCase() === 'people' && Array.isArray(mod.fields)) {
    next = { ...next, fields: mergePeopleVirtualFieldDefinitions(mod.fields) };
  }
  if ((mod.key || '').toLowerCase() === 'organizations') {
    next = enrichOrganizationModuleTypesField(next, organizationTypeDefs.value);
  }
  moduleDefinition.value = next;
  loading.value = false;
  error.value = null;
  if (!next.quickCreate) next.quickCreate = [];
  if (!next.quickCreateLayout) next.quickCreateLayout = { version: 1, rows: [] };
  if (emitReady) emit('ready', next);
}

watch(
  organizationTypeDefs,
  () => {
    const mod = moduleDefinition.value;
    if (!mod || String(mod.key || '').toLowerCase() !== 'organizations') return;
    const enriched = enrichOrganizationModuleTypesField(
      { ...mod, fields: Array.isArray(mod.fields) ? [...mod.fields] : [] },
      organizationTypeDefs.value
    );
    moduleDefinition.value = enriched;
  },
  { deep: true }
);

// Fetch module definition
const fetchModule = async () => {
  if (props.moduleOverride) {
    formDbg('🔍 [DynamicForm] Using moduleOverride (skip fetch):', {
      moduleKey: props.moduleOverride?.key,
      quickCreateLength: props.moduleOverride?.quickCreate?.length
    });
    // Emit ready once on mount so parents (CreateRecordDrawer) can seed formData/initialData.
    // Override *updates* keep emitReady:false to avoid re-init loops.
    applyModule(props.moduleOverride, { emitReady: true });
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    // Validate moduleKey prop
    if (!props.moduleKey) {
      error.value = 'Module key is required';
      console.error('❌ Module key is missing or empty');
      loading.value = false;
      return;
    }
    
    // Pass current context to API
    const context = currentContext.value;
    formDbg('🔍 fetchModule called:', {
      moduleKey: props.moduleKey,
      moduleKeyType: typeof props.moduleKey,
      moduleKeyLength: props.moduleKey?.length,
      moduleKeyTrimmed: props.moduleKey?.trim(),
      context: context,
      contextSource: props.context ? 'prop' : 'route'
    });
    const targetModuleRaw = await fetchModuleDefinitionCached(props.moduleKey, {
      context: context || 'all',
    });
    
    if (!targetModuleRaw) {
      error.value = `Module "${props.moduleKey}" not found`;
      console.error('Module not found:', props.moduleKey);
      loading.value = false;
      return;
    }

    const targetModule = { ...targetModuleRaw };
    formDbg('🔍 Raw API response for module:', {
      key: targetModule.key,
      quickCreate: targetModule.quickCreate,
      quickCreateLength: targetModule.quickCreate?.length || 0,
    });
    {
        // Ensure quickCreate and quickCreateLayout are always present
        if (!targetModule.quickCreate) targetModule.quickCreate = [];
        if (!targetModule.quickCreateLayout) targetModule.quickCreateLayout = { version: 1, rows: [] };
        
        formDbg('📦 Module loaded:', {
          key: targetModule.key,
          quickCreate: targetModule.quickCreate,
          quickCreateLayout: targetModule.quickCreateLayout,
          quickCreateLength: targetModule.quickCreate?.length || 0,
          quickCreateLayoutRows: targetModule.quickCreateLayout?.rows?.length || 0,
          fieldsCount: targetModule.fields?.length || 0,
          fields: targetModule.fields?.map(f => ({ key: f.key, label: f.label, required: f.required })) || [],
          propsReceived: {
            quickCreateMode: props.quickCreateMode,
            showAllFields: props.showAllFields,
            moduleKey: props.moduleKey
          },
          willRespectQuickCreate: !props.showAllFields || props.quickCreateMode,
          quickCreateType: typeof targetModule.quickCreate,
          quickCreateIsArray: Array.isArray(targetModule.quickCreate),
          rawModuleData: JSON.stringify({
            quickCreate: targetModule.quickCreate,
            quickCreateLayout: targetModule.quickCreateLayout
          })
        });
        
        // Debug: Log fields in Quick Create config
        if (targetModule.quickCreate && targetModule.quickCreate.length > 0) {
          formDbg('✅ Fields in quickCreate config:', targetModule.quickCreate);
          formDbg('✅ Matching fields:', targetModule.quickCreate.map(key => {
            const field = targetModule.fields?.find(f => f.key === key);
            return field ? { key: field.key, label: field.label, found: true } : { key, found: false };
          }));
        } else if (props.quickCreateMode) {
          // In strict quick-create mode, empty configuration is meaningful and should be visible in logs.
          formWarn('⚠️ quickCreate array is empty in strict quickCreateMode', {
            hasQuickCreate: !!targetModule.quickCreate,
            quickCreateValue: targetModule.quickCreate
          });
        }
        
        applyModule(targetModule);
    }
  } catch (err) {
    console.error('Error fetching module definition:', err);
    error.value = err.message || 'Failed to fetch module definition';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  formDbg('🚀 DynamicForm mounted with props:', {
    moduleKey: props.moduleKey,
    quickCreateMode: props.quickCreateMode,
    showAllFields: props.showAllFields,
    formDataKeys: Object.keys(props.formData || {}),
    hasModuleOverride: !!props.moduleOverride
  });
  fetchModule();
  const initial = { ...props.formData };
  if (props.moduleKey?.toLowerCase() === 'people') {
    syncPeopleVirtualFieldKeys(initial);
  }
  localFormData.value = initial;
});

// When moduleOverride is provided async (e.g. drawer fetches then passes), apply it
watch(() => props.moduleOverride, (ov) => {
  if (ov) {
    formDbg('🔍 [DynamicForm] moduleOverride updated, applying:', { key: ov.key, quickCreateLength: ov.quickCreate?.length });
    applyModule(ov, { emitReady: false });
  }
}, { immediate: false });

// Watch props to debug
watch(() => [props.quickCreateMode, props.showAllFields], ([quickCreateMode, showAllFields]) => {
  formDbg('👀 Props changed:', { quickCreateMode, showAllFields });
}, { immediate: true });
</script>

