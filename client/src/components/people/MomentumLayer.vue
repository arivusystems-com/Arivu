<template>
  <div class="mb-6">
    <!-- Layer Header -->
    <div class="mb-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('people.momentumLayerMomentum') }}</span>
      </div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
        What matters now?
      </h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">{{ t('people.momentumLayerCurrentActivityAndPriorities') }}</p>
    </div>

    <!-- Momentum Signals -->
    <div v-if="signals.length > 0" class="space-y-3">
      <MomentumSignal
        v-for="signal in visibleSignals"
        :key="signal.id"
        :severity="signal.severity"
        :message="signal.message"
        :context="signal.context"
        :action="signal.action"
        :dismissible="true"
        @dismiss="handleDismiss(signal.id)"
        @action="handleAction"
      />
      
      <!-- View More / Collapse -->
      <div v-if="signals.length > 3" class="pt-2">
        <button
          v-if="!showAllSignals"
          @click="showAllSignals = true"
          class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium flex items-center gap-1"
        >
          <span>View {{ signals.length - 3 }} more signal{{ signals.length - 3 > 1 ? 's' : '' }}</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          v-else
          @click="showAllSignals = false"
          class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium flex items-center gap-1"
        >
          <span>{{ t('people.momentumLayerShowLess') }}</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
      
      <!-- Additional Signals (collapsed) -->
      <div v-if="showAllSignals && signals.length > 3" class="space-y-3 pt-2">
        <MomentumSignal
          v-for="signal in remainingSignals"
          :key="signal.id"
          :severity="signal.severity"
          :message="signal.message"
          :context="signal.context"
          :action="signal.action"
          :dismissible="true"
          @dismiss="handleDismiss(signal.id)"
          @action="handleAction"
        />
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="px-6 py-12 text-center">
        <div class="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">{{ t('people.momentumLayerNothingNeedsAttentionRightNow') }}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('people.momentumLayerAllSystemsAreUpToDate') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import MomentumSignal from './MomentumSignal.vue';
import { deriveMomentumSignals, sortSignalsBySeverity } from './momentum/deriveMomentumSignals';
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '@/stores/authRegistry';
import { PEOPLE_PERMISSIONS } from '@/platform/permissions/peoplePermissions';
import { hasPeoplePermission } from '@/platform/permissions/peoplePermissionHelper';

const props = defineProps({
  profileData: {
    type: Object,
    default: null
  },
  appContext: {
    type: Object,
    default: null
  },
  personId: {
    type: String,
    default: null
  },
  attachModalOpen: {
    type: Boolean,
    default: false
  },
  convertModalOpen: {
    type: Boolean,
    default: false
  },
  staleSuppressedApps: {
    type: Set,
    default: () => new Set()
  }
});

const { t } = useI18n();

const emit = defineEmits(['convert', 'edit', 'edit-details', 'attach-to-app', 'add-activity']);

const authStore = useAuthStore();

// Local state for dismissed signals (not persisted)
// IMPORTANT: This Set is reinitialized on every component mount
// Dismissal only hides signals for the current session
// On reload/remount, signals are recomputed fresh from profileData
// This ensures signals always reflect current reality, not user memory
const dismissedSignalIds = ref(new Set());

// Show all signals toggle
const showAllSignals = ref(false);

// Derive signals from profileData (logic separated into helper module)
// IMPORTANT: This computed recomputes whenever profileData changes
// Signal IDs include timestamp + random, so they're unique per computation
// This means dismissed signals from previous computations won't match new signal IDs
// Pass personId so handlers can scroll to status badge
// Pass suppression context to hide signals when user is actively resolving them
const allSignals = computed(() => {
  const suppressionContext = {
    attachModalOpen: props.attachModalOpen,
    convertModalOpen: props.convertModalOpen,
    staleSuppressedApps: props.staleSuppressedApps
  };
  const derivedSignals = deriveMomentumSignals(props.profileData, props.personId, suppressionContext);
  return sortSignalsBySeverity(derivedSignals);
});

// Filter out dismissed signals and gate actions by permissions
const signals = computed(() => {
  const filteredSignals = allSignals.value.filter(signal => !dismissedSignalIds.value.has(signal.id));
  
  // Gate actions by permissions - remove action if user doesn't have permission
  // Signal card always renders, but action button only if permission passes
  return filteredSignals.map(signal => {
    // If signal has no action, return as-is
    if (!signal.action || !signal.action.handler) {
      return signal;
    }
    
    // Determine permission based on action intent and context
    let hasPermission = false;
    const appKey = signal.context;
    
    // Check permission based on signal type and action intent
    if (signal.type === 'MISSING_REQUIRED_FIELDS') {
      // "Fix now" action - check EDIT_PARTICIPATION permission
      const permissionKey = PEOPLE_PERMISSIONS.EDIT_PARTICIPATION[appKey] || PEOPLE_PERMISSIONS.EDIT_PARTICIPATION.BASE;
      hasPermission = hasPeoplePermission(permissionKey, authStore);
    } else if (signal.type === 'LEAD_READY_FOR_CONVERSION') {
      // Convert action - check LIFECYCLE permission
      const permissionKey = appKey === 'SALES' 
        ? PEOPLE_PERMISSIONS.LIFECYCLE.SALES 
        : PEOPLE_PERMISSIONS.LIFECYCLE.BASE;
      hasPermission = hasPeoplePermission(permissionKey, authStore);
    } else if (signal.type === 'DETACHED_REATTACHABLE') {
      // Attach action - check ATTACH permission
      const permissionKey = PEOPLE_PERMISSIONS.ATTACH[appKey] || PEOPLE_PERMISSIONS.ATTACH.BASE;
      hasPermission = hasPeoplePermission(permissionKey, authStore);
    } else {
      // For other actions (engage, review, investigate, view), allow by default
      // These are typically read-only or low-risk actions
      hasPermission = true;
    }
    
    // If no permission, remove action but keep signal
    if (!hasPermission) {
      return {
        ...signal,
        action: {
          ...signal.action,
          handler: null, // Remove handler to hide action button
          label: signal.action.label // Keep label for potential future use, but button won't render
        }
      };
    }
    
    return signal;
  });
});

// Enforce max 1 critical signal (calm guarantee)
// Show max 3 signals total, but never more than 1 critical
const visibleSignals = computed(() => {
  const criticalSignals = signals.value.filter(s => s.severity === 'critical');
  const nonCriticalSignals = signals.value.filter(s => s.severity !== 'critical');
  
  // Take max 1 critical signal
  const selectedCritical = criticalSignals.slice(0, 1);
  
  // Fill remaining slots with non-critical signals
  const remainingSlots = Math.max(0, 3 - selectedCritical.length);
  const selectedNonCritical = nonCriticalSignals.slice(0, remainingSlots);
  
  return [...selectedCritical, ...selectedNonCritical];
});

// Remaining signals (beyond first 3)
const remainingSignals = computed(() => {
  return signals.value.slice(3);
});

// Handle signal dismissal (local-only, not persisted)
const handleDismiss = (signalId) => {
  dismissedSignalIds.value.add(signalId);
};

// Handle action from signal
const handleAction = (actionData) => {
  // If signal has a handler, call it
  if (actionData.handler && typeof actionData.handler === 'function') {
    actionData.handler();
  }
  
  // Also handle via custom events for parent component integration
  if (actionData.intent === 'update' && actionData.context === 'SALES') {
    // Handle status update actions
    const badgeId = `status-badge-SALES-${props.personId}`;
    const badgeElement = document.getElementById(badgeId);
    if (badgeElement) {
      badgeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => {
        badgeElement.click();
      }, 300);
    }
  }
};

// Listen for momentum-action events from signal handlers
const handleMomentumAction = (event) => {
  const { action, appKey, personId } = event.detail;
  
  switch (action) {
    case 'edit-participation':
      emit('edit', appKey);
      break;
    case 'edit-details':
      emit('edit-details', appKey);
      break;
    case 'convert-lead':
      emit('convert', appKey);
      break;
    case 'attach-to-app':
      emit('attach-to-app');
      break;
    case 'add-activity':
      emit('add-activity', appKey, personId);
      break;
  }
};

onMounted(() => {
  window.addEventListener('momentum-action', handleMomentumAction);
});

onUnmounted(() => {
  window.removeEventListener('momentum-action', handleMomentumAction);
});
</script>
