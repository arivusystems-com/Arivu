import type { ComputedRef, Ref, WritableComputedRef } from 'vue';

/**
 * JSDoc mirror for `useRecordTags.js` so Vue SFC + vue-tsc resolve types.
 */
export interface TagColorOption {
  key: string;
  chipClass: string;
  dotClass: string;
  swatchClass: string;
}

export interface TagDefinition {
  name: string;
  color: string;
  isPublic: boolean;
}

export interface TagEditorState {
  name: string;
  color: string;
  isPublic: boolean;
}

export interface UseRecordTagsOptions {
  tagStorageKey?: unknown;
  canEdit?: unknown;
  persistTags: (nextTagNames: string[]) => void | Promise<void>;
  instanceTagSource?: unknown;
  fetchRecord?: () => void | Promise<void>;
}

export interface UseRecordTagsResult {
  TAG_COLOR_OPTIONS: TagColorOption[];
  tagSearchInputRef: Ref<HTMLElement | null>;
  tagListOpen: Ref<boolean>;
  tagSearchQuery: Ref<string>;
  instanceTagDefinitions: WritableComputedRef<TagDefinition[]>;
  tagEditorMode: Ref<string>;
  editingTagName: Ref<string>;
  isSavingTagState: Ref<boolean>;
  tagSaveError: Ref<string>;
  tagEditor: Ref<TagEditorState>;
  hasRecordTags: ComputedRef<boolean>;
  hasInstanceTags: ComputedRef<boolean>;
  normalizedTagSearch: ComputedRef<string>;
  filteredInstanceTags: ComputedRef<TagDefinition[]>;
  canCreateTagFromSearch: ComputedRef<boolean>;
  hasPendingTagRemoval: ComputedRef<boolean>;
  pendingTagRemovalTagName: ComputedRef<string>;
  pendingTagRemovalSecondsLeft: Ref<number>;
  isTagEditorOpen: ComputedRef<boolean>;
  canSaveTagEditor: ComputedRef<boolean>;
  getTagChipClass: (tagNameOrObject: unknown) => string;
  getTagDotClass: (tagNameOrObject: unknown) => string;
  openCreateTagEditor: (prefill?: string) => void;
  openEditTagEditor: (tagDef?: { name?: string; color?: string; isPublic?: boolean } | null) => void;
  getTagDefinitionByName: (tagName: string) => TagDefinition | null;
  deleteTagDefinition: (tagName: string) => Promise<void>;
  closeTagEditor: () => void;
  saveTagEditor: () => Promise<void>;
  deleteEditingTag: () => Promise<void>;
  toggleTagForRecord: (tagName: string) => Promise<void>;
  removeTagFromRecord: (tagName: string) => Promise<void>;
  undoPendingTagRemoval: () => void;
  handleTagSearchBlur: () => void;
  resetOnClose: () => void;
  fetchInstanceTagDefinitions: () => Promise<void>;
}

export function useRecordTags<T extends { tags?: string[] }>(
  recordRef: Ref<T>,
  options: UseRecordTagsOptions
): UseRecordTagsResult;

export function getDefaultTagChipClass(tagNameOrObject: unknown): string;
export function getDefaultTagDotClass(tagNameOrObject: unknown): string;
