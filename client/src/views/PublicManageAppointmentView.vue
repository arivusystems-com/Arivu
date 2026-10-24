<template>
  <div class="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 px-4 py-10">
    <div class="mx-auto max-w-lg">
      <div v-if="loading" class="flex flex-col items-center gap-4 py-24 text-white/80">
        <div class="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        <p class="text-sm">{{ t('appointments.publicLoading') }}</p>
      </div>

      <div
        v-else-if="loadError"
        class="rounded-2xl bg-white p-8 text-center shadow-2xl dark:bg-gray-900"
      >
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('appointments.publicUnavailable') }}</h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">{{ loadError }}</p>
      </div>

      <div v-else-if="cancelled" class="rounded-2xl bg-white p-8 text-center shadow-2xl dark:bg-gray-900">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <span class="text-2xl">✓</span>
        </div>
        <h1 class="mt-4 text-xl font-bold text-gray-900 dark:text-white">{{ t('appointments.publicCancelledTitle') }}</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('appointments.publicCancelledHint') }}</p>
      </div>

      <div v-else-if="rescheduled" class="rounded-2xl bg-white p-8 text-center shadow-2xl dark:bg-gray-900">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <span class="text-2xl text-emerald-600">✓</span>
        </div>
        <h1 class="mt-4 text-xl font-bold text-gray-900 dark:text-white">{{ t('appointments.publicUpdatedTitle') }}</h1>
        <p class="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{{ formatSlotDate(appointment.startDateTime) }}</p>
        <p class="text-indigo-600">{{ formatSlotTime(appointment.startDateTime) }} – {{ formatSlotTime(appointment.endDateTime) }}</p>
        <p class="mt-4 text-sm text-gray-500">{{ t('appointments.publicUpdatedEmail') }}</p>
      </div>

      <template v-else-if="appointment">
        <header class="mb-6 text-center text-white">
          <p class="text-sm font-medium text-indigo-300">{{ t('appointments.publicManageEyebrow') }}</p>
          <h1 class="mt-2 text-2xl font-bold">{{ appointment.eventName }}</h1>
          <p v-if="appointment.displayName" class="mt-1 text-white/70">{{ t('appointments.publicWithHost', { name: appointment.displayName }) }}</p>
        </header>

        <div class="rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
          <div class="rounded-xl bg-indigo-50 p-4 dark:bg-indigo-950/40">
            <p class="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">{{ t('appointments.publicScheduled') }}</p>
            <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
              {{ formatSlotDate(appointment.startDateTime) }}
            </p>
            <p class="text-indigo-700 dark:text-indigo-300">
              {{ formatSlotTime(appointment.startDateTime) }} – {{ formatSlotTime(appointment.endDateTime) }}
            </p>
          </div>

          <a
            v-if="appointment.meetingLink"
            :href="appointment.meetingLink"
            target="_blank"
            rel="noopener"
            class="mt-4 flex w-full items-center justify-center rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {{ t('appointments.joinMeeting') }}
          </a>

          <p v-if="actionError" class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
            {{ actionError }}
          </p>

          <div v-if="mode === 'view' && appointment.canReschedule" class="mt-6 space-y-3">
            <button
              type="button"
              class="w-full rounded-xl border border-indigo-200 bg-indigo-50 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200"
              @click="mode = 'reschedule'"
            >
              {{ t('appointments.reschedule') }}
            </button>
            <button
              v-if="appointment.canCancel"
              type="button"
              class="w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
              :disabled="cancelling"
              @click="confirmCancel"
            >
              {{ cancelling ? t('appointments.publicCancelling') : t('appointments.cancelAppointment') }}
            </button>
          </div>

          <div v-else-if="mode === 'reschedule'" class="mt-6">
            <button type="button" class="mb-4 text-sm text-indigo-600 hover:underline" @click="mode = 'view'">
              {{ t('appointments.publicBack') }}
            </button>
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('appointments.pickNewDate') }}</p>
            <div class="mt-2 flex gap-2 overflow-x-auto pb-2">
              <button
                v-for="d in dateOptions"
                :key="d.key"
                type="button"
                class="flex min-w-[3.5rem] flex-col items-center rounded-xl border px-3 py-2 text-sm transition-colors"
                :class="selectedDate === d.key ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 dark:border-gray-700'"
                @click="pickDate(d.key)"
              >
                <span class="text-xs text-gray-500">{{ d.weekday }}</span>
                <span class="font-semibold">{{ d.day }}</span>
              </button>
            </div>
            <div v-if="slotsLoading" class="py-6 text-center text-sm text-gray-500">{{ t('appointments.loadingTimes') }}</div>
            <div v-else-if="!slots.length" class="py-6 text-center text-sm text-gray-500">{{ t('appointments.noTimesThisDay') }}</div>
            <div v-else class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button
                v-for="slot in slots"
                :key="slot.start"
                type="button"
                class="rounded-lg border py-2 text-sm font-medium transition-colors"
                :class="selectedSlot?.start === slot.start
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-gray-200 hover:border-indigo-300 dark:border-gray-700'"
                @click="selectedSlot = slot"
              >
                {{ formatSlotTime(slot.start) }}
              </button>
            </div>
            <button
              type="button"
              class="mt-4 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              :disabled="!selectedSlot || submitting"
              @click="submitReschedule"
            >
              {{ submitting ? t('states.saving') : t('appointments.confirmNewTime') }}
            </button>
          </div>

          <p
            v-else-if="!appointment.canReschedule && !appointment.canCancel"
            class="mt-6 text-center text-sm text-gray-500"
          >
            {{ t('appointments.publicCannotChange') }}
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { formatSlotTime, formatSlotDate } from '@/utils/appointmentFormatters';
import { formatDate } from '@/utils/localeFormat';

import { confirmAction } from '@/composables/useConfirmAction';
const { t } = useI18n();

const route = useRoute();
const token = computed(() => route.params.token);

const loading = ref(true);
const loadError = ref(null);
const appointment = ref(null);
const mode = ref('view');
const cancelled = ref(false);
const rescheduled = ref(false);
const actionError = ref(null);
const cancelling = ref(false);
const submitting = ref(false);

const selectedDate = ref(null);
const selectedSlot = ref(null);
const slots = ref([]);
const slotsLoading = ref(false);

const dateOptions = computed(() => {
  const out = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      key: d.toISOString().slice(0, 10),
      weekday: formatDate(d, { weekday: 'short' }),
      day: d.getDate()
    });
  }
  return out;
});

const apiBase = '/api/public/appointments/manage';

async function fetchAppointment() {
  loading.value = true;
  loadError.value = null;
  try {
    const res = await fetch(`${apiBase}/${token.value}`);
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || t('appointments.publicNotFound'));
    appointment.value = data.data;
    if (data.data.status === 'Cancelled') cancelled.value = true;
  } catch (e) {
    loadError.value = e.message || t('appointments.publicLinkInvalid');
  } finally {
    loading.value = false;
  }
}

async function fetchSlots() {
  if (!selectedDate.value) return;
  slotsLoading.value = true;
  selectedSlot.value = null;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await fetch(
      `${apiBase}/${token.value}/slots?date=${selectedDate.value}&timezone=${encodeURIComponent(tz)}`
    );
    const data = await res.json();
    slots.value = data.success ? data.data.slots : [];
  } catch {
    slots.value = [];
  } finally {
    slotsLoading.value = false;
  }
}

function pickDate(key) {
  selectedDate.value = key;
  fetchSlots();
}

async function submitReschedule() {
  if (!selectedSlot.value) return;
  actionError.value = null;
  submitting.value = true;
  try {
    const res = await fetch(`${apiBase}/${token.value}/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: selectedSlot.value.start })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || t('appointments.rescheduleFailed'));
    appointment.value = data.data;
    rescheduled.value = true;
    mode.value = 'view';
  } catch (e) {
    actionError.value = e.message;
  } finally {
    submitting.value = false;
  }
}

async function confirmCancel() {
  if (!await confirmAction(t('appointments.publicCancelConfirm'))) return;
  actionError.value = null;
  cancelling.value = true;
  try {
    const res = await fetch(`${apiBase}/${token.value}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Cancelled by guest' })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || t('appointments.publicCancelFailed'));
    cancelled.value = true;
  } catch (e) {
    actionError.value = e.message;
  } finally {
    cancelling.value = false;
  }
}

onMounted(() => {
  fetchAppointment();
});
</script>
