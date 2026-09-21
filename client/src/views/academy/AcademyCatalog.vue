<template>
  <div>
    <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
      {{ t('learning.academyCatalog') }}
    </h1>
    <p class="mt-1 text-sm text-gray-500">{{ t('learning.academyCatalogBlurb') }}</p>

    <div v-if="loading" class="mt-6 h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
    <p v-else-if="!courses.length" class="mt-6 text-sm text-gray-500">
      {{ t('learning.academyCatalogEmpty') }}
    </p>
    <ul v-else class="mt-6 grid gap-3 sm:grid-cols-2">
      <li
        v-for="course in courses"
        :key="course._id"
      >
        <router-link
          :to="`/academy/courses/${course._id}`"
          class="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900"
        >
          <h2 class="font-medium text-gray-900 dark:text-white">{{ course.title }}</h2>
          <p class="mt-1 line-clamp-2 text-sm text-gray-500">{{ course.description }}</p>
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
const courses = ref([]);

onMounted(async () => {
  loading.value = true;
  try {
    const res = await apiClient.get('/lms/academy/catalog', { cache: 'no-store' });
    courses.value = res?.data || res || [];
  } catch {
    courses.value = [];
  } finally {
    loading.value = false;
  }
});
</script>
