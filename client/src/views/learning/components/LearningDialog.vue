<template>
  <TransitionRoot appear :show="open" as="template">
    <Dialog class="relative z-50" @close="emitClose">
      <TransitionChild
        as="template"
        enter="duration-200 ease-out"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-150 ease-in"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/40" />
      </TransitionChild>
      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="duration-200 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-150 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel
              class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"
            >
              <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ title }}
              </DialogTitle>
              <div class="mt-4 space-y-3">
                <slot />
              </div>
              <div class="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  @click="emitClose"
                >
                  {{ cancelLabel }}
                </button>
                <button
                  type="button"
                  class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  :disabled="disabled"
                  @click="$emit('confirm')"
                >
                  {{ confirmLabel }}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';

defineProps({
  open: { type: Boolean, required: true },
  title: { type: String, required: true },
  confirmLabel: { type: String, required: true },
  cancelLabel: { type: String, required: true },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'confirm']);
function emitClose() {
  emit('close');
}
</script>
