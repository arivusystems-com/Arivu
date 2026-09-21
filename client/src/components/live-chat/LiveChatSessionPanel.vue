<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-gray-900">
    <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-800 sm:px-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex min-w-0 items-start gap-3">
          <div class="relative shrink-0">
            <AvatarInitials
              :first-name="visitorFirstName"
              :last-name="visitorLastName"
              :email="sessionMeta?.visitor?.email || props.session?.visitor?.email"
              size="md"
            />
            <span
              class="absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-white dark:ring-gray-900"
              :class="visitorOnline ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-gray-500'"
              aria-hidden="true"
            />
          </div>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ visitorTitle }}
            </p>
            <p v-if="visitorHeaderSubtitle" class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
              {{ visitorHeaderSubtitle }}
            </p>
            <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
              <span>{{ chatStartedLabel }}</span>
              <span v-if="sessionOpen" class="font-mono text-gray-600 dark:text-gray-300">{{ chatElapsed }}</span>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <span
            v-if="lifecycleLabel"
            class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            {{ lifecycleLabel }}
          </span>
          <BadgeCell
            v-if="visitorTypeLabel"
            :value="visitorTypeLabel"
            variant="info"
          />
          <BadgeCell
            v-if="priorityLabel"
            :value="priorityLabel"
            :variant="priorityBadgeVariant"
          />
          <button
            v-if="canClaimSession"
            type="button"
            class="rounded-lg border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
            :disabled="claimingSession"
            @click="claimSession"
          >
            {{ t('liveChat.claimSession') }}
          </button>
          <button
            v-if="canTransferSession"
            type="button"
            class="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            :disabled="transferringSession"
            @click="openTransferDialog"
          >
            {{ t('liveChat.transferSession') }}
          </button>
          <RouterLink
            v-if="linkedCaseRoute"
            :to="linkedCaseRoute"
            class="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {{ t('liveChat.openLinkedCase') }}
          </RouterLink>
          <button
            v-if="helpdeskEnabled && canHandleSession && sessionOpen && !hasLinkedCase"
            type="button"
            class="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            :disabled="linkingCase"
            @click="openLinkCaseDialog"
          >
            {{ t('liveChat.linkCase') }}
          </button>
          <button
            v-if="helpdeskEnabled && canHandleSession && sessionOpen && !hasLinkedCase"
            type="button"
            class="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            :disabled="creatingCase"
            @click="createHelpdeskCase"
          >
            {{ t('liveChat.createCase') }}
          </button>
          <button
            v-if="salesEnabled && canHandleSession && sessionOpen && !hasLinkedPerson"
            type="button"
            class="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            :disabled="linkingPerson"
            @click="openLinkPersonDialog"
          >
            {{ t('liveChat.linkPerson') }}
          </button>
          <button
            v-if="salesEnabled && canHandleSession && sessionOpen && !hasLinkedPerson"
            type="button"
            class="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            :disabled="creatingLead"
            @click="createSalesLead"
          >
            {{ t('liveChat.createLead') }}
          </button>
          <button
            v-if="canHandleSession && sessionOpen"
            type="button"
            class="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
            @click="openEndSessionDialog"
          >
            {{ t('liveChat.endSession') }}
          </button>
        </div>
      </div>
    </div>

    <div ref="scrollRef" class="min-h-0 flex-1 space-y-3 overflow-y-auto bg-gray-50 px-4 py-4 dark:bg-neutral-950 sm:px-6">
      <div v-if="loading" class="py-6 text-sm text-gray-500 dark:text-gray-400">
        {{ t('liveChat.loadingMessages') }}
      </div>
      <div v-else-if="error" class="py-6 text-sm text-rose-600 dark:text-rose-300">{{ error }}</div>
      <template v-else>
        <div v-if="!messages.length" class="py-6 text-sm text-gray-500 dark:text-gray-400">
          {{ t('liveChat.noMessagesYet') }}
        </div>

        <template v-for="m in messages" :key="m._id">
          <div
            v-if="isSystemMessage(m)"
            class="flex justify-center"
          >
            <p class="rounded-full bg-gray-200/80 px-3 py-1 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {{ m.body || '—' }}
            </p>
          </div>
          <div
            v-else
            class="flex"
            :class="m.direction === 'inbound' ? '' : 'justify-end'"
          >
            <div
              class="max-w-[min(100%,42rem)] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm shadow-sm"
              :class="messageBubbleClass(m)"
            >
              <p v-if="m.direction === 'inbound'" class="mb-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                {{ m.authorName || t('liveChat.visitor') }}
              </p>
              <p
                v-else-if="!isInternalNote(m)"
                class="mb-1 text-[11px] font-medium"
                :class="isBotMessage(m) ? 'text-indigo-200' : 'text-teal-100'"
              >
                {{ outboundAuthorLabel(m) }}
              </p>
              <p>{{ m.body || '—' }}</p>
              <ul v-if="messageAttachments(m).length" class="mt-2 space-y-1">
                <li v-for="(att, attIdx) in messageAttachments(m)" :key="`${m._id}-att-${attIdx}`">
                  <a
                    :href="attachmentHref(att)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 rounded-md bg-black/5 px-2 py-1 text-xs underline dark:bg-white/10"
                    :class="m.direction === 'outbound' && !isInternalNote(m) ? 'text-white/95' : 'text-indigo-700 dark:text-indigo-300'"
                  >
                    <PaperClipIcon class="h-3 w-3 shrink-0" />
                    <span class="truncate">{{ att.fileName || t('liveChat.composerAttachment') }}</span>
                  </a>
                </li>
              </ul>
              <div class="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                <span>{{ formatTime(m.createdAt) }}</span>
                <ChatMessageReceiptIcon
                  v-if="m.direction === 'outbound'"
                  :status="receiptStatus(m)"
                  size="sm"
                />
              </div>
            </div>
          </div>
        </template>

        <div
          v-if="typingLabel"
          class="flex items-center gap-2 px-1 py-1 text-xs text-gray-500 dark:text-gray-400"
          aria-live="polite"
        >
          <span class="inline-flex gap-0.5" aria-hidden="true">
            <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms] dark:bg-gray-500" />
            <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms] dark:bg-gray-500" />
            <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms] dark:bg-gray-500" />
          </span>
          <span>{{ typingLabel }}</span>
        </div>
      </template>
    </div>

    <div
      v-if="isAssignedToOther && sessionOpen"
      class="border-t border-gray-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-gray-800 dark:bg-amber-950/40 dark:text-amber-200 sm:px-6"
    >
      {{ t('liveChat.sessionAssignedViewOnly', { agent: assignedAgentDisplayName || t('liveChat.agent') }) }}
    </div>

    <div
      v-else-if="canHandleSession && !sessionOpen"
      class="border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300 sm:px-6"
    >
      {{ t('liveChat.sessionClosedHint') }}
    </div>

    <div
      v-else-if="canHandleSession && sessionOpen"
      class="shrink-0 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 sm:px-6"
    >
      <LiveChatMessageComposer
        v-model="replyBody"
        v-model:composer-mode="composerMode"
        :send-message="sendReplyPayload"
        :error="sendError"
        :visitor="sessionMeta?.visitor || props.session?.visitor || null"
        :reply-placeholder="t('liveChat.replyPlaceholder')"
        :note-placeholder="t('liveChat.notePlaceholder')"
        @typing="pingTyping"
        @send-error="onComposerSendError"
      />
    </div>
  </div>

  <div
    v-if="endDialogOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    role="dialog"
    aria-modal="true"
    :aria-label="t('liveChat.endSession')"
  >
    <div class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('liveChat.endSessionTitle') }}</h3>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('liveChat.endSessionDesc') }}</p>
      <label class="mt-4 block text-xs font-medium text-gray-600 dark:text-gray-300">
        {{ t('liveChat.outcomeLabel') }}
        <select
          v-model="selectedOutcome"
          class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="" disabled>{{ t('liveChat.selectOutcome') }}</option>
          <option v-for="row in outcomes" :key="row.key" :value="row.key">
            {{ outcomeLabel(row) }}
          </option>
        </select>
      </label>
      <label class="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-300">
        {{ t('liveChat.fieldSummary') }}
        <textarea
          v-model="endSessionSummary"
          rows="3"
          class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          :placeholder="t('liveChat.fieldSummaryPlaceholder')"
        />
      </label>
      <label class="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-300">
        {{ t('liveChat.fieldTags') }}
        <input
          v-model="endSessionTagsInput"
          type="text"
          class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          :placeholder="t('liveChat.fieldTagsPlaceholder')"
        />
      </label>
      <p v-if="loadingOutcomes" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {{ t('liveChat.loadingOutcomes') }}
      </p>
      <p v-else-if="endSessionError" class="mt-2 text-xs text-rose-600 dark:text-rose-300">{{ endSessionError }}</p>
      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
          @click="closeEndSessionDialog"
        >
          {{ t('actions.cancel') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="!selectedOutcome || endingSession || loadingOutcomes"
          @click="confirmEndSession"
        >
          {{ endingSession ? t('states.saving') : t('liveChat.endSessionConfirmAction') }}
        </button>
      </div>
    </div>
  </div>

  <div
    v-if="linkCaseDialogOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    role="dialog"
    aria-modal="true"
    :aria-label="t('liveChat.linkCaseTitle')"
  >
    <div class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('liveChat.linkCaseTitle') }}</h3>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('liveChat.linkCaseDesc') }}</p>
      <label class="mt-4 block text-xs font-medium text-gray-600 dark:text-gray-300">
        {{ t('liveChat.linkCaseIdLabel') }}
        <input
          v-model.trim="linkCaseIdInput"
          type="text"
          class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          :placeholder="t('liveChat.linkCaseIdPlaceholder')"
        />
      </label>
      <p v-if="linkCaseError" class="mt-2 text-xs text-rose-600 dark:text-rose-300">{{ linkCaseError }}</p>
      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
          @click="closeLinkCaseDialog"
        >
          {{ t('actions.cancel') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="linkingCase || !linkCaseIdInput"
          @click="confirmLinkCase"
        >
          {{ linkingCase ? t('liveChat.linking') : t('liveChat.linkCaseConfirm') }}
        </button>
      </div>
    </div>
  </div>

  <div
    v-if="linkPersonDialogOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    role="dialog"
    aria-modal="true"
    :aria-label="t('liveChat.linkPersonTitle')"
  >
    <div class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('liveChat.linkPersonTitle') }}</h3>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('liveChat.linkPersonDesc') }}</p>
      <label class="mt-4 block text-xs font-medium text-gray-600 dark:text-gray-300">
        {{ t('liveChat.linkPersonIdLabel') }}
        <input
          v-model.trim="linkPersonIdInput"
          type="text"
          class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          :placeholder="t('liveChat.linkPersonIdPlaceholder')"
        />
      </label>
      <p v-if="linkPersonError" class="mt-2 text-xs text-rose-600 dark:text-rose-300">{{ linkPersonError }}</p>
      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
          @click="closeLinkPersonDialog"
        >
          {{ t('actions.cancel') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="linkingPerson || !linkPersonIdInput"
          @click="confirmLinkPerson"
        >
          {{ linkingPerson ? t('liveChat.linking') : t('liveChat.linkPersonConfirm') }}
        </button>
      </div>
    </div>
  </div>

  <div
    v-if="transferDialogOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    role="dialog"
    aria-modal="true"
    :aria-label="t('liveChat.transferSessionTitle')"
  >
    <div class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('liveChat.transferSessionTitle') }}</h3>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('liveChat.transferSessionDesc') }}</p>
      <label class="mt-4 block text-xs font-medium text-gray-600 dark:text-gray-300">
        {{ t('liveChat.transferAgentLabel') }}
        <select
          v-model="transferAgentId"
          class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          :disabled="loadingTransferAgents || transferringSession"
        >
          <option value="" disabled>{{ t('liveChat.transferAgentPlaceholder') }}</option>
          <option
            v-for="agent in transferAgentOptions"
            :key="agent._id"
            :value="agent._id"
          >
            {{ agent.label }}
          </option>
        </select>
      </label>
      <p v-if="loadingTransferAgents" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {{ t('liveChat.loadingTransferAgents') }}
      </p>
      <p v-if="transferError" class="mt-2 text-xs text-rose-600 dark:text-rose-300">{{ transferError }}</p>
      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
          @click="closeTransferDialog"
        >
          {{ t('actions.cancel') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="transferringSession || !transferAgentId || loadingTransferAgents"
          @click="confirmTransferSession"
        >
          {{ transferringSession ? t('liveChat.transferring') : t('liveChat.transferSessionConfirm') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { PaperClipIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { getApiUrlForEventSource } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';
import AvatarInitials from '@/components/ui/AvatarInitials.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import ChatMessageReceiptIcon from '@/components/cases/ChatMessageReceiptIcon.vue';
import LiveChatMessageComposer from '@/components/live-chat/LiveChatMessageComposer.vue';
import {
  liveChatAttachmentHref,
  uploadLiveChatMessageAttachment,
} from '@/utils/liveChatAttachmentUpload';
import {
  applyReceiptPatch,
  receiptStatusFromMessage,
} from '@/utils/chatMessageReceipt';
import { formatLiveChatElapsed } from '@/utils/liveChatRelativeTime';
import { formatTime } from '@/utils/localeFormat';
import {
  liveChatVisitorTypeLabel,
  liveChatSessionPriorityLabel,
  liveChatSessionPriorityBadgeVariant,
  liveChatAgentLabel,
} from '@/utils/liveChatSessionDisplay';
import { canHandleLiveChatSession, canTransferLiveChatSession } from '@/utils/liveChatPermissions';

const props = defineProps({
  sessionId: { type: String, required: true },
  session: { type: Object, default: null },
  canReply: { type: Boolean, default: true },
});

const emit = defineEmits(['session-ended']);

const { t } = useI18n();
const authStore = useAuthStore();

const loading = ref(false);
const error = ref('');
const sendError = ref('');
const messages = ref([]);
const sessionMeta = ref(null);
const scrollRef = ref(null);
const typingLabel = ref('');
const replyBody = ref('');
const composerMode = ref('reply');
const outcomes = ref([]);
const selectedOutcome = ref('');
const endDialogOpen = ref(false);
const endingSession = ref(false);
const endSessionError = ref('');
const endSessionSummary = ref('');
const endSessionTagsInput = ref('');
const loadingOutcomes = ref(false);
const creatingCase = ref(false);
const linkingCase = ref(false);
const creatingLead = ref(false);
const linkingPerson = ref(false);
const claimingSession = ref(false);
const transferringSession = ref(false);
const transferDialogOpen = ref(false);
const transferAgentId = ref('');
const transferAgents = ref([]);
const loadingTransferAgents = ref(false);
const transferError = ref('');
const linkedCaseId = ref(null);
const linkedPersonId = ref(null);
const linkCaseDialogOpen = ref(false);
const linkCaseIdInput = ref('');
const linkCaseError = ref('');
const linkPersonDialogOpen = ref(false);
const linkPersonIdInput = ref('');
const linkPersonError = ref('');

let loadGeneration = 0;
let elapsedTimer = null;
const nowTick = ref(Date.now());

const currentUserId = computed(() => String(authStore.user?._id || ''));
const helpdeskEnabled = computed(() => authStore.hasAppAccess('HELPDESK'));
const salesEnabled = computed(() => authStore.hasAppAccess('SALES'));

const assignedAgentId = computed(() => {
  const id = sessionMeta.value?.assignedAgentId || props.session?.assignedAgentId;
  return id ? String(id) : '';
});

const sessionForOwnership = computed(() => ({
  ...(props.session || {}),
  ...(sessionMeta.value || {}),
}));

const canHandleSession = computed(() => {
  if (!props.canReply || !sessionOpen.value) return false;
  return canHandleLiveChatSession(authStore.user, sessionForOwnership.value);
});

const isAssignedToOther = computed(() => {
  if (!assignedAgentId.value) return false;
  return assignedAgentId.value !== String(currentUserId.value || '');
});

const assignedAgentDisplayName = computed(() => {
  const agent = sessionMeta.value?.assignedAgent || props.session?.assignedAgent;
  const name = String(agent?.displayName || '').trim()
    || [agent?.firstName, agent?.lastName].filter(Boolean).join(' ').trim()
    || String(agent?.email || '').trim();
  return name || liveChatAgentLabel(agent, t);
});

const canClaimSession = computed(() => {
  if (!props.canReply || !sessionOpen.value) return false;
  if (assignedAgentId.value) return false;
  const lifecycle = String(sessionMeta.value?.lifecycleStatus || props.session?.lifecycleStatus || 'waiting');
  return lifecycle === 'waiting' || lifecycle === 'assigned';
});

const canTransferSession = computed(() => {
  if (!canHandleSession.value || !sessionOpen.value) return false;
  const session = sessionForOwnership.value;
  return canTransferLiveChatSession(authStore.user, session);
});

const transferAgentOptions = computed(() => {
  const assignedId = assignedAgentId.value;
  return transferAgents.value
    .filter((user) => String(user?._id || '') !== assignedId)
    .map((user) => ({
      _id: String(user._id),
      label: formatAgentOptionLabel(user),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
});

const linkedCaseRoute = computed(() => {
  const id = linkedCaseId.value || resolveLinkedCaseIdFromRecords();
  if (!id) return null;
  return { name: 'helpdesk-cases-detail', params: { id: String(id) } };
});

const hasLinkedCase = computed(() => Boolean(linkedCaseRoute.value));

const linkedPersonRoute = computed(() => {
  const id = linkedPersonId.value || resolveLinkedPersonIdFromRecords();
  if (!id) return null;
  return { name: 'person-detail', params: { id: String(id) } };
});

const hasLinkedPerson = computed(() => Boolean(linkedPersonRoute.value));

let es = null;
let markReadTimer = null;
let typingTimer = null;
let typingAbortController = null;
let typingClearTimer = null;
let streamPollTimer = null;
let streamReconnectTimer = null;
let streamAttempt = 0;

const STREAM_POLL_MS = 2500;
const MAX_STREAM_RECONNECTS = 5;

const sessionOpen = computed(() => String(sessionMeta.value?.status || 'open') !== 'closed');

const sessionKeyLabel = computed(() => {
  const key = String(sessionMeta.value?.sessionKey || props.session?.sessionKey || '').trim();
  return key || '';
});

const visitorTitle = computed(() => {
  const v = sessionMeta.value?.visitor || props.session?.visitor || {};
  const name = String(v.name || '').trim();
  return name || t('liveChat.visitor');
});

const visitorFirstName = computed(() => {
  const name = visitorTitle.value;
  if (!name || name === t('liveChat.visitor')) return '';
  return name.split(/\s+/)[0] || '';
});

const visitorLastName = computed(() => {
  const name = visitorTitle.value;
  if (!name || name === t('liveChat.visitor')) return '';
  const parts = name.split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
});

const visitorOnline = computed(() => sessionOpen.value);

const visitorHeaderSubtitle = computed(() => {
  const v = sessionMeta.value?.visitor || props.session?.visitor || {};
  const parts = [];
  const returning = v.email || v.externalId;
  if (returning) parts.push(t('liveChat.returningVisitor'));
  const pageUrl = String(sessionMeta.value?.pageUrl || props.session?.pageUrl || '').trim();
  if (pageUrl) {
    try {
      parts.push(new URL(pageUrl).pathname || pageUrl);
    } catch {
      parts.push(pageUrl);
    }
  } else if (v.email) {
    parts.push(v.email);
  }
  return parts.join(' · ');
});

const chatStartedAt = computed(() =>
  sessionMeta.value?.createdAt || props.session?.createdAt || null,
);

const chatStartedLabel = computed(() => {
  if (!chatStartedAt.value) return '';
  try {
    const time = formatTime(chatStartedAt.value, {
      hour: 'numeric',
      minute: '2-digit',
    });
    return t('liveChat.chatStartedAt', { time });
  } catch {
    return '';
  }
});

const chatElapsed = computed(() => formatLiveChatElapsed(chatStartedAt.value, nowTick.value));

const visitorSubtitle = computed(() => {
  const v = sessionMeta.value?.visitor || props.session?.visitor || {};
  const email = String(v.email || '').trim();
  const pageUrl = String(sessionMeta.value?.pageUrl || props.session?.pageUrl || '').trim();
  return email || pageUrl || '';
});

const lifecycleLabel = computed(() => {
  const lifecycle = String(sessionMeta.value?.lifecycleStatus || props.session?.lifecycleStatus || '').trim();
  if (!lifecycle) return '';
  return t(`liveChat.lifecycle.${lifecycle}`, lifecycle);
});

const visitorTypeLabel = computed(() => liveChatVisitorTypeLabel(
  sessionMeta.value?.visitorType || props.session?.visitorType,
  t,
));

const priorityLabel = computed(() => liveChatSessionPriorityLabel(
  sessionMeta.value?.priority || props.session?.priority,
  t,
));

const priorityBadgeVariant = computed(() => liveChatSessionPriorityBadgeVariant(
  sessionMeta.value?.priority || props.session?.priority,
));

const sessionOutcomeLabel = computed(() => {
  const key = String(sessionMeta.value?.outcome || props.session?.outcome || '').trim();
  if (!key) return '';
  return outcomeLabel({ key, label: key });
});

function resolveLinkedCaseIdFromRecords() {
  const records = sessionMeta.value?.linkedRecords || props.session?.linkedRecords || [];
  const row = records.find((entry) => String(entry?.moduleKey || '').toLowerCase() === 'cases');
  return row?.recordId ? String(row.recordId) : '';
}

function resolveLinkedPersonIdFromRecords() {
  const records = sessionMeta.value?.linkedRecords || props.session?.linkedRecords || [];
  const row = records.find((entry) => String(entry?.moduleKey || '').toLowerCase() === 'people');
  return row?.recordId ? String(row.recordId) : '';
}

function syncLinkedCaseFromMeta() {
  linkedCaseId.value = resolveLinkedCaseIdFromRecords() || null;
}

function syncLinkedPersonFromMeta() {
  linkedPersonId.value = resolveLinkedPersonIdFromRecords() || null;
}

function receiptStatus(message) {
  return receiptStatusFromMessage(message);
}

function isSystemMessage(message) {
  return String(message?.authorType || '') === 'system';
}

function isInternalNote(message) {
  return String(message?.body || '').startsWith('[Note] ');
}

function isBotMessage(message) {
  return String(message?.authorType || '') === 'bot';
}

function outboundAuthorLabel(message) {
  if (isBotMessage(message)) {
    const name = String(message?.authorName || '').trim();
    return name ? `${t('liveChat.botLabel')} · ${name}` : t('liveChat.botLabel');
  }
  return String(message?.authorName || '').trim() || t('liveChat.agent');
}

function messageBubbleClass(message) {
  if (isInternalNote(message)) {
    return 'border border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-50';
  }
  if (message.direction === 'inbound') {
    return 'border border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
  }
  if (isBotMessage(message)) {
    return 'border border-violet-200 bg-violet-600 text-white dark:border-violet-700 dark:bg-violet-700';
  }
  return 'border border-indigo-200 bg-indigo-600 text-white dark:border-indigo-700 dark:bg-indigo-700';
}

async function scrollToBottom() {
  await nextTick();
  const el = scrollRef.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

function stopStreamPoll() {
  if (streamPollTimer) {
    clearInterval(streamPollTimer);
    streamPollTimer = null;
  }
}

function stopStreamReconnect() {
  if (streamReconnectTimer) {
    clearTimeout(streamReconnectTimer);
    streamReconnectTimer = null;
  }
}

function closeStream({ resetAttempts = true } = {}) {
  try {
    es?.close?.();
  } catch {
    // ignore
  }
  es = null;
  stopStreamPoll();
  stopStreamReconnect();
  if (resetAttempts) streamAttempt = 0;
}

function streamAfterCursor() {
  const last = messages.value[messages.value.length - 1];
  const ts = last?.createdAt ? new Date(last.createdAt).getTime() : NaN;
  return Number.isFinite(ts) && ts > 0 ? ts : Date.now();
}

function startStreamMessagePoll() {
  stopStreamPoll();
  streamPollTimer = setInterval(() => {
    void loadMessages().catch(() => {});
  }, STREAM_POLL_MS);
}

function scheduleStreamReconnect() {
  if (streamReconnectTimer) return;
  streamAttempt += 1;
  if (streamAttempt > MAX_STREAM_RECONNECTS) {
    startStreamMessagePoll();
    return;
  }
  const delay = Math.min(1000 * 2 ** (streamAttempt - 1), 15000);
  streamReconnectTimer = setTimeout(() => {
    streamReconnectTimer = null;
    openStream({ isReconnect: true });
  }, delay);
}

function patchReceipts(patches) {
  if (!Array.isArray(patches) || !patches.length) return;
  const byId = new Map(patches.map((p) => [String(p._id), p]));
  messages.value = messages.value.map((m) => {
    const patch = byId.get(String(m._id));
    if (!patch) return m;
    return applyReceiptPatch({ ...m }, patch);
  });
}

function clearVisitorTypingLabel() {
  if (typingClearTimer) {
    clearTimeout(typingClearTimer);
    typingClearTimer = null;
  }
  typingLabel.value = '';
}

function showVisitorTypingLabel(name) {
  const label = String(name || t('liveChat.visitor')).trim() || t('liveChat.visitor');
  typingLabel.value = t('liveChat.visitorTyping', { name: label });
  if (typingClearTimer) clearTimeout(typingClearTimer);
  typingClearTimer = setTimeout(() => {
    typingClearTimer = null;
    typingLabel.value = '';
  }, 5500);
  scrollToBottom();
}

function mergeMessages(rows) {
  if (!Array.isArray(rows) || !rows.length) return;
  const known = new Set(messages.value.map((m) => String(m._id)));
  const merged = [...messages.value];
  let hasNewInbound = false;
  for (const r of rows) {
    if (!r || !r._id || known.has(String(r._id))) continue;
    if (r.direction === 'inbound') hasNewInbound = true;
    merged.push(r);
  }
  if (hasNewInbound) clearVisitorTypingLabel();
  merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  messages.value = merged;
  scrollToBottom();
  scheduleMarkRead();
}

async function markRead() {
  if (!props.sessionId) return;
  try {
    await apiClient.post(`/live-chat/sessions/${props.sessionId}/read`);
    messages.value = messages.value.map((m) => {
      if (m.direction !== 'inbound' || m.readAt) return m;
      const now = new Date().toISOString();
      return { ...m, readAt: now, deliveredAt: m.deliveredAt || now };
    });
  } catch {
    // ignore
  }
}

function scheduleMarkRead() {
  if (markReadTimer) clearTimeout(markReadTimer);
  markReadTimer = setTimeout(() => {
    markReadTimer = null;
    markRead();
  }, 400);
}

function openStream({ isReconnect = false } = {}) {
  try {
    es?.close?.();
  } catch {
    // ignore
  }
  es = null;
  stopStreamReconnect();
  stopStreamPoll();
  if (!isReconnect) streamAttempt = 0;

  if (!props.sessionId) return;
  const token = authStore.user?.token;
  if (!token) return;

  const after = streamAfterCursor();
  const url = getApiUrlForEventSource(
    `/live-chat/sessions/${props.sessionId}/stream?after=${after}&token=${encodeURIComponent(token)}`,
  );
  es = new EventSource(url, { withCredentials: true });
  es.addEventListener('open', () => {
    streamAttempt = 0;
  });
  es.addEventListener('messages', (evt) => {
    try {
      mergeMessages(JSON.parse(evt.data || '[]'));
    } catch {
      // ignore
    }
  });
  es.addEventListener('receipts', (evt) => {
    try {
      patchReceipts(JSON.parse(evt.data || '[]'));
    } catch {
      // ignore
    }
  });
  es.addEventListener('typing', (evt) => {
    try {
      const typing = JSON.parse(evt.data || '{}');
      const visitorTyping = typing?.visitor;
      if (!visitorTyping?.authorType) {
        clearVisitorTypingLabel();
        return;
      }
      const name = String(visitorTyping.authorName || t('liveChat.visitor')).trim();
      showVisitorTypingLabel(name);
    } catch {
      clearVisitorTypingLabel();
    }
  });
  es.addEventListener('session', (evt) => {
    try {
      const payload = JSON.parse(evt.data || '{}');
      const prev = sessionMeta.value || {};
      const next = { ...prev };

      if (payload.status != null) next.status = payload.status;
      if (payload.lifecycleStatus != null) next.lifecycleStatus = payload.lifecycleStatus;
      if ('outcome' in payload) next.outcome = payload.outcome ?? null;
      if (payload.endedAt != null) next.endedAt = payload.endedAt;
      if ('assignedAgentId' in payload) next.assignedAgentId = payload.assignedAgentId || null;
      if ('assignedAgent' in payload) next.assignedAgent = payload.assignedAgent || null;
      if (payload.transferCount != null) next.transferCount = payload.transferCount;

      sessionMeta.value = next;

      if (String(payload?.status || '') === 'closed') {
        closeStream();
      }
    } catch {
      // ignore
    }
  });
  es.onerror = () => {
    if (es && es.readyState === EventSource.CONNECTING) return;
    try {
      es?.close?.();
    } catch {
      // ignore
    }
    es = null;
    scheduleStreamReconnect();
  };
}

async function loadSessionMeta() {
  const res = await apiClient.get(`/live-chat/sessions/${props.sessionId}`);
  if (res?.success) {
    sessionMeta.value = res.data || null;
    syncLinkedCaseFromMeta();
    syncLinkedPersonFromMeta();
  }
}

async function loadMessages() {
  const res = await apiClient.get(`/live-chat/sessions/${props.sessionId}/messages`, {
    params: { limit: 500 },
  });
  if (res?.success) {
    messages.value = Array.isArray(res.data) ? res.data : [];
    await scrollToBottom();
    scheduleMarkRead();
  }
}

function outcomeLabel(row) {
  const key = String(row?.key || '').trim();
  if (!key) return '';
  const translated = t(`liveChat.outcomes.${key}`, row.label || key);
  return translated === `liveChat.outcomes.${key}` ? (row.label || key) : translated;
}

const FALLBACK_OUTCOMES = [
  { key: 'resolved', label: 'Resolved', system: true },
  { key: 'missed', label: 'Missed', system: true },
  { key: 'follow_up_required', label: 'Follow-up Required', system: true },
  { key: 'escalated', label: 'Escalated', system: true },
  { key: 'abandoned', label: 'Abandoned', system: true },
  { key: 'spam', label: 'Spam', system: true },
  { key: 'informational', label: 'Informational', system: true },
];

async function loadOutcomes() {
  loadingOutcomes.value = true;
  try {
    const res = await apiClient.get('/live-chat/outcomes');
    outcomes.value = Array.isArray(res?.data) && res.data.length ? res.data : FALLBACK_OUTCOMES;
    if (!selectedOutcome.value && outcomes.value.length) {
      selectedOutcome.value = outcomes.value[0].key;
    }
  } catch {
    outcomes.value = [...FALLBACK_OUTCOMES];
    if (!selectedOutcome.value) {
      selectedOutcome.value = outcomes.value[0].key;
    }
  } finally {
    loadingOutcomes.value = false;
  }
}

async function openEndSessionDialog() {
  endSessionError.value = '';
  endSessionSummary.value = String(sessionMeta.value?.summary || '').trim();
  endSessionTagsInput.value = (Array.isArray(sessionMeta.value?.tags) ? sessionMeta.value.tags : [])
    .map((tag) => String(tag || '').trim())
    .filter(Boolean)
    .join(', ');
  endDialogOpen.value = true;
  if (!outcomes.value.length) {
    await loadOutcomes();
  }
}

function closeEndSessionDialog() {
  endDialogOpen.value = false;
  endSessionError.value = '';
  endSessionSummary.value = '';
  endSessionTagsInput.value = '';
}

function parseEndSessionTagsInput() {
  return String(endSessionTagsInput.value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function confirmEndSession() {
  if (!selectedOutcome.value || endingSession.value || loadingOutcomes.value) return;
  endingSession.value = true;
  endSessionError.value = '';
  try {
    const payload = { outcome: selectedOutcome.value };
    const summary = String(endSessionSummary.value || '').trim();
    const tags = parseEndSessionTagsInput();
    if (summary) payload.summary = summary;
    if (tags.length) payload.tags = tags;

    const res = await apiClient.post(`/live-chat/sessions/${props.sessionId}/end`, payload);
    if (!res?.success) {
      endSessionError.value = res?.message || t('liveChat.endSessionFailed');
      return;
    }
    const endedAt = res.data?.endedAt || new Date().toISOString();
    sessionMeta.value = {
      ...(sessionMeta.value || {}),
      status: 'closed',
      lifecycleStatus: 'ended',
      outcome: selectedOutcome.value,
      endedAt,
      summary,
      tags,
    };
    emit('session-ended', { ...sessionMeta.value, _id: props.sessionId });
    closeEndSessionDialog();
    closeStream();
  } catch (err) {
    endSessionError.value = err?.response?.data?.message || err?.message || t('liveChat.endSessionFailed');
  } finally {
    endingSession.value = false;
  }
}

async function claimSession() {
  if (claimingSession.value || !props.sessionId) return;
  claimingSession.value = true;
  sendError.value = '';
  try {
    const res = await apiClient.post(`/live-chat/sessions/${props.sessionId}/claim`);
    if (res?.success && sessionMeta.value) {
      sessionMeta.value = {
        ...sessionMeta.value,
        assignedAgentId: res.data?.agentId || currentUserId.value,
        lifecycleStatus: res.data?.lifecycleStatus || 'assigned',
      };
    }
  } catch (err) {
    sendError.value = err?.response?.data?.message || err?.message || t('liveChat.claimSessionFailed');
  } finally {
    claimingSession.value = false;
  }
}

function formatAgentOptionLabel(user) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  return String(user?.email || user?.username || user?._id || '').trim() || t('liveChat.agent');
}

async function loadTransferAgents() {
  loadingTransferAgents.value = true;
  transferError.value = '';
  try {
    const res = await apiClient.get('/users', { params: { limit: 200, status: 'active' } });
    transferAgents.value = Array.isArray(res?.data) ? res.data : [];
  } catch {
    transferAgents.value = [];
    transferError.value = t('liveChat.transferAgentsLoadFailed');
  } finally {
    loadingTransferAgents.value = false;
  }
}

function openTransferDialog() {
  transferAgentId.value = '';
  transferError.value = '';
  transferDialogOpen.value = true;
  void loadTransferAgents();
}

function closeTransferDialog() {
  transferDialogOpen.value = false;
  transferAgentId.value = '';
  transferError.value = '';
}

async function confirmTransferSession() {
  const agentId = String(transferAgentId.value || '').trim();
  if (!agentId || transferringSession.value || !props.sessionId) return;

  transferringSession.value = true;
  transferError.value = '';
  try {
    const res = await apiClient.post(`/live-chat/sessions/${props.sessionId}/transfer`, { agentId });
    if (res?.success) {
      const session = res.data?.session || null;
      if (session) {
        sessionMeta.value = session;
      } else if (sessionMeta.value) {
        sessionMeta.value = {
          ...sessionMeta.value,
          assignedAgentId: res.data?.agentId || agentId,
          lifecycleStatus: res.data?.lifecycleStatus || sessionMeta.value.lifecycleStatus,
          transferCount: (Number(sessionMeta.value.transferCount) || 0) + 1,
        };
      }
      closeTransferDialog();
    }
  } catch (err) {
    transferError.value = err?.response?.data?.message || err?.message || t('liveChat.transferSessionFailed');
  } finally {
    transferringSession.value = false;
  }
}

function openLinkCaseDialog() {
  linkCaseIdInput.value = '';
  linkCaseError.value = '';
  linkCaseDialogOpen.value = true;
}

function closeLinkCaseDialog() {
  linkCaseDialogOpen.value = false;
  linkCaseIdInput.value = '';
  linkCaseError.value = '';
}

async function confirmLinkCase() {
  const caseId = String(linkCaseIdInput.value || '').trim();
  if (!caseId || linkingCase.value || !props.sessionId) return;
  linkingCase.value = true;
  linkCaseError.value = '';
  try {
    const res = await apiClient.post(`/live-chat/sessions/${props.sessionId}/link-case`, { caseId });
    if (res?.success && res.data?.caseId) {
      linkedCaseId.value = res.data.caseId;
      if (sessionMeta.value) {
        sessionMeta.value = {
          ...sessionMeta.value,
          linkedRecords: [
            ...(Array.isArray(sessionMeta.value.linkedRecords) ? sessionMeta.value.linkedRecords : []),
            { moduleKey: 'cases', recordId: res.data.caseId, linkType: 'linked' },
          ],
        };
      }
      closeLinkCaseDialog();
    }
  } catch (err) {
    linkCaseError.value = err?.response?.data?.message || err?.message || t('liveChat.linkCaseFailed');
  } finally {
    linkingCase.value = false;
  }
}

async function createHelpdeskCase() {
  if (creatingCase.value || !props.sessionId) return;
  creatingCase.value = true;
  error.value = '';
  try {
    const res = await apiClient.post(`/live-chat/sessions/${props.sessionId}/create-case`, {});
    if (res?.success && res.data?.caseId) {
      linkedCaseId.value = res.data.caseId;
      if (sessionMeta.value) {
        sessionMeta.value = {
          ...sessionMeta.value,
          linkedRecords: [
            ...(Array.isArray(sessionMeta.value.linkedRecords) ? sessionMeta.value.linkedRecords : []),
            { moduleKey: 'cases', recordId: res.data.caseId, linkType: 'created' },
          ],
        };
      }
    }
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('liveChat.createCaseFailed');
  } finally {
    creatingCase.value = false;
  }
}

function openLinkPersonDialog() {
  linkPersonIdInput.value = '';
  linkPersonError.value = '';
  linkPersonDialogOpen.value = true;
}

function closeLinkPersonDialog() {
  linkPersonDialogOpen.value = false;
  linkPersonIdInput.value = '';
  linkPersonError.value = '';
}

async function confirmLinkPerson() {
  const personId = String(linkPersonIdInput.value || '').trim();
  if (!personId || linkingPerson.value || !props.sessionId) return;
  linkingPerson.value = true;
  linkPersonError.value = '';
  try {
    const res = await apiClient.post(`/live-chat/sessions/${props.sessionId}/link-person`, { personId });
    if (res?.success && res.data?.personId) {
      linkedPersonId.value = res.data.personId;
      if (sessionMeta.value) {
        sessionMeta.value = {
          ...sessionMeta.value,
          linkedRecords: [
            ...(Array.isArray(sessionMeta.value.linkedRecords) ? sessionMeta.value.linkedRecords : []),
            { moduleKey: 'people', recordId: res.data.personId, linkType: 'linked' },
          ],
        };
      }
      closeLinkPersonDialog();
    }
  } catch (err) {
    linkPersonError.value = err?.response?.data?.message || err?.message || t('liveChat.linkPersonFailed');
  } finally {
    linkingPerson.value = false;
  }
}

async function createSalesLead() {
  if (creatingLead.value || !props.sessionId) return;
  creatingLead.value = true;
  error.value = '';
  try {
    const res = await apiClient.post(`/live-chat/sessions/${props.sessionId}/create-lead`, {});
    if (res?.success && res.data?.personId) {
      linkedPersonId.value = res.data.personId;
      if (sessionMeta.value) {
        sessionMeta.value = {
          ...sessionMeta.value,
          linkedRecords: [
            ...(Array.isArray(sessionMeta.value.linkedRecords) ? sessionMeta.value.linkedRecords : []),
            {
              moduleKey: 'people',
              recordId: res.data.personId,
              linkType: res.data.created ? 'created' : 'linked',
            },
          ],
        };
      }
    }
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('liveChat.createLeadFailed');
  } finally {
    creatingLead.value = false;
  }
}

async function load() {
  const sessionId = String(props.sessionId || '').trim();
  if (!sessionId) return;

  const generation = ++loadGeneration;
  loading.value = true;
  error.value = '';
  sendError.value = '';
  clearVisitorTypingLabel();
  messages.value = [];
  sessionMeta.value = null;
  closeStream();
  try {
    await loadSessionMeta();
    if (generation !== loadGeneration) return;
    if (props.session?._id && String(props.session._id) === sessionId) {
      sessionMeta.value = {
        ...(sessionMeta.value || {}),
        ...props.session,
        status: sessionMeta.value?.status ?? props.session.status,
        lifecycleStatus: sessionMeta.value?.lifecycleStatus ?? props.session.lifecycleStatus,
      };
      syncLinkedCaseFromMeta();
      syncLinkedPersonFromMeta();
    }
    await loadMessages();
    if (generation !== loadGeneration) return;
    openStream();
  } catch (err) {
    if (generation !== loadGeneration) return;
    error.value = err?.response?.data?.message || err?.message || t('liveChat.loadFailed');
  } finally {
    if (generation === loadGeneration) {
      loading.value = false;
    }
  }
}

function cancelTypingPing() {
  if (typingTimer) {
    clearTimeout(typingTimer);
    typingTimer = null;
  }
  if (typingAbortController) {
    typingAbortController.abort();
    typingAbortController = null;
  }
}

function pingTyping() {
  if (!props.sessionId || !canHandleSession.value) return;
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    typingTimer = null;
    if (typingAbortController) {
      typingAbortController.abort();
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    typingAbortController = controller;
    const signal = controller?.signal;
    apiClient
      .post(`/live-chat/sessions/${props.sessionId}/typing`, {}, signal ? { signal } : {})
      .catch(() => {})
      .finally(() => {
        if (typingAbortController === controller) {
          typingAbortController = null;
        }
      });
  }, 600);
}

function messageAttachments(message) {
  return Array.isArray(message?.attachments) ? message.attachments : [];
}

function attachmentHref(att) {
  return liveChatAttachmentHref(att);
}

async function uploadComposerFiles(files) {
  const uploaded = [];
  for (const file of files) {
    const row = await uploadLiveChatMessageAttachment(props.sessionId, file);
    if (row) uploaded.push(row);
  }
  return uploaded;
}

function onComposerSendError(err) {
  const message = err?.response?.data?.message || err?.message || t('liveChat.sendFailed');
  const status = Number(err?.response?.status || err?.status || 0);
  const timedOut = err?.name === 'AbortError' || /aborted/i.test(String(err?.message || ''));
  sendError.value = timedOut ? t('liveChat.sendFailed') : message;
  if (status === 403 && /assigned to another agent/i.test(String(message))) {
    void loadSessionMeta();
  }
  if (status === 409 && /closed/i.test(String(message))) {
    sessionMeta.value = {
      ...(sessionMeta.value || {}),
      status: 'closed',
      lifecycleStatus: sessionMeta.value?.lifecycleStatus || 'ended',
    };
    closeStream();
  }
}

async function sendReplyPayload(payload, { signal } = {}) {
  const sessionId = String(props.sessionId || '').trim();
  let messageBody = String(payload?.body || '').trim();
  const files = Array.isArray(payload?.files) ? payload.files : [];
  if (!sessionId) {
    throw new Error(t('liveChat.sendFailed'));
  }
  if (!messageBody && !files.length) {
    throw new Error(t('liveChat.sendFailed'));
  }

  if (composerMode.value === 'note') {
    messageBody = messageBody ? `[Note] ${messageBody}` : '[Note]';
  }

  sendError.value = '';
  cancelTypingPing();
  let attachments = [];
  if (files.length) {
    attachments = await uploadComposerFiles(files);
  }

  const res = await apiClient.post(
    `/live-chat/sessions/${sessionId}/messages`,
    {
      body: messageBody,
      attachments,
    },
    signal ? { signal } : {},
  );

  if (!res?.success) {
    throw new Error(res?.message || t('liveChat.sendFailed'));
  }

  if (!assignedAgentId.value && currentUserId.value) {
    sessionMeta.value = {
      ...(sessionMeta.value || {}),
      assignedAgentId: currentUserId.value,
      lifecycleStatus: 'active',
    };
  }

  if (res.data) {
    mergeMessages([res.data]);
  } else {
    void loadMessages().catch(() => {});
  }
}

async function endSession() {
  openEndSessionDialog();
}

watch(
  () => props.sessionId,
  (next, prev) => {
    const id = String(next || '').trim();
    const prevId = String(prev || '').trim();
    if (id && id !== prevId) load();
  },
  { immediate: true },
);

watch(
  () => props.session,
  (next) => {
    if (!next || String(next._id || '') !== String(props.sessionId || '')) return;
    const prev = sessionMeta.value || {};
    const preserveClosed = prev.status === 'closed' && next.status !== 'closed';
    sessionMeta.value = {
      ...prev,
      ...next,
      ...(preserveClosed
        ? {
            status: 'closed',
            lifecycleStatus: prev.lifecycleStatus,
            outcome: prev.outcome,
            endedAt: prev.endedAt,
          }
        : {}),
    };
    syncLinkedCaseFromMeta();
    syncLinkedPersonFromMeta();
  },
);

onMounted(() => {
  elapsedTimer = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => {
  closeStream();
  cancelTypingPing();
  clearVisitorTypingLabel();
  if (markReadTimer) clearTimeout(markReadTimer);
  if (elapsedTimer) clearInterval(elapsedTimer);
});
</script>
