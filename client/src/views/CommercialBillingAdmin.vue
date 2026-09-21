<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  XCircleIcon,
} from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { formatInrFromPaise } from '@/utils/commercialPricingApi';
import { isValidGstin } from '@/utils/gstin';
import { formatUserDate } from '@/utils/localeFormat';
import { useNotifications } from '@/composables/useNotifications';
import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';
import { openRecordInTab } from '@/utils/tabNavigation';
import CommercialInvoiceReviseDrawer from '@/components/settings/CommercialInvoiceReviseDrawer.vue';
import CommercialInvoiceMarkPaidDrawer from '@/components/settings/CommercialInvoiceMarkPaidDrawer.vue';
import CommercialInvoicePdfSettingsDrawer from '@/components/settings/CommercialInvoicePdfSettingsDrawer.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import {
  buildInvoiceVersionOptions,
  getInvoiceRevisionMeta,
  getInvoiceVersionSnapshot,
} from '@/utils/invoiceRevisionMeta';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { success, error: notifyError } = useNotifications();
const authStore = useAuthStore();

const loading = ref(true);
const detailLoading = ref(false);
const subscriptions = ref([]);
const pendingPayments = ref([]);
const includeSandbox = ref(false);
const pdfSettingsLoading = ref(false);
const pdfSettingsSaving = ref(false);
const pdfSettingsEditLayoutBusy = ref(false);
const pdfSettingsOpen = ref(false);
const pdfSettingsDraft = ref({
  legalName: '',
  gstin: '',
  pan: '',
  address: '',
  email: '',
  phone: '',
  tagline: '',
  website: '',
  paymentTerms: '',
  paymentInstructions: '',
  bankDetails: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
  ifsc: '',
  upiId: '',
  reason: '',
});
const pdfSettingsMeta = ref({ updatedAt: null, updateReason: '' });

const pdfSettingsUpdatedLabel = computed(() => {
  if (!pdfSettingsMeta.value.updatedAt) return '';
  return t('platform.commercialAdminPdfSettingsUpdated', {
    date: formatDate(pdfSettingsMeta.value.updatedAt),
  });
});
const busyId = ref(null);
const selectedOrgId = ref(null);
const detail = ref(null);
const statusDraft = ref('');
const billToDraft = ref({ companyName: '', gstin: '', line1: '', city: '', state: '', pincode: '' });
const billToEditing = ref(false);
const billToCorrectionReason = ref('');
const expandedInvoiceId = ref(null);
const creditAmountRupees = ref('');
const creditReason = ref('');
const pendingDiscountRupees = ref('');
const pendingDiscountReason = ref('');
const recurringDiscountRupees = ref('');
const recurringDiscountPeriods = ref('12');
const recurringDiscountReason = ref('');
/** @type {import('vue').Ref<'credit' | 'oneshot' | 'recurring'>} */
const opsTool = ref('credit');
/** @type {import('vue').Ref<null | { type: 'void' | 'credit_note', invoice: Record<string, unknown> }>} */
const invoiceAction = ref(null);
const invoiceActionReason = ref('');
const invoiceActionAmountRupees = ref('');
/** Invoice currently open in revise drawer (null when closed). */
const reviseInvoice = ref(null);
/** Invoice open in mark-paid drawer. */
const markPaidInvoice = ref(null);
/** Selected historical version per invoice id (number). */
const invoiceViewVersion = ref({});
/** @type {import('vue').Ref<null | { invoice: object, targetVersion: number, reason: string }>} */
const restoreDraft = ref(null);

function rupeesToPaise(value) {
  const n = Number(String(value || '').replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function paiseToRupeesInput(paise) {
  const n = Math.max(0, Number(paise) || 0);
  if (n <= 0) return '';
  return String(n / 100);
}

const selectedOrgName = computed(() => {
  const org = detail.value?.organization;
  return org?.companyName || org?.name || selectedOrgId.value || '';
});

const isSandboxOrg = computed(() => Boolean(
  detail.value?.isSandbox
  || detail.value?.instance?.isInternal
  || detail.value?.subscription?.metadata?.sandboxInternal
  || detail.value?.subscription?.metadata?.notBillable
));

const adminShowTaxRows = computed(() =>
  !isSandboxOrg.value && Number(detail.value?.taxEstimate?.taxMinor) > 0
);

const adminProjectedHeadlineMinor = computed(() => {
  if (adminShowTaxRows.value) {
    return Number(detail.value?.taxEstimate?.totalMinor) || 0;
  }
  return detail.value?.recurringTotalMinor || 0;
});

const subscriptionStatusChipClass = computed(() => {
  const s = String(detail.value?.subscription?.status || '').toLowerCase();
  if (s === 'active') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (s === 'past_due' || s === 'payment_pending' || s === 'trial_expired') {
    return 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200';
  }
  if (s === 'canceled' || s === 'expired') {
    return 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200';
  }
  return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300';
});

function formatDate(value) {
  if (!value) return '—';
  try {
    return formatUserDate(value);
  } catch {
    return String(value);
  }
}

function orgLabel(row) {
  return row?.organization?.companyName
    || row?.organization?.name
    || row?.organizationId
    || '—';
}

async function load() {
  loading.value = true;
  try {
    const params = includeSandbox.value ? { includeSandbox: true } : {};
    const [subsRes, payRes] = await Promise.all([
      apiClient.get('/billing/admin/subscriptions', { params }),
      apiClient.get('/billing/admin/payments/pending', { params }),
    ]);
    subscriptions.value = subsRes?.data?.subscriptions || subsRes?.subscriptions || [];
    pendingPayments.value = payRes?.data?.payments || payRes?.payments || [];
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminLoadFailed'));
  } finally {
    loading.value = false;
  }
}

function applyPdfSettingsPayload(data) {
  const stored = data?.stored;
  const effective = data?.effective || {};
  pdfSettingsDraft.value = {
    legalName: stored?.legalName || effective.legalName || '',
    gstin: stored?.gstin || effective.gstin || '',
    pan: stored?.pan || effective.pan || '',
    address: stored?.address || effective.address || '',
    email: stored?.email || effective.email || '',
    phone: stored?.phone || effective.phone || '',
    tagline: stored?.tagline || effective.tagline || '',
    website: stored?.website || effective.website || '',
    paymentTerms: stored?.paymentTerms || effective.paymentTerms || '',
    paymentInstructions: stored?.paymentInstructions || effective.paymentInstructions || '',
    bankDetails: stored?.bankDetails || effective.bankDetails || '',
    bankName: stored?.bankName || effective.bankName || '',
    accountName: stored?.accountName || effective.accountName || '',
    accountNumber: stored?.accountNumber || effective.accountNumber || '',
    ifsc: stored?.ifsc || effective.ifsc || '',
    upiId: stored?.upiId || effective.upiId || '',
    reason: '',
  };
  pdfSettingsMeta.value = {
    updatedAt: stored?.updatedAt || null,
    updateReason: stored?.updateReason || '',
  };
}

async function loadPdfSettings() {
  pdfSettingsLoading.value = true;
  try {
    const res = await apiClient.get('/billing/admin/invoice-pdf-settings');
    applyPdfSettingsPayload(res?.data || res || {});
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminPdfSettingsLoadFailed'));
  } finally {
    pdfSettingsLoading.value = false;
  }
}

async function openPdfSettings() {
  pdfSettingsOpen.value = true;
  await loadPdfSettings();
}

function closePdfSettings() {
  if (pdfSettingsSaving.value) return;
  pdfSettingsOpen.value = false;
}

function onPdfSettingsDraftUpdate(next) {
  pdfSettingsDraft.value = next;
}

async function openInvoiceLayoutBuilder() {
  pdfSettingsEditLayoutBusy.value = true;
  try {
    const res = await apiClient.post('/billing/admin/invoice-pdf-settings/ensure-template', {
      force: false,
    });
    const data = res?.data || res || {};
    const builderPath = data.builderPath || (data.templateId ? `/templates/${data.templateId}/builder` : null);
    if (!builderPath) {
      throw new Error(t('platform.commercialAdminPdfSettingsEditLayoutFailed'));
    }
    const currentOrgId = String(authStore.user?.organizationId || authStore.organizationId || '');
    const templateOrgId = String(data.templateOrganizationId || '');
    if (templateOrgId && currentOrgId && templateOrgId !== currentOrgId) {
      notifyError(t('platform.commercialAdminPdfSettingsEditLayoutOrgSwitch'));
    }
    if (data.reset) {
      success(t('platform.commercialAdminPdfSettingsLayoutReset'));
    }
    const templateId = String(data.templateId || '').trim();
    const title = String(data.name || data.templateName || '').trim() || t('platform.commercialAdminPdfSettingsEditLayout');
    openRecordInTab(builderPath, {
      title,
      icon: 'document-text',
      params: templateId ? { id: templateId, name: title } : undefined,
      name: templateId ? `template-builder-${templateId}` : undefined,
    });
    pdfSettingsOpen.value = false;
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminPdfSettingsEditLayoutFailed'));
  } finally {
    pdfSettingsEditLayoutBusy.value = false;
  }
}

async function savePdfSettings() {
  pdfSettingsSaving.value = true;
  try {
    const d = pdfSettingsDraft.value;
    const res = await apiClient.put('/billing/admin/invoice-pdf-settings', {
      legalName: d.legalName,
      gstin: d.gstin,
      pan: d.pan,
      address: d.address,
      email: d.email,
      phone: d.phone,
      tagline: d.tagline,
      website: d.website,
      paymentTerms: d.paymentTerms,
      paymentInstructions: d.paymentInstructions,
      bankDetails: d.bankDetails,
      bankName: d.bankName,
      accountName: d.accountName,
      accountNumber: d.accountNumber,
      ifsc: d.ifsc,
      upiId: d.upiId,
      reason: d.reason,
    });
    applyPdfSettingsPayload(res?.data || res || {});
    success(t('platform.commercialAdminPdfSettingsSaved'));
    pdfSettingsOpen.value = false;
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminPdfSettingsSaveFailed'));
  } finally {
    pdfSettingsSaving.value = false;
  }
}

function onIncludeSandboxChange() {
  load();
}

async function loadDetail(organizationId) {
  if (!organizationId) {
    detail.value = null;
    return;
  }
  detailLoading.value = true;
  try {
    const res = await apiClient.get(`/billing/admin/organizations/${organizationId}`);
    detail.value = res?.data || res || null;
    statusDraft.value = detail.value?.subscription?.status || '';
    const addr = detail.value?.organization?.billingAddressStructured || {};
    billToDraft.value = {
      companyName: detail.value?.organization?.companyName || '',
      gstin: detail.value?.organization?.gstin || '',
      line1: addr.line1 || '',
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.pincode || '',
    };
    billToEditing.value = false;
    billToCorrectionReason.value = '';
    const pendingPaise = detail.value?.pendingDiscountMinor || 0;
    pendingDiscountRupees.value = pendingPaise > 0 ? String(pendingPaise / 100) : '';
    pendingDiscountReason.value = detail.value?.pendingDiscountReason || '';
    const recurringPaise = detail.value?.recurringDiscountMinor || 0;
    const remaining = detail.value?.recurringDiscountPeriodsRemaining || 0;
    recurringDiscountRupees.value = recurringPaise > 0 && remaining > 0
      ? String(recurringPaise / 100)
      : '';
    recurringDiscountPeriods.value = remaining > 0
      ? String(remaining)
      : '12';
    recurringDiscountReason.value = detail.value?.recurringDiscountReason || '';
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminDetailFailed'));
    detail.value = null;
  } finally {
    detailLoading.value = false;
  }
}

function openOrg(organizationId) {
  selectedOrgId.value = String(organizationId);
  router.replace({
    path: '/control/billing',
    query: { org: String(organizationId) },
  });
}

function backToList() {
  selectedOrgId.value = null;
  detail.value = null;
  router.replace({ path: '/control/billing' });
}

async function approve(paymentId) {
  busyId.value = paymentId;
  try {
    await apiClient.post(`/billing/admin/payments/${paymentId}/approve`, {});
    success(t('platform.commercialAdminApproved'));
    await load();
    if (selectedOrgId.value) await loadDetail(selectedOrgId.value);
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminActionFailed'));
  } finally {
    busyId.value = null;
  }
}

async function reject(paymentId) {
  busyId.value = paymentId;
  try {
    await apiClient.post(`/billing/admin/payments/${paymentId}/reject`, {
      notes: 'Rejected by admin',
    });
    success(t('platform.commercialAdminRejected'));
    await load();
    if (selectedOrgId.value) await loadDetail(selectedOrgId.value);
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminActionFailed'));
  } finally {
    busyId.value = null;
  }
}

async function suspendOrg() {
  if (!selectedOrgId.value) return;
  busyId.value = 'suspend';
  try {
    await apiClient.post(`/billing/admin/organizations/${selectedOrgId.value}/suspend`, {});
    success(t('platform.commercialAdminSuspended'));
    await loadDetail(selectedOrgId.value);
    await load();
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminActionFailed'));
  } finally {
    busyId.value = null;
  }
}

async function restoreOrg() {
  if (!selectedOrgId.value) return;
  busyId.value = 'restore';
  try {
    await apiClient.post(`/billing/admin/organizations/${selectedOrgId.value}/restore`, {});
    success(t('platform.commercialAdminRestored'));
    await loadDetail(selectedOrgId.value);
    await load();
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminActionFailed'));
  } finally {
    busyId.value = null;
  }
}

async function saveStatus() {
  if (!selectedOrgId.value || !statusDraft.value) return;
  busyId.value = 'status';
  try {
    await apiClient.post(
      `/billing/admin/organizations/${selectedOrgId.value}/subscription-status`,
      { status: statusDraft.value }
    );
    success(t('platform.commercialAdminStatusUpdated'));
    await loadDetail(selectedOrgId.value);
    await load();
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminActionFailed'));
  } finally {
    busyId.value = null;
  }
}

const billToGstinError = computed(() => {
  const raw = String(billToDraft.value.gstin || '').trim();
  if (!raw) return null;
  if (!isValidGstin(raw)) return t('settings.billingFieldGstinInvalid');
  return null;
});

async function saveBillingParty() {
  if (!selectedOrgId.value) return;
  if (String(billToCorrectionReason.value || '').trim().length < 3) {
    notifyError(t('platform.commercialAdminReasonRequired'));
    return;
  }
  const gstinRaw = String(billToDraft.value.gstin || '').trim();
  if (gstinRaw && !isValidGstin(gstinRaw)) {
    notifyError(t('settings.billingFieldGstinInvalid'));
    return;
  }
  busyId.value = 'billing';
  try {
    await apiClient.patch(
      `/billing/admin/organizations/${selectedOrgId.value}/billing-party`,
      {
        companyName: billToDraft.value.companyName,
        gstin: gstinRaw ? gstinRaw.toUpperCase() : '',
        billingAddressStructured: {
          line1: billToDraft.value.line1,
          city: billToDraft.value.city,
          state: billToDraft.value.state,
          pincode: billToDraft.value.pincode,
        },
        reason: billToCorrectionReason.value,
      }
    );
    success(t('platform.commercialAdminBillingCorrected'));
    billToEditing.value = false;
    billToCorrectionReason.value = '';
    await loadDetail(selectedOrgId.value);
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminActionFailed'));
  } finally {
    busyId.value = null;
  }
}

function startBillToCorrection() {
  billToEditing.value = true;
  billToCorrectionReason.value = '';
}

function cancelBillToCorrection() {
  billToEditing.value = false;
  billToCorrectionReason.value = '';
  const addr = detail.value?.organization?.billingAddressStructured || {};
  billToDraft.value = {
    companyName: detail.value?.organization?.companyName || '',
    gstin: detail.value?.organization?.gstin || '',
    line1: addr.line1 || '',
    city: addr.city || '',
    state: addr.state || '',
    pincode: addr.pincode || '',
  };
}

const billToDisplayLines = computed(() => {
  const org = detail.value?.organization;
  if (!org) return [];
  const addr = org.billingAddressStructured || {};
  const lines = [];
  if (org.companyName) lines.push(org.companyName);
  else if (org.name) lines.push(org.name);
  if (org.gstin) lines.push(org.gstin);
  if (addr.line1) lines.push(addr.line1);
  const cityLine = [addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
  if (cityLine) lines.push(cityLine);
  return lines;
});

async function openMarkPaid(inv) {
  markPaidInvoice.value = inv;
}

function closeMarkPaid() {
  markPaidInvoice.value = null;
}

async function onMarkPaidSave(payload) {
  if (!selectedOrgId.value || !payload?.invoiceId) return;
  busyId.value = `mark-paid-${payload.invoiceId}`;
  try {
    const token = authStore.user?.token;
    const form = new FormData();
    form.append('providerReference', payload.providerReference || '');
    if (payload.notes) form.append('notes', payload.notes);
    if (payload.receiptFile) form.append('receipt', payload.receiptFile);
    const res = await fetch(
      getApiUrlForFetch(
        `/billing/admin/organizations/${selectedOrgId.value}/invoices/${payload.invoiceId}/mark-paid`
      ),
      {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form,
        credentials: 'include',
      }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.message || t('platform.commercialAdminActionFailed'));
    }
    success(t('platform.commercialAdminMarkedPaid'));
    closeMarkPaid();
    await loadDetail(selectedOrgId.value);
    await load();
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminActionFailed'));
  } finally {
    busyId.value = null;
  }
}

async function applyCredit() {
  if (!selectedOrgId.value) return;
  const amountMinor = rupeesToPaise(creditAmountRupees.value);
  if (amountMinor <= 0) {
    notifyError(t('platform.commercialAdminCreditAmountInvalid'));
    return;
  }
  busyId.value = 'credit';
  try {
    await apiClient.post(`/billing/admin/organizations/${selectedOrgId.value}/credits`, {
      amountMinor,
      reason: creditReason.value,
    });
    success(t('platform.commercialAdminCreditApplied'));
    creditAmountRupees.value = '';
    creditReason.value = '';
    await loadDetail(selectedOrgId.value);
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminActionFailed'));
  } finally {
    busyId.value = null;
  }
}

async function voidInvoice(invoiceId, regenerate) {
  if (!selectedOrgId.value) return;
  const reason = String(invoiceActionReason.value || '').trim();
  if (reason.length < 3) {
    notifyError(t('platform.commercialAdminReasonRequired'));
    return;
  }
  busyId.value = `void-${invoiceId}`;
  try {
    await apiClient.post(
      `/billing/admin/organizations/${selectedOrgId.value}/invoices/${invoiceId}/void`,
      { reason, regenerate: Boolean(regenerate) }
    );
    success(t('platform.commercialAdminInvoiceVoided'));
    closeInvoiceAction();
    await loadDetail(selectedOrgId.value);
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminActionFailed'));
  } finally {
    busyId.value = null;
  }
}

async function issueCreditNote(invoiceId) {
  if (!selectedOrgId.value) return;
  const amountMinor = rupeesToPaise(invoiceActionAmountRupees.value);
  const reason = String(invoiceActionReason.value || '').trim();
  if (reason.length < 3) {
    notifyError(t('platform.commercialAdminReasonRequired'));
    return;
  }
  if (amountMinor <= 0) {
    notifyError(t('platform.commercialAdminCreditAmountInvalid'));
    return;
  }
  busyId.value = `cn-${invoiceId}`;
  try {
    await apiClient.post(
      `/billing/admin/organizations/${selectedOrgId.value}/invoices/${invoiceId}/credit-notes`,
      { amountMinor, reason }
    );
    success(t('platform.commercialAdminCreditNoteIssued'));
    closeInvoiceAction();
    await loadDetail(selectedOrgId.value);
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminActionFailed'));
  } finally {
    busyId.value = null;
  }
}

function openVoidAction(inv) {
  invoiceAction.value = { type: 'void', invoice: inv };
  invoiceActionReason.value = '';
  invoiceActionAmountRupees.value = '';
}

function openCreditNoteAction(inv) {
  invoiceAction.value = { type: 'credit_note', invoice: inv };
  invoiceActionReason.value = '';
  const defaultPaise = inv.amountPaidMinor > 0 ? inv.amountPaidMinor : inv.totalMinor;
  invoiceActionAmountRupees.value = paiseToRupeesInput(defaultPaise);
}

function closeInvoiceAction() {
  invoiceAction.value = null;
  invoiceActionReason.value = '';
  invoiceActionAmountRupees.value = '';
}

async function confirmInvoiceAction() {
  const action = invoiceAction.value;
  if (!action?.invoice?._id) return;
  if (action.type === 'void') {
    await voidInvoice(action.invoice._id, true);
    return;
  }
  await issueCreditNote(action.invoice._id);
}

async function savePendingDiscount() {
  if (!selectedOrgId.value) return;
  const amountMinor = rupeesToPaise(pendingDiscountRupees.value);
  if (amountMinor > 0 && String(pendingDiscountReason.value || '').trim().length < 3) {
    notifyError(t('platform.commercialAdminReasonRequired'));
    return;
  }
  busyId.value = 'pending-discount';
  try {
    await apiClient.put(
      `/billing/admin/organizations/${selectedOrgId.value}/pending-discount`,
      {
        amountMinor,
        reason: pendingDiscountReason.value,
      }
    );
    success(
      amountMinor > 0
        ? t('platform.commercialAdminPendingDiscountSet')
        : t('platform.commercialAdminPendingDiscountCleared')
    );
    await loadDetail(selectedOrgId.value);
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminActionFailed'));
  } finally {
    busyId.value = null;
  }
}

async function clearPendingDiscount() {
  pendingDiscountRupees.value = '';
  pendingDiscountReason.value = '';
  await savePendingDiscount();
}

async function saveRecurringDiscount() {
  if (!selectedOrgId.value) return;
  const amountMinor = rupeesToPaise(recurringDiscountRupees.value);
  const periods = Math.max(0, Math.round(Number(recurringDiscountPeriods.value) || 0));
  if (amountMinor > 0 && periods > 0 && String(recurringDiscountReason.value || '').trim().length < 3) {
    notifyError(t('platform.commercialAdminReasonRequired'));
    return;
  }
  busyId.value = 'recurring-discount';
  try {
    await apiClient.put(
      `/billing/admin/organizations/${selectedOrgId.value}/recurring-discount`,
      {
        amountMinor: amountMinor > 0 && periods > 0 ? amountMinor : 0,
        periods: amountMinor > 0 ? periods : 0,
        reason: recurringDiscountReason.value,
      }
    );
    success(
      amountMinor > 0 && periods > 0
        ? t('platform.commercialAdminRecurringDiscountSet')
        : t('platform.commercialAdminRecurringDiscountCleared')
    );
    await loadDetail(selectedOrgId.value);
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminActionFailed'));
  } finally {
    busyId.value = null;
  }
}

async function clearRecurringDiscount() {
  recurringDiscountRupees.value = '';
  recurringDiscountPeriods.value = '12';
  recurringDiscountReason.value = '';
  await saveRecurringDiscount();
}

function setRecurringPreset(months) {
  recurringDiscountPeriods.value = String(months);
}

function canVoidInvoice(inv) {
  if (!inv) return false;
  if (inv.status === 'void' || inv.status === 'paid') return false;
  if ((inv.amountPaidMinor || 0) > 0) return false;
  return inv.status === 'finalized' || inv.status === 'past_due' || inv.status === 'draft';
}

function canReviseInvoice(inv) {
  return canVoidInvoice(inv);
}

function canCreditNote(inv) {
  if (!inv || inv.status === 'void' || inv.status === 'draft') return false;
  return inv.status === 'paid' || (inv.amountPaidMinor || 0) > 0;
}

function openReviseAction(inv) {
  reviseInvoice.value = inv;
}

function closeReviseAction() {
  reviseInvoice.value = null;
}

function invoiceRevisionMeta(inv) {
  return getInvoiceRevisionMeta(inv);
}

function invoiceVersionOptions(inv) {
  return buildInvoiceVersionOptions(inv).map((o) => ({
    value: o.value,
    label: o.isCurrent
      ? t('platform.commercialAdminVersionCurrent', { version: o.value })
      : t('platform.commercialAdminVersionLabel', { version: o.value }),
  }));
}

function selectedInvoiceVersion(inv) {
  const meta = getInvoiceRevisionMeta(inv);
  const sid = String(inv._id);
  const selected = Number(invoiceViewVersion.value[sid]);
  if (Number.isFinite(selected) && selected >= 1 && selected <= meta.currentVersion) {
    return selected;
  }
  return meta.currentVersion;
}

function setInvoiceViewVersion(inv, version) {
  invoiceViewVersion.value = {
    ...invoiceViewVersion.value,
    [String(inv._id)]: Number(version),
  };
}

function invoiceDisplayLines(inv) {
  const version = selectedInvoiceVersion(inv);
  const snap = getInvoiceVersionSnapshot(inv, version);
  if (!snap) return inv.lines || [];
  return (snap.lines || []).map((l) => ({
    _id: l.lineId,
    description: l.productCode,
    productCode: l.productCode,
    quantity: l.quantity,
    discountMinor: l.discountMinor || 0,
    amountMinor: l.amountMinor,
  }));
}

function invoiceDisplayDiscountMinor(inv) {
  const snap = getInvoiceVersionSnapshot(inv, selectedInvoiceVersion(inv));
  return snap ? (snap.discountMinor || 0) : (inv.discountMinor || 0);
}

function invoiceDisplayTotalMinor(inv) {
  const snap = getInvoiceVersionSnapshot(inv, selectedInvoiceVersion(inv));
  return snap ? (snap.totalMinor || 0) : (inv.totalMinor || 0);
}

function canRestoreSelectedVersion(inv) {
  if (!canReviseInvoice(inv)) return false;
  const meta = getInvoiceRevisionMeta(inv);
  const selected = selectedInvoiceVersion(inv);
  return selected >= 1 && selected < meta.currentVersion;
}

function openRestoreDraft(inv) {
  if (!canRestoreSelectedVersion(inv)) return;
  restoreDraft.value = {
    invoice: inv,
    targetVersion: selectedInvoiceVersion(inv),
    reason: '',
  };
}

function closeRestoreDraft() {
  restoreDraft.value = null;
}

async function submitRestoreDraft() {
  const draft = restoreDraft.value;
  if (!selectedOrgId.value || !draft?.invoice?._id) return;
  const reason = String(draft.reason || '').trim();
  if (reason.length < 3) {
    notifyError(t('platform.commercialAdminReasonRequired'));
    return;
  }
  busyId.value = `restore-${draft.invoice._id}`;
  try {
    await apiClient.post(
      `/billing/admin/organizations/${selectedOrgId.value}/invoices/${draft.invoice._id}/restore-revision`,
      {
        targetVersion: draft.targetVersion,
        reason,
      }
    );
    success(t('platform.commercialAdminInvoiceRestored', { version: draft.targetVersion }));
    closeRestoreDraft();
    await loadDetail(selectedOrgId.value);
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminActionFailed'));
  } finally {
    busyId.value = null;
  }
}

async function onReviseDrawerSave(payload) {
  if (!selectedOrgId.value || !payload?.invoiceId) return;
  busyId.value = `revise-${payload.invoiceId}`;
  try {
    await apiClient.post(
      `/billing/admin/organizations/${selectedOrgId.value}/invoices/${payload.invoiceId}/revise`,
      {
        reason: payload.reason,
        invoiceDiscountMinor: payload.invoiceDiscountMinor,
        lines: payload.lines,
      }
    );
    success(t('platform.commercialAdminInvoiceRevised'));
    closeReviseAction();
    await loadDetail(selectedOrgId.value);
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminActionFailed'));
  } finally {
    busyId.value = null;
  }
}

async function downloadPdf(invoiceId, invoiceNumber) {
  if (!selectedOrgId.value) return;
  try {
    const token = authStore.user?.token;
    const res = await fetch(
      getApiUrlForFetch(
        `/billing/admin/organizations/${selectedOrgId.value}/invoices/${invoiceId}/pdf`
      ),
      {
        headers: {
          Accept: 'application/pdf',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );
    if (!res.ok) throw new Error(t('platform.commercialAdminPdfFailed'));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoiceNumber || 'invoice'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    notifyError(err?.message || t('platform.commercialAdminPdfFailed'));
  }
}

watch(
  () => route.query.org,
  (orgId) => {
    if (orgId) {
      selectedOrgId.value = String(orgId);
      loadDetail(orgId);
    }
  }
);

onMounted(async () => {
  await load();
  if (route.query.org) {
    selectedOrgId.value = String(route.query.org);
    await loadDetail(route.query.org);
  }
});
</script>

<template>
  <div class="mx-auto w-full max-w-6xl pb-12">
    <div class="mb-8">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            v-if="selectedOrgId"
            type="button"
            class="mb-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            @click="backToList"
          >
            <ArrowLeftIcon class="h-4 w-4" />
            {{ t('platform.commercialAdminBack') }}
          </button>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            {{ selectedOrgId ? selectedOrgName : t('platform.commercialAdminTitle') }}
          </h1>
          <p class="mt-2 text-lg text-gray-600 dark:text-gray-400">
            {{
              selectedOrgId
                ? t('platform.commercialAdminDetailSubtitle')
                : t('platform.commercialAdminSubtitle')
            }}
          </p>
        </div>
        <button
          v-if="!selectedOrgId"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          @click="openPdfSettings"
        >
          <DocumentTextIcon class="h-4 w-4" aria-hidden="true" />
          {{ t('platform.commercialAdminPdfSettingsOpen') }}
        </button>
      </div>
    </div>

    <div v-if="loading && !selectedOrgId" class="flex justify-center py-16">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>

    <!-- LIST -->
    <template v-else-if="!selectedOrgId">
      <section class="mb-10">
        <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('platform.commercialAdminPendingPayments') }}
        </h2>
        <ul
          v-if="pendingPayments.length"
          class="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800"
        >
          <li
            v-for="p in pendingPayments"
            :key="p._id"
            class="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div>
              <button
                type="button"
                class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                @click="openOrg(p.organizationId)"
              >
                {{ orgLabel(p) }}
              </button>
              <p class="text-sm text-gray-500">
                {{ p.invoice?.invoiceNumber || '—' }} · {{ formatInrFromPaise(p.amountMinor) }}
                · {{ p.providerReference || '—' }}
              </p>
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                :disabled="busyId === p._id"
                @click="approve(p._id)"
              >
                <CheckCircleIcon class="h-4 w-4" />
                {{ t('platform.commercialAdminApprove') }}
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                :disabled="busyId === p._id"
                @click="reject(p._id)"
              >
                <XCircleIcon class="h-4 w-4" />
                {{ t('platform.commercialAdminReject') }}
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-gray-500">{{ t('platform.commercialAdminNoPending') }}</p>
      </section>

      <section>
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('platform.commercialAdminSubscriptions') }}
          </h2>
          <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              v-model="includeSandbox"
              type="checkbox"
              class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600"
              @change="onIncludeSandboxChange"
            >
            {{ t('platform.commercialAdminShowSandbox') }}
          </label>
        </div>
        <div class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <table class="min-w-full text-left text-sm">
            <thead class="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-700">
              <tr>
                <th class="px-4 py-3">{{ t('platform.commercialAdminOrg') }}</th>
                <th class="px-4 py-3">{{ t('platform.commercialAdminStatus') }}</th>
                <th class="px-4 py-3">{{ t('platform.commercialAdminInstance') }}</th>
                <th class="px-4 py-3">{{ t('platform.commercialAdminCycle') }}</th>
                <th class="px-4 py-3">{{ t('platform.commercialAdminRecurring') }}</th>
                <th class="px-4 py-3">{{ t('platform.commercialAdminPeriodEnd') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr
                v-for="s in subscriptions"
                :key="s._id"
                class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40"
                @click="openOrg(s.organizationId)"
              >
                <td class="px-4 py-3 font-medium text-indigo-600 dark:text-indigo-400">
                  {{ orgLabel(s) }}
                  <span
                    v-if="s.isSandbox"
                    class="ml-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  >{{ t('platform.commercialAdminSandboxChip') }}</span>
                </td>
                <td class="px-4 py-3 capitalize text-gray-600 dark:text-gray-300">{{ s.status }}</td>
                <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {{ s.instance?.status || '—' }}
                </td>
                <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ s.billingCycle }}</td>
                <td class="px-4 py-3 tabular-nums text-gray-700 dark:text-gray-200">
                  {{ formatInrFromPaise(s.recurringTotalMinor || 0) }}
                </td>
                <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {{ formatDate(s.currentPeriodEnd) }}
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!subscriptions.length" class="px-4 py-8 text-center text-sm text-gray-500">
            {{
              includeSandbox
                ? t('platform.commercialAdminNoSubscriptions')
                : t('platform.commercialAdminNoCustomerSubscriptions')
            }}
          </p>
        </div>
      </section>
    </template>

    <!-- DETAIL -->
    <div v-else-if="detailLoading" class="flex justify-center py-16">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>

    <template v-else-if="detail">
      <div
        v-if="isSandboxOrg"
        class="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-100"
      >
        <p class="font-semibold">{{ t('platform.commercialAdminSandboxBannerTitle') }}</p>
        <p class="mt-1 text-indigo-800/90 dark:text-indigo-200/90">
          {{ t('platform.commercialAdminSandboxBannerBody') }}
        </p>
      </div>

      <!-- Actions: blocked on sandbox/internal -->
      <div v-if="!isSandboxOrg" class="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50"
          :disabled="busyId === 'suspend'"
          @click="suspendOrg"
        >
          {{ t('platform.commercialAdminSuspend') }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
          :disabled="busyId === 'restore'"
          @click="restoreOrg"
        >
          {{ t('platform.commercialAdminRestore') }}
        </button>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Subscription summary -->
        <section class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ t('platform.commercialAdminSubscriptionCard') }}
            </h2>
            <span
              class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
              :class="subscriptionStatusChipClass"
            >
              {{ detail.subscription?.status || '—' }}
            </span>
          </div>

          <p class="mt-4 text-3xl font-semibold tracking-tight tabular-nums text-gray-900 dark:text-white">
            {{ formatInrFromPaise(adminProjectedHeadlineMinor) }}
            <span class="text-sm font-medium text-gray-500">
              / {{ detail.subscription?.billingCycle || '—' }}
            </span>
          </p>
          <p
            v-if="adminShowTaxRows"
            class="mt-1 text-xs text-gray-500"
          >
            {{ t('platform.commercialAdminProjectedExGst', {
              amount: formatInrFromPaise(detail.recurringTotalMinor || 0),
            }) }}
          </p>

          <dl
            v-if="adminShowTaxRows"
            class="mt-3 space-y-1.5 text-sm"
          >
            <div class="flex justify-between gap-4">
              <dt class="text-gray-500">{{ t('platform.commercialAdminPlanTotal') }}</dt>
              <dd class="tabular-nums text-gray-800 dark:text-gray-200">
                {{ formatInrFromPaise(detail.recurringTotalMinor || 0) }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-gray-500">
                {{ t('platform.commercialAdminTaxRow', {
                  name: detail.taxEstimate.taxName,
                  rate: detail.taxEstimate.taxRatePercent,
                }) }}
              </dt>
              <dd class="tabular-nums text-gray-800 dark:text-gray-200">
                {{ formatInrFromPaise(detail.taxEstimate.taxMinor) }}
              </dd>
            </div>
            <div class="flex justify-between gap-4 font-semibold">
              <dt class="text-gray-700 dark:text-gray-200">
                {{ t('platform.commercialAdminTotalWithTax', {
                  name: detail.taxEstimate.taxName,
                }) }}
              </dt>
              <dd class="tabular-nums text-gray-900 dark:text-white">
                {{ formatInrFromPaise(detail.taxEstimate.totalMinor) }}
              </dd>
            </div>
          </dl>

          <dl class="mt-5 space-y-2.5 border-t border-gray-100 pt-4 text-sm dark:border-gray-700">
            <div class="flex justify-between gap-4">
              <dt class="text-gray-500">{{ t('platform.commercialAdminPeriod') }}</dt>
              <dd class="text-right text-gray-800 dark:text-gray-200">
                {{ formatDate(detail.subscription?.currentPeriodStart) }}
                –
                {{ formatDate(detail.subscription?.currentPeriodEnd) }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-gray-500">{{ t('platform.commercialAdminInstance') }}</dt>
              <dd class="font-medium text-gray-800 dark:text-gray-200">{{ detail.instance?.status || '—' }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-gray-500">{{ t('platform.commercialAdminProgram') }}</dt>
              <dd class="text-gray-800 dark:text-gray-200">{{ detail.subscription?.pricingProgramCode || '—' }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-gray-500">{{ t('platform.commercialAdminCreditBalance') }}</dt>
              <dd class="tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                {{ formatInrFromPaise(detail.creditBalanceMinor || 0) }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-gray-500">{{ t('platform.commercialAdminPendingDiscount') }}</dt>
              <dd class="text-right tabular-nums font-medium text-gray-800 dark:text-gray-200">
                {{
                  detail.pendingDiscountMinor > 0
                    ? formatInrFromPaise(detail.pendingDiscountMinor)
                    : '—'
                }}
                <span
                  v-if="detail.pendingDiscountReason"
                  class="mt-0.5 block text-xs font-normal text-gray-500"
                >{{ detail.pendingDiscountReason }}</span>
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-gray-500">{{ t('platform.commercialAdminRecurringDiscount') }}</dt>
              <dd class="text-right tabular-nums font-medium text-gray-800 dark:text-gray-200">
                <template v-if="detail.recurringDiscountMinor > 0 && detail.recurringDiscountPeriodsRemaining > 0">
                  {{ formatInrFromPaise(detail.recurringDiscountMinor) }}
                  <span class="mt-0.5 block text-xs font-normal text-gray-500">
                    {{
                      t('platform.commercialAdminRecurringDiscountRemaining', {
                        remaining: detail.recurringDiscountPeriodsRemaining,
                        total: detail.recurringDiscountPeriodsTotal || detail.recurringDiscountPeriodsRemaining,
                      })
                    }}
                  </span>
                </template>
                <template v-else>—</template>
              </dd>
            </div>
          </dl>

          <div v-if="!isSandboxOrg" class="mt-5 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-700">
            <label class="block text-xs font-medium text-gray-500">
              {{ t('platform.commercialAdminSetStatus') }}
              <select
                v-model="statusDraft"
                class="mt-1 block rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              >
                <option value="trialing">trialing</option>
                <option value="trial_expired">trial_expired</option>
                <option value="payment_pending">payment_pending</option>
                <option value="active">active</option>
                <option value="past_due">past_due</option>
                <option value="canceling">canceling</option>
                <option value="canceled">canceled</option>
                <option value="expired">expired</option>
                <option value="paused">paused</option>
              </select>
            </label>
            <button
              type="button"
              class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              :disabled="busyId === 'status'"
              @click="saveStatus"
            >
              {{ t('platform.commercialAdminSaveStatus') }}
            </button>
          </div>
          <p v-else class="mt-4 text-xs text-gray-500">
            {{ t('platform.commercialAdminSandboxStatusLocked') }}
          </p>
        </section>

        <!-- Billing party -->
        <section class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('platform.commercialAdminBillTo') }}
          </h2>
          <p class="mt-1 text-sm text-gray-500">
            {{ t('platform.commercialAdminBillToOwnerHint') }}
          </p>

          <div v-if="!billToEditing" class="mt-4 space-y-3">
            <div class="rounded-lg bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900/50">
              <template v-if="billToDisplayLines.length">
                <p
                  v-for="(line, idx) in billToDisplayLines"
                  :key="idx"
                  :class="idx === 0
                    ? 'font-medium text-gray-900 dark:text-white'
                    : 'mt-0.5 text-gray-600 dark:text-gray-400'"
                >
                  {{ line }}
                </p>
              </template>
              <p v-else class="text-gray-500">{{ t('platform.commercialAdminBillToEmpty') }}</p>
            </div>
            <p class="text-xs text-gray-500">{{ t('platform.commercialAdminBillToFutureOnly') }}</p>
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-900"
              @click="startBillToCorrection"
            >
              {{ t('platform.commercialAdminBillToCorrect') }}
            </button>
          </div>

          <div v-else class="mt-4 space-y-3">
            <p class="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {{ t('platform.commercialAdminBillToCorrectHint') }}
            </p>
            <label class="block text-xs font-medium text-gray-500">
              {{ t('platform.commercialAdminCompany') }}
              <input
                v-model="billToDraft.companyName"
                type="text"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              >
            </label>
            <label class="block text-xs font-medium text-gray-500">
              {{ t('platform.commercialAdminGstin') }}
              <input
                v-model="billToDraft.gstin"
                type="text"
                maxlength="15"
                autocomplete="off"
                spellcheck="false"
                class="mt-1 w-full rounded-lg border px-3 py-2 text-sm uppercase dark:bg-gray-900"
                :class="billToGstinError
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'"
                @blur="billToDraft.gstin = String(billToDraft.gstin || '').trim().toUpperCase()"
              >
              <p v-if="billToGstinError" class="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                {{ billToGstinError }}
              </p>
            </label>
            <label class="block text-xs font-medium text-gray-500">
              {{ t('platform.commercialAdminAddress') }}
              <input
                v-model="billToDraft.line1"
                type="text"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              >
            </label>
            <div class="grid grid-cols-3 gap-2">
              <label class="block text-xs font-medium text-gray-500">
                {{ t('platform.commercialAdminCity') }}
                <input
                  v-model="billToDraft.city"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                >
              </label>
              <label class="block text-xs font-medium text-gray-500">
                {{ t('platform.commercialAdminState') }}
                <input
                  v-model="billToDraft.state"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                >
              </label>
              <label class="block text-xs font-medium text-gray-500">
                {{ t('platform.commercialAdminPincode') }}
                <input
                  v-model="billToDraft.pincode"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                >
              </label>
            </div>
            <label class="block text-xs font-medium text-gray-500">
              {{ t('platform.commercialAdminBillToReason') }}
              <input
                v-model="billToCorrectionReason"
                type="text"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              >
            </label>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                :disabled="busyId === 'billing' || !!billToGstinError"
                @click="saveBillingParty"
              >
                {{ t('platform.commercialAdminBillToSaveCorrection') }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-gray-600"
                :disabled="busyId === 'billing'"
                @click="cancelBillToCorrection"
              >
                {{ t('platform.commercialAdminBillToCancel') }}
              </button>
            </div>
          </div>
        </section>
      </div>

      <!-- Ops: one tool at a time -->
      <section class="mt-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ t('platform.commercialAdminAdjustments') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500">
              {{
                isSandboxOrg
                  ? t('platform.commercialAdminAdjustmentsSandboxHint')
                  : t('platform.commercialAdminAdjustmentsHint')
              }}
            </p>
          </div>
        </div>

        <div
          class="mt-4 inline-flex flex-wrap rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900/40"
          role="tablist"
          :aria-label="t('platform.commercialAdminOpsToolsLabel')"
        >
          <button
            type="button"
            role="tab"
            class="rounded-md px-3 py-1.5 text-sm font-semibold transition"
            :class="opsTool === 'credit'
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'"
            :aria-selected="opsTool === 'credit'"
            @click="opsTool = 'credit'"
          >
            {{ t('platform.commercialAdminOpsToolCredit') }}
          </button>
          <button
            type="button"
            role="tab"
            class="rounded-md px-3 py-1.5 text-sm font-semibold transition"
            :class="opsTool === 'oneshot'
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'"
            :aria-selected="opsTool === 'oneshot'"
            @click="opsTool = 'oneshot'"
          >
            {{ t('platform.commercialAdminOpsToolOneshot') }}
          </button>
          <button
            type="button"
            role="tab"
            class="rounded-md px-3 py-1.5 text-sm font-semibold transition"
            :class="opsTool === 'recurring'
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'"
            :aria-selected="opsTool === 'recurring'"
            @click="opsTool = 'recurring'"
          >
            {{ t('platform.commercialAdminOpsToolRecurring') }}
          </button>
        </div>

        <div class="mt-4 max-w-xl space-y-3">
          <template v-if="opsTool === 'credit'">
            <p class="text-sm text-gray-500">{{ t('platform.commercialAdminOpsCreditHint') }}</p>
            <label class="block text-xs font-medium text-gray-500">
              {{ t('platform.commercialAdminCreditAmount') }}
              <input
                v-model="creditAmountRupees"
                type="text"
                inputmode="decimal"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              >
            </label>
            <label class="block text-xs font-medium text-gray-500">
              {{ t('platform.commercialAdminCreditReason') }}
              <input
                v-model="creditReason"
                type="text"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              >
            </label>
            <button
              type="button"
              class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              :disabled="busyId === 'credit'"
              @click="applyCredit"
            >
              {{ t('platform.commercialAdminApplyCreditCta') }}
            </button>
          </template>

          <template v-else-if="opsTool === 'oneshot'">
            <p class="text-sm text-gray-500">{{ t('platform.commercialAdminPendingDiscountHint') }}</p>
            <label class="block text-xs font-medium text-gray-500">
              {{ t('platform.commercialAdminCreditAmount') }}
              <input
                v-model="pendingDiscountRupees"
                type="text"
                inputmode="decimal"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              >
            </label>
            <label class="block text-xs font-medium text-gray-500">
              {{ t('platform.commercialAdminCreditReason') }}
              <input
                v-model="pendingDiscountReason"
                type="text"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              >
            </label>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                :disabled="busyId === 'pending-discount'"
                @click="savePendingDiscount"
              >
                {{ t('platform.commercialAdminPendingDiscountSave') }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-gray-600"
                :disabled="busyId === 'pending-discount'"
                @click="clearPendingDiscount"
              >
                {{ t('platform.commercialAdminPendingDiscountClear') }}
              </button>
            </div>
          </template>

          <template v-else>
            <p class="text-sm text-gray-500">{{ t('platform.commercialAdminRecurringDiscountHint') }}</p>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block text-xs font-medium text-gray-500">
                {{ t('platform.commercialAdminCreditAmount') }}
                <input
                  v-model="recurringDiscountRupees"
                  type="text"
                  inputmode="decimal"
                  class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                >
              </label>
              <label class="block text-xs font-medium text-gray-500">
                {{ t('platform.commercialAdminRecurringDiscountPeriods') }}
                <input
                  v-model="recurringDiscountPeriods"
                  type="number"
                  min="1"
                  max="60"
                  class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                >
              </label>
            </div>
            <label class="block text-xs font-medium text-gray-500">
              {{ t('platform.commercialAdminCreditReason') }}
              <input
                v-model="recurringDiscountReason"
                type="text"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              >
            </label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="n in [6, 12, 24]"
                :key="n"
                type="button"
                class="rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition dark:border-gray-600"
                :class="String(recurringDiscountPeriods) === String(n)
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                  : 'border-gray-300 text-gray-700 dark:text-gray-200'"
                @click="setRecurringPreset(n)"
              >
                {{ n }} {{ t('platform.commercialAdminRecurringDiscountPeriodsUnit') }}
              </button>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                :disabled="busyId === 'recurring-discount'"
                @click="saveRecurringDiscount"
              >
                {{ t('platform.commercialAdminRecurringDiscountSave') }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-gray-600"
                :disabled="busyId === 'recurring-discount'"
                @click="clearRecurringDiscount"
              >
                {{ t('platform.commercialAdminRecurringDiscountClear') }}
              </button>
            </div>
          </template>
        </div>

        <p class="mt-4 text-xs text-gray-500">
          {{ t('platform.commercialAdminInvoiceActionsHint') }}
        </p>
        <div v-if="detail.creditNotes?.length" class="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {{ t('platform.commercialAdminCreditNotes') }}
          </h3>
          <ul class="mt-2 divide-y divide-gray-100 text-sm dark:divide-gray-700">
            <li
              v-for="cn in detail.creditNotes"
              :key="cn._id"
              class="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div>
                <p class="font-medium tabular-nums">{{ cn.creditNoteNumber }}</p>
                <p class="text-xs text-gray-500">{{ cn.reason }} · {{ cn.kind }}</p>
              </div>
              <span class="tabular-nums font-semibold text-emerald-700">
                −{{ formatInrFromPaise(cn.amountMinor) }}
              </span>
            </li>
          </ul>
        </div>
      </section>

      <!-- Components -->
      <section class="mt-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">
          {{ t('platform.commercialAdminComponents') }}
        </h2>
        <ul class="mt-3 divide-y divide-gray-100 dark:divide-gray-700">
          <li
            v-for="item in detail.items"
            :key="item._id"
            class="flex justify-between gap-4 py-2 text-sm"
          >
            <span>
              {{ item.name }}
              <span class="text-gray-400">· {{ item.productCode }} × {{ item.quantity }}</span>
            </span>
            <span class="tabular-nums font-medium">{{ formatInrFromPaise(item.lineTotalMinor) }}</span>
          </li>
        </ul>
        <p v-if="!detail.items?.length" class="mt-2 text-sm text-gray-500">—</p>

        <h3 class="mt-5 text-sm font-semibold text-gray-800 dark:text-gray-200">
          {{ t('platform.commercialAdminAddons') }}
        </h3>
        <ul v-if="detail.addons?.length" class="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
          <li v-for="(a, idx) in detail.addons" :key="idx">
            {{ a.addonKey || a.key || a }} · {{ a.status || 'ACTIVE' }}
          </li>
        </ul>
        <p v-else class="mt-2 text-sm text-gray-500">{{ t('platform.commercialAdminNoAddons') }}</p>
      </section>

      <!-- Users / apps -->
      <section class="mt-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">
          {{ t('platform.commercialAdminUsers') }}
        </h2>
        <div class="mt-3 overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="text-xs uppercase text-gray-500">
              <tr>
                <th class="py-2 pr-4">{{ t('platform.commercialAdminUser') }}</th>
                <th class="py-2 pr-4">{{ t('platform.commercialAdminUserType') }}</th>
                <th class="py-2 pr-4">{{ t('platform.commercialAdminUserStatus') }}</th>
                <th class="py-2">{{ t('platform.commercialAdminApps') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="u in detail.users" :key="u._id">
                <td class="py-2 pr-4">
                  <p class="font-medium">{{ u.name }}</p>
                  <p class="text-xs text-gray-500">{{ u.email }}</p>
                </td>
                <td class="py-2 pr-4 capitalize">{{ u.userType || '—' }}</td>
                <td class="py-2 pr-4 capitalize">{{ u.status }}</td>
                <td class="py-2 text-xs text-gray-600 dark:text-gray-300">
                  {{ u.apps?.length ? u.apps.join(', ') : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!detail.users?.length" class="mt-2 text-sm text-gray-500">
          {{ t('platform.commercialAdminNoUsers') }}
        </p>
      </section>

      <!-- Invoices -->
      <section class="mt-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">
          {{ t('platform.commercialAdminInvoices') }}
        </h2>
        <ul class="mt-3 divide-y divide-gray-100 dark:divide-gray-700">
          <li v-for="inv in detail.invoices" :key="inv._id" class="py-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                class="text-left"
                @click="expandedInvoiceId = expandedInvoiceId === inv._id ? null : inv._id"
              >
                <p class="font-medium tabular-nums">{{ inv.invoiceNumber }}</p>
                <p class="text-xs capitalize text-gray-500">
                  {{ inv.status }}
                  <span v-if="inv.snapshot?.kind === 'proration'">· proration</span>
                  <span
                    v-if="invoiceRevisionMeta(inv).isRevised"
                    class="ml-1 inline-flex rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold normal-case text-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
                  >
                    {{ t('platform.commercialAdminRevisedBadge', {
                      version: invoiceRevisionMeta(inv).currentVersion,
                    }) }}
                  </span>
                </p>
              </button>
              <div class="flex flex-wrap items-center gap-2">
                <span class="tabular-nums font-semibold">{{ formatInrFromPaise(inv.totalMinor) }}</span>
                <button
                  type="button"
                  class="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold dark:border-gray-600"
                  @click="downloadPdf(inv._id, inv.invoiceNumber)"
                >
                  PDF
                </button>
                <button
                  v-if="inv.status === 'finalized' || inv.status === 'past_due'"
                  type="button"
                  class="rounded-md bg-indigo-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  :disabled="Boolean(busyId)"
                  @click="openMarkPaid(inv)"
                >
                  {{ t('platform.commercialAdminMarkPaid') }}
                </button>
                <button
                  v-if="canReviseInvoice(inv)"
                  type="button"
                  class="rounded-md border border-indigo-300 px-2 py-1 text-xs font-semibold text-indigo-800 disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-200"
                  :disabled="Boolean(busyId)"
                  @click="openReviseAction(inv)"
                >
                  {{ t('platform.commercialAdminRevise') }}
                </button>
                <button
                  v-if="canVoidInvoice(inv)"
                  type="button"
                  class="rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-800 disabled:opacity-50"
                  :disabled="Boolean(busyId)"
                  @click="openVoidAction(inv)"
                >
                  {{ t('platform.commercialAdminVoidRegenerate') }}
                </button>
                <button
                  v-if="canCreditNote(inv)"
                  type="button"
                  class="rounded-md border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-800 disabled:opacity-50"
                  :disabled="Boolean(busyId)"
                  @click="openCreditNoteAction(inv)"
                >
                  {{ t('platform.commercialAdminIssueCreditNote') }}
                </button>
              </div>
            </div>
            <ul
              v-if="expandedInvoiceId === inv._id"
              class="mt-2 space-y-1 rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-900/50"
            >
              <li
                v-if="invoiceRevisionMeta(inv).isRevised"
                class="flex flex-wrap items-center gap-2 pb-2"
              >
                <span class="font-medium text-gray-600 dark:text-gray-300">
                  {{ t('platform.commercialAdminVersionSelect') }}
                </span>
                <div class="min-w-[10rem] flex-1">
                  <HeadlessSelect
                    :model-value="selectedInvoiceVersion(inv)"
                    :options="invoiceVersionOptions(inv)"
                    @update:model-value="(v) => setInvoiceViewVersion(inv, v)"
                  />
                </div>
                <button
                  v-if="canRestoreSelectedVersion(inv)"
                  type="button"
                  class="rounded-md border border-violet-300 px-2 py-1 text-xs font-semibold text-violet-800 disabled:opacity-50 dark:border-violet-700 dark:text-violet-200"
                  :disabled="Boolean(busyId)"
                  @click="openRestoreDraft(inv)"
                >
                  {{ t('platform.commercialAdminRestoreVersion') }}
                </button>
              </li>
              <li
                v-for="line in invoiceDisplayLines(inv)"
                :key="line._id"
                class="flex justify-between gap-2"
              >
                <span>
                  {{ line.description || line.productCode }} × {{ line.quantity }}
                  <span
                    v-if="line.discountMinor"
                    class="text-emerald-700"
                  > (−{{ formatInrFromPaise(line.discountMinor) }})</span>
                </span>
                <span class="tabular-nums">{{ formatInrFromPaise(line.amountMinor) }}</span>
              </li>
              <li
                v-if="invoiceDisplayDiscountMinor(inv)"
                class="flex justify-between gap-2 text-emerald-700"
              >
                <span>{{ t('platform.commercialAdminInvoiceDiscount') }}</span>
                <span class="tabular-nums">−{{ formatInrFromPaise(invoiceDisplayDiscountMinor(inv)) }}</span>
              </li>
              <li class="flex justify-between gap-2 font-semibold text-gray-800 dark:text-gray-100">
                <span>{{ t('platform.commercialAdminPreviewTotal') }}</span>
                <span class="tabular-nums">{{ formatInrFromPaise(invoiceDisplayTotalMinor(inv)) }}</span>
              </li>
              <li
                v-if="selectedInvoiceVersion(inv) < invoiceRevisionMeta(inv).currentVersion"
                class="pt-1 text-amber-700 dark:text-amber-300"
              >
                {{ t('platform.commercialAdminHistoricalVersionHint') }}
              </li>
              <li v-if="inv.creditAppliedMinor && selectedInvoiceVersion(inv) === invoiceRevisionMeta(inv).currentVersion" class="flex justify-between gap-2 text-emerald-700">
                <span>{{ t('platform.commercialAdminInvoiceCredit') }}</span>
                <span class="tabular-nums">−{{ formatInrFromPaise(inv.creditAppliedMinor) }}</span>
              </li>
              <li v-if="inv.snapshot?.billTo" class="pt-2 text-gray-500">
                {{ inv.snapshot.billTo.companyName }}
                <span v-if="inv.snapshot.billTo.gstin"> · {{ inv.snapshot.billTo.gstin }}</span>
              </li>
            </ul>
          </li>
        </ul>
        <p v-if="!detail.invoices?.length" class="mt-2 text-sm text-gray-500">—</p>
      </section>

      <!-- Payments -->
      <section class="mt-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">
          {{ t('platform.commercialAdminPayments') }}
        </h2>
        <ul class="mt-3 divide-y divide-gray-100 dark:divide-gray-700">
          <li
            v-for="p in detail.payments"
            :key="p._id"
            class="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
          >
            <div>
              <p class="font-medium capitalize">{{ p.status }} · {{ p.method }}</p>
              <p class="text-xs text-gray-500">
                {{ formatInrFromPaise(p.amountMinor) }} · {{ p.providerReference || '—' }}
                · {{ formatDate(p.paidAt || p.createdAt) }}
              </p>
              <p v-if="p.notes" class="text-xs text-gray-500">{{ p.notes }}</p>
              <p v-if="p.metadata?.proofUrl" class="text-xs">
                <a
                  :href="p.metadata.proofUrl"
                  target="_blank"
                  rel="noopener"
                  class="text-indigo-600 hover:underline"
                >{{ t('platform.commercialAdminProof') }}</a>
              </p>
            </div>
            <div v-if="p.status === 'submitted'" class="flex gap-2">
              <button
                type="button"
                class="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white"
                :disabled="busyId === p._id"
                @click="approve(p._id)"
              >
                {{ t('platform.commercialAdminApprove') }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-700"
                :disabled="busyId === p._id"
                @click="reject(p._id)"
              >
                {{ t('platform.commercialAdminReject') }}
              </button>
            </div>
          </li>
        </ul>
        <p v-if="!detail.payments?.length" class="mt-2 text-sm text-gray-500">—</p>
      </section>
    </template>

    <CommercialInvoiceReviseDrawer
      :open="Boolean(reviseInvoice)"
      :invoice="reviseInvoice"
      :is-sandbox="isSandboxOrg"
      :busy="Boolean(busyId && String(busyId).startsWith('revise-'))"
      @close="closeReviseAction"
      @save="onReviseDrawerSave"
    />

    <CommercialInvoiceMarkPaidDrawer
      :open="Boolean(markPaidInvoice)"
      :invoice="markPaidInvoice"
      :busy="Boolean(busyId && String(busyId).startsWith('mark-paid-'))"
      @close="closeMarkPaid"
      @save="onMarkPaidSave"
    />

    <CommercialInvoicePdfSettingsDrawer
      :open="pdfSettingsOpen"
      :loading="pdfSettingsLoading"
      :saving="pdfSettingsSaving"
      :edit-layout-busy="pdfSettingsEditLayoutBusy"
      :draft="pdfSettingsDraft"
      :updated-at-label="pdfSettingsUpdatedLabel"
      @close="closePdfSettings"
      @save="savePdfSettings"
      @edit-layout="openInvoiceLayoutBuilder"
      @update:draft="onPdfSettingsDraftUpdate"
    />

    <!-- Restore historical invoice version -->
    <div
      v-if="restoreDraft"
      class="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 p-4"
      @click.self="closeRestoreDraft"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('platform.commercialAdminRestoreModalTitle') }}
        </h3>
        <p class="mt-1 text-sm text-gray-500">
          {{ restoreDraft.invoice.invoiceNumber }}
          · {{ t('platform.commercialAdminRestoreModalHint', { version: restoreDraft.targetVersion }) }}
        </p>
        <p class="mt-2 text-xs text-gray-500">
          {{ t('platform.commercialAdminRestoreCustomerHint') }}
        </p>
        <label class="mt-4 block">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">
            {{ t('platform.commercialAdminCreditReason') }}
          </span>
          <textarea
            v-model="restoreDraft.reason"
            rows="3"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
          />
        </label>
        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600"
            @click="closeRestoreDraft"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            :disabled="Boolean(busyId)"
            @click="submitRestoreDraft"
          >
            {{ t('platform.commercialAdminRestoreConfirm') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Invoice action modal (void / credit note) -->
    <div
      v-if="invoiceAction"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="closeInvoiceAction"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{
            invoiceAction.type === 'void'
              ? t('platform.commercialAdminVoidModalTitle')
              : t('platform.commercialAdminCreditNoteModalTitle')
          }}
        </h3>
        <p class="mt-1 text-sm text-gray-500">
          {{ invoiceAction.invoice.invoiceNumber }}
          · {{ formatInrFromPaise(invoiceAction.invoice.totalMinor) }}
        </p>
        <p
          v-if="invoiceAction.type === 'void'"
          class="mt-2 text-xs text-gray-500"
        >
          {{ t('platform.commercialAdminVoidModalHint') }}
        </p>
        <div class="mt-4 space-y-3">
          <label
            v-if="invoiceAction.type === 'credit_note'"
            class="block"
          >
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">
              {{ t('platform.commercialAdminCreditNoteAmount') }}
            </span>
            <input
              v-model="invoiceActionAmountRupees"
              type="text"
              inputmode="decimal"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            >
          </label>
          <label class="block">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">
              {{ t('platform.commercialAdminCreditReason') }}
            </span>
            <textarea
              v-model="invoiceActionReason"
              rows="3"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            />
          </label>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600"
            @click="closeInvoiceAction"
          >
            {{ t('platform.commercialAdminCancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            :class="invoiceAction.type === 'void' ? 'bg-amber-600' : 'bg-emerald-600'"
            :disabled="Boolean(busyId)"
            @click="confirmInvoiceAction"
          >
            {{
              invoiceAction.type === 'void'
                ? t('platform.commercialAdminVoidRegenerate')
                : t('platform.commercialAdminIssueCreditNote')
            }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
