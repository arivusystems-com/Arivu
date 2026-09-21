<template>
  <TransitionRoot as="template" :show="open">
    <Dialog class="relative z-[10001]" @close="emitClose">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <TransitionChild
              as="template"
              enter="transform transition ease-in-out duration-300 sm:duration-300"
              enter-from="translate-x-full"
              enter-to="translate-x-0"
              leave="transform transition ease-in-out duration-300 sm:duration-300"
              leave-from="translate-x-0"
              leave-to="translate-x-full"
            >
              <div class="pointer-events-auto flex h-full">
                <DialogPanel
                  class="flex h-full w-[min(92vw,36rem)] max-w-[95vw] flex-col overflow-hidden rounded-tl-xl bg-white shadow-xl dark:bg-gray-800"
                >
                  <form
                    class="relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700"
                    @submit.prevent="onSubmit"
                  >
                    <div class="flex-shrink-0 border-b border-gray-100 bg-white px-4 py-5 sm:px-6 dark:border-gray-800 dark:bg-gray-900">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <DialogTitle class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                            {{ t('platform.commercialAdminReviseModalTitle') }}
                          </DialogTitle>
                          <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                            {{ invoice?.invoiceNumber }}
                            · {{ t('platform.commercialAdminReviseSameNumber') }}
                          </p>
                          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {{ t('platform.commercialAdminReviseModalHint') }}
                          </p>
                        </div>
                        <button
                          type="button"
                          class="relative flex-shrink-0 cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                          @click="emitClose"
                        >
                          <span class="absolute -inset-2.5" />
                          <span class="sr-only">{{ t('common.closePanel') }}</span>
                          <XMarkIcon class="size-6" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div class="h-0 flex-1 overflow-y-auto">
                      <div class="space-y-4 px-4 py-6 sm:px-6">
                        <div
                          v-for="line in previewLines"
                          :key="line._id"
                          class="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
                        >
                          <div class="flex flex-wrap items-start justify-between gap-3">
                            <div class="min-w-0">
                              <p class="text-sm font-semibold text-gray-900 dark:text-white">
                                {{ line.description }}
                              </p>
                              <p class="mt-0.5 text-xs text-gray-500">
                                × {{ line.quantity }} · {{ formatInrFromPaise(line.grossMinor) }}
                              </p>
                            </div>
                            <RadioGroup
                              :model-value="lineDiscounts[String(line._id)]?.mode || 'amount'"
                              class="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-600 dark:bg-gray-900/60"
                              @update:model-value="(mode) => setLineDiscountMode(line._id, mode)"
                            >
                              <RadioGroupOption
                                v-for="opt in discountModeOptions"
                                :key="opt.value"
                                v-slot="{ checked }"
                                :value="opt.value"
                                as="template"
                              >
                                <button
                                  type="button"
                                  class="rounded-md px-2.5 py-1 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                  :class="checked
                                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5 dark:bg-gray-800 dark:text-white dark:ring-white/10'
                                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'"
                                >
                                  {{ opt.label }}
                                </button>
                              </RadioGroupOption>
                            </RadioGroup>
                          </div>

                          <DynamicFormField
                            class="mt-3"
                            :field="lineDiscountField(line)"
                            :value="lineDiscounts[String(line._id)]?.value ?? ''"
                            @update:value="(v) => onLineDiscountValue(line._id, v)"
                          />

                          <p class="mt-2 text-right text-xs tabular-nums text-gray-600 dark:text-gray-300">
                            <template v-if="line.discountMinor > 0">
                              <span class="text-emerald-700 dark:text-emerald-400">
                                −{{ formatInrFromPaise(line.discountMinor) }}
                              </span>
                              <span class="mx-1 text-gray-400">→</span>
                            </template>
                            {{ formatInrFromPaise(line.amountMinor) }}
                          </p>
                        </div>

                        <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                          <div class="flex flex-wrap items-center justify-between gap-3">
                            <p class="text-sm font-semibold text-gray-900 dark:text-white">
                              {{ t('platform.commercialAdminInvoiceLevelDiscount') }}
                            </p>
                            <RadioGroup
                              :model-value="invoiceDiscount.mode"
                              class="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-600 dark:bg-gray-900/60"
                              @update:model-value="setInvoiceDiscountMode"
                            >
                              <RadioGroupOption
                                v-for="opt in discountModeOptions"
                                :key="`inv-${opt.value}`"
                                v-slot="{ checked }"
                                :value="opt.value"
                                as="template"
                              >
                                <button
                                  type="button"
                                  class="rounded-md px-2.5 py-1 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                  :class="checked
                                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5 dark:bg-gray-800 dark:text-white dark:ring-white/10'
                                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'"
                                >
                                  {{ opt.label }}
                                </button>
                              </RadioGroupOption>
                            </RadioGroup>
                          </div>

                          <DynamicFormField
                            class="mt-3"
                            :field="invoiceDiscountField"
                            :value="invoiceDiscount.value"
                            @update:value="onInvoiceDiscountValue"
                          />

                          <p
                            v-if="preview.invoiceDiscountMinor > 0"
                            class="mt-2 text-right text-xs tabular-nums text-emerald-700 dark:text-emerald-400"
                          >
                            {{ t('platform.commercialAdminDiscountEquals', {
                              amount: formatInrFromPaise(preview.invoiceDiscountMinor),
                            }) }}
                          </p>
                        </div>

                        <div class="rounded-xl bg-gray-50 p-4 text-sm dark:bg-gray-900/50">
                          <div class="flex justify-between gap-2">
                            <span>{{ t('platform.commercialAdminPreviewSubtotal') }}</span>
                            <span class="tabular-nums">{{ formatInrFromPaise(preview.subtotalMinor) }}</span>
                          </div>
                          <div
                            v-if="preview.invoiceDiscountMinor"
                            class="mt-1 flex justify-between gap-2 text-emerald-700 dark:text-emerald-400"
                          >
                            <span>{{ t('platform.commercialAdminInvoiceDiscount') }}</span>
                            <span class="tabular-nums">−{{ formatInrFromPaise(preview.invoiceDiscountMinor) }}</span>
                          </div>
                          <div
                            v-if="preview.creditAppliedMinor"
                            class="mt-1 flex justify-between gap-2 text-emerald-700 dark:text-emerald-400"
                          >
                            <span>{{ t('platform.commercialAdminInvoiceCredit') }}</span>
                            <span class="tabular-nums">−{{ formatInrFromPaise(preview.creditAppliedMinor) }}</span>
                          </div>
                          <div class="mt-1 flex justify-between gap-2">
                            <span>{{ t('platform.commercialAdminPreviewTax') }}</span>
                            <span class="tabular-nums">{{ formatInrFromPaise(preview.taxMinor) }}</span>
                          </div>
                          <div class="mt-2 flex justify-between gap-2 border-t border-gray-200 pt-2 font-semibold dark:border-gray-700">
                            <span>{{ t('platform.commercialAdminPreviewTotal') }}</span>
                            <span class="tabular-nums">{{ formatInrFromPaise(preview.totalMinor) }}</span>
                          </div>
                        </div>

                        <DynamicFormField
                          :field="reasonField"
                          :value="reason"
                          @update:value="(v) => { reason = String(v ?? ''); }"
                        />
                      </div>
                    </div>

                    <div class="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-white px-4 py-4 sm:px-6 dark:border-gray-700 dark:bg-gray-800">
                      <button
                        type="button"
                        class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                        @click="emitClose"
                      >
                        {{ t('actions.cancel') }}
                      </button>
                      <button
                        type="submit"
                        class="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                        :disabled="busy || reason.trim().length < 3"
                      >
                        {{ t('platform.commercialAdminReviseSave') }}
                      </button>
                    </div>
                  </form>
                </DialogPanel>
              </div>
            </TransitionChild>
          </div>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  RadioGroup,
  RadioGroupOption,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import DynamicFormField from '@/components/common/DynamicFormField.vue';
import { formatInrFromPaise } from '@/utils/commercialPricingApi';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  open: { type: Boolean, default: false },
  invoice: { type: Object, default: null },
  isSandbox: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'save']);

const { t } = useI18n();
const { error: notifyError } = useNotifications();

/** @type {import('vue').Ref<Record<string, { mode: 'amount' | 'percent', value: string | number | '' }>>} */
const lineDiscounts = ref({});
const invoiceDiscount = ref({ mode: 'amount', value: '' });
const reason = ref('');

const discountModeOptions = computed(() => [
  { value: 'amount', label: '₹' },
  { value: 'percent', label: '%' },
]);

const reasonField = computed(() => ({
  key: 'commercial-revise-reason',
  label: t('platform.commercialAdminCreditReason'),
  dataType: 'Text-Area',
  required: true,
  textSettings: { rows: 3 },
  placeholder: t('platform.commercialAdminCreditReason'),
}));

function rupeesToPaise(value) {
  const n = Number(String(value || '').replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function paiseToRupeesInput(paise) {
  const n = Math.max(0, Number(paise) || 0);
  if (n <= 0) return '';
  return Math.round((n / 100) * 100) / 100;
}

function parseDiscountNumber(value) {
  if (value === '' || value == null) return 0;
  const n = Number(String(value).replace(/,/g, '').replace(/%/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function discountInputToMinor(mode, value, baseMinor) {
  const base = Math.max(0, Math.round(Number(baseMinor) || 0));
  if (base <= 0) return 0;
  const n = parseDiscountNumber(value);
  if (n <= 0) return 0;
  if (mode === 'percent') {
    const pct = Math.min(100, n);
    return Math.min(base, Math.round((base * pct) / 100));
  }
  return Math.min(base, rupeesToPaise(String(n)));
}

function formatPercentInput(discountMinor, baseMinor) {
  const base = Math.max(0, Number(baseMinor) || 0);
  const disc = Math.max(0, Number(discountMinor) || 0);
  if (base <= 0 || disc <= 0) return '';
  return Math.round((disc / base) * 10000) / 100;
}

function clampValue(mode, value, baseMinor) {
  if (value === '' || value == null) return '';
  const n = parseDiscountNumber(value);
  if (n <= 0) return '';
  if (mode === 'percent') return Math.min(100, n);
  const maxRupees = Math.max(0, Number(baseMinor) || 0) / 100;
  if (maxRupees > 0 && n > maxRupees) {
    return Math.round(maxRupees * 100) / 100;
  }
  return n;
}

function lineDiscountField(line) {
  const mode = lineDiscounts.value[String(line._id)]?.mode || 'amount';
  const max = mode === 'percent' ? 100 : (line.grossMinor || 0) / 100;
  return {
    key: `line-discount-${line._id}`,
    label: t('platform.commercialAdminLineDiscount'),
    dataType: 'Decimal',
    numberSettings: {
      min: 0,
      max,
      decimalPlaces: 2,
    },
    placeholder: mode === 'percent'
      ? t('platform.commercialAdminDiscountPercentPlaceholder')
      : t('platform.commercialAdminDiscountAmountPlaceholder'),
  };
}

const invoiceDiscountField = computed(() => {
  const mode = invoiceDiscount.value.mode || 'amount';
  const max = mode === 'percent' ? 100 : preview.value.subtotalMinor / 100;
  return {
    key: 'invoice-discount',
    label: ' ',
    dataType: 'Decimal',
    numberSettings: {
      min: 0,
      max: Math.max(0, max),
      decimalPlaces: 2,
    },
    placeholder: mode === 'percent'
      ? t('platform.commercialAdminDiscountPercentPlaceholder')
      : t('platform.commercialAdminDiscountAmountPlaceholder'),
  };
});

const previewLines = computed(() => {
  const inv = props.invoice;
  if (!inv) return [];
  return (inv.lines || []).map((line) => {
    const qty = Number(line.quantity) || 0;
    const unit = Number(line.unitAmountMinor) || 0;
    const gross = qty * unit;
    const entry = lineDiscounts.value[String(line._id)] || { mode: 'amount', value: '' };
    const discount = discountInputToMinor(entry.mode, entry.value, gross);
    return {
      _id: line._id,
      description: line.description || line.productCode,
      quantity: qty,
      grossMinor: gross,
      discountMinor: discount,
      amountMinor: gross - discount,
    };
  });
});

const preview = computed(() => {
  const lines = previewLines.value;
  const subtotalMinor = lines.reduce((sum, l) => sum + l.amountMinor, 0);
  const invoiceDiscountMinor = discountInputToMinor(
    invoiceDiscount.value.mode,
    invoiceDiscount.value.value,
    subtotalMinor
  );
  const creditAppliedMinor = Math.min(
    Math.max(0, Number(props.invoice?.creditAppliedMinor) || 0),
    Math.max(0, subtotalMinor - invoiceDiscountMinor)
  );
  const taxableMinor = Math.max(0, subtotalMinor - invoiceDiscountMinor - creditAppliedMinor);
  const taxMinor = props.isSandbox ? 0 : Math.round((taxableMinor * 1800) / 10000);
  return {
    lines,
    subtotalMinor,
    invoiceDiscountMinor,
    creditAppliedMinor,
    taxMinor,
    totalMinor: taxableMinor + taxMinor,
  };
});

function resetFromInvoice(inv) {
  const next = {};
  for (const line of inv?.lines || []) {
    next[String(line._id)] = {
      mode: 'amount',
      value: paiseToRupeesInput(line.discountMinor || 0),
    };
  }
  lineDiscounts.value = next;
  invoiceDiscount.value = {
    mode: 'amount',
    value: paiseToRupeesInput(inv?.discountMinor || 0),
  };
  reason.value = '';
}

watch(
  () => [props.open, props.invoice?._id],
  ([isOpen]) => {
    if (isOpen && props.invoice) resetFromInvoice(props.invoice);
  }
);

function onLineDiscountValue(lineId, raw) {
  const sid = String(lineId);
  const entry = lineDiscounts.value[sid] || { mode: 'amount', value: '' };
  const line = (props.invoice?.lines || []).find((l) => String(l._id) === sid);
  const gross = (Number(line?.quantity) || 0) * (Number(line?.unitAmountMinor) || 0);
  lineDiscounts.value = {
    ...lineDiscounts.value,
    [sid]: {
      ...entry,
      value: clampValue(entry.mode, raw, gross),
    },
  };
}

function onInvoiceDiscountValue(raw) {
  invoiceDiscount.value = {
    ...invoiceDiscount.value,
    value: clampValue(invoiceDiscount.value.mode, raw, preview.value.subtotalMinor),
  };
}

function setLineDiscountMode(lineId, mode) {
  const sid = String(lineId);
  const current = lineDiscounts.value[sid] || { mode: 'amount', value: '' };
  if (current.mode === mode) return;
  const line = (props.invoice?.lines || []).find((l) => String(l._id) === sid);
  const gross = (Number(line?.quantity) || 0) * (Number(line?.unitAmountMinor) || 0);
  const discountMinor = discountInputToMinor(current.mode, current.value, gross);
  lineDiscounts.value = {
    ...lineDiscounts.value,
    [sid]: {
      mode,
      value: mode === 'percent'
        ? formatPercentInput(discountMinor, gross)
        : paiseToRupeesInput(discountMinor),
    },
  };
}

function setInvoiceDiscountMode(mode) {
  if (invoiceDiscount.value.mode === mode) return;
  const subtotalMinor = previewLines.value.reduce((sum, l) => sum + l.amountMinor, 0);
  const discountMinor = discountInputToMinor(
    invoiceDiscount.value.mode,
    invoiceDiscount.value.value,
    subtotalMinor
  );
  invoiceDiscount.value = {
    mode,
    value: mode === 'percent'
      ? formatPercentInput(discountMinor, subtotalMinor)
      : paiseToRupeesInput(discountMinor),
  };
}

function emitClose() {
  if (props.busy) return;
  emit('close');
}

function onSubmit() {
  if (props.busy) return;
  const trimmed = String(reason.value || '').trim();
  if (trimmed.length < 3) {
    notifyError(t('platform.commercialAdminReasonRequired'));
    return;
  }
  emit('save', {
    invoiceId: props.invoice?._id,
    reason: trimmed,
    invoiceDiscountMinor: preview.value.invoiceDiscountMinor,
    lines: preview.value.lines.map((line) => ({
      lineId: line._id,
      discountMinor: line.discountMinor,
    })),
  });
}
</script>
