<script setup>
defineOptions({ name: 'AppNav' });
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useAppShellStore } from '@/stores/appShell';
import NotificationBell from '@/components/notifications/NotificationBell.vue';
import NotificationDrawer from '@/components/notifications/NotificationDrawer.vue';
import ArivuAssistantLauncher from '@/components/support/ArivuAssistantLauncher.vue';
import { computed, inject, ref, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { getTabTitleMetaForPath, resolveTabTitle } from '@/utils/navigationLabels';
import { buildSidebarStructureForSession } from '@/utils/buildSidebarForSession';
import { resolveNotificationAppKeyFromPath } from '@/utils/notificationAppKey';

const { t, te } = useI18n();
import { invalidateTenantSchemaCaches } from '@/utils/tenantSchemaApiCache';
import { invalidateAddonNavigationCache } from '@/utils/addonNavigation';
import { createPermissionSnapshot, hasPermission as hasSnapshotPermission } from '@/types/permission-snapshot.types';
import { useColorMode } from '@/composables/useColorMode';
import { useSidebarState } from '@/composables/useSidebarState';
import { SHELL_FLOATING_SURFACE_CLASS, applySidebarChromeCssVar } from '@/utils/sidebarLayout';
import { readDockedAppIdFromStorage } from '@/composables/useSidebarState';
import { useUserStatus } from '@/composables/useUserStatus';
import AppSidebar from '@/components/AppSidebar.vue';
import AppSidebarSkeleton from '@/components/AppSidebarSkeleton.vue';
import UserMenu from '@/components/UserMenu.vue';
import AvatarInitials from '@/components/ui/AvatarInitials.vue';
import clickOutside from '@/directives/clickOutside';
import { Dialog, DialogPanel, TransitionChild, TransitionRoot } from '@headlessui/vue'
import { 
  Bars3Icon, 
  BellIcon, 
  XMarkIcon, 
  MagnifyingGlassIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  InformationCircleIcon,
  DocumentTextIcon
} from '@heroicons/vue/24/outline'

const vClickOutside = clickOutside;

// Define props and emits
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue']);

const initDynamicRoutes = inject('arivuInitializeDynamicRoutes');
const router = useRouter();
const route = useRoute();
const { colorMode } = useColorMode();
const authStore = useAuthStore();
const appShellStore = useAppShellStore();
const { lastActiveAppId } = useSidebarState();
const appRegistry = ref({});
const sidebarStructure = ref(null);
const loadingSidebar = ref(false);

const showDrawer = ref(false);
const isCollapsed = computed({
  get: () => true,
  set: () => {
    // Sidebar is always the icon rail — expand is unsupported.
  }
});

const sidebarOpen = ref(false);

const toggleSidebar = () => {
  // no-op: expand/collapse removed (app flyout only)
};

const toggleMobileMenu = () => {
  sidebarOpen.value = !sidebarOpen.value;
};

const FORBIDDEN_APP_NAV_MODULE_KEYS = new Set(['people', 'tasks', 'events', 'forms', 'items', 'organizations']);

const detectAppFromRoute = (path) => {
  const normalizedPath = String(path || '');
  if (normalizedPath.startsWith('/dashboard/')) {
    return String(normalizedPath.split('/')[2] || '').toUpperCase() || null;
  }
  if (normalizedPath.startsWith('/audit/')) return 'AUDIT';
  if (normalizedPath.startsWith('/portal/')) return 'PORTAL';
  if (normalizedPath.startsWith('/helpdesk/')) return 'HELPDESK';
  if (normalizedPath.startsWith('/projects/')) return 'PROJECTS';
  if (normalizedPath.startsWith('/sales/')) return 'SALES';
  if (normalizedPath.startsWith('/inventory/')) return 'INVENTORY';
  if (normalizedPath.startsWith('/marketing/')) return 'MARKETING';

  const corePrefixes = [
    '/people',
    '/organizations',
    '/tasks',
    '/events',
    '/items',
    '/forms',
    '/responses',
    '/documents',
    '/templates',
    '/analytics',
    '/imports',
  ];
  if (corePrefixes.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(prefix + '/'))) {
    return 'CORE';
  }
  return null;
};

// Must match store/API app keys (SALES/AUDIT/PORTAL/HELPDESK) — not shell CORE lens
const notificationAppKey = computed(() => resolveNotificationAppKeyFromPath(route.path));

const canAccessSidebarModule = (permission) => {
  if (!permission) return true;
  try {
    const snapshot = createPermissionSnapshot(authStore.user);
    return hasSnapshotPermission(snapshot, permission);
  } catch {
    return false;
  }
};

const applyAppLensToSidebarStructure = (targetAppKey) => {
  const registry = appRegistry.value || {};
  if (!sidebarStructure.value) return false;

  const normalized = String(targetAppKey || '').toUpperCase();
  if (normalized === 'CORE') {
    sidebarStructure.value = {
      ...sidebarStructure.value,
      appSwitcher: {
        ...sidebarStructure.value.appSwitcher,
        activeAppId: 'CORE',
      },
      appNav: {
        appId: 'CORE',
        modules: sidebarStructure.value.coreModules || [],
      },
    };
    lastActiveAppId.value = 'CORE';
    return true;
  }

  const app = registry[targetAppKey] || Object.values(registry).find(
    (candidate) => String(candidate?.appKey || '').toUpperCase() === normalized
  );
  if (!app) return false;

  const modules = (app.modules || [])
    .filter((m) => {
      if (m.navigationCore === true) return false;
      if (m.navigationEntity === true) return false;
      if (m.excludeFromApps === true) return false;
      if (m.appKey && String(m.appKey).toLowerCase() === 'platform') return false;
      if (FORBIDDEN_APP_NAV_MODULE_KEYS.has(String(m.moduleKey || '').toLowerCase())) return false;
      return canAccessSidebarModule(m.permission);
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .map((m) => ({
      kind: 'app',
      id: `${targetAppKey}:${m.moduleKey}`,
      label: m.label,
      route: m.route,
      icon: m.icon,
      moduleKey: m.moduleKey
    }));

  sidebarStructure.value = {
    ...sidebarStructure.value,
    appSwitcher: {
      ...sidebarStructure.value.appSwitcher,
      activeAppId: targetAppKey
    },
    appNav: {
      appId: targetAppKey,
      dashboard: {
        kind: 'app',
        id: targetAppKey,
        label: t('navigation.dashboard'),
        route: app.dashboardRoute,
        icon: targetAppKey === 'AUDIT' ? 'presentation-chart' : 'squares'
      },
      modules
    }
  };
  lastActiveAppId.value = targetAppKey;
  return true;
};

// Close mobile menu + keep sidebar lens in sync with route transitions.
watch(
  () => route.path,
  async (newPath) => {
    sidebarOpen.value = false;

    if (!authStore.user || !authStore.isAuthenticated || !sidebarStructure.value) return;

    const routeAppKey = detectAppFromRoute(newPath);
    if (!routeAppKey) return;

    const activeLens = String(sidebarStructure.value?.appSwitcher?.activeAppId || '').toUpperCase();
    if (activeLens === routeAppKey) return;

    // Fast path: switch the lens in-memory from loaded registry.
    const switchedInMemory = applyAppLensToSidebarStructure(routeAppKey);
    if (switchedInMemory) return;

    // Fallback: full rebuild when registry state is unavailable.
    await buildSidebar();
  }
);

// ============================================================================
// PLATFORM UI: Sidebar from Registry (Phase 1A - Full Cutover)
// ============================================================================
// 
// Removed:
// - AppSwitcher component
// - Per-app navigation logic
// - Hardcoded module lists
// - Inline permission checks
//
// Replaced with:
// - buildSidebarFromRegistry(registry, permissionSnapshot)
// - SidebarStructure rendering
// ============================================================================

// ARCHITECTURE NOTE: GlobalSearch is now handled by GlobalSurfacesProvider in App.vue
// This component can dispatch 'arivu:open-global-search' event to open search if needed

// Build sidebar from registry
const SIDEBAR_BUILD_TIMEOUT_MS = 25000;

const buildSidebar = async () => {
  if (!authStore.user || !authStore.isAuthenticated) {
    sidebarStructure.value = null;
    loadingSidebar.value = false;
    return;
  }
  
  loadingSidebar.value = true;
  try {
    if (!authStore.user || !authStore.isAuthenticated) {
      return;
    }

    const buildPromise = buildSidebarStructureForSession(
      authStore.user,
      authStore.hasAppAccess,
      authStore.organization,
    );
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Sidebar build timed out')), SIDEBAR_BUILD_TIMEOUT_MS);
    });

    const { structure, entitlementScopedRegistry } = await Promise.race([
      buildPromise,
      timeoutPromise,
    ]);

    appRegistry.value = entitlementScopedRegistry;

    if (authStore.user && authStore.isAuthenticated) {
      sidebarStructure.value = structure;
    }
  } catch (error) {
    console.error('[Nav] Error building sidebar:', error);
    if (authStore.isAuthenticated) {
      sidebarStructure.value = null;
    }
  } finally {
    loadingSidebar.value = false;
  }
};

// Rebuild when session identity or app entitlements change (login, logout, refreshUser, enable app).
watch(
  () => [
    authStore.user?._id,
    authStore.user?.token,
    authStore.organization?._id,
    authStore.user?.permissions,
    authStore.user?.allowedApps,
    authStore.user?.appAccess,
    authStore.user?.entitledAddons,
    authStore.organization?.enabledApps,
  ],
  () => {
    if (authStore.user && authStore.isAuthenticated) {
      buildSidebar();
    } else {
      sidebarStructure.value = null;
    }
  },
  { immediate: true, deep: true },
);

// Global search handlers
// ARCHITECTURE NOTE: GlobalSearch keyboard shortcuts and event listeners
// are now handled by GlobalSurfacesProvider in App.vue
// This component can dispatch custom events if needed for UI triggers

// Refresh sidebar and dynamic routes when modules change (e.g. Settings → Module details, or new custom module)
const onCoreModulesUpdated = async () => {
  if (authStore.user && authStore.isAuthenticated) {
    appShellStore.invalidateAppRegistryCache();
    invalidateTenantSchemaCaches();
    invalidateAddonNavigationCache();
    buildSidebar();
    try {
      if (typeof initDynamicRoutes === 'function') {
        await initDynamicRoutes();
      }
    } catch (e) {
      console.warn('[Nav] Failed to refresh dynamic routes:', e);
    }
  }
};

const handleNotificationClick = () => {
  const width = window.innerWidth || 0;
  if (width >= 1024) {
    // lg+: in-app drawer (tablet top bar shares this path only when viewport ≥1024)
    showDrawer.value = true;
  } else {
    // Below lg breakpoint: bottom sheet (App.vue)
    window.dispatchEvent(new CustomEvent('sales-open-notifications'));
  }
};

onMounted(() => {
  emit('update:modelValue', true);
  applySidebarChromeCssVar(Boolean(readDockedAppIdFromStorage()));
  window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { collapsed: true } }));
  window.addEventListener('arivu:core-modules-updated', onCoreModulesUpdated);
  window.addEventListener('arivu:addons-updated', onCoreModulesUpdated);
  window.addEventListener('arivu:open-notifications-panel', handleNotificationClick);
});

onUnmounted(() => {
  window.removeEventListener('arivu:core-modules-updated', onCoreModulesUpdated);
  window.removeEventListener('arivu:addons-updated', onCoreModulesUpdated);
  window.removeEventListener('arivu:open-notifications-panel', handleNotificationClick);
});

// User info and handlers (avatar + menu parity with TabBar)
const userName = computed(() => authStore.user?.username || 'User');
const userVertical = computed(() => authStore.user?.vertical || 'N/A');
const workspaceName = computed(() => authStore.organization?.name || `${userName.value}'s Space`);

// Mobile-top-bar account dropdown is now a shared <UserMenu>. Track open state +
// surface the current presence dot on the avatar so the menu and the trigger
// stay visually in sync (mirrors TabBar's desktop treatment).
const showProfileDropdown = ref(false);
const toggleProfileDropdown = () => {
  showProfileDropdown.value = !showProfileDropdown.value;
};
const closeProfileDropdown = () => {
  showProfileDropdown.value = false;
};
const currentUserId = computed(() => authStore.user?._id || null);
const { currentPreset: userStatusPreset } = useUserStatus(currentUserId);

/** Same compact bell treatment as TabBar (mobile / tablet top bar). */
const shellTopBarBellClass =
  '!min-h-9 !min-w-9 !p-1.5 cursor-pointer rounded-md !border-0 !bg-transparent shadow-none hover:!bg-neutral-200 dark:hover:!bg-neutral-700 [&_svg]:!w-6 [&_svg]:!h-6';

const mobileHeaderTitle = computed(() => {
  const path = route.path || '/';

  if (
    path === '/sales/dashboard' ||
    path === '/dashboard' ||
    path.startsWith('/dashboard/')
  ) {
    return te('navigation.home') ? t('navigation.home') : 'Home';
  }

  const meta = getTabTitleMetaForPath(path, route.params || {});
  return resolveTabTitle(
    {
      path,
      params: route.params || {},
      titleKey: meta.titleKey,
      titleParams: meta.titleParams,
    },
    t,
    te
  );
});

const logoSrc = computed(() => {
    // If colorMode is 'dark' or 'system' (and system is dark), use the light-colored logo
    if (colorMode.value === 'dark' || (colorMode.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        // IMPORTANT: Update this path to your actual logo file for dark backgrounds
        return '/public/assets/nurtura_logo_white.svg'; 
    } else {
        // Use the dark-colored logo for light backgrounds
        // IMPORTANT: Update this path to your actual logo file for light backgrounds
        return '/public/assets/nurtura_logo_plain.svg'; 
    }
});
</script>

<template>
  <div>
    <!-- Keep NotificationBell mounted (store + realtime), but render notifications row in sidebar list -->
    <div class="hidden">
      <NotificationBell />
    </div>

    <!-- Mobile sidebar -->
    <TransitionRoot as="template" :show="sidebarOpen">
      <Dialog class="relative z-50 lg:hidden" @close="sidebarOpen = false">
        <TransitionChild as="template" enter="transition-opacity ease-linear duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="transition-opacity ease-linear duration-300" leave-from="opacity-100" leave-to="opacity-0">
          <div class="fixed inset-0 bg-gray-900/80 dark:bg-gray-900/80" />
        </TransitionChild>

        <div class="fixed inset-0 flex">
          <TransitionChild as="template" enter="transition ease-in-out duration-300 transform" enter-from="-translate-x-full" enter-to="translate-x-0" leave="transition ease-in-out duration-300 transform" leave-from="translate-x-0" leave-to="-translate-x-full">
            <DialogPanel class="relative mr-16 flex w-full max-w-xs flex-1">
              <TransitionChild as="template" enter="ease-in-out duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in-out duration-300" leave-from="opacity-100" leave-to="opacity-0">
                <div class="absolute top-0 left-full flex w-16 justify-center pt-5">
                  <button type="button" class="-m-2.5 p-2.5" @click="sidebarOpen = false">
                    <span class="sr-only">{{ t('navigation.closeSidebar') }}</span>
                    <XMarkIcon class="size-6 text-white dark:text-white" aria-hidden="true" />
                  </button>
                </div>
              </TransitionChild>

              <!-- Mobile Sidebar component -->
              <div class="relative flex grow flex-col overflow-y-auto bg-white dark:bg-gray-900 ring ring-gray-200 dark:ring-white/10 before:pointer-events-none before:absolute before:inset-0 before:bg-gray-50 dark:before:bg-black/10">
                <div class="relative flex grow">
                  <AppSidebar
                    v-if="sidebarStructure"
                    :sidebar-structure="sidebarStructure"
                    embedded
                  />

                  <AppSidebarSkeleton
                    v-else-if="loadingSidebar && !sidebarStructure"
                    :collapsed="true"
                  />

                  <!-- Empty State -->
                  <div v-if="!loadingSidebar && !sidebarStructure" class="px-2 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    {{ t('navigation.noNav') }}
                  </div>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </TransitionRoot>

    <!-- Desktop Sidebar: icon rail + optional docked module drawer -->
    <div 
      data-onboarding-target="sidebar"
      :class="[
        'fixed left-0 top-[var(--platform-banner-offset,0px)] h-[calc(100dvh-var(--platform-banner-offset,0px))] p-2 box-border',
        'bg-transparent border-0 flex flex-col',
        'hidden lg:flex',
        'lg:w-[var(--arivu-sidebar-chrome-width,calc(3.5rem+1rem))]',
        'transition-[width] duration-200 ease-out',
        'z-50'
      ]"
    >
      <!-- Floating card: light shell; brand lives only on the icon rail -->
      <div
        :class="[
          'flex-1 min-h-0 flex flex-col bg-neutral-50 dark:bg-neutral-950',
          SHELL_FLOATING_SURFACE_CLASS,
        ]"
      >
        <AppSidebar
          v-if="sidebarStructure"
          :sidebar-structure="sidebarStructure"
          embedded
        />

        <AppSidebarSkeleton
          v-else-if="loadingSidebar && !sidebarStructure"
          :collapsed="true"
        />

        <!-- Empty State -->
        <div v-if="!loadingSidebar && !sidebarStructure" class="px-2 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
          {{ t('navigation.noNav') }}
        </div>
      </div>
    </div>

    <!-- Mobile top bar -->
    <div class="fixed top-[var(--platform-banner-offset,0px)] left-0 right-0 z-50 flex items-center gap-x-6 bg-white dark:bg-gray-900 px-4 pt-[calc(0.75rem+var(--safe-area-top,0px))] pb-3 h-[var(--mobile-top-offset)] after:pointer-events-none after:absolute after:inset-0 after:border-b after:border-gray-200 dark:after:border-white/10 dark:after:bg-black/10 sm:px-6 lg:hidden">
      <button type="button" class="-m-2.5 p-2.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white lg:hidden" @click="sidebarOpen = true">
        <span class="sr-only">{{ t('navigation.openSidebar') }}</span>
        <Bars3Icon class="size-6 text-gray-900 dark:text-gray-400" aria-hidden="true" />
      </button>
      <div class="flex-1 text-base font-semibold text-gray-900 dark:text-white truncate">{{ mobileHeaderTitle }}</div>
      <div
        v-if="authStore.user"
        class="flex h-full items-center gap-3 pl-2 sm:pl-3"
      >
        <NotificationBell
          :connect-stream="false"
          :show-count-on-desktop="true"
          :class="shellTopBarBellClass"
          @toggle="handleNotificationClick"
        />
        <ArivuAssistantLauncher class="!min-h-8 !min-w-8" />

        <div
          v-click-outside="closeProfileDropdown"
          class="relative flex items-center"
        >
          <button
            type="button"
            class="relative inline-flex items-center justify-center rounded-full w-8 h-8 flex-shrink-0 ring-1 ring-gray-200 dark:ring-gray-600 hover:ring-gray-300 dark:hover:ring-gray-500 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-900',
                userStatusPreset.dotClass
              ]"
              aria-hidden="true"
            />
          </button>
          <UserMenu :open="showProfileDropdown" align="right" @close="closeProfileDropdown" />
        </div>
      </div>
    </div>
  </div>
  <NotificationDrawer
    :open="showDrawer"
    :app-key="notificationAppKey"
    @close="showDrawer = false"
  />
  
  <!-- ARCHITECTURE NOTE: GlobalSearch is rendered by GlobalSurfacesProvider in App.vue -->
  <!-- This ensures it's available across all layouts (Sales, Audit, Portal, etc.) -->
</template>
