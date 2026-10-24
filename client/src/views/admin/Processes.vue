<template>
  <div class="mx-auto w-full">
    <ListView
      :title="t('process.processListTitle')"
      :description="t('process.processListDescription')"
      module-key="processes"
      :create-label="t('process.processNew')"
      :search-placeholder="processLabel('process.searchPlaceholder', t('common.searchPlaceholder'))"
      :data="pagedProcesses"
      :columns="columns"
      :loading="loading"
      :pagination="listPagination"
      table-id="admin-processes-table"
      row-key="_id"
      :empty-title="t('process.processEmptyTitle')"
      :empty-message="t('process.processListDescription')"
      :show-import="false"
      :show-export="false"
      :show-stats="false"
      :selectable="false"
      :row-can-delete="(row) => String(row?.status || '').toLowerCase() !== 'active'"
      @create="openDesignerNew"
      @update:search-query="onSearchChange"
      @update:filters="onFiltersChange"
      @update:pagination="onPaginationChange"
      @fetch="loadProcesses"
      @row-click="editProcess"
      @edit="editProcess"
      @delete="deleteProcess"
    >
      <template #cell-name="{ row }">
        <div class="min-w-0">
          <div class="font-semibold text-gray-900 dark:text-white truncate">
            {{ row.name }}
          </div>
          <div
            v-if="row.description"
            class="text-sm text-gray-500 dark:text-gray-400 truncate"
          >
            {{ row.description }}
          </div>
        </div>
      </template>

      <template #cell-appKey="{ value }">
        <span class="text-gray-700 dark:text-gray-300">{{ value || '—' }}</span>
      </template>

      <template #cell-triggerLabel="{ value }">
        <span class="text-gray-700 dark:text-gray-300">{{ value || '—' }}</span>
      </template>

      <template #cell-nodeCount="{ value }">
        <span class="text-gray-700 dark:text-gray-300">{{ value ?? 0 }}</span>
      </template>

      <template #cell-status="{ value }">
        <BadgeCell
          :value="processStatusLabel(value)"
          :variant-map="statusVariantMap"
        />
      </template>

      <template #cell-updatedAt="{ value }">
        <span class="text-gray-700 dark:text-gray-300">{{ formatDate(value) }}</span>
      </template>

      <template #actions="{ row }">
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
            :title="t('process.processTooltipViewLogs')"
            @click.stop="viewExecutions(row)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button
            v-if="row.status === 'draft'"
            type="button"
            class="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
            :title="t('process.processTooltipActivate')"
            @click.stop="activateProcess(row)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button
            v-else-if="row.status === 'active'"
            type="button"
            class="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-colors"
            :title="t('process.processTooltipDeactivate')"
            @click.stop="deactivateProcess(row)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </button>
          <button
            type="button"
            class="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
            :title="t('actions.duplicate')"
            @click.stop="duplicateProcess(row)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            type="button"
            class="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
            :title="t('actions.edit')"
            @click.stop="editProcess(row)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            v-if="row.status !== 'active'"
            type="button"
            class="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            :title="t('process.processTooltipDelete')"
            @click.stop="deleteProcess(row)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </template>
    </ListView>

    <div
      v-if="error"
      class="mt-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300"
    >
      {{ error }}
    </div>

    <ProcessExecutionLogs
      v-if="viewingExecutions"
      :process="viewingExecutions"
      @close="viewingExecutions = null"
    />
  </div>
</template>

<script setup>
defineOptions({ name: 'ProcessesView' });
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import ListView from '@/components/common/ListView.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import ProcessExecutionLogs from '@/components/admin/ProcessExecutionLogs.vue';

import { useNotifications } from '@/composables/useNotifications';
import { confirmAction } from '@/composables/useConfirmAction';
import { formatTime, formatUserDate } from '@/utils/localeFormat';
const { t, te } = useI18n();
const notifications = useNotifications();

const router = useRouter();

const processes = ref([]);
const loading = ref(true);
const error = ref(null);
const searchQuery = ref('');
const viewingExecutions = ref(null);

const filters = reactive({
  appKey: '',
  status: ''
});

const pagination = reactive({
  currentPage: 1,
  limit: 20
});

/** Avoid freezing `[missing:…]` into ListView column prefs before deferred `process` ns loads. */
function processLabel(key, fallback) {
  return te(key) ? t(key) : fallback;
}

const statusVariantMap = computed(() => ({
  [processLabel('process.statusActive', 'Active')]: 'success',
  [processLabel('process.statusDraft', 'Draft')]: 'warning',
  [processLabel('process.statusArchived', 'Archived')]: 'default'
}));

const columns = computed(() => [
  { key: 'name', label: processLabel('process.colName', 'Name'), sortable: true },
  {
    key: 'appKey',
    label: processLabel('process.colApp', 'App'),
    dataType: 'select',
    sortable: true,
    options: [
      { value: 'PLATFORM', label: processLabel('process.appKeyPlatform', 'PLATFORM') },
      { value: 'SALES', label: processLabel('process.appKeySales', 'SALES') },
      { value: 'AUDIT', label: processLabel('process.appKeyAudit', 'AUDIT') },
      { value: 'PORTAL', label: processLabel('process.appKeyPortal', 'PORTAL') }
    ]
  },
  { key: 'triggerLabel', label: processLabel('process.colTrigger', 'Trigger'), sortable: true },
  { key: 'nodeCount', label: processLabel('process.colNodes', 'Nodes'), sortable: true },
  {
    key: 'status',
    label: processLabel('process.colStatus', 'Status'),
    dataType: 'status',
    sortable: true,
    options: [
      { value: 'draft', label: processLabel('process.statusDraft', 'Draft') },
      { value: 'active', label: processLabel('process.statusActive', 'Active') },
      { value: 'archived', label: processLabel('process.statusArchived', 'Archived') }
    ]
  },
  { key: 'updatedAt', label: processLabel('process.colUpdated', 'Updated'), dataType: 'date', sortable: true }
]);

function triggerLabel(process) {
  const type = process?.trigger?.type;
  if (type === 'domain_event') return process.trigger?.eventType || '—';
  if (type === 'webhook') return t('process.triggerWebhook');
  if (type === 'schedule') return t('process.triggerSchedule');
  return t('process.triggerManual');
}

const tableRows = computed(() =>
  processes.value.map((process) => ({
    ...process,
    triggerLabel: triggerLabel(process),
    nodeCount: process.nodes?.length || 0
  }))
);

const filteredProcesses = computed(() => {
  let result = tableRows.value;
  const query = searchQuery.value.trim().toLowerCase();
  if (query) {
    result = result.filter((row) => {
      const name = String(row.name || '').toLowerCase();
      const description = String(row.description || '').toLowerCase();
      const appKey = String(row.appKey || '').toLowerCase();
      const trigger = String(row.triggerLabel || '').toLowerCase();
      return (
        name.includes(query) ||
        description.includes(query) ||
        appKey.includes(query) ||
        trigger.includes(query)
      );
    });
  }
  if (filters.appKey) {
    result = result.filter(
      (row) => String(row.appKey || '').toUpperCase() === String(filters.appKey).toUpperCase()
    );
  }
  if (filters.status) {
    result = result.filter(
      (row) => String(row.status || '').toLowerCase() === String(filters.status).toLowerCase()
    );
  }
  return result;
});

const pagedProcesses = computed(() => {
  const start = (pagination.currentPage - 1) * pagination.limit;
  return filteredProcesses.value.slice(start, start + pagination.limit);
});

const listPagination = computed(() => {
  const total = filteredProcesses.value.length;
  const totalPages = Math.max(1, Math.ceil(total / pagination.limit) || 1);
  return {
    currentPage: pagination.currentPage,
    totalPages,
    totalRecords: total,
    limit: pagination.limit
  };
});

function processStatusLabel(status) {
  if (status === 'active') return t('process.statusActive');
  if (status === 'draft') return t('process.statusDraft');
  return t('process.statusArchived');
}

const loadProcesses = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.get('/admin/processes');
    processes.value = response.data || [];
  } catch (err) {
    error.value = err.message || t('process.processLoadFailed');
    console.error('Error loading processes:', err);
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  return (
    formatUserDate(date) +
    ' ' +
    formatTime(date, { hour: '2-digit', minute: '2-digit' })
  );
};

const onSearchChange = (query) => {
  searchQuery.value = String(query || '');
  pagination.currentPage = 1;
};

const onFiltersChange = (nextFilters = {}) => {
  filters.appKey = nextFilters.appKey || '';
  filters.status = nextFilters.status || '';
  pagination.currentPage = 1;
};

const onPaginationChange = (next = {}) => {
  pagination.currentPage = next.currentPage || 1;
  pagination.limit = next.limit || pagination.limit;
};

const openDesignerNew = () => {
  router.push({ name: 'process-designer-new' });
};

const editProcess = (process) => {
  if (!process?._id) return;
  router.push({ name: 'process-designer', params: { id: process._id } });
};

const duplicateProcess = (process) => {
  if (!process?._id) return;
  router.push({
    name: 'process-designer-new',
    query: { duplicateFrom: String(process._id) }
  });
};

const activateProcess = async (process) => {
  try {
    const response = await apiClient.put(`/admin/processes/${process._id}/status`, {
      status: 'active'
    });
    if (response.success) {
      await loadProcesses();
      notifications.success(t('process.processActivateSuccess'));
    }
  } catch (err) {
    notifications.error(err.message || t('process.processActivateFailed'));
  }
};

const deactivateProcess = async (process) => {
  try {
    const response = await apiClient.put(`/admin/processes/${process._id}/status`, {
      status: 'archived'
    });
    if (response.success) {
      await loadProcesses();
      notifications.success(t('process.processDeactivateSuccess'));
    }
  } catch (err) {
    notifications.error(err.message || t('process.processDeactivateFailed'));
  }
};

const deleteProcess = async (process) => {
  const status = String(process?.status || '').toLowerCase();
  if (status === 'active') {
    notifications.warning(t('process.processDeleteActiveBlocked'));
    return;
  }
  const ok = await confirmAction(t('process.processDeleteConfirm', { name: process.name || '' }));
  if (!ok) return;
  try {
    const response = await apiClient.delete(`/admin/processes/${process._id}`);
    if (response?.success !== false) {
      await loadProcesses();
      return;
    }
    notifications.error(response?.message || t('process.processDeleteFailed'));
  } catch (err) {
    notifications.error(err?.response?.data?.message || err.message || t('process.processDeleteFailed'));
  }
};

const viewExecutions = (process) => {
  viewingExecutions.value = process;
};

onMounted(() => {
  document.title = t('process.processListPageTitle');
  loadProcesses();
});
</script>
