<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useTabs, tabShowsHelpdeskAlert } from '@/composables/useTabs';
import { useAuthStore } from '@/stores/authRegistry';
import clickOutside from '@/directives/clickOutside';
import NotificationBell from '@/components/notifications/NotificationBell.vue';
import PortalSwitcher from '@/components/PortalSwitcher.vue';
import ArivuAssistantLauncher from '@/components/support/ArivuAssistantLauncher.vue';
import UserMenu from '@/components/UserMenu.vue';
import AvatarInitials from '@/components/ui/AvatarInitials.vue';
import { useUserStatus } from '@/composables/useUserStatus';
import { XMarkIcon, ChevronDownIcon } from '@heroicons/vue/20/solid';
import { resolveTabTitleWithHelpdeskAlerts } from '@/utils/helpdeskTabAlerts';
import { resolveTabTitleWithLiveChatAlerts } from '@/utils/liveChatTabAlerts';
import {
  isInternalChatTabPath,
  resolveTabTitleWithInternalChatAlerts,
} from '@/utils/internalChatTabAlerts';
import { resolveTabTitle } from '@/utils/navigationLabels';
import { useHelpdeskBrowserTitle } from '@/composables/useHelpdeskBrowserTitle';
import TabHoverPreview from '@/components/TabHoverPreview.vue';
import {
  getTabPreviewContext,
  isTabTitleTruncated,
  shouldShowTabPreview,
} from '@/utils/tabPreviewContext';
/** Floor below which tabs stop shrinking and the strip scrolls (Chrome / VS Code). */
const TAB_MIN_WIDTH_PX = 120;
const TAB_MAX_WIDTH_PX = 200;

const { t, te } = useI18n();
useHelpdeskBrowserTitle();
const route = useRoute();
const authStore = useAuthStore();
const { tabs, activeTabId, switchToTab, closeTab, closeOtherTabs, closeAllTabs } = useTabs();

function tabDisplayTitle(tab) {
  const base = resolveTabTitle(tab, t, te);
  // Internal Chat first — helpdesk/live resolvers must not swallow `internal`/`mention` segments.
  if (isInternalChatTabPath(tab?.path) || tab?.titleKey === 'navigation.internalChat') {
    const withInternal = resolveTabTitleWithInternalChatAlerts(tab, t, te);
    if (withInternal !== base) return withInternal;
  }
  const withHelpdesk = resolveTabTitleWithHelpdeskAlerts(tab, t, te);
  if (withHelpdesk !== base) return withHelpdesk;
  const withLiveChat = resolveTabTitleWithLiveChatAlerts(tab, t, te);
  if (withLiveChat !== base) return withLiveChat;
  return resolveTabTitleWithInternalChatAlerts(tab, t, te);
}

function tabHasHelpdeskAlert(tab) {
  return tabShowsHelpdeskAlert(tab, activeTabId.value);
}

function tabAlertIconColorClass(tab) {
  if (!tabHasHelpdeskAlert(tab)) {
    return activeTabId.value === tab.id
      ? 'text-gray-900 dark:text-white'
      : 'text-gray-600 dark:text-gray-400';
  }
  if (
    tab.alertKind === 'chat'
    || tab.alertKind === 'session'
    || tab.alertKind === 'internal'
    || tab.alertKind === 'mention'
  ) {
    return 'text-emerald-600 dark:text-emerald-400';
  }
  if (tab.alertKind === 'case') {
    return 'text-blue-600 dark:text-blue-400';
  }
  return 'text-amber-600 dark:text-amber-400';
}

function tabAlertRingClass(tab) {
  if (
    tab.alertKind === 'chat'
    || tab.alertKind === 'session'
    || tab.alertKind === 'internal'
    || tab.alertKind === 'mention'
  ) {
    return 'tab-helpdesk-alert-icon__ring--chat';
  }
  if (tab.alertKind === 'case') return 'tab-helpdesk-alert-icon__ring--case';
  return 'tab-helpdesk-alert-icon__ring--email';
}

function tabItemClasses(tab, index) {
  const active = activeTabId.value === tab.id;
  const alert = tabHasHelpdeskAlert(tab);
  const dragOver = dragOverTabId.value === tab.id;
  const nextTab = tabsArray.value[index + 1];
  const isLastTab = index === tabsArray.value.length - 1;
  const showInactiveSeparator =
    !active &&
    ((nextTab != null && activeTabId.value !== nextTab.id) || isLastTab);

  const base = [
    'group relative flex items-center min-w-0 px-3 h-full',
    'cursor-pointer select-none transition-all duration-150',
    'overflow-hidden',
  ];

  if (dragOver) {
    base.push('ring-2 ring-inset ring-primary-500/35');
  }

  if (active) {
    return [
      ...base,
      'tab-item--active z-10',
      'bg-white dark:bg-neutral-900',
    ];
  }

  const inactiveSeparator = showInactiveSeparator ? 'tab-item--separator' : '';

  if (alert) {
    return [
      ...base,
      'tab-item--inactive tab-item--inactive-alert',
      inactiveSeparator,
    ];
  }

  return [
    ...base,
    'tab-item--inactive',
    inactiveSeparator,
  ];
}

function tabTitleClasses(tab) {
  const active = activeTabId.value === tab.id;
  if (active) {
    return 'text-sm font-medium text-neutral-900 dark:text-neutral-100';
  }
  if (tabHasHelpdeskAlert(tab)) {
    return 'text-sm font-normal text-amber-950 dark:text-amber-100';
  }
  return 'text-sm font-normal text-neutral-600 dark:text-neutral-400';
}

const currentUserId = computed(() => authStore.user?._id || null);
const { currentPreset: userStatusPreset } = useUserStatus(currentUserId);

const showProfileDropdown = ref(false);
const profileDropdownRef = ref(null);

const toggleProfileDropdown = () => {
  showProfileDropdown.value = !showProfileDropdown.value;
};

const closeProfileDropdown = () => {
  showProfileDropdown.value = false;
};

function openNotificationsPanel() {
  window.dispatchEvent(new CustomEvent('arivu:open-notifications-panel'));
}

const vClickOutside = clickOutside;

// Create a computed to ensure reactivity in template
// Force reactivity by watching the ref directly
const tabsArray = computed(() => {
  // tabs is a ref, so access .value
  // Force dependency tracking by accessing .value
  const tabsValue = tabs.value || [];
  return tabsValue;
});

const isSettingsRouteActive = computed(() => route.path.startsWith('/settings'));

const tabBarRef = ref(null);

// Full-bleed under Nav on tablet (sidebar is overlay). Desktop: sticky in work column (PlatformShell already offsets).
const tabBarPositionStyle = { width: '100%', maxWidth: '100%', minWidth: 0 };

const updateTabBarOffset = () => {
  const el = tabBarRef.value;

  if (!(el instanceof HTMLElement) || getComputedStyle(el).display === 'none') {
    document.documentElement.style.removeProperty('--tabbar-offset');
    return;
  }

  const rect = el.getBoundingClientRect();
  const offset = Math.round(rect.bottom);

  document.documentElement.style.setProperty('--tabbar-offset', `${offset}px`);
};

// Drag and drop state
const draggedTabId = ref(null);
const dragOverTabId = ref(null);
const showContextMenu = ref(false);
const contextMenuTab = ref(null);
const contextMenuPosition = ref({ x: 0, y: 0 });

const hoveredPreviewTab = ref(null);
const hoveredPreviewAnchor = ref(null);
const previewEnabled = computed(
  () => !draggedTabId.value && !showContextMenu.value
);

function tryShowTabPreview(tab, tabEl) {
  if (!(tabEl instanceof HTMLElement) || !tab) return;
  const titleEl = tabEl.querySelector('[data-tab-title]');
  const { secondary } = getTabPreviewContext(tab, t, te);
  if (!shouldShowTabPreview(tab, {
    isTruncated: isTabTitleTruncated(titleEl),
    secondary,
  })) {
    return;
  }
  hoveredPreviewTab.value = tab;
  hoveredPreviewAnchor.value = tabEl;
}

function clearTabPreview() {
  hoveredPreviewTab.value = null;
  hoveredPreviewAnchor.value = null;
}

function handleTabsContainerMouseOver(event) {
  if (draggedTabId.value) return;
  const tabEl = event.target.closest('[data-tab-item]');
  if (!(tabEl instanceof HTMLElement)) return;
  const tabId = tabEl.dataset.tabId;
  const tab = tabsArray.value.find((item) => item.id === tabId);
  if (tab) tryShowTabPreview(tab, tabEl);
}

function handleTabsContainerMouseLeave() {
  releaseFrozenTabWidth();
  clearTabPreview();
}

// Chrome-style tab width freeze:
// While the cursor is over the tab strip and the user closes a tab via the X,
// the remaining tabs hold their current pixel width so the next X stays under
// the cursor. Widths un-freeze (and animate back) when the cursor leaves the
// tab area.
const tabsContainerRef = ref(null);
const frozenTabWidth = ref(null);

const tabItemStyle = computed(() => {
  if (frozenTabWidth.value !== null) {
    const w = `${frozenTabWidth.value}px`;
    return {
      flex: '0 0 auto',
      width: w,
      minWidth: '0',
      maxWidth: w,
    };
  }
  return {
    flex: '1 1 0',
    flexBasis: '0',
    minWidth: `${TAB_MIN_WIDTH_PX}px`,
    maxWidth: `${TAB_MAX_WIDTH_PX}px`,
  };
});

// Overflow menu + strip scroll (shrink to floor, then scroll — never squeeze past content)
const tabsOverflowing = ref(false);
const showOverflowMenu = ref(false);
const overflowMenuRef = ref(null);

const showOverflowButton = computed(
  () => tabsArray.value.length > 1 && (tabsOverflowing.value || tabsArray.value.length >= 8)
);

const updateTabsOverflow = () => {
  const el = tabsContainerRef.value;
  if (!(el instanceof HTMLElement)) {
    tabsOverflowing.value = false;
    return;
  }
  tabsOverflowing.value = el.scrollWidth > el.clientWidth + 1;
};

const scrollActiveTabIntoView = async () => {
  await nextTick();
  const container = tabsContainerRef.value;
  if (!(container instanceof HTMLElement) || !activeTabId.value) return;
  const activeEl = container.querySelector(`[data-tab-id="${CSS.escape(activeTabId.value)}"]`);
  if (!(activeEl instanceof HTMLElement)) {
    updateTabsOverflow();
    return;
  }
  // Scroll only the strip — avoid scrollIntoView bubbling to the page
  const cRect = container.getBoundingClientRect();
  const tRect = activeEl.getBoundingClientRect();
  if (tRect.left < cRect.left) {
    container.scrollLeft -= cRect.left - tRect.left;
  } else if (tRect.right > cRect.right) {
    container.scrollLeft += tRect.right - cRect.right;
  }
  updateTabsOverflow();
};

const handleTabsWheel = (event) => {
  const el = tabsContainerRef.value;
  if (!(el instanceof HTMLElement) || el.scrollWidth <= el.clientWidth) return;
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  event.preventDefault();
  el.scrollLeft += event.deltaY;
};

const toggleOverflowMenu = () => {
  showOverflowMenu.value = !showOverflowMenu.value;
  if (showOverflowMenu.value) clearTabPreview();
};

const closeOverflowMenu = () => {
  showOverflowMenu.value = false;
};

const handleOverflowSelectTab = (tabId) => {
  switchToTab(tabId);
  closeOverflowMenu();
  scrollActiveTabIntoView();
};

const handleOverflowCloseTab = (event, tabId) => {
  event.stopPropagation();
  closeTab(tabId);
};

const releaseFrozenTabWidth = () => {
  if (frozenTabWidth.value !== null) {
    frozenTabWidth.value = null;
    nextTick(() => updateTabsOverflow());
  }
};

// Handle tab click
const handleTabClick = (tabId) => {
  switchToTab(tabId);
};

// Handle tab close
const handleCloseTab = (event, tabId) => {
  event.stopPropagation();

  // Snapshot the current rendered width of a tab before removal so the
  // remaining tabs stay the same size until the cursor leaves the strip.
  const container = tabsContainerRef.value;
  if (container) {
    const sample = container.querySelector('[data-tab-item]');
    if (sample) {
      const w = sample.getBoundingClientRect().width;
      if (w > 0) frozenTabWidth.value = w;
    }
  }

  closeTab(tabId);
  nextTick(() => {
    updateTabsOverflow();
    scrollActiveTabIntoView();
  });
};

// Drag and drop handlers
const handleDragStart = (event, tabId) => {
  clearTabPreview();
  draggedTabId.value = tabId;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', tabId);
  
  // Add dragging class
  event.target.classList.add('opacity-50');
};

const handleDragEnd = (event) => {
  event.target.classList.remove('opacity-50');
  draggedTabId.value = null;
  dragOverTabId.value = null;
};

const handleDragOver = (event, tabId) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  
  if (draggedTabId.value !== tabId) {
    dragOverTabId.value = tabId;
  }
};

const handleDragLeave = () => {
  dragOverTabId.value = null;
};

const handleDrop = (event, targetTabId) => {
  event.preventDefault();
  
  if (draggedTabId.value && draggedTabId.value !== targetTabId) {
    // Find indices
    const fromIndex = tabs.value.findIndex(tab => tab.id === draggedTabId.value);
    const toIndex = tabs.value.findIndex(tab => tab.id === targetTabId);
    
    if (fromIndex !== -1 && toIndex !== -1) {
      // Reorder tabs
      const { reorderTabs } = useTabs();
      reorderTabs(fromIndex, toIndex);
    }
  }
  
  dragOverTabId.value = null;
};

// Context menu handlers
const handleContextMenu = (event, tab) => {
  event.preventDefault();
  clearTabPreview();
  contextMenuTab.value = tab;
  contextMenuPosition.value = {
    x: event.clientX,
    y: event.clientY
  };
  showContextMenu.value = true;
};

const handleCloseContextMenu = () => {
  showContextMenu.value = false;
  contextMenuTab.value = null;
};

const handleContextMenuAction = (action) => {
  if (!contextMenuTab.value) return;
  
  switch (action) {
    case 'close':
      closeTab(contextMenuTab.value.id);
      break;
    case 'close-others':
      closeOtherTabs(contextMenuTab.value.id);
      break;
    case 'close-all':
      closeAllTabs();
      break;
    case 'close-right':
      closeTabsToRight(contextMenuTab.value.id);
      break;
  }
  
  handleCloseContextMenu();
};

const closeTabsToRight = (tabId) => {
  const index = tabsArray.value.findIndex(tab => tab.id === tabId);
  if (index === -1) return;
  
  // Get tabs to the right that are closable
  const tabsToClose = tabsArray.value.slice(index + 1).filter(tab => tab.closable);
  tabsToClose.forEach(tab => closeTab(tab.id));
};

// Close context / overflow menus on click outside (profile menu uses v-click-outside)
const handleClickOutside = (event) => {
  if (showContextMenu.value) {
    handleCloseContextMenu();
  }
  if (
    showOverflowMenu.value &&
    overflowMenuRef.value instanceof HTMLElement &&
    !overflowMenuRef.value.contains(event.target)
  ) {
    closeOverflowMenu();
  }
};

const handleResize = () => {
  updateTabBarOffset();
  updateTabsOverflow();
};

const handleSidebarToggle = () => {
  nextTick(() => {
    updateTabBarOffset();
    updateTabsOverflow();
  });
};

let tabsResizeObserver = null;

watch(activeTabId, () => {
  scrollActiveTabIntoView();
});

watch(
  () => tabsArray.value.length,
  () => {
    nextTick(() => {
      updateTabsOverflow();
      scrollActiveTabIntoView();
    });
  }
);

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('resize', handleResize);
  window.addEventListener('sidebar-toggle', handleSidebarToggle);

  if (tabsArray.value.length === 0) {
    setTimeout(() => updateTabBarOffset(), 100);
  } else {
    nextTick(() => {
      updateTabBarOffset();
      updateTabsOverflow();
      scrollActiveTabIntoView();
    });
  }

  if (typeof ResizeObserver !== 'undefined') {
    tabsResizeObserver = new ResizeObserver(() => updateTabsOverflow());
    nextTick(() => {
      if (tabsContainerRef.value instanceof HTMLElement) {
        tabsResizeObserver.observe(tabsContainerRef.value);
      }
    });
  }
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('sidebar-toggle', handleSidebarToggle);
  document.documentElement.style.removeProperty('--tabbar-offset');
  if (tabsResizeObserver) {
    tabsResizeObserver.disconnect();
    tabsResizeObserver = null;
  }
});
</script>

<template>
  <div 
    ref="tabBarRef"
    :data-onboarding-target="tabsArray.some((tab) => tab.closable) ? 'tabs' : undefined"
    class="tab-strip bg-neutral-100 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-700 fixed top-[var(--mobile-top-offset)] left-0 right-0 z-30 transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:z-40 lg:w-full lg:max-w-full lg:flex-shrink-0 lg:border-b-0"
    :class="{ 'tab-strip--settings-active': isSettingsRouteActive }"
    :style="tabBarPositionStyle"
  >
    <div class="flex items-center h-11 min-w-0 w-full gap-2 px-2 sm:px-3 lg:pl-0 lg:pr-2" :style="{ width: '100%', maxWidth: '100%' }">
      <div
        ref="tabsContainerRef"
        class="tab-strip__scroller flex flex-1 min-w-0 items-center gap-0 h-full"
        @mouseleave="handleTabsContainerMouseLeave"
        @mouseover="handleTabsContainerMouseOver"
        @wheel="handleTabsWheel"
        @scroll="updateTabsOverflow"
      >
      <!-- Tabs - Chrome style: shrink to min-width floor, then scroll.
           Widths freeze on close until the cursor leaves the strip. -->
      <template v-if="tabsArray.length > 0">
        <div
          v-for="(tab, index) in tabsArray"
          :key="tab.id"
        data-tab-item
        :data-tab-id="tab.id"
        draggable="true"
        @dragstart="handleDragStart($event, tab.id)"
        @dragend="handleDragEnd"
        @dragover="handleDragOver($event, tab.id)"
        @dragleave="handleDragLeave"
        @drop="handleDrop($event, tab.id)"
        @click="handleTabClick(tab.id)"
        @contextmenu="handleContextMenu($event, tab)"
        :class="tabItemClasses(tab, index)"
        :style="tabItemStyle"
      >
        <!-- Icon (pulse + ring when unread helpdesk activity on background tab) -->
        <span
          class="relative flex h-5 w-5 flex-shrink-0 items-center justify-center mr-2"
          :class="{ 'tab-helpdesk-alert-icon': tabHasHelpdeskAlert(tab) }"
        >
          <span
            v-if="tabHasHelpdeskAlert(tab)"
            class="tab-helpdesk-alert-icon__ring pointer-events-none absolute inset-0 rounded-full"
            :class="tabAlertRingClass(tab)"
            aria-hidden="true"
          />
          <component
            :is="tab.icon"
            class="tab-helpdesk-alert-icon__glyph relative z-[1] h-5 w-5"
            :class="tabAlertIconColorClass(tab)"
          />
        </span>
        
        <!-- Title -->
        <span
          data-tab-title
          :class="[
            'overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0 leading-none',
            tabTitleClasses(tab),
          ]"
        >
          {{ tabDisplayTitle(tab) }}
        </span>
        
        <!-- Close button - collapses to 0 width when hidden -->
        <button
          v-if="tab.closable"
          @click="handleCloseTab($event, tab.id)"
          :aria-label="t('navigation.tabCloseTab')"
          :class="[
            'inline-flex items-center justify-center shrink-0 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-150 overflow-hidden h-6 w-6',
            activeTabId === tab.id
              ? 'opacity-100 ml-2'
              : 'opacity-0 w-0 ml-0 group-hover:opacity-100 group-hover:w-6 group-hover:ml-2'
          ]"
        >
          <XMarkIcon class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
        </button>
      </div>
      </template>
      </div>

      <!-- Overflow menu: jump to any tab when the strip is crowded -->
      <div
        v-if="showOverflowButton"
        ref="overflowMenuRef"
        class="relative flex-shrink-0 self-stretch flex items-center"
      >
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          :aria-label="t('navigation.tabMoreTabs')"
          :title="t('navigation.tabMoreTabs')"
          aria-haspopup="true"
          :aria-expanded="showOverflowMenu"
          @click.stop="toggleOverflowMenu"
        >
          <ChevronDownIcon class="h-4 w-4" aria-hidden="true" />
        </button>
        <transition
          enter-active-class="transition-all duration-100 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition-all duration-75 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="showOverflowMenu"
            class="absolute right-0 top-full mt-1 z-50 min-w-56 max-w-xs max-h-80 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1"
            role="menu"
            :aria-label="t('navigation.tabMoreTabs')"
            @click.stop
          >
            <div
              v-for="tab in tabsArray"
              :key="`overflow-${tab.id}`"
              role="menuitem"
              class="w-full flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              :class="activeTabId === tab.id
                ? 'bg-neutral-100 dark:bg-neutral-700/60 text-neutral-900 dark:text-neutral-100 font-medium'
                : 'text-gray-700 dark:text-gray-200'"
              @click="handleOverflowSelectTab(tab.id)"
            >
              <component
                :is="tab.icon"
                class="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400"
                aria-hidden="true"
              />
              <span class="flex-1 min-w-0 truncate">{{ tabDisplayTitle(tab) }}</span>
              <button
                v-if="tab.closable"
                type="button"
                class="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                :aria-label="t('navigation.tabCloseTab')"
                @click="handleOverflowCloseTab($event, tab.id)"
              >
                <XMarkIcon class="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              </button>
            </div>
          </div>
        </transition>
      </div>

      <!-- Tablet (md–lg): profile + bell live in Nav top bar (lg:hidden). Desktop (lg+): show here. -->
      <div
        v-if="authStore.user"
        class="hidden lg:flex relative flex-shrink-0 self-center items-center gap-3 pr-1"
      >
        <PortalSwitcher />
        <NotificationBell
          :show-count-on-desktop="true"
          class="!min-h-8 !min-w-8 !p-1 cursor-pointer rounded-md !border-0 !bg-transparent shadow-none hover:!bg-neutral-200 dark:hover:!bg-neutral-700 [&_svg]:!w-5 [&_svg]:!h-5 [&_span.notification-bell-badge]:min-w-4 [&_span.notification-bell-badge]:h-4 [&_span.notification-bell-badge]:text-[9px]"
          @toggle="openNotificationsPanel"
        />
        <ArivuAssistantLauncher />
        <div
          ref="profileDropdownRef"
          v-click-outside="closeProfileDropdown"
          class="relative z-50 flex items-center"
        >
          <button
            type="button"
            class="relative rounded-full overflow-visible w-8 h-8 flex-shrink-0 ring-1 ring-neutral-200 dark:ring-neutral-600 hover:ring-neutral-300 dark:hover:ring-neutral-500 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            :title="t('navigation.tabAccount')"
            aria-haspopup="true"
            :aria-expanded="showProfileDropdown"
            @click.stop="toggleProfileDropdown"
          >
            <AvatarInitials
              :first-name="authStore.user?.firstName"
              :last-name="authStore.user?.lastName"
              :email="authStore.user?.email"
              :username="authStore.user?.username"
              :avatar="authStore.user?.avatar"
              size="sm"
            />
            <span
              :class="[
                'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-800',
                userStatusPreset.dotClass
              ]"
              aria-hidden="true"
            />
          </button>
          <UserMenu :open="showProfileDropdown" align="right" @close="closeProfileDropdown" />
        </div>
      </div>
    </div>
    
    <!-- Context Menu -->
    <transition
      enter-active-class="transition-all duration-100 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-75 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showContextMenu && contextMenuTab"
        :style="{
          position: 'fixed',
          left: `${contextMenuPosition.x}px`,
          top: `${contextMenuPosition.y}px`,
          zIndex: 9999
        }"
        class="min-w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1"
        @click.stop
      >
        <!-- Close -->
        <button
          v-if="contextMenuTab.closable"
          @click="handleContextMenuAction('close')"
          class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
        >
          {{ t('navigation.tabClose') }}
        </button>
        
        <!-- Close Others -->
        <button
          @click="handleContextMenuAction('close-others')"
          class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
        >
          {{ t('navigation.tabCloseOthers') }}
        </button>
        
        <!-- Close Tabs to the Right -->
        <button
          @click="handleContextMenuAction('close-right')"
          class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
        >
          {{ t('navigation.tabCloseToRight') }}
        </button>
        
        <div class="my-1 border-t border-gray-200 dark:border-gray-700"></div>
        
        <!-- Close All -->
        <button
          @click="handleContextMenuAction('close-all')"
          class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
        >
          {{ t('navigation.tabCloseAll') }}
        </button>
      </div>
    </transition>

    <TabHoverPreview
      :tab="hoveredPreviewTab"
      :anchor-el="hoveredPreviewAnchor"
      :enabled="previewEnabled"
    />
  </div>
</template>

<style scoped>
.tab-strip {
  --tab-strip-padding-y: 0.1875rem;
  --tab-strip-separator-inset-y: 0.625rem;
}

/* Contained horizontal scroll — never leaks to body (see HORIZONTAL_SCROLL_FIX) */
.tab-strip__scroller {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.tab-strip__scroller::-webkit-scrollbar {
  display: none;
}

@media (min-width: 1024px) {
  /* Overlap the content surface by 1px so the active tab white bridges cleanly */
  .tab-strip--settings-active {
    margin-bottom: -1px;
  }
}

[data-tab-item] {
  align-self: stretch;
  display: flex;
  align-items: center;
}

/* Compact hover pill + separator share padded vertical inset */
.tab-item--inactive::before {
  content: '';
  position: absolute;
  left: 0.375rem;
  right: 0.375rem;
  top: var(--tab-strip-padding-y);
  bottom: var(--tab-strip-padding-y);
  height: auto;
  border-radius: 0.25rem;
  opacity: 0;
  transition: opacity 150ms ease;
  pointer-events: none;
  z-index: 0;
}

.tab-item--inactive:hover::before {
  opacity: 1;
  background-color: color-mix(in srgb, var(--color-neutral-200) 70%, transparent);
}

.tab-item--inactive-alert:hover::before {
  background-color: color-mix(in srgb, var(--color-warning-200) 80%, transparent);
}

.tab-item--inactive > * {
  position: relative;
  z-index: 1;
}

/* Short vertical separator between inactive tabs (Chrome-style) */
.tab-item--separator::after {
  content: '';
  position: absolute;
  right: 0.375rem;
  top: var(--tab-strip-separator-inset-y);
  bottom: var(--tab-strip-separator-inset-y);
  width: 1px;
  height: auto;
  background-color: var(--color-neutral-300);
  opacity: 0.45;
  pointer-events: none;
  z-index: 1;
  transition: opacity 120ms ease;
}


.tab-item--separator:hover::after,
.tab-item--separator:has(+ [data-tab-item]:hover)::after {
  opacity: 0;
}

/* Active tab surface continues into content (Chrome-style) */
.tab-item--active {
  border-top-left-radius: 0.5rem;
  border-top-right-radius: 0.5rem;
  box-shadow: 0 1px 0 0 #ffffff;
}


@keyframes tab-helpdesk-icon-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.18);
  }
}

@keyframes tab-helpdesk-icon-wiggle {
  0%,
  100% {
    transform: rotate(0deg) scale(1);
  }
  20% {
    transform: rotate(-8deg) scale(1.12);
  }
  40% {
    transform: rotate(8deg) scale(1.14);
  }
  60% {
    transform: rotate(-5deg) scale(1.1);
  }
  80% {
    transform: rotate(4deg) scale(1.08);
  }
}

@keyframes tab-helpdesk-icon-ring {
  0% {
    transform: scale(0.75);
    opacity: 0.65;
  }
  100% {
    transform: scale(2.2);
    opacity: 0;
  }
}

.tab-helpdesk-alert-icon__glyph {
  transform-origin: center;
}

.tab-helpdesk-alert-icon .tab-helpdesk-alert-icon__glyph {
  animation: tab-helpdesk-icon-wiggle 1.35s ease-in-out infinite;
}

.tab-helpdesk-alert-icon__ring--email {
  background-color: rgb(245 158 11 / 0.45);
  animation: tab-helpdesk-icon-ring 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.tab-helpdesk-alert-icon__ring--chat {
  background-color: rgb(16 185 129 / 0.4);
  animation: tab-helpdesk-icon-ring 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.tab-helpdesk-alert-icon__ring--case {
  background-color: rgb(59 130 246 / 0.4);
  animation: tab-helpdesk-icon-ring 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.tab-helpdesk-alert-icon:has(.tab-helpdesk-alert-icon__ring--chat) .tab-helpdesk-alert-icon__glyph,
.tab-helpdesk-alert-icon:has(.tab-helpdesk-alert-icon__ring--case) .tab-helpdesk-alert-icon__glyph {
  animation: tab-helpdesk-icon-pulse 1.1s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .tab-helpdesk-alert-icon__glyph,
  .tab-helpdesk-alert-icon__ring {
    animation: none !important;
  }

  .tab-helpdesk-alert-icon__glyph {
    transform: scale(1.1);
  }
}
</style>

<style>
/* Unscoped: Vue scoped :global(html.dark) compiles onto <html>, so dark overrides never apply. */
html.dark .tab-item--inactive:hover::before {
  background-color: rgb(255 255 255 / 0.06);
}

html.dark .tab-item--inactive-alert:hover::before {
  background-color: color-mix(in srgb, var(--color-warning-900) 55%, transparent);
}

html.dark .tab-item--separator::after {
  background-color: var(--color-neutral-600);
  opacity: 0.65;
}

html.dark .tab-item--active {
  box-shadow: 0 1px 0 0 var(--color-neutral-900);
}
</style>
