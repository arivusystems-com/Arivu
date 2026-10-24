<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-neutral-950">
    <TelephonyNav />
    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <h1 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('telephony.recordingsTitle') }}</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('telephony.recordingsDesc') }}</p>

      <p v-if="loading" class="mt-4 text-sm text-gray-500">{{ t('states.loading') }}</p>
      <p v-else-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
      <p v-else-if="!rows.length" class="mt-4 text-sm text-gray-500">{{ t('telephony.recordingsEmpty') }}</p>
      <ul v-else class="mt-4 space-y-3">
        <li
          v-for="row in rows"
          :key="row._id"
          class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <p class="font-medium text-gray-900 dark:text-white">
                {{ row.callId || row._id }}
              </p>
              <p class="text-xs text-gray-500">
                {{ formatDuration(row.durationSeconds) }} · {{ formatDate(row.createdAt) }}
              </p>
            </div>
            <a
              :href="downloadUrl(row._id)"
              class="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              target="_blank"
              rel="noopener"
            >
              {{ t('telephony.recordingsListen') }}
            </a>
          </div>
          <audio class="mt-3 w-full" controls :src="downloadUrl(row._id)" />
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import TelephonyNav from '@/components/telephony/TelephonyNav.vue';
import { listRecordings } from '@/utils/telephonyApi';
import { formatUserDateTime } from '@/utils/localeFormat';
import { getApiUrlForFetch } from '@/config/apiBase';

const { t } = useI18n();
const loading = ref(true);
const error = ref('');
const rows = ref([]);

function downloadUrl(id) {
  return getApiUrlForFetch(`/telephony/recordings/${id}/download`);
}

function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return formatUserDateTime(value);
  } catch {
    return '—';
  }
}

onMounted(async () => {
  try {
    const res = await listRecordings({ limit: 50 });
    rows.value = Array.isArray(res?.data) ? res.data : [];
  } catch {
    error.value = t('telephony.recordingsLoadFailed');
  } finally {
    loading.value = false;
  }
});
</script>
