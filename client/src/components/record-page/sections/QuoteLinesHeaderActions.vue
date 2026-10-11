<template>
  <div class="flex flex-wrap items-center justify-end gap-1.5">
    <button
      v-if="canReviewChanges"
      type="button"
      :class="secondaryActionClass('neutral')"
      :disabled="busy"
      @click="reviewChanges"
    >
      {{ t('records.quoteReviewChanges') }}
    </button>
    <button
      v-if="canSubmitForApproval"
      type="button"
      :class="secondaryActionClass('amber')"
      :disabled="busy"
      @click="submitForApproval"
    >
      {{ t('records.quoteActionSubmitApproval') }}
    </button>
    <button
      v-if="canApproveOrReject"
      type="button"
      :class="secondaryActionClass('green')"
      :disabled="busy"
      @click="approve"
    >
      {{ t('records.quoteActionApprove') }}
    </button>
    <button
      v-if="canApproveOrReject"
      type="button"
      :class="secondaryActionClass('red')"
      :disabled="busy"
      @click="reject"
    >
      {{ t('records.quoteActionReject') }}
    </button>
    <button
      v-if="canRevise"
      type="button"
      :class="secondaryActionClass('neutral')"
      :disabled="busy"
      @click="revise"
    >
      {{ t('records.quoteActionCreateRevision') }}
    </button>
    <button
      v-if="showSendEmailButton"
      type="button"
      :class="primaryActionClass"
      :disabled="busy"
      @click="showSendEmail = true"
    >
      {{ sendEmailLabel }}
    </button>

    <QuoteSendEmailDrawer
      :is-open="showSendEmail"
      :record="record"
      :send-mode="sendEmailMode"
      @close="showSendEmail = false"
      @sent="onQuoteEmailSent"
    />

    <Menu as="div" class="relative">
      <MenuButton
        :class="menuTriggerClass"
        :disabled="busy"
      >
        {{ t('records.linesMoreActions') }}
        <ChevronDownIcon class="h-3.5 w-3.5 text-gray-400" />
      </MenuButton>
      <transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="transform opacity-0 scale-95"
      >
        <MenuItems
          class="absolute right-0 top-full z-30 mt-1 w-52 rounded-lg bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black/5 dark:ring-white/10"
        >
          <MenuItem v-if="canOverrideLock" v-slot="{ active }">
            <label
              :class="[
                'flex items-center gap-2 px-4 py-2 text-sm cursor-pointer',
                active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
              ]"
            >
              <input v-model="overrideLock" type="checkbox" class="rounded" :disabled="busy" @click.stop />
              <span>{{ t('records.linesOverrideLock') }}</span>
            </label>
          </MenuItem>
          <MenuItem v-slot="{ active }">
            <button
              type="button"
              :class="menuItemClass(active)"
              :disabled="busy"
              @click="recalculate"
            >
              {{ t('records.linesRecalculate') }}
            </button>
          </MenuItem>
          <MenuItem v-slot="{ active }">
            <button
              type="button"
              :class="menuItemClass(active)"
              :disabled="busy"
              @click="generatePdf"
            >
              {{ t('records.quoteActionGeneratePdf') }}
            </button>
          </MenuItem>
          <MenuItem v-slot="{ active }">
            <button
              type="button"
              :class="menuItemClass(active)"
              :disabled="busy || !canCopyShareLink"
              :title="shareLinkDisabledTitle"
              @click.stop="copyShareLink"
            >
              {{ t('records.quoteActionCopyLink') }}
            </button>
          </MenuItem>
          <MenuItem v-if="hasShareToken" v-slot="{ active }">
            <button
              type="button"
              :class="[menuItemClass(active), 'text-red-600 dark:text-red-400']"
              :disabled="busy"
              @click="revokeShareLink"
            >
              {{ t('records.quoteActionRevokeLink') }}
            </button>
          </MenuItem>
        </MenuItems>
      </transition>
    </Menu>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { ChevronDownIcon } from '@heroicons/vue/20/solid';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { useAuthStore } from '@/stores/authRegistry';
import {
  isCommerciallyLockedStatus,
  canSendQuoteToCustomer,
  getSendQuoteButtonLabelKey,
  resolveCustomerSendMode,
  getCopyShareLinkEligibility,
  getShareQuoteBlockMessageKey,
  getQuoteOrgSettingsFromAuth
} from '@/constants/quoteLifecycle';
import { useQuoteLinesSession } from '@/composables/useQuoteLinesSession';
import QuoteSendEmailDrawer from '@/components/record-page/sections/QuoteSendEmailDrawer.vue';
import {
  buildPublicQuoteUrl,
  copyTextToClipboardWithinGesture,
  copyTextToClipboardWithPromptFallback,
  promptCopyFallback
} from '@/utils/copyToClipboard';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const notifications = useNotifications();
const authStore = useAuthStore();
const router = useRouter();

const quoteId = computed(() => props.record?._id);
const { busy, overrideLock } = useQuoteLinesSession(quoteId);
const showSendEmail = ref(false);

const quoteStatus = computed(() => String(props.record?.status || '').trim());
const commerciallyLocked = computed(() => isCommerciallyLockedStatus(quoteStatus.value));

const canOverrideLock = computed(() => {
  if (authStore.user?.isOwner) return true;
  const role = String(authStore.user?.role || '').toLowerCase();
  return role === 'owner' || role === 'admin';
});

const linesEditable = computed(() => {
  if (!commerciallyLocked.value) return true;
  return overrideLock.value && canOverrideLock.value;
});

const orgQuoteSettings = computed(() => getQuoteOrgSettingsFromAuth(authStore));

const canApproveOrReject = computed(() => canOverrideLock.value && quoteStatus.value === 'Pending Approval');
const canSubmitForApproval = computed(() => quoteStatus.value === 'Draft' && linesEditable.value);
const hasShareToken = computed(() => Boolean(props.record?.publicShareToken));
const copyShareEligibility = computed(() =>
  getCopyShareLinkEligibility(props.record, orgQuoteSettings.value)
);
const canCopyShareLink = computed(() => copyShareEligibility.value.allowed);
const shareLinkDisabledTitle = computed(() => {
  if (canCopyShareLink.value) return '';
  const key = getShareQuoteBlockMessageKey(props.record, orgQuoteSettings.value);
  return key ? t(key) : t('records.quoteShareDisabledTooltip');
});

const canRevise = computed(() => {
  const s = quoteStatus.value;
  return ['Sent', 'Viewed', 'Accepted', 'Partially Accepted', 'Converted', 'Expired', 'Rejected', 'Cancelled'].includes(s);
});
const canReviewChanges = computed(() => {
  const rev = Number(props.record?.revisionNumber) || 1;
  return rev > 1 && ['Draft', 'Pending Approval', 'Approved', 'Sent'].includes(quoteStatus.value);
});

const showSendEmailButton = computed(() => canSendQuoteToCustomer(props.record, orgQuoteSettings.value));

const sendEmailMode = computed(() => resolveCustomerSendMode(props.record, orgQuoteSettings.value));

const sendEmailLabel = computed(() => t(getSendQuoteButtonLabelKey(props.record)));

const primaryActionClass =
  'inline-flex h-7 items-center rounded-md bg-indigo-600 px-2.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50';

const menuTriggerClass =
  'inline-flex h-7 items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/60 disabled:opacity-50';

function secondaryActionClass(variant) {
  const base =
    'inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium disabled:opacity-50';
  if (variant === 'amber') {
    return `${base} border-amber-200 bg-amber-50/80 text-amber-800 hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/50`;
  }
  if (variant === 'green') {
    return `${base} border-green-200 bg-green-50/80 text-green-800 hover:bg-green-100 dark:border-green-800/60 dark:bg-green-950/30 dark:text-green-200 dark:hover:bg-green-950/50`;
  }
  if (variant === 'red') {
    return `${base} border-red-200 bg-red-50/80 text-red-800 hover:bg-red-100 dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50`;
  }
  return `${base} border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/60`;
}

async function onQuoteEmailSent(data) {
  const toastKey =
    data?.sendMode === 'draft' ? 'records.quoteSendDraftEmailSuccess' : 'records.quoteSendEmailSuccess';
  notifications.success(t(toastKey));
  await refresh(
    data?.quote ? { type: 'quote-updated', quote: data.quote } : { type: 'soft-refresh' }
  );
}

function menuItemClass(active) {
  return [
    'w-full text-left px-4 py-2 text-sm transition-colors',
    active ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
  ];
}

function notifySectionUpdated(payload) {
  if (typeof props.context?.onSectionUpdated === 'function') {
    props.context.onSectionUpdated({ sectionKey: 'lines', payload });
  }
}

async function refresh(payload = { type: 'soft-refresh' }) {
  notifySectionUpdated(payload);
}

async function recalculate() {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/recalculate`, {
      overridePricing: overrideLock.value === true
    });
    if (res?.success) {
      await refresh();
    } else {
      notifications.error(res?.message || t('records.linesRecalculateFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesRecalculateFailed'));
  } finally {
    busy.value = false;
  }
}

async function revise() {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/revise`, {});
    if (res?.success && res?.data?._id) {
      notifications.success(t('records.quoteRevisionCreated'));
      router.push({ name: 'quote-detail', params: { id: res.data._id } });
      return;
    }
    notifications.error(res?.message || t('records.quoteRevisionFailed'));
  } catch (e) {
    notifications.error(e?.message || t('records.quoteRevisionFailed'));
  } finally {
    busy.value = false;
  }
}

async function submitForApproval() {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/submit-for-approval`, {});
    if (res?.success) {
      notifications.success(t('records.quoteSubmittedApproval'));
      await refresh(
        res?.data ? { type: 'quote-updated', quote: res.data } : { type: 'soft-refresh' }
      );
      return;
    }
    notifications.error(res?.message || t('records.quoteSubmitApprovalFailed'));
  } catch (e) {
    notifications.error(e?.message || t('records.quoteSubmitApprovalFailed'));
  } finally {
    busy.value = false;
  }
}

async function approve() {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/approve`, {});
    if (res?.success) {
      notifications.success(t('records.quoteApproved'));
      await refresh(
        res?.data ? { type: 'quote-updated', quote: res.data } : { type: 'soft-refresh' }
      );
      return;
    }
    notifications.error(res?.message || t('records.quoteApproveFailed'));
  } catch (e) {
    notifications.error(e?.message || t('records.quoteApproveFailed'));
  } finally {
    busy.value = false;
  }
}

async function reject() {
  if (!props.record?._id) return;
  const reason = window.prompt('Enter rejection reason');
  if (!reason?.trim()) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/reject`, { reason: reason.trim() });
    if (res?.success) {
      notifications.success(t('records.quoteRejected'));
      await refresh(
        res?.data ? { type: 'quote-updated', quote: res.data } : { type: 'soft-refresh' }
      );
      return;
    }
    notifications.error(res?.message || t('records.quoteRejectFailed'));
  } catch (e) {
    notifications.error(e?.message || t('records.quoteRejectFailed'));
  } finally {
    busy.value = false;
  }
}

function reviewChanges() {
  if (!props.record?._id) return;
  const toRevision = Number(props.record?.revisionNumber) || 1;
  router.push({
    name: 'quote-revision-compare',
    params: { id: String(props.record._id) },
    query: {
      fromRevision: Math.max(1, toRevision - 1),
      toRevision
    }
  });
}

async function generatePdf() {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/documents/generate`, {});
    if (res?.success && res?.data?.filePath) {
      notifications.success(t('records.quotePdfGenerated'));
      window.open(res.data.filePath, '_blank');
      await refresh({ type: 'soft-refresh' });
      return;
    }
    notifications.error(res?.message || t('records.quotePdfFailed'));
  } catch (e) {
    notifications.error(e?.message || t('records.quotePdfFailed'));
  } finally {
    busy.value = false;
  }
}

async function copyShareLink() {
  if (!props.record?._id || !canCopyShareLink.value) return;

  const existingToken = props.record?.publicShareToken;
  const promptLabel = t('records.quoteActionCopyLink');

  if (existingToken) {
    const url = buildPublicQuoteUrl(existingToken);
    if (
      !copyTextToClipboardWithinGesture(url) &&
      !promptCopyFallback(url, promptLabel)
    ) {
      notifications.error(t('records.quoteShareFailed'));
      return;
    }
    notifications.success(t('records.quoteLinkCopied'));
    return;
  }

  busy.value = true;
  try {
    const mode = copyShareEligibility.value.mode === 'draft' ? 'draft' : 'formal';
    const res = await apiClient.post(`/quotes/${props.record._id}/share`, { rotateToken: false, mode });
    const url =
      res?.data?.publicUrl ||
      buildPublicQuoteUrl(res?.data?.publicShareToken);
    if (!res?.success || !url) {
      notifications.error(res?.message || t('records.quoteShareFailed'));
      return;
    }
    const copied = await copyTextToClipboardWithPromptFallback(url, promptLabel);
    if (!copied) {
      notifications.error(t('records.quoteShareFailed'));
      return;
    }
    notifications.success(t('records.quoteLinkCopied'));
    await refresh(
      res?.data ? { type: 'quote-updated', quote: res.data } : { type: 'soft-refresh' }
    );
  } catch (e) {
    notifications.error(e?.message || t('records.quoteShareFailed'));
  } finally {
    busy.value = false;
  }
}

async function revokeShareLink() {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/share/revoke`, {});
    if (res?.success) {
      notifications.success(t('records.quoteLinkRevoked'));
      await refresh(
        res?.data ? { type: 'quote-updated', quote: res.data } : { type: 'soft-refresh' }
      );
      return;
    }
    notifications.error(res?.message || t('records.quoteRevokeFailed'));
  } catch (e) {
    notifications.error(e?.message || t('records.quoteRevokeFailed'));
  } finally {
    busy.value = false;
  }
}
</script>
