<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-neutral-950">
    <TelephonyNav />
    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('telephony.callsTitle') }}</h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('telephony.callsDesc') }}</p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <label class="text-xs text-gray-600 dark:text-gray-400">
            {{ t('telephony.callsFilterDirection') }}
            <select
              v-model="direction"
              class="mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              @change="load"
            >
              <option value="">{{ t('telephony.callsFilterAll') }}</option>
              <option value="inbound">{{ t('telephony.directionInbound') }}</option>
              <option value="outbound">{{ t('telephony.directionOutbound') }}</option>
            </select>
          </label>
          <label class="text-xs text-gray-600 dark:text-gray-400">
            {{ t('telephony.callsFilterStatus') }}
            <select
              v-model="status"
              class="mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              @change="load"
            >
              <option value="">{{ t('telephony.callsFilterAll') }}</option>
              <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </label>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            @click="openDial"
          >
            {{ t('telephony.callsClickToCall') }}
          </button>
        </div>
      </div>

      <p v-if="loading" class="text-sm text-gray-500">{{ t('states.loading') }}</p>
      <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>
      <p v-else-if="!rows.length" class="text-sm text-gray-500">{{ t('telephony.callsEmpty') }}</p>

      <div v-else class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b border-gray-100 text-xs uppercase text-gray-500 dark:border-gray-800">
            <tr>
              <th class="px-3 py-2">{{ t('telephony.callsColFrom') }}</th>
              <th class="px-3 py-2">{{ t('telephony.callsColTo') }}</th>
              <th class="px-3 py-2">{{ t('telephony.callsColDirection') }}</th>
              <th class="px-3 py-2">{{ t('telephony.callsColStatus') }}</th>
              <th class="px-3 py-2">{{ t('telephony.callsColDuration') }}</th>
              <th class="px-3 py-2">{{ t('telephony.callsColStarted') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row._id"
              class="cursor-pointer border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
              @click="goDetail(row._id)"
            >
              <td class="px-3 py-2" @click.stop>
                <PhoneLink :number="row.from" />
              </td>
              <td class="px-3 py-2" @click.stop>
                <PhoneLink :number="row.to" />
              </td>
              <td class="px-3 py-2">{{ directionLabel(row.direction) }}</td>
              <td class="px-3 py-2">{{ statusLabel(row.status) }}</td>
              <td class="px-3 py-2">{{ formatDuration(row.durationSeconds) }}</td>
              <td class="px-3 py-2">{{ formatDate(row.startedAt || row.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import TelephonyNav from '@/components/telephony/TelephonyNav.vue';
import PhoneLink from '@/components/telephony/PhoneLink.vue';
import { listCalls } from '@/utils/telephonyApi';
import { formatUserDateTime } from '@/utils/localeFormat';
import { useTelephonySoftphone } from '@/composables/useTelephonySoftphone';

const { t } = useI18n();
const router = useRouter();
const { openDock, dialNumber } = useTelephonySoftphone();

const loading = ref(true);
const error = ref('');
const rows = ref([]);
const direction = ref('');
const status = ref('');

const statusOptions = computed(() => [
  { value: 'ringing', label: t('telephony.statusRinging') },
  { value: 'queued', label: t('telephony.statusQueued') },
  { value: 'in-progress', label: t('telephony.statusInProgress') },
  { value: 'completed', label: t('telephony.statusCompleted') },
  { value: 'busy', label: t('telephony.statusBusy') },
  { value: 'no-answer', label: t('telephony.statusNoAnswer') },
  { value: 'failed', label: t('telephony.statusFailed') },
  { value: 'canceled', label: t('telephony.statusCanceled') },
  { value: 'missed', label: t('telephony.statusMissed') },
]);

function directionLabel(value) {
  if (value === 'inbound') return t('telephony.directionInbound');
  if (value === 'outbound') return t('telephony.directionOutbound');
  return value || '—';
}

function statusLabel(value) {
  const map = {
    ringing: 'telephony.statusRinging',
    queued: 'telephony.statusQueued',
    'in-progress': 'telephony.statusInProgress',
    completed: 'telephony.statusCompleted',
    busy: 'telephony.statusBusy',
    'no-answer': 'telephony.statusNoAnswer',
    failed: 'telephony.statusFailed',
    canceled: 'telephony.statusCanceled',
    missed: 'telephony.statusMissed',
  };
  return map[value] ? t(map[value]) : value || '—';
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

function goDetail(id) {
  router.push(`/telephony/calls/${id}`);
}

function openDial() {
  dialNumber.value = '';
  openDock();
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await listCalls({
      status: status.value || undefined,
      limit: 100,
    });
    let data = Array.isArray(res?.data) ? res.data : [];
    if (direction.value) {
      data = data.filter((row) => row.direction === direction.value);
    }
    rows.value = data;
  } catch {
    error.value = t('telephony.callsLoadFailed');
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
