<template>
  <div
    class="internal-chat-composer-editor relative"
    @mousedown="onSurfaceMouseDown"
  >
    <!-- Selection toolbar — same affordances as TaskDescriptionEditor -->
    <BubbleMenu
      v-if="editor"
      :editor="editor"
      :plugin-key="bubblePluginKey"
      :should-show="shouldShowTextBubbleMenu"
      :tippy-options="bubbleTippyOptions"
      class="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white px-1 py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
    >
      <div
        class="flex items-center gap-0.5"
        @mousedown.prevent
      >
        <button
          type="button"
          :class="bubbleBtnClass(editor.isActive('heading', { level: 1 }))"
          :title="t('records.taskDescriptionEditorHeading1')"
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        >
          <span class="text-base font-bold">H1</span>
        </button>
        <button
          type="button"
          :class="bubbleBtnClass(editor.isActive('heading', { level: 2 }))"
          :title="t('records.taskDescriptionEditorHeading2')"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          <span class="text-sm font-semibold">H2</span>
        </button>
        <button
          type="button"
          :class="bubbleBtnClass(editor.isActive('heading', { level: 3 }))"
          :title="t('records.taskDescriptionEditorHeading3')"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        >
          <span class="text-sm font-medium">H3</span>
        </button>
        <span class="mx-0.5 h-5 w-px bg-gray-200 dark:bg-gray-600" />
        <button
          type="button"
          :class="bubbleBtnClass(editor.isActive('bold'))"
          :title="t('records.taskDescriptionEditorBold')"
          @click="editor.chain().focus().toggleBold().run()"
        >
          <span class="text-sm font-bold">B</span>
        </button>
        <button
          type="button"
          :class="bubbleBtnClass(editor.isActive('italic'))"
          :title="t('records.taskDescriptionEditorItalic')"
          @click="editor.chain().focus().toggleItalic().run()"
        >
          <span class="text-sm italic">I</span>
        </button>
        <button
          type="button"
          :class="bubbleBtnClass(editor.isActive('strike'))"
          :title="t('records.taskDescriptionEditorStrikethrough')"
          @click="editor.chain().focus().toggleStrike().run()"
        >
          <span class="text-sm line-through">S</span>
        </button>
        <span class="mx-0.5 h-5 w-px bg-gray-200 dark:bg-gray-600" />
        <button
          type="button"
          :class="bubbleBtnClass(editor.isActive('bulletList'))"
          :title="t('records.taskDescriptionEditorBulletList')"
          @click="editor.chain().focus().toggleBulletList().run()"
        >
          <svg
            class="h-4 w-4"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M4 6a1 1 0 100-2 1 1 0 000 2zm0 4a1 1 0 100-2 1 1 0 000 2zm0 4a1 1 0 100-2 1 1 0 000 2zM8 5h10a1 1 0 010 2H8a1 1 0 010-2zm0 4h10a1 1 0 110 2H8a1 1 0 110-2zm0 4h10a1 1 0 110 2H8a1 1 0 110-2z" />
          </svg>
        </button>
        <button
          type="button"
          :class="bubbleBtnClass(editor.isActive('orderedList'))"
          :title="t('records.taskDescriptionEditorNumberedList')"
          @click="editor.chain().focus().toggleOrderedList().run()"
        >
          <svg
            class="h-4 w-4"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M2 4h14v1.5H2V4zm0 5h14v1.5H2V9zm0 5h14v1.5H2V14zM17 4v1.5h1V4h-1zm0 5v1.5h1V9h-1zm0 5v1.5h1V14h-1z" />
          </svg>
        </button>
        <span class="mx-0.5 h-5 w-px bg-gray-200 dark:bg-gray-600" />
        <Popover
          v-slot="{ close }"
          class="relative"
        >
          <PopoverButton
            type="button"
            :class="bubbleBtnClass(editor.isActive('link'))"
            :title="t('settings.modFieldsPbResourceLink')"
            @click="syncLinkUrlFromSelection"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </PopoverButton>
          <PopoverPanel
            class="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg focus:outline-none dark:border-gray-600 dark:bg-gray-800"
          >
            <div class="space-y-2">
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">URL</label>
              <input
                ref="linkInputRef"
                v-model="linkUrl"
                type="url"
                placeholder="https://"
                class="block w-full rounded-md bg-gray-100 px-3 py-2 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:bg-gray-700 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:bg-gray-800 dark:focus:outline-indigo-500"
                @keydown.enter.prevent="applyLink(close)"
                @keydown.escape="close"
              >
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                  @click="close"
                >
                  {{ t('performance.cancelWizard') }}
                </button>
                <button
                  type="button"
                  :disabled="!canApplyLink"
                  class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  @click="applyLink(close)"
                >
                  {{ t('actions.apply') }}
                </button>
              </div>
            </div>
          </PopoverPanel>
        </Popover>
        <button
          v-if="editor.isActive('link')"
          type="button"
          class="rounded p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          :title="t('records.taskDescriptionEditorRemoveLink')"
          @click="editor.chain().focus().unsetLink().run()"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </BubbleMenu>

    <EditorContent
      :editor="editor"
      class="ic-composer-tiptap"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Extension } from '@tiptap/core';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/vue-3';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { InternalChatSlashCommands } from '@/components/record-page/slashCommands.js';
import { isInternalChatBodyEmpty } from '@/utils/internalChatHtml';

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  /** Display names used to highlight `@Name` / `@all` in the composer. */
  mentionLabels: { type: Array, default: () => [] },
  /** Unique when multiple composers are mounted (channel + thread). */
  bubblePluginKey: { type: String, default: 'internalChatComposerBubble' },
});

const emit = defineEmits(['update:modelValue', 'update:text', 'submit', 'input']);

const { t } = useI18n();
const linkUrl = ref('https://');
const linkInputRef = ref(null);

const mentionHighlightKey = new PluginKey('icComposerMentionHighlight');

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMentionDecorations(doc, labels) {
  const sorted = [...new Set(
    (labels || [])
      .map((l) => String(l || '').trim())
      .filter(Boolean)
  )].sort((a, b) => b.length - a.length);

  const patterns = [
    ...sorted.map((label) => `@${escapeRegExp(label)}(?![\\w])`),
    '@all\\b',
  ];
  if (!patterns.length) return DecorationSet.empty;

  const re = new RegExp(`(?:${patterns.join('|')})`, 'gi');
  const decos = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    re.lastIndex = 0;
    let match = re.exec(text);
    while (match) {
      const from = pos + match.index;
      const to = from + match[0].length;
      decos.push(Decoration.inline(from, to, { class: 'ic-mention' }));
      match = re.exec(text);
    }
  });
  return DecorationSet.create(doc, decos);
}

const MentionHighlight = Extension.create({
  name: 'icComposerMentionHighlight',
  addOptions() {
    return { getLabels: () => [] };
  },
  addProseMirrorPlugins() {
    const extension = this;
    return [
      new Plugin({
        key: mentionHighlightKey,
        state: {
          init: (_, state) => buildMentionDecorations(state.doc, extension.options.getLabels()),
          apply(tr, oldState, _old, newState) {
            if (!tr.docChanged && !tr.getMeta(mentionHighlightKey)) return oldState;
            return buildMentionDecorations(newState.doc, extension.options.getLabels());
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

/** Escape composer `overflow-hidden` so the menu isn't clipped. */
const bubbleTippyOptions = {
  duration: 100,
  placement: 'top',
  zIndex: 12000,
  appendTo: () => document.body,
};

const canApplyLink = computed(() => {
  const trimmed = (linkUrl.value || '').trim();
  return /^https?:\/\//i.test(trimmed);
});

function bubbleBtnClass(active) {
  return [
    'rounded p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
    active ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '',
  ];
}

/** Match TaskDescriptionEditor — selection empty check only. */
function shouldShowTextBubbleMenu({ editor: ed }) {
  if (!ed?.isEditable) return false;
  return !ed.state.selection.empty;
}

function syncLinkUrlFromSelection() {
  linkUrl.value = editor.value?.getAttributes('link')?.href || 'https://';
  nextTick(() => {
    linkInputRef.value?.focus();
    linkInputRef.value?.select();
  });
}

function applyLink(close) {
  if (!canApplyLink.value) return;
  const url = linkUrl.value.trim();
  editor.value?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  close?.();
}

function isSlashMenuBlockingEnter() {
  if (typeof document === 'undefined') return false;
  const list = document.querySelector('.slash-command-list');
  if (!list) return false;
  return list.querySelectorAll('.slash-command-item').length > 0;
}

const editor = useEditor({
  content: props.modelValue || '',
  editable: !props.disabled,
  extensions: [
    StarterKit.configure({
      heading: false,
      horizontalRule: false,
      codeBlock: false,
    }),
    Heading.configure({ levels: [1, 2, 3] }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-indigo-600 underline hover:no-underline dark:text-indigo-400',
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    }),
    Placeholder.configure({
      placeholder: props.placeholder || '',
    }),
    InternalChatSlashCommands,
    MentionHighlight.configure({
      getLabels: () => props.mentionLabels || [],
    }),
  ],
  editorProps: {
    attributes: {
      class: 'ic-composer-prose px-3 py-2.5 text-sm leading-5 text-neutral-900 focus:outline-none dark:text-white',
      'aria-label': props.placeholder || 'Message',
    },
    handleKeyDown: (_view, event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey) {
        if (event.isComposing || isSlashMenuBlockingEnter()) return false;
        event.preventDefault();
        emit('submit');
        return true;
      }
      return false;
    },
  },
  onUpdate: ({ editor: ed }) => {
    emit('update:modelValue', ed.getHTML());
    emit('update:text', ed.getText());
    emit('input');
  },
});

watch(
  () => props.modelValue,
  (next) => {
    const ed = editor.value;
    if (!ed) return;
    const normalized = String(next || '');
    if (normalized === ed.getHTML()) return;
    if (isInternalChatBodyEmpty(normalized) && ed.isEmpty) return;
    ed.commands.setContent(normalized || '', false);
    emit('update:text', ed.getText());
  }
);

watch(
  () => props.disabled,
  (disabled) => {
    editor.value?.setEditable(!disabled);
  }
);

watch(
  () => props.mentionLabels,
  () => {
    const ed = editor.value;
    if (!ed) return;
    ed.view.dispatch(ed.state.tr.setMeta(mentionHighlightKey, true));
  },
  { deep: true }
);

function onSurfaceMouseDown(event) {
  const ed = editor.value;
  if (!ed || props.disabled) return;
  const target = event.target;
  if (target instanceof Element && target.closest('.ProseMirror, .tippy-box, [data-tippy-root], button, input')) {
    return;
  }
  ed.chain().focus('end').run();
}

function focus() {
  editor.value?.chain().focus('end').run();
}

function insertText(text) {
  const ed = editor.value;
  if (!ed || !text) return;
  ed.chain().focus().insertContent(String(text)).run();
}

/** Text immediately before the caret (cursor-local; not full-doc getText). */
function getTextBeforeCursor(maxLen = 80) {
  const ed = editor.value;
  if (!ed) return '';
  const { from } = ed.state.selection;
  return ed.state.doc.textBetween(Math.max(0, from - maxLen), from, '\n', '\n');
}

function getActiveMentionQuery() {
  const textBefore = getTextBeforeCursor();
  const match = textBefore.match(/(?:^|\s)@([^\s@]*)$/);
  return match ? match[1] : null;
}

function replaceTrailingMentionQuery(label) {
  const ed = editor.value;
  if (!ed) return false;
  const { state } = ed;
  const { from } = state.selection;
  const textBefore = getTextBeforeCursor();
  const match = textBefore.match(/(?:^|\s)(@[^\s@]*)$/);
  if (!match) {
    insertText(`${label} `);
    return true;
  }
  const token = match[1];
  const deleteFrom = from - token.length;
  ed.chain()
    .focus()
    .deleteRange({ from: deleteFrom, to: from })
    .insertContent(`${label} `)
    .run();
  return true;
}

defineExpose({
  focus,
  insertText,
  replaceTrailingMentionQuery,
  getActiveMentionQuery,
  getPlainText: () => editor.value?.getText() || '',
  editor,
});

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<style scoped>
.ic-composer-tiptap :deep(.ProseMirror) {
  min-height: 2.75rem;
  max-height: 10rem;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.ic-composer-tiptap :deep(.ProseMirror p) {
  margin: 0;
}

.ic-composer-tiptap :deep(.ProseMirror p + p) {
  margin-top: 0.35rem;
}

.ic-composer-tiptap :deep(.ProseMirror h1) {
  margin: 0.25rem 0;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.3;
}

.ic-composer-tiptap :deep(.ProseMirror h2) {
  margin: 0.25rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.35;
}

.ic-composer-tiptap :deep(.ProseMirror h3) {
  margin: 0.2rem 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
}

.ic-composer-tiptap :deep(.ProseMirror ul) {
  list-style: disc;
  padding-left: 1.25rem;
  margin: 0.25rem 0;
}

.ic-composer-tiptap :deep(.ProseMirror ol) {
  list-style: decimal;
  padding-left: 1.25rem;
  margin: 0.25rem 0;
}

.ic-composer-tiptap :deep(.ProseMirror blockquote) {
  margin: 0.35rem 0;
  border-left: 3px solid rgb(209 213 219);
  padding: 0.25rem 0.75rem;
  background: rgb(249 250 251);
}

:global(.dark) .ic-composer-tiptap :deep(.ProseMirror blockquote) {
  border-left-color: rgb(75 85 99);
  background: rgb(31 41 55 / 0.6);
}

.ic-composer-tiptap :deep(.ProseMirror code) {
  border-radius: 0.25rem;
  padding: 0.05rem 0.3rem;
  font-size: 0.85em;
  background: rgb(0 0 0 / 0.06);
}

:global(.dark) .ic-composer-tiptap :deep(.ProseMirror code) {
  background: rgb(255 255 255 / 0.12);
}

.ic-composer-tiptap :deep(.ProseMirror a) {
  color: rgb(79 70 229);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.ic-composer-tiptap :deep(.ic-mention) {
  border-radius: 0.25rem;
  padding: 0.05rem 0.3rem;
  font-weight: 600;
  background: rgb(219 234 254);
  color: rgb(30 64 175);
}

:global(.dark) .ic-composer-tiptap :deep(.ic-mention) {
  background: rgb(30 58 138 / 0.55);
  color: rgb(191 219 254);
}

.ic-composer-tiptap :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  color: rgb(163 163 163);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

:global(.dark) .ic-composer-tiptap :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  color: rgb(115 115 115);
}
</style>
