<template>
  <div class="w-full">
    <!-- Header -->
    <header class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{{ t('common.approvalInboxApprovals') }}</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('common.approvalInboxReviewAndApprovePendingRequests') }}</p>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300"
    >
      {{ error }}
    </div>

    <!-- Empty State -->
    <div v-else-if="approvals.length === 0" class="text-center py-12 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <svg class="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('common.approvalInboxNoApprovalsPending') }}</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('common.approvalInboxAllCaughtUpYouHaveNo') }}</p>
    </div>

    <!-- Approvals List -->
    <div v-else class="space-y-3">
      <div
        v-for="approval in approvals"
        :key="approval._id"
        @click="viewApproval(approval)"
        class="border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md cursor-pointer transition-shadow bg-white dark:bg-gray-800"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-2">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ getApprovalTitle(approval) }}
              </h3>
              <span
                :class="[
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  approval.status === 'pending'
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                ]"
              >
                {{ approval.status === 'pending' ? 'Pending' : 'Escalated' }}
              </span>
              <span
                v-if="approval.quoteCompareSummary"
                :class="riskBadgeClass(approval.quoteCompareSummary.riskLevel)"
              >
                {{ riskLabel(approval.quoteCompareSummary.riskLevel) }}
              </span>
            </div>

            <div class="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-3">
              <div>
                <span class="font-medium">{{ t('process.execLogsEntity') }}</span>
                {{ getEntityDisplay(approval) }}
              </div>
              <div v-if="approval.processId?.name">
                <span class="font-medium">{{ t('common.approvalInboxRequestedBy') }}</span>
                {{ approval.processId.name }}
              </div>
              <div v-if="approval.createdAt">
                <span class="font-medium">{{ t('common.approvalInboxRequestedAt') }}</span>
                {{ formatDate(approval.createdAt) }}
              </div>
              <div v-if="approval.dueIn !== null && approval.dueIn >= 0">
                <span class="font-medium">{{ t('common.approvalInboxDueIn') }}</span>
                <span :class="approval.dueIn < 24 ? 'text-red-600 dark:text-red-400 font-medium' : ''">
                  {{ formatDueTime(approval.dueIn) }}
                </span>
              </div>
              <div v-if="approval.quoteCompareSummary">
                <span class="font-medium">{{ t('common.approvalInboxChanges') }}</span>
                {{ quoteChangeSummary(approval.quoteCompareSummary.changeCounts) }}
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                @click.stop="handleApprove(approval)"
                class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >{{ t('settings.roleDrawerPermApprove') }}</button>
              <button
                @click.stop="handleReject(approval)"
                class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >{{ t('forms.hubActionReject') }}</button>
              <button
                @click.stop="viewApproval(approval)"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >{{ t('process.execLogsViewDetails') }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Reject Modal -->
    <div
      v-if="rejectingApproval"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      @click.self="rejectingApproval = null"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('common.approvalInboxRejectApproval') }}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">{{ t('common.approvalInboxRejectingWillBlockThisActionPlease') }}</p>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('common.approvalInboxReason') }}<span class="text-red-500">*</span>
          </label>
          <textarea
            v-model="rejectReason"
            rows="3"
            :placeholder="t('common.approvalInboxEnterRejectionReason')"
            class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-indigo-500"
          ></textarea>
        </div>
        <div class="flex items-center justify-end gap-3">
          <button
            @click="rejectingApproval = null; rejectReason = ''"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >{{ t('performance.cancelWizard') }}</button>
          <button
            @click="confirmReject"
            :disabled="!rejectReason.trim() || processing"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ processing ? 'Rejecting...' : 'Reject' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { formatUserDateTime } from '@/utils/localeFormat';
import { formatCurrencyValue } from '@/utils/currencyOptions';

const router = useRouter();
const { success: showSuccess, error: showError } = useNotifications();

const approvals = ref([]);
const loading = ref(true);
const error = ref(null);
const rejectingApproval = ref(null);
const rejectReason = ref('');
const processing = ref(false);

const loadApprovals = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.get('/approvals');
    approvals.value = response.data || [];
  } catch (err) {
    error.value = err.message || 'Failed to load approvals';
    console.error('Error loading approvals:', err);
  } finally {
    loading.value = false;
  }
};

const getApprovalTitle = (approval) => {
  const entityType = approval.entityType || 'record';
  const entityName = getEntityDisplay(approval);
  return `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} approval required`;
};

const getEntityDisplay = (approval) => {
  if (approval.entitySnapshot) {
    const snap = approval.entitySnapshot;
    if (snap.type === 'deal') {
      return `${snap.name || 'Deal'} – ${formatCurrency(snap.value)}`;
    } else if (snap.type === 'people') {
      return snap.name || snap.email || 'Person';
    } else if (snap.type === 'organization') {
      return snap.name || 'Organization';
    } else if (snap.type === 'quote') {
      const total = snap.grandTotal != null ? formatCurrency(snap.grandTotal, snap.currency) : '';
      const rev = snap.revisionNumber ? ` · Rev ${snap.revisionNumber}` : '';
      return `${snap.quoteNumber || snap.name || 'Quote'}${rev}${total ? ` — ${total}` : ''}`;
    }
  }
  return `${approval.entityType || 'Record'} (${approval.entityId || 'Unknown'})`;
};

const riskLabel = (level) => {
  const value = String(level || 'low').toLowerCase();
  if (value === 'high') return 'High risk';
  if (value === 'medium') return 'Medium risk';
  return 'Low risk';
};

const riskBadgeClass = (level) => {
  const value = String(level || 'low').toLowerCase();
  const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  if (value === 'high') return `${base} bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300`;
  if (value === 'medium') return `${base} bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300`;
  return `${base} bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300`;
};

const quoteChangeSummary = (counts = {}) => {
  const sections = (counts.sectionsAdded || 0) + (counts.sectionsRemoved || 0) + (counts.sectionsChanged || 0);
  const lines = (counts.linesAdded || 0) + (counts.linesRemoved || 0) + (counts.linesChanged || 0);
  return `${counts.header || 0} header, ${sections} section, ${lines} line`;
};

const formatCurrency = (value, currency) => {
  if (value == null || value === '') return '';
  return formatCurrencyValue(value, { currencyCode: currency || undefined }) ?? '';
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return formatUserDateTime(date);
};

const formatDueTime = (hours) => {
  if (hours < 1) return 'Less than 1 hour';
  if (hours < 24) return `${Math.floor(hours)} hour${Math.floor(hours) !== 1 ? 's' : ''}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''}`;
};

const viewApproval = (approval) => {
  router.push(`/approvals/${approval._id}`);
};

const handleApprove = async (approval) => {
  if (processing.value) return;
  processing.value = true;
  try {
    const response = await apiClient.post(`/approvals/${approval._id}/approve`);
    if (response.success) {
      showSuccess('Approval granted. Process will continue.');
      await loadApprovals();
    } else {
      showError(response.message || 'Failed to approve');
    }
  } catch (err) {
    showError(err.message || 'Failed to approve');
  } finally {
    processing.value = false;
  }
};

const handleReject = (approval) => {
  rejectingApproval.value = approval;
  rejectReason.value = '';
};

const confirmReject = async () => {
  if (!rejectReason.value.trim() || processing.value) return;
  processing.value = true;
  try {
    const response = await apiClient.post(`/approvals/${rejectingApproval.value._id}/reject`, {
      reason: rejectReason.value.trim()
    });
    if (response.success) {
      showSuccess('Approval rejected. Action has been blocked.');
      rejectingApproval.value = null;
      rejectReason.value = '';
      await loadApprovals();
    } else {
      showError(response.message || 'Failed to reject');
    }
  } catch (err) {
    showError(err.message || 'Failed to reject');
  } finally {
    processing.value = false;
  }
};

onMounted(() => {
  loadApprovals();
});
</script>
