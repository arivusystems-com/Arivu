<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-if="visible && preview"
        ref="cardRef"
        role="tooltip"
        :id="tooltipId"
        class="tab-hover-preview fixed z-[120] pointer-events-none max-w-[320px] min-w-[180px]"
        :style="cardStyle"
      >
        <div class="tab-hover-preview__shell relative">
          <span
            class="tab-hover-preview__caret tab-hover-preview__caret--border border-b-gray-200/90 dark:border-b-gray-600/80"
            :style="caretStyle"
            aria-hidden="true"
          />
          <span
            class="tab-hover-preview__caret tab-hover-preview__caret--fill border-b-white/95 dark:border-b-gray-900/95"
            :style="caretStyle"
            aria-hidden="true"
          />
          <div
            class="tab-hover-preview__card relative z-[1] rounded-xl border border-gray-200/90 bg-white/95 px-3.5 py-3 backdrop-blur-sm dark:border-gray-600/80 dark:bg-gray-900/95"
          >
            <div class="flex items-start gap-2.5">
              <span
                v-if="tab?.icon"
                class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center"
              >
                <component
                  :is="tab.icon"
                  class="h-5 w-5"
                  :class="iconClass"
                  aria-hidden="true"
                />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold leading-snug text-gray-900 dark:text-white break-words">
                  {{ preview.primary }}
                </p>
                <p
                  v-if="preview.secondary"
                  class="mt-0.5 text-xs leading-snug text-gray-500 dark:text-gray-400 break-words"
                >
                  {{ preview.secondary }}
                </p>
                <p
                  v-if="preview.tertiary"
                  class="mt-1 text-xs leading-snug text-gray-600 dark:text-gray-300 break-words"
                >
                  {{ preview.tertiary }}
                </p>
              </div>
            </div>

            <ul
              v-if="preview.alertLines.length"
              class="mt-2.5 space-y-1 border-t border-gray-100 pt-2 dark:border-gray-700/80"
            >
              <li
                v-for="(alert, index) in preview.alertLines"
                :key="`${alert.kind}-${index}`"
                class="flex items-center gap-1.5 text-xs font-medium"
                :class="alertLineClass(alert.kind)"
              >
                <span
                  class="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  :class="alertDotClass(alert.kind)"
                  aria-hidden="true"
                />
                {{ alert.label }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { getTabPreviewContext } from '@/utils/tabPreviewContext';

const props = defineProps({
  tab: {
    type: Object,
    default: null,
  },
  anchorEl: {
    type: Object,
    default: null,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  showDelay: {
    type: Number,
    default: 400,
  },
  hideDelay: {
    type: Number,
    default: 80,
  },
  gap: {
    type: Number,
    default: 8,
  },
});

const { t, te } = useI18n();

const cardRef = ref(null);
const visible = ref(false);
const cardWidth = ref(240);
const tooltipId = `tab-preview-${Math.random().toString(36).slice(2, 9)}`;

let showTimer = null;
let hideTimer = null;

const preview = computed(() => {
  if (!props.tab) return null;
  return getTabPreviewContext(props.tab, t, te);
});

const iconClass = computed(() => {
  const tab = props.tab;
  if (!tab?.alertSegments?.length) {
    return 'text-gray-500 dark:text-gray-400';
  }
  const kind = tab.alertKind || tab.alertSegments[tab.alertSegments.length - 1]?.kind;
  if (kind === 'chat' || kind === 'session' || kind === 'internal' || kind === 'mention') {
    return 'text-emerald-600 dark:text-emerald-400';
  }
  if (kind === 'case') return 'text-blue-600 dark:text-blue-400';
  return 'text-amber-600 dark:text-amber-400';
});

function alertLineClass(kind) {
  if (kind === 'chat' || kind === 'session' || kind === 'internal' || kind === 'mention') {
    return 'text-emerald-700 dark:text-emerald-300';
  }
  if (kind === 'case') return 'text-blue-700 dark:text-blue-300';
  return 'text-amber-700 dark:text-amber-300';
}

function alertDotClass(kind) {
  if (kind === 'chat' || kind === 'session' || kind === 'internal' || kind === 'mention') {
    return 'bg-emerald-500';
  }
  if (kind === 'case') return 'bg-blue-500';
  return 'bg-amber-500';
}

const cardPlacement = computed(() => {
  const anchor = props.anchorEl;
  if (!anchor || !visible.value) {
    return {
      style: { top: '-9999px', left: '-9999px' },
      caretOffset: 0
    };
  }

  const rect = anchor.getBoundingClientRect();
  const gap = props.gap;
  const halfWidth = cardWidth.value / 2;
  const centerX = rect.left + rect.width / 2;
  const minLeft = halfWidth + 12;
  const maxLeft = window.innerWidth - halfWidth - 12;
  const left = Math.max(minLeft, Math.min(centerX, maxLeft));
  const top = rect.bottom + gap;

  // Keep the caret pointing at the tab even when the card is viewport-clamped.
  const rawOffset = centerX - left;
  const maxOffset = Math.max(0, halfWidth - 18);
  return {
    style: {
      top: `${top}px`,
      left: `${left}px`,
      transform: 'translateX(-50%)'
    },
    caretOffset: Math.max(-maxOffset, Math.min(rawOffset, maxOffset))
  };
});

const cardStyle = computed(() => cardPlacement.value.style);

const caretStyle = computed(() => ({
  left: `calc(50% + ${cardPlacement.value.caretOffset}px)`,
}));

const measureCard = async () => {
  await nextTick();
  const el = cardRef.value;
  if (!(el instanceof HTMLElement)) return;
  const rect = el.getBoundingClientRect();
  if (rect.width > 0) cardWidth.value = rect.width;
};

const clearTimers = () => {
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
};

const scheduleShow = () => {
  clearTimers();
  if (!props.enabled || !props.tab || !props.anchorEl) return;
  showTimer = setTimeout(() => {
    showTimer = null;
    visible.value = true;
    measureCard();
  }, props.showDelay);
};

const scheduleHide = () => {
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  hideTimer = setTimeout(() => {
    visible.value = false;
    hideTimer = null;
  }, props.hideDelay);
};

watch(
  () => [props.tab?.id, props.anchorEl, props.enabled],
  ([tabId, anchor, enabled]) => {
    if (tabId && anchor && enabled) {
      scheduleShow();
      return;
    }
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    scheduleHide();
  }
);

watch(visible, (isVisible) => {
  if (isVisible) measureCard();
});

const handleScrollOrResize = () => {
  if (visible.value) measureCard();
};

onMounted(() => {
  window.addEventListener('resize', handleScrollOrResize, { passive: true });
  window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
});

onUnmounted(() => {
  clearTimers();
  visible.value = false;
  window.removeEventListener('resize', handleScrollOrResize);
  window.removeEventListener('scroll', handleScrollOrResize, true);
});

defineExpose({ tooltipId, visible });
</script>

<style scoped>
.tab-hover-preview__shell {
  filter: drop-shadow(0 8px 20px rgb(15 23 42 / 0.12));
}

:global(.dark) .tab-hover-preview__shell {
  filter: drop-shadow(0 10px 24px rgb(0 0 0 / 0.45));
}

.tab-hover-preview__caret {
  position: absolute;
  z-index: 2;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-style: solid;
  border-left-color: transparent;
  border-right-color: transparent;
  border-top-color: transparent;
  pointer-events: none;
}

.tab-hover-preview__caret--border {
  top: -9px;
  border-left-width: 9px;
  border-right-width: 9px;
  border-bottom-width: 9px;
}

.tab-hover-preview__caret--fill {
  top: -7px;
  border-left-width: 8px;
  border-right-width: 8px;
  border-bottom-width: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .tab-hover-preview {
    transition: none !important;
  }
}
</style>
