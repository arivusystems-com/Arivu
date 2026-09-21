<template>
  <TransitionRoot as="template" :show="open">
    <Dialog class="relative z-50" @close="handleDialogClose">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <TransitionChild
              as="template"
              enter="transform transition ease-in-out duration-300 sm:duration-300"
              enter-from="translate-x-full"
              enter-to="translate-x-0"
              leave="transform transition ease-in-out duration-300 sm:duration-300"
              leave-from="translate-x-0"
              leave-to="translate-x-full"
            >
              <div class="pointer-events-auto h-full flex">
                <DialogPanel
                  class="rounded-tl-xl overflow-hidden flex h-full flex-col bg-white dark:bg-gray-800 shadow-xl max-w-[95vw] w-[min(92vw,56rem)]"
                >
                  <form @submit.prevent="handleSubmit" class="rounded-none relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700">
                    <!-- Header; system roles use in-body notices -->
                    <div class="flex-shrink-0 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-5 sm:px-6">
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex items-start gap-3 min-w-0">
                          <div
                            :style="{ backgroundColor: form.color || '#6366f1' }"
                            class="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg flex-shrink-0"
                          >
                            <component :is="roleIconComponent" class="w-5 h-5" aria-hidden="true" />
                          </div>
                          <div class="min-w-0">
                            <DialogTitle class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white truncate">
                              {{ isEditing ? (form.name || t('settings.roleDrawerEdit')) : t('settings.roleDrawerCreate') }}
                            </DialogTitle>
                            <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                              {{ headerSubtitle }}
                            </p>
                            <div
                              v-if="isSystemRole"
                              class="mt-2 inline-flex items-center gap-1.5 rounded-md bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300"
                            >
                              <LockClosedIcon class="w-3.5 h-3.5 shrink-0" />
                              {{ t('settings.roleDrawerSystemLocked') }}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          class="relative rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer flex-shrink-0"
                          @click="requestClose"
                        >
                          <span class="absolute -inset-2.5" />
                          <span class="sr-only">{{ t('common.closePanel') }}</span>
                          <XMarkIcon class="size-6" aria-hidden="true" />
                        </button>
                      </div>

                      <nav class="mt-4 flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1" :aria-label="t('settings.roleDrawerNavAria')">
                        <button
                          v-for="tab in editorTabs"
                          :key="tab.id"
                          type="button"
                          :class="[
                            activeTab === tab.id
                              ? 'bg-white text-indigo-700 shadow-sm dark:bg-gray-900 dark:text-indigo-300'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/70 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700/60',
                            'flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors'
                          ]"
                          @click="activeTab = tab.id"
                        >
                          {{ tab.label }}
                        </button>
                      </nav>
                    </div>

                    <!-- Body -->
                    <div class="h-0 flex-1 overflow-y-auto">
                      <div class="px-4 sm:px-6 py-6">
                        <!-- General -->
                        <div v-show="activeTab === 'general'" class="space-y-6">
                          <div
                            v-if="isSystemRole"
                            class="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/25 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
                          >
                            <p class="font-medium">{{ t('settings.roleDrawerSystemNoticeTitle') }}</p>
                            <p class="mt-1 text-xs text-amber-800 dark:text-amber-200/90">
                              {{ t('settings.roleDrawerSystemNoticeBody') }}
                            </p>
                          </div>

                          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div class="space-y-1 sm:col-span-2">
                              <label for="role-name" class="block text-sm font-medium text-gray-900 dark:text-white">
                                {{ t('settings.roleDrawerRoleName') }} <span class="text-red-500">*</span>
                              </label>
                              <input
                                id="role-name"
                                v-model="form.name"
                                type="text"
                                required
                                :disabled="isSystemRole"
                                :placeholder="t('settings.roleDrawerRoleNamePh')"
                                class="block w-full rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2.5 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                            </div>
                            <div class="space-y-1 sm:col-span-2">
                              <label for="role-desc" class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.roleDrawerDescription') }}</label>
                              <textarea
                                id="role-desc"
                                v-model="form.description"
                                rows="2"
                                :placeholder="t('settings.roleDrawerDescriptionPh')"
                                class="block w-full rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2.5 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                              />
                            </div>
                            <div class="space-y-1">
                              <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.roleDrawerHierarchy') }}</label>
                              <HeadlessSelect
                                id="role-parent"
                                v-model="form.parentRole"
                                :options="parentRoleOptions"
                                allow-empty
                                :empty-label="t('settings.roleDrawerParentNone')"
                                :placeholder="t('settings.roleDrawerParentNone')"
                                :button-class="drawerSelectButtonClass"
                                teleport
                              />
                            </div>
                            <div v-if="rbacV2" class="space-y-1">
                              <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.roleDrawerUserType') }}</label>
                              <HeadlessSelect
                                v-model="form.userType"
                                :options="userTypeOptions"
                                :disabled="isSystemRole"
                                :button-class="drawerSelectButtonClass"
                                teleport
                              />
                            </div>
                          </div>

                          <div
                            v-if="rbacV2"
                            class="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/30 p-4 space-y-3"
                          >
                            <div>
                              <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.roleDrawerProfileCardTitle') }}</p>
                              <p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{{ t('settings.roleDrawerProfileCardHint') }}</p>
                            </div>
                            <HeadlessSelect
                              v-model="form.privilegeMode"
                              :options="privilegeModeOptions"
                              :disabled="isSystemRole"
                              :button-class="drawerSelectButtonClass"
                              teleport
                            />
                            <div v-if="form.privilegeMode === 'profile'" class="space-y-1">
                              <HeadlessSelect
                                v-model="form.profileId"
                                :options="profileSelectOptions"
                                allow-empty
                                :empty-label="t('settings.roleDrawerProfileNone')"
                                :disabled="isSystemRole"
                                :button-class="drawerSelectButtonClass"
                                teleport
                              />
                            </div>
                          </div>

                          <details class="rounded-xl border border-gray-200 dark:border-gray-700 group">
                            <summary class="cursor-pointer list-none px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/30 rounded-xl">
                              {{ t('settings.roleDrawerAppearanceOptional') }}
                            </summary>
                            <div class="px-4 pb-4 pt-1 grid grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-700">
                              <div class="space-y-2">
                                <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.roleDrawerColor') }}</label>
                                <div class="flex flex-wrap gap-2">
                                  <button
                                    v-for="preset in colorPresets"
                                    :key="preset"
                                    type="button"
                                    :style="{ backgroundColor: preset }"
                                    :class="[
                                      'w-8 h-8 rounded-lg ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 transition-all',
                                      form.color === preset ? 'ring-indigo-500 scale-110' : 'ring-transparent hover:ring-gray-300 dark:hover:ring-gray-600'
                                    ]"
                                    :aria-label="t('settings.roleDrawerColorAria', { color: preset })"
                                    @click="form.color = preset"
                                  />
                                </div>
                              </div>
                              <div class="space-y-2">
                                <label for="role-icon" class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.roleDrawerIcon') }}</label>
                                <HeadlessSelect id="role-icon" v-model="form.icon" :options="iconOptions" :button-class="drawerSelectButtonClass" teleport />
                              </div>
                            </div>
                          </details>
                        </div>

                        <!-- Access -->
                        <div v-show="activeTab === 'access'" class="space-y-6">
                          <!-- Step 1: App access -->
                          <section v-if="rbacV2" class="space-y-3">
                            <div>
                              <p class="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                {{ t('settings.roleDrawerAccessStepApps') }}
                              </p>
                              <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                {{ t('settings.roleDrawerAppsIntro') }}
                              </p>
                            </div>
                            <div
                              v-if="appCapabilities.length === 0"
                              class="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-4 py-8 text-center text-sm text-gray-500"
                            >
                              {{ t('settings.roleDrawerAppsEmpty') }}
                            </div>
                            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div
                                v-for="app in appCapabilities"
                                :key="app.appKey"
                                :class="[
                                  'rounded-xl border p-4 transition-colors',
                                  isAppEntitlementEnabled(app.appKey)
                                    ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20 ring-1 ring-indigo-200/60 dark:ring-indigo-800/60'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
                                ]"
                              >
                                <div class="flex items-start gap-3">
                                  <HeadlessCheckbox
                                    :checked="isAppEntitlementEnabled(app.appKey)"
                                    :disabled="isSystemRole"
                                    checkbox-class="mt-0.5"
                                    @change="handleAppEntitlementToggle(app)"
                                  />
                                  <div class="flex-1 min-w-0 space-y-2">
                                    <p class="text-sm font-semibold text-gray-900 dark:text-white">
                                      {{ getAppDisplayName(app.appKey) }}
                                    </p>
                                    <HeadlessSelect
                                      v-if="isAppEntitlementEnabled(app.appKey)"
                                      :model-value="getResolvedEntitlementRoleKey(app)"
                                      :options="getAppRoleOptions(app)"
                                      :disabled="isSystemRole"
                                      :button-class="drawerSelectButtonClass"
                                      teleport
                                      @update:model-value="updateAppEntitlementRole(app.appKey, $event)"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div
                              v-if="rbacV2 && !hasEntitledApps && form.userType !== 'EXTERNAL'"
                              class="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
                            >
                              {{ t('settings.roleDrawerAccessNoAppsSelected') }}
                            </div>
                          </section>

                          <!-- Step 2: Module permissions -->
                          <section class="space-y-3">
                            <div>
                              <p class="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                {{ t('settings.roleDrawerAccessStepModules') }}
                              </p>
                              <p v-if="isPermissionsFromProfile" class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                {{ t('settings.roleDrawerAccessProfilePreviewHint', { profile: linkedProfileName || t('settings.roleDrawerProfileNone') }) }}
                              </p>
                              <p
                                v-if="catalogMeta.externalProfile"
                                class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                              >
                                {{ t('settings.roleDrawerExternalProfileScopeHint') }}
                              </p>
                            </div>

                            <div
                              v-if="isPermissionsFromProfile"
                              class="rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/25 px-4 py-3 text-sm text-indigo-900 dark:text-indigo-100"
                            >
                              <p class="font-medium">{{ t('settings.roleDrawerPermsFromProfileTitle') }}</p>
                              <p class="mt-1 text-xs text-indigo-800 dark:text-indigo-200/90">
                                {{ t('settings.roleDrawerPermsFromProfileBody', { profile: linkedProfileName || t('settings.roleDrawerProfileNone') }) }}
                              </p>
                            </div>
                            <div
                              v-else-if="isSystemRole"
                              class="rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 flex gap-3"
                            >
                              <LockClosedIcon class="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                              <div>
                                <p class="text-sm font-medium text-amber-900 dark:text-amber-100">{{ t('settings.roleDrawerPermsViewOnlyTitle') }}</p>
                                <p class="text-xs text-amber-800 dark:text-amber-200/80 mt-0.5">
                                  {{ t('settings.roleDrawerPermsViewOnlyBody') }}
                                </p>
                              </div>
                            </div>

                            <template v-if="!isPermissionsFromProfile || linkedProfilePermissions">
                              <div class="flex flex-col sm:flex-row gap-3 sm:items-center">
                                <div class="relative flex-1">
                                  <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input
                                    v-model="permissionSearch"
                                    type="search"
                                    :placeholder="t('settings.roleDrawerSearchModulesPh')"
                                    class="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                                  />
                                </div>
                              </div>

                              <div
                                v-if="rbacV2 && !loadingModules && accessVisibleModules.some((m) => moduleSupportsFieldPermissions(m))"
                                class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/30 px-3 py-2 text-xs text-gray-600 dark:text-gray-400"
                              >
                                {{ t('settings.roleDrawerFieldModulesHint') }}
                              </div>

                              <div
                                v-if="!isPermissionsLocked && !loadingModules && accessVisibleModules.length"
                                class="flex flex-wrap gap-2"
                              >
                                <button
                                  v-for="preset in accessPresets"
                                  :key="preset.id"
                                  type="button"
                                  class="rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 dark:hover:border-indigo-700 transition-colors"
                                  @click="applyAccessPreset(preset.id)"
                                >
                                  {{ preset.label }}
                                </button>
                              </div>

                              <div v-if="loadingModules || loadingProfilePreview" class="flex justify-center py-16">
                                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                              </div>

                              <div
                                v-else-if="accessVisibleSections.length === 0"
                                class="text-center py-12 rounded-xl border border-dashed border-gray-300 dark:border-gray-600"
                              >
                                <p class="text-sm text-gray-600 dark:text-gray-400">
                                  {{ rbacV2 && !hasEntitledApps ? t('settings.roleDrawerAccessNoAppsSelected') : t('settings.roleDrawerNoModulesOrg') }}
                                </p>
                              </div>

                              <div v-else-if="filteredAccessSections.length === 0" class="text-center py-10 text-sm text-gray-500">
                                {{ t('settings.roleDrawerNoSearchMatch', { query: permissionSearch }) }}
                              </div>

                              <div v-else class="space-y-4 pb-2">
                                <section
                                  v-for="section in filteredAccessSections"
                                  :key="section.id"
                                  class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                                >
                                  <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                                    <div class="min-w-0">
                                      <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ section.label }}</h4>
                                      <p v-if="sectionDescription(section)" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        {{ sectionDescription(section) }}
                                      </p>
                                    </div>
                                  </div>
                                  <div class="divide-y divide-gray-100 dark:divide-gray-700/80">
                                    <div
                                      v-for="module in modulesForAccessSection(section.id)"
                                      :key="module.key"
                                      class="px-4 py-3"
                                    >
                                      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div class="min-w-0 flex-1">
                                          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ module.label }}</p>
                                          <p v-if="module.description && !compactMode" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                            {{ module.description }}
                                          </p>
                                        </div>
                                        <div class="w-full sm:w-44 shrink-0">
                                          <HeadlessSelect
                                            :model-value="getModeForDisplay(module)"
                                            :options="accessModeOptions"
                                            :disabled="isPermissionsLocked"
                                            :button-class="drawerSelectButtonClass"
                                            teleport
                                            @update:model-value="setModuleMode(module, $event)"
                                          />
                                        </div>
                                      </div>
                                      <div
                                        v-if="showCrudEditor(module) && (getCrudActionsForModule(module).length || getAdvancedActionsForModule(module).length)"
                                        class="mt-2 space-y-2 pl-0 sm:pl-2"
                                      >
                                        <div
                                          v-if="getCrudActionsForModule(module).length"
                                          class="flex flex-wrap gap-1.5"
                                        >
                                          <PermissionChip
                                            v-for="action in getCrudActionsForModule(module)"
                                            :key="`${module.key}-${action}`"
                                            :label="getCrudLabel(action)"
                                            :variant="chipVariantForAction(action)"
                                            :active="!!effectivePermissions[module.key]?.[action]"
                                            :disabled="isPermissionsLocked || isCrudDisabled(module, action)"
                                            size="sm"
                                            @toggle="togglePermission(module.key, action)"
                                          />
                                        </div>
                                        <div
                                          v-if="getAdvancedActionsForModule(module).length"
                                          class="flex flex-wrap gap-1.5"
                                        >
                                          <PermissionChip
                                            v-for="action in getAdvancedActionsForModule(module)"
                                            :key="`${module.key}-adv-${action}`"
                                            :label="advancedActionLabel(action)"
                                            :variant="chipVariantForAction(action)"
                                            :active="!!effectivePermissions[module.key]?.[action]"
                                            :disabled="isPermissionsLocked || isAdvancedDisabled(module, action)"
                                            size="sm"
                                            @toggle="togglePermission(module.key, action)"
                                          />
                                        </div>
                                      </div>
                                      <div
                                        v-if="moduleShowsFieldPermissions(module)"
                                        class="mt-3 border-t border-gray-100 dark:border-gray-700/80 pt-3"
                                      >
                                        <button
                                          type="button"
                                          :disabled="!canConfigureModuleFieldPermissions(module) || isSystemRole"
                                          :class="[
                                            'inline-flex items-center gap-1.5 text-xs font-medium',
                                            canConfigureModuleFieldPermissions(module) && !isSystemRole
                                              ? 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300'
                                              : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                          ]"
                                          @click="canConfigureModuleFieldPermissions(module) && toggleFieldModuleExpand(module.key)"
                                        >
                                          <ChevronRightIcon
                                            :class="[
                                              'h-3.5 w-3.5 transition-transform',
                                              isFieldModuleExpanded(module.key) && 'rotate-90'
                                            ]"
                                          />
                                          {{ t('settings.roleDrawerModuleFields') }}
                                          <span
                                            v-if="fieldOverrideCount(module) > 0"
                                            class="rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300"
                                          >
                                            {{ fieldOverrideCount(module) }}
                                          </span>
                                        </button>
                                        <p
                                          v-if="!canConfigureModuleFieldPermissions(module)"
                                          class="mt-1 text-[11px] text-gray-500 dark:text-gray-400"
                                        >
                                          {{ t('settings.roleDrawerModuleFieldsRequiresRead') }}
                                        </p>
                                        <div
                                          v-show="canConfigureModuleFieldPermissions(module) && isFieldModuleExpanded(module.key)"
                                          class="mt-2"
                                        >
                                          <FieldPermissionsEditor
                                            variant="inline"
                                            :modules="[module]"
                                            v-model="form.fieldPermissions"
                                            :baseline-permissions="linkedProfileFieldPermissions"
                                            :inherit-from-profile="isPermissionsFromProfile"
                                            :disabled="isSystemRole"
                                            :empty-label="t('settings.fieldPermsEmpty')"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </section>
                              </div>
                            </template>
                            <div
                              v-else-if="isPermissionsFromProfile && !loadingProfilePreview"
                              class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-6 text-center text-sm text-gray-500"
                            >
                              {{ t('settings.roleDrawerAccessProfileLoadingFailed') }}
                            </div>
                            <p
                              v-if="rbacV2 && isPermissionsFromProfile && linkedProfilePermissions"
                              class="text-xs text-gray-500 dark:text-gray-400"
                            >
                              {{ t('settings.roleDrawerFieldOverridesHint') }}
                            </p>
                          </section>
                        </div>

                        <!-- More settings -->
                        <div v-show="activeTab === 'more'" class="space-y-3">
                          <div
                            v-if="!rbacV2"
                            class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                          >
                            <button
                              type="button"
                              class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900/40 hover:bg-gray-100 dark:hover:bg-gray-900/60"
                              @click="toggleMoreSection('capabilities')"
                            >
                              {{ t('settings.roleDrawerTabCapabilities') }}
                              <ChevronRightIcon :class="['h-4 w-4 transition-transform', expandedMoreSections.capabilities && 'rotate-90']" />
                            </button>
                            <div v-show="expandedMoreSections.capabilities" class="p-4 space-y-3 border-t border-gray-200 dark:border-gray-700">
                              <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.roleDrawerCapabilitiesIntro') }}</p>
                              <label
                                v-for="cap in capabilityToggles"
                                :key="cap.key"
                                class="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer"
                              >
                                <HeadlessCheckbox
                                  v-model="form[cap.key]"
                                  :disabled="isSystemRole"
                                  checkbox-class="mt-0.5"
                                />
                                <div>
                                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ cap.label }}</span>
                                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ cap.hint }}</p>
                                </div>
                              </label>
                            </div>
                          </div>

                          <div v-if="rbacV2" class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <button
                              type="button"
                              class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900/40 hover:bg-gray-100 dark:hover:bg-gray-900/60"
                              @click="toggleMoreSection('assignment')"
                            >
                              {{ t('settings.roleDrawerRecordAssignment') }}
                              <ChevronRightIcon :class="['h-4 w-4 transition-transform', expandedMoreSections.assignment && 'rotate-90']" />
                            </button>
                            <div v-show="expandedMoreSections.assignment" class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-200 dark:border-gray-700">
                              <div class="space-y-1">
                                <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.roleDrawerRecordAssignmentUsers') }}</label>
                                <HeadlessSelect
                                  v-model="form.recordAssignment.users"
                                  :options="recordAssignmentUserOptions"
                                  :disabled="isSystemRole"
                                  :button-class="drawerSelectButtonClass"
                                  teleport
                                />
                              </div>
                              <div class="space-y-1">
                                <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.roleDrawerRecordAssignmentGroups') }}</label>
                                <HeadlessSelect
                                  v-model="form.recordAssignment.groups"
                                  :options="recordAssignmentGroupOptions"
                                  :disabled="isSystemRole"
                                  :button-class="drawerSelectButtonClass"
                                  teleport
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div v-if="error" class="mt-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                          <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
                        </div>
                      </div>
                    </div>

                    <!-- Footer -->
                    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-4 sm:px-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                      <p v-if="isDirty && !isSystemRole" class="text-xs text-amber-600 dark:text-amber-400">{{ t('settings.roleDrawerUnsavedTitle') }}</p>
                      <span v-else />
                      <div class="flex items-center gap-3 ml-auto">
                        <button
                          type="button"
                          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"
                          @click="requestClose"
                        >
                          {{ t('actions.cancel') }}
                        </button>
                        <button
                          type="submit"
                          :disabled="saving || !form.name?.trim()"
                          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span v-if="saving">{{ t('states.saving') }}</span>
                          <span v-else>{{ isEditing ? t('settings.roleDrawerSave') : t('settings.roleDrawerCreate') }}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </DialogPanel>
              </div>
            </TransitionChild>
          </div>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { ref, watch, computed, h, defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue';
import {
  XMarkIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  UserIcon,
  UsersIcon,
  EyeIcon
} from '@heroicons/vue/24/outline';
import { StarIcon } from '@heroicons/vue/24/solid';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import FieldPermissionsEditor from './FieldPermissionsEditor.vue';
import {
  countFieldOverridesForModule,
  moduleSupportsFieldPermissions
} from '@/utils/fieldRbacPermission';
import { useRoleAccessCatalog, stripFieldPermissionsForApp, moduleHasReadAccess } from '@/composables/useRoleAccessCatalog';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/auth';
import { isRbacV2Enabled } from '@/utils/rbacFeatureFlags';
import {
  applyModuleAccessMode,
  applyPermissionSideEffects,
  applyPermissionUncheck,
  applyFullAccessToAllModules,
  applyAccessPresetToAllModules,
  buildAccessBulkPresets,
  buildAccessModeOptions,
  buildCrudActionLabels,
  buildRoleAccessSummary,
  chipVariantForAction,
  getAdvancedActionsForModule,
  getCrudActionsForModule,
  getModuleAccessMode,
  hasAction,
  hasAnyAdvancedEnabled,
  isFullyPrivilegedSystemRoleName,
  resolveDisplayAccessMode,
  shouldShowModuleActionEditor
} from '@/utils/rolePermissionEditorUtils';

import { confirmAction } from '@/composables/useConfirmAction';
const { t } = useI18n();
const authStore = useAuthStore();
const rbacV2 = computed(() => isRbacV2Enabled(authStore.organization));

/** White select trigger across role drawer pickers. */
const drawerSelectButtonClass =
  'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-xs focus:bg-white dark:focus:bg-gray-800';

const ADVANCED_ACTION_I18N = {
  export: 'roleDrawerPermExport',
  import: 'roleDrawerPermImport',
  viewAll: 'roleDrawerPermViewAll',
  execution: 'roleDrawerPermExecution',
  review: 'roleDrawerPermReview',
  approve: 'roleDrawerPermApprove',
  manageRoles: 'roleDrawerPermManageRoles',
  manageBilling: 'roleDrawerPermManageBilling'
};

const props = defineProps({
  open: { type: Boolean, default: false },
  role: { type: Object, default: null },
  initialTab: { type: String, default: 'overview' },
  defaultParentRoleId: { type: String, default: null }
});

const emit = defineEmits(['close', 'saved']);

const CHIP_STYLES = {
  crud: {
    active: 'bg-slate-700 dark:bg-slate-600 border-slate-700 text-white',
    idle: 'bg-white dark:bg-gray-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-400'
  },
  advanced: {
    active: 'bg-teal-700 dark:bg-teal-800 border-teal-700 text-white',
    idle: 'bg-white dark:bg-gray-800 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 hover:border-teal-400'
  },
  sensitive: {
    active: 'bg-amber-700 dark:bg-amber-800 border-amber-700 text-white',
    idle: 'bg-white dark:bg-gray-800 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:border-amber-400'
  }
};

const PermissionChip = defineComponent({
  name: 'PermissionChip',
  props: {
    label: { type: String, required: true },
    active: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    size: { type: String, default: 'md' },
    variant: { type: String, default: 'crud' }
  },
  emits: ['toggle'],
  setup(chipProps, { emit: chipEmit }) {
    return () => {
      const v = CHIP_STYLES[chipProps.variant] || CHIP_STYLES.crud;
      return h(
        'button',
        {
          type: 'button',
          disabled: chipProps.disabled,
          class: [
            'rounded-md font-medium border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900',
            chipProps.size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
            chipProps.disabled
              ? 'opacity-40 cursor-not-allowed border-gray-200 dark:border-gray-700 text-gray-400'
              : chipProps.active
                ? v.active
                : v.idle
          ],
          onClick: () => {
            if (!chipProps.disabled) chipEmit('toggle');
          }
        },
        chipProps.label
      );
    };
  }
});

const form = ref(createEmptyForm());
const initialSnapshot = ref('');
const saving = ref(false);
const error = ref('');
const activeTab = ref('general');
const permissionSearch = ref('');
const permissionModules = ref([]);
const permissionSections = ref([]);
const catalogMeta = ref({ enabledApps: [], profileScoped: false, externalProfile: false, profileKey: null });
const loadingModules = ref(false);
const availableParentRoles = ref([]);
const availableProfiles = ref([]);
const allAppCapabilities = ref([]);

function appAllowsFormUserType(app, userType) {
  const t = normalizeFormUserType(userType);
  const allowed = (app.userTypesAllowed || []).map((x) => String(x).toUpperCase());
  if (allowed.includes(t)) return true;
  if (allowed.includes('INTERNAL') && (t === 'STANDARD' || t === 'ADMIN')) return true;
  if (allowed.includes('STANDARD') && t === 'ADMIN') return true;
  return false;
}

const appCapabilities = computed(() => {
  const userType = form.value.userType || 'STANDARD';
  return allAppCapabilities.value.filter((app) => appAllowsFormUserType(app, userType));
});
const compactMode = ref(false);
const expandedAdvanced = ref({});
/** Modules where user chose Custom to fine-tune CRUD chips */
const customEditModules = ref(new Set());
/** Module keys with expanded inline field permission panels */
const expandedFieldModules = ref(new Set());

const expandedMoreSections = ref({ capabilities: false, assignment: true });

const {
  accessVisibleModules,
  accessVisibleSections,
  modulesByVisibleSection,
  hasEntitledApps
} = useRoleAccessCatalog({
  modules: permissionModules,
  sections: permissionSections,
  appEntitlements: computed(() => form.value.appEntitlements),
  permissions: computed(() => form.value.permissions),
  userType: computed(() => form.value.userType),
  rbacV2,
  profileScoped: computed(() => catalogMeta.value.profileScoped === true)
});

const linkedProfilePermissions = ref(null);
const linkedProfileFieldPermissions = ref({});
const linkedProfileKey = ref(null);
const loadingProfilePreview = ref(false);

function normalizeDrawerTab(tab) {
  const map = {
    overview: 'general',
    permissions: 'access',
    capabilities: 'more',
    apps: 'more',
    fields: 'more'
  };
  return map[tab] || tab || 'general';
}

const editorTabs = computed(() => {
  const tabs = [
    { id: 'general', label: t('settings.roleDrawerTabGeneral') },
    { id: 'access', label: t('settings.roleDrawerTabAccess') },
    { id: 'more', label: t('settings.roleDrawerTabMore') }
  ];
  return tabs;
});

const effectivePermissions = computed(() => form.value.permissions);

function moduleHasFieldCatalog(module) {
  if (!rbacV2.value) return false;
  return moduleSupportsFieldPermissions(module);
}

function canConfigureModuleFieldPermissions(module) {
  return moduleHasFieldCatalog(module) && moduleHasReadAccess(effectivePermissions.value, module);
}

function moduleShowsFieldPermissions(module) {
  return moduleHasFieldCatalog(module);
}

function toggleFieldModuleExpand(moduleKey) {
  const next = new Set(expandedFieldModules.value);
  if (next.has(moduleKey)) next.delete(moduleKey);
  else next.add(moduleKey);
  expandedFieldModules.value = next;
}

function isFieldModuleExpanded(moduleKey) {
  return expandedFieldModules.value.has(moduleKey);
}

function fieldOverrideCount(module) {
  return countFieldOverridesForModule(form.value.fieldPermissions, module);
}

function syncExpandedFieldModulesFromOverrides() {
  const next = new Set(expandedFieldModules.value);
  for (const mod of accessVisibleModules.value) {
    if (fieldOverrideCount(mod) > 0) next.add(mod.key);
  }
  expandedFieldModules.value = next;
}

const colorPresets = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#64748b'];

const iconOptions = computed(() => [
  { value: 'user', label: t('settings.roleDrawerIconUser') },
  { value: 'users', label: t('settings.roleDrawerIconUsers') },
  { value: 'crown', label: t('settings.roleDrawerIconCrown') },
  { value: 'shield', label: t('settings.roleDrawerIconShield') },
  { value: 'eye', label: t('settings.roleDrawerIconEye') }
]);

const crudLabels = computed(() => buildCrudActionLabels(t));

function getCrudLabel(action) {
  return crudLabels.value[action] ?? action;
}

const accessModeOptions = computed(() => buildAccessModeOptions(t));

const accessPresets = computed(() => buildAccessBulkPresets(t));

function applyAccessPreset(mode) {
  if (isPermissionsLocked.value) return;
  form.value.permissions = applyAccessPresetToAllModules(
    form.value.permissions,
    accessVisibleModules.value,
    mode
  );
  customEditModules.value = new Set();
}

function sectionDescription(section) {
  if (section?.description) return section.description;
  if (section?.id === 'platform') return t('settings.roleDrawerAccessPlatformSectionHint');
  if (section?.id === 'core') return t('settings.roleDrawerAccessCoreSectionHint');
  return '';
}

function toggleMoreSection(key) {
  expandedMoreSections.value[key] = !expandedMoreSections.value[key];
}

const capabilityToggles = computed(() => [
  {
    key: 'canViewAllData',
    label: t('settings.roleDrawerCapViewAll'),
    hint: t('settings.roleDrawerCapViewAllHint'),
    sensitive: true
  },
  {
    key: 'canManageTeam',
    label: t('settings.roleDrawerCapManageTeam'),
    hint: t('settings.roleDrawerCapManageTeamHint'),
    sensitive: false
  },
  {
    key: 'canExportData',
    label: t('settings.roleDrawerCapExportData'),
    hint: t('settings.roleDrawerCapExportDataHint'),
    sensitive: false
  }
]);

function advancedActionLabel(action) {
  const key = ADVANCED_ACTION_I18N[action];
  return key ? t(`settings.${key}`) : action;
}

const isEditing = computed(() => !!props.role);
const isSystemRole = computed(() => Boolean(props.role?.isSystemRole));
const isPermissionsFromProfile = computed(
  () => rbacV2.value && form.value.privilegeMode === 'profile' && Boolean(form.value.profileId)
);
const isPermissionsLocked = computed(() => isSystemRole.value);
const privilegeModeOptions = computed(() => [
  { value: 'inline', label: t('settings.roleDrawerPrivilegeInline') },
  { value: 'profile', label: t('settings.roleDrawerPrivilegeProfile') }
]);

const userTypeOptions = computed(() => [
  { value: 'STANDARD', label: t('settings.userTypeStandard') },
  { value: 'ADMIN', label: t('settings.userTypeAdmin') },
  { value: 'EXTERNAL', label: t('settings.inviteExternal') }
]);

/** Map legacy Role.userType into dropdown values (INTERNAL/SYSTEM → STANDARD/ADMIN). */
function normalizeFormUserType(raw, roleName = '') {
  const t = String(raw || '').toUpperCase();
  if (t === 'EXTERNAL' || t === 'PORTAL') return 'EXTERNAL';
  if (t === 'ADMIN' || t === 'SYSTEM') return 'ADMIN';
  if (t === 'STANDARD') return 'STANDARD';
  const name = String(roleName || '').trim();
  if (name === 'Owner' || name === 'Admin' || name === 'Administrator') return 'ADMIN';
  // INTERNAL / empty / unknown → Standard (privileged names handled above)
  return 'STANDARD';
}

const recordAssignmentUserOptions = computed(() => [
  { value: 'same_role_or_hierarchy', label: t('settings.roleDrawerRecordAssignmentUsersSameHierarchy') },
  { value: 'subordinates_only', label: t('settings.roleDrawerRecordAssignmentUsersSubordinates') },
  { value: 'all', label: t('settings.roleDrawerRecordAssignmentUsersAll') }
]);

const recordAssignmentGroupOptions = computed(() => [
  { value: 'member_groups', label: t('settings.roleDrawerRecordAssignmentGroupsMember') },
  { value: 'selected', label: t('settings.roleDrawerRecordAssignmentGroupsSelected') },
  { value: 'all', label: t('settings.roleDrawerRecordAssignmentGroupsAll') },
  { value: 'none', label: t('settings.roleDrawerRecordAssignmentGroupsNone') }
]);

const profileSelectOptions = computed(() => [
  { value: '', label: t('settings.roleDrawerProfileNone') },
  ...availableProfiles.value.map((p) => ({ value: p._id, label: p.name }))
]);

const linkedProfileName = computed(() => {
  if (!form.value.profileId) return '';
  const match = availableProfiles.value.find((p) => p._id === form.value.profileId);
  if (match) return match.name;
  const populated = props.role?.profileId;
  if (populated && typeof populated === 'object') return populated.name;
  return '';
});

const appDisplayNames = {
  SALES: 'SALES',
  CRM: 'CRM',
  AUDIT: 'Audit',
  PORTAL: 'Portal'
};

const appRoleDisplayNames = {
  SALES: { ADMIN: 'Admin', MANAGER: 'Manager', USER: 'User' },
  CRM: { ADMIN: 'Admin', MANAGER: 'Manager', USER: 'User' },
  AUDIT: { AUDITOR: 'Auditor' },
  PORTAL: { CUSTOMER: 'Customer', VIEWER: 'Viewer' }
};

function getAppDisplayName(appKey) {
  return appDisplayNames[appKey] || appKey;
}

function getAppRoleDisplayName(appKey, roleKey) {
  return appRoleDisplayNames[appKey]?.[roleKey] || roleKey;
}

function getEntitlement(appKey) {
  return form.value.appEntitlements.find((e) => e.appKey === appKey);
}

function isAppEntitlementEnabled(appKey) {
  const ent = getEntitlement(appKey);
  return ent ? ent.enabled !== false : false;
}

function toggleAppEntitlement(app) {
  if (isSystemRole.value) return;
  const idx = form.value.appEntitlements.findIndex((e) => e.appKey === app.appKey);
  if (idx >= 0) {
    form.value.appEntitlements[idx].enabled = !form.value.appEntitlements[idx].enabled;
    return;
  }
  const defaultRole = app.defaultRole || app.roles?.[0] || 'USER';
  form.value.appEntitlements.push({
    appKey: app.appKey,
    enabled: true,
    seatConsuming: true,
    appRoleKey: defaultRole
  });
}

function handleAppEntitlementToggle(app) {
  const wasEnabled = isAppEntitlementEnabled(app.appKey);
  toggleAppEntitlement(app);
  if (wasEnabled && !isAppEntitlementEnabled(app.appKey)) {
    clearPermissionsForApp(app.appKey);
  }
}

function clearPermissionsForApp(appKey) {
  const upper = String(appKey || '').toUpperCase();
  for (const mod of permissionModules.value) {
    if (mod.scope === 'app' && String(mod.appKey || '').toUpperCase() === upper) {
      const perms = form.value.permissions[mod.key];
      if (perms) applyModuleAccessMode(mod, perms, 'none');
    }
  }
  form.value.fieldPermissions = stripFieldPermissionsForApp(form.value.fieldPermissions, upper);
}

function updateAppEntitlementRole(appKey, appRoleKey) {
  const ent = getEntitlement(appKey);
  if (ent) ent.appRoleKey = appRoleKey;
}

function getResolvedEntitlementRoleKey(app) {
  const ent = getEntitlement(app.appKey);
  const raw = ent?.appRoleKey;
  if (raw && (app.roles || []).includes(raw)) {
    return raw;
  }
  return app.defaultRole || app.roles?.[0] || raw || '';
}

function getAppRoleOptions(app) {
  return (app.roles || []).map((roleKey) => ({
    value: roleKey,
    label: getAppRoleDisplayName(app.appKey, roleKey)
  }));
}

function buildDefaultAppEntitlements() {
  return appCapabilities.value.map((app) => ({
    appKey: app.appKey,
    enabled: true,
    seatConsuming: true,
    appRoleKey: app.defaultRole || app.roles?.[0] || 'USER'
  }));
}

const isFullyPrivilegedSystemRole = computed(
  () => isSystemRole.value && isFullyPrivilegedSystemRoleName(props.role?.name)
);

const headerSubtitle = computed(() => {
  if (isSystemRole.value) {
    return props.role?.description || t('settings.roleDrawerSubtitleSystem');
  }
  if (isEditing.value) {
    return props.role?.description || t('settings.roleDrawerSubtitleEditDefault');
  }
  return t('settings.roleDrawerSubtitleCreateDefault');
});

const parentRoleOptions = computed(() =>
  availableParentRoles.value.map((r) => ({
    value: r._id,
    label: t('settings.roleDrawerParentLevel', { name: r.name, level: r.level })
  }))
);

const roleIconComponent = computed(() => {
  const map = { crown: StarIcon, shield: ShieldCheckIcon, users: UsersIcon, eye: EyeIcon, user: UserIcon };
  return map[form.value.icon] || UserIcon;
});

const modulesForAccessSection = (sectionId) => {
  const list = modulesByVisibleSection.value[sectionId] || [];
  const q = permissionSearch.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (m) =>
      (m.label || '').toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q) ||
      (m.key || '').toLowerCase().includes(q)
  );
};

const filteredAccessSections = computed(() => {
  const q = permissionSearch.value.trim().toLowerCase();
  if (!q) return accessVisibleSections.value;
  return accessVisibleSections.value.filter((s) => (modulesForAccessSection(s.id) || []).length > 0);
});

const accessSummaryLines = computed(() =>
  buildRoleAccessSummary({
    permissions: form.value.permissions,
    modules: rbacV2.value ? accessVisibleModules.value : permissionModules.value,
    sections: rbacV2.value ? accessVisibleSections.value : permissionSections.value,
    form: form.value,
    roleName: props.role?.name,
    rbacV2: rbacV2.value
  }).map((line) => ({
    tone: line.tone,
    text: t(`settings.${line.i18nKey}`, line.params || {})
  }))
);

const isDirty = computed(() => snapshotForm() !== initialSnapshot.value);

watch(
  () => permissionModules.value.length,
  (n) => {
    if (n >= 25) compactMode.value = true;
  }
);

watch(
  () => form.value.userType,
  (userType, previousUserType) => {
    if (!rbacV2.value) return;
    const allowedKeys = new Set(
      allAppCapabilities.value
        .filter((app) => appAllowsFormUserType(app, userType || 'STANDARD'))
        .map((app) => app.appKey)
    );
    const nextEntitlements = [];
    for (const ent of form.value.appEntitlements) {
      if (!allowedKeys.has(ent.appKey)) {
        if (ent.enabled !== false) clearPermissionsForApp(ent.appKey);
        continue;
      }
      nextEntitlements.push(ent);
    }
    form.value.appEntitlements = nextEntitlements;

    const nextType = String(userType || 'INTERNAL').toUpperCase();
    const prevType = String(previousUserType || 'INTERNAL').toUpperCase();
    if (nextType !== prevType && (nextType === 'EXTERNAL' || prevType === 'EXTERNAL')) {
      const profileKey = linkedProfileKey.value || null;
      if (!profileKey) {
        fetchPermissionModules(null, userType);
      }
    }
  }
);

function toPlainFieldPerms(value) {
  if (!value) return {};
  if (typeof value.entries === 'function') {
    const out = {};
    for (const [k, v] of value.entries()) out[k] = v;
    return out;
  }
  return { ...value };
}

function defaultRecordAssignment() {
  return {
    users: 'same_role_or_hierarchy',
    groups: 'member_groups',
    selectedGroupIds: []
  };
}

function createEmptyForm() {
  return {
    name: '',
    description: '',
    parentRole: '',
    color: '#6366f1',
    icon: 'user',
    canViewAllData: false,
    canManageTeam: false,
    canExportData: false,
    permissions: {},
    userType: 'STANDARD',
    privilegeMode: rbacV2.value ? 'profile' : 'inline',
    profileId: '',
    appEntitlements: [],
    fieldPermissions: {},
    recordAssignment: defaultRecordAssignment()
  };
}

function snapshotForm() {
  return JSON.stringify(form.value);
}

function summaryDotClass(tone) {
  const map = {
    positive: 'bg-emerald-500',
    neutral: 'bg-slate-400',
    muted: 'bg-gray-300 dark:bg-gray-600',
    warning: 'bg-amber-500'
  };
  return map[tone] || map.neutral;
}

function summaryTextClass(tone) {
  const map = {
    positive: 'text-gray-800 dark:text-gray-200',
    neutral: 'text-gray-700 dark:text-gray-300',
    muted: 'text-gray-500 dark:text-gray-400',
    warning: 'text-amber-800 dark:text-amber-200'
  };
  return map[tone] || map.neutral;
}

const initializePermissions = () => {
  const permissions = {};
  permissionModules.value.forEach((module) => {
    permissions[module.key] = {};
    getCrudActionsForModule(module).forEach((action) => {
      permissions[module.key][action] = false;
    });
    getAdvancedActionsForModule(module).forEach((action) => {
      permissions[module.key][action] = false;
    });
    if (module.hasScope) permissions[module.key].scope = 'own';
  });
  return permissions;
};

function ensureModulePermissions(module) {
  if (form.value.permissions[module.key]) {
    return form.value.permissions[module.key];
  }
  const init = initializePermissions();
  const next = init[module.key] || {
    read: false,
    create: false,
    update: false,
    delete: false,
    scope: 'own'
  };
  form.value.permissions = {
    ...form.value.permissions,
    [module.key]: next
  };
  return next;
}

const fetchPermissionModules = async (profileKey = null, userType = null) => {
  loadingModules.value = true;
  try {
    const params = {};
    if (profileKey) {
      params.profileKey = profileKey;
    } else {
      const resolvedUserType = userType || form.value.userType || props.role?.userType || null;
      if (String(resolvedUserType || '').toUpperCase() === 'EXTERNAL') {
        params.userType = 'EXTERNAL';
      }
    }
    const response = await apiClient.get('/roles/modules', { params });
    if (response.success) {
      permissionModules.value = response.data || [];
      permissionSections.value = response.sections || [];
      catalogMeta.value = {
        enabledApps: response.enabledApps || [],
        profileScoped: response.profileScoped === true,
        externalProfile: response.externalProfile === true,
        profileKey: response.profileKey || profileKey || null
      };
      if (!props.role) form.value.permissions = initializePermissions();
    }
  } catch (err) {
    console.error('Error fetching modules:', err);
  } finally {
    loadingModules.value = false;
  }
};

const fetchParentRoles = async () => {
  try {
    const response = await apiClient.get('/roles');
    if (response.success) {
      availableParentRoles.value = response.data.filter((r) => r._id !== props.role?._id);
    }
  } catch (err) {
    console.error('Error fetching roles:', err);
  }
};

const fetchProfiles = async () => {
  if (!rbacV2.value) return;
  try {
    const response = await apiClient.get('/profiles');
    if (response.success) {
      availableProfiles.value = response.data || [];
    }
  } catch (err) {
    console.error('Error fetching profiles:', err);
  }
};

const fetchAppCapabilities = async () => {
  if (!rbacV2.value) return;
  try {
    const response = await apiClient.get('/users/add-capabilities');
    if (response.success) {
      allAppCapabilities.value = response.data.apps || [];
    }
  } catch (err) {
    console.error('Error fetching app capabilities:', err);
  }
};

const loadRoleIntoForm = () => {
  const basePerms = initializePermissions();
  const existingPerms = JSON.parse(JSON.stringify(props.role.permissions || {}));
  Object.keys(basePerms).forEach((m) => {
    basePerms[m] = { ...basePerms[m], ...existingPerms[m] };
  });
  Object.entries(existingPerms).forEach(([m, grant]) => {
    if (!basePerms[m] && grant && typeof grant === 'object') {
      basePerms[m] = {
        read: false,
        create: false,
        update: false,
        delete: false,
        scope: 'own',
        ...grant
      };
    }
  });
  if (isFullyPrivilegedSystemRole.value) {
    applyFullAccessToAllModules(basePerms, permissionModules.value);
  }
  form.value = {
    name: props.role.name || '',
    description: props.role.description || '',
    parentRole: props.role.parentRole?._id || props.role.parentRole || '',
    color: props.role.color || '#6366f1',
    icon: props.role.icon || 'user',
    canViewAllData: isFullyPrivilegedSystemRole.value ? true : props.role.canViewAllData || false,
    canManageTeam: isFullyPrivilegedSystemRole.value ? true : props.role.canManageTeam || false,
    canExportData: isFullyPrivilegedSystemRole.value ? true : props.role.canExportData || false,
    permissions: basePerms,
    userType: normalizeFormUserType(props.role.userType, props.role.name),
    privilegeMode: props.role.privilegeMode || 'inline',
    profileId: props.role.profileId?._id || props.role.profileId || '',
    appEntitlements: isFullyPrivilegedSystemRole.value
      ? buildDefaultAppEntitlements()
      : Array.isArray(props.role.appEntitlements) && props.role.appEntitlements.length
        ? JSON.parse(JSON.stringify(props.role.appEntitlements))
        : buildDefaultAppEntitlements(),
    fieldPermissions: toPlainFieldPerms(props.role.fieldPermissions),
    recordAssignment: {
      ...defaultRecordAssignment(),
      ...(props.role.recordAssignment || {})
    }
  };
  syncExpandedFieldModulesFromOverrides();
};

const resetForm = () => {
  form.value = { ...createEmptyForm(), permissions: initializePermissions() };
  error.value = '';
  activeTab.value = 'general';
  permissionSearch.value = '';
  expandedAdvanced.value = {};
  customEditModules.value = new Set();
  expandedFieldModules.value = new Set();
  expandedMoreSections.value = { capabilities: false, assignment: true };
  linkedProfilePermissions.value = null;
  linkedProfileFieldPermissions.value = {};
};

const markClean = () => {
  initialSnapshot.value = snapshotForm();
};

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    const tab = normalizeDrawerTab(props.initialTab);
    activeTab.value = editorTabs.value.some((tabItem) => tabItem.id === tab) ? tab : 'general';
    permissionSearch.value = '';
    error.value = '';
    expandedAdvanced.value = {};
    customEditModules.value = new Set();
    await fetchPermissionModules(null, props.role?.userType);
    fetchParentRoles();
    await Promise.all([fetchProfiles(), fetchAppCapabilities()]);
    if (props.role) loadRoleIntoForm();
    else {
      resetForm();
      if (props.defaultParentRoleId) {
        form.value.parentRole = props.defaultParentRoleId;
      }
      if (rbacV2.value && appCapabilities.value.length) {
        form.value.appEntitlements = buildDefaultAppEntitlements();
      }
    }
    if (rbacV2.value && form.value.privilegeMode === 'profile' && form.value.profileId) {
      await fetchLinkedProfilePreview(form.value.profileId);
    }
    markClean();
  }
);

function getModeForDisplay(module) {
  return resolveDisplayAccessMode(
    module,
    effectivePermissions.value[module.key] || {},
    customEditModules.value
  );
}

function getMode(module) {
  return getModuleAccessMode(module, form.value.permissions[module.key] || {});
}

function showCrudEditor(module) {
  return shouldShowModuleActionEditor(
    module,
    form.value.permissions[module.key] || {},
    customEditModules.value
  );
}

function setModuleMode(module, mode) {
  if (isPermissionsLocked.value) return;
  const perms = { ...ensureModulePermissions(module) };
  if (mode === 'custom') {
    customEditModules.value = new Set([...customEditModules.value, module.key]);
    form.value.permissions = { ...form.value.permissions, [module.key]: perms };
    return;
  }
  customEditModules.value.delete(module.key);
  customEditModules.value = new Set(customEditModules.value);
  applyModuleAccessMode(module, perms, mode);
  form.value.permissions = { ...form.value.permissions, [module.key]: perms };
  if (mode !== 'none' && moduleHasFieldCatalog(module)) {
    expandedFieldModules.value = new Set([...expandedFieldModules.value, module.key]);
  }
}

function isCrudDisabled(module, action) {
  const perms = form.value.permissions[module.key] || {};
  if (action === 'create') return !perms.read;
  if (action === 'update') return !perms.create;
  if (action === 'delete') return !perms.update;
  return false;
}

function isAdvancedDisabled(module, action) {
  const perms = form.value.permissions[module.key] || {};
  if (action === 'import') return !perms.create;
  if (action === 'viewAll') return !perms.read;
  return false;
}

function advancedActiveCount(module) {
  const perms = form.value.permissions[module.key] || {};
  return getAdvancedActionsForModule(module).filter((a) => perms[a]).length;
}

function isAdvancedExpanded(moduleKey) {
  if (expandedAdvanced.value[moduleKey]) return true;
  const mod = permissionModules.value.find((m) => m.key === moduleKey);
  if (!mod) return false;
  return hasAnyAdvancedEnabled(form.value.permissions[moduleKey], mod);
}

function toggleAdvancedExpanded(moduleKey) {
  expandedAdvanced.value[moduleKey] = !isAdvancedExpanded(moduleKey);
}

const togglePermission = (moduleKey, action) => {
  if (isPermissionsLocked.value) return;
  const module = permissionModules.value.find((m) => m.key === moduleKey);
  const perms = { ...(module ? ensureModulePermissions(module) : form.value.permissions[moduleKey] || {}) };
  if (!module) return;
  perms[action] = !perms[action];
  if (perms[action]) applyPermissionSideEffects(perms, action);
  else applyPermissionUncheck(perms, action);
  form.value.permissions = { ...form.value.permissions, [moduleKey]: perms };
  if (getModuleAccessMode(module, perms) === 'custom') {
    customEditModules.value = new Set([...customEditModules.value, moduleKey]);
  }
};

async function fetchLinkedProfilePreview(profileId) {
  if (!profileId || !rbacV2.value) {
    linkedProfilePermissions.value = null;
    linkedProfileFieldPermissions.value = {};
    linkedProfileKey.value = null;
    return;
  }
  loadingProfilePreview.value = true;
  try {
    const response = await apiClient.get(`/profiles/${profileId}`);
    if (response.success && response.data) {
      linkedProfileKey.value = response.data.profileKey || null;
      if (linkedProfileKey.value) {
        await fetchPermissionModules(linkedProfileKey.value);
      }
      const basePerms = initializePermissions();
      const profilePerms = JSON.parse(
        JSON.stringify(response.data.permissionsUi || response.data.permissions || {})
      );
      Object.keys(basePerms).forEach((m) => {
        if (profilePerms[m]) {
          basePerms[m] = { ...basePerms[m], ...profilePerms[m] };
        }
      });
      Object.entries(profilePerms).forEach(([m, grant]) => {
        if (!basePerms[m] && grant && typeof grant === 'object') {
          basePerms[m] = {
            read: false,
            create: false,
            update: false,
            delete: false,
            scope: 'own',
            ...grant
          };
        }
      });
      linkedProfilePermissions.value = basePerms;
      linkedProfileFieldPermissions.value = toPlainFieldPerms(response.data.fieldPermissions);
      const withOverrides = JSON.parse(JSON.stringify(basePerms));
      const roleProfileId = props.role?.profileId?._id || props.role?.profileId;
      if (props.role && String(roleProfileId || '') === String(profileId)) {
        const overrides = props.role.permissions || {};
        Object.entries(overrides).forEach(([m, grant]) => {
          if (!grant || typeof grant !== 'object') return;
          if (Object.values(grant).some((v) => v && typeof v === 'object' && !Array.isArray(v))) {
            return;
          }
          withOverrides[m] = {
            ...(withOverrides[m] || {
              read: false,
              create: false,
              update: false,
              delete: false,
              scope: 'own'
            }),
            ...grant
          };
        });
      }
      form.value.permissions = withOverrides;
      syncExpandedFieldModulesFromOverrides();
    } else {
      linkedProfilePermissions.value = null;
      linkedProfileFieldPermissions.value = {};
      linkedProfileKey.value = null;
    }
  } catch (err) {
    console.error('Error loading profile preview:', err);
    linkedProfilePermissions.value = null;
    linkedProfileFieldPermissions.value = {};
    linkedProfileKey.value = null;
  } finally {
    loadingProfilePreview.value = false;
  }
}

watch(
  () => [form.value.profileId, form.value.privilegeMode, isPermissionsFromProfile.value],
  ([profileId, , fromProfile]) => {
    if (fromProfile && profileId) {
      fetchLinkedProfilePreview(profileId);
    } else {
      linkedProfilePermissions.value = null;
      linkedProfileFieldPermissions.value = {};
    }
  }
);

const requestClose = async () => {
  if (saving.value) return;
  if (isDirty.value && !await confirmAction(t('settings.roleDrawerCloseConfirm'))) return;
  emit('close');
};

const handleDialogClose = () => requestClose();

const handleSubmit = async () => {
  saving.value = true;
  error.value = '';
  try {
    if (
      rbacV2.value &&
      form.value.privilegeMode === 'profile' &&
      form.value.profileId &&
      (loadingProfilePreview.value || !linkedProfilePermissions.value)
    ) {
      error.value = t('settings.roleDrawerSaveFailed');
      return;
    }
    const payload = { ...form.value };
    if (payload.parentRole === '') payload.parentRole = null;
    if (payload.profileId === '') payload.profileId = null;
    if (rbacV2.value) {
      payload.canViewAllData = false;
      payload.canManageTeam = false;
      payload.canExportData = false;
    }
    // Profile mode: send full matrix; server stores only deltas vs linked profile.
    const response = isEditing.value
      ? await apiClient.put(`/roles/${props.role._id}`, payload)
      : await apiClient.post('/roles', payload);
    if (response.success) {
      emit('saved');
      resetForm();
      markClean();
    } else {
      error.value = response.message || t('settings.roleDrawerSaveFailed');
    }
  } catch (err) {
    error.value = err.response?.message || err.message || t('settings.roleDrawerSaveFailed');
  } finally {
    saving.value = false;
  }
};
</script>
