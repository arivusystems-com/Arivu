/** Pathname-only checks — safe before vue-router finishes initial navigation. */
export function resolveRoutePathname(path) {
  return String(path || '').split('?')[0];
}

export function isStandalonePublicRoute(path) {
  const p = resolveRoutePathname(path);
  return (
    p === '/pricing'
    || p.startsWith('/book/')
    || p.startsWith('/appointments/manage/')
    || p.startsWith('/webforms/public/')
    || p.startsWith('/webforms/embed/')
    || p.startsWith('/webforms/staff-preview/')
    || p.startsWith('/forms/public/')
    || p.startsWith('/public/quotes/')
    || p.startsWith('/examples/headless-article')
    || p.startsWith('/examples/headless-article-list')
    || p.startsWith('/examples/headless-help-home')
    || p.startsWith('/examples/headless-help-category')
    || p.startsWith('/examples/headless-help-section')
    || p.startsWith('/marketing/preferences/')
  );
}

export function isAuthLifecyclePublicRoute(path) {
  const p = resolveRoutePathname(path);
  return (
    p === '/accept-invite'
    || p === '/verify-email'
    || p === '/trial/setup'
    || p === '/forgot-password'
    || p === '/reset-password'
    || p === '/login'
  );
}

export function isTrialExpiredShelllessRoute(path) {
  return resolveRoutePathname(path) === '/trial-expired';
}

export function isOnboardingShelllessRoute(path) {
  return resolveRoutePathname(path) === '/onboarding'
    || resolveRoutePathname(path) === '/trial/setup';
}

export function isStandaloneShelllessPath(path) {
  return isStandalonePublicRoute(path);
}

/** Browser pathname check for async callbacks (auth refresh, apiClient) outside Vue setup. */
export function isOnPublicShellRoute() {
  if (typeof window === 'undefined') return false;
  return isStandalonePublicRoute(window.location.pathname);
}

export function isPortalAuthLifecycleRoute(path) {
  const p = resolveRoutePathname(path);
  return p === '/portal/select' || p === '/portal/set-password';
}

/** External Learning Academy — own layout, never PlatformShell. */
export function isAcademySurfaceRoute(path) {
  const p = resolveRoutePathname(path);
  return p === '/academy' || p.startsWith('/academy/');
}

/** Routes the tab bar must not track (public, auth, landing, trial expired). */
export function shouldSkipTabRoute(path) {
  const p = resolveRoutePathname(path);
  return (
    p === '/'
    || isStandalonePublicRoute(path)
    || isAuthLifecyclePublicRoute(path)
    || isPortalAuthLifecycleRoute(path)
    || isAcademySurfaceRoute(path)
    || isTrialExpiredShelllessRoute(path)
    || isOnboardingShelllessRoute(path)
  );
}
