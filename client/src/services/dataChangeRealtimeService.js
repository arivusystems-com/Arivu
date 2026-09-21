/**
 * SSE client for tenant-scoped data change invalidation.
 */

import { getApiUrlForEventSource } from '@/config/apiBase';
import { markModuleListDirty } from '@/utils/moduleListFreshness';
import { markRecordDetailDirty } from '@/utils/recordDetailFreshness';

const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

let eventSource = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let disposed = false;
let currentToken = null;

function getReconnectDelay(attempt) {
  const delay = Math.min(INITIAL_RECONNECT_DELAY * (2 ** attempt), MAX_RECONNECT_DELAY);
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return delay + jitter;
}

function closeTransport() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

function scheduleReconnect(connectFn) {
  if (disposed || reconnectTimer) return;
  const delay = getReconnectDelay(reconnectAttempt);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectAttempt += 1;
    connectFn();
  }, delay);
}

function handleDataChangePayload(payload) {
  if (!payload || payload.type !== 'data-change') return;

  const moduleKey = String(payload.moduleKey || '').toLowerCase();
  if (!moduleKey) return;

  markModuleListDirty(moduleKey);
  if (payload.recordId) {
    markRecordDetailDirty(moduleKey, payload.recordId);
  }

  // Notify open record pages (soft refetch) — no polling
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('arivu:data-change', {
        detail: {
          moduleKey,
          recordId: payload.recordId ? String(payload.recordId) : null,
          op: payload.op || 'update',
          patch: payload.patch && typeof payload.patch === 'object' ? payload.patch : null,
        }
      })
    );
  }
}

/**
 * Same-tab notify after local writes (Astra confirm, drawers, etc.).
 * Prefer this over waiting for SSE round-trip.
 */
export function emitLocalDataChange({
  moduleKey,
  recordId,
  op = 'update',
  patch = null,
} = {}) {
  handleDataChangePayload({
    type: 'data-change',
    moduleKey,
    recordId,
    op,
    patch,
  });
}

function connect(token) {
  if (disposed || !token) return;

  closeTransport();
  currentToken = token;

  const url = getApiUrlForEventSource(
    `/api/data-changes/stream?token=${encodeURIComponent(token)}`
  );

  try {
    eventSource = new EventSource(url, { withCredentials: true });

    eventSource.onopen = () => {
      reconnectAttempt = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleDataChangePayload(payload);
      } catch {
        // ignore malformed payloads
      }
    };

    eventSource.addEventListener('ping', () => {
      // keep-alive
    });

    eventSource.onerror = () => {
      closeTransport();
      scheduleReconnect(() => connect(currentToken));
    };
  } catch (error) {
    console.warn('[dataChangeRealtimeService] connect failed:', error);
    scheduleReconnect(() => connect(currentToken));
  }
}

export function startDataChangeRealtimeService(token) {
  disposed = false;
  if (!token) {
    stopDataChangeRealtimeService();
    return;
  }
  connect(token);
}

export function stopDataChangeRealtimeService() {
  disposed = true;
  currentToken = null;
  reconnectAttempt = 0;
  closeTransport();
}
