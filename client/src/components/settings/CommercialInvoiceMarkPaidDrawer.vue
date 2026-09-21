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
                  class="flex h-full w-[min(92vw,28rem)] max-w-[95vw] flex-col overflow-hidden rounded-tl-xl bg-white shadow-xl dark:bg-gray-800"
                >
                  <form
                    class="relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700"
                    @submit.prevent="onSubmit"
                  >
                    <div class="flex-shrink-0 border-b border-gray-100 bg-white px-4 py-5 sm:px-6 dark:border-gray-800 dark:bg-gray-900">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <DialogTitle class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                            {{ t('platform.commercialAdminMarkPaidTitle') }}
                          </DialogTitle>
                          <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                            {{ invoice?.invoiceNumber }}
                            · {{ formatInrFromPaise(invoice?.totalMinor || 0) }}
                          </p>
                          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {{ t('platform.commercialAdminMarkPaidHint') }}
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
                      <div class="space-y-5 px-4 py-6 sm:px-6">
                        <DynamicFormField
                          :field="referenceField"
                          :value="providerReference"
                          @update:value="(v) => { providerReference = String(v ?? ''); }"
                        />

                        <DynamicFormField
                          :field="notesField"
                          :value="notes"
                          @update:value="(v) => { notes = String(v ?? ''); }"
                        />

                        <div>
                          <p class="text-sm font-medium text-gray-900 dark:text-white">
                            {{ t('platform.commercialAdminMarkPaidReceipt') }}
                          </p>
                          <p class="mt-0.5 text-xs text-gray-500">
                            {{ t('platform.commercialAdminMarkPaidReceiptHint') }}
                          </p>
                          <input
                            ref="fileInputRef"
                            type="file"
                            class="sr-only"
                            accept="image/*,.pdf,application/pdf"
                            @change="onFileChange"
                          >
                          <div
                            v-if="receiptFile"
                            class="mt-3 flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/50"
                          >
                            <span class="min-w-0 truncate text-sm text-gray-800 dark:text-gray-100">
                              {{ receiptFile.name }}
                            </span>
                            <button
                              type="button"
                              class="shrink-0 text-xs font-semibold text-red-600 hover:underline"
                              @click="clearFile"
                            >
                              {{ t('actions.remove') }}
                            </button>
                          </div>
                          <button
                            v-else
                            type="button"
                            class="mt-3 inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
                            @click="fileInputRef?.click()"
                          >
                            {{ t('platform.commercialAdminMarkPaidChooseFile') }}
                          </button>
                          <p
                            v-if="fileError"
                            class="mt-2 text-xs text-red-600 dark:text-red-400"
                          >
                            {{ fileError }}
                          </p>
                        </div>
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
                        :disabled="busy || !canSubmit"
                      >
                        {{ busy ? t('states.saving') : t('platform.commercialAdminMarkPaidConfirm') }}
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
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import DynamicFormField from '@/components/common/DynamicFormField.vue';
import { formatInrFromPaise } from '@/utils/commercialPricingApi';

const props = defineProps({
  open: { type: Boolean, default: false },
  invoice: { type: Object, default: null },
  busy: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'save']);

const { t } = useI18n();

const providerReference = ref('');
const notes = ref('');
const receiptFile = ref(null);
const fileError = ref('');
const fileInputRef = ref(null);

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

const referenceField = computed(() => ({
  key: 'mark-paid-reference',
  label: t('platform.commercialAdminMarkPaidReference'),
  dataType: 'Text',
  required: true,
  placeholder: t('platform.commercialAdminMarkPaidReferencePh'),
}));

const notesField = computed(() => ({
  key: 'mark-paid-notes',
  label: t('platform.commercialAdminMarkPaidNotes'),
  dataType: 'Text-Area',
  required: false,
  textSettings: { rows: 3 },
  placeholder: t('platform.commercialAdminMarkPaidNotesPh'),
}));

const canSubmit = computed(() => String(providerReference.value || '').trim().length >= 3);

watch(
  () => [props.open, props.invoice?._id],
  ([isOpen]) => {
    if (!isOpen) return;
    providerReference.value = '';
    notes.value = '';
    receiptFile.value = null;
    fileError.value = '';
    if (fileInputRef.value) fileInputRef.value.value = '';
  }
);

function onFileChange(event) {
  fileError.value = '';
  const file = event?.target?.files?.[0] || null;
  if (!file) {
    receiptFile.value = null;
    return;
  }
  const okType = file.type.startsWith('image/') || file.type === 'application/pdf';
  if (!okType) {
    fileError.value = t('platform.commercialAdminMarkPaidFileType');
    receiptFile.value = null;
    if (fileInputRef.value) fileInputRef.value.value = '';
    return;
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    fileError.value = t('platform.commercialAdminMarkPaidFileTooLarge');
    receiptFile.value = null;
    if (fileInputRef.value) fileInputRef.value.value = '';
    return;
  }
  receiptFile.value = file;
}

function clearFile() {
  receiptFile.value = null;
  fileError.value = '';
  if (fileInputRef.value) fileInputRef.value.value = '';
}

function emitClose() {
  if (props.busy) return;
  emit('close');
}

function onSubmit() {
  if (props.busy || !canSubmit.value) return;
  emit('save', {
    invoiceId: props.invoice?._id,
    providerReference: String(providerReference.value || '').trim(),
    notes: String(notes.value || '').trim(),
    receiptFile: receiptFile.value,
  });
}
</script>
