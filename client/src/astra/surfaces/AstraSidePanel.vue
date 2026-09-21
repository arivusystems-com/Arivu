<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <button
        v-if="panelOpen && isSheetLayout"
        type="button"
        class="fixed inset-0 z-[9005] bg-black/40 dark:bg-black/55"
        :aria-label="t('actions.close')"
        @click="closePanel"
      />
    </Transition>

    <Transition
      :enter-active-class="panelMotion?.enterActive"
      :enter-from-class="panelMotion?.enterFrom"
      :enter-to-class="panelMotion?.enterTo"
      :leave-active-class="panelMotion?.leaveActive"
      :leave-from-class="panelMotion?.leaveFrom"
      :leave-to-class="panelMotion?.leaveTo"
    >
      <div
        v-if="panelOpen"
        class="fixed z-[9010]"
        :class="isSheetLayout
          ? 'inset-x-0 bottom-0 top-auto flex h-[min(85dvh,780px)] max-h-[92dvh] flex-col'
          : (isResizing ? '' : 'transition-[width] duration-200 ease-out')"
        :style="isSheetLayout ? undefined : assistantRailStyle"
      >
        <div
          v-if="!isSheetLayout"
          class="absolute inset-y-0 left-0 z-20 flex cursor-col-resize touch-none items-center justify-center hover:bg-primary-500/10"
          :style="resizeGapStyle"
          role="separator"
          aria-orientation="vertical"
          :aria-label="t('liveChat.inAppResize')"
          :aria-valuenow="panelWidthPx"
          tabindex="0"
          @pointerdown.prevent="onResizePointerDown"
          @keydown.left.prevent="nudgePanelWidth(-16)"
          @keydown.right.prevent="nudgePanelWidth(16)"
        >
          <span
            class="pointer-events-none h-10 w-1 rounded-full"
            :class="isResizing ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'"
            aria-hidden="true"
          />
        </div>

        <div
          class="astra-side-panel relative flex h-full min-h-0 w-full flex-col overflow-hidden"
          :class="isSheetLayout
            ? 'rounded-t-2xl border border-b-0 border-neutral-200 bg-white shadow-[0_-8px_32px_-8px_rgba(15,23,42,0.18)] dark:border-neutral-700 dark:bg-neutral-900'
            : WORK_PANEL_SURFACE_CLASS"
          role="dialog"
          :aria-modal="isSheetLayout ? 'true' : undefined"
          :aria-label="t('astra.brandName')"
        >
          <div
            class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(79,70,229,0.07),_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(129,140,248,0.12),_transparent_55%)]"
            aria-hidden="true"
          />

          <div
            v-if="isSheetLayout"
            class="relative z-[1] flex shrink-0 justify-center pb-1 pt-2"
            aria-hidden="true"
          >
            <span class="h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-600" />
          </div>

          <header class="relative z-30 flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200/70 bg-white/95 px-3.5 py-2.5 backdrop-blur dark:border-white/[0.08] dark:bg-neutral-900/95">
            <div class="relative min-w-0 flex-1">
              <button
                type="button"
                class="inline-flex max-w-full items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                :aria-expanded="historyMenuOpen"
                @click="historyMenuOpen = !historyMenuOpen"
              >
                <span class="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-neutral-200/70 dark:bg-neutral-950 dark:ring-white/10">
                  <AstraLogo size="sm" />
                </span>
                <span class="truncate text-sm font-semibold text-neutral-900 dark:text-white">{{ headerTitle }}</span>
                <ChevronDownIcon class="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
              </button>
              <div
                v-if="historyMenuOpen"
                class="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
              >
                <div v-if="conversations.length" class="max-h-56 overflow-y-auto py-1">
                  <button
                    v-for="item in conversations.slice(0, 8)"
                    :key="item.id"
                    type="button"
                    class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    @click="void onOpenConversation(item.id)"
                  >
                    <span class="min-w-0 flex-1 truncate text-xs text-neutral-700 dark:text-neutral-200">
                      {{ item.title || t('astra.historyUntitled') }}
                    </span>
                  </button>
                </div>
                <p v-else class="px-3 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                  {{ t('astra.historyEmpty') }}
                </p>
                <button
                  type="button"
                  class="flex w-full items-center gap-2 border-t border-neutral-100 px-3 py-2.5 text-left text-xs font-medium text-primary-800 hover:bg-primary-50 dark:border-neutral-800 dark:text-primary-200 dark:hover:bg-primary-500/10"
                  @click="onOpenFullCopilot"
                >
                  {{ t('astra.openCopilot') }}
                </button>
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-1">
              <button
                v-if="messages.length || conversationId"
                type="button"
                class="rounded-lg px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                @click="onNewChat"
              >
                {{ t('astra.newChat') }}
              </button>
              <button
                type="button"
                class="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                :aria-label="t('actions.close')"
                @click="closePanel"
              >
                <XMarkIcon class="h-4 w-4" />
              </button>
            </div>
          </header>

          <div
            v-if="pageContext"
            class="relative z-[1] flex shrink-0 items-center gap-2 border-b border-neutral-100 px-3.5 py-2 dark:border-white/[0.06]"
          >
            <span class="shrink-0 text-[11px] text-neutral-500 dark:text-neutral-400">
              {{ t('liveChat.inAppYouAreIn') }}
            </span>
            <span
              class="min-w-0 truncate rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-800 dark:bg-primary-950/50 dark:text-primary-200"
              :title="contextPillLabel"
            >
              {{ contextPillLabel }}
            </span>
          </div>

          <div ref="messagesEl" class="arivu-scrollbar relative z-[1] min-h-0 flex-1 overflow-y-auto px-3.5 py-4">
            <div
              v-if="!messages.length && !asking"
              class="flex h-full min-h-[18rem] flex-col justify-center px-0.5 py-4"
            >
              <div class="mx-auto flex w-full max-w-md flex-col items-center text-center">
                <div class="astra-hero-logo mb-2 flex items-center justify-center">
                  <AstraLogo size="panel" />
                </div>
                <h2 class="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
                  {{ emptyHeading }}
                </h2>
                <p class="mt-1 max-w-[18rem] text-sm text-neutral-500 dark:text-neutral-400">
                  {{ emptySubtitle }}
                </p>

                <div class="mt-6 w-full text-left">
                  <div class="mb-2.5 flex items-center justify-between gap-2 px-0.5">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                      {{ t('astra.nbaHeading') }}
                    </p>
                    <p
                      v-if="pageContext?.kind === 'record'"
                      class="truncate text-[10px] text-neutral-400"
                    >
                      {{ t('astra.heroPersonalizedSubtitle') }}
                    </p>
                  </div>

                  <div v-if="recommendationsLoading" class="space-y-2">
                    <div
                      v-for="n in 3"
                      :key="`sk-${n}`"
                      class="h-[3.5rem] animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800/60"
                    />
                  </div>

                  <div v-else class="flex flex-col gap-2.5">
                    <button
                      v-for="item in recommendationCards"
                      :key="item.id"
                      type="button"
                      class="rounded-2xl border border-neutral-200/70 bg-white px-3.5 py-3 text-left shadow-sm transition hover:border-primary-300 dark:border-white/10 dark:bg-neutral-950 dark:hover:border-primary-500/40"
                      @click="onSuggestion(item.prompt || item.label)"
                    >
                      <span class="flex items-start gap-3">
                        <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300">
                          <component :is="item.icon" class="h-4 w-4" />
                        </span>
                        <span class="min-w-0">
                          <span class="block text-sm font-medium text-neutral-900 dark:text-white">
                            {{ item.label }}
                          </span>
                          <span
                            v-if="item.rationale"
                            class="mt-0.5 block text-xs leading-snug text-neutral-500 dark:text-neutral-400"
                          >
                            {{ item.rationale }}
                          </span>
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="space-y-4 pb-2">
              <div
                v-for="msg in messages"
                :key="msg.id"
                class="flex gap-2.5"
                :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
              >
                <div
                  v-if="msg.role === 'assistant'"
                  class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-neutral-200/70 dark:bg-neutral-950 dark:ring-white/10"
                >
                  <AstraLogo size="sm" />
                </div>
                <div
                  v-if="msg.role === 'user'"
                  class="max-w-[88%] rounded-2xl rounded-br-md bg-sky-50 px-3.5 py-2.5 text-sm text-sky-950 dark:bg-sky-950/40 dark:text-sky-100"
                >
                  <p class="whitespace-pre-wrap break-words">{{ msg.body }}</p>
                </div>
                <div v-else class="min-w-0 max-w-[min(100%,28rem)] flex-1 space-y-2">
                  <p
                    v-if="msg.agentName"
                    class="text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500"
                  >
                    {{ t('astra.responseFromAgent', { name: msg.agentName }) }}
                  </p>
                  <AstraAnswerBody v-if="msg.body" :body="msg.body" />
                  <div v-if="msg.body && ttsSupported" class="flex items-center gap-1">
                    <button
                      type="button"
                      class="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                      :aria-label="speakingMessageId === msg.id && speaking ? t('astra.stopSpeaking') : t('astra.speakAnswer')"
                      :aria-pressed="speakingMessageId === msg.id && speaking"
                      @click="onSpeakAnswer(msg)"
                    >
                      <StopCircleIcon
                        v-if="speakingMessageId === msg.id && speaking"
                        class="h-4 w-4"
                      />
                      <SpeakerWaveIcon v-else class="h-4 w-4" />
                    </button>
                  </div>
                  <div v-if="msg.href" class="flex flex-wrap gap-2">
                    <button
                      type="button"
                      class="rounded-full bg-primary-500 px-3 py-1 text-xs font-medium text-white hover:bg-primary-600 dark:bg-primary-500 dark:hover:bg-primary-600"
                      @click="onNavigate(msg.href)"
                    >
                      {{ msg.navigateLabel || t('astra.viewRecord') }}
                    </button>
                  </div>
                  <AstraMessageBlocks
                    v-if="msg.blocks?.length"
                    :blocks="msg.blocks"
                    @action="onSuggestion"
                  />
                  <div
                    v-if="msg.proposals?.length"
                    class="space-y-2 rounded-xl border border-neutral-200 bg-white p-2.5 dark:border-white/10 dark:bg-neutral-950"
                  >
                    <p class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                      {{ t('astra.proposalsHeading') }}
                    </p>
                    <div
                      v-for="proposal in msg.proposals"
                      :key="proposal.id"
                      class="rounded-lg border border-neutral-100 px-2.5 py-2 dark:border-white/10"
                    >
                      <p class="text-sm font-medium text-neutral-900 dark:text-white">{{ proposal.label }}</p>
                      <p
                        v-if="proposal.rationale"
                        class="mt-0.5 whitespace-pre-line text-xs text-neutral-500"
                      >
                        {{ proposal.rationale }}
                      </p>
                      <div class="mt-2 flex flex-wrap gap-2">
                        <template v-if="proposal.status === 'completed'">
                          <button
                            v-if="proposal.href"
                            type="button"
                            class="rounded-full bg-primary-500 px-3 py-1 text-xs font-medium text-white hover:bg-primary-600 dark:bg-primary-500 dark:hover:bg-primary-600"
                            @click="onNavigate(proposal.href)"
                          >
                            {{ proposal.navigateLabel || t('astra.viewRecord') }}
                          </button>
                          <span class="self-center text-xs text-emerald-600 dark:text-emerald-400">
                            {{ t('astra.actionCompleted') }}
                          </span>
                        </template>
                        <template v-else>
                          <button
                            type="button"
                            class="rounded-full bg-primary-500 px-3 py-1 text-xs font-medium text-white hover:bg-primary-600 disabled:opacity-40 dark:bg-primary-500 dark:hover:bg-primary-600"
                            :disabled="confirming"
                            @click="onConfirmProposal(msg.id, proposal)"
                          >
                            {{ isEmailSendProposal(proposal) ? t('astra.reviewAndSend') : t('astra.confirmAction') }}
                          </button>
                          <button
                            type="button"
                            class="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 dark:border-white/10 dark:text-neutral-300"
                            @click="onDismissProposal(msg.id, proposal.id)"
                          >
                            {{ t('astra.dismissAction') }}
                          </button>
                        </template>
                      </div>
                    </div>
                  </div>
                  <AstraFollowUps
                    v-if="msg.suggestions?.length"
                    :suggestions="msg.suggestions"
                    :key-prefix="msg.id"
                    @select="onSuggestion"
                  />
                </div>
              </div>

              <div v-if="asking" class="flex items-center gap-2.5 text-sm text-neutral-500">
                <span class="flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-neutral-200/70 dark:bg-neutral-950 dark:ring-white/10">
                  <AstraLogo size="sm" />
                </span>
                <div class="astra-status-stage min-h-[1.25rem] min-w-0 flex-1 overflow-hidden">
                  <Transition name="astra-status" mode="out-in">
                    <p
                      :key="statusLine"
                      class="truncate text-sm text-neutral-500 dark:text-neutral-400"
                    >
                      {{ statusLine }}
                    </p>
                  </Transition>
                </div>
              </div>

              <p
                v-if="error"
                class="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-200"
              >
                {{ error }}
              </p>
            </div>
          </div>

          <div class="relative z-[1] shrink-0 border-t border-neutral-200/70 bg-white/90 px-3.5 py-3 backdrop-blur dark:border-white/[0.08] dark:bg-neutral-900/90">
            <form
              class="flex flex-col gap-1.5 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-sm dark:border-white/10 dark:bg-neutral-950"
              :class="isListening ? 'ring-2 ring-rose-400/70 dark:ring-rose-400/50' : ''"
              @submit.prevent="onSend"
            >
              <div class="flex items-end gap-2">
                <textarea
                  ref="inputEl"
                  v-model="draft"
                  rows="1"
                  class="max-h-32 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100"
                  :placeholder="composerPlaceholder"
                  :disabled="asking || isListening"
                  :aria-busy="isListening"
                  @keydown.enter.exact.prevent="onSend"
                  @input="autoGrow"
                />
                <button
                  type="button"
                  class="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:opacity-35"
                  :class="isListening
                    ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/30 animate-pulse'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'"
                  :disabled="asking"
                  :aria-label="isListening ? t('astra.voiceStop') : t('astra.voiceStart')"
                  :aria-pressed="isListening"
                  @click="onMicClick"
                >
                  <MicrophoneIcon class="h-4 w-4" />
                </button>
                <button
                  type="submit"
                  class="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-35 dark:bg-primary-500 dark:hover:bg-primary-600 dark:text-white"
                  :disabled="asking || isListening || !draft.trim()"
                  :aria-label="t('astra.send')"
                >
                  <PaperAirplaneIcon class="h-4 w-4 -rotate-45 translate-x-px" />
                </button>
              </div>
              <p
                v-if="isListening"
                class="px-2 pb-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400"
                aria-live="polite"
              >
                {{ t('astra.voiceListening') }}
              </p>
            </form>
            <p class="mt-2 text-center text-[10px] text-neutral-400">{{ t('astra.composerFootnote') }}</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Full-page Astra cinematic intro (first open only) -->
  <Teleport to="body">
    <Transition leave-active-class="astra-intro-leave">
      <div
        v-if="showAstraIntro"
        class="astra-intro fixed inset-0 z-[9200] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        :aria-label="t('liveChat.inAppAiMeetTitle')"
      >
        <div
          class="astra-intro__bg"
          aria-hidden="true"
          @animationend="onAstraBgRevealEnd"
        >
          <div class="astra-intro__mesh" />
          <div class="astra-intro__glow" />
          <div class="astra-intro__vignette" />
        </div>
        <button
          type="button"
          class="astra-intro__close absolute right-5 top-5 z-10 rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white sm:right-8 sm:top-8"
          :aria-label="t('actions.close')"
          @click="dismissAstraIntro(false)"
        >
          <XMarkIcon class="h-5 w-5" aria-hidden="true" />
        </button>
        <div class="astra-intro__content relative z-[1] flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center sm:px-10">
          <img
            src="/assets/logo/Ai%20Logo.svg"
            alt=""
            class="astra-intro__logo h-28 w-28 object-contain sm:h-36 sm:w-36"
            aria-hidden="true"
          />
          <h2 class="arivu-hero-title astra-intro__title mt-0 text-[42px] font-semibold tracking-tight sm:text-[56px]">
            {{ t('liveChat.inAppAiMeetTitle') }}
          </h2>
          <p class="astra-intro__tagline mt-1 max-w-lg text-[18px] font-normal leading-snug text-white/85 sm:text-[22px]">
            {{ t('liveChat.inAppAiBrandTagline') }}
          </p>
          <div class="mt-8 flex flex-wrap items-center justify-center gap-2">
            <span
              v-for="cap in astraIntroCapabilities"
              :key="cap"
              class="astra-intro__chip"
            >
              {{ cap }}
            </span>
          </div>
          <button
            type="button"
            class="astra-intro__cta mt-10"
            @click="dismissAstraIntro(true)"
          >
            {{ t('liveChat.inAppAiIntroCta') }}
          </button>
          <button
            type="button"
            class="astra-intro__skip mt-4 text-[13px] font-medium text-white/45 hover:text-white/75"
            @click="dismissAstraIntro(false)"
          >
            {{ t('liveChat.inAppAiIntroSkip') }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import {
  ChevronDownIcon,
  MicrophoneIcon,
  PaperAirplaneIcon,
  SpeakerWaveIcon,
  StopCircleIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import { useAstraAsk, type AstraNbaItem, type AstraProposal, type AstraSuggestion } from '@/astra/composables/useAstraAsk';
import { useAstraStatusLine } from '@/astra/composables/useAstraStatusLine';
import { useAstraConversations } from '@/astra/composables/useAstraConversations';
import { useAstraVoice } from '@/astra/composables/useAstraVoice';
import AstraMessageBlocks from '@/astra/blocks/AstraMessageBlocks.vue';
import AstraAnswerBody from '@/astra/components/AstraAnswerBody.vue';
import AstraFollowUps from '@/astra/components/AstraFollowUps.vue';
import AstraLogo from '@/astra/components/AstraLogo.vue';
import type { AstraUiBlock } from '@/astra/blocks/types';
import { resolveAstraNbaIcon } from '@/astra/utils/resolveAstraNbaIcon';
import { isEmailSendProposal, openEmailComposeFromAstra } from '@/astra/utils/openEmailCompose';
import { resolvePageAiContext } from '@/utils/resolvePageAiContext';
import { legacyStorageKey } from '@/utils/legacyBrandSlug';
import {
  getPersistedRecordTabName,
  isGenericRecordTabTitleKey,
} from '@/utils/navigationLabels';
import {
  SIDEBAR_SHELL_PADDING_REM,
  WORK_PANEL_SURFACE_CLASS,
} from '@/utils/sidebarLayout';
import {
  captureAstraActionRejected,
  captureAstraTtsPlayed,
  captureAstraVoiceCancelled,
  captureAstraVoiceCommitted,
  captureAstraVoiceStarted,
} from '@/config/posthogAi';
import { playAstraIntroResolveSound, playAstraIntroSound } from '@/utils/astraIntroSound';

interface PanelMessage {
  id: string;
  role: 'user' | 'assistant';
  body: string;
  blocks?: AstraUiBlock[];
  proposals?: AstraProposal[];
  suggestions?: AstraSuggestion[];
  agentKey?: string;
  agentName?: string;
  href?: string;
  navigateLabel?: string;
}

const PANEL_UI_STORAGE_KEY = 'arivu_astra_side_panel_open_v1';
const LEGACY_PANEL_UI_STORAGE_KEYS = [legacyStorageKey('astra_side_panel_open_v1')];
const PANEL_WIDTH_STORAGE_KEY = 'arivu_assistant_panel_width_v1';
const LEGACY_PANEL_WIDTH_STORAGE_KEYS = [
  legacyStorageKey('arivu_assistant_panel_width_v1'),
  'arivu_arivu_assistant_panel_width_v1',
];
const LEGACY_SUPPORT_PANEL_UI_KEY = legacyStorageKey('arivu_support_panel_ui_v1');
const PANEL_WIDTH_MIN = 320;
const PANEL_WIDTH_DEFAULT_RATIO = 0.3;
const PANEL_WIDTH_MAX_RATIO = 0.3;
const ASSISTANT_SHEET_MQ = '(max-width: 1023px)';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { activeTab, tabs } = useTabs();
const { asking, confirming, error, askSync, confirmProposal, fetchNba } = useAstraAsk('side_panel');
const { statusLine } = useAstraStatusLine(asking);
const {
  isListening,
  ttsSupported,
  speaking,
  speakingMessageId,
  toggleListening,
  speakAnswer,
  stopSpeaking,
} = useAstraVoice();
const voiceDraftBaseline = ref('');
const {
  conversations,
  refresh: refreshHistory,
  loadOne,
  upsertLocal,
} = useAstraConversations();

const panelOpen = ref(false);
const showAstraIntro = ref(false);
const draft = ref('');
const messages = ref<PanelMessage[]>([]);
const conversationId = ref<string | undefined>(undefined);
const conversationTitle = ref('');
const historyMenuOpen = ref(false);
const recommendations = ref<AstraNbaItem[]>([]);
const recommendationsLoading = ref(false);

const astraIntroCapabilities = computed(() => [
  t('liveChat.inAppAiCapabilityAsk'),
  t('liveChat.inAppAiCapabilitySummarize'),
  t('liveChat.inAppAiCapabilityResearch'),
  t('liveChat.inAppAiCapabilityNextAction'),
]);

function astraIntroStorageKey() {
  const userId = authStore.user?._id ? String(authStore.user._id) : '';
  const orgId = authStore.organization?._id
    ? String(authStore.organization._id)
    : (authStore.user?.organizationId ? String(authStore.user.organizationId) : '');
  if (!userId || !orgId) return null;
  return `arivu_astra_intro_seen_v1:${orgId}:${userId}`;
}

function legacyAstraIntroStorageKey() {
  const userId = authStore.user?._id ? String(authStore.user._id) : '';
  const orgId = authStore.organization?._id
    ? String(authStore.organization._id)
    : (authStore.user?.organizationId ? String(authStore.user.organizationId) : '');
  if (!userId || !orgId) return null;
  return legacyStorageKey(`astra_intro_seen_v1:${orgId}:${userId}`);
}

function hasSeenAstraIntro() {
  const key = astraIntroStorageKey();
  const legacyKey = legacyAstraIntroStorageKey();
  if (!key) return true;
  try {
    return localStorage.getItem(key) === '1'
      || (legacyKey ? localStorage.getItem(legacyKey) === '1' : false);
  } catch {
    return true;
  }
}

function markAstraIntroSeen() {
  const key = astraIntroStorageKey();
  if (key) {
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
  }
  window.dispatchEvent(new CustomEvent('arivu:astra-intro', { detail: { seen: true } }));
}

function maybeRevealAstraIntro() {
  if (!authStore.isAuthenticated || authStore.isExternalUser) return false;
  if (hasSeenAstraIntro()) return false;
  showAstraIntro.value = true;
  document.body.classList.add('astra-intro-lock');
  playAstraIntroSound();
  return true;
}

async function openAstraPanelAfterIntro() {
  historyMenuOpen.value = false;
  onNewChat();
  openPanel();
  await nextTick();
  await new Promise((resolve) => {
    window.setTimeout(resolve, 320);
  });
  inputEl.value?.focus();
}

async function dismissAstraIntro(openAssistant: boolean) {
  markAstraIntroSeen();
  showAstraIntro.value = false;

  if (!openAssistant) {
    document.body.classList.remove('astra-intro-lock');
    return;
  }

  playAstraIntroResolveSound();
  await new Promise((resolve) => {
    window.setTimeout(resolve, 180);
  });
  document.body.classList.remove('astra-intro-lock');
  await openAstraPanelAfterIntro();
}

function onAstraBgRevealEnd(event: AnimationEvent) {
  if (event.target !== event.currentTarget) return;
  if (event.animationName !== 'astra-intro-bg-reveal') return;
  const el = event.currentTarget;
  if (!(el instanceof HTMLElement)) return;
  el.style.webkitMaskImage = 'none';
  el.style.maskImage = 'none';
  el.style.animation = 'none';
}
const messagesEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLTextAreaElement | null>(null);
const panelWidthPx = ref(420);
const isResizing = ref(false);
const isSheetLayout = ref(
  typeof window !== 'undefined' ? window.matchMedia(ASSISTANT_SHEET_MQ).matches : false,
);

let sheetMq: MediaQueryList | null = null;
let resizePointerId: number | null = null;
let railSyncReady = false;

function rootRemPx() {
  if (typeof document === 'undefined') return 16;
  const parsed = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 16;
}

function shellPaddingPx() {
  return SIDEBAR_SHELL_PADDING_REM * rootRemPx();
}

function interPanelGapPx() {
  return shellPaddingPx();
}

const panelMotion = computed(() => {
  if (isSheetLayout.value) {
    return {
      enterActive: 'transition-transform duration-300 ease-out',
      enterFrom: 'translate-y-full',
      enterTo: 'translate-y-0',
      leaveActive: 'transition-transform duration-250 ease-in',
      leaveFrom: 'translate-y-0',
      leaveTo: 'translate-y-full',
    };
  }
  return {
    enterActive: 'transition-transform duration-300 ease-out',
    enterFrom: 'translate-x-full',
    enterTo: 'translate-x-0',
    leaveActive: 'transition-transform duration-250 ease-in',
    leaveFrom: 'translate-x-0',
    leaveTo: 'translate-x-full',
  };
});

const assistantRailStyle = computed(() => {
  const inset = shellPaddingPx();
  return {
    top: `${inset}px`,
    right: `${inset}px`,
    bottom: `${inset}px`,
    // Panel only — gutter is the empty reserved strip to the left of this box.
    width: `${panelWidthPx.value}px`,
  };
});

const resizeGapStyle = computed(() => {
  const gap = interPanelGapPx();
  return {
    width: `${gap}px`,
    left: `-${gap}px`,
  };
});

const pageContext = computed(() => resolvePageAiContext(route));

const headerTitle = computed(() =>
  conversationTitle.value || t('astra.brandName'),
);

const composerPlaceholder = computed(() => {
  if (isListening.value) return t('astra.voicePlaceholder');
  const user = authStore.user as { firstName?: string } | null;
  const name = String(user?.firstName || '').trim();
  return name ? t('astra.askPromptNamed', { name }) : t('astra.askPrompt');
});

function tabForCurrentRoute() {
  const pathBase = String(route.path || '').split('?')[0];
  const matched = (tabs.value || []).find(
    (tab: { path?: string }) => String(tab?.path || '').split('?')[0] === pathBase,
  );
  return matched || activeTab.value || null;
}

function currentRecordContextName() {
  const tab = tabForCurrentRoute() as {
    recordTitle?: string;
    titleParams?: { name?: string };
    params?: { name?: string };
    titleKey?: string;
  } | null;
  if (!tab) return '';
  const fromRecord = String(tab.recordTitle || '').trim();
  if (fromRecord) return fromRecord;
  const fromParams = String(tab.titleParams?.name || tab.params?.name || '').trim();
  if (fromParams) return fromParams;
  if (isGenericRecordTabTitleKey(tab.titleKey)) return '';
  return getPersistedRecordTabName(tab) || '';
}

const contextPillLabel = computed(() => {
  const ctx = pageContext.value;
  if (!ctx) return '';
  if (ctx.kind === 'record') {
    const recordName = currentRecordContextName();
    if (recordName) return recordName;
  }
  return ctx.moduleKey;
});

const emptyHeading = computed(() => t('astra.brandName'));

const emptySubtitle = computed(() => t('astra.tagline'));

const fallbackRecommendations = computed<AstraNbaItem[]>(() => {
  const ctx = pageContext.value;
  // Record surface: never invent static cards — wait for situation/API NBA.
  if (ctx?.kind === 'record' && ctx.recordId) return [];
  const mk = ctx?.moduleKey || '';
  if (mk === 'people') {
    return [
      { id: 'fb-people-find', kind: 'ask', label: t('astra.starterFindContact'), prompt: t('astra.starterFindContact'), iconKey: 'search' },
      { id: 'fb-people-open', kind: 'ask', label: 'Who should I follow up with this week?', prompt: 'Who should I follow up with this week?', iconKey: 'envelope' },
    ];
  }
  if (mk === 'cases') {
    return [
      { id: 'fb-cases', kind: 'ask', label: t('astra.starterOpenCases'), prompt: t('astra.starterOpenCases'), iconKey: 'ticket' },
    ];
  }
  if (mk === 'deals') {
    return [
      { id: 'fb-deals', kind: 'ask', label: t('astra.starterOpenDeals'), prompt: t('astra.starterOpenDeals'), iconKey: 'briefcase' },
      { id: 'fb-pulse', kind: 'ask', label: t('astra.starterPipelinePulse'), prompt: t('astra.starterPipelinePulse'), iconKey: 'chart' },
    ];
  }
  return [
    { id: 'fallback-deals', kind: 'ask', label: t('astra.starterOpenDeals'), prompt: t('astra.starterOpenDeals'), iconKey: 'briefcase' },
    { id: 'fallback-pulse', kind: 'ask', label: t('astra.starterPipelinePulse'), prompt: t('astra.starterPipelinePulse'), iconKey: 'chart' },
    { id: 'fallback-cases', kind: 'ask', label: t('astra.starterOpenCases'), prompt: t('astra.starterOpenCases'), iconKey: 'ticket' },
  ];
});

const recommendationCards = computed(() => {
  const items = recommendations.value.length
    ? recommendations.value
    : fallbackRecommendations.value;
  return items.map((item) => ({
    ...item,
    icon: resolveAstraNbaIcon({
      iconKey: item.iconKey,
      moduleKey: item.moduleKey,
      kind: item.kind,
      label: item.label,
      title: item.label,
    }),
  }));
});

function pickContextualNba(items: AstraNbaItem[]): AstraNbaItem[] {
  const ctx = pageContext.value;
  if (ctx?.kind === 'record' && ctx.recordId) {
    const scoped = items.filter((item) => item.recordId === ctx.recordId);
    // Prefer API/situation cards only — do not invent static record templates.
    if (scoped.length) return scoped.slice(0, 4);
    return items.slice(0, 4);
  }
  if (items.length) return items.slice(0, 4);
  return fallbackRecommendations.value;
}

async function loadRecommendations() {
  if (!panelOpen.value) return;
  recommendationsLoading.value = true;
  recommendations.value = [];
  try {
    const ctx = pageContext.value;
    const recordId = ctx?.kind === 'record' ? ctx.recordId : undefined;
    const items = await fetchNba({
      moduleKey: ctx?.moduleKey,
      recordId,
      recordName: recordId ? contextPillLabel.value : undefined,
      surface: recordId ? 'record' : (ctx?.moduleKey || 'home'),
    });
    recommendations.value = pickContextualNba(items);
  } finally {
    recommendationsLoading.value = false;
  }
}

function clampPanelWidth(px: number) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const inset = shellPaddingPx();
  const gap = interPanelGapPx();
  const max = Math.max(
    PANEL_WIDTH_MIN,
    Math.round(vw * PANEL_WIDTH_MAX_RATIO) - inset - gap,
  );
  const min = Math.min(PANEL_WIDTH_MIN, max);
  return Math.min(max, Math.max(min, Math.round(Number(px) || PANEL_WIDTH_MIN)));
}

function loadStoredPanelWidth() {
  try {
    const raw =
      localStorage.getItem(PANEL_WIDTH_STORAGE_KEY)
      ?? LEGACY_PANEL_WIDTH_STORAGE_KEYS.map((k) => localStorage.getItem(k)).find(Boolean);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= PANEL_WIDTH_MIN) {
      panelWidthPx.value = clampPanelWidth(n);
      return;
    }
  } catch {
    /* ignore */
  }
  panelWidthPx.value = clampPanelWidth(
    (typeof window !== 'undefined' ? window.innerWidth : 1280) * PANEL_WIDTH_DEFAULT_RATIO,
  );
}

function persistPanelWidth() {
  try {
    localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(panelWidthPx.value));
  } catch {
    /* ignore */
  }
}

function loadPanelOpen() {
  try {
    if (localStorage.getItem(PANEL_UI_STORAGE_KEY) === '1') return true;
    for (const key of LEGACY_PANEL_UI_STORAGE_KEYS) {
      if (localStorage.getItem(key) === '1') return true;
    }
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_SUPPORT_PANEL_UI_KEY) || 'null');
      return legacy?.open === true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

function persistPanelOpen(open: boolean) {
  try {
    localStorage.setItem(PANEL_UI_STORAGE_KEY, open ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function syncAssistantRail({ animate = true }: { animate?: boolean } = {}) {
  const open = Boolean(panelOpen.value);
  const sheet = isSheetLayout.value;
  const inset = shellPaddingPx();
  const gap = interPanelGapPx();
  // Reserve: AI panel + gutter between shell↔AI + right shell inset.
  // PlatformShell shrinks via width: calc(100% - var(--arivu-assistant-rail)).
  const width = open && !sheet ? panelWidthPx.value + gap + inset : 0;
  if (!animate) {
    document.body.classList.add('arivu-assistant-resizing');
  }
  document.documentElement.style.setProperty('--arivu-assistant-rail', `${width}px`);
  document.body.classList.toggle('arivu-assistant-rail-open', open && !sheet);
  // Zero work-panel right pad while open — the gutter lives in the reserved strip
  // between the shell and the AI rail (avoids doubling the gap).
  document.documentElement.style.setProperty(
    '--arivu-work-panel-pad-right',
    width ? '0px' : '',
  );
  if (open && sheet) {
    document.body.style.overflow = 'hidden';
  } else if (!document.body.classList.contains('astra-intro-lock')) {
    document.body.style.overflow = '';
  }
  window.dispatchEvent(new CustomEvent('arivu:assistant-rail', { detail: { open } }));
  if (!animate) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.remove('arivu-assistant-resizing');
      });
    });
  }
}

function setPanelWidth(px: number, { persist = true }: { persist?: boolean } = {}) {
  panelWidthPx.value = clampPanelWidth(px);
  syncAssistantRail();
  if (persist) persistPanelWidth();
}

function nudgePanelWidth(delta: number) {
  setPanelWidth(panelWidthPx.value + delta);
}

function onResizePointerDown(event: PointerEvent) {
  const handle = event.currentTarget;
  if (!(handle instanceof HTMLElement)) return;
  isResizing.value = true;
  resizePointerId = event.pointerId;
  handle.setPointerCapture(event.pointerId);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  document.body.classList.add('arivu-assistant-resizing');

  const startX = event.clientX;
  const startWidth = panelWidthPx.value;

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== resizePointerId) return;
    setPanelWidth(startWidth + (startX - ev.clientX), { persist: false });
  };
  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== resizePointerId) return;
    isResizing.value = false;
    resizePointerId = null;
    try {
      handle.releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.body.classList.remove('arivu-assistant-resizing');
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onUp);
    handle.removeEventListener('pointercancel', onUp);
    persistPanelWidth();
    syncAssistantRail();
  };
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp);
  handle.addEventListener('pointercancel', onUp);
}

function onWindowResize() {
  setPanelWidth(panelWidthPx.value, { persist: false });
}

function onSheetMqChange(e: MediaQueryListEvent) {
  isSheetLayout.value = e.matches;
  syncAssistantRail({ animate: false });
}

function openPanel() {
  panelOpen.value = true;
  persistPanelOpen(true);
  void nextTick(() => {
    inputEl.value?.focus();
  });
}

function closePanel() {
  panelOpen.value = false;
  historyMenuOpen.value = false;
  persistPanelOpen(false);
}

function historyForAsk() {
  return messages.value.slice(-8).map((m) => ({ role: m.role, content: m.body }));
}

async function scrollToEnd() {
  await nextTick();
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
}

function autoGrow() {
  const el = inputEl.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
}

async function ask(text: string) {
  const prompt = text.trim();
  if (!prompt || asking.value) return;
  messages.value.push({ id: `u-${Date.now()}`, role: 'user', body: prompt });
  await scrollToEnd();
  const ctx = pageContext.value;
  const recordId = ctx?.kind === 'record' ? ctx.recordId : undefined;
  const result = await askSync(prompt, {
    conversationId: conversationId.value,
    history: historyForAsk().slice(0, -1),
    moduleKey: ctx?.moduleKey,
    recordId,
    recordName: recordId ? contextPillLabel.value || undefined : undefined,
  });
  if (!result) {
    await scrollToEnd();
    return;
  }
  conversationId.value = result.conversationId;
  if (result.conversationId) {
    const title = result.conversationTitle || conversationTitle.value || prompt.slice(0, 80);
    conversationTitle.value = title;
    upsertLocal({
      id: result.conversationId,
      title,
      preview: result.answer,
      updatedAt: new Date().toISOString(),
      messageCount: messages.value.length + 1,
    });
  }
  messages.value.push({
    id: `a-${Date.now()}`,
    role: 'assistant',
    body: result.answer,
    blocks: result.blocks,
    proposals: result.proposals,
    suggestions: result.suggestions,
    agentKey: result.agentKey,
    agentName: result.agentName,
  });
  await scrollToEnd();
  await nextTick();
  inputEl.value?.focus();
}

async function onSend() {
  const text = draft.value;
  draft.value = '';
  await nextTick();
  autoGrow();
  await ask(text);
}

function onMicClick() {
  if (asking.value) return;
  if (isListening.value) {
    void toggleListening();
    return;
  }
  voiceDraftBaseline.value = draft.value;
  captureAstraVoiceStarted({ surface: 'side_panel' });
  void toggleListening({
    onTranscript: (text) => {
      draft.value = text;
      void nextTick(() => autoGrow());
    },
    onEnd: ({ text, reason }) => {
      if (reason === 'commit' && text.trim()) {
        draft.value = text.trim();
        captureAstraVoiceCommitted({
          surface: 'side_panel',
          promptLength: text.trim().length,
        });
        void onSend();
        return;
      }
      draft.value = voiceDraftBaseline.value;
      void nextTick(() => autoGrow());
      captureAstraVoiceCancelled({ surface: 'side_panel', reason });
    },
  });
}

function onSpeakAnswer(msg: PanelMessage) {
  const body = String(msg.body || '').trim();
  if (!body) return;
  if (speakingMessageId.value === msg.id && speaking.value) {
    stopSpeaking();
    return;
  }
  captureAstraTtsPlayed({ surface: 'side_panel' });
  speakAnswer(msg.id, body);
}

async function onSuggestion(suggestion: string) {
  await ask(suggestion);
}

async function onConfirmProposal(messageId: string, proposal: AstraProposal) {
  if (isEmailSendProposal(proposal)) {
    openEmailComposeFromAstra(proposal);
    messages.value = messages.value.map((m) => {
      if (m.id !== messageId) return m;
      return {
        ...m,
        proposals: (m.proposals || []).map((p) => {
          if (p.id !== proposal.id) return p;
          return { ...p, status: 'completed' as const, rationale: t('astra.emailOpenedInCompose') };
        }),
      };
    });
    messages.value.push({
      id: `a-confirm-${Date.now()}`,
      role: 'assistant',
      body: t('astra.emailOpenedInCompose'),
    });
    await scrollToEnd();
    return;
  }
  const result = await confirmProposal(proposal, { conversationId: conversationId.value });
  if (!result.ok) return;
  messages.value = messages.value.map((m) => {
    if (m.id !== messageId) return m;
    return {
      ...m,
      proposals: (m.proposals || []).map((p) => {
        if (p.id !== proposal.id) return p;
        return {
          ...p,
          status: 'completed' as const,
          href: result.href || p.href,
          recordId: result.recordId || p.recordId,
          navigateLabel: result.navigateLabel || p.navigateLabel,
          rationale: result.message || p.rationale,
        };
      }),
    };
  });
  messages.value.push({
    id: `a-confirm-${Date.now()}`,
    role: 'assistant',
    body: result.message || t('astra.actionCompleted'),
    href: result.href,
    navigateLabel: result.navigateLabel,
  });
  await scrollToEnd();
}

function onDismissProposal(messageId: string, proposalId: string) {
  const proposal = messages.value
    .find((m) => m.id === messageId)
    ?.proposals?.find((p) => p.id === proposalId);
  messages.value = messages.value.map((m) => {
    if (m.id !== messageId) return m;
    return {
      ...m,
      proposals: (m.proposals || []).filter((p) => p.id !== proposalId),
    };
  });
  if (proposal) {
    captureAstraActionRejected({
      surface: 'side_panel',
      actionKind: proposal.kind,
      actionId: proposal.id,
    });
  }
}

function onNavigate(href?: string) {
  const path = String(href || '').trim();
  if (!path) return;
  void router.push(path);
}

function onNewChat() {
  messages.value = [];
  conversationId.value = undefined;
  conversationTitle.value = '';
  error.value = '';
  draft.value = '';
  historyMenuOpen.value = false;
  void nextTick(() => {
    autoGrow();
    inputEl.value?.focus();
  });
}

async function onOpenConversation(id: string) {
  historyMenuOpen.value = false;
  if (!id || asking.value) return;
  const detail = await loadOne(id);
  if (!detail) return;
  conversationId.value = detail.id;
  conversationTitle.value = detail.title || '';
  messages.value = (detail.messages || []).map((m, index) => ({
    id: m.id || `m-${index}`,
    role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
    body: String(m.body || ''),
    blocks: Array.isArray(m.blocks) ? (m.blocks as AstraUiBlock[]) : [],
    proposals: Array.isArray(m.proposals)
      ? (m.proposals as AstraProposal[]).map((p) => ({
        ...p,
        status: p.status === 'completed' ? 'completed' as const : 'pending' as const,
      }))
      : [],
    suggestions: Array.isArray(m.suggestions) ? m.suggestions : [],
    href: m.navigate?.href,
    navigateLabel: m.navigate?.label,
  }));
  await scrollToEnd();
}

function onOpenFullCopilot() {
  historyMenuOpen.value = false;
  closePanel();
  void router.push({ name: 'astra' });
}

function onOpenAssistantEvent(ev: Event) {
  const path = String(route.path || '');
  if (path.startsWith('/live-chat') || path.startsWith('/telephony') || path.startsWith('/portal')) return;
  if (!authStore.isAuthenticated || authStore.isExternalUser) return;
  if (showAstraIntro.value) return;

  const detail = (ev && typeof ev === 'object' && 'detail' in ev && ev.detail && typeof ev.detail === 'object')
    ? (ev.detail as { prompt?: string; autoAsk?: boolean })
    : {};
  const prompt = String(detail.prompt || '').trim();

  if (prompt) {
    if (!panelOpen.value) {
      if (maybeRevealAstraIntro()) return;
      openPanel();
    }
    void (async () => {
      onNewChat();
      if (detail.autoAsk) {
        await ask(prompt);
        return;
      }
      draft.value = prompt;
      await nextTick();
      inputEl.value?.focus();
    })();
    return;
  }

  if (panelOpen.value) {
    closePanel();
    return;
  }
  if (maybeRevealAstraIntro()) return;
  openPanel();
  void refreshHistory();
}

loadStoredPanelWidth();

watch(
  () => [panelOpen.value, panelWidthPx.value, isSheetLayout.value],
  () => {
    syncAssistantRail({ animate: railSyncReady });
    railSyncReady = true;
  },
  { immediate: true },
);

watch(
  () => panelOpen.value,
  (open) => {
    if (open) void loadRecommendations();
  },
);

watch(
  () => [
    route.fullPath,
    pageContext.value?.moduleKey,
    pageContext.value?.recordId,
    contextPillLabel.value,
  ],
  () => {
    historyMenuOpen.value = false;
    if (panelOpen.value) void loadRecommendations();
  },
);

onMounted(() => {
  syncAssistantRail({ animate: false });
  railSyncReady = true;
  if (typeof window !== 'undefined') {
    sheetMq = window.matchMedia(ASSISTANT_SHEET_MQ);
    isSheetLayout.value = sheetMq.matches;
    sheetMq.addEventListener('change', onSheetMqChange);
  }
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('arivu:open-assistant', onOpenAssistantEvent);
  if (loadPanelOpen() && authStore.isAuthenticated && !authStore.isExternalUser && hasSeenAstraIntro()) {
    const path = String(route.path || '');
    if (!path.startsWith('/live-chat') && !path.startsWith('/telephony') && !path.startsWith('/portal')) {
      panelOpen.value = true;
    }
  }
  // Prefetch history only when the panel is already open. Eager mount fetch used to
  // 401-logout valid CRM sessions (apiClient treats any 401 as session death).
  if (panelOpen.value) {
    void refreshHistory();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('arivu:open-assistant', onOpenAssistantEvent);
  sheetMq?.removeEventListener('change', onSheetMqChange);
  sheetMq = null;
  document.documentElement.style.removeProperty('--arivu-assistant-rail');
  document.documentElement.style.removeProperty('--arivu-work-panel-pad-right');
  document.body.style.paddingRight = '';
  document.body.style.overflow = '';
  document.body.classList.remove('arivu-assistant-rail-open');
  document.body.classList.remove('arivu-assistant-resizing');
  document.body.classList.remove('astra-intro-lock');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});
</script>

<style>
.astra-hero-logo {
  position: relative;
  display: inline-flex;
  isolation: isolate;
}

.astra-hero-logo :deep(img) {
  position: relative;
  z-index: 0;
  display: block;
  filter: drop-shadow(0 8px 20px rgb(15 23 42 / 0.12));
}

.astra-hero-logo::after {
  content: '';
  position: absolute;
  z-index: 1;
  inset: 0;
  background: linear-gradient(
    100deg,
    transparent 0%,
    rgb(255 255 255 / 0.12) 40%,
    rgb(255 255 255 / 0.85) 50%,
    rgb(255 255 255 / 0.12) 60%,
    transparent 100%
  );
  background-size: 220% 100%;
  animation: astra-hero-logo-shimmer 2.8s linear infinite;
  pointer-events: none;
  -webkit-mask-image: url('/assets/logo/Ai%20Logo.svg');
  mask-image: url('/assets/logo/Ai%20Logo.svg');
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  will-change: background-position;
}

html.dark .astra-hero-logo::after {
  background: linear-gradient(
    100deg,
    transparent 0%,
    rgb(255 255 255 / 0.1) 40%,
    rgb(255 255 255 / 0.7) 50%,
    rgb(255 255 255 / 0.1) 60%,
    transparent 100%
  );
  background-size: 220% 100%;
}

@keyframes astra-hero-logo-shimmer {
  0% {
    background-position: 140% 0;
  }
  100% {
    background-position: -40% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .astra-hero-logo::after {
    animation: none;
    opacity: 0;
  }
}

html {
  --arivu-assistant-rail: 0px;
}

body {
  transition: margin-right 0.3s ease-out;
}

body.astra-intro-lock {
  overflow: hidden;
}

body.arivu-assistant-rail-open {
  background-color: rgb(245 245 245); /* neutral-100 — gutter canvas */
}

html.dark body.arivu-assistant-rail-open {
  background-color: rgb(23 23 23); /* neutral-900 */
}

body.arivu-assistant-resizing {
  transition: none !important;
}

body.arivu-assistant-resizing [data-platform-shell] {
  transition: none !important;
}

.arivu-hero-title {
  font-family: inherit;
  letter-spacing: -0.03em;
  background-image: linear-gradient(
    100deg,
    rgb(17 24 39) 0%,
    rgb(17 24 39) 38%,
    #8e2ef7 46%,
    #3277fe 50%,
    #06d0fa 54%,
    #ff4e66 58%,
    rgb(17 24 39) 66%,
    rgb(17 24 39) 100%
  );
  background-size: 240% 100%;
  background-position: 100% 0;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  animation: arivu-hero-title-shimmer 3.6s ease-in-out infinite;
}

.astra-intro .arivu-hero-title {
  background-image: linear-gradient(
    100deg,
    rgb(255 255 255) 0%,
    rgb(255 255 255) 38%,
    #a78bfa 46%,
    #6049E7 50%,
    #5037d9 54%,
    #4527a0 58%,
    rgb(255 255 255) 66%,
    rgb(255 255 255) 100%
  );
}

html.dark .arivu-hero-title {
  background-image: linear-gradient(
    100deg,
    rgb(255 255 255) 0%,
    rgb(255 255 255) 38%,
    #8e2ef7 46%,
    #3277fe 50%,
    #06d0fa 54%,
    #ff4e66 58%,
    rgb(255 255 255) 66%,
    rgb(255 255 255) 100%
  );
}

@keyframes arivu-hero-title-shimmer {
  0%,
  18% {
    background-position: 100% 0;
  }
  55%,
  100% {
    background-position: 0% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .arivu-hero-title {
    animation: none;
    background: none;
    color: rgb(17 24 39);
    -webkit-text-fill-color: currentColor;
  }

  html.dark .arivu-hero-title,
  .astra-intro .arivu-hero-title {
    color: rgb(255 255 255);
  }

  .astra-intro__glow,
  .astra-intro__mesh,
  .astra-intro__bg,
  .astra-intro__content,
  .astra-intro__close,
  .astra-intro__logo,
  .astra-intro__title,
  .astra-intro__tagline,
  .astra-intro__chip,
  .astra-intro__cta,
  .astra-intro__skip,
  .astra-intro-leave {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
    clip-path: none !important;
    -webkit-mask-image: none !important;
    mask-image: none !important;
  }
}

.astra-intro-leave {
  animation: astra-intro-fade-out 0.55s ease-in-out both;
}

@property --astra-reveal {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 0%;
}

@property --astra-feather {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 28%;
}

.astra-intro {
  --ai-c1: #6049E7;
  --ai-c2: #5037d9;
  --ai-c3: #a78bfa;
  --ai-c4: #4527a0;
  --ai-c5: #3a1f8a;
  background: transparent;
  -webkit-backdrop-filter: blur(8px) saturate(1.08);
  backdrop-filter: blur(8px) saturate(1.08);
}

.astra-intro__bg {
  pointer-events: none;
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, #0b0f1a 72%, color-mix(in srgb, var(--ai-c1) 24%, transparent));
  --astra-reveal: 0%;
  --astra-feather: 28%;
  -webkit-mask-image: radial-gradient(
    circle at 50% 48%,
    #000 0%,
    #000 var(--astra-reveal),
    transparent calc(var(--astra-reveal) + var(--astra-feather))
  );
  mask-image: radial-gradient(
    circle at 50% 48%,
    #000 0%,
    #000 var(--astra-reveal),
    transparent calc(var(--astra-reveal) + var(--astra-feather))
  );
  animation: astra-intro-bg-reveal 1.9s ease-in-out forwards;
}

html.dark .astra-intro__bg {
  background: color-mix(in srgb, #000 48%, color-mix(in srgb, var(--ai-c1) 16%, transparent));
}

.astra-intro__mesh {
  pointer-events: none;
  position: absolute;
  inset: -18%;
  width: 136%;
  height: 136%;
  background:
    radial-gradient(ellipse 70% 50% at 30% 20%, color-mix(in srgb, var(--ai-c1) 36%, transparent), transparent 65%),
    radial-gradient(ellipse 55% 45% at 75% 35%, color-mix(in srgb, var(--ai-c3) 22%, transparent), transparent 60%),
    radial-gradient(ellipse 50% 40% at 20% 75%, color-mix(in srgb, var(--ai-c2) 26%, transparent), transparent 58%),
    radial-gradient(ellipse 60% 45% at 80% 80%, color-mix(in srgb, var(--ai-c4) 20%, transparent), transparent 60%);
  transform: translate3d(0, 0, 0) scale(1);
  animation: astra-intro-mesh 24s ease-in-out 2.1s infinite alternate;
}

.astra-intro__glow {
  pointer-events: none;
  position: absolute;
  left: 50%;
  top: 36%;
  height: min(80vw, 560px);
  width: min(80vw, 560px);
  margin-left: calc(min(80vw, 560px) / -2);
  margin-top: calc(min(80vw, 560px) / -2);
  border-radius: 9999px;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--ai-c1) 30%, transparent) 0%,
    color-mix(in srgb, var(--ai-c2) 16%, transparent) 42%,
    transparent 72%
  );
  filter: blur(36px);
  opacity: 0.9;
  transform: translate3d(0, 0, 0) scale(1);
  animation: astra-intro-glow 18s ease-in-out 2.1s infinite alternate;
}

.astra-intro__vignette {
  pointer-events: none;
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 36%, rgb(0 0 0 / 0.52) 100%);
}

html.dark .astra-intro__vignette {
  background: radial-gradient(ellipse at center, transparent 42%, rgb(0 0 0 / 0.45) 100%);
}

.astra-intro__content,
.astra-intro__close {
  opacity: 0;
  animation: astra-intro-content-in 0.7s ease-out 2.05s forwards;
}

.astra-intro__logo {
  display: block;
  opacity: 0;
  filter: drop-shadow(0 0 28px color-mix(in srgb, var(--ai-c2) 40%, transparent));
  animation: astra-intro-rise 0.75s ease-out 2.1s forwards;
}

.astra-intro__title {
  opacity: 0;
  animation:
    astra-intro-rise 0.75s ease-out 2.22s forwards,
    arivu-hero-title-shimmer 3.6s ease-in-out 3s infinite;
}

.astra-intro__tagline {
  opacity: 0;
  animation: astra-intro-rise 0.75s ease-out 2.34s forwards;
}

.astra-intro__chip {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  border: 1px solid rgb(255 255 255 / 0.16);
  background: rgb(255 255 255 / 0.1);
  padding: 0.45rem 0.95rem;
  font-size: 13px;
  font-weight: 500;
  color: rgb(255 255 255 / 0.88);
  backdrop-filter: blur(8px);
  opacity: 0;
  animation: astra-intro-rise 0.65s ease-out forwards;
}

.astra-intro__chip:nth-child(1) { animation-delay: 2.44s; }
.astra-intro__chip:nth-child(2) { animation-delay: 2.5s; }
.astra-intro__chip:nth-child(3) { animation-delay: 2.56s; }
.astra-intro__chip:nth-child(4) { animation-delay: 2.62s; }

.astra-intro__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 12.5rem;
  border-radius: 9999px;
  border: 0;
  background: linear-gradient(105deg, var(--ai-c1), var(--ai-c2) 45%, var(--ai-c3));
  padding: 0.9rem 1.75rem;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  box-shadow: 0 16px 40px color-mix(in srgb, var(--ai-c2) 45%, transparent);
  opacity: 0;
  animation: astra-intro-rise 0.7s ease-out 2.68s forwards;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.astra-intro__cta:hover {
  transform: translateY(-1px) scale(1.03);
  filter: brightness(1.06);
}

.astra-intro__skip {
  opacity: 0;
  animation: astra-intro-rise 0.6s ease-out 2.78s forwards;
}

@keyframes astra-intro-bg-reveal {
  0% {
    --astra-reveal: 0%;
    --astra-feather: 28%;
  }
  70% {
    --astra-reveal: 85%;
    --astra-feather: 20%;
  }
  100% {
    --astra-reveal: 150%;
    --astra-feather: 0%;
  }
}

@keyframes astra-intro-content-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes astra-intro-glow {
  from {
    opacity: 0.85;
    transform: translate3d(0, 0, 0) scale(1);
  }
  to {
    opacity: 0.95;
    transform: translate3d(5%, -3%, 0) scale(1.06);
  }
}

@keyframes astra-intro-mesh {
  from {
    transform: translate3d(0, 0, 0) scale(1);
  }
  to {
    transform: translate3d(2.5%, 1.5%, 0) scale(1.03);
  }
}

@keyframes astra-intro-rise {
  from {
    opacity: 0;
    transform: translate3d(0, 12px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes astra-intro-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

.astra-status-enter-active,
.astra-status-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease;
}

.astra-status-enter-from {
  opacity: 0;
  transform: translateY(0.45rem);
}

.astra-status-leave-to {
  opacity: 0;
  transform: translateY(-0.45rem);
}

.astra-status-enter-to,
.astra-status-leave-from {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .astra-status-enter-active,
  .astra-status-leave-active {
    transition: none;
  }
}
</style>
