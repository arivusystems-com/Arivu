<template>
  <TransitionRoot as="template" :show="open">
    <Dialog class="relative z-50" @close="emit('close')">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-neutral-900/40 backdrop-blur-[1px]" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="ease-in duration-150"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel
              class="w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-neutral-900"
            >
              <div class="border-b border-neutral-100 px-6 py-4 dark:border-neutral-800">
                <DialogTitle class="text-lg font-semibold text-neutral-900 dark:text-white">
                  {{ t('analytics.shareReportTitle') }}
                </DialogTitle>
                <p
                  v-if="reportName"
                  class="mt-1 truncate text-sm text-neutral-500 dark:text-neutral-400"
                >
                  {{ reportName }}
                </p>
              </div>

              <div class="px-6 py-5">
                <ReportSharePanel
                  :visibility="draftVisibility"
                  :shared-with="draftSharedWith"
                  :show-validation="showValidation"
                  @update:visibility="onVisibilityUpdate"
                  @update:shared-with="onSharedWithUpdate"
                />
                <p
                  v-if="validationMessage"
                  class="mt-3 text-sm text-red-600 dark:text-red-400"
                  role="alert"
                >
                  {{ validationMessage }}
                </p>
              </div>

              <div
                class="flex justify-end gap-2 border-t border-neutral-100 px-6 py-4 dark:border-neutral-800"
              >
                <button
                  type="button"
                  class="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  :disabled="saving"
                  @click="emit('close')"
                >
                  {{ t('actions.cancel') }}
                </button>
                <button
                  type="button"
                  class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="saving"
                  @click="onSave"
                >
                  {{ saving ? t('states.saving') : t('actions.save') }}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import ReportSharePanel from '@/components/analytics/report-builder/ReportSharePanel.vue';
import {
  getMissingShareTargetType,
  shareValidationMessageKey,
} from '@/components/analytics/report-builder/reportShareValidation';
import { useNotifications } from '@/composables/useNotifications';
import type { AnalyticsShareTarget, AnalyticsVisibility } from '@/types/analytics.types';

const props = defineProps<{
  open: boolean;
  reportName?: string;
  visibility: AnalyticsVisibility;
  sharedWith: AnalyticsShareTarget[];
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (
    e: 'save',
    payload: { visibility: AnalyticsVisibility; sharedWith: AnalyticsShareTarget[] },
  ): void;
}>();

const { t } = useI18n();
const { error: notifyError } = useNotifications();

const draftVisibility = ref<AnalyticsVisibility>(props.visibility);
const draftSharedWith = ref<AnalyticsShareTarget[]>([...props.sharedWith]);
const showValidation = ref(false);

const validationMessage = computed(() => {
  if (!showValidation.value) return '';
  const key = shareValidationMessageKey(
    getMissingShareTargetType(draftVisibility.value, draftSharedWith.value),
  );
  return key ? t(key) : '';
});

watch(
  () => [props.open, props.visibility, props.sharedWith] as const,
  ([open]) => {
    if (!open) return;
    draftVisibility.value = props.visibility;
    draftSharedWith.value = Array.isArray(props.sharedWith) ? [...props.sharedWith] : [];
    showValidation.value = false;
  },
);

function onVisibilityUpdate(value: AnalyticsVisibility) {
  draftVisibility.value = value;
  showValidation.value = false;
}

function onSharedWithUpdate(value: AnalyticsShareTarget[]) {
  draftSharedWith.value = value;
  showValidation.value = false;
}

function onSave() {
  const missing = getMissingShareTargetType(draftVisibility.value, draftSharedWith.value);
  const key = shareValidationMessageKey(missing);
  if (key) {
    showValidation.value = true;
    notifyError(t(key));
    return;
  }
  emit('save', {
    visibility: draftVisibility.value,
    sharedWith: draftSharedWith.value,
  });
}
</script>
