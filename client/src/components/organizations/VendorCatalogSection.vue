<!--
  Vendor Catalog line section — Vendor ↔ Items supply relationship.
  User fields editable; last purchase fields read-only (system).
-->
<template>
  <section class="space-y-3" data-field-key="vendorCatalog">
    <div
      class="flex flex-wrap items-start justify-between gap-3"
      :class="effectiveHideHeader ? 'items-center' : ''"
    >
      <div v-if="!effectiveHideHeader" class="min-w-0">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('organizations.vendorCatalogTitle') }}
        </h3>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {{ t('organizations.vendorCatalogHint') }}
        </p>
      </div>
      <div v-else class="min-h-4 min-w-0 flex-1">
        <p class="text-xs" :class="statusText ? statusClass : 'text-transparent'" aria-live="polite">
          {{ statusText || '\u00a0' }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div
          v-if="lines.length"
          class="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800"
          role="group"
          :aria-label="t('organizations.vendorCatalogFilterStatus')"
        >
          <button
            v-for="opt in statusFilterOptions"
            :key="opt.id"
            type="button"
            class="rounded-md px-2 py-1 text-xs font-medium transition-colors"
            :class="
              statusFilter === opt.id
                ? 'bg-white text-indigo-700 shadow-sm dark:bg-gray-700 dark:text-indigo-300'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            "
            @click="statusFilter = opt.id"
          >
            {{ opt.label }}
          </button>
        </div>
        <label
          v-if="!disabled && vendorId"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-800"
        >
          <span>{{ t('organizations.vendorCatalogImport') }}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            class="sr-only"
            :disabled="importing"
            @change="onImportFile"
          />
        </label>
        <button
          type="button"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          :disabled="disabled"
          @click="addEmptyRow"
        >
          <PlusIcon class="size-3.5" aria-hidden="true" />
          {{ t('organizations.vendorCatalogAddItem') }}
        </button>
      </div>
    </div>
    <p
      v-if="importMessage"
      class="text-xs"
      :class="importError ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'"
    >
      {{ importMessage }}
    </p>

    <div
      v-if="!lines.length"
      class="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-8 text-center dark:border-gray-700 dark:bg-gray-800/40"
    >
      <CubeIcon class="mx-auto size-8 text-gray-300 dark:text-gray-600" aria-hidden="true" />
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
        {{ t('organizations.vendorCatalogEmpty') }}
      </p>
      <button
        type="button"
        class="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        :disabled="disabled"
        @click="addEmptyRow"
      >
        {{ t('organizations.vendorCatalogAddFirst') }}
      </button>
    </div>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <table class="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-800/80">
          <tr class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <th class="px-3 py-2.5 font-medium">{{ t('organizations.vendorCatalogColItem') }}</th>
            <th class="px-3 py-2.5 font-medium whitespace-nowrap">
              {{ t('organizations.vendorCatalogColVendorCode') }}
            </th>
            <th class="px-3 py-2.5 font-medium whitespace-nowrap">
              {{ t('organizations.vendorCatalogColVendorName') }}
            </th>
            <th class="px-3 py-2.5 font-medium whitespace-nowrap">
              {{ t('organizations.vendorCatalogColPurchasePrice') }}
            </th>
            <th class="px-3 py-2.5 font-medium whitespace-nowrap">
              {{ t('organizations.vendorCatalogColMoq') }}
            </th>
            <th class="px-3 py-2.5 font-medium whitespace-nowrap">
              {{ t('organizations.vendorCatalogColLeadTime') }}
            </th>
            <th class="px-3 py-2.5 font-medium whitespace-nowrap">
              {{ t('organizations.vendorCatalogColPreferred') }}
            </th>
            <th class="px-3 py-2.5 font-medium whitespace-nowrap">
              {{ t('organizations.vendorCatalogColLastPrice') }}
            </th>
            <th class="px-3 py-2.5 font-medium whitespace-nowrap">
              {{ t('organizations.vendorCatalogColLastDate') }}
            </th>
            <th class="px-3 py-2.5 font-medium">{{ t('organizations.vendorCatalogColStatus') }}</th>
            <th class="px-2 py-2.5 w-10"><span class="sr-only">{{ t('actions.remove') }}</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
          <tr
            v-for="row in visibleLines"
            :key="row._localKey"
            class="align-top"
            @keydown="onRowKeydown($event, row)"
          >
            <td class="px-3 py-2 min-w-[12rem] max-w-[16rem]">
              <div :data-row-search="row._localKey">
                <input
                  v-if="!row.variantId"
                  :ref="(el) => setSearchRef(row._localKey, el)"
                  v-model="row.searchQuery"
                  type="search"
                  class="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  :placeholder="t('organizations.vendorCatalogSearchItems')"
                  :disabled="disabled"
                  autocomplete="off"
                  @focus="openSearch(row)"
                  @input="debouncedSearch(row)"
                />
                <div
                  v-else
                  class="flex items-start gap-2"
                >
                  <div class="min-w-0 flex-1">
                    <div class="truncate font-medium text-gray-900 dark:text-white">
                      {{ row.itemName || '—' }}
                    </div>
                    <div
                      v-if="row.variantCode || row.itemCode"
                      class="truncate text-xs text-gray-500 dark:text-gray-400"
                    >
                      {{ [row.variantCode, row.itemCode].filter(Boolean).join(' · ') }}
                    </div>
                  </div>
                  <button
                    v-if="!disabled"
                    type="button"
                    class="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                    @click="clearItem(row)"
                  >
                    {{ t('organizations.vendorCatalogChangeItem') }}
                  </button>
                </div>
              </div>
              <p v-if="rowErrors(index).variantId" class="mt-1 text-xs text-red-600">
                {{ rowErrors(index).variantId }}
              </p>
            </td>
            <td class="px-3 py-2">
              <input
                v-model="row.vendorItemCode"
                type="text"
                class="w-full min-w-[6rem] rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                :disabled="disabled"
                @change="emitChange"
              />
            </td>
            <td class="px-3 py-2">
              <input
                v-model="row.vendorItemName"
                type="text"
                class="w-full min-w-[7rem] rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                :disabled="disabled"
                @change="emitChange"
              />
            </td>
            <td class="px-3 py-2">
              <div class="flex items-center gap-1">
                <input
                  v-model.number="row.purchasePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-24 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  :disabled="disabled"
                  @change="emitChange"
                />
                <span class="text-xs text-gray-400">{{ row.currency || 'USD' }}</span>
              </div>
            </td>
            <td class="px-3 py-2">
              <input
                v-model.number="row.minOrderQty"
                type="number"
                min="0"
                step="1"
                class="w-20 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                :disabled="disabled"
                :placeholder="t('organizations.vendorCatalogMoqPlaceholder')"
                @change="emitChange"
              />
            </td>
            <td class="px-3 py-2">
              <input
                v-model.number="row.leadTimeDays"
                type="number"
                min="0"
                step="1"
                class="w-20 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                :disabled="disabled"
                :placeholder="t('organizations.vendorCatalogLeadPlaceholder')"
                @change="emitChange"
              />
            </td>
            <td class="px-3 py-2 text-center">
              <input
                v-model="row.preferredVendor"
                type="checkbox"
                class="size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800"
                :disabled="disabled"
                :title="t('organizations.vendorCatalogColPreferred')"
                @change="emitChange"
              />
            </td>
            <td class="px-3 py-2 whitespace-nowrap text-gray-500 dark:text-gray-400">
              {{ formatPrice(row.lastPurchasePrice, row.currency) }}
            </td>
            <td class="px-3 py-2 whitespace-nowrap text-gray-500 dark:text-gray-400">
              {{ formatDate(row.lastPurchaseDate) }}
            </td>
            <td class="px-3 py-2">
              <select
                v-model="row.status"
                class="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                :disabled="disabled"
                @change="emitChange"
              >
                <option value="Active">{{ t('organizations.vendorCatalogStatusActive') }}</option>
                <option value="Inactive">{{ t('organizations.vendorCatalogStatusInactive') }}</option>
              </select>
            </td>
            <td class="px-2 py-2">
              <button
                type="button"
                class="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                :disabled="disabled"
                :title="t('actions.remove')"
                @click="removeRow(row)"
              >
                <TrashIcon class="size-4" aria-hidden="true" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Teleported so drawer/table overflow does not clip the menu -->
    <Teleport to="body">
      <ul
        v-if="activeSearchRow && !activeSearchRow.variantId && activeSearchRow.searchOpen"
        data-vendor-catalog-search-menu
        class="fixed z-[10060] max-h-52 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
        :style="searchMenuStyle"
        role="listbox"
      >
        <li
          v-if="activeSearchRow.searchLoading"
          class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400"
        >
          {{ t('states.loading') }}
        </li>
        <li
          v-else-if="!activeSearchRow.searchResults.length"
          class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400"
        >
          {{ t('organizations.vendorCatalogNoMatches') }}
        </li>
        <li
          v-for="hit in activeSearchRow.searchResults"
          :key="String(hit._id)"
          class="cursor-pointer px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
          role="option"
          @mousedown.prevent="selectHit(activeSearchRow, hit)"
        >
          <div class="text-sm font-medium text-gray-900 dark:text-white">
            {{ hit.item_name || hit.variant_code }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            {{
              [hit.variant_code, hit.item_code].filter(Boolean).join(' · ') ||
              t('organizations.vendorCatalogVariant')
            }}
          </div>
        </li>
      </ul>
    </Teleport>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { PlusIcon, TrashIcon, CubeIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  /** Hide title/hint when section stack already provides the heading. */
  hideHeader: { type: Boolean, default: false },
  /** Optional quiet status (e.g. Saving… / Saved). */
  statusText: { type: String, default: '' },
  /** CSS-friendly tone for statusText */
  statusTone: {
    type: String,
    default: 'muted',
    validator: (v) => ['muted', 'success', 'error', 'busy'].includes(v)
  },
  /** Existing vendor org id (edit mode) — optional for client-side catalog load */
  vendorId: { type: String, default: null }
});

const emit = defineEmits(['update:modelValue', 'import-done']);

const { t, d } = useI18n();
const effectiveHideHeader = computed(() => props.hideHeader);

const statusClass = computed(() => {
  switch (props.statusTone) {
    case 'success':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'error':
      return 'text-red-600 dark:text-red-400';
    case 'busy':
      return 'text-indigo-600 dark:text-indigo-400';
    default:
      return 'text-gray-500 dark:text-gray-400';
  }
});

const statusFilter = ref('all'); // all | Active | Inactive
const importing = ref(false);
const importMessage = ref('');
const importError = ref(false);

const statusFilterOptions = computed(() => [
  { id: 'all', label: t('organizations.vendorCatalogFilterAll') },
  { id: 'Active', label: t('organizations.vendorCatalogStatusActive') },
  { id: 'Inactive', label: t('organizations.vendorCatalogStatusInactive') }
]);

const visibleLines = computed(() => {
  if (statusFilter.value === 'all') return lines.value;
  return lines.value.filter((r) => {
    if (!r.variantId) return true; // keep incomplete draft rows visible
    const st = r.status === 'Inactive' ? 'Inactive' : 'Active';
    return st === statusFilter.value;
  });
});

let localKeySeq = 0;
function nextLocalKey() {
  localKeySeq += 1;
  return `vc-${Date.now()}-${localKeySeq}`;
}

function emptyRow() {
  return {
    _localKey: nextLocalKey(),
    _id: null,
    variantId: null,
    itemId: null,
    itemName: null,
    itemCode: null,
    variantCode: null,
    vendorItemCode: '',
    vendorItemName: '',
    purchasePrice: 0,
    currency: 'USD',
    preferredVendor: false,
    minOrderQty: null,
    leadTimeDays: null,
    remarks: '',
    lastPurchasePrice: null,
    lastPurchaseDate: null,
    status: 'Active',
    searchQuery: '',
    searchOpen: false,
    searchLoading: false,
    searchResults: []
  };
}

function fromEntry(entry) {
  return {
    ...emptyRow(),
    _id: entry._id || entry.id || null,
    variantId: entry.variantId ? String(entry.variantId) : null,
    itemId: entry.itemId ? String(entry.itemId) : null,
    itemName: entry.itemName || entry.item_name || null,
    itemCode: entry.itemCode || entry.item_code || null,
    variantCode: entry.variantCode || entry.variant_code || null,
    vendorItemCode: entry.vendorItemCode || '',
    vendorItemName: entry.vendorItemName || '',
    purchasePrice: Number(entry.purchasePrice) || 0,
    currency: entry.currency || 'USD',
    preferredVendor: entry.preferredVendor === true,
    minOrderQty: entry.minOrderQty ?? null,
    leadTimeDays: entry.leadTimeDays ?? null,
    remarks: entry.remarks || '',
    lastPurchasePrice: entry.lastPurchasePrice ?? null,
    lastPurchaseDate: entry.lastPurchaseDate ?? null,
    status: entry.status === 'Inactive' ? 'Inactive' : 'Active',
    searchQuery: '',
    searchOpen: false
  };
}

const lines = ref(
  Array.isArray(props.modelValue) && props.modelValue.length
    ? props.modelValue.map((r) =>
        r.variantId || r._localKey ? { ...emptyRow(), ...fromEntry(r), _localKey: r._localKey || nextLocalKey() } : fromEntry(r)
      )
    : []
);

const searchTimers = {};
const searchRefs = {};
/** @type {import('vue').Ref<{ top: number, left: number, width: number }>} */
const searchMenuRect = ref({ top: 0, left: 0, width: 240 });

const activeSearchRow = computed(() =>
  lines.value.find((r) => r.searchOpen && !r.variantId) || null
);

const searchMenuStyle = computed(() => ({
  top: `${searchMenuRect.value.top}px`,
  left: `${searchMenuRect.value.left}px`,
  width: `${Math.max(searchMenuRect.value.width, 220)}px`
}));

function setSearchRef(key, el) {
  if (el) searchRefs[key] = el;
  else delete searchRefs[key];
}

function positionSearchMenu(row) {
  const el = searchRefs[row._localKey];
  if (!el || typeof el.getBoundingClientRect !== 'function') return;
  const rect = el.getBoundingClientRect();
  const menuMaxH = 208;
  const gap = 4;
  const width = Math.max(rect.width, 220);
  const spaceBelow = window.innerHeight - rect.bottom - gap;
  const openUp = spaceBelow < 140 && rect.top > spaceBelow;
  let top = openUp ? rect.top - menuMaxH - gap : rect.bottom + gap;
  top = Math.min(Math.max(8, top), window.innerHeight - 48);
  let left = rect.left;
  left = Math.min(Math.max(8, left), window.innerWidth - width - 8);
  searchMenuRect.value = { top, left, width };
}

function schedulePosition(row) {
  nextTick(() => positionSearchMenu(row));
}

function rowErrors() {
  return {};
}

function emitChange() {
  const payload = lines.value
    .filter((r) => r.variantId)
    .map((r) => ({
      _id: r._id || undefined,
      variantId: r.variantId,
      itemId: r.itemId,
      itemName: r.itemName,
      itemCode: r.itemCode,
      variantCode: r.variantCode,
      vendorItemCode: r.vendorItemCode || null,
      vendorItemName: r.vendorItemName || null,
      purchasePrice: Number(r.purchasePrice) || 0,
      currency: r.currency || 'USD',
      preferredVendor: r.preferredVendor === true,
      minOrderQty:
        r.minOrderQty != null && r.minOrderQty !== '' && Number.isFinite(Number(r.minOrderQty))
          ? Number(r.minOrderQty)
          : null,
      leadTimeDays:
        r.leadTimeDays != null && r.leadTimeDays !== '' && Number.isFinite(Number(r.leadTimeDays))
          ? Number(r.leadTimeDays)
          : null,
      remarks: r.remarks ? String(r.remarks).trim() : null,
      lastPurchasePrice: r.lastPurchasePrice,
      lastPurchaseDate: r.lastPurchaseDate,
      status: r.status === 'Inactive' ? 'Inactive' : 'Active'
    }));
  emit('update:modelValue', payload);
}

function addEmptyRow() {
  // Close any open search first
  for (const r of lines.value) r.searchOpen = false;
  lines.value = [...lines.value, emptyRow()];
}

function removeRow(rowOrIndex) {
  if (typeof rowOrIndex === 'number') {
    lines.value = lines.value.filter((_, i) => i !== rowOrIndex);
  } else {
    const key = rowOrIndex?._localKey;
    lines.value = lines.value.filter((r) => r._localKey !== key);
  }
  emitChange();
}

function onRowKeydown(event, row) {
  if (props.disabled) return;
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    addEmptyRow();
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    const tag = (event.target && event.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      if (event.key === 'Backspace' && String(event.target.value || '').length) return;
      // Only remove row on Delete (not Backspace) inside inputs to avoid friction
      if (event.key !== 'Delete') return;
    }
    if (!row.variantId && !String(row.searchQuery || '').trim()) {
      event.preventDefault();
      removeRow(row);
    }
  }
}

function parseCsvText(text) {
  const linesIn = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!linesIn.length) return [];
  const split = (line) => {
    const cells = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        inQ = !inQ;
        continue;
      }
      if (ch === ',' && !inQ) {
        cells.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  };
  const header = split(linesIn[0]).map((h) => h.toLowerCase().replace(/\s+/g, ''));
  const idx = (names) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const iItem = idx(['itemcode', 'item_code', 'sku']);
  const iVar = idx(['variantcode', 'variant_code']);
  const iVCode = idx(['vendoritemcode', 'vendor_item_code', 'vendorcode']);
  const iVName = idx(['vendoritemname', 'vendor_item_name', 'vendorname']);
  const iPrice = idx(['purchaseprice', 'purchase_price', 'price']);
  const iCur = idx(['currency']);
  const iStatus = idx(['status']);
  const rows = [];
  for (let r = 1; r < linesIn.length; r += 1) {
    const cells = split(linesIn[r]);
    rows.push({
      itemCode: iItem >= 0 ? cells[iItem] : '',
      variantCode: iVar >= 0 ? cells[iVar] : '',
      vendorItemCode: iVCode >= 0 ? cells[iVCode] : '',
      vendorItemName: iVName >= 0 ? cells[iVName] : '',
      purchasePrice: iPrice >= 0 ? cells[iPrice] : 0,
      currency: iCur >= 0 ? cells[iCur] : '',
      status: iStatus >= 0 ? cells[iStatus] : 'Active'
    });
  }
  return rows;
}

async function onImportFile(event) {
  const file = event?.target?.files?.[0];
  if (event?.target) event.target.value = '';
  if (!file || !props.vendorId || props.disabled) return;
  importing.value = true;
  importMessage.value = '';
  importError.value = false;
  try {
    const text = await file.text();
    const rows = parseCsvText(text);
    if (!rows.length) {
      importError.value = true;
      importMessage.value = t('organizations.vendorCatalogImportEmpty');
      return;
    }
    const res = await apiClient.post(
      `/organizations/${props.vendorId}/vendor-catalog/import`,
      { rows }
    );
    if (res?.success === false) {
      importError.value = true;
      importMessage.value = res?.message || t('organizations.vendorCatalogImportFailed');
      return;
    }
    const data = res?.data ?? res;
    const next = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    const errCount = Array.isArray(res?.errors) ? res.errors.length : 0;
    const imported = Number(res?.imported) || next.length;
    lines.value = next.map((r) => fromEntry(r));
    emit('import-done', {
      entries: next,
      revision: res?.revision || null
    });
    emitChange();
    importError.value = errCount > 0 && imported === 0;
    importMessage.value = t('organizations.vendorCatalogImportResult', {
      count: imported,
      errors: errCount
    });
  } catch (e) {
    importError.value = true;
    importMessage.value =
      e?.response?.data?.message || e?.message || t('organizations.vendorCatalogImportFailed');
  } finally {
    importing.value = false;
  }
}

function clearItem(row) {
  for (const r of lines.value) {
    if (r !== row) r.searchOpen = false;
  }
  row.variantId = null;
  row.itemId = null;
  row.itemName = null;
  row.itemCode = null;
  row.variantCode = null;
  row.searchQuery = '';
  row.searchOpen = true;
  emitChange();
  schedulePosition(row);
  runSearch(row);
}

function openSearch(row) {
  for (const r of lines.value) {
    if (r !== row) r.searchOpen = false;
  }
  row.searchOpen = true;
  schedulePosition(row);
  if (!row.searchResults?.length) {
    runSearch(row);
  }
}

function debouncedSearch(row) {
  const key = row._localKey;
  clearTimeout(searchTimers[key]);
  searchTimers[key] = setTimeout(() => runSearch(row), 250);
}

async function runSearch(row) {
  row.searchLoading = true;
  row.searchOpen = true;
  schedulePosition(row);
  try {
    const res = await apiClient.get('/catalog/variants/search', {
      params: { q: row.searchQuery || '', limit: 12 }
    });
    const data = res?.data ?? res;
    const hits = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    const used = new Set(
      lines.value.map((r) => String(r.variantId || '')).filter(Boolean)
    );
    row.searchResults = hits.filter((h) => !used.has(String(h._id)) || String(h._id) === String(row.variantId));
    schedulePosition(row);
  } catch {
    row.searchResults = [];
  } finally {
    row.searchLoading = false;
  }
}

function selectHit(row, hit) {
  row.variantId = String(hit._id);
  row.itemId = hit.item_id ? String(hit.item_id) : null;
  row.itemName = hit.item_name || null;
  row.itemCode = hit.item_code || null;
  row.variantCode = hit.variant_code || null;
  row.currency = (hit.currency || row.currency || 'USD').toUpperCase();
  if (!row.purchasePrice) {
    row.purchasePrice = Number(hit.cost_price ?? hit.selling_price ?? 0) || 0;
  }
  if (!row.vendorItemName && hit.item_name) {
    row.vendorItemName = hit.item_name;
  }
  row.searchOpen = false;
  row.searchQuery = '';
  emitChange();
}

function formatPrice(value, currency) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: (currency || 'USD').toUpperCase(),
      maximumFractionDigits: 2
    }).format(n);
  } catch {
    return String(n);
  }
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return d(new Date(value), 'short');
  } catch {
    return String(value).slice(0, 10);
  }
}

function onDocumentClick(e) {
  const target = e.target;
  if (!(target instanceof Element)) return;
  if (target.closest('[data-vendor-catalog-search-menu]')) return;
  for (const row of lines.value) {
    if (!row.searchOpen) continue;
    const wrap = document.querySelector(`[data-row-search="${row._localKey}"]`);
    if (wrap && wrap.contains(target)) continue;
    row.searchOpen = false;
  }
}

function onReposition() {
  const row = activeSearchRow.value;
  if (row) positionSearchMenu(row);
}

function linkedVariantKey(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r?.variantId)
    .map((r) => String(r.variantId))
    .sort()
    .join('|');
}

/**
 * Patch server metadata onto existing rows without remounting the grid
 * (preserves focus + scroll during autosave).
 */
function applyServerState(serverRows) {
  const byVariant = new Map();
  for (const row of Array.isArray(serverRows) ? serverRows : []) {
    if (!row?.variantId) continue;
    byVariant.set(String(row.variantId), row);
  }
  for (const line of lines.value) {
    if (!line.variantId) continue;
    const s = byVariant.get(String(line.variantId));
    if (!s) continue;
    line._id = s._id || s.id || line._id;
    if (s.lastPurchasePrice != null) line.lastPurchasePrice = s.lastPurchasePrice;
    if (s.lastPurchaseDate != null) line.lastPurchaseDate = s.lastPurchaseDate;
  }
}

watch(
  () => props.modelValue,
  (next) => {
    if (!Array.isArray(next)) return;
    // Only remount when linked variants change identity — not on parent re-emit.
    if (linkedVariantKey(next) === linkedVariantKey(lines.value)) {
      // Soft-merge missing server ids / last-purchase without replacing rows
      applyServerState(next);
      return;
    }
    // Preserve incomplete (searching) rows when hydrating a new linked set
    const incomplete = lines.value.filter((r) => !r.variantId);
    const mapped = next.filter((r) => r?.variantId).map((r) => fromEntry(r));
    lines.value = incomplete.length ? [...mapped, ...incomplete] : mapped;
  },
  { deep: true }
);

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  window.addEventListener('resize', onReposition);
  window.addEventListener('scroll', onReposition, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  window.removeEventListener('resize', onReposition);
  window.removeEventListener('scroll', onReposition, true);
  Object.values(searchTimers).forEach(clearTimeout);
});

defineExpose({
  getEntries() {
    return lines.value
      .filter((r) => r.variantId)
      .map((r) => ({
        variantId: r.variantId,
        vendorItemCode: r.vendorItemCode || null,
        vendorItemName: r.vendorItemName || null,
        purchasePrice: Number(r.purchasePrice) || 0,
        currency: r.currency || 'USD',
        status: r.status === 'Inactive' ? 'Inactive' : 'Active'
      }));
  },
  applyServerState
});
</script>
