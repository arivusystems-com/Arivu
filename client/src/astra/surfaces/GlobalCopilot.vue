<template>
  <div class="astra-copilot relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-950">
    <div class="flex min-h-0 flex-1 overflow-hidden">
      <div
        class="relative hidden h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out md:block"
        :style="{ width: sidebarDesktopOpen ? '17.5rem' : '0px' }"
      >
        <div class="h-full w-[17.5rem]">
          <AstraConversationSidebar
            :items="conversations"
            :canvases="canvasSidebarItems"
            :filter="sidebarFilter"
            :active-id="sidebarActiveId"
            :active-kind="sidebarActiveKind"
            :loading="historyLoading"
            :canvases-loading="canvasesLoading"
            :loading-more="historyLoadingMore"
            :has-more="historyHasMore"
            :mobile-open="mobileHistoryOpen"
            @update:filter="onSidebarFilter"
            @select="onSelectConversation"
            @select-canvas="onSelectCanvas"
            @delete="onDeleteConversation"
            @delete-canvas="onDeleteCanvas"
            @new-chat="onNewChat"
            @new-canvas="onNewCanvasFromSidebar"
            @collapse="sidebarDesktopOpen = false"
            @close-mobile="mobileHistoryOpen = false"
            @clear-older="onClearOlder"
            @load-more="onLoadMoreHistory"
          />
        </div>
      </div>

      <div class="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <button
          v-show="!sidebarDesktopOpen && viewMode !== 'canvas'"
          type="button"
          class="absolute left-3 top-3 z-30 hidden h-8 w-8 items-center justify-center rounded-lg border border-neutral-200/80 bg-white text-neutral-600 shadow-sm transition-opacity duration-200 hover:bg-neutral-50 hover:text-neutral-900 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 md:inline-flex"
          :aria-label="t('astra.sidebarExpand')"
          :title="t('astra.sidebarExpand')"
          :aria-expanded="false"
          @click="sidebarDesktopOpen = true"
        >
          <svg
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect x="3.75" y="4.75" width="16.5" height="14.5" rx="2.25" stroke="currentColor" stroke-width="1.5" />
            <path d="M9.25 5v14" stroke="currentColor" stroke-width="1.5" />
            <path d="M5.75 9h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <path d="M5.75 12h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <path d="M5.75 15h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>

        <AstraLivingCanvas
          v-if="viewMode === 'canvas'"
          class="min-h-0 min-w-0"
          :key="canvasSessionKey"
          :seed-prompt="canvasSeedPrompt || undefined"
          :seed-focus="canvasSeedFocus || undefined"
          :resume-id="canvasResumeId || undefined"
          :show-sidebar-expand="!sidebarDesktopOpen"
          @back="exitCanvasMode"
          @expand-sidebar="sidebarDesktopOpen = true"
        />

        <!-- Chat column -->
        <section
          v-else
          class="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-950"
        >
      <header
        class="relative z-10 flex shrink-0 items-center border-b border-neutral-200/60 px-4 py-2 dark:border-white/[0.08] md:hidden"
      >
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-neutral-200/60 dark:bg-neutral-900 dark:ring-white/10"
          :aria-label="t('astra.historyHeading')"
          @click="mobileHistoryOpen = true"
        >
          <Bars3Icon class="h-4 w-4" />
        </button>
      </header>

      <div
        class="relative z-10 flex min-h-0 flex-1 flex-col"
        :class="isEmptyLanding ? 'justify-center overflow-y-auto px-4 pb-28 pt-4 sm:px-6 sm:pb-36 sm:pt-6' : ''"
      >
        <!-- Empty landing: hero + composer as one centered stack -->
        <div
          v-if="isEmptyLanding"
          class="mx-auto flex w-full max-w-3xl shrink-0 flex-col items-center px-2 text-center"
        >
          <div class="astra-hero-logo mb-2 flex items-center justify-center">
            <AstraLogo size="hero" />
          </div>
          <h1 class="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
            {{ greeting }}
          </h1>
          <p class="mt-1 max-w-md text-sm text-neutral-500">{{ t('astra.tagline') }}</p>
          <div class="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2.5 text-left sm:grid-cols-2">
            <button
              v-for="card in heroSuggestions"
              :key="card.id"
              type="button"
              class="rounded-2xl border border-neutral-200/70 bg-white px-4 py-3.5 text-left shadow-sm transition hover:border-primary-300 dark:border-white/10 dark:bg-neutral-900"
              @click="onSuggestion(card)"
            >
              <span class="flex items-start gap-3">
                <span class="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300">
                  <component :is="card.icon" class="h-4 w-4" />
                </span>
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-neutral-900 dark:text-white">{{ card.title }}</span>
                  <span class="mt-0.5 block text-xs text-neutral-500">{{ card.subtitle }}</span>
                </span>
              </span>
            </button>
          </div>
        </div>

        <!-- Thread -->
        <div
          v-else
          ref="messagesEl"
          class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
        >
          <div class="mx-auto w-full max-w-3xl space-y-6">
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="flex gap-3"
              :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div
                v-if="msg.role === 'assistant'"
                class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-neutral-200/70 dark:bg-neutral-900 dark:ring-white/10"
              >
                <AstraLogo size="sm" />
              </div>
              <div
                v-if="msg.role === 'user'"
                class="max-w-[85%] rounded-3xl rounded-br-lg bg-sky-50 px-4 py-2.5 text-sm text-sky-950 dark:bg-sky-950/40 dark:text-sky-100"
              >
                <p class="whitespace-pre-wrap break-words">{{ msg.body }}</p>
              </div>
              <div v-else class="min-w-0 max-w-[min(100%,42rem)] flex-1 space-y-3">
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
                    @click="onNavigateProposal(msg.href)"
                  >
                    {{ msg.navigateLabel || t('astra.viewRecord') }}
                  </button>
                </div>
                <AstraMessageBlocks
                  v-if="msg.blocks?.length"
                  :blocks="msg.blocks"
                  @action="onSuggestion"
                />
                <div v-if="msg.proposals?.length" class="space-y-2 rounded-2xl border border-neutral-200 bg-white p-3 dark:border-white/10 dark:bg-neutral-900">
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    {{ t('astra.proposalsHeading') }}
                  </p>
                  <div
                    v-for="proposal in msg.proposals"
                    :key="proposal.id"
                    class="rounded-xl border border-neutral-100 px-3 py-2.5 dark:border-white/10"
                  >
                    <p class="text-sm font-medium text-neutral-900 dark:text-white">{{ proposal.label }}</p>
                    <p v-if="proposal.rationale" class="mt-0.5 whitespace-pre-line text-xs text-neutral-500">{{ proposal.rationale }}</p>
                    <dl
                      v-if="proposal.status !== 'completed' && proposal.details?.length"
                      class="mt-2 space-y-1 border-t border-neutral-100 pt-2 dark:border-white/10"
                    >
                      <div
                        v-for="(row, dIdx) in proposal.details"
                        :key="`${proposal.id}-d-${dIdx}`"
                        class="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 text-xs"
                      >
                        <dt class="text-neutral-400">{{ row.label }}</dt>
                        <dd class="truncate text-neutral-700 dark:text-neutral-200" :title="row.value">{{ row.value }}</dd>
                      </div>
                    </dl>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <template v-if="proposal.status === 'completed'">
                        <button
                          v-if="proposal.href"
                          type="button"
                          class="rounded-full bg-primary-500 px-3 py-1 text-xs font-medium text-white hover:bg-primary-600 dark:bg-primary-500 dark:hover:bg-primary-600"
                          @click="onNavigateProposal(proposal.href)"
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
                          {{
                            isEmailSendProposal(proposal)
                              ? t('astra.reviewAndSend')
                              : isOverrideProposal(proposal)
                                ? t('astra.overrideAction')
                                : t('astra.confirmAction')
                          }}
                        </button>
                        <button
                          type="button"
                          class="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 dark:border-white/10 dark:text-neutral-300"
                          :disabled="confirming"
                          @click="onDismissProposal(msg.id, proposal.id)"
                        >
                          {{ isOverrideProposal(proposal) ? t('astra.cancelAction') : t('astra.dismissAction') }}
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

            <div v-if="asking" class="flex items-center gap-3 text-sm text-neutral-500">
              <span class="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-1 ring-neutral-200/70 dark:bg-neutral-900 dark:ring-white/10">
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
              class="rounded-2xl bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-200"
            >
              {{ error }}
            </p>
          </div>
        </div>

        <!-- Composer: grouped under hero when empty; docked when in a thread -->
        <div
          :class="isEmptyLanding
            ? 'mx-auto mt-8 w-full max-w-3xl shrink-0'
            : 'shrink-0 border-t border-neutral-200/60 bg-neutral-50/95 px-3 py-3 backdrop-blur dark:border-white/[0.08] dark:bg-neutral-950/95 sm:px-6 sm:py-4'"
        >
          <div :class="isEmptyLanding ? '' : 'mx-auto w-full max-w-3xl'">
            <form
              class="astra-composer-shell flex flex-col gap-2 rounded-[1.35rem] bg-white p-2.5 shadow-sm dark:bg-neutral-900"
              :class="[
                isEmptyLanding
                  ? 'ring-2 ring-transparent [background:linear-gradient(#fff,#fff)_padding-box,linear-gradient(90deg,#7c3aed,#3b82f6)_border-box] dark:[background:linear-gradient(#171717,#171717)_padding-box,linear-gradient(90deg,#7c3aed,#3b82f6)_border-box] border-2 border-transparent'
                  : 'border border-neutral-200 dark:border-white/10',
                isListening ? 'ring-2 ring-rose-400/70 dark:ring-rose-400/50' : '',
              ]"
              @submit.prevent="onSend"
            >
              <div class="flex items-end gap-2">
                <textarea
                  ref="inputEl"
                  v-model="draft"
                  rows="1"
                  class="max-h-40 min-h-[2.75rem] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100"
                  :placeholder="composerPlaceholder"
                  :disabled="asking || isListening"
                  :aria-busy="isListening"
                  @keydown.enter.exact.prevent="onSend"
                  @input="autoGrow"
                />
                <button
                  type="button"
                  class="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition disabled:opacity-35"
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
                  class="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-35 dark:bg-primary-500 dark:hover:bg-primary-600 dark:text-white"
                  :disabled="asking || isListening || !draft.trim()"
                  :aria-label="t('astra.send')"
                >
                  <PaperAirplaneIcon class="h-4 w-4 -rotate-45 translate-x-px" />
                </button>
              </div>

              <p
                v-if="isListening"
                class="px-1 text-[11px] font-medium text-rose-600 dark:text-rose-400"
                aria-live="polite"
              >
                {{ t('astra.voiceListening') }}
              </p>

              <!-- Mode toggle: Astra AI | Astra Studio (new-chat primary) -->
              <div
                class="flex items-center gap-2 px-1 pb-0.5"
                :class="isEmptyLanding ? '' : 'opacity-90'"
              >
                <div
                  class="inline-flex items-center rounded-full bg-neutral-100 p-0.5 dark:bg-neutral-800"
                  role="tablist"
                  :aria-label="t('astra.composerModeLabel')"
                >
                  <button
                    type="button"
                    role="tab"
                    class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition"
                    :class="composerMode === 'ai'
                      ? 'bg-white text-emerald-600 shadow-sm dark:bg-neutral-700 dark:text-emerald-400'
                      : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'"
                    :aria-selected="composerMode === 'ai'"
                    @click="composerMode = 'ai'"
                  >
                    <MagnifyingGlassIcon class="h-3.5 w-3.5" />
                    {{ t('astra.modeAstraAi') }}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition"
                    :class="composerMode === 'studio'
                      ? 'bg-white text-violet-600 shadow-sm dark:bg-neutral-700 dark:text-violet-400'
                      : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'"
                    :aria-selected="composerMode === 'studio'"
                    @click="composerMode = 'studio'"
                  >
                    <Squares2X2Icon class="h-3.5 w-3.5" />
                    {{ t('astra.modeAstraStudio') }}
                  </button>
                </div>
              </div>
            </form>
            <p class="mt-2 text-center text-[10px] text-neutral-400">{{ t('astra.composerFootnote') }}</p>
          </div>
        </div>
      </div>
      </section>
      </div>
    </div>

    <EmailComposeDrawer
      :is-open="showEmailModal"
      :standalone-mode="!emailRelatedTo"
      :related-to="emailRelatedTo"
      :initial-to="emailComposeDraft?.to || ''"
      :initial-draft="emailComposeDraft"
      @close="closeEmailCompose"
      @submit="handleEmailSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onErrorCaptured, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import {
  AcademicCapIcon,
  Bars3Icon,
  BriefcaseIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  SpeakerWaveIcon,
  Squares2X2Icon,
  StopCircleIcon,
  TicketIcon,
  UserIcon,
} from '@heroicons/vue/24/outline';
import type { Component } from 'vue';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import { useAstraAsk, type AstraProposal, type AstraSuggestion } from '@/astra/composables/useAstraAsk';
import { useAstraConversations } from '@/astra/composables/useAstraConversations';
import { useAstraStatusLine } from '@/astra/composables/useAstraStatusLine';
import { useAstraVoice } from '@/astra/composables/useAstraVoice';
import AstraMessageBlocks from '@/astra/blocks/AstraMessageBlocks.vue';
import AstraAnswerBody from '@/astra/components/AstraAnswerBody.vue';
import AstraConversationSidebar from '@/astra/components/AstraConversationSidebar.vue';
import type { SidebarFilter } from '@/astra/components/AstraConversationSidebar.vue';
import AstraFollowUps from '@/astra/components/AstraFollowUps.vue';
import AstraLogo from '@/astra/components/AstraLogo.vue';
import AstraLivingCanvas from '@/astraStudio/surfaces/AstraLivingCanvas.vue';
import { deleteCanvas, listCanvases } from '@/astraStudio/api/studioApi';
import type { CanvasMeta } from '@/astraStudio/types';
import EmailComposeDrawer from '@/components/communications/EmailComposeDrawer.vue';
import type { AstraUiBlock } from '@/astra/blocks/types';
import { resolveAstraNbaIcon } from '@/astra/utils/resolveAstraNbaIcon';
import {
  ARIVU_OPEN_EMAIL_COMPOSE,
  isEmailSendProposal,
  openEmailComposeFromAstra,
  type EmailComposeDraft,
  type EmailComposeRelatedTo,
  type OpenEmailComposeDetail,
} from '@/astra/utils/openEmailCompose';
import {
  captureAstraTtsPlayed,
  captureAstraVoiceCancelled,
  captureAstraVoiceCommitted,
  captureAstraVoiceStarted,
} from '@/config/posthogAi';

interface CopilotMessage {
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

interface HeroSuggestion {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  moduleKey?: string;
  recordId?: string;
  recordName?: string;
  icon: Component;
}

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { findTabByPath } = useTabs();
const { asking, confirming, error, askSync, confirmProposal, fetchNba } = useAstraAsk('copilot');
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
  loading: historyLoading,
  loadingMore: historyLoadingMore,
  hasMore: historyHasMore,
  refresh: refreshHistory,
  loadMore: loadMoreHistory,
  loadOne,
  remove: removeConversation,
  clearAll: clearConversations,
  upsertLocal,
} = useAstraConversations();

const viewMode = ref<'chat' | 'canvas'>(
  String(route.query.view || '') === 'canvas' ? 'canvas' : 'chat',
);
const canvasSeedPrompt = ref('');
const canvasSeedFocus = ref<{ moduleKey?: string; recordId?: string; recordName?: string } | null>(null);
/** Bumps on each Studio open so Living Canvas remounts a fresh session. */
const canvasSessionKey = ref(0);
/** Only set when resuming an existing board via ?id= (not on new generate). */
const canvasResumeId = ref('');
const CANVAS_RESUME_STORAGE_KEY = 'astra.studio.lastCanvasId';

function persistCanvasResume(id: string): void {
  const trimmed = String(id || '').trim();
  if (!trimmed) return;
  try {
    sessionStorage.setItem(CANVAS_RESUME_STORAGE_KEY, trimmed);
  } catch {
    // ignore quota / private mode
  }
  // TabBar stores path without query by default — keep Astra tab on the open canvas URL.
  try {
    const tab = findTabByPath('/astra') || findTabByPath(route.fullPath);
    if (tab) {
      tab.path = `/astra?view=canvas&id=${encodeURIComponent(trimmed)}`;
    }
  } catch {
    // tabs unavailable
  }
}

function clearPersistedCanvasResume(): void {
  try {
    sessionStorage.removeItem(CANVAS_RESUME_STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    const tab = findTabByPath('/astra');
    if (tab && String(tab.path || '').includes('view=canvas')) {
      tab.path = '/astra';
    }
  } catch {
    // ignore
  }
}

function readPersistedCanvasResume(): string {
  try {
    return String(sessionStorage.getItem(CANVAS_RESUME_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

function isAstraRoute(): boolean {
  return route.name === 'astra' || String(route.path || '').startsWith('/astra');
}

/** Restore Living Canvas after tab switches (keep-alive) or bare /astra navigations. */
function restoreCanvasSessionIfNeeded(): boolean {
  if (!isAstraRoute()) return false;
  const urlView = String(route.query.view || '');
  const urlId = String(route.query.id || '').trim();

  if (urlView === 'canvas' && urlId) {
    canvasResumeId.value = urlId;
    persistCanvasResume(urlId);
    viewMode.value = 'canvas';
    sidebarFilter.value = 'canvases';
    composerMode.value = 'studio';
    return true;
  }

  if (urlView === 'canvas') {
    viewMode.value = 'canvas';
    sidebarFilter.value = 'canvases';
    composerMode.value = 'studio';
    return true;
  }

  // Explicit non-canvas view on /astra — leave chat
  if (urlView && urlView !== 'canvas') {
    viewMode.value = 'chat';
    return false;
  }

  const saved = readPersistedCanvasResume();
  if (!saved) {
    viewMode.value = 'chat';
    return false;
  }

  canvasResumeId.value = saved;
  viewMode.value = 'canvas';
  sidebarFilter.value = 'canvases';
  composerMode.value = 'studio';
  if (urlId !== saved || urlView !== 'canvas') {
    void router.replace({
      path: '/astra',
      query: {
        ...route.query,
        view: 'canvas',
        id: saved,
      },
    });
  }
  return true;
}

const sidebarFilter = ref<SidebarFilter>('all');
const canvasesLoading = ref(false);
const canvasList = ref<CanvasMeta[]>([]);
/** Composer mode on new chat: Astra AI (chat) vs Astra Studio (Living Canvas). */
const composerMode = ref<'ai' | 'studio'>('ai');

const canvasSidebarItems = computed(() =>
  canvasList.value.map((c) => ({
    id: c._id,
    title: c.title || '',
    updatedAt: c.updatedAt,
    createdAt: c.createdAt,
  })),
);

const sidebarActiveId = computed(() => {
  if (viewMode.value === 'canvas') {
    return String(route.query.id || canvasResumeId.value || '');
  }
  return conversationId.value || '';
});

const sidebarActiveKind = computed<'chat' | 'canvas' | null>(() => {
  if (viewMode.value === 'canvas') return 'canvas';
  if (conversationId.value) return 'chat';
  return null;
});

async function refreshCanvasList(): Promise<void> {
  canvasesLoading.value = true;
  try {
    const list = await listCanvases({ limit: 50 });
    const items = list.items || [];
    const openId = String(route.query.id || canvasResumeId.value || '');
    const orphans = items.filter((c) => isUntitledBlankCanvas(c) && c._id !== openId);
    canvasList.value = items.filter((c) => !isUntitledBlankCanvas(c));
    for (const orphan of orphans.slice(0, 10)) {
      void deleteCanvas(orphan._id).catch(() => undefined);
    }
  } catch {
    // keep prior list
  } finally {
    canvasesLoading.value = false;
  }
}

function isUntitledBlankCanvas(c: CanvasMeta): boolean {
  const title = String(c.title || '').trim();
  const untitled = !title || /^untitled canvas$/i.test(title);
  if (!untitled) return false;
  const type = String(c.canvasType || 'blank');
  return type === 'blank' || type === '';
}

function onSidebarFilter(next: SidebarFilter) {
  sidebarFilter.value = next;
  if (next === 'canvases') composerMode.value = 'studio';
  if (next === 'chats') composerMode.value = 'ai';
}

function openCanvasMode(
  seed?: string,
  focus?: { moduleKey?: string; recordId?: string; recordName?: string },
) {
  canvasSeedPrompt.value = seed || '';
  canvasSeedFocus.value = focus?.moduleKey && focus?.recordId ? { ...focus } : null;
  canvasResumeId.value = '';
  clearPersistedCanvasResume();
  canvasSessionKey.value += 1;
  composerMode.value = 'studio';
  sidebarFilter.value = 'canvases';
  viewMode.value = 'canvas';
  const { id: _omitCanvasId, ...restQuery } = route.query;
  void router.replace({ query: { ...restQuery, view: 'canvas' } });
}

function exitCanvasMode() {
  viewMode.value = 'chat';
  canvasSeedPrompt.value = '';
  canvasSeedFocus.value = null;
  canvasResumeId.value = '';
  clearPersistedCanvasResume();
  composerMode.value = 'ai';
  const q = { ...route.query };
  delete q.view;
  delete q.id;
  void router.replace({ query: q });
}

function onSelectCanvas(id: string) {
  canvasSeedPrompt.value = '';
  canvasSeedFocus.value = null;
  canvasResumeId.value = id;
  persistCanvasResume(id);
  canvasSessionKey.value += 1;
  composerMode.value = 'studio';
  sidebarFilter.value = 'canvases';
  viewMode.value = 'canvas';
  void router.replace({
    query: {
      ...route.query,
      view: 'canvas',
      id,
    },
  });
}

function onNewCanvasFromSidebar() {
  // Never create an empty "Untitled canvas" — open Studio composer instead.
  if (viewMode.value === 'canvas') exitCanvasMode();
  composerMode.value = 'studio';
  sidebarFilter.value = 'canvases';
  draft.value = '';
  void nextTick(() => {
    autoGrow();
    inputEl.value?.focus();
  });
}

async function onDeleteCanvas(id: string) {
  try {
    await deleteCanvas(id);
    canvasList.value = canvasList.value.filter((c) => c._id !== id);
    if (viewMode.value === 'canvas' && String(route.query.id || canvasResumeId.value) === id) {
      exitCanvasMode();
    }
  } catch {
    // ignore
  }
}

// Deep-link / refresh / bare /astra: resume last canvas (TabBar + sidebar drop query params).
restoreCanvasSessionIfNeeded();

watch(
  () => route.query.view,
  (v) => {
    if (!isAstraRoute()) return;
    if (v === 'canvas') {
      viewMode.value = 'canvas';
      return;
    }
    // Bare /astra after tab switch — restore; don't wipe keep-alive canvas state.
    if (!v && readPersistedCanvasResume()) {
      restoreCanvasSessionIfNeeded();
      return;
    }
    viewMode.value = 'chat';
  },
);

watch(
  () => String(route.query.id || ''),
  (id) => {
    if (id && (viewMode.value === 'canvas' || route.query.view === 'canvas')) {
      canvasResumeId.value = id;
      persistCanvasResume(id);
      void refreshCanvasList();
    }
  },
);

onActivated(() => {
  restoreCanvasSessionIfNeeded();
});

const draft = ref('');
const messages = ref<CopilotMessage[]>([]);
const conversationId = ref<string | undefined>(undefined);
const conversationTitle = ref('');
const mobileHistoryOpen = ref(false);
const SIDEBAR_OPEN_KEY = 'astra.sidebarDesktopOpen';
const sidebarDesktopOpen = ref(true);
try {
  const stored = localStorage.getItem(SIDEBAR_OPEN_KEY);
  if (stored === '0') sidebarDesktopOpen.value = false;
} catch {
  /* ignore */
}
watch(sidebarDesktopOpen, (open) => {
  try {
    localStorage.setItem(SIDEBAR_OPEN_KEY, open ? '1' : '0');
  } catch {
    /* ignore */
  }
});
const messagesEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLTextAreaElement | null>(null);
const showEmailModal = ref(false);
const emailComposeDraft = ref<EmailComposeDraft | null>(null);
const emailRelatedTo = ref<EmailComposeRelatedTo | null>(null);
const lastAskFocus = ref<{ moduleKey?: string; recordId?: string } | null>(null);
const notifications = useNotifications();

/** Always mount the history rail so the grid does not jump after conversations hydrate. */
const isEmptyLanding = computed(
  () => !messages.value.length && !asking.value,
);
const nbaCards = ref<Array<{
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  moduleKey?: string;
  recordId?: string;
  recordName?: string;
  iconKey?: string;
}>>([]);

onErrorCaptured((err) => {
  console.error('[Astra] render error:', err);
  return false;
});

const firstName = computed(() => {
  const user = authStore.user as { firstName?: string; username?: string; email?: string } | null;
  const raw = String(user?.firstName || '').trim();
  if (raw) return raw;
  const username = String(user?.username || '').trim();
  if (username) return username.split(/[.\s_-]/)[0] || username;
  const email = String(user?.email || '').trim();
  if (email.includes('@')) return email.split('@')[0];
  return '';
});

const greeting = computed(() => {
  const hour = new Date().getHours();
  const name = firstName.value;
  if (hour < 12) return name ? t('astra.greetingMorningNamed', { name }) : t('astra.greetingMorning');
  if (hour < 17) return name ? t('astra.greetingAfternoonNamed', { name }) : t('astra.greetingAfternoon');
  return name ? t('astra.greetingEveningNamed', { name }) : t('astra.greetingEvening');
});

const composerPlaceholder = computed(() => {
  if (isListening.value) return t('astra.voicePlaceholder');
  if (composerMode.value === 'studio') {
    return t('astra.askPromptStudio');
  }
  return firstName.value ? t('astra.askPromptNamed', { name: firstName.value }) : t('astra.askPrompt');
});

const defaultAiHero = computed<HeroSuggestion[]>(() => [
  { id: 'deals', title: t('astra.heroDealsTitle'), subtitle: t('astra.heroDealsSubtitle'), prompt: t('astra.starterOpenDeals'), icon: BriefcaseIcon },
  { id: 'pulse', title: t('astra.heroPulseTitle'), subtitle: t('astra.heroPulseSubtitle'), prompt: t('astra.starterPipelinePulse'), icon: ChartBarIcon },
  { id: 'cases', title: t('astra.heroCasesTitle'), subtitle: t('astra.heroCasesSubtitle'), prompt: t('astra.starterOpenCases'), icon: TicketIcon },
  { id: 'people', title: t('astra.heroPeopleTitle'), subtitle: t('astra.heroPeopleSubtitle'), prompt: t('astra.starterFindContact'), icon: UserIcon },
  { id: 'learning', title: t('astra.heroLearningTitle'), subtitle: t('astra.heroLearningSubtitle'), prompt: t('astra.starterLearningRecommend'), icon: AcademicCapIcon },
]);

const defaultStudioHero = computed<HeroSuggestion[]>(() => [
  {
    id: 'studio-meeting',
    title: t('astra.studioHeroMeetingTitle'),
    subtitle: t('astra.studioHeroMeetingSubtitle'),
    prompt: t('astra.starterLivingCanvas'),
    icon: SparklesIcon,
  },
  {
    id: 'studio-war-room',
    title: t('astra.studioHeroWarRoomTitle'),
    subtitle: t('astra.studioHeroWarRoomSubtitle'),
    prompt: t('astra.starterWarRoom'),
    icon: BriefcaseIcon,
  },
  {
    id: 'studio-360',
    title: t('astra.studioHero360Title'),
    subtitle: t('astra.studioHero360Subtitle'),
    prompt: t('astra.starterCustomer360'),
    icon: UserIcon,
  },
  {
    id: 'studio-qbr',
    title: t('astra.studioHeroQbrTitle'),
    subtitle: t('astra.studioHeroQbrSubtitle'),
    prompt: t('astra.starterQbr'),
    icon: ChartBarIcon,
  },
]);

/** Map live NBA / workload cards → Studio workspace prompts grounded on the same records. */
function studioSuggestionFromNba(card: {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  moduleKey?: string;
  recordId?: string;
  recordName?: string;
  iconKey?: string;
}, index: number): HeroSuggestion | null {
  const moduleKey = String(card.moduleKey || '').toLowerCase();
  const recordName = cleanRecordLabel(card.recordName || card.title);
  if (!recordName) return null;

  const focus = card.recordId
    ? { moduleKey: card.moduleKey, recordId: card.recordId, recordName }
    : undefined;

  if (moduleKey === 'deals' || moduleKey === 'deal') {
    return {
      id: `studio-deal-${card.id || index}`,
      title: t('astra.studioGroundedWarRoomTitle', { name: recordName }),
      subtitle: card.subtitle || t('astra.studioGroundedWarRoomSubtitle'),
      prompt: t('astra.studioGroundedWarRoomPrompt', { name: recordName }),
      moduleKey: focus?.moduleKey,
      recordId: focus?.recordId,
      recordName,
      icon: BriefcaseIcon,
    };
  }
  if (moduleKey === 'cases' || moduleKey === 'case') {
    return {
      id: `studio-case-${card.id || index}`,
      title: t('astra.studioGroundedSupportTitle', { name: recordName }),
      subtitle: card.subtitle || t('astra.studioGroundedSupportSubtitle'),
      prompt: t('astra.studioGroundedSupportPrompt', { name: recordName }),
      moduleKey: focus?.moduleKey,
      recordId: focus?.recordId,
      recordName,
      icon: TicketIcon,
    };
  }
  if (moduleKey === 'quotes' || moduleKey === 'quote') {
    return {
      id: `studio-quote-${card.id || index}`,
      title: t('astra.studioGroundedQuoteTitle', { name: recordName }),
      subtitle: card.subtitle || t('astra.studioGroundedQuoteSubtitle'),
      prompt: t('astra.studioGroundedQuotePrompt', { name: recordName }),
      moduleKey: focus?.moduleKey,
      recordId: focus?.recordId,
      recordName,
      icon: ChartBarIcon,
    };
  }
  if (moduleKey === 'tasks' || moduleKey === 'task') {
    return {
      id: `studio-task-${card.id || index}`,
      title: t('astra.studioGroundedTaskTitle', { name: recordName }),
      subtitle: card.subtitle || t('astra.studioGroundedTaskSubtitle'),
      prompt: t('astra.studioGroundedTaskPrompt', { name: recordName }),
      moduleKey: focus?.moduleKey,
      recordId: focus?.recordId,
      recordName,
      icon: SparklesIcon,
    };
  }
  if (
    moduleKey === 'organizations'
    || moduleKey === 'organization'
    || moduleKey === 'people'
    || moduleKey === 'person'
  ) {
    return {
      id: `studio-acct-${card.id || index}`,
      title: t('astra.studioGrounded360Title', { name: recordName }),
      subtitle: card.subtitle || t('astra.studioGrounded360Subtitle'),
      prompt: t('astra.studioGrounded360Prompt', { name: recordName }),
      moduleKey: focus?.moduleKey,
      recordId: focus?.recordId,
      recordName,
      icon: UserIcon,
    };
  }

  // Generic but still named to the user's card
  return {
    id: `studio-nba-${card.id || index}`,
    title: t('astra.studioGroundedGenericTitle', { name: recordName }),
    subtitle: card.subtitle || t('astra.studioGroundedGenericSubtitle'),
    prompt: t('astra.studioGroundedGenericPrompt', { name: recordName }),
    moduleKey: focus?.moduleKey,
    recordId: focus?.recordId,
    recordName,
    icon: resolveAstraNbaIcon({
      iconKey: card.iconKey,
      moduleKey: card.moduleKey,
      title: card.title,
      label: card.title,
    }),
  };
}

function cleanRecordLabel(raw: string): string {
  return String(raw || '')
    .replace(/^(Clear overdue:\s*|Revive\s+|Unblock\s+|Advance\s+|Triage:\s*)/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
}

const heroSuggestions = computed(() => {
  if (composerMode.value === 'studio') {
    const grounded: HeroSuggestion[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < nbaCards.value.length; i += 1) {
      const card = nbaCards.value[i];
      if (!card) continue;
      const mapped = studioSuggestionFromNba(card, i);
      if (!mapped) continue;
      const key = `${mapped.moduleKey || ''}:${mapped.recordId || mapped.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      grounded.push(mapped);
      if (grounded.length >= 4) break;
    }
    // Prefer live grounded cards; only fall back to generics when NBA is empty
    if (grounded.length) return grounded;
    return defaultStudioHero.value;
  }
  if (!nbaCards.value.length) return defaultAiHero.value;
  return nbaCards.value.slice(0, 4).map((card, index) => ({
    id: card.id || `nba-${index}`,
    title: card.title,
    subtitle: card.subtitle || t('astra.heroPersonalizedSubtitle'),
    prompt: card.prompt,
    moduleKey: card.moduleKey,
    recordId: card.recordId,
    recordName: card.recordName || card.title,
    icon: resolveAstraNbaIcon({
      iconKey: card.iconKey,
      moduleKey: card.moduleKey,
      title: card.title,
      label: card.title,
    }),
  }));
});

type ConversationGroupId = 'today' | 'yesterday' | 'week' | 'month' | 'older';

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function groupIdForDate(value?: string | null): ConversationGroupId {
  if (!value) return 'older';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return 'older';
  const today = startOfLocalDay(new Date());
  const day = startOfLocalDay(new Date(ts));
  const diffDays = Math.round((today - day) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return 'week';
  if (diffDays < 30) return 'month';
  return 'older';
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
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
}

async function ask(text: string, focus: {
  moduleKey?: string;
  recordId?: string;
  recordName?: string;
} = {}) {
  const prompt = text.trim();
  if (!prompt || asking.value) return;
  if (focus.moduleKey || focus.recordId) {
    lastAskFocus.value = { moduleKey: focus.moduleKey, recordId: focus.recordId };
  }
  messages.value.push({ id: `u-${Date.now()}`, role: 'user', body: prompt });
  await scrollToEnd();
  const result = await askSync(prompt, {
    conversationId: conversationId.value,
    history: historyForAsk().slice(0, -1),
    moduleKey: focus.moduleKey,
    recordId: focus.recordId,
    recordName: focus.recordName,
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
  const text = draft.value.trim();
  draft.value = '';
  await nextTick();
  autoGrow();
  if (!text) return;
  if (composerMode.value === 'studio') {
    openCanvasMode(text);
    return;
  }
  await ask(text);
}

function onMicClick() {
  if (asking.value) return;
  if (isListening.value) {
    void toggleListening();
    return;
  }
  voiceDraftBaseline.value = draft.value;
  captureAstraVoiceStarted({ surface: 'copilot' });
  void toggleListening({
    onTranscript: (text) => {
      draft.value = text;
      void nextTick(() => autoGrow());
    },
    onEnd: ({ text, reason }) => {
      if (reason === 'commit' && text.trim()) {
        draft.value = text.trim();
        captureAstraVoiceCommitted({
          surface: 'copilot',
          promptLength: text.trim().length,
        });
        void onSend();
        return;
      }
      draft.value = voiceDraftBaseline.value;
      void nextTick(() => autoGrow());
      captureAstraVoiceCancelled({ surface: 'copilot', reason });
    },
  });
}

function onSpeakAnswer(msg: CopilotMessage) {
  const body = String(msg.body || '').trim();
  if (!body) return;
  if (speakingMessageId.value === msg.id && speaking.value) {
    stopSpeaking();
    return;
  }
  captureAstraTtsPlayed({ surface: 'copilot' });
  speakAnswer(msg.id, body);
}

async function onSuggestion(suggestion: string | AstraSuggestion | {
  prompt?: string;
  moduleKey?: string;
  recordId?: string;
  recordName?: string;
  title?: string;
  label?: string;
  id?: string;
}) {
  if (typeof suggestion === 'string') {
    const parsed = tryParseSuggestionJson(suggestion);
    if (parsed) {
      if (isCanvasIntent(parsed.prompt)) {
        openCanvasMode(parsed.prompt);
        return;
      }
      await ask(parsed.prompt, {});
      return;
    }
    if (isCanvasIntent(suggestion)) {
      openCanvasMode(suggestion);
      return;
    }
    await ask(suggestion);
    return;
  }
  const row = suggestion as {
    id?: string;
    prompt?: string;
    label?: string;
    title?: string;
    moduleKey?: string;
    recordId?: string;
    recordName?: string;
  };
  const prompt = String(row.prompt || row.label || row.title || '').trim();
  if (!prompt) return;
  if (row.id === 'canvas-meeting' || row.id?.startsWith('studio-') || isCanvasIntent(prompt)) {
    openCanvasMode(prompt, {
      moduleKey: row.moduleKey,
      recordId: row.recordId,
      recordName: row.recordName || row.title || row.label,
    });
    return;
  }
  await ask(prompt, {
    moduleKey: row.moduleKey,
    recordId: row.recordId,
    recordName: row.recordName || row.title || row.label,
  });
}

function isCanvasIntent(text: string): boolean {
  return /\b(living\s+canvas|meeting\s+prep|prepare\s+(me\s+)?for|war\s*room|customer\s*360|account\s+plan|qbr)\b/i.test(
    String(text || ''),
  );
}

function tryParseSuggestionJson(raw: string): { label: string; prompt: string } | null {
  const text = String(raw || '').trim();
  if (!text.startsWith('{')) return null;
  try {
    const obj = JSON.parse(text) as { label?: unknown; prompt?: unknown };
    const label = String(obj.label || '').trim();
    const prompt = String(obj.prompt || obj.label || '').trim();
    if (!label && !prompt) return null;
    return { label: label || prompt, prompt: prompt || label };
  } catch {
    return null;
  }
}

function isOverrideProposal(proposal: { label?: string } | null | undefined): boolean {
  return /override/i.test(String(proposal?.label || ''));
}

function openComposeDrawer(detail: OpenEmailComposeDetail) {
  emailComposeDraft.value = {
    to: detail.to || '',
    subject: detail.subject || '',
    body: detail.body || '',
    ...(detail.cc ? { cc: detail.cc } : {}),
    ...(detail.bcc ? { bcc: detail.bcc } : {}),
  };
  emailRelatedTo.value = detail.relatedTo || null;
  showEmailModal.value = true;
}

function closeEmailCompose() {
  showEmailModal.value = false;
  emailComposeDraft.value = null;
  emailRelatedTo.value = null;
}

async function handleEmailSubmit(payload: Record<string, unknown>) {
  closeEmailCompose();
  try {
    const res = await apiClient.post('/communications/email', payload);
    if (res?.success) {
      notifications.success(t('records.genericEmailSent'));
      messages.value.push({
        id: `a-email-${Date.now()}`,
        role: 'assistant',
        body: t('records.genericEmailSent'),
      });
      await scrollToEnd();
    } else {
      notifications.error(res?.message || t('records.genericEmailSendFailed'));
    }
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
    const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message;
    notifications.error(msg || t('records.genericEmailSendFailed'));
  }
}

function onOpenEmailComposeEvent(event: Event) {
  const detail = (event as CustomEvent<OpenEmailComposeDetail>).detail;
  if (!detail || typeof detail !== 'object') return;
  openComposeDrawer(detail);
}

async function onConfirmProposal(messageId: string, proposal: AstraProposal) {
  if (isEmailSendProposal(proposal)) {
    const detail = openEmailComposeFromAstra(proposal, { relatedTo: lastAskFocus.value });
    openComposeDrawer(detail);
    messages.value = messages.value.map((m) => {
      if (m.id !== messageId) return m;
      return {
        ...m,
        proposals: (m.proposals || []).map((p) => {
          if (p.id !== proposal.id) return p;
          return { ...p, status: 'completed', rationale: t('astra.emailOpenedInCompose') };
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
  const result = await confirmProposal(
    proposal,
    { conversationId: conversationId.value },
  );
  if (!result.ok) return;
  messages.value = messages.value.map((m) => {
    if (m.id !== messageId) return m;
    return {
      ...m,
      proposals: (m.proposals || []).map((p) => {
        if (p.id !== proposal.id) return p;
        return {
          ...p,
          status: 'completed',
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

function onNavigateProposal(href: string) {
  const path = String(href || '').trim();
  if (!path) return;
  void router.push(path);
}

function onDismissProposal(messageId: string, proposalId: string) {
  messages.value = messages.value.map((m) => {
    if (m.id !== messageId) return m;
    return {
      ...m,
      proposals: (m.proposals || []).filter((p) => p.id !== proposalId),
    };
  });
}

function onNewChat() {
  if (viewMode.value === 'canvas') exitCanvasMode();
  sidebarFilter.value = 'chats';
  composerMode.value = 'ai';
  messages.value = [];
  conversationId.value = undefined;
  conversationTitle.value = '';
  error.value = '';
  draft.value = '';
  mobileHistoryOpen.value = false;
  lastAskFocus.value = null;
  void nextTick(() => {
    autoGrow();
    inputEl.value?.focus();
  });
}

async function onSelectConversation(id: string) {
  if (!id || asking.value) return;
  if (viewMode.value === 'canvas') exitCanvasMode();
  sidebarFilter.value = 'chats';
  composerMode.value = 'ai';
  try {
    const detail = await loadOne(id);
    if (!detail) return;
    conversationId.value = detail.id;
    conversationTitle.value = detail.title || '';
    messages.value = (detail.messages || []).map((m, index) => ({
      id: m.id || `m-${index}`,
      role: m.role === 'assistant' ? 'assistant' : 'user',
      body: String(m.body || ''),
      blocks: Array.isArray(m.blocks) ? (m.blocks as AstraUiBlock[]) : [],
      proposals: Array.isArray(m.proposals)
        ? (m.proposals as AstraProposal[]).map((p) => ({
          ...p,
          status: p.status === 'completed' ? 'completed' : 'pending',
        }))
        : [],
      suggestions: Array.isArray(m.suggestions) ? (m.suggestions as AstraSuggestion[]) : [],
      href: m.navigate?.href,
      navigateLabel: m.navigate?.label,
    }));
  } catch (err) {
    console.error('[Astra] failed to load conversation', err);
    error.value = t('astra.failGeneric');
  }
  await nextTick();
  await scrollToEnd();
}

async function onDeleteConversation(id: string) {
  const ok = await removeConversation(id);
  if (!ok) return;
  if (conversationId.value === id) onNewChat();
}

function onLoadMoreHistory() {
  void loadMoreHistory();
}

async function onClearOlder() {
  const beforeIds = new Set(
    conversations.value
      .filter((c) => groupIdForDate(c.updatedAt || c.createdAt) !== 'today')
      .map((c) => c.id),
  );
  await clearConversations('older');
  if (conversationId.value && beforeIds.has(conversationId.value)) onNewChat();
}

onMounted(async () => {
  window.addEventListener(ARIVU_OPEN_EMAIL_COMPOSE, onOpenEmailComposeEvent as EventListener);
  void refreshCanvasList();
  await Promise.all([
    refreshHistory().then(async () => {
      // Retry wipe until older threads are gone (v1 flag could stick after a failed bulk delete).
      const flag = 'astra.clearedOlder.v2';
      try {
        if (localStorage.getItem(flag) === '1') return;
      } catch {
        /* ignore */
      }
      await onClearOlder();
      const stillOlder = conversations.value.some(
        (c) => groupIdForDate(c.updatedAt || c.createdAt) !== 'today',
      );
      if (!stillOlder) {
        try {
          localStorage.setItem(flag, '1');
        } catch {
          /* ignore */
        }
      }
    }),
    fetchNba({ surface: 'home' }).then((nba) => {
      type NbaCard = {
        id: string;
        title: string;
        subtitle: string;
        prompt: string;
        moduleKey?: string;
        recordId?: string;
        recordName?: string;
        iconKey?: string;
      };
      const cards: NbaCard[] = [];
      for (let index = 0; index < nba.length; index += 1) {
        const item = nba[index];
        if (!item) continue;
        const title = String(item.label || item.prompt || '').trim();
        const prompt = String(item.prompt || item.label || '').trim();
        if (!title || !prompt) continue;
        cards.push({
          id: item.id || `nba-${index}`,
          title,
          subtitle: String(item.rationale || '').trim() || t('astra.heroPersonalizedSubtitle'),
          prompt,
          moduleKey: item.moduleKey || undefined,
          recordId: item.recordId || undefined,
          recordName: title,
          iconKey: item.iconKey || undefined,
        });
        if (cards.length >= 6) break;
      }
      nbaCards.value = cards;
    }),
  ]);
  const seedPrompt = String(route.query.prompt || '').trim();
  if (seedPrompt) {
    const { prompt: _omitPrompt, ...restQuery } = route.query;
    void router.replace({ path: '/astra', query: restQuery });
    await ask(seedPrompt, { moduleKey: 'learning' });
  }
  inputEl.value?.focus();
});

onBeforeUnmount(() => {
  window.removeEventListener(ARIVU_OPEN_EMAIL_COMPOSE, onOpenEmailComposeEvent as EventListener);
});

watch(draft, () => {
  void nextTick(autoGrow);
});
</script>

<style scoped>
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
  /* Clip shine to logo silhouette only */
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
