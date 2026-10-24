<template>
  <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ t('records.paymentAllocationsTitle') }}</h3>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('records.paymentAllocationsHint') }}</p>
    </div>

    <div v-if="allocations.length" class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60">
          <tr>
            <th class="px-3 py-2 text-left">{{ t('records.paymentAllocationInvoice') }}</th>
            <th class="px-3 py-2 text-right">{{ t('records.paymentAllocationAmount') }}</th>
            <th class="px-3 py-2 text-left">{{ t('records.status') }}</th>
            <th class="px-3 py-2 text-left">{{ t('records.paymentAllocationAppliedAt') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in allocations"
            :key="row.paymentAllocationId"
            class="border-t border-gray-100 dark:border-gray-800"
          >
            <td class="px-3 py-2">
              <router-link
                v-if="row.invoiceMongoId"
                :to="`/invoices/${row.invoiceMongoId}`"
                class="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {{ row.invoiceNumber || row.invoiceId }}
              </router-link>
              <span v-else>{{ row.invoiceId }}</span>
            </td>
            <td class="px-3 py-2 text-right tabular-nums">{{ formatMoney(row.amountApplied) }}</td>
            <td class="px-3 py-2">{{ row.status }}</td>
            <td class="px-3 py-2">{{ formatDate(row.appliedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
      {{ t('records.paymentAllocationsEmpty') }}
    </div>

    <div v-if="summary" class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
      <div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.paymentAmount') }}</div>
        <div class="font-medium tabular-nums">{{ formatMoney(summary.payment?.amount) }}</div>
      </div>
      <div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.paymentAmountAllocated') }}</div>
        <div class="font-medium tabular-nums">{{ formatMoney(summary.payment?.amountAllocated) }}</div>
      </div>
      <div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.paymentAmountUnallocated') }}</div>
        <div class="font-medium tabular-nums">{{ formatMoney(summary.payment?.amountUnallocated) }}</div>
      </div>
      <div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.paymentAmountRefunded') }}</div>
        <div class="font-medium tabular-nums">{{ formatMoney(summary.payment?.amountRefunded) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { formatUserDate } from '@/utils/localeFormat';
import { formatCurrencyValue } from '@/utils/currencyOptions';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['updated']);

const { t } = useI18n();
const summary = ref(null);
const allocations = ref([]);

function formatMoney(value) {
  return formatCurrencyValue(value, { currencyCode: props.record?.currency }) ?? '—';
}

function formatDate(value) {
  if (!value) return '—';
  return formatUserDate(value) || '—';
}

async function loadDetail() {
  if (!props.record?._id) return;
  try {
    const res = await apiClient.get(`/payments/${props.record._id}?include=refundEligibility`);
    if (!res?.success) return;
    summary.value = res.data;
    allocations.value = (res.data?.allocations || []).map((row) => ({
      ...row,
      invoiceNumber: row.invoiceNumber || null,
      invoiceMongoId: row.invoiceMongoId || null
    }));
    if (props.record && res.data?.payment) {
      emit('updated', {
        type: 'record-field',
        field: 'maxRefundable',
        value: res.data.refundEligibility?.maxRefundable
      });
    }
  } catch {
    allocations.value = [];
  }
}

watch(() => props.record?._id, loadDetail, { immediate: true });

watch(
  () => props.context?.lastSectionUpdate,
  () => loadDetail()
);
</script>
