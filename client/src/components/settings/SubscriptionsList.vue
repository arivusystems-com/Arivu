<template>
  <SettingsScrollPanel>
    <template #header>
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.tabSubscriptions') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ pageSubtitle }}
        </p>
      </div>
    </template>

    <div class="space-y-6">
    <CommercialBillingOverview
      @commercial-active="onCommercialActive"
      @billing-surface="onBillingSurface"
    />

    <!-- Legacy per-app cards: only when commercial/internal surface is not the source of truth -->
    <template v-if="!commercialActive">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-sm text-red-800 dark:text-red-300">
          {{ error.message || t('settings.settingsSubsLoadFailed') }}
        </p>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!loading && !error && subscriptions.length === 0" class="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
      <svg class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.settingsSubsEmptyTitle') }}</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.settingsSubsEmptyBody') }}</p>
    </div>

    <!-- Subscriptions List -->
    <div v-else class="space-y-4">
      <div
        v-for="subscription in subscriptions"
        :key="subscription.appKey"
        class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-400 transition-all cursor-pointer group"
        @click="viewSubscriptionDetail(subscription)"
      >
        <!-- Subscription Header -->
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <!-- App Icon -->
            <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>

            <!-- App Name and Description -->
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ subscription.appName }}
                </h3>
                <span
                  v-if="subscription.itemType === 'addon'"
                  class="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                >
                  {{ t('settings.settingsSubsAddonBadge') }}
                </span>
              </div>
              <p v-if="subscription.description" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {{ subscription.description }}
              </p>
            </div>
          </div>

          <!-- Plan Badge -->
          <div class="flex items-center gap-2">
            <span
              :class="[
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium',
                getPlanBadgeClass(subscription.plan)
              ]"
            >
              {{ planLabel(subscription.plan) }}
            </span>
          </div>
        </div>

        <!-- Usage and Limits -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <!-- Agents (addons) -->
          <div v-if="subscription.usage?.agents">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('settings.settingsSubsUsageAgents') }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-500">
                {{ subscription.usage.agents.current }}
                /
                {{ subscription.usage.agents.limit ?? t('settings.addonsUnlimited') }}
              </span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                class="bg-indigo-600 h-2 rounded-full transition-all"
                :style="{ width: agentUsageWidth(subscription.usage.agents) }"
              ></div>
            </div>
          </div>

          <!-- Users -->
          <div v-if="subscription.usage?.users">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('settings.settingsSubsUsageUsers') }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-500">
                {{ subscription.usage.users.current }} / {{ formatSubscriptionLimitLabel(subscription.usage.users.limit, t) }}
              </span>
            </div>
            <div v-if="isFiniteSubscriptionLimit(subscription.usage.users.limit)" class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                class="bg-indigo-600 h-2 rounded-full transition-all"
                :style="{ width: usageBarWidthPercent(subscription.usage.users.current, subscription.usage.users.limit) }"
              ></div>
            </div>
          </div>

          <!-- Contacts -->
          <div v-if="subscription.usage?.contacts">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('settings.settingsSubsUsageContacts') }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-500">
                {{ subscription.usage.contacts.current }} / {{ formatSubscriptionLimitLabel(subscription.usage.contacts.limit, t) }}
              </span>
            </div>
            <div v-if="isFiniteSubscriptionLimit(subscription.usage.contacts.limit)" class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                class="bg-indigo-600 h-2 rounded-full transition-all"
                :style="{ width: usageBarWidthPercent(subscription.usage.contacts.current, subscription.usage.contacts.limit) }"
              ></div>
            </div>
          </div>

          <!-- Storage -->
          <div v-if="subscription.limits?.storage !== undefined">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-medium text-gray-600 dark:text-gray-400">{{ t('settings.settingsSubsUsageStorage') }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-500">
                {{ isFiniteSubscriptionLimit(subscription.limits.storage)
                  ? t('settings.settingsSubsStorageGb', { amount: subscription.limits.storage })
                  : t('settings.addonsUnlimited') }}
              </span>
            </div>
            <div v-if="isFiniteSubscriptionLimit(subscription.limits.storage)" class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                class="bg-indigo-600 h-2 rounded-full transition-all"
                :style="{ width: '0%' }"
              ></div>
            </div>
          </div>
        </div>

        <!-- Upgrade CTA (only for eligible apps) -->
        <div v-if="subscription.canUpgrade && subscription.itemType !== 'addon'" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            @click.stop="handleUpgrade(subscription.appKey)"
            class="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
          >
            <span>{{ t('settings.settingsSubsUpgradeCta', { appName: subscription.appName }) }}</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div
          v-else-if="subscription.itemType === 'addon' && subscription.subscriptionDetails?.trialEndsAt && subscription.plan === 'Trial'"
          class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400"
        >
          {{ t('settings.addonsTrialEnds', { date: formatDate(subscription.subscriptionDetails.trialEndsAt) }) }}
        </div>
      </div>
    </div>
    </template>
    </div>
  </SettingsScrollPanel>
</template>

<script setup>
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import CommercialBillingOverview from '@/components/settings/CommercialBillingOverview.vue';
import { formatUserDate } from '@/utils/localeFormat';
import { computed, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import {
  formatSubscriptionLimitLabel,
  isFiniteSubscriptionLimit,
  usageBarWidthPercent,
} from '@/utils/subscriptionLimits';

const { t } = useI18n();
const router = useRouter();
const subscriptions = ref([]);
const loading = ref(true);
const error = ref(null);
const commercialActive = ref(false);
const billingSurface = ref({ commercialActive: false, isInternal: false, isSandbox: false });

const pageSubtitle = computed(() => {
  if (billingSurface.value.isSandbox || billingSurface.value.isInternal) {
    return t('settings.billingSandboxPageSubtitle');
  }
  if (commercialActive.value) {
    return t('settings.billingPageSubtitle');
  }
  return t('settings.settingsSubsListSubtitle');
});

function onCommercialActive(active) {
  commercialActive.value = Boolean(active);
}

function onBillingSurface(surface) {
  billingSurface.value = {
    commercialActive: Boolean(surface?.commercialActive),
    isInternal: Boolean(surface?.isInternal),
    isSandbox: Boolean(surface?.isSandbox),
  };
}

const PLAN_LABEL_KEYS = {
  Trial: 'settings.settingsSubsPlanTrial',
  Paid: 'settings.settingsSubsPlanPaid',
  Active: 'settings.settingsSubsPlanActive',
  Suspended: 'settings.settingsSubsPlanSuspended',
  'Not Subscribed': 'settings.settingsSubsPlanNotSubscribed',
  DISABLED: 'settings.settingsSubsPlanNotSubscribed',
  BASIC: 'settings.settingsSubsPlanBasic',
  PRO: 'settings.settingsSubsPlanPro',
  ENTERPRISE: 'settings.settingsSubsPlanEnterprise',
  Archived: 'settings.settingsSubsPlanArchived',
};

const fetchSubscriptions = async () => {
  loading.value = true;
  error.value = null;

  try {
    const data = await apiClient('/settings/subscriptions', {
      method: 'GET',
      cache: 'no-store',
    });

    if (data && data.subscriptions) {
      subscriptions.value = data.subscriptions;
    } else {
      subscriptions.value = [];
    }
  } catch (err) {
    console.error('Failed to fetch subscriptions:', err);
    error.value = err;
    subscriptions.value = [];
  } finally {
    loading.value = false;
  }
};

const viewSubscriptionDetail = (subscription) => {
  router.push({ path: '/settings', query: { tab: 'subscriptions', appKey: subscription.appKey } });
};

const handleUpgrade = (appKey) => {
  router.push({ path: '/settings', query: { tab: 'subscriptions', appKey } });
};

function agentUsageWidth(agents) {
  return usageBarWidthPercent(agents?.current, agents?.limit);
}

function formatDate(value) {
  if (!value) return '';
  try {
    return formatUserDate(value);
  } catch {
    return '';
  }
}

function planLabel(plan) {
  const key = PLAN_LABEL_KEYS[plan];
  return key ? t(key) : plan;
}

const getPlanBadgeClass = (plan) => {
  const classes = {
    'Trial': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    'Paid': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    'Active': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    'BASIC': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    'PRO': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    'ENTERPRISE': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    'Suspended': 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
    'Archived': 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
    'Not Subscribed': 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
    'DISABLED': 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
  };
  return classes[plan] || classes['Not Subscribed'];
};

onMounted(() => {
  fetchSubscriptions();
});
</script>
