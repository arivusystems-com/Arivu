<template>
  <div class="max-w-lg">
    <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
      {{ t('learning.academyProfile') }}
    </h1>
    <dl class="mt-6 space-y-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <div>
        <dt class="text-xs font-medium uppercase text-gray-500">{{ t('learning.academyProfileName') }}</dt>
        <dd class="text-sm text-gray-900 dark:text-white">
          {{ [authStore.user?.firstName, authStore.user?.lastName].filter(Boolean).join(' ') || '—' }}
        </dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase text-gray-500">{{ t('learning.academyProfileEmail') }}</dt>
        <dd class="text-sm text-gray-900 dark:text-white">{{ authStore.user?.email || '—' }}</dd>
      </div>
      <div v-if="audience">
        <dt class="text-xs font-medium uppercase text-gray-500">{{ t('learning.academyAudience') }}</dt>
        <dd class="text-sm capitalize text-gray-900 dark:text-white">{{ audience }}</dd>
      </div>
    </dl>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/auth';

const { t } = useI18n();
const authStore = useAuthStore();
const audience = ref(null);

onMounted(async () => {
  try {
    const res = await apiClient.get('/lms/academy/me', { cache: 'no-store' });
    audience.value = res?.data?.audience || res?.audience || null;
  } catch {
    audience.value = null;
  }
});
</script>
