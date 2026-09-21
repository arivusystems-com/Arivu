<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <div class="relative isolate px-6 py-10 pb-28 lg:px-8 lg:py-12">
      <div
        class="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
        aria-hidden="true"
      >
        <div
          class="relative left-[calc(50%-11rem)] aspect-1155/678 w-144.5 -translate-x-1/2 rotate-30 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-288.75"
          style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)"
        />
      </div>

      <div class="mx-auto w-full max-w-3xl">
        <header class="text-center">
          <img :src="brandLogoSrc" alt="Arivu" class="mx-auto h-10 w-auto" />
          <h1 class="mt-6 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            {{ pageTitle }}
          </h1>
          <p v-if="session?.email" class="mt-2 text-sm font-normal text-gray-500 dark:text-gray-400">
            {{ t('auth.trialSetupSignedInAs', { email: session.email }) }}
          </p>
        </header>

        <div v-if="bootLoading" class="mt-12 text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('auth.trialSetupLoading') }}</p>
        </div>

        <div
          v-else-if="fatalError"
          class="mx-auto mt-10 max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/40 dark:bg-red-950/30"
        >
          <h2 class="text-lg font-semibold text-red-900 dark:text-red-100">{{ fatalError }}</h2>
          <p v-if="fatalHint" class="mt-2 text-sm text-red-800 dark:text-red-200">{{ fatalHint }}</p>
          <button
            type="button"
            class="mt-5 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            @click="handleResendVerification"
          >
            {{ t('auth.trialSetupResendVerification') }}
          </button>
        </div>

        <template v-else>
          <div class="mt-8 flex items-center justify-center gap-2 sm:gap-3">
            <div
              v-for="(label, index) in stepLabels"
              :key="label"
              class="flex items-center gap-2 sm:gap-3"
            >
              <div
                class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold sm:h-9 sm:w-9 sm:text-sm"
                :class="stepClass(index + 1)"
              >
                {{ index + 1 }}
              </div>
              <span class="hidden text-sm font-medium text-gray-600 dark:text-gray-300 sm:inline">{{ label }}</span>
              <ChevronRightIcon v-if="index < stepLabels.length - 1" class="hidden h-4 w-4 text-gray-400 sm:block" />
            </div>
          </div>

          <section v-if="step === 'industry'" class="mt-8">
            <p class="mb-6 text-center text-sm font-normal text-gray-500 dark:text-gray-400">
              {{ t('auth.trialSetupIndustrySubtitle') }}
            </p>

            <div class="grid gap-3 sm:grid-cols-2">
              <button
                v-for="vertical in verticals"
                :key="vertical.label"
                type="button"
                class="group rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:p-5"
                :class="selectedIndustry === vertical.label
                  ? 'border-indigo-500 bg-indigo-50/80 ring-1 ring-indigo-500/30 dark:border-indigo-400 dark:bg-indigo-500/10 dark:ring-indigo-400/20'
                  : 'border-gray-200/80 bg-white/90 hover:border-gray-300 dark:border-white/10 dark:bg-gray-800/80 dark:hover:border-white/20'"
                @click="selectIndustry(vertical.label)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-gray-900 dark:text-white">
                      {{ cardDisplay(vertical).title }}
                    </p>
                    <p class="mt-1 text-sm font-normal leading-5 text-gray-500 dark:text-gray-400">
                      {{ cardDisplay(vertical).subtitle }}
                    </p>
                  </div>
                  <div
                    class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                    :class="selectedIndustry === vertical.label
                      ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-400 dark:bg-indigo-500'
                      : 'border-gray-300 dark:border-gray-600'"
                  >
                    <CheckIcon
                      v-if="selectedIndustry === vertical.label"
                      class="h-3 w-3 text-white"
                      aria-hidden="true"
                    />
                  </div>
                </div>

                <div class="mt-4 flex flex-wrap gap-1.5">
                  <span
                    v-for="highlight in cardDisplay(vertical).highlights"
                    :key="highlight"
                    class="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600 dark:bg-gray-900/60 dark:text-gray-300"
                  >
                    {{ highlight }}
                  </span>
                </div>

                <p class="mt-3 text-xs font-normal text-gray-400 dark:text-gray-500">
                  {{ cardDisplay(vertical).suite }}
                </p>
              </button>
            </div>
          </section>

          <section v-else class="mx-auto mt-8 w-full max-w-lg">
            <p class="mb-6 text-center text-sm font-normal text-gray-500 dark:text-gray-400">
              {{ t('auth.trialSetupAccountSubtitle') }}
            </p>

            <form
              class="space-y-5 rounded-2xl border border-gray-200/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-gray-800/90"
              @submit.prevent="submitSetup"
            >
              <div>
                <label for="workspaceName" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('auth.trialSetupWorkspaceName') }}
                </label>
                <input
                  id="workspaceName"
                  v-model="workspaceName"
                  type="text"
                  required
                  class="mt-2 block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('auth.acceptInvitePasswordLabel') }}
                </label>
                <input
                  id="password"
                  v-model="password"
                  type="password"
                  minlength="8"
                  required
                  autocomplete="new-password"
                  class="mt-2 block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('auth.acceptInviteConfirmPasswordLabel') }}
                </label>
                <input
                  id="confirmPassword"
                  v-model="confirmPassword"
                  type="password"
                  minlength="8"
                  required
                  autocomplete="new-password"
                  class="mt-2 block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <p v-if="selectedIndustry" class="text-xs font-normal text-gray-500 dark:text-gray-400">
                {{ t('auth.trialSetupSelectedIndustry', { industry: selectedIndustryDisplay }) }}
              </p>

              <p v-if="formError" class="text-sm font-normal text-red-600 dark:text-red-400">{{ formError }}</p>

              <div class="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  class="text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
                  @click="step = 'industry'"
                >
                  {{ t('auth.trialSetupBack') }}
                </button>
                <button
                  type="submit"
                  class="inline-flex items-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="submitting"
                >
                  <span v-if="submitting">{{ t('auth.trialSetupProvisioning') }}</span>
                  <span v-else>{{ t('auth.trialSetupLaunchWorkspace') }}</span>
                </button>
              </div>
            </form>
          </section>
        </template>
      </div>
    </div>

    <div
      v-if="step === 'industry' && !bootLoading && !fatalError"
      class="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200/80 bg-white/95 backdrop-blur-sm dark:border-white/10 dark:bg-gray-900/95"
    >
      <div class="mx-auto max-w-3xl px-6 py-4">
        <p
          v-if="selectedIndustry"
          class="mb-3 text-center text-sm font-normal text-gray-600 dark:text-gray-300"
        >
          {{ t('auth.trialSetupContinueSelected', { industry: selectedIndustryDisplay }) }}
        </p>
        <p v-else class="mb-3 text-center text-sm font-normal text-gray-500 dark:text-gray-400">
          {{ t('auth.trialSetupContinuePrompt') }}
        </p>
        <button
          type="button"
          class="flex w-full justify-center rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="!selectedIndustry"
          @click="step = 'account'"
        >
          {{ t('onboarding.continue') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { CheckIcon, ChevronRightIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import { useColorMode } from '@/composables/useColorMode';
import { getVerticalTrialCardDisplay } from '@/constants/verticalTrialCards';

const SETUP_TOKEN_KEY = 'arivu_demo_setup_token';
const SESSION_TRANSFER_HASH_KEY = 'ld_session';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { success, error: notifyError } = useNotifications();
const { colorMode } = useColorMode();

const bootLoading = ref(true);
const fatalError = ref('');
const fatalHint = ref('');
const setupToken = ref('');
const session = ref(null);
const verticals = ref([]);
const step = ref('industry');
const selectedIndustry = ref('');
const workspaceName = ref('');
const password = ref('');
const confirmPassword = ref('');
const formError = ref('');
const submitting = ref(false);

const isDarkUi = computed(
  () =>
    colorMode.value === 'dark' ||
    (colorMode.value === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches),
);

const brandLogoSrc = computed(() =>
  isDarkUi.value ? '/assets/logo/Logo_word_light.svg' : '/assets/logo/Logo_word_dark.svg',
);

const stepLabels = computed(() => [
  t('auth.trialSetupStepIndustry'),
  t('auth.trialSetupStepAccount'),
]);

const pageTitle = computed(() => (
  step.value === 'industry'
    ? t('auth.trialSetupTitleIndustry')
    : t('auth.trialSetupTitleAccount')
));

const selectedIndustryDisplay = computed(() => {
  const match = verticals.value.find((entry) => entry.label === selectedIndustry.value);
  if (!match) return selectedIndustry.value;
  return getVerticalTrialCardDisplay(match).title;
});

function cardDisplay(vertical) {
  return getVerticalTrialCardDisplay(vertical);
}

function stepClass(stepNumber) {
  const current = step.value === 'industry' ? 1 : 2;
  if (stepNumber < current) {
    return 'bg-indigo-600 text-white';
  }
  if (stepNumber === current) {
    return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200';
  }
  return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
}

function readStoredSetupToken() {
  try {
    return sessionStorage.getItem(SETUP_TOKEN_KEY) || '';
  } catch (_) {
    return '';
  }
}

function persistSetupToken(token) {
  setupToken.value = token;
  try {
    sessionStorage.setItem(SETUP_TOKEN_KEY, token);
  } catch (_) {}
}

function resolveInstanceLoginTarget(instance) {
  if (!instance?.subdomain) return null;

  const configuredTemplate = import.meta.env.VITE_INSTANCE_LOCAL_REDIRECT_TEMPLATE;
  const localProtocol = window.location.protocol || 'http:';
  const localPort = window.location.port ? `:${window.location.port}` : '';
  const defaultLocalTarget = `${localProtocol}//${instance.subdomain}.localhost${localPort}`;
  const fallbackTarget = instance.frontendUrl || defaultLocalTarget;
  const template = import.meta.env.DEV ? (configuredTemplate || defaultLocalTarget) : fallbackTarget;

  return String(template)
    .replace('{subdomain}', instance.subdomain)
    .replace('{port}', window.location.port || '');
}

async function navigateAfterSetup(instance, redirectTo = '/onboarding') {
  const targetBaseUrl = resolveInstanceLoginTarget(instance);
  if (targetBaseUrl) {
    try {
      const target = new URL(targetBaseUrl);
      if (target.host !== window.location.host) {
        const transferPayload = authStore.buildSessionTransferPayload();
        if (transferPayload) {
          const path = String(redirectTo).startsWith('/') ? String(redirectTo) : `/${redirectTo}`;
          const redirectUrl = new URL(path, target.origin);
          redirectUrl.hash = `${SESSION_TRANSFER_HASH_KEY}=${encodeURIComponent(transferPayload)}`;
          window.location.replace(redirectUrl.toString());
          return;
        }
      }
    } catch (_error) {
      // Fall through to in-app redirect.
    }
  }

  await router.replace(redirectTo);
}

async function loadSetupSession(token) {
  const data = await apiClient.get('/demo/setup/session', {
    headers: { 'X-Demo-Setup-Token': token },
  });

  if (!data?.success) {
    throw new Error(data?.message || t('auth.trialSetupSessionInvalid'));
  }

  session.value = data.session;
  verticals.value = Array.isArray(data.verticals) ? data.verticals : [];
  workspaceName.value = data.session?.companyName || '';
  if (data.session?.industry) {
    selectedIndustry.value = data.session.industry;
  }
}

const inFlightVerifyByToken = new Map();

async function verifyFromLink(rawVerifyToken) {
  let pending = inFlightVerifyByToken.get(rawVerifyToken);
  if (!pending) {
    pending = apiClient.post('/demo/verify-email', { token: rawVerifyToken }).then((data) => {
      if (!data?.success || !data.setupToken) {
        throw new Error(data?.message || t('auth.trialSetupVerifyFailed'));
      }
      return data;
    });
    inFlightVerifyByToken.set(rawVerifyToken, pending);
  }

  try {
    const data = await pending;
    persistSetupToken(data.setupToken);
    await loadSetupSession(data.setupToken);
    router.replace({ name: 'trial-setup' });
  } finally {
    inFlightVerifyByToken.delete(rawVerifyToken);
  }
}

async function bootstrap() {
  bootLoading.value = true;
  fatalError.value = '';
  fatalHint.value = '';

  try {
    const verifyToken = String(route.query.verify || '').trim();
    const setupQueryToken = String(route.query.setup || '').trim();
    if (verifyToken) {
      try {
        await verifyFromLink(verifyToken);
        success(t('auth.trialSetupVerifiedToast'));
        return;
      } catch (verifyErr) {
        const storedAfterVerify = setupToken.value || readStoredSetupToken();
        if (storedAfterVerify) {
          persistSetupToken(storedAfterVerify);
          await loadSetupSession(storedAfterVerify);
          router.replace({ name: 'trial-setup' });
          return;
        }
        throw verifyErr;
      }
    }

    if (setupQueryToken) {
      persistSetupToken(setupQueryToken);
      await loadSetupSession(setupQueryToken);
      router.replace({ name: 'trial-setup' });
      return;
    }

    const storedToken = setupToken.value || readStoredSetupToken();

    if (!storedToken) {
      fatalError.value = t('auth.trialSetupMissingTokenTitle');
      fatalHint.value = t('auth.trialSetupMissingTokenBody');
      return;
    }

    persistSetupToken(storedToken);
    await loadSetupSession(storedToken);
  } catch (err) {
    fatalError.value = err?.response?.data?.message || err.message || t('auth.trialSetupSessionInvalid');
    fatalHint.value = t('auth.trialSetupMissingTokenBody');
  } finally {
    bootLoading.value = false;
  }
}

function selectIndustry(label) {
  selectedIndustry.value = label;
}

async function handleResendVerification() {
  const email = session.value?.email || String(route.query.email || '').trim();
  if (!email) {
    notifyError(t('auth.trialSetupResendNeedsEmail'));
    return;
  }

  try {
    const data = await apiClient.post('/demo/resend-verification', { email });
    if (data?.success) {
      success(data.message || t('auth.trialSetupResendSuccess'));
    }
  } catch (err) {
    notifyError(err?.response?.data?.message || err.message || t('auth.trialSetupResendFailed'));
  }
}

async function submitSetup() {
  formError.value = '';

  if (password.value.length < 8) {
    formError.value = t('auth.trialSetupPasswordTooShort');
    return;
  }
  if (password.value !== confirmPassword.value) {
    formError.value = t('auth.acceptInvitePasswordMismatch');
    return;
  }
  if (!selectedIndustry.value) {
    formError.value = t('auth.trialSetupIndustryRequired');
    return;
  }

  submitting.value = true;
  try {
    const data = await apiClient.post(
      '/demo/setup/complete',
      {
        industry: selectedIndustry.value,
        workspaceName: workspaceName.value.trim(),
        password: password.value,
      },
      {
        headers: { 'X-Demo-Setup-Token': setupToken.value },
      }
    );

    if (!data?.success || !data.user) {
      throw new Error(data?.message || t('auth.trialSetupProvisionFailed'));
    }

    authStore.setUser(data.user);
    try {
      sessionStorage.removeItem(SETUP_TOKEN_KEY);
    } catch (_) {}

    await navigateAfterSetup(data.user?.instance || data.instance, '/onboarding');
  } catch (err) {
    formError.value = err?.response?.data?.message || err.message || t('auth.trialSetupProvisionFailed');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  bootstrap();
});
</script>
