<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="max-w-2xl text-sm text-gray-500 dark:text-gray-400">{{ t('settings.taxRegionalDesc') }}</p>
      <button
        type="button"
        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openCreate"
      >
        {{ t('settings.taxAddRegional') }}
      </button>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>
    <div
      v-else-if="!rows.length"
      class="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400"
    >
      {{ t('settings.taxNoRegional') }}
    </div>

    <ul v-else class="space-y-2">
      <li
        v-for="row in rows"
        :key="row._id"
        class="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="min-w-0 text-sm">
          <p class="font-medium text-gray-900 dark:text-white">
            {{ levelLabel(row.level) }} · {{ row.countryCode }}
            <span v-if="row.stateCode"> / {{ row.stateCode }}</span>
            <span v-if="row.region"> / {{ row.region }}</span>
          </p>
          <p class="mt-1 text-xs text-gray-500">
            {{ t('settings.taxGroupMembers', { count: (row.taxIds || []).length }) }}
            · {{ t('settings.taxGroupMembers', { count: (row.taxGroupIds || []).length }) }}
          </p>
        </div>
        <div class="flex shrink-0 gap-3">
          <button type="button" class="text-sm text-indigo-600 hover:underline dark:text-indigo-400" @click="openEdit(row)">{{ t('actions.edit') }}</button>
          <button type="button" class="text-sm text-red-600 hover:underline dark:text-red-400" @click="askDelete(row)">{{ t('actions.delete') }}</button>
        </div>
      </li>
    </ul>

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
              <DialogPanel class="relative w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-gray-800">
                <form @submit.prevent="save">
                  <div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
                    <DialogTitle class="text-base font-semibold text-gray-900 dark:text-white">
                      {{ editingId ? t('settings.taxRegionalEditTitle') : t('settings.taxRegionalNewTitle') }}
                    </DialogTitle>
                  </div>

                  <div class="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
                    <div class="space-y-1">
                      <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.taxRegionLevel') }}</label>
                      <HeadlessSelect v-model="form.level" :options="levelOptions" />
                    </div>
                    <div class="space-y-1">
                      <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.taxCountryCode') }} *</label>
                      <input
                        v-model="form.countryCode"
                        type="text"
                        maxlength="3"
                        required
                        class="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm uppercase text-gray-900 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white"
                      />
                    </div>
                    <div v-if="form.level !== 'COUNTRY'" class="space-y-1">
                      <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.taxStateCode') }}</label>
                      <input
                        v-model="form.stateCode"
                        type="text"
                        class="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm uppercase text-gray-900 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white"
                      />
                    </div>
                    <div v-if="form.level === 'REGION'" class="space-y-1">
                      <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.taxRegionName') }}</label>
                      <input
                        v-model="form.region"
                        type="text"
                        class="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white"
                      />
                    </div>

                    <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                      <p class="mb-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{{ t('settings.taxGroupSelectTaxes') }}</p>
                      <div class="max-h-40 space-y-2 overflow-y-auto">
                        <label
                          v-for="tax in activeTaxes"
                          :key="tax._id"
                          class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                        >
                          <HeadlessCheckbox
                            :model-value="form.taxIds.includes(String(tax._id))"
                            @update:model-value="(checked) => toggleId(form.taxIds, String(tax._id), checked)"
                          />
                          <span>{{ tax.name }}</span>
                        </label>
                      </div>
                    </div>

                    <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                      <p class="mb-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{{ t('settings.taxTabGroups') }}</p>
                      <div class="max-h-32 space-y-2 overflow-y-auto">
                        <label
                          v-for="g in groups"
                          :key="g._id"
                          class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                        >
                          <HeadlessCheckbox
                            :model-value="form.taxGroupIds.includes(String(g._id))"
                            @update:model-value="(checked) => toggleId(form.taxGroupIds, String(g._id), checked)"
                          />
                          <span>{{ g.name }}</span>
                        </label>
                      </div>
                    </div>

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
      :record-name="pendingDelete ? `${pendingDelete.countryCode}${pendingDelete.stateCode ? ' / ' + pendingDelete.stateCode : ''}` : ''"
      record-type="assignment"
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
const { t } = useI18n();
const notifications = useNotifications();


const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const rows = ref([]);
const activeTaxes = ref([]);
const groups = ref([]);
const showForm = ref(false);
const editingId = ref(null);
const formError = ref('');
const pendingDelete = ref(null);

const form = reactive({
  level: 'COUNTRY',
  countryCode: '',
  stateCode: '',
  region: '',
  taxIds: [],
  taxGroupIds: []
});

const levelOptions = computed(() => [
  { value: 'COUNTRY', label: t('settings.taxRegionCountry') },
  { value: 'STATE', label: t('settings.taxRegionState') },
  { value: 'REGION', label: t('settings.taxRegionRegion') }
]);

function unwrapList(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
}

function levelLabel(level) {
  if (level === 'STATE') return t('settings.taxRegionState');
  if (level === 'REGION') return t('settings.taxRegionRegion');
  return t('settings.taxRegionCountry');
}

function toggleId(list, id, checked) {
  if (checked) {
    if (!list.includes(id)) list.push(id);
  } else {
    const idx = list.indexOf(id);
    if (idx >= 0) list.splice(idx, 1);
  }
}

async function load() {
  loading.value = true;
  try {
    const [regionalRes, taxesRes, groupsRes] = await Promise.all([
      apiClient.get('/taxes/regional'),
      apiClient.get('/taxes'),
      apiClient.get('/taxes/groups')
    ]);
    rows.value = unwrapList(regionalRes);
    activeTaxes.value = unwrapList(taxesRes);
    groups.value = unwrapList(groupsRes);
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  form.level = 'COUNTRY';
  form.countryCode = '';
  form.stateCode = '';
  form.region = '';
  form.taxIds = [];
  form.taxGroupIds = [];
  formError.value = '';
  showForm.value = true;
}

function openEdit(row) {
  editingId.value = row._id;
  form.level = row.level || 'COUNTRY';
  form.countryCode = row.countryCode || '';
  form.stateCode = row.stateCode || '';
  form.region = row.region || '';
  form.taxIds = (row.taxIds || []).map((id) => String(id));
  form.taxGroupIds = (row.taxGroupIds || []).map((id) => String(id));
  formError.value = '';
  showForm.value = true;
}

async function save() {
  if (!String(form.countryCode || '').trim()) {
    formError.value = t('settings.taxCountryCode');
    return;
  }
  saving.value = true;
  formError.value = '';
  try {
    const payload = {
      level: form.level,
      countryCode: form.countryCode,
      stateCode: form.stateCode || null,
      region: form.region || null,
      taxIds: form.taxIds,
      taxGroupIds: form.taxGroupIds
    };
    if (editingId.value) {
      await apiClient.put(`/taxes/regional/${editingId.value}`, payload);
    } else {
      await apiClient.post('/taxes/regional', payload);
    }
    showForm.value = false;
    await load();
  } catch (err) {
    formError.value = err?.response?.data?.message || err?.message || t('states.genericFailure');
  } finally {
    saving.value = false;
  }
}

function askDelete(row) {
  pendingDelete.value = row;
}

async function confirmDelete() {
  if (!pendingDelete.value) return;
  deleting.value = true;
  try {
    await apiClient.delete(`/taxes/regional/${pendingDelete.value._id}`);
    pendingDelete.value = null;
    await load();
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || t('states.genericFailure'));
  } finally {
    deleting.value = false;
  }
}

onMounted(load);
</script>
