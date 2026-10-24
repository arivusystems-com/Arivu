<!--
  Tags picker for forms (create/edit drawers) — same behavior as record RecordTagPopover:
  colored chips/dots, New Tag + color editor, search, instance list, create from search.
-->
<template>
  <div class="relative">
    <div
      :class="[
        'w-full min-h-[2.5rem] rounded-lg border text-sm transition-[border-color,box-shadow]',
        disabled
          ? 'border-gray-200 bg-gray-50 text-gray-500 opacity-60 cursor-not-allowed dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400'
          : 'border-gray-200 bg-white text-gray-900 cursor-pointer dark:border-gray-600 dark:bg-gray-900/80 dark:text-white',
        !disabled && panelOpen
          ? 'border-indigo-500 ring-2 ring-indigo-500/20 dark:border-indigo-400 dark:ring-indigo-400/20'
          : !disabled
            ? 'hover:border-gray-300 dark:hover:border-gray-500 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:focus-within:border-indigo-400'
            : ''
      ]"
      @click.stop="!disabled && togglePanel()"
    >
      <div class="flex flex-wrap items-center gap-2 px-3 py-2.5 min-h-[2.5rem]">
        <template v-if="draftRecord.tags?.length">
          <span
            v-for="tagName in draftRecord.tags"
            :key="`sel-${tagName}`"
            :class="['inline-flex items-center gap-1 rounded px-2 py-1 text-sm leading-none', getTagChipClass(tagName)]"
          >
            <span class="truncate max-w-[200px]">{{ tagName }}</span>
            <button
              v-if="!disabled"
              type="button"
              class="rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
              :aria-label="t('common.tagsRemoveTag')"
              @click.stop="toggleTagForRecord(tagName)"
            >
              <XMarkIcon class="h-3.5 w-3.5" />
            </button>
          </span>
        </template>
        <span v-else class="text-gray-400 dark:text-gray-500 text-sm px-0.5">
          {{ placeholder }}
        </span>
      </div>
    </div>

    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="panelOpen && !disabled"
        v-click-outside="closePanel"
        class="absolute z-[100] mt-1 w-full max-h-[min(70vh,420px)] rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-xl ring-1 ring-black/5 dark:ring-white/10 flex flex-col overflow-hidden"
        @click.stop
      >
        <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('common.tagsTitle') }}</h3>
            <button
              v-if="canEdit"
              type="button"
              class="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              @click="openCreateTagEditor()"
            >
              {{ t('common.tagsNewTag') }}
            </button>
          </div>
          <div class="mt-2">
            <input
              ref="tagSearchInputRef"
              v-model="tagSearchQuery"
              type="text"
              :placeholder="t('common.tagsSearchPlaceholder')"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              @focus="tagListOpen = true"
              @click="tagListOpen = true"
              @blur="handleTagSearchBlur"
            />
            <p v-if="tagSaveError" class="mt-1.5 text-xs text-red-600 dark:text-red-400">{{ tagSaveError }}</p>
          </div>
        </div>

        <div class="overflow-y-auto flex-1 min-h-0 px-2 py-2">
          <div
            v-if="hasPendingTagRemoval"
            class="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200"
          >
            <div class="flex items-center justify-between gap-2">
              <span>{{ t('common.tagsRemovedNamed', { name: pendingTagRemovalTagName }) }}</span>
              <button type="button" class="font-medium hover:underline" @click="undoPendingTagRemoval">
                {{ t('common.tagsUndoSeconds', { seconds: pendingTagRemovalSecondsLeft }) }}
              </button>
            </div>
          </div>

          <div v-if="!tagListOpen && !isTagEditorOpen" class="px-2 py-2 text-sm text-gray-500 dark:text-gray-400">
            {{ t('common.tagsClickSearchHint') }}
          </div>

          <div v-else-if="!hasInstanceTags && !isTagEditorOpen" class="px-2 py-2 text-sm text-gray-500 dark:text-gray-400">
            <p>{{ t('common.tagsNoTagsYet') }}</p>
            <button
              v-if="canEdit"
              type="button"
              class="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              @click="openCreateTagEditor(tagSearchQuery)"
            >
              {{ t('common.tagsCreateFirst') }}
            </button>
          </div>

          <template v-else-if="!isTagEditorOpen">
            <button
              v-if="canCreateTagFromSearch && canEdit"
              type="button"
              class="w-full rounded-lg px-3 py-2 text-left text-sm text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
              @click="openCreateTagEditor(tagSearchQuery)"
            >
              {{ t('common.tagsCreateNamed', { name: normalizedTagSearch }) }}
            </button>

            <div
              v-for="tagDef in filteredInstanceTags"
              :key="tagDef.name"
              class="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <button
                type="button"
                class="min-w-0 flex-1 flex items-center gap-2 text-left"
                @click="canEdit && toggleTagForRecord(tagDef.name)"
              >
                <span :class="['h-2.5 w-2.5 rounded-full shrink-0', getTagDotClass(tagDef.name)]" />
                <span class="flex-1 truncate text-sm text-gray-900 dark:text-white">{{ tagDef.name }}</span>
                <span
                  v-if="tagDef.isPublic"
                  class="rounded px-1.5 py-0.5 text-[10px] font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                >
                  {{ t('common.tagsPublic') }}
                </span>
                <CheckIcon
                  v-if="isTagAssigned(tagDef.name)"
                  class="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400"
                />
              </button>
              <button
                v-if="canEdit"
                type="button"
                class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
                @click.stop="openEditTagEditor(tagDef)"
                :aria-label="t('common.tagsEditTag')"
              >
                <PencilSquareIcon class="w-4 h-4" />
              </button>
              <Menu v-if="canEdit" as="div" class="relative shrink-0">
                <MenuButton
                  type="button"
                  class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  @click.stop
                  @click="prepareMenuPlacement(`list-${tagDef.name}`, $event)"
                  :aria-label="t('common.tagsTagActions')"
                >
                  <EllipsisVerticalIcon class="w-4 h-4" />
                </MenuButton>
                <transition
                  enter-active-class="transition ease-out duration-100"
                  enter-from-class="transform opacity-0 scale-95"
                  enter-to-class="transform opacity-100 scale-100"
                  leave-active-class="transition ease-in duration-75"
                  leave-from-class="transform opacity-100 scale-100"
                  leave-to-class="transform opacity-0 scale-95"
                >
                  <MenuItems :class="menuItemsClass(`list-${tagDef.name}`)">
                    <MenuItem v-slot="{ active }">
                      <button
                        type="button"
                        :class="['w-full px-3 py-1.5 text-left text-xs text-gray-900 dark:text-gray-100', active ? 'bg-gray-100 dark:bg-gray-800' : '']"
                        @click.stop="toggleTagForRecord(tagDef.name)"
                      >
                        {{ isTagAssigned(tagDef.name) ? t('common.tagsRemoveFromSelection') : t('common.tagsAddToSelection') }}
                      </button>
                    </MenuItem>
                    <MenuItem v-slot="{ active }">
                      <button
                        type="button"
                        :class="['w-full px-3 py-1.5 text-left text-xs text-gray-900 dark:text-gray-100', active ? 'bg-gray-100 dark:bg-gray-800' : '']"
                        @click.stop="openTagEditorByName(tagDef.name)"
                      >
                        {{ t('common.tagsEditTag') }}
                      </button>
                    </MenuItem>
                    <MenuItem v-slot="{ active }">
                      <button
                        type="button"
                        :class="['w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400', active ? 'bg-gray-100 dark:bg-gray-800' : '']"
                        @click.stop="handleDeleteTagDefinition(tagDef.name)"
                      >
                        {{ t('common.tagsDeleteFromModule') }}
                      </button>
                    </MenuItem>
                  </MenuItems>
                </transition>
              </Menu>
            </div>
          </template>

          <template v-else>
            <div class="px-2 py-2 space-y-3">
              <div>
                <label class="text-xs text-gray-500 dark:text-gray-400">{{ t('common.tagsTagName') }}</label>
                <input
                  v-model="tagEditor.name"
                  type="text"
                  maxlength="50"
                  class="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  :placeholder="t('common.tagsEnterTagName')"
                />
              </div>
              <div>
                <label class="text-xs text-gray-500 dark:text-gray-400">{{ t('common.tagsColor') }}</label>
                <div class="mt-1 flex items-center gap-2 flex-wrap">
                  <button
                    v-for="option in TAG_COLOR_OPTIONS"
                    :key="option.key"
                    type="button"
                    :class="[
                      'h-6 w-6 rounded-full border-2 transition-colors',
                      option.swatchClass,
                      tagEditor.color === option.key ? 'border-gray-900 dark:border-white' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-500'
                    ]"
                    @click="tagEditor.color = option.key"
                  />
                </div>
              </div>
              <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <HeadlessCheckbox v-model="tagEditor.isPublic" checkbox-class="h-4 w-4" />
                {{ t('common.tagsMakePublic') }}
              </label>
              <div class="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  class="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  @click="closeTagEditor"
                >
                  {{ t('actions.cancel') }}
                </button>
                <button
                  type="button"
                  class="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="!canSaveTagEditor || isSavingTagState"
                  @click="saveTagEditor"
                >
                  {{ tagEditorMode === 'create' ? t('actions.create') : t('actions.save') }}
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import type { Directive, DirectiveBinding } from 'vue';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { CheckIcon, PencilSquareIcon, EllipsisVerticalIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { useAuthStore } from '@/stores/authRegistry';
import { useRecordTags } from '@/composables/useRecordTags';

type ClickOutsideHandler = (e: Event) => void;
interface ElWithOutside extends HTMLElement {
  clickOutsideEvent?: (e: PointerEvent) => void;
}

const vClickOutside: Directive<ElWithOutside, ClickOutsideHandler> = {
  mounted(el, binding: DirectiveBinding<ClickOutsideHandler>) {
    el.clickOutsideEvent = (event: PointerEvent) => {
      setTimeout(() => {
        if (!document.contains(el)) return;
        const container = el.closest('.relative');
        if (!container) return;
        const t = event.target;
        if (!(t instanceof Node)) return;
        if (!(container === t || container.contains(t))) {
          binding.value(event);
        }
      }, 10);
    };
    document.addEventListener('pointerdown', el.clickOutsideEvent, true);
  },
  unmounted(el: ElWithOutside) {
    if (el.clickOutsideEvent) {
      document.removeEventListener('pointerdown', el.clickOutsideEvent, true);
    }
  }
};

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  moduleKey: { type: String, default: 'people' },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Select tags…' }
});

const emit = defineEmits(['update:modelValue', 'blur']);

const authStore = useAuthStore();

const draftRecord = ref<{ _id: string; tags: string[] }>({
  _id: '__form-tags__',
  tags: []
});

watch(
  () => props.modelValue,
  (v: unknown) => {
    draftRecord.value.tags = Array.isArray(v) ? (v as string[]).map((x) => String(x)) : [];
  },
  { immediate: true, deep: true }
);

const tagStorageKey = computed(() => {
  const organizationId = authStore.user?.organizationId || authStore.organization?._id || 'default-org';
  const mk = String(props.moduleKey || 'people').toLowerCase();
  return `arivu-${mk}-tag-definitions-${organizationId}`;
});

/** Must match server module keys for /modules/:moduleKey/tags/delete and list APIs in useRecordTags */
const instanceTagSource = computed(() => {
  const m = String(props.moduleKey || 'people').toLowerCase();
  if (m === 'organization' || m === 'organizations') return 'organizations';
  return m;
});

const canEdit = computed(() => !props.disabled);

const persistTags = async (cleaned: string[]) => {
  emit('update:modelValue', cleaned);
};

const tagState = useRecordTags(draftRecord, {
  tagStorageKey,
  canEdit,
  persistTags,
  instanceTagSource,
  fetchRecord: () => Promise.resolve()
});

const {
  TAG_COLOR_OPTIONS,
  tagSearchInputRef,
  tagListOpen,
  tagSearchQuery,
  tagEditorMode,
  isSavingTagState,
  tagSaveError,
  tagEditor,
  hasInstanceTags,
  normalizedTagSearch,
  filteredInstanceTags,
  canCreateTagFromSearch,
  hasPendingTagRemoval,
  pendingTagRemovalTagName,
  pendingTagRemovalSecondsLeft,
  isTagEditorOpen,
  canSaveTagEditor,
  getTagChipClass,
  getTagDotClass,
  openCreateTagEditor,
  openEditTagEditor,
  getTagDefinitionByName,
  deleteTagDefinition,
  closeTagEditor,
  saveTagEditor,
  toggleTagForRecord,
  undoPendingTagRemoval,
  handleTagSearchBlur,
  resetOnClose,
  fetchInstanceTagDefinitions
} = tagState;

const isTagAssigned = (tagName: string) =>
  Array.isArray(draftRecord.value?.tags) && draftRecord.value.tags.includes(tagName);

const openTagEditorByName = (tagName: string) => {
  const tagDef = getTagDefinitionByName(tagName);
  if (tagDef) {
    openEditTagEditor(tagDef);
  } else {
    openCreateTagEditor(tagName);
  }
};

const handleDeleteTagDefinition = async (tagName: string) => {
  await deleteTagDefinition(tagName);
};

const menuDirectionByKey = ref<Record<string, 'up' | 'down'>>({});
const prepareMenuPlacement = (menuKey: string, event: Event) => {
  const target = event?.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  const rect = target.getBoundingClientRect();
  const estimatedMenuHeight = 156;
  const roomAbove = rect.top;
  const roomBelow = window.innerHeight - rect.bottom;
  const direction = roomAbove >= estimatedMenuHeight || roomAbove >= roomBelow ? 'up' : 'down';
  menuDirectionByKey.value = { ...menuDirectionByKey.value, [menuKey]: direction as 'up' | 'down' };
};

const menuItemsClass = (menuKey: string) => {
  const direction = menuDirectionByKey.value[menuKey] || 'up';
  return [
    'absolute right-0 z-[220] w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900',
    direction === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'
  ];
};

const panelOpen = ref(false);

const togglePanel = () => {
  panelOpen.value = !panelOpen.value;
};

const closePanel = () => {
  if (!panelOpen.value) return;
  panelOpen.value = false;
  resetOnClose();
  emit('blur');
};

watch(panelOpen, async (open) => {
  if (open) {
    tagListOpen.value = true;
    await fetchInstanceTagDefinitions();
    await nextTick();
    try {
      tagSearchInputRef.value?.focus?.();
    } catch {
      /* noop */
    }
  }
});
</script>
