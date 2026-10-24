<template>
  <!--
    ============================================================================
    Audit Schedule Surface
    ============================================================================
    
    ARCHITECTURE NOTE: This surface is the ONLY way to create audit events.
    
    This surface instantiates audit workflows by creating properly configured
    audit event instances with all required configuration (roles, forms, geo, constraints).
    
    Entry Points:
    - Audit App → "Schedule Audit" → /audit/schedule
    - Organization Surface → "Schedule Audit" → /audit/schedule (with org context)
    - Command Palette → "Schedule Audit" → /audit/schedule
    
    All entry points route to this unified surface.
    
    Explicitly NOT for:
    - Audit execution (belongs in EventExecution components)
    - Audit responses or approvals (belongs in Audit Work interfaces)
    - Check-in/check-out (belongs in Work interfaces)
    - Calendar views (belongs in Calendar components)
    
    See: docs/architecture/audit-scheduling-surface.md
    ============================================================================
  -->
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto p-6 lg:p-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">{{ t('audit.auditScheduleSurfaceScheduleAudit') }}</h1>
        <p class="text-lg text-gray-600 dark:text-gray-400">{{ t('audit.auditScheduleSurfacePlanAndConfigureAnAuditBefore') }}</p>
      </div>

      <!-- Step-Based Layout -->
      <!--
        ARCHITECTURE NOTE: Guided, step-based flow (not a raw form).
        
        Why guided steps:
        - Audit scheduling requires careful configuration
        - Each step focuses on one aspect (type, organization, roles, time, form, review)
        - Step validation ensures all required fields are completed correctly
        - Reduces errors and improves compliance
        
        Steps are sequential and cannot be skipped until validated.
        This ensures audit events are created with complete, correct configuration.
        
        See: docs/architecture/audit-scheduling-surface.md Section 6.1 (Guided, Step-Based Flow)
      -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="flex flex-col lg:flex-row">
          <!-- Step Indicator (Left Side - Vertical on desktop, Horizontal on mobile) -->
          <div class="lg:w-64 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-6">
            <nav :aria-label="t('audit.auditScheduleSurfaceAuditSchedulingSteps')">
              <!-- Mobile: Horizontal Step Indicator -->
              <div class="lg:hidden">
                <div class="flex items-center justify-between mb-4">
                  <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Step {{ currentStepIndex + 1 }} of {{ stepDefinitions.length }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <div
                    v-for="(step, index) in stepDefinitions"
                    :key="step.step"
                    class="flex-1 flex flex-col items-center"
                  >
                    <div
                      :class="[
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                        index === currentStepIndex
                          ? 'bg-indigo-600 text-white ring-2 ring-indigo-200 dark:ring-indigo-800'
                          : index < currentStepIndex
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      ]"
                    >
                      <svg
                        v-if="index < currentStepIndex"
                        class="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      <span v-else>{{ index + 1 }}</span>
                    </div>
                    <div
                      v-if="index < stepDefinitions.length - 1"
                      :class="[
                        'w-full h-0.5 mt-4 -mb-4',
                        index < currentStepIndex ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
                      ]"
                    ></div>
                  </div>
                </div>
              </div>

              <!-- Desktop: Vertical Step Indicator -->
              <ol role="list" class="hidden lg:block space-y-4">
                <li
                  v-for="(step, index) in stepDefinitions"
                  :key="step.step"
                  class="relative"
                >
                  <div
                    :class="[
                      'flex items-start',
                      index < stepDefinitions.length - 1 ? 'pb-6' : ''
                    ]"
                  >
                    <!-- Step Number/Status Icon -->
                    <div class="relative flex items-center">
                      <div
                        :class="[
                          'flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium transition-colors',
                          index === currentStepIndex
                            ? 'bg-indigo-600 text-white ring-2 ring-indigo-200 dark:ring-indigo-800'
                            : index < currentStepIndex
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        ]"
                      >
                        <svg
                          v-if="index < currentStepIndex"
                          class="w-6 h-6"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clip-rule="evenodd"
                          />
                        </svg>
                        <span v-else class="text-sm font-semibold">{{ index + 1 }}</span>
                      </div>
                      <!-- Connector Line -->
                      <div
                        v-if="index < stepDefinitions.length - 1"
                        :class="[
                          'absolute left-5 top-10 w-0.5 h-full',
                          index < currentStepIndex ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
                        ]"
                      ></div>
                    </div>
                    <!-- Step Label -->
                    <div class="ml-4 min-w-0 flex-1">
                      <p
                        :class="[
                          'text-sm font-medium',
                          index === currentStepIndex
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : index < currentStepIndex
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-500 dark:text-gray-400'
                        ]"
                      >
                        {{ step.label }}
                      </p>
                      <p
                        v-if="step.description"
                        class="text-xs text-gray-500 dark:text-gray-400 mt-0.5"
                      >
                        {{ step.description }}
                      </p>
                    </div>
                  </div>
                </li>
              </ol>
            </nav>
          </div>

          <!-- Active Step Content (Right Side) -->
          <div class="flex-1 p-6 lg:p-8">
            <!-- Step Content -->
            <div class="mb-6">
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {{ currentStepDefinition.label }}
              </h2>
              <p
                v-if="currentStepDefinition.description"
                class="text-sm text-gray-600 dark:text-gray-400 mb-6"
              >
                {{ currentStepDefinition.description }}
              </p>

              <!-- Step Content -->
              <!-- Step 1: Select Audit Type -->
              <div v-if="currentStep === AuditScheduleStep.SELECT_TYPE" class="space-y-6">
                <!-- Helper Text -->
                <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p class="text-sm text-blue-800 dark:text-blue-300">
                    <strong>{{ t('audit.auditScheduleSurfaceAuditTypeDeterminesRolesGeoRules') }}</strong>{{ t('audit.auditScheduleSurfaceChooseTheTypeThatMatchesYour') }}</p>
                </div>

                <!-- Audit Type Selection Cards -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    v-for="auditType in auditEventTypes"
                    :key="auditType.key"
                    @click="selectAuditType(auditType.label)"
                    :class="[
                      'relative p-6 rounded-lg border-2 transition-all text-left',
                      draft.auditType === auditType.label
                        ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-200 dark:ring-indigo-800'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
                    ]"
                  >
                    <!-- Selection Indicator -->
                    <div
                      v-if="draft.auditType === auditType.label"
                      class="absolute top-4 right-4"
                    >
                      <div class="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 dark:bg-indigo-500">
                        <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fill-rule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clip-rule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>

                    <!-- Type Name -->
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2 pr-8">
                      {{ auditType.label }}
                    </h3>

                    <!-- Description -->
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {{ getAuditTypeDescription(auditType.key) }}
                    </p>

                    <!-- Consequences / Requirements -->
                    <div class="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('audit.auditScheduleSurfaceRequirements') }}</div>
                      <ul class="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <li
                          v-for="requirement in getAuditTypeRequirements(auditType.key)"
                          :key="requirement"
                          class="flex items-start gap-2"
                        >
                          <svg
                            class="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span>{{ requirement }}</span>
                        </li>
                      </ul>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Step 2: Select Target Organization(s) -->
              <div v-else-if="currentStep === AuditScheduleStep.SELECT_TARGET" class="space-y-6">
                <!-- Helper Text -->
                <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p class="text-sm text-blue-800 dark:text-blue-300">
                    <strong>{{ t('audit.auditScheduleSurfaceTargetOrganizationsDetermineTheScopeOf') }}</strong>
                    <span v-if="isSingleOrgAudit">{{ t('audit.auditScheduleSurfaceSelectExactlyOneOrganizationToAudit') }}</span>
                    <span v-else-if="isBeatAudit">{{ t('audit.auditScheduleSurfaceSelectMultipleOrganizationsMinimum2For') }}</span>
                    <span v-if="isInternalAudit">{{ t('audit.auditScheduleSurfaceInternalAuditsTargetYourOrganizationOnly') }}</span>
                  </p>
                </div>

                <!-- Internal Audit: Locked Organization Display -->
                <div v-if="isInternalAudit" class="bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg p-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ userOrganization?.name || 'Your Organization' }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ t('audit.auditScheduleSurfaceInternalAuditsAreAutomaticallyScopedTo') }}</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="px-2 py-1 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded">{{ t('settings.modFieldsLocked') }}</span>
                    </div>
                  </div>
                </div>

                <!--
                  AUDIT SCHEDULING PREREQUISITE (UX + logic)
                  --------------------------------------------------------------------------
                  Invariant:
                  - Audit scheduling requires a human-readable organization address.
                  - Precise location enforcement happens at execution time via GEO check-in.
                  - Do NOT add free-text "event location" fields to audit events here.
                  - This is prerequisite completion (address), not full Organization editing.
                  - Non-goals: lat/lng, maps, radius/accuracy, full org edit form.
                -->
                <div
                  v-if="isAuditAddressBlocking"
                  class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4"
                >
                  <div class="flex items-start gap-3">
                    <svg
                      class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div class="flex-1">
                      <p class="text-sm font-semibold text-amber-900 dark:text-amber-200">{{ t('audit.auditScheduleSurfaceOrganizationAddressRequired') }}</p>
                      <p class="text-sm text-amber-800 dark:text-amber-300 mt-1">{{ t('audit.auditScheduleSurfaceAuditsRequireAPhysicalLocationPlease') }}</p>
                      <p v-if="missingAddressOrganizationNames.length > 0" class="text-xs text-amber-800 dark:text-amber-300 mt-2">{{ t('audit.auditScheduleSurfaceMissingAddress') }}<span class="font-medium">{{ missingAddressOrganizationNames.join(', ') }}</span>
                      </p>
                      <div class="mt-3 flex flex-wrap gap-3">
                        <button
                          type="button"
                          @click="openAddressEditorForNextMissing"
                          class="px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                        >{{ t('audit.auditScheduleSurfaceAddAddress2') }}</button>
                        <button
                          type="button"
                          @click="cancelScheduling"
                          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >{{ t('audit.auditScheduleSurfaceCancelScheduling') }}</button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Inline "Add Address" editor (no navigation away, address-only) -->
                <div
                  v-if="showAddressEditor"
                  class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('audit.auditScheduleSurfaceAddAddress') }}</p>
                      <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">{{ t('audit.auditScheduleSurfaceOrganization') }}<span class="font-medium">{{ getOrganizationName(addressEditorOrgId || '') }}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      @click="closeAddressEditor"
                      class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      :aria-label="t('audit.auditScheduleSurfaceCloseAddressEditor')"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div class="space-y-2">
                    <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('audit.auditScheduleSurfaceAddress') }}<span class="text-red-500">*</span>
                    </label>
                    <textarea
                      v-model="addressDraft"
                      rows="3"
                      :placeholder="t('audit.auditScheduleSurfaceStreetCityStateCountry')"
                      class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    ></textarea>
                    <p v-if="addressSaveError" class="text-xs text-red-600 dark:text-red-400">
                      {{ addressSaveError }}
                    </p>
                  </div>

                  <div class="flex items-center justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      @click="closeAddressEditor"
                      class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >{{ t('performance.cancelWizard') }}</button>
                    <button
                      type="button"
                      @click="saveAddress"
                      :disabled="savingAddress || !addressDraft.trim()"
                      :class="[
                        'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                        savingAddress || !addressDraft.trim()
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                          : 'bg-amber-600 text-white hover:bg-amber-700'
                      ]"
                    >
                      {{ savingAddress ? 'Saving...' : 'Save address' }}
                    </button>
                  </div>
                </div>

                <!-- External Audit: Organization Picker -->
                <div v-if="!isInternalAudit" class="space-y-4">
                  <!-- Search Input -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('audit.auditScheduleSurfaceSearchOrganizations') }}</label>
                    <div class="relative">
                      <input
                        v-model="orgSearchQuery"
                        @input="handleOrgSearch"
                        type="text"
                        :placeholder="t('audit.auditScheduleSurfaceTypeToSearchOrganizations')"
                        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <svg
                        v-if="orgSearchQuery"
                        @click="orgSearchQuery = ''; handleOrgSearch()"
                        class="absolute right-3 top-2.5 w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>

                  <!-- Search Results -->
                  <div v-if="orgSearchQuery && filteredOrganizations.length > 0" class="border border-gray-200 dark:border-gray-700 rounded-lg max-h-64 overflow-y-auto">
                    <ul class="divide-y divide-gray-200 dark:divide-gray-700">
                      <li
                        v-for="org in filteredOrganizations"
                        :key="org._id"
                        @click="toggleOrganization(org)"
                        :class="[
                          'px-4 py-3 cursor-pointer transition-colors',
                          isOrganizationSelected(org._id)
                            ? 'bg-indigo-50 dark:bg-indigo-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        ]"
                      >
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-3">
                            <div
                              v-if="isBeatAudit"
                              :class="[
                                'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                                isOrganizationSelected(org._id)
                                  ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500'
                                  : 'border-gray-300 dark:border-gray-600'
                              ]"
                            >
                              <svg
                                v-if="isOrganizationSelected(org._id)"
                                class="w-3 h-3 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fill-rule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clip-rule="evenodd"
                                />
                              </svg>
                            </div>
                            <div>
                              <p class="text-sm font-medium text-gray-900 dark:text-white">
                                {{ org.name }}
                              </p>
                              <p v-if="org.email" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {{ org.email }}
                              </p>
                            </div>
                          </div>
                          <button
                            v-if="isSingleOrgAudit && !isOrganizationSelected(org._id)"
                            type="button"
                            class="px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded"
                          >{{ t('settings.modFieldsWidgetSelect') }}</button>
                        </div>
                      </li>
                    </ul>
                  </div>

                  <!-- No Results -->
                  <div
                    v-if="orgSearchQuery && filteredOrganizations.length === 0 && !loadingOrganizations"
                    class="text-center py-8 text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    No organizations found matching "{{ orgSearchQuery }}"
                  </div>

                  <!-- Selected Organizations -->
                  <div v-if="selectedOrganizations.length > 0" class="space-y-2">
                    <div class="flex items-center justify-between">
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('audit.auditScheduleSurfaceSelectedOrganizations') }}<span class="ml-2 px-2 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded">
                          {{ selectedOrganizations.length }}
                          <span v-if="isBeatAudit"> (minimum 2)</span>
                        </span>
                      </label>
                    </div>
                    <div class="space-y-2">
                      <div
                        v-for="orgId in draft.targetOrganizations"
                        :key="orgId"
                        class="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg"
                      >
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                            <span class="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                              {{ getOrganizationInitials(orgId) }}
                            </span>
                          </div>
                          <div>
                            <p class="text-sm font-medium text-gray-900 dark:text-white">
                              {{ getOrganizationName(orgId) }}
                            </p>
                            <p v-if="!hasOrganizationAddress(orgId)" class="text-xs text-amber-700 dark:text-amber-300 mt-0.5">{{ t('audit.auditScheduleSurfaceAddressRequiredForAudits') }}</p>
                          </div>
                        </div>
                        <button
                          v-if="!isInternalAudit"
                          @click="removeOrganization(orgId)"
                          type="button"
                          class="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Empty State -->
                  <div
                    v-if="!orgSearchQuery && selectedOrganizations.length === 0"
                    class="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg"
                  >
                    <svg
                      class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <p class="mt-4 text-sm text-gray-500 dark:text-gray-400">{{ t('audit.auditScheduleSurfaceSearchForOrganizationsToSelect') }}</p>
                  </div>
                </div>
              </div>

              <!-- Step 3: Assign Roles -->
              <div v-else-if="currentStep === AuditScheduleStep.ASSIGN_ROLES" class="space-y-6">
                <!-- Helper Text -->
                <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p class="text-sm text-blue-800 dark:text-blue-300">
                    <strong>{{ t('audit.auditScheduleSurfaceRoleAssignmentsDetermineWhoConductsReviews') }}</strong>
                    <span v-if="requiresReviewer">{{ t('audit.auditScheduleSurfaceReviewerIsRequiredAndCannotBe') }}</span>
                    <span v-else-if="allowsSelfReview">{{ t('audit.auditScheduleSurfaceSelfReviewIsAllowedForInternal') }}</span>
                  </p>
                </div>

                <!-- Auditor Section -->
                <div class="space-y-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-900 dark:text-white mb-1">{{ t('audit.auditScheduleSurfaceAuditor') }}<span class="text-red-500">*</span>
                    </label>
                    <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">{{ t('audit.auditScheduleSurfaceTheUserWhoWillConductThe') }}</p>
                  </div>
                  
                  <!-- Auditor Search Input -->
                  <div class="relative">
                    <input
                      v-model="auditorSearchQuery"
                      @input="handleUserSearch('auditor')"
                      @focus="showAuditorDropdown = true"
                      type="text"
                      :placeholder="getSelectedUserDisplay(draft.auditorId, 'auditor') || 'Search for auditor...'"
                      :class="[
                        'w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                        auditorValidationError ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
                      ]"
                    />
                    <div v-if="draft.auditorId" class="absolute right-3 top-2.5">
                      <button
                        @click="clearRole('auditor')"
                        type="button"
                        class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <!-- Auditor Dropdown -->
                  <div
                    v-if="showAuditorDropdown && filteredAuditors.length > 0"
                    v-click-outside="() => showAuditorDropdown = false"
                    class="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg"
                  >
                    <ul class="py-1">
                      <li
                        v-for="user in filteredAuditors"
                        :key="user._id"
                        @click="selectRole('auditor', user._id)"
                        class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                            <span class="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                              {{ getUserInitials(user) }}
                            </span>
                          </div>
                          <div class="min-w-0 flex-1">
                            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {{ getUserDisplayName(user) }}
                            </p>
                            <p v-if="user.email" class="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {{ user.email }}
                            </p>
                          </div>
                        </div>
                      </li>
                    </ul>
                  </div>

                  <!-- Auditor Selected Display -->
                  <div v-if="draft.auditorId && getSelectedUser('auditor')" class="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                      <span class="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                        {{ getUserInitials(getSelectedUser('auditor')) }}
                      </span>
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ getUserDisplayName(getSelectedUser('auditor')) }}
                      </p>
                      <p v-if="getSelectedUser('auditor')?.email" class="text-xs text-gray-500 dark:text-gray-400">
                        {{ getSelectedUser('auditor')?.email }}
                      </p>
                    </div>
                  </div>

                  <!-- Auditor Validation Error -->
                  <p v-if="auditorValidationError" class="text-xs text-red-600 dark:text-red-400">
                    {{ auditorValidationError }}
                  </p>
                </div>

                <!-- Reviewer Section (Conditional) -->
                <div v-if="showReviewerSection" class="space-y-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-900 dark:text-white mb-1">{{ t('audit.auditScheduleSurfaceReviewer') }}<span v-if="requiresReviewer" class="text-red-500">*</span>
                      <span v-else class="text-gray-500 dark:text-gray-400">(Optional)</span>
                    </label>
                    <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">
                      <span v-if="requiresReviewer">{{ t('audit.auditScheduleSurfaceIndependentReviewerWhoCannotBeThe') }}</span>
                      <span v-else>{{ t('audit.auditScheduleSurfaceOptionalReviewerForInternalAuditsSelf') }}</span>
                    </p>
                  </div>

                  <!-- Reviewer Search Input -->
                  <div class="relative">
                    <input
                      v-model="reviewerSearchQuery"
                      @input="handleUserSearch('reviewer')"
                      @focus="showReviewerDropdown = true"
                      type="text"
                      :placeholder="getSelectedUserDisplay(draft.reviewerId, 'reviewer') || 'Search for reviewer...'"
                      :class="[
                        'w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                        reviewerValidationError ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
                      ]"
                    />
                    <div v-if="draft.reviewerId" class="absolute right-3 top-2.5">
                      <button
                        @click="clearRole('reviewer')"
                        type="button"
                        class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <!-- Reviewer Dropdown -->
                  <div
                    v-if="showReviewerDropdown && filteredReviewers.length > 0"
                    v-click-outside="() => showReviewerDropdown = false"
                    class="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg"
                  >
                    <ul class="py-1">
                      <li
                        v-for="user in filteredReviewers"
                        :key="user._id"
                        @click="selectRole('reviewer', user._id)"
                        class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                            <span class="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                              {{ getUserInitials(user) }}
                            </span>
                          </div>
                          <div class="min-w-0 flex-1">
                            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {{ getUserDisplayName(user) }}
                            </p>
                            <p v-if="user.email" class="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {{ user.email }}
                            </p>
                          </div>
                        </div>
                      </li>
                    </ul>
                  </div>

                  <!-- Reviewer Selected Display -->
                  <div v-if="draft.reviewerId && getSelectedUser('reviewer')" class="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                      <span class="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                        {{ getUserInitials(getSelectedUser('reviewer')) }}
                      </span>
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ getUserDisplayName(getSelectedUser('reviewer')) }}
                      </p>
                      <p v-if="getSelectedUser('reviewer')?.email" class="text-xs text-gray-500 dark:text-gray-400">
                        {{ getSelectedUser('reviewer')?.email }}
                      </p>
                    </div>
                  </div>

                  <!-- Reviewer Validation Error -->
                  <p v-if="reviewerValidationError" class="text-xs text-red-600 dark:text-red-400">
                    {{ reviewerValidationError }}
                  </p>
                </div>

                <!-- Corrective Owner Section -->
                <div class="space-y-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-900 dark:text-white mb-1">{{ t('audit.auditScheduleSurfaceCorrectiveOwner') }}<span class="text-red-500">*</span>
                    </label>
                    <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">{{ t('audit.auditScheduleSurfaceTheUserResponsibleForAddressingAudit') }}</p>
                  </div>

                  <!-- Corrective Owner Search Input -->
                  <div class="relative">
                    <input
                      v-model="correctiveOwnerSearchQuery"
                      @input="handleUserSearch('correctiveOwner')"
                      @focus="showCorrectiveOwnerDropdown = true"
                      type="text"
                      :placeholder="getSelectedUserDisplay(draft.correctiveOwnerId, 'correctiveOwner') || 'Search for corrective owner...'"
                      :class="[
                        'w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                        correctiveOwnerValidationError ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
                      ]"
                    />
                    <div v-if="draft.correctiveOwnerId" class="absolute right-3 top-2.5">
                      <button
                        @click="clearRole('correctiveOwner')"
                        type="button"
                        class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <!-- Corrective Owner Dropdown -->
                  <div
                    v-if="showCorrectiveOwnerDropdown && filteredCorrectiveOwners.length > 0"
                    v-click-outside="() => showCorrectiveOwnerDropdown = false"
                    class="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg"
                  >
                    <ul class="py-1">
                      <li
                        v-for="user in filteredCorrectiveOwners"
                        :key="user._id"
                        @click="selectRole('correctiveOwner', user._id)"
                        class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                            <span class="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                              {{ getUserInitials(user) }}
                            </span>
                          </div>
                          <div class="min-w-0 flex-1">
                            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {{ getUserDisplayName(user) }}
                            </p>
                            <p v-if="user.email" class="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {{ user.email }}
                            </p>
                          </div>
                        </div>
                      </li>
                    </ul>
                  </div>

                  <!-- Corrective Owner Selected Display -->
                  <div v-if="draft.correctiveOwnerId && getSelectedUser('correctiveOwner')" class="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                      <span class="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                        {{ getUserInitials(getSelectedUser('correctiveOwner')) }}
                      </span>
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ getUserDisplayName(getSelectedUser('correctiveOwner')) }}
                      </p>
                      <p v-if="getSelectedUser('correctiveOwner')?.email" class="text-xs text-gray-500 dark:text-gray-400">
                        {{ getSelectedUser('correctiveOwner')?.email }}
                      </p>
                    </div>
                  </div>

                  <!-- Corrective Owner Validation Error -->
                  <p v-if="correctiveOwnerValidationError" class="text-xs text-red-600 dark:text-red-400">
                    {{ correctiveOwnerValidationError }}
                  </p>
                </div>
              </div>

              <!-- Step 4: Schedule Time -->
              <div v-else-if="currentStep === AuditScheduleStep.SCHEDULE_TIME" class="space-y-6">
                <!-- Helper Text -->
                <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p class="text-sm text-blue-800 dark:text-blue-300">
                    <strong>{{ t('audit.auditScheduleSurfaceScheduleTheAuditStartAndEnd') }}</strong>{{ t('audit.auditScheduleSurfaceTimesAreInYourLocalTimezone') }}</p>
                </div>

                <!-- Date & Time Inputs -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <!-- Start Date & Time -->
                  <div class="space-y-2">
                    <label class="block text-sm font-medium text-gray-900 dark:text-white">
                      Start Date & Time <span class="text-red-500">*</span>
                    </label>
                    <p class="text-xs text-gray-600 dark:text-gray-400">{{ t('audit.auditScheduleSurfaceWhenTheAuditIsScheduledTo2') }}</p>
                    <DateTimePicker
                      v-model="startDateTimeLocal"
                      :min="minDateTime"
                      :invalid="Boolean(startDateTimeValidationError)"
                      input-class="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer border-gray-300 dark:border-gray-600"
                      @update:model-value="handleStartDateTimeChange"
                    />
                    <p v-if="startDateTimeValidationError" class="text-xs text-red-600 dark:text-red-400">
                      {{ startDateTimeValidationError }}
                    </p>
                  </div>

                  <!-- End Date & Time -->
                  <div class="space-y-2">
                    <label class="block text-sm font-medium text-gray-900 dark:text-white">
                      End Date & Time <span class="text-red-500">*</span>
                    </label>
                    <p class="text-xs text-gray-600 dark:text-gray-400">{{ t('audit.auditScheduleSurfaceWhenTheAuditIsScheduledTo') }}</p>
                    <DateTimePicker
                      v-model="endDateTimeLocal"
                      :min="minEndDateTime"
                      :invalid="Boolean(endDateTimeValidationError)"
                      input-class="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer border-gray-300 dark:border-gray-600"
                      @update:model-value="handleEndDateTimeChange"
                    />
                    <p v-if="endDateTimeValidationError" class="text-xs text-red-600 dark:text-red-400">
                      {{ endDateTimeValidationError }}
                    </p>
                  </div>
                </div>

                <!-- Duration Summary -->
                <div v-if="durationSummary" class="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div class="flex items-center gap-2">
                    <svg
                      class="w-5 h-5 text-indigo-600 dark:text-indigo-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        Duration: {{ durationSummary }}
                      </p>
                      <p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {{ formattedStartDateTime }} → {{ formattedEndDateTime }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Step 5: Link Form -->
              <div v-else-if="currentStep === AuditScheduleStep.LINK_FORM" class="space-y-6">
                <!-- Helper Text -->
                <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p class="text-sm text-blue-800 dark:text-blue-300">
                    <strong>{{ t('audit.auditScheduleSurfaceLinkAnAuditFormToThis') }}</strong>{{ t('audit.auditScheduleSurfaceTheFormWillBeExecutedDuring2') }}</p>
                </div>

                <!-- Form Search Input -->
                <div class="space-y-2">
                  <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('audit.auditScheduleSurfaceSearchForms') }}<span class="text-red-500">*</span>
                  </label>
                  <p class="text-xs text-gray-600 dark:text-gray-400">{{ t('audit.auditScheduleSurfaceSearchForAuditFormsOnlyReady') }}</p>
                  <div class="relative">
                    <input
                      v-model="formSearchQuery"
                      @input="handleFormSearch"
                      @focus="showFormDropdown = true"
                      type="text"
                      :placeholder="t('audit.auditScheduleSurfaceTypeToSearchForms')"
                      :class="[
                        'w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                        formValidationError ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
                      ]"
                    />
                    <div v-if="formSearchQuery && !selectedForm" class="absolute right-3 top-2.5">
                      <button
                        @click="formSearchQuery = ''; handleFormSearch()"
                        type="button"
                        class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <!-- Form Dropdown -->
                  <div
                    v-if="showFormDropdown && filteredForms.length > 0"
                    v-click-outside="() => showFormDropdown = false"
                    class="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg"
                  >
                    <ul class="py-1">
                      <li
                        v-for="form in filteredForms"
                        :key="form._id"
                        @click="selectForm(form)"
                        class="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                      >
                        <div class="flex items-start justify-between">
                          <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {{ form.name }}
                            </p>
                            <p v-if="form.description" class="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {{ form.description }}
                            </p>
                            <div class="flex items-center gap-2 mt-2">
                              <span
                                v-if="form.status"
                                class="text-xs px-2 py-0.5 rounded font-medium"
                                :class="{
                                  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300': form.status === 'Ready',
                                  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300': form.status === 'Active'
                                }"
                              >
                                {{ form.status }}
                              </span>
                              <span v-if="form.formType" class="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                                {{ form.formType }}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            class="ml-3 px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded"
                          >{{ t('settings.modFieldsWidgetSelect') }}</button>
                        </div>
                      </li>
                    </ul>
                  </div>

                  <!-- No Results -->
                  <div
                    v-if="formSearchQuery && filteredForms.length === 0 && !loadingForms"
                    class="text-center py-8 text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    No forms found matching "{{ formSearchQuery }}"
                  </div>

                  <!-- Validation Error -->
                  <p v-if="formValidationError" class="text-xs text-red-600 dark:text-red-400">
                    {{ formValidationError }}
                  </p>
                </div>

                <!-- Selected Form Preview -->
                <div v-if="selectedForm" class="space-y-4">
                  <div class="flex items-center justify-between">
                    <h3 class="text-sm font-medium text-gray-900 dark:text-white">{{ t('audit.auditScheduleSurfaceSelectedForm') }}</h3>
                    <button
                      v-if="!isFormConfirmed"
                      @click="clearForm"
                      type="button"
                      class="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    >{{ t('audit.auditScheduleSurfaceChangeForm') }}</button>
                  </div>

                  <!-- Form Details Card -->
                  <div class="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div class="flex items-start gap-4">
                      <div class="flex-shrink-0">
                        <div class="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                          <svg
                            class="w-6 h-6 text-indigo-600 dark:text-indigo-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                      </div>
                      <div class="flex-1 min-w-0">
                        <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-1">
                          {{ selectedForm.name }}
                        </h4>
                        <p v-if="selectedForm.description" class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {{ selectedForm.description }}
                        </p>
                        <div class="flex items-center gap-3 flex-wrap">
                          <span
                            v-if="selectedForm.status"
                            class="text-xs px-2 py-1 rounded font-medium"
                            :class="{
                              'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300': selectedForm.status === 'Ready',
                              'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300': selectedForm.status === 'Active'
                            }"
                          >
                            {{ selectedForm.status }}
                          </span>
                          <span v-if="selectedForm.formType" class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                            {{ selectedForm.formType }}
                          </span>
                          <span v-if="selectedForm.sections?.length" class="text-xs text-gray-500 dark:text-gray-400">
                            {{ selectedForm.sections.length }} section{{ selectedForm.sections.length !== 1 ? 's' : '' }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- What Happens After Linking -->
                  <div class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                    <div class="flex items-start gap-3">
                      <svg
                        class="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div>
                        <p class="text-sm font-medium text-indigo-900 dark:text-indigo-300 mb-1">{{ t('audit.auditScheduleSurfaceWhatHappensAfterLinking') }}</p>
                        <ul class="text-xs text-indigo-800 dark:text-indigo-400 space-y-1 list-disc list-inside">
                          <li>{{ t('audit.auditScheduleSurfaceTheFormWillBeExecutedDuring') }}</li>
                          <li v-if="selectedForm.status === 'Ready'">{{ t('audit.auditScheduleSurfaceReadyFormsWillAutomaticallyBecomeActive') }}</li>
                          <li>{{ t('audit.auditScheduleSurfaceOnceTheAuditIsScheduledThe') }}</li>
                          <li>{{ t('audit.auditScheduleSurfaceTheAuditorWillFillOutThis') }}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Empty State -->
                <div
                  v-if="!formSearchQuery && !selectedForm"
                  class="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg"
                >
                  <svg
                    class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p class="mt-4 text-sm text-gray-500 dark:text-gray-400">{{ t('audit.auditScheduleSurfaceSearchForAnAuditFormTo') }}</p>
                </div>
              </div>

              <!-- Step 6: Review & Schedule -->
              <div v-else-if="currentStep === AuditScheduleStep.REVIEW_CONFIRM" class="space-y-6">
                <!-- Helper Text -->
                <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p class="text-sm text-blue-800 dark:text-blue-300">
                    <strong>{{ t('audit.auditScheduleSurfaceReviewYourAuditConfigurationBeforeScheduling') }}</strong>{{ t('audit.auditScheduleSurfaceOnceScheduledTheseSettingsCannotBe') }}</p>
                </div>

                <!-- Review Summary -->
                <div class="space-y-4">
                  <!-- Title (system-generated by default) -->
                  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div class="flex items-start justify-between gap-4">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-2">
                          <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ t('settings.modFieldsActivityTitleLabel') }}</span>
                          <span
                            class="px-2 py-0.5 text-xs font-medium rounded"
                            :class="isTitleCustomized
                              ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'"
                          >
                            {{ isTitleCustomized ? 'Custom' : 'Generated' }}
                          </span>
                        </div>

                        <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">{{ t('audit.auditScheduleSurfaceAuditTitlesAreGeneratedAutomaticallyFor') }}</p>

                        <div class="space-y-2">
                          <input
                            v-model="titleValue"
                            type="text"
                            :readonly="!isTitleCustomized"
                            :class="[
                              'w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent',
                              !isTitleCustomized
                                ? 'cursor-not-allowed border-gray-200 dark:border-gray-700 focus:ring-gray-300 dark:focus:ring-gray-600'
                                : 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500',
                              titleValidationError ? 'border-red-300 dark:border-red-700' : ''
                            ]"
                          />
                          <p v-if="titleValidationError" class="text-xs text-red-600 dark:text-red-400">
                            {{ titleValidationError }}
                          </p>
                        </div>
                      </div>

                      <div class="flex flex-col items-end gap-2">
                        <button
                          type="button"
                          @click="toggleTitleCustomization"
                          class="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {{ isTitleCustomized ? 'Use generated title' : 'Customize title' }}
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Audit Type -->
                  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ t('audit.auditScheduleSurfaceAuditType') }}</span>
                          <span class="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">{{ t('audit.auditScheduleSurfaceImmutable5') }}</span>
                        </div>
                        <p class="text-base font-semibold text-gray-900 dark:text-white">
                          {{ draft.auditType }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Target Organizations -->
                  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2">
                          <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            {{ isBeatAudit ? 'Target Organizations' : 'Target Organization' }}
                          </span>
                          <span class="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">{{ t('audit.auditScheduleSurfaceImmutable4') }}</span>
                        </div>
                        <div class="space-y-2">
                          <p
                            v-for="orgId in draft.targetOrganizations"
                            :key="orgId"
                            class="text-base text-gray-900 dark:text-white"
                          >
                            {{ getOrganizationName(orgId) }}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Roles -->
                  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-3">
                          <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ t('audit.auditScheduleSurfaceRoles') }}</span>
                          <span class="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">{{ t('audit.auditScheduleSurfaceImmutable3') }}</span>
                        </div>
                        <div class="space-y-2">
                          <div v-if="draft.auditorId && getSelectedUser('auditor')" class="flex items-center gap-3">
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">{{ t('forms.hubResponseDetailAuditor') }}</span>
                            <span class="text-sm text-gray-900 dark:text-white">
                              {{ getUserDisplayName(getSelectedUser('auditor')) }}
                            </span>
                          </div>
                          <div v-if="draft.reviewerId && getSelectedUser('reviewer')" class="flex items-center gap-3">
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">{{ t('forms.hubResponseDetailReviewer') }}</span>
                            <span class="text-sm text-gray-900 dark:text-white">
                              {{ getUserDisplayName(getSelectedUser('reviewer')) }}
                            </span>
                          </div>
                          <div v-if="draft.correctiveOwnerId && getSelectedUser('correctiveOwner')" class="flex items-center gap-3">
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">{{ t('forms.hubResponseDetailCorrectiveOwner') }}</span>
                            <span class="text-sm text-gray-900 dark:text-white">
                              {{ getUserDisplayName(getSelectedUser('correctiveOwner')) }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Schedule -->
                  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-3">
                          <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ t('process.designerTriggerSchedule') }}</span>
                          <span class="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">{{ t('audit.auditScheduleSurfaceImmutable2') }}</span>
                        </div>
                        <div class="space-y-2">
                          <div class="flex items-center gap-3">
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">{{ t('audit.auditScheduleSurfaceStart') }}</span>
                            <span class="text-sm text-gray-900 dark:text-white">
                              {{ formattedStartDateTime }}
                            </span>
                          </div>
                          <div class="flex items-center gap-3">
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">{{ t('audit.auditScheduleSurfaceEnd') }}</span>
                            <span class="text-sm text-gray-900 dark:text-white">
                              {{ formattedEndDateTime }}
                            </span>
                          </div>
                          <div v-if="durationSummary" class="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">{{ t('process.execLogsDuration') }}</span>
                            <span class="text-sm text-gray-900 dark:text-white">
                              {{ durationSummary }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Form -->
                  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2">
                          <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ t('audit.auditScheduleSurfaceLinkedForm') }}</span>
                          <span class="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">{{ t('audit.auditScheduleSurfaceImmutable') }}</span>
                        </div>
                        <p v-if="selectedForm" class="text-base font-semibold text-gray-900 dark:text-white">
                          {{ selectedForm.name }}
                        </p>
                        <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('audit.auditScheduleSurfaceNoFormSelected') }}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Error Message -->
                <div v-if="scheduleError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div class="flex items-start gap-3">
                    <svg
                      class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div class="flex-1">
                      <p class="text-sm font-medium text-red-800 dark:text-red-300">{{ t('audit.auditScheduleSurfaceUnableToScheduleAudit') }}</p>
                      <p class="text-sm text-red-700 dark:text-red-400 mt-1">
                        {{ scheduleError }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Step Content Placeholder for other steps -->
              <div
                v-else
                class="bg-gray-50 dark:bg-gray-900/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 p-12 text-center"
              >
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ currentStepDefinition.label }} content will be implemented here.
                </p>
              </div>
            </div>

            <!-- Navigation Actions -->
            <div class="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                @click="prevStep"
                :disabled="currentStepIndex === 0"
                :class="[
                  'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  currentStepIndex === 0
                    ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                ]"
              >{{ t('actions.previous') }}</button>

              <div class="flex items-center gap-3">
                <span class="text-xs text-gray-500 dark:text-gray-400">
                  Step {{ currentStepIndex + 1 }} of {{ stepDefinitions.length }}
                </span>
                <button
                  @click="nextStep"
                  :disabled="!canProceedToNext || (isLastStep && scheduling)"
                  :class="[
                    'px-6 py-2 text-sm font-medium rounded-lg transition-colors',
                    canProceedToNext && !(isLastStep && scheduling)
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  ]"
                >
                  <span v-if="isLastStep && scheduling" class="flex items-center gap-2">
                    <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>{{ t('audit.auditScheduleSurfaceScheduling') }}</span>
                  <span v-else>
                    {{ isLastStep ? 'Schedule Audit' : 'Next' }}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
/**
 * ============================================================================
 * Audit Schedule Surface
 * ============================================================================
 * 
 * ARCHITECTURE NOTE: This surface is the ONLY way to create audit events.
 * 
 * This surface instantiates audit workflows by creating properly configured
 * audit event instances with all required configuration:
 * - Role assignments (Auditor, Reviewer conditional, Corrective Owner)
 * - Form linking (required audit form)
 * - Geo requirements (always enforced for audit events)
 * - Target organization(s) (single or multi-org beat)
 * - Scheduling (start and end date/time)
 * - Workflow initialization (initial audit state)
 * 
 * Entry Points:
 * - Audit App → "Schedule Audit" → /audit/schedule
 * - Organization Surface → "Schedule Audit" → /audit/schedule (with org context)
 * - Command Palette → "Schedule Audit" → /audit/schedule
 * 
 * All entry points route to this unified surface.
 * 
 * Explicitly NOT for:
 * - Audit execution (belongs in EventExecution components)
 * - Audit responses or approvals (belongs in Audit Work interfaces)
 * - Check-in/check-out (belongs in Work interfaces)
 * - Calendar views (belongs in Calendar components)
 * - Editing live events (audit events are immutable after scheduling)
 * 
 * Validation Rules:
 * - Role requirements per audit type (see event-settings.md)
 * - Geo enforcement (always true, immutable)
 * - Form requirements (required for all audit events)
 * - Self-review constraints (Internal Audit only)
 * - Immutable constraints after scheduling
 * 
 * UX Rules:
 * - Guided, step-based flow (not a raw form)
 * - Clear explanations for required roles
 * - Warnings for irreversible choices
 * - Calm, compliance-grade tone
 * - No "advanced" toggles
 * 
 * See: docs/architecture/audit-scheduling-surface.md
 * ============================================================================
 */

import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AuditScheduleStep } from '@/types/auditSchedule.types';
import type { AuditScheduleDraft, AuditScheduleValidationResult } from '@/types/auditSchedule.types';
import { getAuditEventTypes, getEventTypeByLabel } from '@/metadata/eventTypes';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import DateTimePicker from '@/components/common/DateTimePicker.vue';
import { formatUserDateTime } from '@/utils/localeFormat';
import clickOutside from '@/directives/clickOutside';

type OrganizationLite = {
  _id: string;
  name?: string;
  email?: string;
  address?: string;
};

type UserLite = {
  _id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
};

type AuditFormLite = {
  _id: string;
  name?: string;
  description?: string;
  status?: string;
  formType?: string;
  sections?: unknown[];
};

interface AuditEventPayload {
  eventType: string;
  auditorId: string | null;
  correctiveOwnerId: string | null;
  startDateTime: string | null;
  endDateTime: string | null;
  linkedFormId: string | null;
  geoRequired: true;
  eventName?: string;
  reviewerId?: string | null;
  orgList?: Array<{ organizationId: string; sequence: number }>;
  relatedToId?: string;
}

interface AuditApiError {
  message?: string;
  response?: {
    data?: {
      message?: string;
      error?: string;
    };
  };
}

type StepDefinition = {
  step: AuditScheduleStep;
  label: string;
  description: string;
};

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// ARCHITECTURE NOTE: Guided, step-based flow (not a raw form).
// 
// Why guided steps:
// - Audit scheduling requires careful configuration
// - Each step focuses on one aspect (type, organization, roles, time, form, review)
// - Step validation ensures all required fields are completed correctly
// - Reduces errors and improves compliance
// 
// Steps are sequential and cannot be skipped until validated.
// This ensures audit events are created with complete, correct configuration.
// 
// See: docs/architecture/audit-scheduling-surface.md Section 6.1 (Guided, Step-Based Flow)

// Step definitions with labels and descriptions
const stepDefinitions: StepDefinition[] = [
  {
    step: AuditScheduleStep.SELECT_TYPE,
    label: 'Audit Type',
    description: 'Choose the type of audit to schedule'
  },
  {
    step: AuditScheduleStep.SELECT_TARGET,
    label: 'Target Organization(s)',
    description: 'Select the organization(s) to audit'
  },
  {
    step: AuditScheduleStep.ASSIGN_ROLES,
    label: 'Assign Roles',
    description: 'Assign Auditor, Reviewer, and Corrective Owner'
  },
  {
    step: AuditScheduleStep.SCHEDULE_TIME,
    label: 'Schedule Time',
    description: 'Set start and end date/time'
  },
  {
    step: AuditScheduleStep.LINK_FORM,
    label: 'Link Form',
    description: 'Select the audit form to use'
  },
  {
    step: AuditScheduleStep.REVIEW_CONFIRM,
    label: 'Review & Schedule',
    description: 'Review configuration and confirm scheduling'
  }
];

// Current step state
const currentStep = ref<AuditScheduleStep>(AuditScheduleStep.SELECT_TYPE);

// Draft state (temporary, not persisted)
const draft = ref<AuditScheduleDraft>({
  auditType: null,
  targetOrganizations: [],
  auditorId: null,
  reviewerId: null,
  correctiveOwnerId: null,
  startDateTime: null,
  endDateTime: null,
  linkedFormId: null
});

// Get audit event types for selection
const auditEventTypes = computed(() => {
  return getAuditEventTypes();
});

// Computed: Determine audit type characteristics
const isInternalAudit = computed(() => {
  return draft.value.auditType === 'Internal Audit';
});

const isSingleOrgAudit = computed(() => {
  return draft.value.auditType === 'Internal Audit' || draft.value.auditType === 'External Audit — Single Org';
});

const isBeatAudit = computed(() => {
  return draft.value.auditType === 'External Audit Beat';
});

// User's organization (for Internal Audit)
const userOrganization = computed(() => {
  return authStore.organization;
});

// Organization search and selection state
const orgSearchQuery = ref('');
const organizations = ref<OrganizationLite[]>([]);
const loadingOrganizations = ref(false);
let orgSearchDebounce: ReturnType<typeof setTimeout> | null = null;

// Filtered organizations based on search
const filteredOrganizations = computed(() => {
  if (!orgSearchQuery.value.trim()) {
    return [];
  }
  const query = orgSearchQuery.value.trim().toLowerCase();
  return organizations.value.filter(org => {
    const name = (org.name || '').toLowerCase();
    const email = (org.email || '').toLowerCase();
    return name.includes(query) || email.includes(query);
  }).filter(org => {
    // Exclude already selected organizations
    return !draft.value.targetOrganizations.includes(org._id);
  });
});

// Selected organizations (full objects)
const selectedOrganizations = computed(() => {
  return organizations.value.filter(org => draft.value.targetOrganizations.includes(org._id));
});


// ============================================================================
// Audit Scheduling Prerequisite: Organization Address (UX-safe)
// ============================================================================
// ARCHITECTURE NOTE:
// - Audit scheduling requires a human-readable organization address.
// - Precise location enforcement happens at execution time via GEO check-in.
// - We must NOT introduce lat/lng, maps, or GEO fields at scheduling time.
// - We must NOT add free-text location fields to audit events here.
// - This is prerequisite completion (address), not full Organization editing.
//
// Non-goals (explicitly out of scope):
// - No lat/lng fields
// - No map picker
// - No GEO radius or accuracy
// - No full Organization edit form
const isBlankString = (value: unknown): boolean => {
  return value == null || (typeof value === 'string' && value.trim().length === 0);
};

function scheduleRefId(id: unknown): string | null {
  if (id == null || id === '') return null;
  if (typeof id === 'string') return id;
  if (typeof id === 'number' || typeof id === 'boolean') return String(id);
  if (typeof id === 'object') {
    const record = id as { _id?: unknown; id?: unknown; toString?: () => string };
    const nested = record._id ?? record.id;
    if (nested != null && nested !== '') return String(nested);
    if (typeof record.toString === 'function') return String(record.toString());
  }
  return String(id);
}

const getOrganizationById = (orgId: string): OrganizationLite | { _id?: string; name?: string; address?: string } | null => {
  if (!orgId) return null;

  const normalizeId = scheduleRefId;

  const target = normalizeId(orgId);

  if (Array.isArray(organizations.value)) {
    const found = organizations.value.find(o => normalizeId(o?._id) === target);
    if (found) return found;
  }

  // Fallback: Internal Audit targets the tenant org (auth store org)
  if (normalizeId(userOrganization.value?._id) === target) {
    return userOrganization.value;
  }

  return null;
};

const hasOrganizationAddress = (orgId: string): boolean => {
  const org = getOrganizationById(orgId);
  return !isBlankString(org?.address);
};

const missingAddressOrganizationIds = computed(() => {
  const ids = draft.value.targetOrganizations || [];
  return ids.filter((orgId) => !hasOrganizationAddress(orgId));
});

const missingAddressOrganizationNames = computed(() => {
  return missingAddressOrganizationIds.value
    .map((id) => getOrganizationName(id))
    .filter(Boolean);
});

const isAuditAddressBlocking = computed(() => {
  return missingAddressOrganizationIds.value.length > 0;
});

// Inline “Add address” editor (address-only, no navigation away)
const showAddressEditor = ref(false);
const addressEditorOrgId = ref<string | null>(null);
const addressDraft = ref('');
const savingAddress = ref(false);
const addressSaveError = ref<string | null>(null);

const openAddressEditorForOrg = (orgId: string) => {
  addressEditorOrgId.value = orgId;
  const org = getOrganizationById(orgId);
  addressDraft.value = (org?.address || '').toString();
  addressSaveError.value = null;
  showAddressEditor.value = true;
};

const openAddressEditorForNextMissing = () => {
  const nextId = missingAddressOrganizationIds.value[0];
  if (!nextId) return;
  openAddressEditorForOrg(nextId);
};

const closeAddressEditor = () => {
  showAddressEditor.value = false;
  addressEditorOrgId.value = null;
  addressDraft.value = '';
  addressSaveError.value = null;
};

const cancelScheduling = () => {
  // UX RULE: Do not redirect user into Organization Settings / full edit forms.
  // Cancel returns the user to the Audit app without losing other state via navigation.
  router.push('/audit/audits');
};

const saveAddress = async () => {
  if (!addressEditorOrgId.value) return;
  const orgId = addressEditorOrgId.value;

  const trimmed = addressDraft.value.trim();
  if (!trimmed) {
    addressSaveError.value = 'Address is required.';
    return;
  }

  savingAddress.value = true;
  addressSaveError.value = null;

  try {
    // Persist the address on the Organization model (address-only).
    // IMPORTANT: This is an Audit scheduling prerequisite, not full org editing.
    // We use an audit-scoped endpoint so audit-only users can complete it without Sales context.
    const response = await apiClient.put(`/audit/organizations/${orgId}/address`, { address: trimmed });
    if (!response?.success) {
      addressSaveError.value = response?.message || 'Unable to save address. Please try again.';
      return;
    }

    // Update local cache so gating unblocks immediately.
    if (Array.isArray(organizations.value)) {
      const idx = organizations.value.findIndex(o => o?._id === orgId);
      if (idx >= 0) {
        const existingOrganization = organizations.value[idx];
        if (existingOrganization) {
          organizations.value[idx] = { ...existingOrganization, address: trimmed };
        }
      }
    }

    // Keep auth store org in sync for Internal Audit gating.
    if (authStore.organization?._id === orgId) {
      authStore.organization.address = trimmed;
    }

    closeAddressEditor();
    // Automatically resume scheduling by removing the blocking prerequisite.
  } catch (error: unknown) {
    console.error('[AuditScheduleSurface] Error saving address:', error);
    const apiError = error as AuditApiError;
    addressSaveError.value =
      apiError.response?.data?.message ||
      apiError.message ||
      'Unable to save address. Please try again.';
  } finally {
    savingAddress.value = false;
  }
};

// Fetch organizations from API
const fetchOrganizations = async () => {
  loadingOrganizations.value = true;
  try {
    // ARCHITECTURE NOTE:
    // Audit scheduling must remain inside the Audit app context.
    // Use audit-scoped org list endpoint (read-only, lightweight, includes address)
    // rather than Sales-only organization routes.
    const response = await apiClient.get('/audit/organizations');
    if (response.success) {
      // Handle both array and single object responses
      const orgs = Array.isArray(response.data) ? response.data : (response.data ? [response.data] : []);
      organizations.value = orgs;
      
      // ARCHITECTURE NOTE: For Internal Audit, automatically set user's organization
      // This enforces the architectural constraint that Internal Audits target
      // the requester's organization only.
      if (isInternalAudit.value && userOrganization.value?._id) {
        if (!draft.value.targetOrganizations.includes(userOrganization.value._id)) {
          draft.value.targetOrganizations = [userOrganization.value._id];
        }
      }
    } else {
      organizations.value = [];
    }
  } catch (error) {
    console.error('Error fetching organizations:', error);
    organizations.value = [];
  } finally {
    loadingOrganizations.value = false;
  }
};

// Handle organization search
const handleOrgSearch = () => {
  if (orgSearchDebounce) clearTimeout(orgSearchDebounce);
  orgSearchDebounce = setTimeout(() => {
    // Search is handled by filteredOrganizations computed property
    // This debounce is for future API-based search if needed
  }, 250);
};

// Check if organization is selected
const isOrganizationSelected = (orgId: string): boolean => {
  return draft.value.targetOrganizations.includes(orgId);
};

// Toggle organization selection
const toggleOrganization = (org: OrganizationLite) => {
  const orgId = org._id;
  
  if (isSingleOrgAudit.value) {
    // Single org: replace selection
    draft.value.targetOrganizations = [orgId];
    // Clear search after selection
    orgSearchQuery.value = '';
  } else if (isBeatAudit.value) {
    // Beat audit: toggle selection
    const index = draft.value.targetOrganizations.indexOf(orgId);
    if (index > -1) {
      draft.value.targetOrganizations.splice(index, 1);
    } else {
      draft.value.targetOrganizations.push(orgId);
    }
  }
};

// Remove organization from selection
const removeOrganization = (orgId: string) => {
  const index = draft.value.targetOrganizations.indexOf(orgId);
  if (index > -1) {
    draft.value.targetOrganizations.splice(index, 1);
  }
};

// Get organization name by ID
const getOrganizationName = (orgId: string): string => {
  if (!orgId) return 'Unknown Organization';
  
  // Normalize ID for comparison (handle both string and ObjectId)
  const normalizeId = (id: unknown): string => {
    if (id == null || id === '') return '';
    if (typeof id === 'string') return id;
    if (typeof id === 'object' && 'toString' in id && typeof id.toString === 'function') return String(id.toString());
    return String(id);
  };
  
  const normalizedOrgId = normalizeId(orgId);
  
  // First, try to find in organizations array
  if (Array.isArray(organizations.value)) {
    const org = organizations.value.find(o => {
      const orgIdNormalized = normalizeId(o._id);
      return orgIdNormalized === normalizedOrgId;
    });
    if (org?.name) return org.name;
  }
  
  // Fallback: try to find in selectedOrganizations (which filters organizations.value)
  if (Array.isArray(selectedOrganizations.value)) {
    const org = selectedOrganizations.value.find(o => {
      const orgIdNormalized = normalizeId(o._id);
      return orgIdNormalized === normalizedOrgId;
    });
    if (org?.name) return org.name;
  }
  
  // Last resort: check if it's the user's organization
  if (userOrganization.value?._id) {
    const userOrgIdNormalized = normalizeId(userOrganization.value._id);
    if (userOrgIdNormalized === normalizedOrgId) {
      return userOrganization.value.name || 'Your Organization';
    }
  }
  
  return 'Unknown Organization';
};

// Get organization initials for avatar
const getOrganizationInitials = (orgId: string): string => {
  if (!Array.isArray(organizations.value) || !orgId) return '?';
  const org = organizations.value.find(o => o._id === orgId);
  if (!org?.name) return '?';
  const words = org.name.split(' ').filter(Boolean);
  if (words.length >= 2) {
    return ((words[0]?.[0] || '') + (words[1]?.[0] || '')).toUpperCase();
  }
  return org.name.substring(0, 2).toUpperCase();
};

// Watch for audit type changes to handle Internal Audit auto-selection
watch(() => draft.value.auditType, (newType) => {
  if (newType === 'Internal Audit' && userOrganization.value?._id) {
    // Auto-select user's organization for Internal Audit
    draft.value.targetOrganizations = [userOrganization.value._id];
  } else if (newType !== 'Internal Audit') {
    // Clear selection when switching away from Internal Audit
    // (user will need to select manually)
    if (draft.value.targetOrganizations.length > 0 && 
        draft.value.targetOrganizations[0] === userOrganization.value?._id) {
      draft.value.targetOrganizations = [];
    }
  }
  
  // Clear reviewer when switching to Beat audit (reviewer not required)
  if (newType === 'External Audit Beat' && draft.value.reviewerId) {
    draft.value.reviewerId = null;
  }
});

// User search and selection state
const users = ref<UserLite[]>([]);
const loadingUsers = ref(false);
const auditorSearchQuery = ref('');
const reviewerSearchQuery = ref('');
const correctiveOwnerSearchQuery = ref('');
const showAuditorDropdown = ref(false);
const showReviewerDropdown = ref(false);
const showCorrectiveOwnerDropdown = ref(false);
let userSearchDebounce: ReturnType<typeof setTimeout> | null = null;

// Computed: Reviewer section visibility and requirements
const showReviewerSection = computed(() => {
  // ARCHITECTURE NOTE: Reviewer is shown for:
  // - External Audit — Single Org (required)
  // - Internal Audit (optional, self-review allowed)
  // Reviewer is NOT shown for External Audit Beat (not required)
  return draft.value.auditType === 'External Audit — Single Org' || 
         draft.value.auditType === 'Internal Audit';
});

const requiresReviewer = computed(() => {
  // ARCHITECTURE NOTE: Reviewer is required only for External Audit — Single Org
  return draft.value.auditType === 'External Audit — Single Org';
});

const allowsSelfReview = computed(() => {
  // ARCHITECTURE NOTE: Self-review is allowed only for Internal Audit
  return draft.value.auditType === 'Internal Audit';
});

// Filtered users for each role (excluding already selected users where appropriate)
const filteredAuditors = computed(() => {
  if (!auditorSearchQuery.value.trim()) return [];
  const query = auditorSearchQuery.value.trim().toLowerCase();
  return users.value.filter(user => {
    const name = getUserDisplayName(user).toLowerCase();
    const email = (user.email || '').toLowerCase();
    return name.includes(query) || email.includes(query);
  });
});

const filteredReviewers = computed(() => {
  if (!reviewerSearchQuery.value.trim()) return [];
  const query = reviewerSearchQuery.value.trim().toLowerCase();
  return users.value.filter(user => {
    // ARCHITECTURE NOTE: For External Audit — Single Org, reviewer cannot be same as auditor
    if (requiresReviewer.value && draft.value.auditorId && user._id === draft.value.auditorId) {
      return false;
    }
    const name = getUserDisplayName(user).toLowerCase();
    const email = (user.email || '').toLowerCase();
    return name.includes(query) || email.includes(query);
  });
});

const filteredCorrectiveOwners = computed(() => {
  if (!correctiveOwnerSearchQuery.value.trim()) return [];
  const query = correctiveOwnerSearchQuery.value.trim().toLowerCase();
  return users.value.filter(user => {
    const name = getUserDisplayName(user).toLowerCase();
    const email = (user.email || '').toLowerCase();
    return name.includes(query) || email.includes(query);
  });
});

// Validation errors (inline, no toast)
const auditorValidationError = computed(() => {
  if (!draft.value.auditorId) {
    return 'Auditor is required for all audit types.';
  }
  return null;
});

const reviewerValidationError = computed(() => {
  if (requiresReviewer.value && !draft.value.reviewerId) {
    return 'Reviewer is required for External Audit — Single Org.';
  }
  if (draft.value.reviewerId && draft.value.auditorId && 
      draft.value.reviewerId === draft.value.auditorId && 
      !allowsSelfReview.value) {
    return 'Reviewer cannot be the same as the auditor for external audits.';
  }
  return null;
});

const correctiveOwnerValidationError = computed(() => {
  if (!draft.value.correctiveOwnerId) {
    return 'Corrective Owner is required for all audit types.';
  }
  return null;
});

// Fetch users from API
const fetchUsers = async () => {
  loadingUsers.value = true;
  try {
    const response = await apiClient.get('/users/list');
    if (response.success && Array.isArray(response.data)) {
      users.value = response.data;
    } else {
      users.value = [];
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    users.value = [];
  } finally {
    loadingUsers.value = false;
  }
};

// Handle user search
const handleUserSearch = (role: string) => {
  if (userSearchDebounce) clearTimeout(userSearchDebounce);
  userSearchDebounce = setTimeout(() => {
    // Search is handled by computed properties
  }, 250);
};

// Get user display name
const getUserDisplayName = (user: UserLite | null | undefined): string => {
  if (!user) return '';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.username || user.email || user._id || 'Unknown User';
};

// Get user initials for avatar
const getUserInitials = (user: UserLite | null | undefined): string => {
  if (!user) return '?';
  const name = getUserDisplayName(user);
  const words = name.split(' ').filter(Boolean);
  if (words.length >= 2) {
    return ((words[0]?.[0] || '') + (words[1]?.[0] || '')).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Get selected user object
const getSelectedUser = (role: string): UserLite | null => {
  let userId: string | null = null;
  if (role === 'auditor') userId = draft.value.auditorId;
  else if (role === 'reviewer') userId = draft.value.reviewerId;
  else if (role === 'correctiveOwner') userId = draft.value.correctiveOwnerId;
  
  if (!userId || !Array.isArray(users.value)) return null;
  return users.value.find(u => u._id === userId) || null;
};

// Get selected user display text
const getSelectedUserDisplay = (userId: string | null, role: string): string => {
  if (!userId) return '';
  const user = getSelectedUser(role);
  return user ? getUserDisplayName(user) : '';
};

// Select role
const selectRole = (role: string, userId: string) => {
  // ARCHITECTURE NOTE: Enforce self-review constraints
  if (role === 'reviewer' && requiresReviewer.value && userId === draft.value.auditorId) {
    // This should be prevented by filteredReviewers, but double-check
    return;
  }
  
  if (role === 'auditor') {
    draft.value.auditorId = userId;
    showAuditorDropdown.value = false;
    auditorSearchQuery.value = '';
    
    // ARCHITECTURE NOTE: If reviewer is same as auditor and self-review not allowed, clear reviewer
    if (draft.value.reviewerId === userId && !allowsSelfReview.value) {
      draft.value.reviewerId = null;
    }
  } else if (role === 'reviewer') {
    draft.value.reviewerId = userId;
    showReviewerDropdown.value = false;
    reviewerSearchQuery.value = '';
  } else if (role === 'correctiveOwner') {
    draft.value.correctiveOwnerId = userId;
    showCorrectiveOwnerDropdown.value = false;
    correctiveOwnerSearchQuery.value = '';
  }
};

// Clear role
const clearRole = (role: string) => {
  if (role === 'auditor') {
    draft.value.auditorId = null;
    auditorSearchQuery.value = '';
  } else if (role === 'reviewer') {
    draft.value.reviewerId = null;
    reviewerSearchQuery.value = '';
  } else if (role === 'correctiveOwner') {
    draft.value.correctiveOwnerId = null;
    correctiveOwnerSearchQuery.value = '';
  }
};

const vClickOutside = clickOutside;

// Watch for step changes to fetch users and organizations
watch(() => currentStep.value, (step) => {
  if (step === AuditScheduleStep.ASSIGN_ROLES && users.value.length === 0) {
    fetchUsers();
  }
  
  // ARCHITECTURE NOTE: Ensure organizations are loaded for review step
  if (step === AuditScheduleStep.REVIEW_CONFIRM) {
    // Always fetch to ensure we have the latest data, even if array has items
    // This handles cases where organizations might have been cleared or IDs don't match
    fetchOrganizations();
    if (users.value.length === 0) {
      fetchUsers();
    }
    if (forms.value.length === 0) {
      fetchForms();
    }
  }
  
  // Close dropdowns when leaving step
  if (step !== AuditScheduleStep.ASSIGN_ROLES) {
    showAuditorDropdown.value = false;
    showReviewerDropdown.value = false;
    showCorrectiveOwnerDropdown.value = false;
  }
});

// Fetch initial data when component mounts
onMounted(() => {
  // Load data based on current step
  if (currentStep.value === AuditScheduleStep.SELECT_TARGET && organizations.value.length === 0) {
    fetchOrganizations();
  }
  if (currentStep.value === AuditScheduleStep.ASSIGN_ROLES && users.value.length === 0) {
    fetchUsers();
  }
  if (currentStep.value === AuditScheduleStep.LINK_FORM && forms.value.length === 0) {
    fetchForms();
  }
  if (currentStep.value === AuditScheduleStep.REVIEW_CONFIRM) {
    // Ensure all data is loaded for review
    if (organizations.value.length === 0) fetchOrganizations();
    if (users.value.length === 0) fetchUsers();
    if (forms.value.length === 0) fetchForms();
  }
});

// ============================================================================
// Step 4: Schedule Time
// ============================================================================

// Local datetime strings for datetime-local inputs (YYYY-MM-DDTHH:mm format)
const startDateTimeLocal = ref('');
const endDateTimeLocal = ref('');

// Get minimum datetime (now) for preventing past dates
const minDateTime = computed(() => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes().toString().padStart(2, '0'));
  return `${year}-${month}-${day}T${hours}:${minutes}`;
});

// Minimum end datetime (must be after start datetime)
const minEndDateTime = computed(() => {
  if (!startDateTimeLocal.value) return minDateTime.value;
  // End must be at least 1 minute after start
  const startDate = new Date(startDateTimeLocal.value);
  const minEnd = new Date(startDate.getTime() + 60000); // Add 1 minute
  const year = minEnd.getFullYear();
  const month = String(minEnd.getMonth() + 1).padStart(2, '0');
  const day = String(minEnd.getDate()).padStart(2, '0');
  const hours = String(minEnd.getHours()).padStart(2, '0');
  const minutes = String(minEnd.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
});

// Convert datetime-local string to ISO string for draft
const convertToISO = (localDateTime: string): string | null => {
  if (!localDateTime) return null;
  // datetime-local format is YYYY-MM-DDTHH:mm (no timezone)
  // Convert to ISO string (assumes local timezone)
  const date = new Date(localDateTime);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
};

// Convert ISO string to datetime-local string
const convertFromISO = (isoString: string | null): string => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
};

// Handle start datetime change
const handleStartDateTimeChange = () => {
  draft.value.startDateTime = convertToISO(startDateTimeLocal.value);
  
  // ARCHITECTURE NOTE: If end datetime is before new start datetime, clear it
  if (draft.value.endDateTime && draft.value.startDateTime) {
    const endDate = new Date(draft.value.endDateTime);
    const startDate = new Date(draft.value.startDateTime);
    if (endDate <= startDate) {
      draft.value.endDateTime = null;
      endDateTimeLocal.value = '';
    }
  }
};

// Handle end datetime change
const handleEndDateTimeChange = () => {
  draft.value.endDateTime = convertToISO(endDateTimeLocal.value);
};

// Validation errors (inline, no toast)
const startDateTimeValidationError = computed(() => {
  if (!startDateTimeLocal.value) {
    return 'Start date and time are required.';
  }
  
  const startDate = new Date(startDateTimeLocal.value);
  const now = new Date();
  
  // Check if start is in the past
  if (startDate < now) {
    return 'Start date and time cannot be in the past.';
  }
  
  return null;
});

const endDateTimeValidationError = computed(() => {
  if (!endDateTimeLocal.value) {
    return 'End date and time are required.';
  }
  
  if (!startDateTimeLocal.value) {
    return 'Please set start date and time first.';
  }
  
  const startDate = new Date(startDateTimeLocal.value);
  const endDate = new Date(endDateTimeLocal.value);
  
  // Check if end is before start
  if (endDate <= startDate) {
    return 'End date and time must be after start date and time.';
  }
  
  return null;
});

// Duration summary
const durationSummary = computed(() => {
  if (!draft.value.startDateTime || !draft.value.endDateTime) {
    return null;
  }
  
  try {
    const start = new Date(draft.value.startDateTime);
    const end = new Date(draft.value.endDateTime);
    const diffMs = end.getTime() - start.getTime();
    
    if (diffMs <= 0) return null;
    
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      const remainingHours = diffHours % 24;
      if (remainingHours > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''}, ${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
      }
      return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      const remainingMinutes = diffMinutes % 60;
      if (remainingMinutes > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''}, ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
      }
      return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    } else {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
    }
  } catch {
    return null;
  }
});

// Formatted datetime strings for display
const formattedStartDateTime = computed(() => {
  if (!draft.value.startDateTime) return '';
  try {
    const date = new Date(draft.value.startDateTime);
    return formatUserDateTime(date);
  } catch {
    return '';
  }
});

const formattedEndDateTime = computed(() => {
  if (!draft.value.endDateTime) return '';
  try {
    const date = new Date(draft.value.endDateTime);
    return formatUserDateTime(date);
  } catch {
    return '';
  }
});

// Watch for step changes to initialize datetime values
watch(() => currentStep.value, (step) => {
  if (step === AuditScheduleStep.SCHEDULE_TIME) {
    // Initialize local datetime strings from draft ISO strings
    startDateTimeLocal.value = convertFromISO(draft.value.startDateTime);
    endDateTimeLocal.value = convertFromISO(draft.value.endDateTime);
  }
});

// Watch draft changes to sync local datetime strings
watch(() => draft.value.startDateTime, (newValue) => {
  if (currentStep.value === AuditScheduleStep.SCHEDULE_TIME) {
    startDateTimeLocal.value = convertFromISO(newValue);
  }
});

watch(() => draft.value.endDateTime, (newValue) => {
  if (currentStep.value === AuditScheduleStep.SCHEDULE_TIME) {
    endDateTimeLocal.value = convertFromISO(newValue);
  }
});

// ============================================================================
// Step 5: Link Form
// ============================================================================

// Form search and selection state
const forms = ref<AuditFormLite[]>([]);
const loadingForms = ref(false);
const formSearchQuery = ref('');
const showFormDropdown = ref(false);
let formSearchDebounce: ReturnType<typeof setTimeout> | null = null;

// Selected form
const selectedForm = computed<AuditFormLite | null>(() => {
  if (!draft.value.linkedFormId || !Array.isArray(forms.value)) return null;
  return forms.value.find(f => f._id === draft.value.linkedFormId) || null;
});

// Form is confirmed (cannot be changed after review step)
const isFormConfirmed = computed(() => {
  // ARCHITECTURE NOTE: Once we reach REVIEW_CONFIRM step, form cannot be changed
  return currentStep.value === AuditScheduleStep.REVIEW_CONFIRM;
});

// Filtered forms based on search
const filteredForms = computed(() => {
  if (!formSearchQuery.value.trim()) {
    return [];
  }
  const query = formSearchQuery.value.trim().toLowerCase();
  return forms.value.filter(form => {
    const name = (form.name || '').toLowerCase();
    const description = (form.description || '').toLowerCase();
    return name.includes(query) || description.includes(query);
  });
});

// Validation error
const formValidationError = computed(() => {
  if (!draft.value.linkedFormId) {
    return 'An audit form is required for all audit events.';
  }
  return null;
});

// Fetch audit forms from API
const fetchForms = async () => {
  loadingForms.value = true;
  try {
    // ARCHITECTURE NOTE: Fetch Ready and Active audit forms only
    // Ready forms become Active when linked to an event
    const response = await apiClient.get('/forms', { params: { limit: 100 } });
    if (response.success) {
      const allForms: AuditFormLite[] = Array.isArray(response.data) ? response.data : [];
      
      // Filter to show only Ready and Active forms
      const readyAndActiveForms = allForms.filter((form: AuditFormLite) => 
        form.status === 'Ready' || form.status === 'Active'
      );
      
      // Filter to show audit-related forms
      forms.value = readyAndActiveForms.filter((form: AuditFormLite) => {
        // Prefer Audit types; include all Ready/Active forms as fallback if no audit forms
        return !form.formType || 
               form.formType === 'Audit' || 
               form.formType.toLowerCase().includes('audit');
      });
      
      // If no audit-type forms found, show all Ready/Active forms as fallback
      if (forms.value.length === 0 && readyAndActiveForms.length > 0) {
        forms.value = readyAndActiveForms;
      }
      
      // Sort: Active forms first, then Ready forms
      forms.value.sort((a, b) => {
        if (a.status === 'Active' && b.status === 'Ready') return -1;
        if (a.status === 'Ready' && b.status === 'Active') return 1;
        return 0;
      });
    }
  } catch (error) {
    console.error('Error fetching forms:', error);
    forms.value = [];
  } finally {
    loadingForms.value = false;
  }
};

// Handle form search
const handleFormSearch = () => {
  if (formSearchDebounce) clearTimeout(formSearchDebounce);
  formSearchDebounce = setTimeout(() => {
    // Search is handled by filteredForms computed property
  }, 250);
};

// Select form
const selectForm = (form: AuditFormLite) => {
  // ARCHITECTURE NOTE: Save form ID to draft
  draft.value.linkedFormId = form._id;
  formSearchQuery.value = '';
  showFormDropdown.value = false;
};

// Clear form selection
const clearForm = () => {
  if (isFormConfirmed.value) {
    // ARCHITECTURE NOTE: Prevent unlink after confirmation
    return;
  }
  draft.value.linkedFormId = null;
  formSearchQuery.value = '';
};

// Watch for step changes to fetch forms
watch(() => currentStep.value, (step) => {
  if (step === AuditScheduleStep.LINK_FORM && forms.value.length === 0) {
    fetchForms();
  }
  
  // Close dropdown when leaving step
  if (step !== AuditScheduleStep.LINK_FORM) {
    showFormDropdown.value = false;
  }
});

// ============================================================================
// Step 6: Review & Schedule
// ============================================================================

const scheduling = ref(false);
const scheduleError = ref<string | null>(null);

// ============================================================================
// Audit Title Strategy (system-generated by default)
// ============================================================================
// ARCHITECTURE NOTE:
// Audit events are governed workflows. Titles must be consistent across:
// - Inbox (attention + clarity)
// - Execution (what am I executing?)
// - Search (findability)
// - Reporting (aggregation + semantics)
//
// Therefore:
// - We generate a default title (visible to user) and use it unless overridden.
// - Free-text is NOT the primary UX path.
// - Users may optionally customize, but we never allow empty titles for audits.
const getAuditTitlePrefix = (auditTypeLabel: string | null): string => {
  if (!auditTypeLabel) return 'Audit';
  // "External Audit — Single Org" should present as "External Audit" in the title for clarity.
  if (auditTypeLabel === 'External Audit — Single Org') return 'External Audit';
  return auditTypeLabel;
};

const generatedAuditTitle = computed(() => {
  const auditTypeLabel = draft.value.auditType;
  const prefix = getAuditTitlePrefix(auditTypeLabel);
  const firstTargetOrganizationId = draft.value.targetOrganizations[0];

  if (auditTypeLabel === 'External Audit Beat') {
    const count = draft.value.targetOrganizations.length || 0;
    const label = `${count} Location${count === 1 ? '' : 's'}`;
    return `${prefix} — ${label}`;
  }

  const orgName =
    firstTargetOrganizationId
      ? getOrganizationName(firstTargetOrganizationId)
      : 'Organization';

  return `${prefix} — ${orgName || 'Organization'}`;
});

const isTitleCustomized = ref(false);
const customTitle = ref('');

const titleValue = computed({
  get: () => (isTitleCustomized.value ? customTitle.value : generatedAuditTitle.value),
  set: (v: string) => {
    customTitle.value = v;
  }
});

const titleValidationError = computed(() => {
  if (!isTitleCustomized.value) return null;
  if (!customTitle.value.trim()) return 'Title cannot be empty.';
  return null;
});

const toggleTitleCustomization = () => {
  if (!isTitleCustomized.value) {
    // Enter customization mode with generated title as starting point.
    customTitle.value = generatedAuditTitle.value;
    isTitleCustomized.value = true;
    return;
  }
  // Exit customization mode (revert to generated).
  isTitleCustomized.value = false;
  customTitle.value = '';
};

// Check if all required fields are present for scheduling
const canSchedule = computed(() => {
  return (
    draft.value.auditType !== null &&
    draft.value.targetOrganizations.length > 0 &&
    // Prerequisite: audit target org(s) must have a human-readable address.
    // Precise GEO enforcement happens at execution time via check-in.
    !isAuditAddressBlocking.value &&
    // Title guard: if user explicitly customizes, the title must not be empty.
    (!isTitleCustomized.value || customTitle.value.trim().length > 0) &&
    draft.value.auditorId !== null &&
    draft.value.correctiveOwnerId !== null &&
    draft.value.startDateTime !== null &&
    draft.value.endDateTime !== null &&
    draft.value.linkedFormId !== null &&
    // Reviewer required for External Audit — Single Org
    (draft.value.auditType !== 'External Audit — Single Org' || draft.value.reviewerId !== null) &&
    // Beat audit requires at least 2 organizations
    (draft.value.auditType !== 'External Audit Beat' || draft.value.targetOrganizations.length >= 2)
  );
});

// Schedule audit event
const scheduleAudit = async () => {
  if (!canSchedule.value || scheduling.value) return;

  scheduling.value = true;
  scheduleError.value = null;

  try {
    // ARCHITECTURE NOTE: Convert audit type label to key for backend API
    // UI stores labels (e.g., "Internal Audit") but backend expects keys (e.g., "INTERNAL_AUDIT")
    const auditTypeMeta = getEventTypeByLabel(draft.value.auditType || '');
    if (!auditTypeMeta) {
      scheduleError.value = 'Invalid audit type selected. Please go back and select an audit type.';
      scheduling.value = false;
      return;
    }
    
    // ARCHITECTURE NOTE: Build event payload according to audit type
    // Single-org audits use relatedToId, beat audits use orgList
    const eventPayload: AuditEventPayload = {
      // Title strategy:
      // - If user did NOT customize, omit `eventName` and let backend generate the default.
      // - If user explicitly customized, send the custom title (non-empty).
      //
      // This preserves consistency (Inbox/Execution/Search/Reporting) while allowing
      // optional customization without making free-text the primary UX.
      eventType: auditTypeMeta.key, // Send key to backend, not label
      auditorId: draft.value.auditorId,
      correctiveOwnerId: draft.value.correctiveOwnerId,
      startDateTime: draft.value.startDateTime,
      endDateTime: draft.value.endDateTime,
      linkedFormId: draft.value.linkedFormId,
      geoRequired: true // Always true for audit events
    };

    if (isTitleCustomized.value) {
      const trimmedTitle = customTitle.value.trim();
      if (!trimmedTitle) {
        scheduleError.value = 'Title cannot be empty.';
        scheduling.value = false;
        return;
      }
      eventPayload.eventName = trimmedTitle;
    }

    // Add reviewer if present
    if (draft.value.reviewerId) {
      eventPayload.reviewerId = draft.value.reviewerId;
    }

    // Handle organization(s) based on audit type
    if (isBeatAudit.value) {
      // External Audit Beat: use orgList
      eventPayload.orgList = draft.value.targetOrganizations.map((orgId, index) => ({
        organizationId: orgId,
        sequence: index + 1
      }));
    } else {
      // Single-org audits: use relatedToId
      const firstTargetOrganizationId = draft.value.targetOrganizations[0];
      if (!firstTargetOrganizationId) {
        scheduleError.value = 'Target organization is required.';
        scheduling.value = false;
        return;
      }
      eventPayload.relatedToId = firstTargetOrganizationId;
    }

    // ARCHITECTURE NOTE: Call audit-scoped event creation API (exclusive audit creation path)
    // We intentionally create audit events under the AUDIT namespace:
    //   POST /api/audit/events
    // so `resolveAppContextMiddleware` resolves appKey === 'AUDIT' and Sales-only
    // middleware on `/api/events` cannot be bypassed.
    //
    // See: docs/architecture/audit-scheduling-surface.md
    const response = await apiClient.post('/audit/events', eventPayload);

    if (response.success) {
      // Success: Navigate to the created event or audit dashboard
      const eventId = response.data?._id || response.data?.eventId;
      
      // ARCHITECTURE NOTE: Navigate to audit dashboard after successful scheduling
      // The audit event is now created and immutable
      router.push('/audit/audits');
    } else {
      scheduleError.value = response.message || response.error || 'Failed to schedule audit. Please try again.';
    }
  } catch (error: unknown) {
    console.error('Error scheduling audit:', error);
    const apiError = error as AuditApiError;
    scheduleError.value = apiError.response?.data?.message ||
                         apiError.response?.data?.error ||
                         apiError.message ||
                         'An error occurred while scheduling the audit. Please try again.';
  } finally {
    scheduling.value = false;
  }
};

// Fetch organizations when component mounts or when entering SELECT_TARGET step
watch(() => currentStep.value, (step) => {
  if (step === AuditScheduleStep.SELECT_TARGET && organizations.value.length === 0) {
    fetchOrganizations();
  }
});

// Get description for audit type
const getAuditTypeDescription = (key: string): string => {
  const descriptions: Record<string, string> = {
    INTERNAL_AUDIT: 'Audit conducted within your organization. Target organization is locked to your organization.',
    EXTERNAL_AUDIT_SINGLE: 'Audit of a single external organization. Requires independent reviewer.',
    EXTERNAL_AUDIT_BEAT: 'Multi-organization audit route. Visit multiple organizations in sequence.'
  };
  return descriptions[key] || '';
};

// Get requirements/consequences for audit type
const getAuditTypeRequirements = (key: string): string[] => {
  const requirements: Record<string, string[]> = {
    INTERNAL_AUDIT: [
      'Auditor (required)',
      'Corrective Owner (required)',
      'Reviewer (optional - self-review allowed)',
      'Geo Required (always enforced)',
      'Form Required (audit form)',
      'Target: Your organization (locked)'
    ],
    EXTERNAL_AUDIT_SINGLE: [
      'Auditor (required)',
      'Reviewer (required - cannot be same as auditor)',
      'Corrective Owner (required)',
      'Geo Required (always enforced)',
      'Form Required (audit form)',
      'Target: Single external organization'
    ],
    EXTERNAL_AUDIT_BEAT: [
      'Auditor (required)',
      'Corrective Owner (required)',
      'Reviewer (not required - single reviewer for route)',
      'Geo Required (always enforced)',
      'Form Required (audit form)',
      'Target: Multiple organizations (minimum 2)'
    ]
  };
  return requirements[key] || [];
};

// Handle audit type selection
const selectAuditType = (auditTypeLabel: string) => {
  // ARCHITECTURE NOTE: Save audit type and auto-advance to next step.
  // This ensures users complete each step sequentially and reduces friction.
  draft.value.auditType = auditTypeLabel as 'Internal Audit' | 'External Audit — Single Org' | 'External Audit Beat';
  
  // Auto-advance to next step after selection
  // Small delay to show visual feedback before advancing
  setTimeout(() => {
    nextStep();
  }, 300);
};

// Computed properties
const currentStepIndex = computed(() => {
  return stepDefinitions.findIndex(s => s.step === currentStep.value);
});

const currentStepDefinition = computed(() => {
  return stepDefinitions[currentStepIndex.value] ?? stepDefinitions[0]!;
});

const isLastStep = computed(() => {
  return currentStepIndex.value === stepDefinitions.length - 1;
});

// ARCHITECTURE NOTE: Step validation ensures all required fields are completed correctly.
// Each step must be validated before proceeding to the next step.
// This prevents incomplete audit event creation and ensures compliance.
const canProceedToNext = computed(() => {
  // TODO: Implement step-specific validation
  // For now, return false to prevent proceeding until validation is implemented
  switch (currentStep.value) {
    case AuditScheduleStep.SELECT_TYPE:
      return draft.value.auditType !== null;
    case AuditScheduleStep.SELECT_TARGET:
      // ARCHITECTURE NOTE: Validation rules per audit type
      // - Internal Audit: Must have exactly 1 org (user's org, auto-selected)
      // - External Audit — Single Org: Must have exactly 1 org
      // - External Audit Beat: Must have at least 2 orgs
      if (isInternalAudit.value) {
        return draft.value.targetOrganizations.length === 1 && !isAuditAddressBlocking.value;
      } else if (isSingleOrgAudit.value) {
        return draft.value.targetOrganizations.length === 1 && !isAuditAddressBlocking.value;
      } else if (isBeatAudit.value) {
        return draft.value.targetOrganizations.length >= 2 && !isAuditAddressBlocking.value;
      }
      return false;
    case AuditScheduleStep.ASSIGN_ROLES:
      // ARCHITECTURE NOTE: Role validation per audit type
      // - Auditor: Required for all audit types
      // - Reviewer: Required for External Audit — Single Org only, optional for Internal Audit, not required for Beat
      // - Corrective Owner: Required for all audit types
      // - Self-review: Allowed for Internal Audit only, prevented for External Audit — Single Org
      
      // Auditor required
      if (!draft.value.auditorId) {
        return false;
      }
      
      // Corrective Owner required
      if (!draft.value.correctiveOwnerId) {
        return false;
      }
      
      // Reviewer validation
      if (requiresReviewer.value && !draft.value.reviewerId) {
        return false;
      }
      
      // Self-review prevention (reviewer cannot be same as auditor for external audits)
      if (draft.value.reviewerId && draft.value.auditorId && 
          draft.value.reviewerId === draft.value.auditorId && 
          !allowsSelfReview.value) {
        return false;
      }
      
      return true;
    case AuditScheduleStep.SCHEDULE_TIME:
      // ARCHITECTURE NOTE: Time validation
      // - Start datetime required and cannot be in the past
      // - End datetime required and must be after start datetime
      if (!draft.value.startDateTime || !draft.value.endDateTime) {
        return false;
      }
      
      const startDate = new Date(draft.value.startDateTime);
      const endDate = new Date(draft.value.endDateTime);
      const now = new Date();
      
      // Start must not be in the past
      if (startDate < now) {
        return false;
      }
      
      // End must be after start
      if (endDate <= startDate) {
        return false;
      }
      
      return true;
    case AuditScheduleStep.LINK_FORM:
      // ARCHITECTURE NOTE: Form is required for all audit events
      // Must be a valid form ID
      return draft.value.linkedFormId !== null && draft.value.linkedFormId !== '';
    case AuditScheduleStep.REVIEW_CONFIRM:
      // Final validation - all fields must be complete
      return validateDraft().isValid;
    default:
      return false;
  }
});

// Step navigation handlers
const nextStep = () => {
  if (!canProceedToNext.value) {
    return;
  }

  const nextIndex = currentStepIndex.value + 1;
  if (nextIndex < stepDefinitions.length) {
    const next = stepDefinitions[nextIndex];
    if (next) currentStep.value = next.step;
  } else {
    // Last step - handle scheduling (will be implemented later)
    handleSchedule();
  }
};

const prevStep = () => {
  const prevIndex = currentStepIndex.value - 1;
  if (prevIndex >= 0) {
    const prev = stepDefinitions[prevIndex];
    if (prev) currentStep.value = prev.step;
  }
};

// ARCHITECTURE NOTE: Draft validation ensures all required fields are present
// before creating the audit event instance. This prevents incomplete audit events.
const validateDraft = (): AuditScheduleValidationResult => {
  const errors: Partial<Record<keyof AuditScheduleDraft, string>> = {};

  // Validate audit type
  if (!draft.value.auditType) {
    errors.auditType = 'Audit type is required';
  }

  // Validate target organizations
  if (draft.value.targetOrganizations.length === 0) {
    errors.targetOrganizations = 'At least one target organization is required';
  }
  // Prerequisite: organization address required for audit scheduling (human-readable location).
  // Note: GEO precision is enforced at execution time via check-in — not here.
  if (draft.value.targetOrganizations.length > 0 && isAuditAddressBlocking.value) {
    errors.targetOrganizations = 'Organization address is required to schedule an audit.';
  }

  // Validate roles
  if (!draft.value.auditorId) {
    errors.auditorId = 'Auditor is required';
  }
  if (!draft.value.correctiveOwnerId) {
    errors.correctiveOwnerId = 'Corrective Owner is required';
  }
  if (draft.value.auditType === 'External Audit — Single Org' && !draft.value.reviewerId) {
    errors.reviewerId = 'Reviewer is required for External Audit — Single Org';
  }

  // Validate scheduling
  if (!draft.value.startDateTime) {
    errors.startDateTime = 'Start date/time is required';
  }
  if (!draft.value.endDateTime) {
    errors.endDateTime = 'End date/time is required';
  }
  if (draft.value.startDateTime && draft.value.endDateTime) {
    const start = new Date(draft.value.startDateTime);
    const end = new Date(draft.value.endDateTime);
    if (end <= start) {
      errors.endDateTime = 'End date/time must be after start date/time';
    }
  }

  // Validate form
  if (!draft.value.linkedFormId) {
    errors.linkedFormId = 'Linked audit form is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Handle final scheduling (Step 6)
// Invariant:
// Step 6 must expose exactly ONE primary CTA: "Schedule Audit" (the footer button).
// Do not add a second in-step "Schedule Audit" button — it creates duplicate CTAs and drift.
const handleSchedule = () => {
  const validation = validateDraft();
  if (!validation.isValid) {
    // Show validation errors
    console.error('Validation errors:', validation.errors);
    return;
  }

  // Delegate to the real scheduling implementation.
  // This keeps the footer CTA as the single source of scheduling truth.
  scheduleAudit();
};
</script>
