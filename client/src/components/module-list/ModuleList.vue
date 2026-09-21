<template>
  <div v-if="showListShellSkeleton">
    <ListPageSkeleton :body-rows="12" />
  </div>

  <div v-else-if="listDefinition">
    <!-- Empty State (from definition) -->
    <div v-if="shouldShowEmptyState" class="flex items-center justify-center min-h-[60vh]">
      <div class="text-center max-w-md">
        <img
          :src="fullPageEmptyIllustrationSrc"
          :alt="t('common.listEmptyIllustrationAlt')"
          class="mx-auto mb-6 h-40 w-auto"
        />
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {{ fullPageEmptyTitle }}
        </h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          {{ fullPageEmptyMessage }}
        </p>
        <button
          v-if="listDefinition.emptyState.primaryAction"
          @click="handleAction(listDefinition.emptyState.primaryAction.route)"
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          {{ fullPageEmptyActionLabel }}
        </button>
      </div>
    </div>

    <!-- List View -->
    <ListView
      v-else
      skip-mount-fetch
      :fill-height="fillHeight"
      :title="listPageTitle"
      :description="listDefinition.description"
      :module-key="listDefinition.moduleKey"
      :view-mode="viewMode"
      :create-label="listCreateLabel"
      :search-placeholder="listSearchPlaceholder"
      :data="data"
      :columns="adaptedColumns"
      :filter-fields="adaptedFilterFields"
      :loading="listViewLoading"
      :loading-more="loadingMore"
      infinite-scroll
      :selection-column-variant="selectionColumnVariant"
      :statistics="statistics"
      :stats-config="localizedStatsConfig"
      :selected-stat-key="selectedStatKey"
      :saved-views="displaySavedViews"
      :active-saved-view-id="activeSavedViewId"
      :default-view-id="defaultViewId"
      :sort-field="sortField"
      :sort-order="sortOrder"
      :sorts="sorts"
      :pagination="pagination"
      :external-filters="filters"
      :parent-search-query="searchQuery"
      :boost-visible-column-keys="boostVisibleColumnKeys"
      :table-id="`${listDefinition.moduleKey}-table`"
      :scroll-session-key="listSessionKey"
      row-key="_id"
      :empty-title="listEmptyTitle"
      :empty-message="listEmptyMessage"
      @create="handleCreate"
      @import="handleImport"
      @export="handleExport"
      @search-submit="handleSearchQueryUpdate"
      @update:filters="handleFiltersUpdate"
      @update:sort="handleSortUpdate"
      @update:pagination="handlePaginationUpdate"
      @saved-view-selected="handleSavedViewSelected"
      @set-default-view="handleSetDefaultView"
      @saved-views-updated="handleSavedViewsUpdated"
      @stat-click="handleStatClick"
      @fetch="fetchData"
      @load-more="handleLoadMore"
      @row-click="handleRowClick"
      @edit="handleEdit"
      @delete="handleDelete"
      @bulk-action="handleBulkAction"
      @kanban-settings-changed="$emit('kanban-settings-changed')"
      @stats-visibility-changed="(val) => $emit('stats-visibility-changed', val)"
    >
      <!-- Pass through all slots for custom cell rendering -->
      <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
        <slot :name="slotName" v-bind="slotProps" />
      </template>
    </ListView>
  </div>

  <!-- Error State -->
  <div v-else class="flex items-center justify-center min-h-[60vh]">
    <div class="text-center">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ t('common.moduleListListNotFound') }}</h2>
      <p class="text-gray-600 dark:text-gray-400">{{ t('common.moduleListTheListForThisModuleIs') }}</p>
    </div>
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  watch,
  nextTick,
  getCurrentInstance,
  onMounted,
  onBeforeUnmount,
  onActivated,
  onDeactivated,
  provide
} from 'vue';
import {
  consumeImportListRefreshPending,
  importModuleMatchesListModule,
} from '@/utils/importListModuleMatch';
import {
  MODULE_LIST_QUICK_TRUST_MS,
  MODULE_LIST_STALE_TTL_MS,
  clearModuleListRecheck,
  compareModuleListProbe,
  consumeModuleListDirty,
  extractMaxUpdatedAtMs,
  getModuleListFingerprint,
  peekModuleListRecheck,
  recordModuleListFingerprint,
} from '@/utils/moduleListFreshness';
import { fetchModuleListMeta, supportsServerListMeta } from '@/utils/moduleListMetaApi';
import { useI18n } from 'vue-i18n';
import {
  resolveListColumnLabel,
  resolveListCreateLabel,
  resolveListPageTitle,
  resolveListSearchPlaceholder,
  resolveListStatLabel,
  resolveListViewLabel,
  resolveModuleDisplayLabel,
  isRegistrySystemView,
} from '@/utils/moduleListLabels';
import ListPageSkeleton from '@/components/common/ListPageSkeleton.vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import { buildModuleListFromRegistry } from '@/utils/buildModuleListFromRegistry';
import { useOnboarding } from '@/composables/useOnboarding';
import { captureFirstTimeEmptyStateSeen } from '@/config/posthogOnboarding';
import { getAppRegistry } from '@/utils/getAppRegistry';
import { createPermissionSnapshot } from '@/types/permission-snapshot.types';
import { EmptyStateType } from '@/types/empty-state.types';
import { getModuleEmptyIllustrationSrc } from '@/utils/moduleEmptyIllustrations';
import ListView from '@/components/common/ListView.vue';
import apiClient from '@/utils/apiClient';
import { fetchModulesListCached, parseModulesListResponse } from '@/utils/tenantSchemaApiCache';
import { getStateFields } from '@/platform/fields/peopleFieldModel';
import { getParticipation } from '@/utils/getParticipation';
import {
  resolvePeopleListParticipationColumnLabel,
} from '@/utils/peopleParticipationUi';
import {
  resolveOrganizationListParticipationColumnLabel,
} from '@/utils/organizationParticipationUi';
import { getModuleListConfig, hasModuleListConfig, getSystemViews, resolvePeopleListAppContext } from '@/platform/modules/moduleListRegistry';
import {
  buildFilterFieldsFromModuleFields,
  buildListColumnsFromModuleFields,
} from '@/utils/buildListColumnsFromModuleFields';
import { normalizeFilterSelectOptions } from '@/utils/picklistOptionUtils';
import { normalizeListPagination } from '@/utils/normalizeListPagination';
import {
  normalizeSortSpecs,
  parsePersistedSort,
  serializeSortsForApi
} from '@/utils/listMultiSort';
import { expandEventsSpecialViewFilters, expandAllDateFilterObjects } from '@/utils/dateFilterOptions';
import { getModuleRecordCrudPathBase } from '@/utils/moduleRecordApiPath';
import { allSettledWithConcurrency } from '@/utils/allSettledWithConcurrency';
import { startBulkDelete } from '@/utils/runBulkDelete';
import { startBulkUpdate } from '@/utils/runBulkUpdate';
import { yieldToUi } from '@/utils/uiYield';
import { resolveListSearchTerm } from '@/utils/searchRelevance';
import {
  clearListSession,
  getListSession,
  getListSessionKey,
  LIST_SESSION_RESTORE_KEY,
  LIST_SESSION_SCROLL_CONCEAL_KEY,
  LIST_SESSION_PAGES_READY_KEY,
  patchListSession
} from '@/utils/listScrollSession';
import {
  fetchCustomSavedViews,
  loadActiveSavedViewId,
  persistCustomSavedViews,
  saveActiveSavedViewId,
} from '@/utils/listViewSavedViewsStorage';

import { useNotifications } from '@/composables/useNotifications';
/**
 * Check if a person participates in an app.
 * For SALES: use getParticipation abstraction (never person.type).
 * For other apps: use state fields from metadata.
 */
function participatesInApp(person, appKey) {
  if (!person || !appKey) return false;
  const key = String(appKey).toUpperCase();
  if (key === 'SALES' || key === 'HELPDESK') {
    return getParticipation(person, key) != null;
  }
  const stateFields = getStateFields(appKey);
  return stateFields.some(fieldKey => {
    const value = person[fieldKey];
    return value !== null && value !== undefined && value !== '';
  });
}

const props = defineProps({
  moduleKey: {
    type: String,
    required: true
  },
  appKey: {
    type: String,
    required: true
  },
  /** When provided (e.g. 'list' | 'kanban'), ListView shows "Customize List" vs "Customize Kanban" and the appropriate drawer */
  viewMode: {
    type: String,
    default: null
  },
  /** Passed to ListView/TableView: 'numbered-hover' shows row # until hover (desktop);
   *  'checkbox' always shows boxes */
  selectionColumnVariant: {
    type: String,
    default: 'numbered-hover',
    validator: (v) => !v || v === 'checkbox' || v === 'numbered-hover'
  },
  /**
   * List chrome fixed; table claims remaining viewport and scrolls internally.
   */
  fillHeight: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['create', 'import', 'export', 'row-click', 'edit', 'delete', 'bulk-action', 'filters-changed', 'search-changed', 'kanban-settings-changed', 'stats-visibility-changed', 'people-context-changed', 'shell-ready']);

/** Capture at setup — getCurrentInstance() is null inside async event handlers */
const setupInstance = getCurrentInstance();
const parentHandlesBulkAction = typeof setupInstance?.vnode?.props?.onBulkAction === 'function';
const parentHandlesDelete = typeof setupInstance?.vnode?.props?.onDelete === 'function';

const route = useRoute();
const router = useRouter();

/** Paginated list GET runs only in list view — kanban/calendar parents fetch their own dataset. */
function shouldFetchListDataForMode(mode) {
  if (mode == null || mode === '') return true;
  return String(mode).toLowerCase() === 'list';
}

function shouldFetchListData() {
  return shouldFetchListDataForMode(props.viewMode);
}

/** Fallback sample when API omits listStatistics and client must compute cards. */
const KANBAN_STATS_SAMPLE_LIMIT = 500;

function statisticsFetchLimit(_moduleConfig, opts = {}) {
  if (opts.clientSample) return KANBAN_STATS_SAMPLE_LIMIT;
  // Cheap probe — registry modules with KPI cards return server listStatistics.
  return 1;
}

/** True after the first list replace fetch completes (success or failure). */
const listInitialFetchComplete = ref(false);

/** Keep table in loading state until first fetch starts and finishes — avoids empty-state flash. */
const listViewLoading = computed(() => {
  if (dataLoading.value) return true;
  if (
    !listInitialFetchComplete.value
    && shouldFetchListData()
    && listDefinition.value
  ) {
    return true;
  }
  return false;
});

/** Only block the whole page on first load — not when returning from another tab */
const showListShellSkeleton = computed(
  () => loading.value && !listDefinition.value
);

const pendingListSessionRestore = ref(null);
const sessionRestoreTick = ref(0);
const listSessionScrollConcealing = ref(false);
const listSessionPagesReady = ref(true);
provide(LIST_SESSION_RESTORE_KEY, sessionRestoreTick);
provide(LIST_SESSION_SCROLL_CONCEAL_KEY, listSessionScrollConcealing);
provide(LIST_SESSION_PAGES_READY_KEY, listSessionPagesReady);

function beginListSessionRestore() {
  listSessionPagesReady.value = false;
  listSessionScrollConcealing.value = true;
}

function completeListSessionRestore() {
  listSessionPagesReady.value = true;
  bumpSessionRestoreTick();
}

function sessionNeedsScrollConceal(session) {
  if (!session) return false;
  const targetPage = Math.max(1, Number(session.currentPage) || 1);
  const scrollTop = Number(session.scrollTop);
  return targetPage > 1 || (Number.isFinite(scrollTop) && scrollTop > 0);
}

function finishListSessionPageRestore() {
  const session = getListSession(listSessionKey.value);
  const scrollTop = Number(session?.scrollTop);
  if (!Number.isFinite(scrollTop) || scrollTop <= 0) {
    listSessionScrollConcealing.value = false;
  }
}

function bumpSessionRestoreTick() {
  sessionRestoreTick.value += 1;
}

function clearListSessionState() {
  clearListSession(listSessionKey.value);
  pendingListSessionRestore.value = null;
}

async function restoreListSessionPages() {
  const session = pendingListSessionRestore.value;
  if (!session) return;

  const targetPage = Math.max(1, Number(session.currentPage) || 1);
  let guard = 0;
  const maxSteps = Math.min(targetPage, 200);

  while (
    guard < maxSteps &&
    normalizeListPagination(pagination.value).currentPage < targetPage &&
    normalizeListPagination(pagination.value).hasMore
  ) {
    guard += 1;
    await fetchListAppend();
  }

  pendingListSessionRestore.value = null;
  completeListSessionRestore();
  finishListSessionPageRestore();
}

async function applyListSessionOnActivate() {
  const session = getListSession(listSessionKey.value);
  if (!session) return;

  const targetPage = Math.max(1, Number(session.currentPage) || 1);
  const currentPage = normalizeListPagination(pagination.value).currentPage;

  if (data.value.length > 0 && currentPage >= targetPage) {
    completeListSessionRestore();
    finishListSessionPageRestore();
    return;
  }

  pendingListSessionRestore.value = session;

  if (data.value.length === 0) {
    return;
  }

  await restoreListSessionPages();
}

async function refreshListAfterImport() {
  pagination.value.currentPage = 1;
  clearListSessionState();
  await fetchData();
  consumeImportListRefreshPending(props.moduleKey);
}

function onImportCompleteForList(event) {
  const detail = event?.detail || {};
  if (!importModuleMatchesListModule(detail.module, props.moduleKey)) return;
  void refreshListAfterImport();
}

function onBulkDeleteCompleteForList(event) {
  const mk = String(event?.detail?.moduleKey || '').toLowerCase();
  if (!mk || mk !== String(props.moduleKey || '').toLowerCase()) return;
  void fetchData();
}

function onBulkUpdateCompleteForList(event) {
  onBulkDeleteCompleteForList(event);
}

onMounted(() => {
  window.addEventListener('arivu:import-complete', onImportCompleteForList);
  window.addEventListener('arivu:bulk-delete-complete', onBulkDeleteCompleteForList);
  window.addEventListener('arivu:bulk-update-complete', onBulkUpdateCompleteForList);
});

onBeforeUnmount(() => {
  window.removeEventListener('arivu:import-complete', onImportCompleteForList);
  window.removeEventListener('arivu:bulk-delete-complete', onBulkDeleteCompleteForList);
  window.removeEventListener('arivu:bulk-update-complete', onBulkUpdateCompleteForList);
});

onDeactivated(() => {
  patchListSession(listSessionKey.value, {
    currentPage: normalizeListPagination(pagination.value).currentPage
  });
  listSessionScrollConcealing.value = false;
  listSessionPagesReady.value = true;

  replaceAbortController?.abort();
  appendAbortController?.abort();
  appendAbortController = null;
  loadingMore.value = false;
  dataLoading.value = false;
});

async function restoreListSessionAfterFetch() {
  const session = getListSession(listSessionKey.value);
  if (!session) return;

  const targetPage = Math.max(1, Number(session.currentPage) || 1);
  if (normalizeListPagination(pagination.value).currentPage < targetPage) {
    pendingListSessionRestore.value = session;
    await restoreListSessionPages();
  } else {
    completeListSessionRestore();
    finishListSessionPageRestore();
  }
}

async function initialListFetch() {
  const session = getListSession(listSessionKey.value);
  const hasActiveQuery =
    listParamsHaveActiveFilters(buildListFetchContext(1).params)
    || Boolean(searchQuery.value && String(searchQuery.value).trim());

  if (!session || hasActiveQuery) {
    await fetchListReplace();
    if (session && !hasActiveQuery) {
      await restoreListSessionAfterFetch();
    }
    return;
  }

  pagination.value.currentPage = 1;
  await fetchListReplace({ preserveSession: true, soft: true });
  await restoreListSessionAfterFetch();
}

/** Dedupe buildList + onActivated both calling initialListFetch on first keep-alive mount. */
let initialListFetchPromise = null;

function scheduleInitialListFetch() {
  if (initialListFetchPromise) {
    return initialListFetchPromise;
  }
  initialListFetchPromise = initialListFetch()
    .catch((error) => {
      console.error('[ModuleList] Initial data fetch failed:', error);
    })
    .finally(() => {
      initialListFetchPromise = null;
    });
  return initialListFetchPromise;
}

/** Dedupe concurrent statistics-only fetches for kanban/calendar modes. */
let initialStatisticsFetchPromise = null;

function scheduleInitialStatisticsFetch() {
  if (initialStatisticsFetchPromise) {
    return initialStatisticsFetchPromise;
  }
  initialStatisticsFetchPromise = fetchListStatistics()
    .catch((error) => {
      console.error('[ModuleList] Initial statistics fetch failed:', error);
    })
    .finally(() => {
      initialStatisticsFetchPromise = null;
    });
  return initialStatisticsFetchPromise;
}

function recordListFingerprintFromState() {
  recordModuleListFingerprint(props.moduleKey, props.appKey, {
    totalRecords: Number(pagination.value.totalRecords ?? 0) || 0,
    maxUpdatedAt: extractMaxUpdatedAtMs(data.value),
  });
}

async function probeListDataChanged() {
  try {
    const ctx = buildListFetchContext(1);
    const metaParams = { ...ctx.params };
    delete metaParams.page;
    delete metaParams.limit;

    if (supportsServerListMeta(props.moduleKey)) {
      const probe = await fetchModuleListMeta(props.moduleKey, metaParams);
      if (probe) {
        const fingerprint = getModuleListFingerprint(props.moduleKey, props.appKey);
        return compareModuleListProbe(fingerprint, probe) !== 'unchanged';
      }
    }

    const response = await apiClient.get(ctx.endpoint, {
      params: {
        ...ctx.params,
        page: 1,
        limit: 1,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      },
      cache: 'no-store',
    });
    if (!response?.success) return true;

    const rows = applyClientSideListTransforms(response.data || [], ctx);
    const probeTotal = Number(
      response.pagination?.totalRecords
      ?? response.meta?.totalRecords
      ?? response.meta?.total
      ?? 0
    );
    const probe = {
      totalRecords: Number.isFinite(probeTotal) ? probeTotal : 0,
      maxUpdatedAt: extractMaxUpdatedAtMs(rows),
    };

    const fingerprint = getModuleListFingerprint(props.moduleKey, props.appKey);
    return compareModuleListProbe(fingerprint, probe) !== 'unchanged';
  } catch (error) {
    console.warn('[ModuleList] Freshness probe failed:', error);
    return false;
  }
}

async function maybeRefreshListOnActivate() {
  if (!shouldFetchListData()) {
    if (consumeModuleListDirty(props.moduleKey, props.appKey)) {
      await fetchListStatistics();
      return true;
    }
    return false;
  }

  if (consumeModuleListDirty(props.moduleKey, props.appKey)) {
    await fetchData({ preserveSession: true, soft: true });
    return true;
  }

  if (!peekModuleListRecheck(props.moduleKey, props.appKey)) {
    return false;
  }

  const fingerprint = getModuleListFingerprint(props.moduleKey, props.appKey);
  const age = Date.now() - (fingerprint?.fetchedAt ?? 0);

  if (age < MODULE_LIST_QUICK_TRUST_MS) {
    clearModuleListRecheck(props.moduleKey, props.appKey);
    return false;
  }

  if (!fingerprint || age >= MODULE_LIST_STALE_TTL_MS) {
    clearModuleListRecheck(props.moduleKey, props.appKey);
    await fetchData({ preserveSession: true, soft: true });
    return true;
  }

  const changed = await probeListDataChanged();
  clearModuleListRecheck(props.moduleKey, props.appKey);
  if (!changed) return false;

  await fetchData({ preserveSession: true, soft: true });
  return true;
}

onActivated(async () => {
  // Aborted in-flight fetch when the tab was hidden can leave dataLoading stuck true.
  if (data.value.length > 0) {
    dataLoading.value = false;
  }

  if (consumeImportListRefreshPending(props.moduleKey)) {
    listSessionScrollConcealing.value = false;
    await refreshListAfterImport();
    return;
  }

  if (data.value.length > 0 && listDefinition.value) {
    if (await maybeRefreshListOnActivate()) {
      finishListSessionPageRestore();
      return;
    }
    await applyListSessionOnActivate();
    finishListSessionPageRestore();
    return;
  }

  if (!shouldFetchListData() && listDefinition.value) {
    if (await maybeRefreshListOnActivate()) {
      finishListSessionPageRestore();
      return;
    }
  }

  if (listDefinition.value) {
    const session = getListSession(listSessionKey.value);
    if (data.value.length === 0 && sessionNeedsScrollConceal(session)) {
      beginListSessionRestore();
    }
    if (shouldFetchListData()) {
      dataLoading.value = true;
      await scheduleInitialListFetch();
    } else {
      await scheduleInitialStatisticsFetch();
    }
    if (!listSessionPagesReady.value) {
      completeListSessionRestore();
    }
    finishListSessionPageRestore();
    return;
  }

  // Stats from a prior visit but rows were cleared (aborted replace / keep-alive eviction).
  const statsTotal = Number(
    statistics.value?.totalPeople ??
      statistics.value?.totalRecords ??
      pagination.value?.totalRecords ??
      0
  );
  if (statsTotal > 0 && data.value.length === 0 && shouldFetchListData()) {
    dataLoading.value = true;
    await scheduleInitialListFetch();
  }
});
const authStore = useAuthStore();
const {
  fetchOnboarding,
  hasModuleVisit,
  recordModuleVisit,
} = useOnboarding();
const moduleListConfigOptions = computed(() => ({
  inventoryEnabled: authStore.inventoryEnabled
}));
function resolveModuleListConfig(moduleKey = props.moduleKey) {
  return getModuleListConfig(moduleKey, moduleListConfigOptions.value);
}
const { openTab } = useTabs();
const { t, te } = useI18n();
const notifications = useNotifications();


const loading = ref(true);
const dataLoading = ref(false);
const listDefinition = ref(null);
const data = ref([]);
const statistics = ref({});
const statisticsLoading = ref(false);
/** Quick-filter card selection; counts stay on saved-view scope. */
const selectedStatKey = ref(null);
const statsConfig = ref([]);
const sortField = ref('');
const sortOrder = ref('desc'); // Default to newest first so new records appear on page 1
const sorts = ref([]);

function setListSorts(nextSorts, options = {}) {
  const normalized = normalizeSortSpecs(nextSorts).map((spec) => ({
    field: normalizePeopleListSortField(spec.field),
    order: spec.order
  }));
  sorts.value = normalized;
  if (normalized.length > 0) {
    sortField.value = normalized[0].field;
    sortOrder.value = normalized[0].order;
  } else if (!options.keepPrimary) {
    sortField.value = options.field ?? '';
    sortOrder.value = options.order ?? 'desc';
  }
}

/** People list: API/registry use sales_type; legacy layouts may still reference type */
const normalizePeopleListSortField = (key) => {
  if (props.moduleKey !== 'people' || key == null || key === '') return key;
  return String(key).trim() === 'type' ? 'sales_type' : key;
};

const pagination = ref({
  currentPage: 1,
  totalPages: 1,
  totalRecords: 0,
  limit: 25
});
const loadingMore = ref(false);
/** Bumped on every replace fetch so in-flight appends can detect stale results */
const listDataEpoch = ref(0);
let replaceSeq = 0;
let appendSeq = 0;
let replaceAbortController = null;
let appendAbortController = null;
/** Dedupe concurrent replace fetches (buildList + onActivated racing on remount). */
let replaceInFlight = null;

const filters = ref({});
const searchQuery = ref('');

const coerceFilterValuesToArray = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (value == null || value === '') return [];
  return [String(value).trim()].filter(Boolean);
};

const includesRoleMatch = (filterValues, roleValue) => {
  if (!filterValues.length) return true;
  const normalizedRole = String(roleValue || '').trim().toLowerCase();
  return filterValues.some((candidate) => String(candidate).trim().toLowerCase() === normalizedRole);
};

// Saved Views for People module
const savedViews = ref([]);
const defaultViewId = ref(null);
const activeSavedViewId = ref(null);

function resolveViewPeopleContext(view) {
  if (props.moduleKey !== 'people') return 'ALL';
  if (view?.peopleContext) return view.peopleContext;
  if (view?.id) {
    return resolvePeopleListAppContext(props.moduleKey, view.id, moduleListConfigOptions.value);
  }
  return 'ALL';
}

const effectivePeopleContext = computed(() => {
  if (props.moduleKey !== 'people') return 'ALL';
  const view = savedViews.value.find((v) => v.id === activeSavedViewId.value);
  return resolveViewPeopleContext(view);
});

function peopleEmptyFilterViewId(context) {
  if (context === 'SALES') return 'sales';
  if (context === 'HELPDESK') return 'helpdesk';
  return 'all';
}

const listSessionScope = computed(() => {
  if (activeSavedViewId.value) {
    return String(activeSavedViewId.value);
  }
  return '';
});

const listSessionKey = computed(() =>
  getListSessionKey(props.moduleKey, props.appKey, route.path, listSessionScope.value)
);

const moduleFieldDefinitions = ref([]);
const appRegistry = ref(null);

// Build list from registry
const buildList = async () => {
  if (!authStore.user || !authStore.isAuthenticated) {
    listDefinition.value = null;
    loading.value = false;
    return;
  }

  const isFirstShellLoad = !listDefinition.value;
  if (isFirstShellLoad) {
    loading.value = true;
  }
  try {
    // Fetch app registry
    const registry = await getAppRegistry();
    appRegistry.value = registry;
    
    if (!authStore.user || !authStore.isAuthenticated) {
      return;
    }
    
    // Fetch field definitions for schema-driven filters
    await fetchModuleFieldDefinitions();
    
    // Create permission snapshot
    const snapshot = createPermissionSnapshot(authStore.user);

    await fetchOnboarding();
    const isFirstModuleVisit = !hasModuleVisit(props.moduleKey, props.appKey);

    // Build list definition
    const definition = buildModuleListFromRegistry(
      props.moduleKey,
      props.appKey,
      registry,
      snapshot,
      { isFirstModuleVisit }
    );

    if (isFirstModuleVisit && definition) {
      if (definition.emptyState?.type === EmptyStateType.FIRST_TIME) {
        captureFirstTimeEmptyStateSeen(props.moduleKey, props.appKey, {
          persona: authStore.user?.onboarding?.persona,
          origin: authStore.user?.onboarding?.origin,
          organizationId: authStore.user?.organizationId,
        });
      }
      void recordModuleVisit(props.moduleKey, props.appKey);
    }

    if (authStore.user && authStore.isAuthenticated) {
      const fieldColumns = buildListColumnsFromModuleFields(
        moduleFieldDefinitions.value,
        props.moduleKey,
        authStore.inventoryEnabled
      );
      if (fieldColumns.length > 0) {
        listDefinition.value = {
          ...definition,
          columns: fieldColumns
        };
      } else {
        listDefinition.value = definition;
      }

      emit('shell-ready');

      // Initialize sort from definition
      if (definition?.defaultSort) {
        const order =
          props.moduleKey === 'people' && definition.defaultSort.column === 'createdAt'
            ? 'desc'
            : (definition.defaultSort.order === 'asc' ? 'asc' : 'desc');
        setListSorts([{ field: definition.defaultSort.column, order }]);
      }
      
      // Initialize pagination from definition
      if (definition?.pagination) {
        pagination.value.limit = definition.pagination.pageSize;
      }
      
      // Fetch data after definition is built
      // Only skip if empty state is NOT_CONFIGURED (no columns)
      // Otherwise fetch data even if empty state exists (might be NO_DATA)
      
      // Initialize module-specific configuration from registry
      const moduleConfig = resolveModuleListConfig(props.moduleKey);
      const currentUserId = authStore.user?._id;
      const moduleLabel = listDefinition.value?.title || props.moduleKey.charAt(0).toUpperCase() + props.moduleKey.slice(1);
      
      // Get system views (from registry or generate defaults)
      const systemViews = getSystemViews(
        props.moduleKey,
        moduleLabel,
        currentUserId,
        moduleListConfigOptions.value
      );
      
      // Convert system views to saved views format (with label instead of name)
      const systemViewsFormatted = systemViews.map(view => ({
        id: view.id,
        label: view.name,
        filters: view.filters,
        isDefault: view.isDefault === true,
        peopleContext: view.peopleContext,
      }));
      
      const customViews = await fetchCustomSavedViews(props.moduleKey, currentUserId);
      
      // Merge system views with custom views
      savedViews.value = [...systemViewsFormatted, ...customViews];
      
      // Initialize stats config from registry if available
      if (moduleConfig?.statistics) {
        statsConfig.value = moduleConfig.statistics.stats;
      }
      
      // Find default view or first view
      const defaultView = systemViews.find(v => v.isDefault) || systemViews[0];
      if (defaultView) {
        // Priority: last active view (if user switched before reload) > user's default (first visit) > "All"
        const defaultViewStorageKey = `arivu-listview-${props.moduleKey}-default-view`;
        try {
          const userDefaultViewId = localStorage.getItem(defaultViewStorageKey);
          defaultViewId.value = userDefaultViewId || null;
          const savedActiveViewId = loadActiveSavedViewId(props.moduleKey, currentUserId);
          const viewToLoad = (savedActiveViewId && savedViews.value.find(v => v.id === savedActiveViewId))
            ? savedActiveViewId
            : (userDefaultViewId && savedViews.value.find(v => v.id === userDefaultViewId))
              ? userDefaultViewId
              : defaultView.id;
          activeSavedViewId.value = viewToLoad;
          const savedView = savedViews.value.find(v => v.id === viewToLoad);
          if (savedView) {
            filters.value = resolveSavedViewFilters(savedView, currentUserId);
            const savedConfig = savedView.config;
            if (savedConfig?.sort?.field || savedConfig?.sort?.sorts?.length) {
              const parsed = parsePersistedSort(savedConfig.sort);
              if (parsed.length) {
                setListSorts(parsed);
              } else {
                setListSorts([{
                  field: savedConfig.sort.field,
                  order: savedConfig.sort.order === 'asc' ? 'asc' : 'desc'
                }]);
              }
            }
            if (savedConfig?.search !== undefined) {
              searchQuery.value = savedConfig.search;
            }
          } else {
            filters.value = {};
          }
        } catch (error) {
          console.warn('[ModuleList] Failed to load saved view:', error);
          activeSavedViewId.value = defaultView.id;
          filters.value = {};
        }
      }
      
      if (!moduleConfig) {
        // For other modules, use statsConfig from definition or response
        statsConfig.value = definition?.statsConfig || [];
      }

      // Show the list shell immediately once definition is available.
      // Data fetch runs in the background, keeping the perceived load faster.
      loading.value = false;

      if (definition && definition.emptyState?.type !== 'NOT_CONFIGURED') {
        if (shouldFetchListData()) {
          listInitialFetchComplete.value = false;
          dataLoading.value = true;
          scheduleInitialListFetch();
        } else {
          listInitialFetchComplete.value = true;
          emit('filters-changed', { ...filters.value });
          scheduleInitialStatisticsFetch();
        }
      } else {
        listInitialFetchComplete.value = true;
      }

      if (props.moduleKey === 'people') {
        emit('people-context-changed', effectivePeopleContext.value);
      }

      return;
    }
  } catch (error) {
    console.error('[ModuleList] Error building list:', error);
    if (authStore.isAuthenticated) {
      listDefinition.value = null;
    }
  } finally {
    if (authStore.isAuthenticated) {
      loading.value = false;
    }
  }
};

// Adapt columns from definition to ListView format
function listColumnFilterOptions(rawOptions) {
  const normalized = normalizeFilterSelectOptions(rawOptions);
  return normalized.length > 0 ? normalized : undefined;
}

const adaptedColumns = computed(() => {
  if (!listDefinition.value?.columns) return [];
  
  return listDefinition.value.columns.map(col => {
    const fieldDef = moduleFieldDefinitions.value.find((f) => f.key === col.key);
    const defaultLabel = resolveListColumnLabel(props.moduleKey, col.key, col.label, t, te);
    const label =
      props.moduleKey === 'people'
        ? resolvePeopleListParticipationColumnLabel(
            col.key,
            effectivePeopleContext.value,
            () => defaultLabel,
            t,
            te
          )
        : props.moduleKey === 'organizations'
          ? resolveOrganizationListParticipationColumnLabel(col.key, () => defaultLabel, t, te)
          : defaultLabel;
    return {
      key: col.key,
      label,
      sortable: col.sortable ?? false,
      sortKey: col.fieldPath || col.key,
      dataType: col.dataType,
      filterType: fieldDef?.filterType || col.filterType,
      options: listColumnFilterOptions(col.options || fieldDef?.options),
    };
  });
});

const adaptedFilterFields = computed(() => {
  if (!moduleFieldDefinitions.value.length) return [];

  return buildFilterFieldsFromModuleFields(
    moduleFieldDefinitions.value,
    props.moduleKey,
    authStore.inventoryEnabled
  ).map((field) => {
    const defaultLabel = resolveListColumnLabel(props.moduleKey, field.key, field.label, t, te);
    const label =
      props.moduleKey === 'people'
        ? resolvePeopleListParticipationColumnLabel(
            field.key,
            effectivePeopleContext.value,
            () => defaultLabel,
            t,
            te
          )
        : props.moduleKey === 'organizations'
          ? resolveOrganizationListParticipationColumnLabel(field.key, () => defaultLabel, t, te)
          : defaultLabel;
    return {
      key: field.key,
      label,
      dataType: field.dataType,
      filterType: field.filterType,
      options: listColumnFilterOptions(field.options),
    };
  });
});

const listPageTitle = computed(() => resolveListPageTitle(props.moduleKey, t, te));

const moduleLabel = computed(() => resolveModuleDisplayLabel(props.moduleKey, t, te));
const moduleLabelLower = computed(() => moduleLabel.value.toLowerCase());

const listEmptyTitle = computed(() => {
  const es = listDefinition.value?.emptyState;
  if (!es || es.type === EmptyStateType.NO_DATA) {
    return t('common.listEmptyNoModuleYet', { module: moduleLabelLower.value });
  }
  if (es.titleKey && te(es.titleKey)) {
    return t(es.titleKey);
  }
  return es.title;
});

const listEmptyMessage = computed(() => {
  const es = listDefinition.value?.emptyState;
  if (!es || es.type === EmptyStateType.NO_DATA) {
    return t('common.listEmptyModuleWillAppear', { module: moduleLabel.value });
  }
  if (es.descriptionKey && te(es.descriptionKey)) {
    return t(es.descriptionKey);
  }
  return es.description || t('common.listEmptyMessage');
});

const fullPageEmptyTitle = computed(() => {
  const es = listDefinition.value?.emptyState;
  if (!es) return t('moduleList.emptyState.title');
  if (es.titleKey && te(es.titleKey)) return t(es.titleKey);
  return es.title || t('moduleList.emptyState.title');
});

const fullPageEmptyMessage = computed(() => {
  const es = listDefinition.value?.emptyState;
  if (!es) return t('moduleList.emptyState.description');
  if (es.descriptionKey && te(es.descriptionKey)) return t(es.descriptionKey);
  return es.description || t('moduleList.emptyState.description');
});

const fullPageEmptyActionLabel = computed(() => {
  const action = listDefinition.value?.emptyState?.primaryAction;
  if (!action) return '';
  if (action.labelKey && te(action.labelKey)) return t(action.labelKey);
  return action.label;
});

const fullPageEmptyIllustrationSrc = computed(() =>
  getModuleEmptyIllustrationSrc(props.moduleKey)
);

const listSearchPlaceholder = computed(() => resolveListSearchPlaceholder(props.moduleKey, t, te));

const listCreateLabel = computed(() => {
  const createAction = listDefinition.value?.primaryActions?.find(a => a.type === 'create');
  const fallback = createAction?.label || `New ${listDefinition.value?.title || 'Item'}`;
  return resolveListCreateLabel(props.moduleKey, fallback, t, te);
});

const localizedStatsConfig = computed(() => {
  const moduleConfig = resolveModuleListConfig(props.moduleKey);
  const resolveStats = moduleConfig?.statistics?.resolveStats;
  const baseStats = resolveStats
    ? resolveStats(filters.value || {}, activeSavedViewId.value)
    : statsConfig.value;

  return (baseStats || []).map((stat) => ({
    ...stat,
    name: resolveListStatLabel(props.moduleKey, stat.key, stat.name, t, te),
  }));
});

const displaySavedViews = computed(() =>
  savedViews.value.map((view) => ({
    ...view,
    label: isRegistrySystemView(props.moduleKey, view.id)
      ? resolveListViewLabel(props.moduleKey, view.id, view.label, t, te)
      : view.label,
  }))
);

const boostVisibleColumnKeys = computed(() => {
  if (props.moduleKey !== 'events') return [];
  const f = filters.value || {};
  if (f.appointmentOnly !== 'true' && f.appointmentOnly !== true) return [];
  const moduleConfig = getModuleListConfig('events');
  return moduleConfig?.appointmentListColumns ?? [];
});

const fetchModuleFieldDefinitions = async () => {
  try {
    const params = { key: props.moduleKey };
    if (props.moduleKey === 'people') {
      if (effectivePeopleContext.value === 'SALES') params.context = 'sales';
      else if (effectivePeopleContext.value === 'HELPDESK') params.context = 'helpdesk';
      else params.context = 'all';
    }
    const response = await fetchModulesListCached(params);
    const list = parseModulesListResponse(response);
    if (list.length > 0) {
      moduleFieldDefinitions.value = list[0].fields || [];
    } else {
      moduleFieldDefinitions.value = [];
      console.warn('[ModuleList] No module found or empty response');
    }
  } catch (error) {
    console.error('[ModuleList] Error fetching module field definitions:', error);
    moduleFieldDefinitions.value = [];
  }
};

async function rebuildPeopleListColumns() {
  if (props.moduleKey !== 'people' || !listDefinition.value) return;
  await fetchModuleFieldDefinitions();
  const fieldColumns = buildListColumnsFromModuleFields(
    moduleFieldDefinitions.value,
    props.moduleKey,
    authStore.inventoryEnabled
  );
  if (fieldColumns.length > 0) {
    listDefinition.value = {
      ...listDefinition.value,
      columns: fieldColumns,
    };
  }
}

// Statistics computation is now handled by the registry

// Determine when to show full-page empty state based on definition type
// NO_DATA empty states should be shown inside the table (handled by ListView/TableView)
// Only show full-page empty state for configuration/access issues
const shouldShowEmptyState = computed(() => {
  if (!listDefinition.value?.emptyState) {
    return false;
  }

  const emptyState = listDefinition.value.emptyState;
  const emptyStateType = emptyState.type;

  // NO_ACCESS or NOT_CONFIGURED: Always show full-page (regardless of data)
  if (emptyStateType === EmptyStateType.NO_ACCESS || emptyStateType === EmptyStateType.NOT_CONFIGURED) {
    return true;
  }

  // NO_DATA: Don't show full-page - let ListView/TableView handle it inside the table
  if (emptyStateType === EmptyStateType.NO_DATA) {
    return false;
  }

  if (emptyStateType === EmptyStateType.DISABLED) {
    return true;
  }

  // FIRST_TIME: wait for list fetch — user may already have imported data
  if (emptyStateType === EmptyStateType.FIRST_TIME) {
    if (listViewLoading.value) return false;
    const total = Number(pagination.value.totalRecords ?? 0);
    if (data.value.length > 0 || total > 0) return false;
    return true;
  }

  // Default: Don't show
  return false;
});

function stableListRowId(row) {
  if (!row || typeof row !== 'object') return null;
  const id = row._id;
  if (id == null || id === '') return null;
  return String(id);
}

function mergeAppendRowsById(existing, incoming) {
  const seen = new Set(
    existing.map(stableListRowId).filter(Boolean)
  );
  const merged = [...existing];
  for (const row of incoming) {
    const id = stableListRowId(row);
    if (id != null) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    merged.push(row);
  }
  return merged;
}

const LIST_FETCH_PAGINATION_KEYS = new Set(['page', 'limit', 'sortBy', 'sortOrder', 'appKey', 'peopleContext']);

function listParamsHaveActiveFilters(params) {
  if (!params || typeof params !== 'object') return false;
  if (params.search && String(params.search).trim()) return true;
  if (params.filterQuery && String(params.filterQuery).trim()) return true;
  return Object.keys(params).some((key) => {
    if (LIST_FETCH_PAGINATION_KEYS.has(key)) return false;
    const value = params[key];
    return value !== undefined && value !== '';
  });
}

function zeroListStatistics(ctx, totalRecords = 0) {
  const keys = ctx.moduleConfig?.statistics?.stats?.map((stat) => stat.key) ?? [];
  const out = { totalRecords };
  for (const key of keys) {
    out[key] = 0;
  }
  out.totalPeople = totalRecords;
  out.totalOrganizations = totalRecords;
  return out;
}

function filtersPayloadSignature(payload) {
  return JSON.stringify(payload ?? {});
}

/** Refresh KPIs from list response unless a selected stat-card overlay is in the query. */
function shouldRefreshStatisticsFromListFetch(ctx) {
  if (ctx?.moduleConfig?.statistics?.scope === 'query') {
    return true;
  }

  // Working-set scope: Filters/search/view update cards; stat overlays do not.
  return !listQueryHasSelectedStatOverlay(ctx?.normalizedFilters);
}

function applyListStatisticsFromResponse(response, totalRecords, ctx, rowsForCompute = null) {
  if (totalRecords === 0) {
    statistics.value = zeroListStatistics(ctx, 0);
    return;
  }

  const computeRows = Array.isArray(rowsForCompute) ? rowsForCompute : data.value;

  if (response.listStatistics && typeof response.listStatistics === 'object') {
    const raw = response.listStatistics;
    const reportedTotal = Number(
      raw.totalEvents
        ?? raw.totalTasks
        ?? raw.myTasks
        ?? raw.totalCases
        ?? raw.myCases
        ?? raw.myPeople
        ?? raw.myOrganizations
        ?? raw.myQuotes
        ?? raw.myInvoices
        ?? raw.mySalesOrders
        ?? raw.totalOrganizations
        ?? raw.totalPeople
        ?? raw.totalDeals
        ?? raw.totalQuotes
        ?? raw.totalItems
        ?? raw.totalCampaigns
        ?? raw.totalReports
        ?? raw.totalWidgets
        ?? raw.totalDashboards
        ?? raw.totalInvoices
        ?? raw.totalSalesOrders
        ?? raw.totalRecords
        ?? totalRecords
    ) || 0;

    // Stale cache or race can return unfiltered aggregates while pagination is filtered.
    if (reportedTotal !== totalRecords) {
      if (ctx.moduleConfig?.statistics?.computeFunction) {
        statistics.value = ctx.moduleConfig.statistics.computeFunction(computeRows, authStore.user?._id, {
          totalRecords
        });
        return;
      }
      statistics.value = zeroListStatistics(ctx, totalRecords);
      return;
    }

    statistics.value = {
      ...raw,
      totalPeople: raw.totalPeople ?? totalRecords,
      myPeople: raw.myPeople ?? raw.totalPeople ?? totalRecords,
      totalOrganizations: raw.totalOrganizations ?? totalRecords,
      myOrganizations: raw.myOrganizations ?? raw.totalOrganizations ?? totalRecords,
      totalEvents: raw.totalEvents ?? totalRecords,
      myEvents: raw.myEvents ?? raw.totalEvents ?? totalRecords,
      totalTasks: raw.totalTasks ?? totalRecords,
      myTasks: raw.myTasks ?? raw.totalTasks ?? totalRecords,
      totalCases: raw.totalCases ?? totalRecords,
      myCases: raw.myCases ?? raw.totalCases ?? totalRecords,
      totalDeals: raw.totalDeals ?? totalRecords,
      totalQuotes: raw.totalQuotes ?? totalRecords,
      myQuotes: raw.myQuotes ?? raw.totalQuotes ?? totalRecords,
      totalItems: raw.totalItems ?? totalRecords,
      totalCampaigns: raw.totalCampaigns ?? totalRecords,
      totalReports: raw.totalReports ?? totalRecords,
      totalWidgets: raw.totalWidgets ?? totalRecords,
      totalDashboards: raw.totalDashboards ?? totalRecords,
      totalInvoices: raw.totalInvoices ?? totalRecords,
      myInvoices: raw.myInvoices ?? raw.totalInvoices ?? totalRecords,
      totalSalesOrders: raw.totalSalesOrders ?? totalRecords,
      mySalesOrders: raw.mySalesOrders ?? raw.totalSalesOrders ?? totalRecords
    };
    return;
  }

  if (ctx.moduleConfig?.statistics?.computeFunction) {
    statistics.value = ctx.moduleConfig.statistics.computeFunction(computeRows, authStore.user?._id, {
      totalRecords
    });
    return;
  }

  if (response.statistics) {
    statistics.value = response.statistics;
  }
}

const EVENTS_DYNAMIC_DATE_FILTER_KEYS = ['startDateTime', 'endDateTime'];

function isEventsDynamicDateSystemView(view) {
  if (!view || props.moduleKey !== 'events') return false;
  if (view.id === 'past' || view.id === 'upcoming') return true;
  const raw = view.config?.filters ?? view.filters ?? {};
  return raw?._special === 'past' || raw?._special === 'upcoming';
}

/**
 * System views (My People, etc.) must scope list GETs when still matched —
 * search keeps view filters intact, so this backfills missing scope keys.
 * When the user clears a view filter (e.g. removes "Assigned to Me") the view
 * is modified; do not re-impose cleared scope keys.
 */
function applyActiveSystemViewScope(normalizedFilters, moduleConfig) {
  const viewId = activeSavedViewId.value;
  if (!viewId || !savedViews.value.length) return normalizedFilters;
  if (!isRegistrySystemView(props.moduleKey, viewId)) return normalizedFilters;

  const activeView = savedViews.value.find((v) => v.id === viewId);
  if (!activeView) return normalizedFilters;

  // Resolve dynamic markers (_special past/upcoming, me → userId, etc.) — never re-merge raw _special.
  const viewFilters = resolveSavedViewFilters(activeView, authStore.user?._id);
  if (!viewFilters || typeof viewFilters !== 'object') return normalizedFilters;

  const currentUserId = authStore.user?._id;
  if (!viewMatchesFilters(activeView, normalizedFilters, currentUserId)) {
    return normalizedFilters;
  }

  const merged = { ...normalizedFilters };
  for (const [key, value] of Object.entries(viewFilters)) {
    if (key === 'filterQuery') continue;
    if (value === undefined || value === '') continue;
    if (Object.prototype.hasOwnProperty.call(normalizedFilters, key)) continue;
    merged[key] = value;
  }
  return merged;
}

/** Filters used for KPI cards: current Filters/search working set minus selected-stat overlays. */
function resolveStatisticsWorkingFilters() {
  return stripFilterKeys(filters.value, resolveStatOverlayKeys(selectedStatKey.value));
}

function isFilterValuePresent(value) {
  return value !== undefined && value !== '';
}

function listQueryHasSelectedStatOverlay(normalizedFilters) {
  const keys = resolveStatOverlayKeys(selectedStatKey.value);
  if (!keys.length) return false;
  return keys.some((key) => isFilterValuePresent(normalizedFilters?.[key]));
}

/**
 * Keys a selected list-stat card adds as a list overlay.
 * Stripped from KPI fetches so sibling cards stay on the Filters/search working set.
 */
function resolveStatOverlayKeys(statKey) {
  if (!statKey) return [];
  switch (props.moduleKey) {
    case 'tasks':
      if (statKey === 'open') return ['open'];
      if (statKey === 'dueToday') return ['dueToday'];
      if (statKey === 'overdue') return ['overdue'];
      if (statKey === 'myTasks') return ['assignedTo'];
      return [];
    case 'sales_orders':
      if (statKey === 'open') return ['open'];
      if (statKey === 'inFulfillment' || statKey === 'completed') return ['status', 'open'];
      if (statKey === 'mySalesOrders') return ['assignedTo'];
      return [];
    case 'invoices':
      if (statKey === 'draft' || statKey === 'pendingApproval' || statKey === 'posted') return ['status'];
      if (statKey === 'myInvoices') return ['assignedTo'];
      return [];
    case 'items':
      if (statKey === 'activeItems' || statKey === 'draftItems' || statKey === 'discontinuedItems') {
        return ['lifecycle_state'];
      }
      if (statKey === 'products' || statKey === 'services') return ['item_type'];
      return [];
    case 'people':
      if (statKey === 'myPeople' || statKey === 'unassigned') return ['assignedTo'];
      if (statKey === 'withOrganization' || statKey === 'withoutOrganization') return ['organization'];
      return [];
    case 'organizations':
      if (statKey === 'myOrganizations' || statKey === 'unassigned') return ['assignedTo'];
      if (statKey === 'activeOrganizations') return ['isActive'];
      if (statKey === 'trialOrganizations') return ['tier'];
      return [];
    case 'events':
      if (statKey === 'myEvents') return ['assignedTo'];
      if (statKey === 'upcoming' || statKey === 'today' || statKey === 'thisWeek') {
        return ['startDateTime', 'endDateTime'];
      }
      return [];
    case 'quotes':
      if (statKey === 'myQuotes') return ['assignedTo'];
      if (statKey === 'acceptedValue') return ['status'];
      return [];
    case 'cases':
      if (statKey === 'open') return ['open'];
      if (statKey === 'unassigned' || statKey === 'myCases') return ['assignedTo'];
      if (statKey === 'slaBreached') return ['slaBreached'];
      return [];
    default:
      return [];
  }
}

/** Stat overlays that never appear as Filters-panel fields. */
function apiOnlyStatOverlayKeys(moduleKey = props.moduleKey) {
  switch (moduleKey) {
    case 'tasks':
      return ['open', 'dueToday', 'overdue'];
    case 'sales_orders':
      return ['open'];
    case 'cases':
      return ['open', 'slaBreached'];
    default:
      return [];
  }
}

function stripFilterKeys(source, keys) {
  const out = { ...(source || {}) };
  for (const key of keys) {
    delete out[key];
  }
  return out;
}

/** Merge a stat overlay onto current Filters without wiping unrelated conditions. */
function buildFiltersWithStatOverlay(nextStatKey, overlayPatch = {}, previousStatKey = selectedStatKey.value) {
  const keysToStrip = new Set([
    ...resolveStatOverlayKeys(previousStatKey),
    ...resolveStatOverlayKeys(nextStatKey),
    ...Object.keys(overlayPatch || {}),
  ]);
  return {
    ...stripFilterKeys(filters.value, keysToStrip),
    ...(overlayPatch || {}),
  };
}

function isTotalStatKey(statKey) {
  return typeof statKey === 'string' && statKey.startsWith('total');
}

/** Shared GET params + endpoint for both replace and append (requestedPage differs). */
function buildListFetchContext(requestedPage, options = {}) {
  const page =
    requestedPage ?? normalizeListPagination(pagination.value).currentPage;
  const sortParams = serializeSortsForApi(
    sorts.value.length
      ? sorts.value
      : sortField.value
        ? [{ field: sortField.value, order: sortOrder.value || 'desc' }]
        : [],
    { field: 'createdAt', order: 'desc' }
  );
  const params = {
    page,
    limit: pagination.value.limit,
    sortBy: sortParams.sortBy,
    sortOrder: sortParams.sortOrder
  };

  const moduleConfig = resolveModuleListConfig(props.moduleKey);
  const filterSource =
    options.filtersOverride !== undefined ? options.filtersOverride : filters.value;
  let normalizedFilters = applyActiveSystemViewScope({ ...filterSource }, moduleConfig);

  if (moduleConfig?.normalizeFilters) {
    normalizedFilters = moduleConfig.normalizeFilters(normalizedFilters, authStore.user?._id);
  }

  // Product-wide: DateFilterValue objects → {field}Preset / {field}Op / … for every module
  normalizedFilters = expandAllDateFilterObjects(normalizedFilters);

  const hasAdvancedFilterQuery = Boolean(
    normalizedFilters.filterQuery && String(normalizedFilters.filterQuery).trim()
  );

  Object.keys(normalizedFilters).forEach((key) => {
    if (key === 'filterQuery') {
      if (hasAdvancedFilterQuery) {
        params.filterQuery = normalizedFilters.filterQuery;
      }
      return;
    }
    if (key === 'participation' || key === 'participationApp' || key === 'participationRole') {
      return;
    }
    if (props.moduleKey === 'people' && (key === 'sales_type' || key === 'helpdesk_role' || key === 'type')) {
      return;
    }

    const value = normalizedFilters[key];
    if (value !== undefined && value !== '') {
      params[key] = value;
    } else if (value === null) {
      // apiClient strips null from query strings; server list handlers expect the literal 'null'.
      params[key] = 'null';
    }
  });

  if (props.moduleKey === 'people') {
    params.appKey = 'PLATFORM';
    const peopleCtx = effectivePeopleContext.value;
    if (peopleCtx && peopleCtx !== 'ALL') {
      params.peopleContext = peopleCtx;
    }
  } else if (
    props.appKey
    && !['reports', 'widgets', 'dashboards'].includes(props.moduleKey)
  ) {
    // Analytics lists are platform-scoped; appKey=PLATFORM would over-filter (e.g. dashboards with null appKey).
    params.appKey = props.appKey;
  }

  const omitSearch = Boolean(options.omitSearch);
  const activeSearchTerm = omitSearch
    ? ''
    : options.searchOverride !== undefined
      ? String(options.searchOverride ?? '').trim()
      : String(searchQuery.value ?? '').trim();

  if (activeSearchTerm) {
    params.search = activeSearchTerm;
  } else if (!omitSearch) {
    const columnSearchTerm = resolveListSearchTerm(
      { filterQuery: params.filterQuery },
      props.moduleKey
    );
    if (columnSearchTerm) {
      params.search = columnSearchTerm;
    }
  }

  const filterSourceForNull =
    options.filtersOverride !== undefined ? options.filtersOverride : filters.value;
  if (params.assignedTo === 'null' && filterSourceForNull?.assignedTo === undefined) {
    delete params.assignedTo;
  }
  if (params.organization === 'null' && filterSourceForNull?.organization === undefined) {
    delete params.organization;
  }

  const isAuditFindingModule =
    String(props.moduleKey || '').toLowerCase() === 'cases' &&
    String(props.appKey || '').toUpperCase() === 'AUDIT';
  const isHelpdeskCasesModule =
    String(props.moduleKey || '').toLowerCase() === 'cases' &&
    String(props.appKey || '').toUpperCase() === 'HELPDESK';
  const endpoint = isAuditFindingModule
    ? '/audit/findings'
    : isHelpdeskCasesModule
      ? '/helpdesk/cases'
      : moduleConfig?.apiEndpoint
        ? moduleConfig.apiEndpoint.startsWith('/')
          ? moduleConfig.apiEndpoint
          : `/${moduleConfig.apiEndpoint}`
        : `/${props.moduleKey}`;

  return {
    params,
    endpoint,
    moduleConfig,
    isAuditFindingModule,
    normalizedFilters
  };
}

function applyClientSideListTransforms(rawRows, ctx) {
  const { isAuditFindingModule, normalizedFilters } = ctx;
  let fetchedData = rawRows || [];

  if (isAuditFindingModule && Array.isArray(fetchedData)) {
    fetchedData = fetchedData.map((row) => {
      if (!row || typeof row !== 'object') return row;
      return {
        ...row,
        subject: row.subject || row.title || ''
      };
    });
  }

  if (props.moduleKey === 'people' && effectivePeopleContext.value && effectivePeopleContext.value !== 'ALL') {
    const ctxApp = effectivePeopleContext.value;
    fetchedData = fetchedData.filter((person) => getParticipation(person, ctxApp) != null);
  }

  if (props.moduleKey === 'people') {
    const salesTypeValues = coerceFilterValuesToArray(normalizedFilters.sales_type ?? normalizedFilters.type);
    const helpdeskRoleValues = coerceFilterValuesToArray(normalizedFilters.helpdesk_role);

    const legacyTypeOnHelpdesk =
      effectivePeopleContext.value === 'HELPDESK' && helpdeskRoleValues.length === 0 ? salesTypeValues : [];

    fetchedData = fetchedData.filter((person) => {
      const salesRole = getParticipation(person, 'SALES')?.role ?? '';
      const helpdeskRole = getParticipation(person, 'HELPDESK')?.role ?? '';

      const matchesSales = includesRoleMatch(salesTypeValues, salesRole);
      const matchesHelpdesk = includesRoleMatch(helpdeskRoleValues, helpdeskRole);
      const matchesLegacyHelpdesk = includesRoleMatch(legacyTypeOnHelpdesk, helpdeskRole);

      if (effectivePeopleContext.value === 'HELPDESK') {
        return matchesHelpdesk && matchesLegacyHelpdesk;
      }
      if (effectivePeopleContext.value === 'SALES') {
        return matchesSales;
      }

      return matchesSales && matchesHelpdesk;
    });
  }

  if (props.moduleKey === 'people' && filters.value.participation) {
    const participationValue = filters.value.participation;
    const participationValues = Array.isArray(participationValue)
      ? participationValue
      : [participationValue];

    if (participationValues.length > 0) {
      const participationFilters = participationValues.map((val) => {
        const [appKey, role] = String(val).split(':');
        return { appKey, role: role || '*' };
      });

      fetchedData = fetchedData.filter((person) =>
        participationFilters.some((filter) => {
          const { appKey, role } = filter;

          const participatesInAppKey = participatesInApp(person, appKey);
          if (!participatesInAppKey) {
            return false;
          }

          if (role === '*') {
            return true;
          }

          if (appKey === 'SALES' && (role === 'Lead' || role === 'Contact')) {
            return getParticipation(person, appKey)?.role === role;
          }

          return true;
        })
      );
    }
  }

  return fetchedData;
}

function applyPaginationFromResponse(response, fetchedRowCountForTotal, requestedPage) {
  const fallback = {
    ...pagination.value,
    currentPage: requestedPage ?? pagination.value.currentPage,
    page: requestedPage ?? pagination.value.page
  };
  const peopleTotalOverride =
    props.moduleKey === 'people' && filters.value.participationApp
      ? fetchedRowCountForTotal
      : undefined;
  const moduleTotalKey = `total${props.moduleKey.charAt(0).toUpperCase() + props.moduleKey.slice(1)}`;

  if (response.pagination) {
    const pag = { ...response.pagination };
    if (peopleTotalOverride != null) {
      pag.total = peopleTotalOverride;
      pag.totalRecords = peopleTotalOverride;
    }
    pagination.value = normalizeListPagination(
      {
        ...pag,
        totalRecords:
          peopleTotalOverride ?? pag.totalRecords ?? pag.total ?? pag[moduleTotalKey]
      },
      fallback,
      { totalRecordsOverride: peopleTotalOverride }
    );
  } else if (response.meta) {
    pagination.value = normalizeListPagination(response.meta, fallback, {
      totalRecordsOverride: peopleTotalOverride
    });
  } else if (response.total != null || response.totalRecords != null || response.totalPages != null) {
    // Legacy list payloads (e.g. older /events shape): top-level total/currentPage/totalPages
    pagination.value = normalizeListPagination(
      {
        currentPage: response.currentPage,
        totalPages: response.totalPages,
        totalRecords: response.totalRecords ?? response.total,
        total: response.total ?? response.totalRecords,
        [moduleTotalKey]: response[moduleTotalKey] ?? response.totalRecords ?? response.total
      },
      fallback,
      { totalRecordsOverride: peopleTotalOverride }
    );
  } else if (typeof fetchedRowCountForTotal === 'number') {
    // Unpaginated list APIs (e.g. inventory locations) — total is the full result set.
    pagination.value = normalizeListPagination(
      {
        currentPage: requestedPage ?? 1,
        page: requestedPage ?? 1,
        totalRecords: peopleTotalOverride ?? fetchedRowCountForTotal,
        total: peopleTotalOverride ?? fetchedRowCountForTotal,
        totalPages: 1,
        hasMore: false
      },
      fallback,
      { totalRecordsOverride: peopleTotalOverride ?? fetchedRowCountForTotal }
    );
  }
}

function totalRecordsFromListResponse(response, fallback = 0) {
  const n = Number(
    response?.pagination?.totalRecords
      ?? response?.pagination?.totalTasks
      ?? response?.pagination?.totalEvents
      ?? response?.pagination?.totalPeople
      ?? response?.pagination?.totalOrganizations
      ?? response?.pagination?.totalDeals
      ?? response?.pagination?.totalItems
      ?? response?.pagination?.totalCases
      ?? response?.pagination?.total
      ?? response?.meta?.totalRecords
      ?? response?.meta?.total
      ?? response?.totalRecords
      ?? response?.total
      ?? fallback
  );
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

async function fetchListStatistics(opts = {}) {
  if (!listDefinition.value) return;
  const moduleConfig = resolveModuleListConfig(props.moduleKey);
  if (!moduleConfig?.statistics && !statsConfig.value.length) return;

  statisticsLoading.value = true;
  try {
    const useWorkingSet = moduleConfig?.statistics?.scope !== 'query';
    const ctx = buildListFetchContext(1, useWorkingSet
      ? {
          filtersOverride: resolveStatisticsWorkingFilters(),
          searchOverride: opts.searchOverride,
        }
      : { searchOverride: opts.searchOverride });
    const params = {
      ...ctx.params,
      page: 1,
      limit: statisticsFetchLimit(ctx.moduleConfig, {
        clientSample: Boolean(opts.clientSample)
      })
    };

    const response = await apiClient.get(ctx.endpoint, {
      params,
      cache: 'no-store'
    });

    if (!response?.success) return;

    const fetchedData = applyClientSideListTransforms(response.data || [], ctx);
    // Stats-only: never clobber list rows or pageSize. Do not fall back to list
    // pagination — that may still include a selected-stat overlay.
    const totalRecords = totalRecordsFromListResponse(response, 0);
    applyListStatisticsFromResponse(response, totalRecords, ctx, fetchedData);
  } catch (error) {
    console.error('[ModuleList] Error fetching statistics:', error);
  } finally {
    statisticsLoading.value = false;
  }
}

async function fetchListReplace(opts = {}) {
  if (!listDefinition.value) return;

  const soft = Boolean(opts.soft);
  const hardClear = Boolean(opts.hardClear);
  const preserveSession = Boolean(opts.preserveSession);

  // Always supersede an in-flight replace — returning the old promise dropped newer filters.
  listDataEpoch.value += 1;
  const epochForThisReplace = listDataEpoch.value;
  const myReplaceSeq = ++replaceSeq;
  replaceAbortController?.abort();
  appendAbortController?.abort();
  appendAbortController = null;

  replaceAbortController = new AbortController();
  const signal = replaceAbortController.signal;

  const ctx = buildListFetchContext(
    normalizeListPagination(pagination.value).currentPage,
    { searchOverride: opts.searchOverride }
  );
  const refreshStats = shouldRefreshStatisticsFromListFetch(ctx);

  dataLoading.value = true;
  if (refreshStats && hardClear) {
    statistics.value = {};
  }
  if (hardClear) {
    data.value = [];
  }

  const run = async () => {
    try {
      const response = await apiClient.get(ctx.endpoint, {
        params: ctx.params,
        signal,
        cache: 'no-store'
      });

      if (listDataEpoch.value !== epochForThisReplace || signal.aborted) return;

      if (response.success) {
        const fetchedData = applyClientSideListTransforms(response.data || [], ctx);

        data.value = [...fetchedData];
        applyPaginationFromResponse(response, fetchedData.length, ctx.params.page);
        const totalRecords = Number(pagination.value.totalRecords ?? 0) || 0;
        if (refreshStats || !Object.keys(statistics.value).length) {
          const hasServerListStats =
            response.listStatistics && typeof response.listStatistics === 'object';
          // Client compute from page rows undercounts when total > page size
          // (e.g. board→list after a 500-row kanban sample).
          const needsClientSample =
            !hasServerListStats
            && Boolean(ctx.moduleConfig?.statistics?.computeFunction)
            && totalRecords > fetchedData.length;

          if (needsClientSample) {
            await fetchListStatistics({
              searchOverride: opts.searchOverride,
              clientSample: true
            });
            if (listDataEpoch.value !== epochForThisReplace || signal.aborted) return;
          } else {
            applyListStatisticsFromResponse(response, totalRecords, ctx, fetchedData);
          }
        } else if (listQueryHasSelectedStatOverlay(ctx.normalizedFilters)) {
          // List is narrowed by a selected card; refresh KPIs from working set only.
          await fetchListStatistics({ searchOverride: opts.searchOverride });
          if (listDataEpoch.value !== epochForThisReplace || signal.aborted) return;
        }
        recordListFingerprintFromState();
      } else {
        console.warn('[ModuleList] API response not successful:', {
          success: response.success,
          response: response
        });
        if (!soft) {
          data.value = [];
          const mc = resolveModuleListConfig(props.moduleKey);
          if (mc?.statistics?.computeFunction) {
            statistics.value = mc.statistics.computeFunction([], authStore.user?._id, { totalRecords: 0 });
          } else {
            statistics.value = {};
          }
        }
      }
    } catch (error) {
      if (signal.aborted) return;
      if (listDataEpoch.value !== epochForThisReplace) return;
      console.error('[ModuleList] Error fetching data:', error);
      if (!soft) {
        data.value = [];
        const moduleConfigErr = resolveModuleListConfig(props.moduleKey);
        if (moduleConfigErr?.statistics?.computeFunction) {
          statistics.value = moduleConfigErr.statistics.computeFunction([], authStore.user?._id, {
            totalRecords: 0
          });
        } else {
          statistics.value = {};
        }
      }
    } finally {
      if (myReplaceSeq === replaceSeq) {
        dataLoading.value = false;
        listInitialFetchComplete.value = true;
        if (preserveSession) {
          bumpSessionRestoreTick();
        }
      }
    }
  };

  const promise = run();
  replaceInFlight = promise;
  try {
    await promise;
  } finally {
    if (replaceInFlight === promise) {
      replaceInFlight = null;
    }
  }
}

/** List GET params for server-side bulk delete (select all matching). */
function buildListQueryForBulkDelete() {
  const ctx = buildListFetchContext(1);
  const params = { ...ctx.params };
  delete params.page;
  delete params.limit;
  if (props.moduleKey === 'people' && effectivePeopleContext.value && effectivePeopleContext.value !== 'ALL') {
    params.peopleContext = effectivePeopleContext.value;
  }
  return params;
}

async function fetchListAppend() {
  if (!listDefinition.value) return;

  if (loadingMore.value || dataLoading.value) return;

  const listPage = normalizeListPagination(pagination.value);
  if (!listPage.hasMore) return;

  const parentEpoch = listDataEpoch.value;
  const myAppendSeq = ++appendSeq;

  appendAbortController?.abort();
  appendAbortController = new AbortController();
  const signal = appendAbortController.signal;

  loadingMore.value = true;

  const requestedPage = listPage.currentPage + 1;

  try {
    const ctx = buildListFetchContext(requestedPage);
    const response = await apiClient.get(ctx.endpoint, {
      params: ctx.params,
      signal,
      cache: 'no-store'
    });

    if (listDataEpoch.value !== parentEpoch) return;
    if (signal.aborted) return;

    if (response.success) {
      const fetchedData = applyClientSideListTransforms(response.data || [], ctx);
      data.value = mergeAppendRowsById(data.value, fetchedData);

      applyPaginationFromResponse(response, fetchedData.length, requestedPage);

      // Do not replace card statistics here: API `statistics` uses different keys than ListView
      // (e.g. totalContacts vs totalPeople), which zeroed the UI. Counts are for the full query
      // and stay valid from the initial replace fetch.
    }
  } catch (error) {
    if (signal.aborted) return;
    if (listDataEpoch.value !== parentEpoch) return;
    console.error('[ModuleList] Error loading more:', error);
  } finally {
    if (myAppendSeq === appendSeq) {
      loadingMore.value = false;
    }
  }
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.append] - load next page
 * @param {boolean} [opts.preserveSession] - keep scroll/page session (no clear)
 * @param {boolean} [opts.soft] - do not empty rows before replace fetch
 * @param {boolean} [opts.reactivate] - tab return: restore pages/scroll only, no refetch
 */
const fetchData = async (opts = {}) => {
  if (opts.append === true) {
    if (!shouldFetchListData()) return;
    return fetchListAppend();
  }
  if (opts.reactivate) {
    await applyListSessionOnActivate();
    bumpSessionRestoreTick();
    return;
  }
  if (!shouldFetchListData()) return;
  if (!opts.preserveSession) {
    clearListSessionState();
  }
  const hardClear = !opts.soft && !opts.preserveSession && !opts.reactivate;
  return fetchListReplace({ ...opts, hardClear });
};

const handleLoadMore = () => {
  fetchData({ append: true });
};

// Handle actions
const handleCreate = () => {
  // Always emit 'create' event to let parent component handle it (e.g., open drawer)
  // Don't navigate to create routes - create actions should use drawers/modals
  emit('create');
};

const handleImport = () => {
  const importAction = listDefinition.value?.primaryActions?.find(a => a.type === 'import');
  if (importAction?.route) {
    handleAction(importAction.route);
  } else {
    emit('import');
  }
};

const handleExport = () => {
  const exportAction = listDefinition.value?.primaryActions?.find(a => a.type === 'export');
  if (exportAction?.route) {
    handleAction(exportAction.route);
  } else {
    emit('export');
  }
};

const handleAction = (route) => {
  if (!route) return;
  const normalizedRoute = String(route || '').trim().toLowerCase();
  const isCreateRoute = /\/new\/?$/.test(normalizedRoute);
  if (isCreateRoute) {
    // Create flows should stay in the current tab so the drawer opens in-place.
    router.push(route);
    return;
  }
  openTab(route, {
    title: route.split('/').pop(),
    background: false,
    insertAdjacent: true
  });
};

// Handle events
const handleSearchQueryUpdate = (query) => {
  const term = String(query ?? '').trim();
  searchQuery.value = term;
  pagination.value.currentPage = 1;
  clearListSessionState();
  emit('search-changed', term);
  if (shouldFetchListData()) {
    fetchData({ searchOverride: term, soft: true });
  } else {
    fetchListStatistics({ searchOverride: term });
  }
};

// Helper function to check if filters match a saved view (with normalization)
// Shared between handleFiltersUpdate and handleStatClick
function filtersMatchView(currentFilters, viewFilters, currentUserId, options = {}) {
  const looseDateKeys = new Set(options.looseDateKeys || []);

  // Get filter keys for both - include null and boolean values as they are valid filter values
  const viewFilterKeys = Object.keys(viewFilters).filter(k => {
    const v = viewFilters[k];
    return v !== undefined && v !== '';
  });
  const currentFilterKeys = Object.keys(currentFilters).filter(k => {
    const v = currentFilters[k];
    return v !== undefined && v !== '';
  });

  // Must have same number of filters
  if (viewFilterKeys.length !== currentFilterKeys.length) {
    return false;
  }

  // Must have the same filter keys
  const viewKeysSet = new Set(viewFilterKeys);
  const currentKeysSet = new Set(currentFilterKeys);
  if (viewKeysSet.size !== currentKeysSet.size) {
    return false;
  }
  // Check that all keys match
  for (const key of viewKeysSet) {
    if (!currentKeysSet.has(key)) {
      return false;
    }
  }

  // Check if all filter values match (with normalization for assignedTo)
  return viewFilterKeys.every(key => {
    const viewValue = viewFilters[key];
    const currentValue = currentFilters[key];

    // Dynamic date system views regenerate ISO bounds — presence is enough
    if (looseDateKeys.has(key)) {
      return Boolean(viewValue) && Boolean(currentValue);
    }

    // Normalize assignedTo for comparison
    // 'me' should match currentUserId
    // 'unassigned' should match null
    if (key === 'assignedTo') {
      // Normalize 'me' to currentUserId for comparison
      if (currentValue === 'me' && viewValue === currentUserId) {
        return true;
      }
      // Normalize 'unassigned' to null for comparison
      if (currentValue === 'unassigned' && viewValue === null) {
        return true;
      }
      // Normalize currentUserId to 'me' for comparison (reverse)
      if (currentValue === currentUserId && viewValue === 'me') {
        return true;
      }
      // Normalize null to 'unassigned' for comparison (reverse)
      if (currentValue === null && viewValue === 'unassigned') {
        return true;
      }
    }

    // Handle null comparison - null is a valid filter value
    if (viewValue === null) {
      return currentValue === null;
    }
    if (currentValue === null) {
      return viewValue === null;
    }

    // Handle boolean comparison - boolean values should be compared directly
    if (typeof viewValue === 'boolean' || typeof currentValue === 'boolean') {
      return viewValue === currentValue;
    }

    // String comparison for non-null, non-boolean values
    return String(viewValue) === String(currentValue);
  });
}

function viewMatchesFilters(view, currentFilters, currentUserId) {
  if (!view) return false;

  if (currentFilters.filterQuery && view.config?.filterQuery) {
    const savedFilterQuery = typeof view.config.filterQuery === 'string'
      ? view.config.filterQuery
      : JSON.stringify(view.config.filterQuery);
    const incomingFilterQuery = typeof currentFilters.filterQuery === 'string'
      ? currentFilters.filterQuery
      : JSON.stringify(currentFilters.filterQuery);
    return savedFilterQuery === incomingFilterQuery;
  }

  // Use resolved filters (expands _special) so Past/Upcoming stay matched after refetch
  const viewFilters = resolveSavedViewFilters(view, currentUserId);
  return filtersMatchView(currentFilters, viewFilters, currentUserId, {
    looseDateKeys: isEventsDynamicDateSystemView(view) ? EVENTS_DYNAMIC_DATE_FILTER_KEYS : [],
  });
}

const handleFiltersUpdate = async (newFilters, options = {}) => {
  // Clean up old participation filter keys if they exist (migration from old format)
  if (props.moduleKey === 'people') {
    // Remove old participationApp and participationRole filters if new participation filter exists
    if (newFilters.participation) {
      delete newFilters.participationApp;
      delete newFilters.participationRole;
    }
  }

  if (!options.fromStatClick) {
    selectedStatKey.value = null;
    // API-only stat overlays are not Filters-panel fields — drop them when Filters drive the change.
    for (const key of apiOnlyStatOverlayKeys(props.moduleKey)) {
      delete newFilters[key];
    }
  }

  const prevSignature = filtersPayloadSignature(filters.value);
  const nextSignature = filtersPayloadSignature(newFilters);
  const filtersChanged = prevSignature !== nextSignature;

  // Create a new object to ensure reactivity
  filters.value = { ...newFilters };

  if (filtersChanged || options.forceFetch) {
    pagination.value.currentPage = 1;
    pagination.value.totalRecords = 0;
    pagination.value.total = 0;
    pagination.value.totalPages = 0;
    clearListSessionState();
    emit('filters-changed', filters.value);
    if (shouldFetchListData()) {
      fetchData();
    } else if (filtersChanged || options.forceFetch) {
      fetchListStatistics();
    }
  }

  // Wait for next tick to ensure filters are properly set before checking saved views
  await nextTick();
  
  // Handle saved view state for all modules (registry config or default views)
  // All modules get default system views via getSystemViews, so always handle saved view state
  const moduleConfig = resolveModuleListConfig(props.moduleKey);
  const currentUserId = authStore.user?._id;
  
  // Only handle saved view state if module has system views (from registry or generated)
  if (savedViews.value.length > 0 && !options.preserveActiveView) {
    
    // Check if filters are empty (all cleared)
    // Include null values - they are valid filter values (e.g., organization: null)
    // Boolean true/false are also valid filter values
    const hasAnyFilters = Object.keys(newFilters).some(key => {
      const value = newFilters[key];
      return value !== undefined && value !== '';
    });
    
    if (!hasAnyFilters) {
      const activeView = activeSavedViewId.value
        ? savedViews.value.find((v) => v.id === activeSavedViewId.value)
        : null;
      const isCustomSavedView = Boolean(
        activeView?.id?.startsWith('custom-') || activeView?.config
      );
      if (!isCustomSavedView) {
        if (props.moduleKey === 'people') {
          activeSavedViewId.value = peopleEmptyFilterViewId(effectivePeopleContext.value);
        } else {
          activeSavedViewId.value = 'all';
        }
      }
    } else {
      // Check if current filters match any saved view
      // First check the active view, then check all views
      let matchedView = null;
      
      if (activeSavedViewId.value) {
        const activeView = savedViews.value.find(v => v.id === activeSavedViewId.value);
        if (viewMatchesFilters(activeView, newFilters, currentUserId)) {
          matchedView = activeView;
        }
      }
      
      // If active view doesn't match, check all views
      if (!matchedView) {
        matchedView = savedViews.value.find((view) => viewMatchesFilters(view, newFilters, currentUserId));
      }
      
      if (matchedView) {
        activeSavedViewId.value = matchedView.id;
      }
      // Keep activeSavedViewId when unmatched so the UI can show modified view state.
    }
  }
};

// Handle stat click - overlay on current Filters; KPIs stay on working set.
const handleStatClick = (statItem) => {
  const moduleConfig = resolveModuleListConfig(props.moduleKey);
  if (!moduleConfig) return;

  const nextKey = statItem?.key || null;
  const previousKey = selectedStatKey.value;

  // Toggle off a non-total card → clear overlay, keep Filters/search working set.
  if (
    nextKey
    && nextKey === previousKey
    && !isTotalStatKey(nextKey)
  ) {
    const totalKey =
      (localizedStatsConfig.value || []).find((stat) => isTotalStatKey(stat.key))?.key
      || null;
    const cleared = buildFiltersWithStatOverlay(totalKey, {}, previousKey);
    selectedStatKey.value = totalKey;
    handleFiltersUpdate(cleared, {
      fromStatClick: true,
      preserveActiveView: true,
    });
    return;
  }

  const keepMyScope = (viewId) =>
    activeSavedViewId.value === viewId || filters.value?.assignedTo === 'me';

  let newFilters = {};

  if (props.moduleKey === 'people') {
    const myScope = keepMyScope('assigned-to-me');
    switch (nextKey) {
      case 'totalPeople':
        newFilters = buildFiltersWithStatOverlay(nextKey, {}, previousKey);
        break;
      case 'myPeople':
        newFilters = buildFiltersWithStatOverlay(nextKey, { assignedTo: 'me' }, previousKey);
        break;
      case 'unassigned':
        newFilters = buildFiltersWithStatOverlay(nextKey, { assignedTo: 'unassigned' }, previousKey);
        break;
      case 'withOrganization':
        newFilters = buildFiltersWithStatOverlay(nextKey, {
          ...(myScope ? { assignedTo: 'me' } : {}),
          organization: 'has',
        }, previousKey);
        break;
      case 'withoutOrganization':
        newFilters = buildFiltersWithStatOverlay(nextKey, {
          ...(myScope ? { assignedTo: 'me' } : {}),
          organization: null,
        }, previousKey);
        break;
      default:
        newFilters = buildFiltersWithStatOverlay(nextKey, {}, previousKey);
        break;
    }
  } else if (props.moduleKey === 'organizations') {
    const myScope = keepMyScope('assigned-to-me');
    switch (nextKey) {
      case 'totalOrganizations':
        newFilters = buildFiltersWithStatOverlay(nextKey, {}, previousKey);
        break;
      case 'myOrganizations':
        newFilters = buildFiltersWithStatOverlay(nextKey, { assignedTo: 'me' }, previousKey);
        break;
      case 'unassigned':
        newFilters = buildFiltersWithStatOverlay(nextKey, { assignedTo: 'unassigned' }, previousKey);
        break;
      case 'activeOrganizations':
        newFilters = buildFiltersWithStatOverlay(nextKey, {
          ...(myScope ? { assignedTo: 'me' } : {}),
          isActive: true,
        }, previousKey);
        break;
      case 'trialOrganizations':
        newFilters = buildFiltersWithStatOverlay(nextKey, {
          ...(myScope ? { assignedTo: 'me' } : {}),
          tier: 'trial',
        }, previousKey);
        break;
      default:
        newFilters = buildFiltersWithStatOverlay(nextKey, {}, previousKey);
        break;
    }
  } else if (props.moduleKey === 'tasks') {
    switch (nextKey) {
      case 'totalTasks':
        newFilters = buildFiltersWithStatOverlay(nextKey, {}, previousKey);
        break;
      case 'myTasks':
        newFilters = buildFiltersWithStatOverlay(nextKey, { assignedTo: 'me' }, previousKey);
        break;
      case 'open':
        newFilters = buildFiltersWithStatOverlay(nextKey, { open: true }, previousKey);
        break;
      case 'dueToday':
        newFilters = buildFiltersWithStatOverlay(nextKey, { dueToday: true }, previousKey);
        break;
      case 'overdue':
        newFilters = buildFiltersWithStatOverlay(nextKey, { overdue: true }, previousKey);
        break;
      default:
        newFilters = buildFiltersWithStatOverlay(nextKey, {}, previousKey);
        break;
    }
  } else if (props.moduleKey === 'items') {
    switch (nextKey) {
      case 'totalItems':
        newFilters = buildFiltersWithStatOverlay(nextKey, {}, previousKey);
        break;
      case 'activeItems':
        newFilters = buildFiltersWithStatOverlay(nextKey, { lifecycle_state: 'Active' }, previousKey);
        break;
      case 'draftItems':
        newFilters = buildFiltersWithStatOverlay(nextKey, { lifecycle_state: 'Draft' }, previousKey);
        break;
      case 'discontinuedItems':
        newFilters = buildFiltersWithStatOverlay(nextKey, { lifecycle_state: 'Discontinued' }, previousKey);
        break;
      case 'products':
        newFilters = buildFiltersWithStatOverlay(nextKey, { item_type: 'Product' }, previousKey);
        break;
      case 'services':
        newFilters = buildFiltersWithStatOverlay(nextKey, { item_type: 'Service' }, previousKey);
        break;
      default:
        newFilters = buildFiltersWithStatOverlay(nextKey, {}, previousKey);
        break;
    }
  } else if (props.moduleKey === 'events') {
    const myScope = keepMyScope('my-events');
    switch (nextKey) {
      case 'totalEvents':
        newFilters = buildFiltersWithStatOverlay(nextKey, {}, previousKey);
        break;
      case 'myEvents':
        newFilters = buildFiltersWithStatOverlay(nextKey, { assignedTo: 'me' }, previousKey);
        break;
      case 'upcoming':
        newFilters = buildFiltersWithStatOverlay(nextKey, {
          ...(myScope ? { assignedTo: 'me' } : {}),
          startDateTime: new Date().toISOString(),
        }, previousKey);
        break;
      case 'today': {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        newFilters = buildFiltersWithStatOverlay(nextKey, {
          ...(myScope ? { assignedTo: 'me' } : {}),
          startDateTime: today.toISOString(),
          endDateTime: tomorrow.toISOString(),
        }, previousKey);
        break;
      }
      case 'thisWeek': {
        const nowWeek = new Date();
        const startOfWeek = new Date(nowWeek);
        startOfWeek.setDate(nowWeek.getDate() - nowWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        newFilters = buildFiltersWithStatOverlay(nextKey, {
          ...(myScope ? { assignedTo: 'me' } : {}),
          startDateTime: startOfWeek.toISOString(),
          endDateTime: endOfWeek.toISOString(),
        }, previousKey);
        break;
      }
      default:
        newFilters = buildFiltersWithStatOverlay(nextKey, {}, previousKey);
        break;
    }
  } else if (props.moduleKey === 'quotes') {
    const myScope = keepMyScope('my-quotes');
    switch (nextKey) {
      case 'totalQuotes':
        newFilters = buildFiltersWithStatOverlay(nextKey, {}, previousKey);
        break;
      case 'myQuotes':
        newFilters = buildFiltersWithStatOverlay(nextKey, { assignedTo: 'me' }, previousKey);
        break;
      case 'openValue':
      case 'openQuotes':
        newFilters = buildFiltersWithStatOverlay(nextKey, {
          ...(myScope ? { assignedTo: 'me' } : {}),
        }, previousKey);
        break;
      case 'acceptedValue':
        newFilters = buildFiltersWithStatOverlay(nextKey, {
          ...(myScope ? { assignedTo: 'me' } : {}),
          status: 'Accepted',
        }, previousKey);
        break;
      default:
        newFilters = buildFiltersWithStatOverlay(nextKey, {}, previousKey);
        break;
    }
  } else if (props.moduleKey === 'sales_orders') {
    const myScope = keepMyScope('my-orders');
    switch (nextKey) {
      case 'totalSalesOrders':
        newFilters = buildFiltersWithStatOverlay(nextKey, {}, previousKey);
        break;
      case 'mySalesOrders':
        newFilters = buildFiltersWithStatOverlay(nextKey, { assignedTo: 'me' }, previousKey);
        break;
      case 'open':
        newFilters = buildFiltersWithStatOverlay(nextKey, {
          ...(myScope ? { assignedTo: 'me' } : {}),
          open: true,
        }, previousKey);
        break;
      case 'inFulfillment':
        newFilters = buildFiltersWithStatOverlay(nextKey, {
          ...(myScope ? { assignedTo: 'me' } : {}),
          status: 'In Fulfillment',
        }, previousKey);
        break;
      case 'completed':
        newFilters = buildFiltersWithStatOverlay(nextKey, {
          ...(myScope ? { assignedTo: 'me' } : {}),
          status: 'Fulfilled',
        }, previousKey);
        break;
      default:
        newFilters = buildFiltersWithStatOverlay(nextKey, {}, previousKey);
        break;
    }
  } else if (props.moduleKey === 'invoices') {
    const myScope = keepMyScope('my-invoices');
    switch (nextKey) {
      case 'totalInvoices':
        newFilters = buildFiltersWithStatOverlay(nextKey, {}, previousKey);
        break;
      case 'myInvoices':
        newFilters = buildFiltersWithStatOverlay(nextKey, { assignedTo: 'me' }, previousKey);
        break;
      case 'draft':
        newFilters = buildFiltersWithStatOverlay(nextKey, {
          ...(myScope ? { assignedTo: 'me' } : {}),
          status: 'Draft',
        }, previousKey);
        break;
      case 'pendingApproval':
        newFilters = buildFiltersWithStatOverlay(nextKey, {
          ...(myScope ? { assignedTo: 'me' } : {}),
          status: 'Pending Approval',
        }, previousKey);
        break;
      case 'posted':
        newFilters = buildFiltersWithStatOverlay(nextKey, {
          ...(myScope ? { assignedTo: 'me' } : {}),
          status: 'Posted',
        }, previousKey);
        break;
      default:
        newFilters = buildFiltersWithStatOverlay(nextKey, {}, previousKey);
        break;
    }
  } else if (props.moduleKey === 'cases') {
    switch (nextKey) {
      case 'totalCases':
        newFilters = buildFiltersWithStatOverlay(nextKey, {}, previousKey);
        break;
      case 'myCases':
        newFilters = buildFiltersWithStatOverlay(nextKey, { assignedTo: 'me' }, previousKey);
        break;
      case 'open':
        newFilters = buildFiltersWithStatOverlay(nextKey, { open: true }, previousKey);
        break;
      case 'unassigned':
        newFilters = buildFiltersWithStatOverlay(nextKey, { assignedTo: 'unassigned' }, previousKey);
        break;
      case 'slaBreached':
        newFilters = buildFiltersWithStatOverlay(nextKey, { slaBreached: true }, previousKey);
        break;
      default:
        newFilters = buildFiltersWithStatOverlay(nextKey, {}, previousKey);
        break;
    }
  }

  selectedStatKey.value = nextKey;
  handleFiltersUpdate(newFilters, { fromStatClick: true, preserveActiveView: true });
};

function formatSystemViewsForList(systemViews) {
  return systemViews.map((view) => ({
    id: view.id,
    label: view.name,
    filters: view.filters,
    isDefault: view.isDefault === true,
    peopleContext: view.peopleContext,
  }));
}

function resolveSavedViewFilters(view, currentUserId) {
  if (!view) return {};

  const config = view.config;
  let viewFilters = {};

  if (config?.filterQuery) {
    viewFilters = {
      filterQuery: typeof config.filterQuery === 'string'
        ? config.filterQuery
        : JSON.stringify(config.filterQuery),
    };
  } else if (config?.filters && Object.keys(config.filters).length > 0) {
    viewFilters = { ...config.filters };
  } else if (view.filters) {
    viewFilters = { ...view.filters };
  }

  if (props.moduleKey === 'events') {
    viewFilters = expandEventsSpecialViewFilters(viewFilters, view.id);
  }

  const moduleConfig = resolveModuleListConfig(props.moduleKey);
  return moduleConfig?.normalizeViewFilters
    ? moduleConfig.normalizeViewFilters(viewFilters, currentUserId)
    : viewFilters;
}

// Handle saved views updated (custom views changed)
const handleSavedViewsUpdated = async (customViews) => {
  const moduleLabel = listDefinition.value?.title
    || props.moduleKey.charAt(0).toUpperCase() + props.moduleKey.slice(1);
  const systemViews = getSystemViews(
    props.moduleKey,
    moduleLabel,
    authStore.user?._id,
    moduleListConfigOptions.value
  );

  savedViews.value = [...formatSystemViewsForList(systemViews), ...customViews];

  await persistCustomSavedViews(props.moduleKey, authStore.user?._id, customViews);
};

// Handle saved view selection
const handleSavedViewSelected = async (view) => {
  const prevContext = effectivePeopleContext.value;
  activeSavedViewId.value = view?.id || null;

  if (!view) {
    handleFiltersUpdate({});
    return;
  }

  const nextContext = resolveViewPeopleContext(view);
  if (props.moduleKey === 'people' && prevContext !== nextContext) {
    await rebuildPeopleListColumns();
    emit('people-context-changed', nextContext);
  }

  handleFiltersUpdate(resolveSavedViewFilters(view, authStore.user?._id), { preserveActiveView: true });
};

const handleSetDefaultView = (viewId) => {
  if (!viewId || !hasModuleListConfig(props.moduleKey)) return;
  const defaultViewStorageKey = `arivu-listview-${props.moduleKey}-default-view`;
  try {
    localStorage.setItem(defaultViewStorageKey, viewId);
    defaultViewId.value = viewId;
  } catch (error) {
    console.warn('[ModuleList] Failed to save default view:', error);
  }
};

const handleSortUpdate = ({ sortField: key, sortOrder: order, sorts: nextSorts }) => {
  if (Array.isArray(nextSorts)) {
    setListSorts(nextSorts, { field: key || '', order: order || 'desc' });
  } else if (key) {
    setListSorts([{ field: key, order: order === 'asc' ? 'asc' : 'desc' }]);
  } else {
    setListSorts([]);
  }
  pagination.value.currentPage = 1;
  clearListSessionState();
  fetchData();
};

watch(
  () => data.value.length,
  async (len, prevLen) => {
    if (len > 0 && pendingListSessionRestore.value) {
      await restoreListSessionPages();
      return;
    }
    if (len > 0 && prevLen === 0 && getListSession(listSessionKey.value)) {
      await restoreListSessionAfterFetch();
    }
  }
);

const handlePaginationUpdate = (p) => {
  pagination.value.currentPage = p.currentPage;
  if (p.limit) {
    pagination.value.limit = p.limit;
  }
  fetchData();
};

const handleRowClick = (row) => {
  const viewAction = listDefinition.value?.rowActions?.find(a => a.type === 'view');
  if (viewAction?.route) {
    let route = viewAction.route.replace(':id', row._id);
    const mod = (props.moduleKey || '').toLowerCase();
    const ak = props.appKey && String(props.appKey).trim();
    if (ak && (mod === 'people' || mod === 'organizations')) {
      const sep = route.includes('?') ? '&' : '?';
      route = `${route}${sep}appKey=${encodeURIComponent(ak)}`;
    }
    openTab(route, {
      title: row.name || row.title || row.first_name || 'Detail',
      background: false,
      insertAdjacent: true
    });
  } else {
    emit('row-click', row);
  }
};

const handleEdit = (row) => {
  // For tasks, always emit 'edit' so parent can open the edit drawer
  if (props.moduleKey === 'tasks') {
    emit('edit', row);
    return;
  }
  const editAction = listDefinition.value?.rowActions?.find(a => a.type === 'edit');
  if (editAction?.route) {
    const route = editAction.route.replace(':id', row._id);
    openTab(route, {
      title: `Edit ${row.name || row.title || 'Item'}`,
      background: false,
      insertAdjacent: true
    });
  } else {
    emit('edit', row);
  }
};

function listDeleteApiBase() {
  return getModuleRecordCrudPathBase(props.moduleKey, {
    appKey: props.appKey,
    routePath: String(route.path || '')
  });
}

function isBulkSelectionPayload(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && 'mode' in value;
}

function rowsFromIds(ids) {
  return ids.map((id) => ({ _id: id }));
}

const handleDelete = async (row) => {
  if (parentHandlesDelete) {
    emit('delete', row);
    return;
  }

  const rowId = row?._id || row?.id || row;
  if (!rowId || !props.moduleKey) return;

  try {
    await apiClient.delete(`${listDeleteApiBase()}/${rowId}`);
    await fetchData();
  } catch (error) {
    console.error(`[ModuleList] Failed to delete ${props.moduleKey} record:`, error);
    const errorMessage = error?.response?.data?.message || error?.message || 'Delete failed';
    notifications.error(errorMessage);
  }
};

function buildListQueryForBulkOperations() {
  return buildListQueryForBulkDelete();
}

const handleBulkAction = async (action, payloadOrRows) => {
  const isDeleteAction = action === 'bulk-delete' || action === 'delete';
  const isMassEditAction = action === 'mass-edit';

  if (isMassEditAction) {
    const payload = isBulkSelectionPayload(payloadOrRows) ? payloadOrRows : null;
    const updates = payload?.updates && typeof payload.updates === 'object' ? payload.updates : null;
    if (!updates || Object.keys(updates).length === 0) {
      notifications.warning(t('common.massEditSelectFieldHint'));
      return;
    }

    startBulkUpdate({
      moduleKey: props.moduleKey,
      updates,
      selection: payload,
      pageIds: !payload && Array.isArray(payloadOrRows)
        ? payloadOrRows.map((r) => String(r?._id || r?.id || r?.eventId || r)).filter(Boolean)
        : null,
      listQuery: buildListQueryForBulkOperations(),
      options: { appKey: props.appKey, routePath: String(route.path || '') },
      onComplete: (outcome) => {
        void (async () => {
          if (outcome.cancelled) {
            if (outcome.updatedCount > 0) await fetchData();
            return;
          }
          const {
            updatedCount,
            skippedCount,
            failedCount,
            firstError,
            requestedCount,
          } = outcome;
          const totalAttempted = updatedCount + skippedCount + failedCount;
          const hadSelection = Number(requestedCount || 0) > 0;

          if (!props.moduleKey || (totalAttempted === 0 && !hadSelection)) {
            notifications.warning(t('common.massEditNoSelection'));
            return;
          }
          if (totalAttempted === 0 && hadSelection) {
            notifications.error(t('common.massEditNoMatches'));
            return;
          }
          if (failedCount > 0) {
            const errorMessage =
              firstError?.response?.data?.message ||
              firstError?.message ||
              t('common.massEditFailed');
            notifications.warning(failedCount === totalAttempted
                ? errorMessage
                : t('common.massEditPartialFailed', { failed: failedCount, total: totalAttempted, message: errorMessage }));
            if (updatedCount > 0) await fetchData();
            return;
          }
          if (skippedCount > 0) {
            notifications.warning(t('common.massEditPartialSkipped', { updated: updatedCount, skipped: skippedCount }));
          }
          await fetchData();
        })();
      },
      onError: (error) => {
        const errorMessage =
          error?.response?.data?.message ||
          error?.message ||
          t('common.massEditFailed');
        notifications.error(errorMessage);
      },
    });
    return;
  }

  if (isDeleteAction) {
    startBulkDelete({
      moduleKey: props.moduleKey,
      selection: isBulkSelectionPayload(payloadOrRows) ? payloadOrRows : null,
      pageIds: Array.isArray(payloadOrRows)
        ? payloadOrRows.map((r) => String(r?._id || r?.id || r?.eventId || r)).filter(Boolean)
        : null,
      listQuery: buildListQueryForBulkDelete(),
      options: { appKey: props.appKey, routePath: String(route.path || '') },
      onComplete: (outcome) => {
        void (async () => {
          if (outcome.cancelled) {
            if (outcome.deletedCount > 0) await fetchData();
            return;
          }
          const { deletedCount, failedCount, firstError, requestedCount } = outcome;
          const totalAttempted = deletedCount + failedCount;
          const hadSelection = Number(requestedCount || 0) > 0;
          if (!props.moduleKey || (totalAttempted === 0 && !hadSelection)) {
            notifications.warning(t('common.listBulkDeleteNoSelection'));
            return;
          }
          if (totalAttempted === 0 && hadSelection) {
            notifications.warning(t('common.listBulkDeleteNoMatches') ||
              'No records matched your selection for deletion. Refresh the list and try again.');
            return;
          }
          if (requestedCount > 0 && deletedCount + failedCount < requestedCount) {
            notifications.warning(t('common.listBulkDeleteIncomplete', {
                deleted: deletedCount,
                total: requestedCount
              }) ||
              `Deleted ${deletedCount} of ${requestedCount} selected records. Refresh the list or retry.`);
          }
          if (failedCount > 0) {
            const errorMessage =
              firstError?.response?.data?.message ||
              firstError?.message ||
              'Bulk delete failed';
            console.error(`[ModuleList] Failed bulk delete for ${props.moduleKey}:`, firstError);
            notifications.error(failedCount === totalAttempted
                ? errorMessage
                : `Failed to delete ${failedCount} of ${totalAttempted} records. ${errorMessage}`);
            if (deletedCount > 0) await fetchData();
            return;
          }
          await fetchData();
        })();
      },
    });
    return;
  }

  if (parentHandlesBulkAction) {
    if (isBulkSelectionPayload(payloadOrRows) && payloadOrRows.mode === 'page') {
      emit('bulk-action', action, rowsFromIds(payloadOrRows.selectedIds || []));
    } else {
      emit('bulk-action', action, payloadOrRows);
    }
    return;
  }

  emit('bulk-action', action, payloadOrRows);
};

// Only rebuild when login state or user identity changes — not on every reactive touch of authStore.user
watch(
  () => (authStore.isAuthenticated ? (authStore.user?._id ?? '') : ''),
  (userId) => {
    if (userId && authStore.user && authStore.isAuthenticated) {
      buildList();
    }
  },
  { immediate: true }
);

// Watch for moduleKey/appKey changes
watch(() => [props.moduleKey, props.appKey], () => {
  if (authStore.user && authStore.isAuthenticated) {
    listInitialFetchComplete.value = false;
    data.value = [];
    buildList();
  }
});

// Fetch list rows when parent switches from kanban/calendar back to list view
watch(
  () => props.viewMode,
  (mode, prevMode) => {
    if (!listDefinition.value || prevMode == null) return;
    const toList = shouldFetchListDataForMode(mode);
    const fromList = shouldFetchListDataForMode(prevMode);
    if (toList && !fromList) {
      scheduleInitialListFetch();
    } else if (!toList && fromList) {
      scheduleInitialStatisticsFetch();
    }
  }
);

// Persist active saved view to localStorage
watch(() => activeSavedViewId.value, (newValue) => {
  saveActiveSavedViewId(props.moduleKey, authStore.user?._id, newValue);
});

// Initial build is handled by auth user watcher (immediate: true) — no duplicate buildList() on mount

// Expose methods and data for parent components
defineExpose({
  refresh: fetchData,
  refreshAfterImport: refreshListAfterImport,
  /** Tab return via keep-alive: restore lazy-loaded pages + scroll without refetching page 1 */
  reactivate: () => fetchData({ reactivate: true }),
  filters: filters,
  searchQuery: searchQuery,
  getFilters: () => filters.value,
  getSearchQuery: () => searchQuery.value,
  getCurrentRows: () => (Array.isArray(data.value) ? data.value : []),
  setFilters: (newFilters) => handleFiltersUpdate(newFilters),
  getPeopleContext: () => effectivePeopleContext.value,
});
</script>

