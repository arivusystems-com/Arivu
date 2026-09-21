<template>
  <div>
    <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
      {{ t('learning.academyCertificates') }}
    </h1>
    <div v-if="loading" class="mt-6 h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
    <p v-else-if="!certs.length" class="mt-6 text-sm text-gray-500">
      {{ t('learning.academyCertificatesEmpty') }}
    </p>
    <ul v-else class="mt-6 space-y-3">
      <li
        v-for="c in certs"
        :key="c._id"
        class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <p class="font-medium text-gray-900 dark:text-white">{{ c.title || c.courseTitle || c._id }}</p>
        <p class="text-xs text-gray-500">{{ formatDate(c.issuedAt || c.createdAt) }}</p>
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
const certs = ref([]);

function formatDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return '';
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    const res = await apiClient.get('/lms/certificates', { cache: 'no-store' });
    certs.value = res?.data || res || [];
  } catch {
    certs.value = [];
  } finally {
    loading.value = false;
  }
});
</script>
