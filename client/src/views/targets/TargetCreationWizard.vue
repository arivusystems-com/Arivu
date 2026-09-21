<template>
  <div class="min-h-full bg-gray-50 dark:bg-gray-900/50">
    <div class="max-w-2xl mx-auto py-8 px-4 sm:px-6">
      <button
        type="button"
        class="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
        @click="cancel"
      >
        <ArrowLeftIcon class="h-4 w-4" />
        {{ t('performance.cancelWizard') }}
      </button>

      <header class="mb-8">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('performance.wizardTitle') }}</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('performance.wizardSubtitle') }}</p>
      </header>

      <div class="mb-8">
        <p class="text-sm font-medium text-indigo-600 dark:text-indigo-400">
          {{ t('performance.wizardStepOf', { current: step + 1, total: stepItems.length }) }}
        </p>
        <div class="mt-3 flex gap-1" role="presentation">
          <div
            v-for="(_, i) in stepItems"
            :key="i"
            class="h-1.5 flex-1 rounded-full transition-colors duration-300"
            :class="i <= step ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'"
          />
        </div>
        <h2 class="mt-5 text-lg font-semibold text-gray-900 dark:text-white">{{ stepItems[step]?.label }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ stepItems[step]?.hint }}</p>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6 sm:p-8">
        <!-- Type -->
        <div v-if="step === 0" class="grid gap-3 sm:grid-cols-2">
          <button
            v-for="type in targetTypes"
            :key="type.key"
            type="button"
            class="rounded-xl border-2 p-4 text-left transition-all"
            :class="form.targetTypeKey === type.key
              ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-600'
              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'"
            @click="selectType(type)"
          >
            <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ type.name }}</span>
            <p v-if="type.description" class="mt-1 text-xs text-gray-500">{{ type.description }}</p>
          </button>
        </div>

        <!-- Modules -->
        <div v-else-if="step === 1" class="flex flex-wrap gap-2">
          <button
            v-for="mod in suggestedModules"
            :key="`${mod.appKey}-${mod.moduleKey}`"
            type="button"
            class="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
            :class="isModuleSelected(mod)
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-400'"
            @click="toggleModule(mod)"
          >
            {{ moduleLabel(mod) }}
          </button>
        </div>

        <!-- Rules -->
        <div v-else-if="step === 2" class="rounded-xl bg-gray-50 dark:bg-gray-900/50 p-4 text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <p v-for="mod in parseModules()" :key="`${mod.appKey}-${mod.moduleKey}`">
            <span class="font-medium text-gray-900 dark:text-white">{{ moduleLabel(mod) }}</span>
            — {{ ruleSummary(mod) }}
          </p>
        </div>

        <!-- Value -->
        <div v-else-if="step === 3" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('performance.targetNameLabel') }}</label>
            <input
              v-model="form.name"
              type="text"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2.5 text-sm"
              :placeholder="t('performance.targetNamePlaceholder')"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('performance.targetValueLabel') }}</label>
            <input
              v-model.number="form.targetValue"
              type="number"
              min="0"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2.5 text-sm tabular-nums"
            />
          </div>
        </div>

        <!-- Period -->
        <div v-else-if="step === 4" class="space-y-4">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="preset in periodPresets"
              :key="preset.id"
              type="button"
              class="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
              :class="periodPreset === preset.id
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'"
              @click="applyPeriodPreset(preset.id)"
            >
              {{ preset.label }}
            </button>
          </div>

          <div v-if="periodPreset === 'month'" class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('performance.periodYearLabel') }}</label>
              <select
                v-model.number="periodYear"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm"
                @change="syncPeriodFromSelection"
              >
                <option v-for="y in periodYearOptions" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('performance.periodMonthLabel') }}</label>
              <select
                v-model.number="periodMonth"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm"
                @change="syncPeriodFromSelection"
              >
                <option v-for="(label, idx) in monthLabels" :key="idx" :value="idx">{{ label }}</option>
              </select>
            </div>
          </div>

          <div v-else-if="periodPreset === 'quarter'" class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('performance.periodYearLabel') }}</label>
              <select
                v-model.number="periodYear"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm"
                @change="syncPeriodFromSelection"
              >
                <option v-for="y in periodYearOptions" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                v-for="q in 4"
                :key="q"
                type="button"
                class="rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors"
                :class="selectedQuarter === q
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-400'"
                @click="selectQuarter(q)"
              >
                {{ t('performance.periodQuarterOptionRange', {
                  quarter: q,
                  range: getQuarterMonthLabels(q, fiscalYearStartMonth),
                }) }}
              </button>
            </div>
          </div>

          <div v-else class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('performance.periodStartLabel') }}</label>
              <DatePicker
                v-model="form.periodStart"
                input-class="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('performance.periodEndLabel') }}</label>
              <DatePicker
                v-model="form.periodEnd"
                input-class="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <p
            v-if="periodPreset !== 'custom' && form.periodStart && form.periodEnd"
            class="rounded-lg bg-gray-50 dark:bg-gray-900/50 px-3 py-2 text-sm text-gray-600 dark:text-gray-400"
          >
            {{ t('performance.periodRangeSummary', { range: formatPeriodRange(form.periodStart, form.periodEnd) }) }}
          </p>
        </div>

        <!-- Distribution -->
        <div v-else-if="step === 5" class="grid gap-3 sm:grid-cols-2">
          <button
            v-for="opt in distributionOptions"
            :key="opt.value"
            type="button"
            class="rounded-xl border-2 p-4 text-left transition-all"
            :class="form.distributionType === opt.value
              ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'"
            @click="form.distributionType = opt.value"
          >
            <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ opt.label }}</span>
            <p class="mt-1 text-xs text-gray-500">{{ opt.desc }}</p>
          </button>
        </div>

        <!-- Assign -->
        <div v-else-if="step === 6" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('performance.ownerLabel') }}</label>
            <select
              v-model="assignedTo"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2.5 text-sm"
              :disabled="loadingUsers"
            >
              <option value="">{{ t('performance.ownerSelectPlaceholder') }}</option>
              <option v-for="u in orgUsers" :key="u._id" :value="String(u._id)">
                {{ userDisplayName(u) }}{{ String(u._id) === String(authStore.user?._id) ? ` (${t('performance.ownerMeSuffix')})` : '' }}
              </option>
            </select>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('performance.wizardStepAssignHint') }}</p>
        </div>

        <!-- Quotas -->
        <div v-else-if="step === 7" class="space-y-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('performance.quotasSoloHint') }}</p>
          <div class="space-y-3">
            <div
              v-for="(row, idx) in quotaRows"
              :key="row.userId"
              class="rounded-xl border border-gray-200 dark:border-gray-600 p-4 space-y-3"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ userDisplayName(usersById[row.userId]) }}</span>
                <button
                  v-if="quotaRows.length > 1"
                  type="button"
                  class="text-xs text-red-600 hover:text-red-500"
                  @click="removeQuotaRow(idx)"
                >
                  {{ t('actions.remove') }}
                </button>
              </div>
              <div v-if="form.distributionType === 'weighted'" class="max-w-xs">
                <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('performance.quotasWeightLabel') }}</label>
                <input
                  v-model.number="row.weight"
                  type="number"
                  min="0.1"
                  step="0.1"
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div v-else-if="form.distributionType === 'manual'" class="max-w-xs">
                <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('performance.quotasAmountLabel') }}</label>
                <input
                  v-model.number="row.allocatedValue"
                  type="number"
                  min="0"
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div v-else-if="form.distributionType === 'capacity'" class="max-w-xs">
                <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('performance.quotasCapacityLabel') }}</label>
                <input
                  v-model.number="row.capacity"
                  type="number"
                  min="0"
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <p v-else-if="form.distributionType === 'equal'" class="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                {{ formatTargetValue(quotaPreviewForRow(row), form.metricKind) }}
              </p>
            </div>
          </div>
          <div v-if="availableQuotaUsers.length" class="flex flex-wrap gap-2">
            <select
              v-model="quotaUserToAdd"
              class="flex-1 min-w-[12rem] rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm"
            >
              <option value="">{{ t('performance.quotasSelectMember') }}</option>
              <option v-for="u in availableQuotaUsers" :key="u._id" :value="u._id">
                {{ userDisplayName(u) }}
              </option>
            </select>
            <button
              type="button"
              class="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 disabled:opacity-40"
              :disabled="!quotaUserToAdd"
              @click="addQuotaMember"
            >
              {{ t('performance.quotasAddMember') }}
            </button>
          </div>
          <p
            v-if="form.distributionType === 'equal' && quotaRows.length"
            class="text-sm text-gray-600 dark:text-gray-400"
          >
            {{ t('performance.quotasPreviewEqual', {
              amount: formatTargetValue(quotaPreviewForRow(), form.metricKind),
              count: quotaRows.length,
            }) }}
          </p>
        </div>

        <!-- Thresholds -->
        <div v-else-if="step === 8" class="space-y-2">
          <label
            v-for="th in thresholdOptions"
            :key="th.percent"
            class="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-600 p-4 hover:bg-gray-50 dark:hover:bg-gray-900/30"
          >
            <input v-model="thresholdPercents" type="checkbox" :value="th.percent" class="rounded border-gray-300 text-indigo-600" />
            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ th.label }}</span>
          </label>
        </div>

        <!-- Forecast -->
        <div v-else-if="step === 9">
          <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-600 p-4">
            <input v-model="form.forecastRules.enabled" type="checkbox" class="mt-0.5 rounded border-gray-300 text-indigo-600" />
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('performance.forecastEnable') }}</span>
          </label>
        </div>

        <!-- Review -->
        <div v-else class="space-y-4">
          <dl class="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
            <div class="flex justify-between py-3 gap-4">
              <dt class="text-gray-500">{{ t('performance.targetNameLabel') }}</dt>
              <dd class="font-medium text-gray-900 dark:text-white text-right">{{ form.name || '—' }}</dd>
            </div>
            <div class="flex justify-between py-3 gap-4">
              <dt class="text-gray-500">{{ t('performance.targetValueLabel') }}</dt>
              <dd class="font-medium tabular-nums text-right">{{ form.targetValue }}</dd>
            </div>
            <div class="flex justify-between py-3 gap-4">
              <dt class="text-gray-500">{{ t('performance.periodLabel') }}</dt>
              <dd class="text-right text-gray-900 dark:text-white">{{ formatPeriodRange(form.periodStart, form.periodEnd) }}</dd>
            </div>
            <div class="flex justify-between py-3 gap-4">
              <dt class="text-gray-500">{{ t('performance.reviewOwner') }}</dt>
              <dd class="text-right text-gray-900 dark:text-white">{{ userDisplayName(usersById[assignedTo]) || '—' }}</dd>
            </div>
            <div class="flex justify-between py-3 gap-4">
              <dt class="text-gray-500">{{ t('performance.reviewTeamSize') }}</dt>
              <dd class="text-right text-gray-900 dark:text-white">{{ quotaRows.length }}</dd>
            </div>
            <div class="flex justify-between py-3 gap-4">
              <dt class="text-gray-500">{{ t('performance.wizardStepModules') }}</dt>
              <dd class="text-right text-gray-900 dark:text-white">{{ selectedModuleKeys.length }}</dd>
            </div>
          </dl>
          <div
            v-if="conflicts.length"
            class="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200"
          >
            {{ t('performance.conflictWarning') }}
          </div>
        </div>

        <p v-if="error" class="mt-4 rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {{ error }}
        </p>
      </div>

      <div class="mt-8 flex items-center justify-between gap-4">
        <button
          type="button"
          class="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
          :disabled="step === 0 || saving"
          @click="step--"
        >
          {{ t('performance.back') }}
        </button>
        <button
          v-if="step < stepItems.length - 1"
          type="button"
          class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          :disabled="!canContinue"
          @click="nextStep"
        >
          {{ t('performance.next') }}
        </button>
        <button
          v-else
          type="button"
          class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          :disabled="saving || !canActivate"
          @click="submit"
        >
          <span v-if="saving" class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          {{ t('performance.activateTarget') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowLeftIcon } from '@heroicons/vue/24/outline';
import DatePicker from '@/components/common/DatePicker.vue';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import {
  APP_LABELS,
  MODULE_LABELS,
  formatPeriodRange,
  formatTargetValue,
  getMonthRange,
  getQuarterRange,
  getQuarterMonthLabels,
  currentFiscalQuarter,
  currentFiscalYear,
} from '@/utils/targetDisplayUtils';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const fiscalYearStartMonth = ref(
  Number(authStore.organization?.settings?.fiscalYearStartMonth)
  || Number(authStore.organization?.settings?.analytics?.fiscalYearStartMonth)
  || 1
);

const stepItems = computed(() => [
  { id: 'type', label: t('performance.wizardStepType'), hint: t('performance.wizardStepTypeHint') },
  { id: 'modules', label: t('performance.wizardStepModules'), hint: t('performance.wizardStepModulesHint') },
  { id: 'rules', label: t('performance.wizardStepRules'), hint: t('performance.wizardStepRulesHint') },
  { id: 'value', label: t('performance.wizardStepValue'), hint: t('performance.wizardStepValueHint') },
  { id: 'period', label: t('performance.wizardStepPeriod'), hint: t('performance.wizardStepPeriodHint') },
  { id: 'distribution', label: t('performance.wizardStepDistribution'), hint: t('performance.wizardStepDistributionHint') },
  { id: 'assign', label: t('performance.wizardStepAssign'), hint: t('performance.wizardStepAssignHint') },
  { id: 'quotas', label: t('performance.wizardStepQuotas'), hint: t('performance.wizardStepQuotasHint') },
  { id: 'thresholds', label: t('performance.wizardStepThresholds'), hint: t('performance.wizardStepThresholdsHint') },
  { id: 'forecast', label: t('performance.wizardStepForecast'), hint: t('performance.wizardStepForecastHint') },
  { id: 'review', label: t('performance.wizardStepReview'), hint: t('performance.wizardStepReviewHint') },
]);

const distributionOptions = computed(() => [
  { value: 'equal', label: t('performance.distributionEqual'), desc: t('performance.distributionEqualDesc') },
  { value: 'weighted', label: t('performance.distributionWeighted'), desc: t('performance.distributionWeightedDesc') },
  { value: 'manual', label: t('performance.distributionManual'), desc: t('performance.distributionManualDesc') },
  { value: 'capacity', label: t('performance.distributionCapacity'), desc: t('performance.distributionCapacityDesc') },
]);

const thresholdOptions = computed(() => [
  { percent: 80, label: t('performance.threshold80') },
  { percent: 100, label: t('performance.threshold100') },
  { percent: 120, label: t('performance.threshold120') },
]);

const periodPresets = computed(() => [
  { id: 'month', label: t('performance.periodThisMonth') },
  { id: 'quarter', label: t('performance.periodThisQuarter') },
  { id: 'custom', label: t('performance.periodCustom') },
]);

const step = ref(0);
const targetTypes = ref([]);
const conflicts = ref([]);
const saving = ref(false);
const error = ref(null);
const thresholdPercents = ref([80, 100]);
const selectedModuleKeys = ref([]);
const periodPreset = ref('quarter');
const periodYear = ref(new Date().getFullYear());
const periodMonth = ref(new Date().getMonth());
const selectedQuarter = ref(currentFiscalQuarter(new Date(), fiscalYearStartMonth.value));
const assignedTo = ref('');
const orgUsers = ref([]);
const loadingUsers = ref(false);
const quotaRows = ref([]);
const quotaUserToAdd = ref('');

const form = ref({
  name: '',
  targetTypeKey: 'revenue',
  targetValue: 10000,
  metricKind: 'currency',
  distributionType: 'equal',
  periodStart: '',
  periodEnd: '',
  forecastRules: { enabled: false, includePipeline: true, historicalWeight: 1 },
});

const suggestedModules = computed(() => {
  const type = targetTypes.value.find((x) => x.key === form.value.targetTypeKey);
  return type?.defaultSourceModules || [];
});

const periodYearOptions = computed(() => {
  const y = currentFiscalYear(new Date(), fiscalYearStartMonth.value);
  return [y - 1, y, y + 1];
});

const monthLabels = computed(() => {
  const fmt = new Intl.DateTimeFormat(undefined, { month: 'long' });
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2000, i, 1)));
});

const usersById = computed(() => {
  const map = {};
  for (const u of orgUsers.value) {
    if (u?._id) map[u._id] = u;
  }
  return map;
});

const availableQuotaUsers = computed(() => {
  const assigned = new Set(quotaRows.value.map((r) => r.userId));
  return orgUsers.value.filter((u) => u._id && !assigned.has(u._id));
});

const canContinue = computed(() => {
  if (step.value === 1) return selectedModuleKeys.value.length > 0;
  if (step.value === 3) return form.value.name?.trim() && form.value.targetValue > 0;
  if (step.value === 4) return form.value.periodStart && form.value.periodEnd;
  if (step.value === 6) return Boolean(assignedTo.value);
  if (step.value === 7) return quotaRows.value.length > 0;
  return true;
});

const canActivate = computed(() => form.value.name?.trim() && form.value.targetValue > 0 && selectedModuleKeys.value.length);

watch(
  () => form.value.targetTypeKey,
  () => {
    const type = targetTypes.value.find((x) => x.key === form.value.targetTypeKey);
    if (type) form.value.metricKind = type.metricKind;
    selectedModuleKeys.value = suggestedModules.value.map((m) => `${m.appKey}:${m.moduleKey}`);
    if (!form.value.name && type?.name) {
      form.value.name = `${type.name} — ${new Date().getFullYear()}`;
    }
  }
);

function moduleLabel(mod) {
  return `${APP_LABELS[mod.appKey] || mod.appKey} · ${MODULE_LABELS[mod.moduleKey] || mod.moduleKey}`;
}

function ruleSummary(mod) {
  if (mod.moduleKey === 'deals') return 'Won deals count toward goal';
  if (mod.moduleKey === 'cases') return 'Resolved cases count toward goal';
  if (mod.moduleKey === 'tasks') return 'Completed tasks count toward goal';
  return 'Matching records count toward goal';
}

function isModuleSelected(mod) {
  return selectedModuleKeys.value.includes(`${mod.appKey}:${mod.moduleKey}`);
}

function toggleModule(mod) {
  const key = `${mod.appKey}:${mod.moduleKey}`;
  if (isModuleSelected(mod)) {
    selectedModuleKeys.value = selectedModuleKeys.value.filter((k) => k !== key);
  } else {
    selectedModuleKeys.value = [...selectedModuleKeys.value, key];
  }
}

function selectType(type) {
  form.value.targetTypeKey = type.key;
}

function parseModules() {
  return selectedModuleKeys.value.map((key) => {
    const [appKey, moduleKey] = key.split(':');
    return { appKey, moduleKey };
  });
}

function applyPeriodPreset(id) {
  periodPreset.value = id;
  const now = new Date();
  if (id === 'month') {
    periodYear.value = now.getFullYear();
    periodMonth.value = now.getMonth();
    syncPeriodFromSelection();
  } else if (id === 'quarter') {
    periodYear.value = currentFiscalYear(now, fiscalYearStartMonth.value);
    selectedQuarter.value = currentFiscalQuarter(now, fiscalYearStartMonth.value);
    syncPeriodFromSelection();
  }
}

function syncPeriodFromSelection() {
  if (periodPreset.value === 'month') {
    const { start, end } = getMonthRange(periodYear.value, periodMonth.value);
    form.value.periodStart = start;
    form.value.periodEnd = end;
  } else if (periodPreset.value === 'quarter') {
    const { start, end } = getQuarterRange(
      periodYear.value,
      selectedQuarter.value,
      fiscalYearStartMonth.value
    );
    form.value.periodStart = start;
    form.value.periodEnd = end;
  }
}

function selectQuarter(q) {
  selectedQuarter.value = q;
  syncPeriodFromSelection();
}

function userDisplayName(user) {
  if (!user) return '—';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || user._id;
}

function defaultQuotaRow(userId) {
  return {
    userId,
    weight: 1,
    allocatedValue: form.value.targetValue,
    capacity: form.value.targetValue,
  };
}

function ensureOwnerInQuotas() {
  if (!assignedTo.value) return;
  const owner = String(assignedTo.value);
  if (!quotaRows.value.some((r) => String(r.userId) === owner)) {
    quotaRows.value = [defaultQuotaRow(owner), ...quotaRows.value];
  }
}

function addQuotaMember() {
  if (!quotaUserToAdd.value) return;
  quotaRows.value = [...quotaRows.value, defaultQuotaRow(quotaUserToAdd.value)];
  quotaUserToAdd.value = '';
}

function removeQuotaRow(idx) {
  quotaRows.value = quotaRows.value.filter((_, i) => i !== idx);
}

function quotaPreviewForRow(row) {
  const total = Number(form.value.targetValue) || 0;
  const n = quotaRows.value.length || 1;
  if (form.value.distributionType === 'equal') {
    return total / n;
  }
  if (form.value.distributionType === 'weighted' && row) {
    const sum = quotaRows.value.reduce((s, r) => s + (r.weight || 1), 0) || 1;
    return (total * (row.weight || 1)) / sum;
  }
  if (form.value.distributionType === 'manual' && row) {
    return row.allocatedValue ?? 0;
  }
  if (form.value.distributionType === 'capacity' && row) {
    return row.capacity ?? 0;
  }
  return total / n;
}

function buildAssigneesPayload() {
  return quotaRows.value.map((row) => ({
    userId: row.userId,
    weight: row.weight ?? 1,
    allocatedValue: row.allocatedValue,
    capacity: row.capacity,
  }));
}

async function loadOrgUsers() {
  loadingUsers.value = true;
  try {
    const res = await apiClient.get('/users/list');
    orgUsers.value = res?.success && Array.isArray(res.data) ? res.data : [];
  } catch {
    orgUsers.value = authStore.user ? [authStore.user] : [];
  } finally {
    loadingUsers.value = false;
  }
}

async function nextStep() {
  error.value = null;
  if (step.value === 4) {
    try {
      const res = await apiClient.post('/targets/conflicts/check', {
        assignedTo: assignedTo.value || authStore.user?._id,
        periodStart: form.value.periodStart,
        periodEnd: form.value.periodEnd,
        sourceModules: parseModules(),
      });
      conflicts.value = res?.data || [];
    } catch {
      conflicts.value = [];
    }
  }
  if (step.value === 6) {
    ensureOwnerInQuotas();
  }
  step.value += 1;
}

async function submit() {
  saving.value = true;
  error.value = null;
  try {
    const thresholds = thresholdPercents.value.map((percent) => ({ percent, notify: true }));
    const createRes = await apiClient.post('/targets', {
      ...form.value,
      assignedTo: assignedTo.value || authStore.user?._id,
      sourceModules: parseModules(),
      thresholds,
      periodStart: new Date(form.value.periodStart).toISOString(),
      periodEnd: new Date(form.value.periodEnd).toISOString(),
    });
    const id = createRes?.data?._id;
    await apiClient.post(`/targets/${id}/activate`, {
      overrideConflicts: conflicts.value.length > 0,
      assignees: buildAssigneesPayload(),
    });
    router.replace(`/targets/${id}`);
  } catch (e) {
    error.value = e?.message || e?.data?.message || 'Failed to create target';
  } finally {
    saving.value = false;
  }
}

function cancel() {
  router.push('/settings?tab=performance&view=targets');
}

watch(assignedTo, (id) => {
  if (!id) return;
  const owner = String(id);
  const existing = quotaRows.value.find((r) => String(r.userId) === owner);
  if (!existing && quotaRows.value.length === 0) {
    quotaRows.value = [defaultQuotaRow(owner)];
  }
});

onMounted(async () => {
  assignedTo.value = authStore.user?._id ? String(authStore.user._id) : '';
  try {
    const orgRes = await apiClient('/settings/organization', { method: 'GET', cache: 'no-store' });
    const month = Number(orgRes?.data?.fiscalYearStartMonth);
    if (Number.isFinite(month) && month >= 1 && month <= 12) {
      fiscalYearStartMonth.value = month;
      if (authStore.organization) {
        authStore.organization = {
          ...authStore.organization,
          settings: {
            ...(authStore.organization.settings || {}),
            fiscalYearStartMonth: month,
          },
        };
      }
    }
  } catch (e) {
    console.warn('[TargetCreationWizard] failed to load fiscal year start month', e?.message || e);
  }
  await loadOrgUsers();
  applyPeriodPreset('quarter');
  if (assignedTo.value) {
    quotaRows.value = [defaultQuotaRow(assignedTo.value)];
  }
  const res = await apiClient.get('/targets/types');
  targetTypes.value = res?.data || [];
  if (targetTypes.value.length) {
    selectType(targetTypes.value[0]);
  }
});
</script>
