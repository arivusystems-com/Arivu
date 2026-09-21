<template>
  <div
    class="task-description-editor cursor-text rounded-lg border border-gray-200/70 dark:border-gray-700/70 bg-white dark:bg-gray-800 overflow-hidden outline-1 -outline-offset-1 outline-gray-200/40 dark:outline-white/10 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-indigo-500 dark:focus-within:outline-indigo-500"
    :class="{ 'task-description-editor--image-selected': imageNodeSelected }"
    @mousedown="onEditorSurfaceMouseDown"
  >
    <input
      ref="imageInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      data-description-image
      @change="handleImageFileSelect"
    />
    <!-- Bubble menu (Notion-style: appears on text selection) -->
    <BubbleMenu
      v-if="editor"
      :editor="editor"
      :should-show="shouldShowTextBubbleMenu"
      :tippy-options="{ duration: 100, placement: 'top' }"
      class="flex items-center gap-0.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1 px-1"
    >
      <div class="flex items-center gap-0.5" @mousedown.prevent>
      <button
        type="button"
        :class="['p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '']"
        :title="t('records.taskDescriptionEditorHeading1')"
        @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
      >
        <span class="font-bold text-base">H1</span>
      </button>
      <button
        type="button"
        :class="['p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '']"
        :title="t('records.taskDescriptionEditorHeading2')"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
      >
        <span class="font-semibold text-sm">H2</span>
      </button>
      <button
        type="button"
        :class="['p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '']"
        :title="t('records.taskDescriptionEditorHeading3')"
        @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
      >
        <span class="font-medium text-sm">H3</span>
      </button>
      <span class="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-0.5" />
      <button
        type="button"
        :class="['p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', editor.isActive('bold') ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '']"
        :title="t('records.taskDescriptionEditorBold')"
        @click="editor.chain().focus().toggleBold().run()"
      >
        <span class="font-bold text-sm">B</span>
      </button>
      <button
        type="button"
        :class="['p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', editor.isActive('italic') ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '']"
        :title="t('records.taskDescriptionEditorItalic')"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <span class="italic text-sm">I</span>
      </button>
      <button
        type="button"
        :class="['p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', editor.isActive('strike') ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '']"
        :title="t('records.taskDescriptionEditorStrikethrough')"
        @click="editor.chain().focus().toggleStrike().run()"
      >
        <span class="line-through text-sm">S</span>
      </button>
      <button
        v-if="variant === 'document'"
        type="button"
        class="p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        :title="t('documents.inlineCommentsAddFromSelection')"
        @click="requestInlineComment"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h6m-7 8l-4-4V6a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H8z" />
        </svg>
      </button>
      <span class="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-0.5" />
      <button
        type="button"
        :class="['p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', editor.isActive('bulletList') ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '']"
        :title="t('records.taskDescriptionEditorBulletList')"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M4 6a1 1 0 100-2 1 1 0 000 2zm0 4a1 1 0 100-2 1 1 0 000 2zm0 4a1 1 0 100-2 1 1 0 000 2zM8 5h10a1 1 0 010 2H8a1 1 0 010-2zm0 4h10a1 1 0 110 2H8a1 1 0 110-2zm0 4h10a1 1 0 110 2H8a1 1 0 110-2z" />
        </svg>
      </button>
      <button
        type="button"
        :class="['p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', editor.isActive('orderedList') ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '']"
        :title="t('records.taskDescriptionEditorNumberedList')"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 4h14v1.5H2V4zm0 5h14v1.5H2V9zm0 5h14v1.5H2V14zM17 4v1.5h1V4h-1zm0 5v1.5h1V9h-1zm0 5v1.5h1V14h-1z" />
        </svg>
      </button>
      <span class="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-0.5" />
      <Popover v-slot="{ close }" class="relative">
        <PopoverButton
          type="button"
          :class="['p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', editor.isActive('link') ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : '']"
          :title="t('settings.modFieldsPbResourceLink')"
          @click="handleLinkButtonClick"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </PopoverButton>
        <PopoverPanel
          class="absolute left-0 top-full mt-1 w-72 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg p-3 z-50 focus:outline-none"
        >
          <div class="space-y-2">
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">URL</label>
            <input
              ref="linkInputRef"
              v-model="linkUrl"
              type="url"
              placeholder="https://"
              class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
              @keydown.enter.prevent="applyLink(close)"
              @keydown.escape="close"
            />
            <div class="flex gap-2 justify-end">
              <button
                type="button"
                class="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                @click="close"
              >{{ t('performance.cancelWizard') }}</button>
              <button
                type="button"
                :disabled="!canApplyLink"
                class="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                @click="applyLink(close)"
              >{{ t('actions.apply') }}</button>
            </div>
          </div>
        </PopoverPanel>
      </Popover>
      <button
        v-if="editor.isActive('link')"
        type="button"
        class="p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        :title="t('records.taskDescriptionEditorRemoveLink')"
        @click="editor.chain().focus().unsetLink().run()"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      </div>
    </BubbleMenu>
    <BubbleMenu
      v-if="editor"
      :editor="editor"
      :should-show="shouldShowImageBubbleMenu"
      :tippy-options="{ duration: 100, placement: 'top' }"
      class="flex items-center gap-0.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1 px-1"
    >
      <div class="flex items-center gap-0.5" @mousedown.prevent>
        <button
          v-for="preset in imageWidthPresets"
          :key="preset.width"
          type="button"
          :class="[
            'px-2 py-1.5 rounded text-xs font-medium',
            isImageWidthActive(preset.width)
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          ]"
          :title="t(preset.labelKey)"
          @click="setImageWidth(preset.width)"
        >
          {{ preset.shortLabel }}
        </button>
        <span class="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-0.5" />
        <button
          type="button"
          class="p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          :title="t('records.descriptionImagePreview')"
          @click="expandSelectedImage"
        >
          <MagnifyingGlassPlusIcon class="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="p-2 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
          :title="t('records.taskDescriptionEditorRemoveImage')"
          @click="removeSelectedImage"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </BubbleMenu>
    <!-- Editor content -->
    <EditorContent
      :editor="editor"
      class="[&_.tiptap]:min-h-[120px] [&_.tiptap]:text-md [&_.tiptap]:leading-[1.75] [&_.tiptap_p]:mb-2 [&_.tiptap_p:last-child]:mb-0 [&_.tiptap_p]:leading-[1.75] [&_.tiptap_h1]:text-2xl [&_.tiptap_h1]:font-bold [&_.tiptap_h1]:my-4 [&_.tiptap_h1]:mb-2 [&_.tiptap_h2]:text-xl [&_.tiptap_h2]:font-semibold [&_.tiptap_h2]:my-4 [&_.tiptap_h2]:mb-2 [&_.tiptap_h3]:text-lg [&_.tiptap_h3]:font-semibold [&_.tiptap_h3]:my-4 [&_.tiptap_h3]:mb-2 [&_.tiptap_ul]:pl-6 [&_.tiptap_ol]:pl-6 [&_.tiptap_ul]:list-disc [&_.tiptap_ol]:list-decimal [&_.tiptap_a]:text-indigo-600 [&_.tiptap_a]:underline dark:[&_.tiptap_a]:text-indigo-400 [&_.tiptap_blockquote]:border-l-4 [&_.tiptap_blockquote]:border-gray-300 [&_.tiptap_blockquote]:bg-gray-50 [&_.tiptap_blockquote]:px-3 [&_.tiptap_blockquote]:py-2 [&_.tiptap_blockquote]:my-2 dark:[&_.tiptap_blockquote]:border-gray-600 dark:[&_.tiptap_blockquote]:bg-gray-800/60 [&_.tiptap_img]:max-w-full [&_.tiptap_img]:h-auto [&_.tiptap_img]:rounded-md [&_.tiptap_img]:my-2 [&_.tiptap_img]:block [&_.tiptap_img.description-inline-image]:cursor-zoom-in"
    />
    <!-- Cmd/Ctrl+K link panel: fixed positioning (no Teleport — avoids TipTap init-order issues in production) -->
    <div
      v-if="shortcutLinkPanelOpen"
      class="task-description-link-shortcut w-72 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg p-3 z-[12000]"
      :style="shortcutLinkPanelStyle"
      role="dialog"
      :aria-label="t('records.taskDescriptionEditorInsertLink')"
      @mousedown.prevent
    >
      <div class="space-y-2">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">URL</label>
        <input
          ref="shortcutLinkInputRef"
          v-model="linkUrl"
          type="url"
          placeholder="https://"
          class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
          @keydown.enter.prevent="applyShortcutLink"
          @keydown.escape.prevent="closeShortcutLinkPanel"
        />
        <div class="flex gap-2 justify-end">
          <button
            type="button"
            class="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            @click="closeShortcutLinkPanel"
          >{{ t('performance.cancelWizard') }}</button>
          <button
            type="button"
            :disabled="!canApplyLink"
            class="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            @click="applyShortcutLink"
          >{{ t('actions.apply') }}</button>
        </div>
      </div>
    </div>
    <RichDescriptionImageLightbox
      :open="showImagePreview"
      :src="previewImageSrc"
      @close="closeImagePreview"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { TextSelection } from '@tiptap/pm/state';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/vue-3';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import StarterKit from '@tiptap/starter-kit';
import Blockquote from '@tiptap/extension-blockquote';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Heading from '@tiptap/extension-heading';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { MagnifyingGlassPlusIcon } from '@heroicons/vue/24/outline';
import {
  SlashCommands,
  registerDescriptionImageUploadTrigger,
  unregisterDescriptionImageUploadTrigger
} from './slashCommands.js';
import { createDocumentSlashCommands } from '@/components/documents/documentSlashCommands.js';
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';
import { useRichDescriptionImagePreview } from '@/composables/useRichDescriptionImagePreview';
import RichDescriptionImageLightbox from '@/components/common/RichDescriptionImageLightbox.vue';
import {
  stripDescriptionImageAuthTokens,
  withResolvedDescriptionImageUrls
} from '@/utils/richDescriptionHtml';
import { resolveAssetDownloadUrl } from '@/modules/template/composables/useCompanyLogoAsset';

import { useNotifications } from '@/composables/useNotifications';
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: "Write or type '/' for commands"
  },
  autoFocus: {
    type: Boolean,
    default: false
  },
  variant: {
    type: String,
    default: 'task'
  },
  fullPage: {
    type: Boolean,
    default: false
  }
});

const { t } = useI18n();
const notifications = useNotifications();

const {
  showImagePreview,
  previewImageSrc,
  closeImagePreview,
  openImagePreview
} = useRichDescriptionImagePreview();

const emit = defineEmits(['update:modelValue', 'blur', 'cancel', 'image-uploaded', 'inline-comment-request']);

const linkUrl = ref('https://');

/** True once the field has real URL content (not empty / not only scheme prefix). */
const canApplyLink = computed(() => {
  const trimmed = (linkUrl.value || '').trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower === 'https://' || lower === 'http://') return false;
  return true;
});

const linkInputRef = ref(null);
const imageInputRef = ref(null);
const imageUploading = ref(false);
const suppressBlurForImagePicker = ref(false);
const imagePickerActive = ref(false);
const imageNodeSelected = ref(false);
let imagePickerFocusListener = null;
const shortcutLinkPanelOpen = ref(false);
const shortcutLinkPanelStyle = ref({});
const shortcutLinkInputRef = ref(null);

/** Populated in onCreate/onDestroy; avoids TDZ inside useEditor callbacks. */
const editorInstance = { current: null };
const pendingFocus = ref(false);

function applyEditorFocus() {
  const ed = editorInstance.current;
  if (!ed) return false;
  ed.commands.focus('end');
  pendingFocus.value = false;
  return true;
}

function scheduleEditorFocus() {
  nextTick(() => {
    requestAnimationFrame(() => {
      if (!applyEditorFocus()) {
        pendingFocus.value = true;
      }
    });
  });
}

function closeShortcutLinkPanel() {
  shortcutLinkPanelOpen.value = false;
}

function computeShortcutPanelPosition(ed) {
  if (!ed?.view) return {};
  const { from, to } = ed.state.selection;
  if (from === to) return {};
  const view = ed.view;
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);
  const leftEdge = Math.min(start.left, end.left, start.right, end.right);
  const bottomEdge = Math.max(start.bottom, end.bottom);
  const panelW = 288;
  const margin = 8;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
  const clampedLeft = Math.min(Math.max(leftEdge, margin), vw - panelW - margin);
  return {
    position: 'fixed',
    left: `${clampedLeft}px`,
    top: `${bottomEdge + 4}px`,
    zIndex: 12000
  };
}

function syncLinkUrlFromSelection() {
  linkUrl.value = editorInstance.current?.getAttributes('link')?.href || 'https://';
}

function requestInlineComment() {
  const ed = editorInstance.current;
  if (!ed) return;
  const { from, to } = ed.state.selection;
  if (from === to) return;
  const quotedText = ed.state.doc.textBetween(from, to, ' ').trim();
  if (!quotedText) return;
  emit('inline-comment-request', {
    quotedText,
    anchorFrom: from,
    anchorTo: to
  });
}

function focusLinkInput() {
  window.setTimeout(() => {
    linkInputRef.value?.focus();
    linkInputRef.value?.select();
  }, 0);
}

function focusShortcutLinkInput() {
  nextTick(() => {
    shortcutLinkInputRef.value?.focus();
    shortcutLinkInputRef.value?.select();
  });
}

function handleLinkButtonClick() {
  closeShortcutLinkPanel();
  syncLinkUrlFromSelection();
  focusLinkInput();
}

function openLinkEditorFromShortcut() {
  const ed = editorInstance.current;
  if (!ed || ed.state.selection.empty) return;
  syncLinkUrlFromSelection();
  shortcutLinkPanelStyle.value = computeShortcutPanelPosition(ed);
  shortcutLinkPanelOpen.value = true;
  focusShortcutLinkInput();
}

function applyShortcutLink() {
  if (!canApplyLink.value) return;
  const url = linkUrl.value.trim();
  editorInstance.current?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  closeShortcutLinkPanel();
}

function applyLink(close) {
  if (!canApplyLink.value) return;
  const url = linkUrl.value.trim();
  editorInstance.current?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  close?.();
}

function focus() {
  if (!applyEditorFocus()) {
    pendingFocus.value = true;
  }
}

/** Click empty padding / unused height → focus the editor (compose fills tall area). */
function onEditorSurfaceMouseDown(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest('button, input, textarea, select, a, label, [data-tippy-root], .tippy-box')) {
    return;
  }
  // Let ProseMirror handle clicks on its own content/selection
  if (target.closest('.ProseMirror')) {
    if (!editorInstance.current?.isFocused) {
      applyEditorFocus();
    }
    return;
  }
  event.preventDefault();
  const ed = editorInstance.current;
  if (!ed || ed.isDestroyed) {
    pendingFocus.value = true;
    return;
  }
  ed.commands.focus('end');
}

function shouldShowTextBubbleMenu({ editor: ed }) {
  if (ed.isActive('image')) return false;
  return !ed.state.selection.empty;
}

function shouldShowImageBubbleMenu({ editor: ed }) {
  return ed.isActive('image');
}

const imageWidthPresets = [
  { width: '25%', shortLabel: 'S', labelKey: 'records.taskDescriptionEditorImageSizeSmall' },
  { width: '50%', shortLabel: 'M', labelKey: 'records.taskDescriptionEditorImageSizeMedium' },
  { width: '75%', shortLabel: 'L', labelKey: 'records.taskDescriptionEditorImageSizeLarge' },
  { width: '100%', shortLabel: 'Full', labelKey: 'records.taskDescriptionEditorImageSizeFull' }
];

function normalizeImageWidth(width) {
  const value = String(width || '').trim();
  if (!value || value === '100%') return '100%';
  return value;
}

function isImageWidthActive(presetWidth) {
  const ed = editorInstance.current;
  if (!ed?.isActive('image')) return false;
  return normalizeImageWidth(ed.getAttributes('image').width) === presetWidth;
}

function setImageWidth(width) {
  editorInstance.current?.chain().focus().updateAttributes('image', { width }).run();
}

function removeSelectedImage() {
  editorInstance.current?.chain().focus().deleteSelection().run();
}

function expandSelectedImage() {
  const ed = editorInstance.current;
  if (!ed?.isActive('image')) return;
  const src = String(ed.getAttributes('image')?.src || '').trim();
  if (!src) return;
  openImagePreview(src);
}

function insertText(text) {
  const value = String(text || '');
  if (!value || !editorInstance.current) return;
  editorInstance.current.chain().focus().insertContent(value).run();
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function clearImagePickerFocusListener() {
  if (imagePickerFocusListener) {
    window.removeEventListener('focus', imagePickerFocusListener);
    imagePickerFocusListener = null;
  }
}

function releaseImagePickerSuppression() {
  imagePickerActive.value = false;
  clearImagePickerFocusListener();
  if (!imageUploading.value) {
    suppressBlurForImagePicker.value = false;
  }
}

function triggerImageUpload() {
  suppressBlurForImagePicker.value = true;
  imagePickerActive.value = true;
  clearImagePickerFocusListener();

  imagePickerFocusListener = () => {
    window.setTimeout(() => {
      if (!imagePickerActive.value || imageUploading.value) return;
      releaseImagePickerSuppression();
      editorInstance.current?.commands.focus();
    }, 500);
  };
  window.addEventListener('focus', imagePickerFocusListener);

  imageInputRef.value?.click();
}

async function uploadDescriptionImage(file) {
  const formData = new FormData();
  formData.append('file', file);

  const authStore = useAuthStore();
  const token = authStore.user?.token;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(getApiUrlForFetch('/api/upload'), {
    method: 'POST',
    headers,
    body: formData
  });

  const result = await response.json();
  if (!response.ok || !result.success || !result.url) {
    throw new Error(result.message || 'Upload failed');
  }
  return String(result.url);
}

function isImageUploadFile(file) {
  if (!file) return false;
  if (file.type?.startsWith('image/')) return true;
  const ext = String(file.name || '').toLowerCase().split('.').pop();
  return ['jpeg', 'jpg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
}

async function insertUploadedImage(file) {
  if (!isImageUploadFile(file)) return;
  if (file.size > MAX_IMAGE_BYTES) {
    notifications.error(t('validation.imageMaxSize'));
    return;
  }
  const ed = editorInstance.current;
  if (!ed || imageUploading.value) return;

  imageUploading.value = true;
  suppressBlurForImagePicker.value = true;
  try {
    const url = await uploadDescriptionImage(file);
    if (!editorInstance.current) return;
    const displayUrl = resolveAssetDownloadUrl(url) || url;
    editorInstance.current.chain().focus().setImage({ src: displayUrl, alt: file.name || '', width: '100%' }).run();
    emit('image-uploaded', url);
  } catch (error) {
    console.error('Description image upload error:', error);
    notifications.error(t('validation.imageUploadFailed'));
  } finally {
    imageUploading.value = false;
    suppressBlurForImagePicker.value = false;
    await nextTick();
    editorInstance.current?.commands.focus();
  }
}

function handleImageFileSelect(event) {
  imagePickerActive.value = false;
  clearImagePickerFocusListener();
  const file = event.target.files?.[0];
  event.target.value = '';
  if (file) {
    insertUploadedImage(file);
    return;
  }
  suppressBlurForImagePicker.value = false;
  editorInstance.current?.commands.focus();
}

function extractImageFileFromDataTransfer(dataTransfer) {
  if (!dataTransfer) return null;
  const files = Array.from(dataTransfer.files || []);
  const directImage = files.find((file) => file.type.startsWith('image/'));
  if (directImage) return directImage;

  const items = Array.from(dataTransfer.items || []);
  for (const item of items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  return null;
}

function extractImageFileFromClipboard(clipboardData) {
  if (!clipboardData) return null;
  const items = Array.from(clipboardData.items || []);
  for (const item of items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  return null;
}

const ReplyQuoteBlockquote = Blockquote.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      replyQuote: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-reply-quote'),
        renderHTML: (attributes) => (
          attributes.replyQuote ? { 'data-reply-quote': String(attributes.replyQuote) } : {}
        )
      },
      collapsed: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-collapsed'),
        renderHTML: (attributes) => (
          attributes.collapsed ? { 'data-collapsed': String(attributes.collapsed) } : {}
        )
      }
    };
  }
});

const DescriptionImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        parseHTML: (element) => (
          element.getAttribute('data-width')
          || element.getAttribute('width')
          || '100%'
        ),
        renderHTML: (attributes) => {
          const width = String(attributes.width || '').trim();
          if (!width || width === '100%') {
            return { 'data-width': '100%' };
          }
          return { 'data-width': width };
        }
      }
    };
  }
});

const isDocumentVariant = computed(() => props.variant === 'document');

function buildEditorExtensions() {
  const base = [
    StarterKit.configure({
      heading: false,
      blockquote: false
    }),
    Heading.configure({ levels: [1, 2, 3] }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-indigo-600 dark:text-indigo-400 underline hover:no-underline',
        target: '_blank',
        rel: 'noopener noreferrer'
      }
    }),
    DescriptionImage.configure({
      inline: false,
      allowBase64: false,
      HTMLAttributes: {
        class: 'description-inline-image max-w-full h-auto rounded-md my-2'
      }
    }),
    Placeholder.configure({
      placeholder: props.placeholder
    })
  ];

  if (props.variant === 'document') {
    base.splice(1, 0, Blockquote);
    base.push(
      TaskList.configure({
        HTMLAttributes: { class: 'document-task-list' }
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: 'document-task-item' }
      }),
      createDocumentSlashCommands(() => triggerImageUpload())
    );
  } else {
    base.splice(1, 0, ReplyQuoteBlockquote);
    base.push(SlashCommands);
  }

  return base;
}

const editor = useEditor({
  content: withResolvedDescriptionImageUrls(props.modelValue || ''),
  extensions: buildEditorExtensions(),
  editorProps: {
    attributes: {
      class: `rte-content ${props.fullPage ? 'min-h-[calc(100vh-14rem)]' : 'min-h-[120px]'} px-6 py-4 text-md text-gray-900 dark:text-white focus:outline-none`
    },
    handleKeyDown: (view, event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        const { empty } = view.state.selection;
        // Keep global Cmd/Ctrl+K behavior unless there's an active text selection in this editor.
        if (empty) return false;
        event.preventDefault();
        openLinkEditorFromShortcut();
        return true;
      }
      if (shortcutLinkPanelOpen.value && event.key === 'Escape') {
        event.preventDefault();
        closeShortcutLinkPanel();
        return true;
      }
      if (event.key === 'Escape') {
        emit('cancel');
        return true;
      }
      return false;
    },
    handleDOMEvents: {
      mousedown(view, event) {
        if (!view.editable) return false;
        const target = event.target;
        if (target instanceof Element) {
          if (target.closest('button, input, textarea, select, a, label, [data-tippy-root], .tippy-box')) {
            return false;
          }
        }
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (coords) return false;
        // Click landed in editor padding below/beside document content
        const end = view.state.doc.content.size;
        view.dispatch(
          view.state.tr.setSelection(TextSelection.create(view.state.doc, end)).scrollIntoView()
        );
        view.focus();
        event.preventDefault();
        return true;
      }
    },
    handlePaste: (_view, event) => {
      const file = extractImageFileFromClipboard(event.clipboardData);
      if (!file) return false;
      event.preventDefault();
      insertUploadedImage(file);
      return true;
    },
    handleDrop: (_view, event, _slice, moved) => {
      if (moved) return false;
      const file = extractImageFileFromDataTransfer(event.dataTransfer);
      if (!file) return false;
      event.preventDefault();
      insertUploadedImage(file);
      return true;
    },
    handleClick: (view, pos, event) => {
      const target = event?.target;
      if (!(target instanceof Element)) return false;
      if (target instanceof HTMLImageElement && event.detail >= 2) {
        event.preventDefault();
        openImagePreview(target);
        return true;
      }
      const quoteEl = target.closest('blockquote[data-reply-quote]');
      if (!quoteEl) return false;
      const quotePos = view.posAtDOM(quoteEl, 0);
      const $pos = view.state.doc.resolve(Math.max(0, quotePos));
      for (let depth = $pos.depth; depth > 0; depth -= 1) {
        const node = $pos.node(depth);
        if (node.type.name !== 'blockquote') continue;
        const nodePos = $pos.before(depth);
        const isCollapsed = String(node.attrs?.collapsed || '').toLowerCase() === 'true';
        const tr = view.state.tr.setNodeMarkup(nodePos, undefined, {
          ...node.attrs,
          replyQuote: 'true',
          collapsed: isCollapsed ? 'false' : 'true'
        });
        view.dispatch(tr);
        return true;
      }
      return false;
    }
  },
  onBlur: ({ event, editor: ed }) => {
    // Defer to avoid blur when clicking BubbleMenu (tippy-box) or slash command menu
    setTimeout(() => {
      if (!ed.isFocused) {
        const target = event?.relatedTarget;
        const isInteractiveMenu = target && typeof target.closest === 'function' &&
          (target.closest('.slash-command-list') || target.closest('.tippy-box') || target.closest('.task-description-link-shortcut') || target.closest('[data-description-image]'));
        if (!isInteractiveMenu && !suppressBlurForImagePicker.value && !imageUploading.value) {
          emit('blur');
        }
      }
    }, 0);
  },
  onCreate: ({ editor: ed }) => {
    editorInstance.current = ed;
    registerDescriptionImageUploadTrigger(ed, triggerImageUpload);
    const syncImageSelection = () => {
      imageNodeSelected.value = ed.isActive('image');
    };
    ed.on('selectionUpdate', syncImageSelection);
    ed.on('transaction', syncImageSelection);
    syncImageSelection();
    if (pendingFocus.value || props.autoFocus) {
      scheduleEditorFocus();
    }
  },
  onDestroy: () => {
    if (editorInstance.current) {
      unregisterDescriptionImageUploadTrigger(editorInstance.current);
    }
    imageNodeSelected.value = false;
    editorInstance.current = null;
  },
  onUpdate: ({ editor: e }) => {
    emit('update:modelValue', stripDescriptionImageAuthTokens(e.getHTML()));
  }
});

watch(
  () => props.modelValue,
  (newVal) => {
    const current = editorInstance.current?.getHTML();
    const normalized = String(newVal || '').trim();
    const currentNorm = stripDescriptionImageAuthTokens(current || '').trim();
    if (editorInstance.current && normalized !== currentNorm) {
      editorInstance.current.commands.setContent(
        withResolvedDescriptionImageUrls(normalized),
        false
      );
    }
  },
  { immediate: false }
);

defineExpose({ focus, insertText });

onBeforeUnmount(() => {
  clearImagePickerFocusListener();
});
</script>

<style scoped>
/* TipTap Placeholder: show on any empty paragraph (new line) */
/* emptyNodeClass='is-empty' for empty nodes; emptyEditorClass='is-editor-empty' when doc is empty */
.task-description-editor :deep(.tiptap p.is-empty::before),
.task-description-editor :deep(.tiptap p.is-editor-empty::before) {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  color: #9ca3af;
}
/* Stabilize last line: prevent empty trailing block from collapsing and causing jitter */
.task-description-editor :deep(.tiptap p:last-child) {
  min-height: 1.75em;
}

/* Gmail-like collapsed quoted history in replies */
.task-description-editor :deep(.tiptap blockquote[data-reply-quote]) {
  border-left: 3px solid #d1d5db;
  background: #f9fafb;
  border-radius: 0.25rem;
  margin: 0.5rem 0;
  padding: 0.5rem 0.75rem;
}

.task-description-editor :deep(.tiptap blockquote[data-reply-quote][data-collapsed="true"]) {
  cursor: pointer;
  padding-top: 0.35rem;
  padding-bottom: 0.35rem;
}

.task-description-editor :deep(.tiptap blockquote[data-reply-quote][data-collapsed="true"] > *) {
  display: none;
}

.task-description-editor :deep(.tiptap blockquote[data-reply-quote][data-collapsed="true"]::before) {
  content: "...";
  color: #6b7280;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.task-description-editor :deep(.dark .tiptap blockquote[data-reply-quote]) {
  border-left-color: #4b5563;
  background: rgba(31, 41, 55, 0.6);
}

.task-description-editor :deep(.tiptap img.description-inline-image) {
  max-width: 100%;
  height: auto;
  border-radius: 0.375rem;
  margin: 0.5rem 0;
  display: block;
  cursor: pointer;
}

.task-description-editor :deep(.tiptap img.description-inline-image[data-width="25%"]) {
  width: 25%;
}

.task-description-editor :deep(.tiptap img.description-inline-image[data-width="50%"]) {
  width: 50%;
}

.task-description-editor :deep(.tiptap img.description-inline-image[data-width="75%"]) {
  width: 75%;
}

.task-description-editor :deep(.tiptap img.description-inline-image[data-width="100%"]) {
  width: 100%;
}

.task-description-editor--image-selected:focus-within {
  outline-width: 1px;
  outline-offset: -1px;
  outline-color: rgb(229 231 235 / 0.7);
}

.dark .task-description-editor--image-selected:focus-within {
  outline-color: rgb(255 255 255 / 0.1);
}

.task-description-editor :deep(.tiptap img.description-inline-image.ProseMirror-selectednode) {
  outline: none;
  box-shadow:
    0 0 0 2px rgb(255 255 255),
    0 0 0 4px rgb(99 102 241 / 0.45);
}

.dark .task-description-editor :deep(.tiptap img.description-inline-image.ProseMirror-selectednode) {
  box-shadow:
    0 0 0 2px rgb(31 41 55),
    0 0 0 4px rgb(129 140 248 / 0.55);
}

.task-description-editor :deep(.tiptap ul[data-type="taskList"]) {
  list-style: none;
  margin: 0.5rem 0;
  padding: 0;
}

.task-description-editor :deep(.tiptap ul[data-type="taskList"] li) {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.task-description-editor :deep(.tiptap ul[data-type="taskList"] li > label) {
  flex: 0 0 auto;
  margin-top: 0.2rem;
  user-select: none;
}

.task-description-editor :deep(.tiptap ul[data-type="taskList"] li > div) {
  flex: 1 1 auto;
}
</style>
