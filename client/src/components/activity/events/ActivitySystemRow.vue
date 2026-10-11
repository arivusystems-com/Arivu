<template>
  <div class="flex items-start gap-2.5 px-2 py-0.5 text-[13px] text-gray-500 dark:text-slate-400 max-[480px]:flex-wrap max-[480px]:gap-x-2.5 max-[480px]:gap-y-1.5">
    <span class="h-1 w-1 mt-[0.45rem] rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" aria-hidden="true"></span>
    <div class="flex-1 min-w-0 space-y-1.5">
      <template v-if="ui.isFieldChangeSystemEvent(event)">
        <div class="flex items-start justify-between gap-2 max-[480px]:flex-wrap max-[480px]:gap-y-1">
          <p class="text-[12px] leading-[1.4] text-gray-500 dark:text-slate-400">
            <template v-if="isMassEdit">
              <span class="font-semibold text-gray-900 dark:text-white">{{ t('records.activityMassEditPerformedBy', { name: ui.getSystemEventActorLabel(event) }) }}</span>
            </template>
            <template v-else>
              <span>{{ ui.getSystemEventActorLabel(event) }}</span>
              <span>{{ t('records.activitySystemChanged') }}</span>
              <span class="font-semibold text-gray-900 dark:text-white">{{ ui.getSystemEventFieldLabel(event) }}</span>
            </template>
          </p>
          <span
            v-if="event.createdAt"
            class="ml-auto whitespace-nowrap text-[12px] text-gray-400 dark:text-slate-500 cursor-help"
            :title="ui.formatFullTimestamp(event.createdAt)"
            @pointerup="ui.handleTimestampPointerUp($event, event.createdAt)"
          >
            {{ ui.formatRelativeActivityTime(event.createdAt) }}
          </span>
        </div>
        <!-- Tags field: show colored chips instead of raw JSON -->
        <p
          v-if="!hasDescriptionDiff && isTagsFieldChange"
          class="text-[12px] leading-[1.4] text-gray-700 dark:text-gray-300"
        >
          <span class="mr-1">{{ t('records.activitySystemChangedTo', { field: ui.getSystemEventFieldLabel(event) }) }}</span>
          <span v-if="parsedToTags.length > 0" class="inline-flex flex-wrap gap-1 align-middle">
            <span
              v-for="(tagName, i) in parsedToTags"
              :key="i"
              :class="['inline-block text-xs px-2 py-0.5 rounded', (ui.getTagChipClass && ui.getTagChipClass(tagName)) || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200']"
            >
              {{ tagName }}
            </span>
          </span>
          <span v-else class="text-gray-500 dark:text-gray-400">—</span>
        </p>
        <p
          v-else-if="!hasDescriptionDiff"
          class="text-[12px] leading-[1.4] text-gray-700 dark:text-gray-300"
        >
          {{ t('records.activitySystemChangedFromTo', {
            field: ui.getSystemEventFieldLabel(event),
            from: ui.getSystemEventFromValue(event),
            to: ui.getSystemEventToValue(event)
          }) }}
        </p>
      </template>
      <p v-else class="text-[12px] leading-[1.4] text-gray-500 dark:text-slate-400">
        {{ ui.getSystemEventMessage(event) }}
        <a v-if="event.showMore" href="#" @click.prevent="ui.handleShowMore(event)" class="ml-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">{{ t('records.activitySystemRowShowMore') }}</a>
      </p>
      <div
        v-if="compareLink || revisionNumber || riskLevel"
        class="flex flex-wrap items-center gap-2 text-[12px]"
      >
        <span v-if="revisionNumber" class="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          Rev {{ revisionNumber }}
        </span>
        <span v-if="riskLevel" :class="riskClass">
          {{ riskLabel }}
        </span>
        <a
          v-if="compareLink"
          :href="compareLink"
          class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {{ t('records.activitySystemReviewChanges') }}
        </a>
      </div>
      <div
        v-if="event.descriptionDiffHtml"
        class="rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 px-3 py-2 text-[12px] leading-[1.5] text-gray-700 dark:text-gray-300 [&_del]:bg-red-100 [&_del]:dark:bg-red-900/40 [&_del]:text-red-800 [&_del]:dark:text-red-200 [&_del]:line-through [&_ins]:bg-green-100 [&_ins]:dark:bg-green-900/40 [&_ins]:text-green-800 [&_ins]:dark:text-green-200 [&_ins]:no-underline"
        v-html="event.descriptionDiffHtml"
      />
      <div
        v-if="descriptionImageChanges.length"
        class="space-y-1.5"
      >
        <div
          v-for="(change, index) in descriptionImageChanges"
          :key="`${change.type}-${change.src}-${index}`"
          class="flex items-center gap-2.5 rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 px-2.5 py-2"
        >
          <button
            type="button"
            class="shrink-0 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 overflow-hidden cursor-zoom-in"
            @click="openImagePreview(change.src)"
          >
            <img
              :src="change.src"
              :alt="imageChangeLabel(change.type)"
              class="h-12 w-12 object-cover"
            >
          </button>
          <span
            :class="[
              'text-[12px] font-medium',
              change.type === 'added'
                ? 'text-green-700 dark:text-green-300'
                : 'text-red-700 dark:text-red-300'
            ]"
          >
            {{ imageChangeLabel(change.type) }}
          </span>
        </div>
      </div>
    </div>
    <span
      v-if="event.createdAt && !ui.isFieldChangeSystemEvent(event)"
      class="ml-auto pl-2 whitespace-nowrap text-[12px] text-gray-400 dark:text-slate-500 max-[480px]:ml-4 max-[480px]:pl-0 self-start cursor-help"
      :title="ui.formatFullTimestamp(event.createdAt)"
      @pointerup="ui.handleTimestampPointerUp($event, event.createdAt)"
    >
      {{ ui.formatRelativeActivityTime(event.createdAt) }}
    </span>
  </div>

  <RichDescriptionImageLightbox
    :open="showImagePreview"
    :src="previewImageSrc"
    @close="closeImagePreview"
  />
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { useRichDescriptionImagePreview } from '@/composables/useRichDescriptionImagePreview';
import RichDescriptionImageLightbox from '@/components/common/RichDescriptionImageLightbox.vue';

const props = defineProps({
  event: { type: Object, required: true },
  ui: { type: Object, required: true }
});

const { t } = useI18n();
const {
  showImagePreview,
  previewImageSrc,
  closeImagePreview,
  openImagePreview
} = useRichDescriptionImagePreview();

const details = computed(() => props.event?.payload?.details || props.event?.details || {});
const isMassEdit = computed(() => {
  const source = String(details.value?.source || '').toLowerCase();
  return source === 'mass_edit' || source === 'mass-edit' || source === 'bulk_update';
});
const isTagsFieldChange = computed(() => String(details.value?.field || '').toLowerCase() === 'tags');
const descriptionImageChanges = computed(() => {
  const changes = props.event?.descriptionImageChanges;
  return Array.isArray(changes) ? changes.filter((item) => item?.src && (item.type === 'added' || item.type === 'removed')) : [];
});
const hasDescriptionDiff = computed(() =>
  Boolean(props.event?.descriptionDiffHtml) || descriptionImageChanges.value.length > 0
);
const compareLink = computed(() => details.value?.compareLink || '');
const revisionNumber = computed(() => details.value?.revisionNumber || details.value?.toRevision || null);
const riskLevel = computed(() => details.value?.riskLevel || '');
const riskLabel = computed(() => {
  const value = String(riskLevel.value || '').toLowerCase();
  if (value === 'high') return 'High risk';
  if (value === 'medium') return 'Medium risk';
  if (value === 'low') return 'Low risk';
  return '';
});
const riskClass = computed(() => {
  const value = String(riskLevel.value || '').toLowerCase();
  const base = 'rounded px-1.5 py-0.5';
  if (value === 'high') return `${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200`;
  if (value === 'medium') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200`;
  return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200`;
});

function imageChangeLabel(type) {
  return type === 'removed'
    ? t('records.activityDescriptionImageRemoved')
    : t('records.activityDescriptionImageAdded');
}

function parseTagsFromValue(value) {
  if (value == null || value === '' || value === 'Empty') return [];
  // Already an array (e.g. from event.details.to stored as array)
  if (Array.isArray(value)) {
    return value.map((t) => (t && typeof t === 'object' ? (t.name || t.label || t) : String(t))).filter(Boolean);
  }
  const s = typeof value === 'string' ? value.trim() : String(value);
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed.map((t) => (t && typeof t === 'object' ? (t.name || t.label || t) : String(t))).filter(Boolean) : [];
  } catch {
    // Task (and some) APIs store tags as comma-separated string
    return s.split(',').map((t) => t.trim()).filter(Boolean);
  }
}

const parsedToTags = computed(() => {
  const details = props.event?.payload?.details || props.event?.details || {};
  const rawTo = details.to ?? details.newValue;
  if (Array.isArray(rawTo)) return parseTagsFromValue(rawTo);
  if (props.ui.getSystemEventToValue) {
    const toStr = props.ui.getSystemEventToValue(props.event);
    return parseTagsFromValue(toStr);
  }
  return parseTagsFromValue(rawTo);
});
</script>
