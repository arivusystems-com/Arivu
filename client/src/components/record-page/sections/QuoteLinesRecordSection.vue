<template>
  <section
    v-if="record?._id || draftMode"
    :class="[
      'quote-lines-workspace',
      { 'quote-lines-workspace--expanded': isLinesExpanded },
      isLinesExpanded ? 'flex flex-col flex-1 min-h-0 h-full overflow-hidden' : ''
    ]"
  >
    <p
      v-if="totalsStaleHint"
      class="mb-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2"
    >
      {{ t('records.linesTotalsStaleHint') }}
      <button
        v-if="caps.recalculate"
        type="button"
        class="ml-1 underline font-medium"
        :disabled="busy"
        @click="recalculate"
      >
        {{ t('records.linesRecalculate') }}
      </button>
    </p>

    <!-- Lines workspace -->
    <div
      ref="workspacePanelRef"
      :class="[
        'quote-lines-workspace__panel relative flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden',
        isLinesExpanded ? 'flex-1 min-h-0 h-full' : 'max-h-[min(75vh,820px)] min-h-[16rem]'
      ]"
    >
      <div
        v-if="busy"
        class="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-gray-900/60 backdrop-blur-[1px]"
      >
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
      <div class="quote-lines-workspace__toolbar flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-800/50">
        <div class="flex flex-wrap items-center gap-2 min-w-0">
          <button
            v-if="linesEditable && hasSections"
            type="button"
            class="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="busy"
            @click="openCreateSection"
          >
            {{ t('records.quoteSectionAdd') }}
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2 shrink-0 ml-auto">
          <QuoteLinesColumnOptions v-if="caps.columnPrefs" />
          <QuoteLinesHeaderActions v-if="caps.headerActions" :record="record" :context="context" />
        </div>
      </div>
      <div
        v-if="isReorderDragging && canCrossSectionDrag"
        class="px-3 py-1.5 text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/40"
      >
        {{ t('records.linesDragAcrossSectionsHint') }}
      </div>
      <div class="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        <div
          v-for="block in displaySectionBlocks"
          :key="block.key"
          :class="[
            'quote-section-block rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-clip shadow-sm transition-colors',
            sectionBlockDropClass(block)
          ]"
        >
          <div
            v-if="block.section"
            :class="[
              'quote-section-header sticky top-0 z-[5] flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-200 dark:border-gray-600 bg-gray-100/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-t-lg transition-colors',
              sectionHeaderDropClass(block)
            ]"
          >
            <div class="flex items-center gap-2 min-w-0">
              <div
                v-if="canReorderSections && !block.isOrphan"
                class="inline-flex flex-col shrink-0"
              >
                <button
                  type="button"
                  class="inline-flex items-center justify-center p-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/80 dark:hover:bg-gray-700/80 disabled:opacity-30"
                  :disabled="busy || isFirstMovableSection(block)"
                  :title="t('records.quoteSectionMoveUp')"
                  :aria-label="t('records.quoteSectionMoveUp')"
                  @click="moveSectionByDelta(block, -1)"
                >
                  <ChevronUpIcon class="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  class="inline-flex items-center justify-center p-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/80 dark:hover:bg-gray-700/80 disabled:opacity-30"
                  :disabled="busy || isLastMovableSection(block)"
                  :title="t('records.quoteSectionMoveDown')"
                  :aria-label="t('records.quoteSectionMoveDown')"
                  @click="moveSectionByDelta(block, 1)"
                >
                  <ChevronDownIcon class="h-3.5 w-3.5" />
                </button>
              </div>
              <h4 class="text-xs font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100 truncate">
                {{ block.section.sectionTitle }}
              </h4>
              <span
                v-if="caps.optionalSections && sectionTypeBadgeKey(block.section.sectionType) === 'optional'"
                class="shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
              >
                {{ t('records.quoteSectionBadgeOptional') }}
              </span>
              <span
                v-else-if="caps.optionalSections && sectionTypeBadgeKey(block.section.sectionType) === 'future'"
                class="shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {{ t('records.quoteSectionBadgeFuture') }}
              </span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span
                v-if="block.section.showSectionTotal !== false"
                class="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100"
              >
                {{ formatMoney(block.section.sectionTotal) }}
              </span>
              <button
                v-if="linesEditable && !block.isOrphan"
                type="button"
                class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                :disabled="busy"
                @click="openEditSection(block.section)"
              >
                {{ t('actions.edit') }}
              </button>
              <button
                v-if="linesEditable && !block.isOrphan && !block.rows.length"
                type="button"
                class="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                :disabled="busy"
                @click="deleteSection(block.section)"
              >
                {{ t('actions.delete') }}
              </button>
            </div>
          </div>

          <div
            v-if="block.section?.sectionType === 'optional' && linesEditable && caps.optionalSections && !block.isOrphan"
            class="sticky top-[2.625rem] z-[4] px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm"
          >
            <label class="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                class="rounded"
                :checked="block.section[linesAdapter.includeInTotalField] === true"
                :disabled="busy"
                @change="toggleSectionInclude(block.section, $event.target.checked)"
              />
              {{ t('records.quoteSectionIncludeInTotal') }}
            </label>
          </div>

          <div
            class="quote-lines-table-scroll"
            :class="[
              stickyColumnsActive ? 'overflow-x-auto' : 'overflow-x-hidden',
              { 'quote-lines-table--dragging': isReorderDragging }
            ]"
            @scroll="onQuoteLinesTableScroll"
          >
        <table
          class="min-w-full text-sm quote-lines-table"
          :class="{
            'quote-lines-table--sticky': stickyColumnsActive,
            'quote-lines-table--sticky-editable': stickyColumnsActive && linesEditable,
            'quote-lines-table--sticky-pricing': stickyColumnsActive && showPricingColumns
          }"
        >
          <thead class="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th :class="[lineTableHeadClass, stickyColClass('name'), 'quote-lines-col-name']">{{ t('records.linesName') }}</th>
              <th v-if="showSkuColumn" :class="[lineTableHeadClass, 'quote-lines-col-sku']">{{ t('records.linesSku') }}</th>
              <th v-if="showPricingColumns" :class="[lineTableHeadClass, 'quote-lines-col-scroll']">{{ t('records.linesPriceBook') }}</th>
              <th v-if="showPricingColumns" :class="[lineTableHeadClass, 'quote-lines-col-scroll']">{{ t('records.linesPriceSource') }}</th>
              <th :class="[lineTableHeadClass, 'quote-lines-col-qty text-right']">{{ t('records.linesQty') }}</th>
              <th :class="[lineTableHeadClass, 'quote-lines-col-unit-price text-right']">{{ t('records.linesUnitPrice') }}</th>
              <th v-if="linesEditable && showDiscountColumn" :class="[lineTableHeadClass, 'quote-lines-col-discount text-right']">{{ t('records.linesDiscount') }}</th>
              <th v-if="showTaxColumn" :class="[lineTableHeadClass, 'quote-lines-col-tax text-right']">{{ t('records.linesTax') }}</th>
              <th :class="[lineTableHeadClass, stickyColClass('total'), 'quote-lines-col-total text-right']">{{ t('records.linesTotal') }}</th>
              <th v-if="linesEditable" :class="[stickyColClass('actions'), 'quote-lines-col-actions px-3 py-2.5 text-right']">
                <span class="sr-only">{{ t('records.linesMoreActions') }}</span>
              </th>
            </tr>
          </thead>
          <draggable
            v-if="linesEditable"
            :model-value="getSectionRows(block.key)"
            tag="tbody"
            item-key="uid"
            handle=".quote-line-drag-handle"
            :group="dragGroupForBlock(block)"
            :empty-insert-threshold="canCrossSectionDrag ? 56 : 0"
            :animation="200"
            :easing="'cubic-bezier(0.2, 0, 0, 1)'"
            :force-fallback="true"
            :fallback-on-body="true"
            fallback-class="quote-line-sortable-fallback"
            ghost-class="quote-line-sortable-ghost"
            chosen-class="quote-line-sortable-chosen"
            drag-class="quote-line-sortable-drag"
            :disabled="!linesEditable || busy || !caps.lineReorder"
            class="divide-y divide-gray-200 dark:divide-gray-700"
            :class="{ 'quote-lines-tbody--empty': !getSectionRows(block.key).length }"
            @update:model-value="setSectionRows(block.key, $event)"
            @start="onLineOrderDragStart"
            @end="onLineOrderDragEnd"
            @change="(evt) => onLineOrderChange(block.key, evt)"
          >
            <template #item="{ element: { line, indent, isBundleParent, isOptional } }">
              <tr
                class="group/quote-line quote-line-row text-gray-900 dark:text-gray-100 transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                :class="isBundleParent ? 'quote-line-row--bundle bg-indigo-50/40 dark:bg-indigo-900/10 hover:bg-indigo-50/70 dark:hover:bg-indigo-900/20' : ''"
              >
              <td :class="[stickyColClass('name'), 'quote-lines-col-name px-3 py-2.5 align-top']">
                <div class="flex items-start gap-1.5 min-w-0">
                  <button
                    v-if="caps.lineReorder && !isLineDragDisabled(line)"
                    type="button"
                    class="quote-line-drag-handle inline-flex shrink-0 items-center justify-center p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-grab active:cursor-grabbing disabled:opacity-40"
                    :aria-label="canCrossSectionDrag ? t('records.linesDragHandleMoveAria') : t('records.linesDragHandleAria')"
                    :title="canCrossSectionDrag ? t('records.linesDragHandleMoveAria') : t('records.linesDragHandleAria')"
                    :disabled="busy"
                  >
                    <Bars3Icon class="h-4 w-4" />
                  </button>
                  <div class="min-w-0 flex items-start gap-1 flex-1" :class="indent ? 'pl-2' : ''">
                  <span v-if="indent" class="text-gray-400 shrink-0" aria-hidden="true">↳</span>
                  <div class="min-w-0">
                    <div class="truncate" :class="{ 'font-semibold': isBundleParent }">
                      <span v-if="isOptional" class="text-xs text-gray-500 mr-1">[{{ t('records.linesOptional') }}]</span>
                      {{ line.itemNameSnapshot || '—' }}
                    </div>
                    <p
                      v-if="configurationSummary(line)"
                      class="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400"
                      :title="configurationSummary(line)"
                    >
                      {{ configurationSummary(line) }}
                    </p>
                    <button
                      v-if="linesEditable && caps.bundles && isBundleParent && bundleParentHasOptionals(line)"
                      type="button"
                      class="mt-0.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      :disabled="busy"
                      @click.stop="openBundleOptionalConfig(line)"
                    >
                      {{ t('records.linesBundleOptionalConfigure') }}
                    </button>
                  </div>
                  </div>
                </div>
              </td>
              <td v-if="showSkuColumn" class="quote-lines-col-sku px-3 py-2.5 align-middle font-mono text-xs text-gray-600 dark:text-gray-300">
                {{ line.skuSnapshot || '—' }}
              </td>
              <td v-if="showPricingColumns" class="quote-lines-col-scroll px-3 py-2.5 align-middle text-xs text-gray-700 dark:text-gray-200">
                <span :title="priceProvenanceTitle(line)">
                  {{ line.priceBookNameSnapshot || '—' }}
                </span>
              </td>
              <td v-if="showPricingColumns" class="quote-lines-col-scroll px-3 py-2.5 align-middle text-xs text-gray-500 dark:text-gray-400">
                {{ pricingSourceLabel(line.pricingSourceSnapshot) }}
              </td>
              <td class="quote-lines-col-qty px-3 py-2.5 align-top text-right">
                <input
                  v-if="linesEditable"
                  :class="lineQtyInputClass"
                  type="number"
                  min="0"
                  step="1"
                  :aria-label="t('records.linesQty')"
                  :value="line.quantity"
                  :disabled="busy"
                  @change="(e) => patchQty(line, e?.target?.value)"
                />
                <span v-else class="tabular-nums">{{ line.quantity }}</span>
              </td>
              <td
                class="quote-lines-col-unit-price px-3 py-2.5 align-top text-right tabular-nums text-gray-700 dark:text-gray-200"
                :class="{
                  'quote-lines-col-unit-price--with-meta':
                    isPurchaseOrderLines &&
                    (hasCatalogPriceDrift(line) || !!catalogLastPurchaseLabel(line))
                }"
              >
                <div class="quote-lines-unit-price-cell">
                  <div class="quote-lines-unit-price-control">
                    <div
                      v-if="linesEditable && canEditLineUnitPrice"
                      class="quote-lines-unit-price-group"
                    >
                      <span class="quote-lines-unit-price-symbol" aria-hidden="true">{{ discountCurrencySymbol }}</span>
                      <input
                        class="quote-lines-unit-price-value"
                        type="number"
                        min="0"
                        step="0.01"
                        :aria-label="t('records.linesUnitPrice')"
                        :value="lineUnitPrice(line)"
                        :disabled="busy"
                        @change="(e) => patchUnitPrice(line, e?.target?.value)"
                      />
                    </div>
                    <span v-else>{{ formatMoney(lineUnitPrice(line)) }}</span>
                  </div>
                  <button
                    v-if="isPurchaseOrderLines && hasCatalogPriceDrift(line)"
                    type="button"
                    class="quote-lines-unit-price-meta quote-lines-unit-price-meta--action"
                    :disabled="busy || !linesEditable || !canEditLineUnitPrice"
                    :title="t('records.linesPoUseCatalogPrice')"
                    @click="applyCatalogUnitPrice(line)"
                  >
                    {{ t('records.linesPoCatalogPrice', { price: formatMoney(catalogUnitPrice(line)) }) }}
                  </button>
                  <span
                    v-else-if="isPurchaseOrderLines && catalogLastPurchaseLabel(line)"
                    class="quote-lines-unit-price-meta"
                    :title="catalogLastPurchaseLabel(line)"
                  >
                    {{ catalogLastPurchaseLabel(line) }}
                  </span>
                </div>
              </td>
              <td v-if="linesEditable && showDiscountColumn" class="quote-lines-col-discount px-3 py-2.5 align-top text-right overflow-visible">
                <div :class="discountGroupClass">
                  <input
                    :class="discountGroupInputClass"
                    type="text"
                    inputmode="decimal"
                    :aria-label="t('records.linesDiscount')"
                    :value="lineDiscountInputValue(line)"
                    :placeholder="discountValuePlaceholder"
                    :disabled="busy"
                    @input="sanitizeDiscountInputEvent"
                    @change="(e) => patchLineDiscount(line, { value: e.target.value })"
                  />
                  <div class="quote-lines-discount-type" data-discount-type-root>
                    <button
                      type="button"
                      class="quote-lines-discount-type-btn"
                      :disabled="busy"
                      :aria-label="t('records.linesDiscount')"
                      :aria-expanded="isDiscountTypeMenuOpen(`line:${lineRowKey(line)}`)"
                      @click="toggleDiscountTypeMenu(`line:${lineRowKey(line)}`, $event)"
                    >
                      <span class="quote-lines-discount-type-label">{{ discountAddonLabel(lineDiscountType(line)) }}</span>
                    </button>
                    <Teleport to="body">
                      <div
                        v-if="isDiscountTypeMenuOpen(`line:${lineRowKey(line)}`)"
                        class="quote-lines-discount-type-menu"
                        role="listbox"
                        :style="discountTypeMenuStyle"
                      >
                        <button
                          v-for="opt in discountTypeOptions"
                          :key="opt.value"
                          type="button"
                          role="option"
                          class="quote-lines-discount-type-option"
                          :class="{ 'is-selected': lineDiscountType(line) === opt.value }"
                          :aria-selected="lineDiscountType(line) === opt.value"
                          @click="chooseDiscountType(`line:${lineRowKey(line)}`, opt.value, (v) => patchLineDiscount(line, { type: v }))"
                        >
                          {{ opt.label }}
                        </button>
                      </div>
                    </Teleport>
                  </div>
                </div>
              </td>
              <td v-if="showTaxColumn" class="quote-lines-col-tax px-3 py-2.5 align-top text-right">
                <LineTaxPickerCell
                  v-if="caps.taxEdit"
                  :tax-snapshot="line.taxSnapshot"
                  :line-tax-total="line.lineTaxTotal"
                  :disabled="busy"
                  @save="(taxIds) => patchLineTaxes(line, taxIds)"
                />
                <span v-else class="tabular-nums text-xs text-gray-600 dark:text-gray-300">
                  {{ formatMoney(line.lineTaxTotal) }}
                </span>
              </td>
              <td :class="[stickyColClass('total'), 'quote-lines-col-total px-3 py-2.5 align-top text-right font-medium tabular-nums']">
                {{ formatMoney(line.lineTotal) }}
              </td>
              <td :class="[stickyColClass('actions'), 'quote-lines-col-actions px-3 py-2.5 align-top text-right']">
                <div
                  v-if="linesEditable"
                  class="inline-flex items-center justify-end opacity-100 lg:opacity-0 lg:group-hover/quote-line:opacity-100 transition-opacity"
                >
                  <button
                    type="button"
                    class="inline-flex items-center justify-center p-1.5 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                    :title="t('actions.delete')"
                    :aria-label="t('actions.delete')"
                    :disabled="busy"
                    @click="requestRemoveLine(line)"
                  >
                    <TrashIcon class="h-4 w-4" />
                  </button>
                </div>
              </td>
              </tr>
            </template>
          </draggable>
          <tbody
            v-if="linesEditable && hasDraftRow(block.key) && !isReorderDragging"
            class="quote-line-draft-tbody"
          >
            <tr class="quote-line-draft-row bg-indigo-50/40 dark:bg-indigo-950/25 text-gray-900 dark:text-gray-100">
              <td
                :class="[stickyColClass('name'), 'quote-lines-col-name quote-line-draft-search-cell px-3 py-2 align-middle']"
              >
                <div class="flex items-center gap-1.5 min-w-0 w-full">
                  <div class="relative min-w-0 flex-1">
                    <MagnifyingGlassIcon
                      class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
                      aria-hidden="true"
                    />
                    <input
                      :data-quote-draft-search="block.key"
                      :ref="(el) => registerDraftSearchInput(block.key, el)"
                      v-model="draftRow(block).searchQuery"
                      type="search"
                      :class="lineInlineSearchInputClass"
                      :placeholder="t('records.linesInlineSearchPlaceholder')"
                      :disabled="busy || draftRow(block).committing"
                      autocomplete="off"
                      @input="onDraftSearchInput(block)"
                      @focus="onDraftSearchFocus(block)"
                      @blur="onDraftSearchBlur(block)"
                      @keydown="onDraftSearchKeydown(block, $event)"
                    />
                    <Teleport to="body">
                      <ul
                        v-if="draftRow(block).searchOpen"
                        :style="draftSearchMenuStyle(block)"
                        class="fixed z-[10050] min-w-[16rem] overflow-y-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black/5 dark:ring-white/10"
                        @mousedown.prevent
                      >
                        <li
                          v-if="draftSearchDropdownLabel(block)"
                          class="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
                        >
                          {{ draftSearchDropdownLabel(block) }}
                        </li>
                        <li
                          v-if="draftRow(block).searchLoading"
                          class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400"
                        >
                          {{ t('states.loading') }}
                        </li>
                        <li
                          v-else-if="!draftRow(block).searchResults.length && (draftRow(block).searchQuery.trim() || !showCreateCatalogItemAction)"
                          class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400"
                        >
                          {{ t('records.linesNoVariantsFound') }}
                        </li>
                        <li
                          v-for="(hit, hitIdx) in draftRow(block).searchResults"
                          :key="hit._id"
                          class="cursor-pointer px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                          :class="hitIdx === draftRow(block).searchHighlight ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''"
                          @mousedown.prevent="commitDraftFromHit(block, hit)"
                        >
                          <span class="text-gray-900 dark:text-white">{{ hit.item_name || hit.variant_code }}</span>
                          <span v-if="hit.variant_code" class="block text-xs text-gray-500 font-mono">{{ hit.variant_code }}</span>
                        </li>
                        <li
                          v-if="showCreateCatalogItemAction"
                          class="border-t border-gray-100 dark:border-gray-700 mt-1"
                        >
                          <button
                            type="button"
                            class="flex w-full items-center gap-2 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                            @mousedown.prevent="openAddNewItemFromDraft(block)"
                          >
                            <PlusIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>{{ t('records.linesAddNewItem') }}</span>
                          </button>
                        </li>
                      </ul>
                    </Teleport>
                  </div>
                  <button
                    type="button"
                    class="inline-flex shrink-0 items-center justify-center h-8 w-8 rounded-md text-gray-500 dark:text-gray-300 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-50"
                    :disabled="busy || draftRow(block).committing"
                    :title="t('records.linesOpenLookup')"
                    :aria-label="t('records.linesOpenLookup')"
                    @click="openVariantPickerForDraft(block)"
                  >
                    <CubeIcon class="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </td>
              <td :colspan="draftSearchMiddleColspan" class="px-3 py-2 align-middle" />
              <td :class="[stickyColClass('total'), 'quote-lines-col-total px-3 py-2 align-middle text-right text-xs text-gray-400 dark:text-gray-500 tabular-nums']">—</td>
              <td :class="[stickyColClass('actions'), 'quote-lines-col-actions px-3 py-2 align-middle text-right']">
                <button
                  type="button"
                  class="inline-flex items-center justify-center p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                  :disabled="busy || draftRow(block).committing"
                  :title="t('actions.cancel')"
                  :aria-label="t('actions.cancel')"
                  @click="clearDraftRow(block.key)"
                >
                  <XMarkIcon class="h-4 w-4" aria-hidden="true" />
                </button>
              </td>
            </tr>
          </tbody>
          <tbody
            v-else-if="!linesEditable && !getSectionRows(block.key).length"
            class="divide-y divide-gray-200 dark:divide-gray-700"
          >
            <tr>
              <td class="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400" :colspan="tableColspan">
                {{ t('records.linesEmpty') }}
              </td>
            </tr>
          </tbody>
          <tbody v-else-if="!linesEditable" class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr
              v-for="{ line, indent, isBundleParent, isOptional } in getSectionRows(block.key)"
              :key="lineRowKey(line)"
              class="text-gray-900 dark:text-gray-100"
              :class="isBundleParent ? 'quote-line-row--bundle bg-indigo-50/40 dark:bg-indigo-900/10' : ''"
            >
              <td :class="[stickyColClass('name'), 'quote-lines-col-name px-3 py-2.5 align-middle']">
                <div class="min-w-0 flex items-start gap-1" :class="indent ? 'pl-4' : ''">
                  <span v-if="indent" class="text-gray-400 shrink-0" aria-hidden="true">↳</span>
                  <div class="min-w-0">
                    <div class="truncate" :class="{ 'font-semibold': isBundleParent }">
                      <span v-if="isOptional" class="text-xs text-gray-500 mr-1">[{{ t('records.linesOptional') }}]</span>
                      {{ line.itemNameSnapshot || '—' }}
                    </div>
                  </div>
                </div>
              </td>
              <td v-if="showSkuColumn" class="quote-lines-col-sku px-3 py-2.5 align-middle font-mono text-xs text-gray-600 dark:text-gray-300">
                {{ line.skuSnapshot || '—' }}
              </td>
              <td v-if="showPricingColumns" class="quote-lines-col-scroll px-3 py-2.5 align-middle text-xs text-gray-700 dark:text-gray-200">
                {{ line.priceBookNameSnapshot || '—' }}
              </td>
              <td v-if="showPricingColumns" class="quote-lines-col-scroll px-3 py-2.5 align-middle text-xs text-gray-500 dark:text-gray-400">
                {{ pricingSourceLabel(line.pricingSourceSnapshot) }}
              </td>
              <td class="quote-lines-col-qty px-3 py-2.5 align-middle text-right tabular-nums">{{ line.quantity }}</td>
              <td class="quote-lines-col-unit-price px-3 py-2.5 align-middle text-right tabular-nums text-gray-700 dark:text-gray-200">
                <div class="flex flex-col items-end gap-0.5">
                  <span>{{ formatMoney(lineUnitPrice(line)) }}</span>
                  <span
                    v-if="isPurchaseOrderLines && hasCatalogPriceDrift(line)"
                    class="max-w-[9rem] truncate text-[10px] leading-tight text-amber-700 dark:text-amber-300"
                  >
                    {{ t('records.linesPoCatalogPrice', { price: formatMoney(catalogUnitPrice(line)) }) }}
                  </span>
                </div>
              </td>
              <td v-if="showTaxColumn" class="quote-lines-col-tax px-3 py-2.5 align-middle text-right tabular-nums text-xs text-gray-600 dark:text-gray-300">
                {{ formatMoney(line.lineTaxTotal) }}
              </td>
              <td :class="[stickyColClass('total'), 'quote-lines-col-total px-3 py-2.5 align-middle text-right font-medium tabular-nums']">
                {{ formatMoney(line.lineTotal) }}
              </td>
            </tr>
          </tbody>
          <tfoot v-if="linesEditable && !getSectionRows(block.key).length && isReorderDragging">
            <tr>
              <td class="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400" :colspan="tableColspan">
                {{ canCrossSectionDrag ? t('records.linesEmptyDropHint') : t('records.linesEmpty') }}
              </td>
            </tr>
          </tfoot>
          <tfoot
            v-if="linesEditable && !isReorderDragging"
            class="quote-lines-add-actions-foot"
          >
            <tr>
              <td
                :colspan="addActionsLeadingColspan"
                :class="[
                  lineTableFootCellClass,
                  stickyColClass('name'),
                  'quote-lines-col-name',
                  'quote-lines-add-actions-cell'
                ]"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="busy || hasDraftRow(block.key)"
                    @click="startDraftRow(block)"
                  >
                    <PlusIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
                    {{ t('records.linesAdd') }}
                  </button>
                  <button
                    v-if="caps.bundles"
                    type="button"
                    class="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="busy"
                    @click="openBundlePickerForSection(block)"
                  >
                    <Squares2X2Icon class="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                    {{ t('records.linesAddBundle') }}
                  </button>
                </div>
              </td>
              <td :colspan="addActionsMiddleColspan" :class="lineTableFootCellClass" />
              <td :class="[lineTableFootCellClass, stickyColClass('total')]" />
              <td :class="[lineTableFootCellClass, stickyColClass('actions')]" />
            </tr>
          </tfoot>
        </table>
          </div>
          <div
            v-if="block.section && !block.isOrphan && block.section.showSectionTotal !== false"
            class="quote-lines-section-summary flex items-center justify-end border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30"
          >
            <div class="quote-lines-section-summary-label px-3 py-2.5 text-right">
              <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {{ t('records.quoteSectionSubtotal') }}:
              </span>
            </div>
            <div class="quote-lines-section-summary-discount px-3 py-2.5 flex items-center justify-end">
              <div v-if="linesEditable && caps.sectionDiscounts" :class="discountGroupClass">
                <input
                  :class="discountGroupInputClass"
                  type="text"
                  inputmode="decimal"
                  :aria-label="t('records.quoteSectionDiscount')"
                  :value="sectionDiscountInputValue(block.section)"
                  :placeholder="discountValuePlaceholder"
                  :disabled="busy"
                  @input="sanitizeDiscountInputEvent"
                  @change="(e) => saveSectionDiscount(block.section, { value: e.target.value })"
                />
                <div class="quote-lines-discount-type" data-discount-type-root>
                  <button
                    type="button"
                    class="quote-lines-discount-type-btn"
                    :disabled="busy"
                    :aria-label="t('records.quoteSectionDiscount')"
                    :aria-expanded="isDiscountTypeMenuOpen(`section:${block.key}`)"
                    @click="toggleDiscountTypeMenu(`section:${block.key}`, $event)"
                  >
                    <span class="quote-lines-discount-type-label">{{ discountAddonLabel(sectionDiscountType(block.section)) }}</span>
                  </button>
                  <Teleport to="body">
                    <div
                      v-if="isDiscountTypeMenuOpen(`section:${block.key}`)"
                      class="quote-lines-discount-type-menu"
                      role="listbox"
                      :style="discountTypeMenuStyle"
                    >
                      <button
                        v-for="opt in discountTypeOptions"
                        :key="opt.value"
                        type="button"
                        role="option"
                        class="quote-lines-discount-type-option"
                        :class="{ 'is-selected': sectionDiscountType(block.section) === opt.value }"
                        :aria-selected="sectionDiscountType(block.section) === opt.value"
                        @click="chooseDiscountType(`section:${block.key}`, opt.value, (v) => saveSectionDiscount(block.section, { type: v }))"
                      >
                        {{ opt.label }}
                      </button>
                    </div>
                  </Teleport>
                </div>
              </div>
            </div>
            <div v-if="showTaxColumn" class="quote-lines-section-summary-tax px-3 py-2.5" aria-hidden="true" />
            <div class="quote-lines-section-summary-total px-3 py-2.5 text-right text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
              {{ formatMoney(block.section.sectionTotal) }}
            </div>
            <div v-if="linesEditable" class="quote-lines-section-summary-actions px-3 py-2.5" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div
        class="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm"
      >
        <div class="flex items-center justify-between gap-3 p-3">
          <div
            class="w-full max-w-md space-y-1.5 text-sm"
            data-testid="quote-lines-totals"
          >
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-400">{{ t('records.linesTotalsSubtotal') }}</span>
          <span class="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{{ formatMoney(totals.subtotal) }}</span>
        </div>
        <div v-if="totals.lineDiscountTotal > 0" class="flex items-center justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-400">{{ t('records.linesTotalsLineDiscount') }}</span>
          <span class="font-medium text-gray-900 dark:text-gray-100 tabular-nums">−{{ formatMoney(totals.lineDiscountTotal) }}</span>
        </div>
        <div v-if="showGlobalDiscountRow" class="flex items-center justify-between gap-2 text-sm">
          <span class="text-gray-600 dark:text-gray-400 shrink-0">{{ t('records.linesTotalsGlobalDiscount') }}</span>
          <div class="inline-flex items-center gap-2 ml-auto">
            <div v-if="linesEditable && caps.globalDiscounts" :class="discountGroupClass">
              <input
                :class="discountGroupInputClass"
                type="text"
                inputmode="decimal"
                :aria-label="t('records.linesTotalsGlobalDiscount')"
                :value="globalDiscountInputValue"
                :placeholder="discountValuePlaceholder"
                :disabled="busy"
                @input="sanitizeDiscountInputEvent"
                @change="onGlobalDiscountValueChange"
              />
              <div class="quote-lines-discount-type" data-discount-type-root>
                <button
                  type="button"
                  class="quote-lines-discount-type-btn"
                  :disabled="busy"
                  :aria-label="t('records.linesTotalsGlobalDiscount')"
                  :aria-expanded="isDiscountTypeMenuOpen('global')"
                  @click="toggleDiscountTypeMenu('global', $event)"
                >
                  <span class="quote-lines-discount-type-label">{{ discountAddonLabel(globalDiscountType) }}</span>
                </button>
                <Teleport to="body">
                  <div
                    v-if="isDiscountTypeMenuOpen('global')"
                    class="quote-lines-discount-type-menu"
                    role="listbox"
                    :style="discountTypeMenuStyle"
                  >
                    <button
                      v-for="opt in discountTypeOptions"
                      :key="opt.value"
                      type="button"
                      role="option"
                      class="quote-lines-discount-type-option"
                      :class="{ 'is-selected': globalDiscountType === opt.value }"
                      :aria-selected="globalDiscountType === opt.value"
                      @click="chooseDiscountType('global', opt.value, onGlobalDiscountTypeChange)"
                    >
                      {{ opt.label }}
                    </button>
                  </div>
                </Teleport>
              </div>
            </div>
            <span
              v-if="totals.globalDiscountTotal > 0 || !linesEditable"
              class="font-medium text-gray-900 dark:text-gray-100 tabular-nums shrink-0"
            >
              −{{ formatMoney(totals.globalDiscountTotal) }}
            </span>
          </div>
        </div>
        <div v-if="showTaxTotalsRow" class="flex items-center justify-between gap-2 text-sm" data-doc-tax-root>
          <div class="flex min-w-0 items-center gap-2">
            <span class="shrink-0 text-gray-600 dark:text-gray-400">{{ t('records.linesTotalsTax') }}</span>
            <button
              v-if="linesEditable && caps.taxEdit"
              type="button"
              class="shrink-0 text-xs text-indigo-600 hover:underline dark:text-indigo-400 disabled:opacity-50"
              :disabled="busy"
              :aria-expanded="openDocTaxes"
              @click="openDocTaxesPicker($event)"
            >
              {{ t('actions.edit') }}
            </button>
          </div>
          <span class="shrink-0 font-medium text-gray-900 dark:text-gray-100 tabular-nums">{{ formatMoney(totals.taxTotal) }}</span>
        </div>
        <div
          v-if="totals.chargesTotal > 0 || (linesEditable && caps.taxesCharges)"
          class="flex items-center justify-between gap-2 text-sm"
          data-doc-charge-root
        >
          <div class="flex min-w-0 items-center gap-2">
            <span class="shrink-0 text-gray-600 dark:text-gray-400">{{ t('records.linesTotalsCharges') }}</span>
            <button
              v-if="linesEditable && caps.taxesCharges"
              type="button"
              class="shrink-0 text-xs text-indigo-600 hover:underline dark:text-indigo-400 disabled:opacity-50"
              :disabled="busy"
              :aria-expanded="openDocCharges"
              @click="openDocChargesPicker($event)"
            >
              {{ t('actions.edit') }}
            </button>
          </div>
          <span class="shrink-0 font-medium text-gray-900 dark:text-gray-100 tabular-nums">{{ formatMoney(totals.chargesTotal) }}</span>
        </div>
        <div
          v-if="totals.adjustmentTotal !== 0 || (linesEditable && isPurchaseOrderLines)"
          class="flex items-center justify-between gap-2 text-sm"
        >
          <span class="text-gray-600 dark:text-gray-400 shrink-0">{{ t('records.linesTotalsAdjustment') }}</span>
          <div class="inline-flex items-center gap-2 ml-auto">
            <input
              v-if="linesEditable && isPurchaseOrderLines"
              type="number"
              step="0.01"
              class="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm tabular-nums dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              :value="adjustmentInputValue"
              :disabled="busy"
              :aria-label="t('records.linesTotalsAdjustment')"
              @change="onAdjustmentChange"
            />
            <span
              v-else
              class="font-medium text-gray-900 dark:text-gray-100 tabular-nums"
            >{{ formatMoney(totals.adjustmentTotal) }}</span>
          </div>
        </div>
          </div>
          <div
            class="quote-lines-grand-total shrink-0 min-w-[11rem] rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/40 px-4 py-3 text-right shadow-sm"
          >
            <div class="text-[11px] font-semibold uppercase tracking-wide text-indigo-800/80 dark:text-indigo-200/80">
              {{ t('records.linesTotalsGrandTotal') }}
            </div>
            <div class="mt-0.5 text-2xl font-bold tabular-nums text-indigo-950 dark:text-white">
              {{ formatMoney(totals.grandTotal) }}
            </div>
            <div v-if="currencyCode" class="mt-1 text-[11px] text-indigo-700/70 dark:text-indigo-300/70">
              {{ t('records.linesTotalsCurrency', { currency: currencyCode }) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pickers -->
    <div v-if="showBundlePicker" class="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-lg space-y-3 max-h-[80vh] flex flex-col">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.linesPickBundleTitle') }}</h4>
        <input
          v-model="bundleSearchQuery"
          type="search"
          :class="lineFormControlClass"
          :placeholder="t('records.linesBundleSearchPlaceholder')"
          @input="debouncedBundleSearch"
        />
        <ul class="flex-1 overflow-y-auto space-y-1 min-h-[120px]">
          <li v-if="bundleSearchLoading" class="text-sm text-gray-500 px-2">{{ t('states.loading') }}</li>
          <li v-else-if="!bundleSearchResults.length" class="text-sm text-gray-500 px-2">{{ t('records.linesNoBundlesFound') }}</li>
          <li
            v-for="hit in bundleSearchResults"
            :key="hit._id"
            class="px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            @click="pickBundle(hit)"
          >
            <span class="text-sm text-gray-900 dark:text-white">{{ hit.item_name || hit.variant_code }}</span>
            <span v-if="hit.variant_code" class="block text-xs text-gray-500 font-mono">{{ hit.variant_code }}</span>
          </li>
        </ul>
        <div class="flex justify-end">
          <button
            type="button"
            class="px-3 py-2 text-sm"
            @click="showBundlePicker = false; bundlePickerBlockKey = null"
          >
            {{ t('actions.cancel') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showBundleOptionalModal" class="fixed inset-0 z-[10055] flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-lg space-y-3 max-h-[80vh] flex flex-col">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white">
          {{ t('records.linesBundleOptionalTitle') }}
        </h4>
        <p class="text-sm text-gray-600 dark:text-gray-300">
          {{ bundleOptionalModalTitle }}
        </p>
        <p v-if="!bundleOptionalChoices.length" class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('records.linesBundleOptionalNone') }}
        </p>
        <ul v-else class="flex-1 overflow-y-auto space-y-2 min-h-[80px]">
          <li
            v-for="choice in bundleOptionalChoices"
            :key="choice.variantId"
            class="flex items-start gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
          >
            <input
              :id="`bundle-opt-${choice.variantId}`"
              v-model="bundleOptionalSelected"
              type="checkbox"
              class="mt-1 rounded"
              :value="choice.variantId"
              :disabled="busy"
            />
            <label :for="`bundle-opt-${choice.variantId}`" class="min-w-0 flex-1 cursor-pointer">
              <span class="text-sm text-gray-900 dark:text-white">{{ choice.label }}</span>
              <span class="block text-xs text-gray-500 dark:text-gray-400">
                {{ t('records.linesBundleOptionalQty', { qty: choice.quantity }) }}
              </span>
            </label>
          </li>
        </ul>
        <div class="flex justify-end gap-2 pt-1">
          <button type="button" class="px-3 py-2 text-sm" :disabled="busy" @click="closeBundleOptionalModal">
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="px-3 py-2 text-sm rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
            :disabled="busy"
            @click="confirmBundleOptionalModal"
          >
            {{ bundleOptionalModalMode === 'add' ? t('records.linesAdd') : t('actions.save') }}
          </button>
        </div>
      </div>
    </div>

    <TransitionRoot as="template" :show="showVariantPicker">
      <Dialog
        :initialFocus="variantPickerSearchInputRef"
        class="relative z-[10050]"
        @close="closeVariantPicker"
      >
        <TransitionChild
          as="template"
          enter="ease-out duration-200"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-200"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-hidden">
          <div class="absolute inset-0 overflow-hidden">
            <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <TransitionChild
                as="template"
                enter="transform transition ease-in-out duration-300 sm:duration-300"
                enter-from="translate-x-full"
                enter-to="translate-x-0"
                leave="transform transition ease-in-out duration-300 sm:duration-300"
                leave-from="translate-x-0"
                leave-to="translate-x-full"
              >
                <DialogPanel class="pointer-events-auto w-screen max-w-3xl">
                  <div class="rounded-tl-xl overflow-hidden relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 shadow-xl">
                    <div class="flex-shrink-0 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-6 sm:px-6">
                      <div class="flex items-center justify-between">
                        <DialogTitle class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                          {{ t('records.linesPickVariantTitle') }}
                        </DialogTitle>
                        <div class="ml-3 flex h-7 items-center">
                          <button
                            type="button"
                            class="relative rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer"
                            @click="closeVariantPicker"
                          >
                            <span class="absolute -inset-2.5" />
                            <span class="sr-only">{{ t('common.closePanel') }}</span>
                            <XMarkIcon class="size-6" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {{
                          isPurchaseOrderLines
                            ? poVariantScope === 'all'
                              ? t('records.linesPoBrowseAllEmptyHint')
                              : t('records.linesPoVendorCatalogSubtitle')
                            : t('records.linesPickItemsSubtitle')
                        }}
                      </p>
                      <div
                        v-if="isPurchaseOrderLines && poVendorId"
                        class="mt-3 flex flex-wrap items-center gap-2"
                      >
                        <button
                          type="button"
                          class="rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors"
                          :class="
                            poVariantScope === 'linked'
                              ? 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-800'
                              : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600'
                          "
                          @click="setPoVariantScope('linked')"
                        >
                          {{ t('records.linesPoShowVendorCatalog') }}
                        </button>
                        <button
                          type="button"
                          class="rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors"
                          :class="
                            poVariantScope === 'all'
                              ? 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-800'
                              : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600'
                          "
                          @click="setPoVariantScope('all')"
                        >
                          {{ t('records.linesPoBrowseAllItems') }}
                        </button>
                      </div>
                    </div>

                    <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
                      <div class="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
                        <div class="flex items-center gap-3">
                          <div class="relative flex-1 min-w-0">
                            <MagnifyingGlassIcon
                              class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                              aria-hidden="true"
                            />
                            <input
                              ref="variantPickerSearchInputRef"
                              v-model="variantSearchQuery"
                              type="search"
                              class="block h-8 w-full pl-8 pr-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-xs sm:text-sm outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                              :placeholder="t('records.linesVariantSearchPlaceholder')"
                              :disabled="busy"
                              autocomplete="off"
                              @input="debouncedVariantSearch"
                            />
                          </div>
                          <button
                            type="button"
                            class="inline-flex shrink-0 items-center justify-center rounded-md bg-white dark:bg-gray-800 p-2 text-gray-500 dark:text-gray-300 shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            :disabled="busy || variantSearchLoading"
                            :title="variantSearchLoading ? t('common.formRefreshing') : t('actions.refresh')"
                            @click="runVariantSearch"
                          >
                            <span class="sr-only">{{ t('actions.refresh') }}</span>
                            <ArrowPathIcon
                              class="size-4"
                              :class="variantSearchLoading ? 'animate-spin' : ''"
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                      </div>

                      <div class="flex-1 overflow-auto p-4">
                        <ul v-if="variantSearchLoading" class="divide-y divide-gray-200 dark:divide-gray-700">
                          <li v-for="i in 6" :key="`variant-skeleton-${i}`" class="flex items-center gap-3 py-3 px-2">
                            <div class="size-8 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
                            <div class="min-w-0 flex-1 space-y-2">
                              <div class="h-3.5 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                              <div class="h-3 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-gray-700/70" />
                            </div>
                            <div class="h-4 w-16 animate-pulse rounded bg-gray-100 dark:bg-gray-700/70" />
                          </li>
                        </ul>

                        <div
                          v-else-if="!variantSearchResults.length"
                          class="flex min-h-[20rem] flex-col items-center justify-center text-center px-6"
                        >
                          <div class="flex size-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                            <CubeIcon class="size-6 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                          </div>
                          <h4 class="mt-4 text-sm font-semibold text-gray-900 dark:text-white">
                            {{ t('records.linesNoVariantsFound') }}
                          </h4>
                          <p class="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                            {{
                              isPurchaseOrderLines && !variantSearchQuery.trim()
                                ? poPickerEmptyHint
                                : variantSearchQuery.trim()
                                  ? t('records.linesPickItemsNoMatch', { query: variantSearchQuery.trim() })
                                  : t('records.linesPickItemsEmptyHint')
                            }}
                          </p>
                          <button
                            v-if="
                              isPurchaseOrderLines &&
                              poVendorId &&
                              poVariantScope === 'linked' &&
                              !variantSearchQuery.trim()
                            "
                            type="button"
                            class="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                            @click="setPoVariantScope('all')"
                          >
                            {{ t('records.linesPoBrowseAllItems') }}
                          </button>
                          <button
                            v-if="
                              showCreateCatalogItemAction &&
                              !(isPurchaseOrderLines && !poVendorId)
                            "
                            type="button"
                            class="mt-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:hover:bg-indigo-600"
                            @click="openAddNewItemFromPicker"
                          >
                            <PlusIcon class="size-4" aria-hidden="true" />
                            {{ t('records.linesAddNewItem') }}
                          </button>
                        </div>

                        <ul v-else class="divide-y divide-gray-200 dark:divide-gray-700">
                          <li
                            v-for="hit in variantSearchResults"
                            :key="hit._id"
                            :class="[
                              'flex items-center gap-3 py-3 px-2 rounded-md transition-colors cursor-pointer',
                              isVariantPickerSelected(hit)
                                ? 'bg-indigo-50 dark:bg-indigo-500/10'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                            ]"
                            @click="toggleVariantPickerSelection(hit)"
                          >
                            <div
                              class="flex size-5 shrink-0 items-center justify-center rounded border"
                              :class="
                                isVariantPickerSelected(hit)
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                              "
                            >
                              <CheckSolidIcon
                                v-if="isVariantPickerSelected(hit)"
                                class="size-3.5"
                                aria-hidden="true"
                              />
                            </div>
                            <Avatar :record="variantHitAvatarRecord(hit)" size="md" />
                            <div class="min-w-0 flex-1">
                              <div class="flex items-center gap-2 min-w-0">
                                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {{ hit.item_name || hit.variant_code || '—' }}
                                </p>
                                <span
                                  v-if="isPurchaseOrderLines && hit.linked === false"
                                  class="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800"
                                >
                                  {{ t('records.linesPoNotLinkedBadge') }}
                                </span>
                              </div>
                              <p
                                v-if="variantHitSubtitle(hit)"
                                class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate font-mono"
                              >
                                {{ variantHitSubtitle(hit) }}
                              </p>
                              <p
                                v-if="poLastPurchaseLabel(hit)"
                                class="mt-0.5 text-xs text-gray-400 dark:text-gray-500 truncate"
                              >
                                {{ poLastPurchaseLabel(hit) }}
                              </p>
                            </div>
                            <div class="shrink-0 text-right">
                              <p class="text-sm font-medium tabular-nums text-gray-900 dark:text-white">
                                {{ formatVariantHitPrice(hit) }}
                              </p>
                            </div>
                          </li>
                        </ul>
                      </div>
                    </div>

                    <div class="flex flex-shrink-0 items-center justify-between gap-3 px-4 py-4 sm:px-6 border-t border-gray-200 dark:border-gray-700">
                      <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {{
                          variantPickerSelectedCount
                            ? t('records.linesPickItemsSelectedCount', { count: variantPickerSelectedCount })
                            : t('records.linesPickItemsSelectHint')
                        }}
                      </p>
                      <div class="flex items-center gap-2">
                        <button
                          v-if="showCreateCatalogItemAction"
                          type="button"
                          class="inline-flex items-center gap-1.5 rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                          @click="openAddNewItemFromPicker"
                        >
                          <PlusIcon class="size-4" aria-hidden="true" />
                          {{ t('common.formCreateNew') }}
                        </button>
                        <button
                          type="button"
                          class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                          :disabled="busy"
                          @click="closeVariantPicker"
                        >
                          {{ t('actions.cancel') }}
                        </button>
                        <button
                          type="button"
                          class="rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          :disabled="busy || !variantPickerSelectedCount"
                          @click="confirmVariantPickerSelection"
                        >
                          {{ t('records.linesAddSelected', { count: variantPickerSelectedCount }) }}
                        </button>
                      </div>
                    </div>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>

    <QuoteSectionFormModal
      :show="showSectionModal"
      :mode="sectionModalMode"
      :initial="sectionModalInitial"
      :saving="busy"
      @close="closeSectionModal"
      @submit="submitSectionModal"
    />

    <Teleport to="body">
      <div
        v-if="openDocTaxes"
        data-doc-taxes-popover
        class="fixed z-[10050] w-[20rem] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg ring-1 ring-black/5 dark:border-gray-600 dark:bg-gray-800 dark:ring-white/10"
        :style="docTaxesPopoverStyle"
        role="dialog"
        :aria-label="t('records.linesDocTaxes')"
      >
        <div class="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
          <h3 class="text-xs font-semibold text-gray-900 dark:text-white">{{ t('records.linesDocTaxes') }}</h3>
        </div>
        <div class="max-h-64 space-y-1.5 overflow-y-auto px-3 py-2">
          <p
            v-if="docTaxesLoadError"
            class="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
          >
            {{ docTaxesLoadError }}
          </p>
          <div v-else-if="docTaxesLoading" class="flex justify-center py-4">
            <div class="h-5 w-5 animate-spin rounded-full border-b-2 border-indigo-600" />
          </div>
          <template v-else>
            <label
              v-for="opt in docTaxOptions"
              :key="opt.id"
              class="flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
            >
              <HeadlessCheckbox
                :model-value="docTaxIds.includes(opt.id)"
                @update:model-value="(checked) => toggleDocTaxId(opt.id, checked)"
              />
              <span>{{ opt.label }}</span>
            </label>
            <p v-if="!docTaxOptions.length" class="text-xs text-gray-500">{{ t('records.linesDocTaxPickerEmpty') }}</p>
          </template>
        </div>
        <div class="flex justify-end gap-2 border-t border-gray-200 px-3 py-2 dark:border-gray-700">
          <button type="button" class="px-2.5 py-1 text-xs text-gray-600 dark:text-gray-300" @click="openDocTaxes = false">
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
            :disabled="busy || docTaxesLoading || !!docTaxesLoadError"
            @click="persistDocTaxes"
          >
            {{ busy ? t('states.saving') : t('actions.save') }}
          </button>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="openDocCharges"
        data-doc-charges-popover
        class="fixed z-[10050] w-[20rem] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg ring-1 ring-black/5 dark:border-gray-600 dark:bg-gray-800 dark:ring-white/10"
        :style="docChargesPopoverStyle"
        role="dialog"
        :aria-label="t('records.linesDocCharges')"
      >
        <div class="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
          <h3 class="text-xs font-semibold text-gray-900 dark:text-white">{{ t('records.linesDocCharges') }}</h3>
        </div>
        <div class="max-h-64 space-y-1.5 overflow-y-auto px-3 py-2">
          <p
            v-if="docChargesLoadError"
            class="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
          >
            {{ docChargesLoadError }}
          </p>
          <div v-else-if="docChargesLoading" class="flex justify-center py-4">
            <div class="h-5 w-5 animate-spin rounded-full border-b-2 border-indigo-600" />
          </div>
          <template v-else>
            <label
              v-for="opt in docChargeOptions"
              :key="opt.id"
              class="flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
            >
              <HeadlessCheckbox
                :model-value="docChargeIds.includes(opt.id)"
                @update:model-value="(checked) => toggleDocChargeId(opt.id, checked)"
              />
              <span>{{ opt.label }}</span>
            </label>
            <p v-if="!docChargeOptions.length" class="text-xs text-gray-500">{{ t('records.linesChargePickerEmpty') }}</p>
            <p
              v-if="docChargeIds.length"
              class="mt-1.5 text-xs font-medium text-gray-700 dark:text-gray-300"
            >
              {{ t('records.linesDocChargesPreview', { amount: formatMoney(docChargesPreviewTotal) }) }}
            </p>
          </template>
        </div>
        <div class="flex justify-end gap-2 border-t border-gray-200 px-3 py-2 dark:border-gray-700">
          <button type="button" class="px-2.5 py-1 text-xs text-gray-600 dark:text-gray-300" @click="openDocCharges = false">
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
            :disabled="busy || docChargesLoading || !!docChargesLoadError"
            @click="persistDocCharges"
          >
            {{ busy ? t('states.saving') : t('actions.save') }}
          </button>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="poUnlinkedConfirm.open"
        class="fixed inset-0 z-[10100] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        <div class="absolute inset-0 bg-gray-900/40" @click="closePoUnlinkedConfirm({ ok: false })" />
        <div
          class="relative w-full max-w-md rounded-xl bg-white p-5 shadow-xl ring-1 ring-black/5 dark:bg-gray-900 dark:ring-white/10"
        >
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('records.linesPoUnlinkedTitle') }}
          </h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {{ t('records.linesPoUnlinkedMessage') }}
          </p>
          <label class="mt-4 flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-200">
            <input
              v-model="poUnlinkedConfirm.alsoLink"
              type="checkbox"
              class="mt-0.5 size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800"
            />
            <span>{{ t('records.linesPoAlsoLinkVendor') }}</span>
          </label>
          <div class="mt-5 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-800"
              @click="closePoUnlinkedConfirm({ ok: false })"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 dark:bg-indigo-500"
              @click="confirmPoUnlinkedAndAdd"
            >
              {{ t('records.linesPoContinue') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <DeleteConfirmationModal
      :show="showDeleteLineModal"
      :record-name="linePendingDelete?.itemNameSnapshot || t('records.linesTitle')"
      record-type="quote line"
      :deleting="busy"
      @close="showDeleteLineModal = false"
      @confirm="confirmRemoveLine"
    />

    <CreateRecordDrawer
      v-if="showCreateCatalogItemAction"
      :isOpen="showItemCreateDrawer"
      moduleKey="items"
      :prefillText="itemCreatePrefillText"
      prefillFieldKey="item_name"
      :initialData="itemCreateInitialData"
      @close="closeItemCreateDrawer"
      @saved="handleItemCreatedFromDraft"
    />

    <ProductConfigGuidedDrawer
      :open="Boolean(productConfigSession?.open)"
      :hit="productConfigSession?.hit || null"
      :configs="productConfigSession?.configs || []"
      :loading-configs="Boolean(productConfigSession?.loading)"
      @confirm="onProductConfigConfirm"
      @skip="onProductConfigSkip"
      @cancel="onProductConfigCancel"
    />
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue';
import {
  ArrowPathIcon,
  Bars3Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  CubeIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  Squares2X2Icon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import { CheckIcon as CheckSolidIcon } from '@heroicons/vue/24/solid';
import draggable from 'vuedraggable';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { unwrapCatalogApiData, unwrapCatalogApiList } from '@/utils/catalogApi';
import { useAuthStore } from '@/stores/authRegistry';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';
import Avatar from '@/components/common/Avatar.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import ProductConfigGuidedDrawer from '@/components/catalog/ProductConfigGuidedDrawer.vue';
import QuoteLinesHeaderActions from '@/components/record-page/sections/QuoteLinesHeaderActions.vue';
import QuoteLinesColumnOptions from '@/components/record-page/sections/QuoteLinesColumnOptions.vue';
import QuoteSectionFormModal from '@/components/record-page/sections/QuoteSectionFormModal.vue';
import LineTaxPickerCell from '@/components/record-page/sections/LineTaxPickerCell.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { formatQuoteMoney } from '@/utils/quoteMoney';
import { isCpqAddonEntitled } from '@/utils/addonEntitlement';
import {
  resolveCommercialLinesAdapter,
  commercialLineId,
  commercialLineSectionRef,
  commercialSectionRef
} from '@/platform/commercialLines/adapters';
import { useQuoteLinesColumnPrefs } from '@/composables/useQuoteLinesColumnPrefs';
import {
  buildQuoteSectionBlocks,
  sectionTypeBadgeKey,
  sortQuoteSections
} from '@/utils/quoteSectionDisplay';
import { useQuoteLinesSession, clearQuoteLinesSession } from '@/composables/useQuoteLinesSession';
import { useQuoteLinesStickyColumns, updateQuoteLinesTableScrollHints } from '@/composables/useQuoteLinesStickyColumns';
import { formatDate, formatUserDate } from '@/utils/localeFormat';

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: { type: Object, default: () => ({}) },
  /** Create drawer: mutate lines/sections locally until parent Save POSTs the header. */
  draftMode: { type: Boolean, default: false }
});

const emit = defineEmits(['updated']);

const linesAdapter = computed(() => resolveCommercialLinesAdapter(props.adapter));

const isPurchaseOrderLines = computed(() => linesAdapter.value.kind === 'purchaseOrder');
const canEditLineUnitPrice = computed(
  () =>
    isPurchaseOrderLines.value &&
    linesAdapter.value.capabilities?.unitPriceEdit === true
);
const poVendorId = computed(() => {
  const rec = props.record;
  if (!rec || typeof rec !== 'object') return '';
  const candidates = [
    rec.vendorId,
    rec.vendor_id,
    rec.vendor,
    rec.VendorId,
    rec.vendorRef,
    rec.vendorOrganizationId
  ];
  for (const c of candidates) {
    if (c == null || c === '') continue;
    if (typeof c === 'object') {
      const id = c._id ?? c.id ?? c.value ?? null;
      if (id != null && String(id).trim()) return String(id).trim();
      continue;
    }
    const s = String(c).trim();
    if (s) return s;
  }
  return '';
});
const poVariantScope = ref('linked');
/** Active vendor catalog pricing by variantId (string). */
const poCatalogByVariant = ref(
  /** @type {Map<string, { price: number, lastPrice: number|null, lastDate: string|null }>} */ (new Map())
);

function setPoVariantScope(scope) {
  poVariantScope.value = scope === 'all' ? 'all' : 'linked';
  if (showVariantPicker.value) runVariantSearch();
}

function lineUnitPrice(line) {
  const n = Number(line?.unitPriceSnapshot ?? line?.unitPrice);
  return Number.isFinite(n) ? n : 0;
}

function catalogUnitPrice(line) {
  if (!isPurchaseOrderLines.value) return null;
  const vid = line?.variantId != null ? String(line.variantId) : '';
  if (!vid) return null;
  const e = poCatalogByVariant.value.get(vid);
  const p = e?.price;
  return p == null || !Number.isFinite(p) ? null : p;
}

function catalogLastPurchaseLabel(line) {
  if (!isPurchaseOrderLines.value) return '';
  const vid = line?.variantId != null ? String(line.variantId) : '';
  if (!vid) return '';
  const e = poCatalogByVariant.value.get(vid);
  if (!e || (e.lastPrice == null && !e.lastDate)) return '';
  const priceLabel =
    e.lastPrice != null && Number.isFinite(e.lastPrice)
      ? formatMoney(e.lastPrice)
      : '—';
  let dateLabel = '—';
  if (e.lastDate) {
    try {
      dateLabel = formatDate(e.lastDate, {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      dateLabel = String(e.lastDate).slice(0, 10);
    }
  }
  return t('records.linesPoLastPurchase', { price: priceLabel, date: dateLabel });
}

function hasCatalogPriceDrift(line) {
  const cat = catalogUnitPrice(line);
  if (cat == null) return false;
  return Math.abs(lineUnitPrice(line) - cat) > 0.005;
}

async function loadPoCatalogPrices() {
  if (!isPurchaseOrderLines.value || !poVendorId.value) {
    poCatalogByVariant.value = new Map();
    return;
  }
  try {
    const res = await apiClient.get(`/inventory/vendor-catalog/${poVendorId.value}`, {
      params: { includeInactive: false }
    });
    const rows = unwrapCatalogApiList(res);
    const next = new Map();
    for (const row of rows) {
      const vid = row?.variantId != null ? String(row.variantId) : '';
      if (!vid) continue;
      if (String(row.status || 'Active') === 'Inactive') continue;
      const price = Number(row.purchasePrice);
      next.set(vid, {
        price: Number.isFinite(price) ? price : 0,
        lastPrice:
          row.lastPurchasePrice != null && Number.isFinite(Number(row.lastPurchasePrice))
            ? Number(row.lastPurchasePrice)
            : null,
        lastDate: row.lastPurchaseDate || null
      });
    }
    poCatalogByVariant.value = next;
  } catch {
    poCatalogByVariant.value = new Map();
  }
}

watch(
  [isPurchaseOrderLines, poVendorId],
  () => {
    void loadPoCatalogPrices();
  },
  { immediate: true }
);

/**
 * PO line pickers must only use the vendor catalog (linked or browse-all scoped to vendor
 * search API). Never fall back to the global sellable catalog — that ignores the vendor.
 */
async function searchVariantsForDocument({ q = '', limit = 25 } = {}) {
  if (isPurchaseOrderLines.value) {
    if (!poVendorId.value) return [];
    const res = await apiClient.get(
      `/inventory/vendor-catalog/${poVendorId.value}/variants/search`,
      {
        params: {
          q,
          limit,
          scope: poVariantScope.value === 'all' ? 'all' : 'linked'
        }
      }
    );
    const data = unwrapCatalogApiData(res);
    return Array.isArray(data) ? data : [];
  }
  const res = await apiClient.get('/catalog/variants/search', {
    params: { q, limit }
  });
  return unwrapCatalogApiData(res);
}

const poPickerEmptyHint = computed(() => {
  if (!isPurchaseOrderLines.value) return '';
  if (!poVendorId.value) return t('records.linesPoSelectVendorFirst');
  if (poVariantScope.value === 'linked') return t('records.linesPoVendorCatalogEmpty');
  return t('records.linesPoBrowseAllEmptyHint');
});

function poLastPurchaseLabel(hit) {
  if (!isPurchaseOrderLines.value) return '';
  const price = hit?.last_purchase_price;
  const date = hit?.last_purchase_date;
  if (price == null && !date) return '';
  const code = String(hit?.currency || currencyCode.value || 'USD').toUpperCase();
  const priceLabel =
    price != null && price !== ''
      ? formatQuoteMoney(price, code)
      : '—';
  let dateLabel = '—';
  if (date) {
    try {
      dateLabel = formatDate(date, {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      dateLabel = String(date).slice(0, 10);
    }
  }
  return t('records.linesPoLastPurchase', { price: priceLabel, date: dateLabel });
}

const poUnlinkedConfirm = ref({
  open: false,
  hit: null,
  block: null,
  alsoLink: true,
  resolve: null
});

function closePoUnlinkedConfirm(result) {
  const resolve = poUnlinkedConfirm.value.resolve;
  poUnlinkedConfirm.value = {
    open: false,
    hit: null,
    block: null,
    alsoLink: true,
    resolve: null
  };
  if (typeof resolve === 'function') resolve(result);
}

function promptPoUnlinkedConfirm(hit, block) {
  return new Promise((resolve) => {
    poUnlinkedConfirm.value = {
      open: true,
      hit,
      block,
      alsoLink: true,
      resolve
    };
  });
}

function confirmPoUnlinkedAndAdd() {
  const alsoLink = !!poUnlinkedConfirm.value.alsoLink;
  closePoUnlinkedConfirm({ ok: true, alsoLink });
}

async function ensurePoLineAllowed(hit, block) {
  if (!isPurchaseOrderLines.value) return { ok: true, alsoLink: false };
  // linked true or missing (fallback search): allow
  if (hit?.linked !== false) return { ok: true, alsoLink: false };
  const result = await promptPoUnlinkedConfirm(hit, block);
  if (!result?.ok) return { ok: false, alsoLink: false };
  return { ok: true, alsoLink: !!result.alsoLink };
}
/** Full capability set in draftMode — mutations run locally until parent Save. */
const caps = computed(() => linesAdapter.value.capabilities);
const apiBase = computed(() => linesAdapter.value.apiBase);
const isApiMode = computed(() => Boolean(props.record?._id) && !props.draftMode);
const recordApiId = computed(() => (isApiMode.value ? props.record?._id : null));
const documentRecordBase = computed(() => {
  const id = recordApiId.value;
  return id ? `${apiBase.value}/${id}` : '';
});

let localDraftSeq = 0;
function nextLocalDraftId(prefix) {
  localDraftSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${localDraftSeq}`;
}

function currentLocalLines() {
  return Array.isArray(props.record?.lines) ? props.record.lines.map((l) => ({ ...l })) : [];
}

function currentLocalSections() {
  return Array.isArray(props.record?.sections) ? props.record.sections.map((s) => ({ ...s })) : [];
}

function filterLocalIncludedLines(lineList) {
  const all = Array.isArray(lineList) ? lineList : [];
  const visible = all.filter((l) => l && l.hiddenLine !== true);
  const bundleModeByParentId = new Map();
  for (const l of visible) {
    if (String(l?.lineType || '') !== 'bundle_parent') continue;
    const mode = String(l?.bundleSnapshot?.pricingMode || '').toLowerCase().trim() || 'fixed';
    const key = String(l._id || l._localId || l[linesAdapter.value.lineIdField] || '');
    if (key) bundleModeByParentId.set(key, mode);
  }
  return visible.filter((l) => {
    const type = String(l?.lineType || '');
    if (type === 'bundle_component') {
      const parentId = l.parentBundleLineId ? String(l.parentBundleLineId) : '';
      return parentId ? bundleModeByParentId.get(parentId) !== 'fixed' : true;
    }
    if (type === 'bundle_parent') {
      const mode = String(l?.bundleSnapshot?.pricingMode || '').toLowerCase().trim() || 'fixed';
      return mode !== 'rollup';
    }
    return true;
  });
}

function computeLocalDiscountAmount({ lineSubtotal, discountType, discountValue, discountAmount }) {
  if (Number.isFinite(Number(discountAmount)) && Number(discountAmount) > 0) {
    return Number(discountAmount);
  }
  const dtype = String(discountType || '').trim();
  const dval = Number(discountValue) || 0;
  if (dtype === 'percent' && dval > 0) return (Number(lineSubtotal) || 0) * dval / 100;
  if (dtype === 'amount' && dval > 0) return dval;
  return 0;
}

function computeLocalSectionTotals(section, sectionLines) {
  const included = filterLocalIncludedLines(sectionLines);
  let sectionLineDiscountTotal = 0;
  for (const l of included) {
    const qty = Number(l.quantity) || 0;
    const unit = lineUnitPrice(l);
    const gross = qty * unit;
    const net = Number(l.lineSubtotal) || 0;
    sectionLineDiscountTotal += Math.max(0, gross - net);
  }
  const sectionSubtotal = included.reduce((sum, l) => sum + (Number(l.lineSubtotal) || 0), 0);
  const sectionTaxTotal = included.reduce((sum, l) => sum + (Number(l.lineTaxTotal) || 0), 0);
  const sectionDiscountTotal = computeLocalDiscountAmount({
    lineSubtotal: sectionSubtotal,
    discountType: section?.sectionDiscountType,
    discountValue: section?.sectionDiscountValue,
    discountAmount: section?.sectionDiscountAmount
  });
  const sectionNet = Math.max(0, sectionSubtotal - sectionDiscountTotal);
  const sectionTotal = Math.round((sectionNet + sectionTaxTotal) * 100) / 100;
  return {
    sectionSubtotal: Math.round(sectionSubtotal * 100) / 100,
    sectionLineDiscountTotal: Math.round(sectionLineDiscountTotal * 100) / 100,
    sectionDiscountTotal: Math.round(sectionDiscountTotal * 100) / 100,
    sectionTaxTotal: Math.round(sectionTaxTotal * 100) / 100,
    sectionNet: Math.round(sectionNet * 100) / 100,
    sectionTotal
  };
}

function withLocalSectionTotals(sections, lineList) {
  const list = Array.isArray(lineList) ? lineList : [];
  const sectionIdField = linesAdapter.value.sectionIdField;
  return (Array.isArray(sections) ? sections : []).map((section) => {
    const sid = String(section?._id || '');
    const sectionLines = list.filter((l) => String(l?.[sectionIdField] || '') === sid);
    return { ...section, ...computeLocalSectionTotals(section, sectionLines) };
  });
}

function localTaxAmountOnBase(base, tax) {
  const value = Number(tax?.taxValue ?? tax?.value);
  if (!Number.isFinite(value) || value < 0) return 0;
  const tType = String(tax?.taxType || '').toUpperCase();
  if (tType === 'PERCENTAGE' || tType === 'PERCENT') {
    return (Number(base) || 0) * value / 100;
  }
  return value;
}

function buildLocalItemTaxSnapshot(taxIds, optionsById) {
  const taxes = (Array.isArray(taxIds) ? taxIds : [])
    .map((id) => {
      const opt = optionsById?.get(String(id));
      if (!opt) return null;
      return {
        taxId: String(id),
        name: opt.name || String(opt.label || '').replace(/\s*\([^)]*\)\s*$/, '') || String(id),
        taxType: opt.taxType,
        taxValue: Number(opt.taxValue),
        scope: 'ITEM',
        amount: 0
      };
    })
    .filter(Boolean);
  return {
    mode: taxes.length ? 'engine' : 'none',
    source: 'localDraft',
    side: 'SALES',
    taxes,
    calculatedAt: new Date().toISOString()
  };
}

function resolveLocalItemTaxes(line) {
  const fromSnap = Array.isArray(line?.taxSnapshot?.taxes) ? line.taxSnapshot.taxes : [];
  if (fromSnap.length) {
    return fromSnap.map((t) => ({
      taxId: String(t.taxId || t._id || ''),
      name: t.name,
      taxType: t.taxType,
      taxValue: Number(t.taxValue),
      scope: t.scope || 'ITEM'
    })).filter((t) => t.taxId);
  }
  const taxIds = Array.isArray(line?.taxIds) ? line.taxIds.map(String) : [];
  if (!taxIds.length) return [];
  const byId = new Map((itemTaxOptions.value || []).map((o) => [String(o.id), o]));
  return taxIds.map((id) => {
    const opt = byId.get(id);
    if (!opt) return null;
    return {
      taxId: id,
      name: opt.name || opt.label,
      taxType: opt.taxType,
      taxValue: Number(opt.taxValue),
      scope: 'ITEM'
    };
  }).filter(Boolean);
}

function recomputeLocalLineMoney(line) {
  const qty = Number(line?.quantity) || 0;
  const unit = lineUnitPrice(line);
  const gross = qty * unit;
  const dtype = String(line?.discountType || '').trim();
  const dval = Number(line?.discountValue) || 0;
  let discountAmount = 0;
  if (dtype === 'percent' && dval > 0) discountAmount = (gross * dval) / 100;
  else if (dtype === 'amount' && dval > 0) discountAmount = dval;
  const lineSubtotal = Math.max(0, gross - discountAmount);

  const itemTaxes = resolveLocalItemTaxes(line);
  let lineTaxTotal = 0;
  const snapshotTaxes = itemTaxes.map((tx) => {
    const amount = Math.round(localTaxAmountOnBase(lineSubtotal, tx) * 100) / 100;
    lineTaxTotal += amount;
    return { ...tx, amount };
  });
  lineTaxTotal = Math.round(lineTaxTotal * 100) / 100;

  const taxIds = snapshotTaxes.map((t) => String(t.taxId)).filter(Boolean);
  const taxSnapshot = {
    mode: snapshotTaxes.length ? 'engine' : 'none',
    source: line?.taxSnapshot?.source || 'localDraft',
    side: line?.taxSnapshot?.side || 'SALES',
    taxes: snapshotTaxes,
    calculatedAt: new Date().toISOString()
  };

  return {
    ...line,
    taxIds,
    taxSnapshot,
    discountAmount,
    lineSubtotal,
    lineTaxTotal,
    lineTotal: Math.round((lineSubtotal + lineTaxTotal) * 100) / 100
  };
}

function localTotalsFromLines(lineList, recordOverride = null) {
  const list = Array.isArray(lineList) ? lineList : [];
  const record = recordOverride || props.record || {};
  const subtotal = list.reduce((sum, l) => sum + (Number(l?.lineSubtotal) || 0), 0);
  const lineDiscountTotal = list.reduce((sum, l) => sum + (Number(l?.discountAmount) || 0), 0);
  const lineTaxTotal = list.reduce((sum, l) => sum + (Number(l?.lineTaxTotal) || 0), 0);

  const gType = String(record.globalDiscountType || '').trim();
  const gVal = Number(record.globalDiscountValue) || 0;
  let globalDiscountAmount = 0;
  if (gType === 'percent' && gVal > 0) globalDiscountAmount = (subtotal * gVal) / 100;
  else if (gType === 'amount' && gVal > 0) globalDiscountAmount = gVal;

  const afterGlobal = Math.max(0, subtotal - globalDiscountAmount);

  // Document charges from snapshot ids
  const chargeSnap = record?.chargeDocumentSnapshot?.charges || [];
  let chargesTotal = 0;
  for (const c of chargeSnap) {
    const value = Number(c.chargeValue ?? c.value);
    if (!Number.isFinite(value) || value < 0) continue;
    if (String(c.chargeType || '').toUpperCase() === 'PERCENTAGE') {
      chargesTotal += (afterGlobal * value) / 100;
    } else {
      chargesTotal += value;
    }
  }

  // Document taxes from snapshot (on after-global + charges base when percent)
  const taxSnap = record?.transactionTaxSnapshot?.taxes || [];
  let taxTotal = lineTaxTotal;
  const taxBase = afterGlobal + chargesTotal;
  for (const tx of taxSnap) {
    const value = Number(tx.taxValue ?? tx.value);
    if (!Number.isFinite(value) || value < 0) continue;
    const tType = String(tx.taxType || '').toUpperCase();
    if (tType === 'PERCENTAGE' || tType === 'PERCENT') {
      taxTotal += (taxBase * value) / 100;
    } else {
      taxTotal += value;
    }
  }

  const adjustmentTotal = Number(record.adjustmentTotal) || 0;
  const grandTotal = Math.max(0, afterGlobal + chargesTotal + taxTotal + adjustmentTotal);
  return {
    subtotal,
    lineDiscountTotal,
    globalDiscountTotal: globalDiscountAmount,
    globalDiscountAmount,
    taxTotal: Math.round(taxTotal * 100) / 100,
    chargesTotal: Math.round(chargesTotal * 100) / 100,
    adjustmentTotal,
    grandTotal: Math.round(grandTotal * 100) / 100
  };
}

function emitLocalLinesRecalc(nextLines, extras = {}) {
  const recordPatch = { ...(props.record || {}), ...(extras.record || {}) };
  const lines = (nextLines || currentLocalLines()).map((l) => recomputeLocalLineMoney(l));
  const sections = withLocalSectionTotals(
    extras.sections ?? currentLocalSections(),
    lines
  );
  emit('updated', {
    type: 'lines-recalculated',
    lines,
    sections,
    totals: localTotalsFromLines(lines, { ...recordPatch, lines, sections }),
    quote: extras.quote || null,
    ...extras.emitExtra
  });
}

const isLinesExpanded = computed(() => props.context?.expandedLeftSection === 'lines');

const { t } = useI18n();
const notifications = useNotifications();
const authStore = useAuthStore();
const cpqEntitled = computed(() => isCpqAddonEntitled(authStore.user));
const canCreateQuoteItem = computed(() => authStore.can('items', 'create'));

/** Guided CPQ configurator session while adding quote/SO lines */
const productConfigSession = ref(null);
const showItemCreateDrawer = ref(false);
const itemCreateBlockKey = ref(null);
const itemCreatePrefillText = ref('');
const itemCreateInitialData = computed(() => {
  const seed = String(itemCreatePrefillText.value || '').trim();
  return seed ? { item_name: seed } : {};
});

const lineTableHeadClass =
  'px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400';
const lineTableFootCellClass =
  'px-3 py-2.5 align-middle border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30';
const lineFormControlClass =
  'w-full h-9 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed';
const lineInputClass =
  'h-8 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed';
const lineQtyInputClass = `${lineInputClass} w-[4.5rem] text-right tabular-nums ml-auto block`;
const discountGroupClass = 'quote-lines-discount-group';
const discountGroupInputClass = 'quote-lines-discount-value';
const lineAddBarControlClass =
  '!h-8 !px-2.5 !py-1.5 !text-sm !rounded-md !bg-white dark:!bg-gray-800 !text-gray-900 dark:!text-white !outline-none ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:!ring-2 focus:!ring-indigo-500 disabled:!opacity-50 disabled:!cursor-not-allowed';
const lineAddBarSelectClass =
  '!h-8 !px-2 !py-1 !text-xs !rounded-md !bg-white dark:!bg-gray-800 !text-gray-900 dark:!text-white !outline-none ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:!ring-2 focus:!ring-indigo-500 disabled:!opacity-50 disabled:!cursor-not-allowed';
const lineAddBarQtyClass = `${lineAddBarControlClass} w-14 text-right tabular-nums shrink-0`;
const lineInlineSearchInputClass =
  `${lineAddBarControlClass} min-w-0 w-full !pl-9 !pr-3 text-left`;
const QUOTE_RECENT_VARIANTS_KEY = 'arivu:quote-recent-variants';
const QUOTE_RECENT_VARIANTS_MAX = 12;

function discountAddonLabel(type) {
  const key = String(type || '');
  if (key === 'amount') return discountCurrencySymbol.value;
  return '%';
}

const discountTypeMenuKey = ref('');
const discountTypeMenuStyle = ref({});

function isDiscountTypeMenuOpen(key) {
  return discountTypeMenuKey.value === key;
}

function toggleDiscountTypeMenu(key, event) {
  event?.stopPropagation?.();
  if (discountTypeMenuKey.value === key) {
    closeDiscountTypeMenu();
    return;
  }
  const btn = event?.currentTarget;
  if (btn?.getBoundingClientRect) {
    const rect = btn.getBoundingClientRect();
    discountTypeMenuStyle.value = {
      top: `${Math.round(rect.bottom + 4)}px`,
      left: `${Math.round(rect.right)}px`,
      transform: 'translateX(-100%)'
    };
  }
  discountTypeMenuKey.value = key;
}

function closeDiscountTypeMenu() {
  discountTypeMenuKey.value = '';
}

function chooseDiscountType(_key, type, apply) {
  apply?.(type);
  closeDiscountTypeMenu();
}

function onDiscountTypeMenuPointerDown(event) {
  if (!discountTypeMenuKey.value) return;
  if (event.target?.closest?.('[data-discount-type-root], .quote-lines-discount-type-menu')) return;
  closeDiscountTypeMenu();
}

function currencySymbolForCode(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return '$';
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalized,
      currencyDisplay: 'narrowSymbol'
    }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value || normalized;
  } catch {
    return normalized;
  }
}

const quoteId = computed(() =>
  isApiMode.value
    ? props.record?._id
    : props.draftMode
      ? `local-draft:${linesAdapter.value.moduleKey}`
      : props.record?._id
);
const { busy, overrideLock } = useQuoteLinesSession(quoteId);
const {
  showSkuColumn,
  showDiscountColumn: columnPrefsShowDiscount,
  showPricingColumns: columnPrefsShowPricing
} = useQuoteLinesColumnPrefs();
const showPricingColumns = computed(
  () => columnPrefsShowPricing.value && caps.value.pricingColumns
);
const showDiscountColumn = computed(
  () => columnPrefsShowDiscount.value && caps.value.discounts
);
/** Tax column only when editable or document already has tax amounts (PO caps exclude tax chrome). */
const showTaxColumn = computed(() => {
  if (caps.value.taxEdit) return true;
  const rows = Array.isArray(props.record?.lines) ? props.record.lines : [];
  if (rows.some((l) => Number(l?.lineTaxTotal) > 0 || (Array.isArray(l?.taxSnapshot?.taxes) && l.taxSnapshot.taxes.length > 0))) {
    return true;
  }
  if (Number(props.record?.taxTotal) > 0) return true;
  return false;
});
const showGlobalDiscountRow = computed(
  () => caps.value.globalDiscounts || Number(props.record?.globalDiscountTotal) > 0
);
const showTaxTotalsRow = computed(
  () => caps.value.taxEdit || Number(props.record?.taxTotal) > 0
);
const showCreateCatalogItemAction = computed(
  () => canCreateQuoteItem.value && caps.value.createCatalogItem
);

const showDeleteLineModal = ref(false);
const linePendingDelete = ref(null);
const workspacePanelRef = ref(null);

const lines = computed(() => (Array.isArray(props.record?.lines) ? props.record.lines : []));
const quoteSections = computed(() => sortQuoteSections(props.record?.sections));
const hasSections = computed(() => quoteSections.value.length > 0);

const sectionBlocks = computed(() => {
  const adapter = linesAdapter.value;
  const blocks = buildQuoteSectionBlocks({
    lines: lines.value,
    sections: quoteSections.value,
    uncategorizedTitle: t('records.quoteSectionUncategorized'),
    sectionFkKey: adapter.sectionIdField,
    sectionUuidField: adapter.sectionUuidField,
    lineIdField: adapter.lineIdField,
    includeInTotalField: adapter.includeInTotalField || 'includeInQuoteTotal'
  });
  if (!props.draftMode) return blocks;
  return blocks.map((block) => {
    if (!block?.section) return block;
    const sectionLines = (block.rows || []).map((r) => r.line).filter(Boolean);
    return {
      ...block,
      section: { ...block.section, ...computeLocalSectionTotals(block.section, sectionLines) }
    };
  });
});

const movableSectionKeys = ref([]);

watch(
  () => sectionBlocks.value.filter((b) => !b.isOrphan && b.section).map((b) => b.key),
  (keys) => {
    if (!keys.length) {
      movableSectionKeys.value = [];
      return;
    }
    if (!movableSectionKeys.value.length || keys.length !== movableSectionKeys.value.length) {
      movableSectionKeys.value = keys;
      return;
    }
    const keySet = new Set(keys);
    movableSectionKeys.value = [
      ...movableSectionKeys.value.filter((k) => keySet.has(k)),
      ...keys.filter((k) => !movableSectionKeys.value.includes(k))
    ];
  },
  { immediate: true }
);

const displaySectionBlocks = computed(() => {
  const byKey = new Map(sectionBlocks.value.map((b) => [b.key, b]));
  const ordered = movableSectionKeys.value.map((k) => byKey.get(k)).filter(Boolean);
  const orphan = sectionBlocks.value.find((b) => b.isOrphan);
  return orphan ? [...ordered, orphan] : ordered.length ? ordered : sectionBlocks.value;
});

const canReorderSections = computed(
  () =>
    linesEditable.value &&
    caps.value.sectionReorder &&
    movableSectionKeys.value.length > 1
);

const { stickyColumnsActive } = useQuoteLinesStickyColumns(
  () => workspacePanelRef.value,
  [showPricingColumns, showSkuColumn, showDiscountColumn, showTaxColumn, sectionBlocks, isLinesExpanded]
);

function onQuoteLinesTableScroll(event) {
  updateQuoteLinesTableScrollHints(event.currentTarget);
}

const movableSections = computed(() => quoteSections.value.filter((s) => s?._id));
function sectionRef(section) {
  return commercialSectionRef(linesAdapter.value, section);
}

function lineSectionRef(line) {
  const sid = commercialLineSectionRef(linesAdapter.value, line);
  if (!sid) return '';
  const match = quoteSections.value.find(
    (s) =>
      String(s._id) === String(sid) ||
      String(s[linesAdapter.value.sectionUuidField] || '') === String(sid)
  );
  return match ? sectionRef(match) : String(sid);
}

const draftRowsMap = ref({});

function createDraftRowState() {
  return {
    searchQuery: '',
    searchResults: [],
    searchLoading: false,
    searchOpen: false,
    searchHighlight: -1,
    committing: false
  };
}

function draftRow(block) {
  return draftRowsMap.value[block?.key];
}

function hasDraftRow(blockKey) {
  return Boolean(draftRowsMap.value[blockKey]);
}

function ensureDraftRow(block) {
  if (!linesEditable.value || isReorderDragging.value || !block?.key) return;
  if (hasDraftRow(block.key)) return;
  draftRowsMap.value = { ...draftRowsMap.value, [block.key]: createDraftRowState() };
}

function startDraftRow(block) {
  if (!linesEditable.value || isReorderDragging.value) return;
  const key = block.key;
  if (hasDraftRow(key)) {
    focusDraftSearch(block);
    openDraftSearchWithRecent(block);
    return;
  }
  draftRowsMap.value = { ...draftRowsMap.value, [key]: createDraftRowState() };
  activeAddBlockKey.value = key;
  openDraftSearchWithRecent(block);
  focusDraftSearch(block);
}

function clearDraftRow(blockKey) {
  const next = { ...draftRowsMap.value };
  delete next[blockKey];
  draftRowsMap.value = next;
}

/** Keep the inline add row after a successful line add so the next product is one search away. */
function resetDraftRowForNextAdd(block) {
  if (!linesEditable.value || isReorderDragging.value || !block?.key) return;
  draftRowsMap.value = { ...draftRowsMap.value, [block.key]: createDraftRowState() };
  activeAddBlockKey.value = block.key;
}

function focusDraftSearch(block) {
  const key = String(block?.key || '');
  if (!key) return;
  requestAnimationFrame(() => {
    const el = workspacePanelRef.value?.querySelector(`[data-quote-draft-search="${key}"]`);
    if (el && typeof el.focus === 'function') {
      el.focus();
    }
  });
}

const inlineSearchTimers = {};
const pendingDraftCommits = new Set();
const variantPickerBlockKey = ref(null);
const bundlePickerBlockKey = ref(null);
const activeAddBlockKey = ref('');

const sectionRowsMap = ref({});
const isReorderDragging = ref(false);
const dragStartSectionByLineId = ref({});
const activeDropSectionKey = ref(null);

const canCrossSectionDrag = computed(
  () =>
    linesEditable.value &&
    caps.value.lineReorder &&
    hasSections.value &&
    movableSections.value.length > 1
);

function dragGroupForBlock(block) {
  if (!canCrossSectionDrag.value) return undefined;
  return {
    name: 'quote-lines',
    pull: true,
    put: !block?.isOrphan
  };
}

function isLineDragDisabled(line) {
  return String(line?.lineType || '') === 'bundle_component';
}

function isDroppableSectionBlock(block) {
  return canCrossSectionDrag.value && Boolean(block?.section) && !block?.isOrphan;
}

function sectionBlockDropClass(block) {
  if (!isReorderDragging.value || !isDroppableSectionBlock(block)) return '';
  if (activeDropSectionKey.value === block.key) {
    return 'quote-section-block--drop-active';
  }
  return 'quote-section-block--drop-highlight';
}

function sectionHeaderDropClass(block) {
  if (!isReorderDragging.value || !isDroppableSectionBlock(block)) return '';
  if (activeDropSectionKey.value === block.key) {
    return 'quote-section-header--drop-active';
  }
  return 'quote-section-header--drop-highlight';
}

function blockSectionRef(block) {
  if (!block?.section || block.isOrphan) return null;
  return sectionRef(block.section);
}

function snapshotLineSectionKeys() {
  const snapshot = {};
  for (const block of sectionBlocks.value) {
    for (const row of getSectionRows(block.key) || []) {
      const id = lineRowKey(row.line);
      if (id) snapshot[id] = block.key;
    }
  }
  return snapshot;
}

function collectSectionMoves() {
  if (!canCrossSectionDrag.value) return [];
  const moves = [];
  for (const block of sectionBlocks.value) {
    const targetSectionRef = blockSectionRef(block);
    if (!targetSectionRef) continue;

    for (const row of getSectionRows(block.key) || []) {
      if (isLineDragDisabled(row.line)) continue;
      const id = lineRowKey(row.line);
      const fromKey = dragStartSectionByLineId.value[id];
      if (!fromKey || fromKey === block.key) continue;
      moves.push({ line: row.line, targetSectionRef });
    }
  }
  return moves;
}

function onLineOrderChange(blockKey, evt) {
  if (evt?.added) {
    activeDropSectionKey.value = blockKey;
  }
}

function getSectionRows(key) {
  return sectionRowsMap.value[key] || [];
}

function buildSectionRowsFromBlockRows(blockRows) {
  const seen = new Set();
  const rows = [];
  for (const row of blockRows || []) {
    const uid = lineRowKey(row?.line);
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    rows.push({ ...row, uid });
  }
  return rows;
}

function setSectionRows(key, rows) {
  // vuedraggable echoes @update:model-value when the parent replaces model-value after
  // add/delete — only accept local row mutations while the user is actively dragging.
  if (!isReorderDragging.value) return;
  const seen = new Set();
  const deduped = [];
  for (const row of rows || []) {
    const uid = row?.uid || lineRowKey(row?.line);
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    deduped.push({ ...row, uid });
  }
  sectionRowsMap.value = { ...sectionRowsMap.value, [key]: deduped };
}

watch(
  sectionBlocks,
  (blocks) => {
    if (isReorderDragging.value) return;
    const next = {};
    for (const block of blocks) {
      next[block.key] = buildSectionRowsFromBlockRows(block.rows);
    }
    sectionRowsMap.value = next;
  },
  { immediate: true, deep: true }
);

const showSectionModal = ref(false);
const sectionModalMode = ref('create');
const sectionModalInitial = ref(null);
const sectionModalEditingId = ref(null);

function openCreateSection() {
  sectionModalMode.value = 'create';
  sectionModalInitial.value = null;
  sectionModalEditingId.value = null;
  showSectionModal.value = true;
}

function openEditSection(section) {
  sectionModalMode.value = 'edit';
  const includeField = linesAdapter.value.includeInTotalField || 'includeInQuoteTotal';
  sectionModalInitial.value = {
    ...section,
    includeInQuoteTotal: section?.[includeField] !== false
  };
  sectionModalEditingId.value = sectionRef(section);
  showSectionModal.value = true;
}

function closeSectionModal() {
  showSectionModal.value = false;
  sectionModalInitial.value = null;
  sectionModalEditingId.value = null;
}

function emitSectionsUpdated(payload) {
  if (!props.draftMode || isApiMode.value) {
    emit('updated', {
      type: 'sections-updated',
      sections: payload?.sections ?? null,
      totals: payload?.totals ?? null,
      lines: payload?.lines ?? null
    });
    return;
  }
  const lines = Array.isArray(payload?.lines) ? payload.lines : currentLocalLines();
  const pricedLines = lines.map((l) => recomputeLocalLineMoney(l));
  const sections = Array.isArray(payload?.sections)
    ? withLocalSectionTotals(payload.sections, pricedLines)
    : payload?.sections ?? null;
  const totals = payload?.totals ?? (Array.isArray(sections)
    ? localTotalsFromLines(pricedLines, {
        ...(props.record || {}),
        lines: pricedLines,
        sections
      })
    : null);
  emit('updated', {
    type: 'sections-updated',
    sections,
    totals,
    lines: payload?.lines ?? null
  });
}

function isFirstMovableSection(block) {
  return movableSectionKeys.value[0] === block?.key;
}

function isLastMovableSection(block) {
  return movableSectionKeys.value[movableSectionKeys.value.length - 1] === block?.key;
}

async function persistSectionOrder() {
  if (!canReorderSections.value || !caps.value.sectionReorder) return;
  if (isApiMode.value && !recordApiId.value) return;

  if (!isApiMode.value) {
    const byKey = new Map(sectionBlocks.value.map((b) => [b.key, b]));
    const nextSections = movableSectionKeys.value.map((key, idx) => {
      const block = byKey.get(key);
      return { ...block.section, sectionOrder: idx };
    }).filter(Boolean);
    emitSectionsUpdated({
      sections: nextSections,
      totals: localTotalsFromLines(currentLocalLines())
    });
    return;
  }

  busy.value = true;
  try {
    const byKey = new Map(sectionBlocks.value.map((b) => [b.key, b]));
    const sectionIdField = linesAdapter.value.sectionIdField;
    const orders = movableSectionKeys.value.map((key, idx) => {
      const block = byKey.get(key);
      return {
        [sectionIdField]: sectionRef(block.section),
        sectionOrder: idx
      };
    });
    const res = await apiClient.patch(`${documentRecordBase.value}/sections/reorder`, {
      orders,
      overridePricing: overrideLock.value === true
    });
    if (!res?.success) throw new Error(res?.message || t('records.quoteSectionReorderFailed'));
    emitSectionsUpdated({ sections: res?.data?.sections ?? null });
  } catch (e) {
    notifications.error(e?.message || t('records.quoteSectionReorderFailed'));
    movableSectionKeys.value = sectionBlocks.value
      .filter((b) => !b.isOrphan && b.section)
      .map((b) => b.key);
  } finally {
    busy.value = false;
  }
}

async function moveSectionByDelta(block, delta) {
  if (!canReorderSections.value || block?.isOrphan) return;
  const keys = [...movableSectionKeys.value];
  const idx = keys.indexOf(block.key);
  if (idx < 0) return;
  const nextIdx = idx + delta;
  if (nextIdx < 0 || nextIdx >= keys.length) return;
  keys.splice(idx, 1);
  keys.splice(nextIdx, 0, block.key);
  movableSectionKeys.value = keys;
  await persistSectionOrder();
}

async function submitSectionModal(form) {
  if (!props.record?._id && !props.draftMode) return;
  const includeField = linesAdapter.value.includeInTotalField || 'includeInQuoteTotal';

  if (!isApiMode.value) {
    if (sectionModalMode.value === 'create') {
      const sid = nextLocalDraftId('local-sec');
      const created = {
        _id: sid,
        [linesAdapter.value.sectionUuidField]: sid,
        sectionTitle: form.sectionTitle,
        sectionType: form.sectionType,
        [includeField]: form.includeInQuoteTotal !== false,
        sectionOrder: currentLocalSections().length,
        sectionTotal: 0
      };
      emitSectionsUpdated({
        sections: sortQuoteSections([...currentLocalSections(), created]),
        totals: localTotalsFromLines(currentLocalLines())
      });
    } else {
      const id = String(sectionModalEditingId.value || '');
      const next = currentLocalSections().map((s) => {
        if (sectionRef(s) !== id && String(s._id) !== id) return s;
        return {
          ...s,
          sectionTitle: form.sectionTitle,
          sectionType: form.sectionType,
          [includeField]: form.includeInQuoteTotal !== false
        };
      });
      emitSectionsUpdated({
        sections: sortQuoteSections(next),
        totals: localTotalsFromLines(currentLocalLines())
      });
    }
    closeSectionModal();
    return;
  }

  busy.value = true;
  try {
    const body = {
      sectionTitle: form.sectionTitle,
      sectionType: form.sectionType,
      [includeField]: form.includeInQuoteTotal !== false
    };
    if (linesAdapter.value.kind === 'quote') {
      body.overridePricing = overrideLock.value === true;
    }
    if (sectionModalMode.value === 'create') {
      const res = await apiClient.post(`${documentRecordBase.value}/sections`, body);
      if (!res?.success) throw new Error(res?.message || t('records.quoteSectionCreateFailed'));
      const created = res?.data?.section;
      const merged = created
        ? sortQuoteSections([...quoteSections.value, created])
        : res?.data?.sections ?? null;
      emitSectionsUpdated({
        sections: merged,
        totals: res?.data?.totals ?? null
      });
    } else {
      const id = sectionModalEditingId.value;
      const res = await apiClient.patch(`${documentRecordBase.value}/sections/${id}`, body);
      if (!res?.success) throw new Error(res?.message || t('records.quoteSectionUpdateFailed'));
      emitSectionsUpdated({
        sections: res?.data?.sections ?? null,
        totals: res?.data?.totals ?? null
      });
    }
    closeSectionModal();
  } catch (e) {
    notifications.error(e?.message || t('records.quoteSectionUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

async function deleteSection(section) {
  if ((!props.record?._id && !props.draftMode) || !section) return;

  if (!isApiMode.value) {
    const delRef = sectionRef(section);
    const sectionIdField = linesAdapter.value.sectionIdField;
    const remaining = currentLocalSections().filter((s) => sectionRef(s) !== delRef);
    const fallback = remaining[0] ? sectionRef(remaining[0]) : null;
    const nextLines = currentLocalLines().map((l) => {
      if (String(l?.[sectionIdField] || '') !== String(delRef)) return l;
      return { ...l, [sectionIdField]: fallback };
    });
    emitSectionsUpdated({
      sections: remaining,
      lines: nextLines
    });
    return;
  }

  busy.value = true;
  try {
    const res = await apiClient.delete(`${documentRecordBase.value}/sections/${sectionRef(section)}`, {
      data: { overridePricing: overrideLock.value === true }
    });
    if (!res?.success) throw new Error(res?.message || t('records.quoteSectionDeleteFailed'));
    emitSectionsUpdated({
      sections: res?.data?.sections ?? null,
      totals: res?.data?.totals ?? null
    });
  } catch (e) {
    notifications.error(e?.message || t('records.quoteSectionDeleteFailed'));
  } finally {
    busy.value = false;
  }
}

async function toggleSectionInclude(section, checked) {
  if (!section || !caps.value.optionalSections) return;
  if (isApiMode.value && !recordApiId.value) return;

  const includeField = linesAdapter.value.includeInTotalField || 'includeInQuoteTotal';
  if (!isApiMode.value) {
    const refId = sectionRef(section);
    const next = currentLocalSections().map((s) =>
      sectionRef(s) === refId ? { ...s, [includeField]: checked === true } : s
    );
    emitSectionsUpdated({
      sections: next,
      totals: localTotalsFromLines(currentLocalLines())
    });
    return;
  }

  busy.value = true;
  try {
    const body = {
      [includeField]: checked === true
    };
    if (linesAdapter.value.kind === 'quote') {
      body.overridePricing = overrideLock.value === true;
    }
    const res = await apiClient.patch(`${documentRecordBase.value}/sections/${sectionRef(section)}`, body);
    if (!res?.success) throw new Error(res?.message || t('records.quoteSectionUpdateFailed'));
    emitSectionsUpdated({
      sections: res?.data?.sections ?? null,
      totals: res?.data?.totals ?? null
    });
  } catch (e) {
    notifications.error(e?.message || t('records.quoteSectionUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

function sectionDiscountType(section) {
  return normalizeDiscountType(section?.sectionDiscountType) || 'percent';
}

function sectionDiscountValue(section) {
  return Number(section?.sectionDiscountValue) || 0;
}

function sectionDiscountInputValue(section) {
  const raw = Number(section?.sectionDiscountValue);
  if (!normalizeDiscountType(section?.sectionDiscountType) || !Number.isFinite(raw) || raw === 0) return '';
  return String(raw);
}

/** Keep discount fields numeric (digits + one decimal point). */
function sanitizeDiscountInputEvent(event) {
  const el = event?.target;
  if (!el || typeof el.value !== 'string') return;
  const raw = el.value;
  let next = raw.replace(/[^\d.]/g, '');
  const dot = next.indexOf('.');
  if (dot !== -1) {
    next = `${next.slice(0, dot + 1)}${next.slice(dot + 1).replace(/\./g, '')}`;
  }
  if (next === raw) return;
  const start = el.selectionStart;
  el.value = next;
  if (typeof start === 'number') {
    const pos = Math.max(0, start - (raw.length - next.length));
    el.setSelectionRange(pos, pos);
  }
}

async function saveSectionDiscount(section, patch = {}) {
  if (!linesEditable.value || !section || !caps.value.sectionDiscounts) return;
  if (isApiMode.value && !recordApiId.value) return;

  let nextType = patch.type !== undefined ? String(patch.type || '') : sectionDiscountType(section);
  let nextValue = patch.value !== undefined ? Number(patch.value) : sectionDiscountValue(section);

  if (patch.value !== undefined) {
    const raw = String(patch.value ?? '').trim();
    if (raw === '') {
      nextType = '';
      nextValue = 0;
    } else {
      nextValue = Number(raw);
      nextType = normalizeDiscountType(nextType) || 'percent';
    }
  } else {
    nextType = normalizeDiscountType(nextType) || 'percent';
  }

  if (nextType && (!Number.isFinite(nextValue) || nextValue < 0)) return;

  if (!isApiMode.value) {
    const refId = sectionRef(section);
    const next = currentLocalSections().map((s) =>
      sectionRef(s) === refId
        ? {
            ...s,
            sectionDiscountType: nextType || null,
            sectionDiscountValue: nextType ? nextValue : 0
          }
        : s
    );
    emitSectionsUpdated({
      sections: next,
      totals: localTotalsFromLines(currentLocalLines())
    });
    return;
  }

  busy.value = true;
  try {
    const res = await apiClient.patch(
      `${documentRecordBase.value}/sections/${sectionRef(section)}/discounts`,
      {
        sectionDiscountType: nextType || null,
        sectionDiscountValue: nextType ? nextValue : 0,
        overridePricing: overrideLock.value === true
      }
    );
    if (!res?.success) throw new Error(res?.message || t('records.quoteSectionDiscountUpdateFailed'));
    emitSectionsUpdated({
      sections: res?.data?.sections ?? null,
      totals: res?.data?.totals ?? null
    });
  } catch (e) {
    notifications.error(e?.message || t('records.quoteSectionDiscountUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

async function patchLineSection(line, targetSectionRef) {
  if (!isApiMode.value) {
    if (!lineApiId(line) || !targetSectionRef) return;
    const sectionIdField = linesAdapter.value.sectionIdField;
    const updated = { ...line, [sectionIdField]: targetSectionRef };
    const nextLines = currentLocalLines().map((l) =>
      lineApiId(l) === lineApiId(line) ? updated : l
    );
    emit('updated', {
      type: 'line-updated',
      line: updated,
      lines: nextLines,
      totals: localTotalsFromLines(nextLines)
    });
    return;
  }

  const body = {
    ...linesAdapter.value.buildPatchLineBody({ sectionRef: targetSectionRef }),
    overridePricing: overrideLock.value === true
  };
  const res = await apiClient.patch(
    `${documentRecordBase.value}/lines/${lineApiId(line)}`,
    body
  );
  if (!res?.success || !res?.data?.line) {
    throw new Error(res?.message || t('records.linesUpdateFailed'));
  }
  return res.data;
}

function lineApiId(line) {
  return commercialLineId(linesAdapter.value, line);
}

async function moveLineToSection(line, targetSectionRef) {
  if (!linesEditable.value || !lineApiId(line) || !targetSectionRef) return;
  if (isApiMode.value && !recordApiId.value) return;
  if (lineSectionRef(line) === targetSectionRef) return;

  if (!isApiMode.value) {
    await patchLineSection(line, targetSectionRef);
    return;
  }

  busy.value = true;
  try {
    const data = await patchLineSection(line, targetSectionRef);
    emit('updated', {
      type: 'line-updated',
      line: data.line,
      ...mutationPayload(data)
    });
  } catch (e) {
    notifications.error(e?.message || t('records.linesUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

function mutationPayload(data) {
  return {
    totals: data?.totals ?? null,
    sections: data?.sections ?? null
  };
}

const currencyCode = computed(() => String(props.record?.currency || '').trim().toUpperCase());
const discountCurrencySymbol = computed(() => currencySymbolForCode(currencyCode.value));
const discountTypeOptions = computed(() => [
  { value: 'percent', label: '%' },
  { value: 'amount', label: discountCurrencySymbol.value }
]);

function lineRowKey(line) {
  return commercialLineId(linesAdapter.value, line);
}

const tableColspan = computed(() => {
  let n = 1; // name
  if (showSkuColumn.value) n += 1;
  if (showPricingColumns.value) n += 2;
  n += 2; // qty, unit price
  if (linesEditable.value && showDiscountColumn.value) n += 1;
  if (showTaxColumn.value) n += 1;
  n += 1; // total
  if (linesEditable.value) n += 1; // actions
  return n;
});

/** Draft search sits in Name only; middle columns are empty spacers. */
const draftSearchMiddleColspan = computed(() => Math.max(1, tableColspan.value - 3));

/** Add-line footer: name[+sku] (sticky) + scrollable middle + total + actions (sticky). */
const addActionsLeadingColspan = computed(() => (showSkuColumn.value ? 2 : 1));
const addActionsMiddleColspan = computed(() => tableColspan.value - addActionsLeadingColspan.value - 2);

const globalDiscountType = ref('percent');
const globalDiscountValue = ref(0);

watch(
  () => [props.record?.globalDiscountType, props.record?.globalDiscountValue],
  ([type, value]) => {
    if (busy.value) return;
    globalDiscountType.value = normalizeGlobalDiscountType(type) || 'percent';
    globalDiscountValue.value = Number(value) || 0;
  },
  { immediate: true }
);

function normalizeDiscountType(rawType) {
  const t = String(rawType || '').trim().toLowerCase();
  if (t === 'percent' || t === 'percentage') return 'percent';
  if (t === 'amount' || t === 'fixed') return 'amount';
  return '';
}

function normalizeGlobalDiscountType(rawType) {
  return normalizeDiscountType(rawType);
}

const discountValuePlaceholder = '—';

function lineDiscountType(line) {
  return normalizeDiscountType(line?.discountType) || 'percent';
}

function lineDiscountValue(line) {
  return Number(line?.discountValue) || 0;
}

function lineDiscountInputValue(line) {
  const raw = Number(line?.discountValue);
  if (!normalizeDiscountType(line?.discountType) || !Number.isFinite(raw) || raw === 0) return '';
  return String(raw);
}

async function patchLineDiscount(line, patch = {}) {
  if (!linesEditable.value || !lineApiId(line) || !caps.value.discounts) return;
  if (isApiMode.value && !recordApiId.value) return;

  let nextType = patch.type !== undefined ? String(patch.type || '') : lineDiscountType(line);
  let nextValue = patch.value !== undefined ? Number(patch.value) : lineDiscountValue(line);

  if (patch.value !== undefined) {
    const raw = String(patch.value ?? '').trim();
    if (raw === '') {
      nextType = '';
      nextValue = 0;
    } else {
      nextValue = Number(raw);
      nextType = normalizeDiscountType(nextType) || 'percent';
    }
  } else {
    nextType = normalizeDiscountType(nextType) || 'percent';
  }

  if (nextType && (!Number.isFinite(nextValue) || nextValue < 0)) return;

  if (!isApiMode.value) {
    const updated = recomputeLocalLineMoney({
      ...line,
      discountType: nextType || null,
      discountValue: nextType ? nextValue : 0
    });
    const nextLines = (Array.isArray(props.record?.lines) ? props.record.lines : []).map((l) =>
      lineApiId(l) === lineApiId(line) ? updated : l
    );
    emit('updated', {
      type: 'line-updated',
      line: updated,
      lines: nextLines,
      totals: localTotalsFromLines(nextLines)
    });
    return;
  }

  busy.value = true;
  try {
    const body = {
      ...linesAdapter.value.buildPatchLineBody({
        discountType: nextType || null,
        discountValue: nextType ? nextValue : 0
      }),
      overridePricing: overrideLock.value === true
    };
    const res = await apiClient.patch(`${documentRecordBase.value}/lines/${lineApiId(line)}`, body);
    if (res?.success && res?.data?.line) {
      emit('updated', {
        type: 'line-updated',
        line: res.data.line,
        ...mutationPayload(res.data)
      });
    } else {
      notifications.error(res?.message || t('records.linesDiscountUpdateFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesDiscountUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

const openDocTaxes = ref(false);
const openDocCharges = ref(false);
const docTaxesPopoverStyle = ref({});
const docChargesPopoverStyle = ref({});
const docTaxOptions = ref([]);
const docChargeOptions = ref([]);
const itemTaxOptions = ref([]);
const docTaxIds = ref([]);
const docChargeIds = ref([]);
const docTaxesLoading = ref(false);
const docChargesLoading = ref(false);
const docTaxesLoadError = ref('');
const docChargesLoadError = ref('');

const DOC_PICKER_WIDTH = 320;
const DOC_PICKER_EST_HEIGHT = 280;

function positionDocPicker(event) {
  const btn = event?.currentTarget;
  if (!btn?.getBoundingClientRect) return {};
  const rect = btn.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(8, Math.min(Math.round(rect.left), vw - DOC_PICKER_WIDTH - 8));
  const spaceAbove = rect.top;
  const spaceBelow = vh - rect.bottom;
  const openAbove = spaceAbove >= Math.min(DOC_PICKER_EST_HEIGHT, 200) || spaceAbove > spaceBelow;
  if (openAbove) {
    return {
      left: `${left}px`,
      bottom: `${Math.round(vh - rect.top + 4)}px`,
      top: 'auto'
    };
  }
  return {
    left: `${left}px`,
    top: `${Math.round(rect.bottom + 4)}px`,
    bottom: 'auto'
  };
}

function closeDocPickers() {
  openDocTaxes.value = false;
  openDocCharges.value = false;
}

function onDocPickerPointerDown(event) {
  if (!openDocTaxes.value && !openDocCharges.value) return;
  if (
    event.target?.closest?.(
      '[data-doc-tax-root], [data-doc-charge-root], [data-doc-taxes-popover], [data-doc-charges-popover]'
    )
  ) {
    return;
  }
  closeDocPickers();
}

function onDocPickerRepositionClose() {
  if (openDocTaxes.value || openDocCharges.value) closeDocPickers();
}

function toggleDocId(listRef, id, checked) {
  const idStr = String(id);
  const next = Array.isArray(listRef.value) ? [...listRef.value] : [];
  const idx = next.indexOf(idStr);
  if (checked) {
    if (idx < 0) next.push(idStr);
  } else if (idx >= 0) {
    next.splice(idx, 1);
  }
  listRef.value = next;
}

function toggleDocTaxId(id, checked) {
  toggleDocId(docTaxIds, id, checked);
}

function toggleDocChargeId(id, checked) {
  toggleDocId(docChargeIds, id, checked);
}

function unwrapApiList(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
}

function formatTaxOptionLabel(row) {
  const name = row?.name || '';
  const value = row?.taxValue;
  if (row?.taxType === 'FIXED_AMOUNT') return `${name} (${value})`;
  return `${name} (${value}%)`;
}

function formatChargeOptionLabel(row) {
  const name = row?.name || '';
  const value = row?.chargeValue;
  if (row?.chargeType === 'PERCENTAGE') return `${name} (${value}%)`;
  return `${name} (${value})`;
}

function snapshotTaxIds() {
  if (Array.isArray(props.record?._localTransactionTaxIds)) {
    return props.record._localTransactionTaxIds.map(String).filter(Boolean);
  }
  const taxSnap = props.record?.transactionTaxSnapshot?.taxes || [];
  return taxSnap.map((x) => String(x.taxId || '')).filter(Boolean);
}

function snapshotChargeIds() {
  if (Array.isArray(props.record?._localTransactionChargeIds)) {
    return props.record._localTransactionChargeIds.map(String).filter(Boolean);
  }
  const chargeSnap = props.record?.chargeDocumentSnapshot?.charges || [];
  return chargeSnap.map((x) => String(x.chargeId || '')).filter(Boolean);
}

const docChargesPreviewTotal = computed(() => {
  const selected = new Set((docChargeIds.value || []).map(String));
  if (!selected.size) return 0;
  const base = (lines.value || []).reduce(
    (sum, line) => sum + (Number(line?.lineSubtotal) || 0),
    0
  );
  let total = 0;
  for (const opt of docChargeOptions.value || []) {
    if (!selected.has(String(opt.id))) continue;
    const value = Number(opt.chargeValue);
    if (!Number.isFinite(value) || value < 0) continue;
    if (opt.chargeType === 'PERCENTAGE') {
      total += (base * value) / 100;
    } else {
      total += value;
    }
  }
  return Math.round(total * 100) / 100;
});

async function patchLineTaxes(line, taxIds = []) {
  if (!linesEditable.value || !lineApiId(line) || !caps.value.taxEdit) return;
  if (isApiMode.value && !recordApiId.value) return;

  if (!isApiMode.value) {
    await ensureItemTaxOptions();
    const ids = Array.isArray(taxIds) ? taxIds.map(String) : [];
    const byId = new Map((itemTaxOptions.value || []).map((o) => [String(o.id), o]));
    const taxSnapshot = buildLocalItemTaxSnapshot(ids, byId);
    const updated = recomputeLocalLineMoney({
      ...line,
      taxIds: ids,
      taxSnapshot
    });
    const nextLines = currentLocalLines().map((l) =>
      lineApiId(l) === lineApiId(line) ? updated : l
    );
    emitLocalLinesRecalc(nextLines);
    return;
  }

  busy.value = true;
  try {
    const body = {
      ...linesAdapter.value.buildPatchLineBody({
        taxIds: Array.isArray(taxIds) ? taxIds : []
      }),
      overridePricing: overrideLock.value === true
    };
    const res = await apiClient.patch(`${documentRecordBase.value}/lines/${lineApiId(line)}`, body);
    if (res?.success && res?.data?.line) {
      emit('updated', {
        type: 'line-updated',
        line: res.data.line,
        ...mutationPayload(res.data)
      });
    } else {
      notifications.error(res?.message || t('records.linesTaxUpdateFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesTaxUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

async function saveDocumentTaxesCharges({ transactionTaxIds, transactionChargeIds }) {
  if (!linesEditable.value || !caps.value.taxesCharges) return false;
  if (isApiMode.value && !recordApiId.value) return false;

  if (!isApiMode.value) {
    const taxOptsById = new Map((docTaxOptions.value || []).map((o) => [String(o.id), o]));
    const chargeOptsById = new Map((docChargeOptions.value || []).map((o) => [String(o.id), o]));
    const taxes = (transactionTaxIds || []).map((id) => {
      const opt = taxOptsById.get(String(id));
      return {
        taxId: String(id),
        taxType: opt?.taxType,
        taxValue: opt?.taxValue,
        label: opt?.label
      };
    });
    const charges = (transactionChargeIds || []).map((id) => {
      const opt = chargeOptsById.get(String(id));
      return {
        chargeId: String(id),
        chargeType: opt?.chargeType,
        chargeValue: opt?.chargeValue,
        label: opt?.label
      };
    });
    const quotePatch = {
      transactionTaxSnapshot: { taxes },
      chargeDocumentSnapshot: { charges },
      _localTransactionTaxIds: (transactionTaxIds || []).map(String),
      _localTransactionChargeIds: (transactionChargeIds || []).map(String)
    };
    const lines = currentLocalLines().map((l) => recomputeLocalLineMoney(l));
    emit('updated', {
      type: 'quote-taxes-charges-updated',
      quote: quotePatch,
      lines,
      totals: localTotalsFromLines(lines, { ...props.record, ...quotePatch, lines })
    });
    return true;
  }

  busy.value = true;
  try {
    const res = await apiClient.patch(`${documentRecordBase.value}/taxes-charges`, {
      overridePricing: overrideLock.value === true,
      transactionTaxIds,
      transactionChargeIds
    });
    if (res?.success) {
      emit('updated', {
        type: 'quote-taxes-charges-updated',
        quote: res?.data?.quote ?? res?.data?.salesOrder ?? res?.data?.invoice ?? null,
        lines: res?.data?.lines ?? null,
        ...mutationPayload(res.data)
      });
      return true;
    }
    notifications.error(res?.message || t('records.linesTaxUpdateFailed'));
    return false;
  } catch (e) {
    notifications.error(e?.message || t('records.linesTaxUpdateFailed'));
    return false;
  } finally {
    busy.value = false;
  }
}

async function loadDocTaxOptions() {
  docTaxesLoadError.value = '';
  docTaxesLoading.value = true;
  try {
    const taxesRes = await apiClient.get('/taxes', {
      params: { scope: 'TRANSACTION', applicableOn: isPurchaseOrderLines.value ? 'PURCHASE' : 'SALES' }
    });
    docTaxOptions.value = unwrapApiList(taxesRes).map((r) => ({
      id: String(r._id),
      label: formatTaxOptionLabel(r),
      taxType: r.taxType,
      taxValue: Number(r.taxValue)
    }));
  } catch (err) {
    docTaxOptions.value = [];
    docTaxesLoadError.value =
      err?.response?.data?.message || err?.message || t('records.linesDocTaxesChargesLoadFailed');
  } finally {
    docTaxesLoading.value = false;
  }
}

async function ensureItemTaxOptions() {
  if (itemTaxOptions.value.length) return itemTaxOptions.value;
  try {
    const taxesRes = await apiClient.get('/taxes', {
      params: { scope: 'ITEM', applicableOn: isPurchaseOrderLines.value ? 'PURCHASE' : 'SALES' }
    });
    itemTaxOptions.value = unwrapApiList(taxesRes).map((r) => ({
      id: String(r._id),
      name: r.name,
      label: formatTaxOptionLabel(r),
      taxType: r.taxType,
      taxValue: Number(r.taxValue)
    }));
  } catch {
    itemTaxOptions.value = [];
  }
  return itemTaxOptions.value;
}

async function loadDocChargeOptions() {
  docChargesLoadError.value = '';
  docChargesLoading.value = true;
  try {
    const chargesRes = await apiClient.get('/charges', {
      params: { scope: 'TRANSACTION', applicableOn: isPurchaseOrderLines.value ? 'PURCHASE' : 'SALES' }
    });
    docChargeOptions.value = unwrapApiList(chargesRes).map((r) => ({
      id: String(r._id),
      label: formatChargeOptionLabel(r),
      chargeType: r.chargeType,
      chargeValue: Number(r.chargeValue)
    }));
  } catch (err) {
    docChargeOptions.value = [];
    docChargesLoadError.value =
      err?.response?.data?.message || err?.message || t('records.linesDocTaxesChargesLoadFailed');
  } finally {
    docChargesLoading.value = false;
  }
}

async function openDocTaxesPicker(event) {
  event?.stopPropagation?.();
  if (openDocTaxes.value) {
    openDocTaxes.value = false;
    return;
  }
  openDocCharges.value = false;
  docTaxIds.value = snapshotTaxIds();
  docTaxesPopoverStyle.value = positionDocPicker(event);
  openDocTaxes.value = true;
  await loadDocTaxOptions();
}

async function openDocChargesPicker(event) {
  event?.stopPropagation?.();
  if (openDocCharges.value) {
    openDocCharges.value = false;
    return;
  }
  openDocTaxes.value = false;
  docChargeIds.value = snapshotChargeIds();
  docChargesPopoverStyle.value = positionDocPicker(event);
  openDocCharges.value = true;
  await loadDocChargeOptions();
}

async function persistDocTaxes() {
  const ok = await saveDocumentTaxesCharges({
    transactionTaxIds: [...docTaxIds.value],
    transactionChargeIds: snapshotChargeIds()
  });
  if (ok) openDocTaxes.value = false;
}

async function persistDocCharges() {
  const ok = await saveDocumentTaxesCharges({
    transactionTaxIds: snapshotTaxIds(),
    transactionChargeIds: [...docChargeIds.value]
  });
  if (ok) openDocCharges.value = false;
}

async function saveGlobalDiscount() {
  if (!linesEditable.value || !caps.value.globalDiscounts) return;
  if (isApiMode.value && !recordApiId.value) return;

  const value = Number(globalDiscountValue.value) || 0;
  const type = value > 0 ? globalDiscountType.value || 'percent' : null;
  if (type && value < 0) return;

  if (!isApiMode.value) {
    const quotePatch = {
      globalDiscountType: type,
      globalDiscountValue: type ? value : 0
    };
    const lines = currentLocalLines().map((l) => recomputeLocalLineMoney(l));
    emit('updated', {
      type: 'quote-discounts-updated',
      quote: quotePatch,
      lines,
      totals: localTotalsFromLines(lines, { ...props.record, ...quotePatch, lines })
    });
    return;
  }

  busy.value = true;
  try {
    const res = await apiClient.patch(`${documentRecordBase.value}/discounts`, {
      globalDiscountType: type,
      globalDiscountValue: type ? value : 0,
      overridePricing: overrideLock.value === true
    });
    if (res?.success) {
      emit('updated', {
        type: 'quote-discounts-updated',
        quote: res?.data?.quote ?? res?.data?.salesOrder ?? res?.data?.invoice ?? res?.data?.purchaseOrder ?? null,
        lines: res?.data?.lines ?? null,
        ...mutationPayload(res.data)
      });
      return;
    }
    notifications.error(res?.message || t('records.linesGlobalDiscountUpdateFailed'));
  } catch (e) {
    notifications.error(e?.message || t('records.linesGlobalDiscountUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

const adjustmentInputValue = computed(() => {
  const n = Number(props.record?.adjustmentTotal);
  return Number.isFinite(n) ? n : 0;
});

async function onAdjustmentChange(event) {
  if (!isPurchaseOrderLines.value || !linesEditable.value) return;
  const raw = event?.target?.value;
  const value = Number(raw) || 0;
  if (!isApiMode.value) {
    const quotePatch = { adjustmentTotal: value };
    const lines = currentLocalLines().map((l) => recomputeLocalLineMoney(l));
    emit('updated', {
      type: 'quote-discounts-updated',
      quote: quotePatch,
      lines,
      totals: localTotalsFromLines(lines, { ...props.record, ...quotePatch, lines })
    });
    return;
  }
  if (!recordApiId.value) return;
  busy.value = true;
  try {
    const res = await apiClient.patch(`${documentRecordBase.value}/discounts`, {
      adjustmentTotal: value
    });
    if (res?.success) {
      emit('updated', {
        type: 'quote-discounts-updated',
        quote: {
          adjustmentTotal: value,
          ...(res?.data?.quote || res?.data?.purchaseOrder || {})
        },
        lines: res?.data?.lines ?? null,
        ...mutationPayload(res.data)
      });
      return;
    }
    notifications.error(res?.message || t('records.linesGlobalDiscountUpdateFailed'));
  } catch (e) {
    notifications.error(e?.message || t('records.linesGlobalDiscountUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

const globalDiscountInputValue = computed(() => {
  const raw = Number(globalDiscountValue.value);
  if (!Number.isFinite(raw) || raw === 0) return '';
  return String(raw);
});

function onGlobalDiscountValueChange(event) {
  const raw = String(event?.target?.value ?? '').trim();
  globalDiscountValue.value = raw === '' ? 0 : Number(raw) || 0;
  saveGlobalDiscount();
}

function onGlobalDiscountTypeChange(value) {
  globalDiscountType.value = value || 'percent';
  saveGlobalDiscount();
}

function sortedAllLines() {
  return [...lines.value].sort(
    (a, b) => (Number(a?.lineOrder) || 0) - (Number(b?.lineOrder) || 0)
  );
}

function linesInDisplayGroup(lineId) {
  const all = sortedAllLines();
  const adapter = linesAdapter.value;
  const line = all.find((l) => lineApiId(l) === String(lineId || ''));
  if (!line) return [];

  if (String(line?.lineType || '') === 'bundle_parent') {
    const mode = String(line?.bundleSnapshot?.pricingMode || 'fixed').toLowerCase();
    const parentMongoId = String(line._id || '');
    const children = all
      .filter(
        (l) =>
          String(l?.lineType || '') === 'bundle_component' &&
          parentMongoId &&
          String(l?.parentBundleLineId || '') === parentMongoId
      )
      .sort((a, b) => (Number(a?.lineOrder) || 0) - (Number(b?.lineOrder) || 0));
    if (mode === 'fixed' || mode === 'discount') return [line, ...children];
    return [line];
  }

  return [line];
}

function buildOrdersFromVisibleSequence(visibleIds) {
  const all = sortedAllLines();
  const reordered = [];
  const used = new Set();

  for (const id of visibleIds) {
    for (const line of linesInDisplayGroup(id)) {
      const key = lineApiId(line);
      if (!key || used.has(key)) continue;
      used.add(key);
      reordered.push(line);
    }
  }

  for (const line of all) {
    const key = lineApiId(line);
    if (key && !used.has(key)) {
      used.add(key);
      reordered.push(line);
    }
  }

  const lineIdField = linesAdapter.value.lineIdField;
  return reordered.map((line, index) => ({
    [lineIdField]: lineApiId(line),
    lineOrder: index + 1
  }));
}

function onLineOrderDragStart() {
  isReorderDragging.value = true;
  dragStartSectionByLineId.value = snapshotLineSectionKeys();
  activeDropSectionKey.value = null;
  document.body.classList.add('quote-lines-reorder-active');
}

async function persistDragChanges() {
  if (!linesEditable.value || !caps.value.lineReorder) return;
  if (isApiMode.value && !recordApiId.value) return;

  const moves = collectSectionMoves();
  const visibleIds = sectionBlocks.value.flatMap((block) =>
    (getSectionRows(block.key) || []).map((row) => lineApiId(row.line)).filter(Boolean)
  );
  const orders = buildOrdersFromVisibleSequence(visibleIds);
  if (!moves.length && !orders.length) return;

  if (!isApiMode.value) {
    const byId = new Map(currentLocalLines().map((l) => [lineApiId(l), { ...l }]));
    const sectionIdField = linesAdapter.value.sectionIdField;
    const lineIdField = linesAdapter.value.lineIdField;
    for (const move of moves) {
      const cur = byId.get(lineApiId(move.line));
      if (cur) {
        cur[sectionIdField] = move.targetSectionRef;
        byId.set(lineApiId(move.line), cur);
      }
    }
    const nextLines = [];
    for (const order of orders) {
      const id = String(order[lineIdField] || '');
      const line = byId.get(id);
      if (!line) continue;
      nextLines.push({ ...line, lineOrder: order.lineOrder });
      byId.delete(id);
    }
    for (const leftover of byId.values()) nextLines.push(leftover);
    emitLocalLinesRecalc(nextLines);
    return;
  }

  busy.value = true;
  try {
    for (const move of moves) {
      await patchLineSection(move.line, move.targetSectionRef);
    }

    const res = await apiClient.patch(`${documentRecordBase.value}/lines/reorder`, {
      orders,
      overridePricing: overrideLock.value === true
    });
    if (!res?.success || !Array.isArray(res?.data?.lines)) {
      throw new Error(res?.message || t('records.linesReorderFailed'));
    }
    emit('updated', {
      type: 'lines-recalculated',
      lines: res.data.lines,
      ...mutationPayload(res.data)
    });
  } catch (e) {
    notifications.error(
      e?.message || (moves.length ? t('records.linesUpdateFailed') : t('records.linesReorderFailed'))
    );
    syncSectionRowsFromBlocks();
  } finally {
    busy.value = false;
  }
}

async function onLineOrderDragEnd() {
  isReorderDragging.value = false;
  document.body.classList.remove('quote-lines-reorder-active');
  try {
    await persistDragChanges();
  } finally {
    dragStartSectionByLineId.value = {};
    activeDropSectionKey.value = null;
  }
}

function syncSectionRowsFromBlocks() {
  const next = {};
  for (const block of sectionBlocks.value) {
    next[block.key] = buildSectionRowsFromBlockRows(block.rows);
  }
  sectionRowsMap.value = next;
}

function readMoneyField(key) {
  const n = Number(props.record?.[key]);
  return Number.isFinite(n) ? n : 0;
}

const totals = computed(() => {
  const fromRecord = {
    subtotal: readMoneyField('subtotal'),
    lineDiscountTotal: readMoneyField('lineDiscountTotal'),
    globalDiscountTotal: readMoneyField('globalDiscountTotal'),
    taxTotal: readMoneyField('taxTotal'),
    chargesTotal: readMoneyField('chargesTotal'),
    adjustmentTotal: readMoneyField('adjustmentTotal'),
    grandTotal: readMoneyField('grandTotal')
  };

  if (fromRecord.grandTotal > 0 || !lines.value.length) {
    return fromRecord;
  }

  // Header empty: derive pre-tax subtotal + tax from lines (not tax-inclusive lineTotal)
  const lineSubtotalSum = lines.value.reduce(
    (sum, line) => sum + (Number(line?.lineSubtotal) || 0),
    0
  );
  const lineTaxSum = lines.value.reduce(
    (sum, line) => sum + (Number(line?.lineTaxTotal) || 0),
    0
  );
  if (lineSubtotalSum <= 0) {
    const lineSum = lines.value.reduce((sum, line) => sum + (Number(line?.lineTotal) || 0), 0);
    if (lineSum <= 0) return fromRecord;
    return { ...fromRecord, subtotal: lineSum, grandTotal: lineSum };
  }
  return {
    ...fromRecord,
    subtotal: lineSubtotalSum,
    taxTotal: lineTaxSum,
    grandTotal: Math.max(0, lineSubtotalSum + lineTaxSum)
  };
});

const totalsStaleHint = computed(() => {
  const headerTotal = readMoneyField('grandTotal');
  if (headerTotal > 0 || !lines.value.length) return false;
  return lines.value.some((l) => Number(l?.lineTotal) > 0);
});

const priceBooksLoading = ref(false);
const priceBooks = ref([]);

const priceBookOptions = computed(() =>
  priceBooks.value.map((b) => ({
    value: String(b._id),
    label: b.name
  }))
);
const selectedPriceBookId = ref('');

const showVariantPicker = ref(false);
const variantPickerSearchInputRef = ref(null);
const variantSearchQuery = ref('');
const variantSearchResults = ref([]);
const variantSearchLoading = ref(false);
const variantPickerSelectedById = ref({});
const variantPickerSelectedCount = computed(
  () => Object.keys(variantPickerSelectedById.value).length
);
let variantSearchTimer;

const showBundlePicker = ref(false);
const bundleSearchQuery = ref('');
const bundleSearchResults = ref([]);
const bundleSearchLoading = ref(false);
let bundleSearchTimer;

const showBundleOptionalModal = ref(false);
const bundleOptionalModalMode = ref('add'); // 'add' | 'configure'
const bundleOptionalAddHit = ref(null);
const bundleOptionalConfigureParent = ref(null);
const bundleOptionalChoices = ref([]);
const bundleOptionalSelected = ref([]);

const canOverrideLock = computed(() => {
  if (authStore.user?.isOwner) return true;
  const role = String(authStore.user?.role || '').toLowerCase();
  return role === 'owner' || role === 'admin';
});


const linesEditable = computed(() => {
  if (linesAdapter.value.isEditable(props.record)) return true;
  if (linesAdapter.value.kind === 'quote') {
    return overrideLock.value && canOverrideLock.value;
  }
  return false;
});

/** Sticky anchor columns — name (left), total + actions (right). */
function stickyColClass(column) {
  if (!stickyColumnsActive.value) return '';

  if (column === 'name') {
    return 'quote-lines-sticky quote-lines-sticky-left quote-lines-sticky-left-name';
  }
  if (column === 'total') {
    return linesEditable.value
      ? 'quote-lines-sticky quote-lines-sticky-right quote-lines-sticky-right-total'
      : 'quote-lines-sticky quote-lines-sticky-right quote-lines-sticky-right-edge';
  }
  if (column === 'actions') {
    return linesEditable.value ? 'quote-lines-sticky quote-lines-sticky-right quote-lines-sticky-right-edge' : '';
  }
  return '';
}

function formatMoney(value) {
  // Commercial line prices must be exact (no ₹0.00K aggregation)
  return formatQuoteMoney(value, currencyCode.value, undefined, { exact: true });
}

function variantHitLabel(hit) {
  if (hit.item_name) {
    return hit.variant_code ? `${hit.item_name} (${hit.variant_code})` : hit.item_name;
  }
  return hit.variant_code || String(hit._id);
}

function variantHitAvatarRecord(hit) {
  return {
    ...hit,
    name: hit?.item_name || hit?.name || hit?.variant_code || hit?.item_code || '',
  };
}

function variantHitSubtitle(hit) {
  const code = String(hit?.variant_code || '').trim();
  const itemCode = String(hit?.item_code || '').trim();
  const vendorCode = isPurchaseOrderLines.value
    ? String(hit?.vendorItemCode || '').trim()
    : '';
  const base =
    code && itemCode && code !== itemCode
      ? `${code} · ${itemCode}`
      : code || itemCode || '';
  if (vendorCode && vendorCode !== code && vendorCode !== itemCode) {
    return base ? `${base} · ${vendorCode}` : vendorCode;
  }
  return base;
}

function formatVariantHitPrice(hit) {
  const amount = isPurchaseOrderLines.value
    ? hit?.purchase_price ?? hit?.unitPrice ?? hit?.selling_price
    : hit?.selling_price;
  if (amount == null || amount === '') return '—';
  const code = String(hit?.currency || currencyCode.value || '').trim().toUpperCase();
  return formatQuoteMoney(amount, code);
}

function openAddNewItemFromPicker() {
  if (!showCreateCatalogItemAction.value) return;
  const blockKey = variantPickerBlockKey.value;
  const query = String(variantSearchQuery.value || '').trim();
  closeVariantPicker();
  const block = displaySectionBlocks.value.find((b) => b.key === blockKey);
  if (!block) return;
  if (!hasDraftRow(block.key)) ensureDraftRow(block);
  const state = draftRow(block);
  if (state && query) state.searchQuery = query;
  openAddNewItemFromDraft(block);
}

function readRecentVariantHits() {
  try {
    const raw = localStorage.getItem(QUOTE_RECENT_VARIANTS_KEY);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function recordRecentVariant(hit) {
  if (!hit?._id || typeof localStorage === 'undefined') return;
  const entry = {
    _id: String(hit._id),
    item_name: hit.item_name || null,
    variant_code: hit.variant_code || null
  };
  const next = [
    entry,
    ...readRecentVariantHits().filter((row) => String(row?._id || '') !== entry._id)
  ].slice(0, QUOTE_RECENT_VARIANTS_MAX);
  localStorage.setItem(QUOTE_RECENT_VARIANTS_KEY, JSON.stringify(next));
}

function recentHitsFromQuoteLines() {
  const seen = new Set();
  const hits = [];
  for (const line of lines.value) {
    const id = String(line?.variantId || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    hits.push({
      _id: id,
      item_name: line.itemNameSnapshot || null,
      variant_code: line.skuSnapshot || null
    });
  }
  return hits;
}

function recentHitsForAdd() {
  const seen = new Set();
  const merged = [];
  for (const hit of [...recentHitsFromQuoteLines(), ...readRecentVariantHits()]) {
    const id = String(hit?._id || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(hit);
  }
  return merged.slice(0, 8);
}

function draftSearchDropdownLabel(block) {
  const state = draftRow(block);
  if (!state || state.searchLoading) return '';
  if (isPurchaseOrderLines.value) {
    if (!poVendorId.value) return t('records.linesPoSelectVendorFirst');
    if (!state.searchQuery.trim() && state.searchResults.length) {
      return t('records.linesPoShowVendorCatalog');
    }
    if (!state.searchQuery.trim() && !state.searchResults.length) {
      return t('records.linesPoVendorCatalogEmpty');
    }
    if (state.searchQuery.trim() && state.searchResults.length) {
      return t('records.linesSearchResults');
    }
    return '';
  }
  if (!state.searchQuery.trim() && state.searchResults.length) {
    return t('records.linesRecentProducts');
  }
  if (state.searchQuery.trim() && state.searchResults.length) {
    return t('records.linesSearchResults');
  }
  return '';
}

function getDefaultAddBlock() {
  if (activeAddBlockKey.value) {
    const active = displaySectionBlocks.value.find((b) => b.key === activeAddBlockKey.value);
    if (active) return active;
  }
  return displaySectionBlocks.value.find((b) => !b.isOrphan) || displaySectionBlocks.value[0] || null;
}

/** Seed one draft search row on empty lines so Add is not required first (edit + create draft). */
const defaultDraftSeededQuoteId = ref('');
watch(
  () => ({
    quoteId: String(props.record?._id || ''),
    draftMode: Boolean(props.draftMode),
    editable: linesEditable.value,
    block: getDefaultAddBlock()
  }),
  ({ quoteId, draftMode, editable, block }) => {
    const seedKey = quoteId || (draftMode ? '__create-draft__' : '');
    if (!seedKey || !editable || !block?.key) return;
    if (defaultDraftSeededQuoteId.value === seedKey) return;
    defaultDraftSeededQuoteId.value = seedKey;
    if ((block.rows || []).length > 0 || hasDraftRow(block.key)) return;
    ensureDraftRow(block);
  },
  { immediate: true }
);

const DRAFT_SEARCH_MENU_MAX_H = 208; // max-h-52
const draftSearchMenuRects = ref({});
const draftSearchInputEls = {};

function registerDraftSearchInput(key, el) {
  const k = String(key || '');
  if (!k) return;
  if (el) draftSearchInputEls[k] = el;
  else delete draftSearchInputEls[k];
}

function getDraftSearchInputEl(key) {
  const k = String(key || '');
  if (draftSearchInputEls[k]) return draftSearchInputEls[k];
  const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(k) : k.replace(/"/g, '\\"');
  return (
    workspacePanelRef.value?.querySelector(`[data-quote-draft-search="${escaped}"]`) ||
    document.querySelector(`[data-quote-draft-search="${escaped}"]`)
  );
}

function syncDraftSearchMenuPosition(block) {
  const key = String(block?.key || '');
  if (!key) return;
  const el = getDraftSearchInputEl(key);
  if (!el?.getBoundingClientRect) return;
  const r = el.getBoundingClientRect();
  const gap = 4;
  const viewportPadding = 8;
  const spaceBelow = window.innerHeight - r.bottom - gap;
  const spaceAbove = r.top - gap;
  const openUp = spaceBelow < 120 && spaceAbove > spaceBelow;
  const maxH = Math.min(
    DRAFT_SEARCH_MENU_MAX_H,
    Math.max(96, openUp ? spaceAbove : spaceBelow)
  );
  const width = Math.max(r.width, 256);
  let left = r.left;
  left = Math.max(viewportPadding, Math.min(left, window.innerWidth - width - viewportPadding));
  draftSearchMenuRects.value = {
    ...draftSearchMenuRects.value,
    [key]: openUp
      ? {
          top: `${Math.max(gap, r.top - maxH - gap)}px`,
          left: `${left}px`,
          width: `${width}px`,
          maxHeight: `${maxH}px`
        }
      : {
          top: `${r.bottom + gap}px`,
          left: `${left}px`,
          width: `${width}px`,
          maxHeight: `${maxH}px`
        }
  };
}

function draftSearchMenuStyle(block) {
  const key = String(block?.key || '');
  const rect = draftSearchMenuRects.value[key];
  if (!rect) {
    return { visibility: 'hidden', top: '0px', left: '0px' };
  }
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    maxHeight: rect.maxHeight,
    visibility: 'visible'
  };
}

function scheduleDraftSearchMenuPosition(block) {
  syncDraftSearchMenuPosition(block);
  nextTick(() => {
    syncDraftSearchMenuPosition(block);
    requestAnimationFrame(() => syncDraftSearchMenuPosition(block));
  });
}

function syncOpenDraftSearchMenus() {
  for (const block of displaySectionBlocks.value) {
    const state = draftRow(block);
    if (state?.searchOpen) syncDraftSearchMenuPosition(block);
  }
}

function openDraftSearchWithRecent(block) {
  const state = draftRow(block);
  if (!state) return;
  state.searchOpen = true;
  scheduleDraftSearchMenuPosition(block);

  // PO: never seed from global "recent" hits — only this vendor's catalog.
  if (isPurchaseOrderLines.value) {
    state.searchHighlight = -1;
    void runDraftSearch(block);
    return;
  }

  if (state.searchQuery.trim()) {
    if (!state.searchResults.length) debouncedDraftSearch(block);
    return;
  }
  const recent = recentHitsForAdd();
  state.searchResults = recent;
  state.searchHighlight = -1;
}

function filterHitsForPoScope(hits) {
  const rows = Array.isArray(hits) ? hits : [];
  if (!isPurchaseOrderLines.value) return rows;
  // Browse-all may include unlinked; default vendor catalog must not.
  if (poVariantScope.value === 'all') return rows;
  return rows.filter((h) => h?.linked !== false);
}

function quoteSectionIdForBlockKey(blockKey) {
  const block = displaySectionBlocks.value.find((b) => b.key === blockKey);
  if (!block) return null;
  return blockSectionRef(block);
}

function closeVariantPicker() {
  showVariantPicker.value = false;
  variantPickerBlockKey.value = null;
  variantPickerSelectedById.value = {};
}

function isVariantPickerSelected(hit) {
  const id = String(hit?._id || '');
  return Boolean(id && variantPickerSelectedById.value[id]);
}

function toggleVariantPickerSelection(hit) {
  if (busy.value) return;
  const id = String(hit?._id || '');
  if (!id) return;
  const next = { ...variantPickerSelectedById.value };
  if (next[id]) delete next[id];
  else next[id] = hit;
  variantPickerSelectedById.value = next;
}

function openVariantPickerForDraft(block) {
  if (!linesEditable.value) return;
  if (!hasDraftRow(block.key)) startDraftRow(block);
  activeAddBlockKey.value = block?.key ?? '';
  variantPickerBlockKey.value = block?.key ?? null;
  variantPickerSelectedById.value = {};
  const state = draftRow(block);
  showVariantPicker.value = true;
  variantSearchQuery.value = state?.searchQuery || '';
  runVariantSearch();
}

function openBundlePickerForSection(block) {
  if (!linesEditable.value || !caps.value.bundles) return;
  activeAddBlockKey.value = block?.key ?? '';
  bundlePickerBlockKey.value = block?.key ?? null;
  showBundlePicker.value = true;
  bundleSearchQuery.value = '';
  runBundleSearch();
}

function onDraftSearchInput(block) {
  activeAddBlockKey.value = block?.key ?? '';
  const state = draftRow(block);
  if (!state) return;
  state.searchOpen = true;
  state.searchHighlight = -1;
  scheduleDraftSearchMenuPosition(block);
  debouncedDraftSearch(block);
}

function debouncedDraftSearch(block) {
  const key = String(block?.key || '_default');
  clearTimeout(inlineSearchTimers[key]);
  inlineSearchTimers[key] = setTimeout(() => runDraftSearch(block), 300);
}

async function runDraftSearch(block) {
  const state = draftRow(block);
  if (!state) return;

  // Purchase orders: always search vendor catalog (even with empty query).
  // Do not seed from "recent variants" — those ignore the selected vendor.
  if (isPurchaseOrderLines.value) {
    if (!poVendorId.value) {
      state.searchResults = [];
      state.searchOpen = true;
      state.searchLoading = false;
      state.searchHighlight = -1;
      scheduleDraftSearchMenuPosition(block);
      return;
    }
    state.searchLoading = true;
    try {
      const hits = await searchVariantsForDocument({
        q: state.searchQuery,
        limit: state.searchQuery.trim() ? 12 : 25
      });
      state.searchResults = filterHitsForPoScope(hits);
      state.searchOpen = true;
      if (state.searchHighlight >= state.searchResults.length) {
        state.searchHighlight = state.searchResults.length ? 0 : -1;
      }
      scheduleDraftSearchMenuPosition(block);
    } finally {
      state.searchLoading = false;
      scheduleDraftSearchMenuPosition(block);
    }
    return;
  }

  if (!state.searchQuery.trim()) {
    state.searchResults = recentHitsForAdd();
    // Keep open on click even with no recent hits so "Add New Item" remains reachable.
    state.searchOpen = true;
    state.searchLoading = false;
    state.searchHighlight = -1;
    scheduleDraftSearchMenuPosition(block);
    return;
  }
  state.searchLoading = true;
  try {
    const hits = await searchVariantsForDocument({
      q: state.searchQuery,
      limit: 8
    });
    state.searchResults = Array.isArray(hits) ? hits : [];
    state.searchOpen = true;
    if (state.searchHighlight >= state.searchResults.length) {
      state.searchHighlight = state.searchResults.length ? 0 : -1;
    }
    scheduleDraftSearchMenuPosition(block);
  } finally {
    state.searchLoading = false;
  }
}

async function addLineFromHit(block, hit, options = {}) {
  const key = block?.key;
  const variantId = String(hit?._id || '');
  if (!key || !variantId || !linesEditable.value) return null;
  if (isApiMode.value && !recordApiId.value) return null;
  const commitKey = `${key}:${variantId}`;
  if (pendingDraftCommits.has(commitKey)) return null;

  const preGate = options.gate;
  const gate =
    preGate && typeof preGate === 'object'
      ? preGate
      : await ensurePoLineAllowed(hit, block);
  if (!gate.ok) return null;

  pendingDraftCommits.add(commitKey);
  recordRecentVariant(hit);
  try {
    if (!isApiMode.value) {
      let unitPrice =
        Number(
          hit?.purchase_price ??
            hit?.unitPrice ??
            hit?.selling_price ??
            hit?.list_price ??
            0
        ) || 0;
      let priceMeta = {};
      if (!isPurchaseOrderLines.value) {
        try {
          const priced = await apiClient.post('/catalog/price-books/resolve', {
            variantId,
            priceBookId: selectedPriceBookId.value || null,
            quantity: 1,
            asOfDate:
              props.record?.quoteDate ||
              props.record?.orderDate ||
              props.record?.invoiceDate ||
              null
          });
          const data = priced?.data || priced;
          if (data && Number.isFinite(Number(data.unitPrice))) {
            unitPrice = Number(data.unitPrice);
            priceMeta = {
              listPriceSnapshot: data.listPrice ?? unitPrice,
              priceBookIdSnapshot: data.priceBookId ?? null,
              priceBookNameSnapshot: data.priceBookName ?? null,
              pricingSourceSnapshot: data.pricingSource ?? 'price_book'
            };
          }
        } catch {
          /* catalog resolve optional — fall back to hit price */
        }
      }
      const lid = nextLocalDraftId('local-line');
      const lineIdField = linesAdapter.value.lineIdField;
      const sectionIdField = linesAdapter.value.sectionIdField;
      const sectionRef = blockSectionRef(block) || null;
      const qty = 1;
      const baseLines = Array.isArray(options.baseLines)
        ? options.baseLines
        : Array.isArray(props.record?.lines)
          ? props.record.lines
          : [];
      const order = baseLines.length + 1;
      const configSelections = options.configurationSelections || null;
      let line = {
        _localId: lid,
        _id: lid,
        [lineIdField]: lid,
        variantId,
        [sectionIdField]: sectionRef,
        quantity: qty,
        quantityOrdered: qty,
        unitPrice,
        unitPriceSnapshot: unitPrice,
        listPriceSnapshot: priceMeta.listPriceSnapshot ?? unitPrice,
        itemNameSnapshot: hit?.item_name || hit?.name || null,
        skuSnapshot: hit?.variant_code || hit?.item_code || hit?.sku || null,
        lineType: 'product',
        lineOrder: order,
        discountType: null,
        discountValue: 0,
        discountAmount: 0,
        linkToVendorCatalog: gate.alsoLink === true,
        vendorItemCode: isPurchaseOrderLines.value ? hit?.vendorItemCode || null : undefined,
        vendorItemName: isPurchaseOrderLines.value ? hit?.vendorItemName || null : undefined,
        minOrderQty: isPurchaseOrderLines.value
          ? hit?.min_order_qty ?? hit?.minOrderQty ?? null
          : undefined,
        productConfigurationId: options.productConfigurationId || null,
        productConfigurationVersion: options.productConfigurationVersion ?? null,
        configurationSelections: configSelections,
        configurationSnapshot: options.productConfigurationId
          ? {
              productConfigurationId: options.productConfigurationId,
              name: options.configurationName || null,
              selections: configSelections || {}
            }
          : null,
        ...priceMeta
      };
      if (isPurchaseOrderLines.value && Number.isFinite(Number(hit?.purchase_price))) {
        const catPrice = Number(hit.purchase_price);
        const prev = poCatalogByVariant.value.get(String(variantId));
        poCatalogByVariant.value = new Map(poCatalogByVariant.value).set(String(variantId), {
          price: catPrice,
          lastPrice: prev?.lastPrice ?? hit?.last_purchase_price ?? null,
          lastDate: prev?.lastDate ?? hit?.last_purchase_date ?? null,
          vendorItemCode: hit?.vendorItemCode || null,
          minOrderQty: hit?.min_order_qty ?? hit?.minOrderQty ?? null
        });
      }
      line = recomputeLocalLineMoney(line);
      const nextLines = [...baseLines, line];
      return {
        line,
        data: { lines: nextLines, totals: localTotalsFromLines(nextLines) }
      };
    }

    const body = {
      ...linesAdapter.value.buildAddLineBody({
        variantId,
        quantity: 1,
        sectionRef: blockSectionRef(block) || null,
        priceBookId: selectedPriceBookId.value || null,
        overridePricing: overrideLock.value === true,
        unitPrice:
          isPurchaseOrderLines.value
            ? Number(hit?.purchase_price ?? hit?.unitPrice ?? hit?.selling_price ?? 0) || 0
            : undefined,
        linkToVendorCatalog: gate.alsoLink === true,
        vendorItemCode: isPurchaseOrderLines.value ? hit?.vendorItemCode : undefined,
        vendorItemName: isPurchaseOrderLines.value ? hit?.vendorItemName : undefined,
        minOrderQty: isPurchaseOrderLines.value
          ? hit?.min_order_qty ?? hit?.minOrderQty
          : undefined,
        productConfigurationId: options.productConfigurationId || undefined,
        configurationSelections: options.configurationSelections || undefined
      })
    };
    if (linesAdapter.value.kind === 'quote') {
      body.overridePricing = overrideLock.value === true;
    }
    const res = await apiClient.post(`${documentRecordBase.value}/lines`, body);
    if (res?.success) {
      if (isPurchaseOrderLines.value) {
        if (Number.isFinite(Number(hit?.purchase_price))) {
          const prev = poCatalogByVariant.value.get(String(variantId));
          poCatalogByVariant.value = new Map(poCatalogByVariant.value).set(String(variantId), {
            price: Number(hit.purchase_price),
            lastPrice: prev?.lastPrice ?? hit?.last_purchase_price ?? null,
            lastDate: prev?.lastDate ?? hit?.last_purchase_date ?? null
          });
        } else if (gate.alsoLink === true) {
          void loadPoCatalogPrices();
        }
      }
      return { line: res?.data?.line || null, data: res.data };
    }
    notifications.error(res?.message || t('records.linesAddFailed'));
    return null;
  } catch (e) {
    notifications.error(e?.message || t('records.linesAddFailed'));
    return null;
  } finally {
    pendingDraftCommits.delete(commitKey);
  }
}

function unwrapConfigList(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res)) return res;
  return [];
}

async function loadActiveConfigsForHit(hit) {
  if (!cpqEntitled.value || isPurchaseOrderLines.value) return [];
  const kind = linesAdapter.value?.kind;
  if (kind !== 'quote' && kind !== 'salesOrder') return [];
  const groupId = hit?.itemGroupId || hit?.item_group_id;
  if (!groupId) return [];
  try {
    const res = await apiClient.get('/product-configurations', {
      params: { itemGroupId: String(groupId), status: 'ACTIVE' }
    });
    return unwrapConfigList(res).filter((c) => !c.status || c.status === 'ACTIVE');
  } catch {
    return [];
  }
}

function openProductConfigSession({ hit, configs, block, options }) {
  return new Promise((resolve) => {
    productConfigSession.value = {
      open: true,
      hit,
      configs,
      loading: false,
      block,
      options: options || {},
      resolve
    };
  });
}

function finishProductConfigSession(payload) {
  const session = productConfigSession.value;
  productConfigSession.value = null;
  session?.resolve?.(payload);
}

function onProductConfigConfirm(payload) {
  finishProductConfigSession({
    action: 'confirm',
    productConfigurationId: payload.productConfigurationId,
    configurationSelections: payload.configurationSelections,
    configurationName: payload.configuration?.name || null,
    productConfigurationVersion: payload.configuration?.version ?? null
  });
}

function onProductConfigSkip() {
  finishProductConfigSession({ action: 'skip' });
}

function onProductConfigCancel() {
  finishProductConfigSession({ action: 'cancel' });
}

/**
 * Add a catalog hit; if CPQ configs exist for the item group, open guided drawer first.
 */
async function resolveAndAddLineFromHit(block, hit, options = {}) {
  const configs = await loadActiveConfigsForHit(hit);
  if (!configs.length) {
    return addLineFromHit(block, hit, options);
  }
  const outcome = await openProductConfigSession({ hit, configs, block, options });
  if (!outcome || outcome.action === 'cancel') return null;
  if (outcome.action === 'skip') {
    return addLineFromHit(block, hit, options);
  }
  return addLineFromHit(block, hit, {
    ...options,
    productConfigurationId: outcome.productConfigurationId,
    configurationSelections: outcome.configurationSelections,
    configurationName: outcome.configurationName,
    productConfigurationVersion: outcome.productConfigurationVersion
  });
}

async function commitDraftFromHit(block, hit) {
  const key = block?.key;
  const state = draftRow(block);
  if (!state || state.committing) return;
  state.committing = true;
  state.searchOpen = false;
  try {
    const result = await resolveAndAddLineFromHit(block, hit);
    if (result) {
      if (result.line) {
        emit('updated', {
          type: 'lines-added',
          lines: [result.line],
          ...mutationPayload(result.data)
        });
      } else {
        await refresh();
      }
      resetDraftRowForNextAdd(block);
    } else {
      state.committing = false;
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesAddFailed'));
    state.committing = false;
  }
}

function openAddNewItemFromDraft(block) {
  if (!showCreateCatalogItemAction.value || !linesEditable.value || busy.value) return;
  const state = draftRow(block);
  if (state) state.searchOpen = false;
  itemCreateBlockKey.value = block?.key ?? null;
  itemCreatePrefillText.value = String(state?.searchQuery || '').trim();
  showItemCreateDrawer.value = true;
}

function closeItemCreateDrawer() {
  showItemCreateDrawer.value = false;
  itemCreateBlockKey.value = null;
  itemCreatePrefillText.value = '';
}

function hitFromCreatedItem(item) {
  if (!item || typeof item !== 'object') return null;
  const variant = item.defaultVariant && typeof item.defaultVariant === 'object' ? item.defaultVariant : null;
  const variantId =
    variant?._id ||
    item.catalogVariantId ||
    item.defaultVariantId ||
    null;
  if (!variantId) return null;
  return {
    _id: variantId,
    variant_code: variant?.variant_code || item.sku || item.item_code || null,
    item_id: item._id,
    item_name: item.item_name || item.name || null,
    item_code: item.item_code || null,
    item_type: item.item_type || null,
    selling_price: variant?.selling_price ?? item.selling_price ?? 0,
    currency: variant?.currency || item.currency || currencyCode.value,
    is_default: variant?.is_default ?? true
  };
}

async function resolveVariantHitForItem(item) {
  const direct = hitFromCreatedItem(item);
  if (direct) return direct;
  const itemId = String(item?._id || '');
  if (!itemId) return null;
  try {
    const res = await apiClient.get(`/items/${itemId}/variants`);
    const variants = unwrapCatalogApiData(res);
    const list = Array.isArray(variants) ? variants : [];
    const preferred = list.find((v) => v?.is_default) || list[0];
    if (!preferred?._id) return null;
    return {
      _id: preferred._id,
      variant_code: preferred.variant_code || null,
      item_id: itemId,
      item_name: item.item_name || item.name || null,
      item_code: item.item_code || null,
      item_type: item.item_type || null,
      selling_price: preferred.selling_price ?? 0,
      currency: preferred.currency || currencyCode.value,
      is_default: preferred.is_default ?? true
    };
  } catch {
    return null;
  }
}

async function handleItemCreatedFromDraft(savedRecord) {
  const blockKey = itemCreateBlockKey.value;
  closeItemCreateDrawer();
  const block = displaySectionBlocks.value.find((b) => b.key === blockKey);
  if (!block || !linesEditable.value) return;
  const hit = await resolveVariantHitForItem(savedRecord);
  if (!hit) {
    notifications.error(t('records.linesAddFailed'));
    return;
  }
  if (!hasDraftRow(block.key)) ensureDraftRow(block);
  await commitDraftFromHit(block, hit);
}

async function confirmVariantPickerSelection() {
  const blockKey = variantPickerBlockKey.value;
  const block = displaySectionBlocks.value.find((b) => b.key === blockKey);
  const selected = Object.values(variantPickerSelectedById.value);
  if (!block || !selected.length || busy.value) return;

  // Gate (unlinked confirm) before busy / while picker can still host confirmation UI.
  const prepared = [];
  for (const hit of selected) {
    const gate = await ensurePoLineAllowed(hit, block);
    if (!gate.ok) continue;
    prepared.push({ hit, gate });
  }
  if (!prepared.length) return;

  busy.value = true;
  try {
    const added = [];
    let workingLines = Array.isArray(props.record?.lines) ? [...props.record.lines] : [];
    let lastTotals = null;
    for (const { hit, gate } of prepared) {
      const result = await resolveAndAddLineFromHit(block, hit, {
        gate,
        baseLines: workingLines
      });
      if (result?.line) {
        added.push(result.line);
        if (Array.isArray(result.data?.lines)) {
          workingLines = result.data.lines;
        } else {
          workingLines = [...workingLines, result.line];
        }
        if (result.data?.totals) lastTotals = result.data.totals;
      }
    }
    closeVariantPicker();
    if (added.length) {
      emit('updated', {
        type: 'lines-added',
        lines: added,
        totals: lastTotals || localTotalsFromLines(workingLines),
        sections: null
      });
    }
    resetDraftRowForNextAdd(block);
  } finally {
    busy.value = false;
  }
}

function onDraftSearchFocus(block) {
  activeAddBlockKey.value = block?.key ?? '';
  openDraftSearchWithRecent(block);
  scheduleDraftSearchMenuPosition(block);
}

function onDraftSearchBlur(block) {
  setTimeout(() => {
    const state = draftRow(block);
    if (state) state.searchOpen = false;
  }, 150);
}

function onDraftSearchKeydown(block, event) {
  const state = draftRow(block);
  if (!state) return;
  const results = state.searchResults;
  if (event.key === 'ArrowDown' && state.searchOpen && results.length) {
    event.preventDefault();
    state.searchHighlight = Math.min(state.searchHighlight + 1, results.length - 1);
    return;
  }
  if (event.key === 'ArrowUp' && state.searchOpen && results.length) {
    event.preventDefault();
    state.searchHighlight = Math.max(state.searchHighlight - 1, 0);
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    clearDraftRow(block.key);
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    if (state.searchOpen && results.length) {
      const idx = state.searchHighlight >= 0 ? state.searchHighlight : 0;
      commitDraftFromHit(block, results[idx]);
    }
  }
}

function debouncedVariantSearch() {
  clearTimeout(variantSearchTimer);
  variantSearchTimer = setTimeout(runVariantSearch, 300);
}

function debouncedBundleSearch() {
  clearTimeout(bundleSearchTimer);
  bundleSearchTimer = setTimeout(runBundleSearch, 300);
}

async function runVariantSearch() {
  variantSearchLoading.value = true;
  try {
    const hits = await searchVariantsForDocument({
      q: variantSearchQuery.value,
      limit: 25
    });
    variantSearchResults.value = filterHitsForPoScope(hits);
  } finally {
    variantSearchLoading.value = false;
  }
}

async function runBundleSearch() {
  bundleSearchLoading.value = true;
  try {
    const res = await apiClient.get('/catalog/variants/search', {
      params: { q: bundleSearchQuery.value, limit: 25 }
    });
    const hits = unwrapCatalogApiData(res);
    const rows = Array.isArray(hits) ? hits : [];
    bundleSearchResults.value = rows.filter((r) => String(r?.item_type || '').toLowerCase() === 'bundle');
  } finally {
    bundleSearchLoading.value = false;
  }
}

const bundleOptionalModalTitle = computed(() => {
  if (bundleOptionalModalMode.value === 'configure') {
    const name = bundleOptionalConfigureParent.value?.itemNameSnapshot;
    return name
      ? t('records.linesBundleOptionalConfigureHint', { name })
      : t('records.linesBundleOptionalHint');
  }
  const name = bundleOptionalAddHit.value?.item_name || bundleOptionalAddHit.value?.variant_code;
  return name
    ? t('records.linesBundleOptionalAddHint', { name })
    : t('records.linesBundleOptionalHint');
});

function bundleParentHasOptionals(parentLine) {
  if (!parentLine || String(parentLine?.lineType || '') !== 'bundle_parent') return false;
  const parentMongoId = String(parentLine._id || '');
  const hasChildOptionals = lines.value.some(
    (l) =>
      String(l?.lineType || '') === 'bundle_component' &&
      String(l?.parentBundleLineId || '') === parentMongoId &&
      (l?.optionalLine === true || l?.bundleSnapshot?.isOptional === true)
  );
  if (hasChildOptionals) return true;
  const snap = parentLine?.bundleSnapshot?.components;
  return Array.isArray(snap) && snap.some((c) => c?.isOptional === true);
}

function optionalChoicesForParent(parentLine) {
  const parentMongoId = String(parentLine?._id || '');
  const fromLines = lines.value
    .filter(
      (l) =>
        String(l?.lineType || '') === 'bundle_component' &&
        String(l?.parentBundleLineId || '') === parentMongoId &&
        (l?.optionalLine === true || l?.bundleSnapshot?.isOptional === true)
    )
    .sort((a, b) => (Number(a?.lineOrder) || 0) - (Number(b?.lineOrder) || 0));

  if (fromLines.length) {
    return fromLines.map((l) => ({
      variantId: String(l.variantId),
      label: l.itemNameSnapshot || l.skuSnapshot || String(l.variantId),
      quantity: Number(l.quantity) || 0,
      included: l.hiddenLine !== true
    }));
  }

  const snap = parentLine?.bundleSnapshot?.components;
  if (!Array.isArray(snap)) return [];
  return snap
    .filter((c) => c?.isOptional === true)
    .map((c) => ({
      variantId: String(c.componentVariantId),
      label: String(c.componentVariantId),
      quantity: Number(c.quantity) || 0,
      included: false
    }));
}

function catalogOptionalChoices(components) {
  return (Array.isArray(components) ? components : [])
    .filter((c) => c?.isOptional === true)
    .map((c) => ({
      variantId: String(c.componentVariantId),
      label: c.item_name || c.variant_code || String(c.componentVariantId),
      quantity: Number(c.quantity) || 0,
      included: false
    }));
}

function closeBundleOptionalModal() {
  showBundleOptionalModal.value = false;
  bundleOptionalAddHit.value = null;
  bundleOptionalConfigureParent.value = null;
  bundleOptionalChoices.value = [];
  bundleOptionalSelected.value = [];
}

async function pickBundle(hit) {
  if (!caps.value.bundles) return;
  showBundlePicker.value = false;
  busy.value = true;
  try {
    const res = await apiClient.get(`/catalog/variants/${hit._id}/bundle-components`);
    const data = unwrapCatalogApiData(res);
    const optional = catalogOptionalChoices(data?.components);
    if (optional.length) {
      bundleOptionalModalMode.value = 'add';
      bundleOptionalAddHit.value = hit;
      bundleOptionalConfigureParent.value = null;
      bundleOptionalChoices.value = optional;
      bundleOptionalSelected.value = [];
      showBundleOptionalModal.value = true;
      return;
    }
    await submitAddBundle(hit, []);
  } catch (e) {
    notifications.error(e?.message || t('records.linesAddBundleFailed'));
  } finally {
    busy.value = false;
  }
}

function openBundleOptionalConfig(parentLine) {
  if (!linesEditable.value || !lineApiId(parentLine) || !caps.value.bundles) return;
  const choices = optionalChoicesForParent(parentLine);
  if (!choices.length) return;
  bundleOptionalModalMode.value = 'configure';
  bundleOptionalConfigureParent.value = parentLine;
  bundleOptionalAddHit.value = null;
  bundleOptionalChoices.value = choices;
  bundleOptionalSelected.value = choices.filter((c) => c.included).map((c) => c.variantId);
  showBundleOptionalModal.value = true;
}

async function confirmBundleOptionalModal() {
  if (bundleOptionalModalMode.value === 'add') {
    const hit = bundleOptionalAddHit.value;
    if (!hit) return;
    await submitAddBundle(hit, [...bundleOptionalSelected.value]);
    closeBundleOptionalModal();
    return;
  }

  const parent = bundleOptionalConfigureParent.value;
  if (!lineApiId(parent) || !caps.value.bundles) return;
  if (isApiMode.value && !recordApiId.value) return;

  if (!isApiMode.value) {
    const selected = new Set(bundleOptionalSelected.value.map(String));
    const parentId = lineApiId(parent);
    const nextLines = currentLocalLines().map((l) => {
      if (String(l?.parentBundleLineId || '') !== String(parentId)) return l;
      if (String(l?.lineType || '') !== 'bundle_component') return l;
      const optional = l?.optionalLine === true || l?.bundleSnapshot?.isOptional === true;
      if (!optional) return l;
      const included = selected.has(String(l.variantId));
      return { ...l, hiddenLine: !included };
    });
    notifications.success(t('records.linesBundleOptionalUpdateSuccess'));
    emitLocalLinesRecalc(nextLines);
    closeBundleOptionalModal();
    return;
  }

  busy.value = true;
  try {
    const res = await apiClient.patch(
      `${documentRecordBase.value}/bundles/${lineApiId(parent)}/optionals`,
      {
        includedComponentVariantIds: [...bundleOptionalSelected.value],
        overridePricing: overrideLock.value === true
      }
    );
    if (!res?.success) {
      throw new Error(res?.message || t('records.linesBundleOptionalUpdateFailed'));
    }
    notifications.success(t('records.linesBundleOptionalUpdateSuccess'));
    emit('updated', {
      type: 'lines-recalculated',
      lines: res?.data?.lines ?? null,
      ...mutationPayload(res.data)
    });
    closeBundleOptionalModal();
  } catch (e) {
    notifications.error(e?.message || t('records.linesBundleOptionalUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

async function submitAddBundle(hit, includedOptionalComponentVariantIds) {
  if (!caps.value.bundles) return;
  if (isApiMode.value && !recordApiId.value) return;

  const blockKey = bundlePickerBlockKey.value;
  const sectionField = linesAdapter.value.sectionIdField;
  const sectionRefVal = quoteSectionIdForBlockKey(blockKey) || null;
  const lineIdField = linesAdapter.value.lineIdField;

  if (!isApiMode.value) {
    busy.value = true;
    try {
      const expandRes = await apiClient.get(`/catalog/variants/${hit._id}/bundle-expand`, {
        params: {
          priceBookId: selectedPriceBookId.value || undefined,
          quantity: 1,
          asOfDate:
            props.record?.quoteDate ||
            props.record?.orderDate ||
            props.record?.invoiceDate ||
            undefined
        }
      });
      const expand = expandRes?.data || expandRes || {};
      const included = new Set((includedOptionalComponentVariantIds || []).map(String));
      const parentLid = nextLocalDraftId('local-bundle');
      const parent = recomputeLocalLineMoney({
        _localId: parentLid,
        _id: parentLid,
        [lineIdField]: parentLid,
        variantId: String(hit._id),
        [sectionField]: sectionRefVal,
        quantity: 1,
        unitPriceSnapshot: Number(expand.bundleUnitPrice) || 0,
        listPriceSnapshot: Number(expand.bundleUnitPrice) || 0,
        itemNameSnapshot: expand.bundleItemName || hit?.item_name || hit?.name || null,
        skuSnapshot: hit?.variant_code || null,
        lineType: 'bundle_parent',
        lineOrder: currentLocalLines().length + 1,
        discountType: null,
        discountValue: 0,
        bundleSnapshot: {
          pricingMode: expand.pricingMode || 'fixed',
          components: Array.isArray(expand.lines) ? expand.lines : []
        },
        _localBundleVariantId: String(hit._id),
        _localIncludedOptionalComponentVariantIds: [...included]
      });
      const components = [];
      for (const comp of Array.isArray(expand.lines) ? expand.lines : []) {
        const isOptional = comp?.isOptional === true;
        const variantId = String(comp.componentVariantId || '');
        if (!variantId) continue;
        if (isOptional && !included.has(variantId)) continue;
        const cid = nextLocalDraftId('local-bcomp');
        components.push(
          recomputeLocalLineMoney({
            _localId: cid,
            _id: cid,
            [lineIdField]: cid,
            variantId,
            [sectionField]: sectionRefVal,
            quantity: Number(comp.quantity) || 1,
            unitPriceSnapshot: Number(comp.unitPrice) || 0,
            listPriceSnapshot: Number(comp.unitPrice) || 0,
            itemNameSnapshot: comp.item_name || null,
            skuSnapshot: comp.variant_code || null,
            lineType: 'bundle_component',
            parentBundleLineId: parentLid,
            optionalLine: isOptional,
            hiddenLine: false,
            lineOrder: currentLocalLines().length + components.length + 2,
            discountType: null,
            discountValue: 0,
            bundleSnapshot: { isOptional }
          })
        );
      }
      const addedLines = [parent, ...components];
      if (blockKey) {
        const block = displaySectionBlocks.value.find((b) => b.key === blockKey);
        if (block) resetDraftRowForNextAdd(block);
        else clearDraftRow(blockKey);
      }
      notifications.success(t('records.linesAddBundleSuccess'));
      const nextLines = [...currentLocalLines(), ...addedLines];
      emit('updated', {
        type: 'lines-added',
        lines: addedLines,
        totals: localTotalsFromLines(nextLines)
      });
    } catch (e) {
      notifications.error(e?.message || t('records.linesAddBundleFailed'));
    } finally {
      busy.value = false;
      bundlePickerBlockKey.value = null;
    }
    return;
  }

  busy.value = true;
  try {
    const res = await apiClient.post(`${documentRecordBase.value}/bundles`, {
      bundleVariantId: String(hit._id),
      priceBookId: selectedPriceBookId.value ? String(selectedPriceBookId.value) : null,
      quantity: 1,
      asOfDate: props.record?.quoteDate ?? props.record?.orderDate ?? props.record?.invoiceDate ?? null,
      includedOptionalComponentVariantIds: includedOptionalComponentVariantIds,
      [sectionField]: sectionRefVal,
      overridePricing: overrideLock.value === true
    });
    if (!res?.success) {
      throw new Error(res?.message || t('records.linesAddBundleFailed'));
    }
    notifications.success(t('records.linesAddBundleSuccess'));
    const parent = res?.data?.parent;
    const components = Array.isArray(res?.data?.components) ? res.data.components : [];
    const addedLines = [parent, ...components].filter(Boolean);
    if (blockKey) {
      const block = displaySectionBlocks.value.find((b) => b.key === blockKey);
      if (block) resetDraftRowForNextAdd(block);
      else clearDraftRow(blockKey);
    }
    if (addedLines.length) {
      emit('updated', {
        type: 'lines-added',
        lines: addedLines,
        ...mutationPayload(res.data)
      });
    } else {
      await refresh();
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesAddBundleFailed'));
  } finally {
    busy.value = false;
    bundlePickerBlockKey.value = null;
  }
}

async function refresh() {
  emit('updated', { type: 'soft-refresh' });
}

async function patchQty(line, raw) {
  if (!linesEditable.value || !lineApiId(line)) return;
  if (isApiMode.value && !recordApiId.value) return;
  const q = Number(raw);
  if (!Number.isFinite(q) || q <= 0) return;

  if (!isApiMode.value) {
    const updated = recomputeLocalLineMoney({ ...line, quantity: q });
    const nextLines = (Array.isArray(props.record?.lines) ? props.record.lines : []).map((l) =>
      lineApiId(l) === lineApiId(line) ? updated : l
    );
    emit('updated', {
      type: 'line-updated',
      line: updated,
      lines: nextLines,
      totals: localTotalsFromLines(nextLines)
    });
    return;
  }

  busy.value = true;
  try {
    const body = {
      ...linesAdapter.value.buildPatchLineBody({ quantity: q })
    };
    if (linesAdapter.value.kind === 'quote') {
      body.overridePricing = overrideLock.value === true;
    }
    const res = await apiClient.patch(`${documentRecordBase.value}/lines/${lineApiId(line)}`, body);
    if (res?.success) {
      const updatedLine = res?.data?.line;
      if (updatedLine) {
        emit('updated', {
          type: 'line-updated',
          line: updatedLine,
          ...mutationPayload(res.data)
        });
      } else {
        await refresh();
      }
    } else {
      notifications.error(res?.message || t('records.linesUpdateFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

async function patchUnitPrice(line, raw) {
  if (!linesEditable.value || !canEditLineUnitPrice.value || !lineApiId(line)) return;
  if (isApiMode.value && !recordApiId.value) return;
  const p = Number(raw);
  if (!Number.isFinite(p) || p < 0) return;
  if (Math.abs(lineUnitPrice(line) - p) < 0.000001) return;

  if (!isApiMode.value) {
    const updated = recomputeLocalLineMoney({
      ...line,
      unitPrice: p,
      unitPriceSnapshot: p
    });
    const nextLines = (Array.isArray(props.record?.lines) ? props.record.lines : []).map((l) =>
      lineApiId(l) === lineApiId(line) ? updated : l
    );
    emit('updated', {
      type: 'line-updated',
      line: updated,
      lines: nextLines,
      totals: localTotalsFromLines(nextLines)
    });
    return;
  }

  busy.value = true;
  try {
    const body = {
      ...linesAdapter.value.buildPatchLineBody({ unitPrice: p })
    };
    const res = await apiClient.patch(`${documentRecordBase.value}/lines/${lineApiId(line)}`, body);
    if (res?.success) {
      const updatedLine = res?.data?.line;
      if (updatedLine) {
        emit('updated', {
          type: 'line-updated',
          line: updatedLine,
          ...mutationPayload(res.data)
        });
      } else {
        await refresh();
      }
    } else {
      notifications.error(res?.message || t('records.linesUpdateFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

function applyCatalogUnitPrice(line) {
  const cat = catalogUnitPrice(line);
  if (cat == null) return;
  void patchUnitPrice(line, cat);
}

function requestRemoveLine(line) {
  if (!linesEditable.value) return;
  linePendingDelete.value = line;
  showDeleteLineModal.value = true;
}

async function confirmRemoveLine() {
  const line = linePendingDelete.value;
  showDeleteLineModal.value = false;
  if (!lineApiId(line)) return;

  if (!isApiMode.value) {
    const nextLines = (Array.isArray(props.record?.lines) ? props.record.lines : []).filter(
      (l) => lineApiId(l) !== lineApiId(line)
    );
    emit('updated', {
      type: 'line-deleted',
      deletedLine: line,
      lines: nextLines,
      totals: localTotalsFromLines(nextLines)
    });
    linePendingDelete.value = null;
    return;
  }

  if (!recordApiId.value) return;
  busy.value = true;
  try {
    const res = await apiClient.delete(`${documentRecordBase.value}/lines/${lineApiId(line)}`, {
      data: { overridePricing: overrideLock.value === true }
    });
    if (res?.success) {
      emit('updated', {
        type: 'line-deleted',
        deletedLine: line,
        ...mutationPayload(res.data)
      });
    } else {
      notifications.error(res?.message || t('records.linesDeleteFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesDeleteFailed'));
  } finally {
    busy.value = false;
    linePendingDelete.value = null;
  }
}

async function recalculate() {
  if (!caps.value.recalculate) return;
  if (isApiMode.value && !recordApiId.value) return;

  if (!isApiMode.value) {
    emitLocalLinesRecalc(currentLocalLines());
    return;
  }

  busy.value = true;
  try {
    const res = await apiClient.post(`${documentRecordBase.value}/recalculate`, {
      overridePricing: overrideLock.value === true
    });
    if (res?.success) {
      const lines = res?.data?.lines;
      if (Array.isArray(lines)) {
        emit('updated', {
          type: 'lines-recalculated',
          lines,
          ...mutationPayload(res.data)
        });
      } else {
        await refresh();
      }
    } else {
      notifications.error(res?.message || t('records.linesRecalculateFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesRecalculateFailed'));
  } finally {
    busy.value = false;
  }
}

async function loadPriceBooks() {
  priceBooksLoading.value = true;
  try {
    const res = await apiClient.get('/catalog/price-books');
    priceBooks.value = unwrapCatalogApiList(res);
  } catch {
    priceBooks.value = [];
  } finally {
    priceBooksLoading.value = false;
  }
}

function onWorkspaceKeydown(event) {
  if (!linesEditable.value || (!props.record?._id && !props.draftMode)) return;
  if (!(event.metaKey || event.ctrlKey) || String(event.key || '').toLowerCase() !== 'k') return;
  const tag = String(event.target?.tagName || '').toLowerCase();
  if (tag === 'textarea') return;
  event.preventDefault();
  event.stopPropagation();
  const block = getDefaultAddBlock();
  if (!block) return;
  if (!hasDraftRow(block.key)) {
    startDraftRow(block);
  } else {
    activeAddBlockKey.value = block.key;
    openDraftSearchWithRecent(block);
    focusDraftSearch(block);
  }
}

function bindWorkspaceKeydown(el) {
  if (!el) return;
  el.addEventListener('keydown', onWorkspaceKeydown, true);
}

function unbindWorkspaceKeydown(el) {
  if (!el) return;
  el.removeEventListener('keydown', onWorkspaceKeydown, true);
}

watch(workspacePanelRef, (el, prev) => {
  unbindWorkspaceKeydown(prev);
  bindWorkspaceKeydown(el);
});

onMounted(() => {
  loadPriceBooks();
  bindWorkspaceKeydown(workspacePanelRef.value);
  window.addEventListener('scroll', syncOpenDraftSearchMenus, true);
  window.addEventListener('resize', syncOpenDraftSearchMenus);
  window.addEventListener('scroll', onDocPickerRepositionClose, true);
  window.addEventListener('resize', onDocPickerRepositionClose);
  document.addEventListener('pointerdown', onDiscountTypeMenuPointerDown, true);
  document.addEventListener('pointerdown', onDocPickerPointerDown, true);
});

onUnmounted(() => {
  document.body.classList.remove('quote-lines-reorder-active');
  unbindWorkspaceKeydown(workspacePanelRef.value);
  window.removeEventListener('scroll', syncOpenDraftSearchMenus, true);
  window.removeEventListener('resize', syncOpenDraftSearchMenus);
  window.removeEventListener('scroll', onDocPickerRepositionClose, true);
  window.removeEventListener('resize', onDocPickerRepositionClose);
  document.removeEventListener('pointerdown', onDiscountTypeMenuPointerDown, true);
  document.removeEventListener('pointerdown', onDocPickerPointerDown, true);
  clearQuoteLinesSession(quoteId.value);
});

function pricingSourceLabel(source) {
  const s = String(source || '').trim();
  if (!s) return '—';
  if (s === 'price_book') return t('records.linesPriceSourcePriceBook');
  if (s === 'variant_fallback') return t('records.linesPriceSourceVariantFallback');
  return s;
}

function configurationSummary(line) {
  const selections = line?.configurationSelections || line?.configurationSnapshot?.selections;
  if (!selections || typeof selections !== 'object') return '';
  const parts = Object.entries(selections)
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
  return parts.join(' · ');
}

function priceProvenanceTitle(line) {
  const book = line?.priceBookNameSnapshot || '—';
  const source = pricingSourceLabel(line?.pricingSourceSnapshot);
  const entry = line?.priceBookEntryIdSnapshot ? String(line.priceBookEntryIdSnapshot) : '—';
  const asOf = line?.pricingAsOfDateSnapshot ? formatUserDate(line.pricingAsOfDateSnapshot) : '—';
  const effectiveFrom = line?.pricingEffectiveFromSnapshot ? formatUserDate(line.pricingEffectiveFromSnapshot) : '—';
  const effectiveTo = line?.pricingEffectiveToSnapshot ? formatUserDate(line.pricingEffectiveToSnapshot) : '—';
  const minQty = Number.isFinite(Number(line?.pricingMinQtySnapshot)) ? String(line.pricingMinQtySnapshot) : '—';

  return t('records.linesPriceProvenanceTooltip', {
    book,
    source,
    entry,
    asOf,
    effectiveFrom,
    effectiveTo,
    minQty
  });
}

defineExpose({
  getDraftPayload() {
    if (!props.draftMode) return null;
    return {
      lines: Array.isArray(props.record?.lines) ? props.record.lines : [],
      sections: Array.isArray(props.record?.sections) ? props.record.sections : [],
      globalDiscountType: props.record?.globalDiscountType ?? null,
      globalDiscountValue: props.record?.globalDiscountValue ?? 0,
      transactionTaxSnapshot: props.record?.transactionTaxSnapshot ?? null,
      chargeDocumentSnapshot: props.record?.chargeDocumentSnapshot ?? null,
      _localTransactionTaxIds: props.record?._localTransactionTaxIds ?? null,
      _localTransactionChargeIds: props.record?._localTransactionChargeIds ?? null
    };
  }
});
</script>

<style scoped>
.quote-lines-workspace {
  margin-top: 0.25rem;
}

.quote-lines-workspace--expanded {
  width: 100%;
  margin-top: 0;
}

.quote-lines-workspace--expanded .quote-lines-workspace__panel {
  width: 100%;
  border-radius: 0.75rem;
}

.quote-lines-workspace__panel {
  isolation: isolate;
}

.quote-lines-table--dragging {
  user-select: none;
}

/* Column widths: Name takes remaining space; other columns stay compact. */
.quote-lines-table {
  table-layout: fixed;
  width: 100%;
}

.quote-lines-col-name {
  width: auto;
}

.quote-lines-col-sku {
  width: 6.5rem;
}

.quote-lines-col-qty {
  width: 5.5rem;
}

.quote-lines-col-unit-price {
  width: 8.5rem;
  min-width: 8.5rem;
  max-width: 8.5rem;
  box-sizing: border-box;
  /* Absolute meta sits below the 2rem control; don't clip it. */
  overflow: visible;
}

/* Extra bottom padding on the cell (not the control box) so row height fits meta. */
.quote-lines-col-unit-price--with-meta {
  padding-bottom: 1.35rem;
}

/*
 * In-flow height = 2rem only so align-top lines up QTY / price / discount.
 * Last/catalog hint is absolute under that control.
 */
.quote-lines-unit-price-cell {
  position: relative;
  display: block;
  width: 100%;
  max-width: 7.5rem;
  height: 2rem;
  margin-left: auto;
  min-width: 0;
  box-sizing: border-box;
}

.quote-lines-unit-price-control {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  height: 2rem;
  min-width: 0;
}

.quote-lines-unit-price-group {
  display: inline-flex;
  align-items: stretch;
  width: 100%;
  max-width: 7.5rem;
  height: 2rem;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 0.375rem;
  border: 1px solid rgb(209 213 219);
  background-color: rgb(255 255 255);
  box-sizing: border-box;
}

.quote-lines-unit-price-group:focus-within {
  border-color: rgb(99 102 241);
  box-shadow: 0 0 0 1px rgb(99 102 241);
}

.dark .quote-lines-unit-price-group {
  border-color: rgb(75 85 99);
  background-color: rgb(31 41 55);
}

.dark .quote-lines-unit-price-group:focus-within {
  border-color: rgb(129 140 248);
  box-shadow: 0 0 0 1px rgb(129 140 248);
}

.quote-lines-unit-price-symbol {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-width: 1.35rem;
  padding: 0 0.25rem 0 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  color: rgb(107 114 128);
  background-color: rgb(249 250 251);
  border-right: 1px solid rgb(229 231 235);
  user-select: none;
}

.dark .quote-lines-unit-price-symbol {
  color: rgb(156 163 175);
  background-color: rgb(55 65 81);
  border-right-color: rgb(75 85 99);
}

.quote-lines-unit-price-value {
  flex: 1 1 auto;
  min-width: 0;
  width: auto;
  height: 100%;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  outline: none !important;
  padding: 0 0.4rem;
  font-size: 0.875rem;
  line-height: 2rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: rgb(17 24 39);
  -webkit-appearance: none;
  appearance: none;
}

.dark .quote-lines-unit-price-value {
  color: rgb(243 244 246);
}

.quote-lines-unit-price-value:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* PO catalog / last-purchase — outside the aligned control height. */
.quote-lines-unit-price-meta {
  position: absolute;
  top: calc(100% + 0.15rem);
  right: 0;
  display: block;
  width: 100%;
  max-width: 7.5rem;
  margin: 0;
  padding: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  line-height: 1.25;
  text-align: right;
  color: rgb(156 163 175);
  pointer-events: none;
}

.dark .quote-lines-unit-price-meta {
  color: rgb(107 114 128);
}

.quote-lines-unit-price-meta--action {
  font-weight: 500;
  color: rgb(180 83 9);
  background: transparent;
  border: 0;
  cursor: pointer;
  pointer-events: auto;
}

.quote-lines-unit-price-meta--action:hover:not(:disabled) {
  text-decoration: underline;
}

.quote-lines-unit-price-meta--action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dark .quote-lines-unit-price-meta--action {
  color: rgb(252 211 77);
}

.quote-lines-col-discount {
  width: 9rem;
}

/* Fixed width — without this, table-layout:fixed gives leftover space to Tax (no rule) + Name. */
.quote-lines-col-tax {
  width: 9rem;
}

.quote-lines-discount-group {
  display: inline-flex;
  align-items: stretch;
  width: 100%;
  max-width: 9rem;
  height: 2rem;
  overflow: hidden;
  border-radius: 0.375rem;
  border: 1px solid rgb(209 213 219);
  background-color: rgb(255 255 255);
  box-sizing: border-box;
}

.quote-lines-discount-group:focus-within {
  border-color: rgb(99 102 241);
  box-shadow: 0 0 0 1px rgb(99 102 241);
}

.dark .quote-lines-discount-group {
  border-color: rgb(75 85 99);
  background-color: rgb(31 41 55);
}

.dark .quote-lines-discount-group:focus-within {
  border-color: rgb(129 140 248);
  box-shadow: 0 0 0 1px rgb(129 140 248);
}

.quote-lines-discount-value {
  flex: 1 1 auto;
  min-width: 0;
  width: auto;
  height: 100%;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  outline: none !important;
  padding: 0 0.5rem;
  font-size: 0.875rem;
  line-height: 2rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: rgb(17 24 39);
  -webkit-appearance: none;
  appearance: none;
}

.dark .quote-lines-discount-value {
  color: rgb(243 244 246);
}

.quote-lines-discount-value:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quote-lines-discount-value::placeholder {
  color: rgb(156 163 175);
  opacity: 1;
}

.dark .quote-lines-discount-value::placeholder {
  color: rgb(107 114 128);
}

.quote-lines-discount-type {
  position: relative;
  display: flex;
  align-items: stretch;
  flex: 0 0 2.5rem;
  width: 2.5rem;
  background-color: rgb(243 244 246);
  border: 0;
  border-left: 1px solid rgb(209 213 219);
  border-radius: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(55 65 81);
}

.dark .quote-lines-discount-type {
  background-color: rgb(55 65 81);
  border-left-color: rgb(75 85 99);
  color: rgb(229 231 235);
}

.quote-lines-discount-type-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0 0.85rem 0 0.25rem;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  color: inherit;
  cursor: pointer;
  outline: none !important;
}

.quote-lines-discount-type-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.quote-lines-discount-type-label {
  line-height: 1;
}

.quote-lines-discount-type-btn::after {
  content: '';
  position: absolute;
  right: 0.3rem;
  top: 50%;
  width: 0;
  height: 0;
  transform: translateY(-35%);
  border-left: 3px solid transparent;
  border-right: 3px solid transparent;
  border-top: 4px solid rgb(17 24 39);
  pointer-events: none;
}

.dark .quote-lines-discount-type-btn::after {
  border-top-color: rgb(229 231 235);
}

.quote-lines-discount-type-menu {
  position: fixed;
  z-index: 10050;
  min-width: 3.5rem;
  overflow: hidden;
  border-radius: 0.375rem;
  border: 1px solid rgb(209 213 219);
  background-color: rgb(255 255 255);
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  padding: 0.25rem;
}

.dark .quote-lines-discount-type-menu {
  border-color: rgb(75 85 99);
  background-color: rgb(31 41 55);
}

.quote-lines-discount-type-option {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  padding: 0.35rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgb(17 24 39);
  cursor: pointer;
}

.quote-lines-discount-type-option:hover,
.quote-lines-discount-type-option.is-selected {
  background-color: rgb(238 242 255);
  color: rgb(67 56 202);
}

.dark .quote-lines-discount-type-option {
  color: rgb(243 244 246);
}

.dark .quote-lines-discount-type-option:hover,
.dark .quote-lines-discount-type-option.is-selected {
  background-color: rgb(49 46 129 / 0.45);
  color: rgb(199 210 254);
}

.quote-lines-col-total {
  width: 7.25rem;
}

.quote-lines-col-actions {
  width: 3rem;
}

/* Align with Unit price → Discount → Tax → Total → Actions columns (from the right). */
.quote-lines-section-summary-label {
  box-sizing: border-box;
  width: 7.25rem;
  flex: 0 0 7.25rem;
}

.quote-lines-section-summary-discount {
  box-sizing: border-box;
  width: 9rem;
  flex: 0 0 9rem;
}

.quote-lines-section-summary-tax {
  box-sizing: border-box;
  width: 9rem;
  flex: 0 0 9rem;
}

.quote-lines-section-summary-total {
  box-sizing: border-box;
  width: 7.25rem;
  flex: 0 0 7.25rem;
}

.quote-lines-section-summary-actions {
  box-sizing: border-box;
  width: 3rem;
  flex: 0 0 3rem;
}

.quote-lines-col-scroll {
  width: 8rem;
}

/* Horizontal scroll anchors: name (left), total + actions (right). */
.quote-lines-table--sticky {
  /* separate is required — collapse ignores z-index and breaks sticky left in Chromium */
  border-collapse: separate;
  border-spacing: 0;
  --ql-name-w: 14rem;
  --ql-actions-w: 3rem;
}

.quote-lines-table--sticky-pricing {
  --ql-name-w: 16rem;
}

.quote-lines-table--sticky-pricing .quote-lines-col-sku {
  min-width: 6.5rem;
}

.quote-lines-table--sticky-pricing .quote-lines-col-total {
  min-width: 7.25rem;
}

.quote-lines-add-actions-foot .quote-lines-add-actions-cell {
  min-width: 17rem;
}

.quote-lines-table-scroll {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  /* Contain horizontal sticky to this scroller (not an overflow-y ancestor). */
  overflow-y: hidden;
}

.quote-lines-table-scroll.overflow-x-auto:hover,
.quote-lines-table-scroll.overflow-x-auto:focus-within {
  scrollbar-color: rgb(203 213 225) transparent;
}

.quote-lines-table--sticky th.quote-lines-sticky,
.quote-lines-table--sticky td.quote-lines-sticky {
  position: sticky;
  z-index: 2;
  background-color: var(--ql-sticky-cell-bg, rgb(255 255 255));
  background-clip: padding-box;
}

.quote-lines-table--sticky thead th.quote-lines-sticky {
  z-index: 5;
  background-color: var(--ql-sticky-head-bg, rgb(249 250 251));
}

.quote-lines-table--sticky thead th:not(.quote-lines-sticky) {
  z-index: 1;
}

.quote-lines-table--sticky tfoot td.quote-lines-sticky {
  z-index: 3;
  background-color: var(--ql-sticky-foot-bg, rgb(249 250 251));
}

.quote-lines-table--sticky tbody tr:hover td.quote-lines-sticky {
  background-color: var(--ql-sticky-hover-bg, rgb(249 250 251));
}

.quote-lines-table--sticky tbody tr.quote-line-row--bundle td.quote-lines-sticky {
  background-color: var(--ql-sticky-bundle-bg, rgb(238 242 255 / 0.4));
}

.quote-lines-table--sticky tbody tr.quote-line-row--bundle:hover td.quote-lines-sticky {
  background-color: var(--ql-sticky-bundle-hover-bg, rgb(224 231 255 / 0.7));
}

/* Definite width required for sticky-left under table-layout:fixed (right cols already have one). */
.quote-lines-table--sticky .quote-lines-sticky-left-name {
  left: 0;
  width: var(--ql-name-w);
  min-width: var(--ql-name-w);
  max-width: var(--ql-name-w);
  z-index: 3;
}

.quote-lines-table--sticky thead th.quote-lines-sticky-left-name {
  z-index: 6;
}

.quote-lines-table--sticky-editable .quote-lines-sticky-right-total {
  right: var(--ql-actions-w);
}

.quote-lines-table--sticky-editable .quote-lines-sticky-right-edge {
  right: 0;
  width: var(--ql-actions-w);
  min-width: var(--ql-actions-w);
  max-width: var(--ql-actions-w);
}

.quote-lines-table--sticky:not(.quote-lines-table--sticky-editable) .quote-lines-sticky-right-edge {
  right: 0;
}

/* Freeze seam: inset hairline when scrolled. */
.quote-lines-table--sticky .quote-lines-sticky-left-name,
.quote-lines-table--sticky-editable .quote-lines-sticky-right-total,
.quote-lines-table--sticky:not(.quote-lines-table--sticky-editable) .quote-lines-sticky-right-edge {
  transition: box-shadow 150ms ease;
}

.quote-lines-table-scroll--reveals-left .quote-lines-table--sticky .quote-lines-sticky-left-name {
  box-shadow: inset -1px 0 0 rgb(229 231 235);
}

.quote-lines-table-scroll--reveals-right .quote-lines-table--sticky-editable .quote-lines-sticky-right-total,
.quote-lines-table-scroll--reveals-right .quote-lines-table--sticky:not(.quote-lines-table--sticky-editable) .quote-lines-sticky-right-edge {
  box-shadow: inset 1px 0 0 rgb(229 231 235);
}


.quote-line-row :deep(input[type='number']) {
  -moz-appearance: textfield;
}

.quote-line-row :deep(input[type='number']::-webkit-outer-spin-button),
.quote-line-row :deep(input[type='number']::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}

.quote-lines-tbody--empty {
  min-height: 3.5rem;
}

.quote-section-block--drop-highlight {
  background-color: rgb(238 242 255 / 0.35);
}

.quote-section-block--drop-active {
  background-color: rgb(224 231 255 / 0.55);
  box-shadow: inset 0 0 0 2px rgb(129 140 248);
}

.quote-section-header--drop-highlight {
  background-color: rgb(238 242 255 / 0.8);
}

.quote-section-header--drop-active {
  background-color: rgb(224 231 255);
  box-shadow: inset 0 0 0 2px rgb(129 140 248);
}

:deep(.quote-line-sortable-chosen) {
  opacity: 0.35;
}

:deep(.quote-line-sortable-ghost) {
  opacity: 1;
  background-color: rgb(238 242 255) !important;
}

:deep(.quote-line-sortable-ghost td) {
  background-color: rgb(238 242 255) !important;
  border-top: 2px dashed rgb(129 140 248);
  border-bottom: 2px dashed rgb(129 140 248);
}

</style>

<style>
/* Dark mode — unscoped so html.dark overrides win over scoped sticky backgrounds. */
.dark .quote-lines-workspace {
  --ql-sticky-cell-bg: rgb(17 24 39);
  --ql-sticky-head-bg: rgb(31 41 55);
  --ql-sticky-foot-bg: rgb(31 41 55);
  --ql-sticky-hover-bg: rgb(31 41 55);
  --ql-sticky-bundle-bg: rgb(30 27 75 / 0.1);
  --ql-sticky-bundle-hover-bg: rgb(30 27 75 / 0.2);
}

.dark .quote-lines-table-scroll.overflow-x-auto:hover,
.dark .quote-lines-table-scroll.overflow-x-auto:focus-within {
  scrollbar-color: rgb(75 85 99) transparent;
}

.dark .quote-lines-table-scroll--reveals-left .quote-lines-table--sticky .quote-lines-sticky-left-name {
  box-shadow: inset -1px 0 0 rgb(55 65 81);
}

.dark .quote-lines-table-scroll--reveals-right .quote-lines-table--sticky-editable .quote-lines-sticky-right-total,
.dark .quote-lines-table-scroll--reveals-right .quote-lines-table--sticky:not(.quote-lines-table--sticky-editable) .quote-lines-sticky-right-edge {
  box-shadow: inset 1px 0 0 rgb(55 65 81);
}

.dark .quote-section-block--drop-highlight {
  background-color: rgb(30 27 75 / 0.25);
}

.dark .quote-section-block--drop-active {
  background-color: rgb(30 27 75 / 0.45);
  box-shadow: inset 0 0 0 2px rgb(129 140 248);
}

.dark .quote-section-header--drop-highlight {
  background-color: rgb(30 27 75 / 0.35);
}

.dark .quote-section-header--drop-active {
  background-color: rgb(30 27 75 / 0.5);
  box-shadow: inset 0 0 0 2px rgb(129 140 248);
}

.dark .quote-line-sortable-ghost,
.dark .quote-line-sortable-ghost td {
  background-color: rgb(30 27 75 / 0.5) !important;
  border-color: rgb(129 140 248);
}

/* Drag clone is appended to document.body (fallback-on-body). */
.quote-lines-reorder-active {
  cursor: grabbing !important;
}

.quote-line-sortable-fallback {
  display: table !important;
  table-layout: fixed;
  width: max-content;
  min-width: 640px;
  max-width: min(100vw - 2rem, 960px);
  background-color: rgb(255 255 255) !important;
  opacity: 1 !important;
  cursor: grabbing !important;
  z-index: 10000;
  border-radius: 0.5rem;
  border: 1px solid rgb(229 231 235);
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 0.12),
    0 8px 10px -6px rgb(0 0 0 / 0.08);
}

.quote-line-sortable-fallback td {
  background-color: rgb(255 255 255) !important;
  padding: 0.5rem 0.75rem;
  white-space: nowrap;
}

.dark .quote-line-sortable-fallback,
.dark .quote-line-sortable-fallback td {
  background-color: rgb(17 24 39) !important;
  border-color: rgb(55 65 81);
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 0.45),
    0 8px 10px -6px rgb(0 0 0 / 0.3);
}

.quote-line-sortable-drag {
  opacity: 1 !important;
}

.quote-line-draft-row td {
  border-top: 1px dashed rgb(199 210 254 / 0.85);
}

.dark .quote-line-draft-row td {
  border-top-color: rgb(67 56 202 / 0.45);
}

.quote-lines-add-actions-foot td {
  background-color: rgb(249 250 251 / 0.8);
}

.dark .quote-lines-add-actions-foot td {
  background-color: rgb(17 24 39 / 0.5);
}
</style>
