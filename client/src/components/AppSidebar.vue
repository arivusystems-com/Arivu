<template>
  <div class="sidebar-chrome flex h-full min-h-0 w-full bg-white dark:bg-neutral-900">
  <nav
    class="sidebar-nav sidebar-nav--brand sidebar-nav--rail relative flex flex-col h-full overflow-hidden w-[3.5rem] shrink-0 bg-primary-800 dark:bg-neutral-950"
    :style="portalSidebarStyle"
  >
    <!-- Logo mark only -->
    <div class="relative h-[2.75rem] border-b border-white/20 dark:border-neutral-800/80 dark:bg-primary-900/30 flex-shrink-0 flex items-center justify-center px-0">
      <div class="h-[1.75rem] w-[1.75rem] flex items-center justify-center rounded-lg bg-white/10 dark:bg-neutral-800/50 p-1">
        <img
          :src="sidebarLogoUrl"
          alt=""
          class="h-full w-full object-contain"
        />
      </div>
    </div>

    <!-- Scrollable Content Area -->
    <div class="flex-1 overflow-y-auto min-h-0 overflow-x-visible">
      <!-- Search (icon only) -->
      <div v-if="searchSurface" class="px-1 pt-2 pb-1">
        <button
          type="button"
          data-onboarding-target="command_palette"
          @click="handleNavClick(searchSurface.route, searchSurface, $event, { icon: searchSurface.icon })"
          class="sidebar-rail-item sidebar-search-control w-full flex flex-col items-center justify-center gap-1 min-h-[2.75rem] py-1 px-0.5"
          :aria-label="t('actions.search')"
        >
          <span class="sidebar-rail-icon">
            <span class="sidebar-rail-glyph">
              <FigmaSearchIcon class="w-full h-full" :fill="iconColors.secondary" />
            </span>
          </span>
          <span class="sidebar-rail-label text-white/60 dark:text-neutral-500">{{ railTruncate(t('actions.search')) }}</span>
        </button>
      </div>

      <!-- Workspace shell: top 3 + More flyout -->
      <div class="px-1">
        <div class="flex flex-col gap-0.5">
          <a
            v-for="item in primaryShellItems"
            :key="item.id"
            :href="item.route"
            @click.prevent="handleNavClick(item.route, item, $event, { icon: item.icon })"
            @auxclick.prevent="handleNavClick(item.route, item, $event, { icon: item.icon })"
            class="sidebar-rail-item w-full flex flex-col items-center justify-center gap-1 min-h-[3rem] py-1 px-0.5"
            :class="navItemStateClasses(item.route)"
            :aria-label="navLabel(item)"
          >
            <span class="sidebar-rail-icon">
              <span class="sidebar-rail-glyph">
                <component
                  :is="getFigmaNavIcon(item)"
                  class="w-full h-full"
                  :fill="railIconFill(isActiveRoute(item.route))"
                />
              </span>
            </span>
            <span
              class="sidebar-rail-label"
              :class="isActiveRoute(item.route) ? 'text-white' : 'text-white/75 dark:text-neutral-400'"
            >
              {{ railTruncate(navLabel(item)) }}
            </span>
          </a>

          <div
            v-if="workspaceMoreApp"
            class="relative"
            @mouseenter="onAppHoverEnter(WORKSPACE_MORE_ID)"
            @mouseleave="onAppHoverLeave"
          >
            <button
              :ref="(el) => setAppAnchor(WORKSPACE_MORE_ID, el)"
              type="button"
              class="sidebar-rail-item sidebar-app-peer w-full flex flex-col items-center justify-center gap-1 min-h-[3rem] py-1 px-0.5"
              :class="[
                isWorkspaceMoreActive ? 'sidebar-nav-item--active' : '',
                isAppChromeOpen(WORKSPACE_MORE_ID) ? 'sidebar-app-peer--open' : '',
              ]"
              :aria-label="t('navigation.more')"
              :aria-expanded="isAppChromeOpen(WORKSPACE_MORE_ID)"
              :aria-haspopup="true"
              @click="onAppClick(WORKSPACE_MORE_ID)"
            >
              <span class="sidebar-rail-icon">
                <span class="sidebar-rail-glyph">
                  <component
                    :is="moreIcon"
                    class="w-full h-full"
                    :fill="railIconFill(isWorkspaceMoreActive)"
                  />
                </span>
              </span>
              <span
                class="sidebar-rail-label"
                :class="isWorkspaceMoreActive ? 'text-white font-medium' : 'text-white/75 dark:text-neutral-400'"
              >
                {{ railTruncate(t('navigation.more')) }}
              </span>
            </button>

            <AppFlyout
              v-if="isFlyoutOpen(WORKSPACE_MORE_ID) && workspaceMoreApp"
              :app="workspaceMoreApp"
              :active-path="route.path"
              :anchor-el="appAnchors[WORKSPACE_MORE_ID] || null"
              @flyout-enter="onFlyoutEnter"
              @flyout-leave="onAppHoverLeave"
              @navigate="onFlyoutNavigate"
            />
          </div>
        </div>

        <div
          v-if="applicationPeers.length > 0"
          class="mt-2 mb-1 mx-1 h-px bg-white/20 dark:bg-neutral-800"
        />
      </div>

      <!-- Applications: hover flyout peek; click docks module drawer -->
      <div
        v-if="applicationPeers.length > 0"
        class="px-1 flex flex-col gap-0.5"
      >
        <div
          v-for="app in applicationPeers"
          :key="app.id"
          class="relative"
          @mouseenter="onAppHoverEnter(app.id)"
          @mouseleave="onAppHoverLeave"
        >
          <button
            :ref="(el) => setAppAnchor(app.id, el)"
            type="button"
            class="sidebar-rail-item sidebar-app-peer w-full flex flex-col items-center justify-center gap-1 min-h-[3rem] py-1 px-0.5"
            :class="[
              isAppRailActive(app.id) ? 'sidebar-nav-item--active' : '',
              isAppChromeOpen(app.id) ? 'sidebar-app-peer--open' : '',
            ]"
            :aria-label="appDisplayName(app)"
            :aria-expanded="isAppChromeOpen(app.id)"
            :aria-haspopup="true"
            @click="onAppClick(app.id)"
          >
            <span class="sidebar-rail-icon">
              <span class="sidebar-rail-glyph">
                <component
                  :is="getAppIcon(app)"
                  class="w-full h-full"
                  :fill="railIconFill(isAppRailActive(app.id))"
                />
              </span>
            </span>
            <span
              class="sidebar-rail-label"
              :class="isAppRailActive(app.id) ? 'text-white font-medium' : 'text-white/75 dark:text-neutral-400'"
            >
              {{ railTruncate(appDisplayName(app)) }}
            </span>
          </button>

          <AppFlyout
            v-if="isFlyoutOpen(app.id)"
            :app="app"
            :active-path="route.path"
            :anchor-el="appAnchors[app.id] || null"
            @flyout-enter="onFlyoutEnter"
            @flyout-leave="onAppHoverLeave"
            @navigate="onFlyoutNavigate"
          />
        </div>
      </div>
    </div>

    <!-- Footer: Settings + Help -->
    <div class="flex-shrink-0 border-t border-white/20 dark:border-neutral-800">
      <div class="px-1 py-1.5 flex flex-col gap-0.5 items-center">
        <a
          href="/settings"
          class="sidebar-rail-item w-full flex flex-col items-center justify-center gap-1 min-h-[3rem] py-1 px-0.5"
          :class="navItemStateClasses('/settings')"
          :aria-label="t('navigation.settings')"
          @click.prevent="handleNavClick('/settings', { labelKey: 'navigation.settings', label: 'Settings' }, $event, { icon: 'cog-6-tooth' })"
          @auxclick.prevent="handleNavClick('/settings', { labelKey: 'navigation.settings', label: 'Settings' }, $event, { icon: 'cog-6-tooth' })"
        >
          <span class="sidebar-rail-icon">
            <span class="sidebar-rail-glyph">
              <component :is="settingsIcon" class="w-full h-full" :fill="railIconFill(isActiveRoute('/settings'))" />
            </span>
          </span>
          <span
            class="sidebar-rail-label"
            :class="isActiveRoute('/settings') ? 'text-white' : 'text-white/75 dark:text-neutral-400'"
          >
            {{ railTruncate(t('navigation.settings')) }}
          </span>
        </a>
        <button
          type="button"
          class="sidebar-rail-item w-full flex flex-col items-center justify-center gap-1 min-h-[3rem] py-1 px-0.5"
          :aria-label="t('navigation.help')"
          @click="openHelp"
        >
          <span class="sidebar-rail-icon">
            <span class="sidebar-rail-glyph">
              <FigmaInfoIcon class="w-full h-full" :fill="iconColors.primary" />
            </span>
          </span>
          <span class="sidebar-rail-label text-white/75 dark:text-neutral-400">{{ railTruncate(t('navigation.help')) }}</span>
        </button>
      </div>
    </div>
  </nav>

  <Transition name="module-drawer" @after-leave="onDrawerAfterLeave">
    <div
      v-if="drawerShown && drawerApp"
      key="module-drawer"
      class="module-drawer-slot h-full min-h-0"
      :class="isMobileViewport ? 'module-drawer-slot--fill' : 'module-drawer-slot--fixed'"
    >
      <AppModuleDrawer
        :app="drawerApp"
        :active-path="route.path"
        :collapsible="!isMobileViewport"
        :fill-width="isMobileViewport"
        @collapse="collapseDrawer"
        @navigate="onDrawerNavigate"
      />
    </div>
  </Transition>
  </div>
</template>

<script setup lang="ts">
// This component renders the locked SidebarStructure.
// Do not add new sidebar sections without updating sidebar-invariants.md
/**
 * ============================================================================
 * PLATFORM SIDEBAR: Main Component
 * ============================================================================
 *
 * Strict order: shell → applications (flyout peek / docked drawer) → Help / Settings
 * ============================================================================
 */

import { computed, h, ref, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useColorMode } from '@/composables/useColorMode';
import { Cog6ToothIcon, EllipsisHorizontalIcon, Squares2X2Icon } from '@heroicons/vue/24/outline';
import { useRoute } from 'vue-router';
import { useSidebarState } from '@/composables/useSidebarState';
import { usePortalBranding, PORTAL_DEFAULT_PRIMARY_COLOR } from '@/composables/usePortalBranding';
import { isPortalAuthLifecycleRoute } from '@/utils/standaloneRoutes';
import type { AppFlyoutDefinition, SidebarItem, SidebarStructure } from '@/types/sidebar.types';
import { useTabs } from '@/composables/useTabs';
import AppFlyout from '@/components/AppFlyout.vue';
import AppModuleDrawer from '@/components/AppModuleDrawer.vue';
import { dispatchSidebarChromeChange } from '@/utils/sidebarLayout';
import logoLightUrl from '/assets/logo/Logo_light.svg';
import {
  AcademicCapIcon,
  BanknotesIcon,
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  DocumentChartBarIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  LifebuoyIcon,
  PresentationChartLineIcon,
  ShieldCheckIcon,
} from '@heroicons/vue/24/outline';
import { getIconComponent, getNavigationIconComponent } from '@/utils/navigationIcons';
import { resolveSidebarItemLabel } from '@/utils/navigationLabels';

const HOVER_OPEN_MS = 200;
const HOVER_CLOSE_MS = 100;
const WORKSPACE_MORE_ID = '__workspace_more__';
/** Match Tailwind `lg` — mobile Dialog uses `lg:hidden`. */
const DESKTOP_SIDEBAR_MQ = '(min-width: 1024px)';
const CORE_APP_ID = 'CORE';
const WORKSPACE_PRIMARY_COUNT = 3;

const { t, te } = useI18n();
const { effectiveDark } = useColorMode();

function navLabel(item: { labelKey?: string; label?: string }) {
  return resolveSidebarItemLabel(item, t);
}

function appDisplayName(app: { nameKey?: string; name: string }) {
  if (app.nameKey && te(app.nameKey)) return t(app.nameKey);
  return app.name;
}

/** Rail labels: truncate with two dots (not CSS …). */
const RAIL_LABEL_MAX_CHARS = 5;

function railTruncate(text: string): string {
  const value = String(text || '').trim();
  if (value.length <= RAIL_LABEL_MAX_CHARS) return value;
  return `${value.slice(0, RAIL_LABEL_MAX_CHARS)}..`;
}

const props = defineProps<{
  sidebarStructure: SidebarStructure;
  /** @deprecated Sidebar is always the icon rail. */
  collapsed?: boolean;
  embedded?: boolean;
  /** @deprecated Expand/collapse removed. */
  onToggleCollapse?: () => void;
}>();

const route = useRoute();
const { branding, loadBranding } = usePortalBranding();
const isPortalRoute = computed(() => {
  const path = String(route.path || '');
  if (isPortalAuthLifecycleRoute(path)) return false;
  return path.startsWith('/portal/');
});
const { openTab } = useTabs();
const { lastActiveAppId, dockedAppId: persistedDockedAppId } = useSidebarState();

const hoverAppId = ref<string | null>(null);
const appAnchors = ref<Record<string, HTMLElement | null>>({});
/** Kept through leave animation so collapse matches open width transition. */
const drawerApp = ref<AppFlyoutDefinition | null>(null);
const drawerShown = ref(false);
const isMobileViewport = ref(
  typeof window !== 'undefined' ? !window.matchMedia(DESKTOP_SIDEBAR_MQ).matches : false
);
let hoverOpenTimer: ReturnType<typeof setTimeout> | null = null;
let hoverCloseTimer: ReturnType<typeof setTimeout> | null = null;
let desktopSidebarMql: MediaQueryList | null = null;

const dockedAppId = computed({
  get: () => persistedDockedAppId.value || null,
  set: (value: string | null) => {
    persistedDockedAppId.value = value || '';
  },
});

const applicationPeers = computed(() => props.sidebarStructure.applications || []);

function resolveRouteOwningAppId(): string | null {
  const owning = applicationPeers.value.find((peer) => appOwnsPath(peer, route.path));
  return owning?.id ?? null;
}

/** Mobile: always pin an app; Core when no app/module owns the route. */
function defaultMobilePinAppId(): string | null {
  return (
    resolveRouteOwningAppId() ??
    (applicationPeers.value.some((a) => a.id === CORE_APP_ID) ? CORE_APP_ID : null) ??
    applicationPeers.value[0]?.id ??
    null
  );
}

function ensureMobileAppPinned() {
  if (!isMobileViewport.value) return;

  const owning = resolveRouteOwningAppId();
  if (owning && dockedAppId.value !== owning) {
    openDrawer(owning);
    return;
  }

  if (dockedAppId.value && drawerShown.value) return;

  const fallback = defaultMobilePinAppId();
  if (fallback) openDrawer(fallback);
}

function onDesktopSidebarMqChange(event: MediaQueryListEvent) {
  isMobileViewport.value = !event.matches;
}

function isFlyoutSuppressed(appId: string): boolean {
  // Only suppress hover peek when this app's drawer is pinned/docked.
  // Route-active apps (e.g. Core on Quotes) must still open the flyout on hover when unpinned.
  if (dockedAppId.value === appId) return true;
  if (appId === WORKSPACE_MORE_ID) return isWorkspaceMoreActive.value;
  return false;
}

function isAppChromeOpen(appId: string): boolean {
  return dockedAppId.value === appId || hoverAppId.value === appId;
}

function isFlyoutOpen(appId: string): boolean {
  return hoverAppId.value === appId && !isFlyoutSuppressed(appId);
}

function syncChromeWidth() {
  dispatchSidebarChromeChange(Boolean(dockedAppId.value));
}

function setAppAnchor(appId: string, el: unknown) {
  const node = el as HTMLElement | null;
  if (appAnchors.value[appId] === node) return;
  appAnchors.value = { ...appAnchors.value, [appId]: node };
}

const sidebarLogoUrl = computed(() => {
  if (isPortalRoute.value && branding.value?.logoUrl) {
    return branding.value.logoUrl;
  }
  return logoLightUrl;
});

const portalSidebarStyle = computed(() => {
  if (!isPortalRoute.value) return undefined;
  return { backgroundColor: branding.value?.primaryColor || PORTAL_DEFAULT_PRIMARY_COLOR };
});

watch(isPortalRoute, (active) => {
  if (active) void loadBranding();
}, { immediate: true });

const iconColors = computed(() => {
  if (effectiveDark.value) {
    return {
      primary: 'rgba(255, 255, 255, 0.72)',
      secondary: 'rgba(255, 255, 255, 0.52)',
      tertiary: 'rgba(255, 255, 255, 0.36)',
      active: '#a78bfa',
      /** Glyph on white active tile */
      onActiveTile: '#3730a3',
      chevron: 'rgba(255, 255, 255, 0.52)',
    };
  }
  return {
    primary: 'rgba(255, 255, 255, 0.88)',
    secondary: 'rgba(255, 255, 255, 0.68)',
    tertiary: 'rgba(255, 255, 255, 0.48)',
    active: '#ffffff',
    onActiveTile: '#312e81',
    chevron: 'rgba(255, 255, 255, 0.68)',
  };
});

function railIconFill(active: boolean): string {
  return active ? iconColors.value.onActiveTile : iconColors.value.primary;
}

const settingsIcon = computed(() => wrapHeroIcon(Cog6ToothIcon));
const moreIcon = computed(() => wrapHeroIcon(EllipsisHorizontalIcon));

function clearHoverTimers() {
  if (hoverOpenTimer) {
    clearTimeout(hoverOpenTimer);
    hoverOpenTimer = null;
  }
  if (hoverCloseTimer) {
    clearTimeout(hoverCloseTimer);
    hoverCloseTimer = null;
  }
}

function onAppHoverEnter(appId: string) {
  if (isFlyoutSuppressed(appId)) {
    clearHoverTimers();
    hoverAppId.value = null;
    return;
  }
  clearHoverTimers();
  hoverOpenTimer = setTimeout(() => {
    hoverAppId.value = appId;
  }, HOVER_OPEN_MS);
}

function onAppHoverLeave() {
  clearHoverTimers();
  hoverCloseTimer = setTimeout(() => {
    hoverAppId.value = null;
  }, HOVER_CLOSE_MS);
}

function onFlyoutEnter() {
  clearHoverTimers();
}

function resolveDockedApp(appId: string): AppFlyoutDefinition | null {
  if (appId === WORKSPACE_MORE_ID) return workspaceMoreApp.value;
  return applicationPeers.value.find((a) => a.id === appId) || null;
}

function openDrawer(appId: string) {
  const app = resolveDockedApp(appId);
  if (!app) return;
  dockedAppId.value = appId;
  drawerApp.value = app;
  drawerShown.value = true;
  if (appId !== WORKSPACE_MORE_ID) {
    lastActiveAppId.value = appId;
  }
  syncChromeWidth();
}

function collapseDrawer() {
  dockedAppId.value = null;
  drawerShown.value = false;
  syncChromeWidth();
  // Mobile must keep one app pinned — re-pin Core (or route-owning app).
  ensureMobileAppPinned();
}

function onDrawerAfterLeave() {
  if (!drawerShown.value) {
    drawerApp.value = null;
  }
}

function onAppClick(appId: string) {
  clearHoverTimers();
  hoverAppId.value = null;
  if (dockedAppId.value === appId) {
    // Mobile: collapsing an application peer would leave the rail empty — keep pin.
    if (isMobileViewport.value && appId !== WORKSPACE_MORE_ID) return;
    collapseDrawer();
    return;
  }
  openDrawer(appId);
}

function onDocumentPointerDown(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  if (target.closest?.('.sidebar-chrome') || target.closest?.('.app-flyout')) return;
  clearHoverTimers();
  hoverAppId.value = null;
}

function pathMatches(pathname: string, routePath: string): boolean {
  const path = String(pathname || '');
  const base = String(routePath || '').replace(/\/+$/, '');
  if (!base) return false;
  return path === base || path.startsWith(base + '/');
}

function appOwnsPath(app: AppFlyoutDefinition, pathname: string): boolean {
  if (app.dashboardRoute && pathMatches(pathname, app.dashboardRoute)) return true;
  return app.items.some((item) => pathMatches(pathname, item.route));
}

function isWorkspaceShellRouteActive(): boolean {
  return shellNavItems.value.some((item) => isActiveRoute(item.route));
}

function isAppRailActive(appId: string): boolean {
  const app = applicationPeers.value.find((a) => a.id === appId);
  const ownsRoute = Boolean(app && appOwnsPath(app, route.path));

  // Route-owning app (e.g. opened via flyout) always gets the solid active tile.
  if (ownsRoute) return true;

  // Docked app without route ownership: soft open/hover only when something else is solid-active.
  if (dockedAppId.value === appId) {
    if (isWorkspaceShellRouteActive()) return false;
    const otherAppOwnsRoute = applicationPeers.value.some(
      (peer) => peer.id !== appId && appOwnsPath(peer, route.path)
    );
    if (otherAppOwnsRoute) return false;
    return true;
  }

  return false;
}

function onFlyoutNavigate(payload: { item: SidebarItem; event?: MouseEvent }) {
  const { item, event } = payload;
  const appId = hoverAppId.value;
  clearHoverTimers();
  hoverAppId.value = null;
  if (appId && appId !== WORKSPACE_MORE_ID) {
    lastActiveAppId.value = appId;
  }
  handleNavClick(item.route, item, event, {
    isAppContext: Boolean(appId && appId !== WORKSPACE_MORE_ID),
    icon: item.icon,
  });
}

function onDrawerNavigate(payload: { item: SidebarItem; event?: MouseEvent }) {
  const { item, event } = payload;
  const appId = dockedAppId.value;
  handleNavClick(item.route, item, event, {
    isAppContext: Boolean(appId && appId !== WORKSPACE_MORE_ID),
    icon: item.icon,
  });
}

function openHelp() {
  if (typeof window === 'undefined') return;
  const helpDocsUrl = String(import.meta.env.VITE_HELP_DOCS_URL || '').trim();
  if (helpDocsUrl) {
    window.open(helpDocsUrl, '_blank', 'noopener,noreferrer');
  }
}

function navItemStateClasses(routePath: string): string {
  if (!isActiveRoute(routePath)) return '';
  return 'sidebar-nav-item--active';
}

onMounted(() => {
  syncChromeWidth();
  document.addEventListener('mousedown', onDocumentPointerDown, true);
  if (typeof window !== 'undefined') {
    desktopSidebarMql = window.matchMedia(DESKTOP_SIDEBAR_MQ);
    isMobileViewport.value = !desktopSidebarMql.matches;
    desktopSidebarMql.addEventListener('change', onDesktopSidebarMqChange);
    ensureMobileAppPinned();
  }
});

onUnmounted(() => {
  clearHoverTimers();
  document.removeEventListener('mousedown', onDocumentPointerDown, true);
  desktopSidebarMql?.removeEventListener('change', onDesktopSidebarMqChange);
  desktopSidebarMql = null;
});

function defineFigmaIcon(viewBox: string, d: string) {
  return {
    name: 'FigmaIcon',
    props: {
      fill: { type: String, default: '#070922' },
      class: { type: String, default: '' },
    },
    setup(iconProps: { fill: string; class?: string }) {
      return () =>
        h(
          'svg',
          {
            viewBox,
            fill: 'none',
            xmlns: 'http://www.w3.org/2000/svg',
            width: '100%',
            height: '100%',
            preserveAspectRatio: 'xMidYMid meet',
            style: { display: 'block', flexShrink: 0 },
            class: iconProps.class,
          },
          [h('path', { d, fill: iconProps.fill })]
        );
    },
  };
}

const FigmaSearchIcon = defineFigmaIcon(
  '0 0 12.7987 12.7987',
  'M9.6 5.2C9.6 4.62218 9.48619 4.05003 9.26507 3.51619C9.04395 2.98236 8.71985 2.49731 8.31127 2.08873C7.90269 1.68015 7.41764 1.35605 6.88381 1.13493C6.34997 0.913809 5.77782 0.8 5.2 0.8C4.62218 0.8 4.05003 0.913809 3.51619 1.13493C2.98236 1.35605 2.49731 1.68015 2.08873 2.08873C1.68015 2.49731 1.35605 2.98236 1.13493 3.51619C0.913809 4.05003 0.8 4.62218 0.8 5.2C0.8 5.77782 0.913809 6.34997 1.13493 6.88381C1.35605 7.41764 1.68015 7.90269 2.08873 8.31127C2.49731 8.71985 2.98236 9.04395 3.51619 9.26507C4.05003 9.48619 4.62218 9.6 5.2 9.6C5.77782 9.6 6.34997 9.48619 6.88381 9.26507C7.41764 9.04395 7.90269 8.71985 8.31127 8.31127C8.71985 7.90269 9.04395 9.26507 9.26507 6.88381C9.48619 6.34997 9.6 5.77782 9.6 5.2ZM8.5825 9.15C7.675 9.93 6.4925 10.4 5.2 10.4C2.3275 10.4 0 8.0725 0 5.2C0 2.3275 2.3275 0 5.2 0C8.0725 0 10.4 2.3275 10.4 5.2C10.4 6.4925 9.93 7.675 9.15 8.5825L12.6825 12.1175C12.8375 12.2725 12.8375 12.5275 12.6825 12.6825C12.5275 12.8375 12.2725 12.8375 12.1175 12.6825L8.5825 9.15Z'
);

const FigmaHomeIcon = defineFigmaIcon(
  '0 0 14.401 12.7994',
  'M7.46551 0.099375C7.31551 -0.033125 7.08801 -0.033125 6.93551 0.099375L0.135513 6.09937C-0.0294869 6.24437 -0.0469869 6.49937 0.100513 6.66437C0.248013 6.82937 0.500513 6.84687 0.665513 6.69937L1.60051 5.87437V10.7994C1.60051 11.9044 2.49551 12.7994 3.60051 12.7994H10.8005C11.9055 12.7994 12.8005 11.9044 12.8005 10.7994V5.87437L13.7355 6.69937C13.9005 6.84437 14.153 6.82937 14.3005 6.66437C14.448 6.49937 14.4305 6.24687 14.2655 6.09937L7.46551 0.099375ZM2.40051 10.7994V5.16687L7.20051 0.931875L12.0005 5.16687V10.7994C12.0005 11.4619 11.463 11.9994 10.8005 11.9994H9.20051V7.99937C9.20051 7.55687 8.84301 7.19937 8.40051 7.19937H6.00051C5.55801 7.19937 5.20051 7.55687 5.20051 7.99937V11.9994H3.60051C2.93801 11.9994 2.40051 11.4619 2.40051 10.7994ZM6.00051 11.9994V7.99937H8.40051V11.9994H6.00051Z'
);

const FigmaInboxIcon = defineFigmaIcon(
  '0 0 12.8 11.2',
  'M0.8 9.6V7.3975C0.8 7.3325 0.8075 7.2675 0.825 7.2025V7.2H3.3525L3.9325 8.3575C4.0675 8.6275 4.345 8.8 4.6475 8.8H8.1525C8.455 8.8 8.7325 8.63 8.8675 8.3575L9.4475 7.2H11.975V7.2025C11.99 7.265 12 7.33 12 7.3975V9.6C12 10.0425 11.6425 10.4 11.2 10.4H1.6C1.1575 10.4 0.8 10.0425 0.8 9.6ZM11.775 6.4H9.4475C9.145 6.4 8.8675 6.57 8.7325 6.8425L8.1525 8H4.6475L4.0675 6.8425C3.9325 6.5725 3.655 6.4 3.3525 6.4H1.025L2.2725 1.405C2.3625 1.05 2.6825 0.8 3.05 0.8H9.75C10.1175 0.8 10.4375 1.05 10.525 1.405L11.775 6.4ZM0 7.3975V9.6C0 10.4825 0.7175 11.2 1.6 11.2H11.2C12.0825 11.2 12.8 10.4825 12.8 9.6V7.3975C12.8 7.2675 12.785 7.1375 12.7525 7.01L11.3025 1.2125C11.125 0.5 10.485 0 9.75 0H3.05C2.315 0 1.675 0.5 1.4975 1.2125L0.0475 7.01C0.015 7.135 0 7.265 0 7.3975Z'
);

const FigmaPeopleIcon = defineFigmaIcon(
  '0 0 11.2 12.8',
  'M5.6 0.8C5.91517 0.8 6.22726 0.862078 6.51844 0.982689C6.80962 1.1033 7.0742 1.28008 7.29706 1.50294C7.51992 1.7258 7.6967 1.99038 7.81731 2.28156C7.93792 2.57274 8 2.88483 8 3.2C8 3.51517 7.93792 3.82726 7.81731 4.11844C7.6967 4.40962 7.51992 4.67419 7.29706 4.89706C7.0742 5.11992 6.80962 5.2967 6.51844 5.41731C6.22726 5.53792 5.91517 5.6 5.6 5.6C5.28483 5.6 4.97274 5.53792 4.68156 5.41731C4.39038 5.2967 4.1258 5.11992 3.90294 4.89706C3.68008 4.67419 3.5033 4.40962 3.38269 4.11844C3.26208 3.82726 3.2 3.51517 3.2 3.2C3.2 2.88483 3.26208 2.57274 3.38269 2.28156C3.5033 1.99038 3.68008 1.7258 3.90294 1.50294C4.1258 1.28008 4.39038 1.1033 4.68156 0.982689C4.97274 0.862078 5.28483 0.8 5.6 0.8ZM2.4 3.2C2.4 4.04869 2.73714 4.86262 3.33726 5.46274C3.93737 6.06286 4.75131 6.4 5.6 6.4C6.44869 6.4 7.26263 6.06286 7.86274 5.46274C8.46286 4.86262 8.8 4.04869 8.8 3.2C8.8 2.35131 8.46286 1.53737 7.86274 0.937258C7.26263 0.337142 6.44869 0 5.6 0C4.75131 0 3.93737 0.337142 3.33726 0.937258C2.73714 1.53737 2.4 2.35131 2.4 3.2ZM4.8 7.6C4.58 7.6 4.4 7.78 4.4 8C4.4 8.22 4.58 8.4 4.8 8.4H5.045L4.5025 10.025L3.7 8.2875C3.6275 8.13 3.4625 8.0375 3.2925 8.0675C1.42 8.4125 0 10.0575 0 12.0325C0 12.4575 0.345 12.8 0.7675 12.8H10.4325C10.8575 12.8 11.2 12.455 11.2 12.0325C11.2 10.0575 9.78 8.415 7.905 8.0675C7.735 8.035 7.57 8.13 7.4975 8.2875L6.6975 10.025L6.155 8.4H6.4C6.62 8.4 6.8 8.22 6.8 8C6.8 7.78 6.62 7.6 6.4 7.6H5.6H4.8ZM5.2375 11.6125L4.995 11.085L5.6 9.265L6.2075 11.085L5.965 11.6125C5.8225 11.9225 5.3825 11.9225 5.2375 11.6125ZM4.51 11.9475C4.5175 11.965 4.5275 11.9825 4.535 12H0.8C0.815 10.5475 1.7875 9.3225 3.1175 8.93L4.51 11.9475ZM10.4 12H6.665C6.6725 11.9825 6.6825 11.965 6.69 11.9475L8.0825 8.93C9.4125 9.3225 10.385 10.545 10.4 12Z'
);

const FigmaSackDollarIcon = defineFigmaIcon(
  '0 0 12.8 12.8',
  'M5.0375 3.6H7.7625L7.895 3.685C9.265 4.5625 12 6.7075 12 10.4C12 11.2825 11.2825 12 10.4 12H2.4C1.5175 12 0.8 11.2825 0.8 10.4C0.8 6.7075 3.535 4.5625 4.9075 3.685L5.04 3.6H5.0375ZM7.4975 2.8H5.3025L5.135 2.555L3.9225 0.8H8.8775L7.6675 2.555L7.5 2.8H7.4975ZM3.815 3.4625C2.28 4.5925 0 6.835 0 10.4C0 11.725 1.075 12.8 2.4 12.8H10.4C11.725 12.8 12.8 11.725 12.8 10.4C12.8 6.835 10.52 4.5925 8.985 3.4625C8.7425 3.285 8.52 3.1325 8.325 3.01L8.78 2.35L9.7525 0.94C10.025 0.5425 9.74 0 9.2575 0H3.5425C3.06 0 2.775 0.5425 3.0475 0.94L4.02 2.35L4.475 3.01C4.2825 3.1325 4.0575 3.285 3.815 3.4625ZM6.8 5.4C6.8 5.18 6.62 5 6.4 5C6.18 5 6 5.18 6 5.4V5.8325C5.7925 5.87 5.5825 5.94 5.3975 6.05C5.0725 6.2425 4.8 6.5775 4.8025 7.0625C4.805 7.5225 5.0725 7.815 5.37 7.995C5.6325 8.1525 5.965 8.255 6.24 8.3375L6.28 8.35C6.5925 8.445 6.835 8.5225 7.005 8.63C7.1525 8.7225 7.1975 8.805 7.1975 8.92C7.2 9.085 7.13 9.19 7.0025 9.27C6.8575 9.36 6.64 9.41 6.41 9.4025C6.115 9.3925 5.8425 9.3 5.5025 9.185C5.445 9.165 5.385 9.145 5.325 9.125C5.115 9.055 4.89 9.1675 4.82 9.3775C4.75 9.5875 4.8625 9.8125 5.0725 9.8825C5.1225 9.9 5.175 9.9175 5.2275 9.935C5.4575 10.015 5.72 10.105 6 10.1575V10.6C6 10.82 6.18 11 6.4 11C6.62 11 6.8 10.82 6.8 10.6V10.1725C7.0175 10.1375 7.235 10.065 7.4275 9.945C7.76 9.7375 8.0075 9.39 8 8.905C7.995 8.4425 7.735 8.14 7.4325 7.95C7.1575 7.7775 6.8075 7.67 6.525 7.585L6.5125 7.5825C6.1975 7.4875 5.955 7.4125 5.7825 7.31C5.6325 7.22 5.6025 7.15 5.6 7.0575C5.6 6.9225 5.66 6.8225 5.8025 6.7375C5.9575 6.645 6.18 6.595 6.3925 6.6C6.645 6.605 6.9175 6.6575 7.195 6.7325C7.4075 6.79 7.6275 6.6625 7.685 6.45C7.7425 6.2375 7.615 6.0175 7.4025 5.96C7.215 5.91 7.0125 5.8625 6.8 5.8325V5.4Z'
);

const FigmaGridIcon = defineFigmaIcon(
  '0 0 11.2 11.2',
  'M1.2 0.8C0.98 0.8 0.8 0.98 0.8 1.2V3.6C0.8 3.82 0.98 4 1.2 4H3.6C3.82 4 4 3.82 4 3.6V1.2C4 0.98 3.82 0.8 3.6 0.8H1.2ZM0 1.2C0 0.5375 0.5375 0 1.2 0H3.6C4.2625 0 4.8 0.5375 4.8 1.2V3.6C4.8 4.2625 4.2625 4.8 3.6 4.8H1.2C0.5375 4.8 0 4.2625 0 3.6V1.2ZM1.2 7.2C0.98 7.2 0.8 7.38 0.8 7.6V10C0.8 10.22 0.98 10.4 1.2 10.4H3.6C3.82 10.4 4 10.22 4 10V7.6C4 7.38 3.82 7.2 3.6 7.2H1.2ZM0 7.6C0 6.9375 0.5375 6.4 1.2 6.4H3.6C4.2625 6.4 4.8 6.9375 4.8 7.6V10C4.8 10.6625 4.2625 11.2 3.6 11.2H1.2C0.5375 11.2 0 10.6625 0 10V7.6ZM10 0.8H7.6C7.38 0.8 7.2 0.98 7.2 1.2V3.6C7.2 3.82 7.38 4 7.6 4H10C10.22 4 10.4 3.82 10.4 3.6V1.2C10.4 0.98 10.22 0.8 10 0.8ZM7.6 0H10C10.6625 0 11.2 0.5375 11.2 1.2V3.6C11.2 4.2625 10.6625 4.8 10 4.8H7.6C6.9375 4.8 6.4 4.2625 6.4 3.6V1.2C6.4 0.5375 6.9375 0 7.6 0ZM7.6 7.2C7.38 7.2 7.2 7.38 7.2 7.6V10C7.2 10.22 7.38 10.4 7.6 10.4H10C10.22 10.4 10.4 10.22 10.4 10V7.6C10.4 7.38 10.22 7.2 10 7.2H7.6ZM6.4 7.6C6.4 6.9375 6.9375 6.4 7.6 6.4H10C10.6625 6.4 11.2 6.9375 11.2 7.6V10C11.2 10.6625 10.6625 11.2 10 11.2H7.6C6.9375 11.2 6.4 10.6625 6.4 10V7.6Z'
);

const FigmaBriefcaseIcon = defineFigmaIcon(
  '0 0 12.8 12',
  'M4 1.2V2.4H8.8V1.2C8.8 0.98 8.62 0.8 8.4 0.8H4.4C4.18 0.8 4 0.98 4 1.2ZM3.2 2.4V1.2C3.2 0.5375 3.7375 0 4.4 0H8.4C9.0625 0 9.6 0.5375 9.6 1.2V2.4H11.2C12.0825 2.4 12.8 3.1175 12.8 4V10.4C12.8 11.2825 12.0825 12 11.2 12H1.6C0.7175 12 0 11.2825 0 10.4V4C0 3.1175 0.7175 2.4 1.6 2.4H3.2ZM9.2 3.2H3.6H1.6C1.1575 3.2 0.8 3.5575 0.8 4V6.4H4.4H5.2H7.6H8.4H12V4C12 3.5575 11.6425 3.2 11.2 3.2H9.2ZM12 7.2H8.4V8.4C8.4 8.8425 8.0425 9.2 7.6 9.2H5.2C4.7575 9.2 4.4 8.8425 4.4 8.4V7.2H0.8V10.4C0.8 10.8425 1.1575 11.2 1.6 11.2H11.2C11.6425 11.2 12 10.8425 12 10.4V7.2ZM5.2 7.2V8.4H7.6V7.2H5.2Z'
);

const FigmaInfoIcon = defineFigmaIcon(
  '0 0 12.8 12.8',
  'M6.4 0.8C7.88521 0.8 9.30959 1.39 10.3598 2.4402C11.41 3.49041 12 4.91479 12 6.4C12 7.88521 11.41 9.30959 10.3598 10.3598C9.30959 11.41 7.88521 12 6.4 12C4.91479 12 3.49041 11.41 2.4402 10.3598C1.39 9.30959 0.8 7.88521 0.8 6.4C0.8 4.91479 1.39 3.49041 2.4402 2.4402C3.49041 1.39 4.91479 0.8 6.4 0.8ZM6.4 12.8C8.09738 12.8 9.72525 12.1257 10.9255 10.9255C12.1257 9.72525 12.8 8.09738 12.8 6.4C12.8 4.70261 12.1257 3.07475 10.9255 1.87452C9.72525 0.674284 8.09738 0 6.4 0C4.70261 0 3.07475 0.674284 1.87452 1.87452C0.674284 3.07475 0 4.70261 0 6.4C0 8.09738 0.674284 9.72525 1.87452 10.9255C3.07475 12.1257 4.70261 12.8 6.4 12.8ZM5.2 8.8C4.98 8.8 4.8 8.98 4.8 9.2C4.8 9.42 4.98 9.6 5.2 9.6H7.6C7.82 9.6 8 9.42 8 9.2C8 8.98 7.82 8.8 7.6 8.8H6.8V6C6.8 5.78 6.62 5.6 6.4 5.6H5.4C5.18 5.6 5 5.78 5 6C5 6.22 5.18 6.4 5.4 6.4H6V8.8H5.2ZM6.4 4.6C6.55913 4.6 6.71174 4.53679 6.82426 4.42426C6.93678 4.31174 7 4.15913 7 4C7 3.84087 6.93678 3.68826 6.82426 3.57574C6.71174 3.46321 6.55913 3.4 6.4 3.4C6.24087 3.4 6.08826 3.46321 5.97574 3.57574C5.86321 3.68826 5.8 3.84087 5.8 4C5.8 4.15913 5.86321 4.31174 5.97574 4.42426C6.08826 4.53679 6.24087 4.6 6.4 4.6Z'
);

function wrapHeroIcon(hero: unknown) {
  return {
    name: 'HeroIconWrapper',
    props: { fill: { type: String, default: '#070922' } },
    setup(iconProps: { fill: string }) {
      return () => h(hero as object, { style: { color: iconProps.fill } });
    },
  };
}

const AstraSidebarIcon = {
  name: 'AstraSidebarIcon',
  props: { fill: { type: String, default: '#ffffff' } },
  setup(iconProps: { fill: string }, { attrs }: { attrs: Record<string, unknown> }) {
    return () => {
      const fill = String(iconProps.fill || '');
      const onWhiteTile =
        fill === '#312e81' ||
        fill === '#3730a3' ||
        (fill.length > 0 && !fill.includes('255') && !fill.startsWith('rgba(255'));
      return h('img', {
        ...attrs,
        src: onWhiteTile
          ? '/assets/logo/Ai%20Logo.svg'
          : '/assets/logo/Ai%20Logo%20White.svg',
        alt: '',
        'aria-hidden': 'true',
        class: ['object-contain', attrs?.class],
      });
    };
  },
};

function getFigmaNavIcon(item: SidebarItem | { kind?: string; id?: string; moduleKey?: string; route?: string; label?: string; icon?: string }) {
  if (item?.kind === 'surface') {
    if (item.id === 'home') return FigmaHomeIcon;
    if (item.id === 'inbox') return FigmaInboxIcon;
    if (item.id === 'astra') return AstraSidebarIcon;
    if (item.id === 'live-chat') return wrapHeroIcon(ChatBubbleLeftRightIcon);
    if (item.id === 'attention') return wrapHeroIcon(ExclamationTriangleIcon);
  }
  if (item?.kind === 'coreModule') {
    const moduleKey = String(('moduleKey' in item && item.moduleKey) || item.id || '').toLowerCase();
    if (moduleKey === 'people') return FigmaPeopleIcon;
    return wrapHeroIcon(getNavigationIconComponent(item));
  }
  if (item?.kind === 'app') {
    const routePath = String(item.route || '').toLowerCase();
    const label = String(item.label || '').toLowerCase();
    const rawId = String(item.id || '');

    if (routePath.startsWith('/portal/dashboard')) return FigmaHomeIcon;
    if (routePath.startsWith('/portal/cases')) return wrapHeroIcon(LifebuoyIcon);
    if (routePath.startsWith('/portal/invoices')) return wrapHeroIcon(BanknotesIcon);
    if (routePath.startsWith('/portal/documents')) return wrapHeroIcon(DocumentTextIcon);
    if (routePath.startsWith('/portal/knowledge')) return wrapHeroIcon(BookOpenIcon);

    if (!('moduleKey' in item && item.moduleKey) && label === 'dashboard') {
      if (routePath.startsWith('/audit/') || rawId.toUpperCase() === 'AUDIT') {
        return wrapHeroIcon(PresentationChartLineIcon);
      }
      if (
        routePath.startsWith('/sales/')
        || routePath.startsWith('/dashboard/sales')
        || rawId.toUpperCase() === 'SALES'
      ) {
        return wrapHeroIcon(DocumentChartBarIcon);
      }
      return FigmaGridIcon;
    }

    if (label.includes('deal')) return FigmaBriefcaseIcon;
  }

  return wrapHeroIcon(getNavigationIconComponent(item));
}

function getAppIcon(app: { id: string; icon?: string; name?: string }) {
  const appId = (app.id || '').toLowerCase();
  if (appId === 'core') return wrapHeroIcon(Squares2X2Icon);
  if (appId.includes('helpdesk')) return wrapHeroIcon(LifebuoyIcon);
  if (appId.includes('audit')) return wrapHeroIcon(ShieldCheckIcon);
  if (appId === 'lms' || appId.includes('learning')) return wrapHeroIcon(AcademicCapIcon);
  if (app.icon) {
    return wrapHeroIcon(getIconComponent(app.icon));
  }
  if (appId.includes('sales')) return FigmaSackDollarIcon;
  if (appId.includes('project')) return FigmaGridIcon;
  return wrapHeroIcon(getNavigationIconComponent({}));
}

function isActiveRoute(routePath: string): boolean {
  return route.path === routePath || route.path.startsWith(routePath + '/');
}

const searchSurface = computed(() => {
  return props.sidebarStructure.shell.find((i) => i.kind === 'surface' && i.id === 'search');
});

const PORTAL_HIDDEN_SHELL_IDS = new Set(['home', 'inbox', 'approvals', 'attention']);

const shellNavItems = computed(() => {
  let items = props.sidebarStructure.shell.filter((i) => !(i.kind === 'surface' && i.id === 'search'));
  if (isPortalRoute.value) {
    items = items.filter((i) => !PORTAL_HIDDEN_SHELL_IDS.has(i.id));
  }
  return items;
});

const primaryShellItems = computed(() => shellNavItems.value.slice(0, WORKSPACE_PRIMARY_COUNT));

const moreShellItems = computed(() => shellNavItems.value.slice(WORKSPACE_PRIMARY_COUNT));

const workspaceMoreApp = computed<AppFlyoutDefinition | null>(() => {
  if (moreShellItems.value.length === 0) return null;
  return {
    id: WORKSPACE_MORE_ID,
    name: 'More',
    nameKey: 'navigation.more',
    icon: 'ellipsis-horizontal',
    items: moreShellItems.value,
  };
});

function restoreDockedDrawer() {
  const id = persistedDockedAppId.value;
  if (!id || drawerShown.value) return;
  const app = resolveDockedApp(id);
  if (!app) {
    dockedAppId.value = null;
    syncChromeWidth();
    ensureMobileAppPinned();
    return;
  }
  drawerApp.value = app;
  drawerShown.value = true;
  syncChromeWidth();
}

watch(
  [applicationPeers, workspaceMoreApp],
  () => {
    restoreDockedDrawer();
    ensureMobileAppPinned();
  },
  { immediate: true }
);

watch(
  [() => route.path, isMobileViewport],
  () => {
    ensureMobileAppPinned();
  }
);

const isWorkspaceMoreActive = computed(() => {
  const moreOwnsRoute = moreShellItems.value.some((item) => isActiveRoute(item.route));
  if (moreOwnsRoute) return true;

  if (dockedAppId.value === WORKSPACE_MORE_ID) {
    if (isWorkspaceShellRouteActive()) return false;
    const otherAppOwnsRoute = applicationPeers.value.some((peer) =>
      appOwnsPath(peer, route.path)
    );
    if (otherAppOwnsRoute) return false;
    return true;
  }

  return false;
});

function handleNavClick(
  routePath: string,
  navItem: { labelKey?: string; label?: string },
  event?: MouseEvent,
  opts: { isAppContext?: boolean; icon?: string } = {}
): void {
  if (routePath === '/search') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('arivu:open-global-search'));
    }
    return;
  }

  if (opts.isAppContext && dockedAppId.value && dockedAppId.value !== WORKSPACE_MORE_ID) {
    lastActiveAppId.value = dockedAppId.value;
  }

  const openInBackground =
    !!event &&
    (event.button === 1 ||
      (event as MouseEvent & { metaKey?: boolean; ctrlKey?: boolean }).metaKey === true ||
      (event as MouseEvent & { metaKey?: boolean; ctrlKey?: boolean }).ctrlKey === true);

  openTab(routePath, {
    titleKey: navItem.labelKey,
    title: navLabel(navItem),
    icon: opts.icon,
    background: openInBackground,
  });
}
</script>

<style scoped>
.module-drawer-slot {
  background-color: #ffffff;
  box-sizing: border-box;
}

.module-drawer-slot--fixed {
  width: 12.5rem;
  flex-shrink: 0;
  overflow: hidden;
}

.module-drawer-slot--fill {
  flex: 1 1 0%;
  min-width: 0;
  width: auto;
  overflow: hidden;
}

:global(html.dark) .module-drawer-slot {
  background-color: rgb(23 23 23);
}

.module-drawer-enter-active,
.module-drawer-leave-active {
  transition: width 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.module-drawer-slot--fixed.module-drawer-enter-from,
.module-drawer-slot--fixed.module-drawer-leave-to {
  width: 0;
}

.sidebar-nav {
  font-size: clamp(0.625rem, 0.75rem, 0.875rem);
}

.sidebar-nav svg {
  display: block;
  width: 100%;
  height: 100%;
  flex-shrink: 0;
  overflow: visible;
}

.sidebar-rail-item {
  position: relative;
  background: transparent;
}

.sidebar-rail-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  flex-shrink: 0;
  transition: background-color 150ms ease;
}

.sidebar-rail-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.sidebar-rail-label {
  display: block;
  width: 100%;
  max-width: 3.25rem;
  padding: 0 0.125rem;
  font-size: 0.625rem;
  line-height: 1.15;
  text-align: center;
  overflow: hidden;
  white-space: nowrap;
}

/* Hover / open: soft tint on icon tile only */
.sidebar-rail-item:hover .sidebar-rail-icon,
.sidebar-rail-item.sidebar-app-peer--open:not(.sidebar-nav-item--active) .sidebar-rail-icon {
  background-color: rgb(255 255 255 / 0.14);
}

/* Active (current route): solid white tile */
.sidebar-rail-item.sidebar-nav-item--active .sidebar-rail-icon {
  background-color: #ffffff;
}
</style>

<style>
html.dark .sidebar-nav .sidebar-rail-item:hover .sidebar-rail-icon,
html.dark .sidebar-nav .sidebar-rail-item.sidebar-app-peer--open:not(.sidebar-nav-item--active) .sidebar-rail-icon {
  background-color: rgb(255 255 255 / 0.08);
}

html.dark .sidebar-nav .sidebar-rail-item.sidebar-nav-item--active .sidebar-rail-icon {
  background-color: #ffffff;
}
</style>
