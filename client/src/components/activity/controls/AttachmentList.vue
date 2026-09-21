<template>
  <div v-if="attachments && attachments.length > 0" class="mt-3 grid gap-2.5">
    <component
      v-for="(attachment, idx) in attachments"
      :key="idx"
      :is="ui.hasAttachmentUrl(attachment) ? 'a' : 'div'"
      :href="ui.hasAttachmentUrl(attachment) ? resolveAttachmentUrl(attachment) : undefined"
      :target="ui.hasAttachmentUrl(attachment) ? '_blank' : undefined"
      :rel="ui.hasAttachmentUrl(attachment) ? 'noopener noreferrer' : undefined"
      :class="[
        'group/attachment block overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 transition',
        ui.isImageAttachment(attachment) ? '' : 'p-2.5',
        ui.hasAttachmentUrl(attachment)
          ? (
              ui.isImageAttachment(attachment)
                ? 'cursor-pointer'
                : 'hover:-translate-y-px hover:border-indigo-300 hover:shadow-sm dark:hover:border-indigo-500'
            )
          : 'cursor-default'
      ]"
    >
      <div v-if="ui.isImageAttachment(attachment) && ui.hasAttachmentUrl(attachment)" class="relative max-h-[240px] overflow-hidden bg-slate-50 dark:bg-gray-800">
        <button
          type="button"
          class="pointer-events-none absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300/90 bg-white/90 text-gray-600 opacity-0 shadow-sm transition-opacity duration-150 hover:bg-white group-hover/attachment:pointer-events-auto group-hover/attachment:opacity-100 dark:border-gray-600 dark:bg-gray-800/90 dark:text-gray-200 dark:hover:bg-gray-800"
          :aria-label="`Download ${ui.getAttachmentName(attachment)}`"
          @click.prevent.stop="downloadResolved(attachment)"
        >
          <ArrowDownTrayIcon class="h-5 w-5" />
        </button>
        <object
          v-if="ui.isSvgAttachment(attachment)"
          :data="resolveAttachmentUrl(attachment)"
          type="image/svg+xml"
          class="block max-h-[240px] w-full object-contain"
        />
        <img
          v-else
          :src="resolveAttachmentUrl(attachment)"
          :alt="ui.getAttachmentName(attachment)"
          class="block max-h-[240px] w-full object-contain"
          loading="lazy"
        />
        <div class="flex items-center justify-between gap-2 border-t border-gray-100 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
          <span class="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{{ ui.getAttachmentName(attachment) }}</span>
          <span v-if="attachment.size" class="text-xs text-gray-500 dark:text-gray-400">{{ ui.formatFileSize(attachment.size) }}</span>
        </div>
      </div>
      <div v-else class="flex items-center gap-2.5">
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
          <PaperClipIcon class="w-4 h-4" />
        </div>
        <div class="min-w-0 flex flex-col gap-0.5">
          <span class="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{{ ui.getAttachmentName(attachment) }}</span>
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ ui.getAttachmentLabel(attachment) }}</span>
        </div>
      </div>
    </component>
  </div>
</template>

<script setup>
import { ArrowDownTrayIcon, PaperClipIcon } from '@heroicons/vue/24/outline';
import { resolveAssetDownloadUrl } from '@/modules/template/composables/useCompanyLogoAsset';

const props = defineProps({
  attachments: { type: Array, default: () => [] },
  ui: { type: Object, required: true }
});

function resolveAttachmentUrl(attachment) {
  const raw = props.ui.getAttachmentUrl(attachment);
  if (!raw || raw === '#') return '';
  return resolveAssetDownloadUrl(raw) || raw;
}

function downloadResolved(attachment) {
  const url = resolveAttachmentUrl(attachment);
  if (!url) return;
  const link = document.createElement('a');
  link.href = url;
  link.download = props.ui.getAttachmentName(attachment) || 'attachment';
  link.rel = 'noopener noreferrer';
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
</script>
