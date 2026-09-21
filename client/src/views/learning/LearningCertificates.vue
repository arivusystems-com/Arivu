<template>
  <div class="mx-auto max-w-6xl">
    <LearningPageHeader :title="t('learning.certificates')" :subtitle="t('learning.certificatesBlurb')" />

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 3" :key="i" class="h-40 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
    <p v-else-if="!rows.length" class="text-sm text-gray-500">{{ t('learning.emptyCertificates') }}</p>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="row in rows"
        :key="row._id"
        class="relative overflow-hidden rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-indigo-50 p-5 shadow-sm dark:border-amber-900/40 dark:from-amber-950/30 dark:via-gray-900 dark:to-indigo-950/30"
      >
        <TrophyIcon class="absolute right-4 top-4 h-8 w-8 text-amber-400/70" />
        <p class="pr-10 text-base font-semibold text-gray-900 dark:text-white">{{ row.title }}</p>
        <p class="mt-3 text-xs text-gray-500">
          {{ t('learning.credentialId') }}: {{ row.credentialId }}
        </p>
        <p class="mt-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
          {{ row.status }} · {{ formatDate(row.issuedAt) }}
        </p>
      </article>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { TrophyIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import LearningPageHeader from './components/LearningPageHeader.vue';

const { t } = useI18n();
const loading = ref(true);
const rows = ref([]);

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return String(d);
  }
}

onMounted(async () => {
  try {
    const res = await apiClient.get('/lms/certificates?mine=1', { cache: 'no-store' });
    rows.value = res?.data || res || [];
  } finally {
    loading.value = false;
  }
});
</script>
