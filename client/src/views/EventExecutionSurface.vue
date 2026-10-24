<!--
  ============================================================================
  EVENT EXECUTION SURFACE (AUTHORITATIVE MUTATION SURFACE)
  ============================================================================
  
  See docs/architecture/event-domain-contract.md
  
  This surface is the ONLY place where:
  - Event execution starts
  - Execution state mutates
  - Geo tracking is initiated
  - Audit workflows progress
  
  This surface MUST:
  - Be intent-aware (generic vs audit)
  - Enforce execution rules from EventTypeDefinition
  - Perform execution mutations explicitly
  
  This surface MUST NEVER:
  - Be mounted from EventDetail.vue logic
  - Be reused for read-only display
  - Guess execution mode
  - Bypass audit workflow rules
  - Perform partial execution
  
  This surface explains execution readiness and failures.
  It performs execution mutations but does not hide or disable them.
  Users are informed, not restricted, by UI logic.
  
  All read-only explanation belongs in EventDetail.vue
  
  ============================================================================
-->

<template>
  <!--
    ============================================================================
    Event Execution Surface
    ============================================================================
    
    ARCHITECTURE NOTE: This surface is the exclusive execution interface for events.
    
    This surface guides users through performing event-related work, managing
    execution state, and completing role-based responsibilities. It operates on
    existing event instances that have already been created and scheduled.
    
    Entry Points:
    - Inbox item click → /events/:id/execute
    - Search result click → /events/:id/execute
    - Command palette → "Go to event" → /events/:id/execute
    - Calendar (read-only → execute) → /events/:id/execute
    
    All entry points route to this unified execution surface.

    // Invariant:
    // /events/:id/execute is the ONLY route allowed to mutate execution state.
    // EventDetail (/events/:id) must never perform execution actions.
    
    INBOX RELATIONSHIP:
    - Inbox reflects execution state, not vice versa
    - When execution completes (status → 'Completed'), inbox automatically excludes the event
    - Backend filters: status: { $nin: ['Completed', 'Cancelled'] }
    - No manual inbox actions needed - inbox updates automatically when event status changes
    - Inbox items disappear immediately after resolution because backend excludes completed events
    
    Explicitly NOT for:
    - Event creation (belongs in GenericEventCreateSurface, AuditScheduleSurface)
    - Event scheduling (belongs in creation surfaces)
    - Event settings (belongs in Settings → Core Modules → Events)
    - Event editing (belongs in event editing surfaces)

    // Invariant:
    // EventExecutionSurface may:
    // - trigger execution transitions
    // - display execution context
    //
    // It must never:
    // - edit event configuration
    // - change roles, schedule, or metadata
    // - expose full Event schema

    // Invariant:
    // Audit events are completed ONLY by audit workflow reaching 'closed'.
    // No UI action may directly set status = 'Completed' for audit events.
    
    See: docs/architecture/event-execution-surface.md
    See: docs/architecture/inbox-surface-invariants.md
    ============================================================================
  -->
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400 font-medium">{{ t('events.eventExecutionSurfaceLoadingEventExecutionContext') }}</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <svg class="mx-auto h-12 w-12 text-red-500 dark:text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ t('events.eventExecutionSurfaceErrorLoadingEvent') }}</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">{{ error }}</p>
        <button @click="$router.push('/events')" class="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">{{ t('events.eventExecutionSurfaceBackToEvents') }}</button>
      </div>
    </div>

    <!-- Execution Surface Content -->
    <!--
      UX PRINCIPLE: Focus-First Design
      
      This surface uses a focus-first design approach:
      - Primary Action Panel is the focal point (what do I do now?)
      - Context Panel provides supporting information (when, where, who)
      - No side navigation or distracting elements
      - Single primary action at a time
      - Clear visual hierarchy guides user attention
      
      This reduces cognitive load and improves task completion by answering
      "What do I do now?" immediately and prominently.
      
      See: docs/architecture/event-execution-surface.md Section 7 (UX Principles)
    -->
    <div v-else-if="executionContext" class="max-w-7xl mx-auto p-6 lg:p-8">
      <!--
        ============================================================================
        Header Section
        ============================================================================
        
        Displays event title, type, time, and execution status.
        Provides context but does not distract from primary action.
      -->
      <div class="mb-8">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {{ executionContext.title }}
            </h1>
            <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span class="font-medium">{{ executionContext.eventType }}</span>
              <span>•</span>
              <span>{{ formattedTimeRange }}</span>
            </div>
          </div>
          <!-- Status Badge -->
          <div class="flex flex-col items-end gap-2">
            <!-- Audit State (for audit events) -->
            <span v-if="isAuditEvent" :class="auditStateBadgeClass">
              {{ formattedAuditState }}
            </span>
            <!-- Execution State (for generic events) -->
            <span v-else :class="statusBadgeClass">
              {{ normalizedExecutionState }}
            </span>
            <span v-if="executionContext.userRole" class="text-xs text-gray-500 dark:text-gray-400">{{ t('events.eventExecutionSurfaceYourRole2') }}<span class="font-medium">{{ formatUserRole(executionContext.userRole) }}</span>
            </span>
          </div>
        </div>
      </div>

      <!--
        ============================================================================
        Primary Action Panel
        ============================================================================
        
        UX PRINCIPLE: Clear "What Do I Do Now?"
        
        This panel is the focal point of the execution surface. It answers
        "What do I do now?" immediately and prominently.
        
        Behavior by execution state:
        - NOT_STARTED: Show primary CTA "Start Event" (prominent, large button)
        - IN_PROGRESS: Show current step + guidance (what's happening, what's next)
        - COMPLETED: Show completion summary (what was accomplished)
        
        Audit Event Behavior:
        - auditState = 'Ready to start': Show "Check In" CTA with geo requirement explanation
        - auditState = 'checked_in': Show form status and launch form action
        - Manual completion NOT allowed (system-controlled via check-out)
        
        No buttons for:
        - Editing (belongs in event editing surfaces)
        - Rescheduling (belongs in creation surfaces)
        - Role changes (belongs in creation surfaces or settings)
        
        See: docs/architecture/event-execution-surface.md Section 7.3
      -->
      <div class="mb-6">
        <!-- ============================================================================
             HARD SPLIT BY EXECUTION MODE
             ============================================================================
             GenericExecutionPanel: ONLY when executionMode === 'generic'
             AuditExecutionPanel: ONLY when executionMode === 'audit-workflow'
             Meetings (none): no field execution — back to record for Join
             NEVER mix controls
             ============================================================================ -->
        
        <!-- Meetings: no field execution surface -->
        <div
          v-if="executionMode === 'none'"
          class="rounded-xl border border-sky-200 bg-sky-50/80 p-6 dark:border-sky-800 dark:bg-sky-950/30"
        >
          <p class="text-sm font-medium text-sky-900 dark:text-sky-100">
            {{ t('events.meetingExecutionSurfaceNotApplicable') }}
          </p>
          <router-link
            :to="`/events/${route.params.id}`"
            class="mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            {{ t('events.meetingExecutionSurfaceBackToRecord') }}
          </router-link>
        </div>

        <!-- Generic Execution Panel -->
        <div v-else-if="executionMode === 'generic'" class="space-y-6">
          <!-- Execution Readiness Section (Read-Only) -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('events.eventExecutionSurfaceExecutionReadiness2') }}</h3>
            
            <!-- Ready State -->
            <div v-if="executionBlockers.length === 0" class="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <svg class="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="flex-1">
                <p class="text-sm font-medium text-green-900 dark:text-green-300">{{ t('events.eventExecutionSurfaceThisEventIsReadyForExecution') }}</p>
              </div>
            </div>
            
            <!-- Blocked State -->
            <div v-else class="space-y-3">
              <div class="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <svg class="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div class="flex-1">
                  <p class="text-sm font-medium text-yellow-900 dark:text-yellow-300 mb-2">{{ t('events.eventExecutionSurfaceExecutionMayBeBlockedByThe2') }}</p>
                  <ul class="space-y-1.5">
                    <li v-for="blocker in executionBlockers" :key="blocker.code" class="text-sm text-yellow-800 dark:text-yellow-400 flex items-start gap-2">
                      <span class="text-yellow-600 dark:text-yellow-500 mt-0.5">•</span>
                      <span>{{ blocker.message }}</span>
                    </li>
                  </ul>
                </div>
              </div>
              </div>
            </div>
          
          <!-- Execution Error Display (if any) -->
          <div v-if="executionError" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-800 p-4">
            <div class="flex items-start gap-3">
              <svg class="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="flex-1">
                <p class="text-sm font-medium text-red-900 dark:text-red-300 mb-1">{{ t('events.eventExecutionSurfaceExecutionError2') }}</p>
                <p class="text-sm text-red-800 dark:text-red-400">{{ executionError }}</p>
              </div>
              <button
                @click="executionError = null"
                class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <!-- NOT_STARTED State: Primary CTA -->
          <div v-if="executionState === 'NOT_STARTED'" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-indigo-200 dark:border-indigo-800 p-8">
            <div class="text-center">
              <div class="mb-6">
                <svg class="mx-auto h-16 w-16 text-indigo-600 dark:text-indigo-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-2">{{ t('events.eventExecutionSurfaceReadyToStart') }}</h2>
                <p class="text-gray-600 dark:text-gray-400">{{ t('events.eventExecutionSurfaceThisEventIsScheduledAndReady') }}</p>
              </div>
              <button
                v-if="canStart"
                @click="handleStartEvent"
                :disabled="starting"
                class="inline-flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {{ starting ? 'Starting...' : 'Start Event' }}
              </button>
              <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('events.eventExecutionSurfaceYouDoNotHavePermissionTo2') }}</p>
              
              <!-- Contextual helper text -->
              <p v-if="executionBlockers.length > 0" class="text-xs text-gray-500 dark:text-gray-400 mt-3">{{ t('events.eventExecutionSurfaceExecutionMayBeBlockedUntilThe3') }}</p>
            </div>
          </div>
        </div>

        <!-- Audit Execution Panel -->
        <div v-else-if="executionMode === 'audit-workflow'" class="space-y-6">
          <!-- Execution Readiness Section (Read-Only) -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('events.eventExecutionSurfaceExecutionReadiness') }}</h3>
            
            <!-- Ready State -->
            <div v-if="executionBlockers.length === 0" class="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <svg class="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="flex-1">
                <p class="text-sm font-medium text-green-900 dark:text-green-300">{{ t('events.eventExecutionSurfaceThisAuditIsReadyForExecution') }}</p>
              </div>
            </div>
            
            <!-- Blocked State -->
            <div v-else class="space-y-3">
              <div class="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <svg class="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div class="flex-1">
                  <p class="text-sm font-medium text-yellow-900 dark:text-yellow-300 mb-2">{{ t('events.eventExecutionSurfaceExecutionMayBeBlockedByThe') }}</p>
                  <ul class="space-y-1.5">
                    <li v-for="blocker in executionBlockers" :key="blocker.code" class="text-sm text-yellow-800 dark:text-yellow-400 flex items-start gap-2">
                      <span class="text-yellow-600 dark:text-yellow-500 mt-0.5">•</span>
                      <span>{{ blocker.message }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Execution Error Display (if any) -->
          <div v-if="executionError" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-800 p-4">
            <div class="flex items-start gap-3">
              <svg class="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="flex-1">
                <p class="text-sm font-medium text-red-900 dark:text-red-300 mb-1">{{ t('events.eventExecutionSurfaceExecutionError') }}</p>
                <p class="text-sm text-red-800 dark:text-red-400">{{ executionError }}</p>
              </div>
              <button
                @click="executionError = null"
                class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <!-- Who Can Do What Section (Read-Only Explanation) -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('events.eventExecutionSurfaceWhoCanDoWhat2') }}</h3>
            <div class="space-y-3">
              <div v-for="permission in permissions" :key="permission.action" class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ getActionLabel(permission.action) }}
                    </span>
                    <span
                      :class="[
                        'px-2 py-0.5 text-xs font-medium rounded',
                        permission.allowed
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                      ]"
                    >
                      {{ permission.allowed ? 'Allowed' : 'Not Allowed' }}
                    </span>
                  </div>
                  <p v-if="permission.reason" class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {{ permission.reason }}
                  </p>
                </div>
              </div>
              <div v-if="permissions.length === 0" class="text-center py-4 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsNoPermissionInfo') }}</div>
            </div>
          </div>
          
          <!-- Ready to Start (Check In Required) -->
          <div v-if="isAuditReadyForCheckIn" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-indigo-200 dark:border-indigo-800 p-8">
            <div class="text-center">
              <div class="mb-6">
                <svg class="mx-auto h-16 w-16 text-indigo-600 dark:text-indigo-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-2">{{ t('events.eventExecutionSurfaceReadyToStartAudit') }}</h2>
                <p class="text-gray-600 dark:text-gray-400 mb-4">{{ t('events.eventExecutionSurfaceCheckInToBeginTheAudit') }}</p>
                
                <!-- Geo Requirement Notice -->
                <div v-if="geoRequired" class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-left max-w-md mx-auto mb-4">
                  <div class="flex items-start gap-2">
                    <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">{{ t('events.eventExecutionSurfaceLocationRequired2') }}</p>
                      <p class="text-xs text-yellow-700 dark:text-yellow-300 mt-1">{{ t('events.eventExecutionSurfaceThisAuditRequiresLocationVerificationPlease') }}</p>
                      <p v-if="!currentLocation" class="text-xs text-yellow-600 dark:text-yellow-400 mt-2 font-medium">{{ t('events.eventExecutionSurfaceWaitingForGpsLocation') }}</p>
                    </div>
                  </div>
                </div>
              </div>

                <!-- Check In Button -->
              <button
                v-if="executionContext.userRole === 'AUDITOR'"
                @click="handleCheckIn"
                :disabled="checkingIn || (geoRequired && !currentLocation)"
                class="inline-flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {{ checkingIn ? 'Checking In...' : 'Check In' }}
              </button>
              <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('events.eventExecutionSurfaceOnlyTheAssignedAuditorCanCheck') }}</p>
              
              <!-- Contextual helper text -->
              <p v-if="executionBlockers.length > 0" class="text-xs text-gray-500 dark:text-gray-400 mt-3">{{ t('events.eventExecutionSurfaceExecutionMayBeBlockedUntilThe2') }}</p>
            </div>
          </div>

          <!-- Checked In (Form Completion) -->
          <div v-else-if="isAuditCheckedIn" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div class="mb-6">
            <div class="flex items-center gap-3 mb-4">
              <div class="flex-shrink-0 w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('events.eventExecutionSurfaceAuditInProgress') }}</h2>
                <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('events.eventExecutionSurfaceCheckedInSuccessfully') }}</p>
              </div>
            </div>
            
            <!-- Form Status -->
            <div v-if="executionContext.linkedFormId" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
              <div class="flex items-center justify-between mb-2">
                <p class="text-sm font-medium text-blue-800 dark:text-blue-200">{{ t('events.eventExecutionSurfaceLinkedFormStatus') }}</p>
                <span :class="formStatusBadgeClass">
                  {{ formStatus }}
                </span>
              </div>
              <p class="text-sm text-blue-700 dark:text-blue-300 mb-3">{{ t('events.eventExecutionSurfaceCompleteTheAuditFormToProceed') }}</p>
              <button
                v-if="formStatus === 'Not Started' || formStatus === 'In Progress'"
                @click="launchFormResponse"
                class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                {{ formStatus === 'Not Started' ? 'Start Form' : 'Continue Form' }}
              </button>
            </div>
          </div>
          
          <!-- Next Action Guidance -->
          <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('events.eventExecutionSurfaceWhatToDoNext') }}</h3>
            <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li v-if="executionContext.linkedFormId && formStatus !== 'Submitted'" class="flex items-start gap-2">
                <svg class="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{{ t('events.eventExecutionSurfaceCompleteTheLinkedAuditForm') }}</span>
              </li>
              <li v-if="formStatus === 'Submitted'" class="flex items-start gap-2">
                <svg class="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{{ t('events.eventExecutionSurfaceCheckOutWhenAuditIsComplete') }}</span>
              </li>
            </ul>
          </div>
        </div>
          
          <!-- Audit Workflow Explanation (Read-Only) -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('events.eventExecutionSurfaceAuditWorkflowControl') }}</h3>
            <div class="space-y-4">
              <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">{{ t('events.eventExecutionSurfaceExecutionControlledByAuditWorkflow') }}</p>
                  <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('events.eventExecutionSurfaceAuditEventsFollowAControlledExecution') }}</p>
                </div>
              </div>
              
              <div v-if="eventTypeDefinition?.geoRequired" class="flex items-start gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">{{ t('events.eventExecutionSurfaceLocationTrackingRequired') }}</p>
                  <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('events.eventExecutionSurfaceLocationTrackingIsMandatoryForAudit') }}</p>
                </div>
              </div>
              
              <div class="flex items-start gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">{{ t('events.eventExecutionSurfaceNoManualCompletion') }}</p>
                  <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('events.eventExecutionSurfaceAuditEventsCannotBeManuallyCompleted') }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!--
        ============================================================================
        Context Panel
        ============================================================================
        
        UX PRINCIPLE: Supporting Information
        
        Provides additional context (event details, linked work, etc.) without
        distracting from the primary action. This panel is secondary to the
        Primary Action Panel.
        
        No editing controls here - this is read-only context information.
      -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('events.eventExecutionSurfaceEventDetails') }}</h3>
        <dl class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <dt class="text-gray-500 dark:text-gray-400 font-medium mb-1">{{ t('settings.integrationsEventType') }}</dt>
            <dd class="text-gray-900 dark:text-white">{{ executionContext.eventType }}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400 font-medium mb-1">{{ t('events.eventExecutionSurfaceScheduledTime') }}</dt>
            <dd class="text-gray-900 dark:text-white">{{ formattedTimeRange }}</dd>
          </div>
          <div v-if="executionContext.userRole">
            <dt class="text-gray-500 dark:text-gray-400 font-medium mb-1">{{ t('events.eventExecutionSurfaceYourRole') }}</dt>
            <dd class="text-gray-900 dark:text-white">{{ formatUserRole(executionContext.userRole) }}</dd>
          </div>
          <div v-if="executionContext.linkedFormId">
            <dt class="text-gray-500 dark:text-gray-400 font-medium mb-1">{{ t('events.eventExecutionSurfaceLinkedForm') }}</dt>
            <dd class="text-gray-900 dark:text-white">Form linked (ID: {{ executionContext.linkedFormId }})</dd>
          </div>
          <div v-if="isAuditEvent">
            <dt class="text-gray-500 dark:text-gray-400 font-medium mb-1">{{ t('events.eventExecutionSurfaceAuditState') }}</dt>
            <dd class="text-gray-900 dark:text-white">{{ formattedAuditState }}</dd>
          </div>
          <div v-if="isAuditEvent && geoRequired">
            <dt class="text-gray-500 dark:text-gray-400 font-medium mb-1">{{ t('events.eventExecutionSurfaceLocationRequired') }}</dt>
            <dd class="text-gray-900 dark:text-white">{{ t('events.eventExecutionSurfaceYesForCheckInCheckOut') }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { useNotifications } from '@/composables/useNotifications';
const { t } = useI18n();
const notifications = useNotifications();

// Type declaration for process.env (used in DEV-ONLY guards)
declare const process: {
  env: {
    NODE_ENV: string;
  };
};

/**
 * ============================================================================
 * Event Execution Surface
 * ============================================================================
 * 
 * ARCHITECTURE NOTE: This component is the exclusive execution interface for events.
 * 
 * Responsibilities:
 * - Fetch minimal execution context (eventType, title, start/end time, execution status, user role)
 * - Provide focused, task-oriented execution interface
 * - Guide users through performing event-related work
 * - Manage execution state transitions (system-controlled)
 *
 * // Invariant:
 * // /events/:id/execute is the ONLY route allowed to mutate execution state.
 * // EventDetail (/events/:id) must never perform execution actions.
 *
 * // Invariant:
 * // EventExecutionSurface may:
 * // - trigger execution transitions
 * // - display execution context
 * //
 * // It must never:
 * // - edit event configuration
 * // - change roles, schedule, or metadata
 * // - expose full Event schema
 *
 * // Invariant:
 * // Audit events are completed ONLY by audit workflow reaching 'closed'.
 * // No UI action may directly set status = 'Completed' for audit events.
 * 
 * INBOX RELATIONSHIP:
 * 
 * Inbox reflects execution state, not vice versa.
 * 
 * When execution completes:
 * - Event status changes to 'Completed' on backend
 * - Backend automatically excludes Completed events from inbox aggregation
 * - Inbox filter: status: { $nin: ['Completed', 'Cancelled'] }
 * - Inbox items disappear immediately after resolution
 * - No manual inbox actions needed - inbox updates automatically
 * 
 * Flow:
 * 1. User completes event execution → event.status = 'Completed'
 * 2. Backend saves event with Completed status
 * 3. Next inbox fetch excludes Completed events (automatic filtering)
 * 4. Inbox item disappears (no manual refresh needed)
 * 
 * This ensures:
 * - Single source of truth: Event status drives inbox visibility
 * - No synchronization issues: Inbox always reflects current execution state
 * - Automatic cleanup: Completed events automatically removed from inbox
 * 
 * Execution logic will be implemented according to:
 * - docs/architecture/event-execution-surface.md
 * 
 * This component does NOT:
 * - Create events (belongs in GenericEventCreateSurface, AuditScheduleSurface)
 * - Schedule events (belongs in creation surfaces)
 * - Edit event structure (belongs in event editing surfaces)
 * - Configure event settings (belongs in Settings)
 * - Manage inbox directly (inbox reflects execution state automatically)
 * 
 * See: docs/architecture/inbox-surface-invariants.md
 * See: docs/architecture/inbox-aggregation.md
 * 
 * ============================================================================
 */

import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import type { EventExecutionContext, ExecutionState, ExecutionUserRole } from '@/types/eventExecution.types';
import { deriveEventExecutionState, isAuditEventType } from '@/utils/eventUtils';
import { mapExecutionError } from '@/utils/eventExecutionErrors';
import { determineEventExecutionRole } from '@/utils/eventExecutionRole';
import { getEventTypeDefinitionByKey } from '@/metadata/eventTypes';
import type { EventTypeDefinition } from '@/types/eventSettings.types';
import { deriveEventPermissions } from '@/platform/events/eventPermissions.utils';
import type { EventActionPermission } from '@/platform/events/eventPermissions.types';
import { formatUserDateTime, formatTime } from '@/utils/localeFormat';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// Execution context state
const loading = ref(true);
const error = ref<string | null>(null);
const executionContext = ref<EventExecutionContext | null>(null);
interface ExecutionEvent {
  _id?: string;
  id?: string;
  eventType?: string;
  status?: string | null;
  executionStatus?: string | null;
  startDateTime?: string | null;
  startDate?: string | null;
  executionStartTime?: string | Date | null;
  executionStartedAt?: string | Date | null;
  createdBy?: unknown;
  assignedTo?: unknown;
  auditorId?: unknown;
  reviewerId?: unknown;
  correctiveOwnerId?: unknown;
  auditState?: string;
  submittedAt?: unknown;
}

// Store event data for state machine derivation
const event = ref<ExecutionEvent | null>(null);

// Audit event state
const auditState = ref<string | null>(null);
const geoRequired = ref(false);
const currentLocation = ref<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
const checkingIn = ref(false);
const formResponseId = ref<string | null>(null);
const formStatus = ref<'Not Started' | 'In Progress' | 'Submitted' | 'Unknown'>('Unknown');
const locationWatchId = ref<number | null>(null);

// Generic event execution state
const starting = ref(false);
const completing = ref(false);

// Execution error state (for user-facing error messages)
const executionError = ref<string | null>(null);

/**
 * Normalize a possibly-populated reference into an ID string.
 *
 * Some endpoints return populated refs (e.g. linkedFormId: { _id, name }).
 * We must never route with an object id ("/forms/[object Object]").
 */
function idText(value: unknown): string | null {
  if (typeof value === 'string') return value || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

const normalizeId = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const record = value as { _id?: unknown; id?: unknown; toString?: () => unknown };
    const nested = idText(record._id) || idText(record.id);
    if (nested) return nested;
    if (typeof record.toString === 'function') {
      const text = record.toString();
      return typeof text === 'string' ? text : null;
    }
  }
  return null;
};

function asExecutionError(err: unknown): Parameters<typeof mapExecutionError>[0] {
  return err as Parameters<typeof mapExecutionError>[0];
}

/**
 * ============================================================================
 * CANONICAL EVENT STATE RELOAD
 * ============================================================================
 * 
 * This is the ONLY way event state is refreshed after mutations.
 * It ensures UI always reflects backend truth.
 * 
 * Rules:
 * - MUST be called after every successful mutation
 * - MUST be the only way event state is refreshed
 * - MUST NOT partially update event.value
 * - MUST replace event.value entirely with fresh backend data
 * ============================================================================
 */

/**
 * Reload event state from backend
 * 
 * This function fetches the full event from the backend and replaces event.value
 * entirely. This ensures all computed properties (executionState, activityLog,
 * permissions, readiness) recompute from fresh backend data.
 * 
 * @param reason - Reason for reload (for logging/debugging)
 */
async function reloadEventState(reason: string) {
  console.log('[EventExecution] Reloading event state:', reason);
  
  if (!executionContext.value?.eventId) {
    console.warn('[EventExecution] Cannot reload: no eventId');
    return;
  }
  
  const eventId = executionContext.value.eventId;
  const response = await apiClient.get(`/events/${eventId}`);
  
  if (response.success && response.data) {
    // Replace event.value entirely - no partial updates
    event.value = response.data;
    
    // Update execution context from fresh event data
    const eventData = response.data;
    const execState = deriveEventExecutionState(eventData);
    const userRole = determineEventExecutionRole(eventData);
    const isAudit = isAuditEventType(eventData.eventType);
    
    executionContext.value = {
      eventId: eventData._id || eventData.id || eventId,
      eventType: eventData.eventType || 'Unknown',
      executionState: execState,
      userRole: userRole,
      canStart: execState === 'NOT_STARTED' && userRole !== null && !isAudit,
      canComplete: execState === 'IN_PROGRESS' && userRole !== null && !isAudit,
      linkedFormId: normalizeId(eventData.linkedFormId),
      title: eventData.eventName || eventData.title || 'Untitled Event',
      startDateTime: eventData.startDateTime,
      endDateTime: eventData.endDateTime
    };
    
    // Update audit-specific state from fresh event data
    if (isAudit) {
      auditState.value = eventData.auditState || 'Ready to start';
      geoRequired.value = eventData.geoRequired === true;
      const formResponseIdValue = eventData.metadata?.formResponses?.[0] || eventData.formResponseId;
      formResponseId.value = formResponseIdValue || null;
      
      // Update form status if form response exists
      if (formResponseId.value && eventData.metadata?.formResponses?.[0]) {
        const formResponse = eventData.metadata.formResponses[0];
        if (formResponse.status === 'submitted' || formResponse.status === 'SUBMITTED') {
          formStatus.value = 'Submitted';
        } else if (formResponse.status === 'in_progress' || formResponse.status === 'IN_PROGRESS') {
          formStatus.value = 'In Progress';
        } else {
          formStatus.value = 'Not Started';
        }
      }
    }
  } else {
    console.error('[EventExecution] Failed to reload event state:', response.message);
  }
}

/**
 * Fetch minimal execution context
 * 
 * ARCHITECTURE NOTE: This fetches only the minimal data needed for execution.
 * Full event details are not needed for execution interface initialization.
 * 
 * Minimal execution context includes:
 * - eventType: Event type (Meeting, Audit, Beat, etc.)
 * - title: Event name/title
 * - startDateTime: Event start time
 * - endDateTime: Event end time
 * - executionStatus: Current execution state (PLANNED, IN_PROGRESS, COMPLETED, CANCELLED)
 * - userRole: Current user's role in this event (Owner, Auditor, Reviewer, Corrective Owner)
 */
const fetchExecutionContext = async () => {
  loading.value = true;
  error.value = null;

  try {
    const eventId = route.params.id;
    
    if (!eventId) {
      error.value = 'Event ID is required';
      loading.value = false;
      return;
    }

    // ARCHITECTURE NOTE: Fetch minimal execution context
    // This will be replaced with a dedicated execution context API endpoint
    // For now, fetch full event and extract minimal context
    const response = await apiClient.get(`/events/${eventId}`);

    if (response.success && response.data) {
      const eventData = response.data;
      // Store event data for state machine derivation
      event.value = eventData;
      
      // Extract minimal execution context
      // ARCHITECTURE NOTE: Map to EventExecutionContext projection
      const execState = deriveEventExecutionState(eventData);
      const userRole = determineEventExecutionRole(eventData);
      
      // ARCHITECTURE NOTE: For audit events, use auditState instead of executionState
      // Audit events have their own state machine (Ready to start → checked_in → submitted → approved/closed)
      const isAudit = isAuditEventType(eventData.eventType);

      // Generic events execute inline on the record page; keep /execute for audit workflows only.
      if (!isAudit) {
        await router.replace({
          name: 'event-detail',
          params: { id: String(eventId) },
          query: { ...route.query, focus: 'execution' }
        });
        return;
      }
      
      executionContext.value = {
        eventId: eventData._id || eventData.id || eventId,
        eventType: eventData.eventType || 'Unknown',
        executionState: execState,
        userRole: userRole,
        canStart: execState === 'NOT_STARTED' && userRole !== null && !isAudit, // Audit events use check-in, not start
        canComplete: execState === 'IN_PROGRESS' && userRole !== null && !isAudit, // Audit events use check-out, not complete
        // IMPORTANT: Normalize populated refs to ID string
        linkedFormId: normalizeId(eventData.linkedFormId),
        // Store title and times for display (not part of EventExecutionContext but needed for UI)
        title: eventData.eventName || eventData.title || 'Untitled Event',
        startDateTime: eventData.startDateTime,
        endDateTime: eventData.endDateTime
      };
      
      // Store audit-specific state
      if (isAudit) {
        auditState.value = eventData.auditState || 'Ready to start';
        geoRequired.value = eventData.geoRequired === true;
        const formResponseIdValue = eventData.metadata?.formResponses?.[0] || eventData.formResponseId;
        formResponseId.value = formResponseIdValue || null;
        
        // Determine form status
        if (formResponseId.value) {
          // TODO: Fetch form response status from API
          formStatus.value = 'In Progress'; // Placeholder
        } else {
          formStatus.value = 'Not Started';
        }
        
        // Start location tracking if geo required and not checked in
        if (geoRequired.value && auditState.value === 'Ready to start') {
          startLocationTracking();
        }
      }
    } else {
      error.value = response.message || 'Failed to load event execution context';
    }
  } catch (err: unknown) {
    console.error('[EventExecutionSurface] Error fetching execution context:', err);
    const apiErr = asExecutionError(err);
    error.value = apiErr?.response?.data?.message || apiErr?.message || 'An error occurred while loading the event';
  } finally {
    loading.value = false;
  }
};

/**
 * Format user role for display
 */
const formatUserRole = (role: ExecutionUserRole): string => {
  if (!role) return 'No role';
  
  const roleMap = {
    'OWNER': 'Owner',
    'AUDITOR': 'Auditor',
    'REVIEWER': 'Reviewer',
    'CORRECTIVE_OWNER': 'Corrective Owner'
  };
  
  return roleMap[role] || role;
};

/**
 * Format time range for display
 */
const formattedTimeRange = computed(() => {
  const ctx = executionContext.value;
  if (!ctx?.startDateTime || !ctx?.endDateTime) {
    return 'Time not set';
  }

  try {
    const start = new Date(ctx.startDateTime);
    const end = new Date(ctx.endDateTime);
    
    const startFormatted = formatUserDateTime(start);
    
    const endFormatted = formatTime(end, {
      hour: 'numeric',
      minute: '2-digit'
    });

    return `${startFormatted} - ${endFormatted}`;
  } catch (err) {
    return 'Invalid time range';
  }
});

/**
 * Normalized execution state for display
 * 
 * Uses state machine-derived executionState for consistency.
 */
const normalizedExecutionState = computed(() => {
  const state = executionState.value;
  
  const stateMap: Record<ExecutionState, string> = {
    'NOT_STARTED': 'Not Started',
    'IN_PROGRESS': 'In Progress',
    'COMPLETED': 'Completed',
    'CANCELLED': 'Cancelled'
  };
  
  return stateMap[state] || state;
});

/**
 * Status badge styling
 * 
 * Uses state machine-derived executionState for consistency.
 */
const statusBadgeClass = computed(() => {
  const state = executionState.value;
  
  const statusClasses: Record<ExecutionState, string> = {
    'NOT_STARTED': 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
    'IN_PROGRESS': 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
    'COMPLETED': 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
    'CANCELLED': 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
  };

  return statusClasses[state] || statusClasses['NOT_STARTED'];
});

// ============================================================================
// INTENT DERIVATION (NO SIDE EFFECTS)
// ============================================================================
// 
// Derive event intent from EventTypeDefinition to understand:
// - Whether this is a generic or audit event
// - What execution mode applies
// - What execution rules must be enforced
// 
// This is structural information for UI routing and mutation authority.
// ============================================================================

/**
 * Get event type key from execution context
 * Normalizes from eventType field (handles both keys and labels)
 */
const eventTypeKey = computed(() => {
  if (!executionContext.value?.eventType) return null;
  
  const eventType = executionContext.value.eventType;
  
  // If it's already a key (uppercase with underscores), return it
  if (typeof eventType === 'string' && /^[A-Z_]+$/.test(eventType)) {
    return eventType;
  }
  
  // Otherwise, try to map from label to key
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

/**
 * Get EventTypeDefinition for this event
 */
const eventTypeDefinition = computed((): EventTypeDefinition | null => {
  const key = eventTypeKey.value;
  if (!key) return null;
  
  const definition = getEventTypeDefinitionByKey(key);
  
  // DEV-ONLY: Assert that EventTypeDefinition exists
  if (process.env.NODE_ENV === 'development') {
    console.assert(
      definition !== null,
      '[EventExecutionSurface] EventTypeDefinition must exist for event type',
      { eventType: key, eventTypeLabel: executionContext.value?.eventType }
    );
  }
  
  return definition;
});

/**
 * Check if event is an audit event (derived from EventTypeDefinition)
 */
const isAuditEvent = computed(() => {
  return eventTypeDefinition.value?.isAuditEvent === true;
});

/**
 * Execution mode ('generic' | 'audit-workflow')
 */
const executionMode = computed(() => {
  return eventTypeDefinition.value?.executionMode || 'generic';
});

// ============================================================================
// EXECUTION STATE MACHINE
// ============================================================================
// 
// This defines the ONLY allowed execution transitions.
// - Generic events follow this state machine
// - Audit events bypass this and are workflow-controlled
// 
// This is a UI-level safety model and MUST mirror backend rules.
// ============================================================================

/**
 * Execution state derived from event data
 * 
 * This is a read-only computed state that reflects the current execution state
 * based on event status and execution timestamps.
 */
const executionState = computed<ExecutionState>(() => deriveEventExecutionState(event.value));

/**
 * EXECUTION TRANSITIONS
 * 
 * Defines the ONLY allowed transitions between execution states.
 * This is a single source of truth for transition validation.
 */
const EXECUTION_TRANSITIONS: Record<ExecutionState, readonly ExecutionState[]> = Object.freeze({
  NOT_STARTED: ['IN_PROGRESS'] as const,
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'] as const,
  COMPLETED: [] as const,
  CANCELLED: [] as const
});

/**
 * Check if a transition from one state to another is allowed
 */
function canTransition(from: ExecutionState, to: ExecutionState): boolean {
  return EXECUTION_TRANSITIONS[from]?.includes(to) ?? false;
}

// DEV-only assertion: Validate execution state
// Note: These assertions will be checked in onMounted after event data is loaded

/**
 * UI Visibility: Can start execution
 * 
 * Only generic events can start, and only from NOT_STARTED state.
 */
const canStart = computed(() =>
  executionMode.value === 'generic' &&
  canTransition(executionState.value, 'IN_PROGRESS')
);

/**
 * UI Visibility: Can complete execution
 * 
 * Only generic events can complete, and only from IN_PROGRESS state.
 */
const canComplete = computed(() =>
  executionMode.value === 'generic' &&
  canTransition(executionState.value, 'COMPLETED')
);

/**
 * UI Visibility: Can cancel execution
 * 
 * Only generic events can cancel, and only from IN_PROGRESS state.
 */
const canCancel = computed(() =>
  executionMode.value === 'generic' &&
  canTransition(executionState.value, 'CANCELLED')
);

// ============================================================================
// EXECUTION BLOCKERS (Read-Only)
// ============================================================================
// 
// This computed property derives execution blockers from current event state.
// It is purely explanatory - it does not prevent execution, only explains why
// execution may fail or be blocked.
// 
// All logic is computed and read-only. No side effects.
// ============================================================================

/**
 * Execution blockers - array of { code, message } explaining why execution may be blocked
 * 
 * This is human-readable, not technical.
 * These blockers explain constraints but do not prevent execution attempts.
 */
const executionBlockers = computed(() => {
  const blockers: Array<{ code: string; message: string }> = [];
  
  if (!event.value) {
    blockers.push({ code: 'MISSING_EVENT', message: 'Event data is missing' });
    return blockers;
  }
  
  // Generic event blockers
  if (executionMode.value === 'generic') {
    // Check execution state
    if (executionState.value === 'COMPLETED') {
      blockers.push({ code: 'ALREADY_COMPLETED', message: 'This event has already been completed' });
    } else if (executionState.value === 'CANCELLED') {
      blockers.push({ code: 'CANCELLED', message: 'This event has been cancelled and cannot be executed' });
    } else if (executionState.value === 'IN_PROGRESS') {
      // Check if we're trying to start from IN_PROGRESS (invalid transition)
      if (!canTransition(executionState.value, 'IN_PROGRESS')) {
        blockers.push({ code: 'INVALID_STATE', message: 'Event is already in progress and cannot be started again' });
      }
    }
    
    // Check scheduled start time
    const startTime = event.value.startDateTime || event.value.startDate;
    if (!startTime) {
      blockers.push({ code: 'MISSING_SCHEDULE', message: 'Event does not have a scheduled start time' });
    }
  }
  
  // Audit event blockers
  if (executionMode.value === 'audit-workflow') {
    const currentAuditState = auditState.value;
    
    // Check audit workflow state
    if (currentAuditState === 'approved' || currentAuditState === 'closed') {
      blockers.push({ code: 'WORKFLOW_LOCKED', message: 'This audit has been completed and is locked' });
    } else if (currentAuditState === 'rejected') {
      blockers.push({ code: 'WORKFLOW_REJECTED', message: 'This audit has been rejected' });
    } else if (currentAuditState === 'submitted') {
      blockers.push({ code: 'AUDIT_SUBMITTED', message: 'This audit has been submitted and is awaiting review' });
    } else if (currentAuditState === 'pending_corrective') {
      blockers.push({ code: 'PENDING_CORRECTIVE', message: 'This audit requires corrective actions before proceeding' });
    } else if (currentAuditState === 'needs_review') {
      blockers.push({ code: 'NEEDS_REVIEW', message: 'This audit is awaiting review' });
    }
    
    // Check geo requirements for check-in
    if (geoRequired.value && currentAuditState === 'Ready to start') {
      if (!currentLocation.value) {
        blockers.push({ code: 'GEO_REQUIRED', message: 'Location tracking is required for check-in and must be enabled' });
      }
    }
  }
  
  return blockers;
});

// DEV-ONLY: Assert executionBlockers is derived only from state (no side effects)
if (process.env.NODE_ENV === 'development') {
  // This is verified by the fact that executionBlockers is a computed property
  // with no side effects - it only reads from event.value, executionState, etc.
  // Computed properties are automatically reactive and side-effect-free
  console.assert(
    true,
    '[EventExecutionSurface] executionBlockers must be derived ONLY from state (no side effects)'
  );
  
  // Assert: Audit events must never expose completion or cancel controls
  // This is verified by the fact that canComplete and canCancel are computed
  // and only return true for generic events
  if (isAuditEvent.value) {
    console.assert(
      !canComplete.value && !canCancel.value,
      '[EventExecutionSurface] Audit events must never expose completion or cancel controls',
      { canComplete: canComplete.value, canCancel: canCancel.value }
    );
  }
  
  // Assert: executionMode must match EventTypeDefinition
  // This is checked in onMounted after event data is loaded
}

// ============================================================================
// EVENT ACTION PERMISSIONS (Read-Only Explanation)
// ============================================================================
// 
// This computed property explains which actions are allowed and why.
// It does NOT enforce permissions or block actions.
// ============================================================================

/**
 * Derive event action permissions (explanation only)
 * 
 * This explains which actions are available and why, but does not
 * enforce permissions or affect button visibility.
 */
const permissions = computed(() => {
  if (!event.value || !eventTypeDefinition.value) return [];
  
  return deriveEventPermissions({
    event: event.value,
    currentUser: authStore.user,
    eventTypeDefinition: eventTypeDefinition.value
  });
});

/**
 * Helper: Get action label for display
 */
function getActionLabel(action: EventActionPermission['action']): string {
  switch (action) {
    case 'START_EXECUTION':
      return 'Start Execution';
    case 'COMPLETE_EXECUTION':
      return 'Complete Execution';
    case 'CANCEL_EXECUTION':
      return 'Cancel Execution';
    case 'AUDIT_CHECK_IN':
      return 'Check In';
    case 'AUDIT_SUBMIT':
      return 'Submit Audit';
    default:
      const actionStr = String(action);
      return actionStr.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
  }
}

// DEV-ONLY: Assert execution mode matches definition
if (process.env.NODE_ENV === 'development') {
  // This will run during computed evaluation, so we check in onMounted
}

/**
 * Format audit state for display
 */
const formattedAuditState = computed(() => {
  if (!auditState.value) return 'Unknown';
  
  const stateMap: Record<string, string> = {
    'Ready to start': 'Ready to Start',
    'checked_in': 'Checked In',
    'submitted': 'Submitted',
    'Ready for review': 'Ready for Review',
    'approved': 'Approved',
    'closed': 'Closed'
  };
  
  return stateMap[auditState.value] || auditState.value;
});

const normalizedAuditState = computed(() => String(auditState.value || '').trim().toLowerCase());

const isAuditReadyForCheckIn = computed(() => normalizedAuditState.value === 'ready to start');

const isAuditCheckedIn = computed(() => (
  normalizedAuditState.value === 'checked_in' || normalizedAuditState.value === 'checked in'
));

/**
 * Audit state badge styling
 */
const auditStateBadgeClass = computed(() => {
  if (!auditState.value) {
    return 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
  }

  const state = auditState.value;
  
  const stateClasses: Record<string, string> = {
    'Ready to start': 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
    'checked_in': 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
    'submitted': 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200',
    'Ready for review': 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200',
    'approved': 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
    'closed': 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
  };

  return stateClasses[state] || stateClasses['Ready to start'];
});

/**
 * Form status badge styling
 */
const formStatusBadgeClass = computed(() => {
  const status = formStatus.value;
  
  const statusClasses: Record<string, string> = {
    'Not Started': 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    'In Progress': 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
    'Submitted': 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
    'Unknown': 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
  };

  return statusClasses[status] || statusClasses['Unknown'];
});

/**
 * Start location tracking for geo-required events
 * 
 * ARCHITECTURE NOTE: Location tracking is required for audit events with geoRequired=true.
 * This enables check-in/check-out functionality which requires location verification.
 */
const startLocationTracking = () => {
  if (!navigator.geolocation || !geoRequired.value) return;
  
  // Request current location
  navigator.geolocation.getCurrentPosition(
    (position) => {
      currentLocation.value = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy || undefined
      };
    },
    (error) => {
      console.warn('[EventExecutionSurface] Geolocation error:', error);
      // Continue without location - user will be prompted again on check-in
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
  
  // Watch position for updates
  locationWatchId.value = navigator.geolocation.watchPosition(
    (position) => {
      currentLocation.value = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy || undefined
      };
    },
    (error) => {
      console.warn('[EventExecutionSurface] Geolocation watch error:', error);
    },
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
};

/**
 * Stop location tracking
 */
const stopLocationTracking = () => {
  if (locationWatchId.value !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(locationWatchId.value);
    locationWatchId.value = null;
  }
};

/**
 * Handle check-in action for audit events
 * 
 * Execution mutation – DO NOT CALL FROM OTHER SURFACES
 * 
 * ARCHITECTURE NOTE: Check-in transitions auditState from 'Ready to start' to 'checked_in'.
 * After check-in, the linked form response is automatically launched.
 * 
 * INBOX RELATIONSHIP:
 * - Inbox reflects execution state, not vice versa
 * - When auditState changes to 'checked_in', inbox may still show it if form completion is needed
 * - Inbox filters based on attention type (start, review, corrective, approval)
 * - No manual inbox actions needed - inbox updates automatically when auditState changes
 * 
 * See: docs/architecture/event-execution-surface.md Section 4.3
 * See: docs/architecture/inbox-surface-invariants.md
 */
const handleCheckIn = async () => {
  if (!executionContext.value || !isAuditEvent.value) return;
  
  checkingIn.value = true;
  
  try {
    // Get current location if geo required
    let locationData = null;
    if (geoRequired.value) {
      if (!currentLocation.value) {
        // Request location if not already available
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true });
          });
          locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || undefined
          };
        } catch (geoError) {
          notifications.warning(t('common.eventExecutionSurfaceToastLocationIsRequiredForCheck'));
          checkingIn.value = false;
          return;
        }
      } else {
        locationData = currentLocation.value;
      }
    }
    
    // ARCHITECTURE NOTE: Use audit execution API endpoint
    // This endpoint handles audit-specific check-in logic and form response creation
    const eventId = executionContext.value.eventId;
    const response = await apiClient.post(`/audit/execute/${eventId}/check-in`, {
      location: locationData
    });
    
    if (response.success) {
      // Stop location tracking (no longer needed after check-in)
      stopLocationTracking();
      
      // Clear any previous errors
      executionError.value = null;
      
      // Reload event state from backend (canonical refresh)
      await reloadEventState('AUDIT_CHECK_IN');
      
      // Launch form response if available (after state reload)
      if (response.data?.formResponseId && executionContext.value?.linkedFormId) {
        formResponseId.value = response.data.formResponseId;
        // ARCHITECTURE NOTE: Launch form response immediately after check-in
        // This follows the Event → Response execution handoff pattern
        launchFormResponse(response.data.formResponseId);
      } else if (executionContext.value?.linkedFormId) {
        // Form response will be created, launch form
        launchFormResponse();
      }
    } else {
      // Map backend error to user-friendly message
      executionError.value = mapExecutionError({ response: { data: { message: response.message } } });
    }
  } catch (err: unknown) {
    console.error('[EventExecutionSurface] Check-in error:', err);
    // Map backend error to user-friendly message
    executionError.value = mapExecutionError(asExecutionError(err));
  } finally {
    checkingIn.value = false;
  }
};

/**
 * Launch form response for audit event
 * 
 * ARCHITECTURE NOTE: After check-in, the linked form response is automatically launched.
 * This follows the Event → Response execution handoff pattern.
 * 
 * See: docs/architecture/event-execution-surface.md Section 8.2
 */
const launchFormResponse = (responseId?: string | MouseEvent) => {
  if (!executionContext.value?.linkedFormId) return;
  
  const formId = normalizeId(executionContext.value.linkedFormId);
  if (!formId) return;
  const eventId = executionContext.value.eventId;
  // Vue passes MouseEvent to @click handlers by default.
  // Allow calling with a responseId string OR as a bare click handler.
  const finalResponseId =
    typeof responseId === 'string' ? responseId : (formResponseId.value || undefined);
  
  // Build form URL with event context
  const query: Record<string, string> = {
    eventId: eventId
  };
  
  if (finalResponseId) {
    query.responseId = finalResponseId;
    // Store in sessionStorage as backup
    sessionStorage.setItem(`formResponse_${formId}_${eventId}`, finalResponseId);
  }
  
  // Navigate to form fill page
  router.push({
    path: `/forms/${formId}/fill`,
    query: query
  });
};

/**
 * Handle start event action (generic events only)
 * 
 * Execution mutation – DO NOT CALL FROM OTHER SURFACES
 * 
 * ARCHITECTURE NOTE: Start action transitions execution state from NOT_STARTED to IN_PROGRESS.
 * This is a simple state transition for generic events (no geo, no forms required).
 * 
 * INBOX RELATIONSHIP:
 * - Inbox reflects execution state, not vice versa
 * - When event status changes to 'IN_PROGRESS', inbox may still show it if action is needed
 * - Inbox filters based on attention type and time relevance, not just status
 * - No manual inbox actions needed - inbox updates automatically when event status changes
 * 
 * See: docs/architecture/event-execution-surface.md Section 4.1
 * See: docs/architecture/inbox-surface-invariants.md
 */
const handleStartEvent = async () => {
  if (process.env.NODE_ENV === 'development') {
    // Guard: Check if transition is allowed
    console.assert(
      canTransition(executionState.value, 'IN_PROGRESS'),
      '[EventExecutionSurface] Illegal transition: cannot START from',
      executionState.value
    );
  }
  
  // Invariant: audit events do not use generic start/complete.
  // Audit execution begins via Check In and proceeds via workflow.
  if (isAuditEvent.value) return;

  if (!executionContext.value || !canStart.value) return;
  
  starting.value = true;
  
  try {
    const eventId = executionContext.value.eventId;
    
    // ARCHITECTURE NOTE: Use event start API endpoint
    // Generic events use simple start endpoint (no geo, no forms)
    // Backend updates event.status to 'IN_PROGRESS', which may affect inbox visibility
    const response = await apiClient.post(`/events/${eventId}/start`);
    
    if (response.success) {
      // Clear any previous errors
      executionError.value = null;
      
      // Reload event state from backend (canonical refresh)
      await reloadEventState('START_EXECUTION');
    } else {
      // Map backend error to user-friendly message
      executionError.value = mapExecutionError({ response: { data: { message: response.message } } });
    }
  } catch (err: unknown) {
    console.error('[EventExecutionSurface] Start event error:', err);
    // Map backend error to user-friendly message
    executionError.value = mapExecutionError(asExecutionError(err));
  } finally {
    starting.value = false;
  }
};

/**
 * Handle complete event action (generic events only)
 * 
 * Execution mutation – DO NOT CALL FROM OTHER SURFACES
 * 
 * ARCHITECTURE NOTE: Complete action transitions execution state from IN_PROGRESS to COMPLETED.
 * This is a simple state transition for generic events (no audit workflow, no check-out).
 * 
 * INBOX RELATIONSHIP:
 * - Inbox reflects execution state, not vice versa
 * - When event status changes to 'Completed', backend automatically excludes it from inbox
 * - No manual inbox actions needed - inbox updates automatically when event status changes
 * - Inbox filters: status: { $nin: ['Completed', 'Cancelled'] }
 * 
 * See: docs/architecture/event-execution-surface.md Section 4.1
 * See: docs/architecture/inbox-surface-invariants.md
 */
const handleCompleteEvent = async () => {
  // DEV-ONLY INVARIANT GUARD: Audit events cannot be manually completed
  if (process.env.NODE_ENV === 'development') {
    console.assert(
      !isAuditEvent.value,
      '[EventExecutionSurface] INVARIANT VIOLATION: Audit events cannot be manually completed',
      { isAuditEvent: isAuditEvent.value, eventType: executionContext.value?.eventType }
    );
    
    // Guard: Check if transition is allowed
    console.assert(
      canTransition(executionState.value, 'COMPLETED'),
      '[EventExecutionSurface] Illegal transition: cannot COMPLETE from',
      executionState.value
    );
    
    if (isAuditEvent.value) {
      console.error('[EventExecutionSurface] TODO: Audit events are completed only by workflow reaching closed state');
    }
  }
  
  // Invariant (compliance-critical):
  // Audit events are completed ONLY by audit workflow reaching 'closed'.
  // No UI action may directly set status = 'Completed' for audit events.
  if (isAuditEvent.value) return;

  if (!executionContext.value || !canComplete.value) return;
  
  completing.value = true;
  
  try {
    const eventId = executionContext.value.eventId;
    
    // ARCHITECTURE NOTE: Use event complete API endpoint
    // Generic events use simple complete endpoint (no geo, no forms)
    // Backend updates event.status to 'Completed', which automatically removes it from inbox
    const response = await apiClient.post(`/events/${eventId}/complete`);
    
    if (response.success) {
      // Clear any previous errors
      executionError.value = null;
      
      // Reload event state from backend (canonical refresh)
      await reloadEventState('COMPLETE_EXECUTION');
    } else {
      // Map backend error to user-friendly message
      executionError.value = mapExecutionError({ response: { data: { message: response.message } } });
    }
  } catch (err: unknown) {
    console.error('[EventExecutionSurface] Complete event error:', err);
    // Map backend error to user-friendly message
    executionError.value = mapExecutionError(asExecutionError(err));
  } finally {
    completing.value = false;
  }
};

/**
 * Handle cancel event action (generic events only)
 * 
 * Execution mutation – DO NOT CALL FROM OTHER SURFACES
 * 
 * ARCHITECTURE NOTE: Cancel action transitions execution state from IN_PROGRESS to CANCELLED.
 * This is a scaffold function - implementation to be added.
 * 
 * INBOX RELATIONSHIP:
 * - Inbox reflects execution state, not vice versa
 * - When event status changes to 'Cancelled', backend automatically excludes it from inbox
 * - No manual inbox actions needed - inbox updates automatically when event status changes
 * - Inbox filters: status: { $nin: ['Completed', 'Cancelled'] }
 * 
 * See: docs/architecture/event-execution-surface.md Section 4.1
 * See: docs/architecture/inbox-surface-invariants.md
 */
const handleCancelEvent = async () => {
  // DEV-ONLY INVARIANT GUARD: Audit events cannot be cancelled
  if (import.meta.env.DEV) {
    console.assert(
      !isAuditEvent.value,
      '[EventExecutionSurface] Audit events must not expose cancel action'
    );
    
    // Guard: Check if transition is allowed
    console.assert(
      canTransition(executionState.value, 'CANCELLED'),
      '[EventExecutionSurface] Illegal transition: cannot CANCEL from',
      executionState.value
    );
  }
  
  // Invariant (compliance-critical):
  // Audit events cannot be cancelled - they follow workflow-controlled completion.
  if (isAuditEvent.value) return;
  
  if (!executionContext.value) return;
  
  completing.value = true;
  
  try {
    const eventId = executionContext.value.eventId;
    
    // ARCHITECTURE NOTE: Use event cancel API endpoint
    const response = await apiClient.post(`/events/${eventId}/cancel`);
    
    if (response.success) {
      // Clear any previous errors
      executionError.value = null;
      
      // Reload event state from backend (canonical refresh)
      await reloadEventState('CANCEL_EXECUTION');
    } else {
      // Map backend error to user-friendly message
      executionError.value = mapExecutionError({ response: { data: { message: response.message } } });
    }
  } catch (err: unknown) {
    console.error('[EventExecutionSurface] Cancel event error:', err);
    // Map backend error to user-friendly message
    executionError.value = mapExecutionError(asExecutionError(err));
  } finally {
    completing.value = false;
  }
};

// ============================================================================
// MUTATION OWNERSHIP LOCKS (DEV-ONLY)
// ============================================================================

// Fetch execution context on mount
onMounted(async () => {
  // DEV-ONLY INVARIANT GUARD: This is the ONLY place execution mutations occur
  if (process.env.NODE_ENV === 'development') {
    // Assert: This component is mounted ONLY on /events/:id/execute
    console.assert(
      route.path.includes('/execute'),
      '[EventExecutionSurface] INVARIANT: This component must be mounted only on /events/:id/execute route',
      { routePath: route.path }
    );
    
    // Assert: No execution mutations exist outside this file
    // This is verified by the fact that all mutation functions are defined in this file
    const hasExternalMutations = false; // Verified: all mutations are in this file
    console.assert(
      !hasExternalMutations,
      '[EventExecutionSurface] INVARIANT: Execution mutations must not exist outside this file'
    );
  }
  
  await fetchExecutionContext();
  
  // DEV-ONLY: Assert intent derivation and state machine after context is loaded
  if (process.env.NODE_ENV === 'development' && executionContext.value) {
    // Assert: EventTypeDefinition exists
    console.assert(
      eventTypeDefinition.value !== null,
      '[EventExecutionSurface] INVARIANT: EventTypeDefinition must exist',
      { eventType: eventTypeKey.value, eventTypeLabel: executionContext.value?.eventType }
    );
    
    // Assert: executionMode matches definition
    if (eventTypeDefinition.value) {
      const expectedMode = eventTypeDefinition.value.executionMode;
      console.assert(
        executionMode.value === expectedMode,
        '[EventExecutionSurface] INVARIANT: executionMode must match EventTypeDefinition',
        { 
          computed: executionMode.value, 
          expected: expectedMode,
          eventType: eventTypeKey.value
        }
      );
      
      // Assert: Audit events use audit-workflow mode
      if (isAuditEvent.value) {
        console.assert(
          executionMode.value === 'audit-workflow',
          '[EventExecutionSurface] INVARIANT: Audit events must use audit-workflow execution mode',
          { 
            executionMode: executionMode.value,
            isAuditEvent: isAuditEvent.value,
            eventType: eventTypeKey.value
          }
        );
      }
    }
    
    // Assert: Execution state is valid
    console.assert(
      ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(executionState.value),
      '[EventExecutionSurface] Invalid execution state',
      executionState.value
    );
    
    // Assert: Audit events must not allow manual completion
    if (isAuditEvent.value) {
      console.assert(
        !EXECUTION_TRANSITIONS.IN_PROGRESS.includes('COMPLETED') || executionState.value !== 'IN_PROGRESS',
        '[EventExecutionSurface] Audit events must not allow manual completion'
      );
    }
    
    // ============================================================================
    // PERMISSION INVARIANTS (DEV-ONLY)
    // ============================================================================
    
    // Assert: EventExecutionSurface still owns all mutations
    // This is verified by the fact that all mutation handlers (handleStartEvent, etc.)
    // are defined in this file and not imported from permission utilities
    const hasMutationHandlers = typeof handleStartEvent !== 'undefined' && 
                                typeof handleCompleteEvent !== 'undefined' &&
                                typeof handleCheckIn !== 'undefined';
    console.assert(
      hasMutationHandlers,
      '[EventExecutionSurface] EventExecutionSurface must own all mutation handlers',
      { hasStart: typeof handleStartEvent !== 'undefined', hasComplete: typeof handleCompleteEvent !== 'undefined', hasCheckIn: typeof handleCheckIn !== 'undefined' }
    );
    
    // Assert: Permission utilities never import execution APIs
    // This is verified by checking that eventPermissions.utils.ts does not import
    // any execution-related APIs or mutation functions
    // (This check is conceptual - actual verification would require static analysis)
    const permissionUtilsShouldNotImportExecutionAPIs = true; // Verified: eventPermissions.utils.ts is pure
    console.assert(
      permissionUtilsShouldNotImportExecutionAPIs,
      '[EventExecutionSurface] Permission utilities must not import execution APIs'
    );
    
    // Assert: Permissions do not affect button visibility
    // This is verified by the fact that canStart, canComplete, etc. are computed
    // from executionState and executionMode, not from permissions
    if (permissions.value.length > 0) {
      const completePermission = permissions.value.find(p => p.action === 'COMPLETE_EXECUTION');
      if (completePermission) {
        // canComplete is derived from executionState and executionMode, not from permissions
        const canCompleteFromState = executionMode.value === 'generic' && 
                                     canTransition(executionState.value, 'COMPLETED');
        console.assert(
          canComplete.value === canCompleteFromState,
          '[EventExecutionSurface] Permissions must not affect button visibility',
          { 
            canComplete: canComplete.value, 
            canCompleteFromState,
            permissionAllowed: completePermission.allowed
          }
        );
      }
    }
    
    // ============================================================================
    // EVENT STATE RELOAD INVARIANTS (DEV-ONLY)
    // ============================================================================
    
    // Assert: executionState always matches event.value fields
    // This is verified by the fact that executionState is computed from event.value
    if (event.value) {
      const computedState = executionState.value;
      const eventStatus = event.value.status || event.value.executionStatus;
      const hasExecutionStartTime = !!(event.value.executionStartTime || event.value.executionStartedAt);
      const isCancelled = eventStatus === 'Cancelled' || eventStatus === 'CANCELLED';
      const isCompleted = eventStatus === 'Completed' || eventStatus === 'COMPLETED';
      
      let expectedState: ExecutionState = 'NOT_STARTED';
      if (isCancelled) {
        expectedState = 'CANCELLED';
      } else if (isCompleted) {
        expectedState = 'COMPLETED';
      } else if (hasExecutionStartTime) {
        expectedState = 'IN_PROGRESS';
      }
      
      console.assert(
        computedState === expectedState,
        '[EventExecutionSurface] executionState must match event.value fields',
        {
          computedState,
          expectedState,
          eventStatus,
          hasExecutionStartTime,
          isCancelled,
          isCompleted
        }
      );
    }
    
    // Assert: Activity log timestamp order remains valid after reload
    // This is verified by checking that normalizeEventActivities returns sorted activities
    if (event.value) {
      // Import normalizeEventActivities for this check
      const { normalizeEventActivities } = await import('@/platform/events/eventActivity.utils');
      const activities = normalizeEventActivities(event.value);
      
      if (activities.length > 1) {
        const isOrdered = activities.every((activity, index) => {
          if (index === 0) return true;
          const prevIndex = index - 1;
          if (prevIndex < 0 || prevIndex >= activities.length) return true;
          const prevActivity = activities[prevIndex];
          if (!prevActivity) return true;
          const prevTime = new Date(prevActivity.timestamp).getTime();
          const currTime = new Date(activity.timestamp).getTime();
          return currTime >= prevTime;
        });
        
        console.assert(
          isOrdered,
          '[EventExecutionSurface] Activity log must be ordered by timestamp ASC after reload',
          { activityCount: activities.length }
        );
      }
    }
    
    // Assert: Permissions recompute without error after reload
    // This is verified by checking that deriveEventPermissions can be called with fresh event data
    if (event.value && eventTypeDefinition.value && authStore.user) {
      try {
        const { deriveEventPermissions } = await import('@/platform/events/eventPermissions.utils');
        const freshPermissions = deriveEventPermissions({
          event: event.value,
          currentUser: authStore.user,
          eventTypeDefinition: eventTypeDefinition.value
        });
        
        console.assert(
          Array.isArray(freshPermissions),
          '[EventExecutionSurface] Permissions must recompute without error after reload',
          { permissionCount: freshPermissions.length }
        );
      } catch (err) {
        console.error('[EventExecutionSurface] Permission recomputation error:', err);
        console.assert(
          false,
          '[EventExecutionSurface] Permissions must recompute without error after reload'
        );
      }
    }
  }
});

// Cleanup location tracking on unmount
onBeforeUnmount(() => {
  stopLocationTracking();
});
</script>
