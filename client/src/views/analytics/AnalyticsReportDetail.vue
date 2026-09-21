<template>
  <div class="mx-auto w-full max-w-7xl px-6 py-8">
    <div v-if="loading" class="space-y-6">
      <div class="h-5 w-28 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
      <div class="space-y-3">
        <div class="h-8 w-2/3 max-w-md animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700" />
        <div class="flex gap-2">
          <div
            v-for="idx in 3"
            :key="idx"
            class="h-6 w-20 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700"
          />
        </div>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="idx in 4"
          :key="idx"
          class="h-24 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700"
        />
      </div>
      <div class="h-96 animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-700" />
    </div>

    <template v-else-if="report">
      <button
        type="button"
        class="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
        @click="goList"
      >
        <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
        {{ t('analytics.listTitle') }}
      </button>

      <div class="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0 flex-1">
          <h1 class="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            {{ report.name }}
          </h1>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span
              class="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
            >
              {{ moduleLabel(report.primaryModule) }}
            </span>
            <span
              class="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
            >
              {{ typeLabel(report.type) }}
            </span>
            <span
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
              :class="statusBadgeClass(report.status)"
            >
              {{ statusLabel(report.status) }}
            </span>
            <span
              v-if="report.certified"
              class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
            >
              <ShieldCheckIcon class="h-3.5 w-3.5" aria-hidden="true" />
              {{ t('analytics.certifiedBadge') }}
            </span>
          </div>
        </div>

        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="executing || !isPublished"
            @click="runReport"
          >
            <ArrowPathIcon
              class="h-4 w-4"
              :class="{ 'animate-spin': executing }"
              aria-hidden="true"
            />
            {{ executing ? t('analytics.detailRunning') : t('analytics.runReport') }}
          </button>

          <button
            v-if="canShareReport"
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            @click="openShare"
          >
            <ShareIcon class="h-4 w-4" aria-hidden="true" />
            {{ t('analytics.actionShare') }}
          </button>

          <button
            v-if="canEditReport"
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            @click="goEdit"
          >
            <PencilSquareIcon class="h-4 w-4" aria-hidden="true" />
            {{ t('actions.edit') }}
          </button>

          <Menu v-if="isPublished" as="div" class="relative inline-block text-left">
            <MenuButton
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              :disabled="executing"
            >
              <ArrowDownTrayIcon class="h-4 w-4" aria-hidden="true" />
              {{ t('analytics.detailExportMenu') }}
              <ChevronDownIcon class="h-4 w-4 text-neutral-400" aria-hidden="true" />
            </MenuButton>
            <transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="transform opacity-0 scale-95"
              enter-to-class="transform opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="transform opacity-100 scale-100"
              leave-to-class="transform opacity-0 scale-95"
            >
              <MenuItems
                class="absolute right-0 z-20 mt-1 w-48 origin-top-right rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10"
              >
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    :class="menuItemClass(active)"
                    :disabled="executing"
                    @click="exportCsv"
                  >
                    {{ t('analytics.exportCsv') }}
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    :class="menuItemClass(active)"
                    :disabled="executing"
                    @click="exportXlsx"
                  >
                    {{ t('analytics.exportXlsx') }}
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    :class="menuItemClass(active)"
                    :disabled="executing"
                    @click="exportPdf"
                  >
                    {{ t('analytics.exportPdf') }}
                  </button>
                </MenuItem>
              </MenuItems>
            </transition>
          </Menu>

          <Menu as="div" class="relative inline-block text-left">
            <MenuButton
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-500 shadow-sm transition-colors hover:bg-neutral-50 hover:text-neutral-700 dark:border-neutral-600 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              :aria-label="t('common.moreActions')"
            >
              <EllipsisHorizontalIcon class="h-5 w-5" aria-hidden="true" />
            </MenuButton>
            <transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="transform opacity-0 scale-95"
              enter-to-class="transform opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="transform opacity-100 scale-100"
              leave-to-class="transform opacity-0 scale-95"
            >
              <MenuItems
                class="absolute right-0 z-20 mt-1 w-52 origin-top-right rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10"
              >
                <MenuItem v-if="isPublished" v-slot="{ active }">
                  <button type="button" :class="menuItemClass(active)" @click="goCreateWidget">
                    {{ t('analytics.createWidgetFromReport') }}
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button type="button" :class="menuItemClass(active)" @click="goSchedules">
                    {{ t('analytics.schedulesTitle') }}
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button type="button" :class="menuItemClass(active)" @click="goAlerts">
                    {{ t('analytics.alertsTitle') }}
                  </button>
                </MenuItem>
                <div
                  v-if="canCertify && isPublished"
                  class="my-1 border-t border-neutral-100 dark:border-neutral-800"
                />
                <MenuItem
                  v-if="canCertify && isPublished && !report.certified"
                  v-slot="{ active }"
                >
                  <button
                    type="button"
                    :class="[menuItemClass(active), 'text-amber-700 dark:text-amber-300']"
                    :disabled="saving"
                    @click="certify"
                  >
                    {{ t('analytics.certifyReport') }}
                  </button>
                </MenuItem>
                <MenuItem v-if="canCertify && report.certified" v-slot="{ active }">
                  <button
                    type="button"
                    :class="menuItemClass(active)"
                    :disabled="saving"
                    @click="uncertify"
                  >
                    {{ t('analytics.uncertifyReport') }}
                  </button>
                </MenuItem>
              </MenuItems>
            </transition>
          </Menu>
        </div>
      </div>

      <div
        v-if="!isPublished"
        class="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/30"
      >
        <ExclamationTriangleIcon
          class="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
        <p class="text-sm text-amber-800 dark:text-amber-200">
          {{ t('analytics.detailDraftHint') }}
        </p>
      </div>

      <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="card in statCards"
          :key="card.key"
          class="rounded-xl border border-neutral-200/80 bg-white px-4 py-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/80"
        >
          <div class="flex items-center gap-2">
            <component
              :is="card.icon"
              class="h-4 w-4 text-neutral-400 dark:text-neutral-500"
              aria-hidden="true"
            />
            <p class="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {{ card.label }}
            </p>
          </div>
          <p
            class="mt-2 text-xl font-semibold tabular-nums text-neutral-900 dark:text-white"
            :class="card.valueClass"
          >
            {{ card.value }}
          </p>
        </div>
      </div>

      <section
        class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4 dark:border-neutral-800"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {{ previewModeLabel }}
          </p>
          <p
            v-if="runResult?.meta"
            class="text-xs tabular-nums text-neutral-400 dark:text-neutral-500"
          >
            {{
              t('analytics.previewRows', {
                count: runResult.meta.totalRows ?? 0,
                ms: runResult.meta.executionMs ?? 0,
              })
            }}
          </p>
        </div>

        <div class="relative p-5">
          <div
            v-if="executing"
            class="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px] dark:bg-neutral-900/70"
          >
            <div class="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <ArrowPathIcon class="h-5 w-5 animate-spin text-primary-600" aria-hidden="true" />
              {{ t('analytics.detailRunning') }}
            </div>
          </div>

          <ReportTypePreviewPanel
            :result="runResult"
            :report-type="report.type"
            :expanded-rows="expandedMatrixRows"
            :empty-message="previewEmptyMessage"
            :show-mode-label="false"
            @toggle-row="toggleMatrixRowExpand"
          />
        </div>
      </section>

      <ReportShareDialog
        :open="shareOpen"
        :report-name="report.name"
        :visibility="shareVisibility"
        :shared-with="shareSharedWith"
        :saving="saving"
        @close="shareOpen = false"
        @save="saveShare"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { formatUserDateTime } from '@/utils/localeFormat';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  BoltIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  EllipsisHorizontalIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  PencilSquareIcon,
  ShareIcon,
  ShieldCheckIcon,
} from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/authRegistry';
import ReportTypePreviewPanel from '@/components/analytics/ReportTypePreviewPanel.vue';
import ReportShareDialog from '@/components/analytics/report-builder/ReportShareDialog.vue';
import type { MatrixExpandedRowState } from '@/components/analytics/ReportMatrixPreviewPanel.vue';
import { useAnalyticsReports } from '@/composables/useAnalyticsReports';
import { useNotifications } from '@/composables/useNotifications';
import { useTabs } from '@/composables/useTabs';
import type {
  AnalyticsExecuteResult,
  AnalyticsShareTarget,
  AnalyticsVisibility,
} from '@/types/analytics.types';
import {
  captureAnalyticsReportCertified,
  captureAnalyticsReportExecuted,
  captureAnalyticsReportUncertified,
  captureAnalyticsReportViewed,
} from '@/config/posthogAnalytics';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { activeTabId, updateTabTitle } = useTabs();

const {
  report,
  loading,
  executing,
  saving,
  catalogModules,
  fetchReport,
  fetchCatalog,
  updateReport,
  executeReport,
  exportReport,
  certifyReport,
  uncertifyReport,
} = useAnalyticsReports();

const { success, error } = useNotifications();

const runResult = ref<AnalyticsExecuteResult | null>(null);
const expandedMatrixRows = ref<Record<string, MatrixExpandedRowState>>({});
const shareOpen = ref(false);

const canCertify = computed(() => authStore.can('analytics_admin', 'certify'));
const isPublished = computed(() => report.value?.status === 'published');
const canEditReport = computed(() => {
  if (!report.value) return false;
  if (!report.value.certified) return authStore.can('reports', 'edit');
  if (canCertify.value) return true;
  const ownerId = typeof report.value.ownerId === 'object'
    ? report.value.ownerId?._id
    : report.value.ownerId;
  return ownerId && String(ownerId) === String(authStore.user?._id);
});
const canShareReport = computed(
  () => canEditReport.value && report.value?.status !== 'archived',
);
const shareVisibility = computed<AnalyticsVisibility>(
  () => report.value?.visibility || 'private',
);
const shareSharedWith = computed<AnalyticsShareTarget[]>(() =>
  Array.isArray(report.value?.sharedWith) ? report.value.sharedWith : [],
);

const previewModeLabel = computed(() => {
  const type = String(report.value?.type || '').toLowerCase();
  const keyMap: Record<string, string> = {
    kpi: 'previewModeKpi',
    summary: 'previewModeGroupedTable',
    matrix: 'previewModeMatrixTable',
    pivot: 'previewModeMatrixTable',
    tabular: 'previewModeTable',
    trend: 'previewModeTrend',
    exception: 'previewModeException',
  };
  const key = keyMap[type];
  return key ? t(`analytics.${key}`) : t('analytics.sectionPreview');
});

const previewEmptyMessage = computed(() => {
  if (!isPublished.value) return t('analytics.detailDraftHint');
  if (executing.value) return t('analytics.detailRunning');
  return t('analytics.previewEmpty');
});

const statCards = computed(() => {
  if (!report.value) return [];
  return [
    {
      key: 'lastRun',
      label: t('analytics.detailLastRun'),
      value: formatDate(report.value.lastExecutedAt),
      icon: ClockIcon,
      valueClass: '',
    },
    {
      key: 'executions',
      label: t('analytics.detailExecutions'),
      value: String(report.value.executionCount ?? 0),
      icon: BoltIcon,
      valueClass: '',
    },
    {
      key: 'views',
      label: t('analytics.detailViews'),
      value: String(report.value.viewCount ?? 0),
      icon: EyeIcon,
      valueClass: '',
    },
    {
      key: 'status',
      label: t('analytics.colStatus'),
      value: statusLabel(report.value.status),
      icon: CheckCircleIcon,
      valueClass: statusValueClass(report.value.status),
    },
  ];
});

function menuItemClass(active: boolean) {
  return [
    'block w-full px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50',
    active
      ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white'
      : 'text-neutral-700 dark:text-neutral-200',
  ];
}

function statusBadgeClass(status: string) {
  if (status === 'published') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  }
  if (status === 'archived') {
    return 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300';
  }
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
}

function statusValueClass(status: string) {
  if (status === 'published') return 'text-emerald-600 dark:text-emerald-400';
  if (status === 'archived') return 'text-neutral-500';
  return 'text-amber-600 dark:text-amber-400';
}

function moduleLabel(moduleKey: string) {
  const mod = catalogModules.value.find((entry) => entry.moduleKey === moduleKey);
  return mod?.label || moduleKey;
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    tabular: 'typeTabular',
    summary: 'typeSummary',
    kpi: 'typeKpi',
    joined: 'typeJoined',
    trend: 'typeTrend',
    matrix: 'typeMatrix',
    pivot: 'typeMatrix',
    exception: 'typeException',
  };
  const i18nKey = map[String(type || '').toLowerCase()];
  return i18nKey ? t(`analytics.${i18nKey}`) : type;
}

function statusLabel(status: string) {
  if (status === 'published') return t('analytics.statusPublished');
  if (status === 'archived') return t('analytics.statusArchived');
  return t('analytics.statusDraft');
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  return formatUserDateTime(value);
}

function goList() {
  router.push({ name: 'analytics-reports' });
}

function goEdit() {
  router.push({ name: 'analytics-report-edit', params: { id: route.params.id } });
}

function openShare() {
  shareOpen.value = true;
}

async function saveShare(payload: {
  visibility: AnalyticsVisibility;
  sharedWith: AnalyticsShareTarget[];
}) {
  const res = await updateReport(String(route.params.id), {
    visibility: payload.visibility,
    sharedWith: payload.sharedWith,
  });
  if (res?.success) {
    shareOpen.value = false;
    success(t('analytics.shareReportSaved'));
    return;
  }
      error(res?.message || t('errors.permission_denied'));
}

function goCreateWidget() {
  router.push({
    name: 'analytics-widget-create',
    query: { reportId: String(route.params.id) },
  });
}

function goSchedules() {
  router.push({
    name: 'analytics-schedules',
    query: { reportId: String(route.params.id) },
  });
}

function goAlerts() {
  router.push({ name: 'analytics-alerts' });
}

async function certify() {
  const res = await certifyReport(String(route.params.id));
  if (res?.success) {
    captureAnalyticsReportCertified({ report_id: route.params.id });
  }
}

async function uncertify() {
  const res = await uncertifyReport(String(route.params.id));
  if (res?.success) {
    captureAnalyticsReportUncertified({ report_id: route.params.id });
  }
}

async function runReport() {
  expandedMatrixRows.value = {};
  const res = await executeReport(String(route.params.id), {});
  if (res?.success) {
    runResult.value = res.data;
    captureAnalyticsReportExecuted({ report_id: route.params.id });
    await fetchReport(String(route.params.id), { silent: true });
  }
}

async function toggleMatrixRowExpand(payload: {
  key: string;
  rowFilters: Record<string, unknown>;
  label: string;
}) {
  if (report.value?.drillDownEnabled === false) return;

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
    const response = await executeReport(String(route.params.id), {
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

async function exportCsv() {
  await exportReport(String(route.params.id), 'csv', {});
}

async function exportXlsx() {
  await exportReport(String(route.params.id), 'xlsx', {});
}

async function exportPdf() {
  await exportReport(String(route.params.id), 'pdf', {});
}

onMounted(async () => {
  await Promise.all([
    fetchReport(String(route.params.id)),
    fetchCatalog(),
  ]);
  captureAnalyticsReportViewed({ report_id: route.params.id, view_count: report.value?.viewCount });
  if (report.value?.status === 'published') {
    await runReport();
  }
});

watch(
  () => report.value?.name,
  (name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed || !activeTabId.value) return;
    updateTabTitle(activeTabId.value, trimmed);
  },
  { immediate: true },
);
</script>
