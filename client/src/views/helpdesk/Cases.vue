<template>
  <div class="mx-auto w-full" :data-view="currentView">
    <ModuleList
      ref="moduleListRef"
      module-key="cases"
      app-key="HELPDESK"
      :view-mode="currentView"
      @row-click="handleRowClick"
      @edit="editCaseFromList"
      @bulk-action="handleBulkAction"
      @filters-changed="handleFiltersChanged"
      @search-changed="handleSearchChanged"
      @kanban-settings-changed="refreshKanbanSettings"
      @stats-visibility-changed="(val) => (statsOpen = val)"
    >
      <template #cell-responseMetAt="{ row }">
        <CaseResponseSlaListCell :row="row" />
      </template>

      <template #cell-status="{ value }">
        <BadgeCell
          v-if="value"
          :value="value"
          :color="getStatusColor(value)"
          :variant-map="CASE_STATUS_VARIANT_MAP"
        />
        <span v-else class="text-gray-500 dark:text-gray-400">-</span>
      </template>

      <template #cell-priority="{ value }">
        <BadgeCell
          v-if="value"
          :value="value"
          :variant-map="CASE_PRIORITY_VARIANT_MAP"
        />
        <span v-else class="text-gray-500 dark:text-gray-400">-</span>
      </template>

      <template #cell-caseType="{ value }">
        <BadgeCell v-if="value" :value="value" />
        <span v-else class="text-gray-500 dark:text-gray-400">-</span>
      </template>

      <template #cell-channel="{ value }">
        <BadgeCell v-if="value" :value="value" />
        <span v-else class="text-gray-500 dark:text-gray-400">-</span>
      </template>

      <template #cell-assignedTo="{ row }">
        <div v-if="row.assignedTo" class="flex items-center gap-2">
          <Avatar
            v-if="typeof row.assignedTo === 'object'"
            :user="{
              firstName: row.assignedTo.firstName || row.assignedTo.first_name,
              lastName: row.assignedTo.lastName || row.assignedTo.last_name,
              email: row.assignedTo.email,
              avatar: row.assignedTo.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ getUserDisplayName(row.assignedTo) }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('records.editableUnassigned') }}</span>
      </template>

      <template #cell-contactId="{ row }">
        <div v-if="row.contactId" class="flex items-center gap-2 min-w-0">
          <Avatar
            v-if="typeof row.contactId === 'object'"
            :user="{
              firstName: row.contactId.first_name || row.contactId.firstName,
              lastName: row.contactId.last_name || row.contactId.lastName,
              email: row.contactId.email,
              avatar: row.contactId.avatar || row.contactId.image
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300 truncate">
            {{ getContactDisplayName(row.contactId) }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <template #cell-updatedAt="{ value }">
        <DateCell :value="value" format="short" />
      </template>

      <template #header-actions>
        <div class="flex gap-3 items-center">
          <div class="relative flex h-[34px] items-stretch rounded-lg bg-gray-100 dark:bg-gray-700/90 p-[0.1rem] border border-gray-200/80 dark:border-gray-600 shadow-inner min-w-[200px]">
            <button
              type="button"
              @click="switchView('kanban')"
              class="relative z-10 flex-1 flex items-center justify-center gap-1.5 px-2.5 py-0 rounded-md text-xs sm:text-sm font-medium transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:ring-offset-gray-800 overflow-visible"
              :class="currentView === 'kanban' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'"
            >
              <ViewColumnsIcon class="w-4 h-4 shrink-0" />{{ t('cases.casesBoard') }}
            </button>
            <button
              type="button"
              @click="switchView('list')"
              class="relative z-10 flex-1 flex items-center justify-center gap-1.5 px-2.5 py-0 rounded-md text-xs sm:text-sm font-medium transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:ring-offset-gray-800 overflow-visible"
              :class="currentView === 'list' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'"
            >
              <ListBulletIcon class="w-4 h-4 shrink-0" />{{ t('forms.rbLayoutList') }}
            </button>
          </div>
          <ModuleActions
            module="cases"
            :create-label="t('cases.casesNewCase')"
            :show-import="false"
            :show-export="false"
            @create="openCreateCase"
          />
        </div>
      </template>
    </ModuleList>

    <div
      v-if="currentView === 'kanban'"
      class="kanban-view-container mt-4"
      style="min-height: 400px;"
    >
      <KanbanBoard
        :items="kanbanCases"
        :stages="caseStages"
        stage-key="status"
        item-id-key="_id"
        :loading="kanbanLoading"
        :loading-label="t('cases.casesLoadingBoard')"
        :get-stage-color="getStatusColor"
        :card-size="kanbanCardSize"
        :collapse-empty-columns="kanbanCollapseEmptyColumns"
        :stats-open="statsOpen"
        @update="handleKanbanUpdate"
        @card-click="({ item, event }) => handleCaseCardClick(item, event)"
      >
        <template #column-header="{ stage, count, stageColor }">
          <div
            :class="[
              'flex items-center gap-2.5 px-3 py-1.5 rounded-full min-w-0 flex-1',
              stageColor ? 'bg-white/20 text-white' : 'bg-white/80 dark:bg-gray-600/80 text-gray-700 dark:text-gray-200'
            ]"
          >
            <span class="font-semibold text-sm truncate">{{ stage }}</span>
            <span
              :class="[
                'flex-shrink-0 text-xs font-bold tabular-nums',
                stageColor ? 'text-white/90' : 'text-gray-600 dark:text-gray-300'
              ]"
            >
              {{ count }}
            </span>
          </div>
        </template>
        <template #card="{ item: row }">
          <div
            v-if="kanbanShownFieldKeys.includes('title') && (kanbanShowEmptyFields || (row.title != null && row.title !== ''))"
            class="mb-2"
          >
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white leading-tight line-clamp-2">
              {{ row.title || row.caseId || '—' }}
            </h4>
          </div>

          <div
            v-if="kanbanMetaFieldKeys.length"
            :class="[
              'text-xs text-gray-600 dark:text-gray-400',
              kanbanStackFields ? 'flex flex-col gap-1.5' : 'flex flex-wrap items-center gap-x-3 gap-y-1.5'
            ]"
          >
            <template v-for="key in kanbanMetaFieldKeys" :key="key">
              <template v-if="kanbanShowEmptyFields || !isCaseFieldEmpty(row, key)">
                <div v-if="key === 'caseId'" class="flex items-center gap-1.5 min-w-0">
                  <HashtagIcon class="w-3.5 h-3.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                  <span class="truncate">{{ row.caseId }}</span>
                </div>
                <div v-else-if="key === 'priority'" class="flex items-center gap-1.5 min-w-0">
                  <FlagIcon class="w-3.5 h-3.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                  <span class="truncate">{{ row.priority || '—' }}</span>
                </div>
                <div v-else-if="key === 'assignedTo'" class="flex items-center gap-1.5 min-w-0">
                  <UserIcon class="w-3.5 h-3.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                  <span class="truncate">{{ getUserDisplayName(row.assignedTo) }}</span>
                </div>
                <div v-else-if="key === 'responseMetAt'" class="flex items-center gap-1.5 min-w-0">
                  <CaseResponseSlaListCell :row="row" />
                </div>
                <div v-else-if="key === 'status'" class="flex items-center gap-1.5 min-w-0">
                  <span class="truncate">{{ row.status || '—' }}</span>
                </div>
                <div v-else class="flex items-center gap-1.5 min-w-0 truncate">
                  <HashtagIcon class="w-3.5 h-3.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                  <span class="truncate">{{ formatCaseCardValue(row?.[key], key) }}</span>
                </div>
              </template>
            </template>
          </div>
        </template>
        <template #empty>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('cases.casesNoCasesInThisStatus') }}</p>
        </template>
        <template #add-item="{ stage, isEmpty, stageColor }">
          <button
            type="button"
            class="kanban-add-btn w-full flex items-center justify-left gap-2 text-sm font-normal transition-colors py-2 px-3 rounded-xl cursor-pointer"
            :class="[
              isEmpty && 'border-gray-200 dark:border-gray-600',
              isEmpty && !stageColor && 'hover:bg-amber-50/80 dark:hover:bg-amber-900/20 hover:border-amber-200 dark:hover:border-amber-800 text-gray-500 dark:text-gray-400',
              !stageColor && !isEmpty && 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300',
              stageColor && 'border-transparent'
            ]"
            :style="stageColor ? { color: stageColor, '--add-btn-hover-bg': hexToRgba(stageColor, 0.12) } : {}"
            @click.stop="openCreateCaseInStatus(stage)"
          >
            <PlusIcon class="w-4 h-4 flex-shrink-0" />{{ t('cases.casesAddCase') }}
          </button>
        </template>
      </KanbanBoard>
    </div>

    <CreateRecordDrawer
      :isOpen="showCreateDrawer"
      moduleKey="cases"
      :initial-data="createInitialData"
      @close="closeCreateDrawer"
      @saved="handleSaved"
    />

    <CreateRecordDrawer
      :isOpen="showEditDrawer"
      moduleKey="cases"
      :record="editingCase"
      @close="closeEditDrawer"
      @saved="handleEditSaved"
    />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onActivated, nextTick, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import ModuleList from '@/components/module-list/ModuleList.vue';
import ModuleActions from '@/components/common/ModuleActions.vue';
import KanbanBoard from '@/components/common/KanbanBoard.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import CaseResponseSlaListCell from '@/components/cases/CaseResponseSlaListCell.vue';
import Avatar from '@/components/common/Avatar.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import { useTabs } from '@/composables/useTabs';
import { ListBulletIcon, ViewColumnsIcon, PlusIcon, HashtagIcon, FlagIcon, UserIcon } from '@heroicons/vue/24/outline';

import { useNotifications } from '@/composables/useNotifications';
const { t } = useI18n();
const notifications = useNotifications();

const router = useRouter();
const route = useRoute();
const { openTab } = useTabs();

const moduleListRef = ref(null);

const CASE_STATUS_VARIANT_MAP = {
  New: 'info',
  Assigned: 'primary',
  'In Progress': 'warning',
  'On Hold': 'default',
  'Waiting for Customer': 'primary',
  Resolved: 'success',
  Closed: 'default'
};

const CASE_PRIORITY_VARIANT_MAP = {
  Low: 'default',
  Medium: 'info',
  High: 'warning',
  Critical: 'danger'
};

// View state (module-specific URL param so other modules don't affect it)
const viewStorageKey = 'arivu-cases-view';
const VIEW_QUERY_KEY = 'casesView';
const getInitialView = () => {
  try {
    const savedView = localStorage.getItem(viewStorageKey);
    return savedView === 'list' ? 'list' : 'kanban';
  } catch {
    return 'list';
  }
};
const currentView = ref(getInitialView());

// Kanban state
const kanbanCases = ref([]);
const kanbanLoading = ref(false);
const statsOpen = ref(true);
// Kanban options (from localStorage, same keys as ListView Customize Kanban for cases)
const KANBAN_OPTIONS_KEY = 'arivu-listview-cases-kanban-options';
const KANBAN_FIELDS_KEY = 'arivu-listview-cases-kanban-fields';
const DEFAULT_CASE_KANBAN_KEYS = ['title', 'caseId', 'priority', 'assignedTo'];
const kanbanSettingsVersion = ref(0);
const refreshKanbanSettings = () => { kanbanSettingsVersion.value++; };

const kanbanCardSize = computed(() => {
  kanbanSettingsVersion.value;
  try {
    const raw = localStorage.getItem(KANBAN_OPTIONS_KEY);
    if (raw) {
      const opts = JSON.parse(raw);
      if (opts?.cardSize && ['small', 'medium', 'large'].includes(opts.cardSize)) return opts.cardSize;
    }
  } catch (_) {}
  return 'medium';
});

const kanbanStackFields = computed(() => {
  kanbanSettingsVersion.value;
  try {
    const raw = localStorage.getItem(KANBAN_OPTIONS_KEY);
    if (raw) {
      const opts = JSON.parse(raw);
      if (typeof opts?.stackFields === 'boolean') return opts.stackFields;
    }
  } catch (_) {}
  return true;
});

const kanbanShowEmptyFields = computed(() => {
  kanbanSettingsVersion.value;
  try {
    const raw = localStorage.getItem(KANBAN_OPTIONS_KEY);
    if (raw) {
      const opts = JSON.parse(raw);
      if (typeof opts?.showEmptyFields === 'boolean') return opts.showEmptyFields;
    }
  } catch (_) {}
  return true;
});

const kanbanCollapseEmptyColumns = computed(() => {
  kanbanSettingsVersion.value;
  try {
    const raw = localStorage.getItem(KANBAN_OPTIONS_KEY);
    if (raw) {
      const opts = JSON.parse(raw);
      if (typeof opts?.collapseEmptyColumns === 'boolean') return opts.collapseEmptyColumns;
    }
  } catch (_) {}
  return false;
});

const kanbanShownFieldKeys = computed(() => {
  kanbanSettingsVersion.value;
  try {
    const raw = localStorage.getItem(KANBAN_FIELDS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) {
        const keys = arr
          .filter((f) => f && f.key && (f.visible === true || f.visible === 'true' || f.showInTable === true))
          .map((f) => f.key)
          .filter((k) => k != null && k !== '');
        if (keys.length > 0) {
          if (!keys.includes('title')) keys.unshift('title');
          return keys;
        }
      }
    }
  } catch (_) {}
  return [...DEFAULT_CASE_KANBAN_KEYS];
});

const kanbanMetaFieldKeys = computed(() =>
  kanbanShownFieldKeys.value.filter((k) => k !== 'title')
);

// Simple default status colors (can be replaced by server-provided picklist colors later)
const DEFAULT_CASE_STATUS_COLORS = {
  New: '#3B82F6', // blue-500
  Assigned: '#6366F1', // indigo-500
  'In Progress': '#F59E0B', // amber-500
  'On Hold': '#6B7280', // gray-500
  'Waiting for Customer': '#8B5CF6', // violet-500
  Resolved: '#10B981', // emerald-500
  Closed: '#111827', // gray-900
};

function getStatusColor(status) {
  if (!status) return null;
  return DEFAULT_CASE_STATUS_COLORS[status] || null;
}

const caseStages = ['New', 'Assigned', 'In Progress', 'On Hold', 'Waiting for Customer', 'Resolved', 'Closed'];

const currentSearchQuery = ref('');

// Create drawer
const showCreateDrawer = ref(false);
const createInitialData = ref({});
const showEditDrawer = ref(false);
const editingCase = ref(null);

function hexToRgba(hex, alpha) {
  if (!hex) return null;
  const h = String(hex).replace(/^#/, '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getUserDisplayName(user) {
  if (!user) return '';
  if (typeof user === 'string') return user;
  const firstName = user.firstName || user.first_name || '';
  const lastName = user.lastName || user.last_name || '';
  return `${firstName} ${lastName}`.trim() || user.email || '';
}

function getContactDisplayName(contact) {
  if (!contact) return '';
  if (typeof contact === 'string') return contact;
  const firstName = contact.first_name || contact.firstName || '';
  const lastName = contact.last_name || contact.lastName || '';
  return `${firstName} ${lastName}`.trim() || contact.email || contact.name || '';
}

function isCaseFieldEmpty(row, key) {
  if (!row) return true;
  switch (key) {
    case 'title':
      return row.title == null || row.title === '';
    case 'caseId':
      return row.caseId == null || row.caseId === '';
    case 'priority':
      return !row.priority;
    case 'assignedTo':
      return !row.assignedTo;
    case 'status':
      return !row.status;
    default:
      return row[key] == null || row[key] === '';
  }
}

function formatCaseCardValue(value, _key) {
  if (value == null) return '—';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    if ('name' in value && value.name) return String(value.name);
    if ('label' in value && value.label) return String(value.label);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const toggleTableView = (showTable) => {
  const tableContainer = document.querySelector('.mt-4.px-4.sm\\:px-6.lg\\:px-8:not(.kanban-view-container)');
  if (tableContainer) {
    const hasTable =
      tableContainer.querySelector('table') !== null ||
      tableContainer.querySelector('[role="table"]') !== null ||
      tableContainer.querySelector('div[class*="table-scroll"]') !== null ||
      tableContainer.querySelector('div[class*="table-view"]') !== null;
    if (hasTable) {
      tableContainer.style.display = showTable ? '' : 'none';
    }
  }
};

function persistView(view) {
  try {
    localStorage.setItem(viewStorageKey, view);
  } catch (_) {
    // no-op
  }
}

function switchView(view) {
  if (view !== 'list' && view !== 'kanban') return;
  currentView.value = view;
  persistView(view);
  router.replace({ query: { ...route.query, [VIEW_QUERY_KEY]: view } });
  if (view === 'kanban') fetchKanbanCases();
  nextTick(() => setTimeout(() => toggleTableView(view === 'list'), 80));
}

function openCreateCase() {
  createInitialData.value = {};
  showCreateDrawer.value = true;
}

function openCreateCaseInStatus(status) {
  createInitialData.value = { status };
  showCreateDrawer.value = true;
}

function closeCreateDrawer() {
  showCreateDrawer.value = false;
}

function handleSaved() {
  showCreateDrawer.value = false;
  refreshList();
  if (currentView.value === 'kanban') fetchKanbanCases();
}

function editCaseFromList(row) {
  if (!row) return;
  editingCase.value = row;
  showEditDrawer.value = true;
}

function closeEditDrawer() {
  showEditDrawer.value = false;
  editingCase.value = null;
}

function handleEditSaved() {
  closeEditDrawer();
  refreshList();
  if (currentView.value === 'kanban') fetchKanbanCases();
}

function refreshList() {
  moduleListRef.value?.fetchData?.();
}

function handleRowClick(row, event) {
  const id = row?._id;
  if (!id) return;
  const openInBackground = event && (event.button === 1 || event.metaKey || event.ctrlKey);
  const title = row.title || row.caseId || t('navigation.moduleCases');
  openTab(`/helpdesk/cases/${id}`, { title, background: openInBackground, insertAdjacent: true });
}

function handleCaseCardClick(row, event) {
  handleRowClick(row, event);
}

const fetchKanbanCases = async () => {
  if (currentView.value !== 'kanban') return;
  kanbanLoading.value = true;
  try {
    const moduleListFilters = moduleListRef.value?.getFilters?.() || {};
    const moduleListSearch = currentSearchQuery.value || moduleListRef.value?.getSearchQuery?.() || '';
    const params = {};

    Object.keys(moduleListFilters).forEach((key) => {
      const value = moduleListFilters[key];
      if (value !== undefined && value !== '') params[key] = value;
      else if (value === null) params[key] = null;
    });

    if (moduleListSearch?.trim()) params.search = moduleListSearch.trim();
    params.limit = 500;
    params.page = 1;
    params.sortBy = 'createdAt';
    params.sortDir = 'desc';

    const response = await apiClient.get('/helpdesk/cases', { params });
    if (response?.success) {
      kanbanCases.value = Array.isArray(response.data) ? response.data : [];
    } else {
      kanbanCases.value = [];
    }
  } catch (err) {
    console.error('[Cases] Error fetching kanban cases:', err);
    kanbanCases.value = [];
  } finally {
    kanbanLoading.value = false;
  }
};

const bulkStatusOptions = ['New', 'Assigned', 'In Progress', 'On Hold', 'Waiting for Customer', 'Resolved', 'Closed'];
const bulkPriorityOptions = ['Low', 'Medium', 'High', 'Critical'];

async function handleBulkAction(action, rows) {
  const ids = Array.isArray(rows)
    ? rows.map((row) => row?._id).filter(Boolean)
    : [];
  if (ids.length === 0) return;

  if (action === 'delete' || action === 'bulk-delete') {
    await Promise.all(ids.map((id) => apiClient.delete(`/helpdesk/cases/${id}`)));
    refreshList();
    if (currentView.value === 'kanban') fetchKanbanCases();
    return;
  }

  let updates = null;
  if (action === 'bulk-update-status') {
    const value = window.prompt(`Enter status (${bulkStatusOptions.join(', ')})`);
    if (!value || !bulkStatusOptions.includes(String(value).trim())) return;
    updates = { status: String(value).trim() };
  } else if (action === 'bulk-update-priority') {
    const value = window.prompt(`Enter priority (${bulkPriorityOptions.join(', ')})`);
    if (!value || !bulkPriorityOptions.includes(String(value).trim())) return;
    updates = { priority: String(value).trim() };
  } else if (action === 'bulk-assign-owner') {
    const value = window.prompt('Enter owner user ID');
    if (!String(value || '').trim()) return;
    updates = { assignedTo: String(value).trim() };
  } else {
    return;
  }

  try {
    const response = await apiClient.patch('/helpdesk/cases/bulk/update', { ids, updates });
    if (!response?.success) {
      throw new Error(response?.message || 'Bulk update failed');
    }
    refreshList();
    if (currentView.value === 'kanban') fetchKanbanCases();
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || 'Bulk update failed');
  }
}

const handleKanbanUpdate = async ({ item, newStage }) => {
  const id = item?._id != null ? (typeof item._id === 'string' ? item._id : String(item._id)) : null;
  if (!id) return;
  try {
    await apiClient.patch(`/helpdesk/cases/${id}/status`, { status: newStage });
    await fetchKanbanCases();
    refreshList();
  } catch (err) {
    console.error('Error updating case status:', err);
    notifications.error(err?.response?.data?.message || err?.message || t('cases.casesToastFailedToUpdateStatus'));
  }
};

const handleFiltersChanged = () => {
  if (currentView.value === 'kanban') fetchKanbanCases();
};

const handleSearchChanged = (searchQuery) => {
  currentSearchQuery.value = searchQuery || '';
  if (currentView.value === 'kanban') fetchKanbanCases();
};

watch(currentView, (newView, oldView) => {
  if (newView === 'kanban') {
    currentSearchQuery.value = moduleListRef.value?.getSearchQuery?.() || '';
    if (oldView !== undefined) fetchKanbanCases();
  }
});

watch(() => route.query[VIEW_QUERY_KEY], (newView) => {
  if (newView === 'list' && currentView.value !== 'list') switchView('list');
  else if (newView === 'kanban' && currentView.value !== 'kanban') switchView('kanban');
});

function initializeView() {
  const viewParam = route.query[VIEW_QUERY_KEY];
  if (viewParam === 'list') {
    currentView.value = 'list';
    persistView('list');
  } else if (viewParam === 'kanban') {
    currentView.value = 'kanban';
    persistView('kanban');
  } else if (viewParam === undefined) {
    // Default to list view for Cases (requested starting point)
    currentView.value = 'list';
    persistView('list');
    router.replace({ query: { ...route.query, [VIEW_QUERY_KEY]: 'list' } });
    return;
  } else {
    currentView.value = 'list';
    persistView('list');
  }
  router.replace({ query: { ...route.query, [VIEW_QUERY_KEY]: currentView.value } });
}

onActivated(() => {
  const view = currentView.value;
  if (route.query[VIEW_QUERY_KEY] !== view) {
    router.replace({ query: { ...route.query, [VIEW_QUERY_KEY]: view } });
  }
  if (view === 'kanban') fetchKanbanCases();
  refreshList();
  nextTick(() => setTimeout(() => toggleTableView(view === 'list'), 80));
});

onMounted(() => {
  initializeView();
  if (currentView.value === 'kanban') fetchKanbanCases();
  nextTick(() => setTimeout(() => toggleTableView(currentView.value === 'list'), 100));
});
</script>

