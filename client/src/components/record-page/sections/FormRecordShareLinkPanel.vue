<template>
  <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <LinkIcon class="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ t('forms.recordShareLinkTitle') }}
          </h3>
        </div>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {{ t('forms.recordShareLinkHint') }}
        </p>
      </div>
      <button
        v-if="canManage && !hasPublicLink"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        :disabled="enabling"
        @click="enablePublicLink"
      >
        <GlobeAltIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
        {{ enabling ? t('forms.recordShareLinkEnabling') : t('forms.recordShareLinkEnable') }}
      </button>
    </div>

    <div v-if="hasPublicLink" class="mt-3 space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <input
          :value="publicUrl"
          type="text"
          readonly
          class="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
        <button
          type="button"
          class="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          @click="copyUrl"
        >
          {{ t('actions.copy') }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
          @click="openPublicUrl"
        >
          <ArrowTopRightOnSquareIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {{ t('forms.recordShareLinkOpen') }}
        </button>
      </div>
    </div>

    <div
      v-else
      class="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-600 dark:bg-gray-900/40"
    >
      <p class="text-sm font-medium text-gray-700 dark:text-gray-200">
        {{ t('forms.recordShareLinkNotEnabled') }}
      </p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {{ t('forms.recordShareLinkNotEnabledHint') }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowTopRightOnSquareIcon,
  GlobeAltIcon,
  LinkIcon
} from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  record: { type: Object, default: null },
  canManage: { type: Boolean, default: false }
});

const emit = defineEmits(['updated']);

const { t } = useI18n();
const { success, error: notifyError } = useNotifications();

const enabling = ref(false);

const hasPublicLink = computed(() => {
  const link = props.record?.publicLink;
  return Boolean(link?.enabled && link?.slug);
});

const publicUrl = computed(() => {
  if (!hasPublicLink.value) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/forms/public/${props.record.publicLink.slug}`;
});

async function copyUrl() {
  if (!publicUrl.value) return;
  try {
    await navigator.clipboard.writeText(publicUrl.value);
    success(t('forms.settingsPublicLinkCopied'));
  } catch {
    // Clipboard unavailable — ignore
  }
}

function openPublicUrl() {
  if (!publicUrl.value) return;
  window.open(publicUrl.value, '_blank', 'noopener,noreferrer');
}

async function enablePublicLink() {
  const formId = props.record?._id;
  if (!formId || enabling.value) return;
  enabling.value = true;
  try {
    const response = await apiClient.post(`/forms/${formId}/enable-public`);
    if (response?.success) {
      emit('updated', response.data);
      success(t('forms.recordShareLinkEnabled'));
    } else {
      notifyError(response?.message || t('forms.builderShellEnablePublicFailed'));
    }
  } catch (err) {
    notifyError(err?.response?.data?.message || t('forms.builderShellEnablePublicFailed'));
  } finally {
    enabling.value = false;
  }
}
</script>
