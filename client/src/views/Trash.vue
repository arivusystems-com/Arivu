<template>
  <div class="max-w-full">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('navigation.userTrash') }}</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Items can be restored within {{ retentionDays }} days. After that, they are permanently removed.
      </p>
    </div>

    <!-- Smart Stats Bar -->
    <div v-if="stats" class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <!-- Total in Trash -->
      <div class="rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800/80 px-4 py-3 shadow-sm">
        <p class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{{ t('common.trashTotalInTrash') }}</p>
        <p class="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
          {{ stats.total }} {{ stats.total === 1 ? 'item' : 'items' }}
        </p>
      </div>
      <!-- Expiring in 7 Days (warning) -->
      <div
        :class="[
          'rounded-xl border px-4 py-3 shadow-sm',
          stats.expiringIn7Days > 0
            ? 'border-amber-300/80 dark:border-amber-700/80 bg-amber-50/80 dark:bg-amber-900/20'
            : 'border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800/80'
        ]"
      >
        <p class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{{ t('common.trashExpiringIn7Days') }}</p>
        <p
          :class="[
            'mt-1 flex items-center gap-1.5 text-xl font-semibold tabular-nums',
            stats.expiringIn7Days > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-900 dark:text-white'
          ]"
        >
          <ExclamationTriangleIcon v-if="stats.expiringIn7Days > 0" class="h-5 w-5 shrink-0" />
          {{ stats.expiringIn7Days }} {{ stats.expiringIn7Days === 1 ? 'item' : 'items' }}
        </p>
      </div>
      <!-- Oldest Item (countdown) -->
      <div class="rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800/80 px-4 py-3 shadow-sm">
        <p class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{{ t('common.trashOldestItem') }}</p>
        <p class="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
          {{ oldestItemDisplay }}
        </p>
      </div>
      <!-- Retention -->
      <div class="rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800/80 px-4 py-3 shadow-sm">
        <p class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{{ t('common.trashRetention') }}</p>
        <p class="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
          {{ retentionDays }} days
        </p>
      </div>
    </div>

    <!-- Filter + Search Row -->
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <!-- Left: Search + Filters -->
      <div class="flex flex-1 flex-wrap items-center gap-3">
        <div class="relative min-w-[200px] flex-1 max-w-xs">
          <MagnifyingGlassIcon class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            v-model="searchQuery"
            type="search"
            :placeholder="t('common.trashSearchNameModuleDeletedBy')"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 pl-9 pr-3 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            @input="debouncedSearch"
          />
        </div>
        <!-- Module filter (Headless UI Listbox) -->
        <Listbox v-model="filterModule" as="div" class="relative min-w-[140px]">
          <ListboxButton
            class="relative w-full cursor-default rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 pl-3 pr-10 text-left text-sm text-gray-700 dark:text-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <span class="block truncate">{{ filterModule ? MODULE_LABELS[filterModule] : 'All modules' }}</span>
            <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon class="h-4 w-4 text-gray-400" />
            </span>
          </ListboxButton>
          <Transition
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <ListboxOptions
              class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-800 py-1 text-sm shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none"
            >
              <ListboxOption value="" v-slot="{ active }">
                <li :class="['relative cursor-default select-none py-2 pl-3 pr-9', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                  <span class="block truncate">{{ t('common.trashAllModules') }}</span>
                </li>
              </ListboxOption>
              <ListboxOption v-for="(label, key) in MODULE_LABELS" :key="key" :value="key" v-slot="{ active }">
                <li :class="['relative cursor-default select-none py-2 pl-3 pr-9', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                  <span class="block truncate">{{ label }}</span>
                  <span v-if="filterModule === key" class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400">
                    <CheckIcon class="h-4 w-4" />
                  </span>
                </li>
              </ListboxOption>
            </ListboxOptions>
          </Transition>
        </Listbox>
        <!-- Deleted by filter (Headless UI Listbox) -->
        <Listbox v-model="filterDeletedBy" as="div" class="relative min-w-[140px]">
          <ListboxButton
            class="relative w-full cursor-default rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 pl-3 pr-10 text-left text-sm text-gray-700 dark:text-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <span class="block truncate">{{ deletedByLabel }}</span>
            <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon class="h-4 w-4 text-gray-400" />
            </span>
          </ListboxButton>
          <Transition
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <ListboxOptions
              class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-800 py-1 text-sm shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none"
            >
              <ListboxOption value="" v-slot="{ active }">
                <li :class="['relative cursor-default select-none py-2 pl-3 pr-9', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                  <span class="block truncate">{{ t('common.trashAllUsers') }}</span>
                </li>
              </ListboxOption>
              <ListboxOption v-for="u in (stats?.deletedByUsers || [])" :key="u.id" :value="u.id" v-slot="{ active }">
                <li :class="['relative cursor-default select-none py-2 pl-3 pr-9', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                  <span class="block truncate">{{ (u.name || '').trim() || 'Unknown' }} ({{ u.count }})</span>
                  <span v-if="filterDeletedBy === u.id" class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400">
                    <CheckIcon class="h-4 w-4" />
                  </span>
                </li>
              </ListboxOption>
            </ListboxOptions>
          </Transition>
        </Listbox>
        <!-- Date range -->
        <div class="flex items-center gap-1">
          <DatePicker
            v-model="filterDeletedFrom"
            :max="filterDeletedTo || undefined"
            :placeholder="t('common.filterFrom')"
            input-class="min-w-[120px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <span class="text-gray-400">–</span>
          <DatePicker
            v-model="filterDeletedTo"
            :min="filterDeletedFrom || undefined"
            :placeholder="t('common.filterTo')"
            input-class="min-w-[120px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <button
          v-if="hasFiltersApplied"
          type="button"
          class="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          @click="clearFilters"
        >
          <XMarkIcon class="h-4 w-4" />{{ t('settings.modFieldsClear') }}</button>
      </div>
      <!-- Right: Sort + Empty Trash -->
      <div class="flex items-center gap-3">
        <!-- Sort (Headless UI Listbox) -->
        <Listbox v-model="sortValue" as="div" class="relative min-w-[180px]">
          <ListboxButton
            class="relative w-full cursor-default rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 pl-3 pr-10 text-left text-sm text-gray-700 dark:text-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <span class="block truncate">{{ sortLabel }}</span>
            <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon class="h-4 w-4 text-gray-400" />
            </span>
          </ListboxButton>
          <Transition
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <ListboxOptions
              class="absolute right-0 z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-800 py-1 text-sm shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none"
            >
              <ListboxOption v-for="opt in SORT_OPTIONS" :key="opt.value" :value="opt.value" v-slot="{ active }">
                <li :class="['relative cursor-default select-none py-2 pl-3 pr-9', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                  <span class="block truncate">{{ opt.label }}</span>
                  <span v-if="sortValue === opt.value" class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400">
                    <CheckIcon class="h-4 w-4" />
                  </span>
                </li>
              </ListboxOption>
            </ListboxOptions>
          </Transition>
        </Listbox>
        <button
          v-if="stats?.total > 0 && authStore.can('settings', 'edit')"
          type="button"
          class="rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          @click="showEmptyTrashModal = true"
        >{{ t('common.trashEmptyTrash') }}</button>
      </div>
    </div>

    <!-- Bulk actions bar -->
    <div
      v-if="selectedIds.size > 0"
      class="mb-4 flex items-center gap-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3"
    >
      <span class="text-sm font-medium text-indigo-900 dark:text-indigo-200">
        {{ selectedIds.size }} selected
      </span>
      <button
        type="button"
        class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        @click="bulkRestore"
      >{{ t('common.trashRestoreSelected') }}</button>
      <button
        type="button"
        class="rounded-lg border border-red-300 dark:border-red-700 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        @click="bulkPurge"
      >{{ t('common.trashDeletePermanently') }}</button>
      <button
        type="button"
        class="ml-auto text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        @click="selectedIds.clear()"
      >{{ t('common.tableClearSelection') }}</button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4"
    >
      <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
    </div>

    <!-- Empty -->
    <div v-else-if="items.length === 0" class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-16 text-center">
      <TrashIcon class="mx-auto h-14 w-14 text-gray-400 dark:text-gray-500" />
      <h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">{{ t('common.trashTrashIsEmpty') }}</h3>
      <p class="mt-2 max-w-sm mx-auto text-sm text-gray-500 dark:text-gray-400">{{ t('common.trashDeletedItemsWillAppearHereYou') }}</p>
    </div>

    <!-- Table -->
    <div v-else class="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/50">
          <tr>
            <th class="w-10 px-4 py-3">
              <HeadlessCheckbox
                :checked="isAllSelected"
                :indeterminate="isPartiallySelected"
                checkbox-class="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                @change="toggleSelectAll"
              />
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{{ t('settings.settingsBhFieldName') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{{ t('settings.assignRulesLabelModule') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{{ t('common.trashDeletedBy') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{{ t('common.trashAutoDeleteIn') }}</th>
            <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{{ t('navigation.portalActions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr
            v-for="item in items"
            :key="`${item.moduleKey}-${item.recordId}`"
            class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30"
          >
            <td class="w-10 px-4 py-3">
              <HeadlessCheckbox
                v-if="!item.isLegalHold"
                :checked="selectedIds.has(itemKey(item))"
                checkbox-class="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                @change="toggleSelect(item)"
              />
            </td>
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
              {{ item.displayName || 'Untitled' }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              {{ moduleLabel(item.moduleKey) }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              {{ formatDeletedBy(item.deletedBy) }}
            </td>
            <td class="px-4 py-3">
              <span
                :class="[
                  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                  getPurgeUrgency(item).badgeClass
                ]"
              >
                <ExclamationTriangleIcon
                  v-if="getPurgeUrgency(item).showIcon"
                  class="h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                {{ getPurgeUrgency(item).label }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  @click="restore(item)"
                >
                  <ArrowPathIcon class="h-4 w-4" />{{ t('common.trashRestore') }}</button>
                <button
                  v-if="!item.isLegalHold"
                  type="button"
                  class="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  @click="purge(item)"
                >
                  <TrashIcon class="h-4 w-4" />{{ t('settings.modFieldsDelete') }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div
        v-if="pagination && pagination.total > pagination.limit"
        class="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3"
      >
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Showing {{ (pagination.page - 1) * pagination.limit + 1 }}–{{ Math.min(pagination.page * pagination.limit, pagination.total) }} of {{ pagination.total }}
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            :disabled="pagination.page <= 1"
            class="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click="loadPage(pagination.page - 1)"
          >{{ t('actions.previous') }}</button>
          <button
            type="button"
            :disabled="pagination.page * pagination.limit >= pagination.total"
            class="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click="loadPage(pagination.page + 1)"
          >{{ t('actions.next') }}</button>
        </div>
      </div>
    </div>

    <!-- Purge confirmation modal -->
    <DeleteConfirmationModal
      :show="showPurgeModal"
      :record-name="purgeTarget?.displayName"
      record-type="item"
      :is-bulk="purgeTarget === null && selectedIds.size > 0"
      :bulk-count="purgeTarget ? 0 : selectedIds.size"
      :deleting="purging"
      @close="showPurgeModal = false; purgeTarget = null"
      @confirm="confirmPurge"
    />

    <!-- Empty trash confirmation modal -->
    <DeleteConfirmationModal
      :show="showEmptyTrashModal"
      record-type="trash item"
      :is-bulk="true"
      :bulk-count="stats?.total || 0"
      :deleting="emptying"
      @close="showEmptyTrashModal = false"
      @confirm="confirmEmptyTrash"
    />
  </div>
</template>

<script setup>
defineOptions({ name: 'TrashView' });
import { useI18n } from 'vue-i18n';

import { useNotifications } from '@/composables/useNotifications';
const { t } = useI18n();
const notifications = useNotifications();

import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { TrashIcon, ArrowPathIcon, MagnifyingGlassIcon, ExclamationTriangleIcon, ChevronUpDownIcon, CheckIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue';
import apiClient from '@/utils/apiClient';
import DatePicker from '@/components/common/DatePicker.vue';
import { useAuthStore } from '@/stores/authRegistry';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { formatUserDate } from '@/utils/localeFormat';

const authStore = useAuthStore();
const route = useRoute();
const loading = ref(true);
const error = ref(null);
const items = ref([]);
const stats = ref(null);
const pagination = ref(null);
const retentionDays = 30;
const selectedIds = ref(new Set());
const showPurgeModal = ref(false);
const purgeTarget = ref(null);
const purging = ref(false);
const showEmptyTrashModal = ref(false);
const emptying = ref(false);

const searchQuery = ref('');
const filterModule = ref('');
const filterDeletedBy = ref('');
const filterDeletedFrom = ref('');
const filterDeletedTo = ref('');
const sortValue = ref('deletedAt:desc');

let searchTimeout = null;

// Ensure To date is never less than From date
watch([filterDeletedFrom, filterDeletedTo], ([from, to]) => {
  if (!from || !to) return;
  if (to < from) {
    filterDeletedTo.value = from;
  }
});

const MODULE_LABELS = {
  people: 'People',
  organizations: 'Organizations',
  deals: 'Deals',
  tasks: 'Tasks',
  events: 'Events',
  items: 'Items',
  forms: 'Forms',
  cases: 'Cases',
  quotes: 'Quotes',
  documents: 'Documents',
  responses: 'Form Responses'
};

const SORT_OPTIONS = [
  { value: 'deletedAt:desc', label: 'Deleted date (newest)' },
  { value: 'deletedAt:asc', label: 'Deleted date (oldest)' },
  { value: 'retentionExpiresAt:asc', label: 'Expiring in 7 days' },
  { value: 'displayName:asc', label: 'Name (A–Z)' },
  { value: 'displayName:desc', label: 'Name (Z–A)' }
];

function moduleLabel(key) {
  return MODULE_LABELS[key] || key;
}

const deletedByLabel = computed(() => {
  if (!filterDeletedBy.value) return 'All users';
  const u = (stats.value?.deletedByUsers || []).find((x) => x.id === filterDeletedBy.value);
  return u ? `${(u.name || '').trim() || 'Unknown'} (${u.count})` : 'All users';
});

const sortLabel = computed(() => {
  return SORT_OPTIONS.find((o) => o.value === sortValue.value)?.label || 'Deleted date (newest)';
});

const hasFiltersApplied = computed(() => {
  return !!(
    searchQuery.value?.trim() ||
    filterModule.value ||
    filterDeletedBy.value ||
    filterDeletedFrom.value ||
    filterDeletedTo.value
  );
});

function clearFilters() {
  searchQuery.value = '';
  filterModule.value = '';
  filterDeletedBy.value = '';
  filterDeletedFrom.value = '';
  filterDeletedTo.value = '';
  loadItems(1);
}

function formatDeletedBy(by) {
  if (!by) return '—';
  return [by.firstName, by.lastName].filter(Boolean).join(' ') || by.email || 'Unknown';
}

function itemKey(item) {
  return `${item.moduleKey}:${item.recordId}`;
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return formatUserDate(d);
}

function getPurgeUrgency(item) {
  const badgeClasses = {
    critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    neutral: 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400',
    expired: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    none: 'text-gray-500 dark:text-gray-500'
  };
  if (!item.retentionExpiresAt) return { label: '—', badgeClass: badgeClasses.none, showIcon: false };
  const exp = new Date(item.retentionExpiresAt);
  const now = new Date();
  const diffMs = exp - now;
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return { label: 'Expired', badgeClass: badgeClasses.expired, showIcon: true };
  if (days === 1) return { label: 'Expires tomorrow', badgeClass: badgeClasses.critical, showIcon: true };
  if (days < 3) return { label: `${days} days`, badgeClass: badgeClasses.critical, showIcon: true };
  if (days <= 7) return { label: `${days} days`, badgeClass: badgeClasses.warning, showIcon: false };
  return { label: `${days} days`, badgeClass: badgeClasses.neutral, showIcon: false };
}

const oldestItemDisplay = computed(() => {
  if (!stats.value?.oldestDeletedAt || stats.value?.total === 0) return '—';
  const deletedAt = new Date(stats.value.oldestDeletedAt);
  const expiresAt = new Date(deletedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  const days = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
  const deletedStr = formatUserDate(deletedAt);
  if (days <= 0) return 'Expired';
  if (days === 1) return 'Expires tomorrow';
  if (days <= 7) return `Expires in ${days} days`;
  return `Deleted ${deletedStr}`;
});

const isAllSelected = computed(() => {
  const selectable = items.value.filter((i) => !i.isLegalHold);
  return selectable.length > 0 && selectable.every((i) => selectedIds.value.has(itemKey(i)));
});

const isPartiallySelected = computed(() => {
  const selectable = items.value.filter((i) => !i.isLegalHold);
  const selected = selectable.filter((i) => selectedIds.value.has(itemKey(i)));
  return selected.length > 0 && selected.length < selectable.length;
});

function toggleSelect(item) {
  if (item.isLegalHold) return;
  const key = itemKey(item);
  const next = new Set(selectedIds.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  selectedIds.value = next;
}

function toggleSelectAll() {
  const selectable = items.value.filter((i) => !i.isLegalHold);
  const next = new Set(selectedIds.value);
  if (selectable.every((i) => next.has(itemKey(i)))) {
    selectable.forEach((i) => next.delete(itemKey(i)));
  } else {
    selectable.forEach((i) => next.add(itemKey(i)));
  }
  selectedIds.value = next;
}

function debouncedSearch() {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadItems(1), 300);
}

async function loadStats() {
  try {
    const res = await apiClient('/trash/stats', { method: 'GET' });
    if (res?.data) stats.value = res.data;
  } catch (e) {
    console.error('Failed to load trash stats:', e);
  }
}

async function loadItems(page = 1) {
  loading.value = true;
  error.value = null;
  try {
    const [sort, order] = sortValue.value.split(':');
    const params = {
      page,
      limit: 25,
      sort: sort || 'deletedAt',
      order: order || 'desc'
    };
    if (filterModule.value) params.moduleKey = filterModule.value;
    if (filterDeletedBy.value) params.deletedBy = filterDeletedBy.value;
    const from = filterDeletedFrom.value;
    let to = filterDeletedTo.value;
    if (from && to && to < from) to = from;
    if (from) params.deletedFrom = from;
    if (to) params.deletedTo = to;
    if (searchQuery.value?.trim()) params.search = searchQuery.value.trim();

    const res = await apiClient('/trash', { method: 'GET', params });
    if (res?.data) items.value = res.data;
    if (res?.pagination) pagination.value = res.pagination;
    selectedIds.value = new Set();
  } catch (e) {
    error.value = e.message || 'Failed to load trash';
  } finally {
    loading.value = false;
  }
}

function loadPage(page) {
  loadItems(page);
}

watch([filterModule, filterDeletedBy, filterDeletedFrom, filterDeletedTo, sortValue], () => loadItems(1));

async function restore(item) {
  try {
    const res = await apiClient(`/trash/${item.moduleKey}/${item.recordId}/restore`, { method: 'POST' });
    if (res?.success) {
      if (res.orphanedReferences?.length) {
        notifications.error(t('common.trashToastRestoredSomeParentRecordsWere'));
      }
      await Promise.all([loadItems(pagination.value?.page || 1), loadStats()]);
    } else {
      notifications.error(res?.message || t('common.trashToastFailedToRestore'));
    }
  } catch (e) {
    notifications.error(e.message || t('common.trashToastFailedToRestore2'));
  }
}

function purge(item) {
  purgeTarget.value = item;
  showPurgeModal.value = true;
}

function trashFilterPayload() {
  const payload = {};
  if (filterModule.value) payload.moduleKey = filterModule.value;
  if (filterDeletedBy.value) payload.deletedBy = filterDeletedBy.value;
  const from = filterDeletedFrom.value;
  let to = filterDeletedTo.value;
  if (from && to && to < from) to = from;
  if (from) payload.deletedFrom = from;
  if (to) payload.deletedTo = to;
  if (searchQuery.value?.trim()) payload.search = searchQuery.value.trim();
  return payload;
}

async function purgeTrashBulk({ items, purgeAll = false, filters = null }) {
  const body = { purgeAll };
  if (purgeAll) {
    body.filters = filters ?? trashFilterPayload();
  } else {
    body.items = items;
  }
  return apiClient.post('/trash/bulk-purge', body);
}

async function confirmPurge() {
  purging.value = true;
  try {
    let res;
    if (purgeTarget.value) {
      const item = purgeTarget.value;
      res = await purgeTrashBulk({
        items: [{ moduleKey: item.moduleKey, recordId: item.recordId }]
      });
    } else if (selectedIds.value.size > 0) {
      const toPurge = items.value.filter((i) => selectedIds.value.has(itemKey(i)) && !i.isLegalHold);
      res = await purgeTrashBulk({
        items: toPurge.map((i) => ({ moduleKey: i.moduleKey, recordId: i.recordId }))
      });
    } else {
      return;
    }

    if (res?.success) {
      showPurgeModal.value = false;
      purgeTarget.value = null;
      selectedIds.value = new Set();
      const failed = Number(res.failed || 0);
      const skipped = Number(res.skipped || 0);
      await Promise.all([loadItems(pagination.value?.page || 1), loadStats()]);
      if (failed > 0 || skipped > 0) {
        const parts = [];
        if (failed > 0) parts.push(`${failed} failed`);
        if (skipped > 0) parts.push(`${skipped} skipped (legal hold)`);
        notifications.error(parts.join(', '));
      }
    } else {
      notifications.error(res?.message || t('common.trashToastFailedToDelete'));
    }
  } catch (e) {
    notifications.error(e.message || t('common.trashToastFailedToDelete2'));
  } finally {
    purging.value = false;
  }
}

async function bulkRestore() {
  const toRestore = items.value.filter((i) => selectedIds.value.has(itemKey(i)));
  for (const item of toRestore) {
    try {
      await apiClient(`/trash/${item.moduleKey}/${item.recordId}/restore`, { method: 'POST' });
    } catch (e) {
      console.error('Restore failed:', e);
    }
  }
  selectedIds.value = new Set();
  await Promise.all([loadItems(pagination.value?.page || 1), loadStats()]);
}

function bulkPurge() {
  purgeTarget.value = null;
  showPurgeModal.value = true;
}

async function confirmEmptyTrash() {
  emptying.value = true;
  try {
    const res = await purgeTrashBulk({ purgeAll: true, filters: {} });
    showEmptyTrashModal.value = false;
    if (res?.success) {
      await Promise.all([loadItems(1), loadStats()]);
      const skipped = Number(res.skipped || 0);
      if (skipped > 0) {
        notifications.warning(`${skipped} item(s) on legal hold were not deleted.`);
      }
    } else {
      notifications.error(res?.message || t('common.trashToastFailedToDelete'));
    }
  } catch (e) {
    notifications.error(e.message || t('common.trashToastFailedToDelete2'));
  } finally {
    emptying.value = false;
  }
}

onMounted(async () => {
  const moduleFromQuery = String(route.query.moduleKey || '').trim();
  if (moduleFromQuery && MODULE_LABELS[moduleFromQuery]) {
    filterModule.value = moduleFromQuery;
  }
  await loadStats();
  await loadItems(1);
});
</script>
