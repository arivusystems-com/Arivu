<template>
  <div class="space-y-4">
    <div
      v-for="opt in sortedOptions"
      :key="opt.optionName"
      class="rounded-xl border border-gray-200 bg-gray-50/60 p-3 dark:border-gray-600 dark:bg-gray-900/40"
      :class="cardClass"
    >
      <p class="text-xs font-medium text-gray-700 dark:text-gray-200">
        {{ opt.optionName }}
        <span v-if="opt.required" class="text-red-500">*</span>
      </p>

      <div v-if="opt.optionType === 'checkbox'" class="mt-2">
        <label class="inline-flex cursor-pointer items-center gap-2.5 text-sm text-gray-700 dark:text-gray-200">
          <HeadlessCheckbox
            :model-value="Boolean(selections[opt.optionName])"
            size="sm"
            @update:model-value="(checked) => onCheckboxChange(opt.optionName, checked)"
          />
          {{ t('platform.productConfigRuntimeCheckbox') }}
        </label>
      </div>

      <div v-else-if="opt.optionType === 'single_select'" class="mt-2 space-y-1">
        <label
          v-for="value in optionValues(opt)"
          :key="value"
          class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white dark:hover:bg-gray-800"
          :class="selections[opt.optionName] === value ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''"
        >
          <input
            :checked="selections[opt.optionName] === value"
            type="radio"
            :value="value"
            class="border-gray-300 text-indigo-600"
            @change="onSingleSelectChange(opt.optionName, value)"
          />
          {{ value }}
        </label>
      </div>

      <div v-else-if="opt.optionType === 'multi_select'" class="mt-2 space-y-1">
        <label
          v-for="value in optionValues(opt)"
          :key="value"
          class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-white dark:hover:bg-gray-800"
        >
          <HeadlessCheckbox
            :model-value="Array.isArray(selections[opt.optionName]) && selections[opt.optionName].includes(value)"
            size="sm"
            @update:model-value="(checked) => onMultiCheckboxChange(opt.optionName, value, checked)"
          />
          {{ value }}
        </label>
      </div>

      <HeadlessSelect
        v-else
        :model-value="selections[opt.optionName] || ''"
        :options="dropdownOptions(opt)"
        allow-empty
        empty-value=""
        :empty-label="t('platform.productConfigRuntimeSelect')"
        :placeholder="t('platform.productConfigRuntimeSelect')"
        wrapper-class="mt-2 w-full"
        :button-class="controlClass"
        :options-class="selectOptionsClass"
        teleport
        @update:model-value="(value) => onDropdownChange(opt.optionName, value)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import {
  optionValues,
  sortProductConfigOptions,
} from '@/composables/useProductConfigSelections';

const props = defineProps({
  options: { type: Array, default: () => [] },
  selections: { type: Object, required: true },
  cardClass: { type: String, default: '' },
  controlClass: {
    type: String,
    default:
      'block w-full min-h-[2.625rem] rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-5 text-gray-900 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white',
  },
  selectOptionsClass: { type: String, default: 'z-[10060]' },
});

const emit = defineEmits(['change', 'update:selection']);

const { t } = useI18n();

const sortedOptions = computed(() => sortProductConfigOptions(props.options));

function dropdownOptions(opt) {
  return optionValues(opt).map((value) => ({ value, label: value }));
}

function emitSelection(optionName, value) {
  emit('update:selection', optionName, value);
  emit('change');
}

function onCheckboxChange(optionName, checked) {
  emitSelection(optionName, Boolean(checked));
}

function onMultiCheckboxChange(optionName, value, checked) {
  let arr = Array.isArray(props.selections[optionName]) ? [...props.selections[optionName]] : [];
  if (checked) {
    if (!arr.includes(value)) arr.push(value);
  } else {
    arr = arr.filter((entry) => entry !== value);
  }
  emitSelection(optionName, arr);
}

function onSingleSelectChange(optionName, value) {
  emitSelection(optionName, value);
}

function onDropdownChange(optionName, value) {
  emitSelection(optionName, value || '');
}
</script>
