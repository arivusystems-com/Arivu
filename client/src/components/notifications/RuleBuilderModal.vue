<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 overflow-y-auto"
    role="dialog"
    aria-modal="true"
    aria-labelledby="rule-builder-title"
    @click.self="$emit('close')"
  >
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/50 transition-opacity" aria-hidden="true"></div>

    <!-- Modal Container -->
    <div class="flex min-h-full items-center justify-center p-4 sm:p-6">
      <div
        class="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-xl transform transition-all"
        @click.stop
      >
        <!-- Header -->
        <div class="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 rounded-t-xl">
          <div class="flex items-center justify-between">
            <h2 id="rule-builder-title" class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ isEditing ? t('notifications.ruleEditHeading') : t('notifications.ruleCreateHeading') }}
            </h2>
            <button
              @click="$emit('close')"
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              :aria-label="t('common.closePanel')"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <!-- Progress Steps -->
          <div class="mt-4 flex items-center justify-between">
            <div
              v-for="(step, index) in steps"
              :key="step.id"
              class="flex items-center flex-1"
            >
              <div class="flex items-center">
                <button
                  @click="currentStep >= index ? goToStep(index) : null"
                  :disabled="currentStep < index"
                  :class="[
                    'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors',
                    currentStep === index
                      ? 'bg-indigo-600 text-white'
                      : currentStep > index
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
                    currentStep >= index ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'
                  ]"
                  :aria-label="t('notifications.ruleStepAria', { index: index + 1, step: step.label })"
                >
                  <svg v-if="currentStep > index" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  <span v-else>{{ index + 1 }}</span>
                </button>
                <span
                  :class="[
                    'ml-2 text-xs font-medium hidden sm:block',
                    currentStep === index
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : currentStep > index
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-500 dark:text-gray-400'
                  ]"
                >
                  {{ step.label }}
                </span>
              </div>
              <div
                v-if="index < steps.length - 1"
                :class="[
                  'flex-1 h-0.5 mx-2 sm:mx-4',
                  currentStep > index ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
                ]"
              ></div>
            </div>
          </div>
        </div>

        <!-- Content -->
        <div class="px-4 sm:px-6 py-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
          <!-- Step 1: Select Module -->
          <div v-if="currentStep === 0" class="space-y-4">
            <div>
              <label for="module-select" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('notifications.ruleModule') }} <span class="text-red-500">*</span>
              </label>
              <select
                id="module-select"
                v-model="form.moduleKey"
                @change="handleModuleChange"
                class="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
                aria-required="true"
                aria-describedby="module-help"
              >
                <option value="">{{ t('notifications.ruleSelectModule') }}</option>
                <option
                  v-for="module in eligibleModules"
                  :key="module.key"
                  :value="module.key"
                >
                  {{ module.name }}
                </option>
              </select>
              <p id="module-help" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t('notifications.ruleModuleHint') }}
              </p>
              <p v-if="moduleLimitReached" class="mt-2 text-sm text-amber-600 dark:text-amber-400">
                {{ t('notifications.ruleMaxReached') }}
              </p>
            </div>
          </div>

          <!-- Step 2: Select Event -->
          <div v-if="currentStep === 1" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                {{ t('notifications.ruleEventType') }} <span class="text-red-500">*</span>
              </label>
              <div class="space-y-2">
                <label
                  v-for="eventType in supportedEvents"
                  :key="eventType"
                  class="flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors"
                  :class="
                    form.eventType === eventType
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  "
                >
                  <input
                    type="radio"
                    :value="eventType"
                    v-model="form.eventType"
                    class="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    :aria-label="t('notifications.ruleSelectEvent', { event: formatEventType(eventType) })"
                  />
                  <div class="ml-3 flex-1">
                    <div class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ formatEventType(eventType) }}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {{ getEventDescription(eventType) }}
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- Step 3: Conditions -->
          <div v-if="currentStep === 2" class="space-y-4">
            <div>
              <div class="flex items-center justify-between mb-3">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('notifications.ruleConditionsOptional') }}
                </label>
                <button
                  v-if="supportedConditions.length > 0 && form.conditions.length < supportedConditions.length"
                  @click="addCondition"
                  type="button"
                  class="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                >
                  {{ t('notifications.ruleAddCondition') }}
                </button>
              </div>
              
              <div v-if="form.conditions.length === 0" class="text-sm text-gray-500 dark:text-gray-400 py-4 text-center border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                {{ t('notifications.ruleNoConditions', {
                  module: selectedModule?.name || t('notifications.ruleModule').toLowerCase(),
                  event: form.eventType?.toLowerCase().replace('_', ' ') || ''
                }) }}
              </div>

              <div v-else class="space-y-3">
                <div
                  v-for="(condition, index) in form.conditions"
                  :key="index"
                  class="flex flex-col sm:flex-row gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <select
                    v-model="condition.field"
                    @change="handleConditionFieldChange(index)"
                    class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">{{ t('notifications.ruleSelectCondition') }}</option>
                    <option
                      v-for="field in getAvailableConditionFields(index)"
                      :key="field"
                      :value="field"
                    >
                      {{ formatConditionField(field) }}
                    </option>
                  </select>
                  
                  <component
                    :is="getConditionInputComponent(condition.field)"
                    v-if="condition.field"
                    :condition="condition"
                    :module="selectedModule"
                    @update="updateCondition(index, $event)"
                  />
                  
                  <button
                    @click="removeCondition(index)"
                    type="button"
                    class="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                    :aria-label="t('notifications.ruleRemoveCondition', { index: index + 1 })"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 4: Channels -->
          <div v-if="currentStep === 3" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                {{ t('notifications.ruleChannels') }} <span class="text-red-500">*</span>
              </label>
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {{ t('notifications.ruleChannelsHint') }}
              </p>
              
              <div class="space-y-3">
                <ChannelOption
                  v-for="channel in availableChannels"
                  :key="channel.key"
                  :channel="channel"
                  :checked="form.channels[channel.key]"
                  :disabled="!channel.available"
                  @update="form.channels[channel.key] = $event"
                />
              </div>
              
              <p v-if="!hasAnyChannelSelected" class="mt-3 text-sm text-amber-600 dark:text-amber-400">
                {{ t('notifications.ruleChannelsRequired') }}
              </p>
            </div>
          </div>

          <!-- Step 5: Review -->
          <div v-if="currentStep === 4" class="space-y-4">
            <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                {{ t('notifications.ruleSummary') }}
              </h3>
              <div class="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                <div class="flex items-start">
                  <span class="font-medium w-24 flex-shrink-0">{{ t('notifications.ruleWhen') }}</span>
                  <span>{{ formatRuleSentence() }}</span>
                </div>
                <div class="flex items-start">
                  <span class="font-medium w-24 flex-shrink-0">{{ t('notifications.ruleNotifyVia') }}</span>
                  <span>{{ formatChannels() }}</span>
                </div>
              </div>
            </div>
            
            <div v-if="validationErrors.length > 0" class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
              <div class="flex">
                <svg class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
                <div class="ml-3">
                  <h4 class="text-sm font-medium text-red-800 dark:text-red-200">{{ t('notifications.ruleFixIssues') }}</h4>
                  <ul class="mt-2 text-sm text-red-700 dark:text-red-300 list-disc list-inside">
                    <li v-for="error in validationErrors" :key="error">{{ error }}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 rounded-b-xl">
          <div class="flex flex-col sm:flex-row justify-between gap-3">
            <button
              @click="handleBack"
              v-if="currentStep > 0"
              type="button"
              class="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors min-h-[44px]"
            >
              {{ t('actions.back') }}
            </button>
            <div v-else></div>
            
            <div class="flex gap-3">
              <button
                @click="$emit('close')"
                type="button"
                class="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors min-h-[44px]"
              >
                {{ t('actions.cancel') }}
              </button>
              <button
                @click="handleNext"
                v-if="currentStep < steps.length - 1"
                type="button"
                :disabled="!canProceed"
                class="px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] flex items-center justify-center"
              >
                {{ t('actions.next') }}
                <svg class="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                @click="handleSave"
                v-else
                type="button"
                :disabled="saving || !canSave"
                class="px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] flex items-center justify-center"
              >
                <span v-if="saving" class="flex items-center">
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ t('states.saving') }}
                </span>
                <span v-else>{{ isEditing ? t('notifications.ruleUpdate') : t('notifications.ruleCreate') }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useNotificationRules } from '@/composables/useNotificationRules';

const { t } = useI18n();
import ChannelOption from './ChannelOption.vue';
import ConditionInput from './ConditionInput.vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  rule: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'saved']);

const rulesComposable = useNotificationRules();
const {
  createRule: apiCreateRule,
  updateRule: apiUpdateRule,
  getEligibleModules,
  channelAvailability
} = rulesComposable;

const getRuleLimits = () => rulesComposable.getRuleLimits();

// Step management
const steps = computed(() => [
  { id: 'module', label: t('notifications.ruleStepModule') },
  { id: 'event', label: t('notifications.ruleStepEvent') },
  { id: 'conditions', label: t('notifications.ruleStepConditions') },
  { id: 'channels', label: t('notifications.ruleStepChannels') },
  { id: 'review', label: t('notifications.ruleStepReview') }
]);

const currentStep = ref(0);
const saving = ref(false);
const eligibleModules = ref([]);
const selectedModule = ref(null);

// Form state
const form = ref({
  moduleKey: '',
  eventType: '',
  conditions: [],
  channels: {
    inApp: true,
    email: true,
    push: false,
    whatsapp: false,
    sms: false
  }
});

const isEditing = computed(() => !!props.rule);

// Computed properties
const supportedEvents = computed(() => {
  return selectedModule.value?.notifications?.supportedEvents || [];
});

const supportedConditions = computed(() => {
  return selectedModule.value?.notifications?.supportedConditions || [];
});

const availableChannels = computed(() => {
  const avail = channelAvailability.value;
  return [
    { key: 'inApp', label: t('notifications.channelInApp'), available: avail.inApp },
    { key: 'email', label: t('notifications.channelEmail'), available: avail.email },
    { key: 'push', label: t('notifications.channelPush'), available: avail.push },
    { key: 'whatsapp', label: t('notifications.channelWhatsApp'), available: avail.whatsapp },
    { key: 'sms', label: 'SMS', available: avail.sms }
  ];
});

const hasAnyChannelSelected = computed(() => {
  return Object.values(form.value.channels).some(val => val === true);
});

const moduleLimitReached = computed(() => {
  if (!form.value.moduleKey) return false;
  const limits = getRuleLimits();
  const count = limits.byModule[form.value.moduleKey] || 0;
  // When editing, don't count the current rule
  if (isEditing.value && props.rule?.moduleKey === form.value.moduleKey) {
    return count - 1 >= limits.maxPerModule;
  }
  return count >= limits.maxPerModule;
});

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 0:
      return !!form.value.moduleKey;
    case 1:
      return !!form.value.eventType;
    case 2:
      return true; // Conditions are optional
    case 3:
      return hasAnyChannelSelected.value;
    default:
      return true;
  }
});

const canSave = computed(() => {
  return canProceed.value && validationErrors.value.length === 0;
});

const validationErrors = computed(() => {
  const errors = [];

  if (!form.value.moduleKey) {
    errors.push(t('notifications.ruleErrorModuleRequired'));
  }

  if (!form.value.eventType) {
    errors.push(t('notifications.ruleErrorEventRequired'));
  }

  if (!hasAnyChannelSelected.value) {
    errors.push(t('notifications.ruleErrorChannelRequired'));
  }

  form.value.conditions.forEach((condition, index) => {
    if (!condition.field) {
      errors.push(t('notifications.ruleErrorConditionField', { index: index + 1 }));
    }
  });

  return errors;
});

// Methods
async function loadEligibleModules() {
  eligibleModules.value = await getEligibleModules();
}

function handleModuleChange() {
  selectedModule.value = eligibleModules.value.find(m => m.key === form.value.moduleKey);
  // Reset event type when module changes
  form.value.eventType = '';
  form.value.conditions = [];
}

function handleConditionFieldChange(index) {
  // Reset condition value when field changes
  form.value.conditions[index].value = undefined;
}

function addCondition() {
  const availableFields = getAvailableConditionFields(form.value.conditions.length);
  if (availableFields.length > 0) {
    form.value.conditions.push({
      field: availableFields[0],
      value: undefined
    });
  }
}

function removeCondition(index) {
  form.value.conditions.splice(index, 1);
}

function getAvailableConditionFields(excludeIndex) {
  const used = form.value.conditions
    .map((c, i) => i !== excludeIndex ? c.field : null)
    .filter(Boolean);
  return supportedConditions.value.filter(field => !used.includes(field));
}

function updateCondition(index, updates) {
  form.value.conditions[index] = { ...form.value.conditions[index], ...updates };
}

function getConditionInputComponent(field) {
  return ConditionInput;
}

function formatConditionField(field) {
  const map = {
    assignedTo: 'Assigned To',
    priority: 'Priority',
    status: 'Status'
  };
  return map[field] || field;
}

function formatEventType(eventType) {
  return eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getEventDescription(eventType) {
  const map = {
    ASSIGNED: 'Triggered when an item is assigned to someone',
    CREATED: 'Triggered when a new item is created',
    STATUS_CHANGED: 'Triggered when the status of an item changes',
    DUE_SOON: 'Triggered when an item is approaching its due date'
  };
  return map[eventType] || '';
}

function formatChannels() {
  const selected = availableChannels.value
    .filter(ch => form.value.channels[ch.key])
    .map(ch => ch.label);
  return selected.length > 0 ? selected.join(', ') : 'None selected';
}

function formatRuleSentence() {
  if (!selectedModule.value || !form.value.eventType) {
    return 'Please complete all steps';
  }
  
  let sentence = `When a ${selectedModule.value.name}`;
  
  sentence += ` ${form.value.eventType.toLowerCase().replace(/_/g, ' ')}`;
  
  if (form.value.conditions.length > 0) {
    sentence += ' and ';
    const conditions = form.value.conditions
      .filter(c => c.field && c.value !== undefined)
      .map(c => {
        if (c.field === 'assignedTo') {
          return c.value === 'ME' ? 'assigned to me' : 'assigned to anyone';
        }
        if (c.field === 'priority') {
          return Array.isArray(c.value) ? `priority is ${c.value.join(' or ')}` : `priority is ${c.value}`;
        }
        if (c.field === 'status') {
          return Array.isArray(c.value) ? `status is ${c.value.join(' or ')}` : `status is ${c.value}`;
        }
        return `${c.field} is ${c.value}`;
      });
    sentence += conditions.join(' and ');
  }
  
  return sentence;
}

function goToStep(stepIndex) {
  if (stepIndex >= 0 && stepIndex < steps.value.length) {
    currentStep.value = stepIndex;
  }
}

function handleNext() {
  if (canProceed.value && currentStep.value < steps.value.length - 1) {
    currentStep.value++;
  }
}

function handleBack() {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
}

async function handleSave() {
  if (!canSave.value) return;
  
  saving.value = true;
  
  try {
    const ruleData = {
      moduleKey: form.value.moduleKey,
      eventType: form.value.eventType,
      conditions: form.value.conditions.length > 0
        ? form.value.conditions.reduce((acc, cond) => {
            if (cond.field && cond.value !== undefined) {
              if (!acc[cond.field]) {
                acc[cond.field] = cond.field === 'assignedTo' ? cond.value : [];
              }
              if (cond.field !== 'assignedTo') {
                if (Array.isArray(cond.value)) {
                  acc[cond.field] = [...new Set([...acc[cond.field], ...cond.value])];
                } else {
                  if (!acc[cond.field].includes(cond.value)) {
                    acc[cond.field].push(cond.value);
                  }
                }
              }
            }
            return acc;
          }, {})
        : {},
      channels: form.value.channels
    };
    
    if (isEditing.value) {
      await apiUpdateRule(props.rule.id, ruleData);
    } else {
      await apiCreateRule(ruleData);
    }
    
    emit('saved');
    emit('close');
  } catch (error) {
    console.error('[RuleBuilderModal] Error saving rule:', error);
    // Error will be shown by the composable
  } finally {
    saving.value = false;
  }
}

// Initialize form from rule if editing
watch(() => props.rule, (rule) => {
  if (rule && props.isOpen) {
    form.value = {
      moduleKey: rule.moduleKey || '',
      eventType: rule.eventType || '',
      conditions: rule.conditions
        ? Object.entries(rule.conditions)
            .filter(([key, value]) => value !== undefined && value !== null)
            .map(([key, value]) => {
              if (key === 'assignedTo') {
                return { field: key, value };
              }
              // Convert arrays to individual conditions
              if (Array.isArray(value) && value.length > 0) {
                return { field: key, value };
              }
              return null;
            })
            .filter(Boolean)
        : [],
      channels: {
        inApp: rule.channels?.inApp ?? true,
        email: rule.channels?.email ?? true,
        push: rule.channels?.push ?? false,
        whatsapp: rule.channels?.whatsapp ?? false,
        sms: rule.channels?.sms ?? false
      }
    };
    
    // Load module metadata
    handleModuleChange();
  }
}, { immediate: true });

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    currentStep.value = 0;
    loadEligibleModules();
    
    if (!props.rule) {
      // Reset form for new rule
      form.value = {
        moduleKey: '',
        eventType: '',
        conditions: [],
        channels: {
          inApp: true,
          email: true,
          push: false,
          whatsapp: false,
          sms: false
        }
      };
      selectedModule.value = null;
    }
  }
});

onMounted(() => {
  loadEligibleModules();
});
</script>

