/** Pathname-only checks — safe before vue-router finishes initial navigation. */
export function resolveRoutePathname(path?: string | null): string;
export function isStandalonePublicRoute(path?: string | null): boolean;
export function isAuthLifecyclePublicRoute(path?: string | null): boolean;
export function isTrialExpiredShelllessRoute(path?: string | null): boolean;
export function isOnboardingShelllessRoute(path?: string | null): boolean;
export function isStandaloneShelllessPath(path?: string | null): boolean;
/** Browser pathname check for async callbacks (auth refresh, apiClient) outside Vue setup. */
export function isOnPublicShellRoute(): boolean;
export function isPortalAuthLifecycleRoute(path?: string | null): boolean;
/** External Learning Academy — own layout, never PlatformShell. */
export function isAcademySurfaceRoute(path?: string | null): boolean;
/** Routes the tab bar must not track (public, auth, landing, trial expired). */
export function shouldSkipTabRoute(path?: string | null): boolean;
