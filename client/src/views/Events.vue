<template>
  <div class="mx-auto w-full" :data-view="currentView">
    <AppointmentsStatsBar v-if="currentView === 'list' && showAppointmentsScope" />
    <ModuleList
      ref="moduleListRef"
      module-key="events"
      app-key="PLATFORM"
      :view-mode="currentView"
      @create="openEventModal"
      @export="exportEvents"
      @row-click="handleRowClick"
      @edit="editEventFromList"
      @delete="handleInlineDelete"
      @bulk-action="handleBulkAction"
      @filters-changed="handleFiltersChanged"
      @search-changed="handleSearchChanged"
    >
      <template v-if="currentView === 'list'" #search-actions>
        <button
          type="button"
          @click="toggleAppointmentsOnly"
          class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          :class="showAppointmentsScope
            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-200'
            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'"
          :aria-pressed="showAppointmentsScope"
        >
          <CalendarDaysIcon class="h-3.5 w-3.5 shrink-0" />
          <span class="hidden sm:inline">{{ t('events.eventsAppointmentsOnly') }}</span>
          <span class="sm:hidden">{{ t('events.eventsAppts') }}</span>
        </button>
      </template>

      <!-- Custom Header Slot - View Switcher (segmented control with sliding pill) -->
      <template #header-actions>
        <div class="flex gap-3 items-center">
          <!-- View Toggle - Segmented control (h-[34px] to match header action buttons) -->
          <div class="relative flex h-[34px] items-stretch rounded-lg bg-gray-100 dark:bg-gray-700/90 p-[0.1rem] border border-gray-200/80 dark:border-gray-600 shadow-inner min-w-[200px]">
            <!-- <div
              class="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-600 transition-all duration-200 ease-out pointer-events-none"
              :style="{ left: currentView === 'calendar' ? '4px' : 'calc(50% + 2px)' }"
            /> -->
            <button
              type="button"
              @click="switchView('calendar')"
              class="relative z-10 flex-1 flex items-center justify-center gap-1.5 px-2.5 py-0 rounded-md text-xs sm:text-sm font-medium transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:ring-offset-gray-800 overflow-visible"
              :class="currentView === 'calendar' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'"
            >
              <CalendarIcon class="w-4 h-4 shrink-0" />{{ t('events.eventsCalendar') }}</button>
            <button
              type="button"
              @click="switchView('list')"
              class="relative z-10 flex-1 flex items-center justify-center gap-1.5 px-2.5 py-0 rounded-md text-xs sm:text-sm font-medium transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:ring-offset-gray-800 overflow-visible"
              :class="currentView === 'list' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'"
            >
              <ListBulletIcon class="w-4 h-4 shrink-0" />{{ t('forms.rbLayoutList') }}</button>
          </div>
          <button
            type="button"
            class="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            @click="showCalendarSyncModal = true"
          >
            <ArrowsRightLeftIcon class="h-4 w-4 shrink-0" />
            <span>{{ t('events.calendarSyncButton') }}</span>
          </button>
          <ModuleActions
            module="events"
            :create-label="t('events.eventsNewEvent')"
            :show-import="false"
            @create="openEventModal"
            @export="exportEvents"
          />
        </div>
      </template>

      <!-- Custom Event Name Cell -->
      <template #cell-eventName="{ row }">
        <span class="block min-w-0 font-semibold text-gray-900 dark:text-white truncate">
          {{ row.eventName }}
        </span>
      </template>

      <!-- Custom Event Type Cell -->
      <template #cell-eventType="{ value }">
        <BadgeCell 
          v-if="value"
          :value="value" 
          variant="info"
        />
        <span v-else class="text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Start Date Time Cell -->
      <template #cell-startDateTime="{ value }">
        <DateCell v-if="value" :value="value" format="long" />
        <span v-else class="text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom End Date Time Cell -->
      <template #cell-endDateTime="{ value }">
        <DateCell v-if="value" :value="value" format="long" />
        <span v-else class="text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Status Cell -->
      <template #cell-status="{ value }">
        <BadgeCell 
          v-if="value"
          :value="value" 
          :variant-map="{
            'scheduled': 'info',
            'completed': 'success',
            'cancelled': 'danger',
            'in-progress': 'warning'
          }"
        />
        <span v-else class="text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Owner Cell -->
      <template #cell-appointmentBookedBy="{ row }">
        <span
          v-if="row.appointmentBookedBy"
          class="block min-w-0 truncate text-sm text-gray-900 dark:text-white"
        >
          {{ row.appointmentBookedBy }}
        </span>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">—</span>
      </template>

      <template #cell-appointmentBookingSource="{ value }">
        <span class="text-sm text-gray-700 dark:text-gray-300">
          {{ appointmentSourceLabel(value) }}
        </span>
      </template>

      <template #cell-appointmentType="{ value }">
        <span class="text-sm text-gray-700 dark:text-gray-300">
          {{ appointmentTypeLabel(value) }}
        </span>
      </template>

      <template #cell-appointmentMeetingLink="{ value }">
        <a
          v-if="value"
          :href="value"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          @click.stop
        >{{ t('appointments.join') }}</a>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">—</span>
      </template>

      <template #cell-assignedTo="{ row }">
        <div v-if="row.assignedTo" class="flex items-center gap-2">
          <Avatar
            v-if="typeof row.assignedTo === 'object'"
            :user="{
              firstName: row.assignedTo.firstName || row.assignedTo.first_name,
              lastName: row.assignedTo.lastName || row.assignedTo.last_name,
              email: row.assignedTo.email,
              avatar: row.assignedTo.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ getUserDisplayName(row.assignedTo) }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('records.editableUnassigned') }}</span>
      </template>
    </ModuleList>

    <!-- Calendar View (shown when Calendar tab is selected, replaces table) -->
    <div
      v-if="currentView === 'calendar'"
      class="calendar-view-container mt-4 w-full"
    >
      <div class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div v-if="calendarLoading" class="flex h-64 items-center justify-center">
          <div class="text-sm text-gray-500 dark:text-gray-400">{{ t('events.eventsLoadingCalendar') }}</div>
        </div>
        <FullCalendar
          v-else
          ref="calendarRef"
          class="events-calendar w-full"
          :options="calendarOptions"
        />
      </div>
    </div>

    <EventQuickCreateDrawer
      :isOpen="showEventQuickCreate"
      :initialData="eventQuickCreateInitialData"
      @close="closeEventQuickCreate"
      @saved="handleEventQuickCreateSaved"
    />

    <CreateRecordDrawer
      :isOpen="showEditDrawer"
      module-key="events"
      :record="editingEvent"
      @close="closeEditDrawer"
      @saved="handleEditDrawerSaved"
    />

    <EventCalendarSyncModal v-model="showCalendarSyncModal" />

  </div>
</template>

<script setup>
defineOptions({ name: 'EventsView' });
import { ref, computed, onMounted, onActivated, onUnmounted, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import apiClient from '@/utils/apiClient';
import { useTabs } from '@/composables/useTabs';
import { useAuthStore } from '@/stores/authRegistry';
import ModuleList from '@/components/module-list/ModuleList.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import Avatar from '@/components/common/Avatar.vue';
import ModuleActions from '@/components/common/ModuleActions.vue';
import EventQuickCreateDrawer from '@/components/events/EventQuickCreateDrawer.vue';
import EventCalendarSyncModal from '@/components/events/EventCalendarSyncModal.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import AppointmentsStatsBar from '@/components/appointments/AppointmentsStatsBar.vue';
import { getModuleListConfig } from '@/platform/modules/moduleListRegistry';
import { CalendarIcon, CalendarDaysIcon, ListBulletIcon, ArrowsRightLeftIcon } from '@heroicons/vue/24/outline';
import { appointmentSourceLabel, appointmentTypeLabel } from '@/utils/appointmentFormatters';
import { useNotifications } from '@/composables/useNotifications';
import { useBusinessHours } from '@/composables/useBusinessHours';
import { toDateTimeLocal } from '@/utils/datePickerUtils';

import { APP_NAME_KEYS } from '@/utils/navigationLabels';
import { startBulkDelete } from '@/utils/runBulkDelete';

const router = useRouter();
const route = useRoute();
const calendarRef = ref(null);
const moduleListRef = ref(null);
const showCalendarSyncModal = ref(false);
const notifications = useNotifications();
const { resolveSchedule, fetchSet, fetchSets } = useBusinessHours();
/** Cached availability schedule for calendar create defaults (future-day start). */
const calendarBusinessHourSet = ref(null);
let calendarBusinessHourSetPromise = null;
const DEFAULT_EVENT_DURATION_MS = 30 * 60 * 1000;
const DEFAULT_BUSINESS_START = { hours: 9, minutes: 0 };

// Initialize tabs composable
const { openTab } = useTabs();
const authStore = useAuthStore();
const { t, te } = useI18n();

// View state - initialize from localStorage immediately for CSS to work
const viewStorageKey = 'arivu-events-view';
const getInitialView = () => {
  try {
    const savedView = localStorage.getItem(viewStorageKey);
    if (savedView === 'list' || savedView === 'appointments') return 'list';
    return 'calendar';
  } catch {
    return 'calendar';
  }
};
const currentView = ref(getInitialView());
const showAppointmentsScope = ref(false);

// Calendar data state
const calendarEvents = ref([]);
const calendarLoading = ref(false);
/** After first paint, keep FullCalendar mounted across refetches (unmount during drawer close collapses the day grid). */
const calendarMountedOnce = ref(false);
let calendarFetchPromise = null;

function resizeCalendarSoon(delayMs = 0) {
  const run = () => {
    try {
      calendarRef.value?.getApi()?.updateSize();
    } catch (_) {
      /* calendar may be mid-unmount on view switch */
    }
  };
  nextTick(() => {
    if (delayMs > 0) {
      setTimeout(run, delayMs);
      return;
    }
    requestAnimationFrame(run);
  });
}

function scheduleCalendarFetch() {
  if (currentView.value !== 'calendar') {
    return Promise.resolve();
  }
  if (calendarFetchPromise) {
    return calendarFetchPromise;
  }
  calendarFetchPromise = fetchCalendarEvents().finally(() => {
    calendarFetchPromise = null;
  });
  return calendarFetchPromise;
}

// Event creation modal state
const showEventQuickCreate = ref(false);
const eventQuickCreateInitialData = ref({});
const showEditDrawer = ref(false);
const editingEvent = ref(null);
const isDarkMode = ref(false);

function isListView(view) {
  return view === 'list';
}

/** Apply view state locally; optionally sync URL (only when it actually changes). */
function applyView(view, { updateRoute = false } = {}) {
  currentView.value = view;
  try {
    localStorage.setItem(viewStorageKey, view);
  } catch (_) {}

  if (updateRoute) {
    const routeView = route.query.view;
    if (view === 'calendar') {
      if (routeView != null && routeView !== '') {
        const newQuery = { ...route.query };
        delete newQuery.view;
        router.replace({ query: newQuery });
      }
    } else if (routeView !== view) {
      router.replace({ query: { ...route.query, view } });
    }
  }

  nextTick(() => {
    toggleTableView(isListView(view));
  });
}

// Initialize view from route query or localStorage (first load / keep-alive return)
const initializeView = () => {
  const viewParam = route.query.view;

  if (viewParam === 'list' || viewParam === 'appointments') {
    applyView('list', { updateRoute: viewParam === 'appointments' ? true : false });
    return;
  }

  if (viewParam === undefined) {
    if (currentView.value === 'calendar') {
      applyView('calendar', { updateRoute: false });
      return;
    }
    const savedView = localStorage.getItem(viewStorageKey);
    if (savedView === 'list' || savedView === 'appointments') {
      applyView('list', { updateRoute: savedView === 'appointments' || route.query.view !== 'list' });
      return;
    }
    applyView('calendar', { updateRoute: false });
    return;
  }

  applyView('calendar', { updateRoute: true });
};

// User-initiated tab change
const switchView = (view) => {
  applyView(view, { updateRoute: true });
};

// Sync from URL (back/forward) without re-navigating
watch(
  () => route.query.view,
  (newView) => {
    if (newView === 'list' || newView === 'appointments') {
      if (currentView.value !== 'list') {
        applyView('list', { updateRoute: false });
      }
      return;
    }
    if (newView === undefined) {
      if (currentView.value === 'calendar') return;
      const savedView = localStorage.getItem(viewStorageKey);
      if (savedView === 'list' || savedView === 'appointments') {
        if (currentView.value !== 'list') {
          applyView('list', { updateRoute: false });
        }
      } else if (currentView.value !== 'calendar') {
        applyView('calendar', { updateRoute: false });
      }
      return;
    }
    if (currentView.value !== 'calendar') {
      applyView('calendar', { updateRoute: false });
    }
  }
);

// Helper function to toggle table visibility
const toggleTableView = (showTable) => {
  // Find the table container inside ModuleList > ListView
  // Use a more specific selector to avoid affecting other elements
  const tableContainer = document.querySelector('.mt-4.px-4.sm\\:px-6.lg\\:px-8:not(.calendar-view-container)');
  
  if (tableContainer) {
    // Check if it contains a table element
    const hasTable = tableContainer.querySelector('table') !== null || 
                     tableContainer.querySelector('[role="table"]') !== null ||
                     tableContainer.querySelector('div[class*="table-scroll"]') !== null ||
                     tableContainer.querySelector('div[class*="table-view"]') !== null;
    
    if (hasTable) {
      // Use inline style to override any CSS
      if (showTable) {
        tableContainer.style.display = '';
        tableContainer.style.visibility = '';
        tableContainer.style.pointerEvents = '';
      } else {
        tableContainer.style.display = 'none';
      }
    }
  }
};

// Fetch calendar events (same data as ModuleList)
const fetchCalendarEvents = async () => {
  if (currentView.value !== 'calendar') return;

  const showLoadingShell = !calendarMountedOnce.value;
  if (showLoadingShell) {
    calendarLoading.value = true;
  }
  try {
    // Get filters and search from ModuleList
    // Use stored search query if available, otherwise get from ModuleList
    const moduleListFilters = moduleListRef.value?.getFilters?.() || {};
    const moduleListSearch = currentSearchQuery.value || moduleListRef.value?.getSearchQuery?.() || '';
    
    // Build query params with filters and search
    const params = {};
    
    // Add filters
    const moduleConfig = getModuleListConfig('events');
    let normalizedFilters = { ...moduleListFilters };
    
    if (moduleConfig?.normalizeFilters) {
      normalizedFilters = moduleConfig.normalizeFilters(normalizedFilters, authStore.user?._id);
    }
    
    // Copy normalized filters to params
    Object.keys(normalizedFilters).forEach(key => {
      const value = normalizedFilters[key];
      if (value !== undefined && value !== '') {
        params[key] = value;
      } else if (value === null) {
        params[key] = null;
      }
    });
    
    // Add search query
    if (moduleListSearch && moduleListSearch.trim()) {
      params.search = moduleListSearch.trim();
    }
    
    // Fetch events from the same endpoint ModuleList uses, with filters
    const response = await apiClient.get('/events', { params });
    
    if (response && response.success) {
      const items = Array.isArray(response.data) ? response.data : [];
      calendarEvents.value = items.map(item => ({
        ...item,
        startDateTime: item.startDateTime,
        startDate: item.startDateTime,
        endDateTime: item.endDateTime,
        endDate: item.endDateTime,
        title: item.eventName,
        eventName: item.eventName,
        owner: item.assignedTo,
        ownerPersonId: item.assignedTo,
        appContext: item.appContext || (item.eventType && ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'].includes(item.eventType) ? 'AUDIT' : 'SALES')
      }));
    } else {
      calendarEvents.value = [];
    }
  } catch (error) {
    console.error('[Events] Error fetching calendar events:', error);
    calendarEvents.value = [];
  } finally {
    if (showLoadingShell) {
      calendarLoading.value = false;
    }
    calendarMountedOnce.value = true;
    resizeCalendarSoon();
  }
};

// Store current search query from ModuleList
const currentSearchQuery = ref('');
let lastCalendarFilterSignature = '';

function calendarFiltersSignature(filters) {
  const moduleListSearch = currentSearchQuery.value || moduleListRef.value?.getSearchQuery?.() || '';
  return JSON.stringify({ filters: filters ?? {}, search: moduleListSearch });
}

// Handle filter/search changes from ModuleList
function syncAppointmentsScopeFromFilters(filters) {
  const f = filters ?? moduleListRef.value?.getFilters?.() ?? {};
  showAppointmentsScope.value =
    f.appointmentOnly === 'true' || f.appointmentOnly === true;
}

const handleFiltersChanged = (filters) => {
  syncAppointmentsScopeFromFilters(filters);
  if (currentView.value !== 'calendar') return;
  const signature = calendarFiltersSignature(filters);
  if (signature === lastCalendarFilterSignature) return;
  lastCalendarFilterSignature = signature;
  scheduleCalendarFetch();
};

function toggleAppointmentsOnly() {
  if (currentView.value !== 'list') {
    switchView('list');
  }
  const current = { ...moduleListRef.value?.getFilters?.() };
  if (showAppointmentsScope.value) {
    delete current.appointmentOnly;
  } else {
    current.appointmentOnly = 'true';
  }
  moduleListRef.value?.setFilters?.(current);
}

const handleSearchChanged = (searchQuery) => {
  currentSearchQuery.value = searchQuery || '';
  if (currentView.value !== 'calendar') return;
  lastCalendarFilterSignature = '';
  scheduleCalendarFetch();
};

// View switches after mount — initial calendar load is owned by initializeView → applyView
watch(currentView, (newView, oldView) => {
  if (newView === 'calendar' && oldView !== undefined) {
    currentSearchQuery.value = moduleListRef.value?.getSearchQuery?.() || '';
    // Remount path (v-if calendar container) — allow loading shell only when FC was torn down
    if (oldView !== 'calendar') {
      calendarMountedOnce.value = false;
    }
    scheduleCalendarFetch();
  }

  nextTick(() => {
    toggleTableView(isListView(newView));
    if (newView === 'calendar') {
      resizeCalendarSoon(50);
    }
  });
});

// Check dark mode
const checkDarkMode = () => {
  isDarkMode.value = document.documentElement.classList.contains('dark');
};

const getEventCalendarStatusClass = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'fc-event-status-completed';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'fc-event-status-cancelled';
  if (normalized === 'in-progress' || normalized === 'in progress') return 'fc-event-status-in-progress';
  return 'fc-event-status-scheduled';
};

const getEventCalendarColors = (status) => {
  const isDark = document.documentElement.classList.contains('dark');
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'completed') {
    return isDark
      ? { text: 'rgb(167 243 208)', bg: 'rgb(16 185 129 / 0.16)', border: 'rgb(52 211 153)' }
      : { text: 'rgb(6 95 70)', bg: 'rgb(236 253 245)', border: 'rgb(16 185 129)' };
  }
  if (normalized === 'cancelled' || normalized === 'canceled') {
    return isDark
      ? { text: 'rgb(203 213 225)', bg: 'rgb(148 163 184 / 0.14)', border: 'rgb(148 163 184)' }
      : { text: 'rgb(71 85 105)', bg: 'rgb(241 245 249)', border: 'rgb(148 163 184)' };
  }
  if (normalized === 'in-progress' || normalized === 'in progress') {
    return isDark
      ? { text: 'rgb(253 230 138)', bg: 'rgb(245 158 11 / 0.14)', border: 'rgb(251 191 36)' }
      : { text: 'rgb(146 64 14)', bg: 'rgb(255 251 235)', border: 'rgb(245 158 11)' };
  }
  return isDark
    ? { text: 'rgb(199 210 254)', bg: 'rgb(99 102 241 / 0.18)', border: 'rgb(129 140 248)' }
    : { text: 'rgb(55 48 163)', bg: 'rgb(238 242 255)', border: 'rgb(99 102 241)' };
};

const handleEventDidMount = (info) => {
  // FullCalendar sets inline --fc-event-text-color (often white) which breaks
  // our light tinted backgrounds on multi-day continuation segments.
  info.el.style.removeProperty('--fc-event-text-color');
  info.el.style.removeProperty('--fc-event-bg-color');
  info.el.style.removeProperty('--fc-event-border-color');
  info.el.style.removeProperty('color');
  info.el.style.removeProperty('background-color');
  info.el.style.removeProperty('border-color');

  const status = info.event.extendedProps.status;
  info.el.dataset.eventStatus = String(status || '');

  const colors = getEventCalendarColors(status);
  info.el.style.setProperty('--fc-event-text-color', colors.text);
  info.el.querySelectorAll('.fc-event-main, .fc-event-title, .fc-event-time').forEach((node) => {
    node.style.color = colors.text;
  });
};

// Convert events to FullCalendar format
const convertEventsToCalendarFormat = (events) => {
  const formatAppContext = (appContext) => {
    const navKey = APP_NAME_KEYS[appContext];
    if (navKey && te(navKey)) return t(navKey);
    return appContext || '';
  };

  return events.map(event => {
    const appLabel = event.appContext ? `[${formatAppContext(event.appContext)}] ` : '';
    return {
      id: event.eventId || event._id,
      title: `${appLabel}${event.eventName || event.title}`,
      start: event.startDateTime || event.startDate,
      end: event.endDateTime || event.endDate,
      classNames: [getEventCalendarStatusClass(event.status)],
      extendedProps: {
        eventId: event.eventId || event._id,
        appContext: event.appContext,
        notes: event.notes || event.description,
        location: event.location,
        eventType: event.eventType || event.type,
        status: event.status,
        originalEvent: event
      }
    };
  });
};

// Stable plugin list — recreating plugins on every events refetch can corrupt FC layout
const calendarPlugins = [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin];

// FullCalendar Options
const calendarOptions = computed(() => {
  const events = convertEventsToCalendarFormat(calendarEvents.value);

  return {
    plugins: calendarPlugins,
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
    },
    buttonText: {
      today: t('events.eventsCalendarToday'),
      month: t('events.eventsCalendarMonth'),
      week: t('events.eventsCalendarWeek'),
      day: t('events.eventsCalendarDay'),
      list: t('events.eventsCalendarList'),
    },
    height: 'auto',
    aspectRatio: 1.8,
    editable: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    weekends: true,
    nowIndicator: true,
    eventMaxStack: 3,
    moreLinkClick: 'popover',
    events,
    eventClick: handleEventClick,
    eventDidMount: handleEventDidMount,
    select: handleDateSelect,
    dateClick: handleDateClick,
    eventDrop: handleEventDrop,
    eventResize: handleEventResize,
    themeSystem: 'standard',
  };
});

// Calendar event handlers
const handleEventClick = (info) => {
  const eventId = info.event.extendedProps.eventId || info.event.id;
  if (eventId) {
    openTab(`/events/${eventId}`, {
      title: info.event.title || t('events.eventsTabEventDetail'),
      icon: '📅',
      insertAdjacent: true
    });
  }
};

function isSameCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

/** Strictly next 15-minute boundary (1:30 → 1:45, 1:31 → 1:45, 1:00 → 1:15). */
function nextQuarterHour(from = new Date()) {
  const d = new Date(from);
  d.setSeconds(0, 0);
  const minutes = d.getMinutes();
  const rem = minutes % 15;
  if (rem === 0) {
    d.setMinutes(minutes + 15);
  } else {
    d.setMinutes(minutes + (15 - rem));
  }
  return d;
}

async function ensureCalendarBusinessHourSet() {
  if (calendarBusinessHourSet.value) return calendarBusinessHourSet.value;
  if (calendarBusinessHourSetPromise) return calendarBusinessHourSetPromise;
  calendarBusinessHourSetPromise = (async () => {
    try {
      const userId = authStore.user?._id || authStore.user?.id;
      const resolved = await resolveSchedule(userId ? String(userId) : undefined);
      if (resolved?.setId) {
        calendarBusinessHourSet.value = await fetchSet(resolved.setId);
      } else {
        const sets = await fetchSets();
        calendarBusinessHourSet.value =
          (Array.isArray(sets) && (sets.find((s) => s.isDefault) || sets[0])) || null;
      }
    } catch (err) {
      console.warn('[Events] Failed to load business hours for calendar create:', err);
      calendarBusinessHourSet.value = null;
    } finally {
      calendarBusinessHourSetPromise = null;
    }
    return calendarBusinessHourSet.value;
  })();
  return calendarBusinessHourSetPromise;
}

function getBusinessStartForDate(date, set) {
  const day = date.getDay();
  const weekDay = Array.isArray(set?.week)
    ? set.week.find((entry) => Number(entry?.day) === day && entry?.enabled !== false)
    : null;
  const windowStart = weekDay?.windows?.[0]?.start;
  if (typeof windowStart === 'string' && /^\d{1,2}:\d{2}/.test(windowStart)) {
    const [hours, minutes] = windowStart.split(':').map((part) => parseInt(part, 10));
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      return { hours, minutes };
    }
  }
  return { ...DEFAULT_BUSINESS_START };
}

function atBusinessStartOnDay(dayDate, set) {
  const { hours, minutes } = getBusinessStartForDate(dayDate, set);
  return new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hours, minutes, 0, 0);
}

/**
 * Month / all-day: today → next quarter-hour from now; other days → business-hours start.
 * Week / Day timed: use selected range; if start is today and already past, bump to next quarter-hour.
 */
async function resolveCalendarCreateDateTimes(selectInfo) {
  const now = new Date();
  const rawStart = selectInfo?.start instanceof Date
    ? selectInfo.start
    : new Date(selectInfo?.start);
  const rawEnd = selectInfo?.end instanceof Date
    ? selectInfo.end
    : (selectInfo?.end ? new Date(selectInfo.end) : null);
  const allDay = Boolean(selectInfo?.allDay)
    || selectInfo?.view?.type === 'dayGridMonth'
    || (rawStart instanceof Date && !Number.isNaN(rawStart.getTime())
      && rawStart.getHours() === 0 && rawStart.getMinutes() === 0
      && rawEnd instanceof Date && !Number.isNaN(rawEnd.getTime())
      && (rawEnd - rawStart) >= 20 * 60 * 60 * 1000);

  let startDt;
  if (allDay) {
    const dayAnchor = Number.isNaN(rawStart.getTime()) ? now : rawStart;
    if (isSameCalendarDay(dayAnchor, now)) {
      startDt = nextQuarterHour(now);
    } else {
      const set = await ensureCalendarBusinessHourSet();
      startDt = atBusinessStartOnDay(dayAnchor, set);
    }
  } else {
    startDt = Number.isNaN(rawStart.getTime()) ? nextQuarterHour(now) : new Date(rawStart);
    if (isSameCalendarDay(startDt, now) && startDt.getTime() <= now.getTime()) {
      startDt = nextQuarterHour(now);
    }
  }

  let endDt;
  if (!allDay && rawEnd && !Number.isNaN(rawEnd.getTime()) && rawEnd.getTime() > rawStart.getTime()) {
    const durationMs = rawEnd.getTime() - rawStart.getTime();
    endDt = new Date(startDt.getTime() + durationMs);
  } else {
    endDt = new Date(startDt.getTime() + DEFAULT_EVENT_DURATION_MS);
  }

  return {
    startDateTime: toDateTimeLocal(startDt),
    endDateTime: toDateTimeLocal(endDt),
  };
}

/** Prevent select + dateClick double-open on the same gesture. */
let calendarCreateGateUntil = 0;

const handleDateSelect = async (selectInfo) => {
  await openEventModalWithCalendarSlot(selectInfo);
};

/** Single-click create (month/week/day) when a simple click is used instead of drag-select. */
const handleDateClick = async (clickInfo) => {
  const start = clickInfo?.date instanceof Date ? clickInfo.date : new Date(clickInfo?.date);
  if (Number.isNaN(start.getTime())) return;
  const end = new Date(start.getTime() + (clickInfo?.allDay ? 24 * 60 * 60 * 1000 : DEFAULT_EVENT_DURATION_MS));
  await openEventModalWithCalendarSlot({
    start,
    end,
    allDay: Boolean(clickInfo?.allDay),
    view: clickInfo?.view,
  });
};

const handleEventDrop = async (info) => {
  try {
    const event = info.event;
    const eventId = event.id;
    
    await apiClient.patch(`/scheduling/${eventId}/reschedule`, {
      startDate: event.start.toISOString()
    });
    
    // Refresh calendar and ModuleList data
    await fetchCalendarEvents();
    if (moduleListRef.value && moduleListRef.value.refresh) {
      moduleListRef.value.refresh();
    }
  } catch (error) {
    console.error('Error rescheduling event:', error);
    info.revert();
  }
};

const handleEventResize = async (info) => {
  try {
    const event = info.event;
    const eventId = event.id;
    
    await apiClient.patch(`/scheduling/${eventId}/reschedule`, {
      startDate: event.start.toISOString()
    });
    
    // Refresh calendar and ModuleList data
    await fetchCalendarEvents();
    if (moduleListRef.value && moduleListRef.value.refresh) {
      moduleListRef.value.refresh();
    }
  } catch (error) {
    console.error('Error rescheduling event:', error);
    info.revert();
  }
};

// List view handlers
const handleRowClick = (row) => {
  openTab(`/events/${row._id || row.eventId}`, {
    title: row.eventName || t('events.eventsTabEventDetail'),
    background: false,
    insertAdjacent: true
  });
};

const handleBulkAction = async (action, rows) => {
  const eventIds = rows.map(event => event._id || event.eventId);
  
  try {
    if (action === 'delete' || action === 'bulk-delete') {
      return;
    }
    if (action === 'export') {
      // Export functionality handled by ModuleList
    }
  } catch (error) {
    console.error('Error performing bulk action:', error);
    notifications.error(t('common.eventsToastErrorPerformingBulkActionPlease'));
  }
};

const handleInlineDelete = async (row) => {
  if (!row) return;
  const id = row._id || row.eventId;
  if (!id) return;
  startBulkDelete({
    moduleKey: 'events',
    ids: [String(id)],
    onComplete: (outcome) => {
      void (async () => {
        if (outcome.cancelled) {
          if (outcome.deletedCount > 0) {
            await fetchCalendarEvents();
            moduleListRef.value?.refresh?.();
          }
          return;
        }
        if (outcome.failedCount > 0) {
          notifications.error(t('common.eventsToastErrorPerformingBulkActionPlease'));
          return;
        }
        await fetchCalendarEvents();
        moduleListRef.value?.refresh?.();
      })();
    },
    onError: (error) => {
      console.error('Error deleting event:', error);
      notifications.error(t('common.eventsToastErrorPerformingBulkActionPlease'));
    },
  });
};

const exportEvents = async () => {
  try {
    const response = await fetch('/api/csv/export/events', {
      headers: {
        'Authorization': `Bearer ${authStore.user?.token}`
      }
    });
    
    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `events_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting events:', error);
    notifications.error(t('common.eventsToastErrorExportingEventsPleaseTry'));
  }
};

// Helper function to get user display name
const getUserDisplayName = (user) => {
  if (!user) return '';
  if (typeof user === 'string') return user;
  const firstName = user.firstName || user.first_name || '';
  const lastName = user.lastName || user.last_name || '';
  return `${firstName} ${lastName}`.trim() || user.email || '';
};

// Event modal handlers
const openEventModal = (initialData = {}) => {
  eventQuickCreateInitialData.value = { ...initialData };
  showEventQuickCreate.value = true;
};

/** Open create drawer only after slot times are resolved (avoids racing empty initialData). */
const openEventModalWithCalendarSlot = async (selectInfo) => {
  const gateNow = Date.now();
  if (gateNow < calendarCreateGateUntil) return;
  calendarCreateGateUntil = gateNow + 500;
  let slot = {};
  try {
    slot = await resolveCalendarCreateDateTimes(selectInfo);
  } catch (err) {
    console.warn('[Events] Calendar create slot resolve failed:', err);
    slot = {};
  }
  openEventModal(slot);
  if (calendarRef.value) {
    try {
      calendarRef.value.getApi()?.unselect();
    } catch (_) {
      /* ignore */
    }
  }
};

const closeEventQuickCreate = () => {
  showEventQuickCreate.value = false;
  eventQuickCreateInitialData.value = {};
};

const handleEventQuickCreateSaved = async () => {
  closeEventQuickCreate();
  await fetchCalendarEvents();
  if (moduleListRef.value && moduleListRef.value.refresh) {
    moduleListRef.value.refresh();
  }
  // WorkspaceScopedDrawerShell leave transition is 300ms — remount/refetch mid-close collapses FC columns
  resizeCalendarSoon(350);
};

const editEventFromList = (row) => {
  if (!row) return;
  editingEvent.value = row;
  showEditDrawer.value = true;
};

const closeEditDrawer = () => {
  showEditDrawer.value = false;
  editingEvent.value = null;
};

const handleEditDrawerSaved = async () => {
  closeEditDrawer();
  await fetchCalendarEvents();
  if (moduleListRef.value?.refresh) {
    moduleListRef.value.refresh();
  }
  resizeCalendarSoon(350);
};

// Watch for dark mode changes
watch(() => document.documentElement.classList.contains('dark'), (newVal) => {
  isDarkMode.value = newVal;
  nextTick(() => {
    document.querySelectorAll('.calendar-view-container .fc-event[data-event-status]').forEach((el) => {
      el.style.removeProperty('--fc-event-text-color');
      const colors = getEventCalendarColors(el.dataset.eventStatus);
      el.style.setProperty('--fc-event-text-color', colors.text);
      el.querySelectorAll('.fc-event-main, .fc-event-title, .fc-event-time').forEach((node) => {
        node.style.color = colors.text;
      });
    });
  });
}, { immediate: true });

// Handle record creation events to refresh views
const handleRecordCreated = (event) => {
  const { moduleKey, record } = event.detail || {};
  
  // Only refresh if it's an events record
  if (moduleKey === 'events') {
    if (currentView.value === 'calendar') {
      scheduleCalendarFetch();
    } else if (moduleListRef.value?.refresh) {
      moduleListRef.value.refresh();
    }
  }
};

// Handle legacy event-created event
const handleEventCreated = () => {
  if (currentView.value === 'calendar') {
    scheduleCalendarFetch();
  } else if (moduleListRef.value?.refresh) {
    moduleListRef.value.refresh();
  }
};

function consumeCalendarSyncQuery() {
  const status = String(route.query.calendarSync || '');
  if (status !== 'connected' && status !== 'error') return;

  const provider = String(route.query.provider || '');
  const rawMessage = route.query.message != null ? String(route.query.message) : '';
  const decodedMessage = rawMessage ? decodeURIComponent(rawMessage.replace(/\+/g, ' ')) : '';

  const isOAuthPopup =
    typeof window !== 'undefined' &&
    window.opener &&
    window.opener !== window &&
    !window.opener.closed;

  if (isOAuthPopup) {
    try {
      const payload =
        status === 'connected'
          ? { type: 'user-calendar-oauth-result', status: 'connected', provider }
          : {
              type: 'user-calendar-oauth-result',
              status: 'error',
              provider,
              message: decodedMessage || t('events.calendarSyncConnectFailed')
            };
      window.opener.postMessage(payload, window.location.origin);
    } catch {
      /* ignore */
    }
    try {
      window.close();
    } catch {
      /* ignore */
    }
    return;
  }

  if (status === 'connected') {
    notifications.success(
      t('events.calendarSyncConnectedToast', {
        provider: provider === 'microsoft' ? 'Microsoft 365' : 'Google'
      })
    );
    showCalendarSyncModal.value = true;
  } else {
    notifications.error(decodedMessage || t('events.calendarSyncConnectFailed'));
  }

  const q = { ...route.query };
  delete q.calendarSync;
  delete q.provider;
  delete q.message;
  router.replace({ path: route.path, query: q });
}

onMounted(() => {
  checkDarkMode();
  initializeView();
  consumeCalendarSyncQuery();
  void ensureCalendarBusinessHourSet();

  // Apply view state after ModuleList renders
  nextTick(() => {
    setTimeout(() => {
      toggleTableView(isListView(currentView.value));
      syncAppointmentsScopeFromFilters();
    }, 100);
  });
  
  // Watch for dark mode changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        checkDarkMode();
      }
    });
  });
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });
  
  // Listen for record creation events
  if (typeof window !== 'undefined') {
    window.addEventListener('arivu:record-created', handleRecordCreated);
    window.addEventListener('arivu:event-created', handleEventCreated);
  }
});

// When returning to Events tab (keep-alive), re-sync view and refetch so UI loads correctly
onActivated(() => {
  initializeView();
  nextTick(() => {
    setTimeout(() => {
      toggleTableView(isListView(currentView.value));
      syncAppointmentsScopeFromFilters();
      if (currentView.value === 'calendar') {
        resizeCalendarSoon();
      }
    }, 80);
  });
});

onUnmounted(() => {
  // Clean up event listeners
  if (typeof window !== 'undefined') {
    window.removeEventListener('arivu:record-created', handleRecordCreated);
    window.removeEventListener('arivu:event-created', handleEventCreated);
  }
});
</script>

<style>
/* Hide table container when in calendar view - use JavaScript for more reliable control */
[data-view="calendar"] .mt-4.px-4.sm\:px-6.lg\:px-8:not(.calendar-view-container) {
  display: none;
}

[data-view="list"] .mt-4.px-4.sm\:px-6.lg\:px-8:not(.calendar-view-container) {
  display: block;
}

.calendar-view-container {
  display: block;
  width: 100%;
}

/* ------------------------------------------------------------------ */
/* Events calendar — full width, product-aligned typography/spacing   */
/* ------------------------------------------------------------------ */

.calendar-view-container .events-calendar.fc {
  --fc-border-color: rgb(229 231 235);
  --fc-today-bg-color: rgb(238 242 255 / 0.55);
  --fc-neutral-bg-color: rgb(249 250 251);
  --fc-page-bg-color: transparent;
  width: 100%;
  font-family: inherit;
}

.dark .calendar-view-container .events-calendar.fc {
  --fc-border-color: rgb(55 65 81);
  --fc-today-bg-color: rgb(67 56 202 / 0.12);
  --fc-neutral-bg-color: rgb(17 24 39);
}

.calendar-view-container .fc .fc-header-toolbar {
  margin-bottom: 0 !important;
  padding: 1rem 1rem 0.875rem;
  border-bottom: 1px solid rgb(243 244 246);
}

@media (min-width: 640px) {
  .calendar-view-container .fc .fc-header-toolbar {
    padding-left: 1.5rem;
    padding-right: 1.5rem;
  }
}

@media (min-width: 1024px) {
  .calendar-view-container .fc .fc-header-toolbar {
    padding-left: 2rem;
    padding-right: 2rem;
  }
}

.dark .calendar-view-container .fc .fc-header-toolbar {
  border-bottom-color: rgb(31 41 55);
}

.calendar-view-container .fc .fc-toolbar {
  gap: 0.5rem !important;
}

.calendar-view-container .fc .fc-toolbar-title {
  font-size: 1.25rem !important;
  font-weight: 600 !important;
  letter-spacing: -0.015em;
  color: rgb(17 24 39);
}

@media (min-width: 640px) {
  .calendar-view-container .fc .fc-toolbar-title {
    font-size: 1.5rem !important;
  }
}

.dark .calendar-view-container .fc .fc-toolbar-title {
  color: rgb(249 250 251);
}

.calendar-view-container .fc-theme-standard .fc-scrollgrid {
  border: none;
  border-radius: 0;
}

.calendar-view-container .fc .fc-col-header-cell {
  background: rgb(249 250 251);
}

.dark .calendar-view-container .fc .fc-col-header-cell {
  background: rgb(17 24 39);
}

.calendar-view-container .fc .fc-col-header-cell-cushion {
  padding: 0.625rem 0;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgb(107 114 128);
}

.dark .calendar-view-container .fc .fc-col-header-cell-cushion {
  color: rgb(156 163 175);
}

.calendar-view-container .fc .fc-daygrid-day-frame {
  min-height: 5.5rem;
}

.calendar-view-container .fc .fc-daygrid-day-number {
  float: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  margin: 0.375rem 0.5rem;
  padding: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(55 65 81);
  border-radius: 9999px;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.dark .calendar-view-container .fc .fc-daygrid-day-number {
  color: rgb(209 213 219);
}

.calendar-view-container .fc .fc-daygrid-day.fc-day-today {
  background-color: var(--fc-today-bg-color) !important;
}

.calendar-view-container .fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-number {
  background: rgb(79 70 229);
  color: rgb(255 255 255);
  font-weight: 600;
}

.dark .calendar-view-container .fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-number {
  background: rgb(99 102 241);
}

.calendar-view-container .fc .fc-daygrid-day.fc-day-other .fc-daygrid-day-number {
  color: rgb(156 163 175);
}

.dark .calendar-view-container .fc .fc-daygrid-day.fc-day-other .fc-daygrid-day-number {
  color: rgb(107 114 128);
}

.calendar-view-container .fc .fc-daygrid-day.fc-day-other {
  background: var(--fc-neutral-bg-color);
}

.dark .calendar-view-container .fc .fc-daygrid-day {
  background: rgb(31 41 55);
}

.dark .calendar-view-container .fc .fc-daygrid-day.fc-day-other {
  background: rgb(17 24 39);
}

/* Status-tinted event chips */
.calendar-view-container .fc .fc-event {
  margin: 2px 4px;
  padding: 2px 6px;
  border: none;
  border-radius: 0.375rem;
  border-left: 3px solid transparent;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.25rem;
  cursor: pointer;
  box-shadow: none;
  transition: filter 0.15s ease;
}

@media (min-width: 640px) {
  .calendar-view-container .fc .fc-event {
    font-size: 0.8125rem;
  }
}

.calendar-view-container .fc .fc-event:hover {
  filter: brightness(0.97);
}

.calendar-view-container .fc .fc-daygrid-event-dot {
  display: none;
}

.calendar-view-container .fc .fc-event-status-scheduled {
  --fc-event-text-color: rgb(55 48 163);
  --fc-event-bg-color: rgb(238 242 255);
  --fc-event-border-color: rgb(99 102 241);
  background: rgb(238 242 255) !important;
  border-left-color: rgb(99 102 241) !important;
  color: rgb(55 48 163) !important;
}

.calendar-view-container .fc .fc-event-status-completed {
  --fc-event-text-color: rgb(6 95 70);
  --fc-event-bg-color: rgb(236 253 245);
  --fc-event-border-color: rgb(16 185 129);
  background: rgb(236 253 245) !important;
  border-left-color: rgb(16 185 129) !important;
  color: rgb(6 95 70) !important;
}

.calendar-view-container .fc .fc-event-status-cancelled {
  --fc-event-text-color: rgb(71 85 105);
  --fc-event-bg-color: rgb(241 245 249);
  --fc-event-border-color: rgb(148 163 184);
  background: rgb(241 245 249) !important;
  border-left-color: rgb(148 163 184) !important;
  color: rgb(71 85 105) !important;
}

.calendar-view-container .fc .fc-event-status-in-progress {
  --fc-event-text-color: rgb(146 64 14);
  --fc-event-bg-color: rgb(255 251 235);
  --fc-event-border-color: rgb(245 158 11);
  background: rgb(255 251 235) !important;
  border-left-color: rgb(245 158 11) !important;
  color: rgb(146 64 14) !important;
}

.calendar-view-container .fc .fc-event[class*='fc-event-status-'] .fc-event-main,
.calendar-view-container .fc .fc-event[class*='fc-event-status-'] .fc-event-title,
.calendar-view-container .fc .fc-event[class*='fc-event-status-'] .fc-event-time {
  color: var(--fc-event-text-color) !important;
}

.dark .calendar-view-container .fc .fc-event-status-scheduled {
  --fc-event-text-color: rgb(199 210 254);
  --fc-event-bg-color: rgb(99 102 241 / 0.18);
  --fc-event-border-color: rgb(129 140 248);
  background: rgb(99 102 241 / 0.18) !important;
  border-left-color: rgb(129 140 248) !important;
  color: rgb(199 210 254) !important;
}

.dark .calendar-view-container .fc .fc-event-status-completed {
  --fc-event-text-color: rgb(167 243 208);
  --fc-event-bg-color: rgb(16 185 129 / 0.16);
  --fc-event-border-color: rgb(52 211 153);
  background: rgb(16 185 129 / 0.16) !important;
  border-left-color: rgb(52 211 153) !important;
  color: rgb(167 243 208) !important;
}

.dark .calendar-view-container .fc .fc-event-status-cancelled {
  --fc-event-text-color: rgb(203 213 225);
  --fc-event-bg-color: rgb(148 163 184 / 0.14);
  --fc-event-border-color: rgb(148 163 184);
  background: rgb(148 163 184 / 0.14) !important;
  border-left-color: rgb(148 163 184) !important;
  color: rgb(203 213 225) !important;
}

.dark .calendar-view-container .fc .fc-event-status-in-progress {
  --fc-event-text-color: rgb(253 230 138);
  --fc-event-bg-color: rgb(245 158 11 / 0.14);
  --fc-event-border-color: rgb(251 191 36);
  background: rgb(245 158 11 / 0.14) !important;
  border-left-color: rgb(251 191 36) !important;
  color: rgb(253 230 138) !important;
}

.calendar-view-container .fc .fc-daygrid-more-link {
  margin: 2px 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(79 70 229);
}

.dark .calendar-view-container .fc .fc-daygrid-more-link {
  color: rgb(165 180 252);
}

.calendar-view-container .fc .fc-highlight {
  background: rgb(99 102 241 / 0.08);
}

/* Time grid */
.calendar-view-container .fc .fc-timegrid-slot {
  height: 3rem;
}

.calendar-view-container .fc .fc-timegrid-slot-label {
  font-size: 0.75rem;
  color: rgb(107 114 128);
}

.dark .calendar-view-container .fc .fc-timegrid-slot-label {
  color: rgb(156 163 175);
}

.calendar-view-container .fc .fc-timegrid-event {
  border-radius: 0.375rem;
  border-left-width: 3px;
}

.calendar-view-container .fc .fc-timegrid-now-indicator-line {
  border-color: rgb(239 68 68);
  border-width: 2px;
}

.dark .calendar-view-container .fc .fc-timegrid-col,
.dark .calendar-view-container .fc .fc-timegrid-axis {
  background: rgb(31 41 55);
}

.dark .calendar-view-container .fc .fc-timegrid-axis {
  background: rgb(17 24 39);
}

/* List view */
.calendar-view-container .fc .fc-list-day-cushion {
  padding: 0.5rem 1rem;
  background: rgb(249 250 251);
  font-size: 0.75rem;
  font-weight: 600;
}

.dark .calendar-view-container .fc .fc-list-day-cushion {
  background: rgb(17 24 39);
  color: rgb(249 250 251);
}

.calendar-view-container .fc .fc-list-event:hover td {
  background: rgb(249 250 251);
}

.dark .calendar-view-container .fc .fc-list-event:hover td {
  background: rgb(55 65 81);
}

.dark .calendar-view-container .fc .fc-list-event-time,
.dark .calendar-view-container .fc .fc-list-event-title {
  color: rgb(209 213 219);
}

@media (max-width: 768px) {
  .calendar-view-container .fc .fc-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .calendar-view-container .fc .fc-toolbar-title {
    font-size: 1.125rem !important;
    text-align: center;
  }
}
</style>
