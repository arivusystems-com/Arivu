<template>
  <div class="mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-4 sm:p-5 space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h4 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('platform.catalogBundleTitle') }}
          </h4>
          <span
            v-if="revision > 1"
            class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300"
          >
            {{ t('platform.catalogBundleRevision', { n: revision }) }}
          </span>
          <span v-if="saving" class="text-xs text-gray-400">{{ t('states.saving') }}</span>
          <span
            v-else-if="components.length"
            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200"
          >
            {{ t('platform.catalogBundleComponentCount', { count: components.length }) }}
          </span>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {{ t('platform.catalogBundleDesc') }}
        </p>
      </div>
      <button
        v-if="canEdit && components.length"
        type="button"
        class="text-sm px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        @click="openPicker"
      >
        {{ t('platform.catalogBundleAddComponent') }}
      </button>
    </div>

    <div class="space-y-4">
      <h5 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {{ t('platform.catalogBundleGroupRules') }}
      </h5>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {{ t('platform.catalogBundleType') }}
          </label>
          <div class="inline-flex w-full rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
            <button
              type="button"
              class="flex-1 text-sm px-3 py-2 transition-colors"
              :class="bundleType === 'fixed'
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'"
              :disabled="!canEdit || saving"
              @click="setBundleType('fixed')"
            >
              {{ t('platform.catalogBundleTypeFixed') }}
            </button>
            <button
              type="button"
              class="flex-1 text-sm px-3 py-2 transition-colors border-l border-gray-200 dark:border-gray-600"
              :class="bundleType === 'flexible'
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'"
              :disabled="!canEdit || saving"
              @click="setBundleType('flexible')"
            >
              {{ t('platform.catalogBundleTypeFlexible') }}
            </button>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            {{ bundleType === 'fixed'
              ? t('platform.catalogBundleTypeFixedHint')
              : t('platform.catalogBundleTypeFlexibleHint') }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {{ t('platform.catalogBundlePricingMode') }}
          </label>
          <HeadlessSelect
            :model-value="pricingMode"
            :options="pricingModeOptions"
            :disabled="!canEdit || saving"
            teleport
            @update:model-value="setPricingMode"
          />
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{{ pricingHint }}</p>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div v-if="pricingMode === 'discount'">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {{ t('platform.catalogBundleDiscountType') }}
          </label>
          <HeadlessSelect
            :model-value="discountType"
            :options="discountTypeOptions"
            :disabled="!canEdit || saving"
            teleport
            @update:model-value="setDiscountType"
          />
        </div>
        <div v-if="pricingMode === 'discount'">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {{ t('platform.catalogBundleDiscountValue') }}
          </label>
          <input
            v-model.number="discountValue"
            type="number"
            min="0"
            step="any"
            :disabled="!canEdit || saving"
            class="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900"
            @change="scheduleSaveBundle"
          >
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {{ t('platform.catalogBundleEffectiveFrom') }}
          </label>
          <DatePicker
            :model-value="effectiveFrom"
            :disabled="!canEdit || saving"
            :input-class="dateInputClass"
            panel-class="z-[60]"
            @update:model-value="setEffectiveFrom"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {{ t('platform.catalogBundleEffectiveUntil') }}
          </label>
          <DatePicker
            :model-value="effectiveUntil"
            :disabled="!canEdit || saving"
            :input-class="dateInputClass"
            panel-class="z-[60]"
            @update:model-value="setEffectiveUntil"
          />
        </div>

        <div v-if="bundleType === 'flexible'">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {{ t('platform.catalogBundleMinOptional') }}
          </label>
          <input
            v-model.number="minOptionalSelection"
            type="number"
            min="0"
            step="1"
            :disabled="!canEdit || saving"
            class="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900"
            @change="scheduleSaveBundle"
          >
        </div>
        <div v-if="bundleType === 'flexible'">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {{ t('platform.catalogBundleMaxOptional') }}
          </label>
          <input
            v-model.number="maxOptionalSelection"
            type="number"
            min="0"
            step="1"
            :disabled="!canEdit || saving"
            class="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900"
            @change="scheduleSaveBundle"
          >
        </div>
      </div>
    </div>

    <div class="space-y-3 pt-1 border-t border-gray-100 dark:border-gray-700/80">
      <h5 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {{ t('platform.catalogBundleGroupComponents') }}
      </h5>

      <div v-if="loading" class="text-sm text-gray-500 py-4">{{ t('states.loading') }}</div>

      <div
        v-else-if="!components.length"
        class="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/30 px-4 py-10 text-center"
      >
        <p class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('platform.catalogBundleEmpty') }}</p>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('platform.catalogBundleEmptyHint') }}</p>
        <button
          v-if="canEdit"
          type="button"
          class="mt-4 text-sm px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          @click="openPicker"
        >
          {{ t('platform.catalogBundleAddComponent') }}
        </button>
      </div>

      <div v-else class="space-y-3">
        <p v-if="bundleError" class="text-sm text-red-600 dark:text-red-400">{{ bundleError }}</p>

        <ul class="space-y-3">
          <li
            v-for="(row, idx) in components"
            :key="row.componentVariantId"
            class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-3.5 sm:p-4"
          >
            <div class="flex flex-wrap items-start gap-3 sm:gap-4">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ row.item_name || row.variant_code }}
                </p>
                <p class="text-xs text-gray-500 font-mono mt-0.5">
                  <span v-if="row.item_code">{{ row.item_code }} · </span>{{ row.variant_code }}
                </p>
              </div>

              <div class="flex items-end gap-3 flex-wrap">
                <div>
                  <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {{ t('platform.catalogBundleQty') }}
                  </label>
                  <input
                    v-model.number="row.quantity"
                    type="number"
                    min="0.0001"
                    step="any"
                    :disabled="!canEdit"
                    class="w-20 text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 tabular-nums"
                    @change="scheduleSaveBundle"
                  >
                </div>

                <button
                  v-if="canEdit"
                  type="button"
                  class="mb-0.5 text-sm text-red-600 hover:text-red-700 px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                  :aria-label="t('actions.remove')"
                  @click="removeAt(idx)"
                >
                  {{ t('actions.remove') }}
                </button>
              </div>
            </div>

            <div
              v-if="bundleType === 'flexible'"
              class="mt-3 pt-3 border-t border-gray-200/80 dark:border-gray-700 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {{ t('platform.catalogBundleRole') }}
                </label>
                <HeadlessSelect
                  :model-value="row.isOptional ? 'optional' : 'mandatory'"
                  :options="roleOptions"
                  :disabled="!canEdit"
                  teleport
                  button-class="!py-1.5 !text-sm"
                  @update:model-value="(v) => setComponentRole(row, v)"
                />
              </div>

              <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 min-h-[38px] mt-5">
                <input
                  v-model="row.defaultSelected"
                  type="checkbox"
                  class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  :disabled="!canEdit || !row.isOptional"
                  @change="scheduleSaveBundle"
                >
                <span>{{ t('platform.catalogBundleDefaultOn') }}</span>
              </label>

              <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 min-h-[38px] mt-5">
                <input
                  v-model="row.editableQuantity"
                  type="checkbox"
                  class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  :disabled="!canEdit"
                  @change="scheduleSaveBundle"
                >
                <span>{{ t('platform.catalogBundleEditableQty') }}</span>
              </label>

              <div v-if="row.editableQuantity">
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {{ t('platform.catalogBundleMinQty') }}
                </label>
                <input
                  v-model.number="row.minQuantity"
                  type="number"
                  min="0.0001"
                  step="any"
                  :disabled="!canEdit"
                  class="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900"
                  @change="scheduleSaveBundle"
                >
              </div>
              <div v-if="row.editableQuantity">
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {{ t('platform.catalogBundleMaxQty') }}
                </label>
                <input
                  v-model.number="row.maxQuantity"
                  type="number"
                  min="0.0001"
                  step="any"
                  :disabled="!canEdit"
                  class="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900"
                  @change="scheduleSaveBundle"
                >
              </div>
            </div>

            <div
              v-if="bundleType === 'fixed' && row.editableQuantity"
              class="mt-3 pt-3 border-t border-gray-200/80 dark:border-gray-700 grid gap-3 sm:grid-cols-2"
            >
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {{ t('platform.catalogBundleMinQty') }}
                </label>
                <input
                  v-model.number="row.minQuantity"
                  type="number"
                  min="0.0001"
                  step="any"
                  :disabled="!canEdit"
                  class="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900"
                  @change="scheduleSaveBundle"
                >
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {{ t('platform.catalogBundleMaxQty') }}
                </label>
                <input
                  v-model.number="row.maxQuantity"
                  type="number"
                  min="0.0001"
                  step="any"
                  :disabled="!canEdit"
                  class="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900"
                  @change="scheduleSaveBundle"
                >
              </div>
            </div>

            <div class="mt-3 grid gap-3" :class="bundleType === 'fixed' ? 'sm:grid-cols-[1fr_auto]' : ''">
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {{ t('platform.catalogBundleRemarks') }}
                </label>
                <input
                  v-model="row.remarks"
                  type="text"
                  maxlength="500"
                  :disabled="!canEdit"
                  class="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900"
                  :placeholder="t('platform.catalogBundleRemarksPlaceholder')"
                  @change="scheduleSaveBundle"
                >
              </div>
              <label
                v-if="bundleType === 'fixed'"
                class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 sm:mt-6"
              >
                <input
                  v-model="row.editableQuantity"
                  type="checkbox"
                  class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  :disabled="!canEdit"
                  @change="scheduleSaveBundle"
                >
                <span>{{ t('platform.catalogBundleEditableQty') }}</span>
              </label>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <div
      v-if="components.length"
      class="pt-4 border-t border-gray-100 dark:border-gray-700/80 space-y-3"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h5 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('platform.catalogBundleGroupPreview') }}
        </h5>
        <button
          type="button"
          class="text-sm px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-50"
          :disabled="loadingPreview"
          @click="loadPreview"
        >
          {{ loadingPreview ? t('states.loading') : t('platform.catalogBundlePreview') }}
        </button>
      </div>

      <div
        v-if="preview"
        class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4 text-sm space-y-3"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="font-semibold text-gray-900 dark:text-white">
            {{ t('platform.catalogBundlePreviewTotal') }}
            <span class="ml-1 tabular-nums text-indigo-700 dark:text-indigo-300">
              {{ formatMoney(preview.bundleUnitPrice) }} {{ preview.currency }}
            </span>
          </p>
          <span class="text-xs text-gray-500">
            {{ preview.bundleType }} · {{ preview.pricingMode }}
            <span v-if="preview.discountApplied">
              · −{{ formatMoney(preview.discountApplied) }}
            </span>
          </span>
        </div>
        <ul class="divide-y divide-gray-200 dark:divide-gray-700">
          <li
            v-for="line in preview.lines"
            :key="line.componentVariantId"
            class="py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400"
            :class="{ 'opacity-40 line-through': !line.included }"
          >
            <span>
              {{ line.item_name }} × {{ line.quantity }}
              <span
                v-if="line.isOptional"
                class="ml-1.5 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400"
              >{{ t('platform.catalogBundleOptional') }}</span>
            </span>
            <span v-if="line.included" class="tabular-nums font-medium text-gray-800 dark:text-gray-200">
              {{ formatMoney(line.lineTotal) }} {{ line.currency }}
            </span>
          </li>
        </ul>
      </div>
      <p v-else class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('platform.catalogBundlePreviewHint') }}
      </p>
    </div>

    <div v-if="showPicker" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-lg space-y-3 max-h-[80vh] flex flex-col shadow-xl">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white">
          {{ t('platform.catalogBundlePickVariant') }}
        </h4>
        <input
          v-model="searchQuery"
          type="search"
          class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
          :placeholder="t('platform.catalogBundleSearchPlaceholder')"
          @input="debouncedSearch"
        >
        <ul class="flex-1 overflow-y-auto space-y-1 min-h-[120px]">
          <li v-if="searchLoading" class="text-sm text-gray-500 px-2">{{ t('states.loading') }}</li>
          <li
            v-for="hit in searchResults"
            :key="hit._id"
            class="px-3 py-2.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 cursor-pointer text-sm"
            @click="addComponent(hit)"
          >
            <span class="font-medium text-gray-900 dark:text-white">{{ hit.item_name }}</span>
            <span class="block text-xs text-gray-500 font-mono mt-0.5">{{ hit.variant_code }}</span>
          </li>
          <li v-if="!searchLoading && !searchResults.length" class="text-sm text-gray-500 px-2 py-4 text-center">
            {{ t('platform.catalogBundleNoResults') }}
          </li>
        </ul>
        <div class="flex justify-end pt-1 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            class="text-sm px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="showPicker = false"
          >
            {{ t('actions.close') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { formatNumber } from '@/utils/localeFormat';
import { unwrapCatalogApiData } from '@/utils/catalogApi';
import { confirmAction } from '@/composables/useConfirmAction';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import DatePicker from '@/components/common/DatePicker.vue';

const props = defineProps({
  variantId: { type: String, required: true },
  canEdit: { type: Boolean, default: false }
});

const { t } = useI18n();

const dateInputClass =
  'block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20 cursor-pointer';

const pricingModeOptions = computed(() => [
  { value: 'fixed', label: t('platform.catalogBundlePricingFixed') },
  { value: 'rollup', label: t('platform.catalogBundlePricingRollup') },
  { value: 'discount', label: t('platform.catalogBundlePricingDiscount') }
]);

const discountTypeOptions = computed(() => [
  { value: 'percent', label: t('platform.catalogBundleDiscountPercent') },
  { value: 'amount', label: t('platform.catalogBundleDiscountAmount') }
]);

const roleOptions = computed(() => [
  { value: 'mandatory', label: t('platform.catalogBundleMandatory') },
  { value: 'optional', label: t('platform.catalogBundleOptional') }
]);

const loading = ref(false);
const saving = ref(false);
const pricingMode = ref('fixed');
const bundleType = ref('fixed');
const discountType = ref('percent');
const discountValue = ref(0);
const minOptionalSelection = ref(null);
const maxOptionalSelection = ref(null);
const effectiveFrom = ref('');
const effectiveUntil = ref('');
const revision = ref(1);
const components = ref([]);
const preview = ref(null);
const loadingPreview = ref(false);
const bundleError = ref('');
const showPicker = ref(false);
const searchQuery = ref('');
const searchResults = ref([]);
const searchLoading = ref(false);

let searchTimer = null;
let saveTimer = null;

const pricingHint = computed(() => {
  if (pricingMode.value === 'rollup') return t('platform.catalogBundlePricingRollupHint');
  if (pricingMode.value === 'discount') return t('platform.catalogBundlePricingDiscountHint');
  return t('platform.catalogBundlePricingFixedHint');
});

function formatMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return formatNumber(v, { maximumFractionDigits: 4 });
}

function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function mapComponent(c) {
  return {
    componentVariantId: c.componentVariantId,
    quantity: c.quantity ?? 1,
    isOptional: c.isOptional === true,
    defaultSelected: c.defaultSelected === true,
    editableQuantity: c.editableQuantity === true,
    minQuantity: c.minQuantity ?? null,
    maxQuantity: c.maxQuantity ?? null,
    remarks: c.remarks || '',
    sortOrder: c.sortOrder ?? 0,
    variant_code: c.variant_code,
    item_name: c.item_name,
    item_code: c.item_code
  };
}

function applyPayload(payload) {
  pricingMode.value = payload.pricingMode || 'fixed';
  bundleType.value = payload.bundleType || 'fixed';
  discountType.value = payload.discountType || 'percent';
  discountValue.value = payload.discountValue ?? 0;
  minOptionalSelection.value = payload.minOptionalSelection ?? null;
  maxOptionalSelection.value = payload.maxOptionalSelection ?? null;
  effectiveFrom.value = toDateInput(payload.effectiveFrom);
  effectiveUntil.value = toDateInput(payload.effectiveUntil);
  revision.value = payload.revision || 1;
  components.value = (payload.components || []).map(mapComponent);
}

async function loadBundle() {
  if (!props.variantId) return;
  loading.value = true;
  bundleError.value = '';
  try {
    const res = await apiClient.get(`/catalog/variants/${props.variantId}/bundle-components`);
    const payload = unwrapCatalogApiData(res) || {};
    applyPayload(payload);
    preview.value = null;
  } catch (err) {
    if (err?.response?.status === 404) {
      components.value = [];
    }
  } finally {
    loading.value = false;
  }
}

function scheduleSaveBundle() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveBundle, 400);
}

function buildSaveBody() {
  return {
    pricingMode: pricingMode.value,
    bundleType: bundleType.value,
    minOptionalSelection:
      bundleType.value === 'flexible' && minOptionalSelection.value !== '' && minOptionalSelection.value != null
        ? Number(minOptionalSelection.value)
        : null,
    maxOptionalSelection:
      bundleType.value === 'flexible' && maxOptionalSelection.value !== '' && maxOptionalSelection.value != null
        ? Number(maxOptionalSelection.value)
        : null,
    discountType: pricingMode.value === 'discount' ? discountType.value : null,
    discountValue: pricingMode.value === 'discount' ? Number(discountValue.value) || 0 : null,
    effectiveFrom: effectiveFrom.value || null,
    effectiveUntil: effectiveUntil.value || null,
    components: components.value.map((c, index) => ({
      componentVariantId: c.componentVariantId,
      quantity: c.quantity,
      isOptional: bundleType.value === 'flexible' ? c.isOptional === true : false,
      defaultSelected: bundleType.value === 'flexible' && c.isOptional === true ? c.defaultSelected === true : false,
      editableQuantity: c.editableQuantity === true,
      minQuantity: c.editableQuantity && c.minQuantity != null && c.minQuantity !== '' ? c.minQuantity : null,
      maxQuantity: c.editableQuantity && c.maxQuantity != null && c.maxQuantity !== '' ? c.maxQuantity : null,
      remarks: c.remarks || '',
      sortOrder: index
    }))
  };
}

async function saveBundle() {
  if (!props.canEdit || !props.variantId) return;
  saving.value = true;
  bundleError.value = '';
  try {
    const res = await apiClient.put(
      `/catalog/variants/${props.variantId}/bundle-components`,
      buildSaveBody()
    );
    if (res.success === false) {
      throw new Error(res.message || 'Save failed');
    }
    const payload = unwrapCatalogApiData(res) || {};
    applyPayload(payload);
    preview.value = null;
  } catch (err) {
    bundleError.value = err?.response?.data?.message || err.message || t('platform.catalogBundleSaveFailed');
  } finally {
    saving.value = false;
  }
}

function setBundleType(next) {
  if (!props.canEdit || bundleType.value === next) return;
  bundleType.value = next;
  if (next === 'fixed') {
    for (const row of components.value) {
      row.isOptional = false;
      row.defaultSelected = false;
    }
    minOptionalSelection.value = null;
    maxOptionalSelection.value = null;
  }
  scheduleSaveBundle();
}

function onPricingModeChange() {
  if (pricingMode.value === 'discount' && !discountType.value) {
    discountType.value = 'percent';
  }
  scheduleSaveBundle();
}

function setPricingMode(value) {
  pricingMode.value = value || 'fixed';
  onPricingModeChange();
}

function setDiscountType(value) {
  discountType.value = value || 'percent';
  scheduleSaveBundle();
}

function setEffectiveFrom(value) {
  effectiveFrom.value = value || '';
  scheduleSaveBundle();
}

function setEffectiveUntil(value) {
  effectiveUntil.value = value || '';
  scheduleSaveBundle();
}

function setComponentRole(row, value) {
  row.isOptional = value === 'optional';
  onOptionalChange(row);
}

function onOptionalChange(row) {
  if (row.isOptional !== true) {
    row.defaultSelected = false;
  }
  scheduleSaveBundle();
}

async function loadPreview() {
  loadingPreview.value = true;
  try {
    const res = await apiClient.get(`/catalog/variants/${props.variantId}/bundle-expand`);
    preview.value = unwrapCatalogApiData(res) || null;
  } catch (err) {
    bundleError.value = err?.response?.data?.message || err.message || t('platform.catalogBundlePreviewFailed');
    preview.value = null;
  } finally {
    loadingPreview.value = false;
  }
}

function openPicker() {
  showPicker.value = true;
  searchQuery.value = '';
  runSearch();
}

function debouncedSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 300);
}

async function runSearch() {
  searchLoading.value = true;
  try {
    const res = await apiClient.get('/catalog/variants/search', {
      params: {
        q: searchQuery.value,
        excludeVariantId: props.variantId,
        limit: 25
      }
    });
    const existing = new Set(components.value.map((c) => String(c.componentVariantId)));
    const hits = unwrapCatalogApiData(res);
    searchResults.value = (Array.isArray(hits) ? hits : []).filter((v) => !existing.has(String(v._id)));
  } finally {
    searchLoading.value = false;
  }
}

function addComponent(hit) {
  components.value.push({
    componentVariantId: hit._id,
    quantity: 1,
    isOptional: false,
    defaultSelected: false,
    editableQuantity: false,
    minQuantity: null,
    maxQuantity: null,
    remarks: '',
    sortOrder: components.value.length,
    variant_code: hit.variant_code,
    item_name: hit.item_name,
    item_code: hit.item_code
  });
  showPicker.value = false;
  saveBundle();
}

async function removeAt(index) {
  if (!await confirmAction(t('platform.catalogConfirmRemoveBundleComponent'))) return;
  components.value.splice(index, 1);
  scheduleSaveBundle();
}

watch(() => props.variantId, loadBundle, { immediate: true });
</script>
