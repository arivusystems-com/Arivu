declare module '@/stores/appShell' {
  // JS Pinia store (no TS declarations yet)
  import type { AppRegistry } from '@/types/sidebar.types';
  export function useAppShellStore(): {
    activeApp?: string | null;
    ensureCachedAppRegistry(): Promise<AppRegistry>;
    invalidateAppRegistryCache(): void;
  };
}

declare module '@/stores/auth' {
  interface AuthAppAccess {
    appKey?: string;
    roleKey?: string;
    status?: string;
  }

  interface AuthUser {
    _id?: string;
    id?: string;
    token?: string;
    email?: string;
    name?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    roleId?: string;
    roles?: string[];
    isOwner?: boolean;
    isPlatformAdmin?: boolean;
    userType?: string;
    organizationId?: string;
    organization?: { _id?: string; name?: string } | null;
    permissions?: Record<string, Record<string, boolean | Record<string, boolean>>>;
    allowedApps?: string[];
    appAccess?: Array<AuthAppAccess | null>;
    emailVerifiedAt?: string | null;
    requiresPortalSelection?: boolean;
    portals?: Array<{ name?: string; id?: string } | null>;
    activeExternalRoleId?: string | null;
    activePortal?: { name?: string } | null;
    timeZone?: string | null;
    dateFormat?: string | null;
    timeFormat?: string | null;
    entitledAddons?: { live_chat?: boolean; ai?: boolean; cpq?: boolean };
    fieldPermissions?: import('@/utils/fieldRbacPermission').FieldPermissionsMap;
    fieldPermissionAppKey?: string | null;
  }

  interface AuthOrgSettings {
    locale?: string;
    timeZone?: string;
    dateFormat?: string;
    language?: string;
    rbacV2Enabled?: boolean;
    defaultPhoneCountry?: string;
    portalFrameworkV1Enabled?: boolean;
  }

  interface AuthOrganization {
    _id?: string;
    name?: string;
    enabledModules?: string[];
    enabledApps?: Array<string | AuthAppAccess>;
    capabilities?: { inventory?: boolean; portalFrameworkV1?: boolean };
    settings?: AuthOrgSettings;
    address?: string;
    subscription?: {
      status?: string;
      tier?: string;
      trialEndDate?: string | null;
      trialExtensionUsed?: boolean;
    } | null;
  }

  export interface AuthStore {
    user: AuthUser | null;
    organization: AuthOrganization | null;
    lastLoginResult: unknown;
    lastTrialSyncAt: number;
    loading: boolean;
    error: string | null;
    sessionLimit: unknown;
    isAuthenticated: boolean;
    isOwner: boolean;
    userRole: string | null;
    isAdminLike: boolean;
    hasPermission: (module: string, action: string) => boolean;
    isTrialActive: boolean;
    isTrialExpired: boolean;
    hasUsedTrialExtension: boolean;
    subscriptionTier: string;
    enabledModules: string[];
    inventoryEnabled: boolean;
    isMasterOrganization: boolean;
    isPlatformAdmin: boolean;
    isExternalUser: boolean;
    needsPortalSelection: boolean;
    hasMultiplePortals: boolean;
    activePortalLabel: string | null;
    requiresEmailVerification: boolean;
    hasAppAccess: (appKey: string) => boolean;
    hasAssignedAppAccess: (appKey: string) => boolean;
    resolveAllowedApps: (
      userData?: Record<string, unknown>,
      options?: Record<string, unknown>
    ) => string[];
    setUser: (userData: AuthUser | null) => void;
    markEmailVerified: () => void;
    updateOnboardingSummary: (summary: Record<string, unknown>) => void;
    syncI18nFromOrganization: () => Promise<void>;
    clearUser: () => void;
    buildSessionTransferPayload: () => unknown;
    applySessionTransferPayload: (encodedPayload: string) => boolean;
    applySessionTransferFromLocationHash: () => boolean;
    applyGoogleSessionLimitFromLocationHash: () => boolean;
    authenticate: (endpoint: string, credentials: Record<string, unknown>) => Promise<unknown>;
    register: (userData: Record<string, unknown>) => Promise<unknown>;
    login: (credentials: Record<string, unknown>) => Promise<unknown>;
    continueLoginAfterSessionRevoke: () => Promise<unknown>;
    revokeLoginSession: (sessionId: string) => Promise<unknown>;
    clearSessionLimit: () => void;
    canContinueAfterSessionLimit: () => boolean;
    getSessionLimitUsage: () => unknown;
    getRecommendedSessionToRevoke: () => unknown;
    resolvePostLoginRoute: () => { name: string };
    applyPortalSession: (data: Record<string, unknown>) => void;
    portalSessionRequest: (method: string, path: string, body?: unknown) => Promise<unknown>;
    selectPortal: (roleId: string) => Promise<unknown>;
    switchPortal: (roleId: string) => Promise<unknown>;
    setDefaultExternalRole: (roleId: string) => Promise<unknown>;
    refreshPortals: () => Promise<unknown>;
    logout: () => Promise<void>;
    can: (module: string, action: string) => boolean;
    hasModule: (moduleName: string) => boolean;
    refreshOrganization: () => Promise<unknown>;
    syncTrialSubscription: (options?: Record<string, unknown>) => Promise<unknown>;
    refreshUser: (options?: Record<string, unknown>) => Promise<unknown>;
  }

  export function useAuthStore(pinia?: unknown): AuthStore;
}

declare module '@/stores/authRegistry' {
  import type { AuthStore } from '@/stores/auth';
  export function useAuthStore(pinia?: unknown): AuthStore;
}

declare module '@/stores/notifications' {
  interface NotificationEntity {
    type?: string;
    id?: string;
    [extra: string]: unknown;
  }

  interface NotificationItem {
    id: string;
    appKey?: string;
    eventType?: string;
    title?: string;
    body?: string;
    priority?: string;
    entity?: NotificationEntity | null;
    readAt?: string | null;
    createdAt?: string;
    [extra: string]: unknown;
  }

  interface NotificationListOptions {
    unreadOnly?: boolean;
    limit?: number;
    cursor?: string | null;
  }

  export function useNotificationStore(): {
    items: NotificationItem[];
    unreadCount: number;
    hasUnread: boolean;
    loading: boolean;
    error: string | null;
    nextCursor: string | null;
    fetchUnreadPreview: (options?: { appKey?: string }) => Promise<unknown>;
    syncIncomingNotificationsFromServer: (options?: {
      sinceMs?: number;
      appKeys?: string[];
    }) => Promise<{ ingested: number }>;
    isNotificationApiBackedOff: () => boolean;
    beginRealtimeAlertSession: () => void;
    primeUnreadPreviewFromCache: () => void;
    fetchNotifications: (options?: NotificationListOptions) => Promise<unknown>;
    markRead: (id: string) => Promise<unknown>;
    markAllRead: () => Promise<unknown>;
    resetState: () => void;
    formatRelative: (date: string | number | Date | null | undefined) => string;
    handleIncomingNotification: (notification: NotificationItem | Record<string, unknown>) => void;
    currentAppKey: () => string;
    isSnoozed: (id: string, appKey?: string) => boolean;
    getSnoozedUntil: (id: string, appKey?: string) => number | null;
    snoozeNotification: (payload: { id: string; until: number | string; label?: string }) => void;
    isDismissed: (id: string, appKey?: string) => boolean;
    dismissNotification: (id: string) => Promise<unknown>;
  };
}

declare module '@/utils/apiClient' {
  // Technical debt: typed API-client contract.
  // Keep this `any` until requests can take an endpoint-specific response type.
  // A single shared response bag failed type-check at 241 sites in 34 files.
  // Do not replace this with one generic payload type, and do not disable the rule
  // for the file. Remove this declaration when the client contract lands.
  const apiClient: any;
  export default apiClient;
}

declare module '@/utils/dateUtils' {
  type DateInput = string | number | Date | null;
  export function openDatePicker(event?: { target?: EventTarget | null } | null): void;
  export function format(date: DateInput, formatStr?: string): string;
  export function fromNow(date: DateInput): string;
  export function duration(end: DateInput, start: DateInput): {
    asMinutes: () => number;
    asHours: () => number;
    asDays: () => number;
  };
  const dateUtils: {
    openDatePicker: typeof openDatePicker;
    format: typeof format;
    fromNow: typeof fromNow;
    duration: typeof duration;
    startOf: (date: DateInput, unit: string) => Date;
    endOf: (date: DateInput, unit: string) => Date;
    add: (date: DateInput, amount: number, unit: string) => Date;
    subtract: (date: DateInput, amount: number, unit: string) => Date;
    isSame: (date1: DateInput, date2: DateInput, unit?: string) => boolean;
    isBetween: (
      date: DateInput,
      start: DateInput,
      end: DateInput,
      unit?: string,
      inclusivity?: string
    ) => boolean;
    isSameOrBefore: (date1: DateInput, date2: DateInput, unit?: string) => boolean;
    clone: (date: DateInput) => Date;
    date: (value: DateInput) => number;
    month: (value: DateInput) => number;
    year: (value: DateInput) => number;
    day: (value: DateInput) => number;
    hour: (value: DateInput) => number;
    minute: (value: DateInput) => number;
    toISOString: (date: DateInput) => string;
  };
  export default dateUtils;
}

declare module '@/composables/useTabs' {
  interface WorkspaceTab {
    id: string;
    path: string;
    title?: string;
    titleKey?: string;
    titleParams?: Record<string, unknown>;
    icon?: unknown;
    closable?: boolean;
    params?: Record<string, unknown>;
    [extra: string]: unknown;
  }

  interface OpenTabOptions {
    title?: string;
    titleKey?: string;
    titleParams?: Record<string, unknown>;
    id?: string;
    icon?: string;
    closable?: boolean;
    params?: Record<string, unknown>;
    insertAdjacent?: boolean;
    background?: boolean;
    [extra: string]: unknown;
  }

  export function useTabs(): {
    tabs: import('vue').Ref<WorkspaceTab[]>;
    activeTabId: import('vue').Ref<string | null>;
    activeTab: import('vue').ComputedRef<WorkspaceTab | null | undefined>;
    initTabs: () => void;
    setupRouteWatcher: (route?: unknown) => void;
    openTab: (path: string, options?: OpenTabOptions) => WorkspaceTab | undefined;
    closeTab: (tabId: string) => Promise<void>;
    closeOtherTabs: (keepTabId?: string) => void;
    closeAllTabs: () => void;
    switchToTab: (tabId: string) => void;
    updateTabTitle: (tabId: string, newTitle: string) => void;
    replaceActiveTab: (path: string, options?: OpenTabOptions) => WorkspaceTab | undefined;
    reorderTabs: (fromIndex: number, toIndex: number) => void;
    findTabById: (id: string) => WorkspaceTab | undefined;
    findTabByPath: (path: string) => WorkspaceTab | undefined;
    navigateLiveChatSessions: (path?: string, options?: OpenTabOptions) => void;
    navigateLiveChatClosedSessions: (path?: string, options?: OpenTabOptions) => void;
    navigateLiveChatVisitors: (path?: string, options?: OpenTabOptions) => void;
    navigateLiveChatReports: (options?: OpenTabOptions) => void;
    navigateAnnouncementsWorkspace: (path?: string, options?: OpenTabOptions) => void;
    openLiveChatSession: (sessionId: string) => void;
    openLiveChatClosedSession: (sessionId: string, options?: OpenTabOptions) => void;
    openLiveChatVisitor: (visitorId: string) => void;
    markHelpdeskTabAlertForCase: (caseId: string, kind?: string) => void;
    markHelpdeskTabAlertForNewCase: (caseId: string, kind?: string) => void;
    markLiveChatTabAlert: (kind?: string) => void;
    markInternalChatTabAlert: (kind?: string) => void;
    tabShowsHelpdeskAlert: (tab: WorkspaceTab, activeId?: string | null) => boolean;
    clearHelpdeskTabAlert: (tabId: string) => void;
    clearHelpdeskTabAlertForCase: (caseId: string) => void;
    clearLiveChatMainTabAlert: () => void;
    clearInternalChatMainTabAlert: () => void;
  };
}

declare module '@/composables/useNotifications' {
  // JS notifications composable (no TS declarations yet)
  export function useNotifications(): {
    notifications: import('vue').Ref<unknown[]>;
    show: (message: string | object, typeOrOptions?: string | object, duration?: number) => string;
    remove: (id: string) => void;
    success: (message: string, durationOrOptions?: number | object) => string;
    error: (message: string, durationOrOptions?: number | object) => string;
    warning: (message: string, durationOrOptions?: number | object) => string;
    info: (message: string, durationOrOptions?: number | object) => string;
  };
  export function setGlobalNotificationFn(fn: ((presentation: object) => void) | null): void;
  export function showGlobalNotification(message: string, options?: number | object): string | undefined;
  export function removeToast(id: string): void;
  export function pushToast(presentation: object): string;
}

declare module '@/composables/useOnboarding' {
  interface OnboardingVisit {
    moduleKey?: string;
    appKey?: string;
    [extra: string]: unknown;
  }

  interface OnboardingState {
    version: number;
    origin: string | null;
    persona: string | null;
    context: ({ primaryAppKey?: string } & Record<string, unknown>) | null;
    goalKey: string | null;
    startedAt: string | null;
    completedAt: string | null;
    dismissedAt: string | null;
    redirectTo: string | null;
    showWelcome: boolean;
    showSetupProgress: boolean;
    progress: { completed: number; total: number };
    steps: unknown[];
    orgProgress: { completed: number; total: number };
    orgSteps: unknown[];
    welcome: unknown;
    trial: unknown;
    goalOptions: unknown[];
    moduleVisits: OnboardingVisit[];
    pendingCoachmarks: unknown[];
    verticalTemplate: ({ emptyStateCopyKey?: string } & Record<string, unknown>) | null;
    sampleDataOffer: unknown;
  }

  export function useOnboarding(): {
    loading: import('vue').Ref<boolean>;
    error: import('vue').Ref<string | null>;
    state: import('vue').Ref<OnboardingState>;
    isFounder: import('vue').ComputedRef<boolean>;
    isMember: import('vue').ComputedRef<boolean>;
    needsOnboardingRedirect: import('vue').ComputedRef<boolean>;
    isComplete: import('vue').ComputedRef<boolean>;
    fetchOnboarding: (options?: { force?: boolean }) => Promise<void>;
    patchOnboarding: (payload: Record<string, unknown>) => Promise<boolean>;
    setGoal: (goalKey: string) => Promise<boolean>;
    skipStep: (stepKey: string) => Promise<boolean>;
    completeStep: (stepKey: string) => Promise<boolean>;
    dismissWelcome: () => Promise<boolean>;
    saveWorkspace: (workspace: Record<string, unknown>) => Promise<boolean>;
    setPrimaryApp: (appKey: string) => Promise<boolean>;
    createFirstContact: (contact: Record<string, unknown>) => Promise<boolean>;
    markCoachmark: (key: string) => Promise<boolean>;
    recordModuleVisit: (moduleKey: string, appKey?: string) => Promise<boolean>;
    recordSettingsVisit: () => Promise<boolean>;
    acceptSampleData: () => Promise<boolean>;
    declineSampleData: () => Promise<boolean>;
    hasModuleVisit: (moduleKey: string, appKey?: string) => boolean;
    applyAuthSummary: (summary: {
      redirectTo?: string | null;
      persona?: string | null;
      origin?: string | null;
      completed?: boolean;
      [extra: string]: unknown;
    }) => void;
    verticalEmptyStateCopyKey: import('vue').ComputedRef<string | null>;
  };
}

declare module '@/composables/useColorMode' {
  // JS color mode composable (no TS declarations yet)
  export function useColorMode(): {
    colorMode: import('vue').Ref<'light' | 'dark' | 'system'>;
    effectiveDark: import('vue').Ref<boolean>;
    toggleColorMode: (mode: 'light' | 'dark' | 'system') => void;
    clearStoredMode: () => void;
  };
}

declare module '@/composables/usePortalBranding' {
  export const PORTAL_DEFAULT_PRIMARY_COLOR: string;
  export function usePortalBranding(): {
    branding: import('vue').Ref<{
      orgName: string;
      logoUrl: string | null;
      primaryColor: string;
      supportEmail: string | null;
    } | null>;
    loading: import('vue').Ref<boolean>;
    loadBranding: (force?: boolean) => Promise<{
      orgName: string;
      logoUrl: string | null;
      primaryColor: string;
      supportEmail: string | null;
    } | null>;
  };
}

declare module '@/components/activity/useRecordActivityAdapter' {
  export function createActivityTimelineRefSetter<T>(timelineRef: { value: T | null }): (instance: T | null) => void;
  export function buildRecordActivityUi(moduleUi?: Record<string, unknown>): Record<string, unknown>;
}

declare module '@/components/activity/adapters/taskActivityUiAdapter' {
  export function createTaskActivityUi(
    options: Record<string, unknown>
  ): import('vue').ComputedRef<Record<string, unknown>>;
}

declare module '@/components/activity/adapters/dealActivityUiAdapter' {
  export function createDealActivityUi(
    options: Record<string, unknown>
  ): import('vue').ComputedRef<Record<string, unknown>>;
}

declare module '@/components/activity/activityUiContract' {
  export const ACTIVITY_UI_STATE_DEFAULTS: Record<string, unknown>;
  export const ACTIVITY_UI_HANDLER_KEYS: string[];
  export function normalizeActivityUiContract(moduleUi?: Record<string, unknown>): Record<string, unknown>;
}

declare module '@/utils/builderMergeTagHtml' {
  export const BUILDER_MERGE_CHIP_CLASS: string;
  export const MERGE_CHIP_CARET_ANCHOR: string;
  export function mergeTokensToChipHtml(html: string): string;
  export function normalizeCellMergeTokenHtml(html: string): string;
  export function chipHtmlToMergeTokens(html: string): string;
  export function elementToMergeTokens(element: HTMLElement): string;
  export function nodesToMergeTokens(root: ParentNode): string;
  export function applyMergeChipsToElement(element: HTMLElement, tokenText: string): void;
  export function applyMergeChipsInPlace(element: HTMLElement): void;
  export function createMergeChipElement(path: string, doc?: Document): HTMLElement;
  export function serializeElementHtmlWithMergeTokens(element: HTMLElement): string;
  export function contentHasHtmlMarkup(text: string): boolean;
  export function hostHasRichMarkup(element: HTMLElement): boolean;
  export function hostHasLineBreakMarkup(element: HTMLElement): boolean;
  export function normalizeGrapesHtmlMergeTokens(html: string): string;
}

declare module 'js-beautify' {
  export function html(source: string, options?: Record<string, unknown>): string;
  export function css(source: string, options?: Record<string, unknown>): string;
}

declare module '@/components/record-page/slashCommands' {
  // JS TipTap extension; tests introspect `.config` — keep loose until migrated to TS
  export const SlashCommands: {
    config: {
      addProseMirrorPlugins?: (this: unknown) => unknown[];
    };
  };
}

declare module '@/utils/moduleListFreshness' {
  export function dispatchRecordUpdated(detail?: {
    moduleKey: string;
    record?: object | null;
    recordId?: string | null;
    appKey?: string;
  }): void;
  export function markModuleListDirty(moduleKey: string, appKey?: string): void;
  export function markModuleListRecheck(moduleKey: string, appKey?: string): void;
}

declare module '@/services/dataChangeRealtimeService' {
  export function emitLocalDataChange(payload?: {
    moduleKey?: string;
    recordId?: string;
    op?: string;
    patch?: Record<string, unknown> | null;
  }): void;
  export function startDataChangeRealtime(token: string): void;
  export function stopDataChangeRealtime(): void;
}

