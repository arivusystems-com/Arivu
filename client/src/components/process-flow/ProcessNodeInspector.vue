<template>
  <div class="h-full flex flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
    <div v-if="!nodeId" class="flex-1 flex items-center justify-center p-6 text-center">
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('process.inspectorSelectStep') }}</p>
    </div>
    <template v-else>
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ displayNodeLabel }}</h3>
          <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{{ t('process.inspectorSchemaVersion', { version: nodeVersion }) }}</p>
        </div>
        <button
          type="button"
          class="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          @click="$emit('deselect')"
        >
          {{ t('process.inspectorProcessSettings') }}
        </button>
      </div>

      <div class="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-900/40">
        <p class="text-[10px] font-semibold uppercase text-indigo-600 dark:text-indigo-400 mb-1">{{ t('process.inspectorSummaryHeading') }}</p>
        <p class="text-sm text-indigo-900 dark:text-indigo-100 leading-snug">{{ sentence }}</p>
        <p v-if="executionDetail" class="text-xs text-red-700 dark:text-red-300 mt-2">{{ executionDetail }}</p>
      </div>

      <div v-if="editable" class="flex-1 overflow-y-auto p-4 space-y-4">
        <div v-if="processType === 'trigger'" class="space-y-2">
          <p class="text-xs text-gray-600 dark:text-gray-400">
            {{ t('process.inspectorTriggerConfigured') }}
            <button type="button" class="text-indigo-600 underline" @click="$emit('deselect')">{{ t('process.inspectorOpenProcessSettings') }}</button>.
          </p>
          <p class="text-xs font-medium text-gray-800 dark:text-gray-200">{{ sentence }}</p>
        </div>

        <div v-else-if="processType === 'condition'" class="space-y-3">
          <p class="text-[10px] text-gray-500">{{ t('process.inspectorAppliesToModule', { module: moduleLabel }) }}</p>
          <ProcessConditionGroupEditor
            v-if="localConfig.conditionGroup"
            :group="localConfig.conditionGroup"
            :field-options="conditionFields"
            :module-field-meta="moduleFieldMeta"
            :condition-fields-loading="conditionFieldsLoading"
            :entity-type="process?.entityType || ''"
            @update:group="onConditionGroupUpdate"
            @change="emitUpdate"
          />
          <p class="text-[10px] text-gray-500">{{ t('process.inspectorConnectHandles') }}</p>
        </div>

        <div v-else-if="processType === 'field_rule'" class="space-y-3">
          <p class="text-[10px] text-gray-500">{{ t('process.inspectorModulePrefix', { module: moduleLabel }) }}</p>
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('process.inspectorFieldHeading') }}</label>
            <HeadlessSelect
              v-if="conditionFields.length"
              v-model="localConfig.fieldKey"
              :options="conditionFields"
              allow-empty
              :empty-label="t('process.inspectorSelectGeneric')"
              :button-class="PROCESS_SELECT_BUTTON_CLASS"
              @update:model-value="emitUpdate"
            />
            <input
              v-else
              v-model="localConfig.fieldKey"
              type="text"
              class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              @input="emitUpdate"
            />
          </div>
          <HeadlessSelect
            v-model="localConfig.rule"
            :options="fieldRuleOptions"
            :button-class="PROCESS_SELECT_BUTTON_CLASS"
            @update:model-value="emitUpdate"
          />
          <input
            v-if="localConfig.rule === 'default'"
            v-model="localConfig.value"
            type="text"
            :placeholder="t('process.inspectorDefaultValuePh')"
            class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
            @input="emitUpdate"
          />
        </div>

        <div v-else-if="processType === 'ownership_rule'" class="space-y-3">
          <HeadlessSelect
            v-model="localConfig.assignment"
            :options="ownershipAssignmentOptions"
            :button-class="PROCESS_SELECT_BUTTON_CLASS"
            @update:model-value="emitUpdate"
          />
          <input v-model="localConfig.target" :placeholder="t('process.inspectorOwnerTargetPh')" class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" @input="emitUpdate" />
        </div>

        <div v-else-if="processType === 'status_guard'" class="space-y-3">
          <HeadlessSelect
            v-model="localConfig.field"
            :options="statusGuardFieldOptions"
            :button-class="PROCESS_SELECT_BUTTON_CLASS"
            @update:model-value="emitUpdate"
          />
          <div class="grid grid-cols-2 gap-2">
            <input v-model="statusFrom" :placeholder="t('process.inspectorStatusFromPh')" class="px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" @input="emitStatusGuard" />
            <input v-model="statusTo" :placeholder="t('process.inspectorStatusToPh')" class="px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" @input="emitStatusGuard" />
          </div>
          <input v-model="localConfig.blockReason" :placeholder="t('process.inspectorBlockReasonPh')" class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" @input="emitUpdate" />
        </div>

        <div v-else-if="processType === 'action'" class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('process.inspectorActionHeading') }}</label>
            <HeadlessSelect
              :model-value="localConfig.actionType"
              :option-groups="actionTypeGroups"
              allow-empty
              :empty-label="t('process.inspectorSelectAction')"
              :placeholder="t('process.inspectorSelectAction')"
              :button-class="PROCESS_SELECT_BUTTON_CLASS"
              @update:model-value="onActionTypeChange"
            />
          </div>
          <ProcessActionFields
            v-if="selectedActionDef"
            :action-def="selectedActionDef"
            :params="localConfig.params || {}"
            :process-entity-type="process?.entityType || ''"
            @update:params="onActionParamsChange"
          />
        </div>

        <div v-else-if="processType === 'approval_gate'" class="space-y-3">
          <input v-model="localConfig.approvers.role" :placeholder="t('process.inspectorApproverRolePh')" class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" @input="emitUpdate" />
          <input v-model.number="localConfig.timeoutHours" type="number" :placeholder="t('process.inspectorTimeoutHoursPh')" class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" @input="emitUpdate" />
        </div>

        <div v-else-if="processType === 'wait'" class="space-y-3">
          <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ t('process.inspectorWaitHint') }}</p>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="preset in waitPresets"
              :key="preset.label"
              type="button"
              class="px-2 py-1 text-[11px] rounded-md border border-gray-200 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400"
              @click="applyWaitPreset(preset.duration, preset.unit)"
            >
              {{ preset.label }}
            </button>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <input
              v-model.number="localConfig.duration"
              type="number"
              min="1"
              :placeholder="t('process.inspectorDurationPh')"
              class="px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              @input="emitUpdate"
            />
            <HeadlessSelect
              v-model="localConfig.unit"
              :options="waitUnitOptions"
              :button-class="PROCESS_SELECT_BUTTON_CLASS"
              @update:model-value="emitUpdate"
            />
          </div>
        </div>

        <div v-else-if="processType === 'for_each'" class="space-y-3">
          <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ t('process.inspectorForEachHint') }}</p>
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ t('process.inspectorForEachVariable') }}
            </label>
            <HeadlessSelect
              :model-value="localConfig.variableName || ''"
              :options="dataVariableOptions"
              allow-empty
              :empty-label="
                dataVariableOptions.length
                  ? t('process.inspectorForEachSelectVariable')
                  : t('process.inspectorForEachNoVariables')
              "
              :button-class="PROCESS_SELECT_BUTTON_CLASS"
              @update:model-value="(v) => { localConfig.variableName = v || ''; emitUpdate(); }"
            />
          </div>
          <p v-if="!dataVariableOptions.length" class="text-[10px] text-amber-700 dark:text-amber-400">
            {{ t('process.inspectorForEachNoVariablesHint') }}
          </p>
          <p class="text-[10px] text-gray-500">{{ t('process.inspectorForEachConnectHint') }}</p>
        </div>

        <div v-else-if="processType === 'for_each_end'" class="space-y-3">
          <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ t('process.inspectorForEachEndHint') }}</p>
        </div>

        <div v-else class="text-xs text-gray-500">{{ t('process.inspectorNoConfig') }}</div>

        <button
          v-if="processType !== 'trigger'"
          type="button"
          class="w-full text-sm text-red-600 dark:text-red-400 hover:underline"
          @click="$emit('delete-node', nodeId)"
        >
          {{ t('process.inspectorRemoveStep') }}
        </button>
      </div>
      <div v-else class="flex-1 p-4 text-xs text-gray-500">
        {{ t('process.inspectorDuplicateToEdit') }}
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import ProcessActionFields from '@/components/process-flow/ProcessActionFields.vue';
import ProcessConditionGroupEditor from '@/components/process-flow/ProcessConditionGroupEditor.vue';
import { buildNodeSentence } from '@/utils/processSentenceBuilder';
import {
  PROCESS_SELECT_BUTTON_CLASS,
  getFieldRuleOptions,
  getOwnershipAssignmentOptions,
  getStatusGuardFieldOptions,
  getWaitUnitOptions,
  getWaitPresets,
  normalizeProcessConditionGroup,
  getModuleLabel
} from '@/utils/processDesignerConstants';

const { t } = useI18n();

const props = defineProps({
  nodeId: { type: String, default: null },
  processType: { type: String, default: '' },
  nodeLabel: { type: String, default: '' },
  nodeVersion: { type: Number, default: 1 },
  config: { type: Object, default: () => ({}) },
  process: { type: Object, default: null },
  /** Live canvas nodes — used to list Fetch / Set variable names for for_each */
  flowNodes: { type: Array, default: () => [] },
  editable: { type: Boolean, default: true },
  executionDetail: { type: String, default: '' },
  moduleFieldMeta: { type: Object, default: () => ({}) },
  conditionFieldsLoading: { type: Boolean, default: false },
  designerMetadata: { type: Object, default: null }
});

const emit = defineEmits(['update-node', 'delete-node', 'deselect']);

const localConfig = ref({});
const isHydrating = ref(false);
const statusFrom = ref('');
const statusTo = ref('');

const fieldRuleOptions = computed(() => getFieldRuleOptions(t));
const ownershipAssignmentOptions = computed(() => getOwnershipAssignmentOptions(t));
const statusGuardFieldOptions = computed(() => getStatusGuardFieldOptions(t));
const waitUnitOptions = computed(() => getWaitUnitOptions(t));
const waitPresets = computed(() => getWaitPresets(t));

const displayNodeLabel = computed(() => props.nodeLabel || t('process.inspectorStepDefault'));

const moduleLabel = computed(() => {
  return (
    getModuleLabel(t, props.process?.entityType, { plural: true }) ||
    props.process?.entityType ||
    t('process.inspectorRecordsFallback')
  );
});

const conditionFields = computed(() => {
  const fromModule = Object.values(props.moduleFieldMeta || {})
    .filter((m) => m?.key)
    .map((m) => ({ value: m.key, label: m.label || m.key }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
  return fromModule;
});

const processActions = computed(() => props.designerMetadata?.processActions || []);

/** Variables written by Fetch records / Fetch related / Set variable on the canvas */
const dataVariableOptions = computed(() => {
  const names = new Set();
  for (const n of props.flowNodes || []) {
    const pType = n.data?.processType || n.type;
    const config = n.data?.config || n.config || {};
    if (pType !== 'action') continue;
    const actionType = config.actionType;
    const params = config.params || {};
    if (actionType === 'fetch_records' || actionType === 'fetch_related_records') {
      const v = String(params.variableName || '').trim();
      if (v) names.add(v);
    }
    if (actionType === 'set_variable') {
      const v = String(params.name || params.variableName || '').trim();
      if (v) names.add(v);
    }
  }
  const options = [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, label: value }));
  const current = String(localConfig.value?.variableName || '').trim();
  if (current && !names.has(current)) {
    options.unshift({
      value: current,
      label: `${current} (${t('process.inspectorForEachMissingVar')})`
    });
  }
  return options;
});

const actionTypeGroups = computed(() => {
  const groups = props.designerMetadata?.processActionGroups;
  if (Array.isArray(groups) && groups.length) {
    return groups.map((g) => ({
      label: g.label,
      options: (g.actions || []).map((a) => ({
        value: a.actionType,
        label: a.available === false ? `${a.label} (${t('process.inspectorComingSoonBadge')})` : a.label,
        disabled: a.available === false
      }))
    }));
  }
  // Fallback: flat list → single group
  return [
    {
      label: t('process.inspectorActionHeading'),
      options: processActions.value.map((a) => ({ value: a.actionType, label: a.label }))
    }
  ];
});

const selectedActionDef = computed(() =>
  processActions.value.find((a) => a.actionType === localConfig.value.actionType) || null
);

function defaultParamsForAction(actionType) {
  const def = processActions.value.find((a) => a.actionType === actionType);
  if (!def) return {};
  const out = {};
  for (const field of def.params || []) {
    if (field.defaultValue !== undefined) out[field.key] = field.defaultValue;
    else if (field.type === 'field_map') out[field.key] = {};
    else if (field.type === 'condition_group') out[field.key] = normalizeProcessConditionGroup({});
    else if (field.type === 'text' || field.type === 'textarea' || field.type === 'module') out[field.key] = '';
    else if (field.type === 'number') out[field.key] = null;
  }
  return out;
}

function onActionTypeChange(newType) {
  if (isHydrating.value || !newType || newType === localConfig.value.actionType) return;
  localConfig.value.actionType = newType;
  localConfig.value.params = defaultParamsForAction(newType);
  emitUpdate();
}

function onActionParamsChange(params) {
  localConfig.value.params = params;
  emitUpdate();
}

function buildEmitConfig() {
  const type = props.processType;
  const config = { ...localConfig.value };
  if (['field_rule', 'ownership_rule', 'status_guard'].includes(type)) {
    config.entityType = props.process?.entityType || config.entityType;
  }
  if (type === 'condition') {
    return { conditionGroup: localConfig.value.conditionGroup };
  }
  return config;
}

function onConditionGroupUpdate(group) {
  localConfig.value.conditionGroup = group;
}

function buildEmitSentence(config) {
  if (!props.processType) return '';
  return buildNodeSentence({ type: props.processType, config }, props.process);
}

function hydrateFromProps() {
  if (!props.nodeId) return;
  isHydrating.value = true;
  const c = props.config || {};
  const entityType = props.process?.entityType || c.entityType || 'deal';

  if (props.processType === 'condition') {
    localConfig.value = {
      conditionGroup: normalizeProcessConditionGroup(c)
    };
  } else if (props.processType === 'action') {
    const actionType = c.actionType || '';
    const savedParams = { ...c.params };
    localConfig.value = {
      actionType,
      params:
        actionType && processActions.value.length
          ? { ...defaultParamsForAction(actionType), ...savedParams }
          : savedParams
    };
  } else if (props.processType === 'approval_gate') {
    localConfig.value = {
      approvers: { ...(c.approvers || { role: 'manager' }) },
      timeoutHours: c.timeoutHours ?? 48
    };
  } else if (props.processType === 'wait') {
    localConfig.value = {
      duration: c.duration ?? 2,
      unit: c.unit || 'days'
    };
  } else if (props.processType === 'status_guard') {
    const tr = c.allowedTransitions?.[0] || '';
    const parts = tr.split('→').map((s) => s.trim());
    statusFrom.value = parts[0] || '';
    statusTo.value = parts[1] || '';
    localConfig.value = { ...c, entityType, field: c.field || 'stage' };
  } else if (['field_rule', 'ownership_rule'].includes(props.processType)) {
    localConfig.value = { ...c, entityType };
  } else {
    localConfig.value = { ...c };
  }
  queueMicrotask(() => {
    isHydrating.value = false;
  });
}

watch(
  () => [props.nodeId, props.processType],
  () => hydrateFromProps(),
  { immediate: true }
);

onBeforeUnmount(() => {
  if (props.nodeId && props.editable) emitUpdate();
});

const sentence = computed(() => buildEmitSentence(buildEmitConfig()));

function emitUpdate() {
  if (!props.nodeId) return;
  const config = buildEmitConfig();
  emit('update-node', {
    nodeId: props.nodeId,
    processType: props.processType,
    config,
    sentence: buildEmitSentence(config)
  });
}

function emitStatusGuard() {
  localConfig.value.allowedTransitions = [`${statusFrom.value} → ${statusTo.value}`];
  emitUpdate();
}

function applyWaitPreset(duration, unit) {
  localConfig.value = { duration, unit };
  emitUpdate();
}
</script>
