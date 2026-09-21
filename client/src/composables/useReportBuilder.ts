import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAnalyticsReports } from '@/composables/useAnalyticsReports';
import { useAnalyticsHome } from '@/composables/useAnalyticsHome';
import { useAnalyticsSchedules } from '@/composables/useAnalyticsSchedules';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import {
  captureAnalyticsReportCreated,
  captureAnalyticsReportPublished,
} from '@/config/posthogAnalytics';
// @ts-expect-error JS module without declaration file
import { hydrateFilterBuilderFromAst } from '@/utils/marketingAudienceFilterConfig';
import type { ReportFilterState } from '@/components/analytics/ReportFilterSection.vue';
import {
  buildAnalyticsFilterConfigByKey,
  buildAnalyticsFilterTree,
} from '@/utils/analyticsFilterConfig';
import type { AnalyticsCatalogModule } from '@/composables/useAnalyticsReports';
import type {
  AnalyticsReportPermissions,
  AnalyticsScheduleRecord,
  AnalyticsShareTarget,
  AnalyticsVisibility,
} from '@/types/analytics.types';
import type { FilterGroupNode } from '@/platform/filters/filterQueryAst';
import {
  isFilterRuleActive,
  resolveActiveFilterChipLabel,
} from '@/platform/filters/filterQueryCompiler';
import type { FilterOperatorId } from '@/platform/filters/filterOperators';
import {
  getMissingShareTargetType,
  shareValidationMessageKey,
} from '@/components/analytics/report-builder/reportShareValidation';

export const DEFAULT_REPORT_PERMISSIONS: AnalyticsReportPermissions = {
  view: 'viewers',
  edit: 'editors',
  clone: 'viewers',
  export: 'viewers',
  share: 'owner',
};

export interface ReportBuilderScheduleForm {
  enabled: boolean;
  frequency: string;
  timezone: string;
  hour: number;
  minute: number;
  dayOfWeek: number;
  dayOfMonth: number;
  exportFormats: string[];
  startDate: string;
  endDate: string;
  recipientsText: string;
  sendCopyToOwner: boolean;
}

export const REPORT_BUILDER_STEPS = [
  'selectModule',
  'selectFields',
  'addFilters',
  'groupAggregate',
  'preview',
  'savePublish',
] as const;

export const REPORT_BUILDER_PREVIEW_STEP = 4;
export const REPORT_BUILDER_SAVE_STEP = 5;

export type ReportBuilderStepId = (typeof REPORT_BUILDER_STEPS)[number];

export const POPULAR_MODULE_KEYS = [
  'deals',
  'people',
  'organizations',
  'cases',
  'quotes',
  'tasks',
  'events',
  'items',
  'sales_orders',
  'invoices',
  'payments',
  'documents',
] as const;

export interface ReportBuilderMetric {
  fn: string;
  field: string;
  label: string;
}

export interface ReportBuilderSortEntry {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ReportBuilderFieldOption {
  key: string;
  label: string;
  type?: string;
  moduleKey?: string;
  filterable?: boolean;
  options?: Array<{ value: string; label: string }>;
}

const AGGREGATION_FNS = ['count', 'sum', 'avg', 'min', 'max'];

export function useReportBuilder(reportId?: string | null) {
  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();

  const {
    catalogModules,
    previewResult,
    saving,
    executing,
    fetchCatalog,
    fetchReport,
    createReport,
    updateReport,
    publishReport,
    previewReport,
    previewMatrixDrill,
  } = useAnalyticsReports();
  const { folders, fetchFolders, fetchHome, toggleFavorite, isFavorite } = useAnalyticsHome();
  const { createSchedule, fetchSchedules, updateSchedule, deleteSchedule } = useAnalyticsSchedules();
  const authStore = useAuthStore();
  const { success: notifySuccess, error: notifyError } = useNotifications();

  const currentStep = ref(0);
  const autoPreview = ref(false);
  const filterRemountToken = ref(0);
  const loadedReportStatus = ref<string | null>(null);
  const scheduleIdsByFormat = ref<Record<string, string>>({});
  const isHydratingReport = ref(false);
  const reportHydrationDone = ref(false);
  let previewTimer: ReturnType<typeof setTimeout> | null = null;

  const isNew = computed(
    () => !reportId && route.name === 'analytics-report-create',
  );

  const form = reactive({
    name: '',
    apiName: '',
    description: '',
    primaryModule: 'deals',
    type: 'tabular',
    folderId: '',
    tags: [] as string[],
    visibility: 'private' as AnalyticsVisibility,
    sharedWith: [] as AnalyticsShareTarget[],
    cacheEnabled: true,
    cacheDuration: 15,
    runtimeFilters: false,
    permissions: { ...DEFAULT_REPORT_PERMISSIONS } as AnalyticsReportPermissions,
    listedInHome: true,
    addToFavorites: false,
    drillDownEnabled: true,
  });

  const scheduleForm = reactive<ReportBuilderScheduleForm>({
    enabled: false,
    frequency: 'weekly',
    timezone: 'UTC',
    hour: 9,
    minute: 0,
    dayOfWeek: 1,
    dayOfMonth: 1,
    exportFormats: ['csv'],
    startDate: '',
    endDate: '',
    recipientsText: '',
    sendCopyToOwner: true,
  });

  const groupByField = ref('stage');
  const metrics = ref<ReportBuilderMetric[]>([
    { fn: 'count', field: '_id', label: 'count' },
  ]);
  const selectedFields = ref<string[]>([]);
  const relatedModules = ref<string[]>([]);
  const rowGroups = ref<string[]>([]);
  const columnGroups = ref<string[]>([]);
  const sorting = ref<ReportBuilderSortEntry[]>([]);
  const showGrandTotal = ref(true);
  const showSubTotals = ref(true);
  const showRecordCount = ref(true);
  const collapseGroups = ref(false);

  const filterState = ref<ReportFilterState | null>(null);
  const filterInitialState = ref<ReportFilterState | null>(null);
  const expandedMatrixRows = ref<
    Record<
      string,
      {
        loading: boolean;
        result: import('@/types/analytics.types').AnalyticsExecuteResult | null;
        label: string;
      }
    >
  >({});

  const stepItems = computed(() =>
    REPORT_BUILDER_STEPS.map((id) => ({
      id,
      label: t(`analytics.builderStep_${id}`),
    })),
  );

  const moduleFieldOptions = computed<ReportBuilderFieldOption[]>(() => {
    const buildModuleFields = (moduleKey: string, qualifyRelated: boolean) => {
      const mod = catalogModules.value.find((m) => m.moduleKey === moduleKey);
      const moduleLabel = mod?.label || moduleKey;
      const mapField = (field: {
        key: string;
        label?: string;
        type?: string;
        filterable?: boolean;
        options?: Array<{ value: string; label: string }>;
      }) => {
        const bareKey = field.key;
        const key = qualifyRelated ? `${moduleKey}.${bareKey}` : bareKey;
        const label = qualifyRelated
          ? `${moduleLabel}: ${field.label || bareKey}`
          : field.label || bareKey;
        return {
          key,
          label,
          type: field.type,
          moduleKey,
          filterable: field.filterable,
          options: field.options,
        };
      };

      if (mod?.fields?.length) {
        return mod.fields.map(mapField);
      }

      const defaults = mod?.defaultFields?.length ? mod.defaultFields : ['name'];
      return defaults.map((key) => mapField({ key, label: key }));
    };

    const primaryFields = buildModuleFields(form.primaryModule, false);
    const relatedFields = relatedModules.value.flatMap((moduleKey) =>
      buildModuleFields(moduleKey, true),
    );
    const fields = [...primaryFields, ...relatedFields];
    const knownKeys = new Set(fields.map((field) => field.key));

    for (const key of selectedFields.value) {
      if (knownKeys.has(key)) continue;
      const dotIndex = key.indexOf('.');
      if (dotIndex > 0) {
        const moduleKey = key.slice(0, dotIndex);
        const bareKey = key.slice(dotIndex + 1);
        const mod = catalogModules.value.find((m) => m.moduleKey === moduleKey);
        fields.push({
          key,
          label: mod?.label ? `${mod.label}: ${bareKey}` : key,
          type: undefined,
          moduleKey,
          filterable: undefined,
          options: undefined,
        });
      } else {
        fields.push({
          key,
          label: key,
          type: undefined,
          moduleKey: form.primaryModule,
          filterable: undefined,
          options: undefined,
        });
      }
      knownKeys.add(key);
    }

    return fields;
  });

  const moduleFields = computed(() => moduleFieldOptions.value.map((field) => field.key));

  const moduleOptions = computed(() =>
    catalogModules.value.map((mod) => ({
      value: mod.moduleKey,
      label: mod.label || mod.moduleKey,
    })),
  );

  const popularModules = computed(() =>
    POPULAR_MODULE_KEYS.map((key) =>
      catalogModules.value.find((mod) => mod.moduleKey === key),
    ).filter(Boolean) as AnalyticsCatalogModule[],
  );

  const otherModules = computed(() =>
    catalogModules.value.filter(
      (mod) => !POPULAR_MODULE_KEYS.includes(mod.moduleKey as (typeof POPULAR_MODULE_KEYS)[number]),
    ),
  );

  const joinTargets = computed(() => {
    const mod = catalogModules.value.find((m) => m.moduleKey === form.primaryModule);
    return mod?.joinTargets || [];
  });

  const relatedModuleGroups = computed(() =>
    relatedModules.value.map((moduleKey) => {
      const mod = catalogModules.value.find((m) => m.moduleKey === moduleKey);
      const prefix = `${moduleKey}.`;
      return {
        moduleKey,
        label: mod?.label || moduleKey,
        fields: moduleFieldOptions.value.filter((field) => field.key.startsWith(prefix)),
      };
    }),
  );

  const numericModuleFields = computed(() => {
    const typed = moduleFieldOptions.value
      .filter((field) => {
        const type = String(field.type || '').toLowerCase();
        return ['number', 'currency', 'percent', 'integer', 'decimal', 'float'].includes(type);
      })
      .map((field) => field.key);
    if (typed.length) return typed;

    const heuristic = moduleFields.value.filter((key) =>
      /amount|total|score|percent|rate|rating|probability|qty|quantity|count|value|price|cost|revenue/i.test(
        key,
      ),
    );
    return heuristic.length ? heuristic : moduleFields.value.filter((key) => key !== '_id');
  });

  const numericFieldOptions = computed(() => {
    const labelByKey = Object.fromEntries(
      moduleFieldOptions.value.map((field) => [field.key, field.label]),
    );
    return numericModuleFields.value.map((key) => ({
      value: key,
      label: labelByKey[key] || key,
    }));
  });

  const folderOptions = computed(() =>
    folders.value.map((folder) => ({
      value: folder._id,
      label: folder.name,
    })),
  );

  const reportTypeOptions = computed(() => [
    { value: 'tabular', label: t('analytics.typeTabular') },
    { value: 'summary', label: t('analytics.typeSummary') },
    { value: 'matrix', label: t('analytics.typeMatrix') },
    { value: 'kpi', label: t('analytics.typeKpi') },
  ]);

  const aggregationFnOptions = computed(() =>
    AGGREGATION_FNS.map((fn) => ({
      value: fn,
      label: t(`analytics.metricFn_${fn}`),
    })),
  );

  const effectiveReportType = computed(() => {
    const type = String(form.type || 'tabular').toLowerCase();
    if (type === 'kpi') return 'kpi';
    if (type === 'matrix' || columnGroups.value.length > 0) return 'matrix';
    if (type === 'summary' || rowGroups.value.length > 0) return 'summary';
    return 'tabular';
  });

  const reportTypeLabel = computed(() => {
    const type = effectiveReportType.value;
    if (type === 'kpi') return t('analytics.typeKpi');
    if (type === 'matrix') return t('analytics.typeMatrix');
    if (type === 'summary') return t('analytics.typeSummary');
    return t('analytics.typeTabular');
  });

  const primaryModuleLabel = computed(() => {
    const mod = catalogModules.value.find((m) => m.moduleKey === form.primaryModule);
    return mod?.label || form.primaryModule;
  });

  const selectedFieldLabels = computed(() =>
    selectedFields.value.map((key) => {
      const match = moduleFieldOptions.value.find((field) => field.key === key);
      return { key, label: match?.label || key };
    }),
  );

  const canProceed = computed(() => {
    switch (currentStep.value) {
      case 0: {
        const selected = catalogModules.value.find((mod) => mod.moduleKey === form.primaryModule);
        return (
          Boolean(form.primaryModule) &&
          Boolean(form.name.trim()) &&
          selected?.reportable !== false
        );
      }
      case 1:
        return selectedFields.value.length > 0;
      default:
        return true;
    }
  });

  const isReadyToPublish = computed(
    () => Boolean(form.name.trim()) && selectedFields.value.length > 0,
  );

  const filterSummaries = computed(() => {
    const state = filterState.value;
    if (!state?.filters) return [];

    const filterByKey = buildAnalyticsFilterConfigByKey(
      moduleFields.value.map((field, index) => ({
        key: field,
        label: moduleFieldOptions.value.find((option) => option.key === field)?.label || field,
        filterType: 'text',
        fieldPath: field,
        options: [],
        priority: index + 1,
      })),
    );

    const keys = new Set([...Object.keys(state.filters), ...Object.keys(state.operators)]);
    return [...keys]
      .filter((key) => {
        const operator = (state.operators[key] ?? 'is') as FilterOperatorId;
        return isFilterRuleActive(state.filters[key], operator);
      })
      .map((key) => {
        const filter = filterByKey[key];
        const operator = (state.operators[key] ?? 'is') as FilterOperatorId;
        if (!filter) return key;
        return resolveActiveFilterChipLabel(filter, state.filters[key], operator, t);
      });
  });

  const sortSummaries = computed(() =>
    sorting.value.map((entry) => {
      const label =
        moduleFieldOptions.value.find((field) => field.key === entry.field)?.label ||
        entry.field;
      return `${label} (${entry.direction.toUpperCase()})`;
    }),
  );

  function syncApiNameFromTitle(name = form.name) {
    form.apiName = slugify(name || 'report');
  }

  function slugify(name: string) {
    return String(name || 'report')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80);
  }

  function defaultMetricLabel(metric: ReportBuilderMetric) {
    if (metric.fn === 'count') return 'count';
    return `${metric.field}_${metric.fn}`;
  }

  function buildAggregations() {
    if (effectiveReportType.value === 'tabular') return [];
    return metrics.value.map((metric) => ({
      field: metric.fn === 'count' ? '_id' : metric.field,
      fn: metric.fn,
      label: (metric.label || defaultMetricLabel(metric)).trim(),
    }));
  }

  function buildFilterPayload() {
    if (!filterState.value) {
      return { filterTree: null, filterLogic: 'AND' as const };
    }

    const filterByKey = buildAnalyticsFilterConfigByKey(
      moduleFields.value.map((field, index) => ({
        key: field,
        label: field,
        filterType: 'text',
        fieldPath: field,
        options: [],
        priority: index + 1,
      })),
    );

    const filterTree = buildAnalyticsFilterTree(
      filterState.value.query as FilterGroupNode,
      filterState.value.filters,
      filterState.value.operators,
      filterByKey,
    );

    return {
      filterTree,
      filterLogic: filterState.value.query?.logic || 'AND',
    };
  }

  function buildPayload() {
    syncApiNameFromTitle();
    const type = form.type;
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      apiName: form.apiName.trim() || slugify(form.name || 'report'),
      description: form.description.trim() || null,
      primaryModule: form.primaryModule,
      type,
      relatedModules: relatedModules.value,
      selectedFields: [],
      rowGroups: [],
      columnGroups: [],
      aggregations: [],
      sorting: sorting.value.length
        ? sorting.value.map((entry) => ({ field: entry.field, order: entry.direction }))
        : null,
      showGrandTotal: showGrandTotal.value,
      showSubTotals: showSubTotals.value,
      showRecordCount: showRecordCount.value,
      drillDownEnabled: form.drillDownEnabled,
      folderId: form.folderId || null,
      tags: form.tags,
      visibility: form.visibility,
      sharedWith: form.sharedWith.length ? form.sharedWith : null,
      cacheEnabled: form.cacheEnabled,
      cacheDuration: form.cacheDuration,
      runtimeFilters: form.runtimeFilters,
      permissions: { ...form.permissions },
      listedInHome: form.listedInHome,
      schedulingEnabled: scheduleForm.enabled,
      ...buildFilterPayload(),
    };

    if (type === 'tabular') {
      payload.selectedFields = selectedFields.value.map((field) => ({
        field,
        role: 'dimension',
      }));
    } else {
      payload.rowGroups = rowGroups.value.map((field) => ({ field }));
      if (columnGroups.value.length) {
        payload.columnGroups = columnGroups.value.map((field) => ({ field }));
      }
      if (rowGroups.value.length === 0 && groupByField.value.trim()) {
        payload.rowGroups = [{ field: groupByField.value.trim() }];
      }
      payload.aggregations = buildAggregations();
      if (selectedFields.value.length) {
        payload.selectedFields = selectedFields.value.map((field) => ({
          field,
          role: 'dimension',
        }));
      }
    }

    return payload;
  }

  function extractReportFieldKeys(entries: unknown): string[] {
    if (!Array.isArray(entries)) return [];
    return entries
      .map((entry) =>
        typeof entry === 'string' ? entry : String((entry as { field?: string })?.field || ''),
      )
      .filter(Boolean);
  }

  function validFieldKeySet() {
    return new Set(moduleFieldOptions.value.map((field) => field.key));
  }

  function pruneInvalidFieldSelections() {
    const validKeys = validFieldKeySet();
    rowGroups.value = rowGroups.value.filter((key) => validKeys.has(key));
    columnGroups.value = columnGroups.value.filter((key) => validKeys.has(key));
    sorting.value = sorting.value.filter((entry) => validKeys.has(entry.field));
  }

  function hydrateSelectedFieldsFromReport(report: Record<string, unknown>) {
    const saved = extractReportFieldKeys(report.selectedFields);
    if (saved.length) {
      selectedFields.value = saved;
      return;
    }

    const merged = [
      ...new Set([
        ...extractReportFieldKeys(report.rowGroups),
        ...extractReportFieldKeys(report.columnGroups),
      ]),
    ];
    if (merged.length) {
      selectedFields.value = merged;
    }
  }

  function hydrateRelatedModulesFromSelectedFields() {
    const modules = new Set(relatedModules.value);
    for (const key of selectedFields.value) {
      const dotIndex = key.indexOf('.');
      if (dotIndex > 0) {
        modules.add(key.slice(0, dotIndex));
      }
    }
    relatedModules.value = [...modules];
  }

  function applyModuleDefaults() {
    const fields = moduleFields.value;
    const validKeys = validFieldKeySet();
    if (!fields.includes(groupByField.value)) {
      groupByField.value = fields.includes('stage') ? 'stage' : (fields[0] || '');
    }
    if (selectedFields.value.length === 0 && fields.length) {
      selectedFields.value = fields.slice(0, Math.min(6, fields.length));
    }
    if (validKeys.size) {
      rowGroups.value = rowGroups.value.filter((key) => validKeys.has(key));
      columnGroups.value = columnGroups.value.filter((key) => validKeys.has(key));
      sorting.value = sorting.value.filter((entry) => validKeys.has(entry.field));
    } else {
      rowGroups.value = rowGroups.value.filter((key) => fields.includes(key));
      columnGroups.value = columnGroups.value.filter((key) => fields.includes(key));
      sorting.value = sorting.value.filter((entry) => fields.includes(entry.field));
    }
  }

  function hydrateFiltersFromReport(report: Record<string, unknown>) {
    if (!report?.filterTree) {
      filterInitialState.value = null;
      filterState.value = null;
      filterRemountToken.value += 1;
      return;
    }

    const hydrated = hydrateFilterBuilderFromAst(
      report.filterTree,
      form.primaryModule,
    );
    // Plain clone so FilterBuilder structuredClone / remount never sees Proxies or Date objs.
    const plainFilters: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(hydrated.filters || {})) {
      if (value instanceof Date) {
        plainFilters[key] = value.toISOString();
      } else if (value != null && typeof value === 'object' && typeof (value as { toISOString?: () => string }).toISOString === 'function') {
        try {
          plainFilters[key] = (value as { toISOString: () => string }).toISOString();
        } catch {
          plainFilters[key] = value;
        }
      } else {
        plainFilters[key] = value;
      }
    }
    // Map server/Astra comparison ops onto FilterBuilder-supported operators for display.
    const plainOperators: Record<string, string> = {};
    for (const [key, op] of Object.entries(hydrated.operators || {})) {
      const raw = String(op || 'is');
      if (['gt', 'gte', 'lt', 'lte', 'eq'].includes(raw)) {
        plainOperators[key] = 'is';
      } else {
        plainOperators[key] = raw;
      }
    }
    const nextState: ReportFilterState = JSON.parse(JSON.stringify({
      query: hydrated.query,
      filters: plainFilters,
      operators: plainOperators,
    }));
    filterInitialState.value = nextState;
    filterState.value = nextState;
    // Force Filters step remount so values always paint (avoids race with early ?step=).
    filterRemountToken.value += 1;
  }

function onFilterStateChange(nextState: ReportFilterState | null) {
  filterState.value = nextState;
  // Keep remount seed in sync so Filters step always paints applied rules.
  filterInitialState.value = nextState
    ? (JSON.parse(JSON.stringify(nextState)) as ReportFilterState)
    : null;
}

  function selectModule(moduleKey: string) {
    form.primaryModule = moduleKey;
  }

  function toggleColumn(fieldKey: string, checked: boolean) {
    if (checked) {
      if (!selectedFields.value.includes(fieldKey)) {
        selectedFields.value = [...selectedFields.value, fieldKey];
      }
      return;
    }
    selectedFields.value = selectedFields.value.filter((key) => key !== fieldKey);
  }

  function toggleRelatedModule(targetModule: string, checked: boolean) {
    const normalized = String(targetModule || '').trim();
    if (!normalized) return;

    if (checked) {
      const modulesToAdd = [normalized];
      for (const join of joinTargets.value) {
        if (join.targetModule !== normalized || !join.requiresJoin) continue;
        if (!modulesToAdd.includes(join.requiresJoin)) {
          modulesToAdd.unshift(join.requiresJoin);
        }
      }

      const next = [...relatedModules.value];
      for (const moduleKey of modulesToAdd) {
        if (!next.includes(moduleKey)) {
          next.push(moduleKey);
        }
      }
      relatedModules.value = next;
      return;
    }

    relatedModules.value = relatedModules.value.filter((key) => key !== normalized);
    selectedFields.value = selectedFields.value.filter(
      (key) => !key.startsWith(`${normalized}.`),
    );
    rowGroups.value = rowGroups.value.filter((key) => !key.startsWith(`${normalized}.`));
    columnGroups.value = columnGroups.value.filter((key) => !key.startsWith(`${normalized}.`));
    sorting.value = sorting.value.filter((entry) => !entry.field.startsWith(`${normalized}.`));
  }

  function clearSelectedFields() {
    selectedFields.value = [];
  }

  function reorderSelectedFields(next: string[]) {
    selectedFields.value = next;
  }

  function removeSelectedField(fieldKey: string) {
    selectedFields.value = selectedFields.value.filter((key) => key !== fieldKey);
  }

  function goToStep(step: number) {
    currentStep.value = Math.max(0, Math.min(REPORT_BUILDER_STEPS.length - 1, step));
  }

  function nextStep() {
    if (!canProceed.value) return;
    goToStep(currentStep.value + 1);
    if (currentStep.value === REPORT_BUILDER_PREVIEW_STEP) {
      void runPreview();
    }
  }

  watch(currentStep, (step) => {
    if (step === REPORT_BUILDER_PREVIEW_STEP) {
      schedulePreview();
    }
  });

  function prevStep() {
    goToStep(currentStep.value - 1);
  }

  async function applyFavoriteIfNeeded(reportId: string) {
    if (form.addToFavorites && reportId && !isFavorite('report', reportId)) {
      await toggleFavorite('report', reportId);
    }
  }

  async function saveDraft(options: { redirect?: boolean } = {}) {
    if (!form.name.trim()) {
      notifyError(t('analytics.builderNameRequired'));
      return { success: false, message: t('analytics.builderNameRequired') };
    }

    const shareKey = shareValidationMessageKey(
      getMissingShareTargetType(form.visibility, form.sharedWith),
    );
    if (shareKey) {
      notifyError(t(shareKey));
      return { success: false, message: t(shareKey) };
    }

    const payload = buildPayload();
    if (isNew.value) {
      const res = await createReport(payload);
      if (res?.success) {
        captureAnalyticsReportCreated({
          module: String(payload.primaryModule),
          type: String(payload.type),
        });
        notifySuccess(t('analytics.builderSaveSuccess'));
        if (options.redirect !== false) {
          router.replace({ name: 'analytics-report-edit', params: { id: res.data._id } });
        }
        await applyFavoriteIfNeeded(String(res.data._id));
      } else {
        notifyError(res?.message || t('analytics.builderSaveFailed'));
      }
      return res;
    }
    const id = reportId || route.params.id;
    const res = await updateReport(String(id), payload);
    if (res?.success) {
      notifySuccess(t('analytics.builderSaveSuccess'));
      await applyFavoriteIfNeeded(String(id));
    } else {
      notifyError(res?.message || t('analytics.builderSaveFailed'));
    }
    return res;
  }

  async function runPreview() {
    clearExpandedMatrixRows();
    await previewReport(buildPayload());
  }

  async function toggleMatrixRowExpand(payload: {
    key: string;
    rowFilters: Record<string, unknown>;
    label: string;
  }) {
    if (!form.drillDownEnabled) return;

    if (expandedMatrixRows.value[payload.key]) {
      const next = { ...expandedMatrixRows.value };
      delete next[payload.key];
      expandedMatrixRows.value = next;
      return;
    }

    expandedMatrixRows.value = {
      ...expandedMatrixRows.value,
      [payload.key]: { loading: true, result: null, label: payload.label },
    };

    try {
      const response = await previewMatrixDrill({
        ...buildPayload(),
        matrixDrill: {
          rowFilters: payload.rowFilters,
          columnFilters: {},
        },
        rowLimit: 100,
      });
      expandedMatrixRows.value = {
        ...expandedMatrixRows.value,
        [payload.key]: {
          loading: false,
          result: response?.success ? response.data : null,
          label: payload.label,
        },
      };
    } catch {
      const next = { ...expandedMatrixRows.value };
      delete next[payload.key];
      expandedMatrixRows.value = next;
    }
  }

  function clearExpandedMatrixRows() {
    expandedMatrixRows.value = {};
  }

  function schedulePreview() {
    if (!autoPreview.value) return;
    if (currentStep.value !== REPORT_BUILDER_PREVIEW_STEP) return;
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      void runPreview();
    }, 800);
  }

  function formatScheduleDateInput(value: unknown) {
    if (!value) return '';
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  }

  async function hydrateSchedulesForReport(id: string) {
    scheduleIdsByFormat.value = {};
    const res = await fetchSchedules({ reportId: id, status: 'active', limit: 20 });
    const rows = (res?.success ? res.data : []) as AnalyticsScheduleRecord[];
    if (!Array.isArray(rows) || rows.length === 0) return;

    const primary = rows[0];
    if (!primary) return;
    scheduleForm.enabled = true;
    scheduleForm.frequency = primary.frequency;
    scheduleForm.timezone = primary.timezone || 'UTC';
    scheduleForm.hour = Number(primary.hour ?? 9);
    scheduleForm.minute = Number(primary.minute ?? 0);
    scheduleForm.dayOfWeek = Number(primary.dayOfWeek ?? 1);
    scheduleForm.dayOfMonth = Number(primary.dayOfMonth ?? 1);
    scheduleForm.recipientsText = (primary.recipients || []).join(', ');
    scheduleForm.startDate = formatScheduleDateInput(primary.startDate);
    scheduleForm.endDate = formatScheduleDateInput(primary.endDate);
    scheduleForm.exportFormats = [
      ...new Set(rows.map((row) => row.exportFormat).filter(Boolean)),
    ] as string[];
    scheduleIdsByFormat.value = Object.fromEntries(
      rows.map((row) => [row.exportFormat, String(row._id)]),
    );
  }

  async function createReportSchedules(reportId: string, recipients: string[]) {
    const formats =
      scheduleForm.exportFormats.length > 0 ? scheduleForm.exportFormats : ['csv'];
    const scheduleBase = {
      assetType: 'report' as const,
      reportId,
      frequency: scheduleForm.frequency as 'daily' | 'weekly' | 'monthly',
      timezone: scheduleForm.timezone,
      hour: scheduleForm.hour,
      minute: scheduleForm.minute,
      dayOfWeek: scheduleForm.dayOfWeek,
      dayOfMonth: scheduleForm.dayOfMonth,
      recipients,
      emailSubject: form.name.trim() || null,
      startDate: scheduleForm.startDate || null,
      endDate: scheduleForm.endDate || null,
    };

    for (const exportFormat of formats) {
      const existingId = scheduleIdsByFormat.value[exportFormat];
      const name =
        formats.length > 1
          ? `${form.name.trim()} schedule (${exportFormat.toUpperCase()})`
          : `${form.name.trim()} schedule`;
      const payload = {
        ...scheduleBase,
        exportFormat: exportFormat as 'csv' | 'xlsx' | 'pdf',
        name,
      };

      if (existingId) {
        const scheduleRes = await updateSchedule(existingId, payload);
        if (!scheduleRes?.success) {
          return false;
        }
        continue;
      }

      const scheduleRes = await createSchedule(payload);
      if (!scheduleRes?.success) {
        return false;
      }
      if (scheduleRes.data?._id) {
        scheduleIdsByFormat.value = {
          ...scheduleIdsByFormat.value,
          [exportFormat]: String(scheduleRes.data._id),
        };
      }
    }

    for (const [format, existingId] of Object.entries(scheduleIdsByFormat.value)) {
      if (formats.includes(format)) continue;
      await deleteSchedule(existingId);
      const next = { ...scheduleIdsByFormat.value };
      delete next[format];
      scheduleIdsByFormat.value = next;
    }

    return true;
  }

  async function publish(options: { withSchedule?: boolean } = {}) {
    if (options.withSchedule) {
      scheduleForm.enabled = true;
    }

    const shouldCreateSchedule = options.withSchedule || scheduleForm.enabled;

    let id = String(reportId || route.params.id || '');

    if (isNew.value || !id) {
      const saveRes = await saveDraft({ redirect: false });
      if (!saveRes?.success) return;
      id = String(saveRes.data?._id || '');
    } else {
      const saveRes = await saveDraft({ redirect: false });
      if (!saveRes?.success) return;
    }

    if (!id) return;

    const res = await publishReport(id);
    if (!res?.success) {
      notifyError(res?.message || t('analytics.builderSaveFailed'));
      return;
    }

    captureAnalyticsReportPublished({ report_id: id });

    if (shouldCreateSchedule) {
      const recipients = parseScheduleRecipients();
      if (!recipients.length) {
        notifyError(t('analytics.builderScheduleRecipientsRequired'));
        router.push({ name: 'analytics-report-detail', params: { id } });
        return;
      }
      const scheduleOk = await createReportSchedules(id, recipients);
      if (!scheduleOk) {
        notifyError(t('analytics.builderScheduleCreateFailed'));
      }
    }

    await applyFavoriteIfNeeded(id);

    notifySuccess(t('analytics.builderPublishSuccess'));
    router.push({ name: 'analytics-report-detail', params: { id } });
  }

  function publishWithSchedule() {
    return publish({ withSchedule: true });
  }

  function parseScheduleRecipients() {
    const recipients = scheduleForm.recipientsText
      .split(/[,;\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    const ownerEmail = String(authStore.user?.email || '').trim();
    if (scheduleForm.sendCopyToOwner && ownerEmail && !recipients.includes(ownerEmail)) {
      recipients.push(ownerEmail);
    }
    return recipients;
  }

  function goBack() {
    router.push({ name: 'analytics-reports' });
  }

  function cancelWizard() {
    goBack();
  }

  watch(
    () => form.type,
    (nextType) => {
      if (isHydratingReport.value) return;
      if (nextType === 'kpi' && metrics.value.length > 1) {
        const first = metrics.value[0];
        if (first) metrics.value = [first];
      }
      if (nextType === 'tabular') {
        rowGroups.value = [];
        columnGroups.value = [];
      }
      if (nextType === 'summary') {
        columnGroups.value = [];
      }
    },
  );

  watch(
    [rowGroups, columnGroups],
    () => {
      if (isHydratingReport.value) return;
      // Keep Fields selection in sync when grouping uses a field not yet selected
      const missing = [...rowGroups.value, ...columnGroups.value].filter(
        (key) => key && !selectedFields.value.includes(key),
      );
      if (missing.length) {
        selectedFields.value = [...selectedFields.value, ...missing];
      }
      if (form.type === 'kpi') return;
      if (columnGroups.value.length > 0) {
        form.type = 'matrix';
      } else if (rowGroups.value.length > 0) {
        form.type = 'summary';
      } else if (form.type === 'summary' || form.type === 'matrix') {
        form.type = 'tabular';
      }
    },
    { deep: true },
  );

  watch(
    () => form.name,
    (name) => {
      syncApiNameFromTitle(name);
    },
  );

  watch(
    () => form.primaryModule,
    (next, prev) => {
      if (isHydratingReport.value) return;
      if (prev && next !== prev) {
        filterInitialState.value = null;
        filterState.value = null;
        filterRemountToken.value += 1;
        relatedModules.value = [];
        selectedFields.value = [];
        rowGroups.value = [];
        columnGroups.value = [];
        sorting.value = [];
      }
      applyModuleDefaults();
      schedulePreview();
    },
  );

  watch(
    [form, groupByField, metrics, selectedFields, filterState, rowGroups, sorting],
    () => {
      schedulePreview();
    },
    { deep: true },
  );

  async function initialize() {
    reportHydrationDone.value = false;
    await Promise.all([fetchCatalog(), fetchFolders(), fetchHome()]);

    const editId = reportId || route.params.id;
    const duplicateFromRaw = route.query?.duplicateFrom;
    const duplicateFromId =
      !editId && isNew.value && duplicateFromRaw != null && duplicateFromRaw !== ''
        ? String(Array.isArray(duplicateFromRaw) ? duplicateFromRaw[0] : duplicateFromRaw)
        : null;
    const loadId = editId ? String(editId) : duplicateFromId;
    const isDuplicateCreate = Boolean(duplicateFromId && !editId);

    if (loadId) {
      isHydratingReport.value = true;
      const res = await fetchReport(String(loadId));
      if (res?.success && res.data) {
        const r = res.data;
        loadedReportStatus.value = isDuplicateCreate ? 'draft' : String(r.status || 'draft');
        form.name = isDuplicateCreate
          ? (String(r.name || '').trim() && !/\(copy\)$/i.test(String(r.name).trim())
              ? `${String(r.name).trim()} (Copy)`
              : String(r.name || '').trim())
          : r.name;
        form.apiName = isDuplicateCreate ? '' : r.apiName;
        form.description = r.description || '';
        relatedModules.value = Array.isArray(r.relatedModules) ? [...r.relatedModules] : [];
        form.primaryModule = r.primaryModule;
        form.folderId = r.folderId ? String(r.folderId) : '';
        form.tags = Array.isArray(r.tags) ? [...r.tags] : [];
        form.visibility = r.visibility || 'private';
        form.sharedWith = Array.isArray(r.sharedWith) ? [...r.sharedWith] : [];
        form.cacheEnabled = r.cacheEnabled !== false;
        form.cacheDuration = Number(r.cacheDuration) || 15;
        form.runtimeFilters = Boolean(r.runtimeFilters);
        form.permissions = {
          ...DEFAULT_REPORT_PERMISSIONS,
          ...((r.permissions && typeof r.permissions === 'object'
            ? r.permissions
            : {}) as AnalyticsReportPermissions),
        };
        form.listedInHome = r.listedInHome !== false;
        form.drillDownEnabled = r.drillDownEnabled !== false;
        form.addToFavorites = isDuplicateCreate ? false : isFavorite('report', String(r._id));
        if (!isDuplicateCreate && r.schedulingEnabled) {
          scheduleForm.enabled = true;
        }
        if (Array.isArray(r.rowGroups) && r.rowGroups.length) {
          rowGroups.value = extractReportFieldKeys(r.rowGroups);
          groupByField.value = rowGroups.value[0] || groupByField.value;
        }
        if (Array.isArray(r.columnGroups) && r.columnGroups.length) {
          columnGroups.value = extractReportFieldKeys(r.columnGroups);
        }
        hydrateSelectedFieldsFromReport(r);
        hydrateRelatedModulesFromSelectedFields();
        form.type = r.type === 'joined' ? 'tabular' : r.type;
        if (Array.isArray(r.aggregations) && r.aggregations.length) {
          metrics.value = r.aggregations.map(
            (agg: { fn?: string; field?: string; label?: string }) => ({
              fn: String(agg.fn || 'count').toLowerCase(),
              field:
                agg.fn === 'count'
                  ? '_id'
                  : String(agg.field || numericModuleFields.value[0] || 'amount'),
              label: String(
                agg.label ||
                  defaultMetricLabel({
                    fn: String(agg.fn || 'count').toLowerCase(),
                    field: String(agg.field || ''),
                    label: '',
                  }),
              ),
            }),
          );
        }
        if (Array.isArray(r.sorting) && r.sorting.length) {
          sorting.value = r.sorting.map(
            (entry: { field?: string; order?: string; direction?: string }) => ({
              field: String(entry.field || ''),
              direction:
                String(entry.order || entry.direction || 'asc').toLowerCase() === 'desc'
                  ? 'desc'
                  : 'asc',
            }),
          );
        }
        showGrandTotal.value = r.showGrandTotal !== false;
        showSubTotals.value = r.showSubTotals !== false;
        showRecordCount.value = r.showRecordCount !== false;
        hydrateFiltersFromReport(r);
        pruneInvalidFieldSelections();
        if (!isDuplicateCreate) {
          await hydrateSchedulesForReport(String(r._id));
        }
      }
      isHydratingReport.value = false;
    } else {
      const firstReportable =
        catalogModules.value.find((mod) => mod.reportable !== false) ||
        catalogModules.value[0];
      if (firstReportable) {
        form.primaryModule = firstReportable.moduleKey || 'deals';
      }
      applyModuleDefaults();
    }

    autoPreview.value = true;
    schedulePreview();
    reportHydrationDone.value = true;
  }

  onMounted(() => {
    void initialize();
  });

  onUnmounted(() => {
    if (previewTimer) clearTimeout(previewTimer);
  });

  return {
    t,
    currentStep,
    stepItems,
    isNew,
    form,
    scheduleForm,
    loadedReportStatus,
    catalogModules,
    popularModules,
    otherModules,
    moduleOptions,
    moduleFieldOptions,
    moduleFields,
    folderOptions,
    reportTypeOptions,
    aggregationFnOptions,
    numericFieldOptions,
    joinTargets,
    relatedModuleGroups,
    selectedFields,
    selectedFieldLabels,
    relatedModules,
    rowGroups,
    columnGroups,
    sorting,
    showGrandTotal,
    showSubTotals,
    showRecordCount,
    collapseGroups,
    metrics,
    groupByField,
    filterState,
    filterInitialState,
    filterRemountToken,
    reportHydrationDone,
    previewResult,
    expandedMatrixRows,
    saving,
    executing,
    effectiveReportType,
    reportTypeLabel,
    primaryModuleLabel,
    canProceed,
    isReadyToPublish,
    filterSummaries,
    sortSummaries,
    selectModule,
    toggleColumn,
    toggleRelatedModule,
    clearSelectedFields,
    reorderSelectedFields,
    removeSelectedField,
    onFilterStateChange,
    goToStep,
    nextStep,
    prevStep,
    saveDraft,
    runPreview,
    toggleMatrixRowExpand,
    clearExpandedMatrixRows,
    publish,
    publishWithSchedule,
    goBack,
    cancelWizard,
    buildPayload,
    slugify,
  };
}
