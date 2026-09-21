<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-gray-900">
    <div class="px-4 sm:px-6 py-3">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ t('cases.recordLiveChatHeading') }}
          </p>
          <p v-if="visitorLabel" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
            {{ visitorLabel }}
          </p>
        </div>
        <p v-if="statusLabel" class="text-xs text-gray-500 dark:text-gray-400">
          {{ statusLabel }}
        </p>
      </div>
    </div>

    <div ref="scrollRef" class="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 pb-4 space-y-2">
      <div v-if="loading" class="py-6 text-sm text-gray-500 dark:text-gray-400">
        {{ t('cases.chatLoading') }}
      </div>
      <div v-else-if="error" class="py-6 text-sm text-rose-600 dark:text-rose-300">{{ error }}</div>
      <div v-else-if="!messages.length" class="py-6 text-sm text-gray-500 dark:text-gray-400">
        {{ t('cases.chatEmpty') }}
      </div>

      <div
        v-for="m in messages"
        :key="m._id"
        class="flex"
        :class="m.direction === 'inbound' ? '' : 'justify-end'"
      >
        <div
          class="max-w-[min(100%,42rem)] rounded-2xl border px-3 py-2 text-sm whitespace-pre-wrap break-words"
          :class="
            m.direction === 'inbound'
              ? 'border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100'
              : 'border-indigo-200 bg-indigo-50 text-gray-900 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-50'
          "
        >
          <p class="text-[11px] mb-1 opacity-70">
            {{ m.authorName || (m.direction === 'inbound' ? t('cases.chatVisitor') : t('cases.chatAgent')) }}
            · {{ formatTime(m.createdAt) }}
          </p>
          <p>{{ m.body || '—' }}</p>
          <div
            v-if="m.direction === 'outbound'"
            class="mt-1 flex justify-end"
          >
            <ChatMessageReceiptIcon :status="receiptStatus(m)" size="sm" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch
} from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { getApiUrlForEventSource } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import ChatMessageReceiptIcon from '@/components/cases/ChatMessageReceiptIcon.vue';
import { formatUserDateTime } from '@/utils/localeFormat';
import {
  applyReceiptPatch,
  receiptStatusFromMessage
} from '@/utils/chatMessageReceipt';

const emit = defineEmits(['chat-updated', 'typing-label']);

const props = defineProps({
  caseId: { type: String, required: true },
  canReply: { type: Boolean, default: true }
});

const { t } = useI18n();
const { clearHelpdeskTabAlertForCase } = useTabs();

const loading = ref(true);
const error = ref('');
const sessionId = ref(null);
const visitor = ref(null);
const sessionStatus = ref('');
const messages = ref([]);
const scrollRef = ref(null);
const typingLabel = ref('');

let es = null;
let markReadTimer = null;
let streamPollTimer = null;
let streamReconnectTimer = null;
let streamAttempt = 0;

const STREAM_POLL_MS = 2500;
const MAX_STREAM_RECONNECTS = 5;

const visitorLabel = computed(() => {
  const v = visitor.value || {};
  const name = String(v.name || '').trim();
  const email = String(v.email || '').trim();
  if (name && email) return `${name} · ${email}`;
  return name || email || '';
});

const statusLabel = computed(() => {
  const s = String(sessionStatus.value || '').trim();
  return s ? t('cases.chatStatusLabel', { status: s }) : '';
});

function receiptStatus(message) {
  return receiptStatusFromMessage(message);
}

function formatTime(dt) {
  try {
    return formatUserDateTime(dt || Date.now()) || '';
  } catch (_) {
    return '';
  }
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
  } catch (_) {}
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
    void refreshMessages().catch(() => {});
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
  let changed = false;
  messages.value = messages.value.map((m) => {
    const patch = byId.get(String(m._id));
    if (!patch) return m;
    changed = true;
    return applyReceiptPatch({ ...m }, patch);
  });
  if (changed) scheduleChatUpdatedEmit();
}

function mergeMessages(rows) {
  if (!Array.isArray(rows) || !rows.length) return;
  const known = new Set(messages.value.map((m) => String(m._id)));
  const merged = [...messages.value];
  for (const r of rows) {
    if (!r || !r._id || known.has(String(r._id))) continue;
    merged.push(r);
  }
  merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  messages.value = merged;
  scrollToBottom();
  scheduleMarkChatRead();
}

function appendMessage(msg) {
  if (!msg?._id) return;
  mergeMessages([msg]);
}

async function markChatReadForAgent() {
  if (!sessionId.value) return;
  try {
    await apiClient.post(`/live-chat/sessions/${sessionId.value}/read`);
    clearHelpdeskTabAlertForCase?.(props.caseId, 'chat');
    messages.value = messages.value.map((m) => {
      if (m.direction !== 'inbound' || m.readAt) return m;
      const now = new Date().toISOString();
      return { ...m, readAt: now, deliveredAt: m.deliveredAt || now };
    });
  } catch (_) {
    /* ignore */
  }
}

function scheduleMarkChatRead() {
  if (markReadTimer) clearTimeout(markReadTimer);
  markReadTimer = setTimeout(() => {
    markReadTimer = null;
    markChatReadForAgent();
  }, 400);
}

async function refreshMessages() {
  if (!sessionId.value) return;
  try {
    const msgsRes = await apiClient.get(`/live-chat/sessions/${sessionId.value}/messages`, {
      params: { limit: 500 }
    });
    if (msgsRes?.success) {
      messages.value = Array.isArray(msgsRes.data) ? msgsRes.data : [];
      await scrollToBottom();
      scheduleMarkChatRead();
    }
  } catch (_) {
    /* ignore */
  }
}

function openStream({ isReconnect = false } = {}) {
  try {
    es?.close?.();
  } catch (_) {}
  es = null;
  stopStreamReconnect();
  stopStreamPoll();
  if (!isReconnect) streamAttempt = 0;

  if (!sessionId.value) return;
  const authStore = useAuthStore();
  const token = authStore.user?.token;
  if (!token) return;

  const after = streamAfterCursor();
  const url = getApiUrlForEventSource(
    `/live-chat/sessions/${sessionId.value}/stream?after=${after}&token=${encodeURIComponent(token)}`
  );
  es = new EventSource(url, { withCredentials: true });
  es.addEventListener('open', () => {
    streamAttempt = 0;
  });
  es.addEventListener('messages', (evt) => {
    try {
      const rows = JSON.parse(evt.data || '[]');
      mergeMessages(rows);
      scheduleChatUpdatedEmit();
    } catch (_) {}
  });
  es.addEventListener('receipts', (evt) => {
    try {
      const rows = JSON.parse(evt.data || '[]');
      patchReceipts(rows);
    } catch (_) {}
  });
  es.addEventListener('typing', (evt) => {
    try {
      const typing = JSON.parse(evt.data || '{}');
      const visitorTyping = typing?.visitor;
      if (!visitorTyping || !visitorTyping.authorType) {
        typingLabel.value = '';
        emit('typing-label', '');
        return;
      }
      const name = visitorTyping.authorName || t('cases.chatVisitor');
      typingLabel.value = t('cases.chatTyping', { name });
      emit('typing-label', typingLabel.value);
    } catch (_) {}
  });
  es.onerror = () => {
    if (es && es.readyState === EventSource.CONNECTING) return;
    try {
      es?.close?.();
    } catch (_) {}
    es = null;
    scheduleStreamReconnect();
  };
}

let chatUpdatedEmitTimer = null;

function scheduleChatUpdatedEmit() {
  if (chatUpdatedEmitTimer) clearTimeout(chatUpdatedEmitTimer);
  chatUpdatedEmitTimer = setTimeout(() => {
    chatUpdatedEmitTimer = null;
    emit('chat-updated');
  }, 600);
}

async function load(options = {}) {
  const soft = options.soft === true;
  const hasCachedSession = soft && sessionId.value && messages.value.length > 0;

  if (!hasCachedSession) {
    loading.value = !messages.value.length;
    error.value = '';
    if (!soft) {
      messages.value = [];
      sessionId.value = null;
      visitor.value = null;
      sessionStatus.value = '';
      typingLabel.value = '';
      emit('typing-label', '');
    }
    closeStream();
  }

  try {
    const sessionRes = await apiClient.get(`/helpdesk/cases/${props.caseId}/live-chat-session`);
    if (!sessionRes?.success) {
      error.value = sessionRes?.message || t('cases.chatSessionLoadFailed');
      return;
    }
    const summary = sessionRes.data;
    if (!summary?.sessionId || summary.missing) {
      sessionId.value = null;
      messages.value = [];
      return;
    }
    sessionId.value = summary.sessionId;
    sessionStatus.value = summary.status || '';
    visitor.value = summary.visitorName ? { name: summary.visitorName } : null;

    const detailRes = await apiClient.get(`/live-chat/sessions/${sessionId.value}`);
    if (detailRes?.success) {
      visitor.value = detailRes.data?.visitor || visitor.value;
      sessionStatus.value = detailRes.data?.status || sessionStatus.value;
    }

    const msgsRes = await apiClient.get(`/live-chat/sessions/${sessionId.value}/messages`, {
      params: { limit: 500 }
    });
    if (msgsRes?.success) {
      messages.value = Array.isArray(msgsRes.data) ? msgsRes.data : [];
    }
    await scrollToBottom();
    openStream();
    scheduleMarkChatRead();
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || t('cases.chatLoadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(() => load());
onBeforeUnmount(() => {
  closeStream();
  if (chatUpdatedEmitTimer) clearTimeout(chatUpdatedEmitTimer);
  if (markReadTimer) clearTimeout(markReadTimer);
});

onDeactivated(closeStream);

onActivated(() => {
  if (sessionId.value) {
    openStream();
    refreshMessages();
    return;
  }
  if (props.caseId) load({ soft: true });
});

watch(
  () => props.caseId,
  (newId, oldId) => {
    if (newId && newId !== oldId) load();
  }
);

defineExpose({ appendMessage, refreshMessages, markChatReadForAgent });
</script>
