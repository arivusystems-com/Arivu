<template>
  <div
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    :class="[props.hideHeader ? '' : 'p-6', modulePageDirty ? SETTINGS_SAVE_BAR_CONTENT_CLASS : '']"
  >
    <div v-if="!props.hideHeader" class="mb-4 flex shrink-0 items-center justify-between gap-3">
      <template v-if="selectedModuleId">
        <div class="flex items-center gap-3">
          <button @click="clearSelection" class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5" :title="t('settings.modFieldsBackTitle')">
            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.78 15.22a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 010-1.06l4.5-4.5a.75.75 0 111.06 1.06L8.56 10l4.22 4.22a.75.75 0 010 1.06z" clip-rule="evenodd"/></svg>
          </button>
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ selectedModule?.name }}</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.appsModuleConfigureHint') }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button @click="openCreateModal" class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            {{ t('settings.modFieldsCreateModule') }}
          </button>
        </div>
      </template>
      <template v-else>
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ title }}</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.modFieldsManageModules') }}</p>
        </div>
        <button @click="openCreateModal" class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          {{ t('settings.modFieldsCreateModule') }}
        </button>
      </template>
    </div>

    <!-- If no module selected: show previous grid listing -->
    <div v-if="!selectedModuleId" class="flex-1 overflow-y-auto">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
      <!-- pt-1 prevents hover lift from clipping the top border (overflow-y-auto clips translated content) -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
        <div
          v-for="mod in displayModules"
          :key="mod._id"
          class="relative group flex flex-col h-full"
        >
          <button
            type="button"
            class="flex flex-col h-full w-full text-left bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:shadow-lg hover:border-indigo-500/50 dark:hover:border-indigo-400/50 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            @click="selectModule(mod)"
          >
            <!-- Card Header (match Core Modules) -->
            <div class="flex items-start gap-3 mb-4">
              <div class="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors">
                <component :is="getModuleCardIcon(mod)" class="w-6 h-6" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <h3 class="text-base font-semibold text-gray-900 dark:text-white truncate min-w-0">
                    {{ mod.name }}
                  </h3>
                  <button
                    v-if="mod.type === 'custom'"
                    type="button"
                    @click.stop="deleteModule(mod)"
                    class="flex-shrink-0 text-red-600 dark:text-red-400 text-sm hover:underline opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150"
                  >
                    {{ t('settings.modFieldsDelete') }}
                  </button>
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {{ formatModuleCardCounts(mod) }}
                </p>
              </div>
              <svg class="flex-shrink-0 w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <!-- Badges (match Core Modules) -->
            <div class="flex flex-wrap gap-2 mt-auto">
              <span
                v-if="mod.type === 'system'"
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                {{ t('settings.modFieldsBadgeCore') }}
              </span>
              <span
                v-else-if="mod.type === 'custom'"
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
              >
                {{ t('settings.modFieldsBadgeCustom') }}
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                {{ t('settings.modFieldsBadgeApp') }}
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- If module selected: configuration area with top tabs -->
    <div v-else class="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">
      <!-- Top tabs: Module details, Field Configurations, Relationship, Quick Create -->
      <div class="shrink-0 px-2">
        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav class="-mb-px flex space-x-6">
            <button
              type="button"
              v-for="tab in topTabs"
              :key="tab.id"
              @click.prevent="setActiveTopTab(tab.id)"
              :class="[
                activeTopTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600',
                'whitespace-nowrap py-3 px-1 border-b-2 text-sm font-medium'
              ]"
            >
              {{ tab.name }}
            </button>
          </nav>
        </div>
        <div v-if="activeTopTab === 'pipeline'" class="flex items-center justify-between py-3">
          <div class="text-sm text-gray-500 dark:text-gray-400">
            <span v-if="activeTopTab === 'pipeline'">{{ t('settings.modFieldsPipelineHint') }}</span>
          </div>
        </div>
      </div>

      <!-- Fields configuration: two-panel layout -->
      <div v-if="activeTopTab === 'fields'" class="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">
        <!-- Microcopy for People module -->
        <div v-if="isPeopleModule" class="px-2 flex-shrink-0">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ t('settings.modFieldsPeopleMicrocopy') }}
          </p>
        </div>
        
        <!-- Microcopy for Organizations module -->
        <div v-if="isOrganizationsModule" class="px-2 flex-shrink-0">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ t('settings.modFieldsOrgsMicrocopy') }}
            <strong>{{ t('settings.modFieldsFormsNote') }}</strong>
            {{ t('settings.modFieldsOrgsNoteBody') }}
          </p>
        </div>
        
        <!-- Microcopy for Tasks module -->
        <div v-if="isTasksModule" class="px-2 flex-shrink-0">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ t('settings.modFieldsTasksMicrocopy') }}
            <strong>{{ t('settings.modFieldsFormsNote') }}</strong>
            {{ t('settings.modFieldsTasksNoteBody') }}
          </p>
        </div>
        
        <!-- Microcopy for Events module -->
        <!-- 
          ARCHITECTURE NOTE: Events Settings configure structure, constraints, and eligibility only.
          Excludes: scheduling, execution, audit workflows, calendars.
          See: docs/architecture/event-settings.md
        -->
        <div v-if="isEventsModule" class="px-2 flex-shrink-0">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ t('settings.modFieldsEventsMicrocopy') }}
            <strong>{{ t('settings.modFieldsFormsNote') }}</strong>
            {{ t('settings.modFieldsEventsNoteBody') }}
          </p>
        </div>
        
        <!-- Microcopy for Items module -->
        <div v-if="isItemsModule" class="px-2 flex-shrink-0">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ t('settings.modFieldsItemsMicrocopy') }}
            <strong>{{ t('settings.modFieldsFormsNote') }}</strong>
            {{ t('settings.modFieldsItemsNoteBody') }}
          </p>
        </div>
        
        <!-- Microcopy for Forms module -->
        <!-- 
          ARCHITECTURE NOTE: Forms Settings configure structure & behavior ONLY.
          MUST NOT: Edit sections/questions, Edit responses, Execute workflows, Run scoring
          
          CAPABILITY DECLARATION:
          - Fields are configurable (can configure visibility, behavior, rules)
          - builderEditable: false (form structure belongs to Form Builder)
          - contentEditable: false (form content belongs to Form Builder)
          - submissionMutationAllowed: false (responses belong to Form Responses / Analytics)
          
          See: client/src/platform/modules/forms/formsModule.definition.ts
          See: client/src/platform/forms/formSettingsCapabilities.ts
        -->
        <div v-if="isFormsModule" class="px-2 flex-shrink-0">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ t('settings.modFieldsFormsMicrocopy') }}
            <strong>{{ t('settings.modFieldsFormsNote') }}</strong>
            {{ t('settings.modFieldsFormsNoteBody') }}
          </p>
          
          <!-- Capability Indicators -->
          <div class="mt-3 flex flex-wrap gap-2">
            <span v-if="hasCapability('metadataEditable')" class="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium">
              {{ t('settings.modFieldsCapMetadata') }}
            </span>
            <span v-if="isCapabilityLocked('builderEditable')" class="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-medium">
              {{ t('settings.modFieldsCapStructureLocked') }}
            </span>
            <span v-if="isCapabilityLocked('contentEditable')" class="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-medium">
              {{ t('settings.modFieldsCapContentLocked') }}
            </span>
          </div>
        </div>
        
        <div class="flex-1 overflow-hidden flex gap-4 min-h-0">
        <!-- Left: Fields list -->
        <aside class="w-96 flex-none bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col min-h-0">
          <div class="p-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between gap-2 flex-shrink-0">
            <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate flex-1 min-w-0">{{ selectedModule?.name }}</div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <button
                v-if="selectedModule"
                type="button"
                @click="showManageSections = true"
                class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 text-xs font-medium transition-colors whitespace-nowrap"
              >
                {{ t('settings.modFieldsManageSections') }}
              </button>
              <button 
                v-if="selectedModule && !props.hideFieldCreation" 
                @click="openAddField" 
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 text-xs font-medium transition-colors whitespace-nowrap"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>{{ t('settings.modFieldsAddCustomField') }}</span>
              </button>
            </div>
          </div>
          <div class="p-2 border-b border-gray-200 dark:border-white/10 flex items-center justify-between flex-shrink-0">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsFieldsLabel') }}</div>
          </div>
        <div class="p-2 border-b border-gray-200 dark:border-white/10 space-y-2 flex-shrink-0">
          <input v-model="fieldSearch" :placeholder="t('settings.modFieldsSearchFieldsPh')" class="w-full px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs" />
          <!-- Show Tenant Fields Toggle (only for organizations module) -->
          <label v-if="selectedModule?.key === 'organizations'" class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
            <HeadlessCheckbox
              v-model="showTenantFields"
              checkbox-class="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
            />
            <span>{{ t('settings.modFieldsShowTenantFields') }}</span>
          </label>
        </div>
        <div class="modules-fields-list p-2" style="flex: 1 1 0%; min-height: 0; overflow-y: auto; overflow-x: auto; -webkit-overflow-scrolling: touch;">
          <FieldConfigSectionList
            v-if="fieldLayout"
            :fields="editFields"
            :layout="fieldLayout"
            :search="fieldSearch"
            :selected-field-key="editFields[selectedFieldIdx]?.key || ''"
            :resolve-badge="resolveFieldListBadge"
            :resolve-label="getFieldLabel"
            :resolve-data-type="getFieldDataType"
            :is-system-field-key="isSystemFieldKeyForList"
            :can-drag-field-key="canDragFieldInLayout"
            :include-field="includeFieldInLayoutList"
            :allow-add-field="!props.hideFieldCreation"
            @select="selectFieldByKey"
            @reorder="onLayoutReorder"
            @add-field="openAddField"
          />
          <div v-else class="px-2 py-6 text-xs text-gray-500 dark:text-gray-400 text-center">
            {{ t('settings.modFieldsFieldsLabel') }}
          </div>
        </div>
      </aside>

      <!-- Right: Field configuration -->
      <section class="flex-1 min-w-0 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col min-h-0">
        <div class="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between flex-shrink-0">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ currentFieldTitle }}</h3>
              <!-- People / Organizations: metadata-based badges -->
              <template v-if="(isPeopleModule || isOrganizationsModule) && currentField?.key">
                <span v-if="(isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.owner === 'system'" class="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">{{ t('settings.modFieldsBadgeSystem') }}</span>
                <span v-else-if="currentField?.owner === 'org'" class="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">{{ t('settings.modFieldsBadgeCustomField') }}</span>
                <span v-else-if="(isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.owner === 'core'" class="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">{{ t('settings.modFieldsBadgeCoreField') }}</span>
                <span v-else-if="(isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.fieldScope" class="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">{{ (isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.fieldScope }}</span>
              </template>
              <!-- Deals module: Core vs System badges from deal field model -->
              <template v-else-if="isDealsModule && currentField?.key">
                <span v-if="getDealFieldMetadata(currentField.key)?.owner === 'system'" class="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">{{ t('settings.modFieldsBadgeSystem') }}</span>
                <span v-else-if="currentField?.owner === 'org'" class="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">{{ t('settings.modFieldsBadgeCustomField') }}</span>
                <span v-else-if="getDealFieldMetadata(currentField.key)?.owner === 'core'" class="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">{{ t('settings.modFieldsBadgeCoreField') }}</span>
              </template>
              <!-- Other modules: Legacy badges -->
              <template v-else>
                <span v-if="isSystemField(currentField)" class="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">{{ t('settings.modFieldsBadgeSystem') }}</span>
                <span v-else-if="currentField?.owner === 'org'" class="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">{{ t('settings.modFieldsBadgeCustomField') }}</span>
                <span v-else-if="isFixedPositionField(currentField, selectedModule?.key)" class="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">{{ t('settings.modFieldsBadgeFixedPosition') }}</span>
                <span v-else-if="isCoreField(currentField, selectedModule?.key)" class="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">{{ t('settings.modFieldsBadgeCoreField') }}</span>
              </template>
            </div>
            <!-- People / Organizations: Metadata-based messages -->
            <template v-if="(isPeopleModule || isOrganizationsModule) && currentField?.key">
              <p v-if="(isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.owner === 'system'" class="mt-1 text-xs text-amber-600 dark:text-amber-400">{{ t('settings.modFieldsMsgSystemField') }}</p>
              <p v-else-if="(isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.owner === 'core'" class="mt-1 text-xs text-blue-600 dark:text-blue-400">{{ t('settings.modFieldsMsgCoreIdentity') }}</p>
              <p v-else-if="(isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.owner === 'participation'" class="mt-1 text-xs text-purple-600 dark:text-purple-400">{{ t('settings.modFieldsMsgParticipation', { scope: (isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.fieldScope }) }}</p>
            </template>
            <!-- Deals module: Core vs System messages -->
            <template v-else-if="isDealsModule && currentField?.key">
              <p v-if="getDealFieldMetadata(currentField.key)?.owner === 'system'" class="mt-1 text-xs text-amber-600 dark:text-amber-400">{{ t('settings.modFieldsMsgSystemField') }}</p>
              <p v-else-if="getDealFieldMetadata(currentField.key)?.owner === 'core'" class="mt-1 text-xs text-blue-600 dark:text-blue-400">{{ t('settings.modFieldsMsgCoreDeal') }}</p>
            </template>
            <!-- Other modules: Legacy messages -->
            <template v-else>
              <p v-if="isSystemField(currentField)" class="mt-1 text-xs text-amber-600 dark:text-amber-400">{{ t('settings.modFieldsMsgSystemField') }}</p>
              <p v-else-if="isFixedPositionField(currentField, selectedModule?.key)" class="mt-1 text-xs text-amber-600 dark:text-amber-400">{{ t('settings.modFieldsMsgFixedTop') }}</p>
              <p v-else-if="isCoreField(currentField, selectedModule?.key)" class="mt-1 text-xs text-amber-600 dark:text-amber-400">{{ t('settings.modFieldsMsgCoreNoDelete') }}</p>
            </template>
          </div>
          <div class="flex items-center gap-2">
            <button v-if="currentField && canDeleteField && !props.hideFieldCreation" @click="openDeleteFieldConfirm" class="px-3 py-2 bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700 rounded-lg text-sm font-medium transition-colors shadow-sm">{{ t('settings.modFieldsDeleteField') }}</button>
          </div>
        </div>

        <div class="p-4" style="flex: 1 1 0%; min-height: 0; overflow-y: auto; overflow-x: auto; -webkit-overflow-scrolling: touch;" v-if="selectedModule">
          <div v-if="currentField">
            <div class="border-b border-gray-200 dark:border-gray-700 mb-4">
              <nav class="-mb-px flex space-x-6">
                <button
                  v-for="tab in subTabs"
                  :key="tab.id"
                  @click="activeSubTab = tab.id"
                  :disabled="isSubTabDisabled(tab.id)"
                  :class="[
                    activeSubTab === tab.id
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600',
                    'whitespace-nowrap py-3 px-1 border-b-2 text-sm font-medium',
                    isSubTabDisabled(tab.id) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  ]"
                >
                  {{ tab.name }}
                </button>
              </nav>
            </div>
            <div v-if="activeSubTab === 'general'" class="space-y-4">
              <div
                v-if="showCustomFieldParticipationScope && currentField?.owner === 'org' && customFieldAppScopeOptions.length"
                class="mb-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-900/50 space-y-3"
              >
                <div>
                  <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsFieldScope') }}</label>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {{ t('settings.modFieldsFieldScopeHelp') }}
                  </p>
                </div>
                <div class="flex flex-col gap-2">
                  <label class="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                      :checked="orgCustomFieldIsCoreScope"
                      @change="setOrgCustomFieldScopeCore"
                    />
                    <span class="text-sm text-gray-900 dark:text-white">{{ t('settings.modFieldsScopeCoreShared') }}</span>
                  </label>
                  <label class="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                      :checked="!orgCustomFieldIsCoreScope"
                      @change="setOrgCustomFieldScopeApp"
                    />
                    <span class="text-sm text-gray-900 dark:text-white">{{ t('settings.modFieldsScopeAppSpecific') }}</span>
                  </label>
                </div>
                <div v-if="!orgCustomFieldIsCoreScope" class="space-y-1">
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('settings.modFieldsApplication') }}</label>
                  <HeadlessSelect
                    v-model="orgCustomAppContextToken"
                    :options="customFieldAppScopeOptions"
                    teleport
                    :teleport-match-width="true"
                    button-class="!py-2 !rounded-lg !bg-white dark:!bg-gray-800 dark:!border-gray-600"
                  />
                </div>
              </div>
              <!-- Form Type Editor (Forms module only) -->
              <!-- 
                ARCHITECTURE NOTE: Form Type is a CORE domain field.
                It is user-editable and intent-defining.
                Built-in types are protected from deletion, not from selection or change.
                See: client/src/platform/forms/formTypeRegistry.ts
              -->
              <div v-if="isFormsModule && currentField?.key === 'formType'" class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <label class="block text-sm font-medium text-gray-900 dark:text-white mb-2">{{ t('settings.modFieldsFormType') }}</label>
                <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  {{ t('settings.modFieldsFormTypeHelp') }}
                </p>
                <div class="space-y-3">
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsSelectFormType') }}</label>
                    <HeadlessSelect
                      v-model="currentField.defaultValue"
                      :options="formTypeSelectOptions"
                      :placeholder="t('settings.modFieldsSelectFormTypePh')"
                      allow-empty
                      :empty-label="t('settings.modFieldsSelectFormTypePh')"
                      empty-value=""
                      :disabled="false"
                      teleport
                      :teleport-match-width="true"
                      button-class="!py-2 !rounded !bg-white dark:!bg-gray-800 dark:!border-white/10"
                      @focus="loadFieldSettings()"
                      @click="loadFieldSettings()"
                    />
                  </div>
                  
                  <!-- Custom Form Types List (with remove option) -->
                  <div v-if="getCustomFormTypes().length > 0">
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsCustomFormTypes') }}</label>
                    <div class="space-y-2">
                      <div 
                        v-for="type in getCustomFormTypes()" 
                        :key="type.key"
                        class="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
                      >
                        <span class="text-sm text-gray-900 dark:text-white">{{ type.label }}</span>
                        <button
                          v-if="!isBuiltInFormType(type.key)"
                          @click="handleRemoveCustomFormType(type.key)"
                          class="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          {{ t('actions.remove') }}
                        </button>
                        <span
                          v-else
                          class="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 italic"
                        >
                          {{ t('settings.modFieldsBuiltIn') }}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsAddCustomFormType') }}</label>
                    <div class="flex gap-2">
                      <input 
                        v-model="newFormTypeKey"
                        :placeholder="t('settings.modFieldsFormTypeKeyPh')"
                        class="flex-1 px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 text-sm"
                        @keyup.enter="handleAddCustomFormType"
                      />
                      <input 
                        v-model="newFormTypeLabel"
                        :placeholder="t('settings.modFieldsFormTypeLabelPh')"
                        class="flex-1 px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 text-sm"
                        @keyup.enter="handleAddCustomFormType"
                      />
                      <button 
                        @click="handleAddCustomFormType"
                        class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium transition-colors"
                      >
                        {{ t('actions.add') }}
                      </button>
                    </div>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {{ t('settings.modFieldsFormTypeBuiltinNote') }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Basic Field Information -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsLabel') }}</label>
                  <input 
                    :value="isFieldLabelReadOnly(currentField) ? formatFieldLabelForDisplay(currentField?.label, currentField?.key) : (currentField?.label || '')"
                    @input="onFieldLabelInput"
                    :disabled="isFieldLabelReadOnly(currentField)" 
                    class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" 
                  />
                  <p v-if="isFieldLabelReadOnly(currentField)" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsHintLabelReadOnly') }}</p>
                </div>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsKey') }}</label>
                  <input 
                    v-model="currentField.key" 
                    :disabled="!canRenameField(currentField) || isSystemField(currentField) || isCoreField(currentField, selectedModule?.key) || currentField.dataType === 'Auto-Number' || ((isPeopleModule || isOrganizationsModule) && ((isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.owner === 'system' || (isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.owner === 'core' || (isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.owner === 'participation'))" 
                    class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" 
                  />
                  <p v-if="currentField.dataType === 'Auto-Number'" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsHintAutoNumberKey') }}</p>
                  <p v-if="isSystemField(currentField) || ((isPeopleModule || isOrganizationsModule) && (isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.owner === 'system')" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsHintSystemKey') }}</p>
                  <p v-if="(isPeopleModule || isOrganizationsModule) && (isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.owner === 'core'" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsHintCoreIdentityKey') }}</p>
                  <p v-if="(isPeopleModule || isOrganizationsModule) && (isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.owner === 'participation'" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsHintParticipationKey') }}</p>
                  <p v-if="isCoreField(currentField, selectedModule?.key) && !isSystemField(currentField) && !isPeopleModule && !isOrganizationsModule" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsHintCoreKey') }}</p>
                  <p v-if="!isSystemField(currentField) && !isCoreField(currentField, selectedModule?.key) && currentField.dataType !== 'Auto-Number' && !isPeopleModule" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsHintAutoKey') }}</p>
                </div>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsType') }}</label>
                  <HeadlessSelect
                    v-model="currentField.dataType"
                    :options="fieldTypeSelectOptions"
                    :disabled="!canChangeFieldType(currentField) || isSystemField(currentField) || isCoreField(currentField, selectedModule?.key) || (isPeopleModule && (getPeopleFieldMetadata(currentField.key)?.owner === 'system' || getPeopleFieldMetadata(currentField.key)?.owner === 'core'))"
                    teleport
                    :teleport-match-width="true"
                    :truncate-options="false"
                    button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                  />
                  <p v-if="isPeopleModule && getPeopleFieldMetadata(currentField.key)?.owner === 'core'" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsHintCoreIdentityType') }}</p>
                  <p v-if="isPeopleModule && getPeopleFieldMetadata(currentField.key)?.owner === 'system'" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsHintSystemType') }}</p>
                  <p v-if="isCoreField(currentField, selectedModule?.key) && !isPeopleModule" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsHintCoreType') }}</p>
                </div>
                
                <!-- Field Metadata (read-only) - People / Organizations -->
                <template v-if="(isPeopleModule || isOrganizationsModule) && currentField?.key">
                  <div v-if="(isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))" class="w-full mt-4 p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg">
                    <div class="space-y-2">
                      <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{{ t('settings.modFieldsFieldMetadata') }}</div>
                      <div class="flex flex-wrap items-center gap-3">
                        <!-- Owner -->
                        <div class="flex items-center gap-2">
                          <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsMetadataOwner') }}</span>
                          <span class="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {{ formatOwnerDisplay(isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key)) }}
                          </span>
                        </div>
                        <!-- Intent -->
                        <div class="flex items-center gap-2">
                          <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsMetadataIntent') }}</span>
                          <span class="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {{ formatIntentDisplay((isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.intent) }}
                          </span>
                        </div>
                        <!-- Required for (only if present) -->
                        <div v-if="(isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.requiredFor?.length" class="flex items-center gap-2">
                          <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsMetadataRequiredFor') }}</span>
                          <span class="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {{ formatRequiredForApps((isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.requiredFor) }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
                
                <div class="flex items-center gap-6 mt-6 flex-wrap">
                  <!-- Required in Form checkbox -->
                  <template v-if="isParticipationStateField(currentField)">
                    <!-- Locked indicator for participation state fields -->
                    <div class="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400" :title="t('settings.modFieldsTitleRequiredByApp')">
                      <svg class="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>{{ t('settings.modFieldsRequiredInForm') }}</span>
                    </div>
                  </template>
                  <template v-else>
                    <div class="inline-flex items-center gap-2">
                      <label class="inline-flex items-center gap-2 text-sm">
                        <HeadlessCheckbox
                          v-model="currentField.required"
                          :disabled="isSystemField(currentField) || currentField.dataType === 'Auto-Number' || currentField.dataType === 'Formula' || currentField.dataType === 'Rollup Summary'"
                        />
                        {{ t('settings.modFieldsRequiredInForm') }}
                      </label>
                      <div class="group relative">
                        <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          {{ t('settings.modFieldsTooltipRequiredInForm') }}
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- Key Field checkbox -->
                  <label class="inline-flex items-center gap-2 text-sm">
                    <HeadlessCheckbox
                      v-model="currentField.keyField"
                      :disabled="isSystemField(currentField) || !canMarkAsKeyField || isParticipationStateField(currentField)"
                    />
                    {{ t('settings.modFieldsKeyField') }}
                    <span v-if="keyFieldCount > 0" class="text-xs text-gray-500 dark:text-gray-400">({{ keyFieldCount }}/10)</span>
                  </label>

                  <!-- People module: Metadata-based visibility guards -->
                  <template v-if="isPeopleModule && currentField?.key">
                    <!-- Participation state fields: Show locked indicators -->
                    <template v-if="isParticipationStateField(currentField)">
                      <div class="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <svg class="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>{{ t('settings.modFieldsShowInTable') }}</span>
                      </div>
                      <div class="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <svg class="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>{{ t('settings.modFieldsShowInDetail') }}</span>
                      </div>
                    </template>
                    <!-- Other fields: Normal checkboxes -->
                    <template v-else>
                      <label class="inline-flex items-center gap-2 text-sm" :title="t('settings.modFieldsTitleShowInTable')">
                        <HeadlessCheckbox
                          v-model="currentField.visibility.list"
                          :disabled="!canHideField(currentField) || getPeopleFieldMetadata(currentField.key)?.owner === 'system'"
                        />
                        {{ t('settings.modFieldsShowInTable') }}
                      </label>
                      <label class="inline-flex items-center gap-2 text-sm">
                        <HeadlessCheckbox
                          v-model="currentField.visibility.detail"
                          :disabled="!canHideField(currentField) || getPeopleFieldMetadata(currentField.key)?.owner === 'system'"
                        />
                        {{ t('settings.modFieldsShowInDetail') }}
                      </label>
                    </template>
                    
                    <!-- Helper text for participation state fields -->
                    <p v-if="isParticipationStateField(currentField)" class="w-full mt-2 text-xs text-gray-600 dark:text-gray-400">
                      {{ t('settings.modFieldsHintStateFieldsVisible') }}
                    </p>
                    <p v-else-if="getPeopleFieldMetadata(currentField.key)?.owner === 'system'" class="w-full mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {{ t('settings.modFieldsHintSystemAlwaysVisible') }}
                    </p>
                  </template>
                  <!-- Other modules: Legacy visibility controls -->
                  <template v-else>
                    <label class="inline-flex items-center gap-2 text-sm" :title="t('settings.modFieldsTitleShowInTable')">
                      <HeadlessCheckbox v-model="currentField.visibility.list" :disabled="isSystemField(currentField) || isFixedPositionField(currentField, selectedModule?.key)" />
                      {{ t('settings.modFieldsShowInTable') }}
                    </label>
                    <label class="inline-flex items-center gap-2 text-sm"><HeadlessCheckbox v-model="currentField.visibility.detail" :disabled="isSystemField(currentField) || isFixedPositionField(currentField, selectedModule?.key)" /> {{ t('settings.modFieldsShowInDetail') }}</label>
                    <p v-if="isFixedPositionField(currentField, selectedModule?.key)" class="w-full mt-2 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsHintFixedAlwaysVisible') }}</p>
                  </template>
                </div>
                
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsDefaultValue') }}</label>
                  <template v-if="!isSystemField(currentField) && currentField.dataType !== 'Auto-Number' && currentField.dataType !== 'Formula' && currentField.dataType !== 'Rollup Summary'">
                    <!-- Picklist, Radio Button: dropdown -->
                    <HeadlessSelect
                      v-if="['Picklist', 'Radio Button'].includes(currentField.dataType)"
                      v-model="currentField.defaultValue"
                      :options="defaultPicklistSelectOptions"
                      :placeholder="t('settings.modFieldsNoDefault')"
                      allow-empty
                      :empty-label="t('settings.modFieldsNoDefault')"
                      empty-value=""
                      teleport
                      :teleport-match-width="true"
                      button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                    />
                    <!-- Multi-Picklist: checkbox list (HeadlessSelect is single-select) -->
                    <template v-else-if="currentField.dataType === 'Multi-Picklist'">
                      <div class="space-y-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-white/10 rounded-lg p-2 bg-gray-50 dark:bg-white/5">
                        <div v-if="!normalizedOptions.length" class="text-xs text-gray-500 dark:text-gray-400 py-2 text-center">
                          {{ t('settings.modFieldsNoOptionsAvailable') }}
                        </div>
                        <label
                          v-for="opt in normalizedOptions"
                          :key="getOptionValue(opt)"
                          class="flex items-center gap-2 p-1.5 hover:bg-white/60 dark:hover:bg-white/5 rounded cursor-pointer"
                        >
                          <HeadlessCheckbox
                            :checked="defaultValueMultiPicklist.includes(getOptionValue(opt))"
                            @change="toggleDefaultMultiPicklistOption(getOptionValue(opt))"
                            checkbox-class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span class="text-sm text-gray-700 dark:text-gray-300">{{ getOptionDisplayLabel(opt) }}</span>
                        </label>
                      </div>
                      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsMultiPicklistHint') }}</p>
                    </template>
                    <!-- Checkbox: checkbox -->
                    <label v-else-if="currentField.dataType === 'Checkbox'" class="inline-flex items-center gap-2 cursor-pointer">
                      <HeadlessCheckbox
                        :checked="defaultValueCheckbox"
                        @change="currentField.defaultValue = $event.target.checked"
                        checkbox-class="rounded border-gray-300 dark:border-gray-600"
                      />
                      <span class="text-sm">{{ t('settings.modFieldsDefaultToChecked') }}</span>
                    </label>
                    <!-- Number fields: number input -->
                    <input
                      v-else-if="['Integer', 'Decimal', 'Currency'].includes(currentField.dataType)"
                      v-model.number="currentField.defaultValue"
                      type="number"
                      :step="currentField.dataType === 'Integer' ? 1 : 0.01"
                      class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10"
                    />
                    <!-- Date: date input -->
                    <DatePicker
                      v-else-if="currentField.dataType === 'Date'"
                      v-model="currentField.defaultValue"
                      input-class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <!-- Date-Time: datetime-local input -->
                    <DateTimePicker
                      v-else-if="currentField.dataType === 'Date-Time'"
                      v-model="currentField.defaultValue"
                      input-class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <!-- Text, Text-Area, Email, Phone, URL, Rich Text: text input -->
                    <input
                      v-else
                      v-model="currentField.defaultValue"
                      class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10"
                    />
                  </template>
                  <div v-else class="w-full px-3 py-2 rounded bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 text-sm">
                    {{ currentField.defaultValue ?? t('settings.modFieldsNone') }}
                  </div>
                  <p v-if="currentField.dataType === 'Auto-Number' || currentField.dataType === 'Formula' || currentField.dataType === 'Rollup Summary'" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsHintNoDefaultValue') }}</p>
                  <p v-if="isSystemField(currentField)" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsHintSystemNoDefault') }}</p>
                </div>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsPlaceholder') }}</label>
                  <input v-model="currentField.placeholder" :placeholder="t('settings.modFieldsPlaceholderPh')" :disabled="isSystemField(currentField) || currentField.dataType === 'Auto-Number' || currentField.dataType === 'Checkbox' || currentField.dataType === 'Formula' || currentField.dataType === 'Rollup Summary'" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                </div>
              </div>

              <!-- Picklist Options (for Picklist, Multi-Picklist, Radio Button) -->
              <div v-if="['Picklist', 'Multi-Picklist', 'Radio Button'].includes(currentField.dataType)" class="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{ currentField.dataType === 'Multi-Picklist' ? t('settings.modFieldsPicklistOptionsMulti') : currentField.dataType === 'Radio Button' ? t('settings.modFieldsPicklistOptionsRadio') : t('settings.modFieldsPicklistOptions') }}
                  </label>
                  <button
                    v-if="!isSystemField(currentField) && !isDealPipelineOrStageField(currentField) && !isPeopleTypesTabPicklistField(currentField)"
                    @click="showAddOption = true"
                    class="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700"
                  >
                    {{ t('settings.modFieldsAddOption') }}
                  </button>
                </div>
                <!-- Deal Stage / Pipeline: options are configured in Pipelines & Stages -->
                <div v-if="isDealPipelineOrStageField(currentField)" class="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
                  <p class="text-sm text-blue-800 dark:text-blue-300 mb-3">
                    {{ t('settings.modFieldsPipelineStageHint', { section: t('settings.modFieldsPipelinesStagesSection') }) }}
                  </p>
                  <button
                    type="button"
                    @click="navigateToPipelines"
                    class="px-3 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                  >
                    Open Pipelines & Stages
                  </button>
                </div>
                <!-- People participation role picklists: single source of truth = Types tab (tenant peopleTypes per app) -->
                <div
                  v-else-if="peopleTypesTabFieldInfo"
                  class="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3"
                >
                  <p class="text-sm text-blue-800 dark:text-blue-300 mb-2">
                    {{ t('settings.modFieldsPeopleTypesPicklistHint', { article: peopleTypesTabFieldInfo.article, scope: peopleTypesTabFieldInfo.scopeLabel, typesTab: t('settings.modFieldsTypesTab') }) }}
                  </p>
                  <button
                    v-if="!excludedTabs?.includes('people-types')"
                    type="button"
                    @click="navigateToPeopleTypes(peopleTypesTabFieldInfo.appKey)"
                    class="px-3 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors mb-3"
                  >
                    {{ t('settings.modFieldsOpenTypes') }}
                  </button>
                  <p class="text-xs font-medium text-blue-900 dark:text-blue-200 mb-2">{{ t('settings.modFieldsCurrentOptionsReadOnly') }}</p>
                  <div v-if="!normalizedOptions.length" class="text-xs text-blue-800/80 dark:text-blue-300/80">{{ t('settings.modFieldsNoTypesLoaded') }}</div>
                  <ul v-else class="space-y-2">
                    <li
                      v-for="(opt, oi) in normalizedOptions"
                      :key="`${getOptionValue(opt) || oi}`"
                      class="flex items-center gap-3 text-sm text-blue-900 dark:text-blue-100"
                    >
                      <span
                        class="w-3 h-3 rounded-full shrink-0 border border-blue-300/50 dark:border-blue-600/50"
                        :style="{ backgroundColor: getOptionColor(opt) }"
                      />
                      <span class="font-medium">{{ getOptionDisplayLabel(opt) }}</span>
                    </li>
                  </ul>
                </div>
                <template v-else>
                <div v-if="isTaskStatusField(currentField)" class="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-900/20">
                  <p class="text-xs text-amber-800 dark:text-amber-300">
                    <strong>{{ t('settings.modFieldsNoteLabel') }}</strong> {{ t('settings.modFieldsTaskStatusNote') }}
                  </p>
                </div>
                <div v-if="!currentField.options || currentField.options.length === 0" class="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 rounded-lg p-4 text-center">
                  {{ t('settings.modFieldsNoOptionsDefined') }}
                </div>
                <div v-else class="space-y-2">
                  <div
                    v-for="(option, optIdx) in normalizedOptions"
                    :key="(getOptionValue(option) || optIdx)"
                    class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded border border-gray-200 dark:border-white/10"
                    :class="dragOptionOverIdx === optIdx ? 'ring-2 ring-indigo-500 dark:ring-indigo-400' : ''"
                    :draggable="!isOptionSystemLocked(option) && !isSystemField(currentField)"
                    @dragstart="onOptionDragStart($event, optIdx)"
                    @dragover.prevent="onOptionDragOver(optIdx)"
                    @drop.prevent="onOptionDrop(optIdx)"
                    @dragend="onOptionDragEnd"
                  >
                    <!-- Drag handle or lock (status completed) -->
                    <div v-if="isOptionSystemLocked(option)" class="text-gray-400 dark:text-gray-500" :title="t('settings.modFieldsTitleSystemLocked')">🔒</div>
                    <div v-else class="cursor-grab select-none text-gray-400 dark:text-gray-500" :title="t('settings.modFieldsTitleDragReorder')">⋮⋮</div>
                    <!-- Color Picker -->
                    <label class="inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{{ t('settings.modFieldsColor') }}</span>
                      <input
                        type="color"
                        :value="getOptionColor(option)"
                        @input="updateOptionColor(optIdx, $event.target.value)"
                        class="h-7 w-9 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800"
                        :aria-label="t('settings.modFieldsColorForOption', { label: getOptionDisplayLabel(option) })"
                      />
                    </label>
                    <!-- Option Value / Inline Edit -->
                    <div class="flex-1 min-w-0">
                      <input
                        v-if="editingOptionIdx === optIdx && !isOptionSystemLocked(option)"
                        v-model="editOptionValue"
                        @blur="saveOptionEdit(optIdx)"
                        @keyup.enter="saveOptionEdit(optIdx)"
                        @keyup.esc="cancelOptionEdit(optIdx)"
                        class="w-full px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        autofocus
                      />
                      <span v-else class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ getOptionDisplayLabel(option) }}
                        <span v-if="isOptionSystemLocked(option)" class="ml-2 px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">{{ t('settings.modFieldsSystemLocked') }}</span>
                      </span>
                    </div>
                    <!-- Color Preview Badge -->
                    <div class="px-3 py-1 rounded-full text-xs font-medium text-white" :style="{ backgroundColor: getOptionColor(option) }">
                      {{ getOptionDisplayLabel(option) }}
                    </div>
                    <!-- Edit / Remove -->
                    <button v-if="!isOptionSystemLocked(option)" @click="editingOptionIdx === optIdx ? saveOptionEdit(optIdx) : startOptionEdit(optIdx)" class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded" :title="editingOptionIdx === optIdx ? t('actions.save') : t('settings.modFieldsRename')">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <!-- Enabled Toggle (status/priority) - before delete -->
                    <HeadlessSwitch
                      v-if="isTaskLifecycleField(currentField) && !isOptionSystemLocked(option)"
                      :checked="option.enabled !== false"
                      @change="updateOptionEnabled(optIdx, $event.target.checked)"
                      switch-class="w-9 h-5"
                    />
                    <button v-if="!isOptionSystemLocked(option) && !(isTaskPriorityField(currentField) && currentField.options.length <= 1)" @click="removeOption(optIdx)" class="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 rounded" :title="t('actions.remove')">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
                <!-- Add Option Modal -->
                <div v-if="showAddOption && !isSystemField(currentField)" class="fixed inset-0 z-50 flex items-center justify-center">
                  <div class="absolute inset-0 bg-black/50" @click="showAddOption = false"></div>
                  <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4">
                    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
                      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('settings.modFieldsAddOptionModal') }}</h3>
                    </div>
                    <div class="p-4 space-y-4">
                      <div>
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsOptionValue') }}</label>
                        <input v-model="newOptionValue" @keyup.enter="addOption" :placeholder="t('settings.modFieldsEnterOptionValuePh')" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                      </div>
                      <div>
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsColor') }}</label>
                        <div class="flex items-center gap-3">
                          <input 
                            type="color" 
                            v-model="newOptionColor" 
                            class="w-16 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                          />
                          <input 
                            type="text" 
                            v-model="newOptionColor" 
                            :placeholder="t('settings.modFieldsColorHexPh')" 
                            class="flex-1 px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm font-mono"
                            pattern="^#[0-9A-Fa-f]{6}$"
                          />
                          <!-- Preview -->
                          <div 
                            class="px-3 py-1 rounded-full text-xs font-medium text-white"
                            :style="{ backgroundColor: newOptionColor }"
                          >
                            {{ t('settings.modFieldsPreview') }}
                          </div>
                        </div>
                      </div>
                      <div class="flex justify-end gap-2">
                        <button @click="showAddOption = false" class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded">{{ t('actions.cancel') }}</button>
                        <button @click="addOption" class="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">{{ t('actions.add') }}</button>
                      </div>
                    </div>
                  </div>
                </div>
                </template>
              </div>

              <!-- Number Options (for Integer, Decimal, Currency) -->
              <div v-if="['Integer', 'Decimal', 'Currency'].includes(currentField.dataType) && !isSystemField(currentField)" class="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{{ t('settings.modFieldsNumberSettings') }}</label>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsMinValue') }}</label>
                    <input type="number" v-model.number="numberSettings.min" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsMaxValue') }}</label>
                    <input type="number" v-model.number="numberSettings.max" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                  </div>
                  <div v-if="currentField.dataType === 'Decimal' || currentField.dataType === 'Currency'">
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsDecimalPlaces') }}</label>
                    <input type="number" min="0" max="10" v-model.number="numberSettings.decimalPlaces" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                  </div>
                  <div v-if="currentField.dataType === 'Currency'">
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsCurrencyFormat') }}</label>
                    <HeadlessSelect
                      v-model="numberSettings.currencyCode"
                      :options="currencySelectOptions"
                      teleport
                      :teleport-match-width="true"
                      button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                    />
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {{ t('settings.modFieldsCurrencyPreview', { preview: getCurrencyFormatPreview() }) }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Text Options (for Text, Text-Area) -->
              <div v-if="['Text', 'Text-Area'].includes(currentField.dataType) && !isSystemField(currentField)" class="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{{ t('settings.modFieldsTextSettings') }}</label>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsMaxLength') }}</label>
                    <input type="number" min="1" v-model.number="textSettings.maxLength" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                  </div>
                  <div v-if="currentField.dataType === 'Text-Area'">
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsRows') }}</label>
                    <input type="number" min="1" max="20" v-model.number="textSettings.rows" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                  </div>
                </div>
              </div>

              <!-- Date Options -->
              <div v-if="['Date', 'Date-Time'].includes(currentField.dataType) && !isSystemField(currentField)" class="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{{ t('settings.modFieldsDateSettings') }}</label>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsDateFormat') }}</label>
                    <HeadlessSelect
                      v-model="dateSettings.format"
                      :options="dateFormatSelectOptions"
                      teleport
                      :teleport-match-width="true"
                      button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                    />
                  </div>
                  <div v-if="currentField.dataType === 'Date-Time'">
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsTimeFormat') }}</label>
                    <HeadlessSelect
                      v-model="dateSettings.timeFormat"
                      :options="timeFormatSelectOptions"
                      teleport
                      button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                    />
                  </div>
                </div>
              </div>

              <!-- Formula Options -->
              <div v-if="currentField.dataType === 'Formula' && !isSystemField(currentField)" class="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{{ t('settings.modFieldsFormulaConfig') }}</label>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsFormulaExpression') }}</label>
                  <textarea v-model="formulaSettings.expression" rows="4" :placeholder="t('settings.modFieldsFormulaExpressionPh')" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 font-mono text-sm"></textarea>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsFormulaExpressionHelp') }}</p>
                </div>
                <div class="mt-3">
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsReturnType') }}</label>
                  <HeadlessSelect
                    v-model="formulaSettings.returnType"
                    :options="formulaReturnTypeSelectOptions"
                    teleport
                    button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                  />
                </div>
              </div>

              <!-- Lookup Options -->
              <div v-if="currentField.dataType === 'Lookup (Relationship)' && !isSystemField(currentField)" class="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{{ t('settings.modFieldsLookupConfig') }}</label>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsTargetModule') }}</label>
                    <HeadlessSelect
                      v-model="lookupSettings.targetModule"
                      :options="lookupModuleSelectOptions"
                      :placeholder="t('settings.modFieldsSelectModulePh')"
                      allow-empty
                      :empty-label="t('settings.modFieldsSelectModulePh')"
                      empty-value=""
                      teleport
                      :teleport-match-width="true"
                      :truncate-options="false"
                      button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsDisplayField') }}</label>
                    <HeadlessSelect
                      v-model="lookupSettings.displayField"
                      :options="lookupDisplayFieldSelectOptions"
                      :placeholder="t('settings.modFieldsDisplayFieldAuto')"
                      allow-empty
                      :empty-label="t('settings.modFieldsDisplayFieldAuto')"
                      empty-value=""
                      teleport
                      :teleport-match-width="true"
                      button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div v-if="activeSubTab === 'validations'" class="space-y-3">
              <!-- Participation field info message -->
              <div v-if="(isPeopleModule || isOrganizationsModule) && currentField?.key && (isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.owner === 'participation'" class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div class="flex items-start gap-3">
                  <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p class="text-sm text-blue-800 dark:text-blue-300">
                      {{ t('settings.modFieldsValidationParticipation') }}
                    </p>
                  </div>
                </div>
              </div>
              
              <!-- Events module: App participation fields info -->
              <!-- 
                ARCHITECTURE NOTE: Events app participation fields are visibility-configurable ONLY.
                Required state is controlled by event type, not by Settings.
                See: docs/architecture/event-settings.md Section 4.2
              -->
              <div v-if="isEventsModule && currentField?.key && isEventsAppParticipationField(currentField.key)" class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div class="flex items-start gap-3">
                  <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p class="text-sm text-blue-800 dark:text-blue-300">
                      {{ t('settings.modFieldsValidationEventsParticipation') }}
                    </p>
                  </div>
                </div>
              </div>
              
              <div v-if="currentField.dataType === 'Phone'" class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div class="flex items-start gap-3">
                  <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p class="text-sm font-medium text-blue-900 dark:text-blue-200">
                      {{ t('settings.modFieldsPhoneValidationTitle') }}
                    </p>
                    <p class="mt-1 text-sm text-blue-800 dark:text-blue-300">
                      {{ t('settings.modFieldsPhoneValidationBody') }}
                    </p>
                  </div>
                </div>
              </div>

              <div v-else>
                <!-- Empty State -->
                <div v-if="!currentField.validations || currentField.validations.length === 0" class="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.modFieldsNoValidationRules') }}</h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md mb-6">
                    {{ t('settings.modFieldsNoValidationRulesBody') }}
                  </p>
                  <button 
                    @click="addValidation" 
                    :disabled="((isPeopleModule || isOrganizationsModule) && currentField?.key && (isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.owner === 'participation') || (isEventsModule && currentField?.key && isEventsAppParticipationField(currentField.key))"
                    :class="[
                      'px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                      (((isPeopleModule || isOrganizationsModule) && currentField?.key && (isPeopleModule ? getPeopleFieldMetadata(currentField.key) : getOrganizationFieldMetadata(currentField.key))?.owner === 'participation') || (isEventsModule && currentField?.key && isEventsAppParticipationField(currentField.key))) ? 'opacity-50 cursor-not-allowed' : ''
                    ]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    {{ t('settings.modFieldsAddCondition') }}
                  </button>
                </div>

                <!-- Validation List -->
                <div v-else>
                  <div class="space-y-3">
                    <div v-for="(v, vi) in currentField.validations" :key="vi" class="relative border border-gray-200 dark:border-white/10 rounded-lg p-3 space-y-2">
                      <!-- Delete button in top right corner -->
                      <button 
                        @click="removeValidation(vi)" 
                        :disabled="isValidationDisabled()"
                        :class="[
                          'absolute -top-2 -right-2 p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all hover:scale-110 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-white/10 shadow-sm',
                          isValidationDisabled() ? 'opacity-50 cursor-not-allowed hover:text-gray-400 hover:bg-gray-50' : ''
                        ]"
                        :title="t('settings.modFieldsTitleRemoveValidation')"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsValidationName') }}</label>
                          <input 
                            v-model="v.name" 
                            :placeholder="t('settings.modFieldsValidationNamePh')" 
                            :disabled="isValidationDisabled()"
                            class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed" 
                          />
                        </div>
                        <div>
                          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsType') }}</label>
                          <HeadlessSelect
                            v-model="v.type"
                            :options="validationTypeSelectOptions"
                            :disabled="isValidationDisabled()"
                            teleport
                            :teleport-match-width="true"
                            button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                          />
                        </div>
                      </div>

                      <!-- Type-specific fields -->
                      <div v-if="v.type === 'regex'">
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsPattern') }}</label>
                        <input 
                          v-model="v.pattern" 
                          :placeholder="t('settings.modFieldsRegexPatternPh')" 
                          :disabled="isValidationDisabled()"
                          class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed" 
                        />
                      </div>

                      <div v-else-if="v.type === 'length'" class="grid grid-cols-2 gap-3">
                        <div>
                          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsMinLength') }}</label>
                          <input 
                            type="number" 
                            min="0" 
                            v-model.number="v.minLength" 
                            :disabled="isValidationDisabled()"
                            class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed" 
                          />
                        </div>
                        <div>
                          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsMaxLengthShort') }}</label>
                          <input 
                            type="number" 
                            min="0" 
                            v-model.number="v.maxLength" 
                            :disabled="isValidationDisabled()"
                            class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed" 
                          />
                        </div>
                      </div>

                      <div v-else-if="v.type === 'range'" class="grid grid-cols-2 gap-3">
                        <div>
                          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsMin') }}</label>
                          <input 
                            type="number" 
                            v-model.number="v.min" 
                            :disabled="isValidationDisabled()"
                            class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed" 
                          />
                        </div>
                        <div>
                          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsMax') }}</label>
                          <input 
                            type="number" 
                            v-model.number="v.max" 
                            :disabled="isValidationDisabled()"
                            class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed" 
                          />
                        </div>
                      </div>

                      <div v-else-if="v.type === 'picklist_single'">
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsAllowedValues') }}</label>
                        <input 
                          v-model="allowedValuesBuffers[vi]" 
                          @change="applyAllowedValues(vi)" 
                          :placeholder="t('settings.modFieldsAllowedValuesPh')" 
                          :disabled="isValidationDisabled()"
                          class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed" 
                        />
                      </div>

                      <div v-else-if="v.type === 'picklist_multi'">
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsAllowedValues') }}</label>
                        <input 
                          v-model="allowedValuesBuffers[vi]" 
                          @change="applyAllowedValues(vi)" 
                          :placeholder="t('settings.modFieldsAllowedValuesPh')" 
                          :disabled="isValidationDisabled()"
                          class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed" 
                        />
                      </div>

                      <!-- Email has no extra inputs -->

                      <div>
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsErrorMessage') }}</label>
                        <input 
                          v-model="v.message" 
                          :placeholder="t('settings.modFieldsErrorMessagePh')" 
                          :disabled="isValidationDisabled()"
                          class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed" 
                        />
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 flex-wrap mt-4">
                    <button 
                      @click="addValidation" 
                      :disabled="isValidationDisabled()"
                      :class="[
                        'px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm hover:shadow-md',
                        isValidationDisabled() ? 'opacity-50 cursor-not-allowed' : ''
                      ]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                      {{ t('settings.modFieldsAddCustomValidation') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="activeSubTab === 'dependencies'">
              <div class="space-y-6">
                <!-- Section 1: Field Rules (Existing Field Dependencies) -->
                <div>
                  <div class="mb-4">
                    <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-1">{{ t('settings.modFieldsFieldRules') }}</h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      {{ t('settings.modFieldsFieldRulesHelp') }}
                    </p>
                  </div>

                  <!-- Empty State -->
                  <div v-if="getFieldRules().length === 0" class="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.modFieldsNoFieldRules') }}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md mb-6">
                      {{ t('settings.modFieldsNoFieldRulesBody') }}
                    </p>
                    <button @click="addDependency" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-md">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                      {{ t('settings.modFieldsAddFieldRule') }}
                    </button>
                  </div>

                  <!-- Dependencies List -->
                  <div v-else>
                    <div class="space-y-3">
                      <div v-for="(d, di) in getFieldRules()" :key="di" class="relative border border-gray-200 dark:border-white/10 rounded-lg p-3 space-y-3">
                      <!-- Delete button in top right corner -->
                      <button 
                        @click="removeDependency(di)" 
                        class="absolute -top-2 -right-2 p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all hover:scale-110 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-white/10 shadow-sm"
                        :title="t('settings.modFieldsTitleRemoveDependency')"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>

                      <!-- Dependency Name and Type in one row -->
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsDependencyName') }}</label>
                          <input v-model="d.name" :placeholder="t('settings.modFieldsDependencyNamePh')" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm" />
                        </div>
                        <div>
                          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsDependencyType') }}</label>
                          <HeadlessSelect
                            v-model="d.type"
                            :options="dependencyTypeSelectOptions"
                            :placeholder="t('settings.modFieldsDependencyType')"
                            teleport
                            :teleport-match-width="true"
                            button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                          />
                        </div>
                      </div>

                      <!-- Logic for multiple conditions (show when 2+ conditions or always for clarity) -->
                      <div v-if="getConditionCount(d) > 1">
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsLogic') }}</label>
                        <HeadlessSelect
                          v-model="d.logic"
                          :options="dependencyLogicSelectOptions"
                          :truncate-button-label="false"
                          teleport
                          button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                        />
                      </div>

                      <!-- Conditions list - always show conditions array mode -->
                      <div class="space-y-2">
                        <div class="flex items-center justify-between mb-2">
                          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('settings.modFieldsConditions') }}</label>
                          <button @click="addDependencyCondition(di)" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm hover:shadow-md">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                            </svg>
                            {{ t('settings.modFieldsAddCondition') }}
                          </button>
                        </div>
                        
                        <!-- Show message if no conditions -->
                        <div v-if="getConditionCount(d) === 0" class="text-xs text-gray-500 dark:text-gray-400 py-4 px-3 bg-gray-50 dark:bg-white/5 rounded border border-dashed border-gray-300 dark:border-gray-600 text-center">
                          {{ t('settings.modFieldsNoConditions') }}
                        </div>
                        
                        <!-- Conditions -->
                        <div v-for="(c, ci) in getDependencyConditions(d)" :key="ci" class="border border-gray-200 dark:border-white/10 rounded-lg p-3 bg-gray-50/50 dark:bg-white/5">
                          <!-- Field, Operator, Value in same row -->
                          <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            <div class="md:col-span-5">
                              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsField') }}</label>
                              <HeadlessSelect
                                v-model="c.fieldKey"
                                :options="dependencyControllingFieldOptions"
                                :placeholder="t('settings.modFieldsSelectFieldPh')"
                                allow-empty
                                :empty-label="t('settings.modFieldsSelectFieldPh')"
                                empty-value=""
                                teleport
                                :teleport-match-width="true"
                                :truncate-options="false"
                                button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                              />
                            </div>
                            <div class="md:col-span-3">
                              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsOperator') }}</label>
                              <HeadlessSelect
                                v-model="c.operator"
                                :options="dependencyOperatorSelectOptions"
                                teleport
                                :teleport-match-width="true"
                                button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                                @update:model-value="onDependencyOperatorChange(di, ci)"
                              />
                            </div>
                            <div class="md:col-span-3">
                              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsValue') }}</label>
                              <!-- Multi-select for Picklist with 'in' or 'not_in' operators -->
                              <div v-if="(getDependencyFieldType(c.fieldKey) === 'Picklist' || getDependencyFieldType(c.fieldKey) === 'Multi-Picklist') && (c.operator === 'in' || c.operator === 'not_in')" class="relative dependency-dropdown-container">
                                <input
                                  type="text"
                                  :value="getDependencySearchTerm(di, ci)"
                                  @input="setDependencySearchTerm(di, ci, $event.target.value)"
                                  @focus="setDependencyDropdownOpen(di, ci, true)"
                                  @keydown.escape="setDependencyDropdownOpen(di, ci, false)"
                                  :placeholder="t('settings.modFieldsSearchSelectValuesPh')"
                                  class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                
                                <!-- Dropdown -->
                                <div
                                  v-if="isDependencyDropdownOpen(di, ci)"
                                  class="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-lg shadow-lg max-h-64 overflow-hidden flex flex-col"
                                  @click.stop
                                >
                                  <!-- Search results header -->
                                  <div class="p-2 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                                    <span class="text-xs text-gray-600 dark:text-gray-400">
                                      {{ dependencyOptionCountLabel(getFilteredDependencyOptions(di, ci).length) }}
                                    </span>
                                    <div class="flex items-center gap-2">
                                      <button
                                        @click="selectAllDependencyValues(di, ci)"
                                        class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                                        type="button"
                                      >
                                        {{ t('settings.modFieldsSelectAll') }}
                                      </button>
                                      <button
                                        @click="deselectAllDependencyValues(di, ci)"
                                        class="text-xs text-gray-600 dark:text-gray-400 hover:underline"
                                        type="button"
                                      >
                                        {{ t('settings.modFieldsClear') }}
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <!-- Options list -->
                                  <div class="overflow-y-auto max-h-56">
                                    <div
                                      v-for="opt in getFilteredDependencyOptions(di, ci)"
                                      :key="opt"
                                      @click="toggleDependencyValue(di, ci, opt)"
                                      class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                                    >
                                      <HeadlessCheckbox
                                        :checked="isDependencyValueSelected(di, ci, opt)"
                                        @change="toggleDependencyValue(di, ci, opt)"
                                        @click.stop
                                        checkbox-class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 pointer-events-none"
                                      />
                                      <span class="text-sm text-gray-700 dark:text-gray-300 flex-1">{{ opt }}</span>
                                    </div>
                                    <div v-if="getFilteredDependencyOptions(di, ci).length === 0" class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                                      {{ t('settings.modFieldsNoOptionsFound') }}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <!-- Single-select Picklist dropdown (for non-in/not_in operators) -->
                              <HeadlessSelect
                                v-else-if="getDependencyFieldType(c.fieldKey) === 'Picklist' || getDependencyFieldType(c.fieldKey) === 'Multi-Picklist'"
                                v-model="c.value"
                                :options="dependencyPicklistValueOptions(c.fieldKey)"
                                :placeholder="t('settings.modFieldsSelectOptionPh')"
                                allow-empty
                                :empty-label="t('settings.modFieldsSelectOptionPh')"
                                empty-value=""
                                teleport
                                :teleport-match-width="true"
                                button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                              />
                              <!-- Checkbox -->
                              <HeadlessSelect
                                v-else-if="getDependencyFieldType(c.fieldKey) === 'Checkbox'"
                                v-model="c.value"
                                :options="dependencyCheckboxValueOptions"
                                :placeholder="t('settings.modFieldsSelectValuePh')"
                                allow-empty
                                :empty-label="t('settings.modFieldsSelectValuePh')"
                                empty-value=""
                                teleport
                                button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                              />
                              <!-- Date -->
                              <DatePicker v-else-if="getDependencyFieldType(c.fieldKey) === 'Date'" v-model="c.value" input-class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                              <!-- Date-Time -->
                              <DateTimePicker v-else-if="getDependencyFieldType(c.fieldKey) === 'Date-Time'" v-model="c.value" input-class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                              <!-- Number fields -->
                              <input v-else-if="['Integer', 'Decimal', 'Currency'].includes(getDependencyFieldType(c.fieldKey))" type="number" v-model.number="c.value" :placeholder="t('settings.modFieldsNumberPh')" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm" />
                              <!-- Text input for 'in' or 'not_in' operators (for non-picklist fields) -->
                              <input v-else-if="c.operator === 'in' || c.operator === 'not_in'" v-model="dependencyConditionBuffers[di + '-' + ci]" :placeholder="t('settings.modFieldsListValuesPh')" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm" @change="applyDependencyConditionValue(di, ci)" />
                              <!-- Comparison operators need numbers -->
                              <input v-else-if="['gt', 'lt', 'gte', 'lte'].includes(c.operator)" type="number" v-model.number="c.value" :placeholder="t('settings.modFieldsNumberPh')" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm" />
                              <!-- Exists operator -->
                              <input v-else-if="c.operator === 'exists'" type="text" disabled :value="t('settings.modFieldsExistsCheck')" class="w-full px-3 py-2 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm cursor-not-allowed" />
                              <!-- Default text input -->
                              <input v-else v-model="c.value" :placeholder="t('settings.modFieldsValue')" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm" />
                            </div>
                            <button @click="removeDependencyCondition(di, ci)" class="md:col-span-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm transition-colors flex items-center justify-center" :title="t('settings.modFieldsTitleRemoveCondition')">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          
                          <!-- Selected values display (below the row for multi-select) -->
                          <div v-if="(getDependencyFieldType(c.fieldKey) === 'Picklist' || getDependencyFieldType(c.fieldKey) === 'Multi-Picklist') && (c.operator === 'in' || c.operator === 'not_in') && getSelectedDependencyValues(di, ci).length > 0" class="mt-3 pt-3 border-t border-gray-200 dark:border-white/10 flex items-center gap-3 flex-wrap">
                            <div class="flex flex-wrap gap-1.5">
                              <span
                                v-for="(val, idx) in getSelectedDependencyValues(di, ci)"
                                :key="idx"
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium"
                              >
                                <span>{{ val }}</span>
                                <button
                                  @click="toggleDependencyValue(di, ci, val)"
                                  class="hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-full p-0.5 transition-colors"
                                  type="button"
                                  :title="t('actions.remove')"
                                >
                                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </span>
                            </div>
                            <p class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {{ t('settings.modFieldsSelectedCount', { selected: getSelectedDependencyValues(di, ci).length, total: getDependencyFieldOptions(c.fieldKey).length }) }}
                            </p>
                          </div>
                        </div>
                      </div>

                      <!-- Picklist-specific settings -->
                      <div v-if="d.type === 'picklist' && (currentField.dataType === 'Picklist' || currentField.dataType === 'Multi-Picklist')" class="border-t border-gray-200 dark:border-white/10 pt-3">
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-2">{{ t('settings.modFieldsPicklistOptionsToShow') }}</label>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                          {{ t('settings.modFieldsPicklistOptionsToShowHelp') }}
                        </p>
                        <div v-if="!currentField.options || currentField.options.length === 0" class="text-xs text-gray-500 dark:text-gray-400 py-2">
                          {{ t('settings.modFieldsNoPicklistOptionsForDep') }}
                        </div>
                        <div v-else class="space-y-2">
                          <div v-for="(option, optIdx) in getPicklistOptions(currentField)" :key="optIdx" class="flex items-center gap-2">
                            <label class="text-sm text-gray-700 dark:text-gray-300 cursor-pointer flex items-center gap-2">
                              <HeadlessCheckbox
                                :checked="isPicklistOptionSelected(di, option)"
                                @change="togglePicklistOption(di, option)"
                                checkbox-class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span v-if="typeof option === 'object' && option.color" class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: option.color }"></span>
                              <span>{{ normalizePicklistOption(option) }}</span>
                            </label>
                          </div>
                        </div>
                      </div>
                      <div v-else-if="d.type === 'picklist'" class="border-t border-gray-200 dark:border-white/10 pt-3">
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                          {{ t('settings.modFieldsPicklistFilterTypeOnly') }}
                        </p>
                      </div>

                      <!-- Popup-specific settings -->
                      <div v-if="d.type === 'popup'" class="border-t border-gray-200 dark:border-white/10 pt-3">
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-2">{{ t('settings.modFieldsPopupFields') }}</label>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                          {{ t('settings.modFieldsPopupFieldsHelp') }}
                        </p>
                        <div v-if="!editFields || editFields.length === 0" class="text-xs text-gray-500 dark:text-gray-400 py-2">
                          {{ t('settings.modFieldsNoFieldsForPopup') }}
                        </div>
                        <div v-else class="space-y-2 max-h-60 overflow-y-auto">
                          <div v-for="f in editFields" :key="f.key" class="flex items-center gap-2">
                            <label class="text-sm text-gray-700 dark:text-gray-300 cursor-pointer flex items-center gap-2">
                              <HeadlessCheckbox
                                :checked="isPopupFieldSelected(di, f.key)"
                                @change="togglePopupField(di, f.key)"
                                checkbox-class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span>{{ f.label || f.key }}</span>
                              <span class="text-xs text-gray-500 dark:text-gray-400">({{ f.dataType }})</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <!-- Label override settings -->
                      <div v-if="d.type === 'label'" class="border-t border-gray-200 dark:border-white/10 pt-3">
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-2">{{ t('settings.modFieldsLabelToDisplay') }}</label>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                          {{ t('settings.modFieldsLabelOverrideHelp') }}
                        </p>
                        <input
                          v-model="d.labelValue"
                          :placeholder="t('settings.modFieldsLabelOverridePh')"
                          class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 flex-wrap mt-4">
                    <button @click="addDependency" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-md">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                      {{ t('settings.modFieldsAddFieldRule') }}
                    </button>
                  </div>
                </div>
                </div>

                <!-- Section 2: Picklist Value Rules (Only for Picklist/Multi-Picklist fields) -->
                <div v-if="currentField.dataType === 'Picklist' || currentField.dataType === 'Multi-Picklist'" class="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                  <div class="mb-4">
                    <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-1">{{ t('settings.modFieldsPicklistValueRules') }}</h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      {{ t('settings.modFieldsPicklistValueRulesHelp') }}
                    </p>
                  </div>

                  <!-- Empty State for Picklist Value Rules -->
                  <div v-if="getPicklistValueRules().length === 0" class="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.modFieldsNoPicklistValueRules') }}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md mb-6">
                      {{ t('settings.modFieldsNoPicklistValueRulesBody') }}
                    </p>
                    <button @click="addPicklistValueRule" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-md">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                      {{ t('settings.modFieldsAddPicklistValueRule') }}
                    </button>
                  </div>
                  <div v-else class="space-y-4">
                    <div v-for="(rule, ruleIdx) in getPicklistValueRules()" :key="ruleIdx" class="relative border border-gray-200 dark:border-white/10 rounded-lg p-4 space-y-4">
                      <!-- Delete button -->
                      <button 
                        @click="removePicklistValueRule(ruleIdx)" 
                        class="absolute -top-2 -right-2 p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all hover:scale-110 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-white/10 shadow-sm"
                        :title="t('settings.modFieldsTitleRemoveRule')"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>

                      <!-- Parent Field Selection -->
                      <div>
                        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {{ t('settings.modFieldsParentField') }} <span class="text-red-500">*</span>
                        </label>
                        <HeadlessSelect
                          v-model="rule.parentFieldKey"
                          :options="picklistValueParentFieldOptions"
                          :placeholder="t('settings.modFieldsSelectPicklistFieldPh')"
                          allow-empty
                          :empty-label="t('settings.modFieldsSelectPicklistFieldPh')"
                          empty-value=""
                          teleport
                          :teleport-match-width="true"
                          :truncate-options="false"
                          button-class="!py-2 !rounded-lg !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                        />
                        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {{ t('settings.modFieldsParentFieldHelp') }}
                        </p>
                      </div>

                      <!-- Value Mapping Table -->
                      <div v-if="rule.parentFieldKey">
                        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {{ t('settings.modFieldsValueMapping') }}
                        </label>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                          {{ t('settings.modFieldsValueMappingHelp') }}
                        </p>
                        
                        <div class="space-y-3">
                          <div 
                            v-for="(mapping, mapIdx) in rule.mappings || []" 
                            :key="mapIdx"
                            class="grid grid-cols-1 md:grid-cols-12 gap-3 items-start border border-gray-200 dark:border-white/10 rounded-lg p-3 bg-gray-50/50 dark:bg-white/5"
                          >
                            <!-- Parent Value -->
                            <div class="md:col-span-4">
                              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsParentValue') }}</label>
                              <HeadlessSelect
                                v-model="mapping.parentValue"
                                :options="dependencyPicklistValueOptions(rule.parentFieldKey)"
                                :placeholder="t('settings.modFieldsSelectValueEllipsisPh')"
                                allow-empty
                                :empty-label="t('settings.modFieldsSelectValueEllipsisPh')"
                                empty-value=""
                                teleport
                                :teleport-match-width="true"
                                button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                              />
                            </div>
                            
                            <!-- Arrow -->
                            <div class="md:col-span-1 flex items-center justify-center pt-6">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5 text-gray-400">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </div>
                            
                            <!-- Allowed Child Values -->
                            <div class="md:col-span-6">
                              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsAllowedOptions') }}</label>
                              <div class="space-y-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-white/10 rounded-lg p-2 bg-white dark:bg-gray-800">
                                <div v-if="!currentField.options || currentField.options.length === 0" class="text-xs text-gray-500 dark:text-gray-400 py-2 text-center">
                                  {{ t('settings.modFieldsNoOptionsAvailable') }}
                                </div>
                                <label 
                                  v-for="(option, optIdx) in getPicklistOptions(currentField)" 
                                  :key="optIdx"
                                  class="flex items-center gap-2 p-1.5 hover:bg-gray-50 dark:hover:bg-white/5 rounded cursor-pointer"
                                >
                                  <HeadlessCheckbox
                                    :checked="isMappingOptionSelected(mapping, option)"
                                    @change="toggleMappingOption(mapping, option)"
                                    checkbox-class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span class="text-xs text-gray-700 dark:text-gray-300">{{ normalizePicklistOption(option) }}</span>
                                </label>
                              </div>
                            </div>
                            
                            <!-- Remove Mapping Button -->
                            <div class="md:col-span-1 flex items-center justify-center pt-6">
                              <button 
                                @click="removePicklistValueMapping(ruleIdx, mapIdx)"
                                class="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                                :title="t('settings.modFieldsTitleRemoveMapping')"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <button 
                            @click="addPicklistValueMapping(ruleIdx)"
                            class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-indigo-500 dark:hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                            </svg>
                            {{ t('settings.modFieldsAddValueMapping') }}
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Add Rule Button -->
                    <button 
                      @click="addPicklistValueRule"
                      class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-indigo-500 dark:hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                      {{ t('settings.modFieldsAddAnotherPicklistRule') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </section>
        </div>
      </div>

      <!-- Other tabs: Module details, Relationship, Quick Create -->
      <section v-else class="flex-1 min-w-0 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        <div class="flex-1 min-h-0 overflow-y-auto p-4" v-if="activeTopTab === 'details'">
          <!-- Platform Ownership Info Box (platform / core modules only) -->
          <div v-if="showPlatformOwnedCapabilityBanner(selectedModule)" class="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div class="flex items-start gap-3">
              <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 class="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">{{ t('settings.modFieldsPlatformOwnedTitle') }}</h3>
                <p class="text-sm text-blue-800 dark:text-blue-400">{{ t('settings.modFieldsPlatformOwnedBody') }}</p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsDisplayName') }}</label>
              <input v-model="moduleNameEdit" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsModuleKeyLabel') }}</label>
              <input :value="selectedModule.key" disabled class="w-full px-3 py-2 rounded bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsType') }}</label>
              <input :value="selectedModule.type" disabled class="w-full px-3 py-2 rounded bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400" />
            </div>
            <div class="flex items-center gap-2 mt-6">
              <HeadlessCheckbox id="mod-enabled" v-model="moduleEnabled" />
              <label for="mod-enabled" class="text-sm text-gray-700 dark:text-gray-300" @click="moduleEnabled = !moduleEnabled">{{ t('settings.modFieldsEnabled') }}</label>
            </div>
          </div>
          
          <!-- Forms Module Details Fields (read-only display) -->
          <div v-if="isFormsModule" class="mt-6">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">{{ t('settings.modFieldsFormModuleDetails') }}</h4>
            <div class="space-y-3">
              <div
                v-for="field in getFieldsForTab('moduleDetails')"
                :key="field.key"
                class="bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 rounded-lg p-3"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ field.label }}
                      </span>
                      <span
                        :class="[
                          'px-2 py-0.5 text-xs font-medium rounded',
                          field.editable
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        ]"
                      >
                        {{ field.editable ? t('settings.modFieldsEditable') : t('settings.modFieldsReadOnly') }}
                      </span>
                    </div>
                    <p v-if="field.notes" class="text-xs text-gray-500 dark:text-gray-400">
                      {{ field.notes }}
                    </p>
                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
                      {{ field.key }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Permission Matrix Section (Read-Only Explanation) -->
            <!-- 
              ARCHITECTURE NOTE: Permissions here are explanatory, not enforcement.
              Actual enforcement happens at API & surface level.
              This mirrors Event Execution permission design.
              See: client/src/platform/events/eventPermissions.utils.ts
              See: client/src/platform/forms/formSettingsPermissions.ts
            -->
            <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">{{ t('settings.modFieldsWhoCanConfigure') }}</h4>
              <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div class="mb-4">
                  <p class="text-xs text-gray-600 dark:text-gray-400 mb-2">{{ t('settings.modFieldsFormPermMatrixIntro') }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-500 italic">{{ t('settings.modFieldsFormPermMatrixEnforcement') }}</p>
                </div>
                <div class="space-y-3">
                  <div
                    v-for="permission in formSettingsPermissions"
                    :key="permission.action"
                    class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-sm font-medium text-gray-900 dark:text-white">
                          {{ getFormSettingsActionLabel(permission.action) }}
                        </span>
                        <span
                          :class="[
                            'px-2 py-0.5 text-xs font-medium rounded',
                            permission.allowed
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          ]"
                        >
                          {{ permission.allowed ? t('settings.modFieldsAllowed') : t('settings.modFieldsNotAllowed') }}
                        </span>
                      </div>
                      <p v-if="permission.reason" class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {{ permission.reason }}
                      </p>
                    </div>
                  </div>
                  <div v-if="formSettingsPermissions.length === 0" class="text-center py-4 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsNoPermissionInfo') }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Additional Details Content (for Core modules) -->
          <div v-if="$slots['details-extra']" class="mt-6">
            <slot name="details-extra" />
          </div>
        </div>

        <!-- Types Tab (Organizations): per-app participation roles -->
        <div class="flex-1 overflow-y-auto" v-else-if="activeTopTab === 'organization-types' && isOrganizationsModule">
          <OrganizationTypesSettings embedded />
        </div>

        <!-- Types Tab (People module): per-app participation roles -->
        <div class="flex-1 overflow-y-auto" v-else-if="activeTopTab === 'people-types' && isPeopleModule">
          <PeopleTypesSettings embedded />
        </div>

        <!-- Duplicate Prevention (People / Organizations / Items / Deals / Tasks / Cases) -->
        <div
          class="flex-1 overflow-y-auto"
          v-else-if="activeTopTab === 'duplicate-prevention' && (isPeopleModule || isOrganizationsModule || isItemsModule || isDealsModule || isTasksModule || isCasesModule)"
        >
          <DuplicatePreventionSettings
            :module-key="duplicatePreventionModuleKey"
            embedded
          />
        </div>

        <!-- Closed States (Closed Records–eligible modules) -->
        <div
          class="flex-1 overflow-y-auto p-6"
          v-else-if="activeTopTab === 'closed-states' && isClosedRecordsModule"
        >
          <ClosedRecordsSettings
            :initial-module="selectedModule?.key || ''"
            app-group="all"
            :hide-module-selector="true"
          />
        </div>

        <!-- Status & Priority Tab (Tasks module only) - Summary view, edit in Field Configurations -->
        <div class="flex-1 overflow-y-auto" v-else-if="activeTopTab === 'status-priority' && isTasksModule">
          <div class="p-6">
            <div class="mb-6">
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">{{ t('settings.modFieldsTasksStatusPriorityDesc') }}</p>
              <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p class="text-xs text-blue-800 dark:text-blue-400">
                  <strong>{{ t('settings.modFieldsNoteLabel') }}</strong>{{ t('settings.modFieldsTaskStatusNote') }}</p>
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div class="flex items-center justify-between mb-3">
                  <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.modFieldsStatusLabel') }}</h4>
                  <button @click="openTaskStatusPriorityLens" class="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">{{ t('settings.modFieldsEditInFieldConfig') }}</button>
                </div>
                <div class="flex flex-wrap gap-2">
                  <span v-for="opt in (getTaskPicklistFieldFromConfig('status')?.options || [])" :key="opt.value || opt" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white" :style="{ backgroundColor: (opt.color || '#6B7280') }">
                    {{ opt.label || opt.value || opt }}
                  </span>
                  <span v-if="!getTaskPicklistFieldFromConfig('status')?.options?.length" class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsNoOptionsDefinedShort') }}</span>
                </div>
              </div>
              <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div class="flex items-center justify-between mb-3">
                  <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.modFieldsPriorityLabel') }}</h4>
                  <button @click="openTaskPriorityInFieldConfig" class="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">{{ t('settings.modFieldsEditInFieldConfig') }}</button>
                </div>
                <div class="flex flex-wrap gap-2">
                  <span v-for="opt in (getTaskPicklistFieldFromConfig('priority')?.options || [])" :key="opt.value || opt" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white" :style="{ backgroundColor: (opt.color || '#6B7280') }">
                    {{ opt.label || opt.value || opt }}
                  </span>
                  <span v-if="!getTaskPicklistFieldFromConfig('priority')?.options?.length" class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsNoOptionsDefinedShort') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Status & Types Tab (Items module only) -->
        <div class="flex-1 overflow-y-auto" v-else-if="activeTopTab === 'status-types' && isItemsModule">
          <div class="p-6">
            <!-- Header -->
            <div class="mb-6">
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">{{ t('settings.modFieldsItemsStatusTypesDesc') }}</p>
            </div>

            <!-- Item Types Section -->
            <div class="mb-8">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-1">{{ t('settings.modFieldsItemTypesTitle') }}</h4>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsItemTypesDesc') }}</p>
                </div>
              </div>
              
              <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div v-if="itemTypes.length === 0" class="text-center py-8 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsLoadingItemTypes') }}</div>
                <div v-else class="space-y-3">
                  <div 
                    v-for="(type, index) in itemTypes" 
                    :key="`${type.value}-${index}`"
                    class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div class="flex items-center gap-3 flex-1">
                      <div class="cursor-grab select-none text-gray-400 dark:text-gray-500" :title="t('settings.modFieldsTitleDragReorder')">⋮⋮</div>
                      <div class="flex-1">
                        <div class="text-sm font-medium text-gray-900 dark:text-white">{{ type.label }}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ type.description || t('settings.modFieldsItemTypeDefaultDesc') }}</div>
                      </div>
                    </div>
                    <div class="flex items-center gap-3">
                      <HeadlessSwitch
                        :checked="type.enabled"
                        @change="setPicklistEnabled(type, $event)"
                        switch-class="w-9 h-5"
                      />
                    </div>
                  </div>
                  
                  <div class="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">{{ t('settings.modFieldsItemTypesFootnote') }}</div>
                </div>
              </div>
            </div>

            <!-- Status Picklist Section -->
            <div>
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-1">{{ t('settings.modFieldsStatusPicklistTitle') }}</h4>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsStatusPicklistDesc') }}</p>
                </div>
                <button
                  @click="addItemStatusValue"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>{{ t('settings.modFieldsAddStatus') }}</button>
              </div>
              
              <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div v-if="itemStatusPicklist.length === 0" class="text-center py-8 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsLoadingStatusValues') }}</div>
                <div v-else class="space-y-2">
                  <div
                    v-for="(status, index) in itemStatusPicklist"
                    :key="status.value || index"
                    class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg group"
                  >
                    <div class="cursor-grab select-none text-gray-400 dark:text-gray-500" :title="t('settings.modFieldsTitleDragReorder')">⋮⋮</div>
                    <div class="flex-1 min-w-0">
                      <input
                        v-if="status.editing"
                        v-model="status.editValue"
                        @blur="saveItemStatusValue(index)"
                        @keyup.enter="saveItemStatusValue(index)"
                        @keyup.esc="cancelItemStatusEdit(index)"
                        class="w-full px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        autofocus
                      />
                      <span v-else class="text-sm font-medium text-gray-900 dark:text-white">{{ status.label }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <HeadlessSwitch
                        :checked="status.enabled"
                        @change="setPicklistEnabled(status, $event)"
                        switch-class="w-9 h-5"
                      />
                      <button
                        @click="startItemStatusEdit(index)"
                        class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded"
                        :title="t('settings.modFieldsRename')"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        @click="removeItemStatusValue(index)"
                        class="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 transition-colors rounded"
                        :title="t('actions.remove')"
                        :disabled="itemStatusPicklist.length <= 1"
                        :class="itemStatusPicklist.length <= 1 ? 'opacity-50 cursor-not-allowed' : ''"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">{{ t('settings.modFieldsItemStatusFootnote') }}</div>
              </div>
            </div>

            <!-- Catalog Lifecycle (system contract — read-only in C0) -->
            <div class="mb-8">
              <div class="mb-4">
                <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-1">{{ t('settings.modFieldsCatalogLifecycleTitle') }}</h4>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsCatalogLifecycleDesc') }}</p>
              </div>

              <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div class="space-y-3">
                  <div
                    v-for="row in catalogLifecycleStateRows"
                    :key="row.state"
                    class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div class="flex-1">
                      <div class="text-sm font-medium text-gray-900 dark:text-white">{{ row.label }}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ row.description }}</div>
                    </div>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                      {{ t('settings.modFieldsCatalogLifecycleSystemBadge') }}
                    </span>
                  </div>
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  {{ t('settings.modFieldsCatalogLifecycleLockedBody') }}
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Status & Types Tab (Documents module) -->
        <div class="flex-1 overflow-y-auto" v-else-if="activeTopTab === 'status-types' && isDocumentsModule">
          <div class="p-6">
            <div class="mb-6">
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">{{ t('settings.modFieldsDocumentsStatusTypesDesc') }}</p>
            </div>

            <div class="mb-8">
              <div class="flex items-center justify-between mb-4 gap-3">
                <div class="min-w-0">
                  <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-1">{{ t('settings.modFieldsDocumentTypesTitle') }}</h4>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsDocumentTypesDesc') }}</p>
                </div>
                <button
                  type="button"
                  @click="openDocumentPicklistInFieldConfig('documentType')"
                  class="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  {{ t('settings.modFieldsEditInFieldConfig') }}
                </button>
              </div>

              <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div v-if="documentTypePicklist.length === 0" class="text-center py-8 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsLoadingDocumentTypes') }}</div>
                <div v-else class="space-y-2">
                  <div
                    v-for="(type, index) in documentTypePicklist"
                    :key="type.value || index"
                    class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <span class="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-white">{{ type.label }}</span>
                    <HeadlessSwitch
                      :checked="type.enabled"
                      @change="setDocumentPicklistEnabled('documentType', index, $event)"
                      switch-class="w-9 h-5"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-4 gap-3">
                <div class="min-w-0">
                  <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-1">{{ t('settings.modFieldsDocumentStatusTitle') }}</h4>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsDocumentStatusDesc') }}</p>
                </div>
                <button
                  type="button"
                  @click="openDocumentPicklistInFieldConfig('status')"
                  class="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  {{ t('settings.modFieldsEditInFieldConfig') }}
                </button>
              </div>

              <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div v-if="documentStatusPicklist.length === 0" class="text-center py-8 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsLoadingStatusValues') }}</div>
                <div v-else class="space-y-2">
                  <div
                    v-for="(status, index) in documentStatusPicklist"
                    :key="status.value || index"
                    class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <span class="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-white">{{ status.label }}</span>
                    <HeadlessSwitch
                      :checked="status.enabled"
                      @change="setDocumentPicklistEnabled('status', index, $event)"
                      switch-class="w-9 h-5"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Status Tab (Events module only) — lifecycle categories + tenant vocabulary -->
        <div class="flex-1 overflow-y-auto" v-else-if="activeTopTab === 'status' && isEventsModule">
          <EventStatusLifecycleSettings />
        </div>

        <!-- Roles & Rules Tab (Events module only) -->
        <!-- 
          ARCHITECTURE NOTE: Events Settings configure constraints, not behavior.
          - Role Requirements: Configure which roles are mandatory per event type (not role assignment)
          - Geo Rules: Configure geo requirements per event type (not geo tracking execution)
          - Form Linking Rules: Configure form linking eligibility (not form assignment or execution)
          This tab configures constraints that enable behavior elsewhere, not behavior itself.
          See: docs/architecture/event-settings.md Section 4.3, 4.4, 4.5
        -->
        <div class="flex-1 overflow-y-auto" v-else-if="activeTopTab === 'roles-rules' && isEventsModule">
          <div class="p-6 lg:p-8 max-w-4xl mx-auto space-y-10">
            <!-- Header -->
            <div class="space-y-2">
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">{{ t('settings.modFieldsRolesRulesDesc') }}</p>
              <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p class="text-xs text-blue-800 dark:text-blue-400">
                  <strong>{{ t('settings.modFieldsNoteLabel') }}</strong> {{ t('settings.modFieldsRolesRulesNote') }}
                </p>
              </div>
            </div>

            <!-- Role Requirements per Event Type Section -->
            <div class="space-y-4">
              <div class="space-y-3">
                <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-1">{{ t('settings.modFieldsRoleRequirementsTitle') }}</h4>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">{{ t('settings.modFieldsRoleRequirementsDesc') }}</p>
                <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p class="text-xs text-amber-800 dark:text-amber-400">
                    <strong>{{ t('settings.modulesAndFieldsImportant3') }}</strong>{{ t('settings.modulesAndFieldsTheseCheckboxesConfigureFieldRequirementsWhich') }}</p>
                </div>
              </div>
              
              <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div class="space-y-6">
                  <!-- Meeting -->
                  <div class="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0 last:pb-0">
                    <h5 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('settings.modFieldsEventTypeMeeting') }}</h5>
                    <div class="space-y-3">
                      <label class="flex items-start gap-3">
                        <HeadlessCheckbox
                          :checked="eventRoleRules[t('settings.modFieldsEventTypeMeeting')]?.auditorRequired || false"
                          @change="updateEventRoleRule(t('settings.modFieldsEventTypeMeeting'), 'auditorRequired', $event.target.checked)"
                          checkbox-class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsAuditorRequired') }}</span>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('settings.modFieldsMeetingAuditorOptional') }}</p>
                        </div>
                      </label>
                      <label class="flex items-start gap-3">
                        <HeadlessCheckbox
                          :checked="eventRoleRules[t('settings.modFieldsEventTypeMeeting')]?.reviewerRequired || false"
                          @change="updateEventRoleRule(t('settings.modFieldsEventTypeMeeting'), 'reviewerRequired', $event.target.checked)"
                          checkbox-class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsReviewerRequired') }}</span>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('settings.modFieldsMeetingReviewerOptional') }}</p>
                        </div>
                      </label>
                      <label class="flex items-start gap-3">
                        <HeadlessCheckbox
                          :checked="eventRoleRules[t('settings.modFieldsEventTypeMeeting')]?.correctiveOwnerRequired || false"
                          @change="updateEventRoleRule(t('settings.modFieldsEventTypeMeeting'), 'correctiveOwnerRequired', $event.target.checked)"
                          checkbox-class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsCorrectiveOwnerRequired') }}</span>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('settings.modFieldsMeetingCorrectiveOwnerOptional') }}</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <!-- Internal Audit -->
                  <div class="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0 last:pb-0">
                    <h5 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('settings.modFieldsEventTypeInternalAudit') }}</h5>
                    <div class="space-y-3">
                      <label class="flex items-start gap-3 opacity-75">
                        <HeadlessCheckbox
                          :checked="true"
                          :disabled="true"
                          checkbox-class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsAuditorRequired') }}</span>
                          <span class="ml-2 px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">{{ t('settings.modFieldsLocked') }}</span>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('settings.modFieldsAuditAuditorRequired') }}</p>
                        </div>
                      </label>
                      <label class="flex items-start gap-3">
                        <HeadlessCheckbox
                          :checked="eventRoleRules[t('settings.modFieldsEventTypeInternalAudit')]?.reviewerRequired || false"
                          @change="updateEventRoleRule(t('settings.modFieldsEventTypeInternalAudit'), 'reviewerRequired', $event.target.checked)"
                          checkbox-class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsReviewerRequired') }}</span>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('settings.modFieldsInternalAuditReviewerOptional') }}</p>
                        </div>
                      </label>
                      <label class="flex items-start gap-3 opacity-75">
                        <HeadlessCheckbox
                          :checked="true"
                          :disabled="true"
                          checkbox-class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsCorrectiveOwnerRequired') }}</span>
                          <span class="ml-2 px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">{{ t('settings.modFieldsLocked') }}</span>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {{ t('settings.modFieldsAuditCorrectiveOwnerRequired') }}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <!-- External Audit — Single Org -->
                  <div class="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0 last:pb-0">
                    <h5 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('settings.modFieldsEventTypeExternalAuditSingleOrg') }}</h5>
                    <div class="space-y-3">
                      <label class="flex items-start gap-3 opacity-75">
                        <HeadlessCheckbox
                          :checked="true"
                          :disabled="true"
                          checkbox-class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsAuditorRequired') }}</span>
                          <span class="ml-2 px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">{{ t('settings.modFieldsLocked') }}</span>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('settings.modFieldsAuditAuditorRequired') }}</p>
                        </div>
                      </label>
                      <label class="flex items-start gap-3 opacity-75">
                        <HeadlessCheckbox
                          :checked="true"
                          :disabled="true"
                          checkbox-class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsReviewerRequired') }}</span>
                          <span class="ml-2 px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">{{ t('settings.modFieldsLocked') }}</span>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('settings.modFieldsExternalAuditReviewerRequired') }}</p>
                        </div>
                      </label>
                      <label class="flex items-start gap-3 opacity-75">
                        <HeadlessCheckbox
                          :checked="true"
                          :disabled="true"
                          checkbox-class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsCorrectiveOwnerRequired') }}</span>
                          <span class="ml-2 px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">{{ t('settings.modFieldsLocked') }}</span>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {{ t('settings.modFieldsAuditCorrectiveOwnerRequired') }}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <!-- External Audit Beat -->
                  <div class="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0 last:pb-0">
                    <h5 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('settings.modFieldsEventTypeExternalAuditBeat') }}</h5>
                    <div class="space-y-3">
                      <label class="flex items-start gap-3 opacity-75">
                        <HeadlessCheckbox
                          :checked="true"
                          :disabled="true"
                          checkbox-class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsAuditorRequired') }}</span>
                          <span class="ml-2 px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">{{ t('settings.modFieldsLocked') }}</span>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('settings.modFieldsAuditAuditorRequired') }}</p>
                        </div>
                      </label>
                      <label class="flex items-start gap-3">
                        <HeadlessCheckbox
                          :checked="eventRoleRules[t('settings.modFieldsEventTypeExternalAuditBeat')]?.reviewerRequired || false"
                          @change="updateEventRoleRule(t('settings.modFieldsEventTypeExternalAuditBeat'), 'reviewerRequired', $event.target.checked)"
                          checkbox-class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsReviewerRequired') }}</span>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('settings.modFieldsExternalAuditBeatReviewerOptional') }}</p>
                        </div>
                      </label>
                      <label class="flex items-start gap-3 opacity-75">
                        <HeadlessCheckbox
                          :checked="true"
                          :disabled="true"
                          checkbox-class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsCorrectiveOwnerRequired') }}</span>
                          <span class="ml-2 px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">{{ t('settings.modFieldsLocked') }}</span>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {{ t('settings.modFieldsAuditCorrectiveOwnerRequired') }}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <!-- Field Sales Beat -->
                  <div>
                    <h5 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('settings.modFieldsEventTypeFieldSalesBeat') }}</h5>
                    <div class="space-y-3">
                      <label class="flex items-start gap-3">
                        <HeadlessCheckbox
                          :checked="eventRoleRules[t('settings.modFieldsEventTypeFieldSalesBeat')]?.auditorRequired || false"
                          @change="updateEventRoleRule(t('settings.modFieldsEventTypeFieldSalesBeat'), 'auditorRequired', $event.target.checked)"
                          checkbox-class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsAuditorRequired') }}</span>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('settings.modFieldsFieldSalesAuditorOptional') }}</p>
                        </div>
                      </label>
                      <label class="flex items-start gap-3">
                        <HeadlessCheckbox
                          :checked="eventRoleRules[t('settings.modFieldsEventTypeFieldSalesBeat')]?.reviewerRequired || false"
                          @change="updateEventRoleRule(t('settings.modFieldsEventTypeFieldSalesBeat'), 'reviewerRequired', $event.target.checked)"
                          checkbox-class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsReviewerRequired') }}</span>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('settings.modFieldsFieldSalesReviewerOptional') }}</p>
                        </div>
                      </label>
                      <label class="flex items-start gap-3">
                        <HeadlessCheckbox
                          :checked="eventRoleRules[t('settings.modFieldsEventTypeFieldSalesBeat')]?.correctiveOwnerRequired || false"
                          @change="updateEventRoleRule(t('settings.modFieldsEventTypeFieldSalesBeat'), 'correctiveOwnerRequired', $event.target.checked)"
                          checkbox-class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsCorrectiveOwnerRequired') }}</span>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('settings.modFieldsFieldSalesCorrectiveOwnerOptional') }}</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Geo Rules Section -->
            <div class="space-y-4">
              <div class="space-y-3">
                <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-1">{{ t('settings.modFieldsGeoRulesTitle') }}</h4>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">{{ t('settings.modFieldsGeoRulesDesc') }}</p>
                <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p class="text-xs text-amber-800 dark:text-amber-400">
                    <strong>{{ t('settings.modulesAndFieldsImportant2') }}</strong>{{ t('settings.modulesAndFieldsTheseSettingsConfigureGeoRequirementsWhether') }}</p>
                </div>
              </div>
              
              <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div class="space-y-4">
                  <div
                    v-for="eventType in [t('settings.modFieldsEventTypeMeeting'), t('settings.modFieldsEventTypeInternalAudit'), t('settings.modFieldsEventTypeExternalAuditSingleOrg'), 'External Audit Beat', 'Field Sales Beat']"
                    :key="eventType"
                    class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div class="flex-1">
                      <span class="text-sm font-medium text-gray-900 dark:text-white">{{ eventType }}</span>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span v-if="isAuditEventType(eventType)">{{ t('settings.modFieldsGeoRequiredAudit') }}</span>
                        <span v-else>{{ t('settings.modFieldsGeoConfigurable') }}</span>
                      </p>
                    </div>
                    <div class="flex items-center gap-3">
                      <span
                        v-if="isAuditEventType(eventType)"
                        class="px-2 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded"
                      >{{ t('settings.modFieldsLocked') }}</span>
                      <HeadlessSwitch
                        v-else
                        :checked="eventGeoRules[eventType] || false"
                        @change="updateEventGeoRule(eventType, $event.target.checked)"
                        switch-class="w-11 h-6"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Form Linking Rules Section -->
            <div>
              <div class="space-y-3 mb-4">
                <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-1">{{ t('settings.modFieldsFormLinkingRulesTitle') }}</h4>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">{{ t('settings.modFieldsFormLinkingRulesDesc') }}</p>
                <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p class="text-xs text-amber-800 dark:text-amber-400">
                    <strong>{{ t('settings.modulesAndFieldsImportant') }}</strong>{{ t('settings.modulesAndFieldsTheseSettingsConfigureFormLinkingEligibility') }}</p>
                </div>
              </div>
              
              <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div class="space-y-6">
                  <div
                    v-for="eventType in [t('settings.modFieldsEventTypeMeeting'), t('settings.modFieldsEventTypeInternalAudit'), t('settings.modFieldsEventTypeExternalAuditSingleOrg'), 'External Audit Beat', 'Field Sales Beat']"
                    :key="eventType"
                    class="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0 last:pb-0"
                  >
                    <h5 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ eventType }}</h5>
                    <div class="space-y-3">
                      <label class="flex items-start gap-3">
                        <HeadlessCheckbox
                          :checked="eventFormRules[eventType]?.allowLinking !== false"
                          @change="updateEventFormRule(eventType, 'allowLinking', $event.target.checked)"
                          :disabled="isAuditEventType(eventType)"
                          checkbox-class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          :class="isAuditEventType(eventType) ? 'opacity-50 cursor-not-allowed' : ''"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsAllowLinkingForms') }}</span>
                          <span
                            v-if="isAuditEventType(eventType)"
                            class="ml-2 px-1.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                          >{{ t('settings.modFieldsAlwaysAllowed') }}</span>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            <span v-if="isAuditEventType(eventType)">{{ t('settings.modFieldsFormsAlwaysLinkedAudit') }}</span>
                            <span v-else>{{ t('settings.modFieldsEnableFormLinking') }}</span>
                          </p>
                        </div>
                      </label>
                      <label
                        v-if="isAuditEventType(eventType)"
                        class="flex items-start gap-3"
                      >
                        <HeadlessCheckbox
                          :checked="eventFormRules[eventType]?.requireOnCreation || false"
                          @change="updateEventFormRule(eventType, 'requireOnCreation', $event.target.checked)"
                          checkbox-class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsRequireFormOnCreation') }}</span>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('settings.modFieldsRequireFormOnCreationDesc') }}</p>
                        </div>
                      </label>
                      <label
                        v-if="isAuditEventType(eventType)"
                        class="flex items-start gap-3"
                      >
                        <HeadlessCheckbox
                          :checked="eventFormRules[eventType]?.preventUnlinkingAfterStart || false"
                          @change="updateEventFormRule(eventType, 'preventUnlinkingAfterStart', $event.target.checked)"
                          checkbox-class="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsPreventUnlinkingAfterStart') }}</span>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('settings.modFieldsPreventUnlinkingAfterStartDesc') }}</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Logic & Rules Tab (Forms module only) -->
        <!-- 
          ARCHITECTURE NOTE: Forms Settings configure structure & behavior ONLY.
          Logic & Rules tab configures form behavior settings, not form content.
          
          CAPABILITY DECLARATION:
          - behaviorRulesConfigurable: true (can configure auto-assignment, workflow triggers)
          - scoringEditable: false (scoring weights belong to Form Builder)
          - questionLogicEditable: false (question-level logic belongs to Form Builder)
          
          See: client/src/platform/modules/forms/formsModule.definition.ts
          See: client/src/platform/forms/formSettingsCapabilities.ts
        -->
        <div class="flex-1 overflow-y-auto" v-else-if="activeTopTab === 'logic' && isFormsModule">
          <div class="p-6">
            <!-- Header -->
            <div class="mb-6">
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">{{ t('settings.modFieldsLogicRulesDesc') }}</p>
              
              <!-- Capability Indicators -->
              <div class="mt-4 space-y-2">
                <div v-if="hasCapability('behaviorRulesConfigurable')" class="flex items-center gap-2 text-xs">
                  <span class="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded font-medium">{{ t('settings.modFieldsCapBehaviorRules') }}</span>
                  <span class="text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsCapBehaviorRulesHint') }}</span>
                </div>
                <div v-if="isCapabilityLocked('scoringEditable')" class="flex items-center gap-2 text-xs">
                  <span class="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded font-medium">{{ t('settings.modFieldsCapScoringLocked') }}</span>
                  <span class="text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsCapQuestionLogicLockedHint') }}</span>
                </div>
                <div v-if="isCapabilityLocked('questionLogicEditable')" class="flex items-center gap-2 text-xs">
                  <span class="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded font-medium">{{ t('settings.modFieldsCapQuestionLogicLocked') }}</span>
                  <span class="text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsCapQuestionLogicLockedHint') }}</span>
                </div>
              </div>
            </div>

            <!-- Logic & Rules Configuration -->
            <div class="space-y-4">
              <div
                v-for="field in getFieldsForTab('logicAndRules')"
                :key="field.key"
                class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
              >
                <div class="flex items-start justify-between mb-2">
                  <div class="flex-1">
                    <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                      {{ field.label }}
                    </h4>
                    <div class="flex items-center gap-2 mb-2">
                      <span
                        :class="[
                          'px-2 py-0.5 text-xs font-medium rounded',
                          field.editable
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        ]"
                      >
                        {{ field.editable ? t('settings.modFieldsEditable') : t('settings.modFieldsReadOnly') }}
                      </span>
                      <span
                        :class="[
                          'px-2 py-0.5 text-xs font-medium rounded',
                          field.source === 'settings'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : field.source === 'builder'
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                        ]"
                      >
                        {{ field.source === 'settings' ? t('settings.modFieldsSourceSettings') : field.source === 'builder' ? t('settings.modFieldsSourceBuilder') : t('settings.modFieldsSourceExecution') }}
                      </span>
                    </div>
                    <p v-if="field.notes" class="text-xs text-gray-500 dark:text-gray-400">
                      {{ field.notes }}
                    </p>
                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
                      {{ field.key }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Outcomes Tab (Forms module only) -->
        <!-- 
          ARCHITECTURE NOTE: Forms Settings configure structure & behavior ONLY.
          Outcomes tab configures form outcome rules, not form content.
          
          CAPABILITY DECLARATION:
          - outcomesConfigurable: true (can configure audit rules, reporting metrics, signals)
          - executionBehaviorEditable: false (execution belongs to Event Execution / Work interfaces)
          - workflowExecutionEditable: false (workflow execution belongs to Audit Workflow / Work components)
          
          See: client/src/platform/modules/forms/formsModule.definition.ts
          See: client/src/platform/forms/formSettingsCapabilities.ts
        -->
        <div class="flex-1 overflow-y-auto" v-else-if="activeTopTab === 'outcomes' && isFormsModule">
          <div class="p-6">
            <!-- Header -->
            <div class="mb-6">
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">{{ t('settings.modFieldsOutcomesDesc') }}</p>
              
              <!-- Capability Indicators -->
              <div class="mt-4 space-y-2">
                <div v-if="hasCapability('outcomesConfigurable')" class="flex items-center gap-2 text-xs">
                  <span class="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded font-medium">{{ t('settings.modFieldsCapOutcomes') }}</span>
                  <span class="text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsCapOutcomesHint') }}</span>
                </div>
                <div v-if="isCapabilityLocked('executionBehaviorEditable')" class="flex items-center gap-2 text-xs">
                  <span class="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded font-medium">{{ t('settings.modFieldsCapExecutionLocked') }}</span>
                  <span class="text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsCapExecutionLockedHint') }}</span>
                </div>
                <div v-if="isCapabilityLocked('workflowExecutionEditable')" class="flex items-center gap-2 text-xs">
                  <span class="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded font-medium">{{ t('settings.modFieldsCapWorkflowLocked') }}</span>
                  <span class="text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsCapWorkflowLockedHint') }}</span>
                </div>
              </div>
            </div>

            <!-- Outcomes Configuration -->
            <div class="space-y-4">
              <div
                v-for="field in getFieldsForTab('outcomes')"
                :key="field.key"
                class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
              >
                <div class="flex items-start justify-between mb-2">
                  <div class="flex-1">
                    <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                      {{ field.label }}
                    </h4>
                    <div class="flex items-center gap-2 mb-2">
                      <span
                        :class="[
                          'px-2 py-0.5 text-xs font-medium rounded',
                          field.editable
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        ]"
                      >
                        {{ field.editable ? t('settings.modFieldsEditable') : t('settings.modFieldsReadOnly') }}
                      </span>
                      <span
                        :class="[
                          'px-2 py-0.5 text-xs font-medium rounded',
                          field.source === 'settings'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : field.source === 'builder'
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                        ]"
                      >
                        {{ field.source === 'settings' ? t('settings.modFieldsSourceSettings') : field.source === 'builder' ? t('settings.modFieldsSourceBuilder') : t('settings.modFieldsSourceExecution') }}
                      </span>
                    </div>
                    <p v-if="field.notes" class="text-xs text-gray-500 dark:text-gray-400">
                      {{ field.notes }}
                    </p>
                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
                      {{ field.key }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Access Tab (Forms module only) -->
        <!-- 
          ARCHITECTURE NOTE: Forms Settings configure structure & behavior ONLY.
          Access tab configures form access settings, not form content.
          
          CAPABILITY DECLARATION:
          - accessConfigurable: true (can configure public links, approval workflows)
          - auditWorkflowBypassAllowed: false (audit workflow rules are owned by Audit App)
          
          See: client/src/platform/modules/forms/formsModule.definition.ts
          See: client/src/platform/forms/formSettingsCapabilities.ts
        -->
        <div class="flex-1 overflow-y-auto" v-else-if="activeTopTab === 'access' && isFormsModule">
          <div class="p-6">
            <!-- Header -->
            <div class="mb-6">
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">{{ t('settings.modFieldsAccessDesc') }}</p>
              
              <!-- Capability Indicators -->
              <div class="mt-4 space-y-2">
                <div v-if="hasCapability('accessConfigurable')" class="flex items-center gap-2 text-xs">
                  <span class="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded font-medium">{{ t('settings.modFieldsCapAccess') }}</span>
                  <span class="text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsCapAccessHint') }}</span>
                </div>
                <div v-if="isCapabilityLocked('auditWorkflowBypassAllowed')" class="flex items-center gap-2 text-xs">
                  <span class="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded font-medium">{{ t('settings.modFieldsCapAuditWorkflowLocked') }}</span>
                  <span class="text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsCapAuditWorkflowLockedHint') }}</span>
                </div>
              </div>
            </div>

            <!-- Access Configuration -->
            <div class="space-y-4">
              <div
                v-for="field in getFieldsForTab('access')"
                :key="field.key"
                class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
              >
                <div class="flex items-start justify-between mb-2">
                  <div class="flex-1">
                    <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                      {{ field.label }}
                    </h4>
                    <div class="flex items-center gap-2 mb-2">
                      <span
                        :class="[
                          'px-2 py-0.5 text-xs font-medium rounded',
                          field.editable
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        ]"
                      >
                        {{ field.editable ? t('settings.modFieldsEditable') : t('settings.modFieldsReadOnly') }}
                      </span>
                      <span
                        :class="[
                          'px-2 py-0.5 text-xs font-medium rounded',
                          field.source === 'settings'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : field.source === 'builder'
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                        ]"
                      >
                        {{ field.source === 'settings' ? t('settings.modFieldsSourceSettings') : field.source === 'builder' ? t('settings.modFieldsSourceBuilder') : t('settings.modFieldsSourceExecution') }}
                      </span>
                    </div>
                    <p v-if="field.notes" class="text-xs text-gray-500 dark:text-gray-400">
                      {{ field.notes }}
                    </p>
                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
                      {{ field.key }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Relationships Tab (with Forms-specific display) -->
        <div class="flex-1 overflow-y-auto" v-else-if="activeTopTab === 'relationships'">
          <div class="p-6">
          <!-- Intro + Add button (section title "Relationships" is already in the tab header above) -->
          <div v-if="!isFormsModule" class="mb-6 flex items-start justify-between gap-4">
            <p class="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">{{ t('settings.modFieldsRelationshipsIntro') }}</p>
            <button
              type="button"
              @click="openRelationshipDrawer()"
              class="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>{{ t('settings.modFieldsAddRelationship') }}</button>
          </div>

          <!-- Forms Module Relationships (read-only display) -->
          <div v-if="isFormsModule" class="mb-6">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">{{ t('settings.modFieldsFormRelationships') }}</h4>
            <div class="space-y-3">
              <div
                v-for="field in getFieldsForTab('relationships')"
                :key="field.key"
                class="bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 rounded-lg p-3"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ field.label }}
                      </span>
                      <span
                        :class="[
                          'px-2 py-0.5 text-xs font-medium rounded',
                          field.editable
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        ]"
                      >
                        {{ field.editable ? t('settings.modFieldsEditable') : t('settings.modFieldsReadOnly') }}
                      </span>
                      <span
                        :class="[
                          'px-2 py-0.5 text-xs font-medium rounded',
                          field.source === 'settings'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : field.source === 'builder'
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                        ]"
                      >
                        {{ field.source === 'settings' ? t('settings.modFieldsSourceSettings') : field.source === 'builder' ? t('settings.modFieldsSourceBuilder') : t('settings.modFieldsSourceExecution') }}
                      </span>
                    </div>
                    <p v-if="field.notes" class="text-xs text-gray-500 dark:text-gray-400">
                      {{ field.notes }}
                    </p>
                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
                      {{ field.key }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-if="!isFormsModule && relationships.length === 0" class="bg-gray-50 dark:bg-white/5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsNoRelationships') }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-500">{{ t('settings.modFieldsNoRelationshipsHint') }}</p>
          </div>

          <!-- Relationships list (two-column grid for easier scanning with 10+ items) -->
          <div v-else-if="!isFormsModule && relationships.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                v-for="(r, ri) in relationships"
                :key="ri"
                class="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <div class="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {{ r.name || t('settings.modFieldsRelationshipFallback', { index: ri + 1 }) }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 mr-1.5">{{ getRelationshipTypeBadge(r) }}</span>
                    {{ selectedModule?.name || t('settings.modFieldsThisModule') }} → {{ getModuleName(r.targetModuleKey) || '…' }}
                  </p>
                </div>
                <div class="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    @click="openRelationshipDrawer(ri)"
                    class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                    :title="t('settings.modFieldsTitleEditRelationship')"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    @click="removeRelationship(ri)"
                    class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    :title="t('settings.modFieldsTitleRemoveRelationship')"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
          </div>

          <!-- Relationship add/edit drawer -->
          <RelationshipFormDrawer
            :open="relationshipDrawerOpen"
            :module-name="selectedModule?.name || ''"
            :current-module-key="selectedModule?.key || ''"
            :relationship="relationshipEditIndex !== null ? relationships[relationshipEditIndex] : null"
            :edit-index="relationshipEditIndex"
            :modules="modules"
            :existing-relationships="relationships"
            :edit-fields="editFields"
            @close="closeRelationshipDrawer"
            @save="onRelationshipSave"
          />
          </div>
        </div>

        <div class="flex-1 overflow-y-auto" v-else-if="activeTopTab === 'pipeline'">
          <div class="p-6 h-full">
          <div class="h-full flex flex-col lg:flex-row gap-4">
            <aside class="w-full lg:w-80 flex-none bg-white dark:bg-gray-900/60 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
              <div class="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                <div class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.modFieldsPipelinesTitle') }}</div>
                <button @click="addPipeline" class="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm hover:shadow">{{ t('actions.add') }}</button>
              </div>
              <div class="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800">
                <div
                  v-for="(pipeline, index) in pipelineSettings"
                  :key="pipeline.key || index"
                  :class="[
                    'p-4 cursor-pointer transition-colors',
                    selectedPipelineKey === pipeline.key
                      ? 'bg-indigo-50 dark:bg-indigo-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-white/5'
                  ]"
                  @click="selectedPipelineKey = pipeline.key"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <span class="w-2.5 h-2.5 rounded-full border border-white shadow" :style="{ backgroundColor: pipeline.color || DEFAULT_PIPELINE_COLOR }"></span>
                      <div class="min-w-0">
                        <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ pipeline.name }}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">{{ pipeline.stages?.length || 0 }} stage{{ (pipeline.stages?.length || 0) === 1 ? '' : 's' }}</p>
                      </div>
                    </div>
                    <span v-if="pipeline.isDefault" class="text-xs font-medium text-indigo-600 dark:text-indigo-300">{{ t('settings.modFieldsDefaultLabel') }}</span>
                  </div>
                  <div class="flex items-center gap-2 mt-3">
                    <label class="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <input
                        type="radio"
                        name="default-pipeline"
                        class="text-indigo-600 border-gray-300 dark:border-gray-600 focus:ring-indigo-500"
                        :checked="pipeline.isDefault"
                        @change.stop="setDefaultPipeline(pipeline.key)"
                      />{{ t('settings.modFieldsDefaultLabel') }}</label>
                    <div class="ml-auto flex items-center gap-1">
                      <button
                        class="p-1 rounded text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
                        :disabled="index === 0"
                        :class="{ 'opacity-40 cursor-not-allowed': index === 0 }"
                        @click.stop="movePipeline(pipeline.key, -1)"
                        :title="t('settings.modFieldsTitleMoveUp')"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                          <path fill-rule="evenodd" d="M10 4a.75.75 0 01.53.22l4.5 4.5a.75.75 0 11-1.06 1.06L10 5.81 6.03 9.78a.75.75 0 11-1.06-1.06l4.5-4.5A.75.75 0 0110 4z" clip-rule="evenodd" />
                          <path d="M5.25 15.25a.75.75 0 01.75-.75h8a.75.75 0 010 1.5h-8a.75.75 0 01-.75-.75z" />
                        </svg>
                      </button>
                      <button
                        class="p-1 rounded text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
                        :disabled="index === pipelineSettings.length - 1"
                        :class="{ 'opacity-40 cursor-not-allowed': index === pipelineSettings.length - 1 }"
                        @click.stop="movePipeline(pipeline.key, 1)"
                        :title="t('settings.modFieldsTitleMoveDown')"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                          <path fill-rule="evenodd" d="M10 16a.75.75 0 01-.53-.22l-4.5-4.5a.75.75 0 011.06-1.06L10 14.19l3.97-3.97a.75.75 0 111.06 1.06l-4.5 4.5A.75.75 0 0110 16z" clip-rule="evenodd" />
                          <path d="M5.25 4.75a.75.75 0 01.75-.75h8a.75.75 0 010 1.5h-8a.75.75 0 01-.75-.75z" />
                        </svg>
                      </button>
                      <button
                        class="p-1 rounded text-red-500 hover:text-red-600 transition-colors"
                        @click.stop="removePipeline(pipeline.key)"
                        :title="t('settings.modFieldsTitleRemovePipeline')"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                          <path fill-rule="evenodd" d="M8.75 3a.75.75 0 00-.75.75V5H5.5a.75.75 0 000 1.5h.538l.599 9.27A1.75 1.75 0 008.382 17.5h3.236a1.75 1.75 0 001.745-1.73l.599-9.27h.538a.75.75 0 000-1.5H12v-1.25A.75.75 0 0011.25 3h-2.5zM9.5 6.5v7a.75.75 0 001.5 0v-7a.75.75 0 00-1.5 0zm-2 0v7a.75.75 0 001.5 0v-7a.75.75 0 00-1.5 0z" clip-rule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div v-if="!pipelineSettings.length" class="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsNoPipelinesYet') }}</div>
              </div>
            </aside>
            <section class="flex-1 min-w-0 bg-white dark:bg-gray-900/60 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-y-auto flex flex-col">
              <div class="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {{ currentPipeline?.name || t('settings.modFieldsSelectPipeline') }}
                  </p>
                  <p v-if="currentPipeline" class="text-xs text-gray-500 dark:text-gray-400">
                    {{ currentPipeline.stages?.length || 0 }} stage{{ (currentPipeline.stages?.length || 0) === 1 ? '' : 's' }} ·
                    {{ currentPipeline.isDefault ? t('settings.modFieldsDefaultPipeline') : t('settings.modFieldsCustomPipeline') }}
                  </p>
                </div>
              </div>
              <div v-if="currentPipeline" class="p-4 space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsPipelineName') }}</label>
                    <input v-model="currentPipeline.name" class="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm" />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsColor') }}</label>
                    <div class="flex items-center gap-3">
                      <input type="color" v-model="currentPipeline.color" class="w-14 h-10 border border-gray-300 dark:border-gray-600 rounded focus:outline-none" />
                      <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsColorUsedInUi') }}</span>
                    </div>
                  </div>
                  <div class="md:col-span-2 flex items-center gap-3">
                    <span v-if="currentPipeline.isDefault" class="px-2 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded">{{ t('settings.modFieldsDefaultPipeline') }}</span>
                    <button
                      v-else
                      @click="setDefaultPipeline(currentPipeline.key)"
                      class="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                    >{{ t('settings.modFieldsSetAsDefault') }}</button>
                  </div>
                </div>

                <div class="flex items-center justify-between gap-3">
                  <div>
                    <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.modFieldsStagesTitle') }}</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsStagesDesc') }}</p>
                  </div>
                  <div class="flex items-center gap-2">
                  <button @click="addStageToPipeline(currentPipeline)" class="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm hover:shadow">{{ t('settings.modFieldsAddStage') }}</button>
                  </div>
                </div>

                <div class="pr-1 space-y-3 pb-16" @dragover.prevent="onStageListDragOver(currentPipeline.key)" @drop.prevent="onStageListDrop(currentPipeline.key)">
                  <div
                    v-for="(stage, stageIndex) in currentPipeline.stages"
                    :key="stage.key || stageIndex"
                    class="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900/50 p-4 transition-shadow"
                    draggable="true"
                    @dragstart="onStageDragStart(currentPipeline.key, stageIndex, $event)"
                    @dragover.prevent="onStageDragOver(currentPipeline.key, stageIndex)"
                    @drop.prevent="onStageDrop(currentPipeline.key, stageIndex)"
                    @dragend="resetStageDrag"
                    :class="[
                      stageDragOver.pipelineKey === currentPipeline.key && stageDragOver.index === stageIndex
                         ? 'ring-2 ring-indigo-500/60 dark:ring-indigo-400/70'
                         : ''
                     ]"
                   >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-semibold text-gray-800 dark:text-gray-200">Stage {{ stageIndex + 1 }}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <button
                          class="p-1 rounded text-red-500 hover:text-red-600 transition-colors"
                          @click="removeStageFromPipeline(currentPipeline, stageIndex)"
                          :title="t('settings.modFieldsTitleRemoveStage')"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                            <path fill-rule="evenodd" d="M8.75 3a.75.75 0 00-.75.75V5H5.5a.75.75 0 000 1.5h.538l.599 9.27A1.75 1.75 0 008.382 17.5h3.236a1.75 1.75 0 001.745-1.73l.599-9.27h.538a.75.75 0 000-1.5H12v-1.25A.75.75 0 0011.25 3h-2.5zM9.5 6.5v7a.75.75 0 001.5 0v-7a.75.75 0 00-1.5 0zm-2 0v7a.75.75 0 001.5 0v-7a.75.75 0 00-1.5 0z" clip-rule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                      <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsStageName') }}</label>
                        <input v-model="stage.name" class="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm" />
                      </div>
                      <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsColor') }}</label>
                        <div class="flex items-center gap-2">
                          <input
                            type="color"
                            :value="stage.color || DEFAULT_STAGE_COLOR"
                            @input="stage.color = $event.target.value"
                            class="h-9 w-12 cursor-pointer rounded border border-gray-300 dark:border-gray-600 bg-white p-0.5 dark:bg-gray-800"
                            :title="t('settings.modFieldsTitleStageColor')"
                          />
                          <span class="px-2.5 py-1 rounded-full text-xs font-medium text-white truncate max-w-[6rem]" :style="{ backgroundColor: stage.color || DEFAULT_STAGE_COLOR }">{{ stage.name || t('settings.modFieldsStageLabelFallback') }}</span>
                        </div>
                      </div>
                      <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsProbabilityPercent') }}</label>
                        <input type="number" min="0" max="100" v-model.number="stage.probability" @change="clampStageProbability(stage)" @blur="clampStageProbability(stage)" class="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm" />
                      </div>
                      <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsStatusLabel') }}</label>
                        <HeadlessSelect
                          v-model="stage.status"
                          :options="pipelineStageStatusOptions"
                          teleport
                          :teleport-match-width="true"
                          button-class="!py-2 !rounded-lg !bg-gray-50 dark:!bg-white/5 dark:!border-gray-700"
                          @update:model-value="onStageStatusChange(stage)"
                        />
                      </div>
                    </div>
                  </div>
                  <div
                    class="border border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50/40 dark:bg-white/5 text-center text-xs text-gray-500 dark:text-gray-400 py-4 transition-colors"
                    :class="stageDragOver.pipelineKey === currentPipeline.key && stageDragOver.index === currentPipeline.stages.length ? 'border-indigo-400 text-indigo-600 dark:text-indigo-300' : ''"
                    @dragover.prevent="onStageDragOver(currentPipeline.key, currentPipeline.stages.length)"
                    @drop.prevent="onStageDrop(currentPipeline.key, currentPipeline.stages.length)"
                  >{{ t('settings.modFieldsDropStageEnd') }}</div>
                </div>
              </div>
              <div v-else class="flex-1 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                <div class="text-center space-y-3">
                  <p>{{ t('settings.modFieldsNoPipelineSelected') }}</p>
                  <button @click="addPipeline" class="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">{{ t('settings.modFieldsCreatePipeline') }}</button>
                </div>
              </div>
              <div v-if="!currentPipeline" class="flex-1 flex items-center justify-center p-6 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsSelectPipelineToEdit') }}</div>
            </section>
          </div>
          </div>
        </div>


        <div class="flex-1 overflow-y-auto" v-else>
          <div class="p-4">
          <!-- Quick Create Mode Toggle - Advanced mode hidden for now -->
          <!-- <div class="mb-3 flex items-center justify-between">
            <div class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.modFieldsQuickCreateMode') }}</div>
            <div class="inline-flex rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden text-sm">
              <button
                @click="quickMode = 'simple'"
                :class="[
                  'px-3 py-1.5',
                  quickMode === 'simple'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                ]"
              >{{ t('settings.modFieldsQuickModeSimple') }}</button>
              <button
                @click="quickMode = 'advanced'"
                :class="[
                  'px-3 py-1.5',
                  quickMode === 'advanced'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                ]"
              >{{ t('settings.modFieldsQuickModeAdvanced') }}</button>
            </div>
          </div> -->
          <div class="flex gap-4">
            <!-- Left: Field palette (drag to rows/columns) -->
            <aside class="w-96 flex-none bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div class="p-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{{ t('settings.modFieldsFieldPalette') }}</div>
              </div>
              <div class="p-2 max-h-[60vh] overflow-y-auto">
                <!-- Simple mode: checkboxes with grouped sections -->
                <template v-if="isPeopleModule">
                  <!-- Core Identity Fields -->
                  <div v-if="quickCreateAvailableFields.some(f => getPeopleFieldMetadata(f.key)?.owner === 'core')" class="mb-4">
                    <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 px-2">{{ t('settings.modFieldsGroupCoreIdentity') }}</div>
                    <ul class="space-y-1">
                      <li
                        v-for="f in quickCreateAvailableFields.filter(f => getPeopleFieldMetadata(f.key)?.owner === 'core')"
                        :key="f.key"
                        class="px-3 py-2 rounded flex items-center gap-2 cursor-pointer"
                        :class="quickCreateSelected.has(f.key) ? 'bg-gray-100 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'"
                        @click="toggleQuickRow(f)"
                        :title="f.required ? t('settings.modFieldsTitleRequiredFieldIncluded') : ''"
                      >
                        <HeadlessCheckbox :checked="quickCreateSelected.has(f.key)" :disabled="f.required" @change="toggleQuickCreate(f.key, $event.target.checked)" @click.stop />
                        <span class="text-sm text-gray-800 dark:text-gray-200 truncate">{{ f.label || f.key }}</span>
                      </li>
                    </ul>
                  </div>
                  
                  <!-- Participation Fields -->
                  <div v-if="quickCreateAvailableFields.some(f => getPeopleFieldMetadata(f.key)?.owner === 'participation')" class="mb-4">
                    <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 px-2">{{ t('settings.modFieldsGroupParticipation') }}</div>
                    <ul class="space-y-1">
                      <li
                        v-for="f in quickCreateAvailableFields.filter(f => getPeopleFieldMetadata(f.key)?.owner === 'participation')"
                        :key="f.key"
                        class="px-3 py-2 rounded flex items-center gap-2 cursor-pointer"
                        :class="quickCreateSelected.has(f.key) ? 'bg-gray-100 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'"
                        @click="toggleQuickRow(f)"
                        :title="f.required ? t('settings.modFieldsTitleRequiredFieldIncluded') : ''"
                      >
                        <HeadlessCheckbox :checked="quickCreateSelected.has(f.key)" :disabled="f.required" @change="toggleQuickCreate(f.key, $event.target.checked)" @click.stop />
                        <span class="text-sm text-gray-800 dark:text-gray-200 truncate">{{ f.label || f.key }}</span>
                      </li>
                    </ul>
                  </div>
                  
                  <!-- Custom / org-defined fields (not in PEOPLE_FIELD_METADATA) -->
                  <div v-if="quickCreateAvailableFields.some(f => f.key && !getPeopleFieldMetadata(f.key))" class="mb-4">
                    <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 px-2">{{ t('settings.modFieldsBadgeCustomField') }}</div>
                    <ul class="space-y-1">
                      <li
                        v-for="f in quickCreateAvailableFields.filter(f => f.key && !getPeopleFieldMetadata(f.key))"
                        :key="f.key"
                        class="px-3 py-2 rounded flex items-center gap-2 cursor-pointer"
                        :class="quickCreateSelected.has(f.key) ? 'bg-gray-100 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'"
                        @click="toggleQuickRow(f)"
                        :title="f.required ? t('settings.modFieldsTitleRequiredFieldIncluded') : ''"
                      >
                        <HeadlessCheckbox :checked="quickCreateSelected.has(f.key)" :disabled="f.required" @change="toggleQuickCreate(f.key, $event.target.checked)" @click.stop />
                        <span class="text-sm text-gray-800 dark:text-gray-200 truncate">{{ f.label || f.key }}</span>
                      </li>
                    </ul>
                  </div>
                  
                  <!-- Info message if no fields -->
                  <div v-if="quickCreateAvailableFields.length === 0" class="p-3 text-xs text-gray-500 dark:text-gray-400 text-center">{{ t('settings.modFieldsNoQuickCreateFields') }}</div>
                </template>
                
                <!-- Organizations module: all core fields configurable in Quick Create -->
                <!-- Name field MUST always be present, required, and non-removable. -->
                <template v-else-if="isOrganizationsModule">
                  <div v-if="quickCreateAvailableFields.length > 0" class="mb-4">
                    <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 px-2">{{ t('settings.modFieldsGroupCoreBusinessFields') }}</div>
                    <ul class="space-y-1">
                      <li
                        v-for="f in quickCreateAvailableFields"
                        :key="f.key"
                        class="px-3 py-2 rounded flex items-center gap-2"
                        :class="[
                          quickCreateSelected.has(f.key) ? 'bg-gray-100 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5',
                          f.key?.toLowerCase() === 'name' ? 'cursor-default' : 'cursor-pointer'
                        ]"
                        @click="f.key?.toLowerCase() !== 'name' ? toggleQuickRow(f) : null"
                        :title="f.key?.toLowerCase() === 'name' ? t('settings.modFieldsTitleNameRequired') : (f.required ? t('settings.modFieldsTitleRequiredFieldIncluded') : '')"
                      >
                        <HeadlessCheckbox
                          :checked="quickCreateSelected.has(f.key)"
                          :disabled="f.key?.toLowerCase() === 'name' || f.required"
                          @change="f.key?.toLowerCase() !== 'name' ? toggleQuickCreate(f.key, $event.target.checked) : null"
                          @click.stop
                        />
                        <span class="text-sm text-gray-800 dark:text-gray-200 truncate">{{ f.label || f.key }}</span>
                        <span v-if="f.key?.toLowerCase() === 'name'" class="px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded ml-auto">{{ t('common.required') }}</span>
                        <span v-else class="px-1.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded ml-auto">{{ t('settings.modFieldsBadgeCoreField') }}</span>
                      </li>
                    </ul>
                  </div>
                  
                  <!-- Info message if no fields -->
                  <div v-if="quickCreateAvailableFields.length === 0" class="p-3 text-xs text-gray-500 dark:text-gray-400 text-center">{{ t('settings.modFieldsNoQuickCreateFields') }}</div>
                </template>
                
                <!-- Tasks module: grouped by core task fields -->
                <!-- 
                  ARCHITECTURE NOTE: Tasks Settings configure structure only, never work.
                  Quick Create is for fast task capture. Only essential fields appear.
                  Title field MUST always be present, required, and non-removable (locked position).
                  Default: title*, dueDate, taskType, status, priority, relatedTo, description, assignedTo*
                  Excluded: app fields, system fields, time tracking, subtasks, tags
                  See: docs/architecture/task-settings.md Section 3.5
                -->
                <template v-else-if="isTasksModule">
                  <div v-if="quickCreateAvailableFields.length > 0" class="mb-4">
                    <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 px-2">{{ t('settings.modFieldsGroupCoreTaskFields') }}</div>
                    <ul class="space-y-1">
                      <li
                        v-for="f in quickCreateAvailableFields"
                        :key="f.key"
                        class="px-3 py-2 rounded flex items-center gap-2"
                        :class="[
                          quickCreateSelected.has(f.key) ? 'bg-gray-100 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5',
                          f.key?.toLowerCase() === 'title' ? 'cursor-default' : 'cursor-pointer'
                        ]"
                        @click="f.key?.toLowerCase() !== 'title' ? toggleQuickRow(f) : null"
                        :title="f.key?.toLowerCase() === 'title' ? t('settings.modFieldsTitleTitleRequired') : (f.required ? t('settings.modFieldsTitleRequiredFieldIncluded') : '')"
                      >
                        <HeadlessCheckbox
                          :checked="quickCreateSelected.has(f.key)"
                          :disabled="f.key?.toLowerCase() === 'title' || f.required"
                          @change="f.key?.toLowerCase() !== 'title' ? toggleQuickCreate(f.key, $event.target.checked) : null"
                          @click.stop
                        />
                        <span class="text-sm text-gray-800 dark:text-gray-200 truncate">{{ f.label || f.key }}</span>
                        <span v-if="f.key?.toLowerCase() === 'title'" class="px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded ml-auto">{{ t('common.required') }}</span>
                        <span v-else class="px-1.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded ml-auto">{{ t('settings.modFieldsBadgeCoreField') }}</span>
                      </li>
                    </ul>
                  </div>
                  
                  <!-- Info message if no fields -->
                  <div v-if="quickCreateAvailableFields.length === 0" class="p-3 text-xs text-gray-500 dark:text-gray-400 text-center">{{ t('settings.modFieldsNoQuickCreateFields') }}</div>
                  
                  <!-- Helper text for Tasks -->
                  <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p class="text-xs text-blue-800 dark:text-blue-400">
                      <strong>{{ t('settings.modFieldsTasksQuickCreateHint') }}</strong>
                    </p>
                  </div>
                </template>
                
                <!-- Events module: grouped by core event fields -->
                <!-- 
                  ARCHITECTURE NOTE: Events Settings configure structure, constraints, and eligibility only.
                  Quick Create is for fast event scheduling. Only minimal scheduling-safe fields appear.
                  eventName field MUST always be present, required, and non-removable (locked position).
                  Eligible fields: eventName (required, locked), eventType, startDateTime, endDateTime, location
                  Excluded: audit roles, geo, forms, recurrence, multi-org routing, notes, metadata
                  Rationale: Audit events require complex configuration (roles, forms, geo) and should not be created via Quick Create.
                  Quick Create is for simple scheduling (Meeting, Field Sales Beat), not audit workflows.
                  See: docs/architecture/event-settings.md Section 7
                -->
                <template v-else-if="isEventsModule">
                  <div v-if="quickCreateEventGroupedFields.core.length > 0" class="mb-4">
                    <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 px-2">{{ t('settings.modFieldsGroupCoreEventFields') }}</div>
                    <ul class="space-y-1">
                      <li
                        v-for="f in quickCreateEventGroupedFields.core"
                        :key="f.key"
                        class="px-3 py-2 rounded flex items-center gap-2"
                        :class="[
                          quickCreateSelected.has(f.key) ? 'bg-gray-100 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5',
                          f.key?.toLowerCase() === 'eventname' ? 'cursor-default' : 'cursor-pointer'
                        ]"
                        @click="f.key?.toLowerCase() !== 'eventname' ? toggleQuickRow(f) : null"
                        :title="f.key?.toLowerCase() === 'eventname' ? t('settings.modFieldsTitleEventNameRequired') : (f.required ? t('settings.modFieldsTitleRequiredFieldIncluded') : '')"
                      >
                        <HeadlessCheckbox
                          :checked="quickCreateSelected.has(f.key)"
                          :disabled="f.key?.toLowerCase() === 'eventname' || f.required"
                          @change="f.key?.toLowerCase() !== 'eventname' ? toggleQuickCreate(f.key, $event.target.checked) : null"
                          @click.stop
                        />
                        <span class="text-sm text-gray-800 dark:text-gray-200 truncate">{{ f.label || f.key }}</span>
                        <span v-if="f.key?.toLowerCase() === 'eventname'" class="px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded ml-auto">{{ t('common.required') }}</span>
                        <span v-else class="px-1.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded ml-auto">{{ t('settings.modFieldsBadgeCoreField') }}</span>
                      </li>
                    </ul>
                  </div>

                  <div
                    v-for="[appKey, fields] in quickCreateEventParticipationEntries"
                    :key="appKey"
                    class="mb-4"
                  >
                    <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 px-2">
                      {{ appKey === 'AUDIT' ? t('settings.modFieldsParticipationAudit') : appKey === 'SALES' ? 'Sales Participation' : `${appKey} Participation` }}
                    </div>
                    <ul class="space-y-1">
                      <li
                        v-for="f in fields"
                        :key="f.key"
                        class="px-3 py-2 rounded flex items-center gap-2"
                        :class="[
                          quickCreateSelected.has(f.key) ? 'bg-gray-100 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5',
                          f.key?.toLowerCase() === 'eventname' ? 'cursor-default' : 'cursor-pointer'
                        ]"
                        @click="f.key?.toLowerCase() !== 'eventname' ? toggleQuickRow(f) : null"
                        :title="f.key?.toLowerCase() === 'eventname' ? t('settings.modFieldsTitleEventNameRequired') : (f.required ? t('settings.modFieldsTitleRequiredFieldIncluded') : '')"
                      >
                        <HeadlessCheckbox
                          :checked="quickCreateSelected.has(f.key)"
                          :disabled="f.key?.toLowerCase() === 'eventname' || f.required"
                          @change="f.key?.toLowerCase() !== 'eventname' ? toggleQuickCreate(f.key, $event.target.checked) : null"
                          @click.stop
                        />
                        <span class="text-sm text-gray-800 dark:text-gray-200 truncate">{{ f.label || f.key }}</span>
                        <span class="px-1.5 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded ml-auto">{{ appKey }}</span>
                      </li>
                    </ul>
                  </div>

                  <div v-if="quickCreateEventGroupedFields.custom.length > 0" class="mb-4">
                    <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 px-2">{{ t('settings.modFieldsQuickCustomFields') }}</div>
                    <ul class="space-y-1">
                      <li
                        v-for="f in quickCreateEventGroupedFields.custom"
                        :key="f.key"
                        class="px-3 py-2 rounded flex items-center gap-2"
                        :class="[
                          quickCreateSelected.has(f.key) ? 'bg-gray-100 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5',
                          f.key?.toLowerCase() === 'eventname' ? 'cursor-default' : 'cursor-pointer'
                        ]"
                        @click="f.key?.toLowerCase() !== 'eventname' ? toggleQuickRow(f) : null"
                        :title="f.key?.toLowerCase() === 'eventname' ? t('settings.modFieldsTitleEventNameRequired') : (f.required ? t('settings.modFieldsTitleRequiredFieldIncluded') : '')"
                      >
                        <HeadlessCheckbox
                          :checked="quickCreateSelected.has(f.key)"
                          :disabled="f.key?.toLowerCase() === 'eventname' || f.required"
                          @change="f.key?.toLowerCase() !== 'eventname' ? toggleQuickCreate(f.key, $event.target.checked) : null"
                          @click.stop
                        />
                        <span class="text-sm text-gray-800 dark:text-gray-200 truncate">{{ f.label || f.key }}</span>
                        <span class="px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded ml-auto">{{ t('settings.modFieldsBadgeCustomField') }}</span>
                      </li>
                    </ul>
                  </div>
                  
                  <!-- Info message if no fields -->
                  <div v-if="quickCreateAvailableFields.length === 0" class="p-3 text-xs text-gray-500 dark:text-gray-400 text-center">{{ t('settings.modFieldsNoQuickCreateFields') }}</div>
                  
                  <!-- Helper text for Events -->
                  <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p class="text-xs text-blue-800 dark:text-blue-400">{{ t('settings.modulesAndFieldsSelectNonSystemEventFieldsTo') }}</p>
                  </div>
                </template>
                
                <!-- Other modules: non-system fields only -->
                <template v-else>
                  <div v-if="quickCreateAvailableFields.length > 0" class="mb-4">
                    <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 px-2">{{ t('settings.modFieldsFieldsLabel') }}</div>
                    <ul class="space-y-1">
                      <li
                        v-for="f in quickCreateAvailableFields"
                        :key="f.key"
                        class="px-3 py-2 rounded flex items-center gap-2 cursor-pointer"
                        :class="quickCreateSelected.has(f.key) ? 'bg-gray-100 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'"
                        @click="toggleQuickRow(f)"
                        :title="f.required ? t('settings.modFieldsTitleRequiredFieldIncluded') : ''"
                      >
                        <HeadlessCheckbox :checked="quickCreateSelected.has(f.key)" :disabled="f.required" @change="toggleQuickCreate(f.key, $event.target.checked)" @click.stop />
                        <span class="text-sm text-gray-800 dark:text-gray-200 truncate">{{ f.label || f.key }}</span>
                      </li>
                    </ul>
                  </div>
                  
                  <!-- Info message if no fields -->
                  <div v-if="quickCreateAvailableFields.length === 0" class="p-3 text-xs text-gray-500 dark:text-gray-400 text-center">{{ t('settings.modFieldsNoQuickCreateFieldsGeneric') }}</div>
                </template>
              </div>
              <div class="p-3 border-t border-gray-200 dark:border-white/10">
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  <span v-if="isPeopleModule">{{ t('settings.modFieldsQuickCreatePeopleHint') }}</span>
                  <span v-else-if="isTasksModule">{{ t('settings.modFieldsQuickCreateTasksFooter') }}</span>
                  <span v-else-if="isEventsModule">{{ t('settings.modFieldsQuickCreateEventsFooter') }}</span>
                  <span v-else>{{ t('settings.modFieldsQuickCreateGenericFooter') }}</span>
                </div>
              </div>
            </aside>
            <!-- Right: Simple list -->
            <section class="flex-1 min-w-0 space-y-6">
              <!-- Simple mode rendering -->
              <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div class="p-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                  <div class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.modFieldsSelectedFieldsOrdered') }}</div>
                </div>
                <div class="p-4 space-y-2">
                  <div v-if="orderedQuickCreate.length === 0" class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.modFieldsNoFieldsSelected') }}</div>
                  <div 
                    v-for="(f, idx) in orderedQuickCreate" 
                    :key="f.key" 
                    :draggable="!(isOrganizationsModule && f.key?.toLowerCase() === 'name' && idx === 0) && !(isTasksModule && f.key?.toLowerCase() === 'title' && idx === 0) && !(isEventsModule && f.key?.toLowerCase() === 'eventname' && idx === 0)"
                    @dragstart="onQuickCreateDragStart(idx)"
                    @dragover.prevent="onQuickCreateDragOver(idx)"
                    @drop.prevent="onQuickCreateDrop(idx)"
                    class="rounded border border-gray-200 dark:border-white/10 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2 transition-colors"
                    :class="{
                      'cursor-move': !(isOrganizationsModule && f.key?.toLowerCase() === 'name' && idx === 0) && !(isTasksModule && f.key?.toLowerCase() === 'title' && idx === 0) && !(isEventsModule && f.key?.toLowerCase() === 'eventname' && idx === 0),
                      'cursor-default': (isOrganizationsModule && f.key?.toLowerCase() === 'name' && idx === 0) || (isTasksModule && f.key?.toLowerCase() === 'title' && idx === 0) || (isEventsModule && f.key?.toLowerCase() === 'eventname' && idx === 0),
                      'opacity-50': quickCreateDragStartIdx === idx,
                      'ring-2 ring-indigo-500/50': quickCreateDragOverIdx === idx
                    }"
                  >
                    <ArrowsUpDownIcon 
                      v-if="!(isOrganizationsModule && f.key?.toLowerCase() === 'name' && idx === 0) && !(isTasksModule && f.key?.toLowerCase() === 'title' && idx === 0) && !(isEventsModule && f.key?.toLowerCase() === 'eventname' && idx === 0)"
                      class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" 
                    />
                    <svg 
                      v-else
                      class="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span class="flex-1">{{ f.label || f.key }}</span>
                    <span v-if="(isOrganizationsModule && f.key?.toLowerCase() === 'name') || (isTasksModule && f.key?.toLowerCase() === 'title') || (isEventsModule && f.key?.toLowerCase() === 'eventname')" class="px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">{{ t('common.required') }}</span>
                  </div>
                </div>
              </div>

              <!-- Advanced builder - Hidden for now -->
              <!-- <div v-else class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div class="p-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                  <div class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.modFieldsVisualBuilder') }}</div>
                  <div class="flex items-center gap-2">
                    <button @click="addRow" class="px-3 py-1.5 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20 rounded text-xs transition-colors">{{ t('settings.modFieldsAddRow') }}</button>
                    <button @click="openPreview()" class="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs">{{ t('settings.modFieldsPreview') }}</button>
                  </div>
                </div>
                <div class="p-4 space-y-4">
                  <div v-if="quickLayout.rows.length === 0" class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.modFieldsNoRowsYet') }}</div>
                  <div v-for="(row, ri) in quickLayout.rows" :key="ri"
                       class="border border-gray-200 dark:border-white/10 rounded-lg p-3 space-y-3"
                       :class="dragRowOver===ri ? 'ring-2 ring-indigo-500/50' : ''"
                       draggable="true"
                       @dragstart="onRowDragStart(ri)"
                       @dragover.prevent="onRowDragOver(ri)"
                       @drop.prevent="onRowDrop(ri)">
                    <div class="flex items-center justify-between">
                      <div class="text-xs font-medium text-gray-700 dark:text-gray-300">Row {{ ri + 1 }}</div>
                      <div class="flex items-center gap-2">
                        <button @click="addCol(ri)" class="px-2 py-1 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20 rounded text-xs transition-colors">{{ t('settings.modFieldsAddColumn') }}</button>
                        <button @click="removeRow(ri)" class="px-2 py-1 text-red-600 dark:text-red-400 text-xs">{{ t('settings.modFieldsRemoveRow') }}</button>
                      </div>
                    </div>
                    <div class="grid grid-cols-12 gap-2"
                         @dragover.prevent="onRowDragOver(ri)"
                         @drop.prevent="onRowDrop(ri)">
                    <div v-for="(col, ci) in row.cols" :key="ci"
                           :class="[
                             'border border-dashed border-gray-300 dark:border-white/10 rounded-lg p-3',
                             spanClass(col.span),
                             dragColOver.ri === ri && dragColOver.ci === ci ? 'ring-2 ring-indigo-500/50' : ''
                           ]"
                           draggable="true"
                           @dragstart="onColDragStart(ri, ci)"
                           @dragover.prevent="onColDragOver(ri, ci)"
                           @drop.prevent="onColDrop(ri, ci)">
                        <div class="flex items-center gap-2 mb-2">
                          <button class="cursor-grab text-xs text-gray-500 dark:text-gray-400" :title="t('settings.modFieldsTitleDragReorder')">☰</button>
                          <label class="text-xs text-gray-600 dark:text-gray-400">{{ t('settings.modFieldsSpan') }}</label>
                          <select v-model.number="col.span" class="px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs">
                            <option v-for="n in 12" :key="n" :value="n">{{ n }}</option>
                          </select>
                          <button @click="removeCol(ri, ci)" class="ml-auto text-xs text-red-600 dark:text-red-400">{{ t('actions.remove') }}</button>
                        </div>
                        <div @dragover.prevent @drop.prevent="onColumnDrop(ri, ci, $event)" class="rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-3 text-sm text-gray-700 dark:text-gray-300 min-h-10 flex items-center justify-between">
                          <span class="truncate">{{ col.fieldKey ? displayFieldLabel(col.fieldKey) : t('settings.modFieldsDropFieldHere') }}</span>
                          <div class="flex items-center gap-2" v-if="col.fieldKey">
                            <select v-model="col.widget" class="px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs">
                              <option value="input">{{ t('settings.modFieldsWidgetInput') }}</option>
                              <option value="textarea">{{ t('settings.modFieldsWidgetTextarea') }}</option>
                              <option value="select">{{ t('settings.modFieldsWidgetSelect') }}</option>
                              <option value="date">{{ t('settings.modFieldsWidgetDate') }}</option>
                              <option value="number">{{ t('settings.modFieldsWidgetNumber') }}</option>
                            </select>
                            <input v-model="col.props.placeholder" :placeholder="t('settings.modFieldsPlaceholderGeneric')" class="px-2 py-1 rounded bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs" />
                            <button @click="clearColumnField(ri, ci)" class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsClear') }}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div> -->
            </section>
          </div>
          </div>
        </div>
      </section>
    </div>
    <!-- Preview Modal -->
    <div v-if="showPreview" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="closePreview"></div>
      <div class="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 w-[90vw] max-w-4xl max-h-[85vh] overflow-auto">
        <div class="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.modFieldsQuickCreatePreviewTitle') }}</div>
          <button @click="closePreview" class="px-3 py-1.5 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20 rounded text-xs transition-colors">{{ t('actions.close') }}</button>
        </div>
        <div class="p-6 space-y-3">
          <div v-for="(row, ri) in quickLayout.rows" :key="`pv-${ri}`" class="grid grid-cols-12 gap-3">
            <div
              v-for="(col, ci) in row.cols"
              :key="`pv-${ri}-${ci}`"
              :class="[
                'bg-gray-50 dark:bg-white/5 rounded border border-gray-200 dark:border-white/10 px-3 py-2 text-sm text-gray-700 dark:text-gray-300',
                spanClass(col.span)
              ]"
            >
              <template v-if="col.fieldKey">
                <div class="text-xs font-medium text-gray-800 dark:text-gray-200">{{ displayFieldLabel(col.fieldKey) }}</div>
                <div class="mt-1">
                  <div class="w-full px-3 py-2 rounded bg-white dark:bg-transparent border border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-500 italic">
                    {{ getPreviewPlaceholder(col) }}
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="text-gray-400 dark:text-gray-500">{{ t('settings.modFieldsQuickCreateEmpty') }}</div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Module Form Modal -->
    <transition name="fade">
      <div
        v-if="isActionModalOpen && actionModalStage && actionModalAction"
        class="fixed inset-0 z-[70] flex items-center justify-center px-4 py-8"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeActionModal"></div>
        <div class="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between border-b border-gray-200 dark:border-white/10 px-6 py-4">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.modFieldsActivityModalTitle') }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ t('settings.modFieldsActivityStageMeta', {
                  stage: actionModalStage.name || t('settings.modFieldsUntitledStage'),
                  number: actionModalActionIndex + 1
                }) }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                @click="removePlaybookAction(actionModalStage, actionModalActionIndex)"
                :disabled="actionModalActionIndex < 0"
              >
                {{ t('actions.delete') }}
              </button>
              <button
                class="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                @click="closeActionModal"
              >
                {{ t('actions.close') }}
              </button>
            </div>
          </div>
          <div class="max-h-[calc(90vh-4.5rem)] overflow-y-auto px-6 py-6 space-y-6">
            <div class="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 p-5">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.modFieldsActivitySummary') }}</h3>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsActivitySummaryHint') }}</span>
              </div>
              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsActivityTitleLabel') }}</label>
                  <input
                    v-model="actionModalAction.title"
                    @change="refreshPlaybookActionKey(actionModalStage, actionModalAction)"
                    class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                    :placeholder="t('settings.modFieldsActivityTitlePh')"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsActionTypeLabel') }}</label>
                  <HeadlessSelect
                    v-model="actionModalAction.actionType"
                    :options="playbookActionTypes"
                    teleport
                    :teleport-match-width="true"
                    button-class="!py-2 !rounded-lg !bg-white dark:!bg-gray-900/80 dark:!border-gray-700"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsDueDaysLabel') }}</label>
                  <input
                    type="number"
                    min="0"
                    v-model.number="actionModalAction.dueInDays"
                    class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                  />
                  <p class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsDueSameDayHint') }}</p>
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsAssignmentLabel') }}</label>
                  <HeadlessSelect
                    v-model="actionModalAction.assignment.type"
                    :options="playbookAssignmentOptions"
                    teleport
                    :teleport-match-width="true"
                    button-class="!py-2 !rounded-lg !bg-white dark:!bg-gray-900/80 dark:!border-gray-700"
                  />
                  <input
                    v-if="['specific_user', 'role', 'team'].includes(actionModalAction.assignment.type)"
                    v-model="actionModalAction.assignment.targetName"
                    class="mt-2 w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                    :placeholder="t('settings.modFieldsSpecifyAssignmentPh', { type: actionModalAction.assignment.type.replace('_', ' ') })"
                  />
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-6">
                <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <HeadlessCheckbox v-model="actionModalAction.required" checkbox-class="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                  {{ t('settings.modFieldsRequiredCompleteStage') }}
                </label>
                <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <HeadlessCheckbox v-model="actionModalAction.autoCreate" checkbox-class="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                  {{ t('settings.modFieldsAutoCreateStageStart') }}
                </label>
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsDescriptionLabel') }}</label>
                <textarea
                  v-model="actionModalAction.description"
                  rows="3"
                  class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                  :placeholder="t('settings.modFieldsActivityDescriptionPh')"
                ></textarea>
              </div>
            </div>

            <div class="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 p-5">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.modFieldsTriggerAutomation') }}</h3>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsTriggerAutomationHint') }}</span>
              </div>
              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsTriggerTypeLabel') }}</label>
                  <HeadlessSelect
                    v-model="actionModalAction.trigger.type"
                    :options="playbookTriggerOptions"
                    teleport
                    :teleport-match-width="true"
                    button-class="!py-2 !rounded-lg !bg-white dark:!bg-gray-900/80 dark:!border-gray-700"
                    @update:model-value="handleTriggerTypeChange(actionModalAction)"
                  />
                </div>
                <div v-if="actionModalAction.trigger.type === 'after_action'">
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsWaitForActivity') }}</label>
                  <HeadlessSelect
                    v-model="actionModalAction.trigger.sourceActionKey"
                    :options="getActionOptions(actionModalStage, actionModalAction)"
                    :placeholder="t('settings.modFieldsSelectActivityPh')"
                    allow-empty
                    :empty-label="t('settings.modFieldsSelectActivityPh')"
                    empty-value=""
                    teleport
                    :teleport-match-width="true"
                    button-class="!py-2 !rounded-lg !bg-white dark:!bg-gray-900/80 dark:!border-gray-700"
                  />
                  <p class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsUnlockAfterCompleteHint') }}</p>
                </div>
              </div>
              <div v-if="actionModalAction.trigger.type === 'time_delay'" class="grid gap-4 md:grid-cols-2">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsDelayAmount') }}</label>
                  <input
                    type="number"
                    min="0"
                    :value="actionModalAction.trigger.delay?.amount ?? 0"
                    @input="updateTriggerDelayAmount(actionModalAction, $event.target.value)"
                    class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsDelayUnit') }}</label>
                  <HeadlessSelect
                    :model-value="actionModalAction.trigger.delay?.unit || 'hours'"
                    :options="playbookDelayUnitOptions"
                    teleport
                    button-class="!py-2 !rounded-lg !bg-white dark:!bg-gray-900/80 dark:!border-gray-700"
                    @update:model-value="updateTriggerDelayUnit(actionModalAction, $event)"
                  />
                </div>
              </div>
              <div v-if="actionModalAction.trigger.type === 'custom'" class="space-y-2">
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsCustomTriggerDetails') }}</label>
                <textarea
                  v-model="actionModalAction.trigger.description"
                  rows="3"
                  class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                  :placeholder="t('settings.modFieldsCustomTriggerPh')"
                ></textarea>
              </div>
              <div v-if="actionModalAction.trigger.conditions?.length" class="rounded-lg bg-white/70 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 p-3 text-xs text-gray-600 dark:text-gray-300">
                <p class="font-medium mb-2">{{ t('settings.modFieldsExistingConditions') }}</p>
                <ul class="space-y-1">
                  <li v-for="(condition, conditionIndex) in actionModalAction.trigger.conditions" :key="conditionIndex">
                    • {{ t('settings.modFieldsConditionLine', {
                      field: condition.field || t('settings.modFieldsConditionFieldFallback'),
                      operator: condition.operator || t('settings.modFieldsConditionEquals'),
                      value: condition.value ?? '—'
                    }) }}
                  </li>
                </ul>
              </div>
            </div>

            <div class="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 p-5">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.modFieldsDependenciesTitle') }}</h3>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsDependenciesHint') }}</span>
              </div>
              <div v-if="getActionOptions(actionModalStage, actionModalAction).length" class="space-y-2">
                <label
                  v-for="option in getActionOptions(actionModalStage, actionModalAction)"
                  :key="option.value"
                  class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  <HeadlessCheckbox
                    :checked="actionModalAction.dependencies?.includes(option.value)"
                    @change="toggleActionDependency(actionModalStage, actionModalAction, option.value, $event.target.checked)"
                    checkbox-class="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                  />
                  {{ option.label }}
                </label>
              </div>
              <div v-else class="text-xs text-gray-500 dark:text-gray-400">
                {{ t('settings.modFieldsAddActivityForDeps') }}
              </div>
            </div>

            <div class="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 p-5">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.modFieldsAlertsReminders') }}</h3>
                <button
                  class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm hover:shadow"
                  @click="addActionAlert(actionModalStage, actionModalAction)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  {{ t('settings.modFieldsAddAlert') }}
                </button>
              </div>
              <div v-if="!actionModalAction.alerts?.length" class="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 px-4 py-6 text-xs text-gray-500 dark:text-gray-400 text-center">
                {{ t('settings.modFieldsNoAlerts') }}
              </div>
              <div v-else class="space-y-4">
                <div
                  v-for="(alert, alertIndex) in actionModalAction.alerts"
                  :key="alertIndex"
                  class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/70 p-4 space-y-4"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsAlertNumber', { number: alertIndex + 1 }) }}</span>
                    <button
                      class="text-xs text-red-600 dark:text-red-300 hover:underline"
                      @click="removeActionAlert(actionModalStage, actionModalAction, alertIndex)"
                    >
                      {{ t('actions.remove') }}
                    </button>
                  </div>
                  <div class="grid gap-4 md:grid-cols-2">
                    <div>
                      <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsAlertTypeLabel') }}</label>
                      <HeadlessSelect
                        v-model="alert.type"
                        :options="playbookAlertTypeOptions"
                        teleport
                        :teleport-match-width="true"
                        button-class="!py-2 !rounded-lg !bg-white dark:!bg-gray-900/80 dark:!border-gray-700"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsSendOffset') }}</label>
                      <div class="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          :value="alert.offset?.amount ?? 0"
                          @input="updateAlertOffsetAmount(alert, $event.target.value)"
                          class="w-24 px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                        />
                        <HeadlessSelect
                          :model-value="alert.offset?.unit || 'hours'"
                          :options="playbookDelayUnitOptions"
                          teleport
                          wrapper-class="flex-1 min-w-0"
                          button-class="!py-2 !rounded-lg !bg-white dark:!bg-gray-900/80 dark:!border-gray-700"
                          @update:model-value="updateAlertOffsetUnit(alert, $event)"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsRecipientsLabel') }}</label>
                    <input
                      :value="(alert.recipients || []).join(', ')"
                      @input="updateAlertRecipients(alert, $event.target.value)"
                      class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                      :placeholder="t('settings.modFieldsRecipientsPh')"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsMessageLabel') }}</label>
                    <textarea
                      v-model="alert.message"
                      rows="2"
                      class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                      :placeholder="t('settings.modFieldsAlertMessagePh')"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>

            <div class="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 p-5">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.modFieldsResourcesTitle') }}</h3>
                <button
                  class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm hover:shadow"
                  @click="addActionResource(actionModalStage, actionModalAction)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  {{ t('settings.modFieldsAddResource') }}
                </button>
              </div>
              <div v-if="!actionModalAction.resources?.length" class="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 px-4 py-6 text-xs text-gray-500 dark:text-gray-400 text-center">
                {{ t('settings.modFieldsNoResources') }}
              </div>
              <div v-else class="space-y-4">
                <div
                  v-for="(resource, resourceIndex) in actionModalAction.resources"
                  :key="resourceIndex"
                  class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/70 p-4 space-y-4"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsResourceNumber', { number: resourceIndex + 1 }) }}</span>
                    <button
                      class="text-xs text-red-600 dark:text-red-300 hover:underline"
                      @click="removeActionResource(actionModalStage, actionModalAction, resourceIndex)"
                    >
                      {{ t('actions.remove') }}
                    </button>
                  </div>
                  <div class="grid gap-4 md:grid-cols-2">
                    <div>
                      <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsNameLabel') }}</label>
                      <input
                        v-model="resource.name"
                        class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                        :placeholder="t('settings.modFieldsResourceNamePh')"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsType') }}</label>
                      <HeadlessSelect
                        v-model="resource.type"
                        :options="playbookResourceTypes"
                        teleport
                        :teleport-match-width="true"
                        button-class="!py-2 !rounded-lg !bg-white dark:!bg-gray-900/80 dark:!border-gray-700"
                      />
                    </div>
                    <div class="md:col-span-2">
                      <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsUrlAttachmentRef') }}</label>
                      <input
                        v-model="resource.url"
                        class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                        :placeholder="t('settings.modFieldsUrlPh')"
                      />
                    </div>
                    <div class="md:col-span-2">
                      <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsDescriptionLabel') }}</label>
                      <textarea
                        v-model="resource.description"
                        rows="2"
                        class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                        :placeholder="t('settings.modFieldsResourceDescriptionPh')"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <ModuleFormModal
      v-if="showFormModal"
      :module="editingModule"
      @close="closeFormModal"
      @saved="handleModuleSaved"
    />

    <ManageFieldSectionsDrawer
      :is-open="showManageSections"
      :layout="fieldLayout || { version: 1, sections: [] }"
      :fields="editFields"
      @close="showManageSections = false"
      @save="onManageSectionsSave"
    />

    <AddCustomFieldDrawer
      :is-open="showAddFieldDrawer"
      :module-name="selectedModule?.name || ''"
      :next-order="editFields.length"
      :show-app-participation-scope="showCustomFieldParticipationScope && customFieldAppScopeOptions.length > 0"
      :app-scope-options="customFieldAppScopeOptions"
      :section-options="addFieldSectionOptions"
      :initial-section-id="addFieldTargetSectionId"
      @close="closeAddFieldDrawer"
      @save="handleAddFieldFromDrawer"
    />

    <TransitionRoot as="template" :show="showDeleteFieldConfirm">
      <Dialog class="relative z-50" @close="showDeleteFieldConfirm = false">
        <TransitionChild as="template" enter="ease-out duration-200" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
          <div class="fixed inset-0 bg-gray-500/75 dark:bg-gray-900/75" />
        </TransitionChild>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <TransitionChild as="template" enter="ease-out duration-200" enter-from="opacity-0 scale-95" enter-to="opacity-100 scale-100" leave="ease-in duration-200" leave-from="opacity-100 scale-100" leave-to="opacity-0 scale-95">
            <DialogPanel class="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl">
              <div class="flex gap-4">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
                  <ExclamationTriangleIcon class="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                </div>
                <div class="flex-1">
                  <DialogTitle as="h3" class="text-base font-semibold text-gray-900 dark:text-white">
                    {{ t('settings.modFieldsDeleteFieldDialogTitle') }}
                  </DialogTitle>
                  <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {{ t('settings.modFieldsDeleteFieldConfirm', {
                      name: currentField?.label || currentField?.key || t('settings.modFieldsThisField')
                    }) }}
                  </p>
                  <div class="mt-4 flex justify-end gap-3">
                    <button
                      type="button"
                      class="rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                      @click="showDeleteFieldConfirm = false"
                    >
                      {{ t('actions.cancel') }}
                    </button>
                    <button
                      type="button"
                      class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                      @click="confirmDeleteField"
                    >
                      {{ t('actions.delete') }}
                    </button>
                  </div>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </TransitionRoot>

    <SettingsSaveBar
      :visible="modulePageDirty"
      :saving="modulePageSaving"
      @reset="resetModulePageChanges"
      @save="saveModulePageChanges"
    />
  </div>
</template>

<script setup>
import { useNotifications } from '@/composables/useNotifications';

import { confirmAction } from '@/composables/useConfirmAction';
// See docs/architecture/form-settings-doctrine.md
// Form Settings are configuration-only and must respect domain boundaries

import { ref, onMounted, onUnmounted, computed, watch, reactive, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { Switch, Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import apiClient from '@/utils/apiClient';
import { invalidateTenantSchemaCaches, fetchModulesListCached, fetchModuleDefinitionCached } from '@/utils/tenantSchemaApiCache';
import { getDefaultEmailValidations } from '@/utils/defaultFieldValidations';
import {
  getEnabledCurrencyOptions,
  getCurrencySymbolFromCode,
  formatCurrencyValue,
  resolveOrgCurrencyCode,
} from '@/utils/currencyOptions';
import { PLATFORM_MODULE_FIELD_TYPES } from '@/constants/moduleFieldTypes';
import { parsePeopleTypesApiPayload, peopleTypeColorToHex } from '@/utils/peopleTypeColors';
import { peopleTypesCacheVersion } from '@/utils/peopleTypesInvalidate';
import {
  isPeopleSalesRoleFieldKey,
  PEOPLE_SALES_ROLE_FIELD_KEYS_NORMALIZED
} from '@/utils/peopleParticipationUi';
import {
  PLATFORM_DEFAULT_PICKLIST_COLOR,
  nextPicklistOptionColor,
  resolveNewPicklistOptionColor,
  backfillPicklistOptionColors,
  normalizePicklistColorKey,
} from '@/utils/picklistColorPalette';
import DatePicker from '@/components/common/DatePicker.vue';
import DateTimePicker from '@/components/common/DateTimePicker.vue';
import ModuleFormModal from './ModuleFormModal.vue';
import PeopleTypesSettings from './PeopleTypesSettings.vue';
import OrganizationTypesSettings from './OrganizationTypesSettings.vue';
import DuplicatePreventionSettings from './DuplicatePreventionSettings.vue';
import ClosedRecordsSettings from './ClosedRecordsSettings.vue';
import { isClosedRecordsEligibleModule } from '@/constants/closedRecordsModulesClient';
import EventStatusLifecycleSettings from './EventStatusLifecycleSettings.vue';
import { invalidateOrganizationTypesCache } from '@/utils/organizationTypesInvalidate';
import { isRetiredOrganizationTypeValue } from '@/utils/organizationTypeConfig';
import {
  ORGANIZATION_STATUS_FIELD_KEYS,
  getDefaultOrganizationStatusFieldOptions,
} from '@/utils/organizationStatusDefaults';
import {
  getOrganizationFieldsForType,
  getOrganizationTypeScopedFieldPool
} from '@/platform/fields/organizationFieldModel';
import AddCustomFieldDrawer from './AddCustomFieldDrawer.vue';
import FieldConfigSectionList from './FieldConfigSectionList.vue';
import ManageFieldSectionsDrawer from './ManageFieldSectionsDrawer.vue';
import {
  applyFieldLayoutToModuleState,
  moveFieldAcrossLayout,
  moveFieldToSection,
  getDefaultSectionIdForModule,
  resolveSectionDisplayLabel
} from '@/platform/fields/fieldLayout';
import RelationshipFormDrawer from './RelationshipFormDrawer.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import { SETTINGS_SAVE_BAR_CONTENT_CLASS } from '@/components/settings/settingsSaveBar';
import {
  ArrowsUpDownIcon,
  ExclamationTriangleIcon,
  UsersIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  FolderIcon,
  ClipboardDocumentListIcon,
  BanknotesIcon,
  LifebuoyIcon,
  TicketIcon,
  CubeIcon
} from '@heroicons/vue/24/outline';
import { MODULE_ICON_COMPONENTS } from '@/utils/moduleIcons';

// DEV-only guards: Forms Settings must never support execution
if (process.env.NODE_ENV === 'development') {
  // This guard ensures Forms Settings never expose execution capabilities
  // Forms Settings configure structure & behavior ONLY.
  // Execution must never be configurable for Forms module.
  // See: docs/architecture/form-settings-doctrine.md
  // See: client/src/platform/modules/forms/formsModule.definition.ts
}

import {
  FORM_SETTINGS_TABS,
  getFieldsForTab,
  getFieldMapping
} from '@/platform/forms/formSettingsMap';
import {
  FORM_SETTINGS_CAPABILITIES,
  isCapabilityLocked,
  hasCapability
} from '@/platform/forms/formSettingsCapabilities';
import {
  deriveFormSettingsPermissions,
  getFormSettingsActionLabel
} from '@/platform/forms/formSettingsPermissions';
import {
  FORM_TYPE_DEFINITIONS,
  getFormTypeDefinitions,
  getCustomFormTypes,
  removeCustomFormType,
  getBuiltInFormTypes,
  isBuiltInFormType,
  getFormTypeDefinition,
  addCustomFormType
} from '@/platform/forms/formTypeRegistry';
import {
  PEOPLE_FIELD_METADATA,
  PEOPLE_QUICK_CREATE_DEFAULT,
  getFieldMetadata,
  getCoreIdentityFields,
  getParticipationFields,
  getStateFields,
  getDetailFields
} from '@/platform/fields/peopleFieldModel';
import { isGlobalSystemFieldKey } from '@/platform/fields/globalSystemFields';
import {
  TASK_FIELD_METADATA,
  getTaskFieldMetadata,
  getCoreTaskFields,
  getTaskSystemFields,
  getTaskParticipationFields,
  getTaskQuickCreateFields,
  isTaskCoreField,
  isTaskProtectedField,
  groupTaskFields,
  classifyTaskField
} from '@/platform/fields/taskFieldModel';
import {
  ORGANIZATION_FIELD_METADATA,
  getOrganizationFieldMetadata,
  getCoreOrganizationFields,
  getOrganizationSystemFields,
  getOrganizationParticipationFields,
  isOrganizationCoreField,
  isOrganizationProtectedField,
  groupOrganizationFields,
  classifyOrganizationField,
  isTenantPlatformOrganizationFieldKey,
  ORGANIZATION_QUICK_CREATE_DEFAULT,
} from '@/platform/fields/organizationFieldModel';
import {
  DEAL_FIELD_METADATA,
  getDealFieldMetadata,
  getCoreDealFields,
  getDealSystemFields,
  getDealParticipationFields,
  getDealQuickCreateFields,
  isDealCoreField,
  isDealProtectedField,
  groupDealFields,
  classifyDealField,
  DEAL_QUICK_CREATE_DEFAULT,
} from '@/platform/fields/dealFieldModel';
import {
  classifyCaseField,
  CASE_QUICK_CREATE_DEFAULT,
} from '@/platform/fields/caseFieldModel';
import {
  classifyInventoryWorkbenchField,
  isInventoryWorkbenchModuleKey,
} from '@/platform/fields/inventoryWorkbenchFieldModel';
import {
  EVENT_FIELD_METADATA,
  getEventFieldMetadata,
  getCoreEventFields,
  getEventSystemFields,
  getEventParticipationFields,
  getEventQuickCreateFields,
  isEventCoreField,
  isEventProtectedField,
  groupEventFields,
  classifyEventField
} from '@/platform/fields/eventFieldModel';
import {
  ITEM_FIELD_METADATA,
  getItemFieldMetadata,
  shouldShowItemFieldForCapabilities,
  getCoreItemFields,
  getItemSystemFields,
  getItemParticipationFields,
  getItemQuickCreateFields,
  isItemCoreField,
  isItemProtectedField,
  groupItemFields,
  classifyItemField
} from '@/platform/fields/itemFieldModel';
import {
  filterItemTypeOptionsForCapabilities,
  filterModuleFieldsForInventory,
} from '@/utils/inventoryCapability';
import {
  classifyQuoteField,
  isQuoteProtectedField,
  isExcludedFromQuoteQuickCreate
} from '@/platform/fields/quoteFieldModel';
import {
  classifySalesOrderField,
  isSalesOrderProtectedField,
  isExcludedFromSalesOrderQuickCreate
} from '@/platform/fields/salesOrderFieldModel';
import {
  classifyInvoiceField,
  isInvoiceProtectedField,
  isExcludedFromInvoiceQuickCreate
} from '@/platform/fields/invoiceFieldModel';
import {
  classifyPaymentField,
  isPaymentProtectedField,
  isExcludedFromPaymentQuickCreate
} from '@/platform/fields/paymentFieldModel';
import {
  classifyDocumentField,
  isDocumentProtectedField,
  isExcludedFromDocumentQuickCreate
} from '@/platform/fields/documentsFieldModel';
import {
  CATALOG_LIFECYCLE_STATES,
  CATALOG_LIFECYCLE_LABEL_KEYS
} from '@/constants/catalogLifecycle';
import { isSystemField as isSystemFieldFromEngine } from '@/platform/fields/fieldCapabilityEngine';
import {
  mergeFields,
  filterToVisibleInConfig,
  getFallbackMetadataForVisibleInConfig
} from '@/platform/fields/fieldMerge';
import {
  getFieldMetadataMap,
  getFieldMetadataFromRegistry,
  isModuleRegistered
} from '@/platform/fields/FieldRegistry';

const props = defineProps({
  moduleFilter: {
    type: Function,
    default: null
  },
  contextFilter: {
    type: Function,
    default: null
  },
  hideFieldCreation: {
    type: Boolean,
    default: false
  },
  excludedTabs: {
    type: Array,
    default: () => []
  },
  title: {
    type: String,
    default: 'Modules & Fields'
  },
  hideHeader: {
    type: Boolean,
    default: false
  },
  /** When true, do not auto-select a module from URL; show the module cards list first (e.g. Sales Modules) */
  startWithModuleList: {
    type: Boolean,
    default: false
  },
  /** Optional callback when user clicks "Open Pipelines & Stages" from Deal Stage/Pipeline field config (e.g. Sales app switches to Pipelines tab) */
  onNavigateToPipelines: {
    type: Function,
    default: null
  }
});

const { t } = useI18n();
const notifications = useNotifications();


function dependencyOptionCountLabel(count) {
  return count === 1
    ? t('settings.modFieldsOptionCountOne', { count })
    : t('settings.modFieldsOptionCountOther', { count });
}

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();
const modules = ref([]);
const loading = ref(false);
const selectedModuleId = ref(null);
const showFormModal = ref(false);
const editingModule = ref(null);
const editFields = ref([]);
const selectedFieldIdx = ref(0);
const fieldLayout = ref(null);
const showManageSections = ref(false);

/**
 * Normalize fields for Field Configuration UI.
 * Metadata-driven: uses isVisibleInConfig; no hardcoded key lists.
 * - For modules with metadata: merges metadata + backend, filters by isVisibleInConfig
 * - For Forms/other: filters using fallback metadata for known infrastructure keys
 */
function normalizeFieldsForConfig(moduleKey, fields) {
  if (!Array.isArray(fields)) return fields;
  const backendFields = fields.filter((f) => f?.key).map(stripLegacyDefaultPhoneValidations);
  const mk = String(moduleKey || '').toLowerCase().trim();

  if (isModuleRegistered(moduleKey)) {
    const metadataMap = getFieldMetadataMap(moduleKey);
    if (metadataMap) {
      const getMetadata = (key) => getFieldMetadataFromRegistry(moduleKey, key);
      const merged = mergeFields(metadataMap, backendFields, {
        moduleKey,
        getMetadata
      });
      const hydrated = mk === 'items' ? hydrateItemsPicklistDefaults(merged) : merged;
      return filterModuleFieldsForInventory(mk, hydrated, authStore.inventoryEnabled);
    }
  }

  // Forms and modules without metadata: filter by fallback
  const filtered = filterToVisibleInConfig(backendFields, (key) => getFallbackMetadataForVisibleInConfig(key));
  return mk === 'items' ? hydrateItemsPicklistDefaults(filtered) : filtered;
}

function hydrateItemsPicklistDefaults(fields) {
  const UNIT_OF_MEASURE_DEFAULTS = ['pcs', 'liters', 'hours', 'boxes', 'kg', 'meters', 'units'];
  const ITEM_TYPE_DEFAULTS = filterItemTypeOptionsForCapabilities(
    [
      { value: 'Product' },
      { value: 'Service' },
      { value: 'Serialized Product' },
      { value: 'Non-Stock Product' },
      { value: 'Bundle' },
    ],
    authStore.inventoryEnabled
  ).map((row) => row.value);
  const LIFECYCLE_DEFAULTS = ['Draft', 'Active', 'Discontinued', 'Archived'];
  return (Array.isArray(fields) ? fields : []).map((f) => {
    const key = String(f?.key || '').toLowerCase().trim();
    if (!key) return f;
    if ((key === 'unit_of_measure' || key === 'item_type' || key === 'lifecycle_state')
      && (!Array.isArray(f.options) || f.options.length === 0)) {
      const values = key === 'unit_of_measure'
        ? UNIT_OF_MEASURE_DEFAULTS
        : key === 'item_type'
          ? ITEM_TYPE_DEFAULTS
          : LIFECYCLE_DEFAULTS;
      // Use object options so the Settings picklist editor can attach color/labels consistently.
      return { ...f, options: values.map((v) => ({ value: v })) };
    }
    return f;
  });
}

function isLegacyDefaultPhoneValidation(validation) {
  if (!validation || validation.type !== 'regex') return false;
  return [
    '^(?:\\d{10})?$',
    '^\\d{10}$',
    '^(?:\\+[1-9]\\d{6,14})?$',
  ].includes(validation.pattern);
}

function stripLegacyDefaultPhoneValidations(field) {
  if (!field || field.dataType !== 'Phone' || !Array.isArray(field.validations)) return field;
  if (field.validations.length === 0) return field;
  if (!field.validations.every(isLegacyDefaultPhoneValidation)) return field;
  return { ...field, validations: [] };
}

// Filter modules for display - exclude 'users' from main list (it's only for lookups)
// Also apply optional moduleFilter prop if provided
const displayModules = computed(() => {
  let filtered = modules.value.filter(m => m.key !== 'users');
  if (props.moduleFilter) {
    filtered = filtered.filter(props.moduleFilter);
  }
  return filtered;
});

// Module card icon (match Core Modules list)
const moduleCardIconMap = {
  people: UsersIcon,
  organizations: BuildingOfficeIcon,
  tasks: CheckCircleIcon,
  events: CalendarDaysIcon,
  items: FolderIcon,
  forms: ClipboardDocumentListIcon,
  ...MODULE_ICON_COMPONENTS,
  deals: BanknotesIcon,
  cases: TicketIcon
};
function getModuleCardIcon(mod) {
  const key = String((mod && mod.key) || mod || '').toLowerCase();
  const app = String((mod && (mod.appKey || mod.app)) || '').toUpperCase();
  if (key === 'cases' && app === 'AUDIT') {
    return ExclamationTriangleIcon;
  }
  return moduleCardIconMap[key] || CubeIcon;
}

/** Platform core banner — not for app-owned system modules (Inventory PO, Sales deals, Helpdesk cases). */
function showPlatformOwnedCapabilityBanner(mod) {
  if (!mod) return false;
  if (mod.platformOwned === true) return true;
  if (mod.type !== 'system') return false;
  const appKey = String(mod.appKey || mod.app || '').toLowerCase();
  if (appKey && appKey !== 'platform') return false;
  return true;
}

const DEAL_RELATIONSHIP_DEFAULTS = Object.freeze([
  { name: 'Related Projects', type: 'one_to_many', isLookup: false, targetModuleKey: 'projects', relationshipKey: 'deal_projects' },
  { name: 'Related Organizations', type: 'many_to_one', isLookup: true, targetModuleKey: 'organizations', relationshipKey: 'deal_organizations' },
  { name: 'Related Contacts', type: 'many_to_many', isLookup: false, targetModuleKey: 'people', relationshipKey: 'deal_contacts' },
  { name: 'Related Tasks', type: 'one_to_many', isLookup: false, targetModuleKey: 'tasks', relationshipKey: 'deal_tasks' },
  { name: 'Related Events', type: 'one_to_many', isLookup: false, targetModuleKey: 'events', relationshipKey: 'deal_events' },
  { name: 'Related Forms', type: 'one_to_many', isLookup: false, targetModuleKey: 'forms', relationshipKey: 'deal_forms' },
  { name: 'Related Quotes', type: 'one_to_many', isLookup: false, targetModuleKey: 'quotes', relationshipKey: 'quote_deals' },
  { name: 'Related Documents', type: 'many_to_many', isLookup: false, targetModuleKey: 'documents', relationshipKey: 'deal_documents' }
]);

const PEOPLE_RELATIONSHIP_DEFAULTS = Object.freeze([
  { name: 'Related Organization', type: 'many_to_one', isLookup: true, targetModuleKey: 'organizations', relationshipKey: 'people_organizations' },
  { name: 'Related Deals', type: 'many_to_many', isLookup: false, targetModuleKey: 'deals', relationshipKey: 'people_deals' },
  { name: 'Related Tasks', type: 'many_to_many', isLookup: false, targetModuleKey: 'tasks', relationshipKey: 'people_tasks' },
  { name: 'Related Events', type: 'many_to_many', isLookup: false, targetModuleKey: 'events', relationshipKey: 'people_events' },
  { name: 'Related Quotes', type: 'one_to_many', isLookup: false, targetModuleKey: 'quotes', relationshipKey: 'quote_people' },
  { name: 'Related Documents', type: 'many_to_many', isLookup: false, targetModuleKey: 'documents', relationshipKey: 'people_documents' }
]);

const ORGANIZATIONS_RELATIONSHIP_DEFAULTS = Object.freeze([
  { name: 'Related Contacts', type: 'one_to_many', isLookup: false, targetModuleKey: 'people', relationshipKey: 'people_organizations' },
  { name: 'Related Deals', type: 'one_to_many', isLookup: false, targetModuleKey: 'deals', relationshipKey: 'deal_organizations' },
  { name: 'Related Quotes', type: 'one_to_many', isLookup: false, targetModuleKey: 'quotes', relationshipKey: 'quote_organizations' },
  { name: 'Related Documents', type: 'many_to_many', isLookup: false, targetModuleKey: 'documents', relationshipKey: 'organizations_documents' }
]);

const CASES_RELATIONSHIP_DEFAULTS = Object.freeze([
  { name: 'Related Contact', type: 'many_to_one', isLookup: true, targetModuleKey: 'people', relationshipKey: 'case_people' },
  { name: 'Related Organization', type: 'many_to_one', isLookup: true, targetModuleKey: 'organizations', relationshipKey: 'case_organizations' },
  { name: 'Related Tasks', type: 'many_to_many', isLookup: false, targetModuleKey: 'tasks', relationshipKey: 'task_cases' }
]);

function createRelationshipDefaultsForModule(moduleKey) {
  const normalized = String(moduleKey || '').toLowerCase();
  if (normalized === 'deals') return DEAL_RELATIONSHIP_DEFAULTS.map(rel => ({ ...rel }));
  if (normalized === 'people') return PEOPLE_RELATIONSHIP_DEFAULTS.map(rel => ({ ...rel }));
  if (normalized === 'organizations') return ORGANIZATIONS_RELATIONSHIP_DEFAULTS.map(rel => ({ ...rel }));
  if (normalized === 'cases') return CASES_RELATIONSHIP_DEFAULTS.map(rel => ({ ...rel }));
  return [];
}

function ensureModuleDefaultRelationships(moduleDef) {
  if (!moduleDef || typeof moduleDef !== 'object') return moduleDef;
  const moduleKey = String(moduleDef.key || moduleDef.moduleKey || '').toLowerCase();
  const hasRelationships = Array.isArray(moduleDef.relationships) && moduleDef.relationships.length > 0;
  if ((moduleKey === 'deals' || moduleKey === 'people' || moduleKey === 'organizations' || moduleKey === 'cases') && !hasRelationships) {
    moduleDef.relationships = createRelationshipDefaultsForModule(moduleKey);
  }
  return moduleDef;
}

function normalizeModulesForSettingsDefaults(moduleList) {
  if (!Array.isArray(moduleList)) return [];
  return moduleList.map(mod => ensureModuleDefaultRelationships({ ...mod }));
}

function ensureDefaultRelationshipsInState(moduleDef) {
  const moduleKey = String(moduleDef?.key || moduleDef?.moduleKey || '').toLowerCase();
  if (moduleKey !== 'deals' && moduleKey !== 'people' && moduleKey !== 'organizations' && moduleKey !== 'cases') return;
  if (Array.isArray(relationships.value) && relationships.value.length > 0) return;
  relationships.value = createRelationshipDefaultsForModule(moduleKey);
}

function getModuleCardCounts(mod) {
  const fields = typeof mod.fieldCount === 'number' ? mod.fieldCount : (Array.isArray(mod.fields) ? mod.fields.length : 0);
  const relationships = Array.isArray(mod.relationships) ? mod.relationships.length : 0;
  return { fields, relationships };
}

function formatModuleCardCounts(mod) {
  const counts = getModuleCardCounts(mod);
  return t('settings.modFieldsCardCounts', counts);
}

function participationGroupTitle(appKey) {
  if (appKey === 'SALES') return t('settings.modFieldsParticipationSales');
  if (appKey === 'AUDIT') return t('settings.modFieldsParticipationAudit');
  return t('settings.modFieldsParticipationApp', { app: appKey });
}

const optionsBuffer = ref('');
const editingOptionIdx = ref(-1);
const editOptionValue = ref('');
const allowedValuesBuffers = ref({});
const fieldTypes = PLATFORM_MODULE_FIELD_TYPES;
const fieldTypeSelectOptions = fieldTypes.map((ft) => ({ value: ft, label: ft }));

const dateFormatSelectOptions = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MMM DD, YYYY', label: 'MMM DD, YYYY' },
];

const timeFormatSelectOptions = computed(() => [
  { value: '12h', label: t('settings.modFieldsTime12h') },
  { value: '24h', label: t('settings.modFieldsTime24h') },
]);

const formulaReturnTypeSelectOptions = computed(() => [
  { value: 'Text', label: t('settings.modFieldsReturnTypeText') },
  { value: 'Number', label: t('settings.modFieldsReturnTypeNumber') },
  { value: 'Date', label: t('settings.modFieldsReturnTypeDate') },
  { value: 'Checkbox', label: t('settings.modFieldsReturnTypeCheckbox') },
]);

const validationTypeSelectOptions = computed(() => [
  { value: 'regex', label: t('settings.modFieldsValidationRegex') },
  { value: 'length', label: t('settings.modFieldsValidationLength') },
  { value: 'range', label: t('settings.modFieldsValidationRange') },
  { value: 'picklist_single', label: t('settings.modFieldsValidationPicklistSingle') },
  { value: 'picklist_multi', label: t('settings.modFieldsValidationPicklistMulti') },
  { value: 'email', label: t('settings.modFieldsValidationEmail') },
]);

const formTypeSelectOptions = computed(() =>
  (getFormTypeDefinitions() || []).map((type) => ({
    value: type.key,
    label: `${type.label} ${type.builtIn ? t('settings.modFieldsFormTypeBuiltIn') : t('settings.modFieldsFormTypeCustom')}`,
  }))
);

const lookupModuleSelectOptions = computed(() =>
  (modules.value || []).map((m) => ({
    value: m.key,
    label: m.name || m.key,
  }))
);

const lookupDisplayFieldSelectOptions = computed(() =>
  (lookupTargetFields.value || []).map((f) => ({
    value: f.key,
    label: f.label || f.key,
  }))
);

const defaultPicklistSelectOptions = computed(() =>
  (normalizedOptions.value || []).map((opt) => ({
    value: getOptionValue(opt),
    label: getOptionDisplayLabel(opt),
  }))
);

function toggleDefaultMultiPicklistOption(optValue) {
  const current = [...defaultValueMultiPicklist.value];
  const idx = current.indexOf(optValue);
  if (idx >= 0) current.splice(idx, 1);
  else current.push(optValue);
  defaultValueMultiPicklist.value = current;
}
const selectedModule = computed(() => modules.value.find(m => m._id === selectedModuleId.value));

// Form Settings Permissions (explanatory only, not enforcement)
// ARCHITECTURE NOTE: Permissions here are explanatory, not enforcement.
// Actual enforcement happens at API & surface level.
// This mirrors Event Execution permission design.
// See: client/src/platform/forms/formSettingsPermissions.ts
const formSettingsPermissions = computed(() => {
  if (!isFormsModule.value) {
    return [];
  }
  return deriveFormSettingsPermissions();
});
const dragStartIdx = ref(null);
const dragOverIdx = ref(null);
const baseTopTabs = [
  { id: 'details', nameKey: 'settings.modFieldsTabDetails' },
  { id: 'fields', nameKey: 'settings.modFieldsTabFields' },
  { id: 'relationships', nameKey: 'settings.modFieldsTabRelationships' },
  { id: 'quick', nameKey: 'settings.modFieldsTabQuick' },
];

function mapTopTab(tab) {
  return { id: tab.id, name: t(tab.nameKey) };
}
const TOP_TAB_IDS_BASE = ['details', 'fields', 'relationships', 'quick'];
function appendClosedStatesTabIfEligible(tabs, moduleKey) {
  if (isClosedRecordsEligibleModule(moduleKey) && !tabs.includes('closed-states')) {
    tabs.push('closed-states');
  }
  return tabs;
}
function getAllowedTopTabs(moduleKey) {
  if (moduleKey === 'forms') {
    // Forms module has custom tabs: details, fields, logic, outcomes, access, relationships
    // Forms module doesn't have Quick Create tab
    return ['details', 'fields', 'logic', 'outcomes', 'access', 'relationships'];
  }
  if (moduleKey === 'deals') {
    return appendClosedStatesTabIfEligible([...TOP_TAB_IDS_BASE, 'pipeline', 'duplicate-prevention'], moduleKey);
  }
  if (moduleKey === 'people') {
    return [...TOP_TAB_IDS_BASE, 'people-types', 'duplicate-prevention'];
  }
  if (moduleKey === 'organizations') {
    // Types = app participation roles (status picklists live under Field Configurations)
    return [...TOP_TAB_IDS_BASE, 'organization-types', 'duplicate-prevention'];
  }
  if (moduleKey === 'tasks') {
    // Tasks module has Status & Priority tab (Tasks-specific, unlike People)
    return appendClosedStatesTabIfEligible([...TOP_TAB_IDS_BASE, 'status-priority', 'duplicate-prevention'], moduleKey);
  }
  if (moduleKey === 'cases') {
    return appendClosedStatesTabIfEligible([...TOP_TAB_IDS_BASE, 'duplicate-prevention'], moduleKey);
  }
  if (moduleKey === 'events') {
    // Events module has Status tab and Roles & Rules tab (Events-specific)
    // ARCHITECTURE NOTE: Events Settings configure structure and constraints, not behavior.
    // Status tab: System-locked event statuses (Planned, Completed, Cancelled)
    // Roles & Rules tab: Role requirements, geo rules, form linking rules per event type
    // See: docs/architecture/event-settings.md Section 2.2, 4.3, 4.4, 4.5
    return appendClosedStatesTabIfEligible([...TOP_TAB_IDS_BASE, 'status', 'roles-rules'], moduleKey);
  }
  if (moduleKey === 'items') {
    // Items module has Status & Types tab (Items-specific, similar to Tasks)
    return [...TOP_TAB_IDS_BASE, 'status-types', 'duplicate-prevention'];
  }
  if (moduleKey === 'documents') {
    return [...TOP_TAB_IDS_BASE, 'status-types'];
  }
  return appendClosedStatesTabIfEligible([...TOP_TAB_IDS_BASE], moduleKey);
}
const topTabs = computed(() => {
  const moduleKey = selectedModule.value?.key;
  const tabs = [...baseTopTabs];
  // Forms module has custom tabs: Fields Configuration, Logic & Rules, Outcomes, Access
  // ARCHITECTURE NOTE: Forms Settings configure structure & behavior ONLY.
  // Forms use the same Fields Configuration model as other core modules.
  // "Metadata" is not a separate field type — these are record fields.
  // Form content structure is managed exclusively by the Form Builder.
  // See: client/src/platform/modules/forms/formsModule.definition.ts
  if (moduleKey === 'forms') {
    return [
      { id: 'details', nameKey: 'settings.modFieldsTabDetails' },
      { id: 'fields', nameKey: 'settings.modFieldsTabFieldsForms' },
      { id: 'logic', nameKey: 'settings.modFieldsTabLogic' },
      { id: 'outcomes', nameKey: 'settings.modFieldsTabOutcomes' },
      { id: 'access', nameKey: 'settings.modFieldsTabAccess' },
      { id: 'relationships', nameKey: 'settings.modFieldsTabRelationships' },
    ].map(mapTopTab);
  }
  if (moduleKey === 'deals') {
    if (!props.excludedTabs.includes('pipeline')) {
      tabs.push({ id: 'pipeline', nameKey: 'settings.modFieldsTabPipeline' });
    }
    tabs.push({ id: 'duplicate-prevention', nameKey: 'settings.modFieldsTabDuplicatePrevention' });
  }
  if (moduleKey === 'people') {
    const fieldsTabIndex = tabs.findIndex(tab => tab.id === 'fields');
    if (fieldsTabIndex >= 0) {
      tabs.splice(fieldsTabIndex + 1, 0, { id: 'people-types', nameKey: 'settings.modFieldsTabPeopleTypes' });
    }
    tabs.push({ id: 'duplicate-prevention', nameKey: 'settings.modFieldsTabDuplicatePrevention' });
  }
  if (moduleKey === 'organizations') {
    const fieldsTabIndex = tabs.findIndex(tab => tab.id === 'fields');
    if (fieldsTabIndex >= 0) {
      tabs.splice(fieldsTabIndex + 1, 0,
        { id: 'organization-types', nameKey: 'settings.modFieldsTabOrganizationTypes' }
      );
    }
    tabs.push({ id: 'duplicate-prevention', nameKey: 'settings.modFieldsTabDuplicatePrevention' });
  }
  if (moduleKey === 'tasks') {
    // Insert "Status & Priority" tab after "Field Configurations" and before "Relationships"
    // ARCHITECTURE NOTE: Tasks have status/priority picklists (unlike People), so this tab is Tasks-specific
    // See: docs/architecture/task-settings.md Section 3.3
    const fieldsTabIndex = tabs.findIndex(tab => tab.id === 'fields');
    if (fieldsTabIndex >= 0) {
      tabs.splice(fieldsTabIndex + 1, 0, { id: 'status-priority', nameKey: 'settings.modFieldsTabStatusPriority' });
    }
    tabs.push({ id: 'duplicate-prevention', nameKey: 'settings.modFieldsTabDuplicatePrevention' });
  }
  if (moduleKey === 'events') {
    // Insert "Status" tab and "Roles & Rules" tab after "Field Configurations" and before "Relationships"
    // ARCHITECTURE NOTE: Events Settings configure structure and constraints, not behavior.
    // Status tab: System-locked event statuses (Planned, Completed, Cancelled) - required for execution
    // Roles & Rules tab: Role requirements, geo rules, form linking rules per event type
    // See: docs/architecture/event-settings.md Section 2.2, 4.3, 4.4, 4.5
    const fieldsTabIndex = tabs.findIndex(tab => tab.id === 'fields');
    if (fieldsTabIndex >= 0) {
      tabs.splice(fieldsTabIndex + 1, 0, { id: 'status', nameKey: 'settings.modFieldsTabStatus' });
      tabs.splice(fieldsTabIndex + 2, 0, { id: 'roles-rules', nameKey: 'settings.modFieldsTabRolesRules' });
    }
  }
  if (moduleKey === 'items') {
    // Insert "Status & Types" tab after "Field Configurations" and before "Relationships"
    // ARCHITECTURE NOTE: Items have status and item_type picklists, similar to Tasks
    const fieldsTabIndex = tabs.findIndex(tab => tab.id === 'fields');
    if (fieldsTabIndex >= 0) {
      tabs.splice(fieldsTabIndex + 1, 0, { id: 'status-types', nameKey: 'settings.modFieldsTabStatusTypes' });
    }
    tabs.push({ id: 'duplicate-prevention', nameKey: 'settings.modFieldsTabDuplicatePrevention' });
  }
  if (moduleKey === 'cases') {
    tabs.push({ id: 'duplicate-prevention', nameKey: 'settings.modFieldsTabDuplicatePrevention' });
  }
  if (moduleKey === 'documents') {
    const fieldsTabIndex = tabs.findIndex(tab => tab.id === 'fields');
    if (fieldsTabIndex >= 0) {
      tabs.splice(fieldsTabIndex + 1, 0, { id: 'status-types', nameKey: 'settings.modFieldsTabStatusTypes' });
    }
  }
  if (isClosedRecordsEligibleModule(moduleKey)) {
    tabs.push({ id: 'closed-states', nameKey: 'settings.modFieldsTabClosedStates' });
  }
  return tabs.map(mapTopTab);
});
const tabTitleMap = {
  details: 'Module Details',
  fields: 'Field Configurations',
  'people-types': 'Types',
  'organization-types': 'Types',
  'duplicate-prevention': 'Duplicate Prevention',
  'closed-states': 'Closed States',
  'status-types': 'Status & Types',
  'status-priority': 'Status & Priority',
  'status': 'Status',
  'roles-rules': 'Roles & Rules',
  relationships: 'Relationships',
  quick: 'Quick Create',
  pipeline: 'Pipeline Settings',
  logic: 'Logic & Rules',
  outcomes: 'Outcomes',
  access: 'Access'
};
const currentTopTabLabel = computed(() => tabTitleMap[activeTopTab.value] || 'Module Details');
// Initialize activeTopTab from URL or localStorage, default to 'fields'
const getInitialTab = () => {
  // First check URL query
  const route = useRoute();
  const modeKey = typeof route.query.mode === 'string' ? route.query.mode : null;
  if (modeKey && ['details', 'fields', 'people-types', 'organization-types', 'duplicate-prevention', 'closed-states', 'status-types', 'status-priority', 'status', 'roles-rules', 'relationships', 'quick', 'pipeline', 'logic', 'outcomes', 'access'].includes(modeKey)) {
    return modeKey;
  }
  // If no URL param, we'll check localStorage after module loads
  return 'fields';
};
const activeTopTab = ref(getInitialTab());

function setActiveTopTab(id) {
  const mod = selectedModule.value;
  if (!mod) return;
  const allowed = getAllowedTopTabs(mod.key);
  if (!allowed.includes(id)) return;
  const prev = activeTopTab.value;
  if (prev === id) return;
  if (id === 'relationships') {
    ensureDefaultRelationshipsInState(mod);
  }
  activeTopTab.value = id;
  // Update URL and localStorage immediately from click handler so the watcher doesn't trigger
  // a route change (which can cause re-renders and the "two clicks / random tab" bug)
  router.replace({ query: { ...route.query, module: mod.key, field: editFields.value[selectedFieldIdx.value]?.key || '', mode: id, subtab: activeSubTab.value } });
  try {
    localStorage.setItem(`arivu-modfields-tab-${mod.key}`, id);
  } catch (e) {}
}

const moduleNameEdit = ref('');
const moduleEnabled = ref(true);
const relationships = ref([]);
const relationshipDrawerOpen = ref(false);
const relationshipEditIndex = ref(null);
const quickCreateSelected = ref(new Set());
const quickLayout = ref({ version: 1, rows: [] });
const quickMode = ref('simple'); // Advanced mode hidden for now
const showPreview = ref(false);
const originalSnapshot = ref('');
const quickOriginalSnapshot = ref('');
const dragColSrc = ref({ ri: null, ci: null });
const dragColOver = ref({ ri: null, ci: null });
const dragRowSrc = ref(null);
const dragOptionStartIdx = ref(null);
const dragOptionOverIdx = ref(null);
const dragRowOver = ref(null);
const quickCreateDragStartIdx = ref(null);
const quickCreateDragOverIdx = ref(null);
const quickCreateFieldOrder = ref([]); // Custom order for quick create fields
// Tailwind safelist for col-span classes
const colSpanClasses = [
  'col-span-1','col-span-2','col-span-3','col-span-4','col-span-5','col-span-6',
  'col-span-7','col-span-8','col-span-9','col-span-10','col-span-11','col-span-12'
];

const pipelineSettings = ref([]);
const selectedPipelineKey = ref('');
const stageSettingsExpanded = ref({});
const actionModalState = reactive({
  open: false,
  stageKey: '',
  actionIndex: null
});
const pipelineStageStatusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won (Closed)' },
  { value: 'lost', label: 'Lost (Closed)' }
];
const DEFAULT_PIPELINE_COLOR = '#2563EB';
const DEFAULT_STAGE_COLOR = '#6B7280';
const DEFAULT_STAGE_COLORS = ['#6B7280', '#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];
const DEFAULT_STAGE_DEFINITIONS = [
  { name: 'New', probability: 0, status: 'open', color: DEFAULT_STAGE_COLORS[0] },
  { name: 'Qualification', probability: 25, status: 'open', color: DEFAULT_STAGE_COLORS[1] },
  { name: 'Proposal', probability: 50, status: 'open', color: DEFAULT_STAGE_COLORS[2] },
  { name: 'Negotiation', probability: 70, status: 'open', color: DEFAULT_STAGE_COLORS[3] },
  { name: 'Contract Sent', probability: 85, status: 'open', color: DEFAULT_STAGE_COLORS[4] },
  { name: 'Closed Won', probability: 100, status: 'won', color: DEFAULT_STAGE_COLORS[5] },
  { name: 'Closed Lost', probability: 0, status: 'lost', color: DEFAULT_STAGE_COLORS[6] }
];

const playbookActionTypes = computed(() => [
  { value: 'task', label: t('settings.modFieldsPbActionTask') },
  { value: 'call', label: t('settings.modFieldsPbActionCall') },
  { value: 'meeting', label: t('settings.modFieldsPbActionMeeting') },
  { value: 'email', label: t('settings.modFieldsPbActionEmail') },
  { value: 'event', label: t('settings.modFieldsPbActionEvent') },
  { value: 'document', label: t('settings.modFieldsPbActionDocument') },
  { value: 'approval', label: t('settings.modFieldsPbActionApproval') },
  { value: 'alert', label: t('settings.modFieldsPbActionAlert') },
  { value: 'other', label: t('settings.modFieldsPbActionOther') }
]);

const playbookModeOptions = computed(() => [
  { value: 'sequential', label: t('settings.modFieldsPbModeSequential') },
  { value: 'non_sequential', label: t('settings.modFieldsPbModeFlexible') }
]);

const playbookExitOptions = computed(() => [
  { value: 'manual', label: t('settings.modFieldsPbExitManual') },
  { value: 'all_actions_completed', label: t('settings.modFieldsPbExitAllActions') },
  { value: 'any_action_completed', label: t('settings.modFieldsPbExitAnyAction') },
  { value: 'custom', label: t('settings.modFieldsPbExitCustom') }
]);

const playbookTriggerOptions = computed(() => [
  { value: 'stage_entry', label: t('settings.modFieldsPbTriggerStageEntry') },
  { value: 'after_action', label: t('settings.modFieldsPbTriggerAfterAction') },
  { value: 'time_delay', label: t('settings.modFieldsPbTriggerTimeDelay') },
  { value: 'custom', label: t('settings.modFieldsPbTriggerCustom') }
]);

const playbookAlertTypeOptions = computed(() => [
  { value: 'in_app', label: t('settings.modFieldsPbAlertInApp') },
  { value: 'email', label: t('settings.modFieldsPbAlertEmail') },
  { value: 'sms', label: t('settings.modFieldsPbAlertSms') }
]);

const playbookDelayUnitOptions = computed(() => [
  { value: 'minutes', label: t('settings.modFieldsPbDelayMinutes') },
  { value: 'hours', label: t('settings.modFieldsPbDelayHours') },
  { value: 'days', label: t('settings.modFieldsPbDelayDays') }
]);

const playbookResourceTypes = computed(() => [
  { value: 'document', label: t('settings.modFieldsPbResourceDocument') },
  { value: 'link', label: t('settings.modFieldsPbResourceLink') },
  { value: 'form', label: t('settings.modFieldsPbResourceForm') },
  { value: 'template', label: t('settings.modFieldsPbResourceTemplate') },
  { value: 'other', label: t('settings.modFieldsPbResourceOther') }
]);

const playbookAssignmentOptions = computed(() => [
  { value: 'deal_owner', label: t('settings.modFieldsPbAssignDealOwner') },
  { value: 'stage_owner', label: t('settings.modFieldsPbAssignStageOwner') },
  { value: 'role', label: t('settings.modFieldsPbAssignRole') },
  { value: 'team', label: t('settings.modFieldsPbAssignTeam') },
  { value: 'specific_user', label: t('settings.modFieldsPbAssignSpecificUser') }
]);

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || `item-${Date.now()}`;
}

function normalizePlaybookAssignment(assignment = {}) {
  const type = playbookAssignmentOptions.value.some(opt => opt.value === assignment.type)
    ? assignment.type
    : 'deal_owner';
  return {
    type,
    targetId: assignment.targetId || null,
    targetType: assignment.targetType || '',
    targetName: assignment.targetName || ''
  };
}

function normalizeActionTrigger(trigger = {}) {
  const type = playbookTriggerOptions.value.some(opt => opt.value === trigger.type)
    ? trigger.type
    : 'stage_entry';
  let delay = null;
  if (trigger.delay && typeof trigger.delay === 'object') {
    const amount = Math.max(0, Number(trigger.delay.amount) || 0);
    const unit = playbookDelayUnitOptions.value.some(opt => opt.value === trigger.delay.unit)
      ? trigger.delay.unit
      : 'days';
    delay = { amount, unit };
  }
  const conditions = Array.isArray(trigger.conditions)
    ? trigger.conditions.map(condition => ({
        field: condition.field || '',
        operator: condition.operator || 'equals',
        value: condition.value
      }))
    : [];
  return {
    type,
    sourceActionKey: trigger.sourceActionKey ? slugify(trigger.sourceActionKey) : '',
    delay,
    conditions,
    description: trigger.description || ''
  };
}

function normalizeActionAlerts(alerts = []) {
  if (!Array.isArray(alerts)) return [];
  return alerts.map(alert => {
    const type = playbookAlertTypeOptions.value.some(opt => opt.value === alert.type)
      ? alert.type
      : 'in_app';
    let offset = null;
    if (alert.offset && typeof alert.offset === 'object') {
      const amount = Math.max(0, Number(alert.offset.amount) || 0);
      const unit = playbookDelayUnitOptions.value.some(opt => opt.value === alert.offset.unit)
        ? alert.offset.unit
        : 'hours';
      offset = { amount, unit };
    }
    const recipients = Array.isArray(alert.recipients)
      ? alert.recipients.map(r => String(r || '').trim()).filter(Boolean)
      : [];
    return {
      type,
      offset,
      recipients,
      message: alert.message || ''
    };
  });
}

function normalizeActionResources(resources = []) {
  if (!Array.isArray(resources)) return [];
  return resources.map(resource => ({
    name: resource?.name || '',
    type: playbookResourceTypes.value.some(opt => opt.value === resource?.type) ? resource.type : 'document',
    url: resource?.url || '',
    description: resource?.description || ''
  }));
}

function createStagePlaybook(stageKey, stageName, status = 'open', source = null) {
  const baseExitType = (status === 'won' || status === 'lost') ? 'manual' : 'all_actions_completed';
  const exitCriteria = source?.exitCriteria || {};
  const normalizedExitType = playbookExitOptions.value.some(opt => opt.value === exitCriteria.type)
    ? exitCriteria.type
    : baseExitType;

  const actionsSource = Array.isArray(source?.actions) ? source.actions : [];
  const actionKeys = new Set();
  const actions = actionsSource.map((action, index) => {
    const title = (action.title || `Action ${index + 1}`).trim();
    let key = action.key ? slugify(action.key) : slugify(`${stageKey}-${title}-${index}`);
    while (actionKeys.has(key)) {
      key = `${key}-${index}`;
    }
    actionKeys.add(key);
    return {
      key,
      title,
      description: action.description || '',
      actionType: playbookActionTypes.value.some(opt => opt.value === action.actionType) ? action.actionType : 'task',
      dueInDays: Math.max(0, Number(action.dueInDays) || 0),
      assignment: normalizePlaybookAssignment(action.assignment),
      required: action.required !== false,
      dependencies: Array.isArray(action.dependencies) ? action.dependencies.filter(Boolean) : [],
      autoCreate: action.autoCreate !== false,
      trigger: normalizeActionTrigger(action.trigger),
      alerts: normalizeActionAlerts(action.alerts),
      resources: normalizeActionResources(action.resources),
      metadata: typeof action.metadata === 'object' && action.metadata !== null ? { ...action.metadata } : {}
    };
  });

  // Remove dependencies that no longer exist after normalization
  const validKeys = new Set(actions.map(action => action.key));
  actions.forEach(action => {
    action.dependencies = action.dependencies.filter(dep => validKeys.has(dep) && dep !== action.key);
  });

  return {
    enabled: source?.enabled === true,
    mode: playbookModeOptions.value.some(opt => opt.value === source?.mode) ? source.mode : 'sequential',
    autoAdvance: source?.autoAdvance === true,
    notes: source?.notes || '',
    actions,
    exitCriteria: {
      type: normalizedExitType,
      customDescription: exitCriteria.customDescription || '',
      nextStageKey: exitCriteria.nextStageKey ? slugify(exitCriteria.nextStageKey) : '',
      conditions: Array.isArray(exitCriteria.conditions)
        ? exitCriteria.conditions.map(condition => ({
            field: condition.field || '',
            operator: condition.operator || 'equals',
            value: condition.value
          }))
        : []
    }
  };
}

function buildStageFromDefinition(def, pipelineKey, order) {
  const name = (def.name || `Stage ${order + 1}`).trim();
  const status = ['open', 'won', 'lost', 'stalled'].includes(def.status) ? def.status : 'open';
  let probability = typeof def.probability === 'number' ? def.probability : 0;
  if (status === 'won') probability = 100;
  if (status === 'lost') probability = 0;
  probability = Math.min(100, Math.max(0, Number(probability) || 0));
  const key = slugify(`${pipelineKey}-${name}-${order}`) || `${pipelineKey}-stage-${order + 1}`;
  const color = (def.color && /^#[0-9A-Fa-f]{6}$/.test(def.color)) ? def.color : (DEFAULT_STAGE_COLORS[order] || DEFAULT_STAGE_COLOR);
  return {
    key,
    name,
    description: def.description || '',
    probability,
    status,
    order,
    color,
    isClosedWon: status === 'won',
    isClosedLost: status === 'lost',
    playbook: createStagePlaybook(key, name, status, def.playbook || null)
  };
}

function createDefaultPipeline(name = 'Default Pipeline', { isDefault = false } = {}) {
  const pipelineKey = slugify(name) || `pipeline-${Date.now()}`;
  const stages = DEFAULT_STAGE_DEFINITIONS.map((def, index) => buildStageFromDefinition(def, pipelineKey, index));
  return {
    key: pipelineKey,
    name,
    description: '',
    color: DEFAULT_PIPELINE_COLOR,
    isDefault,
    order: 0,
    stages
  };
}

function getDefaultPipelineSettingsLocal() {
  return [createDefaultPipeline('Sales Pipeline', { isDefault: true })];
}

function normalizePipelineSettings(settings = []) {
  const source = Array.isArray(settings) && settings.length ? settings : getDefaultPipelineSettingsLocal();
  const normalized = source.map((pipeline, pipelineIndex) => {
    const name = (pipeline.name || `Pipeline ${pipelineIndex + 1}`).trim();
    let key = pipeline.key ? slugify(pipeline.key) : slugify(name);
    if (!key) key = `pipeline-${pipelineIndex + 1}`;
    const color = pipeline.color || DEFAULT_PIPELINE_COLOR;
    const description = pipeline.description || '';
    const stagesSource = Array.isArray(pipeline.stages) && pipeline.stages.length ? pipeline.stages : DEFAULT_STAGE_DEFINITIONS;
    const stages = stagesSource.map((stage, stageIndex) => {
      const stageName = (stage.name || DEFAULT_STAGE_DEFINITIONS[stageIndex]?.name || `Stage ${stageIndex + 1}`).trim();
      let stageKeyRaw = stage.key ? slugify(stage.key) : slugify(`${key}-${stageName}`);
      if (!stageKeyRaw) stageKeyRaw = `${key}-stage-${stageIndex + 1}`;
      const status = ['open', 'won', 'lost', 'stalled'].includes(stage.status) ? stage.status : (DEFAULT_STAGE_DEFINITIONS[stageIndex]?.status || 'open');
      let probability = typeof stage.probability === 'number' ? stage.probability : (DEFAULT_STAGE_DEFINITIONS[stageIndex]?.probability ?? 0);
      if (status === 'won') probability = 100;
      if (status === 'lost') probability = 0;
      probability = Math.min(100, Math.max(0, Number(probability) || 0));
      const stageKey = stageKeyRaw;
      const color = (stage.color && /^#[0-9A-Fa-f]{6}$/.test(stage.color)) ? stage.color : (DEFAULT_STAGE_DEFINITIONS[stageIndex]?.color || DEFAULT_STAGE_COLOR);
      return {
        key: stageKey,
        name: stageName,
        description: stage.description || '',
        probability,
        status,
        order: stageIndex,
        color,
        isClosedWon: status === 'won',
        isClosedLost: status === 'lost',
        playbook: createStagePlaybook(stageKey, stageName, status, stage.playbook || null)
      };
    });
    return {
      key,
      name,
      description,
      color,
      isDefault: pipeline.isDefault === true,
      order: pipelineIndex,
      stages
    };
  });

  if (!normalized.length) {
    return normalizePipelineSettings(getDefaultPipelineSettingsLocal());
  }

  const seenKeys = new Set();
  normalized.forEach((pipeline, index) => {
    const baseKey = pipeline.key;
    while (seenKeys.has(pipeline.key)) {
      pipeline.key = `${baseKey}-${index}`;
    }
    seenKeys.add(pipeline.key);
    pipeline.order = index;
  });

  let defaultFound = false;
  normalized.forEach((pipeline, index) => {
    if (pipeline.isDefault && !defaultFound) {
      defaultFound = true;
    } else if (pipeline.isDefault && defaultFound) {
      pipeline.isDefault = false;
    }
    pipeline.order = index;
  });
  if (!defaultFound) {
    normalized[0].isDefault = true;
  }

  normalized.forEach(pipeline => {
    const stageKeys = new Set();
    pipeline.stages = pipeline.stages.map((stage, stageIndex) => {
      let baseKey = stage.key;
      while (stageKeys.has(baseKey)) {
        baseKey = `${stage.key}-${stageIndex}`;
      }
      stageKeys.add(baseKey);
      const status = ['open', 'won', 'lost', 'stalled'].includes(stage.status) ? stage.status : 'open';
      let probability = Math.min(100, Math.max(0, Number(stage.probability) || 0));
      if (status === 'won') probability = 100;
      if (status === 'lost') probability = 0;
      const color = (stage.color && /^#[0-9A-Fa-f]{6}$/.test(stage.color)) ? stage.color : (DEFAULT_STAGE_COLORS[stageIndex] || DEFAULT_STAGE_COLOR);
      return {
        key: baseKey,
        name: (stage.name || `Stage ${stageIndex + 1}`).trim(),
        description: stage.description || '',
        probability,
        status,
        order: stageIndex,
        color,
        isClosedWon: status === 'won',
        isClosedLost: status === 'lost'
      };
    });
  });

  return normalized;
}

const pipelineTabEnabled = computed(() => selectedModule.value?.key === 'deals');
const currentPipeline = computed(() => {
  if (!pipelineTabEnabled.value) return null;
  let pipeline = null;

  if (selectedPipelineKey.value) {
    pipeline = pipelineSettings.value.find(p => p.key === selectedPipelineKey.value) || null;
  }

  if (!pipeline && pipelineSettings.value.length) {
    pipeline = pipelineSettings.value[0];
  }

  return pipeline || null;
});

const actionModalStage = computed(() => {
  if (!actionModalState.open) return null;
  const pipeline = currentPipeline.value;
  if (!pipeline || !Array.isArray(pipeline.stages)) return null;
  return pipeline.stages.find(stage => stage.key === actionModalState.stageKey) || null;
});

const actionModalAction = computed(() => {
  const stage = actionModalStage.value;
  if (!stage || !Array.isArray(stage.playbook?.actions)) return null;
  const index = actionModalState.actionIndex;
  if (typeof index !== 'number' || index < 0) return null;
  return stage.playbook.actions[index] || null;
});

const actionModalActionIndex = computed(() =>
  typeof actionModalState.actionIndex === 'number' ? actionModalState.actionIndex : -1
);

const isActionModalOpen = computed(() => !!(actionModalState.open && actionModalStage.value && actionModalAction.value));

function ensurePipelineSelection() {
  if (!pipelineTabEnabled.value || pipelineSettings.value.length === 0) {
    selectedPipelineKey.value = '';
    return;
  }
  if (!pipelineSettings.value.some(p => p.key === selectedPipelineKey.value)) {
    selectedPipelineKey.value = pipelineSettings.value[0].key;
  }
}

function hydratePipelineSettingsFromModule(mod) {
  if (!mod || mod.key !== 'deals') {
    pipelineSettings.value = [];
    selectedPipelineKey.value = '';
    return;
  }

  const raw = Array.isArray(mod.pipelineSettings)
    ? JSON.parse(JSON.stringify(mod.pipelineSettings))
    : [];

  const normalized = normalizePipelineSettings(raw).map(pipeline => {
    const stages = Array.isArray(pipeline.stages) ? pipeline.stages : [];
    const hydratedStages = stages.map((stage, index) => {
      const stageClone = { ...stage, order: index };
      ensureStageStructure(stageClone);
      return stageClone;
    });

    const finalStages = hydratedStages.length
      ? hydratedStages
      : DEFAULT_STAGE_DEFINITIONS.map((def, index) => {
          const stageFromDefault = buildStageFromDefinition(def, pipeline.key, index);
          ensureStageStructure(stageFromDefault);
          return stageFromDefault;
        });

    try {
      console.log('[Pipeline Hydrate] pipeline', pipeline.name, 'stages:', finalStages.map(stage => stage?.name || `Stage ${stage?.order ?? -1}`));
    } catch (e) {
      console.log('[Pipeline Hydrate] pipeline', pipeline.name, 'stages count:', finalStages.length);
    }

    return {
      ...pipeline,
      stages: finalStages
    };
  });

  pipelineSettings.value = normalized;
  ensurePipelineSelection();
}


function refreshPipelineOrders() {
  pipelineSettings.value.forEach((pipeline, index) => {
    pipeline.order = index;
    pipeline.stages.forEach((stage, stageIndex) => {
      stage.order = stageIndex;
    });
  });
}

function addPipeline() {
  const count = pipelineSettings.value.length;
  const name = count === 0 ? 'Sales Pipeline' : `Pipeline ${count + 1}`;
  const isDefault = count === 0 && !pipelineSettings.value.some(p => p.isDefault);
  const pipeline = createDefaultPipeline(name, { isDefault });
  pipeline.order = count;
  pipelineSettings.value.push(pipeline);
  selectedPipelineKey.value = pipeline.key;
  ensurePipelineSelection();
}

function removePipeline(pipelineKey) {
  const pipeline = pipelineSettings.value.find(p => p.key === pipelineKey);
  if (!pipeline) return;
  if (pipeline.isDefault) {
    notifications.error(t('settings.modFieldsPipelineRemoveDefaultFirst'));
    return;
  }
  if (pipelineSettings.value.length <= 1) {
    notifications.warning(t('settings.modFieldsPipelineMinOne'));
    return;
  }
  const index = pipelineSettings.value.findIndex(p => p.key === pipelineKey);
  pipelineSettings.value.splice(index, 1);
  refreshPipelineOrders();
  ensurePipelineSelection();
}

function movePipeline(pipelineKey, direction) {
  const index = pipelineSettings.value.findIndex(p => p.key === pipelineKey);
  if (index === -1) return;
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= pipelineSettings.value.length) return;
  const [pipeline] = pipelineSettings.value.splice(index, 1);
  pipelineSettings.value.splice(newIndex, 0, pipeline);
  refreshPipelineOrders();
}

function setDefaultPipeline(pipelineKey) {
  pipelineSettings.value.forEach(p => {
    p.isDefault = (p.key === pipelineKey);
  });
}

function addStageToPipeline(pipeline) {
  if (!pipeline) return;
  const stageIndex = pipeline.stages.length;
  const baseDef = { name: `Stage ${stageIndex + 1}`, probability: 0, status: 'open' };
  const newStage = buildStageFromDefinition(baseDef, pipeline.key, stageIndex);
  ensureStageStructure(newStage);
  if (!newStage.playbook.actions.length) {
    newStage.playbook.actions.push({
      key: slugify(`${newStage.key}-action-1`),
      title: 'New activity',
      description: '',
      actionType: 'task',
      dueInDays: 0,
      assignment: normalizePlaybookAssignment({ type: 'deal_owner' }),
      required: true,
      dependencies: [],
      autoCreate: true,
      trigger: normalizeActionTrigger({ type: 'stage_entry' }),
      alerts: [],
      resources: [],
      metadata: {}
    });
  }
  pipeline.stages.push(newStage);
}

function removeStageFromPipeline(pipeline, stageIndex) {
  if (!pipeline) return;
  if (pipeline.stages.length <= 1) {
    notifications.warning(t('settings.modFieldsPipelineMinOneStage'));
    return;
  }
  pipeline.stages.splice(stageIndex, 1);
  pipeline.stages.forEach((stage, idx) => (stage.order = idx));
}

function moveStage(pipeline, stageIndex, direction) {
  if (!pipeline) return;
  const newIndex = stageIndex + direction;
  if (newIndex < 0 || newIndex >= pipeline.stages.length) return;
  const [stage] = pipeline.stages.splice(stageIndex, 1);
  pipeline.stages.splice(newIndex, 0, stage);
  pipeline.stages.forEach((s, idx) => (s.order = idx));
}

function isStageSettingsOpen(stage) {
  if (!stage) return false;
  return !!stageSettingsExpanded.value[stage.key];
}

function toggleStageSettings(stageKey) {
  if (!stageKey) return;
  stageSettingsExpanded.value = {
    ...stageSettingsExpanded.value,
    [stageKey]: !stageSettingsExpanded.value[stageKey]
  };
}

function openActionModal(stage, actionIndex = 0) {
  if (!stage) return;
  ensureStagePlaybook(stage);
  const clampedIndex = Math.min(
    Math.max(0, typeof actionIndex === 'number' ? actionIndex : 0),
    stage.playbook.actions.length - 1
  );
  actionModalState.open = true;
  actionModalState.stageKey = stage.key;
  actionModalState.actionIndex = clampedIndex;
}

function closeActionModal() {
  actionModalState.open = false;
  actionModalState.stageKey = '';
  actionModalState.actionIndex = null;
}

function ensureStagePlaybook(stage) {
  if (!stage) return;
  if (!stage.playbook || typeof stage.playbook !== 'object') {
    stage.playbook = createStagePlaybook(stage.key, stage.name, stage.status);
  }
  if (!Array.isArray(stage.playbook.actions)) {
    stage.playbook.actions = [];
  }
  if (!stage.playbook.exitCriteria) {
    stage.playbook.exitCriteria = {
      type: stage.status === 'won' || stage.status === 'lost' ? 'manual' : 'all_actions_completed',
      customDescription: '',
      nextStageKey: '',
      conditions: []
    };
  }
  stage.playbook.actions = stage.playbook.actions.map((action, index) => {
    const key = action?.key || slugify(`${stage.key}-action-${index}`);
    const title = action?.title || `Action ${index + 1}`;
    const actionType = playbookActionTypes.value.some(opt => opt.value === action?.actionType) ? action.actionType : 'task';
    const trigger = normalizeActionTrigger(action?.trigger || {});
    if (trigger.type === 'time_delay' && !trigger.delay) {
      trigger.delay = { amount: 0, unit: 'hours' };
    }
    const alerts = normalizeActionAlerts(action?.alerts || []).map(alert => {
      if (!alert.offset) {
        alert.offset = { amount: 0, unit: 'hours' };
      }
      return alert;
    });
    const resources = normalizeActionResources(action?.resources || []);
    return {
      key,
      title,
      description: action?.description || '',
      actionType,
      dueInDays: Math.max(0, Number(action?.dueInDays) || 0),
      assignment: normalizePlaybookAssignment(action?.assignment || {}),
      required: action?.required !== false,
      dependencies: Array.isArray(action?.dependencies) ? action.dependencies.filter(Boolean) : [],
      autoCreate: action?.autoCreate !== false,
      trigger,
      alerts,
      resources,
      metadata: typeof action?.metadata === 'object' && action.metadata !== null ? { ...action.metadata } : {}
    };
  });
}

function ensureStageStructure(stage) {
  if (!stage || typeof stage !== 'object') {
    return false;
  }
  ensureStagePlaybook(stage);
  return true;
}

function handlePlaybookToggle(stage) {
  ensureStagePlaybook(stage);
  if (!stage.playbook.enabled) {
    stage.playbook.autoAdvance = false;
    stage.playbook.exitCriteria.nextStageKey = '';
  }
}

function onPlaybookExitCriteriaChange(stage) {
  ensureStagePlaybook(stage);
  if (stage.playbook.exitCriteria.type === 'manual') {
    stage.playbook.autoAdvance = false;
    stage.playbook.exitCriteria.nextStageKey = '';
  }
}

function onPlaybookAutoAdvanceChange(stage) {
  ensureStagePlaybook(stage);
  if (!stage.playbook.autoAdvance) {
    stage.playbook.exitCriteria.nextStageKey = '';
  } else if (stage.playbook.exitCriteria.type === 'manual') {
    stage.playbook.exitCriteria.type = 'all_actions_completed';
  }
}

function getNextStageOptions(pipeline, currentStage) {
  if (!pipeline || !currentStage) return [];
  return pipeline.stages
    .filter(stage => stage.key !== currentStage.key)
    .map(stage => ({ value: stage.key, label: stage.name }));
}

function addPlaybookAction(stage) {
  ensureStagePlaybook(stage);
  const index = stage.playbook.actions.length;
  const title = `Action ${index + 1}`;
  let key = slugify(`${stage.key}-${title}-${Date.now()}`);
  const existingKeys = new Set(stage.playbook.actions.map(action => action.key));
  while (existingKeys.has(key)) {
    key = `${key}-${Math.floor(Math.random() * 1000)}`;
  }
  stage.playbook.actions.push({
    key,
    title,
    description: '',
    actionType: 'task',
    dueInDays: 0,
    assignment: {
      type: 'deal_owner',
      targetId: null,
      targetType: '',
      targetName: ''
    },
    required: true,
    dependencies: [],
    autoCreate: true,
    trigger: normalizeActionTrigger({ type: 'stage_entry' }),
    alerts: [],
    resources: [],
    metadata: {}
  });
  openActionModal(stage, stage.playbook.actions.length - 1);
}

function removePlaybookAction(stage, actionIndex) {
  ensureStagePlaybook(stage);
  if (actionIndex < 0 || actionIndex >= stage.playbook.actions.length) return;
  const [removed] = stage.playbook.actions.splice(actionIndex, 1);
  if (removed?.key) {
    stage.playbook.actions.forEach(action => {
      action.dependencies = action.dependencies.filter(dep => dep !== removed.key);
    });
  }
  if (actionModalState.open && stage.key === actionModalState.stageKey) {
    if (actionModalState.actionIndex === actionIndex) {
      closeActionModal();
    } else if (typeof actionModalState.actionIndex === 'number' && actionModalState.actionIndex > actionIndex) {
      actionModalState.actionIndex = Math.max(0, actionModalState.actionIndex - 1);
    }
  }
}

function movePlaybookAction(stage, actionIndex, direction) {
  ensureStagePlaybook(stage);
  const newIndex = actionIndex + direction;
  if (newIndex < 0 || newIndex >= stage.playbook.actions.length) return;
  const [action] = stage.playbook.actions.splice(actionIndex, 1);
  stage.playbook.actions.splice(newIndex, 0, action);
  if (actionModalState.open && stage.key === actionModalState.stageKey && action?.key) {
    const updatedIndex = stage.playbook.actions.findIndex(a => a.key === action.key);
    actionModalState.actionIndex = updatedIndex;
  }
}

function refreshPlaybookActionKey(stage, action) {
  ensureStagePlaybook(stage);
  if (!action || !action.title) return;
  const currentKey = action.key;
  const slugBase = slugify(`${stage.key}-${action.title}`);
  if (!slugBase) return;
  const otherKeys = new Set(stage.playbook.actions.filter(a => a !== action).map(a => a.key));
  let candidate = slugBase;
  let counter = 1;
  while (otherKeys.has(candidate)) {
    candidate = `${slugBase}-${counter++}`;
  }
  if (candidate !== currentKey) {
    stage.playbook.actions.forEach(a => {
      a.dependencies = a.dependencies.map(dep => (dep === currentKey ? candidate : dep));
    });
    action.key = candidate;
  }
}

function cleanupPlaybookDependencies(stage) {
  ensureStagePlaybook(stage);
  const validKeys = new Set(stage.playbook.actions.map(action => action.key));
  stage.playbook.actions.forEach(action => {
    action.dependencies = action.dependencies.filter(dep => dep !== action.key && validKeys.has(dep));
  });
}

function getPlaybookActionTypeLabel(actionType) {
  const option = playbookActionTypes.value.find(opt => opt.value === actionType);
  return option ? option.label : t('settings.modFieldsPbActionTask');
}

function getPlaybookAssignmentLabel(type) {
  const option = playbookAssignmentOptions.value.find(opt => opt.value === type);
  return option ? option.label : t('settings.modFieldsPbAssignDealOwner');
}

function getActionOptions(stage, currentAction) {
  if (!stage || !Array.isArray(stage.playbook?.actions)) return [];
  return stage.playbook.actions
    .filter(action => action.key !== currentAction.key)
    .map(action => ({ value: action.key, label: action.title }));
}

function toggleActionDependency(stage, action, dependencyKey, checked) {
  ensureStagePlaybook(stage);
  if (!action || !dependencyKey) return;
  if (!Array.isArray(action.dependencies)) {
    action.dependencies = [];
  }
  if (checked) {
    if (!action.dependencies.includes(dependencyKey)) {
      action.dependencies.push(dependencyKey);
    }
  } else {
    action.dependencies = action.dependencies.filter(dep => dep !== dependencyKey);
  }
}

function handleTriggerTypeChange(action) {
  if (!action) return;
  if (!action.trigger || typeof action.trigger !== 'object') {
    action.trigger = normalizeActionTrigger({});
  }
  const normalized = normalizeActionTrigger(action.trigger);
  Object.assign(action.trigger, normalized);
  if (action.trigger.type === 'after_action') {
    action.trigger.sourceActionKey = action.trigger.sourceActionKey || '';
  } else {
    action.trigger.sourceActionKey = '';
  }
  if (action.trigger.type === 'time_delay') {
    if (!action.trigger.delay) {
      action.trigger.delay = { amount: 0, unit: 'hours' };
    }
  } else {
    action.trigger.delay = null;
  }
  if (action.trigger.type !== 'custom') {
    action.trigger.conditions = [];
  }
}

function ensureTriggerDelay(action) {
  if (!action) return;
  if (!action.trigger || typeof action.trigger !== 'object') {
    action.trigger = normalizeActionTrigger({});
  }
  if (!action.trigger.delay || typeof action.trigger.delay !== 'object') {
    action.trigger.delay = { amount: 0, unit: 'hours' };
  }
}

function updateTriggerDelayAmount(action, value) {
  ensureTriggerDelay(action);
  action.trigger.delay.amount = Math.max(0, Number(value) || 0);
}

function updateTriggerDelayUnit(action, unit) {
  ensureTriggerDelay(action);
  const fallback = playbookDelayUnitOptions.value[0]?.value || 'hours';
  action.trigger.delay.unit = playbookDelayUnitOptions.value.some(opt => opt.value === unit) ? unit : fallback;
}

function addActionAlert(stage, action) {
  ensureStagePlaybook(stage);
  if (!Array.isArray(action.alerts)) {
    action.alerts = [];
  }
  action.alerts.push({
    type: 'in_app',
    offset: { amount: 0, unit: 'hours' },
    recipients: [],
    message: ''
  });
}

function removeActionAlert(stage, action, alertIndex) {
  if (!Array.isArray(action.alerts)) return;
  action.alerts.splice(alertIndex, 1);
}

function ensureAlertOffset(alert) {
  if (!alert) return;
  if (!alert.offset || typeof alert.offset !== 'object') {
    alert.offset = { amount: 0, unit: 'hours' };
  }
}

function updateAlertOffsetAmount(alert, value) {
  ensureAlertOffset(alert);
  alert.offset.amount = Math.max(0, Number(value) || 0);
}

function updateAlertOffsetUnit(alert, unit) {
  ensureAlertOffset(alert);
  const fallback = playbookDelayUnitOptions.value[0]?.value || 'hours';
  alert.offset.unit = playbookDelayUnitOptions.value.some(opt => opt.value === unit) ? unit : fallback;
}

function updateAlertRecipients(alert, value) {
  if (!alert) return;
  const recipients = String(value || '')
    .split(',')
    .map(r => r.trim())
    .filter(Boolean);
  alert.recipients = recipients;
}

function addActionResource(stage, action) {
  ensureStagePlaybook(stage);
  if (!Array.isArray(action.resources)) {
    action.resources = [];
  }
  action.resources.push({
    name: '',
    type: 'document',
    url: '',
    description: ''
  });
}

function removeActionResource(stage, action, resourceIndex) {
  if (!Array.isArray(action.resources)) return;
  action.resources.splice(resourceIndex, 1);
}

function onStageStatusChange(stage) {
  if (!stage) return;
  if (stage.status === 'won') {
    stage.probability = 100;
    stage.isClosedWon = true;
    stage.isClosedLost = false;
  } else if (stage.status === 'lost') {
    stage.probability = 0;
    stage.isClosedLost = true;
    stage.isClosedWon = false;
  } else {
    stage.isClosedWon = false;
    stage.isClosedLost = false;
  }
}

function clampStageProbability(stage) {
  if (!stage) return;
  stage.probability = Math.min(100, Math.max(0, Number(stage.probability) || 0));
  if (stage.status === 'won') stage.probability = 100;
  if (stage.status === 'lost') stage.probability = 0;
}
function spanClass(span) {
  const n = Math.min(12, Math.max(1, Number(span) || 12));
  return colSpanClasses[n - 1];
}
const subTabs = computed(() => [
  { id: 'general', name: t('settings.modFieldsSubTabGeneral') },
  { id: 'validations', name: t('settings.modFieldsSubTabValidations') },
  { id: 'dependencies', name: t('settings.modFieldsSubTabDependencies') }
]);

function isSubTabDisabled(tabId) {
  if (!currentField.value) return false;
  // Allow dependency configuration on protected/system fields while keeping
  // structural edits (rename/type/validation rules) restricted.
  if (!isSystemField(currentField.value)) return false;
  return tabId !== 'general' && tabId !== 'dependencies';
}

const activeSubTab = ref('general');
const fieldSearch = ref('');
const showTenantFields = ref(false); // Hide tenant fields by default
const TASK_FIELD_CONFIGURATION_ORDER = Object.freeze([
  'title',
  'status',
  'priority',
  'startDate',
  'dueDate',
  'assignedTo',
  'relatedTo',
  'estimatedHours'
]);

const sortTaskFieldConfiguration = (fields = []) => {
  return [...fields].sort((a, b) => {
    const aKey = String(a?.key || '');
    const bKey = String(b?.key || '');
    const aPinnedIndex = TASK_FIELD_CONFIGURATION_ORDER.indexOf(aKey);
    const bPinnedIndex = TASK_FIELD_CONFIGURATION_ORDER.indexOf(bKey);
    const aPinned = aPinnedIndex !== -1;
    const bPinned = bPinnedIndex !== -1;

    if (aPinned && bPinned) return aPinnedIndex - bPinnedIndex;
    if (aPinned) return -1;
    if (bPinned) return 1;
    return (a?.order ?? 0) - (b?.order ?? 0);
  });
};

const normalizeTaskFieldConfigurationOrder = (moduleKey, fields = []) => {
  if (String(moduleKey || '').toLowerCase() !== 'tasks') return fields;
  return sortTaskFieldConfiguration(fields);
};

// Ensure Tasks module field list includes the combined "Related To" core field for Settings > Tasks > Field configurations.
// If the schema only has relatedToType/relatedToId, show one "Related To" row and hide the legacy keys.
function ensureTaskRelatedToField(moduleKey, fields = []) {
  if (String(moduleKey || '').toLowerCase() !== 'tasks') return fields;
  const keyNorm = (k) => String(k || '').toLowerCase().replace(/-/g, '');
  let list = fields.filter((f) => {
    const k = keyNorm(f?.key);
    return k !== 'relatedtotype' && k !== 'relatedtoid';
  });
  if (list.some((f) => keyNorm(f.key) === 'relatedto')) return sortTaskFieldConfiguration(list);
  const orderIndex = TASK_FIELD_CONFIGURATION_ORDER.indexOf('relatedTo');
  const insertOrder = orderIndex >= 0 ? orderIndex : list.length;
  list.push({
    key: 'relatedTo',
    label: 'Related To',
    dataType: 'Lookup',
    required: false,
    order: insertOrder,
    visibility: { list: true, detail: true }
  });
  return sortTaskFieldConfiguration(list);
}

const filteredFields = computed(() => {
  let fields = editFields.value;
  
  // Apply context filter if provided (e.g., for Sales → People)
  if (props.contextFilter) {
    console.log('[ModulesAndFields] Applying context filter. Fields before:', fields.length);
    const beforeCount = fields.length;
    fields = fields.filter(props.contextFilter);
    console.log('[ModulesAndFields] Fields after context filter:', fields.length, 'excluded:', beforeCount - fields.length);
  } else {
    console.log('[ModulesAndFields] No context filter provided');
  }
  
  // For forms module, ensure 'name' field is always at the top
  if (selectedModule.value?.key === 'forms') {
    fields = fields.sort((a, b) => {
      const aKey = (a.key || '').toLowerCase();
      const bKey = (b.key || '').toLowerCase();
      if (aKey === 'name') return -1;
      if (bKey === 'name') return 1;
      return (a.order ?? 0) - (b.order ?? 0);
    });
  } else if (selectedModule.value?.key === 'tasks') {
    fields = sortTaskFieldConfiguration(fields);
  } else {
    // Normal sorting by order
    fields = fields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  
  // Filter out tenant fields by default (unless showTenantFields is checked)
  // Only apply this filter for organizations module
  if (selectedModule.value?.key === 'organizations' && !showTenantFields.value) {
    // Tenant fields have keys like: subscription.*, limits.*, settings.*, slug, isActive, enabledModules
    const tenantFieldPatterns = ['subscription.', 'limits.', 'settings.', 'slug', 'isactive', 'enabledmodules'];
    fields = fields.filter(f => {
      const keyLower = (f.key || '').toLowerCase();
      // Check if field is a tenant field by key pattern OR by isTenantField flag
      const isTenantField = f.isTenantField === true || tenantFieldPatterns.some(pattern => keyLower.startsWith(pattern) || keyLower === pattern);
      return !isTenantField;
    });
  }
  
  // Filter out execution fields for Events module
  // ARCHITECTURE NOTE: Events Settings configure structure only, never execution.
  // Excludes: GEO coordinates, check-in/check-out, route sequencing, audit history, metadata.
  // See: docs/architecture/event-settings.md Section 5.5
  if (selectedModule.value?.key === 'events') {
    const executionFieldPatterns = [
      'geolocation', 'georequired', 'checkin', 'checkout', 'executionstarttime', 'executionendtime', 
      'timespent', 'ispaused', 'pausereasons', 'orglist', 'routesequence', 'currentorgindex', 
      'ismultiorg', 'audithistory', 'metadata', 'formassignment'
    ];
    fields = fields.filter(f => {
      const keyLower = (f.key || '').toLowerCase();
      // Block execution fields - they belong in Work interfaces, not Settings
      // Rationale: GEO coordinates belong in execution (geo tracking execution)
      // Rationale: check-in/check-out belong in execution (event execution)
      // Rationale: route sequencing belongs in execution (multi-org route execution)
      // Rationale: audit history belongs in execution (audit trail)
      // Rationale: metadata belongs in execution (form responses, etc.)
      return !executionFieldPatterns.some(pattern => keyLower.includes(pattern.toLowerCase()));
    });
  }
  
  // Apply search filter
  const q = (fieldSearch.value || '').toLowerCase();
  if (q) {
    fields = fields.filter(f => 
      (f.label || '').toLowerCase().includes(q) || 
      (f.key || '').toLowerCase().includes(q)
    );
  }
  
  return fields;
});

// Check if current module is People
const isPeopleModule = computed(() => {
  return selectedModule.value?.key?.toLowerCase() === 'people';
});

// Check if current module is Organizations
const isOrganizationsModule = computed(() => {
  return selectedModule.value?.key?.toLowerCase() === 'organizations';
});

// Check if current module is Tasks
// ARCHITECTURE NOTE: Tasks Settings configure structure only, never work.
// See: docs/architecture/task-settings.md
const isTasksModule = computed(() => {
  return selectedModule.value?.key?.toLowerCase() === 'tasks';
});

// Check if current module is Events
// ARCHITECTURE NOTE: Events Settings configure structure, constraints, and eligibility only.
// Excludes: scheduling, execution, audit workflows, calendars.
// See: docs/architecture/event-settings.md
const isEventsModule = computed(() => {
  return selectedModule.value?.key?.toLowerCase() === 'events';
});

// Check if current module is Items
const isItemsModule = computed(() => {
  return selectedModule.value?.key?.toLowerCase() === 'items';
});

const isQuotesModule = computed(() => {
  return selectedModule.value?.key?.toLowerCase() === 'quotes';
});

const isSalesOrdersModule = computed(() => {
  return selectedModule.value?.key?.toLowerCase() === 'sales_orders';
});

const isInvoicesModule = computed(() => {
  return selectedModule.value?.key?.toLowerCase() === 'invoices';
});

const isPaymentsModule = computed(() => {
  return selectedModule.value?.key?.toLowerCase() === 'payments';
});

const isDocumentsModule = computed(() => {
  return selectedModule.value?.key?.toLowerCase() === 'documents';
});

// Check if current module is Forms
// ARCHITECTURE NOTE: Forms Settings configure structure & behavior ONLY.
// MUST NOT: Edit sections/questions, Edit responses, Execute workflows, Run scoring
// See: docs/architecture/form-settings-doctrine.md
// See: client/src/platform/modules/forms/formsModule.definition.ts
const isFormsModule = computed(() => {
  return selectedModule.value?.key?.toLowerCase() === 'forms';
});
const isDealsModule = computed(() => {
  return selectedModule.value?.key?.toLowerCase() === 'deals';
});
const isCasesModule = computed(() => {
  return selectedModule.value?.key?.toLowerCase() === 'cases';
});
const isClosedRecordsModule = computed(() => {
  return isClosedRecordsEligibleModule(selectedModule.value?.key);
});
const duplicatePreventionModuleKey = computed(() => {
  if (isPeopleModule.value) return 'people';
  if (isOrganizationsModule.value) return 'organizations';
  if (isItemsModule.value) return 'items';
  if (isDealsModule.value) return 'deals';
  if (isTasksModule.value) return 'tasks';
  if (isCasesModule.value) return 'cases';
  return 'people';
});
const isInventoryWorkbenchModule = computed(() => {
  return isInventoryWorkbenchModuleKey(selectedModule.value?.key);
});

/** Shared core modules where custom fields may be Core vs app-participation scoped. */
const CUSTOM_FIELD_APP_SCOPE_MODULES = new Set(['people', 'organizations', 'tasks', 'events', 'items', 'deals', 'cases']);

const showCustomFieldParticipationScope = computed(() =>
  CUSTOM_FIELD_APP_SCOPE_MODULES.has((selectedModule.value?.key || '').toLowerCase())
);

const ENABLE_APP_LABELS = {
  SALES: 'Sales',
  HELPDESK: 'Helpdesk',
  MARKETING: 'Marketing',
  AUDIT: 'Audit',
  PORTAL: 'Portal',
  PROJECTS: 'Projects',
  LMS: 'LMS'
};

const customFieldAppScopeOptions = computed(() => {
  const raw = authStore.organization?.enabledApps;
  if (!Array.isArray(raw) || !raw.length) return [];
  const keys = new Set();
  for (const entry of raw) {
    const key = typeof entry === 'string' ? entry : (entry?.appKey || entry?.key || '');
    const upper = String(key || '').trim().toUpperCase();
    if (upper) keys.add(upper);
  }
  return Array.from(keys)
    .sort()
    .map((appKey) => ({
      value: appKey.toLowerCase(),
      label: ENABLE_APP_LABELS[appKey] || `${appKey.charAt(0)}${appKey.slice(1).toLowerCase()}`
    }));
});

// DEV-only guard: Ensure Forms module never supports execution
if (process.env.NODE_ENV === 'development') {
  watch(() => isFormsModule.value, (isForms) => {
    if (isForms) {
      // Assert that Forms Settings never expose execution capabilities
      // This is a runtime check to catch any accidental execution features
      // See: docs/architecture/form-settings-doctrine.md
      // See: client/src/platform/forms/formSettingsCapabilities.ts
      console.assert(
        !isForms || !activeTopTab.value || activeTopTab.value !== 'execution',
        '[Forms Settings] Execution must never be configurable. Forms Settings configure structure & behavior ONLY. See docs/architecture/form-settings-doctrine.md'
      );
      
      // Assert critical capabilities remain locked
      // If any of these flip, Form Settings must be re-reviewed
      console.assert(
        !FORM_SETTINGS_CAPABILITIES.builderEditable,
        '[Forms Settings] builderEditable must remain false. Form Builder owns structure & content.'
      );
      console.assert(
        !FORM_SETTINGS_CAPABILITIES.scoringEditable,
        '[Forms Settings] scoringEditable must remain false. Scoring weights belong to Form Builder.'
      );
      console.assert(
        !FORM_SETTINGS_CAPABILITIES.executionBehaviorEditable,
        '[Forms Settings] executionBehaviorEditable must remain false. Execution belongs to Event Execution / Work interfaces.'
      );
    }
  });
  
}

// Helper: Check if a field is eligible for Quick Create (People module only; used elsewhere for validation)
function isFieldEligibleForQuickCreate(fieldKey) {
  try {
    const metadata = getFieldMetadata(fieldKey);
    const isCoreIdentity = (
      metadata.owner === 'core' &&
      metadata.intent === 'identity' &&
      metadata.editable === true
    );
    return isCoreIdentity;
  } catch (err) {
    throw new Error(
      `Field "${fieldKey}" is not eligible for Quick Create. ` +
      `Creation eligibility must be declared in peopleFieldModel.ts. ` +
      `Error: ${err.message}`
    );
  }
}

function classifyEventQuickCreateField(field) {
  const key = field?.key;
  if (!key) return 'system';

  let classification = classifyEventField(key);
  if (classification !== 'system') return classification;

  // Nested event keys (e.g. kpiTargets.conversionRate) inherit ownership from root key.
  const rootKey = key.split('.')[0];
  if (rootKey && rootKey !== key) {
    const rootClassification = classifyEventField(rootKey);
    if (rootClassification) return rootClassification;
  }

  return classification;
}

// Computed: Fields available for Quick Create — all fields except system fields (for selection in Settings)
// System fields are excluded so they are not available for selection in the Quick Create section.
const quickCreateAvailableFields = computed(() => {
  // For People module: all fields except system, grouped by owner (core, participation)
  if (isPeopleModule.value) {
    const nonSystemFields = editFields.value.filter(f => {
      if (!f.key) return false;
      return !isSystemField(f);
    });
    const coreFields = [];
    const participationFields = [];
    nonSystemFields.forEach(field => {
      try {
        const metadata = getFieldMetadata(field.key);
        if (metadata.owner === 'core') {
          coreFields.push(field);
        } else if (metadata.owner === 'participation') {
          participationFields.push(field);
        }
      } catch (err) {
        // Org custom fields are not part of PEOPLE_FIELD_METADATA by design.
        if (field?.owner === 'org') {
          coreFields.push(field);
        }
      }
    });
    const canonicalCoreOrder = [
      'first_name',
      'last_name',
      'email',
      'phone',
      'mobile',
      'organization',
      'assignedTo',
      'source',
      'do_not_contact',
      'tags'
    ];
    const canonicalRank = new Map(
      canonicalCoreOrder.map((key, index) => [normalizeFieldKey(key), index])
    );
    coreFields.sort((a, b) => {
      const aRank = canonicalRank.get(normalizeFieldKey(a.key));
      const bRank = canonicalRank.get(normalizeFieldKey(b.key));
      const aPinned = typeof aRank === 'number';
      const bPinned = typeof bRank === 'number';
      if (aPinned && bPinned) return aRank - bRank;
      if (aPinned) return -1;
      if (bPinned) return 1;
      return 0;
    });
    return [...coreFields, ...participationFields];
  }

  // For Organizations: core + non-virtual participation (virtual roles use App Participation UI)
  if (isOrganizationsModule.value) {
    return editFields.value.filter(f => {
      if (!f.key) return false;
      if (isSystemField(f)) return false;
      if (!showTenantFields.value) {
        const keyLower = f.key.toLowerCase();
        const tenantFieldPatterns = ['subscription.', 'limits.', 'settings.', 'slug', 'isactive', 'enabledmodules'];
        if (tenantFieldPatterns.some(pattern => keyLower.startsWith(pattern) || keyLower === pattern)) {
          return false;
        }
      }
      if (f.owner === 'org') return true;
      const meta = getOrganizationFieldMetadata(f.key);
      if (meta?.owner === 'core') return true;
      if (meta?.owner === 'participation' && !meta.isVirtual) return true;
      return false;
    });
  }

  // For Tasks: all fields except system
  if (isTasksModule.value) {
    return editFields.value.filter(f => f.key && !isSystemField(f));
  }

  // For Events: exclude system fields and SALES participation fields
  // to match field configuration behavior.
  if (isEventsModule.value) {
    return editFields.value.filter((field) => {
      if (!field?.key) return false;
      const classification = classifyEventQuickCreateField(field);
      if (classification === 'system') return false;
      if (classification === 'SALES') return false;
      return true;
    });
  }

  // For Deals: include all core/usable fields, exclude only system fields
  if (isDealsModule.value) {
    return editFields.value.filter((field) => {
      if (!field?.key) return false;
      if (isSystemField(field)) return false;
      // Only include fields classified as core by Deal field model.
      // Unknown/infra fields fall into non-core buckets and are excluded.
      return classifyDealField(field.key) === 'core';
    });
  }

  // For Cases: include all core/usable fields, exclude only system fields
  if (isCasesModule.value) {
    return editFields.value.filter((field) => {
      if (!field?.key) return false;
      if (isSystemField(field)) return false;
      return classifyCaseField(field.key) === 'core';
    });
  }

  // Quotes: eligible = core fields allowed on create (metadata), not a hardcoded list
  if (isQuotesModule.value) {
    return editFields.value.filter((field) => {
      if (!field?.key) return false;
      if (isSystemField(field)) return false;
      if (field.required) return true;
      return !isExcludedFromQuoteQuickCreate(field.key);
    });
  }

  // Sales Orders: same eligibility pattern as Quotes
  if (isSalesOrdersModule.value) {
    return editFields.value.filter((field) => {
      if (!field?.key) return false;
      if (isSystemField(field)) return false;
      if (field.required) return true;
      return !isExcludedFromSalesOrderQuickCreate(field.key);
    });
  }

  if (isInvoicesModule.value) {
    return editFields.value.filter((field) => {
      if (!field?.key) return false;
      if (isSystemField(field)) return false;
      if (field.required) return true;
      return !isExcludedFromInvoiceQuickCreate(field.key);
    });
  }

  if (isPaymentsModule.value) {
    return editFields.value.filter((field) => {
      if (!field?.key) return false;
      if (isSystemField(field)) return false;
      if (field.required) return true;
      return !isExcludedFromPaymentQuickCreate(field.key);
    });
  }

  if (isDocumentsModule.value) {
    return editFields.value.filter((field) => {
      if (!field?.key) return false;
      if (isSystemField(field)) return false;
      if (field.required) return true;
      return !isExcludedFromDocumentQuickCreate(field.key);
    });
  }

  // For other modules (Deals, Items, etc.): only non-system fields
  return editFields.value.filter(f => f.key && !isSystemField(f));
});

const quickCreateEventGroupedFields = computed(() => {
  const core = [];
  const custom = [];
  const participation = {};
  if (!isEventsModule.value) {
    return { core, participation, custom };
  }

  for (const field of quickCreateAvailableFields.value) {
    if (!field?.key) continue;
    const classification = classifyEventQuickCreateField(field);
    if (classification === 'system') continue;

    if (classification !== 'core') {
      const scope = (classification || 'Participation').toUpperCase();
      if (!participation[scope]) participation[scope] = [];
      participation[scope].push(field);
      continue;
    }

    if (field.owner === 'org') {
      custom.push(field);
      continue;
    }

    core.push(field);
  }

  return { core, participation, custom };
});

const quickCreateEventParticipationEntries = computed(() => {
  return Object.entries(quickCreateEventGroupedFields.value.participation);
});

// Grouped fields for People module (derived from metadata)
// Also used for Organizations module (with simplified grouping)
// Also used for Tasks module (with task-specific grouping)
// Also used for Events module (with event-specific grouping)
// Also used for Forms module (with form-specific grouping)
// ARCHITECTURE NOTE: Tasks Settings configure structure only, never work.
// ARCHITECTURE NOTE: Events Settings configure structure, constraints, and eligibility only.
// ARCHITECTURE NOTE: Forms Settings configure structure & behavior ONLY.
// See: docs/architecture/task-settings.md Section 3.2
// See: docs/architecture/event-settings.md Section 6
// See: client/src/platform/modules/forms/formsModule.definition.ts
const groupedFields = computed(() => {
  if (!isPeopleModule.value && !isOrganizationsModule.value && !isTasksModule.value && !isEventsModule.value && !isFormsModule.value && !isItemsModule.value && !isQuotesModule.value && !isSalesOrdersModule.value && !isInvoicesModule.value && !isPaymentsModule.value && !isDocumentsModule.value && !isDealsModule.value && !isCasesModule.value && !isInventoryWorkbenchModule.value) {
    return { coreIdentity: [], participation: {}, system: [] };
  }

  const coreIdentity = [];
  const participation = {};
  const system = [];

  // Get all fields from editFields (filtered for Organizations to exclude tenant fields)
  let allFieldKeys = editFields.value.map(f => f.key).filter(Boolean);
  
  // For Organizations: exclude tenant fields unless showTenantFields is true
  if (isOrganizationsModule.value && !showTenantFields.value) {
    const tenantFieldPatterns = ['subscription.', 'limits.', 'settings.', 'slug', 'isactive', 'enabledmodules'];
    allFieldKeys = allFieldKeys.filter(key => {
      const keyLower = key.toLowerCase();
      return !tenantFieldPatterns.some(pattern => keyLower.startsWith(pattern) || keyLower === pattern);
    });
  }

  // Apply search filter
  const q = (fieldSearch.value || '').toLowerCase();
  if (q) {
    allFieldKeys = allFieldKeys.filter(fieldKey => {
      const field = editFields.value.find(f => f.key === fieldKey);
      if (!field) return false;
      const label = (field.label || '').toLowerCase();
      const key = (field.key || '').toLowerCase();
      return label.includes(q) || key.includes(q);
    });
  }

  for (const fieldKey of allFieldKeys) {
    try {
      // Custom fields (owner: 'org'): core when context is global; otherwise group by app (field.context token → SALES, etc.)
      const fieldObj = editFields.value.find(f => f.key === fieldKey);
      if (fieldObj?.owner === 'org') {
        const ctx = (fieldObj.context || 'global').toLowerCase();
        if (ctx === 'global') {
          coreIdentity.push(fieldKey);
        } else {
          const scopeKey = ctx.toUpperCase();
          if (!participation[scopeKey]) {
            participation[scopeKey] = [];
          }
          participation[scopeKey].push(fieldKey);
        }
        continue;
      }

      // For Items module, use item field model for classification
      // ARCHITECTURE NOTE: Items Settings configure structure only.
      // Field classification is now driven by itemFieldModel.ts
      if (isItemsModule.value) {
        const classification = classifyItemField(fieldKey);
        
        if (classification === 'core') {
          coreIdentity.push(fieldKey);
          continue;
        }
        
        if (classification === 'system') {
          system.push(fieldKey);
          continue;
        }
        
        // Participation fields - group by fieldScope
        if (classification === 'participation') {
          const metadata = getItemFieldMetadata(fieldKey);
          if (metadata && metadata.fieldScope) {
            const scope = metadata.fieldScope;
            if (!participation[scope]) {
              participation[scope] = [];
            }
            participation[scope].push(fieldKey);
          } else {
            // Fallback: participation field without metadata/fieldScope
            console.warn(`[Items Field Model] Field "${fieldKey}" is participation but missing fieldScope. Adding to system group as fallback.`);
            system.push(fieldKey);
          }
          continue;
        }
        
        // Fallback: If classification is null (field not in metadata),
        // add to system group to ensure it's still visible
        // This handles fields that exist in editFields but aren't in ITEM_FIELD_METADATA yet
        if (!classification) {
          console.warn(`[Items Field Model] Field "${fieldKey}" not found in ITEM_FIELD_METADATA. Adding to system group as fallback. Available keys:`, Object.keys(ITEM_FIELD_METADATA).slice(0, 10).join(', '));
          system.push(fieldKey);
          continue;
        }
        
        // Should never reach here, but add to system as ultimate fallback
        console.warn(`[Items Field Model] Field "${fieldKey}" has unexpected classification: ${classification}. Adding to system group as fallback.`);
        system.push(fieldKey);
        continue;
      }

      if (isQuotesModule.value) {
        const classification = classifyQuoteField(fieldKey);

        if (classification === 'core') {
          coreIdentity.push(fieldKey);
          continue;
        }

        if (classification === 'system') {
          system.push(fieldKey);
          continue;
        }

        if (!classification) {
          system.push(fieldKey);
          continue;
        }

        system.push(fieldKey);
        continue;
      }

      if (isSalesOrdersModule.value) {
        const classification = classifySalesOrderField(fieldKey);

        if (classification === 'core') {
          coreIdentity.push(fieldKey);
          continue;
        }

        if (classification === 'system') {
          system.push(fieldKey);
          continue;
        }

        if (!classification) {
          system.push(fieldKey);
          continue;
        }

        system.push(fieldKey);
        continue;
      }

      if (isInvoicesModule.value) {
        const classification = classifyInvoiceField(fieldKey);

        if (classification === 'core') {
          coreIdentity.push(fieldKey);
          continue;
        }

        if (classification === 'system') {
          system.push(fieldKey);
          continue;
        }

        if (!classification) {
          system.push(fieldKey);
          continue;
        }

        system.push(fieldKey);
        continue;
      }

      if (isPaymentsModule.value) {
        const classification = classifyPaymentField(fieldKey);

        if (classification === 'core') {
          coreIdentity.push(fieldKey);
          continue;
        }

        if (classification === 'system') {
          system.push(fieldKey);
          continue;
        }

        if (!classification) {
          system.push(fieldKey);
          continue;
        }

        system.push(fieldKey);
        continue;
      }

      if (isDocumentsModule.value) {
        const classification = classifyDocumentField(fieldKey);

        if (classification === 'core') {
          coreIdentity.push(fieldKey);
          continue;
        }

        if (classification === 'system') {
          system.push(fieldKey);
          continue;
        }

        if (!classification) {
          system.push(fieldKey);
          continue;
        }

        system.push(fieldKey);
        continue;
      }
      
      // For Organizations, use organization field model for classification
      // ARCHITECTURE NOTE: Organizations Settings configure structure only.
      // Field classification is now driven by organizationFieldModel.ts
      if (isOrganizationsModule.value) {
        const classification = classifyOrganizationField(fieldKey);
        
        if (classification === 'core') {
          coreIdentity.push(fieldKey);
          continue;
        }
        
        if (classification === 'system') {
          system.push(fieldKey);
          continue;
        }
        
        // Participation field - group by app scope
        if (!participation[classification]) {
          participation[classification] = [];
        }
        participation[classification].push(fieldKey);
        continue;
      } else if (isTasksModule.value) {
        // Tasks module: use task field model for classification
        // ARCHITECTURE NOTE: Tasks Settings configure structure only. See: docs/architecture/task-settings.md Section 3.2
        // Field classification is now driven by taskFieldModel.ts
        // Explicit: relatedTo is always core (combined type+id field); avoid any edge case classifying it as system
        // Key may be "relatedTo" or "related-to" (kebab-case from form/API) - normalize for comparison
        const keyNorm = String(fieldKey || '').trim().toLowerCase().replace(/-/g, '');
        const classification = keyNorm === 'relatedto'
          ? 'core'
          : classifyTaskField(fieldKey);
        
        if (classification === 'core') {
          coreIdentity.push(fieldKey);
          continue;
        }
        
        if (classification === 'system') {
          system.push(fieldKey);
          continue;
        }
        
        // Participation fields - classification returns the app scope (e.g., 'SALES', 'HELPDESK', 'AUDIT')
        if (!participation[classification]) {
          participation[classification] = [];
        }
        participation[classification].push(fieldKey);
        continue;
      } else if (isEventsModule.value) {
        // Events module: use event field model for classification
        // ARCHITECTURE NOTE: Events Settings configure structure only, never execution.
        // Field classification is now driven by eventFieldModel.ts
        const classification = classifyEventField(fieldKey);
        
        if (classification === 'core') {
          coreIdentity.push(fieldKey);
          continue;
        }
        
        if (classification === 'system') {
          system.push(fieldKey);
          continue;
        }
        
        // Participation fields - classification returns the app scope (e.g., 'SALES', 'AUDIT')
        if (!participation[classification]) {
          participation[classification] = [];
        }
        participation[classification].push(fieldKey);
        continue;
      } else if (isDealsModule.value) {
        // Deals module: use deal field model for classification (core vs system, same as Tasks/People)
        // ARCHITECTURE NOTE: Field classification is driven by dealFieldModel.ts
        const classification = classifyDealField(fieldKey);
        if (classification === 'core') {
          coreIdentity.push(fieldKey);
          continue;
        }
        if (classification === 'system') {
          system.push(fieldKey);
          continue;
        }
        // Participation fields - group by app scope (e.g. SALES if any in future)
        if (!participation[classification]) {
          participation[classification] = [];
        }
        participation[classification].push(fieldKey);
        continue;
      } else if (isCasesModule.value) {
        // Cases module: use case field model for classification (core vs system)
        const classification = classifyCaseField(fieldKey);
        if (classification === 'core') {
          coreIdentity.push(fieldKey);
          continue;
        }
        if (classification === 'system') {
          system.push(fieldKey);
          continue;
        }
        if (!participation[classification]) {
          participation[classification] = [];
        }
        participation[classification].push(fieldKey);
        continue;
      } else if (isInventoryWorkbenchModule.value) {
        const moduleKey = String(selectedModule.value?.key || '').toLowerCase();
        const classification = classifyInventoryWorkbenchField(moduleKey, fieldKey);
        if (classification === 'core') {
          coreIdentity.push(fieldKey);
          continue;
        }
        if (classification === 'system') {
          system.push(fieldKey);
          continue;
        }
        if (!participation[classification]) {
          participation[classification] = [];
        }
        participation[classification].push(fieldKey);
        continue;
      } else if (isFormsModule.value) {
        // Forms module: use form-specific field classification
        // ARCHITECTURE NOTE: Forms Settings configure structure & behavior ONLY.
        // See: client/src/platform/modules/forms/formsModule.definition.ts
        
        // Core Form Fields (platform-owned): name, description, visibility, status, assignedTo, approvalRequired
        const coreFormFields = ['name', 'description', 'visibility', 'status', 'assignedto', 'approvalrequired'];
        if (coreFormFields.includes(fieldKey.toLowerCase())) {
          coreIdentity.push(fieldKey);
          continue;
        }
        
        // Logic & Rules fields: kpiMetrics, scoringFormula, thresholds, autoAssignment
        const logicFields = ['kpimetrics', 'scoringformula', 'thresholds', 'autoassignment'];
        if (logicFields.some(lf => fieldKey.toLowerCase().includes(lf.toLowerCase()))) {
          // Group under 'LOGIC' app scope for display
          if (!participation['LOGIC']) {
            participation['LOGIC'] = [];
          }
          participation['LOGIC'].push(fieldKey);
          continue;
        }
        
        // Outcomes fields: outcomesAndRules.auditResultRule, outcomesAndRules.reportingMetrics, outcomesAndRules.postSubmissionSignals
        const outcomesFields = ['auditresultrule', 'reportingmetrics', 'postsubmissionsignals', 'outcomesandrules'];
        if (outcomesFields.some(of => fieldKey.toLowerCase().includes(of.toLowerCase()))) {
          // Group under 'OUTCOMES' app scope for display
          if (!participation['OUTCOMES']) {
            participation['OUTCOMES'] = [];
          }
          participation['OUTCOMES'].push(fieldKey);
          continue;
        }
        
        // Access fields: publicLink.enabled, publicLink.slug, approvalWorkflow
        const accessFields = ['publiclink', 'approvalworkflow', 'slug'];
        if (accessFields.some(af => fieldKey.toLowerCase().includes(af.toLowerCase()))) {
          // Group under 'ACCESS' app scope for display
          if (!participation['ACCESS']) {
            participation['ACCESS'] = [];
          }
          participation['ACCESS'].push(fieldKey);
          continue;
        }
        
        // System fields (formId, formVersion, createdAt, updatedAt)
        // ARCHITECTURE NOTE: Form Type is a CORE domain field, not a system field.
        // It is user-editable and intent-defining.
        // See: client/src/platform/forms/formTypeRegistry.ts
        const systemFields = ['formid', 'formversion', 'createdat', 'updatedat', 'createdby', 'modifiedby', 'organizationid', '_id', '__v'];
        if (systemFields.includes(fieldKey.toLowerCase()) || fieldKey.toLowerCase().startsWith('_')) {
          system.push(fieldKey);
          continue;
        }
        
        // Default: treat unknown fields as system
        system.push(fieldKey);
      } else {
        // People module: use metadata
        if (isGlobalSystemFieldKey(fieldKey)) {
          system.push(fieldKey);
          continue;
        }
        const metadata = getFieldMetadata(fieldKey);
        
        if (metadata.owner === 'core' && metadata.intent === 'identity') {
          coreIdentity.push(fieldKey);
        } else if (metadata.owner === 'participation' && metadata.fieldScope) {
          if (!participation[metadata.fieldScope]) {
            participation[metadata.fieldScope] = [];
          }
          participation[metadata.fieldScope].push(fieldKey);
        } else if (metadata.owner === 'system') {
          system.push(fieldKey);
        }
      }
    } catch (err) {
      // Field not in metadata - fail fast in development
      if (process.env.NODE_ENV === 'development') {
        if (isPeopleModule.value) {
          console.error(`[People Field Model] Field "${fieldKey}" is missing from PEOPLE_FIELD_METADATA`, err);
        }
      }
      // For now, treat as system field to prevent breaking
      system.push(fieldKey);
    }
  }

  if (isPeopleModule.value) {
    const canonicalCoreOrder = [
      'first_name',
      'last_name',
      'email',
      'phone',
      'mobile',
      'organization',
      'assignedTo',
      'source',
      'do_not_contact',
      'tags'
    ];
    const canonicalRank = new Map(
      canonicalCoreOrder.map((key, index) => [normalizeFieldKey(key), index])
    );
    coreIdentity.sort((a, b) => {
      const aRank = canonicalRank.get(normalizeFieldKey(a));
      const bRank = canonicalRank.get(normalizeFieldKey(b));
      const aPinned = typeof aRank === 'number';
      const bPinned = typeof bRank === 'number';
      if (aPinned && bPinned) return aRank - bRank;
      if (aPinned) return -1;
      if (bPinned) return 1;
      return 0;
    });
  }

  return { coreIdentity, participation, system };
});

// Normalize field key for comparison (handles relatedTo vs related-to etc.)
function normalizeFieldKey(key) {
  return String(key || '').trim().toLowerCase().replace(/-/g, '');
}

// Deal Stage and Pipeline options are configured in Pipelines & Stages, not in field options
function isDealPipelineOrStageField(field) {
  if (!field?.key || selectedModule.value?.key !== 'deals') return false;
  const norm = normalizeFieldKey(field.key);
  return norm === 'stage' || norm === 'pipeline';
}

function navigateToPipelines() {
  if (typeof props.onNavigateToPipelines === 'function') {
    props.onNavigateToPipelines();
    return;
  }
  if (selectedModule.value?.key === 'deals' && !props.excludedTabs?.includes('pipeline')) {
    activeTopTab.value = 'pipeline';
  }
}

/** Fields whose picklist options come from Settings → Types (per app), not inline field options. */
function getPeopleTypesTabFieldInfo(field) {
  if (!field?.key || selectedModule.value?.key?.toLowerCase() !== 'people') return null;
  const k = normalizeFieldKey(field.key);
  // snake_case (API) or camelCase after normalize (e.g. salesType → salestype)
  if (isPeopleSalesRoleFieldKey(field.key)) {
    return { appKey: 'SALES', article: 'Type', scopeLabel: 'Sales role' };
  }
  if (k === 'helpdesk_role' || k === 'helpdeskrole') {
    return { appKey: 'HELPDESK', article: 'Role', scopeLabel: 'Helpdesk' };
  }
  return null;
}

function isPeopleTypesTabPicklistField(field) {
  return getPeopleTypesTabFieldInfo(field) != null;
}

function navigateToPeopleTypes(appKey = 'SALES') {
  if (props.excludedTabs?.includes('people-types')) return;
  const mod = selectedModule.value;
  if (!mod) return;
  const key = String(appKey || 'SALES').toUpperCase() === 'HELPDESK' ? 'HELPDESK' : 'SALES';
  activeTopTab.value = 'people-types';
  router.replace({
    query: {
      ...route.query,
      module: mod.key,
      field: editFields.value[selectedFieldIdx.value]?.key || '',
      mode: 'people-types',
      subtab: activeSubTab.value,
      peopleTypesApp: key
    }
  });
  try {
    localStorage.setItem(`arivu-modfields-tab-${mod.key}`, 'people-types');
  } catch (e) {}
}

// Helper: Check if a field is a custom field (owner: 'org')
function isCustomField(fieldKey) {
  const field = editFields.value.find(f => f.key === fieldKey);
  return field?.owner === 'org';
}

function resolveFieldListBadge(fieldKey) {
  const field = editFields.value.find(f => f.key === fieldKey);
  if (!field) return null;
  const moduleKey = String(selectedModule.value?.key || '').toLowerCase();

  if (field.owner === 'org') {
    return { type: 'custom', label: t('settings.modFieldsBadgeCustomField') };
  }

  if (isSystemField(field) || isGlobalSystemFieldKey(fieldKey)) {
    return { type: 'system', label: t('settings.modFieldsBadgeSystem') };
  }

  if (isModuleRegistered(moduleKey)) {
    const meta = getFieldMetadataFromRegistry(moduleKey, fieldKey);
    if (meta?.owner === 'system') {
      return { type: 'system', label: t('settings.modFieldsBadgeSystem') };
    }
    if (meta?.owner === 'participation' && meta.fieldScope) {
      return { type: 'participation', label: String(meta.fieldScope) };
    }
    if (meta?.owner === 'core') {
      return { type: 'core', label: t('settings.modFieldsBadgeCoreField') };
    }
  }

  if (isCoreField(field, moduleKey)) {
    return { type: 'core', label: t('settings.modFieldsBadgeCoreField') };
  }

  return { type: 'core', label: t('settings.modFieldsBadgeCoreField') };
}

function isSystemFieldKeyForList(fieldKey) {
  const field = editFields.value.find(f => f.key === fieldKey);
  if (!field) return false;
  return isSystemField(field) || isGlobalSystemFieldKey(fieldKey);
}

function canDragFieldInLayout(fieldKey) {
  const field = editFields.value.find(f => f.key === fieldKey);
  if (!field) return false;
  if (isFixedPositionField(field, selectedModule.value?.key)) return false;
  // System fields remain non-editable but may be repositioned in layout.
  return true;
}

function includeFieldInLayoutList(field) {
  if (!field?.key) return false;
  if (isOrganizationsModule.value && !showTenantFields.value) {
    const keyLower = String(field.key).toLowerCase();
    const tenantFieldPatterns = ['subscription.', 'limits.', 'settings.', 'slug', 'isactive', 'enabledmodules'];
    if (tenantFieldPatterns.some(pattern => keyLower.startsWith(pattern) || keyLower === pattern)) {
      return false;
    }
  }
  return true;
}

function onLayoutReorder(payload) {
  if (!fieldLayout.value) return;
  const moduleKey = selectedModule.value?.key || '';
  if (payload?.type === 'section' && payload.fromKey && payload.sectionId) {
    editFields.value = moveFieldToSection(editFields.value, fieldLayout.value, payload.fromKey, payload.sectionId);
    return;
  }
  if (payload?.fromKey && payload?.toKey) {
    editFields.value = moveFieldAcrossLayout(editFields.value, fieldLayout.value, payload.fromKey, payload.toKey);
  }
}

function onManageSectionsSave(nextLayout) {
  if (!nextLayout) return;
  fieldLayout.value = nextLayout;
  const applied = applyFieldLayoutToModuleState(
    selectedModule.value?.key || '',
    editFields.value,
    nextLayout
  );
  fieldLayout.value = applied.layout;
  editFields.value = applied.fields;
}

// Helper: Get field index by key (case-insensitive, ignores hyphens)
function getFieldIndex(fieldKey) {
  if (!fieldKey) return -1;
  const norm = normalizeFieldKey(fieldKey);
  return editFields.value.findIndex(f => f.key && normalizeFieldKey(f.key) === norm);
}

// Helper: Select field by key
// ARCHITECTURE: Never mutate editFields here unless adding a genuinely missing field.
// Replacing editFields triggers groupedFields recompute and causes fields to jump between
// Core/System sections. See .cursor/rules/field-configuration-selection.mdc
function selectFieldByKey(fieldKey) {
  if (!fieldKey) return;
  
  const keyLower = String(fieldKey || '').trim().toLowerCase();
  
  // For Tasks: clicks on legacy relatedToType/relatedToId should select the core relatedTo instead.
  // Only replace editFields when relatedTo is missing; replacing when it exists causes re-render
  // that makes fields appear to jump between Core and System sections.
  if (isTasksModule.value && activeTopTab.value === 'fields' && (keyLower === 'relatedtotype' || keyLower === 'relatedtoid')) {
    const hasRelatedTo = editFields.value.some((f) => normalizeFieldKey(f?.key) === 'relatedto');
    if (!hasRelatedTo) {
      editFields.value = ensureTaskRelatedToField(selectedModule.value?.key, editFields.value);
    }
    fieldKey = 'relatedTo';
  }
  
  let idx = getFieldIndex(fieldKey);
  
  // For Tasks + relatedTo: only replace editFields when relatedTo is truly missing.
  // Replacing when it already exists causes re-render/scroll that makes relatedTo appear to jump to System.
  // Key may be "relatedTo" or "related-to" - use normalized check
  if (idx < 0 && isTasksModule.value && activeTopTab.value === 'fields' && normalizeFieldKey(fieldKey) === 'relatedto') {
    const hasRelatedTo = editFields.value.some((f) => normalizeFieldKey(f?.key) === 'relatedto');
    if (!hasRelatedTo) {
      editFields.value = ensureTaskRelatedToField(selectedModule.value?.key, editFields.value);
    }
    idx = getFieldIndex('relatedTo');
  }
  
  // For Forms module: If field not found in editFields, check formSettingsMap and add it
  if (idx < 0 && isFormsModule.value && activeTopTab.value === 'fields') {
    const fieldMapping = getFieldMapping(fieldKey);
    if (fieldMapping) {
      // Create a field object from the mapping
      const newField = {
        key: fieldMapping.key,
        label: fieldMapping.label,
        dataType: 'Text', // Default data type
        editable: fieldMapping.editable,
        defaultValue: '',
        value: '',
        visibility: { list: true, detail: true },
        required: false,
        order: editFields.value.length
      };
      
      // Add to editFields
      editFields.value.push(newField);
      idx = editFields.value.length - 1;
    }
  }
  
  if (idx >= 0) {
    // Always call selectField, even if it's the same field, to ensure reactivity
    selectField(idx);
  }
}

function formatFieldLabelForDisplay(label, fieldKey = '') {
  const normalizedKey = String(fieldKey || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  const friendlyByKey = {
    contactid: 'Contact',
    organizationrefid: 'Organization',
    dealid: 'Deal',
  };
  if (friendlyByKey[normalizedKey]) return friendlyByKey[normalizedKey];

  const fallback = String(fieldKey || '').trim();
  const source = String(label || fallback || '').trim();
  if (!source) return source;

  return source
    .replace(/_/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function isFieldLabelReadOnly(field) {
  if (!field) return true;
  // Resolve owner: backend often sets owner='platform' for all platform fields; use metadata for accurate classification
  let owner = field?.owner;
  if (selectedModule.value?.key && isModuleRegistered(selectedModule.value.key)) {
    const meta = getFieldMetadataFromRegistry(selectedModule.value.key, field.key);
    if (meta) {
      owner = meta.owner; // Prefer metadata: 'system'|'core'|'participation' (accurate) over backend 'platform'
    } else if (owner == null) {
      owner = 'org'; // Custom field not in metadata → editable
    }
  }
  owner = owner ?? (!isModuleRegistered(selectedModule.value?.key || '') ? 'org' : 'platform');
  if (owner === 'platform' || owner === 'app') return true;
  if (owner === 'system') return true;
  if (isSystemField(field)) return true;
  if (isPeopleModule.value && getPeopleFieldMetadata(field.key)?.owner === 'system') return true;
  return false;
}

function onFieldLabelInput(event) {
  if (!currentField.value || isFieldLabelReadOnly(currentField.value)) return;
  currentField.value.label = event?.target?.value ?? '';
}

// Helper: Get field label
function getFieldLabel(fieldKey) {
  const field = editFields.value.find(f => f.key === fieldKey);
  return formatFieldLabelForDisplay(field?.label, fieldKey) || 'Untitled field';
}

// Helper: Get field data type
function getFieldDataType(fieldKey) {
  const field = editFields.value.find(f => f.key === fieldKey);
  return field?.dataType || '';
}

// Helper: Get People field metadata (safe, returns null if not found)
function getPeopleFieldMetadata(fieldKey) {
  if (!isPeopleModule.value || !fieldKey) return null;
  try {
    return getFieldMetadata(fieldKey);
  } catch (err) {
    return null;
  }
}

// Helper: Check if an Events field is an app participation field
// ARCHITECTURE NOTE: Events app participation fields are visibility-configurable ONLY.
// See: docs/architecture/event-settings.md Section 4.2
function isEventsAppParticipationField(fieldKey) {
  if (!isEventsModule.value || !fieldKey) return false;
  // Use event field model to check if field is a participation field
  const metadata = getEventFieldMetadata(fieldKey);
  return metadata?.owner === 'participation';
}

// Helper: Format app keys to app names for display
function formatRequiredForApps(appKeys) {
  if (!appKeys || !Array.isArray(appKeys) || appKeys.length === 0) return '';
  
  const appNameMap = {
    'SALES': 'Sales',
    'HELPDESK': 'Help Desk',
    'MARKETING': 'Marketing',
    'SERVICE': 'Service',
    'CORE': 'Platform'
  };
  
  return appKeys.map(key => appNameMap[key] || key).join(', ');
}

// Helper: Format owner for display
function formatOwnerDisplay(metadata) {
  if (!metadata) return '';
  
  if (metadata.owner === 'core') {
    return 'Core';
  } else if (metadata.owner === 'system') {
    return 'System';
  } else if (metadata.owner === 'participation') {
    // For participation fields, show the fieldScope (e.g., "Sales")
    const appNameMap = {
      'SALES': 'Sales',
      'HELPDESK': 'Help Desk',
      'MARKETING': 'Marketing',
      'INVENTORY': 'Inventory',
      'PORTAL': 'Portal',
      'SERVICE': 'Service',
      'CORE': 'Platform'
    };
    return appNameMap[metadata.fieldScope] || metadata.fieldScope || 'Participation';
  }
  
  return metadata.owner || '';
}

// Helper: Format intent for display
function formatIntentDisplay(intent) {
  if (!intent) return '';
  
  const intentMap = {
    'identity': 'Identity',
    'state': 'State',
    'detail': 'Detail',
    'system': 'System'
  };
  
  return intentMap[intent] || intent;
}

// Helper: Check if validation editing should be disabled (for participation fields)
function isValidationDisabled() {
  if (currentField.value?.dataType === 'Phone') return true;
  if ((!isPeopleModule.value && !isOrganizationsModule.value) || !currentField.value?.key) return false;
  const metadata = isOrganizationsModule.value
    ? getOrganizationFieldMetadata(currentField.value.key)
    : getPeopleFieldMetadata(currentField.value.key);
  return metadata?.owner === 'participation';
}

// Helper: Check if field can be hidden
function canHideField(field) {
  if (!field?.key) return true;
  
  // For Forms module, check formSettingsMap for system/fixed markers
  if (isFormsModule.value) {
    try {
      const fieldMapping = getFieldMapping(field.key);
      if (fieldMapping?.isSystem || fieldMapping?.isFixed) return false;
    } catch (err) {
      // Field not in mapping - continue with other checks
    }
  }
  
  // For People module, use metadata
  if (isPeopleModule.value) {
    try {
      const metadata = getFieldMetadata(field.key);
      // Can hide: core fields OR participation detail fields
      // Cannot hide: system fields OR participation state fields
      if (metadata.owner === 'system') return false;
      if (metadata.owner === 'participation' && metadata.intent === 'state') return false;
      return true;
    } catch (err) {
      return true; // Default to allowing hide if metadata not found
    }
  }
  
  // Default behavior for other modules
  return !isSystemField(field) && !isCoreField(field, selectedModule.value?.key);
}

// Helper: Check if field is a participation state field (locked by app)
function isParticipationStateField(field) {
  if ((!isPeopleModule.value && !isOrganizationsModule.value) || !field?.key) return false;
  
  try {
    const metadata = isOrganizationsModule.value
      ? getOrganizationFieldMetadata(field.key)
      : getFieldMetadata(field.key);
    return metadata?.owner === 'participation' && metadata?.intent === 'state';
  } catch (err) {
    return false;
  }
}

// Field type-specific settings
const showAddOption = ref(false);
const newOptionValue = ref('');
const newOptionColor = ref(PLATFORM_DEFAULT_PICKLIST_COLOR);
const currencySelectOptions = computed(() =>
  getEnabledCurrencyOptions(authStore.organization).map((currency) => ({
    value: currency.code,
    label: `${currency.code} - ${currency.name}`,
  }))
);

const numberSettings = ref({
  min: null,
  max: null,
  decimalPlaces: 2,
  currencyCode: resolveOrgCurrencyCode(authStore.organization),
  currencySymbol: getCurrencySymbolFromCode(resolveOrgCurrencyCode(authStore.organization)),
});

function getCurrencyFormatPreview() {
  const decimalPlaces =
    typeof numberSettings.value.decimalPlaces === 'number' ? numberSettings.value.decimalPlaces : 2;
  const code = numberSettings.value.currencyCode || resolveOrgCurrencyCode(authStore.organization);
  return (
    formatCurrencyValue(1234.56, {
      currencyCode: code,
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }) || `${numberSettings.value.currencySymbol || getCurrencySymbolFromCode(code)}1,234.56`
  );
}

function resolveCurrencyCodeFromNumberSettings(settings) {
  const explicitCode = String(settings?.currencyCode || settings?.currency || '').trim().toUpperCase();
  if (explicitCode) return explicitCode;
  // Do not infer USD from legacy currencySymbol ($); use org default
  return resolveOrgCurrencyCode(authStore.organization);
}
const textSettings = ref({ maxLength: null, rows: 4 });
const dateSettings = ref({ format: 'YYYY-MM-DD', timeFormat: '24h' });
const formulaSettings = ref({ expression: '', returnType: 'Text' });
const lookupSettings = ref({ targetModule: '', displayField: '' });

// Computed property to get lookup target module fields
const lookupTargetFields = computed(() => {
  if (!lookupSettings.value.targetModule) return [];
  const targetMod = modules.value.find(m => m.key === lookupSettings.value.targetModule);
  return targetMod?.fields || [];
});

// Check if a field is a system field that cannot be modified
function isSystemField(field) {
  if (!field || !field.key) return false;

  // Forms module: use Forms-specific logic (not in registry)
  if (isFormsModule.value) {
    if (field.key?.toLowerCase() === 'formtype') return false; // Form Type is CORE, not system
    try {
      const fieldMapping = getFieldMapping(field.key);
      if (fieldMapping?.isSystem) return true;
    } catch (err) {
      // Field not in mapping - fallback to legacy check
    }
    const formsSystemFields = ['formid', 'formversion', 'createdat', 'updatedat', 'createdby', 'modifiedby', 'organizationid', '_id', '__v'];
    return formsSystemFields.includes((field.key || '').toLowerCase()) || (field.key || '').toLowerCase().startsWith('_');
  }

  // Registered modules: use FieldCapabilityEngine
  if (selectedModule.value?.key && isModuleRegistered(selectedModule.value.key)) {
    return isSystemFieldFromEngine(selectedModule.value.key, field);
  }

  // Fallback for unknown modules: keys starting with _ are system
  return (field.key || '').toLowerCase().startsWith('_');
}

// Check if a field is a core field that cannot be deleted
function isCoreField(field, moduleKey) {
  if (!field || !field.key || !moduleKey) return false;
  
  // For Tasks module, use task field model
  if (moduleKey.toLowerCase() === 'tasks') {
    return isTaskProtectedField(field.key);
  }
  
  // For Organizations module, use organization field model
  if (moduleKey.toLowerCase() === 'organizations') {
    return isOrganizationProtectedField(field.key);
  }
  
  // For Deals module, use deal field model
  if (moduleKey.toLowerCase() === 'deals') {
    return isDealProtectedField(field.key);
  }
  
  // For Events module, use event field model
  if (moduleKey.toLowerCase() === 'events') {
    return isEventProtectedField(field.key);
  }
  
  // For Items module, use item field model
  if (moduleKey.toLowerCase() === 'items') {
    return isItemProtectedField(field.key);
  }

  if (moduleKey.toLowerCase() === 'quotes') {
    return isQuoteProtectedField(field.key);
  }

  if (moduleKey.toLowerCase() === 'sales_orders') {
    return isSalesOrderProtectedField(field.key);
  }

  if (moduleKey.toLowerCase() === 'invoices') {
    return isInvoiceProtectedField(field.key);
  }

  if (moduleKey.toLowerCase() === 'payments') {
    return isPaymentProtectedField(field.key);
  }

  if (moduleKey.toLowerCase() === 'documents') {
    return isDocumentProtectedField(field.key);
  }
  
  // For Forms module, check formSettingsMap for system/fixed field markers
  if (moduleKey.toLowerCase() === 'forms') {
    try {
      const fieldMapping = getFieldMapping(field.key);
      if (fieldMapping?.isSystem || fieldMapping?.isFixed) return true;
    } catch (err) {
      // Field not in mapping - fallback to legacy check
    }
    // ARCHITECTURE NOTE: Form Type is a CORE domain field, not a fixed position field
    // It is user-editable and intent-defining.
    // See: client/src/platform/forms/formTypeRegistry.ts
    if (field.key?.toLowerCase() === 'formtype') {
      return false; // Form Type is not fixed position
    }
  }
  
  // Core fields per module that cannot be deleted
  // NOTE: Tasks module now uses taskFieldModel.ts - see isTaskProtectedField() above
  const coreFieldsByModule = {
    'people': [
      // System fields (already protected, but listed for completeness)
      'createdby', 'assignedto', 'organizationid',
      // Core business fields
      'type', 'source', 'first_name', 'last_name', 'email', 'phone', 'mobile', 'organization',
      // Lead-specific core
      'lead_status', 'lead_owner', 'lead_score',
      // Contact-specific core
      'contact_status', 'role'
    ],
    // NOTE: Organizations module now uses organizationFieldModel.ts - see isOrganizationProtectedField() above
    // NOTE: Deals module now uses dealFieldModel.ts - see isDealProtectedField() above
    // NOTE: Events module now uses eventFieldModel.ts - see isEventProtectedField() above
    // NOTE: Items module now uses itemFieldModel.ts - see isItemProtectedField() above
    // Add other modules here if needed
    'forms': ['name', 'createdat', 'updatedat', 'createdby', 'modifiedby'] // Core system fields (formType is core but editable, not system)
  };
  
  const coreFields = coreFieldsByModule[moduleKey.toLowerCase()] || [];
  return coreFields.includes((field.key || '').toLowerCase());
}

// Check if a field cannot be reordered (must stay at top)
function isFixedPositionField(field, moduleKey) {
  if (!field || !field.key || !moduleKey) return false;
  
  // For Forms module, check formSettingsMap for fixed field markers
  if (moduleKey.toLowerCase() === 'forms') {
    try {
      const fieldMapping = getFieldMapping(field.key);
      if (fieldMapping?.isFixed) return true;
    } catch (err) {
      // Field not in mapping - fallback to legacy check
    }
    // Legacy check: name field must always be at the top
    if (field.key.toLowerCase() === 'name') {
      return true;
    }
  }
  
  // PLATFORM-LEVEL CANONICAL DEFAULT: Organizations Quick Create
  // Name field must always be present, required, and non-removable in Quick Create
  if (moduleKey.toLowerCase() === 'organizations' && field.key.toLowerCase() === 'name') {
    return true;
  }
  // ARCHITECTURE NOTE: Tasks Settings configure structure only, never work.
  // Title field must always be present, required, and non-removable in Quick Create
  // See: docs/architecture/task-settings.md Section 3.5
  if (moduleKey.toLowerCase() === 'tasks' && field.key.toLowerCase() === 'title') {
    return true;
  }
  return false;
}

// Normalize fields for forms module - ensure name field is at top and always visible
function normalizeFormsFields(fields, moduleKey) {
  if (moduleKey?.toLowerCase() !== 'forms') return fields;
  
  const nameField = fields.find(f => f.key?.toLowerCase() === 'name');
  if (nameField) {
    // Ensure visibility is always enabled
    nameField.visibility = { list: true, detail: true };
    // Ensure it's at position 0
    const nameFieldIdx = fields.indexOf(nameField);
    if (nameFieldIdx > 0) {
      fields.splice(nameFieldIdx, 1);
      fields.unshift(nameField);
    }
    nameField.order = 0;
    // Update order for other fields
    fields.forEach((f, i) => {
      if (f.key?.toLowerCase() !== 'name') {
        f.order = i;
      }
    });
  }
  return fields;
}

// Check if a field can be renamed (key changed) based on ownership
function canRenameField(field) {
  if (!field) return false;
  const owner = field?.owner || 'platform'; // Default to platform if not set
  // Only org-owned fields can be renamed
  return owner === 'org';
}

// Check if a field can have its type changed based on ownership
function canChangeFieldType(field) {
  if (!field) return false;
  const owner = field?.owner || 'platform'; // Default to platform if not set
  // Platform fields cannot have type changed, app and org fields can
  return owner !== 'platform';
}

// Check if a field can be deleted
const canDeleteField = computed(() => {
  if (!currentField.value || !selectedModule.value) return false;
  const owner = currentField.value?.owner || 'platform'; // Default to platform if not set
  
  // For Forms module, check formSettingsMap for system/fixed markers
  if (isFormsModule.value && currentField.value?.key) {
    try {
      const fieldMapping = getFieldMapping(currentField.value.key);
      if (fieldMapping?.isSystem || fieldMapping?.isFixed) return false;
    } catch (err) {
      // Field not in mapping - continue with other checks
    }
  }
  
  // Only org-owned fields can be deleted by org admins
  // Also check legacy system/core field checks for backward compatibility
  return owner === 'org' && !isSystemField(currentField.value) && !isCoreField(currentField.value, selectedModule.value.key);
});

// Load settings from currentField
function loadFieldSettings() {
  if (!currentField.value) return;
  const field = currentField.value;
  
  // Ensure visibility object exists (fields from server or ensureTaskRelatedToField may omit it)
  if (!field.visibility || typeof field.visibility !== 'object') {
    field.visibility = { list: true, detail: true };
  } else {
    if (typeof field.visibility.list === 'undefined') field.visibility.list = true;
    if (typeof field.visibility.detail === 'undefined') field.visibility.detail = true;
  }
  
  // For Forms module: Initialize formType defaultValue if not set
  if (isFormsModule.value && field.key === 'formType') {
    // If defaultValue is not set, try to get it from value or set a default
    if (!field.defaultValue && field.value) {
      field.defaultValue = field.value;
    } else if (!field.defaultValue) {
      // Set default to first available form type (usually 'audit')
      const availableTypes = getFormTypeDefinitions();
      if (availableTypes.length > 0) {
        field.defaultValue = availableTypes[0].key;
      }
    }
  }
  
  // Load number settings
  if (['Integer', 'Decimal', 'Currency'].includes(field.dataType)) {
    const currencyCode = resolveCurrencyCodeFromNumberSettings(field.numberSettings);
    numberSettings.value = {
      min: field.numberSettings?.min ?? null,
      max: field.numberSettings?.max ?? null,
      decimalPlaces: field.numberSettings?.decimalPlaces ?? (field.dataType === 'Currency' ? 2 : 0),
      currencyCode,
      currencySymbol: field.numberSettings?.currencySymbol ?? getCurrencySymbolFromCode(currencyCode),
    };
  }
  
  // Load text settings
  if (['Text', 'Text-Area'].includes(field.dataType)) {
    textSettings.value = {
      maxLength: field.textSettings?.maxLength ?? null,
      rows: field.textSettings?.rows ?? 4
    };
  }
  
  // Load date settings
  if (['Date', 'Date-Time'].includes(field.dataType)) {
    dateSettings.value = {
      format: field.dateSettings?.format ?? 'YYYY-MM-DD',
      timeFormat: field.dateSettings?.timeFormat ?? '24h'
    };
  }
  
  // Load formula settings
  if (field.dataType === 'Formula') {
    formulaSettings.value = {
      expression: field.formulaSettings?.expression ?? '',
      returnType: field.formulaSettings?.returnType ?? 'Text'
    };
  }
  
  // Load lookup settings
  if (field.dataType === 'Lookup (Relationship)') {
    lookupSettings.value = {
      targetModule: field.lookupSettings?.targetModule ?? '',
      displayField: field.lookupSettings?.displayField ?? ''
    };
  }
}

// Add picklist option
function isTaskStatusField(field = currentField.value) {
  return isTasksModule.value && String(field?.key || '').toLowerCase() === 'status';
}

function isTaskPriorityField(field = currentField.value) {
  return isTasksModule.value && String(field?.key || '').toLowerCase() === 'priority';
}

function isPeopleLeadStatusField(field = currentField.value) {
  return isPeopleModule.value && String(field?.key || '').toLowerCase() === 'lead_status';
}

function isPeopleContactStatusField(field = currentField.value) {
  return isPeopleModule.value && String(field?.key || '').toLowerCase() === 'contact_status';
}

function isTaskLifecycleField(field = currentField.value) {
  if (!isTasksModule.value) return false;
  const key = String(field?.key || '').toLowerCase();
  return key === 'status' || key === 'priority';
}

// System-locked: status "completed" cannot be edited or removed
function isOptionSystemLocked(option) {
  if (!isTaskStatusField(currentField.value)) return false;
  const val = typeof option === 'string' ? option : (option?.value || '');
  return String(val).toLowerCase() === 'completed';
}

function openTaskStatusPriorityLens() {
  activeTopTab.value = 'fields';
  const statusIdx = editFields.value.findIndex(f => String(f?.key || '').toLowerCase() === 'status');
  if (statusIdx >= 0) selectField(statusIdx);
}

/** Remap retired Organizations Status & Types deep links to Types. */
function resolveOrganizationsTopTab(tabId) {
  if (tabId === 'status-types') return 'organization-types';
  return tabId;
}

function openTaskPriorityInFieldConfig() {
  activeTopTab.value = 'fields';
  const priorityIdx = editFields.value.findIndex(f => String(f?.key || '').toLowerCase() === 'priority');
  if (priorityIdx >= 0) selectField(priorityIdx);
}

function getDocumentPicklistFieldFromConfig(fieldKey) {
  const normalizedFieldKey = String(fieldKey || '').toLowerCase();
  return editFields.value.find(field => String(field?.key || '').toLowerCase() === normalizedFieldKey);
}

function normalizeDocumentFieldOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt, enabled: true };
    }
    const value = opt.value ?? opt.label ?? '';
    return {
      value,
      label: opt.label ?? value,
      enabled: opt.enabled !== false,
    };
  });
}

const documentTypePicklist = computed(() => {
  const field = getDocumentPicklistFieldFromConfig('documentType');
  return normalizeDocumentFieldOptions(field?.options);
});

const documentStatusPicklist = computed(() => {
  const field = getDocumentPicklistFieldFromConfig('status');
  return normalizeDocumentFieldOptions(field?.options);
});

function openDocumentPicklistInFieldConfig(fieldKey) {
  activeTopTab.value = 'fields';
  void nextTick(() => selectFieldByKey(fieldKey));
}

function setDocumentPicklistEnabled(fieldKey, index, event) {
  const field = getDocumentPicklistFieldFromConfig(fieldKey);
  if (!field?.options?.length || index < 0 || index >= field.options.length) return;
  const enabled = Boolean(event?.target?.checked);
  const option = field.options[index];
  if (typeof option === 'string') {
    field.options[index] = { value: option, label: option, enabled };
  } else {
    field.options[index] = { ...option, enabled };
  }
}

function getDefaultOptionColor(optionValue, field = currentField.value, existingOptions = null) {
  const siblings = existingOptions ?? field?.options ?? [];
  if (!optionValue) {
    return nextPicklistOptionColor(siblings);
  }
  return resolveNewPicklistOptionColor({
    fieldKey: field?.key,
    moduleKey: selectedModule.value?.key || '',
    optionValue,
    existingOptions: siblings,
  });
}

// Normalize options - convert strings to objects for backward compatibility
const normalizedOptions = computed(() => {
  if (!currentField.value?.options || !Array.isArray(currentField.value.options)) return [];
  return backfillPicklistOptionColors(
    currentField.value.options,
    currentField.value?.key,
    selectedModule.value?.key || ''
  );
});

// Get option value (handles both string and object formats)
function getOptionValue(option) {
  if (typeof option === 'string') return option;
  return option?.value || '';
}

// Get option display label (label for status/priority, value for others)
function getOptionDisplayLabel(option) {
  if (typeof option === 'string') return option;
  return option?.label ?? option?.value ?? '';
}

// Get option color (with default)
function getOptionColor(option) {
  if (typeof option === 'string') return getDefaultOptionColor(option, currentField.value);
  return option?.color || getDefaultOptionColor(getOptionValue(option), currentField.value);
}

// Update option color
function updateOptionColor(index, color) {
  if (!currentField.value?.options || !Array.isArray(currentField.value.options)) return;
  const option = currentField.value.options[index];
  if (typeof option === 'string') {
    currentField.value.options[index] = { value: option, label: option, enabled: true, color };
  } else if (option && typeof option === 'object') {
    currentField.value.options[index] = { ...option, color };
  }
}

// Update option enabled (status/priority lifecycle)
function updateOptionEnabled(index, enabled) {
  if (!currentField.value?.options || !Array.isArray(currentField.value.options)) return;
  const option = currentField.value.options[index];
  if (typeof option === 'string') {
    currentField.value.options[index] = { value: option, label: option, enabled, color: getDefaultOptionColor(option, currentField.value) };
  } else if (option && typeof option === 'object') {
    currentField.value.options[index] = { ...option, enabled };
  }
}

function addOption() {
  if (!newOptionValue.value.trim()) return;
  if (!currentField.value.options) {
    currentField.value.options = [];
  }
  
  const optionValue = newOptionValue.value.trim();
  const optionColor = newOptionColor.value || getDefaultOptionColor(optionValue, currentField.value);
  const isLifecycle = isTaskLifecycleField(currentField.value);
  const slug = optionValue.toLowerCase().replace(/\s+/g, '_');
  const valueToUse = isLifecycle ? slug : optionValue;
  
  const existingValues = currentField.value.options.map(opt => 
    typeof opt === 'string' ? opt : (opt.value || '')
  );
  
  if (!existingValues.includes(valueToUse)) {
    currentField.value.options.push({ 
      value: valueToUse,
      label: optionValue,
      enabled: isLifecycle ? true : undefined,
      color: optionColor 
    });
  }
  
  newOptionValue.value = '';
  newOptionColor.value = getDefaultOptionColor('', currentField.value);
  showAddOption.value = false;
}

// Remove picklist option
function removeOption(index) {
  if (!currentField.value?.options || !Array.isArray(currentField.value.options)) return;
  const option = currentField.value.options[index];
  if (isOptionSystemLocked(option)) return;
  if (isTaskPriorityField(currentField.value) && currentField.value.options.length <= 1) return;
  currentField.value.options.splice(index, 1);
  if (editingOptionIdx.value === index) {
    editingOptionIdx.value = -1;
    editOptionValue.value = '';
  } else if (editingOptionIdx.value > index) {
    editingOptionIdx.value--;
  }
}

// Move picklist option (reorder)
function moveOption(from, to) {
  if (!currentField.value?.options || !Array.isArray(currentField.value.options)) return;
  if (from === to || from < 0 || to < 0 || from >= currentField.value.options.length || to >= currentField.value.options.length) return;
  const option = currentField.value.options[from];
  if (isOptionSystemLocked(option)) return;
  currentField.value.options.splice(from, 1);
  const insertIdx = from < to ? to - 1 : to;
  currentField.value.options.splice(insertIdx, 0, option);
  if (editingOptionIdx.value === from) {
    editingOptionIdx.value = insertIdx;
  } else if (editingOptionIdx.value > from && editingOptionIdx.value <= insertIdx) {
    editingOptionIdx.value--;
  } else if (editingOptionIdx.value < from && editingOptionIdx.value >= insertIdx) {
    editingOptionIdx.value++;
  }
}

function onOptionDragStart(event, optIdx) {
  dragOptionStartIdx.value = optIdx;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(optIdx));
}

function onOptionDragOver(optIdx) {
  dragOptionOverIdx.value = optIdx;
}

function onOptionDrop(optIdx) {
  const from = dragOptionStartIdx.value;
  const to = optIdx;
  dragOptionStartIdx.value = null;
  dragOptionOverIdx.value = null;
  if (from === null || to === null || from === to) return;
  moveOption(from, to);
}

function onOptionDragEnd() {
  dragOptionStartIdx.value = null;
  dragOptionOverIdx.value = null;
}

// Inline edit for picklist options (status/priority lifecycle fields)
function startOptionEdit(index) {
  if (isOptionSystemLocked(currentField.value.options[index])) return;
  const opt = currentField.value.options[index];
  const label = typeof opt === 'object' && opt?.label ? opt.label : (typeof opt === 'string' ? opt : opt?.value || '');
  editingOptionIdx.value = index;
  editOptionValue.value = String(label || '');
}

function saveOptionEdit(index) {
  if (editingOptionIdx.value !== index) return;
  const opt = currentField.value.options[index];
  const newLabel = editOptionValue.value.trim();
  if (!newLabel) {
    cancelOptionEdit(index);
    return;
  }
  if (typeof opt === 'string') {
    currentField.value.options[index] = { value: newLabel.toLowerCase().replace(/\s+/g, '_'), label: newLabel, enabled: true, color: getDefaultOptionColor(newLabel, currentField.value) };
  } else if (opt && typeof opt === 'object') {
    const newValue = (opt.value || '').toString().startsWith('status_') || (opt.value || '').toString().startsWith('priority_')
      ? newLabel.toLowerCase().replace(/\s+/g, '_')
      : (opt.value || opt.label || newLabel);
    currentField.value.options[index] = { ...opt, value: newValue, label: newLabel };
  }
  editingOptionIdx.value = -1;
  editOptionValue.value = '';
}

function cancelOptionEdit(index) {
  if (editingOptionIdx.value === index) {
    editingOptionIdx.value = -1;
    editOptionValue.value = '';
  }
}

const fetchModules = async (apiGetOptions = {}) => {
  loading.value = true;
  try {
    // Use context=all so Settings receives both global and app-specific custom fields
    // Pass cache: 'no-store' after saves — otherwise metadata cache can serve stale quickCreate for 5 minutes
    const data = await fetchModulesListCached({ context: 'all' }, apiGetOptions);
    if (data.success) {
      modules.value = normalizeModulesForSettingsDefaults(data.data);
      // Initialize from URL when present. startWithModuleList only blocks implicit auto-select
      // (single filtered module, localStorage) — not an explicit ?module= from a card click.
      // PlatformShell remounts settings on fullPath change, so card clicks must restore from URL.
      const moduleKeyFromRoute = typeof route.query.module === 'string'
        ? route.query.module
        : typeof route.query.moduleKey === 'string'
          ? route.query.moduleKey
          : null;
      const fieldKey = typeof route.query.field === 'string' ? route.query.field : null;
      const modeKey = typeof route.query.mode === 'string' ? route.query.mode : null;
      const subKey = typeof route.query.subtab === 'string' ? route.query.subtab : null;
      let initialMod = null;
      if (moduleKeyFromRoute) {
        initialMod = modules.value.find(m => m.key === moduleKeyFromRoute) || null;
      }
      if (!initialMod && props.moduleFilter && !props.startWithModuleList) {
        const filtered = modules.value.filter((m) => m.key !== 'users' && props.moduleFilter(m));
        if (filtered.length === 1) {
          initialMod = filtered[0];
        }
      }
      if (initialMod) {
        selectedModuleId.value = initialMod._id;
        const initial = JSON.parse(JSON.stringify(initialMod.fields || []));
        const sorted = initial.sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
        let normalizedFields = normalizeFieldsForConfig(initialMod.key, uniqueFieldsByKey(sorted));
        normalizedFields = normalizeFormsFields(normalizedFields, initialMod.key);
        normalizedFields = normalizeTaskFieldConfigurationOrder(initialMod.key, normalizedFields);
        normalizedFields = ensureTaskRelatedToField(initialMod.key, normalizedFields);
        
        // DEBUG: Log fields for items module
        if (initialMod.key?.toLowerCase() === 'items') {
          console.log('[ModulesAndFields] Items module fields:', {
            initialFieldsCount: initial.length,
            normalizedFieldsCount: normalizedFields.length,
            initialFields: initial.map(f => ({ key: f.key, label: f.label, dataType: f.dataType })),
            normalizedFields: normalizedFields.map(f => ({ key: f.key, label: f.label, dataType: f.dataType }))
          });
        }
        
        // Initialize filter metadata for People module fields based on metadata
        if (initialMod.key?.toLowerCase() === 'people') {
          const peopleFilterMetadata = {
            'assignedTo': {
              filterable: true,
              filterType: 'user',
              filterPriority: 1
            },
            'type': {
              filterable: true,
              filterType: 'multi-select',
              filterPriority: 2
            },
            'sales_type': {
              filterable: true,
              filterType: 'multi-select',
              filterPriority: 2
            },
            'helpdesk_role': {
              filterable: true,
              filterType: 'multi-select',
              filterPriority: 2
            },
            'do_not_contact': {
              filterable: true,
              filterType: 'boolean',
              filterPriority: 3
            },
            'organization': {
              filterable: true,
              filterType: 'entity',
              filterPriority: 4
            }
          };
          
          // Initialize filter metadata for fields that should have it
          // Enable filterable fields by default based on metadata
          normalizedFields.forEach(field => {
            if (field.key && peopleFilterMetadata[field.key]) {
              const filterMeta = peopleFilterMetadata[field.key];
              // Always set filterable to true for known filterable fields (enable by default)
              field.filterable = filterMeta.filterable;
              // Set filterType and filterPriority if not explicitly set by user
              if (field.filterType === undefined || field.filterType === null) {
                field.filterType = filterMeta.filterType;
              }
              if (field.filterPriority === undefined || field.filterPriority === null) {
                field.filterPriority = filterMeta.filterPriority;
              }
            } else if (field.key) {
              // Ensure filterable defaults to false if not set
              if (field.filterable === undefined) {
                field.filterable = false;
              }
            }
          });
        }
        
        {
          const layoutAppliedInit = applyFieldLayoutToModuleState(
            initialMod.key,
            normalizedFields,
            initialMod.fieldLayout
          );
          fieldLayout.value = layoutAppliedInit.layout;
          editFields.value = layoutAppliedInit.fields;
        }
        
        // For People module: enforce default "Required in Form" flags when no saved Quick Create config exists
        if (initialMod.key?.toLowerCase() === 'people') {
          const hasQuickCreateConfig = initialMod.quickCreate && initialMod.quickCreate.length > 0;
          
          // Only apply defaults if no Quick Create config exists (fresh instance)
          if (!hasQuickCreateConfig) {
            // Set first_name as required
            const firstNameField = editFields.value.find(f => f.key === 'first_name');
            if (firstNameField) {
              firstNameField.required = true;
            }
            
            // Ensure all other eligible fields are optional
            editFields.value.forEach(field => {
              if (field.key && field.key !== 'first_name') {
                try {
                  if (isFieldEligibleForQuickCreate(field.key)) {
                    field.required = false;
                  }
                } catch {
                  // Field not eligible, leave as is
                }
              }
            });
          }
        }
        // Select field by key if provided (normalized match so relatedTo / related-to both work)
        let idx = fieldKey ? getFieldIndex(fieldKey) : -1;
        if (idx < 0) {
          // No fieldKey in URL: For People module, select first Core Identity field
          if (initialMod.key?.toLowerCase() === 'people') {
            const coreIdentityFields = getCoreIdentityFields();
            if (coreIdentityFields.length > 0) {
              idx = editFields.value.findIndex(f => f.key === coreIdentityFields[0]);
            }
            if (idx < 0) {
              // Fallback to first Participation field
              const participationFields = getParticipationFields('SALES');
              if (participationFields.length > 0) {
                idx = editFields.value.findIndex(f => f.key === participationFields[0]);
              }
            }
            if (idx < 0) {
              // Fallback to first non-system field
              idx = editFields.value.findIndex(f => {
                if (!f.key) return false;
                try {
                  const metadata = getFieldMetadata(f.key);
                  return metadata.owner !== 'system';
                } catch {
                  return true;
                }
              });
            }
          }
          // Default to 0 if still not found
          idx = Math.max(0, idx);
        }
        selectedFieldIdx.value = Math.max(0, idx);
        fieldSearch.value = '';
        syncOptionsBuffer();
        // Always prioritize URL mode, then localStorage, then default to 'fields'
        // Get allowed tabs for this module
        const allowedTabs = getAllowedTopTabs(initialMod.key);
        let tabToSet = allowedTabs[0] || 'fields'; // default to first allowed tab
        const urlMode = initialMod.key === 'organizations' ? resolveOrganizationsTopTab(modeKey) : modeKey;
        if (urlMode && allowedTabs.includes(urlMode)) {
          tabToSet = urlMode;
          console.log('Restoring tab from URL:', tabToSet);
        } else {
          // If no mode in URL, check localStorage for this module
          const storedModeRaw = localStorage.getItem(`arivu-modfields-tab-${initialMod.key}`);
          const storedMode = initialMod.key === 'organizations'
            ? resolveOrganizationsTopTab(storedModeRaw)
            : storedModeRaw;
          if (storedMode && allowedTabs.includes(storedMode)) {
            tabToSet = storedMode;
            console.log('Restoring tab from localStorage:', tabToSet, 'for module:', initialMod.key);
          } else {
            console.log('Using default tab:', tabToSet, 'for module:', initialMod.key);
          }
        }
        // Set directly without triggering watcher during initialization
        activeTopTab.value = tabToSet;
        const validSubTabs = ['general', 'validations', 'dependencies'];
        if (subKey && validSubTabs.includes(subKey)) {
          activeSubTab.value = subKey;
        }
        // Ensure URL reflects selection (use the tab we just set)
        router.replace({ query: { ...route.query, module: initialMod.key, field: editFields.value[selectedFieldIdx.value]?.key || '', mode: tabToSet, subtab: activeSubTab.value } });
        
        // If items module and status-types tab, initialize snapshot
        if (initialMod.key === 'items' && tabToSet === 'status-types') {
          nextTick(() => {
            const snapshotData = {
              itemTypes: itemTypes.value.map(t => ({
                value: t.value,
                label: t.label,
                enabled: t.enabled !== undefined ? t.enabled : true
              })),
              status: itemStatusPicklist.value.map(s => ({
                value: s.value,
                label: s.label || s.value,
                enabled: s.enabled !== undefined ? s.enabled : true
              }))
            };
            itemStatusTypesOriginalSnapshot.value = JSON.stringify(snapshotData);
            itemStatusTypesDirty.value = false;
          });
        }
        moduleNameEdit.value = initialMod.name || '';
        moduleEnabled.value = initialMod.enabled !== false;
        relationships.value = JSON.parse(JSON.stringify(initialMod.relationships || []));
        quickLayout.value = JSON.parse(JSON.stringify(initialMod.quickCreateLayout || { version: 1, rows: [] }));
        hydratePipelineSettingsFromModule(initialMod);
        // Initialize quick mode: always use simple (advanced mode hidden for now)
        quickMode.value = 'simple';
        router.replace({ query: { ...route.query, quickMode: quickMode.value } });
        // Choose selection source based on mode: advanced -> layout, simple -> quickCreate
        const layoutKeysInit = extractLayoutKeys(quickLayout.value);
        // Use quickCreate from module definition - NO hardcoding, all config comes from Settings UI
        let quickKeysInit = initialMod.quickCreate || [];
        
        // PLATFORM-LEVEL CANONICAL DEFAULT: Organizations Quick Create
        if (isOrganizationsModule.value) {
          const orgEligibleKeySet = new Set(
            quickCreateAvailableFields.value.map(f => (f.key || '').toLowerCase())
          );
          const filterOrgQuickCreateKeys = (keys) => keys.filter(key => {
            if (!key) return false;
            const keyLower = key.toLowerCase();
            if (keyLower === 'name') return true;
            return orgEligibleKeySet.has(keyLower);
          });

          if (!quickKeysInit || quickKeysInit.length === 0) {
            quickKeysInit = filterOrgQuickCreateKeys(ORGANIZATION_QUICK_CREATE_DEFAULT);
          } else {
            quickKeysInit = filterOrgQuickCreateKeys(quickKeysInit);
            const nameKey = quickKeysInit.find(k => k?.toLowerCase() === 'name');
            if (nameKey) {
              quickKeysInit = [nameKey, ...quickKeysInit.filter(k => k?.toLowerCase() !== 'name')];
            } else {
              quickKeysInit = ['name', ...quickKeysInit];
            }
          }
        }
        
        // For People module: use canonical default when no saved config (kept in sync with drawer / GET people/quick-create)
        if (isPeopleModule.value) {
          if (!quickKeysInit || quickKeysInit.length === 0) {
            const editKeys = new Set((editFields.value || []).map(f => (f.key || '').toLowerCase()));
            quickKeysInit = PEOPLE_QUICK_CREATE_DEFAULT.filter(key => {
              if (!key) return false;
              try {
                if (!isFieldEligibleForQuickCreate(key)) return false;
              } catch {
                return false;
              }
              return editKeys.has(key.toLowerCase());
            });
          } else {
            quickKeysInit = quickKeysInit.filter(key => {
              try {
                return isFieldEligibleForQuickCreate(key);
              } catch (err) {
                console.warn(`Skipping ineligible field "${key}" from saved Quick Create config:`, err.message);
                return false;
              }
            });
          }
        }

        // Deals: use canonical default when no saved config
        if (selectedModule.value?.key?.toLowerCase() === 'deals' && (!quickKeysInit || quickKeysInit.length === 0)) {
          const editKeys = new Set((editFields.value || []).map(f => (f.key || '').toLowerCase()));
          quickKeysInit = DEAL_QUICK_CREATE_DEFAULT.filter(key => {
            if (!key) return false;
            return editKeys.has(String(key).toLowerCase());
          });
        }

        // Cases: use canonical default when no saved config
        if (selectedModule.value?.key?.toLowerCase() === 'cases' && (!quickKeysInit || quickKeysInit.length === 0)) {
          const editKeys = new Set((editFields.value || []).map(f => (f.key || '').toLowerCase()));
          quickKeysInit = CASE_QUICK_CREATE_DEFAULT.filter(key => {
            if (!key) return false;
            return editKeys.has(String(key).toLowerCase());
          });
        }
        
        // fallback to locally stored quick selection if server returns empty (for other modules)
        if (!layoutKeysInit.length && !quickKeysInit.length) {
          try {
            const cached = JSON.parse(localStorage.getItem(`arivu-modfields-quick-${initialMod.key}`) || '[]');
            if (Array.isArray(cached) && cached.length) {
              let cachedKeys = cached;
              // For People module, filter cached keys too
              if (isPeopleModule.value) {
                const coreIdentityFieldKeys = getCoreIdentityFields();
                cachedKeys = cached.filter(key => {
                  if (!coreIdentityFieldKeys.includes(key)) return false;
                  try {
                    const metadata = getFieldMetadata(key);
                    return metadata.owner === 'core' && 
                           metadata.intent === 'identity' && 
                           metadata.editable === true;
                  } catch (err) {
                    return false;
                  }
                });
              }
              if (cachedKeys.length) quickKeysInit = cachedKeys;
            }
          } catch (e) {}
        }
        const useLayout = false; // Advanced mode hidden for now // (quickMode.value === 'advanced' && layoutKeysInit.length > 0);
        const baseKeys = useLayout ? layoutKeysInit : quickKeysInit;
        // Normalize baseKeys to match actual field keys in editFields (case-insensitive match)
        // This ensures keys like "event-type" or "eventType" both match the actual field key
        const normalizedBaseKeys = baseKeys.map(key => {
          if (!key) return null;
          // Try exact match first
          let field = editFields.value.find(f => f.key === key);
          if (field) return field.key;
          // Try case-insensitive match
          field = editFields.value.find(f => f.key && f.key.toLowerCase() === String(key).toLowerCase());
          if (field) return field.key;
          // Try kebab-case to camelCase conversion (event-type -> eventType)
          const camelCaseKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          field = editFields.value.find(f => f.key && f.key.toLowerCase() === camelCaseKey.toLowerCase());
          if (field) return field.key;

          // If no match found, log warning and return null (will be filtered out)
          console.warn(`⚠️  Field key "${key}" from quickCreate not found in module fields. Available keys:`, editFields.value.map(f => f.key).slice(0, 10));
          return null;
        }).filter(key => key !== null);
        
        // For People module, filter normalizedBaseKeys to only eligible core identity fields.
        let filteredBaseKeys = normalizedBaseKeys;
        if (isPeopleModule.value) {
          filteredBaseKeys = normalizedBaseKeys.filter(key => {
            try {
              return isFieldEligibleForQuickCreate(key);
            } catch (err) {
              console.warn(`Skipping field "${key}" from filteredBaseKeys:`, err.message);
              return false;
            }
          });
        }
        
        // Always include required fields in Simple mode (excluding system fields)
        let requiredKeys = editFields.value.filter(f => !!f.required && !!f.key && !isSystemField(f)).map(f => f.key);
        if (isPeopleModule.value) {
          requiredKeys = requiredKeys.filter(key => {
            try {
              return isFieldEligibleForQuickCreate(key);
            } catch (err) {
              return false;
            }
          });
        }
        
        // Quick Create source-of-truth precedence (mirrors selectModule):
        //   1. If the tenant has explicitly saved a quickCreate (`filteredBaseKeys.length > 0`),
        //      trust it as-is. Don't re-inject every field flagged `required: true` —
        //      otherwise a stale required flag silently re-adds fields that the user
        //      removed from Quick Create on every page reload.
        //   2. Only fall back to required fields when there's no saved selection yet.
        const combined = filteredBaseKeys.length > 0
          ? Array.from(new Set(filteredBaseKeys))
          : Array.from(new Set([...filteredBaseKeys, ...requiredKeys]));
        
        // For People module, ensure we only include eligible core identity fields.
        let finalCombined = combined;
        if (isPeopleModule.value) {
          finalCombined = combined.filter(key => {
            try {
              return isFieldEligibleForQuickCreate(key);
            } catch (err) {
              console.warn(`Skipping field "${key}" for Quick Create:`, err.message);
              return false;
            }
          });
        }
        
        const allowedQuickCreateKeys = new Set(quickCreateAvailableFields.value.map(f => f.key));
        const sanitizedCombined = finalCombined.filter(key => allowedQuickCreateKeys.has(key));
        quickCreateSelected.value = new Set(sanitizedCombined);
        
        // Initialize field order from saved quickCreate array (preserves order).
        // Mirror the precedence rule above: only seed from required fields when there
        // is no saved order to respect.
        if (filteredBaseKeys.length > 0) {
          // Filter quickCreateFieldOrder to only include eligible fields for People module
          let fieldOrder = filteredBaseKeys;
          if (isPeopleModule.value) {
            fieldOrder = filteredBaseKeys.filter(key => {
              try {
                return isFieldEligibleForQuickCreate(key);
              } catch (err) {
                console.warn(`Skipping field "${key}" from Quick Create order:`, err.message);
                return false;
              }
            });
          }
          quickCreateFieldOrder.value = [...fieldOrder];
          
          // PLATFORM-LEVEL CANONICAL DEFAULT: Organizations Quick Create
          // Ensure name is always first in field order
          if (isOrganizationsModule.value) {
            const nameIdx = quickCreateFieldOrder.value.findIndex(k => k?.toLowerCase() === 'name');
            if (nameIdx > 0) {
              const nameKey = quickCreateFieldOrder.value[nameIdx];
              quickCreateFieldOrder.value.splice(nameIdx, 1);
              quickCreateFieldOrder.value.unshift(nameKey);
            } else if (nameIdx === -1 && quickCreateSelected.value.has('name')) {
              // Name is selected but not in order - add it at the beginning
              quickCreateFieldOrder.value.unshift('name');
            }
          }
          
          // ARCHITECTURE NOTE: Tasks Settings configure structure only, never work.
          // Ensure title is always first in field order (required, locked position)
          // See: docs/architecture/task-settings.md Section 3.5
          if (isTasksModule.value) {
            const titleIdx = quickCreateFieldOrder.value.findIndex(k => k?.toLowerCase() === 'title');
            if (titleIdx > 0) {
              const titleKey = quickCreateFieldOrder.value[titleIdx];
              quickCreateFieldOrder.value.splice(titleIdx, 1);
              quickCreateFieldOrder.value.unshift(titleKey);
            } else if (titleIdx === -1 && quickCreateSelected.value.has('title')) {
              // Title is selected but not in order - add it at the beginning
              quickCreateFieldOrder.value.unshift('title');
            }
          }
        } else {
          // No saved order, initialize with editFields order (filtered for People/Organizations/Tasks/Events module)
          const fieldsToUse = isPeopleModule.value || isOrganizationsModule.value || isTasksModule.value || isEventsModule.value
            ? quickCreateAvailableFields.value 
            : editFields.value;
          quickCreateFieldOrder.value = fieldsToUse
            .filter(f => finalCombined.includes(f.key))
            .map(f => f.key);
          
          // PLATFORM-LEVEL CANONICAL DEFAULT: Organizations Quick Create
          // Ensure name is always first in field order
          if (isOrganizationsModule.value) {
            const nameIdx = quickCreateFieldOrder.value.findIndex(k => k?.toLowerCase() === 'name');
            if (nameIdx > 0) {
              const nameKey = quickCreateFieldOrder.value[nameIdx];
              quickCreateFieldOrder.value.splice(nameIdx, 1);
              quickCreateFieldOrder.value.unshift(nameKey);
            } else if (nameIdx === -1 && quickCreateSelected.value.has('name')) {
              // Name is selected but not in order - add it at the beginning
              quickCreateFieldOrder.value.unshift('name');
            }
          }
          
          // ARCHITECTURE NOTE: Tasks Settings configure structure only, never work.
          // Ensure title is always first in field order (required, locked position)
          // See: docs/architecture/task-settings.md Section 3.5
          if (isTasksModule.value) {
            const titleIdx = quickCreateFieldOrder.value.findIndex(k => k?.toLowerCase() === 'title');
            if (titleIdx > 0) {
              const titleKey = quickCreateFieldOrder.value[titleIdx];
              quickCreateFieldOrder.value.splice(titleIdx, 1);
              quickCreateFieldOrder.value.unshift(titleKey);
            } else if (titleIdx === -1 && quickCreateSelected.value.has('title')) {
              // Title is selected but not in order - add it at the beginning
              quickCreateFieldOrder.value.unshift('title');
            }
          }
          
          // ARCHITECTURE NOTE: Events Settings configure structure, constraints, and eligibility only.
          // Ensure eventName is always first in field order (required, locked position).
          // Quick Create is for simple scheduling, not audit workflows.
          // See: docs/architecture/event-settings.md Section 7
          if (isEventsModule.value) {
            const eventNameIdx = quickCreateFieldOrder.value.findIndex(k => k?.toLowerCase() === 'eventname');
            if (eventNameIdx > 0) {
              const eventNameKey = quickCreateFieldOrder.value[eventNameIdx];
              quickCreateFieldOrder.value.splice(eventNameIdx, 1);
              quickCreateFieldOrder.value.unshift(eventNameKey);
            } else if (eventNameIdx === -1 && quickCreateSelected.value.has('eventName')) {
              // eventName is selected but not in order - add it at the beginning
              quickCreateFieldOrder.value.unshift('eventName');
            }
          }
        }
        // capture snapshot after initializing state and all reactive updates settle
        // Use double nextTick to ensure all watchers and computed properties have updated
        nextTick(() => {
          nextTick(() => {
            originalSnapshot.value = getSnapshot();
            quickOriginalSnapshot.value = getQuickSnapshot();
          });
        });
        
        
        // Check if we should open add field dialog
        const action = typeof route.query.action === 'string' ? route.query.action : null;
        if (action === 'add' && modeKey === 'fields') {
          // Use nextTick to ensure the component is fully rendered
          nextTick(() => {
            openAddField();
            // Remove action from URL after triggering
            router.replace({ query: { ...route.query, action: undefined } });
          });
        }
      }
      // If no module from URL, use last persisted selection (only if that module is visible in current context)
      if (!initialMod && !props.startWithModuleList) {
        const storedModuleKey = localStorage.getItem('arivu-modfields-module') || null;
        if (storedModuleKey) {
          const storedMod = modules.value.find(m => m.key === storedModuleKey) || null;
          // When using a moduleFilter, only restore if the stored module is in the current list (e.g. Sales Schema only shows Deals + custom; don't restore People from Core Entities)
          const storedModInDisplayList = storedMod && storedMod.key !== 'users' && (!props.moduleFilter || props.moduleFilter(storedMod));
          if (storedModInDisplayList) {
            selectedModuleId.value = storedMod._id;
            const initial = JSON.parse(JSON.stringify(storedMod.fields || []));
            const sorted = initial.sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
            let normalizedFields = normalizeFieldsForConfig(storedMod.key, uniqueFieldsByKey(sorted));
            normalizedFields = normalizeFormsFields(normalizedFields, storedMod.key);
            normalizedFields = normalizeTaskFieldConfigurationOrder(storedMod.key, normalizedFields);
            normalizedFields = ensureTaskRelatedToField(storedMod.key, normalizedFields);
            
            // Initialize filter metadata for People module fields based on metadata
            if (storedMod.key?.toLowerCase() === 'people') {
              const peopleFilterMetadata = {
                'assignedTo': {
                  filterable: true,
                  filterType: 'user',
                  filterPriority: 1
                },
                'type': {
                  filterable: true,
                  filterType: 'multi-select',
                  filterPriority: 2
                },
                'sales_type': {
                  filterable: true,
                  filterType: 'multi-select',
                  filterPriority: 2
                },
                'helpdesk_role': {
                  filterable: true,
                  filterType: 'multi-select',
                  filterPriority: 2
                },
                'do_not_contact': {
                  filterable: true,
                  filterType: 'boolean',
                  filterPriority: 3
                },
                'organization': {
                  filterable: true,
                  filterType: 'entity',
                  filterPriority: 4
                }
              };
              
              // Initialize filter metadata for fields that should have it
              // Enable filterable fields by default based on metadata
              normalizedFields.forEach(field => {
                if (field.key && peopleFilterMetadata[field.key]) {
                  const filterMeta = peopleFilterMetadata[field.key];
                  // Always set filterable to true for known filterable fields (enable by default)
                  field.filterable = filterMeta.filterable;
                  // Set filterType and filterPriority if not explicitly set by user
                  if (field.filterType === undefined || field.filterType === null) {
                    field.filterType = filterMeta.filterType;
                  }
                  if (field.filterPriority === undefined || field.filterPriority === null) {
                    field.filterPriority = filterMeta.filterPriority;
                  }
                } else if (field.key) {
                  // Ensure filterable defaults to false if not set
                  if (field.filterable === undefined) {
                    field.filterable = false;
                  }
                }
              });
            }
            
            {
              const layoutAppliedStored = applyFieldLayoutToModuleState(
                storedMod.key,
                normalizedFields,
                storedMod.fieldLayout
              );
              fieldLayout.value = layoutAppliedStored.layout;
              editFields.value = layoutAppliedStored.fields;
            }
            // try stored field
            const storedFieldKey = localStorage.getItem('arivu-modfields-field') || '';
            const sidx = storedFieldKey ? editFields.value.findIndex(f => f.key === storedFieldKey) : 0;
            selectedFieldIdx.value = Math.max(0, sidx);
            syncOptionsBuffer();
            // Restore tab from localStorage for this module
            const storedTab = localStorage.getItem(`arivu-modfields-tab-${storedMod.key}`);
            if (storedTab && ['details', 'fields', 'relationships', 'quick'].includes(storedTab)) {
              activeTopTab.value = storedTab;
            }
            router.replace({ query: { ...route.query, module: storedMod.key, field: editFields.value[selectedFieldIdx.value]?.key || '', mode: activeTopTab.value, subtab: activeSubTab.value } });
            moduleNameEdit.value = storedMod.name || '';
            moduleEnabled.value = storedMod.enabled !== false;
            relationships.value = JSON.parse(JSON.stringify(storedMod.relationships || []));
            quickLayout.value = JSON.parse(JSON.stringify(storedMod.quickCreateLayout || { version: 1, rows: [] }));
            hydratePipelineSettingsFromModule(storedMod);
            // initialize quick mode: always use simple (advanced mode hidden for now)
            quickMode.value = 'simple';
            router.replace({ query: { ...route.query, quickMode: quickMode.value } });
            // now derive selection based on mode
            const layoutKeysInit = extractLayoutKeys(quickLayout.value);
            // Use quickCreate from module definition - NO hardcoding, all config comes from Settings UI
            const quickKeysInit = storedMod.quickCreate || [];
            
            const useLayout = false; // Advanced mode hidden for now // (quickMode.value === 'advanced' && layoutKeysInit.length > 0);
            const baseKeys = useLayout ? layoutKeysInit : quickKeysInit;
            // Normalize baseKeys to match actual field keys in editFields (case-insensitive match)
            const normalizedBaseKeys = baseKeys.map(key => {
              const field = editFields.value.find(f => f.key && f.key.toLowerCase() === key.toLowerCase());
              return field ? field.key : key;
            }).filter(key => key);
            const requiredKeys = editFields.value.filter(f => !!f.required && !!f.key).map(f => f.key);
            // Quick Create source-of-truth precedence (mirrors selectModule + fetchModules main path):
            // trust the saved quickCreate when it exists; only seed from required fields on first
            // visit. Otherwise stale `required: true` flags re-inject removed fields after refresh.
            const combined = normalizedBaseKeys.length > 0
              ? Array.from(new Set(normalizedBaseKeys))
              : Array.from(new Set([...normalizedBaseKeys, ...requiredKeys]));
            quickCreateSelected.value = new Set(combined);
            
            // Initialize field order from saved quickCreate array (preserves order).
            if (normalizedBaseKeys.length > 0) {
              quickCreateFieldOrder.value = [...normalizedBaseKeys];
            } else {
              // No saved order, initialize with editFields order
              quickCreateFieldOrder.value = editFields.value
                .filter(f => combined.includes(f.key))
                .map(f => f.key);
            }
            
            // capture snapshot after all reactive updates settle
            // Use double nextTick to ensure all watchers and computed properties have updated
            nextTick(() => {
              nextTick(() => {
                originalSnapshot.value = getSnapshot();
                quickOriginalSnapshot.value = getQuickSnapshot();
              });
            });
            
            // If we used default fields for Events and database doesn't have them, save them
            // But wait until initialization is complete
            if (storedMod.key === 'events' && (!storedMod.quickCreate || storedMod.quickCreate.length < 5) && combined.length > 0) {
              // Save default fields to database after initialization completes
              // Default fields are now set, user can save manually
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to load modules', e);
  } finally {
    loading.value = false;
  }
};

const selectModule = (mod, preferFieldKey = null) => {
  selectedModuleId.value = mod._id;
  const initial = JSON.parse(JSON.stringify(mod.fields || []));
  const sorted = initial.sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
  let normalizedFields = normalizeFieldsForConfig(mod.key, uniqueFieldsByKey(sorted));
  normalizedFields = normalizeFormsFields(normalizedFields, mod.key);
  normalizedFields = normalizeTaskFieldConfigurationOrder(mod.key, normalizedFields);
  normalizedFields = ensureTaskRelatedToField(mod.key, normalizedFields);
  
  // People module: Validate all fields have metadata
  if (mod.key?.toLowerCase() === 'people') {
    const missingFields = [];
    for (const field of normalizedFields) {
      // Org custom fields are intentionally runtime-defined and not listed in PEOPLE_FIELD_METADATA.
      // Global system fields (trash/audit infra) are classified centrally and may not
      // exist in module-specific metadata maps.
      if (field.key && field.owner !== 'org' && !isGlobalSystemFieldKey(field.key)) {
        try {
          getFieldMetadata(field.key);
        } catch (err) {
          missingFields.push(field.key);
        }
      }
    }
    if (missingFields.length > 0) {
      console.error('[People Field Model] Fields missing from PEOPLE_FIELD_METADATA:', missingFields);
      // Fail fast in development
      if (process.env.NODE_ENV === 'development') {
        throw new Error(`People fields missing metadata: ${missingFields.join(', ')}. All People fields must be classified in peopleFieldModel.ts`);
      }
    }
  }
  
  // Initialize filter metadata for People module fields based on metadata
  if (mod.key?.toLowerCase() === 'people') {
    const peopleFilterMetadata = {
      'assignedTo': {
        filterable: true,
        filterType: 'user',
        filterPriority: 1
      },
      'type': {
        filterable: true,
        filterType: 'multi-select',
        filterPriority: 2
      },
      'sales_type': {
        filterable: true,
        filterType: 'multi-select',
        filterPriority: 2
      },
      'helpdesk_role': {
        filterable: true,
        filterType: 'multi-select',
        filterPriority: 2
      },
      'do_not_contact': {
        filterable: true,
        filterType: 'boolean',
        filterPriority: 3
      },
      'organization': {
        filterable: true,
        filterType: 'entity',
        filterPriority: 4
      }
    };
    
              // Initialize filter metadata for fields that should have it
              // Enable filterable fields by default based on metadata
              normalizedFields.forEach(field => {
                if (field.key && peopleFilterMetadata[field.key]) {
                  const filterMeta = peopleFilterMetadata[field.key];
                  // Always set filterable to true for known filterable fields (enable by default)
                  field.filterable = filterMeta.filterable;
                  // Set filterType and filterPriority if not explicitly set by user
                  if (field.filterType === undefined || field.filterType === null) {
                    field.filterType = filterMeta.filterType;
                  }
                  if (field.filterPriority === undefined || field.filterPriority === null) {
                    field.filterPriority = filterMeta.filterPriority;
                  }
                } else if (field.key) {
                  // Ensure filterable defaults to false if not set
                  if (field.filterable === undefined) {
                    field.filterable = false;
                  }
                }
              });
            }
  
  const layoutApplied = applyFieldLayoutToModuleState(mod.key, normalizedFields, mod.fieldLayout);
  fieldLayout.value = layoutApplied.layout;
  editFields.value = layoutApplied.fields;
  if (preferFieldKey) {
    const idx = getFieldIndex(preferFieldKey);
    selectedFieldIdx.value = idx >= 0 ? idx : 0;
  } else {
    // For People module: Select first Core Identity field (better UX)
    // Falls back to first Participation field, then first editable field, then 0
    if (mod.key?.toLowerCase() === 'people') {
      let firstFieldIdx = 0;
      
      // Try to find first Core Identity field
      const coreIdentityFields = getCoreIdentityFields();
      if (coreIdentityFields.length > 0) {
        const firstCoreField = editFields.value.findIndex(f => f.key === coreIdentityFields[0]);
        if (firstCoreField >= 0) {
          firstFieldIdx = firstCoreField;
        }
      }
      
      // If no Core Identity field found, try first Participation field
      if (firstFieldIdx === 0) {
        const participationFields = getParticipationFields('SALES');
        if (participationFields.length > 0) {
          const firstParticipationField = editFields.value.findIndex(f => f.key === participationFields[0]);
          if (firstParticipationField >= 0) {
            firstFieldIdx = firstParticipationField;
          }
        }
      }
      
      // If still 0, find first non-system field
      if (firstFieldIdx === 0) {
        const firstNonSystemIdx = editFields.value.findIndex(f => {
          if (!f.key) return false;
          try {
            const metadata = getFieldMetadata(f.key);
            return metadata.owner !== 'system';
          } catch {
            return true; // If metadata not found, allow it
          }
        });
        if (firstNonSystemIdx >= 0) {
          firstFieldIdx = firstNonSystemIdx;
        }
      }
      
      selectedFieldIdx.value = firstFieldIdx;
    } else {
      selectedFieldIdx.value = 0;
    }
  }
  fieldSearch.value = '';
  syncOptionsBuffer();
  // Restore tab from localStorage when selecting module (before updating URL)
  const allowedTabs = getAllowedTopTabs(mod.key);
  const storedTabRaw = localStorage.getItem(`arivu-modfields-tab-${mod.key}`);
  const storedTab = mod.key === 'organizations' ? resolveOrganizationsTopTab(storedTabRaw) : storedTabRaw;
  if (storedTab && allowedTabs.includes(storedTab)) {
    console.log('Restoring tab from localStorage when selecting module:', storedTab, 'for module:', mod.key);
    activeTopTab.value = storedTab;
  } else if (!allowedTabs.includes(activeTopTab.value)) {
    const fallbackTab = mod.key === 'organizations'
      ? resolveOrganizationsTopTab(activeTopTab.value)
      : activeTopTab.value;
    activeTopTab.value = allowedTabs.includes(fallbackTab) ? fallbackTab : (allowedTabs[0] || 'fields');
  }
  const selKey = editFields.value[selectedFieldIdx.value]?.key || '';
  router.replace({ query: { ...route.query, module: mod.key, field: selKey, mode: activeTopTab.value, subtab: activeSubTab.value } });
  
  // If items module and status-types tab, initialize snapshot
  if (mod.key === 'items' && activeTopTab.value === 'status-types') {
    nextTick(() => {
      const snapshotData = {
        itemTypes: itemTypes.value.map(t => ({
          value: t.value,
          label: t.label,
          enabled: t.enabled !== undefined ? t.enabled : true
        })),
        status: itemStatusPicklist.value.map(s => ({
          value: s.value,
          label: s.label || s.value,
          enabled: s.enabled !== undefined ? s.enabled : true
        }))
      };
      itemStatusTypesOriginalSnapshot.value = JSON.stringify(snapshotData);
    });
  }
  // persist selection
  try { localStorage.setItem('arivu-modfields-module', mod.key); } catch (e) {}
  try { if (selKey) localStorage.setItem('arivu-modfields-field', selKey); } catch (e) {}
  moduleNameEdit.value = mod.name || '';
  moduleEnabled.value = mod.enabled !== false;
  relationships.value = JSON.parse(JSON.stringify(mod.relationships || []));
  quickLayout.value = JSON.parse(JSON.stringify(mod.quickCreateLayout || { version: 1, rows: [] }));
  // always use simple mode (advanced mode hidden for now)
  quickMode.value = 'simple';
  router.replace({ query: { ...route.query, quickMode: quickMode.value } });
  hydratePipelineSettingsFromModule(mod);
  // Choose selection source based on mode: advanced -> layout, simple -> quickCreate
  const layoutKeys = extractLayoutKeys(quickLayout.value);
  let quickKeys = mod.quickCreate || [];

  // Organizations: use canonical default when no saved config
  if (mod.key?.toLowerCase() === 'organizations' && (!quickKeys || quickKeys.length === 0)) {
    const orgEligibleKeySet = new Set(
      quickCreateAvailableFields.value.map(f => (f.key || '').toLowerCase())
    );
    quickKeys = ORGANIZATION_QUICK_CREATE_DEFAULT.filter(key => {
      if (!key) return false;
      if (key.toLowerCase() === 'name') return true;
      return orgEligibleKeySet.has(key.toLowerCase());
    });
  }

  // People: use canonical default when no saved config (kept in sync with drawer / GET people/quick-create)
  if (mod.key?.toLowerCase() === 'people' && (!quickKeys || quickKeys.length === 0)) {
    const editKeys = new Set((editFields.value || []).map(f => (f.key || '').toLowerCase()));
    quickKeys = PEOPLE_QUICK_CREATE_DEFAULT.filter(key => {
      if (!key) return false;
      try {
        if (!isFieldEligibleForQuickCreate(key)) return false;
      } catch {
        return false;
      }
      return editKeys.has(key.toLowerCase());
    });
  }

  // Deals: use canonical default when no saved config
  if (mod.key?.toLowerCase() === 'deals' && (!quickKeys || quickKeys.length === 0)) {
    const editKeys = new Set((editFields.value || []).map(f => (f.key || '').toLowerCase()));
    quickKeys = DEAL_QUICK_CREATE_DEFAULT.filter(key => {
      if (!key) return false;
      return editKeys.has(String(key).toLowerCase());
    });
  }

  // Cases: use canonical default when no saved config
  if (mod.key?.toLowerCase() === 'cases' && (!quickKeys || quickKeys.length === 0)) {
    const editKeys = new Set((editFields.value || []).map(f => (f.key || '').toLowerCase()));
    quickKeys = CASE_QUICK_CREATE_DEFAULT.filter(key => {
      if (!key) return false;
      return editKeys.has(String(key).toLowerCase());
    });
  }

  // Fallback to locally stored quick selection if server returns empty (for other modules)
  if (!layoutKeys.length && !quickKeys.length) {
    try {
      const cached = JSON.parse(localStorage.getItem(`arivu-modfields-quick-${mod.key}`) || '[]');
      if (Array.isArray(cached) && cached.length) quickKeys = cached;
    } catch (e) {}
  }
  const useLayout = false; // Advanced mode hidden for now // (quickMode.value === 'advanced' && layoutKeys.length > 0);
  const baseKeys = useLayout ? layoutKeys : quickKeys;
  // Normalize baseKeys to match actual field keys in editFields (case-insensitive match)
  const normalizedBaseKeys = baseKeys.map(key => {
    if (!key) return null;
    // Try exact match first
    let field = editFields.value.find(f => f.key === key);
    if (field) return field.key;
    // Try case-insensitive match
    field = editFields.value.find(f => f.key && f.key.toLowerCase() === String(key).toLowerCase());
    if (field) return field.key;
    // Try kebab-case to camelCase conversion (event-type -> eventType)
    const camelCaseKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    field = editFields.value.find(f => f.key && f.key.toLowerCase() === camelCaseKey.toLowerCase());
    if (field) return field.key;
    // If no match found, log warning and return null (will be filtered out)
    console.warn(`⚠️  Field key "${key}" from quickCreate not found in module fields. Available keys:`, editFields.value.map(f => f.key).slice(0, 10));
    return null;
  }).filter(key => key !== null);
  const requiredKeys = editFields.value.filter(f => !!f.required && !!f.key).map(f => f.key);
  // Quick Create source-of-truth precedence:
  //   1. If the tenant has an explicit saved quickCreate (`normalizedBaseKeys.length > 0`),
  //      trust it as-is. Do NOT re-inject every field with `required: true`, because a
  //      stale required flag on a config-level field (e.g. description / relatedTo set
  //      required for record creation) would silently re-add it to Quick Create on every
  //      page reload — making Settings appear to "save 4 fields, then show 6 after refresh".
  //   2. If there is NO saved quickCreate yet, fall back to required fields so the user
  //      isn't presented with an empty selection on first visit.
  const combined = normalizedBaseKeys.length > 0
    ? Array.from(new Set(normalizedBaseKeys))
    : Array.from(new Set([...normalizedBaseKeys, ...requiredKeys]));
  quickCreateSelected.value = new Set(combined);
  
  // Initialize field order from saved quickCreate array (preserves order).
  // Mirror the same precedence as `combined` above — only seed required fields when
  // there's no saved order to respect.
  if (normalizedBaseKeys.length > 0) {
    quickCreateFieldOrder.value = [...normalizedBaseKeys];
  } else {
    // No saved order, initialize with editFields order
    quickCreateFieldOrder.value = editFields.value
      .filter(f => combined.includes(f.key))
      .map(f => f.key);
  }
  
  // capture snapshot for selected module after all reactive updates settle
  // Use double nextTick to ensure all watchers and computed properties have updated
  nextTick(() => {
    nextTick(() => {
      originalSnapshot.value = getSnapshot();
      quickOriginalSnapshot.value = getQuickSnapshot();
    });
  });
  
  
};

async function refreshPeopleTypesOptionsFromTenant(appKey, normalizedFieldKeys) {
  const fb = appKey === 'HELPDESK' ? ['Customer', 'Agent'] : ['Lead', 'Contact'];
  const dr = fb[0] || '';
  const res = await apiClient.get('/settings/core-modules/people/people-types', {
    params: { appKey }
  });
  const payload = res && typeof res === 'object' && 'data' in res ? res.data : res;
  const parsed = parsePeopleTypesApiPayload(payload, fb, dr);
  const options = parsed.typeDefs.map((d) => ({
    value: d.value,
    label: d.value,
    color: peopleTypeColorToHex(d.color)
  }));
  const next = [...editFields.value];
  let changed = false;
  for (let i = 0; i < next.length; i++) {
    const nk = normalizeFieldKey(next[i]?.key);
    if (normalizedFieldKeys.includes(nk)) {
      next[i] = { ...next[i], options };
      changed = true;
    }
  }
  if (changed) {
    editFields.value = next;
  }
}

watch(peopleTypesCacheVersion, async () => {
  if (selectedModule.value?.key?.toLowerCase() !== 'people') return;
  const salesNormsList = [...PEOPLE_SALES_ROLE_FIELD_KEYS_NORMALIZED];
  const helpdeskNorms = new Set(['helpdesk_role', 'helpdeskrole']);
  const hasSalesField = editFields.value.some((f) => isPeopleSalesRoleFieldKey(f?.key));
  const hasHelpdeskField = editFields.value.some((f) => helpdeskNorms.has(normalizeFieldKey(f?.key)));
  if (!hasSalesField && !hasHelpdeskField) return;
  try {
    if (hasSalesField) {
      await refreshPeopleTypesOptionsFromTenant('SALES', salesNormsList);
    }
    if (hasHelpdeskField) {
      await refreshPeopleTypesOptionsFromTenant('HELPDESK', [...helpdeskNorms]);
    }
  } catch (e) {
    console.warn('[ModulesAndFields] Failed to refresh People Types tab picklist options', e);
  }
});

watch(pipelineSettings, () => {
  if (!pipelineTabEnabled.value) return;
  ensurePipelineSelection();
});

watch(activeTopTab, (tab) => {
  if (tab !== 'pipeline') return;
  if (!pipelineTabEnabled.value) return;
  ensurePipelineSelection();
});


const openCreateModal = () => {
  editingModule.value = null;
  showFormModal.value = true;
};

const closeFormModal = () => {
  showFormModal.value = false;
  editingModule.value = null;
};

const handleModuleSaved = async (savedModule) => {
  closeFormModal();
  await fetchModules({ cache: 'no-store' });
  // Refresh sidebar so new custom module appears in app nav
  if (savedModule?.type === 'custom') {
    try { window.dispatchEvent(new CustomEvent('arivu:core-modules-updated')); } catch (e) {}
  }
  // Find the module from the refreshed list and select it
  const module = modules.value.find(m => m._id === savedModule._id);
  if (module) {
    selectModule(module);
  }
};

const deleteModule = async (mod) => {
  if (!await confirmAction(t('settings.modFieldsConfirmDeleteModule', { name: mod.name }))) return;
  try {
    const data = await apiClient.delete(`/modules/${mod._id}`);
    if (!data.success) return notifications.error(data.message || t('settings.modFieldsDeleteModuleFailed'));
    await fetchModules({ cache: 'no-store' });
    if (modules.value.length) selectModule(modules.value[0]); else selectedModuleId.value = null;
  } catch (e) {
    console.error('Delete module failed', e);
  }
};

const showAddFieldDrawer = ref(false);
const showDeleteFieldConfirm = ref(false);
const addFieldTargetSectionId = ref('');

const addFieldSectionOptions = computed(() => {
  if (!fieldLayout.value?.sections?.length) return [];
  return [...fieldLayout.value.sections]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((section) => ({
      value: section.id,
      label: resolveSectionDisplayLabel(section, t)
    }));
});

const openAddField = (sectionId = '') => {
  addFieldTargetSectionId.value =
    typeof sectionId === 'string' ? sectionId.trim() : '';
  showAddFieldDrawer.value = true;
};

const closeAddFieldDrawer = () => {
  showAddFieldDrawer.value = false;
  addFieldTargetSectionId.value = '';
};

const handleAddFieldFromDrawer = async (field) => {
  const rawCtx = field.context != null && String(field.context).trim() !== '' ? String(field.context).trim().toLowerCase() : 'global';
  const validSectionIds = new Set((fieldLayout.value?.sections || []).map((s) => s.id));
  const requestedSectionId = String(field.sectionId || addFieldTargetSectionId.value || '').trim();
  const sectionId = validSectionIds.has(requestedSectionId)
    ? requestedSectionId
    : getDefaultSectionIdForModule(selectedModule.value?.key || '');
  const newField = {
    ...field,
    options: field.options || [],
    defaultValue: field.defaultValue ?? null,
    index: field.index ?? false,
    order: editFields.value.length,
    owner: 'org',
    context: rawCtx === 'global' ? 'global' : rawCtx,
    sectionId
  };
  if (newField.dataType === 'Email' && (!newField.validations || !newField.validations.length)) {
    newField.validations = getDefaultEmailValidations();
  }
  const newFieldKey = newField.key?.trim() || field.key?.trim();
  editFields.value.push(newField);
  if (fieldLayout.value) {
    const applied = applyFieldLayoutToModuleState(
      selectedModule.value?.key || '',
      editFields.value,
      fieldLayout.value
    );
    fieldLayout.value = applied.layout;
    editFields.value = applied.fields;
  }
  selectedFieldIdx.value = Math.max(0, editFields.value.findIndex((f) => f.key === newFieldKey));
  syncOptionsBuffer();
  fieldKeyManuallyEdited.value.delete(selectedFieldIdx.value);
  closeAddFieldDrawer();
  if (selectedModule.value) {
    await saveModule();
    nextTick(() => selectFieldByKey(newFieldKey));
  }
};

const moveField = (idx, delta) => {
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= editFields.value.length) return;
  const arr = editFields.value;
  const field = arr[idx];
  
  // Prevent moving fixed position fields (e.g., 'name' for forms)
  if (isFixedPositionField(field, selectedModule.value?.key)) {
    return;
  }
  
  // Prevent moving fields to position 0 if there's a fixed position field at the top
  if (newIdx === 0 && selectedModule.value?.key === 'forms') {
    const nameFieldIdx = arr.findIndex(f => f.key?.toLowerCase() === 'name');
    if (nameFieldIdx >= 0 && nameFieldIdx !== idx) {
      // Can't move to position 0 if name field exists
      return;
    }
  }
  
  const [item] = arr.splice(idx, 1);
  arr.splice(newIdx, 0, item);
  arr.forEach((f, i) => f.order = i);
  if (selectedFieldIdx.value === idx) selectedFieldIdx.value = newIdx;
};

const openDeleteFieldConfirm = () => {
  const field = editFields.value[selectedFieldIdx.value];
  const mod = selectedModule.value;
  const owner = field?.owner || 'platform';
  if (owner === 'platform') {
    notifications.error(t('settings.modFieldsErrPlatformFieldDelete'));
    return;
  }
  if (owner === 'app') {
    notifications.error(t('settings.modFieldsErrAppFieldDelete'));
    return;
  }
  if (isSystemField(field)) {
    notifications.error(t('settings.modFieldsErrSystemFieldDelete'));
    return;
  }
  if (isCoreField(field, mod?.key)) {
    notifications.error(t('settings.modFieldsErrCoreFieldDelete'));
    return;
  }
  showDeleteFieldConfirm.value = true;
};

const confirmDeleteField = async () => {
  const idx = selectedFieldIdx.value;
  showDeleteFieldConfirm.value = false;
  removeField(idx);
  if (selectedModule.value) {
    await saveModule();
  }
};

const removeField = (idx) => {
  const field = editFields.value[idx];
  const mod = selectedModule.value;
  
  // Check ownership-based deletion rules
  const owner = field?.owner || 'platform'; // Default to platform if not set
  
  if (owner === 'platform') {
    notifications.error(t('settings.modFieldsErrPlatformFieldDelete'));
    return;
  }
  
  if (owner === 'app') {
    notifications.error(t('settings.modFieldsErrAppFieldDelete'));
    return;
  }
  
  // Prevent deletion of system fields (legacy check)
  if (isSystemField(field)) {
    notifications.error(t('settings.modFieldsErrSystemFieldDelete'));
    return;
  }
  
  // Prevent deletion of core fields (legacy check)
  if (isCoreField(field, mod?.key)) {
    notifications.error(t('settings.modFieldsErrCoreFieldDelete'));
    return;
  }
  
  editFields.value.splice(idx, 1);
  editFields.value.forEach((f, i) => f.order = i);
  if (selectedFieldIdx.value >= editFields.value.length) selectedFieldIdx.value = Math.max(0, editFields.value.length - 1);
  syncOptionsBuffer();
};

const isSaving = ref(false);
const isSavingQuickCreate = ref(false);
const saveModule = async () => {
  const mod = selectedModule.value;
  if (!mod) return;
  if (isSaving.value) return; // Prevent double-click
  
  isSaving.value = true;
  try {
    // Deduplicate fields before saving
    let deduplicatedFields = uniqueFieldsByKey(editFields.value);

    // For system modules, preserve platform-field identity from existing module definition.
    // This prevents accidental key-case drift (e.g., dueDate vs duedate) and accidental
    // omission of protected platform fields from triggering mutation violations.
    if (mod.type === 'system') {
      const existingFields = Array.isArray(mod.fields) ? mod.fields : [];
      const existingByLowerKey = new Map();
      existingFields.forEach((field) => {
        const key = String(field?.key || '').trim();
        if (!key) return;
        existingByLowerKey.set(key.toLowerCase(), field);
      });

      deduplicatedFields = deduplicatedFields.map((field) => {
        const fieldKey = String(field?.key || '').trim();
        if (!fieldKey) return field;
        const existing = existingByLowerKey.get(fieldKey.toLowerCase());
        if (!existing?.key) return field;
        if (existing.key === fieldKey) return field;
        return { ...field, key: existing.key };
      });

      const payloadLowerKeys = new Set(
        deduplicatedFields
          .map((field) => String(field?.key || '').trim().toLowerCase())
          .filter(Boolean)
      );

      // Ensure platform fields are never dropped from payload.
      for (const existing of existingFields) {
        const existingKey = String(existing?.key || '').trim();
        if (!existingKey) continue;
        const lower = existingKey.toLowerCase();
        const owner = existing?.owner || 'platform';
        if (owner === 'platform' && !payloadLowerKeys.has(lower)) {
          deduplicatedFields.push({ ...existing });
          payloadLowerKeys.add(lower);
        }
      }
    }
    if (mod.key === 'tasks') {
      deduplicatedFields = sortTaskFieldConfiguration(deduplicatedFields);
    }

    // Update order after deduplication
    deduplicatedFields.forEach((f, i) => { f.order = i; });
    
    // For forms module, ensure 'name' field is always at top and always visible
    if (mod.key === 'forms') {
      const nameField = deduplicatedFields.find(f => f.key?.toLowerCase() === 'name');
      if (nameField) {
        // Ensure name field is always at position 0
        const nameFieldIdx = deduplicatedFields.indexOf(nameField);
        if (nameFieldIdx > 0) {
          deduplicatedFields.splice(nameFieldIdx, 1);
          deduplicatedFields.unshift(nameField);
        }
        // Ensure visibility is always enabled
        nameField.visibility = { list: true, detail: true };
        nameField.order = 0;
        // Update order for other fields
        deduplicatedFields.forEach((f, i) => {
          if (f.key?.toLowerCase() !== 'name') {
            f.order = i;
          }
        });
      }
    }
    
    // Filter to config-visible fields (metadata-driven: exclude infrastructure)
    const getMeta = (key) => isModuleRegistered(mod.key) ? getFieldMetadataFromRegistry(mod.key, key) : getFallbackMetadataForVisibleInConfig(key);
    const fieldsToSave = filterToVisibleInConfig(deduplicatedFields, getMeta).map(stripLegacyDefaultPhoneValidations);
    editFields.value = fieldsToSave;
    const url = mod.type === 'system' ? `/api/modules/system/${mod.key}` : `/api/modules/${mod._id}`;
    // Get ordered keys from selected fields - these are the actual field keys from editFields
    const orderedKeys = orderedQuickCreate.value.map(f => f.key).filter(key => key);
    // Ensure all keys in quickCreate match actual field keys (normalize any mismatches)
    const normalizedQuickCreate = (quickMode.value === 'simple' ? orderedKeys : Array.from(quickCreateSelected.value))
      .map(key => {
        // Find the actual field to get the correct key
        const field = fieldsToSave.find(f => f.key === key || (f.key && f.key.toLowerCase() === String(key).toLowerCase()));
        return field ? field.key : key;
      })
      .filter(key => {
        // Only include keys that actually exist in fields
        const exists = fieldsToSave.some(f => f.key === key);
        if (!exists) {
          console.warn(`⚠️  Removing invalid key "${key}" from quickCreate - field not found`);
        }
        return exists;
      });
    
    // Ensure filter metadata is included for all fields
    fieldsToSave.forEach(field => {
      // Ensure filterable is explicitly set (default to false if not set)
      if (field.filterable === undefined) {
        field.filterable = false;
      }
      // Keep filterType and filterPriority as-is (can be null/undefined if not filterable)
    });
    
    // Debug: Log filter metadata for People module
    if (mod.key?.toLowerCase() === 'people') {
      const filterableFields = fieldsToSave.filter(f => f.filterable === true);
      console.log('[ModulesAndFields] Saving People module with filterable fields:', filterableFields.map(f => ({
        key: f.key,
        filterable: f.filterable,
        filterType: f.filterType,
        filterPriority: f.filterPriority
      })));
    }
    
    const layoutForSave = applyFieldLayoutToModuleState(
      mod.key,
      fieldsToSave,
      fieldLayout.value
    );
    fieldLayout.value = layoutForSave.layout;
    editFields.value = layoutForSave.fields;
    const payload = {
      fields: layoutForSave.fields,
      fieldLayout: layoutForSave.layout,
      relationships: relationships.value,
      quickCreate: normalizedQuickCreate,
      quickCreateLayout: quickLayout.value,
      name: moduleNameEdit.value,
      enabled: moduleEnabled.value
    };
    if (mod.key === 'deals') {
      payload.pipelineSettings = normalizePipelineSettings(pipelineSettings.value);
    }
    console.log('Saving module with relationships:', {
      relationshipsCount: relationships.value.length,
      relationships: relationships.value
    });
    let data;
    try {
      data = await apiClient.put(url, payload);
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.code === 'FIELD_MUTATION_NOT_ALLOWED' && errData.violations?.length > 0) {
        const violationMessages = errData.violations.map(v => `• ${v.field}: ${v.reason}`).join('\n');
        notifications.error(`${errData.message}\n\n${t('settings.modFieldsErrSaveViolationsSuffix', { violations: violationMessages })}`);
      } else {
        notifications.error(errData?.message || err.message || t('settings.modFieldsErrSaveFailed'));
      }
      return;
    }
    if (!data.success) {
      notifications.error(data.message || t('settings.modFieldsErrSaveFailed'));
      return;
    }
    invalidateTenantSchemaCaches();
    await fetchModules({ cache: 'no-store' });
    // Re-select by key to avoid unstable IDs on system modules
    const updated = modules.value.find(m => m.key === mod.key);
    // preserve current selected field
    const currentFieldKey = editFields.value[selectedFieldIdx.value]?.key || null;
    if (updated) {
      // selectModule will reload relationships from updated module, so call it first
      selectModule(updated, currentFieldKey);
      // Double-check: ensure relationships are loaded from the updated module
      if (updated.relationships && Array.isArray(updated.relationships)) {
        relationships.value = JSON.parse(JSON.stringify(updated.relationships));
        console.log('Relationships restored after save:', relationships.value.length);
      } else {
        console.warn('⚠️  No relationships found in updated module after save');
      }
    }
    // reset snapshot after successful save
    originalSnapshot.value = getSnapshot();
    quickOriginalSnapshot.value = getQuickSnapshot();
    // Notify sidebar and other consumers to refresh (e.g. display name change)
    window.dispatchEvent(new CustomEvent('arivu:core-modules-updated'));
    console.log('Module saved successfully, relationships updated');
  } catch (e) {
    console.error('Save module failed', e);
    notifications.error(t('settings.modFieldsErrSaveFailedWithReason', {
      reason: e.message || t('settings.modFieldsUnknownError')
    }));
  } finally {
    isSaving.value = false;
  }
};

const selectField = (idx) => {
  // Check if we were already dirty before selecting the field
  const wasDirtyBefore = isDirty.value;
  selectedFieldIdx.value = idx;
  syncOptionsBuffer();
  loadFieldSettings(); // Load field-specific settings
  const mod = selectedModule.value;
  if (mod) {
    router.replace({ query: { ...route.query, module: mod.key, field: editFields.value[selectedFieldIdx.value]?.key || '', mode: activeTopTab.value, subtab: activeSubTab.value } });
    try { if (editFields.value[selectedFieldIdx.value]?.key) localStorage.setItem('arivu-modfields-field', editFields.value[selectedFieldIdx.value].key); } catch (e) {}
  }
  
  // Keep the selected field row visible (prevents scroll jump when right panel focuses an input and scrolls the page)
  // Defer so we run after any focus/scroll from the right panel config form
  nextTick(() => {
    setTimeout(() => {
      const el = document.querySelector('.modules-fields-list [data-selected-idx]');
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }, 80);
  });
  
  // If we weren't dirty before selecting the field, update the snapshot after selection
  // This prevents initialization changes from loadFieldSettings() from marking the form as dirty
  if (!wasDirtyBefore) {
    nextTick(() => {
      nextTick(() => {
        originalSnapshot.value = getSnapshot();
      });
    });
  }
};

const currentField = computed(() => editFields.value[selectedFieldIdx.value]);
/** People type / sales_type / helpdesk_role — options synced from Types tab */
const peopleTypesTabFieldInfo = computed(() => getPeopleTypesTabFieldInfo(currentField.value));
const currentFieldTitle = computed(() => formatFieldLabelForDisplay(currentField.value?.label, currentField.value?.key) || 'Field');

const orgCustomFieldIsCoreScope = computed(() => {
  const f = currentField.value;
  if (!f || f.owner !== 'org') return true;
  return (f.context || 'global').toLowerCase() === 'global';
});

const orgCustomAppContextToken = computed({
  get() {
    const f = currentField.value;
    const opts = customFieldAppScopeOptions.value;
    if (!f || f.owner !== 'org') return opts[0]?.value || '';
    const c = (f.context || 'global').toLowerCase();
    if (c === 'global') return opts[0]?.value || '';
    return opts.some((o) => o.value === c) ? c : (opts[0]?.value || c);
  },
  set(v) {
    const f = editFields.value[selectedFieldIdx.value];
    if (f?.owner === 'org' && v) f.context = String(v).toLowerCase();
  }
});

function setOrgCustomFieldScopeCore() {
  const f = editFields.value[selectedFieldIdx.value];
  if (f?.owner === 'org') f.context = 'global';
}

function setOrgCustomFieldScopeApp() {
  const f = editFields.value[selectedFieldIdx.value];
  const opts = customFieldAppScopeOptions.value;
  if (f?.owner !== 'org' || !opts.length) return;
  const cur = (f.context || 'global').toLowerCase();
  if (cur !== 'global' && opts.some((o) => o.value === cur)) return;
  f.context = opts[0].value;
}

// Default value bindings for type-specific inputs
const defaultValueMultiPicklist = computed({
  get() {
    const f = currentField.value;
    if (!f || f.dataType !== 'Multi-Picklist') return [];
    const v = f.defaultValue;
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
      try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed : (v ? v.split(',').map(s => s.trim()).filter(Boolean) : []);
      } catch {
        return v ? v.split(',').map(s => s.trim()).filter(Boolean) : [];
      }
    }
    return [];
  },
  set(val) {
    const f = currentField.value;
    if (f) f.defaultValue = Array.isArray(val) ? val : [];
  }
});

const defaultValueCheckbox = computed({
  get() {
    const f = currentField.value;
    if (!f || f.dataType !== 'Checkbox') return false;
    const v = f.defaultValue;
    if (v === true || v === 'true') return true;
    return false;
  },
  set(val) {
    const f = currentField.value;
    if (f) f.defaultValue = !!val;
  }
});

// Form Type editing (Forms module)
const newFormTypeKey = ref('');
const newFormTypeLabel = ref('');

function handleAddCustomFormType() {
  if (!newFormTypeKey.value || !newFormTypeLabel.value) return;
  
  try {
    const newType = addCustomFormType({
      key: newFormTypeKey.value.toLowerCase().trim(),
      label: newFormTypeLabel.value.trim()
    });
    
    // Set the new type as the current value
    if (currentField.value && currentField.value.key === 'formType') {
      currentField.value.defaultValue = newType.key;
    }
    
    // Clear inputs
    newFormTypeKey.value = '';
    newFormTypeLabel.value = '';
  } catch (error) {
    console.error('[Form Type] Failed to add custom form type:', error);
    notifications.error(`Failed to add form type: ${error.message}`);
  }
}

async function handleRemoveCustomFormType(key) {
  if (!key) return;
  
  // Prevent removing built-in types (safety check)
  // Built-in types: Audit, Survey, Feedback
  if (isBuiltInFormType(key)) {
    notifications.warning('Built-in form types (Audit, Survey, Feedback) cannot be removed.');
    return;
  }
  
  // Additional check: explicitly prevent removal of audit, survey, feedback (case-insensitive)
  const normalizedKey = String(key).toLowerCase();
  const protectedTypes = ['audit', 'survey', 'feedback'];
  if (protectedTypes.includes(normalizedKey)) {
    notifications.warning('Built-in form types (Audit, Survey, Feedback) cannot be removed.');
    return;
  }
  
  // Confirm removal
  if (!await confirmAction(`Are you sure you want to remove the custom form type "${key}"?`)) {
    return;
  }
  
  try {
    const removed = removeCustomFormType(key);
    if (removed) {
      // If the removed type was the current value, reset to empty or first available type
      if (currentField.value && currentField.value.key === 'formType' && currentField.value.defaultValue === key) {
        const availableTypes = getFormTypeDefinitions();
        currentField.value.defaultValue = availableTypes.length > 0 ? availableTypes[0].key : '';
      }
    }
  } catch (error) {
    console.error('[Form Type] Failed to remove custom form type:', error);
    notifications.error(`Failed to remove form type: ${error.message}`);
  }
}

  // DEV-only guard: Ensure any field rendered in the right configuration panel
  // also exists in the left field list (for Forms module)
  // NOTE: This must be after currentField is defined
  if (process.env.NODE_ENV === 'development') {
    watch([() => isFormsModule.value, () => currentField.value?.key, () => activeTopTab.value], () => {
      if (isFormsModule.value && activeTopTab.value === 'fields' && currentField.value?.key) {
        const fieldKey = currentField.value.key;
        const fieldsList = getFieldsForTab('metadataFields'); // Internal key remains metadataFields for backward compatibility
        // Case-insensitive check to handle potential case mismatches
        const fieldInList = fieldsList.some(f => f.key.toLowerCase() === fieldKey.toLowerCase());
        
        // Core system fields (name, createdAt, etc.) must appear in the list
        // Note: formType is a CORE field but NOT a system field, so it's excluded from this check
        const coreSystemFields = ['name', 'createdat', 'updatedat', 'createdby', 'modifiedby'];
        const isCoreSystemField = coreSystemFields.includes(fieldKey.toLowerCase());
        
        if (isCoreSystemField && !fieldInList) {
          console.assert(
            false,
            `[Forms Settings] Core system field "${fieldKey}" is rendered in the right panel but missing from the left field list. All configurable fields must appear in the list.`
          );
        }
        
        // Additional check: formType (core field, not system) must also be in the list
        if (fieldKey.toLowerCase() === 'formtype' && !fieldInList) {
          console.assert(
            false,
            `[Forms Settings] Core field "formType" is rendered in the right panel but missing from the left field list. All configurable fields must appear in the list.`
          );
        }
        
        // Assert: formType must resolve to a registry entry (case-insensitive)
        if (fieldKey.toLowerCase() === 'formtype') {
          const formTypeValue = currentField.value?.defaultValue || currentField.value?.value;
          if (formTypeValue) {
            // Normalize to lowercase for comparison (registry uses lowercase keys)
            const normalizedValue = formTypeValue.toLowerCase();
            const typeDef = getFormTypeDefinition(normalizedValue);
            
            // Legacy values (Custom, Inspection) are deprecated but may exist in database
            const legacyValues = ['custom', 'inspection'];
            const isLegacyValue = legacyValues.includes(normalizedValue);
            
            if (!typeDef && !isLegacyValue) {
              console.warn(
                `[Forms Settings] Form type "${formTypeValue}" does not resolve to a registry entry. See client/src/platform/forms/formTypeRegistry.ts`,
                { formTypeValue, normalizedValue, availableTypes: getFormTypeDefinitions().map(t => t.key) }
              );
            } else if (isLegacyValue) {
              console.info(
                `[Forms Settings] Legacy form type "${formTypeValue}" detected. Please migrate to a supported type (audit, survey, feedback).`,
                { formTypeValue, normalizedValue, availableTypes: getFormTypeDefinitions().map(t => t.key) }
              );
            }
          }
        }
        
        // Assert: formType is never treated as a system field
        if (fieldKey.toLowerCase() === 'formtype') {
          console.assert(
            !isSystemField(currentField.value),
            '[Forms Settings] formType must never be treated as a system field. It is a CORE domain field. See client/src/platform/forms/formTypeRegistry.ts',
            { field: currentField.value }
          );
        }
      }
    });
  }
const otherFields = computed(() => editFields.value.filter((_, i) => i !== selectedFieldIdx.value));

const dependencyControllingFieldOptions = computed(() =>
  otherFields.value.map((f) => ({
    value: f.key,
    label: f.label || f.key,
  }))
);

const dependencyTypeSelectOptions = computed(() => [
  { value: 'visibility', label: t('settings.modFieldsDepVisibility') },
  { value: 'readonly', label: t('settings.modFieldsDepReadonly') },
  { value: 'required', label: t('settings.modFieldsDepRequired') },
  { value: 'picklist', label: t('settings.modFieldsDepPicklistFilter') },
  { value: 'popup', label: t('settings.modFieldsDepPopup') },
  { value: 'label', label: t('settings.modFieldsDepLabelOverride') },
]);

const dependencyLogicSelectOptions = computed(() => [
  { value: 'AND', label: t('settings.modFieldsLogicAnd') },
  { value: 'OR', label: t('settings.modFieldsLogicOr') },
]);

const dependencyOperatorSelectOptions = computed(() => [
  { value: 'equals', label: t('settings.modFieldsOpEquals') },
  { value: 'not_equals', label: t('settings.modFieldsOpNotEquals') },
  { value: 'in', label: t('settings.modFieldsOpIn') },
  { value: 'not_in', label: t('settings.modFieldsOpNotIn') },
  { value: 'exists', label: t('settings.modFieldsOpExists') },
  { value: 'gt', label: t('settings.modFieldsOpGt') },
  { value: 'lt', label: t('settings.modFieldsOpLt') },
  { value: 'gte', label: t('settings.modFieldsOpGte') },
  { value: 'lte', label: t('settings.modFieldsOpLte') },
  { value: 'contains', label: t('settings.modFieldsOpContains') },
]);

const dependencyCheckboxValueOptions = [
  { value: 'true', label: 'true' },
  { value: 'false', label: 'false' },
];

function dependencyPicklistValueOptions(fieldKey) {
  return getDependencyFieldOptions(fieldKey).map((opt) => ({
    value: opt,
    label: opt,
  }));
}

const picklistValueParentFieldOptions = computed(() => {
  const currentKey = currentField.value?.key;
  return editFields.value
    .filter(
      (f) =>
        (f.dataType === 'Picklist' || f.dataType === 'Multi-Picklist') &&
        f.key !== currentKey
    )
    .map((f) => ({
      value: f.key,
      label: f.label || f.key,
    }));
});

// Track if user manually edited field key to prevent auto-generation
const fieldKeyManuallyEdited = ref(new Set());
const isAutoGeneratingFieldKey = ref(false);

// Generate base key from label
const generateFieldBaseKey = (label) => {
  if (!label) return '';
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

// Check if field key exists and generate unique key
const generateUniqueFieldKey = (baseKey, currentFieldIdx) => {
  if (!baseKey) return '';
  
  // Get all existing field keys except the current field
  const existingKeys = editFields.value
    .map((f, idx) => idx !== currentFieldIdx ? f.key?.toLowerCase() : null)
    .filter(Boolean);
  
  let candidateKey = baseKey;
  let counter = 1;
  
  // Check if base key exists
  while (existingKeys.includes(candidateKey)) {
    candidateKey = `${baseKey}-${counter}`;
    counter++;
    // Prevent infinite loop
    if (counter > 1000) break;
  }
  
  return candidateKey;
};

// Auto-generate field key from label
const autoGenerateFieldKey = () => {
  if (!currentField.value) return;
  
  const fieldIdx = selectedFieldIdx.value;
  
  // Skip if key was manually edited or if field is system/core/auto-number
  if (
    fieldKeyManuallyEdited.value.has(fieldIdx) ||
    isSystemField(currentField.value) ||
    isCoreField(currentField.value, selectedModule.value?.key) ||
    currentField.value.dataType === 'Auto-Number' ||
    !currentField.value.label
  ) {
    return;
  }
  
  // Skip for platform-defined fields (in metadata). Editing their label must not change key,
  // or the field gets misclassified (e.g. status -> st) and jumps to System section.
  if (selectedModule.value?.key && isModuleRegistered(selectedModule.value.key)) {
    const meta = getFieldMetadataFromRegistry(selectedModule.value.key, currentField.value.key);
    if (meta) return;
  }
  
  isAutoGeneratingFieldKey.value = true;
  const baseKey = generateFieldBaseKey(currentField.value.label);
  if (baseKey) {
    const uniqueKey = generateUniqueFieldKey(baseKey, fieldIdx);
    currentField.value.key = uniqueKey;
  }
  // Use nextTick to ensure the watch doesn't fire during auto-generation
  setTimeout(() => {
    isAutoGeneratingFieldKey.value = false;
  }, 0);
};

// Key field validation
const keyFieldCount = computed(() => editFields.value.filter(f => f.keyField === true).length);
const canMarkAsKeyField = computed(() => {
  if (!currentField.value?.keyField) {
    return keyFieldCount.value < 10;
  }
  return true;
});

// Initialize options array if it doesn't exist and load settings when field changes
watch(() => currentField.value?.dataType, (newType) => {
  if (!currentField.value) return;
  if (['Picklist', 'Multi-Picklist', 'Radio Button'].includes(newType)) {
    if (!Array.isArray(currentField.value.options)) {
      currentField.value.options = [];
    }
  }
  if (newType === 'Email') {
    const v = currentField.value.validations;
    if (!v || !Array.isArray(v) || v.length === 0) {
      currentField.value.validations = getDefaultEmailValidations();
    }
  }
  if (newType === 'Currency') {
    numberSettings.value.currencyCode = String(
      numberSettings.value.currencyCode || resolveOrgCurrencyCode(authStore.organization)
    ).toUpperCase();
    numberSettings.value.currencySymbol = getCurrencySymbolFromCode(numberSettings.value.currencyCode);
    if (typeof numberSettings.value.decimalPlaces !== 'number') {
      numberSettings.value.decimalPlaces = 2;
    }
  }
  // Load settings from currentField
  loadFieldSettings();
}, { immediate: true });

watch(
  () => numberSettings.value.currencyCode,
  (code) => {
    if (currentField.value?.dataType !== 'Currency') return;
    const normalizedCode = String(code || resolveOrgCurrencyCode(authStore.organization)).toUpperCase();
    if (numberSettings.value.currencyCode !== normalizedCode) {
      numberSettings.value.currencyCode = normalizedCode;
      return;
    }
    numberSettings.value.currencySymbol = getCurrencySymbolFromCode(normalizedCode);
  }
);

// Sync selected field from URL when route.query.field changes (e.g. link click, back/forward).
// Keeps UI in sync with URL so clicking a field or opening a link with field=relatedTo shows the right field.
watch(
  () => [route.query.module, route.query.field, selectedModule.value?.key, activeTopTab.value, editFields.value.length],
  () => {
    const mod = selectedModule.value;
    const queryField = typeof route.query.field === 'string' ? route.query.field.trim() : '';
    if (!mod || activeTopTab.value !== 'fields' || !editFields.value.length) return;
    if (route.query.module !== mod.key) return;
    if (!queryField) return;
    const currentKey = editFields.value[selectedFieldIdx.value]?.key;
    if (normalizeFieldKey(queryField) === normalizeFieldKey(currentKey)) return;
    const idx = getFieldIndex(queryField);
    if (idx >= 0) {
      selectedFieldIdx.value = idx;
      syncOptionsBuffer();
      loadFieldSettings();
    }
  },
  { flush: 'post' }
);

// Also watch for field selection changes
watch(() => selectedFieldIdx.value, () => {
  if (currentField.value) {
    loadFieldSettings();
    // Reset manual edit flag when switching fields
    fieldKeyManuallyEdited.value.delete(selectedFieldIdx.value);
  }
});

// Watch field label to auto-generate key
watch(() => currentField.value?.label, () => {
  if (currentField.value) {
    autoGenerateFieldKey();
  }
});

// Enforce required and visibility for participation state fields
watch(() => currentField.value, (field) => {
  if (!field || !isPeopleModule.value) return;
  
  if (isParticipationStateField(field)) {
    // Force required to true
    if (!field.required) {
      field.required = true;
    }
    
    // Force visibility to true
    if (!field.visibility) {
      field.visibility = { list: true, detail: true };
    } else {
      if (!field.visibility.list) {
        field.visibility.list = true;
      }
      if (!field.visibility.detail) {
        field.visibility.detail = true;
      }
    }
  }
}, { immediate: true, deep: true });

// Watch field key to detect manual edits
watch(() => currentField.value?.key, (newKey, oldKey) => {
  if (!currentField.value || isAutoGeneratingFieldKey.value) return;
  
  const fieldIdx = selectedFieldIdx.value;
  const expectedKey = generateFieldBaseKey(currentField.value.label);
  
  // If user manually edits the key to something different from auto-generated, mark as manually edited
  if (newKey && newKey !== expectedKey && !newKey.startsWith(expectedKey)) {
    fieldKeyManuallyEdited.value.add(fieldIdx);
  } else if (newKey === expectedKey || newKey?.startsWith(expectedKey)) {
    // If it matches the expected pattern, remove from manual edits
    fieldKeyManuallyEdited.value.delete(fieldIdx);
  }
});

// Save settings to currentField
watch([numberSettings, textSettings, dateSettings, formulaSettings, lookupSettings], () => {
  if (!currentField.value) return;
  const field = currentField.value;
  
  if (['Integer', 'Decimal', 'Currency'].includes(field.dataType)) {
    const nextNumberSettings = { ...numberSettings.value };
    if (field.dataType === 'Currency') {
      const currencyCode = String(
        nextNumberSettings.currencyCode || resolveOrgCurrencyCode(authStore.organization)
      ).toUpperCase();
      nextNumberSettings.currencyCode = currencyCode;
      nextNumberSettings.currencySymbol = getCurrencySymbolFromCode(currencyCode);
    } else {
      delete nextNumberSettings.currencyCode;
      delete nextNumberSettings.currencySymbol;
    }
    field.numberSettings = nextNumberSettings;
  }
  if (['Text', 'Text-Area'].includes(field.dataType)) {
    field.textSettings = { ...textSettings.value };
  }
  if (['Date', 'Date-Time'].includes(field.dataType)) {
    field.dateSettings = { ...dateSettings.value };
  }
  if (field.dataType === 'Formula') {
    field.formulaSettings = { ...formulaSettings.value };
  }
  if (field.dataType === 'Lookup (Relationship)') {
    field.lookupSettings = { ...lookupSettings.value };
  }
}, { deep: true });
const dependencyValuesBuffer = ref({});
const dependencyConditionBuffers = ref({});
const dependencySearchTerms = ref({}); // Store search terms for dependency condition values
const dependencyDropdownOpen = ref({}); // Track which dropdowns are open
const dependencyMappingBuffers = ref({});
const dependencyOptionsBuffer = ref({});
const picklistOptionsBuffers = ref({});
const advancedValueBuffers = ref({});
const advancedOptionsBuffers = ref({});

function closeAllDependencyDropdowns() {
  Object.keys(dependencyDropdownOpen.value).forEach((key) => {
    delete dependencyDropdownOpen.value[key];
  });
}

function handleDependencyDropdownOutsidePointerDown(e) {
  const target = e?.target;
  if (!(target instanceof Element)) {
    closeAllDependencyDropdowns();
    return;
  }
  if (!target.closest('.dependency-dropdown-container')) {
    closeAllDependencyDropdowns();
  }
}

function syncOptionsBuffer() {
  const f = currentField.value;
  if (!f?.options || !Array.isArray(f.options)) {
    optionsBuffer.value = '';
    return;
  }
  // Convert options to comma-separated string (extract values if objects)
  const values = f.options.map(opt => typeof opt === 'string' ? opt : opt.value || '');
  optionsBuffer.value = values.join(', ');
}

watch(optionsBuffer, (v) => {
  if (!currentField.value) return;
  
  const arr = v.split(',').map(s => s.trim()).filter(Boolean);
  
  const moduleKey = selectedModule.value?.key || '';
  const fieldKey = currentField.value?.key;
  if (Array.isArray(currentField.value.options) && currentField.value.options.length > 0) {
    const existingOptions = currentField.value.options;
    const merged = arr.map((value) => {
      const existing = existingOptions.find((opt) => {
        const existingValue = typeof opt === 'string' ? opt : opt.value;
        return existingValue === value;
      });
      return existing ?? value;
    });
    currentField.value.options = backfillPicklistOptionColors(merged, fieldKey, moduleKey);
  } else {
    currentField.value.options = backfillPicklistOptionColors(
      arr.map((value) => ({ value })),
      fieldKey,
      moduleKey
    );
  }
});

watch(currentField, (field) => {
  newOptionColor.value = nextPicklistOptionColor(field?.options);
}, { immediate: true });

const clearSelection = () => {
  selectedModuleId.value = null;
  originalSnapshot.value = '';
  quickOriginalSnapshot.value = '';
  statusTypesOriginalSnapshot.value = '';
  itemStatusTypesOriginalSnapshot.value = '';
  eventRolesRulesOriginalSnapshot.value = '';
  eventStatusOriginalSnapshot.value = '';
  pipelineSettings.value = [];
  selectedPipelineKey.value = '';
  const q = { ...route.query };
  delete q.module;
  delete q.field;
  delete q.mode;
  delete q.subtab;
  delete q.quickMode;
  router.replace({ query: q });
  try { localStorage.removeItem('arivu-modfields-module'); localStorage.removeItem('arivu-modfields-field'); } catch (e) {}
};

function addRelationship() {
  relationships.value.push({ name: '', type: 'many_to_one', isLookup: true, targetModuleKey: '', localField: '', foreignField: '_id', inverseName: '', inverseField: '', required: false, unique: false, index: true, cascadeDelete: false, label: '' });
}
function openRelationshipDrawer(editIndex = null) {
  relationshipEditIndex.value = editIndex;
  relationshipDrawerOpen.value = true;
}
function closeRelationshipDrawer() {
  relationshipDrawerOpen.value = false;
  relationshipEditIndex.value = null;
}
function onRelationshipSave({ relationship, editIndex }) {
  if (editIndex === null) {
    relationships.value.push(relationship);
  } else {
    relationships.value[editIndex] = relationship;
  }
  closeRelationshipDrawer();
}
async function removeRelationship(idx) {
  if (await confirmAction('Are you sure you want to remove this relationship?')) {
    relationships.value.splice(idx, 1);
  }
}
function getRelationshipTypeBadge(rel) {
  const r = rel && typeof rel === 'object' ? rel : { type: rel, isLookup: false };
  if (r.type === 'lookup' || (r.type === 'many_to_one' && r.isLookup === true)) return 'Lookup';
  const badges = { one_to_one: '1:1', one_to_many: '1:N', many_to_one: 'N:1', many_to_many: 'N:N' };
  return badges[r.type] || r.type || '';
}

// Helper function to get field rules (excluding picklistValue rules)
function getFieldRules() {
  if (!currentField.value || !currentField.value.dependencies) return [];
  return currentField.value.dependencies.filter(d => d.type !== 'picklistValue');
}

// Picklist Value Rules Functions (for field-level dependencies)
function addPicklistValueRule() {
  if (!currentField.value.dependencies) {
    currentField.value.dependencies = [];
  }
  currentField.value.dependencies.push({
    type: 'picklistValue',
    name: 'Picklist Value Rule',
    parentFieldKey: '',
    mappings: []
  });
}

// Helper to get picklist value rules
function getPicklistValueRules() {
  if (!currentField.value || !currentField.value.dependencies) return [];
  return currentField.value.dependencies.filter(d => d.type === 'picklistValue');
}

// Helper to get actual index of a rule in the full dependencies array
function getActualRuleIndex(filteredIdx) {
  const picklistValueRules = getPicklistValueRules();
  if (filteredIdx >= picklistValueRules.length) return -1;
  const rule = picklistValueRules[filteredIdx];
  return currentField.value.dependencies.indexOf(rule);
}

function removePicklistValueRule(ruleIdx) {
  const actualIdx = getActualRuleIndex(ruleIdx);
  if (actualIdx >= 0) {
    currentField.value.dependencies.splice(actualIdx, 1);
    if (currentField.value.dependencies.length === 0) {
      delete currentField.value.dependencies;
    }
  }
}

function addPicklistValueMapping(ruleIdx) {
  const picklistValueRules = getPicklistValueRules();
  if (ruleIdx >= picklistValueRules.length) return;
  
  const rule = picklistValueRules[ruleIdx];
  if (!rule.mappings) {
    rule.mappings = [];
  }
  rule.mappings.push({
    parentValue: '',
    allowedOptions: []
  });
}

function removePicklistValueMapping(ruleIdx, mapIdx) {
  const picklistValueRules = getPicklistValueRules();
  if (ruleIdx >= picklistValueRules.length) return;
  
  const rule = picklistValueRules[ruleIdx];
  if (rule.mappings && mapIdx < rule.mappings.length) {
    rule.mappings.splice(mapIdx, 1);
  }
}

function getPicklistFieldOptions(fieldKey) {
  const field = editFields.value.find(f => f.key === fieldKey);
  if (!field || !field.options) return [];
  return field.options.map(opt => typeof opt === 'object' ? (opt.value || opt.label || opt) : opt);
}

function isMappingOptionSelected(mapping, option) {
  if (!mapping.allowedOptions) return false;
  const optValue = normalizePicklistOption(option);
  return mapping.allowedOptions.includes(optValue);
}

function toggleMappingOption(mapping, option) {
  if (!mapping.allowedOptions) {
    mapping.allowedOptions = [];
  }
  const optValue = normalizePicklistOption(option);
  const idx = mapping.allowedOptions.indexOf(optValue);
  if (idx >= 0) {
    mapping.allowedOptions.splice(idx, 1);
  } else {
    mapping.allowedOptions.push(optValue);
  }
}

// Helper functions for Relationships tab (Lookup is UI mode of many_to_one; support legacy type "lookup")
function getRelationshipTypeLabel(relOrType) {
  const r = relOrType && typeof relOrType === 'object' ? relOrType : { type: relOrType, isLookup: false };
  if (r.type === 'lookup' || (r.type === 'many_to_one' && r.isLookup === true)) return 'Lookup';
  const labels = {
    'one_to_one': 'One-to-One (1:1)',
    'one_to_many': 'One-to-Many (1:N)',
    'many_to_one': 'Many-to-One (N:1)',
    'many_to_many': 'Many-to-Many (N:N)'
  };
  return labels[r.type] || r.type || '';
}

function getModuleName(key) {
  if (!key || !modules.value) return '';
  const module = modules.value.find(m => m.key === key);
  return module ? module.name : key;
}


// Auto-select required fields in Quick Create.
// When a field is marked as required in the field configuration, it is
// automatically added to the Quick Create selection (and order) and cannot be
// unchecked until `required` is turned off. Pairs with the existing "cannot
// uncheck required" guard in toggleQuickCreate() and the `:disabled="f.required"`
// checkbox bindings in the Quick Create palette.
//
// We watch the eligible (`quickCreateAvailableFields`) required keys AND the
// current selection, because module-load paths replace the entire
// `quickCreateSelected` Set with the persisted config — refiring on selection
// changes ensures required fields are re-injected after every reset.
watch(
  [
    () => quickCreateAvailableFields.value
      .filter(f => f && f.key && f.required)
      .map(f => f.key)
      .join('|'),
    () => Array.from(quickCreateSelected.value || []).join('|')
  ],
  ([requiredKeysStr]) => {
    if (!requiredKeysStr) return;
    const requiredKeys = requiredKeysStr.split('|');
    for (const key of requiredKeys) {
      if (!key) continue;
      if (!quickCreateSelected.value.has(key)) {
        quickCreateSelected.value.add(key);
      }
      if (!quickCreateFieldOrder.value.includes(key)) {
        quickCreateFieldOrder.value.push(key);
      }
    }
  },
  { immediate: true }
);

function toggleQuickCreate(key, checked) {
  const s = quickCreateSelected.value;
  
  // PLATFORM-LEVEL CANONICAL DEFAULT: Organizations Quick Create
  // Name field MUST always be present, required, and non-removable
  if (isOrganizationsModule.value && key?.toLowerCase() === 'name' && !checked) {
    // Prevent unchecking name field for organizations
    s.add(key);
    return;
  }
  
  // ARCHITECTURE NOTE: Tasks Settings configure structure only. Title field MUST always be present, required, and non-removable.
  // See: docs/architecture/task-settings.md Section 3.5
  if (isTasksModule.value && key?.toLowerCase() === 'title' && !checked) {
    // Prevent unchecking title field for tasks
    s.add(key);
    return;
  }
  
  // ARCHITECTURE NOTE: Events Settings configure structure, constraints, and eligibility only.
  // eventName field MUST always be present, required, and non-removable.
  // Quick Create is for simple scheduling, not audit workflows.
  // See: docs/architecture/event-settings.md Section 7
  if (isEventsModule.value && key?.toLowerCase() === 'eventname' && !checked) {
    // Prevent unchecking eventName field for events
    s.add(key);
    return;
  }
  
  // prevent deselecting required fields
  const field = editFields.value.find(f => f.key === key);
  if (!checked && field && field.required) {
    s.add(key);
    return;
  }
  if (checked) {
    s.add(key);
    // Add to order if not already present
    if (!quickCreateFieldOrder.value.includes(key)) {
      // For organizations, ensure name is always first
      if (isOrganizationsModule.value && key?.toLowerCase() === 'name') {
        quickCreateFieldOrder.value.unshift(key);
      } else if (isTasksModule.value && key?.toLowerCase() === 'title') {
        // ARCHITECTURE NOTE: Tasks Settings configure structure only. Ensure title is always first.
        // See: docs/architecture/task-settings.md Section 3.5
        quickCreateFieldOrder.value.unshift(key);
      } else if (isEventsModule.value && key?.toLowerCase() === 'eventname') {
        // ARCHITECTURE NOTE: Events Settings configure structure, constraints, and eligibility only.
        // Ensure eventName is always first. Quick Create is for simple scheduling, not audit workflows.
        // See: docs/architecture/event-settings.md Section 7
        quickCreateFieldOrder.value.unshift(key);
      } else {
        quickCreateFieldOrder.value.push(key);
      }
    }
  } else {
    s.delete(key);
    // Remove from order
    quickCreateFieldOrder.value = quickCreateFieldOrder.value.filter(k => k !== key);
  }
}

function toggleQuickRow(field) {
  if (!field || !field.key) return; // cannot toggle required
  const has = quickCreateSelected.value.has(field.key);
  toggleQuickCreate(field.key, !has);
}
function selectAllQuickCreate() {
  quickCreateSelected.value = new Set(editFields.value.map(f => f.key));
  // Initialize order with all field keys
  quickCreateFieldOrder.value = editFields.value.map(f => f.key).filter(Boolean);
}

// Quick Create drag-and-drop handlers
function onQuickCreateDragStart(idx) {
  quickCreateDragStartIdx.value = idx;
}

function onQuickCreateDragOver(idx) {
  quickCreateDragOverIdx.value = idx;
}

function onQuickCreateDrop(idx) {
  const from = quickCreateDragStartIdx.value;
  const to = idx;
  quickCreateDragStartIdx.value = null;
  quickCreateDragOverIdx.value = null;
  
  if (from === null || to === null || from === to) return;
  
  // Get the current ordered keys
  const currentOrder = orderedQuickCreate.value.map(f => f.key);
  
  // PLATFORM-LEVEL CANONICAL DEFAULT: Organizations Quick Create
  // Name field must always be first - prevent moving it or moving other fields before it
  if (isOrganizationsModule.value) {
    const nameKey = currentOrder.find(k => k?.toLowerCase() === 'name');
    if (nameKey) {
      // If trying to move name from position 0, prevent it
      if (from === 0 && nameKey === currentOrder[0]) {
        return;
      }
      // If trying to move something to position 0 when name exists, move to position 1 instead
      if (to === 0 && nameKey !== currentOrder[from]) {
        const [moved] = currentOrder.splice(from, 1);
        // Ensure name stays at position 0
        if (currentOrder[0]?.toLowerCase() !== 'name') {
          const nameIdx = currentOrder.indexOf(nameKey);
          if (nameIdx > 0) {
            currentOrder.splice(nameIdx, 1);
            currentOrder.unshift(nameKey);
          }
        }
        currentOrder.splice(1, 0, moved);
        quickCreateFieldOrder.value = currentOrder;
        return;
      }
    }
  }
  
  // ARCHITECTURE NOTE: Tasks Settings configure structure only. Title field must always be first.
  // See: docs/architecture/task-settings.md Section 3.5
  if (isTasksModule.value) {
    const titleKey = currentOrder.find(k => k?.toLowerCase() === 'title');
    if (titleKey) {
      // If trying to move title from position 0, prevent it
      if (from === 0 && titleKey === currentOrder[0]) {
        return;
      }
      // If trying to move something to position 0 when title exists, move to position 1 instead
      if (to === 0 && titleKey !== currentOrder[from]) {
        const [moved] = currentOrder.splice(from, 1);
        // Ensure title stays at position 0
        if (currentOrder[0]?.toLowerCase() !== 'title') {
          const titleIdx = currentOrder.indexOf(titleKey);
          if (titleIdx > 0) {
            currentOrder.splice(titleIdx, 1);
            currentOrder.unshift(titleKey);
          }
        }
        currentOrder.splice(1, 0, moved);
        quickCreateFieldOrder.value = currentOrder;
        return;
      }
    }
  }
  
  // ARCHITECTURE NOTE: Events Settings configure structure, constraints, and eligibility only.
  // eventName field must always be first. Quick Create is for simple scheduling, not audit workflows.
  // See: docs/architecture/event-settings.md Section 7
  if (isEventsModule.value) {
    const eventNameKey = currentOrder.find(k => k?.toLowerCase() === 'eventname');
    if (eventNameKey) {
      // If trying to move eventName from position 0, prevent it
      if (from === 0 && eventNameKey === currentOrder[0]) {
        return;
      }
      // If trying to move something to position 0 when eventName exists, move to position 1 instead
      if (to === 0 && eventNameKey !== currentOrder[from]) {
        const [moved] = currentOrder.splice(from, 1);
        // Ensure eventName stays at position 0
        if (currentOrder[0]?.toLowerCase() !== 'eventname') {
          const eventNameIdx = currentOrder.indexOf(eventNameKey);
          if (eventNameIdx > 0) {
            currentOrder.splice(eventNameIdx, 1);
            currentOrder.unshift(eventNameKey);
          }
        }
        currentOrder.splice(1, 0, moved);
        quickCreateFieldOrder.value = currentOrder;
        return;
      }
    }
  }
  
  // Move the item
  const [moved] = currentOrder.splice(from, 1);
  currentOrder.splice(to, 0, moved);
  
  // Update the custom order
  quickCreateFieldOrder.value = currentOrder;
}
const orderedQuickCreate = computed(() => {
  // For People module, filter to only core identity fields
  // For Organizations module, use quickCreateAvailableFields (core business fields only)
  // For Tasks module, use quickCreateAvailableFields (core task fields only)
  // For Events module, use quickCreateAvailableFields (core event fields only)
  const fieldsToProcess = isPeopleModule.value || isOrganizationsModule.value || isTasksModule.value || isEventsModule.value
    ? quickCreateAvailableFields.value 
    : editFields.value;
  
  // If we have a custom order, use it; otherwise fall back to editFields order
  if (quickCreateFieldOrder.value.length > 0) {
    const orderMap = new Map();
    quickCreateFieldOrder.value.forEach((key, idx) => {
      orderMap.set(key, idx);
    });
    const ordered = [];
    const seen = new Set();
    
    // PLATFORM-LEVEL CANONICAL DEFAULT: Organizations Quick Create
    // Ensure name is always first
    if (isOrganizationsModule.value) {
      const nameKey = quickCreateFieldOrder.value.find(k => k?.toLowerCase() === 'name');
      if (nameKey && quickCreateSelected.value.has(nameKey)) {
        const nameField = fieldsToProcess.find(x => x.key === nameKey);
        if (nameField) {
          ordered.push(nameField);
          seen.add(nameKey);
        }
      }
    }
    
    // ARCHITECTURE NOTE: Tasks Settings configure structure only. Ensure title is always first.
    // See: docs/architecture/task-settings.md Section 3.5
    if (isTasksModule.value) {
      const titleKey = quickCreateFieldOrder.value.find(k => k?.toLowerCase() === 'title');
      if (titleKey && quickCreateSelected.value.has(titleKey)) {
        const titleField = fieldsToProcess.find(x => x.key === titleKey);
        if (titleField) {
          ordered.push(titleField);
          seen.add(titleKey);
        }
      }
    }
    
    // ARCHITECTURE NOTE: Events Settings configure structure, constraints, and eligibility only.
    // Ensure eventName is always first. Quick Create is for simple scheduling, not audit workflows.
    // See: docs/architecture/event-settings.md Section 7
    if (isEventsModule.value) {
      const eventNameKey = quickCreateFieldOrder.value.find(k => k?.toLowerCase() === 'eventname');
      if (eventNameKey && quickCreateSelected.value.has(eventNameKey)) {
        const eventNameField = fieldsToProcess.find(x => x.key === eventNameKey);
        if (eventNameField) {
          ordered.push(eventNameField);
          seen.add(eventNameKey);
        }
      }
    }
    
    // First, add fields in custom order (filtered for People/Organizations/Tasks/Events module)
    for (const key of quickCreateFieldOrder.value) {
      // Skip name if already added for organizations
      if (isOrganizationsModule.value && key?.toLowerCase() === 'name' && seen.has(key)) continue;
      // Skip title if already added for tasks
      if (isTasksModule.value && key?.toLowerCase() === 'title' && seen.has(key)) continue;
      // Skip eventName if already added for events
      if (isEventsModule.value && key?.toLowerCase() === 'eventname' && seen.has(key)) continue;
      if (!quickCreateSelected.value.has(key)) continue;
      if (seen.has(key)) continue;
      const f = fieldsToProcess.find(x => x.key === key);
      if (f) {
        ordered.push(f);
        seen.add(key);
      }
    }
    
    // Then add any newly selected fields that aren't in the order yet (filtered for People/Organizations module)
    for (const f of fieldsToProcess) {
      const k = f.key;
      if (!k) continue;
      if (!quickCreateSelected.value.has(k)) continue;
      if (seen.has(k)) continue;
      ordered.push(f);
      seen.add(k);
    }
    
    return ordered;
  }
  
  // Fallback to original behavior: order by editFields (filtered for People/Organizations/Tasks/Events module)
  const seen = new Set();
  const out = [];
  
  // PLATFORM-LEVEL CANONICAL DEFAULT: Organizations Quick Create
  // Ensure name is always first
  if (isOrganizationsModule.value) {
    const nameField = fieldsToProcess.find(f => f.key?.toLowerCase() === 'name');
    if (nameField && quickCreateSelected.value.has(nameField.key)) {
      out.push(nameField);
      seen.add(nameField.key);
    }
  }
  
  // ARCHITECTURE NOTE: Tasks Settings configure structure only. Ensure title is always first.
  // See: docs/architecture/task-settings.md Section 3.5
  if (isTasksModule.value) {
    const titleField = fieldsToProcess.find(f => f.key?.toLowerCase() === 'title');
    if (titleField && quickCreateSelected.value.has(titleField.key)) {
      out.push(titleField);
      seen.add(titleField.key);
    }
  }
  
  // ARCHITECTURE NOTE: Events Settings configure structure, constraints, and eligibility only.
  // Ensure eventName is always first. Quick Create is for simple scheduling, not audit workflows.
  // See: docs/architecture/event-settings.md Section 7
  if (isEventsModule.value) {
    const eventNameField = fieldsToProcess.find(f => f.key?.toLowerCase() === 'eventname');
    if (eventNameField && quickCreateSelected.value.has(eventNameField.key)) {
      out.push(eventNameField);
      seen.add(eventNameField.key);
    }
  }
  
  for (const f of fieldsToProcess) {
    const k = f.key;
    if (!k) continue;
    if (!quickCreateSelected.value.has(k)) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
});

function addRow() {
  quickLayout.value.rows.push({ cols: [] });
}
function removeRow(ri) {
  quickLayout.value.rows.splice(ri, 1);
  rebuildQuickCreateFromLayout();
}
function addCol(ri) {
  quickLayout.value.rows[ri].cols.push({ span: 12, fieldKey: '', widget: 'input', props: {} });
}
function removeCol(ri, ci) {
  quickLayout.value.rows[ri].cols.splice(ci, 1);
  rebuildQuickCreateFromLayout();
}

function displayFieldLabel(key) {
  const f = editFields.value.find(x => x.key === key);
  return f ? (f.label || f.key) : '';
}
function openPreview() { showPreview.value = true; }
function closePreview() { showPreview.value = false; }

function getPreviewPlaceholder(col) {
  const key = col?.fieldKey || '';
  const f = editFields.value.find(x => x.key === key);
  const fieldPh = f && typeof f.placeholder === 'string' ? f.placeholder : '';
  const colPh = (col && col.props && typeof col.props.placeholder === 'string') ? col.props.placeholder : '';
  return colPh || fieldPh || 'Placeholder';
}

function onFieldDragStart(key) {
  try { event.dataTransfer.setData('text/plain', key); } catch (e) { /* no-op */ }
}
function onColumnDrop(ri, ci, event) {
  const key = event.dataTransfer.getData('text/plain');
  if (!key) return;
  // prevent duplicates
  if (isFieldUsedInLayout(key)) return;
  quickLayout.value.rows[ri].cols[ci].fieldKey = key;
  // sync quickCreateSelected from layout
  rebuildQuickCreateFromLayout();
}
function clearColumnField(ri, ci) {
  quickLayout.value.rows[ri].cols[ci].fieldKey = '';
  rebuildQuickCreateFromLayout();
}
function isFieldUsedInLayout(key) {
  for (const row of quickLayout.value.rows) {
    for (const col of row.cols) {
      if (col.fieldKey === key) return true;
    }
  }
  return false;
}
function rebuildQuickCreateFromLayout() {
  const keys = [];
  for (const row of quickLayout.value.rows) {
    for (const col of row.cols) {
      if (col.fieldKey) keys.push(col.fieldKey);
    }
  }
  quickCreateSelected.value = new Set(keys);
}

function extractLayoutKeys(layout) {
  try {
    const keys = [];
    const rows = Array.isArray(layout?.rows) ? layout.rows : [];
    for (const row of rows) {
      const cols = Array.isArray(row?.cols) ? row.cols : [];
      for (const col of cols) {
        if (col && col.fieldKey) keys.push(col.fieldKey);
      }
    }
    return keys;
  } catch (e) {
    return [];
  }
}

function addValidation() {
  if (currentField.value?.dataType === 'Phone') return;
  if (!currentField.value.validations) currentField.value.validations = [];
  currentField.value.validations.push({ name: '', type: 'regex', pattern: '', minLength: undefined, maxLength: undefined, min: undefined, max: undefined, allowedValues: [], message: '' });
}
function removeValidation(idx) {
  currentField.value.validations.splice(idx, 1);
}

function applyAllowedValues(idx) {
  const raw = allowedValuesBuffers.value[idx] || '';
  const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (currentField.value.validations[idx]) currentField.value.validations[idx].allowedValues = arr;
}

function addPreset(kind) {
  const presets = {
    email: { pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', message: 'Invalid email' },
    url: { pattern: '^(https?:\\/\\/)?([\\w.-]+)\\.([a-z.]{2,6})([\\/\\w .-]*)*\\/?$', message: 'Invalid URL' },
    integer: { pattern: '^-?\\d+$', message: 'Must be an integer' },
    positive: { pattern: '^[+]?([1-9]\\d*)$', message: 'Must be a positive number' },
    currency: { pattern: '^(?:[A-Za-z]{3}\\s*)?(?:[$€£¥₹])?(?=.)\\d{1,3}(,?\\d{3})*(\\.\\d{2})?$', message: 'Invalid currency format' },
    alnum: { pattern: '^[A-Za-z0-9]+$', message: 'Only letters and numbers allowed' },
    slug: { pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', message: 'Invalid slug' },
    uuid: { pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$', message: 'Invalid UUID' },
    zipcode: { pattern: '^[0-9]{5}(?:-[0-9]{4})?$', message: 'Invalid ZIP Code' }
  };
  addValidation();
  const last = currentField.value.validations.length - 1;
  currentField.value.validations[last].type = kind === 'email' ? 'email' : 'regex';
  Object.assign(currentField.value.validations[last], presets[kind] || {});
}

// Helper function to get field type for dependency field selection
function getDependencyFieldType(fieldKey) {
  if (!fieldKey) return '';
  const field = editFields.value.find(f => f.key === fieldKey);
  return field?.dataType || '';
}

// Helper function to normalize picklist option (handle both strings and objects)
function normalizePicklistOption(option) {
  if (typeof option === 'string') return option;
  if (typeof option === 'object' && option !== null) {
    return option.value || option.label || String(option);
  }
  return String(option);
}

// Helper function to get picklist option value for comparison
function getPicklistOptionValue(option) {
  if (typeof option === 'string') return option;
  if (typeof option === 'object' && option !== null) {
    return option.value || option.label || String(option);
  }
  return String(option);
}

// Helper function to get picklist options for a field (returns normalized values)
function getDependencyFieldOptions(fieldKey) {
  if (!fieldKey) return [];
  const field = editFields.value.find(f => f.key === fieldKey);
  if (!field?.options) return [];
  return field.options.map(opt => normalizePicklistOption(opt));
}

// Helper function to get picklist options with their full objects
function getPicklistOptions(field) {
  if (!field?.options) return [];
  return field.options;
}

// removed addSelectedPreset (preset picker removed)
function addDependency() {
  const fieldIdx = selectedFieldIdx.value;
  if (fieldIdx < 0 || fieldIdx >= editFields.value.length) return;
  
  const field = editFields.value[fieldIdx];
  if (!field) return;
  
  // Ensure dependencies array exists on the actual field object
  // Directly modify the field in editFields to ensure reactivity
  if (!field.dependencies) {
    // Vue 3 reactivity: directly assign to the reactive object
    field.dependencies = [];
  }
  
  // Create unified dependency structure with type, supporting backward compatibility
  const newDependency = { 
    name: '',  // Dependency name
    type: 'visibility',  // default type
    fieldKey: '', 
    operator: 'equals', 
    value: '', 
    logic: 'AND',
    conditions: [],
    mappings: [],
    allowedOptions: []  // For picklist filter - stores which options to show
  };
  
  // Add the dependency to the array - Vue 3 reactivity will track this
  field.dependencies.push(newDependency);
}
function removeDependency(idx) {
  currentField.value.dependencies.splice(idx, 1);
  delete dependencyValuesBuffer.value[idx];
  // Clean up condition buffers
  Object.keys(dependencyConditionBuffers.value).forEach(key => {
    if (key.startsWith(idx + '-')) delete dependencyConditionBuffers.value[key];
  });
  // Clean up mapping buffers
  Object.keys(dependencyMappingBuffers.value).forEach(key => {
    if (key.startsWith(idx + '-')) delete dependencyMappingBuffers.value[key];
  });
  delete dependencyOptionsBuffer.value[idx];
}
function applyDependencyValues(idx) {
  const raw = dependencyValuesBuffer.value[idx] || '';
  const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
  const dep = currentField.value.dependencies[idx];
  if (dep) {
    // Support both old and new structure
    if (dep.conditions && dep.conditions.length > 0) {
      // If using conditions array, this shouldn't be called
      dep.value = arr;
    } else {
      dep.value = arr;
    }
  }
}
// Add condition to a dependency
// Get conditions for a dependency (handles both old and new format)
// IMPORTANT: This ensures conditions array exists and converts old format if needed
function getDependencyConditions(dep) {
  if (!dep) return [];
  // Initialize conditions array if it doesn't exist
  if (!dep.conditions) dep.conditions = [];
  
  // If simple dependency format exists (fieldKey), migrate it to conditions array
  if (dep.fieldKey && dep.conditions.length === 0) {
    dep.conditions.push({
      fieldKey: dep.fieldKey,
      operator: dep.operator || 'equals',
      value: dep.value || ''
    });
    // Clear old fields after migration
    dep.fieldKey = '';
    dep.operator = 'equals';
    dep.value = '';
  }
  
  return dep.conditions;
}

// Get condition count for a dependency
function getConditionCount(dep) {
  if (!dep) return 0;
  // Check conditions array
  if (dep.conditions && Array.isArray(dep.conditions)) {
    return dep.conditions.length;
  }
  // Check simple format
  if (dep.fieldKey) {
    return 1;
  }
  return 0;
}

function addDependencyCondition(di) {
  const dep = currentField.value.dependencies[di];
  if (!dep) return;
  if (!dep.conditions) dep.conditions = [];
  // Convert simple dependency to conditions array if needed
  if (!dep.conditions.length && dep.fieldKey) {
    dep.conditions.push({
      fieldKey: dep.fieldKey,
      operator: dep.operator || 'equals',
      value: dep.value || ''
    });
    // Clear old fields
    dep.fieldKey = '';
    dep.operator = '';
    dep.value = '';
  }
  dep.conditions.push({ fieldKey: '', operator: 'equals', value: '' });
}
// Remove condition from a dependency
function removeDependencyCondition(di, ci) {
  const dep = currentField.value.dependencies[di];
  if (!dep || !dep.conditions) return;
  dep.conditions.splice(ci, 1);
  delete dependencyConditionBuffers.value[di + '-' + ci];
  delete dependencySearchTerms.value[`${di}-${ci}`];
  delete dependencyDropdownOpen.value[`${di}-${ci}`];
}
// Apply condition value from buffer
function applyDependencyConditionValue(di, ci) {
  const key = di + '-' + ci;
  const val = dependencyConditionBuffers.value[key];
  const dep = currentField.value.dependencies?.[di];
  if (dep && dep.conditions?.[ci]) {
    const raw = val || '';
    const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
    dep.conditions[ci].value = arr;
  }
}

// Check if a value is selected in a dependency condition (for multi-select)
function isDependencyValueSelected(di, ci, value) {
  const dep = currentField.value.dependencies?.[di];
  if (!dep || !dep.conditions?.[ci]) return false;
  const condition = dep.conditions[ci];
  if (!condition.value) return false;
  // Handle both array and string values
  if (Array.isArray(condition.value)) {
    return condition.value.includes(value);
  }
  return condition.value === value;
}

// Handle operator change - initialize value as array for 'in' and 'not_in' operators
function onDependencyOperatorChange(di, ci) {
  const dep = currentField.value.dependencies?.[di];
  if (!dep || !dep.conditions?.[ci]) return;
  const condition = dep.conditions[ci];
  
  // If operator is 'in' or 'not_in', ensure value is an array
  if (condition.operator === 'in' || condition.operator === 'not_in') {
    if (!Array.isArray(condition.value)) {
      // Convert existing value to array if it's not already
      condition.value = condition.value ? [condition.value] : [];
    }
  } else {
    // For other operators, convert array to single value if needed
    if (Array.isArray(condition.value)) {
      condition.value = condition.value.length > 0 ? condition.value[0] : '';
    }
  }
}

// Toggle a value in a dependency condition (for multi-select with 'in' or 'not_in' operators)
function toggleDependencyValue(di, ci, value) {
  const dep = currentField.value.dependencies?.[di];
  if (!dep || !dep.conditions?.[ci]) return;
  const condition = dep.conditions[ci];
  
  // Ensure value is an array for 'in' and 'not_in' operators
  if (condition.operator === 'in' || condition.operator === 'not_in') {
    if (!Array.isArray(condition.value)) {
      // Convert existing value to array if it's not already
      condition.value = condition.value ? [condition.value] : [];
    }
    
    // Toggle the value
    const index = condition.value.indexOf(value);
    if (index > -1) {
      condition.value.splice(index, 1);
    } else {
      condition.value.push(value);
    }
  } else {
    // For other operators, just set the single value
    condition.value = value;
  }
}

// Get selected values for a dependency condition
function getSelectedDependencyValues(di, ci) {
  const dep = currentField.value.dependencies?.[di];
  if (!dep || !dep.conditions?.[ci]) return [];
  const condition = dep.conditions[ci];
  if (Array.isArray(condition.value)) {
    return condition.value;
  }
  return condition.value ? [condition.value] : [];
}

// Get search term for a dependency condition
function getDependencySearchTerm(di, ci) {
  const key = `${di}-${ci}`;
  return dependencySearchTerms.value[key] || '';
}

// Set search term for a dependency condition
function setDependencySearchTerm(di, ci, term) {
  const key = `${di}-${ci}`;
  dependencySearchTerms.value[key] = term;
}

// Check if dropdown is open for a dependency condition
function isDependencyDropdownOpen(di, ci) {
  const key = `${di}-${ci}`;
  return dependencyDropdownOpen.value[key] || false;
}

// Set dropdown open state for a dependency condition
function setDependencyDropdownOpen(di, ci, open) {
  const key = `${di}-${ci}`;
  if (open) {
    dependencyDropdownOpen.value[key] = true;
  } else {
    delete dependencyDropdownOpen.value[key];
  }
}

// Get filtered options based on search term
function getFilteredDependencyOptions(di, ci) {
  const dep = currentField.value.dependencies?.[di];
  if (!dep || !dep.conditions?.[ci]) return [];
  const condition = dep.conditions[ci];
  const fieldKey = condition.fieldKey;
  const options = getDependencyFieldOptions(fieldKey);
  const searchTerm = getDependencySearchTerm(di, ci).toLowerCase();
  
  if (!searchTerm) return options;
  
  return options.filter(opt => 
    String(opt).toLowerCase().includes(searchTerm)
  );
}

// Select all filtered options
function selectAllDependencyValues(di, ci) {
  const filteredOptions = getFilteredDependencyOptions(di, ci);
  const dep = currentField.value.dependencies?.[di];
  if (!dep || !dep.conditions?.[ci]) return;
  const condition = dep.conditions[ci];
  
  if (condition.operator === 'in' || condition.operator === 'not_in') {
    if (!Array.isArray(condition.value)) {
      condition.value = [];
    }
    filteredOptions.forEach(opt => {
      if (!condition.value.includes(opt)) {
        condition.value.push(opt);
      }
    });
  }
}

// Deselect all values
function deselectAllDependencyValues(di, ci) {
  const dep = currentField.value.dependencies?.[di];
  if (!dep || !dep.conditions?.[ci]) return;
  const condition = dep.conditions[ci];
  
  if (condition.operator === 'in' || condition.operator === 'not_in') {
    condition.value = [];
  } else {
    condition.value = '';
  }
}
// Add mapping to picklist dependency
function addDependencyMapping(di) {
  const dep = currentField.value.dependencies[di];
  if (!dep) return;
  if (!dep.mappings) dep.mappings = [];
  dep.mappings.push({ whenValue: '', allowedOptions: [] });
}
// Remove mapping from picklist dependency
function removeDependencyMapping(di, mi) {
  const dep = currentField.value.dependencies[di];
  if (!dep || !dep.mappings) return;
  dep.mappings.splice(mi, 1);
  delete dependencyMappingBuffers.value[di + '-' + mi];
}
// Apply mapping options from buffer
function applyDependencyMapping(di, mi) {
  const key = di + '-' + mi;
  const raw = dependencyMappingBuffers.value[key] || '';
  const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
  const dep = currentField.value.dependencies?.[di];
  if (dep && dep.mappings?.[mi]) {
    dep.mappings[mi].allowedOptions = arr;
  }
}
// Check if a picklist option is selected for a dependency
function isPicklistOptionSelected(di, option) {
  const dep = currentField.value.dependencies?.[di];
  if (!dep) return false;
  if (!dep.allowedOptions) dep.allowedOptions = [];
  const optionValue = getPicklistOptionValue(option);
  // Check if the value is in allowedOptions (handle both string and object values)
  return dep.allowedOptions.some(selected => {
    const selectedValue = getPicklistOptionValue(selected);
    return selectedValue === optionValue;
  });
}

// Toggle a picklist option selection
function isPopupFieldSelected(di, fieldKey) {
  const dep = currentField.value.dependencies?.[di];
  if (!dep) return false;
  if (!dep.popupFields) dep.popupFields = [];
  return dep.popupFields.includes(fieldKey);
}

function togglePopupField(di, fieldKey) {
  const dep = currentField.value.dependencies?.[di];
  if (!dep) return;
  if (!dep.popupFields) dep.popupFields = [];
  
  const index = dep.popupFields.indexOf(fieldKey);
  if (index > -1) {
    dep.popupFields.splice(index, 1);
  } else {
    dep.popupFields.push(fieldKey);
  }
}

function togglePicklistOption(di, option) {
  const dep = currentField.value.dependencies?.[di];
  if (!dep) return;
  if (!dep.allowedOptions) dep.allowedOptions = [];
  const optionValue = getPicklistOptionValue(option);
  
  // Find index by comparing values
  const index = dep.allowedOptions.findIndex(selected => {
    const selectedValue = getPicklistOptionValue(selected);
    return selectedValue === optionValue;
  });
  
  if (index > -1) {
    // Remove if already selected
    dep.allowedOptions.splice(index, 1);
  } else {
    // Add if not selected - store the normalized value (string) for consistency
    dep.allowedOptions.push(optionValue);
  }
}

// Apply allowed options for picklist dependency (legacy support)
function applyDependencyOptions(di) {
  const raw = dependencyOptionsBuffer.value[di] || '';
  const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
  const dep = currentField.value.dependencies?.[di];
  if (dep) {
    dep.allowedOptions = arr;
  }
}

function addAdvancedDependency() {
  if (!currentField.value.advancedDependencies) currentField.value.advancedDependencies = [];
  currentField.value.advancedDependencies.push({ name: '', type: 'visibility', logic: 'AND', conditions: [], allowedOptions: [] });
}
function removeAdvancedDependency(idx) {
  currentField.value.advancedDependencies.splice(idx, 1);
  delete advancedOptionsBuffers.value[idx];
}
function addAdvancedCondition(ri) {
  const r = currentField.value.advancedDependencies[ri];
  if (!r.conditions) r.conditions = [];
  r.conditions.push({ fieldKey: '', operator: 'equals', value: '' });
}
function removeAdvancedCondition(ri, ci) {
  const r = currentField.value.advancedDependencies[ri];
  if (!r || !r.conditions) return;
  r.conditions.splice(ci, 1);
  delete advancedValueBuffers.value[ri + '-' + ci];
}
function applyAdvancedValue(ri, ci) {
  const key = ri + '-' + ci;
  const val = advancedValueBuffers.value[key];
  const r = currentField.value.advancedDependencies?.[ri];
  if (r && r.conditions?.[ci]) r.conditions[ci].value = coerceValueForField(r.conditions[ci].fieldKey, val);
}
function applyAdvancedOptions(ri) {
  const raw = advancedOptionsBuffers.value[ri] || '';
  const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (currentField.value.advancedDependencies?.[ri]) currentField.value.advancedDependencies[ri].allowedOptions = arr;
}
function advancedValuePlaceholder(fieldKey) {
  const f = editFields.value.find(x => x.key === fieldKey);
  if (!f) return 'Value';
  switch (f.dataType) {
    case 'Integer': return 'Number';
    case 'Decimal': return 'Number';
    case 'Currency': return 'Number';
    case 'Date': return 'YYYY-MM-DD';
    case 'Date-Time': return 'YYYY-MM-DDTHH:mm';
    case 'Checkbox': return 'true/false';
    case 'Picklist': return 'One of options';
    case 'Multi-Picklist': return 'One of options';
    default: return 'Value';
  }
}
function coerceValueForField(fieldKey, val) {
  const f = editFields.value.find(x => x.key === fieldKey);
  if (!f) return val;
  if (f.dataType === 'Integer' || f.dataType === 'Decimal' || f.dataType === 'Currency') {
    const n = Number(val);
    return isNaN(n) ? val : n;
  }
  if (f.dataType === 'Checkbox') {
    if (val === true || val === false) return val;
    if (typeof val === 'string') return val.toLowerCase() === 'true';
  }
  return val;
}

function uniqueFieldsByKey(arr) {
  if (!Array.isArray(arr)) return [];
  const map = new Map();
  // Canonical key for dedup: lowercase, trim, strip spaces and hyphens (so "deleted-by", "deletedBy", "Deleted By" all match)
  const canonical = (k) => String(k || '').toLowerCase().trim().replace(/\s+/g, '').replace(/-/g, '');
  for (const f of arr) {
    const k = canonical(f.key);
    if (!k) continue; // Skip fields without keys
    const existing = map.get(k);
    // Prefer programmatic key (no spaces) over label-style key ("Deleted By")
    if (existing && !(f.key || '').includes(' ') && (existing.key || '').includes(' ')) {
      map.set(k, f);
    } else if (!existing) {
      map.set(k, f);
    } else {
      map.set(k, f); // Keep last by default
    }
  }
  // Return deduplicated array, preserving relative order
  const result = Array.from(map.values());
  // Ensure order is maintained based on original order
  return result.sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    // If order is same, maintain array position
    const idxA = arr.findIndex(x => (x.key || '').toLowerCase() === (a.key || '').toLowerCase());
    const idxB = arr.findIndex(x => (x.key || '').toLowerCase() === (b.key || '').toLowerCase());
    return idxA - idxB;
  });
}

function addPicklistDependency() {
  if (!currentField.value.picklistDependencies) currentField.value.picklistDependencies = [];
  currentField.value.picklistDependencies.push({ sourceFieldKey: '', mappings: [] });
}
function removePicklistDependency(idx) {
  currentField.value.picklistDependencies.splice(idx, 1);
}
function addPicklistMapping(pdi) {
  const pd = currentField.value.picklistDependencies[pdi];
  if (!pd.mappings) pd.mappings = [];
  pd.mappings.push({ whenValue: '', allowedOptions: [] });
}
function removePicklistMapping(pdi, mi) {
  const pd = currentField.value.picklistDependencies[pdi];
  if (!pd || !pd.mappings) return;
  pd.mappings.splice(mi, 1);
  delete picklistOptionsBuffers.value[pdi + '-' + mi];
}
function applyPicklistOptions(pdi, mi) {
  const key = pdi + '-' + mi;
  const raw = picklistOptionsBuffers.value[key] || '';
  const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
  const pd = currentField.value.picklistDependencies?.[pdi];
  if (pd && pd.mappings?.[mi]) pd.mappings[mi].allowedOptions = arr;
}

function onDragStart(idx) {
  dragStartIdx.value = idx;
}

function onDragOver(idx) {
  dragOverIdx.value = idx;
}

async function onDrop(idx) {
  const from = dragStartIdx.value;
  const to = idx;
  dragStartIdx.value = null;
  dragOverIdx.value = null;
  if (from === null || to === null || from === to) return;

  // Layout-aware reorder: preserve section membership via sectionId when present.
  const fromField = editFields.value[from];
  const toField = editFields.value[to];
  if (fieldLayout.value && fromField?.key && toField?.key) {
    editFields.value = moveFieldAcrossLayout(
      editFields.value,
      fieldLayout.value,
      fromField.key,
      toField.key
    );
    return;
  }

  moveField(from, to - from);
  // Order change is dirty until the user clicks Save (no auto-save).
}

// Row drag-reorder
function onRowDragStart(ri) {
  dragRowSrc.value = ri;
}
function onRowDragOver(ri) {
  dragRowOver.value = ri;
}
function onRowDrop(ri) {
  if (dragRowSrc.value === null) return;
  const from = dragRowSrc.value;
  dragRowOver.value = null;
  dragRowSrc.value = null;
  if (from === ri) return;
  const [moved] = quickLayout.value.rows.splice(from, 1);
  quickLayout.value.rows.splice(ri, 0, moved);
}

// Snapshot helpers to detect unsaved changes
function getSnapshot() {
  // ensure deterministic order
  // Deduplicate fields before saving
  const deduplicatedFields = uniqueFieldsByKey(editFields.value);
  const normalizedFields = deduplicatedFields.map((f, i) => ({ ...f, order: i }));
  const payload = {
    fields: normalizedFields,
    fieldLayout: fieldLayout.value,
    relationships: relationships.value,
    quickCreate: Array.from(quickCreateSelected.value),
    quickCreateLayout: quickLayout.value,
    name: moduleNameEdit.value,
    enabled: moduleEnabled.value,
    pipelineSettings: selectedModule.value?.key === 'deals'
      ? normalizePipelineSettings(pipelineSettings.value)
      : []
  };
  return JSON.stringify(payload);
}
const isDirty = computed(() => {
  if (!selectedModuleId.value) return false;
  // If snapshot hasn't been initialized yet, we're not dirty
  if (!originalSnapshot.value) return false;
  return getSnapshot() !== originalSnapshot.value;
});

/** Align with selectModule quickCreate normalization — strict f.key === key on save dropped variant keys and caused saved N vs loaded N+1 mismatches. */
function resolveQuickCreateKeyToEditFieldsKey(key) {
  if (!key) return null;
  let field = editFields.value.find(f => f.key === key);
  if (field) return field.key;
  field = editFields.value.find(f => f.key && f.key.toLowerCase() === String(key).toLowerCase());
  if (field) return field.key;
  const camelCaseKey = String(key).replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  field = editFields.value.find(f => f.key && f.key.toLowerCase() === camelCaseKey.toLowerCase());
  return field ? field.key : null;
}

function mergeResolvedQuickCreateKeys(orderedResolved, selectedResolved) {
  const seen = new Set();
  const out = [];
  const push = (k) => {
    if (!k) return;
    const low = String(k).toLowerCase();
    if (seen.has(low)) return;
    seen.add(low);
    out.push(k);
  };
  for (const k of orderedResolved) push(k);
  for (const k of selectedResolved) push(k);
  return out;
}

function getQuickSnapshot() {
  const orderedKeys = orderedQuickCreate.value.map(f => resolveQuickCreateKeyToEditFieldsKey(f.key)).filter(Boolean);
  const selectedKeys = Array.from(quickCreateSelected.value)
    .map(k => resolveQuickCreateKeyToEditFieldsKey(k))
    .filter(Boolean);
  const qc = quickMode.value === 'simple'
    ? mergeResolvedQuickCreateKeys(orderedKeys, selectedKeys)
    : mergeResolvedQuickCreateKeys([], selectedKeys);
  const payload = {
    quickCreate: qc,
    quickCreateLayout: quickLayout.value
  };
  return JSON.stringify(payload);
}
const quickDirty = computed(() => {
  if (!selectedModuleId.value) return false;
  // If snapshot hasn't been initialized yet, we're not dirty
  if (!quickOriginalSnapshot.value) return false;
  return getQuickSnapshot() !== quickOriginalSnapshot.value;
});

async function saveQuickCreate() {
  const mod = selectedModule.value;
  if (!mod) return;
  if (isSavingQuickCreate.value) return;
  
  isSavingQuickCreate.value = true;
  try {
    const url = mod.type === 'system' ? `/api/modules/system/${mod.key}` : `/api/modules/${mod._id}`;

    // CRITICAL DIAGNOSTIC: capture raw state at click time so we can see exactly
    // what's in the reactive state when the user clicks Save. If the UI shows
    // a field selected but it's NOT in this Set, we have a reactivity issue.
    const rawSelectedAtClick = Array.from(quickCreateSelected.value);
    const rawOrderAtClick = [...quickCreateFieldOrder.value];
    const visibleOrderedAtClick = orderedQuickCreate.value.map(f => f.key);
    const editFieldsKeysAll = editFields.value.map(f => f.key);
    const requiredFieldsRaw = editFields.value
      .filter(f => !!f.required && !!f.key)
      .map(f => ({ key: f.key, required: f.required, isSystem: isSystemField(f) }));

    console.log('🟢 [saveQuickCreate] CLICK - raw state at button click:', {
      module: mod.key,
      quickMode: quickMode.value,
      rawSelectedAtClick,
      rawOrderAtClick,
      visibleOrderedAtClick,
      editFieldsKeysAll,
      requiredFieldsRaw
    });

    const orderedKeys = orderedQuickCreate.value.map(f => resolveQuickCreateKeyToEditFieldsKey(f.key)).filter(Boolean);
    const selectedKeys = Array.from(quickCreateSelected.value)
      .map(k => resolveQuickCreateKeyToEditFieldsKey(k))
      .filter(Boolean);

    let allKeys =
      quickMode.value === 'simple'
        ? mergeResolvedQuickCreateKeys(orderedKeys, selectedKeys)
        : mergeResolvedQuickCreateKeys([], selectedKeys);

    const dropped = [...new Set([
      ...orderedQuickCreate.value.map(f => f.key).filter(Boolean),
      ...Array.from(quickCreateSelected.value)
    ])].filter((k) => !resolveQuickCreateKeyToEditFieldsKey(k));
    if (dropped.length) {
      console.warn('⚠️  Quick Create keys could not be matched to module fields (excluded from save):', dropped);
    }
    
    // Always include required fields in saved Quick Create (excluding system fields).
    // IMPORTANT: only re-add required fields that are ALSO present in the visible/selected
    // set. Otherwise a stale `required: true` flag on a field config (e.g. from a prior
    // settings mistake) silently re-injects a field the user explicitly removed, which
    // looks like "the UI resets after saving" because the saved payload no longer matches
    // what the user saw on screen.
    const visibleAvailableKeySet = new Set(
      (Array.isArray(quickCreateAvailableFields.value) ? quickCreateAvailableFields.value : [])
        .map(f => f?.key)
        .filter(Boolean)
    );
    const requiredKeysSave = editFields.value
      .filter(f => !!f.required && !!f.key && !isSystemField(f))
      .map(f => f.key)
      .filter(k => visibleAvailableKeySet.has(k));
    if (requiredKeysSave.length) {
      console.log('🟢 [saveQuickCreate] required keys re-added to save payload:', requiredKeysSave);
    }
    allKeys = Array.from(new Set([...allKeys, ...requiredKeysSave]));
    // Guardrail: never persist system fields in Quick Create settings.
    allKeys = allKeys.filter(key => {
      const field = editFields.value.find(f => f.key === key);
      if (!field) return false;
      if (isEventsModule.value) {
        return classifyEventQuickCreateField(field) !== 'system';
      }
      return !isSystemField(field);
    });
    
    // For People module, filter to only eligible core identity fields.
    if (isPeopleModule.value) {
      const coreIdentityFieldKeys = getCoreIdentityFields();
      console.log('🔍 Filtering People module quickCreate fields:', {
        allKeysBeforeFilter: allKeys,
        allKeysCount: allKeys.length,
        coreIdentityFieldKeys: coreIdentityFieldKeys,
        coreIdentityFieldKeysCount: coreIdentityFieldKeys.length
      });
      
      const beforeFilter = [...allKeys];
      allKeys = allKeys.filter(key => {
        // Use the same eligibility check as the UI (core identity only).
        try {
          const metadata = getFieldMetadata(key);
          
          // Core identity fields: owner === 'core', intent === 'identity', editable === true
          const isCoreIdentity = (
            metadata.owner === 'core' &&
            metadata.intent === 'identity' &&
            metadata.editable === true
          );
          
          return isCoreIdentity;
        } catch (err) {
          return false;
        }
      });
      
      console.log('🔍 People module quickCreate filter result:', {
        beforeFilter: beforeFilter,
        afterFilter: allKeys,
        filteredOut: beforeFilter.filter(k => !allKeys.includes(k)),
        finalCount: allKeys.length
      });
    }
    
    // Quick Create: save exactly what the user selected. No hardcoded field lists.
    // Only enforce primary field first for modules that have one (title / eventName / name).
    if (isTasksModule.value) {
      const titleKey = allKeys.find(k => k?.toLowerCase() === 'title');
      if (titleKey && allKeys[0]?.toLowerCase() !== 'title') {
        allKeys = allKeys.filter(k => k?.toLowerCase() !== 'title');
        allKeys.unshift(titleKey);
      }
    }
    if (isEventsModule.value) {
      const eventNameKey = allKeys.find(k => k?.toLowerCase() === 'eventname');
      if (eventNameKey && allKeys[0]?.toLowerCase() !== 'eventname') {
        allKeys = allKeys.filter(k => k?.toLowerCase() !== 'eventname');
        allKeys.unshift(eventNameKey);
      }
    }
    if (isOrganizationsModule.value) {
      const nameKey = allKeys.find(k => k?.toLowerCase() === 'name');
      if (nameKey && allKeys[0]?.toLowerCase() !== 'name') {
        allKeys = allKeys.filter(k => k?.toLowerCase() !== 'name');
        allKeys.unshift(nameKey);
      }
    }
    
    const payload = {
      quickCreate: allKeys,
      quickCreateLayout: quickMode.value === 'advanced' ? quickLayout.value : { version: 1, rows: [] }
    };
    
    console.log('Saving Quick Create:', {
      module: mod.key,
      mode: quickMode.value,
      orderedKeys: orderedKeys,
      selectedKeys: selectedKeys,
      allKeys: allKeys,
      quickCreate: payload.quickCreate,
      quickCreateLayout: payload.quickCreateLayout,
      editFieldsKeys: editFields.value.map(f => f.key).slice(0, 10),
      payload
    });
    
    let data;
    try {
      data = await apiClient.put(url, payload);
    } catch (err) {
      console.error('Save Quick Create failed:', err);
      notifications.error(err.message || t('settings.modFieldsErrQuickCreateSaveFailed'));
      return;
    }
    if (!data.success) {
      console.error('Save Quick Create failed:', data);
      notifications.error(data.message || t('settings.modFieldsErrQuickCreateSaveFailed'));
      return;
    }
    
    console.log('Quick Create saved successfully:', {
      quickCreate: data.data?.quickCreate,
      quickCreateLayout: data.data?.quickCreateLayout,
      savedPayload: payload.quickCreate
    });
    // cache selection locally for resilience
    try {
      localStorage.setItem(`arivu-modfields-quick-${mod.key}`, JSON.stringify(payload.quickCreate));
    } catch (e) {}
    
    invalidateTenantSchemaCaches();
    // Refresh modules from server (bypass client metadata cache + tenantSchemaApiCache for DynamicForm)
    await fetchModules({ cache: 'no-store' });
    
    // Find the updated module and verify quickCreate was saved
    const updated = modules.value.find(m => m.key === mod.key);
    if (updated) {
      console.log('Module after refresh:', {
        key: updated.key,
        quickCreate: updated.quickCreate,
        quickCreateLength: updated.quickCreate?.length || 0,
        expectedLength: payload.quickCreate.length
      });
      
      // Verify the saved quickCreate matches what we sent.
      // Compare BOTH length and exact contents (set + order). If anything diverges
      // it tells us the server transformed the payload — the most useful signal
      // for debugging "UI resets after saving".
      const sentArr = Array.isArray(payload.quickCreate) ? payload.quickCreate : [];
      const loadedArr = Array.isArray(updated.quickCreate) ? updated.quickCreate : [];
      const sentSet = new Set(sentArr.map(k => String(k || '').toLowerCase()));
      const loadedSet = new Set(loadedArr.map(k => String(k || '').toLowerCase()));
      const inSentNotLoaded = sentArr.filter(k => !loadedSet.has(String(k || '').toLowerCase()));
      const inLoadedNotSent = loadedArr.filter(k => !sentSet.has(String(k || '').toLowerCase()));
      if (inSentNotLoaded.length || inLoadedNotSent.length || sentArr.length !== loadedArr.length) {
        console.warn('⚠️  QuickCreate diff after save (sent vs loaded):', {
          module: mod.key,
          sentLength: sentArr.length,
          loadedLength: loadedArr.length,
          sentKeys: sentArr,
          loadedKeys: loadedArr,
          droppedByServer: inSentNotLoaded,
          addedByServer: inLoadedNotSent
        });
      }
      
      selectModule(updated, editFields.value[selectedFieldIdx.value]?.key || null);
    } else {
      console.error('❌ Updated module not found after refresh');
    }
    quickOriginalSnapshot.value = getQuickSnapshot();
    try { window.dispatchEvent(new CustomEvent('arivu:core-modules-updated')); } catch (e) {}
  } catch (e) {
    console.error('Save quick create failed', e);
    notifications.error(t('settings.modFieldsErrQuickCreateSettingsFailed'));
  } finally {
    isSavingQuickCreate.value = false;
  }
}

// ============================================================================
// Organization Types & Status Picklists (Status & Types tab)
// ============================================================================
// Policy layer: enable/disable only. Catalog (add/rename/color/order) is Fields tab.
// Persisted to tenant module configuration (/organizations/status-types), not field defs.
// ============================================================================

// Organization Types state
// Organization Types state - initialized as empty, will be populated from API
const organizationTypes = ref([]);

// Status Picklists state - initialized as empty, will be populated from API
const statusPicklists = ref({
  customerStatus: [],
  partnerStatus: [],
  vendorStatus: []
});

/** Normalize field option / picklist entries (string or { value, label, color }). */
function normalizePicklistValue(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return normalizePicklistValue(JSON.parse(trimmed));
      } catch {
        /* use raw string */
      }
    }
    return raw;
  }
  if (typeof raw === 'object') {
    if (raw.value != null && raw.value !== raw) {
      return normalizePicklistValue(raw.value);
    }
    if (typeof raw.label === 'string' && raw.label.trim()) {
      return normalizePicklistValue(raw.label);
    }
  }
  return String(raw);
}

function normalizePicklistLabel(raw, value) {
  const resolvedValue = value ?? normalizePicklistValue(raw);
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof raw.label === 'string' && raw.label.trim()) {
    return raw.label;
  }
  return resolvedValue;
}

function normalizePicklistColor(raw, value, fallbackHex = PLATFORM_DEFAULT_PICKLIST_COLOR) {
  if (raw && typeof raw === 'object' && typeof raw.color === 'string') {
    const trimmed = raw.color.trim();
    if (/^#[0-9A-Fa-f]{6}$/i.test(trimmed)) return trimmed;
  }
  return fallbackHex;
}

/** Resolve hex from module field options (Fields tab picklist config). */
function picklistColorFromField(field, value) {
  if (!field || value == null || value === '') return null;
  const normalizedValue = normalizePicklistColorKey(value);
  const options = field.options || field.enum || [];
  for (const opt of options) {
    const optValue = normalizePicklistValue(opt);
    if (normalizePicklistColorKey(optValue) !== normalizedValue) continue;
    if (typeof opt === 'object' && opt.color) return normalizePicklistColor(opt, value, PLATFORM_DEFAULT_PICKLIST_COLOR);
    return getDefaultOptionColor(value, field, options);
  }
  return getDefaultOptionColor(value, field, options);
}

const organizationsTypesFieldRef = ref(null);
const statusPicklistFieldsByKey = ref({
  customerStatus: null,
  partnerStatus: null,
  vendorStatus: null,
});

function mapOrganizationTypeEntry(entry, typesField = organizationsTypesFieldRef.value) {
  const source =
    entry && typeof entry === 'object' && ('enabled' in entry || 'value' in entry)
      ? entry
      : { value: entry, enabled: true };
  const value = normalizePicklistValue(source.value ?? entry);
  const label = normalizePicklistLabel(source, value);
  const rawForColor = typeof entry === 'object' && entry !== null ? entry : source;
  const fallback = typesField ? getDefaultOptionColor(value, typesField) : '#3B82F6';
  const color =
    normalizePicklistColor(rawForColor, value, picklistColorFromField(typesField, value) || fallback);
  const row = {
    value,
    label,
    color,
    enabled: source.enabled !== undefined ? source.enabled : true,
    description: label ? `${label} organizations` : '',
  };
  if (Array.isArray(source.fields)) {
    row.fields = source.fields.map((x) => String(x ?? '').trim()).filter(Boolean);
  }
  return row;
}

function mapStatusPicklistEntry(entry, statusField = null) {
  const source =
    entry && typeof entry === 'object' && ('enabled' in entry || 'value' in entry || 'editing' in entry)
      ? entry
      : { value: entry, enabled: true };
  const value = normalizePicklistValue(source.value ?? entry);
  const label = normalizePicklistLabel(source, value);
  const rawForColor = typeof entry === 'object' && entry !== null ? entry : source;
  const fallback = statusField ? getDefaultOptionColor(value, statusField) : '#6B7280';
  const color =
    normalizePicklistColor(rawForColor, value, picklistColorFromField(statusField, value) || fallback);
  return {
    value,
    label,
    color,
    enabled: source.enabled !== undefined ? source.enabled : true,
    editing: false,
    editValue: label,
  };
}

function resolveStatusPicklistColor(status, fieldKey) {
  const field = statusPicklistFieldsByKey.value[fieldKey];
  return status.color || picklistColorFromField(field, status.value) || '#6B7280';
}

/** Append catalog options from Fields that are not yet in tenant policy rows (new values default enabled). */
function applyDefaultOrganizationStatusPicklist(fieldKey) {
  statusPicklists.value[fieldKey] = getDefaultOrganizationStatusFieldOptions(fieldKey).map((status) =>
    mapStatusPicklistEntry(status, statusPicklistFieldsByKey.value[fieldKey])
  );
}

function applyPlatformDefaultOrganizationStatusPicklists() {
  for (const fieldKey of ORGANIZATION_STATUS_FIELD_KEYS) {
    applyDefaultOrganizationStatusPicklist(fieldKey);
  }
}

function mergeOrganizationTypesWithCatalog(policyRows, typesField) {
  const policy = (Array.isArray(policyRows) ? policyRows : []).filter(
    (row) => !isRetiredOrganizationTypeValue(normalizePicklistValue(row?.value))
  );
  const options = typesField?.options || typesField?.enum || [];
  const seen = new Set(policy.map((r) => normalizePicklistValue(r.value)).filter(Boolean));
  const merged = [...policy];
  for (const opt of options) {
    const value = normalizePicklistValue(opt);
    if (!value || seen.has(value) || isRetiredOrganizationTypeValue(value)) continue;
    seen.add(value);
    merged.push(
      mapOrganizationTypeEntry(
        typeof opt === 'object' && opt !== null ? { ...opt, enabled: true } : { value: opt, enabled: true },
        typesField
      )
    );
  }
  return merged.map((row) => {
    const color = picklistColorFromField(typesField, row.value);
    return color ? { ...row, color } : row;
  });
}

function mergeStatusPicklistWithCatalog(policyRows, statusField) {
  const options = statusField?.options || statusField?.enum || [];
  const seen = new Set(policyRows.map((r) => normalizePicklistValue(r.value)).filter(Boolean));
  const merged = [...policyRows];
  for (const opt of options) {
    const value = normalizePicklistValue(opt);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    merged.push(
      mapStatusPicklistEntry(
        typeof opt === 'object' && opt !== null ? { ...opt, enabled: true } : { value: opt, enabled: true },
        statusField
      )
    );
  }
  return merged.map((row) => {
    const color = picklistColorFromField(statusField, row.value);
    return color ? { ...row, color } : row;
  });
}

function serializeOrganizationTypeEntry(entry) {
  const value = normalizePicklistValue(entry.value);
  const label = normalizePicklistLabel(entry, value);
  const row = {
    value,
    label,
    enabled: entry.enabled !== undefined ? entry.enabled : true,
  };
  if (entry.fields !== undefined) {
    row.fields = [...entry.fields];
  }
  return row;
}

function serializeOrganizationTypeEntryForSnapshot(entry) {
  const base = serializeOrganizationTypeEntry(entry);
  return {
    ...base,
    fields: entry.fields === undefined ? null : [...entry.fields],
  };
}

const expandedOrgTypeIndex = ref(-1);

function titleCaseOrganizationFieldKey(key) {
  return String(key || '')
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

const organizationTypeFieldOptions = computed(() => {
  const moduleList = editFields.value || [];
  const byKey = new Map();
  for (const fieldKey of getOrganizationTypeScopedFieldPool()) {
    const low = fieldKey.toLowerCase();
    const modField = moduleList.find((f) => String(f.key || '').toLowerCase() === low);
    const label = modField?.label ? String(modField.label) : titleCaseOrganizationFieldKey(fieldKey);
    byKey.set(low, { key: modField?.key ?? fieldKey, label });
  }
  const alwaysVisibleNorm = new Set([
    'name', 'industry', 'website', 'phone', 'address', 'tags',
    'assignedto', 'accountmanager', 'primarycontact', 'isactive', 'types', 'derivedstatus'
  ]);
  for (const f of moduleList) {
    const k = String(f.key ?? '').trim();
    if (!k) continue;
    const low = k.toLowerCase();
    if (byKey.has(low)) continue;
    const norm = low.replace(/[^a-z0-9]/g, '');
    if (alwaysVisibleNorm.has(norm)) continue;
    if (f.isSystem || f.system) continue;
    if (isTenantPlatformOrganizationFieldKey(k)) continue;
    byKey.set(low, { key: k, label: String(f.label || titleCaseOrganizationFieldKey(k)) });
  }
  return Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label));
});

function setExpandedOrgTypeIndex(index) {
  expandedOrgTypeIndex.value = expandedOrgTypeIndex.value === index ? -1 : index;
}

function toggleOrganizationTypeField(typeIndex, fieldKey, checked) {
  const type = organizationTypes.value[typeIndex];
  if (!type) return;
  let nextFields =
    type.fields === undefined
      ? [...getOrganizationFieldsForType(type.value, null)]
      : [...type.fields];
  const low = fieldKey.toLowerCase();
  if (checked) {
    if (!nextFields.some((k) => String(k).toLowerCase() === low)) {
      const canon =
        organizationTypeFieldOptions.value.find((o) => o.key.toLowerCase() === low)?.key ?? fieldKey;
      nextFields.push(canon);
    }
  } else {
    nextFields = nextFields.filter((k) => String(k).toLowerCase() !== low);
  }
  const updated = { ...type, fields: nextFields };
  const copy = [...organizationTypes.value];
  copy[typeIndex] = updated;
  organizationTypes.value = copy;
}

function resetOrganizationTypeFields(typeIndex) {
  const type = organizationTypes.value[typeIndex];
  if (!type) return;
  const { fields: _drop, ...rest } = type;
  const copy = [...organizationTypes.value];
  copy[typeIndex] = rest;
  organizationTypes.value = copy;
}

function serializeStatusPicklistEntry(entry) {
  const value = normalizePicklistValue(entry.value);
  const label = normalizePicklistLabel(entry, value);
  return {
    value,
    label,
    enabled: entry.enabled !== undefined ? entry.enabled : true,
  };
}

function setPicklistEnabled(item, event) {
  item.enabled = Boolean(event?.target?.checked);
}

const savingStatusTypes = ref(false);
const statusTypesOriginalSnapshot = ref('');
const isInitialLoad = ref(true); // Flag to skip dirty/snapshot work during initial load
const lastSaveTimestamp = ref(0); // Track when we last saved to prevent refetching stale data

// Tasks Status & Priority - edited in Field Configurations (status/priority fields)
function getTaskPicklistFieldFromConfig(fieldKey) {
  const normalizedFieldKey = String(fieldKey || '').toLowerCase();
  return editFields.value.find(field => String(field?.key || '').toLowerCase() === normalizedFieldKey);
}

// Items Status & Types state
const itemTypes = ref([
  { value: 'Product', label: 'Product', enabled: true, description: 'Physical product that can be sold' },
  { value: 'Service', label: 'Service', enabled: true, description: 'Service that can be provided' },
  { value: 'Serialized Product', label: 'Serialized Product', enabled: true, description: 'Product with unique serial numbers' },
  { value: 'Non-Stock Product', label: 'Non-Stock Product', enabled: true, description: 'Product not tracked in inventory' },
  { value: 'Bundle', label: 'Bundle', enabled: true, description: 'Kit or composite product made of other variants' }
]);

const itemStatusPicklist = ref([
  { value: 'Active', label: 'Active', enabled: true, editing: false },
  { value: 'Inactive', label: 'Inactive', enabled: true, editing: false }
]);

const catalogLifecycleDescriptionKeys = {
  Draft: 'settings.modFieldsCatalogLifecycleDraftDesc',
  Active: 'settings.modFieldsCatalogLifecycleActiveDesc',
  Discontinued: 'settings.modFieldsCatalogLifecycleDiscontinuedDesc',
  Archived: 'settings.modFieldsCatalogLifecycleArchivedDesc'
};

const catalogLifecycleStateRows = computed(() =>
  CATALOG_LIFECYCLE_STATES.map((state) => ({
    state,
    label: t(CATALOG_LIFECYCLE_LABEL_KEYS[state] || state),
    description: t(catalogLifecycleDescriptionKeys[state] || '')
  }))
);

const savingItemStatusTypes = ref(false);
const itemStatusTypesOriginalSnapshot = ref('');

const itemStatusTypesDirty = computed(() => {
  if (!itemStatusTypesOriginalSnapshot.value) return false;
  
  const current = JSON.stringify({
    itemTypes: itemTypes.value.map(t => ({
      value: t.value,
      label: t.label,
      enabled: t.enabled !== undefined ? t.enabled : true
    })),
    status: itemStatusPicklist.value.map(s => ({
      value: s.value,
      label: s.label || s.value,
      enabled: s.enabled !== undefined ? s.enabled : true
    }))
  });
  
  return current !== itemStatusTypesOriginalSnapshot.value;
});

// Events Roles & Rules state
// ARCHITECTURE NOTE: Events Settings configure constraints, not behavior.
// These state variables track role requirements, geo rules, and form linking rules per event type.
// See: docs/architecture/event-settings.md Section 4.3, 4.4, 4.5
const eventRoleRules = ref({
  'Meeting': { auditorRequired: false, reviewerRequired: false, correctiveOwnerRequired: false },
  'Internal Audit': { auditorRequired: true, reviewerRequired: false, correctiveOwnerRequired: true }, // auditor and correctiveOwner locked
  'External Audit — Single Org': { auditorRequired: true, reviewerRequired: true, correctiveOwnerRequired: true }, // all locked
  'External Audit Beat': { auditorRequired: true, reviewerRequired: false, correctiveOwnerRequired: true }, // auditor and correctiveOwner locked
  'Field Sales Beat': { auditorRequired: false, reviewerRequired: false, correctiveOwnerRequired: false }
});

const eventGeoRules = ref({
  'Meeting': false,
  'Internal Audit': true, // locked
  'External Audit — Single Org': true, // locked
  'External Audit Beat': true, // locked
  'Field Sales Beat': true // default true, can be changed
});

const eventFormRules = ref({
  'Meeting': { allowLinking: true, requireOnCreation: false, preventUnlinkingAfterStart: false },
  'Internal Audit': { allowLinking: true, requireOnCreation: false, preventUnlinkingAfterStart: false },
  'External Audit — Single Org': { allowLinking: true, requireOnCreation: false, preventUnlinkingAfterStart: false },
  'External Audit Beat': { allowLinking: true, requireOnCreation: false, preventUnlinkingAfterStart: false },
  'Field Sales Beat': { allowLinking: true, requireOnCreation: false, preventUnlinkingAfterStart: false }
});

const savingEventRolesRules = ref(false);
const eventRolesRulesOriginalSnapshot = ref('');

// Events Status state
// ARCHITECTURE NOTE: Events Settings configure structure only, never execution.
// Event status picklist controls event lifecycle options.
// All event statuses (Planned, Completed, Cancelled) are system-locked and cannot be modified.
// These statuses are required for execution and status transitions.
// See: docs/architecture/event-settings.md Section 2.2
// SYSTEM-OWNED STATUSES: ['Planned', 'Completed', 'Cancelled']
// These statuses:
// - Cannot be deleted
// - Cannot be renamed
// - Cannot be reordered below configurable statuses
// - Are required for event execution and lifecycle management
const EVENT_SYSTEM_STATUSES = ['Planned', 'Completed', 'Cancelled'];
const eventStatusPicklist = ref([
  { value: 'Planned', label: 'Planned', enabled: true, editing: false, systemLocked: true },
  { value: 'Completed', label: 'Completed', enabled: true, editing: false, systemLocked: true },
  { value: 'Cancelled', label: 'Cancelled', enabled: true, editing: false, systemLocked: true }
]);

const savingEventStatus = ref(false);
const eventStatusOriginalSnapshot = ref('');

// Helper: Check if event status is system-locked
// ARCHITECTURE NOTE: System statuses are required for execution and cannot be modified.
// See: docs/architecture/event-settings.md Section 2.2
function isEventSystemStatus(statusValue) {
  return EVENT_SYSTEM_STATUSES.includes(statusValue);
}

// Helper: Check if event type is an audit event type
// ARCHITECTURE NOTE: Audit events have locked role requirements and geo requirements.
// See: docs/architecture/event-settings.md Section 2.1
function isAuditEventType(eventType) {
  return ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'].includes(eventType);
}

// Computed: Check if event roles & rules configuration is dirty
const eventRolesRulesDirty = computed(() => {
  if (!eventRolesRulesOriginalSnapshot.value) return false;
  
  const current = JSON.stringify({
    roleRules: eventRoleRules.value,
    geoRules: eventGeoRules.value,
    formRules: eventFormRules.value
  });
  
  return current !== eventRolesRulesOriginalSnapshot.value;
});

const modulePageDirty = computed(() => {
  if (!selectedModuleId.value) return false;
  const tab = activeTopTab.value;
  if (tab === 'quick') return quickDirty.value;
  if (tab === 'status-types' && isItemsModule.value) return itemStatusTypesDirty.value;
  if (tab === 'roles-rules' && isEventsModule.value) return eventRolesRulesDirty.value;
  if (['details', 'relationships', 'pipeline', 'fields'].includes(tab)) return isDirty.value;
  return false;
});

const modulePageSaving = computed(() => {
  const tab = activeTopTab.value;
  if (tab === 'quick') return isSavingQuickCreate.value;
  if (tab === 'status-types' && isItemsModule.value) return savingItemStatusTypes.value;
  if (tab === 'roles-rules' && isEventsModule.value) return savingEventRolesRules.value;
  return isSaving.value;
});

async function saveModulePageChanges() {
  const tab = activeTopTab.value;
  if (tab === 'quick') {
    await saveQuickCreate();
    return;
  }
  if (tab === 'status-types' && isItemsModule.value) {
    await saveItemStatusTypes();
    return;
  }
  if (tab === 'roles-rules' && isEventsModule.value) {
    await saveEventRolesRules();
    return;
  }
  await saveModule();
}

function restoreItemStatusTypesFromSnapshot() {
  if (!itemStatusTypesOriginalSnapshot.value) return;
  try {
    const data = JSON.parse(itemStatusTypesOriginalSnapshot.value);
    itemTypes.value = (data.itemTypes || []).map((entry) => ({ ...entry }));
    itemStatusPicklist.value = (data.status || []).map((entry) => ({ ...entry }));
  } catch (err) {
    console.error('Failed to restore item status types:', err);
  }
}

function restoreEventRolesRulesFromSnapshot() {
  if (!eventRolesRulesOriginalSnapshot.value) return;
  try {
    const data = JSON.parse(eventRolesRulesOriginalSnapshot.value);
    eventRoleRules.value = JSON.parse(JSON.stringify(data.roleRules || {}));
    eventGeoRules.value = JSON.parse(JSON.stringify(data.geoRules || {}));
    eventFormRules.value = JSON.parse(JSON.stringify(data.formRules || {}));
  } catch (err) {
    console.error('Failed to restore event roles & rules:', err);
  }
}

function resetModulePageChanges() {
  const tab = activeTopTab.value;
  if (tab === 'quick') {
    if (!quickOriginalSnapshot.value || !selectedModule.value) return;
    selectModule(selectedModule.value, currentField.value?.key || null);
    return;
  }
  if (tab === 'status-types' && isItemsModule.value) {
    restoreItemStatusTypesFromSnapshot();
    return;
  }
  if (tab === 'roles-rules' && isEventsModule.value) {
    restoreEventRolesRulesFromSnapshot();
    return;
  }
  if (selectedModule.value) {
    selectModule(selectedModule.value, currentField.value?.key || null);
  }
}

// Update event role rule
function updateEventRoleRule(eventType, roleType, value) {
  if (!eventRoleRules.value[eventType]) {
    eventRoleRules.value[eventType] = {};
  }
  eventRoleRules.value[eventType][roleType] = value;
}

// Update event geo rule
function updateEventGeoRule(eventType, value) {
  // Prevent changing geo rules for audit events (they're locked)
  if (isAuditEventType(eventType)) {
    return;
  }
  eventGeoRules.value[eventType] = value;
}

// Update event form rule
function updateEventFormRule(eventType, ruleType, value) {
  if (!eventFormRules.value[eventType]) {
    eventFormRules.value[eventType] = {};
  }
  eventFormRules.value[eventType][ruleType] = value;
}

// Save event roles & rules
async function saveEventRolesRules() {
  if (!selectedModule.value || savingEventRolesRules.value) return;
  
  savingEventRolesRules.value = true;
  try {
    // TODO: Implement API call to save event roles & rules configuration
    // This should save to tenant module configuration, not field definitions
    console.log('Saving event roles & rules:', {
      roleRules: eventRoleRules.value,
      geoRules: eventGeoRules.value,
      formRules: eventFormRules.value
    });
    
    // Update snapshot after successful save
    eventRolesRulesOriginalSnapshot.value = JSON.stringify({
      roleRules: eventRoleRules.value,
      geoRules: eventGeoRules.value,
      formRules: eventFormRules.value
    });
  } catch (err) {
    console.error('Failed to save event roles & rules:', err);
    // TODO: Show error message to user
  } finally {
    savingEventRolesRules.value = false;
  }
}

// Computed: Check if event status configuration is dirty
// ARCHITECTURE NOTE: Event statuses are system-locked, so this should always return false.
// This is a defensive check to prevent any accidental modifications.
const eventStatusDirty = computed(() => {
  // Event statuses are system-locked and cannot be modified
  // This computed property exists for consistency with other tabs but should always return false
  return false;
});

// Event Status functions (defensive guards - all operations are blocked for system statuses)
// ARCHITECTURE NOTE: All event statuses are system-locked. These functions exist as defensive guards
// to prevent any code from attempting to modify system statuses.
// See: docs/architecture/event-settings.md Section 2.2

function startEventStatusEdit(index) {
  const status = eventStatusPicklist.value[index];
  if (isEventSystemStatus(status.value)) {
    if (import.meta.env.DEV) {
      console.error('❌ [Event Settings] Attempted to edit system-locked status:', status.value);
      console.error('   System statuses cannot be modified. See: docs/architecture/event-settings.md Section 2.2');
    }
    return; // System-locked - cannot edit
  }
  // This should never execute since all statuses are system-locked
  status.editing = true;
  status.editValue = status.label;
}

function saveEventStatusValue(index) {
  const status = eventStatusPicklist.value[index];
  if (isEventSystemStatus(status.value)) {
    if (import.meta.env.DEV) {
      console.error('❌ [Event Settings] Attempted to save system-locked status:', status.value);
      console.error('   System statuses cannot be modified. See: docs/architecture/event-settings.md Section 2.2');
    }
    return; // System-locked - cannot save
  }
  // This should never execute since all statuses are system-locked
  if (status.editValue && status.editValue.trim()) {
    status.label = status.editValue.trim();
  }
  status.editing = false;
  delete status.editValue;
}

function cancelEventStatusEdit(index) {
  const status = eventStatusPicklist.value[index];
  status.editing = false;
  delete status.editValue;
}

function removeEventStatusValue(index) {
  const status = eventStatusPicklist.value[index];
  if (isEventSystemStatus(status.value)) {
    if (import.meta.env.DEV) {
      console.error('❌ [Event Settings] Attempted to delete system-locked status:', status.value);
      console.error('   System statuses cannot be deleted. See: docs/architecture/event-settings.md Section 2.2');
    }
    return; // System-locked - cannot delete
  }
  // This should never execute since all statuses are system-locked
  eventStatusPicklist.value.splice(index, 1);
}

// Initialize event status snapshot (for consistency, even though statuses are read-only)
function initializeEventStatusSnapshot() {
  const snapshotData = {
    status: eventStatusPicklist.value.map(s => ({
      value: s.value,
      label: s.label || s.value,
      enabled: s.enabled !== undefined ? s.enabled : true,
      systemLocked: s.systemLocked || false
    }))
  };
  eventStatusOriginalSnapshot.value = JSON.stringify(snapshotData);
}

// Items Status & Types functions
function addItemStatusValue() {
  const newValue = `status_${Date.now()}`;
  itemStatusPicklist.value.push({
    value: newValue,
    label: 'New Status',
    enabled: true,
    editing: true,
    editValue: 'New Status'
  });
}

function startItemStatusEdit(index) {
  itemStatusPicklist.value[index].editing = true;
  itemStatusPicklist.value[index].editValue = itemStatusPicklist.value[index].label;
}

function saveItemStatusValue(index) {
  const status = itemStatusPicklist.value[index];
  if (status.editValue && status.editValue.trim()) {
    status.label = status.editValue.trim();
    if (status.value.startsWith('status_')) {
      // If it's a new status, update the value to a slug version
      status.value = status.editValue.trim().toLowerCase().replace(/\s+/g, '_');
    }
  }
  status.editing = false;
  delete status.editValue;
}

function cancelItemStatusEdit(index) {
  const status = itemStatusPicklist.value[index];
  status.editing = false;
  delete status.editValue;
  // If it was a new status and user cancelled, remove it
  if (status.value.startsWith('status_') && !status.label || status.label === 'New Status') {
    itemStatusPicklist.value.splice(index, 1);
  }
}

function removeItemStatusValue(index) {
  if (itemStatusPicklist.value.length <= 1) return; // Must have at least one
  itemStatusPicklist.value.splice(index, 1);
}

async function saveItemStatusTypes() {
  try {
    savingItemStatusTypes.value = true;
    
    const payload = {
      itemTypes: itemTypes.value.map(t => ({
        value: t.value,
        label: t.label,
        enabled: t.enabled !== undefined ? t.enabled : true
      })),
      status: itemStatusPicklist.value.map(s => ({
        value: s.value,
        label: s.label || s.value,
        enabled: s.enabled !== undefined ? s.enabled : true
      }))
    };
    
    // TODO: Implement API endpoint for saving item status/types
    // await apiClient.patch(`/settings/core-modules/items/status-types`, payload);
    
    console.log('[Item Status Types] Save successful (local only for now)');
    itemStatusTypesOriginalSnapshot.value = JSON.stringify(payload);
  } catch (err) {
    console.error('Failed to save item status/types:', err);
    notifications.error(err.message || t('settings.modFieldsErrItemStatusTypesSaveFailed'));
  } finally {
    savingItemStatusTypes.value = false;
  }
}

// Computed: Check if status types configuration is dirty
// Compare only the fields that are saved (value, label, enabled), not UI state (editing, description, etc.)
const statusTypesDirty = computed(() => {
  if (!statusTypesOriginalSnapshot.value) return false;
  
  // Normalize current state to match snapshot structure (only saved fields)
  const current = JSON.stringify({
    organizationTypes: organizationTypes.value.map(serializeOrganizationTypeEntryForSnapshot),
    statusPicklists: {
      customerStatus: statusPicklists.value.customerStatus.map(serializeStatusPicklistEntry),
      partnerStatus: statusPicklists.value.partnerStatus.map(serializeStatusPicklistEntry),
      vendorStatus: statusPicklists.value.vendorStatus.map(serializeStatusPicklistEntry),
    },
  });
  
  const isDirty = current !== statusTypesOriginalSnapshot.value;
  if (isDirty) {
    console.log('[Status Types] Dirty check: Data has changed');
  }
  return isDirty;
});

// Fetch organization types and status picklists from module configuration
// First tries to fetch tenant overrides, then falls back to module defaults
// Flag to prevent concurrent fetches
const fetchingStatusTypes = ref(false);
const statusTypesLoading = ref(false);
const statusTypesLoadError = ref('');

const PLATFORM_DEFAULT_ORG_TYPES = ['Customer', 'Partner', 'Vendor'];

function resolveOrganizationsTypesFieldFromModule(module) {
  const fromApi = module?.fields?.find((f) => f.key === 'types') ?? null;
  const fromEdit = editFields.value?.find((f) => f.key === 'types') ?? null;
  if (!fromApi && !fromEdit) return null;
  const apiOptions = fromApi?.options || fromApi?.enum || [];
  const editOptions = fromEdit?.options || fromEdit?.enum || [];
  const options = editOptions.length > 0 ? editOptions : apiOptions;
  const base = fromEdit ?? fromApi;
  return { ...base, options, enum: options };
}

function resolveOrganizationsTypesFieldWithColors(module) {
  const base = resolveOrganizationsTypesFieldFromModule(module);
  if (!base) return null;
  const options = backfillPicklistOptionColors(base.options || base.enum || [], 'types', 'organizations');
  return { ...base, options, enum: options };
}

function resolveOrganizationStatusPicklistFieldWithColors(module, fieldKey) {
  const fromApi = module?.fields?.find((f) => f.key === fieldKey) ?? null;
  const fromEdit = editFields.value?.find((f) => f.key === fieldKey) ?? null;
  const base = fromEdit ?? fromApi;
  if (!base) return null;
  const options = backfillPicklistOptionColors(base.options || base.enum || [], fieldKey, 'organizations');
  return { ...base, options, enum: options };
}

function applyPlatformDefaultOrganizationTypes(typesField = null) {
  const defaults = PLATFORM_DEFAULT_ORG_TYPES.map((type) =>
    mapOrganizationTypeEntry({ value: type, enabled: true }, typesField)
  );
  organizationTypes.value = typesField
    ? mergeOrganizationTypesWithCatalog(defaults, typesField)
    : defaults;
}

function ensureOrganizationTypesPopulated(module, tenantOverrides) {
  if (organizationTypes.value.length > 0) return;
  if (
    tenantOverrides?.organizationTypes &&
    Array.isArray(tenantOverrides.organizationTypes)
  ) {
    return;
  }
  const typesField =
    resolveOrganizationsTypesFieldWithColors(module) ?? organizationsTypesFieldRef.value;
  applyPlatformDefaultOrganizationTypes(typesField);
}

async function fetchStatusTypes() {
  if (!isOrganizationsModule.value || !selectedModule.value) {
    console.log('[Status Types] Skipping fetch - module not ready:', { 
      isOrganizationsModule: isOrganizationsModule.value, 
      selectedModule: selectedModule.value?.key 
    });
    return;
  }
  
  // Prevent concurrent fetches
  if (fetchingStatusTypes.value) {
    console.log('[Status Types] Fetch already in progress, skipping...');
    return;
  }
  
  // CRITICAL: Don't refetch if we just saved (within last 2 seconds) to prevent overwriting fresh saves
  const timeSinceLastSave = Date.now() - lastSaveTimestamp.value;
  if (timeSinceLastSave < 2000) {
    console.log('[Status Types] ⚠️ Skipping fetch - just saved', timeSinceLastSave, 'ms ago. Data is fresh.');
    fetchingStatusTypes.value = false;
    return;
  }
  
  fetchingStatusTypes.value = true;
  statusTypesLoading.value = true;
  statusTypesLoadError.value = '';
  console.log('[Status Types] 🔄 STARTING fetchStatusTypes - Stack trace:', new Error().stack);
  try {
    // Step 1: Try to fetch tenant module configuration overrides first
    let tenantOverrides = null;
    try {
      const tenantResponse = await apiClient.get(`/settings/core-modules/organizations/status-types`);
      console.log('[Status Types] 🔍 Tenant override response (FULL):', JSON.stringify(tenantResponse, null, 2));
      if (tenantResponse.success) {
        // Check if data exists (could be null if no override exists, or an object if override exists)
        if (tenantResponse.data !== null && tenantResponse.data !== undefined) {
          tenantOverrides = tenantResponse.data;
          console.log('[Status Types] ✅ Tenant overrides loaded:', {
            hasData: !!tenantOverrides,
            organizationTypes: tenantOverrides?.organizationTypes?.length || 0,
            customerStatus: tenantOverrides?.statusPicklists?.customerStatus?.length || 0,
            partnerStatus: tenantOverrides?.statusPicklists?.partnerStatus?.length || 0,
            vendorStatus: tenantOverrides?.statusPicklists?.vendorStatus?.length || 0
          });
          // Log FULL enabled values from tenant overrides to verify they're being saved/loaded correctly
          if (tenantOverrides?.organizationTypes) {
            console.log('[Status Types] 📊 Tenant override enabled values - organizationTypes:', 
              JSON.stringify(tenantOverrides.organizationTypes.map(t => ({ value: t.value, label: t.label, enabled: t.enabled })), null, 2)
            );
          }
          if (tenantOverrides?.statusPicklists?.customerStatus) {
            console.log('[Status Types] 📊 Tenant override enabled values - customerStatus:', 
              JSON.stringify(tenantOverrides.statusPicklists.customerStatus.map(s => ({ value: s.value, label: s.label, enabled: s.enabled })), null, 2)
            );
          }
          if (tenantOverrides?.statusPicklists?.partnerStatus) {
            console.log('[Status Types] 📊 Tenant override enabled values - partnerStatus:', 
              JSON.stringify(tenantOverrides.statusPicklists.partnerStatus.map(s => ({ value: s.value, label: s.label, enabled: s.enabled })), null, 2)
            );
          }
          if (tenantOverrides?.statusPicklists?.vendorStatus) {
            console.log('[Status Types] 📊 Tenant override enabled values - vendorStatus:', 
              JSON.stringify(tenantOverrides.statusPicklists.vendorStatus.map(s => ({ value: s.value, label: s.label, enabled: s.enabled })), null, 2)
            );
          }
        } else {
          console.log('[Status Types] ⚠️ No tenant override found (response.data is null/undefined), will use defaults');
          tenantOverrides = null;
        }
      } else {
        console.log('[Status Types] ❌ Tenant override request failed:', tenantResponse);
        tenantOverrides = null;
      }
    } catch (tenantErr) {
      // No tenant override exists yet - this is fine, we'll use defaults
      console.log('[Status Types] ⚠️ No tenant override found (error):', tenantErr.message);
      tenantOverrides = null;
    }
    
    // Step 2: Fetch module configuration to get enum metadata (defaults)
    // Try multiple contexts to ensure we get all fields
    // First try with sales context (for app-scoped fields), then fallback to platform
    let module = await fetchModuleDefinitionCached('organizations', { context: 'sales' });
    if (!module) {
      module = await fetchModuleDefinitionCached('organizations', { context: 'platform' });
    }
    
    if (module) {
      organizationsTypesFieldRef.value = resolveOrganizationsTypesFieldWithColors(module);
      statusPicklistFieldsByKey.value = {
        customerStatus: resolveOrganizationStatusPicklistFieldWithColors(module, 'customerStatus'),
        partnerStatus: resolveOrganizationStatusPicklistFieldWithColors(module, 'partnerStatus'),
        vendorStatus: resolveOrganizationStatusPicklistFieldWithColors(module, 'vendorStatus'),
      };

      // Debug: Log all fields to see what we're getting
      console.log('[Status Types] Module fields:', module.fields?.map(f => ({ key: f.key, dataType: f.dataType, options: f.options, enum: f.enum, context: f.context })));
      console.log('[Status Types] Total fields:', module.fields?.length);
      console.log('[Status Types] 🔍 Checking tenant overrides:', {
        hasTenantOverrides: !!tenantOverrides,
        hasOrganizationTypes: !!(tenantOverrides?.organizationTypes),
        organizationTypesIsArray: Array.isArray(tenantOverrides?.organizationTypes),
        organizationTypesLength: tenantOverrides?.organizationTypes?.length || 0,
        hasStatusPicklists: !!(tenantOverrides?.statusPicklists)
      });
      
      // Extract organization types from module fields (types field options/enum)
      // Priority: Use tenant overrides if they exist, otherwise use module defaults
      // CRITICAL: Check if tenantOverrides exists and has organizationTypes array (even if empty)
      if (tenantOverrides && tenantOverrides.organizationTypes && Array.isArray(tenantOverrides.organizationTypes)) {
        // Use tenant overrides directly (they contain all types with enabled state)
        // Even if array is empty, use it (means user disabled everything)
        // This preserves ALL custom types and their enabled states
        console.log('[Status Types] ✅ TENANT OVERRIDES FOUND - Using tenant overrides for organization types:', tenantOverrides.organizationTypes.length, 'types');
        const mappedTypes = tenantOverrides.organizationTypes.map((t) => mapOrganizationTypeEntry(t));
        console.log('[Status Types] ✅ Mapped organization types with enabled states:', JSON.stringify(mappedTypes.map(t => ({ value: t.value, enabled: t.enabled })), null, 2));
        // CRITICAL: Replace entire array to ensure Vue reactivity and prevent any overwrites
        // CRITICAL: Only update if we're not in the middle of a save operation
        if (!savingStatusTypes.value) {
          organizationTypes.value = mergeOrganizationTypesWithCatalog(
            mappedTypes,
            organizationsTypesFieldRef.value
          );
          console.log('[Status Types] ✅ Set organizationTypes.value. Current state:', JSON.stringify(organizationTypes.value.map(t => ({ value: t.value, enabled: t.enabled })), null, 2));
        } else {
          console.log('[Status Types] ⚠️ Skipping organizationTypes update - save in progress');
        }
      } else {
        console.log('[Status Types] ⚠️ NOT using tenant overrides for organizationTypes. Reason:', {
          hasTenantOverrides: !!tenantOverrides,
          hasOrganizationTypes: !!(tenantOverrides?.organizationTypes),
          isArray: Array.isArray(tenantOverrides?.organizationTypes),
          willUseModuleDefaults: true
        });
        // Fallback to module defaults
        const typesField = module.fields?.find(f => f.key === 'types');
        const typesEnum = typesField?.enum || typesField?.options || [];
        if (typesField && typesEnum.length > 0) {
          // Create new array to ensure reactivity
          const newTypes = typesEnum.map((type) =>
            mapOrganizationTypeEntry(
              typeof type === 'object' && type !== null ? { ...type, enabled: true } : { value: type, enabled: true },
              organizationsTypesFieldRef.value
            )
          );
          // Replace the entire array to ensure Vue reactivity
          organizationTypes.value = newTypes;
          console.log('[Status Types] Loaded organization types from module defaults:', newTypes.length);
        } else {
          console.warn('[Status Types] No types field or enum found in module:', { 
            hasTypesField: !!typesField, 
            hasEnum: (typesField?.enum || typesField?.options || []).length > 0,
            typesField: typesField ? { key: typesField.key, dataType: typesField.dataType, options: typesField.options, enum: typesField.enum } : null,
            availableFields: module.fields?.map(f => f.key).slice(0, 20) // Show first 20 field keys
          });
          applyPlatformDefaultOrganizationTypes(
            resolveOrganizationsTypesFieldWithColors(module) ?? typesField
          );
        }
      }
      
      // Extract status picklists from module fields
      // Priority: Use tenant overrides if they exist, otherwise use module defaults
      // CRITICAL: Check if tenantOverrides.statusPicklists exists and has the specific status array
      // We check for array existence, not length, because empty arrays are valid (user removed all)
      if (tenantOverrides && tenantOverrides.statusPicklists && tenantOverrides.statusPicklists.customerStatus && Array.isArray(tenantOverrides.statusPicklists.customerStatus)) {
        // Use tenant overrides directly (even if empty array - means user removed all statuses)
        // This includes ALL custom statuses that were added by the user
        console.log('[Status Types] ✅ TENANT OVERRIDES FOUND - Using tenant overrides for customerStatus:', tenantOverrides.statusPicklists.customerStatus.length, 'statuses');
        const mappedStatuses = tenantOverrides.statusPicklists.customerStatus.map((s) =>
          mapStatusPicklistEntry(s, statusPicklistFieldsByKey.value.customerStatus)
        );
        console.log('[Status Types] ✅ Mapped customerStatus with enabled states:', JSON.stringify(mappedStatuses.map(s => ({ value: s.value, enabled: s.enabled })), null, 2));
        // CRITICAL: Replace entire array to ensure Vue reactivity and preserve all custom values
        // Use spread operator to create new array reference
        // CRITICAL: Only update if we're not in the middle of a save operation
        if (!savingStatusTypes.value) {
          statusPicklists.value.customerStatus = mergeStatusPicklistWithCatalog(
            mappedStatuses,
            statusPicklistFieldsByKey.value.customerStatus
          );
          console.log('[Status Types] ✅ Set customerStatus.value. Current state:', JSON.stringify(statusPicklists.value.customerStatus.map(s => ({ value: s.value, enabled: s.enabled })), null, 2));
        } else {
          console.log('[Status Types] ⚠️ Skipping customerStatus update - save in progress');
        }
      } else {
        console.log('[Status Types] ⚠️ NOT using tenant overrides for customerStatus. Reason:', {
          hasTenantOverrides: !!tenantOverrides,
          hasStatusPicklists: !!(tenantOverrides?.statusPicklists),
          hasCustomerStatus: !!(tenantOverrides?.statusPicklists?.customerStatus),
          isArray: Array.isArray(tenantOverrides?.statusPicklists?.customerStatus),
          willUseModuleDefaults: true
        });
        // Fallback to module defaults
        const customerStatusField = module.fields?.find(f => f.key === 'customerStatus');
        const customerStatusEnum = customerStatusField?.enum || customerStatusField?.options || [];
        if (customerStatusField && customerStatusEnum.length > 0) {
          const newCustomerStatuses = customerStatusEnum.map((status) =>
            mapStatusPicklistEntry(
              typeof status === 'object' && status !== null ? { ...status, enabled: true } : { value: status, enabled: true },
              statusPicklistFieldsByKey.value.customerStatus
            )
          );
          // Replace the entire array to ensure Vue reactivity
          statusPicklists.value.customerStatus = newCustomerStatuses;
          console.log('[Status Types] Loaded customer status from module defaults:', newCustomerStatuses.length);
        } else {
          console.warn('[Status Types] No customerStatus field or enum found');
          applyDefaultOrganizationStatusPicklist('customerStatus');
        }
      }
      
      // Partner Status
      if (tenantOverrides && tenantOverrides.statusPicklists && tenantOverrides.statusPicklists.partnerStatus && Array.isArray(tenantOverrides.statusPicklists.partnerStatus)) {
        // Use tenant overrides directly (even if empty array)
        // This includes ALL custom statuses that were added by the user
        console.log('[Status Types] ✅ TENANT OVERRIDES FOUND - Using tenant overrides for partnerStatus:', tenantOverrides.statusPicklists.partnerStatus.length, 'statuses');
        const mappedStatuses = tenantOverrides.statusPicklists.partnerStatus.map((s) =>
          mapStatusPicklistEntry(s, statusPicklistFieldsByKey.value.partnerStatus)
        );
        console.log('[Status Types] ✅ Mapped partnerStatus with enabled states:', JSON.stringify(mappedStatuses.map(s => ({ value: s.value, enabled: s.enabled })), null, 2));
        // CRITICAL: Replace entire array to ensure Vue reactivity and preserve all custom values
        // Use spread operator to create new array reference
        // CRITICAL: Only update if we're not in the middle of a save operation
        if (!savingStatusTypes.value) {
          statusPicklists.value.partnerStatus = mergeStatusPicklistWithCatalog(
            mappedStatuses,
            statusPicklistFieldsByKey.value.partnerStatus
          );
          console.log('[Status Types] ✅ Set partnerStatus.value. Current state:', JSON.stringify(statusPicklists.value.partnerStatus.map(s => ({ value: s.value, enabled: s.enabled })), null, 2));
        } else {
          console.log('[Status Types] ⚠️ Skipping partnerStatus update - save in progress');
        }
      } else {
        console.log('[Status Types] ⚠️ NOT using tenant overrides for partnerStatus. Reason:', {
          hasTenantOverrides: !!tenantOverrides,
          hasStatusPicklists: !!(tenantOverrides?.statusPicklists),
          hasPartnerStatus: !!(tenantOverrides?.statusPicklists?.partnerStatus),
          isArray: Array.isArray(tenantOverrides?.statusPicklists?.partnerStatus),
          willUseModuleDefaults: true
        });
        // Fallback to module defaults
        const partnerStatusField = module.fields?.find(f => f.key === 'partnerStatus');
        const partnerStatusEnum = partnerStatusField?.enum || partnerStatusField?.options || [];
        if (partnerStatusField && partnerStatusEnum.length > 0) {
          const newPartnerStatuses = partnerStatusEnum.map((status) =>
            mapStatusPicklistEntry(
              typeof status === 'object' && status !== null ? { ...status, enabled: true } : { value: status, enabled: true },
              statusPicklistFieldsByKey.value.partnerStatus
            )
          );
          // Replace the entire array to ensure Vue reactivity
          statusPicklists.value.partnerStatus = newPartnerStatuses;
          console.log('[Status Types] Loaded partner status from module defaults:', newPartnerStatuses.length);
        } else {
          console.warn('[Status Types] No partnerStatus field or enum found');
          applyDefaultOrganizationStatusPicklist('partnerStatus');
        }
      }
      
      // Vendor Status
      if (tenantOverrides && tenantOverrides.statusPicklists && tenantOverrides.statusPicklists.vendorStatus && Array.isArray(tenantOverrides.statusPicklists.vendorStatus)) {
        // Use tenant overrides directly (even if empty array)
        // This includes ALL custom statuses that were added by the user
        console.log('[Status Types] ✅ TENANT OVERRIDES FOUND - Using tenant overrides for vendorStatus:', tenantOverrides.statusPicklists.vendorStatus.length, 'statuses');
        const mappedStatuses = tenantOverrides.statusPicklists.vendorStatus.map((s) =>
          mapStatusPicklistEntry(s, statusPicklistFieldsByKey.value.vendorStatus)
        );
        console.log('[Status Types] ✅ Mapped vendorStatus with enabled states:', JSON.stringify(mappedStatuses.map(s => ({ value: s.value, enabled: s.enabled })), null, 2));
        // CRITICAL: Replace entire array to ensure Vue reactivity and preserve all custom values
        // Use spread operator to create new array reference
        // CRITICAL: Only update if we're not in the middle of a save operation
        if (!savingStatusTypes.value) {
          statusPicklists.value.vendorStatus = mergeStatusPicklistWithCatalog(
            mappedStatuses,
            statusPicklistFieldsByKey.value.vendorStatus
          );
          console.log('[Status Types] ✅ Set vendorStatus.value. Current state:', JSON.stringify(statusPicklists.value.vendorStatus.map(s => ({ value: s.value, enabled: s.enabled })), null, 2));
        } else {
          console.log('[Status Types] ⚠️ Skipping vendorStatus update - save in progress');
        }
      } else {
        console.log('[Status Types] ⚠️ NOT using tenant overrides for vendorStatus. Reason:', {
          hasTenantOverrides: !!tenantOverrides,
          hasStatusPicklists: !!(tenantOverrides?.statusPicklists),
          hasVendorStatus: !!(tenantOverrides?.statusPicklists?.vendorStatus),
          isArray: Array.isArray(tenantOverrides?.statusPicklists?.vendorStatus),
          willUseModuleDefaults: true
        });
        // Fallback to module defaults
        const vendorStatusField = module.fields?.find(f => f.key === 'vendorStatus');
        const vendorStatusEnum = vendorStatusField?.enum || vendorStatusField?.options || [];
        if (vendorStatusField && vendorStatusEnum.length > 0) {
          const newVendorStatuses = vendorStatusEnum.map((status) =>
            mapStatusPicklistEntry(
              typeof status === 'object' && status !== null ? { ...status, enabled: true } : { value: status, enabled: true },
              statusPicklistFieldsByKey.value.vendorStatus
            )
          );
          // Replace the entire array to ensure Vue reactivity
          statusPicklists.value.vendorStatus = newVendorStatuses;
          console.log('[Status Types] Loaded vendor status from module defaults:', newVendorStatuses.length);
        } else {
          console.warn('[Status Types] No vendorStatus field or enum found');
          applyDefaultOrganizationStatusPicklist('vendorStatus');
        }
      }
      
      // Save snapshot for dirty checking
      // This snapshot is used to detect changes, so it must match the exact structure we save
      const snapshotData = {
        organizationTypes: organizationTypes.value.map(serializeOrganizationTypeEntryForSnapshot),
        statusPicklists: {
          customerStatus: statusPicklists.value.customerStatus.map(serializeStatusPicklistEntry),
          partnerStatus: statusPicklists.value.partnerStatus.map(serializeStatusPicklistEntry),
          vendorStatus: statusPicklists.value.vendorStatus.map(serializeStatusPicklistEntry),
        },
      };
      statusTypesOriginalSnapshot.value = JSON.stringify(snapshotData);
      
      console.log('[Status Types] Snapshot saved:', {
        organizationTypes: organizationTypes.value.length,
        customerStatus: statusPicklists.value.customerStatus.length,
        partnerStatus: statusPicklists.value.partnerStatus.length,
        vendorStatus: statusPicklists.value.vendorStatus.length,
        snapshotEnabledValues: {
          orgTypes: snapshotData.organizationTypes.map(t => ({ value: t.value, enabled: t.enabled })),
          customerStatus: snapshotData.statusPicklists.customerStatus.map(s => ({ value: s.value, enabled: s.enabled }))
        }
      });
      
      // Mark initial load as complete after a short delay to prevent watch from triggering
      // Use a longer delay to ensure all reactive updates have settled
      // Store timeout ID to prevent multiple timeouts
      if (window.statusTypesLoadTimeout) {
        clearTimeout(window.statusTypesLoadTimeout);
      }
      window.statusTypesLoadTimeout = setTimeout(() => {
        // Double-check that data is still there before clearing the flag
        if (organizationTypes.value.length > 0 || 
            statusPicklists.value.customerStatus.length > 0 ||
            statusPicklists.value.partnerStatus.length > 0 ||
            statusPicklists.value.vendorStatus.length > 0) {
          // Only clear if not already cleared
          if (isInitialLoad.value) {
            isInitialLoad.value = false;
            console.log('[Status Types] ✅ Initial load flag cleared. Final state:', JSON.stringify({
              organizationTypes: organizationTypes.value.map(t => ({ value: t.value, enabled: t.enabled })),
              customerStatus: statusPicklists.value.customerStatus.map(s => ({ value: s.value, enabled: s.enabled })),
              partnerStatus: statusPicklists.value.partnerStatus.map(s => ({ value: s.value, enabled: s.enabled })),
              vendorStatus: statusPicklists.value.vendorStatus.map(s => ({ value: s.value, enabled: s.enabled }))
            }, null, 2));
          }
        } else {
          console.warn('[Status Types] Data appears empty after load, keeping initial load flag active');
        }
        window.statusTypesLoadTimeout = null;
      }, 500); // Increased delay to ensure all updates settle
      
      console.log('[Status Types] ✅ Fetch completed. Final counts:', {
        organizationTypesCount: organizationTypes.value.length,
        customerStatusCount: statusPicklists.value.customerStatus.length,
        partnerStatusCount: statusPicklists.value.partnerStatus.length,
        vendorStatusCount: statusPicklists.value.vendorStatus.length
      });
      console.log('[Status Types] ✅ Fetch completed. Final enabled states:', JSON.stringify({
        organizationTypes: organizationTypes.value.map(t => ({ value: t.value, enabled: t.enabled })),
        customerStatus: statusPicklists.value.customerStatus.map(s => ({ value: s.value, enabled: s.enabled })),
        partnerStatus: statusPicklists.value.partnerStatus.map(s => ({ value: s.value, enabled: s.enabled })),
        vendorStatus: statusPicklists.value.vendorStatus.map(s => ({ value: s.value, enabled: s.enabled }))
      }, null, 2));
      ensureOrganizationTypesPopulated(module, tenantOverrides);
    } else {
      // Module fetch failed - only use hardcoded defaults if we don't have tenant overrides
      if (tenantOverrides && (
        (tenantOverrides.organizationTypes && tenantOverrides.organizationTypes.length > 0) ||
        (tenantOverrides.statusPicklists && (
          (tenantOverrides.statusPicklists.customerStatus && tenantOverrides.statusPicklists.customerStatus.length > 0) ||
          (tenantOverrides.statusPicklists.partnerStatus && tenantOverrides.statusPicklists.partnerStatus.length > 0) ||
          (tenantOverrides.statusPicklists.vendorStatus && tenantOverrides.statusPicklists.vendorStatus.length > 0)
        ))
      )) {
        // We have tenant overrides, use them even if module fetch failed
        console.log('[Status Types] Module fetch failed but tenant overrides exist, using tenant overrides');
        // Apply tenant overrides (same logic as above)
        if (tenantOverrides.organizationTypes && Array.isArray(tenantOverrides.organizationTypes)) {
          organizationTypes.value = tenantOverrides.organizationTypes.map((t) => mapOrganizationTypeEntry(t));
        }
        if (tenantOverrides.statusPicklists) {
          if (tenantOverrides.statusPicklists.customerStatus && Array.isArray(tenantOverrides.statusPicklists.customerStatus)) {
            statusPicklists.value.customerStatus = tenantOverrides.statusPicklists.customerStatus.map((s) =>
              mapStatusPicklistEntry(s, statusPicklistFieldsByKey.value.customerStatus)
            );
          }
          if (tenantOverrides.statusPicklists.partnerStatus && Array.isArray(tenantOverrides.statusPicklists.partnerStatus)) {
            statusPicklists.value.partnerStatus = tenantOverrides.statusPicklists.partnerStatus.map((s) =>
              mapStatusPicklistEntry(s, statusPicklistFieldsByKey.value.partnerStatus)
            );
          }
          if (tenantOverrides.statusPicklists.vendorStatus && Array.isArray(tenantOverrides.statusPicklists.vendorStatus)) {
            statusPicklists.value.vendorStatus = tenantOverrides.statusPicklists.vendorStatus.map((s) =>
              mapStatusPicklistEntry(s, statusPicklistFieldsByKey.value.vendorStatus)
            );
          }
        }
        // Save snapshot
        const snapshotData = {
          organizationTypes: organizationTypes.value.map(serializeOrganizationTypeEntryForSnapshot),
          statusPicklists: {
            customerStatus: statusPicklists.value.customerStatus.map(serializeStatusPicklistEntry),
            partnerStatus: statusPicklists.value.partnerStatus.map(serializeStatusPicklistEntry),
            vendorStatus: statusPicklists.value.vendorStatus.map(serializeStatusPicklistEntry),
          },
        };
        statusTypesOriginalSnapshot.value = JSON.stringify(snapshotData);
        setTimeout(() => {
          isInitialLoad.value = false;
        }, 500);
      } else {
        // No tenant overrides, use hardcoded defaults
        console.warn('[Status Types] Module response was empty or invalid - using hardcoded defaults');
        organizationTypes.value = ['Customer', 'Partner', 'Vendor'].map((type) =>
          mapOrganizationTypeEntry({ value: type, enabled: true })
        );
        applyPlatformDefaultOrganizationStatusPicklists();
        // Save snapshot for dirty checking
        const snapshotData = {
          organizationTypes: organizationTypes.value.map(serializeOrganizationTypeEntryForSnapshot),
          statusPicklists: {
            customerStatus: statusPicklists.value.customerStatus.map(serializeStatusPicklistEntry),
            partnerStatus: statusPicklists.value.partnerStatus.map(serializeStatusPicklistEntry),
            vendorStatus: statusPicklists.value.vendorStatus.map(serializeStatusPicklistEntry),
          },
        };
        statusTypesOriginalSnapshot.value = JSON.stringify(snapshotData);
        
        // Mark initial load as complete
        setTimeout(() => {
          isInitialLoad.value = false;
        }, 500);
      }
    }
  } catch (err) {
    console.error('[Status Types] Failed to fetch status types:', err);
    statusTypesLoadError.value = err?.message || String(err);
    if (organizationTypes.value.length === 0) {
      applyPlatformDefaultOrganizationTypes(organizationsTypesFieldRef.value);
    }
  } finally {
    // Ensure display labels are plain strings (module options may be { value, color } objects)
    if (organizationTypes.value.length > 0) {
      organizationTypes.value = organizationTypes.value.map((t) => mapOrganizationTypeEntry(t));
    }
    for (const key of ['customerStatus', 'partnerStatus', 'vendorStatus']) {
      if (statusPicklists.value[key]?.length > 0) {
        statusPicklists.value[key] = statusPicklists.value[key].map((s) =>
          mapStatusPicklistEntry(s, statusPicklistFieldsByKey.value[key])
        );
      }
    }
    fetchingStatusTypes.value = false;
    statusTypesLoading.value = false;
  }
}

// Save status types and organization types to tenant module configuration
async function saveStatusTypes() {
  if (!isOrganizationsModule.value || !selectedModule.value || savingStatusTypes.value) return;
  
  savingStatusTypes.value = true;
  try {
    // Prepare payload for tenant module configuration
    const payload = {
      organizationTypes: organizationTypes.value.map(serializeOrganizationTypeEntry),
      statusPicklists: {
        customerStatus: statusPicklists.value.customerStatus.map(serializeStatusPicklistEntry),
        partnerStatus: statusPicklists.value.partnerStatus.map(serializeStatusPicklistEntry),
        vendorStatus: statusPicklists.value.vendorStatus.map(serializeStatusPicklistEntry),
      },
    };
    
    console.log('[Status Types] 💾 Payload enabled values:', JSON.stringify({
      organizationTypes: payload.organizationTypes.map(t => ({ value: t.value, label: t.label, enabled: t.enabled })),
      customerStatus: payload.statusPicklists.customerStatus.map(s => ({ value: s.value, label: s.label, enabled: s.enabled })),
      partnerStatus: payload.statusPicklists.partnerStatus.map(s => ({ value: s.value, label: s.label, enabled: s.enabled })),
      vendorStatus: payload.statusPicklists.vendorStatus.map(s => ({ value: s.value, label: s.label, enabled: s.enabled }))
    }, null, 2));
    
    // Save to tenant module configuration endpoint
    // Note: This should be a PATCH to /settings/core-modules/organizations/status-types
    // or similar endpoint that persists to TenantModuleConfiguration
    console.log('[Status Types] 💾 Saving payload (FULL):', JSON.stringify(payload, null, 2));
    const response = await apiClient.patch(`/settings/core-modules/organizations/status-types`, payload);
    console.log('[Status Types] 💾 Save response (FULL):', JSON.stringify(response, null, 2));
    
    if (response && response.success) {
      // Update snapshot after successful save to prevent unnecessary re-saves
      // Normalize the snapshot to match the exact structure used in statusTypesDirty comparison
      // This ensures the snapshot matches what we're comparing against
      const savedData = {
        organizationTypes: (response.data?.organizationTypes || organizationTypes.value).map(
          serializeOrganizationTypeEntryForSnapshot
        ),
        statusPicklists: {
          customerStatus: (
            response.data?.statusPicklists?.customerStatus || statusPicklists.value.customerStatus
          ).map(serializeStatusPicklistEntry),
          partnerStatus: (
            response.data?.statusPicklists?.partnerStatus || statusPicklists.value.partnerStatus
          ).map(serializeStatusPicklistEntry),
          vendorStatus: (
            response.data?.statusPicklists?.vendorStatus || statusPicklists.value.vendorStatus
          ).map(serializeStatusPicklistEntry),
        },
      };
      // Refresh UI rows with normalized labels (fixes corrupted object values from older saves)
      organizationTypes.value = organizationTypes.value.map((t) => mapOrganizationTypeEntry(t));
      statusPicklists.value.customerStatus = statusPicklists.value.customerStatus.map((s) =>
        mapStatusPicklistEntry(s, statusPicklistFieldsByKey.value.customerStatus)
      );
      statusPicklists.value.partnerStatus = statusPicklists.value.partnerStatus.map((s) =>
        mapStatusPicklistEntry(s, statusPicklistFieldsByKey.value.partnerStatus)
      );
      statusPicklists.value.vendorStatus = statusPicklists.value.vendorStatus.map((s) =>
        mapStatusPicklistEntry(s, statusPicklistFieldsByKey.value.vendorStatus)
      );
      statusTypesOriginalSnapshot.value = JSON.stringify(savedData);
      lastSaveTimestamp.value = Date.now(); // Mark when we saved to prevent immediate refetch
      invalidateOrganizationTypesCache();
      console.log('[Status Types] ✅ Save successful, snapshot updated with normalized saved data:', JSON.stringify({
        organizationTypes: savedData.organizationTypes.map(t => ({ value: t.value, enabled: t.enabled })),
        customerStatus: savedData.statusPicklists.customerStatus.map(s => ({ value: s.value, enabled: s.enabled })),
        partnerStatus: savedData.statusPicklists.partnerStatus.map(s => ({ value: s.value, enabled: s.enabled })),
        vendorStatus: savedData.statusPicklists.vendorStatus.map(s => ({ value: s.value, enabled: s.enabled }))
      }, null, 2));
      console.log('[Status Types] ✅ Save timestamp recorded:', lastSaveTimestamp.value, '- future fetches within 2s will be skipped');
    } else {
      const errorMsg = response?.message || response?.error || 'Failed to save status types';
      console.error('[Status Types] Save failed:', errorMsg, response);
      throw new Error(errorMsg);
    }
  } catch (err) {
    console.error('Failed to save status types:', err);
    notifications.error(err.message || t('settings.modFieldsErrStatusTypesSaveFailed'));
  } finally {
    savingStatusTypes.value = false;
  }
}

// Watch for module and tab changes (items status-types snapshot, events status snapshot)
let watchDebounceTimer = null;
watch(() => [selectedModule.value?.key, activeTopTab.value], async ([moduleKey, tab]) => {
  // Debounce watch to prevent multiple rapid triggers
  if (watchDebounceTimer) {
    clearTimeout(watchDebounceTimer);
  }
  
  watchDebounceTimer = setTimeout(async () => {
    if (moduleKey === 'events' && tab === 'status') {
      // Initialize event status snapshot when status tab is opened
      // ARCHITECTURE NOTE: Event statuses are system-locked, but we initialize the snapshot for consistency.
      // See: docs/architecture/event-settings.md Section 8.1
      await nextTick();
      initializeEventStatusSnapshot();
    }
    
    // Initialize item status/types when switching to items status-types tab
    if (moduleKey === 'items' && tab === 'status-types') {
      // Initialize snapshot with current values
      const snapshotData = {
        itemTypes: itemTypes.value.map(t => ({
          value: t.value,
          label: t.label,
          enabled: t.enabled !== undefined ? t.enabled : true
        })),
        status: itemStatusPicklist.value.map(s => ({
          value: s.value,
          label: s.label || s.value,
          enabled: s.enabled !== undefined ? s.enabled : true
        }))
      };
      itemStatusTypesOriginalSnapshot.value = JSON.stringify(snapshotData);
    }
  }, 100); // Small debounce to prevent rapid triggers
}, { immediate: true });

onMounted(async () => {
  await fetchModules();
  
  // After modules are loaded, if we're on the items status-types tab, initialize snapshot
  if (selectedModule.value?.key === 'items' && activeTopTab.value === 'status-types') {
    await nextTick();
    // Initialize snapshot with current values
    const snapshotData = {
      itemTypes: itemTypes.value.map(t => ({
        value: t.value,
        label: t.label,
        enabled: t.enabled !== undefined ? t.enabled : true
      })),
      status: itemStatusPicklist.value.map(s => ({
        value: s.value,
        label: s.label || s.value,
        enabled: s.enabled !== undefined ? s.enabled : true
      }))
    };
    itemStatusTypesOriginalSnapshot.value = JSON.stringify(snapshotData);
    itemStatusTypesDirty.value = false;
  }
  
  // After modules are loaded, if we're on the events status tab, initialize snapshot
  // ARCHITECTURE NOTE: Event statuses are system-locked, but we initialize the snapshot for consistency.
  // See: docs/architecture/event-settings.md Section 2.2
  if (selectedModule.value?.key === 'events' && activeTopTab.value === 'status') {
    await nextTick();
    initializeEventStatusSnapshot();
  }
  
  // Close dependency dropdowns when clicking outside.
  // Use capture phase so nested @click.stop handlers don't block this.
  document.addEventListener('pointerdown', handleDependencyDropdownOutsidePointerDown, true);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleDependencyDropdownOutsidePointerDown, true);
});

// Keep activeTopTab in sync with URL (route is source of truth). Fixes mismatch when
// parent remounts due to :key="$route.fullPath" (e.g. PlatformShell) — URL can say
// mode=relationships while the new instance had initialized with wrong/stale tab.
watch(
  () => [route.query.mode, selectedModule.value?.key],
  ([modeKey]) => {
    if (typeof modeKey !== 'string') return;
    const mod = selectedModule.value;
    if (!mod) return;
    const resolvedMode = mod.key === 'organizations' ? resolveOrganizationsTopTab(modeKey) : modeKey;
    const allowed = getAllowedTopTabs(mod.key);
    if (!allowed.includes(resolvedMode)) return;
    if (activeTopTab.value === resolvedMode) return;
    activeTopTab.value = resolvedMode;
    if (resolvedMode !== modeKey) {
      router.replace({
        query: {
          ...route.query,
          module: mod.key,
          field: editFields.value[selectedFieldIdx.value]?.key || '',
          mode: resolvedMode,
          subtab: activeSubTab.value,
        },
      });
    }
  },
  { immediate: true }
);

// Persist top tab: only revert invalid tabs and sync localStorage for programmatic changes.
// Do NOT call router.replace here for valid tab changes — setActiveTopTab already updates
// the URL on click. Watcher-driven router.replace caused double-click and random-tab bugs.
watch(activeTopTab, (v, oldValue) => {
  const mod = selectedModule.value;
  if (!mod) return;
  const allowedTabs = getAllowedTopTabs(mod.key);
  if (!allowedTabs.includes(v)) {
    const fallback = allowedTabs.includes(oldValue) ? oldValue : (allowedTabs[0] || 'fields');
    if (fallback !== v) {
      activeTopTab.value = fallback;
      router.replace({ query: { ...route.query, module: mod.key, field: editFields.value[selectedFieldIdx.value]?.key || '', mode: fallback, subtab: activeSubTab.value } });
    }
    return;
  }
  if (v !== oldValue && oldValue !== undefined) {
    try {
      localStorage.setItem(`arivu-modfields-tab-${mod.key}`, v);
    } catch (e) {}
  }
}, { immediate: false });

watch(activeSubTab, (v) => {
  const mod = selectedModule.value;
  if (!mod) return;
  router.replace({ query: { ...route.query, subtab: v } });
});

// Sync activeSubTab from URL when route.query.subtab changes (e.g. after remount due to :key="fullPath", or back/forward).
// Use route.query.mode so we sync even on first load/remount when selectedModule/activeTopTab aren't set yet (fetchModules still running).
watch(
  () => [route.query.subtab, route.query.mode],
  ([subKey, modeKey]) => {
    const onFieldsConfig = modeKey === 'fields' || activeTopTab.value === 'fields';
    if (!onFieldsConfig) return;
    const validSubTabs = ['general', 'validations', 'dependencies'];
    if (typeof subKey === 'string' && validSubTabs.includes(subKey) && activeSubTab.value !== subKey) {
      activeSubTab.value = subKey;
    }
  },
  { immediate: true }
);

// Persist quick mode to URL
watch(selectedPipelineKey, () => {
  stageSettingsExpanded.value = {};
});

watch(currentPipeline, (pipeline) => {
  stageSettingsExpanded.value = {};
  if (!actionModalState.open) return;
  const stage = actionModalStage.value;
  const action = actionModalAction.value;
  if (!pipeline || !stage || !action) {
    closeActionModal();
  }
});

watch([actionModalStage, actionModalAction], ([stage, action]) => {
  if (!actionModalState.open) return;
  if (!stage || !action) {
    closeActionModal();
  }
});

watch(quickMode, (v) => {
  const mod = selectedModule.value;
  if (!mod) return;
  router.replace({ query: { ...route.query, quickMode: v } });
});

const stageDragSource = ref({ pipelineKey: '', index: null });
const stageDragOver = ref({ pipelineKey: '', index: null });

function resetStageDrag() {
  stageDragSource.value = { pipelineKey: '', index: null };
  stageDragOver.value = { pipelineKey: '', index: null };
}

function onStageDragStart(pipelineKey, stageIndex, event) {
  stageDragSource.value = { pipelineKey, index: stageIndex };
  stageDragOver.value = { pipelineKey, index: stageIndex };
  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `${pipelineKey}:${stageIndex}`);
  }
}

function onStageDragOver(pipelineKey, stageIndex) {
  if (stageDragSource.value.pipelineKey !== pipelineKey) return;
  stageDragOver.value = { pipelineKey, index: stageIndex };
}

function onStageDrop(pipelineKey, stageIndex) {
  const source = stageDragSource.value;
  if (source.pipelineKey !== pipelineKey || source.index === null) {
    resetStageDrag();
    return;
  }
  const pipeline = pipelineSettings.value.find(p => p.key === pipelineKey);
  if (!pipeline) {
    resetStageDrag();
    return;
  }
  const from = source.index;
  let to = stageIndex;
  if (to > pipeline.stages.length) to = pipeline.stages.length;
  if (from === to) {
    resetStageDrag();
    return;
  }
  const [stage] = pipeline.stages.splice(from, 1);
  if (to > pipeline.stages.length) {
    to = pipeline.stages.length;
  }
  if (from < to) {
    to -= 1;
  }
  pipeline.stages.splice(to, 0, stage);
  pipeline.stages.forEach((s, idx) => (s.order = idx));
  resetStageDrag();
}

function onStageListDragOver(pipelineKey) {
  if (stageDragSource.value.pipelineKey !== pipelineKey) return;
  stageDragOver.value = { pipelineKey, index: pipelineSettings.value.find(p => p.key === pipelineKey)?.stages.length ?? 0 };
}

function onStageListDrop(pipelineKey) {
  const pipeline = pipelineSettings.value.find(p => p.key === pipelineKey);
  if (!pipeline) {
    resetStageDrag();
    return;
  }
  onStageDrop(pipelineKey, pipeline.stages.length);
}

defineExpose({ openCreateModal, selectedModule, clearSelection });
</script>
