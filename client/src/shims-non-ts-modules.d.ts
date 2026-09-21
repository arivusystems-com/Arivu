declare module '@/stores/appShell' {
  // JS Pinia store (no TS declarations yet)
  import type { AppRegistry } from '@/types/sidebar.types';
  export function useAppShellStore(): {
    activeApp?: string | null;
    ensureCachedAppRegistry(): Promise<AppRegistry>;
    invalidateAppRegistryCache(): void;
  };
}

declare module '@/stores/authRegistry' {
  // JS Pinia store (no TS declarations yet)
  export function useAuthStore(pinia?: unknown): any;
}

declare module '@/stores/auth' {
  // JS Pinia store (no TS declarations yet)
  export function useAuthStore(pinia?: unknown): any;
}

declare module '@/stores/notifications' {
  // JS Pinia store (no TS declarations yet)
  export function useNotificationStore(): any;
}

declare module '@/utils/apiClient' {
  // JS API client (no TS declarations yet)
  const apiClient: any;
  export default apiClient;
}

declare module '@/utils/dateUtils' {
  export function openDatePicker(target?: any): void;
  export function format(...args: any[]): any;
  export function fromNow(...args: any[]): any;
  export function duration(...args: any[]): any;
  const dateUtils: {
    openDatePicker: typeof openDatePicker;
    format: typeof format;
    fromNow: typeof fromNow;
    duration: typeof duration;
    [key: string]: any;
  };
  export default dateUtils;
}

declare module '@/composables/useTabs' {
  // JS tabs composable (no TS declarations yet)
  export function useTabs(): any;
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
  // JS onboarding composable (no TS declarations yet)
  export function useOnboarding(): any;
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
  export function createActivityTimelineRefSetter(timelineRef: any): (instance: any) => void;
  export function buildRecordActivityUi(moduleUi?: Record<string, any>): Record<string, any>;
}

declare module '@/components/activity/adapters/taskActivityUiAdapter' {
  export function createTaskActivityUi(options: Record<string, any>): any;
}

declare module '@/components/activity/adapters/dealActivityUiAdapter' {
  export function createDealActivityUi(options: Record<string, any>): any;
}

declare module '@/components/activity/activityUiContract' {
  export const ACTIVITY_UI_STATE_DEFAULTS: Record<string, any>;
  export const ACTIVITY_UI_HANDLER_KEYS: string[];
  export function normalizeActivityUiContract(moduleUi?: Record<string, any>): Record<string, any>;
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

