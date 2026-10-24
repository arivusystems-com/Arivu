<template>
  <div class="mx-auto w-full" :data-view="currentView">
    <!-- Registry-Driven ModuleList with Kanban/List View Switcher -->
    <ModuleList
      ref="moduleListRef"
      module-key="tasks"
      app-key="PLATFORM"
      :view-mode="currentView"
      @create="openCreateModal"
      @import="showImportModal = true"
      @export="exportTasks"
      @row-click="handleRowClick"
      @edit="handleEditFromList"
      @delete="handleDeleteTask"
      @bulk-action="handleBulkAction"
      @filters-changed="handleFiltersChanged"
      @search-changed="handleSearchChanged"
      @kanban-settings-changed="refreshKanbanSettings"
      @stats-visibility-changed="(val) => (statsOpen = val)"
      @shell-ready="listShellReady = true"
    >
      <!-- Custom Header Slot - View Switcher + Actions -->
      <template #header-actions>
        <div class="flex flex-nowrap items-center gap-2">
          <!-- Mobile: layout view dropdown -->
          <Menu as="div" class="relative sm:hidden">
            <MenuButton
              type="button"
              class="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-0 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              <component :is="currentView === 'list' ? ListBulletIcon : ViewColumnsIcon" class="h-4 w-4 shrink-0" />
              <span>{{ layoutViewLabel }}</span>
              <ChevronDownIcon class="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
            </MenuButton>
            <Transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="transform opacity-0 scale-95"
              enter-to-class="transform opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="transform opacity-100 scale-100"
              leave-to-class="transform opacity-0 scale-95"
            >
              <MenuItems class="absolute right-0 z-50 mt-2 w-44 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black/5 focus:outline-none dark:bg-gray-800 dark:ring-white/10">
                <div class="py-1">
                  <MenuItem v-slot="{ active }">
                    <button
                      type="button"
                      class="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300"
                      :class="active ? 'bg-gray-100 dark:bg-gray-700' : ''"
                      @click="switchView('kanban')"
                    >
                      <ViewColumnsIcon class="h-4 w-4 shrink-0" />
                      <span class="flex-1 text-left">{{ t('tasks.tasksBoard') }}</span>
                      <CheckIcon v-if="currentView === 'kanban'" class="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                    </button>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <button
                      type="button"
                      class="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300"
                      :class="active ? 'bg-gray-100 dark:bg-gray-700' : ''"
                      @click="switchView('list')"
                    >
                      <ListBulletIcon class="h-4 w-4 shrink-0" />
                      <span class="flex-1 text-left">{{ t('forms.rbLayoutList') }}</span>
                      <CheckIcon v-if="currentView === 'list'" class="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                    </button>
                  </MenuItem>
                </div>
              </MenuItems>
            </Transition>
          </Menu>
          <!-- Desktop: segmented Board | List -->
          <div class="relative hidden h-[34px] min-w-[200px] items-stretch rounded-lg border border-gray-200/80 bg-gray-100 p-[0.1rem] shadow-inner dark:border-gray-600 dark:bg-gray-700/90 sm:flex">
            <button
              type="button"
              class="relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-1.5 overflow-visible rounded-md px-2.5 py-0 text-xs font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:ring-offset-gray-800 sm:text-sm"
              :class="currentView === 'kanban' ? 'bg-white text-indigo-600 dark:bg-gray-800 dark:text-indigo-400' : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-600/50 dark:hover:text-gray-200'"
              @click="switchView('kanban')"
            >
              <ViewColumnsIcon class="h-4 w-4 shrink-0" />{{ t('tasks.tasksBoard') }}
            </button>
            <button
              type="button"
              class="relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-1.5 overflow-visible rounded-md px-2.5 py-0 text-xs font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:ring-offset-gray-800 sm:text-sm"
              :class="currentView === 'list' ? 'bg-white text-indigo-600 dark:bg-gray-800 dark:text-indigo-400' : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-600/50 dark:hover:text-gray-200'"
              @click="switchView('list')"
            >
              <ListBulletIcon class="h-4 w-4 shrink-0" />{{ t('forms.rbLayoutList') }}
            </button>
          </div>
          <ModuleActions
            module="tasks"
            :create-label="t('tasks.listCreate')"
            @create="openCreateModal"
            @import="showImportModal = true"
            @export="exportTasks"
          />
        </div>
      </template>

      <!-- Custom Title Cell with checkbox -->
      <template #cell-title="{ row }">
        <div class="flex min-w-0 items-center gap-3">
          <HeadlessCheckbox 
            :checked="row.status === 'completed'"
            @click.stop="toggleTaskStatus(row)"
            checkbox-class="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
          <span :class="['min-w-0 flex-1 font-semibold truncate', row.status === 'completed' ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white']">
            {{ row.title }}
          </span>
        </div>
      </template>

      <!-- Custom Status Cell with Badge -->
      <template #cell-status="{ value }">
        <BadgeCell 
          :value="formatStatus(value)" 
          :variant-map="{
            'Todo': 'default',
            'In Progress': 'info',
            'Waiting': 'warning',
            'Completed': 'success',
            'Cancelled': 'danger'
          }"
        />
      </template>

      <!-- Custom Priority Cell with Badge -->
      <template #cell-priority="{ value }">
        <BadgeCell 
          v-if="value"
          :value="formatPriority(value)" 
          :variant-map="{
            'Low': 'default',
            'Medium': 'info',
            'High': 'warning',
            'Urgent': 'danger'
          }"
        />
        <span v-else class="text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Task Type Cell with picklist badge -->
      <template #cell-taskType="{ value }">
        <BadgeCell
          v-if="value"
          :value="formatTaskType(value)"
          :color="getTaskTypeColor(value)"
        />
        <span v-else class="text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Assigned To Cell -->
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

      <!-- Custom Due Date Cell with highlighting -->
      <template #cell-dueDate="{ row }">
        <span v-if="row.dueDate" :class="[
          'text-sm font-medium',
          isOverdue(row.dueDate) && row.status !== 'completed' && row.status !== 'cancelled' ? 'text-red-600 dark:text-red-400' :
          isDueToday(row.dueDate) && row.status !== 'completed' ? 'text-yellow-600 dark:text-yellow-400' :
          'text-gray-700 dark:text-gray-300'
        ]">
          <DateCell :value="row.dueDate" format="short" />
        </span>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('tasks.tasksNoDueDate') }}</span>
      </template>

      <!-- Custom Created Date Cell -->
      <template #cell-createdAt="{ value }">
        <DateCell :value="value" format="short" />
      </template>

      <!-- Description: show plain text (strip HTML) in list view -->
      <template #cell-description="{ value }">
        <span class="line-clamp-2 text-gray-700 dark:text-gray-300">{{ getPlainTextFromHtml(value || '') || '—' }}</span>
      </template>

      <!-- Related To: polymorphic lookup (contact, deal, organization, project) -->
      <template #cell-relatedTo="{ row }">
        <span class="text-sm text-gray-700 dark:text-gray-300">{{ formatRelatedToForDisplay(row?.relatedTo) ?? '—' }}</span>
      </template>

    </ModuleList>

    <!-- Kanban View (shown when Board is selected; wait for ModuleList chrome to avoid skeleton+board flash) -->
    <div
      v-if="currentView === 'kanban' && listShellReady"
      class="kanban-view-container mt-4"
      style="min-height: 400px;"
    >
      <KanbanBoard
        :items="kanbanTasks"
        :stages="taskStages"
        stage-key="status"
        item-id-key="_id"
        :loading="kanbanLoading"
        :loading-label="t('tasks.tasksLoadingBoard')"
        :get-stage-color="getStatusColor"
        :card-size="kanbanCardSize"
        :collapse-empty-columns="kanbanCollapseEmptyColumns"
        :stats-open="statsOpen"
        @update="handleKanbanUpdate"
        @card-click="({ item, event }) => handleTaskCardClick(item, event)"
      >
        <template #column-header="{ stage, count, stageColor }">
          <div
            :class="[
              'flex items-center gap-2.5 px-3 py-1.5 rounded-full min-w-0 flex-1',
              stageColor ? 'bg-white/20 text-white' : 'bg-white/80 dark:bg-gray-600/80 text-gray-700 dark:text-gray-200'
            ]"
          >
            <span class="font-semibold text-sm truncate">{{ formatStatus(stage) }}</span>
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
        <template #card="{ item: task }">
          <div v-if="kanbanShownFieldKeys.includes('title') && (kanbanShowEmptyFields || (task.title != null && task.title !== ''))" class="mb-2">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white leading-tight line-clamp-2">{{ task.title || '—' }}</h4>
          </div>
          <div
            v-if="kanbanMetaFieldKeys.length"
            :class="[
              'text-xs text-gray-600 dark:text-gray-400',
              kanbanStackFields ? 'flex flex-col gap-1.5' : 'flex flex-wrap items-center gap-x-3 gap-y-1.5'
            ]"
          >
            <template v-for="key in kanbanMetaFieldKeys" :key="key">
              <template v-if="kanbanShowEmptyFields || !isTaskFieldEmpty(task, key)">
                <div v-if="key === 'dueDate'" class="flex items-center gap-1.5 min-w-0" :class="isOverdue(task.dueDate) && task.status !== 'completed' && task.status !== 'cancelled' ? 'text-red-600 dark:text-red-400 font-medium' : ''">
                  <CalendarDaysIcon class="w-3.5 h-3.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                  <DateCell :value="task.dueDate" format="short" />
                </div>
                <div v-else-if="key === 'priority'" class="flex items-center gap-1.5 min-w-0" :class="[task.priority?.toLowerCase() === 'urgent' ? 'text-red-600 dark:text-red-400' : task.priority?.toLowerCase() === 'high' ? 'text-amber-600 dark:text-amber-400' : '']">
                  <FlagIconSolid class="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{{ formatPriority(task.priority) }}</span>
                </div>
                <div v-else-if="key === 'assignedTo'" class="flex items-center gap-1.5 min-w-0">
                  <Avatar
                    v-if="task.assignedTo && typeof task.assignedTo === 'object'"
                    :user="{
                      firstName: task.assignedTo.firstName || task.assignedTo.first_name,
                      lastName: task.assignedTo.lastName || task.assignedTo.last_name,
                      email: task.assignedTo.email,
                      avatar: task.assignedTo.avatar
                    }"
                    size="sm"
                  />
                  <span v-else class="w-6 h-6 rounded-full bg-gray-400 dark:bg-gray-500 flex items-center justify-center flex-shrink-0">
                    <span class="text-[10px] font-medium text-white">?</span>
                  </span>
                  <span class="truncate">{{ getUserDisplayName(task.assignedTo) }}</span>
                </div>
                <div v-else-if="key === 'createdAt'" class="flex items-center gap-1.5 min-w-0">
                  <ClockIcon class="w-3.5 h-3.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                  <DateCell :value="task.createdAt" format="short" />
                </div>
                <div v-else-if="key === 'status'" class="flex items-center gap-1.5 min-w-0">
                  <CheckCircleIcon class="w-3.5 h-3.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                  <span>{{ formatStatus(task.status) }}</span>
                </div>
                <div v-else-if="key === 'relatedTo'" class="flex items-center gap-1.5 min-w-0 truncate">
                  <LinkIcon class="w-3.5 h-3.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                  <span class="truncate">{{ formatRelatedToForDisplay(task.relatedTo) ?? '—' }}</span>
                </div>
                <div v-else class="flex items-center gap-1.5 min-w-0 truncate">
                  <HashtagIcon class="w-3.5 h-3.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                  <span class="truncate">{{ formatTaskCardValue(task[key], key) }}</span>
                </div>
              </template>
            </template>
          </div>
        </template>
        <template #empty>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('tasks.tasksNoTasksInThisStatus') }}</p>
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
            @click.stop="openCreateTaskInStatus(stage)"
          >
            <PlusIcon class="w-4 h-4 flex-shrink-0" />{{ t('tasks.tasksAddTask') }}</button>
        </template>
      </KanbanBoard>
    </div>

    <!-- Task create/edit drawer (quick + full mode) -->
    <CreateRecordDrawer 
      :isOpen="showTaskDrawer"
      moduleKey="tasks"
      :record="taskDrawerRecord"
      :initial-data="createInitialData"
      @close="closeTaskDrawer"
      @saved="handleTaskDrawerSaved"
    />

    <!-- CSV Import Modal -->
    <CSVImportModal 
      v-if="showImportModal"
      entity-type="Tasks"
      @close="showImportModal = false"
      @import-complete="handleImportComplete"
    />
  </div>
</template>

<script setup>
defineOptions({ name: 'TasksView' });
import { useI18n } from 'vue-i18n';

import { useNotifications } from '@/composables/useNotifications';
const { t } = useI18n();
const notifications = useNotifications();

import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { ref, computed, watch, nextTick, onMounted, onActivated } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import { fetchModuleDefinitionCached } from '@/utils/tenantSchemaApiCache';
import ModuleList from '@/components/module-list/ModuleList.vue';
import ModuleActions from '@/components/common/ModuleActions.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import CSVImportModal from '@/components/import/CSVImportModal.vue';
import Avatar from '@/components/common/Avatar.vue';
import KanbanBoard from '@/components/common/KanbanBoard.vue';
import { getModuleListConfig } from '@/platform/modules/moduleListRegistry';
import { getPlainTextFromHtml, formatRelatedToForDisplay } from '@/utils/fieldDisplay';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { ViewColumnsIcon, ListBulletIcon, CalendarDaysIcon, ClockIcon, HashtagIcon, CheckCircleIcon, LinkIcon, ChevronDownIcon } from '@heroicons/vue/24/outline';
import { PlusIcon } from '@heroicons/vue/24/outline';
import { CheckIcon, FlagIcon as FlagIconSolid } from '@heroicons/vue/24/solid';
import { formatUserDate } from '@/utils/localeFormat';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { openTab } = useTabs();
const listShellReady = ref(false);

// View state (module-specific URL param so Tasks and Deals don't affect each other)
const viewStorageKey = 'arivu-tasks-view';
const VIEW_QUERY_KEY = 'tasksView';
const getInitialView = () => {
  try {
    const saved = localStorage.getItem(viewStorageKey);
    return saved === 'list' ? 'list' : 'kanban';
  } catch {
    return 'kanban';
  }
};
const currentView = ref(getInitialView());
const layoutViewLabel = computed(() =>
  currentView.value === 'list' ? t('forms.rbLayoutList') : t('tasks.tasksBoard')
);

// Kanban data
const kanbanTasks = ref([]);
const kanbanLoading = ref(getInitialView() === 'kanban');
const TASK_STAGES = ['todo', 'in_progress', 'waiting', 'completed', 'cancelled'];
const taskStages = ref([...TASK_STAGES]);
const statusColorMap = ref({});
const taskTypeColorMap = ref({});
const taskTypeLabelMap = ref({});

// Kanban options (from localStorage, same keys as ListView Customize Kanban for tasks)
const KANBAN_OPTIONS_KEY = 'arivu-listview-tasks-kanban-options';
const KANBAN_FIELDS_KEY = 'arivu-listview-tasks-kanban-fields';
const DEFAULT_TASK_KANBAN_KEYS = ['title', 'assignedTo', 'dueDate', 'priority'];
const kanbanSettingsVersion = ref(0);
const refreshKanbanSettings = () => { kanbanSettingsVersion.value++; };

const getInitialStatsOpen = () => {
  try {
    return localStorage.getItem('arivu-stats-visible-tasks') !== 'false';
  } catch {
    return true;
  }
};
const statsOpen = ref(getInitialStatsOpen());

const kanbanCardSize = computed(() => {
  const _kanbanSettingsDependency = kanbanSettingsVersion.value;
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
  const _kanbanSettingsDependency = kanbanSettingsVersion.value;
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
  const _kanbanSettingsDependency = kanbanSettingsVersion.value;
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
  const _kanbanSettingsDependency = kanbanSettingsVersion.value;
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
  const _kanbanSettingsDependency = kanbanSettingsVersion.value;
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
  return [...DEFAULT_TASK_KANBAN_KEYS];
});
const kanbanMetaFieldKeys = computed(() =>
  kanbanShownFieldKeys.value.filter((k) => k !== 'title')
);

// State
const moduleListRef = ref(null);
const showTaskDrawer = ref(false);
const showImportModal = ref(false);
const taskDrawerRecord = ref(null);
const currentSearchQuery = ref('');

const refreshList = () => {
  if (moduleListRef.value?.refreshAfterImport) {
    void moduleListRef.value.refreshAfterImport();
  } else {
    moduleListRef.value?.refresh?.();
  }
};

// Header navigation context (prev/next on task record page)
const TASK_NAV_CONTEXT_STORAGE_PREFIX = 'arivu-task-nav-context:';
const TASK_NAV_CONTEXT_MAX_ENTRIES = 12;

const getCurrentTaskNavigationIds = () => {
  if (currentView.value === 'kanban') {
    return (kanbanTasks.value || [])
      .map((t) => String(t?._id || t?.id || '').trim())
      .filter(Boolean);
  }
  const rows = moduleListRef.value?.getCurrentRows?.() || [];
  return rows
    .map((row) => String(row?._id || row?.id || '').trim())
    .filter(Boolean);
};

const persistTaskNavigationContext = (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return '';
  const uniqueIds = [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return '';
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const payload = { ids: uniqueIds, createdAt: Date.now() };
  try {
    sessionStorage.setItem(`${TASK_NAV_CONTEXT_STORAGE_PREFIX}${token}`, JSON.stringify(payload));
    const allKeys = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key && key.startsWith(TASK_NAV_CONTEXT_STORAGE_PREFIX)) allKeys.push(key);
    }
    if (allKeys.length > TASK_NAV_CONTEXT_MAX_ENTRIES) {
      allKeys
        .sort()
        .slice(0, allKeys.length - TASK_NAV_CONTEXT_MAX_ENTRIES)
        .forEach((k) => sessionStorage.removeItem(k));
    }
  } catch {
    return '';
  }
  return token;
};

// Initialize view from route query or localStorage
const initializeView = () => {
  const viewParam = route.query[VIEW_QUERY_KEY];
  if (viewParam === 'list') {
    currentView.value = 'list';
    try { localStorage.setItem(viewStorageKey, 'list'); } catch (_) {}
  } else if (viewParam === 'kanban') {
    currentView.value = 'kanban';
    try { localStorage.setItem(viewStorageKey, 'kanban'); } catch (_) {}
  } else if (viewParam === undefined) {
    const saved = localStorage.getItem(viewStorageKey);
    if (saved === 'list') {
      currentView.value = 'list';
      router.replace({ query: { ...route.query, [VIEW_QUERY_KEY]: 'list' } });
    } else {
      currentView.value = 'kanban';
      try { localStorage.setItem(viewStorageKey, 'kanban'); } catch (_) {}
      router.replace({ query: { ...route.query, [VIEW_QUERY_KEY]: 'kanban' } });
    }
  } else {
    currentView.value = 'kanban';
    try { localStorage.setItem(viewStorageKey, 'kanban'); } catch (_) {}
    router.replace({ query: { ...route.query, [VIEW_QUERY_KEY]: 'kanban' } });
  }
  nextTick(() => toggleTableView(currentView.value === 'list'));
};

const switchView = async (view) => {
  if (currentView.value === view) return;
  currentView.value = view;
  try { localStorage.setItem(viewStorageKey, view); } catch (_) {}
  router.replace({ query: { ...route.query, [VIEW_QUERY_KEY]: view } });
  if (view === 'kanban') {
    await fetchKanbanTasks();
  }
  await nextTick();
  toggleTableView(view === 'list');
  setTimeout(() => toggleTableView(view === 'list'), 80);
};

const toggleTableView = (showTable) => {
  const tableContainer = document.querySelector('.mt-4.px-4.sm\\:px-6.lg\\:px-8:not(.kanban-view-container)');
  if (tableContainer) {
    const hasTable = tableContainer.querySelector('table') !== null ||
      tableContainer.querySelector('[role="table"]') !== null ||
      tableContainer.querySelector('div[class*="table-scroll"]') !== null ||
      tableContainer.querySelector('div[class*="table-view"]') !== null;
    if (hasTable) {
      tableContainer.style.display = showTable ? '' : 'none';
    }
  }
};

// Fetch task status / taskType picklist options from tasks module
const fetchTaskStatusOptions = async () => {
  try {
    const mod = await fetchModuleDefinitionCached('tasks');
    if (!mod) return;
    const fields = mod.fields || [];
    const statusField = fields.find(f => String(f?.key || '').toLowerCase() === 'status');
    const opts = statusField?.options || [];
    const map = {};
    opts.forEach(opt => {
      const val = typeof opt === 'string' ? opt : (opt?.value ?? opt?.id ?? '');
      const color = typeof opt === 'object' && opt?.color ? String(opt.color).trim() : null;
      if (val && color) map[val] = color;
    });
    statusColorMap.value = map;

    const taskTypeField = fields.find(f => String(f?.key || '').toLowerCase() === 'tasktype');
    const typeOpts = Array.isArray(taskTypeField?.options) ? taskTypeField.options : [];
    const typeColorMap = {};
    const typeLabelMap = {};
    typeOpts.forEach((opt) => {
      const val = typeof opt === 'string' ? opt : (opt?.value ?? opt?.id ?? '');
      if (!val) return;
      if (typeof opt === 'object' && opt?.color) {
        typeColorMap[val] = String(opt.color).trim();
      }
      if (typeof opt === 'object' && opt?.label) {
        typeLabelMap[val] = String(opt.label);
      }
    });
    taskTypeColorMap.value = typeColorMap;
    taskTypeLabelMap.value = typeLabelMap;
  } catch (_) {
    statusColorMap.value = {};
    taskTypeColorMap.value = {};
    taskTypeLabelMap.value = {};
  }
};

const getStatusColor = (status) => statusColorMap.value[status] || null;
const getTaskTypeColor = (taskType) => taskTypeColorMap.value[taskType] || null;

function hexToRgba(hex, alpha) {
  if (!hex) return null;
  const h = String(hex).replace(/^#/, '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const fetchKanbanTasks = async () => {
  if (currentView.value !== 'kanban') return;
  if (kanbanTasks.value.length === 0) {
    kanbanLoading.value = true;
  }
  try {
    const moduleListFilters = moduleListRef.value?.getFilters?.() || {};
    const moduleListSearch = currentSearchQuery.value || moduleListRef.value?.getSearchQuery?.() || '';
    const params = {};
    const moduleConfig = getModuleListConfig('tasks');
    let normalizedFilters = { ...moduleListFilters };
    if (moduleConfig?.normalizeFilters) {
      normalizedFilters = moduleConfig.normalizeFilters(normalizedFilters, authStore.user?._id);
    }
    Object.keys(normalizedFilters).forEach(key => {
      const value = normalizedFilters[key];
      if (value !== undefined && value !== '') params[key] = value;
      else if (value === null) params[key] = null;
    });
    if (moduleListSearch?.trim()) params.search = moduleListSearch.trim();
    params.limit = 500;
    params.page = 1;
    params.sortBy = 'createdAt';
    params.sortOrder = 'desc';

    const response = await apiClient.get('/tasks', { params });
    if (response?.success) {
      kanbanTasks.value = Array.isArray(response.data) ? response.data : [];
    } else {
      kanbanTasks.value = [];
    }
  } catch (err) {
    console.error('[Tasks] Error fetching kanban tasks:', err);
    kanbanTasks.value = [];
  } finally {
    kanbanLoading.value = false;
  }
};

const handleFiltersChanged = () => {
  if (currentView.value === 'kanban') fetchKanbanTasks();
};

const handleSearchChanged = (searchQuery) => {
  currentSearchQuery.value = searchQuery || '';
  if (currentView.value === 'kanban') fetchKanbanTasks();
};

watch(currentView, (newView, oldView) => {
  if (newView === 'kanban') {
    currentSearchQuery.value = moduleListRef.value?.getSearchQuery?.() || '';
    if (oldView !== undefined) fetchKanbanTasks();
  }
  // Table visibility is applied in switchView and onMounted/onActivated to avoid race with DOM
});

watch(() => route.query[VIEW_QUERY_KEY], (newView) => {
  if (newView === 'list' && currentView.value !== 'list') switchView('list');
  else if (newView === 'kanban' && currentView.value !== 'kanban') switchView('kanban');
});

const handleKanbanUpdate = async ({ item, newStage }) => {
  const id = item._id != null ? (typeof item._id === 'string' ? item._id : String(item._id)) : null;
  if (!id) return;
  try {
    await apiClient.patch(`/tasks/${id}/status`, { status: newStage });
    await fetchKanbanTasks();
    refreshList();
  } catch (err) {
    console.error('Error updating task status:', err);
    notifications.error(err?.response?.data?.message || err?.message || t('common.tasksToastFailedToUpdateTaskStatus'));
  }
};

const handleTaskCardClick = (task, event) => {
  const openInBackground = event && (event.button === 1 || event.metaKey || event.ctrlKey);
  const title = task.title || 'Task Detail';
  const navContextToken = persistTaskNavigationContext(getCurrentTaskNavigationIds());
  const routePath = navContextToken
    ? `/tasks/${task._id}?navCtx=${encodeURIComponent(navContextToken)}`
    : `/tasks/${task._id}`;
  openTab(routePath, { title, background: openInBackground, insertAdjacent: true });
};

const createInitialData = ref({});

const openTaskDrawer = (record = null, initialData = {}) => {
  taskDrawerRecord.value = record;
  createInitialData.value = initialData;
  showTaskDrawer.value = true;
};

const closeTaskDrawer = () => {
  showTaskDrawer.value = false;
  taskDrawerRecord.value = null;
  createInitialData.value = {};
};

const handleTaskDrawerSaved = () => {
  closeTaskDrawer();
  if (currentView.value === 'kanban') fetchKanbanTasks();
  refreshList();
};

// keep-alive runs onActivated on first mount too — skip board refetch that flash after onMounted.
let skipKeepAliveFirstActivate = true;

// When switching back to this tab (keep-alive), refetch board; list soft-refetch via ModuleList dirty flag
onActivated(() => {
  const view = currentView.value;
  if (route.query[VIEW_QUERY_KEY] !== view) {
    router.replace({ query: { ...route.query, [VIEW_QUERY_KEY]: view } });
  }
  if (skipKeepAliveFirstActivate) {
    skipKeepAliveFirstActivate = false;
    nextTick(() => setTimeout(() => toggleTableView(view === 'list'), 80));
    return;
  }
  if (view === 'kanban') fetchKanbanTasks();
  nextTick(() => setTimeout(() => toggleTableView(view === 'list'), 80));
});

onMounted(() => {
  initializeView();
  fetchTaskStatusOptions();
  // Board rows load once via ModuleList @filters-changed (saved views ready) — not here.
  nextTick(() => setTimeout(() => toggleTableView(currentView.value === 'list'), 100));
});

// Helper functions for dates
const isOverdue = (dueDate) => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
};

const isDueToday = (dueDate) => {
  if (!dueDate) return false;
  return new Date(dueDate).toDateString() === new Date().toDateString();
};

// Helper function to get user display name
const getUserDisplayName = (user) => {
  if (!user) return '';
  if (typeof user === 'string') return user;
  const firstName = user.firstName || user.first_name || '';
  const lastName = user.lastName || user.last_name || '';
  return `${firstName} ${lastName}`.trim() || user.email || '';
};

const isTaskFieldEmpty = (task, key) => {
  if (!task) return true;
  switch (key) {
    case 'title':
      return task.title == null || task.title === '';
    case 'dueDate':
      return !task.dueDate;
    case 'priority':
      return !task.priority;
    case 'assignedTo':
      return !task.assignedTo;
    case 'status':
      return !task.status;
    case 'createdAt':
      return !task.createdAt;
    case 'description':
      return task.description == null || task.description === '';
    case 'relatedTo':
      return !task.relatedTo || task.relatedTo.type === 'none' || !task.relatedTo.id;
    default:
      const v = task[key];
      return v == null || v === '';
  }
};

const formatTaskCardValue = (value, key) => {
  if (value == null) return '—';
  if (key === 'relatedTo' && typeof value === 'object' && value?.type) return formatRelatedToForDisplay(value) ?? '—';
  if (key === 'description' && typeof value === 'string') return getPlainTextFromHtml(value) || '—';
  if (key === 'assignedTo' && typeof value === 'object') return getUserDisplayName(value);
  if (key === 'taskType') return formatTaskType(value);
  if (typeof value === 'object' && value !== null && ('firstName' in value || 'first_name' in value))
    return getUserDisplayName(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))
    return formatUserDate(value);
  return String(value);
};

// Toggle task status (quick complete/incomplete)
const toggleTaskStatus = async (task) => {
  try {
    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    await apiClient.patch(`/tasks/${task._id}/status`, { status: newStatus });
    refreshList();
  } catch (error) {
    console.error('Error toggling task status:', error);
  }
};

// Modal handlers
const openCreateModal = () => {
  openTaskDrawer(null, {});
};

const openCreateTaskInStatus = (status) => {
  openTaskDrawer(null, { status });
};

const handleEditFromList = (row) => {
  openTaskDrawer(row, {});
};

const handleRowClick = (row) => {
  const title = row.title || 'Task Detail';
  const navContextToken = persistTaskNavigationContext(getCurrentTaskNavigationIds());
  const routePath = navContextToken
    ? `/tasks/${row._id}?navCtx=${encodeURIComponent(navContextToken)}`
    : `/tasks/${row._id}`;
  openTab(routePath, { title, background: false, insertAdjacent: true });
};

const handleDeleteTask = async (row) => {
  const id = row?._id;
  if (!id) return;
  try {
    await apiClient.delete(`/tasks/${id}`);
    if (currentView.value === 'kanban') fetchKanbanTasks();
    refreshList();
  } catch (error) {
    console.error('Error deleting task:', error);
    notifications.error(error?.response?.data?.message || error?.message || t('common.tasksToastFailedToDeleteTask'));
  }
};

const handleBulkAction = async (action, rows) => {
  const taskIds = rows.map(task => task._id);
  
  try {
    if (action === 'delete' || action === 'bulk-delete') {
      return;
    }
    if (action === 'export') {
      // Export functionality handled by ModuleList
    }
  } catch (error) {
    console.error('Error performing bulk action:', error);
    notifications.error(t('common.tasksToastErrorPerformingBulkActionPlease'));
  }
};

// Export tasks
const exportTasks = async () => {
  try {
    const response = await fetch('/api/csv/export/tasks', {
      headers: {
        'Authorization': `Bearer ${authStore.user?.token}`
      }
    });
    
    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting tasks:', error);
    notifications.error(t('common.tasksToastErrorExportingTasksPleaseTry'));
  }
};

const handleImportComplete = () => {
  showImportModal.value = false;
  if (currentView.value === 'kanban') fetchKanbanTasks();
  refreshList();
};

// Utility functions
const formatDate = (date) => {
  if (!date) return '-';
  return formatUserDate(date) || '-';
};

const formatStatus = (status) => {
  // Map task status values to display format
  const statusMap = {
    'todo': 'Todo',
    'in_progress': 'In Progress',
    'waiting': 'Waiting',
    'completed': 'Completed',
    'cancelled': 'Cancelled'
  };
  if (statusMap[status]) {
    return statusMap[status];
  }
  // Fallback: capitalize first letter
  return status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') : '-';
};

const formatPriority = (priority) => {
  // Map priority values to display format
  const priorityMap = {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'urgent': 'Urgent'
  };
  return priorityMap[priority] || priority;
};

const formatTaskType = (taskType) => {
  if (!taskType) return '-';
  const fromOptions = taskTypeLabelMap.value[taskType];
  if (fromOptions) return fromOptions;
  return String(taskType)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};
</script>

<style>
[data-view="kanban"] .mt-4.px-4.sm\:px-6.lg\:px-8:not(.kanban-view-container) {
  display: none;
}
[data-view="list"] .mt-4.px-4.sm\:px-6.lg\:px-8:not(.kanban-view-container) {
  display: block;
}
.kanban-view-container {
  display: block;
}

.kanban-add-btn:hover {
  background-color: var(--add-btn-hover-bg);
}
</style>

