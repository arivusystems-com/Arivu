<template>
  <div class="closed-records-settings space-y-6">
    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('states.loading') }}
    </div>
    <div
      v-else-if="loadError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
    >
      {{ loadError }}
    </div>
    <template v-else>
      <div
        class="grid grid-cols-1 gap-4"
        :class="hideModuleSelector ? 'md:grid-cols-1' : 'md:grid-cols-2'"
      >
        <div v-if="!hideModuleSelector">
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('settings.closedRecordsSelectModule') }}
          </label>
          <HeadlessSelect
            id="closed-records-module"
            :model-value="selectedModule"
            :options="moduleSelectOptions"
            :placeholder="t('settings.closedRecordsSelectModule')"
            teleport
            :teleport-match-width="true"
            wrapper-class="w-full"
            @update:model-value="onModuleSelect"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('settings.closedRecordsSelectPicklist') }}
          </label>
          <input
            type="text"
            class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            :value="picklistLabel"
            disabled
          />
        </div>
      </div>

      <div class="overflow-visible rounded-xl border border-gray-200 dark:border-gray-700">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {{ statusColumnLabel }}
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {{ t('settings.closedRecordsClosedCol') }}
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {{ t('settings.closedRecordsReopenCol') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
            <tr v-for="value in picklistValues" :key="value">
              <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{{ value }}</td>
              <td class="px-4 py-3">
                <HeadlessCheckbox
                  :model-value="isClosed(value)"
                  @update:model-value="(checked) => toggleClosed(value, checked)"
                />
              </td>
              <td class="px-4 py-3">
                <HeadlessSelect
                  :id="`closed-reopen-${value}`"
                  :model-value="reopenFor(value) || ''"
                  :options="reopenSelectOptions(value)"
                  :disabled="!isClosed(value) || !reopenEnabled"
                  :allow-empty="true"
                  :empty-value="''"
                  :empty-label="t('settings.closedRecordsReopenPlaceholder')"
                  :placeholder="t('settings.closedRecordsReopenPlaceholder')"
                  teleport
                  :teleport-match-width="true"
                  wrapper-class="w-full max-w-xs"
                  button-class="!py-2"
                  @update:model-value="(v) => setReopen(value, v == null ? '' : String(v))"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap items-center gap-6">
        <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <HeadlessCheckbox v-model="reopenEnabled" />
          {{ t('settings.closedRecordsReopenEnabled') }}
        </label>
        <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <HeadlessCheckbox v-model="allowLinkingToClosed" />
          {{ t('settings.closedRecordsAllowLinking', { module: moduleLabel }) }}
        </label>
        <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <HeadlessCheckbox v-model="enabled" />
          {{ t('settings.closedRecordsEnabled') }}
        </label>
      </div>

      <div v-if="saveError" class="text-sm text-red-600 dark:text-red-400">{{ saveError }}</div>
      <div v-if="saveOk" class="text-sm text-green-600 dark:text-green-400">{{ saveOk }}</div>

      <div class="flex justify-end">
        <button
          type="button"
          class="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          :disabled="saving || !dirty"
          @click="save"
        >
          {{ saving ? t('states.saving') : t('actions.save') }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { APP_MODULE_GROUPS_CLIENT } from '@/constants/closedRecordsModulesClient';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';

const props = defineProps({
  /** Limit modules to an app group: sales | helpdesk | inventory | core | all */
  appGroup: {
    type: String,
    default: 'all'
  },
  /** Pre-select a module key */
  initialModule: {
    type: String,
    default: ''
  },
  /** When true (module settings tab), hide module dropdown and lock to initialModule */
  hideModuleSelector: {
    type: Boolean,
    default: false
  }
});

const { t } = useI18n();
const route = useRoute();

const loading = ref(true);
const saving = ref(false);
const loadError = ref('');
const saveError = ref('');
const saveOk = ref('');
const allModules = ref([]);
const selectedModule = ref('');
const picklistValues = ref([]);
const statusField = ref('status');
const statusPicklistKey = ref('');
const enabled = ref(true);
const reopenEnabled = ref(true);
const allowLinkingToClosed = ref(true);
const closedMap = ref({});
const originalSnapshot = ref('');

const moduleOptions = computed(() => {
  const group = String(props.appGroup || 'all').toLowerCase();
  const keys = APP_MODULE_GROUPS_CLIENT[group] || null;
  if (!keys) return allModules.value;
  const set = new Set(keys);
  return allModules.value.filter((m) => set.has(m.moduleKey));
});

const moduleSelectOptions = computed(() =>
  moduleOptions.value.map((m) => ({
    value: m.moduleKey,
    label: m.displayLabel || m.moduleKey
  }))
);

const moduleLabel = computed(() => {
  const m = moduleOptions.value.find((x) => x.moduleKey === selectedModule.value);
  return m?.displayLabel || selectedModule.value;
});

const picklistLabel = computed(() => statusPicklistKey.value || statusField.value || '—');

const statusColumnLabel = computed(() => {
  if (statusField.value === 'stage') return t('settings.closedRecordsStageCol');
  return t('settings.closedRecordsStatusCol');
});

const dirty = computed(() => {
  return JSON.stringify(buildPayload()) !== originalSnapshot.value;
});

function isClosed(value) {
  return Boolean(closedMap.value[value]?.closed);
}

function reopenFor(value) {
  return closedMap.value[value]?.reopenStatusValue || '';
}

function reopenOptions(current) {
  const closedSet = new Set(
    Object.entries(closedMap.value)
      .filter(([, v]) => v.closed)
      .map(([k]) => k)
  );
  return picklistValues.value.filter((v) => v !== current && !closedSet.has(v));
}

function reopenSelectOptions(current) {
  return reopenOptions(current).map((v) => ({ value: v, label: v }));
}

function toggleClosed(value, checked) {
  const next = { ...closedMap.value };
  if (checked) {
    next[value] = { closed: true, reopenStatusValue: next[value]?.reopenStatusValue || '' };
  } else {
    next[value] = { closed: false, reopenStatusValue: '' };
  }
  closedMap.value = next;
}

function setReopen(value, reopenStatusValue) {
  closedMap.value = {
    ...closedMap.value,
    [value]: { closed: true, reopenStatusValue }
  };
}

function buildPayload() {
  const closedStates = Object.entries(closedMap.value)
    .filter(([, v]) => v.closed)
    .map(([statusValue, v]) => ({
      statusValue,
      reopenStatusValue: reopenEnabled.value ? v.reopenStatusValue || null : null
    }));
  return {
    enabled: enabled.value,
    reopenEnabled: reopenEnabled.value,
    allowLinkingToClosed: allowLinkingToClosed.value,
    statusField: statusField.value,
    statusPicklistKey: statusPicklistKey.value || null,
    closedStates
  };
}

async function loadModules() {
  const res = await apiClient.get('/settings/closed-records/modules');
  const payload = res?.data ?? res;
  allModules.value = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
}

async function loadConfig(moduleKey) {
  if (!moduleKey) return;
  loadError.value = '';
  saveOk.value = '';
  saveError.value = '';
  const res = await apiClient.get(`/settings/closed-records/${moduleKey}`);
  const payload = res?.data ?? res;
  const data = payload?.data ?? payload;
  const config = data.config || data;
  picklistValues.value = data.picklistValues || [];
  statusField.value = config.statusField || 'status';
  statusPicklistKey.value = config.statusPicklistKey || '';
  enabled.value = config.enabled !== false;
  reopenEnabled.value = config.reopenEnabled !== false;
  allowLinkingToClosed.value = config.allowLinkingToClosed !== false;
  const map = {};
  for (const v of picklistValues.value) {
    map[v] = { closed: false, reopenStatusValue: '' };
  }
  for (const row of config.closedStates || []) {
    map[row.statusValue] = {
      closed: true,
      reopenStatusValue: row.reopenStatusValue || ''
    };
  }
  closedMap.value = map;
  originalSnapshot.value = JSON.stringify(buildPayload());
}

async function onModuleChange() {
  loading.value = true;
  try {
    await loadConfig(selectedModule.value);
  } catch (e) {
    loadError.value = e?.message || t('settings.closedRecordsLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function onModuleSelect(value) {
  selectedModule.value = value == null ? '' : String(value);
  await onModuleChange();
}

async function save() {
  saving.value = true;
  saveError.value = '';
  saveOk.value = '';
  try {
    await apiClient.put(`/settings/closed-records/${selectedModule.value}`, buildPayload());
    originalSnapshot.value = JSON.stringify(buildPayload());
    saveOk.value = t('settings.closedRecordsSaved');
  } catch (e) {
    saveError.value =
      e?.response?.data?.message || e?.message || t('settings.closedRecordsSaveFailed');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    await loadModules();
    const locked = String(props.initialModule || '').toLowerCase();
    if (props.hideModuleSelector && locked) {
      selectedModule.value = locked;
    } else {
      const fromQuery = String(route.query.module || props.initialModule || '').toLowerCase();
      const first = moduleOptions.value[0]?.moduleKey || '';
      selectedModule.value =
        (fromQuery && moduleOptions.value.some((m) => m.moduleKey === fromQuery) && fromQuery) ||
        first;
    }
    if (selectedModule.value) {
      await loadConfig(selectedModule.value);
    }
  } catch (e) {
    loadError.value = e?.message || t('settings.closedRecordsLoadFailed');
  } finally {
    loading.value = false;
  }
});

watch(
  () => props.initialModule,
  async (next) => {
    if (!props.hideModuleSelector) return;
    const key = String(next || '').toLowerCase();
    if (!key || key === selectedModule.value) return;
    selectedModule.value = key;
    await onModuleChange();
  }
);

watch(
  () => props.appGroup,
  async () => {
    if (props.hideModuleSelector) return;
    if (
      moduleOptions.value.length &&
      !moduleOptions.value.some((m) => m.moduleKey === selectedModule.value)
    ) {
      selectedModule.value = moduleOptions.value[0].moduleKey;
      await onModuleChange();
    }
  }
);
</script>
