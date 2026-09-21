<!--
  ============================================================================
  CREATEORGANIZATIONDRAWER CONTRACT
  ============================================================================
  
  CreateOrganizationDrawer
  Creation-only drawer with Quick → Full form behavior.
  
  ARCHITECTURAL INTENT:
  - ONE creation entry point for Organizations
  - Creation happens in a drawer with two modes: Quick Create (default) and Full Form (explicit expansion)
  - Both modes are creation-only (NOT editing, NOT OrganizationSurface)
  - Quick Create unblocks flow. Full Form is intentional completion. Both are creation-only.
  
  MODE BEHAVIOR:
  - mode: 'quick' | 'full' (default: 'quick')
  - Quick mode: Settings-driven core fields + Types section + type-dependent fields
  - Full mode: Core quick create, Types section, then remaining platform fields
  - Form state MUST be preserved across mode switches
  - No API call on mode switch
  
  CREATION INTENT INVARIANT
  ------------------------
  Quick Create and Full Form represent different user intents.
  
  - Draft values may persist across mode switches
  - ONLY fields visible in the active mode at submit time
    are allowed to be persisted
  
  Mode at submission time is the source of truth.
  
  Reference documents:
  - docs/architecture/organization-surface-invariants.md
  - docs/architecture/module-settings-doctrine.md
  
  ============================================================================
-->

<template>
  <WorkspaceScopedDrawerShell
    :is-open="isOpen"
    draft-module-key="organizations"
    :draft-record-id="orgDraftRecordId"
    @backdrop="handleDialogClose"
    @escape="handleDialogClose"
  >
              <!-- Drawer width behavior aligned with shared create drawers -->
              <div
                :class="[
                  'rounded-tl-xl overflow-hidden pointer-events-auto h-full flex flex-col bg-white dark:bg-gray-900 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 w-screen max-w-full overflow-x-hidden transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width]',
                  drawerWidthClass
                ]"
              >
                <form @submit.prevent="handleSubmit" class="relative flex h-full flex-col">
                  <!-- Fixed Header -->
                  <div class="flex-shrink-0 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4 sm:px-6">
                    <div class="flex items-center justify-between gap-3">
                      <h2 class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                        {{ isEditMode ? 'Edit Organization' : 'New Organization' }}
                      </h2>
                      <div class="ml-3 flex h-7 items-center">
                        <button 
                          type="button" 
                          class="relative rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer" 
                          @click="requestClose"
                        >
                          <span class="absolute -inset-2.5"></span>
                          <span class="sr-only">{{ t('forms.previewClosePanelSr') }}</span>
                          <XMarkIcon class="size-5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <p v-if="helperText" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {{ helperText }}
                    </p>
                  </div>

                  <!-- Scrollable Content Area -->
                  <div class="flex-1 overflow-y-auto">
                    <div class="px-5 sm:px-6 py-5">
                      <div class="space-y-5">
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
                          
                          <div v-if="moduleLoading || (isEditMode && loading)" class="flex justify-center py-12">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                          </div>

                          <template v-else>
                            <div class="flex flex-col gap-8">
                              <!-- Single form instance so quick ↔ full keeps entered values -->
                              <DynamicForm
                                module-key="organizations"
                                context="platform"
                                :form-data="formData"
                                :errors="errors"
                                :show-all-fields="mode === 'full'"
                                :quick-create-mode="mode === 'quick'"
                                :single-column="mode === 'quick'"
                                :fields-override="mode === 'full' ? null : coreQuickCreateFieldsOverride"
                                :exclude-fields="mode === 'full' ? fullModeLayoutExcludeFields : coreFormExcludeFields"
                                :module-override="moduleDefinition"
                                :use-quick-create-order="mode === 'quick'"
                                :create-surface-composites="mode === 'full' ? orgFullModeComposites : []"
                                @update:form-data="updateFormData"
                                @ready="onFormReady"
                              >
                                <template #app_participation>
                                  <OrganizationParticipationSection
                                    v-if="mode === 'full'"
                                    :form-data="formData"
                                    :errors="errors"
                                    :module-override="moduleDefinition"
                                    :single-column="false"
                                    :full-mode="true"
                                    @update:form-data="updateFormData"
                                  />
                                </template>
                                <template #vendor_catalog>
                                  <VendorCatalogSection
                                    v-if="mode === 'full' && showVendorCatalog"
                                    ref="vendorCatalogSectionRef"
                                    v-model="vendorCatalogLines"
                                    :disabled="saving || (loading && isEditMode)"
                                    :vendor-id="organizationId || null"
                                  />
                                </template>
                              </DynamicForm>

                              <OrganizationParticipationSection
                                v-if="mode === 'quick'"
                                :section-class="typesSectionClass"
                                :form-data="formData"
                                :errors="errors"
                                :module-override="moduleDefinition"
                                :single-column="true"
                                :full-mode="false"
                                @update:form-data="updateFormData"
                              />

                              <VendorCatalogSection
                                v-if="mode === 'quick' && showVendorCatalog"
                                ref="vendorCatalogSectionRef"
                                v-model="vendorCatalogLines"
                                :disabled="saving || (loading && isEditMode)"
                                :vendor-id="organizationId || null"
                                :class="vendorCatalogSectionClass"
                              />
                            </div>
                          </template>
                      </div>
                    </div>
                  </div>

                  <!-- Fixed Footer -->
                  <div class="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur px-5 py-3.5 sm:px-6">
                    <!-- Left: Mode switch button -->
                    <div class="flex-1">
                      <button 
                        v-if="mode === 'quick'"
                        type="button" 
                        class="text-sm font-medium text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 cursor-pointer transition-colors" 
                        @click="switchToFull"
                      >{{ t('organizations.organizationQuickCreateDrawerFullForm') }}</button>
                      <button 
                        v-else
                        type="button" 
                        class="text-sm font-medium text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 cursor-pointer transition-colors" 
                        @click="switchToQuick"
                      >{{ t('organizations.organizationQuickCreateDrawerBackToQuick') }}</button>
                    </div>

                    <!-- Right: Cancel and Save/Create buttons (always on the right) -->
                    <div class="flex items-center gap-2.5">
                      <button 
                        type="button" 
                        class="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors" 
                        @click="requestClose"
                      >{{ t('performance.cancelWizard') }}</button>
                      <button 
                        type="submit" 
                        :disabled="saving || !formData.name" 
                        class="inline-flex min-w-[5.5rem] justify-center rounded-lg bg-indigo-600 dark:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 dark:hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        {{ saving ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create organization') }}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
  </WorkspaceScopedDrawerShell>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch, nextTick, onUnmounted } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import DynamicForm from '@/components/common/DynamicForm.vue';
import WorkspaceScopedDrawerShell from '@/components/common/WorkspaceScopedDrawerShell.vue';
import OrganizationParticipationSection from '@/components/organizations/OrganizationParticipationSection.vue';
import VendorCatalogSection from '@/components/organizations/VendorCatalogSection.vue';
import apiClient from '@/utils/apiClient';
import { fetchModuleDefinitionCached } from '@/utils/tenantSchemaApiCache';
import { ensureModuleCreateLayout } from '@/platform/fields/createSurface';
import { useTabs } from '@/composables/useTabs';
import { confirmAction } from '@/composables/useConfirmAction';
import {
  isTenantPlatformOrganizationFieldKey,
  ORGANIZATION_TENANT_PLATFORM_FIELD_KEYS,
  ORGANIZATION_QUICK_CREATE_DEFAULT,
  filterOrganizationSubmitPayloadByTypes,
  normalizeOrganizationEditSubmitPayload,
  isOrganizationTypeScopedFieldKey,
  getOrganizationFieldsForTypes,
} from '@/platform/fields/organizationFieldModel';
import { useOrganizationTypes } from '@/composables/useOrganizationTypes';
import { getGlobalSystemFieldKeys, isSystemField } from '@/platform/fields/fieldCapabilityEngine';
import { getWebsiteValidationMessage, isValidWebsiteInput } from '@/utils/urlInputValidation';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  initialData: {
    type: Object,
    default: () => ({})
  },
  autoLinkContext: {
    type: Object,
    default: null
  },
  /**
   * When false, create succeeds and emits `saved` without opening OrganizationSurface.
   * Used for nested lookup create flows that link the org back into the parent form.
   */
  openRecordOnSave: {
    type: Boolean,
    default: true
  },
  /**
   * Edit mode: organizationId (required when editing)
   */
  organizationId: {
    type: String,
    default: null
  }
});

const { t } = useI18n();

const emit = defineEmits(['close', 'saved']);

const { openTab } = useTabs();
const { typeDefs: organizationTypeDefs } = useOrganizationTypes();

// ============================================================================
// CREATION MODE STATE
// ============================================================================
// 
// createMode: Tracks the current submission intent
// This must update when the user toggles Quick Create ↔ Full Form
// Mode at submission time is the source of truth for field filtering
// Type: 'quick' | 'full'
//
const createMode = ref('quick');

// Edit mode: true if organizationId is provided
const isEditMode = computed(() => !!props.organizationId);
const orgDraftRecordId = computed(() =>
  props.organizationId != null ? String(props.organizationId) : null,
);

// Mode state: 'quick' | 'full' (default: 'quick')
// ARCHITECTURAL INTENT: Quick Create unblocks flow. Full Form is intentional completion.
// NOTE: This is the UI mode. createMode tracks submission intent and must be kept in sync.
const mode = ref('quick');
/** Animated panel width; staged vs content mode so expand/collapse doesn't snap. */
const panelWide = ref(false);
let modeAnimTimer = null;

function clearModeAnimTimer() {
  if (modeAnimTimer) {
    clearTimeout(modeAnimTimer);
    modeAnimTimer = null;
  }
}

function setOrgDrawerMode(nextMode, { animate = true } = {}) {
  const expanded = nextMode === 'full';
  clearModeAnimTimer();
  if (!animate) {
    mode.value = nextMode;
    createMode.value = nextMode;
    panelWide.value = expanded;
    return;
  }
  if (expanded) {
    panelWide.value = true;
    modeAnimTimer = setTimeout(() => {
      mode.value = 'full';
      createMode.value = 'full';
      modeAnimTimer = null;
    }, 140);
  } else {
    mode.value = 'quick';
    createMode.value = 'quick';
    modeAnimTimer = setTimeout(() => {
      // Keep wide when Vendor Catalog is active so the line table remains usable
      panelWide.value = !!showVendorCatalog.value;
      modeAnimTimer = null;
    }, 90);
  }
}

// Form data (preserved across mode switches)
const formData = ref({ ...props.initialData });
const errors = ref({});
const saving = ref(false);
const moduleDefinition = ref(null);
/** Draft Vendor Catalog lines (persisted via inventory vendor-catalog API). */
const vendorCatalogLines = ref([]);
const vendorCatalogSectionRef = ref(null);
const initialSnapshot = ref('');

const showVendorCatalog = computed(() => {
  const parts = formData.value?.participations;
  if (parts && typeof parts === 'object' && parts.INVENTORY) {
    const role = String(parts.INVENTORY.role || '').toLowerCase();
    return !role || role === 'vendor';
  }
  return false;
});

/** Prefer live section state (avoids v-model desync before submit). */
function resolveVendorCatalogEntries() {
  const fromChild = vendorCatalogSectionRef.value?.getEntries?.();
  if (Array.isArray(fromChild)) return fromChild;
  return Array.isArray(vendorCatalogLines.value) ? vendorCatalogLines.value : [];
}

function snapshotForm() {
  return JSON.stringify({
    form: formData.value,
    vendorCatalog: resolveVendorCatalogEntries(),
  });
}

function markClean() {
  initialSnapshot.value = snapshotForm();
}

const isDirty = computed(() => snapshotForm() !== initialSnapshot.value);

async function persistVendorCatalog(orgId) {
  if (!showVendorCatalog.value || !orgId) return;
  const entries = resolveVendorCatalogEntries();
  try {
    await apiClient.put(`/organizations/${orgId}/vendor-catalog`, { entries });
  } catch (catalogErr) {
    console.error('[OrganizationQuickCreate] Vendor catalog save failed:', catalogErr);
    throw catalogErr;
  }
}

const vendorCatalogSectionClass = computed(() => [
  'border-t border-gray-200 pt-8 dark:border-gray-700',
]);

// ============================================================================
// AUTHORITATIVE FIELD LISTS (DO NOT INFER FROM FILLED VALUES)
// ============================================================================
//
// QUICK_CREATE_FIELDS: Must exactly match Settings → Organizations → Quick Create
// Loaded from module definition (moduleDefinition.value.quickCreate)
//
// FULL FORM: core quick-create fields, types section, then remaining platform fields.
const QUICK_CREATE_FIELDS = computed(() => {
  if (!moduleDefinition.value || !moduleDefinition.value.quickCreate) {
    return [...ORGANIZATION_QUICK_CREATE_DEFAULT];
  }
  
  // Quick Create: Only fields from Settings → Organizations → Quick Create
  const quickCreate = moduleDefinition.value.quickCreate || [];
  return quickCreate.map((f) => {
    return typeof f === 'string' ? f : (f.key || f);
  });
});

const FULL_MODE_STATIC_EXCLUDE_FIELDS = [
  'organizationId',
  ...ORGANIZATION_TENANT_PLATFORM_FIELD_KEYS,
  'createdBy',
  'createdAt',
  'updatedAt',
  '_id',
  '__v'
];

const moduleSystemFieldKeys = computed(() => {
  const moduleFields = Array.isArray(moduleDefinition.value?.fields) ? moduleDefinition.value.fields : [];
  return moduleFields
    .map((field) => field?.key)
    .filter((key) => !!key && isSystemField('organizations', { key: String(key) }));
});

const moduleSystemFieldKeySet = computed(() =>
  new Set(moduleSystemFieldKeys.value.map((fieldKey) => String(fieldKey).toLowerCase()))
);

const fullModeExcludeFields = computed(() => {
  const deduped = new Set([
    ...FULL_MODE_STATIC_EXCLUDE_FIELDS.map((fieldKey) => String(fieldKey)),
    ...getGlobalSystemFieldKeys(),
    ...moduleSystemFieldKeys.value
  ]);
  return Array.from(deduped);
});

/** Full create surface: also hide types / type-scoped (rendered in app_participation). */
const fullModeLayoutExcludeFields = computed(() => {
  const moduleFields = Array.isArray(moduleDefinition.value?.fields) ? moduleDefinition.value.fields : [];
  const typeScoped = moduleFields
    .map((field) => field?.key)
    .filter((key) => key && (String(key).toLowerCase() === 'types' || isOrganizationTypeScopedFieldKey(key)));
  return [...new Set([...fullModeExcludeFields.value, ...typeScoped, 'types'])];
});

const orgFullModeComposites = computed(() => {
  const ids = ['app_participation'];
  if (showVendorCatalog.value) ids.push('vendor_catalog');
  return ids;
});

const fullQuickCreateFields = computed(() =>
  QUICK_CREATE_FIELDS.value.filter((fieldKey) => {
    const keyLower = String(fieldKey).toLowerCase();
    if (!isCoreOrganizationFieldKey(fieldKey)) return false;
    return !isTenantPlatformOrganizationFieldKey(fieldKey)
      && !fullModeExcludeFields.value.some((excluded) => excluded.toLowerCase() === keyLower)
      && !moduleSystemFieldKeySet.value.has(keyLower);
  })
);

const fullOtherFields = computed(() => {
  const moduleFields = Array.isArray(moduleDefinition.value?.fields) ? moduleDefinition.value.fields : [];
  const quickSet = new Set(fullQuickCreateFields.value.map((fieldKey) => String(fieldKey).toLowerCase()));
  const excludedSet = new Set(fullModeExcludeFields.value.map((fieldKey) => String(fieldKey).toLowerCase()));

  return moduleFields
    .map((field) => field?.key)
    .filter((key) => {
      if (!key) return false;
      const keyLower = String(key).toLowerCase();
      // types + type-scoped live in OrganizationTypesSection (People: participation section)
      if (keyLower === 'types') return false;
      if (excludedSet.has(keyLower)) return false;
      if (quickSet.has(keyLower)) return false;
      if (isOrganizationTypeScopedFieldKey(key)) return false;
      if (isTenantPlatformOrganizationFieldKey(key)) return false;
      if (moduleSystemFieldKeySet.value.has(keyLower)) return false;
      return true;
    });
});

/** Quick create keys with tenant/nested tenant paths removed (module API can expose subscription.* etc.) */
const sanitizedQuickCreateFieldKeys = computed(() =>
  QUICK_CREATE_FIELDS.value.filter((fieldKey) => !isTenantPlatformOrganizationFieldKey(fieldKey))
);

function isCoreOrganizationFieldKey(fieldKey) {
  const keyLower = String(fieldKey || '').toLowerCase();
  if (keyLower === 'types') return false;
  if (isOrganizationTypeScopedFieldKey(fieldKey)) return false;
  return true;
}

/** Core quick create only — types/participation fields render in OrganizationParticipationSection. */
const coreQuickCreateFieldsOverride = computed(() => {
  const sanitized = sanitizedQuickCreateFieldKeys.value.filter(isCoreOrganizationFieldKey);
  return sanitized.length ? sanitized : null;
});

const showCoreQuickCreateSection = computed(() => {
  if (mode.value === 'full') return fullQuickCreateFields.value.length > 0;
  const override = coreQuickCreateFieldsOverride.value;
  if (override?.length) return true;
  if (!moduleDefinition.value) return true;
  return sanitizedQuickCreateFieldKeys.value.some(isCoreOrganizationFieldKey);
});

/** People parity: border-t only in quick mode when core fields sit above. */
const typesSectionClass = computed(() => {
  const classes = ['flex', 'flex-col', 'gap-4'];
  if (mode.value === 'quick' && showCoreQuickCreateSection.value) {
    classes.push('border-t', 'border-gray-200', 'pt-8', 'dark:border-gray-700');
  }
  return classes;
});

const moduleLoading = ref(false);

const fetchOrganizationModuleDefinition = async () => {
  if (moduleLoading.value) return;
  moduleLoading.value = true;

  try {
    try {
      const response = await apiClient.get('/modules/organizations/quick-create');
      if (response?.success && response?.data) {
        const mod = response.data;
        const layoutApplied = ensureModuleCreateLayout(
          'organizations',
          Array.isArray(mod.fields) ? mod.fields : [],
          mod.fieldLayout || null
        );
        mod.fieldLayout = layoutApplied.layout;
        mod.fields = layoutApplied.fields;
        moduleDefinition.value = mod;
        return;
      }
    } catch (error) {
      console.warn('[OrganizationQuickCreate] Failed quick-create module fetch, falling back to modules endpoint:', error);
    }

    try {
      const organizationsModule = await fetchModuleDefinitionCached('organizations', {
        context: 'platform',
      });
      if (organizationsModule) {
        const mod = organizationsModule;
        const layoutApplied = ensureModuleCreateLayout(
          'organizations',
          Array.isArray(mod.fields) ? mod.fields : [],
          mod.fieldLayout || null
        );
        mod.fieldLayout = layoutApplied.layout;
        mod.fields = layoutApplied.fields;
        moduleDefinition.value = mod;
      }
    } catch (error) {
      console.error('[OrganizationQuickCreate] Failed to fetch organizations module definition:', error);
    }
  } finally {
    moduleLoading.value = false;
  }
};

// Computed: Helper text based on mode
const helperText = computed(() => {
  return isEditMode.value
    ? 'Update the organization information below.'
    : 'Fill in the information below to create a new organization.';
});

// Computed: Drawer width class based on mode (quick vs full)
// Vendor Catalog needs horizontal room for the line table — force wide panel.
const drawerWidthClass = computed(() => {
  return panelWide.value || showVendorCatalog.value ? 'sm:w-[60rem]' : 'sm:w-[30rem]';
});

watch(showVendorCatalog, (show) => {
  if (show) {
    panelWide.value = true;
  } else if (mode.value === 'quick') {
    panelWide.value = false;
  }
});

// Exclude only system and tenant fields from Quick Create rendering.
// Field selection is settings-driven (Settings → Organizations → Quick Create).
const QUICK_MODE_STATIC_EXCLUDE_FIELDS = [
  'createdBy',
  ...ORGANIZATION_TENANT_PLATFORM_FIELD_KEYS,
  'organizationId',
  'createdAt',
  'updatedAt',
  '_id',
  '__v'
];

const coreFormExcludeFields = computed(() => {
  const deduped = new Set([
    ...QUICK_MODE_STATIC_EXCLUDE_FIELDS.map((fieldKey) => String(fieldKey)),
    ...getGlobalSystemFieldKeys(),
    ...moduleSystemFieldKeys.value
  ]);
  return Array.from(deduped);
});

/**
 * Handle form ready event from DynamicForm (Quick Create mode only)
 */
const onFormReady = (module) => {
  if (!module || moduleDefinition.value) return;
  moduleDefinition.value = module;
};

/**
 * Update form data (preserved across mode switches)
 */
const updateFormData = (newData) => {
  formData.value = { ...newData };
};

const scrollToFirstErrorField = async () => {
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
    );
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus({ preventScroll: true });
    }
    break;
  }
};

/**
 * Switch to Full Form mode
 * ARCHITECTURAL INTENT: Mode switch preserves form state. No API call happens.
 * Updates both UI mode and submission intent mode.
 */
const switchToFull = () => {
  setOrgDrawerMode('full');

  // Ensure formData has structure for full form fields
  // DO NOT clear existing values - preserve drafts
  formData.value = {
    ...formData.value,
    types: formData.value.types ?? [],
    industry: formData.value.industry ?? '',
    website: formData.value.website ?? '',
    phone: formData.value.phone ?? '',
    address: formData.value.address ?? '',
  };
};

/**
 * Switch to Quick Create mode
 * ARCHITECTURAL INTENT: Mode switch preserves form state. No API call happens.
 * Updates both UI mode and submission intent mode.
 * DO NOT clear form state - preserve drafts for UX.
 */
const switchToQuick = () => {
  setOrgDrawerMode('quick');
};

/**
 * Close drawer
 */
const closeDrawer = () => {
  emit('close');
};

const requestClose = async () => {
  if (saving.value) return;
  if (
    isDirty.value &&
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

/**
 * Handle dialog close (from overlay click)
 */
const handleDialogClose = () => {
  requestClose();
};

/**
 * Build create organization payload based on current mode
 * 
 * CRITICAL LOCK: This function filters payload based on createMode at submit time.
 * Draft values may persist in memory, but ONLY fields allowed in the active mode
 * are included in the payload.
 * 
 * @param {Record<string, any>} formState - Current form state (may contain draft values)
 * @returns {Record<string, any>} Filtered payload with only allowed fields
 */
function resolveAllowedFieldsForSubmit(formState) {
  const selectedTypes = Array.isArray(formState.types) ? formState.types : [];
  const typeDependentKeys = getOrganizationFieldsForTypes(selectedTypes, organizationTypeDefs.value);

  if (createMode.value === 'quick') {
    const coreKeys = sanitizedQuickCreateFieldKeys.value.filter(isCoreOrganizationFieldKey);
    const baseCore = coreKeys.length > 0 ? coreKeys : ['name'];
    return [...new Set([...baseCore, 'types', 'participations', ...typeDependentKeys])];
  }

  return [
    ...new Set([
      ...fullQuickCreateFields.value,
      ...fullOtherFields.value,
      'types',
      'participations',
      ...typeDependentKeys,
    ]),
  ];
}

function buildCreateOrganizationPayload(formState) {
  const allowedFields = resolveAllowedFieldsForSubmit(formState);

  const payload = {};
  
  // Only include fields that are in the allowed list for current mode
  for (const field of allowedFields) {
    if (field in formState) {
      const value = formState[field];
      
      // Handle different value types
      if (field === 'participations' && value && typeof value === 'object' && !Array.isArray(value)) {
        if (Object.keys(value).length > 0) {
          payload.participations = value;
        }
        continue;
      }
      if (Array.isArray(value)) {
        // Include only non-empty arrays
        if (value.length > 0) {
          payload[field] = value;
        }
      } else if (typeof value === 'string') {
        // Include only non-empty strings (trimmed)
        const trimmed = value.trim();
        if (trimmed !== '') {
          payload[field] = trimmed;
        }
      } else if (value !== null && value !== undefined) {
        // Include other non-null values (numbers, booleans, etc.)
        payload[field] = value;
      }
    }
  }
  
  const selectedTypes = Array.isArray(formState.types) ? formState.types : [];
  const typeFiltered = filterOrganizationSubmitPayloadByTypes(
    payload,
    selectedTypes,
    organizationTypeDefs.value
  );
  const normalized = normalizeOrganizationEditSubmitPayload(typeFiltered, moduleDefinition.value?.fields);

  // Vendor Catalog is not a module field — attach when Inventory Vendor is active
  if (showVendorCatalog.value) {
    normalized.vendorCatalog = resolveVendorCatalogEntries();
  }

  return normalized;
}

/**
 * Handle form submission (both modes)
 * ARCHITECTURAL INTENT: Submission logic filters payload based on createMode.
 * Always send only allowed fields for the current mode. Backend enforces isTenant = false.
 */
const handleSubmit = async () => {
  saving.value = true;
  errors.value = {};
  
  try {
    // Validate required fields
    if (!formData.value.name || formData.value.name.trim() === '') {
      errors.value.name = 'Name is required';
      scrollToFirstErrorField();
      saving.value = false;
      return;
    }

    const website = formData.value.website?.trim();
    if (website && !isValidWebsiteInput(formData.value.website)) {
      errors.value.website = getWebsiteValidationMessage(formData.value.website) || 'Enter a valid website URL (e.g., example.com or https://example.org)';
      scrollToFirstErrorField();
      saving.value = false;
      return;
    }

    let response;
    
    if (isEditMode.value) {
      // EDIT MODE: PATCH /organizations/:id — only fields visible in the active mode
      const payload = buildCreateOrganizationPayload(formData.value);
      response = await apiClient.patch(`/organizations/${props.organizationId}`, payload);
    } else {
      // CREATE MODE: POST /organizations
      // CRITICAL: Build payload using filtered function based on current createMode
      // This ensures only fields allowed in the active mode are persisted
      const payload = buildCreateOrganizationPayload(formData.value);
      
      response = await apiClient.post('/organizations', payload);
    }
    
    if (response.success) {
      const org = response.data;
      const orgId = org?._id || org?.id || props.organizationId;

      // Always persist catalog via dedicated endpoint (source of truth for UI rows)
      if (showVendorCatalog.value && orgId) {
        try {
          await persistVendorCatalog(orgId);
        } catch (catalogErr) {
          errors.value._general =
            catalogErr?.response?.data?.message ||
            catalogErr?.message ||
            t('organizations.vendorCatalogSaveFailed');
          scrollToFirstErrorField();
          saving.value = false;
          // Keep drawer open so user can retry; org may already exist
          if (!isEditMode.value && orgId) {
            emit('saved', org);
          }
          return;
        }
      }

      // In edit mode, just emit saved event
      if (isEditMode.value) {
        emit('saved', org);
        closeDrawer();
        return;
      }
      
      // CREATE MODE: Handle auto-link context if provided (e.g., from People surface)
      const createdOrg = org;
      if (props.autoLinkContext) {
        if (props.autoLinkContext.personId || props.autoLinkContext.contactId) {
          const personId = props.autoLinkContext.personId || props.autoLinkContext.contactId;
          try {
            // Link the created organization to the person
            await apiClient.put(`/people/${personId}`, {
              organization: createdOrg._id || createdOrg.id
            });
            console.log('[OrganizationQuickCreate] Auto-linked organization to person:', personId);
            
            // Emit refresh events
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('arivu:refresh-person', {
                detail: { personId }
              }));
              window.dispatchEvent(new CustomEvent('arivu:refresh-organization', {
                detail: { organizationId: createdOrg._id || createdOrg.id }
              }));
            }
          } catch (linkError) {
            console.error('[OrganizationQuickCreate] Failed to auto-link organization:', linkError);
            // Don't fail the creation if linking fails
          }
        }
      } else if (props.openRecordOnSave) {
        // Standalone create (command palette / list): open OrganizationSurface in a new tab
        const orgId = createdOrg._id || createdOrg.id;
        if (orgId) {
          openTab(`/organizations/${orgId}`, { insertAdjacent: true });
        }
      }
      
      emit('saved', createdOrg);
      
      // Dispatch global event to refresh list views
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('arivu:record-created', {
          detail: { moduleKey: 'organizations', record: createdOrg }
        }));
      }
      
      closeDrawer();
    } else {
      errors.value._general = response.message || 'Failed to create organization';
    }
  } catch (error) {
    console.error('[OrganizationQuickCreate] Error creating organization:', error);
    if (error.response?.data?.errors) {
      errors.value = { ...error.response.data.errors };
      scrollToFirstErrorField();
    } else {
      errors.value._general = error.message || 'Failed to create organization';
    }
  } finally {
    saving.value = false;
  }
};

// Fetch organization data for edit mode
const loading = ref(false);

const fetchOrganizationData = async () => {
  if (!isEditMode.value || !props.organizationId) return;
  
  loading.value = true;
  errors.value = {};
  
  try {
    const response = await apiClient.get(`/organizations/${props.organizationId}/editable`);
    
    if (response.success && response.data) {
      const data = response.data;
      
      // Defensive check: If API returns forbidden fields, show generic error
      const forbiddenFields = ['subscription', 'limits', 'enabledApps', 'billing', 'isTenant'];
      const hasForbiddenFields = forbiddenFields.some(field => data[field] !== undefined);
      
      if (hasForbiddenFields) {
        errors.value._general = 'Invalid data received. Please contact support.';
        console.error('API returned forbidden fields:', Object.keys(data));
        return;
      }
      
      // Populate form with fetched data
      formData.value = {
        name: data.name || '',
        types: Array.isArray(data.types) ? [...data.types] : [],
        industry: data.industry || '',
        website: data.website || '',
        phone: data.phone || '',
        address: data.address || '',
        participations:
          data.participations && typeof data.participations === 'object'
            ? { ...data.participations }
            : undefined,
        vendorStatus: data.vendorStatus ?? null,
        vendorRating: data.vendorRating ?? null,
        vendorContract: data.vendorContract ?? null,
        preferredPaymentMethod: data.preferredPaymentMethod ?? null,
        taxId: data.taxId ?? null
      };

      try {
        const catRes = await apiClient.get(
          `/organizations/${props.organizationId}/vendor-catalog`,
          { params: { includeInactive: true } }
        );
        const rows = catRes?.data ?? catRes;
        vendorCatalogLines.value = Array.isArray(rows)
          ? rows
          : Array.isArray(rows?.data)
            ? rows.data
            : [];
      } catch {
        vendorCatalogLines.value = [];
      }
      
      setOrgDrawerMode('quick', { animate: false });
      markClean();
    } else {
      errors.value._general = response.message || 'Failed to load organization data';
    }
  } catch (err) {
    console.error('Error fetching organization data:', err);
    
    if (err.response?.status === 404) {
      errors.value._general = 'Organization not found';
    } else if (err.response?.status === 403) {
      errors.value._general = 'You do not have permission to edit this organization';
    } else if (err.response?.data?.message) {
      errors.value._general = err.response.data.message;
    } else {
      errors.value._general = err.message || 'Failed to load organization data';
    }
  } finally {
    loading.value = false;
  }
};

// Reset form and mode when drawer opens/closes
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    fetchOrganizationModuleDefinition();
    if (isEditMode.value) {
      setOrgDrawerMode('quick', { animate: false });
      fetchOrganizationData();
    } else {
      // Create mode: use initial data
      formData.value = {
        ...props.initialData,
        types: Array.isArray(props.initialData?.types) ? [...props.initialData.types] : [],
      };
      vendorCatalogLines.value = [];
      errors.value = {};
      setOrgDrawerMode('quick', { animate: false });
      markClean();
    }
  }
});

onUnmounted(() => {
  clearModeAnimTimer();
});
</script>
