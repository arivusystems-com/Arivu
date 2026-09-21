<template>
  <div class="mx-auto max-w-6xl">
    <LearningPageHeader
      :title="t('learning.contentLibrary')"
      :subtitle="t('learning.contentLibraryBlurb')"
    />

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 6" :key="i" class="h-28 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
    <p v-else-if="!items.length" class="text-sm text-gray-500">{{ t('learning.emptyContentLibrary') }}</p>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="item in items"
        :key="item._id"
        class="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
      >
        <div class="flex items-start justify-between gap-2">
          <span
            class="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            :class="typeClass(item.type)"
          >
            {{ item.type }}
          </span>
          <span v-if="item.course?.status" class="text-[10px] capitalize text-gray-400">
            {{ item.course.status }}
          </span>
        </div>
        <h3 class="mt-3 font-semibold text-gray-900 dark:text-white">{{ item.title }}</h3>
        <p class="mt-1 line-clamp-2 text-xs text-gray-500">
          {{ item.course?.title || t('learning.courseUnavailable') }}
        </p>
        <router-link
          v-if="item.courseId"
          :to="`/learning/courses/${item.courseId}`"
          class="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-300"
        >
          {{ t('learning.openCourse') }} →
        </router-link>
      </article>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import LearningPageHeader from './components/LearningPageHeader.vue';

const { t } = useI18n();
const { error } = useNotifications();
const loading = ref(true);
const items = ref([]);

function typeClass(type) {
  if (type === 'VIDEO') return 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300';
  if (type === 'DOCUMENT') return 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200';
  return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300';
}

async function load() {
  loading.value = true;
  try {
    const res = await apiClient.get('/lms/content-library', { cache: 'no-store' });
    items.value = res?.data || res || [];
  } catch (e) {
    items.value = [];
    error(e?.message || t('learning.loadFailed'));
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
