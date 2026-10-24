<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3 sm:p-6"
      @click.self="cancel"
      @keydown.esc="cancel"
    >
      <div
        class="flex max-h-[min(92vh,860px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
        role="dialog"
        aria-modal="true"
        :aria-label="t('records.productConfigGuidedTitle')"
      >
        <div class="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div class="min-w-0">
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ t('records.productConfigGuidedTitle') }}
            </h3>
            <p class="mt-0.5 truncate text-xs text-gray-500">
              {{ productLabel }}
              <span v-if="activeConfig"> · {{ activeConfig.name }}</span>
            </p>
          </div>
          <span
            class="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold"
            :class="badgeClass"
          >
            {{ badgeLabel }}
          </span>
        </div>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div v-if="loadingConfigs" class="flex justify-center py-10">
            <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
          </div>

          <template v-else>
            <div v-if="configs.length > 1" class="space-y-1.5">
              <p class="text-xs font-medium text-gray-600 dark:text-gray-300">
                {{ t('records.productConfigGuidedPickConfig') }}
              </p>
              <HeadlessSelect
                :model-value="selectedConfigId"
                :options="configSelectOptions"
                teleport
                @update:model-value="onConfigSelect"
              />
            </div>

            <p v-if="!activeConfig" class="text-sm text-gray-500">
              {{ t('records.productConfigGuidedNone') }}
            </p>

            <template v-else>
              <p class="text-xs text-gray-500">{{ t('records.productConfigGuidedHint') }}</p>

              <ProductConfigOptionPicker
                :options="sortedOptions"
                :selections="selections"
                @update:selection="onSelectionChange"
                @change="scheduleValidate"
              />

              <ProductConfigValidationPanel :result="result" />
            </template>
          </template>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="skip"
          >
            {{ t('records.productConfigGuidedSkip') }}
          </button>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              @click="cancel"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              :disabled="!canConfirm || confirming"
              @click="confirm"
            >
              {{ confirming ? t('states.saving') : t('records.productConfigGuidedConfirm') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import ProductConfigOptionPicker from '@/components/catalog/ProductConfigOptionPicker.vue';
import ProductConfigValidationPanel from '@/components/catalog/ProductConfigValidationPanel.vue';
import {
  resetSelectionsForOptions,
  sortProductConfigOptions,
  useProductConfigValidationBadge,
  useProductConfigValidator,
} from '@/composables/useProductConfigSelections';

const props = defineProps({
  open: { type: Boolean, default: false },
  hit: { type: Object, default: null },
  /** Preloaded active configs for the item group */
  configs: { type: Array, default: () => [] },
  loadingConfigs: { type: Boolean, default: false }
});

const emit = defineEmits(['confirm', 'skip', 'cancel']);

const { t } = useI18n();

const selectedConfigId = ref('');
const selections = reactive({});
const confirming = ref(false);

const productLabel = computed(() => {
  const hit = props.hit || {};
  return hit.item_name || hit.variant_code || hit.name || '—';
});

const configSelectOptions = computed(() =>
  (props.configs || []).map((c) => ({
    value: String(c._id),
    label: `${c.name} (v${c.version || 1})`
  }))
);

const activeConfig = computed(() => {
  if (!props.configs?.length) return null;
  if (selectedConfigId.value) {
    return props.configs.find((c) => String(c._id) === String(selectedConfigId.value)) || props.configs[0];
  }
  return props.configs[0];
});

const sortedOptions = computed(() => sortProductConfigOptions(activeConfig.value?.options || []));

const hasOptions = computed(() => sortedOptions.value.length > 0);

const { result, scheduleValidate, validate, clearValidationTimer } = useProductConfigValidator({ selections });

const { badgeClass, badgeLabel } = useProductConfigValidationBadge(result, hasOptions);

const canConfirm = computed(() => Boolean(activeConfig.value && result.value?.valid));

function onSelectionChange(optionName, value) {
  selections[optionName] = value;
}

function onConfigSelect(value) {
  selectedConfigId.value = value ? String(value) : '';
  onConfigChange();
}

function resetSelections() {
  resetSelectionsForOptions(selections, sortedOptions.value);
  result.value = null;
}

function onConfigChange() {
  resetSelections();
  scheduleValidate(buildValidateRequest);
}

function buildValidateRequest() {
  if (!activeConfig.value) return null;
  return {
    configurationId: activeConfig.value._id,
    selections: { ...selections },
    requireActive: true,
  };
}

function confirm() {
  if (!canConfirm.value || !activeConfig.value) return;
  confirming.value = true;
  emit('confirm', {
    productConfigurationId: String(activeConfig.value._id),
    configurationSelections: { ...(result.value?.selections || selections) },
    configuration: activeConfig.value
  });
  confirming.value = false;
}

function skip() {
  emit('skip');
}

function cancel() {
  emit('cancel');
}

watch(
  () => [props.open, props.configs],
  () => {
    if (!props.open) {
      clearValidationTimer();
      return;
    }
    selectedConfigId.value = props.configs?.[0] ? String(props.configs[0]._id) : '';
    resetSelections();
    if (activeConfig.value) scheduleValidate(buildValidateRequest);
  },
  { immediate: true, deep: true }
);
</script>
