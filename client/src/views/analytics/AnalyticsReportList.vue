<template>
  <div class="mx-auto w-full">
    <ModuleList
      ref="moduleListRef"
      module-key="reports"
      app-key="PLATFORM"
      @create="goCreate"
      @row-click="openReport"
      @edit="editReport"
    >
      <template #header-actions>
        <AnalyticsListHeaderActions
          active="reports"
          :create-label="t('analytics.newReport')"
          @create="goCreate"
        />
      </template>

      <template #cell-name="{ row }">
        <div class="min-w-0">
          <p class="truncate font-semibold text-gray-900 dark:text-white">
            {{ row.name }}
          </p>
        </div>
      </template>

      <template #cell-type="{ value }">
        <span class="capitalize text-gray-700 dark:text-gray-300">{{ formatType(value) }}</span>
      </template>

      <template #cell-primaryModule="{ row }">
        <span class="text-gray-700 dark:text-gray-300">{{ moduleLabel(row.primaryModule) }}</span>
      </template>

      <template #cell-status="{ value }">
        <BadgeCell
          :value="formatStatus(value)"
          :variant="statusVariantMap[value] || 'default'"
        />
      </template>

      <template #cell-ownerId="{ row }">
        <div v-if="row.ownerId" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.ownerId.firstName || row.ownerId.first_name,
              lastName: row.ownerId.lastName || row.ownerId.last_name,
              email: row.ownerId.email,
              avatar: row.ownerId.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ getUserDisplayName(row.ownerId) }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('records.editableUnassigned') }}</span>
      </template>

      <template #cell-updatedAt="{ value }">
        <DateCell :value="value" format="short" />
      </template>

      <template #actions="{ row }">
        <ReportRowActionsMenu
          :can-run="row.status === 'published'"
          :can-edit="canEdit && row.status !== 'archived'"
          :can-create="canCreate"
          :can-share="canEdit && row.status !== 'archived'"
          :can-export="row.status === 'published'"
          :can-archive="canArchive && row.status !== 'archived'"
          @run="runReport(row._id)"
          @edit="editReport(row._id)"
          @duplicate="duplicateRow(row._id)"
          @share="openShare(row)"
          @export="exportRow(row._id)"
          @archive="archiveRow(row)"
        />
      </template>
    </ModuleList>

    <ReportShareDialog
      :open="shareOpen"
      :report-name="shareTarget?.name"
      :visibility="shareVisibility"
      :shared-with="shareSharedWith"
      :saving="saving"
      @close="closeShare"
      @save="saveShare"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ModuleList from '@/components/module-list/ModuleList.vue';
import AnalyticsListHeaderActions from '@/components/analytics/AnalyticsListHeaderActions.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import Avatar from '@/components/common/Avatar.vue';
import ReportRowActionsMenu from '@/components/analytics/ReportRowActionsMenu.vue';
import ReportShareDialog from '@/components/analytics/report-builder/ReportShareDialog.vue';
import { useAnalyticsReports } from '@/composables/useAnalyticsReports';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import {
  captureAnalyticsModuleVisited,
  captureAnalyticsReportArchived,
  captureAnalyticsReportExecuted,
} from '@/config/posthogAnalytics';

import { confirmAction } from '@/composables/useConfirmAction';
const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { success, error } = useNotifications();
const {
  catalogModules,
  saving,
  fetchCatalog,
  fetchReport,
  updateReport,
  archiveReport,
  executeReport,
  exportReport,
} = useAnalyticsReports();

const moduleListRef = ref(null);
const shareOpen = ref(false);
const shareTarget = ref(null);
const shareVisibility = ref('private');
const shareSharedWith = ref([]);

const canCreate = computed(() => authStore.can('reports', 'create'));
const canEdit = computed(() => authStore.can('reports', 'edit'));
const canArchive = computed(() => authStore.can('reports', 'delete'));

const statusVariantMap = {
  draft: 'warning',
  published: 'success',
  archived: 'default',
};

const typeLabelKeys = {
  tabular: 'analytics.typeTabular',
  summary: 'analytics.typeSummary',
  kpi: 'analytics.typeKpi',
};

function formatType(value) {
  const key = typeLabelKeys[value];
  return key ? t(key) : String(value || '—');
}

function formatStatus(value) {
  if (value === 'published') return t('analytics.statusPublished');
  if (value === 'archived') return t('analytics.statusArchived');
  return t('analytics.statusDraft');
}

function moduleLabel(moduleKey) {
  const mod = catalogModules.value.find((m) => m.moduleKey === moduleKey);
  return mod?.label || moduleKey || '—';
}

function getUserDisplayName(user) {
  if (!user) return t('records.editableUnassigned');
  if (typeof user === 'string') return user;
  const firstName = user.firstName || user.first_name || user.name || '';
  const lastName = user.lastName || user.last_name || '';
  const combined = `${firstName} ${lastName}`.trim();
  if (combined) return combined;
  if (user.email) return user.email;
  if (user.username) return user.username;
  return t('records.editableUnassigned');
}

function refreshList() {
  moduleListRef.value?.refresh?.();
}

function goCreate() {
  router.push({ name: 'analytics-report-create' });
}

function openReport(row, event = null) {
  const id = row?._id || row?.id;
  if (!id) return;
  router.push({ name: 'analytics-report-detail', params: { id } });
}

function editReport(idOrRow) {
  const id = typeof idOrRow === 'object' ? idOrRow?._id || idOrRow?.id : idOrRow;
  if (!id) return;
  router.push({ name: 'analytics-report-edit', params: { id } });
}

async function runReport(id) {
  const res = await executeReport(String(id), {});
  if (res?.success) {
    captureAnalyticsReportExecuted({ report_id: id, surface: 'reports_list' });
    router.push({ name: 'analytics-report-detail', params: { id } });
  }
}

async function duplicateRow(id) {
  router.push({ name: 'analytics-report-create', query: { duplicateFrom: String(id) } });
}

async function openShare(row) {
  const id = row?._id || row?.id;
  if (!id) return;
  shareTarget.value = row;
  shareVisibility.value = row.visibility || 'private';
  shareSharedWith.value = Array.isArray(row.sharedWith) ? [...row.sharedWith] : [];
  shareOpen.value = true;
  const res = await fetchReport(String(id));
  if (res?.success && res.data) {
    shareTarget.value = res.data;
    shareVisibility.value = res.data.visibility || 'private';
    shareSharedWith.value = Array.isArray(res.data.sharedWith) ? [...res.data.sharedWith] : [];
  }
}

function closeShare() {
  shareOpen.value = false;
  shareTarget.value = null;
}

async function saveShare(payload) {
  const id = shareTarget.value?._id || shareTarget.value?.id;
  if (!id) return;
  const res = await updateReport(String(id), {
    visibility: payload.visibility,
    sharedWith: payload.sharedWith,
  });
  if (res?.success) {
    shareOpen.value = false;
    shareTarget.value = null;
    success(t('analytics.shareReportSaved'));
    await refreshList();
    return;
  }
  error(res?.message || t('errors.permission_denied'));
}

async function exportRow(id) {
  await exportReport(String(id), 'csv', {});
}

async function archiveRow(row) {
  if (!await confirmAction(t('analytics.archiveConfirm', { name: row.name }))) return;
  const res = await archiveReport(String(row._id));
  if (res?.success) {
    captureAnalyticsReportArchived({ report_id: row._id });
    await refreshList();
  }
}

onMounted(() => {
  captureAnalyticsModuleVisited({ surface: 'reports_list' });
  void fetchCatalog();
});
</script>
