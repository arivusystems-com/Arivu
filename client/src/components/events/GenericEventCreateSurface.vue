<template>
  <div class="flex h-full flex-col bg-white dark:bg-gray-800">
    <!-- Scrollable Content Area -->
    <div class="flex-1 overflow-y-auto">
      <div class="px-4 sm:px-6 py-6">
        <div class="space-y-6">
          <!-- Helper Info Box -->
          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div class="flex items-start gap-3">
              <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p class="text-sm text-blue-800 dark:text-blue-300">
                  <strong>{{ t('events.genericEventCreateSurfaceLimitedScope') }}</strong>{{ t('events.genericEventCreateSurfaceThisInterfaceSupportsBasicEventCreation') }}</p>
              </div>
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
              </div>
            </div>
          </div>

          <!-- Form -->
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- Event Name -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('events.genericEventCreateSurfaceEventName') }}<span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.eventName"
                type="text"
                required
                maxlength="255"
                :placeholder="t('events.genericEventCreateSurfaceEnterEventName')"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <!-- Event Type -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('settings.integrationsEventType') }}<span class="text-red-500">*</span>
              </label>
              <select
                v-model="form.eventType"
                @change="onEventTypeChange"
                required
                :disabled="allowedEventTypes.length === 0"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option v-if="allowedEventTypes.length === 0" value="">{{ t('events.genericEventCreateSurfaceNoEventTypesAvailable') }}</option>
                <!-- ARCHITECTURE NOTE: Store key (MEETING) as value, display label (Meeting) to user -->
                <option v-else v-for="eventType in allowedEventTypes" :key="eventType.key" :value="eventType.key">
                  {{ eventType.label }}
                </option>
              </select>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('events.genericEventCreateSurfaceAuditEventsAreScheduledFromThe') }}</p>
            </div>

            <!-- Status (Intent-aware) -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('settings.settingsBhFieldStatus') }}</label>
              <select
                v-model="form.status"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option :value="null">{{ t('events.genericEventCreateSurfaceSelectStatus') }}</option>
                <option
                  v-for="status in allowedStatuses"
                  :key="status"
                  :value="status"
                >
                  {{ status }}
                </option>
              </select>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('events.genericEventCreateSurfaceEventIntentIsAUiGuidance') }}</p>
            </div>

            <!-- Date & Time -->
            <div class="grid grid-cols-2 gap-4">
              <!-- Start Date Time -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date & Time <span class="text-red-500">*</span>
                </label>
                <DateTimePicker
                  v-model="form.startDateTime"
                  input-class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
                />
              </div>

              <!-- End Date Time -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date & Time <span class="text-red-500">*</span>
                </label>
                <DateTimePicker
                  v-model="form.endDateTime"
                  input-class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
                />
              </div>
            </div>

            <!-- Location -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('events.genericEventCreateSurfaceLocation') }}</label>
              <EventLocationField
                :location="form.location"
                :geo-location="null"
                :geo-required="false"
                :placeholder="t('events.genericEventCreateSurfaceAddressOrLocationNameOptional')"
                @update:location="form.location = $event"
                @update:geo-location="() => {}"
              />
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Fixed Footer with Actions -->
    <div class="flex shrink-0 justify-end gap-3 px-4 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <button
        type="button"
        @click="handleCancel"
        class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
      >{{ t('performance.cancelWizard') }}</button>
      <button
        type="button"
        @click="handleSubmit"
        :disabled="saving"
        class="inline-flex justify-center rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <svg v-if="saving" class="animate-spin h-4 w-4 text-white mr-2" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {{ saving ? 'Creating...' : 'Create Event' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
/**
 * ============================================================================
 * GenericEventCreateSurface
 * ============================================================================
 * 
 * A simplified event creation interface for basic events only.
 * 
 * ARCHITECTURE NOTE: This surface is intentionally limited and does not support audit events.
 * 
 * Allowed event types:
 * - Meeting (always available)
 * - Field Sales Beat (if Sales app enabled)
 * 
 * Fields shown:
 * - eventName (required)
 * - eventType (required)
 * - startDateTime (required)
 * - endDateTime (required)
 * - location (optional)
 * 
 * Explicitly excluded:
 * - Audit roles (auditorId, reviewerId, correctiveOwnerId)
 * - auditState
 * - Forms (linkedFormId)
 * - Geo enforcement (geoRequired, geoLocation)
 * - Recurrence
 * - Org routes (orgList, routeSequence)
 * - Notes
 * - Related records
 * - Advanced configuration
 * 
 * See: docs/architecture/event-settings.md
 * ============================================================================
 */

import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import DateTimePicker from '@/components/common/DateTimePicker.vue';
import EventLocationField from '@/components/events/EventLocationField.vue';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import { getEventTypesForApp, EVENT_TYPES, getEventTypeByKey, getEventTypeDefinitionByKey } from '@/metadata/eventTypes';
import type { EventTypeDefinition } from '@/types/eventSettings.types';

const router = useRouter();
const authStore = useAuthStore();
const { openTab } = useTabs();

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({})
  }
});

const { t } = useI18n();

const emit = defineEmits(['created', 'cancelled']);

const saving = ref(false);
const error = ref('');

// ARCHITECTURE NOTE: Use canonical metadata to determine allowed event types.
// Filter by app using metadata.apps array, not string matching.
// This automatically excludes audit events and prevents future mistakes.
const allowedEventTypes = computed(() => {
  const appKey = 'SALES'; // GenericEventCreateSurface is for SALES app
  return getEventTypesForApp(appKey, true); // excludeAudit = true
});

// Get default event type (first allowed type)
const defaultEventType = computed(() => {
  if (allowedEventTypes.value.length > 0) {
    return allowedEventTypes.value[0];
  }
  return null;
});

// Form state - stores the event type KEY (e.g., 'MEETING'), not the label
const form = ref({
  eventName: props.initialData.eventName || '',
  eventType: props.initialData.eventType || '', // Will be set to key (MEETING)
  startDateTime: props.initialData.startDateTime || '',
  endDateTime: props.initialData.endDateTime || '',
  location: props.initialData.location || '',
  status: props.initialData.status || null
});

// ============================================================================
// EVENT INTENT AWARENESS
// ============================================================================
// 
// Event intent is a UI guidance layer, not enforcement.
// It provides read-only configuration that maps event types to
// allowed lifecycle statuses and default values.
// 
// This does NOT:
// - Enforce backend validation rules
// - Block submission of invalid combinations
// - Persist intent data
// 
// This DOES:
// - Filter visible status options based on selected event type
// - Auto-select default status in CREATE mode
// - Never auto-change existing status in EDIT mode
// 
// ============================================================================

// Get current event type definition
const currentEventTypeDefinition = computed(() => {
  if (!form.value.eventType) return null;
  return getEventTypeDefinitionByKey(form.value.eventType);
});

// Derive allowed statuses from EventTypeDefinition
const allowedStatuses = computed(() => {
  const eventTypeDef = currentEventTypeDefinition.value;
  
  // If no event type selected, return all statuses
  if (!eventTypeDef) {
    return ['Planned', 'Completed', 'Cancelled'];
  }
  
  // If event type has status config, use it
  if (eventTypeDef.statusConfig?.allowedStatuses) {
    return eventTypeDef.statusConfig.allowedStatuses;
  }
  
  // If no status config, show all statuses
  return ['Planned', 'Completed', 'Cancelled'];
});

// Derive default status from EventTypeDefinition
const defaultStatus = computed(() => {
  const eventTypeDef = currentEventTypeDefinition.value;
  
  if (!eventTypeDef) return null;
  
  return eventTypeDef.statusConfig?.defaultStatus || null;
});

// Watch eventType changes to update status
// CREATE mode: Auto-select defaultStatus if no status is selected
watch(() => form.value.eventType, (newEventType) => {
  if (!newEventType) return;
  
  const eventTypeDef = getEventTypeDefinitionByKey(newEventType);
  
  // DEV-ONLY: Warn if no EventTypeDefinition found
  if (process.env.NODE_ENV === 'development') {
    if (!eventTypeDef) {
      console.warn(
        '[GenericEventCreateSurface] No EventTypeDefinition found for event type:',
        newEventType
      );
    }
  }
  
  // CREATE mode: Auto-select defaultStatus if no status is selected
  // This surface is always in CREATE mode (GenericEventCreateSurface)
  if (eventTypeDef?.statusConfig?.defaultStatus) {
    const newDefaultStatus = eventTypeDef.statusConfig.defaultStatus;
    
    // DEV-ONLY: Assert that defaultStatus is in allowedStatuses
    if (process.env.NODE_ENV === 'development') {
      const allowed = eventTypeDef.statusConfig.allowedStatuses || [];
      if (allowed.length > 0 && !allowed.includes(newDefaultStatus)) {
        console.assert(
          false,
          '[GenericEventCreateSurface] defaultStatus is not in allowedStatuses',
          {
            eventType: newEventType,
            defaultStatus: newDefaultStatus,
            allowedStatuses: allowed
          }
        );
      }
    }
    
    // Only auto-select if no status is currently selected
    if (!form.value.status) {
      form.value.status = newDefaultStatus;
    }
  }
}, { immediate: false });

// Handle event type change
const onEventTypeChange = () => {
  // The watch handler will handle status updates
  // This function exists for explicit @change binding
};

// Initialize default event type on mount
onMounted(() => {
  // Set default event type key if not provided in initialData
  if (!form.value.eventType && defaultEventType.value) {
    form.value.eventType = defaultEventType.value.key;
  }
  
  // Initialize status based on event type (CREATE mode only)
  if (!props.initialData.status && form.value.eventType) {
    const eventTypeDef = getEventTypeDefinitionByKey(form.value.eventType);
    if (eventTypeDef?.statusConfig?.defaultStatus) {
      form.value.status = eventTypeDef.statusConfig.defaultStatus;
    }
  }
});

// Validate form
const validateForm = () => {
  error.value = '';

  // Validate dates
  if (!form.value.startDateTime || !form.value.endDateTime) {
    error.value = 'Start and end date/time are required.';
    return false;
  }

  const startDate = new Date(form.value.startDateTime);
  const endDate = new Date(form.value.endDateTime);

  if (isNaN(startDate.getTime())) {
    error.value = 'Invalid start date/time.';
    return false;
  }

  if (isNaN(endDate.getTime())) {
    error.value = 'Invalid end date/time.';
    return false;
  }

  if (endDate <= startDate) {
    error.value = 'End date/time must be after start date/time.';
    return false;
  }

  // Validate event type is selected
  if (!form.value.eventType) {
    error.value = 'Event type is required.';
    return false;
  }

  // ARCHITECTURE NOTE: Validate against canonical metadata
  // form.value.eventType contains the key (e.g., 'MEETING'), not the label
  const selectedEventType = getEventTypeByKey(form.value.eventType);
  if (!selectedEventType) {
    error.value = `Invalid event type "${form.value.eventType}". Please select from available types.`;
    return false;
  }

  // Prevent audit event creation through this surface
  if (selectedEventType.audit) {
    error.value = 'Audit events cannot be created through this interface. Please use the Audit module.';
    return false;
  }

  // Validate event type is allowed for SALES app
  if (!selectedEventType.apps.includes('SALES')) {
    error.value = `Event type "${selectedEventType.label}" is not available in Sales app.`;
    return false;
  }

  return true;
};

// Handle form submission
const handleSubmit = async () => {
  if (!validateForm()) {
    return;
  }

  saving.value = true;
  error.value = '';

  try {
    // ARCHITECTURE NOTE: Send event type KEY (e.g., "MEETING") to backend.
    // Backend projection resolver will:
    // 1. Validate the key against allowed projection types
    // 2. Map the key to model value (e.g., "MEETING" -> "Meeting")
    // This ensures canonical validation and prevents label ↔ enum boundary violations.
    const selectedEventType = getEventTypeByKey(form.value.eventType);
    if (!selectedEventType) {
      error.value = `Invalid event type "${form.value.eventType}". Please select from available types.`;
      saving.value = false;
      return;
    }

    // Prepare payload - only include allowed fields
    // Send KEY to backend - backend projection resolver will validate and map to label
    const payload: {
      eventName: string;
      eventType: string;
      startDateTime: string;
      endDateTime: string;
      location: string | null;
      assignedTo: string | null;
      status?: string;
    } = {
      eventName: form.value.eventName.trim(),
      eventType: selectedEventType.key, // Send key (MEETING) - backend will map to label (Meeting)
      startDateTime: new Date(form.value.startDateTime).toISOString(),
      endDateTime: new Date(form.value.endDateTime).toISOString(),
      location: form.value.location?.trim() || null,
      // Set assignedTo to current user (system will handle this if not provided)
      assignedTo: authStore.user?._id || null
    };
    
    // ARCHITECTURE NOTE: Status is included for UI guidance, but backend may override it.
    // Backend validation will determine final status value.
    // Event intent is a UI guidance layer, not enforcement.
    if (form.value.status) {
      payload.status = form.value.status;
    }

    // ARCHITECTURE NOTE: Explicitly exclude audit-related fields
    // These should never be sent from this surface:
    // - auditorId, reviewerId, correctiveOwnerId (audit roles)
    // - auditState
    // - linkedFormId (forms)
    // - geoRequired, geoLocation (geo enforcement)
    // - recurrence
    // - orgList, routeSequence (org routes)
    // - notes, relatedToId (advanced features)

    console.log('[GenericEventCreateSurface] Creating event:', payload);

    const response = await apiClient.post('/events', payload);

    if (response.success) {
      emit('created', response.data);
      
      // Open the saved event in a new tab
      if (response.data) {
        const eventId = response.data.eventId || response.data._id;
        if (eventId) {
          const eventTitle = response.data.eventName || response.data.title || 'Event';
          openTab(`/events/${eventId}`, {
            title: eventTitle,
            icon: '📅'
          });
        }
      }
      
      // Dispatch global event to refresh calendar/list views
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('arivu:event-created', {
          detail: { event: response.data }
        }));
      }
      
      // ARCHITECTURE NOTE: Navigation is handled by parent component (drawer or surface)
      // When used in EventQuickCreateDrawer, parent will handle navigation if needed
      // When used as standalone surface, parent can navigate or handle as appropriate
    } else {
      error.value = response.message || 'Failed to create event. Please try again.';
    }
  } catch (err: unknown) {
    console.error('[GenericEventCreateSurface] Error creating event:', err);
    const errorObj = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
    if (errorObj.response?.data?.message) {
      error.value = errorObj.response.data.message;
    } else if (errorObj.response?.data?.error) {
      error.value = errorObj.response.data.error;
    } else if (errorObj.message) {
      error.value = errorObj.message;
    } else {
      error.value = 'Error creating event. Please try again.';
    }
  } finally {
    saving.value = false;
  }
};

// Handle cancel
const handleCancel = () => {
  emit('cancelled');
  // ARCHITECTURE NOTE: Navigation is handled by parent component
  // When used in drawer, parent closes drawer. When used as surface, parent can navigate.
  // Only navigate if we're actually on the create route (standalone surface mode)
  if (router.currentRoute.value.path === '/events/create') {
    router.back();
  }
};
</script>
