<template>
  <div class="inbox-get-started relative isolate grid h-full min-h-0 w-full flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,min(38%,480px))_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto] lg:items-center">
    <!-- Decorative grid — must stay behind content (3D transform creates its own stack) -->
    <div
      class="inbox-get-started-grid pointer-events-none absolute inset-x-[-20%] top-[-10%] -z-10 h-[140%] opacity-[0.55] dark:opacity-[0.2]"
      aria-hidden="true"
    />

    <!-- Left: value prop + CTAs — vertically centered to card row height -->
    <div class="relative z-[1] flex items-center px-6 py-12 sm:px-10 lg:row-start-1 lg:self-center lg:py-0 lg:pl-14 lg:pr-6 xl:pl-20">
      <div class="mx-auto w-full max-w-md text-center lg:mx-0 lg:max-w-[26rem] lg:text-left">
        <h1 class="text-balance text-[2.25rem] font-bold leading-[1.05] tracking-[-0.025em] text-[#111111] dark:text-white sm:text-[2.875rem] lg:text-[3.25rem] lg:leading-[1.02] lg:tracking-[-0.03em]">
          {{ t('inbox.inboxGetStartedGetStartedWithArivu') }}
        </h1>
        <p class="mx-auto mt-5 max-w-[24rem] text-[1.0625rem] font-normal leading-[1.65] text-[#6B6B6B] dark:text-gray-400 lg:mx-0 lg:mt-6 lg:text-[1.125rem] lg:leading-[1.7]">
          <template v-if="inboundParserMode">
            {{ t('inbox.inboxGetStartedInboundParserSubtitle') }}
          </template>
          <template v-else>
            {{ t('inbox.inboxGetStartedConnectYourWorkInboxToSend') }}
          </template>
        </p>

        <p class="mt-12 text-sm font-medium text-[#6B6B6B] dark:text-gray-400 lg:mt-14">
          {{ t('inbox.inboxGetStartedConnectWithLabel') }}
        </p>
        <div class="mt-3 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
          <button
            type="button"
            :class="ctaClass"
            :disabled="connectLoading"
            @click="emit('connect-mailbox')"
          >
            <img
              src="/assets/logo/Gmail_Logo.svg"
              alt=""
              class="h-5 w-auto shrink-0"
              aria-hidden="true"
            />
            <span v-if="connectLoading">{{ t('inbox.inboxGetStartedConnecting') }}</span>
            <span v-else>{{ t('inbox.inboxGetStartedProviderGmail') }}</span>
          </button>
          <button
            type="button"
            :class="ctaClass"
            :disabled="connectLoading"
            @click="emit('connect-mailbox')"
          >
            <img
              src="/assets/logo/Microsoft_Office_Outlook_Logo.svg"
              alt=""
              class="h-5 w-auto shrink-0"
              aria-hidden="true"
            />
            <span v-if="connectLoading">{{ t('inbox.inboxGetStartedConnecting') }}</span>
            <span v-else>{{ t('inbox.inboxGetStartedProviderOutlook') }}</span>
          </button>
          <button
            type="button"
            :class="ctaClass"
            @click="emit('setup-group')"
          >
            <UserGroupIcon class="h-5 w-5 shrink-0 text-[#787774] dark:text-gray-400" aria-hidden="true" />
            {{ t('inbox.inboxGetStartedSecondaryAction') }}
          </button>
        </div>

        <p
          v-if="!inboundParserMode && !gmailOAuthReady"
          class="mt-6 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3.5 py-2.5 text-left text-[11px] leading-relaxed text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100"
        >
          {{ t('inbox.inboxGetStartedGmailIsntEnabledOnThisServer') }}
          <code class="rounded bg-amber-100/80 px-1 font-mono text-[10px] dark:bg-amber-950/80">GOOGLE_GMAIL_*</code>
          {{ t('inbox.inboxGetStartedOrOpenSetupFromTheConnect') }}
        </p>
      </div>
    </div>

    <!-- Right cards — same row as left so heights share a vertical center -->
    <div
      class="relative z-[1] min-h-0 min-w-0 py-8 lg:row-start-1 lg:self-center lg:py-0"
      @mouseenter="pauseAutoplay"
      @mouseleave="resumeAutoplay"
      @focusin="pauseAutoplay"
      @focusout="resumeAutoplay"
    >
      <div
        ref="carouselViewportRef"
        class="relative w-full overflow-hidden pb-10 pt-2"
      >
        <div
          class="flex will-change-transform transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          :style="carouselTrackStyle"
        >
          <article
            v-for="slide in slides"
            :key="slide.id"
            class="inbox-carousel-card shrink-0 rounded-2xl border border-[#EBEBEB] bg-white p-5 shadow-[0_12px_32px_rgba(0,0,0,0.14)] dark:border-gray-700 dark:bg-gray-900 dark:shadow-[0_12px_32px_rgba(0,0,0,0.4)] sm:p-6"
            :style="{ width: `${CARD_WIDTH}px` }"
            :aria-hidden="false"
          >
            <div
              class="min-h-[240px] overflow-hidden rounded-xl border border-[#F1F1EF] bg-[#FAFAF8] dark:border-gray-800 dark:bg-[#202020]"
              aria-hidden="true"
            >
              <component :is="slide.visual" />
            </div>
            <h2 class="mt-6 text-[1.375rem] font-semibold leading-snug tracking-[-0.01em] text-[#111111] dark:text-white">
              {{ slide.title }}
            </h2>
            <p class="mt-2.5 text-[15px] leading-relaxed text-[#6B6B6B] dark:text-gray-400">
              {{ slide.description }}
            </p>
          </article>
        </div>

        <div
          class="pointer-events-none absolute inset-y-0 left-0 z-[1] w-10 bg-gradient-to-r from-white to-transparent dark:from-gray-950 sm:w-14"
          aria-hidden="true"
        />
        <div
          class="pointer-events-none absolute inset-y-0 right-0 z-[1] w-10 bg-gradient-to-l from-white to-transparent dark:from-gray-950 sm:w-14"
          aria-hidden="true"
        />
      </div>
    </div>

    <!-- Arrow controls sit below the card row (do not affect left vertical alignment) -->
    <div
      class="relative z-[1] flex items-center justify-center gap-3 pb-8 pt-2 lg:col-start-2 lg:row-start-2 lg:pb-10"
      @mouseenter="pauseAutoplay"
      @mouseleave="resumeAutoplay"
      @focusin="pauseAutoplay"
      @focusout="resumeAutoplay"
    >
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#6B6B6B] shadow-sm transition hover:border-[#D4D4D4] hover:text-[#111111] dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-white"
        :aria-label="t('inbox.inboxGetStartedCarouselPrev')"
        @click="onManualPrev"
      >
        <ChevronLeftIcon class="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#6B6B6B] shadow-sm transition hover:border-[#D4D4D4] hover:text-[#111111] dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-white"
        :aria-label="t('inbox.inboxGetStartedCarouselNext')"
        @click="onManualNext"
      >
        <ChevronRightIcon class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  defineComponent,
  h,
  markRaw,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
} from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  UserGroupIcon,
} from '@heroicons/vue/24/outline';

defineProps({
  gmailOAuthReady: { type: Boolean, default: true },
  inboundParserMode: { type: Boolean, default: false },
  connectLoading: { type: Boolean, default: false },
});

const { t } = useI18n();

const emit = defineEmits(['connect-mailbox', 'setup-group']);

const ctaClass =
  'inbox-get-started-cta relative z-[1] inline-flex items-center justify-center gap-2.5 rounded-xl border border-[#E8E8E8] !bg-white px-5 py-3 text-sm font-medium text-[#37352F] shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:!bg-gray-900 dark:text-gray-100';

const CARD_WIDTH = 380;
const CARD_GAP = 24;
/** Cards shown on first paint, packed to the right of the pane. */
const INITIAL_VISIBLE_CARDS = 2;

const AUTOPLAY_MS = 4000;
const MANUAL_RESUME_MS = 8000;

const activeSlide = ref(0);
const autoplayPaused = ref(false);
const carouselViewportRef = ref(null);
const paneWidth = ref(0);

let autoplayTimer = null;
let resumeTimer = null;
let resizeObserver = null;

const step = CARD_WIDTH + CARD_GAP;

/** Right-align the opening 2 cards within the full right pane. */
const baseOffset = computed(() => {
  const pairWidth =
    CARD_WIDTH * INITIAL_VISIBLE_CARDS + CARD_GAP * (INITIAL_VISIBLE_CARDS - 1);
  return Math.max(0, paneWidth.value - pairWidth);
});

const carouselTrackStyle = computed(() => ({
  gap: `${CARD_GAP}px`,
  transform: `translateX(${baseOffset.value - activeSlide.value * step}px)`,
}));

function measurePane() {
  const el = carouselViewportRef.value;
  if (!el) return;
  paneWidth.value = el.clientWidth;
}
const VisualAssign = markRaw(defineComponent({
  name: 'InboxGetStartedVisualAssign',
  render: () => h('div', { class: 'flex h-full min-h-[240px] flex-col justify-center space-y-2.5 p-5' }, [
    h('p', { class: 'text-[10px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500' }, 'support@company.com'),
    h('div', { class: 'flex items-center gap-2 rounded-lg border border-[#EBEBEB] bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900' }, [
      h('span', { class: 'h-2 w-2 rounded-full bg-[#2383E2]' }),
      h('span', { class: 'h-2.5 w-28 rounded bg-[#37352F]/15 dark:bg-gray-600' }),
      h('span', { class: 'ml-auto h-7 w-7 rounded-full bg-violet-100 text-[10px] font-bold leading-7 text-violet-700 dark:bg-violet-950 dark:text-violet-300' }, 'AK'),
    ]),
    h('div', { class: 'flex items-center gap-2 rounded-lg border border-[#EBEBEB] bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900' }, [
      h('span', { class: 'h-2 w-2 rounded-full bg-[#2383E2]' }),
      h('span', { class: 'h-2.5 w-24 rounded bg-[#EBEBEB] dark:bg-gray-700' }),
      h('span', { class: 'ml-auto rounded-full bg-[#2383E2]/10 px-2.5 py-1 text-[10px] font-medium text-[#2383E2]' }, 'Assign'),
    ]),
    h('div', { class: 'flex items-center gap-2 rounded-lg border border-[#EBEBEB] bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900' }, [
      h('span', { class: 'h-2 w-2 rounded-full bg-transparent ring-1 ring-[#EBEBEB]' }),
      h('span', { class: 'h-2.5 w-20 rounded bg-[#EBEBEB] dark:bg-gray-700' }),
      h('span', { class: 'ml-auto h-7 w-7 rounded-full bg-emerald-100 text-[10px] font-bold leading-7 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' }, 'DS'),
    ]),
  ]),
}));

const VisualMentions = markRaw(defineComponent({
  name: 'InboxGetStartedVisualMentions',
  render: () => h('div', { class: 'flex h-full min-h-[240px] flex-col justify-center space-y-3 p-5' }, [
    h('div', { class: 'rounded-lg border border-[#EBEBEB] bg-white p-3.5 dark:border-gray-700 dark:bg-gray-900' }, [
      h('p', { class: 'text-[10px] font-medium text-[#9B9A97] dark:text-gray-500' }, 'Thread comment'),
      h('p', { class: 'mt-1.5 text-[12px] leading-relaxed text-[#787774] dark:text-gray-400' }, [
        h('span', { class: 'rounded bg-violet-100 px-1 font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300' }, '@Priya'),
        ' can you confirm the renewal date?',
      ]),
    ]),
    h('div', { class: 'ml-8 rounded-lg border border-[#EBEBEB] bg-white p-3.5 dark:border-gray-700 dark:bg-gray-900' }, [
      h('p', { class: 'text-[12px] leading-relaxed text-[#787774] dark:text-gray-400' }, 'Yes — contract ends March 31.'),
    ]),
  ]),
}));

const VisualCanned = markRaw(defineComponent({
  name: 'InboxGetStartedVisualCanned',
  render: () => h('div', { class: 'flex h-full min-h-[240px] flex-col justify-center space-y-3.5 p-5' }, [
    h('div', { class: 'flex flex-wrap gap-2' }, [
      h('span', { class: 'rounded-full bg-[#2383E2]/10 px-3 py-1.5 text-[11px] font-medium text-[#2383E2]' }, 'Acknowledge receipt'),
      h('span', { class: 'rounded-full bg-[#EBEBEB] px-3 py-1.5 text-[11px] font-medium text-[#787774] dark:bg-gray-700 dark:text-gray-300' }, 'Request details'),
    ]),
    h('div', { class: 'rounded-lg border border-[#EBEBEB] bg-white p-3.5 dark:border-gray-700 dark:bg-gray-900' }, [
      h('p', { class: 'text-[12px] text-[#37352F] dark:text-gray-200' }, 'Thanks — we received your message and will reply shortly.'),
      h('div', { class: 'mt-3 h-8 rounded-md bg-[#2383E2] text-center text-[11px] font-medium leading-8 text-white' }, 'Send from Inbox'),
    ]),
  ]),
}));

const VisualRecords = markRaw(defineComponent({
  name: 'InboxGetStartedVisualRecords',
  render: () => h('div', { class: 'flex h-full min-h-[240px] flex-col justify-center space-y-3.5 p-5' }, [
    h('div', { class: 'rounded-lg border border-[#EBEBEB] bg-white p-3.5 dark:border-gray-700 dark:bg-gray-900' }, [
      h('div', { class: 'flex items-center gap-3' }, [
        h('span', { class: 'flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-[12px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' }, 'JD'),
        h('div', null, [
          h('p', { class: 'text-[13px] font-semibold text-[#37352F] dark:text-white' }, 'Jane Doe'),
          h('p', { class: 'text-[11px] text-[#787774] dark:text-gray-400' }, 'Contact · Open deal'),
        ]),
      ]),
    ]),
    h('div', { class: 'flex items-center justify-between gap-2' }, [
      h('div', { class: 'flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/30' }, [
        h('span', { class: 'h-1.5 w-1.5 rounded-full bg-emerald-500' }),
        h('span', { class: 'text-[11px] font-medium text-emerald-800 dark:text-emerald-200' }, 'Linked to CRM'),
      ]),
      h('span', { class: 'rounded-md bg-[#37352F]/8 px-2.5 py-1.5 text-[11px] font-medium text-[#37352F] dark:bg-white/10 dark:text-gray-200' }, 'Mark as done'),
    ]),
  ]),
}));

const slides = computed(() => [
  {
    id: 'assign',
    title: t('inbox.inboxGetStartedSlideAssignTitle'),
    description: t('inbox.inboxGetStartedSlideAssignDescription'),
    visual: VisualAssign,
  },
  {
    id: 'mentions',
    title: t('inbox.inboxGetStartedSlideMentionsTitle'),
    description: t('inbox.inboxGetStartedSlideMentionsDescription'),
    visual: VisualMentions,
  },
  {
    id: 'canned',
    title: t('inbox.inboxGetStartedSlideCannedTitle'),
    description: t('inbox.inboxGetStartedSlideCannedDescription'),
    visual: VisualCanned,
  },
  {
    id: 'records',
    title: t('inbox.inboxGetStartedSlideRecordsTitle'),
    description: t('inbox.inboxGetStartedSlideRecordsDescription'),
    visual: VisualRecords,
  },
]);

function goToSlide(index) {
  const total = slides.value.length;
  // Allow scrolling until the last card can enter from the right (3+ visible).
  const maxStart = Math.max(0, total - INITIAL_VISIBLE_CARDS);
  let next = index;
  if (next > maxStart) next = 0;
  if (next < 0) next = maxStart;
  activeSlide.value = next;
}

function nextSlide() {
  goToSlide(activeSlide.value + 1);
}

function prevSlide() {
  goToSlide(activeSlide.value - 1);
}

function stopAutoplay() {
  if (autoplayTimer) {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
  }
}

function startAutoplay() {
  stopAutoplay();
  if (autoplayPaused.value) return;
  autoplayTimer = setInterval(nextSlide, AUTOPLAY_MS);
}

function pauseAutoplay() {
  autoplayPaused.value = true;
  stopAutoplay();
  if (resumeTimer) {
    clearTimeout(resumeTimer);
    resumeTimer = null;
  }
}

function resumeAutoplay() {
  autoplayPaused.value = false;
  startAutoplay();
}

function scheduleAutoplayResume() {
  if (resumeTimer) clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => {
    resumeTimer = null;
    resumeAutoplay();
  }, MANUAL_RESUME_MS);
}

function onManualNext() {
  nextSlide();
  pauseAutoplay();
  scheduleAutoplayResume();
}

function onManualPrev() {
  prevSlide();
  pauseAutoplay();
  scheduleAutoplayResume();
}

onMounted(async () => {
  await nextTick();
  measurePane();
  if (typeof ResizeObserver !== 'undefined' && carouselViewportRef.value) {
    resizeObserver = new ResizeObserver(() => measurePane());
    resizeObserver.observe(carouselViewportRef.value);
  }
  activeSlide.value = 0;
  startAutoplay();
});

onUnmounted(() => {
  stopAutoplay();
  if (resumeTimer) clearTimeout(resumeTimer);
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});
</script>

<style scoped>
.inbox-get-started-cta {
  background-color: #ffffff;
  background-clip: padding-box;
  isolation: isolate;
}

:global(.dark) .inbox-get-started-cta,
.dark .inbox-get-started-cta {
  background-color: #111827;
}

.inbox-get-started-grid {
  background-image:
    linear-gradient(to right, rgba(120, 120, 120, 0.11) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(120, 120, 120, 0.11) 1px, transparent 1px);
  background-size: 64px 64px;
  transform: perspective(900px) rotateX(58deg) scale(1.55);
  transform-origin: center top;
  /* Fade out over the left CTA column so lines never sit on buttons */
  -webkit-mask-image:
    linear-gradient(to right, transparent 0%, transparent 32%, black 48%),
    linear-gradient(to bottom, black 0%, black 55%, transparent 92%);
  mask-image:
    linear-gradient(to right, transparent 0%, transparent 32%, black 48%),
    linear-gradient(to bottom, black 0%, black 55%, transparent 92%);
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
}
</style>
