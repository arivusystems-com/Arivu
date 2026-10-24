import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './stores/auth'
// @ts-expect-error JS router module has no declaration file
import router, { initializeDynamicRoutes } from './router'
import App from './App.vue'
// @ts-expect-error JS color-mode composable has no declaration file
import { useColorMode } from './composables/useColorMode'
import { installFetchApiBase } from './config/installFetchApiBase'
import { i18n, initI18n } from './i18n'
import { isAuthLifecyclePublicRoute } from './utils/standaloneRoutes'

const shouldEnableVerboseConsole = () => {
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_ENABLE_PROD_DEBUG_LOGS === 'true'
  }
  if (import.meta.env.DEV) {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem('arivu:debug:global') === '1'
    } catch (_e) {
      return false
    }
  }
  return false
}

// Silence noisy debug logs by default. Keep warn/error visible.
if (!shouldEnableVerboseConsole()) {
  const noop = () => {}
  console.log = noop
  console.info = noop
  console.debug = noop
  console.trace = noop
}

installFetchApiBase()

const app = createApp(App)
app.provide('arivuInitializeDynamicRoutes', initializeDynamicRoutes)
app.use(createPinia())
app.use(i18n)
app.use(router)

// Platform Permissions Contract Guard (DEV-only)
// CONTRACT-LOCKED: See docs/architecture/platform-permission-contract.md
if (import.meta.env.DEV) {
  console.info(
    '[Platform Permissions]',
    'Explanation-only system (contract-locked). Enforcement is forbidden.'
  );
}

void (async () => {
  // Color mode (must run before first paint: applies <html> class)
  const { colorMode } = useColorMode()
  if (import.meta.env.DEV) {
    console.log('Initial color mode:', colorMode.value)
  }

  // Register service worker for PWA (audit app only)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      if (window.location.pathname.startsWith('/audit/')) {
        navigator.serviceWorker.register('/service-worker.js', { scope: '/audit/' })
          .then((registration) => {
            if (import.meta.env.DEV) {
              console.log('[SW] Service Worker registered:', registration.scope)
            }
          })
          .catch((error) => {
            console.error('[SW] Service Worker registration failed:', error)
          })
      }
    })
  }

  try {
    const orgRaw = localStorage.getItem('organization')
    const org = orgRaw ? JSON.parse(orgRaw) : null
    const onAuthRoute =
      typeof window !== 'undefined' && isAuthLifecyclePublicRoute(window.location.pathname)
    let hasPersistedSession = false
    try {
      const userRaw = localStorage.getItem('user')
      const user = userRaw ? JSON.parse(userRaw) : null
      const token = user?.token
      hasPersistedSession = Boolean(
        token
        && token !== 'undefined'
        && token !== 'null'
      )
    } catch (_e) {
      hasPersistedSession = false
    }
    await initI18n({
      orgLanguage: org?.settings?.language,
      scope: onAuthRoute && !hasPersistedSession ? 'public' : 'core',
    })
  } catch (e) {
    console.error('[i18n] init failed', e)
    await initI18n()
  }

  await router.isReady()

  try {
    const { initCapacitorNative } = await import('./platform/capacitor/initCapacitorNative')
    await initCapacitorNative(router)
  } catch (e) {
    console.error('[capacitor] init failed', e)
  }

  app.mount('#app')

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {
    // web / optional
  }

  // Sentry + PostHog after first paint: avoids blocking TTI on analytics bundles.
  const startObservability = () => {
    void (async () => {
      try {
        const { initClientObservability } = await import('./config/observability.client')
        await initClientObservability(app, router)
      } catch (e) {
        console.error('[observability] init failed', e)
      }
    })()
  }
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(startObservability, { timeout: 4000 })
  } else {
    setTimeout(startObservability, 0)
  }
})()
