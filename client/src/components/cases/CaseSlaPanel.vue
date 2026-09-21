<template>
  <div class="flex h-full min-h-0 flex-col bg-white dark:bg-gray-900">
    <div
      class="record-context-panel__header flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700"
    >
      <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('cases.recordSlaSection') }}
      </h2>
      <span
        v-if="cycleStatusChip"
        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset"
        :class="cycleStatusChip.className"
      >
        <span class="h-1.5 w-1.5 rounded-full" :class="cycleStatusChip.dotClass" aria-hidden="true" />
        {{ cycleStatusChip.label }}
      </span>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <p
        v-if="!hasContent"
        class="rounded-lg border border-dashed border-gray-200 px-3 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
      >
        {{ t('cases.recordSlaEmpty') }}
      </p>

      <div v-else class="space-y-3">
        <div
          v-if="showSlaContextBanner"
          class="rounded-lg border px-3 py-2.5"
          :class="contextToneClass"
        >
          <p class="text-sm font-medium" :class="contextHeadlineClass">
            {{ contextHeadline }}
          </p>
          <p v-if="contextDetail" class="mt-0.5 text-xs leading-relaxed" :class="contextDetailClass">
            {{ contextDetail }}
          </p>
        </div>

        <div v-if="metrics.length" class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <div
            v-for="(metric, index) in metrics"
            :key="metric.key"
            class="px-3 py-3"
            :class="index > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {{ metric.label }}
                </p>
                <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                  {{ metric.summary }}
                </p>
              </div>
              <span
                class="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset"
                :class="metric.badgeClass"
              >
                {{ metric.stateLabel }}
              </span>
            </div>

            <div v-if="metric.percent != null" class="mt-2.5">
              <div class="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  class="h-full rounded-full transition-[width] duration-300"
                  :class="metric.barClass"
                  :style="{ width: `${metric.percent}%` }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatRelativeTime } from '@/utils/relativeTime';

const WARNING_THRESHOLD_PERCENT = 80;

const props = defineProps({
  caseRecord: { type: Object, default: null }
});

const { t } = useI18n();

const cycle = computed(() => props.caseRecord?.currentSlaCycle || null);
const progress = computed(() => props.caseRecord?.slaProgress || null);

const hasSlaCycle = computed(() => Boolean(cycle.value));

const showSlaContextBanner = computed(() => {
  const cycleStatus = cycle.value?.status;
  const ctx = props.caseRecord?.slaContext;
  if (cycleStatus === 'paused') return true;
  if (!ctx?.useBusinessHours) return false;
  return ctx.isOpen === false;
});

const hasContent = computed(
  () => metrics.value.length > 0 || showSlaContextBanner.value
);

const isPaused = computed(() => cycle.value?.status === 'paused');

const cycleStatusChip = computed(() => {
  if (!hasSlaCycle.value) return null;
  if (isPaused.value) {
    return {
      label: t('cases.recordSlaPaused'),
      className:
        'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800',
      dotClass: 'bg-amber-500'
    };
  }
  return {
    label: t('marketing.campaignsStatusRunning'),
    className:
      'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800',
    dotClass: 'bg-emerald-500'
  };
});

const contextHeadline = computed(() => {
  if (isPaused.value) {
    if (props.caseRecord?.status === 'Waiting for Customer') {
      return t('cases.recordSlaAlertWaitingCustomer');
    }
    return t('cases.recordSlaAlertPaused');
  }
  const ctx = props.caseRecord?.slaContext;
  if (ctx?.pauseReason) return ctx.pauseReason;
  return t('cases.recordSlaAlertOutsideHours');
});

const contextDetail = computed(() => {
  const ctx = props.caseRecord?.slaContext;
  if (!ctx) return '';
  const parts = [];
  if (ctx.scheduleName) {
    parts.push(t('cases.recordSlaAlertSchedule', { name: ctx.scheduleName }));
  } else if (ctx.summary) {
    parts.push(ctx.summary);
  }
  if (ctx.timezone) parts.push(ctx.timezone);
  return parts.join(' · ');
});

const contextToneClass = computed(() =>
  isPaused.value
    ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
    : 'border-indigo-200 bg-indigo-50/70 dark:border-indigo-800 dark:bg-indigo-950/30'
);

const contextHeadlineClass = computed(() =>
  isPaused.value
    ? 'text-amber-950 dark:text-amber-100'
    : 'text-indigo-950 dark:text-indigo-100'
);

const contextDetailClass = computed(() =>
  isPaused.value
    ? 'text-amber-800/90 dark:text-amber-200/80'
    : 'text-indigo-800/90 dark:text-indigo-200/80'
);

function formatDurationMinutes(minutes) {
  const abs = Math.max(0, Math.round(minutes || 0));
  if (abs < 60) return `${abs}m`;
  if (abs < 1440) return `${Math.round(abs / 60)}h`;
  return `${Math.round(abs / 1440)}d`;
}

function toneClasses(state) {
  if (state === 'met') {
    return {
      badgeClass:
        'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800',
      barClass: 'bg-emerald-500'
    };
  }
  if (state === 'breached') {
    return {
      badgeClass:
        'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800',
      barClass: 'bg-red-500'
    };
  }
  if (state === 'warning') {
    return {
      badgeClass:
        'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800',
      barClass: 'bg-amber-500'
    };
  }
  return {
    badgeClass:
      'bg-gray-50 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-600',
    barClass: 'bg-indigo-500'
  };
}

function resolveMetric(metricKey, targetAt, metAt) {
  const p = progress.value?.[metricKey];

  if (metAt || p?.state === 'met') {
    const relative = metAt ? formatRelativeTime(metAt, t) : '';
    return {
      state: 'met',
      stateLabel: t('cases.listResponseSlaMet'),
      summary: relative || t('cases.listResponseSlaMet')
    };
  }

  if (p?.state === 'breached') {
    const over = formatDurationMinutes((p.elapsedMinutes || 0) - (p.budgetMinutes || 0));
    return {
      state: 'breached',
      stateLabel: t('common.listStatOverdue'),
      summary: t('cases.listResponseSlaOverdue', { time: over })
    };
  }

  if (p?.state === 'warning') {
    const remaining = formatDurationMinutes((p.budgetMinutes || 0) - (p.elapsedMinutes || 0));
    return {
      state: 'warning',
      stateLabel: t('performance.statusAtRisk'),
      summary: t('cases.listResponseSlaDue', { time: remaining })
    };
  }

  if (!targetAt) return null;

  const at = new Date(targetAt);
  if (Number.isNaN(at.getTime())) return null;
  const now = Date.now();
  const diffMs = at.getTime() - now;
  const timePart = formatDurationMinutes(Math.abs(diffMs) / 60000);

  if (diffMs < 0) {
    return {
      state: 'breached',
      stateLabel: t('common.listStatOverdue'),
      summary: t('cases.listResponseSlaOverdue', { time: timePart })
    };
  }

  const startedAt = cycle.value?.startedAt ? new Date(cycle.value.startedAt) : null;
  if (startedAt && !Number.isNaN(startedAt.getTime())) {
    const totalMs = at.getTime() - startedAt.getTime();
    if (totalMs > 0) {
      const elapsedRatio = (now - startedAt.getTime()) / totalMs;
      if (elapsedRatio >= WARNING_THRESHOLD_PERCENT / 100) {
        return {
          state: 'warning',
          stateLabel: t('performance.statusAtRisk'),
          summary: t('cases.listResponseSlaDue', { time: timePart })
        };
      }
    }
  }

  return {
    state: 'ok',
    stateLabel: t('performance.statusOnTrack'),
    summary: t('cases.listResponseSlaDue', { time: timePart })
  };
}

function buildMetric(metricKey, labelKey, targetAt, metAt) {
  const resolved = resolveMetric(metricKey, targetAt, metAt);
  if (!resolved) return null;

  const p = progress.value?.[metricKey];
  let percent = null;
  if (resolved.state === 'met') {
    percent = 100;
  } else if (typeof p?.elapsedPercent === 'number') {
    percent = Math.max(0, Math.min(100, Math.round(p.elapsedPercent)));
  }

  return {
    key: metricKey,
    label: t(labelKey),
    state: resolved.state,
    stateLabel: resolved.stateLabel,
    summary: resolved.summary,
    percent,
    ...toneClasses(resolved.state)
  };
}

const metrics = computed(() => {
  if (!cycle.value) return [];
  return [
    buildMetric(
      'response',
      'cases.recordSlaResponse',
      cycle.value.responseTargetAt,
      cycle.value.responseMetAt
    ),
    buildMetric(
      'resolution',
      'cases.recordSlaResolution',
      cycle.value.resolutionTargetAt,
      cycle.value.resolutionMetAt
    )
  ].filter(Boolean);
});
</script>
