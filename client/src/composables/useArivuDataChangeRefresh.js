import { onMounted, onBeforeUnmount } from 'vue';

/**
 * Soft-refresh the open record when Astra (or SSE) publishes arivu:data-change.
 * @param {{ getModuleKey: () => string, getRecordId: () => string, onChange: (detail: object) => void }} options
 */
export function useArivuDataChangeRefresh({ getModuleKey, getRecordId, onChange }) {
  function handler(event) {
    const detail = event?.detail;
    if (!detail?.recordId || !detail?.moduleKey) return;
    const moduleKey = String(getModuleKey?.() || '').toLowerCase();
    const recordId = String(getRecordId?.() || '').trim();
    if (!moduleKey || !recordId) return;
    if (String(detail.recordId) !== recordId) return;
    if (String(detail.moduleKey).toLowerCase() !== moduleKey) return;
    onChange?.(detail);
  }

  onMounted(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('arivu:data-change', handler);
    }
  });

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('arivu:data-change', handler);
    }
  });
}
