<template>
  <div
    :class="[
      'comment-input relative',
      isActivityVariant
        ? 'rounded-xl border bg-white dark:bg-gray-900 shadow-sm px-3 py-2.5 transition-colors'
        : '',
      isActivityVariant && isComposerActive
        ? 'border-indigo-300 dark:border-indigo-500 ring-2 ring-indigo-500/20'
        : (isActivityVariant ? 'border-gray-200 dark:border-gray-700' : '')
    ]"
  >
    <div
      ref="editorRef"
      :data-placeholder="resolvedPlaceholder"
      :class="[
        'comment-editor w-full text-sm text-gray-900 dark:text-white overflow-y-auto whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 dark:empty:before:text-gray-500 empty:before:pointer-events-none',
        isActivityVariant
          ? 'min-h-[48px] px-3 py-2 rounded-xl border border-transparent focus:outline-none transition-colors'
          : 'min-h-[80px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent',
        {
          'opacity-60 cursor-not-allowed': disabled,
          'bg-gray-50 dark:bg-gray-900': isActivityVariant && isComposerActive,
          'bg-transparent': isActivityVariant && !isComposerActive
        }
    ]"
      :style="editorInlineStyle"
      :contenteditable="!disabled"
      @focus="handleFocus"
      @input="handleInput"
      @keydown="handleKeydown"
      @blur="handleBlur"
    />
    <!-- Attached files preview -->
    <div v-if="existingAttachmentsState.length > 0 || (allowAttachments && selectedFiles.length > 0)" class="mt-2 flex flex-wrap gap-2">
      <span
        v-for="(attachment, idx) in existingAttachmentsState"
        :key="`existing-${idx}-${getAttachmentName(attachment)}`"
        class="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
      >
        <PaperClipIcon class="w-3.5 h-3.5 flex-shrink-0" />
        <span class="truncate max-w-[140px]">{{ getAttachmentName(attachment) }}</span>
        <span v-if="getAttachmentSize(attachment)" class="text-gray-400 dark:text-gray-500">({{ formatFileSize(getAttachmentSize(attachment)) }})</span>
        <button
          type="button"
          class="ml-0.5 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none"
          :aria-label="t('records.commentRemoveAttachment', { name: getAttachmentName(attachment) })"
          @click="removeExistingAttachment(idx)"
        >
          <XMarkIcon class="w-3.5 h-3.5" />
        </button>
      </span>
      <span
        v-for="(file, idx) in selectedFiles"
        :key="`file-${idx}-${file.name}`"
        class="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
      >
        <PaperClipIcon class="w-3.5 h-3.5 flex-shrink-0" />
        <span class="truncate max-w-[140px]">{{ file.name }}</span>
        <span class="text-gray-400 dark:text-gray-500">({{ formatFileSize(file.size) }})</span>
        <button
          type="button"
          class="ml-0.5 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none"
          :aria-label="t('records.commentRemoveAttachment', { name: file.name })"
          @click="removeFile(idx)"
        >
          <XMarkIcon class="w-3.5 h-3.5" />
        </button>
      </span>
    </div>
    <div
      v-if="showSubmit"
      :class="[
        'mt-2 flex items-center justify-between',
        isActivityVariant ? 'pt-1.5 px-1' : ''
      ]"
    >
      <div class="flex items-center gap-1.5">
        <input
          v-if="allowAttachments"
          ref="fileInputRef"
          type="file"
          multiple
          class="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.svg"
          @change="handleFileSelect"
        />
        <button
          v-if="allowAttachments"
          type="button"
          :class="toolbarButtonClass"
          :title="t('records.commentAddFile')"
          @mousedown.prevent="triggerFileSelect"
        >
          <PaperClipIcon class="w-[18px] h-[18px]" />
        </button>
        <button
          ref="mentionButtonRef"
          type="button"
          :class="toolbarButtonClass"
          :title="t('records.commentMentionTitle', { atSymbol: '@' })"
          @mousedown.prevent="insertAtSign"
        >
          <AtSymbolIcon class="w-[18px] h-[18px]" />
        </button>
        <div v-if="allowEmoji" class="relative">
          <button
            ref="emojiButtonRef"
            type="button"
            :class="toolbarButtonClass"
            :title="t('records.commentAddEmoji')"
            @mousedown.prevent="toggleEmojiPicker"
          >
            <FaceSmileIcon class="w-[18px] h-[18px]" />
          </button>
          <Teleport to="body">
            <div
              v-if="showEmojiPicker"
              ref="emojiPickerRef"
              :class="['fixed', FLOATING_OVERLAY_Z_CLASS, 'rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-1']"
              :style="emojiPickerStyle"
            >
              <emoji-picker
                :class="['comment-input-emoji-picker', isDarkTheme ? 'dark' : 'light']"
                :theme="emojiPickerTheme"
                :style="{ colorScheme: emojiPickerColorScheme }"
                @emoji-click="handleEmojiPickerSelect"
              />
            </div>
          </Teleport>
        </div>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <slot name="footerActions" :can-submit="canSubmit" :submit="handleSubmitClick">
          <button
            type="button"
            @click="handleSubmitClick"
            :disabled="!canSubmit"
            :class="[
              isActivityVariant
                ? activitySendButtonClass
                : 'px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none'
            ]"
          >
            <PaperAirplaneIcon v-if="isActivityVariant" class="w-5 h-5" />
            <span v-else>{{ t('records.commentSubmitLabel') }}</span>
          </button>
        </slot>
      </div>
    </div>
    <!-- Mention dropdown -->
    <Teleport to="body">
      <div
        v-if="showMentionDropdown"
        ref="dropdownRef"
        :class="['fixed', FLOATING_OVERLAY_Z_CLASS, 'max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1 min-w-[200px]']"
        :style="dropdownStyle"
      >
        <div v-if="mentionLoading" class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
          {{ t('records.commentMentionLoading') }}
        </div>
        <template v-else-if="filteredMentions.length > 0">
          <button
            v-for="(item, idx) in filteredMentions"
            :key="`${item.type}:${item.id}`"
            type="button"
            :data-mention-index="idx"
            :class="[
              'w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700',
              idx === mentionHighlightIndex ? 'bg-gray-100 dark:bg-gray-700' : ''
            ]"
            @mousedown.prevent="selectMention(item)"
          >
            <span
              v-if="item.type === 'user'"
              class="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
            >
              {{ getInitials(item) }}
            </span>
            <span
              v-else-if="item.type === 'all'"
              class="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs flex-shrink-0"
            >
              <UsersIcon class="w-3.5 h-3.5" />
            </span>
            <span
              v-else
              class="w-6 h-6 rounded-full bg-gray-400 dark:bg-gray-600 flex items-center justify-center text-white text-xs flex-shrink-0"
            >
              <UserGroupIcon class="w-3 h-3" />
            </span>
            <span class="min-w-0 flex-1 truncate text-gray-900 dark:text-gray-100">{{ item.type === 'all' ? `@${item.name}` : item.name }}</span>
            <span v-if="item.type === 'group'" class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
              {{ t('records.commentMentionGroup') }}
            </span>
            <span v-else-if="item.type === 'all'" class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
              {{ t('records.commentMentionAll') }}
            </span>
          </button>
        </template>
        <div v-else class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
          {{ t('records.commentMentionEmpty') }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { FLOATING_OVERLAY_Z_CLASS } from '@/constants/zIndexLayers';
import {
  UserGroupIcon,
  UsersIcon,
  PaperClipIcon,
  XMarkIcon,
  AtSymbolIcon,
  FaceSmileIcon,
  PaperAirplaneIcon
} from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import 'emoji-picker-element';

const { t } = useI18n();

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: undefined
  },
  rows: {
    type: Number,
    default: 3
  },
  disabled: {
    type: Boolean,
    default: false
  },
  showSubmit: {
    type: Boolean,
    default: true
  },
  allowAttachments: {
    type: Boolean,
    default: true
  },
  allowEmoji: {
    type: Boolean,
    default: true
  },
  submitOnEnter: {
    type: Boolean,
    default: true
  },
  existingAttachments: {
    type: Array,
    default: () => []
  },
  variant: {
    type: String,
    default: 'default'
  }
});

const emit = defineEmits(['update:modelValue', 'update:existingAttachments', 'files-change', 'submit']);

const resolvedPlaceholder = computed(
  () => props.placeholder ?? t('records.commentComposerDefaultPh')
);

const editorRef = ref(null);
const dropdownRef = ref(null);
const fileInputRef = ref(null);
const mentionButtonRef = ref(null);
const emojiButtonRef = ref(null);
const emojiPickerRef = ref(null);
const emojiPickerPosition = ref({ top: 0, left: 0 });
const localValue = ref(props.modelValue);
const selectedFiles = ref([]);
const existingAttachmentsState = ref(Array.isArray(props.existingAttachments) ? [...props.existingAttachments] : []);
const showEmojiPicker = ref(false);
const isInternalUpdate = ref(false);
const isEditorFocused = ref(false);
const showMentionDropdown = ref(false);
const mentionQuery = ref('');
const mentionStartContainer = ref(null);
const mentionStartOffset = ref(0);
const mentionAnchorMode = ref('button');
const mentionHighlightIndex = ref(0);
const mentionLoading = ref(false);
const users = ref([]);
const groups = ref([]);
const dropdownPosition = ref({ top: 0, left: 0 });
const activityMaxEditorHeight = ref(240);
let activityContainerResizeObserver = null;
let emojiThemeObserver = null;
const MIN_ACTIVITY_EDITOR_HEIGHT = 48;
const isDarkTheme = ref(false);

// Mention format for storage: @[Display Name](type:id)
const ALL_MENTION = Object.freeze({ type: 'all', id: 'all', name: 'all' });
const toMentionString = (item) => `@[${item.name}](${item.type}:${item.id})`;

// Create mention chip HTML element
const createMentionChip = (item) => {
  const span = document.createElement('span');
  const mentionTone = item.type === 'all'
    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
    : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200';
  span.className = `mention-chip inline-flex items-center px-1.5 py-0.5 mx-px rounded text-xs font-medium ${mentionTone} whitespace-nowrap`;
  span.contentEditable = 'false';
  span.dataset.type = item.type;
  span.dataset.id = String(item.id);
  span.dataset.name = item.name;
  span.textContent = `@${item.name}`;
  return span;
};

const mentionOptions = computed(() => {
  const result = [ALL_MENTION];
  users.value.forEach((u) => {
    result.push({
      type: 'user',
      id: u._id,
      name: getUserDisplayName(u)
    });
  });
  groups.value.forEach((g) => {
    result.push({
      type: 'group',
      id: g._id,
      name: g.name || 'Unnamed Group'
    });
  });
  return result;
});

const canSubmit = computed(() => (
  localValue.value.trim().length > 0 ||
  selectedFiles.value.length > 0 ||
  existingAttachmentsState.value.length > 0
));
const isActivityVariant = computed(() => props.variant === 'activity');
const isComposerActive = computed(() => (
  isEditorFocused.value ||
  canSubmit.value ||
  showMentionDropdown.value ||
  showEmojiPicker.value
));
const toolbarButtonClass = computed(() => (
  isActivityVariant.value
    ? 'inline-flex items-center justify-center w-[1.875rem] h-[1.875rem] rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none transition-colors'
    : 'p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none'
));
const activitySendButtonClass = computed(() => {
  const base = 'inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';
  if (canSubmit.value) {
    return `${base} text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600`;
  }
  if (isComposerActive.value) {
    return `${base} text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800`;
  }
  return `${base} text-gray-400 dark:text-gray-500`;
});

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
};

const filteredMentions = computed(() => {
  if (!mentionQuery.value) return mentionOptions.value.slice(0, 10);
  const q = mentionQuery.value.toLowerCase();
  return mentionOptions.value
    .filter((m) => m.name.toLowerCase().includes(q))
    .slice(0, 10);
});

watch(
  () => [showMentionDropdown.value, filteredMentions.value.length, mentionLoading.value],
  () => {
    if (!showMentionDropdown.value) return;
    nextTick(() => {
      updateDropdownPosition();
      requestAnimationFrame(() => updateDropdownPosition());
    });
  }
);

const dropdownStyle = computed(() => ({
  top: `${dropdownPosition.value.top}px`,
  left: `${dropdownPosition.value.left}px`
}));

const emojiPickerStyle = computed(() => ({
  top: `${emojiPickerPosition.value.top}px`,
  left: `${emojiPickerPosition.value.left}px`
}));
const emojiPickerTheme = computed(() => (isDarkTheme.value ? 'dark' : 'light'));
const emojiPickerColorScheme = computed(() => (isDarkTheme.value ? 'dark' : 'light'));

const editorInlineStyle = computed(() => {
  if (!isActivityVariant.value) {
    return { minHeight: `${props.rows * 24}px` };
  }
  return { maxHeight: `${activityMaxEditorHeight.value}px` };
});

const updateActivityEditorMaxHeight = () => {
  if (!isActivityVariant.value || !editorRef.value) return;
  const timelineRoot = editorRef.value.closest('.record-activity-timeline');
  const baseHeight = timelineRoot?.clientHeight || window.innerHeight || 800;
  activityMaxEditorHeight.value = Math.max(180, Math.floor(baseHeight * 0.5));
};

const resizeActivityEditor = () => {
  if (!isActivityVariant.value || !editorRef.value) return;
  updateActivityEditorMaxHeight();
  const el = editorRef.value;
  el.style.height = 'auto';
  const targetHeight = Math.max(
    MIN_ACTIVITY_EDITOR_HEIGHT,
    Math.min(el.scrollHeight, activityMaxEditorHeight.value)
  );
  el.style.height = `${targetHeight}px`;
  el.style.overflowY = el.scrollHeight > activityMaxEditorHeight.value ? 'auto' : 'hidden';
};

// Parse @[Name](type:id) and render as HTML with chips
const parseValueToHtml = (value) => {
  if (!value) return '';
  const MENTION_REGEX = /@\[([^\]]+)\]\((user|group|agent|all):([^)]+)\)/g;
  const escapeWithLineBreaks = (text) => escapeHtml(text).replace(/\n/g, '<br>');
  let html = '';
  let lastIndex = 0;
  let match;
  MENTION_REGEX.lastIndex = 0;
  while ((match = MENTION_REGEX.exec(value)) !== null) {
    html += escapeWithLineBreaks(value.slice(lastIndex, match.index));
    const tone = match[2] === 'all'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
      : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200';
    html += `<span class="mention-chip inline-flex items-center px-1.5 py-0.5 mx-px rounded text-xs font-medium ${tone} whitespace-nowrap" contenteditable="false" data-type="${escapeHtml(match[2])}" data-id="${escapeHtml(match[3])}" data-name="${escapeHtml(match[1])}">@${escapeHtml(match[1])}</span>`;
    lastIndex = MENTION_REGEX.lastIndex;
  }
  html += escapeWithLineBreaks(value.slice(lastIndex));
  return html;
};
const escapeHtml = (s) => {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
};

watch(
  () => props.modelValue,
  (v) => {
    if (isInternalUpdate.value) return;
    if (v !== localValue.value) {
      localValue.value = v || '';
      if (editorRef.value) {
        editorRef.value.innerHTML = parseValueToHtml(v || '');
        nextTick(() => {
          resizeActivityEditor();
        });
      }
    }
  },
  { immediate: true }
);

watch(
  () => props.existingAttachments,
  (attachments) => {
    existingAttachmentsState.value = Array.isArray(attachments) ? [...attachments] : [];
  },
  { immediate: true, deep: true }
);

watch(
  selectedFiles,
  (files) => {
    emit('files-change', [...files]);
  },
  { deep: true }
);

const getUserDisplayName = (user) => {
  if (!user) return '';
  const first = user.firstName || user.first_name || '';
  const last = user.lastName || user.last_name || '';
  if (first || last) return `${first} ${last}`.trim();
  if (user.email) return user.email;
  if (user.username) return user.username;
  return 'Unknown';
};

const getInitials = (item) => {
  if (!item.name) return '?';
  const parts = item.name.split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return item.name.substring(0, 2).toUpperCase();
};

const fetchMentions = async () => {
  mentionLoading.value = true;
  try {
    const [usersRes, groupsRes] = await Promise.all([
      apiClient.get('/users/list'),
      apiClient.get('/groups', { params: { limit: 100 } }),
    ]);
    users.value = usersRes?.success && Array.isArray(usersRes.data) ? usersRes.data : [];
    groups.value = groupsRes?.success && Array.isArray(groupsRes.data) ? groupsRes.data : [];
  } catch {
    users.value = [];
    groups.value = [];
  } finally {
    mentionLoading.value = false;
    nextTick(() => {
      updateDropdownPosition();
    });
  }
};

const getCaretViewportRect = () => {
  const editor = editorRef.value;
  const sel = window.getSelection();
  if (!editor || !sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) return null;
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rectFromRange = range.getBoundingClientRect();
  if (rectFromRange && (rectFromRange.width || rectFromRange.height)) {
    return rectFromRange;
  }

  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  marker.style.display = 'inline-block';
  marker.style.width = '1px';
  marker.style.height = '1em';
  range.insertNode(marker);
  const markerRect = marker.getBoundingClientRect();
  marker.parentNode?.removeChild(marker);
  return markerRect;
};

const getMentionStartViewportRect = () => {
  const editor = editorRef.value;
  const startContainer = mentionStartContainer.value;
  if (!editor || !startContainer || !document.contains(startContainer)) return null;

  const range = document.createRange();
  try {
    // Anchor at the `@` itself (not after it) so left stays pinned while typing.
    const rawOffset = mentionStartOffset.value;
    const maxOffset = startContainer.nodeType === Node.TEXT_NODE
      ? (startContainer.textContent?.length ?? 0)
      : startContainer.childNodes.length;
    const safeOffset = Math.max(0, Math.min(rawOffset, maxOffset));

    range.setStart(startContainer, safeOffset);
    range.collapse(true);

    const rectFromRange = range.getBoundingClientRect();
    if (rectFromRange && (rectFromRange.width || rectFromRange.height)) {
      return rectFromRange;
    }

    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    marker.style.display = 'inline-block';
    marker.style.width = '1px';
    marker.style.height = '1em';
    range.insertNode(marker);
    const markerRect = marker.getBoundingClientRect();
    marker.parentNode?.removeChild(marker);
    return markerRect;
  } catch {
    return null;
  }
};

/** Keep mentionStart* pointed at the active `@` in the current text node. */
const refreshMentionStartFromCaret = () => {
  const editor = editorRef.value;
  const sel = window.getSelection();
  if (!editor || !sel?.rangeCount || !editor.contains(sel.anchorNode)) return;
  const node = sel.anchorNode;
  if (node.nodeType !== Node.TEXT_NODE) return;
  const text = node.textContent || '';
  const before = text.slice(0, sel.anchorOffset);
  const atInNode = before.lastIndexOf('@');
  if (atInNode === -1) return;
  if (/\s/.test(before.slice(atInNode + 1))) return;
  mentionStartContainer.value = node;
  mentionStartOffset.value = atInNode;
};

const updateDropdownPosition = () => {
  const editorRect = editorRef.value?.getBoundingClientRect() || null;
  let useRect = null;

  if (mentionAnchorMode.value === 'caret') {
    // Always pin to `@` horizontally; fall back to caret/editor only if needed.
    const atRect = getMentionStartViewportRect();
    const caretRect = getCaretViewportRect();
    useRect = atRect || caretRect;
  } else {
    const anchor = mentionButtonRef.value || editorRef.value;
    useRect = anchor?.getBoundingClientRect() || null;
  }

  if (!useRect && !editorRect) return;
  if (!useRect) useRect = editorRect;

  if (editorRect) {
    const above = useRect.bottom < editorRect.top - 4;
    const below = useRect.top > editorRect.bottom + 4;
    if (above || below) useRect = editorRect;
  }

  const measuredHeight = dropdownRef.value?.offsetHeight || 0;
  const measuredWidth = dropdownRef.value?.offsetWidth || 0;
  const estimatedHeight = measuredHeight > 0 ? measuredHeight : 0;
  const estimatedWidth = measuredWidth > 0 ? measuredWidth : 220;
  const spaceAbove = useRect.top;
  const spaceBelow = window.innerHeight - useRect.bottom;

  const preferAbove = true;
  let top;
  if (!measuredHeight) {
    top = Math.max(8, useRect.top - 8);
  } else if (preferAbove && spaceAbove >= estimatedHeight + 8) {
    top = useRect.top - estimatedHeight - 6;
  } else if (spaceBelow >= estimatedHeight + 8) {
    top = useRect.bottom + 6;
  } else {
    top = Math.max(8, Math.min(useRect.top - estimatedHeight - 6, window.innerHeight - estimatedHeight - 8));
  }

  // Left edge always aligned to the `@` (or button/editor fallback).
  let left = useRect.left;
  left = Math.max(8, Math.min(left, window.innerWidth - estimatedWidth - 8));

  dropdownPosition.value = {
    top,
    left
  };
};

const openMentionDropdown = (anchorMode = 'button') => {
  mentionAnchorMode.value = anchorMode;
  showMentionDropdown.value = true;
  mentionHighlightIndex.value = 0;
  updateDropdownPosition();
  nextTick(() => {
    updateDropdownPosition();
    requestAnimationFrame(() => updateDropdownPosition());
  });
  fetchMentions();
};

const closeMentionDropdown = () => {
  showMentionDropdown.value = false;
  mentionQuery.value = '';
  mentionStartContainer.value = null;
  mentionStartOffset.value = 0;
  mentionAnchorMode.value = 'button';
};

const serializeEditorContent = (root) => {
  const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'PRE']);
  let result = '';
  const appendText = (text) => {
    if (!text) return;
    result += text;
  };
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      appendText(node.textContent);
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList?.contains('mention-chip')) {
        const type = node.dataset.type || 'user';
        const id = node.dataset.id || '';
        const name = node.dataset.name || node.textContent?.replace(/^@/, '') || '';
        appendText(`@[${name}](${type}:${id})`);
        return;
      }
      if (node.tagName === 'BR') {
        appendText('\n');
        return;
      }
      const isBlock = BLOCK_TAGS.has(node.tagName);
      const beforeLength = result.length;
      node.childNodes.forEach(walk);
      if (isBlock && result.length > beforeLength && !result.endsWith('\n')) {
        appendText('\n');
      }
    }
  };
  (root || editorRef.value)?.childNodes?.forEach(walk);
  return result
    .replace(/\u00A0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n+$/g, '');
};

const insertMention = (item) => {
  const editor = editorRef.value;
  if (!editor) return;
  editor.focus();
  const chip = createMentionChip(item);
  const sel = window.getSelection();
  const range = document.createRange();
  try {
    const canUseRange = mentionStartContainer.value &&
      document.contains(mentionStartContainer.value) &&
      editor.contains(sel.anchorNode);
    if (canUseRange) {
      range.setStart(mentionStartContainer.value, mentionStartOffset.value);
      range.setEnd(sel.anchorNode, sel.anchorOffset);
    } else {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    range.deleteContents();
    range.insertNode(chip);
    range.setStartAfter(chip);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    editor.appendChild(chip);
  }
  closeMentionDropdown();
  syncValueFromEditor();
  nextTick(() => {
    resizeActivityEditor();
  });
};

const selectMention = (item) => {
  insertMention(item);
};

const syncValueFromEditor = () => {
  const val = serializeEditorContent();
  if (val !== localValue.value) {
    isInternalUpdate.value = true;
    localValue.value = val;
    emit('update:modelValue', val);
    nextTick(() => { isInternalUpdate.value = false; });
  }
};

const normalizeEmptyEditorDom = () => {
  const editor = editorRef.value;
  if (!editor) return;
  const serialized = serializeEditorContent(editor);
  if (serialized) return;
  // Contenteditable may keep a <br> or empty block even when visually empty.
  // Force true-empty DOM so placeholder pseudo content can render.
  if (editor.innerHTML !== '') {
    editor.innerHTML = '';
  }
};

const getTextBeforeCursor = () => {
  const editor = editorRef.value;
  const sel = window.getSelection();
  if (!editor || !sel.rangeCount || !editor.contains(sel.anchorNode)) return '';
  try {
    const range = sel.getRangeAt(0).cloneRange();
    range.selectNodeContents(editor);
    range.setEnd(sel.anchorNode, sel.anchorOffset);
    return range.toString();
  } catch {
    return '';
  }
};

const handleInput = () => {
  normalizeEmptyEditorDom();
  syncValueFromEditor();
  resizeActivityEditor();
  if (!showMentionDropdown.value) return;
  const textBefore = getTextBeforeCursor();
  const lastAt = textBefore.lastIndexOf('@');
  if (lastAt === -1) {
    closeMentionDropdown();
    return;
  }
  const query = textBefore.substring(lastAt + 1);
  if (/\s/.test(query)) {
    closeMentionDropdown();
    return;
  }
  mentionQuery.value = query;
  mentionHighlightIndex.value = 0;
  refreshMentionStartFromCaret();
  // Wait for filtered list height to settle before measuring.
  nextTick(() => {
    updateDropdownPosition();
    requestAnimationFrame(() => updateDropdownPosition());
  });
};

const handleFocus = () => {
  isEditorFocused.value = true;
};

const scrollMentionHighlightIntoView = () => {
  nextTick(() => {
    const list = dropdownRef.value;
    if (!list) return;
    const item = list.querySelector(`[data-mention-index="${mentionHighlightIndex.value}"]`);
    if (!(item instanceof HTMLElement)) return;
    const listRect = list.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    if (itemRect.bottom > listRect.bottom) {
      list.scrollTop += itemRect.bottom - listRect.bottom;
    } else if (itemRect.top < listRect.top) {
      list.scrollTop -= listRect.top - itemRect.top;
    }
  });
};

const handleKeydown = (e) => {
  if (!e.isComposing && props.submitOnEnter && props.showSubmit && e.key === 'Enter' && !e.shiftKey && !showMentionDropdown.value) {
    e.preventDefault();
    handleSubmitClick();
    return;
  }

  if (showMentionDropdown.value && filteredMentions.value.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      mentionHighlightIndex.value = Math.min(
        mentionHighlightIndex.value + 1,
        filteredMentions.value.length - 1
      );
      scrollMentionHighlightIntoView();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      mentionHighlightIndex.value = Math.max(mentionHighlightIndex.value - 1, 0);
      scrollMentionHighlightIntoView();
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      selectMention(filteredMentions.value[mentionHighlightIndex.value]);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMentionDropdown();
      return;
    }
  }
  if (e.key === '@' && !showMentionDropdown.value) {
    setTimeout(() => {
      const sel = window.getSelection();
      if (sel.rangeCount && editorRef.value?.contains(sel.anchorNode)) {
        mentionStartContainer.value = sel.anchorNode;
        mentionStartOffset.value = Math.max(0, sel.anchorOffset - 1);
        mentionQuery.value = '';
        openMentionDropdown('caret');
      }
    }, 0);
  }
};

const closeEmojiPickerOnOutsideClick = (e) => {
  if (!showEmojiPicker.value) return;
  if (emojiPickerRef.value?.contains(e.target) || editorRef.value?.contains(e.target)) return;
  if (emojiButtonRef.value?.contains(e.target)) return;
  showEmojiPicker.value = false;
};

const syncEmojiPickerTheme = () => {
  if (typeof document === 'undefined') return;
  isDarkTheme.value = document.documentElement.classList.contains('dark');
};

const handleBlur = () => {
  isEditorFocused.value = false;
  setTimeout(() => {
    if (showMentionDropdown.value) {
      const active = document.activeElement;
      if (dropdownRef.value?.contains(active) || editorRef.value === active) return;
      closeMentionDropdown();
    }
  }, 150);
};

const focus = () => editorRef.value?.focus();

const triggerFileSelect = () => {
  fileInputRef.value?.click();
};

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'application/x-pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv'
];
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'jpeg', 'jpg', 'png', 'gif', 'webp', 'svg'];

const isFileTypeAllowed = (file) => {
  if (ALLOWED_MIME_TYPES.includes(file.type)) return true;
  // Fallback: some browsers (e.g. Safari) report empty string for PDF and other types
  if ((!file.type || file.type === '') && file.name) {
    const ext = file.name.toLowerCase().split('.').pop();
    return ALLOWED_EXTENSIONS.includes(ext);
  }
  return false;
};

const handleFileSelect = (e) => {
  const files = e.target.files ? Array.from(e.target.files) : [];
  const maxSize = 10 * 1024 * 1024; // 10MB
  for (const file of files) {
    if (file.size > maxSize) continue;
    if (!isFileTypeAllowed(file)) continue;
    if (selectedFiles.value.some(f => f.name === file.name && f.size === file.size)) continue;
    selectedFiles.value.push(file);
  }
  e.target.value = '';
};

const removeFile = (index) => {
  selectedFiles.value.splice(index, 1);
};

const removeExistingAttachment = (index) => {
  existingAttachmentsState.value.splice(index, 1);
  emit('update:existingAttachments', [...existingAttachmentsState.value]);
};

const getAttachmentName = (attachment) => {
  if (!attachment) return 'Attachment';
  return attachment.filename || attachment.name || 'Attachment';
};

const getAttachmentSize = (attachment) => {
  if (!attachment || typeof attachment !== 'object') return 0;
  return Number(attachment.size) || 0;
};

const updateEmojiPickerPosition = () => {
  if (!showEmojiPicker.value || !emojiButtonRef.value) return;
  const rect = emojiButtonRef.value.getBoundingClientRect();
  const pickerWidth = emojiPickerRef.value?.offsetWidth || 352;
  const pickerHeight = emojiPickerRef.value?.offsetHeight || 440;
  const spaceAbove = rect.top;
  const spaceBelow = window.innerHeight - rect.bottom;
  let top = 0;
  if (spaceAbove >= pickerHeight || spaceAbove >= spaceBelow) {
    top = rect.top - pickerHeight - 4;
  } else {
    top = rect.bottom + 4;
  }
  let left = rect.left;
  top = Math.max(8, Math.min(top, window.innerHeight - pickerHeight - 8));
  left = Math.max(8, Math.min(left, window.innerWidth - pickerWidth - 8));
  emojiPickerPosition.value = { top, left };
};

const toggleEmojiPicker = () => {
  showEmojiPicker.value = !showEmojiPicker.value;
  if (showEmojiPicker.value) {
    nextTick(updateEmojiPickerPosition);
  }
};

const insertEmoji = (emoji) => {
  const editor = editorRef.value;
  if (!editor) return;
  editor.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  try {
    if (sel.rangeCount) {
      range.setStart(sel.anchorNode, sel.anchorOffset);
      range.collapse(true);
    } else {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    const textNode = document.createTextNode(emoji);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    editor.appendChild(document.createTextNode(emoji));
  }
  syncValueFromEditor();
  nextTick(() => {
    resizeActivityEditor();
  });
};

const handleEmojiPickerSelect = (event) => {
  const emoji = event?.detail?.unicode || '';
  if (!emoji) return;
  insertEmoji(emoji);
  showEmojiPicker.value = false;
};

const handleSubmitClick = () => {
  const val = serializeEditorContent();
  const trimmed = val.trim();
  const hasContent = trimmed.length > 0;
  const hasFiles = selectedFiles.value.length > 0;
  const hasExistingAttachments = existingAttachmentsState.value.length > 0;
  if (hasContent || hasFiles || hasExistingAttachments) {
    emit('submit', {
      content: trimmed,
      files: [...selectedFiles.value],
      existingAttachments: [...existingAttachmentsState.value]
    });
    if (editorRef.value) {
      editorRef.value.innerHTML = '';
      localValue.value = '';
      emit('update:modelValue', '');
    }
    selectedFiles.value = [];
    nextTick(() => {
      resizeActivityEditor();
    });
  }
};

const insertAtSign = () => {
  const editor = editorRef.value;
  if (!editor) return;
  editor.focus();
  const sel = window.getSelection();
  let range;
  if (sel.rangeCount) {
    range = sel.getRangeAt(0);
  } else {
    range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(true);
  }
  const textNode = document.createTextNode('@');
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  mentionStartContainer.value = textNode;
  mentionStartOffset.value = 0;
  mentionQuery.value = '';
  openMentionDropdown('button');
  syncValueFromEditor();
  nextTick(() => {
    resizeActivityEditor();
  });
};

const getSubmitPayload = () => ({
  content: serializeEditorContent().trim(),
  files: [...selectedFiles.value],
  existingAttachments: [...existingAttachmentsState.value]
});

defineExpose({ focus, getSubmitPayload });

onMounted(() => {
  syncEmojiPickerTheme();
  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    emojiThemeObserver = new MutationObserver(() => syncEmojiPickerTheme());
    emojiThemeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  }
  window.addEventListener('scroll', updateDropdownPosition, true);
  window.addEventListener('resize', updateDropdownPosition);
  window.addEventListener('scroll', updateEmojiPickerPosition, true);
  window.addEventListener('resize', updateEmojiPickerPosition);
  window.addEventListener('resize', resizeActivityEditor);
  document.addEventListener('click', closeEmojiPickerOnOutsideClick);
  nextTick(() => {
    if (props.modelValue && editorRef.value && !editorRef.value.innerHTML) {
      editorRef.value.innerHTML = parseValueToHtml(props.modelValue);
      localValue.value = props.modelValue;
    }
    resizeActivityEditor();
    if (isActivityVariant.value && editorRef.value && 'ResizeObserver' in window) {
      const timelineRoot = editorRef.value.closest('.record-activity-timeline');
      if (timelineRoot) {
        activityContainerResizeObserver = new ResizeObserver(() => {
          resizeActivityEditor();
        });
        activityContainerResizeObserver.observe(timelineRoot);
      }
    }
  });
});

onUnmounted(() => {
  window.removeEventListener('scroll', updateDropdownPosition, true);
  window.removeEventListener('resize', updateDropdownPosition);
  window.removeEventListener('scroll', updateEmojiPickerPosition, true);
  window.removeEventListener('resize', updateEmojiPickerPosition);
  window.removeEventListener('resize', resizeActivityEditor);
  document.removeEventListener('click', closeEmojiPickerOnOutsideClick);
  if (emojiThemeObserver) {
    emojiThemeObserver.disconnect();
    emojiThemeObserver = null;
  }
  if (activityContainerResizeObserver) {
    activityContainerResizeObserver.disconnect();
    activityContainerResizeObserver = null;
  }
});
</script>

<style scoped>
.comment-input-emoji-picker {
  --input-border-color: rgb(99 102 241 / 0.45);
  --input-border-radius: 12px;
  --outline-color: rgb(99 102 241 / 0.2);
  --indicator-color: rgb(99 102 241);
  --category-font-size: 15px;
  --button-active-background: rgb(99 102 241 / 0.16);
}

.comment-input-emoji-picker.light {
  --background: #ffffff;
  --border-color: #e5e7eb;
  --text-color: #111827;
  --input-background: #ffffff;
  --input-font-color: #111827;
}

.comment-input-emoji-picker.dark {
  --background: #111827;
  --border-color: #374151;
  --text-color: #f9fafb;
  --input-background: #111827;
  --input-font-color: #f9fafb;
}
</style>
