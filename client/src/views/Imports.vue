<template>
  <div class="mx-auto w-full">
    <ListView
      :title="t('import.importsImportHistory')"
      :description="t('import.importsDescription')"
      module-key="imports"
      :create-label="t('import.importsNewImport2')"
      :search-placeholder="t('import.importsSearchByFilename')"
      :data="filteredImports"
      :columns="columns"
      :loading="loading"
      :statistics="stats"
      :stats-config="statsConfig"
      :pagination="{ currentPage: pagination.currentPage, totalPages: pagination.totalPages, totalRecords: pagination.total, limit: pagination.limit }"
      table-id="imports-table"
      row-key="_id"
      :empty-title="t('import.importsNoImportsYet')"
      :empty-message="t('import.importsEmptyMessage')"
      :show-import="false"
      :show-export="false"
      @create="showImportModal = true"
      @update:searchQuery="(q) => { searchQuery.value = q; }"
      @update:filters="(newFilters) => { Object.assign(filters, newFilters); }"
      @update:pagination="(p) => { pagination.currentPage = p.currentPage; pagination.limit = p.limit || pagination.limit; fetchImports(); }"
      @fetch="fetchImports"
      @row-click="viewImport"
      @delete="handleDelete"
      @bulk-action="handleBulkAction"
    >
      <template #header-actions>
        <button v-if="canCreateImport" @click="showImportModal = true" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>{{ t('import.importsNewImport') }}</button>
      </template>
      <!-- Custom File Name Cell -->
      <template #cell-fileName="{ value }">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span class="font-medium">{{ value }}</span>
        </div>
      </template>

      <!-- Custom Module Cell with Badge -->
      <template #cell-module="{ value }">
        <BadgeCell 
          :value="formatModule(value)" 
          :variant-map="{
            'Contacts': 'primary',
            'Deals': 'success',
            'Tasks': 'warning',
            'Organizations': 'info'
          }"
        />
      </template>

      <!-- Custom Imported By Cell -->
      <template #cell-importedBy="{ row }">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-sm font-medium">
            {{ (row.importedBy?.firstName?.[0] || '') + (row.importedBy?.lastName?.[0] || '') }}
          </div>
          <span>{{ row.importedBy?.firstName }} {{ row.importedBy?.lastName }}</span>
        </div>
      </template>

      <!-- Custom Date Cell -->
      <template #cell-createdAt="{ value }">
        <span class="text-gray-700 dark:text-gray-300">{{ formatDate(value) }}</span>
      </template>

      <!-- Custom Status Cell with Badge -->
      <template #cell-status="{ value }">
        <BadgeCell 
          :value="formatStatus(value)" 
          :variant-map="{
            'Completed': 'success',
            'Partial': 'warning',
            'Failed': 'danger',
            'Processing': 'info'
          }"
        />
      </template>

      <!-- Custom Stats Cell -->
      <template #cell-stats="{ row }">
        <div v-if="row.status === 'processing'" class="space-y-2">
          <p class="text-xs font-medium text-indigo-600 dark:text-indigo-400">
            {{ t('import.importRecordsProgress', {
              processed: formatCount(getProcessingProgress(row).processed),
              total: formatCount(getProcessingProgress(row).total),
            }) }}
          </p>
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              class="h-full rounded-full bg-indigo-600 transition-all duration-300"
              :style="{ width: `${getProcessingPercent(row)}%` }"
            />
          </div>
        </div>
        <div v-else class="text-sm space-y-0.5">
          <div v-if="row.stats.created > 0" class="text-green-600 dark:text-green-400">
            ✓ {{ t('import.importsCellCreated', { count: row.stats.created }) }}
          </div>
          <div v-if="row.stats.updated > 0" class="text-blue-600 dark:text-blue-400">
            ↻ {{ t('import.importsCellUpdated', { count: row.stats.updated }) }}
          </div>
          <div v-if="row.stats.skipped > 0" class="text-gray-600 dark:text-gray-400">
            ⊘ {{ t('import.importsCellSkipped', { count: row.stats.skipped }) }}
          </div>
          <div v-if="row.stats.failed > 0" class="text-red-600 dark:text-red-400">
            ✕ {{ t('import.importsCellFailed', { count: row.stats.failed }) }}
          </div>
        </div>
      </template>

      <!-- Custom Actions -->
      <template #actions="{ row }">
        <button 
          @click.stop="viewImport(row)" 
          class="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all hover:scale-105"
        >{{ t('process.execLogsViewDetails') }}</button>
      </template>
    </ListView>

    <!-- Universal Import Modal -->
    <UniversalImportModal 
      v-if="showImportModal"
      @close="showImportModal = false"
      @import-complete="handleImportComplete"
    />
  </div>
</template>

<script setup>
defineOptions({ name: 'ImportsView' });
import { useI18n } from 'vue-i18n';

import { useNotifications } from '@/composables/useNotifications';
const { t } = useI18n();
const notifications = useNotifications();

import { ref, reactive, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import apiClient from '../utils/apiClient';
import ListView from '@/components/common/ListView.vue';
import BadgeCell from '../components/common/table/BadgeCell.vue';
import UniversalImportModal from '../components/import/UniversalImportModal.vue';
import { useActiveImportsStore } from '@/stores/activeImports';
import { startBulkDelete } from '@/utils/runBulkDelete';
import { formatUserDate, formatNumber, formatTime as formatLocaleTime } from '@/utils/localeFormat';

// Router and auth
const router = useRouter();
const authStore = useAuthStore();
const activeImportsStore = useActiveImportsStore();

// Use tabs composable
const { openTab } = useTabs();

// Permission checks
const canCreateImport = computed(() => authStore.hasPermission('imports', 'create'));
const canDeleteImport = computed(() => authStore.hasPermission('imports', 'delete'));


// State
const imports = ref([]);
const loading = ref(false);
const showImportModal = ref(false);
const searchQuery = ref('');

const filters = reactive({
  module: '',
  status: ''
});

const MODULE_LABEL_KEYS = {
  contacts: 'navigation.modulePeople',
  people: 'navigation.modulePeople',
  deals: 'navigation.moduleDeals',
  tasks: 'navigation.moduleTasks',
  organizations: 'navigation.moduleOrganizations'
};

const statsConfig = computed(() => [
  { name: t('import.importsStatTotalImports'), key: 'totalImports', formatter: 'number' },
  { name: t('import.importsStatRecordsCreated'), key: 'totalRecordsCreated', formatter: 'number' },
  { name: t('import.importsStatRecordsUpdated'), key: 'totalRecordsUpdated', formatter: 'number' },
  { name: t('import.importsStatTotalErrors'), key: 'totalErrors', formatter: 'number' }
]);

// Column definitions
const columns = computed(() => {
  return [
    { key: 'fileName', label: t('import.importsColFileName'), sortable: true },
    {
      key: 'module',
      label: t('import.importsColModule'),
      dataType: 'select',
      sortable: true,
      options: [
        { value: 'contacts', label: t('navigation.modulePeople') },
        { value: 'deals', label: t('navigation.moduleDeals') },
        { value: 'tasks', label: t('navigation.moduleTasks') },
        { value: 'organizations', label: t('navigation.moduleOrganizations') }
      ]
    },
    { key: 'importedBy', label: t('import.importsColImportedBy'), dataType: 'user', sortable: true },
    { key: 'createdAt', label: t('import.importsColDate'), dataType: 'date', sortable: true },
    {
      key: 'status',
      label: t('import.importsColStatus'),
      dataType: 'status',
      sortable: true,
      options: [
        { value: 'completed', label: t('import.importsStatusCompleted') },
        { value: 'partial', label: t('import.importsStatusPartial') },
        { value: 'failed', label: t('import.importsStatusFailed') },
        { value: 'processing', label: t('import.importsStatusProcessing') }
      ]
    },
    { key: 'stats', label: t('import.importsColRecords'), sortable: false }
  ];
});

// Filtered imports (client-side filtering for search)
const filteredImports = computed(() => {
  let result = imports.value;
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(imp => 
      imp.fileName.toLowerCase().includes(query)
    );
  }
  
  return result;
});

const stats = reactive({
  totalImports: 0,
  recentImports: 0,
  totalRecordsCreated: 0,
  totalRecordsUpdated: 0,
  totalErrors: 0,
  avgProcessingTime: 0
});

const pagination = reactive({
  currentPage: 1,
  totalPages: 1,
  total: 0,
  limit: 20
});

// Fetch imports
const fetchImports = async () => {
  try {
    loading.value = true;
    const response = await apiClient.get('/imports', {
      params: {
        module: filters.module,
        status: filters.status,
        page: pagination.currentPage,
        limit: pagination.limit
      }
    });
    
    if (response.success) {
      imports.value = response.data;
      Object.assign(pagination, response.pagination);
      syncProcessingImports();
      ensureListRefreshPolling();
    }
  } catch (error) {
    console.error('Error fetching imports:', error);
  } finally {
    loading.value = false;
  }
};

// Fetch statistics
const fetchStats = async () => {
  try {
    const response = await apiClient.get('/imports/stats/summary');
    if (response.success) {
      Object.assign(stats, response.data);
    }
  } catch (error) {
    console.error('Error fetching stats:', error);
  }
};

// View import details
const viewImport = (importRecord, event = null) => {
  const title = `Import: ${importRecord.fileName || 'Unknown'}`;
  
  // Check if user wants to open in background
  const openInBackground = event && (
    event.button === 1 || // Middle mouse button
    event.metaKey ||      // Cmd on Mac
    event.ctrlKey         // Ctrl on Windows/Linux
  );
  
  openTab(`/imports/${importRecord._id}`, {
    title,
    icon: 'download',
    params: { fileName: importRecord.fileName },
    background: openInBackground,
    insertAdjacent: true
  });
};

// Handle import complete
const handleImportComplete = () => {
  showImportModal.value = false;
  fetchImports();
  fetchStats();
};

function isBulkSelectionPayload(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && 'mode' in value;
}

async function resolveAllImportIds(excludedIds = []) {
  const excluded = new Set(excludedIds.map(String));
  const ids = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await apiClient.get('/imports', {
      params: {
        module: filters.module,
        status: filters.status,
        page,
        limit: pagination.limit,
      },
    });
    if (!response.success) break;
    for (const row of response.data || []) {
      const id = String(row._id);
      if (!excluded.has(id)) ids.push(id);
    }
    totalPages = response.pagination?.totalPages || 1;
    page += 1;
  } while (page <= totalPages);

  return ids;
}

async function refreshAfterBulkDelete(outcome) {
  if (outcome.cancelled) {
    if (outcome.deletedCount > 0) {
      await fetchImports();
      await fetchStats();
    }
    return;
  }
  if (outcome.failedCount > 0) {
    const errorMessage =
      outcome.firstError?.response?.data?.message ||
      outcome.firstError?.message ||
      t('common.listBulkDeleteIncomplete', { deleted: outcome.deletedCount, total: outcome.requestedCount });
    notifications.error(errorMessage);
    if (outcome.deletedCount > 0) {
      await fetchImports();
      await fetchStats();
    }
    return;
  }
  await fetchImports();
  await fetchStats();
}

const handleDelete = async (row) => {
  if (!row?._id) return;
  startBulkDelete({
    moduleKey: 'imports',
    ids: [String(row._id)],
    onComplete: refreshAfterBulkDelete,
    onError: (error) => {
      console.error('Error deleting import:', error);
      notifications.error(error?.response?.data?.message || error?.message || t('common.listBulkDeleteIncomplete', { deleted: 0, total: 1 }));
    },
  });
};

const handleBulkAction = async (actionId, payloadOrRows) => {
  if (actionId !== 'bulk-delete' && actionId !== 'delete') return;

  let selection = isBulkSelectionPayload(payloadOrRows) ? payloadOrRows : null;
  let pageIds = null;

  if (!selection && Array.isArray(payloadOrRows)) {
    pageIds = payloadOrRows.map((r) => String(r?._id || r?.id)).filter(Boolean);
  }

  if (selection?.mode === 'all') {
    const resolvedIds = await resolveAllImportIds(selection.excludedIds || []);
    selection = {
      mode: 'page',
      selectedIds: resolvedIds,
      selectionCount: resolvedIds.length,
      excludedIds: [],
    };
  }

  startBulkDelete({
    moduleKey: 'imports',
    selection,
    pageIds,
    onComplete: refreshAfterBulkDelete,
    onError: (error) => {
      console.error('Error deleting imports:', error);
      notifications.error(error?.response?.data?.message || error?.message || t('common.listBulkDeleteIncomplete', { deleted: 0, total: 1 }));
    },
  });
};

// Pagination handled by ListView component

// Format helpers
const formatModule = (module) => {
  const key = MODULE_LABEL_KEYS[module];
  return key ? t(key) : module.charAt(0).toUpperCase() + module.slice(1);
};

const formatStatus = (status) => {
  const statusKeys = {
    completed: 'import.importsStatusCompleted',
    partial: 'import.importsStatusPartial',
    failed: 'import.importsStatusFailed',
    processing: 'import.importsStatusProcessing'
  };
  const key = statusKeys[status];
  return key ? t(key) : status.charAt(0).toUpperCase() + status.slice(1);
};

const formatDate = (date) => {
  return formatUserDate(date) || '-';
};

const formatTime = (date) => {
  return formatLocaleTime(date, { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

const formatCount = (value) => formatNumber(Number(value || 0));

function getProcessingProgress(row) {
  const tracked = activeImportsStore.getImport(row._id);
  if (tracked) {
    return {
      processed: tracked.processed ?? 0,
      total: tracked.total ?? row.stats?.total ?? 0,
    };
  }
  return {
    processed: row.stats?.processed ?? 0,
    total: row.stats?.total ?? 0,
  };
}

function getProcessingPercent(row) {
  const { processed, total } = getProcessingProgress(row);
  if (!total) return 0;
  return Math.min(100, Math.round((processed / total) * 100));
}

function syncProcessingImports() {
  imports.value
    .filter((row) => row.status === 'processing')
    .forEach((row) => {
      activeImportsStore.trackImport({
        importId: row._id,
        fileName: row.fileName,
        module: row.module,
        total: row.stats?.total ?? 0,
      });
    });
}

let listRefreshTimer = null;

function ensureListRefreshPolling() {
  const hasProcessingRows = imports.value.some((row) => row.status === 'processing')
    || activeImportsStore.hasProcessing;
  if (!hasProcessingRows) {
    if (listRefreshTimer) {
      clearInterval(listRefreshTimer);
      listRefreshTimer = null;
    }
    return;
  }
  if (listRefreshTimer) return;
  listRefreshTimer = setInterval(() => {
    fetchImports();
    fetchStats();
  }, 5000);
}

const getStatusClass = (status) => {
  const classes = {
    completed: 'badge badge-success',
    partial: 'badge badge-warning',
    failed: 'badge badge-danger',
    processing: 'badge badge-info'
  };
  return classes[status] || 'badge';
};

// Column settings handled by ListView component

// Watch filters
watch([() => filters.module, () => filters.status], () => {
  pagination.currentPage = 1;
  fetchImports();
});

// Initialize
onMounted(() => {
  fetchImports();
  fetchStats();
});

onBeforeUnmount(() => {
  if (listRefreshTimer) {
    clearInterval(listRefreshTimer);
    listRefreshTimer = null;
  }
});

watch(
  () => activeImportsStore.processingImports.length,
  () => {
    ensureListRefreshPolling();
  }
);
</script>

