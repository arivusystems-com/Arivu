<template>
  <div class="w-full relative">
    <!-- Bulk Actions Bar (ListView-style) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-4 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 translate-y-4 scale-95"
      >
        <div
          v-if="selectable && selectedRows.length > 0"
          class="fixed bottom-4 left-2 right-2 z-[9999] sm:bottom-6 sm:left-1/2 sm:right-auto sm:w-full sm:max-w-[min(800px,100%)] sm:-translate-x-1/2"
        >
          <div class="rounded-xl bg-gray-800 shadow-lg dark:bg-gray-800">
            <div
              v-if="showSelectAllBanner"
              class="border-b border-white/10 px-4 py-2 text-center text-sm text-gray-200"
            >
              <button
                type="button"
                class="cursor-pointer font-medium text-indigo-300 underline-offset-2 hover:text-indigo-200 hover:underline"
                @click="selectAllAcrossPages"
              >
                {{ t('common.tableSelectAllItems', { count: totalRecords || data.length }) }}
              </button>
            </div>
            <div class="flex items-center gap-3 px-4 py-2 sm:px-6 sm:py-2.5">
              <button
                type="button"
                class="inline-flex flex-shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:border-gray-600"
                :title="t('common.listClearSelection')"
                @click="clearSelection"
              >
                <span class="font-semibold">{{ selectionCount }}</span>
                <span class="font-medium">{{ selectionLabelText }}</span>
                <XMarkIcon class="h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5" aria-hidden="true" />
              </button>

              <div class="flex flex-1 items-center justify-end gap-1 overflow-x-auto sm:gap-2 sm:overflow-visible">
                <button
                  v-for="action in nonDeleteMassActions"
                  :key="action.action"
                  type="button"
                  class="group flex flex-shrink-0 cursor-pointer flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-700 sm:gap-1 sm:px-3 sm:py-2"
                  :class="action.variant === 'primary' ? 'text-teal-400' : 'text-gray-300'"
                  @click="handleBulkAction(action.action)"
                >
                  <component :is="getMassActionIcon(action.icon)" class="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  <span class="text-[10px] font-medium leading-tight sm:text-xs">{{ action.label }}</span>
                </button>

                <button
                  v-for="action in deleteMassActions"
                  :key="action.action"
                  type="button"
                  class="group flex flex-shrink-0 cursor-pointer flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-red-400 transition-colors hover:bg-gray-700 sm:gap-1 sm:px-3 sm:py-2"
                  @click="handleBulkAction(action.action)"
                >
                  <component :is="getMassActionIcon(action.icon || 'trash')" class="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  <span class="text-[10px] font-medium leading-tight sm:text-xs">{{ action.label }}</span>
                </button>

                <button
                  v-if="massActions.length === 0"
                  type="button"
                  class="group flex flex-shrink-0 cursor-pointer flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-red-400 transition-colors hover:bg-gray-700 sm:gap-1 sm:px-3 sm:py-2"
                  @click="handleBulkAction('delete')"
                >
                  <TrashIcon class="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  <span class="text-[10px] font-medium leading-tight sm:text-xs">{{ t('common.tableDeleteSelected') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Table Controls -->
    <div v-if="showControls" class="flex items-center justify-between mb-6 gap-4 flex-wrap">
      <!-- Search -->
      <div v-if="searchable" class="relative flex-1 min-w-[280px] max-w-md">
        <MagnifyingGlassIcon class="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="searchPlaceholder"
          class="w-full pl-11 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 shadow-sm transition-colors focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/30"
          @input="handleSearch"
        />
      </div>

      <!-- Toolbar Actions Slot -->
      <div class="flex items-center gap-3 flex-wrap justify-end">
        <slot name="toolbar-actions"></slot>
        <button
          v-if="columnSettings"
          type="button"
          @click="showColumnSettings = !showColumnSettings"
          class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          :title="t('common.tableColumnSettings')"
        >
          <Cog6ToothIcon class="w-5 h-5" />
          <span>{{ t('common.tableColumns') }}</span>
        </button>
      </div>
    </div>

    <!-- Column Settings Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showColumnSettings"
          class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          @click.self="showColumnSettings = false"
        >
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <!-- Modal Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('common.tableColumnSettings') }}</h3>
              <button
                @click="showColumnSettings = false"
                class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XMarkIcon class="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <!-- Modal Body -->
            <div class="flex-1 overflow-y-auto p-6">
              <div>
                <div class="flex items-center justify-between mb-4">
                  <div>
                    <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ t('common.tableManageColumns') }}</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ t('common.tableManageColumnsHint') }}</p>
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">
                    {{ t('common.tableVisibleCount', { visible: visibleColumns.length, total: columns.length }) }}
                  </div>
                </div>
                
                <div class="space-y-2">
                  <div
                    v-for="(column, index) in orderedColumns"
                    :key="column.key"
                    :draggable="true"
                    @dragstart="handleDragStart(index)"
                    @dragover.prevent
                    @drop="handleDrop(index)"
                    class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                    :class="{ 'opacity-50': draggedIndex === index }"
                  >
                    <!-- Drag Handle -->
                    <ArrowsUpDownIcon class="w-5 h-5 text-gray-400 dark:text-gray-500 cursor-move flex-shrink-0" />
                    
                    <!-- Visibility Checkbox -->
                    <HeadlessCheckbox
                      :checked="isColumnVisible(column.key)"
                      checkbox-class="w-4 h-4 flex-shrink-0"
                      @change="toggleColumnVisibility(column.key)"
                      @click.stop
                    />
                    
                    <!-- Column Label -->
                    <span class="text-sm font-medium text-gray-900 dark:text-white flex-1">
                      {{ column.label }}
                    </span>
                    
                    <!-- Freeze Button -->
                    <button
                      @click.stop="toggleColumnFreeze(column.key)"
                      :disabled="!isColumnFrozen(column.key) && frozenColumns.length >= 2"
                      :class="[
                        'p-1.5 rounded-lg transition-all flex-shrink-0',
                        isColumnFrozen(column.key)
                          ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30'
                          : 'text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
                        !isColumnFrozen(column.key) && frozenColumns.length >= 2 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                      ]"
                      :title="isColumnFrozen(column.key) ? t('common.tableUnfreezeColumn') : frozenColumns.length >= 2 ? t('common.tableFreezeMax') : t('common.tableFreezeColumn')"
                    >
                      <BookmarkIcon class="w-4 h-4" />
                    </button>
                    
                    <!-- Hidden Badge -->
                    <span
                      v-if="!isColumnVisible(column.key)"
                      class="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full flex-shrink-0"
                    >
                      {{ t('common.listFieldHidden') }}
                    </span>
                    
                    <!-- Frozen Badge -->
                    <span
                      v-if="isColumnFrozen(column.key)"
                      class="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full flex-shrink-0"
                    >
                      {{ t('common.tableFrozen') }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                @click="resetColumnSettings"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                {{ t('common.tableResetDefault') }}
              </button>
              <div class="flex items-center gap-3">
                <button
                  @click="showColumnSettings = false"
                  class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  {{ t('actions.cancel') }}
                </button>
                <button
                  @click="applyColumnSettings"
                  class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-800 rounded-lg transition-colors"
                >
                  {{ t('actions.apply') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Table Wrapper -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
      <!-- Table Container with Horizontal Scroll -->
      <div class="overflow-x-auto">
      <!-- Loading State -->
      <div
        v-if="loading"
        class="flex flex-col items-center justify-center py-16"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <ArivuShimmerLogo size="lg" />
        <p class="mt-5 text-base font-medium text-gray-600 dark:text-gray-400">{{ loadingText }}</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="!data || data.length === 0" class="flex flex-col items-center justify-center py-16 px-4">
        <slot name="empty">
          <ArchiveBoxXMarkIcon class="w-20 h-20 text-gray-300 dark:text-gray-600 mb-5" />
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">{{ emptyTitle }}</h3>
          <p class="text-base text-gray-500 dark:text-gray-400 text-center max-w-md">{{ emptyMessage }}</p>
        </slot>
      </div>

      <!-- Data Table -->
      <table v-else class="min-w-max">
        <thead class="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-b-2 border-gray-200 dark:border-gray-600">
          <tr>
            <!-- Selection Column (Always Frozen) -->
            <th 
              v-if="selectable" 
              class="sticky-selection-header w-14 px-4 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800"
            >
              <HeadlessCheckbox
                :checked="allSelected"
                checkbox-class="w-4 h-4 transition-all"
                @change="toggleSelectAll"
              />
            </th>

            <!-- Data Columns -->
            <th
              v-for="column in visibleColumns"
              :key="column.key"
              :class="[
                'px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap relative',
                column.headerClass,
                isColumnFrozen(column.key) ? 'frozen-column-header bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800' : ''
              ]"
              @click="column.sortable !== false ? handleSort(column.key) : null"
              :title="column.sortable !== false ? getSortTitle(column.key) : ''"
              :style="{ 
                cursor: column.sortable !== false ? 'pointer' : 'default', 
                width: columnWidths[column.key] || column.width || 'auto',
                minWidth: column.minWidth || 'auto', 
                maxWidth: column.maxWidth || 'none',
                ...(isColumnFrozen(column.key) ? { left: getFrozenColumnOffset(column.key) } : {})
              }"
            >
              <div class="flex items-center gap-2 select-none group">
                <span>{{ column.label }}</span>
                
                <!-- Sort Icon -->
                <span v-if="column.sortable !== false" class="flex items-center ml-auto">
                  <!-- Active sort -->
                  <span v-if="sortBy === column.key" class="text-indigo-600 dark:text-indigo-500">
                    <ChevronUpIcon v-if="sortOrder === 'asc'" class="w-4 h-4" />
                    <ChevronDownIcon v-else class="w-4 h-4" />
                  </span>
                  
                  <!-- Sortable indicator (inactive) -->
                  <span v-else class="text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowsUpDownIcon class="w-4 h-4" />
                  </span>
                </span>
              </div>
              
              <!-- Resize Handle -->
              <div
                v-if="resizable && column.resizable !== false"
                @mousedown.prevent="startResize($event, column.key)"
                class="resize-handle"
              >
                <div class="resize-line"></div>
              </div>
            </th>
            
            <!-- Actions Column Header (Hidden) -->
            <th v-if="hasActions" class="actions-cell-header"></th>
          </tr>
        </thead>

        <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
          <tr
            v-for="(row, index) in displayData"
            :key="getRowKey(row, index)"
            :class="[
              'hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-150 cursor-pointer group',
              isSelected(row) ? 'bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40' : '',
              rowClass
            ]"
            @click="handleRowClick(row, $event)"
            @auxclick="handleRowAuxClick(row, $event)"
          >
            <!-- Selection Column (Always Frozen) -->
            <td 
              v-if="selectable" 
              class="sticky-selection-cell px-4 py-4 text-sm text-gray-900 dark:text-white bg-inherit"
              :class="{
                'bg-white dark:bg-gray-800': !isSelected(row),
                'bg-indigo-50 dark:bg-indigo-900/30': isSelected(row)
              }"
            >
              <HeadlessCheckbox
                :checked="isSelected(row)"
                checkbox-class="w-4 h-4 transition-all"
                @change="toggleSelect(row)"
                @click.stop
              />
            </td>

            <!-- Data Columns -->
            <td
              v-for="column in visibleColumns"
              :key="column.key"
              :class="[
                'px-6 py-4 text-sm text-gray-900 dark:text-white table-cell-truncate',
                column.cellClass,
                isColumnFrozen(column.key) ? 'frozen-column-cell' : '',
                isColumnFrozen(column.key) && !isSelected(row) ? 'bg-white dark:bg-gray-800' : '',
                isColumnFrozen(column.key) && isSelected(row) ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''
              ]"
              :style="{ 
                width: columnWidths[column.key] || column.width || 'auto',
                minWidth: column.minWidth || 'auto', 
                maxWidth: column.maxWidth || 'none',
                ...(isColumnFrozen(column.key) ? { left: getFrozenColumnOffset(column.key) } : {})
              }"
              :title="getCellTitle(row, column)"
            >
              <slot :name="`cell-${column.key}`" :row="row" :value="getCellValue(row, column.key)">
                <component
                  v-if="column.component"
                  :is="column.component"
                  :value="getCellValue(row, column.key)"
                  :row="row"
                />
                <!-- Multi-Picklist: Render as badges -->
                <div v-else-if="column.dataType === 'Multi-Picklist'" class="flex flex-wrap gap-1">
                  <template v-if="getMultiPicklistArray(row, column.key).length > 0">
                    <BadgeCell 
                      v-for="(item, index) in getMultiPicklistArray(row, column.key)" 
                      :key="index"
                      :value="getPicklistItemValue(item)" 
                      :options="column.options || []"
                    />
                  </template>
                  <span v-else class="text-gray-400 dark:text-gray-500">-</span>
                </div>
                <!-- Picklist: Single value as badge -->
                <BadgeCell 
                  v-else-if="column.dataType === 'Picklist' && getCellValue(row, column.key)"
                  :value="getPicklistItemValue(getCellValue(row, column.key))" 
                  :options="column.options || []"
                />
                <!-- Picklist: Empty value -->
                <span v-else-if="column.dataType === 'Picklist' && !getCellValue(row, column.key)" class="text-gray-400 dark:text-gray-500">-</span>
                <span v-else-if="column.format" class="block truncate">
                  {{ column.format(getCellValue(row, column.key), row) }}
                </span>
                <span v-else class="block truncate">
                  {{ formatRawValueForDisplay(getCellValue(row, column.key), column) }}
                </span>
              </slot>
            </td>

            <!-- Sticky Actions Cell -->
            <td 
              v-if="hasActions" 
              class="actions-cell"
              @click.stop
            >
              <div class="actions-container">
                <slot name="actions" :row="row">
                  <button
                    v-if="!hideEdit"
                    @click.stop="$emit('edit', row)"
                    class="p-2 rounded-lg transition-all duration-200 hover:scale-110 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                    :title="t('actions.edit')"
                  >
                    <PencilSquareIcon class="w-5 h-5" />
                  </button>
                  <button
                    v-if="!hideDelete"
                    @click.stop="$emit('delete', row)"
                    class="p-2 rounded-lg transition-all duration-200 hover:scale-110 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                    :title="t('actions.delete')"
                  >
                    <TrashIcon class="w-5 h-5" />
                  </button>
                </slot>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="paginated && !loading && data && data.length > 0" class="flex items-center justify-between mt-6 px-6 py-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
      <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
        <span>
          {{ t('common.tableShowingResults', { start: startRecord, end: endRecord, total: totalRecords }) }}
        </span>
      </div>
      
      <div class="flex items-center gap-2">
        <button
          @click="previousPage"
          :disabled="currentPage === 1"
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-700 transition-all shadow-sm hover:shadow-md hover:scale-105"
        >
          <ChevronLeftIcon class="w-4 h-4" />
          {{ t('actions.previous') }}
        </button>

        <div class="flex items-center gap-1">
          <button
            v-for="page in visiblePages"
            :key="page"
            @click="goToPage(page)"
            :class="[
              'min-w-[40px] px-3 py-2 text-sm font-medium rounded-lg transition-all shadow-sm',
              page === currentPage
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white border-indigo-600 hover:from-indigo-700 hover:to-indigo-800 shadow-md'
                : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-md hover:scale-105'
            ]"
          >
            {{ page }}
          </button>
        </div>

        <button
          @click="nextPage"
          :disabled="currentPage === totalPages"
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-700 transition-all shadow-sm hover:shadow-md hover:scale-105"
        >
          {{ t('actions.next') }}
          <ChevronRightIcon class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import ArivuShimmerLogo from '@/components/common/ArivuShimmerLogo.vue';
import { XMarkIcon, TrashIcon, PencilSquareIcon, ArrowUpTrayIcon, ArchiveBoxIcon, ChevronLeftIcon, ChevronRightIcon, ArrowsUpDownIcon, EyeIcon, MagnifyingGlassIcon, Cog6ToothIcon, BookmarkIcon, ArchiveBoxXMarkIcon, ChevronUpIcon, ChevronDownIcon, CheckCircleIcon, NoSymbolIcon, DocumentDuplicateIcon, ArrowPathIcon, ArrowRightIcon, RectangleStackIcon, StarIcon, PuzzlePieceIcon } from '@heroicons/vue/24/outline';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { formatRawValueForDisplay } from '@/utils/fieldDisplay';
import { matchesAnySearchTerm, sortBySearchRelevance } from '@/utils/searchRelevance';

function dtDbg(...args) {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
}

const props = defineProps({
  // Data
  data: {
    type: Array,
    default: () => []
  },
  columns: {
    type: Array,
    required: true
  },
  rowKey: {
    type: [String, Function],
    default: 'id'
  },
  
  // Features
  searchable: {
    type: Boolean,
    default: false
  },
  sortable: {
    type: Boolean,
    default: true
  },
  serverSide: {
    type: Boolean,
    default: false
  },
  paginated: {
    type: Boolean,
    default: true
  },
  selectable: {
    type: Boolean,
    default: false
  },
  resizable: {
    type: Boolean,
    default: false
  },
  persistWidths: {
    type: Boolean,
    default: true
  },
  tableId: {
    type: String,
    default: 'datatable'
  },
  
  // Pagination
  perPage: {
    type: Number,
    default: 10
  },
  totalRecords: {
    type: Number,
    default: 0
  },
  
  // Actions
  hasActions: {
    type: Boolean,
    default: true
  },
  hideEdit: {
    type: Boolean,
    default: false
  },
  hideDelete: {
    type: Boolean,
    default: false
  },
  
  // Mass Actions
  massActions: {
    type: Array,
    default: () => []
    // Example: [{ label: 'Delete', icon: 'trash', action: 'bulk-delete', variant: 'danger' }]
  },
  
  // States
  loading: {
    type: Boolean,
    default: false
  },
  
  // Customization
  searchPlaceholder: {
    type: String,
    default: 'Search...'
  },
  emptyTitle: {
    type: String,
    default: 'No items yet'
  },
  emptyMessage: {
    type: String,
    default: 'Items will appear here as you add them.'
  },
  loadingText: {
    type: String,
    default: 'Loading...'
  },
  rowClass: {
    type: [String, Function],
    default: ''
  },
  showControls: {
    type: Boolean,
    default: true
  },
  columnSettings: {
    type: Boolean,
    default: false
  },
  /** Entity name for bulk bar label, e.g. "Users" → "1 User selected" */
  selectionBarTitle: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['row-click', 'edit', 'delete', 'select', 'sort', 'search', 'page-change', 'bulk-action']);

// Internal state
const searchQuery = ref('');
const sortBy = ref('');
const sortOrder = ref('asc');
const currentPage = ref(1);
const selectedRows = ref([]);
const selectAllPages = ref(false);

const isDeleteMassAction = (action) =>
  action.action === 'delete'
  || action.action === 'bulk-delete'
  || action.icon === 'delete'
  || action.icon === 'trash';

const nonDeleteMassActions = computed(() => props.massActions.filter((action) => !isDeleteMassAction(action)));
const deleteMassActions = computed(() => props.massActions.filter((action) => isDeleteMassAction(action)));

const selectionCount = computed(() =>
  selectAllPages.value ? (props.totalRecords || props.data.length) : selectedRows.value.length
);

const selectionLabelText = computed(() => {
  const count = selectionCount.value;
  if (selectAllPages.value && props.selectionBarTitle) {
    return t('common.listAllMatchingSelected', { count, module: props.selectionBarTitle });
  }
  if (props.selectionBarTitle) {
    const plural = props.selectionBarTitle;
    const singular = plural.endsWith('s') ? plural.slice(0, -1) : plural;
    return t('common.listRowsSelected', count, { count, singular, plural });
  }
  if (selectAllPages.value) {
    return t('common.tableAllSelected', { count });
  }
  return t('common.tableSelectedCount', { count });
});

const massActionIconMap = {
  trash: TrashIcon,
  delete: TrashIcon,
  export: ArrowUpTrayIcon,
  download: ArrowUpTrayIcon,
  duplicate: DocumentDuplicateIcon,
  archive: ArchiveBoxIcon,
  convert: ArrowPathIcon,
  move: ArrowRightIcon,
  sequence: RectangleStackIcon,
  sidekick: StarIcon,
  apps: PuzzlePieceIcon,
  edit: PencilSquareIcon,
  pencil: PencilSquareIcon,
  check: CheckCircleIcon,
  activate: CheckCircleIcon,
  ban: NoSymbolIcon,
  deactivate: NoSymbolIcon
};

const getMassActionIcon = (iconName) => massActionIconMap[iconName] || PencilSquareIcon;

// Column resizing state
const columnWidths = ref({});
const resizing = ref(null);

// Column settings state
const showColumnSettings = ref(false);
const hiddenColumns = ref([]);
const columnOrder = ref([]);
const frozenColumns = ref([]);
const draggedIndex = ref(null);

// Load saved settings from localStorage
onMounted(() => {
  if (props.persistWidths && props.resizable) {
    const saved = localStorage.getItem(`datatable-${props.tableId}-widths`);
    if (saved) {
      try {
        columnWidths.value = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved column widths:', e);
      }
    }
  }
  
  if (props.columnSettings) {
    const savedHidden = localStorage.getItem(`datatable-${props.tableId}-hidden`);
    const savedOrder = localStorage.getItem(`datatable-${props.tableId}-order`);
    const savedFrozen = localStorage.getItem(`datatable-${props.tableId}-frozen`);
    
    if (savedHidden) {
      try {
        hiddenColumns.value = JSON.parse(savedHidden);
      } catch (e) {
        console.error('Failed to parse saved hidden columns:', e);
      }
    }
    
    if (savedOrder) {
      try {
        columnOrder.value = JSON.parse(savedOrder);
      } catch (e) {
        console.error('Failed to parse saved column order:', e);
        columnOrder.value = props.columns.map(col => col.key);
      }
    } else {
      columnOrder.value = props.columns.map(col => col.key);
    }
    
    if (savedFrozen) {
      try {
        frozenColumns.value = JSON.parse(savedFrozen);
        dtDbg('Loaded frozen columns:', frozenColumns.value);
      } catch (e) {
        console.error('Failed to parse saved frozen columns:', e);
      }
    } else {
      dtDbg('No saved frozen columns found');
    }
  }
  
  // Load saved sort state
  if (props.sortable && props.tableId) {
    const savedSort = localStorage.getItem(`datatable-${props.tableId}-sort`);
    if (savedSort) {
      try {
        const { by, order } = JSON.parse(savedSort);
        sortBy.value = by;
        sortOrder.value = order;
        dtDbg('Loaded sort state in DataTable:', { by, order });
      } catch (e) {
        console.error('Failed to parse saved sort state:', e);
      }
    }
  }
});

// Save column widths to localStorage
const saveColumnWidths = () => {
  if (props.persistWidths && props.resizable) {
    localStorage.setItem(`datatable-${props.tableId}-widths`, JSON.stringify(columnWidths.value));
  }
};

// Column resize handlers
const startResize = (event, columnKey) => {
  event.preventDefault();
  event.stopPropagation();
  
  // Find the th element
  const th = event.target.closest('th');
  if (!th) {
    console.error('Could not find th element');
    return;
  }
  
  const startX = event.clientX;
  const startWidth = th.offsetWidth;
  
  dtDbg(`Starting resize for ${columnKey}:`, { startX, startWidth });
  
  resizing.value = { columnKey, startX, startWidth };
  
  // Add event listeners
  document.addEventListener('mousemove', handleResize, { passive: false });
  document.addEventListener('mouseup', stopResize);
  
  // Change cursor and disable selection
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
};

const handleResize = (event) => {
  if (!resizing.value) return;
  
  event.preventDefault();
  
  const { columnKey, startX, startWidth } = resizing.value;
  const diff = event.clientX - startX;
  
  // Get the column definition to check for minWidth
  const column = props.columns.find(col => col.key === columnKey);
  const minWidth = column?.minWidth ? parseInt(column.minWidth) : 100;
  const newWidth = Math.max(minWidth, startWidth + diff);
  
  dtDbg(`Resizing ${columnKey}:`, { diff, newWidth, minWidth });
  
  // Update the column width
  columnWidths.value = {
    ...columnWidths.value,
    [columnKey]: `${newWidth}px`
  };
};

const stopResize = () => {
  if (resizing.value) {
    dtDbg('Stopping resize, saving widths:', columnWidths.value);
    saveColumnWidths();
    resizing.value = null;
  }
  
  // Remove event listeners
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  
  // Restore cursor and selection
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
};

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
});

// Computed
const orderedColumns = computed(() => {
  if (!props.columnSettings || columnOrder.value.length === 0) {
    return props.columns;
  }
  
  // Create a map for quick lookup
  const columnMap = {};
  props.columns.forEach(col => {
    columnMap[col.key] = col;
  });
  
  // Order columns based on columnOrder, filter out any that don't exist
  const ordered = columnOrder.value
    .map(key => columnMap[key])
    .filter(col => col !== undefined);
  
  // Add any new columns that aren't in the order array
  props.columns.forEach(col => {
    if (!columnOrder.value.includes(col.key)) {
      ordered.push(col);
    }
  });
  
  return ordered;
});

const visibleColumns = computed(() => {
  if (!props.columnSettings) {
    return orderedColumns.value;
  }
  
  return orderedColumns.value.filter(col => !hiddenColumns.value.includes(col.key));
});

const displayData = computed(() => {
  let result = props.data || [];
  
  // Client-side search
  if (props.searchable && searchQuery.value) {
    const query = searchQuery.value.trim();
    result = result.filter(row => {
      return visibleColumns.value.some(column => {
        const value = getCellValue(row, column.key);
        return matchesAnySearchTerm(String(value ?? ''), query);
      });
    });
    result = sortBySearchRelevance(result, query, (row) =>
      visibleColumns.value.map((column, index) => ({
        texts: [String(getCellValue(row, column.key) ?? '')],
        primary: index === 0
      }))
    );
  }
  
  // Client-side sort (only if not using server-side sorting)
  if (props.sortable && !props.serverSide && sortBy.value) {
    dtDbg('Client-side sorting by:', sortBy.value, 'order:', sortOrder.value);
    dtDbg('Number of records before sort:', result.length);
    
    result = [...result].sort((a, b) => {
      // Find the column definition to check for custom sortValue
      const column = visibleColumns.value.find(col => col.key === sortBy.value);
      
      let aVal, bVal;
      if (column?.sortValue) {
        // Use custom sort value (can be a function or field name)
        if (typeof column.sortValue === 'function') {
          aVal = column.sortValue(a);
          bVal = column.sortValue(b);
        } else {
          aVal = getCellValue(a, column.sortValue);
          bVal = getCellValue(b, column.sortValue);
        }
      } else {
        // Default: use the column key
        aVal = getCellValue(a, sortBy.value);
        bVal = getCellValue(b, sortBy.value);
      }
      
      // Handle null/undefined values
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      
      // Convert to lowercase for case-insensitive string comparison
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return sortOrder.value === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder.value === 'asc' ? 1 : -1;
      return 0;
    });
    
    dtDbg('Number of records after sort:', result.length);
    if (result.length > 0) {
      dtDbg('First record:', result[0]);
      dtDbg('Last record:', result[result.length - 1]);
    }
  } else if (props.serverSide && sortBy.value) {
    dtDbg('Server-side sorting - skipping client-side sort');
  }
  
  // Client-side pagination (only if not using server-side pagination)
  if (props.paginated && !props.serverSide) {
    const start = (currentPage.value - 1) * props.perPage;
    const end = start + props.perPage;
    result = result.slice(start, end);
  }
  
  return result;
});

const totalPages = computed(() => {
  const total = props.totalRecords || props.data?.length || 0;
  return Math.ceil(total / props.perPage);
});

const startRecord = computed(() => {
  return ((currentPage.value - 1) * props.perPage) + 1;
});

const endRecord = computed(() => {
  const end = currentPage.value * props.perPage;
  const total = props.totalRecords || props.data?.length || 0;
  return Math.min(end, total);
});

const visiblePages = computed(() => {
  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages.value, start + maxVisible - 1);
  
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  
  return pages;
});

const allSelected = computed(() => {
  return displayData.value.length > 0 && 
         displayData.value.every(row => isSelected(row));
});

const showSelectAllBanner = computed(() => {
  return allSelected.value && 
         !selectAllPages.value && 
         props.paginated && 
         (props.totalRecords || props.data?.length || 0) > displayData.value.length;
});

// Methods
const getCellValue = (row, key) => {
  if (key.includes('.')) {
    return key.split('.').reduce((obj, k) => obj?.[k], row);
  }

  const value = row[key];

  // Handle populated relationship fields (lookup fields)
  // If value is an object with _id and a display field (name, title, etc.), extract the display value
  if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
    // Check for common display fields in order of preference
    if (value.name) return value.name;
    if (value.title) return value.title;
    if (value.firstName && value.lastName) return `${value.firstName} ${value.lastName}`;
    if (value.first_name && value.last_name) return `${value.first_name} ${value.last_name}`;
    if (value.label) return value.label;
    if (value.email) return value.email;
    if (value.username) return value.username;
    // Object with only _id - never show raw ObjectId
    if (value._id) return '—';
  }

  // Never show raw ObjectId strings
  if (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value.trim())) return '—';

  return row[key];
};

const getCellDisplayValue = (row, column) => {
  const value = getCellValue(row, column.key);
  if (column.format) {
    return column.format(value, row);
  }
  return value || '';
};

// Helper to get multi-picklist array (handles both array and JSON string)
const getMultiPicklistArray = (row, key) => {
  const value = getCellValue(row, key);
  if (!value) return [];
  if (Array.isArray(value)) return value;
  // Try to parse as JSON string (e.g., "[\"Customer\", \"Partner\"]")
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Not valid JSON, return empty array
    }
  }
  return [];
};

// Helper to extract value from picklist item (handles both string and object formats)
const getPicklistItemValue = (item) => {
  if (!item) return '';
  if (typeof item === 'string') {
    if (/^[0-9a-fA-F]{24}$/.test(item.trim())) return '—';
    return item;
  }
  if (typeof item === 'object' && item !== null) {
    const display = item.value || item.label || item.name || item.title;
    if (display) return display;
    return '—';
  }
  return String(item);
};

// Get cell title for tooltip (formatted nicely for multi-picklist)
const getCellTitle = (row, column) => {
  if (column.dataType === 'Multi-Picklist') {
    const items = getMultiPicklistArray(row, column.key);
    return items.length > 0 ? items.map(item => getPicklistItemValue(item)).join(', ') : '';
  }
  return getCellDisplayValue(row, column);
};

const getRowKey = (row, index) => {
  if (typeof props.rowKey === 'function') {
    return props.rowKey(row);
  }
  return row[props.rowKey] || index;
};

const getSortTitle = (key) => {
  if (sortBy.value === key) {
    if (sortOrder.value === 'asc') {
      return 'Click to sort descending';
    } else {
      return 'Click to clear sort';
    }
  }
  return 'Click to sort ascending';
};

const handleSort = (key) => {
  if (sortBy.value === key) {
    // Cycle through: asc → desc → no sort
    if (sortOrder.value === 'asc') {
      sortOrder.value = 'desc';
    } else if (sortOrder.value === 'desc') {
      // Clear sort
      sortBy.value = '';
      sortOrder.value = 'asc';
    }
  } else {
    // New column - start with ascending
    sortBy.value = key;
    sortOrder.value = 'asc';
  }
  emit('sort', { key: sortBy.value, order: sortOrder.value });
};

const handleSearch = () => {
  currentPage.value = 1;
  emit('search', searchQuery.value);
};

const handleRowClick = (row, event) => {
  emit('row-click', row, event);
};

// Handle auxiliary button click (middle mouse button)
const handleRowAuxClick = (row, event) => {
  // Middle mouse button (button 1)
  if (event.button === 1) {
    event.preventDefault();
    emit('row-click', row, event);
  }
};

const previousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
    emit('page-change', currentPage.value);
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    emit('page-change', currentPage.value);
  }
};

const goToPage = (page) => {
  currentPage.value = page;
  emit('page-change', page);
};

const isSelected = (row) => {
  return selectedRows.value.some(selected => 
    getRowKey(selected, 0) === getRowKey(row, 0)
  );
};

const toggleSelect = (row) => {
  const index = selectedRows.value.findIndex(selected => 
    getRowKey(selected, 0) === getRowKey(row, 0)
  );
  
  if (index > -1) {
    selectedRows.value.splice(index, 1);
  } else {
    selectedRows.value.push(row);
  }
  
  emit('select', selectedRows.value);
};

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedRows.value = [];
    selectAllPages.value = false;
  } else {
    selectedRows.value = [...displayData.value];
    selectAllPages.value = false;
  }
  emit('select', selectedRows.value);
};

const selectAllAcrossPages = () => {
  selectAllPages.value = true;
  selectedRows.value = [...displayData.value]; // Keep current page selected for UI
  emit('select', selectedRows.value, true); // Pass flag indicating all pages selected
};

const handleBulkAction = (action) => {
  emit('bulk-action', {
    action: action,
    selectedRows: selectedRows.value,
    selectAllPages: selectAllPages.value,
    totalRecords: props.totalRecords || props.data?.length || 0
  });
};

const clearSelection = () => {
  selectedRows.value = [];
  selectAllPages.value = false;
  emit('select', []);
};

// Column settings methods
const isColumnVisible = (columnKey) => {
  return !hiddenColumns.value.includes(columnKey);
};

const toggleColumnVisibility = (columnKey) => {
  const index = hiddenColumns.value.indexOf(columnKey);
  if (index > -1) {
    hiddenColumns.value.splice(index, 1);
  } else {
    hiddenColumns.value.push(columnKey);
  }
};

const handleDragStart = (index) => {
  draggedIndex.value = index;
};

const handleDrop = (dropIndex) => {
  if (draggedIndex.value === null) return;
  
  const draggedColumn = columnOrder.value[draggedIndex.value];
  columnOrder.value.splice(draggedIndex.value, 1);
  columnOrder.value.splice(dropIndex, 0, draggedColumn);
  
  draggedIndex.value = null;
};

const isColumnFrozen = (columnKey) => {
  return frozenColumns.value.includes(columnKey);
};

const toggleColumnFreeze = (columnKey) => {
  const index = frozenColumns.value.indexOf(columnKey);
  if (index > -1) {
    frozenColumns.value.splice(index, 1);
  } else {
    if (frozenColumns.value.length < 2) {
      frozenColumns.value.push(columnKey);
    }
  }
  
  // Save immediately to localStorage
  if (props.tableId) {
    localStorage.setItem(`datatable-${props.tableId}-frozen`, JSON.stringify(frozenColumns.value));
    dtDbg('Saved frozen columns:', frozenColumns.value);
  }
};

// Calculate left offset for frozen columns
const getFrozenColumnOffset = (columnKey) => {
  let offset = 0;
  
  // Add selection column width (56px = w-14)
  if (props.selectable) {
    offset += 56;
  }
  
  // Add widths of previous frozen columns
  for (const col of visibleColumns.value) {
    if (col.key === columnKey) break;
    if (frozenColumns.value.includes(col.key)) {
      // Use saved width or default to 200px
      const width = columnWidths.value[col.key] || col.width || '200px';
      offset += parseInt(width) || 200;
    }
  }
  
  return `${offset}px`;
};

const applyColumnSettings = () => {
  // Save to localStorage
  if (props.columnSettings) {
    localStorage.setItem(`datatable-${props.tableId}-hidden`, JSON.stringify(hiddenColumns.value));
    localStorage.setItem(`datatable-${props.tableId}-order`, JSON.stringify(columnOrder.value));
    localStorage.setItem(`datatable-${props.tableId}-frozen`, JSON.stringify(frozenColumns.value));
  }
  showColumnSettings.value = false;
};

const resetColumnSettings = () => {
  hiddenColumns.value = [];
  columnOrder.value = props.columns.map(col => col.key);
  frozenColumns.value = [];
  sortBy.value = '';
  sortOrder.value = 'asc';
  
  // Clear from localStorage
  localStorage.removeItem(`datatable-${props.tableId}-hidden`);
  localStorage.removeItem(`datatable-${props.tableId}-order`);
  localStorage.removeItem(`datatable-${props.tableId}-frozen`);
  localStorage.removeItem(`datatable-${props.tableId}-sort`);
};

// Watch for data changes
watch(() => props.data, () => {
  currentPage.value = 1;
  selectAllPages.value = false;
});

// Watch for page changes - reset select all pages when navigating
watch(currentPage, () => {
  if (selectAllPages.value) {
    // Keep the flag but don't auto-select rows on new page
    // User can still perform bulk actions on all pages
  }
});

// Watch for sort changes and save to localStorage
watch([sortBy, sortOrder], ([newSortBy, newSortOrder]) => {
  if (props.sortable && props.tableId) {
    localStorage.setItem(
      `datatable-${props.tableId}-sort`, 
      JSON.stringify({ by: newSortBy, order: newSortOrder })
    );
    dtDbg('Saved sort state:', { by: newSortBy, order: newSortOrder });
  }
});
</script>

<style scoped>
/* Table Fixed Layout for Resizable Columns */
.table-fixed {
  table-layout: fixed !important;
}

/* Cell Text Truncation */
.table-cell-truncate {
  max-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-cell-truncate > * {
  max-width: 100%;
}

/* Frozen Selection Column */
.sticky-selection-header {
  position: sticky !important;
  left: 0;
  z-index: 30;
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.1);
}

:global(.dark) .sticky-selection-header {
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.3);
}

.sticky-selection-cell {
  position: sticky !important;
  left: 0;
  z-index: 30;
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.1);
}

:global(.dark) .sticky-selection-cell {
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.3);
}

/* Frozen Column Header */
.frozen-column-header {
  position: sticky !important;
  z-index: 25;
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.1);
}

:global(.dark) .frozen-column-header {
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.3);
}

/* Frozen Column Cell */
.frozen-column-cell {
  position: sticky !important;
  z-index: 20;
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.1);
}

:global(.dark) .frozen-column-cell {
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.3);
}

/* Sticky Actions Cell Header */
.actions-cell-header {
  position: sticky !important;
  right: 0;
  z-index: 21;
  width: 160px;
  min-width: 160px;
  padding: 1rem !important;
  border: none;
}

:global(.dark) .actions-cell-header {
  background: rgb(55, 65, 81);
  background: linear-gradient(to right, rgba(55, 65, 81, 0) 0%, rgb(55, 65, 81) 10%);
}

/* Sticky Actions Cell - Stays at viewport edge */
.actions-cell {
  position: sticky !important;
  right: 16px;
  z-index: 20;
  width: 160px;
  min-width: 160px;
  padding: 1rem !important;
  text-align: right;
  vertical-align: middle;
  background: transparent;
  transition: background 0.15s ease;
}

/* Show background on row hover
tr:hover .actions-cell {
} */

:global(.dark) tr:hover .actions-cell {
  background: rgb(31, 41, 55);
  background: linear-gradient(to right, rgba(31, 41, 55, 0) 0%, rgb(31, 41, 55) 10%);
}

/* Actions Container */
.actions-container {
  display: inline-flex;
  align-items: center;
  justify-content: end;
  gap: 8px;
  background: white;
  padding: 8px 12px;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border: 1px solid rgb(229, 231, 235);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  white-space: nowrap;
}

:global(.dark) .actions-container {
  background: rgb(31, 41, 55);
  border-color: rgb(55, 65, 81);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
}

/* Show actions on row hover */
tr:hover .actions-container {
  opacity: 1;
  pointer-events: auto;
}

/* Column Resize Handle */
.resize-handle {
  position: absolute;
  right: -8px;
  top: 0;
  bottom: 0;
  width: 16px;
  cursor: col-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.resize-handle:hover {
  background-color: rgba(96, 73, 231, 0.1);
}

.resize-line {
  width: 2px;
  height: 100%;
  background-color: transparent;
  transition: background-color 0.2s;
}

.resize-handle:hover .resize-line {
  background-color: rgb(96, 73, 231);
}

:global(.dark) .resize-handle:hover {
  background-color: rgba(96, 73, 231, 0.2);
}

:global(.dark) .resize-handle:hover .resize-line {
  background-color: rgb(112, 93, 255);
}

/* Modal animation */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-active > div,
.modal-leave-active > div {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div,
.modal-leave-to > div {
  transform: scale(0.95) translateY(-20px);
}
</style>

<style scoped>
/* Smooth scrolling for horizontal overflow */
.overflow-x-auto {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
}

.overflow-x-auto::-webkit-scrollbar {
  height: 8px;
}

.overflow-x-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 4px;
}

.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

/* Dark mode scrollbar */
.dark .overflow-x-auto {
  scrollbar-color: rgba(75, 85, 99, 0.5) transparent;
}

.dark .overflow-x-auto::-webkit-scrollbar-thumb {
  background-color: rgba(75, 85, 99, 0.5);
}

.dark .overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(75, 85, 99, 0.7);
}
</style>

