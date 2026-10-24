<template>
  <div
    class="-mx-4 sm:-mx-6 lg:-mx-8"
    :class="fillsParentHeight ? 'flex h-full min-h-0 flex-1 flex-col' : '-my-2'"
  >
    <div
      class="w-full align-middle"
      :class="fillsParentHeight ? 'flex h-full min-h-0 flex-col py-0' : 'py-2'"
    >
      <div
        class="table-view-shell"
        :class="[
          showEmptyOverlay
            ? (fillsParentHeight
                ? 'relative z-[1] flex h-full min-h-[320px] flex-col'
                : 'relative z-[1] flex min-h-[480px] flex-col')
            : 'relative z-[1]',
          fillsParentHeight && !showEmptyOverlay ? 'flex h-full min-h-0 flex-col' : '',
          isMobileCardLayout
            ? 'overflow-x-hidden overflow-y-visible rounded-none !border-0 bg-transparent shadow-none'
            : 'overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-900'
        ]"
        :style="{ '--row-actions-gutter': rowActionsGutter || '7rem' }"
      >
        <div
          v-if="showScrollRestoreOverlay"
          class="absolute inset-0 z-[60] flex flex-col justify-start bg-white px-5 pt-10 dark:bg-gray-900"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span class="sr-only">{{ t('common.tableLoadingSr') }}</span>
          <div class="space-y-3">
            <div
              v-for="n in loadingSkeletonRowCount"
              :key="`scroll-restore-sk-${n}`"
              class="h-10 w-full rounded-lg bg-gray-100 animate-pulse dark:bg-gray-800/80"
            />
          </div>
        </div>
        <div
          ref="scrollContainerRef"
          class="relative table-scroll-container"
          :class="[
            scrollContainerClass,
            {
              'invisible': showScrollRestoreOverlay,
              'table-mobile-card': isMobileCardLayout,
              'rounded-xl': !isMobileCardLayout && !showEmptyOverlay,
              'rounded-t-xl': !isMobileCardLayout && showEmptyOverlay
            }
          ]"
          :style="{ ...scrollContainerStyles, width: '100%', maxWidth: '100%', isolation: 'auto' }"
          @scroll="handleScroll"
        >
          <div
            v-if="isResizing && resizeGuideX !== null && resizeGuideBounds"
            class="pointer-events-none fixed z-[999] w-0.5 bg-indigo-500"
            :style="{
              left: `${resizeGuideX}px`,
              top: `${resizeGuideBounds.top}px`,
              height: `${resizeGuideBounds.bottom - resizeGuideBounds.top}px`
            }"
          />
          <table
            ref="tableRef"
            class="table-grid text-sm text-gray-900 dark:text-gray-200"
            :style="{ width: '100%', minWidth: tableMinWidth, display: 'table', tableLayout: 'fixed' }"
          >
            <colgroup>
              <col v-if="showSelectionColumn" :style="{ width: selectionColumnWidthPx }" />
              <col
                v-for="column in displayColumns"
                :key="`${columnKey(column)}-col`"
                :style="columnColStyle(column)"
              />
              <!-- Absorbs slack when table is wider than sum(columns); keeps data cols fixed-width, row lines full-width -->
              <col v-if="hasFlexFillColumn" style="min-width: 0; width: auto" />
            </colgroup>
            <thead v-if="!isMobileCardLayout" class="bg-white dark:bg-gray-900">
              <tr ref="labelHeaderRowRef">
                <th
                  v-if="selectable"
                  scope="col"
                  :class="[
                    'table-head-cell table-selection-cell relative box-border sticky cursor-pointer bg-white dark:bg-gray-900',
                    selectionColumnVariant === 'numbered-hover' ? 'px-1' : 'px-7 sm:w-12 sm:px-6',
                    leftEdgeColumnIndex === 0 ? 'rounded-tl-xl' : '',
                    'hover:bg-gray-50 dark:hover:bg-gray-800'
                  ]"
                  :style="selectionHeaderCellStyle"
                  @click.stop="onSelectionHeaderClick($event)"
                >
                  <span
                    v-if="selectionColumnVariant === 'numbered-hover'"
                    class="sr-only"
                  >{{ t('common.tableRowSelectSr') }}</span>
                  <div class="absolute inset-0 flex items-center justify-center">
                    <HeadlessCheckbox
                      :checked="allSelected"
                      :indeterminate="someSelected"
                      @change="toggleSelectAll"
                      @click.stop
                    />
                  </div>
                </th>
                <th
                  v-for="(column, columnIndex) in displayColumns"
                  :key="columnKey(column)"
                  scope="col"
                  :aria-sort="isMobileCardLayout ? undefined : ariaSortForColumn(column)"
                  :class="[
                    'table-head-cell group text-left text-xs font-semibold uppercase tracking-wide text-gray-900 dark:text-white relative',
                    isMobileCardLayout ? 'bg-white dark:bg-gray-900' : 'sticky',
                    !isMobileCardLayout && isColumnFilterHighlighted(column)
                      ? 'bg-indigo-50 dark:bg-indigo-950 table-column-filter-active'
                      : isMobileCardLayout ? '' : 'bg-white dark:bg-gray-900',
                    columnIndex === 0
                      ? (isMobileCardLayout ? 'title-column-cell z-[40]' : 'title-column-cell z-[40] sticky-column-border')
                      : 'z-20',
                    // Apply border-radius only to columns at visible edges
                    (selectable ? columnIndex + 1 : columnIndex) === leftEdgeColumnIndex ? 'rounded-tl-xl' : '',
                    (selectable ? columnIndex + 1 : columnIndex) === rightEdgeColumnIndex ? 'rounded-tr-xl' : '',
                    // Add hover effect for sticky columns
                    isMobileCardLayout || isColumnFilterHighlighted(column) ? '' : 'hover:bg-gray-50 dark:hover:bg-gray-800',
                    // Add shadow when scrolled
                    !isMobileCardLayout && columnIndex === 0 && isScrolledHorizontally ? 'sticky-column-scrolled' : ''
                  ]"
                  :style="[{ top: headerTop }, columnHeaderStyle(column)]"
                >
                  <!-- Mobile card list: no column label chrome (select-all stays in selection th) -->
                  <span v-if="isMobileCardLayout" class="sr-only">{{ columnLabel(column) }}</span>
                  <Menu v-else-if="isColumnSortable(column)" as="div" class="relative h-full w-full">
                    <MenuButton
                      type="button"
                      class="group flex h-full min-h-full w-full items-center justify-between gap-2 px-5 py-3.5 text-left text-xs uppercase tracking-wide transition-colors focus:outline-none focus-visible:outline-none relative z-10"
                      :class="{
                        'cursor-pointer text-indigo-600 dark:text-indigo-300': isColumnFilterHighlighted(column),
                        'cursor-pointer bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300': isColumnSorted(column) && !isColumnFilterHighlighted(column),
                        'cursor-pointer text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800': !isColumnHeaderHighlighted(column)
                      }"
                    >
                      <span class="flex items-center gap-2 truncate">
                        <span class="truncate">{{ columnLabel(column) }}</span>
                        <HoverTooltip
                          :content="sortIconTooltip(column)"
                          :disabled="!sortIconTooltip(column)"
                          :show-delay="0"
                          :hide-delay="40"
                          preferred-placement="above"
                          :z-index="120"
                        >
                          <span
                            class="relative flex items-center justify-center rounded-md p-1 transition-opacity cursor-pointer outline-none"
                            :class="{
                              'opacity-100 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300': isColumnSorted(column),
                              'opacity-0 text-gray-400 group-hover:opacity-100 hover:bg-gray-200 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300': !isColumnSorted(column)
                            }"
                            role="button"
                            tabindex="-1"
                            :aria-label="t('common.tableToggleSort', { column: columnLabel(column) })"
                            @mousedown.prevent.stop
                            @click.stop="onSortIconClick(column, $event)"
                          >
                            <template v-if="isColumnSorted(column)">
                              <span class="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-1 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
                                <span>{{ columnSortOrder(column) === 'asc' ? '↑' : '↓' }}</span>
                                <span v-if="showSortRanks">{{ columnSortRank(column) }}</span>
                              </span>
                            </template>
                            <template v-else>
                              <ArrowsUpDownIcon class="h-3.5 w-3.5" />
                            </template>
                          </span>
                        </HoverTooltip>
                      </span>
                    </MenuButton>
                    <transition
                      enter-active-class="transition duration-100 ease-out"
                      enter-from-class="transform scale-95 opacity-0"
                      enter-to-class="transform scale-100 opacity-100"
                      leave-active-class="transition duration-75 ease-in"
                      leave-from-class="transform scale-100 opacity-100"
                      leave-to-class="transform scale-95 opacity-0"
                    >
                      <MenuItems
                        class="absolute left-0 z-[70] mt-2 w-52 origin-top-left rounded-lg border border-gray-200 bg-white py-1 shadow-lg focus:outline-none dark:border-gray-700 dark:bg-gray-800"
                      >
                        <MenuItem v-slot="{ active }">
                          <button
                            type="button"
                            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-normal"
                            :class="active ? 'bg-gray-100 dark:bg-gray-700' : ''"
                            @click="applyExplicitSort(column, 'asc')"
                          >
                            <ChevronUpIcon class="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <span>{{ t('common.tableSortAscending') }}</span>
                            <CheckIcon
                              v-if="isColumnSorted(column) && columnSortOrder(column) === 'asc' && !showSortRanks"
                              class="ml-auto h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400"
                            />
                            <span
                              v-else-if="isColumnSorted(column) && columnSortOrder(column) === 'asc' && showSortRanks"
                              class="ml-auto text-[10px] font-semibold text-indigo-600 dark:text-indigo-400"
                            >{{ columnSortRank(column) }}</span>
                          </button>
                        </MenuItem>
                        <MenuItem v-slot="{ active }">
                          <button
                            type="button"
                            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-normal"
                            :class="active ? 'bg-gray-100 dark:bg-gray-700' : ''"
                            @click="applyExplicitSort(column, 'desc')"
                          >
                            <ChevronDownIcon class="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <span>{{ t('common.tableSortDescending') }}</span>
                            <CheckIcon
                              v-if="isColumnSorted(column) && columnSortOrder(column) === 'desc' && !showSortRanks"
                              class="ml-auto h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400"
                            />
                            <span
                              v-else-if="isColumnSorted(column) && columnSortOrder(column) === 'desc' && showSortRanks"
                              class="ml-auto text-[10px] font-semibold text-indigo-600 dark:text-indigo-400"
                            >{{ columnSortRank(column) }}</span>
                          </button>
                        </MenuItem>
                        <MenuItem v-if="isColumnSorted(column)" v-slot="{ active }">
                          <button
                            type="button"
                            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-normal"
                            :class="active ? 'bg-gray-100 dark:bg-gray-700' : ''"
                            @click="clearSort(column)"
                          >
                            <XMarkIcon class="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <span>{{ t('common.tableClearSort') }}</span>
                          </button>
                        </MenuItem>
                      </MenuItems>
                    </transition>
                  </Menu>
                  <span
                    v-else
                    class="block px-5 py-3.5 truncate"
                    :class="isColumnFilterHighlighted(column)
                      ? 'text-indigo-600 dark:text-indigo-300'
                      : isColumnHeaderHighlighted(column)
                        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300'
                        : ''"
                  >{{ columnLabel(column) }}</span>
                  <span
                    v-if="isColumnResizable(column)"
                    class="group/resize absolute top-0 right-0 z-20 h-full w-3 cursor-col-resize select-none flex items-center justify-center"
                    @mousedown.prevent.stop="startColumnResize(column, $event)"
                    aria-hidden="true"
                  >
                    <!-- <span class="pointer-events-none absolute right-[-2px] top-0 bottom-0 w-1.5 bg-indigo-500 opacity-0 transition-opacity group-hover/resize:opacity-100" /> -->
                  </span>
                </th>
                <th
                  v-if="hasFlexFillColumn"
                  scope="col"
                  aria-hidden="true"
                  class="table-head-cell table-flex-fill relative sticky z-10 bg-white p-0 dark:bg-gray-900"
                  :style="{ top: headerTop }"
                />
              </tr>
              <tr v-if="columnFiltersEnabled && !isMobileCardLayout" ref="filterHeaderRowRef" class="column-filter-row">
                <th
                  v-if="selectable"
                  scope="col"
                  :class="[
                    'table-head-cell table-filter-cell table-selection-cell relative box-border sticky bg-gray-50 px-2 py-2 dark:bg-gray-800',
                    leftEdgeColumnIndex === 0 ? 'rounded-none' : ''
                  ]"
                  :style="selectionFilterCellStyle"
                >
                  <div class="flex items-center justify-center">
                    <button
                      v-if="hasAnyColumnFilterActive"
                      type="button"
                      class="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white hover:text-gray-600 dark:hover:bg-gray-900 dark:hover:text-gray-200"
                      :aria-label="t('common.listClearFilters')"
                      @click="emit('clear-column-filters')"
                    >
                      <XMarkIcon class="h-4 w-4" />
                    </button>
                    <MagnifyingGlassIcon
                      v-else
                      class="h-4 w-4 text-gray-400 dark:text-gray-500"
                      aria-hidden="true"
                    />
                  </div>
                </th>
                <th
                  v-for="(column, columnIndex) in displayColumns"
                  :key="`${columnKey(column)}-filter`"
                  scope="col"
                  :class="[
                    'table-head-cell table-filter-cell sticky px-3 py-2',
                    isColumnFilterHighlighted(column)
                      ? 'bg-indigo-50 dark:bg-indigo-950 table-column-filter-active'
                      : 'bg-gray-50 dark:bg-gray-800',
                    columnIndex === 0 ? 'title-column-cell z-[35] sticky-column-border' : 'z-20',
                    columnIndex === 0 && isScrolledHorizontally ? 'sticky-column-scrolled' : ''
                  ]"
                  :style="[{ top: columnFilterRowTop }, columnHeaderStyle(column)]"
                >
                  <ListColumnFilter
                    v-if="isColumnFilterable(column)"
                    :filter="filterConfigForColumn(column)"
                    :model-value="filterValueForColumn(column)"
                    inline
                    teleport-options
                    @update:model-value="(value) => emitColumnFilterChange(column, value)"
                    @opened="emitColumnFilterOpened(column)"
                  />
                </th>
                <th
                  v-if="hasFlexFillColumn"
                  scope="col"
                  aria-hidden="true"
                  class="table-head-cell table-filter-cell table-flex-fill sticky bg-gray-50 p-0 dark:bg-gray-800"
                  :style="{ top: columnFilterRowTop }"
                />
              </tr>
            </thead>
            <tbody>
              <template v-if="showDataRows">
                <tr
                  v-if="useVirtualScroll && virtualPaddingTop > 0"
                  aria-hidden="true"
                  class="border-0 pointer-events-none"
                >
                  <td
                    :colspan="tableBodyColspan"
                    class="p-0 border-0"
                    :style="{ height: `${virtualPaddingTop}px` }"
                  />
                </tr>
                <tr
                  v-for="item in renderedRows"
                  :key="item.key"
                  :class="[
                    'group cursor-pointer',
                    item.selected ? 'bg-gray-50 dark:bg-indigo-950 tv-card-selected' : ''
                  ]"
                  @click="handleRowClick(item.row, $event)"
                  @touchstart.passive="onRowTouchStart(item, $event)"
                  @touchend="onRowTouchEnd"
                  @touchmove.passive="onRowTouchMove"
                  @touchcancel="onRowTouchEnd"
                  @mousedown="onRowMouseDown(item, $event)"
                  @mouseup="onRowTouchEnd"
                  @mouseleave="onRowTouchEnd"
                  @contextmenu="onRowContextMenu($event)"
                >
                  <td
                    v-if="showSelectionColumn"
                    :class="[
                      'table-body-cell relative box-border sticky z-20 table-selection-cell cursor-pointer',
                      selectionColumnVariant === 'numbered-hover'
                        ? 'px-1 tv-num-when-hover'
                        : 'px-7 sm:w-12 sm:px-6',
                      rowHeightClass,
                      item.selected ? 'bg-gray-50 dark:bg-indigo-950' : 'bg-white dark:bg-gray-900',
                      item.selected ? '' : 'group-hover:bg-gray-100 dark:group-hover:bg-gray-800'
                    ]"
                    :style="selectionColumnCellStyle"
                    @click.stop="onSelectionCellClick(item.row, $event)"
                  >
                    <div v-if="item.selected" class="hidden group-has-checked:block absolute inset-y-0 left-0 w-0.5 bg-indigo-600"></div>
                    <template v-if="selectionColumnVariant === 'numbered-hover'">
                      <span
                        class="tv-row-index pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400"
                        :class="item.selected ? 'opacity-0' : ''"
                        aria-hidden="true"
                      >{{ rowNumberOffset + item.rowIndex + 1 }}</span>
                      <div
                        class="tv-row-checkbox absolute inset-0 flex items-center justify-center"
                        :class="item.selected ? 'tv-row-checkbox--visible' : 'opacity-0'"
                      >
                        <HeadlessCheckbox
                          :checked="item.selected"
                          @change.stop="toggleRowSelection(item.row)"
                          @click.stop
                        />
                      </div>
                    </template>
                    <div v-else class="absolute inset-0 flex items-center justify-center">
                      <HeadlessCheckbox
                        :checked="item.selected"
                        @change.stop="toggleRowSelection(item.row)"
                        @click.stop
                      />
                    </div>
                  </td>
                  <td
                    v-for="(column, columnIndex) in displayColumns"
                    :key="cellKey(column)"
                    :class="[
                      'table-body-cell px-5 text-sm text-gray-700 align-middle dark:text-gray-200',
                      rowHeightClass,
                      columnIndex === 0 ? [
                        isMobileCardLayout
                          ? 'title-column-cell relative z-20 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700'
                          : 'title-column-cell relative sticky z-20 sticky-column-border',
                        isMobileCardLayout
                          ? (item.selected
                              ? 'bg-indigo-50 dark:bg-indigo-950/60'
                              : 'bg-white dark:bg-gray-800')
                          : (item.selected
                              ? 'bg-gray-50 dark:bg-indigo-950'
                              : 'bg-white dark:bg-gray-900'),
                        !isMobileCardLayout && !item.selected
                          ? 'group-hover:bg-gray-100 dark:group-hover:bg-gray-800'
                          : '',
                        !isMobileCardLayout && isScrolledHorizontally ? 'sticky-column-scrolled' : ''
                      ].join(' ') : [
                        'whitespace-nowrap',
                        item.selected ? 'bg-gray-50 dark:bg-indigo-950' : 'bg-white dark:bg-gray-900',
                        item.selected ? '' : 'group-hover:bg-gray-100 dark:group-hover:bg-gray-800'
                      ].join(' ')
                    ]"
                    :style="columnCellStyle(column)"
                  >
                    <!-- First column: actions overlay on hover — overlay anchors to <td> so its
                         inset-y-0 spans the full cell height (incl. padding), keeping h-8 buttons
                         vertically centered without being clipped by the cell's overflow:hidden. -->
                    <template v-if="columnIndex === 0 && hasActions && !isMobileCardLayout">
                      <div class="flex items-center">
                        <div
                          class="min-w-0 flex-1 pr-0 transition-[padding-right] duration-150 ease-out group-hover:[padding-right:var(--row-actions-gutter,7rem)] group-focus-within:[padding-right:var(--row-actions-gutter,7rem)]"
                        >
                          <slot
                            :name="`cell-${columnKey(column)}`"
                            :column="column"
                            :row="item.row"
                            :value="resolveValue(item.row, column)"
                            :selected="item.selected"
                            :selection-active="false"
                          >
                            <slot
                              name="cell"
                              :column="column"
                              :row="item.row"
                              :value="resolveValue(item.row, column)"
                              :selected="item.selected"
                              :selection-active="false"
                            >
                              {{ resolveValue(item.row, column) }}
                            </slot>
                          </slot>
                        </div>
                      </div>
                      <div
                        class="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center gap-0.5 pr-3 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                        @click.stop
                      >
                        <slot name="actions" :row="item.row" />
                      </div>
                    </template>
                    <!-- Other columns: Normal rendering; first column content truncates -->
                    <template v-else>
                      <div
                        v-if="columnIndex === 0"
                        class="min-w-0"
                        :class="isMobileCardLayout ? '' : 'truncate'"
                      >
                        <slot
                          :name="`cell-${columnKey(column)}`"
                          :column="column"
                          :row="item.row"
                          :value="resolveValue(item.row, column)"
                          :selected="item.selected"
                          :selection-active="isMobileCardLayout && isMobileSelectMode"
                          :on-toggle-select="() => toggleRowSelection(item.row)"
                        >
                          <slot
                            name="cell"
                            :column="column"
                            :row="item.row"
                            :value="resolveValue(item.row, column)"
                            :selected="item.selected"
                            :selection-active="isMobileCardLayout && isMobileSelectMode"
                            :on-toggle-select="() => toggleRowSelection(item.row)"
                          >
                            {{ resolveValue(item.row, column) }}
                          </slot>
                        </slot>
                      </div>
                      <div v-else class="min-w-0 truncate">
                        <slot
                          :name="`cell-${columnKey(column)}`"
                          :column="column"
                          :row="item.row"
                          :value="resolveValue(item.row, column)"
                        >
                          <slot name="cell" :column="column" :row="item.row" :value="resolveValue(item.row, column)">
                            {{ resolveValue(item.row, column) }}
                          </slot>
                        </slot>
                      </div>
                    </template>
                  </td>
                  <td
                    v-if="hasFlexFillColumn"
                    aria-hidden="true"
                    :class="[
                      'table-body-cell table-flex-fill p-0 align-middle',
                      rowHeightClass,
                      item.selected ? 'bg-gray-50 dark:bg-indigo-950' : 'bg-white dark:bg-gray-900',
                      item.selected ? '' : 'group-hover:bg-gray-100 dark:group-hover:bg-gray-800'
                    ]"
                  />
                </tr>
                <tr
                  v-if="useVirtualScroll && virtualPaddingBottom > 0"
                  aria-hidden="true"
                  class="border-0 pointer-events-none"
                >
                  <td
                    :colspan="tableBodyColspan"
                    class="p-0 border-0"
                    :style="{ height: `${virtualPaddingBottom}px` }"
                  />
                </tr>
                <tr
                  v-if="loadMoreEnabled && effectiveHasMore"
                  class="border-0"
                >
                  <td
                    :colspan="tableBodyColspan"
                    class="p-0 border-0"
                  >
                    <div
                      ref="loadMoreSentinelRef"
                      class="h-4 w-full"
                      aria-hidden="true"
                    />
                    <div
                      v-if="loadingMore"
                      class="flex justify-center py-4 text-gray-500 dark:text-gray-400"
                    >
                      <span class="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    </div>
                  </td>
                </tr>
              </template>
              <template v-else-if="isLoading">
                <!-- Awaiting columns: one block so we don't flash numbered gutters or stray rows -->
                <tr v-if="displayColumns.length === 0" class="border-0">
                  <td :colspan="tableBodyColspan" class="border-0 px-5 py-10">
                    <div class="space-y-3" role="status" aria-live="polite" aria-busy="true">
                      <span class="sr-only">{{ t('common.tableLoadingSr') }}</span>
                      <div
                        v-for="n in loadingSkeletonRowCount"
                        :key="`sk-block-${n}`"
                        class="h-10 w-full rounded-lg bg-gray-100 animate-pulse dark:bg-gray-800/80"
                      />
                    </div>
                  </td>
                </tr>
                <template v-else>
                  <tr
                    v-for="n in loadingSkeletonRowCount"
                    :key="`sk-row-${n}`"
                    class="border-0"
                  >
                    <td
                      v-if="showSelectionColumn"
                      :class="[
                        'table-body-cell relative box-border bg-white align-middle dark:bg-gray-900',
                        rowHeightClass,
                        selectionColumnVariant === 'numbered-hover'
                          ? 'px-1 tv-num-when-hover'
                          : 'px-7 sm:w-12 sm:px-6'
                      ]"
                      :style="selectionColumnCellStyle"
                    >
                      <div
                        class="mx-auto h-4 w-4 rounded bg-gray-100 animate-pulse dark:bg-gray-800"
                        aria-hidden="true"
                      />
                    </td>
                    <td
                      v-for="(column, columnIndex) in displayColumns"
                      :key="`sk-${n}-${cellKey(column)}`"
                      :class="[
                        'table-body-cell px-5 align-middle',
                        rowHeightClass,
                        columnIndex === 0
                          ? 'title-column-cell sticky z-20 bg-white dark:bg-gray-900 sticky-column-border'
                          : 'bg-white dark:bg-gray-900'
                      ]"
                      :style="columnCellStyle(column)"
                    >
                      <div
                        class="h-4 max-w-full rounded bg-gray-100 animate-pulse dark:bg-gray-800"
                        :class="columnIndex === 0 ? 'w-[85%]' : 'w-[55%]'"
                        aria-hidden="true"
                      />
                    </td>
                    <td
                      v-if="hasFlexFillColumn"
                      aria-hidden="true"
                      :class="['table-body-cell table-flex-fill p-0 align-middle bg-white dark:bg-gray-900', rowHeightClass]"
                    />
                  </tr>
                </template>
              </template>
              <tr v-else>
                <td
                  :colspan="tableBodyColspan"
                  :class="showEmptyOverlay ? 'h-0 border-0 p-0' : 'px-5 py-10 text-center'"
                  aria-hidden="true"
                >
                  <span class="sr-only">{{ emptyTitle || t('common.listNoDataAvailable') }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- In-flow empty panel below header strip (do not absolute-position inside scrollport) -->
        <div
          v-if="showEmptyOverlay"
          class="flex w-full flex-col items-center justify-center px-6 py-16"
        >
          <div class="flex max-w-md flex-col items-center justify-center text-center">
            <img
              v-if="emptyIllustrationSrc"
              :src="emptyIllustrationSrc"
              :alt="emptyTitle || t('common.listNoDataAvailable')"
              class="mx-auto h-40 max-h-40 w-auto max-w-[16rem] object-contain"
            />
            <h3
              class="text-lg font-semibold text-gray-900 dark:text-white"
              :class="emptyIllustrationSrc ? 'mt-6' : ''"
            >
              {{ emptyTitle || t('common.listNoDataAvailable') }}
            </h3>
            <p class="mt-3 text-sm text-gray-600 dark:text-gray-400">
              {{ emptyMessage || t('common.listNoRecordsFound') }}
            </p>
            <div v-if="$slots['empty-actions']" class="mt-6">
              <slot name="empty-actions" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  shallowRef,
  watch
} from 'vue'
import {
  getListSession,
  LIST_SESSION_PAGES_READY_KEY,
  LIST_SESSION_RESTORE_KEY,
  LIST_SESSION_SCROLL_CONCEAL_KEY,
  patchListSession
} from '@/utils/listScrollSession'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import { ArrowsUpDownIcon, ChevronDownIcon, ChevronUpIcon, CheckIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/vue/20/solid'
import { formatRawValueForDisplay } from '@/utils/fieldDisplay'
import { normalizeListPagination } from '@/utils/normalizeListPagination'
import {
  applyColumnSortClick,
  applyExplicitColumnSort,
  MAX_LIST_SORTS,
  normalizeSortSpecs,
  orderForField,
  removeColumnSort,
  sortRankForField,
  type ListSortSpec
} from '@/utils/listMultiSort'
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue'
import ListColumnFilter from '@/components/common/ListColumnFilter.vue'
import HoverTooltip from '@/components/common/HoverTooltip.vue'
import { resolveColumnFilterConfig } from '@/platform/filters/columnFilterResolver'
import type { FilterConfig } from '@/platform/filters/filterResolver'

const COLUMN_LABEL_ROW_HEIGHT_PX = 46
const COLUMN_FILTER_ROW_HEIGHT_PX = 44

type ListPaginationInput = Record<string, unknown>

type ColumnObjectDef = {
  key?: string
  label?: string
  width?: number | string
  minWidth?: number | string
  maxWidth?: number | string
  sortable?: boolean
  sortKey?: string
  resizable?: boolean
  locked?: boolean
  dataType?: string
  filterType?: FilterConfig['filterType']
  options?: Array<{ value: string; label: string }>
  filterable?: boolean
}
type ColumnDef = ColumnObjectDef | string
type RowData = Record<string, unknown>

const DEFAULT_STICKY_OFFSET = 72
const DEFAULT_COLUMN_WIDTH = 200
type SortOrder = 'asc' | 'desc'
type SortState = SortOrder | null

type ColumnWidths = Record<string, number>

const parseWidthValue = (value?: number | string) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

const emit = defineEmits<{
  (e: 'row-click', row: RowData, event: MouseEvent): void
  (e: 'sort', payload: { key: string; order: SortState; sorts: ListSortSpec[] }): void
  (e: 'select', selectedRows: RowData[]): void
  (e: 'bulk-action', payload: { action: string; selectedRows: RowData[] }): void
  (e: 'load-more'): void
  (e: 'toggle-row', row: RowData): void
  (e: 'toggle-select-all-loaded'): void
  (e: 'filter-change', payload: { key: string; value: unknown; filterType?: string }): void
  (e: 'filter-opened', key: string): void
  (e: 'clear-column-filters'): void
}>()

const props = withDefaults(
  defineProps<{
    columns?: ColumnDef[]
    rows?: RowData[]
    data?: RowData[]
    rowKey?: string
    stickyOffset?: string | number
    internalScroll?: boolean
    maxBodyHeight?: string | number
    sortField?: string
    sortOrder?: SortOrder
    /** Multi-sort stack (primary first). When set, takes precedence over sortField/sortOrder. */
    sorts?: ListSortSpec[]
    tableId?: string
    resizableColumns?: boolean
    loading?: boolean
    rowHeight?: 'small' | 'medium' | 'large' | 'huge'
    resetWidths?: number
    selectable?: boolean
    massActions?: Array<{ label: string; icon?: string; action: string; variant?: string }>
    clearSelectionTrigger?: number
    hasActions?: boolean
    /** CSS length for first-column hover gutter (e.g. '7rem', '14rem') */
    rowActionsGutter?: string
    emptyTitle?: string
    emptyMessage?: string
    /** Optional illustration for in-table empty state */
    emptyIllustrationSrc?: string
    loadMoreEnabled?: boolean
    /** When set, hasMore is derived from normalized pagination (page/total vs currentPage/totalPages). */
    pagination?: ListPaginationInput | null
    /** Explicit override when pagination is not provided */
    hasMore?: boolean
    loadingMore?: boolean
    /** 'checkbox' = always show box; 'numbered-hover' = row index, swap to checkbox on hover (see styles) */
    selectionColumnVariant?: 'checkbox' | 'numbered-hover'
    /** 1-based row display: first row = rowNumberOffset + 1 (e.g. paged lists) */
    rowNumberOffset?: number
    /** Controlled selection from ListView (ID sets only — avoids copying row objects). */
    selectionMode?: 'none' | 'page' | 'all'
    selectedRowIds?: string[]
    excludedRowIds?: string[]
    /** Key for persisting scroll across tab switches (keep-alive). */
    scrollSessionKey?: string
    /** Inline column-header filters (list view desktop). */
    columnFiltersEnabled?: boolean
    filterConfigByKey?: Record<string, FilterConfig>
    columnFilters?: Record<string, unknown>
  }>(),
  {
    columns: () => [],
    rows: () => [],
    data: () => [],
    rowKey: 'id',
    stickyOffset: 'var(--table-sticky-offset, 64px)',
    internalScroll: false,
    maxBodyHeight: undefined,
    sortField: '',
    sortOrder: 'asc',
    sorts: () => [],
    tableId: '',
    resizableColumns: true,
    loading: false,
    rowHeight: 'small',
    selectable: false,
    massActions: () => [],
    clearSelectionTrigger: 0,
    hasActions: false,
    rowActionsGutter: '7rem',
    emptyIllustrationSrc: '',
    loadMoreEnabled: false,
    pagination: null,
    hasMore: false,
    loadingMore: false,
    selectionColumnVariant: 'numbered-hover',
    rowNumberOffset: 0,
    selectionMode: 'none',
    selectedRowIds: () => [],
    excludedRowIds: () => [],
    scrollSessionKey: '',
    columnFiltersEnabled: false,
    filterConfigByKey: () => ({}),
    columnFilters: () => ({})
  }
)

const pendingScrollRestore = ref<number | null>(null)
const sessionRestoreTick = inject(LIST_SESSION_RESTORE_KEY, ref(0))
const listSessionScrollConcealing = inject(LIST_SESSION_SCROLL_CONCEAL_KEY, ref(false))
const listSessionPagesReady = inject(LIST_SESSION_PAGES_READY_KEY, ref(true))
let scrollSaveTimer: ReturnType<typeof setTimeout> | null = null
let scrollRestoreRevealFrame = 0

const showScrollRestoreOverlay = computed(() => Boolean(listSessionScrollConcealing.value))

function resetScrollContainerTop() {
  const el = scrollContainerRef.value
  if (!el) return
  const previousBehavior = el.style.scrollBehavior
  el.style.scrollBehavior = 'auto'
  if (useVirtualScroll.value) {
    rowVirtualizer.value.scrollToOffset(0, { align: 'start', behavior: 'auto' })
  }
  el.scrollTop = 0
  el.style.scrollBehavior = previousBehavior
}

function clearScrollRestoreConceal() {
  if (listSessionScrollConcealing.value) {
    listSessionScrollConcealing.value = false
  }
}

const normalizedPagination = computed(() => {
  if (!props.pagination) return null
  return normalizeListPagination(props.pagination)
})

/** Supports API shapes { page, total } and { currentPage, totalPages } when pagination prop is set. */
const effectiveHasMore = computed(() => {
  if (!props.loadMoreEnabled) return false
  if (normalizedPagination.value) {
    return normalizedPagination.value.hasMore
  }
  return Boolean(props.hasMore)
})

const showEmptyOverlay = computed(() => {
  if (props.loading) return false
  // displayRows is the final rendered list (after sorting/paging); if it's empty,
  // render the overlay instead of relying on an in-table empty row (which scrolls).
  return Array.isArray(displayRows.value) && displayRows.value.length === 0
})

/** ≤639px: card-row list (title column only, no label chrome / H-scroll). */
const MOBILE_CARD_MQ = '(max-width: 639px)'
const isMobileCardLayout = ref(false)
let mobileCardMql: MediaQueryList | null = null

function syncMobileCardLayout() {
  isMobileCardLayout.value = Boolean(mobileCardMql?.matches)
  if (!isMobileCardLayout.value) {
    isMobileSelectMode.value = false
  }
}

/** Desktop selection gutter; mobile uses long-press + avatar checkbox instead. */
const showSelectionColumn = computed(
  () => Boolean(props.selectable) && !isMobileCardLayout.value
)

const isMobileSelectMode = ref(false)
const MOBILE_LONG_PRESS_MS = 450
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let longPressTriggered = false
let touchStartX = 0
let touchStartY = 0

function clearLongPressTimer() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function onRowTouchStart(
  item: { row: RowData; selected: boolean },
  event: TouchEvent
) {
  if (!isMobileCardLayout.value || !props.selectable) return
  longPressTriggered = false
  const touch = event.touches[0]
  if (!touch) return
  touchStartX = touch.clientX
  touchStartY = touch.clientY
  clearLongPressTimer()
  longPressTimer = setTimeout(() => {
    longPressTriggered = true
    isMobileSelectMode.value = true
    if (!item.selected) {
      toggleRowSelection(item.row)
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10)
    }
  }, MOBILE_LONG_PRESS_MS)
}

/** DevTools / trackpad fallback when touch events are not synthesized. */
function onRowMouseDown(
  item: { row: RowData; selected: boolean },
  event: MouseEvent
) {
  if (!isMobileCardLayout.value || !props.selectable) return
  if (event.button !== 0) return
  longPressTriggered = false
  touchStartX = event.clientX
  touchStartY = event.clientY
  clearLongPressTimer()
  longPressTimer = setTimeout(() => {
    longPressTriggered = true
    isMobileSelectMode.value = true
    if (!item.selected) {
      toggleRowSelection(item.row)
    }
  }, MOBILE_LONG_PRESS_MS)
}

function onRowTouchMove(event: TouchEvent) {
  if (!longPressTimer) return
  const touch = event.touches[0]
  if (!touch) return
  if (Math.abs(touch.clientX - touchStartX) > 10 || Math.abs(touch.clientY - touchStartY) > 10) {
    clearLongPressTimer()
  }
}

function onRowTouchEnd() {
  clearLongPressTimer()
}

function onRowContextMenu(event: MouseEvent) {
  if (isMobileCardLayout.value && props.selectable) {
    event.preventDefault()
  }
}

const scrollContainerClass = computed(() => {
  const maxBody = props.maxBodyHeight
  const fillsParent =
    props.internalScroll &&
    maxBody !== undefined &&
    maxBody !== null &&
    String(maxBody).trim().endsWith('%')

  if (showEmptyOverlay.value) {
    return {
      // Header-only strip; empty panel sibling claims remaining height.
      'shrink-0': true,
      'overflow-x-auto': !isMobileCardLayout.value,
      'overflow-x-hidden': isMobileCardLayout.value,
      'overflow-y-hidden': true
    }
  }

  return {
    'flex-1 min-h-0': fillsParent,
    'overflow-x-auto': !isMobileCardLayout.value,
    'overflow-x-hidden': isMobileCardLayout.value,
    'overflow-y-auto': props.internalScroll
  }
})

const storageKey = computed(() =>
  props.tableId ? `table-column-widths-${props.tableId}` : ''
)

const columnWidths = ref<ColumnWidths>({})
const isResizing = ref(false)
const activeResize = ref<{ key: string; startWidth: number; startEdgeX: number; column: ColumnDef } | null>(null)
const resizeGuideX = ref<number | null>(null)
const resizeGuideBounds = ref<{ top: number; bottom: number } | null>(null)
let saveTimeout: ReturnType<typeof setTimeout> | undefined
const tableRef = ref<HTMLTableElement | null>(null)
const scrollContainerRef = ref<HTMLDivElement | null>(null)
const labelHeaderRowRef = ref<HTMLTableRowElement | null>(null)
const filterHeaderRowRef = ref<HTMLTableRowElement | null>(null)
const measuredLabelHeaderHeightPx = ref(COLUMN_LABEL_ROW_HEIGHT_PX)
const measuredFilterHeaderHeightPx = ref(COLUMN_FILTER_ROW_HEIGHT_PX)
let headerRowsResizeObserver: ResizeObserver | null = null
const loadMoreSentinelRef = ref<HTMLDivElement | null>(null)
let loadMoreObserver: IntersectionObserver | null = null
let loadMoreScrollHandler: (() => void) | null = null
/** Prevents duplicate load-more while parent fetch is in flight */
const loadMoreEmitLocked = ref(false)
const LOAD_MORE_ROOT_MARGIN_PX = 160
const leftEdgeColumnIndex = ref<number | null>(null)
const rightEdgeColumnIndex = ref<number | null>(null)
const isScrolledHorizontally = ref(false)
const sampleColumns = computed<ColumnDef[]>(() => [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'name', label: t('common.columnName'), sortable: true },
  { key: 'email', label: t('common.columnEmail'), sortable: true },
  { key: 'status', label: t('common.status'), sortable: true }
])

const providedRows = computed<RowData[]>(() => {
  if (props.rows && props.rows.length > 0) {
    return props.rows
  }
  if (props.data && props.data.length > 0) {
    return props.data
  }
  return []
})

const displayColumns = computed((): ColumnDef[] => {
  const columns = Array.isArray(props.columns) ? props.columns : []
  // When tableId exists, never use sampleColumns - wait for real columns so we don't
  // overwrite persisted widths with placeholder keys (id, name, email, status)
  const base = columns.length > 0 ? columns : props.tableId ? [] : sampleColumns.value
  if (isMobileCardLayout.value && base.length > 0) {
    return base.slice(0, 1)
  }
  return base
})

const displayRows = computed(() => providedRows.value)

/** Full skeleton body: awaiting columns while parent loading, or parent loading with no rows yet. */
const isLoading = computed(() => {
  // Rows arrived before columns (reload race) — skeleton instead of row numbers in a full-width gutter.
  if (displayColumns.value.length === 0 && displayRows.value.length > 0) {
    return true
  }
  const awaitingColumns =
    Boolean(props.tableId) &&
    displayColumns.value.length === 0 &&
    Boolean(props.loading)
  if (awaitingColumns) return true
  // Keep showing cached rows during background refetch (e.g. tab return / soft reload).
  if (displayRows.value.length > 0) return false
  return Boolean(props.loading)
})

const showDataRows = computed(
  () =>
    displayRows.value.length > 0 &&
    displayColumns.value.length > 0 &&
    !isLoading.value
)

/** Fixed row heights (px) for virtual scroll — matches py-* + single-line cell */
const ROW_HEIGHT_PX = {
  small: 41,
  medium: 57,
  large: 73,
  huge: 89
} as const satisfies Record<string, number>

const DEFAULT_ROW_HEIGHT_PX = ROW_HEIGHT_PX.small

const VIRTUAL_SCROLL_ROW_THRESHOLD = 30

const rowHeightPx = computed((): number => {
  const h = ROW_HEIGHT_PX[props.rowHeight as keyof typeof ROW_HEIGHT_PX]
  const base = h ?? DEFAULT_ROW_HEIGHT_PX
  // Card rows (avatar + primary/secondary) need taller estimate for virtual scroll
  return isMobileCardLayout.value ? Math.max(base, 64) : base
})

const useVirtualScroll = computed(
  () =>
    props.internalScroll &&
    showDataRows.value &&
    displayRows.value.length >= VIRTUAL_SCROLL_ROW_THRESHOLD
)

const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: displayRows.value.length,
    getScrollElement: () => scrollContainerRef.value,
    estimateSize: () => rowHeightPx.value,
    overscan: 12
  }))
)

const virtualItems = computed(() =>
  useVirtualScroll.value ? rowVirtualizer.value.getVirtualItems() : []
)

const virtualPaddingTop = computed(() => {
  const items = virtualItems.value
  if (!useVirtualScroll.value || items.length === 0) return 0
  return items[0]?.start ?? 0
})

const virtualPaddingBottom = computed(() => {
  const items = virtualItems.value
  if (!useVirtualScroll.value || items.length === 0) return 0
  const total = rowVirtualizer.value.getTotalSize()
  const last = items[items.length - 1]
  if (!last) return 0
  return Math.max(0, total - last.end)
})

const tableMinWidth = computed(() => {
  if (isMobileCardLayout.value || displayColumns.value.length === 0) {
    return '100%'
  }

  // Table width = exact sum of column widths so only the resized column changes
  let total = showSelectionColumn.value ? 48 : 0
  displayColumns.value.forEach(column => {
    total += getColumnWidth(column)
  })

  return `${total}px`
})

/** Extra column so the table can stay width:100% while fixed-width cols stay left; slack lives here (full-width row dividers). */
const hasFlexFillColumn = computed(
  () => displayColumns.value.length > 0 && !isMobileCardLayout.value
)

const tableBodyColspan = computed(() => {
  let n = displayColumns.value.length
  if (showSelectionColumn.value) n += 1
  if (hasFlexFillColumn.value) n += 1
  return Math.max(1, n)
})

const columnKey = (column: ColumnDef) => {
  if (typeof column === 'string') return column
  return column.key ?? String(column.label ?? '')
}

const cellKey = (column: ColumnDef) => `${columnKey(column)}-cell`

const sortKeyForColumn = (column: ColumnDef) => {
  if (typeof column === 'string') return ''
  return column.sortKey ?? column.key ?? ''
}

const columnLabel = (column: ColumnDef) => {
  if (typeof column === 'string') return column
  return column.label ?? column.key ?? ''
}

const isColumnSortable = (column: ColumnDef) => {
  if (typeof column === 'string') return false
  if (column.sortable === false) return false
  return Boolean(sortKeyForColumn(column))
}

const isColumnFilterable = (column: ColumnDef) => {
  if (typeof column === 'string') return true
  return column.filterable !== false
}

// Title/frozen column: first in list or explicitly locked (by key so it works with merged column objects)
const isFirstColumn = (column: ColumnDef) => {
  const cols = displayColumns.value
  if (cols.length === 0) return false
  const first = cols[0]
  if (!first) return false
  if (typeof column === 'object' && column && (column as ColumnObjectDef).locked) return true
  return columnKey(first) === columnKey(column)
}

const FIRST_COLUMN_MIN = 380
const FIRST_COLUMN_MAX = 600
const DEFAULT_COLUMN_MIN = 200

const getColumnMinWidth = (column: ColumnDef) => {
  return isFirstColumn(column) ? FIRST_COLUMN_MIN : DEFAULT_COLUMN_MIN
}

const getColumnMaxWidth = (column: ColumnDef) => {
  if (isFirstColumn(column)) return FIRST_COLUMN_MAX
  if (typeof column === 'object' && column.maxWidth != null) {
    return parseWidthValue(column.maxWidth)
  }
  return undefined
}

const getColumnDefaultWidth = (column: ColumnDef) => {
  const configuredWidth =
    typeof column === 'string'
      ? undefined
      : parseWidthValue(column.width)
  const base = configuredWidth ?? DEFAULT_COLUMN_WIDTH
  return Math.max(base, getColumnMinWidth(column))
}

const getColumnWidth = (column: ColumnDef) => {
  const key = columnKey(column)
  const stored = columnWidths.value[key]
  let width = stored && stored > 0 ? stored : getColumnDefaultWidth(column)
  width = Math.max(width, getColumnMinWidth(column))
  const maxW = getColumnMaxWidth(column)
  return maxW !== undefined ? Math.min(width, maxW) : width
}

const columnColStyle = (column: ColumnDef) => {
  if (isMobileCardLayout.value) {
    return { width: 'auto', minWidth: '0' }
  }
  const width = getColumnWidth(column)
  const minWidth = getColumnMinWidth(column)
  const maxW = getColumnMaxWidth(column)
  const style: Record<string, string> = { width: `${width}px`, minWidth: `${minWidth}px` }
  if (maxW !== undefined) style.maxWidth = `${maxW}px`
  return style
}

const columnHeaderStyle = (column: ColumnDef) => {
  if (isMobileCardLayout.value) {
    return { width: 'auto', minWidth: '0' }
  }
  const width = getColumnWidth(column)
  const isFirstCol = isFirstColumn(column)
  const checkboxWidth = 48

  const style: Record<string, string> = {
    width: `${width}px`,
    minWidth: `${getColumnMinWidth(column)}px`
  }
  const maxW = getColumnMaxWidth(column)
  if (maxW !== undefined) style.maxWidth = `${maxW}px`
  // Intentionally no overflow:hidden on sticky header — it clips the sort dropdown (HeadlessUI Menu).

  // Make first data column sticky horizontally; z-index is set via th classes (label vs filter row).
  if (isFirstCol && props.selectable) {
    style.position = 'sticky'
    style.left = `${checkboxWidth}px`
  } else if (isFirstCol && !props.selectable) {
    style.position = 'sticky'
    style.left = '0px'
  }
  
  return style
}

const rowHeightClasses = {
  small: 'py-2',
  medium: 'py-4',
  large: 'py-6',
  huge: 'py-8'
}

const rowHeightClass = computed(() => {
  if (isMobileCardLayout.value) return 'py-3 min-h-[56px]'
  return rowHeightClasses[props.rowHeight] || rowHeightClasses.small
})

/** Skeleton rows while `isLoading` (no fake row indices; keeps first paint clean) */
const loadingSkeletonRowCount = 10

const columnCellStyle = (column: ColumnDef) => {
  if (isMobileCardLayout.value) {
    return { width: 'auto', minWidth: '0', overflow: 'hidden' }
  }
  const width = getColumnWidth(column)
  const isFirstCol = isFirstColumn(column)
  const checkboxWidth = 48

  const style: Record<string, string> = {
    width: `${width}px`,
    minWidth: `${getColumnMinWidth(column)}px`
  }
  const maxW = getColumnMaxWidth(column)
  if (maxW !== undefined) style.maxWidth = `${maxW}px`
  // Clip non-sticky cells; title column uses overflow:visible (CSS) so scroll shadow isn't clipped
  if (!isFirstCol) {
    style.overflow = 'hidden'
  }

  // Make first data column sticky horizontally
  // Cells use z-20 (set via class), so don't override z-index here
  // Border and shadow are handled via CSS class (sticky-column-border) for better visibility
  if (isFirstCol && props.selectable) {
    style.position = 'sticky'
    style.left = `${checkboxWidth}px`
    // z-index is set via class (z-20), don't override
  } else if (isFirstCol && !props.selectable) {
    style.position = 'sticky'
    style.left = '0px'
    // z-index is set via class (z-20), don't override
  }

  return style
}

const isColumnResizable = (column: ColumnDef) => {
  if (isMobileCardLayout.value) return false
  if (!props.resizableColumns) return false
  if (typeof column !== 'string' && column.resizable === false) return false
  return true
}

const queueSaveWidths = () => {
  if (!storageKey.value) return
  if (Object.keys(columnWidths.value).length === 0) return // Don't overwrite stored with empty
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(storageKey.value, JSON.stringify(columnWidths.value))
    } catch (error) {
      console.warn('Failed to save column widths', error)
    }
  }, 150)
}

const flushColumnWidths = () => {
  if (!storageKey.value) return
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = undefined
  }
  try {
    localStorage.setItem(storageKey.value, JSON.stringify(columnWidths.value))
  } catch (error) {
    console.warn('Failed to save column widths', error)
  }
}

const ensureColumnWidths = () => {
  const cols = displayColumns.value
  if (cols.length === 0) return // Preserve stored widths when columns load async
  const next: ColumnWidths = {}
  cols.forEach((column) => {
    const key = columnKey(column)
    const minW = getColumnMinWidth(column)
    const maxW = getColumnMaxWidth(column)
    const existing = columnWidths.value[key]
    let width = existing && existing > 0 ? existing : getColumnDefaultWidth(column)
    width = Math.max(width, minW)
    if (maxW !== undefined) width = Math.min(width, maxW)
    next[key] = width
  })
  columnWidths.value = next
}

const loadStoredWidths = () => {
  if (!storageKey.value) return
  const raw = localStorage.getItem(storageKey.value)
  if (!raw) return

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const sanitized: ColumnWidths = {}
      Object.entries(parsed as Record<string, number | string>).forEach(([key, value]) => {
        let width = parseWidthValue(value)
        if (width && width > 0) {
          const column = displayColumns.value.find((c) => columnKey(c) === key)
          if (column) {
            width = Math.max(width, getColumnMinWidth(column))
            const maxW = getColumnMaxWidth(column)
            if (maxW !== undefined) width = Math.min(width, maxW)
          }
          sanitized[key] = width
        }
      })
      columnWidths.value = { ...columnWidths.value, ...sanitized }
    }
  } catch (error) {
    console.warn('Failed to parse stored column widths', error)
  }
}

watch(displayColumns, () => {
  ensureColumnWidths()
}, { immediate: true })

watch(
  () => props.columns,
  () => {
    ensureColumnWidths()
  },
  { deep: true }
)

watch(columnWidths, () => {
  queueSaveWidths()
}, { deep: true })

// Watch for resetWidths prop to clear column widths
watch(() => props.resetWidths, (newVal) => {
  if (newVal && newVal > 0) {
    columnWidths.value = {}
    ensureColumnWidths()
  }
})

const updateEdgeColumns = () => {
  if (!scrollContainerRef.value || !tableRef.value) return
  
  const container = scrollContainerRef.value
  const containerRect = container.getBoundingClientRect()
  const containerLeft = containerRect.left
  const containerRight = containerRect.right
  
  // Find all header cells
  const headerCells = tableRef.value.querySelectorAll('thead th')
  let leftEdgeIdx: number | null = null
  let rightEdgeIdx: number | null = null
  
  headerCells.forEach((cell, index) => {
    const cellRect = cell.getBoundingClientRect()
    const cellLeft = cellRect.left
    const cellRight = cellRect.right
    
    // Check if cell is at or near the left edge (within 5px tolerance)
    if (cellLeft <= containerLeft + 5 && cellRight > containerLeft) {
      leftEdgeIdx = index
    }
    
    // Check if cell is at or near the right edge (within 5px tolerance)
    if (cellRight >= containerRight - 5 && cellLeft < containerRight) {
      rightEdgeIdx = index
    }
  })
  
  leftEdgeColumnIndex.value = leftEdgeIdx
  rightEdgeColumnIndex.value = rightEdgeIdx
}

const handleScroll = () => {
  updateEdgeColumns()
  if (scrollContainerRef.value) {
    isScrolledHorizontally.value = scrollContainerRef.value.scrollLeft > 0
  }
  scheduleScrollSessionSave()
  maybeEmitLoadMore()
}

const handleBeforeUnload = () => {
  flushColumnWidths()
}

onMounted(() => {
  loadStoredWidths()
  ensureColumnWidths()
  window.addEventListener('beforeunload', handleBeforeUnload)
  if (typeof window !== 'undefined') {
    mobileCardMql = window.matchMedia(MOBILE_CARD_MQ)
    syncMobileCardLayout()
    mobileCardMql.addEventListener('change', syncMobileCardLayout)
  }
  nextTick(() => {
    setupHeaderRowObserver()
    setupViewportFitHeight()
  })
  setTimeout(() => {
    updateEdgeColumns()
    syncHeaderRowHeights()
    queueViewportFitUpdate()
    if (scrollContainerRef.value) {
      isScrolledHorizontally.value = scrollContainerRef.value.scrollLeft > 0
    }
    if (useVirtualScroll.value) {
      rowVirtualizer.value.measure()
    }
  }, 100)
})

watch(
  () => props.columnFiltersEnabled,
  () => {
    nextTick(() => {
      setupHeaderRowObserver()
    })
  }
)

watch(
  () => displayColumns.value.length,
  () => {
    nextTick(() => syncHeaderRowHeights())
  }
)

watch(isMobileCardLayout, (mobile) => {
  nextTick(() => {
    if (mobile) {
      measuredLabelHeaderHeightPx.value = 0
      measuredFilterHeaderHeightPx.value = 0
    } else {
      syncHeaderRowHeights()
      setupHeaderRowObserver()
    }
    if (scrollContainerRef.value) {
      scrollContainerRef.value.scrollLeft = 0
      isScrolledHorizontally.value = false
    }
    if (useVirtualScroll.value) {
      rowVirtualizer.value.measure()
    }
  })
})

watch(
  () => displayRows.value.length,
  () => {
    if (useVirtualScroll.value) {
      nextTick(() => rowVirtualizer.value.measure())
    }
    if (listSessionPagesReady.value) {
      attemptScrollRestore()
    }
  }
)

function saveScrollSession() {
  if (!props.scrollSessionKey || !props.internalScroll) return
  const el = scrollContainerRef.value
  if (!el) return
  patchListSession(props.scrollSessionKey, { scrollTop: el.scrollTop })
}

function scheduleScrollSessionSave() {
  if (!props.scrollSessionKey || !props.internalScroll) return
  if (scrollSaveTimer) clearTimeout(scrollSaveTimer)
  scrollSaveTimer = setTimeout(() => {
    scrollSaveTimer = null
    saveScrollSession()
  }, 120)
}

function queueScrollRestoreFromSession() {
  if (!props.scrollSessionKey) return
  const session = getListSession(props.scrollSessionKey)
  const top = Number(session?.scrollTop)
  if (Number.isFinite(top) && top > 0) {
    pendingScrollRestore.value = top
  }
}

function applyScrollRestoreOffset(top: number): boolean {
  const el = scrollContainerRef.value
  if (!el) return false

  const previousBehavior = el.style.scrollBehavior
  el.style.scrollBehavior = 'auto'

  if (useVirtualScroll.value) {
    rowVirtualizer.value.scrollToOffset(top, { align: 'start', behavior: 'auto' })
  }
  el.scrollTop = top

  el.style.scrollBehavior = previousBehavior

  return Math.abs(el.scrollTop - top) <= 4
}

function revealScrollRestore(top: number) {
  const frame = ++scrollRestoreRevealFrame
  nextTick(() => {
    requestAnimationFrame(() => {
      if (frame !== scrollRestoreRevealFrame) return
      if (useVirtualScroll.value) {
        rowVirtualizer.value.measure?.()
      }
      if (!applyScrollRestoreOffset(top)) return
      requestAnimationFrame(() => {
        if (frame !== scrollRestoreRevealFrame) return
        if (!applyScrollRestoreOffset(top)) return
        pendingScrollRestore.value = null
        clearScrollRestoreConceal()
      })
    })
  })
}

function attemptScrollRestore() {
  const top = pendingScrollRestore.value
  if (top == null || !Number.isFinite(top)) return
  if (!listSessionPagesReady.value) return
  const el = scrollContainerRef.value
  if (!el || displayRows.value.length === 0 || isLoading.value) return

  revealScrollRestore(top)
}

watch(showScrollRestoreOverlay, (show) => {
  if (show) {
    resetScrollContainerTop()
  }
})

watch(sessionRestoreTick, () => {
  queueScrollRestoreFromSession()
  attemptScrollRestore()
})

onDeactivated(() => {
  saveScrollSession()
  teardownLoadMoreObserver()
  teardownHeaderRowObserver()
  teardownViewportFitHeight()
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateEdgeColumns)
  }
})

onActivated(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateEdgeColumns)
  }
  queueScrollRestoreFromSession()
  attemptScrollRestore()
  nextTick(() => {
    setupHeaderRowObserver()
    setupLoadMoreObserver()
    setupViewportFitHeight()
    queueViewportFitUpdate()
    if (useVirtualScroll.value) {
      rowVirtualizer.value.measure?.()
    }
  })
})

const activeSorts = computed((): ListSortSpec[] => {
  if (Array.isArray(props.sorts) && props.sorts.length > 0) {
    return normalizeSortSpecs(props.sorts)
  }
  if (props.sortField) {
    return normalizeSortSpecs([{ field: props.sortField, order: props.sortOrder ?? 'asc' }])
  }
  return []
})

const showSortRanks = computed(() => activeSorts.value.length > 1)

const isColumnSorted = (column: ColumnDef) => {
  if (!isColumnSortable(column)) return false
  const key = sortKeyForColumn(column)
  return Boolean(key && orderForField(activeSorts.value, key))
}

const sortIconTooltip = (column: ColumnDef): string => {
  if (activeSorts.value.length === 0) return ''
  if (isColumnSorted(column)) return ''
  if (activeSorts.value.length >= MAX_LIST_SORTS) return ''
  return t('common.tableMultiSortAddHint')
}

const columnSortOrder = (column: ColumnDef): SortOrder | null => {
  const key = sortKeyForColumn(column)
  return key ? orderForField(activeSorts.value, key) : null
}

const columnSortRank = (column: ColumnDef): number | null => {
  const key = sortKeyForColumn(column)
  return key ? sortRankForField(activeSorts.value, key) : null
}

const ariaSortForColumn = (column: ColumnDef) => {
  if (!isColumnSortable(column)) return 'none'
  const order = columnSortOrder(column)
  if (!order) return 'none'
  return order === 'asc' ? 'ascending' : 'descending'
}

const emitSorts = (sorts: ListSortSpec[]) => {
  const primary = sorts[0]
  emit('sort', {
    key: primary?.field ?? '',
    order: primary?.order ?? null,
    sorts
  })
}

const toggleSort = (column: ColumnDef, event?: MouseEvent) => {
  if (!isColumnSortable(column)) return
  const key = sortKeyForColumn(column)
  if (!key) return

  const next = applyColumnSortClick(activeSorts.value, key, {
    additive: Boolean(event?.shiftKey)
  })
  emitSorts(next)
}

/** Sort icon is mouse-first; avoid sticky focus so Shift later doesn't paint a focus ring. */
const onSortIconClick = (column: ColumnDef, event: MouseEvent) => {
  toggleSort(column, event)
  const target = event.currentTarget
  if (target instanceof HTMLElement) target.blur()
  const active = document.activeElement
  if (active instanceof HTMLElement && active !== document.body) {
    active.blur()
  }
}

const applyExplicitSort = (column: ColumnDef, order: SortOrder) => {
  if (!isColumnSortable(column)) return
  const key = sortKeyForColumn(column)
  if (!key) return
  emitSorts(applyExplicitColumnSort(activeSorts.value, key, order))
}

const clearSort = (column: ColumnDef) => {
  if (!isColumnSortable(column)) return
  const key = sortKeyForColumn(column)
  if (!key) return
  emitSorts(removeColumnSort(activeSorts.value, key))
}

const rowKey = computed(() => props.rowKey)

const rowIdentifier = (row: RowData, rowIndex: number): string => {
  const key = rowKey.value
  const value = key ? row?.[key] : undefined
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'symbol') {
    return String(value)
  }
  return String(rowIndex)
}

const parseOffsetToCss = (offset: string | number | undefined): string => {
  if (typeof offset === 'number' && !Number.isNaN(offset)) {
    return `${offset}px`
  }

  if (!offset) {
    return `${DEFAULT_STICKY_OFFSET}px`
  }

  if (typeof offset === 'string') {
    return offset
  }

  return `${DEFAULT_STICKY_OFFSET}px`
}

const stickyTop = computed(() => parseOffsetToCss(props.stickyOffset))
const headerTop = computed(() => (props.internalScroll ? '0px' : stickyTop.value))

const columnFilterRowTop = computed(() => {
  const base = props.internalScroll ? 0 : parseInt(stickyTop.value, 10) || 0
  return `${base + measuredLabelHeaderHeightPx.value}px`
})

function syncHeaderRowHeights() {
  const labelRow = labelHeaderRowRef.value
  if (labelRow) {
    const height = labelRow.getBoundingClientRect().height
    if (height > 0) measuredLabelHeaderHeightPx.value = height
  }
  const filterRow = filterHeaderRowRef.value
  if (filterRow) {
    const height = filterRow.getBoundingClientRect().height
    if (height > 0) measuredFilterHeaderHeightPx.value = height
  }
}

function setupHeaderRowObserver() {
  headerRowsResizeObserver?.disconnect()
  if (typeof ResizeObserver === 'undefined') return
  headerRowsResizeObserver = new ResizeObserver(() => syncHeaderRowHeights())
  if (labelHeaderRowRef.value) headerRowsResizeObserver.observe(labelHeaderRowRef.value)
  if (filterHeaderRowRef.value) headerRowsResizeObserver.observe(filterHeaderRowRef.value)
  syncHeaderRowHeights()
}

function teardownHeaderRowObserver() {
  headerRowsResizeObserver?.disconnect()
  headerRowsResizeObserver = null
}

const filterConfigForColumn = (column: ColumnDef): FilterConfig => {
  const key = columnKey(column)
  if (key && props.filterConfigByKey?.[key]) {
    return props.filterConfigByKey[key]
  }
  const colObj = typeof column === 'object' && column ? column : { key: String(column) }
  return resolveColumnFilterConfig({
    key: key || colObj.key || '',
    label: columnLabel(column),
    dataType: colObj.dataType,
    filterType: colObj.filterType,
    options: colObj.options,
  })
}

const filterValueForColumn = (column: ColumnDef): unknown => {
  const config = filterConfigForColumn(column)
  return props.columnFilters?.[config.key] ?? ''
}

const hasAnyColumnFilterActive = computed(() => {
  if (!props.columnFiltersEnabled || !props.columnFilters) return false
  return displayColumns.value.some((column) => isColumnFilterActive(column))
})

const isColumnFilterActive = (column: ColumnDef): boolean => {
  const value = filterValueForColumn(column)
  if (value === undefined || value === null || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0
  return true
}

/** Inline column filter applied — tint label + filter cells (same indigo as active sort). */
const isColumnFilterHighlighted = (column: ColumnDef): boolean =>
  Boolean(props.columnFiltersEnabled && isColumnFilterActive(column))

const isColumnHeaderHighlighted = (column: ColumnDef): boolean =>
  isColumnSorted(column) || isColumnFilterHighlighted(column)

const emitColumnFilterChange = (column: ColumnDef, value: unknown) => {
  const config = filterConfigForColumn(column)
  if (!config) return
  emit('filter-change', { key: config.key, value, filterType: config.filterType })
}

const emitColumnFilterOpened = (column: ColumnDef) => {
  const config = filterConfigForColumn(column)
  if (!config) return
  emit('filter-opened', config.key)
}

/** Keeps the selection column from stretching to full table width when data columns are not mounted yet */
const selectionColumnWidthPx = computed(() => '48px')

const selectionColumnCellStyle = computed(() => {
  const w = selectionColumnWidthPx.value
  return {
    width: w,
    minWidth: w,
    maxWidth: w,
    left: '0px'
  }
})

const selectionHeaderCellStyle = computed(() => ({
  top: headerTop.value,
  left: '0px',
  zIndex: '45',
  width: selectionColumnWidthPx.value,
  minWidth: selectionColumnWidthPx.value,
  maxWidth: selectionColumnWidthPx.value
}))

const selectionFilterCellStyle = computed(() => ({
  top: columnFilterRowTop.value,
  left: '0px',
  zIndex: '40',
  width: selectionColumnWidthPx.value,
  minWidth: selectionColumnWidthPx.value,
  maxWidth: selectionColumnWidthPx.value
}))

const enableInternalScroll = computed(() => props.internalScroll)

/** Percentage maxBodyHeight (e.g. 100%): fill parent flex height instead of viewport calc. */
const fillsParentHeight = computed(() => {
  if (!enableInternalScroll.value || props.maxBodyHeight === undefined || props.maxBodyHeight === null) {
    return false
  }
  return String(props.maxBodyHeight).trim().endsWith('%')
})

/**
 * When no explicit maxBodyHeight is set, fit the scrollport to the remaining
 * visible panel height under the table top (header / stats / filters / banners).
 * The 100vh − stickyOffset formula ignored list chrome and clipped last rows.
 */
const usesViewportFitHeight = computed(
  () =>
    enableInternalScroll.value &&
    !fillsParentHeight.value &&
    (props.maxBodyHeight === undefined || props.maxBodyHeight === null)
)

const MIN_VIEWPORT_FIT_BODY_PX = 160
const measuredMaxHeightPx = ref<number | null>(null)
let viewportFitRaf = 0
let viewportFitResizeObserver: ResizeObserver | null = null
let viewportFitListenersAttached = false

/**
 * Stable bottom edge. Never use content child's bottom — height of list content
 * depends on this measure, which shrinks on every reflow if content-bottom is used.
 */
function getViewportFitBottomBoundary(scrollEl: HTMLElement): number {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  const visualBottom = vv
    ? vv.offsetTop + vv.height
    : window.innerHeight

  const root = scrollEl.closest('[data-platform-scroll-root]')
  if (!(root instanceof HTMLElement)) {
    return visualBottom
  }

  const rootBottom = root.getBoundingClientRect().bottom
  let padBottom = 0
  const shellContent = root.firstElementChild
  if (shellContent instanceof HTMLElement) {
    padBottom = parseFloat(window.getComputedStyle(shellContent).paddingBottom) || 0
  }
  return Math.min(visualBottom, rootBottom) - padBottom
}

function updateViewportFittedMaxHeight() {
  if (!usesViewportFitHeight.value) {
    measuredMaxHeightPx.value = null
    return
  }
  const el = scrollContainerRef.value
  if (!el) return

  const top = el.getBoundingClientRect().top
  const bottom = getViewportFitBottomBoundary(el)
  const next = Math.max(
    MIN_VIEWPORT_FIT_BODY_PX,
    Math.floor(bottom - top)
  )
  if (measuredMaxHeightPx.value !== next) {
    measuredMaxHeightPx.value = next
  }
}

function queueViewportFitUpdate() {
  if (typeof window === 'undefined') return
  if (viewportFitRaf) return
  viewportFitRaf = window.requestAnimationFrame(() => {
    viewportFitRaf = 0
    updateViewportFittedMaxHeight()
  })
}

function teardownViewportFitHeight() {
  viewportFitResizeObserver?.disconnect()
  viewportFitResizeObserver = null
  if (viewportFitListenersAttached && typeof window !== 'undefined') {
    window.removeEventListener('resize', queueViewportFitUpdate)
    window.removeEventListener('scroll', queueViewportFitUpdate, true)
    window.visualViewport?.removeEventListener('resize', queueViewportFitUpdate)
    window.visualViewport?.removeEventListener('scroll', queueViewportFitUpdate)
    viewportFitListenersAttached = false
  }
  if (viewportFitRaf && typeof window !== 'undefined') {
    window.cancelAnimationFrame(viewportFitRaf)
    viewportFitRaf = 0
  }
}

function setupViewportFitHeight() {
  teardownViewportFitHeight()
  if (!usesViewportFitHeight.value || typeof window === 'undefined') return

  updateViewportFittedMaxHeight()

  if (typeof ResizeObserver !== 'undefined' && scrollContainerRef.value) {
    viewportFitResizeObserver = new ResizeObserver(() => queueViewportFitUpdate())
    // Ancestor size changes (stats collapse, banners, chrome) shift table top.
    // Do not observe the scroll container itself — maxHeight updates would thrash.
    let node: HTMLElement | null = scrollContainerRef.value.parentElement
    let depth = 0
    while (node && depth < 12) {
      viewportFitResizeObserver.observe(node)
      if (node.hasAttribute('data-platform-scroll-root')) break
      node = node.parentElement
      depth += 1
    }
  }

  window.addEventListener('resize', queueViewportFitUpdate, { passive: true })
  // Page scroll and nested scroll roots move getBoundingClientRect().top.
  window.addEventListener('scroll', queueViewportFitUpdate, { passive: true, capture: true })
  window.visualViewport?.addEventListener('resize', queueViewportFitUpdate)
  window.visualViewport?.addEventListener('scroll', queueViewportFitUpdate)
  viewportFitListenersAttached = true
}

watch(
  [usesViewportFitHeight, scrollContainerRef, () => props.internalScroll, showEmptyOverlay],
  () => {
    nextTick(() => setupViewportFitHeight())
  },
  { flush: 'post' }
)

const maxHeightStyle = computed(() => {
  if (!enableInternalScroll.value) {
    return undefined
  }

  if (props.maxBodyHeight !== undefined && props.maxBodyHeight !== null) {
    if (typeof props.maxBodyHeight === 'number') {
      return `${props.maxBodyHeight}px`
    }
    return props.maxBodyHeight
  }

  if (measuredMaxHeightPx.value != null) {
    return `${measuredMaxHeightPx.value}px`
  }

  // First paint / SSR fallback until measured.
  return `calc(100vh - ${stickyTop.value})`
})

const scrollContainerStyles = computed(() => {
  const styles: Record<string, string | undefined> = {}

  if (!enableInternalScroll.value || showEmptyOverlay.value) {
    return styles
  }

  if (fillsParentHeight.value) {
    styles.height = '100%'
    styles.maxHeight = '100%'
  } else if (typeof props.maxBodyHeight === 'number') {
    const h = `${props.maxBodyHeight}px`
    styles.height = h
    styles.maxHeight = h
  } else {
    styles.maxHeight = maxHeightStyle.value
  }
  styles.overflowY = 'auto'

  return styles
})

const teardownLoadMoreObserver = () => {
  if (loadMoreObserver) {
    loadMoreObserver.disconnect()
    loadMoreObserver = null
  }
  if (loadMoreScrollHandler) {
    window.removeEventListener('scroll', loadMoreScrollHandler, true)
    loadMoreScrollHandler = null
  }
}

/** True when sentinel is near the viewport or the table's internal scroll root (nested page scroll). */
const isLoadMoreSentinelNear = (): boolean => {
  const target = loadMoreSentinelRef.value
  if (!target) return false

  const margin = LOAD_MORE_ROOT_MARGIN_PX
  const rect = target.getBoundingClientRect()
  const inViewport = rect.top <= window.innerHeight + margin && rect.bottom >= -margin

  const root = scrollContainerRef.value
  if (props.internalScroll && root) {
    const rootRect = root.getBoundingClientRect()
    const inScrollRoot =
      rect.top <= rootRect.bottom + margin && rect.bottom >= rootRect.top - margin
    return inViewport || inScrollRoot
  }

  return inViewport
}

const maybeEmitLoadMore = () => {
  if (
    !props.loadMoreEnabled ||
    !effectiveHasMore.value ||
    props.loadingMore ||
    loadMoreEmitLocked.value
  ) {
    return
  }
  if (!isLoadMoreSentinelNear()) return

  loadMoreEmitLocked.value = true
  emit('load-more')
}

const setupLoadMoreObserver = () => {
  teardownLoadMoreObserver()
  if (!props.loadMoreEnabled || !effectiveHasMore.value) return

  const target = loadMoreSentinelRef.value
  if (!target) return

  // Viewport root: page scroll (PlatformShell) and table-internal scroll both move the sentinel
  // relative to the window; using only scrollContainerRef as root misses parent scroll.
  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        maybeEmitLoadMore()
      }
    },
    { root: null, rootMargin: `${LOAD_MORE_ROOT_MARGIN_PX}px`, threshold: 0 }
  )
  loadMoreObserver.observe(target)

  if (!loadMoreScrollHandler) {
    loadMoreScrollHandler = () => maybeEmitLoadMore()
    window.addEventListener('scroll', loadMoreScrollHandler, { passive: true, capture: true })
  }

  nextTick(() => maybeEmitLoadMore())
}

watch(
  [
    () => props.loadMoreEnabled,
    () => effectiveHasMore.value,
    () => props.pagination,
    () => props.loadingMore,
    () => displayRows.value.length,
    () => enableInternalScroll.value,
    () => scrollContainerRef.value
  ],
  () => {
    nextTick(() => {
      setupLoadMoreObserver()
    })
  },
  { flush: 'post' }
)

watch(
  () => props.loadingMore,
  (loading) => {
    if (!loading) {
      loadMoreEmitLocked.value = false
      nextTick(() => maybeEmitLoadMore())
    }
  }
)

let scrollBoundsHandler: (() => void) | null = null

const cleanupResizeListeners = () => {
  window.removeEventListener('mousemove', handleColumnResize)
  window.removeEventListener('mouseup', stopColumnResize)
  if (scrollBoundsHandler) {
    window.removeEventListener('scroll', scrollBoundsHandler, true)
    scrollContainerRef.value?.removeEventListener('scroll', scrollBoundsHandler)
    scrollBoundsHandler = null
  }
  document.body.style.cursor = ''
  document.body.style.removeProperty('user-select')
  resizeGuideX.value = null
  resizeGuideBounds.value = null
}

const updateResizeGuideBounds = () => {
  const container = scrollContainerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  resizeGuideBounds.value = { top: rect.top, bottom: rect.bottom }
}

/** Get the header cell for a column by key (for guide positioning). */
const getThForColumn = (key: string): HTMLElement | null => {
  const table = tableRef.value
  if (!table) return null
  const colIndex = displayColumns.value.findIndex((c) => columnKey(c) === key)
  if (colIndex < 0) return null
  const thIndex = (props.selectable ? 1 : 0) + colIndex
  const ths = table.querySelectorAll('thead tr th')
  return (ths[thIndex] as HTMLElement) ?? null
}

const handleColumnResize = (event: MouseEvent) => {
  event.preventDefault()
  const state = activeResize.value
  if (!state) return

  const delta = event.clientX - state.startEdgeX
  // Skip update until user has actually moved (prevents jump on click)
  if (Math.abs(delta) < 1) {
    const th = getThForColumn(state.key)
    if (th) {
      resizeGuideX.value = th.getBoundingClientRect().right
      updateResizeGuideBounds()
    }
    return
  }

  const minWidth = getColumnMinWidth(state.column)
  const maxWidth = getColumnMaxWidth(state.column)
  let nextWidth = Math.max(minWidth, Math.round(state.startWidth + delta))
  if (maxWidth !== undefined) nextWidth = Math.min(nextWidth, maxWidth)

  columnWidths.value = {
    ...columnWidths.value,
    [state.key]: nextWidth
  }

  // Guide at actual rendered right edge (nextTick = after Vue updates DOM)
  nextTick(() => {
    const th = getThForColumn(state.key)
    if (th) {
      resizeGuideX.value = th.getBoundingClientRect().right
      updateResizeGuideBounds()
    }
  })
}

const stopColumnResize = () => {
  if (activeResize.value) {
    activeResize.value = null
    isResizing.value = false
    queueSaveWidths()
  }
  cleanupResizeListeners()
}

const startColumnResize = (column: ColumnDef, event: MouseEvent) => {
  if (!isColumnResizable(column)) return

  const key = columnKey(column)
  const th = (event.currentTarget as HTMLElement)?.closest('th') as HTMLElement | null
  if (!th) return

  const rect = th.getBoundingClientRect()
  const startWidth = getColumnWidth(column)
  const startEdgeX = rect.right

  activeResize.value = {
    key,
    startWidth,
    startEdgeX,
    column
  }

  isResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  // Initial guide at actual rendered right edge (viewport X for fixed positioning)
  resizeGuideX.value = th.getBoundingClientRect().right
  updateResizeGuideBounds()

  scrollBoundsHandler = () => {
    if (activeResize.value) updateResizeGuideBounds()
  }
  window.addEventListener('mousemove', handleColumnResize)
  window.addEventListener('mouseup', stopColumnResize)
  window.addEventListener('scroll', scrollBoundsHandler, true)
  scrollContainerRef.value?.addEventListener('scroll', scrollBoundsHandler)
}

onBeforeUnmount(() => {
  clearLongPressTimer()
  if (scrollSaveTimer) clearTimeout(scrollSaveTimer)
  saveScrollSession()
  teardownLoadMoreObserver()
  teardownHeaderRowObserver()
  teardownViewportFitHeight()
  stopColumnResize()
  flushColumnWidths()
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.removeEventListener('resize', updateEdgeColumns)
  mobileCardMql?.removeEventListener('change', syncMobileCardLayout)
  mobileCardMql = null
})

const resolveValue = (row: RowData, column: ColumnDef) => {
  const key = typeof column === 'string' ? column : column.key
  if (!key) return ''
  const raw = row?.[key]
  if (raw === null || raw === undefined || raw === '') return ''
  const col = typeof column === 'object' ? column : null
  return formatRawValueForDisplay(raw, col ?? undefined)
}

const onSelectionCellClick = (row: RowData, event: MouseEvent) => {
  if ((event.target as HTMLElement)?.closest('[data-headless-checkbox="true"]')) {
    return
  }
  toggleRowSelection(row)
}

const onSelectionHeaderClick = (event: MouseEvent) => {
  if ((event.target as HTMLElement)?.closest('[data-headless-checkbox="true"]')) {
    return
  }
  toggleSelectAll()
}

const handleRowClick = (row: RowData, event: MouseEvent) => {
  if ((event.target as HTMLElement)?.closest('.table-selection-cell, [data-headless-checkbox="true"]')) {
    return
  }
  if (longPressTriggered) {
    longPressTriggered = false
    return
  }
  if (isMobileCardLayout.value && isMobileSelectMode.value && props.selectable) {
    toggleRowSelection(row)
    return
  }
  emit('row-click', row, event)
}

const selectedIdSet = shallowRef(new Set<string>())
const excludedIdSet = shallowRef(new Set<string>())

watch(
  () => [props.selectionMode, props.selectedRowIds, props.excludedRowIds] as const,
  () => {
    selectedIdSet.value = new Set((props.selectedRowIds ?? []).map(String))
    excludedIdSet.value = new Set((props.excludedRowIds ?? []).map(String))
  },
  { immediate: true }
)

const isRowIdSelected = (rowId: string): boolean => {
  if (!rowId) return false
  if (props.selectionMode === 'all') {
    return !excludedIdSet.value.has(rowId)
  }
  return selectedIdSet.value.has(rowId)
}

const hasAnySelection = computed(
  () =>
    props.selectionMode === 'all' ||
    selectedIdSet.value.size > 0
)

const loadedRowCount = computed(() => displayRows.value.length)

/** O(1) header checkbox — avoids scanning every row on each selection change */
const allSelected = computed(() => {
  const n = loadedRowCount.value
  if (n === 0) return false
  if (props.selectionMode === 'all') {
    return excludedIdSet.value.size === 0
  }
  if (props.selectionMode === 'page') {
    return selectedIdSet.value.size >= n
  }
  return false
})

const someSelected = computed(() => hasAnySelection.value && !allSelected.value)

type RenderedRow = {
  row: RowData
  rowIndex: number
  key: string
  selected: boolean
}

const renderedRows = computed((): RenderedRow[] => {
  const rows = displayRows.value
  if (rows.length === 0) return []

  const build = (row: RowData, rowIndex: number): RenderedRow => {
    const id = rowIdentifier(row, rowIndex)
    return {
      row,
      rowIndex,
      key: id || `row-${rowIndex}`,
      selected: isRowIdSelected(id)
    }
  }

  if (!useVirtualScroll.value) {
    return rows.map((row, rowIndex) => build(row, rowIndex))
  }

  const virtual = virtualItems.value
  if (virtual.length > 0) {
    return virtual.flatMap((vi) => {
      const row = rows[vi.index]
      if (!row) return []
      return [build(row, vi.index)]
    })
  }

  // After keep-alive, scroll root may have zero height until layout — avoid an empty tbody.
  return rows.map((row, rowIndex) => build(row, rowIndex))
})

const toggleRowSelection = (row: RowData) => {
  emit('toggle-row', row)
}

const toggleSelectAll = () => {
  emit('toggle-select-all-loaded')
}

watch(
  () => props.clearSelectionTrigger,
  (newVal) => {
    if (newVal > 0 && hasAnySelection.value) {
      emit('select', [])
    }
  }
)

watch(hasAnySelection, (has) => {
  if (!has && isMobileSelectMode.value) {
    isMobileSelectMode.value = false
  }
})
</script>

<style scoped>
/* Make vertical scrollbar transparent while keeping horizontal scrollbar visible */
.table-scroll-container {
  /* Firefox - thin scrollbar for horizontal */
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
}

/* WebKit scrollbar styling */
.table-scroll-container::-webkit-scrollbar {
  height: 8px; /* Horizontal scrollbar height - visible */
  width: 0px; /* Hide vertical scrollbar completely */
}

.table-scroll-container::-webkit-scrollbar-track {
  background: transparent;
}

/* Horizontal scrollbar thumb - visible */
.table-scroll-container::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 4px;
}

.table-scroll-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

/* Dark mode scrollbar */
:global(.dark) .table-scroll-container {
  scrollbar-color: rgba(75, 85, 99, 0.5) transparent;
}

:global(.dark) .table-scroll-container::-webkit-scrollbar-thumb {
  background-color: rgba(75, 85, 99, 0.5);
}

:global(.dark) .table-scroll-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(75, 85, 99, 0.7);
}

/* Ensure header rounded corners are visible - applied dynamically via classes */
.table-scroll-container thead th.rounded-tl-xl {
  border-top-left-radius: 0.75rem;
}

.table-scroll-container thead th.rounded-tr-xl {
  border-top-right-radius: 0.75rem;
}

/* Unified thead grid — solid borders that stay crisp on sticky cells while scrolling */
.table-grid {
  border-collapse: separate;
  border-spacing: 0;
}

.table-scroll-container thead th.table-head-cell {
  box-sizing: border-box;
  border-bottom: 1px solid var(--tv-grid-border);
  background-clip: padding-box;
}

/* Vertical dividers only after the sticky title column — row lines carry the rest */
.table-scroll-container thead th.sticky-column-border {
  border-right: 1px solid var(--tv-grid-border);
}

/* Inline filter dropdowns extend below the filter row — keep visible above the empty overlay */
.table-scroll-container thead tr.column-filter-row th.table-filter-cell {
  overflow: visible;
}

/* Filtered column — continuous highlight across label + filter header rows */
.table-scroll-container thead tr:not(.column-filter-row) th.table-column-filter-active {
  border-bottom-color: rgb(224 231 255); /* indigo-100 */
}

.dark .table-scroll-container thead tr:not(.column-filter-row) th.table-column-filter-active {
  border-bottom-color: rgb(49 46 129); /* indigo-900 opaque */
}

.table-scroll-container thead tr.column-filter-row th.table-column-filter-active {
  border-top: none;
}

/* Label header row — sort menu must stack above the filter row below */
.table-scroll-container thead tr:not(.column-filter-row) th.table-head-cell {
  overflow: visible;
  border-bottom: 1px solid var(--tv-grid-border);
}

/* Body grid — vertical + horizontal dividers matching thead */
.table-scroll-container tbody td.table-body-cell {
  box-sizing: border-box;
  background-clip: padding-box;
  border-bottom: 1px solid var(--tv-grid-border);
}

.table-scroll-container tbody td.sticky-column-border {
  border-right: 1px solid var(--tv-grid-border);
}

/* Sticky title column — scroll shadow is separate from the cell edge border */
.table-scroll-container thead th.sticky-column-border,
.table-scroll-container tbody td.sticky-column-border {
  overflow: visible;
}

.table-scroll-container thead th.sticky-column-scrolled::before,
.table-scroll-container tbody td.sticky-column-scrolled::before {
  content: '';
  position: absolute;
  top: 0;
  right: -10px;
  bottom: 0;
  width: 10px;
  pointer-events: none;
  z-index: 28;
  background: linear-gradient(to right, rgba(0, 0, 0, 0.06), transparent);
}

:global(.dark) .table-scroll-container thead th.sticky-column-scrolled::before,
:global(.dark) .table-scroll-container tbody td.sticky-column-scrolled::before {
  background: linear-gradient(to right, rgba(0, 0, 0, 0.45), transparent);
  box-shadow: 2px 0 6px -1px rgba(0, 0, 0, 0.55);
}

/* Title (first) column body cells only — thead uses the same .title-column-cell class for the
   sticky name column; applying overflow:hidden to th > div clipped the sort menu (HeadlessUI Menu). */
.table-scroll-container tbody td.title-column-cell > div {
  min-width: 0;
  overflow: hidden;
}
.table-scroll-container tbody td.title-column-cell .flex {
  min-width: 0;
}
/* Truncate the text part of title cell (e.g. flex with checkbox + span) */
.table-scroll-container tbody td.title-column-cell .flex > *:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
/* When title cell has no .flex (plain slot), truncate direct content */
.table-scroll-container tbody td.title-column-cell > div:not(.flex) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Mobile card list: structure only — surfaces via Tailwind (bg-white dark:bg-gray-800) */
.table-scroll-container.table-mobile-card tbody td.title-column-cell .flex > *:last-child,
.table-scroll-container.table-mobile-card tbody td.title-column-cell > div:not(.flex) {
  overflow: hidden;
  text-overflow: unset;
  white-space: normal;
}

.table-scroll-container.table-mobile-card {
  /* Match ListView search row width (no extra horizontal inset); pb keeps last card radius/border visible */
  padding: 0 0 20px;
  background: transparent;
  border-radius: 0;
  box-sizing: border-box;
  scrollbar-width: none; /* avoid right-side gutter shifting card width vs search */
}

.table-scroll-container.table-mobile-card::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.table-scroll-container.table-mobile-card .table-grid {
  border-collapse: separate;
  border-spacing: 0 10px;
  width: 100%;
}

.table-scroll-container.table-mobile-card tbody td.table-body-cell {
  /* Keep bottom edge; color from Tailwind / main.css (not `--tv-grid-border`) */
  border-bottom-style: solid;
  border-bottom-width: 1px;
}

.table-scroll-container.table-mobile-card tbody td.title-column-cell {
  padding-left: 0.75rem;
  padding-right: 1rem;
  background-clip: padding-box;
}

/* Selection column: row numbers ↔ checkbox (Notion-style); fine pointer uses hover/focus */
@media (hover: hover) and (pointer: fine) {
  .table-scroll-container tbody tr.group .tv-num-when-hover .tv-row-index:not(.opacity-0) {
    opacity: 1;
  }
  .table-scroll-container tbody tr.group:hover .tv-num-when-hover .tv-row-index,
  .table-scroll-container tbody tr.group:focus-within .tv-num-when-hover .tv-row-index {
    opacity: 0 !important;
  }
  .table-scroll-container tbody tr.group .tv-num-when-hover .tv-row-checkbox:not(.tv-row-checkbox--visible) {
    opacity: 0;
  }
  .table-scroll-container tbody tr.group:hover .tv-num-when-hover .tv-row-checkbox,
  .table-scroll-container tbody tr.group:focus-within .tv-num-when-hover .tv-row-checkbox,
  .table-scroll-container tbody tr.group .tv-num-when-hover .tv-row-checkbox--visible {
    opacity: 1 !important;
  }
}

@media (hover: none), (pointer: coarse) {
  .table-scroll-container tbody tr.group .tv-num-when-hover .tv-row-index {
    display: none !important;
  }
  .table-scroll-container tbody tr.group .tv-num-when-hover .tv-row-checkbox {
    opacity: 1 !important;
  }
}

</style>

