<template>
  <div>
    <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldText') }}</label>
    <div class="mb-1.5 flex items-center gap-0.5">
      <button
        type="button"
        :class="[ui.btnIcon, isBold ? 'bg-neutral-200 dark:bg-neutral-700' : '']"
        :title="t('templates.builderFormatBold')"
        @mousedown.prevent
        @click="applyFormat('bold')"
      >
        <span class="text-xs font-bold">B</span>
      </button>
      <button
        type="button"
        :class="[ui.btnIcon, isItalic ? 'bg-neutral-200 dark:bg-neutral-700' : '']"
        :title="t('templates.builderFormatItalic')"
        @mousedown.prevent
        @click="applyFormat('italic')"
      >
        <span class="text-xs italic">I</span>
      </button>
      <button
        type="button"
        :class="[ui.btnIcon, isUnderline ? 'bg-neutral-200 dark:bg-neutral-700' : '']"
        :title="t('templates.builderFormatUnderline')"
        @mousedown.prevent
        @click="applyFormat('underline')"
      >
        <span class="text-xs underline">U</span>
      </button>
    </div>
    <div
      ref="editorRef"
      contenteditable="true"
      spellcheck="true"
      :class="[
        ui.input,
        'min-h-[7.5rem] whitespace-pre-wrap break-words outline-none',
        'focus:ring-2 focus:ring-primary-500/40'
      ]"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeyDown"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { execEditorCommand } from '@/utils/builderRichText';
import {
  applyMergeChipsInPlace,
  serializeElementHtmlWithMergeTokens
} from '@/utils/builderMergeTagHtml';

const props = defineProps({
  field: { type: Object, required: true },
  watchKey: { type: String, required: true }
});

const emit = defineEmits(['update:draft']);

const { t } = useI18n();
const ui = useBuilderUi();
const editorRef = ref(null);
const isFocused = ref(false);
const isBold = ref(false);
const isItalic = ref(false);
const isUnderline = ref(false);
let syncFromProps = false;

function readEditorHtml() {
  const el = editorRef.value;
  if (!el) return '';
  return serializeElementHtmlWithMergeTokens(el);
}

function syncEditorFromDraft(html) {
  const el = editorRef.value;
  if (!el) return;

  const next = String(html ?? '');
  syncFromProps = true;
  el.innerHTML = next;
  if (next.includes('{{')) {
    applyMergeChipsInPlace(el);
  }
  syncFromProps = false;
}

function refreshFormatState() {
  isBold.value = document.queryCommandState('bold');
  isItalic.value = document.queryCommandState('italic');
  isUnderline.value = document.queryCommandState('underline');
}

function applyFormat(command) {
  const el = editorRef.value;
  if (!el) return;
  execEditorCommand(el, command);
  refreshFormatState();
}

function onFocus() {
  isFocused.value = true;
  props.field.onFocus();
  syncEditorFromDraft(props.field.draft);
  refreshFormatState();
}

function onBlur() {
  if (syncFromProps) return;
  isFocused.value = false;
  emit('update:draft', readEditorHtml());
  props.field.onBlur();
}

function onKeyDown(event) {
  const meta = event.metaKey || event.ctrlKey;
  if (meta && event.key.toLowerCase() === 'b') {
    event.preventDefault();
    applyFormat('bold');
    return;
  }
  if (meta && event.key.toLowerCase() === 'i') {
    event.preventDefault();
    applyFormat('italic');
    return;
  }
  if (meta && event.key.toLowerCase() === 'u') {
    event.preventDefault();
    applyFormat('underline');
    return;
  }
  if (event.key === 'Enter' && !meta) {
    event.preventDefault();
    execEditorCommand(editorRef.value, 'insertLineBreak');
    refreshFormatState();
  }
}

watch(
  () => props.watchKey,
  () => {
    if (isFocused.value) return;
    syncEditorFromDraft(props.field.draft);
  },
  { immediate: true }
);
</script>

<style scoped>
[contenteditable]:empty::before {
  content: attr(data-placeholder);
  color: rgb(163 163 163);
}

:deep(.builder-merge-chip) {
  display: inline-flex;
  align-items: center;
  border-radius: 0.375rem;
  background: rgb(var(--color-primary-100, 219 234 254) / 1);
  padding: 0 0.375rem;
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
  color: rgb(var(--color-primary-700, 29 78 216) / 1);
}
</style>
