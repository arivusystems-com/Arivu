<template>
  <div ref="rootRef" class="relative h-full">
    <button
      type="button"
      class="inline-flex h-full w-9 items-center justify-center rounded-r-full border-l border-white/25 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:hover:bg-indigo-500"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :title="t('inbox.emailComposeScheduleSend')"
      :aria-label="t('inbox.emailComposeScheduleSend')"
      @click.stop="toggle"
    >
      <ChevronDownIcon class="size-4" aria-hidden="true" />
    </button>

    <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-1 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-1 scale-95"
    >
      <div
        v-if="open"
        ref="panelRef"
        role="dialog"
        :aria-label="t('inbox.emailComposeScheduleSend')"
        class="fixed z-[10050] w-[min(100vw-1.5rem,19rem)] origin-bottom-left rounded-xl bg-white p-3 shadow-xl ring-1 ring-black/10 dark:bg-gray-800 dark:ring-white/10"
        :style="panelStyle"
        @keydown.esc.prevent.stop="close"
      >
        <div class="mb-2 flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ t('inbox.emailComposeScheduleSend') }}
          </h3>
          <button
            type="button"
            class="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
            :aria-label="t('settings.roleDrawerCloseSr')"
            @click="close"
          >
            <XMarkIcon class="size-4" aria-hidden="true" />
          </button>
        </div>

        <ul class="space-y-0.5">
          <li v-for="opt in quickOptions" :key="opt.id">
            <button
              type="button"
              class="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-gray-800 transition-colors hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700/80"
              @click="pickQuick(opt.at)"
            >
              <span class="font-medium">{{ opt.label }}</span>
              <span class="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                {{ opt.hint }}
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700/80"
              :class="showCustom ? 'bg-blue-50 dark:bg-indigo-950/50' : ''"
              @click="showCustom = !showCustom"
            >
              <CalendarDaysIcon class="size-4 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              {{ t('inbox.emailComposeSchedulePickDateTime') }}
            </button>
          </li>
        </ul>

        <div v-if="showCustom" class="mt-2 space-y-2 border-t border-gray-100 pt-2.5 dark:border-gray-700">
          <div class="grid grid-cols-2 gap-2">
            <label class="block text-xs text-gray-500 dark:text-gray-400">
              {{ t('inbox.emailComposeScheduleDate') }}
              <input
                v-model="customDate"
                type="date"
                :min="minDateStr"
                class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#0b57d0] dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </label>
            <label class="block text-xs text-gray-500 dark:text-gray-400">
              {{ t('inbox.emailComposeScheduleTime') }}
              <input
                v-model="customTime"
                type="time"
                class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#0b57d0] dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </label>
          </div>
          <p v-if="validationError" class="text-xs text-red-600 dark:text-red-400" role="alert">
            {{ validationError }}
          </p>
          <button
            type="button"
            class="w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-500"
            :disabled="!customDate || !customTime"
            @click="confirmCustom"
          >
            {{ t('inbox.emailComposeScheduleConfirm') }}
          </button>
        </div>
      </div>
    </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatUserDateTime } from '@/utils/localeFormat';
import { ChevronDownIcon, XMarkIcon, CalendarDaysIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['schedule']);

const { t, locale } = useI18n();

const open = ref(false);
const showCustom = ref(false);
const customDate = ref('');
const customTime = ref('');
const validationError = ref('');
const rootRef = ref(null);
const panelRef = ref(null);
const panelStyle = ref({});
const tick = ref(0);

const PANEL_WIDTH = 304;
const PANEL_GAP = 6;

function resolveSplitAnchor() {
  const el = rootRef.value;
  if (!el) return null;
  // Prefer the shared split control (parent of Send + chevron)
  const parent = el.parentElement;
  return parent || el;
}

function positionPanel() {
  const anchor = resolveSplitAnchor();
  if (!anchor) return;
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(PANEL_WIDTH, window.innerWidth - 24);
  let left = rect.left;
  // Keep panel within viewport
  if (left + width > window.innerWidth - 12) {
    left = Math.max(12, window.innerWidth - 12 - width);
  }
  if (left < 12) left = 12;

  // Prefer flip below if not enough room above
  const spaceAbove = rect.top - PANEL_GAP;
  const preferAbove = spaceAbove >= 220;
  if (preferAbove) {
    panelStyle.value = {
      left: `${left}px`,
      top: 'auto',
      bottom: `${window.innerHeight - rect.top + PANEL_GAP}px`,
      width: `${width}px`
    };
  } else {
    panelStyle.value = {
      left: `${left}px`,
      top: `${rect.bottom + PANEL_GAP}px`,
      bottom: 'auto',
      width: `${width}px`
    };
  }
}

const MIN_AHEAD_MS = 60 * 1000;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateInputValue(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTimeInputValue(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatTimeHint(d) {
  try {
    return new Intl.DateTimeFormat(locale.value || undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit'
    }).format(d);
  } catch {
    return formatUserDateTime(d);
  }
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function atLocal(y, m, day, h, min) {
  return new Date(y, m, day, h, min, 0, 0);
}

function nextWeekday(from, weekday, hour, minute) {
  const d = startOfDay(from);
  const current = d.getDay();
  let add = (weekday - current + 7) % 7;
  if (add === 0) add = 7;
  d.setDate(d.getDate() + add);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const minDateStr = computed(() => {
  void tick.value;
  return toDateInputValue(new Date());
});

const quickOptions = computed(() => {
  void tick.value;
  const now = new Date();
  const opts = [];

  // Later today: next top-of-hour at least 2h out, before 21:00
  const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  later.setMinutes(0, 0, 0);
  if (later.getHours() < 21 && later.getDate() === now.getDate()) {
    opts.push({
      id: 'later_today',
      label: t('inbox.emailComposeScheduleLaterToday'),
      hint: formatTimeHint(later),
      at: later
    });
  }

  const tomorrow = startOfDay(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowMorning = atLocal(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 8, 0);
  opts.push({
    id: 'tomorrow_morning',
    label: t('inbox.emailComposeScheduleTomorrowMorning'),
    hint: formatTimeHint(tomorrowMorning),
    at: tomorrowMorning
  });

  const tomorrowAfternoon = atLocal(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 13, 0);
  opts.push({
    id: 'tomorrow_afternoon',
    label: t('inbox.emailComposeScheduleTomorrowAfternoon'),
    hint: formatTimeHint(tomorrowAfternoon),
    at: tomorrowAfternoon
  });

  if (now.getDay() !== 1) {
    const mon = nextWeekday(now, 1, 8, 0);
    opts.push({
      id: 'monday_morning',
      label: t('inbox.emailComposeScheduleMondayMorning'),
      hint: formatTimeHint(mon),
      at: mon
    });
  }

  return opts;
});

function resetCustomDefaults() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  if (d.getTime() <= Date.now() + MIN_AHEAD_MS) {
    d.setTime(Date.now() + 2 * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
  }
  customDate.value = toDateInputValue(d);
  customTime.value = toTimeInputValue(d);
  validationError.value = '';
}

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value) {
    tick.value += 1;
    showCustom.value = false;
    resetCustomDefaults();
    nextTick(() => positionPanel());
  }
}

function close() {
  open.value = false;
  showCustom.value = false;
  validationError.value = '';
}

function validateFuture(date) {
  const t0 = date?.getTime?.();
  if (!Number.isFinite(t0)) {
    return t('inbox.emailComposeScheduleInvalid');
  }
  if (t0 < Date.now() + MIN_AHEAD_MS) {
    return t('inbox.emailComposeSchedulePastError');
  }
  const max = Date.now() + 365 * 24 * 60 * 60 * 1000;
  if (t0 > max) {
    return t('inbox.emailComposeScheduleTooFar');
  }
  return '';
}

function emitSchedule(date) {
  const err = validateFuture(date);
  if (err) {
    validationError.value = err;
    return;
  }
  validationError.value = '';
  emit('schedule', date.toISOString());
  close();
}

function pickQuick(at) {
  emitSchedule(at instanceof Date ? at : new Date(at));
}

function confirmCustom() {
  if (!customDate.value || !customTime.value) {
    validationError.value = t('inbox.emailComposeScheduleInvalid');
    return;
  }
  const [y, m, d] = customDate.value.split('-').map((x) => parseInt(x, 10));
  const [hh, mm] = customTime.value.split(':').map((x) => parseInt(x, 10));
  if (![y, m, d, hh, mm].every((n) => Number.isFinite(n))) {
    validationError.value = t('inbox.emailComposeScheduleInvalid');
    return;
  }
  const at = new Date(y, m - 1, d, hh, mm, 0, 0);
  emitSchedule(at);
}

function onDocPointer(e) {
  if (!open.value) return;
  const t = e.target;
  if (rootRef.value?.contains(t) || panelRef.value?.contains(t)) return;
  close();
}

function onReposition() {
  if (open.value) positionPanel();
}

watch(showCustom, () => {
  if (open.value) nextTick(() => positionPanel());
});

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer, true);
  window.addEventListener('resize', onReposition);
  window.addEventListener('scroll', onReposition, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer, true);
  window.removeEventListener('resize', onReposition);
  window.removeEventListener('scroll', onReposition, true);
});

watch(
  () => props.disabled,
  (d) => {
    if (d) close();
  }
);
</script>
