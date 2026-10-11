<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="max-w-2xl text-sm text-gray-500 dark:text-gray-400">{{ t('settings.chargeRatesDesc') }}</p>
      <div class="flex flex-wrap items-center gap-3">
        <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <HeadlessCheckbox v-model="showInactive" @update:model-value="loadCharges" />
          {{ t('settings.chargeShowInactive') }}
        </label>
        <input
          v-model="search"
          type="search"
          class="block rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white"
          :placeholder="t('settings.chargeSearchPlaceholder')"
          @input="debouncedLoad"
        />
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          @click="openCreate"
        >
          {{ t('settings.chargeAddRate') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>
    <div
      v-else-if="loadError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
    >
      {{ loadError }}
    </div>
    <div
      v-else-if="!charges.length"
      class="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400"
    >
      {{ t('settings.chargeNoRates') }}
    </div>

    <div v-else class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table class="min-w-full text-sm">
        <thead class="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
          <tr>
            <th class="px-3 py-2.5">{{ t('settings.chargeColName') }}</th>
            <th class="px-3 py-2.5">{{ t('settings.chargeColType') }}</th>
            <th class="px-3 py-2.5">{{ t('settings.chargeColValue') }}</th>
            <th class="px-3 py-2.5">{{ t('settings.chargeColScope') }}</th>
            <th class="px-3 py-2.5">{{ t('settings.chargeColStatus') }}</th>
            <th class="px-3 py-2.5 text-right">{{ t('actions.edit') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-for="row in charges" :key="row._id" class="hover:bg-gray-50 dark:hover:bg-gray-700/40">
            <td class="px-3 py-2.5 text-gray-900 dark:text-white">
              {{ row.name }}
              <span v-if="row.isDefault" class="ml-1 text-xs text-indigo-600 dark:text-indigo-400">({{ t('settings.catalogPriceBookDefault') }})</span>
            </td>
            <td class="px-3 py-2.5 text-gray-700 dark:text-gray-300">{{ typeLabel(row.chargeType) }}</td>
            <td class="px-3 py-2.5 text-gray-700 dark:text-gray-300">{{ formatValue(row) }}</td>
            <td class="px-3 py-2.5 text-gray-700 dark:text-gray-300">{{ scopeLabel(row.scope) }}</td>
            <td class="px-3 py-2.5">
              <span
                class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                :class="row.status === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
              >
                {{ row.status === 'ACTIVE' ? t('settings.chargeStatusActive') : t('settings.chargeStatusInactive') }}
              </span>
            </td>
            <td class="space-x-2 whitespace-nowrap px-3 py-2.5 text-right">
              <button type="button" class="text-sm text-indigo-600 hover:underline dark:text-indigo-400" @click="openEdit(row)">{{ t('actions.edit') }}</button>
              <button type="button" class="text-sm text-gray-600 hover:underline dark:text-gray-300" @click="toggleStatus(row)">
                {{ row.status === 'ACTIVE' ? t('settings.chargeDeactivate') : t('settings.chargeActivate') }}
              </button>
              <button type="button" class="text-sm text-red-600 hover:underline dark:text-red-400" @click="askDelete(row)">{{ t('actions.delete') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <TransitionRoot as="template" :show="showForm">
      <Dialog class="relative z-50" @close="showForm = false">
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" />
        <div class="fixed inset-0 z-10 overflow-y-auto">
          <div class="flex min-h-full items-end justify-center p-4 sm:items-center">
            <DialogPanel class="relative w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-800">
              <form @submit.prevent="saveCharge">
                <div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
                  <DialogTitle class="text-base font-semibold text-gray-900 dark:text-white">
                    {{ editingId ? t('settings.chargeEditTitle') : t('settings.chargeNewTitle') }}
                  </DialogTitle>
                </div>
                <div class="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
                  <div class="space-y-1">
                    <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.chargeName') }} *</label>
                    <input v-model="form.name" type="text" required class="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700/50 dark:text-white" />
                  </div>
                  <div class="space-y-1">
                    <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.chargeCode') }}</label>
                    <input v-model="form.code" type="text" class="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700/50 dark:text-white" />
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1">
                      <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.chargeType') }} *</label>
                      <HeadlessSelect v-model="form.chargeType" :options="typeOptions" />
                    </div>
                    <div class="space-y-1">
                      <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.chargeValue') }} *</label>
                      <input v-model="form.chargeValue" type="number" min="0" step="0.01" required class="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700/50 dark:text-white" />
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1">
                      <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.chargeScope') }} *</label>
                      <HeadlessSelect v-model="form.scope" :options="scopeOptions" />
                    </div>
                    <div class="space-y-1">
                      <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.chargeApplicableOn') }} *</label>
                      <HeadlessSelect v-model="form.applicableOn" :options="applicableOptions" />
                    </div>
                  </div>
                  <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <HeadlessCheckbox v-model="form.isDefault" />
                    {{ t('settings.chargeIsDefault') }}
                  </label>
                  <p v-if="formError" class="text-sm text-red-600 dark:text-red-400">{{ formError }}</p>
                </div>
                <div class="flex justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
                  <button type="button" class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300" @click="showForm = false">{{ t('actions.cancel') }}</button>
                  <button type="submit" :disabled="saving" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                    {{ saving ? t('states.saving') : t('actions.save') }}
                  </button>
                </div>
              </form>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>

    <DeleteConfirmationModal
      :show="!!pendingDelete"
      :title="t('actions.delete')"
      :message="t('settings.chargeDeleteConfirm')"
      :deleting="deleting"
      @confirm="confirmDelete"
      @close="pendingDelete = null"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionRoot } from '@headlessui/vue';
import apiClient from '@/utils/apiClient';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';
import { formatCurrencyValue } from '@/utils/currencyOptions';
import { useAuthStore } from '@/stores/authRegistry';

const { t } = useI18n();
const authStore = useAuthStore();

const charges = ref([]);
const loading = ref(false);
const loadError = ref('');
const search = ref('');
const showInactive = ref(false);
const showForm = ref(false);
const editingId = ref(null);
const saving = ref(false);
const formError = ref('');
const pendingDelete = ref(null);
const deleting = ref(false);

const form = reactive({
  name: '',
  code: '',
  chargeType: 'FIXED_AMOUNT',
  chargeValue: 0,
  scope: 'TRANSACTION',
  applicableOn: 'BOTH',
  status: 'ACTIVE',
  isDefault: false
});

const typeOptions = computed(() => [
  { value: 'FIXED_AMOUNT', label: t('settings.chargeTypeFixed') },
  { value: 'PERCENTAGE', label: t('settings.chargeTypePercentage') }
]);
const scopeOptions = computed(() => [
  { value: 'ITEM', label: t('settings.taxScopeItem') },
  { value: 'TRANSACTION', label: t('settings.taxScopeTransaction') },
  { value: 'BOTH', label: t('settings.taxScopeBoth') }
]);
const applicableOptions = computed(() => [
  { value: 'PURCHASE', label: t('settings.taxApplicablePurchase') },
  { value: 'SALES', label: t('settings.taxApplicableSales') },
  { value: 'BOTH', label: t('settings.taxApplicableBoth') }
]);

function unwrapList(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
}

let debounceTimer = null;
function debouncedLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadCharges, 250);
}

async function loadCharges() {
  loading.value = true;
  loadError.value = '';
  try {
    const res = await apiClient.get('/charges', {
      params: {
        includeInactive: showInactive.value ? 'true' : undefined,
        q: search.value || undefined
      }
    });
    charges.value = unwrapList(res);
  } catch (err) {
    loadError.value = err?.response?.data?.message || err?.message || t('states.genericFailure');
    charges.value = [];
  } finally {
    loading.value = false;
  }
}

function typeLabel(type) {
  return type === 'PERCENTAGE' ? t('settings.chargeTypePercentage') : t('settings.chargeTypeFixed');
}
function scopeLabel(scope) {
  if (scope === 'ITEM') return t('settings.taxScopeItem');
  if (scope === 'BOTH') return t('settings.taxScopeBoth');
  return t('settings.taxScopeTransaction');
}
function formatValue(row) {
  if (row.chargeType === 'PERCENTAGE') return `${row.chargeValue}%`;
  return formatCurrencyValue(row.chargeValue, { orgCurrency: authStore.organization }) || String(row.chargeValue);
}

function resetForm() {
  form.name = '';
  form.code = '';
  form.chargeType = 'FIXED_AMOUNT';
  form.chargeValue = 0;
  form.scope = 'TRANSACTION';
  form.applicableOn = 'BOTH';
  form.status = 'ACTIVE';
  form.isDefault = false;
  formError.value = '';
}

function openCreate() {
  editingId.value = null;
  resetForm();
  showForm.value = true;
}

function openEdit(row) {
  editingId.value = row._id;
  form.name = row.name || '';
  form.code = row.code || '';
  form.chargeType = row.chargeType || 'FIXED_AMOUNT';
  form.chargeValue = row.chargeValue ?? 0;
  form.scope = row.scope || 'TRANSACTION';
  form.applicableOn = row.applicableOn || 'BOTH';
  form.status = row.status || 'ACTIVE';
  form.isDefault = row.isDefault === true;
  formError.value = '';
  showForm.value = true;
}

async function saveCharge() {
  saving.value = true;
  formError.value = '';
  const payload = {
    name: form.name,
    code: form.code || null,
    chargeType: form.chargeType,
    chargeValue: Number(form.chargeValue),
    scope: form.scope,
    applicableOn: form.applicableOn,
    status: form.status,
    isDefault: form.isDefault
  };
  try {
    if (editingId.value) {
      await apiClient.put(`/charges/${editingId.value}`, payload);
    } else {
      await apiClient.post('/charges', payload);
    }
    showForm.value = false;
    await loadCharges();
  } catch (err) {
    formError.value = err?.response?.data?.message || t('states.genericFailure');
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(row) {
  const status = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  try {
    await apiClient.patch(`/charges/${row._id}/status`, { status });
    await loadCharges();
  } catch (err) {
    loadError.value = err?.response?.data?.message || t('states.genericFailure');
  }
}

function askDelete(row) {
  pendingDelete.value = row;
}

async function confirmDelete() {
  if (!pendingDelete.value) return;
  deleting.value = true;
  try {
    await apiClient.delete(`/charges/${pendingDelete.value._id}`);
    pendingDelete.value = null;
    await loadCharges();
  } catch (err) {
    loadError.value = err?.response?.data?.message || t('states.genericFailure');
  } finally {
    deleting.value = false;
  }
}

onMounted(loadCharges);
</script>
