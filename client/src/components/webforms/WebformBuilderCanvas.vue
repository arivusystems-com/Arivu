<template>
  <div :class="['flex h-full min-h-0 flex-1 flex-col', WEBFORM_BUILDER_CANVAS_BG]">
    <div class="border-b border-gray-200 bg-white px-4 py-2.5 dark:border-gray-700 dark:bg-gray-900">
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('webforms.builderCanvasTitle') }}
        </p>
        <div class="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-600 dark:bg-gray-800">
          <button
            v-for="device in devices"
            :key="device.id"
            type="button"
            class="rounded-md px-2.5 py-1 text-xs font-medium transition"
            :class="previewDevice === device.id
              ? WEBFORM_DEVICE_TAB_ACTIVE_CLASS
              : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'"
            @click="$emit('update:previewDevice', device.id)"
          >
            <component :is="device.icon" class="h-4 w-4" />
          </button>
        </div>
      </div>
      <div v-if="orderedSteps.length > 1" class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="(step, index) in orderedSteps"
          :key="step.stepId"
          type="button"
          class="rounded-full px-3 py-1 text-xs font-medium transition"
          :class="activeStepId === step.stepId
            ? WEBFORM_STEP_ACTIVE_CLASS
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'"
          @click="$emit('update:activeStepId', step.stepId)"
        >
          {{ step.title || t('webforms.multiStepUntitled', { number: index + 1 }) }}
        </button>
      </div>
    </div>

    <div class="flex flex-1 items-start justify-center overflow-y-auto p-5 sm:p-8">
      <div class="w-full transition-all duration-200" :class="deviceWidthClass">
        <div
          :class="[WEBFORM_CARD_CLASS, webformBrandingFontClasses(), 'overflow-visible']"
          :style="brandingStyle"
        >
          <WebformHeaderSection
            :webform="webform"
            :title="webform.name || t('webforms.defaultName')"
            :description="webform.description"
          />

          <div
            :class="[
              'rounded-b-xl px-6 pb-6 sm:px-8 sm:pb-8',
              webformBodySurfaceClasses(branding)
            ]"
          >
            <draggable
              :model-value="fields"
              item-key="fieldId"
              handle=".field-drag-handle"
              group="webform-fields"
              :class="gridClass"
              :animation="180"
              ghost-class="opacity-40"
              @update:model-value="onFieldsReorder"
              @add="onFieldAdded"
            >
              <template #header>
                <div
                  v-if="!fields.length"
                  class="col-span-2 rounded-xl border-2 border-dashed border-gray-200 px-4 py-12 text-center dark:border-gray-600"
                >
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('webforms.builderCanvasEmpty') }}</p>
                  <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">{{ t('webforms.builderCanvasDropHint') }}</p>
                </div>
              </template>

              <template #item="{ element: field }">
                <div
                  :class="[
                    fieldSpanClass(field),
                    'group relative rounded-lg border-2 px-3 py-3 transition',
                    selectedFieldId === field.fieldId
                      ? WEBFORM_FIELD_SELECTED_CLASS
                      : 'border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:border-gray-600 dark:hover:bg-gray-900/30'
                  ]"
                  @click="$emit('select-field', field.fieldId)"
                >
                  <div class="mb-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      class="field-drag-handle cursor-grab rounded p-0.5 text-gray-400 hover:text-gray-600 active:cursor-grabbing dark:hover:text-gray-300"
                      @click.stop
                    >
                      <Bars3Icon class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      class="rounded p-0.5 text-gray-400 opacity-0 transition hover:text-red-600 group-hover:opacity-100 dark:hover:text-red-400"
                      :class="{ 'opacity-100': selectedFieldId === field.fieldId }"
                      @click.stop="$emit('remove-field', field.fieldId)"
                    >
                      <TrashIcon class="h-4 w-4" />
                    </button>
                  </div>

                  <div class="pointer-events-none">
                    <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {{ field.label || t('webforms.builderNewFieldLabel') }}
                      <span v-if="field.required" class="text-red-500">*</span>
                    </label>
                    <div
                      class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-400 dark:border-gray-600 dark:bg-gray-900/60"
                    >
                      {{ fieldPlaceholder(field) }}
                    </div>
                  </div>
                </div>
              </template>
            </draggable>

            <div v-if="fields.length" class="mt-4 overflow-visible">
              <WebformFormActionsBar
              v-if="fields.length"
              :form-actions="webform.formActions"
              :theme-color="branding.themeColor"
              :step-mode="canvasStepMode"
              :show-back="canvasStepMode && canvasStepIndex > 0"
              :show-next="canvasStepMode && !canvasIsLastStep"
              :show-submit="!canvasStepMode || canvasIsLastStep"
              selectable
              :selected-button-key="selectedButtonKey"
              static-preview
              preview
              @select-button="$emit('select-button', $event)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import draggable from 'vuedraggable';
import { mergeWebformBranding, webformBrandingCssVars, webformBrandingFontClasses, webformBodySurfaceClasses } from '@/utils/webformBranding';
import {
  WEBFORM_BUILDER_CANVAS_BG,
  WEBFORM_CARD_CLASS,
  WEBFORM_DEVICE_TAB_ACTIVE_CLASS,
  WEBFORM_FIELD_SELECTED_CLASS,
  WEBFORM_STEP_ACTIVE_CLASS
} from '@/utils/webformUiClasses';
import WebformHeaderSection from '@/components/webforms/WebformHeaderSection.vue';
import { isMultiStepFormActive } from '@/utils/webformMultiStep';
import WebformFormActionsBar from '@/components/webforms/WebformFormActionsBar.vue';
import {
  isCheckboxFieldType,
  isFileFieldType,
  isPicklistFieldType,
  isSingleSelectFieldType,
  normalizeWebformFieldType
} from '@/utils/webformFieldTypeUtils';
import {
  Bars3Icon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  TrashIcon
} from '@heroicons/vue/24/outline';

const props = defineProps({
  webform: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  selectedFieldId: { type: String, default: '' },
  selectedButtonKey: { type: String, default: '' },
  previewDevice: { type: String, default: 'desktop' },
  activeStepId: { type: String, default: '' },
  orderedSteps: { type: Array, default: () => [] }
});

const emit = defineEmits([
  'update:fields',
  'select-field',
  'select-button',
  'remove-field',
  'update:previewDevice',
  'update:activeStepId',
  'field-added'
]);

const { t } = useI18n();

const branding = computed(() => mergeWebformBranding(props.webform?.branding));
const brandingStyle = computed(() => webformBrandingCssVars(branding.value));

const canvasStepMode = computed(() => isMultiStepFormActive(props.webform));
const canvasStepIndex = computed(() => {
  if (!canvasStepMode.value) return 0;
  const index = props.orderedSteps.findIndex((step) => step.stepId === props.activeStepId);
  return index >= 0 ? index : 0;
});
const canvasIsLastStep = computed(() =>
  !canvasStepMode.value || canvasStepIndex.value >= props.orderedSteps.length - 1
);

const devices = [
  { id: 'desktop', icon: ComputerDesktopIcon },
  { id: 'tablet', icon: DeviceTabletIcon },
  { id: 'mobile', icon: DevicePhoneMobileIcon }
];

const deviceWidthClass = computed(() => {
  if (props.previewDevice === 'mobile') return 'max-w-sm';
  if (props.previewDevice === 'tablet') return 'max-w-xl';
  return 'max-w-3xl';
});

const isSingleColumn = computed(() => props.previewDevice === 'mobile');

const gridClass = computed(() =>
  isSingleColumn.value ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-2 gap-x-4 gap-y-3'
);

function fieldSpanClass(field) {
  if (isSingleColumn.value) return 'col-span-1';
  return field?.columnWidth === 'half' ? 'col-span-1' : 'col-span-2';
}

function onFieldsReorder(next) {
  emit(
    'update:fields',
    next.map((field, index) => ({ ...field, order: index }))
  );
}

function onFieldAdded(event) {
  const field = props.fields[event.newIndex];
  if (field?.fieldId) {
    emit('field-added', field.fieldId);
    emit('select-field', field.fieldId);
  }
}

function fieldPlaceholder(field) {
  if (field.placeholder) return field.placeholder;
  const type = normalizeWebformFieldType(field.type);
  if (isFileFieldType(type)) return t('webforms.builderFileFieldPlaceholder');
  if (isSingleSelectFieldType(type) || isPicklistFieldType(type)) return t('webforms.publicSelectOption');
  if (isCheckboxFieldType(type)) return field.label;
  return type;
}
</script>
