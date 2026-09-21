<template>
  <!--
    ============================================================================
    Global Surfaces Provider
    ============================================================================
    
    ARCHITECTURE NOTE: This component centralizes all global UI surfaces.
    
    This component must be mounted once at the application root level.
    It owns the visibility state and keyboard shortcuts for all global surfaces
    that are available across the entire application.
    
    Responsibilities:
    - Owns global UI surfaces (GlobalSearch, CommandPalette, AstraCommandPalette, AstraSidePanel)
    - Owns their visibility state
    - Owns global keyboard shortcuts (Cmd/Ctrl+K, Cmd/Ctrl+/)
    - Owns global custom-event listeners
    
    This ensures consistent behavior across all layouts (PlatformShell, AuditLayout, etc.)
    and prevents duplicate keyboard listeners and state management.
    
    See: docs/architecture/command-palette-invariants.md (if exists)
    ============================================================================
  -->
  
  <!-- Global Search (authenticated app shell only — avoids auth API side effects on public pages) -->
  <GlobalSearch
    v-if="surfacesEnabled"
    :is-open="showGlobalSearch"
    :initial-mode="globalSearchInitialMode"
    @close="closeGlobalSearch"
    @open="openGlobalSearch"
  />
  
  <!-- Command Palette -->
  <!-- NOTE: Currently using GlobalSearch for command palette functionality -->
  <!-- GlobalSearch switches to command mode when user types '/' -->
  <!-- A separate CommandPalette component can be added here if needed in the future -->

  <template v-if="surfacesEnabled">
    <ConnectMailboxModal
      v-model="connectModalOpen"
      :reason="connectModalReason"
      :mailbox-kind="connectModalMailboxKind"
      :target-mailbox="connectModalTargetMailbox"
      @connected="onMailboxConnected"
    />
    <SmtpSetupWizard
      v-model="smtpWizardOpen"
      :mailbox-id="smtpWizardMailboxId"
      :initial-email="smtpWizardInitialEmail"
      :reason="smtpWizardReason"
      @connected="onSmtpWizardConnected"
    />

    <!--
      Gate Whats New / center with v-if (async + always-mounted prop churn → emitsOptions).
      Announcement hosts are static imports so v-if is safe (vuejs/core#3560).
    -->
    <WhatsNewModal
      v-if="whatsNewModalOpen"
      v-model="whatsNewModalOpen"
      :releases="unseenReleases"
    />
    <WhatsNewDrawer
      v-if="whatsNewDrawerOpen"
      v-model="whatsNewDrawerOpen"
      :releases="unseenReleases"
    />
    <ReleaseNotesCenter
      v-if="centerOpen"
      v-model="centerOpen"
    />
    <AstraCommandPalette v-if="aiSuiteEntitled" />
    <AstraSidePanel v-if="aiSuiteEntitled" />

    <SoftphoneDock v-if="telephonyEntitled" />
    <IncomingCallPopup v-if="telephonyEntitled" />
    <PostCallNotesModal v-if="telephonyEntitled" />

    <Teleport
      v-if="announcementBanner"
      to="#platform-announcement-banner-host"
      defer
    >
      <AnnouncementBannerHost :announcement="announcementBanner" />
    </Teleport>
    <AnnouncementPopoverHost
      v-if="announcementPopover"
      :announcement="announcementPopover"
    />
  </template>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
/**
 * GlobalSurfacesProvider
 *
 * Owns all global, cross-app UI surfaces:
 * - GlobalSearch
 * - CommandPalette
 * - AstraCommandPalette
 * - AstraSidePanel
 *
 * Rules:
 * - Must be mounted exactly once
 * - App layouts must NEVER own global surfaces
 * - App layouts trigger via custom events only
 *
 * Any deviation requires architecture review.
 */

import { computed, ref, onMounted, onBeforeUnmount, defineAsyncComponent, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { isAiSuiteEntitled } from '@/utils/aiSuiteEntitlement';
import { isTelephonyEntitled } from '@/composables/useTelephonyEntitlement';
import {
  isStandalonePublicRoute,
  isTrialExpiredShelllessRoute,
  isAuthLifecyclePublicRoute,
  isOnboardingShelllessRoute,
  isPortalAuthLifecycleRoute,
  isAcademySurfaceRoute,
} from '@/utils/standaloneRoutes';
import { useConnectMailboxPrompt } from '@/composables/useConnectMailboxPrompt';
import { useSmtpSetupWizard } from '@/composables/useSmtpSetupWizard';
import { useMailboxConnection } from '@/composables/useMailboxConnection';
import { useReleaseNotes } from '@/composables/useReleaseNotes';
import { useAnnouncements } from '@/composables/useAnnouncements';
import { useOnboarding } from '@/composables/useOnboarding';
import {
  startInternalChatStream,
  stopInternalChatStream,
} from '@/composables/useInternalChatStream';
import ConnectMailboxModal from '@/components/inbox/ConnectMailboxModal.vue';
import SmtpSetupWizard from '@/components/communications/SmtpSetupWizard.vue';
// Static: defineAsyncComponent + v-if races cause emitsOptions null (vuejs/core#3560).
import AnnouncementBannerHost from '@/components/announcements/AnnouncementBannerHost.vue';
import AnnouncementPopoverHost from '@/components/announcements/AnnouncementPopoverHost.vue';

const WhatsNewModal = defineAsyncComponent(() =>
  import('@/components/release-notes/WhatsNewModal.vue')
);
const WhatsNewDrawer = defineAsyncComponent(() =>
  import('@/components/release-notes/WhatsNewDrawer.vue')
);
const ReleaseNotesCenter = defineAsyncComponent(() =>
  import('@/components/release-notes/ReleaseNotesCenter.vue')
);
const AstraCommandPalette = defineAsyncComponent(() =>
  import('@/astra/surfaces/AstraCommandPalette.vue')
);
const AstraSidePanel = defineAsyncComponent(() =>
  import('@/astra/surfaces/AstraSidePanel.vue')
);
const SoftphoneDock = defineAsyncComponent(() =>
  import('@/components/telephony/SoftphoneDock.vue')
);
const IncomingCallPopup = defineAsyncComponent(() =>
  import('@/components/telephony/IncomingCallPopup.vue')
);
const PostCallNotesModal = defineAsyncComponent(() =>
  import('@/components/telephony/PostCallNotesModal.vue')
);

// Async so GlobalSearch (+ drawers, field engines, command registry, API client) is NOT in the
// same synchronous ESM pass as app.use(router) / root shell. A static import caused production
// ReferenceError: Cannot access 'G' before initialization inside defineComponent (TDZ / cycle).
const GlobalSearch = defineAsyncComponent(() => import('@/components/GlobalSearch.vue'));

const {
  connectModalOpen,
  connectModalReason,
  connectModalMailboxKind,
  connectModalTargetMailbox
} = useConnectMailboxPrompt();
const {
  smtpWizardOpen,
  smtpWizardMailboxId,
  smtpWizardInitialEmail,
  smtpWizardReason,
  smtpWizardOnConnected
} = useSmtpSetupWizard();
const { refreshMailboxes } = useMailboxConnection();
const authStore = useAuthStore();
const route = useRoute();
const surfacesEnabled = computed(() =>
  authStore.isAuthenticated
  && !isStandalonePublicRoute(route.path)
  && !isTrialExpiredShelllessRoute(route.path)
  && !isAuthLifecyclePublicRoute(route.path)
  // Founder wizard must not boot release notes / UI-metadata / mailboxes —
  // those 401s would wipe a brand-new post-accept session (demo activation).
  && !isOnboardingShelllessRoute(route.path)
  // Portal select / Academy: no CRM global surfaces (announcements race → emitsOptions).
  && !isPortalAuthLifecycleRoute(route.path)
  && !isAcademySurfaceRoute(route.path)
);
const aiSuiteEntitled = computed(() => isAiSuiteEntitled(authStore.user));
const telephonyEntitled = computed(() => isTelephonyEntitled(authStore.user));
const internalChatEntitled = computed(
  () => authStore.user?.entitledAddons?.internal_chat === true
);
const {
  unseenReleases,
  surface,
  whatsNewModalOpen,
  whatsNewDrawerOpen,
  centerOpen,
  initializeIfReady,
  refreshOnFocus,
  resetReleaseNotesState,
  retryAutoSurface,
  openCenter,
  maybeScheduleAutoSurface
} = useReleaseNotes();
const {
  banner: announcementBanner,
  popover: announcementPopover,
  initializeIfReady: initializeAnnouncementsIfReady,
  refreshActive: refreshAnnouncements,
  reset: resetAnnouncementsState,
} = useAnnouncements();
const { state: onboardingState } = useOnboarding();

function onMailboxConnected() {
  void refreshMailboxes();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('arivu:mailbox-connected'));
  }
}

function onSmtpWizardConnected(mailbox) {
  void refreshMailboxes();
  if (typeof smtpWizardOnConnected.value === 'function') {
    try {
      smtpWizardOnConnected.value(mailbox);
    } catch {
      /* ignore */
    }
  }
  smtpWizardOnConnected.value = null;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('arivu:mailbox-connected'));
  }
}

// Visibility state for global surfaces
const showGlobalSearch = ref(false);
const showCommandPalette = ref(false);
const globalSearchInitialMode = ref('search');

// Open/close handlers for GlobalSearch
const openGlobalSearch = () => {
  globalSearchInitialMode.value = 'search';
  showGlobalSearch.value = true;
};

const closeGlobalSearch = () => {
  showGlobalSearch.value = false;
};

// Open/close handlers for CommandPalette
const openCommandPalette = () => {
  showCommandPalette.value = true;
  globalSearchInitialMode.value = 'command';
  showGlobalSearch.value = true;
};

const closeCommandPalette = () => {
  showCommandPalette.value = false;
};

/**
 * When focus is inside a rich text editor (TipTap / ProseMirror) and the user has text selected,
 * Cmd/Ctrl+K should run the editor’s “insert link” behavior — not global search.
 * ProseMirror usually calls preventDefault(); we also check DOM selection + target as a fallback.
 */
function shouldDeferModKToRichText(event) {
  if (event.defaultPrevented) return true;
  const rawTarget = event.target;
  if (!(rawTarget instanceof Element)) return false;
  const target = rawTarget.nodeType === Node.TEXT_NODE ? rawTarget.parentElement : rawTarget;
  if (!target?.closest) return false;
  const inRichText =
    target.closest('[contenteditable="true"]') ||
    target.closest('.ProseMirror') ||
    target.closest('.tiptap');
  if (!inRichText) return false;
  try {
    const sel = document.getSelection?.();
    if (!sel || sel.rangeCount === 0) return false;
    return !sel.isCollapsed;
  } catch {
    return false;
  }
}

// Keyboard shortcut handlers
const handleGlobalSearchKeydown = (event) => {
  const isModK =
    (event.metaKey || event.ctrlKey) && String(event.key || '').toLowerCase() === 'k';
  if (!isModK) return;
  if (shouldDeferModKToRichText(event)) return;
  event.preventDefault();
  openGlobalSearch();
};

const handleCommandPaletteKeydown = (event) => {
  // Cmd/Ctrl + / to open command palette
  if ((event.metaKey || event.ctrlKey) && event.key === '/') {
    event.preventDefault();
    openCommandPalette();
  }
};

// Combined keyboard handler
const handleKeydown = (event) => {
  handleGlobalSearchKeydown(event);
  handleCommandPaletteKeydown(event);
};

// Custom event handlers
const handleOpenGlobalSearchEvent = () => {
  openGlobalSearch();
};

const handleOpenCommandPaletteEvent = () => {
  openCommandPalette();
};

const handleOpenWhatsNewEvent = () => {
  openCenter('help_menu');
};

const handleWindowFocus = () => {
  void refreshOnFocus();
  void refreshAnnouncements();
};

const handleVisibilityChange = () => {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    void refreshOnFocus();
  }
};

watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (!isAuthenticated) {
      resetReleaseNotesState();
      resetAnnouncementsState();
      return;
    }
    if (!surfacesEnabled.value) return;
    void initializeIfReady();
    void initializeAnnouncementsIfReady();
  },
  { immediate: true }
);

watch(
  surfacesEnabled,
  (enabled, wasEnabled) => {
    if (!enabled || wasEnabled) return;
    if (!authStore.isAuthenticated) return;
    void initializeIfReady();
    void initializeAnnouncementsIfReady();
  }
);

watch(
  () => route.path,
  (path, prev) => {
    if (!surfacesEnabled.value) return;
    if (authStore.isAuthenticated) {
      void refreshOnFocus();
    }
    if (prev?.startsWith('/onboarding') && !path.startsWith('/onboarding')) {
      void retryAutoSurface();
    }
  }
);

watch(
  () => onboardingState.value?.completedAt,
  (completedAt, prev) => {
    if (completedAt && !prev) {
      void retryAutoSurface();
    }
  }
);

watch(
  () => [unseenReleases.value.length, surface.value],
  () => {
    maybeScheduleAutoSurface();
  }
);

watch(
  [surfacesEnabled, internalChatEntitled],
  ([surfaces, entitled]) => {
    if (surfaces && entitled) {
      startInternalChatStream({
        getToken: () => authStore.user?.token,
      });
    } else {
      stopInternalChatStream();
    }
  },
  { immediate: true }
);

// Setup event listeners on mount
onMounted(() => {
  // Keyboard shortcuts
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('focus', handleWindowFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Custom events
  window.addEventListener('arivu:open-global-search', handleOpenGlobalSearchEvent);
  window.addEventListener('arivu:open-command-palette', handleOpenCommandPaletteEvent);
  window.addEventListener('arivu:open-whats-new', handleOpenWhatsNewEvent);
  window.addEventListener('arivu:open-release-notes-center', handleOpenWhatsNewEvent);
});

// Cleanup event listeners on unmount
onBeforeUnmount(() => {
  stopInternalChatStream();
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('focus', handleWindowFocus);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('arivu:open-global-search', handleOpenGlobalSearchEvent);
  window.removeEventListener('arivu:open-command-palette', handleOpenCommandPaletteEvent);
  window.removeEventListener('arivu:open-whats-new', handleOpenWhatsNewEvent);
  window.removeEventListener('arivu:open-release-notes-center', handleOpenWhatsNewEvent);
});
</script>
