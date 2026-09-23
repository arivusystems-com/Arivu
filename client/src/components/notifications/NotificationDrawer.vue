<!--
================================================================================
NOTIFICATIONS UX CONTRACT — DO NOT VIOLATE
================================================================================
This file enforces the Notifications UX & Architecture Hardening Contract.

Notifications are signals, not workflows.
Actions are assistive, not authoritative.

- Notifications surface awareness; they do not own domain state.
- No domain mutation without explicit backend APIs + design review.
- Snooze is temporary, UI-only (no backend persistence; no cross-device guarantees).
- Grouping is visual-only (never permanently hides or mutates data; no persisted UI state).

See `docs/architecture/notifications-hardening.md`.
================================================================================
-->

<template>
  <Teleport to="body">
    <Transition name="notification-drawer">
      <div
        v-if="open"
        class="fixed inset-0 z-[9990] flex justify-end overflow-x-hidden"
        @keydown.esc.prevent="$emit('close')"
      >
        <!-- Backdrop: absolute full coverage so no white gap shows while drawer slides -->
        <div
          class="absolute inset-0 z-[1] bg-black/60"
          @click="$emit('close')"
          aria-hidden="true"
        ></div>

        <!-- Drawer panel: solid bg + z-index so backdrop never shows through the panel -->
        <aside
          class="relative z-[2] flex h-full min-h-0 w-full shrink-0 flex-col rounded-tl-xl overflow-hidden bg-white dark:bg-neutral-900 sm:w-[360px] md:w-[380px] lg:w-[400px] max-h-screen border-l border-neutral-200/60 dark:border-neutral-700/60 shadow-2xl shadow-neutral-900/5 dark:shadow-black/20"
          role="dialog"
          aria-modal="true"
          :aria-label="t('notifications.panelAria')"
        >
          <!-- Header -->
          <header class="flex shrink-0 items-center justify-between border-b border-neutral-200/60 bg-white/80 px-4 py-3.5 backdrop-blur-md dark:border-neutral-700/60 dark:bg-neutral-900/80">
            <h2 class="text-[15px] font-semibold tracking-[-0.01em] text-neutral-900 dark:text-white">
              {{ t('notifications.drawerHeading') }}
            </h2>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50 min-h-[32px] px-2 transition-colors duration-150"
                :disabled="!hasUnread || markAllDisabled"
                @click="handleMarkAllRead"
                :aria-label="t('notifications.markAllReadAria')"
              >
                {{ t('notifications.markAllRead') }}
              </button>
              <button
                type="button"
                class="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 min-h-[32px] min-w-[32px] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:ring-offset-2 dark:focus:ring-offset-neutral-900"
                :aria-label="t('notifications.closePanelAria')"
                @click="$emit('close')"
              >
                <svg class="w-5 h-5 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </header>

          <!-- Offline banner (optional for audit app) -->
          <div v-if="showOfflineBanner" class="px-4 py-2 bg-warning-50 dark:bg-warning-900/30 border-b border-warning-200 dark:border-warning-700">
            <p class="text-xs text-warning-800 dark:text-warning-200">
              {{ t('notifications.offlineBanner') }}
            </p>
          </div>

          <!-- Body -->
          <section class="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden bg-neutral-50/40 px-2.5 py-3 dark:bg-neutral-950/40" :aria-busy="loading">
            <!-- Loading skeleton -->
            <template v-if="loading && !items.length">
              <div class="space-y-5">
                <div class="px-1 mb-1 h-2.5 w-14 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse"></div>
                <div v-for="i in 4" :key="i" class="flex items-start gap-3 px-3.5 py-3 rounded-xl bg-white dark:bg-neutral-900/50 ring-1 ring-neutral-200/70 dark:ring-neutral-700/50">
                  <div class="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse flex-shrink-0"></div>
                  <div class="flex-1 min-w-0 space-y-2">
                    <div class="h-3.5 w-3/4 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse"></div>
                    <div class="h-2.5 w-2/3 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse"></div>
                    <div class="flex gap-2 mt-2">
                      <div class="h-5 w-14 rounded-md bg-neutral-200 dark:bg-neutral-700 animate-pulse"></div>
                      <div class="h-4 w-12 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse"></div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <template v-else-if="items.length">
              <div v-for="(section, sectionIdx) in groupedSections" :key="section.id" class="notification-section">
                <p class="px-1 mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-400 dark:text-neutral-500">
                  {{ t(section.labelKey) }}
                </p>

                <TransitionGroup name="notification-list" tag="div" class="space-y-2">
                  <template v-for="entry in section.entries">
                    <!-- "No updates" digest placeholder: plain text, not a card -->
                    <div
                      v-if="entry.kind === 'item' && isNoUpdatesPlaceholder(entry.item)"
                      :key="`no-updates-${entry.key}`"
                      class="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400"
                    >
                      {{ t('notifications.noUpdatesDigest') }}
                    </div>
                    <!-- Ungrouped notifications (no entity OR only one in entity bucket) -->
                    <div v-else-if="entry.kind === 'item'" :key="`item-${entry.key}`" class="w-full">
                      <NotificationItem
                        :item="entry.item"
                        :app-key="appKey"
                        :show-actions="true"
                        :is-new="openedAt && new Date(entry.item.createdAt) > openedAt"
                        @navigated="$emit('close')"
                        @snooze="handleSnooze"
                      />
                    </div>

                    <!-- Entity group -->
                    <div
                      v-else
                      :key="`group-${entry.key}`"
                      class="w-full group"
                    >
                      <button
                        type="button"
                        class="group-card w-full relative flex items-start gap-3 px-3.5 py-3 rounded-xl text-left min-h-[60px] transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-neutral-900 bg-white dark:bg-neutral-900/50 ring-1 ring-neutral-200/70 dark:ring-neutral-700/50 hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 hover:shadow-[0_2px_8px_-2px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.35)] hover:ring-neutral-300/70 dark:hover:ring-neutral-600/50"
                        :aria-expanded="isGroupOpen(entry.key) ? 'true' : 'false'"
                        :aria-label="t('notifications.groupEntryAria', { label: entry.groupLabel, count: entry.count })"
                        @click="toggleGroup(entry.key)"
                      >
                        <!-- Left icon -->
                        <div class="flex-shrink-0 pt-0.5">
                          <span class="inline-flex items-center justify-center w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 ring-1 ring-inset ring-neutral-200/80 dark:ring-neutral-700/60 text-neutral-500 dark:text-neutral-400">
                            <svg class="w-[18px] h-[18px]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6ZM10 18a3 3 0 0 1-3-3h6a3 3 0 0 1-3 3Z" />
                            </svg>
                          </span>
                        </div>

                        <div class="flex-1 min-w-0 pr-8">
                          <div class="flex items-start justify-between gap-2">
                            <p
                              class="text-[13px] leading-snug tracking-[-0.01em]"
                              :class="entry.unreadCount > 0
                                ? 'font-semibold text-neutral-900 dark:text-white'
                                : 'font-medium text-neutral-600 dark:text-neutral-300'"
                            >
                              {{ entry.groupLabel }}
                            </p>
                            <div class="flex items-center gap-1.5 flex-shrink-0">
                              <span
                                v-if="entry.unreadCount > 0"
                                class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary-500 text-[10px] font-bold text-white shadow-sm"
                                :aria-label="t('notifications.countInGroupAria', { count: entry.unreadCount })"
                              >
                                {{ entry.unreadCount }}
                              </span>
                              <span
                                v-else
                                class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400"
                                :aria-label="t('notifications.countInGroupAria', { count: entry.count })"
                              >
                                {{ entry.count }}
                              </span>
                              <svg
                                class="w-4 h-4 text-neutral-400 transition-transform duration-200"
                                :class="{ 'rotate-180': isGroupOpen(entry.key) }"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                          <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400 truncate leading-relaxed">
                            {{ t('notifications.groupLatest', { title: entry.latestTitle, time: formatRelative(entry.latest.createdAt) }) }}
                          </p>
                        </div>

                        <!-- Group action: mark all as read (unread only) -->
                        <button
                          v-if="entry.unreadCount > 0"
                          type="button"
                          class="absolute right-2.5 top-2.5 inline-flex items-center justify-center rounded-md text-neutral-400 hover:text-primary-600 dark:text-neutral-500 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 min-h-[28px] min-w-[28px] transition-all duration-150 opacity-0 group-hover:opacity-100 focus:opacity-100"
                          :aria-label="t('notifications.groupMarkAllAria', { count: entry.count })"
                          :title="t('notifications.markAllRead')"
                          @click.stop.prevent="markGroupAllRead(entry)"
                        >
                          <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fill-rule="evenodd" d="M16.704 5.29a1 1 0 0 0-1.408-1.42L8 11.293 4.707 8a1 1 0 0 0-1.414 1.414l4 4a1 1 0 0 0 1.414 0l8-8.125Z" clip-rule="evenodd" />
                          </svg>
                        </button>
                      </button>

                      <TransitionGroup
                        v-if="isGroupOpen(entry.key)"
                        name="notification-list"
                        tag="div"
                        class="mt-2 space-y-2 pl-1 border-l border-neutral-200/70 dark:border-neutral-700/50 ml-4"
                      >
                        <div v-for="n in entry.expandedItems" :key="n.id" class="w-full">
                          <NotificationItem
                            :item="n"
                            :app-key="appKey"
                            :show-actions="true"
                            :is-new="openedAt && new Date(n.createdAt) > openedAt"
                            in-group
                            @navigated="$emit('close')"
                            @snooze="handleSnooze"
                          />
                        </div>
                      </TransitionGroup>
                    </div>
                  </template>
                </TransitionGroup>
              </div>
              <div v-if="canLoadMore" class="mt-2 px-2">
                <button
                  type="button"
                  class="w-full text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline py-2 transition-colors duration-150 disabled:opacity-50"
                  @click="loadMore"
                  :disabled="loading"
                >
                  {{ loading ? t('states.loading') : t('notifications.loadMore') }}
                </button>
              </div>
            </template>
            <template v-else>
              <div class="px-4 py-12 text-center">
                <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 mb-4">
                  <svg class="w-6 h-6 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p class="text-sm font-medium text-neutral-900 dark:text-white">{{ t('notifications.caughtUp') }}</p>
                <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{{ t('notifications.emptyList') }}</p>
                <router-link
                  to="/settings?tab=notifications&notificationPage=preferences"
                  class="mt-3 inline-block text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  @click="$emit('close')"
                >
                  {{ t('notifications.settingsLink') }}
                </router-link>
              </div>
            </template>
          </section>

          <!-- Footer -->
          <footer class="shrink-0 border-t border-neutral-200/60 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-neutral-700/60 dark:bg-neutral-900/80">
            <router-link
              to="/settings?tab=notifications&notificationPage=preferences"
              class="block text-center text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors duration-150"
              @click="$emit('close')"
            >
              {{ t('notifications.settingsLink') }}
            </router-link>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, watch, ref } from 'vue';
import { TransitionGroup } from 'vue';
import { useNotificationStore } from '@/stores/notifications';
import { useOffline } from '@/composables/useOffline';
import { useAuthStore } from '@/stores/authRegistry';
import NotificationItem from './NotificationItem.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  open: {
    type: Boolean,
    required: true
  },
  appKey: {
    type: String,
    required: true
  },
  markAllDisabled: {
    type: Boolean,
    default: false
  }
});

defineEmits(['close']);

const store = useNotificationStore();
const authStore = useAuthStore();
const { isOffline, isOnline } = useOffline();

function handleSnooze(payload) {
  // Smart Snooze v1 is UI-only and localStorage-based (device-only).
  // Payload: { id, until, label }
  store.snoozeNotification(payload);
}

// Snoozed and dismissed notifications are hidden from the list and do not contribute to grouping.
const items = computed(() =>
  store.items.filter(n => !store.isSnoozed(n.id) && !store.isDismissed(n.id))
);
const hasUnread = computed(() => store.hasUnread);
const loading = computed(() => store.loading);
const canLoadMore = computed(() => !!store.nextCursor && !loading.value);
const showOfflineBanner = computed(() => props.appKey === 'AUDIT' && isOffline.value);

// Track when drawer opened to show "New" divider
const openedAt = ref(null);
const openEntityGroups = ref(new Set()); // non-persistent, resets when drawer closes

function formatRelative(date) {
  return store.formatRelative(date);
}

function formatEntityType(type) {
  if (!type) return 'Notification';
  return String(type)
    .split('_')
    .map(w => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

/** Digest "no updates" placeholder — render as plain text, not a card */
function isNoUpdatesPlaceholder(item) {
  if (!item?.title) return false;
  const t = String(item.title).trim().toLowerCase();
  return t === 'no updates';
}

/** Human-readable labels for event-type groups (e.g. "3 new tasks assigned to you") */
function getEventTypeGroupLabel(eventType, count, unreadCount) {
  const t = String(eventType || '').toUpperCase();
  const map = {
    TASK_ASSIGNED: 'tasks assigned to you',
    TASK_CREATED: 'tasks created',
    TASK_STATUS_CHANGED: 'task updates',
    TASK_DUE_SOON: 'tasks due soon',
    AUDIT_ASSIGNED: 'audits assigned to you',
    AUDIT_CHECKED_IN: 'audits checked in',
    AUDIT_SUBMITTED: 'audits submitted for review',
    AUDIT_APPROVED: 'audits approved',
    AUDIT_REJECTED: 'audits rejected',
    CORRECTIVE_ACTION_CREATED: 'corrective actions created',
    CORRECTIVE_ACTION_DUE_SOON: 'corrective actions due soon',
    CORRECTIVE_ACTION_OVERDUE: 'corrective actions overdue',
    EVIDENCE_UPLOADED: 'evidence uploaded',
    PORTAL_ACCOUNT_CREATED: 'portal accounts created',
    USER_ADDED_TO_APP: 'access updates',
    SYSTEM_TRIAL_EXPIRING: 'trial expiring',
    SYSTEM_SUBSCRIPTION_SUSPENDED: 'subscription updates',
    RECORD_COMMENT_MENTION: 'comment mentions',
    TASK_COMMENT_MENTION: 'comment mentions'
  };
  const label = map[t] || (t ? formatEntityType(t.replace(/_/g, ' ')) : 'notifications');
  const unread = Number(unreadCount || 0);
  if (unread <= 0) return `${count} ${label}`;
  return `${unread} new ${label}`;
}

function buildSectionEntries(list) {
  const entries = [];
  const groupsByEventType = new Map(); // eventType -> { key, latest, items }

  for (const n of list) {
    const eventType = n?.eventType || 'UNKNOWN';
    const key = `event:${eventType}`;

    let group = groupsByEventType.get(key);
    if (!group) {
      group = {
        key,
        eventType,
        latest: n,
        items: [n]
      };
      groupsByEventType.set(key, group);
      entries.push({ kind: 'group', key, _groupRef: group });
    } else {
      group.items.push(n);
      if (new Date(n.createdAt) > new Date(group.latest.createdAt)) {
        group.latest = n;
      }
    }
  }

  return entries.map((e) => {
    const g = e._groupRef;
    if (!g || g.items.length <= 1) {
      const single = g?.items?.[0];
      return { kind: 'item', key: `item:${single?.id}`, item: single };
    }

    const latest = g.latest;
    // Use record title only (entity.title/name), never the alert/notification title
    const latestTitle =
      latest?.entity?.title ||
      latest?.entity?.name ||
      formatEntityType(latest?.entity?.type);

    const expandedItems = [...g.items].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    const unreadCount = g.items.filter(x => !x.readAt).length;

    return {
      kind: 'group',
      key: g.key,
      groupLabel: getEventTypeGroupLabel(g.eventType, g.items.length, unreadCount),
      latestTitle,
      latest,
      count: g.items.length,
      unreadCount,
      expandedItems
    };
  });
}

const groupedSections = computed(() => {
  const now = new Date();
  const today = [];
  const earlier = [];

  for (const n of items.value) {
    const created = new Date(n.createdAt);
    const diffMs = now - created;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) today.push(n);
    else earlier.push(n);
  }

  return [
    { id: 'today', labelKey: 'notifications.sectionToday', entries: buildSectionEntries(today) },
    { id: 'earlier', labelKey: 'notifications.sectionEarlier', entries: buildSectionEntries(earlier) }
  ].filter(s => s.entries.length);
});

function isGroupOpen(key) {
  return openEntityGroups.value.has(key);
}

function toggleGroup(key) {
  const next = new Set(openEntityGroups.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  openEntityGroups.value = next;
}

async function markGroupAllRead(entry) {
  if (!entry?.expandedItems?.length) return;
  // Use existing per-notification markRead logic (no new API)
  for (const n of entry.expandedItems) {
    if (!n.readAt) {
      await store.markRead(n.id);
    }
  }
}

async function loadInitial() {
  await store.fetchNotifications({ unreadOnly: false, limit: 20 });
}

async function loadMore() {
  if (!store.nextCursor) return;
  await store.fetchNotifications({ cursor: store.nextCursor, unreadOnly: false, limit: 20 });
}

async function handleMarkAllRead() {
  if (showOfflineBanner.value) return;
  await store.markAllRead();
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      openedAt.value = new Date();
      openEntityGroups.value = new Set(); // reset (non-persistent)
      await loadInitial();
    } else {
      openedAt.value = null;
      openEntityGroups.value = new Set(); // reset (non-persistent)
    }
  }
);
</script>

<style>
/* Enter: only the drawer slides (no wrapper fade) so white panel doesn't "pop" first */
.notification-drawer-enter-active aside {
  transition: transform 0.3s ease-out;
}

.notification-drawer-enter-from aside {
  transform: translateX(100%);
}

/* Leave: backdrop fades and drawer slides out together */
.notification-drawer-leave-active {
  transition: opacity 0.2s ease-out;
}

.notification-drawer-leave-active aside {
  transition: transform 0.25s ease-out;
}

.notification-drawer-leave-to {
  opacity: 0;
}

.notification-drawer-leave-to aside {
  transform: translateX(100%);
}

/* TransitionGroup: smooth move when items are removed */
.notification-list-move,
.notification-list-enter-active,
.notification-list-leave-active {
  transition: all 0.3s ease-out;
}

.notification-list-leave-active {
  position: absolute;
  width: 100%;
}

.notification-list-enter-from,
.notification-list-leave-to {
  opacity: 0;
  transform: translateX(120%);
}
</style>


