<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div v-if="loadError" class="shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
      {{ loadError }}
    </div>

    <div v-else-if="bootstrapLoading" class="flex flex-1 justify-center py-16">
      <div class="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>

    <div v-else-if="view === 'list'" class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div class="sticky top-0 z-10 shrink-0 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
        <div class="flex items-start justify-between gap-3 px-1 pb-3 pt-1">
          <div class="flex min-w-0 items-start gap-3">
            <button
              type="button"
              class="mt-0.5 text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              :title="t('settings.assignRulesBackTitle')"
              @click="goBackToAutomation"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div class="min-w-0">
              <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('settings.automationAssignmentRules') }}</h2>
              <p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.assignRulesSubtitle') }}</p>
            </div>
          </div>
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            @click="openCreateRuleSet"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
            {{ t('settings.assignRulesNewRuleSet') }}
          </button>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain" :class="SETTINGS_HEADER_CONTENT_GAP_CLASS">
        <AssignmentRuleSetList
          :rule-sets="ruleSetSummaries"
          :modules="assignmentModules"
          :loading="listLoading"
          @create="openCreateRuleSet"
          @edit="({ appKey, moduleKey }) => openEditRuleSet(appKey, moduleKey)"
        />
      </div>
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div v-if="loading" class="flex flex-1 justify-center py-16">
        <div class="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
      <template v-else>
      <div class="sticky top-0 z-10 shrink-0 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
        <div class="flex items-start justify-between gap-3 px-1 pb-2 pt-1">
          <div class="flex min-w-0 items-start gap-3">
            <button
              type="button"
              class="mt-0.5 text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              :title="t('settings.assignRulesBackToList')"
              @click="backToList"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div class="min-w-0">
              <h2 class="text-lg font-bold text-gray-900 dark:text-white">
                {{ isNewRuleSet ? t('settings.assignRulesNewRuleSet') : t('settings.assignRulesEditRuleSet') }}
              </h2>
              <p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                {{ appLabel(scopeApp) }} · {{ moduleLabelForScope() }}
              </p>
            </div>
          </div>
          <Menu as="div" class="relative shrink-0">
            <MenuButton type="button" class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              {{ t('settings.helpdeskExecRelatedTitle') }}
              <ChevronDownIcon class="h-4 w-4 opacity-60" />
            </MenuButton>
            <transition enter-active-class="transition duration-100 ease-out" enter-from-class="scale-95 opacity-0" enter-to-class="scale-100 opacity-100" leave-active-class="transition duration-75 ease-in" leave-from-class="scale-100 opacity-100" leave-to-class="scale-95 opacity-0">
              <MenuItems class="absolute right-0 z-20 mt-1 w-56 origin-top-right rounded-xl border border-gray-200 bg-white py-1 shadow-lg focus:outline-none dark:border-gray-700 dark:bg-gray-900">
                <MenuItem v-if="scopeApp === 'HELPDESK'" v-slot="{ active }">
                  <RouterLink :to="{ path: '/settings', query: { tab: 'automation', automationView: 'sla' } }" :class="['block px-3 py-2 text-sm', active ? 'bg-gray-100 dark:bg-gray-800' : 'text-gray-700 dark:text-gray-300']">
                    {{ t('settings.automationSla') }}
                  </RouterLink>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <RouterLink :to="{ path: '/settings', query: { tab: 'business-hours' } }" :class="['block px-3 py-2 text-sm', active ? 'bg-gray-100 dark:bg-gray-800' : 'text-gray-700 dark:text-gray-300']">
                    {{ t('settings.helpdeskExecLinkBusinessHours') }}
                  </RouterLink>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <RouterLink :to="{ path: '/groups' }" :class="['block px-3 py-2 text-sm', active ? 'bg-gray-100 dark:bg-gray-800' : 'text-gray-700 dark:text-gray-300']">
                    {{ t('settings.assignRulesNavGroups') }}
                  </RouterLink>
                </MenuItem>
              </MenuItems>
            </transition>
          </Menu>
        </div>
      </div>

      <div
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        :class="[SETTINGS_HEADER_CONTENT_GAP_CLASS, isDirty ? SETTINGS_SAVE_BAR_CONTENT_CLASS : '']"
      >
        <div class="flex min-h-0 gap-6 xl:flex-row">
          <div class="min-w-0 flex-1 space-y-4">
            <div v-if="isNewRuleSet" class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.assignRulesScopeForNew') }}</h3>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('settings.assignRulesLabelApplication') }}</label>
                  <select v-model="scopeApp" class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <option v-for="app in appOptions" :key="app.key" :value="app.key">{{ app.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('settings.assignRulesLabelModule') }}</label>
                  <select v-model="scopeModule" class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <option v-for="mod in moduleOptionsForApp" :key="mod.key" :value="mod.key">{{ mod.label }}</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="space-y-4">
              <!-- Toolbar -->
              <div class="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
                <div class="flex items-center gap-2">
                  <span class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.assignRulesRuleSetLabel') }}</span>
                  <span
                    class="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    :class="meta.enabled ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
                  >
                    {{ meta.enabled ? t('settings.assignRulesEnabled') : t('settings.assignRulesOff') }}
                  </span>
                  <Switch
                    v-model="meta.enabled"
                    :class="[meta.enabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700', 'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors']"
                  >
                    <span :class="[meta.enabled ? 'translate-x-4' : 'translate-x-0', 'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition']" />
                  </Switch>
                </div>
                <div class="flex min-w-[200px] flex-1 items-center gap-2">
                  <span class="shrink-0 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.assignRulesWhenRulesChange') }}</span>
                  <select v-model="meta.applyStrategy" class="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700">
                    <option v-for="opt in applyStrategyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
                <button type="button" class="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700" @click="addRule">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                  {{ t('settings.assignRulesAddRule') }}
                </button>
              </div>

              <!-- Empty -->
              <div v-if="rules.length === 0" class="rounded-xl border border-dashed border-gray-300 px-4 py-12 text-center dark:border-gray-600">
                <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.assignRulesEmpty') }}</p>
                <button type="button" class="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700" @click="addRule">
                  {{ t('settings.assignRulesAddRule') }}
                </button>
              </div>

              <!-- Rule cards -->
              <draggable v-else v-model="rules" item-key="ruleId" handle=".rule-drag-handle" class="space-y-3" @end="onRulesReorder">
                <template #item="{ element: rule, index: idx }">
                  <div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800" :class="{ 'opacity-60': !rule.enabled }">
                    <!-- Header -->
                    <div class="flex flex-wrap items-center gap-2 px-3 py-2.5">
                      <button type="button" class="rule-drag-handle cursor-grab p-1 text-gray-400 hover:text-gray-600 active:cursor-grabbing">
                        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4a1 1 0 100 2 1 1 0 000-2zM7 9a1 1 0 100 2 1 1 0 000-2zM7 14a1 1 0 100 2 1 1 0 000-2zM12 4a1 1 0 100 2 1 1 0 000-2zM12 9a1 1 0 100 2 1 1 0 000-2zM12 14a1 1 0 100 2 1 1 0 000-2z" /></svg>
                      </button>
                      <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">{{ idx + 1 }}</span>
                      <input v-model="rule.name" type="text" class="min-w-[120px] flex-1 border-0 bg-transparent text-sm font-semibold text-gray-900 focus:ring-0 dark:text-white" :placeholder="t('settings.assignRulesUntitled')" />
                      <span class="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/50 dark:text-green-300">
                        {{ rule.enabled ? t('settings.assignRulesActive') : t('settings.assignRulesOff') }}
                      </span>
                      <div class="flex shrink-0 items-center gap-1.5">
                        <span class="text-xs text-gray-500">{{ t('settings.assignRulesThenLabel') }}</span>
                        <select
                          :value="assignTargetSelectValue(rule)"
                          class="max-w-[180px] rounded-lg border border-gray-300 bg-white py-1 pl-2 pr-7 text-sm font-medium dark:border-gray-600 dark:bg-gray-700"
                          @change="onAssignTargetChange(rule, $event)"
                        >
                          <option disabled value="">{{ t('settings.assignRulesSelectAssignTo') }}</option>
                          <option v-for="g in groups" :key="g._id" :value="String(g._id)">{{ g.name }}</option>
                          <option :value="CUSTOM_ASSIGN_VALUE">{{ t('settings.assignRulesAssignCustom') }}</option>
                        </select>
                        <button
                          v-if="isCustomAssignTarget(rule)"
                          type="button"
                          class="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                          @click="openUsersDrawer(rule)"
                        >
                          {{ t('settings.assignRulesManageUsers') }}
                        </button>
                      </div>
                      <div class="ml-auto flex items-center gap-1">
                        <button type="button" class="p-1 text-gray-400 hover:text-gray-600" @click="toggleExpand(rule.ruleId)">
                          <svg class="h-4 w-4 transition-transform" :class="{ 'rotate-180': expanded[rule.ruleId] }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        <Menu as="div" class="relative">
                          <MenuButton class="p-1 text-gray-400 hover:text-gray-600">
                            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                          </MenuButton>
                          <MenuItems class="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                            <MenuItem v-slot="{ active }">
                              <button type="button" :class="['block w-full px-3 py-2 text-left text-sm', active ? 'bg-gray-100 dark:bg-gray-800' : '']" @click="rule.enabled = !rule.enabled">
                                {{ rule.enabled ? t('settings.assignRulesDisable') : t('settings.assignRulesEnable') }}
                              </button>
                            </MenuItem>
                            <MenuItem v-slot="{ active }">
                              <button type="button" :class="['block w-full px-3 py-2 text-left text-sm', active ? 'bg-gray-100 dark:bg-gray-800' : '']" @click="openConditionEditor(rule.ruleId)">
                                {{ t('settings.assignRulesEditConditions') }}
                              </button>
                            </MenuItem>
                            <MenuItem v-slot="{ active }">
                              <button type="button" :class="['block w-full px-3 py-2 text-left text-sm text-red-600', active ? 'bg-gray-100 dark:bg-gray-800' : '']" @click="removeRule(idx)">
                                {{ t('settings.assignRulesRemoveRule') }}
                              </button>
                            </MenuItem>
                          </MenuItems>
                        </Menu>
                      </div>
                    </div>

                    <!-- WHEN chips -->
                    <div class="flex flex-wrap items-center gap-2 border-t border-gray-100 px-4 py-2.5 dark:border-gray-700/60">
                      <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">{{ t('settings.assignRulesWhenLabel') }}</span>
                      <template v-if="rule.conditions.clauses.length === 0">
                        <span class="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">{{ t('settings.assignRulesNoConditions') }}</span>
                      </template>
                      <template v-for="(clause, cIdx) in rule.conditions.clauses" :key="cIdx">
                        <span v-if="cIdx > 0" class="text-xs font-medium text-gray-400">{{ combinatorChipLabel(rule) }}</span>
                        <span class="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-200">
                          {{ formatClauseChip(clause) }}
                        </span>
                      </template>
                      <button type="button" class="text-xs text-indigo-600 hover:underline dark:text-indigo-400" @click="addClause(rule)">
                        + {{ t('settings.assignRulesAddClause') }}
                      </button>
                    </div>

                    <!-- Condition editor -->
                    <div v-if="conditionEditor[rule.ruleId]" class="border-t border-gray-100 bg-gray-50/50 px-4 py-3 dark:border-gray-700/60 dark:bg-gray-900/20">
                      <div class="mb-2 flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                          <span class="text-xs text-gray-500">{{ t('settings.assignRulesMatch') }}</span>
                          <select v-model="rule.conditions.combinator" class="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700">
                            <option v-for="opt in combinatorOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                          </select>
                        </div>
                        <button type="button" class="text-xs text-indigo-600 hover:underline dark:text-indigo-400" @click="addClause(rule)">
                          + {{ t('settings.assignRulesAddClause') }}
                        </button>
                      </div>
                      <div class="space-y-2">
                        <div v-for="(clause, cIdx) in rule.conditions.clauses" :key="cIdx" class="grid grid-cols-12 items-end gap-2">
                          <div class="col-span-3">
                            <select :value="clauseFieldPresetValue(clause)" class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-700" @change="onClauseFieldPresetChange(clause, $event)">
                              <option value="">{{ t('settings.assignRulesSelectField') }}</option>
                              <option v-for="opt in conditionFieldOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                              <option value="__custom__">{{ t('settings.assignRulesCustomPath') }}</option>
                            </select>
                            <input v-if="clauseFieldIsCustom(clause)" v-model.trim="clause.field" type="text" class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono dark:border-gray-600 dark:bg-gray-700" />
                          </div>
                          <div class="col-span-3">
                            <select v-model="clause.operator" class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-700" @change="onClauseOperatorChange(clause)">
                              <option v-for="op in operators" :key="op.value" :value="op.value">{{ op.label }}</option>
                            </select>
                          </div>
                          <div class="col-span-5">
                            <template v-if="clause.operator !== 'exists'">
                              <!-- multi-picklist with known options: native multi-select -->
                              <div
                                v-if="isMultiValueOperator(clause.operator) || clauseFieldDataType(clause) === 'multi-picklist'"
                                class="w-full"
                              >
                                <div class="relative">
                                  <div
                                    class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                                    @click.stop="toggleClauseMultiPicker(clause)"
                                  >
                                    <div class="flex flex-wrap items-center gap-1.5">
                                      <template v-if="clauseMultiPickerValues(clause).length > 0">
                                        <span
                                          v-for="(selected, selIdx) in clauseMultiPickerValues(clause)"
                                          :key="`${String(selected)}_${selIdx}`"
                                          class="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 text-[11px] font-medium text-indigo-800 dark:text-indigo-200"
                                        >
                                          <span>{{ selected }}</span>
                                          <button
                                            type="button"
                                            class="rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800"
                                            @click.stop="removeMultiPickValue(clause, selected)"
                                            :aria-label="t('actions.remove')"
                                          >
                                            ×
                                          </button>
                                        </span>
                                      </template>
                                      <span v-else class="text-gray-500 dark:text-gray-400">
                                        {{ t('settings.assignRulesValueArrayPh') }}
                                      </span>
                                    </div>
                                  </div>

                                  <div
                                    v-if="clauseMultiPickerOpen(clause)"
                                    v-click-outside="() => closeClauseMultiPicker(clause)"
                                    class="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10 max-h-72 flex flex-col"
                                    @click.stop
                                  >
                                    <div class="shrink-0 p-2 border-b border-gray-200 dark:border-gray-600">
                                      <input
                                        type="text"
                                        :value="clauseMultiPickerQuery(clause)"
                                        @input="setClauseMultiPickerQuery(clause, $event.target.value)"
                                        @keydown.enter.stop.prevent="createMultiPickValueFromQuery(clause)"
                                        @keydown.escape.stop="closeClauseMultiPicker(clause)"
                                        :placeholder="t('common.formSearchOptions')"
                                        class="w-full px-3 py-2 text-xs rounded-md bg-gray-100 dark:bg-gray-700 outline-1 -outline-offset-1 outline-gray-300/20 dark:outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:outline-indigo-500 text-gray-900 dark:text-white placeholder:text-gray-500"
                                        autocomplete="off"
                                      />
                                      <button
                                        v-if="clauseMultiPickerCreateCandidate(clause)"
                                        type="button"
                                        class="mt-2 w-full rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                                        @click="createMultiPickValueFromQuery(clause)"
                                      >
                                        {{ t('actions.add') }} “{{ clauseMultiPickerCreateCandidate(clause) }}”
                                      </button>
                                    </div>

                                    <div class="overflow-auto">
                                      <button
                                        v-for="opt in clauseMultiPickerFilteredOptions(clause)"
                                        :key="String(opt.value)"
                                        type="button"
                                        class="w-full px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
                                        @click="toggleMultiPickValue(clause, opt.value)"
                                      >
                                        <span class="truncate">{{ opt.label }}</span>
                                        <span v-if="clauseMultiPickerValues(clause).some((v) => String(v) === String(opt.value))" class="text-indigo-600 dark:text-indigo-300">✓</span>
                                      </button>

                                      <div v-if="(clauseValueMultiOptionList(clause) || []).length === 0" class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                                        {{ t('settings.assignRulesTypeAndPressEnter') }}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <select
                                v-else-if="clauseValueOptionList(clause)"
                                v-model="clause.value"
                                class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-700"
                              >
                                <option value="">{{ t('settings.assignRulesSelectValue') }}</option>
                                <option v-for="opt in clauseValueOptionList(clause)" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
                              </select>

                              <select
                                v-else-if="clauseFieldDataType(clause) === 'boolean' && !isMultiValueOperator(clause.operator)"
                                v-model="clause.value"
                                class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-700"
                              >
                                <option value="">{{ t('settings.assignRulesSelectValue') }}</option>
                                <option value="true">{{ t('settings.assignRulesYes') }}</option>
                                <option value="false">{{ t('settings.assignRulesNo') }}</option>
                              </select>

                              <DateFilterDropdown
                                v-else-if="clauseFieldDataType(clause) === 'date' || clauseFieldDataType(clause) === 'datetime'"
                                :model-value="normalizeDateFilterModel(clause.value)"
                                :filter-key="clause.field || 'date'"
                                :filter-label="clauseValuePlaceholder(clause)"
                                button-class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                teleport-options
                                @update:model-value="(v) => { clause.value = v; }"
                              />

                              <input
                                v-else
                                v-model.trim="clause.value"
                                :type="clauseValueInputType(clause)"
                                :placeholder="clauseValuePlaceholder(clause)"
                                class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-700"
                              />
                            </template>
                          </div>
                          <div class="col-span-1 flex justify-end">
                            <button type="button" class="p-1 text-gray-400 hover:text-red-600" @click="removeClause(rule, cIdx)">
                              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Expanded body: 3 columns -->
                    <div v-show="expanded[rule.ruleId]" class="border-t border-gray-100 dark:border-gray-700/60">
                      <div class="grid grid-cols-1 gap-0 divide-y divide-gray-100 bg-gray-50/80 dark:divide-gray-700/60 dark:bg-gray-900/20 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
                        <!-- Distribution -->
                        <div class="p-4">
                          <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('settings.assignRulesDistribution') }}</p>
                          <div class="space-y-2">
                            <label v-for="opt in uiDistributionModeOptions" :key="opt.value" class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <input type="radio" class="text-indigo-600 focus:ring-indigo-500" :checked="uiDistributionMode(rule) === opt.value" @change="setUiDistributionMode(rule, opt.value)" />
                              {{ opt.label }}
                            </label>
                          </div>
                          <div v-if="uiDistributionMode(rule) === 'queue'" class="mt-3">
                            <label class="mb-1 block text-xs text-gray-500">{{ t('settings.assignRulesClaimTimeout') }}</label>
                            <input v-model.number="rule.distribution.queueClaimTimeoutMinutes" type="number" min="1" class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700" />
                          </div>
                        </div>

                        <!-- Members -->
                        <div class="p-4">
                          <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            {{ t('settings.assignRulesMembers') }}
                            <span v-if="hasAssignTarget(rule) && uiDistributionMode(rule) !== 'queue'">
                              ({{ membersSummary(rule) }})
                            </span>
                          </p>
                          <div v-if="uiDistributionMode(rule) === 'queue'" class="text-sm text-gray-500">{{ t('settings.assignRulesQueueNoMembers') }}</div>
                          <div v-else-if="!hasAssignTarget(rule)" class="text-sm text-gray-500">
                            {{ isCustomAssignTarget(rule) ? t('settings.assignRulesCustomUsersEmpty') : t('settings.assignRulesSelectGroup') }}
                          </div>
                          <div v-else-if="ruleMembers(rule).length === 0" class="text-sm text-gray-500">{{ t('settings.assignRulesNoMembers') }}</div>
                          <div v-else class="space-y-2">
                            <p v-if="!isCustomAssignTarget(rule)" class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.assignRulesMemberIncludeHint') }}</p>
                            <div v-for="member in ruleMembers(rule)" :key="member.id" class="flex items-center gap-2.5" :class="{ 'opacity-50': !isMemberEnabled(rule, member.id) }">
                              <input
                                v-if="!isCustomAssignTarget(rule)"
                                type="checkbox"
                                class="shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                :checked="isMemberEnabled(rule, member.id)"
                                :title="t('settings.assignRulesMemberIncludeLabel')"
                                @change="toggleMemberEnabled(rule, member.id, $event.target.checked)"
                              />
                              <Avatar :user="member.user" size="sm" />
                              <span class="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">{{ member.name }}</span>
                              <span v-if="isMemberEnabled(rule, member.id)" class="h-2 w-2 shrink-0 rounded-full bg-green-500" />
                              <span v-else class="h-2 w-2 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
                              <span v-if="isMemberEnabled(rule, member.id) && uiDistributionMode(rule) === 'load_balanced'" class="shrink-0 text-xs text-gray-400">— {{ t('settings.assignRulesOpen') }}</span>
                              <template v-if="isMemberEnabled(rule, member.id) && uiDistributionMode(rule) === 'weighted'">
                                <input type="number" min="1" max="100" class="w-12 rounded border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-700" :value="memberWeight(rule, member.id)" @input="setMemberWeight(rule, member.id, $event.target.value)" />
                                <span class="text-xs text-gray-400">%</span>
                              </template>
                              <button
                                v-if="isCustomAssignTarget(rule)"
                                type="button"
                                class="shrink-0 p-1 text-gray-400 hover:text-red-600"
                                :title="t('settings.assignRulesRemoveMember')"
                                @click="removeCustomUser(rule, member.id)"
                              >
                                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                            <p v-if="!isCustomAssignTarget(rule) && enabledMembersCount(rule) === 0" class="text-xs text-amber-600 dark:text-amber-400">
                              {{ t('settings.assignRulesNoEnabledMembers') }}
                            </p>
                            <button
                              v-if="isCustomAssignTarget(rule)"
                              type="button"
                              class="mt-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                              @click="openUsersDrawer(rule)"
                            >
                              + {{ t('settings.assignRulesManageUsers') }}
                            </button>
                          </div>
                        </div>

                        <!-- Availability + Fallback -->
                        <div class="space-y-4 p-4">
                          <div v-if="uiDistributionMode(rule) !== 'queue'">
                            <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('settings.assignRulesAvailabilitySection') }}</p>
                            <div class="space-y-2">
                              <label v-for="opt in availabilityOptions" :key="opt.key" class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input type="checkbox" class="rounded border-gray-300 text-indigo-600" :checked="ruleAvailability(rule)[opt.key]" @change="setRuleAvailability(rule, opt.key, $event.target.checked)" />
                                {{ opt.label }}
                              </label>
                            </div>
                          </div>
                          <div>
                            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('settings.assignRulesFallbackGroup') }}</p>
                            <select :value="fallbackGroupId(rule)" class="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700" @change="setFallbackGroupId(rule, $event.target.value)">
                              <option value="">{{ t('settings.assignRulesNoFallback') }}</option>
                              <option v-for="g in groups" :key="'fb-' + g._id" :value="String(g._id)">{{ g.name }}</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <!-- Execution mode -->
                      <div class="border-t border-gray-100 px-4 py-3 dark:border-gray-700/60">
                        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('settings.assignRulesExecutionMode') }}</p>
                        <div class="flex flex-wrap gap-4">
                          <label v-for="opt in triggerTypeOptions" :key="opt.value" class="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input v-model="rule.triggerType" type="radio" class="text-indigo-600" :value="opt.value" @change="onTriggerTypeChange(rule, opt.value)" />
                            {{ opt.label }}
                          </label>
                        </div>
                        <div v-if="rule.triggerType === 'delayed'" class="mt-3 flex flex-wrap items-center gap-4">
                          <div>
                            <label class="mb-1 block text-xs text-gray-500">{{ t('settings.assignRulesDelayMinutes') }}</label>
                            <input v-model.number="rule.triggerConfig.delayMinutes" type="number" min="1" class="w-24 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700" />
                          </div>
                          <label class="mt-4 inline-flex items-center gap-2 text-sm">
                            <input v-model="rule.triggerConfig.recheckConditionsAtExecution" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
                            {{ t('settings.assignRulesRecheckBeforeAssign') }}
                          </label>
                        </div>
                        <div v-if="rule.triggerType === 'scheduled'" class="mt-3 space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-600 dark:bg-gray-800/60">
                          <div>
                            <p class="mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('settings.assignRulesScheduleType') }}</p>
                            <div class="flex flex-wrap gap-4">
                              <label v-for="opt in scheduleTypeOptions" :key="opt.value" class="inline-flex cursor-pointer items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input
                                  v-model="rule.triggerConfig.scheduleType"
                                  type="radio"
                                  class="mt-0.5 text-indigo-600"
                                  :value="opt.value"
                                  @change="onScheduleTypeChange(rule, opt.value)"
                                />
                                <span>
                                  <span class="block font-medium">{{ opt.label }}</span>
                                  <span class="block text-xs text-gray-500 dark:text-gray-400">{{ opt.description }}</span>
                                </span>
                              </label>
                            </div>
                          </div>

                          <div v-if="rule.triggerConfig.scheduleType === 'one_time'">
                            <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('settings.assignRulesScheduleRunAt') }}</label>
                            <DateTimePicker
                              :model-value="scheduledRunAtLocal(rule)"
                              :placeholder="t('settings.assignRulesScheduleRunAtPh')"
                              input-class="w-full max-w-sm rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                              @update:model-value="setScheduledRunAtLocal(rule, $event)"
                            />
                          </div>

                          <template v-else>
                            <div>
                              <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('settings.assignRulesFrequency') }}</label>
                              <select
                                v-model="rule.triggerConfig.frequency"
                                class="w-full max-w-sm rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                                @change="onScheduleFrequencyChange(rule)"
                              >
                                <option v-for="opt in frequencyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                              </select>
                            </div>

                            <div v-if="rule.triggerConfig.frequency === 'daily'" class="max-w-sm">
                              <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('settings.assignRulesScheduleTime') }}</label>
                              <input
                                type="time"
                                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                                :value="scheduleTimeValue(rule)"
                                @input="setScheduleTime(rule, $event.target.value)"
                              />
                            </div>

                            <div v-else-if="rule.triggerConfig.frequency === 'weekly'" class="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                              <div>
                                <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('settings.assignRulesScheduleDayOfWeek') }}</label>
                                <select
                                  class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                                  :value="scheduleDayOfWeekValue(rule)"
                                  @change="setScheduleDayOfWeek(rule, $event.target.value)"
                                >
                                  <option v-for="opt in weekdayOptions" :key="opt.value" :value="String(opt.value)">{{ opt.label }}</option>
                                </select>
                              </div>
                              <div>
                                <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('settings.assignRulesScheduleTime') }}</label>
                                <input
                                  type="time"
                                  class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                                  :value="scheduleTimeValue(rule)"
                                  @input="setScheduleTime(rule, $event.target.value)"
                                />
                              </div>
                            </div>

                            <div v-else class="max-w-sm">
                              <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('settings.assignRulesScheduleEveryMinutes') }}</label>
                              <div class="flex items-center gap-2">
                                <input
                                  v-model.number="rule.triggerConfig.everyMinutes"
                                  type="number"
                                  min="1"
                                  class="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                                  @input="onScheduleFrequencyChange(rule)"
                                />
                                <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.assignRulesScheduleMinutesUnit') }}</span>
                              </div>
                              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.assignRulesScheduleEveryMinutesHint') }}</p>
                            </div>
                          </template>

                          <p v-if="scheduledRunSummary(rule)" class="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-200">
                            {{ scheduledRunSummary(rule) }}
                          </p>

                          <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input v-model="rule.triggerConfig.recheckConditionsAtExecution" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
                            {{ t('settings.assignRulesRecheckBeforeAssign') }}
                          </label>
                        </div>
                        <p v-if="rule.triggerType === 'immediate'" class="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                          {{ t('settings.assignRulesImmediateHint') }}
                        </p>
                      </div>
                    </div>
                  </div>
                </template>
              </draggable>

              <div v-if="rules.length > 0" class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                {{ t('settings.assignRulesFooterBanner') }}
              </div>
            </div>
          </div>

          <aside class="hidden w-72 shrink-0 space-y-5 xl:block">
            <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h4 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.assignRulesHowItWorks') }}</h4>
              <ol class="space-y-2.5">
                <li v-for="(step, i) in howItWorksSteps" :key="i" class="flex gap-2.5 text-xs text-gray-600 dark:text-gray-400">
                  <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">{{ i + 1 }}</span>
                  <span>{{ step }}</span>
                </li>
              </ol>
            </div>
            <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h4 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.assignRulesTipsTitle') }}</h4>
              <ul class="space-y-2">
                <li v-for="(tip, i) in tipsList" :key="i" class="flex gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <LightBulbIcon class="h-4 w-4 shrink-0 text-amber-500" />
                  <span>{{ tip }}</span>
                </li>
              </ul>
            </div>
            <div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h4 class="mb-2 text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.assignRulesNeedHelp') }}</h4>
              <ul class="space-y-1.5 text-xs">
                <li><span class="text-indigo-600 dark:text-indigo-400">{{ t('settings.assignRulesUserGuide') }}</span></li>
                <li><span class="text-indigo-600 dark:text-indigo-400">{{ t('settings.assignRulesBestPractices') }}</span></li>
                <li><span class="text-indigo-600 dark:text-indigo-400">{{ t('settings.assignRulesWatchVideo') }}</span></li>
              </ul>
            </div>
          </aside>
        </div>
      </div>

      <SettingsSaveBar :visible="isDirty" :saving="saving" :error="saveError" :reset-label="t('settings.assignRulesReset')" :reset-disabled="loading" :save-disabled="loading" @reset="loadRuleSet" @save="save" />
      </template>
    </div>

    <AssignmentRuleUsersDrawer
      :is-open="usersDrawerOpen"
      :selected-user-ids="usersDrawerRule ? customUserIds(usersDrawerRule) : []"
      :rule-name="usersDrawerRule?.name || ''"
      @close="usersDrawerOpen = false"
      @save="onUsersDrawerSave"
    />
  </div>
</template>

<script setup>
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import AssignmentRuleSetList from '@/components/settings/AssignmentRuleSetList.vue';
import AssignmentRuleUsersDrawer from '@/components/settings/AssignmentRuleUsersDrawer.vue';
import Avatar from '@/components/common/Avatar.vue';
import DateTimePicker from '@/components/common/DateTimePicker.vue';
import DateFilterDropdown from '@/components/common/DateFilterDropdown.vue';
import { SETTINGS_HEADER_CONTENT_GAP_CLASS, SETTINGS_SAVE_BAR_CONTENT_CLASS } from '@/components/settings/settingsSaveBar';
import { parseDateTimeLocal, toDateTimeLocal } from '@/utils/datePickerUtils';
import { parseDateFilterValue } from '@/utils/dateFilterOptions';
import { formatDate } from '@/utils/localeFormat';
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Menu, MenuButton, MenuItem, MenuItems, Switch } from '@headlessui/vue';
import { ChevronDownIcon, LightBulbIcon } from '@heroicons/vue/24/outline';
import draggable from 'vuedraggable';
import apiClient from '@/utils/apiClient';
import { usePeopleTypes } from '@/composables/usePeopleTypes';
import { useNotifications } from '@/composables/useNotifications';
import { resolveModuleLabel } from '@/constants/assignmentRules';

const { t, locale } = useI18n();

const view = ref('list');
const isNewRuleSet = ref(false);
const bootstrapLoading = ref(true);
const listLoading = ref(false);
const ruleSetSummaries = ref([]);

const howItWorksSteps = computed(() => [
  t('settings.assignRulesHowStep1'),
  t('settings.assignRulesHowStep2'),
  t('settings.assignRulesHowStep3'),
  t('settings.assignRulesHowStep4'),
  t('settings.assignRulesHowStep5'),
  t('settings.assignRulesHowStep6')
]);

const tipsList = computed(() => [
  t('settings.assignRulesTip1'),
  t('settings.assignRulesTip2')
]);

const conditionEditor = reactive({});
const CUSTOM_ASSIGN_VALUE = '__custom__';
const usersDrawerOpen = ref(false);
const usersDrawerRule = ref(null);
const tenantUsers = ref([]);

const route = useRoute();
const router = useRouter();
const { success: notifySuccess } = useNotifications();

const MODULE_LABEL_KEYS = {
  cases: 'settings.assignRulesModCases', people: 'settings.assignRulesModPeople', organizations: 'settings.assignRulesModOrganizations',
  deals: 'settings.assignRulesModDeals', tasks: 'settings.assignRulesModTasks', events: 'settings.assignRulesModEvents',
  items: 'settings.assignRulesModItems', forms: 'settings.assignRulesModForms',
  live_chat_sessions: 'settings.assignRulesModLiveChatSessions'
};

const FALLBACK_MODULES = [
  { moduleKey: 'cases', appKey: 'HELPDESK', label: 'Cases' },
  { moduleKey: 'people', appKey: 'SALES', label: 'People' },
  { moduleKey: 'organizations', appKey: 'SALES', label: 'Organizations' },
  { moduleKey: 'deals', appKey: 'SALES', label: 'Deals' },
  { moduleKey: 'tasks', appKey: 'SALES', label: 'Tasks' }
];

const assignmentModules = ref([...FALLBACK_MODULES]);
const moduleFields = ref([]);

const ASSIGNMENT_CONDITION_FIELD_OPTIONS = {
  'HELPDESK:cases': ['priority', 'status', 'caseType', 'channel', 'title', 'caseId', 'contactId', 'organizationRefId', 'assignedTo', 'source'],
  'HELPDESK:people': ['assignedTo', 'lead_owner', 'organization', 'derivedStatus', 'salutation', 'first_name', 'last_name', 'email', 'type', 'sales_type', 'lead_status', 'contact_status', 'helpdesk_role', 'role', 'preferred_contact_method', 'do_not_contact', 'tags'],
  'PLATFORM:people': ['assignedTo', 'lead_owner', 'organization', 'derivedStatus', 'salutation', 'first_name', 'last_name', 'email', 'type', 'sales_type', 'lead_status', 'contact_status', 'helpdesk_role', 'role', 'preferred_contact_method', 'do_not_contact', 'tags'],
  'SALES:people': ['assignedTo', 'lead_owner', 'organization', 'derivedStatus', 'salutation', 'first_name', 'last_name', 'email', 'type', 'sales_type', 'lead_status', 'contact_status', 'helpdesk_role', 'role', 'preferred_contact_method', 'do_not_contact', 'tags'],
  'SALES:organizations': ['name', 'assignedTo', 'types', 'customerStatus', 'partnerStatus', 'vendorStatus', 'derivedStatus', 'territory', 'industry', 'accountManager', 'tags'],
  'SALES:deals': ['name', 'assignedTo', 'stage', 'pipeline', 'status', 'priority', 'amount', 'probability', 'accountId', 'contactId', 'type', 'derivedStatus', 'currency', 'tags'],
  'SALES:tasks': ['title', 'assignedTo', 'status', 'priority', 'dueDate', 'projectId', 'relatedTo.type', 'tags'],
  'SALES:events': ['title', 'status', 'name'], 'SALES:items': ['name', 'status'], 'SALES:forms': ['name', 'status'],
  'PLATFORM:live_chat_sessions': ['queueKey', 'queueId', 'lifecycleStatus', 'channel', 'pageUrl', 'sessionKey', 'assignedAgentId', 'visitor.email', 'visitor.name', 'status'],
  _fallback: ['status', 'title', 'name']
};

function condFieldI18nKey(value) {
  const parts = String(value).replace(/\./g, '_').split('_').filter(Boolean);
  return `settings.assignRulesCondField${parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')}`;
}

function getConditionFieldOptions() {
  return conditionFieldOptions.value.map((row) => row.value);
}

function fieldMeta(fieldKey) {
  return moduleFields.value.find((field) => field.key === fieldKey) || null;
}

function moduleExists(appKey, moduleKey) {
  const app = String(appKey || '').toUpperCase();
  const mod = String(moduleKey || '').toLowerCase();
  return assignmentModules.value.some(
    (row) => String(row.appKey || '').toUpperCase() === app && String(row.moduleKey || '').toLowerCase() === mod
  );
}

function ensureValidScope() {
  const appRows = assignmentModules.value.filter((row) => String(row.appKey || '').toUpperCase() === scopeApp.value);
  if (!appRows.some((row) => row.moduleKey === scopeModule.value)) {
    scopeModule.value = appRows[0]?.moduleKey || assignmentModules.value[0]?.moduleKey || 'cases';
  }
  if (!assignmentModules.value.some((row) => String(row.appKey || '').toUpperCase() === scopeApp.value)) {
    scopeApp.value = String(assignmentModules.value[0]?.appKey || 'HELPDESK').toUpperCase();
  }
}

const CASE_PRIORITY_VALUES = ['Low', 'Medium', 'High', 'Critical'];
const CASE_STATUS_VALUES = ['New', 'Assigned', 'In Progress', 'On Hold', 'Waiting for Customer', 'Resolved', 'Closed'];
const CASE_TYPE_VALUES = ['Support Ticket', 'Complaint', 'Service Request', 'Warranty Claim', 'Internal Case'];
const CASE_CHANNEL_VALUES = ['Email', 'Live Chat', 'Phone', 'Customer Portal', 'Partner Portal', 'Internal'];
const PEOPLE_LEAD_STATUS_VALUES = ['New', 'Contacted', 'Qualified', 'Disqualified', 'Nurturing', 'Re-Engage'];
const PEOPLE_CONTACT_STATUS_VALUES = ['Active', 'Inactive', 'DoNotContact'];
const PEOPLE_SALUTATION_VALUES = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.', 'Mx.', 'Other'];
const PEOPLE_CONTACT_ROLE_VALUES = ['Decision Maker', 'Influencer', 'Support', 'Other'];
const PEOPLE_PREFERRED_CONTACT_VALUES = ['Email', 'Phone', 'WhatsApp', 'SMS', 'None'];
const PEOPLE_SALES_CLASSIFIER_FALLBACK = ['Lead', 'Contact'];
const PEOPLE_HELPDESK_ROLE_FALLBACK = ['Customer', 'Agent'];

const ASSIGNMENT_CONDITION_VALUE_ENUMS = {
  'HELPDESK:cases': { priority: CASE_PRIORITY_VALUES, status: CASE_STATUS_VALUES, caseType: CASE_TYPE_VALUES, channel: CASE_CHANNEL_VALUES },
  'SALES:deals': { status: ['Open', 'Won', 'Lost'], priority: ['Low', 'Medium', 'High', 'Urgent'], type: ['New Business', 'Existing Customer', 'Existing Business', 'Upsell', 'Renewal', 'Cross-Sell'] },
  'SALES:tasks': { status: ['todo', 'in_progress', 'waiting', 'completed', 'cancelled'], priority: ['low', 'medium', 'high', 'urgent'], 'relatedTo.type': ['contact', 'deal', 'project', 'organization', 'none'] },
  'SALES:organizations': { customerStatus: ['Prospect', 'Active', 'On Hold', 'At Risk', 'Inactive', 'Churned'], partnerStatus: ['Invited', 'Onboarding', 'Active', 'Paused', 'Inactive'], vendorStatus: ['Prospect', 'Onboarding', 'Approved', 'Suspended', 'Inactive', 'Rejected'] },
  'SALES:people': { salutation: PEOPLE_SALUTATION_VALUES, lead_status: PEOPLE_LEAD_STATUS_VALUES, contact_status: PEOPLE_CONTACT_STATUS_VALUES, role: PEOPLE_CONTACT_ROLE_VALUES, preferred_contact_method: PEOPLE_PREFERRED_CONTACT_VALUES }
};

function getConditionValueEnumList(appKey, moduleKey, fieldPath) {
  const scopeKey = `${String(appKey || '').toUpperCase()}:${String(moduleKey || '').toLowerCase()}`;
  const f = String(fieldPath || '').trim();
  const map = ASSIGNMENT_CONDITION_VALUE_ENUMS[scopeKey];
  if (!f) return null;
  // Global fallbacks for common picklist-like keys (when module metadata lacks options).
  if (f === 'priority') {
    return CASE_PRIORITY_VALUES.map((v) => ({ value: v, label: v }));
  }
  const list = map?.[f];
  if ((!list || !Array.isArray(list) || list.length === 0)) {
    const mk = String(moduleKey || '').toLowerCase();
    if (mk === 'cases') {
      const casesMap = { priority: CASE_PRIORITY_VALUES, status: CASE_STATUS_VALUES, caseType: CASE_TYPE_VALUES, channel: CASE_CHANNEL_VALUES };
      const fallback = casesMap[f];
      return Array.isArray(fallback) && fallback.length > 0 ? fallback.map((v) => ({ value: v, label: v })) : null;
    }
    if (mk === 'deals') {
      const dealsMap = { status: ['Open', 'Won', 'Lost'], priority: ['Low', 'Medium', 'High', 'Urgent'], type: ['New Business', 'Existing Customer', 'Existing Business', 'Upsell', 'Renewal', 'Cross-Sell'] };
      const fallback = dealsMap[f];
      return Array.isArray(fallback) && fallback.length > 0 ? fallback.map((v) => ({ value: v, label: v })) : null;
    }
    if (mk === 'tasks') {
      const tasksMap = { status: ['todo', 'in_progress', 'waiting', 'completed', 'cancelled'], priority: ['low', 'medium', 'high', 'urgent'], 'relatedTo.type': ['contact', 'deal', 'project', 'organization', 'none'] };
      const fallback = tasksMap[f];
      return Array.isArray(fallback) && fallback.length > 0 ? fallback.map((v) => ({ value: v, label: v })) : null;
    }
    if (mk === 'organizations') {
      const orgMap = { customerStatus: ['Prospect', 'Active', 'On Hold', 'At Risk', 'Inactive', 'Churned'], partnerStatus: ['Invited', 'Onboarding', 'Active', 'Paused', 'Inactive'], vendorStatus: ['Prospect', 'Onboarding', 'Approved', 'Suspended', 'Inactive', 'Rejected'] };
      const fallback = orgMap[f];
      return Array.isArray(fallback) && fallback.length > 0 ? fallback.map((v) => ({ value: v, label: v })) : null;
    }
    if (mk === 'people') {
      const peopleMap = { salutation: PEOPLE_SALUTATION_VALUES, lead_status: PEOPLE_LEAD_STATUS_VALUES, contact_status: PEOPLE_CONTACT_STATUS_VALUES, role: PEOPLE_CONTACT_ROLE_VALUES, preferred_contact_method: PEOPLE_PREFERRED_CONTACT_VALUES };
      const fallback = peopleMap[f];
      return Array.isArray(fallback) && fallback.length > 0 ? fallback.map((v) => ({ value: v, label: v })) : null;
    }
    return null;
  }
  return Array.isArray(list) && list.length > 0 ? list.map((v) => ({ value: v, label: v })) : null;
}

function clauseValuePlaceholder(clause) {
  const op = String(clause?.operator || 'equals');
  return op === 'in' || op === 'not_in' ? t('settings.assignRulesValueArrayPh') : t('settings.assignRulesValuePh');
}

function clauseMultiPickerQuery(clause) {
  if (!clause) return '';
  if (typeof clause._mpQuery !== 'string') clause._mpQuery = '';
  return clause._mpQuery;
}

function setClauseMultiPickerQuery(clause, value) {
  if (!clause) return;
  clause._mpQuery = String(value || '');
}

function clauseMultiPickerOpen(clause) {
  if (!clause) return false;
  return !!clause._mpOpen;
}

function toggleClauseMultiPicker(clause) {
  if (!clause) return;
  clause._mpOpen = !clause._mpOpen;
}

function closeClauseMultiPicker(clause) {
  if (!clause) return;
  clause._mpOpen = false;
  clause._mpQuery = '';
}

function clauseMultiPickerValues(clause) {
  normalizeClauseValueForFieldAndOperator(clause);
  return Array.isArray(clause?.value) ? clause.value : [];
}

function removeMultiPickValue(clause, value) {
  const current = clauseMultiPickerValues(clause);
  clause.value = current.filter((v) => String(v) !== String(value));
}

function toggleMultiPickValue(clause, value) {
  const current = clauseMultiPickerValues(clause);
  const str = String(value);
  const exists = current.some((v) => String(v) === str);
  clause.value = exists ? current.filter((v) => String(v) !== str) : [...current, str];
}

function clauseMultiPickerFilteredOptions(clause) {
  const opts = clauseValueMultiOptionList(clause) || [];
  const q = String(clauseMultiPickerQuery(clause) || '').trim().toLowerCase();
  if (!q) return opts;
  return opts.filter((o) => String(o?.label ?? o?.value ?? '').toLowerCase().includes(q));
}

function clauseMultiPickerCreateCandidate(clause) {
  const raw = String(clauseMultiPickerQuery(clause) || '').trim();
  if (!raw) return '';
  const current = clauseMultiPickerValues(clause);
  if (current.some((v) => String(v).toLowerCase() === raw.toLowerCase())) return '';
  return raw;
}

function createMultiPickValueFromQuery(clause) {
  const candidate = clauseMultiPickerCreateCandidate(clause);
  if (!candidate) return;
  toggleMultiPickValue(clause, candidate);
  setClauseMultiPickerQuery(clause, '');
}

function onClauseOperatorChange(clause) {
  const op = String(clause.operator || '').toLowerCase();
  if (op === 'exists') {
    clause.value = '';
    return;
  }
  normalizeClauseValueForFieldAndOperator(clause);
}

function appLabel(appKey) {
  const key = String(appKey || '').toUpperCase();
  if (key === 'HELPDESK') return t('settings.assignRulesAppHelpdesk');
  if (key === 'SALES') return t('settings.assignRulesAppSales');
  if (key === 'PLATFORM') return t('settings.assignRulesAppPlatform');
  return key;
}

function moduleLabelForSet(set) {
  const mod = assignmentModules.value.find(
    (row) => row.moduleKey === set.moduleKey && String(row.appKey || '').toUpperCase() === String(set.appKey || '').toUpperCase()
  );
  return resolveModuleLabel(mod || { moduleKey: set.moduleKey }, t, MODULE_LABEL_KEYS);
}

function moduleLabelForScope() {
  const mod = assignmentModules.value.find(
    (row) => row.moduleKey === scopeModule.value && String(row.appKey || '').toUpperCase() === scopeApp.value
  );
  return resolveModuleLabel(mod || { moduleKey: scopeModule.value }, t, MODULE_LABEL_KEYS);
}

async function loadRuleSetList() {
  listLoading.value = true;
  try {
    const res = await apiClient.get('/settings/automation/assignment-rules/list');
    ruleSetSummaries.value = res?.success && Array.isArray(res.data) ? res.data : [];
  } catch {
    ruleSetSummaries.value = [];
  } finally {
    listLoading.value = false;
  }
}

function syncEditorToRoute() {
  router.replace({
    path: '/settings',
    query: {
      ...route.query,
      tab: 'automation',
      automationView: 'assignment-rules',
      assignmentApp: scopeApp.value,
      assignmentModule: scopeModule.value
    }
  });
}

function clearEditorRoute() {
  const nextQuery = { ...route.query, tab: 'automation', automationView: 'assignment-rules' };
  delete nextQuery.assignmentApp;
  delete nextQuery.assignmentModule;
  router.replace({ path: '/settings', query: nextQuery });
}

async function openCreateRuleSet() {
  isNewRuleSet.value = true;
  loadError.value = '';
  ensureValidScope();
  meta.enabled = true;
  meta.applyStrategy = 'new_records_only';
  rules.value = [];
  Object.keys(expanded).forEach((k) => delete expanded[k]);
  Object.keys(conditionEditor).forEach((k) => delete conditionEditor[k]);
  view.value = 'editor';
  syncingFromUrl.value = true;
  syncEditorToRoute();
  loading.value = true;
  try {
    await Promise.all([loadMetadata(), fetchGroups(), fetchTenantUsers()]);
    await syncExistingScopeRulesOnCreate();
    lastSavedFingerprint.value = saveStateFingerprint();
  } catch (e) {
    loadError.value = e?.message || t('settings.assignRulesLoadFailed');
    lastSavedFingerprint.value = null;
  } finally {
    loading.value = false;
    await nextTick();
    syncingFromUrl.value = false;
  }
}

function applyExistingScopeRuleSet(row) {
  meta.enabled = row.enabled !== false;
  meta.applyStrategy = row.applyStrategy || 'new_records_only';
  rules.value = (Array.isArray(row.rules) ? row.rules : [])
    .map((r, i) => normalizeRule(r, i))
    .sort((a, b) => a.order - b.order);
  Object.keys(expanded).forEach((k) => delete expanded[k]);
  Object.keys(conditionEditor).forEach((k) => delete conditionEditor[k]);
  if (rules.value.length > 0) expanded[rules.value[0].ruleId] = true;
  lastSavedFingerprint.value = saveStateFingerprint();
}

async function syncExistingScopeRulesOnCreate() {
  if (!isNewRuleSet.value || view.value !== 'editor') return;

  try {
    const res = await apiClient.get('/settings/automation/assignment-rules', {
      params: { appKey: scopeApp.value, moduleKey: scopeModule.value }
    });
    const row = res?.success ? res.data : null;
    if (!row?._id) {
      rules.value = [];
      meta.enabled = true;
      meta.applyStrategy = 'new_records_only';
      lastSavedFingerprint.value = saveStateFingerprint();
      return;
    }

    const sortedRules = (Array.isArray(row.rules) ? row.rules : [])
      .slice()
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

    if (sortedRules.length === 0) {
      rules.value = [];
      meta.enabled = row.enabled !== false;
      meta.applyStrategy = row.applyStrategy || 'new_records_only';
      lastSavedFingerprint.value = saveStateFingerprint();
      return;
    }

    applyExistingScopeRuleSet(row);
  } catch {
    /* keep current scope selection */
  }
}

function openEditRuleSet(appKey, moduleKey) {
  isNewRuleSet.value = false;
  scopeApp.value = String(appKey || '').toUpperCase();
  scopeModule.value = String(moduleKey || '').toLowerCase();
  view.value = 'editor';
  syncEditorToRoute();
  loadMetadata();
  loadRuleSet();
}

function backToList() {
  view.value = 'list';
  isNewRuleSet.value = false;
  clearEditorRoute();
  loadRuleSetList();
}

const appOptions = computed(() => {
  const apps = new Map();
  for (const mod of assignmentModules.value) {
    const key = String(mod.appKey || '').toUpperCase();
    if (!key || apps.has(key)) continue;
    const label = key === 'HELPDESK'
      ? t('settings.assignRulesAppHelpdesk')
      : key === 'SALES'
        ? t('settings.assignRulesAppSales')
        : key;
    apps.set(key, label);
  }
  return Array.from(apps.entries()).map(([key, label]) => ({ key, label }));
});

const moduleOptionsForApp = computed(() =>
  assignmentModules.value
    .filter((mod) => String(mod.appKey || '').toUpperCase() === scopeApp.value)
    .map((mod) => ({
      key: mod.moduleKey,
      label: resolveModuleLabel(mod, t, MODULE_LABEL_KEYS)
    }))
);

const conditionFieldOptions = computed(() => {
  const scopeKey = `${String(scopeApp.value || '').toUpperCase()}:${String(scopeModule.value || '').toLowerCase()}`;
  const fromApi = moduleFields.value.length > 0
    ? moduleFields.value.map((field) => ({
      value: field.key,
      label: field.label || field.key
    }))
    : [];
  const apiKeys = new Set(fromApi.map((row) => row.value));
  const fallbackKeys = ASSIGNMENT_CONDITION_FIELD_OPTIONS[scopeKey] || ASSIGNMENT_CONDITION_FIELD_OPTIONS._fallback;
  const extras = fallbackKeys
    .filter((key) => !apiKeys.has(key))
    .map((value) => ({ value, label: t(condFieldI18nKey(value)) }));
  const merged = [...fromApi, ...extras];
  if (merged.length > 0) {
    return merged.sort((a, b) => String(a.label).localeCompare(String(b.label)));
  }
  const fallback = ASSIGNMENT_CONDITION_FIELD_OPTIONS[scopeKey] || ASSIGNMENT_CONDITION_FIELD_OPTIONS._fallback;
  return fallback.map((value) => ({ value, label: t(condFieldI18nKey(value)) }));
});

const operators = computed(() => [
  { value: 'equals', label: t('settings.assignRulesOpEquals') },
  { value: 'not_equals', label: t('settings.assignRulesOpNotEquals') },
  { value: 'contains', label: t('settings.assignRulesOpContains') },
  { value: 'in', label: t('settings.assignRulesOpIn') },
  { value: 'not_in', label: t('settings.assignRulesOpNotIn') },
  { value: 'exists', label: t('settings.assignRulesOpExists') },
  { value: 'gt', label: t('settings.assignRulesOpGt') },
  { value: 'gte', label: t('settings.assignRulesOpGte') },
  { value: 'lt', label: t('settings.assignRulesOpLt') },
  { value: 'lte', label: t('settings.assignRulesOpLte') }
]);

const applyStrategyOptions = computed(() => [
  { value: 'new_records_only', label: t('settings.assignRulesStrategyNewOnly') },
  { value: 'manual_re_evaluation', label: t('settings.assignRulesStrategyManual') },
  { value: 'freeze_mode', label: t('settings.assignRulesStrategyFreeze') }
]);

const triggerTypeOptions = computed(() => [
  { value: 'immediate', label: t('settings.assignRulesTriggerImmediate') },
  { value: 'delayed', label: t('settings.assignRulesTriggerDelayed') },
  { value: 'scheduled', label: t('settings.assignRulesTriggerScheduled') }
]);

const scheduleTypeOptions = computed(() => [
  { value: 'one_time', label: t('settings.assignRulesScheduleOneTime'), description: t('settings.assignRulesScheduleOneTimeHint') },
  { value: 'recurring', label: t('settings.assignRulesScheduleRecurring'), description: t('settings.assignRulesScheduleRecurringHint') }
]);

const frequencyOptions = computed(() => [
  { value: 'daily', label: t('settings.assignRulesFreqDaily') },
  { value: 'weekly', label: t('settings.assignRulesFreqWeekly') },
  { value: 'custom', label: t('settings.assignRulesFreqCustom') }
]);

const weekdayOptions = computed(() => {
  const formatter = new Intl.DateTimeFormat(locale.value, { weekday: 'long' });
  return [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
    value: dow,
    label: formatter.format(new Date(2026, 0, 4 + dow))
  }));
});

const combinatorOptions = computed(() => [
  { value: 'all', label: t('settings.assignRulesMatchAll') },
  { value: 'any', label: t('settings.assignRulesMatchAny') }
]);

const uiDistributionModeOptions = computed(() => [
  { value: 'round_robin', label: t('settings.assignRulesDistRoundRobin') },
  { value: 'load_balanced', label: t('settings.assignRulesDistLoadBalanced') },
  { value: 'weighted', label: t('settings.assignRulesDistWeighted') },
  { value: 'queue', label: t('settings.assignRulesDistQueue') }
]);

const availabilityOptions = computed(() => [
  { key: 'skipInactive', label: t('settings.assignRulesSkipInactive') },
  { key: 'skipOnLeave', label: t('settings.assignRulesSkipOnLeave') },
  { key: 'respectBusinessHours', label: t('settings.assignRulesRespectBusinessHours') },
  { key: 'respectTimezone', label: t('settings.assignRulesRespectTimezone') }
]);

const scopeApp = ref('HELPDESK');
const scopeModule = ref('cases');

const { types: salesPeopleTypeValues } = usePeopleTypes('SALES');
const { types: helpdeskPeopleTypeValues } = usePeopleTypes('HELPDESK');

function resolveConditionValueOptions(appKey, moduleKey, fieldKey) {
  const field = String(fieldKey || '').trim();
  if (!field) return null;
  const ak = String(appKey || '').toUpperCase();
  const mk = String(moduleKey || '').toLowerCase();
  if (mk === 'people') {
    if (field === 'sales_type' || field === 'type') {
      const types = (ak === 'SALES' && salesPeopleTypeValues.value?.length)
        ? salesPeopleTypeValues.value
        : PEOPLE_SALES_CLASSIFIER_FALLBACK;
      return types.map((v) => ({ value: v, label: v }));
    }
    if (field === 'helpdesk_role') {
      const types = (helpdeskPeopleTypeValues.value?.length)
        ? helpdeskPeopleTypeValues.value
        : PEOPLE_HELPDESK_ROLE_FALLBACK;
      return types.map((v) => ({ value: v, label: v }));
    }
    if (field === 'do_not_contact') {
      return [{ value: 'true', label: t('settings.assignRulesYes') }, { value: 'false', label: t('settings.assignRulesNo') }];
    }
  }
  const meta = fieldMeta(field);
  if (meta?.options?.length) {
    return meta.options.map((opt) => {
      const value = typeof opt === 'object' ? (opt.value ?? opt.label) : opt;
      const label = typeof opt === 'object' ? (opt.label ?? opt.value) : opt;
      return { value, label };
    });
  }
  if (String(meta?.dataType || '').toLowerCase() === 'boolean') {
    return [{ value: 'true', label: t('settings.assignRulesYes') }, { value: 'false', label: t('settings.assignRulesNo') }];
  }
  return getConditionValueEnumList(appKey, moduleKey, field);
}

function clauseValueOptionList(clause) {
  const op = String(clause?.operator || 'equals');
  if (op === 'exists' || op === 'in' || op === 'not_in') return null;
  if (clauseFieldIsCustom(clause)) return null;
  if (clauseFieldDataType(clause) === 'multi-picklist') return null;
  const field = String(clause?.field || '').trim();
  return field ? resolveConditionValueOptions(scopeApp.value, scopeModule.value, field) : null;
}

function clauseValueMultiOptionList(clause) {
  const op = String(clause?.operator || 'equals');
  if (clauseFieldIsCustom(clause)) return null;
  const dt = clauseFieldDataType(clause);
  if (dt !== 'multi-picklist' && op !== 'in' && op !== 'not_in') return null;
  const field = String(clause?.field || '').trim();
  return field ? resolveConditionValueOptions(scopeApp.value, scopeModule.value, field) : null;
}

function isMultiValueOperator(operator) {
  const op = String(operator || '').toLowerCase();
  return op === 'in' || op === 'not_in';
}

function clauseFieldDataType(clause) {
  if (clauseFieldIsCustom(clause)) return 'text';
  const field = String(clause?.field || '').trim();
  const meta = field ? fieldMeta(field) : null;
  return String(meta?.dataType || 'text').toLowerCase();
}

function normalizeClauseValueForFieldAndOperator(clause) {
  if (!clause) return clause;
  const dt = clauseFieldDataType(clause);
  const op = String(clause.operator || '').toLowerCase();
  const multi = dt === 'multi-picklist' || op === 'in' || op === 'not_in';
  if (multi) {
    if (Array.isArray(clause.value)) return clause;
    if (typeof clause.value === 'string' && clause.value.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(clause.value);
        clause.value = Array.isArray(parsed) ? parsed : [];
        return clause;
      } catch { /* ignore */ }
    }
    clause.value = clause.value ? [clause.value] : [];
    return clause;
  }
  if (Array.isArray(clause.value)) clause.value = clause.value[0] ?? '';
  return clause;
}

function clauseValueInputType(clause) {
  const dt = clauseFieldDataType(clause);
  if (dt === 'number' || dt === 'currency' || dt === 'percent') return 'number';
  // date/datetime use DateFilterDropdown — keep text fallback type for safety
  return 'text';
}

function normalizeDateFilterModel(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'object') return parseDateFilterValue(v) || v;
  return parseDateFilterValue(v);
}

function inferClauseFieldSelect(field) {
  const f = String(field || '').trim();
  if (!f) return 'preset';
  return getConditionFieldOptions().includes(f) ? 'preset' : 'custom';
}

function clauseFieldPresetValue(clause) {
  if (clause._fieldSelect === 'custom') return '__custom__';
  const f = String(clause?.field || '').trim();
  if (!f) return '';
  return conditionFieldOptions.value.some((o) => o.value === f) ? f : '__custom__';
}

function onClauseFieldPresetChange(clause, event) {
  const v = event.target.value;
  if (v === '__custom__') { clause._fieldSelect = 'custom'; clause.field = ''; return; }
  if (v === '') { clause._fieldSelect = 'preset'; clause.field = ''; return; }
  clause._fieldSelect = 'preset';
  clause.field = v;
  normalizeClauseValueForFieldAndOperator(clause);
  const list = resolveConditionValueOptions(scopeApp.value, scopeModule.value, v);
  const op = String(clause.operator || '').toLowerCase();
  if (op === 'in' || op === 'not_in') {
    if (!Array.isArray(clause.value)) clause.value = [];
    if (list && Array.isArray(clause.value)) {
      clause.value = clause.value.filter((x) => list.some((o) => String(o.value) === String(x)));
    }
    return;
  }
  if (list && clause.value !== '' && clause.value != null && !list.some((o) => String(o.value) === String(clause.value))) clause.value = '';
}

function clauseFieldIsCustom(clause) {
  return clauseFieldPresetValue(clause) === '__custom__';
}

function defaultAvailability() {
  return { skipInactive: true, skipOnLeave: true, respectBusinessHours: false, respectTimezone: true, _savedMode: null };
}

function ruleAvailability(rule) {
  if (!rule.metadata?.availability) rule.metadata = { ...rule.metadata, availability: defaultAvailability() };
  return rule.metadata.availability;
}

function setRuleAvailability(rule, key, checked) {
  const avail = ruleAvailability(rule);
  avail[key] = checked;
  if (key === 'respectBusinessHours') {
    if (checked && rule.distribution.mode !== 'queue') {
      if (rule.distribution.mode !== 'availability_based') { avail._savedMode = rule.distribution.mode; rule.distribution.mode = 'availability_based'; }
    } else if (!checked && rule.distribution.mode === 'availability_based') {
      rule.distribution.mode = avail._savedMode || 'round_robin';
      avail._savedMode = null;
    }
  }
}

function uiDistributionMode(rule) {
  if (rule.distribution.mode === 'availability_based') return rule.metadata?.availability?._savedMode || 'round_robin';
  return rule.distribution.mode || 'round_robin';
}

function setUiDistributionMode(rule, mode) {
  if (rule.metadata?.availability?.respectBusinessHours && mode !== 'queue') {
    rule.metadata.availability._savedMode = mode;
    rule.distribution.mode = 'availability_based';
  } else {
    rule.distribution.mode = mode;
  }
}

function groupName(groupId) {
  return groups.value.find((row) => String(row._id) === String(groupId))?.name || '';
}

function groupMembers(groupId) {
  const g = groups.value.find((row) => String(row._id) === String(groupId));
  if (!g?.members?.length) return [];
  return g.members.map((m) => {
    const id = String(m._id || m);
    const name = m.firstName || m.lastName ? [m.firstName, m.lastName].filter(Boolean).join(' ') : (m.username || m.email || id);
    return { id, name, user: typeof m === 'object' ? m : { _id: id } };
  });
}

function ensureRuleMetadata(rule) {
  if (!rule.metadata || typeof rule.metadata !== 'object') rule.metadata = {};
}

function isCustomAssignTarget(rule) {
  return rule.metadata?.assignTargetType === 'custom' || customUserIds(rule).length > 0;
}

function customUserIds(rule) {
  return Array.isArray(rule.metadata?.customUserIds) ? rule.metadata.customUserIds.map(String) : [];
}

function assignTargetSelectValue(rule) {
  if (isCustomAssignTarget(rule)) return CUSTOM_ASSIGN_VALUE;
  return rule.primaryGroupId || '';
}

function onAssignTargetChange(rule, event) {
  const value = event.target.value;
  ensureRuleMetadata(rule);
  if (value === CUSTOM_ASSIGN_VALUE) {
    rule.metadata.assignTargetType = 'custom';
    if (!Array.isArray(rule.metadata.customUserIds)) rule.metadata.customUserIds = [];
    rule.primaryGroupId = '';
    delete rule.metadata.enabledMemberIds;
    openUsersDrawer(rule);
    return;
  }
  rule.metadata.assignTargetType = 'group';
  rule.metadata.customUserIds = [];
  rule.primaryGroupId = value;
  initEnabledMembersForGroup(rule, value);
}

function enabledMemberIds(rule) {
  const ids = rule.metadata?.enabledMemberIds;
  if (!Array.isArray(ids)) return null;
  return ids.map(String).filter(Boolean);
}

function isMemberEnabled(rule, memberId) {
  const enabled = enabledMemberIds(rule);
  if (enabled === null) return true;
  return enabled.includes(String(memberId));
}

function initEnabledMembersForGroup(rule, groupId) {
  ensureRuleMetadata(rule);
  rule.metadata.enabledMemberIds = groupMembers(groupId).map((m) => m.id);
}

function ensureEnabledMemberIds(rule) {
  ensureRuleMetadata(rule);
  if (!Array.isArray(rule.metadata.enabledMemberIds) && rule.primaryGroupId) {
    initEnabledMembersForGroup(rule, rule.primaryGroupId);
  }
}

function toggleMemberEnabled(rule, memberId, checked) {
  ensureEnabledMemberIds(rule);
  const id = String(memberId);
  if (checked) {
    if (!rule.metadata.enabledMemberIds.includes(id)) {
      rule.metadata.enabledMemberIds = [...rule.metadata.enabledMemberIds, id];
    }
  } else {
    rule.metadata.enabledMemberIds = rule.metadata.enabledMemberIds.filter((x) => x !== id);
  }
}

function enabledMembersCount(rule) {
  if (isCustomAssignTarget(rule)) return customUserIds(rule).length;
  const all = groupMembers(rule.primaryGroupId);
  const enabled = enabledMemberIds(rule);
  if (enabled === null) return all.length;
  return all.filter((m) => enabled.includes(m.id)).length;
}

function membersSummary(rule) {
  const total = ruleMembers(rule).length;
  const enabled = enabledMembersCount(rule);
  if (enabled === total) return String(total);
  return t('settings.assignRulesMembersCount', { enabled, total });
}

function hasAssignTarget(rule) {
  return isCustomAssignTarget(rule) ? customUserIds(rule).length > 0 : Boolean(rule.primaryGroupId);
}

function ruleMembers(rule) {
  if (isCustomAssignTarget(rule)) {
    return customUserIds(rule).map((id) => {
      const user = tenantUsers.value.find((u) => String(u._id) === id);
      const name = user
        ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || id
        : id;
      return { id, name, user: user || { _id: id } };
    });
  }
  return groupMembers(rule.primaryGroupId);
}

function openUsersDrawer(rule) {
  usersDrawerRule.value = rule;
  ensureRuleMetadata(rule);
  rule.metadata.assignTargetType = 'custom';
  rule.primaryGroupId = '';
  usersDrawerOpen.value = true;
}

function onUsersDrawerSave(userIds) {
  if (!usersDrawerRule.value) return;
  ensureRuleMetadata(usersDrawerRule.value);
  usersDrawerRule.value.metadata.customUserIds = userIds.map(String);
  usersDrawerRule.value.metadata.assignTargetType = 'custom';
  usersDrawerRule.value.primaryGroupId = '';
}

function removeCustomUser(rule, userId) {
  ensureRuleMetadata(rule);
  rule.metadata.customUserIds = customUserIds(rule).filter((id) => id !== String(userId));
}

function memberWeight(rule, userId) {
  return (rule.distribution.userWeights || []).find((w) => String(w.userId) === String(userId))?.weight ?? 0;
}

function setMemberWeight(rule, userId, raw) {
  const weight = Math.max(0, Math.min(100, Number(raw) || 0));
  if (!Array.isArray(rule.distribution.userWeights)) rule.distribution.userWeights = [];
  const idx = rule.distribution.userWeights.findIndex((w) => String(w.userId) === String(userId));
  if (idx >= 0) rule.distribution.userWeights[idx].weight = weight;
  else rule.distribution.userWeights.push({ userId, weight });
}

function fallbackGroupId(rule) {
  return rule.fallbackGroupIds?.[0] ? String(rule.fallbackGroupIds[0]) : '';
}

function setFallbackGroupId(rule, value) {
  rule.fallbackGroupIds = value ? [value] : [];
}

function formatClauseChip(clause) {
  const field = String(clause.field || '').trim();
  if (!field) return '';
  const fieldLabel = conditionFieldOptions.value.find((o) => o.value === field)?.label || field;
  let op = '=';
  if (clause.operator === 'not_equals') op = '!=';
  else if (clause.operator !== 'equals') op = clause.operator;
  if (clause.operator === 'exists') return `${fieldLabel} exists`;
  const val = clause.value === '' || clause.value == null ? '…' : String(clause.value);
  return `${fieldLabel} ${op} ${val}`;
}

function combinatorChipLabel(rule) {
  return rule.conditions.combinator === 'any' ? 'OR' : 'AND';
}

function openConditionEditor(ruleId) {
  conditionEditor[ruleId] = true;
  expanded[ruleId] = true;
}

function onRulesReorder() {
  rules.value.forEach((rule, index) => { rule.order = index; });
}

const syncingFromUrl = ref(false);
const loading = ref(false);
const loadError = ref('');
const saving = ref(false);
const saveError = ref('');
const lastSavedFingerprint = ref(null);
const groups = ref([]);
const meta = reactive({ enabled: true, applyStrategy: 'new_records_only' });
const rules = ref([]);
const expanded = reactive({});

function toggleExpand(ruleId) {
  expanded[ruleId] = !expanded[ruleId];
}

function defaultTriggerConfig(triggerType) {
  const base = {
    delayMinutes: 5,
    scheduleType: 'recurring',
    frequency: 'daily',
    cron: '0 10 * * *',
    runAt: null,
    everyMinutes: 60,
    scheduleTime: '10:00',
    scheduleDayOfWeek: 1,
    evaluateScope: null,
    recheckConditionsAtExecution: true
  };
  if (triggerType === 'immediate') return { ...base, delayMinutes: null, scheduleType: null, frequency: null, cron: null, runAt: null, everyMinutes: null, scheduleTime: null, scheduleDayOfWeek: null };
  if (triggerType === 'delayed') return { ...base, scheduleType: null, frequency: null, cron: null, runAt: null, everyMinutes: null, scheduleTime: null, scheduleDayOfWeek: null };
  return base;
}

function migrateScheduleConfigFromCron(triggerConfig) {
  const tc = triggerConfig && typeof triggerConfig === 'object' ? { ...triggerConfig } : {};
  if (tc.scheduleTime || !tc.cron) return tc;
  const parts = String(tc.cron).trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] !== '*' && parts[1] !== '*') {
    const minute = String(parts[0]).padStart(2, '0');
    const hour = String(parts[1]).padStart(2, '0');
    tc.scheduleTime = `${hour}:${minute}`;
  }
  if (parts.length >= 5 && parts[4] !== '*') {
    const dow = Number(parts[4]);
    if (Number.isFinite(dow)) tc.scheduleDayOfWeek = dow;
  }
  return tc;
}

function ensureScheduledTriggerConfig(rule) {
  const tc = rule.triggerConfig && typeof rule.triggerConfig === 'object' ? rule.triggerConfig : {};
  if (!tc.scheduleType) tc.scheduleType = 'recurring';
  if (!tc.frequency) tc.frequency = 'daily';
  if (!tc.scheduleTime) tc.scheduleTime = '10:00';
  if (tc.scheduleDayOfWeek == null || tc.scheduleDayOfWeek === '') tc.scheduleDayOfWeek = 1;
  if (!Number.isFinite(Number(tc.everyMinutes)) || Number(tc.everyMinutes) < 1) tc.everyMinutes = 60;
  if (tc.recheckConditionsAtExecution == null) tc.recheckConditionsAtExecution = true;
  rule.triggerConfig = tc;
  syncScheduledRunAt(rule);
}

function computeNextScheduledRunAt(triggerConfig, from = new Date()) {
  const tc = triggerConfig || {};
  const frequency = tc.frequency || 'daily';
  if (frequency === 'custom') {
    const minutes = Math.max(1, Number(tc.everyMinutes) || 60);
    return new Date(from.getTime() + minutes * 60 * 1000);
  }
  const [hourPart, minutePart] = String(tc.scheduleTime || '10:00').split(':');
  const hours = Number.parseInt(hourPart, 10);
  const minutes = Number.parseInt(minutePart, 10);
  const next = new Date(from);
  next.setSeconds(0, 0);
  next.setMilliseconds(0);
  next.setHours(Number.isFinite(hours) ? hours : 10, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  if (frequency === 'daily') {
    if (next <= from) next.setDate(next.getDate() + 1);
    return next;
  }
  if (frequency === 'weekly') {
    const targetDow = Number.isFinite(Number(tc.scheduleDayOfWeek)) ? Number(tc.scheduleDayOfWeek) : 1;
    let delta = targetDow - next.getDay();
    if (delta < 0 || (delta === 0 && next <= from)) delta += 7;
    next.setDate(next.getDate() + delta);
    return next;
  }
  return new Date(from.getTime() + 24 * 60 * 60 * 1000);
}

function syncScheduledRunAt(rule) {
  if (rule.triggerType !== 'scheduled') return;
  const tc = rule.triggerConfig || {};
  if (tc.scheduleType === 'one_time') return;
  const next = computeNextScheduledRunAt(tc);
  tc.runAt = next.toISOString();
  rule.triggerConfig = tc;
}

function onTriggerTypeChange(rule, value) {
  if (value === 'scheduled') ensureScheduledTriggerConfig(rule);
}

function onScheduleTypeChange(rule, value) {
  rule.triggerConfig.scheduleType = value;
  if (value === 'one_time') {
    rule.triggerConfig.runAt = rule.triggerConfig.runAt || computeNextScheduledRunAt(rule.triggerConfig).toISOString();
    return;
  }
  syncScheduledRunAt(rule);
}

function onScheduleFrequencyChange(rule) {
  syncScheduledRunAt(rule);
}

function scheduleTimeValue(rule) {
  return rule.triggerConfig?.scheduleTime || '10:00';
}

function setScheduleTime(rule, value) {
  rule.triggerConfig.scheduleTime = value || '10:00';
  syncScheduledRunAt(rule);
}

function scheduleDayOfWeekValue(rule) {
  const raw = rule.triggerConfig?.scheduleDayOfWeek;
  return raw == null || raw === '' ? '1' : String(raw);
}

function setScheduleDayOfWeek(rule, value) {
  rule.triggerConfig.scheduleDayOfWeek = Number(value);
  syncScheduledRunAt(rule);
}

function scheduledRunAtLocal(rule) {
  const raw = rule.triggerConfig?.runAt;
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return toDateTimeLocal(parsed);
}

function setScheduledRunAtLocal(rule, value) {
  if (!value) {
    rule.triggerConfig.runAt = null;
    return;
  }
  const parsed = parseDateTimeLocal(value);
  rule.triggerConfig.runAt = parsed ? parsed.toISOString() : null;
}

function formatScheduleDateTime(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return formatDate(parsed, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatScheduleTime(value) {
  const [hourPart, minutePart] = String(value || '10:00').split(':');
  const hours = Number.parseInt(hourPart, 10);
  const minutes = Number.parseInt(minutePart, 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value || '';
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return formatDate(date, { timeStyle: 'short' });
}

function scheduledRunSummary(rule) {
  if (rule.triggerType !== 'scheduled') return '';
  const tc = rule.triggerConfig || {};
  if (tc.scheduleType === 'one_time') {
    if (!tc.runAt) return '';
    return t('settings.assignRulesScheduleSummaryOnce', { datetime: formatScheduleDateTime(tc.runAt) });
  }
  const start = formatScheduleDateTime(tc.runAt);
  if (!start) return '';
  if (tc.frequency === 'daily') {
    return t('settings.assignRulesScheduleSummaryDaily', {
      time: formatScheduleTime(tc.scheduleTime),
      datetime: start
    });
  }
  if (tc.frequency === 'weekly') {
    const day = weekdayOptions.value.find((opt) => opt.value === Number(tc.scheduleDayOfWeek))?.label || '';
    return t('settings.assignRulesScheduleSummaryWeekly', {
      day,
      time: formatScheduleTime(tc.scheduleTime),
      datetime: start
    });
  }
  return t('settings.assignRulesScheduleSummaryCustom', {
    minutes: Math.max(1, Number(tc.everyMinutes) || 60),
    datetime: start
  });
}

function normalizeRule(r, index) {
  const triggerType = r.triggerType || 'immediate';
  const metadata = r.metadata && typeof r.metadata === 'object' ? { ...r.metadata } : {};
  const triggerConfig = migrateScheduleConfigFromCron({
    ...defaultTriggerConfig(triggerType),
    ...(r.triggerConfig && typeof r.triggerConfig === 'object' ? r.triggerConfig : {})
  });
  if (triggerType === 'scheduled' && triggerConfig.runAt) {
    triggerConfig.runAt = new Date(triggerConfig.runAt).toISOString();
  } else if (triggerType === 'scheduled' && triggerConfig.scheduleType !== 'one_time') {
    triggerConfig.runAt = computeNextScheduledRunAt(triggerConfig).toISOString();
  }
  if (!metadata.availability) metadata.availability = defaultAvailability();
  metadata.customUserIds = Array.isArray(metadata.customUserIds) ? metadata.customUserIds.map(String) : [];
  metadata.assignTargetType =
    metadata.assignTargetType === 'custom' || metadata.customUserIds.length > 0 ? 'custom' : 'group';
  if (metadata.assignTargetType === 'custom') {
    metadata.customUserIds = metadata.customUserIds.filter(Boolean);
    delete metadata.enabledMemberIds;
  } else {
    metadata.customUserIds = [];
    if (Array.isArray(metadata.enabledMemberIds)) {
      metadata.enabledMemberIds = metadata.enabledMemberIds.map(String).filter(Boolean);
    } else {
      delete metadata.enabledMemberIds;
    }
  }
  if (r.distribution?.mode === 'availability_based') {
    metadata.availability.respectBusinessHours = true;
    if (!metadata.availability._savedMode) metadata.availability._savedMode = 'round_robin';
  }
  return {
    ruleId: r.ruleId || `rule_${Date.now()}_${index}`,
    name: r.name || t('settings.assignRulesDefaultRuleName', { index: index + 1 }),
    enabled: r.enabled !== false,
    order: Number.isFinite(Number(r.order)) ? Number(r.order) : index,
    triggerType,
    triggerConfig,
    conditions: {
      combinator: r.conditions?.combinator || 'all',
      clauses: Array.isArray(r.conditions?.clauses) ? r.conditions.clauses.map((c) => {
        let v = c.value;
        const f = String(c.field || '').trim();
        if (f === 'do_not_contact') {
          if (typeof v === 'boolean') v = v ? 'true' : 'false';
          else if (v === true) v = 'true';
          else if (v === false) v = 'false';
        }
        if (Array.isArray(v)) v = v.map((x) => String(x));
        else if (v !== null && typeof v === 'object') v = JSON.stringify(v);
        const clause = { field: c.field, operator: c.operator || 'equals', value: v, _fieldSelect: c._fieldSelect || inferClauseFieldSelect(c.field) };
        normalizeClauseValueForFieldAndOperator(clause);
        return clause;
      }) : []
    },
    primaryGroupId: metadata.assignTargetType === 'custom' ? '' : (r.primaryGroupId ? String(r.primaryGroupId) : ''),
    distribution: { mode: r.distribution?.mode || 'round_robin', queueClaimTimeoutMinutes: r.distribution?.queueClaimTimeoutMinutes ?? null, userWeights: Array.isArray(r.distribution?.userWeights) ? r.distribution.userWeights : [] },
    fallbackGroupIds: Array.isArray(r.fallbackGroupIds) ? r.fallbackGroupIds.map(String) : [],
    escalation: { enabled: !!r.escalation?.enabled, actionType: r.escalation?.actionType || 'reassign_group', thresholdPercent: r.escalation?.thresholdPercent ?? 100, cooldownMinutes: r.escalation?.cooldownMinutes ?? 30, chainGroupIds: Array.isArray(r.escalation?.chainGroupIds) ? r.escalation.chainGroupIds.map(String) : [] },
    reassignment: { enabled: r.reassignment?.enabled !== false, revertMode: r.reassignment?.revertMode || 'reapply_rules', lockOnManualOverride: !!r.reassignment?.lockOnManualOverride },
    metadata
  };
}

function createEmptyRule() {
  const order = rules.value.length;
  return normalizeRule({ name: t('settings.assignRulesDefaultRuleName', { index: order + 1 }), order }, order);
}

function addRule() {
  const r = createEmptyRule();
  rules.value = [...rules.value, r];
  expanded[r.ruleId] = true;
}

function removeRule(index) {
  rules.value = rules.value.filter((_, i) => i !== index);
  onRulesReorder();
}

function addClause(rule) {
  const nextClause = { field: '', operator: 'equals', value: '', _fieldSelect: 'preset' };
  rule.conditions.clauses = [...(rule.conditions.clauses || []), nextClause];
  openConditionEditor(rule.ruleId);
}

function removeClause(rule, idx) {
  rule.conditions.clauses = rule.conditions.clauses.filter((_, i) => i !== idx);
}

function applyScopeFromRoute() {
  const a = route.query.assignmentApp;
  const m = route.query.assignmentModule;
  if (typeof a === 'string' && a.trim()) {
    const up = a.toUpperCase();
    if (moduleExists(up, scopeModule.value) || assignmentModules.value.some((row) => String(row.appKey).toUpperCase() === up)) {
      scopeApp.value = up;
    }
  }
  if (typeof m === 'string' && m.trim()) {
    const low = m.toLowerCase();
    if (moduleExists(scopeApp.value, low)) scopeModule.value = low;
  }
  ensureValidScope();
}

async function loadMetadata() {
  try {
    const res = await apiClient.get('/settings/automation/assignment-rules/metadata', {
      params: {
        moduleKey: scopeModule.value,
        appKey: scopeApp.value
      }
    });
    if (!res?.success) return;
    if (Array.isArray(res.modules) && res.modules.length > 0) {
      assignmentModules.value = res.modules;
    }
    moduleFields.value = Array.isArray(res.moduleFields) ? res.moduleFields : [];
    if (!isNewRuleSet.value && res.adapter?.appKey) {
      const adapterApp = String(res.adapter.appKey).toUpperCase();
      if (assignmentModules.value.some((row) => String(row.appKey).toUpperCase() === adapterApp)) {
        scopeApp.value = adapterApp;
      }
    }
    ensureValidScope();
  } catch {
    moduleFields.value = [];
  }
}

function goBackToAutomation() {
  const nextQuery = { ...route.query, tab: 'automation' };
  delete nextQuery.automationView;
  delete nextQuery.assignmentApp;
  delete nextQuery.assignmentModule;
  router.push({ path: '/settings', query: nextQuery });
}

async function fetchGroups() {
  try {
    const params = new URLSearchParams({ page: '1', limit: '500', sortBy: 'name', sortOrder: 'asc' });
    const data = await apiClient.get(`/groups?${params.toString()}`);
    groups.value = data.success && Array.isArray(data.data) ? data.data : [];
  } catch { groups.value = []; }
}

async function fetchTenantUsers() {
  try {
    const res = await apiClient.get('/users?limit=500&page=1&sortBy=firstName&sortOrder=asc');
    tenantUsers.value = res.success && Array.isArray(res.data) ? res.data : [];
  } catch {
    tenantUsers.value = [];
  }
}

function payloadRulesForApi() {
  return rules.value.map((r, index) => {
    if (r.triggerType === 'scheduled') syncScheduledRunAt(r);
    const o = normalizeRule(r, index);
    const isCustom = o.metadata?.assignTargetType === 'custom';
    const clauseValues = (o.conditions.clauses || []).filter((c) => String(c.field || '').trim()).map((c) => {
      let val = c.value;
      if ((c.operator === 'in' || c.operator === 'not_in') && typeof val === 'string' && val.trim().startsWith('[')) { try { val = JSON.parse(val); } catch { /* keep */ } }
      if (c.operator === 'exists') val = null;
      const fieldKey = String(c.field || '').trim();
      const meta = fieldKey && !fieldKey.startsWith('customFields.') ? fieldMeta(fieldKey) : null;
      const isBooleanField =
        fieldKey === 'do_not_contact' ||
        String(meta?.dataType || '').toLowerCase() === 'boolean';
      if (isBooleanField && c.operator !== 'exists') {
        if ((c.operator === 'in' || c.operator === 'not_in') && Array.isArray(val)) {
          val = val.map((x) => (x === true || x === 'true' ? true : x === false || x === 'false' ? false : x));
        } else if (c.operator === 'equals' || c.operator === 'not_equals') {
          if (val === 'true' || val === true) val = true;
          else if (val === 'false' || val === false) val = false;
        }
      }
      return { field: c.field, operator: c.operator, value: val };
    });

    const payload = {
      ruleId: o.ruleId,
      name: o.name,
      enabled: o.enabled,
      order: o.order,
      triggerType: o.triggerType,
      triggerConfig: o.triggerConfig,
      conditions: { combinator: o.conditions.combinator, clauses: clauseValues },
      distribution: {
        ...o.distribution,
        queueClaimTimeoutMinutes: o.distribution.queueClaimTimeoutMinutes || null
      },
      fallbackGroupIds: o.fallbackGroupIds.filter(Boolean),
      escalation: o.escalation,
      reassignment: o.reassignment,
      metadata: {
        ...o.metadata,
        assignTargetType: isCustom ? 'custom' : 'group',
        customUserIds: isCustom ? [...(o.metadata.customUserIds || [])] : [],
        ...(isCustom || !Array.isArray(o.metadata.enabledMemberIds)
          ? {}
          : { enabledMemberIds: [...o.metadata.enabledMemberIds] })
      }
    };

    if (!isCustom && o.primaryGroupId) {
      payload.primaryGroupId = o.primaryGroupId;
    }

    return payload;
  });
}

function saveStateFingerprint() {
  return JSON.stringify({ enabled: meta.enabled, applyStrategy: meta.applyStrategy, rules: payloadRulesForApi() });
}

const isDirty = computed(() => lastSavedFingerprint.value !== null && saveStateFingerprint() !== lastSavedFingerprint.value);

async function loadRuleSet() {
  loadError.value = '';
  loading.value = true;
  saveError.value = '';
  try {
    await fetchGroups();
    await fetchTenantUsers();
    const res = await apiClient.get('/settings/automation/assignment-rules', { params: { appKey: scopeApp.value, moduleKey: scopeModule.value } });
    if (!res?.success) throw new Error(res?.message || t('settings.assignRulesLoadFailed'));
    const row = res.data || {};
    meta.enabled = row.enabled !== false;
    meta.applyStrategy = row.applyStrategy || 'new_records_only';
    rules.value = (Array.isArray(row.rules) ? row.rules : []).map((r, i) => normalizeRule(r, i)).sort((a, b) => a.order - b.order);
    Object.keys(expanded).forEach((k) => delete expanded[k]);
    Object.keys(conditionEditor).forEach((k) => delete conditionEditor[k]);
    if (rules.value.length > 0) expanded[rules.value[0].ruleId] = true;
    lastSavedFingerprint.value = saveStateFingerprint();
  } catch (e) {
    loadError.value = e.message || t('settings.assignRulesLoadFailed');
    lastSavedFingerprint.value = null;
  } finally {
    loading.value = false;
  }
}

async function save() {
  saveError.value = '';
  for (let i = 0; i < rules.value.length; i++) {
    const rule = rules.value[i];
    if (isCustomAssignTarget(rule)) {
      if (customUserIds(rule).length === 0) {
        saveError.value = t('settings.assignRulesCustomUsersRequired', { name: rule.name || String(i + 1) });
        return;
      }
    } else {
      if (!rule.primaryGroupId) {
        saveError.value = t('settings.assignRulesPrimaryGroupRequired', { name: rule.name || String(i + 1) });
        return;
      }
      if (enabledMembersCount(rule) === 0) {
        saveError.value = t('settings.assignRulesEnabledMembersRequired', { name: rule.name || String(i + 1) });
        return;
      }
    }
    if (rule.triggerType === 'scheduled' && rule.triggerConfig?.scheduleType === 'one_time' && !rule.triggerConfig?.runAt) {
      saveError.value = t('settings.assignRulesScheduleRunAtRequired', { name: rule.name || String(i + 1) });
      return;
    }
  }
  saving.value = true;
  try {
    const res = await apiClient.put('/settings/automation/assignment-rules', { appKey: scopeApp.value, moduleKey: scopeModule.value, enabled: meta.enabled, simulationOnly: false, applyStrategy: meta.applyStrategy, rules: payloadRulesForApi() });
    if (!res?.success) throw new Error(res?.message || t('settings.assignRulesSaveFailed'));
    notifySuccess(t('settings.assignRulesSaved'));
    isNewRuleSet.value = false;
    await loadRuleSet();
    await loadRuleSetList();
  } catch (e) {
    const serverErr = e.response?.data?.error;
    const serverDetails = e.response?.data?.details;
    saveError.value = serverErr ? `${serverErr}${Array.isArray(serverDetails) && serverDetails.length ? ` ${serverDetails.join('; ')}` : ''}` : (e.message || t('settings.assignRulesSaveFailed'));
  } finally {
    saving.value = false;
  }
}

watch([scopeApp, scopeModule], async () => {
  if (view.value !== 'editor' || syncingFromUrl.value) return;
  ensureValidScope();
  syncEditorToRoute();
  await loadMetadata();
  if (isNewRuleSet.value) {
    await syncExistingScopeRulesOnCreate();
    return;
  }
  await loadRuleSet();
});

watch(() => [route.query.tab, route.query.assignmentApp, route.query.assignmentModule], async () => {
  if (syncingFromUrl.value) return;
  if (route.query.tab !== 'automation' || route.query.automationView !== 'assignment-rules') return;
  const qa = typeof route.query.assignmentApp === 'string' ? route.query.assignmentApp.toUpperCase() : '';
  const qm = typeof route.query.assignmentModule === 'string' ? route.query.assignmentModule.toLowerCase() : '';
  if (!qa || !qm) {
    if (view.value === 'editor' && !isNewRuleSet.value) backToList();
    return;
  }
  if (!moduleExists(qa, qm)) return;
  if (qa === scopeApp.value && qm === scopeModule.value && view.value === 'editor') return;
  syncingFromUrl.value = true;
  isNewRuleSet.value = false;
  scopeApp.value = qa;
  scopeModule.value = qm;
  view.value = 'editor';
  await nextTick();
  syncingFromUrl.value = false;
  await loadMetadata();
  await loadRuleSet();
});

onMounted(async () => {
  bootstrapLoading.value = true;
  try {
    await loadMetadata();
    await loadRuleSetList();
    applyScopeFromRoute();
    const qa = typeof route.query.assignmentApp === 'string' ? route.query.assignmentApp.toUpperCase() : '';
    const qm = typeof route.query.assignmentModule === 'string' ? route.query.assignmentModule.toLowerCase() : '';
    if (qa && qm && moduleExists(qa, qm)) {
      isNewRuleSet.value = false;
      scopeApp.value = qa;
      scopeModule.value = qm;
      view.value = 'editor';
      await loadMetadata();
      await loadRuleSet();
    } else {
      view.value = 'list';
    }
  } finally {
    bootstrapLoading.value = false;
  }
});
</script>

<style scoped>
details summary::-webkit-details-marker { display: none; }
</style>
