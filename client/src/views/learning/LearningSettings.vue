<template>
  <div class="mx-auto max-w-6xl">
    <LearningPageHeader :title="t('learning.settings')" :subtitle="t('learning.settingsBlurb')" />

    <div class="grid gap-4 lg:grid-cols-2">
      <section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {{ t('learning.planSection') }}
        </h2>
        <p class="mt-2 text-sm text-gray-500">
          {{ t('learning.settingsSeatHint') }}
        </p>

        <RadioGroup
          v-model="selectedPlanKey"
          class="mt-5 space-y-2"
          :disabled="!canManageBilling || savingPlan"
        >
          <RadioGroupOption
            v-for="plan in plans"
            :key="plan.planKey"
            v-slot="{ checked }"
            :value="plan.planKey"
            as="template"
          >
            <button
              type="button"
              class="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left"
              :class="checked
                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40'
                : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'"
            >
              <span>
                <span class="block text-sm font-semibold capitalize text-gray-900 dark:text-white">
                  {{ plan.planKey }}
                </span>
                <span class="text-xs text-gray-500">
                  {{ t('learning.planCapacity', { capacity: plan.capacity }) }}
                </span>
              </span>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ formatPaise(plan.monthlyPaise) }}
              </span>
            </button>
          </RadioGroupOption>
        </RadioGroup>

        <div class="mt-5 flex flex-wrap gap-2">
          <button
            v-if="canManageBilling"
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            :disabled="!selectedPlanKey || savingPlan || selectedPlanKey === currentPlanKey"
            @click="savePlan"
          >
            {{ savingPlan ? t('learning.savingPlan') : t('learning.savePlan') }}
          </button>
          <router-link
            to="/settings?tab=subscriptions"
            class="inline-flex rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {{ t('learning.openBilling') }}
          </router-link>
        </div>
        <p v-if="!canManageBilling" class="mt-3 text-xs text-amber-700 dark:text-amber-300">
          {{ t('learning.planAdminOnly') }}
        </p>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {{ t('learning.capacitySection') }}
        </h2>
        <div v-if="loading" class="mt-4 h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        <template v-else>
          <p class="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">
            {{ usage?.learnerSeatsUsed ?? 0 }}
            <span class="text-lg font-medium text-gray-400">/ {{ usage?.learnerSeatCapacity ?? 0 }}</span>
          </p>
          <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              class="h-full rounded-full bg-indigo-600"
              :style="{ width: `${seatPercent}%` }"
            />
          </div>
          <p class="mt-2 text-sm text-gray-500">
            {{ t('learning.seatUsage', { used: usage?.learnerSeatsUsed ?? 0, capacity: usage?.learnerSeatCapacity ?? 0 }) }}
          </p>
          <p v-if="currentPlanKey" class="mt-1 text-xs font-medium capitalize text-indigo-700 dark:text-indigo-300">
            {{ t('learning.currentPlan', { plan: currentPlanKey }) }}
          </p>
          <dl v-if="usage?.byAudience" class="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div
              v-for="key in audienceKeys"
              :key="key"
              class="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800"
            >
              <dt class="text-xs uppercase text-gray-500">{{ audienceLabel(key) }}</dt>
              <dd class="font-semibold text-gray-900 dark:text-white">
                {{ usage.byAudience[key] ?? 0 }}
              </dd>
            </div>
          </dl>
        </template>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:col-span-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {{ t('learning.academySettingsSection') }}
        </h2>
        <p class="mt-2 text-sm text-gray-500">{{ t('learning.academySettingsBlurb') }}</p>

        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input v-model="academyForm.enabled" type="checkbox" class="rounded border-gray-300">
            {{ t('learning.academyEnabled') }}
          </label>
          <label class="block text-sm">
            <span class="text-gray-500">{{ t('learning.academyName') }}</span>
            <input
              v-model="academyForm.name"
              type="text"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
            >
          </label>
          <label class="block text-sm">
            <span class="text-gray-500">{{ t('learning.academyPrimaryColor') }}</span>
            <input
              v-model="academyForm.primaryColor"
              type="color"
              class="mt-1 h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600"
            >
          </label>
          <label class="block text-sm">
            <span class="text-gray-500">{{ t('learning.academyCatalogVisibility') }}</span>
            <select
              v-model="academyForm.catalogVisibility"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
            >
              <option value="assigned">{{ t('learning.catalogAssigned') }}</option>
              <option value="audience">{{ t('learning.catalogAudience') }}</option>
              <option value="invite_only">{{ t('learning.catalogInviteOnly') }}</option>
            </select>
          </label>
        </div>
        <div class="mt-4 flex flex-wrap gap-3 text-sm">
          <label
            v-for="a in audienceLearnerKeys"
            :key="a"
            class="inline-flex items-center gap-2"
          >
            <input
              v-model="academyForm.allowedAudiences"
              type="checkbox"
              :value="a"
              class="rounded border-gray-300"
            >
            {{ audienceLabel(a) }}
          </label>
        </div>
        <button
          type="button"
          class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          :disabled="savingAcademy"
          @click="saveAcademy"
        >
          {{ savingAcademy ? t('learning.savingPlan') : t('learning.saveAcademySettings') }}
        </button>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:col-span-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {{ t('learning.academyLearnersSection') }}
        </h2>
        <p class="mt-2 text-sm text-gray-500">{{ t('learning.academyLearnersBlurb') }}</p>
        <div class="mt-4 flex flex-wrap items-end gap-2">
          <label class="block flex-1 text-sm min-w-[200px]">
            <span class="text-gray-500">{{ t('learning.academyInviteUserId') }}</span>
            <input
              v-model="inviteUserId"
              type="text"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-800"
              :placeholder="t('learning.academyInviteUserIdHint')"
            >
          </label>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            :disabled="!inviteUserId || inviting"
            @click="inviteLearner"
          >
            {{ inviting ? t('learning.academyInviting') : t('learning.academyInvite') }}
          </button>
        </div>
        <div v-if="learnersLoading" class="mt-4 h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        <ul v-else class="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
          <li
            v-for="row in learners"
            :key="row._id || row.userId"
            class="flex flex-wrap items-center justify-between gap-2 py-3"
          >
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ row.user?.email || row.userId }}
              </p>
              <p class="text-xs capitalize text-gray-500">{{ row.status }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-if="row.status === 'active'"
                type="button"
                class="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600"
                @click="lifecycle(row.userId, 'suspend')"
              >
                {{ t('learning.academySuspend') }}
              </button>
              <button
                v-if="row.status === 'active' || row.status === 'suspended'"
                type="button"
                class="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                @click="lifecycle(row.userId, 'revoke')"
              >
                {{ t('learning.academyRevoke') }}
              </button>
              <button
                v-if="row.status === 'suspended' || row.status === 'revoked'"
                type="button"
                class="rounded border border-indigo-300 px-2 py-1 text-xs text-indigo-700"
                @click="lifecycle(row.userId, 'restore')"
              >
                {{ t('learning.academyRestore') }}
              </button>
            </div>
          </li>
          <li v-if="!learners.length" class="py-3 text-sm text-gray-500">
            {{ t('learning.academyLearnersEmpty') }}
          </li>
        </ul>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:col-span-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {{ t('learning.interopSection') }}
        </h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {{ t('learning.interopBlurb') }}
        </p>
        <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-300">
          <li>{{ t('learning.interopSso') }}</li>
          <li>{{ t('learning.interopScorm') }}</li>
          <li>{{ t('learning.interopLti') }}</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RadioGroup, RadioGroupOption } from '@headlessui/vue';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/auth';
import { useNotifications } from '@/composables/useNotifications';
import LearningPageHeader from './components/LearningPageHeader.vue';

const DEFAULT_PLANS = [
  { planKey: 'starter', capacity: 50, monthlyPaise: 199900 },
  { planKey: 'growth', capacity: 200, monthlyPaise: 599900 },
  { planKey: 'business', capacity: 500, monthlyPaise: 1199900 },
];

const audienceKeys = ['internal', 'customer', 'partner', 'external'];
const audienceLearnerKeys = ['customer', 'partner', 'external'];

const AUDIENCE_I18N = {
  internal: 'learning.audienceInternal',
  customer: 'learning.audienceCustomer',
  partner: 'learning.audiencePartner',
  external: 'learning.audienceExternal',
};

const { t } = useI18n();
const authStore = useAuthStore();
const { success, error } = useNotifications();
const loading = ref(true);
const savingPlan = ref(false);
const savingAcademy = ref(false);
const inviting = ref(false);
const learnersLoading = ref(false);
const usage = ref(null);
const learners = ref([]);
const inviteUserId = ref('');
const selectedPlanKey = ref('growth');
const academyForm = reactive({
  enabled: false,
  name: '',
  primaryColor: '#3a1f8a',
  catalogVisibility: 'assigned',
  allowedAudiences: ['customer', 'partner', 'external'],
});

function audienceLabel(key) {
  return t(AUDIENCE_I18N[key] || 'learning.audienceExternal');
}
const canManageBilling = computed(() => {
  if (authStore.isOwner || authStore.isAdminLike) return true;
  return Boolean(authStore.user?.permissions?.settings?.manageBilling);
});

const plans = computed(() => usage.value?.plans?.length ? usage.value.plans : DEFAULT_PLANS);
const currentPlanKey = computed(() => usage.value?.planKey || null);

const seatPercent = computed(() => {
  const used = Number(usage.value?.learnerSeatsUsed) || 0;
  const cap = Number(usage.value?.learnerSeatCapacity) || 0;
  if (!cap) return 0;
  return Math.min(100, Math.round((used / cap) * 100));
});

function formatPaise(paise) {
  const rupees = Math.round(Number(paise || 0) / 100);
  return `₹${rupees.toLocaleString('en-IN')}/mo`;
}

async function load() {
  loading.value = true;
  try {
    const res = await apiClient.get('/lms/seats', { cache: 'no-store' });
    usage.value = res?.data || res;
    selectedPlanKey.value = usage.value?.planKey || 'growth';
  } catch {
    usage.value = null;
  } finally {
    loading.value = false;
  }
}

async function loadAcademy() {
  try {
    const res = await apiClient.get('/lms/academy/config', { cache: 'no-store' });
    const data = res?.data || res || {};
    academyForm.enabled = Boolean(data.enabled);
    academyForm.name = data.name || '';
    academyForm.primaryColor = data.primaryColor || '#3a1f8a';
    academyForm.catalogVisibility = data.catalogVisibility || 'assigned';
    academyForm.allowedAudiences = Array.isArray(data.allowedAudiences)
      ? [...data.allowedAudiences]
      : ['customer', 'partner', 'external'];
  } catch {
    /* admin-only */
  }
}

async function loadLearners() {
  learnersLoading.value = true;
  try {
    const res = await apiClient.get('/lms/academy/learners', { cache: 'no-store' });
    learners.value = res?.data || res || [];
  } catch {
    learners.value = [];
  } finally {
    learnersLoading.value = false;
  }
}

async function savePlan() {
  if (!canManageBilling.value || !selectedPlanKey.value) return;
  savingPlan.value = true;
  try {
    const res = await apiClient.post('/billing/learning-plan', {
      planKey: selectedPlanKey.value,
    });
    usage.value = {
      ...(usage.value || {}),
      ...(res?.data?.usage || res?.usage || {}),
      planKey: res?.data?.planKey || selectedPlanKey.value,
      learnerSeatCapacity: res?.data?.capacity ?? usage.value?.learnerSeatCapacity,
    };
    success(t('learning.planSaved'));
    await load();
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.loadFailed'));
  } finally {
    savingPlan.value = false;
  }
}

async function saveAcademy() {
  savingAcademy.value = true;
  try {
    await apiClient.put('/lms/academy/config', { ...academyForm });
    success(t('learning.academySettingsSaved'));
    await loadAcademy();
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.loadFailed'));
  } finally {
    savingAcademy.value = false;
  }
}

async function inviteLearner() {
  if (!inviteUserId.value) return;
  inviting.value = true;
  try {
    await apiClient.post('/lms/academy/learners/invite', { userId: inviteUserId.value.trim() });
    success(t('learning.academyInviteSent'));
    inviteUserId.value = '';
    await loadLearners();
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.loadFailed'));
  } finally {
    inviting.value = false;
  }
}

async function lifecycle(userId, action) {
  try {
    await apiClient.post(`/lms/academy/learners/${userId}/${action}`);
    success(t('learning.academyLifecycleUpdated'));
    await loadLearners();
    await load();
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.loadFailed'));
  }
}

onMounted(async () => {
  await Promise.all([load(), loadAcademy(), loadLearners()]);
});
</script>
