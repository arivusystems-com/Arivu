<template>
  <div>
    <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
      {{ t('learning.academyMyLearning') }}
    </h1>
    <div v-if="loading" class="mt-6 h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
    <p v-else-if="!items.length" class="mt-6 text-sm text-gray-500">
      {{ t('learning.emptyMyLearning') }}
    </p>
    <ul v-else class="mt-6 space-y-3">
      <li
        v-for="row in items"
        :key="row.enrollment?._id || row.course?._id"
      >
        <router-link
          :to="`/academy/courses/${row.course?._id}`"
          class="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900"
        >
          <div>
            <h2 class="font-medium text-gray-900 dark:text-white">
              {{ row.course?.title || t('learning.untitledCourse') }}
            </h2>
            <p class="text-xs text-gray-500">
              {{ t('learning.progress', { percent: Math.round(row.progress?.percentComplete || 0) }) }}
            </p>
          </div>
          <span
            v-if="row.overdue"
            class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
          >
            {{ t('learning.overdue') }}
          </span>
        </router-link>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();
const loading = ref(true);
const items = ref([]);

onMounted(async () => {
  loading.value = true;
  try {
    const res = await apiClient.get('/lms/academy/my-learning', { cache: 'no-store' });
    items.value = res?.data || res || [];
  } catch {
    items.value = [];
  } finally {
    loading.value = false;
  }
});
</script>
