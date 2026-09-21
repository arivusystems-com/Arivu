<template>
  <WorkspaceScopedDrawerShell
    :is-open="isOpen && !compareMergeOpen"
    :title-id="drawerTitleId"
    :draft-module-key="moduleKey"
    :draft-record-id="draftRecordIdForShell"
    @backdrop="handleDialogClose"
    @escape="handleDialogClose"
    @park="handlePark"
    @unpark="handleUnpark"
  >
                <div
                  :class="[
                    'rounded-tl-xl overflow-hidden flex h-full flex-col bg-white dark:bg-gray-900 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 w-screen max-w-full overflow-x-hidden transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width]',
                    isCommercialLinesForm ? 'sm:w-[80rem]' : panelWide ? 'sm:w-[60rem]' : 'sm:w-[30rem]'
                  ]"
                  @pointerdown.capture="markUserInteraction"
                  @focusin.capture="markUserInteraction"
                >
                <form @submit.prevent="handleSubmit" class="relative flex h-full flex-col">
                  <!-- Header: fixed at top -->
                  <div class="relative flex shrink-0 items-center gap-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4 sm:px-6">
                    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                      <h2 :id="drawerTitleId" class="min-w-0 shrink-0 pr-2 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{{ computedTitle }}</h2>
                      <p
                        v-if="duplicateMode && !isEditing"
                        class="truncate text-xs text-gray-500 dark:text-gray-400"
                      >
                        {{ t('records.drawerDuplicateHint') }}
                      </p>
                    </div>
                    <div
                      v-if="showFieldSearch"
                      class="pointer-events-none absolute inset-x-5 top-1/2 z-10 flex -translate-y-1/2 justify-center sm:inset-x-6"
                    >
                      <div class="pointer-events-auto relative w-full max-w-xs">
                        <label class="sr-only" for="create-drawer-field-search">{{ t('common.massEditSearchFields') }}</label>
                        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                        <input
                          id="create-drawer-field-search"
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
                      ref="closeButtonRef"
                      type="button"
                      class="relative z-20 ml-auto shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer"
                      @click="requestClose"
                    >
                      <span class="absolute -inset-2.5" />
                      <span class="sr-only">{{ t('common.closePanel') }}</span>
                      <XMarkIcon class="size-5" aria-hidden="true" />
                    </button>
                  </div>

                  <!-- Body: scrollable (user interaction only — not programmatic DynamicForm sync) -->
                  <div class="h-0 flex-1 overflow-y-auto">
                    <div
                      ref="formFieldsRootRef"
                      class="px-5 sm:px-6 py-5 space-y-5"
                      @input.capture="markFormChanged"
                      @change.capture="markFormChanged"
                      @pointerdown.capture="markUserInteraction"
                    >
                          <!-- General Error Message -->
                          <div v-if="errors._general" class="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                            <div class="flex">
                              <div class="flex-shrink-0">
                                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l-1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                                </svg>
                              </div>
                              <div class="ml-3">
                                <p class="text-sm text-red-800 dark:text-red-200">{{ errors._general }}</p>
                              </div>
                            </div>
                          </div>
                          <!-- Loading when fetching Quick Create config from Settings -->
                          <div
                            v-if="moduleOverrideLoading && (effectiveQuickCreateMode || isEditing)"
                            class="flex justify-center py-12"
                          >
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                          </div>
                          <!-- Dynamic Form: moduleOverride from Settings when drawer opens so Quick Create fields match Settings -->
                          <DynamicForm
                            v-else-if="!moduleOverrideLoading"
                            :moduleKey="moduleKey"
                            :moduleOverride="effectiveModuleOverrideForDrawer"
                            :formData="formData"
                            :errors="errors"
                            :excludeFields="effectiveExcludeFields"
                            :lockedFields="lockedFields"
                            :showAllFields="isCommercialLinesForm || fullMode || !effectiveQuickCreateMode"
                            :quickCreateMode="strictQuickCreateForForm"
                            :useQuickCreateOrder="(useQuickCreateOrder || strictQuickCreateForForm) && !fullMode"
                            :singleColumn="!fullMode && !isCommercialLinesForm"
                            :quickCreateFirstWhenExpanded="effectiveQuickCreateMode"
                            :fieldSearch="showFieldSearch ? fieldSearch : ''"
                            @update:formData="updateFormData"
                            @ready="onFormReady"
                          >
                            <template v-if="isCommercialLinesForm" #lines>
                              <div class="space-y-3">
                                <h3 class="text-sm font-semibold tracking-wide text-gray-900 dark:text-white uppercase">
                                  {{ t(commercialLinesConfig.linesTitleKey) }}
                                </h3>
                                <div v-if="commercialFormLoading" class="flex justify-center py-10">
                                  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                                </div>
                                <QuoteLinesRecordSection
                                  v-else-if="isQuoteModule && commercialFormRecord"
                                  :record="commercialFormRecord"
                                  :context="commercialLinesFormContext"
                                  :draft-mode="isCommercialLinesCreate"
                                  @updated="handleCommercialLinesUpdated"
                                />
                                <InvoiceLinesRecordSection
                                  v-else-if="isInvoiceModule && commercialFormRecord"
                                  :record="commercialFormRecord"
                                  :context="commercialLinesFormContext"
                                  :draft-mode="isCommercialLinesCreate"
                                  @updated="handleCommercialLinesUpdated"
                                />
                                <SalesOrderLinesRecordSection
                                  v-else-if="isSalesOrderModule && commercialFormRecord"
                                  :record="commercialFormRecord"
                                  :context="commercialLinesFormContext"
                                  :draft-mode="isCommercialLinesCreate"
                                  @updated="handleCommercialLinesUpdated"
                                />
                                <PurchaseOrderLinesRecordSection
                                  v-else-if="isPurchaseOrderModule && commercialFormRecord"
                                  :record="commercialFormRecord"
                                  :context="commercialLinesFormContext"
                                  :draft-mode="isCommercialLinesCreate"
                                  @updated="handleCommercialLinesUpdated"
                                />
                                <p
                                  v-else
                                  class="text-sm text-red-600 dark:text-red-400"
                                >
                                  {{ isCommercialLinesEdit ? t(commercialLinesConfig.loadFailedKey) : t(commercialLinesConfig.draftFailedKey) }}
                                </p>
                              </div>
                            </template>
                            <template v-if="moduleKey === 'deals'" #deal_relationships>
                              <DealRelationshipEditor
                                v-if="!effectiveQuickCreateMode || fullMode"
                                ref="relationshipEditorRef"
                                v-model="dealRelationships"
                                :people="dealPeopleList"
                                :organizations="dealOrgList"
                                :read-only="false"
                              />
                            </template>
                            <template v-if="moduleKey === 'deals'" #lines>
                              <DealLinesSection
                                v-if="!effectiveQuickCreateMode || fullMode"
                                ref="dealLinesSectionRef"
                                :record="isEditing ? record : null"
                                :draft-mode="!isEditing"
                                :show-title="true"
                                :editable="true"
                                :currency="dealLinesCurrency"
                                :initial-amount-mode="formData.amountMode || 'MANUAL'"
                                @draft-change="handleDealLinesDraftChange"
                                @updated="handleDealLinesUpdated"
                              />
                            </template>
                            <template v-if="isPurchaseReturnModule && !isEditing" #after-quick-create>
                              <PurchaseReturnCreateSourcesPanel
                                ref="purchaseReturnSourcesRef"
                                :vendor-id="formData.vendorId"
                              />
                            </template>
                            <template v-if="isDeliveryReturnModule && !isEditing" #after-quick-create>
                              <DeliveryReturnCreateSourcesPanel
                                ref="deliveryReturnSourcesRef"
                                :customer-id="formData.customerId"
                              />
                            </template>
                            <template v-if="isDeliveryNoteModule && !isEditing" #after-quick-create>
                              <DeliveryNoteCreateSourcesPanel
                                ref="deliveryNoteSourcesRef"
                                :customer-id="formData.customerId"
                              />
                            </template>
                            <template v-if="isReceiptNoteModule && !isEditing" #after-quick-create>
                              <ReceiptNoteCreatePanel ref="receiptNoteCreateRef" />
                            </template>
                            <template v-if="isStockAdjustmentModule && !isEditing" #after-quick-create>
                              <StockAdjustmentCreatePanel ref="stockAdjustmentCreateRef" />
                            </template>
                            <template v-if="isStockTransferModule && !isEditing" #after-quick-create>
                              <StockTransferCreatePanel ref="stockTransferCreateRef" />
                            </template>
                          </DynamicForm>
                    </div>
                  </div>

                  <!-- Footer: left toggle + right actions (same as edit drawer) -->
                  <div class="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur px-5 py-3.5 sm:px-6">
                    <button
                      v-if="showFullModeToggle"
                      type="button"
                      class="text-sm font-medium text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 cursor-pointer transition-colors"
                      @click="toggleFullMode"
                    >
                      {{ fullMode ? t('common.drawerBackQuickCreate') : t('common.drawerShowAllFields') }}
                    </button>
                    <span v-else />
                    <div class="flex items-center gap-2.5">
                      <button
                        type="button"
                        class="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                        @click="requestClose"
                      >
                        {{ t('actions.cancel') }}
                      </button>
                      <button
                        type="submit"
                        :disabled="saving"
                        class="inline-flex min-w-[5.5rem] justify-center rounded-lg bg-indigo-600 dark:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 dark:hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        {{ primaryActionLabel }}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
  </WorkspaceScopedDrawerShell>

  <DuplicateWarningDialog
    :open="duplicateWarningOpen"
    :module-key="duplicateModuleKey"
    :matches="duplicateMatches"
    @cancel="duplicateWarningOpen = false"
    @view="onDuplicateView"
    @compare="onDuplicateCompare"
  />
  <RecordCompareMergeDrawer
    :open="compareMergeOpen"
    :module-key="duplicateModuleKey"
    :record-id-a="compareRecordIdA"
    :record-id-b="compareRecordIdB"
    @close="compareMergeOpen = false"
    @merged="onDuplicateMerged"
  />
</template>

<script setup>
import { ref, watch, computed, nextTick, onUnmounted, defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import DynamicForm from './DynamicForm.vue';
import WorkspaceScopedDrawerShell from '@/components/common/WorkspaceScopedDrawerShell.vue';
import { FORM_FIELD_SEARCH_CONTROL_CLASS } from '@/utils/formFieldControlClasses';
import DealRelationshipEditor from '@/components/deals/DealRelationshipEditor.vue';
import {
  tabDrawerDraftKey,
  saveTabDrawerDraft,
  getTabDrawerDraft,
  clearTabDrawerDraft,
  findLatestCreateDraftForModule,
} from '@/composables/useTabDrawerDrafts';
// Lazy-load to avoid circular chunk ↔ record-activity init (production TDZ).
const DealLinesSection = defineAsyncComponent(
  () => import('@/components/record-page/sections/DealLinesSection.vue')
);
const QuoteLinesRecordSection = defineAsyncComponent(
  () => import('@/components/record-page/sections/QuoteLinesRecordSection.vue')
);
const InvoiceLinesRecordSection = defineAsyncComponent(
  () => import('@/components/record-page/sections/InvoiceLinesRecordSection.vue')
);
const SalesOrderLinesRecordSection = defineAsyncComponent(
  () => import('@/components/record-page/sections/SalesOrderLinesRecordSection.vue')
);
const PurchaseOrderLinesRecordSection = defineAsyncComponent(
  () => import('@/components/record-page/sections/PurchaseOrderLinesRecordSection.vue')
);
const PurchaseReturnCreateSourcesPanel = defineAsyncComponent(
  () => import('@/components/common/PurchaseReturnCreateSourcesPanel.vue')
);
const DeliveryReturnCreateSourcesPanel = defineAsyncComponent(
  () => import('@/components/common/DeliveryReturnCreateSourcesPanel.vue')
);
const DeliveryNoteCreateSourcesPanel = defineAsyncComponent(
  () => import('@/components/common/DeliveryNoteCreateSourcesPanel.vue')
);
const ReceiptNoteCreatePanel = defineAsyncComponent(
  () => import('@/components/common/ReceiptNoteCreatePanel.vue')
);
const StockAdjustmentCreatePanel = defineAsyncComponent(
  () => import('@/components/common/StockAdjustmentCreatePanel.vue')
);
const StockTransferCreatePanel = defineAsyncComponent(
  () => import('@/components/common/StockTransferCreatePanel.vue')
);
import apiClient from '@/utils/apiClient';
import { getModuleRecordCrudPathBase } from '@/utils/moduleRecordApiPath';
import { fetchModuleDefinitionCached } from '@/utils/tenantSchemaApiCache';
import {
  fetchPeopleListCached,
  fetchOrganizationsListCached,
  DEAL_RELATIONSHIP_PEOPLE_PARAMS,
  DEAL_RELATIONSHIP_ORG_PARAMS,
} from '@/utils/recordLookupCache';
import { getFieldDisplayLabel } from '@/utils/fieldDisplay';
import { getFieldDependencyState } from '@/utils/dependencyEvaluation';
import { useAuthStore } from '@/stores/authRegistry';
import { resolveOrgCurrencyCode } from '@/utils/currencyOptions';
import { isAuditEventType, isEventLocationGeoValid, resolveEventGeoRequired, evaluateMeetingConferenceSaveGate } from '@/utils/eventUtils';
import { resolveMeetingInvitePrompt } from '@/platform/events/meetingInvitePrompt';
import { confirmAction, confirmActionChoice } from '@/composables/useConfirmAction';
import { getEventTypeByKey, getEventTypeByLabel, getEventTypeDefinitionByKey, EVENT_TYPE_DEFINITIONS } from '@/metadata/eventTypes';
import { useTabs } from '@/composables/useTabs';
import { useRoute } from 'vue-router';
import { getTaskSystemFields } from '@/platform/fields/taskFieldModel';
import {
  getEventSystemFields,
  getEventFieldMetadata,
} from '@/platform/fields/eventFieldModel';
import {
  getCaseSystemFields,
  stripCaseRecordForEditForm,
  filterCaseEditSubmitPayload,
  buildCaseEditSubmitPayload,
  CASE_QUICK_CREATE_DEFAULT,
} from '@/platform/fields/caseFieldModel';
import {
  getGlobalSystemFieldKeys,
  isSystemField,
  canEditField,
  normalizeFieldKeyForSystemMatch,
} from '@/platform/fields/fieldCapabilityEngine';
import {
  getQuickCreateAllowedFieldKeys,
  shouldFilterPayloadByQuickCreate
} from '@/utils/quickCreatePayloadFilter';
import { augmentPeopleQuickCreateAllowedFieldKeys } from '@/platform/fields/peopleSalutationField';
import { useCreationContext } from '@/utils/creationContext';
import DuplicateWarningDialog from '@/components/duplicates/DuplicateWarningDialog.vue';
import RecordCompareMergeDrawer from '@/components/duplicates/RecordCompareMergeDrawer.vue';
import { getParticipationFields, getCoreIdentityFields, mergePeopleVirtualFieldDefinitions } from '@/platform/fields/peopleFieldModel';
import {
  buildOrganizationSubmitPayload,
  stripOrganizationRecordForEditForm,
} from '@/platform/fields/organizationFieldModel';
import { useOrganizationTypes } from '@/composables/useOrganizationTypes';
import { getFormFieldValue, syncPeopleVirtualFieldKeys, applyVirtualFieldDefault } from '@/utils/getFieldValue';
import {
  applyCreateOwnerDefaultsToForm,
  applyCreateOwnerDefaultsToPayload,
  resolveCurrentUserId
} from '@/utils/recordCreateOwnerDefaults';
import {
  getItemQuickCreateFields,
  getItemCatalogScaffoldFieldKeys,
  getItemLegacyCategoryFieldKeys
} from '@/platform/fields/itemFieldModel';
import { normalizeModuleFieldsFromMetadata } from '@/platform/fields/fieldMerge';
import { ensureModuleCreateLayout } from '@/platform/fields/createSurface';
import {
  applyQuoteDiscountsToRecord,
  applyQuoteLineDeleteToRecord,
  applyQuoteLinesAddToRecord,
  applyQuoteLinesMutationToRecord,
  applyQuoteLinesRecalculateToRecord,
  applyQuoteSectionsToRecord,
} from '@/utils/quoteRecordPatch';
import {
  resolveCommercialLinesAdapter,
} from '@/platform/commercialLines/adapters';

const _c = globalThis.console;
function drawerDbg(...args) {
  if (import.meta.env.DEV) _c.log(...args);
}
function drawerWarn(...args) {
  if (import.meta.env.DEV) _c.warn(...args);
}

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  moduleKey: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: null // Will be computed from moduleKey and record
  },
  /**
   * When true, this is a duplicate-as-create surface (not a blank new record).
   * Affects header title + primary CTA; initialData should be prefilled from source.
   */
  duplicateMode: {
    type: Boolean,
    default: false
  },
  initialData: {
    type: Object,
    default: () => ({})
  },
  prefillText: {
    type: String,
    default: ''
  },
  prefillFieldKey: {
    type: String,
    default: ''
  },
  record: {
    type: Object,
    default: null // If provided, this is edit mode
  },
  excludeFields: {
    type: Array,
    default: () => [] // Fields to exclude from the form (e.g., app-specific fields)
  },
  // When true, Deal create/edit uses role-based relationship editor; contactId/accountId excluded
  useDealRelationshipEditor: {
    type: Boolean,
    default: true
  },
  lockedFields: {
    type: Array,
    default: () => [] // Fields that should be readonly/locked (e.g., ['accountId'])
  },
  /** When provided (and key matches moduleKey), skips /modules fetch on drawer open. */
  moduleDefinitionPrefetch: {
    type: Object,
    default: null
  },
  quickCreateMode: {
    type: Boolean,
    default: false // If true, only show fields configured in quickCreate settings
  },
  useQuickCreateOrder: {
    type: Boolean,
    default: false // If true, use quickCreate array order even in edit mode
  },
  /**
   * When false, create/update succeeds and emits `saved` without opening a record tab.
   * Used for nested lookup "Create new" flows (e.g. Organization from People form).
   */
  openRecordOnSave: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['close', 'saved']);

const authStore = useAuthStore();
const route = useRoute();
const { openTab, activeTab, activeTabId } = useTabs();

const ownerTabId = ref(null);
const pendingDraftRestore = ref(false);
const drawerTitleId = 'create-record-drawer-title';
const draftRecordIdForShell = computed(() => {
  const id = props.record?._id || props.record?.id || null;
  return id != null ? String(id) : null;
});

function currentDraftKey(tabId = ownerTabId.value || activeTabId.value) {
  const recordId = props.record?._id || props.record?.id || null;
  return tabDrawerDraftKey(tabId, props.moduleKey, recordId);
}

/** Prefer owner-tab draft; fall back to newest create draft for this module (remount / lost ownerTabId). */
function resolveExistingCreateDraft() {
  if (props.record) return null;
  const keyed = getTabDrawerDraft(currentDraftKey(ownerTabId.value || activeTabId.value));
  const hasLocalCommercial =
    keyed?.commercialFormRecord &&
    typeof keyed.commercialFormRecord === 'object' &&
    !keyed.commercialFormRecord._id;
  if (
    keyed?.commercialCreateDraftId ||
    (keyed?.formData && Object.keys(keyed.formData).length) ||
    hasLocalCommercial
  ) {
    return keyed;
  }
  return findLatestCreateDraftForModule(props.moduleKey)?.draft || null;
}

function snapshotDraftPayload() {
  return {
    formData: formData.value || {},
    fullMode: fullMode.value,
    panelWide: panelWide.value,
    fieldSearch: fieldSearch.value,
    userHasEdited: userHasEdited.value,
    hasUnsavedChanges: hasUnsavedChanges.value,
    dealRelationships: dealRelationships.value,
    dealLinesDraft: dealLinesDraft.value,
    commercialFormRecord: commercialFormRecord.value,
    commercialCreateDraftId: commercialCreateDraftId.value,
    commercialCreateSaved: commercialCreateSaved.value,
  };
}

function persistOwnerDraft() {
  if (!ownerTabId.value || !props.isOpen) return;
  if (!hasUnsavedChanges.value && !userHasEdited.value && !commercialCreateDraftId.value) {
    if (!Object.keys(formData.value || {}).length) return;
  }
  saveTabDrawerDraft(currentDraftKey(ownerTabId.value), snapshotDraftPayload());
}

/** Await in-flight commercial record load (edit only) before parking tab draft. */
async function handlePark() {
  if (isCommercialLinesEdit.value && commercialFormEnsurePromise.value) {
    try {
      await commercialFormEnsurePromise.value;
    } catch {
      /* ensure logs its own errors */
    }
  }
  persistOwnerDraft();
}

function applyDraft(draft) {
  if (!draft) return;
  if (draft.formData && typeof draft.formData === 'object') {
    formData.value = { ...draft.formData };
  }
  fullMode.value = Boolean(draft.fullMode);
  panelWide.value = Boolean(draft.panelWide ?? draft.fullMode);
  fieldSearch.value = draft.fieldSearch || '';
  userHasEdited.value = Boolean(draft.userHasEdited);
  hasUnsavedChanges.value = Boolean(draft.hasUnsavedChanges);
  if (draft.dealRelationships) {
    dealRelationships.value = draft.dealRelationships;
  }
  if (draft.dealLinesDraft !== undefined) {
    dealLinesDraft.value = draft.dealLinesDraft;
  }
  if (draft.commercialFormRecord) {
    commercialFormRecord.value = draft.commercialFormRecord;
  }
  if (draft.commercialCreateDraftId) {
    commercialCreateDraftId.value = draft.commercialCreateDraftId;
    commercialCreateSaved.value = Boolean(draft.commercialCreateSaved);
  }
  pendingDraftRestore.value = true;
}

function clearOwnerDraft() {
  if (!ownerTabId.value) return;
  clearTabDrawerDraft(currentDraftKey(ownerTabId.value));
}

/**
 * Tab return — panel stayed mounted while parked. Re-assert commercial full mode.
 * Create uses local lines stub (no server Draft on open/unpark).
 */
async function handleUnpark() {
  if (!props.isOpen) return;
  if (commercialFormEnsurePromise.value) {
    await commercialFormEnsurePromise.value;
  }
  const existingDraft = resolveExistingCreateDraft();
  if (existingDraft) {
    applyDraft(existingDraft);
  }
  if (isCommercialLinesForm.value) {
    setDrawerMode(true, { animate: false });
  }
  if (isCommercialLinesCreate.value && !commercialFormRecord.value) {
    seedCommercialCreateStub();
  } else if (isCommercialLinesEdit.value) {
    await ensureCommercialFormRecord();
  }
  persistOwnerDraft();
}

// Omit override = infer from route + activeApp on /people (null would mean explicit global-only)
const { isSalesContext } = useCreationContext();
const { typeDefs: organizationTypeDefs } = useOrganizationTypes();
const isEditing = computed(() => !!props.record);
const moduleKeyLower = computed(() => props.moduleKey?.toLowerCase() || '');
const isQuoteModule = computed(() => moduleKeyLower.value === 'quotes');
const isInvoiceModule = computed(() => moduleKeyLower.value === 'invoices');
const isSalesOrderModule = computed(() => moduleKeyLower.value === 'sales_orders');
const isPurchaseOrderModule = computed(() => moduleKeyLower.value === 'purchase_orders');
const isPurchaseReturnModule = computed(() => moduleKeyLower.value === 'purchase_returns');
const isDeliveryReturnModule = computed(() => moduleKeyLower.value === 'delivery_returns');
const isDeliveryNoteModule = computed(() => moduleKeyLower.value === 'delivery_notes');
const isReceiptNoteModule = computed(() => moduleKeyLower.value === 'receipt_notes');
const isStockAdjustmentModule = computed(() => moduleKeyLower.value === 'stock_adjustments');
const isStockTransferModule = computed(() => moduleKeyLower.value === 'stock_transfers');
const isCommercialLinesForm = computed(
  () =>
    isQuoteModule.value ||
    isInvoiceModule.value ||
    isSalesOrderModule.value ||
    isPurchaseOrderModule.value
);
const isCommercialLinesCreate = computed(() => isCommercialLinesForm.value && !isEditing.value);
const isCommercialLinesEdit = computed(() => isCommercialLinesForm.value && isEditing.value);
const COMMERCIAL_LINES_CONFIG = {
  quotes: {
    apiPath: '/quotes',
    draftFailedKey: 'records.quoteCreateDraftFailed',
    loadFailedKey: 'records.quoteLoadFailed',
    linesTitleKey: 'records.quoteLinesSectionTitle'
  },
  invoices: {
    apiPath: '/invoices',
    draftFailedKey: 'records.invoiceCreateDraftFailed',
    loadFailedKey: 'records.invoiceLoadFailed',
    linesTitleKey: 'records.invoiceLinesSectionTitle'
  },
  sales_orders: {
    apiPath: '/sales-orders',
    draftFailedKey: 'records.salesOrderCreateDraftFailed',
    loadFailedKey: 'records.salesOrderLoadFailed',
    linesTitleKey: 'records.salesOrderLinesSectionTitle'
  },
  purchase_orders: {
    apiPath: '/inventory/purchase-orders',
    draftFailedKey: 'platform.poCreateLinesDraftFailed',
    loadFailedKey: 'platform.poCreateLinesDraftFailed',
    linesTitleKey: 'platform.poLinesSectionTitle'
  }
};
const commercialLinesConfig = computed(
  () => COMMERCIAL_LINES_CONFIG[moduleKeyLower.value] || COMMERCIAL_LINES_CONFIG.quotes
);
const fullMode = ref(false);
/** Drives animated panel width; staged slightly ahead/behind content mode for smoother expand/collapse. */
const panelWide = ref(false);
let modeAnimTimer = null;
const fieldSearch = ref('');
const showFieldSearch = computed(
  () => fullMode.value || !effectiveQuickCreateMode.value || isCommercialLinesForm.value
);
const closeButtonRef = ref(null);
const formFieldsRootRef = ref(null);
/** One-shot: focus first create field after DynamicForm mounts for this open */
let pendingInitialFieldFocus = false;
/** Ignore focusin/pointer from programmatic open focus so Escape/backdrop still work */
let suppressInteractionMark = false;
const commercialFormRecord = ref(null);
const commercialFormLoading = ref(false);
const commercialFormEnsurePromise = ref(null);
/** Auto-created commercial doc id while create drawer is open; discarded unless Save succeeds */
const commercialCreateDraftId = ref(null);
const commercialCreateSaved = ref(false);
/** Purchase Return create: multi-select sources panel */
const purchaseReturnSourcesRef = ref(null);
const deliveryReturnSourcesRef = ref(null);
const deliveryNoteSourcesRef = ref(null);
/** Receipt Note create: PO + location picker */
const receiptNoteCreateRef = ref(null);
const stockAdjustmentCreateRef = ref(null);
const stockTransferCreateRef = ref(null);
const commercialLinesFormContext = {
  expandedLeftSection: '',
  onSectionUpdated({ payload } = {}) {
    handleCommercialLinesSectionUpdated(payload);
  }
};

// Two modes: Quick Create Mode (only quick create fields) | Full Form Mode (all fields from config except system)
// Show toggle when quick-create is configured. Commercial line docs always open in full form (no toggle).
// Stock adjustments use a dedicated create panel only — full mode would dump noise fields.
const showFullModeToggle = computed(
  () =>
    effectiveQuickCreateMode.value &&
    !isCommercialLinesForm.value &&
    !isStockAdjustmentModule.value &&
    !isStockTransferModule.value
);

function clearModeAnimTimer() {
  if (modeAnimTimer) {
    clearTimeout(modeAnimTimer);
    modeAnimTimer = null;
  }
}

function setDrawerMode(expanded, { animate = true } = {}) {
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
  markUserInteraction();
  const enteringFull = !fullMode.value && !panelWide.value;
  setDrawerMode(enteringFull);
  if (enteringFull && props.moduleKey === 'deals') {
    syncLegacyLookupsIntoDealRelationships();
  }
}

// Quick Create Mode: show only fields from Settings → Quick Create
// Full Form Mode: show all fields from module config (except system) in config order
const effectiveQuickCreateMode = computed(() => {
  if (isCommercialLinesEdit.value) return true;
  if (props.quickCreateMode) return true;
  // If module settings provide a quickCreate config, default to strict quick-create mode.
  // This keeps create drawers aligned with Settings-selected fields.
  const hasConfiguredQuickCreate =
    Array.isArray(moduleOverrideFromSettings.value?.quickCreate) &&
    moduleOverrideFromSettings.value.quickCreate.length > 0;
  if (hasConfiguredQuickCreate) return true;

  // Fallback defaults for modules where create drawers are quick-create first by design.
  const useQuickCreateByDefault = [
    'organizations',
    'tasks',
    'items',
    'deals',
    'cases',
    'quotes',
    'invoices',
    'sales_orders',
    'purchase_orders',
    'purchase_returns',
    'delivery_returns',
    'delivery_notes',
    'sales_returns',
    'receipt_notes',
    'stockrooms',
    'stock_adjustments',
    'stock_transfers'
  ];
  return useQuickCreateByDefault.includes(props.moduleKey?.toLowerCase());
});

// DynamicForm treats quickCreateMode as strict: empty quickCreate → no fields. Only enable strict
// mode when Settings (or parent prop) actually defines quickCreate keys; otherwise show required-field fallback.
// Stock adjustments/transfers create use only the create panel (empty quickCreate by design).
const strictQuickCreateForForm = computed(() => {
  if (!effectiveQuickCreateMode.value) return false;
  if (props.quickCreateMode) return true;
  if (fullMode.value) return false;
  if (isCommercialLinesForm.value) return true;
  if (isStockAdjustmentModule.value) return true;
  if (isStockTransferModule.value) return true;
  const qc = effectiveModuleOverrideForDrawer.value?.quickCreate
    ?? moduleOverrideFromSettings.value?.quickCreate;
  return Array.isArray(qc) && qc.length > 0;
});

// Module name mapping for titles
const moduleNameMap = {
  'people': 'Person',
  'organizations': 'Organization',
  'deals': 'Deal',
  'tasks': 'Task',
  'cases': 'Case',
  'events': 'Event',
  'quotes': 'Quote',
  'invoices': 'Invoice',
  'sales_orders': 'Sales Order',
  'purchase_orders': 'Purchase Order',
  'purchase_returns': 'Purchase Return',
  'delivery_returns': 'Delivery Return',
  'delivery_notes': 'Delivery Note',
  'sales_returns': 'Sales Return',
  'receipt_notes': 'Receipt Note',
  'stockrooms': 'Stockroom',
  'stock_adjustments': 'Adjustment',
  'stock_transfers': 'Transfer',
  'users': 'User'
};

const computedTitle = computed(() => {
  if (props.title) return props.title;
  const moduleName = moduleNameMap[props.moduleKey] || props.moduleKey;
  if (isEditing.value) return t('records.drawerEditTitle', { module: moduleName });
  if (props.duplicateMode) return t('records.drawerDuplicateTitle', { module: moduleName });
  return t('records.drawerNewTitle', { module: moduleName });
});

const primaryActionLabel = computed(() => {
  if (saving.value) return t('states.saving');
  if (isEditing.value) return t('actions.update');
  if (props.duplicateMode) return t('records.drawerDuplicateSave');
  return t('actions.save');
});

const coreSystemFieldKeys = [
  '_id',
  '__v',
  'organizationId',
  'organizationid',
  'createdBy',
  'createdby',
  'createdAt',
  'createdat',
  'createdTime',
  'createdtime',
  'modifiedBy',
  'modifiedby',
  'modifiedTime',
  'modifiedtime',
  'updatedAt',
  'updatedat',
  'activityLogs',
  'activitylogs',
];

/** Event fields that must never appear on create/edit forms (platform-managed / dedicated surfaces). */
const EVENT_FORM_EXCLUDED_KEYS = [
  'descriptionVersions',
  'auditHistory',
  'metadata',
  'kpiActuals',
  'checkIn',
  'checkOut',
  'executionStartTime',
  'executionEndTime',
  'timeSpent',
  'isPaused',
  'pauseReasons',
  'routeSequence',
  'currentOrgIndex',
  'isMultiOrg',
  'formAssignment',
  'statusCategory',
  'completedAt',
  'cancelledAt',
  'cancelledBy',
  'cancellationReason',
  'source',
  'eventId',
  'eventNumber',
  'appointment',
  'calendarSync',
  // Legacy module-definition keys not on Event schema (stale tenant defs)
  'linkedTaskId',
  'reminderAt',
  'relatedToType',
];

/** Audit / beat participation — dedicated surfaces only; same hide list for create and edit drawers. */
const EVENT_DRAWER_EXCLUDED_PARTICIPATION_KEYS = [
  'orgList',
  'minTimePerStop',
  'backgroundTracking',
  'allowedActions',
  'kpiTargets',
  'auditorId',
  'reviewerId',
  'correctiveOwnerId',
  'allowSelfReview',
  'minVisitDuration',
  'partnerVisibility',
  'auditState',
  'linkedFormId',
  'attachments',
  'visibility',
];

const effectiveExcludeFields = computed(() => {
  const base = props.excludeFields || [];
  const excluded = new Set([
    ...(base || []),
    ...getGlobalSystemFieldKeys(),
    ...coreSystemFieldKeys,
  ]);
  // RULE: Global system fields (trash: deletedAt, deletedBy, deletionReason) never show in create/edit
  if (props.moduleKey === 'deals') {
    // Deal create/edit: Linked Items is DealLinesSection; never show legacy lineItems Rich Text.
    // Quick create uses legacy accountId/contactId; full mode uses DealRelationshipEditor.
    const relationshipEditorVisible =
      props.useDealRelationshipEditor && (!effectiveQuickCreateMode.value || fullMode.value);
    [
      ...(props.useDealRelationshipEditor
        ? relationshipEditorVisible
          ? ['contactId', 'accountId', 'dealPeople', 'dealOrganizations']
          : ['dealPeople', 'dealOrganizations']
        : []),
      'status',
      'derivedStatus',
      'descriptionVersions',
      'stageHistory',
      'playbookState',
      'activityLogs',
      'stageOrder',
      'lineItems',
      'amountMode',
      'linesGrandTotal',
    ].forEach((k) => excluded.add(k));
    return Array.from(excluded);
  }
  if (props.moduleKey === 'tasks') {
    const taskSystemFields = (getTaskSystemFields() || []).map((k) => String(k).toLowerCase());
    // Exclude only system fields; relatedTo and subtasks stay in DynamicForm so they appear in config order (like edit drawer)
    ['relatedToType', 'relatedToId', ...taskSystemFields].forEach((k) => excluded.add(k));
    return Array.from(excluded);
  }
  if (props.moduleKey === 'events') {
    (getEventSystemFields() || []).forEach((k) => excluded.add(k));
    EVENT_FORM_EXCLUDED_KEYS.forEach((k) => excluded.add(k));
    const eventFields = effectiveModuleOverrideForDrawer.value?.fields || [];
    for (const field of eventFields) {
      const key = String(field?.key || '');
      if (!key) continue;
      if (isSystemField('events', { key }) || !canEditField('events', { key })) {
        excluded.add(key);
      }
    }
    // Create + edit drawers share one surface: hide audit/sales-beat participation
    // (dedicated surfaces own those). Meeting geo stays editable.
    EVENT_DRAWER_EXCLUDED_PARTICIPATION_KEYS.forEach((k) => excluded.add(k));
    const drawerAllowedParticipation = new Set(['georequired']);
    for (const field of eventFields) {
      const key = String(field?.key || '');
      if (!key) continue;
      // Tenant custom fields have no platform metadata — keep on create/edit.
      if (field.isCustom === true || field.custom === true) continue;
      const meta = getEventFieldMetadata(key);
      if (meta?.owner === 'participation') {
        const keyNorm = normalizeFieldKeyForSystemMatch(key);
        if (drawerAllowedParticipation.has(keyNorm)) continue;
        excluded.add(key);
      }
    }
    return Array.from(excluded);
  }
  if (props.moduleKey === 'items') {
    getItemCatalogScaffoldFieldKeys().forEach((k) => excluded.add(k));
    getItemLegacyCategoryFieldKeys().forEach((k) => excluded.add(k));
    ['status', 'product_image', 'stock_quantity', 'reorder_level', 'serial_numbers'].forEach((k) => excluded.add(k));
    // System-managed identity (Item Code / item_id) — never on create or edit forms
    const itemFields = effectiveModuleOverrideForDrawer.value?.fields || [];
    for (const field of itemFields) {
      const key = String(field?.key || '');
      if (!key) continue;
      if (isSystemField('items', { key })) {
        excluded.add(key);
      }
    }
    ['item_code', 'item_id'].forEach((k) => excluded.add(k));
    return Array.from(excluded);
  }
  // Receipt Note create: PO + location come from ReceiptNoteCreatePanel only
  if (props.moduleKey === 'receipt_notes' && !isEditing.value) {
    ['purchaseOrderId', 'receiptLocationId', 'vendorId', 'status', 'receivedBy', 'receiptNoteNumber'].forEach(
      (k) => excluded.add(k)
    );
  }
  // Stock adjustment create: body comes from StockAdjustmentCreatePanel only
  if (props.moduleKey === 'stock_adjustments' && !isEditing.value) {
    [
      'inventoryLocationId',
      'reasonCode',
      'status',
      'lines',
      'notes',
      'inventoryAdjustmentId',
      'inventoryTransactionId',
      'postedAt',
      'postedBy'
    ].forEach((k) => excluded.add(k));
  }
  // Stock transfer create: body comes from StockTransferCreatePanel only
  if (props.moduleKey === 'stock_transfers' && !isEditing.value) {
    [
      'fromLocationId',
      'toLocationId',
      'status',
      'lines',
      'notes',
      'inventoryTransferId',
      'inventoryTransactionId',
      'shippedAt',
      'receivedAt',
      'postedAt',
      'postedBy'
    ].forEach((k) => excluded.add(k));
  }
  if (props.moduleKey === 'cases') {
    (getCaseSystemFields() || []).forEach((k) => excluded.add(k));
    const caseFields = effectiveModuleOverrideForDrawer.value?.fields || [];
    for (const field of caseFields) {
      const key = String(field?.key || '');
      if (!key) continue;
      if (isSystemField('cases', { key })) {
        excluded.add(key);
      }
    }
    return Array.from(excluded);
  }
  if (props.moduleKey?.toLowerCase() === 'quotes') {
    const quoteFields = effectiveModuleOverrideForDrawer.value?.fields || [];
    for (const field of quoteFields) {
      const key = String(field?.key || '');
      if (!key) continue;
      const normalized = normalizeFieldKeyForSystemMatch(key);
      if (isSystemField('quotes', { key })) {
        excluded.add(key);
        continue;
      }
      if (normalized.startsWith('customerresponse')) {
        excluded.add(key);
      }
    }
    return Array.from(excluded);
  }
  if (isInvoiceModule.value || isSalesOrderModule.value || moduleKeyLower.value === 'payments') {
    const fields = effectiveModuleOverrideForDrawer.value?.fields || [];
    for (const field of fields) {
      const key = String(field?.key || '');
      if (!key) continue;
      if (isSystemField(moduleKeyLower.value, { key })) {
        excluded.add(key);
      }
    }
    return Array.from(excluded);
  }
  return Array.from(excluded);
});


// Fetch module (including Quick Create from Settings) when drawer opens
async function fetchModuleForDrawer() {
  if (!props.moduleKey) return;
  const keyLower = (props.moduleKey || '').toLowerCase().trim();
  const prefetched =
    props.moduleDefinitionPrefetch &&
    String(props.moduleDefinitionPrefetch?.key || '').toLowerCase().trim() === keyLower
      ? props.moduleDefinitionPrefetch
      : null;
  if (!prefetched) {
    moduleOverrideLoading.value = true;
  }
  moduleOverrideFromSettings.value = null;
  try {
    const moduleDefinition = prefetched || (await fetchModuleDefinitionCached(props.moduleKey));
    if (!moduleDefinition) return;
    const modulesList = [moduleDefinition];
    const currentPath = String(
      route.path ||
        activeTab.value?.path ||
        (typeof window !== 'undefined' ? window.location.pathname : '') ||
        ''
    ).toLowerCase();
    const inferredAppKey =
      currentPath.startsWith('/helpdesk/') ? 'helpdesk'
      : currentPath.startsWith('/audit/') ? 'audit'
      : currentPath.startsWith('/portal/') ? 'portal'
      : currentPath.startsWith('/projects/') ? 'projects'
      : currentPath.startsWith('/sales/') ? 'sales'
      // Sales CRM routes are not always nested under /sales/*
      : currentPath.startsWith('/deals') ? 'sales'
      : currentPath.startsWith('/quotes') ? 'platform'
      : currentPath.startsWith('/invoices') ? 'platform'
      : currentPath.startsWith('/sales-orders') ? 'platform'
      : '';

    // Platform core modules must resolve to platform appKey even off-module routes (e.g. global search).
    const moduleAppKeyHintByKey = {
      quotes: 'platform',
      invoices: 'platform',
      sales_orders: 'platform',
      items: 'platform',
      forms: 'platform',
      tasks: 'platform',
      organizations: 'platform',
      events: 'platform',
      sales_returns: 'inventory',
      stockrooms: 'inventory',
      stock_adjustments: 'inventory',
      stock_transfers: 'inventory',
      purchase_orders: 'inventory',
      receipt_notes: 'inventory',
      purchase_returns: 'inventory',
      delivery_notes: 'inventory',
      delivery_returns: 'inventory',
    };
    const resolvedAppKey =
      moduleAppKeyHintByKey[keyLower] || inferredAppKey;

    const candidates = modulesList.filter((m) => (m.key || '').toLowerCase().trim() === keyLower);
    const mod = resolvedAppKey
      ? (candidates.find((m) => String(m.appKey || '').toLowerCase().trim() === resolvedAppKey) || candidates[0])
      : candidates[0];
    if (mod) {
      if (!mod.quickCreate) mod.quickCreate = [];
      if (!mod.quickCreateLayout) mod.quickCreateLayout = { version: 1, rows: [] };
      mod.fields = normalizeModuleFieldsFromMetadata(mod.key, mod.fields || []);
      if ((mod.key || '').toLowerCase() === 'people' && Array.isArray(mod.fields)) {
        mod.fields = mergePeopleVirtualFieldDefinitions(mod.fields);
      }
      if ((mod.key || '').toLowerCase() === 'items') {
        const fieldKeys = new Set(
          (mod.fields || []).map((f) => String(f?.key || '').toLowerCase()).filter(Boolean)
        );
        const resolveQc = (keys) => keys.filter((k) => fieldKeys.has(String(k).toLowerCase()));
        let quickCreate = resolveQc(Array.isArray(mod.quickCreate) ? mod.quickCreate : []);
        if (!quickCreate.length) {
          quickCreate = resolveQc(getItemQuickCreateFields());
        }
        mod.quickCreate = quickCreate;
        mod.quickCreateLayout = { version: 1, rows: [] };
      }
      if ((mod.key || '').toLowerCase() === 'stockrooms') {
        const fieldKeys = new Set(
          (mod.fields || []).map((f) => String(f?.key || '').toLowerCase()).filter(Boolean)
        );
        const resolveQc = (keys) => keys.filter((k) => fieldKeys.has(String(k).toLowerCase()));
        const defaultQc = [
          'name',
          'locationCode',
          'locationType',
          'description',
          'isDefault',
          'allowNegative'
        ];
        let quickCreate = resolveQc(Array.isArray(mod.quickCreate) ? mod.quickCreate : []);
        if (!quickCreate.length) {
          quickCreate = resolveQc(defaultQc);
        }
        mod.quickCreate = quickCreate;
        mod.quickCreateLayout = { version: 1, rows: [] };
      }
      const layoutApplied = ensureModuleCreateLayout(
        mod.key || props.moduleKey,
        Array.isArray(mod.fields) ? mod.fields : [],
        mod.fieldLayout || null
      );
      mod.fieldLayout = layoutApplied.layout;
      mod.fields = layoutApplied.fields;
      moduleOverrideFromSettings.value = mod;
    }
  } catch (e) {
    drawerWarn('[CreateRecordDrawer] Failed to fetch module for quick create:', e);
  } finally {
    moduleOverrideLoading.value = false;
  }
}

const formData = ref({ ...props.initialData });
const errors = ref({});
const saving = ref(false);
const duplicateWarningOpen = ref(false);
const duplicateMatches = ref([]);
const compareMergeOpen = ref(false);
const compareRecordIdA = ref(null);
const compareRecordIdB = ref(null);

const duplicateModuleKey = computed(() => {
  const k = String(props.moduleKey || '').toLowerCase();
  if (k === 'contacts') return 'people';
  return k;
});

function onDuplicateView(id) {
  duplicateWarningOpen.value = false;
  if (id && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('arivu:open-record', {
      detail: { moduleKey: duplicateModuleKey.value, recordId: id },
    }));
  }
}

function onDuplicateCompare(id) {
  duplicateWarningOpen.value = false;
  const mergeable = ['people', 'organizations', 'items'].includes(duplicateModuleKey.value);
  if (!mergeable) {
    onDuplicateView(id);
    return;
  }
  compareRecordIdA.value = props.record?._id || null;
  compareRecordIdB.value = id;
  // On create, A is the unsaved candidate — compare needs two existing ids.
  // Open merge between matched records if editing; otherwise just view+cancel flow.
  if (!compareRecordIdA.value) {
    compareRecordIdA.value = id;
    compareRecordIdB.value = duplicateMatches.value[1]?.record?._id || id;
  }
  if (compareRecordIdA.value && compareRecordIdB.value
    && String(compareRecordIdA.value) !== String(compareRecordIdB.value)) {
    compareMergeOpen.value = true;
  } else {
    onDuplicateView(id);
  }
}

function onDuplicateMerged() {
  saving.value = false;
  closeDrawer();
}
const moduleDefinition = ref(null);
/** True when the user has interacted with the form (backdrop/Escape blocked); not set by programmatic sync */
const userHasEdited = ref(false);
/** True when form values / lines actually changed (refresh/leave confirm) */
const hasUnsavedChanges = ref(false);
function markUserInteraction() {
  if (suppressInteractionMark) return;
  userHasEdited.value = true;
}
function markFormChanged() {
  userHasEdited.value = true;
  hasUnsavedChanges.value = true;
}
// Module definition fetched when drawer opens so Quick Create fields come from Settings
const moduleOverrideFromSettings = ref(null);
const moduleOverrideLoading = ref(false);

// For deals: stage options must come from the selected pipeline only (not default pipeline).
// Return a stable reference when pipeline and module are unchanged to avoid recursive updates
// (DynamicForm re-applies on override change -> ready -> initializeForm -> formData -> computed -> loop).
const dealOverrideCache = { mod: null, pipelineKey: undefined, quickMode: undefined, result: null };
const effectiveModuleOverrideForDrawer = computed(() => {
  const mod = moduleOverrideFromSettings.value;
  if (!mod) return mod;
  const moduleKeyLower = String(props.moduleKey || '').toLowerCase();

  // Cases quick create should follow only selected quick-create fields.
  // Clear advanced layout rows in quick mode to prevent non-selected fields from rendering.
  if (moduleKeyLower === 'cases') {
    const quickMode = effectiveQuickCreateMode.value && !fullMode.value;
    const fieldKeys = new Set(
      (mod.fields || []).map((f) => String(f?.key || '').toLowerCase()).filter(Boolean)
    );
    const resolveQuickCreateKeys = (keys) =>
      keys.filter((k) => fieldKeys.has(String(k).toLowerCase()));

    let quickCreate = Array.isArray(mod.quickCreate) ? [...mod.quickCreate] : [];
    quickCreate = resolveQuickCreateKeys(quickCreate);
    if (!quickCreate.length && quickMode) {
      quickCreate = resolveQuickCreateKeys([...CASE_QUICK_CREATE_DEFAULT]);
    }
    if (!quickMode) {
      return quickCreate.length ? { ...mod, quickCreate } : mod;
    }
    return {
      ...mod,
      quickCreate,
      quickCreateLayout: { version: 1, rows: [] }
    };
  }

  // Items: layout rows with missing/stale keys render an empty drawer; use list-based quick create.
  if (moduleKeyLower === 'items') {
    const quickMode = effectiveQuickCreateMode.value && !fullMode.value;
    const fieldKeys = new Set(
      (mod.fields || []).map((f) => String(f?.key || '').toLowerCase()).filter(Boolean)
    );
    const resolveQuickCreateKeys = (keys) =>
      keys.filter((k) => fieldKeys.has(String(k).toLowerCase()));

    let quickCreate = Array.isArray(mod.quickCreate) ? [...mod.quickCreate] : [];
    quickCreate = resolveQuickCreateKeys(quickCreate);
    if (!quickCreate.length && quickMode) {
      quickCreate = resolveQuickCreateKeys(getItemQuickCreateFields());
    }
    if (!quickMode) {
      return { ...mod, quickCreate };
    }
    return {
      ...mod,
      quickCreate,
      quickCreateLayout: { version: 1, rows: [] }
    };
  }

  if (moduleKeyLower === 'quotes' || moduleKeyLower === 'invoices' || moduleKeyLower === 'sales_orders') {
    const quickMode = effectiveQuickCreateMode.value && !fullMode.value;
    const fieldKeys = new Set(
      (mod.fields || []).map((f) => String(f?.key || '').toLowerCase()).filter(Boolean)
    );
    const resolveQuickCreateKeys = (keys) =>
      keys.filter((k) => fieldKeys.has(String(k).toLowerCase()));

    let quickCreate = Array.isArray(mod.quickCreate) ? [...mod.quickCreate] : [];
    quickCreate = resolveQuickCreateKeys(quickCreate);
    if (!quickMode) {
      return { ...mod, quickCreate };
    }
    return {
      ...mod,
      quickCreate,
      quickCreateLayout: { version: 1, rows: [] }
    };
  }

  if (moduleKeyLower !== 'deals') return mod;
  const pipelineSettings = mod.pipelineSettings;
  const pipelineKey = formData.value?.pipeline;
  const quickMode = effectiveQuickCreateMode.value && !fullMode.value;
  if (!Array.isArray(pipelineSettings) || pipelineSettings.length === 0) return mod;
  // Return cached override when module and pipeline key are unchanged
  if (
    dealOverrideCache.mod === mod &&
    dealOverrideCache.pipelineKey === pipelineKey &&
    dealOverrideCache.quickMode === quickMode &&
    dealOverrideCache.result
  )
    return dealOverrideCache.result;
  const pipeline = pipelineKey
    ? pipelineSettings.find((p) => String(p?.key ?? '').trim() === String(pipelineKey).trim())
    : null;
  const stages = pipeline?.stages ?? [];
  const stageOptions = stages.map((s) => {
    const name = (s?.name ?? '').trim();
    return name ? { value: name, label: name, color: (s.color && /^#[0-9A-Fa-f]{6}$/.test(String(s.color).trim())) ? String(s.color).trim() : null } : null;
  }).filter(Boolean);
  const fields = (mod.fields || []).map((f) => {
    if ((f?.key || '').toString().toLowerCase() !== 'stage') return f;
    return { ...f, options: stageOptions };
  });
  const result = { ...mod, fields };
  // Deal quick create should strictly follow the quickCreate list only.
  // If advanced layout rows are present, they can include non-quick-create fields.
  // Clear layout in quick mode so DynamicForm renders from quickCreate keys.
  if (quickMode) {
    result.quickCreateLayout = { version: 1, rows: [] };
  }
  dealOverrideCache.mod = mod;
  dealOverrideCache.pipelineKey = pipelineKey;
  dealOverrideCache.quickMode = quickMode;
  dealOverrideCache.result = result;
  return result;
});

// Deal relationship editor state (when moduleKey=deals)
const relationshipEditorRef = ref(null);
const dealLinesSectionRef = ref(null);
const dealLinesDraft = ref(null);
const dealRelationships = ref({ dealPeople: [], dealOrganizations: [] });
const dealPeopleList = ref([]);
const dealOrgList = ref([]);

const dealLinesCurrency = computed(() => {
  const fromForm = String(formData.value?.currency || '').trim();
  const fromRecord = String(props.record?.currency || '').trim();
  return resolveOrgCurrencyCode(fromForm || fromRecord || authStore.organization);
});

const handleDealLinesDraftChange = (payload) => {
  dealLinesDraft.value = payload || null;
  if (payload) markFormChanged();
  if (payload?.amountMode === 'AUTO' && payload.amount != null) {
    formData.value = { ...formData.value, amount: payload.amount, amountMode: 'AUTO' };
  } else if (payload?.amountMode) {
    formData.value = { ...formData.value, amountMode: payload.amountMode };
  }
};

const handleDealLinesUpdated = (payload) => {
  if (payload?.deal?.amount != null && formData.value) {
    formData.value = {
      ...formData.value,
      amount: payload.deal.amount,
      amountMode: payload.deal.amountMode || formData.value.amountMode
    };
  }
};

const normalizeRelationshipId = (value) => {
  if (!value) return '';
  if (typeof value === 'object') {
    return String(value._id || value.id || value.recordId || '');
  }
  return String(value);
};

const dedupeDealPeople = (rows = []) => {
  const merged = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const personId = normalizeRelationshipId(row?.personId);
    const role = String(row?.role || '').trim();
    if (!personId || !role) continue;
    // One person per deal; role is a property of that single relationship.
    const key = personId;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { ...row, personId, role });
      continue;
    }
    merged.set(key, {
      ...prev,
      ...row,
      personId,
      role: prev.isPrimary ? prev.role : (row.isPrimary ? role : (row.role || prev.role)),
      isActive: prev.isActive !== false || row.isActive !== false,
      isPrimary: !!prev.isPrimary || !!row.isPrimary,
      addedAt: prev.addedAt || row.addedAt,
      addedBy: prev.addedBy || row.addedBy || null
    });
  }
  return Array.from(merged.values());
};

const dedupeDealOrganizations = (rows = []) => {
  const merged = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const organizationId = normalizeRelationshipId(row?.organizationId);
    const role = String(row?.role || '').trim();
    if (!organizationId || !role) continue;
    // One organization per deal; role is a property of that single relationship.
    const key = organizationId;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { ...row, organizationId, role });
      continue;
    }
    merged.set(key, {
      ...prev,
      ...row,
      organizationId,
      role: row.isPrimary ? 'customer' : (prev.isPrimary ? prev.role : role),
      isActive: prev.isActive !== false || row.isActive !== false,
      isPrimary: !!prev.isPrimary || !!row.isPrimary,
      addedAt: prev.addedAt || row.addedAt,
      addedBy: prev.addedBy || row.addedBy || null
    });
  }
  return Array.from(merged.values());
};

const enforceSinglePrimaryContact = (rows = [], preferredPersonId = '') => {
  // Primary is independent of role — never coerce role when enforcing primary.
  const next = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
  const preferred = normalizeRelationshipId(preferredPersonId);
  const candidateIndexes = [];
  for (let i = 0; i < next.length; i += 1) {
    const row = next[i];
    if (row?.isActive === false) continue;
    if (!row?.isPrimary) continue;
    candidateIndexes.push(i);
  }
  if (candidateIndexes.length <= 1) return next;

  let keepIndex = candidateIndexes[0];
  if (preferred) {
    const preferredIndex = candidateIndexes.find((idx) => normalizeRelationshipId(next[idx]?.personId) === preferred);
    if (preferredIndex !== undefined) keepIndex = preferredIndex;
  }

  for (const idx of candidateIndexes) {
    next[idx].isPrimary = idx === keepIndex;
  }
  return next;
};

const enforceSinglePrimaryCustomer = (rows = [], preferredOrganizationId = '') => {
  const next = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
  // Primary org must always be Deal Relationship Role = customer.
  for (let i = 0; i < next.length; i += 1) {
    const row = next[i];
    if (row?.isActive === false || !row?.isPrimary) continue;
    if (String(row?.role || '') !== 'customer') {
      next[i] = { ...row, role: 'customer' };
    }
  }
  const preferred = normalizeRelationshipId(preferredOrganizationId);
  const candidateIndexes = [];
  for (let i = 0; i < next.length; i += 1) {
    const row = next[i];
    if (row?.isActive === false) continue;
    if (String(row?.role || '') !== 'customer') continue;
    if (!row?.isPrimary) continue;
    candidateIndexes.push(i);
  }
  if (candidateIndexes.length <= 1) return next;

  let keepIndex = candidateIndexes[0];
  if (preferred) {
    const preferredIndex = candidateIndexes.find((idx) => normalizeRelationshipId(next[idx]?.organizationId) === preferred);
    if (preferredIndex !== undefined) keepIndex = preferredIndex;
  }

  for (const idx of candidateIndexes) {
    next[idx].isPrimary = idx === keepIndex;
  }
  return next;
};

const normalizeDealRelationships = (value = {}, options = {}) => {
  const dealPeople = dedupeDealPeople(value?.dealPeople || []);
  const dealOrganizations = dedupeDealOrganizations(value?.dealOrganizations || []);
  return {
    dealPeople: enforceSinglePrimaryContact(dealPeople, options?.preferredPersonId),
    dealOrganizations: enforceSinglePrimaryCustomer(dealOrganizations, options?.preferredOrganizationId)
  };
};

/**
 * Quick create uses legacy accountId/contactId fields; full mode uses dealPeople/dealOrganizations.
 * Merge form lookups into the relationship editor so selections survive "Show all fields".
 */
function syncLegacyLookupsIntoDealRelationships() {
  if (props.moduleKey !== 'deals' || !props.useDealRelationshipEditor) return;

  const preferredPersonId = normalizeRelationshipId(formData.value?.contactId);
  const preferredOrganizationId = normalizeRelationshipId(formData.value?.accountId);
  if (!preferredPersonId && !preferredOrganizationId) return;

  const current = dealRelationships.value || { dealPeople: [], dealOrganizations: [] };
  let dealPeople = Array.isArray(current.dealPeople) ? current.dealPeople.map((p) => ({ ...p })) : [];
  let dealOrganizations = Array.isArray(current.dealOrganizations)
    ? current.dealOrganizations.map((o) => ({ ...o }))
    : [];

  if (preferredOrganizationId) {
    const hasOrg = dealOrganizations.some(
      (o) =>
        o.isActive !== false &&
        normalizeRelationshipId(o.organizationId) === preferredOrganizationId
    );
    if (!hasOrg) {
      const hasPrimaryCustomer = dealOrganizations.some(
        (o) => o.isActive !== false && o.isPrimary && String(o.role || '') === 'customer'
      );
      dealOrganizations.push({
        organizationId: preferredOrganizationId,
        role: 'customer',
        isPrimary: !hasPrimaryCustomer,
        isActive: true,
        addedAt: new Date()
      });
    }
  }

  if (preferredPersonId) {
    const hasPerson = dealPeople.some(
      (p) => p.isActive !== false && normalizeRelationshipId(p.personId) === preferredPersonId
    );
    if (!hasPerson) {
      const hasPrimaryContact = dealPeople.some(
        (p) => p.isActive !== false && p.isPrimary
      );
      dealPeople.push({
        personId: preferredPersonId,
        role: 'decision_maker',
        isPrimary: !hasPrimaryContact,
        isActive: true,
        addedAt: new Date()
      });
    }
  }

  dealRelationships.value = normalizeDealRelationships(
    { dealPeople, dealOrganizations },
    { preferredPersonId, preferredOrganizationId }
  );
}

const isDrawerDirty = () => hasUnsavedChanges.value;

const requestClose = async () => {
  if (saving.value) return;
  if (
    isDrawerDirty() &&
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
    clearOwnerDraft();
    ownerTabId.value = null;
    pendingDraftRestore.value = false;

    setDrawerMode(false, { animate: false });
    commercialFormRecord.value = null;
    commercialFormLoading.value = false;
    commercialFormEnsurePromise.value = null;
    commercialCreateDraftId.value = null;
    commercialCreateSaved.value = false;
    emit('close');
    // Reset form after closing
    setTimeout(() => {
      formData.value = {};
      errors.value = {};
      userHasEdited.value = false;
      hasUnsavedChanges.value = false;
      if (props.moduleKey === 'deals') {
        dealRelationships.value = { dealPeople: [], dealOrganizations: [] };
        dealLinesDraft.value = null;
      }
    }, 300);
  }
};

async function loadCommercialFormRecord(recordId) {
  const loaded = await apiClient.get(`${commercialLinesConfig.value.apiPath}/${recordId}`);
  commercialFormRecord.value = loaded?.data || loaded;
}

/** Local create stub — no server Draft until Save. */
function seedCommercialCreateStub() {
  if (!isCommercialLinesCreate.value) return;
  if (commercialFormRecord.value && !commercialFormRecord.value._id) {
    // Already seeded (e.g. re-open sync) — still merge commercial lines if stub has none
    const existingLines = Array.isArray(commercialFormRecord.value.lines)
      ? commercialFormRecord.value.lines
      : [];
    if (
      existingLines.length === 0 &&
      Array.isArray(props.initialData?._commercialLines) &&
      props.initialData._commercialLines.length
    ) {
      commercialFormRecord.value = {
        ...commercialFormRecord.value,
        lines: props.initialData._commercialLines.map((line, idx) => ({
          ...line,
          _localId: line._localId || `seed-line-${idx}`,
          lineType: line.lineType || 'product'
        })),
        sections:
          Array.isArray(props.initialData?._commercialSections) &&
          props.initialData._commercialSections.length
            ? props.initialData._commercialSections
            : commercialFormRecord.value.sections
      };
    }
    syncCommercialCreateHeaderFromForm();
    return;
  }

  const adapter = resolveCommercialLinesAdapter(
    isPurchaseOrderModule.value
      ? 'purchaseOrder'
      : isSalesOrderModule.value
        ? 'salesOrder'
        : isInvoiceModule.value
          ? 'invoice'
          : 'quote'
  );
  const orgCurrency =
    (typeof formData.value?.currency === 'string' && formData.value.currency) ||
    resolveOrgCurrencyCode(authStore.organization) ||
    'USD';
  const includeField = adapter.includeInTotalField || 'includeInQuoteTotal';

  let sections;
  if (
    Array.isArray(props.initialData?._commercialSections) &&
    props.initialData._commercialSections.length
  ) {
    sections = props.initialData._commercialSections.map((sec, idx) => {
      const sid =
        sec[adapter.sectionUuidField] ||
        sec[adapter.sectionIdField] ||
        sec._id ||
        `local-sec-${idx}`;
      return {
        ...sec,
        _id: sid,
        [adapter.sectionUuidField]: sid,
        [adapter.sectionIdField]: sid,
        sectionTitle: sec.sectionTitle || (idx === 0 ? 'General' : `Section ${idx + 1}`),
        sectionOrder: sec.sectionOrder != null ? Number(sec.sectionOrder) : idx,
        sectionType: sec.sectionType || 'standard',
        [includeField]: sec[includeField] !== false
      };
    });
  } else {
    const sectionId = `local-sec-${Date.now().toString(36)}`;
    sections = [
      {
        _id: sectionId,
        [adapter.sectionUuidField]: sectionId,
        sectionTitle: 'General',
        sectionOrder: 0,
        sectionType: 'standard',
        [includeField]: true,
        sectionTotal: 0
      }
    ];
  }

  const vendorId = isPurchaseOrderModule.value
    ? resolveFormRelationId(formData.value?.vendorId)
    : null;

  const lines = Array.isArray(props.initialData?._commercialLines)
    ? props.initialData._commercialLines.map((line, idx) => ({
        ...line,
        _localId: line._localId || `seed-line-${idx}`,
        _id: line._id || line._localId || `seed-line-${idx}`,
        [adapter.lineIdField]:
          line[adapter.lineIdField] || line._localId || `seed-line-${idx}`,
        lineType: line.lineType || 'product'
      }))
    : [];

  const lineSum = lines.reduce((sum, l) => {
    const lt = Number(l.lineTotal);
    if (Number.isFinite(lt)) return sum + lt;
    const qty = Number(l.quantity ?? l.quantityOrdered) || 0;
    const price = Number(l.unitPrice ?? l.unitPriceSnapshot) || 0;
    return sum + qty * price;
  }, 0);

  commercialFormRecord.value = {
    status: isPurchaseOrderModule.value ? 'draft' : 'Draft',
    currency: orgCurrency,
    lines,
    sections,
    subtotal: lineSum,
    grandTotal: lineSum,
    lineDiscountTotal: 0,
    globalDiscountTotal: 0,
    taxTotal: 0,
    chargesTotal: 0,
    adjustmentTotal: 0,
    overallDiscountType: props.initialData?.overallDiscountType || null,
    overallDiscountValue: props.initialData?.overallDiscountValue ?? 0,
    ...(vendorId ? { vendorId } : {})
  };
  commercialCreateDraftId.value = null;
  commercialCreateSaved.value = false;
  commercialFormLoading.value = false;
}

/**
 * Lookup drawers (e.g. PO vendor catalog) read header fields off commercialFormRecord.
 * Quick-create form fields live on formData — keep vendorId (and similar) in sync.
 */
function resolveFormRelationId(value) {
  if (value == null || value === '') return null;
  if (Array.isArray(value)) {
    return value.length ? resolveFormRelationId(value[0]) : null;
  }
  if (typeof value === 'object') {
    const id = value._id ?? value.id ?? value.value ?? value.recordId ?? null;
    return id != null && String(id).trim() ? String(id).trim() : null;
  }
  const s = String(value).trim();
  return s || null;
}

function syncCommercialCreateHeaderFromForm() {
  if (!isCommercialLinesCreate.value) return;
  const rec = commercialFormRecord.value;
  if (!rec || rec._id) return;

  const patch = {};
  if (isPurchaseOrderModule.value) {
    const vendorId = resolveFormRelationId(formData.value?.vendorId);
    if (String(rec.vendorId || '') !== String(vendorId || '')) {
      patch.vendorId = vendorId;
    }
  }

  const currencyRaw = formData.value?.currency;
  if (currencyRaw != null && currencyRaw !== '') {
    const currency =
      typeof currencyRaw === 'object' && !Array.isArray(currencyRaw)
        ? String(currencyRaw.code || currencyRaw.value || currencyRaw._id || '').trim()
        : String(currencyRaw).trim();
    if (currency && String(rec.currency || '').toUpperCase() !== currency.toUpperCase()) {
      patch.currency = currency;
    }
  }

  if (!Object.keys(patch).length) return;
  commercialFormRecord.value = { ...rec, ...patch };
}

/** Load commercial record for edit drawer only — create uses local stub until Save. */
async function ensureCommercialFormRecord() {
  if (isCommercialLinesCreate.value) {
    seedCommercialCreateStub();
    return;
  }
  if (!isCommercialLinesEdit.value) return;

  const editId = props.record?._id || props.record?.id;
  if (!editId) return;
  if (String(commercialFormRecord.value?._id || '') === String(editId)) return;
  if (commercialFormEnsurePromise.value) {
    await commercialFormEnsurePromise.value;
    return;
  }

  commercialFormLoading.value = true;
  commercialFormEnsurePromise.value = (async () => {
    try {
      await loadCommercialFormRecord(editId);
    } catch (error) {
      drawerWarn('[CreateRecordDrawer] Failed to load commercial record for edit:', error);
    } finally {
      commercialFormEnsurePromise.value = null;
      commercialFormLoading.value = false;
    }
  })();
  await commercialFormEnsurePromise.value;
}

/**
 * After header create, replay local commercial draft onto the new server record
 * (sections, product lines, bundles, discounts, taxes/charges).
 */
async function flushCommercialCreateLines(createdRecord) {
  const headerId = createdRecord?._id || createdRecord?.id;
  if (!headerId || !isCommercialLinesCreate.value) return createdRecord;

  const local = commercialFormRecord.value;
  if (!local) return createdRecord;

  const localLines = Array.isArray(local.lines) ? local.lines : [];
  const localSections = Array.isArray(local.sections) ? local.sections : [];
  const hasAnything =
    localLines.length > 0 ||
    localSections.some((s) => String(s?.sectionTitle || '').trim().toLowerCase() !== 'general') ||
    local.globalDiscountType ||
    local._localTransactionTaxIds?.length ||
    local._localTransactionChargeIds?.length ||
    local.transactionTaxSnapshot?.taxes?.length ||
    local.chargeDocumentSnapshot?.charges?.length;
  if (!hasAnything) return createdRecord;

  const adapter = resolveCommercialLinesAdapter(
    isPurchaseOrderModule.value
      ? 'purchaseOrder'
      : isSalesOrderModule.value
        ? 'salesOrder'
        : isInvoiceModule.value
          ? 'invoice'
          : 'quote'
  );
  const apiPath = commercialLinesConfig.value.apiPath;
  const includeField = adapter.includeInTotalField || 'includeInQuoteTotal';
  const isPurchaseOrderFlush = adapter.kind === 'purchaseOrder';

  let serverRecord = createdRecord;
  try {
    const loaded = await apiClient.get(`${apiPath}/${headerId}`);
    serverRecord = loaded?.data || loaded || createdRecord;
  } catch (error) {
    drawerWarn('[CreateRecordDrawer] Failed to reload commercial record before line flush:', error);
  }

  const sectionMap = new Map(); // localSectionRef -> serverSectionRef
  let serverSections = Array.isArray(serverRecord?.sections) ? [...serverRecord.sections] : [];
  const defaultSection =
    serverSections.find((s) => String(s?.sectionTitle || '').trim().toLowerCase() === 'general') ||
    serverSections[0] ||
    null;
  const defaultSectionRef = defaultSection
    ? String(defaultSection[adapter.sectionUuidField] || defaultSection._id || '')
    : null;

  if (!isPurchaseOrderFlush) {
  for (const localSec of localSections) {
    const localRef = String(localSec[adapter.sectionUuidField] || localSec._id || '');
    const title = String(localSec.sectionTitle || '').trim();
    if (!localRef) continue;
    if (title.toLowerCase() === 'general' && defaultSectionRef) {
      sectionMap.set(localRef, defaultSectionRef);
      continue;
    }
    if (title.toLowerCase() === 'general') {
      sectionMap.set(localRef, defaultSectionRef || localRef);
      continue;
    }
    try {
      const body = {
        sectionTitle: localSec.sectionTitle,
        sectionType: localSec.sectionType || 'standard',
        [includeField]: localSec[includeField] !== false
      };
      if (adapter.kind === 'quote') body.overridePricing = false;
      const res = await apiClient.post(`${apiPath}/${headerId}/sections`, body);
      const created = res?.data?.section;
      const serverRef = created
        ? String(created[adapter.sectionUuidField] || created._id || '')
        : '';
      if (serverRef) sectionMap.set(localRef, serverRef);
      if (Array.isArray(res?.data?.sections)) serverSections = res.data.sections;
      if (localSec.sectionDiscountType && Number(localSec.sectionDiscountValue) > 0 && serverRef) {
        await apiClient.patch(`${apiPath}/${headerId}/sections/${serverRef}/discounts`, {
          sectionDiscountType: localSec.sectionDiscountType,
          sectionDiscountValue: Number(localSec.sectionDiscountValue) || 0,
          overridePricing: false
        });
      }
    } catch (error) {
      drawerWarn('[CreateRecordDrawer] Failed to flush commercial section:', error);
      throw error;
    }
  }
  }

  const mapSection = (localRef) => {
    if (!localRef) return defaultSectionRef;
    return sectionMap.get(String(localRef)) || defaultSectionRef;
  };

  // Product lines (non-bundle)
  for (const line of localLines) {
    const lineType = String(line.lineType || 'product');
    if (lineType !== 'product') continue;
    const variantId = String(line.variantId || '').trim();
    if (!variantId) continue;
    const qty = Number(line.quantity ?? line.quantityOrdered);
    const body = adapter.buildAddLineBody({
      variantId,
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
      sectionRef: isPurchaseOrderFlush ? null : mapSection(line[adapter.sectionIdField]),
      priceBookId: line.priceBookIdSnapshot || null,
      overridePricing: false
    });
    if (isPurchaseOrderFlush && line.unitPrice != null) {
      body.unitPrice = Number(line.unitPrice) || Number(line.unitPriceSnapshot) || 0;
    }
    if (isPurchaseOrderFlush && line.linkToVendorCatalog === true) {
      body.linkToVendorCatalog = true;
    }
    try {
      const res = await apiClient.post(`${apiPath}/${headerId}/lines`, body);
      const createdLine =
        res?.data?.line ||
        (isPurchaseOrderFlush && Array.isArray(res?.data?.lines)
          ? res.data.lines[res.data.lines.length - 1]
          : null);
      const lineServerId = createdLine
        ? String(createdLine[adapter.lineIdField] || createdLine._id || '')
        : '';
      if (!lineServerId) {
        if (isPurchaseOrderFlush && res?.success) continue;
        continue;
      }
      if (isPurchaseOrderFlush) continue;
      const patch = {};
      if (line.discountType && Number(line.discountValue) > 0) {
        Object.assign(
          patch,
          adapter.buildPatchLineBody({
            discountType: line.discountType,
            discountValue: Number(line.discountValue) || 0
          })
        );
      }
      if (Array.isArray(line.taxIds) && line.taxIds.length) {
        Object.assign(patch, adapter.buildPatchLineBody({ taxIds: line.taxIds.map(String) }));
      }
      // Preserve source unit price when duplicating (override catalog resolve on add)
      if (line.unitPrice != null && Number.isFinite(Number(line.unitPrice))) {
        Object.assign(
          patch,
          adapter.buildPatchLineBody({ unitPrice: Number(line.unitPrice) })
        );
      }
      if (Object.keys(patch).length) {
        await apiClient.patch(`${apiPath}/${headerId}/lines/${lineServerId}`, patch);
      }
    } catch (error) {
      drawerWarn('[CreateRecordDrawer] Failed to flush commercial create line:', error);
      throw error;
    }
  }

  // Bundles
  if (!isPurchaseOrderFlush) {
  for (const line of localLines) {
    if (String(line.lineType || '') !== 'bundle_parent') continue;
    const bundleVariantId = String(line._localBundleVariantId || line.variantId || '').trim();
    if (!bundleVariantId) continue;
    const sectionField = adapter.sectionIdField;
    try {
      await apiClient.post(`${apiPath}/${headerId}/bundles`, {
        bundleVariantId,
        priceBookId: line.priceBookIdSnapshot || null,
        quantity: Number(line.quantity) || 1,
        asOfDate: local.quoteDate || local.orderDate || local.invoiceDate || null,
        includedOptionalComponentVariantIds: Array.isArray(line._localIncludedOptionalComponentVariantIds)
          ? line._localIncludedOptionalComponentVariantIds
          : [],
        [sectionField]: mapSection(line[sectionField]),
        overridePricing: false
      });
    } catch (error) {
      drawerWarn('[CreateRecordDrawer] Failed to flush commercial bundle:', error);
      throw error;
    }
  }
  }

  // Global / overall discount
  if (local.globalDiscountType && Number(local.globalDiscountValue) > 0) {
    try {
      await apiClient.patch(`${apiPath}/${headerId}/discounts`, {
        globalDiscountType: local.globalDiscountType,
        globalDiscountValue: Number(local.globalDiscountValue) || 0,
        overridePricing: false
      });
    } catch (error) {
      drawerWarn('[CreateRecordDrawer] Failed to flush commercial global discount:', error);
      throw error;
    }
  }

  // Doc taxes / charges
  const taxIds =
    local._localTransactionTaxIds ||
    (local.transactionTaxSnapshot?.taxes || []).map((x) => x.taxId).filter(Boolean);
  const chargeIds =
    local._localTransactionChargeIds ||
    (local.chargeDocumentSnapshot?.charges || []).map((x) => x.chargeId).filter(Boolean);
  if ((taxIds && taxIds.length) || (chargeIds && chargeIds.length)) {
    try {
      await apiClient.patch(`${apiPath}/${headerId}/taxes-charges`, {
        overridePricing: false,
        transactionTaxIds: taxIds || [],
        transactionChargeIds: chargeIds || []
      });
    } catch (error) {
      drawerWarn('[CreateRecordDrawer] Failed to flush commercial taxes/charges:', error);
      throw error;
    }
  }

  if (!isPurchaseOrderFlush) {
  try {
    await apiClient.post(`${apiPath}/${headerId}/recalculate`, { overridePricing: false });
  } catch (error) {
    drawerWarn('[CreateRecordDrawer] Failed to recalculate after commercial flush:', error);
  }
  }

  if (isPurchaseOrderFlush && Number(local.adjustmentTotal) !== 0) {
    try {
      await apiClient.patch(`${apiPath}/${headerId}/discounts`, {
        adjustmentTotal: Number(local.adjustmentTotal) || 0
      });
    } catch (error) {
      drawerWarn('[CreateRecordDrawer] Failed to flush PO adjustment:', error);
      throw error;
    }
  }

  try {
    const refreshed = await apiClient.get(`${apiPath}/${headerId}`);
    return refreshed?.data || refreshed || serverRecord;
  } catch {
    return serverRecord;
  }
}

function applyOrgCurrencyToCreateForm() {
  if (props.record) return;
  const orgCurrency = resolveOrgCurrencyCode(authStore.organization);
  if (!orgCurrency) return;
  const current = String(formData.value?.currency || '').trim().toUpperCase();
  // Only replace empty or platform schema default — keep explicit user selections
  if (current && current !== 'USD') {
    if (
      commercialFormRecord.value &&
      String(commercialFormRecord.value.currency || '').toUpperCase() !== current
    ) {
      commercialFormRecord.value = { ...commercialFormRecord.value, currency: current };
    }
    return;
  }
  if (current !== orgCurrency) {
    formData.value = { ...formData.value, currency: orgCurrency };
  }
  if (
    commercialFormRecord.value &&
    String(commercialFormRecord.value.currency || '').toUpperCase() !== orgCurrency
  ) {
    commercialFormRecord.value = { ...commercialFormRecord.value, currency: orgCurrency };
  }
}

function mergeCommercialFormRecordIntoFormData(record) {
  if (!record || !moduleDefinition.value?.fields) return;
  const next = { ...formData.value };
  for (const field of moduleDefinition.value.fields) {
    const key = field?.key;
    if (!key || !(key in record)) continue;
    // Create flow: do not let draft/schema USD overwrite the org currency already seeded in the form
    if (
      !props.record &&
      String(key).toLowerCase() === 'currency' &&
      next.currency &&
      String(record[key] || '').toUpperCase() === 'USD' &&
      String(next.currency).toUpperCase() !== 'USD'
    ) {
      continue;
    }
    let value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && value._id) {
      value = value._id;
    }
    if (value !== null && value !== undefined && value !== '') {
      next[key] = value;
    }
  }
  formData.value = next;
  applyOrgCurrencyToCreateForm();
}

function commercialLinesPatchFields() {
  if (isPurchaseOrderModule.value) {
    return { lineIdField: 'purchaseOrderLineId', sectionUuidField: 'purchaseOrderSectionId' };
  }
  if (isSalesOrderModule.value) {
    return { lineIdField: 'salesOrderLineId', sectionUuidField: 'salesOrderSectionId' };
  }
  if (isInvoiceModule.value) {
    return { lineIdField: 'invoiceLineId', sectionUuidField: 'invoiceSectionId' };
  }
  return { lineIdField: 'quoteLineId', sectionUuidField: 'quoteSectionId' };
}

function handleCommercialLinesUpdated(payload) {
  const record = commercialFormRecord.value;
  if (!record) return;
  if (payload?.type && payload.type !== 'soft-refresh') {
    markFormChanged();
  }

  const bumpRecord = () => {
    commercialFormRecord.value = { ...record };
  };
  const patchFields = commercialLinesPatchFields();

  if (payload?.type === 'soft-refresh') {
    void handleCommercialLinesSectionUpdated(payload);
    return;
  }
  if (payload?.type === 'line-deleted') {
    applyQuoteLineDeleteToRecord(record, {
      deletedLine: payload.deletedLine,
      totals: payload.totals,
      sections: payload.sections,
      lineIdField: patchFields.lineIdField
    });
    bumpRecord();
    return;
  }
  if (payload?.type === 'lines-added') {
    applyQuoteLinesAddToRecord(record, {
      lines: payload.lines,
      totals: payload.totals,
      sections: payload.sections,
      lineIdField: patchFields.lineIdField
    });
    bumpRecord();
    return;
  }
  if (payload?.type === 'line-updated') {
    if (Array.isArray(payload.lines)) {
      applyQuoteLinesRecalculateToRecord(record, {
        lines: payload.lines,
        totals: payload.totals,
        sections: payload.sections
      });
    } else {
      applyQuoteLinesMutationToRecord(record, {
        line: payload.line,
        totals: payload.totals,
        sections: payload.sections,
        lineIdField: patchFields.lineIdField,
        sectionUuidField: patchFields.sectionUuidField
      });
    }
    bumpRecord();
    return;
  }
  if (payload?.type === 'lines-recalculated') {
    applyQuoteLinesRecalculateToRecord(record, {
      lines: payload.lines,
      totals: payload.totals,
      sections: payload.sections
    });
    bumpRecord();
    return;
  }
  if (
    (payload?.type === 'quote-discounts-updated' ||
      payload?.type === 'quote-taxes-charges-updated') &&
    applyQuoteDiscountsToRecord(record, {
      quote: payload.quote,
      lines: payload.lines,
      totals: payload.totals,
      sections: payload.sections
    })
  ) {
    bumpRecord();
    return;
  }
  if (
    payload?.type === 'sections-updated' &&
    applyQuoteSectionsToRecord(record, payload.sections)
  ) {
    if (Array.isArray(payload.lines)) {
      record.lines = payload.lines;
    }
    if (payload.totals) {
      applyQuoteLinesRecalculateToRecord(record, {
        lines: payload.lines,
        totals: payload.totals,
        sections: payload.sections
      });
    }
    bumpRecord();
  }
}

async function handleCommercialLinesSectionUpdated(payload) {
  if (!payload) return;
  if (payload.type && payload.type !== 'soft-refresh') {
    markFormChanged();
  }
  if (payload.type === 'soft-refresh' && commercialFormRecord.value?._id) {
    try {
      await loadCommercialFormRecord(commercialFormRecord.value._id);
    } catch (error) {
      drawerWarn('[CreateRecordDrawer] Failed to refresh commercial lines:', error);
    }
  }
}

// Handle dialog close (escape/backdrop/portal interactions).
const handleDialogClose = () => {
  requestClose();
};

const updateFormData = (data) => {
  formData.value = { ...data };
  if (isCommercialLinesCreate.value) {
    syncCommercialCreateHeaderFromForm();
  }
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
      'input, textarea, select, button,[tabindex]:not([tabindex="-1"])'
    );
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus({ preventScroll: true });
    }
    break;
  }
};

function isVisibleFocusTarget(el) {
  if (!el || el.disabled) return false;
  if (el.getAttribute?.('aria-hidden') === 'true') return false;
  if (el.tabIndex < -1) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0;
}

function withSuppressedInteractionMark(fn) {
  suppressInteractionMark = true;
  try {
    fn();
  } finally {
    requestAnimationFrame(() => {
      suppressInteractionMark = false;
    });
  }
}

const focusFirstFormField = async () => {
  if (isEditing.value) return;
  await nextTick();
  // DynamicFormField controls often mount one tick after @ready
  await nextTick();

  const root = formFieldsRootRef.value;
  if (!root || !props.isOpen) return;

  // Prefer first typeable field (Title, Name, …) over combobox/listbox triggers
  const textCandidates = root.querySelectorAll(
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])'
  );
  let target = null;
  for (const el of textCandidates) {
    if (isVisibleFocusTarget(el)) {
      target = el;
      break;
    }
  }
  if (!target) {
    const fallback = root.querySelector(
      'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (isVisibleFocusTarget(fallback)) target = fallback;
  }
  if (!target || typeof target.focus !== 'function') return;

  withSuppressedInteractionMark(() => {
    target.focus({ preventScroll: true });
  });
};

const scheduleInitialFieldFocus = () => {
  if (!pendingInitialFieldFocus || isEditing.value) return;
  pendingInitialFieldFocus = false;
  // Micro-delay so list layout + picklists finish paint after ready
  nextTick(() => {
    requestAnimationFrame(() => {
      void focusFirstFormField();
    });
  });
};

const normalizeKey = (value) => String(value || '').toLowerCase().replace(/[\s_-]/g, '');
const normalizeEventTypeToken = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeEventTypeForSubmission = (rawEventType) => {
  if (!rawEventType) return '';
  const candidate = String(rawEventType).trim();
  if (!candidate) return '';

  // Model enum stores labels ('Meeting'), not keys ('MEETING')
  const byKey = getEventTypeByKey(candidate);
  if (byKey?.label) return byKey.label;

  const byLabel = getEventTypeByLabel(candidate);
  if (byLabel?.label) return byLabel.label;

  const normalizedCandidate = normalizeEventTypeToken(candidate);
  const fallbackMatch = EVENT_TYPE_DEFINITIONS.find((definition) => {
    return (
      normalizeEventTypeToken(definition.key) === normalizedCandidate ||
      normalizeEventTypeToken(definition.label) === normalizedCandidate
    );
  });

  return fallbackMatch?.label || candidate;
};

const getPreferredPrefillField = (module) => {
  const fields = Array.isArray(module?.fields) ? module.fields : [];
  if (!fields.length) return null;

  const preferred = normalizeKey(props.prefillFieldKey);
  if (preferred) {
    const match = fields.find((f) => normalizeKey(f?.key) === preferred);
    if (match) return match;
  }

  const quickCreateKeys =
    strictQuickCreateForForm.value && Array.isArray(module?.quickCreate)
      ? new Set(module.quickCreate.map((k) => normalizeKey(k)).filter(Boolean))
      : null;

  const candidates = fields.filter((f) => {
    if (!f?.key) return false;
    const dataType = String(f.dataType || '').trim();
    if (!['Text', 'Text-Area', 'Email', 'Phone', 'URL'].includes(dataType)) return false;
    if (quickCreateKeys && !quickCreateKeys.has(normalizeKey(f.key))) return false;
    return true;
  });

  if (!candidates.length) return null;
  return candidates[0];
};

const applySearchPrefill = (module) => {
  const seed = String(props.prefillText || '').trim();
  if (!seed || isEditing.value) return;
  const targetField = getPreferredPrefillField(module);
  if (!targetField?.key) return;
  const currentValue = formData.value?.[targetField.key];
  if (currentValue !== null && currentValue !== undefined && String(currentValue).trim() !== '') return;
  formData.value = { ...formData.value, [targetField.key]: seed };
};

function normalizedTaskRelatedTo(val) {
  if (!val || typeof val !== 'object') return { type: 'none', id: null };
  const id = val.id != null && typeof val.id === 'object' && val.id._id != null ? val.id._id : (val.id ?? null);
  return { type: val.type || 'none', id };
}

const initializeForm = (module) => {
  if (!module) return;
  
  const initialForm = {};
  const fields = module.fields || [];
  
  // Set defaults from field definitions
  for (const field of fields) {
    const isNumericType = ['Currency', 'Integer', 'Decimal'].includes(field.dataType);
    // Schema defaults of 0 should not prefill create forms — show placeholder instead
    const skipZeroNumericDefault =
      isNumericType && (field.defaultValue === 0 || field.defaultValue === '0');
    if (
      field.defaultValue !== null &&
      field.defaultValue !== undefined &&
      !skipZeroNumericDefault
    ) {
      initialForm[field.key] = field.defaultValue;
    } else {
      // Set empty defaults based on type
      if (field.dataType === 'Multi-Picklist' || field.key === 'tags') {
        initialForm[field.key] = [];
      } else if (field.dataType === 'Checkbox') {
        initialForm[field.key] = false;
      } else {
        initialForm[field.key] = '';
      }
    }
  }

  // Prefer tenant org currency over schema defaults (e.g. mongoose `default: 'USD'`)
  const hasCurrencyField = fields.some((f) => String(f?.key || '').toLowerCase() === 'currency');
  const hasPaymentCurrencyField = fields.some((f) => String(f?.key || '').toLowerCase() === 'paymentcurrency');
  const orgCurrency = resolveOrgCurrencyCode(authStore.organization);
  if (hasCurrencyField) {
    initialForm.currency = orgCurrency;
  }
  if (hasPaymentCurrencyField) {
    initialForm.paymentCurrency = orgCurrency;
  }

  // Quotes create: default Quote Date to today (editable). Local YMD avoids UTC off-by-one.
  if (moduleKeyLower.value === 'quotes' && !props.record) {
    const empty =
      initialForm.quoteDate == null || String(initialForm.quoteDate).trim() === '';
    if (empty) {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      initialForm.quoteDate = `${y}-${m}-${day}`;
    }
  }
  
    // If editing, merge with existing record data
  if (props.record) {
    const recordData =
      props.moduleKey === 'cases'
        ? stripCaseRecordForEditForm(props.record)
        : props.moduleKey === 'organizations'
          ? stripOrganizationRecordForEditForm(props.record)
          : { ...props.record };
    
    // Handle populated relationships - convert objects to IDs
    Object.keys(recordData).forEach(key => {
      const value = recordData[key];
      if (value && typeof value === 'object' && !Array.isArray(value) && value._id) {
        recordData[key] = value._id;
      }
    });
    
    // Ensure Multi-Picklist fields are arrays (and collapse populated user/entity rows to ids)
    for (const field of fields) {
      if (field.dataType === 'Multi-Picklist' || String(field.key || '').toLowerCase() === 'attendees') {
        const value = recordData[field.key];
        if (value !== null && value !== undefined && !Array.isArray(value)) {
          recordData[field.key] = [value].filter(Boolean);
        } else if (!value) {
          recordData[field.key] = [];
        }
        if (Array.isArray(recordData[field.key])) {
          recordData[field.key] = recordData[field.key]
            .map((item) => {
              if (item == null || item === '') return null;
              if (typeof item === 'object') {
                return item._id || item.id || item.userId || item.value || null;
              }
              return item;
            })
            .filter(Boolean)
            .map((id) => String(id));
        }
      }
    }
    
    // Merge record data with form defaults
    formData.value = { ...initialForm, ...recordData };
  } else {
    // For new records, merge with initialData if provided
    if (Object.keys(props.initialData).length > 0) {
      formData.value = { ...initialForm, ...props.initialData };
    } else {
      formData.value = initialForm;
    }
  }
  if (props.moduleKey === 'people') {
    const fd = { ...formData.value };
    syncPeopleVirtualFieldKeys(fd);
    for (const field of fields) {
      if (field.isVirtual && field.defaultValue !== null && field.defaultValue !== undefined && field.defaultValue !== '') {
        applyVirtualFieldDefault(fd, field, field.defaultValue, { moduleKey: props.moduleKey });
      }
    }
    formData.value = fd;
  }
  if (props.moduleKey === 'tasks') {
    formData.value.relatedTo = normalizedTaskRelatedTo(formData.value?.relatedTo);
    if (!Array.isArray(formData.value.subtasks)) {
      formData.value.subtasks = [];
    }
  }

  // Events create: always seed mandatory type + meeting defaults so dependency-gated
  // Meeting fields (mode, conference, join link, agenda) are visible immediately.
  if (props.moduleKey === 'events' && !props.record) {
    const fd = { ...formData.value };
    const typeEmpty = fd.eventType == null || String(fd.eventType).trim() === '';
    if (typeEmpty) {
      fd.eventType = 'Meeting';
    }
    const typeLabel = String(fd.eventType || '').trim();
    const isMeeting =
      typeLabel === 'Meeting' ||
      typeLabel === 'MEETING' ||
      typeLabel.toLowerCase() === 'meeting';
    if (isMeeting) {
      fd.eventType = 'Meeting';
      if (fd.meetingMode == null || String(fd.meetingMode).trim() === '') {
        fd.meetingMode = 'Virtual';
      }
      const mode = String(fd.meetingMode || '');
      if (
        (mode === 'Virtual' || mode === 'Hybrid') &&
        (fd.conferenceProvider == null || String(fd.conferenceProvider).trim() === '')
      ) {
        fd.conferenceProvider = 'google_meet';
      }
    }
    if (!Array.isArray(fd.attendees)) {
      fd.attendees = [];
    }
    // Seed status from event-type lifecycle defaults (Meeting → Scheduled)
    if (fd.status == null || String(fd.status).trim() === '') {
      const def =
        getEventTypeDefinitionByKey(String(fd.eventType || 'MEETING')) ||
        EVENT_TYPE_DEFINITIONS.find(
          (d) => d.label.toLowerCase() === String(fd.eventType || '').toLowerCase()
        );
      fd.status = def?.statusConfig?.defaultStatus || (isMeeting ? 'Scheduled' : 'Planned');
    }
    formData.value = fd;
  }

  if (!props.record) {
    formData.value = applyCreateOwnerDefaultsToForm(
      formData.value,
      props.moduleKey,
      resolveCurrentUserId(authStore.user)
    );
    applyOrgCurrencyToCreateForm();
  }
};

const onFormReady = (module) => {
  if (!module) return;
  // Only initialize form on first load (when we don't have a module yet). For deals, the override
  // is updated when pipeline changes (to show the right stage options); re-initializing would reset
  // the user's pipeline selection.
  const isFirstLoad = !moduleDefinition.value;
  moduleDefinition.value = module;
  if (pendingDraftRestore.value) {
    pendingDraftRestore.value = false;
    // Calendar / context seeds must win over parked draft for provided keys
    if (!isEditing.value) {
      applyInitialDataOverlay();
      nextTick(() => applyOrgCurrencyToCreateForm());
    }
    scheduleInitialFieldFocus();
    return;
  }
  if (isFirstLoad || isEditing.value) {
    initializeForm(module);
    if (!isEditing.value) applySearchPrefill(module);
    if (isCommercialLinesCreate.value && commercialFormRecord.value) {
      mergeCommercialFormRecordIntoFormData(commercialFormRecord.value);
    }
    // Defeat late DynamicFormField mounts that re-emit schema defaultValue 'USD'
    if (!isEditing.value) {
      nextTick(() => applyOrgCurrencyToCreateForm());
    }
  } else if (!isEditing.value) {
    // Module already loaded from a prior open — still apply fresh calendar seed
    applyInitialDataOverlay();
  }
  scheduleInitialFieldFocus();
};

function applyInitialDataOverlay() {
  if (props.record) return;
  const seed = props.initialData;
  if (!seed || typeof seed !== 'object') return;
  const entries = Object.entries(seed).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return;
  formData.value = { ...formData.value, ...Object.fromEntries(entries) };

  // Re-apply Meeting defaults after calendar/context seed if type still empty or Meeting
  if (props.moduleKey === 'events') {
    const fd = { ...formData.value };
    if (fd.eventType == null || String(fd.eventType).trim() === '') {
      fd.eventType = 'Meeting';
    }
    if (String(fd.eventType) === 'Meeting' || String(fd.eventType).toUpperCase() === 'MEETING') {
      fd.eventType = 'Meeting';
      if (!fd.meetingMode) fd.meetingMode = 'Virtual';
      if (
        (fd.meetingMode === 'Virtual' || fd.meetingMode === 'Hybrid') &&
        !fd.conferenceProvider
      ) {
        fd.conferenceProvider = 'google_meet';
      }
    }
    formData.value = fd;
  }
}

watch(moduleOverrideFromSettings, (mod) => {
  if (!mod || !props.isOpen) return;
  if (isEditing.value) {
    initializeForm(mod);
    return;
  }
  // Create: DynamicForm used to skip @ready when mounted with moduleOverride, leaving
  // calendar/context initialData unapplied. Seed here as a belt-and-suspenders path.
  if (pendingDraftRestore.value) {
    applyInitialDataOverlay();
    return;
  }
  if (!moduleDefinition.value) {
    moduleDefinition.value = mod;
    initializeForm(mod);
    if (!isEditing.value) applySearchPrefill(mod);
  } else {
    applyInitialDataOverlay();
  }
});

// Watch for record changes to re-initialize form when editing
watch(() => props.record, () => {
  if (moduleDefinition.value && props.record) {
    initializeForm(moduleDefinition.value);
  }
  if (props.moduleKey === 'deals' && props.record) {
    const r = props.record;
    dealRelationships.value = normalizeDealRelationships({
      dealPeople: Array.isArray(r.dealPeople) ? r.dealPeople.map((p) => ({ ...p })) : [],
      dealOrganizations: Array.isArray(r.dealOrganizations) ? r.dealOrganizations.map((o) => ({ ...o })) : []
    }, {
      preferredPersonId: normalizeRelationshipId(r.contactId),
      preferredOrganizationId: normalizeRelationshipId(r.accountId)
    });
  }
}, { deep: true });

// When drawer opens: fetch module so Quick Create fields come from Settings
watch(() => [props.isOpen, props.moduleKey], ([open, key]) => {
  if (open && key) {
    fetchModuleForDrawer();
    if (isCommercialLinesForm.value) {
      ensureCommercialFormRecord();
    }
  } else {
    moduleOverrideFromSettings.value = null;
    commercialFormRecord.value = null;
    commercialFormLoading.value = false;
    commercialFormEnsurePromise.value = null;
    dealOverrideCache.mod = null;
    dealOverrideCache.pipelineKey = undefined;
    dealOverrideCache.quickMode = undefined;
    dealOverrideCache.result = null;
  }
}, { immediate: true });

// Fetch people and organizations when opening deal form
watch(() => [props.isOpen, props.moduleKey], async ([open, key]) => {
  if (!open || key !== 'deals') return;
  const restoring = pendingDraftRestore.value;
  if (!restoring) {
    dealRelationships.value = { dealPeople: [], dealOrganizations: [] };
    if (props.record) {
      const r = props.record;
      dealRelationships.value = normalizeDealRelationships({
        dealPeople: Array.isArray(r.dealPeople) ? r.dealPeople.map((p) => ({ ...p })) : [],
        dealOrganizations: Array.isArray(r.dealOrganizations) ? r.dealOrganizations.map((o) => ({ ...o })) : []
      }, {
        preferredPersonId: normalizeRelationshipId(r.contactId),
        preferredOrganizationId: normalizeRelationshipId(r.accountId)
      });
    }
  }
  try {
    const [peopleRes, orgRes] = await Promise.all([
      fetchPeopleListCached(DEAL_RELATIONSHIP_PEOPLE_PARAMS),
      fetchOrganizationsListCached(DEAL_RELATIONSHIP_ORG_PARAMS),
    ]);
    const normalizeList = (response) => {
      if (Array.isArray(response)) return response;
      const candidates = [
        response?.data,
        response?.data?.data,
        response?.data?.items,
        response?.data?.rows
      ];
      for (const c of candidates) {
        if (Array.isArray(c)) return c;
      }
      return [];
    };
    dealPeopleList.value = normalizeList(peopleRes);
    dealOrgList.value = normalizeList(orgRes);
  } catch (e) {
    drawerWarn('[CreateRecordDrawer] Failed to fetch people/organizations for deal relationships:', e);
    dealPeopleList.value = [];
    dealOrgList.value = [];
  }
}, { immediate: true });

// Deals: when a pipeline is selected, auto-select the first stage in that pipeline
watch(() => formData.value?.pipeline, (newPipelineKey) => {
  if (props.moduleKey?.toLowerCase() !== 'deals' || !newPipelineKey) return;
  const mod = moduleOverrideFromSettings.value;
  if (!mod?.pipelineSettings?.length) return;
  const pipeline = mod.pipelineSettings.find(
    (p) => String(p?.key ?? '').trim() === String(newPipelineKey).trim()
  );
  if (!pipeline?.stages?.length) return;
  const first = pipeline.stages[0];
  const firstStageName = (first?.name ?? '').trim() || 'New';
  const prob = first?.probability ?? 0;
  if (formData.value?.stage !== firstStageName || formData.value?.probability !== prob) {
    formData.value = { ...formData.value, stage: firstStageName, probability: prob };
  }
});

// Deals: when the stage is selected, set probability from the pipeline's stage config
watch(() => formData.value?.stage, (newStage) => {
  if (props.moduleKey?.toLowerCase() !== 'deals' || !newStage || !formData.value?.pipeline) return;
  const mod = moduleOverrideFromSettings.value;
  if (!mod?.pipelineSettings?.length) return;
  const pipeline = mod.pipelineSettings.find(
    (p) => String(p?.key ?? '').trim() === String(formData.value.pipeline).trim()
  );
  if (!pipeline?.stages?.length) return;
  const stageName = String(newStage).trim();
  const stageConfig = pipeline.stages.find((s) => (s?.name ?? '').trim() === stageName);
  if (stageConfig == null) return;
  const prob = typeof stageConfig.probability === 'number' ? stageConfig.probability : (stageConfig.probability ?? 0);
  if (formData.value?.probability !== prob) {
    formData.value = { ...formData.value, probability: prob };
  }
});

// Watch for form data changes and clear errors for fields that are now valid
watch(() => formData.value, (newFormData, oldFormData) => {
  if (!moduleDefinition.value || !oldFormData) return;

  // PO (and other commercial create): keep lines workspace header in sync with QC fields
  if (isCommercialLinesCreate.value) {
    syncCommercialCreateHeaderFromForm();
  }
  
  // Check which fields have changed
  const changedFields = new Set();
  for (const key in newFormData) {
    if (newFormData[key] !== oldFormData[key]) {
      changedFields.add(key);
    }
  }

  // Events create: when event type changes, apply that type's default status
  if (
    props.moduleKey === 'events' &&
    !props.record &&
    changedFields.has('eventType') &&
    newFormData?.eventType !== oldFormData?.eventType
  ) {
    const def =
      getEventTypeDefinitionByKey(String(newFormData.eventType || '')) ||
      EVENT_TYPE_DEFINITIONS.find(
        (d) => d.label.toLowerCase() === String(newFormData.eventType || '').toLowerCase()
      );
    const nextDefault = def?.statusConfig?.defaultStatus;
    if (nextDefault && formData.value.status !== nextDefault) {
      formData.value = { ...formData.value, status: nextDefault };
    }
  }
  
  // For each changed field that has an error, check if it's now valid
  for (const fieldKey of changedFields) {
    if (errors.value[fieldKey]) {
      const value = newFormData[fieldKey];
      const isEmpty = value === null || 
                     value === undefined || 
                     value === '' || 
                     (Array.isArray(value) && value.length === 0);
      
      // If field is no longer empty and has an error, clear it
      // This handles both client-side validation errors and backend validation errors
      if (!isEmpty) {
        delete errors.value[fieldKey];
      }
    }
  }
}, { deep: true });

const handleSubmit = async () => {
  drawerDbg('[CreateRecordDrawer] 🚀 handleSubmit called', {
    moduleKey: props.moduleKey,
    isEditing: isEditing.value,
    formDataKeys: Object.keys(formData.value)
  });
  
  errors.value = {};
  saving.value = true;

  try {
    // Client-side validation (like ContactFormModal)
    if (moduleDefinition.value?.fields) {
      // System fields that are auto-set by backend (status only for Events; Tasks status can be required)
      // RULE: Global system fields (trash: deletedAt, deletedBy, deletionReason) never show in create/edit
      const systemFieldKeys = [
        'organizationid',
        'createdby',
        'createdat',
        'updatedat',
        '_id',
        '__v',
        'activitylogs',
        ...getGlobalSystemFieldKeys(),
        // Events status is editable for non-audit types (lifecycle vocabulary)
      ];
      // Helpdesk Case: module schema may mark server-managed keys as required; never validate on create.
      if (props.moduleKey === 'cases' && !isEditing.value) {
        for (const k of getCaseSystemFields()) {
          const n = normalizeFieldKeyForSystemMatch(k);
          if (n && !systemFieldKeys.includes(n)) systemFieldKeys.push(n);
        }
      }

      const allFields = moduleDefinition.value.fields || [];
      const excludedKeyNorms = new Set(
        (effectiveExcludeFields.value || []).map((k) => normalizeFieldKeyForSystemMatch(k)).filter(Boolean)
      );

      // Strict quick-create only renders QC keys — do not validate hidden required fields (silent Save).
      const qcList =
        effectiveModuleOverrideForDrawer.value?.quickCreate ??
        moduleDefinition.value?.quickCreate;
      const restrictToQuickCreate =
        strictQuickCreateForForm.value &&
        !fullMode.value &&
        Array.isArray(qcList) &&
        qcList.length > 0;
      const quickCreateKeyNorms = restrictToQuickCreate
        ? new Set(
            qcList
              .map((entry) =>
                normalizeFieldKeyForSystemMatch(
                  typeof entry === 'string' ? entry : entry?.key ?? entry
                )
              )
              .filter(Boolean)
          )
        : null;

      // Get effective required fields (dependency-driven), excluding system + hidden fields
      const requiredFields = allFields.filter(f => {
        const keyNorm = normalizeFieldKeyForSystemMatch(f.key);
        if (!f.key || systemFieldKeys.includes(keyNorm) || excludedKeyNorms.has(keyNorm)) return false;
        // Match DynamicForm: never validate platform-owned / non-editable fields (e.g. deals.status)
        if (isSystemField(props.moduleKey, f) || !canEditField(props.moduleKey, f)) return false;
        if (quickCreateKeyNorms && !quickCreateKeyNorms.has(keyNorm)) return false;
        const depState = getFieldDependencyState(f, formData.value, allFields, {
          moduleKey: props.moduleKey,
        });
        // Only validate when visible and required
        return depState.required === true && depState.visible !== false;
      });
      
      // Validate each required field
      for (const field of requiredFields) {
        const value =
          props.moduleKey === 'people'
            ? getFormFieldValue(formData.value, field.key, field, { moduleKey: props.moduleKey })
            : formData.value[field.key];
        const isEmpty = value === null || 
                       value === undefined || 
                       value === '' || 
                       (Array.isArray(value) && value.length === 0);
        
        if (isEmpty) {
          errors.value[field.key] = `${getFieldDisplayLabel(field) || field.key} is required`;
        }
      }
      
      // If validation fails, stop here
      if (Object.keys(errors.value).length > 0) {
        drawerDbg('[CreateRecordDrawer] ❌ Validation failed:', errors.value);
        const fieldMessages = Object.entries(errors.value)
          .filter(([k, v]) => k !== '_general' && v)
          .map(([, v]) => v);
        if (!errors.value._general && fieldMessages.length > 0) {
          errors.value._general = fieldMessages[0];
        }
        scrollToFirstErrorField();
        saving.value = false;
        return;
      }
    }

    // Deal relationship validation (one primary contact, one active customer org)
    if (props.moduleKey === 'deals' && props.useDealRelationshipEditor && relationshipEditorRef.value) {
      const relValid = relationshipEditorRef.value.validate();
      if (!relValid) {
        errors.value._general =
          errors.value._general || t('deals.dealRelationshipEditorPrimaryCustomerRequired');
        saving.value = false;
        return;
      }
    }

    if (props.moduleKey === 'events') {
      const geoRequired = resolveEventGeoRequired(
        formData.value?.eventType,
        formData.value?.geoRequired
      );
      if (!isEventLocationGeoValid(formData.value?.location, formData.value?.geoLocation, geoRequired)) {
        errors.value.location = t('events.eventLocationGeoRequiredHint');
        scrollToFirstErrorField();
        saving.value = false;
        return;
      }

      // Conference readiness: alert before save when Meet/Teams/Zoom needs calendar connect or paste
      const confProvider = String(formData.value?.conferenceProvider || '').trim();
      const meetingMode = String(formData.value?.meetingMode || '').trim();
      const needsConferenceCheck =
        (meetingMode === 'Virtual' || meetingMode === 'Hybrid') &&
        !!confProvider &&
        !String(formData.value?.meetingLink || '').trim();

      if (needsConferenceCheck) {
        let connectors = [];
        try {
          const connRes = await apiClient.get('/user/calendar-connections');
          connectors = connRes?.data?.connectors || [];
        } catch {
          connectors = [];
        }

        const gate = evaluateMeetingConferenceSaveGate({
          eventType: formData.value?.eventType,
          meetingMode: formData.value?.meetingMode,
          conferenceProvider: formData.value?.conferenceProvider,
          meetingLink: formData.value?.meetingLink,
          assignedTo: formData.value?.assignedTo,
          currentUserId: authStore.user?._id || authStore.user?.id || null,
          connectors
        });

        if (gate.status === 'confirm') {
          const msgKey =
            gate.reason === 'zoom_paste'
              ? 'events.meetingConferenceGateZoomPaste'
              : gate.reason === 'not_configured'
                ? gate.calendarProvider === 'microsoft'
                  ? 'events.meetingConferenceGateNotConfiguredMsTeams'
                  : 'events.meetingConferenceGateNotConfiguredGoogle'
                : gate.reason === 'host_other'
                  ? gate.calendarProvider === 'microsoft'
                    ? 'events.meetingConferenceGateHostOtherMsTeams'
                    : 'events.meetingConferenceGateHostOtherGoogle'
                  : gate.calendarProvider === 'microsoft'
                    ? 'events.meetingConferenceGateNotConnectedMsTeams'
                    : 'events.meetingConferenceGateNotConnectedGoogle';

          const confirmed = await confirmAction({
            title: t('events.meetingConferenceGateTitle'),
            message: t(msgKey),
            confirmLabel: t('events.meetingConferenceGateSaveAnyway'),
            tone: 'warning'
          });
          if (!confirmed) {
            errors.value.meetingLink = t('events.meetingConferenceGateJoinLinkHint');
            scrollToFirstErrorField();
            saving.value = false;
            return;
          }
        }
      }
    }

    // Meeting invites: ask send vs silent save when participants are in play
    let eventSendInvites = undefined;
    if (props.moduleKey === 'events') {
      const inviteDecision = resolveMeetingInvitePrompt({
        isEditing: isEditing.value,
        eventType: formData.value?.eventType,
        form: formData.value,
        record: props.record
      });
      if (inviteDecision.prompt) {
        const choice = await confirmActionChoice({
          title: t('events.meetingInvitePromptTitle'),
          message: t(
            isEditing.value
              ? 'events.meetingInvitePromptMessageEdit'
              : 'events.meetingInvitePromptMessageCreate',
            { count: inviteDecision.participantCount }
          ),
          confirmLabel: t('events.meetingInvitePromptSend'),
          secondaryLabel: t('events.meetingInvitePromptSilent'),
          cancelLabel: t('actions.cancel'),
          tone: 'success'
        });
        if (choice === 'cancel') {
          saving.value = false;
          return;
        }
        eventSendInvites = choice === 'confirm';
      } else {
        eventSendInvites = inviteDecision.sendInvites;
      }
    }
    
    drawerDbg('[CreateRecordDrawer] ✅ Validation passed, proceeding with submission...');
    
    // ARCHITECTURE NOTE: In Quick Create mode, only send fields that are in quickCreate configuration
    let submitData = { ...formData.value };
    
    const qcList = moduleDefinition.value?.quickCreate;
    if (shouldFilterPayloadByQuickCreate(effectiveQuickCreateMode.value, fullMode.value, qcList)) {
      const allowedFieldKeys = augmentPeopleQuickCreateAllowedFieldKeys(
        props.moduleKey,
        getQuickCreateAllowedFieldKeys(
          qcList,
          moduleDefinition.value?.fields
        )
      );

      // Fields that are always required by the API (even if not in quickCreate)
      // These are API-level requirements, not user-facing fields
      const apiRequiredFields = new Set([
        'type',           // Required by Scheduling API (task/event)
        'entitytype',     // Required by Scheduling API
        'entityid',       // Required by Scheduling API
        'ownerpersonid',  // May be set from assignedTo mapping
        'assignedto'      // Required by Task API - auto-assigned to current user
      ]);

      // Filter submitData to quickCreate + module-required + API-required fields
      const filteredData = {};
      for (const [key, value] of Object.entries(submitData)) {
        const keyLower = key.toLowerCase();
        if (allowedFieldKeys.has(keyLower) || apiRequiredFields.has(keyLower)) {
          filteredData[key] = value;
        }
      }

      drawerDbg('[CreateRecordDrawer] 🔍 Quick Create mode - filtering fields:', {
        before: Object.keys(submitData),
        after: Object.keys(filteredData),
        allowedFieldKeys: Array.from(allowedFieldKeys),
        apiRequiredFields: Array.from(apiRequiredFields),
        filteredOut: Object.keys(submitData).filter(k => {
          const keyLower = k.toLowerCase();
          return !allowedFieldKeys.has(keyLower) && !apiRequiredFields.has(keyLower);
        })
      });
      
      submitData = filteredData;
    }

    if (props.moduleKey === 'events' && formData.value?.geoLocation) {
      submitData.geoLocation = formData.value.geoLocation;
    }
    
    // Debug: Log formData for events before cleaning
    if (props.moduleKey === 'events') {
      drawerDbg('[CreateRecordDrawer] formData.value before cleaning:', {
        linkedFormId: formData.value.linkedFormId,
        relatedToId: formData.value.relatedToId,
        eventType: formData.value.eventType,
        allKeys: Object.keys(formData.value)
      });
    }
    
    // Convert kebab-case field keys to camelCase for events module
    // Backend expects camelCase (linkedFormId, relatedToId) but form might use kebab-case (linked-form-id, related-to-id)
    if (props.moduleKey === 'events') {
      // Map of kebab-case to camelCase for event fields
      const keyMappings = {
        'linked-form-id': 'linkedFormId',
        'related-to-id': 'relatedToId',
        'event-owner-id': 'assignedTo',
        'auditor-id': 'auditorId',
        'reviewer-id': 'reviewerId',
        'corrective-owner-id': 'correctiveOwnerId',
        'allow-self-review': 'allowSelfReview',
        'start-date-time': 'startDateTime',
        'end-date-time': 'endDateTime',
        'meeting-mode': 'meetingMode',
        'meeting-link': 'meetingLink',
        'conference-provider': 'conferenceProvider',
        'agenda-notes': 'agendaNotes'
      };

      // Also normalize lowercased keys that can come from saved module definitions (defensive)
      const lowercaseMappings = {
        assignedto: 'assignedTo',
        auditorid: 'auditorId',
        reviewerid: 'reviewerId',
        correctiveownerid: 'correctiveOwnerId',
        allowselfreview: 'allowSelfReview',
        linkedformid: 'linkedFormId',
        relatedtoid: 'relatedToId',
        startdatetime: 'startDateTime',
        enddatetime: 'endDateTime',
        meetingmode: 'meetingMode',
        meetinglink: 'meetingLink',
        conferenceprovider: 'conferenceProvider',
        agendanotes: 'agendaNotes',
        attendees: 'attendees'
      };
      
      // Convert kebab-case keys to camelCase
      for (const [kebabKey, camelKey] of Object.entries(keyMappings)) {
        if (submitData[kebabKey] !== undefined) {
          // If camelCase version doesn't exist or is empty, use kebab-case value
          if (!submitData[camelKey] || submitData[camelKey] === '') {
            submitData[camelKey] = submitData[kebabKey];
          }
          // Remove kebab-case version
          delete submitData[kebabKey];
        }
      }

      // Convert lowercase keys to camelCase equivalents
      for (const [lowerKey, camelKey] of Object.entries(lowercaseMappings)) {
        if (submitData[lowerKey] !== undefined) {
          if (submitData[camelKey] === undefined || submitData[camelKey] === '') {
            submitData[camelKey] = submitData[lowerKey];
          }
          delete submitData[lowerKey];
        }
      }
      
      // Normalize eventType to model enum labels (Meeting), never keys (MEETING)
      const normalizedEventType = normalizeEventTypeForSubmission(
        submitData.eventType ?? formData.value?.eventType
      );
      if (normalizedEventType) {
        submitData.eventType = normalizedEventType;
      }

      // Participants: always id strings (edit seed may leave populated user objects)
      const rawAttendees = submitData.attendees ?? formData.value?.attendees;
      if (rawAttendees !== undefined) {
        const list = Array.isArray(rawAttendees) ? rawAttendees : rawAttendees ? [rawAttendees] : [];
        submitData.attendees = list
          .map((a) => {
            if (a == null || a === '') return null;
            if (typeof a === 'object') return a._id || a.userId || a.id || a.value || null;
            return a;
          })
          .filter(Boolean)
          .map((id) => String(id));
      }

      if (typeof eventSendInvites === 'boolean') {
        submitData.sendInvites = eventSendInvites;
      }

    }
    
    // Strip system-controlled fields
    delete submitData.createdBy;
    delete submitData.organizationId;
    delete submitData.organizationid;
    delete submitData.createdAt;
    delete submitData.updatedAt;
    delete submitData.createdTime;
    delete submitData.modifiedTime;
    delete submitData.modifiedBy;
    delete submitData._id;
    delete submitData.__v;
    
    // Events: strip platform system fields (full form seeds every module key as '' → null)
    if (props.moduleKey === 'events') {
      const eventSystemKeys = new Set(
        [
          ...(getEventSystemFields() || []),
          ...EVENT_FORM_EXCLUDED_KEYS,
          ...EVENT_DRAWER_EXCLUDED_PARTICIPATION_KEYS,
          'createdTime',
          'modifiedTime',
          'modifiedBy',
          'createdBy',
          'organizationId',
        ].map((k) => String(k).toLowerCase())
      );
      Object.keys(submitData).forEach((key) => {
        if (eventSystemKeys.has(key.toLowerCase())) delete submitData[key];
      });
      // Keep status for non-audit; backend validates type vocabulary + OPEN default.
      // (Old strip forced model default Planned — broke Meeting → Scheduled.)
    }

    // Helpdesk cases: status transitions must use PATCH /:id/status, not PUT
    let caseEditNextStatus = undefined;
    if (props.moduleKey === 'cases' && isEditing.value) {
      if (Object.prototype.hasOwnProperty.call(submitData, 'status')) {
        caseEditNextStatus = submitData.status;
        delete submitData.status;
      }
    }

    // Helpdesk cases: the form is seeded with the full record; updateCase() only accepts
    // mutable fields + ad-hoc custom keys. Read-only schema keys (caseId, activities, …)
    // in the body cause 400 "Unsupported or system-managed fields" and block every save.
    if (props.moduleKey === 'cases') {
      const caseReadOnlyTopLevel = new Set([
        'caseId',
        'currentSlaCycle',
        'slaCycles',
        'activities',
        'assignmentControl',
        'source',
        'customFields',
        'createdBy',
        'updatedBy',
        'organizationId',
        'deletedAt',
        'deletedBy',
        'deletionReason',
        '_id',
        '__v'
      ]);
      if (isEditing.value) {
        caseReadOnlyTopLevel.add('status');
      }
      // Flattened nested paths (e.g. from record seeding) must not be sent — server rejects them.
      const caseDottedReadOnlyPrefixes = [
        'assignmentControl.',
        'currentSlaCycle.',
        'slaCycles.',
        'activities.'
      ];
      const pruned = {};
      for (const [key, value] of Object.entries(submitData)) {
        if (caseReadOnlyTopLevel.has(key)) continue;
        if (caseDottedReadOnlyPrefixes.some((p) => key.startsWith(p))) continue;
        pruned[key] = value;
      }
      submitData = pruned;
      if (isEditing.value) {
        submitData = buildCaseEditSubmitPayload(formData.value, props.record);
      }
    }
    
    // Handle nested object conflicts (e.g., 'settings' and 'settings.primaryColor')
    // Remove parent keys if nested dot-notation keys exist to avoid Mongoose conflicts
    const keysToRemove = [];
    const nestedKeys = Object.keys(submitData).filter(key => key.includes('.'));
    
    // For each nested key (e.g., 'settings.primaryColor'), check if parent exists
    for (const nestedKey of nestedKeys) {
      const parentKey = nestedKey.split('.')[0];
      if (submitData[parentKey] && typeof submitData[parentKey] === 'object') {
        // Parent object exists and we have nested keys - remove parent to avoid conflict
        if (!keysToRemove.includes(parentKey)) {
          keysToRemove.push(parentKey);
        }
      }
    }
    
    // Remove conflicting parent keys
    for (const key of keysToRemove) {
      delete submitData[key];
    }
    
    // Handle organization field - ensure it's an ObjectId string, not an object
    if (submitData.organization && typeof submitData.organization === 'object') {
      submitData.organization = submitData.organization._id || submitData.organization;
    }
    
    // Convert empty strings to null for optional fields
    // Preserve organization, linkedFormId, and relatedToId if they're explicitly set (even if empty string)
    // These fields should be sent as null rather than being deleted
    const preservedFields = ['organization', 'linkedFormId', 'relatedToId'];
    for (const key in submitData) {
      if (submitData[key] === '' && !preservedFields.includes(key)) {
        submitData[key] = null;
      }
    }
    
    // For preserved fields, convert empty strings to null but keep them in the payload
    for (const field of preservedFields) {
      if (submitData[field] === '') {
        submitData[field] = null;
      }
    }
    
    // Log the submit data for events to debug linkedFormId/relatedToId
    if (props.moduleKey === 'events') {
      drawerDbg('[CreateRecordDrawer] Submitting event data:', {
        linkedFormId: submitData.linkedFormId,
        relatedToId: submitData.relatedToId,
        eventType: submitData.eventType,
        allKeys: Object.keys(submitData)
      });
    }
    
    // CRM organizations: strip tenant/system fields and normalize lookup refs
    if (props.moduleKey === 'organizations') {
      submitData = buildOrganizationSubmitPayload(
        submitData,
        organizationTypeDefs.value,
        isEditing.value ? 'edit' : 'create',
        moduleDefinition.value?.fields
      );
    }

    // Deal role-based relationships: use dealPeople/dealOrganizations, remove legacy contactId/accountId
    if (props.moduleKey === 'deals' && props.useDealRelationshipEditor) {
      // Quick create may only have accountId/contactId — fold into relationship arrays before save
      syncLegacyLookupsIntoDealRelationships();
      delete submitData.contactId;
      delete submitData.accountId;
      const norm = (id) => (id && typeof id === 'object' && id._id) ? id._id : id;
      const normalizedRelationships = normalizeDealRelationships(dealRelationships.value || {}, {
        preferredPersonId: normalizeRelationshipId(formData.value?.contactId || props.record?.contactId),
        preferredOrganizationId: normalizeRelationshipId(formData.value?.accountId || props.record?.accountId)
      });
      const people = (normalizedRelationships.dealPeople || [])
        .filter((p) => p.isActive !== false)
        .map((p) => ({
        personId: norm(p.personId),
        role: p.role,
        isPrimary: !!p.isPrimary,
        isActive: true,
        addedAt: p.addedAt || new Date(),
        addedBy: p.addedBy || null
      }));
      const orgs = (normalizedRelationships.dealOrganizations || [])
        .filter((o) => o.isActive !== false)
        .map((o) => ({
        organizationId: norm(o.organizationId),
        role: o.role,
        isPrimary: !!o.isPrimary,
        isActive: true,
        addedAt: o.addedAt || new Date(),
        addedBy: o.addedBy || null
      }));
      submitData.dealPeople = people;
      submitData.dealOrganizations = orgs;
    }

    // Deal lines: attach draft lines on create (edit mutates via DealLinesSection API)
    if (props.moduleKey === 'deals' && !isEditing.value) {
      const draft =
        dealLinesSectionRef.value?.getDraftPayload?.() ||
        dealLinesDraft.value;
      if (draft) {
        submitData.amountMode = draft.amountMode || 'MANUAL';
        if (Array.isArray(draft.lines) && draft.lines.length) {
          submitData.lines = draft.lines;
        }
        if (draft.amountMode === 'AUTO') {
          delete submitData.amount;
        }
      }
    }

    // People create: Global = identity only (no type), Sales = create→attach (Lead)
    if (props.moduleKey === 'people' && !isEditing.value) {
      // Strip type and all participation fields - never send to identity-only endpoint
      const participationFields = getParticipationFields('SALES');
      const toStrip = new Set(['type', ...participationFields].map((k) => k.toLowerCase()));
      Object.keys(submitData).forEach((key) => {
        if (toStrip.has(key.toLowerCase())) delete submitData[key];
      });
      // Restrict to core fields only (align with PeopleQuickCreateDrawer)
      const coreFieldSet = new Set((getCoreIdentityFields() || []).map((k) => k.toLowerCase()));
        const quickCreateKeys = (moduleDefinition.value?.quickCreate || []).map((f) =>
          (typeof f === 'string' ? f : (f?.key ?? f) || '').toLowerCase()
        ).filter(Boolean);
      const allowedKeys = new Set([...coreFieldSet, ...quickCreateKeys]);
      if (allowedKeys.size > 0) {
        Object.keys(submitData).forEach((key) => {
          if (!allowedKeys.has(key.toLowerCase())) delete submitData[key];
        });
      }
    }

    // Determine API endpoint based on module key
    // Note: apiClient already prepends /api, so we don't include it here
    let endpoint = '';
    const moduleEndpointMap = {
      'people': '/people',
      'organizations': '/v2/organization',
      'deals': '/deals',
      'tasks': '/tasks',
      'events': '/events',
      'cases': '/helpdesk/cases',
      'users': '/users'
    };
    
    endpoint =
      moduleEndpointMap[props.moduleKey] ||
      getModuleRecordCrudPathBase(props.moduleKey) ||
      `/${props.moduleKey}`;
    let createEndpoint = endpoint;
    
    // Remove legacyOrganizationId if it's null to avoid unique index conflicts
    if (props.moduleKey === 'organizations' && (submitData.legacyOrganizationId === null || submitData.legacyOrganizationId === undefined)) {
      delete submitData.legacyOrganizationId;
    }
    
    // For tasks, ensure default status, normalized relatedTo, and strip system fields
    if (props.moduleKey === 'tasks') {
      const taskSystemKeys = new Set((getTaskSystemFields() || []).map((k) => String(k).toLowerCase()));
      Object.keys(submitData).forEach((key) => {
        if (taskSystemKeys.has(key.toLowerCase())) delete submitData[key];
      });
      if (!submitData.status) submitData.status = 'todo';
      const rt = normalizedTaskRelatedTo(formData.value?.relatedTo);
      submitData.relatedTo = rt.type === 'none' ? { type: 'none', id: null } : { type: rt.type, id: rt.id || null };
      delete submitData.relatedToType;
      delete submitData.relatedToId;
    }

    // For event creation, route audit types through audit-scoped endpoint.
    // Sales endpoint (/events) enforces appKey=SALES and rejects appKey=AUDIT.
    if (props.moduleKey === 'events' && !isEditing.value) {
      const normalizedAppContext =
        typeof submitData.appContext === 'string' ? submitData.appContext.trim().toUpperCase() : '';
      const eventTypeForContext = submitData.eventType || formData.value?.eventType;
      const inferredAppContext = normalizedAppContext || (isAuditEventType(eventTypeForContext) ? 'AUDIT' : '');

      if (inferredAppContext === 'AUDIT') {
        submitData.appContext = inferredAppContext;
        createEndpoint = '/audit/events';
      } else if (inferredAppContext) {
        submitData.appContext = inferredAppContext;
        createEndpoint = `${endpoint}?appKey=${encodeURIComponent(inferredAppContext)}`;
      }
    }
    
    // For events using Scheduling API, inject required fields
    if (props.moduleKey === 'events' && endpoint === '/scheduling') {
      submitData.type = 'event';
      
      // For standalone events (no entityType/entityId provided), use Organization as default entity
      if (!submitData.entityType || !submitData.entityId) {
        const organizationId = authStore.user?.organizationId;
        if (organizationId) {
          submitData.entityType = 'Organization';
          submitData.entityId = organizationId;
        }
      }
      
      // Map startDateTime to startDate (Scheduling uses startDate for events)
      if (submitData.startDateTime && !submitData.startDate) {
        submitData.startDate = submitData.startDateTime;
        delete submitData.startDateTime;
      }
      
      // Map endDateTime to dueDate (Scheduling uses dueDate as end date for events)
      if (submitData.endDateTime && !submitData.dueDate) {
        submitData.dueDate = submitData.endDateTime;
        delete submitData.endDateTime;
      }
      
      // Map assignedTo to ownerPersonId if needed
      if (submitData.assignedTo && !submitData.ownerPersonId) {
        submitData.ownerPersonId = submitData.assignedTo;
      }
      // Remove assignedTo as Scheduling API doesn't use it
      delete submitData.assignedTo;
    }

    if (!isEditing.value) {
      submitData = applyCreateOwnerDefaultsToPayload(
        submitData,
        props.moduleKey,
        resolveCurrentUserId(authStore.user)
      );
    }

    // Purchase Return create: attach selected source document ids for line materialization
    if (isPurchaseReturnModule.value && !isEditing.value) {
      const sources = purchaseReturnSourcesRef.value?.getSelectedSources?.();
      if (sources) {
        if (Array.isArray(sources.receiptNoteIds) && sources.receiptNoteIds.length) {
          submitData.receiptNoteIds = sources.receiptNoteIds;
        }
        if (Array.isArray(sources.purchaseOrderIds) && sources.purchaseOrderIds.length) {
          submitData.purchaseOrderIds = sources.purchaseOrderIds;
        }
      }
      // Normalize lookup ids (DynamicForm may pass objects)
      if (submitData.vendorId && typeof submitData.vendorId === 'object') {
        submitData.vendorId = submitData.vendorId._id || submitData.vendorId.id || submitData.vendorId;
      }
      if (submitData.ownerId && typeof submitData.ownerId === 'object') {
        submitData.ownerId = submitData.ownerId._id || submitData.ownerId.id || submitData.ownerId;
      }
      if (submitData.vendorContactId && typeof submitData.vendorContactId === 'object') {
        submitData.vendorContactId =
          submitData.vendorContactId._id ||
          submitData.vendorContactId.id ||
          submitData.vendorContactId;
      }
      if (submitData.returnWarehouseId && typeof submitData.returnWarehouseId === 'object') {
        submitData.returnWarehouseId =
          submitData.returnWarehouseId._id ||
          submitData.returnWarehouseId.id ||
          submitData.returnWarehouseId;
      }
    }

    // Delivery Return create: attach selected DN/Invoice source ids
    if (isDeliveryReturnModule.value && !isEditing.value) {
      const sources = deliveryReturnSourcesRef.value?.getSelectedSources?.();
      if (sources) {
        if (sources.sourceType) submitData.sourceType = sources.sourceType;
        if (Array.isArray(sources.deliveryNoteIds) && sources.deliveryNoteIds.length) {
          submitData.deliveryNoteIds = sources.deliveryNoteIds;
        }
        if (Array.isArray(sources.invoiceIds) && sources.invoiceIds.length) {
          submitData.invoiceIds = sources.invoiceIds;
        }
      }
      if (submitData.customerId && typeof submitData.customerId === 'object') {
        submitData.customerId =
          submitData.customerId._id || submitData.customerId.id || submitData.customerId;
      }
      if (submitData.ownerId && typeof submitData.ownerId === 'object') {
        submitData.ownerId = submitData.ownerId._id || submitData.ownerId.id || submitData.ownerId;
      }
      if (submitData.contactPersonId && typeof submitData.contactPersonId === 'object') {
        submitData.contactPersonId =
          submitData.contactPersonId._id ||
          submitData.contactPersonId.id ||
          submitData.contactPersonId;
      }
      if (submitData.returnWarehouseId && typeof submitData.returnWarehouseId === 'object') {
        submitData.returnWarehouseId =
          submitData.returnWarehouseId._id ||
          submitData.returnWarehouseId.id ||
          submitData.returnWarehouseId;
      }
    }

    // Delivery Note create: attach selected SO sources / warehouse normalize
    if (isDeliveryNoteModule.value && !isEditing.value) {
      const sources = deliveryNoteSourcesRef.value?.getSelectedSources?.();
      if (sources) {
        if (sources.sourceType) submitData.sourceType = sources.sourceType;
        if (Array.isArray(sources.salesOrderIds) && sources.salesOrderIds.length) {
          submitData.salesOrderIds = sources.salesOrderIds;
        }
      }
      if (submitData.customerId && typeof submitData.customerId === 'object') {
        submitData.customerId =
          submitData.customerId._id || submitData.customerId.id || submitData.customerId;
      }
      if (submitData.ownerId && typeof submitData.ownerId === 'object') {
        submitData.ownerId = submitData.ownerId._id || submitData.ownerId.id || submitData.ownerId;
      }
      if (submitData.contactPersonId && typeof submitData.contactPersonId === 'object') {
        submitData.contactPersonId =
          submitData.contactPersonId._id ||
          submitData.contactPersonId.id ||
          submitData.contactPersonId;
      }
      if (submitData.warehouseId && typeof submitData.warehouseId === 'object') {
        submitData.warehouseId =
          submitData.warehouseId._id || submitData.warehouseId.id || submitData.warehouseId;
      }
    }

    // Receipt Note create: PO + location from source panel (required)
    if (isReceiptNoteModule.value && !isEditing.value) {
      const source = receiptNoteCreateRef.value?.getPayload?.();
      if (!source?.purchaseOrderId || !source?.receiptLocationId) {
        errors.value._general = t('records.rnCreateSourceRequired');
        saving.value = false;
        return;
      }
      submitData.purchaseOrderId = source.purchaseOrderId;
      submitData.receiptLocationId = source.receiptLocationId;
      // Drop auto vendor/status fields — server derives them
      delete submitData.vendorId;
      delete submitData.status;
      delete submitData.receiptNoteNumber;
    }

    // Stock adjustment create: stockroom + reason + lines from panel
    if (isStockAdjustmentModule.value && !isEditing.value) {
      const payload = stockAdjustmentCreateRef.value?.getPayload?.();
      if (!payload?.inventoryLocationId || !payload?.reasonCode || !payload.lines?.length) {
        errors.value._general = t('records.adjCreateRequired');
        saving.value = false;
        return;
      }
      submitData.inventoryLocationId = payload.inventoryLocationId;
      submitData.reasonCode = payload.reasonCode;
      submitData.lines = payload.lines;
      if (payload.notes) submitData.notes = payload.notes;
      else delete submitData.notes;
      delete submitData.status;
      delete submitData.inventoryAdjustmentId;
    }

    // Stock transfer create: from/to + lines from panel
    if (isStockTransferModule.value && !isEditing.value) {
      const payload = stockTransferCreateRef.value?.getPayload?.();
      if (!payload?.fromLocationId || !payload?.toLocationId || !payload.lines?.length) {
        errors.value._general = t('records.xferCreateRequired');
        saving.value = false;
        return;
      }
      submitData.fromLocationId = payload.fromLocationId;
      submitData.toLocationId = payload.toLocationId;
      submitData.lines = payload.lines;
      if (payload.notes) submitData.notes = payload.notes;
      else delete submitData.notes;
      delete submitData.status;
      delete submitData.inventoryTransferId;
    }
    
    // People create in Sales context: use create→attach flow (existing endpoint)
    const usePeopleCreateFlow = props.moduleKey === 'people' && !isEditing.value && isSalesContext.value;

    drawerDbg('[CreateRecordDrawer] 📤 Making API call:', {
      method: isEditing.value ? 'PUT' : 'POST',
      endpoint: usePeopleCreateFlow ? '/people/create' : (isEditing.value ? `${endpoint}/${props.record._id}` : createEndpoint),
      payloadKeys: Object.keys(submitData)
    });

    let response;
    if (isEditing.value && (props.record?._id || props.record?.inventoryLocationId || props.record?.id)) {
      if (props.moduleKey === 'cases') {
        const id = props.record._id;
        const prevStatus = props.record?.status;
        const statusChanged =
          caseEditNextStatus != null && String(caseEditNextStatus) !== String(prevStatus ?? '');

        let putResult = null;
        if (Object.keys(submitData).length > 0) {
          putResult = await apiClient.put(`${endpoint}/${id}`, submitData);
        } else if (!statusChanged) {
          errors.value._general = 'No changes to save.';
          saving.value = false;
          return;
        }

        let patchResult = null;
        if (statusChanged) {
          const patchBody = { status: caseEditNextStatus };
          const rs = String(
            (formData.value?.resolutionSummary ??
              putResult?.data?.resolutionSummary ??
              props.record?.resolutionSummary) ||
              ''
          ).trim();
          if (
            (caseEditNextStatus === 'Resolved' || caseEditNextStatus === 'Closed') &&
            rs
          ) {
            patchBody.resolutionSummary = rs;
          }
          patchResult = await apiClient.patch(`${endpoint}/${id}/status`, patchBody);
        }

        const merged = patchResult?.data ?? putResult?.data;
        response = { success: true, data: merged };
      } else {
        const recordApiId =
          props.record?.inventoryLocationId ||
          props.record?._id ||
          props.record?.id;
        response = await apiClient.put(`${endpoint}/${recordApiId}`, submitData);
      }
    } else if (usePeopleCreateFlow) {
      // People create in Sales context: create→attach as Lead (standardized: appKey + role)
      response = await apiClient.post('/people/create', {
        appKey: 'SALES',
        role: 'Lead',
        formData: submitData
      });
    } else {
      // Create new record (commercial docs: header POST, then flush local draft lines)
      response = await apiClient.post(createEndpoint, submitData);
      if (
        isCommercialLinesCreate.value &&
        (response?.success || response?.data) &&
        Array.isArray(commercialFormRecord.value?.lines) &&
        commercialFormRecord.value.lines.length
      ) {
        const header = response.data || response;
        const withLines = await flushCommercialCreateLines(header);
        response = { ...response, data: withLines, success: true };
      }
    }
    
    drawerDbg('[CreateRecordDrawer] 📥 API response:', {
      success: response.success,
      hasData: !!response.data,
      errors: response.errors,
      message: response.message
    });
    
    if (response.success || response.data) {
      drawerDbg('[CreateRecordDrawer] ✅ Success! Closing drawer...');
      saving.value = false; // Reset saving state before closing
      if (isCommercialLinesCreate.value) {
        commercialCreateSaved.value = true;
      }

      const savedRecord = response.data || response;

      // Meeting: surface conference provision outcome (generate Meet/Teams + invites)
      if (props.moduleKey === 'events' && response.conference) {
        const conf = response.conference;
        try {
          const { useNotifications } = await import('@/composables/useNotifications');
          const notifications = useNotifications();
          if (conf.status === 'generated') {
            notifications.success(
              t('events.meetingCreateConferenceGenerated', {
                count: response.invitedCount ?? conf.invites ?? 0
              })
            );
          } else if (conf.status === 'connect_required' || conf.status === 'no_calendar') {
            notifications.warning(conf.message || t('events.meetingCreateConferenceConnectRequired', { message: conf.message || '' }));
          } else if (conf.status === 'paste_required' && conf.provider === 'zoom') {
            notifications.info(t('events.meetingCreateConferencePasteZoom'));
          } else if (conf.status === 'generate_failed') {
            notifications.warning(conf.error || conf.message || t('events.meetingRecordNoJoinLink'));
          } else if (response.sentInvites === true && (response.invitedCount ?? 0) > 0) {
            notifications.success(
              t('events.meetingInviteSentToast', { count: response.invitedCount })
            );
          } else if (response.sentInvites === false && isEditing.value) {
            notifications.info(t('events.meetingInviteSilentToast'));
          }
        } catch {
          /* non-blocking */
        }
      } else if (
        props.moduleKey === 'events' &&
        response.sentInvites === false &&
        isEditing.value
      ) {
        try {
          const { useNotifications } = await import('@/composables/useNotifications');
          useNotifications().info(t('events.meetingInviteSilentToast'));
        } catch {
          /* non-blocking */
        }
      }
      
      // Open the saved record in a new tab (skip when nested lookup create links back to parent form)
      if (savedRecord && props.openRecordOnSave) {
        const recordId =
          savedRecord.inventoryLocationId ||
          savedRecord.inventoryAdjustmentId ||
          savedRecord.inventoryTransferId ||
          savedRecord._id ||
          savedRecord.id ||
          savedRecord.eventId;
        
        if (recordId) {
          // Get record title/name based on module type
          let recordTitle = '';
          const moduleTitleMap = {
            'people': () => {
              const firstName = savedRecord.first_name || '';
              const lastName = savedRecord.last_name || '';
              return firstName || lastName ? `${firstName} ${lastName}`.trim() : savedRecord.email || 'Contact';
            },
            'organizations': () => savedRecord.name || 'Organization',
            'deals': () => savedRecord.name || 'Deal',
            'tasks': () => savedRecord.title || 'Task',
            'events': () => savedRecord.eventName || savedRecord.title || 'Event',
            'cases': () => savedRecord.caseId || savedRecord.title || 'Case',
            'quotes': () => savedRecord.quoteNumber || savedRecord.quoteTitle || 'Quote',
            'invoices': () => savedRecord.invoiceNumber || savedRecord.invoiceTitle || 'Invoice',
            'sales_orders': () => savedRecord.salesOrderNumber || savedRecord.orderTitle || 'Sales Order',
            'purchase_orders': () => savedRecord.poNumber || savedRecord.subject || 'Purchase Order',
            'purchase_returns': () =>
              savedRecord.purchaseReturnNumber || savedRecord.subject || 'Purchase Return',
            'delivery_returns': () =>
              savedRecord.deliveryReturnNumber || savedRecord.subject || 'Delivery Return',
            'delivery_notes': () =>
              savedRecord.deliveryNoteNumber || savedRecord.subject || 'Delivery Note',
            'sales_returns': () => savedRecord.salesReturnNumber || 'Sales Return',
            'receipt_notes': () => savedRecord.receiptNoteNumber || 'Receipt Note',
            'stockrooms': () => savedRecord.name || savedRecord.locationCode || 'Stockroom',
            'stock_adjustments': () =>
              savedRecord.reasonCode ||
              savedRecord.inventoryAdjustmentId ||
              'Adjustment',
            'stock_transfers': () =>
              savedRecord.inventoryTransferId ||
              'Transfer',
            'users': () => savedRecord.firstName && savedRecord.lastName 
              ? `${savedRecord.firstName} ${savedRecord.lastName}`.trim()
              : savedRecord.email || savedRecord.username || 'User'
          };
          
          const getTitle = moduleTitleMap[props.moduleKey];
          if (getTitle) {
            recordTitle = getTitle();
          } else {
            recordTitle = savedRecord.name || savedRecord.title || moduleNameMap[props.moduleKey] || 'Record';
          }
          
          // Get record path based on module
          const modulePathMap = {
            'people': `/people/${recordId}`,
            'organizations': `/organizations/${recordId}`,
            'deals': `/deals/${recordId}`,
            'tasks': `/tasks/${recordId}`,
            'events': `/events/${recordId}`,
            'cases': `/helpdesk/cases/${recordId}`,
            'quotes': `/quotes/${recordId}`,
            'invoices': `/invoices/${recordId}`,
            'sales_orders': `/sales-orders/${recordId}`,
            'purchase_orders': `/inventory/purchase-orders/${recordId}`,
            'purchase_returns': `/inventory/purchase-returns/${recordId}`,
            'delivery_returns': `/inventory/delivery-returns/${recordId}`,
            'delivery_notes': `/inventory/delivery-notes/${recordId}`,
            'sales_returns': `/inventory/sales-returns/${recordId}`,
            'receipt_notes': `/inventory/receipt-notes/${recordId}`,
            'stockrooms': `/inventory/stockrooms/${recordId}`,
            'stock_adjustments': `/inventory/adjustments/${recordId}`,
            'stock_transfers': `/inventory/transfers/${recordId}`,
            'users': `/users/${recordId}`
          };
          
          const recordPath = modulePathMap[props.moduleKey] || `/${props.moduleKey}/${recordId}`;
          
          // Get icon based on module
          const moduleIconMap = {
            'people': 'users',
            'organizations': 'building',
            'deals': 'briefcase',
            'tasks': 'check',
            'events': '📅',
            'cases': 'ticket',
            'quotes': 'document-text',
            'invoices': 'document-text',
            'sales_orders': 'shopping-cart',
            'purchase_orders': 'document-text',
            'purchase_returns': 'arrow-uturn-left',
            'delivery_returns': 'arrow-uturn-right',
            'delivery_notes': 'truck',
            'sales_returns': 'receipt-refund',
            'receipt_notes': 'inbox-arrow-down',
            'stockrooms': 'building-storefront',
            'stock_adjustments': 'adjustments-horizontal',
            'stock_transfers': 'arrows-right-left',
            'users': 'user'
          };
          
          const icon = moduleIconMap[props.moduleKey] || 'document';
          
          // Check if we're already viewing this record
          const currentPath = activeTab.value?.path || '';
          const isAlreadyViewing = currentPath === recordPath || currentPath.includes(`/${recordId}`);
          
          // Open tab with the saved record (always for new records, or if not already viewing for edits)
          if (!isEditing.value || !isAlreadyViewing) {
            openTab(recordPath, {
              title: recordTitle,
              icon: icon,
              insertAdjacent: true
            });
          }
        }
      }
      
      // Dispatch global event to refresh calendar/list views for events
      if (props.moduleKey === 'events' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('arivu:event-created', {
          detail: { event: savedRecord }
        }));
      }
      
        // Dispatch global event to refresh list views for all modules
      if (typeof window !== 'undefined') {
        const eventName = isEditing.value ? 'arivu:record-updated' : 'arivu:record-created';
        window.dispatchEvent(new CustomEvent(eventName, {
          detail: { moduleKey: props.moduleKey, record: savedRecord }
        }));
      }
      
      emit('saved', savedRecord);
      closeDrawer();
    } else {
      drawerDbg('[CreateRecordDrawer] ❌ Failed:', response);
      errors.value = response.errors || { _general: response.message || `Failed to ${isEditing.value ? 'update' : 'create'} record` };
      scrollToFirstErrorField();
      saving.value = false;
    }
  } catch (error) {
    console.error('Error creating record:', error);
    console.error('Error response data:', error.response?.data);
    console.error('Full error object:', JSON.stringify(error, null, 2));

    const dupCode = error.response?.data?.code;
    if (
      error.response?.status === 409
      && (dupCode === 'DUPLICATE_WARNING' || dupCode === 'DUPLICATE_REJECTED' || dupCode === 'DUPLICATE_ITEM')
      && ['people', 'organizations', 'items', 'deals', 'tasks', 'cases'].includes(duplicateModuleKey.value)
    ) {
      duplicateMatches.value = error.response.data?.data?.matches || [];
      duplicateWarningOpen.value = true;
      errors.value = { _general: error.response.data?.message || t('duplicates.warningTitle') };
      saving.value = false;
      return;
    }
    
    // Reset errors
    errors.value = {};
    
    // Handle validation errors from API
    if (error.response?.data) {
      const errorData = error.response.data;
      
      // Check for field-specific errors (preferred format)
      if (errorData.errors && typeof errorData.errors === 'object' && !Array.isArray(errorData.errors) && Object.keys(errorData.errors).length > 0) {
        // Set field-specific errors
        errors.value = { ...errorData.errors };
        
        // Don't show general message if we have field-specific errors
        // Field errors will be shown next to each field via DynamicFormField
      } 
      // Check for error field first (it's usually more specific than generic message)
      // Some APIs use 'error' instead of 'message', and it often contains the actual error
      else if (errorData.error) {
        // Check if error message contains validation info that we can parse
        if (errorData.error.includes('validation failed')) {
          const validationErrors = {};
          
          // Parse error message like "People validation failed: type: Path `type` is required."
          // Pattern: "field: Path `field` is required."
          const requiredPattern = /(\w+):\s*Path\s+`(\w+)`\s+is\s+required\.?/gi;
          let match;
          while ((match = requiredPattern.exec(errorData.error)) !== null) {
            const fieldName = match[1] || match[2];
            validationErrors[fieldName] = `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
          }
          
          // Pattern: "field: error message" (general format)
          if (Object.keys(validationErrors).length === 0) {
            const parts = errorData.error.split(/validation failed:\s*/i);
            if (parts.length > 1) {
              const errorPart = parts[1];
              const fieldMatches = errorPart.match(/(\w+):\s*(.+?)(?:,|$)/g);
              if (fieldMatches) {
                fieldMatches.forEach(fieldMatch => {
                  const fieldParts = fieldMatch.match(/(\w+):\s*(.+)/);
                  if (fieldParts) {
                    const fieldName = fieldParts[1];
                    let errorMsg = fieldParts[2].trim();
                    // Clean up common Mongoose error phrases
                    errorMsg = errorMsg.replace(/^Path\s+`\w+`\s+/, '');
                    errorMsg = errorMsg.replace(/\.$/, '');
                    validationErrors[fieldName] = errorMsg;
                  }
                });
              }
            }
          }
          
          if (Object.keys(validationErrors).length > 0) {
            errors.value = validationErrors;
          } else {
            errors.value._general = errorData.error;
          }
        } else {
          errors.value._general = errorData.error;
        }
      }
      // Check for message in error data (if error field wasn't present)
      else if (errorData.message) {
        // Show the message, but prefer it over generic "Error creating record"
        // If it's "Validation failed. Please check the fields below." that's good
        if (errorData.message.includes('Validation failed') || errorData.message.includes('check the fields')) {
          errors.value._general = errorData.message;
        } else if (errorData.message !== 'Error creating record.' && errorData.message !== 'Error updating record.') {
          errors.value._general = errorData.message;
        } else {
          // If it's the generic message, show helpful message
          errors.value._general = 'Please fill in all required fields and try again.';
        }
      }
      // Fallback - try to parse the error message for validation hints
      else {
        const errorMsg = error.message || '';
        // If error message mentions validation or required fields, show helpful message
        if (errorMsg.toLowerCase().includes('validation') || errorMsg.toLowerCase().includes('required')) {
          errors.value._general = 'Please fill in all required fields and try again.';
        } else {
          errors.value._general = `Failed to ${isEditing.value ? 'update' : 'create'} record. Please check your input.`;
        }
      }
    } else {
      // Generic error message if no response data
      const errorMsg = error.message || '';
      if (errorMsg.toLowerCase().includes('validation') || errorMsg.toLowerCase().includes('required')) {
        errors.value._general = 'Please fill in all required fields and try again.';
      } else {
        errors.value._general = errorMsg || `Failed to ${isEditing.value ? 'update' : 'create'} record. Please try again.`;
      }
    }
    
    // If we still don't have any errors set, set a default
    if (Object.keys(errors.value).length === 0) {
      errors.value._general = 'Please fill in all required fields and try again.';
    }
    scrollToFirstErrorField();
  } finally {
    saving.value = false;
  }
};

function handleBeforeUnload(event) {
  if (!props.isOpen || !hasUnsavedChanges.value) return;
  event.preventDefault();
  event.returnValue = '';
}

// Persist while editing so keep-alive eviction / remount can restore.
watch(
  () => [formData.value, hasUnsavedChanges.value, userHasEdited.value, fullMode.value],
  () => {
    if (!props.isOpen || !ownerTabId.value || ownerTabId.value !== activeTabId.value) return;
    if (!hasUnsavedChanges.value && !userHasEdited.value) return;
    persistOwnerDraft();
  },
  { deep: true },
);

// Reset form when drawer opens/closes
watch(() => props.isOpen, (isOpen, wasOpen) => {
  if (!isOpen && wasOpen) {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  }
  if (isOpen) {
    ownerTabId.value = activeTabId.value;
    const existingDraft = resolveExistingCreateDraft();
    errors.value = {};
    const hasFormData = existingDraft?.formData && Object.keys(existingDraft.formData).length;
    const hasLocalCommercial =
      existingDraft?.commercialFormRecord &&
      typeof existingDraft.commercialFormRecord === 'object' &&
      !existingDraft.commercialFormRecord._id;
    if (hasFormData || hasLocalCommercial) {
      applyDraft(existingDraft);
      if (!props.record) {
        applyInitialDataOverlay();
      }
      setDrawerMode(Boolean(existingDraft.fullMode) || isCommercialLinesForm.value, { animate: false });
      // Keep moduleDefinition null so DynamicForm still fires ready; onFormReady skips re-seed.
      moduleDefinition.value = null;
    } else {
      userHasEdited.value = false;
      hasUnsavedChanges.value = false;
      commercialCreateDraftId.value = null;
      commercialCreateSaved.value = false;
      pendingDraftRestore.value = false;
      setDrawerMode(isCommercialLinesForm.value, { animate: false });
      moduleDefinition.value = null;
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    // Create: focus first field once DynamicForm is ready (not close button).
    // Edit: keep focus on close so we do not steal typing context mid-session.
    pendingInitialFieldFocus = !isEditing.value;
    if (isEditing.value) {
      nextTick(() => {
        withSuppressedInteractionMark(() => {
          closeButtonRef.value?.focus?.();
        });
      });
    }
    // Form seeds from record in onFormReady / moduleOverride watch after module loads
  } else {
    pendingInitialFieldFocus = false;
    commercialFormRecord.value = null;
    commercialFormLoading.value = false;
    commercialFormEnsurePromise.value = null;
    commercialCreateDraftId.value = null;
    commercialCreateSaved.value = false;
    ownerTabId.value = null;
    pendingDraftRestore.value = false;
    // Reset when closed so the next open re-seeds from record via onFormReady
    setTimeout(() => {
      formData.value = {};
      errors.value = {};
      moduleDefinition.value = null;
    }, 300);
  }
}, { immediate: true });

onUnmounted(() => {
  if (props.isOpen && ownerTabId.value) {
    persistOwnerDraft();
  }
  clearModeAnimTimer();
  window.removeEventListener('beforeunload', handleBeforeUnload);
});
</script>
