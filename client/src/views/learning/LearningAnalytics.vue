<template>
  <div class="mx-auto max-w-6xl">
    <LearningPageHeader :title="t('learning.analytics')" :subtitle="t('learning.analyticsBlurb')" />

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="i in 4" :key="i" class="h-28 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('learning.courses') }}</p>
        <p class="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">
          {{ data?.publishedCourses ?? 0 }}
        </p>
        <p class="mt-1 text-xs text-gray-500">
          {{ t('learning.publishedOfTotal', { published: data?.publishedCourses ?? 0, total: data?.courses ?? 0 }) }}
        </p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('learning.seatCapacity') }}</p>
        <p class="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">
          {{ data?.learnerSeatsUsed ?? 0 }}
          <span class="text-lg font-medium text-gray-400">/ {{ data?.learnerSeatCapacity ?? 0 }}</span>
        </p>
        <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            class="h-full rounded-full bg-indigo-600 transition-all"
            :style="{ width: `${seatPercent}%` }"
          />
        </div>
        <p class="mt-2 text-xs text-gray-500">
          {{ t('learning.seatsRemaining', { remaining: data?.learnerSeatsRemaining ?? 0 }) }}
        </p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('learning.activeLearners') }}</p>
        <p class="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">
          {{ data?.mauThisPeriod ?? 0 }}
        </p>
        <p class="mt-1 text-xs text-gray-500">{{ t('learning.mauHint') }}</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('learning.certificates') }}</p>
        <p class="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">
          {{ data?.certificatesIssued ?? 0 }}
        </p>
        <p class="mt-1 text-xs text-gray-500">{{ t('learning.certificatesIssued') }}</p>
      </div>
    </div>

    <div
      v-if="data?.byAudience"
      class="mt-4 grid gap-3 sm:grid-cols-4"
    >
      <div
        v-for="key in audienceKeys"
        :key="key"
        class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <p class="text-xs uppercase text-gray-500">{{ audienceLabel(key) }}</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
          {{ data.byAudience[key] ?? 0 }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import LearningPageHeader from './components/LearningPageHeader.vue';

const audienceKeys = ['internal', 'customer', 'partner', 'external'];
const AUDIENCE_I18N = {
  internal: 'learning.audienceInternal',
  customer: 'learning.audienceCustomer',
  partner: 'learning.audiencePartner',
  external: 'learning.audienceExternal',
};
const { t } = useI18n();
const loading = ref(true);
const data = ref(null);

function audienceLabel(key) {
  return t(AUDIENCE_I18N[key] || 'learning.audienceExternal');
}

const seatPercent = computed(() => {
  const used = Number(data.value?.learnerSeatsUsed) || 0;
  const cap = Number(data.value?.learnerSeatCapacity) || 0;
  if (!cap) return 0;
  return Math.min(100, Math.round((used / cap) * 100));
});

onMounted(async () => {
  try {
    const res = await apiClient.get('/lms/analytics', { cache: 'no-store' });
    data.value = res?.data || res;
  } finally {
    loading.value = false;
  }
});
</script>
