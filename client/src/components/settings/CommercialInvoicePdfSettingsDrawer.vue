<script setup>
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import { DocumentTextIcon, XMarkIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  open: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  editLayoutBusy: { type: Boolean, default: false },
  draft: {
    type: Object,
    required: true,
  },
  updatedAtLabel: { type: String, default: '' },
});

const emit = defineEmits(['close', 'save', 'update:draft', 'edit-layout']);

const { t } = useI18n();

function emitClose() {
  if (props.saving) return;
  emit('close');
}

function patch(field, value) {
  emit('update:draft', { ...props.draft, [field]: value });
}

function onSubmit() {
  if (props.saving || props.loading) return;
  emit('save');
}
</script>

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
                            {{ t('platform.commercialAdminPdfSettingsTitle') }}
                          </DialogTitle>
                          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {{ t('platform.commercialAdminPdfSettingsHint') }}
                          </p>
                        </div>
                        <button
                          type="button"
                          class="relative flex-shrink-0 cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                          :disabled="saving"
                          @click="emitClose"
                        >
                          <span class="absolute -inset-2.5" />
                          <span class="sr-only">{{ t('common.closePanel') }}</span>
                          <XMarkIcon class="size-6" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div class="h-0 flex-1 overflow-y-auto">
                      <div v-if="loading" class="flex justify-center py-16">
                        <div class="h-6 w-6 animate-spin rounded-full border-b-2 border-indigo-600" />
                      </div>
                      <div v-else class="grid gap-3 px-4 py-6 sm:px-6">
                        <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
                          <p class="text-xs text-gray-500 dark:text-gray-400">
                            {{ t('platform.commercialAdminPdfSettingsEditLayoutHint') }}
                          </p>
                          <button
                            type="button"
                            class="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                            :disabled="editLayoutBusy || saving"
                            @click="emit('edit-layout')"
                          >
                            <DocumentTextIcon class="h-4 w-4" aria-hidden="true" />
                            {{ t('platform.commercialAdminPdfSettingsEditLayout') }}
                          </button>
                        </div>
                        <label class="block text-xs font-medium text-gray-500">
                          {{ t('platform.commercialAdminPdfSettingsLegalName') }}
                          <input
                            :value="draft.legalName"
                            type="text"
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                            @input="patch('legalName', $event.target.value)"
                          >
                        </label>
                        <label class="block text-xs font-medium text-gray-500">
                          {{ t('platform.commercialAdminPdfSettingsTagline') }}
                          <input
                            :value="draft.tagline"
                            type="text"
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                            @input="patch('tagline', $event.target.value)"
                          >
                        </label>
                        <label class="block text-xs font-medium text-gray-500">
                          {{ t('platform.commercialAdminPdfSettingsGstin') }}
                          <input
                            :value="draft.gstin"
                            type="text"
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                            @input="patch('gstin', $event.target.value)"
                          >
                        </label>
                        <label class="block text-xs font-medium text-gray-500">
                          {{ t('platform.commercialAdminPdfSettingsPan') }}
                          <input
                            :value="draft.pan"
                            type="text"
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                            @input="patch('pan', $event.target.value)"
                          >
                        </label>
                        <label class="block text-xs font-medium text-gray-500">
                          {{ t('platform.commercialAdminPdfSettingsAddress') }}
                          <input
                            :value="draft.address"
                            type="text"
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                            @input="patch('address', $event.target.value)"
                          >
                        </label>
                        <label class="block text-xs font-medium text-gray-500">
                          {{ t('platform.commercialAdminPdfSettingsEmail') }}
                          <input
                            :value="draft.email"
                            type="email"
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                            @input="patch('email', $event.target.value)"
                          >
                        </label>
                        <label class="block text-xs font-medium text-gray-500">
                          {{ t('platform.commercialAdminPdfSettingsPhone') }}
                          <input
                            :value="draft.phone"
                            type="text"
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                            @input="patch('phone', $event.target.value)"
                          >
                        </label>
                        <label class="block text-xs font-medium text-gray-500">
                          {{ t('platform.commercialAdminPdfSettingsWebsite') }}
                          <input
                            :value="draft.website"
                            type="text"
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                            @input="patch('website', $event.target.value)"
                          >
                        </label>
                        <label class="block text-xs font-medium text-gray-500">
                          {{ t('platform.commercialAdminPdfSettingsPaymentTerms') }}
                          <input
                            :value="draft.paymentTerms"
                            type="text"
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                            @input="patch('paymentTerms', $event.target.value)"
                          >
                        </label>
                        <label class="block text-xs font-medium text-gray-500">
                          {{ t('platform.commercialAdminPdfSettingsBankName') }}
                          <input
                            :value="draft.bankName"
                            type="text"
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                            @input="patch('bankName', $event.target.value)"
                          >
                        </label>
                        <label class="block text-xs font-medium text-gray-500">
                          {{ t('platform.commercialAdminPdfSettingsAccountName') }}
                          <input
                            :value="draft.accountName"
                            type="text"
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                            @input="patch('accountName', $event.target.value)"
                          >
                        </label>
                        <label class="block text-xs font-medium text-gray-500">
                          {{ t('platform.commercialAdminPdfSettingsAccountNumber') }}
                          <input
                            :value="draft.accountNumber"
                            type="text"
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                            @input="patch('accountNumber', $event.target.value)"
                          >
                        </label>
                        <label class="block text-xs font-medium text-gray-500">
                          {{ t('platform.commercialAdminPdfSettingsIfsc') }}
                          <input
                            :value="draft.ifsc"
                            type="text"
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                            @input="patch('ifsc', $event.target.value)"
                          >
                        </label>
                        <label class="block text-xs font-medium text-gray-500">
                          {{ t('platform.commercialAdminPdfSettingsUpi') }}
                          <input
                            :value="draft.upiId"
                            type="text"
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                            @input="patch('upiId', $event.target.value)"
                          >
                        </label>
                        <label class="block text-xs font-medium text-gray-500">
                          {{ t('platform.commercialAdminPdfSettingsPayment') }}
                          <textarea
                            :value="draft.paymentInstructions"
                            rows="2"
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                            @input="patch('paymentInstructions', $event.target.value)"
                          />
                        </label>
                        <label class="block text-xs font-medium text-gray-500">
                          {{ t('platform.commercialAdminPdfSettingsReason') }}
                          <input
                            :value="draft.reason"
                            type="text"
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                            @input="patch('reason', $event.target.value)"
                          >
                        </label>
                        <p
                          v-if="updatedAtLabel"
                          class="text-xs text-gray-500"
                        >
                          {{ updatedAtLabel }}
                        </p>
                      </div>
                    </div>

                    <div class="flex flex-shrink-0 justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-4 sm:px-6 dark:border-gray-700 dark:bg-gray-900/50">
                      <button
                        type="button"
                        class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
                        :disabled="saving"
                        @click="emitClose"
                      >
                        {{ t('actions.cancel') }}
                      </button>
                      <button
                        type="submit"
                        class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        :disabled="saving || loading"
                      >
                        <DocumentTextIcon class="h-4 w-4" aria-hidden="true" />
                        {{ t('platform.commercialAdminPdfSettingsSave') }}
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
