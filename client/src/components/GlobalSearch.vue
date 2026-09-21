<template>
  <TransitionRoot :show="isOpen" as="template" appear @after-leave="onPaletteAfterLeave">
    <Dialog class="relative z-50" :initial-focus="searchInputRef" @close="close">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/25 transition-opacity dark:bg-gray-900/50" aria-hidden="true" />
      </TransitionChild>

      <div class="fixed inset-0 z-10 w-screen overflow-y-auto p-4 sm:p-6 md:p-20">
        <TransitionChild
          as="template"
          enter="ease-out duration-300"
          enter-from="opacity-0 scale-95"
          enter-to="opacity-100 scale-100"
          leave="ease-in duration-200"
          leave-from="opacity-100 scale-100"
          leave-to="opacity-0 scale-95"
        >
          <DialogPanel
            class="mx-auto max-w-2xl transform divide-y divide-gray-500/10 overflow-hidden rounded-xl bg-white/80 shadow-2xl outline outline-1 -outline-offset-1 outline-black/5 backdrop-blur-sm transition-all dark:divide-white/10 dark:bg-gray-900/80 dark:outline-white/10"
          >
            <Combobox
              nullable
              :model-value="null"
              @update:model-value="onComboboxPaletteSelect"
            >
              <div class="grid grid-cols-1">
                <ComboboxInput
                  :ref="bindSearchInputRef"
                  data-global-search-input
                  class="col-start-1 row-start-1 h-12 w-full border-0 bg-transparent pr-4 pl-11 text-base text-gray-900 outline-none placeholder:text-gray-500 focus:ring-0 dark:text-white dark:placeholder:text-gray-400 sm:text-sm"
                  :placeholder="t('navigation.globalSearchPlaceholder')"
                  :display-value="() => searchQuery"
                  autocomplete="off"
                  autocorrect="off"
                  spellcheck="false"
                  @change="onSearchInputChange"
                  @keydown.esc.stop="handleEscape"
                  @keydown.down.prevent="movePaletteHighlight(1)"
                  @keydown.up.prevent="movePaletteHighlight(-1)"
                  @keydown.enter="onComboboxEnter"
                />
                <MagnifyingGlassIcon
                  v-if="mode === 'search'"
                  class="pointer-events-none col-start-1 row-start-1 ml-4 size-5 self-center text-gray-900/40 dark:text-gray-400"
                  aria-hidden="true"
                />
                <CommandLineIcon
                  v-else
                  class="pointer-events-none col-start-1 row-start-1 ml-4 size-5 self-center text-gray-900/40 dark:text-gray-400"
                  aria-hidden="true"
                />
              </div>

              <!-- Loading -->
              <div v-if="loading" class="px-6 py-14 text-center">
                <div class="mx-auto size-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900 dark:border-gray-700 dark:border-t-white" />
                <p class="mt-4 text-sm text-gray-900 dark:text-gray-200">{{ t('navigation.globalSearchSearching') }}</p>
              </div>

              <!-- Destructive confirmation -->
              <div v-else-if="pendingDestructiveCommand" class="px-6 py-14 text-center">
                <p class="text-sm font-semibold text-gray-900 dark:text-white">
                  {{ t('navigation.globalSearchConfirmTitle') }}
                </p>
                <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
                  {{ pendingDestructiveCommand.label }}
                </p>
                <p class="mt-6 text-xs text-gray-500 dark:text-gray-400">
                  <kbd class="rounded border border-gray-300 bg-white px-1.5 py-0.5 font-sans dark:border-gray-600 dark:bg-gray-800">esc</kbd>
                  {{ ' ' }}{{ t('navigation.globalSearchToCancel') }}{{ ' · ' }}
                  <kbd class="rounded border border-gray-300 bg-white px-1.5 py-0.5 font-sans dark:border-gray-600 dark:bg-gray-800">↵</kbd>
                  {{ ' ' }}{{ t('navigation.globalSearchToConfirm') }}
                </p>
              </div>

              <!-- No matches -->
              <div v-else-if="showNoMatches" class="px-6 py-14 text-center sm:px-14">
                <MagnifyingGlassIcon class="mx-auto size-6 text-gray-900/40 dark:text-gray-500" aria-hidden="true" />
                <p class="mt-4 text-sm text-gray-900 dark:text-gray-200">
                  {{ mode === 'command' ? t('navigation.globalSearchNoCommands') : t('navigation.globalSearchNoResults') }}
                </p>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {{ mode === 'command' ? t('navigation.globalSearchNoCommandsHint') : t('navigation.globalSearchNoResultsHint') }}
                </p>
              </div>

              <ComboboxOptions
                v-else-if="showComboboxOptions"
                static
                as="ul"
                class="max-h-80 scroll-py-2 overflow-y-auto p-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <template v-for="row in paletteRows" :key="row.key">
                  <li
                    v-if="row.kind === 'header-recent'"
                    :class="[
                      'mb-2 flex items-center justify-between px-3',
                      row.gapBefore ? 'mt-2.5 border-t border-gray-500/10 pt-2.5 dark:border-white/10' : ''
                    ]"
                    role="presentation"
                  >
                    <h2 class="text-xs font-semibold text-gray-900 dark:text-gray-200">
                      {{ t('navigation.globalSearchRecentSearches') }}
                    </h2>
                    <button
                      type="button"
                      class="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      @mousedown.prevent
                      @click="clearRecentSearches"
                    >
                      {{ t('navigation.globalSearchClearRecent') }}
                    </button>
                  </li>
                  <li
                    v-else-if="row.kind === 'header'"
                    role="presentation"
                    :class="
                      row.srOnly
                        ? 'sr-only'
                        : [
                            'px-3 py-1.5 text-xs font-semibold text-gray-900 dark:text-gray-200',
                            row.gapBefore ? 'mt-2.5 border-t border-gray-500/10 pt-2.5 dark:border-white/10' : ''
                          ]
                    "
                  >
                    {{ row.label }}
                  </li>
                  <ComboboxOption
                    v-else
                    :value="row.value"
                    as="template"
                    v-slot="{ active: _comboboxActive }"
                  >
                    <li
                      :class="comboboxRowClass(isPaletteRowActive(row.index))"
                      :data-palette-option-index="row.index"
                      :aria-selected="isPaletteRowActive(row.index)"
                      @pointerdown="palettePointerSelect = true"
                      @mouseenter="highlightedIndex = row.index"
                    >
                      <template v-if="row.variant === 'recent' && row.entry">
                        <Avatar
                          v-bind="getRecentSearchAvatarProps(row.entry)"
                          size="sm"
                          class="shrink-0"
                        />
                        <span class="ml-3 flex-auto truncate">{{ row.entry.label }}</span>
                      </template>
                      <template v-else-if="row.variant === 'command' && row.command">
                        <component
                          :is="getCommandIconComponent(row.command)"
                          :class="comboboxIconClass(isPaletteRowActive(row.index))"
                          aria-hidden="true"
                        />
                        <span class="ml-3 min-w-0 flex-auto">
                          <span class="block truncate">{{ row.command.label }}</span>
                          <span
                            v-if="row.command.description"
                            class="block truncate text-xs text-gray-500 dark:text-gray-400"
                          >
                            {{ row.command.description }}
                          </span>
                        </span>
                      </template>
                      <template v-else-if="row.variant === 'search' && row.result">
                        <Avatar
                          v-bind="getSearchResultAvatarProps(row.result)"
                          size="sm"
                          class="shrink-0"
                        />
                        <span class="ml-3 min-w-0 flex-auto">
                          <span class="block truncate">{{ row.result.title }}</span>
                          <span
                            v-if="row.result.subtitle"
                            class="block truncate text-xs text-gray-500 dark:text-gray-400"
                          >
                            {{ row.result.subtitle }}
                          </span>
                        </span>
                      </template>
                      <span
                        v-if="isPaletteRowActive(row.index)"
                        class="ml-3 flex-none text-gray-500 dark:text-gray-400"
                      >
                        {{ t('navigation.globalSearchJumpTo') }}
                      </span>
                    </li>
                  </ComboboxOption>
                </template>
              </ComboboxOptions>

              <!-- Empty hint -->
              <div v-else-if="showEmptyHint" class="px-6 py-14 text-center sm:px-14">
                <CommandLineIcon class="mx-auto size-6 text-gray-900/40 dark:text-gray-500" aria-hidden="true" />
                <p class="mt-4 text-sm text-gray-900 dark:text-gray-200">
                  {{ mode === 'command' ? t('navigation.globalSearchTypeToFind') : t('navigation.globalSearchStartTyping') }}
                </p>
                <p
                  v-if="mode === 'search' && !hasUsedCommandTrigger"
                  class="mt-2 text-sm text-gray-500 dark:text-gray-400"
                >
                  {{ t('navigation.globalSearchSlashHint') }}
                </p>
              </div>
            </Combobox>

            <!-- Footer: keyboard shortcuts -->
            <div
              v-if="!pendingDestructiveCommand"
              class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400"
            >
              <span class="inline-flex items-center gap-1.5">
                <kbd class="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-sans dark:border-gray-600 dark:bg-gray-900">↑</kbd>
                <kbd class="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-sans dark:border-gray-600 dark:bg-gray-900">↓</kbd>
                <span>{{ t('navigation.globalSearchFooterNavigate') }}</span>
              </span>
              <span class="inline-flex items-center gap-1.5">
                <kbd class="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-sans dark:border-gray-600 dark:bg-gray-900">↵</kbd>
                <span>{{ t('navigation.globalSearchFooterSelect') }}</span>
              </span>
              <span class="inline-flex items-center gap-1.5">
                <kbd class="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-sans dark:border-gray-600 dark:bg-gray-900">esc</kbd>
                <span>{{ t('navigation.globalSearchFooterClose') }}</span>
              </span>
              <span
                v-if="mode === 'search' && !hasUsedCommandTrigger"
                class="inline-flex items-center gap-1.5"
              >
                <kbd class="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-sans dark:border-gray-600 dark:bg-gray-900">/</kbd>
                <span>{{ t('navigation.globalSearchFooterCommands') }}</span>
              </span>
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>

    <!-- Link Records Drawer (for action commands) -->
    <LinkRecordsDrawer
      :isOpen="showLinkDrawer"
      :moduleKey="linkDrawerModuleKey"
      :multiple="true"
      :title="linkDrawerTitle"
      :context="linkDrawerContext"
      :allowCreate="linkDrawerAllowCreate"
      @close="handleLinkDrawerClose"
      @linked="handleLinkDrawerLinked"
      @create="handleLinkDrawerCreate"
    />

    <!-- Organization Quick Create Drawer (dedicated Quick Create flow) -->
    <!-- People Quick Create Drawer -->
    <!-- ARCHITECTURAL INTENT: Opens in same tab, not navigating to new route -->
    <PeopleQuickCreateDrawer
      :isOpen="showPeopleDrawer"
      :context-app-key="peopleDrawerContextAppKey"
      @close="handlePeopleDrawerClose"
      @saved="handlePeopleDrawerSaved"
    />
    
    <!-- Event Quick Create Drawer -->
    <!-- ARCHITECTURAL INTENT: Opens in same tab, not navigating to new route -->
    <EventQuickCreateDrawer
      :isOpen="showEventDrawer"
      @close="handleEventDrawerClose"
      @saved="handleEventDrawerSaved"
    />
    
    <!-- ARCHITECTURAL INTENT: Organization Quick Create is separate from full create/edit flows -->
    <!-- It strictly respects Settings → Core Modules → Organizations → Quick Create configuration -->
    <!-- Command palette actions must NEVER navigate to list views - they open this Quick Create flow -->
    <OrganizationQuickCreateDrawer
      v-if="createDrawerModuleKey === 'organizations'"
      :isOpen="showCreateDrawer && createDrawerModuleKey === 'organizations'"
      :initialData="createDrawerInitialData"
      :autoLinkContext="createDrawerAutoLinkContext"
      @close="handleCreateDrawerClose"
      @saved="handleCreateDrawerSaved"
    />
    
    <!-- Create Record Drawer (for other modules) -->
    <CreateRecordDrawer
      v-else-if="createDrawerModuleKey && createDrawerModuleKey !== 'organizations'"
      :isOpen="showCreateDrawer && createDrawerModuleKey !== 'organizations'"
      :moduleKey="createDrawerModuleKey"
      :initialData="createDrawerInitialData"
      :lockedFields="createDrawerLockedFields"
      :title="createDrawerTitle"
      @close="handleCreateDrawerClose"
      @saved="handleCreateDrawerSaved"
    />
  </template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { MagnifyingGlassIcon } from '@heroicons/vue/20/solid';
import { CommandLineIcon } from '@heroicons/vue/24/outline';
import Avatar from '@/components/common/Avatar.vue';
import {
  getCommandIconComponent,
  getRecentSearchAvatarProps,
  getSearchResultAvatarProps,
  searchResultModuleKey
} from '@/utils/commandPalettePresentation';
import {
  Combobox,
  ComboboxInput,
  ComboboxOptions,
  ComboboxOption,
  Dialog,
  DialogPanel,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue';
import { useRecentSearches, type RecentSearchEntry } from '@/composables/useRecentSearches';
import { useFrequentModules } from '@/composables/useFrequentModules';
import { useTabs } from '@/composables/useTabs';
import { useActiveSurface } from '@/composables/useActiveSurface';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import { useCommandPaletteCommands } from '@/composables/useCommandPaletteCommands';
import { settingsCommandSortOrder } from '@/utils/buildSettingsPaletteCommands';
import type { CommandPaletteItem, CommandContext, NavigationUtilities } from '@/types/commandPalette.types';
import LinkRecordsDrawer from '@/components/common/LinkRecordsDrawer.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import OrganizationQuickCreateDrawer from '@/components/organizations/OrganizationQuickCreateDrawer.vue';
import PeopleQuickCreateDrawer from '@/components/people/PeopleQuickCreateDrawer.vue';
import EventQuickCreateDrawer from '@/components/events/EventQuickCreateDrawer.vue';

type GroupKey = 'people' | 'organizations' | 'work' | 'configuration';

type SearchResultItem = {
  id: string;
  type: string;
  route?: string;
  title?: string;
  subtitle?: string;
  avatar?: string | null;
  first_name?: string;
  last_name?: string;
  [key: string]: any;
};

type BackendSearchResults = {
  people?: SearchResultItem[];
  organizations?: SearchResultItem[];
  deals?: SearchResultItem[];
  tasks?: SearchResultItem[];
  events?: SearchResultItem[];
  forms?: SearchResultItem[];
  items?: SearchResultItem[];
  [key: string]: SearchResultItem[] | undefined;
};

type SearchResponseData = {
  total?: number;
  results?: BackendSearchResults;
};

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  initialMode: {
    type: String as () => 'search' | 'command',
    default: 'search'
  }
});

const emit = defineEmits(['close', 'open']);

const { t } = useI18n();
const router = useRouter();
const { openTab } = useTabs();
const { allCommands: platformCommands, reloadCommands: reloadPaletteCommands } = useCommandPaletteCommands();
const { activeSurface } = useActiveSurface();
const authStore = useAuthStore();

const searchInputRef = ref<HTMLInputElement | null>(null);

function resolveSearchInputElement(el: unknown): HTMLInputElement | null {
  if (!el) return null;
  if (el instanceof HTMLInputElement) return el;
  const root = (el as { $el?: unknown }).$el ?? el;
  if (root instanceof HTMLInputElement) return root;
  if (root instanceof HTMLElement) {
    const input = root.querySelector('input');
    if (input instanceof HTMLInputElement) return input;
  }
  return null;
}

const bindSearchInputRef = (el: unknown) => {
  searchInputRef.value = resolveSearchInputElement(el);
};

const focusSearchInput = () => {
  nextTick(() => {
    if (typeof searchInputRef.value?.focus === 'function') {
      searchInputRef.value.focus();
      return;
    }
    const fallback = document.querySelector<HTMLInputElement>('[data-global-search-input]');
    fallback?.focus();
  });
};
const searchQuery = ref('');
const loading = ref(false);
const searchResults = ref<SearchResponseData | null>(null);
const highlightedIndex = ref(-1);
/** True only for explicit pointer clicks — blocks Headless UI stale Enter selections. */
const palettePointerSelect = ref(false);

type PaletteItem = {
  key: string;
  kind: 'recent' | 'command' | 'search';
  recent?: RecentSearchEntry;
  command?: CommandPaletteItem;
  search?: SearchResultItem;
};

const {
  recentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  reloadRecentSearches
} = useRecentSearches();

const {
  frequentModuleIds,
  recordFrequentModule,
  reloadFrequentModules
} = useFrequentModules();

// Track if user has used "/" in this session (for discoverability hint)
const hasUsedCommandTrigger = ref(false);

// Link drawer state (for action commands)
const showLinkDrawer = ref(false);
const linkDrawerModuleKey = ref('');
const linkDrawerTitle = ref('');
const linkDrawerContext = ref<Record<string, any>>({});
const linkDrawerAllowCreate = ref(false);

// Create drawer state (for create action commands)
const showCreateDrawer = ref(false);
const showPeopleDrawer = ref(false);
const peopleDrawerContextAppKey = ref<string | null>(null);
const showEventDrawer = ref(false);
const createDrawerModuleKey = ref('');
const createDrawerInitialData = ref<Record<string, any>>({});
const createDrawerTitle = ref('');
const createDrawerLockedFields = ref<string[]>([]);
const createDrawerAutoLinkContext = ref<Record<string, any> | null>({});

// Confirmation state for destructive commands
// See: docs/architecture/command-palette-invariants.md
// 
// WHY CONFIRMATION IS RARE AND INTENTIONAL:
// 
// Command Palette is designed for fast, keyboard-first action execution.
// Most commands are navigation or creation actions that are:
// - Reversible (navigation can be undone with back button)
// - Non-destructive (creating new entities doesn't delete data)
// - Explicit user intent (user typed command name, not accidental)
// 
// Confirmation adds friction and slows down the "fast action execution"
// principle. Therefore, confirmation is ONLY used for:
// - Commands that permanently delete data
// - Commands that cannot be undone
// - Commands that have significant consequences
// 
// Most commands should NOT be destructive. If a command requires confirmation,
// consider whether it belongs in Command Palette at all, or if it should be
// moved to a dedicated surface with proper safety mechanisms.
const pendingDestructiveCommand = ref<CommandPaletteItem | null>(null);

// Mode system: Search and Command Palette share a UI shell but are separate modes
// See: docs/architecture/command-palette-invariants.md
// 
// Why modes exist:
// - Search returns entities for browsing (People, Orgs, Work)
// - Command Palette executes actions (navigation, creation)
// - These are fundamentally different mental models and must not be mixed
// - Mixing would create cognitive load and violate the "calm, scannable" principle
const mode = ref<'search' | 'command'>('search');

// Priority order for result groups (primary nouns first)
const GROUP_PRIORITY_ORDER: GroupKey[] = ['people', 'organizations', 'work', 'configuration'];

// Debounce search
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

const totalResults = computed(() => {
  if (!searchResults.value) return 0;
  return searchResults.value.total || 0;
});

// Transform backend results into human-centric UX categories
const groupedResults = computed(() => {
  if (!searchResults.value || !searchResults.value.results) {
    return {
      people: [],
      organizations: [],
      work: [],
      configuration: []
    };
  }

  const backendResults = searchResults.value.results;
  
  // Group into UX categories (preserving backend order within each group)
  return {
    people: backendResults.people || [],
    organizations: backendResults.organizations || [],
    work: [
      ...(backendResults.deals || []),
      ...(backendResults.tasks || []),
      ...(backendResults.events || []),
      ...(backendResults.learningCourses || [])
    ],
    configuration: [
      ...(backendResults.forms || []),
      ...(backendResults.items || [])
    ]
  };
});

// Get groups in priority order (only non-empty groups)
// Configuration group is shown only when query >= 4 chars OR user is admin
const prioritizedGroups = computed(() => {
  const shouldShowConfiguration = 
    searchQuery.value.length >= 4 || 
    authStore.isAdminLike;
  
  return GROUP_PRIORITY_ORDER.filter((groupKey: GroupKey) => {
    // Hide configuration group unless conditions are met
    if (groupKey === 'configuration' && !shouldShowConfiguration) {
      return false;
    }
    
    const group = groupedResults.value[groupKey];
    return group && group.length > 0;
  });
});

// Watch search query for mode switching and perform search/command filtering
// Mode switching: If input starts with '/', switch to command mode
// Strip '/' prefix from query when processing commands
watch(searchQuery, (newQuery) => {
  const trimmed = newQuery?.trim();
  const wasInCommandMode = mode.value === 'command';

  if (trimmed && trimmed.startsWith('/')) {
    hasUsedCommandTrigger.value = true;
    if (mode.value !== 'command') {
      mode.value = 'command';
    }
  } else if (mode.value !== 'search') {
    mode.value = 'search';
  }

  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  if (mode.value === 'command') {
    pendingDestructiveCommand.value = null;
    return;
  }

  if (wasInCommandMode && trimmed && trimmed.length >= 2) {
    performSearch(trimmed);
    return;
  }

  if (!newQuery || newQuery.trim().length < 2) {
    searchResults.value = null;
    pendingDestructiveCommand.value = null;
    return;
  }

  searchTimeout = setTimeout(() => {
    performSearch(newQuery.trim());
  }, 300);
});

// Watch isOpen to focus input and reset mode
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    reloadRecentSearches();
    void pruneStaleRecentSearches();
    reloadFrequentModules();
    void reloadPaletteCommands();
    nextTick(() => {
      focusSearchInput();
      if (props.initialMode === 'command') {
        mode.value = 'command';
        searchQuery.value = '/';
        hasUsedCommandTrigger.value = true;
      } else {
        mode.value = 'search';
        searchQuery.value = '';
      }
      searchResults.value = null;
    });
  }
});

const onPaletteAfterLeave = () => {
  searchQuery.value = '';
  mode.value = 'search';
  searchResults.value = null;
  pendingDestructiveCommand.value = null;
  highlightedIndex.value = -1;
};

const onSearchInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement | null;
  if (target) searchQuery.value = target.value;
};

type PaletteHeaderRow = {
  kind: 'header';
  key: string;
  label: string;
  srOnly?: boolean;
  gapBefore?: boolean;
};

type PaletteHeaderRecentRow = {
  kind: 'header-recent';
  key: string;
  gapBefore?: boolean;
};

type PaletteOptionRow = {
  kind: 'option';
  key: string;
  index: number;
  variant: 'recent' | 'command' | 'search';
  value: PaletteItem;
  entry?: RecentSearchEntry;
  command?: CommandPaletteItem;
  result?: SearchResultItem;
};

type PaletteRow = PaletteHeaderRow | PaletteHeaderRecentRow | PaletteOptionRow;

/** Single highlight source — Headless UI `active` can desync from our ↑/↓ handler. */
const isPaletteRowActive = (index: number) => highlightedIndex.value === index;

const scrollHighlightedIntoView = () => {
  nextTick(() => {
    const el = document.querySelector(
      `[data-palette-option-index="${highlightedIndex.value}"]`
    );
    el?.scrollIntoView({ block: 'nearest' });
  });
};

const movePaletteHighlight = (delta: number) => {
  const count = selectablePaletteRows.value.length;
  if (!count) return;
  if (highlightedIndex.value === -1) {
    highlightedIndex.value = delta > 0 ? 0 : count - 1;
  } else {
    highlightedIndex.value = (highlightedIndex.value + delta + count) % count;
  }
  scrollHighlightedIntoView();
};

const comboboxRowClass = (active: boolean) => [
  'flex cursor-default select-none items-center rounded-md px-3 py-2',
  active
    ? 'bg-gray-900/5 text-gray-900 outline-none dark:bg-white/10 dark:text-white'
    : 'text-gray-700 dark:text-gray-300'
];

const comboboxIconClass = (active: boolean) => [
  'size-6 flex-none',
  active ? 'text-gray-900 dark:text-white' : 'text-gray-900/40 dark:text-gray-500'
];

const paletteItemFromRecent = (entry: RecentSearchEntry): PaletteItem => ({
  key: `recent:${entry.id}`,
  kind: 'recent',
  recent: entry
});

const paletteItemFromCommand = (command: CommandPaletteItem): PaletteItem => ({
  key: `command:${command.id}`,
  kind: 'command',
  command
});

const paletteItemFromSearch = (result: SearchResultItem, _groupKey: GroupKey): PaletteItem => ({
  key: `search:${result.type}:${result.id}`,
  kind: 'search',
  search: result
});

const showPaletteBrowse = computed(
  () =>
    mode.value === 'search' &&
    !loading.value &&
    !pendingDestructiveCommand.value &&
    !searchQuery.value.trim()
);

const coreModuleCommands = computed(() =>
  availableCommands.value.filter(
    (c) =>
      c.scope === 'global' &&
      c.kind === 'navigate' &&
      c.id.startsWith('core-module-')
  )
);

const frequentModuleCommands = computed(() => {
  const navigateCommands = availableCommands.value.filter(
    (c) => c.scope === 'global' && c.kind === 'navigate'
  );
  const byId = new Map(navigateCommands.map((c) => [c.id, c]));

  let ids = [...frequentModuleIds.value];
  if (!ids.length) {
    const inferred = new Set<string>();
    for (const entry of recentSearches.value) {
      const mk = entry.moduleKey?.toLowerCase();
      if (!mk) continue;
      const match = navigateCommands.find(
        (c) =>
          c.id === `core-module-${mk}` ||
          c.moduleKey?.toLowerCase() === mk ||
          c.id.endsWith(`-${mk}`)
      );
      if (match) inferred.add(match.id);
    }
    ids = [...inferred];
  }

  return ids
    .map((id) => byId.get(id))
    .filter((c): c is CommandPaletteItem => !!c);
});

const frequentModuleIdSet = computed(
  () => new Set(frequentModuleCommands.value.map((c) => c.id))
);

const coreModuleBrowseCommands = computed(() =>
  coreModuleCommands.value.filter((c) => !frequentModuleIdSet.value.has(c.id))
);

const showFrequentModules = computed(
  () => showPaletteBrowse.value && frequentModuleCommands.value.length > 0
);

const showCoreModulesBrowse = computed(
  () => showPaletteBrowse.value && coreModuleBrowseCommands.value.length > 0
);

function resolveEnterPaletteRow(): PaletteOptionRow | undefined {
  const rows = selectablePaletteRows.value;
  if (!rows.length) return undefined;

  if (mode.value === 'command') {
    const commandRows = rows.filter(
      (r): r is PaletteOptionRow => r.variant === 'command' && Boolean(r.command)
    );
    if (!commandRows.length) return undefined;

    if (highlightedIndex.value >= 0) {
      const byIndex = rows[highlightedIndex.value];
      if (byIndex?.variant === 'command' && byIndex.command) return byIndex;
    }

    const query = commandFilterQuery.value;
    if (query) {
      let best: PaletteOptionRow | undefined;
      let bestScore = 0;
      for (const row of commandRows) {
        const score = commandMatchScore(row.command!, query);
        if (score > bestScore) {
          bestScore = score;
          best = row;
        }
      }
      if (best) return best;
    }
    return commandRows[0];
  }

  if (highlightedIndex.value >= 0) return rows[highlightedIndex.value];
  return rows[0];
}

const onComboboxEnter = (event: KeyboardEvent) => {
  if (pendingDestructiveCommand.value) {
    event.preventDefault();
    confirmDestructiveCommand();
    return;
  }
  const row = resolveEnterPaletteRow();
  if (row) {
    event.preventDefault();
    event.stopPropagation();
    handlePaletteSelect(row.value);
  }
};

/** Headless Combobox fires this on Enter with a stale option — only honor pointer picks. */
const onComboboxPaletteSelect = (item: PaletteItem | null) => {
  if (!item || !palettePointerSelect.value) return;
  palettePointerSelect.value = false;
  handlePaletteSelect(item);
};

const handlePaletteSelect = (item: PaletteItem | null) => {
  if (!item || pendingDestructiveCommand.value) return;

  if (mode.value === 'command') {
    if (item.kind !== 'command' || !item.command) return;
    if (item.command.destructive) {
      pendingDestructiveCommand.value = item.command;
      focusSearchInput();
      return;
    }
    executeCommand(item.command);
    return;
  }

  if (item.kind === 'recent' && item.recent) {
    openRecentSearch(item.recent);
    return;
  }

  if (item.kind === 'command' && item.command) {
    if (item.command.destructive) {
      pendingDestructiveCommand.value = item.command;
      focusSearchInput();
      return;
    }
    executeCommand(item.command);
    return;
  }

  if (item.kind === 'search' && item.search) {
    navigateToResult(item.search);
  }
};

// Listen for link drawer open events (from action commands)
const handleLinkDrawerOpen = (event: CustomEvent) => {
  const { moduleKey, title, context, allowCreate } = event.detail;
  linkDrawerModuleKey.value = moduleKey;
  const moduleLabel = moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1);
  linkDrawerTitle.value = title || t('navigation.globalSearchLinkModule', { module: moduleLabel });
  linkDrawerContext.value = context;
  linkDrawerAllowCreate.value = allowCreate || false;
  showLinkDrawer.value = true;
  // Close the command palette when opening the drawer
  close();
};

// Listen for create drawer open events (from create action commands)
const handleCreateDrawerOpen = (event: CustomEvent) => {
  const { moduleKey, initialData, title, lockedFields, autoLinkContext } = event.detail;
  
  // ARCHITECTURAL INTENT: Organizations must use Quick Create flow, not full create
  // This ensures command palette actions respect Settings → Quick Create configuration
  if (moduleKey === 'organizations') {
    console.warn('[GlobalSearch] Organizations should use OrganizationQuickCreateDrawer, not CreateRecordDrawer. Redirecting...');
    // Redirect to Organization Quick Create
    handleOrganizationQuickCreateOpen(event);
    return;
  }
  
  // Enhance initial data with current user assignment for tasks
  const enhancedInitialData = { ...initialData };
  
  if (moduleKey === 'tasks') {
    // Auto-assign to current user if not already set
    if (!enhancedInitialData.assignedTo && authStore.user?._id) {
      enhancedInitialData.assignedTo = authStore.user._id;
    }
  }
  
  createDrawerModuleKey.value = moduleKey;
  createDrawerInitialData.value = enhancedInitialData;
  createDrawerTitle.value = title || '';
  createDrawerLockedFields.value = lockedFields || [];
  createDrawerAutoLinkContext.value = autoLinkContext || {};
  showCreateDrawer.value = true;
  // Close the command palette when opening the drawer
  close();
};

/**
 * Handle Organization Quick Create drawer open event
 * ARCHITECTURAL INTENT: This is the dedicated Quick Create flow for Organizations
 * It strictly respects Settings → Core Modules → Organizations → Quick Create configuration
 * Command palette actions must NEVER navigate to list views - they open this Quick Create flow
 */
const handleOrganizationQuickCreateOpen = (event: CustomEvent) => {
  // Handle both cases: with detail (from command palette) and without (from list view)
  const detail = event.detail || {};
  const { initialData, autoLinkContext } = detail;
  
  createDrawerModuleKey.value = 'organizations';
  createDrawerInitialData.value = initialData || {};
  createDrawerAutoLinkContext.value = autoLinkContext || null;
  showCreateDrawer.value = true;
  // Close the command palette when opening the drawer
  close();
};

/**
 * Handle People Quick Create drawer open event
 * ARCHITECTURAL INTENT: Opens drawer in same tab, not navigating to new route
 */
const handlePeopleQuickCreateOpen = (e?: Event) => {
  const ev = e as CustomEvent<{ contextAppKey?: string | null }> | undefined;
  peopleDrawerContextAppKey.value = ev?.detail?.contextAppKey ?? null;
  showPeopleDrawer.value = true;
  // Close the command palette when opening the drawer
  close();
};

const handlePeopleDrawerClose = () => {
  showPeopleDrawer.value = false;
  peopleDrawerContextAppKey.value = null;
};

const handlePeopleDrawerSaved = (person: any) => {
  showPeopleDrawer.value = false;
  
  // Dispatch global event to refresh list views
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('arivu:record-created', {
      detail: { moduleKey: 'people', record: person }
    }));
  }
};

/**
 * Handle Event Quick Create drawer open event
 * ARCHITECTURAL INTENT: Opens drawer in same tab, not navigating to new route
 */
const handleEventQuickCreateOpen = () => {
  showEventDrawer.value = true;
  // Close the command palette when opening the drawer
  close();
};

const handleEventDrawerClose = () => {
  showEventDrawer.value = false;
};

const handleEventDrawerSaved = (event: any) => {
  showEventDrawer.value = false;
  
  // Dispatch global event to refresh calendar/list views
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('arivu:event-created', {
      detail: { event }
    }));
  }
};

onMounted(() => {
  window.addEventListener('arivu:open-link-drawer', handleLinkDrawerOpen as EventListener);
  window.addEventListener('arivu:open-create-drawer', handleCreateDrawerOpen as EventListener);
  // ARCHITECTURAL INTENT: Organization Quick Create is separate from full create flows
  // This ensures command palette actions open Quick Create, not full create/edit
  window.addEventListener('arivu:open-organization-quick-create', handleOrganizationQuickCreateOpen as EventListener);
  window.addEventListener('arivu:open-people-quick-create', handlePeopleQuickCreateOpen as EventListener);
  window.addEventListener('arivu:open-event-quick-create', handleEventQuickCreateOpen as EventListener);
});

onUnmounted(() => {
  window.removeEventListener('arivu:open-link-drawer', handleLinkDrawerOpen as EventListener);
  window.removeEventListener('arivu:open-create-drawer', handleCreateDrawerOpen as EventListener);
  window.removeEventListener('arivu:open-organization-quick-create', handleOrganizationQuickCreateOpen as EventListener);
  window.removeEventListener('arivu:open-people-quick-create', handlePeopleQuickCreateOpen as EventListener);
  window.removeEventListener('arivu:open-event-quick-create', handleEventQuickCreateOpen as EventListener);
});

// Perform search
const performSearch = async (query: string) => {
  if (!query || query.length < 2) {
    console.log('[GlobalSearch] Query too short:', query);
    return;
  }

  console.log('[GlobalSearch] Performing search for:', query);
  loading.value = true;
  try {
    const url = `/search?q=${encodeURIComponent(query)}`;
    console.log('[GlobalSearch] Calling API:', url);
    const response = await apiClient(url);
    console.log('[GlobalSearch] Search response:', response);
    
    if (response && response.success) {
      searchResults.value = response.data;
      console.log('[GlobalSearch] Search results set:', {
        total: searchResults.value?.total,
        people: searchResults.value?.results?.people?.length || 0,
        organizations: searchResults.value?.results?.organizations?.length || 0,
        deals: searchResults.value?.results?.deals?.length || 0,
        tasks: searchResults.value?.results?.tasks?.length || 0,
        events: searchResults.value?.results?.events?.length || 0
      });
    } else {
      console.warn('[GlobalSearch] Search failed - response:', response);
      searchResults.value = null;
    }
  } catch (error: unknown) {
    const searchError = error as any;
    console.error('[GlobalSearch] Error searching:', error);
    console.error('[GlobalSearch] Error details:', {
      message: searchError?.message,
      status: searchError?.status,
      stack: searchError?.stack
    });
    searchResults.value = null;
  } finally {
    loading.value = false;
  }
};

// Get group label for UX categories
const getGroupLabel = (groupKey: GroupKey) => {
  const labels: Record<GroupKey, string> = {
    people: t('navigation.globalSearchGroupPeople'),
    organizations: t('navigation.globalSearchGroupOrganizations'),
    work: t('navigation.globalSearchGroupWork'),
    configuration: t('navigation.globalSearchGroupConfiguration')
  };
  return labels[groupKey] || String(groupKey);
};

// Handle Escape key (cancel confirmation, exit command mode, or close)
const handleEscape = () => {
  if (pendingDestructiveCommand.value) {
    // Cancel confirmation
    pendingDestructiveCommand.value = null;
  } else if (mode.value === 'command') {
    // Exit command mode back to search mode
    // Preserve typed query by removing "/" prefix but keeping the rest
    const trimmed = searchQuery.value.trim();
    if (trimmed.startsWith('/')) {
      searchQuery.value = trimmed.slice(1).trim();
    }
    mode.value = 'search';
    // Trigger search if there's a query after removing "/"
    if (searchQuery.value && searchQuery.value.length >= 2) {
      performSearch(searchQuery.value.trim());
    } else {
      searchResults.value = null;
    }
  } else {
    // Close search modal
    close();
  }
};

// Confirm destructive command execution
const confirmDestructiveCommand = () => {
  if (pendingDestructiveCommand.value) {
    executeCommand(pendingDestructiveCommand.value);
    pendingDestructiveCommand.value = null;
  }
};

const RECORD_DETAIL_ROUTE =
  /^\/(quotes|people|organizations|deals|tasks|events|forms|items)\/([a-f0-9]{24})$/i;
const HELPDESK_CASE_DETAIL_ROUTE = /^\/helpdesk\/cases\/([a-f0-9]{24})$/i;

const RECORD_DETAIL_API_BASE: Record<string, string> = {
  quotes: '/quotes',
  people: '/people',
  organizations: '/v2/organization',
  deals: '/deals',
  tasks: '/tasks',
  events: '/events',
  forms: '/forms',
  items: '/items'
};

async function isRecordDetailRouteReachable(pathOnly: string): Promise<boolean> {
  const helpdeskCase = pathOnly.match(HELPDESK_CASE_DETAIL_ROUTE);
  if (helpdeskCase?.[1]) {
    const res = await apiClient.getOptional(`/helpdesk/cases/${helpdeskCase[1]}`);
    return Boolean(res?.success && res.data);
  }

  const detailMatch = pathOnly.match(RECORD_DETAIL_ROUTE);
  if (detailMatch?.[1] && detailMatch[2]) {
    const moduleKey = detailMatch[1].toLowerCase();
    const recordId = detailMatch[2];
    const apiBase = RECORD_DETAIL_API_BASE[moduleKey];
    if (apiBase) {
      const res = await apiClient.getOptional(`${apiBase}/${recordId}`);
      return Boolean(res?.success && res.data);
    }
  }
  return true;
}

async function pruneStaleRecentSearches() {
  const entries = [...recentSearches.value];
  await Promise.all(
    entries.map(async (entry) => {
      const pathOnly = (entry.route || '').split('?')[0] ?? '';
      const isDetail =
        HELPDESK_CASE_DETAIL_ROUTE.test(pathOnly) || RECORD_DETAIL_ROUTE.test(pathOnly);
      if (!isDetail) return;
      const ok = await isRecordDetailRouteReachable(pathOnly);
      if (!ok) removeRecentSearch(entry.id);
    })
  );
}

const openRecentSearch = async (entry: RecentSearchEntry) => {
  const pathOnly = (entry.route || '').split('?')[0] ?? '';
  const isDetail =
    HELPDESK_CASE_DETAIL_ROUTE.test(pathOnly) || RECORD_DETAIL_ROUTE.test(pathOnly);
  if (isDetail) {
    const ok = await isRecordDetailRouteReachable(pathOnly);
    if (!ok) {
      removeRecentSearch(entry.id);
      close();
      return;
    }
  }

  openTab(entry.route, {
    title: entry.label,
    background: false,
    insertAdjacent: true
  });
  addRecentSearch({
    kind: 'record',
    label: entry.label,
    subtitle: entry.subtitle,
    route: entry.route,
    type: entry.type,
    moduleKey: entry.moduleKey || (entry.type ? searchResultModuleKey(entry.type) : undefined),
    avatar: entry.avatar,
    first_name: entry.first_name,
    last_name: entry.last_name
  });
  close();
};

// Navigate to result
const navigateToResult = (result: SearchResultItem) => {
  if (!result || !result.route) return;

  addRecentSearch({
    kind: 'record',
    label: result.title || '',
    subtitle: result.subtitle,
    route: result.route,
    type: result.type,
    moduleKey: searchResultModuleKey(result.type),
    avatar: result.avatar ?? undefined,
    first_name: result.first_name,
    last_name: result.last_name
  });

  openTab(result.route, {
    title: result.title,
    background: false,
    insertAdjacent: true
  });

  close();
};

// Command system
// See: docs/architecture/command-palette-invariants.md
// Commands are stateless, fast actions - not entity searches

/**
 * Determine command context from active surface
 * 
 * Maps active surface to CommandContext for contextual commands.
 * Uses useActiveSurface composable instead of direct route path checking.
 * Returns undefined when not in a contextual surface.
 * 
 * Note: Person detail commands only appear on 'person' surface, not 'people' list.
 * Organization detail commands only appear on 'organization' surface, not 'organizations' list.
 */
function getCommandContextFromSurface(): CommandContext | undefined {
  const surface = activeSurface.value;
  
  if (surface === 'inbox') {
    return 'inbox';
  }
  // Person detail commands only on detail surface
  if (surface === 'person') {
    return 'people';
  }
  // Organization detail commands only on detail surface
  if (surface === 'organization') {
    return 'organization';
  }
  
  return undefined;
}

/**
 * Get available commands filtered by scope
 * 
 * Architectural filtering:
 * - Global commands: Always visible
 * - Contextual commands: Only visible when context matches active surface
 * 
 * Ordering rules:
 * - Contextual commands first
 * - Then global commands
 * - Alphabetical ordering within each group (by label)
 * - No visual separators (architectural change only)
 * 
 * Uses useActiveSurface composable to derive surface context.
 */
const availableCommands = computed<CommandPaletteItem[]>(() => {
  const activeContext = getCommandContextFromSurface();
  const allCommands = platformCommands.value;

  // Filter by scope
  const filtered = allCommands.filter(cmd => {
    if (cmd.scope === 'global') {
      return true; // Global commands always visible
    }
    if (cmd.scope === 'contextual') {
      // Contextual commands only visible when context matches
      return cmd.context === activeContext;
    }
    return false;
  });
  
  // Order: contextual commands first, then global commands
  // Alphabetical ordering within each group
  // Create a new array to avoid mutating the filtered array
  return [...filtered].sort((a, b) => {
    // First, separate by scope: contextual first, then global
    if (a.scope === 'contextual' && b.scope === 'global') return -1;
    if (a.scope === 'global' && b.scope === 'contextual') return 1;
    
    // Within same scope, sort alphabetically by label
    if (a.scope === b.scope) {
      return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
    }
    
    return 0;
  });
});

/**
 * Check if command query is empty (just '/' or empty string)
 * 
 * Used to determine when to show example commands in empty state.
 */
const commandFilterQuery = computed(() => {
  if (mode.value !== 'command') return '';
  const query = searchQuery.value.trim();
  return query.startsWith('/') ? query.slice(1).trim().toLowerCase() : query.trim().toLowerCase();
});

const isCommandQueryEmpty = computed(() => mode.value === 'command' && !commandFilterQuery.value);

function commandMatchScore(cmd: CommandPaletteItem, query: string): number {
  if (!query) return 0;
  const label = cmd.label.toLowerCase();
  const mk = (cmd.moduleKey || '').toLowerCase();
  const id = cmd.id.toLowerCase();
  const desc = (cmd.description || '').toLowerCase();

  if (label === query) return 100;
  if (mk === query) return 95;
  if (id === `core-module-${query}` || id.endsWith(`-${query}`) || id.includes(`-${query}`)) {
    return 90;
  }
  if (label.startsWith(query)) return 80;
  if (mk.startsWith(query)) return 75;
  if (label.includes(query)) return 50;
  if (desc.includes(query)) return 30;
  if (id.includes(query)) return 20;
  return 0;
}

/**
 * Filter commands based on query (strip '/' prefix)
 * 
 * Filters commands by label or description matching the query.
 * Search filtering applies uniformly across all commands.
 * Ordering is preserved: contextual commands first, then global, alphabetical within each group.
 * 
 * If query is empty (just '/' or empty), shows all available commands.
 */
const filteredCommands = computed<CommandPaletteItem[]>(() => {
  if (mode.value !== 'command') return [];

  const lowerQuery = commandFilterQuery.value;
  if (!lowerQuery) {
    return availableCommands.value;
  }

  return availableCommands.value
    .map((cmd) => ({ cmd, score: commandMatchScore(cmd, lowerQuery) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ cmd }) => cmd);
});

type CommandSection = {
  id: string;
  labelKey: string;
  commands: CommandPaletteItem[];
};

const groupedCommandSections = computed<CommandSection[]>(() => {
  const cmds = filteredCommands.value;
  if (!cmds.length) return [];

  const sections: CommandSection[] = [];
  const contextual = cmds.filter((c) => c.scope === 'contextual');
  if (contextual.length) {
    sections.push({ id: 'contextual', labelKey: 'globalSearchGroupContextual', commands: contextual });
  }

  const globalNav = cmds.filter((c) => c.scope === 'global' && c.category === 'navigation');
  const coreModules = globalNav.filter((c) => c.id.startsWith('core-module-'));
  const appModules = globalNav.filter((c) => c.id.startsWith('module-'));
  const appLens = globalNav.filter((c) => c.id.startsWith('app-') && !c.id.startsWith('app-dashboard-'));
  const shellNav = globalNav.filter((c) => c.id.startsWith('shell-'));
  const platformNav = globalNav.filter((c) => c.id.startsWith('platform-'));
  const otherNav = globalNav.filter(
    (c) =>
      !coreModules.includes(c) &&
      !appModules.includes(c) &&
      !appLens.includes(c) &&
      !shellNav.includes(c) &&
      !platformNav.includes(c)
  );

  const pushNavSection = (id: string, labelKey: string, commands: CommandPaletteItem[]) => {
    if (commands.length) sections.push({ id, labelKey, commands });
  };

  pushNavSection('core-modules', 'globalSearchGroupCoreModules', coreModules);
  pushNavSection('shell', 'globalSearchGroupNavigation', shellNav);
  pushNavSection('app-modules', 'globalSearchGroupAppModules', appModules);
  pushNavSection('apps', 'globalSearchGroupApps', appLens);
  pushNavSection('platform', 'globalSearchGroupPlatform', platformNav);
  pushNavSection('navigation', 'globalSearchGroupNavigation', otherNav);

  const globalCreate = cmds.filter((c) => c.scope === 'global' && c.category === 'create');
  const globalAction = cmds.filter((c) => c.scope === 'global' && c.category === 'action');
  const globalSettings = cmds
    .filter((c) => c.scope === 'global' && c.category === 'settings')
    .sort((a, b) => settingsCommandSortOrder(a.id) - settingsCommandSortOrder(b.id));
  if (globalCreate.length) {
    sections.push({ id: 'create', labelKey: 'globalSearchGroupCreate', commands: globalCreate });
  }
  if (globalAction.length) {
    sections.push({ id: 'actions', labelKey: 'globalSearchGroupActions', commands: globalAction });
  }
  if (globalSettings.length) {
    sections.push({ id: 'settings', labelKey: 'globalSearchGroupConfiguration', commands: globalSettings });
  }

  const categorized = new Set([
    ...contextual,
    ...globalNav,
    ...globalCreate,
    ...globalAction,
    ...globalSettings,
  ]);
  const uncategorized = cmds.filter((c) => !categorized.has(c));
  if (uncategorized.length) {
    sections.push({ id: 'other', labelKey: 'globalSearchCommandsHeader', commands: uncategorized });
  }

  return sections;
});

const flatFilteredCommands = computed(() =>
  groupedCommandSections.value.flatMap((section) => section.commands)
);

const showRecentSearches = computed(
  () =>
    mode.value === 'search' &&
    !loading.value &&
    !pendingDestructiveCommand.value &&
    !searchQuery.value.trim() &&
    recentSearches.value.length > 0
);

const showNoMatches = computed(() => {
  if (loading.value || pendingDestructiveCommand.value) return false;
  if (mode.value === 'command') {
    const hasQuery = !isCommandQueryEmpty.value;
    return hasQuery && flatFilteredCommands.value.length === 0;
  }
  const q = searchQuery.value.trim();
  return q.length >= 2 && totalResults.value === 0;
});

const showComboboxOptions = computed(
  () =>
    !loading.value &&
    !pendingDestructiveCommand.value &&
    !showNoMatches.value &&
    (showRecentSearches.value ||
      showFrequentModules.value ||
      showCoreModulesBrowse.value ||
      (mode.value === 'command' && flatFilteredCommands.value.length > 0) ||
      (mode.value === 'search' && totalResults.value > 0))
);

const showEmptyHint = computed(() => {
  if (loading.value || pendingDestructiveCommand.value || showNoMatches.value) return false;
  if (showRecentSearches.value || showFrequentModules.value || showCoreModulesBrowse.value) {
    return false;
  }
  if (mode.value === 'command') {
    return flatFilteredCommands.value.length === 0 && isCommandQueryEmpty.value;
  }
  if (mode.value === 'search' && totalResults.value > 0) return false;
  return !searchQuery.value.trim() || searchQuery.value.trim().length < 2;
});

const paletteRows = computed<PaletteRow[]>(() => {
  const rows: PaletteRow[] = [];
  let optionIndex = 0;
  let sectionStarted = false;

  const pushSectionHeader = (header: PaletteHeaderRow | PaletteHeaderRecentRow) => {
    rows.push({ ...header, gapBefore: sectionStarted });
    sectionStarted = true;
  };

  if (showRecentSearches.value) {
    pushSectionHeader({ kind: 'header-recent', key: 'header-recent' });
    for (const entry of recentSearches.value) {
      rows.push({
        kind: 'option',
        key: `recent:${entry.id}`,
        index: optionIndex++,
        variant: 'recent',
        value: paletteItemFromRecent(entry),
        entry
      });
    }
  }

  if (showFrequentModules.value) {
    pushSectionHeader({
      kind: 'header',
      key: 'header-frequent-modules',
      label: t('navigation.globalSearchFrequentModules')
    });
    for (const command of frequentModuleCommands.value) {
      rows.push({
        kind: 'option',
        key: command.id,
        index: optionIndex++,
        variant: 'command',
        value: paletteItemFromCommand(command),
        command
      });
    }
  }

  if (showCoreModulesBrowse.value) {
    pushSectionHeader({
      kind: 'header',
      key: 'header-core-modules',
      label: t('navigation.globalSearchGroupCoreModules')
    });
    for (const command of coreModuleBrowseCommands.value) {
      rows.push({
        kind: 'option',
        key: command.id,
        index: optionIndex++,
        variant: 'command',
        value: paletteItemFromCommand(command),
        command
      });
    }
  }

  if (mode.value === 'command' && flatFilteredCommands.value.length > 0) {
    for (const section of groupedCommandSections.value) {
      pushSectionHeader({
        kind: 'header',
        key: `header-${section.id}`,
        label: t(`navigation.${section.labelKey}`)
      });
      for (const command of section.commands) {
        rows.push({
          kind: 'option',
          key: command.id,
          index: optionIndex++,
          variant: 'command',
          value: paletteItemFromCommand(command),
          command
        });
      }
    }
  }

  if (mode.value === 'search' && totalResults.value > 0) {
    for (const groupKey of prioritizedGroups.value) {
      pushSectionHeader({
        kind: 'header',
        key: `header-search-${groupKey}`,
        label: getGroupLabel(groupKey)
      });
      for (const result of groupedResults.value[groupKey]) {
        rows.push({
          kind: 'option',
          key: `search:${result.type}:${result.id}`,
          index: optionIndex++,
          variant: 'search',
          value: paletteItemFromSearch(result, groupKey),
          result
        });
      }
    }
  }

  return rows;
});

const selectablePaletteRows = computed(() =>
  paletteRows.value.filter((row): row is PaletteOptionRow => row.kind === 'option')
);

watch([mode, () => props.isOpen], () => {
  highlightedIndex.value = -1;
});

watch(commandFilterQuery, (query) => {
  if (mode.value !== 'command') return;
  const count = selectablePaletteRows.value.length;
  highlightedIndex.value = query && count > 0 ? 0 : -1;
});

watch(searchQuery, () => {
  if (mode.value === 'search') {
    highlightedIndex.value = -1;
  }
});

watch(selectablePaletteRows, (rows) => {
  if (highlightedIndex.value >= rows.length) {
    highlightedIndex.value = rows.length > 0 ? Math.max(0, rows.length - 1) : -1;
  }
});

/**
 * Create navigation utilities from Vue Router
 * 
 * Provides NavigationUtilities interface for navigation commands.
 */
function createNavigationUtilities(): NavigationUtilities {
  const performNavigation = async (target: string | { path: string; query: Record<string, string> }) => {
    try {
      await router.push(target as any);
    } catch (err: any) {
      if (err?.name !== 'NavigationDuplicated') {
        console.warn('[GlobalSearch] Navigation error:', err);
      }
    }
  };

  return {
    navigate: async (path: string) => {
      await performNavigation(path);
    },
    navigateWithQuery: async (path: string, query: Record<string, string>) => {
      await performNavigation({ path, query });
    },
    openTab: async (path: string, options?: { title?: string; background?: boolean }) => {
      // Open route in a new tab with proper title
      // If title is provided, use it; otherwise openTab will generate one from path
      openTab(path, {
        title: options?.title,
        background: options?.background || false
      });
    },
    getCurrentRoute: () => router.currentRoute
  };
}

/**
 * Execute a command
 * 
 * Handles both navigation and action commands using discriminated union.
 * - Navigation commands: Call run() with NavigationUtilities
 * - Action commands: Call handler() directly
 * 
 * Commands execute navigation or actions, never mutate store state directly.
 * 
 * NOTE:
 * Command Palette is keyboard-first, but mouse click selection is supported for accessibility.
 * Clicking a command runs the same logic as pressing Enter (including destructive confirmation).
 */
const executeCommand = (command: CommandPaletteItem) => {
  if (!command) return;
  
  if (command.kind === 'navigate') {
    recordFrequentModule(command.id);
    const nav = createNavigationUtilities();
    command.run(nav);
    close();
  } else if (command.kind === 'action') {
    // Action command: call handler() directly
    // Handler receives route for accessing current route params
    // Use router.currentRoute.value which is always available
    const currentRoute = router.currentRoute.value;
    if (currentRoute) {
      command.handler(currentRoute);
    } else {
      console.warn('[GlobalSearch] Route not available for action command:', command.id);
    }
    // Note: Action commands may not close the modal (e.g., if they open a drawer)
    // The handler should decide whether to close or not
  }
};

/**
 * Handle link drawer close
 */
const handleLinkDrawerClose = () => {
  showLinkDrawer.value = false;
  linkDrawerModuleKey.value = '';
  linkDrawerTitle.value = '';
  linkDrawerContext.value = {};
  linkDrawerAllowCreate.value = false;
};

/**
 * Handle create action from link drawer
 * ARCHITECTURAL INTENT: For Organizations, use Quick Create flow instead of full create
 */
const handleLinkDrawerCreate = () => {
  // CRITICAL: Store values BEFORE closing the drawer (which clears them)
  const moduleKey = linkDrawerModuleKey.value;
  const context = { ...linkDrawerContext.value };
  
  // Close link drawer (this clears linkDrawerModuleKey and linkDrawerContext)
  handleLinkDrawerClose();
  
  // ARCHITECTURAL INTENT: Organizations must use Quick Create flow
  if (moduleKey === 'organizations') {
    // Use Organization Quick Create drawer
    createDrawerModuleKey.value = 'organizations';
    createDrawerInitialData.value = {};
    createDrawerAutoLinkContext.value = context;
    showCreateDrawer.value = true;
    return;
  }
  
  // For other modules, use standard create drawer
  const initialData: Record<string, any> = {};
  
  // Auto-assign tasks to current user
  if (moduleKey === 'tasks' && authStore.user?._id) {
    initialData.assignedTo = authStore.user._id;
  }
  
  createDrawerModuleKey.value = moduleKey;
  createDrawerInitialData.value = initialData;
  createDrawerTitle.value = `New ${moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1)}`;
  createDrawerLockedFields.value = [];
  
  // Store context for auto-linking after creation
  // We'll use a ref to track this
  createDrawerAutoLinkContext.value = context;
  
  showCreateDrawer.value = true;
};

/**
 * Handle create drawer close
 */
const handleCreateDrawerClose = () => {
  showCreateDrawer.value = false;
  createDrawerModuleKey.value = '';
  createDrawerInitialData.value = {};
  createDrawerTitle.value = '';
  createDrawerLockedFields.value = [];
  createDrawerAutoLinkContext.value = {};
};

/**
 * Handle create drawer saved event
 */
const handleCreateDrawerSaved = async (savedRecord?: any) => {
  // ARCHITECTURAL INTENT: Organization Quick Create handles auto-linking internally
  // This handler is for other modules or fallback cases
  const moduleKey = createDrawerModuleKey.value;
  
  // Dispatch global event to refresh list views for all modules
  if (typeof window !== 'undefined' && savedRecord) {
    window.dispatchEvent(new CustomEvent('arivu:record-created', {
      detail: { moduleKey, record: savedRecord }
    }));
  }
  
  // If we have auto-link context and a saved record, auto-link it
  if (createDrawerAutoLinkContext.value && savedRecord?._id) {
    const context = createDrawerAutoLinkContext.value;
    const recordId = savedRecord._id;
    
    try {
      // Auto-link the newly created record based on context
      // Note: Organizations Quick Create handles auto-linking internally, so skip here
      if (context.personId && moduleKey === 'organizations') {
        // This should not happen - OrganizationQuickCreateDrawer handles this
        console.warn('[GlobalSearch] Auto-link for organizations should be handled by OrganizationQuickCreateDrawer');
        // Link organization to person by updating the person's organization field
        await apiClient.put(`/people/${context.personId}`, {
          organization: recordId
        });
        
        // Dispatch refresh event for person
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('arivu:refresh-person', {
            detail: { personId: context.personId }
          }));
        }
      } else if (context.organizationId) {
        // Link record to organization (generic)
        if (moduleKey === 'people') {
          await apiClient.put(`/people/${recordId}`, { organization: context.organizationId });
        } else if (moduleKey === 'deals') {
          await apiClient.post('/deals/link', { accountId: context.organizationId, dealIds: [recordId] });
        } else if (moduleKey === 'tasks') {
          await apiClient.post('/tasks/link', { organizationId: context.organizationId, taskIds: [recordId] });
        }
        
        // Dispatch refresh event for organization
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('arivu:refresh-organization', {
            detail: { organizationId: context.organizationId }
          }));
        }
      }
    } catch (error) {
      console.error('[GlobalSearch] Error auto-linking created record:', error);
      // Don't block the user - creation succeeded, linking can be done manually
    }
  }
  
  // Close the drawer
  handleCreateDrawerClose();
  // Optionally dispatch refresh events based on what was created
  // This will be handled by the components that listen for these events
};

/**
 * Helper: Get current user name for activity logging
 */
const getCurrentUserName = () => {
  if (authStore.user) {
    return authStore.user.name || authStore.user.email || t('navigation.globalSearchUnknownUser');
  }
  return t('navigation.globalSearchUnknownUser');
};

/**
 * Helper: Get activity logs endpoint for a record
 */
const getActivityLogsEndpoint = (recordId: string, recordType: string) => {
  if (!recordId) return null;
  
  switch (recordType) {
    case 'organizations':
    case 'organization':
      return `/v2/organization/${recordId}/activity-logs`;
    case 'people':
    case 'contacts':
      return `/people/${recordId}/activity-logs`;
    case 'deals':
      return `/deals/${recordId}/activity-logs`;
    case 'tasks':
      return `/tasks/${recordId}/activity-logs`;
    case 'events':
      return `/events/${recordId}/activity-logs`;
    default:
      return null;
  }
};

/**
 * Helper: Fetch records by IDs for activity log links
 */
const fetchRecordsByIds = async (moduleKey: string, ids: string[]) => {
  const out: Array<{ id: string; name: string; module: string }> = [];
  const getDetailEndpoint = (key: string, id: string) => {
    switch (key) {
      case 'people':
      case 'contacts':
        return `/people/${id}`;
      case 'deals':
        return `/deals/${id}`;
      case 'tasks':
        return `/tasks/${id}`;
      case 'events':
        return `/events/${id}`;
      case 'organizations':
      case 'organization':
        return `/v2/organization/${id}`;
      default:
        return null;
    }
  };
  
  const getRecordDisplayName = (rec: any) => {
    return rec?.name || rec?.title || `${rec?.first_name || ''} ${rec?.last_name || ''}`.trim() || rec?.email || rec?._id || '';
  };
  
  for (const id of ids || []) {
    const ep = getDetailEndpoint(moduleKey, id);
    if (!ep) continue;
    try {
      const res = await apiClient.get(ep);
      const rec = res?.data || res;
      if (rec) out.push({ id, name: getRecordDisplayName(rec), module: moduleKey });
    } catch {
      out.push({ id, name: id, module: moduleKey });
    }
  }
  return out;
};

/**
 * Helper: Add activity log to a record
 */
const addActivityLog = async (recordId: string, recordType: string, action: string, details: any = null) => {
  if (!recordId) {
    console.warn('[GlobalSearch] Cannot add activity log: recordId is missing');
    return;
  }
  
  const endpoint = getActivityLogsEndpoint(recordId, recordType);
  if (!endpoint) {
    console.warn('[GlobalSearch] Cannot add activity log: endpoint not found for', recordType);
    return;
  }
  
  try {
    const payload = {
      user: getCurrentUserName(),
      action: action,
      details: details || null
    };
    
    console.log('[GlobalSearch] Adding activity log:', { endpoint, payload });
    const response = await apiClient.post(endpoint, payload);
    
    if (response && response.success) {
      console.log('[GlobalSearch] Activity log added successfully');
    } else {
      console.warn('[GlobalSearch] Activity log API returned non-success:', response);
    }
  } catch (e: any) {
    console.error('[GlobalSearch] Error adding activity log:', e);
    console.error('[GlobalSearch] Error details:', {
      endpoint,
      recordId,
      recordType,
      action,
      error: e.message || e
    });
    // Non-blocking - activity log failure shouldn't prevent linking
  }
};

/**
 * Handle link drawer linked event
 * 
 * Performs the actual linking via API based on context.
 * This matches the logic from SummaryView.vue.
 */
const handleLinkDrawerLinked = async ({ moduleKey, ids, context }: { moduleKey: string; ids: string[]; context: Record<string, any> }) => {
  try {
    if (context.organizationId && moduleKey === 'people') {
      // Link contacts to organization by updating each contact's organization field
      await Promise.all(
        ids.map((contactId) => apiClient.put(`/people/${contactId}`, { organization: context.organizationId }))
      );
      
      // Log linking activity
      try {
        const labelMap = { people: 'contact', deals: 'deal', tasks: 'task', events: 'event', organizations: 'organization', users: 'user' };
        const label = labelMap[moduleKey] || moduleKey;
        const count = ids?.length || 0;
        if (count > 0) {
          const items = await fetchRecordsByIds(moduleKey, ids);
          const actionSuffix = count === 1 && items[0]?.name ? ` - ${items[0].name}` : '';
          await addActivityLog(
            context.organizationId,
            'organizations',
            `linked ${count} ${label}${count > 1 ? 's' : ''}${actionSuffix}`,
            { type: 'link', moduleKey, items }
          );
        }
      } catch (e) {
        console.warn('Error logging activity:', e);
      }
      
      // Refresh organization data by dispatching a custom event
      // OrganizationDetail listens for this event and refreshes its data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('arivu:refresh-organization', {
          detail: { organizationId: context.organizationId }
        }));
      }
    } else if (context.organizationId && moduleKey === 'deals') {
      await apiClient.post('/deals/link', { accountId: context.organizationId, dealIds: ids });
      
      // Log linking activity
      try {
        const items = await fetchRecordsByIds(moduleKey, ids);
        const count = ids?.length || 0;
        const actionSuffix = count === 1 && items[0]?.name ? ` - ${items[0].name}` : '';
        await addActivityLog(
          context.organizationId,
          'organizations',
          `linked ${count} deal${count > 1 ? 's' : ''}${actionSuffix}`,
          { type: 'link', moduleKey, items }
        );
      } catch (e) {
        console.warn('Error logging activity:', e);
      }
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('arivu:refresh-organization', {
          detail: { organizationId: context.organizationId }
        }));
      }
    } else if (context.contactId && moduleKey === 'deals') {
      await apiClient.post('/deals/link', { contactId: context.contactId, dealIds: ids });
    } else if (context.contactId && moduleKey === 'tasks') {
      await apiClient.post('/tasks/link', { contactId: context.contactId, taskIds: ids });
    } else if (context.organizationId && moduleKey === 'tasks') {
      await apiClient.post('/tasks/link', { organizationId: context.organizationId, taskIds: ids });
      
      // Log linking activity
      try {
        const items = await fetchRecordsByIds(moduleKey, ids);
        const count = ids?.length || 0;
        const actionSuffix = count === 1 && items[0]?.name ? ` - ${items[0].name}` : '';
        await addActivityLog(
          context.organizationId,
          'organizations',
          `linked ${count} task${count > 1 ? 's' : ''}${actionSuffix}`,
          { type: 'link', moduleKey, items }
        );
      } catch (e) {
        console.warn('Error logging activity:', e);
      }
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('arivu:refresh-organization', {
          detail: { organizationId: context.organizationId }
        }));
      }
    } else if (moduleKey === 'events') {
      await apiClient.post('/events/link', { 
        relatedType: context.relatedType === 'organization' ? 'Organization' : 'Contact', 
        relatedId: context.organizationId || context.contactId, 
        eventIds: ids 
      });
      
      // Log linking activity for organizations
      if (context.organizationId) {
        try {
          const items = await fetchRecordsByIds(moduleKey, ids);
          const count = ids?.length || 0;
          const actionSuffix = count === 1 && items[0]?.name ? ` - ${items[0].name}` : '';
          await addActivityLog(
            context.organizationId,
            'organizations',
            `linked ${count} event${count > 1 ? 's' : ''}${actionSuffix}`,
            { type: 'link', moduleKey, items }
          );
        } catch (e) {
          console.warn('Error logging activity:', e);
        }
      }
      
      if (context.organizationId && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('arivu:refresh-organization', {
          detail: { organizationId: context.organizationId }
        }));
      }
    } else if (context.contactId && moduleKey === 'organizations') {
      // Link organization to contact by setting the contact's organization
      if (ids[0]) {
        await apiClient.put(`/people/${context.contactId}`, { organization: ids[0] });
      }
    }
  } catch (e) {
    console.error('Error linking records:', e);
  }
  
  // Close the drawer (command palette is already closed)
  handleLinkDrawerClose();
};

// Close search
const close = () => {
  emit('close');
  searchQuery.value = '';
  mode.value = 'search'; // Reset to default mode
  searchResults.value = null;
  pendingDestructiveCommand.value = null;
  // Note: hasUsedCommandTrigger persists across modal opens/closes in the same session
};

// Note: Keyboard shortcut is handled in Nav.vue to avoid conflicts

onUnmounted(() => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
});
</script>

