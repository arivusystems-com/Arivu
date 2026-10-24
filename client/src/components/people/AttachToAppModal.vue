<template>
  <Teleport to="body">
    <TransitionRoot as="template" :show="isOpen">
      <Dialog class="relative z-[10000]" @close="close">
        <TransitionChild
          as="template"
          enter="ease-out duration-200"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-200"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" aria-hidden="true" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-hidden">
          <div class="absolute inset-0 overflow-hidden">
            <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <TransitionChild
                as="template"
                enter="transform transition ease-in-out duration-300 sm:duration-300"
                enter-from="translate-x-full"
                enter-to="translate-x-0"
                leave="transform transition ease-in-out duration-300 sm:duration-300"
                leave-from="translate-x-0"
                leave-to="translate-x-full"
              >
                <DialogPanel
                  class="rounded-tl-xl overflow-hidden pointer-events-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-xl dark:bg-gray-800"
                >
                  <form
                    class="relative flex h-full min-h-0 flex-col divide-y divide-gray-200 dark:divide-gray-700"
                    @submit.prevent="handleSubmit"
                  >
                    <!-- Header (same pattern as ParticipationEditModal / CreateRecordDrawer) -->
                    <div class="flex shrink-0 items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-6 sm:px-6">
                      <div class="min-w-0 pr-2">
                        <DialogTitle class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                          Attach to {{ formatAppName(appKey) }}
                        </DialogTitle>
                        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('people.attachToAppModalAddThisPersonToTheApp') }}</p>
                      </div>
                      <button
                        type="button"
                        class="relative rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer shrink-0"
                        @click="close"
                      >
                        <span class="absolute -inset-2.5" />
                        <span class="sr-only">{{ t('forms.previewClosePanelSr') }}</span>
                        <XMarkIcon class="size-6" aria-hidden="true" />
                      </button>
                    </div>

                    <div class="min-h-0 flex-1 overflow-y-auto">
                      <div class="px-4 py-6 sm:px-6 space-y-6">
            <!-- Explanation Banner -->
            <div class="rounded-md bg-blue-50 p-4 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div class="flex items-start gap-2">
                <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
                <div>
                  <p class="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">{{ t('people.attachToAppModalAddingParticipation') }}</p>
                  <p class="text-sm text-blue-700 dark:text-blue-300">
                    You are adding this person to {{ formatAppName(appKey) }}{{ participationTypeDisplay ? ` as ${participationTypeDisplay}` : '' }}. Only participation fields for this app are set. Core identity fields (name, email, etc.) are not modified.
                  </p>
                </div>
              </div>
            </div>

            <!-- Error State -->
            <div v-if="error" class="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
              <div class="flex items-start gap-2">
                <svg class="h-5 w-5 flex-shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
                <div class="flex-1">
                  <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
                </div>
              </div>
            </div>

            <!-- Validation Errors Summary -->
            <div v-if="Object.keys(validationErrors).length > 0" class="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
              <div class="flex items-start gap-2">
                <svg class="h-5 w-5 flex-shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
                <div class="flex-1">
                  <h3 class="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">{{ t('people.attachToAppModalValidationErrors') }}</h3>
                  <ul class="list-disc list-inside space-y-2">
                    <li v-for="(message, field) in validationErrors" :key="field" class="text-sm text-red-700 dark:text-red-300">
                      <span class="font-medium">{{ getFieldLabel(field) }}:</span> {{ message }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>

                      <div class="space-y-6">
              <!-- Helpdesk (and similar): tenant-defined roles only — no participation field metadata yet -->
              <div v-if="usesStandaloneRolePicker" class="space-y-1">
                <label
                  for="standalone-participation-role"
                  class="block text-sm/6 font-medium text-gray-900 dark:text-white"
                >{{ t('settings.modFieldsPbAssignRole') }}<span class="text-red-500">*</span>
                </label>
                <HeadlessSelect
                  id="standalone-participation-role"
                  :model-value="attachRoleStandalone"
                  :options="standaloneRoleListboxOptions"
                  :placeholder="peopleTypesLoading ? 'Loading...' : 'Select role...'"
                  allow-empty
                  :empty-label="peopleTypesLoading ? 'Loading...' : 'Select role...'"
                  empty-value=""
                  :disabled="loading || peopleTypesLoading"
                  wrapper-class="mt-2"
                  :options-class="attachModalListboxOptionsClass"
                  @update:model-value="onStandaloneRoleListboxUpdate"
                />
              </div>

              <!-- State Fields Section -->
              <div v-if="visibleStateFields.length > 0" class="space-y-4">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('people.attachToAppModalStateFields') }}</h3>
                <div class="space-y-6">
                  <div v-for="fieldName in visibleStateFields" :key="fieldName" class="space-y-1">
                    <!-- Hide classifier field if prefilled from participationType -->
                    <template v-if="isClassifierField(fieldName) && isClassifierPrefilled(fieldName)">
                      <!-- Show as read-only summary instead of input -->
                      <div class="rounded-md border border-gray-200 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-700/50">
                        <div class="flex items-center gap-2">
                          <svg class="w-4 h-4 text-success-600 dark:text-success-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                          </svg>
                          <div>
                            <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ getFieldLabel(fieldName) }}</div>
                            <div class="text-sm font-semibold text-gray-900 dark:text-white">{{ formData[fieldName] }}</div>
                          </div>
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <label :for="fieldName" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                        {{ getFieldLabel(fieldName) }}
                        <span v-if="isFieldRequired(fieldName)" class="text-red-500">*</span>
                      </label>
                    <HeadlessSelect
                      v-if="getFieldComponent(fieldName) === 'select'"
                      :id="fieldName"
                      :model-value="formData[fieldName] ?? ''"
                      :options="toListboxOptions(getFieldOptions(fieldName))"
                      :placeholder="`Select ${getFieldLabel(fieldName)}...`"
                      allow-empty
                      :empty-label="`Select ${getFieldLabel(fieldName)}...`"
                      empty-value=""
                      wrapper-class="mt-2"
                      :invalid="!!validationErrors[fieldName]"
                      :options-class="attachModalListboxOptionsClass"
                      @update:model-value="bindStateListboxValue(fieldName)"
                    />
                    <DatePicker
                      v-else-if="getInputType(fieldName) === 'date'"
                      :id="fieldName"
                      v-model="formData[fieldName]"
                      :invalid="!!validationErrors[fieldName]"
                      :input-class="attachFieldInputClass(fieldName, true)"
                    />
                    <input
                      v-else-if="getInputType(fieldName) === 'number'"
                      :id="fieldName"
                      :name="fieldName"
                      type="number"
                      v-model.number="formData[fieldName]"
                      :required="isFieldRequired(fieldName)"
                      :min="fieldName === 'lead_score' ? 0 : undefined"
                      :class="attachFieldInputClass(fieldName, false)"
                    />
                    <textarea
                      v-else-if="getFieldComponent(fieldName) === 'textarea'"
                      :id="fieldName"
                      :name="fieldName"
                      v-model="formData[fieldName]"
                      :required="isFieldRequired(fieldName)"
                      rows="3"
                      :class="[attachFieldInputClass(fieldName, false), 'resize-none']"
                    />
                    <input
                      v-else
                      :id="fieldName"
                      :name="fieldName"
                      type="text"
                      v-model="formData[fieldName]"
                      :required="isFieldRequired(fieldName)"
                      :class="attachFieldInputClass(fieldName, false)"
                    />
                    <p v-if="validationErrors[fieldName]" class="mt-1 text-sm text-red-600 dark:text-red-400">
                      {{ validationErrors[fieldName] }}
                    </p>
                    </template>
                  </div>
                </div>
              </div>

              <!-- Detail Fields Section -->
              <div v-if="detailFields.length > 0" class="space-y-4 border-t border-gray-200 pt-6 dark:border-gray-700">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('people.attachToAppModalDetailFields') }}</h3>
                <div class="space-y-6">
                  <div v-for="fieldName in detailFields" :key="fieldName" class="space-y-1">
                    <label :for="fieldName" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                      {{ getFieldLabel(fieldName) }}
                      <span v-if="isFieldRequired(fieldName)" class="text-red-500">*</span>
                    </label>
                    <HeadlessSelect
                      v-if="getFieldComponent(fieldName) === 'select'"
                      :id="fieldName"
                      :model-value="formData[fieldName] ?? ''"
                      :options="toListboxOptions(getFieldOptions(fieldName))"
                      :placeholder="`Select ${getFieldLabel(fieldName)}...`"
                      allow-empty
                      :empty-label="`Select ${getFieldLabel(fieldName)}...`"
                      empty-value=""
                      wrapper-class="mt-2"
                      :invalid="!!validationErrors[fieldName]"
                      :options-class="attachModalListboxOptionsClass"
                      @update:model-value="bindDetailListboxValue(fieldName)"
                    />
                    <DatePicker
                      v-else-if="getInputType(fieldName) === 'date'"
                      :id="fieldName"
                      v-model="formData[fieldName]"
                      :invalid="!!validationErrors[fieldName]"
                      :input-class="attachFieldInputClass(fieldName, true)"
                      @update:model-value="clearDefaultTracking(fieldName)"
                    />
                    <input
                      v-else-if="getInputType(fieldName) === 'number'"
                      :id="fieldName"
                      :name="fieldName"
                      type="number"
                      v-model.number="formData[fieldName]"
                      @input="clearDefaultTracking(fieldName)"
                      :required="isFieldRequired(fieldName)"
                      :min="fieldName === 'lead_score' || fieldName === 'estimated_value' ? 0 : undefined"
                      :class="attachFieldInputClass(fieldName, false)"
                    />
                    <textarea
                      v-else-if="getFieldComponent(fieldName) === 'textarea'"
                      :id="fieldName"
                      :name="fieldName"
                      v-model="formData[fieldName]"
                      @input="clearDefaultTracking(fieldName)"
                      :required="isFieldRequired(fieldName)"
                      rows="3"
                      :class="[attachFieldInputClass(fieldName, false), 'resize-none']"
                    />
                    <input
                      v-else
                      :id="fieldName"
                      :name="fieldName"
                      type="text"
                      v-model="formData[fieldName]"
                      @input="clearDefaultTracking(fieldName)"
                      :required="isFieldRequired(fieldName)"
                      :class="attachFieldInputClass(fieldName, false)"
                    />
                    <p v-if="validationErrors[fieldName]" class="mt-1 text-sm text-red-600 dark:text-red-400">
                      {{ validationErrors[fieldName] }}
                    </p>
                    <!-- Helper text for prefilled default values -->
                    <p v-if="isFieldPrefilledWithDefault(fieldName)" class="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">
                      Default value selected — you can change this.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div
                v-if="visibleStateFields.length === 0 && detailFields.length === 0 && !usesStandaloneRolePicker"
                class="text-center py-8"
              >
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  No participation fields available for {{ formatAppName(appKey) }}{{ controllingStateValue ? ` (${controllingStateValue})` : '' }}.
                </p>
              </div>

                      </div>
                      </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex shrink-0 justify-end gap-3 border-t border-gray-200 bg-white px-4 py-4 sm:px-6 dark:border-gray-700 dark:bg-gray-800">
                      <button
                        type="button"
                        class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:ring-gray-600 dark:hover:bg-gray-700 cursor-pointer"
                        @click="close"
                      >{{ t('performance.cancelWizard') }}</button>
                      <button
                        type="submit"
                        :disabled="loading"
                        class="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600 cursor-pointer"
                      >
                        <svg v-if="loading" class="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{{ loading ? 'Attaching...' : 'Attach' }}</span>
                      </button>
                    </div>
                  </form>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { resolveFieldLabel } from '@/utils/fieldLabelResolver';
import { getAppNameKey } from '@/utils/navigationLabels';

const { t, te } = useI18n();
declare const process: { env: Record<string, string | undefined> };

import { ref, computed, watch, onMounted, toRef } from 'vue';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import {
  PEOPLE_FIELD_METADATA,
  getStateFields,
  getDetailFields,
  getFieldMetadata,
  getAppFields
} from '@/platform/fields/peopleFieldModel';
import apiClient from '@/utils/apiClient';
import { toAttachRole } from '@/utils/getParticipation';
import { usePeopleTypes } from '@/composables/usePeopleTypes';
import { usePeopleModuleFields } from '@/composables/usePeopleModuleFields';
import DatePicker from '@/components/common/DatePicker.vue';
import { assertAttachPermission } from '@/platform/permissions/peopleGuards';
import { isPeopleSalesRoleFieldKey } from '@/utils/peopleParticipationUi';
import {
  defaultPicklistFallback,
  getPeoplePicklistValues,
  isPeoplePicklistModuleField,
} from '@/utils/peopleModuleFieldUtils';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';

const props = withDefaults(
  defineProps<{
    isOpen?: boolean;
    personId: string;
    appKey: string;
    participationType?: string | null;
  }>(),
  {
    isOpen: false,
    participationType: null
  }
);

const emit = defineEmits<{
  close: [];
  attached: [data: unknown];
}>();

const loading = ref(false);
const error = ref<string | null>(null);
const validationErrors = ref<Record<string, string>>({});
type ParticipationFormValue = string | number | null | string[];
const formData = ref<Record<string, ParticipationFormValue>>({});
/** HELPDESK: role-only attach (tenant types from API / usePeopleTypes) */
const attachRoleStandalone = ref('');

function onStandaloneRoleListboxUpdate(v: string | number | null) {
  attachRoleStandalone.value = v == null ? '' : String(v);
}

// Track which fields have been prefilled with defaults (for UX helper text)
const defaultPrefilledFields = ref(new Set<string>());

// People types from tenant config (SALES: Lead/Contact; HELPDESK: Customer/Agent)
const { types: peopleTypes, typeDefs: peopleTypeDefs, defaultRole: peopleDefaultRole, loading: peopleTypesLoading } =
  usePeopleTypes(toRef(props, 'appKey'));
const { fields: peopleModuleFields } = usePeopleModuleFields();

const usesStandaloneRolePicker = computed(() => props.appKey === 'HELPDESK');

// Get participation fields for the app
const participationFields = computed(() => {
  return Object.entries(PEOPLE_FIELD_METADATA)
    .filter(([, metadata]) => metadata.owner === 'participation' && metadata.fieldScope === props.appKey)
    .map(([name]) => name);
});

// Get state fields for the app
const stateFields = computed(() => {
  return getStateFields(props.appKey);
});

// Get detail fields for the app
const allDetailFields = computed(() => {
  return getDetailFields(props.appKey);
});

/**
 * Identify the controlling state field (the classifier field)
 * This is the state field that determines which detail fields are visible
 */
const controllingStateField = computed(() => {
  const stateFieldsList = stateFields.value;
  // Find the state field that acts as classifier (typically the first one or the one that represents participation type)
  // For SALES, canonical classifier is `sales_type` (Lead/Contact)
  // We identify it by checking if it's the classifier field
  const classifierFieldName = getClassifierField(props.appKey);
  if (classifierFieldName && stateFieldsList.includes(classifierFieldName)) {
    return classifierFieldName;
  }
  // Fallback: return first state field if no classifier found
  return stateFieldsList.length > 0 ? stateFieldsList[0] : null;
});

/**
 * Get the current value of the controlling state field
 */
const controllingStateValue = computed((): string | null => {
  if (!controllingStateField.value) return null;
  const raw = formData.value[controllingStateField.value];
  if (raw === null || raw === undefined || raw === '') return null;
  return String(raw);
});

/** Role used for tenant-configured / default participation field set (SALES: sales_type; HELPDESK: standalone picker). */
const effectiveRoleForFieldSet = computed((): string | null => {
  if (usesStandaloneRolePicker.value) {
    const r = attachRoleStandalone.value;
    return r && String(r).trim() ? String(r).trim() : null;
  }
  const v = controllingStateValue.value;
  return v && String(v).trim() ? String(v).trim() : null;
});

/** Field keys to show for the selected type — aligned with Quick Create / AppSection (Settings → Types). */
const appFieldKeysForRole = computed((): Set<string> | null => {
  const role = effectiveRoleForFieldSet.value;
  if (!role) return null;
  const keys = getAppFields(props.appKey, role, peopleTypeDefs.value);
  return keys.length > 0 ? new Set(keys) : null;
});

function isHelpdeskStandaloneRoleField(fieldName: string): boolean {
  return props.appKey === 'HELPDESK' && fieldName === 'helpdesk_role';
}

/**
 * Get visible state fields based on controlling state
 */
const visibleStateFields = computed(() => {
  return stateFields.value.filter((fieldName) => {
    if (usesStandaloneRolePicker.value && isHelpdeskStandaloneRoleField(fieldName)) {
      return false;
    }
    if (isClassifierField(fieldName)) return true;
    const set = appFieldKeysForRole.value;
    if (set && set.size > 0) {
      return set.has(fieldName);
    }
    return isStateFieldVisible(fieldName);
  });
});

type FieldPattern = (fieldName: string) => boolean;

interface VisibilityRule {
  showPatterns?: FieldPattern[];
  hidePatterns?: FieldPattern[];
  stateFieldShowPatterns?: FieldPattern[];
  stateFieldHidePatterns?: FieldPattern[];
}

/**
 * Visibility rules mapping per app
 * Uses pattern-based detection to avoid hardcoding field names
 * This is declarative and extensible for future apps
 */
const getVisibilityRules = (appKey: string): Record<string, VisibilityRule> => {
  // For SALES app: Lead vs Contact
  if (appKey === 'SALES') {
    return {
      // When type === 'Lead': show Lead-specific detail fields
      'Lead': {
        // Pattern-based: fields starting with 'lead_' or 'qualification_' or specific Lead-related fields
        showPatterns: [
          (fieldName) => fieldName.startsWith('lead_'),
          (fieldName) => fieldName.startsWith('qualification_'),
          (fieldName) => fieldName === 'estimated_value',
          (fieldName) => fieldName === 'interest_products'
        ],
        // Hide Contact-specific detail fields
        hidePatterns: [
          (fieldName) => fieldName === 'role',
          (fieldName) => fieldName === 'birthday',
          (fieldName) => fieldName === 'preferred_contact_method'
        ],
        // State field visibility rules
        stateFieldShowPatterns: [
          (fieldName) => fieldName === 'lead_status'
        ],
        stateFieldHidePatterns: [
          (fieldName) => fieldName === 'contact_status'
        ]
      },
      // When type === 'Contact': show Contact-specific detail fields
      'Contact': {
        showPatterns: [
          (fieldName) => fieldName === 'role',
          (fieldName) => fieldName === 'birthday',
          (fieldName) => fieldName === 'preferred_contact_method'
        ],
        // Hide Lead-specific detail fields
        hidePatterns: [
          (fieldName) => fieldName.startsWith('lead_'),
          (fieldName) => fieldName.startsWith('qualification_'),
          (fieldName) => fieldName === 'estimated_value',
          (fieldName) => fieldName === 'interest_products'
        ],
        // State field visibility rules
        stateFieldShowPatterns: [
          (fieldName) => fieldName === 'contact_status'
        ],
        stateFieldHidePatterns: [
          (fieldName) => fieldName === 'lead_status'
        ]
      }
    };
  }
  // Future apps can add their rules here
  return {};
};

/**
 * Check if a state field should be visible based on controlling state
 */
const isStateFieldVisible = (fieldName: string): boolean => {
  // Classifier field is always visible
  if (isClassifierField(fieldName)) {
    return true;
  }
  
  // If no controlling state field, show all state fields
  if (!controllingStateField.value || !controllingStateValue.value) {
    return true;
  }
  
  // Get visibility rules for current app
  const rules = getVisibilityRules(props.appKey);
  const stateValue = controllingStateValue.value;
  const rule = stateValue ? rules[stateValue] : undefined;

  // If no rules for this state value, show the field (default behavior)
  if (!rule) {
    return true;
  }

  // Check if field matches any hide pattern for state fields
  if (rule.stateFieldHidePatterns && rule.stateFieldHidePatterns.some(pattern => pattern(fieldName))) {
    return false;
  }
  
  // Check if field matches any show pattern for state fields
  if (rule.stateFieldShowPatterns && rule.stateFieldShowPatterns.some(pattern => pattern(fieldName))) {
    return true;
  }
  
  // If show patterns exist but field doesn't match any, hide it (strict mode)
  // This ensures only relevant state fields are shown
  if (rule.stateFieldShowPatterns && rule.stateFieldShowPatterns.length > 0) {
    return false;
  }
  
  // Default: show the field if no explicit rule
  return true;
};

/**
 * Check if a detail field should be visible based on controlling state
 */
const isDetailFieldVisible = (fieldName: string): boolean => {
  // If no controlling state field, show all detail fields
  if (!controllingStateField.value || !controllingStateValue.value) {
    return true;
  }
  
  // Get visibility rules for current app
  const rules = getVisibilityRules(props.appKey);
  const stateValue = controllingStateValue.value;
  const rule = stateValue ? rules[stateValue] : undefined;

  // If no rules for this state value, show the field (default behavior)
  if (!rule) {
    return true;
  }

  // Check if field matches any hide pattern
  if (rule.hidePatterns && rule.hidePatterns.some(pattern => pattern(fieldName))) {
    return false;
  }
  
  // Check if field matches any show pattern
  if (rule.showPatterns && rule.showPatterns.some(pattern => pattern(fieldName))) {
    return true;
  }
  
  // If show patterns exist but field doesn't match any, hide it (strict mode)
  // This ensures only relevant fields are shown
  if (rule.showPatterns && rule.showPatterns.length > 0) {
    return false;
  }
  
  // Default: show the field if no explicit rule
  return true;
};

/**
 * Get visible detail fields based on controlling state
 */
const detailFields = computed(() => {
  const set = appFieldKeysForRole.value;
  if (set && set.size > 0) {
    return allDetailFields.value.filter((fieldName) => {
      if (usesStandaloneRolePicker.value && isHelpdeskStandaloneRoleField(fieldName)) {
        return false;
      }
      return set.has(fieldName);
    });
  }
  return allDetailFields.value.filter((fieldName) => isDetailFieldVisible(fieldName));
});

/**
 * Get all visible participation fields (visible state + visible detail fields)
 * This is used for payload sanitization
 */
const visibleParticipationFields = computed(() => {
  return [
    ...visibleStateFields.value, // Only visible state fields
    ...detailFields.value // Only visible detail fields
  ];
});

// Format app name
const formatAppName = (appKey: string): string => {
  const nameKey = getAppNameKey(appKey);
  if (nameKey && te(nameKey)) return t(nameKey);
  return appKey;
};

const getFieldLabel = (fieldName: string): string => {
  return resolveFieldLabel('people', { key: fieldName }, t, te);
};

// Check if field is required
const isFieldRequired = (fieldName: string): boolean => {
  const metadata = getFieldMetadata(fieldName);
  return metadata.requiredFor?.includes(props.appKey) || false;
};

// Identify the classifier state field (primary participation type field)
// This is the field that represents the participation intent selected earlier
const getClassifierField = (appKey: string): string | null => {
  // Map app keys to their classifier field names
  const classifierFields: Record<string, string> = {
    SALES: 'sales_type', // Lead/Contact (virtual)
    // Future apps can add their classifier fields here
  };
  return classifierFields[appKey] ?? null;
};

// Check if a field is the classifier field
const isClassifierField = (fieldName: string): boolean => {
  const classifierField = getClassifierField(props.appKey);
  return classifierField === fieldName;
};

// Check if classifier field is prefilled from participationType
const isClassifierPrefilled = (fieldName: string): boolean => {
  if (!isClassifierField(fieldName)) return false;
  if (!props.participationType) return false;
  // Check if formData has the field set from participationType
  return Boolean(formData.value[fieldName] && formData.value[fieldName] !== '');
};

// Get display text for participation type
const participationTypeDisplay = computed(() => {
  if (!props.participationType) return null;
  // Convert 'LEAD' -> 'Lead', 'CONTACT' -> 'Contact', etc.
  return props.participationType.charAt(0) + props.participationType.slice(1).toLowerCase();
});

// Get field component type
const getFieldComponent = (fieldName: string): 'select' | 'textarea' | 'input' => {
  if (isPeopleSalesRoleFieldKey(fieldName)) return 'select';
  if (isPeoplePicklistModuleField(peopleModuleFields.value, fieldName)) return 'select';

  const textFields = ['qualification_notes'];
  if (textFields.includes(fieldName)) {
    return 'textarea';
  }

  return 'input';
};

const standaloneRoleOptions = computed(() =>
  peopleTypes.value?.length ? peopleTypes.value : ['Customer', 'Agent']
);

const standaloneRoleListboxOptions = computed(() =>
  standaloneRoleOptions.value.map((t) => ({ value: t, label: t }))
);

/** Above drawer overlay (Dialog z-[10000]) */
const attachModalListboxOptionsClass = 'z-[10020]';

function toListboxOptions(values: string[]) {
  return (Array.isArray(values) ? values : []).map((v) => ({ value: v, label: v }));
}

/** Match DynamicFormField / CreateRecordDrawer inputs */
function attachFieldInputClass(fieldName: string, isDate: boolean) {
  const base =
    'block w-full mt-2 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500';
  const err = validationErrors.value[fieldName]
    ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500'
    : '';
  return [base, err, isDate ? 'cursor-pointer' : ''].filter(Boolean);
}

// Get field options for select fields
const getFieldOptions = (fieldName: string): string[] => {
  if (isPeopleSalesRoleFieldKey(fieldName)) {
    return peopleTypes.value?.length ? peopleTypes.value : ['Lead', 'Contact'];
  }
  return getPeoplePicklistValues(
    peopleModuleFields.value,
    fieldName,
    defaultPicklistFallback(fieldName)
  );
};

// Get input type for input fields
const getInputType = (fieldName: string): 'date' | 'number' | 'text' => {
  const dateFields = ['qualification_date', 'birthday'];
  if (dateFields.includes(fieldName)) {
    return 'date';
  }
  
  const numberFields = ['lead_score', 'estimated_value'];
  if (numberFields.includes(fieldName)) {
    return 'number';
  }
  
  return 'text';
};

/**
 * Get default value for a state field based on app context and classifier value
 * Returns null if no safe default exists
 * 
 * @param {string} fieldName - The field name
 * @param {string} appKey - The app key (e.g., 'SALES')
 * @param {string} classifierValue - The current classifier value (e.g., 'Lead', 'Contact')
 * @returns {string|null} - The default value or null
 */
const getDefaultStateValue = (
  fieldName: string,
  appKey: string,
  classifierValue: string
): string | null => {
  // Only provide defaults for participation state fields
  const metadata = getFieldMetadata(fieldName);
  if (metadata.owner !== 'participation' || metadata.intent !== 'state') {
    return null;
  }
  
  // SALES app defaults
  if (appKey === 'SALES') {
    // Lead-specific defaults
    if (classifierValue === 'Lead') {
      if (fieldName === 'lead_status') {
        return 'New';
      }
    }
    
    // Contact-specific defaults
    if (classifierValue === 'Contact') {
      if (fieldName === 'contact_status') {
        return 'Active';
      }
    }
  }
  
  // Future apps can add their defaults here
  // Example:
  // if (appKey === 'HELPDESK') {
  //   if (classifierValue === 'Customer' && fieldName === 'ticket_status') {
  //     return 'Open';
  //   }
  // }
  
  return null;
};

/**
 * Check if a field was prefilled with a default value
 */
const isFieldPrefilledWithDefault = (fieldName: string): boolean => {
  return defaultPrefilledFields.value.has(fieldName);
};

/**
 * Apply smart defaults to visible state fields
 * Only applies defaults when:
 * - Field becomes visible
 * - Field has no existing value
 * - Default exists for the field
 */
const applySmartDefaults = (): void => {
  const classifierValue = controllingStateValue.value;
  if (!classifierValue) {
    // No classifier value yet, can't apply defaults
    return;
  }
  
  // Apply defaults to visible state fields
  visibleStateFields.value.forEach(fieldName => {
    // Skip classifier field (it's already set)
    if (isClassifierField(fieldName)) {
      return;
    }
    
    // Only apply if field has no value
    const currentValue = formData.value[fieldName];
    if (currentValue !== null && currentValue !== undefined && currentValue !== '') {
      // Field already has a value, don't override
      return;
    }
    
    // Get default value
    const defaultValue = getDefaultStateValue(fieldName, props.appKey, classifierValue);
    if (defaultValue !== null) {
      // Apply default
      formData.value[fieldName] = defaultValue;
      // Track that this field was prefilled with a default
      defaultPrefilledFields.value.add(fieldName);
    }
  });
};

/**
 * Clear default tracking when user manually changes a prefilled field
 */
const clearDefaultTracking = (fieldName: string): void => {
  if (defaultPrefilledFields.value.has(fieldName)) {
    defaultPrefilledFields.value.delete(fieldName);
  }
};

/** Typed HeadlessSelect handlers — avoids implicit-`any` on `@update:model-value` in templates (vue-tsc). */
const bindStateListboxValue = (fieldName: string) => (v: string | number | null | undefined) => {
  formData.value[fieldName] = v ?? '';
};
const bindDetailListboxValue = (fieldName: string) => (v: string | number | null | undefined) => {
  formData.value[fieldName] = v ?? '';
  clearDefaultTracking(fieldName);
};

// Initialize form data
const initializeFormData = (): void => {
  formData.value = {};
  attachRoleStandalone.value = '';
  // Clear default tracking when initializing
  defaultPrefilledFields.value.clear();
  
  // Prefill classifier field from participationType if provided
  const classifierField = getClassifierField(props.appKey);
  if (props.participationType && classifierField && participationFields.value.includes(classifierField)) {
    // Convert participationType to field value format
    // 'LEAD' -> 'Lead', 'CONTACT' -> 'Contact', etc.
    const normalizedValue = props.participationType.charAt(0) + props.participationType.slice(1).toLowerCase();
    formData.value[classifierField] = normalizedValue;
  }
  
  // Initialize all participation fields with empty values
  participationFields.value.forEach(fieldName => {
    if (!formData.value.hasOwnProperty(fieldName)) {
      // Initialize based on field type
      if (getFieldComponent(fieldName) === 'select') {
        formData.value[fieldName] = '';
      } else if (getInputType(fieldName) === 'number') {
        formData.value[fieldName] = '';
      } else if (fieldName === 'interest_products') {
        // Array field - initialize as empty array
        formData.value[fieldName] = [];
      } else {
        formData.value[fieldName] = '';
      }
    }
  });
  
  // Apply smart defaults after initialization
  // Use setTimeout to ensure computed properties are updated
  setTimeout(() => {
    applySmartDefaults();
    if (usesStandaloneRolePicker.value) {
      const opts = standaloneRoleOptions.value;
      const dr = peopleDefaultRole.value;
      if (opts.length && !attachRoleStandalone.value) {
        const pick =
          dr && opts.some((t) => t.toLowerCase() === String(dr).toLowerCase())
            ? opts.find((t) => t.toLowerCase() === String(dr).toLowerCase()) || opts[0]
            : opts[0];
        if (pick != null && pick !== '') attachRoleStandalone.value = pick;
      }
    }
  }, 0);
};

// When tenant types load after open, apply default classifier / Helpdesk role (not overriding participationType)
watch(
  [peopleTypes, peopleDefaultRole, () => props.isOpen, () => props.participationType],
  () => {
    if (!props.isOpen || props.participationType) return;
    if (usesStandaloneRolePicker.value) {
      const opts = standaloneRoleOptions.value;
      const dr = peopleDefaultRole.value;
      if (opts.length && !attachRoleStandalone.value && dr) {
        const pick =
          opts.find((t) => t.toLowerCase() === String(dr).toLowerCase()) || opts[0];
        if (pick != null && pick !== '') attachRoleStandalone.value = pick;
      }
      return;
    }
    const cf = getClassifierField(props.appKey);
    if (!cf || !peopleTypes.value?.length) return;
    const current = formData.value[cf];
    if (current !== undefined && current !== null && String(current).trim() !== '') return;
    const dr = peopleDefaultRole.value;
    const pick =
      dr && peopleTypes.value.some((t) => t.toLowerCase() === String(dr).toLowerCase())
        ? peopleTypes.value.find((t) => t.toLowerCase() === String(dr).toLowerCase()) || peopleTypes.value[0]
        : peopleTypes.value[0];
    if (pick) {
      formData.value = { ...formData.value, [cf]: pick };
      setTimeout(() => applySmartDefaults(), 0);
    }
  },
  { immediate: true }
);

// Watch for modal open/close
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    initializeFormData();
    error.value = null;
    validationErrors.value = {};
  }
});

// Watch for appKey changes
watch(() => props.appKey, () => {
  if (props.isOpen) {
    initializeFormData();
  }
});

// Watch for participationType changes
watch(() => props.participationType, () => {
  if (props.isOpen) {
    const classifierField = getClassifierField(props.appKey);
    if (classifierField && props.participationType) {
      const normalizedValue = props.participationType.charAt(0) + props.participationType.slice(1).toLowerCase();
      formData.value[classifierField] = normalizedValue;
      // Apply smart defaults after classifier is set
      setTimeout(() => {
        applySmartDefaults();
      }, 0);
    }
  }
});

// Watch for classifier value changes (when user changes type)
watch(controllingStateValue, (newValue, oldValue) => {
  if (props.isOpen && newValue && newValue !== oldValue) {
    // Classifier changed, apply smart defaults for newly visible fields
    setTimeout(() => {
      applySmartDefaults();
    }, 0);
  }
});

// Watch for visible state fields changes (when fields become visible)
watch(visibleStateFields, (newFields, oldFields) => {
  if (props.isOpen && newFields.length > 0) {
    // Check if any new fields became visible
    const newVisibleFields = newFields.filter(field => !oldFields || !oldFields.includes(field));
    if (newVisibleFields.length > 0) {
      // New fields became visible, apply defaults
      setTimeout(() => {
        applySmartDefaults();
      }, 0);
    }
  }
}, { deep: true });

// Close handler
const close = () => {
  if (!loading.value) {
    emit('close');
  }
};

// Handle form submission
const handleSubmit = async () => {
  // Guard: Check permission before submitting
  assertAttachPermission(props.appKey);
  
  error.value = null;
  validationErrors.value = {};
  
  if (usesStandaloneRolePicker.value) {
    if (!attachRoleStandalone.value || !String(attachRoleStandalone.value).trim()) {
      error.value = 'Role is required';
      return;
    }
  } else {
    // Validate required fields - only check visible fields
    const visibleFields = [
      ...visibleStateFields.value,
      ...detailFields.value
    ];

    const requiredFields = visibleFields.filter((fieldName) => isFieldRequired(fieldName));

    const errors: Record<string, string> = {};
    requiredFields.forEach((fieldName) => {
      const value = formData.value[fieldName];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        errors[fieldName] = `${getFieldLabel(fieldName)} is required`;
      }
    });

    if (Object.keys(errors).length > 0) {
      validationErrors.value = errors;
      return;
    }
  }
  
  // Clean form data: convert empty strings to null for enum fields
  const cleanedFormData = { ...formData.value };
  const enumFields = ['lead_status', 'contact_status', 'role', 'preferred_contact_method'];
  enumFields.forEach(field => {
    if (cleanedFormData[field] === '') {
      cleanedFormData[field] = null;
    }
  });
  
  // Sanitize payload: Only include VISIBLE participation fields
  // Hidden fields may exist in formData but must NOT be submitted
  const participationData: Record<string, unknown> = {};
  const classifierField = getClassifierField(props.appKey);
  
  // Only iterate over visible fields
  visibleParticipationFields.value.forEach(fieldName => {
    const value = cleanedFormData[fieldName];
    // Always include classifier field if it exists (even if prefilled)
    if (fieldName === classifierField && value) {
      participationData[fieldName] = value;
    } else if (value !== null && value !== '' && (!Array.isArray(value) || value.length > 0)) {
      participationData[fieldName] = value;
    }
  });
  
  // Defensive guardrail: Ensure no hidden fields are included
  // This catches regressions where hidden fields might accidentally be included
  if (process.env.NODE_ENV === 'development') {
    const allParticipationFieldNames = participationFields.value;
    const hiddenFields = allParticipationFieldNames.filter(fieldName => 
      !visibleParticipationFields.value.includes(fieldName)
    );
    
    const hiddenFieldsInPayload = hiddenFields.filter(fieldName => 
      participationData.hasOwnProperty(fieldName)
    );
    
    if (hiddenFieldsInPayload.length > 0) {
      const errorMessage = `Hidden participation field(s) were included in submission: ${hiddenFieldsInPayload.join(', ')}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
  
  loading.value = true;
  
  try {
    const salesRolePick = participationData.sales_type;
    const roleFromForm =
      salesRolePick === 'Lead'
        ? 'Lead'
        : salesRolePick === 'Contact'
          ? 'Contact'
          : salesRolePick != null && salesRolePick !== ''
            ? String(salesRolePick)
            : '';
    const role = usesStandaloneRolePicker.value
      ? toAttachRole(String(attachRoleStandalone.value))
      : toAttachRole(props.participationType || roleFromForm);
    if (!role) {
      error.value = 'Participation type (role) is required';
      return;
    }

    const payload: { appKey: string; role: string; formData?: Record<string, unknown> } = {
      appKey: props.appKey,
      role
    };
    if (!usesStandaloneRolePicker.value) {
      payload.formData = participationData;
    }

    const response = (await apiClient.post(`/people/${props.personId}/attach`, payload)) as {
      success?: boolean;
      data?: unknown;
      errors?: Record<string, string>;
      message?: string;
    };

    if (response.success) {
      emit('attached', response.data);
      close();
    } else {
      if (response.errors) {
        validationErrors.value = response.errors;
        error.value = response.message || 'Validation failed. Please check the fields below.';
      } else {
        error.value = response.message || 'Failed to attach app participation';
      }
    }
  } catch (err: unknown) {
    console.error('Error attaching app participation:', err);
    const ax = err as {
      response?: { data?: { errors?: Record<string, string>; message?: string; code?: string } };
      message?: string;
    };

    if (ax.response?.data?.errors) {
      validationErrors.value = ax.response.data.errors;
      error.value = ax.response.data.message || 'Validation failed. Please check the fields below.';
    } else if (ax.response?.data?.message) {
      const errorMessage = ax.response.data.message;
      // Preserve backend message for participation exists errors (includes conversion guidance)
      if (ax.response.data.code === 'PARTICIPATION_EXISTS' || errorMessage.includes('already participates')) {
        error.value = errorMessage; // Use backend message which includes conversion guidance
      } else {
        error.value = errorMessage;
      }
    } else {
      error.value = ax.message || 'Error attaching app participation';
    }
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (props.isOpen) {
    initializeFormData();
  }
});
</script>

