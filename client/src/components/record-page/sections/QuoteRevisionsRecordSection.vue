<template>
  <section v-if="record?._id" class="space-y-3">
    <p v-if="quoteNumber" class="text-xs text-gray-500 dark:text-gray-400">
      {{ t('records.revisionsQuoteNumber', { number: quoteNumber }) }}
    </p>

    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">{{ t('states.loading') }}</div>
    <div
      v-else-if="error"
      class="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-800 dark:text-red-200"
    >
      {{ error }}
    </div>

    <div v-else-if="!revisions.length" class="text-sm text-gray-600 dark:text-gray-300">
      {{ t('records.revisionsEmpty') }}
    </div>

    <ul v-else class="space-y-2 list-none m-0 p-0">
      <li
        v-for="rev in revisions"
        :key="rev._id"
        class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
        :class="revisionRowClass(rev)"
      >
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t('records.quoteRevisionLabel', { n: rev.revisionNumber || 1 }) }}
            </span>
            <span
              v-if="revisionStatusBadge(rev)"
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              :class="revisionStatusBadgeClass(rev)"
            >
              {{ revisionStatusBadge(rev) }}
            </span>
          </div>
          <div class="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
            <span>{{ rev.status || '—' }}</span>
            <span>{{ fmtDate(rev.quoteDate) }}</span>
            <span class="tabular-nums font-medium text-gray-700 dark:text-gray-200">
              {{ formatMoney(rev.grandTotal, rev.currency) }}
            </span>
          </div>
        </div>

        <div class="shrink-0 flex items-center gap-2">
          <button
            type="button"
            class="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            @click="compareRevision(rev)"
          >
            {{ t('records.revisionsCompare') }}
          </button>
          <button
            v-if="!isCurrentRevision(rev)"
            type="button"
            class="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            @click="openRevision(rev)"
          >
            {{ t('records.revisionsOpen') }}
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { formatQuoteMoney } from '@/utils/quoteMoney';
import { formatUserDate } from '@/utils/localeFormat';

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const router = useRouter();

const loading = ref(false);
const error = ref('');
const revisions = ref([]);
const quoteNumber = ref('');

function isCurrentRevision(rev) {
  return String(rev?._id || '') === String(props.record?._id || '');
}

function revisionRowClass(rev) {
  if (isCurrentRevision(rev)) {
    return 'border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-900/10';
  }
  return 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900';
}

function revisionStatusBadge(rev) {
  if (isCurrentRevision(rev) && rev.activeRevision) {
    return t('records.revisionsCurrentBadge');
  }
  if (isCurrentRevision(rev)) return t('records.revisionsViewingBadge');
  if (rev.activeRevision) return t('records.revisionsActiveBadge');
  return '';
}

function revisionStatusBadgeClass(rev) {
  if (isCurrentRevision(rev)) {
    return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200';
  }
  if (rev.activeRevision) {
    return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200';
  }
  return '';
}

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return formatUserDate(d);
}

function formatMoney(value, currency) {
  const code = String(currency || props.record?.currency || '').trim().toUpperCase();
  return formatQuoteMoney(value, code || 'USD');
}

async function loadRevisions() {
  if (!props.record?._id) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient.get(`/quotes/${props.record._id}/revisions`);
    if (!res?.success) {
      throw new Error(res?.message || t('records.revisionsLoadFailed'));
    }
    quoteNumber.value = res?.data?.quoteNumber || props.record?.quoteNumber || '';
    revisions.value = Array.isArray(res?.data?.revisions) ? res.data.revisions : [];
  } catch (e) {
    error.value = e?.message || t('records.revisionsLoadFailed');
    revisions.value = [];
  } finally {
    loading.value = false;
  }
}

function openRevision(rev) {
  if (!rev?._id || isCurrentRevision(rev)) return;
  router.push({ name: 'quote-detail', params: { id: String(rev._id) } });
}

function previousRevisionNumber(rev) {
  const sorted = [...revisions.value].sort((a, b) => Number(a.revisionNumber || 1) - Number(b.revisionNumber || 1));
  const idx = sorted.findIndex((row) => String(row._id) === String(rev?._id));
  if (idx > 0) return Number(sorted[idx - 1].revisionNumber) || 1;
  return null;
}

function compareRevision(rev) {
  const target = rev || props.record;
  const targetId = target?._id || props.record?._id;
  if (!targetId) return;
  const toRevision = Number(target.revisionNumber || props.record?.revisionNumber || 1);
  const fromRevision = previousRevisionNumber(target);
  router.push({
    name: 'quote-revision-compare',
    params: { id: String(targetId) },
    query: {
      ...(fromRevision ? { fromRevision } : {}),
      toRevision
    }
  });
}

watch(() => props.record?._id, loadRevisions);
onMounted(loadRevisions);
</script>
