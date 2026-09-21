<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { MinusIcon, PlusIcon } from '@heroicons/vue/24/outline';
import { useColorMode } from '@/composables/useColorMode';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import {
  estimateCommercialQuote,
  fetchFounderStatus,
  formatInrFromPaise,
} from '@/utils/commercialPricingApi';

const { t } = useI18n();
const { colorMode } = useColorMode();

const billingPeriod = ref('monthly');
const adminUsers = ref(1);
const standardUsers = ref(2);
const portalUsers = ref(0);
const founder = ref(null);
const estimate = ref(null);
const estimateError = ref(null);
const estimating = ref(false);

/** Application product codes ↔ display — prices from estimate API. */
const appSelections = ref([
  { productCode: 'sales_app', users: 2, enabled: true },
  { productCode: 'helpdesk_app', users: 0, enabled: false },
  { productCode: 'audit_app', users: 0, enabled: false },
  { productCode: 'inventory_app', users: 0, enabled: false },
  { productCode: 'field_sales_app', users: 0, enabled: false },
  { productCode: 'marketing_app', users: 0, enabled: false },
]);

const APP_LABEL_KEYS = {
  helpdesk_app: 'platform.pricingAppHelpdesk',
  sales_app: 'platform.pricingAppSales',
  audit_app: 'platform.pricingAppAudit',
  inventory_app: 'platform.pricingAppInventory',
  field_sales_app: 'platform.pricingAppFieldSales',
  marketing_app: 'platform.pricingAppMarketing',
  learning_app: 'platform.pricingAppLearning',
};

/** Static Founder list prices for the apps table (monthly paise); annual = ×10 via UI. */
const APP_LIST_MONTHLY_PAISE = {
  helpdesk_app: 14900,
  sales_app: 19900,
  audit_app: 19900,
  inventory_app: 24900,
  field_sales_app: 29900,
  marketing_app: 49900,
};

const ADMIN_MONTHLY_PAISE = 99900;
const STANDARD_MONTHLY_PAISE = 69900;
const PORTAL_FROM_MONTHLY_PAISE = 19900;
const ANNUAL_MULT = 10;

/** Learning App — TIERED_CAPACITY learner seats (not per assigned user). */
const LEARNING_PLANS = [
  { planKey: 'starter', capacity: 50, monthlyPaise: 199900 },
  { planKey: 'growth', capacity: 200, monthlyPaise: 599900 },
  { planKey: 'business', capacity: 500, monthlyPaise: 1199900 },
];
const learningEnabled = ref(true);
const learningPlanKey = ref('growth');

const prefersReducedMotion = ref(
  typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

/** @type {Map<string, number>} */
const rafByKey = new Map();

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

/**
 * Animate a numeric display toward target (count-up / count-down).
 * @param {import('vue').Ref<number>} displayRef
 * @param {number} target
 * @param {string} key
 * @param {number} [durationMs]
 */
function animateNumberTo(displayRef, target, key, durationMs = 380) {
  const next = Math.round(Number(target) || 0);
  const prevRaf = rafByKey.get(key);
  if (prevRaf) cancelAnimationFrame(prevRaf);

  if (prefersReducedMotion.value) {
    displayRef.value = next;
    return;
  }

  const start = Number(displayRef.value) || 0;
  if (start === next) return;

  const startedAt = performance.now();
  const delta = next - start;

  const tick = (now) => {
    const p = Math.min(1, (now - startedAt) / durationMs);
    displayRef.value = Math.round(start + delta * easeOutCubic(p));
    if (p < 1) {
      const id = requestAnimationFrame(tick);
      rafByKey.set(key, id);
    } else {
      rafByKey.delete(key);
      displayRef.value = next;
    }
  };

  const id = requestAnimationFrame(tick);
  rafByKey.set(key, id);
}

function useAnimatedInt(sourceRef, key, durationMs = 280) {
  const display = ref(Number(sourceRef.value) || 0);
  watch(
    sourceRef,
    (v) => animateNumberTo(display, v, key, durationMs),
    { immediate: true }
  );
  return display;
}

const animatedAdminUsers = useAnimatedInt(adminUsers, 'seat-admin');
const animatedStandardUsers = useAnimatedInt(standardUsers, 'seat-standard');
const animatedPortalUsers = useAnimatedInt(portalUsers, 'seat-portal');

const estimateTotalTarget = computed(() => Number(estimate.value?.subtotalMinor) || 0);
const animatedTotalMinor = ref(0);
watch(estimateTotalTarget, (v) => animateNumberTo(animatedTotalMinor, v, 'estimate-total', 480), {
  immediate: true,
});

const animatedSavingsMinor = ref(0);
watch(
  () => Number(estimate.value?.annualSavingsMinor) || 0,
  (v) => animateNumberTo(animatedSavingsMinor, v, 'estimate-savings', 420),
  { immediate: true }
);

/** productCode → animated amountMinor / quantity */
const animatedLineAmounts = reactive({});
const animatedLineQty = reactive({});

function animateReactiveField(store, field, target, animKey, durationMs = 420) {
  const displayRef = {
    get value() {
      return store[field] ?? 0;
    },
    set value(v) {
      store[field] = v;
    },
  };
  if (store[field] == null) store[field] = 0;
  animateNumberTo(displayRef, target, animKey, durationMs);
}

watch(
  () => estimate.value?.lines || [],
  (lines) => {
    const seen = new Set();
    for (const line of lines) {
      const code = String(line.productCode || '');
      seen.add(code);
      animateReactiveField(animatedLineAmounts, code, line.amountMinor, `line-amt-${code}`, 420);
      animateReactiveField(animatedLineQty, code, line.quantity, `line-qty-${code}`, 280);
    }
    for (const code of Object.keys(animatedLineAmounts)) {
      if (!seen.has(code)) {
        delete animatedLineAmounts[code];
        delete animatedLineQty[code];
      }
    }
  },
  { deep: true }
);

/** App seat steppers (productCode → display qty) */
const animatedAppUsers = reactive({});
watch(
  appSelections,
  (rows) => {
    for (const row of rows) {
      animateReactiveField(animatedAppUsers, row.productCode, row.users, `app-${row.productCode}`, 280);
    }
  },
  { deep: true, immediate: true }
);

onUnmounted(() => {
  for (const id of rafByKey.values()) cancelAnimationFrame(id);
  rafByKey.clear();
});

const isAnnual = computed(() => billingPeriod.value === 'annual');

function periodPrice(monthlyPaise) {
  return isAnnual.value ? monthlyPaise * ANNUAL_MULT : monthlyPaise;
}

function periodSuffix() {
  return isAnnual.value ? t('platform.pricingPerYear') : t('platform.pricingPerMonth');
}

function clampUsers(n, min = 0, max = 500) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.floor(v)));
}

function setAdminUsers(next) {
  adminUsers.value = clampUsers(next, 0);
}

function setStandardUsers(next) {
  standardUsers.value = clampUsers(next, 0);
}

function setPortalUsers(next) {
  portalUsers.value = clampUsers(next, 0);
}

function bumpApp(row, delta) {
  row.users = clampUsers(row.users + delta, 0);
  row.enabled = row.users > 0;
}

function onAppEnabled(row, enabled) {
  row.enabled = enabled;
  if (enabled && row.users < 1) {
    row.users = Math.max(1, adminUsers.value + standardUsers.value);
  }
  if (!enabled) row.users = 0;
}

function lineDisplayLabel(line) {
  const code = String(line.productCode || '');
  if (code === 'admin_user') return t('platform.pricingLineAdmin');
  if (code === 'standard_user' || code === 'internal_user') return t('platform.pricingLineStandard');
  if (code === 'portal_user') return t('platform.pricingLinePortal');
  if (code === 'learning_app') {
    return line.label || t('platform.pricingAppLearning');
  }
  if (APP_LABEL_KEYS[code]) return t(APP_LABEL_KEYS[code]);
  return line.label || code;
}

function animatedLineAmount(line) {
  const code = String(line.productCode || '');
  return animatedLineAmounts[code] ?? line.amountMinor ?? 0;
}

function animatedLineQuantity(line) {
  const code = String(line.productCode || '');
  return animatedLineQty[code] ?? line.quantity ?? 0;
}

async function refreshEstimate() {
  const showSpinner = !estimate.value;
  if (showSpinner) estimating.value = true;
  estimateError.value = null;
  try {
    const applications = appSelections.value
      .filter((a) => a.enabled && a.users > 0)
      .map((a) => ({ productCode: a.productCode, users: a.users }));
    if (learningEnabled.value) {
      applications.push({
        productCode: 'learning_app',
        planKey: learningPlanKey.value,
        users: 1,
      });
    }
    estimate.value = await estimateCommercialQuote({
      billingPeriod: billingPeriod.value,
      adminUsers: adminUsers.value,
      standardUsers: standardUsers.value,
      portalUsers: portalUsers.value,
      applications,
    });
  } catch (err) {
    estimateError.value = err?.message || t('platform.pricingEstimateFailed');
  } finally {
    estimating.value = false;
  }
}

let debounceTimer = null;
function scheduleEstimate() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    refreshEstimate();
  }, 250);
}

watch([billingPeriod, adminUsers, standardUsers, portalUsers, appSelections, learningEnabled, learningPlanKey], scheduleEstimate, { deep: true });

onMounted(async () => {
  try {
    founder.value = await fetchFounderStatus();
  } catch {
    founder.value = null;
  }
  await refreshEstimate();
});

const founderRemaining = computed(() => {
  if (!founder.value || founder.value.remaining == null) return null;
  return founder.value.remaining;
});

const logoSrc = computed(() =>
  colorMode.value === 'dark' || colorMode.value === 'system'
    ? '/assets/nurtura_logo_dark.svg'
    : '/assets/nurtura_logo_light.svg'
);
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <header class="border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <nav class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-8" :aria-label="t('platform.pricingNavAria')">
        <router-link to="/login" class="-m-1.5 p-1.5">
          <span class="sr-only">{{ t('platform.pricingBrand') }}</span>
          <img :src="logoSrc" alt="" class="h-8 w-auto brightness-0 dark:brightness-100" />
        </router-link>
        <div class="flex items-center gap-4">
          <router-link to="/login" class="text-sm font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white">
            {{ t('platform.pricingLogIn') }}
          </router-link>
          <router-link
            to="/start-trial"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            {{ t('platform.pricingCtaTrial') }}
          </router-link>
        </div>
      </nav>
    </header>

    <main>
      <section class="relative overflow-hidden px-6 pb-12 pt-16 lg:px-8">
        <div
          class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.12),_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.2),_transparent_50%)]"
          aria-hidden="true"
        />
        <div class="relative mx-auto max-w-3xl text-center">
          <p class="text-sm font-semibold tracking-wide text-indigo-600 dark:text-indigo-400">
            {{ t('platform.pricingFounderBadge') }}
          </p>
          <h1 class="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            {{ t('platform.pricingBrand') }}
          </h1>
          <p class="mt-4 text-lg text-slate-600 dark:text-slate-400">
            {{ t('platform.pricingLead') }}
          </p>
          <p
            v-if="founderRemaining != null"
            class="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400"
          >
            {{ t('platform.pricingFounderSpots', { remaining: founderRemaining, capacity: founder?.capacity || 100 }) }}
          </p>

          <div
            class="mt-8 inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
            role="group"
            :aria-label="t('platform.pricingPeriodAria')"
          >
            <button
              type="button"
              class="rounded-md px-4 py-2 text-sm font-semibold transition"
              :class="!isAnnual
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'"
              @click="billingPeriod = 'monthly'"
            >
              {{ t('platform.pricingPeriodMonthly') }}
            </button>
            <button
              type="button"
              class="rounded-md px-4 py-2 text-sm font-semibold transition"
              :class="isAnnual
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'"
              @click="billingPeriod = 'annual'"
            >
              {{ t('platform.pricingPeriodAnnual') }}
            </button>
          </div>
          <p v-if="isAnnual" class="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {{ t('platform.pricingSaveTwoMonths') }}
          </p>
        </div>
      </section>

      <!-- Seat rates -->
      <section class="mx-auto max-w-6xl space-y-10 px-6 pb-16 lg:px-8">
        <div class="grid gap-6 md:grid-cols-3">
          <div class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p class="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
              {{ t('platform.pricingSeatAdminBadge') }}
            </p>
            <h2 class="mt-2 text-lg font-semibold">{{ t('platform.pricingSeatAdminTitle') }}</h2>
            <p class="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
              {{ formatInrFromPaise(periodPrice(ADMIN_MONTHLY_PAISE)) }}
              <span class="text-base font-medium text-slate-500">{{ t('platform.pricingPerUserPeriod', { period: periodSuffix() }) }}</span>
            </p>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">{{ t('platform.pricingSeatAdminNote') }}</p>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p class="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              {{ t('platform.pricingSeatStandardBadge') }}
            </p>
            <h2 class="mt-2 text-lg font-semibold">{{ t('platform.pricingSeatStandardTitle') }}</h2>
            <p class="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
              {{ formatInrFromPaise(periodPrice(STANDARD_MONTHLY_PAISE)) }}
              <span class="text-base font-medium text-slate-500">{{ t('platform.pricingPerUserPeriod', { period: periodSuffix() }) }}</span>
            </p>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">{{ t('platform.pricingSeatStandardNote') }}</p>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p class="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
              {{ t('platform.pricingSeatPortalBadge') }}
            </p>
            <h2 class="mt-2 text-lg font-semibold">{{ t('platform.pricingAddPortal') }}</h2>
            <p class="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
              {{ t('platform.pricingFrom') }}
              {{ formatInrFromPaise(periodPrice(PORTAL_FROM_MONTHLY_PAISE)) }}
              <span class="text-base font-medium text-slate-500">{{ t('platform.pricingPerUserPeriod', { period: periodSuffix() }) }}</span>
            </p>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">{{ t('platform.pricingPortalNote') }}</p>
          </div>
        </div>

        <div>
          <h2 class="text-lg font-semibold">{{ t('platform.pricingAddApps') }}</h2>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ t('platform.pricingAppsNote') }}</p>
          <div class="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table class="min-w-full text-left text-sm">
              <thead class="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950/50">
                <tr>
                  <th class="px-4 py-3 font-medium">{{ t('platform.pricingColApp') }}</th>
                  <th class="px-4 py-3 font-medium">{{ t('platform.pricingColPrice') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(paise, code) in APP_LIST_MONTHLY_PAISE"
                  :key="code"
                  class="border-b border-slate-100 last:border-0 dark:border-slate-800"
                >
                  <td class="px-4 py-3 font-medium">{{ t(APP_LABEL_KEYS[code]) }}</td>
                  <td class="px-4 py-3 tabular-nums">
                    {{ formatInrFromPaise(periodPrice(paise)) }}{{ periodSuffix() }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">{{ t('platform.pricingNoPacks') }}</p>
        </div>
      </section>

      <!-- Calculator -->
      <section id="calculator" class="border-t border-slate-200 bg-white px-6 py-16 dark:border-slate-800 dark:bg-slate-900/40 lg:px-8">
        <div class="mx-auto max-w-6xl">
          <h2 class="text-2xl font-semibold tracking-tight">{{ t('platform.pricingBuildYours') }}</h2>
          <p class="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">{{ t('platform.pricingBuildLead') }}</p>

          <div class="mt-10 grid gap-10 lg:grid-cols-2">
            <div class="space-y-8">
              <!-- Admin seats -->
              <div>
                <label class="text-sm font-semibold text-slate-900 dark:text-white" for="pricing-admin-users">
                  {{ t('platform.pricingAdminUsers') }}
                </label>
                <p class="mt-0.5 text-xs text-slate-500">{{ t('platform.pricingAdminUsersHint') }}</p>
                <div class="mt-3 flex flex-wrap items-center gap-3">
                  <div class="inline-flex items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-950">
                    <button
                      type="button"
                      class="inline-flex items-center justify-center px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800"
                      :disabled="adminUsers <= 0"
                      :aria-label="t('platform.pricingDecrease')"
                      @click="setAdminUsers(adminUsers - 1)"
                    >
                      <MinusIcon class="h-4 w-4" />
                    </button>
                    <span
                      id="pricing-admin-users"
                      class="flex w-16 items-center justify-center border-x border-slate-300 bg-white px-2 py-2 text-center text-sm tabular-nums text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                      aria-live="polite"
                    >{{ animatedAdminUsers }}</span>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      :aria-label="t('platform.pricingIncrease')"
                      @click="setAdminUsers(adminUsers + 1)"
                    >
                      <PlusIcon class="h-4 w-4" />
                    </button>
                  </div>
                  <span class="text-sm tabular-nums text-slate-500">
                    {{ formatInrFromPaise(periodPrice(ADMIN_MONTHLY_PAISE)) }}{{ t('platform.pricingPerUserPeriod', { period: periodSuffix() }) }}
                  </span>
                </div>
              </div>

              <!-- Standard seats -->
              <div>
                <label class="text-sm font-semibold text-slate-900 dark:text-white" for="pricing-standard-users">
                  {{ t('platform.pricingStandardUsers') }}
                </label>
                <p class="mt-0.5 text-xs text-slate-500">{{ t('platform.pricingStandardUsersHint') }}</p>
                <div class="mt-3 flex flex-wrap items-center gap-3">
                  <div class="inline-flex items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-950">
                    <button
                      type="button"
                      class="inline-flex items-center justify-center px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800"
                      :disabled="standardUsers <= 0"
                      :aria-label="t('platform.pricingDecrease')"
                      @click="setStandardUsers(standardUsers - 1)"
                    >
                      <MinusIcon class="h-4 w-4" />
                    </button>
                    <span
                      id="pricing-standard-users"
                      class="flex w-16 items-center justify-center border-x border-slate-300 bg-white px-2 py-2 text-center text-sm tabular-nums text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                      aria-live="polite"
                    >{{ animatedStandardUsers }}</span>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      :aria-label="t('platform.pricingIncrease')"
                      @click="setStandardUsers(standardUsers + 1)"
                    >
                      <PlusIcon class="h-4 w-4" />
                    </button>
                  </div>
                  <span class="text-sm tabular-nums text-slate-500">
                    {{ formatInrFromPaise(periodPrice(STANDARD_MONTHLY_PAISE)) }}{{ t('platform.pricingPerUserPeriod', { period: periodSuffix() }) }}
                  </span>
                </div>
              </div>

              <!-- Portal seats -->
              <div>
                <label class="text-sm font-semibold text-slate-900 dark:text-white" for="pricing-portal-users">
                  {{ t('platform.pricingPortalUsers') }}
                </label>
                <p class="mt-0.5 text-xs text-slate-500">{{ t('platform.pricingPortalUsersHint') }}</p>
                <div class="mt-3 flex flex-wrap items-center gap-3">
                  <div class="inline-flex items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-950">
                    <button
                      type="button"
                      class="inline-flex items-center justify-center px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800"
                      :disabled="portalUsers <= 0"
                      :aria-label="t('platform.pricingDecrease')"
                      @click="setPortalUsers(portalUsers - 1)"
                    >
                      <MinusIcon class="h-4 w-4" />
                    </button>
                    <span
                      id="pricing-portal-users"
                      class="flex w-16 items-center justify-center border-x border-slate-300 bg-white px-2 py-2 text-center text-sm tabular-nums text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                      aria-live="polite"
                    >{{ animatedPortalUsers }}</span>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      :aria-label="t('platform.pricingIncrease')"
                      @click="setPortalUsers(portalUsers + 1)"
                    >
                      <PlusIcon class="h-4 w-4" />
                    </button>
                  </div>
                  <span class="text-sm tabular-nums text-slate-500">
                    {{ t('platform.pricingFrom') }}
                    {{ formatInrFromPaise(periodPrice(PORTAL_FROM_MONTHLY_PAISE)) }}{{ t('platform.pricingPerUserPeriod', { period: periodSuffix() }) }}
                  </span>
                </div>
              </div>

              <!-- Learning App (learner seats) -->
              <div>
                <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('platform.pricingAppLearning') }}</p>
                <p class="mt-0.5 text-xs text-slate-500">{{ t('platform.pricingLearningHint') }}</p>
                <div class="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950/40">
                  <label class="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-800 dark:text-slate-100">
                    <HeadlessCheckbox
                      :model-value="learningEnabled"
                      size="md"
                      @update:model-value="(v) => { learningEnabled = v; }"
                    />
                    {{ t('platform.pricingLearningEnable') }}
                  </label>
                  <div v-if="learningEnabled" class="mt-3 flex flex-wrap gap-2">
                    <button
                      v-for="plan in LEARNING_PLANS"
                      :key="plan.planKey"
                      type="button"
                      class="rounded-lg border px-3 py-2 text-left text-sm transition"
                      :class="learningPlanKey === plan.planKey
                        ? 'border-teal-600 bg-teal-50 text-teal-900 dark:border-teal-500 dark:bg-teal-950/40 dark:text-teal-100'
                        : 'border-slate-200 dark:border-slate-600'"
                      @click="learningPlanKey = plan.planKey"
                    >
                      <span class="font-semibold capitalize">{{ plan.planKey }}</span>
                      <span class="mt-0.5 block text-xs opacity-80">
                        {{ t('platform.pricingLearningSeats', { count: plan.capacity }) }}
                        · {{ formatInrFromPaise(periodPrice(plan.monthlyPaise)) }}{{ periodSuffix() }}
                      </span>
                    </button>
                  </div>
                  <p v-if="learningEnabled && learningPlanKey === 'growth'" class="mt-2 text-xs font-medium text-teal-700 dark:text-teal-300">
                    {{ t('platform.pricingLearningPrimary') }}
                  </p>
                </div>
              </div>

              <!-- Applications -->
              <div>
                <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('platform.pricingApplications') }}</p>
                <p class="mt-0.5 text-xs text-slate-500">{{ t('platform.pricingApplicationsHint') }}</p>
                <ul class="mt-3 space-y-2">
                  <li
                    v-for="row in appSelections"
                    :key="row.productCode"
                    class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950/40"
                  >
                    <label class="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-800 dark:text-slate-100">
                      <HeadlessCheckbox
                        :model-value="row.enabled"
                        size="md"
                        @update:model-value="(v) => onAppEnabled(row, v)"
                      />
                      {{ t(APP_LABEL_KEYS[row.productCode]) }}
                    </label>
                    <div
                      v-if="row.enabled"
                      class="inline-flex items-stretch overflow-hidden rounded-md border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-950"
                    >
                      <button
                        type="button"
                        class="inline-flex items-center justify-center px-2 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800"
                        :disabled="row.users <= 0"
                        :aria-label="t('platform.pricingDecrease')"
                        @click="bumpApp(row, -1)"
                      >
                        <MinusIcon class="h-3.5 w-3.5" />
                      </button>
                      <span class="flex min-w-[2rem] items-center justify-center border-x border-slate-300 px-2 text-sm tabular-nums dark:border-slate-600">
                        {{ animatedAppUsers[row.productCode] ?? row.users }}
                      </span>
                      <button
                        type="button"
                        class="inline-flex items-center justify-center px-2 py-1.5 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                        :aria-label="t('platform.pricingIncrease')"
                        @click="bumpApp(row, 1)"
                      >
                        <PlusIcon class="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-950/60 lg:sticky lg:top-8 lg:self-start">
              <h3 class="text-lg font-semibold">{{ t('platform.pricingEstimate') }}</h3>
              <p v-if="estimating && !estimate" class="mt-4 text-sm text-slate-500">{{ t('platform.pricingEstimating') }}</p>
              <p v-else-if="estimateError && !estimate" class="mt-4 text-sm text-red-600">{{ estimateError }}</p>
              <template v-else-if="estimate">
                <p class="mt-4 text-4xl font-semibold tracking-tight tabular-nums">
                  {{ formatInrFromPaise(animatedTotalMinor) }}
                  <span class="text-base font-medium text-slate-500">{{ periodSuffix() }}</span>
                </p>
                <p v-if="isAnnual && animatedSavingsMinor > 0" class="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  {{ t('platform.pricingSaveAmount', { amount: formatInrFromPaise(animatedSavingsMinor) }) }}
                </p>
                <p v-if="estimateError" class="mt-2 text-sm text-red-600">{{ estimateError }}</p>
                <ul class="mt-6 space-y-2.5 border-t border-slate-200 pt-4 text-sm dark:border-slate-700">
                  <li
                    v-for="line in estimate.lines"
                    :key="line.productCode"
                    class="grid grid-cols-[1fr_auto_auto] items-baseline gap-3 tabular-nums"
                  >
                    <span class="font-medium text-slate-800 dark:text-slate-100">{{ lineDisplayLabel(line) }}</span>
                    <span class="text-slate-500">× {{ animatedLineQuantity(line) }}</span>
                    <span class="justify-self-end font-semibold text-slate-900 dark:text-white">
                      {{ formatInrFromPaise(animatedLineAmount(line)) }}
                    </span>
                  </li>
                </ul>
                <p class="mt-4 text-xs text-slate-500">{{ t('platform.pricingTaxesNote') }}</p>
              </template>
              <router-link
                to="/start-trial"
                class="mt-8 flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                {{ t('platform.pricingCtaTrial') }}
              </router-link>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="border-t border-slate-200 px-6 py-8 text-center text-sm text-slate-500 dark:border-slate-800 lg:px-8">
      {{ t('platform.pricingFooter') }}
    </footer>
  </div>
</template>
