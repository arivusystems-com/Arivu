import { ref, computed, watch, getCurrentInstance, nextTick, h } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import appRouter from '@/router';
import { 
  HomeIcon,
  InboxIcon,
  UsersIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  PresentationChartLineIcon,
  DocumentMagnifyingGlassIcon,
  ArrowDownTrayIcon,
  FolderIcon,
  BookOpenIcon,
  ComputerDesktopIcon,
  DocumentTextIcon,
  TrashIcon,
  Cog6ToothIcon,
  LifebuoyIcon,
  TicketIcon,
  CreditCardIcon,
  DocumentCurrencyDollarIcon,
  DocumentChartBarIcon,
  ShoppingCartIcon,
  CubeIcon,
  ChatBubbleLeftRightIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  MegaphoneIcon,
  FunnelIcon,
  PhotoIcon,
  ChartBarIcon,
  SparklesIcon
} from '@heroicons/vue/24/outline';
import { MODULE_ICON_IDS, resolveStoredModuleIconId } from '@/utils/moduleIcons';

// Astra tab uses the brand AI logo (kept consistent with the cinematic intro).
const AstraTabIcon = (_props, { attrs }) => h('img', {
  ...attrs,
  src: '/assets/logo/Ai%20Logo.svg',
  alt: '',
  'aria-hidden': 'true',
  class: ['object-contain', attrs?.class],
});
import {
  getPersistedRecordTabName,
  getTabTitleMetaForPath,
  hydrateTabFromStorage,
  isProcessDesignerTabPath,
  isRecordDetailTabPath,
  isTemplatesModuleFamilyPath,
  isTemplatesModuleListPath,
  shouldPreserveRecordTabTitle
} from '@/utils/navigationLabels';
import { resolveModuleDisplayName } from '@/utils/configurableLabelResolver';
import { i18n } from '@/i18n/index';
import { createHelpdeskTabAlertController } from '@/utils/helpdeskTabAlerts';
import { createLiveChatTabAlertController } from '@/utils/liveChatTabAlerts';
import { createInternalChatTabAlertController } from '@/utils/internalChatTabAlerts';
import { clearListSessionsForRoutePath } from '@/utils/listScrollSession';
import { markModuleListRecheckForRoutePath } from '@/utils/moduleListFreshness';
import { markRecordDetailRecheckForRoutePath } from '@/utils/recordDetailFreshness';
import { clearTabDrawerDraftsForTab } from '@/composables/useTabDrawerDrafts';
import {
  normalizeLiveChatPath,
  isLiveChatSessionsRoute,
  isLiveChatClosedSessionsRoute,
  isLiveChatVisitorsRoute,
  isLiveChatReportsRoute,
  isLiveChatRoute,
  isLiveChatSessionDetailPath,
  isLiveChatClosedSessionDetailPath,
  LIVE_CHAT_MAIN_TAB_PATH,
  LIVE_CHAT_CLOSED_TAB_PATH,
  liveChatMainTabOwnsRoute,
} from '@/utils/liveChatTabPaths';
import {
  ANNOUNCEMENTS_MAIN_TAB_PATH,
  announcementsTabOwnsRoute,
  isAnnouncementsRoute,
  normalizeAnnouncementsPath,
} from '@/utils/announcementsTabPaths';
import {
  learningTabOwnsRoute,
  isLearningRoute,
  getLearningIconForPath,
} from '@/utils/learningTabPaths';
import { resolveLiveChatSessionsNavigationPath } from '@/utils/liveChatSessionSelection';
import { useAuthStore } from '@/stores/authRegistry';

const PORTAL_HOME_TAB_ID = 'portal-home';
const PORTAL_HOME_TAB_PATH = '/portal/dashboard';

const tabsDebugEnabled = () => {
  if (!import.meta.env.DEV) return false;
  try {
    return localStorage.getItem('arivu:debug:tabs') === '1';
  } catch (_e) {
    return false;
  }
};

const logTabsDebug = (...args) => {
  if (!tabsDebugEnabled()) return;
  globalThis.console.log(...args);
};

// File-local console wrapper so existing tab debug logs stay opt-in without
// rewriting every callsite in this large module.
const console = {
  ...globalThis.console,
  log: (...args) => logTabsDebug(...args),
  info: (...args) => {
    if (!tabsDebugEnabled()) return;
    globalThis.console.info(...args);
  },
  debug: (...args) => {
    if (!tabsDebugEnabled()) return;
    globalThis.console.debug(...args);
  },
};

// Tab state management
const tabs = ref([]);
const activeTabId = ref(null);

const helpdeskTabAlertController = createHelpdeskTabAlertController(tabs, activeTabId);
const liveChatTabAlertController = createLiveChatTabAlertController(tabs, activeTabId);
const internalChatTabAlertController = createInternalChatTabAlertController(tabs, activeTabId);

function i18nTabHelpers() {
  return {
    t: i18n.global.t.bind(i18n.global),
    te: i18n.global.te.bind(i18n.global)
  };
}

/** Mark an open case tab when inbound email/chat arrives (background tabs only). */
export function markHelpdeskTabAlertForCase(caseId, kind) {
  return helpdeskTabAlertController.markTabAlertForCase(caseId, kind, i18nTabHelpers());
}

/** Mark case or Cases list tab when a new case is created (background tabs only). */
export function markHelpdeskTabAlertForNewCase(caseId, kind) {
  return helpdeskTabAlertController.markTabAlertForNewCase(caseId, kind, i18nTabHelpers());
}

/** Mark Live Chat browser tab when inbound session/message arrives (background tabs only). */
export function markLiveChatTabAlert(kind) {
  return liveChatTabAlertController.markLiveChatTabAlert(kind, i18nTabHelpers());
}

/** Mark Internal Chat browser tab when a DM/mention arrives (background tabs only). */
export function markInternalChatTabAlert(kind) {
  return internalChatTabAlertController.markInternalChatTabAlert(kind, i18nTabHelpers());
}

export function tabShowsHelpdeskAlert(tab, activeId = activeTabId.value) {
  return helpdeskTabAlertController.tabShowsAlertHighlight(tab, activeId)
    || liveChatTabAlertController.tabShowsAlertHighlight(tab, activeId)
    || internalChatTabAlertController.tabShowsAlertHighlight(tab, activeId);
}
// Storage key is computed per instance+user to prevent tab leakage across instances/users.
// Design invariant: Persistent UI state must be scoped at the same granularity as access control.
// Tabs are therefore scoped strictly by instanceId + userId.
let storageKey = null;
let storageConfigured = false;
let tabsInitialized = false;
const TABS_SCHEMA_VERSION = 3;

// Flag to track programmatic navigation (to avoid circular loops)
let isProgrammaticNavigation = false;
let lastProgrammaticPath = null;
// Flag to track browser navigation (popstate) to prevent route watcher from interfering
let isBrowserNavigation = false;
// Flag to prevent concurrent calls to createDefaultTab
let isCreatingHomeTab = false;
// Avoid openTab ↔ navigateLiveChat* recursion
let skipLiveChatOpenTabRouting = false;

/** Prefer the browser URL on hard reload so tab sync never overrides deep-linked Live Chat sessions. */
function getInitialRoutePath(routeToWatch) {
  if (typeof window !== 'undefined') {
    const browserPath = String(window.location.pathname || '').split('?')[0];
    if (browserPath && browserPath !== '/') {
      return browserPath;
    }
  }
  return String(routeToWatch?.path || '/').split('?')[0];
}

function isPortalOnlySession() {
  try {
    const authStore = useAuthStore();
    if (!authStore?.isAuthenticated) return false;
    const hasPortal = authStore.hasAssignedAppAccess('PORTAL');
    const hasSales = authStore.hasAssignedAppAccess('SALES');
    const hasAudit = authStore.hasAssignedAppAccess('AUDIT');
    return hasPortal && !hasSales && !hasAudit;
  } catch {
    return false;
  }
}

function isPlatformHomeTab(tab) {
  if (!tab) return false;
  return tab.id === 'home' || tab.path === '/platform/home';
}

function isPortalHomeTab(tab) {
  if (!tab) return false;
  return tab.id === PORTAL_HOME_TAB_ID || tab.path === PORTAL_HOME_TAB_PATH;
}

/** Portal-only users must not keep the internal Platform Home tab alongside Portal dashboard. */
function purgePlatformHomeTabsForPortalSession() {
  if (!isPortalOnlySession()) return;

  tabs.value = tabs.value.filter((tab) => !isPlatformHomeTab(tab));

  const portalDashboardTabs = tabs.value.filter(
    (tab) => tab.path === PORTAL_HOME_TAB_PATH || tab.path?.startsWith(`${PORTAL_HOME_TAB_PATH}/`)
  );
  if (portalDashboardTabs.length > 1) {
    const keep = portalDashboardTabs.find(isPortalHomeTab) || portalDashboardTabs[0];
    keep.id = PORTAL_HOME_TAB_ID;
    keep.path = PORTAL_HOME_TAB_PATH;
    keep.closable = false;
    const keepId = keep.id;
    tabs.value = tabs.value.filter((tab) => {
      const isDashboardTab =
        tab.path === PORTAL_HOME_TAB_PATH || tab.path?.startsWith(`${PORTAL_HOME_TAB_PATH}/`);
      return !isDashboardTab || tab.id === keepId;
    });
  }

  const removedActive = !tabs.value.some((tab) => tab.id === activeTabId.value);
  if (removedActive) {
    const portalHome = tabs.value.find(isPortalHomeTab);
    activeTabId.value = portalHome?.id || tabs.value[0]?.id || null;
  }

  if (storageConfigured && storageKey) {
    saveTabsToStorage();
  }
}

/** Public booking / manage / webform fill URLs must not be overridden by persisted CRM tabs. */
import { isStandalonePublicRoute, isAuthLifecyclePublicRoute, shouldSkipTabRoute } from '@/utils/standaloneRoutes';
export { isStandalonePublicRoute, isAuthLifecyclePublicRoute, shouldSkipTabRoute };

// Icon mapping for serialization/deserialization
const iconMap = {
  'home': HomeIcon,
  'inbox': InboxIcon,
  'chat-bubble-left-right': ChatBubbleLeftRightIcon,
  'chat-bubble-oval-left-ellipsis': ChatBubbleOvalLeftEllipsisIcon,
  'users': UsersIcon,
  'building': BuildingOfficeIcon,
  'briefcase': BriefcaseIcon,
  'check': CheckCircleIcon,
  'check-circle': CheckCircleIcon,
  'calendar': CalendarIcon,
  'clipboard-list': ClipboardDocumentListIcon,
  'clipboard-document-list': ClipboardDocumentListIcon,
  'exclamation': ExclamationTriangleIcon,
  'exclamation-triangle': ExclamationTriangleIcon,
  'shield': ShieldCheckIcon,
  'shield-check': ShieldCheckIcon,
  'magnifying-glass': MagnifyingGlassIcon,
  'squares': Squares2X2Icon,
  'document-chart-bar': DocumentChartBarIcon,
  'dashboard': DocumentChartBarIcon,
  'presentation-chart': PresentationChartLineIcon,
  'document-magnifying-glass': DocumentMagnifyingGlassIcon,
  // Audit app module aliases from registry/backend
  'audits': DocumentMagnifyingGlassIcon,
  'cases': TicketIcon,
  'ticket': TicketIcon,
  'responses': ClipboardDocumentListIcon,
  'download': ArrowDownTrayIcon,
  'folder': FolderIcon,
  'book': BookOpenIcon,
  'computer': ComputerDesktopIcon,
  'trash': TrashIcon,
  'document': DocumentTextIcon,
  'cog': Cog6ToothIcon,
  'lifebuoy': LifebuoyIcon,
  'helpdesk': LifebuoyIcon,
  'support': LifebuoyIcon,
  'document-text': DocumentTextIcon,
  'shopping-cart': ShoppingCartIcon,
  'document-currency-dollar': DocumentCurrencyDollarIcon,
  'credit-card': CreditCardIcon,
  quotes: DocumentTextIcon,
  sales_orders: ShoppingCartIcon,
  invoices: DocumentCurrencyDollarIcon,
  payments: CreditCardIcon,
  cube: CubeIcon,
  megaphone: MegaphoneIcon,
  funnel: FunnelIcon,
  photo: PhotoIcon,
  'chart-bar': ChartBarIcon,
  sparkles: SparklesIcon,
  astra: AstraTabIcon
};

const GENERIC_TAB_ICON_IDS = new Set(['document', 'document-text']);

const RESPONSES_PATH_PREFIX = '/responses';

function isResponsesPath(path = '') {
  const pathOnly = String(path || '').split('?')[0].split('#')[0].toLowerCase();
  return pathOnly === RESPONSES_PATH_PREFIX || pathOnly.startsWith(`${RESPONSES_PATH_PREFIX}/`);
}

function resolveTabIconForPath(pathOnly, optionsIcon) {
  if (isResponsesPath(pathOnly)) {
    return getIconForPath(pathOnly);
  }
  // Astra always uses the brand AI logo, ignoring generic sidebar hints (e.g. sparkles).
  if (String(pathOnly || '').split('?')[0].split('#')[0] === '/astra') {
    return 'astra';
  }
  if (optionsIcon) {
    const resolved = resolveTabIconId(optionsIcon, pathOnly);
    if (resolved) return resolved;
  }
  return getIconForPath(pathOnly);
}

// Map emoji icons to icon identifiers
const migrateEmojiToIconId = (emojiIcon, path = '') => {
  const pathOnly = String(path || '').split('?')[0].split('#')[0].toLowerCase();
  if (emojiIcon === '📦') {
    if (pathOnly.startsWith('/sales-orders')) return MODULE_ICON_IDS.sales_orders;
    return 'cube';
  }
  if (emojiIcon === '🧾') {
    if (pathOnly.startsWith('/invoices')) return MODULE_ICON_IDS.invoices;
    if (pathOnly.startsWith('/quotes')) return MODULE_ICON_IDS.quotes;
    return MODULE_ICON_IDS.quotes;
  }
  if (emojiIcon === '📋') {
    if (isResponsesPath(path)) return 'clipboard-document-list';
    return 'shield-check';
  }
  const emojiToIconIdMap = {
    '🏠': 'home',
    '👥': 'users',
    '👤': 'users', // Contact detail icon
    '🏢': 'building',
    '💼': 'briefcase',
    '✅': 'check',
    '📅': 'calendar',
    '🛡️': 'shield-check',
    '🎧': 'lifebuoy',
    '🛟': 'lifebuoy',
    '⬇️': 'download',
    '📁': 'folder',
    '📚': 'book',
    '🖥️': 'computer',
    '📄': 'document',
    '🎫': 'ticket',
    '💳': 'credit-card'
  };

  return emojiToIconIdMap[emojiIcon] || 'document';
};

const TAB_ICON_ALIASES = {
  helpdesk: 'lifebuoy',
  audit: 'shield-check',
  '🛡️': 'shield-check',
  '📋': 'shield-check',
  '🎧': 'lifebuoy',
  '🛟': 'lifebuoy',
};

/** Resolve an explicit icon hint to a known tab icon id, or null when it is generic/unknown. */
const resolveTabIconId = (iconId, path = '') => {
  const rawIcon = String(iconId || '').trim();
  if (!rawIcon) return null;

  if (rawIcon.match(/[\u{1F300}-\u{1F9FF}]/u)) {
    const migrated = migrateEmojiToIconId(rawIcon, path);
    return GENERIC_TAB_ICON_IDS.has(migrated) ? null : migrated;
  }

  const normalized = rawIcon.toLowerCase();
  const aliasTarget = TAB_ICON_ALIASES[normalized];
  if (aliasTarget && iconMap[aliasTarget]) return aliasTarget;
  if (iconMap[normalized]) return normalized;
  if (iconMap[rawIcon]) return rawIcon;

  const moduleResolved = resolveStoredModuleIconId(rawIcon, normalized);
  if (
    moduleResolved &&
    !GENERIC_TAB_ICON_IDS.has(moduleResolved) &&
    iconMap[moduleResolved]
  ) {
    return moduleResolved;
  }

  return null;
};

// Convert icon identifier to component
const getIconComponent = (iconId) => {
  const resolvedId = resolveTabIconId(iconId);
  if (resolvedId && iconMap[resolvedId]) {
    return iconMap[resolvedId];
  }
  return DocumentTextIcon;
};

const APP_KEYS = ['sales', 'helpdesk', 'audit', 'portal', 'projects'];
const inferAppKeyFromTitle = (title = '') => {
  const normalized = String(title || '').toLowerCase();
  for (const appKey of APP_KEYS) {
    if (normalized.includes(appKey)) return appKey;
  }
  return null;
};

const normalizeLegacyDashboardPath = (path, title) => {
  const normalizedPath = String(path || '');
  const inferredFromTitle = inferAppKeyFromTitle(title);

  // Very old shared dashboard route.
  if (normalizedPath === '/dashboard') {
    return inferredFromTitle ? `/dashboard/${inferredFromTitle}` : '/dashboard/sales';
  }

  // Legacy sales alias; keep Sales, but recover other app tabs incorrectly saved as sales.
  if (normalizedPath === '/sales/dashboard') {
    if (inferredFromTitle && inferredFromTitle !== 'sales') {
      return `/dashboard/${inferredFromTitle}`;
    }
    return '/dashboard/sales';
  }

  // Already app-scoped route.
  if (normalizedPath.startsWith('/dashboard/')) {
    return normalizedPath;
  }

  // Legacy Helpdesk tab route persisted before cases namespace was introduced.
  if (normalizedPath === '/cases' || normalizedPath === '/cases/') {
    return '/helpdesk/cases';
  }

  return normalizedPath;
};

// Compute storage key based on instance and user identifiers
const getStorageKey = (instanceId, userId) => {
  if (!instanceId || !userId) {
    // Fail loud: tabs must never initialize without instance + user context.
    throw new Error('[Tabs] Missing instanceId or userId. Tabs storage must never initialize without both.');
  }
  return `arivu-tabs:${instanceId}:${userId}`;
};

// Allow app bootstrap to configure per-instance, per-user storage scoping (one-time)
export const configureTabsStorage = ({ instanceId, userId }) => {
  const nextKey = getStorageKey(instanceId, userId);
  if (storageConfigured && storageKey === nextKey) {
    return;
  }
  if (storageConfigured) {
    console.warn('[Tabs] Reconfiguring tab storage for new scope.', {
      previousKey: storageKey,
      nextKey,
    });
    tabsInitialized = false;
  }
  storageKey = nextKey;
  storageConfigured = true;
};

// Clear in-memory tab state (used on logout/auth reset). Does not touch persisted storage.
export const resetTabsState = () => {
  tabs.value = [];
  activeTabId.value = null;
  isProgrammaticNavigation = false;
  lastProgrammaticPath = null;
  storageKey = null;
  storageConfigured = false;
  tabsInitialized = false;
};

function findLiveChatMainTabInMemory() {
  return tabs.value.find((tab) => {
    if (tab.titleKey === 'navigation.liveChat') return true;
    const tabPath = normalizeLiveChatPath(tab.path);
    return isLiveChatSessionsRoute(tabPath);
  }) || null;
}

function migrateLiveChatClosedTabStorage(tab) {
  if (!tab) return tab;
  const tabPath = normalizeLiveChatPath(tab.path);
  if (isLiveChatVisitorsRoute(tabPath)) {
    tab.path = LIVE_CHAT_CLOSED_TAB_PATH;
    if (tab.titleKey === 'liveChat.navVisitors') {
      tab.titleKey = 'liveChat.navClosed';
    }
    tab.icon = 'clipboard-document-list';
  } else if (isLiveChatClosedSessionsRoute(tabPath)) {
    if (tab.titleKey === 'liveChat.navVisitors') {
      tab.titleKey = 'liveChat.navClosed';
    }
    tab.icon = 'clipboard-document-list';
  }
  return tab;
}

function normalizeLiveChatMainTabStorage(tab) {
  if (!tab) return tab;
  const tabPath = normalizeLiveChatPath(tab.path);
  const isMain =
    tab.titleKey === 'navigation.liveChat'
    || tabPath === LIVE_CHAT_MAIN_TAB_PATH
    || isLiveChatSessionDetailPath(tabPath);
  if (isMain && isLiveChatSessionsRoute(tabPath)) {
    tab.path = LIVE_CHAT_MAIN_TAB_PATH;
    tab.icon = 'chat-bubble-left-right';
    if (!tab.titleKey) {
      tab.titleKey = 'navigation.liveChat';
    }
  }
  return tab;
}

function migrateLiveChatTabsInMemory() {
  let mainTab = findLiveChatMainTabInMemory();
  const liveChatTabs = tabs.value.filter((tab) => {
    const tabPath = normalizeLiveChatPath(tab.path);
    return (
      isLiveChatRoute(tabPath)
      || tab.titleKey === 'navigation.liveChat'
      || tab.titleKey === 'liveChat.navClosed'
      || tab.titleKey === 'liveChat.navReports'
      || tab.titleKey === 'liveChat.navVisitors'
    );
  });

  if (liveChatTabs.length > 1) {
    if (!mainTab) {
      mainTab = liveChatTabs[0];
    }
    const keepId = mainTab.id;
    mainTab.path = LIVE_CHAT_MAIN_TAB_PATH;
    mainTab.titleKey = 'navigation.liveChat';
    mainTab.icon = 'chat-bubble-left-right';
    tabs.value = tabs.value.filter((tab) => {
      if (tab.id === keepId) return true;
      const tabPath = normalizeLiveChatPath(tab.path);
      return !(
        isLiveChatRoute(tabPath)
        || tab.titleKey === 'navigation.liveChat'
        || tab.titleKey === 'liveChat.navClosed'
        || tab.titleKey === 'liveChat.navReports'
        || tab.titleKey === 'liveChat.navVisitors'
      );
    });
    if (activeTabId.value && !tabs.value.some((tab) => tab.id === activeTabId.value)) {
      activeTabId.value = keepId;
    }
  }

  tabs.value.forEach((tab) => {
    migrateLiveChatClosedTabStorage(tab);
    normalizeLiveChatMainTabStorage(tab);
  });
}

// Load tabs from localStorage on initialization
const loadTabsFromStorage = () => {
  try {
    if (!storageConfigured || !storageKey) {
      throw new Error('[Tabs] loadTabsFromStorage called before storage was configured.');
    }
    const stored = localStorage.getItem(storageKey);
    logTabsDebug('🔄 [loadTabsFromStorage] Loading from storage key:', storageKey, 'stored:', !!stored);
    
    if (stored) {
      const parsed = JSON.parse(stored);
      logTabsDebug('🔄 [loadTabsFromStorage] Parsed tabs:', parsed.tabs?.length || 0);
      let loadedTabs = parsed.tabs || [];
      let loadedActiveTabId = parsed.activeTabId || null;
      const hasLegacySchema = Number(parsed.schemaVersion || 1) < TABS_SCHEMA_VERSION;
      
      // Deduplicate home tabs before setting tabs.value
      // Keep only the first home tab found (by ID or path)
      const homeTabs = loadedTabs.filter(tab => tab.id === 'home' || tab.path === '/platform/home');
      if (homeTabs.length > 1) {
        console.warn('⚠️ [loadTabsFromStorage] Found', homeTabs.length, 'duplicate home tabs, removing duplicates');
        // Keep the first home tab, remove the rest
        const firstHomeTabIndex = loadedTabs.findIndex(tab => tab.id === 'home' || tab.path === '/platform/home');
        const firstHomeTab = loadedTabs[firstHomeTabIndex];
        const removedHomeTabIds = homeTabs.slice(1).map(tab => tab.id);
        
        loadedTabs = loadedTabs.filter((tab, index) => {
          const isHomeTab = tab.id === 'home' || tab.path === '/platform/home';
          // Keep if it's not a home tab, or if it's the first home tab
          return !isHomeTab || index === firstHomeTabIndex;
        });
        
        // If the active tab was one of the removed duplicates, update it to the remaining home tab
        if (loadedActiveTabId && removedHomeTabIds.includes(loadedActiveTabId)) {
          logTabsDebug('🔄 [loadTabsFromStorage] Active tab was a duplicate home tab, updating to remaining home tab');
          loadedActiveTabId = firstHomeTab.id;
        }
        
        logTabsDebug('✅ [loadTabsFromStorage] Removed duplicate home tabs, remaining tabs:', loadedTabs.length);
      }
      
      if (hasLegacySchema) {
        loadedTabs = loadedTabs.map((tab) => ({
          ...tab,
          path: normalizeLegacyDashboardPath(tab.path, tab.title)
        }));
      }

      tabs.value = loadedTabs.map((tab) => hydrateTabFromStorage(tab));
      activeTabId.value = loadedActiveTabId;
      migrateLiveChatTabsInMemory();
      if (storageConfigured && storageKey) {
        saveTabsToStorage();
      }
      
      // Convert icon identifiers back to components
      tabs.value.forEach(tab => {
        if (typeof tab.icon === 'string') {
          // Check if it's an emoji (for migration)
          if (tab.icon.match(/[\u{1F300}-\u{1F9FF}]/u)) {
            logTabsDebug('🔄 Migrating emoji icon to icon ID:', tab.icon, 'for tab:', tab.title);
            tab.icon = migrateEmojiToIconId(tab.icon, tab.path);
          }
          // Convert icon ID to component
          tab.icon = getIconComponent(tab.icon);
        }

        // Recovery: persisted tabs may have generic document icons — infer from route.
        const currentIconId = getIconId(tab.icon);
        if (GENERIC_TAB_ICON_IDS.has(currentIconId)) {
          const inferredIconId = getIconForPath(tab.path || '');
          if (!GENERIC_TAB_ICON_IDS.has(inferredIconId)) {
            tab.icon = getIconComponent(inferredIconId);
          }
        }

        // Registry may expose a wrong leaf icon (e.g. cog) while the shell renders Cases via moduleKey.
        const tabPathBase = String(tab.path || '').split('?')[0].split('#')[0];
        const isHelpdeskCasesPath =
          tabPathBase === '/helpdesk/cases' || tabPathBase.startsWith('/helpdesk/cases/');
        if (isHelpdeskCasesPath) {
          const id = getIconId(tab.icon);
          if (id !== 'cases' && id !== 'ticket') {
            tab.icon = getIconComponent('cases');
          }
        }

        const isSalesDashboardPath =
          tabPathBase === '/sales/dashboard'
          || tabPathBase.startsWith('/sales/dashboard/')
          || tabPathBase === '/dashboard/sales'
          || tabPathBase.startsWith('/dashboard/sales/');
        if (isSalesDashboardPath) {
          const id = getIconId(tab.icon);
          if (id !== 'document-chart-bar' && id !== 'dashboard') {
            tab.icon = getIconComponent('document-chart-bar');
          }
        }

        if (isLiveChatSessionsRoute(tabPathBase)) {
          const id = getIconId(tab.icon);
          if (id !== 'chat-bubble-left-right') {
            tab.icon = getIconComponent('chat-bubble-left-right');
          }
        }

        if (tabPathBase === '/internal-chat' || tabPathBase.startsWith('/internal-chat/')) {
          const id = getIconId(tab.icon);
          if (id !== 'chat-bubble-oval-left-ellipsis') {
            tab.icon = getIconComponent('chat-bubble-oval-left-ellipsis');
          }
        }
        
        // Migrate only legacy shared /dashboard tabs.
        // Keep app-scoped routes like /dashboard/helpdesk untouched.
        if (tab.path === '/dashboard' || (tab.id === 'dashboard' && (!tab.path || tab.path === '/'))) {
          logTabsDebug('🔄 Migrating legacy dashboard tab to scoped sales dashboard route');
          tab.id = generateTabId(); // Generate new ID since it's not the home tab
          tab.path = '/dashboard/sales';
          tab.title = 'Sales Dashboard';
          tab.icon = getIconComponent('document-chart-bar');
          tab.closable = true; // Dashboard tabs are closable
        }
      });
      
      // Update activeTabId if it was 'dashboard' - find the migrated tab
      if (activeTabId.value === 'dashboard') {
        const migratedTab = tabs.value.find(tab => tab.path === '/dashboard/sales');
        if (migratedTab) {
          activeTabId.value = migratedTab.id;
        } else {
          // If migration didn't happen, clear it
          activeTabId.value = null;
        }
      }
      
      // Don't create home tab here - let setupRouteWatcher decide based on current route
      // This prevents creating unnecessary home tabs when on dashboard routes
      if (tabs.value.length === 0) {
        logTabsDebug('🔄 [loadTabsFromStorage] No tabs found, will be created by setupRouteWatcher based on route');
      } else {
        logTabsDebug('✅ [loadTabsFromStorage] Loaded', tabs.value.length, 'tabs from storage');
      }

      // Persist migrated shape once so legacy cleanup is one-time.
      if (hasLegacySchema || Number(parsed.schemaVersion || 1) < TABS_SCHEMA_VERSION) {
        saveTabsToStorage();
      }
    } else {
      // No stored tabs - don't create home tab here, let setupRouteWatcher decide
      logTabsDebug('🔄 [loadTabsFromStorage] No stored tabs, will be created by setupRouteWatcher based on route');
    }
  } catch (e) {
    console.error('❌ [loadTabsFromStorage] Error loading tabs:', e);
    // Don't create home tab on error either - let setupRouteWatcher handle it
    logTabsDebug('🔄 [loadTabsFromStorage] Error occurred, will create tab based on route in setupRouteWatcher');
  }
};

// Convert icon component to identifier
const getIconId = (iconComponent) => {
  for (const [id, component] of Object.entries(iconMap)) {
    if (component === iconComponent) {
      return id;
    }
  }
  return 'document'; // fallback
};

/** Restore a module list tab title after leaving a record/designer view. */
function restoreModuleListTabTitle(tab, path) {
  if (!tab || !path) return;
  const pathBase = String(path).split('?')[0];
  delete tab.recordTitle;
  if (tab.params && 'name' in tab.params) {
    const nextParams = { ...tab.params };
    delete nextParams.name;
    tab.params = nextParams;
  }
  const meta = getTabTitleMetaForPath(pathBase, tab.params || {});
  if (meta.titleKey) {
    tab.titleKey = meta.titleKey;
    tab.titleParams = meta.titleParams || {};
    delete tab.title;
  } else if (meta.title) {
    tab.title = meta.title;
    delete tab.titleKey;
    delete tab.titleParams;
  } else {
    const fallbackTitle = getTitleForPath(pathBase, tab.params || {});
    if (fallbackTitle) tab.title = fallbackTitle;
    delete tab.titleKey;
    delete tab.titleParams;
  }
}

function isAutomationModuleListRoute(path) {
  const pathBase = String(path || '').split('?')[0];
  return pathBase.startsWith('/settings/automation/') && !isProcessDesignerTabPath(pathBase);
}

/** Apply a record display name to a tab (persisted as recordTitle + title). */
function applyRecordTabTitle(tab, name) {
  const trimmed = String(name || '').trim();
  if (!tab || !trimmed) return;
  tab.recordTitle = trimmed;
  tab.title = trimmed;
  tab.params = { ...tab.params, name: trimmed };
  if (isRecordDetailTabPath(tab.path)) {
    const moduleRoute = String(tab.path).split('?')[0].split('/').filter(Boolean)[0];
    tab.titleKey = 'navigation.tabRecordNamed';
    tab.titleParams = {
      ...tab.titleParams,
      moduleRoute,
      name: trimmed
    };
  } else {
    delete tab.titleKey;
    delete tab.titleParams;
  }
}

function serializeTabForStorage(tab) {
  const recordName = getPersistedRecordTabName(tab);
  const serialized = {
    id: tab.id,
    path: tab.path,
    closable: tab.closable,
    params: tab.params,
    icon: typeof tab.icon === 'string' ? tab.icon : getIconId(tab.icon)
  };
  if (recordName && isRecordDetailTabPath(tab.path)) {
    serialized.recordTitle = recordName;
    serialized.title = recordName;
    serialized.titleKey = 'navigation.tabRecordNamed';
    const moduleRoute = String(tab.path).split('?')[0].split('/').filter(Boolean)[0];
    serialized.titleParams = {
      ...tab.titleParams,
      moduleRoute,
      name: recordName
    };
  } else if (tab.titleKey) {
    serialized.titleKey = tab.titleKey;
    serialized.titleParams = tab.titleParams;
    if (tab.title) serialized.title = tab.title;
  } else if (tab.title) {
    serialized.title = tab.title;
  }
  return serialized;
}

// Save tabs to localStorage
const saveTabsToStorage = () => {
  // Title/route updates can race ahead of per-user bootstrap — skip until configured.
  if (!storageConfigured || !storageKey) return;
  try {
    const tabsToSave = tabs.value.map(serializeTabForStorage);

    localStorage.setItem(storageKey, JSON.stringify({
      schemaVersion: TABS_SCHEMA_VERSION,
      tabs: tabsToSave,
      activeTabId: activeTabId.value
    }));
  } catch (e) {
    console.error('Error saving tabs:', e);
  }
};

// Watch for changes and save (skip until bootstrap configures per-user storage)
watch([tabs, activeTabId], () => {
  if (storageConfigured && storageKey) {
    saveTabsToStorage();
  }
}, { deep: true });

// Create default home tab (platform home)
const createDefaultTab = () => {
  if (isPortalOnlySession()) {
    return createPortalDefaultTab();
  }
  // Prevent concurrent calls
  if (isCreatingHomeTab) {
    console.log('🔒 [createDefaultTab] Already creating home tab, skipping concurrent call');
    return;
  }
  
  // Check if home tab already exists to avoid duplicates
  // Check both by ID and by path to catch all cases
  // Use a more thorough check to prevent any duplicates
  const existingHomeTabById = tabs.value.find(tab => tab.id === 'home');
  const existingHomeTabByPath = tabs.value.find(tab => tab.path === '/platform/home' || tab.path?.startsWith('/platform/home'));
  const existingHomeTab = existingHomeTabById || existingHomeTabByPath;
  
  if (existingHomeTab) {
    console.log('🔄 [createDefaultTab] Home tab already exists (id:', existingHomeTab.id, 'path:', existingHomeTab.path, '), updating it (not creating duplicate). Current tabs:', tabs.value.length);
    existingHomeTab.id = 'home';
    existingHomeTab.path = '/platform/home';
    existingHomeTab.title = 'Home';
    existingHomeTab.icon = getIconComponent('home');
    existingHomeTab.closable = false;
    // Don't force set activeTabId here - let the caller decide
    // activeTabId.value = 'home';
    // Force reactive update by reassigning the array
    tabs.value = [...tabs.value];
    return;
  }
  
  // Additional safeguard: Count existing home tabs to detect duplicates
  const homeTabCount = tabs.value.filter(tab => tab.id === 'home' || tab.path === '/platform/home').length;
  if (homeTabCount > 0) {
    console.warn('⚠️ [createDefaultTab] Found', homeTabCount, 'existing home tab(s) but check above failed. Not creating duplicate.');
    return;
  }
  
  // Set flag to prevent concurrent calls
  isCreatingHomeTab = true;
  
  const homeTab = {
    id: 'home',
    titleKey: 'navigation.home',
    title: 'Home',
    path: '/platform/home',
    icon: getIconComponent('home'), // Convert to component immediately
    closable: false // Home tab cannot be closed
  };
  
  // Add to tabs array (don't replace, in case other tabs exist)
  if (tabs.value.length === 0) {
    tabs.value = [homeTab];
  } else {
    // Insert at beginning if tabs exist
    tabs.value.unshift(homeTab);
    // Force reactive update by reassigning the array
    tabs.value = [...tabs.value];
  }
  activeTabId.value = 'home';
  
  console.log('✅ [createDefaultTab] Home tab created:', homeTab, 'Total tabs:', tabs.value.length);
  
  // Immediately save to localStorage to ensure it persists
  if (storageConfigured && storageKey) {
    try {
      saveTabsToStorage();
      console.log('✅ [createDefaultTab] Tab saved to localStorage');
    } catch (e) {
      console.error('❌ [createDefaultTab] Error saving to localStorage:', e);
    }
  } else {
    console.warn('⚠️ [createDefaultTab] Storage not configured, cannot save tab');
  }
  
  // Reset flag after creation
  isCreatingHomeTab = false;
  
  // Force Vue to recognize the change immediately
  // This ensures TabBar component sees the new tab right away
  nextTick(() => {
    console.log('✅ [createDefaultTab] After nextTick, tabs count:', tabs.value.length);
  });
};

function createPortalDefaultTab() {
  if (isCreatingHomeTab) {
    return;
  }

  purgePlatformHomeTabsForPortalSession();

  const existing = tabs.value.find(isPortalHomeTab);
  if (existing) {
    existing.id = PORTAL_HOME_TAB_ID;
    existing.path = PORTAL_HOME_TAB_PATH;
    existing.title = getTitleForPath(PORTAL_HOME_TAB_PATH);
    existing.titleKey = 'navigation.home';
    existing.icon = getIconComponent(getIconForPath(PORTAL_HOME_TAB_PATH));
    existing.closable = false;
    activeTabId.value = existing.id;
    tabs.value = [...tabs.value];
    return;
  }

  isCreatingHomeTab = true;
  const portalHomeTab = {
    id: PORTAL_HOME_TAB_ID,
    title: getTitleForPath(PORTAL_HOME_TAB_PATH),
    titleKey: 'navigation.home',
    path: PORTAL_HOME_TAB_PATH,
    icon: getIconComponent(getIconForPath(PORTAL_HOME_TAB_PATH)),
    closable: false
  };

  if (tabs.value.length === 0) {
    tabs.value = [portalHomeTab];
  } else {
    tabs.value.unshift(portalHomeTab);
    tabs.value = [...tabs.value];
  }
  activeTabId.value = PORTAL_HOME_TAB_ID;
  isCreatingHomeTab = false;

  if (storageConfigured && storageKey) {
    saveTabsToStorage();
  }
}

// Generate unique tab ID
const generateTabId = () => {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Get icon for route (query/hash ignored so /helpdesk/cases?foo matches cases, not generic helpdesk)
const getIconForPath = (path) => {
  const pathOnly = String(path || '').split('?')[0].split('#')[0];
  const icons = {
    '/platform/home': 'home',
    '/platform/apps': 'squares',
    '/sales/dashboard': 'document-chart-bar',
    '/dashboard': 'home', // backward compat
    '/inbox': 'inbox',
    '/approvals': 'check',
    '/contacts': 'users',
    '/people': 'users',
    '/organizations': 'building',
    '/deals': 'briefcase',
    '/tasks': 'check',
    '/events': 'calendar',
    '/forms': 'document',
    '/responses': 'clipboard-list',
    '/findings': 'exclamation',
    '/audit': 'shield',
    '/calendar': 'calendar', // backward compat
    '/imports': 'download',
    '/documents': 'document-duplicate',
    '/items': 'folder',
    '/trash': 'trash',
    '/demo-requests': 'book',
    '/instances': 'computer',
    '/settings': 'cog',
    '/quotes': MODULE_ICON_IDS.quotes,
    '/sales-orders': MODULE_ICON_IDS.sales_orders,
    '/invoices': MODULE_ICON_IDS.invoices,
    '/payments': MODULE_ICON_IDS.payments,
    '/astra': 'astra',
    '/internal-chat': 'chat-bubble-oval-left-ellipsis',
  };

  // Audit app route-specific mappings (must run before base-path fallback).
  if (pathOnly === '/audit/dashboard' || pathOnly.startsWith('/audit/dashboard')) return 'presentation-chart';
  if (pathOnly === '/audit/audits' || pathOnly.startsWith('/audit/audits')) return 'document-magnifying-glass';
  if (pathOnly === '/audit/findings' || pathOnly.startsWith('/audit/findings')) return 'exclamation-triangle';
  if (pathOnly === '/audit/responses' || pathOnly.startsWith('/audit/responses')) return 'clipboard-document-list';
  if (pathOnly === '/portal/dashboard' || pathOnly.startsWith('/portal/dashboard')) return 'home';
  if (pathOnly === '/portal/cases' || pathOnly.startsWith('/portal/cases/')) return 'lifebuoy';
  if (pathOnly === '/portal/invoices' || pathOnly.startsWith('/portal/invoices')) return 'banknotes';
  if (pathOnly === '/portal/documents' || pathOnly.startsWith('/portal/documents')) return 'document-text';
  if (pathOnly === '/portal/knowledge' || pathOnly.startsWith('/portal/knowledge')) return 'book-open';
  if (pathOnly === '/helpdesk/cases' || pathOnly.startsWith('/helpdesk/cases/')) return 'cases';
  if (pathOnly === '/helpdesk/articles' || pathOnly.startsWith('/helpdesk/articles/')) return 'book-open';
  if (pathOnly === '/helpdesk/dashboard' || pathOnly.startsWith('/helpdesk/')) return 'lifebuoy';
  if (isLiveChatSessionsRoute(pathOnly)) return 'chat-bubble-left-right';
  if (isLiveChatClosedSessionsRoute(pathOnly)) return 'clipboard-document-list';
  if (isLiveChatVisitorsRoute(pathOnly)) return 'clipboard-document-list';
  if (isLiveChatReportsRoute(pathOnly)) return 'document-chart-bar';
  if (pathOnly === '/internal-chat' || pathOnly.startsWith('/internal-chat/')) {
    return 'chat-bubble-oval-left-ellipsis';
  }
  if (pathOnly === '/dashboard/helpdesk' || pathOnly.startsWith('/dashboard/helpdesk')) return 'lifebuoy';
  if (pathOnly === '/dashboard/audit' || pathOnly.startsWith('/dashboard/audit')) return 'shield-check';
  if (pathOnly === '/dashboard/sales' || pathOnly.startsWith('/dashboard/sales')) return 'document-chart-bar';
  if (pathOnly === '/dashboard/marketing' || pathOnly.startsWith('/dashboard/marketing')) return 'chart-bar';
  if (isLearningRoute(pathOnly)) return getLearningIconForPath(pathOnly);
  if (pathOnly.startsWith('/inventory/purchase-orders')) return 'document-text';
  if (pathOnly.startsWith('/marketing/campaigns')) return 'megaphone';
  if (pathOnly === '/marketing/blog' || pathOnly.startsWith('/marketing/blog/')) return 'document-text';
  if (pathOnly.startsWith('/marketing/audiences')) return 'users';
  if (pathOnly.startsWith('/marketing/segments')) return 'funnel';
  if (pathOnly.startsWith('/marketing/assets')) return 'photo';
  if (pathOnly.startsWith('/marketing/reports')) return 'chart-bar';
  if (pathOnly.startsWith('/analytics/reports')) return 'chart-bar';
  if (pathOnly.startsWith('/analytics/widgets')) return 'chart-bar';
  if (pathOnly.startsWith('/dashboard/')) return 'home';
  
  // Check for exact match first
  if (icons[pathOnly]) return icons[pathOnly];
  
  // Check for base path
  const basePath = '/' + pathOnly.split('/')[1];
  return icons[basePath] || 'document';
};

// Get title for route
const getTitleForPath = (path, params = {}) => {
  const titles = {
    '/platform/home': 'Home',
    '/platform/apps': 'Apps',
    '/sales/dashboard': 'Sales Dashboard',
    '/dashboard': 'Dashboard', // backward compat
    '/contacts': 'Contacts',
    '/people': 'People',
    '/organizations': 'Organizations',
    '/deals': 'Deals',
    '/quotes': 'Quotes',
    '/sales-orders': 'Sales Orders',
    '/invoices': 'Invoices',
    '/tasks': 'Tasks',
    '/events': 'Events',
    '/forms': 'Forms',
    '/responses': 'Responses',
    '/calendar': 'Events', // backward compat
    '/imports': 'Imports',
    '/documents': 'Documents',
    '/items': 'Items',
    '/helpdesk/cases': 'Cases',
    '/helpdesk/cases/': 'Cases',
    '/helpdesk/articles': 'Articles',
    '/helpdesk/articles/': 'Articles',
    '/trash': 'Trash',
    '/demo-requests': 'Demo Requests',
    '/instances': 'Instances',
    '/settings': 'Settings',
    '/onboarding': 'Set up your workspace',
    '/appointments/pages': 'Booking Pages',
    '/appointments/configure': 'Personal booking page',
    // Control Plane routes
    '/control': 'Control Plane',
    '/control/demo-requests': 'Demo Requests',
    '/control/instances': 'Instances',
    '/settings/automation/automation-rules': 'Automation Rules',
    '/settings/automation/processes': 'Processes',
    '/settings/automation/flows': 'Business Flows',
    '/control/inbound-parser': 'Inbound Parser',
    '/control/automation-rules': 'Automation Rules',
    '/control/processes': 'Processes',
    '/control/flows': 'Business Flows',
    // Audit app routes
    '/audit/dashboard': 'Audit Dashboard',
    '/audit/audits': 'My Audits',
    '/audit/responses': 'Responses',
    // Portal app routes
    '/portal/dashboard': 'Home',
    '/portal/cases': 'Support',
    '/portal/invoices': 'Invoices',
    '/portal/documents': 'Documents',
    '/portal/knowledge': 'Help Center'
  };
  
  // Check for exact path match FIRST (before any other logic)
  if (titles[path]) {
    return titles[path];
  }
  
  // Check for base path
  const basePath = '/' + path.split('/')[1];
  const segments = path.split('/');
  
  // Special case: Sales dashboard route
  if (path === '/sales/dashboard' || path.startsWith('/sales/dashboard')) {
    return 'Sales Dashboard';
  }
  
  // Special case: Control Plane routes (handle detail pages)
  if (path.startsWith('/control/')) {
    return titles[`/control/${segments[2]}`] || 'Control Plane';
  }

  // Settings → Automation routes (handle flow detail pages)
  if (path.startsWith('/settings/automation/')) {
    if (isProcessDesignerTabPath(path)) {
      return i18n.global.t('process.setupTitle');
    }
    if (segments[2] === 'flows' && segments[3]) {
      if (segments[4] === 'health') {
        return 'Flow Health';
      } else if (segments[4] === 'edit') {
        return 'Edit Business Flow';
      } else if (segments[3] === 'create') {
        return 'Create Business Flow';
      }
      return 'Business Flow';
    }
    return titles[`/settings/automation/${segments[2]}`] || 'Automation';
  }
  
  // Special case: Audit app routes
  if (path.startsWith('/audit/')) {
    // Return specific titles for audit routes
    if (path === '/audit/dashboard' || path.startsWith('/audit/dashboard')) {
      return 'Audit Dashboard';
    } else if (path === '/audit/audits' || path.startsWith('/audit/audits')) {
      if (segments.length > 3) {
        // Detail page: /audit/audits/:eventId
        return 'Audit Detail';
      }
      return 'My Audits';
    }
    return 'Audit';
  }

  if (path.startsWith('/portal/')) {
    if (path === '/portal/dashboard' || path.startsWith('/portal/dashboard')) {
      return 'Home';
    }
    if (path.startsWith('/portal/cases')) {
      if (segments.length > 3) {
        return 'Case Detail';
      }
      return 'Support';
    }
    if (path.startsWith('/portal/invoices')) {
      return 'Invoices';
    }
    if (path.startsWith('/portal/documents')) {
      if (segments.length > 3) {
        return 'Document';
      }
      return 'Documents';
    }
    if (path.startsWith('/portal/knowledge')) {
      if (segments.length > 3) {
        return 'Article';
      }
      return 'Help Center';
    }
    return 'Portal';
  }

  // Appointment booking pages
  if (path.startsWith('/appointments/')) {
    if (path === '/appointments/pages' || path.startsWith('/appointments/pages')) {
      return 'Booking Pages';
    }
    if (path.startsWith('/appointments/team/configure')) {
      const id = segments[3];
      if (!id) return 'New team page';
      return 'Team booking page';
    }
    if (path.startsWith('/appointments/configure/user/')) {
      return 'Booking page';
    }
    if (path === '/appointments/configure' || path.startsWith('/appointments/configure')) {
      return 'Personal booking page';
    }
    return 'Booking Pages';
  }

  // Live Chat: single workspace tab; Sessions / Closed / Reports are in-page nav.
  if (path.startsWith('/live-chat/')) {
    return i18n.global.t('navigation.liveChat');
  }

  // Announcements: single workspace tab; All / Analytics / editor are in-page nav.
  if (isAnnouncementsRoute(path)) {
    return i18n.global.t('navigation.announcements');
  }

  // Learning modules each get their own tab — use route title keys.
  if (isLearningRoute(path)) {
    const meta = getTabTitleMetaForPath(path, params);
    if (meta.titleKey && i18n.global.te(meta.titleKey)) {
      return i18n.global.t(meta.titleKey, meta.titleParams || {});
    }
    if (meta.title) return meta.title;
    return i18n.global.t('navigation.appLearning');
  }

  // Special case: Helpdesk cases routes
  if (path.startsWith('/helpdesk/cases')) {
    if (segments[3] === 'new' || segments.length <= 3) {
      return 'Cases';
    }
    return 'Case Detail';
  }

  if (path.startsWith('/helpdesk/articles')) {
    const meta = getTabTitleMetaForPath(path, params);
    if (meta.titleKey && i18n.global.te(meta.titleKey)) {
      return i18n.global.t(meta.titleKey, meta.titleParams || {});
    }
    if (path.endsWith('/new')) return 'New Article';
    if (path.includes('/edit')) {
      return params.name ? `${params.name}` : 'Edit Article';
    }
    return 'Articles';
  }

  if (path.startsWith('/marketing/blog')) {
    const meta = getTabTitleMetaForPath(path, params);
    if (meta.titleKey && i18n.global.te(meta.titleKey)) {
      return i18n.global.t(meta.titleKey, meta.titleParams || {});
    }
    if (path.endsWith('/new')) return 'New Post';
    if (path.includes('/edit')) {
      return params.name ? `${params.name}` : 'Edit Post';
    }
    return 'Blog';
  }
  
  // Special case: App-scoped dashboard routes
  if (segments[1] === 'dashboard') {
    const appKey = String(segments[2] || '').toUpperCase();
    if (appKey) {
      const normalized = appKey.charAt(0) + appKey.slice(1).toLowerCase();
      return `${normalized} Dashboard`;
    }
    return 'Dashboard';
  }
  
  // Special case: Form Response detail view
  // Route shape: /forms/:formId/responses/:responseId
  if (segments[1] === 'forms' && segments[3] === 'responses' && segments[4]) {
    return `(${segments[4]}) Details`;
  }

  // Analytics platform routes (list, builder, detail) — before generic /:module/:id fallback
  if (path.startsWith('/analytics')) {
    const meta = getTabTitleMetaForPath(path, params);
    if (meta.titleKey && i18n.global.te(meta.titleKey)) {
      return i18n.global.t(meta.titleKey, meta.titleParams || {});
    }
    if (meta.title) {
      return meta.title;
    }
  }

  // If it's a detail page (has ID), customize title
  // But skip if it's an audit route or control route (handled above)
  if (path.split('/').length > 2 && !path.startsWith('/audit/') && !path.startsWith('/control/') && !path.startsWith('/settings/automation/') && segments[1] !== 'dashboard') {
    const module = segments[1];
    const t = i18n.global.t.bind(i18n.global);
    const te = i18n.global.te.bind(i18n.global);
    const moduleName = resolveModuleDisplayName(module, t, te);

    if (params.name) {
      return t('navigation.tabRecordNamed', { module: moduleName, name: params.name });
    }

    return t('navigation.tabRecordDetail', { module: moduleName });
  }
  
  return titles[basePath] || titles[path] || 'Page';
};

export function useTabs() {
  // Initialize router/route immediately in setup context
  let router = null;
  let route = null;
  
  // Try to get router immediately when useTabs is called (in setup context)
  try {
    const instance = getCurrentInstance();
    if (instance) {
      router = useRouter();
      route = useRoute();
    }
  } catch (e) {
    // Not in setup context, will try lazily
    console.warn('[useTabs] Not in setup context, router will be lazy-loaded:', e.message);
  }
  
  const getRouter = () => {
    if (!router) {
      try {
        const instance = getCurrentInstance();
        if (instance) {
          router = useRouter();
        } else {
          // No injection context (e.g. useTabs() after await in a watcher) — use app singleton
          router = appRouter;
        }
      } catch (e) {
        console.error('[useTabs] Error getting router:', e);
        if (!router) {
          router = appRouter;
        }
      }
    }
    return router;
  };
  
  // Navigate using router (push to create history entries for browser back/forward)
  const navigateToPath = (path) => {
    const currentRouter = getRouter();
    if (currentRouter) {
      const pathOnly = normalizeLiveChatPath(path);
      const currentPath = normalizeLiveChatPath(currentRouter.currentRoute.value.path);
      if (pathOnly === currentPath) {
        return Promise.resolve();
      }
      // Use push to create history entries so browser back/forward works correctly
      // Each tab navigation creates a history entry, allowing browser back to navigate between tabs
      return currentRouter.push(path).catch((err) => {
        // Ignore duplicate navigation errors (same route)
        if (err.name !== 'NavigationDuplicated') {
          console.log('⚠️ Navigation error (ignored):', err.message);
        }
      });
    } else {
      // Router should always be available in setup context
      // If not, log error but don't use window.location (causes reload)
      console.error('⚠️ Router not available in navigateToPath, cannot navigate to:', path);
      return Promise.resolve();
    }
  };
  
  const getRoute = () => {
    if (!route) {
      try {
        route = useRoute();
      } catch (e) {
        // Not in setup context, return null
        return null;
      }
    }
    return route;
  };

  // Find tab by ID
  const findTabById = (id) => {
    return tabs.value.find(tab => tab.id === id);
  };

  // Heuristic: path looks like a record detail (e.g. /deals/123, /people/456) so new tab should open adjacent.
  // Used when insertAdjacent is not explicitly set — so new modules get correct behavior by default.
  const looksLikeRecordPath = (path) => isRecordDetailTabPath(path);

  function findLiveChatMainTab() {
    return findLiveChatMainTabInMemory();
  }

  function findLiveChatClosedTab() {
    const byListPath = tabs.value.find(
      (tab) => normalizeLiveChatPath(tab.path) === LIVE_CHAT_CLOSED_TAB_PATH,
    );
    if (byListPath) return byListPath;
    return tabs.value.find((tab) => {
      if (tab.titleKey !== 'liveChat.navClosed') return false;
      const tabPath = normalizeLiveChatPath(tab.path);
      return !isLiveChatClosedSessionDetailPath(tabPath);
    }) || null;
  }

  /** @deprecated Legacy visitors tab id */
  function findLiveChatVisitorsTab() {
    return findLiveChatClosedTab();
  }

  function findLiveChatReportsTab() {
    return tabs.value.find((tab) => {
      const tabPath = normalizeLiveChatPath(tab.path);
      return isLiveChatReportsRoute(tabPath);
    }) || null;
  }

  function resolveLiveChatWorkspaceTab() {
    return (
      findLiveChatMainTab()
      || findLiveChatClosedTab()
      || findLiveChatReportsTab()
      || tabs.value.find((tab) => isLiveChatClosedSessionDetailPath(normalizeLiveChatPath(tab.path)))
      || null
    );
  }

  function pruneSecondaryLiveChatTabs(keepId) {
    const before = tabs.value.length;
    tabs.value = tabs.value.filter((tab) => {
      if (tab.id === keepId) return true;
      const tabPath = normalizeLiveChatPath(tab.path);
      if (isLiveChatRoute(tabPath)) return false;
      if (
        tab.titleKey === 'navigation.liveChat'
        || tab.titleKey === 'liveChat.navClosed'
        || tab.titleKey === 'liveChat.navReports'
        || tab.titleKey === 'liveChat.navVisitors'
      ) {
        return false;
      }
      return true;
    });
    if (tabs.value.length !== before && storageConfigured && storageKey) {
      saveTabsToStorage();
    }
  }

  function applyMainLiveChatTabAndNavigate(tab, routerPath, options = {}) {
    const routerTarget = normalizeLiveChatPath(routerPath);
    const sessionOptions = { ...options, titleKey: 'navigation.liveChat' };
    tab.path = LIVE_CHAT_MAIN_TAB_PATH;
    applyLiveChatTabTitle(tab, LIVE_CHAT_MAIN_TAB_PATH, sessionOptions);
    tab.icon = getIconComponent(getIconForPath(LIVE_CHAT_MAIN_TAB_PATH));
    activeTabId.value = tab.id;
    pruneSecondaryLiveChatTabs(tab.id);
    isProgrammaticNavigation = true;
    lastProgrammaticPath = routerTarget;
    navigateToPath(routerTarget).finally(() => {
      setTimeout(() => {
        isProgrammaticNavigation = false;
        lastProgrammaticPath = null;
      }, 300);
    });
    return tab;
  }

  function applyLiveChatTabTitle(tab, pathOnly, options = {}) {
    if (options.title && !isLiveChatSessionsRoute(pathOnly)) {
      if (!shouldPreserveRecordTabTitle(tab, pathOnly)) {
        tab.title = options.title;
      }
      return;
    }
    const meta = getTabTitleMetaForPath(pathOnly, options.params || tab.params || {});
    if (meta.titleKey) {
      tab.titleKey = meta.titleKey;
      tab.titleParams = meta.titleParams || {};
      tab.title = i18n.global.t(meta.titleKey, meta.titleParams || {});
    } else if (meta.title) {
      delete tab.titleKey;
      tab.title = meta.title;
    }
  }

  function updateLiveChatTabInPlace(tab, pathOnly, options = {}) {
    tab.path = pathOnly;
    applyLiveChatTabTitle(tab, pathOnly, options);
    tab.icon = getIconComponent(getIconForPath(pathOnly));
    if (options.params) {
      tab.params = { ...tab.params, ...options.params };
    }
  }

  function focusLiveChatTab(tab, pathOnly, options = {}) {
    updateLiveChatTabInPlace(tab, pathOnly, options);
    activeTabId.value = tab.id;
    isProgrammaticNavigation = true;
    lastProgrammaticPath = pathOnly;
    navigateToPath(pathOnly).then(() => {
      setTimeout(() => {
        isProgrammaticNavigation = false;
        lastProgrammaticPath = null;
      }, 300);
    }).catch(() => {
      setTimeout(() => {
        isProgrammaticNavigation = false;
        lastProgrammaticPath = null;
      }, 300);
    });
  }

  function ensureRouterAtPath(pathOnly) {
    const currentRouter = getRouter();
    if (!currentRouter) return Promise.resolve();
    const normalized = normalizeLiveChatPath(pathOnly);
    const vuePath = normalizeLiveChatPath(currentRouter.currentRoute.value.path);
    if (vuePath === normalized) return Promise.resolve();
    isProgrammaticNavigation = true;
    lastProgrammaticPath = normalized;
    return currentRouter.replace(normalized).finally(() => {
      setTimeout(() => {
        isProgrammaticNavigation = false;
        lastProgrammaticPath = null;
      }, 100);
    });
  }

  /** Sync Live Chat workspace tab; in-page routes stay in the router only. */
  function syncLiveChatMainTabPath(path) {
    const pathOnly = normalizeLiveChatPath(path);
    if (!isLiveChatRoute(pathOnly)) return false;

    const mainTab = resolveLiveChatWorkspaceTab();
    if (!mainTab) return false;

    normalizeLiveChatMainTabStorage(mainTab);
    mainTab.path = LIVE_CHAT_MAIN_TAB_PATH;
    applyLiveChatTabTitle(mainTab, LIVE_CHAT_MAIN_TAB_PATH, { titleKey: 'navigation.liveChat' });
    mainTab.icon = getIconComponent(getIconForPath(LIVE_CHAT_MAIN_TAB_PATH));
    if (activeTabId.value !== mainTab.id) {
      activeTabId.value = mainTab.id;
    }
    pruneSecondaryLiveChatTabs(mainTab.id);
    if (storageConfigured && storageKey) {
      saveTabsToStorage();
    }
    return true;
  }

  function syncLiveChatClosedTabPath(path) {
    return syncLiveChatMainTabPath(path);
  }

  function syncLiveChatVisitorsTabPath(path) {
    return syncLiveChatMainTabPath(path);
  }

  function syncLiveChatRouteTab(path) {
    return syncLiveChatMainTabPath(path);
  }

  function navigateLiveChatWorkspace(path, options = {}) {
    const routerPath = normalizeLiveChatPath(path);
    if (!isLiveChatRoute(routerPath)) return null;

    const navOptions = {
      ...options,
      titleKey: 'navigation.liveChat',
    };

    const workspaceTab = resolveLiveChatWorkspaceTab();
    if (workspaceTab) {
      return applyMainLiveChatTabAndNavigate(workspaceTab, routerPath, navOptions);
    }

    skipLiveChatOpenTabRouting = true;
    try {
      const created = openTab(LIVE_CHAT_MAIN_TAB_PATH, { ...navOptions, insertAdjacent: false });
      if (created && routerPath !== LIVE_CHAT_MAIN_TAB_PATH) {
        isProgrammaticNavigation = true;
        lastProgrammaticPath = routerPath;
        navigateToPath(routerPath).finally(() => {
          setTimeout(() => {
            isProgrammaticNavigation = false;
            lastProgrammaticPath = null;
          }, 300);
        });
      }
      return created;
    } finally {
      skipLiveChatOpenTabRouting = false;
    }
  }

  function navigateLiveChatSessions(path = LIVE_CHAT_MAIN_TAB_PATH, options = {}) {
    const routerPath = normalizeLiveChatPath(path);
    if (!isLiveChatSessionsRoute(routerPath)) return null;
    return navigateLiveChatWorkspace(routerPath, options);
  }

  function navigateLiveChatClosedSessions(path = LIVE_CHAT_CLOSED_TAB_PATH, options = {}) {
    const pathOnly = normalizeLiveChatPath(path);
    if (!isLiveChatClosedSessionsRoute(pathOnly) && !isLiveChatVisitorsRoute(pathOnly)) return null;
    const target = isLiveChatVisitorsRoute(pathOnly) ? LIVE_CHAT_CLOSED_TAB_PATH : pathOnly;
    return navigateLiveChatWorkspace(target, options);
  }

  function navigateLiveChatVisitors(path = LIVE_CHAT_CLOSED_TAB_PATH, options = {}) {
    return navigateLiveChatClosedSessions(path, options);
  }

  function navigateLiveChatReports(options = {}) {
    return navigateLiveChatWorkspace('/live-chat/reports', options);
  }

  function openLiveChatSession(sessionId) {
    const id = String(sessionId || '').trim();
    if (!id) return null;
    return navigateLiveChatSessions(`/live-chat/sessions/${id}`);
  }

  function openLiveChatClosedSession(sessionId, options = {}) {
    const id = String(sessionId || '').trim();
    if (!id) return null;
    return navigateLiveChatClosedSessions(`${LIVE_CHAT_CLOSED_TAB_PATH}/${id}`, options);
  }

  function openLiveChatVisitor(_visitorId) {
    return navigateLiveChatClosedSessions(LIVE_CHAT_CLOSED_TAB_PATH);
  }

  function resolveAnnouncementsWorkspaceTab() {
    return tabs.value.find((tab) => announcementsTabOwnsRoute(tab.path, tab)
      || isAnnouncementsRoute(tab.path)
      || tab.titleKey === 'navigation.announcements') || null;
  }

  function syncAnnouncementsRouteTab(path) {
    const pathOnly = normalizeAnnouncementsPath(path);
    if (!isAnnouncementsRoute(pathOnly)) return false;

    const workspaceTab = resolveAnnouncementsWorkspaceTab();
    if (!workspaceTab) return false;

    workspaceTab.path = ANNOUNCEMENTS_MAIN_TAB_PATH;
    workspaceTab.titleKey = 'navigation.announcements';
    workspaceTab.title = i18n.global.t('navigation.announcements');
    workspaceTab.icon = getIconComponent(getIconForPath(ANNOUNCEMENTS_MAIN_TAB_PATH));
    if (activeTabId.value !== workspaceTab.id) {
      activeTabId.value = workspaceTab.id;
    }
    if (storageConfigured && storageKey) {
      saveTabsToStorage();
    }
    return true;
  }

  function navigateAnnouncementsWorkspace(path, options = {}) {
    const routerPath = normalizeAnnouncementsPath(path);
    if (!isAnnouncementsRoute(routerPath)) return null;

    const navOptions = {
      ...options,
      titleKey: 'navigation.announcements',
    };

    const workspaceTab = resolveAnnouncementsWorkspaceTab();
    if (workspaceTab) {
      workspaceTab.path = ANNOUNCEMENTS_MAIN_TAB_PATH;
      workspaceTab.titleKey = 'navigation.announcements';
      workspaceTab.title = i18n.global.t('navigation.announcements');
      workspaceTab.icon = getIconComponent(getIconForPath(ANNOUNCEMENTS_MAIN_TAB_PATH));
      activeTabId.value = workspaceTab.id;
      isProgrammaticNavigation = true;
      lastProgrammaticPath = routerPath;
      navigateToPath(routerPath).finally(() => {
        setTimeout(() => {
          isProgrammaticNavigation = false;
          lastProgrammaticPath = null;
        }, 300);
      });
      if (storageConfigured && storageKey) {
        saveTabsToStorage();
      }
      return workspaceTab;
    }

    const created = openTab(ANNOUNCEMENTS_MAIN_TAB_PATH, { ...navOptions, insertAdjacent: false });
    if (created && routerPath !== ANNOUNCEMENTS_MAIN_TAB_PATH) {
      isProgrammaticNavigation = true;
      lastProgrammaticPath = routerPath;
      navigateToPath(routerPath).finally(() => {
        setTimeout(() => {
          isProgrammaticNavigation = false;
          lastProgrammaticPath = null;
        }, 300);
      });
    }
    return created;
  }

  // Find tab by path (exact match or path without query params)
  const findTabByPath = (path) => {
    const pathWithoutQuery = String(path || '').split('?')[0].split('#')[0];
    if (isLiveChatRoute(pathWithoutQuery)) {
      const workspaceTab = resolveLiveChatWorkspaceTab();
      if (workspaceTab) return workspaceTab;
    }
    if (isAnnouncementsRoute(pathWithoutQuery)) {
      const workspaceTab = resolveAnnouncementsWorkspaceTab();
      if (workspaceTab) return workspaceTab;
    }

    // First try exact match
    const exactMatch = tabs.value.find(tab => tab.path === path);
    if (exactMatch) return exactMatch;
    
    // If path has query params, try matching without them
    return tabs.value.find(tab => {
      const tabPathWithoutQuery = tab.path.split('?')[0];
      return tabPathWithoutQuery === pathWithoutQuery;
    });
  };

  // Sync active tab with current route (for browser navigation ONLY)
  const syncTabWithRoute = (path) => {
    logTabsDebug('🔄 syncTabWithRoute called with path:', path);

    if (isPortalOnlySession() && String(path || '').startsWith('/portal/')) {
      purgePlatformHomeTabsForPortalSession();
    }
    
    // Skip on mobile
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
      return;
    }
    
    // Skip public/auth/landing routes (Settings uses internal tabs)
    if (shouldSkipTabRoute(path)) {
      logTabsDebug('⏭️ Skipping sync for path:', path);
      return;
    }
    
    // Double-check programmatic navigation flag (safety check)
    if (isProgrammaticNavigation) {
      logTabsDebug('🔒 syncTabWithRoute: Programmatic navigation detected, skipping');
      return;
    }

    const pathWithoutQuery = String(path || '').split('?')[0].split('#')[0];
    if (syncLiveChatRouteTab(pathWithoutQuery)) {
      logTabsDebug('✅ syncTabWithRoute: Live Chat tab updated in place');
      return;
    }

    if (syncAnnouncementsRouteTab(pathWithoutQuery)) {
      logTabsDebug('✅ syncTabWithRoute: Announcements tab updated in place');
      return;
    }
    
    // Find existing tab for this path (with or without query params)
    const existingTab = findTabByPath(path);
    const isCreateRoute = /\/new\/?$/.test(pathWithoutQuery);
    const parentListPath = isCreateRoute ? pathWithoutQuery.replace(/\/new\/?$/, '') : null;

    // Create routes should reuse their parent list tab (drawer opens in same tab).
    if (!existingTab && parentListPath && parentListPath !== '/settings/automation/processes') {
      const parentTab = findTabByPath(parentListPath);
      if (parentTab) {
        if (activeTabId.value !== parentTab.id) {
          activeTabId.value = parentTab.id;
        }
        restoreModuleListTabTitle(parentTab, parentListPath);
        return;
      }
    }
    
    if (existingTab) {
      // Tab exists, switch to it ONLY if we're not already on it
      if (activeTabId.value !== existingTab.id) {
        logTabsDebug('🔄 Syncing tab for browser navigation:', existingTab.title, 'from', activeTabId.value, 'to', existingTab.id);
        activeTabId.value = existingTab.id;
      } else {
        logTabsDebug('✅ Already on correct tab, no sync needed');
      }

      // Keep full path (query/hash) so Settings sub-pages survive tab switches / reloads.
      const existingPathBase = String(existingTab.path || '').split('?')[0].split('#')[0];
      if (
        pathWithoutQuery === existingPathBase
        && path
        && existingTab.path !== path
        && !liveChatMainTabOwnsRoute(pathWithoutQuery, existingTab)
        && !announcementsTabOwnsRoute(pathWithoutQuery, existingTab)
        && !learningTabOwnsRoute(pathWithoutQuery, existingTab)
      ) {
        existingTab.path = path;
      }

      if (!shouldPreserveRecordTabTitle(existingTab, path)) {
        restoreModuleListTabTitle(existingTab, path.split('?')[0]);
      }
    } else {
      // Tab doesn't exist, create one
      logTabsDebug('✨ Creating tab for browser navigation:', path);
      const isHome = path === '/platform/home';
      const isPortalHome =
        isPortalOnlySession()
        && (path === PORTAL_HOME_TAB_PATH || path.startsWith(`${PORTAL_HOME_TAB_PATH}/`));

      if (isPortalHome) {
        purgePlatformHomeTabsForPortalSession();
        const existingPortalHome = tabs.value.find(isPortalHomeTab);
        if (existingPortalHome) {
          existingPortalHome.id = PORTAL_HOME_TAB_ID;
          existingPortalHome.path = path;
          existingPortalHome.title = getTitleForPath(path);
          existingPortalHome.titleKey = undefined;
          existingPortalHome.icon = getIconComponent(getIconForPath(path));
          existingPortalHome.closable = false;
          activeTabId.value = existingPortalHome.id;
          return;
        }
      }

      if (isLiveChatSessionsRoute(pathWithoutQuery)) {
        navigateLiveChatSessions(pathWithoutQuery);
        return;
      }
      if (isLiveChatClosedSessionsRoute(pathWithoutQuery)) {
        navigateLiveChatClosedSessions(pathWithoutQuery);
        return;
      }
      if (isLiveChatVisitorsRoute(pathWithoutQuery)) {
        navigateLiveChatClosedSessions(LIVE_CHAT_CLOSED_TAB_PATH);
        return;
      }
      if (isLiveChatReportsRoute(pathWithoutQuery)) {
        navigateLiveChatReports();
        return;
      }
      
      // CRITICAL: Check if home tab already exists before creating a new one
      // This prevents duplicate home tabs when syncTabWithRoute is called
      if (isHome) {
        const existingHomeTab = tabs.value.find(tab => tab.id === 'home' || tab.path === '/platform/home');
        if (existingHomeTab) {
          console.log('🔄 [syncTabWithRoute] Home tab already exists, switching to it instead of creating duplicate');
          activeTabId.value = existingHomeTab.id;
          // Update path if it differs (e.g., query params)
          if (existingHomeTab.path !== path) {
            existingHomeTab.path = path;
          }
          return;
        }
      }
      
      const newTab = {
        id: isHome ? 'home' : (isPortalHome ? PORTAL_HOME_TAB_ID : generateTabId()),
        title: getTitleForPath(path),
        path: path,
        icon: getIconComponent(getIconForPath(path)),
        closable: !(isHome || isPortalHome),
        params: {}
      };
      tabs.value.push(newTab);
      activeTabId.value = newTab.id;
    }
  };

  // Initialize tabs (can be called from router guard - no route access)
  const initTabs = () => {
    // Don't initialize tabs on mobile
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
      console.log('📱 Mobile detected, skipping tab initialization');
      return;
    }
    if (!storageConfigured || !storageKey) {
      console.error('[Tabs] initTabs called before storage was configured. Tabs will not initialize.');
      return;
    }
    
    console.log('🔄 [initTabs] Starting tab initialization...');
    loadTabsFromStorage();
    purgePlatformHomeTabsForPortalSession();
    
    // Don't create home tab here - let setupRouteWatcher decide based on current route
    // This prevents creating unnecessary home tabs when on dashboard routes
    // setupRouteWatcher will create the appropriate tab (home or dashboard) based on the route
    if (tabs.value.length === 0) {
      console.log('🔄 [initTabs] No tabs found after load, setupRouteWatcher will create appropriate tab based on route');
    } else {
      // Check if home tab exists, but don't force-create it if we have other tabs
      // setupRouteWatcher will handle creating it if needed when navigating to platform home
      const homeTab = tabs.value.find(tab => tab.id === 'home' || tab.path === '/platform/home');
      if (homeTab) {
        // Ensure home tab is properly configured
        if (homeTab.path !== '/platform/home' || homeTab.id !== 'home') {
          console.log('🔄 [initTabs] Migrating existing tab to home tab');
          homeTab.id = 'home';
          homeTab.path = '/platform/home';
          homeTab.title = 'Home';
          homeTab.icon = getIconComponent('home');
          homeTab.closable = false;
          // Force reactive update
          tabs.value = [...tabs.value];
          // Save immediately
          if (storageConfigured && storageKey) {
            saveTabsToStorage();
          }
        }
        // Only set home as active if no tab is currently active
        if (!activeTabId.value) {
          activeTabId.value = 'home';
        }
        console.log('✅ [initTabs] Home tab exists and configured, tabs count:', tabs.value.length);
      } else {
        // Home tab doesn't exist, but we have other tabs
        // Don't force-create it here - setupRouteWatcher will create it only if needed
        console.log('✅ [initTabs] Tabs exist but no home tab - will be created by setupRouteWatcher if needed');
      }
    }
    
    // Mark as initialized
    tabsInitialized = true;

    if (typeof window !== 'undefined' && !window.__arivuTabsBeforeUnloadHook) {
      window.__arivuTabsBeforeUnloadHook = true;
      window.addEventListener('beforeunload', () => saveTabsToStorage());
      window.addEventListener('pagehide', () => saveTabsToStorage());
    }

    // Log final state for debugging
    console.log('✅ [initTabs] Tab initialization complete:', {
      tabsCount: tabs.value.length,
      tabs: tabs.value.map(t => ({ id: t.id, title: t.title, path: t.path })),
      activeTabId: activeTabId.value,
      tabsInitialized: true
    });
    
    // Note: Route syncing is handled by setupRouteWatcher() in App.vue
  };

  // Setup route watcher (route parameter is optional - we'll use internal route if available)
  const setupRouteWatcher = (routeParam) => {
    // Use the route from useRoute() if available, otherwise use the parameter
    // The internal route from useRoute() is guaranteed to be reactive
    const routeToWatch = route || routeParam;
    
    if (!routeToWatch) {
      console.warn('⚠️ setupRouteWatcher: No route available');
      return;
    }
    
    console.log('🔧 setupRouteWatcher called');
    console.log('🔧 Using route:', routeToWatch.path, routeToWatch.fullPath);
    console.log('🔧 Route is reactive?', route !== null);
    
    // Settings now uses internal tabs
    if (
      routeToWatch.path.startsWith('/webforms/staff-preview/')
      || routeToWatch.path.startsWith('/webforms/public/')
      || routeToWatch.path.startsWith('/webforms/embed/')
    ) {
      console.log('⏭️ Standalone shell-less route detected, skipping tab watcher setup');
      return;
    }
    
    console.log('✅ Setting up route watcher for path:', routeToWatch.path);
    
    // Don't force-create home tab here - only create it when actually needed
    // (when navigating to platform home or when tabs are empty)
    
    // Sync active tab with current route on initialization
    const currentPath = getInitialRoutePath(routeToWatch);
    
    // Track if we restored a tab from storage
    let tabWasRestored = false;

    // Deep-link routes: always sync tab to current URL (even when activeTabId is missing).
    if (!shouldSkipTabRoute(currentPath) && currentPath.startsWith('/portal/')) {
      console.log('🔄 [setupRouteWatcher] Deep-link portal route on load, syncing tab:', currentPath);
      purgePlatformHomeTabsForPortalSession();
      if (currentPath === PORTAL_HOME_TAB_PATH || currentPath.startsWith(`${PORTAL_HOME_TAB_PATH}/`)) {
        createPortalDefaultTab();
      } else {
        syncTabWithRoute(currentPath);
      }
      tabWasRestored = true;
    } else if (!shouldSkipTabRoute(currentPath) && currentPath.startsWith('/settings')) {
      // Preserve ?tab= / nested query so Settings sub-pages restore after reload.
      const settingsFullPath = typeof window !== 'undefined'
        ? `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`
        : (routeToWatch?.fullPath || currentPath);
      console.log('🔄 [setupRouteWatcher] Deep-link settings route on load, syncing tab:', settingsFullPath);
      syncTabWithRoute(settingsFullPath);
      tabWasRestored = true;
    } else if (!shouldSkipTabRoute(currentPath) && currentPath.startsWith('/live-chat/')) {
      console.log('🔄 [setupRouteWatcher] Deep-link Live Chat route on load, syncing tab:', currentPath);
      if (!syncLiveChatRouteTab(currentPath)) {
        syncTabWithRoute(currentPath);
      }
      void ensureRouterAtPath(currentPath);
      tabWasRestored = true;
    } else if (!shouldSkipTabRoute(currentPath) && isAnnouncementsRoute(currentPath)) {
      console.log('🔄 [setupRouteWatcher] Deep-link Announcements route on load, syncing tab:', currentPath);
      if (!syncAnnouncementsRouteTab(currentPath)) {
        syncTabWithRoute(currentPath);
      }
      void ensureRouterAtPath(currentPath);
      tabWasRestored = true;
    } else if (!shouldSkipTabRoute(currentPath) && isLearningRoute(currentPath)) {
      // Prefer URL over last-active tab so /learning/* deep links do not bounce.
      console.log('🔄 [setupRouteWatcher] Deep-link Learning route on load, syncing tab:', currentPath);
      syncTabWithRoute(currentPath);
      void ensureRouterAtPath(currentPath);
      tabWasRestored = true;
    } else if (!shouldSkipTabRoute(currentPath) && isRecordDetailTabPath(currentPath)) {
      // Prefer URL over last-active tab so record deep links (e.g. from Chat) do not bounce back.
      console.log('🔄 [setupRouteWatcher] Deep-link record route on load, syncing tab:', currentPath);
      syncTabWithRoute(currentPath);
      void ensureRouterAtPath(currentPath);
      tabWasRestored = true;
    } else if (activeTabId.value && !shouldSkipTabRoute(currentPath)) {
      const activeTab = tabs.value.find(tab => tab.id === activeTabId.value);
      if (activeTab) {
          console.log('🔄 [setupRouteWatcher] Restoring active tab from storage:', activeTab.id, activeTab.path);
          tabWasRestored = true;
          
          // Never override Live Chat / Learning / record deep links with a stale stored tab path.
          const browserPath = getInitialRoutePath(routeToWatch);
          if (browserPath.startsWith('/live-chat/')) {
            if (!syncLiveChatRouteTab(browserPath)) {
              syncTabWithRoute(browserPath);
            }
            void ensureRouterAtPath(browserPath);
          } else if (isLearningRoute(browserPath)) {
            syncTabWithRoute(browserPath);
            void ensureRouterAtPath(browserPath);
          } else if (isRecordDetailTabPath(browserPath)) {
            syncTabWithRoute(browserPath);
            void ensureRouterAtPath(browserPath);
          } else if (currentPath !== activeTab.path) {
            const currentRouter = getRouter();
            if (currentRouter) {
              isProgrammaticNavigation = true;
              lastProgrammaticPath = activeTab.path;
              currentRouter.replace(activeTab.path).then(() => {
                setTimeout(() => {
                  isProgrammaticNavigation = false;
                  lastProgrammaticPath = null;
                }, 100);
              }).catch(() => {
                setTimeout(() => {
                  isProgrammaticNavigation = false;
                  lastProgrammaticPath = null;
                }, 100);
              });
            }
          }
      } else {
        // Active tab ID exists but tab not found - clear it
        console.warn('⚠️ [setupRouteWatcher] Active tab ID not found in tabs, clearing:', activeTabId.value);
        activeTabId.value = null;
      }
    }
    
    // Only auto-navigate to platform home from root.
    // Keep deep-link routes (for example /tasks/:id) on refresh so record pages don't get replaced.
    // Skip this if we restored a tab from storage.
    if (!tabWasRestored && currentPath === '/') {
      console.log('🔄 [setupRouteWatcher] Navigating to platform home from', currentPath);
      // Navigate to platform home to show it by default (without page refresh)
      const currentRouter = getRouter();
      if (currentRouter) {
        // Ensure home tab exists BEFORE navigation (so it's visible immediately)
        const homeTab = tabs.value.find(tab => tab.id === 'home' || tab.path === '/platform/home');
        if (!homeTab) {
          console.log('🔄 [setupRouteWatcher] Creating home tab before navigation');
          createDefaultTab();
        } else {
          // Only set active if no tab is currently active
          if (!activeTabId.value) {
            activeTabId.value = 'home';
          }
        }
        
        isProgrammaticNavigation = true;
        currentRouter.replace('/platform/home').then(() => {
          // Double-check home tab exists after navigation
          if (!tabs.value.find(tab => tab.id === 'home')) {
            console.log('🔄 [setupRouteWatcher] Home tab missing after navigation, creating it');
            createDefaultTab();
          }
          // Only set active if no tab is currently active
          if (!activeTabId.value) {
            activeTabId.value = 'home';
          }
          setTimeout(() => {
            isProgrammaticNavigation = false;
          }, 100);
        }).catch(() => {
          setTimeout(() => {
            isProgrammaticNavigation = false;
          }, 100);
        });
      }
    } else if (currentPath === '/platform/home') {
      // Already on platform home, ensure home tab exists
      const homeTab = tabs.value.find(tab => tab.id === 'home' || tab.path === '/platform/home');
      if (!homeTab) {
        console.log('🔄 [setupRouteWatcher] On platform home but no home tab, creating it');
        createDefaultTab();
        // Only set active if no other tab is active or if we just created it
        if (!activeTabId.value) {
          activeTabId.value = 'home';
        }
      } else {
        // Only set active to home if no tab is currently active
        // Don't force it if user has another tab open
        if (!activeTabId.value) {
          activeTabId.value = 'home';
        }
      }
    } else if (shouldSkipTabRoute(currentPath)) {
      logTabsDebug('⏭️ [setupRouteWatcher] Non-tab route, keeping URL:', currentPath);
    } else if (!tabWasRestored) {
      // On a different route (e.g., dashboard route)
      // If tabs are empty, create a tab for the current route
      if (tabs.value.length === 0) {
        console.log('🔄 [setupRouteWatcher] Tabs are empty, creating tab for current route:', routeToWatch.path);
        const wasProgrammatic = isProgrammaticNavigation;
        isProgrammaticNavigation = false;
        syncTabWithRoute(routeToWatch.path);
        isProgrammaticNavigation = wasProgrammatic;
      } else {
        // Tabs exist - check if active tab matches current route
        const activeTab = tabs.value.find(tab => tab.id === activeTabId.value);
        if (syncLiveChatRouteTab(getInitialRoutePath(routeToWatch))) {
          console.log('✅ Initial sync: Live Chat tab matched route');
        } else if (
          activeTab
          && activeTab.path !== getInitialRoutePath(routeToWatch)
          && !liveChatMainTabOwnsRoute(getInitialRoutePath(routeToWatch), activeTab)
        ) {
          console.log('🔄 Initial sync: active tab path', activeTab.path, 'does not match route', routeToWatch.path);
          // Check if a tab exists for the current route
          const routeTab = findTabByPath(routeToWatch.path);
          if (routeTab) {
            // Switch to existing tab for this route
            activeTabId.value = routeTab.id;
          } else {
            // Create a new tab for the current route
            const wasProgrammatic = isProgrammaticNavigation;
            isProgrammaticNavigation = false;
            syncTabWithRoute(routeToWatch.path);
            isProgrammaticNavigation = wasProgrammatic;
          }
        } else if (!activeTab) {
          console.log('🔄 Initial sync: no active tab found, syncing to route', routeToWatch.path);
          const wasProgrammatic = isProgrammaticNavigation;
          isProgrammaticNavigation = false;
          syncTabWithRoute(routeToWatch.path);
          isProgrammaticNavigation = wasProgrammatic;
        } else {
          console.log('✅ Initial sync: active tab matches route, no sync needed');
        }
      }
    }
    
    // Watch for route changes (browser navigation)
    // Prefer useRoute() (component injection); after await (e.g. post-login) there is no instance — use router.currentRoute
    const getWatchedRoute = () => {
      if (route != null) {
        return route;
      }
      const r = getRouter();
      return r ? r.currentRoute.value : null;
    };

    if (!getWatchedRoute()) {
      console.error('❌ Cannot set up route watcher: no current route and no router');
      return;
    }

    const firstRoute = getWatchedRoute();
    console.log('👀 Setting up route watcher, current route:', firstRoute.path, firstRoute.fullPath);
    console.log('👀 Route from useRoute()?', route != null, firstRoute);
    
    // Watch BOTH path and fullPath to catch all changes including redirects
    const stopWatcher = watch(
      () => {
        const wr = getWatchedRoute();
        if (wr) {
          return [wr.path, wr.fullPath];
        }
        const r = getRouter();
        if (!r) {
          return ['', ''];
        }
        const v = r.currentRoute.value;
        return [v.path, v.fullPath];
      },
      ([newPathValue, newFullPathValue], [oldPathValue, oldFullPathValue]) => {
        const currentRoute = getWatchedRoute();
        if (!currentRoute) {
          return;
        }
        const newPath = currentRoute.path; // Path without query
        const oldPath = oldPathValue ? oldPathValue.split('?')[0] : '';
        const newFullPath = currentRoute.fullPath;
        const oldFullPath = oldFullPathValue || '';
        const isCreateRoute = /\/new\/?$/.test(newPath);
        const parentListPath = isCreateRoute ? newPath.replace(/\/new\/?$/, '') : null;
        
        // Log EVERY route change to debug
        console.log('👀👀👀 Route watcher FIRED:', {
          oldPath,
          newPath,
          newFullPath,
          oldFullPath,
          isProgrammaticNavigation,
          isBrowserNavigation,
          activeTabId: activeTabId.value,
          routePath: currentRoute.path,
          routeFullPath: currentRoute.fullPath
        });
        
        // Same path, different query/hash (e.g. /settings?tab=a → /settings?tab=b):
        // still update the active tab path so last-opened Settings sub-page is preserved.
        if (newPath === oldPath) {
          if (newFullPath !== oldFullPath) {
            const currentActiveTab = tabs.value.find(tab => tab.id === activeTabId.value);
            if (
              currentActiveTab
              && String(currentActiveTab.path || '').split('?')[0].split('#')[0] === newPath
              && !liveChatMainTabOwnsRoute(newPath, currentActiveTab)
              && !announcementsTabOwnsRoute(newPath, currentActiveTab)
              && !learningTabOwnsRoute(newPath, currentActiveTab)
            ) {
              currentActiveTab.path = newFullPath || newPath;
              console.log('🔄 Updated active tab path for same-path query/hash change:', currentActiveTab.path);
            }
          } else {
            console.log('⏭️ Route watcher: paths are the same, skipping');
          }
          return;
        }
      
      // If this is browser navigation (popstate), handle it even if isProgrammaticNavigation is true
      // The popstate handler sets isBrowserNavigation, so check that first
      if (isBrowserNavigation) {
        console.log('🌐 Route watcher: Browser navigation detected via isBrowserNavigation flag');
        // Don't skip - continue to handle browser navigation below
      }
      
      // Ensure home tab exists when navigating to platform home
      if (newPath === '/platform/home') {
        console.log('🏠 Route watcher: Navigating to platform home');
        const homeTab = tabs.value.find(tab => tab.id === 'home' || tab.path === '/platform/home');
        if (!homeTab) {
          console.log('🔄 [Route watcher] On platform home but no home tab, creating it');
          createDefaultTab();
        } else {
          // Ensure home tab is active
          if (activeTabId.value !== 'home') {
            console.log('🔄 [Route watcher] Switching to home tab');
            activeTabId.value = 'home';
            console.log('✅ [Route watcher] Home tab is now active');
          } else {
            console.log('🔒 [Route watcher] Home tab already active');
          }
        }
        return; // Don't continue processing
      }
      
      // Skip public/auth/landing routes (Settings uses internal tabs)
      if (shouldSkipTabRoute(newPath)) {
        console.log('⏭️ Route watcher: skipping tab sync for non-tab route:', newPath);
        return;
      }
      
      console.log('🔍 Route watcher triggered:', {
        oldPath,
        newPath,
        newFullPath,
        isProgrammaticNavigation,
        activeTabId: activeTabId.value,
        lastProgrammaticPath
      });
      
      // Check if this route change matches a programmatic navigation we just did
      // BUT skip this check if it's browser navigation (popstate handler set the flag)
      if (isProgrammaticNavigation && !isBrowserNavigation) {
        console.log('🔒 Programmatic navigation flag is set (not browser nav), skipping route sync');
        return;
      }
      
      // If it's browser navigation, override the programmatic flag
      if (isBrowserNavigation) {
        console.log('🌐 Route watcher: Browser navigation detected, overriding programmatic flag');
        // Don't skip - continue to handle browser navigation
      }
      
      // Check if this matches the last programmatic path (with or without query)
      // BUT skip this check if it's browser navigation
      if (lastProgrammaticPath && !isBrowserNavigation) {
        const lastPathWithoutQuery = lastProgrammaticPath.split('?')[0];
        const newPathWithoutQuery = newPath.split('?')[0];
        if (lastPathWithoutQuery === newPathWithoutQuery || newFullPath === lastProgrammaticPath) {
          console.log('🔒 Programmatic navigation path matches, skipping route sync');
          lastProgrammaticPath = null; // Reset after use
          return;
        }
      }

      // Keep create routes in their parent list tab so drawer flows stay in-tab.
      if (parentListPath && parentListPath !== '/settings/automation/processes') {
        const parentTab = findTabByPath(parentListPath);
        if (parentTab) {
          if (activeTabId.value !== parentTab.id) {
            activeTabId.value = parentTab.id;
          }
          restoreModuleListTabTitle(parentTab, parentListPath);
          return;
        }
      }

      if (syncLiveChatRouteTab(newPath)) {
        console.log('✅ Route watcher: Live Chat tab synced in place');
        return;
      }

      if (syncAnnouncementsRouteTab(newPath)) {
        console.log('✅ Route watcher: Announcements tab synced in place');
        return;
      }

      const currentActiveTab = tabs.value.find(tab => tab.id === activeTabId.value);
      if (currentActiveTab) {
        const activePathBase = currentActiveTab.path.split('?')[0];
        if (isProcessDesignerTabPath(newPath) && activePathBase === '/settings/automation/processes') {
          currentActiveTab.path = newFullPath || newPath;
        } else if (
          newPath === '/settings/automation/processes' &&
          (isProcessDesignerTabPath(activePathBase) || currentActiveTab.recordTitle)
        ) {
          currentActiveTab.path = newPath;
          restoreModuleListTabTitle(currentActiveTab, newPath);
        } else if (
          isTemplatesModuleListPath(newPath)
          && isTemplatesModuleFamilyPath(activePathBase)
        ) {
          // Templates / Themes / Assets / Merge mappings stay in one tab.
          currentActiveTab.path = newFullPath || newPath;
          restoreModuleListTabTitle(currentActiveTab, newPath.split('?')[0]);
          return;
        } else if (
          isAnnouncementsRoute(newPath)
          && isAnnouncementsRoute(activePathBase)
        ) {
          currentActiveTab.path = ANNOUNCEMENTS_MAIN_TAB_PATH;
          currentActiveTab.titleKey = 'navigation.announcements';
          currentActiveTab.title = i18n.global.t('navigation.announcements');
          return;
        }
      }
      
      // Check if active tab already matches this route (with or without query params)
      if (currentActiveTab) {
        const currentPathWithoutQuery = currentActiveTab.path.split('?')[0];
        const newPathWithoutQuery = newPath.split('?')[0];
        if (
          currentPathWithoutQuery === newPathWithoutQuery
          || liveChatMainTabOwnsRoute(newPathWithoutQuery, currentActiveTab)
          || announcementsTabOwnsRoute(newPathWithoutQuery, currentActiveTab)
          || learningTabOwnsRoute(newPathWithoutQuery, currentActiveTab)
        ) {
          // Persist query/hash changes on the same path base (e.g. /settings?tab=…, nested views).
          // Without this, switching workspace/browser tabs reopens Settings Home (/settings).
          if (
            currentPathWithoutQuery === newPathWithoutQuery
            && !liveChatMainTabOwnsRoute(newPathWithoutQuery, currentActiveTab)
            && !announcementsTabOwnsRoute(newPathWithoutQuery, currentActiveTab)
            && !learningTabOwnsRoute(newPathWithoutQuery, currentActiveTab)
          ) {
            const nextFull = newFullPath || newPath;
            if (nextFull && currentActiveTab.path !== nextFull) {
              currentActiveTab.path = nextFull;
              console.log('🔄 Updated active tab path for query/hash change:', nextFull);
            }
          }
          // Module list tab should always show the module name
          const isListRoute = newPathWithoutQuery === '/tasks' || newPathWithoutQuery === '/deals' || newPathWithoutQuery === '/events' ||
            newPathWithoutQuery === '/people' || newPathWithoutQuery === '/organizations' || newPathWithoutQuery === '/forms' ||
            newPathWithoutQuery === '/responses' || newPathWithoutQuery === '/audit/responses' ||
            newPathWithoutQuery === '/items' || newPathWithoutQuery === '/imports' || newPathWithoutQuery === '/documents' || newPathWithoutQuery === '/trash' ||
            newPathWithoutQuery === '/helpdesk/cases' ||
            newPathWithoutQuery === '/platform/home' || newPathWithoutQuery === '/sales/dashboard' || newPathWithoutQuery.startsWith('/control/') ||
            (newPathWithoutQuery.startsWith('/settings/automation/') && !isProcessDesignerTabPath(newPathWithoutQuery));
          if (isListRoute) {
            restoreModuleListTabTitle(currentActiveTab, newPathWithoutQuery);
          }
          console.log('✅ Active tab already matches route, skipping sync');
          return;
        }
      }
      
      // Check if a tab already exists for this route (to prevent duplicates)
      // Check both with and without query params
      const existingTabForRoute = findTabByPath(newFullPath) || findTabByPath(newPath);
      if (existingTabForRoute) {
        // Check if popstate handler already switched to this tab
        // Only skip if the active tab already matches (popstate handled it)
        if (isBrowserNavigation && activeTabId.value === existingTabForRoute.id) {
          console.log('🔒 Browser navigation already handled by popstate, tab already switched');
          // Reset flag after checking
          setTimeout(() => {
            isBrowserNavigation = false;
          }, 50);
          return;
        }
        
        console.log('🌐 Route watcher: Tab exists for route, switching to it:', existingTabForRoute.id, existingTabForRoute.title);
        console.log('🌐 Current activeTabId:', activeTabId.value);
        console.log('🌐 Target tab ID:', existingTabForRoute.id);
        console.log('🌐 isBrowserNavigation:', isBrowserNavigation);
        
        // CRITICAL: Switch to tab synchronously BEFORE components process route change
        // This ensures activeTabId is set before any component watchers fire
        // FORCE the switch even if localStorage might have a different value
        if (activeTabId.value !== existingTabForRoute.id) {
          // Set activeTabId synchronously without navigation (route already changed via browser back)
          // This will trigger the watcher to save to localStorage, which is fine
          activeTabId.value = existingTabForRoute.id;
          console.log('✅ Route watcher switched to tab:', existingTabForRoute.id);
          console.log('✅ New activeTabId value:', activeTabId.value);
          
          // Force save to localStorage immediately to prevent any race conditions
          saveTabsToStorage();
        } else {
          console.log('🔒 Tab already active, no switch needed');
        }
        
        // Reset browser navigation flag since we handled it
        if (isBrowserNavigation) {
          setTimeout(() => {
            isBrowserNavigation = false;
          }, 50);
        }

        if (liveChatMainTabOwnsRoute(newPath, existingTabForRoute)) {
          syncLiveChatMainTabPath(newPath);
          return;
        }
        
        // Update tab path if it differs (e.g., query params changed)
        if (existingTabForRoute.path !== newPath && existingTabForRoute.path !== newFullPath) {
          const pathWithoutQuery = existingTabForRoute.path.split('?')[0];
          const newPathWithoutQuery = newPath.split('?')[0];
          if (pathWithoutQuery === newPathWithoutQuery) {
            existingTabForRoute.path = newFullPath;
            console.log('🔄 Updated tab path to match route:', newFullPath);
          }
        }
        // Restore title for list/module routes when switching to this tab (e.g. back to /tasks so tab shows "Tasks" not record name)
        const newPathBase = newPath.split('?')[0];
        const isListRoute = newPathBase === '/tasks' || newPathBase === '/deals' || newPathBase === '/events' ||
          newPathBase === '/people' || newPathBase === '/organizations' || newPathBase === '/forms' ||
          newPathBase === '/responses' || newPathBase === '/audit/responses' ||
          newPathBase === '/items' || newPathBase === '/imports' || newPathBase === '/documents' || newPathBase === '/trash' ||
          newPathBase === '/helpdesk/cases' ||
          newPathBase === '/platform/home' || newPathBase === '/sales/dashboard' || newPathBase.startsWith('/control/') ||
          (newPathBase.startsWith('/settings/automation/') && !isProcessDesignerTabPath(newPathBase));
        if (isListRoute) {
          restoreModuleListTabTitle(existingTabForRoute, newPathBase);
        }
        return;
      }
      
      // This must be browser navigation (back/forward button)
      console.log('🌐 Browser navigation detected - syncing tabs:', oldPath, '→', newPath);
      syncTabWithRoute(newPath);
    }, { flush: 'sync' }); // Use sync flush to ensure tab switch happens before components process route change
    
    // Intercept browser back/forward navigation BEFORE Vue Router processes it
    // This ensures tab switching happens before components mount
    const handlePopState = (event) => {
      // Get the target path from the location
      const targetPath = window.location.pathname + window.location.search;
      const targetPathWithoutQuery = window.location.pathname;
      
      console.log('🔙 Popstate event fired:', {
        targetPath,
        targetPathWithoutQuery,
        isProgrammaticNavigation,
        lastProgrammaticPath,
        currentRoute: getWatchedRoute()?.path
      });
      
      // Skip if this matches a programmatic navigation
      if (isProgrammaticNavigation || lastProgrammaticPath === targetPath || lastProgrammaticPath === targetPathWithoutQuery) {
        console.log('🔙 Skipping - programmatic navigation');
        return;
      }
      
      // Skip non-tab routes (but log it)
      // Settings now uses internal tabs
      if (shouldSkipTabRoute(targetPathWithoutQuery)) {
        console.log('🔙 Skipping - non-tab route:', targetPathWithoutQuery);
        return;
      }
      
      console.log('🔙 Popstate detected, switching tab BEFORE route change:', targetPath);
      console.log('🔙 Current tabs:', tabs.value.map(t => ({ id: t.id, path: t.path, title: t.title })));
      console.log('🔙 Current activeTabId:', activeTabId.value);
      
      // Mark as browser navigation (use module-level variable)
      isBrowserNavigation = true;
      
      // Find tab for the target path
      const targetTab = findTabByPath(targetPath) || findTabByPath(targetPathWithoutQuery);
      console.log('🔙 Target tab found:', targetTab ? { id: targetTab.id, path: targetTab.path, title: targetTab.title } : 'NOT FOUND');
      
      if (targetTab) {
        // Switch to tab IMMEDIATELY before Vue Router processes the route change
        if (activeTabId.value !== targetTab.id) {
          console.log('🔙 Switching from tab:', activeTabId.value, 'to tab:', targetTab.id);
          activeTabId.value = targetTab.id;
          console.log('✅ Tab switched BEFORE route change:', targetTab.id, targetTab.title);
          console.log('✅ New activeTabId:', activeTabId.value);
        } else {
          console.log('🔙 Tab already active, no switch needed');
        }
        // Update tab path if needed
        if (targetTab.path !== targetPath && targetTab.path !== targetPathWithoutQuery) {
          const tabPathWithoutQuery = targetTab.path.split('?')[0];
          if (tabPathWithoutQuery === targetPathWithoutQuery) {
            targetTab.path = targetPath;
            console.log('🔄 Updated tab path to match route:', targetPath);
          }
        }
      } else {
        console.warn('⚠️ No tab found for path:', targetPath, '- route watcher will handle it');
      }
      
      // Reset flag after a short delay to allow route watcher to skip
      setTimeout(() => {
        isBrowserNavigation = false;
      }, 200);
    };
    
    // Add popstate listener with capture phase to run before Vue Router
    window.addEventListener('popstate', handlePopState, true);
    console.log('✅ Popstate listener registered with capture phase');
    
    // ALSO use router.afterEach as a fallback to catch route changes
    // This ensures we catch browser navigation even if the watcher doesn't fire
    // Wait a bit to ensure router is fully initialized
    let routerAfterEachUnregister = null;
    
    const routerDebug = () => import.meta.env.DEV;
    const registerRouterHook = () => {
      const currentRouter = getRouter();
      if (routerDebug()) {
        console.log('🔍 Router available for afterEach?', !!currentRouter);
        console.log('🔍 Router object:', currentRouter);
      }
      
      if (currentRouter && !routerAfterEachUnregister) {
        if (routerDebug()) console.log('🔍 Registering router.afterEach hook...');
        routerAfterEachUnregister = currentRouter.afterEach((to, from) => {
        if (routerDebug()) {
          console.log('🔄🔄🔄 Router afterEach FIRED:', {
            to: to.path,
            from: from.path,
            toFullPath: to.fullPath,
            fromFullPath: from.fullPath,
            isProgrammaticNavigation,
            activeTabId: activeTabId.value
          });
        }
        
        // Only handle if this is browser navigation (not programmatic)
        if (isProgrammaticNavigation) {
          if (routerDebug()) console.log('🔒 Router afterEach: Skipping - programmatic navigation');
          return;
        }
        
        const toPath = to.path;
        const fromPath = from.path;
        
        // Skip if paths are the same
        if (toPath === fromPath) {
          if (routerDebug()) console.log('⏭️ Router afterEach: Paths are the same, skipping');
          return;
        }
        
        if (routerDebug()) console.log('🔄 Router afterEach: Browser navigation detected:', fromPath, '→', toPath);
        
        // Find tab for the new route
        const targetTab = findTabByPath(to.fullPath) || findTabByPath(toPath);
        if (routerDebug()) console.log('🔄 Router afterEach: Target tab found?', !!targetTab, targetTab ? { id: targetTab.id, path: targetTab.path } : null);
        
        if (targetTab && activeTabId.value !== targetTab.id) {
          if (routerDebug()) console.log('🔄 Router afterEach: Switching to tab:', targetTab.id, 'from:', activeTabId.value);
          activeTabId.value = targetTab.id;
          saveTabsToStorage(); // Force save to override localStorage
          if (routerDebug()) console.log('✅ Router afterEach: Tab switched to:', targetTab.id, 'new activeTabId:', activeTabId.value);
        } else if (targetTab) {
          if (routerDebug()) console.log('🔒 Router afterEach: Tab already active');
        } else {
          if (routerDebug()) console.log('⚠️ Router afterEach: No tab found for route:', toPath);
        }
      });
        if (routerDebug()) console.log('✅ Router afterEach hook registered, unregister function:', typeof routerAfterEachUnregister === 'function');
      } else if (!currentRouter) {
        if (routerDebug()) console.warn('⚠️ Router not available yet, will retry...');
        // Retry after a short delay
        setTimeout(registerRouterHook, 100);
      }
    };
    
    // Try to register immediately
    registerRouterHook();
    
    // Also try after a delay in case router initializes later
    setTimeout(registerRouterHook, 500);
    
    console.log('✅ Route watcher setup complete. Watching route:', getWatchedRoute()?.path);
    console.log('✅ Watcher stop function created:', typeof stopWatcher === 'function');
    
    // Return cleanup function
    return () => {
      stopWatcher(); // Stop the route watcher
      if (routerAfterEachUnregister) {
        routerAfterEachUnregister(); // Unregister router hook
      }
      window.removeEventListener('popstate', handlePopState, true);
      console.log('🧹 Popstate listener and route watcher removed');
    };
  };

  // Get active tab
  const activeTab = computed(() => {
    return tabs.value.find(tab => tab.id === activeTabId.value);
  });

  // Create or focus tab
  const openTab = (path, options = {}) => {
    const isBackground = options.background || false;
    console.log('🔵 openTab called:', path, 'background:', isBackground);
    
    // On mobile (< md breakpoint), just navigate without creating tabs
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
      console.log('📱 Mobile detected, navigating without tab creation');
      isProgrammaticNavigation = true;
      navigateToPath(path).then(() => {
        setTimeout(() => {
          isProgrammaticNavigation = false;
        }, 50);
      });
      return null;
    }

    const pathOnly = String(path || '').split('?')[0].split('#')[0];
    const isHelpdeskCasesTab =
      pathOnly === '/helpdesk/cases' || pathOnly.startsWith('/helpdesk/cases/');

    if (!skipLiveChatOpenTabRouting) {
      if (isLiveChatSessionsRoute(pathOnly)) {
        return navigateLiveChatSessions(pathOnly, options);
      }
      if (isLiveChatClosedSessionsRoute(pathOnly)) {
        return navigateLiveChatClosedSessions(pathOnly, options);
      }
      if (isLiveChatVisitorsRoute(pathOnly)) {
        return navigateLiveChatClosedSessions(LIVE_CHAT_CLOSED_TAB_PATH, options);
      }
      if (isLiveChatReportsRoute(pathOnly)) {
        return navigateLiveChatReports(options);
      }
    }

    if (isAnnouncementsRoute(pathOnly) && pathOnly !== ANNOUNCEMENTS_MAIN_TAB_PATH) {
      return navigateAnnouncementsWorkspace(pathOnly, options);
    }
    
    // Check if tab already exists
    const existingTab = findTabByPath(path);
    
    if (existingTab) {
      console.log('📍 Tab already exists:', existingTab.id);

      if (options.title && isRecordDetailTabPath(path)) {
        applyRecordTabTitle(existingTab, options.title);
      } else {
        const newTitle = options.title || getTitleForPath(path, options.params);
        if (newTitle && existingTab.title !== newTitle && !shouldPreserveRecordTabTitle(existingTab, path)) {
          existingTab.title = newTitle;
        }
      }

      if (isHelpdeskCasesTab) {
        existingTab.icon = getIconComponent('cases');
      } else {
        existingTab.icon = getIconComponent(resolveTabIconForPath(pathOnly, options.icon));
      }
      
      // If not background mode, focus the tab
      if (!isBackground) {
        activeTabId.value = existingTab.id;
        // Mark as programmatic navigation to prevent route watcher from syncing
        isProgrammaticNavigation = true;
        lastProgrammaticPath = path;
        // Always navigate to ensure the route is loaded
        navigateToPath(path).then(() => {
          setTimeout(() => {
            isProgrammaticNavigation = false;
            lastProgrammaticPath = null;
          }, 300); // Increased timeout to prevent route watcher from creating duplicate tabs
        }).catch(() => {
          setTimeout(() => {
            isProgrammaticNavigation = false;
            lastProgrammaticPath = null;
          }, 300);
        });
      } else {
        console.log('🔕 Background mode: tab exists but not switching to it');
      }
      return existingTab;
    }
    
    const tabIconId = resolveTabIconForPath(pathOnly, options.icon);

    // Create new tab
    const titleMeta = options.titleKey
      ? { titleKey: options.titleKey, titleParams: options.titleParams || {} }
      : options.title
        ? { title: options.title }
        : getTabTitleMetaForPath(path, options.params || {});

    const newTab = {
      id: options.id || generateTabId(),
      ...titleMeta,
      title: options.title || (titleMeta.titleKey ? undefined : getTitleForPath(path, options.params)),
      path: path,
      icon: getIconComponent(tabIconId),
      closable: options.closable !== false, // Default to closable
      params: options.params || {}
    };

    if (options.title && isRecordDetailTabPath(pathOnly)) {
      applyRecordTabTitle(newTab, options.title);
    } else if (options.params?.name && isRecordDetailTabPath(pathOnly)) {
      applyRecordTabTitle(newTab, options.params.name);
    }

    console.log('✨ Creating new tab:', newTab.id, newTab.title);
    // Record opens: next to current tab. Section/sidebar: at end. Explicit option wins; else infer from path for new modules.
    const insertAdjacent = options.insertAdjacent === true
      || (options.insertAdjacent === undefined && looksLikeRecordPath(path));
    if (insertAdjacent) {
      const currentIndex = tabs.value.findIndex(tab => tab.id === activeTabId.value);
      if (currentIndex >= 0) {
        tabs.value.splice(currentIndex + 1, 0, newTab);
      } else {
        tabs.value.push(newTab);
      }
    } else {
      tabs.value.push(newTab);
    }
    
    // Only switch to tab and navigate if NOT background mode
    if (!isBackground) {
      activeTabId.value = newTab.id;
      // Mark as programmatic navigation BEFORE navigating to prevent route watcher from syncing
      isProgrammaticNavigation = true;
      lastProgrammaticPath = path;
      
      // Always navigate to show the new tab content
      navigateToPath(path).then(() => {
        setTimeout(() => {
          isProgrammaticNavigation = false;
          lastProgrammaticPath = null;
        }, 500); // Increased timeout to prevent route watcher from creating duplicate tabs
      }).catch(() => {
        setTimeout(() => {
          isProgrammaticNavigation = false;
          lastProgrammaticPath = null;
        }, 500);
      });
      console.log('✅ openTab complete (foreground), activeTabId:', activeTabId.value);
    } else {
      console.log('✅ openTab complete (background), tab created but not active');
    }
    
    return newTab;
  };

  // Close tab
  const closeTab = async (tabId) => {
    const index = tabs.value.findIndex(tab => tab.id === tabId);
    
    if (index === -1) return;
    
    const tab = tabs.value[index];
    
    // Don't close non-closable tabs
    if (!tab.closable) return;
    
    // Check for beforeClose callback (can be async)
    console.log('🔵 closeTab: Checking beforeClose for tab:', tab.id, 'has callback:', !!tab.beforeClose);
    if (tab.beforeClose && typeof tab.beforeClose === 'function') {
      console.log('🔵 closeTab: Calling beforeClose for tab:', tab.id);
      try {
        const shouldClose = await tab.beforeClose();
        console.log('🔵 closeTab: beforeClose returned:', shouldClose);
        if (shouldClose === false) {
          console.log('🔵 closeTab: beforeClose returned false, not closing');
          return; // Don't close if beforeClose returns false
        }
      } catch (error) {
        console.error('🔵 closeTab: Error in beforeClose:', error);
        // Continue with close even if beforeClose errors
      }
    } else {
      console.log('🔵 closeTab: No beforeClose callback for tab:', tab.id);
    }
    
    clearListSessionsForRoutePath(tab.path);
    markModuleListRecheckForRoutePath(tab.path);
    markRecordDetailRecheckForRoutePath(tab.path);

    clearTabDrawerDraftsForTab(tab.id);

    // Remove tab
    tabs.value.splice(index, 1);
    
    // If closing active tab, switch to another tab
    if (tabId === activeTabId.value) {
      if (tabs.value.length > 0) {
        // Switch to previous tab, or next tab, or first tab
        const newActiveTab = tabs.value[Math.max(0, index - 1)];
        activeTabId.value = newActiveTab.id;
        // Restore module title when switching back to a list tab (e.g. close record → list tab shows "Tasks" not record name)
        const pathBase = (newActiveTab.path || '').split('?')[0];
        const isListPath = pathBase === '/tasks' || pathBase === '/deals' || pathBase === '/events' ||
          pathBase === '/people' || pathBase === '/organizations' || pathBase === '/forms' ||
          pathBase === '/items' || pathBase === '/imports' || pathBase === '/documents' || pathBase === '/trash' ||
          pathBase === '/helpdesk/cases' ||
          pathBase === '/platform/home' || pathBase === '/sales/dashboard' || pathBase.startsWith('/control/') ||
          isAutomationModuleListRoute(pathBase);
        if (isListPath) {
          restoreModuleListTabTitle(newActiveTab, pathBase);
        }
        // Mark as programmatic navigation
        isProgrammaticNavigation = true;
        lastProgrammaticPath = newActiveTab.path;
        // Always navigate to the new tab
        navigateToPath(newActiveTab.path).then(() => {
          setTimeout(() => {
            isProgrammaticNavigation = false;
            lastProgrammaticPath = null;
          }, 100);
        }).catch(() => {
          setTimeout(() => {
            isProgrammaticNavigation = false;
            lastProgrammaticPath = null;
          }, 100);
        });
      }
    }
  };

  // Close all tabs except one
  const closeOtherTabs = (keepTabId) => {
    tabs.value
      .filter((tab) => tab.id !== keepTabId && tab.closable)
      .forEach((tab) => {
        clearListSessionsForRoutePath(tab.path);
        clearTabDrawerDraftsForTab(tab.id);
      });

    tabs.value = tabs.value.filter(tab => 
      tab.id === keepTabId || !tab.closable
    );
    
    if (activeTabId.value !== keepTabId) {
      const keepTab = findTabById(keepTabId);
      if (keepTab) {
        activeTabId.value = keepTabId;
        // Mark as programmatic navigation
        isProgrammaticNavigation = true;
        lastProgrammaticPath = keepTab.path;
        // Always navigate to the kept tab
        navigateToPath(keepTab.path).then(() => {
          setTimeout(() => {
            isProgrammaticNavigation = false;
            lastProgrammaticPath = null;
          }, 100);
        }).catch(() => {
          setTimeout(() => {
            isProgrammaticNavigation = false;
            lastProgrammaticPath = null;
          }, 100);
        });
      }
    }
  };

  // Close all closable tabs
  const closeAllTabs = () => {
    tabs.value
      .filter((tab) => tab.closable)
      .forEach((tab) => {
        clearListSessionsForRoutePath(tab.path);
        clearTabDrawerDraftsForTab(tab.id);
      });

    tabs.value = tabs.value.filter(tab => !tab.closable);
    
    // Switch to first non-closable tab (should be home)
    if (tabs.value.length > 0) {
      const firstTab = tabs.value[0];
      activeTabId.value = firstTab.id;
      // Mark as programmatic navigation
      isProgrammaticNavigation = true;
      lastProgrammaticPath = firstTab.path;
      // Always navigate to the first tab
      navigateToPath(firstTab.path).then(() => {
        setTimeout(() => {
          isProgrammaticNavigation = false;
          lastProgrammaticPath = null;
        }, 100);
      }).catch(() => {
        setTimeout(() => {
          isProgrammaticNavigation = false;
          lastProgrammaticPath = null;
        }, 100);
      });
    }
  };

  // Switch to tab
  const switchToTab = (tabId) => {
    console.log('🔄 switchToTab called:', tabId);
    const tab = findTabById(tabId);
    if (tab) {
      helpdeskTabAlertController.clearTabAlert(tab);
      liveChatTabAlertController.clearTabAlert(tab);
      internalChatTabAlertController.clearTabAlert(tab);
      const pathBase = (tab.path || '').split('?')[0];
      if (pathBase === '/settings/automation/processes' && tab.recordTitle) {
        restoreModuleListTabTitle(tab, pathBase);
      }
      console.log('📍 Switching to tab:', tab.title, 'path:', tab.path);
      
      let targetPath = tab.path;
      if (
        tab.titleKey === 'navigation.liveChat'
        || isLiveChatSessionsRoute((tab.path || '').split('?')[0])
      ) {
        const currentRouter = getRouter();
        const currentPath = currentRouter?.currentRoute?.value?.path || '';
        targetPath = resolveLiveChatSessionsNavigationPath(currentPath);
      }

      // Mark as programmatic navigation FIRST, before any navigation
      isProgrammaticNavigation = true;
      lastProgrammaticPath = targetPath; // Track this path
      
      // Update active tab ID
      activeTabId.value = tabId;
      
      // Always navigate to ensure the route is loaded
      navigateToPath(targetPath).then(() => {
        console.log('✅ Navigation complete to:', targetPath);
        // Reset flag after navigation completes
        setTimeout(() => {
          isProgrammaticNavigation = false;
          lastProgrammaticPath = null;
        }, 100);
      }).catch((err) => {
        console.log('⚠️ Navigation error (ignored):', err.message);
        // Reset flag even on error
        setTimeout(() => {
          isProgrammaticNavigation = false;
          lastProgrammaticPath = null;
        }, 100);
      });
      console.log('✅ switchToTab complete, activeTabId:', activeTabId.value);
    } else {
      console.error('❌ Tab not found:', tabId);
    }
  };

  // Update tab title
  const updateTabTitle = (tabId, newTitle) => {
    const tab = findTabById(tabId);
    if (!tab || newTitle == null) return;
    applyRecordTabTitle(tab, newTitle);
    const trimmed = getPersistedRecordTabName(tab);
    if (tab.alertBaseTitle && trimmed) {
      tab.alertBaseTitle = trimmed;
    }
    saveTabsToStorage();
  };

  /**
   * Replace the current tab's path and title in place, then navigate.
   * Use for prev/next record navigation so the same tab is reused instead of opening a new one.
   * @param {string} path - Full path (including query if needed), e.g. '/deals/123' or '/deals/123?navCtx=...'
   * @param {{ title?: string, params?: object }} options - Optional title and params for getTitleForPath
   */
  const replaceActiveTab = (path, options = {}) => {
    const pathOnly = normalizeLiveChatPath(path);
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
      isProgrammaticNavigation = true;
      navigateToPath(path).then(() => {
        setTimeout(() => { isProgrammaticNavigation = false; }, 50);
      });
      return;
    }
    const currentActiveTab = tabs.value.find(tab => tab.id === activeTabId.value);
    if (!currentActiveTab) {
      if (isLiveChatSessionsRoute(pathOnly)) {
        navigateLiveChatSessions(pathOnly, options);
        return;
      }
      if (isLiveChatClosedSessionsRoute(pathOnly)) {
        navigateLiveChatClosedSessions(pathOnly, options);
        return;
      }
      if (isLiveChatVisitorsRoute(pathOnly)) {
        navigateLiveChatClosedSessions(LIVE_CHAT_CLOSED_TAB_PATH, options);
        return;
      }
      if (isLiveChatReportsRoute(pathOnly)) {
        navigateLiveChatReports(options);
        return;
      }
      isProgrammaticNavigation = true;
      lastProgrammaticPath = path;
      navigateToPath(path).then(() => {
        setTimeout(() => {
          isProgrammaticNavigation = false;
          lastProgrammaticPath = null;
        }, 300);
      });
      return;
    }
    if (isLiveChatRoute(pathOnly) && liveChatMainTabOwnsRoute(pathOnly, currentActiveTab)) {
      applyMainLiveChatTabAndNavigate(currentActiveTab, pathOnly, options);
      return;
    }
    currentActiveTab.path = path;
    if (isLiveChatRoute(pathOnly)) {
      applyLiveChatTabTitle(currentActiveTab, pathOnly, options);
    } else if (isTemplatesModuleListPath(pathOnly)) {
      restoreModuleListTabTitle(currentActiveTab, pathOnly);
      if (options.title) {
        currentActiveTab.title = options.title;
        delete currentActiveTab.titleKey;
        delete currentActiveTab.titleParams;
      }
    } else if (options.title && isRecordDetailTabPath(path)) {
      applyRecordTabTitle(currentActiveTab, options.title);
    } else {
      const newTitle = options.title || getTitleForPath(pathOnly, options.params || {});
      if (!shouldPreserveRecordTabTitle(currentActiveTab, path)) {
        currentActiveTab.title = newTitle;
      }
    }
    if (options.params) {
      currentActiveTab.params = { ...currentActiveTab.params, ...options.params };
    }
    isProgrammaticNavigation = true;
    lastProgrammaticPath = path;
    navigateToPath(path).then(() => {
      setTimeout(() => {
        isProgrammaticNavigation = false;
        lastProgrammaticPath = null;
      }, 300);
    }).catch(() => {
      setTimeout(() => {
        isProgrammaticNavigation = false;
        lastProgrammaticPath = null;
      }, 300);
    });
  };

  // Reorder tabs
  const reorderTabs = (fromIndex, toIndex) => {
    const movedTab = tabs.value.splice(fromIndex, 1)[0];
    tabs.value.splice(toIndex, 0, movedTab);
  };

  // Note: handleNavigation removed as it caused circular loops with router.beforeEach
  // Tab creation is now handled explicitly by click handlers only

  return {
    // State - Return refs directly for better reactivity in templates
    tabs,
    activeTabId,
    activeTab,
    
    // Methods
    initTabs,
    setupRouteWatcher,
    openTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    switchToTab,
    updateTabTitle,
    replaceActiveTab,
    reorderTabs,
    findTabById,
    findTabByPath,
    navigateLiveChatSessions,
    navigateLiveChatClosedSessions,
    navigateLiveChatVisitors,
    navigateLiveChatReports,
    navigateAnnouncementsWorkspace,
    openLiveChatSession,
    openLiveChatClosedSession,
    openLiveChatVisitor,
    markHelpdeskTabAlertForCase,
    markHelpdeskTabAlertForNewCase,
    markLiveChatTabAlert,
    markInternalChatTabAlert,
    tabShowsHelpdeskAlert,
    clearHelpdeskTabAlert: helpdeskTabAlertController.clearTabAlertById,
    clearHelpdeskTabAlertForCase: helpdeskTabAlertController.clearTabAlertForCase,
    clearLiveChatMainTabAlert: liveChatTabAlertController.clearLiveChatMainTabAlert,
    clearInternalChatMainTabAlert: internalChatTabAlertController.clearInternalChatMainTabAlert,
  };
}

