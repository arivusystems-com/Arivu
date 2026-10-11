<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.taxGroupsDesc') }}</p>
      <button
        type="button"
        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openCreate"
      >
        {{ t('settings.taxAddGroup') }}
      </button>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>
    <div
      v-else-if="!groups.length"
      class="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400"
    >
      {{ t('settings.taxNoGroups') }}
    </div>

    <ul v-else class="space-y-2">
      <li
        v-for="group in groups"
        :key="group._id"
        class="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="min-w-0">
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ group.name }}</p>
          <p v-if="group.description" class="mt-0.5 truncate text-xs text-gray-500">{{ group.description }}</p>
          <p class="mt-1 text-xs text-gray-500">{{ t('settings.taxGroupMembers', { count: (group.taxIds || []).length }) }}</p>
        </div>
        <div class="flex shrink-0 gap-3">
          <button type="button" class="text-sm text-indigo-600 hover:underline dark:text-indigo-400" @click="openEdit(group)">{{ t('actions.edit') }}</button>
          <button type="button" class="text-sm text-red-600 hover:underline dark:text-red-400" @click="askDelete(group)">{{ t('actions.delete') }}</button>
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
                <form @submit.prevent="saveGroup">
                  <div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
                    <DialogTitle class="text-base font-semibold text-gray-900 dark:text-white">
                      {{ editingId ? t('settings.taxGroupEditTitle') : t('settings.taxGroupNewTitle') }}
                    </DialogTitle>
                  </div>

                  <div class="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
                    <div class="space-y-1">
                      <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.taxGroupName') }} *</label>
                      <input
                        v-model="form.name"
                        type="text"
                        required
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
                    <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                      <p class="mb-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{{ t('settings.taxGroupSelectTaxes') }}</p>
                      <div class="max-h-48 space-y-2 overflow-y-auto">
                        <label
                          v-for="tax in activeTaxes"
                          :key="tax._id"
                          class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                        >
                          <HeadlessCheckbox
                            :model-value="form.taxIds.includes(String(tax._id))"
                            @update:model-value="(checked) => toggleTaxId(String(tax._id), checked)"
                          />
                          <span>{{ tax.name }}</span>
                          <span class="text-xs text-gray-500">{{ tax.taxValue }}%</span>
                        </label>
                        <p v-if="!activeTaxes.length" class="text-xs text-gray-500">{{ t('settings.taxNoRates') }}</p>
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
      :record-name="pendingDelete?.name || ''"
      record-type="group"
      :deleting="deleting"
      @confirm="confirmDelete"
      @close="pendingDelete = null"
    />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import apiClient from '@/utils/apiClient';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';

import { useNotifications } from '@/composables/useNotifications';
const { t } = useI18n();
const notifications = useNotifications();


const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const groups = ref([]);
const activeTaxes = ref([]);
const showForm = ref(false);
const editingId = ref(null);
const formError = ref('');
const pendingDelete = ref(null);
const form = reactive({ name: '', description: '', taxIds: [] });

function unwrapList(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
}

function toggleTaxId(id, checked) {
  if (checked) {
    if (!form.taxIds.includes(id)) form.taxIds.push(id);
  } else {
    form.taxIds = form.taxIds.filter((x) => x !== id);
  }
}

async function load() {
  loading.value = true;
  try {
    const [groupsRes, taxesRes] = await Promise.all([
      apiClient.get('/taxes/groups'),
      apiClient.get('/taxes', { params: { includeInactive: 'false' } })
    ]);
    groups.value = unwrapList(groupsRes);
    activeTaxes.value = unwrapList(taxesRes);
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  form.name = '';
  form.description = '';
  form.taxIds = [];
  formError.value = '';
  showForm.value = true;
}

function openEdit(group) {
  editingId.value = group._id;
  form.name = group.name || '';
  form.description = group.description || '';
  form.taxIds = (group.taxIds || []).map((id) => String(id));
  formError.value = '';
  showForm.value = true;
}

async function saveGroup() {
  if (!String(form.name || '').trim()) {
    formError.value = t('settings.taxGroupName');
    return;
  }
  saving.value = true;
  formError.value = '';
  try {
    const payload = {
      name: form.name,
      description: form.description || null,
      taxIds: form.taxIds
    };
    if (editingId.value) {
      await apiClient.put(`/taxes/groups/${editingId.value}`, payload);
    } else {
      await apiClient.post('/taxes/groups', payload);
    }
    showForm.value = false;
    await load();
  } catch (err) {
    formError.value = err?.response?.data?.message || err?.message || t('states.genericFailure');
  } finally {
    saving.value = false;
  }
}

function askDelete(group) {
  pendingDelete.value = group;
}

async function confirmDelete() {
  if (!pendingDelete.value) return;
  deleting.value = true;
  try {
    await apiClient.delete(`/taxes/groups/${pendingDelete.value._id}`);
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
