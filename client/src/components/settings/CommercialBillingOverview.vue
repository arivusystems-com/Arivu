<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  DocumentArrowUpIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch, getApiUrlForMedia } from '@/config/apiBase';
import { useAuthStore } from '@/stores/auth';
import { formatInrFromPaise, ANNUAL_MONTH_MULTIPLIER } from '@/utils/commercialPricingApi';
import { formatUserDate } from '@/utils/localeFormat';
import { useNotifications } from '@/composables/useNotifications';
import DynamicFormField from '@/components/common/DynamicFormField.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import {
  BILLING_COUNTRY_OPTIONS,
  billingStateUsesCatalog,
  getBillingCitySuggestions,
  getBillingPostalRule,
  getBillingStateOptions,
  indiaStateCodeFromName,
  isValidBillingPostalCode,
  normalizeBillingPostalCode,
} from '@/utils/billingGeo';
import { isValidGstin } from '@/utils/gstin';

const emit = defineEmits(['commercial-active', 'billing-surface']);

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { success, error: notifyError } = useNotifications();

const loading = ref(true);
const bootstrapping = ref(false);
const payload = ref(null);
const loadError = ref(null);
const changingCycle = ref(false);
const invoices = ref([]);
const checkingOutInvoiceId = ref(null);

const hasSubscription = computed(() => Boolean(payload.value?.subscription));
const overview = computed(() => payload.value?.overview || null);
const subscription = computed(() => payload.value?.subscription || null);
const isInternalOrg = computed(() => Boolean(payload.value?.isInternalOrganization));
const nextInvoice = computed(() => overview.value?.nextInvoice || null);
const isTrialing = computed(
  () => Boolean(overview.value?.isTrialing || subscription.value?.status === 'trialing')
);
const isTrialExpired = computed(
  () => Boolean(overview.value?.isTrialExpired || subscription.value?.status === 'trial_expired')
);
const isPaymentPending = computed(
  () => Boolean(overview.value?.isPaymentPending || subscription.value?.status === 'payment_pending')
);
const isCanceled = computed(
  () => Boolean(
    overview.value?.isCanceled
    || subscription.value?.status === 'canceled'
    || subscription.value?.status === 'expired'
  )
);
const isCanceling = computed(
  () => Boolean(overview.value?.isCanceling || subscription.value?.status === 'canceling')
);
const needsSubscribe = computed(
  () => Boolean(isTrialing.value || isTrialExpired.value)
);
/** Open invoice awaiting Razorpay / manual payment. */
function isUnpaidInvoice(inv) {
  const s = String(inv?.status || '');
  return s === 'finalized' || s === 'past_due';
}

const unpaidInvoices = computed(() => (invoices.value || []).filter(isUnpaidInvoice));
const unpaidInvoiceCount = computed(() => unpaidInvoices.value.length);
const hasUnpaidInvoices = computed(() => unpaidInvoiceCount.value > 0);
const payableInvoice = computed(() => unpaidInvoices.value[0] || null);
const unpaidTotalMinor = computed(() =>
  unpaidInvoices.value.reduce((sum, inv) => {
    const total = Number(inv.totalMinor) || 0;
    const paid = Number(inv.amountPaidMinor) || 0;
    return sum + Math.max(0, total - paid);
  }, 0)
);

const showSubscribeWizard = ref(false);
const subscribeCycle = ref('monthly');
const subscribeBusy = ref(false);
const billTo = ref({
  companyName: '',
  gstRegistered: false,
  gstin: '',
  gstCertificateUrl: null,
  gstCertificateFileName: null,
  billingEmail: '',
  billingPhone: '',
  city: '',
  state: '',
  pincode: '',
  country: 'IN',
  line1: '',
});
const gstCertificateBusy = ref(false);
const gstCertificateInputRef = ref(null);
const MAX_GST_CERTIFICATE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_GST_CERTIFICATE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];
const gstCertificateMediaUrl = computed(() => {
  const url = billTo.value.gstCertificateUrl;
  return url ? getApiUrlForMedia(url) : '';
});
const billingPartyBusy = ref(false);
/** In-page job switcher: plan (view) | company (edit) | invoices */
const billingTab = ref('plan');
const showCyclePanel = ref(false);
const showPlanMenu = ref(false);
const showManualPay = ref(false);
const manualPayInvoice = ref(null);
const manualUtr = ref('');
const manualNotes = ref('');
const manualBusy = ref(false);
const showCancelModal = ref(false);
const cancelPreview = ref(null);
const cancelBusy = ref(false);
const isAnnual = computed(() => (overview.value?.billingCycle || 'monthly') === 'annual');
const pendingCycle = computed(() => overview.value?.pendingBillingCycle || null);
const isFounder = computed(
  () => overview.value?.pricingProgramCode === 'founder_launch' && !overview.value?.sandboxInternal
);
/** Live commercial sandbox (internal org with or without activated sub). */
const isSandboxMode = computed(() =>
  Boolean(overview.value?.sandboxInternal || (isInternalOrg.value && hasSubscription.value))
);

const periodSuffix = computed(() =>
  isAnnual.value ? t('settings.billingPlanPerYear') : t('settings.billingPlanPerMonth')
);

const cycleLabel = computed(() =>
  isAnnual.value
    ? t('settings.commercialBillingPeriodAnnual')
    : t('settings.commercialBillingPeriodMonthly')
);

const billToIncomplete = computed(() => {
  if (isSandboxMode.value) return false;
  const b = billTo.value;
  const email = String(b.billingEmail || '').trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const country = String(b.country || '').trim().toUpperCase();
  const gstOk = !b.gstRegistered || isValidGstin(b.gstin);
  const countryOk = BILLING_COUNTRY_OPTIONS.some((c) => c.value === country);
  const state = String(b.state || '').trim();
  const stateOk = billingStateUsesCatalog(country)
    ? getBillingStateOptions(country).some((s) => s.value === state)
    : Boolean(state);
  const postalOk = isValidBillingPostalCode(country, b.pincode);
  return !String(b.companyName || '').trim()
    || !String(b.line1 || '').trim()
    || !String(b.city || '').trim()
    || !stateOk
    || !postalOk
    || !countryOk
    || !emailOk
    || !gstOk;
});

/** Subscribe requires full bill-to (GSTIN only if GST-registered). */
const subscribeBillToValid = computed(() => !billToIncomplete.value);

const billingCountryOptions = BILLING_COUNTRY_OPTIONS;
const billingStateOptions = computed(() => getBillingStateOptions(billTo.value.country));
const billingStateHasCatalog = computed(() => billingStateUsesCatalog(billTo.value.country));

const companyNameField = computed(() => ({
  key: 'companyName',
  label: t('settings.billingFieldBusinessName'),
  dataType: 'Text',
  required: true,
  placeholder: t('settings.billingFieldBusinessName'),
}));
const gstinField = computed(() => ({
  key: 'gstin',
  label: t('settings.billingFieldGstin'),
  dataType: 'Text',
  required: true,
  placeholder: t('settings.billingFieldGstin'),
}));
const addressField = computed(() => ({
  key: 'line1',
  label: t('settings.billingFieldAddress'),
  dataType: 'Text',
  required: true,
  placeholder: t('settings.billingFieldAddress'),
}));
const countryField = computed(() => ({
  key: 'country',
  label: t('settings.billingFieldCountry'),
  dataType: 'Picklist',
  required: true,
  options: [...billingCountryOptions],
  placeholder: t('settings.billingFieldCountry'),
}));
const stateField = computed(() => ({
  key: 'state',
  label: t('settings.billingFieldState'),
  dataType: billingStateHasCatalog.value ? 'Picklist' : 'Text',
  required: true,
  options: billingStateHasCatalog.value ? [...billingStateOptions.value] : undefined,
  placeholder: t('settings.billingFieldState'),
}));
const cityField = computed(() => ({
  key: 'city',
  label: t('settings.billingFieldCity'),
  dataType: 'Text',
  required: true,
  placeholder: t('settings.billingFieldCity'),
}));
const pincodeField = computed(() => ({
  key: 'pincode',
  label: t('settings.billingFieldPincode'),
  dataType: 'Text',
  required: true,
  placeholder: getBillingPostalRule(billTo.value.country).example || t('settings.billingFieldPincode'),
}));
const emailField = computed(() => ({
  key: 'billingEmail',
  label: t('settings.billingFieldEmail'),
  dataType: 'Email',
  required: true,
  placeholder: 'email@example.com',
}));
const phoneField = computed(() => ({
  key: 'billingPhone',
  label: t('settings.billingFieldPhone'),
  dataType: 'Phone',
  required: false,
  placeholder: t('settings.billingFieldPhone'),
}));

const billingCitySuggestions = computed(() =>
  getBillingCitySuggestions(billTo.value.country, billTo.value.state)
);
const citySuggestOpen = ref(false);
const filteredCitySuggestions = computed(() => {
  const q = String(billTo.value.city || '').trim().toLowerCase();
  const list = billingCitySuggestions.value;
  if (!list.length) return [];
  if (!q) return list.slice(0, 12);
  return list.filter((name) => name.toLowerCase().includes(q)).slice(0, 12);
});

function selectBillingCity(cityName) {
  billTo.value.city = cityName;
  citySuggestOpen.value = false;
}

function onCitySuggestBlur() {
  window.setTimeout(() => {
    citySuggestOpen.value = false;
  }, 120);
}

const billingPostalValid = computed(() =>
  isValidBillingPostalCode(billTo.value.country, billTo.value.pincode)
);

const billToFieldErrors = computed(() => {
  const e = {};
  if (String(billTo.value.pincode || '').trim() && !billingPostalValid.value) {
    e.pincode = t('settings.billingPostalInvalid');
  }
  const gstinRaw = String(billTo.value.gstin || '').trim();
  if (gstinRaw && !isValidGstin(gstinRaw)) {
    e.gstin = t('settings.billingFieldGstinInvalid');
  }
  return e;
});

watch(
  () => billTo.value.country,
  (next, prev) => {
    if (prev == null || prev === '' || next === prev) return;
    billTo.value.state = '';
    billTo.value.city = '';
  }
);

watch(
  () => billTo.value.state,
  (next, prev) => {
    if (prev == null || prev === '' || next === prev) return;
    billTo.value.city = '';
  }
);

function buildBillingAddressPayload() {
  const country = String(billTo.value.country || '').trim().toUpperCase();
  const state = String(billTo.value.state || '').trim();
  const payload = {
    line1: String(billTo.value.line1 || '').trim() || undefined,
    city: String(billTo.value.city || '').trim() || undefined,
    state: state || undefined,
    pincode: normalizeBillingPostalCode(country, billTo.value.pincode) || undefined,
    country: country || undefined,
  };
  if (country === 'IN') {
    const code = indiaStateCodeFromName(state);
    if (code) payload.stateCode = code;
  }
  return payload;
}

const nextBillDate = computed(() => {
  if (!nextInvoice.value) return null;
  return formatDue(nextInvoice.value.dueAt || nextInvoice.value.periodEnd);
});

/** Left-column amount: unpaid balance if any, else next estimated charge. */
const planAmountMinor = computed(() => {
  if (hasUnpaidInvoices.value) return unpaidTotalMinor.value;
  return nextInvoice.value?.totalMinor ?? null;
});
const planAmountLabel = computed(() =>
  hasUnpaidInvoices.value
    ? t('settings.billingStatusAmountLabel')
    : t('settings.billingStatusNextChargeLabel')
);

/** Projected / recurring headline: incl. tax when tax applies. */
const projectedHeadlineMinor = computed(() => {
  const inv = nextInvoice.value;
  if (inv && Number(inv.taxMinor) > 0) return Number(inv.totalMinor) || 0;
  return overview.value?.recurringTotalMinor || 0;
});

const projectedExGstMinor = computed(() => {
  const inv = nextInvoice.value;
  if (!(inv && Number(inv.taxMinor) > 0)) return null;
  return overview.value?.recurringTotalMinor || 0;
});

const showBreakdownTaxRows = computed(() =>
  !isSandboxMode.value && Number(nextInvoice.value?.taxMinor) > 0
);

function invoiceStatusLabel(inv) {
  const s = String(inv?.status || '').toLowerCase();
  if (s === 'past_due') return t('settings.billingInvoiceStatusOverdue');
  if (s === 'finalized') return t('settings.billingInvoiceStatusUnpaid');
  if (s === 'paid') return t('settings.billingInvoiceStatusPaid');
  if (s === 'void') return t('settings.billingInvoiceStatusVoid');
  if (s === 'draft') return t('settings.billingInvoiceStatusDraft');
  return s;
}

function invoiceStatusClass(inv) {
  const s = String(inv?.status || '').toLowerCase();
  if (s === 'past_due') {
    return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300';
  }
  if (s === 'finalized') {
    return 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200';
  }
  if (s === 'paid') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

const canCancelPlan = computed(() =>
  !isSandboxMode.value
  && (
    subscription.value?.status === 'active'
    || subscription.value?.status === 'past_due'
    || subscription.value?.status === 'canceling'
  )
);

const statusLabel = computed(() => {
  if (isSandboxMode.value) return t('settings.billingStatusSandbox');
  const s = String(subscription.value?.status || '').toLowerCase();
  const map = {
    trialing: t('settings.billingStatusTrial'),
    trial_expired: t('settings.billingStatusTrialExpired'),
    payment_pending: t('settings.billingStatusPaymentPending'),
    active: t('settings.billingStatusActive'),
    past_due: t('settings.billingStatusPastDue'),
    paused: t('settings.billingStatusPaused'),
    canceling: t('settings.billingStatusCanceling'),
    canceled: t('settings.billingStatusCanceled'),
    expired: t('settings.billingStatusExpired'),
  };
  return map[s] || s;
});

const planTitle = computed(() =>
  isSandboxMode.value || (isInternalOrg.value && !hasSubscription.value)
    ? t('settings.billingSandboxTitle')
    : t('settings.billingPlanTitle')
);

const PRODUCT_LABEL_KEYS = {
  admin_user: 'settings.billingLineAdminUsers',
  standard_user: 'settings.billingLineStandardUsers',
  arivu_platform: 'settings.billingLinePlatform',
  internal_user: 'settings.billingLineUsers',
  portal_user: 'settings.billingLinePortal',
  helpdesk_app: 'settings.commercialBillingAppHelpdesk',
  sales_app: 'settings.commercialBillingAppSales',
  audit_app: 'settings.commercialBillingAppAudit',
  inventory_app: 'settings.commercialBillingAppInventory',
  field_sales_app: 'settings.commercialBillingAppFieldSales',
  marketing_app: 'settings.commercialBillingAppMarketing',
  stockroom_addon: 'settings.billingLineStockroom',
  live_agent_booster: 'settings.billingLineLiveAgent',
  custom_fields_booster: 'settings.billingLineCustomFields',
  custom_builder_booster: 'settings.billingLineCustomBuilder',
  storage_guard_booster: 'settings.billingLineStorageGuard',
};

function lineLabel(code) {
  const key = PRODUCT_LABEL_KEYS[code];
  return key ? t(key) : code;
}

function isSeatProduct(code) {
  const c = String(code || '');
  return c === 'admin_user' || c === 'standard_user' || c === 'portal_user' || c === 'internal_user';
}

/** One quantity story: "2 active · 1 invited" */
function seatCompositionLabel(row) {
  const active = Number(row.activeCount);
  const invited = Number(row.invitedCount);
  const hasSplit = Number.isFinite(active) && Number.isFinite(invited)
    && (row.activeCount != null || row.invitedCount != null);

  if (hasSplit && (active > 0 || invited > 0)) {
    const parts = [];
    if (active > 0) parts.push(t('settings.billingSeatActive', { count: active }));
    if (invited > 0) parts.push(t('settings.billingSeatInvited', { count: invited }));
    return parts.join(' · ');
  }
  const qty = Number(row.quantity) || 0;
  return t('settings.billingSeatTotal', { count: qty });
}

function appLineMeta(row) {
  const qty = Number(row.quantity) || 0;
  const unit = Number(row.unitAmountMinor) || 0;
  if (unit <= 0) return t('settings.billingSeatCountApp', { count: qty });
  return t('settings.billingAppQtyPrice', {
    count: qty,
    amount: formatInrFromPaise(unit),
  });
}

function seatUnitMeta(row) {
  const qty = Number(row.quantity) || 0;
  const unit = Number(row.unitAmountMinor) || 0;
  if (unit <= 0) return '';
  return t('settings.billingSeatUnitTimesQty', {
    amount: formatInrFromPaise(unit),
    count: qty,
  });
}

const breakdownRows = computed(() => {
  const rows = Array.isArray(overview.value?.breakdown) ? overview.value.breakdown : [];
  const visible = rows.filter((r) => (r.lineTotalMinor || 0) > 0);
  const seatOrder = { admin_user: 0, standard_user: 1, internal_user: 2, portal_user: 3 };
  return [...visible].sort((a, b) => {
    const aSeat = isSeatProduct(a.productCode);
    const bSeat = isSeatProduct(b.productCode);
    if (aSeat !== bSeat) return aSeat ? -1 : 1;
    if (aSeat && bSeat) {
      return (seatOrder[a.productCode] ?? 9) - (seatOrder[b.productCode] ?? 9);
    }
    return String(lineLabel(a.productCode)).localeCompare(String(lineLabel(b.productCode)));
  });
});

const seatBreakdownRows = computed(() => breakdownRows.value.filter((r) => isSeatProduct(r.productCode)));
const appBreakdownRows = computed(() => breakdownRows.value.filter((r) => !isSeatProduct(r.productCode)));

/** Subscribe wizard: scale monthly snapshot to annual (10×) when year is selected. */
const subscribeReviewRows = computed(() => {
  const mult = subscribeCycle.value === 'annual' ? ANNUAL_MONTH_MULTIPLIER : 1;
  return breakdownRows.value.map((r) => ({
    ...r,
    lineTotalMinor: Math.round((r.lineTotalMinor || 0) * mult),
  }));
});
const subscribeReviewTotalMinor = computed(() =>
  subscribeReviewRows.value.reduce((sum, r) => sum + (r.lineTotalMinor || 0), 0)
);
const subscribeAnnualSavingsMinor = computed(() => {
  if (subscribeCycle.value !== 'annual') return 0;
  const monthly = breakdownRows.value.reduce((sum, r) => sum + (r.lineTotalMinor || 0), 0);
  return Math.max(0, monthly * 12 - monthly * ANNUAL_MONTH_MULTIPLIER);
});
const subscribePeriodSuffix = computed(() =>
  subscribeCycle.value === 'annual' ? t('settings.billingPlanPerYear') : t('settings.billingPlanPerMonth')
);

function formatDue(value) {
  if (!value) return t('settings.billingNextInvoiceSoon');
  try {
    return formatUserDate(value);
  } catch {
    return String(value);
  }
}

function formatProtection(value) {
  if (!value) return '';
  try {
    return formatUserDate(value);
  } catch {
    return '';
  }
}

watch([hasSubscription, isInternalOrg, isSandboxMode], () => {
  // Hide legacy per-app Paid cards for commercial tenants and all internal orgs.
  emit('commercial-active', Boolean(hasSubscription.value || isInternalOrg.value));
  emit('billing-surface', {
    commercialActive: Boolean(hasSubscription.value),
    isInternal: Boolean(isInternalOrg.value),
    isSandbox: Boolean(isSandboxMode.value),
  });
}, { immediate: true });

function hydrateBillTo(party) {
  if (!party || typeof party !== 'object') return;
  const structured = party.billingAddressStructured || {};
  const rawCountry = party.country || structured.country || 'IN';
  const country = String(rawCountry).trim().toUpperCase().slice(0, 2) || 'IN';
  let state = String(party.state || structured.state || '').trim();
  const storedCode = String(structured.stateCode || party.stateCode || '').trim();
  if (country === 'IN') {
    if (storedCode) {
      const byCode = getBillingStateOptions('IN').find(
        (s) => s.stateCode === storedCode.padStart(2, '0')
      );
      if (byCode) state = byCode.value;
    } else if (state) {
      const match = getBillingStateOptions('IN').find(
        (s) => s.value.toLowerCase() === state.toLowerCase()
      );
      if (match) state = match.value;
      else {
        const byCode = getBillingStateOptions('IN').find(
          (s) => s.stateCode === state.padStart(2, '0')
        );
        if (byCode) state = byCode.value;
      }
    }
  }
  billTo.value = {
    companyName: party.companyName || '',
    gstRegistered: Boolean(party.gstRegistered),
    gstin: party.gstin || '',
    gstCertificateUrl: party.gstCertificateUrl || null,
    gstCertificateFileName: party.gstCertificateFileName || null,
    billingEmail: party.billingEmail || '',
    billingPhone: party.billingPhone || '',
    line1: party.line1 || structured.line1 || '',
    city: party.city || structured.city || '',
    state,
    pincode: party.pincode || structured.pincode || '',
    country,
  };
}

async function loadInvoices() {
  try {
    const res = await apiClient.get('/billing/invoices', { cache: 'no-store' });
    invoices.value = res?.data?.invoices || res?.invoices || [];
  } catch {
    invoices.value = [];
  }
}

async function load() {
  loading.value = true;
  loadError.value = null;
  try {
    const res = await apiClient.get('/billing/subscription', { cache: 'no-store' });
    payload.value = res?.data || res || null;
    hydrateBillTo(payload.value?.billingParty);
    await loadInvoices();
  } catch (err) {
    loadError.value = err?.message || t('settings.commercialBillingLoadFailed');
    payload.value = null;
  } finally {
    loading.value = false;
  }
}

async function saveBillingDetails() {
  if (billTo.value.gstRegistered && !isValidGstin(billTo.value.gstin)) {
    notifyError(t('settings.billingFieldGstinInvalid'));
    return;
  }
  billingPartyBusy.value = true;
  try {
    await apiClient.patch('/billing/billing-party', {
      companyName: billTo.value.companyName,
      gstin: billTo.value.gstin,
      gstRegistered: Boolean(billTo.value.gstRegistered),
      billingEmail: billTo.value.billingEmail,
      billingPhone: billTo.value.billingPhone,
      billingAddressStructured: buildBillingAddressPayload(),
    });
    success(t('settings.billingDetailsSaved'));
    await load();
  } catch (err) {
    notifyError(err?.message || t('settings.billingDetailsFailed'));
  } finally {
    billingPartyBusy.value = false;
  }
}

function triggerGstCertificatePicker() {
  if (gstCertificateBusy.value) return;
  gstCertificateInputRef.value?.click();
}

async function onGstCertificateSelected(event) {
  const file = event?.target?.files?.[0];
  if (gstCertificateInputRef.value) gstCertificateInputRef.value.value = '';
  if (!file) return;

  if (!ACCEPTED_GST_CERTIFICATE_TYPES.includes(file.type)) {
    notifyError(t('settings.billingFieldGstCertificateUnsupportedType'));
    return;
  }
  if (file.size > MAX_GST_CERTIFICATE_BYTES) {
    notifyError(t('settings.billingFieldGstCertificateTooLarge'));
    return;
  }

  gstCertificateBusy.value = true;
  try {
    const formData = new FormData();
    formData.append('certificate', file);
    const token = authStore.user?.token;
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(getApiUrlForFetch('/api/billing/gst-certificate'), {
      method: 'POST',
      headers,
      body: formData,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      throw new Error(result.message || t('settings.billingFieldGstCertificateFailed'));
    }
    billTo.value.gstCertificateUrl = result.data?.gstCertificateUrl || null;
    billTo.value.gstCertificateFileName = result.data?.gstCertificateFileName || file.name;
    success(t('settings.billingFieldGstCertificateUploaded'));
  } catch (err) {
    notifyError(err?.message || t('settings.billingFieldGstCertificateFailed'));
  } finally {
    gstCertificateBusy.value = false;
  }
}

async function removeGstCertificate() {
  if (gstCertificateBusy.value) return;
  gstCertificateBusy.value = true;
  try {
    await apiClient.delete('/billing/gst-certificate');
    billTo.value.gstCertificateUrl = null;
    billTo.value.gstCertificateFileName = null;
    success(t('settings.billingFieldGstCertificateRemoved'));
  } catch (err) {
    notifyError(err?.message || t('settings.billingFieldGstCertificateFailed'));
  } finally {
    gstCertificateBusy.value = false;
  }
}

async function bootstrap() {
  bootstrapping.value = true;
  try {
    const res = await apiClient.post('/billing/bootstrap', {
      billingCycle: 'monthly',
      claimFounder: true,
    });
    const note = res?.data?.note || res?.note;
    success(note || t('settings.commercialBillingBootstrapOk'));
    await load();
    if (!payload.value?.subscription) {
      notifyError(t('settings.commercialBillingBootstrapMissing'));
    }
  } catch (err) {
    notifyError(err?.message || t('settings.commercialBillingBootstrapFailed'));
  } finally {
    bootstrapping.value = false;
  }
}

async function setBillingCycle(billingCycle, immediate) {
  changingCycle.value = true;
  try {
    await apiClient.post('/billing/billing-cycle', { billingCycle, immediate });
    success(
      immediate
        ? t('settings.commercialBillingCycleImmediateOk')
        : t('settings.billingCycleScheduledOk')
    );
    await load();
  } catch (err) {
    notifyError(err?.message || t('settings.commercialBillingCycleFailed'));
  } finally {
    changingCycle.value = false;
  }
}

async function openSubscribeWizard() {
  subscribeCycle.value = overview.value?.billingCycle || 'monthly';
  showSubscribeWizard.value = true;
}

async function runSubscribe() {
  if (!subscribeBillToValid.value) {
    notifyError(t('settings.billingSubscribeBillToRequired'));
    return;
  }
  subscribeBusy.value = true;
  try {
    const res = await apiClient.post('/billing/subscribe', {
      billingCycle: subscribeCycle.value,
      billing: {
        companyName: String(billTo.value.companyName || '').trim(),
        gstRegistered: Boolean(billTo.value.gstRegistered),
        gstin: String(billTo.value.gstin || '').trim() || undefined,
        billingEmail: String(billTo.value.billingEmail || '').trim(),
        billingPhone: String(billTo.value.billingPhone || '').trim() || undefined,
        billingAddressStructured: buildBillingAddressPayload(),
      },
    });
    success(t('settings.billingSubscribeOk'));
    showSubscribeWizard.value = false;
    await load();
    const inv = res?.data?.invoice || res?.invoice;
    if (inv?._id && (inv.status === 'finalized' || inv.status === 'past_due')) {
      await payInvoice(inv);
    }
  } catch (err) {
    notifyError(err?.message || t('settings.billingSubscribeFailed'));
  } finally {
    subscribeBusy.value = false;
  }
}

function openManualPay(inv) {
  manualPayInvoice.value = inv;
  manualUtr.value = '';
  manualNotes.value = '';
  showManualPay.value = true;
}

async function submitManualPay() {
  if (!manualPayInvoice.value?._id) return;
  manualBusy.value = true;
  try {
    await apiClient.post(`/billing/invoices/${manualPayInvoice.value._id}/payments/submit`, {
      payInFull: true,
      utr: manualUtr.value,
      notes: manualNotes.value,
      method: 'bank_transfer',
    });
    success(t('settings.billingManualPaymentSubmitted'));
    showManualPay.value = false;
    await loadInvoices();
    await load();
  } catch (err) {
    notifyError(err?.message || t('settings.billingManualPaymentFailed'));
  } finally {
    manualBusy.value = false;
  }
}

async function downloadInvoicePdf(inv) {
  try {
    const { getApiUrlForFetch } = await import('@/config/apiBase');
    const { useAuthStore } = await import('@/stores/authRegistry');
    const token = useAuthStore().user?.token;
    const res = await fetch(getApiUrlForFetch(`/billing/invoices/${inv._id}/pdf`), {
      headers: {
        Accept: 'application/pdf',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error(t('settings.billingPdfFailed'));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.invoiceNumber || 'invoice'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    notifyError(err?.message || t('settings.billingPdfFailed'));
  }
}

async function openCancel() {
  try {
    const res = await apiClient.get('/billing/cancel-preview');
    cancelPreview.value = res?.data || res;
    showCancelModal.value = true;
  } catch (err) {
    notifyError(err?.message || t('settings.billingCancelPreviewFailed'));
  }
}

async function confirmCancel(immediate) {
  cancelBusy.value = true;
  try {
    await apiClient.post('/billing/cancel', { immediate: Boolean(immediate) });
    success(t('settings.billingCancelOk'));
    showCancelModal.value = false;
    await load();
  } catch (err) {
    notifyError(err?.message || t('settings.billingCancelFailed'));
  } finally {
    cancelBusy.value = false;
  }
}

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(t('settings.commercialBillingRazorpayLoadFailed')));
    document.head.appendChild(script);
  });
}

async function payInvoice(inv) {
  checkingOutInvoiceId.value = inv._id;
  try {
    const res = await apiClient.post(`/billing/invoices/${inv._id}/checkout`);
    const checkout = res?.data || res;
    if (!checkout?.orderId || !checkout?.keyId) {
      throw new Error(t('settings.commercialBillingCheckoutFailed'));
    }
    await loadRazorpayScript();
    await new Promise((resolve, reject) => {
      const rzp = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amountMinor,
        currency: checkout.currency || 'INR',
        name: checkout.name || 'Arivu',
        description: checkout.description || '',
        order_id: checkout.orderId,
        handler: async (response) => {
          try {
            await apiClient.post(`/billing/invoices/${inv._id}/confirm-razorpay`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            success(t('settings.commercialBillingPaidOk'));
            await loadInvoices();
            await load();
            resolve();
          } catch (err) {
            notifyError(err?.message || t('settings.commercialBillingPayFailed'));
            reject(err);
          }
        },
        modal: {
          ondismiss: () => resolve(),
        },
      });
      rzp.on('payment.failed', (resp) => {
        notifyError(resp?.error?.description || t('settings.commercialBillingPayFailed'));
        reject(new Error(resp?.error?.description || 'payment_failed'));
      });
      rzp.open();
    });
  } catch (err) {
    if (err?.code === 'RAZORPAY_NOT_CONFIGURED' || err?.response?.data?.code === 'RAZORPAY_NOT_CONFIGURED') {
      notifyError(t('settings.commercialBillingRazorpayNotConfigured'));
    } else if (err?.message && err.message !== 'payment_failed') {
      notifyError(err?.message || t('settings.commercialBillingCheckoutFailed'));
    }
  } finally {
    checkingOutInvoiceId.value = null;
  }
}

function goManageTeam() {
  router.push({ path: '/settings', query: { tab: 'users-access' } });
}

function goCompanyTab() {
  billingTab.value = 'company';
  showCyclePanel.value = false;
  showPlanMenu.value = false;
}

function goInvoicesTab() {
  billingTab.value = 'invoices';
  showCyclePanel.value = false;
  showPlanMenu.value = false;
}

function toggleCyclePanel() {
  showCyclePanel.value = !showCyclePanel.value;
  showPlanMenu.value = false;
}

function togglePlanMenu() {
  showPlanMenu.value = !showPlanMenu.value;
  showCyclePanel.value = false;
}

async function chooseBillingCycle(billingCycle, immediate) {
  await setBillingCycle(billingCycle, immediate);
  showCyclePanel.value = false;
}

onMounted(load);
</script>

<template>
  <input
    ref="gstCertificateInputRef"
    type="file"
    class="hidden"
    accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp"
    @change="onGstCertificateSelected"
  >
  <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
    <div v-if="loading" class="flex justify-center py-16">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>

    <div
      v-else-if="loadError"
      class="m-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
    >
      {{ loadError }}
    </div>

    <!-- Empty / activate -->
    <div
      v-else-if="!hasSubscription"
      class="relative overflow-hidden"
    >
      <div
        class="pointer-events-none absolute inset-0 opacity-90"
        :class="isInternalOrg
          ? 'bg-[radial-gradient(ellipse_at_top_left,_rgba(99,102,241,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(14,165,233,0.08),_transparent_50%)]'
          : ''"
      />
      <div class="relative space-y-6 p-6 sm:p-8">
        <div class="max-w-2xl">
          <p
            v-if="isInternalOrg"
            class="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400"
          >
            {{ t('settings.billingSandboxEyebrow') }}
          </p>
          <h3 class="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {{ isInternalOrg ? t('settings.billingSandboxTitle') : t('settings.billingPlanTitle') }}
          </h3>
          <p class="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {{ isInternalOrg ? t('settings.billingSandboxEmptyLead') : t('settings.billingPlanEmptyLead') }}
          </p>
        </div>

        <ul
          v-if="isInternalOrg"
          class="grid gap-3 sm:grid-cols-3"
        >
          <li class="rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/40">
            <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('settings.billingSandboxPillarPrices') }}</p>
            <p class="mt-1 text-xs text-slate-500">{{ t('settings.billingSandboxPillarPricesHint') }}</p>
          </li>
          <li class="rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/40">
            <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('settings.billingSandboxPillarSeats') }}</p>
            <p class="mt-1 text-xs text-slate-500">{{ t('settings.billingSandboxPillarSeatsHint') }}</p>
          </li>
          <li class="rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/40">
            <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('settings.billingSandboxPillarSafe') }}</p>
            <p class="mt-1 text-xs text-slate-500">{{ t('settings.billingSandboxPillarSafeHint') }}</p>
          </li>
        </ul>

        <p
          v-if="isInternalOrg"
          class="text-sm text-slate-600 dark:text-slate-400"
        >
          {{ t('settings.billingSandboxInternalNote') }}
        </p>

        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            :disabled="bootstrapping"
            @click="bootstrap"
          >
            {{
              bootstrapping
                ? t('settings.commercialBillingBootstrapping')
                : (isInternalOrg ? t('settings.billingSandboxActivateCta') : t('settings.billingActivateCta'))
            }}
          </button>
          <a
            v-if="isInternalOrg"
            href="/pricing"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            {{ t('settings.billingViewPricing') }}
            <ArrowTopRightOnSquareIcon class="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>

    <!-- Active plan: compact summary (left) + tabbed work surface (right) -->
    <template v-else>
      <div class="lg:grid lg:grid-cols-[minmax(17.5rem,0.9fr)_minmax(0,1.4fr)] lg:items-stretch">
        <!-- Left: Your plan -->
        <aside
          class="relative flex h-full min-h-full flex-col rounded-t-2xl border-b border-slate-200 px-5 py-6 sm:px-6 lg:rounded-none lg:rounded-l-2xl lg:border-b-0 lg:border-r lg:px-6 lg:py-7 dark:border-slate-700"
          :class="isSandboxMode ? 'bg-[radial-gradient(ellipse_at_top_left,_rgba(99,102,241,0.08),_transparent_55%)]' : 'bg-slate-50/60 dark:bg-slate-950/30'"
        >
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              {{ planTitle }}
            </h3>
            <span
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
              :class="isSandboxMode
                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
                : (subscription?.status === 'active'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : (isCanceled || isCanceling
                    ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                    : 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'))"
            >
              {{ statusLabel }}
            </span>
            <span
              v-if="isSandboxMode"
              class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {{ t('settings.billingNotBillableChip') }}
            </span>
            <span
              v-else-if="isFounder"
              class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              <CheckCircleIcon class="h-3.5 w-3.5" />
              {{ t('settings.billingFounderChip') }}
            </span>
          </div>

          <dl
            v-if="!isSandboxMode && !isCanceled"
            class="mt-4 space-y-2 text-sm"
          >
            <div v-if="nextInvoice && nextBillDate && !hasUnpaidInvoices" class="flex items-baseline justify-between gap-3">
              <dt class="text-slate-500">{{ t('settings.billingStatusNextBillLabel') }}</dt>
              <dd class="text-right font-medium tabular-nums text-slate-800 dark:text-slate-100">
                {{ nextBillDate }}
              </dd>
            </div>
            <div v-if="planAmountMinor != null" class="flex items-baseline justify-between gap-3">
              <dt class="text-slate-500">{{ planAmountLabel }}</dt>
              <dd class="text-right">
                <span
                  class="font-semibold tabular-nums"
                  :class="hasUnpaidInvoices
                    ? 'text-amber-800 dark:text-amber-200'
                    : 'text-slate-900 dark:text-white'"
                >
                  {{ formatInrFromPaise(planAmountMinor) }}
                </span>
                <span
                  v-if="!hasUnpaidInvoices && nextInvoice?.taxMinor > 0"
                  class="mt-0.5 block text-xs font-normal text-slate-500"
                >
                  {{ t('settings.billingInclTax', { name: nextInvoice.taxName, rate: nextInvoice.taxRatePercent }) }}
                </span>
                <span
                  v-else-if="hasUnpaidInvoices && unpaidInvoiceCount > 1"
                  class="mt-0.5 block text-xs font-normal text-slate-500"
                >
                  {{ t('settings.billingUnpaidCountHint', { count: unpaidInvoiceCount }) }}
                </span>
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-slate-500">{{ t('settings.billingCycle') }}</dt>
              <dd class="font-medium text-slate-800 dark:text-slate-100">{{ cycleLabel }}</dd>
            </div>
            <div v-if="pendingCycle" class="rounded-md bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {{ t('settings.commercialBillingPendingCycle', { cycle: pendingCycle }) }}
            </div>
          </dl>
          <p
            v-else-if="isSandboxMode"
            class="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400"
          >
            {{ t('settings.billingSandboxActiveLead') }}
          </p>

          <div class="mt-5 border-t border-slate-200/80 pt-5 dark:border-slate-700/80">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {{
                isSandboxMode
                  ? t('settings.billingSandboxSimulated')
                  : (isCanceled
                    ? t('settings.billingCanceledPlanLabel')
                    : (isTrialing ? t('settings.billingProjected') : t('settings.billingRecurring')))
              }}
            </p>
            <p class="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
              {{ formatInrFromPaise(projectedHeadlineMinor) }}
              <span class="text-base font-medium text-slate-500">{{ periodSuffix }}</span>
            </p>
            <p
              v-if="projectedExGstMinor != null"
              class="mt-1 text-xs text-slate-500"
            >
              {{ t('settings.billingProjectedExGst', {
                amount: formatInrFromPaise(projectedExGstMinor) + periodSuffix,
              }) }}
            </p>
            <p v-if="isSandboxMode" class="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {{ t('settings.billingSandboxNoInvoice') }}
            </p>
            <template v-else-if="isCanceled">
              <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {{ t('settings.billingCanceledNoRenewal') }}
              </p>
              <p v-if="overview?.canceledAt" class="mt-1 text-xs text-slate-500">
                {{ t('settings.billingCanceledOn', { date: formatDue(overview.canceledAt) }) }}
              </p>
            </template>
            <template v-else-if="isCanceling">
              <p class="mt-2 text-sm text-amber-700 dark:text-amber-300">
                {{ t('settings.billingCancelingUntil', {
                  date: formatDue(overview?.accessUntil || subscription?.currentPeriodEnd),
                }) }}
              </p>
            </template>
            <template v-else>
              <p v-if="isTrialing" class="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {{ t('settings.billingTrialNoChargeHint') }}
              </p>
              <p
                v-if="isFounder && overview?.priceProtectionExpiresAt"
                class="mt-1 text-xs text-slate-500"
              >
                {{ t('settings.billingFounderUntil', { date: formatProtection(overview.priceProtectionExpiresAt) }) }}
              </p>
              <p v-if="overview?.creditBalanceMinor > 0" class="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
                {{ t('settings.billingCreditApplied', { amount: formatInrFromPaise(overview.creditBalanceMinor) }) }}
              </p>
            </template>
          </div>

          <div
            v-if="!isSandboxMode && (payableInvoice || needsSubscribe || isCanceled)"
            class="mt-5 space-y-2"
          >
            <button
              v-if="payableInvoice"
              type="button"
              class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              :disabled="checkingOutInvoiceId === payableInvoice._id"
              @click="payInvoice(payableInvoice)"
            >
              {{
                checkingOutInvoiceId === payableInvoice._id
                  ? t('settings.commercialBillingPaying')
                  : t('settings.billingPayUnpaidCta', {
                    amount: formatInrFromPaise(unpaidTotalMinor),
                  })
              }}
            </button>
            <button
              v-if="payableInvoice"
              type="button"
              class="w-full text-center text-sm font-medium text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
              @click="goInvoicesTab"
            >
              {{ t('settings.billingViewUnpaidInvoices') }}
            </button>
            <button
              v-else-if="needsSubscribe || isCanceled"
              type="button"
              class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              :disabled="subscribeBusy"
              @click="openSubscribeWizard"
            >
              {{
                isCanceled
                  ? t('settings.billingResubscribe')
                  : (isTrialExpired ? t('settings.billingSubscribeNow') : t('settings.billingStartPaidPlan'))
              }}
            </button>
          </div>
          <div v-else-if="isSandboxMode" class="mt-5">
            <a
              href="/pricing"
              target="_blank"
              rel="noopener"
              class="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              {{ t('settings.billingSandboxOpenCalculator') }}
              <ArrowTopRightOnSquareIcon class="h-4 w-4" />
            </a>
          </div>

          <div class="mt-5 flex flex-col gap-2.5 text-sm">
            <button
              v-if="!isCanceled"
              type="button"
              class="text-left font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              @click="toggleCyclePanel"
            >
              {{ t('settings.billingChangePeriod') }}
            </button>
            <button
              type="button"
              class="text-left font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              @click="goManageTeam"
            >
              {{ t('settings.billingSecondarySeats') }}
            </button>
            <div v-if="!isSandboxMode && canCancelPlan" class="relative">
              <button
                type="button"
                class="text-left font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                :aria-expanded="showPlanMenu"
                @click="togglePlanMenu"
              >
                {{ t('settings.billingManagePlan') }}
              </button>
              <div
                v-if="showPlanMenu"
                class="absolute bottom-full left-0 z-50 mb-1.5 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
              >
                <button
                  type="button"
                  class="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                  @click="showPlanMenu = false; openCancel()"
                >
                  {{ t('settings.billingCancelSubscription') }}
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="showCyclePanel && !isCanceled"
            class="mt-4 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900"
          >
            <p class="text-sm font-semibold text-slate-900 dark:text-white">
              {{ t('settings.billingPeriodCurrent', { cycle: cycleLabel }) }}
            </p>
            <p class="mt-1 text-xs text-slate-500">
              {{ isSandboxMode ? t('settings.billingSandboxCycleHint') : t('settings.billingCycleHintSimple') }}
            </p>
            <div class="mt-3 flex flex-col gap-2">
              <button
                v-if="!isAnnual"
                type="button"
                class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                :disabled="changingCycle"
                @click="chooseBillingCycle('annual', false)"
              >
                {{ t('settings.billingSwitchAnnualRenewal') }}
              </button>
              <button
                v-else
                type="button"
                class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                :disabled="changingCycle"
                @click="chooseBillingCycle('monthly', false)"
              >
                {{ t('settings.billingSwitchMonthlyRenewal') }}
              </button>
              <button
                v-if="!isSandboxMode"
                type="button"
                class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                :disabled="changingCycle"
                @click="chooseBillingCycle(isAnnual ? 'monthly' : 'annual', true)"
              >
                {{ isAnnual ? t('settings.billingSwitchMonthlyNow') : t('settings.billingSwitchAnnualNow') }}
              </button>
              <button
                type="button"
                class="px-1 py-1 text-left text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                @click="showCyclePanel = false"
              >
                {{ t('settings.billingCycleCancel') }}
              </button>
            </div>
          </div>
        </aside>

        <!-- Right: tabs + panels -->
        <div class="flex h-full min-h-full min-w-0 flex-col rounded-b-2xl bg-white dark:bg-slate-900 lg:rounded-none lg:rounded-r-2xl">
      <!-- Job switcher -->
      <div
        v-if="!isSandboxMode"
        class="flex gap-1 border-b border-slate-200 px-4 pt-2 sm:px-6 dark:border-slate-700"
        role="tablist"
        :aria-label="t('settings.billingTabsLabel')"
      >
        <button
          type="button"
          role="tab"
          class="rounded-t-lg px-3 py-2.5 text-sm font-semibold transition"
          :class="billingTab === 'plan'
            ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-300'
            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
          :aria-selected="billingTab === 'plan'"
          @click="billingTab = 'plan'"
        >
          {{ t('settings.billingTabPlan') }}
        </button>
        <button
          type="button"
          role="tab"
          class="rounded-t-lg px-3 py-2.5 text-sm font-semibold transition"
          :class="billingTab === 'company'
            ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-300'
            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
          :aria-selected="billingTab === 'company'"
          @click="billingTab = 'company'"
        >
          {{ t('settings.billingTabCompany') }}
        </button>
        <button
          type="button"
          role="tab"
          class="inline-flex items-center gap-1.5 rounded-t-lg px-3 py-2.5 text-sm font-semibold transition"
          :class="billingTab === 'invoices'
            ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-300'
            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
          :aria-selected="billingTab === 'invoices'"
          @click="billingTab = 'invoices'"
        >
          {{ t('settings.billingTabInvoices') }}
          <span
            v-if="unpaidInvoiceCount > 0"
            class="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
            :aria-label="t('settings.billingUnpaidTabBadgeAria', { count: unpaidInvoiceCount })"
          >
            {{ unpaidInvoiceCount > 9 ? '9+' : unpaidInvoiceCount }}
          </span>
        </button>
      </div>

      <!-- Plan composition -->
      <div
        v-show="isSandboxMode || billingTab === 'plan'"
        class="border-b border-slate-200 px-6 py-6 sm:px-8 dark:border-slate-700"
        role="tabpanel"
      >
        <div
          v-if="billToIncomplete"
          class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-900/50 dark:bg-amber-950/30"
        >
          <p class="text-amber-900 dark:text-amber-200">
            {{ t('settings.billingCompanyMissingBanner') }}
          </p>
          <button
            type="button"
            class="shrink-0 font-semibold text-amber-900 underline hover:no-underline dark:text-amber-100"
            @click="goCompanyTab"
          >
            {{ t('settings.billingCompanyMissingCta') }}
          </button>
        </div>
        <h4 class="text-sm font-semibold text-slate-900 dark:text-white">
          {{ isCanceled ? t('settings.billingCanceledBreakdown') : t('settings.billingBreakdown') }}
        </h4>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {{ isCanceled ? t('settings.billingCanceledBreakdownHint') : t('settings.billingBreakdownHint') }}
        </p>

        <div v-if="seatBreakdownRows.length" class="mt-5">
          <p class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            {{ t('settings.billingBreakdownSeatsHeading') }}
          </p>
          <ul class="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            <li
              v-for="row in seatBreakdownRows"
              :key="row.productCode"
              class="grid grid-cols-1 items-baseline gap-x-4 gap-y-1 py-3.5 sm:grid-cols-[minmax(7rem,0.9fr)_minmax(0,1.4fr)_auto]"
            >
              <p class="text-sm font-semibold text-slate-900 dark:text-white">
                {{ lineLabel(row.productCode) }}
              </p>
              <div class="min-w-0 text-sm text-slate-600 dark:text-slate-300">
                <p class="font-medium tabular-nums text-slate-800 dark:text-slate-100">
                  {{ seatCompositionLabel(row) }}
                </p>
                <p v-if="seatUnitMeta(row)" class="mt-0.5 text-xs text-slate-500">
                  {{ seatUnitMeta(row) }}
                </p>
              </div>
              <p class="text-sm font-semibold tabular-nums text-slate-900 sm:justify-self-end dark:text-white">
                {{ formatInrFromPaise(row.lineTotalMinor) }}
              </p>
            </li>
          </ul>
        </div>

        <div v-if="appBreakdownRows.length" class="mt-6">
          <p class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            {{ t('settings.billingBreakdownAppsHeading') }}
          </p>
          <ul class="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            <li
              v-for="row in appBreakdownRows"
              :key="row.productCode"
              class="flex items-baseline justify-between gap-4 py-2.5 text-sm"
            >
              <p class="min-w-0 text-slate-600 dark:text-slate-300">
                <span class="font-medium text-slate-800 dark:text-slate-100">{{ lineLabel(row.productCode) }}</span>
                <span class="text-slate-400"> · </span>
                <span class="tabular-nums text-slate-500">{{ appLineMeta(row) }}</span>
              </p>
              <p class="shrink-0 tabular-nums font-medium text-slate-700 dark:text-slate-200">
                {{ formatInrFromPaise(row.lineTotalMinor) }}
              </p>
            </li>
          </ul>
        </div>

        <div class="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <div class="flex items-center justify-between gap-4">
            <span class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('settings.billingBreakdownTotal') }}</span>
            <span class="text-base font-semibold tabular-nums text-slate-900 dark:text-white">
              {{ formatInrFromPaise(overview?.recurringTotalMinor || 0) }}{{ periodSuffix }}
            </span>
          </div>
          <template v-if="showBreakdownTaxRows">
            <div class="flex items-center justify-between gap-4 text-sm">
              <span class="text-slate-600 dark:text-slate-300">
                {{ t('settings.billingBreakdownTax', {
                  name: nextInvoice.taxName,
                  rate: nextInvoice.taxRatePercent,
                }) }}
              </span>
              <span class="tabular-nums font-medium text-slate-700 dark:text-slate-200">
                {{ formatInrFromPaise(nextInvoice.taxMinor) }}
              </span>
            </div>
            <div class="flex items-center justify-between gap-4 border-t border-slate-100 pt-2 dark:border-slate-800">
              <span class="text-sm font-semibold text-slate-900 dark:text-white">
                {{ t('settings.billingBreakdownTotalWithTax', { name: nextInvoice.taxName }) }}
              </span>
              <span class="text-base font-semibold tabular-nums text-slate-900 dark:text-white">
                {{ formatInrFromPaise(nextInvoice.totalMinor) }}{{ periodSuffix }}
              </span>
            </div>
          </template>
        </div>
        <p v-if="isSandboxMode" class="mt-2 text-xs text-slate-500">
          {{ t('settings.billingSandboxBreakdownNote') }}
        </p>
      </div>

      <!-- Company & tax (edit job) -->
      <div
        v-if="!isSandboxMode"
        v-show="billingTab === 'company'"
        class="border-b border-slate-200 px-6 py-6 sm:px-8 dark:border-slate-700"
        role="tabpanel"
      >
        <h4 class="text-sm font-semibold text-slate-900 dark:text-white">
          {{ t('settings.billingDetailsHeading') }}
        </h4>
        <p class="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400">
          {{ t('settings.billingDetailsHint') }}
        </p>
        <form class="mt-5 max-w-lg space-y-4" @submit.prevent="saveBillingDetails">
          <DynamicFormField
            :field="companyNameField"
            :value="billTo.companyName"
            @update:value="(v) => { billTo.companyName = v; }"
          />
          <label class="inline-flex cursor-pointer items-center gap-2.5">
            <HeadlessCheckbox v-model="billTo.gstRegistered" />
            <span class="text-sm text-slate-700 dark:text-slate-300">{{ t('settings.billingFieldGstRegistered') }}</span>
          </label>
          <DynamicFormField
            v-if="billTo.gstRegistered"
            :field="gstinField"
            :value="billTo.gstin"
            :errors="billToFieldErrors"
            @update:value="(v) => { billTo.gstin = v; }"
          />
          <div v-if="billTo.gstRegistered" class="space-y-2">
            <p class="text-sm font-medium text-slate-700 dark:text-slate-300">
              {{ t('settings.billingFieldGstCertificate') }}
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('settings.billingFieldGstCertificateHint') }}
            </p>
            <div
              v-if="billTo.gstCertificateUrl"
              class="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/60"
            >
              <DocumentArrowUpIcon class="h-4 w-4 shrink-0 text-slate-500" />
              <span class="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                {{ billTo.gstCertificateFileName || t('settings.billingFieldGstCertificate') }}
              </span>
              <a
                :href="gstCertificateMediaUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                {{ t('settings.billingFieldGstCertificateView') }}
              </a>
              <button
                type="button"
                class="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:text-white"
                :disabled="gstCertificateBusy"
                @click="triggerGstCertificatePicker"
              >
                {{ t('settings.billingFieldGstCertificateReplace') }}
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-500 disabled:opacity-50"
                :disabled="gstCertificateBusy"
                @click="removeGstCertificate"
              >
                <XMarkIcon class="h-4 w-4" />
                {{ t('settings.billingFieldGstCertificateRemove') }}
              </button>
            </div>
            <button
              v-else
              type="button"
              class="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
              :disabled="gstCertificateBusy"
              @click="triggerGstCertificatePicker"
            >
              <DocumentArrowUpIcon class="h-4 w-4" />
              {{ gstCertificateBusy ? t('states.loading') : t('settings.billingFieldGstCertificateChoose') }}
            </button>
          </div>
          <DynamicFormField
            :field="addressField"
            :value="billTo.line1"
            @update:value="(v) => { billTo.line1 = v; }"
          />
          <DynamicFormField
            :field="countryField"
            :value="billTo.country"
            @update:value="(v) => { billTo.country = v; }"
          />
          <DynamicFormField
            :field="stateField"
            :value="billTo.state"
            @update:value="(v) => { billTo.state = v; }"
          />
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div
              class="relative"
              @focusin="citySuggestOpen = true"
              @focusout="onCitySuggestBlur"
            >
              <DynamicFormField
                :field="cityField"
                :value="billTo.city"
                @update:value="(v) => { billTo.city = v; citySuggestOpen = true; }"
              />
              <ul
                v-if="citySuggestOpen && filteredCitySuggestions.length"
                class="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 dark:bg-gray-700 dark:ring-white/10"
                role="listbox"
              >
                <li
                  v-for="cityName in filteredCitySuggestions"
                  :key="cityName"
                  class="cursor-pointer px-3 py-2 text-gray-900 hover:bg-indigo-50 dark:text-gray-100 dark:hover:bg-indigo-900/20"
                  role="option"
                  @mousedown.prevent="selectBillingCity(cityName)"
                >
                  {{ cityName }}
                </li>
              </ul>
            </div>
            <DynamicFormField
              :field="pincodeField"
              :value="billTo.pincode"
              :errors="billToFieldErrors"
              @update:value="(v) => { billTo.pincode = v; }"
            />
          </div>
          <DynamicFormField
            :field="emailField"
            :value="billTo.billingEmail"
            @update:value="(v) => { billTo.billingEmail = v; }"
          />
          <DynamicFormField
            :field="phoneField"
            :value="billTo.billingPhone"
            @update:value="(v) => { billTo.billingPhone = v; }"
          />
          <button
            type="submit"
            class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            :disabled="billingPartyBusy || (billTo.gstRegistered && !!String(billTo.gstin || '').trim() && billToFieldErrors.gstin)"
          >
            {{ billingPartyBusy ? t('settings.commercialBillingBootstrapping') : t('settings.billingDetailsSave') }}
          </button>
        </form>
      </div>

      <!-- Invoices -->
      <div
        v-show="isSandboxMode || billingTab === 'invoices'"
        class="px-6 py-6 sm:px-8"
        role="tabpanel"
      >
        <template v-if="isSandboxMode">
          <h4 class="text-sm font-semibold text-slate-900 dark:text-white">
            {{ t('settings.billingSandboxFooterHeading') }}
          </h4>
          <p class="mt-2 max-w-2xl text-sm text-slate-500">
            {{ t('settings.billingSandboxFooterBody') }}
          </p>
          <a
            href="/pricing"
            target="_blank"
            rel="noopener"
            class="mt-4 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            {{ t('settings.billingViewPricing') }}
            <ArrowTopRightOnSquareIcon class="h-3.5 w-3.5" />
          </a>
        </template>
        <template v-else>
        <div
          v-if="hasUnpaidInvoices"
          class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-900/50 dark:bg-amber-950/30"
        >
          <p class="text-amber-900 dark:text-amber-200">
            {{
              t('settings.billingUnpaidBanner', {
                count: unpaidInvoiceCount,
                amount: formatInrFromPaise(unpaidTotalMinor),
              })
            }}
          </p>
          <button
            type="button"
            class="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            :disabled="!payableInvoice || checkingOutInvoiceId === payableInvoice?._id"
            @click="payInvoice(payableInvoice)"
          >
            {{
              checkingOutInvoiceId === payableInvoice?._id
                ? t('settings.commercialBillingPaying')
                : t('settings.commercialBillingPayNow')
            }}
          </button>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h4 class="text-sm font-semibold text-slate-900 dark:text-white">
            {{ t('settings.billingInvoicesHeading') }}
          </h4>
        </div>

        <ul v-if="invoices.length" class="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          <li
            v-for="inv in invoices"
            :key="inv._id"
            class="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
          >
            <div>
              <p class="font-medium tabular-nums text-slate-900 dark:text-white">{{ inv.invoiceNumber }}</p>
              <span
                class="mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                :class="invoiceStatusClass(inv)"
              >
                {{ invoiceStatusLabel(inv) }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-semibold tabular-nums">{{ formatInrFromPaise(inv.totalMinor) }}</span>
              <span
                v-if="inv.isRevised || (inv.snapshot?.revisions?.length > 0)"
                class="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
              >
                {{ t('settings.billingInvoiceRevisedBadge', {
                  version: inv.currentVersion || ((inv.snapshot?.revisions?.length || 0) + 1),
                }) }}
              </span>
              <button
                type="button"
                class="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold dark:border-slate-600"
                @click="downloadInvoicePdf(inv)"
              >
                {{ t('settings.billingDownloadPdf') }}
              </button>
              <button
                v-if="isUnpaidInvoice(inv)"
                type="button"
                class="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                :disabled="checkingOutInvoiceId === inv._id"
                @click="payInvoice(inv)"
              >
                {{ checkingOutInvoiceId === inv._id ? t('settings.commercialBillingPaying') : t('settings.commercialBillingPayNow') }}
              </button>
              <button
                v-if="isUnpaidInvoice(inv)"
                type="button"
                class="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold dark:border-slate-600"
                @click="openManualPay(inv)"
              >
                {{ t('settings.billingSubmitPayment') }}
              </button>
            </div>
          </li>
        </ul>
        <p v-else-if="isTrialing" class="mt-3 text-sm text-slate-500">{{ t('settings.billingNoInvoicesTrial') }}</p>
        <p v-else-if="isTrialExpired" class="mt-3 text-sm text-slate-500">{{ t('settings.billingTrialExpiredHint') }}</p>
        <p v-else class="mt-3 text-sm text-slate-500">{{ t('settings.billingNoInvoicesHint') }}</p>

        <a
          href="/pricing"
          target="_blank"
          rel="noopener"
          class="mt-5 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          {{ t('settings.billingViewPricing') }}
          <ArrowTopRightOnSquareIcon class="h-3.5 w-3.5" />
        </a>
        </template>
      </div>
        </div>
      </div>
    </template>

    <!-- Subscribe wizard -->
    <div
      v-if="showSubscribeWizard"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="showSubscribeWizard = false"
    >
      <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ t('settings.billingSubscribeTitle') }}</h3>
        <p class="mt-1 text-sm text-slate-500">{{ t('settings.billingSubscribeSubtitle') }}</p>

        <div class="mt-4 space-y-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{ t('settings.billingSubscribeCycle') }}</p>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-lg px-3 py-2 text-sm font-semibold"
              :class="subscribeCycle === 'monthly' ? 'bg-indigo-600 text-white' : 'border border-slate-300 dark:border-slate-600'"
              @click="subscribeCycle = 'monthly'"
            >
              {{ t('settings.commercialBillingPeriodMonthly') }}
            </button>
            <button
              type="button"
              class="rounded-lg px-3 py-2 text-sm font-semibold"
              :class="subscribeCycle === 'annual' ? 'bg-indigo-600 text-white' : 'border border-slate-300 dark:border-slate-600'"
              @click="subscribeCycle = 'annual'"
            >
              {{ t('settings.commercialBillingPeriodAnnual') }}
            </button>
          </div>

          <p class="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{{ t('settings.billingSubscribeReview') }}</p>
          <ul class="text-sm text-slate-600 dark:text-slate-300">
            <li v-for="row in subscribeReviewRows" :key="row.productCode" class="flex justify-between py-1">
              <span>{{ lineLabel(row.productCode) }} × {{ row.quantity }}</span>
              <span class="tabular-nums">{{ formatInrFromPaise(row.lineTotalMinor) }}</span>
            </li>
            <li class="mt-1 flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900 dark:border-slate-700 dark:text-white">
              <span>{{ t('settings.billingBreakdownTotal') }}</span>
              <span class="tabular-nums">{{ formatInrFromPaise(subscribeReviewTotalMinor) }}{{ subscribePeriodSuffix }}</span>
            </li>
          </ul>
          <p v-if="subscribeAnnualSavingsMinor > 0" class="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            {{ t('settings.billingSubscribeAnnualSavings', { amount: formatInrFromPaise(subscribeAnnualSavingsMinor) }) }}
          </p>

          <p class="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{{ t('settings.billingSubscribeBillTo') }}</p>
          <p class="text-xs text-slate-500">{{ t('settings.billingSubscribeBillToHint') }}</p>
          <div class="space-y-4">
            <DynamicFormField
              :field="companyNameField"
              :value="billTo.companyName"
              @update:value="(v) => { billTo.companyName = v; }"
            />
            <label class="inline-flex cursor-pointer items-center gap-2.5">
              <HeadlessCheckbox v-model="billTo.gstRegistered" />
              <span class="text-sm text-slate-700 dark:text-slate-300">{{ t('settings.billingFieldGstRegistered') }}</span>
            </label>
            <DynamicFormField
              v-if="billTo.gstRegistered"
              :field="gstinField"
              :value="billTo.gstin"
              :errors="billToFieldErrors"
              @update:value="(v) => { billTo.gstin = v; }"
            />
            <div v-if="billTo.gstRegistered" class="space-y-2">
              <p class="text-sm font-medium text-slate-700 dark:text-slate-300">
                {{ t('settings.billingFieldGstCertificate') }}
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ t('settings.billingFieldGstCertificateHint') }}
              </p>
              <div
                v-if="billTo.gstCertificateUrl"
                class="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/60"
              >
                <DocumentArrowUpIcon class="h-4 w-4 shrink-0 text-slate-500" />
                <span class="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                  {{ billTo.gstCertificateFileName || t('settings.billingFieldGstCertificate') }}
                </span>
                <a
                  :href="gstCertificateMediaUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  {{ t('settings.billingFieldGstCertificateView') }}
                </a>
                <button
                  type="button"
                  class="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:text-white"
                  :disabled="gstCertificateBusy"
                  @click="triggerGstCertificatePicker"
                >
                  {{ t('settings.billingFieldGstCertificateReplace') }}
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-500 disabled:opacity-50"
                  :disabled="gstCertificateBusy"
                  @click="removeGstCertificate"
                >
                  <XMarkIcon class="h-4 w-4" />
                  {{ t('settings.billingFieldGstCertificateRemove') }}
                </button>
              </div>
              <button
                v-else
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                :disabled="gstCertificateBusy"
                @click="triggerGstCertificatePicker"
              >
                <DocumentArrowUpIcon class="h-4 w-4" />
                {{ gstCertificateBusy ? t('states.loading') : t('settings.billingFieldGstCertificateChoose') }}
              </button>
            </div>
            <DynamicFormField
              :field="addressField"
              :value="billTo.line1"
              @update:value="(v) => { billTo.line1 = v; }"
            />
            <DynamicFormField
              :field="countryField"
              :value="billTo.country"
              @update:value="(v) => { billTo.country = v; }"
            />
            <DynamicFormField
              :field="stateField"
              :value="billTo.state"
              @update:value="(v) => { billTo.state = v; }"
            />
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div
                class="relative"
                @focusin="citySuggestOpen = true"
                @focusout="onCitySuggestBlur"
              >
                <DynamicFormField
                  :field="cityField"
                  :value="billTo.city"
                  @update:value="(v) => { billTo.city = v; citySuggestOpen = true; }"
                />
                <ul
                  v-if="citySuggestOpen && filteredCitySuggestions.length"
                  class="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 dark:bg-gray-700 dark:ring-white/10"
                  role="listbox"
                >
                  <li
                    v-for="cityName in filteredCitySuggestions"
                    :key="cityName"
                    class="cursor-pointer px-3 py-2 text-gray-900 hover:bg-indigo-50 dark:text-gray-100 dark:hover:bg-indigo-900/20"
                    role="option"
                    @mousedown.prevent="selectBillingCity(cityName)"
                  >
                    {{ cityName }}
                  </li>
                </ul>
              </div>
              <DynamicFormField
                :field="pincodeField"
                :value="billTo.pincode"
                :errors="billToFieldErrors"
                @update:value="(v) => { billTo.pincode = v; }"
              />
            </div>
            <DynamicFormField
              :field="emailField"
              :value="billTo.billingEmail"
              @update:value="(v) => { billTo.billingEmail = v; }"
            />
            <DynamicFormField
              :field="phoneField"
              :value="billTo.billingPhone"
              @update:value="(v) => { billTo.billingPhone = v; }"
            />
          </div>
          <p v-if="!subscribeBillToValid" class="text-xs text-red-600 dark:text-red-400">
            {{ t('settings.billingSubscribeBillToRequired') }}
          </p>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600" @click="showSubscribeWizard = false">
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="subscribeBusy || !subscribeBillToValid"
            @click="runSubscribe"
          >
            {{ subscribeBusy ? t('settings.commercialBillingBootstrapping') : t('settings.billingSubscribeConfirm') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Manual payment drawer -->
    <div
      v-if="showManualPay"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      @click.self="showManualPay = false"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ t('settings.billingSubmitPayment') }}</h3>
        <p class="mt-1 text-sm text-slate-500">{{ manualPayInvoice?.invoiceNumber }}</p>
        <div class="mt-4 space-y-3">
          <input v-model="manualUtr" type="text" :placeholder="t('settings.billingFieldUtr')" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
          <textarea v-model="manualNotes" rows="3" :placeholder="t('settings.billingFieldNotes')" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600" @click="showManualPay = false">
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            :disabled="manualBusy || !manualUtr"
            @click="submitManualPay"
          >
            {{ manualBusy ? t('settings.commercialBillingPaying') : t('settings.billingSubmitPaymentConfirm') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Cancel modal -->
    <div
      v-if="showCancelModal && cancelPreview"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="showCancelModal = false"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ t('settings.billingCancelSubscription') }}</h3>
        <ul class="mt-4 space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <li>{{ t('settings.billingCancelAmountPaid') }}: {{ formatInrFromPaise(cancelPreview.amountPaidMinor) }}</li>
          <li>{{ t('settings.billingCancelRefundEligible') }}: {{ cancelPreview.refundEligible ? t('settings.billingCancelYes') : t('settings.billingCancelNo') }}</li>
          <li>{{ t('settings.billingCancelEstimatedRefund') }}: {{ formatInrFromPaise(cancelPreview.estimatedRefundMinor) }}</li>
        </ul>
        <div class="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" class="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600" @click="showCancelModal = false">
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600"
            :disabled="cancelBusy"
            @click="confirmCancel(false)"
          >
            {{ t('settings.billingCancelAtPeriodEnd') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
            :disabled="cancelBusy"
            @click="confirmCancel(true)"
          >
            {{ t('settings.billingCancelImmediate') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
