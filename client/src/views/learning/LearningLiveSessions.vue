<template>
  <div class="mx-auto max-w-6xl">
    <LearningPageHeader :title="t('learning.liveSessions')" :subtitle="t('learning.liveSessionsBlurb')">
      <template v-if="canAuthor" #actions>
        <button
          type="button"
          class="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          @click="openCreate"
        >
          {{ t('learning.scheduleSession') }}
        </button>
      </template>
    </LearningPageHeader>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-24 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
    <p v-else-if="!rows.length" class="text-sm text-gray-500">{{ t('learning.emptyLiveSessions') }}</p>
    <ul v-else class="space-y-3">
      <li
        v-for="row in rows"
        :key="row._id"
        class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-semibold text-gray-900 dark:text-white">{{ row.title }}</h3>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-semibold capitalize"
                :class="statusClass(row.effectiveStatus || row.status)"
              >
                {{ row.effectiveStatus || row.status }}
              </span>
            </div>
            <p v-if="row.description" class="mt-1 text-sm text-gray-500">{{ row.description }}</p>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              {{ formatWhen(row.startsAt) }}
              <template v-if="row.courseTitle"> · {{ row.courseTitle }}</template>
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <a
              v-if="row.meetingUrl && (row.effectiveStatus === 'live' || isRegistered(row))"
              :href="row.meetingUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              {{ t('learning.joinSession') }}
            </a>
            <button
              v-else-if="row.status !== 'cancelled' && !isRegistered(row)"
              type="button"
              class="rounded-lg border border-indigo-600 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-200"
              @click="register(row)"
            >
              {{ t('learning.registerSession') }}
            </button>
            <button
              v-if="canAuthor && row.status !== 'cancelled'"
              type="button"
              class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
              @click="cancel(row)"
            >
              {{ t('learning.cancelSession') }}
            </button>
          </div>
        </div>
      </li>
    </ul>

    <LearningDialog
      :open="createOpen"
      :title="t('learning.scheduleSession')"
      :confirm-label="t('learning.scheduleSession')"
      :cancel-label="t('learning.cancel')"
      :disabled="!newTitle.trim() || !startsAt || creating"
      @close="createOpen = false"
      @confirm="create"
    >
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('learning.sessionTitlePrompt') }}
        <input
          v-model="newTitle"
          type="text"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
      </label>
      <label class="mt-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('learning.sessionStartsAt') }}
        <input
          v-model="startsAt"
          type="datetime-local"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
      </label>
      <label class="mt-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('learning.sessionMeetingUrl') }}
        <input
          v-model="meetingUrl"
          type="url"
          placeholder="https://…"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
      </label>
    </LearningDialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/auth';
import { useNotifications } from '@/composables/useNotifications';
import { useLearningRole } from '@/composables/useLearningRole';
import LearningPageHeader from './components/LearningPageHeader.vue';
import LearningDialog from './components/LearningDialog.vue';
import { captureLearningModuleVisited } from '@/config/posthogLearning';

const { t, d } = useI18n();
const authStore = useAuthStore();
const { success, error } = useNotifications();
const { canAuthor } = useLearningRole();
const loading = ref(true);
const rows = ref([]);
const createOpen = ref(false);
const newTitle = ref('');
const startsAt = ref('');
const meetingUrl = ref('');
const creating = ref(false);

const myId = () => String(authStore.user?._id || authStore.user?.id || '');

function isRegistered(row) {
  const ids = (row.attendeeUserIds || []).map(String);
  return ids.includes(myId());
}

function statusClass(status) {
  const map = {
    scheduled: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    live: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    completed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  };
  return map[status] || map.scheduled;
}

function formatWhen(value) {
  if (!value) return '—';
  try {
    return d(new Date(value), 'long');
  } catch {
    return new Date(value).toLocaleString();
  }
}

async function load() {
  loading.value = true;
  try {
    const res = await apiClient.get('/lms/live-sessions', { cache: 'no-store' });
    const list = res?.data || res || [];
    rows.value = Array.isArray(list) ? list : [];
  } catch {
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  newTitle.value = '';
  startsAt.value = '';
  meetingUrl.value = '';
  createOpen.value = true;
}

async function create() {
  if (!newTitle.value.trim() || !startsAt.value || creating.value) return;
  creating.value = true;
  try {
    await apiClient.post('/lms/live-sessions', {
      title: newTitle.value.trim(),
      startsAt: new Date(startsAt.value).toISOString(),
      meetingUrl: meetingUrl.value.trim() || undefined,
    });
    success(t('learning.scheduleSession'));
    createOpen.value = false;
    await load();
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.loadFailed'));
  } finally {
    creating.value = false;
  }
}

async function register(row) {
  try {
    await apiClient.post(`/lms/live-sessions/${row._id}/register`);
    success(t('learning.registerSessionSuccess'));
    await load();
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.loadFailed'));
  }
}

async function cancel(row) {
  try {
    await apiClient.post(`/lms/live-sessions/${row._id}/cancel`);
    success(t('learning.cancelSession'));
    await load();
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.loadFailed'));
  }
}

onMounted(() => {
  captureLearningModuleVisited('learning_live');
  load();
});
</script>
