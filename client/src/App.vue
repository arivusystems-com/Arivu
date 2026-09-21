<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { computed, defineAsyncComponent, getCurrentInstance, inject, nextTick, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

import { useAuthStore } from '@/stores/authRegistry';
import { useColorMode } from '@/composables/useColorMode';
import { useLocale } from '@/composables/useLocale';
import { readLastActiveAppIdFromStorage } from '@/composables/useSidebarState';
const PlatformShell = defineAsyncComponent(() => import('@/components/PlatformShell.vue'));
const NotificationContainer = defineAsyncComponent(() =>
  import('@/components/NotificationContainer.vue')
);
const ConfirmActionHost = defineAsyncComponent(() =>
  import('@/components/common/ConfirmActionHost.vue')
);
const NotificationSheet = defineAsyncComponent(() =>
  import('@/components/notifications/NotificationSheet.vue')
);
const PermissionSyncHost = defineAsyncComponent(() =>
  import('@/components/shell/PermissionSyncHost.vue')
);
const ModuleListFreshnessHost = defineAsyncComponent(() =>
  import('@/components/shell/ModuleListFreshnessHost.vue')
);
const SyncDrawer = defineAsyncComponent(() =>
  import('@/components/audit/SyncDrawer.vue')
);
const GlobalSurfacesProvider = defineAsyncComponent(() =>
  import('@/components/global/GlobalSurfacesProvider.vue')
);
const ImportProgressBanner = defineAsyncComponent(() =>
  import('@/components/import/ImportProgressBanner.vue')
);
const BulkDeleteProgressBanner = defineAsyncComponent(() =>
  import('@/components/common/BulkDeleteProgressBanner.vue')
);
const EmailVerificationBanner = defineAsyncComponent(() =>
  import('@/components/auth/EmailVerificationBanner.vue')
);
const HelpdeskNotificationDevPanel = defineAsyncComponent(() =>
  import('@/components/dev/HelpdeskNotificationDevPanel.vue')
);
/** Opt-in dev UI — set VITE_ENABLE_HELPDESK_NOTIFICATION_DEV_PANEL=true in client/.env.local */
const showHelpdeskNotificationDevPanel =
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_HELPDESK_NOTIFICATION_DEV_PANEL === 'true';
import {
  isAuthLifecyclePublicRoute,
  isStandalonePublicRoute,
  shouldSkipTabRoute,
  isStandaloneShelllessPath,
  isPortalAuthLifecycleRoute,
  isAcademySurfaceRoute
} from '@/utils/standaloneRoutes';
import { identifyProductUser } from '@/config/posthogUser';

const appDebugEnabled = () => {
  if (!import.meta.env.DEV) return false;
  try {
    return localStorage.getItem('arivu:debug:app') === '1';
  } catch (_e) {
    return false;
  }
};

const appLog = (...args) => {
  if (!appDebugEnabled()) return;
  console.log(...args);
};

function resetTabsStateFromModule() {
  resetTabsSessionInit();
  void import('@/composables/useTabs').then((m) => m.resetTabsState());
  void import('@/utils/moduleListFreshness').then((m) => m.resetModuleListFreshnessState());
  void import('@/utils/recordDetailFreshness').then((m) => m.resetRecordDetailFreshnessState());
  void import('@/services/dataChangeRealtimeService').then((m) => m.stopDataChangeRealtimeService());
}

let shellModulesPromise = null;

function ensureShellModules() {
  if (!shellModulesPromise) {
    shellModulesPromise = Promise.all([
      import('@/stores/appShell'),
      import('@/stores/activeImports'),
      import('@/composables/useSidebarState'),
    ]).then(([appShellMod, activeImportsMod, sidebarMod]) => ({
      appShellStore: appShellMod.useAppShellStore(),
      activeImportsStore: activeImportsMod.useActiveImportsStore(),
      lastActiveAppId: sidebarMod.useSidebarState().lastActiveAppId,
    }));
  }
  return shellModulesPromise;
}

let notificationRealtimePromise = null;

function getNotificationRealtime() {
  if (!notificationRealtimePromise) {
    notificationRealtimePromise = import('@/services/notificationRealtimeService');
  }
  return notificationRealtimePromise;
}

function stopNotificationRealtimeIfLoaded() {
  if (!notificationRealtimePromise) return;
  void notificationRealtimePromise.then((m) => m.stopNotificationRealtime());
}

let dataChangeRealtimePromise = null;

function getDataChangeRealtime() {
  if (!dataChangeRealtimePromise) {
    dataChangeRealtimePromise = import('@/services/dataChangeRealtimeService');
  }
  return dataChangeRealtimePromise;
}

function stopDataChangeRealtimeIfLoaded() {
  if (!dataChangeRealtimePromise) return;
  void dataChangeRealtimePromise.then((m) => m.stopDataChangeRealtimeService());
}

function refreshDataChangeRealtime(token) {
  void getDataChangeRealtime().then((m) => {
    if (token) {
      m.startDataChangeRealtimeService(token);
    } else {
      m.stopDataChangeRealtimeService();
    }
  });
}

async function showAuthSessionWarning(message, duration) {
  const { useNotifications } = await import('@/composables/useNotifications');
  useNotifications().warning(message, duration);
}

let headlessControlsRegistered = false;

async function ensureHeadlessFormControls() {
  if (headlessControlsRegistered) return;
  const app = getCurrentInstance()?.appContext.app;
  if (!app) return;
  const { registerHeadlessFormControls } = await import('@/plugins/headlessFormControls');
  await registerHeadlessFormControls(app);
  headlessControlsRegistered = true;
}

const initDynamicRoutes = inject('arivuInitializeDynamicRoutes');
const authStore = useAuthStore();
// Keep localeFormat context (user TZ + dateFormat + timeFormat) synced app-wide.
useLocale();
const router = useRouter();
const route = useRoute();

const recoverUnmatchedDynamicRoute = async () => {
  const currentPath = route.fullPath || route.path;
  if (!currentPath || route.matched.length > 0) return;

  const resolved = router.resolve(currentPath);
  if (!resolved?.matched?.length) return;

  try {
    await router.replace(currentPath);
  } catch (error) {
    console.warn('[App] Failed to recover unmatched dynamic route:', currentPath, error);
  }
};

// Store cleanup function for route watcher (popstate listener)
let cleanupRouteWatcher = null;
let tabsSessionInitPromise = null;
let tabsSessionScopeKey = null;

function resetTabsSessionInit() {
  tabsSessionInitPromise = null;
  tabsSessionScopeKey = null;
}

// Initialize color mode
const { colorMode } = useColorMode();

// Check authentication status to conditionally show the navigation bar
const isAuthenticated = computed(() => authStore.isAuthenticated);
// Hide shell only for auth routes and routes with explicit hideShell meta
// Platform routes (/platform/*) should show the shell
const hideShell = computed(() => {
  // Check route meta first
  if (route.meta.hideShell) return true;
  // Hide for auth routes only
  if (route.path.startsWith('/login') || route.path.startsWith('/auth/')) return true;
  // Portal select / set-password must never mount PlatformShell (CRM home 401s).
  if (isPortalAuthLifecycleRoute(route.path)) return true;
  // Academy has its own Learning-only chrome.
  if (isAcademySurfaceRoute(route.path)) return true;
  // Portal and audit routes use standard PlatformShell layout
  // Platform routes show the shell
  return false;
});
const isStandaloneShelllessRoute = computed(() => {
  if (route.meta.hideShell) return true;
  if (route.meta.requiresAuth === false) return true;
  const routePath = String(route.path || '').split('?')[0];
  if (isAuthLifecyclePublicRoute(routePath)) return true;
  if (isPortalAuthLifecycleRoute(routePath)) return true;
  if (isAcademySurfaceRoute(routePath)) return true;
  if (isStandaloneShelllessPath(routePath)) return true;
  if (typeof window !== 'undefined') {
    return isStandaloneShelllessPath(window.location.pathname)
      || isPortalAuthLifecycleRoute(window.location.pathname)
      || isAcademySurfaceRoute(window.location.pathname);
  }
  return false;
});

const DEFAULT_CONTENT_OFFSET = 0;
const EXTRA_OFFSET_LIGHT = '2rem';
const EXTRA_OFFSET_LARGE = '2rem';
const contentWrapperRef = ref(null);
const tableStickyOffset = ref(`calc(${DEFAULT_CONTENT_OFFSET}px + ${EXTRA_OFFSET_LIGHT})`);
const notificationSheetOpen = ref(false);
const auditSyncDrawerOpen = ref(false);

const PLATFORM_BANNER_OFFSET_VAR = '--platform-banner-offset';
const topBannersEl = ref(null);
let topBannersResizeObserver = null;

const setPlatformBannerOffset = (height) => {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty(
    PLATFORM_BANNER_OFFSET_VAR,
    `${Math.max(0, Math.round(height))}px`
  );
};

const syncPlatformBannerOffset = () => {
  const el = topBannersEl.value;
  if (!el) {
    setPlatformBannerOffset(0);
    return;
  }
  setPlatformBannerOffset(el.getBoundingClientRect().height);
};

const startTopBannersOffsetObserver = () => {
  stopTopBannersOffsetObserver();
  void nextTick(() => {
    syncPlatformBannerOffset();
    if (typeof ResizeObserver === 'undefined' || !topBannersEl.value) return;
    topBannersResizeObserver = new ResizeObserver(() => {
      syncPlatformBannerOffset();
    });
    topBannersResizeObserver.observe(topBannersEl.value);
  });
};

const stopTopBannersOffsetObserver = () => {
  topBannersResizeObserver?.disconnect();
  topBannersResizeObserver = null;
  setPlatformBannerOffset(0);
};

const handleOpenNotifications = () => {
  if (!authStore.isAuthenticated) return;
  if (window.innerWidth < 1024) {
    notificationSheetOpen.value = true;
  }
};

const handleOpenAuditSyncDrawer = () => {
  auditSyncDrawerOpen.value = true;
};

// Sidebar is always the icon rail (flyout for modules).
const sidebarCollapsed = ref(true);

watch(sidebarCollapsed, () => {
  queueContentOffsetUpdate();
});

const updateContentOffset = () => {
  const el = contentWrapperRef.value;

  if (!(el instanceof HTMLElement)) {
    tableStickyOffset.value = `calc(${DEFAULT_CONTENT_OFFSET}px + ${EXTRA_OFFSET_LIGHT})`;
    return;
  }

  const rect = el.getBoundingClientRect();
  const baseOffset = Math.max(DEFAULT_CONTENT_OFFSET, Math.round(rect.top));
  const extraSpacing = window.innerWidth >= 1024 ? EXTRA_OFFSET_LARGE : EXTRA_OFFSET_LIGHT;

  tableStickyOffset.value = `calc(${baseOffset}px + ${extraSpacing})`;
};

const queueContentOffsetUpdate = () => {
  nextTick(() => {
    requestAnimationFrame(updateContentOffset);
  });
};

watch(
  () => route.fullPath,
  () => {
    queueContentOffsetUpdate();
  }
);

watch(hideShell, () => {
  queueContentOffsetUpdate();
});

const handleResize = () => {
  updateContentOffset();
};

// Cross-tab auth guard: if another tab logs in/out and changes localStorage.user,
// don't silently switch accounts in this tab.
const handleStorageEvent = (e) => {
  if (e.key !== 'user') return;
  if (isAuthLifecyclePublicRoute(route.path)) return;
  if (!authStore.isAuthenticated || !authStore.user?._id) return;

  // User removed (logout in another tab)
  if (!e.newValue) {
    void showAuthSessionWarning('You were signed out because your session changed in another tab.', 6000);
    authStore.logout();
    resetTabsStateFromModule();
    router.replace('/login');
    return;
  }

  try {
    const incoming = JSON.parse(e.newValue);
    const incomingId = incoming?._id;
    if (incomingId && String(incomingId) !== String(authStore.user._id)) {
      void showAuthSessionWarning('You were signed out because you logged into a different account in another tab.', 6500);
      authStore.logout();
      resetTabsStateFromModule();
      router.replace('/login');
    }
  } catch (err) {
    console.warn('Failed to parse localStorage user in storage event:', err);
    // Safe fallback: logout rather than risk inconsistent state
    void showAuthSessionWarning('You were signed out due to a session change in another tab.', 6000);
    authStore.logout();
    resetTabsStateFromModule();
    router.replace('/login');
  }
};

// Phase 2D: Detect active app from route path
const detectActiveAppFromRoute = (path) => {
  if (path.startsWith('/audit/')) return 'AUDIT';
  if (path.startsWith('/portal/')) return 'PORTAL';
  if (path.startsWith('/sales/')) return 'SALES';
  if (path.startsWith('/helpdesk/')) return 'HELPDESK';
  if (path.startsWith('/projects/')) return 'PROJECTS';
  if (path.startsWith('/dashboard/')) {
    const appKey = String(path.split('/')[2] || '').toUpperCase();
    if (appKey) return appKey;
  }
  if (path.startsWith('/dashboard') || path.startsWith('/people') || path.startsWith('/organizations') || path.startsWith('/deals') || path.startsWith('/tasks') || path.startsWith('/events') || path.startsWith('/items') || path.startsWith('/forms')) return 'SALES';
  if (path === '/platform/home' || path.startsWith('/platform/home/')) {
    const savedAppId = readLastActiveAppIdFromStorage();
    if (savedAppId) return savedAppId.toUpperCase();
  }
  return 'SALES'; // Default to Sales
};

const notificationAppKey = computed(() => detectActiveAppFromRoute(route.path));
const isAuditRoute = computed(() => route.path.startsWith('/audit/'));

// Phase 2D: Watch route changes and update activeApp
watch(() => route.path, async (newPath) => {
  if (!authStore.isAuthenticated) return;

  const { appShellStore, lastActiveAppId } = await ensureShellModules();
  if (appShellStore.isLoaded) {
    const detectedApp = detectActiveAppFromRoute(newPath);
    if (appShellStore.activeApp !== detectedApp) {
      appLog(`[App] Route changed to ${newPath}, setting activeApp to ${detectedApp}`);
      appShellStore.setActiveApp(detectedApp);
    }
    // Persist last active app lens for sidebar fallback when route is ambiguous.
    lastActiveAppId.value = detectedApp;
  }
}, { immediate: true });

const shellTabsReady = ref(false);

async function waitForPostLoginNavigation() {
  if (!isAuthLifecyclePublicRoute(route.path) && route.path !== '/') {
    return;
  }

  await router.isReady();
  await nextTick();

  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2000);
    const stop = watch(
      () => route.path,
      (path) => {
        if (!isAuthLifecyclePublicRoute(path) && path !== '/') {
          clearTimeout(timeout);
          stop();
          resolve();
        }
      }
    );
  });
  await nextTick();
}

async function initializeTabsForSession() {
  await waitForPostLoginNavigation();

  const skipTabsInit = shouldSkipTabRoute(route.path);
  if (skipTabsInit) {
    appLog('📋 Skipping tabs initialization for route:', route.path);
    return;
  }

  const instanceId = authStore.organization?._id || authStore.organization?.instanceId;
  const userId = authStore.user?._id;
  if (!instanceId || !userId) {
    console.error('[Tabs] Skipping tab initialization: missing instanceId or userId', {
      instanceId,
      userId
    });
    return;
  }

  const scopeKey = `${instanceId}:${userId}`;
  if (tabsSessionInitPromise && tabsSessionScopeKey === scopeKey) {
    return tabsSessionInitPromise;
  }

  tabsSessionScopeKey = scopeKey;
  tabsSessionInitPromise = (async () => {
    if (typeof cleanupRouteWatcher === 'function') {
      cleanupRouteWatcher();
      cleanupRouteWatcher = null;
    }

    const { configureTabsStorage, useTabs } = await import('@/composables/useTabs');
    const { initTabs, setupRouteWatcher } = useTabs();
    configureTabsStorage({ instanceId, userId });
    initTabs();
    await router.isReady();
    await nextTick();

    appLog('📊 [App] After initTabs, checking tabs state...');
    const { tabs: tabsRef } = useTabs();
    appLog('📊 [App] Tabs count:', tabsRef.value.length);
    appLog('📊 [App] Tabs:', tabsRef.value.map(t => ({ id: t.id, title: t.title, path: t.path })));

    cleanupRouteWatcher = setupRouteWatcher(route);
  })();

  try {
    await tabsSessionInitPromise;
  } catch (error) {
    tabsSessionInitPromise = null;
    tabsSessionScopeKey = null;
    throw error;
  }
}

// Initialize tabs before shell mounts so Live Chat deep links are not redirected mid-load.
onBeforeMount(async () => {
  if (authStore.isAuthenticated && !isStandaloneShelllessRoute.value) {
    try {
      await initializeTabsForSession();
    } catch (tabErr) {
      console.warn('[App] Tab initialization failed:', tabErr);
    } finally {
      shellTabsReady.value = true;
    }
  } else {
    shellTabsReady.value = true;
  }
});

// Refresh permissions on app mount (page refresh)
onMounted(async () => {
  if (authStore.isAuthenticated && !isStandaloneShelllessRoute.value) {
    const { appShellStore, activeImportsStore } = await ensureShellModules();
    activeImportsStore.init();

    const neededMetadata = !appShellStore.isLoaded;
    appLog('Auto-refreshing permissions on page load...');
    try {
      // Do not block first paint / route recovery on shell registry+routes.
      // Metadata still loads (single-flight); sidebar/routes hydrate when ready.
      const metadataPromise = neededMetadata
        ? appShellStore.loadUIMetadata()
        : Promise.resolve();
      await authStore.refreshUser({ force: true });
      void metadataPromise.catch((err) => {
        console.warn('[App] UI metadata load failed:', err);
      });
    } catch (bootstrapErr) {
      console.warn('[App] Bootstrap refresh failed:', bootstrapErr);
    }

    identifyProductUser({
      _id: authStore.user?._id,
      email: authStore.user?.email,
      organizationId: authStore.organization?._id
        ? String(authStore.organization._id)
        : undefined,
    });

    if (neededMetadata) {
      appLog('Initializing dynamic routes...');
      if (typeof initDynamicRoutes === 'function') {
        try {
          // Prefer awaiting metadata so dynamic routes exist, but cap wait so a slow
          // /ui/registry cannot hang the whole shell indefinitely.
          await Promise.race([
            appShellStore.loadUIMetadata(),
            new Promise((resolve) => setTimeout(resolve, 2500))
          ]);
          await initDynamicRoutes();
        } catch (routeErr) {
          console.warn('[App] Dynamic routes init failed:', routeErr);
        }
      }
    }
    await recoverUnmatchedDynamicRoute();

    const detectedApp = detectActiveAppFromRoute(route.path);
    if (detectedApp && appShellStore.activeApp !== detectedApp) {
      appLog(`[App] Initial route: ${route.path}, setting activeApp to ${detectedApp}`);
      appShellStore.setActiveApp(detectedApp);
    }
  }

  queueContentOffsetUpdate();
  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('storage', handleStorageEvent);
  window.addEventListener('sales-open-notifications', handleOpenNotifications);
  window.addEventListener('arivu:open-audit-sync-drawer', handleOpenAuditSyncDrawer);
  if (authStore.isAuthenticated) {
    startTopBannersOffsetObserver();
  }
});

watch(notificationSheetOpen, (val) => {
  appLog('[App] notificationSheetOpen changed:', val);
});

onBeforeUnmount(() => {
  // Cleanup route watcher (removes popstate listener)
  if (typeof cleanupRouteWatcher === 'function') {
    cleanupRouteWatcher();
  }
  stopTopBannersOffsetObserver();
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('storage', handleStorageEvent);
  window.removeEventListener('sales-open-notifications', handleOpenNotifications);
  window.removeEventListener('arivu:open-audit-sync-drawer', handleOpenAuditSyncDrawer);
});

// Watch for authentication changes to initialize tabs
watch(
  () => authStore.isAuthenticated,
  async (isAuthed, wasAuthed) => {
    if (wasAuthed && !isAuthed) {
      stopTopBannersOffsetObserver();
      stopNotificationRealtimeIfLoaded();
      stopDataChangeRealtimeIfLoaded();
      void ensureShellModules().then(({ activeImportsStore }) => activeImportsStore.reset());
      resetTabsStateFromModule();
      shellTabsReady.value = false;
      // Cleanup route watcher when logging out
      if (typeof cleanupRouteWatcher === 'function') {
        cleanupRouteWatcher();
        cleanupRouteWatcher = null;
      }
    } else if (!wasAuthed && isAuthed) {
      shellTabsReady.value = false;
      appLog('🔄 [App] User authenticated, initializing tabs...');
      try {
        await initializeTabsForSession();
      } catch (tabErr) {
        console.warn('[App] Tab initialization after login failed:', tabErr);
      } finally {
        shellTabsReady.value = true;
      }
      startTopBannersOffsetObserver();
    }
  },
  { immediate: false }
);

watch(
  isAuthenticated,
  (authed) => {
    if (authed) void ensureHeadlessFormControls();
  },
  { immediate: true }
);

watch(
  () => [authStore.isAuthenticated, route.path],
  ([isAuthed, path]) => {
    if (!isAuthed) {
      stopNotificationRealtimeIfLoaded();
      stopDataChangeRealtimeIfLoaded();
      return;
    }
    void getNotificationRealtime().then((m) => {
      if (!isStandalonePublicRoute(path)) {
        m.startNotificationRealtime();
      } else {
        m.stopNotificationRealtime();
      }
    });
    refreshDataChangeRealtime(authStore.user?.token);
  },
  { immediate: true }
);

watch(
  () => authStore.user?.allowedApps,
  () => {
    if (!authStore.isAuthenticated) return;
    void getNotificationRealtime().then((m) => m.refreshNotificationRealtimeConnections());
  },
  { deep: true }
);

watch(
  () => authStore.user?.entitledAddons,
  () => {
    if (!authStore.isAuthenticated) return;
    void getNotificationRealtime().then((m) => m.refreshNotificationRealtimeConnections());
  },
  { deep: true }
);

watch(
  () => authStore.user?.token,
  (token, prev) => {
    if (token && token !== prev && authStore.isAuthenticated) {
      void getNotificationRealtime().then((m) => m.refreshNotificationRealtimeConnections());
      refreshDataChangeRealtime(token);
    }
  }
);

watch(
  () => route.path,
  async () => {
    if (!authStore.isAuthenticated) return;
    void getNotificationRealtime().then((m) => m.onNotificationRouteChange());
    if (shouldSkipTabRoute(route.path)) {
      if (typeof cleanupRouteWatcher === 'function') {
        cleanupRouteWatcher();
        cleanupRouteWatcher = null;
      }
      return;
    }

    try {
      await initializeTabsForSession();
    } catch (tabErr) {
      console.warn('[App] Tab session ensure failed:', tabErr);
    }
  }
);
</script>

<template>
  <!-- Standalone shell-less routes (public pages, staff webform preview) -->
  <div v-if="isStandaloneShelllessRoute" class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <RouterView />
  </div>

  <!-- Authenticated layout: top banners above app shell -->
  <div
    v-else-if="isAuthenticated"
    class="flex min-h-dvh flex-col"
  >
    <div
      id="platform-top-banners"
      ref="topBannersEl"
      class="shrink-0"
    >
      <div id="platform-announcement-banner-host" />
      <EmailVerificationBanner />
    </div>

    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
      <!-- Shell-less pages (e.g., Settings) -->
      <div v-if="hideShell" class="min-h-0 flex-1 overflow-y-hidden overflow-x-hidden bg-gray-100/70 dark:bg-gray-900">
        <RouterView />
      </div>

      <!-- Phase 1A: Platform Shell with dynamic UI composition -->
      <PlatformShell v-else-if="shellTabsReady" />
    </div>
  </div>

  <!-- Landing Page (no sidebar) -->
  <div v-else>
    <RouterView />
  </div>

  <!-- Global Notification Container (authenticated only — keeps login lean) -->
  <NotificationContainer v-if="isAuthenticated" />
  <!-- Shared confirm modal (public + authenticated — replaces window.confirm) -->
  <ConfirmActionHost />

  <ImportProgressBanner v-if="isAuthenticated" />
  <BulkDeleteProgressBanner v-if="isAuthenticated" />

  <PermissionSyncHost v-if="isAuthenticated" />
  <ModuleListFreshnessHost v-if="isAuthenticated" />

  <!-- Mobile notification sheet -->
  <NotificationSheet
    v-if="isAuthenticated"
    :open="notificationSheetOpen"
    :app-key="notificationAppKey"
    :mark-all-disabled="false"
    @close="notificationSheetOpen = false"
  />

  <!-- Audit offline sync drawer -->
  <SyncDrawer v-if="isAuditRoute" v-model="auditSyncDrawerOpen" />

  <!-- Global Surfaces Provider (authenticated app only — avoids loading GlobalSearch/CRM on /login) -->
  <GlobalSurfacesProvider v-if="isAuthenticated" />

  <!-- Dev-only: simulate helpdesk bell / toast / sound on /helpdesk/ routes -->
  <HelpdeskNotificationDevPanel v-if="showHelpdeskNotificationDevPanel" />
</template>

<style>
/* Global styles - prevent horizontal scroll */
html,
body {
  overflow-x: hidden;
  max-width: 100vw;
}

body {
  margin: 0;
  padding: 0;
}
</style>

<style scoped>
header {
  line-height: 1.5;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

@media (min-width: 1024px) {

  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
