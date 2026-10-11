<template>
  <div class="max-w-2xl space-y-6">
    <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.chargeDefaultsDesc') }}</p>
    <div v-if="loading" class="flex justify-center py-8">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>
    <form v-else class="space-y-4" @submit.prevent="save">
      <div
        v-for="field in fields"
        :key="field.key"
        class="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
      >
        <p class="mb-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{{ t(field.labelKey) }}</p>
        <div class="max-h-40 space-y-2 overflow-y-auto">
          <label
            v-for="charge in activeCharges"
            :key="`${field.key}-${charge._id}`"
            class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
          >
            <HeadlessCheckbox
              :model-value="form[field.key].includes(String(charge._id))"
              @update:model-value="(checked) => toggleId(field.key, String(charge._id), checked)"
            />
            <span>{{ charge.name }}</span>
          </label>
          <p v-if="!activeCharges.length" class="text-xs text-gray-500">{{ t('settings.chargeNoRates') }}</p>
        </div>
      </div>
      <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      <button
        type="submit"
        :disabled="saving"
        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {{ saving ? t('states.saving') : t('actions.save') }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';

const { t } = useI18n();
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const activeCharges = ref([]);
const form = reactive({
  defaultSalesChargeIds: [],
  defaultPurchaseChargeIds: [],
  defaultItemChargeIds: []
});

const fields = [
  { key: 'defaultSalesChargeIds', labelKey: 'settings.chargeDefaultSales' },
  { key: 'defaultPurchaseChargeIds', labelKey: 'settings.chargeDefaultPurchase' },
  { key: 'defaultItemChargeIds', labelKey: 'settings.chargeDefaultItem' }
];

function toggleId(key, id, checked) {
  const list = form[key];
  if (checked) {
    if (!list.includes(id)) list.push(id);
  } else {
    form[key] = list.filter((x) => x !== id);
  }
}

function unwrapList(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
}

function unwrapData(res) {
  return res?.data ?? res;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [chargesRes, defaultsRes] = await Promise.all([
      apiClient.get('/charges'),
      apiClient.get('/charges/defaults')
    ]);
    activeCharges.value = unwrapList(chargesRes);
    const d = unwrapData(defaultsRes) || {};
    form.defaultSalesChargeIds = (d.defaultSalesChargeIds || []).map(String);
    form.defaultPurchaseChargeIds = (d.defaultPurchaseChargeIds || []).map(String);
    form.defaultItemChargeIds = (d.defaultItemChargeIds || []).map(String);
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('states.genericFailure');
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  error.value = '';
  try {
    await apiClient.put('/charges/defaults', {
      defaultSalesChargeIds: form.defaultSalesChargeIds,
      defaultPurchaseChargeIds: form.defaultPurchaseChargeIds,
      defaultItemChargeIds: form.defaultItemChargeIds
    });
  } catch (err) {
    error.value = err?.response?.data?.message || t('states.genericFailure');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
