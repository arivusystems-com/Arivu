<template>
  <CardWidget class="ld-card-group" :title="t('common.metricsTitle')">
    <template #actions>
      <button @click="openConfig" class="rounded-md bg-white dark:bg-gray-800 px-2 py-1.5 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" :title="t('common.metricsConfigure')">
        <Cog6ToothIcon class="w-4 h-4 text-gray-700 dark:text-gray-300" />
      </button>
    </template>

    <div v-if="visibleMetrics.length === 0" class="flex-1 flex items-center justify-center py-6">
      <div class="text-center">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('common.metricsEmptyYet') }}</p>
        <button @click="openConfig" class="mt-2 rounded-md bg-white dark:bg-gray-800 px-3 py-1.5 text-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">{{ t('common.metricsConfigure') }}</button>
      </div>
    </div>

    <div v-else class="grid grid-cols-2 gap-3">
      <div v-for="m in visibleMetrics" :key="m.id" class="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400 font-regular">{{ metricDisplayLabel(m) }}</p>
            <div v-if="resolveUserForMetric(m)" class="flex items-center gap-2">
              <Avatar :user="resolveUserForMetric(m)" size="md" />
              <span class="text-base font-medium text-gray-900 dark:text-white">{{ getUserDisplayName(resolveUserForMetric(m)) }}</span>
            </div>
            <p v-else class="text-lg font-medium text-gray-900 dark:text-white">{{ formatMetricValue(m) }}</p>
          </div>
        </div>
      </div>
    </div>

    <TransitionRoot as="template" :show="showConfig">
      <Dialog class="relative z-50" @close="closeConfig">
        <TransitionChild as="template" enter="ease-out duration-200" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
          <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-hidden">
          <div class="absolute inset-0 overflow-hidden">
            <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <TransitionChild as="template" enter="transform transition ease-in-out duration-300 sm:duration-300" enter-from="translate-x-full" enter-to="translate-x-0" leave="transform transition ease-in-out duration-300 sm:duration-300" leave-from="translate-x-0" leave-to="translate-x-full">
                <DialogPanel class="pointer-events-auto w-screen max-w-6xl">
                  <div class="rounded-tl-xl overflow-hidden relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 shadow-xl">
                    <div class="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                      <DialogTitle class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{{ t('common.metricsConfigure') }}</DialogTitle>
                      <button type="button" class="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200" @click="closeConfig">
                        <span class="sr-only">{{ t('common.metricsClosePanel') }}</span>
                        <XMarkIcon class="size-6" />
                      </button>
                    </div>
                    <div class="flex-1 overflow-auto p-4 space-y-4">
        <div class="flex items-center justify-end">
          <button @click="addMetric" class="inline-flex items-center gap-2 rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <PlusIcon class="w-4 h-4" />
            {{ t('common.metricsAdd') }}
          </button>
        </div>
          <div v-if="metrics.length === 0" class="text-xs text-gray-500 dark:text-gray-400">{{ t('common.metricsEmptyPanel') }}</div>
          <div v-else class="space-y-3">
            <!-- Header Row -->
            <div class="grid grid-cols-[auto_3fr_2fr_3fr_2fr_auto] items-center pb-2 border-b border-gray-200 dark:border-gray-700">
              <div>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">#No.</label>
              </div>
              <div class="pl-3">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('common.metricsLabel') }}</label>
              </div>
              <div class="">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('common.metricsSource') }}</label>
              </div>
              <div class="">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('common.metricsField') }}</label>
              </div>
              <div class="">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('common.metricsAggregation') }}</label>
              </div>
              <div>
                <!-- Empty header for delete button column -->
              </div>
            </div>
            <!-- Metric Rows -->
            <div
              v-for="(m, idx) in metrics"
              :key="m.id"
              class="group grid grid-cols-[auto_3fr_2fr_3fr_2fr_auto] gap-3 rounded-md"
              draggable="true"
              @dragstart="onDragStart($event, idx)"
              @dragover.prevent="onDragOver($event, idx)"
              @drop="onDrop($event, idx)"
              @dragend="onDragEnd"
            >
              <div class="relative flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 w-[3ch]">
                <span class="transition-opacity group-hover:opacity-0">{{ idx + 1 }}</span>
                <button
                  type="button"
                  class="opacity-0 group-hover:opacity-100 transition-opacity absolute inset-0 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  :title="t('common.metricsDragReorder')"
                  @mousedown="onHandleMouseDown(idx)"
                >
                  <Bars3Icon class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <div class="df-no-label">
                <DynamicFormField
@picklist-option-created="onPicklistOptionCreated"
                  :field="{ key: 'label', label: t('records.metricLabelCaption'), dataType: 'Text' }"
                  :value="m.label"
                  @update:value="val => (m.label = val)"
                  :errors="{}"
                />
              </div>
              <div class="df-no-label">
                <DynamicFormField
@picklist-option-created="onPicklistOptionCreated"
                  :field="{ key: 'source', label: 'Source', dataType: 'Picklist', options: [
                    { value: 'record', label: 'Record Field' },
                    { value: 'stats', label: 'Stats' }
                  ] }"
                  :value="m.source"
                  @update:value="val => (m.source = val)"
                  :errors="{}"
                />
              </div>
              <div class="df-no-label">
                <DynamicFormField
@picklist-option-created="onPicklistOptionCreated"
                  :field="{ key: 'field', label: 'Field', dataType: 'Picklist', options: availableFields.map(f => ({ value: f.key, label: f.label })) }"
                  :value="m.field"
                  @update:value="val => (m.field = val)"
                  :errors="{}"
                />
              </div>
              <div class="df-no-label">
                <DynamicFormField
@picklist-option-created="onPicklistOptionCreated"
                  :field="{ key: 'agg', label: 'Aggregation', dataType: 'Picklist', options: [
                    { value: 'value', label: 'Value' },
                    { value: 'sum', label: 'Sum' },
                    { value: 'avg', label: 'Average' },
                    { value: 'count', label: 'Count' },
                    { value: 'days_since', label: 'Days Since' },
                    { value: 'ai_score', label: 'AI Score' }
                  ] }"
                  :value="m.agg"
                  @update:value="val => (m.agg = val)"
                  :errors="{}"
                />
              </div>
              <div class="flex items-center justify-center">
                <button @click="removeMetric(idx)" class="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" :title="t('common.metricsDelete')">
                  <TrashIcon class="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
                    </div>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </CardWidget>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const DEFAULT_METRIC_LABELS = {
  newMetric: 'Metric',
  lead_score: 'Lead Score',
  days_since_creation: 'Days Since Creation',
  source_channel: 'Source Channel',
  last_contacted: 'Last Contacted',
  owner: 'Owner',
  total_deals_value: 'Total Deals Value',
  active_deals_count: 'Open Deals',
  ltv: 'LTV',
  total_active_deals: 'Total Open Deals',
  open_invoices_value: 'Open Invoices',
  active_cases: 'Active Cases',
  account_manager: 'Account Manager',
  deal_value: 'Deal Value',
  expected_close: 'Expected Close',
  probability: 'Probability %',
  days_in_stage: 'Days in Stage'
};

const DEFAULT_METRIC_LABEL_KEYS = {
  lead_score: 'records.metricLeadScore',
  days_since_creation: 'records.metricDaysSinceCreation',
  source_channel: 'records.metricSourceChannel',
  last_contacted: 'records.metricLastContacted',
  owner: 'people.sysFieldOwner',
  total_deals_value: 'records.metricTotalDealsValue',
  active_deals_count: 'deals.listStatOpenDeals',
  ltv: 'records.metricLtv',
  total_active_deals: 'records.metricTotalOpenDeals',
  open_invoices_value: 'records.metricOpenInvoices',
  active_cases: 'records.metricActiveCases',
  account_manager: 'records.metricAccountManager',
  deal_value: 'records.metricDealValue',
  expected_close: 'deals.dealDetailExpectedClose',
  probability: 'records.metricProbability',
  days_in_stage: 'records.metricDaysInStage'
};

function metricDisplayLabel(metric) {
  const canonical = DEFAULT_METRIC_LABELS[metric?.id];
  const key = DEFAULT_METRIC_LABEL_KEYS[metric?.id];
  if (canonical && key && metric.label === canonical) return t(key);
  if (metric?.label === DEFAULT_METRIC_LABELS.newMetric) return t('records.metricDefaultName');
  return metric?.label || '';
}
import CardWidget from '@/components/common/CardWidget.vue';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { XMarkIcon, Cog6ToothIcon, TrashIcon, PlusIcon, Bars3Icon } from '@heroicons/vue/24/outline';
import Avatar from '@/components/common/Avatar.vue';
import DynamicFormField from '@/components/common/DynamicFormField.vue';
import { appendCreatedPicklistOption } from '@/utils/picklistInlineOptionCreate';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authRegistry';
import { formatCurrencyValue, resolveCurrencyCodeForField } from '@/utils/currencyOptions';
import { formatUserDate } from '@/utils/localeFormat';

function onPicklistOptionCreated(payload) {
  appendCreatedPicklistOption(payload?.field, payload?.option);
}

const props = defineProps({
  record: { type: Object, default: null },
  recordType: { type: String, required: true },
  moduleDefinition: { type: Object, required: false },
  stats: { type: Object, default: () => ({}) }
});

const metrics = ref([]);
const showConfig = ref(false);
const usersById = ref(new Map());

const loadUsersForAssignment = async () => {
  try {
    const res = await apiClient.get('/users/list');
    const users = res?.data || res?.users || res || [];
    const map = new Map();
    (Array.isArray(users) ? users : (users.data || [])).forEach(u => {
      if (u && u._id) map.set(u._id, u);
    });
    usersById.value = map;
  } catch {}
};

const openConfig = () => { showConfig.value = true; };
const closeConfig = () => { showConfig.value = false; };
const addMetric = () => { metrics.value.push({ id: cryptoRandomId(), label: DEFAULT_METRIC_LABELS.newMetric, source: 'record', field: '', agg: 'value' }); };
const removeMetric = (idx) => { metrics.value.splice(idx, 1); };

// Drag-and-drop reorder state and handlers
const dragState = ref({ allow: false, fromIndex: -1 });
const onHandleMouseDown = (idx) => {
  dragState.value.allow = true;
  dragState.value.fromIndex = idx;
};
const onDragStart = (event, idx) => {
  // Only start dragging when initiated from handle
  if (!dragState.value.allow || dragState.value.fromIndex !== idx) {
    event.preventDefault();
    return;
  }
  try {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(idx));
  } catch {}
};
const onDragOver = (event, idx) => {
  // Required to allow drop
  event.dataTransfer.dropEffect = 'move';
};
const onDrop = (event, toIndex) => {
  const fromIndex = dragState.value.fromIndex;
  dragState.value.allow = false;
  if (fromIndex === -1 || fromIndex === toIndex) return;
  const arr = [...metrics.value];
  const [moved] = arr.splice(fromIndex, 1);
  arr.splice(toIndex, 0, moved);
  metrics.value = arr;
};
const onDragEnd = () => {
  dragState.value.allow = false;
  dragState.value.fromIndex = -1;
};

const availableFields = computed(() => {
  const fields = props.moduleDefinition?.fields || [];
  return fields.map(f => ({ key: f.key || f.name || f.localField, label: f.label || f.name || f.key })).filter(f => !!f.key);
});

const iconBg = (m) => 'bg-gray-100 dark:bg-gray-800';
const iconText = (m) => 'text-gray-700 dark:text-gray-300';

const visibleMetrics = computed(() => metrics.value);

function defaultMetricsForContext() {
  const type = props.recordType;
  const record = props.record || {};
  if (type === 'people') {
    const salesRole = (record.sales_type ?? '').toString().toLowerCase();
    const isLead =
      salesRole === 'lead' ||
      (!salesRole && String(record.lead_status || '').toLowerCase().includes('lead'));
    const ownerKey = userFieldKeyForRecord(record);
    if (isLead) {
      const base = [
        { id: 'lead_score', label: DEFAULT_METRIC_LABELS.lead_score, source: 'record', field: 'lead_score', agg: 'ai_score', icon: 'AI' },
        { id: 'days_since_creation', label: DEFAULT_METRIC_LABELS.days_since_creation, source: 'record', field: 'createdAt', agg: 'days_since', icon: 'D' },
        { id: 'source_channel', label: DEFAULT_METRIC_LABELS.source_channel, source: 'record', field: 'source', agg: 'value', icon: 'S' },
        { id: 'last_contacted', label: DEFAULT_METRIC_LABELS.last_contacted, source: 'record', field: 'last_contacted_at', agg: 'value', icon: 'L' }
      ];
      if (ownerKey) base.unshift({ id: 'owner', label: DEFAULT_METRIC_LABELS.owner, source: 'record', field: ownerKey, agg: 'value', icon: 'U' });
      return base;
    }
    const base = [
      { id: 'total_deals_value', label: DEFAULT_METRIC_LABELS.total_deals_value, source: 'stats', field: 'totalDealsValue', agg: 'sum', icon: '$' },
      { id: 'active_deals_count', label: DEFAULT_METRIC_LABELS.active_deals_count, source: 'stats', field: 'activeDealsCount', agg: 'count', icon: '#' },
      { id: 'last_contacted', label: DEFAULT_METRIC_LABELS.last_contacted, source: 'record', field: 'last_contacted_at', agg: 'value', icon: 'L' },
      { id: 'ltv', label: DEFAULT_METRIC_LABELS.ltv, source: 'stats', field: 'ltv', agg: 'sum', icon: '$' }
    ];
    if (ownerKey) base.unshift({ id: 'owner', label: DEFAULT_METRIC_LABELS.owner, source: 'record', field: ownerKey, agg: 'value', icon: 'U' });
    return base;
  }
  if (type === 'organizations') {
    return [
      { id: 'total_active_deals', label: DEFAULT_METRIC_LABELS.total_active_deals, source: 'stats', field: 'activeDealsCount', agg: 'count', icon: '#' },
      { id: 'open_invoices_value', label: DEFAULT_METRIC_LABELS.open_invoices_value, source: 'stats', field: 'openInvoicesValue', agg: 'sum', icon: '$' },
      { id: 'active_cases', label: DEFAULT_METRIC_LABELS.active_cases, source: 'stats', field: 'activeTickets', agg: 'count', icon: '#' },
      { id: 'account_manager', label: DEFAULT_METRIC_LABELS.account_manager, source: 'record', field: 'accountManagerName', agg: 'value', icon: 'AM' }
    ];
  }
  if (type === 'deals') {
    return [
      { id: 'deal_value', label: DEFAULT_METRIC_LABELS.deal_value, source: 'record', field: 'value', agg: 'value', icon: '$' },
      { id: 'expected_close', label: DEFAULT_METRIC_LABELS.expected_close, source: 'record', field: 'expectedCloseDate', agg: 'value', icon: '⏲' },
      { id: 'probability', label: DEFAULT_METRIC_LABELS.probability, source: 'record', field: 'probability', agg: 'value', icon: '%' },
      { id: 'days_in_stage', label: DEFAULT_METRIC_LABELS.days_in_stage, source: 'record', field: 'stageChangedAt', agg: 'days_since', icon: 'D' }
    ];
  }
  return [];
}

const storageKey = computed(() => `summaryview-metrics-${props.recordType || 'unknown'}`);

onMounted(async () => {
  // Preload users to resolve user IDs like accountManager
  await loadUsersForAssignment();
  // Try backend first
  try {
    const res = await apiClient.get('/user-preferences/metrics-config', { params: { recordType: props.recordType } });
    if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
      metrics.value = res.data;
      localStorage.setItem(storageKey.value, JSON.stringify(res.data));
      return;
    }
  } catch {}
  // Fallback to localStorage
  try {
    const saved = localStorage.getItem(storageKey.value);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        metrics.value = parsed;
        return;
      }
    }
  } catch {}
  if (metrics.value.length === 0) {
    metrics.value = defaultMetricsForContext();
  }
});

// If user re-authenticates after clearing site data, sync from backend
const authStore = useAuthStore();
watch(() => authStore.isAuthenticated, async (isAuthed) => {
  if (!isAuthed) return;
  try {
    const res = await apiClient.get('/user-preferences/metrics-config', { params: { recordType: props.recordType } });
    if (res?.success && Array.isArray(res.data)) {
      metrics.value = res.data;
      localStorage.setItem(storageKey.value, JSON.stringify(res.data));
    } else {
      // Persist current metrics for this user if backend has none
      await apiClient.post('/user-preferences/metrics-config', { recordType: props.recordType, metrics: metrics.value || [] });
    }
  } catch {}
});

watch(() => props.recordType, async () => {
  // Load module-specific config when record type changes
  try {
    await loadUsersForAssignment();
    const res = await apiClient.get('/user-preferences/metrics-config', { params: { recordType: props.recordType } });
    if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
      metrics.value = res.data;
      localStorage.setItem(storageKey.value, JSON.stringify(res.data));
      return;
    }
  } catch {}
  try {
    const saved = localStorage.getItem(storageKey.value);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        metrics.value = parsed;
        return;
      }
    }
  } catch {}
  metrics.value = defaultMetricsForContext();
});

watch(metrics, async (val) => {
  try {
    localStorage.setItem(storageKey.value, JSON.stringify(val || []));
  } catch {}
  // Persist to backend
  try {
    await apiClient.post('/user-preferences/metrics-config', { recordType: props.recordType, metrics: val || [] });
  } catch {}
}, { deep: true });

function computeMetric(m) {
  const source = m.source === 'stats' ? props.stats || {} : (props.record || {});
  const raw = source ? source[m.field] : undefined;
  // Resolve any user reference (string ObjectId or populated object) to a display name
  if (raw) {
    if (typeof raw === 'string') {
      const name = usersById.value.get(raw);
      if (name) return name;
    } else if (typeof raw === 'object' && raw._id) {
      const name = usersById.value.get(raw._id);
      if (name) return name;
      // Fallback to common name fields on object
      const fallbackName = (raw.first_name && raw.last_name) ? `${raw.first_name} ${raw.last_name}`.trim() : (raw.name || raw.username || raw.email);
      if (fallbackName) return fallbackName;
    }
  }
  switch (m.agg) {
    case 'value':
      return raw;
    case 'sum':
      return typeof raw === 'number' ? raw : (Number(raw) || 0);
    case 'avg':
      return typeof raw === 'number' ? raw : (Number(raw) || 0);
    case 'count':
      return Array.isArray(raw) ? raw.length : (Number(raw) || 0);
    case 'days_since':
      if (!raw) return null;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return null;
      return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    case 'ai_score':
      return raw ?? props.stats?.leadScore ?? null;
    default:
      return raw;
  }
}

function formatMetricValue(m) {
  const v = computeMetric(m);
  if (v === null || v === undefined || v === '') return '—';
  if (m.id.includes('value') || m.agg === 'sum') return formatCurrency(v);
  if (m.id.includes('probability')) return `${Number(v) || 0}%`;
  if (m.agg === 'days_since') return `${v}d`;
  if (isDateLike(v)) return formatDate(v);
  return v;
}

function getUserDisplayName(user) {
  if (!user) return '';
  const name = [user.first_name || user.firstName, user.last_name || user.lastName].filter(Boolean).join(' ').trim();
  return name || user.name || user.username || user.email || user._id;
}

function resolveUserForMetric(m) {
  const source = m.source === 'stats' ? (props.stats || {}) : (props.record || {});
  const raw = source ? source[m.field] : undefined;
  if (!raw) return null;
  // raw can be string id or populated object
  if (typeof raw === 'string') {
    return usersById.value.get(raw) || null;
  }
  if (typeof raw === 'object') {
    if (raw._id && usersById.value.get(raw._id)) return usersById.value.get(raw._id);
    return raw._id ? raw : null;
  }
  return null;
}

function isDateLike(val) {
  if (!val) return false;
  const d = new Date(val);
  return !Number.isNaN(d.getTime());
}

function formatDate(val) {
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  return formatUserDate(d);
}

function formatCurrency(val) {
  const n = Number(val) || 0;
  const currencyCode = resolveCurrencyCodeForField({
    record: props.record,
    orgCurrency: authStore.organization,
  });
  return (
    formatCurrencyValue(n, {
      currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }) || '—'
  );
}

function cryptoRandomId() {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

function userFieldKeyForRecord(rec) {
  const candidateKeys = ['assignedTo', 'assigned_to', 'owner_id', 'owner', 'accountManager', 'account_manager'];
  for (const key of candidateKeys) {
    if (rec && Object.prototype.hasOwnProperty.call(rec, key) && rec[key]) return key;
  }
  return null;
}

watch(() => props.recordType, () => {
}, { immediate: true });
</script>

<style scoped>
.df-no-label :deep(label) { display: none; }
.df-no-label :deep(.mt-2) { margin-top: 0; }
</style>

