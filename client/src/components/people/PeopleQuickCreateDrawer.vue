<!--
  ============================================================================
  ARCHITECTURAL INVARIANT: PEOPLE QUICK CREATE DRAWER
  ============================================================================
  
  CONFIG-DRIVEN + CONTEXT-AWARE:
  - Quick create fields: getPeopleQuickCreateFields(module) — Settings → People → Quick Create
  - context: 'ALL' | 'SALES' | 'HELPDESK' — determines UI and submission
  
  ALL CONTEXTS: Quick create fields always visible (identity); optional Full Form via footer toggle
  
  ALL APPS TAB (optionalAppParticipation + contextAppKey null):
  - App participation card picker (multi-select) → AppSection per selected app
  
  APP CONTEXT (when context !== 'ALL'):
  - AppSection for active app with type + dependent fields
  
  EDIT MODE (record prop):
  - Same quick/full UI and app participation as create
  - Core: PUT /people/:id/update-core (mode-filtered fields)
  - Participation: PUT update-app-fields or POST attach for new apps
  
  ============================================================================
-->

<template>
  <WorkspaceScopedDrawerShell
    :is-open="isOpen"
    draft-module-key="people"
    :draft-record-id="editPersonId"
    @backdrop="handleDialogClose"
    @escape="handleDialogClose"
  >
              <div
                :class="[
                  'rounded-tl-xl overflow-hidden flex h-full flex-col bg-white dark:bg-gray-900 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 w-screen max-w-full overflow-x-hidden transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width]',
                  drawerPanelClass
                ]"
              >
                <form @submit.prevent="handleSubmit" class="relative flex h-full flex-col">
                  <!-- Header -->
                  <div class="relative flex shrink-0 items-center gap-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4 sm:px-6">
                    <div class="min-w-0 shrink-0 pr-2">
                      <h2 class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{{ drawerTitle }}</h2>
                    </div>
                    <div
                      v-if="fullMode"
                      class="pointer-events-none absolute inset-x-5 top-1/2 z-10 flex -translate-y-1/2 justify-center sm:inset-x-6"
                    >
                      <div class="pointer-events-auto relative w-full max-w-xs">
                        <label class="sr-only" for="people-create-field-search">{{ t('common.massEditSearchFields') }}</label>
                        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                        <input
                          id="people-create-field-search"
                          v-model="fieldSearch"
                          type="text"
                          :class="FORM_FIELD_SEARCH_CONTROL_CLASS"
                          :placeholder="t('common.massEditSearchFields')"
                          autocomplete="off"
                        />
                        <button
                          v-if="fieldSearch"
                          type="button"
                          class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                          :aria-label="t('records.activityClearSearchAria')"
                          @click="fieldSearch = ''"
                        >
                          <XMarkIcon class="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      class="relative z-20 ml-auto shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer"
                      @click="requestClose"
                    >
                      <span class="absolute -inset-2.5" />
                      <span class="sr-only">{{ t('forms.previewClosePanelSr') }}</span>
                      <XMarkIcon class="size-5" aria-hidden="true" />
                    </button>
                  </div>

                  <!-- Body -->
                  <div class="h-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                    <div
                      class="px-5 sm:px-6 py-5"
                      @input.capture="markFormChanged"
                      @change.capture="markFormChanged"
                      @pointerdown.capture="markUserInteraction"
                    >
                      <div :class="drawerBodyLayoutClass">
                        <!-- General Error Message -->
                        <div v-if="errors._general" class="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                          <div class="flex">
                            <div class="flex-shrink-0">
                              <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                              </svg>
                            </div>
                            <div class="ml-3">
                              <p class="text-sm text-red-800 dark:text-red-200">{{ errors._general }}</p>
                            </div>
                          </div>
                        </div>
                        
                        <!-- STEP 1: Core fields (always visible) -->
                        <div v-if="peopleModuleLoading || editLoading" class="flex justify-center py-12">
                          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                        </div>
                        <template v-else-if="peopleModuleOverride">
                          <div class="flex flex-col gap-8">
                            <!-- Single form instance: toggling quick/full must not remount (preserves values). -->
                            <DynamicForm
                              moduleKey="people"
                              :formData="formData"
                              :errors="errors"
                              :quickCreateMode="!fullMode && strictQuickCreateForForm"
                              :showAllFields="fullMode"
                              :fieldsOverride="fullMode ? null : coreQuickCreateFieldsOverride"
                              :excludeFields="coreFormExcludeFields"
                              :moduleOverride="peopleModuleOverride"
                              :singleColumn="!fullMode"
                              :useQuickCreateOrder="!fullMode"
                              :fieldSearch="fullMode ? fieldSearch : ''"
                              :createSurfaceComposites="fullMode ? peopleFullModeComposites : []"
                              context="platform"
                              @update:formData="updateFormData"
                              @ready="onFormReady"
                            >
                              <!-- DynamicForm is JS; static #slot names are typed as {}. -->
                              <template #[appParticipationSlot]>
                                <CreateDrawerCollapsibleSection
                                  v-if="hasAppParticipationSection && !fieldSearch.trim()"
                                  :title="t('records.genericAppParticipation')"
                                  storage-key="create-drawer-section:people:composite-app_participation"
                                  :default-open="true"
                                  content-class="flex flex-col gap-4"
                                >
                                  <p class="text-sm text-gray-500 dark:text-gray-400">
                                    {{ t('people.peopleQuickCreateDrawerSelectAppsHint') }}
                                  </p>
                                  <PeopleCreateParticipationBody
                                    :optional-app-participation="optionalAppParticipation"
                                    :context-app-key-is-null="contextAppKeyPropIsNull"
                                    :available-participation-apps="availableParticipationApps"
                                    :selected-optional-app-keys="selectedOptionalAppKeys"
                                    :effective-app-key="effectiveAppKey"
                                    :single-column="false"
                                    :people-module-override="peopleModuleOverride"
                                    :is-app-selected="isAppSelected"
                                    :get-participation-app-meta="getParticipationAppMeta"
                                    :get-app-label="getAppLabel"
                                    :get-app-form="getAppForm"
                                    :get-app-errors="getAppErrors"
                                    :single-app-form="singleAppForm"
                                    @toggle-app="toggleAppSelection"
                                    @set-app-form="({ appKey, value }) => setAppForm(appKey, value)"
                                    @update:single-app-form="(v) => (singleAppForm = v)"
                                  />
                                </CreateDrawerCollapsibleSection>
                              </template>
                            </DynamicForm>

                            <!-- Quick mode: participation below QC fields (outside layout surface) -->
                            <section
                              v-if="!fullMode && hasAppParticipationSection"
                              :class="participationSectionClass"
                            >
                              <div class="space-y-1">
                                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                                  {{ t('records.genericAppParticipation') }}
                                </h3>
                                <p class="text-sm text-gray-500 dark:text-gray-400">
                                  {{ t('people.peopleQuickCreateDrawerSelectAppsHint') }}
                                </p>
                              </div>
                              <PeopleCreateParticipationBody
                                :optional-app-participation="optionalAppParticipation"
                                :context-app-key-is-null="contextAppKeyPropIsNull"
                                :available-participation-apps="availableParticipationApps"
                                :selected-optional-app-keys="selectedOptionalAppKeys"
                                :effective-app-key="effectiveAppKey"
                                :single-column="true"
                                :people-module-override="peopleModuleOverride"
                                :is-app-selected="isAppSelected"
                                :get-participation-app-meta="getParticipationAppMeta"
                                :get-app-label="getAppLabel"
                                :get-app-form="getAppForm"
                                :get-app-errors="getAppErrors"
                                :single-app-form="singleAppForm"
                                @toggle-app="toggleAppSelection"
                                @set-app-form="({ appKey, value }) => setAppForm(appKey, value)"
                                @update:single-app-form="(v) => (singleAppForm = v)"
                              />
                            </section>
                          </div>
                        </template>
                        <p v-else-if="isOpen" class="text-sm text-amber-600 dark:text-amber-400">{{ t('people.peopleQuickCreateDrawerCouldNotLoadPeopleModulePlease') }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Footer -->
                  <div class="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur px-5 py-3.5 sm:px-6">
                    <button
                      v-if="showFullModeToggle"
                      type="button"
                      class="text-sm font-medium text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 cursor-pointer transition-colors"
                      @click="toggleFullMode"
                    >
                      {{ fullMode ? t('common.drawerBackQuickCreate') : t('common.drawerShowAllFields') }}
                    </button>
                    <div v-else class="flex-1" />
                    <div class="flex items-center gap-2.5">
                      <button
                        type="button"
                        class="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                        @click="requestClose"
                      >{{ t('actions.cancel') }}</button>
                      <button
                        type="submit"
                        :disabled="saving || submitDisabled"
                        class="inline-flex min-w-[5.5rem] justify-center rounded-lg bg-indigo-600 dark:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 dark:hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        {{ saving ? t('states.saving') : (isEditMode ? t('actions.update') : t('actions.save')) }}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
  </WorkspaceScopedDrawerShell>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
// Type declaration for process.env (used in DEV-ONLY guards)
declare const process: {
  env: {
    NODE_ENV: string;
  };
};

import { ref, computed, watch, toRef, nextTick, onUnmounted, type PropType, type Component } from 'vue';
import { XMarkIcon, BriefcaseIcon, LifebuoyIcon, CheckCircleIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import DynamicForm from '@/components/common/DynamicForm.vue';
import CreateDrawerCollapsibleSection from '@/components/common/CreateDrawerCollapsibleSection.vue';
import PeopleCreateParticipationBody from '@/components/people/PeopleCreateParticipationBody.vue';
import WorkspaceScopedDrawerShell from '@/components/common/WorkspaceScopedDrawerShell.vue';
import { FORM_FIELD_SEARCH_CONTROL_CLASS } from '@/utils/formFieldControlClasses';
import { getFieldDisplayLabel } from '@/utils/fieldDisplay';
import AppSection, { type AppSectionModelValue } from '@/components/people/AppSection.vue';
import apiClient from '@/utils/apiClient';
import { useTabs } from '@/composables/useTabs';
import { confirmAction } from '@/composables/useConfirmAction';
import { useCreationContext } from '@/utils/creationContext';
import { getPeopleQuickCreateFields, getAppFields, getParticipationFields } from '@/platform/fields/peopleFieldModel';
import { ensureModuleCreateLayout } from '@/platform/fields/createSurface';
import type { CreateSurfaceCompositeId } from '@/platform/fields/createSurface';
import { getGlobalSystemFieldKeys } from '@/platform/fields/fieldCapabilityEngine';
import { getAppLabel } from '@/utils/getRoleDisplay';
import { getParticipation } from '@/utils/getParticipation';
import { usePeopleTypes } from '@/composables/usePeopleTypes';
import { getFieldDependencyState } from '@/utils/dependencyEvaluation';
import { getFormFieldValue, syncParticipationClassifierFields, syncPeopleVirtualFieldKeys } from '@/utils/getFieldValue';
import { normalizeModuleFieldsFromMetadata } from '@/platform/fields/fieldMerge';
import { mergePeopleVirtualFieldDefinitions } from '@/platform/fields/peopleFieldRegistry';
import { useAuthStore } from '@/stores/auth';
import {
  PEOPLE_PARTICIPATION_APP_KEYS,
  type PeopleParticipationAppKey
} from '@/utils/peopleParticipationUi';
import {
  applyCreateOwnerDefaultsToForm,
  applyCreateOwnerDefaultsToPayload,
  resolveCurrentUserId
} from '@/utils/recordCreateOwnerDefaults';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  /**
   * Creation context app key (OPTIONAL)
   * When 'SALES': create→attach flow with type selection.
   * When 'HELPDESK': create→attach for Helpdesk.
   * When null/undefined: identity-only POST /people.
   */
  /**
   * null = explicit global (no AppSection on People "All People", ignoring shell active app).
   * undefined (omit prop) = infer from route + activeApp on /people.
   */
  contextAppKey: {
    type: String as PropType<string | null | undefined>,
    required: false,
    default: undefined
  },
  /**
   * When true with contextAppKey null (All Apps tab), show optional app picker + AppSection.
   */
  optionalAppParticipation: {
    type: Boolean,
    default: false
  },
  /**
   * When provided, drawer opens in edit mode for this person record (requires _id or id).
   */
  record: {
    type: Object as PropType<Record<string, unknown> | null>,
    default: null
  }
});

const { t } = useI18n();

const emit = defineEmits(['close', 'saved']);

/** Dynamic slot name — DynamicForm is JS so static #app_participation is typed as never. */
const appParticipationSlot: CreateSurfaceCompositeId = 'app_participation';

const { openTab } = useTabs();
const authStore = useAuthStore();

const isEditMode = computed(() => {
  const id = props.record?._id || props.record?.id;
  return !!id;
});
const editPersonId = computed(() => {
  const id = props.record?._id || props.record?.id;
  return id ? String(id) : null;
});
const drawerTitle = computed(() =>
  isEditMode.value
    ? t('people.peopleQuickCreateDrawerEditPerson')
    : t('people.peopleQuickCreateDrawerCreatePerson')
);

const drawerBodyLayoutClass = computed(() => 'space-y-6');

const fullMode = ref(false);
/** Animated panel width; staged vs content mode so expand/collapse doesn't snap. */
const panelWide = ref(false);
let modeAnimTimer: ReturnType<typeof setTimeout> | null = null;
const fieldSearch = ref('');
const editLoading = ref(false);
const editRecordSeeded = ref(false);
const initialParticipationApps = ref<PeopleParticipationAppKey[]>([]);

function clearModeAnimTimer() {
  if (modeAnimTimer) {
    clearTimeout(modeAnimTimer);
    modeAnimTimer = null;
  }
}

function setDrawerMode(expanded: boolean, { animate = true }: { animate?: boolean } = {}) {
  clearModeAnimTimer();
  if (!expanded) fieldSearch.value = '';
  if (!animate) {
    fullMode.value = expanded;
    panelWide.value = expanded;
    return;
  }
  if (expanded) {
    panelWide.value = true;
    modeAnimTimer = setTimeout(() => {
      fullMode.value = true;
      modeAnimTimer = null;
    }, 140);
  } else {
    fullMode.value = false;
    modeAnimTimer = setTimeout(() => {
      panelWide.value = false;
      modeAnimTimer = null;
    }, 90);
  }
}

function toggleFullMode() {
  markFormChanged();
  setDrawerMode(!(fullMode.value || panelWide.value));
}

const strictQuickCreateForForm = computed(() => !fullMode.value);

// Creation context: appKey is null for global, 'SALES'|'HELPDESK' for app-specific
const { appKey } = useCreationContext(toRef(props, 'contextAppKey'));

/** When optional participation mode (All Apps), user-selected apps */
const selectedOptionalAppKeys = ref<PeopleParticipationAppKey[]>([]);

const contextAppKeyPropIsNull = computed(() => props.contextAppKey === null);

const effectiveAppKey = computed((): PeopleParticipationAppKey | null => {
  if (props.optionalAppParticipation && props.contextAppKey === null) {
    return null;
  }
  const key = appKey.value;
  if (key && PEOPLE_PARTICIPATION_APP_KEYS.includes(key as PeopleParticipationAppKey)) {
    return key as PeopleParticipationAppKey;
  }
  return null;
});

const availableParticipationApps = computed((): PeopleParticipationAppKey[] => {
  const enabled = authStore.organization?.enabledApps;
  if (!Array.isArray(enabled) || enabled.length === 0) {
    return [...PEOPLE_PARTICIPATION_APP_KEYS];
  }
  const enabledKeys = new Set(
    enabled
      .filter((app) => app?.status === 'ACTIVE')
      .map((app) => String(app.appKey).toUpperCase())
  );
  return PEOPLE_PARTICIPATION_APP_KEYS.filter((k) => enabledKeys.has(k));
});

const effectiveSelectedApps = computed((): PeopleParticipationAppKey[] => {
  if (props.optionalAppParticipation && props.contextAppKey === null) {
    return selectedOptionalAppKeys.value;
  }
  return effectiveAppKey.value ? [effectiveAppKey.value] : [];
});

type ParticipationAppMeta = {
  icon: Component;
  iconBg: string;
  iconColor: string;
};

const participationAppMeta: Record<PeopleParticipationAppKey, ParticipationAppMeta> = {
  SALES: {
    icon: BriefcaseIcon,
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/50',
    iconColor: 'text-indigo-600 dark:text-indigo-400'
  },
  HELPDESK: {
    icon: LifebuoyIcon,
    iconBg: 'bg-sky-100 dark:bg-sky-900/50',
    iconColor: 'text-sky-600 dark:text-sky-400'
  }
};

function getParticipationAppMeta(appKey: string): ParticipationAppMeta {
  const key = appKey as PeopleParticipationAppKey;
  return participationAppMeta[key] ?? {
    icon: BriefcaseIcon,
    iconBg: 'bg-gray-100 dark:bg-gray-800',
    iconColor: 'text-gray-600 dark:text-gray-400'
  };
}

function isAppSelected(appKey: PeopleParticipationAppKey) {
  return selectedOptionalAppKeys.value.includes(appKey);
}

function toggleAppSelection(appKey: PeopleParticipationAppKey) {
  markFormChanged();
  if (isAppSelected(appKey)) {
    selectedOptionalAppKeys.value = selectedOptionalAppKeys.value.filter((k) => k !== appKey);
    const nextForms = { ...appForms.value };
    delete nextForms[appKey];
    appForms.value = nextForms;
    clearAppScopedErrors(appKey);
  } else {
    selectedOptionalAppKeys.value = [...selectedOptionalAppKeys.value, appKey];
    appForms.value = { ...appForms.value, [appKey]: { participationType: null } };
  }
}

const salesPeopleTypes = usePeopleTypes('SALES');
const helpdeskPeopleTypes = usePeopleTypes('HELPDESK');

function getTypeDefsForApp(appKey: string) {
  if (appKey === 'SALES') return salesPeopleTypes.typeDefs.value;
  if (appKey === 'HELPDESK') return helpdeskPeopleTypes.typeDefs.value;
  return [];
}

function appErrorKey(appKey: string, fieldKey: string) {
  return `${appKey}::${fieldKey}`;
}

function getAppErrors(appKey: string): Record<string, string> {
  const prefix = `${appKey}::`;
  const result: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors.value)) {
    if (key.startsWith(prefix)) {
      result[key.slice(prefix.length)] = message;
    }
  }
  return result;
}

function clearAppScopedErrors(appKey: string) {
  const prefix = `${appKey}::`;
  const next = { ...errors.value };
  for (const key of Object.keys(next)) {
    if (key.startsWith(prefix)) delete next[key];
  }
  errors.value = next;
}

/** Exclude system + all app participation fields from the core identity DynamicForm */
const coreFormExcludeFields = computed(() => {
  const excluded = new Set<string>();
  for (const key of getGlobalSystemFieldKeys()) {
    excluded.add(String(key));
  }
  for (const key of getParticipationFieldKeySet()) {
    excluded.add(key);
  }
  const moduleFields = peopleModuleOverride.value?.fields || [];
  for (const field of moduleFields) {
    const key = field?.key;
    if (!key) continue;
    if (field.owner === 'participation' || field.metadata?.owner === 'participation') {
      excluded.add(String(key));
    }
  }
  return Array.from(excluded);
});

const hasAppParticipationSection = computed(() =>
  (props.optionalAppParticipation && contextAppKeyPropIsNull.value) || !!effectiveAppKey.value
);

const peopleFullModeComposites = computed((): string[] =>
  hasAppParticipationSection.value && !fieldSearch.value.trim()
    ? ['app_participation']
    : []
);

const showQuickCreateFieldsSection = computed(() => {
  if (!fullMode.value) return true;
  return visibleQuickCreateFieldKeys.value.length > 0;
});

const participationSectionClass = computed(() => {
  const classes = ['flex', 'flex-col', 'gap-4'];
  if (!fullMode.value && showQuickCreateFieldsSection.value) {
    classes.push('border-t', 'border-gray-200', 'pt-8', 'dark:border-gray-700');
  }
  return classes;
});

const fullOtherCoreFields = computed(() => {
  if (!fullMode.value) return [];
  const quickSet = new Set(
    coreQuickCreateFieldsOverride.value.map((key) => String(key).toLowerCase())
  );
  return getActiveCoreFieldKeys().filter(
    (key) => !quickSet.has(String(key).toLowerCase())
  );
});

function fieldKeyMatchesSearch(key: string): boolean {
  const q = fieldSearch.value.trim().toLowerCase();
  if (!q) return true;
  const fields = peopleModuleOverride.value?.fields || [];
  const field = fields.find(
    (f: { key?: string; label?: string }) =>
      String(f?.key || '').toLowerCase() === String(key).toLowerCase()
  );
  const label = String(getFieldDisplayLabel(field) || field?.label || key).toLowerCase();
  return label.includes(q) || String(key).toLowerCase().includes(q);
}

const visibleQuickCreateFieldKeys = computed(() =>
  coreQuickCreateFieldsOverride.value.filter((key) => fieldKeyMatchesSearch(key))
);

const visibleFullOtherCoreFields = computed(() =>
  fullOtherCoreFields.value.filter((key) => fieldKeyMatchesSearch(key))
);

const hasFullOtherCoreFields = computed(() => visibleFullOtherCoreFields.value.length > 0);

const showFullModeToggle = computed(() => !!peopleModuleOverride.value);

/** Quick create: single column (aligned with CreateRecordDrawer). Full mode: two columns. */
const coreFormSingleColumn = computed(() => !fullMode.value);

/** App participation dependent fields: single column in quick mode only. */
const participationFormSingleColumn = computed(() => !fullMode.value);

// App form state per app (participation type + dependent fields)
const appForms = ref<Record<string, AppSectionModelValue>>({});

const singleAppForm = computed({
  get(): AppSectionModelValue {
    const key = effectiveAppKey.value;
    if (!key) return { participationType: null };
    return appForms.value[key] ?? { participationType: null };
  },
  set(value: AppSectionModelValue) {
    const key = effectiveAppKey.value;
    if (!key) return;
    appForms.value = { ...appForms.value, [key]: value };
  }
});

function getAppForm(appKey: string): AppSectionModelValue {
  return appForms.value[appKey] ?? { participationType: null };
}

function setAppForm(appKey: string, value: AppSectionModelValue) {
  appForms.value = { ...appForms.value, [appKey]: value };
}

// People module fetched when drawer opens (Settings → People → Quick Create + app participation fields).
const peopleModuleOverride = ref<any>(null);
const peopleModuleLoading = ref(false);

// Fetch people module from quick-create endpoint (single source: Settings → People → Quick Create).
watch(() => props.isOpen, async (open) => {
  if (!open) {
    peopleModuleOverride.value = null;
    peopleModuleLoading.value = false;
    appForms.value = {};
    selectedOptionalAppKeys.value = [];
    return;
  }
  peopleModuleLoading.value = true;
  peopleModuleOverride.value = null;
  try {
    const res = await apiClient.get('/modules/people/quick-create', { params: { context: 'all' } });
    if (res?.success && res?.data) {
      const mod = res.data;
      if (!mod.quickCreate) mod.quickCreate = [];
      if (!mod.quickCreateLayout) mod.quickCreateLayout = { version: 1, rows: [] };
      mod.fields = normalizeModuleFieldsFromMetadata('people', mod.fields || []);
      mod.fields = mergePeopleVirtualFieldDefinitions(mod.fields);
      const layoutApplied = ensureModuleCreateLayout('people', mod.fields, mod.fieldLayout || null);
      mod.fieldLayout = layoutApplied.layout;
      mod.fields = layoutApplied.fields;
      peopleModuleOverride.value = mod;
    }
  } catch (e) {
    console.error('[PeopleQuickCreateDrawer] Failed to fetch people module:', e);
  } finally {
    peopleModuleLoading.value = false;
  }
}, { immediate: true });

// Form state
const formData = ref<Record<string, any>>({});
const errors = ref<Record<string, string>>({});
const saving = ref(false);
const moduleDefinition = ref<any>(null);

/** True after real user interaction (backdrop/Escape blocked); not set by programmatic DynamicForm sync */
const userHasEdited = ref(false);
/** True when form values actually changed (refresh/leave confirm) */
const hasUnsavedChanges = ref(false);
function markUserInteraction() {
  userHasEdited.value = true;
}
function markFormChanged() {
  userHasEdited.value = true;
  hasUnsavedChanges.value = true;
}

async function scrollToFirstErrorField() {
  const errorKeys = Object.keys(errors.value || {}).filter((key) => key && key !== '_general');
  if (!errorKeys.length) return;

  await nextTick();

  for (const key of errorKeys) {
    const escapedKey =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(key)
        : key.replace(/"/g, '\\"');
    const fieldContainer = document.querySelector(`[data-field-key="${escapedKey}"]`);
    if (!fieldContainer) continue;

    fieldContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const focusTarget = fieldContainer.querySelector(
      'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement | null;
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus({ preventScroll: true });
    }
    break;
  }
}

// Quick create fields from config (Settings → People → Quick Create)
const quickCreateFieldsOverride = computed(() =>
  getPeopleQuickCreateFields(peopleModuleOverride.value)
);

function filterCoreFieldKeys(keys: string[]): string[] {
  const participationKeys = getParticipationFieldKeySet();
  return keys.filter((key) => !participationKeys.has(String(key).toLowerCase()));
}

const coreQuickCreateFieldsOverride = computed(() =>
  filterCoreFieldKeys(quickCreateFieldsOverride.value)
);

// App-dependent fields for validation/payload (per app)
function getAppDependentFields(appKey: string) {
  const form = appForms.value[appKey];
  if (!form?.participationType) return [];
  return getAppFields(appKey, form.participationType, getTypeDefsForApp(appKey));
}

// Prevent submit when any selected app is missing a role
const submitDisabled = computed(() =>
  effectiveSelectedApps.value.some((appKey) => !appForms.value[appKey]?.participationType)
);

// Drawer panel width — narrow quick, wide full (aligned with CreateRecordDrawer)
const drawerPanelClass = computed(() => (panelWide.value ? 'sm:w-[60rem]' : 'sm:w-[30rem]'));

function getParticipationFieldKeySet(): Set<string> {
  const keys = new Set<string>(['sales_type', 'helpdesk_role', 'type']);
  for (const appKey of PEOPLE_PARTICIPATION_APP_KEYS) {
    for (const fieldKey of getParticipationFields(appKey)) {
      keys.add(String(fieldKey).toLowerCase());
    }
  }
  return keys;
}

function getActiveCoreFieldKeys(): string[] {
  if (!fullMode.value) {
    return coreQuickCreateFieldsOverride.value;
  }
  const participationKeys = getParticipationFieldKeySet();
  const systemKeys = new Set(getGlobalSystemFieldKeys().map((k) => String(k).toLowerCase()));
  const moduleFields = moduleDefinition.value?.fields || peopleModuleOverride.value?.fields || [];
  return moduleFields
    .map((field: { key?: string }) => field?.key)
    .filter((key: string | undefined): key is string => {
      if (!key) return false;
      const lower = key.toLowerCase();
      if (participationKeys.has(lower)) return false;
      if (systemKeys.has(lower)) return false;
      if (['_id', '__v', 'organizationid', 'createdby', 'createdat', 'updatedat'].includes(lower)) {
        return false;
      }
      return true;
    });
}

function getExistingParticipationApps(record: Record<string, unknown>): PeopleParticipationAppKey[] {
  const apps = new Set<PeopleParticipationAppKey>();
  for (const appKey of PEOPLE_PARTICIPATION_APP_KEYS) {
    const participation = getParticipation(record, appKey);
    const role =
      appKey === 'SALES'
        ? (record.sales_type as string | undefined) || participation?.role
        : (record.helpdesk_role as string | undefined) || participation?.role;
    if (role) apps.add(appKey);
  }
  return [...apps];
}

function seedAppFormFromRecord(appKey: PeopleParticipationAppKey, record: Record<string, unknown>): AppSectionModelValue {
  const participation = getParticipation(record, appKey);
  const role =
    appKey === 'SALES'
      ? (record.sales_type as string | undefined) || participation?.role || null
      : (record.helpdesk_role as string | undefined) || participation?.role || null;
  const form: AppSectionModelValue = { participationType: role };
  if (role) {
    const appFields = getAppFields(appKey, role, getTypeDefsForApp(appKey));
    for (const fieldKey of appFields) {
      if (Object.prototype.hasOwnProperty.call(record, fieldKey)) {
        form[fieldKey] = record[fieldKey] as AppSectionModelValue[string];
      }
    }
  }
  return form;
}

function seedFormFromRecord(record: Record<string, unknown>) {
  const nextForm: Record<string, unknown> = { ...record };
  syncPeopleVirtualFieldKeys(nextForm);
  formData.value = nextForm;

  const existingApps = getExistingParticipationApps(record);
  initialParticipationApps.value = [...existingApps];

  if (props.optionalAppParticipation && props.contextAppKey === null) {
    selectedOptionalAppKeys.value = [...existingApps];
    const nextAppForms: Record<string, AppSectionModelValue> = {};
    for (const appKey of existingApps) {
      nextAppForms[appKey] = seedAppFormFromRecord(appKey, record);
    }
    appForms.value = nextAppForms;
    return;
  }

  const appKey = effectiveAppKey.value;
  if (appKey) {
    appForms.value = { [appKey]: seedAppFormFromRecord(appKey, record) };
  }
}

async function loadEditRecord() {
  const personId = editPersonId.value;
  if (!personId) return;

  editLoading.value = true;
  errors.value = {};
  try {
    const res = await apiClient.get(`/people/${personId}`);
    if (!res?.success || !res?.data) {
      errors.value._general = t('people.peopleQuickCreateDrawerCouldNotLoadPeopleModulePlease');
      return;
    }
    seedFormFromRecord(res.data as Record<string, unknown>);
    editRecordSeeded.value = true;
  } catch (error) {
    console.error('[PeopleQuickCreateDrawer] Failed to load person for edit:', error);
    if (props.record && typeof props.record === 'object') {
      seedFormFromRecord(props.record as Record<string, unknown>);
      editRecordSeeded.value = true;
    } else {
      errors.value._general = t('people.peopleQuickCreateError');
    }
  } finally {
    editLoading.value = false;
  }
}

/**
 * Validate quick create + app fields (required in form from module)
 */
function appFormDataForDependencies(appKey: string) {
  const base = { ...appForms.value[appKey] } as Record<string, unknown>;
  syncParticipationClassifierFields(base, appKey);
  return base;
}

function validateForm() {
  errors.value = {};
  if (!moduleDefinition.value?.fields) return;

  const moduleFields = moduleDefinition.value.fields as any[];
  const activeCoreFieldKeys = new Set(getActiveCoreFieldKeys().map((k) => String(k).toLowerCase()));

  for (const field of moduleFields) {
    if (!field.key) continue;
    if (!activeCoreFieldKeys.has(String(field.key).toLowerCase())) continue;

    const depState = getFieldDependencyState(
      field,
      formData.value,
      moduleFields,
      { moduleKey: 'people' }
    );
    if (depState.visible === false) continue;
    if (depState.required !== true) continue;

    const value = field.key in formData.value
      ? formData.value[field.key]
      : getFormFieldValue(formData.value, field.key, field, { moduleKey: 'people' });
    const isEmpty = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
    if (isEmpty) {
      (errors.value as Record<string, string>)[field.key] = `${field.label || field.key} is required`;
    }
  }

  for (const appKey of effectiveSelectedApps.value) {
    const appFields = getAppDependentFields(appKey);
    const appDepForm = appFormDataForDependencies(appKey);
    const appForm = appForms.value[appKey] || {};

    for (const field of moduleFields) {
      if (!field.key) continue;
      if (!appFields.includes(field.key)) continue;

      const depState = getFieldDependencyState(
        field,
        appDepForm,
        moduleFields,
        { moduleKey: 'people' }
      );
      if (depState.visible === false) continue;
      if (depState.required !== true) continue;

      const value = field.key in appForm
        ? appForm[field.key]
        : getFormFieldValue(appForm, field.key, field, { moduleKey: 'people' });
      const isEmpty = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
      if (isEmpty) {
        (errors.value as Record<string, string>)[appErrorKey(appKey, field.key)] = `${field.label || field.key} is required`;
      }
    }

    if (!appForm.participationType) {
      (errors.value as Record<string, string>)[appErrorKey(appKey, 'participationType')] = 'Type is required';
    }
  }
}

const requestClose = async () => {
  if (saving.value) return;
  if (
    hasUnsavedChanges.value &&
    !(await confirmAction({
      message: t('common.drawerCloseConfirm'),
      confirmLabel: t('common.drawerDiscardClose'),
      tone: 'warning',
    }))
  ) {
    return;
  }
  closeDrawer();
};

const closeDrawer = () => {
  if (!saving.value) {
    emit('close');
    // Reset form after closing
    setTimeout(() => {
      formData.value = {};
      appForms.value = {};
      selectedOptionalAppKeys.value = [];
      errors.value = {};
      userHasEdited.value = false;
      hasUnsavedChanges.value = false;
      setDrawerMode(false, { animate: false });
      editRecordSeeded.value = false;
      initialParticipationApps.value = [];
    }, 300);
  }
};

const handleDialogClose = () => {
  requestClose();
};

const updateFormData = (data: Record<string, any>) => {
  formData.value = { ...data };
};

const onFormReady = (module: any) => {
  moduleDefinition.value = module;
  if (isEditMode.value && editRecordSeeded.value) return;

  // Preserve drafts when toggling quick ↔ full (form may remount / re-emit ready).
  const hasDraftValues = Object.values(formData.value || {}).some((value) => {
    if (value == null || value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });
  if (hasDraftValues) return;

  const allFieldKeys = fullMode.value
    ? getActiveCoreFieldKeys()
    : [...coreQuickCreateFieldsOverride.value];
  const initialForm: Record<string, any> = {};
  if (module?.fields) {
    for (const field of module.fields) {
      if (allFieldKeys.includes(field.key)) {
        if (field.defaultValue !== null && field.defaultValue !== undefined) {
          initialForm[field.key] = field.defaultValue;
        } else if (field.dataType === 'Multi-Picklist' || field.key === 'tags') {
          initialForm[field.key] = [];
        } else if (field.dataType === 'Checkbox') {
          initialForm[field.key] = false;
        } else {
          initialForm[field.key] = '';
        }
      }
    }
  }
  formData.value = applyCreateOwnerDefaultsToForm(
    { ...initialForm },
    'people',
    resolveCurrentUserId(authStore.user)
  );
};

watch(formData, (newVal, oldVal) => {
  if (!oldVal) return;
  for (const key in newVal) {
    if (newVal[key] !== oldVal[key] && errors.value[key]) {
      const v = newVal[key];
      if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) {
        delete errors.value[key];
      }
    }
  }
}, { deep: true });

watch(appForms, (newVal, oldVal) => {
  if (!oldVal) return;
  for (const appKey of Object.keys(newVal)) {
    const nextForm = newVal[appKey] || {};
    const prevForm = oldVal[appKey] || {};
    for (const key in nextForm) {
      const errorKey = appErrorKey(appKey, key);
      if (nextForm[key] !== prevForm[key] && errors.value[errorKey]) {
        const v = nextForm[key];
        if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) {
          delete errors.value[errorKey];
        }
      }
    }
  }
}, { deep: true });

function appendFieldToPayload(payload: Record<string, unknown>, field: string, value: unknown) {
  if (Array.isArray(value)) {
    if (value.length > 0) payload[field] = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed !== '') payload[field] = trimmed;
  } else if (value !== null && value !== undefined) {
    payload[field] = value;
  }
}

function buildCorePayload(): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const fieldKeys = getActiveCoreFieldKeys();
  for (const field of fieldKeys) {
    if (field in formData.value) {
      appendFieldToPayload(payload, field, formData.value[field]);
    }
  }
  if (isEditMode.value) {
    return payload;
  }
  return applyCreateOwnerDefaultsToPayload(
    payload,
    'people',
    resolveCurrentUserId(authStore.user)
  );
}

function buildAppUpdatePayload(appKey: PeopleParticipationAppKey): Record<string, unknown> {
  const payload = buildAppFieldsPayload(appKey);
  const role = appForms.value[appKey]?.participationType;
  if (appKey === 'SALES' && role) {
    payload.sales_type = role;
  } else if (appKey === 'HELPDESK' && role) {
    payload.helpdesk_role = role;
  }
  return payload;
}

async function submitEdit() {
  const personId = editPersonId.value;
  if (!personId) {
    errors.value._general = t('people.peopleQuickCreateError');
    return;
  }

  const corePayload = buildCorePayload();
  let latestRecord: Record<string, unknown> | null =
    (props.record as Record<string, unknown> | null) ?? null;

  if (Object.keys(corePayload).length > 0) {
    const response = await apiClient.put(`/people/${personId}/update-core`, { formData: corePayload });
    if (!response?.success) {
      if (response?.errors) {
        errors.value = { ...errors.value, ...response.errors };
        scrollToFirstErrorField();
      } else {
        errors.value._general = response?.message || t('people.peopleQuickCreateError');
      }
      return;
    }
    latestRecord = response.data ?? latestRecord;
  }

  for (const appKey of effectiveSelectedApps.value) {
    const hadParticipation = initialParticipationApps.value.includes(appKey);
    if (hadParticipation) {
      const appResponse = await apiClient.put(`/people/${personId}/update-app-fields`, {
        appKey,
        formData: buildAppUpdatePayload(appKey)
      });
      if (!appResponse?.success) {
        if (appResponse?.errors) {
          for (const [field, message] of Object.entries(appResponse.errors)) {
            errors.value[appErrorKey(appKey, field)] = String(message);
          }
        }
        errors.value._general = appResponse?.message || `Failed to update ${getAppLabel(appKey)} fields.`;
        scrollToFirstErrorField();
        return;
      }
      latestRecord = appResponse.data ?? latestRecord;
    } else {
      const attachResponse = await apiClient.post(`/people/${personId}/attach`, buildAttachPayload(appKey));
      if (!attachResponse?.success) {
        if (attachResponse?.errors) {
          for (const [field, message] of Object.entries(attachResponse.errors)) {
            errors.value[appErrorKey(appKey, field)] = String(message);
          }
        }
        errors.value._general =
          attachResponse?.message ||
          `Failed to attach to ${getAppLabel(appKey)}.`;
        scrollToFirstErrorField();
        return;
      }
      latestRecord = attachResponse.data ?? latestRecord;
    }
  }

  emit('saved', latestRecord);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('arivu:record-updated', {
      detail: { moduleKey: 'people', record: latestRecord }
    }));
  }
  closeDrawer();
}

function buildAppFieldsPayload(appKey: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const appFields = getAppDependentFields(appKey);
  const appForm = appForms.value[appKey] || {};
  for (const field of appFields) {
    if (field in appForm) {
      appendFieldToPayload(payload, field, appForm[field]);
    }
  }
  return payload;
}

function buildAttachPayload(appKey: string): { appKey: string; role: string; formData: Record<string, unknown> } {
  return {
    appKey,
    role: String(appForms.value[appKey]?.participationType || ''),
    formData: buildAppFieldsPayload(appKey)
  };
}

/**
 * Handle form submission (context-driven)
 * ALL: POST /people (core fields only)
 * SALES/HELPDESK: POST /people/create (quick create fields + app fields, appKey + role)
 */
const handleSubmit = async () => {
  errors.value = {};
  saving.value = true;

  try {
    validateForm();
    if (Object.keys(errors.value).length > 0) {
      scrollToFirstErrorField();
      saving.value = false;
      return;
    }

    if (isEditMode.value) {
      await submitEdit();
      return;
    }

    const selectedApps = effectiveSelectedApps.value;
    const corePayload = buildCorePayload();

    let response;
    if (selectedApps.length === 0) {
      response = await apiClient.post('/people', corePayload);
    } else {
      const firstApp = selectedApps[0]!;
      const remainingApps = selectedApps.slice(1);
      const createPayload = {
        ...corePayload,
        ...buildAppFieldsPayload(firstApp)
      };
      response = await apiClient.post('/people/create', {
        appKey: firstApp,
        role: appForms.value[firstApp]?.participationType,
        formData: createPayload
      });

      if (response.success && remainingApps.length > 0) {
        const personId = response.data?._id || response.data?.id;
        if (!personId) {
          errors.value._general = 'Person created but could not attach additional apps.';
          saving.value = false;
          return;
        }

        for (const appKey of remainingApps) {
          const attachResponse = await apiClient.post(`/people/${personId}/attach`, buildAttachPayload(appKey));
          if (!attachResponse.success) {
            if (attachResponse.errors) {
              for (const [field, message] of Object.entries(attachResponse.errors)) {
                errors.value[appErrorKey(appKey, field)] = String(message);
              }
            }
            errors.value._general =
              attachResponse.message ||
              `Person created, but failed to attach to ${getAppLabel(appKey)}.`;
            scrollToFirstErrorField();
            saving.value = false;
            return;
          }
          response.data = attachResponse.data;
        }
      }
    }
      
      if (response.success) {
        console.log('[PeopleQuickCreate] ✅ Person created successfully');
        const createdPerson = response.data;
        
        // Open the newly created record in a new tab
        const personId = createdPerson._id || createdPerson.id;
        if (personId) {
          const firstName = createdPerson.first_name || '';
          const lastName = createdPerson.last_name || '';
          const title = firstName || lastName 
            ? `${firstName} ${lastName}`.trim() 
            : 'Person Detail';
          
          openTab(`/people/${personId}`, {
            title,
            icon: 'users',
            params: { name: title },
            insertAdjacent: true
          });
        }
        
        emit('saved', createdPerson);
        
        // Dispatch global event to refresh list views
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('arivu:record-created', {
            detail: { moduleKey: 'people', record: createdPerson }
          }));
        }
        
        saving.value = false; // Reset saving state before closing
        closeDrawer();
      } else {
        if (response.errors) {
          errors.value = { ...errors.value, ...response.errors };
          scrollToFirstErrorField();
        } else {
          errors.value._general = response.message || 'Failed to create contact';
        }
        saving.value = false;
      }
    
  } catch (error: unknown) {
    const err = error as any;
    console.error('[PeopleQuickCreate] ❌ Error creating person:', error);
    console.error('[PeopleQuickCreate] Error details:', {
      message: err?.message,
      error: error,
      response: err?.response?.data,
      responseData: err?.response?.data,
      status: err?.response?.status,
      statusText: err?.response?.statusText,
      fullError: JSON.stringify(error, null, 2)
    });
    
    // If we have a response with error details, show them
    if (err?.response?.data?.error) {
      console.error('[PeopleQuickCreate] Server error message:', err.response.data.error);
    }
    
    // Handle validation errors from API
    if (err?.response?.data?.errors) {
      errors.value = { ...errors.value, ...err.response.data.errors };
      scrollToFirstErrorField();
    } else if (err?.response?.data?.message) {
      (errors.value as Record<string, string>)._general = err.response.data.message;
    } else if (err?.response?.data?.error) {
      // Backend might return error in 'error' field
      (errors.value as Record<string, string>)._general = err.response.data.error;
    } else {
      (errors.value as Record<string, string>)._general = err?.message || 'Failed to create contact';
    }
  } finally {
    saving.value = false;
  }
};

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!props.isOpen || !hasUnsavedChanges.value) return;
  event.preventDefault();
  event.returnValue = '';
}

// Reset form when drawer opens
watch(() => props.isOpen, async (isOpen) => {
  if (!isOpen) {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    return;
  }
  userHasEdited.value = false;
  hasUnsavedChanges.value = false;
  window.addEventListener('beforeunload', handleBeforeUnload);
  setDrawerMode(false, { animate: false });
  errors.value = {};
  editRecordSeeded.value = false;
  initialParticipationApps.value = [];

  if (isEditMode.value) {
    formData.value = {};
    appForms.value = {};
    selectedOptionalAppKeys.value = [];
    await loadEditRecord();
    return;
  }

  formData.value = {};
  appForms.value = {};
  selectedOptionalAppKeys.value = [];
  if (effectiveAppKey.value) {
    appForms.value = { [effectiveAppKey.value]: { participationType: null } };
  }
});

onUnmounted(() => {
  clearModeAnimTimer();
  window.removeEventListener('beforeunload', handleBeforeUnload);
});
</script>

