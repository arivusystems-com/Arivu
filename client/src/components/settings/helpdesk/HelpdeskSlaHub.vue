<template>
  <div>
    <HelpdeskSlaPolicyList
      :standard-policy="standardPolicyMeta"
      :policies="policies"
      :default-policy-key="defaultPolicyKey"
      :case-type-label="caseTypeLabel"
      :business-hours-enabled="businessHours.enabled"
      :business-hours="businessHours"
      :priority-count="priorities.length"
      @create="openNewPolicy"
      @edit="openPolicy"
      @delete="deletePolicy"
      @toggle-enabled="togglePolicyEnabled"
      @toggle-default="togglePolicyDefault"
    />

    <HelpdeskSlaPolicyDrawer
      ref="drawerRef"
      :open="drawerOpen"
      :policy-id="editingPolicyId"
      :is-new="editingIsNew"
      :is-standard="editingPolicyId === SLA_STANDARD_POLICY_ID"
      :initial-policy="editingInitialPolicy"
      :priorities="priorities"
      :case-types="caseTypes"
      :channels="channels"
      :sla-policy-options="slaPolicyOptions"
      :case-type-label="caseTypeLabel"
      :priority-label="priorityLabel"
      :standard-targets="standardTargets"
      :business-hours="businessHours"
      :enabled-case-types="enabledCaseTypes"
      :recalculating-slas="recalculatingSlas"
      :recalculate-message="recalculateMessage"
      @close="closeDrawer"
      @save="saveDrawer"
      @remove="removeCurrentPolicy"
      @recalculate="$emit('recalculate')"
      @update:business-hours="businessHours = $event"
      @update:enabled-case-types="enabledCaseTypes = $event"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import HelpdeskSlaPolicyList from '@/components/settings/helpdesk/HelpdeskSlaPolicyList.vue';
import HelpdeskSlaPolicyDrawer from '@/components/settings/helpdesk/HelpdeskSlaPolicyDrawer.vue';
import { SLA_STANDARD_POLICY_ID } from '@/components/settings/helpdesk/slaPolicyConstants.js';
import { targetRowFromStandard } from '@/constants/helpdeskSlaPolicy';

const props = defineProps({
  priorities: { type: Array, required: true },
  caseTypes: { type: Array, required: true },
  channels: { type: Array, required: true },
  slaPolicyOptions: { type: Object, required: true },
  caseTypeLabel: { type: Function, required: true },
  priorityLabel: { type: Function, required: true },
  recalculatingSlas: { type: Boolean, default: false },
  recalculateMessage: { type: String, default: '' }
});

defineEmits(['recalculate']);

const notifications = defineModel('notifications', { type: Object, required: true });
const standardTargets = defineModel('standardTargets', { type: Object, required: true });
const businessHours = defineModel('businessHours', { type: Object, required: true });
const enabledCaseTypes = defineModel('enabledCaseTypes', { type: Array, required: true });
const policies = defineModel('policies', { type: Array, default: () => [] });
const defaultPolicyKey = defineModel('defaultPolicyKey', { type: String, default: '' });

const { t } = useI18n();

const drawerOpen = ref(false);
const editingPolicyId = ref('');
const editingIsNew = ref(false);
const editingIndex = ref(-1);
const drawerRef = ref(null);

const standardPolicyMeta = computed(() => ({
  name: t('settings.slaPolicyStandardName'),
  description: '',
  caseTypes: enabledCaseTypes.value,
  notifyOnSlaWarning: notifications.value.notifyOnSlaWarning,
  notifyOnSlaBreach: notifications.value.notifyOnSlaBreach,
  alerts: buildStandardAlerts()
}));

function buildStandardAlerts() {
  const types = props.slaPolicyOptions?.alertTypes || [];
  const alerts = [];
  if (notifications.value.notifyOnSlaWarning && types.includes('warning')) alerts.push({ type: 'warning' });
  if (notifications.value.notifyOnSlaBreach && types.includes('breach')) alerts.push({ type: 'breach' });
  return alerts;
}

const editingInitialPolicy = computed(() => {
  if (editingPolicyId.value === SLA_STANDARD_POLICY_ID) {
    return {
      name: t('settings.slaPolicyStandardName'),
      priorityTargets: buildPriorityTargetsFromDisplay(standardTargets.value),
      alerts: buildStandardAlerts()
    };
  }
  if (editingIndex.value >= 0) return policies.value[editingIndex.value];
  return null;
});

function minutesToHours(minutes) {
  return Math.max(1, Math.round(Number(minutes || 0) / 60));
}

function hoursToMinutes(hours) {
  return Math.max(1, Math.round(Number(hours || 0) * 60));
}

function buildPriorityTargetsFromDisplay(targets) {
  const result = {};
  for (const priority of props.priorities) {
    const row = targetRowFromStandard(priority, targets, props.priorities);
    result[priority] = {
      firstResponseMinutes: hoursToMinutes(row.responseHours),
      resolutionMinutes: hoursToMinutes(row.resolutionHours),
      overrideHours: row.overrideHours
    };
  }
  return result;
}

function syncDisplayFromPriorityTargets(priorityTargets) {
  for (const priority of props.priorities) {
    const source = priorityTargets[priority] || {};
    const row = targetRowFromStandard(priority, {
      [priority]: {
        firstResponseMinutes: source.firstResponseMinutes,
        resolutionMinutes: source.resolutionMinutes,
        overrideHours: source.overrideHours
      }
    }, props.priorities);
    standardTargets.value[priority] = row;
  }
}

function openNewPolicy() {
  editingPolicyId.value = '';
  editingIsNew.value = true;
  editingIndex.value = -1;
  drawerOpen.value = true;
}

function openPolicy(policyId) {
  editingPolicyId.value = policyId;
  editingIsNew.value = false;
  editingIndex.value = policyId === SLA_STANDARD_POLICY_ID
    ? -1
    : policies.value.findIndex((p) => p.key === policyId);
  drawerOpen.value = true;
}

function closeDrawer() {
  drawerOpen.value = false;
}

function deletePolicy(policyId) {
  if (policyId === SLA_STANDARD_POLICY_ID) return;
  const idx = policies.value.findIndex((p) => p.key === policyId);
  if (idx < 0) return;
  const removed = policies.value[idx];
  policies.value.splice(idx, 1);
  if (defaultPolicyKey.value === removed?.key) defaultPolicyKey.value = '';
}

function togglePolicyEnabled(policyId) {
  if (policyId === SLA_STANDARD_POLICY_ID) return;
  const policy = policies.value.find((p) => p.key === policyId);
  if (policy) policy.enabled = policy.enabled === false;
}

function togglePolicyDefault(policyId) {
  if (policyId === SLA_STANDARD_POLICY_ID) {
    defaultPolicyKey.value = '';
    return;
  }
  defaultPolicyKey.value = defaultPolicyKey.value === policyId ? '' : policyId;
}

function applyPayload(payload) {
  if (editingPolicyId.value === SLA_STANDARD_POLICY_ID || payload.key === SLA_STANDARD_POLICY_ID) {
    syncDisplayFromPriorityTargets(payload.priorityTargets);
    if (payload.isDefault) defaultPolicyKey.value = '';
    notifications.value = {
      ...notifications.value,
      notifyOnSlaWarning: payload.alerts?.some((a) => a.type === 'warning') ?? notifications.value.notifyOnSlaWarning,
      notifyOnSlaBreach: payload.alerts?.some((a) => a.type === 'breach') ?? notifications.value.notifyOnSlaBreach,
    };
    enabledCaseTypes.value = [...payload.caseTypes];
    return;
  }

  if (payload.isDefault) {
    defaultPolicyKey.value = payload.key;
  } else if (defaultPolicyKey.value === payload.key) {
    defaultPolicyKey.value = '';
  }

  const stored = {
    key: payload.key,
    name: payload.name,
    description: payload.description,
    enabled: payload.enabled,
    caseTypes: payload.caseTypes,
    channels: payload.channels,
    priorities: payload.priorities,
    priorityTargets: payload.priorityTargets,
    alerts: payload.alerts,
    escalationSteps: payload.escalationSteps,
    escalationCooldownMinutes: payload.escalationCooldownMinutes,
    priorityHourOverrides: payload.priorityHourOverrides,
    useCalendarTime: payload.useCalendarTime
  };

  if (editingIsNew.value) {
    policies.value.push(stored);
  } else if (editingIndex.value >= 0) {
    policies.value[editingIndex.value] = stored;
  }
}

function saveDrawer(payload) {
  applyPayload(payload);
  closeDrawer();
}

function removeCurrentPolicy() {
  if (editingIndex.value >= 0) deletePolicy(editingPolicyId.value);
  closeDrawer();
}

defineExpose({
  syncAllPolicyTargetsFromDisplay() {},
  validate() {
    if (drawerOpen.value) {
      const err = drawerRef.value?.validate?.();
      if (err) return err;
      const payload = drawerRef.value?.getPayload?.();
      if (payload) applyPayload(payload);
    }

    const keys = new Set();
    for (const policy of policies.value) {
      if (policy.enabled === false) continue;
      if (!String(policy.name || '').trim()) return t('settings.helpdeskExecSlaPolicyNameRequired');
      if (!String(policy.key || '').trim()) return t('settings.helpdeskExecSlaPolicyKeyRequired');
      if (keys.has(policy.key)) return t('settings.helpdeskExecSlaPolicyDuplicateKey', { key: policy.key });
      keys.add(policy.key);
    }
    if (defaultPolicyKey.value && !policies.value.some((p) => p.key === defaultPolicyKey.value && p.enabled !== false)) {
      return t('settings.helpdeskExecSlaPolicyInvalidDefault');
    }
    return null;
  },
  isEditing: () => drawerOpen.value
});
</script>
