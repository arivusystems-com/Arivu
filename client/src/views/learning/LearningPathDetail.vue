<template>
  <div class="mx-auto max-w-3xl">
    <div v-if="loading" class="space-y-4">
      <div class="h-8 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      <div class="h-40 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
    <template v-else-if="path">
      <LearningPageHeader :title="path.title" :subtitle="path.description || t('learning.pathDefaultDesc')">
        <template #actions>
          <button
            v-if="canAuthor && path.status !== 'published'"
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium dark:border-gray-600"
            @click="publish"
          >
            {{ t('learning.publishPath') }}
          </button>
          <button
            v-if="canAuthor && path.status === 'published'"
            type="button"
            class="rounded-lg border border-indigo-600 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-200"
            @click="assignOpen = true"
          >
            {{ t('learning.assign') }}
          </button>
          <button
            v-if="path.status === 'published'"
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            @click="enroll"
          >
            {{ t('learning.startPath') }}
          </button>
        </template>
      </LearningPageHeader>

      <div class="mb-6 flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
        <span class="font-medium text-indigo-700 dark:text-indigo-300">
          {{ t('learning.progress', { percent: path.percentComplete || 0 }) }}
        </span>
        <span>·</span>
        <span>{{ path.sequential ? t('learning.pathSequential') : t('learning.pathOpen') }}</span>
        <span>·</span>
        <span class="capitalize">{{ path.status || t('learning.draft') }}</span>
      </div>

      <ol class="space-y-3">
        <li
          v-for="(item, index) in path.items || []"
          :key="String(item.courseId) + index"
          class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
          :class="{ 'opacity-50': !item.unlocked }"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {{ t('learning.pathStep', { n: index + 1 }) }}
              </p>
              <h3 class="mt-1 font-semibold text-gray-900 dark:text-white">
                {{ item.course?.title || t('learning.courseUnavailable') }}
              </h3>
              <p class="mt-1 text-xs text-gray-500">
                <template v-if="item.completed">{{ t('learning.pathStepDone') }}</template>
                <template v-else-if="!item.unlocked">{{ t('learning.pathStepLocked') }}</template>
                <template v-else>
                  {{ t('learning.progress', { percent: item.percentComplete || 0 }) }}
                </template>
              </p>
            </div>
            <RouterLink
              v-if="item.unlocked && item.course?._id"
              :to="`/learning/courses/${item.course._id}`"
              class="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              {{ item.completed ? t('learning.openCourse') : t('learning.continueLearning') }}
            </RouterLink>
          </div>
        </li>
      </ol>
    </template>
    <p v-else class="text-sm text-gray-500">{{ t('learning.loadFailed') }}</p>

    <LearningAssignDialog
      v-if="pathId()"
      :open="assignOpen"
      :title="t('learning.assignPath')"
      :endpoint="`/lms/paths/${pathId()}/assign`"
      @close="assignOpen = false"
    />
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { useLearningRole } from '@/composables/useLearningRole';
import LearningPageHeader from './components/LearningPageHeader.vue';
import LearningAssignDialog from './components/LearningAssignDialog.vue';

const { t } = useI18n();
const route = useRoute();
const { success, error } = useNotifications();
const { canAuthor } = useLearningRole();
const loading = ref(true);
const path = ref(null);
const assignOpen = ref(false);

const pathId = () => String(route.params.id || '');

async function load() {
  loading.value = true;
  try {
    const res = await apiClient.get(`/lms/paths/${pathId()}`, { cache: 'no-store' });
    path.value = res?.data || res;
  } catch (e) {
    path.value = null;
    error(e?.message || t('learning.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function publish() {
  try {
    await apiClient.post(`/lms/paths/${pathId()}/publish`);
    success(t('learning.publishPath'));
    await load();
  } catch (e) {
    error(e?.message || t('learning.loadFailed'));
  }
}

async function enroll() {
  try {
    await apiClient.post(`/lms/paths/${pathId()}/enroll`);
    success(t('learning.startPath'));
    await load();
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.capacityReached'));
  }
}

watch(() => route.params.id, (id, prev) => {
  if (id && id !== prev) load();
});
onMounted(load);
</script>
