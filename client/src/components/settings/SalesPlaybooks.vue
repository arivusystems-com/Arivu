<template>
  <div class="space-y-6" :class="isDirty && !isActionModalOpen ? SETTINGS_SAVE_BAR_CONTENT_CLASS : ''">
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-else-if="!pipelineSettings.length" class="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 px-6 py-16 text-center">
      <p class="max-w-md text-sm text-gray-600 dark:text-gray-400">{{ t('settings.salesPlayNoPipelines') }}</p>
      <button
        v-if="onNavigateToPipelines"
        type="button"
        class="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        @click="onNavigateToPipelines()"
      >
        {{ t('settings.salesPlayConfigurePipelines') }}
      </button>
    </div>

    <section v-else class="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/60">
      <div class="sticky top-0 z-10 shrink-0 space-y-3 border-b border-gray-200 bg-white/95 p-4 backdrop-blur dark:border-white/10 dark:bg-gray-900/95">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0 space-y-2">
            <div v-if="pipelineSettings.length === 1 && currentPipeline" class="flex min-w-0 items-center gap-2.5">
              <span
                class="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-white shadow"
                :style="{ backgroundColor: currentPipeline.color || DEFAULT_PIPELINE_COLOR }"
              />
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">{{ currentPipeline.name }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ formatStageCount(currentPipeline.stages?.length || 0) }} ·
                  {{ currentPipeline.isDefault ? t('settings.salesPlayDefaultPipeline') : t('settings.salesPlayCustomPipeline') }}
                </p>
              </div>
            </div>

            <div v-else-if="showPipelineTabs" class="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-white/5">
              <button
                v-for="pipeline in pipelineSettings"
                :key="pipeline.key"
                type="button"
                :class="[
                  'inline-flex max-w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  selectedPipelineKey === pipeline.key
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                ]"
                @click="selectPipeline(pipeline.key)"
              >
                <span
                  class="h-2 w-2 flex-shrink-0 rounded-full border border-white shadow"
                  :style="{ backgroundColor: pipeline.color || DEFAULT_PIPELINE_COLOR }"
                />
                <span class="truncate">{{ pipeline.name }}</span>
                <span v-if="pipeline.isDefault" class="flex-shrink-0 text-[10px] font-medium text-indigo-600 dark:text-indigo-300">
                  {{ t('settings.salesPlayDefaultBadge') }}
                </span>
              </button>
            </div>

            <div v-else class="flex min-w-0 items-center gap-2">
              <span class="flex-shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('settings.salesPlayPipelineLabel') }}</span>
              <HeadlessSelect
                v-model="selectedPipelineKey"
                :options="pipelineSelectOptions"
                searchable
                teleport
                button-class="!min-w-[12rem] !max-w-full !bg-white dark:!bg-gray-900/80 !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
              />
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 lg:justify-end">
            <div
              v-if="pipelinePlaybookSummary"
              class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300"
            >
              <span class="font-medium text-gray-800 dark:text-gray-200">
                {{ t('settings.salesPlayPipelineSummary', {
                  enabled: pipelinePlaybookSummary.enabledStages,
                  total: pipelinePlaybookSummary.totalStages,
                  activities: pipelinePlaybookSummary.totalActivities
                }) }}
              </span>
            </div>
            <div
              v-if="playbookRuntimeSummary"
              class="inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-indigo-200/80 bg-indigo-50/80 px-3 py-1.5 text-xs text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:text-indigo-100"
            >
              <span>{{ t('settings.salesPlayRuntimeActiveDeals', { count: playbookRuntimeSummary.activeDeals }) }}</span>
              <span>{{ t('settings.salesPlayRuntimeCompletion', { rate: playbookRuntimeSummary.completionRate }) }}</span>
              <span v-if="playbookRuntimeSummary.overdueActions">
                {{ t('settings.salesPlayRuntimeOverdue', { count: playbookRuntimeSummary.overdueActions }) }}
              </span>
              <span v-if="playbookRuntimeSummary.blockedActions">
                {{ t('settings.salesPlayRuntimeBlocked', { count: playbookRuntimeSummary.blockedActions }) }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="pipelinePlaybookSummary && pipelinePlaybookSummary.enabledStages === 0" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
          <p class="font-medium">{{ t('settings.salesPlayAdoptionTitle') }}</p>
          <p class="mt-1 text-amber-800/90 dark:text-amber-100/80">{{ t('settings.salesPlayAdoptionHint') }}</p>
        </div>
        <div v-if="playbookConfigWarnings.length" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p class="text-xs font-medium text-amber-900 dark:text-amber-100">{{ t('settings.salesPlayConfigWarningsTitle') }}</p>
          <ul class="mt-2 list-inside list-disc space-y-1 text-xs text-amber-800/90 dark:text-amber-100/80">
            <li v-for="(warning, warningIndex) in playbookConfigWarnings" :key="`${warning.code}-${warningIndex}`">
              {{ t(warning.messageKey, warning.messageParams) }}
            </li>
          </ul>
        </div>

        <div
          v-if="currentPipeline?.stages?.length > 1"
          class="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            v-for="(stage, stageIndex) in currentPipeline.stages"
            :key="stage.key || stageIndex"
            type="button"
            class="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            :class="stage.playbook?.enabled
              ? 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800/60 dark:bg-indigo-950/30 dark:text-indigo-100 dark:hover:bg-indigo-950/50'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300 dark:hover:bg-white/5'"
            :aria-label="t('settings.salesPlayJumpToStage', { stage: getStageJumpLabel(stage, stageIndex) })"
            @click="scrollToStage(stageIndex)"
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              :class="stage.playbook?.enabled ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'"
            />
            <span class="max-w-[8rem] truncate">{{ getStageJumpLabel(stage, stageIndex) }}</span>
          </button>
        </div>
      </div>

      <div v-if="currentPipeline" class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
        <div>
          <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.salesPlayStagePlaybooks') }}</h4>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.salesPlayStagePlaybooksDesc') }}</p>
        </div>
        <div ref="stageBoardRef" class="flex-1 snap-x snap-mandatory overflow-x-auto scroll-smooth pb-6">
          <div class="flex min-w-full items-start gap-4">
            <div
              v-for="(stage, stageIndex) in currentPipeline.stages"
              :key="stage.key || stageIndex"
              :ref="(el) => setStageColumnRef(el, stageIndex)"
              class="w-96 flex-shrink-0 snap-start"
            >
                <div
                  class="flex h-full min-h-[28rem] flex-col rounded-xl border shadow-sm transition-colors"
                  :class="stage.playbook.enabled
                    ? 'border-indigo-200 dark:border-indigo-800/60 bg-white dark:bg-gray-900/60'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40'"
                >
                  <div class="space-y-3 border-b border-gray-200 p-4 dark:border-white/10">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="flex min-w-0 items-center gap-2">
                          <p class="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">
                            {{ stage.name || t('settings.salesPlayStageFallback', { number: stageIndex + 1 }) }}
                          </p>
                          <span
                            v-if="!stage.playbook.enabled"
                            class="flex-shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                          >
                            {{ t('settings.salesPlayDisabledBadge') }}
                          </span>
                          <span
                            v-else-if="stage.playbook.actions.length"
                            class="flex-shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                          >
                            {{ stage.playbook.actions.length === 1
                              ? t('settings.salesPlayStageActivityCountOne', { count: stage.playbook.actions.length })
                              : t('settings.salesPlayStageActivityCountOther', { count: stage.playbook.actions.length }) }}
                          </span>
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                          {{ t('settings.salesPlayStageMeta', {
                            probability: stage.probability ?? 0,
                            status: stage.status || t('settings.salesPlayStatusOpen')
                          }) }}
                        </p>
                      </div>
                      <label class="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer flex-shrink-0">
                        <HeadlessSwitch
                          v-model="stage.playbook.enabled"
                          size="sm"
                          @change="handlePlaybookToggle(stage)"
                        />
                        <span>{{ t('settings.salesPlayEnable') }}</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      class="inline-flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                      @click="toggleStageSettings(stage.key)"
                    >
                      <svg
                        :class="[
                          'w-4 h-4 transition-transform duration-200',
                          isStageSettingsOpen(stage) ? 'rotate-180' : ''
                        ]"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                      <span>{{ t('settings.salesPlayStageSettings') }}</span>
                    </button>
                    <transition name="fade">
                      <div
                        v-if="isStageSettingsOpen(stage)"
                        class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 p-4 space-y-4"
                      >
                        <div class="grid grid-cols-1 gap-3">
                          <div>
                            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.salesPlayPlaybookMode') }}</label>
                            <HeadlessSelect
                              v-model="stage.playbook.mode"
                              :options="playbookModeOptions"
                              teleport
                              button-class="!bg-white dark:!bg-gray-900/80 !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
                            />
                          </div>
                          <div>
                            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.salesPlayExitCriteria') }}</label>
                            <HeadlessSelect
                              v-model="stage.playbook.exitCriteria.type"
                              :options="playbookExitOptions"
                              teleport
                              button-class="!bg-white dark:!bg-gray-900/80 !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
                              @update:model-value="onPlaybookExitCriteriaChange(stage)"
                            />
                          </div>
                          <div>
                            <label class="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                              <HeadlessCheckbox v-model="stage.playbook.autoAdvance" @change="onPlaybookAutoAdvanceChange(stage)" checkbox-class="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                              {{ t('settings.salesPlayAutoAdvance') }}
                            </label>
                            <p class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{{ t('settings.salesPlayAutoAdvanceHint') }}</p>
                          </div>
                          <div v-if="stage.playbook.autoAdvance">
                            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.salesPlayNextStage') }}</label>
                            <HeadlessSelect
                              v-model="stage.playbook.exitCriteria.nextStageKey"
                              :options="getNextStageOptions(currentPipeline, stage)"
                              allow-empty
                              :empty-label="t('settings.salesPlaySelectStagePh')"
                              teleport
                              button-class="!bg-white dark:!bg-gray-900/80 !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
                            />
                          </div>
                          <div v-if="stage.playbook.exitCriteria.type === 'custom'" class="space-y-3">
                            <div>
                              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.salesPlayCustomTriggerDesc') }}</label>
                              <textarea v-model="stage.playbook.exitCriteria.customDescription" rows="2" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm" :placeholder="t('settings.salesPlayCustomTriggerPh')"></textarea>
                            </div>
                            <div>
                              <div class="flex items-center justify-between gap-2 mb-2">
                                <div>
                                  <label class="block text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsConditions') }}</label>
                                  <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ t('settings.salesPlayExitConditionsHint') }}</p>
                                </div>
                                <button
                                  type="button"
                                  class="text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:underline"
                                  @click="addExitCondition(stage)"
                                >
                                  {{ t('settings.modFieldsAddCondition') }}
                                </button>
                              </div>
                              <div v-if="!stage.playbook.exitCriteria.conditions.length" class="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 px-3 py-4 text-xs text-gray-500 dark:text-gray-400">
                                {{ t('settings.modFieldsNoConditions') }}
                              </div>
                              <div v-else class="space-y-2">
                                <div
                                  v-for="(condition, conditionIndex) in stage.playbook.exitCriteria.conditions"
                                  :key="conditionIndex"
                                  class="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/70 p-3"
                                >
                                  <div>
                                    <label class="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsField') }}</label>
                                    <HeadlessSelect
                                      v-model="condition.field"
                                      :options="playbookExitConditionFields"
                                      allow-empty
                                      :empty-label="t('settings.modFieldsSelectFieldPh')"
                                      searchable
                                      teleport
                                      button-class="!bg-white dark:!bg-gray-900/80 !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
                                    />
                                  </div>
                                  <div>
                                    <label class="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsOperator') }}</label>
                                    <HeadlessSelect
                                      v-model="condition.operator"
                                      :options="playbookExitConditionOperators"
                                      teleport
                                      button-class="!bg-white dark:!bg-gray-900/80 !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
                                    />
                                  </div>
                                  <div v-if="condition.operator !== 'exists'">
                                    <label class="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsValue') }}</label>
                                    <input
                                      v-model="condition.value"
                                      class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                                      :placeholder="t('settings.modFieldsSelectValuePh')"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    class="px-2 py-2 text-xs text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                    @click="removeExitCondition(stage, conditionIndex)"
                                  >
                                    {{ t('settings.salesPlayRemoveCondition') }}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div>
                            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.salesPlayInternalNotes') }}</label>
                            <textarea v-model="stage.playbook.notes" rows="2" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm" :placeholder="t('settings.salesPlayInternalNotesPh')"></textarea>
                          </div>
                        </div>
                      </div>
                    </transition>
                  </div>
                  <div class="flex flex-1 flex-col gap-3 p-4">
                    <div v-if="stage.playbook.enabled" class="flex items-start justify-between gap-3">
                      <div>
                        <h6 class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.salesPlayActivities') }}</h6>
                        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.salesPlayActivitiesDesc') }}</p>
                      </div>
                      <Menu as="div" class="relative flex-shrink-0">
                        <MenuButton
                          class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 hover:shadow"
                        >
                          <PlusIcon class="h-4 w-4" />
                          {{ t('settings.salesPlayAddActivity') }}
                          <ChevronDownIcon class="h-3.5 w-3.5 opacity-80" />
                        </MenuButton>
                        <transition
                          enter-active-class="transition ease-out duration-100"
                          enter-from-class="transform opacity-0 scale-95"
                          enter-to-class="transform opacity-100 scale-100"
                          leave-active-class="transition ease-in duration-75"
                          leave-from-class="transform opacity-100 scale-100"
                          leave-to-class="transform opacity-0 scale-95"
                        >
                          <MenuItems class="absolute right-0 top-full z-30 mt-1 w-52 rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10">
                            <MenuItem v-for="option in quickAddActionTypes" :key="option.value" v-slot="{ active }">
                              <button
                                type="button"
                                :class="[
                                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm',
                                  active ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-900/20 dark:text-indigo-100' : 'text-gray-700 dark:text-gray-200'
                                ]"
                                @click="addPlaybookActionWithType(stage, option.value)"
                              >
                                <component :is="getActionTypeIcon(option.value)" class="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                                <span>{{ option.label }}</span>
                              </button>
                            </MenuItem>
                          </MenuItems>
                        </transition>
                      </Menu>
                    </div>
                    <div
                      v-if="!stage.playbook.enabled"
                      class="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-gray-300 bg-white/70 px-5 py-10 text-center dark:border-gray-600 dark:bg-gray-900/30"
                    >
                      <div class="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                        <ClipboardDocumentCheckIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <div class="space-y-1">
                        <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.salesPlayDisabledTitle') }}</p>
                        <p class="max-w-[14rem] text-xs text-gray-500 dark:text-gray-400">{{ t('settings.salesPlayEnableToManage') }}</p>
                      </div>
                      <button
                        type="button"
                        class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                        @click="enablePlaybook(stage)"
                      >
                        {{ t('settings.salesPlayEnableCta') }}
                      </button>
                    </div>
                    <div v-else class="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
                      <div
                        v-if="!stage.playbook.actions.length"
                        class="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-10 text-center dark:border-gray-700 dark:bg-white/5"
                      >
                        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.salesPlayNoActivities') }}</p>
                        <button
                          type="button"
                          class="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                          @click="addPlaybookActionWithType(stage, 'task')"
                        >
                          <PlusIcon class="h-4 w-4" />
                          {{ t('settings.salesPlayEmptyAddFirst') }}
                        </button>
                      </div>
                      <div v-else class="space-y-2">
                        <div
                          v-for="(action, actionIndex) in stage.playbook.actions"
                          :key="action.key || actionIndex"
                          class="relative"
                        >
                          <div
                            v-if="actionIndex < stage.playbook.actions.length - 1 && stage.playbook.mode === 'sequential'"
                            class="absolute bottom-0 left-4 top-10 w-px bg-indigo-200 dark:bg-indigo-800/60"
                          />
                          <div class="group relative flex gap-2.5">
                            <div
                              class="relative z-10 mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2"
                              :class="action.required
                                ? 'border-indigo-300 bg-indigo-100 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                : 'border-gray-200 bg-gray-100 text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'"
                            >
                              <component :is="getActionTypeIcon(action.actionType)" class="h-3.5 w-3.5" />
                            </div>
                            <div
                              class="mb-0.5 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white shadow-sm transition-colors group-hover:border-indigo-300 group-hover:shadow dark:border-gray-700 dark:bg-gray-900/70 dark:group-hover:border-indigo-700/60"
                            >
                              <div class="flex items-start gap-1 p-2.5">
                                <button
                                  type="button"
                                  class="min-w-0 flex-1 text-left"
                                  @click="openActionModal(stage, actionIndex)"
                                >
                                  <div class="mb-1 flex flex-wrap items-center gap-1.5">
                                    <span class="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                      {{ t('settings.salesPlayStepLabel', { number: actionIndex + 1 }) }}
                                    </span>
                                    <span v-if="action.required" class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{{ t('settings.salesPlayRequired') }}</span>
                                    <span v-if="action.autoCreate" class="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">{{ t('settings.salesPlayAutoCreate') }}</span>
                                    <span v-if="action.dependencies?.length" class="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                      {{ action.dependencies.length === 1
                                        ? t('settings.salesPlayDependenciesCountOne', { count: action.dependencies.length })
                                        : t('settings.salesPlayDependenciesCountOther', { count: action.dependencies.length }) }}
                                    </span>
                                  </div>
                                  <p class="line-clamp-2 text-sm font-semibold text-gray-900 dark:text-white">
                                    {{ action.title || t('settings.salesPlayActionFallback', { number: actionIndex + 1 }) }}
                                  </p>
                                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                    {{ getPlaybookActionTypeLabel(action.actionType) }}
                                    <span v-if="action.dueInDays !== null && action.dueInDays !== undefined"> · {{ formatDueIn(action.dueInDays) }}</span>
                                  </p>
                                  <p class="mt-1 truncate text-[11px] text-gray-400 dark:text-gray-500">
                                    {{ t('settings.salesPlayAssignedTo', { assignment: getPlaybookAssignmentLabel(action.assignment?.type) }) }}
                                  </p>
                                </button>
                                <div class="flex flex-shrink-0 flex-col gap-0.5">
                                  <button
                                    type="button"
                                    class="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-200"
                                    :disabled="actionIndex === 0"
                                    :title="t('settings.salesPlayTitleMoveUp')"
                                    @click.stop="movePlaybookAction(stage, actionIndex, -1)"
                                  >
                                    <ChevronUpIcon class="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    class="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-200"
                                    :disabled="actionIndex === stage.playbook.actions.length - 1"
                                    :title="t('settings.salesPlayTitleMoveDown')"
                                    @click.stop="movePlaybookAction(stage, actionIndex, 1)"
                                  >
                                    <ChevronDownIcon class="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    class="rounded-md p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                                    :title="t('settings.salesPlayRemoveActivity')"
                                    @click.stop="removePlaybookAction(stage, actionIndex)"
                                  >
                                    <TrashIcon class="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="flex flex-1 items-center justify-center p-6 text-sm text-gray-500 dark:text-gray-400">
        {{ t('settings.salesPlaySelectPipelineHint') }}
      </div>
    </section>

    <SettingsSaveBar
      :visible="isDirty && !isActionModalOpen"
      :saving="isSaving"
      @reset="discardChanges"
      @save="savePlaybooks"
    />

    <PlaybookActivityModal
      :open="isActionModalOpen"
      :is-new="actionModalState.isNew"
      :stage="actionModalStage"
      :action="actionModalAction"
      :action-index="actionModalActionIndex"
      :action-types="playbookActionTypes"
      :assignment-options="playbookAssignmentOptions"
      :trigger-options="playbookTriggerOptions"
      :alert-type-options="playbookAlertTypeOptions"
      :delay-unit-options="playbookDelayUnitOptions"
      :resource-types="playbookResourceTypes"
      :action-options="actionModalStage && actionModalAction ? getActionOptions(actionModalStage, actionModalAction) : []"
      @discard="discardActionModal"
      @save="saveActionModal"
      @remove="handleActionModalRemove"
      @patch-action="patchPlaybookAction"
      @patch-assignment="patchPlaybookAssignment"
      @patch-trigger="patchPlaybookTrigger"
      @refresh-key="actionModalStage && actionModalAction && refreshDraftActionKey(actionModalStage, actionModalAction)"
      @trigger-type-change="handleTriggerTypeChange"
      @trigger-delay-amount="updateTriggerDelayAmount"
      @trigger-delay-unit="updateTriggerDelayUnit"
      @toggle-dependency="(key, checked) => actionModalStage && actionModalAction && toggleActionDependency(actionModalStage, actionModalAction, key, checked)"
      @add-alert="actionModalStage && actionModalAction && addActionAlert(actionModalStage, actionModalAction)"
      @remove-alert="(index) => actionModalStage && actionModalAction && removeActionAlert(actionModalStage, actionModalAction, index)"
      @alert-offset-amount="updateAlertOffsetAmount"
      @alert-offset-unit="updateAlertOffsetUnit"
      @alert-recipients="updateAlertRecipients"
      @add-resource="actionModalStage && actionModalAction && addActionResource(actionModalStage, actionModalAction)"
      @remove-resource="(index) => actionModalStage && actionModalAction && removeActionResource(actionModalStage, actionModalAction, index)"
    />
  </div>
</template>

<script setup>
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import HeadlessSwitch from '@/components/ui/HeadlessSwitch.vue';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import {
  PlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TrashIcon,
  ClipboardDocumentCheckIcon,
  PhoneIcon,
  CalendarDaysIcon,
  EnvelopeIcon,
  CalendarIcon,
  DocumentTextIcon,
  BellAlertIcon,
  CheckBadgeIcon,
  EllipsisHorizontalCircleIcon
} from '@heroicons/vue/24/outline';
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import { fetchModuleDefinitionCached } from '@/utils/tenantSchemaApiCache';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import PlaybookActivityModal from '@/components/settings/PlaybookActivityModal.vue';
import { usePlaybookStageActions } from '@/composables/usePlaybookStageActions';
import { SETTINGS_SAVE_BAR_CONTENT_CLASS } from '@/components/settings/settingsSaveBar';
import { collectPlaybookConfigWarnings } from '@/utils/playbookConfigValidation';

import { useNotifications } from '@/composables/useNotifications';
import { confirmAction } from '@/composables/useConfirmAction';
defineProps({
  onNavigateToPipelines: {
    type: Function,
    default: null
  }
});

const { t } = useI18n();
const notifications = useNotifications();

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const loading = ref(true);
const error = ref('');
const dealsModule = ref(null);
const pipelineSettings = ref([]);
const selectedPipelineKey = ref('');
const isSaving = ref(false);
const originalSnapshot = ref('');
const stageSettingsExpanded = ref({});
const playbookRuntimeSummary = ref(null);
const stageBoardRef = ref(null);
const stageColumnRefs = ref([]);

const DEFAULT_PIPELINE_COLOR = '#2563EB';
const PIPELINE_TAB_MAX = 4;

const QUICK_ADD_ACTION_TYPES = ['task', 'call', 'meeting', 'email', 'event'];

const ACTION_TYPE_ICON_MAP = {
  task: ClipboardDocumentCheckIcon,
  call: PhoneIcon,
  meeting: CalendarDaysIcon,
  email: EnvelopeIcon,
  event: CalendarIcon,
  document: DocumentTextIcon,
  approval: CheckBadgeIcon,
  alert: BellAlertIcon,
  other: EllipsisHorizontalCircleIcon
};

const playbookModeOptions = computed(() => [
  { value: 'sequential', label: t('settings.salesPlayModeSequential') },
  { value: 'non_sequential', label: t('settings.salesPlayModeFlexible') }
]);

const playbookExitOptions = computed(() => [
  { value: 'manual', label: t('settings.salesPlayExitManual') },
  { value: 'all_actions_completed', label: t('settings.salesPlayExitAllActions') },
  { value: 'custom', label: t('settings.salesPlayExitCustom') }
]);

const currentPipeline = computed(() => {
  if (!pipelineSettings.value.length) return null;
  if (selectedPipelineKey.value) {
    return pipelineSettings.value.find(p => p.key === selectedPipelineKey.value) || pipelineSettings.value[0] || null;
  }
  return pipelineSettings.value[0] || null;
});

const showPipelineTabs = computed(() => {
  const count = pipelineSettings.value.length;
  return count > 1 && count <= PIPELINE_TAB_MAX;
});

const pipelineSelectOptions = computed(() =>
  pipelineSettings.value.map((pipeline) => ({
    value: pipeline.key,
    label: pipeline.isDefault
      ? `${pipeline.name} (${t('settings.salesPlayDefaultBadge')})`
      : pipeline.name
  }))
);

const pipelinePlaybookSummary = computed(() => {
  if (!currentPipeline.value) return null;
  const stages = currentPipeline.value.stages || [];
  const enabledStages = stages.filter(stage => stage.playbook?.enabled).length;
  const totalActivities = stages.reduce((sum, stage) => {
    if (!stage.playbook?.enabled) return sum;
    return sum + (stage.playbook.actions?.length || 0);
  }, 0);
  return {
    enabledStages,
    totalStages: stages.length,
    totalActivities
  };
});

const {
  isActionModalOpen,
  actionModalState,
  actionModalStage,
  actionModalAction,
  actionModalActionIndex,
  playbookActionTypes,
  playbookTriggerOptions,
  playbookAlertTypeOptions,
  playbookDelayUnitOptions,
  playbookResourceTypes,
  playbookAssignmentOptions,
  playbookExitConditionOperators,
  playbookExitConditionFields,
  addExitCondition,
  removeExitCondition,
  ensureStagePlaybook,
  openActionModal,
  closeActionModal,
  saveActionModal,
  discardActionModal,
  refreshDraftActionKey,
  addPlaybookAction: addPlaybookActionCore,
  removePlaybookAction,
  movePlaybookAction,
  refreshPlaybookActionKey,
  getPlaybookActionTypeLabel,
  getPlaybookAssignmentLabel,
  getActionOptions,
  toggleActionDependency,
  handleTriggerTypeChange,
  updateTriggerDelayAmount,
  updateTriggerDelayUnit,
  addActionAlert,
  removeActionAlert,
  updateAlertOffsetAmount,
  updateAlertOffsetUnit,
  updateAlertRecipients,
  addActionResource,
  removeActionResource
} = usePlaybookStageActions(currentPipeline);

function patchPlaybookAction(partial) {
  const action = actionModalAction.value;
  if (!action || !partial) return;
  Object.assign(action, partial);
}

function patchPlaybookAssignment(partial) {
  const action = actionModalAction.value;
  if (!action?.assignment || !partial) return;
  Object.assign(action.assignment, partial);
}

function patchPlaybookTrigger(partial) {
  const action = actionModalAction.value;
  if (!action?.trigger || !partial) return;
  Object.assign(action.trigger, partial);
}

const quickAddActionTypes = computed(() =>
  playbookActionTypes.value.filter(option => QUICK_ADD_ACTION_TYPES.includes(option.value))
);

const isDirty = computed(() => {
  if (!originalSnapshot.value) return false;
  return JSON.stringify(pipelineSettings.value) !== originalSnapshot.value;
});

const playbookConfigWarnings = computed(() =>
  collectPlaybookConfigWarnings(pipelineSettings.value)
);

function formatStageCount(count) {
  return count === 1
    ? t('settings.salesPlayStageCountOne', { count })
    : t('settings.salesPlayStageCountOther', { count });
}

function resolveInitialPipelineKey(settings = []) {
  const queryPipeline = typeof route.query.pipeline === 'string' ? route.query.pipeline.trim() : '';
  if (queryPipeline && settings.some((pipeline) => pipeline.key === queryPipeline)) {
    return queryPipeline;
  }
  return settings[0]?.key || '';
}

function selectPipeline(key) {
  if (!key || selectedPipelineKey.value === key) return;
  selectedPipelineKey.value = key;
}

function syncPipelineQuery(key) {
  if (!key || route.query.pipeline === key) return;
  router.replace({ query: { ...route.query, pipeline: key } });
}

function getStageJumpLabel(stage, stageIndex) {
  return stage?.name || t('settings.salesPlayStageFallback', { number: stageIndex + 1 });
}

function setStageColumnRef(el, index) {
  if (el) {
    stageColumnRefs.value[index] = el;
  }
}

function scrollToStage(index) {
  const column = stageColumnRefs.value[index];
  if (column) {
    column.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    return;
  }
  stageBoardRef.value?.scrollTo?.({ left: index * 400, behavior: 'smooth' });
}

function formatDueIn(days) {
  return days === 1
    ? t('settings.salesPlayDueInOne', { days })
    : t('settings.salesPlayDueInOther', { days });
}

function normalizePipelineSettings(settings = []) {
  if (!Array.isArray(settings) || !settings.length) return [];
  const cloned = JSON.parse(JSON.stringify(settings));
  cloned.forEach((pipeline) => {
    const stages = Array.isArray(pipeline.stages) ? pipeline.stages : [];
    stages.forEach((stage) => ensureStagePlaybook(stage));
  });
  return cloned;
}

async function fetchPlaybookRuntimeSummary() {
  if (!selectedPipelineKey.value) {
    playbookRuntimeSummary.value = null;
    return;
  }
  try {
    const response = await apiClient.get('/deals/playbooks/analytics', {
      params: { pipeline: selectedPipelineKey.value }
    });
    playbookRuntimeSummary.value = response?.success ? response.data : null;
  } catch (err) {
    console.error('Error fetching playbook runtime summary:', err);
    playbookRuntimeSummary.value = null;
  }
}

async function fetchDealsModule() {
  loading.value = true;
  error.value = '';
  try {
    const deals = await fetchModuleDefinitionCached('deals');
    if (!deals) {
      error.value = t('settings.salesPlayDealsModuleNotFound');
      return;
    }
    dealsModule.value = deals;
    const raw = Array.isArray(deals.pipelineSettings) ? JSON.parse(JSON.stringify(deals.pipelineSettings)) : [];
    pipelineSettings.value = normalizePipelineSettings(raw);
    if (pipelineSettings.value.length) {
      selectedPipelineKey.value = resolveInitialPipelineKey(pipelineSettings.value);
      syncPipelineQuery(selectedPipelineKey.value);
    }
    originalSnapshot.value = JSON.stringify(pipelineSettings.value);
    await fetchPlaybookRuntimeSummary();
  } catch (err) {
    console.error('Error fetching deals module:', err);
    error.value = err.message || t('settings.salesPlayLoadFailed');
  } finally {
    loading.value = false;
  }
}

watch(selectedPipelineKey, (key) => {
  stageColumnRefs.value = [];
  syncPipelineQuery(key);
  fetchPlaybookRuntimeSummary();
});

watch(
  () => route.query.pipeline,
  (queryPipeline) => {
    if (typeof queryPipeline !== 'string' || !queryPipeline.trim()) return;
    if (!pipelineSettings.value.some((pipeline) => pipeline.key === queryPipeline)) return;
    if (selectedPipelineKey.value !== queryPipeline) {
      selectedPipelineKey.value = queryPipeline;
    }
  }
);

function discardChanges() {
  if (!originalSnapshot.value) return;
  try {
    const restored = JSON.parse(originalSnapshot.value);
    pipelineSettings.value = Array.isArray(restored) ? restored : [];
    if (pipelineSettings.value.length && !pipelineSettings.value.some(p => p.key === selectedPipelineKey.value)) {
      selectedPipelineKey.value = pipelineSettings.value[0].key;
    }
  } catch (e) {
    console.error('Discard playbook changes failed', e);
  }
}

async function savePlaybooks() {
  if (!dealsModule.value || isSaving.value) return;
  if (playbookConfigWarnings.value.length) {
    const lines = playbookConfigWarnings.value.map((warning) =>
      t(warning.messageKey, warning.messageParams)
    );
    const proceed = await confirmAction(`${t('settings.salesPlaySaveWithWarningsConfirm')}\n\n${lines.join('\n')}`);
    if (!proceed) return;
  }
  isSaving.value = true;
  try {
    const normalized = normalizePipelineSettings(pipelineSettings.value);
    const url = dealsModule.value.type === 'system' ? `/api/modules/system/${dealsModule.value.key}` : `/api/modules/${dealsModule.value._id}`;
    const payload = { pipelineSettings: normalized };
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authStore.user?.token}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      notifications.error(data.message || t('settings.salesPlaySaveFailed'));
      return;
    }
    await fetchDealsModule();
    notifications.success(t('settings.salesPlaySaveSuccess'));
  } catch (e) {
    console.error('Save playbooks failed', e);
    notifications.error(t('settings.salesPlaySaveFailedWithReason', { reason: e.message || t('settings.salesPlayUnknownError') }));
  } finally {
    isSaving.value = false;
  }
}

function handlePlaybookToggle(stage) {
  ensureStagePlaybook(stage);
  if (!stage.playbook.enabled) {
    stage.playbook.autoAdvance = false;
    stage.playbook.exitCriteria.nextStageKey = '';
  }
}

function enablePlaybook(stage) {
  ensureStagePlaybook(stage);
  stage.playbook.enabled = true;
}

function onPlaybookExitCriteriaChange(stage) {
  if (!stage.playbook) return;
  if (stage.playbook.exitCriteria.type === 'manual') {
    stage.playbook.autoAdvance = false;
    stage.playbook.exitCriteria.nextStageKey = '';
  }
  if (stage.playbook.exitCriteria.type === 'custom') {
    ensureStagePlaybook(stage);
    if (!stage.playbook.exitCriteria.conditions.length) {
      addExitCondition(stage);
    }
  }
}

function onPlaybookAutoAdvanceChange(stage) {
  if (!stage.playbook) return;
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

function getActionTypeIcon(actionType) {
  return ACTION_TYPE_ICON_MAP[actionType] || ClipboardDocumentCheckIcon;
}

function handleActionModalRemove() {
  if (!actionModalStage.value) return;
  if (actionModalState.isNew) {
    discardActionModal();
    return;
  }
  removePlaybookAction(actionModalStage.value, actionModalActionIndex.value);
}

function addPlaybookActionWithType(stage, actionType = 'task') {
  const index = stage.playbook?.actions?.length || 0;
  const typeLabel = getPlaybookActionTypeLabel(actionType);
  addPlaybookActionCore(
    stage,
    t('settings.salesPlayQuickAddTitle', { type: typeLabel, number: index + 1 }),
    { actionType }
  );
}

onMounted(() => {
  fetchDealsModule();
});
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
