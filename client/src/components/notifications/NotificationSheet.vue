<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <button
        v-if="open"
        type="button"
        class="fixed inset-0 z-[9990] bg-black/40 dark:bg-black/55"
        :aria-label="t('actions.close')"
        @click="$emit('close')"
      />
    </Transition>

    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="translate-y-full"
      enter-to-class="translate-y-0"
      leave-active-class="transition-transform duration-250 ease-in"
      leave-from-class="translate-y-0"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="open"
        class="fixed inset-x-0 bottom-0 top-auto z-[9991] flex h-[min(85dvh,780px)] max-h-[92dvh] flex-col"
        @keydown.esc.prevent="$emit('close')"
      >
        <section
          class="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-t-2xl border border-b-0 border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_32px_-8px_rgba(15,23,42,0.18)] dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.45)]"
          role="dialog"
          aria-modal="true"
          :aria-label="t('notifications.panelAria')"
        >
          <div class="flex shrink-0 justify-center pb-1 pt-2" aria-hidden="true">
            <span class="h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-600" />
          </div>

          <!-- Header -->
          <header class="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200/60 px-4 py-2 dark:border-neutral-700/60">
            <h2 class="text-base font-semibold text-neutral-900 dark:text-white">
              {{ t('notifications.drawerHeading') }}
            </h2>
            <button
              type="button"
              class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50 min-h-[32px] px-2 transition-colors duration-150"
              :disabled="!hasUnread || markAllDisabled || showOfflineBanner"
              @click="handleMarkAllRead"
              :aria-label="t('notifications.markAllReadAria')"
            >
              {{ t('notifications.markAllRead') }}
            </button>
          </header>

          <!-- Offline banner -->
          <div v-if="showOfflineBanner" class="px-4 py-2 bg-warning-50 dark:bg-warning-900/30 border-b border-warning-200 dark:border-warning-700">
            <p class="text-xs text-warning-800 dark:text-warning-200">
              {{ t('notifications.offlineBanner') }}
            </p>
          </div>

          <!-- Body -->
          <section class="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-2 py-2" :aria-busy="loading">
            <!-- Loading skeleton -->
            <template v-if="loading && !items.length">
              <div class="space-y-4">
                <div class="px-2 mb-1 h-3 w-16 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse"></div>
                <div v-for="i in 4" :key="i" class="flex items-start gap-3 px-3 py-3 rounded-2xl bg-neutral-50/50 dark:bg-neutral-800/30">
                  <div class="w-10 h-10 rounded-xl bg-neutral-200 dark:bg-neutral-700 animate-pulse flex-shrink-0"></div>
                  <div class="flex-1 min-w-0 space-y-2">
                    <div class="h-3.5 w-3/4 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse"></div>
                    <div class="h-2.5 w-2/3 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse"></div>
                    <div class="flex gap-2 mt-2">
                      <div class="h-5 w-16 rounded-md bg-neutral-200 dark:bg-neutral-700 animate-pulse"></div>
                      <div class="h-4 w-12 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse"></div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <template v-else-if="items.length">
              <div v-for="group in groupedItems" :key="group.id">
                <p class="px-2 mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  {{ t(group.labelKey) }}
                </p>
                <TransitionGroup name="notification-list" tag="div" class="space-y-1.5">
                  <template v-for="entry in group.entries">
                    <!-- "No updates" digest placeholder: plain text, not a card -->
                    <div
                      v-if="entry.kind === 'item' && isNoUpdatesPlaceholder(entry.item)"
                      :key="`no-updates-${entry.key}`"
                      class="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400"
                    >
                      {{ t('notifications.noUpdatesDigest') }}
                    </div>
                    <div v-else-if="entry.kind === 'item'" :key="`item-${entry.key}`" class="w-full">
                      <NotificationItem
                        :item="entry.item"
                        :app-key="appKey"
                        :show-actions="true"
                        :is-new="group.id === 'new'"
                        @navigated="$emit('close')"
                        @snooze="handleSnooze"
                      />
                    </div>
                    <div v-else :key="`group-${entry.key}`" class="w-full">
                      <button
                        type="button"
                        class="w-full relative flex items-start gap-3 px-3 py-3 rounded-xl text-left min-h-[56px] transition-all duration-200 border border-transparent hover:border-neutral-200/80 dark:hover:border-neutral-600/50 hover:rounded-2xl bg-neutral-50/50 dark:bg-neutral-800/30 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60 hover:shadow-sm"
                        :aria-expanded="isGroupOpen(entry.key) ? 'true' : 'false'"
                        :aria-label="t('notifications.groupEntryAria', { label: entry.groupLabel, count: entry.count })"
                        @click="toggleGroup(entry.key)"
                      >
                        <div class="flex-shrink-0 mt-0.5">
                          <span class="inline-flex items-center justify-center w-10 h-10 rounded-xl shadow-sm bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6ZM10 18a3 3 0 0 1-3-3h6a3 3 0 0 1-3 3Z" />
                            </svg>
                          </span>
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-start justify-between gap-2">
                            <p
                              class="text-sm leading-snug"
                              :class="entry.unreadCount > 0
                                ? 'font-semibold text-neutral-900 dark:text-white'
                                : 'font-medium text-neutral-600 dark:text-neutral-300'"
                            >
                              {{ entry.groupLabel }}
                            </p>
                            <span
                              class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-semibold"
                              :class="entry.unreadCount > 0
                                ? 'bg-primary-500 text-white'
                                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200'"
                            >
                              {{ entry.unreadCount > 0 ? entry.unreadCount : entry.count }}
                            </span>
                          </div>
                          <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400 truncate">
                            {{ t('notifications.groupLatest', { title: entry.latestTitle, time: formatRelative(entry.latest.createdAt) }) }}
                          </p>
                        </div>
                        <div class="flex items-center gap-2 flex-shrink-0">
                          <button
                            v-if="entry.unreadCount > 0"
                            type="button"
                            class="inline-flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-white dark:hover:bg-neutral-600 min-h-[32px] min-w-[32px] transition-all duration-150 shadow-sm"
                            :aria-label="t('notifications.markAllReadAria')"
                            :title="t('notifications.markAllRead')"
                            @click.stop.prevent="markGroupAllRead(entry)"
                          >
                            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fill-rule="evenodd" d="M16.704 5.29a1 1 0 0 0-1.408-1.42L8 11.293 4.707 8a1 1 0 0 0-1.414 1.414l4 4a1 1 0 0 0 1.414 0l8-8.125Z" clip-rule="evenodd" />
                            </svg>
                          </button>
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
                      </button>
                      <TransitionGroup
                        v-if="isGroupOpen(entry.key)"
                        name="notification-list"
                        tag="div"
                        class="mt-1.5 space-y-1.5 pl-1"
                      >
                        <div v-for="n in entry.expandedItems" :key="n.id" class="w-full">
                          <NotificationItem
                            :item="n"
                            :app-key="appKey"
                            in-group
                            :show-actions="true"
                            :is-new="group.id === 'new'"
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
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, watch, ref, defineAsyncComponent } from 'vue';
import { TransitionGroup } from 'vue';
import { useNotificationStore } from '@/stores/notifications';
import { useOffline } from '@/composables/useOffline';
import { useAuthStore } from '@/stores/authRegistry';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const NotificationItem = defineAsyncComponent(() => import('./NotificationItem.vue'));

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

// Snoozed and dismissed notifications are hidden from the list.
const items = computed(() =>
  store.items.filter(n => !store.isSnoozed(n.id) && !store.isDismissed(n.id))
);
const hasUnread = computed(() => store.hasUnread);
const loading = computed(() => store.loading);
const canLoadMore = computed(() => !!store.nextCursor && !loading.value);
const showOfflineBanner = computed(() => props.appKey === 'AUDIT' && isOffline.value);

// Track when sheet opened to show "New" divider
const openedAt = ref(null);
const openEventGroups = ref(new Set());

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
  const groupsByEventType = new Map();

  for (const n of list) {
    const eventType = n?.eventType || 'UNKNOWN';
    const key = `event:${eventType}`;

    let group = groupsByEventType.get(key);
    if (!group) {
      group = { key, eventType, latest: n, items: [n] };
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

function isGroupOpen(key) {
  return openEventGroups.value.has(key);
}

function toggleGroup(key) {
  const next = new Set(openEventGroups.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  openEventGroups.value = next;
}

const groupedItems = computed(() => {
  const groups = {
    New: [],
    Today: [],
    Yesterday: [],
    Earlier: []
  };
  const now = new Date();

  for (const n of items.value) {
    const created = new Date(n.createdAt);
    const diffMs = now - created;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (openedAt.value && created > openedAt.value) {
      groups.New.push(n);
    } else if (diffDays === 0) {
      groups.Today.push(n);
    } else if (diffDays === 1) {
      groups.Yesterday.push(n);
    } else {
      groups.Earlier.push(n);
    }
  }

  return [
    { id: 'new', labelKey: 'notifications.sectionNew', entries: buildSectionEntries(groups.New) },
    { id: 'today', labelKey: 'notifications.sectionToday', entries: buildSectionEntries(groups.Today) },
    { id: 'yesterday', labelKey: 'notifications.sectionYesterday', entries: buildSectionEntries(groups.Yesterday) },
    { id: 'earlier', labelKey: 'notifications.sectionEarlier', entries: buildSectionEntries(groups.Earlier) }
  ].filter(g => g.entries.length);
});

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

function handleSnooze(payload) {
  store.snoozeNotification(payload);
}

async function markGroupAllRead(entry) {
  if (!entry?.expandedItems?.length) return;
  for (const n of entry.expandedItems) {
    if (!n.readAt) await store.markRead(n.id);
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      openedAt.value = new Date();
      openEventGroups.value = new Set();
      await loadInitial();
    } else {
      openedAt.value = null;
      openEventGroups.value = new Set();
    }
  }
);
</script>

<style>
/* TransitionGroup: slide out + smooth move when dismissing */
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


