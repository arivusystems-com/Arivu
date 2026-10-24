<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.productConfigsDesc') }}</p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        :disabled="!itemGroups.length"
        @click="openCreate"
      >
        {{ t('settings.productConfigAdd') }}
      </button>
    </div>

    <div
      v-if="message"
      class="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200"
    >
      <span>{{ message }}</span>
      <button type="button" class="shrink-0 text-emerald-600 hover:text-emerald-900 dark:text-emerald-300" :aria-label="t('actions.close')" @click="message = ''">×</button>
    </div>
    <div
      v-if="error"
      class="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-300"
    >
      <span>{{ error }}</span>
      <button type="button" class="shrink-0 text-red-500 hover:text-red-800 dark:text-red-300" :aria-label="t('actions.close')" @click="error = ''">×</button>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>

    <div
      v-else-if="!itemGroups.length"
      class="rounded-xl border border-dashed border-gray-300 px-4 py-12 text-center dark:border-gray-600"
    >
      <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h10M4 18h7" />
        </svg>
      </div>
      <p class="mt-3 text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('settings.productConfigNeedGroup') }}</p>
      <p class="mt-1 text-xs text-gray-500">{{ t('settings.productConfigNeedGroupHint') }}</p>
      <button
        type="button"
        class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="goItemGroups"
      >
        {{ t('settings.catalogTabItemGroups') }}
      </button>
    </div>

    <div
      v-else-if="!configs.length"
      class="rounded-xl border border-dashed border-gray-300 px-4 py-12 text-center dark:border-gray-600"
    >
      <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11 4H4v7m0 0L12 21l8-10V4h-7" />
        </svg>
      </div>
      <p class="mt-3 text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('settings.productConfigsEmpty') }}</p>
      <p class="mt-1 text-xs text-gray-500">{{ t('settings.productConfigsEmptyHint') }}</p>
      <button
        type="button"
        class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openCreate"
      >
        {{ t('settings.productConfigAdd') }}
      </button>
    </div>

    <ul
      v-else
      class="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800/40"
    >
      <li
        v-for="c in configs"
        :key="c._id"
        class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50/90 dark:hover:bg-gray-800/60"
      >
        <button type="button" class="min-w-0 flex-1 text-left" @click="openEdit(c)">
          <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span class="truncate text-sm font-semibold text-gray-900 dark:text-white">{{ c.name }}</span>
            <span
              class="inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              :class="c.status === 'ACTIVE'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
            >
              {{ c.status === 'ACTIVE' ? t('settings.productConfigStatusActive') : t('settings.productConfigStatusInactive') }}
            </span>
            <span class="text-[11px] tabular-nums text-gray-400">v{{ c.version || 1 }}</span>
          </div>
          <p class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
            {{ groupName(c.itemGroupId) }}
            <span v-if="(c.options || []).length"> · {{ t('settings.productConfigOptionCount', { count: c.options.length }) }}</span>
            <span v-if="ruleCount(c)"> · {{ t('settings.productConfigRuleCount', { count: ruleCount(c) }) }}</span>
          </p>
        </button>
        <button
          type="button"
          class="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          @click="openEdit(c)"
        >
          {{ t('actions.edit') }}
        </button>
        <button
          type="button"
          class="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          @click="toggleStatus(c)"
        >
          {{ c.status === 'ACTIVE' ? t('settings.productConfigDeactivate') : t('settings.productConfigActivate') }}
        </button>
      </li>
    </ul>

    <!-- Builder: Item Groups pattern — compose left, live sales preview right -->
    <Teleport to="body">
      <div
        v-if="showForm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6"
        @click.self="closeForm"
        @keydown.esc="closeForm"
      >
        <form
          class="flex max-h-[min(92vh,920px)] w-full max-w-[96rem] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
          @submit.prevent="save"
        >
          <div class="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <div>
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ editingId ? t('settings.productConfigEdit') : t('settings.productConfigAdd') }}
              </h3>
              <p class="mt-0.5 text-xs text-gray-500">{{ t('settings.productConfigBuilderDesc') }}</p>
            </div>
            <button
              type="button"
              class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
              :aria-label="t('actions.cancel')"
              @click="closeForm"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div
            class="grid min-h-0 flex-1 grid-cols-1 overflow-hidden divide-y divide-gray-200 dark:divide-gray-700 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:divide-x lg:divide-y-0"
          >
            <!-- LEFT: compose (dominant width) -->
            <div class="min-h-0 min-w-0 space-y-5 overflow-y-auto p-5 sm:p-6">
              <!-- Basics -->
              <section class="space-y-3">
                <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.productConfigSectionBasics') }}</p>
                <label class="flex flex-col gap-1.5 text-sm">
                  <span :class="fieldLabelClass">
                    {{ t('settings.productConfigName') }}
                    <span class="text-red-500" aria-hidden="true">*</span>
                  </span>
                  <input
                    v-model="form.name"
                    required
                    autofocus
                    :placeholder="t('settings.productConfigNamePh')"
                    :class="fieldControlClass"
                  />
                </label>
                <div class="flex flex-col gap-1.5 text-sm">
                  <span :class="fieldLabelClass">
                    {{ t('settings.productConfigItemGroup') }}
                    <span class="text-red-500" aria-hidden="true">*</span>
                  </span>
                  <HeadlessSelect
                    v-model="form.itemGroupId"
                    :options="itemGroupSelectOptions"
                    allow-empty
                    empty-value=""
                    :empty-label="t('settings.productConfigItemGroupPick')"
                    :placeholder="t('settings.productConfigItemGroupPick')"
                    teleport
                    :searchable="itemGroupSelectOptions.length > 7"
                    wrapper-class="w-full"
                    :button-class="fieldControlClass"
                    :options-class="modalSelectOptionsClass"
                  />
                </div>
                <label class="flex flex-col gap-1.5 text-sm">
                  <span :class="fieldLabelClass">{{ t('settings.productConfigDescription') }}</span>
                  <textarea
                    v-model="form.description"
                    rows="2"
                    :placeholder="t('settings.productConfigDescriptionPh')"
                    class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-5 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20"
                  />
                </label>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
                  <div class="flex flex-col gap-1.5 text-sm">
                    <span :class="fieldLabelClass">{{ t('settings.productConfigStatus') }}</span>
                    <HeadlessSelect
                      v-model="form.status"
                      :options="statusSelectOptions"
                      teleport
                      wrapper-class="w-full"
                      :button-class="fieldControlClass"
                      :options-class="modalSelectOptionsClass"
                    />
                  </div>
                  <div class="flex flex-col gap-1.5 text-sm">
                    <span :class="fieldLabelClass">{{ t('settings.productConfigEffectiveFrom') }}</span>
                    <DatePicker
                      v-model="form.effectiveFrom"
                      :input-class="dateInputClass"
                      panel-class="z-[10060]"
                    />
                  </div>
                  <div class="flex flex-col gap-1.5 text-sm">
                    <span :class="fieldLabelClass">{{ t('settings.productConfigEffectiveUntil') }}</span>
                    <DatePicker
                      v-model="form.effectiveUntil"
                      :input-class="dateInputClass"
                      panel-class="z-[10060]"
                    />
                  </div>
                </div>
              </section>

              <!-- Options -->
              <section>
                <div class="flex items-center justify-between gap-2">
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.productConfigSectionOptions') }}</p>
                  <button
                    type="button"
                    class="shrink-0 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                    @click="addOption"
                  >
                    {{ t('settings.productConfigAddOption') }}
                  </button>
                </div>

                <div
                  v-if="!form.options.length"
                  class="mt-3 rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center dark:border-gray-600"
                >
                  <p class="text-sm text-gray-600 dark:text-gray-300">{{ t('settings.productConfigOptionsEmpty') }}</p>
                </div>

                <ul v-else class="mt-3 space-y-3">
                  <li
                    v-for="(opt, oi) in form.options"
                    :key="opt.uid"
                    class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-900/30"
                  >
                    <div class="space-y-3 p-4">
                      <div class="flex items-center gap-3">
                        <span
                          class="flex h-[2.625rem] w-6 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-[11px] font-semibold tabular-nums text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200"
                          :aria-label="t('settings.productConfigOptionIndex', { index: oi + 1 })"
                        >
                          {{ oi + 1 }}
                        </span>

                        <input
                          :ref="(el) => setOptionNameInputRef(opt.uid, el)"
                          v-model="opt.optionName"
                          :placeholder="t('settings.productConfigOptionNamePh')"
                          :aria-label="t('settings.productConfigOptionName')"
                          class="min-w-[10rem] flex-1"
                          :class="fieldControlClass"
                          @keydown.enter.prevent
                        />

                        <HeadlessSelect
                          v-model="opt.optionType"
                          :options="optionTypeSelectOptions"
                          teleport
                          wrapper-class="w-full min-w-[9rem] sm:w-44 shrink-0"
                          :button-class="fieldControlClass"
                          :options-class="modalSelectOptionsClass"
                        />

                        <label
                          class="inline-flex h-[2.625rem] shrink-0 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
                        >
                          <HeadlessCheckbox v-model="opt.required" size="sm" />
                          {{ t('settings.productConfigRequired') }}
                        </label>

                        <div class="ml-auto flex h-[2.625rem] shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-gray-800 dark:hover:text-gray-200"
                            :disabled="oi === 0"
                            :title="t('settings.productConfigMoveUp')"
                            :aria-label="t('settings.productConfigMoveUp')"
                            @click="moveOption(oi, -1)"
                          >
                            <ChevronUpIcon class="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-gray-800 dark:hover:text-gray-200"
                            :disabled="oi === form.options.length - 1"
                            :title="t('settings.productConfigMoveDown')"
                            :aria-label="t('settings.productConfigMoveDown')"
                            @click="moveOption(oi, 1)"
                          >
                            <ChevronDownIcon class="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800"
                            :title="t('actions.remove')"
                            :aria-label="t('actions.remove')"
                            @click="form.options.splice(oi, 1)"
                          >
                            <TrashIcon class="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <div v-if="opt.optionType !== 'checkbox'" class="flex flex-col gap-1.5">
                        <span :class="fieldLabelClass">{{ t('settings.productConfigValuesLabel') }}</span>
                        <div
                          class="flex min-h-[2.625rem] flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:focus-within:border-indigo-400 dark:focus-within:ring-indigo-400/20"
                          @click="focusValueInput(oi)"
                        >
                          <span
                            v-for="(val, vi) in opt.values"
                            :key="`${opt.uid}-${val}-${vi}`"
                            class="inline-flex items-center gap-1 rounded-md bg-indigo-50 py-0.5 pl-2 pr-1 text-xs font-medium text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
                          >
                            {{ val }}
                            <button
                              type="button"
                              class="inline-flex h-5 w-5 items-center justify-center rounded text-indigo-500 hover:bg-indigo-100 hover:text-indigo-800 dark:hover:bg-indigo-900/60 dark:hover:text-indigo-100"
                              :aria-label="t('settings.productConfigRemoveValue')"
                              @click.stop="removeOptionValue(oi, vi)"
                            >
                              <XMarkIcon class="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </span>
                          <input
                            :ref="(el) => setValueInputRef(oi, el)"
                            v-model="opt.draft"
                            type="text"
                            :placeholder="opt.values.length ? t('settings.productConfigValueAddMore') : t('settings.productConfigValuePlaceholder')"
                            class="min-w-[8rem] flex-1 border-0 bg-transparent py-0.5 text-sm leading-5 text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
                            :aria-label="t('settings.productConfigValuePlaceholder')"
                            @keydown="onValueKeydown($event, oi)"
                            @blur="commitDraft(oi)"
                          />
                        </div>
                        <p class="text-[11px] text-gray-400">{{ t('settings.productConfigValueChipHint') }}</p>
                      </div>
                    </div>
                  </li>
                </ul>
              </section>

              <!-- Rules -->
              <section
                v-if="canConfigureRules"
                class="space-y-5 border-t border-gray-200 pt-5 dark:border-gray-700"
              >
                <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.productConfigSectionRules') }}</p>

                <!-- Product rules -->
                <div class="space-y-3">
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('settings.productConfigProductRules') }}</p>
                    <button type="button" :class="ruleAddButtonClass" @click="addProductRule">
                      {{ t('settings.productConfigAddRule') }}
                    </button>
                  </div>
                  <div
                    v-if="!form.productRules.length"
                    class="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-xs text-gray-400 dark:border-gray-600"
                  >
                    {{ t('settings.productConfigProductRulesEmpty') }}
                  </div>
                  <ul v-else class="space-y-2">
                    <li
                      v-for="(rule, idx) in form.productRules"
                      :key="'pr'+idx"
                      class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-900/30"
                    >
                      <div class="flex items-center gap-3">
                        <span :class="ruleKeywordClass">{{ t('settings.productConfigRuleSentence') }}</span>
                        <HeadlessSelect
                          v-model="rule.optionName"
                          :options="namedOptionSelectOptions()"
                          allow-empty
                          :empty-label="t('settings.productConfigOptionPick')"
                          teleport
                          wrapper-class="min-w-0 flex-1 sm:max-w-xs"
                          :button-class="ruleControlClass"
                          :options-class="modalSelectOptionsClass"
                        />
                        <HeadlessSelect
                          v-model="rule.type"
                          :options="productRuleTypeOptions"
                          teleport
                          wrapper-class="w-full shrink-0 sm:w-40"
                          :button-class="ruleControlClass"
                          :options-class="modalSelectOptionsClass"
                        />
                        <input
                          v-if="rule.type === 'min' || rule.type === 'max'"
                          v-model.number="rule[rule.type]"
                          type="number"
                          min="0"
                          :class="ruleNumberInputClass"
                          :aria-label="rule.type === 'min' ? t('settings.productConfigRuleMin') : t('settings.productConfigRuleMax')"
                        />
                        <template v-if="rule.type === 'quantity'">
                          <input
                            v-model.number="rule.minQty"
                            type="number"
                            min="0"
                            :class="ruleNumberInputClass"
                            :placeholder="t('settings.productConfigMinQty')"
                            :aria-label="t('settings.productConfigMinQty')"
                          />
                          <span class="shrink-0 text-xs text-gray-400">–</span>
                          <input
                            v-model.number="rule.maxQty"
                            type="number"
                            min="0"
                            :class="ruleNumberInputClass"
                            :placeholder="t('settings.productConfigMaxQty')"
                            :aria-label="t('settings.productConfigMaxQty')"
                          />
                        </template>
                        <button
                          type="button"
                          :class="[ruleRemoveButtonClass, 'ml-auto']"
                          :title="t('actions.remove')"
                          :aria-label="t('actions.remove')"
                          @click="form.productRules.splice(idx, 1)"
                        >
                          <TrashIcon class="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  </ul>
                </div>

                <!-- Compatibility -->
                <div class="space-y-3">
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('settings.productConfigCompatRules') }}</p>
                    <button type="button" :class="ruleAddButtonClass" @click="addCompatRule">
                      {{ t('settings.productConfigAddRule') }}
                    </button>
                  </div>
                  <div
                    v-if="!form.compatibilityRules.length"
                    class="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-xs text-gray-400 dark:border-gray-600"
                  >
                    {{ t('settings.productConfigCompatRulesEmpty') }}
                  </div>
                  <ul v-else class="space-y-2">
                    <li
                      v-for="(rule, idx) in form.compatibilityRules"
                      :key="'cr'+idx"
                      class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-900/30"
                    >
                      <div class="flex items-center gap-3">
                        <HeadlessSelect
                          :model-value="rule.optionA"
                          :options="namedOptionSelectOptions()"
                          allow-empty
                          :empty-label="t('settings.productConfigOptionA')"
                          teleport
                          wrapper-class="min-w-0 flex-1"
                          :button-class="ruleControlClass"
                          :options-class="modalSelectOptionsClass"
                          @update:model-value="(value) => setCompatOptionA(rule, value)"
                        />
                        <HeadlessSelect
                          v-model="rule.mode"
                          :options="compatModeOptions"
                          teleport
                          wrapper-class="w-full shrink-0 sm:w-44"
                          :button-class="ruleControlClass"
                          :options-class="modalSelectOptionsClass"
                        />
                        <HeadlessSelect
                          :model-value="rule.optionB"
                          :options="namedOptionSelectOptions()"
                          allow-empty
                          :empty-label="t('settings.productConfigOptionB')"
                          teleport
                          wrapper-class="min-w-0 flex-1"
                          :button-class="ruleControlClass"
                          :options-class="modalSelectOptionsClass"
                          @update:model-value="(value) => setCompatOptionB(rule, value)"
                        />
                        <button
                          type="button"
                          :class="[ruleRemoveButtonClass, 'ml-auto']"
                          :title="t('actions.remove')"
                          :aria-label="t('actions.remove')"
                          @click="form.compatibilityRules.splice(idx, 1)"
                        >
                          <TrashIcon class="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>

                      <div
                        v-if="rule.optionA && rule.optionB"
                        class="mt-3 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700"
                      >
                        <p class="text-xs font-medium text-gray-500">{{ t('settings.productConfigCompatPairsLabel') }}</p>
                        <div class="flex flex-wrap items-center gap-2">
                          <HeadlessSelect
                            v-model="rule.draftA"
                            :options="valueSelectOptions(rule.optionA, `${rule.optionA}…`)"
                            allow-empty
                            :empty-label="`${rule.optionA}…`"
                            teleport
                            wrapper-class="min-w-[8rem] flex-1 sm:max-w-[10rem]"
                            :button-class="ruleControlClass"
                            :options-class="modalSelectOptionsClass"
                          />
                          <span class="shrink-0 text-xs text-gray-400">+</span>
                          <HeadlessSelect
                            v-model="rule.draftB"
                            :options="valueSelectOptions(rule.optionB, `${rule.optionB}…`)"
                            allow-empty
                            :empty-label="`${rule.optionB}…`"
                            teleport
                            wrapper-class="min-w-[8rem] flex-1 sm:max-w-[10rem]"
                            :button-class="ruleControlClass"
                            :options-class="modalSelectOptionsClass"
                          />
                          <button
                            type="button"
                            class="shrink-0 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 dark:border-indigo-800 dark:text-indigo-300"
                            :disabled="!rule.draftA || !rule.draftB"
                            @click="addCompatPair(rule)"
                          >
                            {{ t('settings.productConfigAddPair') }}
                          </button>
                        </div>
                        <div v-if="(rule.pairs || []).length" class="flex flex-wrap gap-1.5">
                          <span
                            v-for="(pair, pi) in rule.pairs"
                            :key="`${pair[0]}|${pair[1]}-${pi}`"
                            class="inline-flex items-center gap-1 rounded-md bg-indigo-50 py-0.5 pl-2 pr-1 text-xs font-medium text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
                          >
                            {{ pair[0] }} · {{ pair[1] }}
                            <button
                              type="button"
                              class="inline-flex h-5 w-5 items-center justify-center rounded text-indigo-500 hover:bg-indigo-100 hover:text-indigo-800 dark:hover:bg-indigo-900/60 dark:hover:text-indigo-100"
                              :aria-label="t('actions.remove')"
                              @click="rule.pairs.splice(pi, 1)"
                            >
                              <XMarkIcon class="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </span>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>

                <!-- Dependencies -->
                <div class="space-y-3">
                  <div class="flex items-center justify-between gap-2">
                    <div class="min-w-0">
                      <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('settings.productConfigDepRules') }}</p>
                      <p class="mt-1 text-xs text-gray-500">{{ t('settings.productConfigDepRulesHint') }}</p>
                    </div>
                    <button type="button" :class="ruleAddButtonClass" @click="addDepRule">
                      {{ t('settings.productConfigAddRule') }}
                    </button>
                  </div>
                  <div
                    v-if="!form.dependencyRules.length"
                    class="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-xs text-gray-400 dark:border-gray-600"
                  >
                    {{ t('settings.productConfigDepRulesEmpty') }}
                  </div>
                  <ul v-else class="space-y-2">
                    <li
                      v-for="(rule, idx) in form.dependencyRules"
                      :key="'dr'+idx"
                      class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-900/30"
                    >
                      <div class="flex items-start gap-3">
                        <div class="min-w-0 flex-1 space-y-3">
                          <div class="flex items-center gap-3">
                            <span :class="ruleKeywordClass">{{ t('settings.productConfigWhen') }}</span>
                            <HeadlessSelect
                              :model-value="rule.whenOption"
                              :options="namedOptionSelectOptions()"
                              allow-empty
                              :empty-label="t('settings.productConfigOptionPick')"
                              teleport
                              wrapper-class="min-w-0 flex-1 sm:max-w-xs"
                              :button-class="ruleControlClass"
                              :options-class="modalSelectOptionsClass"
                              @update:model-value="(value) => setDepWhenOption(rule, value)"
                            />
                          </div>

                          <div
                            v-if="rule.whenOption && !isCheckboxOptionName(rule.whenOption)"
                            class="flex flex-wrap gap-2 pl-[3.25rem]"
                          >
                            <label
                              v-for="value in valuesForOptionName(rule.whenOption)"
                              :key="`wv-${value}`"
                              class="inline-flex h-[2.625rem] cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
                            >
                              <HeadlessCheckbox
                                :model-value="Array.isArray(rule.whenValues) && rule.whenValues.includes(value)"
                                size="sm"
                                @update:model-value="toggleDepWhenValue(rule, value, $event)"
                              />
                              {{ value }}
                            </label>
                          </div>

                          <div class="flex items-center gap-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                            <span :class="ruleKeywordClass">{{ t('settings.productConfigThen') }}</span>
                            <HeadlessSelect
                              v-model="rule.action"
                              :options="depActionOptions"
                              teleport
                              wrapper-class="w-full shrink-0 sm:w-36"
                              :button-class="ruleControlClass"
                              :options-class="modalSelectOptionsClass"
                            />
                            <HeadlessSelect
                              :model-value="rule.targetOption"
                              :options="namedOptionSelectOptions(rule.whenOption)"
                              allow-empty
                              :empty-label="t('settings.productConfigOptionPick')"
                              teleport
                              wrapper-class="min-w-0 flex-1 sm:max-w-xs"
                              :button-class="ruleControlClass"
                              :options-class="modalSelectOptionsClass"
                              @update:model-value="(value) => setDepTargetOption(rule, value)"
                            />
                            <HeadlessSelect
                              v-if="rule.targetOption && valuesForOptionName(rule.targetOption).length"
                              v-model="rule.targetValue"
                              :options="valueSelectOptions(rule.targetOption, t('settings.productConfigSelect'))"
                              allow-empty
                              :empty-label="t('settings.productConfigSelect')"
                              teleport
                              wrapper-class="min-w-0 flex-1 sm:max-w-xs"
                              :button-class="ruleControlClass"
                              :options-class="modalSelectOptionsClass"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          :class="ruleRemoveButtonClass"
                          :title="t('actions.remove')"
                          :aria-label="t('actions.remove')"
                          @click="form.dependencyRules.splice(idx, 1)"
                        >
                          <TrashIcon class="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  </ul>
                </div>
              </section>
              <section
                v-else
                class="border-t border-gray-200 pt-5 dark:border-gray-700"
              >
                <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.productConfigSectionRules') }}</p>
                <p class="mt-2 text-xs text-gray-500">{{ t('settings.productConfigRulesLocked') }}</p>
              </section>
            </div>

            <!-- RIGHT: live sales configurator -->
            <div class="flex min-h-0 flex-col bg-slate-50/80 dark:bg-gray-900/50">
              <div class="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold leading-5 text-gray-900 dark:text-white">{{ t('settings.productConfigLivePreview') }}</p>
                  <p class="mt-1 text-xs leading-4 text-gray-500">{{ t('settings.productConfigPreviewHint') }}</p>
                </div>
                <span
                  class="mt-0.5 inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none"
                  :class="previewBadgeClass"
                >
                  {{ previewBadgeLabel }}
                </span>
              </div>

              <div class="min-h-0 flex-1 overflow-y-auto p-5">
                <div
                  v-if="!hasNamedPreviewOptions"
                  class="flex h-full min-h-[12rem] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 px-4 text-center dark:border-gray-600"
                >
                  <p class="text-sm text-gray-600 dark:text-gray-300">{{ t('settings.productConfigPreviewEmpty') }}</p>
                  <p class="mt-1 text-xs text-gray-400">{{ t('settings.productConfigPreviewEmptyHint') }}</p>
                </div>
                <div v-else class="space-y-4">
                  <ProductConfigOptionPicker
                    :options="namedOptions"
                    :selections="previewSelections"
                    card-class="bg-white dark:bg-gray-800"
                    @update:selection="onPreviewSelection"
                    @change="runPreviewValidate"
                  />
                  <ProductConfigValidationPanel :result="previewResult" />
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
            <button
              type="button"
              class="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              @click="closeForm"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              type="submit"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              :disabled="saving || !canSave"
            >
              {{ saving ? t('states.saving') : t('actions.save') }}
            </button>
          </div>
        </form>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ChevronDownIcon, ChevronUpIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import DatePicker from '@/components/common/DatePicker.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import ProductConfigOptionPicker from '@/components/catalog/ProductConfigOptionPicker.vue';
import ProductConfigValidationPanel from '@/components/catalog/ProductConfigValidationPanel.vue';
import {
  optionValues,
  resetSelectionsForOptions,
  useProductConfigValidationBadge,
  useProductConfigValidator,
} from '@/composables/useProductConfigSelections';

const { t } = useI18n();
const router = useRouter();

const modalSelectOptionsClass = 'z-[10060]';
const fieldLabelClass = 'text-sm font-medium text-gray-700 dark:text-gray-200';
const fieldControlClass =
  'block w-full min-h-[2.625rem] rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-5 text-gray-900 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20';
const dateInputClass = `${fieldControlClass} cursor-pointer`;
const ruleControlClass = fieldControlClass;
const ruleNumberInputClass =
  'min-h-[2.625rem] w-20 shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-5 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20';
const ruleAddButtonClass =
  'shrink-0 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700';
const ruleRemoveButtonClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800';
const ruleKeywordClass = 'w-10 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400';

const loading = ref(true);
const saving = ref(false);
const configs = ref([]);
const itemGroups = ref([]);
const error = ref('');
const message = ref('');
const showForm = ref(false);
const editingId = ref(null);
const previewSelections = reactive({});
const {
  result: previewResult,
  scheduleValidate,
  validate,
  clearValidationTimer,
} = useProductConfigValidator({
  selections: previewSelections,
});

const valueInputRefs = {};
const optionNameInputRefs = {};
let optUid = 0;
let pendingFocusOptionUid = null;

const emptyForm = () => ({
  name: '',
  itemGroupId: '',
  description: '',
  status: 'ACTIVE',
  effectiveFrom: '',
  effectiveUntil: '',
  options: [],
  productRules: [],
  compatibilityRules: [],
  dependencyRules: [],
});

const form = reactive(emptyForm());

const namedOptions = computed(() =>
  (form.options || []).filter((o) => String(o.optionName || '').trim())
);

const hasNamedPreviewOptions = computed(() => namedOptions.value.length > 0);

const canConfigureRules = computed(() =>
  namedOptions.value.some((opt) => opt.optionType === 'checkbox' || optionValues(opt).length > 0)
);

const canSave = computed(() => {
  return String(form.name || '').trim() && form.itemGroupId;
});

const { badgeClass: previewBadgeClass, badgeLabel: previewBadgeLabel } = useProductConfigValidationBadge(
  previewResult,
  hasNamedPreviewOptions,
);

const itemGroupSelectOptions = computed(() =>
  itemGroups.value.map((group) => ({
    value: String(group._id),
    label: group.name,
  }))
);

const statusSelectOptions = computed(() => [
  { value: 'ACTIVE', label: t('settings.productConfigStatusActive') },
  { value: 'INACTIVE', label: t('settings.productConfigStatusInactive') },
]);

const optionTypeSelectOptions = computed(() => [
  { value: 'dropdown', label: t('settings.productConfigTypeDropdown') },
  { value: 'single_select', label: t('settings.productConfigTypeSingle') },
  { value: 'multi_select', label: t('settings.productConfigTypeMulti') },
  { value: 'checkbox', label: t('settings.productConfigTypeCheckbox') },
]);

const productRuleTypeOptions = computed(() => [
  { value: 'mandatory', label: t('settings.productConfigRuleMandatory') },
  { value: 'min', label: t('settings.productConfigRuleMin') },
  { value: 'max', label: t('settings.productConfigRuleMax') },
  { value: 'quantity', label: t('settings.productConfigRuleQty') },
]);

const compatModeOptions = computed(() => [
  { value: 'incompatible_with', label: t('settings.productConfigModeIncompat') },
  { value: 'compatible_with', label: t('settings.productConfigModeCompat') },
]);

const depActionOptions = computed(() => [
  { value: 'require', label: t('settings.productConfigActionRequire') },
  { value: 'add', label: t('settings.productConfigActionAdd') },
  { value: 'recommend', label: t('settings.productConfigActionRecommend') },
]);

function ruleCount(c) {
  return (c.productRules?.length || 0)
    + (c.compatibilityRules?.length || 0)
    + (c.dependencyRules?.length || 0);
}

function groupName(id) {
  const g = itemGroups.value.find((x) => String(x._id) === String(id));
  return g?.name || '—';
}

function buildPreviewValidateRequest() {
  if (!showForm.value || !namedOptions.value.length) return null;
  return {
    configuration: buildPayload(),
    selections: { ...previewSelections },
    requireActive: false,
  };
}

function queuePreviewValidate() {
  if (!showForm.value) return;
  scheduleValidate(buildPreviewValidateRequest);
}

function onPreviewSelection(optionName, value) {
  previewSelections[optionName] = value;
}

async function runPreviewValidate() {
  if (!showForm.value) return;
  if (!namedOptions.value.length) {
    previewResult.value = null;
    return;
  }
  await validate(buildPreviewValidateRequest);
}

function findOptionByName(name) {
  if (!name) return null;
  return (form.options || []).find((o) => o.optionName === name) || null;
}

function valuesForOptionName(name) {
  return optionValues(findOptionByName(name));
}

function namedOptionSelectOptions(excludeName = '') {
  return namedOptions.value
    .filter((opt) => opt.optionName !== excludeName)
    .map((opt) => ({ value: opt.optionName, label: opt.optionName }));
}

function valueSelectOptions(optionName, emptyLabel = '') {
  const values = valuesForOptionName(optionName);
  return [
    ...(emptyLabel ? [{ value: '', label: emptyLabel }] : []),
    ...values.map((value) => ({ value, label: value })),
  ];
}

function setCompatOptionA(rule, value) {
  rule.optionA = value || '';
  onCompatOptionChange(rule);
}

function setCompatOptionB(rule, value) {
  rule.optionB = value || '';
  onCompatOptionChange(rule);
}

function setDepWhenOption(rule, value) {
  rule.whenOption = value || '';
  onDepWhenOptionChange(rule);
}

function setDepTargetOption(rule, value) {
  rule.targetOption = value || '';
  onDepTargetOptionChange(rule);
}

function toggleDepWhenValue(rule, value, checked) {
  let values = Array.isArray(rule.whenValues) ? [...rule.whenValues] : [];
  if (checked) {
    if (!values.includes(value)) values.push(value);
  } else {
    values = values.filter((entry) => entry !== value);
  }
  rule.whenValues = values;
  queuePreviewValidate();
}

function isCheckboxOptionName(name) {
  return findOptionByName(name)?.optionType === 'checkbox';
}

function goItemGroups() {
  router.push({ path: '/settings', query: { tab: 'catalog', catalogView: 'item-groups' } });
}

function setValueInputRef(oi, el) {
  if (el) valueInputRefs[oi] = el;
}

function setOptionNameInputRef(uid, el) {
  if (el) {
    optionNameInputRefs[uid] = el;
    if (pendingFocusOptionUid === uid) {
      focusOptionName(uid);
    }
  } else {
    delete optionNameInputRefs[uid];
  }
}

function focusOptionName(uid) {
  nextTick(() => {
    const el = optionNameInputRefs[uid];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
    pendingFocusOptionUid = null;
  });
}

function focusValueInput(oi) {
  nextTick(() => valueInputRefs[oi]?.focus?.());
}

function commitDraft(oi) {
  const opt = form.options[oi];
  if (!opt) return;
  const val = String(opt.draft || '').trim();
  if (!val) return;
  if (!opt.values.includes(val)) opt.values.push(val);
  opt.draft = '';
  queuePreviewValidate();
}

function onValueKeydown(e, oi) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    commitDraft(oi);
  } else if (e.key === 'Backspace' && !String(form.options[oi]?.draft || '') && form.options[oi]?.values?.length) {
    form.options[oi].values.pop();
    queuePreviewValidate();
  }
}

function removeOptionValue(oi, vi) {
  form.options[oi]?.values.splice(vi, 1);
  queuePreviewValidate();
}

function moveOption(oi, delta) {
  const next = oi + delta;
  if (next < 0 || next >= form.options.length) return;
  const [row] = form.options.splice(oi, 1);
  form.options.splice(next, 0, row);
}

function addOption() {
  const uid = `opt-${++optUid}`;
  pendingFocusOptionUid = uid;
  form.options.push({
    uid,
    optionName: '',
    optionType: 'dropdown',
    required: false,
    values: [],
    draft: '',
    displayOrder: form.options.length,
    defaultValue: null,
  });
  nextTick(() => {
    if (pendingFocusOptionUid === uid) {
      focusOptionName(uid);
    }
  });
}

function addProductRule() {
  form.productRules.push({ type: 'max', optionName: '', max: 1, min: 1, minQty: null, maxQty: null });
}

function addCompatRule() {
  form.compatibilityRules.push({
    optionA: '',
    optionB: '',
    mode: 'incompatible_with',
    pairs: [],
    draftA: '',
    draftB: '',
  });
}

function onCompatOptionChange(rule) {
  rule.pairs = [];
  rule.draftA = '';
  rule.draftB = '';
}

function addCompatPair(rule) {
  if (!rule.draftA || !rule.draftB) return;
  const exists = (rule.pairs || []).some((p) => p[0] === rule.draftA && p[1] === rule.draftB);
  if (!exists) {
    if (!Array.isArray(rule.pairs)) rule.pairs = [];
    rule.pairs.push([rule.draftA, rule.draftB]);
  }
  rule.draftA = '';
  rule.draftB = '';
  queuePreviewValidate();
}

function addDepRule() {
  form.dependencyRules.push({
    whenOption: '',
    whenValues: [],
    action: 'require',
    targetOption: '',
    targetValue: '',
  });
}

function onDepWhenOptionChange(rule) {
  rule.whenValues = [];
  if (isCheckboxOptionName(rule.whenOption)) {
    rule.whenValues = ['true'];
  }
  queuePreviewValidate();
}

function onDepTargetOptionChange(rule) {
  rule.targetValue = '';
  queuePreviewValidate();
}

function resetPreviewSelections() {
  resetSelectionsForOptions(previewSelections, form.options);
}

function hydrateForm(doc) {
  Object.assign(form, emptyForm(), {
    name: doc.name || '',
    itemGroupId: doc.itemGroupId ? String(doc.itemGroupId) : '',
    description: doc.description || '',
    status: doc.status || 'ACTIVE',
    effectiveFrom: doc.effectiveFrom ? String(doc.effectiveFrom).slice(0, 10) : '',
    effectiveUntil: doc.effectiveUntil ? String(doc.effectiveUntil).slice(0, 10) : '',
    options: (doc.options || []).map((o, i) => ({
      uid: `opt-${++optUid}`,
      optionName: o.optionName || '',
      optionType: o.optionType || 'dropdown',
      required: o.required === true,
      values: [...(o.values || [])],
      draft: '',
      displayOrder: o.displayOrder ?? i,
      defaultValue: o.defaultValue ?? null,
    })),
    productRules: (doc.productRules || []).map((r) => ({ ...r })),
    compatibilityRules: (doc.compatibilityRules || []).map((r) => ({
      optionA: r.optionA || '',
      optionB: r.optionB || '',
      mode: r.mode || 'incompatible_with',
      pairs: Array.isArray(r.pairs) && r.pairs.length
        ? r.pairs.map((p) => [String(p[0]), String(p[1])])
        : (Array.isArray(r.incompatible) ? r.incompatible.map((p) => [String(p[0]), String(p[1])]) : []),
      draftA: '',
      draftB: '',
    })),
    dependencyRules: (doc.dependencyRules || []).map((r) => {
      const whenValues = Array.isArray(r.whenValues) && r.whenValues.length
        ? r.whenValues.map(String)
        : (r.whenValue != null ? [String(r.whenValue)] : []);
      return {
        whenOption: r.whenOption || '',
        whenValues,
        action: r.action || (r.requireOption ? 'require' : (r.addOption ? 'add' : 'require')),
        targetOption: r.targetOption || r.requireOption || r.addOption || '',
        targetValue: r.targetValue != null ? String(r.targetValue) : (r.addValue != null ? String(r.addValue) : ''),
      };
    }),
  });
  resetPreviewSelections();
}

function buildPayload() {
  return {
    name: form.name,
    itemGroupId: form.itemGroupId,
    description: form.description || null,
    status: form.status,
    effectiveFrom: form.effectiveFrom || null,
    effectiveUntil: form.effectiveUntil || null,
    options: form.options.map((o, i) => ({
      optionName: o.optionName,
      optionType: o.optionType,
      required: o.required === true,
      values: optionValues(o),
      displayOrder: i,
      defaultValue: o.defaultValue ?? null,
    })),
    productRules: form.productRules.map((r) => ({
      type: r.type,
      optionName: r.optionName || null,
      min: r.min ?? null,
      max: r.max ?? null,
      minQty: r.minQty ?? null,
      maxQty: r.maxQty ?? null,
    })),
    compatibilityRules: form.compatibilityRules.map((r) => ({
      optionA: r.optionA,
      optionB: r.optionB,
      mode: r.mode,
      pairs: Array.isArray(r.pairs) ? r.pairs : [],
    })),
    dependencyRules: form.dependencyRules.map((r) => ({
      whenOption: r.whenOption,
      whenValues: Array.isArray(r.whenValues) ? r.whenValues.map(String) : [],
      action: r.action,
      targetOption: r.targetOption || null,
      targetValue: r.targetValue || null,
    })),
  };
}

function openCreate() {
  editingId.value = null;
  Object.assign(form, emptyForm());
  resetPreviewSelections();
  previewResult.value = null;
  showForm.value = true;
}

function openEdit(doc) {
  editingId.value = doc._id;
  hydrateForm(doc);
  previewResult.value = null;
  showForm.value = true;
  nextTick(() => runPreviewValidate());
}

function closeForm() {
  clearValidationTimer();
  showForm.value = false;
}

function unwrapList(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res)) return res;
  return [];
}

function unwrapPayload(res) {
  if (res?.data != null && typeof res.data === 'object' && !Array.isArray(res.data) && res.success !== undefined) {
    return res.data;
  }
  return res?.data ?? res ?? null;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const results = await Promise.allSettled([
      apiClient.get('/product-configurations'),
      apiClient.get('/item-groups'),
    ]);
    if (results[0].status === 'fulfilled') {
      configs.value = unwrapList(results[0].value);
    } else {
      configs.value = [];
      error.value = results[0].reason?.response?.data?.message
        || results[0].reason?.message
        || t('states.genericFailure');
    }
    if (results[1].status === 'fulfilled') {
      itemGroups.value = unwrapList(results[1].value);
    } else if (!error.value) {
      itemGroups.value = [];
      error.value = results[1].reason?.response?.data?.message
        || results[1].reason?.message
        || t('states.genericFailure');
    } else {
      itemGroups.value = [];
    }
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!canSave.value) return;
  // Commit any open chip drafts
  form.options.forEach((_, i) => commitDraft(i));
  saving.value = true;
  error.value = '';
  message.value = '';
  try {
    const payload = buildPayload();
    if (editingId.value) {
      await apiClient.put(`/product-configurations/${editingId.value}`, payload);
      message.value = t('settings.productConfigSaved');
    } else {
      await apiClient.post('/product-configurations', payload);
      message.value = t('settings.productConfigCreated');
    }
    showForm.value = false;
    await load();
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || t('states.genericFailure');
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(c) {
  error.value = '';
  try {
    const status = c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await apiClient.patch(`/product-configurations/${c._id}/status`, { status });
    message.value = status === 'ACTIVE'
      ? t('settings.productConfigActivated')
      : t('settings.productConfigDeactivated');
    await load();
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || t('states.genericFailure');
  }
}

watch(
  () => [
    form.name,
    form.options.map((o) => [o.optionName, o.optionType, o.required, [...(o.values || [])]]),
    form.productRules,
    form.compatibilityRules,
    form.dependencyRules,
  ],
  () => {
    // Ensure multi-select keys are arrays
    for (const opt of form.options) {
      if (opt.optionName && opt.optionType === 'multi_select' && !Array.isArray(previewSelections[opt.optionName])) {
        previewSelections[opt.optionName] = [];
      }
    }
    queuePreviewValidate();
  },
  { deep: true }
);

onMounted(load);
</script>
