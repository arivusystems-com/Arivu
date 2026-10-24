<template>
  <transition name="fade">
    <div
      v-if="open && stage && action"
      class="fixed inset-0 z-[70] flex items-center justify-center px-4 py-8"
    >
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="requestClose"></div>
      <div class="relative flex w-full max-w-4xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700">
        <div class="flex shrink-0 items-center justify-between border-b border-gray-200 dark:border-white/10 px-6 py-4">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.modFieldsActivityModalTitle') }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('settings.modFieldsActivityStageMeta', {
                stage: stage.name || t('settings.modFieldsUntitledStage'),
                number: actionIndex + 1
              }) }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              @click="$emit('remove')"
              :disabled="actionIndex < 0"
            >
              {{ t('actions.delete') }}
            </button>
            <button
              class="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              @click="requestClose"
            >
              {{ t('actions.close') }}
            </button>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-5">
          <section class="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 p-5">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.modFieldsActivitySummary') }}</h3>
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsActivitySummaryHint') }}</span>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsActivityTitleLabel') }}</label>
                <input
                  :value="action.title"
                  @input="patchAction({ title: $event.target.value })"
                  @change="$emit('refresh-key')"
                  class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                  :placeholder="t('settings.modFieldsActivityTitlePh')"
                />
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsActionTypeLabel') }}</label>
                <HeadlessSelect
                  :model-value="action.actionType"
                  @update:model-value="patchAction({ actionType: $event })"
                  :options="actionTypes"
                  teleport
                  :options-class="modalSelectOptionsClass"
                  button-class="!bg-white dark:!bg-gray-900/80 !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
                />
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsDueDaysLabel') }}</label>
                <input
                  type="number"
                  min="0"
                  :value="action.dueInDays"
                  @input="patchAction({ dueInDays: numberFromInput($event.target.value) })"
                  class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                />
                <p class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsDueSameDayHint') }}</p>
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsAssignmentLabel') }}</label>
                <HeadlessSelect
                  :model-value="action.assignment.type"
                  :options="assignmentOptions"
                  teleport
                  :options-class="modalSelectOptionsClass"
                  button-class="!bg-white dark:!bg-gray-900/80 !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
                  @update:model-value="onAssignmentTypeInput"
                />
                <HeadlessSelect
                  v-if="action.assignment.type === 'specific_user'"
                  :model-value="assignmentTargetId"
                  :options="userOptions"
                  allow-empty
                  :empty-label="assignmentTargetPlaceholder"
                  :placeholder="assignmentTargetPlaceholder"
                  :disabled="assignmentTargetsLoading"
                  searchable
                  teleport
                  :options-class="modalSelectOptionsClass"
                  button-class="mt-2 !bg-white dark:!bg-gray-900/80 !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
                  @update:model-value="onAssignmentTargetChange"
                />
                <HeadlessSelect
                  v-else-if="action.assignment.type === 'role'"
                  :model-value="assignmentTargetId"
                  :options="roleOptions"
                  allow-empty
                  :empty-label="assignmentTargetPlaceholder"
                  :placeholder="assignmentTargetPlaceholder"
                  :disabled="assignmentTargetsLoading"
                  teleport
                  :options-class="modalSelectOptionsClass"
                  button-class="mt-2 !bg-white dark:!bg-gray-900/80 !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
                  @update:model-value="onAssignmentTargetChange"
                />
                <HeadlessSelect
                  v-else-if="action.assignment.type === 'team'"
                  :model-value="assignmentTargetId"
                  :options="teamOptions"
                  allow-empty
                  :empty-label="assignmentTargetPlaceholder"
                  :placeholder="assignmentTargetPlaceholder"
                  :disabled="assignmentTargetsLoading"
                  teleport
                  :options-class="modalSelectOptionsClass"
                  button-class="mt-2 !bg-white dark:!bg-gray-900/80 !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
                  @update:model-value="onAssignmentTargetChange"
                />
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-6">
              <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <HeadlessCheckbox :model-value="action.required" @update:model-value="patchAction({ required: $event })" checkbox-class="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                {{ t('settings.modFieldsRequiredCompleteStage') }}
              </label>
              <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <HeadlessCheckbox :model-value="action.autoCreate" @update:model-value="patchAction({ autoCreate: $event })" checkbox-class="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                {{ t('settings.modFieldsAutoCreateStageStart') }}
              </label>
            </div>
            <div>
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsDescriptionLabel') }}</label>
              <textarea
                :value="action.description"
                @input="patchAction({ description: $event.target.value })"
                rows="3"
                class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                :placeholder="t('settings.modFieldsActivityDescriptionPh')"
              ></textarea>
            </div>
          </section>

          <section class="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 p-5">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.modFieldsDependenciesTitle') }}</h3>
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsDependenciesHint') }}</span>
            </div>
            <div v-if="actionOptions.length" class="space-y-2">
              <label
                v-for="option in actionOptions"
                :key="option.value"
                class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                <HeadlessCheckbox
                  :checked="action.dependencies?.includes(option.value)"
                  @change="$emit('toggle-dependency', option.value, $event.target.checked)"
                  checkbox-class="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                />
                {{ option.label }}
              </label>
            </div>
            <div v-else class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('settings.modFieldsAddActivityForDeps') }}
            </div>
          </section>

          <Disclosure
            v-slot="{ open: triggerOpen }"
            as="section"
            class="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5"
            :default-open="action.trigger?.type && action.trigger.type !== 'stage_entry'"
          >
            <DisclosureButton class="flex w-full items-center justify-between gap-3 p-5 text-left">
              <div>
                <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.modFieldsTriggerAutomation') }}</h3>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsTriggerAutomationHint') }}</p>
              </div>
              <ChevronDownIcon :class="['w-4 h-4 text-gray-400 transition-transform', triggerOpen ? 'rotate-180' : '']" />
            </DisclosureButton>
            <DisclosurePanel class="px-5 pb-5 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsTriggerTypeLabel') }}</label>
                  <HeadlessSelect
                    :model-value="action.trigger.type"
                    :options="triggerOptions"
                    teleport
                    :options-class="modalSelectOptionsClass"
                    button-class="!bg-white dark:!bg-gray-900/80 !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
                    @update:model-value="onTriggerTypeInput"
                  />
                </div>
                <div v-if="action.trigger.type === 'after_action'">
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsWaitForActivity') }}</label>
                  <HeadlessSelect
                    :model-value="action.trigger.sourceActionKey"
                    @update:model-value="patchTrigger({ sourceActionKey: $event })"
                    :options="actionOptions"
                    allow-empty
                    :empty-label="t('settings.modFieldsSelectActivityPh')"
                    teleport
                    :options-class="modalSelectOptionsClass"
                    button-class="!bg-white dark:!bg-gray-900/80 !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
                  />
                  <p class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsUnlockAfterCompleteHint') }}</p>
                </div>
              </div>
              <div v-if="action.trigger.type === 'time_delay'" class="grid gap-4 md:grid-cols-2">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsDelayAmount') }}</label>
                  <input
                    type="number"
                    min="0"
                    :value="action.trigger.delay?.amount ?? 0"
                    @input="$emit('trigger-delay-amount', action, $event.target.value)"
                    class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsDelayUnit') }}</label>
                  <HeadlessSelect
                    :model-value="action.trigger.delay?.unit || 'hours'"
                    :options="delayUnitOptions"
                    teleport
                    :options-class="modalSelectOptionsClass"
                    button-class="!bg-white dark:!bg-gray-900/80 !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
                    @update:model-value="(value) => $emit('trigger-delay-unit', action, value)"
                  />
                </div>
              </div>
              <div v-if="action.trigger.type === 'custom'" class="space-y-2">
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsCustomTriggerDetails') }}</label>
                <textarea
                  :value="action.trigger.description"
                  @input="patchTrigger({ description: $event.target.value })"
                  rows="3"
                  class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                  :placeholder="t('settings.modFieldsCustomTriggerPh')"
                ></textarea>
              </div>
            </DisclosurePanel>
          </Disclosure>

          <Disclosure
            v-slot="{ open: alertsOpen }"
            as="section"
            class="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5"
            :default-open="!!action.alerts?.length"
          >
            <DisclosureButton class="flex w-full items-center justify-between gap-3 p-5 text-left">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.modFieldsAlertsReminders') }}</h3>
                <span v-if="action.alerts?.length" class="px-2 py-0.5 text-[10px] font-medium rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                  {{ action.alerts.length }}
                </span>
              </div>
              <ChevronDownIcon :class="['w-4 h-4 text-gray-400 transition-transform', alertsOpen ? 'rotate-180' : '']" />
            </DisclosureButton>
            <DisclosurePanel class="px-5 pb-5 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
              <div class="flex justify-end">
                <button
                  class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm hover:shadow"
                  @click="$emit('add-alert')"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  {{ t('settings.modFieldsAddAlert') }}
                </button>
              </div>
              <div v-if="!action.alerts?.length" class="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 px-4 py-6 text-xs text-gray-500 dark:text-gray-400 text-center">
                {{ t('settings.modFieldsNoAlerts') }}
              </div>
              <div v-else class="space-y-4">
                <div
                  v-for="(alert, alertIndex) in action.alerts"
                  :key="alertIndex"
                  class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/70 p-4 space-y-4"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsAlertNumber', { number: alertIndex + 1 }) }}</span>
                    <button
                      class="text-xs text-red-600 dark:text-red-300 hover:underline"
                      @click="$emit('remove-alert', alertIndex)"
                    >
                      {{ t('actions.remove') }}
                    </button>
                  </div>
                  <div class="grid gap-4 md:grid-cols-2">
                    <div>
                      <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsAlertTypeLabel') }}</label>
                      <HeadlessSelect
                        v-model="alert.type"
                        :options="alertTypeOptions"
                        teleport
                        :options-class="modalSelectOptionsClass"
                        button-class="!bg-white dark:!bg-gray-900/80 !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsSendOffset') }}</label>
                      <div class="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          :value="alert.offset?.amount ?? 0"
                          @input="$emit('alert-offset-amount', alert, $event.target.value)"
                          class="w-24 px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                        />
                        <HeadlessSelect
                          :model-value="alert.offset?.unit || 'hours'"
                          :options="delayUnitOptions"
                          teleport
                          :options-class="modalSelectOptionsClass"
                          button-class="!flex-1 !bg-white dark:!bg-gray-900/80 !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
                          @update:model-value="(value) => $emit('alert-offset-unit', alert, value)"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.modFieldsRecipientsLabel') }}</label>
                    <input
                      :value="(alert.recipients || []).join(', ')"
                      @input="$emit('alert-recipients', alert, $event.target.value)"
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
            </DisclosurePanel>
          </Disclosure>

          <Disclosure
            v-slot="{ open: resourcesOpen }"
            as="section"
            class="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5"
            :default-open="!!action.resources?.length"
          >
            <DisclosureButton class="flex w-full items-center justify-between gap-3 p-5 text-left">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.modFieldsResourcesTitle') }}</h3>
                <span v-if="action.resources?.length" class="px-2 py-0.5 text-[10px] font-medium rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                  {{ action.resources.length }}
                </span>
              </div>
              <ChevronDownIcon :class="['w-4 h-4 text-gray-400 transition-transform', resourcesOpen ? 'rotate-180' : '']" />
            </DisclosureButton>
            <DisclosurePanel class="px-5 pb-5 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
              <div class="flex justify-end">
                <button
                  class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm hover:shadow"
                  @click="$emit('add-resource')"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  {{ t('settings.modFieldsAddResource') }}
                </button>
              </div>
              <div v-if="!action.resources?.length" class="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 px-4 py-6 text-xs text-gray-500 dark:text-gray-400 text-center">
                {{ t('settings.modFieldsNoResources') }}
              </div>
              <div v-else class="space-y-4">
                <div
                  v-for="(resource, resourceIndex) in action.resources"
                  :key="resourceIndex"
                  class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/70 p-4 space-y-4"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsResourceNumber', { number: resourceIndex + 1 }) }}</span>
                    <button
                      class="text-xs text-red-600 dark:text-red-300 hover:underline"
                      @click="$emit('remove-resource', resourceIndex)"
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
                        :options="resourceTypes"
                        teleport
                        :options-class="modalSelectOptionsClass"
                        button-class="!bg-white dark:!bg-gray-900/80 !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
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
            </DisclosurePanel>
          </Disclosure>
        </div>
        <div class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-900/80 px-6 py-4">
          <p class="text-sm font-medium text-gray-900 dark:text-white">
            {{ isLocallyDirty ? t('settings.unsavedTitle') : t('settings.modFieldsActivityModalTitle') }}
          </p>
          <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              class="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              @click="$emit('discard')"
            >
              {{ t('settings.discardChanges') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!isLocallyDirty"
              @click="$emit('save')"
            >
              {{ t('settings.saveChanges') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';
import { ChevronDownIcon } from '@heroicons/vue/20/solid';
import { computed, ref, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePlaybookAssignmentTargets } from '@/composables/usePlaybookAssignmentTargets';

import { confirmAction } from '@/composables/useConfirmAction';
const props = defineProps({
  open: { type: Boolean, default: false },
  isNew: { type: Boolean, default: false },
  stage: { type: Object, default: null },
  action: { type: Object, default: null },
  actionIndex: { type: Number, default: -1 },
  actionTypes: { type: Array, default: () => [] },
  assignmentOptions: { type: Array, default: () => [] },
  triggerOptions: { type: Array, default: () => [] },
  alertTypeOptions: { type: Array, default: () => [] },
  delayUnitOptions: { type: Array, default: () => [] },
  resourceTypes: { type: Array, default: () => [] },
  actionOptions: { type: Array, default: () => [] }
});

const emit = defineEmits([
  'close',
  'save',
  'discard',
  'remove',
  'refresh-key',
  'patch-action',
  'patch-assignment',
  'patch-trigger',
  'trigger-type-change',
  'trigger-delay-amount',
  'trigger-delay-unit',
  'toggle-dependency',
  'add-alert',
  'remove-alert',
  'alert-offset-amount',
  'alert-offset-unit',
  'alert-recipients',
  'add-resource',
  'remove-resource'
]);

function patchAction(partial) {
  emit('patch-action', partial);
}

function patchAssignment(partial) {
  emit('patch-assignment', partial);
}

function patchTrigger(partial) {
  emit('patch-trigger', partial);
}

function numberFromInput(raw) {
  if (raw === '' || raw == null) return raw;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? raw : parsed;
}

const { t } = useI18n();

async function requestClose() {
  if (isLocallyDirty.value && !await confirmAction(t('settings.roleDrawerCloseConfirm'))) {
    return;
  }
  emit('discard');
}

const baselineSnapshot = ref('');
const isLocallyDirty = ref(false);

function syncDirtyState() {
  if (!props.action) {
    baselineSnapshot.value = '';
    isLocallyDirty.value = false;
    return;
  }
  if (props.isNew) {
    isLocallyDirty.value = true;
    return;
  }
  isLocallyDirty.value = JSON.stringify(props.action) !== baselineSnapshot.value;
}

watch(
  () => [props.open, props.action, props.isNew],
  ([isOpen, action, isNew]) => {
    if (!isOpen || !action) {
      baselineSnapshot.value = '';
      isLocallyDirty.value = false;
      return;
    }
    baselineSnapshot.value = JSON.stringify(action);
    isLocallyDirty.value = !!isNew;
  },
  { immediate: true }
);

watch(
  () => props.action,
  () => {
    if (!props.open || !props.action) return;
    syncDirtyState();
  },
  { deep: true }
);

const {
  loading: assignmentTargetsLoading,
  loadAssignmentTargets,
  userOptions,
  roleOptions,
  teamOptions,
  syncLegacyAssignmentTarget,
  applyAssignmentTarget,
  clearAssignmentTarget
} = usePlaybookAssignmentTargets();

const modalSelectOptionsClass = 'z-[10060]';

const assignmentTargetId = computed(() => {
  const targetId = props.action?.assignment?.targetId;
  return targetId ? String(targetId) : '';
});

const assignmentTargetPlaceholder = computed(() => {
  if (assignmentTargetsLoading.value) {
    return t('settings.modFieldsAssignmentTargetsLoading');
  }
  const type = props.action?.assignment?.type || '';
  const option = props.assignmentOptions.find((item) => item.value === type);
  if (option?.label) {
    return t('settings.modFieldsSelectAssignmentTargetPh', { target: option.label });
  }
  return t('settings.modFieldsSelectFieldPh');
});

function onAssignmentTypeInput(value) {
  patchAssignment({ type: value });
  onAssignmentTypeChange();
}

function onTriggerTypeInput(value) {
  patchTrigger({ type: value });
  emit('trigger-type-change', props.action);
}

function onAssignmentTypeChange() {
  if (!props.action?.assignment) return;
  clearAssignmentTarget(props.action.assignment);
}

function onAssignmentTargetChange(value) {
  if (!props.action?.assignment) return;
  applyAssignmentTarget(props.action.assignment, value || null);
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    loadAssignmentTargets();
  }
);

watch(
  [toRef(props, 'action'), userOptions, roleOptions, teamOptions],
  () => {
    if (!props.action?.assignment) return;
    const { assignment } = props.action;
    if (assignment.targetId) {
      applyAssignmentTarget(assignment, assignment.targetId);
      return;
    }
    syncLegacyAssignmentTarget(assignment);
  },
  { immediate: true }
);
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
