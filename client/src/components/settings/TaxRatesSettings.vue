<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="max-w-2xl text-sm text-gray-500 dark:text-gray-400">{{ t('settings.taxRatesDesc') }}</p>
      <div class="flex flex-wrap items-center gap-3">
        <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <HeadlessCheckbox v-model="showInactive" @update:model-value="loadTaxes" />
          {{ t('settings.taxShowInactive') }}
        </label>
        <input
          v-model="search"
          type="search"
          class="block rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white"
          :placeholder="t('settings.taxSearchPlaceholder')"
          @input="debouncedLoad"
        />
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          @click="openCreate"
        >
          {{ t('settings.taxAddRate') }}
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
      v-else-if="!taxes.length"
      class="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400"
    >
      {{ t('settings.taxNoRates') }}
    </div>

    <div v-else class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table class="min-w-full text-sm">
        <thead class="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
          <tr>
            <th class="px-3 py-2.5">{{ t('settings.taxColName') }}</th>
            <th class="px-3 py-2.5">{{ t('settings.taxColCode') }}</th>
            <th class="px-3 py-2.5">{{ t('settings.taxColType') }}</th>
            <th class="px-3 py-2.5">{{ t('settings.taxColValue') }}</th>
            <th class="px-3 py-2.5">{{ t('settings.taxColScope') }}</th>
            <th class="px-3 py-2.5">{{ t('settings.taxColApplicable') }}</th>
            <th class="px-3 py-2.5">{{ t('settings.taxColStatus') }}</th>
            <th class="px-3 py-2.5">{{ t('settings.taxColUpdated') }}</th>
            <th class="px-3 py-2.5 text-right">{{ t('actions.edit') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-for="tax in taxes" :key="tax._id" class="hover:bg-gray-50 dark:hover:bg-gray-700/40">
            <td class="px-3 py-2.5 text-gray-900 dark:text-white">
              {{ tax.name }}
              <span v-if="tax.isDefault" class="ml-1 text-xs text-indigo-600 dark:text-indigo-400">({{ t('settings.catalogPriceBookDefault') }})</span>
            </td>
            <td class="px-3 py-2.5 font-mono text-xs text-gray-500">{{ tax.code || '—' }}</td>
            <td class="px-3 py-2.5 text-gray-700 dark:text-gray-300">{{ typeLabel(tax.taxType) }}</td>
            <td class="px-3 py-2.5 text-gray-700 dark:text-gray-300">{{ formatValue(tax) }}</td>
            <td class="px-3 py-2.5 text-gray-700 dark:text-gray-300">{{ scopeLabel(tax.scope) }}</td>
            <td class="px-3 py-2.5 text-gray-700 dark:text-gray-300">{{ applicableLabel(tax.applicableOn) }}</td>
            <td class="px-3 py-2.5">
              <span
                class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                :class="tax.status === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
              >
                {{ tax.status === 'ACTIVE' ? t('settings.taxStatusActive') : t('settings.taxStatusInactive') }}
              </span>
            </td>
            <td class="px-3 py-2.5 text-xs text-gray-500">{{ formatDate(tax.updatedAt) }}</td>
            <td class="space-x-2 whitespace-nowrap px-3 py-2.5 text-right">
              <button type="button" class="text-sm text-indigo-600 hover:underline dark:text-indigo-400" @click="openEdit(tax)">{{ t('actions.edit') }}</button>
              <button type="button" class="text-sm text-gray-600 hover:underline dark:text-gray-300" @click="toggleStatus(tax)">
                {{ tax.status === 'ACTIVE' ? t('settings.taxDeactivate') : t('settings.taxActivate') }}
              </button>
              <button type="button" class="text-sm text-red-600 hover:underline dark:text-red-400" @click="askDelete(tax)">{{ t('actions.delete') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <TransitionRoot as="template" :show="showForm">
      <Dialog class="relative z-50" @close="showForm = false">
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

        <div class="fixed inset-0 z-10 overflow-y-auto">
          <div class="flex min-h-full items-end justify-center p-4 sm:items-center">
            <TransitionChild
              as="template"
              enter="ease-out duration-200"
              enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enter-to="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-150"
              leave-from="opacity-100 translate-y-0 sm:scale-100"
              leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <DialogPanel class="relative w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-800">
                <form @submit.prevent="saveTax">
                  <div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
                    <DialogTitle class="text-base font-semibold text-gray-900 dark:text-white">
                      {{ editingId ? t('settings.taxEditTitle') : t('settings.taxNewTitle') }}
                    </DialogTitle>
                  </div>

                  <div class="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
                    <div class="space-y-1">
                      <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.taxName') }} *</label>
                      <input
                        v-model="form.name"
                        type="text"
                        required
                        class="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white"
                      />
                    </div>
                    <div class="space-y-1">
                      <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.taxCode') }}</label>
                      <input
                        v-model="form.code"
                        type="text"
                        class="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white"
                      />
                    </div>
                    <div class="space-y-1">
                      <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.taxDescription') }}</label>
                      <textarea
                        v-model="form.description"
                        rows="2"
                        class="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white"
                      />
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div class="space-y-1">
                        <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.taxType') }} *</label>
                        <HeadlessSelect v-model="form.taxType" :options="taxTypeOptions" />
                      </div>
                      <div class="space-y-1">
                        <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.taxValue') }} *</label>
                        <input
                          v-model="form.taxValue"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          required
                          :placeholder="t('settings.taxValuePlaceholder')"
                          class="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white"
                        />
                      </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div class="space-y-1">
                        <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.taxScope') }} *</label>
                        <HeadlessSelect v-model="form.scope" :options="scopeOptions" />
                      </div>
                      <div class="space-y-1">
                        <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.taxApplicableOn') }} *</label>
                        <HeadlessSelect v-model="form.applicableOn" :options="applicableOptions" />
                      </div>
                    </div>
                    <div class="space-y-1">
                      <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.taxColStatus') }}</label>
                      <HeadlessSelect v-model="form.status" :options="statusOptions" />
                    </div>
                    <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <HeadlessCheckbox v-model="form.isDefault" />
                      {{ t('settings.taxIsDefault') }}
                    </label>
                    <p v-if="formError" class="text-sm text-red-600 dark:text-red-400">{{ formError }}</p>
                  </div>

                  <div class="flex justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
                    <button type="button" class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300" @click="showForm = false">
                      {{ t('actions.cancel') }}
                    </button>
                    <button
                      type="submit"
                      :disabled="saving"
                      class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {{ saving ? t('states.saving') : t('actions.save') }}
                    </button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>

    <DeleteConfirmationModal
      :show="!!pendingDelete"
      :title="t('actions.delete')"
      :message="t('settings.taxDeleteConfirm')"
      :deleting="deleting"
      @confirm="confirmDelete"
      @close="pendingDelete = null"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import apiClient from '@/utils/apiClient';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';

import { useNotifications } from '@/composables/useNotifications';
import { formatUserDateTime } from '@/utils/localeFormat';
import { formatCurrencyValue } from '@/utils/currencyOptions';
import { useAuthStore } from '@/stores/authRegistry';
const { t } = useI18n();
const notifications = useNotifications();
const authStore = useAuthStore();


const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const loadError = ref('');
const formError = ref('');
const taxes = ref([]);
const search = ref('');
const showInactive = ref(false);
const showForm = ref(false);
const editingId = ref(null);
const pendingDelete = ref(null);
let searchTimer;

const form = reactive({
  name: '',
  code: '',
  description: '',
  taxType: 'PERCENTAGE',
  taxValue: '',
  scope: 'ITEM',
  applicableOn: 'BOTH',
  status: 'ACTIVE',
  isDefault: false
});

const taxTypeOptions = computed(() => [
  { value: 'PERCENTAGE', label: t('settings.taxTypePercentage') }
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

const statusOptions = computed(() => [
  { value: 'ACTIVE', label: t('settings.taxStatusActive') },
  { value: 'INACTIVE', label: t('settings.taxStatusInactive') }
]);

function unwrapList(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
}

function typeLabel(type) {
  return type === 'FIXED_AMOUNT' ? t('settings.taxTypeFixed') : t('settings.taxTypePercentage');
}

function scopeLabel(scope) {
  if (scope === 'TRANSACTION') return t('settings.taxScopeTransaction');
  if (scope === 'BOTH') return t('settings.taxScopeBoth');
  return t('settings.taxScopeItem');
}

function applicableLabel(value) {
  if (value === 'PURCHASE') return t('settings.taxApplicablePurchase');
  if (value === 'SALES') return t('settings.taxApplicableSales');
  return t('settings.taxApplicableBoth');
}

function formatValue(tax) {
  if (tax.taxType === 'PERCENTAGE') return `${tax.taxValue}%`;
  return formatCurrencyValue(tax.taxValue, { orgCurrency: authStore.organization }) || String(tax.taxValue);
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return formatUserDateTime(value);
  } catch {
    return '—';
  }
}

function resetForm() {
  form.name = '';
  form.code = '';
  form.description = '';
  form.taxType = 'PERCENTAGE';
  form.taxValue = '';
  form.scope = 'ITEM';
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

function openEdit(tax) {
  editingId.value = tax._id;
  form.name = tax.name || '';
  form.code = tax.code || '';
  form.description = tax.description || '';
  form.taxType = tax.taxType || 'PERCENTAGE';
  form.taxValue = tax.taxValue == null ? '' : String(tax.taxValue);
  form.scope = tax.scope || 'ITEM';
  form.applicableOn = tax.applicableOn || 'BOTH';
  form.status = tax.status || 'ACTIVE';
  form.isDefault = !!tax.isDefault;
  formError.value = '';
  showForm.value = true;
}

function debouncedLoad() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadTaxes, 250);
}

async function loadTaxes() {
  loading.value = true;
  loadError.value = '';
  try {
    const res = await apiClient.get('/taxes', {
      params: {
        includeInactive: showInactive.value ? 'true' : 'false',
        q: search.value || undefined
      }
    });
    taxes.value = unwrapList(res);
  } catch (err) {
    console.error('loadTaxes error:', err);
    loadError.value = err?.message || t('settings.taxLoadFailed');
    taxes.value = [];
  } finally {
    loading.value = false;
  }
}

async function saveTax() {
  if (!String(form.name || '').trim()) {
    formError.value = t('settings.taxName');
    return;
  }
  const taxValue = Number(form.taxValue);
  if (form.taxValue === '' || form.taxValue == null || !Number.isFinite(taxValue) || taxValue < 0) {
    formError.value = t('settings.taxValue');
    return;
  }
  saving.value = true;
  formError.value = '';
  try {
    const payload = {
      name: form.name,
      code: form.code || null,
      description: form.description || null,
      taxType: form.taxType,
      taxValue,
      scope: form.scope,
      applicableOn: form.applicableOn,
      status: form.status,
      isDefault: form.isDefault
    };
    if (editingId.value) {
      await apiClient.put(`/taxes/${editingId.value}`, payload);
    } else {
      await apiClient.post('/taxes', payload);
    }
    showForm.value = false;
    await loadTaxes();
  } catch (err) {
    formError.value = err?.response?.data?.message || err?.message || t('states.genericFailure');
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(tax) {
  const status = tax.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  try {
    await apiClient.patch(`/taxes/${tax._id}/status`, { status });
    await loadTaxes();
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || t('states.genericFailure'));
  }
}

function askDelete(tax) {
  pendingDelete.value = tax;
}

async function confirmDelete() {
  if (!pendingDelete.value) return;
  deleting.value = true;
  try {
    await apiClient.delete(`/taxes/${pendingDelete.value._id}`);
    pendingDelete.value = null;
    await loadTaxes();
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || t('states.genericFailure'));
  } finally {
    deleting.value = false;
  }
}

onMounted(loadTaxes);
</script>
