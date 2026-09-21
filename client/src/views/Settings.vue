<template>
    <div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div class="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <!-- Split-pane layout: floating rail + content (matches Inbox nested panel pattern) -->
      <div
        class="flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-2 lg:p-2"
        :class="railFlyoutOpen ? 'lg:overflow-visible' : 'overflow-hidden'"
      >
        <!-- Mobile: open settings sections without stacking the full rail in-flow -->
        <div
          class="flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900 lg:hidden"
        >
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            :aria-label="t('settings.expandSidebar')"
            :title="t('settings.expandSidebar')"
            @click="mobileNavOpen = true"
          >
            <Bars3Icon class="h-5 w-5" aria-hidden="true" />
          </button>
          <span class="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {{ mobileSettingsTitle }}
          </span>
        </div>

        <div
          v-if="mobileNavOpen"
          class="absolute inset-0 z-40 bg-black/40 lg:hidden"
          aria-hidden="true"
          @click="mobileNavOpen = false"
        />

        <!-- Flex slot: collapsed reserves 3.5rem; hover flyout overlays without shifting content -->
        <div
          class="relative shrink-0 self-stretch flex-none lg:transition-[width] lg:duration-200 lg:ease-in-out"
          :class="[
            mobileNavOpen
              ? 'max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-64'
              : 'max-lg:hidden',
            railSlotWidthClass,
            railFlyoutOpen ? 'lg:overflow-visible lg:z-30' : 'overflow-hidden',
          ]"
        >
          <aside
            @mouseenter="handleMouseEnter"
            @mouseleave="handleMouseLeave"
            :class="[
              'settings-rail flex min-h-0 flex-col overflow-hidden',
              'bg-white dark:bg-neutral-900',
              NESTED_PANEL_FLOATING_LG_CLASS,
              'max-lg:h-full max-lg:w-64 max-lg:border-r max-lg:border-neutral-200 dark:max-lg:border-neutral-700',
              'max-lg:shadow-xl',
              'lg:absolute lg:inset-y-0 lg:left-0 lg:z-20',
              'lg:transition-[width] lg:duration-200 lg:ease-in-out',
              railAsideWidthClass,
            ]"
          >
            <!-- Fixed expanded layout; outer width clips labels when narrow -->
            <div class="flex h-full w-64 min-w-64 flex-col">
              <div class="flex min-h-[2.75rem] shrink-0 items-center border-b border-neutral-200/80 dark:border-neutral-700/80">
                <div class="flex w-[3.5rem] shrink-0 justify-center py-2">
                  <button
                    type="button"
                    @click="onRailHeaderButtonClick"
                    :title="railHeaderButtonTitle"
                    class="flex-shrink-0 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
                  >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                </div>
                <h2
                  v-if="railShowsFullLabels"
                  class="min-w-0 flex-1 truncate py-2 pr-3 text-left text-[0.875rem] font-semibold text-neutral-900 dark:text-neutral-100"
                >
                  {{ t('navigation.settings') }}
                </h2>
              </div>

              <nav class="min-h-0 flex-1 overflow-y-auto px-[0.5rem] py-2">
                <ul class="space-y-0.5">
                  <li>
                    <button
                      @click="goToOverview"
                      :title="isCollapsed && !railShowsFullLabels ? t('settings.navOverview') : ''"
                      :class="settingsRailItemClass(!activeTab)"
                    >
                      <span class="flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center">
                        <svg class="h-[1.125rem] w-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </span>
                      <span v-if="railShowsFullLabels" class="min-w-0 flex-1 truncate text-left">{{ t('settings.navOverview') }}</span>
                    </button>
                  </li>
                  <template v-for="(tab, idx) in tabs" :key="tab.id">
                    <li>
                      <button
                        @click="handleTabClick(tab)"
                        :title="isCollapsed && !railShowsFullLabels ? t(tab.nameKey) : ''"
                        :class="settingsRailItemClass(activeTab === tab.id || (tab.id === 'notifications' && route.path.includes('/notifications')))"
                      >
                        <span class="flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center">
                          <component :is="tab.icon" class="h-[1.125rem] w-[1.125rem]" />
                        </span>
                        <span v-if="railShowsFullLabels" class="min-w-0 flex-1 truncate text-left">{{ t(tab.nameKey) }}</span>
                      </button>
                    </li>
                    <li v-if="railSectionLabelAfter(tab.id) && idx < tabs.length - 1">
                      <hr class="my-2 shrink-0 border-neutral-200 dark:border-neutral-700" />
                      <div
                        :class="[
                          SETTINGS_RAIL_SECTION_LABEL_CLASS,
                          !railShowsFullLabels && 'flex w-[calc(0.5rem+1.125rem+0.5rem)] shrink-0 items-center justify-center px-[0.5rem]',
                        ]"
                      >
                        {{ railShowsFullLabels ? t(railSectionLabelAfter(tab.id)) : '·' }}
                      </div>
                    </li>
                  </template>

                  <template v-if="isInternalEnvironment">
                    <li v-if="railShowsFullLabels">
                      <hr class="my-2 border-neutral-200 dark:border-neutral-700" />
                    </li>
                    <li v-if="railShowsFullLabels">
                      <div :class="SETTINGS_RAIL_SECTION_LABEL_CLASS">
                        {{ t('settings.navInternal') }}
                      </div>
                    </li>
                    <li v-for="internalTab in internalTabs" :key="internalTab.id">
                      <button
                        @click="handleTabClick(internalTab)"
                        :title="isCollapsed && !railShowsFullLabels ? t(internalTab.nameKey) : ''"
                        :class="settingsRailItemClass(activeTab === internalTab.id || route.path.includes(internalTab.path))"
                      >
                        <span class="flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center">
                          <component :is="internalTab.icon" class="h-[1.125rem] w-[1.125rem]" />
                        </span>
                        <span v-if="railShowsFullLabels" class="min-w-0 flex-1 truncate text-left">{{ t(internalTab.nameKey) }}</span>
                      </button>
                    </li>
                  </template>
                </ul>
              </nav>
            </div>
          </aside>
        </div>

        <!-- Right: Content -->
        <section
          :class="[
            'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-neutral-900',
            isDeepSettingsView ? 'p-4 lg:p-5' : 'p-5 lg:p-6'
          ]"
        >
          <AppsSettings
            v-if="activeTab === 'applications' && route.query.app"
            class="flex min-h-0 flex-1 flex-col overflow-hidden"
          />
          <SettingsLandingPage
            v-else-if="!activeTab || activeTab === 'landing'"
            class="flex min-h-0 flex-1 flex-col overflow-hidden"
          />
          <CoreModuleDetail
            v-else-if="activeTab === 'core-modules' && route.query.moduleKey"
            class="flex min-h-0 flex-1 flex-col overflow-hidden"
          />
          <ApplicationDetail
            v-else-if="activeTab === 'applications' && route.query.appKey && !route.query.app"
            class="flex min-h-0 flex-1 flex-col overflow-hidden"
          />
          <AppManagement
            v-else-if="activeTab === 'applications' && route.query.view === 'management'"
            class="flex min-h-0 flex-1 flex-col overflow-hidden"
          />
          <SubscriptionDetail
            v-else-if="activeTab === 'subscriptions' && route.query.appKey"
            class="flex min-h-0 flex-1 flex-col overflow-hidden"
          />
          <component
            v-else-if="activeTab === 'notifications' || route.path.includes('/notifications')"
            :is="currentTabComponent"
            class="flex min-h-0 flex-1 flex-col overflow-hidden"
          />
          <component
            v-else
            :is="currentTabComponent"
            class="flex min-h-0 flex-1 flex-col overflow-hidden"
          />
        </section>
      </div>
    </div>

    <SettingsQuickJump
      :open="quickJumpOpen"
      :access-ctx="settingsAccessCtx"
      @close="quickJumpOpen = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, h, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Bars3Icon } from '@heroicons/vue/24/outline';

const { t } = useI18n();
import { useAuthStore } from '@/stores/authRegistry';
import { useRecentSettingsTabs } from '@/composables/useRecentSettingsTabs';
import { canAccessSettingsTab } from '@/utils/settingsTabAccess';
import {
  SETTINGS_RAIL_ITEM_BASE_CLASS,
  SETTINGS_RAIL_ITEM_COLLAPSED_CLASS,
  SETTINGS_RAIL_ITEM_ACTIVE_CLASS,
  SETTINGS_RAIL_ITEM_INACTIVE_CLASS,
  SETTINGS_RAIL_SECTION_LABEL_CLASS,
} from '@/components/settings/settingsSaveBar';
import { NESTED_PANEL_FLOATING_LG_CLASS } from '@/utils/sidebarLayout';
import { useColorMode } from '@/composables/useColorMode';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import SettingsQuickJump from '@/components/settings/SettingsQuickJump.vue';

const ProfileSettings = defineAsyncComponent(() => import('@/components/settings/ProfileSettings.vue'));
const OrganizationSettings = defineAsyncComponent(() => import('@/components/settings/OrganizationSettings.vue'));
const SecuritySettings = defineAsyncComponent(() => import('@/components/settings/SecuritySettings.vue'));
const IntegrationsSettings = defineAsyncComponent(() => import('@/components/settings/IntegrationsSettings.vue'));
const AiSettings = defineAsyncComponent(() => import('@/components/settings/AiSettings.vue'));
const UsersAccessSettings = defineAsyncComponent(() => import('@/components/settings/UsersAccessSettings.vue'));
const AppsSettings = defineAsyncComponent(() => import('@/components/settings/AppsSettings.vue'));
const SettingsLandingPage = defineAsyncComponent(() => import('@/components/settings/SettingsLandingPage.vue'));
const CoreModulesList = defineAsyncComponent(() => import('@/components/settings/CoreModulesList.vue'));
const CoreModuleDetail = defineAsyncComponent(() => import('@/components/settings/CoreModuleDetail.vue'));
const ApplicationsList = defineAsyncComponent(() => import('@/components/settings/ApplicationsList.vue'));
const AddonsSettings = defineAsyncComponent(() => import('@/components/settings/AddonsSettings.vue'));
const ApplicationDetail = defineAsyncComponent(() => import('@/components/settings/ApplicationDetail.vue'));
const AppManagement = defineAsyncComponent(() => import('@/components/settings/AppManagement.vue'));
const SubscriptionsList = defineAsyncComponent(() => import('@/components/settings/SubscriptionsList.vue'));
const SubscriptionDetail = defineAsyncComponent(() => import('@/components/settings/SubscriptionDetail.vue'));
const NotificationSettings = defineAsyncComponent(() => import('@/components/settings/NotificationSettings.vue'));
const DemoRequests = defineAsyncComponent(() => import('@/views/DemoRequests.vue'));
const InstanceManagement = defineAsyncComponent(() => import('@/views/InstanceManagement.vue'));
const AutomationSettings = defineAsyncComponent(() => import('@/components/settings/AutomationSettings.vue'));
const CatalogSettingsHub = defineAsyncComponent(() => import('@/components/settings/CatalogSettingsHub.vue'));
const InventorySettings = defineAsyncComponent(() => import('@/components/settings/InventorySettings.vue'));
const PerformanceSettings = defineAsyncComponent(() => import('@/components/settings/PerformanceSettings.vue'));
const BusinessHoursSettings = defineAsyncComponent(() => import('@/components/settings/BusinessHoursSettings.vue'));
const CurrencySettings = defineAsyncComponent(() => import('@/components/settings/CurrencySettings.vue'));
const WebformsSettings = defineAsyncComponent(() => import('@/components/settings/WebformsSettings.vue'));
const SettingsAuditLog = defineAsyncComponent(() => import('@/components/settings/SettingsAuditLog.vue'));

const authStore = useAuthStore();
const { colorMode, toggleColorMode } = useColorMode();
const { record: recordRecentSettingsTab } = useRecentSettingsTabs();

const SETTINGS_TAB_KEY = 'arivu-settings-active-tab';
/** Full route (path+query) of the last Settings sub-page — survives workspace/browser tab switches. */
const SETTINGS_LAST_ROUTE_KEY = 'arivu-settings-last-route';
const route = useRoute();
const router = useRouter();
const activeTab = ref(route.query.tab || null);
const quickJumpOpen = ref(false);

function clearPersistedSettingsRoute() {
  try {
    localStorage.removeItem(SETTINGS_TAB_KEY);
    localStorage.removeItem(SETTINGS_LAST_ROUTE_KEY);
  } catch {
    // private mode / quota
  }
}

function persistSettingsRoute() {
  try {
    const pathOnly = String(route.path || '').split('?')[0];
    const isSettingsShell = pathOnly === '/settings' || pathOnly.startsWith('/settings/');
    if (!isSettingsShell) return;

    const tab = route.query.tab;
    if (typeof tab === 'string' && tab) {
      localStorage.setItem(SETTINGS_TAB_KEY, tab);
      localStorage.setItem(SETTINGS_LAST_ROUTE_KEY, route.fullPath);
      return;
    }
    if (pathOnly.includes('/notifications')) {
      localStorage.setItem(SETTINGS_TAB_KEY, 'notifications');
      localStorage.setItem(SETTINGS_LAST_ROUTE_KEY, route.fullPath);
    }
  } catch {
    // private mode / quota
  }
}

/** Section labels inserted in the rail after these tab ids (scannable groups). */
function railSectionLabelAfter(tabId) {
  const staticAfter = {
    // Personal lane ends after notifications (profile + notification prefs)
    notifications: 'settings.navWorkspace',
    'users-access': 'settings.navRailApps',
  };
  // If notifications is hidden for some reason, keep WORKSPACE after profile
  if (tabId === 'profile' && !tabs.value.some((t) => t.id === 'notifications')) {
    return 'settings.navWorkspace';
  }
  if (staticAfter[tabId]) return staticAfter[tabId];

  const tabIds = tabs.value.map((t) => t.id);

  const appsGroup = new Set(['applications', 'addons', 'catalog', 'inventory']);
  let appsEnd = '';
  for (const id of tabIds) {
    if (appsGroup.has(id)) appsEnd = id;
  }
  if (appsEnd && tabId === appsEnd) return 'settings.navRailOperations';

  const opsGroup = new Set(['automation', 'webforms', 'performance']);
  let opsEnd = '';
  for (const id of tabIds) {
    if (opsGroup.has(id)) opsEnd = id;
  }
  if (opsEnd && tabId === opsEnd) return 'settings.navRailAccount';

  return '';
}

const isDeepAppConfig = computed(() =>
  activeTab.value === 'applications'
  && typeof route.query.app === 'string'
  && route.query.app.length > 0
);

const isDeepAutomationConfig = computed(() =>
  activeTab.value === 'automation'
  && (
    typeof route.query.automationView === 'string'
    || typeof route.query.assignmentApp === 'string'
  )
);

const isDeepWebformConfig = computed(() =>
  activeTab.value === 'webforms'
  && typeof route.query.webformId === 'string'
  && route.query.webformId.length > 0
);

const isDeepSettingsView = computed(() =>
  isDeepAppConfig.value || isDeepAutomationConfig.value || isDeepWebformConfig.value
);

// Navigate back function
const goBack = () => {
  // Check if we can go back in history
  // For new tabs, history.length might be 1, so check if there's a referrer
  const hasHistory = window.history.length > 1 || document.referrer;
  
  if (hasHistory && window.history.length > 1) {
    // Try to go back
    router.go(-1);
  } else {
    // If no history (e.g., opened in new tab), go to platform home
    router.push('/platform/home');
  }
};

// Collapsible left rail behavior (mirrors main nav)
const RAIL_WIDTH_TRANSITION_MS = 200;
const isCollapsed = ref(localStorage.getItem('arivu-settings-collapsed') === 'true');
const isHovering = ref(false);
const isFlyoutClosing = ref(false);
const mobileNavOpen = ref(false);
let flyoutCloseTimer = null;

const railFlyoutOpen = computed(() => isCollapsed.value && (isHovering.value || isFlyoutClosing.value));
const railShowsFullLabels = computed(() => (
  mobileNavOpen.value
  || !isCollapsed.value
  || isHovering.value
  || isFlyoutClosing.value
));
const railSlotWidthClass = computed(() => (isCollapsed.value ? 'lg:w-[3.5rem]' : 'lg:w-64'));
const railAsideWidthClass = computed(() => {
  if (!isCollapsed.value || isHovering.value) return 'lg:w-64';
  return 'lg:w-[3.5rem]';
});

const mobileSettingsTitle = computed(() => {
  if (!activeTab.value) return t('settings.navOverview');
  const tab = tabs.value.find((item) => item.id === activeTab.value)
    || internalTabs.value.find((item) => item.id === activeTab.value);
  return tab?.nameKey ? t(tab.nameKey) : t('navigation.settings');
});

const railHeaderButtonTitle = computed(() => (
  mobileNavOpen.value
    ? t('actions.close')
    : (isCollapsed.value ? t('settings.expandSidebar') : t('settings.collapseSidebar'))
));

function clearFlyoutCloseTimer() {
  if (flyoutCloseTimer) {
    clearTimeout(flyoutCloseTimer);
    flyoutCloseTimer = null;
  }
}

const toggleSidebar = () => {
  clearFlyoutCloseTimer();
  isFlyoutClosing.value = false;
  isHovering.value = false;
  isCollapsed.value = !isCollapsed.value;
};

const onRailHeaderButtonClick = () => {
  if (mobileNavOpen.value) {
    mobileNavOpen.value = false;
    return;
  }
  toggleSidebar();
};

const goToOverview = () => {
  // Explicit Settings Home navigation — do not re-open the last sub-page.
  clearPersistedSettingsRoute();
  activeTab.value = null;
  mobileNavOpen.value = false;
  router.push('/settings');
};

const handleMouseEnter = () => {
  if (!isCollapsed.value) return;
  clearFlyoutCloseTimer();
  isFlyoutClosing.value = false;
  isHovering.value = true;
};
const handleMouseLeave = () => {
  if (!isCollapsed.value) {
    isHovering.value = false;
    return;
  }
  isHovering.value = false;
  isFlyoutClosing.value = true;
  clearFlyoutCloseTimer();
  flyoutCloseTimer = setTimeout(() => {
    isFlyoutClosing.value = false;
    flyoutCloseTimer = null;
  }, RAIL_WIDTH_TRANSITION_MS);
};

onUnmounted(clearFlyoutCloseTimer);

function settingsRailItemClass(active) {
  return [
    SETTINGS_RAIL_ITEM_BASE_CLASS,
    !railShowsFullLabels.value && SETTINGS_RAIL_ITEM_COLLAPSED_CLASS,
    active ? SETTINGS_RAIL_ITEM_ACTIVE_CLASS : SETTINGS_RAIL_ITEM_INACTIVE_CLASS,
  ];
}

watch(isCollapsed, (v) => localStorage.setItem('arivu-settings-collapsed', v.toString()));

// Icon components as functions
const ProfileIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
  })
]);

const UsersIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
  })
]);

const PlatformIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
  })
]);

const CurrencyIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  })
]);

const SecurityIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
  })
]);

const CRMIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
  }),
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'
  })
]);

const GroupsIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
  })
]);

const AppsIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
  })
]);

const AddonsIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z'
  })
]);

const BusinessHoursIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
  })
]);

const AutomationIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M13 10V3L4 14h7v7l9-11h-7z'
  })
]);

const InventoryIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'
  })
]);

const CatalogIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
  })
]);

const WebformsIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
  })
]);

const PerformanceIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
  })
]);

const BellIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
  })
]);

const AuditLogIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'
  })
]);

const settingsAccessCtx = computed(() => ({
  isOwner: !!authStore.user?.isOwner,
  role: authStore.user?.role,
  permissions: authStore.user?.permissions,
  entitledAddons: authStore.user?.entitledAddons || null,
  inventoryEnabled: authStore.inventoryEnabled === true,
  userType: authStore.user?.userType,
}));

const tabs = computed(() => {
  const all = [
    { id: 'profile', nameKey: 'settings.tabProfile', icon: ProfileIcon, component: ProfileSettings },
    { id: 'notifications', nameKey: 'settings.tabNotifications', icon: BellIcon, component: NotificationSettings },
    { id: 'organization', nameKey: 'settings.tabCompany', icon: PlatformIcon, component: OrganizationSettings },
    { id: 'currency', nameKey: 'settings.tabCurrency', icon: CurrencyIcon, component: CurrencySettings },
    { id: 'business-hours', nameKey: 'settings.tabBusinessHours', icon: BusinessHoursIcon, component: BusinessHoursSettings },
    { id: 'users-access', nameKey: 'settings.tabUsersAccess', icon: UsersIcon, component: UsersAccessSettings },
    { id: 'core-modules', nameKey: 'settings.tabCoreModules', icon: CoreModulesIcon, component: CoreModulesList },
    { id: 'applications', nameKey: 'settings.tabApplications', icon: AppsIcon, component: ApplicationsList },
    { id: 'addons', nameKey: 'settings.tabAddons', icon: AddonsIcon, component: AddonsSettings },
    { id: 'catalog', nameKey: 'settings.tabCatalog', icon: CatalogIcon, component: CatalogSettingsHub },
    { id: 'inventory', nameKey: 'settings.tabInventory', icon: InventoryIcon, component: InventorySettings },
    { id: 'automation', nameKey: 'settings.tabAutomation', icon: AutomationIcon, component: AutomationSettings },
    { id: 'webforms', nameKey: 'settings.tabWebforms', icon: WebformsIcon, component: WebformsSettings },
    { id: 'performance', nameKey: 'settings.tabPerformance', icon: PerformanceIcon, component: PerformanceSettings },
    { id: 'subscriptions', nameKey: 'settings.tabSubscriptions', icon: SubscriptionsIcon, component: SubscriptionsList },
    { id: 'security', nameKey: 'settings.tabSecurity', icon: SecurityIcon, component: SecuritySettings },
    { id: 'integrations', nameKey: 'settings.tabIntegrations', icon: IntegrationsIcon, component: IntegrationsSettings },
    { id: 'ai', nameKey: 'settings.tabAi', icon: AiIcon, component: AiSettings },
    { id: 'audit-log', nameKey: 'settings.tabAuditLog', icon: AuditLogIcon, component: SettingsAuditLog },
  ];
  const ctx = settingsAccessCtx.value;
  return all.filter((tab) => canAccessSettingsTab(tab.id, ctx));
});

const SubscriptionsIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
  })
]);

const IntegrationsIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
  })
]);

const AiIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
  })
]);

const CoreModulesIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4'
  })
]);

// Internal section icons
const DemoRequestsIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
  })
]);

const InstancesIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
  })
]);

// Internal tooling: dev build only AND master org (same intent as routes with requiresMasterOrganization)
const isInternalEnvironment = computed(() => {
  return import.meta.env.DEV === true && authStore.isMasterOrganization;
});

// Internal section tabs (environment-gated)
const internalTabs = computed(() => {
  if (!isInternalEnvironment.value) return [];
  
  return [
    {
      id: 'demo-requests',
      nameKey: 'settings.tabDemoRequests',
      icon: DemoRequestsIcon,
      component: DemoRequests,
      path: '/settings/demo-requests'
    },
    {
      id: 'instances',
      nameKey: 'settings.tabInstances',
      icon: InstancesIcon,
      component: InstanceManagement,
      path: '/settings/instances'
    }
  ];
});

// User dropdown actions
const toggleColorModeFromMenu = () => {
  const newMode = colorMode.value === 'light' ? 'dark' : 'light';
  toggleColorMode(newMode);
};

const handleLogout = () => {
  authStore.logout();
  router.replace('/login');
  authStore.error = null;
};

const userMenuItems = computed(() => [
  { name: `Mode: ${colorMode.value === 'light' ? '🌙 Light' : '☀️ Dark'}`, action: toggleColorModeFromMenu, isModeToggle: true },
  { name: 'Sign out', action: handleLogout, divider: true, isLogout: true },
]);

// Handle tab click - special handling for notifications and internal tabs
function handleTabClick(tab) {
  if (tab.id === 'notifications') {
    activeTab.value = 'notifications';
    // Use query parameters instead of route paths to stay within Settings
    router.replace({ path: '/settings', query: { ...route.query, tab: 'notifications', notificationPage: 'preferences' } });
  } else if (tab.id === 'addons') {
    activeTab.value = 'addons';
    router.replace({ path: '/settings', query: { tab: 'addons' } });
  } else if (tab.id === 'catalog') {
    activeTab.value = 'catalog';
    router.replace({ path: '/settings', query: { tab: 'catalog' } });
  } else if (tab.id === 'inventory') {
    activeTab.value = 'inventory';
    router.replace({ path: '/settings', query: { tab: 'inventory' } });
  } else if (tab.id === 'automation') {
    activeTab.value = 'automation';
    router.replace({ path: '/settings', query: { tab: 'automation' } });
  } else if (tab.id === 'performance') {
    activeTab.value = 'performance';
    router.replace({ path: '/settings', query: { tab: 'performance' } });
  } else if (tab.id === 'webforms') {
    activeTab.value = 'webforms';
    router.replace({ path: '/settings', query: { tab: 'webforms' } });
  } else if (tab.path) {
    // Internal tabs use query parameters to stay within Settings layout
    activeTab.value = tab.id;
    router.replace({ path: '/settings', query: { ...route.query, tab: tab.id } });
  } else {
    activeTab.value = tab.id;
  }
  mobileNavOpen.value = false;
}

const currentTabComponent = computed(() => {
  if (!activeTab.value) return null;
  
  // Handle detail views
  if (activeTab.value === 'core-modules' && route.query.moduleKey) {
    return CoreModuleDetail;
  }
  if (activeTab.value === 'applications' && route.query.appKey && !route.query.app) {
    return ApplicationDetail;
  }
  if (activeTab.value === 'subscriptions' && route.query.appKey) {
    return SubscriptionDetail;
  }
  
  // Check internal tabs first (environment-gated)
  const internalTab = internalTabs.value.find(t => t.id === activeTab.value);
  if (internalTab) {
    return internalTab.component;
  }
  
  // Then check regular tabs
  const tab = tabs.value.find(t => t.id === activeTab.value);
  return tab?.component || null;
});

// Sync tab with URL (?tab=roles)
const syncTabFromRoute = () => {
  const q = route.query.tab;
  if (typeof q === 'string') {
    const exists = tabs.value.some(t => t.id === q) || internalTabs.value.some(t => t.id === q);
    if (exists) {
      activeTab.value = q;
    } else {
      activeTab.value = null;
      const nextQuery = { ...route.query };
      delete nextQuery.tab;
      router.replace({ path: '/settings', query: nextQuery });
    }
  } else if (route.path.includes('/notifications') && !route.query.tab) {
    // If directly navigating to a notification route, set tab but don't change path
    activeTab.value = 'notifications';
  }
};
syncTabFromRoute();

watch(() => route.query.tab, () => {
  syncTabFromRoute();
});

watch(
  () => [route.query.tab, route.query.app, route.query.config, route.query.automationView, route.query.inventoryView],
  () => {
    if (
      route.query.tab === 'applications'
      && route.query.app === 'helpdesk'
      && route.query.config === 'execution-settings'
    ) {
      router.replace({ path: '/settings', query: { tab: 'automation', automationView: 'sla' } });
      return;
    }
    // Legacy Taxes URL → Inventory Settings
    if (route.query.tab === 'automation' && route.query.automationView === 'taxes') {
      router.replace({ path: '/settings', query: { tab: 'inventory', inventoryView: 'taxes' } });
      return;
    }
    // Legacy Catalog URL → Catalog Settings
    if (route.query.tab === 'automation' && route.query.automationView === 'catalog') {
      const query = { tab: 'catalog' };
      if (typeof route.query.catalogView === 'string' && route.query.catalogView) {
        query.catalogView = route.query.catalogView;
      }
      router.replace({ path: '/settings', query });
      return;
    }
    // Legacy Item Groups URL → Catalog Settings
    if (route.query.tab === 'inventory' && route.query.inventoryView === 'item-groups') {
      router.replace({ path: '/settings', query: { tab: 'catalog', catalogView: 'item-groups' } });
    }
  },
  { immediate: true },
);

watch(activeTab, (val) => {
  const current = route.query.tab;
  const normalizedCurrent = current == null || current === '' ? null : String(current);
  const normalizedVal = val == null || val === '' ? null : String(val);
  if (normalizedCurrent === normalizedVal) return;
  const nextQuery = { ...route.query };
  if (normalizedVal == null) {
    delete nextQuery.tab;
  } else {
    nextQuery.tab = normalizedVal;
  }
  router.replace({ path: '/settings', query: nextQuery });
});

// Restore last active tab and persist changes
const restoreInitialTab = () => {
  const validIds = new Set([...tabs.value.map(t => t.id), ...internalTabs.value.map(t => t.id)]);

  // If there's a tab in the URL query, use it
  if (route.query.tab) {
    if (validIds.has(route.query.tab)) {
      activeTab.value = route.query.tab;
      persistSettingsRoute();
      return;
    }
  }
  
  // Check if we're on a notifications route (for direct navigation/bookmarks)
  if (route.path.includes('/notifications')) {
    activeTab.value = 'notifications';
    persistSettingsRoute();
    return;
  }

  // Bare /settings — restore last sub-page so workspace/browser tab return stays in context.
  try {
    const lastRoute = localStorage.getItem(SETTINGS_LAST_ROUTE_KEY);
    if (lastRoute && lastRoute.startsWith('/settings')) {
      const lastUrl = new URL(lastRoute, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      const lastTab = lastUrl.searchParams.get('tab');
      if (lastTab && validIds.has(lastTab)) {
        // Prefer full route restore (nested automationView/app/etc). Do not set activeTab
        // first — the activeTab watcher would rewrite query and drop nested keys.
        if (lastRoute !== route.fullPath) {
          router.replace(lastRoute);
          return;
        }
        activeTab.value = lastTab;
        return;
      }
    }
    const lastTabOnly = localStorage.getItem(SETTINGS_TAB_KEY);
    if (lastTabOnly && validIds.has(lastTabOnly)) {
      activeTab.value = lastTabOnly;
      return;
    }
  } catch {
    // ignore storage errors
  }
  
  // Otherwise, show landing page (no tab selected)
  activeTab.value = null;
};

restoreInitialTab();

watch(activeTab, (v) => {
  if (v) {
    recordRecentSettingsTab(v);
  }
});

// Persist full Settings deep-link whenever the sub-page route changes.
watch(
  () => route.fullPath,
  () => {
    if (route.query.tab || route.path.includes('/notifications')) {
      persistSettingsRoute();
    }
  },
);

function isSettingsTypingTarget(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function onSettingsSlashKey(event) {
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
  if (isSettingsTypingTarget(event.target)) return;
  // Overview has its own inline search focus handler.
  if (!activeTab.value || activeTab.value === 'landing') return;
  event.preventDefault();
  quickJumpOpen.value = true;
}

onMounted(() => {
  window.addEventListener('keydown', onSettingsSlashKey);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onSettingsSlashKey);
});

// If available tabs change due to permission changes, keep the closest valid tab
watch([tabs, internalTabs], ([tabsList, internalTabsList]) => {
  if (!activeTab.value) return;
  // Avoid clearing while access context is still hydrating (empty list).
  if (tabsList.length === 0 && internalTabsList.length === 0) return;
  const validIds = new Set([...tabsList.map(t => t.id), ...internalTabsList.map(t => t.id)]);
  if (!validIds.has(activeTab.value)) {
    activeTab.value = null; // Show landing page if tab is invalid
    clearPersistedSettingsRoute();
  }
});
</script>
