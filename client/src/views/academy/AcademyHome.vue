<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
        {{ t('learning.academyHomeTitle', { name: branding?.name || t('learning.academyNameFallback') }) }}
      </h1>
      <p class="mt-1 text-sm text-gray-500">
        {{ t('learning.academyHomeBlurb') }}
      </p>
    </div>

    <div
      v-if="needsAccept"
      class="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40"
    >
      <p class="text-sm text-amber-900 dark:text-amber-100">
        {{ t('learning.academyInvitePending') }}
      </p>
      <button
        type="button"
        class="mt-3 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
        :disabled="accepting"
        @click="acceptInvite"
      >
        {{ accepting ? t('learning.academyAccepting') : t('learning.academyAcceptInvite') }}
      </button>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <router-link
        to="/academy/catalog"
        class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900"
      >
        <h2 class="font-semibold text-gray-900 dark:text-white">{{ t('learning.academyCatalog') }}</h2>
        <p class="mt-1 text-sm text-gray-500">{{ t('learning.academyCatalogBlurb') }}</p>
      </router-link>
      <router-link
        to="/academy/my"
        class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900"
      >
        <h2 class="font-semibold text-gray-900 dark:text-white">{{ t('learning.academyMyLearning') }}</h2>
        <p class="mt-1 text-sm text-gray-500">{{ t('learning.academyMyLearningBlurb') }}</p>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { useAcademyBranding } from '@/composables/useAcademyBranding';

const { t } = useI18n();
const { success, error } = useNotifications();
const { branding } = useAcademyBranding();
const me = ref(null);
const accepting = ref(false);

const needsAccept = computed(() => me.value?.access?.status === 'invited');

async function loadMe() {
  try {
    const res = await apiClient.get('/lms/academy/me', { cache: 'no-store' });
    me.value = res?.data || res;
  } catch (e) {
    if (e?.response?.data?.code === 'ACADEMY_ACCESS_REQUIRED') {
      me.value = { access: { status: 'invited' } };
    }
  }
}

async function acceptInvite() {
  accepting.value = true;
  try {
    await apiClient.post('/lms/academy/accept');
    success(t('learning.academyAccepted'));
    await loadMe();
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.loadFailed'));
  } finally {
    accepting.value = false;
  }
}

onMounted(loadMe);
</script>
