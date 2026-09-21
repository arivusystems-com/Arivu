<template>
  <LearningDialog
    :open="open"
    :title="title"
    :confirm-label="t('learning.assignConfirm')"
    :cancel-label="t('learning.cancel')"
    :disabled="!selectedIds.length || assigning"
    @close="$emit('close')"
    @confirm="submit"
  >
    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ t('learning.assignDueDate') }}
      <input
        v-model="dueAt"
        type="date"
        class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      >
    </label>
    <div class="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
      <p v-if="loadingUsers" class="px-2 py-3 text-sm text-gray-500">{{ t('learning.loadingUsers') }}</p>
      <p v-else-if="!users.length" class="px-2 py-3 text-sm text-gray-500">{{ t('learning.noAssignableUsers') }}</p>
      <label
        v-for="u in users"
        :key="u._id"
        class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <input
          v-model="selectedIds"
          type="checkbox"
          class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          :value="String(u._id)"
        >
        <span class="min-w-0 truncate text-gray-900 dark:text-white">
          {{ displayName(u) }}
        </span>
      </label>
    </div>
  </LearningDialog>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import LearningDialog from './LearningDialog.vue';

const props = defineProps({
  open: { type: Boolean, required: true },
  title: { type: String, required: true },
  endpoint: { type: String, required: true },
});

const emit = defineEmits(['close', 'assigned']);

const { t } = useI18n();
const { success, error } = useNotifications();
const users = ref([]);
const loadingUsers = ref(false);
const selectedIds = ref([]);
const dueAt = ref('');
const assigning = ref(false);

function displayName(u) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email || String(u._id);
}

async function loadUsers() {
  loadingUsers.value = true;
  try {
    const res = await apiClient.get('/users?limit=500&page=1&sortBy=firstName&sortOrder=asc', {
      cache: 'no-store',
    });
    const list = res?.data?.users || res?.data || res?.users || res || [];
    const rows = Array.isArray(list) ? list : [];
    users.value = rows.filter((u) => {
      const access = Array.isArray(u.appAccess) ? u.appAccess : [];
      return access.some(
        (e) =>
          String(e?.appKey || '').toUpperCase() === 'LMS'
          && String(e?.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
      );
    });
  } catch {
    users.value = [];
  } finally {
    loadingUsers.value = false;
  }
}

async function submit() {
  if (!selectedIds.value.length || assigning.value) return;
  assigning.value = true;
  try {
    const payload = { userIds: selectedIds.value };
    if (dueAt.value) payload.dueAt = new Date(`${dueAt.value}T23:59:59`).toISOString();
    const res = await apiClient.post(props.endpoint, payload);
    const results = res?.data?.results || res?.results || [];
    const ok = results.filter((r) => r.ok).length;
    const failed = results.length - ok;
    success(
      failed
        ? t('learning.assignPartial', { ok, failed })
        : t('learning.assignSuccess', { count: ok })
    );
    emit('assigned');
    emit('close');
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.loadFailed'));
  } finally {
    assigning.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      selectedIds.value = [];
      dueAt.value = '';
      loadUsers();
    }
  }
);
</script>
