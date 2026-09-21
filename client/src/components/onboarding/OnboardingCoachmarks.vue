<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useOnboarding } from '@/composables/useOnboarding';
import { useAnchoredPanelPosition } from '@/composables/useAnchoredPanelPosition';
import { useColorMode } from '@/composables/useColorMode';

const COACHMARK_TARGETS = {
  sidebar: '[data-onboarding-target="sidebar"]',
  command_palette: '[data-onboarding-target="command_palette"]',
  tabs: '[data-onboarding-target="tabs"]'
};

const COACHMARK_TITLE_KEYS = {
  sidebar: 'onboarding.coachmarkSidebarTitle',
  command_palette: 'onboarding.coachmarkCommandPaletteTitle',
  tabs: 'onboarding.coachmarkTabsTitle'
};

const COACHMARK_DESCRIPTION_KEYS = {
  sidebar: 'onboarding.coachmarkSidebarDescription',
  command_palette: 'onboarding.coachmarkCommandPaletteDescription',
  tabs: 'onboarding.coachmarkTabsDescription'
};

/** Prefer right-of-rail placement for sidebar-adjacent surfaces. */
const RIGHT_PLACEMENT_KEYS = new Set(['command_palette']);

const route = useRoute();
const { t } = useI18n();
const { effectiveDark } = useColorMode();
const { state, fetchOnboarding, markCoachmark } = useOnboarding();
const {
  panelStyle,
  placement,
  caretOffsetPx,
  isOpen,
  openAt,
  close,
  refresh
} = useAnchoredPanelPosition({ panelWidth: 280, panelHeight: 140 });

const activeKey = ref(null);
const panelRef = ref(null);
const dismissing = ref(false);

let advanceTimer = null;
let targetObserver = null;

const pendingCoachmarks = computed(() => state.value.pendingCoachmarks || []);
const shouldRun = computed(() => {
  if (!state.value.origin) return false;
  if (route.path === '/onboarding') return false;
  return pendingCoachmarks.value.length > 0;
});

const activeTitle = computed(() => {
  if (!activeKey.value) return '';
  const key = COACHMARK_TITLE_KEYS[activeKey.value];
  return key ? t(key) : '';
});

const activeDescription = computed(() => {
  if (!activeKey.value) return '';
  const key = COACHMARK_DESCRIPTION_KEYS[activeKey.value];
  return key ? t(key) : '';
});

const caretInlineStyle = computed(() => {
  if (placement.value === 'right') {
    return { top: `${caretOffsetPx.value}px` };
  }
  return { left: `${caretOffsetPx.value}px` };
});

const findTarget = (key) => document.querySelector(COACHMARK_TARGETS[key]);

/** Show first pending coachmark whose anchor is in the DOM. Missing anchors are deferred, not auto-dismissed. */
const showCoachmark = async (key) => {
  await nextTick();
  const target = findTarget(key);
  if (!target) return false;
  activeKey.value = key;
  openAt({ value: target }, panelRef, {
    preferredPlacement: RIGHT_PLACEMENT_KEYS.has(key) ? 'right' : 'bottom'
  });
  await nextTick();
  refresh();
  return true;
};

const advanceCoachmarks = async () => {
  if (!shouldRun.value) {
    activeKey.value = null;
    close();
    return;
  }
  if (activeKey.value || dismissing.value) return;

  for (const key of pendingCoachmarks.value) {
    const shown = await showCoachmark(key);
    if (shown) return;
  }
  activeKey.value = null;
  close();
};

const scheduleAdvance = () => {
  if (advanceTimer) clearTimeout(advanceTimer);
  advanceTimer = setTimeout(() => {
    advanceTimer = null;
    if (shouldRun.value && !activeKey.value && !dismissing.value) {
      void advanceCoachmarks();
    }
  }, 100);
};

const dismissActive = async () => {
  if (!activeKey.value || dismissing.value) return;
  dismissing.value = true;
  const key = activeKey.value;
  close();
  activeKey.value = null;
  await markCoachmark(key);
  dismissing.value = false;
  await advanceCoachmarks();
};

watch(
  () => [shouldRun.value, pendingCoachmarks.value.join(','), route.fullPath],
  () => scheduleAdvance()
);

onMounted(async () => {
  await fetchOnboarding();
  scheduleAdvance();

  if (typeof MutationObserver !== 'undefined') {
    targetObserver = new MutationObserver(() => scheduleAdvance());
    targetObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-onboarding-target']
    });
  }
});

onUnmounted(() => {
  if (advanceTimer) clearTimeout(advanceTimer);
  targetObserver?.disconnect();
  targetObserver = null;
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen && activeKey"
      class="fixed inset-0 z-[120]"
    >
      <button
        type="button"
        class="absolute inset-0 bg-gray-900/40"
        aria-label="Dismiss coachmark"
        @click="dismissActive"
      />
      <div
        ref="panelRef"
        class="onboarding-coachmark-panel fixed z-[121] overflow-visible"
        :class="{ 'onboarding-coachmark-panel--dark': effectiveDark }"
        :style="panelStyle"
        :data-placement="placement"
      >
        <span
          class="onboarding-coachmark-caret onboarding-coachmark-caret--border"
          :style="caretInlineStyle"
          aria-hidden="true"
        />
        <span
          class="onboarding-coachmark-caret onboarding-coachmark-caret--fill"
          :style="caretInlineStyle"
          aria-hidden="true"
        />
        <div class="relative z-[1] rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-800">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ activeTitle }}
          </p>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {{ activeDescription }}
          </p>
          <button
            type="button"
            class="mt-3 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            @click="dismissActive"
          >
            {{ t('onboarding.coachmarkDismiss') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.onboarding-coachmark-caret {
  position: absolute;
  pointer-events: none;
  z-index: 2;
}

/* Right placement: caret on left edge, pointing at sidebar */
.onboarding-coachmark-panel[data-placement='right'] .onboarding-coachmark-caret {
  left: 0;
  width: 12px;
  height: 16px;
  transform: translate(-100%, 0);
  overflow: hidden;
}

.onboarding-coachmark-panel[data-placement='right'] .onboarding-coachmark-caret--border::before,
.onboarding-coachmark-panel[data-placement='right'] .onboarding-coachmark-caret--fill::before {
  content: '';
  position: absolute;
  right: -6px;
  top: 50%;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  transform: translateY(-50%) rotate(45deg);
  box-sizing: border-box;
}

.onboarding-coachmark-panel[data-placement='right'] .onboarding-coachmark-caret--border::before {
  background: rgb(229 231 235); /* gray-200 */
}

.onboarding-coachmark-panel[data-placement='right'] .onboarding-coachmark-caret--fill::before {
  right: -5px;
  width: 10px;
  height: 10px;
  background: #ffffff;
}

.onboarding-coachmark-panel--dark[data-placement='right'] .onboarding-coachmark-caret--border::before {
  background: rgb(55 65 81); /* gray-700 */
}

.onboarding-coachmark-panel--dark[data-placement='right'] .onboarding-coachmark-caret--fill::before {
  background: rgb(31 41 55); /* gray-800 — match panel */
}

/* Bottom placement: caret on top edge */
.onboarding-coachmark-panel[data-placement='bottom'] .onboarding-coachmark-caret {
  top: 0;
  width: 0;
  height: 0;
  transform: translateY(-100%);
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
}

.onboarding-coachmark-panel[data-placement='bottom'] .onboarding-coachmark-caret--border {
  border-bottom: 8px solid rgb(229 231 235);
}

.onboarding-coachmark-panel[data-placement='bottom'] .onboarding-coachmark-caret--fill {
  margin-top: 1px;
  border-bottom: 8px solid #ffffff;
}

.onboarding-coachmark-panel--dark[data-placement='bottom'] .onboarding-coachmark-caret--border {
  border-bottom-color: rgb(55 65 81);
}

.onboarding-coachmark-panel--dark[data-placement='bottom'] .onboarding-coachmark-caret--fill {
  border-bottom-color: rgb(31 41 55);
}

/* Top placement (flipped): caret on bottom edge */
.onboarding-coachmark-panel[data-placement='top'] .onboarding-coachmark-caret {
  bottom: 0;
  width: 0;
  height: 0;
  transform: translateY(100%);
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
}

.onboarding-coachmark-panel[data-placement='top'] .onboarding-coachmark-caret--border {
  border-top: 8px solid rgb(229 231 235);
}

.onboarding-coachmark-panel[data-placement='top'] .onboarding-coachmark-caret--fill {
  margin-bottom: 1px;
  border-top: 8px solid #ffffff;
}

.onboarding-coachmark-panel--dark[data-placement='top'] .onboarding-coachmark-caret--border {
  border-top-color: rgb(55 65 81);
}

.onboarding-coachmark-panel--dark[data-placement='top'] .onboarding-coachmark-caret--fill {
  border-top-color: rgb(31 41 55);
}
</style>
