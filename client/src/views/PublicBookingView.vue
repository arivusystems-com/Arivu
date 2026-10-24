<template>
  <div
    ref="rootEl"
    :class="isEmbed ? 'booking-embed-surface min-h-0 bg-gray-50' : 'min-h-screen'"
    :style="pageStyle"
  >
    <div
      class="mx-auto flex max-w-lg flex-col px-4 sm:px-6"
      :class="isEmbed ? 'py-4' : 'min-h-screen py-10'"
    >
      <!-- Loading -->
      <div v-if="loading" class="flex flex-1 flex-col items-center justify-center gap-4">
        <div
          class="h-11 w-11 animate-spin rounded-full border-2"
          :class="isEmbed ? 'border-gray-300 border-t-indigo-600' : 'border-white/30 border-t-white'"
        ></div>
        <p class="text-sm" :class="isEmbed ? 'text-gray-500' : 'text-white/80'">{{ t('common.publicBookingViewLoadingCalendar') }}</p>
      </div>

      <!-- Error -->
      <div
        v-else-if="loadError"
        class="flex flex-1 flex-col items-center justify-center text-center"
      >
        <div class="rounded-2xl bg-white/95 p-8 shadow-2xl dark:bg-gray-900">
          <CalendarDaysIcon class="mx-auto h-12 w-12 text-gray-400" />
          <h1 class="mt-4 text-xl font-bold text-gray-900 dark:text-white">{{ t('common.publicBookingViewPageUnavailable') }}</h1>
          <p class="mt-2 text-gray-600 dark:text-gray-400">{{ loadError }}</p>
        </div>
      </div>

      <!-- Confirmed -->
      <div v-else-if="confirmed" class="flex flex-1 flex-col items-center justify-center">
          <div class="w-full rounded-2xl bg-white p-8 text-center shadow-2xl dark:bg-gray-900">
            <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <CheckCircleIcon class="h-10 w-10 text-emerald-600" />
            </div>
            <h1 class="mt-5 text-2xl font-bold text-gray-900 dark:text-white">{{ t('common.publicBookingViewYoureBooked') }}</h1>
            <p class="mt-2 text-gray-600 dark:text-gray-400">{{ confirmation.eventName }}</p>
            <p class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              {{ formatSlotDate(confirmation.startDateTime) }}
            </p>
            <p class="text-indigo-600 dark:text-indigo-400">
              {{ formatSlotTime(confirmation.startDateTime) }} – {{ formatSlotTime(confirmation.endDateTime) }}
            </p>
            <p class="mt-6 text-sm text-gray-500">{{ t('common.publicBookingViewAConfirmationHasBeenSentTo') }}</p>
            <a
              v-if="confirmation.manageUrl"
              :href="confirmation.manageUrl"
              class="mt-4 inline-block text-sm font-medium text-indigo-600 underline"
            >{{ t('common.publicBookingViewRescheduleOrCancel') }}</a>
          </div>
      </div>

      <!-- Booking flow -->
      <template v-else-if="page">
        <!-- Host card -->
        <header class="mb-8 text-center" :class="isEmbed ? 'text-gray-900' : 'text-white'">
          <div
            v-if="page.isTeam && page.members?.length"
            class="mx-auto mb-4 flex h-20 items-center justify-center"
          >
            <div
              v-for="(m, i) in page.members.slice(0, 4)"
              :key="m.id || i"
              class="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 text-lg font-bold ring-2"
              :class="isEmbed
                ? 'border-gray-200 bg-gray-100 text-gray-800 ring-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700'
                : 'border-white/40 bg-white/20 ring-white/30'"
              :style="{ marginLeft: i > 0 ? '-12px' : '0', zIndex: 10 - i }"
            >
              <img v-if="m.avatar" :src="m.avatar" alt="" class="h-full w-full object-cover" />
              <span v-else>{{ (m.name || '?').charAt(0).toUpperCase() }}</span>
            </div>
          </div>
          <div
            v-else-if="page.host?.avatar"
            class="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-full ring-4"
            :class="isEmbed ? 'ring-gray-200 dark:ring-gray-700' : 'ring-white/30'"
          >
            <img :src="page.host.avatar" alt="" class="h-full w-full object-cover" />
          </div>
          <div
            v-else
            class="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold ring-4"
            :class="isEmbed
              ? 'bg-[var(--accent)]/15 text-[var(--accent)] ring-[var(--accent)]/25 dark:bg-[var(--accent)]/25 dark:text-indigo-200 dark:ring-[var(--accent)]/40'
              : 'bg-white/20 ring-white/30'"
          >
            {{ hostInitial }}
          </div>
          <h1 class="text-2xl font-bold tracking-tight">{{ page.displayName || page.host?.name }}</h1>
          <p
            v-if="page.isTeam"
            class="mt-1 text-sm"
            :class="isEmbed ? 'text-gray-500 dark:text-gray-400' : 'text-white/75'"
          >{{ t('common.publicBookingViewBookWithOurTeam') }}</p>
          <p
            class="mt-2 max-w-md mx-auto text-sm leading-relaxed"
            :class="isEmbed ? 'text-gray-600 dark:text-gray-400' : 'text-white/85'"
          >
            {{ page.branding?.welcomeNote || 'Select a time for our meeting.' }}
          </p>
        </header>

        <!-- Step indicator -->
        <div class="mb-6 flex justify-center gap-2">
          <span
            v-for="(label, i) in stepLabels"
            :key="label"
            class="h-1.5 rounded-full transition-all duration-300"
            :class="[
              i <= stepIndex ? 'w-8' : 'w-4',
              isEmbed
                ? (i <= stepIndex ? 'bg-[var(--accent)]' : 'bg-gray-300 dark:bg-gray-600')
                : (i <= stepIndex ? 'bg-white' : 'bg-white/35')
            ]"
          />
        </div>

        <div
          class="flex-1 rounded-2xl bg-white"
          :class="isEmbed ? 'shadow-md ring-1 ring-gray-200/80' : 'shadow-2xl dark:bg-gray-900'"
        >
          <!-- Step 0: Type -->
          <div v-show="step === 'type'" class="p-6 sm:p-8">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">What would you like to discuss?</h2>
            <div class="mt-4 space-y-2">
              <button
                v-for="opt in typeOptions"
                :key="opt.value"
                type="button"
                class="flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all duration-200 hover:border-[var(--accent)] active:scale-[0.99]"
                :class="selectedType === opt.value ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-gray-200 dark:border-gray-700'"
                @click="selectType(opt.value)"
              >
                <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-lg dark:bg-gray-800">{{ opt.emoji }}</span>
                <span>
                  <span class="block font-semibold text-gray-900 dark:text-white">{{ opt.label }}</span>
                  <span class="text-sm text-gray-500">{{ opt.description }}</span>
                </span>
              </button>
            </div>
          </div>

          <!-- Step 1: Date & time -->
          <div v-show="step === 'schedule'" class="p-6 sm:p-8">
            <button type="button" class="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800" @click="step = 'type'">
              <ChevronLeftIcon class="h-4 w-4" />{{ t('performance.back') }}</button>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('common.publicBookingViewPickADate') }}</h2>
            <div class="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              <button
                v-for="d in dateOptions"
                :key="d.key"
                type="button"
                class="shrink-0 rounded-xl border-2 px-4 py-3 text-center transition-all duration-200"
                :class="selectedDate === d.key
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'"
                @click="pickDate(d.key)"
              >
                <span class="block text-xs font-medium uppercase opacity-80">{{ d.weekday }}</span>
                <span class="block text-lg font-bold">{{ d.day }}</span>
              </button>
            </div>

            <h3 class="mt-6 text-sm font-semibold text-gray-700 dark:text-gray-300">{{ t('common.publicBookingViewAvailableTimes') }}</h3>
            <p v-if="visitorTimezoneLabel" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Times in your timezone ({{ visitorTimezoneLabel }})
              <span v-if="scheduleTimezoneLabel && scheduleTimezoneLabel !== visitorTimezoneLabel">
                · Host: {{ scheduleTimezoneLabel }}
              </span>
            </p>
            <div v-if="slotsLoading" class="mt-4 flex justify-center py-8">
              <div class="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[var(--accent)]"></div>
            </div>
            <p v-else-if="!slots.length" class="mt-4 text-sm text-gray-500">{{ emptySlotsMessage }}</p>
            <div v-else class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button
                v-for="slot in slots"
                :key="slot.start"
                type="button"
                class="rounded-xl border-2 py-2.5 text-sm font-semibold transition-all duration-200 hover:border-[var(--accent)] active:scale-[0.98]"
                :class="selectedSlot?.start === slot.start
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-gray-200 text-gray-800 dark:border-gray-700 dark:text-gray-200'"
                @click="selectedSlot = slot"
              >
                {{ formatSlotTime(slot.start) }}
              </button>
            </div>
            <button
              type="button"
              class="mt-6 w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
              :style="{ backgroundColor: accent }"
              :disabled="!selectedSlot"
              @click="step = 'details'"
            >{{ t('performance.next') }}</button>
          </div>

          <!-- Step 2: Details -->
          <div v-show="step === 'details'" class="p-6 sm:p-8">
            <button type="button" class="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800" @click="step = 'schedule'">
              <ChevronLeftIcon class="h-4 w-4" />{{ t('performance.back') }}</button>
            <div class="mb-5 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
              <p class="text-xs font-medium uppercase text-gray-500">{{ t('common.publicBookingViewYourTime') }}</p>
              <p class="mt-1 font-semibold text-gray-900 dark:text-white">
                {{ selectedSlot ? formatSlotDate(selectedSlot.start) : '' }}
              </p>
              <p class="text-sm text-[var(--accent)]">{{ selectedSlot ? formatSlotTime(selectedSlot.start) : '' }}</p>
            </div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('common.publicBookingViewYourDetails') }}</h2>
            <form class="mt-4 space-y-4" @submit.prevent="submitBooking">
              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">First name *</label>
                  <input v-model="guest.firstName" required class="field-input mt-1" />
                </div>
                <div>
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.assignRulesCondFieldLastName') }}</label>
                  <input v-model="guest.lastName" class="field-input mt-1" />
                </div>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Email *</label>
                <input v-model="guest.email" type="email" required class="field-input mt-1" />
              </div>
              <div>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.settingsAddFieldTypePhone') }}</label>
                <input v-model="guest.phone" type="tel" class="field-input mt-1" />
              </div>
              <div v-for="field in page.customFields" :key="field.key">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ field.label }}{{ field.required ? ' *' : '' }}</label>
                <textarea
                  v-if="field.type === 'textarea'"
                  v-model="formResponses[field.key]"
                  :required="field.required"
                  rows="3"
                  class="field-input mt-1"
                />
                <select
                  v-else-if="field.type === 'select'"
                  v-model="formResponses[field.key]"
                  :required="field.required"
                  class="field-input mt-1"
                >
                  <option value="" disabled>{{ field.required ? 'Select…' : 'Optional' }}</option>
                  <option v-for="opt in field.options || []" :key="opt" :value="opt">{{ opt }}</option>
                </select>
                <input
                  v-else
                  v-model="formResponses[field.key]"
                  :type="field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'"
                  :required="field.required"
                  class="field-input mt-1"
                />
              </div>
              <p v-if="submitError" class="text-sm text-red-600">{{ submitError }}</p>
              <button
                type="submit"
                class="w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
                :style="{ backgroundColor: accent }"
                :disabled="submitting"
              >
                {{ submitting ? 'Booking…' : 'Confirm booking' }}
              </button>
            </form>
          </div>
        </div>

        <p v-if="!isEmbed" class="mt-6 text-center text-xs text-white/60">{{ t('common.publicBookingViewPoweredByYourCrm') }}</p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronLeftIcon
} from '@heroicons/vue/24/outline';
import {
  APPOINTMENT_TYPE_OPTIONS,
  formatSlotTime,
  formatSlotDate
} from '@/utils/appointmentFormatters';
import { formatDate } from '@/utils/localeFormat';

const route = useRoute();
const slug = computed(() => route.params.slug);
const isEmbed = computed(() => route.meta.embed === true);
const rootEl = ref(null);
let resizeObserver = null;

const loading = ref(true);
const loadError = ref(null);
const page = ref(null);
const step = ref('type');
const selectedType = ref('consultation');
const selectedDate = ref(null);
const selectedSlot = ref(null);
const slots = ref([]);
const slotsLoading = ref(false);
const dayClosedReason = ref(null);
const scheduleTimezoneLabel = ref('');
const visitorTimezoneLabel = ref(
  typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : ''
);

const emptySlotsMessage = computed(() => {
  if (dayClosedReason.value === 'holiday') {
    return 'This date is a holiday for the host. Please choose another day.';
  }
  if (dayClosedReason.value === 'non_working_day') {
    return 'The host is not available on this day. Try another date.';
  }
  return 'No open times left this day — the calendar may be full. Try another date.';
});
const guest = ref({ firstName: '', lastName: '', email: '', phone: '' });
const formResponses = ref({});
const submitting = ref(false);
const submitError = ref(null);
const confirmed = ref(false);
const confirmation = ref({});

const stepLabels = ['Type', 'Time', 'Details'];
const stepIndex = computed(() => ({ type: 0, schedule: 1, details: 2 }[step.value] ?? 0));

const accent = computed(() => page.value?.branding?.themeColor || '#4f46e5');
const pageStyle = computed(() => {
  if (isEmbed.value) {
    return { '--accent': accent.value };
  }
  return {
    background: `linear-gradient(165deg, ${accent.value} 0%, ${adjustColor(accent.value, -40)} 45%, #0f172a 100%)`,
    '--accent': accent.value
  };
});

function notifyEmbedHeight() {
  if (!isEmbed.value || typeof window === 'undefined' || window.parent === window) return;
  const height = Math.ceil(document.documentElement.scrollHeight);
  window.parent.postMessage({ type: 'arivu-booking-resize', height }, '*');
}

function setupEmbedResize() {
  if (!isEmbed.value) return;
  notifyEmbedHeight();
  if (typeof ResizeObserver !== 'undefined' && rootEl.value) {
    resizeObserver = new ResizeObserver(() => notifyEmbedHeight());
    resizeObserver.observe(rootEl.value);
  }
}

const hostInitial = computed(() => {
  const n = page.value?.displayName || page.value?.host?.name || '?';
  return n.charAt(0).toUpperCase();
});

const typeOptions = computed(() => {
  const allowed = page.value?.appointmentTypes || ['consultation'];
  const emojis = { demo: '🎯', support: '🛟', consultation: '💬', other: '📅' };
  return APPOINTMENT_TYPE_OPTIONS.filter((o) => allowed.includes(o.value)).map((o) => ({
    ...o,
    emoji: emojis[o.value] || '📅'
  }));
});

const dateOptions = computed(() => {
  const out = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    out.push({
      key,
      weekday: formatDate(d, { weekday: 'short' }),
      day: d.getDate()
    });
  }
  return out;
});

function adjustColor(hex, amount) {
  try {
    const h = hex.replace('#', '');
    const num = parseInt(h, 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  } catch {
    return hex;
  }
}

function selectType(value) {
  selectedType.value = value;
  step.value = 'schedule';
  if (!selectedDate.value && dateOptions.value.length) {
    pickDate(dateOptions.value[0].key);
  }
}

async function fetchPage() {
  loading.value = true;
  loadError.value = null;
  try {
    const res = await fetch(`/api/public/book/${slug.value}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Not found');
    }
    page.value = data.data;
    if (typeOptions.value.length === 1) {
      selectedType.value = typeOptions.value[0].value;
      step.value = 'schedule';
    }
  } catch (e) {
    loadError.value = e.message || 'This booking page is not available.';
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
      `/api/public/book/${slug.value}/slots?date=${selectedDate.value}&timezone=${encodeURIComponent(tz)}`
    );
    const data = await res.json();
    if (data.success) {
      slots.value = data.data.slots || [];
      dayClosedReason.value = data.data.dayClosed ? data.data.dayClosedReason : null;
      scheduleTimezoneLabel.value = data.data.timezone || '';
    } else {
      slots.value = [];
      dayClosedReason.value = null;
    }
  } catch {
    slots.value = [];
    dayClosedReason.value = null;
  } finally {
    slotsLoading.value = false;
  }
}

function pickDate(key) {
  selectedDate.value = key;
  fetchSlots();
}

async function submitBooking() {
  submitError.value = null;
  submitting.value = true;
  try {
    const res = await fetch(`/api/public/book/${slug.value}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: selectedSlot.value.start,
        appointmentType: selectedType.value,
        customerTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        guest: guest.value,
        formResponses: formResponses.value
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Booking failed');
    }
    confirmation.value = data.data;
    confirmed.value = true;
  } catch (e) {
    submitError.value = e.message;
  } finally {
    submitting.value = false;
  }
}

watch(slug, fetchPage);
watch([loading, step, confirmed, page], () => {
  nextTick(() => notifyEmbedHeight());
});

onMounted(() => {
  fetchPage();
  if (dateOptions.value.length) selectedDate.value = dateOptions.value[0].key;
  nextTick(() => setupEmbedResize());
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});
</script>

<style scoped>
.booking-embed-surface {
  color-scheme: light;
}

.field-input {
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid rgb(229 231 235);
  background: white;
  padding: 0.625rem 1rem;
  color: rgb(17 24 39);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.field-input:focus {
  border-color: var(--accent);
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
}
:global(.dark) .field-input {
  border-color: rgb(75 85 99);
  background: rgb(31 41 55);
  color: white;
}
</style>
