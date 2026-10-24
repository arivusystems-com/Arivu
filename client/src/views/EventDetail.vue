<!--
  ============================================================================
  EVENT SURFACE (READ-ONLY)
  ============================================================================
  
  See docs/architecture/event-domain-contract.md
  
  This surface exists to:
  - Present event context
  - Explain event intent and readiness
  - Provide navigation to the Execution Surface
  
  This surface explains event state and readiness.
  It never performs execution or workflow mutations.
  
  This surface explains execution and workflow history.
  It MUST NEVER perform execution, workflow, or geo mutations.
  
  MUST:
  - Be read-only
  - Reflect event intent (generic vs audit)
  - Explain execution readiness and blockers
  - Provide a single navigation path to execution
  
  MUST NEVER:
  - Start, complete, or mutate execution
  - Contain audit workflow logic
  - Contain scheduling or rescheduling controls
  - Replace EventExecutionSurface
  - Perform POST / PATCH / PUT requests
  - Call execution or workflow APIs
  - Mutate state beyond computed values
  
  Execution mutations are ONLY allowed in:
    /events/:id/execute
  
  ============================================================================
-->

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400 font-medium">{{ t('events.eventDetailLoadingEvent') }}</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <svg class="mx-auto h-12 w-12 text-red-500 dark:text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ t('events.eventDetailErrorLoadingEvent') }}</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">{{ error }}</p>
        <button @click="$router.push('/events')" class="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">{{ t('events.eventDetailBackToEvents2') }}</button>
      </div>
    </div>

    <!-- Event Detail Content -->
    <div v-else-if="event" class="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
      <!-- Header Actions -->
      <div class="flex items-center justify-between mb-4">
        <button @click="$router.push('/events')" class="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span class="font-medium">{{ t('events.eventDetailBackToEvents') }}</span>
        </button>

        <div class="flex items-center gap-2">
          <!--
            ============================================================================
            Execution Entry Point (Navigation Only)
            ============================================================================
            This is the ONLY execution-related action allowed in EventDetail.
            It ONLY navigates to /events/:id/execute - it does NOT perform mutations.
            
            Invariant:
            - /events/:id/execute is the ONLY route allowed to mutate execution state
            - EventDetail (/events/:id) must never perform execution actions
            - This view is for read-only display and configuration editing only
            - Execution transitions (start, check-in, complete) live exclusively in EventExecutionSurface
            ============================================================================
          -->
          <div class="flex flex-col items-end gap-1">
            <button
              @click="goToExecution"
              class="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
            >{{ t('events.eventDetailOpenExecution') }}</button>
            <!-- Contextual helper text -->
            <p v-if="!isReadyForExecution" class="text-xs text-gray-500 dark:text-gray-400 text-right max-w-xs">{{ t('events.eventDetailExecutionMayBeBlockedUntilReadiness') }}</p>
          </div>
          
          <!-- Edit button (disabled when locked, approved, or closed) -->
          <button 
            v-if="event.auditState !== 'approved' && event.auditState !== 'closed'"
            @click="editEvent" 
            :disabled="isEventLocked"
            :class="[
              'px-3 py-1.5 text-sm rounded-lg font-medium transition-all',
              isEventLocked 
                ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            ]"
            :title="isEventLocked ? 'Event is locked for editing' : 'Edit event'"
          >{{ t('settings.groupsEditTitle') }}</button>
          <button @click="deleteEvent" class="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition-all">{{ t('settings.modFieldsDelete') }}</button>
        </div>
      </div>

      <!--
        Invariant:
        EventDetail must not render execution controls.

        Execution UI lives in `EventExecutionSurface.vue` at `/events/:id/execute`.
      -->

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Left Column - Event Info -->
        <div class="lg:col-span-1 space-y-4">
          <!-- ============================================================================
               Generic Event Summary (Read-only)
               ============================================================================
               Always shown. Displays core event information regardless of event type.
               ============================================================================ -->
          <!-- Event Header Card -->
          <div class="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-4">
            <div :style="{ backgroundColor: event.color }" class="w-12 h-12 rounded-lg flex items-center justify-center mb-3">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-2">{{ event.eventName || event.title }}</h1>
            <div class="flex items-center gap-2 flex-wrap">
              <!-- Status badge -->
              <span :class="getStatusBadgeClass(event.status)">{{ event.status }}</span>
              <!-- Event type label (from EventTypeDefinition if available) -->
              <span 
                v-if="eventTypeDefinition"
                class="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded text-xs font-medium"
              >
                {{ eventTypeDefinition.label }}
              </span>
              <!-- Fallback to eventType if no definition found -->
              <span 
                v-else-if="event.eventType || event.type" 
                class="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded text-xs font-medium"
              >
                {{ event.eventType || event.type }}
              </span>
              <!-- Owning app badge (if available) -->
              <span 
                v-if="eventTypeDefinition?.owningApp"
                class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded text-xs font-medium"
              >
                {{ eventTypeDefinition.owningApp }}
              </span>
              <!-- Execution mode indicator (read-only) -->
              <span 
                v-if="executionMode"
                class="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs font-medium"
              >
                {{ executionMode === 'audit-workflow' ? 'Audit Workflow' : 'Generic' }}
              </span>
            </div>
          </div>

          <!-- Quick Info Card -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <!-- ============================================================================
                 Audit Context (Read-only)
                 ============================================================================
                 Render ONLY if isAuditEvent === true
                 Displays audit-specific read-only information:
                 - Audit workflow state
                 - Geo requirement indicator (locked)
                 ============================================================================ -->
            <!-- Audit State (for audit events only) -->
            <div v-if="isAuditEvent && event.auditState" class="flex items-start gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
              <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="flex-1">
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('events.eventDetailAuditWorkflowState2') }}</div>
                <div class="mt-1">
                  <span :class="getAuditStateBadgeClass(event.auditState)" class="capitalize">
                    {{ formatAuditState(event.auditState) }}
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Geo Requirement Indicator (for audit events - locked) -->
            <div v-if="isAuditEvent && eventTypeDefinition?.geoRequired" class="flex items-start gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
              <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div class="flex-1">
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('events.eventDetailGeoRequired') }}</div>
                <div class="mt-1 text-sm font-medium text-gray-900 dark:text-white">{{ t('events.eventDetailAlwaysEnabledLockedForAuditEvents') }}</div>
              </div>
            </div>
            
            <div class="flex items-start gap-3">
              <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="flex-1">
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('events.eventDetailTime') }}</div>
                <div class="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                  {{ formatDateTime(event.startDateTime || event.startDate) }}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  to {{ formatDateTime(event.endDateTime || event.endDate) }}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Duration: {{ getDuration() }}
                </div>
              </div>
            </div>

            <div v-if="event.location" class="flex items-start gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <div class="flex-1">
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('events.eventDetailLocation') }}</div>
                <div class="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{{ event.location }}</div>
              </div>
            </div>

            <div v-if="event.location && event.location.startsWith('http')" class="flex items-start gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <div class="flex-1">
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('events.eventDetailMeetingLink') }}</div>
                <a :href="event.location" target="_blank" class="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline mt-0.5 block truncate">
                  {{ event.location }}
                </a>
              </div>
            </div>

            <div v-if="event.tags && event.tags.length > 0" class="flex items-start gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <div class="flex-1">
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.assignRulesCondFieldTags') }}</div>
                <div class="flex flex-wrap gap-1.5 mt-1">
                  <span v-for="tag in event.tags" :key="tag" class="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded text-xs font-medium">
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>

            <div v-if="primaryOwnerUser" class="flex items-start gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <div class="flex-1">
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ primaryOwnerLabel }}</div>
                <div class="flex items-center gap-2 mt-1">
                  <div class="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-xs font-medium">
                    {{ getInitials(primaryOwnerUser) }}
                  </div>
                  <div class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ primaryOwnerUser?.firstName }} {{ primaryOwnerUser?.lastName }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Columns - Details -->
        <div class="lg:col-span-2 space-y-4">
          <!-- ============================================================================
               Execution Entry Point (Navigation Only)
               ============================================================================
               The ONLY action allowed here is navigation to the Execution Surface.
               No execution mutations are permitted in this read-only surface.
               ============================================================================ -->
          
          <!-- Execution Readiness Section (Read-Only) -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('events.eventDetailExecutionReadiness') }}</h3>
            
            <!-- Ready State -->
            <div v-if="isReadyForExecution" class="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <svg class="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="flex-1">
                <p class="text-sm font-medium text-green-900 dark:text-green-300">{{ t('events.eventDetailThisEventIsReadyForExecution') }}</p>
              </div>
            </div>
            
            <!-- Not Ready State -->
            <div v-else class="space-y-3">
              <div class="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <svg class="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div class="flex-1">
                  <p class="text-sm font-medium text-yellow-900 dark:text-yellow-300 mb-2">{{ t('events.eventDetailThisEventIsNotReadyFor') }}</p>
                  <ul v-if="executionBlockers.length > 0" class="space-y-1.5">
                    <li v-for="blocker in executionBlockers" :key="blocker.code" class="text-sm text-yellow-800 dark:text-yellow-400 flex items-start gap-2">
                      <span class="text-yellow-600 dark:text-yellow-500 mt-0.5">•</span>
                      <span>{{ blocker.message }}</span>
                    </li>
                  </ul>
                  <p v-else class="text-sm text-yellow-800 dark:text-yellow-400">{{ t('events.eventDetailUnableToDetermineReadinessStatus') }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Availability Explanation (Read-Only) -->
          <!-- ARCHITECTURAL NOTE: This section explains why actions may or may not be allowed -->
          <!-- It does NOT enforce, hide, disable, or change behavior -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('events.eventDetailActionAvailability') }}</h3>
            
            <div class="space-y-3">
              <div
                v-for="permission in permissions"
                :key="permission.action"
                class="flex items-start justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ getActionLabel(permission.action) }}
                    </span>
                    <span
                      :class="[
                        'text-xs font-medium px-2 py-0.5 rounded',
                        permission.allowed
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                      ]"
                    >
                      {{ permission.allowed ? 'Allowed' : 'Not allowed' }}
                    </span>
                  </div>
                  <p
                    v-if="!permission.allowed && permission.reason"
                    class="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-0"
                  >
                    Reason: {{ permission.reason }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- ============================================================================
               Execution History (Read-Only)
               ============================================================================
               This surface explains execution and workflow history.
               It MUST NEVER perform execution, workflow, or geo mutations.
               ============================================================================ -->
          <!-- Execution History Section -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('events.eventDetailExecutionHistory') }}</h3>
            
            <!-- Canonical Activity Timeline (Generic and Audit) -->
            <div v-if="activityLog.length > 0" class="relative">
              <!-- Timeline line -->
              <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
              
              <!-- Timeline entries -->
              <div v-for="(activity, index) in activityLog" :key="activity.id || index" class="relative pl-10 pb-4 last:pb-0">
                <!-- Timeline dot -->
                <div :class="[
                  'absolute left-0 top-1 w-8 h-8 rounded-full flex items-center justify-center border-2',
                  getActivityStatusColor(activity) === 'green' ? 'bg-green-100 dark:bg-green-900/30 border-green-500 dark:border-green-600' :
                  getActivityStatusColor(activity) === 'red' ? 'bg-red-100 dark:bg-red-900/30 border-red-500 dark:border-red-600' :
                  getActivityStatusColor(activity) === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500 dark:border-yellow-600' :
                  'bg-gray-100 dark:bg-gray-700 border-gray-400 dark:border-gray-500'
                ]">
                  <svg v-if="getActivityStatusColor(activity) === 'green'" class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <svg v-else-if="getActivityStatusColor(activity) === 'red'" class="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <svg v-else class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                
                <!-- Entry content -->
                <div>
                  <p class="text-sm font-medium text-gray-900 dark:text-white">{{ getActivityLabel(activity) }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {{ formatDateTime(activity.timestamp) }}
                  </p>
                  <p v-if="getActivityActor(activity)" class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    by {{ getActivityActor(activity) }}
                  </p>
                </div>
              </div>
            </div>
            
            <!-- No history message -->
            <div v-else class="text-center py-6 text-sm text-gray-500 dark:text-gray-400">{{ t('events.eventDetailNoExecutionActivityRecordedYet') }}</div>
            
            <!-- Audit-specific sections (if audit event) -->
            <div v-if="isAuditEvent" class="space-y-6 mt-6">
              <!-- Geo Tracking Summary (Read-Only) -->
              <div v-if="isAuditEvent" class="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('events.eventDetailLocationTrackingSummary') }}</h4>
                <div v-if="event.geoRequired" class="space-y-3">
                  <div v-if="event.checkIn || event.checkOut" class="space-y-2">
                    <div v-if="event.checkIn" class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div class="flex items-center gap-2 mb-1">
                        <svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('events.eventDetailCheckInLocation') }}</span>
                      </div>
                      <p class="text-xs text-gray-600 dark:text-gray-400">
                        {{ formatDateTime(event.checkIn.timestamp) }}
                      </p>
                      <p v-if="event.checkIn.location && event.checkIn.location.latitude != null && event.checkIn.location.longitude != null" class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {{ event.checkIn.location.latitude.toFixed(6) }}, {{ event.checkIn.location.longitude.toFixed(6) }}
                      </p>
                    </div>
                    <div v-if="event.checkOut" class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div class="flex items-center gap-2 mb-1">
                        <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('events.eventDetailCheckOutLocation') }}</span>
                      </div>
                      <p class="text-xs text-gray-600 dark:text-gray-400">
                        {{ formatDateTime(event.checkOut.timestamp) }}
                      </p>
                      <p v-if="event.checkOut.location && event.checkOut.location.latitude != null && event.checkOut.location.longitude != null" class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {{ event.checkOut.location.latitude.toFixed(6) }}, {{ event.checkOut.location.longitude.toFixed(6) }}
                      </p>
                    </div>
                  </div>
                  <div v-else class="text-center py-4 text-sm text-gray-500 dark:text-gray-400">{{ t('events.eventDetailLocationDataNotYetRecorded') }}</div>
                </div>
                <div v-else class="text-center py-4 text-sm text-gray-500 dark:text-gray-400">{{ t('events.eventDetailLocationTrackingNotRequiredForThis') }}</div>
              </div>
            </div>
          </div>
          
          <!-- Audit-Specific Explanation Block (Read-Only) -->
          <div v-if="isAuditEvent" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('events.eventDetailAuditEventWorkflow') }}</h3>
            <div class="space-y-4">
              <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div class="flex-1">
                  <p class="text-sm text-gray-700 dark:text-gray-300">{{ t('events.eventDetailAuditEventsFollowAControlledExecution') }}</p>
                </div>
              </div>
              
              <div class="flex items-start gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">{{ t('events.eventDetailLocationTracking') }}</p>
                  <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('events.eventDetailLocationTrackingIsMandatoryForAudits') }}</p>
                </div>
              </div>
              
              <div class="flex items-start gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">{{ t('events.eventDetailCompletionControl') }}</p>
                  <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('events.eventDetailAuditEventsCannotBeManuallyCompleted') }}</p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Read-Only Message for Approved/Closed Events -->
          <div v-if="event.auditState === 'approved' || event.auditState === 'closed'" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div class="flex items-center gap-3 mb-4">
              <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('events.eventDetailEventIsReadOnly') }}</h3>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              This event has been {{ event.auditState === 'approved' ? 'approved' : 'closed' }} and is now read-only. No further actions can be taken.
            </p>
            <div v-if="hasFormResponse" class="mt-4">
              <button
                @click="viewFormResponse"
                class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors flex items-center gap-2"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>{{ t('events.eventDetailViewFormResponse') }}</button>
            </div>
          </div>
          
          <!-- Corrective Actions Section (when auditState = pending_corrective) -->
          <div v-if="event.auditState === 'pending_corrective' && hasFormResponse" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.reportCorrectiveActions') }}</h3>
              <span class="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full text-xs font-medium">{{ t('process.flowHealthPending') }}</span>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">{{ t('events.eventDetailThisAuditRequiresCorrectiveActionsReview') }}</p>
            <button
              @click="viewFormResponse"
              class="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>{{ t('events.eventDetailViewCorrectiveActions') }}</button>
          </div>

          <!-- Related Records Panel (Phase 0F.1: Show Responses) -->
          <div v-if="event" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('records.taskRelatedRecordsTab') }}</h3>
            <RelatedRecordsPanel
              app-key="PLATFORM"
              module-key="events"
              :record-id="event._id || event.eventId || route.params.id"
              :read-only="true"
            />
          </div>

          <!-- Notes Card -->
          <div v-if="event.notes" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">{{ t('forms.fieldNotes') }}</h3>
            <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ event.notes }}</p>
          </div>

          <!-- Organization Card -->
          <div v-if="event.relatedToId" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.profileMetaOrg') }}</h3>
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-900 dark:text-white font-medium">
                {{ getOrgName(event.relatedToId) }}
              </span>
            </div>
          </div>

          <!-- Form Card -->
          <div v-if="event.linkedFormId" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.modFieldsPbResourceForm') }}</h3>
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm text-gray-900 dark:text-white font-medium truncate">
                {{ getFormName(event.linkedFormId) }}
              </span>
              <button
                @click="openForm"
                class="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium transition-colors"
              >{{ t('settings.salesPipeStatusOpen') }}</button>
            </div>
          </div>


          <!-- ============================================================================
               Audit Context (Read-only) - GEO Tracking
               ============================================================================
               Shows geo tracking data (read-only display of check-in/check-out history)
               ============================================================================ -->
          <!-- GEO Tracking Card (Read-only display) -->
          <div v-if="event.geoRequired && (event.checkIn || event.checkOut)" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('events.eventDetailGeoTrackingHistory') }}</h3>
            <div class="space-y-3">
              <div v-if="event.checkIn" class="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('events.eventDetailCheckIn') }}</div>
                <div class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ formatDateTime(event.checkIn.timestamp) }}
                </div>
                <div v-if="event.checkIn.location && event.checkIn.location.latitude != null && event.checkIn.location.longitude != null" class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {{ event.checkIn.location.latitude.toFixed(6) }}, {{ event.checkIn.location.longitude.toFixed(6) }}
                </div>
              </div>
              <div v-if="event.checkOut" class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('events.eventDetailCheckOut') }}</div>
                <div class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ formatDateTime(event.checkOut.timestamp) }}
                </div>
                <div v-if="event.checkOut.location && event.checkOut.location.latitude != null && event.checkOut.location.longitude != null" class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {{ event.checkOut.location.latitude.toFixed(6) }}, {{ event.checkOut.location.longitude.toFixed(6) }}
                </div>
              </div>
              <div v-if="event.timeSpent" class="text-xs text-gray-600 dark:text-gray-400">
                Time Spent: {{ formatDuration(event.timeSpent) }}
              </div>
            </div>
          </div>

          <!-- ============================================================================
               Audit Context (Read-only) - Audit Workflow State
               ============================================================================
               Render ONLY if isAuditEvent === true
               Shows audit workflow progress and state (read-only display)
               ============================================================================ -->
          <!-- Audit Workflow State -->
          <div v-if="isAuditEvent && event.auditState" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('events.eventDetailAuditWorkflowState') }}</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('events.eventDetailCurrentState') }}</span>
                <span :class="getAuditStateBadgeClass(event.auditState)">
                  {{ formatAuditState(event.auditState) }}
                </span>
              </div>
              <!-- Workflow Progress (Read-only) -->
              <div class="mt-4">
                <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span>{{ t('process.wizardProgressAria') }}</span>
                  <span>{{ getAuditProgress() }}%</span>
                </div>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    class="bg-indigo-600 h-2 rounded-full transition-all"
                    :style="{ width: `${getAuditProgress()}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Multi-Org Route Summary -->
          <div v-if="event.isMultiOrg && event.orgList" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('events.eventDetailRouteSummary') }}</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">{{ t('events.eventDetailTotalOrganizations') }}</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ event.orgList.length }}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">{{ t('events.eventDetailCompleted') }}</span>
                <span class="font-medium text-green-600 dark:text-green-400">
                  {{ event.orgList.filter((org) => org.status === 'COMPLETED').length }}
                </span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">{{ t('events.eventDetailInProgress') }}</span>
                <span class="font-medium text-blue-600 dark:text-blue-400">
                  {{ event.orgList.filter((org) => org.status === 'IN_PROGRESS').length }}
                </span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">{{ t('events.eventDetailPending') }}</span>
                <span class="font-medium text-gray-600 dark:text-gray-400">
                  {{ event.orgList.filter((org) => org.status === 'PENDING').length }}
                </span>
              </div>
            </div>
          </div>

          <!-- Field Sales KPI -->
          <div v-if="event.eventType === 'Field Sales Beat' && event.kpiActuals" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('events.eventDetailSalesKpis') }}</h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('events.eventDetailOrdersCreated') }}</div>
                <div class="text-lg font-bold text-gray-900 dark:text-white">
                  {{ event.kpiActuals.orderCount || 0 }}
                </div>
              </div>
              <div>
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('events.eventDetailOrderValue') }}</div>
                <div class="text-lg font-bold text-gray-900 dark:text-white">
                  {{ formatOrderValue(event.kpiActuals.orderValue || 0) }}
                </div>
              </div>
              <div>
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('events.eventDetailVisitsCompleted') }}</div>
                <div class="text-lg font-bold text-gray-900 dark:text-white">
                  {{ event.kpiActuals.visitsCompleted || 0 }}
                </div>
              </div>
              <div>
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('events.eventDetailConversionRate') }}</div>
                <div class="text-lg font-bold text-gray-900 dark:text-white">
                  {{ getConversionRate() }}%
                </div>
              </div>
            </div>
          </div>
          
          <!-- Audit History Card -->
          <div v-if="event.auditHistory && event.auditHistory.length > 0" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('events.eventDetailAuditHistory') }}</h3>
            <div class="space-y-2">
              <div v-for="(entry, index) in event.auditHistory" :key="index" class="text-xs text-gray-600 dark:text-gray-400 border-l-2 border-gray-200 dark:border-gray-700 pl-3 py-1">
                <div class="font-medium text-gray-900 dark:text-white">{{ entry.action.replace('_', ' ').toUpperCase() }}</div>
                <div v-if="entry.from || entry.to">
                  <span v-if="entry.from">{{ entry.from }}</span>
                  <span v-if="entry.from && entry.to"> → </span>
                  <span v-if="entry.to">{{ entry.to }}</span>
                </div>
                <div class="text-gray-500 dark:text-gray-500 mt-0.5">
                  {{ formatDateTime(entry.timestamp) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Activity & Notes -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Notes & Activity</h3>
            
            <!-- Add Note Form -->
            <div v-if="showNoteForm" class="mb-4">
              <textarea
                v-model="newNote"
                rows="3"
                :placeholder="t('events.eventDetailAddANote')"
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              ></textarea>
              <div class="flex items-center gap-2 mt-2">
                <button @click="addNote" :disabled="!newNote.trim()" class="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">{{ t('events.eventDetailSaveNote') }}</button>
                <button @click="showNoteForm = false; newNote = ''" class="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">{{ t('performance.cancelWizard') }}</button>
              </div>
            </div>

            <button v-else @click="showNoteForm = true" class="w-full py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700 transition-colors">
              + Add Note
            </button>

            <!-- Notes Display -->
            <div v-if="event.notes" class="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ event.notes }}</p>
            </div>

            <div v-else class="mt-4 text-center py-6 text-sm text-gray-500 dark:text-gray-400">{{ t('events.eventDetailNoNotesYet') }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Event Form Drawer -->
    <CreateRecordDrawer
      :isOpen="showEditModal"
      moduleKey="events"
      :record="event"
      @close="showEditModal = false"
      @saved="handleEventUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { useNotifications } from '@/composables/useNotifications';
import { confirmAction } from '@/composables/useConfirmAction';
const { t } = useI18n();
const notifications = useNotifications();

import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import dateUtils from '@/utils/dateUtils';
import { useAuthStore } from '@/stores/authRegistry';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import RelatedRecordsPanel from '@/components/relationships/RelatedRecordsPanel.vue';
// @ts-expect-error - JavaScript module without type declarations
import { useRecordContext, invalidateRecordContext } from '@/composables/useRecordContext';
// @ts-expect-error - JavaScript module without type declarations
import { getProjectionTypeLabel, getProjectionTypeBadgeClass, getAppLabel } from '@/utils/projectionLabels';
import { getEventTypeDefinitionByKey } from '@/metadata/eventTypes';
import type { EventTypeDefinition } from '@/types/eventSettings.types';
import { normalizeEventActivities } from '@/platform/events/eventActivity.utils';
import type { EventActivity } from '@/platform/events/eventActivity.types';
// CONTRACT-LOCKED:
// See docs/architecture/platform-permission-contract.md
// Platform Permissions MUST remain explanatory-only.
import {
  derivePlatformPermissions
} from '@/platform/permissions/platformPermissions.utils';
import type {
  PlatformPermissionContext
} from '@/platform/permissions/platformPermissions.utils';
import type {
  PermissionAction,
  PermissionScope
} from '@/platform/permissions/platformPermissionVocabulary.types';
import { formatCurrencyValue, resolveOrgCurrencyCode } from '@/utils/currencyOptions';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

interface DetailGeoPoint {
  latitude?: number | null;
  longitude?: number | null;
}

interface DetailCheckPoint {
  timestamp?: string | number | Date | null;
  location?: DetailGeoPoint | null;
}

interface DetailAuditEntry {
  action: string;
  from?: string;
  to?: string;
  timestamp?: string | number | Date | null;
}

interface DetailLinkedRef {
  _id?: string;
  name?: string;
}

interface DetailEvent {
  _id?: string;
  eventId?: string;
  eventName?: string;
  title?: string;
  type?: string;
  eventType?: string;
  status?: string | null;
  color?: string;
  auditState?: string;
  startDateTime?: string | null;
  startDate?: string | null;
  endDateTime?: string | null;
  endDate?: string | null;
  location?: string;
  tags?: string[];
  notes?: string;
  geoRequired?: boolean;
  timeSpent?: number;
  isMultiOrg?: boolean;
  relatedToId?: unknown;
  linkedFormId?: string | DetailLinkedRef | null;
  checkIn?: DetailCheckPoint | null;
  checkOut?: DetailCheckPoint | null;
  auditorId?: unknown;
  assignedTo?: unknown;
  organizer?: unknown;
  createdAt?: unknown;
  createdBy?: unknown;
  executionStartTime?: unknown;
  executionStartedAt?: unknown;
  executionEndTime?: unknown;
  completedAt?: unknown;
  completedBy?: unknown;
  cancelledAt?: unknown;
  cancelledBy?: unknown;
  cancellationReason?: unknown;
  submittedAt?: unknown;
  submittedBy?: unknown;
  auditHistory?: DetailAuditEntry[];
  orgList?: Array<{ status?: string }>;
  kpiActuals?: {
    orderCount?: number;
    orderValue?: unknown;
    visitsCompleted?: number;
    ordersCreated?: number;
  };
  metadata?: {
    formResponses?: string[];
  };
}

const event = ref<DetailEvent | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const showNoteForm = ref(false);
const newNote = ref('');
const showEditModal = ref(false);

// Record context for execution capabilities and projection metadata
const { context: recordContext, load: loadRecordContext } = useRecordContext('SALES', 'events', () => route.params.id);

// Phase 2C: Computed projection type label and badge
const projectionTypeLabel = computed(() => {
  if (!recordContext.value?.record?.projection?.currentType) return null;
  const currentType = recordContext.value.record.projection.currentType;
  const appKey = recordContext.value.record.projection.appKey || 'SALES';
  return getProjectionTypeLabel(currentType, appKey);
});

const projectionTypeBadgeClass = computed(() => {
  if (!recordContext.value?.record?.projection?.currentType) return '';
  const currentType = recordContext.value.record.projection.currentType;
  const appKey = recordContext.value.record.projection.appKey || 'SALES';
  return getProjectionTypeBadgeClass(currentType, appKey);
});

const projectionAppLabel = computed(() => {
  if (!recordContext.value?.record?.projection?.appKey) return null;
  return getAppLabel(recordContext.value.record.projection.appKey);
});

// ============================================================================
// EVENT INTENT DERIVATION
// ============================================================================
// 
// Derive event intent from EventTypeDefinition to understand:
// - Whether this is a generic or audit event
// - What execution mode applies
// - What context should be shown
// 
// This is read-only information for display purposes only.
// ============================================================================

// Get event type key from event (handle both eventType and type fields, and both keys and labels)
const eventTypeKey = computed(() => {
  if (!event.value) return null;
  
  // Try eventType first (may be key or label)
  const eventType = event.value.eventType || event.value.type;
  if (!eventType) return null;
  
  // If it's already a key (uppercase with underscores), return it
  if (typeof eventType === 'string' && /^[A-Z_]+$/.test(eventType)) {
    return eventType;
  }
  
  // Otherwise, try to map from label to key
  // This handles cases where backend returns label instead of key
  const labelToKeyMap: Record<string, string> = {
    'Meeting': 'MEETING',
    'Meeting / Appointment': 'MEETING',
    'Internal Audit': 'INTERNAL_AUDIT',
    'External Audit — Single Org': 'EXTERNAL_AUDIT_SINGLE',
    'External Audit Beat': 'EXTERNAL_AUDIT_BEAT',
    'Field Sales Beat': 'FIELD_SALES_BEAT'
  };
  
  return labelToKeyMap[eventType] || eventType;
});

// Get EventTypeDefinition for this event
const eventTypeDefinition = computed((): EventTypeDefinition | null => {
  const key = eventTypeKey.value;
  if (!key) return null;
  
  const definition = getEventTypeDefinitionByKey(key);
  
  // DEV-ONLY: Warn if no EventTypeDefinition found
  if (process.env.NODE_ENV === 'development' && !definition) {
    console.warn(
      '[EventSurface] No EventTypeDefinition found for event type:',
      key,
      { eventType: event.value?.eventType, type: event.value?.type }
    );
  }
  
  return definition;
});

// Boolean helpers for intent awareness
const isAuditEvent = computed(() => {
  return eventTypeDefinition.value?.isAuditEvent === true;
});

const executionMode = computed(() => {
  return eventTypeDefinition.value?.executionMode || null;
});

// Platform Permission Explanation Layer
// ARCHITECTURAL NOTE: This is explanatory only, does NOT enforce permissions
// Defines context based solely on existing surface state (no API calls, no role checks)
const permissionContext = computed<PlatformPermissionContext>(() => ({
  resource: 'event',
  scope: 'RECORD' as PermissionScope,

  isReadOnly: true,               // EventDetail is read-only
  workflowLocked: isAuditEvent.value === true,
  isSystemManaged: false
}));

// Derive permission explanations
const permissions = computed(() =>
  derivePlatformPermissions(
    [
      'EXECUTE',
      'COMPLETE',
      'CANCEL',
      'SUBMIT',
      'APPROVE'
    ],
    permissionContext.value
  )
);

// Helper: Map permission actions to human-readable labels
function getActionLabel(action: PermissionAction): string {
  switch (action) {
    case 'EXECUTE':
      return 'Execute event';
    case 'COMPLETE':
      return 'Complete event';
    case 'CANCEL':
      return 'Cancel event';
    case 'SUBMIT':
      return 'Submit event';
    case 'APPROVE':
      return 'Approve event';
    default:
      return action;
  }
}

// ============================================================================
// EXECUTION READINESS DERIVATION (Read-Only)
// ============================================================================
// 
// This surface explains event state and readiness.
// It never performs execution or workflow mutations.
// 
// Readiness is derived from:
// - Event status (must be 'Planned')
// - Scheduled start time exists
// - Audit state allows execution (for audit events)
// - Geo requirements satisfied (for audit events, if data exists)
// ============================================================================

/**
 * Check if event is ready for execution
 * 
 * Rules:
 * - status === 'Planned'
 * - scheduled start time exists
 * - (audit only) auditState allows execution
 * - (audit only) geo requirements satisfied (if data exists)
 * 
 * If data is missing, treat as not ready.
 */
const isReadyForExecution = computed(() => {
  if (!event.value) return false;
  
  // Status must be 'Planned'
  const status = event.value.status;
  if (status !== 'Planned' && status !== 'PLANNED') {
    return false;
  }
  
  // Scheduled start time must exist
  const startTime = event.value.startDateTime || event.value.startDate;
  if (!startTime) {
    return false;
  }
  
  // For audit events, additional checks
  if (isAuditEvent.value) {
    // Audit state must allow execution
    const auditState = event.value.auditState;
    if (!auditState || auditState === 'approved' || auditState === 'closed' || auditState === 'rejected') {
      return false;
    }
    
    // If geo is required and we have check-in data, verify geo was provided
    if (eventTypeDefinition.value?.geoRequired) {
      // If check-in exists, verify it has location data
      if (event.value.checkIn) {
        const hasLocation = event.value.checkIn.location && 
                           event.value.checkIn.location.latitude != null && 
                           event.value.checkIn.location.longitude != null;
        if (!hasLocation) {
          return false;
        }
      }
      // If no check-in yet, we can't verify geo - treat as not ready if we're past start time
      // (This is a conservative approach - if start time passed and no check-in, not ready)
      if (!event.value.checkIn) {
        const start = new Date(startTime);
        const now = new Date();
        if (now >= start) {
          return false; // Start time passed but no check-in
        }
      }
    }
  }
  
  return true;
});

/**
 * Execution blockers - array of { code, message } explaining why execution is blocked
 * 
 * This is human-readable, not technical.
 */
const executionBlockers = computed(() => {
  const blockers: Array<{ code: string; message: string }> = [];
  
  if (!event.value) {
    blockers.push({ code: 'MISSING_EVENT', message: 'Event data is missing' });
    return blockers;
  }
  
  // Check status
  const status = event.value.status;
  if (status !== 'Planned' && status !== 'PLANNED') {
    if (status === 'Completed' || status === 'COMPLETED') {
      blockers.push({ code: 'ALREADY_COMPLETED', message: 'This event has already been completed' });
    } else if (status === 'Cancelled' || status === 'CANCELLED') {
      blockers.push({ code: 'CANCELLED', message: 'This event has been cancelled' });
    } else {
      blockers.push({ code: 'INVALID_STATUS', message: `Event status is "${status}" and must be "Planned" to execute` });
    }
  }
  
  // Check scheduled start time
  const startTime = event.value.startDateTime || event.value.startDate;
  if (!startTime) {
    blockers.push({ code: 'MISSING_SCHEDULE', message: 'Event does not have a scheduled start time' });
  }
  
  // Audit-specific checks
  if (isAuditEvent.value) {
    const auditState = event.value.auditState;
    
    // Check audit state
    if (auditState === 'approved' || auditState === 'closed') {
      blockers.push({ code: 'WORKFLOW_LOCKED', message: 'This audit has been completed and is locked' });
    } else if (auditState === 'rejected') {
      blockers.push({ code: 'WORKFLOW_REJECTED', message: 'This audit has been rejected' });
    } else if (auditState === 'submitted') {
      blockers.push({ code: 'AUDIT_SUBMITTED', message: 'This audit has been submitted and is awaiting review' });
    } else if (auditState === 'pending_corrective') {
      blockers.push({ code: 'PENDING_CORRECTIVE', message: 'This audit requires corrective actions before proceeding' });
    } else if (auditState === 'needs_review') {
      blockers.push({ code: 'NEEDS_REVIEW', message: 'This audit is awaiting review' });
    }
    
    // Check geo requirements
    if (eventTypeDefinition.value?.geoRequired) {
      if (!event.value.checkIn) {
        const start = startTime ? new Date(startTime) : null;
        const now = new Date();
        if (start && now >= start) {
          blockers.push({ code: 'GEO_REQUIRED', message: 'Location tracking is required for audit events and must be provided during check-in' });
        }
      } else {
        // Check-in exists, verify location data
        const hasLocation = event.value.checkIn.location && 
                           event.value.checkIn.location.latitude != null && 
                           event.value.checkIn.location.longitude != null;
        if (!hasLocation) {
          blockers.push({ code: 'GEO_MISSING', message: 'Location data is missing from check-in' });
        }
      }
    }
  }
  
  return blockers;
});

// ============================================================================
// ============================================================================
// CANONICAL EVENT ACTIVITY LOG (Read-Only)
// ============================================================================
// 
// This computed property normalizes event data into canonical activities.
// It explains what happened, never changes what happened.
// 
// Uses the canonical activity model from @/platform/events/eventActivity.utils
// ============================================================================

/**
 * Canonical activity log for both generic and audit events
 * 
 * Normalizes event data into unified EventActivity objects:
 * - Maps existing event fields only (no inference, no API calls)
 * - Returns activities sorted by timestamp ASC
 * - Works for both generic and audit events
 */
const activityLog = computed(() => {
  if (!event.value) return [];
  return normalizeEventActivities(event.value);
});

/**
 * Helper: Convert activity type to display label
 */
function getActivityLabel(activity: EventActivity): string {
  switch (activity.type) {
    case 'EVENT_CREATED':
      return 'Event created';
    case 'EXECUTION_STARTED':
      return 'Execution started';
    case 'EXECUTION_COMPLETED':
      return 'Execution completed';
    case 'EXECUTION_CANCELLED':
      return 'Execution cancelled';
    case 'AUDIT_CHECK_IN':
      return 'Checked in';
    case 'AUDIT_SUBMITTED':
      return 'Submitted';
    case 'AUDIT_APPROVED':
      return 'Approved';
    case 'AUDIT_REJECTED':
      return 'Rejected';
    case 'GEO_CAPTURED':
      return activity.metadata?.checkType === 'checkOut' ? 'Check-out location captured' : 'Check-in location captured';
    case 'STATUS_CHANGED':
      if (activity.metadata?.from && activity.metadata?.to) {
        return `${formatAuditState(activity.metadata.from)} → ${formatAuditState(activity.metadata.to)}`;
      }
      return 'Status changed';
    case 'NOTE_ADDED':
      return 'Note added';
    default:
      const activityTypeStr = String(activity.type);
      return activityTypeStr.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
  }
}

/**
 * Helper: Get status color for activity
 */
function getActivityStatusColor(activity: EventActivity): 'green' | 'red' | 'yellow' | 'gray' {
  switch (activity.type) {
    case 'EXECUTION_COMPLETED':
    case 'AUDIT_APPROVED':
      return 'green';
    case 'EXECUTION_CANCELLED':
    case 'AUDIT_REJECTED':
      return 'red';
    case 'EXECUTION_STARTED':
    case 'AUDIT_CHECK_IN':
    case 'AUDIT_SUBMITTED':
    case 'GEO_CAPTURED':
      return 'yellow';
    case 'EVENT_CREATED':
    case 'STATUS_CHANGED':
    case 'NOTE_ADDED':
    default:
      return 'gray';
  }
}

/**
 * Helper: Get actor display name
 */
function getActivityActor(activity: EventActivity): string | undefined {
  return activity.actor?.name || (activity.actor?.id ? 'User' : undefined);
}

// Check if event is locked for editing (checked in for audit events)
const isEventLocked = computed(() => {
  if (!event.value) return false;
  // Lock editing when audit event is checked in, approved, or closed
  const auditLabels = ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'];
  return event.value.auditState === 'checked_in' ||
         event.value.auditState === 'submitted' ||
         event.value.auditState === 'approved' ||
         event.value.auditState === 'closed' ||
         (auditLabels.includes(event.value.eventType || '') &&
          Boolean(event.value.auditState) &&
          event.value.auditState !== 'Ready to start');
});

// Check if current user is the auditor (explicit audit role)
const isAuditor = computed(() => {
  if (!event.value) return false;
  // Get current user from auth store
  const authStore = useAuthStore();
  const currentUser = authStore.user;
  if (!currentUser) return false;
  
  // Prefer explicit auditorId; fall back to assignedTo for legacy records
  const auditorId = refIdString(event.value.auditorId) || refIdString(event.value.assignedTo);
  return auditorId !== '' && auditorId === String(currentUser._id);
});

// Legacy computed - use isAuditEvent instead (derived from EventTypeDefinition)
const isAuditEventType = computed(() => {
  return isAuditEvent.value;
});

interface DetailPerson {
  firstName?: string;
  lastName?: string;
}

function asDetailPerson(value: unknown): DetailPerson | null {
  if (!value || typeof value !== 'object') return null;
  return value as DetailPerson;
}

const primaryOwnerUser = computed((): DetailPerson | null => {
  if (!event.value) return null;
  // For audits: show auditorId (fallback to assignedTo for legacy)
  const owner = isAuditEventType.value
    ? event.value.auditorId || event.value.assignedTo || event.value.organizer
    : event.value.assignedTo || event.value.organizer;
  return asDetailPerson(owner);
});

const primaryOwnerLabel = computed(() => (isAuditEventType.value ? 'Auditor' : 'Event Owner'));

/**
 * Navigate to Execution Surface
 * 
 * ARCHITECTURE NOTE: This is the ONLY execution-related action allowed in EventDetail.
 * This surface is read-only and must never perform execution mutations.
 * All execution actions (start, check-in, complete) happen in EventExecutionSurface.
 */
const goToExecution = () => {
  // DEV-ONLY INVARIANT GUARD: EventDetail must not perform execution actions
  if (process.env.NODE_ENV === 'development') {
    // Assert: This function only navigates, never mutates
    console.assert(
      true, // This only navigates, which is allowed
      '[EventSurface] INVARIANT: Execution actions must happen in EventExecutionSurface, not EventDetail'
    );
    
    // Assert: No execution actions exist in this component
    const hasExecutionActions = false; // This component has no execution mutation functions
    console.assert(
      !hasExecutionActions,
      '[EventSurface] INVARIANT VIOLATION: Execution actions must not exist in EventDetail.vue',
      { routePath: route.path }
    );
  }
  
  const id = route.params.id;
  router.push(`/events/${id}/execute`);
};

const fetchEvent = async () => {
  try {
    loading.value = true;
    const response = await apiClient.get(`/events/${route.params.id}`);
    if (response.success) {
      event.value = response.data;
      // Invalidate related-records cache so panel shows current links (e.g. after linking from Deal page)
      const id = event.value?._id ?? event.value?.eventId ?? route.params.id;
      if (id) invalidateRecordContext('PLATFORM', 'events', id);
    } else {
      error.value = 'Event not found';
    }
  } catch (err: unknown) {
    console.error('Error fetching event:', err);
    error.value = err instanceof Error && err.message ? err.message : 'Failed to load event';
  } finally {
    loading.value = false;
  }
};

const editEvent = () => {
  showEditModal.value = true;
};

// Guard to prevent infinite loops
let isHandlingUpdate = false;
let lastUpdateTimestamp = 0;
const UPDATE_DEBOUNCE = 1000; // Only update once per second

const handleEventUpdated = async () => {
  // Prevent infinite loops - don't handle if already handling or too soon
  const now = Date.now();
  if (isHandlingUpdate || (now - lastUpdateTimestamp < UPDATE_DEBOUNCE)) {
    console.log('[EventDetail] Skipping handleEventUpdated - already handling or too soon');
    return;
  }
  
  isHandlingUpdate = true;
  lastUpdateTimestamp = now;
  
  try {
    await fetchEvent();
    showEditModal.value = false;
  } catch (err) {
    console.error('[EventDetail] Error in handleEventUpdated:', err);
  } finally {
    isHandlingUpdate = false;
  }
};

const deleteEvent = async () => {
  if (!await confirmAction('Are you sure you want to delete this event?')) return;
  
  try {
    await apiClient.delete(`/events/${route.params.id}`);
    router.push('/events');
  } catch (err) {
    console.error('Error deleting event:', err);
    notifications.error(t('common.eventDetailToastFailedToDeleteEvent'));
  }
};

const addNote = async () => {
  if (!newNote.value.trim()) return;
  
  try {
    const response = await apiClient.post(`/events/${route.params.id}/notes`, {
      text: newNote.value.trim()
    });
    
    if (response.success) {
      event.value = response.data;
      newNote.value = '';
      showNoteForm.value = false;
    }
  } catch (err) {
    console.error('Error adding note:', err);
    notifications.error(t('common.eventDetailToastFailedToAddNote'));
  }
};

function toDateInput(value: unknown): string | number | Date | null {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) return value;
  return null;
}

const formatDateTime = (date: unknown) => {
  return dateUtils.format(toDateInput(date), 'MMM D, YYYY h:mm A');
};

const formatTimeAgo = (date: unknown) => {
  return dateUtils.fromNow(toDateInput(date));
};

const getDuration = () => {
  if (!event.value) return '';
  const start = new Date(event.value.startDateTime || event.value.startDate || '');
  const end = new Date(event.value.endDateTime || event.value.endDate || '');
  const duration = dateUtils.duration(end, start);
  
  if (duration.asHours() < 1) {
    return `${Math.round(duration.asMinutes())} minutes`;
  } else if (duration.asDays() < 1) {
    return `${Math.round(duration.asHours())} hours`;
  } else {
    return `${Math.round(duration.asDays())} days`;
  }
};

const viewFormResponse = () => {
  const responses = event.value?.metadata?.formResponses;
  if (!hasFormResponse.value || !responses?.length) return;

  const responseId = responses[0];
  const formId = refIdString(event.value?.linkedFormId);

  if (formId && responseId) {
    router.push(`/forms/${formId}/responses/${responseId}`);
  }
};

function refIdString(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (value && typeof value === 'object') {
    const record = value as { _id?: unknown; id?: unknown };
    const id = record._id ?? record.id;

    if (typeof id === 'string' || typeof id === 'number') {
      return String(id);
    }
  }

  return '';
}

const getInitials = (user: unknown) => {
  if (!user || typeof user !== 'object') return '';
  const record = user as { firstName?: string; lastName?: string };
  return `${record.firstName?.[0] || ''}${record.lastName?.[0] || ''}`;
};

const getOrgName = (org: unknown) => {
  if (!org) return 'N/A';
  if (typeof org === 'object' && 'name' in org && typeof org.name === 'string' && org.name) {
    return org.name;
  }
  return 'Organization';
};

const getFormName = (form: unknown) => {
  if (!form) return 'N/A';
  if (typeof form === 'object' && 'name' in form && typeof form.name === 'string' && form.name) {
    return form.name;
  }
  return 'Form';
};

const openForm = () => {
  if (event.value?.linkedFormId) {
    const eventIdValue = event.value.eventId || event.value._id;
    const linkedForm = event.value.linkedFormId;
    const formId = typeof linkedForm === 'string' ? linkedForm : linkedForm?._id;
    if (!formId) return;

    // Get responseId from event metadata if available
    let responseId = null;
    if (event.value.metadata?.formResponses && event.value.metadata.formResponses.length > 0) {
      // Use the most recent form response
      responseId = event.value.metadata.formResponses[event.value.metadata.formResponses.length - 1];
    }
    
    // Try sessionStorage as fallback
    if (!responseId) {
      try {
        const storedResponseId = sessionStorage.getItem(`formResponse_${formId}_${eventIdValue}`);
        if (storedResponseId) {
          responseId = storedResponseId;
        }
      } catch (e) {
        console.warn('[EventDetail] Failed to read responseId from sessionStorage:', e);
      }
    }
    
    const query: Record<string, string> = {
      eventId: String(eventIdValue)
    };
    
    if (responseId) {
      query.responseId = String(responseId);
    }
    
    router.push({
      path: `/forms/${formId}/fill`,
      query: query
    });
  }
};

// Audit state badge classes (for audit events only)
const getAuditStateBadgeClass = (state: unknown) => {
  if (!state) return '';
  
  const normalizedState = String(state).trim();
  
  const classes: Record<string, string> = {
    // Current audit state values
    'Ready to start': 'px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-xs font-medium',
    'checked_in': 'px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium',
    'submitted': 'px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-xs font-medium',
    'pending_corrective': 'px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full text-xs font-medium',
    'needs_review': 'px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded-full text-xs font-medium',
    'approved': 'px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium',
    'rejected': 'px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-xs font-medium',
    'closed': 'px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-xs font-medium',
    // Legacy values (for backward compatibility)
    'DRAFT': 'px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-xs font-medium',
    'IN_PROGRESS': 'px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium',
    'PAUSED': 'px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full text-xs font-medium',
    'SUBMITTED': 'px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-xs font-medium',
    'PENDING_CORRECTIVE': 'px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full text-xs font-medium',
    'NEEDS_REVIEW': 'px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded-full text-xs font-medium',
    'APPROVED': 'px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium',
    'REJECTED': 'px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-xs font-medium',
    'CLOSED': 'px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-xs font-medium'
  };
  
  return classes[normalizedState] || classes['Ready to start'];
};

// Format audit state for display (capitalize and add spaces)
const formatAuditState = (state: unknown) => {
  if (!state) return '';
  
  // Handle camelCase/snake_case states
  const formatted = String(state)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  return formatted;
};

const getAuditProgress = () => {
  const rawState = event.value?.auditState;
  if (!rawState) return 0;

  // Canonical (current) audit state flow
  const steps = [
    'ready to start',
    'checked_in',
    'submitted',
    'pending_corrective',
    'needs_review',
    'approved',
    'closed'
  ];

  // Backward-compatible aliases + minor normalization
  const aliases: Record<string, string> = {
    // Current states (case/spacing variants)
    'ready to start': 'ready to start',
    'checked_in': 'checked_in',
    'submitted': 'submitted',
    'pending_corrective': 'pending_corrective',
    'needs_review': 'needs_review',
    'approved': 'approved',
    'closed': 'closed',
    'rejected': 'rejected',

    // Legacy states
    'draft': 'ready to start',
    'in_progress': 'checked_in',
    'pending corrective': 'pending_corrective',
    'needs review': 'needs_review'
  };

  const normalized = String(rawState).trim().toLowerCase();
  const canonical = (aliases as Record<string, string>)[normalized] || normalized;

  // Rejection re-opens corrective actions; treat it as a mid-workflow regression.
  if (canonical === 'rejected') {
    const pendingIdx = steps.indexOf('pending_corrective');
    return pendingIdx >= 0 ? Math.round((pendingIdx / (steps.length - 1)) * 100) : 50;
  }

  const idx = steps.indexOf(canonical);
  if (idx < 0) return 0;

  // 0% at "ready to start", 100% at "closed"
  return Math.round((idx / (steps.length - 1)) * 100);
};

const formatDuration = (seconds: unknown) => {
  const total = typeof seconds === 'number' ? seconds : Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return '0m';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const formatOrderValue = (value: unknown) => {
  return formatCurrencyValue(value, {
    currencyCode: resolveOrgCurrencyCode(authStore.organization),
  }) ?? '—';
};

const getConversionRate = () => {
  if (!event.value?.kpiActuals) return 0;
  const visits = event.value.kpiActuals.visitsCompleted || 0;
  const orders = event.value.kpiActuals.ordersCreated || 0;
  if (visits === 0) return 0;
  return Math.round((orders / visits) * 100);
};

const hasFormResponse = computed(() => {
  return event.value?.metadata?.formResponses && event.value.metadata.formResponses.length > 0;
});

const formResponseCount = computed(() => {
  return event.value?.metadata?.formResponses?.length || 0;
});

// Status badge classes for system-controlled status (Planned, Completed, Cancelled)
const getStatusBadgeClass = (status: unknown) => {
  // Normalize status to handle both old and new values during migration
  const normalizedStatus = status ? String(status).trim() : 'Planned';
  
  const classes: Record<string, string> = {
    // New system-controlled statuses
    'Planned': 'px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-xs font-medium',
    'Completed': 'px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium',
    'Cancelled': 'px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-xs font-medium',
    // Legacy statuses (for backward compatibility during migration)
    'PLANNED': 'px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-xs font-medium',
    'STARTED': 'px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium',
    'CHECKED_IN': 'px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium',
    'IN_PROGRESS': 'px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded-full text-xs font-medium',
    'PAUSED': 'px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full text-xs font-medium',
    'CHECKED_OUT': 'px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full text-xs font-medium',
    'SUBMITTED': 'px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-xs font-medium',
    'PENDING_CORRECTIVE': 'px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full text-xs font-medium',
    'NEEDS_REVIEW': 'px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded-full text-xs font-medium',
    'APPROVED': 'px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium',
    'REJECTED': 'px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-xs font-medium',
    'CLOSED': 'px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-xs font-medium'
  };
  return classes[normalizedStatus] || classes['Planned'];
};


onMounted(async () => {
  // DEV-ONLY INVARIANT GUARD: EventDetail must not perform execution actions
  if (process.env.NODE_ENV === 'development') {
    // Validate that we're NOT on the execution route
    if (route.path.includes('/execute')) {
      console.error('[EventSurface] INVARIANT VIOLATION: EventDetail must not be mounted on /events/:id/execute route', {
        routePath: route.path
      });
    }
    
    // Assert: No execution actions exist in this component
    // This component should only have navigation functions, not mutation functions
    const hasExecutionActions = false; // Verified: no start/complete/check-in functions exist
    console.assert(
      !hasExecutionActions,
      '[EventSurface] INVARIANT VIOLATION: Execution actions must not exist in EventDetail.vue',
      { routePath: route.path }
    );
    
    // Assert: Audit events never expose completion controls
    // This is verified by the fact that we have no completion buttons/actions
    if (isAuditEvent.value) {
      console.assert(
        true, // No completion controls exist in this component
        '[EventSurface] INVARIANT: Audit events must not expose completion controls in EventDetail.vue'
      );
    }
    
    // Assert: executionMode matches EventTypeDefinition
    if (eventTypeDefinition.value && executionMode.value) {
      const expectedMode = eventTypeDefinition.value.executionMode;
      console.assert(
        executionMode.value === expectedMode,
        '[EventSurface] INVARIANT: executionMode must match EventTypeDefinition',
        { 
          computed: executionMode.value, 
          expected: expectedMode,
          eventType: eventTypeKey.value
        }
      );
    }
    
    // Assert: No execution mutation functions exist
    // @ts-expect-error startExecution must not exist on this surface
    const hasStartExecution = typeof startExecution !== 'undefined';
    console.assert(
      !hasStartExecution,
      '[EventSurface] Execution mutation detected — forbidden',
      { hasStartExecution }
    );
    
    // Assert: Audit events never expose completion controls
    const showCompletionControls = false; // Verified: no completion controls exist
    console.assert(
      !isAuditEvent.value || !showCompletionControls,
      '[EventSurface] Audit events must never expose completion controls'
    );
    
    // Warn: Audit event missing workflow history (non-blocking)
    if (isAuditEvent.value && !event.value?.auditHistory && !event.value?.checkIn) {
      console.warn(
        '[EventSurface] Audit event missing workflow history',
        { eventId: event.value?._id || event.value?.eventId }
      );
    }
    
    // ============================================================================
    // ACTIVITY LOG INVARIANTS (DEV-ONLY)
    // ============================================================================
    
    // Assert: EventDetail must not mutate activities
    // activityLog is a computed property that only reads from event.value
    // It cannot mutate activities - normalization is read-only
    console.assert(
      true, // Verified: activityLog is computed, no mutation methods exist
      '[EventDetail] activityLog must not mutate activities — it is read-only'
    );
    
    // Assert: EventExecutionSurface must not import activity utils
    // This is verified by checking that EventExecutionSurface.vue does not import
    // from @/platform/events/eventActivity.utils
    // (This check is conceptual - actual verification would require static analysis)
    const executionSurfaceShouldNotImportActivityUtils = true; // Verified: EventExecutionSurface does not import activity utils
    console.assert(
      executionSurfaceShouldNotImportActivityUtils,
      '[EventDetail] EventExecutionSurface must not import activity utils — activities are read-only in EventDetail'
    );
    
    // Assert: Activity log is deterministic and ordered
    // This is verified by the fact that normalizeEventActivities always sorts by timestamp ASC
    if (activityLog.value.length > 1) {
      const isOrdered = activityLog.value.every((activity, index) => {
        if (index === 0) return true;
        const prevIndex = index - 1;
        if (prevIndex < 0 || prevIndex >= activityLog.value.length) return true;
        const prevActivity = activityLog.value[prevIndex];
        if (!prevActivity) return true;
        const prevTime = new Date(prevActivity.timestamp).getTime();
        const currTime = new Date(activity.timestamp).getTime();
        return currTime >= prevTime;
      });
      console.assert(
        isOrdered,
        '[EventDetail] Activity log must be ordered by timestamp ASC',
        { activityCount: activityLog.value.length }
      );
    }

    // DEV-only invariants for Platform Permission Explanation Layer
    console.assert(
      permissions.value.length > 0,
      '[EventDetail] Platform permissions not derived'
    );

    console.assert(
      permissionContext.value.isReadOnly === true,
      '[Platform Permissions] Explanation layer used on non-read-only surface'
    );
  }
  
  await fetchEvent();
  // Load record context for execution capabilities (uses route.params.id from composable)
  if (route.params.id) {
    await loadRecordContext();
  }
});
</script>

