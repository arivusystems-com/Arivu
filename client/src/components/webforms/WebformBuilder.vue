<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
    <!-- Top bar -->
    <header class="shrink-0 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900 lg:px-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <nav class="mb-1 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <button type="button" :class="WEBFORM_LINK_SUBTLE_CLASS" @click="goBack">
              {{ t('webforms.hubTitle') }}
            </button>
            <ChevronRightIcon class="h-3.5 w-3.5" />
            <span class="truncate font-medium text-gray-900 dark:text-white">
              {{ draft.name || t('webforms.defaultName') }}
            </span>
          </nav>
          <p class="text-xs text-gray-400">{{ draft.webformId || '—' }}</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            :class="WEBFORM_BTN_SECONDARY"
            @click="openSubmissions"
          >
            {{ t('webforms.actionSubmissions') }}
          </button>
          <button
            type="button"
            :class="WEBFORM_BTN_SECONDARY"
            :disabled="saving || !canEdit"
            @click="saveWebform"
          >
            {{ saving ? t('webforms.builderSaving') : t('webforms.builderSaveDraft') }}
          </button>
          <button
            v-if="currentStep !== 'publish'"
            type="button"
            :class="WEBFORM_BTN_PRIMARY"
            :disabled="saving"
            @click="goNextStep"
          >
            {{ t('webforms.builderNext') }}
          </button>
          <button
            v-else-if="canEdit"
            type="button"
            :class="WEBFORM_BTN_PRIMARY"
            :disabled="saving || publishing"
            @click="saveAndPublish"
          >
            {{ t('webforms.builderPublish') }}
          </button>
        </div>
      </div>

      <!-- Stepper -->
      <ol class="mt-4 flex flex-wrap items-center gap-2 sm:gap-0">
        <li
          v-for="(step, index) in steps"
          :key="step.id"
          class="flex items-center"
        >
          <button
            type="button"
            class="flex items-center gap-2 rounded-full px-1 py-1 text-left transition sm:px-2"
            @click="goToStep(step.id)"
          >
            <span
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              :class="stepCircleClass(step.id)"
            >
              <CheckIcon v-if="isStepComplete(step.id)" class="h-4 w-4" />
              <span v-else>{{ index + 1 }}</span>
            </span>
            <span
              class="hidden text-sm font-medium sm:inline"
              :class="currentStep === step.id ? WEBFORM_STEP_TEXT_ACTIVE_CLASS : 'text-gray-500 dark:text-gray-400'"
            >
              {{ step.label }}
            </span>
          </button>
          <ChevronRightIcon
            v-if="index < steps.length - 1"
            class="mx-1 hidden h-4 w-4 text-gray-300 sm:block dark:text-gray-600"
          />
        </li>
      </ol>
    </header>

    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <div :class="WEBFORM_SPINNER_CLASS" />
    </div>

    <!-- Build: 3-column layout -->
    <div v-else-if="currentStep === 'build'" class="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <div class="border-b border-gray-200 bg-white p-3 lg:hidden dark:border-gray-700 dark:bg-gray-900">
        <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('webforms.builderFieldLibrary') }}</label>
        <select :class="inputClass" @change="onMobileAddField($event)">
          <option value="">{{ t('webforms.builderAddField') }}</option>
          <option
            v-for="item in availableModulePalette"
            :key="item.key"
            :value="item.key"
          >
            {{ item.label }}
          </option>
        </select>
      </div>

      <div class="hidden w-56 shrink-0 lg:block xl:w-60">
        <WebformBuilderFieldLibrary
          :create-field="createFieldFromModuleKey"
          :palette="moduleFieldPalette"
          :loading="moduleFieldsLoading"
          @add-field="addFieldFromModuleKey"
        />
      </div>

      <WebformBuilderCanvas
        :webform="draft"
        :fields="canvasFields"
        :selected-field-id="selectedFieldId"
        :selected-button-key="selectedButtonKey"
        :preview-device="previewDevice"
        :active-step-id="draft.multiStep.enabled ? activeBuilderStepId : ''"
        :ordered-steps="orderedBuilderSteps"
        @update:fields="onFieldsUpdate"
        @select-field="onSelectField"
        @select-button="onSelectButton"
        @remove-field="removeField"
        @field-added="onSelectField"
        @update:preview-device="previewDevice = $event"
        @update:active-step-id="activeBuilderStepId = $event"
      />

      <aside class="hidden w-72 shrink-0 overflow-y-auto border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 xl:block xl:w-80">
        <div class="border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-2 p-4 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800/60"
            :aria-expanded="formSettingsOpen"
            @click="formSettingsOpen = !formSettingsOpen"
          >
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderFormSettings') }}</h3>
            <ChevronDownIcon
              class="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200"
              :class="formSettingsOpen ? 'rotate-180' : ''"
            />
          </button>
        </div>

        <div v-show="formSettingsOpen" class="space-y-4 border-b border-gray-200 p-4 dark:border-gray-700">
          <div>
            <h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('webforms.builderHeaderTitle') }}
            </h4>
            <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">{{ t('webforms.builderHeaderHint') }}</p>

            <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderHeaderImage') }}</label>
            <div class="space-y-3">
              <div
                class="rounded-lg border border-dashed border-gray-200 p-3 dark:border-gray-600"
                :class="draft.headerImageUrl ? 'bg-gray-50 dark:bg-gray-900/40' : ''"
              >
                <img
                  v-if="draft.headerImageUrl"
                  :src="resolveHeaderImageUrl(draft.headerImageUrl)"
                  alt=""
                  class="mb-3 max-h-28 w-full rounded-lg border border-gray-200 object-cover dark:border-gray-700"
                >
                <p v-else class="text-xs text-gray-400 dark:text-gray-500">
                  {{ t('webforms.builderHeaderImageEmpty') }}
                </p>
                <div v-if="canEdit" class="flex flex-wrap items-center gap-2">
                  <label
                    :class="[WEBFORM_BTN_PRIMARY_SM, headerImageUploading ? 'pointer-events-none opacity-60' : '']"
                  >
                    <input
                      type="file"
                      class="hidden"
                      accept="image/*"
                      :disabled="headerImageUploading"
                      @change="onHeaderImageSelected"
                    >
                    <span>{{ headerImageUploading ? t('common.formUploading') : t('webforms.builderHeaderImageUpload') }}</span>
                  </label>
                  <button
                    v-if="draft.headerImageUrl"
                    type="button"
                    class="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                    :disabled="headerImageUploading"
                    @click="draft.headerImageUrl = ''"
                  >
                    {{ t('webforms.builderHeaderImageRemove') }}
                  </button>
                </div>
              </div>
              <details v-if="canEdit" class="group">
                <summary class="inline-flex cursor-pointer select-none items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                  <ChevronRightIcon class="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                  {{ t('webforms.builderHeaderImageUrlToggle') }}
                </summary>
                <input
                  v-model="draft.headerImageUrl"
                  type="url"
                  :class="[WEBFORM_INPUT_CLASS, 'mt-2']"
                  :placeholder="t('webforms.builderHeaderImagePh')"
                />
              </details>
              <p class="text-xs text-gray-400">{{ t('webforms.builderHeaderImageHint') }}</p>
            </div>

            <div class="mt-4">
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderHeaderBackground') }}</label>
              <div class="flex items-center gap-2">
                <input
                  :value="draft.headerBackgroundColor || '#f3f4f6'"
                  type="color"
                  class="h-9 w-12 shrink-0 cursor-pointer rounded border border-gray-200 dark:border-gray-600"
                  @input="draft.headerBackgroundColor = $event.target.value === '#f3f4f6' ? '' : $event.target.value"
                />
                <input
                  v-model="draft.headerBackgroundColor"
                  type="text"
                  :class="inputClass"
                  :placeholder="t('webforms.builderHeaderBackgroundPh')"
                />
              </div>
              <p class="mt-1 text-xs text-gray-400">{{ t('webforms.builderHeaderBackgroundHint') }}</p>
            </div>

            <div class="mt-4">
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderHeaderHeadingColor') }}</label>
              <div class="flex items-center gap-2">
                <input
                  :value="draft.branding.headingColor || '#111827'"
                  type="color"
                  class="h-9 w-12 shrink-0 cursor-pointer rounded border border-gray-200 dark:border-gray-600"
                  @input="draft.branding.headingColor = $event.target.value === '#111827' ? '' : $event.target.value"
                />
                <input
                  v-model="draft.branding.headingColor"
                  type="text"
                  :class="inputClass"
                  :placeholder="t('webforms.builderHeaderHeadingColorPh')"
                />
              </div>
            </div>

            <label class="mb-1 mt-4 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderBrandingLogo') }}</label>
            <div class="space-y-3">
              <div class="rounded-lg border border-dashed border-gray-200 p-3 dark:border-gray-600">
                <img
                  v-if="draft.branding.logoUrl"
                  :src="resolveHeaderImageUrl(draft.branding.logoUrl)"
                  alt=""
                  class="mx-auto mb-3 max-h-12 w-auto object-contain"
                >
                <p v-else class="text-xs text-gray-400 dark:text-gray-500">{{ t('webforms.builderBrandingLogoEmpty') }}</p>
                <div v-if="canEdit" class="flex flex-wrap items-center gap-2">
                  <label
                    :class="[WEBFORM_BTN_PRIMARY_SM, logoUploading ? 'pointer-events-none opacity-60' : '']"
                  >
                    <input
                      type="file"
                      class="hidden"
                      accept="image/*"
                      :disabled="logoUploading"
                      @change="onLogoSelected"
                    >
                    <span>{{ logoUploading ? t('common.formUploading') : t('webforms.builderBrandingLogoUpload') }}</span>
                  </label>
                  <button
                    v-if="draft.branding.logoUrl"
                    type="button"
                    class="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                    :disabled="logoUploading"
                    @click="draft.branding.logoUrl = ''"
                  >
                    {{ t('webforms.builderHeaderImageRemove') }}
                  </button>
                </div>
              </div>
              <input
                v-model="draft.branding.logoUrl"
                type="url"
                :class="WEBFORM_INPUT_CLASS"
                :placeholder="t('webforms.builderBrandingLogoPh')"
              />
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderHeaderLogoPosition') }}</label>
                <select v-model="draft.branding.logoPosition" :class="inputClass">
                  <option value="left">{{ t('webforms.builderHeaderLogoPositionLeft') }}</option>
                  <option value="center">{{ t('webforms.builderHeaderLogoPositionCenter') }}</option>
                  <option value="right">{{ t('webforms.builderHeaderLogoPositionRight') }}</option>
                </select>
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderHeaderLogoSize') }}</label>
                <select v-model="draft.branding.logoSize" :class="inputClass">
                  <option value="sm">{{ t('webforms.builderHeaderLogoSizeSm') }}</option>
                  <option value="md">{{ t('webforms.builderHeaderLogoSizeMd') }}</option>
                  <option value="lg">{{ t('webforms.builderHeaderLogoSizeLg') }}</option>
                  <option value="xl">{{ t('webforms.builderHeaderLogoSizeXl') }}</option>
                </select>
              </div>
            </div>
          </div>

          <div class="border-t border-gray-100 pt-4 dark:border-gray-800">
            <h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('webforms.builderBrandingTitle') }}
            </h4>
            <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">{{ t('webforms.builderBrandingHint') }}</p>

            <div class="grid gap-3 sm:grid-cols-1">
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderBrandingThemeColor') }}</label>
                <div class="flex items-center gap-2">
                  <input v-model="draft.branding.themeColor" type="color" class="h-9 w-12 shrink-0 cursor-pointer rounded border border-gray-200 dark:border-gray-600" />
                  <input v-model="draft.branding.themeColor" type="text" :class="inputClass" />
                </div>
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderBrandingFormBodyBackground') }}</label>
                <div class="flex items-center gap-2">
                  <input
                    :value="draft.branding.formBodyBackgroundColor || '#ffffff'"
                    type="color"
                    class="h-9 w-12 shrink-0 cursor-pointer rounded border border-gray-200 dark:border-gray-600"
                    @input="draft.branding.formBodyBackgroundColor = $event.target.value === '#ffffff' ? '' : $event.target.value"
                  />
                  <input
                    v-model="draft.branding.formBodyBackgroundColor"
                    type="text"
                    :class="inputClass"
                    :placeholder="t('webforms.builderBrandingFormBodyBackgroundPh')"
                  />
                </div>
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderBrandingBackground') }}</label>
                <div class="flex items-center gap-2">
                  <input
                    :value="draft.branding.backgroundColor || '#f9fafb'"
                    type="color"
                    class="h-9 w-12 shrink-0 cursor-pointer rounded border border-gray-200 dark:border-gray-600"
                    @input="draft.branding.backgroundColor = $event.target.value === '#f9fafb' ? '' : $event.target.value"
                  />
                  <input
                    v-model="draft.branding.backgroundColor"
                    type="text"
                    :class="inputClass"
                    :placeholder="t('webforms.builderBrandingBackgroundPh')"
                  />
                </div>
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderBrandingFont') }}</label>
                <select v-model="draft.branding.fontFamily" :class="inputClass">
                  <option value="system">{{ t('webforms.builderBrandingFontSystem') }}</option>
                  <option value="serif">{{ t('webforms.builderBrandingFontSerif') }}</option>
                  <option value="mono">{{ t('webforms.builderBrandingFontMono') }}</option>
                </select>
              </div>
            </div>
          </div>

          <div class="border-t border-gray-100 pt-4 dark:border-gray-800">
            <h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('webforms.builderMultiStepTitle') }}
            </h4>
            <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">{{ t('webforms.builderMultiStepHint') }}</p>

            <label class="mb-3 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                v-model="draft.multiStep.enabled"
                type="checkbox"
                :class="WEBFORM_CHECKBOX_CLASS"
                @change="onMultiStepToggle"
              />
              {{ t('webforms.builderMultiStepEnabled') }}
            </label>

            <div v-if="draft.multiStep.enabled" class="space-y-3">
              <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  v-model="draft.multiStep.showProgress"
                  type="checkbox"
                  :class="WEBFORM_CHECKBOX_CLASS"
                />
                {{ t('webforms.builderMultiStepShowProgress') }}
              </label>

              <div
                v-for="(step, index) in orderedBuilderSteps"
                :key="step.stepId"
                class="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
              >
                <div class="mb-2 flex items-center justify-between gap-2">
                  <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {{ t('webforms.builderMultiStepNumber', { number: index + 1 }) }}
                  </span>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 dark:hover:text-gray-300"
                      :disabled="index === 0"
                      @click="moveBuilderStep(index, -1)"
                    >
                      {{ t('webforms.builderMultiStepMoveUp') }}
                    </button>
                    <button
                      type="button"
                      class="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 dark:hover:text-gray-300"
                      :disabled="index === orderedBuilderSteps.length - 1"
                      @click="moveBuilderStep(index, 1)"
                    >
                      {{ t('webforms.builderMultiStepMoveDown') }}
                    </button>
                    <button
                      type="button"
                      class="text-xs text-red-600 hover:text-red-700 disabled:opacity-40 dark:text-red-400"
                      :disabled="orderedBuilderSteps.length <= 2"
                      @click="removeBuilderStep(step.stepId)"
                    >
                      {{ t('webforms.builderMultiStepRemove') }}
                    </button>
                  </div>
                </div>
                <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderMultiStepLabel') }}</label>
                <input v-model="step.title" type="text" :class="inputClass" />
                <label class="mb-1 mt-2 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderMultiStepDescription') }}</label>
                <textarea v-model="step.description" rows="2" :class="inputClass" />
              </div>

              <button
                type="button"
                :class="['text-xs', WEBFORM_LINK_CLASS]"
                @click="addBuilderStep"
              >
                {{ t('webforms.builderMultiStepAdd') }}
              </button>
            </div>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.fieldName') }}</label>
            <input v-model="draft.name" type="text" :class="inputClass" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.fieldDescription') }}</label>
            <textarea v-model="draft.description" rows="2" :class="inputClass" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.fieldTargetModule') }}</label>
            <p class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-200">
              {{ targetModuleLabel }}
            </p>
            <p class="mt-1 text-xs text-gray-400">{{ t('webforms.builderTargetModuleLocked') }}</p>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.fieldStatus') }}</label>
            <select v-model="draft.status" :class="inputClass">
              <option value="Draft">{{ t('webforms.statusDraft') }}</option>
              <option value="Active">{{ t('webforms.statusActive') }}</option>
              <option value="Archived">{{ t('webforms.statusArchived') }}</option>
            </select>
          </div>

          <div class="border-t border-gray-100 pt-4 dark:border-gray-800">
            <h4 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('webforms.builderFormActions') }}
            </h4>
            <div class="space-y-3">
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderFormActionsAlign') }}</label>
                <select v-model="draft.formActions.align" :class="inputClass">
                  <option v-for="align in buttonAligns" :key="align" :value="align">
                    {{ t(`webforms.builderFormActionsAlign_${align}`) }}
                  </option>
                </select>
              </div>
              <label class="flex items-center justify-between gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span>{{ t('webforms.builderFormActionsReset') }}</span>
                <input v-model="draft.formActions.reset.enabled" type="checkbox" :class="WEBFORM_CHECKBOX_CLASS" />
              </label>
              <label class="flex items-center justify-between gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span>{{ t('webforms.builderFormActionsCancel') }}</span>
                <input v-model="draft.formActions.cancel.enabled" type="checkbox" :class="WEBFORM_CHECKBOX_CLASS" />
              </label>
            </div>
          </div>
        </div>

        <div v-if="selectedButtonKey" class="border-t border-gray-200 p-4 dark:border-gray-700">
          <h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{{ selectedButtonInspectorTitle }}</h3>
          <div class="space-y-3">
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderFormActionsLabel') }}</label>
              <input
                v-model="draft.formActions[selectedButtonKey].label"
                type="text"
                :class="inputClass"
                :placeholder="selectedButtonLabelPlaceholder"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderFormActionsColor') }}</label>
                <select v-model="draft.formActions[selectedButtonKey].color" :class="inputClass">
                  <option v-for="color in buttonColors" :key="color" :value="color">{{ t(`webforms.builderFormActionsColor_${color}`) }}</option>
                </select>
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderFormActionsWidth') }}</label>
                <select v-model="draft.formActions[selectedButtonKey].width" :class="inputClass">
                  <option v-for="width in buttonWidths" :key="width" :value="width">{{ t(`webforms.builderFormActionsWidth_${width}`) }}</option>
                </select>
              </div>
            </div>

            <div v-if="selectedButtonKey === 'cancel'">
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderFormActionsCancelUrl') }}</label>
              <input v-model="draft.formActions.cancel.redirectUrl" type="url" :class="inputClass" :placeholder="t('webforms.builderFormActionsCancelUrlPh')" />
              <p class="mt-1 text-xs text-gray-400">{{ t('webforms.builderFormActionsCancelUrlHint') }}</p>
            </div>
          </div>
        </div>

        <div v-else-if="selectedField" class="border-t border-gray-200 p-4 dark:border-gray-700">
          <h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderFieldInspector') }}</h3>
          <div class="space-y-3">
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderFieldLabel') }}</label>
              <input v-model="selectedField.label" type="text" :class="inputClass" />
            </div>
            <div v-if="selectedField.crmFieldKey">
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderModuleFieldKey') }}</label>
              <p class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-200">
                {{ selectedField.crmFieldKey }}
              </p>
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderFieldType') }}</label>
              <p class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-200">
                {{ selectedField.type }}
              </p>
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderFieldPlaceholder') }}</label>
              <input v-model="selectedField.placeholder" type="text" :class="inputClass" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderFieldWidth') }}</label>
              <select v-model="selectedField.columnWidth" :class="inputClass">
                <option value="full">{{ t('webforms.builderFieldWidthFull') }}</option>
                <option value="half">{{ t('webforms.builderFieldWidthHalf') }}</option>
              </select>
            </div>
            <div v-if="draft.multiStep.enabled">
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderMultiStepFieldStep') }}</label>
              <select v-model="selectedField.stepId" :class="inputClass">
                <option
                  v-for="step in orderedBuilderSteps"
                  :key="step.stepId"
                  :value="step.stepId"
                >
                  {{ step.title || t('webforms.multiStepUntitled', { number: step.order + 1 }) }}
                </option>
              </select>
            </div>
            <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                v-model="selectedField.required"
                type="checkbox"
                :class="WEBFORM_CHECKBOX_CLASS"
                :disabled="selectedFieldMandatoryLocked"
              />
              {{ t('webforms.builderFieldRequired') }}
            </label>
            <p v-if="selectedFieldMandatoryLocked" class="text-xs text-gray-400">
              {{ t('webforms.builderMandatoryFieldLocked') }}
            </p>
            <div v-if="fieldTypeNeedsOptions(selectedField.type)">
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderFieldOptions') }}</label>
              <input
                :value="(selectedField.options || []).join(', ')"
                type="text"
                :class="inputClass"
                :placeholder="t('webforms.builderFieldOptionsPh')"
                :disabled="crmPicklistBound(selectedField)"
                @input="updateFieldOptions(selectedField, $event.target.value)"
              />
              <p v-if="crmPicklistBound(selectedField)" class="mt-1 text-xs text-gray-400">
                {{ t('webforms.builderFieldOptionsFromCrm') }}
              </p>
            </div>

            <div v-if="selectedField.crmFieldKey" class="border-t border-gray-100 pt-3 dark:border-gray-800">
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ t('webforms.builderVisibilityFromModule') }}
              </p>
            </div>

            <div v-else class="border-t border-gray-100 pt-3 dark:border-gray-800">
              <div class="flex items-center justify-between gap-2">
                <div>
                  <h4 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {{ t('webforms.builderVisibilityTitle') }}
                  </h4>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('webforms.builderVisibilityHint') }}</p>
                </div>
                <label class="inline-flex shrink-0 items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                  <input
                    v-model="selectedFieldVisibility.enabled"
                    type="checkbox"
                    :class="WEBFORM_CHECKBOX_CLASS"
                  />
                  {{ t('webforms.builderVisibilityEnabled') }}
                </label>
              </div>

              <div v-if="selectedFieldVisibility.enabled" class="mt-3 space-y-3">
                <div>
                  <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderVisibilityMatch') }}</label>
                  <select v-model="selectedFieldVisibility.match" :class="inputClass">
                    <option value="all">{{ t('webforms.builderVisibilityMatchAll') }}</option>
                    <option value="any">{{ t('webforms.builderVisibilityMatchAny') }}</option>
                  </select>
                </div>

                <div
                  v-for="(condition, index) in selectedFieldVisibility.conditions"
                  :key="`${selectedField.fieldId}-${index}`"
                  class="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                >
                  <div class="space-y-2">
                    <div>
                      <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderVisibilitySourceField') }}</label>
                      <select v-model="condition.fieldId" :class="inputClass" @change="onVisibilitySourceChange(condition)">
                        <option value="">{{ t('webforms.builderVisibilitySourceFieldPh') }}</option>
                        <option
                          v-for="sourceField in visibilitySourceFields"
                          :key="sourceField.fieldId"
                          :value="sourceField.fieldId"
                        >
                          {{ sourceField.label }}
                        </option>
                      </select>
                    </div>
                    <div>
                      <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderVisibilityOperator') }}</label>
                      <select v-model="condition.operator" :class="inputClass">
                        <option
                          v-for="operator in operatorsForVisibilityCondition(condition)"
                          :key="operator"
                          :value="operator"
                        >
                          {{ t(`webforms.builderVisibilityOperator_${operator}`) }}
                        </option>
                      </select>
                    </div>
                    <div v-if="visibilityConditionNeedsValue(condition)">
                      <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderVisibilityValue') }}</label>
                      <PicklistComboboxField
                        v-if="visibilityConditionValueOptions(condition).length"
                        v-model="condition.value"
                        :options="visibilityConditionValueOptions(condition)"
                        :placeholder="t('webforms.publicSelectOption')"
                      />
                      <input
                        v-else
                        v-model="condition.value"
                        type="text"
                        :class="inputClass"
                        :placeholder="t('webforms.builderVisibilityValuePh')"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    class="mt-2 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                    @click="removeVisibilityCondition(index)"
                  >
                    {{ t('webforms.builderVisibilityRemoveCondition') }}
                  </button>
                </div>

                <button
                  type="button"
                  :class="['text-xs', WEBFORM_LINK_CLASS]"
                  :disabled="!visibilitySourceFields.length"
                  @click="addVisibilityCondition"
                >
                  {{ t('webforms.builderVisibilityAddCondition') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="border-t border-gray-200 p-4 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderAnalyticsTitle') }}</h3>
          <div class="mt-3">
            <WebformAnalyticsPanel v-if="draft._id" :webform-id="draft._id" />
            <p v-else class="text-xs text-gray-400">{{ t('webforms.builderAnalyticsHint') }}</p>
          </div>
        </div>
      </aside>
    </div>

    <!-- Configure -->
    <div v-else-if="currentStep === 'configure'" class="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
      <div class="mx-auto max-w-3xl space-y-5">
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderStepConfigure') }}</h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('webforms.builderStepConfigureHint') }}</p>
        </div>

        <section class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderRecordAction') }}</h3>
          <select v-model="draft.recordAction" :class="[inputClass, 'mt-3 max-w-md']">
            <option value="create">{{ t('webforms.builderRecordActionCreate') }}</option>
            <option value="update">{{ t('webforms.builderRecordActionUpdate') }}</option>
            <option value="create_or_update">{{ t('webforms.builderRecordActionUpsert') }}</option>
          </select>
          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">{{ t('webforms.builderOutcomesCrmNote') }}</p>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderDedupTitle') }}</h3>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('webforms.builderDedupHint') }}</p>
            </div>
            <label class="inline-flex items-center gap-2 text-sm">
              <input v-model="draft.dedup.enabled" type="checkbox" :class="WEBFORM_CHECKBOX_CLASS" />
              {{ t('webforms.builderDedupEnabled') }}
            </label>
          </div>
          <div v-if="draft.dedup.enabled" class="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderDedupAction') }}</label>
              <select v-model="draft.dedup.action" :class="inputClass">
                <option value="update">{{ t('webforms.builderDedupActionUpdate') }}</option>
                <option value="reject">{{ t('webforms.builderDedupActionReject') }}</option>
                <option value="create_anyway">{{ t('webforms.builderDedupActionCreateAnyway') }}</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderDedupKeys') }}</label>
              <input v-model="dedupKeysInput" type="text" :class="inputClass" :placeholder="dedupKeysPlaceholder" />
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderCaptchaTitle') }}</h3>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('webforms.builderCaptchaHint') }}</p>
            </div>
            <label class="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <input v-model="draft.captcha.enabled" type="checkbox" :class="WEBFORM_CHECKBOX_CLASS" />
              {{ t('webforms.builderCaptchaEnabled') }}
            </label>
          </div>

          <div v-if="draft.captcha.enabled" class="mt-4 space-y-4 border-t border-gray-100 pt-4 dark:border-gray-800">
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderCaptchaSiteKey') }}</label>
              <input
                v-model="draft.captcha.siteKey"
                type="text"
                :class="inputClass"
                :placeholder="t('webforms.builderCaptchaSiteKeyPh')"
                autocomplete="off"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderCaptchaSecretKey') }}</label>
              <input
                v-model="draft.captcha.secretKey"
                type="password"
                :class="inputClass"
                :placeholder="captchaSecretPlaceholder"
                autocomplete="new-password"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('webforms.builderCaptchaSecretHint') }}</p>
            </div>
            <p
              class="rounded-lg px-3 py-2 text-xs"
              :class="captchaStatusClass"
            >
              {{ captchaStatusMessage }}
            </p>
          </div>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderSubmissionExperience') }}</h3>
          <div class="mt-4 space-y-4">
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderThankYou') }}</label>
              <textarea v-model="draft.thankYouMessage" rows="3" :class="inputClass" :placeholder="t('webforms.builderThankYouPh')" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderRedirectUrl') }}</label>
              <input v-model="draft.redirectUrl" type="url" :class="inputClass" :placeholder="t('webforms.builderRedirectUrlPh')" />
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Automate -->
    <div v-else-if="currentStep === 'automate'" class="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
      <div class="mx-auto max-w-3xl space-y-5">
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderStepAutomate') }}</h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('webforms.builderStepAutomateHint') }}</p>
        </div>

        <section class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderNotifyTitle') }}</h3>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('webforms.builderNotifyHint') }}</p>
            </div>
            <label class="inline-flex items-center gap-2 text-sm">
              <input v-model="draft.notifyOnSubmit.enabled" type="checkbox" :class="WEBFORM_CHECKBOX_CLASS" />
              {{ t('webforms.builderNotifyEnabled') }}
            </label>
          </div>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderTaskTitle') }}</h3>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('webforms.builderTaskHint') }}</p>
            </div>
            <label class="inline-flex items-center gap-2 text-sm">
              <input v-model="draft.taskOnSubmit.enabled" type="checkbox" :class="WEBFORM_CHECKBOX_CLASS" />
              {{ t('webforms.builderTaskEnabled') }}
            </label>
          </div>
          <div v-if="draft.taskOnSubmit.enabled" class="mt-4 space-y-3">
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderTaskTitleField') }}</label>
              <input v-model="draft.taskOnSubmit.title" type="text" :class="inputClass" :placeholder="t('webforms.builderTaskTitlePh')" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderTaskDescription') }}</label>
              <textarea v-model="draft.taskOnSubmit.description" rows="2" :class="inputClass" :placeholder="t('webforms.builderTaskDescriptionPh')" />
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderTaskDueDays') }}</label>
                <input v-model.number="draft.taskOnSubmit.dueInDays" type="number" min="0" :class="inputClass" :placeholder="t('webforms.builderTaskDueDaysPh')" />
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderTaskAssignee') }}</label>
                <select v-model="draft.taskOnSubmit.assignee" :class="inputClass">
                  <option value="record_owner">{{ t('webforms.builderTaskAssigneeRecordOwner') }}</option>
                  <option value="webform_creator">{{ t('webforms.builderTaskAssigneeCreator') }}</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderWebhookTitle') }}</h3>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('webforms.builderWebhookHint') }}</p>
            </div>
            <label class="inline-flex items-center gap-2 text-sm">
              <input v-model="draft.webhook.enabled" type="checkbox" :class="WEBFORM_CHECKBOX_CLASS" />
              {{ t('webforms.builderWebhookEnabled') }}
            </label>
          </div>
          <div v-if="draft.webhook.enabled" class="mt-4 space-y-3">
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderWebhookUrl') }}</label>
              <input v-model="draft.webhook.url" type="url" :class="inputClass" :placeholder="t('webforms.builderWebhookUrlPh')" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('webforms.builderWebhookSecret') }}</label>
              <input v-model="draft.webhook.secret" type="password" autocomplete="new-password" :class="[inputClass, 'max-w-md']" :placeholder="t('webforms.builderWebhookSecretPh')" />
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Publish -->
    <div v-else-if="currentStep === 'publish'" class="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
      <div class="mx-auto max-w-3xl space-y-5">
        <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div class="flex items-start gap-3">
            <CheckCircleIcon class="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 class="text-lg font-semibold text-emerald-900 dark:text-emerald-200">{{ t('webforms.builderPublishReady') }}</h2>
              <p class="mt-1 text-sm text-emerald-800 dark:text-emerald-300">{{ t('webforms.builderStepPublishHint') }}</p>
            </div>
          </div>
        </div>

        <div v-if="publicUrl" class="space-y-4">
          <section class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderCaptchaPublishTitle') }}</h3>
            <p class="mt-2 text-sm" :class="captchaStatusClass">{{ captchaStatusMessage }}</p>
          </section>

          <section class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderHostedUrl') }}</h3>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <a
                :href="publicUrl"
                target="_blank"
                rel="noopener"
                :class="WEBFORM_LINK_CLASS"
                @click="openHostedUrl"
              >{{ publicUrl }}</a>
              <button type="button" class="rounded-lg border border-gray-200 px-2 py-1 text-xs dark:border-gray-600" @click="copyText(publicUrl)">{{ t('actions.copy') }}</button>
              <button type="button" class="rounded-lg border border-gray-200 px-2 py-1 text-xs dark:border-gray-600" @click="previewPublic">{{ t('webforms.builderPreview') }}</button>
            </div>
          </section>

          <section v-if="draft.publicLink?.slug" class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderEmbedIframe') }}</h3>
            <textarea :value="iframeSnippet" readonly rows="3" :class="[inputClass, 'mt-2 font-mono text-xs']" />
            <button type="button" :class="['mt-2', WEBFORM_LINK_CLASS]" @click="copyText(iframeSnippet)">{{ t('actions.copy') }}</button>
          </section>

          <section v-if="draft.publicLink?.slug" class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderEmbedScript') }}</h3>
            <textarea :value="scriptSnippet" readonly rows="3" :class="[inputClass, 'mt-2 font-mono text-xs']" />
            <button type="button" :class="['mt-2', WEBFORM_LINK_CLASS]" @click="copyText(scriptSnippet)">{{ t('actions.copy') }}</button>
          </section>

          <section v-if="draft.publicLink?.slug && prefillExampleUrl" class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderPrefillTitle') }}</h3>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('webforms.builderPrefillHint') }}</p>
            <textarea :value="prefillExampleUrl" readonly rows="2" :class="[inputClass, 'mt-2 font-mono text-xs']" />
            <button type="button" :class="['mt-2', WEBFORM_LINK_CLASS]" @click="copyText(prefillExampleUrl)">{{ t('actions.copy') }}</button>
          </section>
        </div>

        <div v-else class="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-600 dark:bg-gray-900">
          <GlobeAltIcon class="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p class="mt-3 text-sm text-gray-600 dark:text-gray-400">{{ t('webforms.builderNotPublished') }}</p>
          <button
            type="button"
            :class="WEBFORM_BTN_PRIMARY"
            :disabled="publishing"
            @click="enablePublicLink"
          >
            {{ t('webforms.builderEnablePublic') }}
          </button>
        </div>

        <WebformLivePreview v-if="draft.fields.length && previewWebform" :webform="previewWebform" />
        <div v-else-if="draft.fields.length" class="flex justify-center py-12">
          <div :class="WEBFORM_SPINNER_CLASS" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GlobeAltIcon
} from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import { canManageWebforms } from '@/utils/settingsTabAccess';
import { uploadWebformHeaderImage } from '@/utils/webformHeaderImageUpload';
import WebformLivePreview from '@/components/webforms/WebformLivePreview.vue';
import WebformBuilderFieldLibrary from '@/components/webforms/WebformBuilderFieldLibrary.vue';
import WebformBuilderCanvas from '@/components/webforms/WebformBuilderCanvas.vue';
import WebformAnalyticsPanel from '@/components/webforms/WebformAnalyticsPanel.vue';
import PicklistComboboxField from '@/components/common/PicklistComboboxField.vue';
import { captureWebformPublished } from '@/config/posthogWebforms';
import { WEBFORM_BUILDER_STEPS } from '@/constants/webformBuilderFields';
import {
  fieldTypeNeedsOptions,
  normalizeWebformFieldType
} from '@/constants/moduleFieldTypes';
import {
  buildWebformFillFieldsFromDraft,
  defaultFormActions,
  mergeFormActions,
  normalizePublicWebformPayload,
  WEBFORM_BUTTON_ALIGNS,
  WEBFORM_BUTTON_COLORS,
  WEBFORM_BUTTON_WIDTHS
} from '@/utils/webformFormActions';
import {
  buildWebformIframeSnippet,
  buildWebformPublicUrl,
  buildWebformScriptSnippet,
  resolveWebformImageUrl
} from '@/utils/webformFormatters';
import { fetchWebformModuleDefinition } from '@/utils/webformModuleDefinition';
import {
  applyModuleFieldToWebformField,
  createWebformFieldFromModuleField,
  isBaseMandatoryModuleField,
  moduleFieldsForWebformPalette
} from '@/utils/webformModuleFields';
import { isCrmPicklistField } from '@/utils/webformCrmFieldUtils';
import { buildWebformPrefillExampleUrl } from '@/utils/webformPrefill';
import { defaultWebformBranding, mergeWebformBranding } from '@/utils/webformBranding';
import {
  WEBFORM_BTN_PRIMARY,
  WEBFORM_BTN_PRIMARY_SM,
  WEBFORM_BTN_SECONDARY,
  WEBFORM_CHECKBOX_CLASS,
  WEBFORM_INPUT_CLASS,
  WEBFORM_LINK_CLASS,
  WEBFORM_LINK_SUBTLE_CLASS,
  WEBFORM_SPINNER_CLASS,
  WEBFORM_STEP_ACTIVE_CLASS,
  WEBFORM_STEP_COMPLETE_CLASS,
  WEBFORM_STEP_IDLE_CLASS,
  WEBFORM_STEP_TEXT_ACTIVE_CLASS
} from '@/utils/webformUiClasses';
import {
  conditionOperatorNeedsValue,
  defaultFieldVisibility,
  operatorsForSourceFieldType,
  sanitizeFieldVisibility
} from '@/utils/webformConditionalLogic';
import {
  defaultMultiStepConfig,
  defaultWebformStep,
  ensureDefaultSteps,
  fieldsOnStep,
  nextWebformStepId,
  orderedWebformSteps,
  sanitizeFieldStepId,
  sanitizeMultiStepConfig,
  sanitizeWebformSteps
} from '@/utils/webformMultiStep';

const props = defineProps({
  webformId: { type: String, required: true }
});

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { success: notifySuccess, error: notifyError } = useNotifications();

const loading = ref(true);
const saving = ref(false);
const publishing = ref(false);
const headerImageUploading = ref(false);
const logoUploading = ref(false);
const formSettingsOpen = ref(true);
const buttonColors = WEBFORM_BUTTON_COLORS;
const buttonWidths = WEBFORM_BUTTON_WIDTHS;
const buttonAligns = WEBFORM_BUTTON_ALIGNS;

/** Bumps when save/load starts so stale in-flight GETs cannot overwrite fresh saves. */
let draftSyncGeneration = 0;
const currentStep = ref('build');
const targetModules = ref([]);
const moduleFields = ref([]);
const moduleFieldsLoading = ref(false);
const fillPreviewPayload = ref(null);
let fillPreviewGeneration = 0;
let fillPreviewTimer = null;
const selectedFieldId = ref('');
const selectedButtonKey = ref('');
const activeBuilderStepId = ref('');
const previewDevice = ref('desktop');
const dedupKeysInput = ref('');

const RESERVED_CRM_KEYS = new Set([
  '_id', 'organizationid', 'createdat', 'updatedat', 'createdby', 'modifiedby',
  'deletedat', 'deletedby', 'deletionreason', 'source'
]);

const usedCrmFieldKeys = computed(() => {
  const keys = new Set();
  for (const field of draft.fields) {
    const key = String(field.crmFieldKey || '').trim().toLowerCase();
    if (key) keys.add(key);
  }
  return keys;
});

const moduleFieldPalette = computed(() =>
  moduleFieldsForWebformPalette(draft.targetModuleKey, moduleFields.value, usedCrmFieldKeys.value)
);

const availableModulePalette = computed(() =>
  moduleFieldPalette.value.filter((item) => !item.onCanvas)
);

const targetModuleLabel = computed(() => {
  const mod = targetModules.value.find(
    (row) => row.moduleKey === draft.targetModuleKey
      && String(row.appKey || '').toUpperCase() === String(draft.targetAppKey || '').toUpperCase()
  ) || targetModules.value.find((row) => row.moduleKey === draft.targetModuleKey);
  if (mod?.label) return mod.label;
  return draft.targetModuleKey;
});

const selectedFieldMandatoryLocked = computed(() => {
  if (!selectedField.value?.crmFieldKey) return false;
  const moduleField = findModuleFieldByKey(selectedField.value.crmFieldKey);
  return isBaseMandatoryModuleField(draft.targetModuleKey, moduleField, moduleFields.value);
});

const previewWebform = computed(() => fillPreviewPayload.value);

function scheduleFillPreviewRefresh() {
  if (fillPreviewTimer) {
    window.clearTimeout(fillPreviewTimer);
  }
  fillPreviewTimer = window.setTimeout(() => {
    void refreshFillPreviewPayload();
  }, 200);
}

async function refreshFillPreviewPayload() {
  if (!draft.fields.length) {
    fillPreviewPayload.value = null;
    return;
  }

  const generation = ++fillPreviewGeneration;
  try {
    const res = await apiClient.post('/webforms/fill-preview-payload', {
      webformId: draft.webformId,
      name: draft.name,
      description: draft.description,
      status: draft.status,
      targetModuleKey: draft.targetModuleKey,
      targetAppKey: draft.targetAppKey,
      multiStep: draft.multiStep,
      steps: draft.steps,
      fields: draft.fields,
      headerImageUrl: draft.headerImageUrl,
      headerBackgroundColor: draft.headerBackgroundColor,
      branding: draft.branding,
      formActions: draft.formActions,
      thankYouMessage: draft.thankYouMessage,
      redirectUrl: draft.redirectUrl,
      captcha: draft.captcha
    });
    if (generation !== fillPreviewGeneration) return;
    fillPreviewPayload.value = res?.success && res.data
      ? normalizePublicWebformPayload(res.data)
      : null;
  } catch (err) {
    console.warn('[WebformBuilder] fill preview payload failed', err);
    if (generation === fillPreviewGeneration) {
      fillPreviewPayload.value = null;
    }
  }
}

const draft = reactive({
  _id: '',
  webformId: '',
  name: '',
  description: '',
  status: 'Draft',
  targetModuleKey: 'people',
  targetAppKey: 'PLATFORM',
  fields: [],
  recordAction: 'create',
  dedup: { enabled: false, keys: [], action: 'update' },
  notifyOnSubmit: { enabled: true, userIds: [] },
  taskOnSubmit: {
    enabled: false,
    title: '',
    description: '',
    dueInDays: null,
    assignee: 'record_owner',
    assigneeUserId: ''
  },
  webhook: { enabled: false, url: '', secret: '' },
  captcha: { enabled: false, siteKey: '', secretKey: '', secretConfigured: false },
  thankYouMessage: '',
  redirectUrl: '',
  headerImageUrl: '',
  headerBackgroundColor: '',
  branding: defaultWebformBranding(),
  multiStep: defaultMultiStepConfig(),
  steps: [],
  formActions: defaultFormActions(),
  publicLink: { enabled: false, slug: '' },
  totalSubmissions: 0
});

const DEFAULT_DEDUP_KEYS = {
  people: ['email', 'phone'],
  organizations: ['name'],
  cases: ['requesterEmail'],
  deals: ['name']
};

const steps = computed(() => [
  { id: 'build', label: t('webforms.builderStepBuild') },
  { id: 'configure', label: t('webforms.builderStepConfigure') },
  { id: 'automate', label: t('webforms.builderStepAutomate') },
  { id: 'publish', label: t('webforms.builderStepPublish') }
]);

const inputClass = WEBFORM_INPUT_CLASS;

const canEdit = computed(() => canManageWebforms({
  isOwner: !!authStore.user?.isOwner,
  role: authStore.user?.role,
  permissions: authStore.user?.permissions
}, 'edit'));

const dedupKeysPlaceholder = computed(() => {
  const defaults = DEFAULT_DEDUP_KEYS[draft.targetModuleKey] || ['email'];
  return defaults.join(', ');
});

const captchaSecretPlaceholder = computed(() => {
  if (draft.captcha.secretConfigured) {
    return t('webforms.builderCaptchaSecretConfiguredPh');
  }
  return t('webforms.builderCaptchaSecretKeyPh');
});

const captchaIsConfigured = computed(() => {
  if (!draft.captcha.enabled) return false;
  const hasSiteKey = Boolean(String(draft.captcha.siteKey || '').trim());
  const hasSecret = Boolean(String(draft.captcha.secretKey || '').trim()) || draft.captcha.secretConfigured;
  return hasSiteKey && hasSecret;
});

const captchaStatusMessage = computed(() => {
  if (!draft.captcha.enabled) {
    return t('webforms.builderCaptchaStatusDisabled');
  }
  if (captchaIsConfigured.value) {
    return t('webforms.builderCaptchaStatusReady');
  }
  return t('webforms.builderCaptchaStatusIncomplete');
});

const captchaStatusClass = computed(() => {
  if (!draft.captcha.enabled) {
    return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-800/60';
  }
  if (captchaIsConfigured.value) {
    return 'text-emerald-800 bg-emerald-50 dark:text-emerald-200 dark:bg-emerald-950/30';
  }
  return 'text-amber-800 bg-amber-50 dark:text-amber-200 dark:bg-amber-950/30';
});

const selectedField = computed(() =>
  draft.fields.find((field) => field.fieldId === selectedFieldId.value) || null
);

const BUTTON_INSPECTOR_TITLE_KEYS = {
  submit: 'webforms.builderFormActionsSubmit',
  next: 'webforms.builderFormActionsNext',
  back: 'webforms.builderFormActionsBack',
  reset: 'webforms.builderFormActionsReset',
  cancel: 'webforms.builderFormActionsCancel'
};

const BUTTON_LABEL_PLACEHOLDER_KEYS = {
  submit: 'webforms.publicSubmit',
  next: 'webforms.multiStepNext',
  back: 'webforms.multiStepBack',
  reset: 'webforms.formActionReset',
  cancel: 'webforms.formActionCancel'
};

const selectedButtonInspectorTitle = computed(() => {
  const key = selectedButtonKey.value;
  return t(BUTTON_INSPECTOR_TITLE_KEYS[key] || 'webforms.builderFormActions');
});

const selectedButtonLabelPlaceholder = computed(() => {
  const key = selectedButtonKey.value;
  return t(BUTTON_LABEL_PLACEHOLDER_KEYS[key] || '');
});

function onSelectField(fieldId) {
  selectedFieldId.value = fieldId;
  selectedButtonKey.value = '';
}

function onSelectButton(key) {
  selectedButtonKey.value = key;
  selectedFieldId.value = '';
}

watch(selectedField, (field) => {
  if (field && !field.visibility) {
    field.visibility = defaultFieldVisibility();
  }
}, { immediate: true });

const selectedFieldVisibility = computed(() => {
  if (!selectedField.value) return defaultFieldVisibility();
  return selectedField.value.visibility || defaultFieldVisibility();
});

const visibilitySourceFields = computed(() => {
  if (!selectedField.value) return [];
  return draft.fields.filter((field) => field.fieldId !== selectedField.value.fieldId);
});

const orderedBuilderSteps = computed(() => orderedWebformSteps(draft));

const canvasFields = computed(() => {
  if (!draft.multiStep.enabled || !activeBuilderStepId.value) return draft.fields;
  return fieldsOnStep(draft.fields, draft, activeBuilderStepId.value);
});

const publicUrl = computed(() => {
  const slug = draft.publicLink?.slug;
  if (!slug || !draft.publicLink?.enabled) return '';
  return buildWebformPublicUrl(slug);
});

const iframeSnippet = computed(() => {
  const slug = draft.publicLink?.slug;
  return slug ? buildWebformIframeSnippet(slug) : '';
});

const scriptSnippet = computed(() => {
  const slug = draft.publicLink?.slug;
  return slug ? buildWebformScriptSnippet(slug) : '';
});

const prefillExampleUrl = computed(() => {
  if (!publicUrl.value || !draft.fields.length) return '';
  return buildWebformPrefillExampleUrl(publicUrl.value, draft.fields);
});

function stepCircleClass(stepId) {
  const index = WEBFORM_BUILDER_STEPS.indexOf(stepId);
  const currentIndex = WEBFORM_BUILDER_STEPS.indexOf(currentStep.value);
  if (stepId === currentStep.value) {
    return WEBFORM_STEP_ACTIVE_CLASS;
  }
  if (index < currentIndex) {
    return WEBFORM_STEP_COMPLETE_CLASS;
  }
  return WEBFORM_STEP_IDLE_CLASS;
}

function isStepComplete(stepId) {
  return WEBFORM_BUILDER_STEPS.indexOf(stepId) < WEBFORM_BUILDER_STEPS.indexOf(currentStep.value);
}

function goToStep(stepId) {
  if (!WEBFORM_BUILDER_STEPS.includes(stepId)) return;
  currentStep.value = stepId;
}

async function goNextStep() {
  const index = WEBFORM_BUILDER_STEPS.indexOf(currentStep.value);
  if (index < 0 || index >= WEBFORM_BUILDER_STEPS.length - 1) return;

  const saved = await saveWebform({ quiet: true });
  currentStep.value = WEBFORM_BUILDER_STEPS[index + 1];
  if (!saved) {
    notifyError(t('webforms.builderStepAdvanceSaveWarning'));
  }
}

function applyWebform(data) {
  draft._id = data._id;
  draft.webformId = data.webformId || '';
  draft.name = data.name || '';
  draft.description = data.description || '';
  draft.status = data.status || 'Draft';
  draft.targetModuleKey = data.targetModuleKey || 'people';
  draft.targetAppKey = data.targetAppKey || 'PLATFORM';
  draft.multiStep = sanitizeMultiStepConfig(data.multiStep);
  draft.steps = sanitizeWebformSteps(data.steps, draft.multiStep.enabled);
  draft.fields = Array.isArray(data.fields)
    ? JSON.parse(JSON.stringify(data.fields)).map((field) => ({
      ...field,
      type: normalizeWebformFieldType(field.type),
      columnWidth: field.columnWidth === 'half' ? 'half' : 'full',
      stepId: sanitizeFieldStepId(field.stepId, { multiStep: draft.multiStep, steps: draft.steps }),
      visibility: sanitizeFieldVisibility(field.visibility),
      dependencies: Array.isArray(field.dependencies) ? field.dependencies : []
    }))
    : [];
  syncActiveBuilderStep();
  draft.recordAction = data.recordAction || 'create';
  draft.dedup = {
    enabled: !!data.dedup?.enabled,
    keys: Array.isArray(data.dedup?.keys) ? [...data.dedup.keys] : [],
    action: data.dedup?.action || 'update'
  };
  dedupKeysInput.value = draft.dedup.keys.join(', ');
  draft.notifyOnSubmit = {
    enabled: data.notifyOnSubmit?.enabled !== false,
    userIds: normalizeUserIds(data.notifyOnSubmit?.userIds)
  };
  draft.taskOnSubmit = {
    enabled: !!data.taskOnSubmit?.enabled,
    title: data.taskOnSubmit?.title || '',
    description: data.taskOnSubmit?.description || '',
    dueInDays: Number.isFinite(Number(data.taskOnSubmit?.dueInDays))
      ? Number(data.taskOnSubmit.dueInDays)
      : null,
    assignee: ['record_owner', 'webform_creator', 'specific_user'].includes(data.taskOnSubmit?.assignee)
      ? data.taskOnSubmit.assignee
      : 'record_owner',
    assigneeUserId: data.taskOnSubmit?.assigneeUserId ? String(data.taskOnSubmit.assigneeUserId) : ''
  };
  draft.webhook = {
    enabled: !!data.webhook?.enabled,
    url: data.webhook?.url || '',
    secret: data.webhook?.secret || ''
  };
  draft.captcha = {
    enabled: data.captcha?.enabled === true,
    siteKey: data.captcha?.siteKey || '',
    secretKey: '',
    secretConfigured: data.captcha?.secretConfigured === true
  };
  draft.thankYouMessage = data.thankYouMessage || '';
  draft.redirectUrl = data.redirectUrl || '';
  draft.headerImageUrl = data.headerImageUrl || '';
  draft.headerBackgroundColor = data.headerBackgroundColor || '';
  draft.branding = mergeWebformBranding(data.branding);
  draft.formActions = mergeFormActions(data.formActions);
  draft.publicLink = {
    enabled: !!data.publicLink?.enabled,
    slug: data.publicLink?.slug || ''
  };
  draft.totalSubmissions = Number(data.totalSubmissions) || 0;
  syncTargetAppKeyFromSelection();
  if (selectedFieldId.value && !draft.fields.some((f) => f.fieldId === selectedFieldId.value)) {
    selectedFieldId.value = '';
  }
}

function syncTargetAppKeyFromSelection() {
  const mod = targetModules.value.find((row) => row.moduleKey === draft.targetModuleKey);
  if (mod?.appKey) draft.targetAppKey = mod.appKey;
}

async function loadTargetModules() {
  const res = await apiClient.get('/settings/webforms/modules');
  targetModules.value = res?.success && Array.isArray(res.data) ? res.data : [];
  syncTargetAppKeyFromSelection();
}

async function loadModuleFields(moduleKey = draft.targetModuleKey) {
  moduleFieldsLoading.value = true;
  try {
    const { fields } = await fetchWebformModuleDefinition(moduleKey);
    moduleFields.value = fields.filter((field) => {
      const key = String(field.key || '').toLowerCase();
      return key && !RESERVED_CRM_KEYS.has(key);
    });
    syncWebformFieldsFromModule();
  } catch {
    moduleFields.value = [];
  } finally {
    moduleFieldsLoading.value = false;
    scheduleFillPreviewRefresh();
  }
}

function findModuleFieldByKey(key) {
  const normalized = String(key || '').toLowerCase();
  return moduleFields.value.find((field) => String(field.key || '').toLowerCase() === normalized) || null;
}

function syncWebformFieldsFromModule() {
  for (const field of draft.fields) {
    if (!field.crmFieldKey) continue;
    const moduleField = findModuleFieldByKey(field.crmFieldKey);
    if (moduleField) applyModuleFieldToWebformField(field, moduleField);
  }
}

async function loadWebform() {
  const generation = ++draftSyncGeneration;
  loading.value = true;
  try {
    const res = await apiClient.get(`/webforms/${props.webformId}`);
    if (generation !== draftSyncGeneration) return;
    if (res?.success && res.data) {
      applyWebform(res.data);
      await loadModuleFields();
    } else {
      notifyError(res?.message || t('webforms.builderLoadFailed'));
    }
  } catch (error) {
    if (generation !== draftSyncGeneration) return;
    notifyError(error?.message || t('webforms.builderLoadFailed'));
  } finally {
    if (generation === draftSyncGeneration) {
      loading.value = false;
    }
  }
}

function parseDedupKeysInput(value) {
  return String(value || '').split(',').map((key) => key.trim()).filter(Boolean);
}

function normalizeUserIds(userIds) {
  if (!Array.isArray(userIds)) return [];
  return userIds
    .map((id) => {
      if (id && typeof id === 'object' && id._id) return String(id._id);
      return String(id || '').trim();
    })
    .filter(Boolean);
}

function buildPayload() {
  const mod = targetModules.value.find((row) => row.moduleKey === draft.targetModuleKey);
  draft.dedup.keys = parseDedupKeysInput(dedupKeysInput.value);
  const publicLink = {
    enabled: !!draft.publicLink?.enabled,
    ...(draft.publicLink?.enabled && draft.publicLink?.slug
      ? { slug: String(draft.publicLink.slug).trim().toLowerCase() }
      : {})
  };
  return JSON.parse(JSON.stringify({
    name: draft.name,
    description: draft.description,
    status: draft.status,
    targetModuleKey: draft.targetModuleKey,
    targetAppKey: mod?.appKey || draft.targetAppKey,
    fields: buildWebformFillFieldsFromDraft(draft),
    recordAction: draft.recordAction,
    dedup: { ...draft.dedup, keys: [...draft.dedup.keys] },
    notifyOnSubmit: {
      enabled: draft.notifyOnSubmit.enabled !== false,
      userIds: normalizeUserIds(draft.notifyOnSubmit.userIds)
    },
    taskOnSubmit: {
      enabled: draft.taskOnSubmit.enabled === true,
      title: String(draft.taskOnSubmit.title || '').trim(),
      description: String(draft.taskOnSubmit.description || '').trim(),
      dueInDays: Number.isFinite(Number(draft.taskOnSubmit.dueInDays))
        ? Math.max(0, Number(draft.taskOnSubmit.dueInDays))
        : null,
      assignee: draft.taskOnSubmit.assignee || 'record_owner',
      assigneeUserId:
        draft.taskOnSubmit.assignee === 'specific_user' && draft.taskOnSubmit.assigneeUserId
          ? String(draft.taskOnSubmit.assigneeUserId).trim()
          : null
    },
    webhook: { ...draft.webhook },
    captcha: {
      enabled: draft.captcha.enabled === true,
      siteKey: String(draft.captcha.siteKey || '').trim(),
      ...(String(draft.captcha.secretKey || '').trim()
        ? { secretKey: String(draft.captcha.secretKey).trim() }
        : {})
    },
    headerImageUrl: String(draft.headerImageUrl || '').trim(),
    headerBackgroundColor: String(draft.headerBackgroundColor || '').trim(),
    branding: mergeWebformBranding(draft.branding),
    multiStep: sanitizeMultiStepConfig(draft.multiStep),
    steps: sanitizeWebformSteps(draft.steps, draft.multiStep.enabled),
    thankYouMessage: draft.thankYouMessage,
    redirectUrl: draft.redirectUrl,
    formActions: mergeFormActions(draft.formActions),
    publicLink
  }));
}

async function saveWebform(options = {}) {
  const quiet = options?.quiet === true;
  if (!props.webformId) {
    notifyError(t('webforms.builderSaveFailed'));
    return false;
  }
  if (!canEdit.value) {
    notifyError(t('webforms.builderSaveForbidden'));
    return false;
  }

  const generation = ++draftSyncGeneration;
  saving.value = true;
  try {
    const res = await apiClient.put(`/webforms/${props.webformId}`, buildPayload());
    if (generation !== draftSyncGeneration) return false;
    if (res?.success && res.data) {
      applyWebform(res.data);
      if (!quiet) notifySuccess(t('webforms.builderSaveSuccess'));
      return true;
    }
    notifyError(res?.message || t('webforms.builderSaveFailed'));
    return false;
  } catch (error) {
    if (generation !== draftSyncGeneration) return false;
    notifyError(error?.message || t('webforms.builderSaveFailed'));
    return false;
  } finally {
    saving.value = false;
  }
}

async function enablePublicLink() {
  publishing.value = true;
  try {
    const saved = await saveWebform();
    if (!saved) return;
    const res = await apiClient.post(`/webforms/${props.webformId}/enable-public`);
    if (res?.success && res.data) {
      applyWebform(res.data);
      captureWebformPublished({
        _id: res.data._id,
        webformId: res.data.webformId,
        slug: res.data.publicLink?.slug
      });
      notifySuccess(t('webforms.builderPublishSuccess'));
    } else {
      notifyError(res?.message || t('webforms.builderPublishFailed'));
    }
  } catch (error) {
    notifyError(error?.message || t('webforms.builderPublishFailed'));
  } finally {
    publishing.value = false;
  }
}

async function saveAndPublish() {
  draft.status = 'Active';
  await enablePublicLink();
}

function createFieldFromModuleKey(moduleFieldKey) {
  const moduleField = findModuleFieldByKey(moduleFieldKey);
  if (!moduleField) return null;
  if (usedCrmFieldKeys.value.has(String(moduleFieldKey).toLowerCase())) return null;

  const field = createWebformFieldFromModuleField(moduleField, {
    order: draft.fields.length,
    stepId: activeBuilderStepId.value || orderedBuilderSteps.value[0]?.stepId || ''
  });
  return field;
}

function addFieldFromModuleKey(moduleFieldKey) {
  const field = createFieldFromModuleKey(moduleFieldKey);
  if (!field) return;
  draft.fields.push(field);
  onSelectField(field.fieldId);
}

function syncActiveBuilderStep() {
  const steps = orderedBuilderSteps.value;
  if (!steps.length) {
    activeBuilderStepId.value = '';
    return;
  }
  if (!steps.some((step) => step.stepId === activeBuilderStepId.value)) {
    activeBuilderStepId.value = steps[0].stepId;
  }
}

function onMultiStepToggle() {
  if (draft.multiStep.enabled) {
    if (!draft.steps.length) {
      draft.steps = ensureDefaultSteps();
    }
    const defaultStepId = draft.steps[0]?.stepId || '';
    for (const field of draft.fields) {
      if (!field.stepId) field.stepId = defaultStepId;
    }
    syncActiveBuilderStep();
    return;
  }
  activeBuilderStepId.value = '';
  if (['next', 'back'].includes(selectedButtonKey.value)) {
    selectedButtonKey.value = '';
  }
}

function addBuilderStep() {
  const order = draft.steps.length;
  const stepId = nextWebformStepId(draft.steps);
  draft.steps.push({
    stepId,
    title: `Step ${order + 1}`,
    description: '',
    order
  });
  syncActiveBuilderStep();
}

function removeBuilderStep(stepId) {
  if (draft.steps.length <= 2) return;
  const fallbackStepId = draft.steps.find((step) => step.stepId !== stepId)?.stepId || '';
  draft.steps = draft.steps.filter((step) => step.stepId !== stepId)
    .map((step, index) => ({ ...step, order: index }));
  for (const field of draft.fields) {
    if (field.stepId === stepId) field.stepId = fallbackStepId;
  }
  syncActiveBuilderStep();
}

function moveBuilderStep(index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= draft.steps.length) return;
  const steps = [...orderedBuilderSteps.value];
  const [moved] = steps.splice(index, 1);
  steps.splice(nextIndex, 0, moved);
  draft.steps = steps.map((step, order) => ({ ...step, order }));
}

function addVisibilityCondition() {
  if (!selectedField.value) return;
  const visibility = selectedFieldVisibility.value;
  visibility.conditions.push({
    fieldId: visibilitySourceFields.value[0]?.fieldId || '',
    operator: 'equals',
    value: ''
  });
}

function removeVisibilityCondition(index) {
  if (!selectedField.value) return;
  selectedFieldVisibility.value.conditions.splice(index, 1);
}

function visibilitySourceField(condition) {
  return draft.fields.find((field) => field.fieldId === condition.fieldId) || null;
}

function operatorsForVisibilityCondition(condition) {
  const source = visibilitySourceField(condition);
  return operatorsForSourceFieldType(source?.type || 'Text');
}

function visibilityConditionNeedsValue(condition) {
  return conditionOperatorNeedsValue(condition.operator);
}

function visibilityConditionValueOptions(condition) {
  const source = visibilitySourceField(condition);
  if (!source || !fieldTypeNeedsOptions(source.type)) return [];
  return Array.isArray(source.options) ? source.options : [];
}

function onVisibilitySourceChange(condition) {
  const operators = operatorsForVisibilityCondition(condition);
  if (!operators.includes(condition.operator)) {
    condition.operator = operators[0] || 'equals';
  }
  condition.value = '';
}

function onMobileAddField(event) {
  const key = event.target.value;
  if (!key) return;
  addFieldFromModuleKey(key);
  event.target.value = '';
}

function onFieldsUpdate(nextFields) {
  if (!draft.multiStep.enabled || !activeBuilderStepId.value) {
    draft.fields = nextFields;
    return;
  }

  const stepId = activeBuilderStepId.value;
  const otherFields = draft.fields.filter((field) => sanitizeFieldStepId(field.stepId, draft) !== stepId);
  const reorderedStepFields = nextFields.map((field, index) => ({
    ...field,
    stepId,
    order: index
  }));
  draft.fields = [...otherFields, ...reorderedStepFields].map((field, index) => ({
    ...field,
    order: index
  }));
}

function removeField(fieldId) {
  const index = draft.fields.findIndex((field) => field.fieldId === fieldId);
  if (index < 0) return;
  const removed = draft.fields[index];
  if (removed?.crmFieldKey) {
    const moduleField = findModuleFieldByKey(removed.crmFieldKey);
    if (isBaseMandatoryModuleField(draft.targetModuleKey, moduleField, moduleFields.value)) {
      notifyError(t('webforms.builderCannotRemoveMandatory'));
      return;
    }
  }
  draft.fields.splice(index, 1);
  if (removed?.fieldId === selectedFieldId.value) selectedFieldId.value = '';
}

function crmPicklistBound(field) {
  if (!field?.crmFieldKey) return false;
  const moduleField = findModuleFieldByKey(field.crmFieldKey);
  return isCrmPicklistField(moduleField) && Array.isArray(field.options) && field.options.length > 0;
}

function updateFieldOptions(field, raw) {
  field.options = String(raw || '').split(',').map((part) => part.trim()).filter(Boolean);
}

function resolveHeaderImageUrl(url) {
  return resolveWebformImageUrl(url);
}

async function onHeaderImageSelected(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file || !canEdit.value) return;

  headerImageUploading.value = true;
  try {
    draft.headerImageUrl = await uploadWebformHeaderImage(file);
  } catch (error) {
    notifyError(error?.message || t('webforms.builderHeaderImageUploadFailed'));
  } finally {
    headerImageUploading.value = false;
  }
}

async function onLogoSelected(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file || !canEdit.value) return;

  logoUploading.value = true;
  try {
    draft.branding.logoUrl = await uploadWebformHeaderImage(file);
  } catch (error) {
    notifyError(error?.message || t('webforms.builderBrandingLogoUploadFailed'));
  } finally {
    logoUploading.value = false;
  }
}

function goBack() {
  router.replace({ path: '/settings', query: { tab: 'webforms' } });
}

function openSubmissions() {
  router.replace({
    path: '/settings',
    query: { tab: 'webforms', webformId: props.webformId, view: 'submissions' }
  });
}

function buildHostedPreviewUrl() {
  const slug = draft.publicLink?.slug;
  if (!slug) return '';
  return buildWebformPublicUrl(slug);
}

async function waitForSaveBeforePreview(timeoutMs = 8000) {
  try {
    await Promise.race([
      saveWebform(),
      new Promise((resolve) => {
        window.setTimeout(resolve, timeoutMs);
      })
    ]);
  } catch {
    // Preview should still open if save fails.
  }
}

async function openHostedUrl(event) {
  const previewUrl = buildHostedPreviewUrl();
  if (!previewUrl) {
    event?.preventDefault();
    return;
  }
  if (canEdit.value) {
    event?.preventDefault();
    await waitForSaveBeforePreview();
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  }
}

async function previewPublic() {
  const previewUrl = buildHostedPreviewUrl();
  if (!previewUrl) return;
  await waitForSaveBeforePreview();
  window.open(previewUrl, '_blank', 'noopener,noreferrer');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

onMounted(async () => {
  await loadTargetModules();
  await loadWebform();
});

watch(
  () => [draft.formActions.reset.enabled, draft.formActions.cancel.enabled],
  () => {
    if (selectedButtonKey.value === 'reset' && !draft.formActions.reset.enabled) {
      selectedButtonKey.value = '';
    }
    if (selectedButtonKey.value === 'cancel' && !draft.formActions.cancel.enabled) {
      selectedButtonKey.value = '';
    }
  }
);

watch(
  () => ({
    targetModuleKey: draft.targetModuleKey,
    targetAppKey: draft.targetAppKey,
    status: draft.status,
    fields: draft.fields,
    multiStep: draft.multiStep,
    steps: draft.steps,
    branding: draft.branding,
    formActions: draft.formActions,
    thankYouMessage: draft.thankYouMessage,
    headerImageUrl: draft.headerImageUrl,
    headerBackgroundColor: draft.headerBackgroundColor,
    name: draft.name,
    description: draft.description,
    captchaEnabled: draft.captcha?.enabled
  }),
  () => scheduleFillPreviewRefresh(),
  { deep: true }
);

watch(() => props.webformId, (id, prev) => {
  if (id && id !== prev) loadWebform();
});
</script>
