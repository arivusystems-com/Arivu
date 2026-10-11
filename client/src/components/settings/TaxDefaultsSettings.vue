<template>
  <div class="max-w-2xl space-y-6" :class="hasChanges ? SETTINGS_SAVE_BAR_CONTENT_CLASS : ''">
    <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.taxDefaultsDesc') }}</p>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>

    <form v-else class="space-y-6" @submit.prevent="save">
      <section class="space-y-4 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div>
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.taxTabDefaults') }}</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.taxDefaultsDesc') }}</p>
        </div>

        <div
          v-for="field in taxListFields"
          :key="field.key"
          class="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
        >
          <p class="mb-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{{ t(field.labelKey) }}</p>
          <div class="max-h-40 space-y-2 overflow-y-auto">
            <label
              v-for="tax in activeTaxes"
              :key="`${field.key}-${tax._id}`"
              class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
            >
              <HeadlessCheckbox
                :model-value="form[field.key].includes(String(tax._id))"
                @update:model-value="(checked) => toggleTaxId(field.key, String(tax._id), checked)"
              />
              <span>{{ tax.name }} ({{ tax.taxValue }}%)</span>
            </label>
            <p v-if="!activeTaxes.length" class="text-xs text-gray-500">{{ t('settings.taxNoRates') }}</p>
          </div>
        </div>

        <div class="space-y-1">
          <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.taxDefaultPurchaseGroup') }}</label>
          <HeadlessSelect
            v-model="form.defaultPurchaseTaxGroupId"
            :options="groupOptions"
            :placeholder="t('settings.taxNoneOption')"
          />
        </div>

        <div class="space-y-1">
          <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.taxDefaultSalesGroup') }}</label>
          <HeadlessSelect
            v-model="form.defaultSalesTaxGroupId"
            :options="groupOptions"
            :placeholder="t('settings.taxNoneOption')"
          />
        </div>
      </section>
    </form>

    <SettingsSaveBar
      :visible="!loading && hasChanges"
      :saving="saving"
      :error="saveError"
      @reset="resetForm"
      @save="save"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import { SETTINGS_SAVE_BAR_CONTENT_CLASS } from '@/components/settings/settingsSaveBar';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';

const { t } = useI18n();

const loading = ref(false);
const saving = ref(false);
const saveError = ref('');
const activeTaxes = ref([]);
const groups = ref([]);
const baseline = ref('');
const baselineData = ref(null);

const taxListFields = [
  { key: 'defaultPurchaseTaxIds', labelKey: 'settings.taxDefaultPurchase' },
  { key: 'defaultSalesTaxIds', labelKey: 'settings.taxDefaultSales' },
  { key: 'defaultItemTaxIds', labelKey: 'settings.taxDefaultItem' },
  { key: 'defaultServiceTaxIds', labelKey: 'settings.taxDefaultService' }
];

const form = reactive({
  defaultPurchaseTaxIds: [],
  defaultSalesTaxIds: [],
  defaultItemTaxIds: [],
  defaultServiceTaxIds: [],
  defaultPurchaseTaxGroupId: null,
  defaultSalesTaxGroupId: null
});

const groupOptions = computed(() => [
  { value: null, label: t('settings.taxNoneOption') },
  ...groups.value.map((g) => ({ value: String(g._id), label: g.name }))
]);

function unwrapList(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
}

function unwrapData(res) {
  return res?.data ?? res;
}

function asIdList(ids) {
  return (ids || []).map((id) => String(id));
}

function snapshot() {
  return JSON.stringify({
    defaultPurchaseTaxIds: [...form.defaultPurchaseTaxIds].sort(),
    defaultSalesTaxIds: [...form.defaultSalesTaxIds].sort(),
    defaultItemTaxIds: [...form.defaultItemTaxIds].sort(),
    defaultServiceTaxIds: [...form.defaultServiceTaxIds].sort(),
    defaultPurchaseTaxGroupId: form.defaultPurchaseTaxGroupId,
    defaultSalesTaxGroupId: form.defaultSalesTaxGroupId
  });
}

const hasChanges = computed(() => baseline.value !== '' && snapshot() !== baseline.value);

function toggleTaxId(fieldKey, id, checked) {
  const list = form[fieldKey];
  if (checked) {
    if (!list.includes(id)) list.push(id);
  } else {
    form[fieldKey] = list.filter((x) => x !== id);
  }
}

function applyDefaults(defaults) {
  const next = {
    defaultPurchaseTaxIds: asIdList(defaults.defaultPurchaseTaxIds),
    defaultSalesTaxIds: asIdList(defaults.defaultSalesTaxIds),
    defaultItemTaxIds: asIdList(defaults.defaultItemTaxIds),
    defaultServiceTaxIds: asIdList(defaults.defaultServiceTaxIds),
    defaultPurchaseTaxGroupId: defaults.defaultPurchaseTaxGroupId
      ? String(defaults.defaultPurchaseTaxGroupId)
      : null,
    defaultSalesTaxGroupId: defaults.defaultSalesTaxGroupId
      ? String(defaults.defaultSalesTaxGroupId)
      : null
  };
  Object.assign(form, {
    ...next,
    defaultPurchaseTaxIds: [...next.defaultPurchaseTaxIds],
    defaultSalesTaxIds: [...next.defaultSalesTaxIds],
    defaultItemTaxIds: [...next.defaultItemTaxIds],
    defaultServiceTaxIds: [...next.defaultServiceTaxIds]
  });
  baselineData.value = {
    ...next,
    defaultPurchaseTaxIds: [...next.defaultPurchaseTaxIds],
    defaultSalesTaxIds: [...next.defaultSalesTaxIds],
    defaultItemTaxIds: [...next.defaultItemTaxIds],
    defaultServiceTaxIds: [...next.defaultServiceTaxIds]
  };
  baseline.value = snapshot();
}

function resetForm() {
  if (baselineData.value) applyDefaults(baselineData.value);
  saveError.value = '';
}

async function load() {
  loading.value = true;
  try {
    const [defaultsRes, taxesRes, groupsRes] = await Promise.all([
      apiClient.get('/taxes/defaults'),
      apiClient.get('/taxes'),
      apiClient.get('/taxes/groups')
    ]);
    activeTaxes.value = unwrapList(taxesRes);
    groups.value = unwrapList(groupsRes);
    applyDefaults(unwrapData(defaultsRes) || {});
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  saveError.value = '';
  try {
    await apiClient.put('/taxes/defaults', {
      defaultPurchaseTaxIds: form.defaultPurchaseTaxIds,
      defaultSalesTaxIds: form.defaultSalesTaxIds,
      defaultItemTaxIds: form.defaultItemTaxIds,
      defaultServiceTaxIds: form.defaultServiceTaxIds,
      defaultPurchaseTaxGroupId: form.defaultPurchaseTaxGroupId || null,
      defaultSalesTaxGroupId: form.defaultSalesTaxGroupId || null
    });
    baseline.value = snapshot();
    baselineData.value = {
      defaultPurchaseTaxIds: [...form.defaultPurchaseTaxIds],
      defaultSalesTaxIds: [...form.defaultSalesTaxIds],
      defaultItemTaxIds: [...form.defaultItemTaxIds],
      defaultServiceTaxIds: [...form.defaultServiceTaxIds],
      defaultPurchaseTaxGroupId: form.defaultPurchaseTaxGroupId,
      defaultSalesTaxGroupId: form.defaultSalesTaxGroupId
    };
  } catch (err) {
    saveError.value = err?.response?.data?.message || err?.message || t('states.genericFailure');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
