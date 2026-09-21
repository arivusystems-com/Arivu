<template>
  <div
    :class="[
      'p-6',
      isDirty ? SETTINGS_SAVE_BAR_CONTENT_CLASS : '',
    ]"
  >
    <div class="mb-6">
      <h3 v-if="!embedded" class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {{ t('duplicates.configTitle') }}
      </h3>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ introText }}
      </p>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>

    <div v-else class="space-y-6 max-w-3xl">
      <div
        v-if="error"
        class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-800 dark:text-red-300"
      >
        {{ error }}
      </div>

      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('duplicates.enableLabel') }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('duplicates.enableHint') }}</p>
        </div>
        <HeadlessSwitch v-model="form.enabled" />
      </div>

      <fieldset :disabled="!form.enabled" class="space-y-4 disabled:opacity-60">
        <div>
          <p class="text-sm font-medium text-gray-900 dark:text-white mb-2">{{ t('duplicates.matchCriteria') }}</p>
          <RadioGroup
            v-model="form.matchLogic"
            :disabled="!form.enabled"
            class="space-y-2"
          >
            <RadioGroupOption
              v-for="opt in matchLogicOptions"
              :key="opt.value"
              v-slot="{ checked, disabled }"
              :value="opt.value"
              as="template"
            >
              <label
                class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                :class="disabled ? 'cursor-not-allowed' : 'cursor-pointer'"
              >
                <span
                  class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                  :class="checked
                    ? 'border-indigo-600 bg-indigo-600'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'"
                >
                  <span v-if="checked" class="h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                {{ opt.label }}
              </label>
            </RadioGroupOption>
          </RadioGroup>
        </div>

        <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-50 dark:bg-white/5">
              <tr>
                <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">{{ t('duplicates.fieldCol') }}</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">{{ t('duplicates.matchTypeCol') }}</th>
                <th class="px-3 py-2 w-20" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(cond, idx) in form.conditions"
                :key="`${cond.field}-${idx}`"
                class="border-t border-gray-200 dark:border-gray-700"
              >
                <td class="px-3 py-2">
                  <HeadlessSelect
                    :id="`dup-field-${idx}`"
                    v-model="cond.field"
                    :options="fieldSelectOptionsForRow(idx)"
                    :disabled="!form.enabled"
                    teleport
                    :teleport-match-width="true"
                    wrapper-class="w-full"
                    button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                  />
                </td>
                <td class="px-3 py-2">
                  <HeadlessSelect
                    :id="`dup-match-${idx}`"
                    v-model="cond.matchType"
                    :options="matchTypeOptions"
                    :disabled="!form.enabled"
                    teleport
                    :teleport-match-width="true"
                    wrapper-class="w-full"
                    button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                  />
                </td>
                <td class="px-3 py-2 text-right">
                  <button
                    type="button"
                    class="text-xs text-red-600 hover:underline disabled:opacity-40"
                    :disabled="!form.enabled || form.conditions.length <= 1"
                    @click="removeCondition(idx)"
                  >
                    {{ t('actions.remove') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('duplicates.maxFieldsHint') }}</p>

        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!form.enabled || !canAddCondition"
          @click="addCondition"
        >
          {{ t('duplicates.addCondition') }}
        </button>

        <div class="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('duplicates.additionalOptions') }}</p>
          <div class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <label class="inline-flex items-center gap-2 cursor-pointer">
              <HeadlessCheckbox v-model="form.ignoreBlankValues" :disabled="!form.enabled" />
              {{ t('duplicates.ignoreBlank') }}
            </label>
            <div class="group relative inline-flex" tabindex="0">
              <InformationCircleIcon
                class="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help"
                aria-hidden="true"
              />
              <span class="sr-only">{{ t('duplicates.ignoreBlankHint') }}</span>
              <div
                role="tooltip"
                class="absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-lg bg-gray-900 dark:bg-gray-800 p-2 text-xs text-white opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              >
                {{ t('duplicates.ignoreBlankHint') }}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <label class="inline-flex items-center gap-2 cursor-pointer">
              <HeadlessCheckbox v-model="form.checkInactiveRecords" :disabled="!form.enabled" />
              {{ t('duplicates.checkInactive') }}
            </label>
            <div class="group relative inline-flex" tabindex="0">
              <InformationCircleIcon
                class="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help"
                aria-hidden="true"
              />
              <span class="sr-only">{{ t('duplicates.checkInactiveHint') }}</span>
              <div
                role="tooltip"
                class="absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-lg bg-gray-900 dark:bg-gray-800 p-2 text-xs text-white opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              >
                {{ t('duplicates.checkInactiveHint') }}
              </div>
            </div>
          </div>
          <div v-if="moduleKey === 'people'" class="pt-1 max-w-md">
            <label for="dup-api-policy" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {{ t('duplicates.apiPolicyLabel') }}
            </label>
            <HeadlessSelect
              id="dup-api-policy"
              v-model="form.apiMatchPolicy"
              :options="apiPolicyOptions"
              :disabled="!form.enabled"
              teleport
              :teleport-match-width="true"
              wrapper-class="w-full"
              button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
            />
          </div>
        </div>
      </fieldset>
    </div>

    <SettingsSaveBar
      :visible="isDirty"
      :saving="saving"
      :error="error"
      :reset-disabled="loading || !isDirty"
      :save-disabled="loading || !isDirty"
      @reset="resetLocal"
      @save="save"
    />
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RadioGroup, RadioGroupOption } from '@headlessui/vue';
import { InformationCircleIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import HeadlessSwitch from '@/components/ui/HeadlessSwitch.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import { SETTINGS_SAVE_BAR_CONTENT_CLASS } from '@/components/settings/settingsSaveBar';

const props = defineProps({
  moduleKey: { type: String, required: true },
  embedded: { type: Boolean, default: false },
});

const { t } = useI18n();
const { success, error: notifyError } = useNotifications();

const loading = ref(true);
const saving = ref(false);
const error = ref('');
const fieldOptions = ref([]);
const maxConditions = ref(3);
const snapshotJson = ref('');

const form = reactive({
  enabled: true,
  matchLogic: 'OR',
  conditions: [],
  ignoreBlankValues: true,
  checkInactiveRecords: true,
  apiMatchPolicy: 'warn',
});

const introText = computed(() => {
  const key = props.moduleKey;
  if (key === 'people') return t('duplicates.introPeople');
  if (key === 'organizations') return t('duplicates.introOrganizations');
  if (key === 'items') return t('duplicates.introItems');
  if (key === 'deals') return t('duplicates.introDeals');
  if (key === 'tasks') return t('duplicates.introTasks');
  if (key === 'cases') return t('duplicates.introCases');
  return t('duplicates.configTitle');
});

const canAddCondition = computed(() => form.conditions.length < maxConditions.value);

const matchLogicOptions = computed(() => [
  { value: 'AND', label: t('duplicates.logicAnd') },
  { value: 'OR', label: t('duplicates.logicOr') },
]);

const matchTypeOptions = computed(() => [
  { value: 'exact', label: t('duplicates.matchExact') },
  { value: 'similar', label: t('duplicates.matchSimilar') },
]);

const apiPolicyOptions = computed(() => [
  { value: 'attach', label: t('duplicates.policyAttach') },
  { value: 'warn', label: t('duplicates.policyWarn') },
  { value: 'reject', label: t('duplicates.policyReject') },
]);

function snapshotFromState() {
  return JSON.stringify({
    enabled: form.enabled,
    matchLogic: form.matchLogic,
    conditions: form.conditions.map((c) => ({ field: c.field, matchType: c.matchType })),
    ignoreBlankValues: form.ignoreBlankValues,
    checkInactiveRecords: form.checkInactiveRecords,
    apiMatchPolicy: form.apiMatchPolicy,
  });
}

const isDirty = computed(() => Boolean(snapshotJson.value) && snapshotFromState() !== snapshotJson.value);

function applySnapshot(data) {
  form.enabled = data.enabled !== false;
  form.matchLogic = data.matchLogic || 'OR';
  form.conditions = (data.conditions || []).map((c) => ({
    field: c.field,
    matchType: c.matchType || 'exact',
  }));
  form.ignoreBlankValues = data.ignoreBlankValues !== false;
  form.checkInactiveRecords = data.checkInactiveRecords !== false;
  form.apiMatchPolicy = data.apiMatchPolicy || 'warn';
  if (!form.conditions.length && fieldOptions.value[0]) {
    form.conditions.push({
      field: fieldOptions.value[0].field,
      matchType: fieldOptions.value[0].defaultMatchType || 'exact',
    });
  }
  snapshotJson.value = snapshotFromState();
}

function resetLocal() {
  if (!snapshotJson.value) return;
  try {
    applySnapshot(JSON.parse(snapshotJson.value));
    error.value = '';
  } catch (_) {
    /* ignore */
  }
}

function usedFields(exceptIdx = -1) {
  return new Set(
    form.conditions
      .filter((_, i) => i !== exceptIdx)
      .map((c) => c.field)
  );
}

function fieldSelectOptionsForRow(idx) {
  const used = usedFields(idx);
  return fieldOptions.value
    .filter((opt) => opt.field === form.conditions[idx]?.field || !used.has(opt.field))
    .map((opt) => ({ value: opt.field, label: opt.label }));
}

function addCondition() {
  if (!canAddCondition.value) return;
  const used = usedFields();
  const next = fieldOptions.value.find((o) => !used.has(o.field));
  if (!next) return;
  form.conditions.push({
    field: next.field,
    matchType: next.defaultMatchType || 'exact',
  });
}

function removeCondition(idx) {
  if (form.conditions.length <= 1) return;
  form.conditions.splice(idx, 1);
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient.get(`/duplicates/${props.moduleKey}`);
    const data = res.data?.data || res.data;
    fieldOptions.value = data.fieldOptions || [];
    maxConditions.value = data.maxConditions || 3;
    applySnapshot(data);
  } catch (e) {
    error.value = e?.response?.data?.message || t('duplicates.loadFailed');
    snapshotJson.value = '';
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!isDirty.value) return;
  saving.value = true;
  error.value = '';
  try {
    await apiClient.put(`/duplicates/${props.moduleKey}`, {
      enabled: form.enabled,
      matchLogic: form.matchLogic,
      conditions: form.conditions,
      ignoreBlankValues: form.ignoreBlankValues,
      checkInactiveRecords: form.checkInactiveRecords,
      apiMatchPolicy: form.apiMatchPolicy,
    });
    success(t('duplicates.saveSuccess'));
    snapshotJson.value = snapshotFromState();
  } catch (e) {
    error.value = e?.response?.data?.message || t('duplicates.saveFailed');
    notifyError(error.value);
  } finally {
    saving.value = false;
  }
}

watch(() => props.moduleKey, load, { immediate: true });
</script>
