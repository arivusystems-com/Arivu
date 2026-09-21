<template>
  <div class="mx-auto max-w-6xl">
    <LearningPageHeader
      :title="t('learning.compliance')"
      :subtitle="t('learning.complianceBlurb')"
    >
      <template #actions>
        <div class="flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition"
            :class="scope === 'org'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'"
            @click="setScope('org')"
          >
            {{ t('learning.complianceScopeOrg') }}
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition"
            :class="scope === 'team'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'"
            @click="setScope('team')"
          >
            {{ t('learning.complianceScopeTeam') }}
          </button>
        </div>
      </template>
    </LearningPageHeader>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="i in 4" :key="i" class="h-24 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('learning.complianceOverdue') }}</p>
          <p class="mt-3 text-3xl font-semibold text-rose-600 dark:text-rose-400">{{ summary.overdue }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('learning.complianceDueSoon') }}</p>
          <p class="mt-3 text-3xl font-semibold text-amber-600 dark:text-amber-400">{{ summary.dueSoon }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('learning.complianceInProgress') }}</p>
          <p class="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">{{ summary.inProgress }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('learning.complianceCompleted') }}</p>
          <p class="mt-3 text-3xl font-semibold text-emerald-600 dark:text-emerald-400">{{ summary.completed }}</p>
        </div>
      </div>

      <div class="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">{{ t('learning.complianceLearner') }}</th>
                <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">{{ t('learning.complianceContent') }}</th>
                <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">{{ t('learning.complianceDue') }}</th>
                <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">{{ t('learning.progress') }}</th>
                <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">{{ t('learning.complianceStatus') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              <tr v-if="!rows.length">
                <td colspan="5" class="px-4 py-10 text-center text-gray-500">
                  {{ t('learning.complianceEmpty') }}
                </td>
              </tr>
              <tr
                v-for="row in rows"
                :key="row.enrollmentId"
                class="hover:bg-gray-50 dark:hover:bg-gray-800/40"
              >
                <td class="px-4 py-3">
                  <p class="font-medium text-gray-900 dark:text-white">{{ row.learnerName }}</p>
                  <p v-if="row.learnerEmail" class="text-xs text-gray-500">{{ row.learnerEmail }}</p>
                </td>
                <td class="px-4 py-3 text-gray-800 dark:text-gray-200">
                  <router-link
                    v-if="row.courseId"
                    :to="`/learning/courses/${row.courseId}`"
                    class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {{ row.courseTitle || t('learning.course') }}
                  </router-link>
                  <span v-else>{{ row.pathTitle || '—' }}</span>
                  <p v-if="row.pathTitle && row.courseId" class="text-xs text-gray-500">{{ row.pathTitle }}</p>
                </td>
                <td class="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {{ formatDue(row.dueAt) }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <div class="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        class="h-full rounded-full bg-indigo-600"
                        :style="{ width: `${Math.min(100, row.percentComplete || 0)}%` }"
                      />
                    </div>
                    <span class="tabular-nums text-xs text-gray-600 dark:text-gray-400">
                      {{ Math.round(row.percentComplete || 0) }}%
                    </span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    :class="statusClass(row.complianceStatus)"
                  >
                    {{ statusLabel(row.complianceStatus) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import LearningPageHeader from './components/LearningPageHeader.vue';
import { captureLearningModuleVisited } from '@/config/posthogLearning';

const { t, d } = useI18n();
const loading = ref(true);
const scope = ref('org');
const data = ref(null);

const summary = computed(() => data.value?.summary || {
  overdue: 0,
  dueSoon: 0,
  inProgress: 0,
  completed: 0,
  total: 0,
});
const rows = computed(() => data.value?.rows || []);

function statusLabel(status) {
  const map = {
    overdue: t('learning.complianceOverdue'),
    due_soon: t('learning.complianceDueSoon'),
    in_progress: t('learning.complianceInProgress'),
    no_due: t('learning.complianceNoDue'),
    completed: t('learning.complianceCompleted'),
  };
  return map[status] || status;
}

function statusClass(status) {
  const map = {
    overdue: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    due_soon: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    in_progress: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    no_due: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  };
  return map[status] || map.in_progress;
}

function formatDue(dueAt) {
  if (!dueAt) return '—';
  try {
    return d(new Date(dueAt), 'short');
  } catch {
    return new Date(dueAt).toLocaleDateString();
  }
}

async function load() {
  loading.value = true;
  try {
    const res = await apiClient.get(`/lms/compliance?scope=${scope.value}`, { cache: 'no-store' });
    data.value = res?.data || res;
  } finally {
    loading.value = false;
  }
}

function setScope(next) {
  if (scope.value === next) return;
  scope.value = next;
  load();
}

onMounted(() => {
  captureLearningModuleVisited('learning_compliance');
  load();
});
</script>
