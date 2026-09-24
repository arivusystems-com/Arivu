<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import {
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/authRegistry';
import { isOrganizationTrialExpired } from '@/utils/trialStatus';
import { getApiUrlForFetch } from '@/config/apiBase';

const emit = defineEmits(['settling']);

const { t } = useI18n();

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const SESSION_TRANSFER_HASH_KEY = 'ld_session';
const loginNotice = ref('');
const redirecting = ref(false);
const confirmSessionId = ref(null);
const autoContinuing = ref(false);
const googleEnabled = ref(false);
const googleStarting = ref(false);

watch(redirecting, (value) => {
  emit('settling', value);
}, { immediate: true });

const showSessionLimit = computed(() => Boolean(authStore.sessionLimit?.challengeId));
const canContinueLogin = computed(() => authStore.canContinueAfterSessionLimit());
const usage = computed(() => authStore.getSessionLimitUsage());
const recommendedSession = computed(() => authStore.getRecommendedSessionToRevoke());

const scrubLabel = (value) => {
  const raw = String(value || '').trim();
  if (!raw || /^unknown$/i.test(raw)) return null;
  return raw;
};

const conflictingSessions = computed(() => {
  const deviceClass = authStore.sessionLimit?.deviceClass === 'mobile' ? 'mobile' : 'desktop';
  return (authStore.sessionLimit?.sessions || []).filter(
    (s) => (s.deviceClass === 'mobile' ? 'mobile' : 'desktop') === deviceClass
  );
});

const deviceClassLabel = computed(() => (
  usage.value?.deviceClass === 'mobile'
    ? t('auth.sessionLimitDeviceMobile')
    : t('auth.sessionLimitDeviceDesktop')
));

const helperText = computed(() => {
  if (!usage.value) return '';
  if (usage.value.used < usage.value.max) {
    return t('auth.sessionLimitReady');
  }
  const need = Math.max(1, usage.value.needToFree || (usage.value.used - usage.value.max + 1));
  return t('auth.sessionLimitNeedFree', {
    count: need,
    deviceClass: deviceClassLabel.value.toLowerCase()
  });
});

const formatRelativeTime = (value) => {
  if (!value) return t('auth.sessionLimitUnknownTime');
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return t('auth.sessionLimitUnknownTime');
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 45) return t('auth.sessionLimitJustNow');
  if (diffSec < 3600) {
    return t('auth.sessionLimitMinutesAgo', { count: Math.max(1, Math.round(diffSec / 60)) });
  }
  if (diffSec < 86400) {
    return t('auth.sessionLimitHoursAgo', { count: Math.max(1, Math.round(diffSec / 3600)) });
  }
  return t('auth.sessionLimitDaysAgo', { count: Math.max(1, Math.round(diffSec / 86400)) });
};

const sessionPrimaryLabel = (session, index) => {
  const fromApi = scrubLabel(session.displayName);
  if (fromApi) return fromApi;

  const browser = scrubLabel(session.browser);
  const os = scrubLabel(session.os);
  if (browser && os) {
    return t('auth.sessionLimitBrowserOnOs', { browser, os });
  }
  if (browser) return browser;
  if (os) return os;

  return t('auth.sessionLimitNumberedSession', {
    deviceClass: deviceClassLabel.value,
    number: index + 1
  });
};

const sessionMetaLabel = (session) => {
  const parts = [formatRelativeTime(session.lastSeenAt)];
  if (session.ipAddress) parts.push(session.ipAddress);
  if (session.isRecent) parts.push(t('auth.sessionLimitBadgeRecent'));
  return parts.join(' · ');
};

const resolveInstanceLoginTarget = (instance) => {
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
};

const applyTransferredSessionFromHash = async () => {
  // Prefer the shared store helper (also used by the router guard). If the
  // hash was already consumed, there is nothing more to do.
  if (!window.location.hash.includes(`${SESSION_TRANSFER_HASH_KEY}=`)) {
    if (authStore.isAuthenticated && route.name === 'login') {
      redirecting.value = true;
      await router.replace(resolvePostLoginRoute());
    }
    return;
  }

  redirecting.value = true;
  const applied = authStore.applySessionTransferFromLocationHash();
  if (!applied) {
    redirecting.value = false;
    return;
  }

  await authStore.syncI18nFromOrganization();
  await syncTrialBeforeRoute();
  await completeSuccessfulLogin();
};

const applyGoogleAuthQuery = () => {
  const googleAuth = String(route.query.google_auth || '').trim();
  if (!googleAuth) return;

  if (googleAuth === 'session_limit') {
    authStore.applyGoogleSessionLimitFromLocationHash();
  } else if (googleAuth === 'error') {
    const code = String(route.query.google_code || '').trim();
    if (code === 'INVITE_PENDING') {
      authStore.error = t('auth.googleInvitePending');
    } else if (code === 'ACCOUNT_SUSPENDED') {
      authStore.error = t('auth.googleAccountSuspended');
    } else {
      authStore.error = t('auth.googleNotProvisioned');
    }
  }

  const nextQuery = { ...route.query };
  delete nextQuery.google_auth;
  delete nextQuery.google_code;
  router.replace({ name: 'login', query: nextQuery, hash: route.hash || undefined });
};

const resolvePostLoginRoute = () => {
  if (isOrganizationTrialExpired(authStore.organization)) {
    return { name: 'trial-expired' };
  }
  return authStore.resolvePostLoginRoute();
};

const syncTrialBeforeRoute = async () => {
  await authStore.syncTrialSubscription({ force: true });
};

const completeSuccessfulLogin = async () => {
  redirecting.value = true;
  await syncTrialBeforeRoute();

  const instance = authStore.lastLoginResult?.instance;
  const targetBaseUrl = resolveInstanceLoginTarget(instance);
  if (targetBaseUrl) {
    try {
      const target = new URL(targetBaseUrl);
      const isDifferentHost = target.host !== window.location.host;
      if (isDifferentHost) {
        const transferPayload = authStore.buildSessionTransferPayload();
        if (transferPayload) {
          const redirectUrl = new URL('/login', target.origin);
          redirectUrl.hash = `${SESSION_TRANSFER_HASH_KEY}=${encodeURIComponent(transferPayload)}`;
          window.location.assign(redirectUrl.toString());
          return;
        }
      }
    } catch (_error) {
      // Fall through to in-app redirect.
    }
  }

  await authStore.syncI18nFromOrganization();
  await new Promise(resolve => setTimeout(resolve, 100));
  await router.replace(resolvePostLoginRoute());
};

const handleLogin = async () => {
  redirecting.value = false;
  const result = await authStore.login({
    email: email.value,
    password: password.value
  });

  if (result === true) {
    await completeSuccessfulLogin();
  } else {
    redirecting.value = false;
  }
};

const handleContinueWithGoogle = () => {
  if (!googleEnabled.value || googleStarting.value) return;
  googleStarting.value = true;
  window.location.assign(getApiUrlForFetch('/api/auth/google'));
};

const loadGoogleLoginStatus = async () => {
  try {
    const response = await fetch(getApiUrlForFetch('/api/auth/google/status'), {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      googleEnabled.value = false;
      return;
    }
    const data = await response.json();
    googleEnabled.value = data?.enabled === true;
  } catch (_err) {
    googleEnabled.value = false;
  }
};

const doRevoke = async (sessionId) => {
  confirmSessionId.value = null;
  const ok = await authStore.revokeLoginSession(sessionId);
  if (ok && authStore.canContinueAfterSessionLimit() && !autoContinuing.value) {
    autoContinuing.value = true;
    await handleContinueAfterRevoke();
    autoContinuing.value = false;
  }
};

const handleRevokeSession = async (session) => {
  if (session?.isRecent && confirmSessionId.value !== session.id) {
    confirmSessionId.value = session.id;
    return;
  }
  await doRevoke(session.id);
};

const handleRevokeRecommended = async () => {
  const session = recommendedSession.value;
  if (!session?.id) return;
  await doRevoke(session.id);
};

const handleContinueAfterRevoke = async () => {
  const result = await authStore.continueLoginAfterSessionRevoke();
  if (result === true) {
    await completeSuccessfulLogin();
  }
};

const handleBackToCredentials = () => {
  confirmSessionId.value = null;
  authStore.clearSessionLimit();
  authStore.error = null;
};

watch(showSessionLimit, (visible) => {
  if (!visible) confirmSessionId.value = null;
});

onMounted(() => {
  const queryEmail = String(route.query.email || '').trim();
  if (queryEmail) {
    email.value = queryEmail;
  }
  if (String(route.query.verified || '') === '1') {
    loginNotice.value = t('auth.verifyEmailLoginNotice');
  }
  applyGoogleAuthQuery();
  void loadGoogleLoginStatus();
  void applyTransferredSessionFromHash();
});
</script>

<template>
  <!-- Settling UI is owned by Login.vue; keep this branch mounted but empty. -->
  <div v-if="redirecting" class="sr-only" aria-hidden="true" />

  <div v-else-if="showSessionLimit" class="space-y-4">
    <!-- Header -->
    <div class="space-y-1">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-base font-semibold text-white">
          {{ t('auth.sessionLimitTitle', { deviceClass: deviceClassLabel }) }}
        </h2>
        <span
          class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
          :class="canContinueLogin
            ? 'bg-emerald-500/15 text-emerald-300'
            : 'bg-amber-500/15 text-amber-200'"
        >
          {{ usage?.used ?? 0 }}/{{ usage?.max ?? 0 }}
        </span>
      </div>
      <p class="text-sm text-gray-400">
        {{ t('auth.sessionLimitVerifiedBody') }}
      </p>
    </div>

    <!-- Session list (blocking class only) -->
    <ul class="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <li
        v-for="(session, index) in conflictingSessions"
        :key="session.id"
        class="border-b border-white/5 last:border-b-0"
      >
        <div class="flex items-center gap-3 px-3.5 py-3">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-gray-300">
            <DevicePhoneMobileIcon
              v-if="session.deviceClass === 'mobile'"
              class="h-4 w-4"
              aria-hidden="true"
            />
            <ComputerDesktopIcon v-else class="h-4 w-4" aria-hidden="true" />
          </div>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-white">
              {{ sessionPrimaryLabel(session, index) }}
            </p>
            <p class="mt-0.5 truncate text-xs text-gray-500">
              {{ sessionMetaLabel(session) }}
            </p>
            <p
              v-if="confirmSessionId === session.id"
              class="mt-1.5 text-xs text-amber-300/90"
            >
              {{ t('auth.sessionLimitConfirmRecent') }}
            </p>
          </div>

          <button
            type="button"
            class="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition"
            :class="session.recommended && !canContinueLogin
              ? 'bg-white text-gray-900 hover:bg-gray-100'
              : 'text-red-300 hover:bg-red-500/10'"
            :disabled="authStore.loading"
            @click="handleRevokeSession(session)"
          >
            {{ confirmSessionId === session.id
              ? t('auth.sessionLimitConfirmSignOut')
              : (session.recommended && !canContinueLogin
                ? t('auth.sessionLimitFreeSlot')
                : t('auth.sessionLimitSignOut')) }}
          </button>
        </div>
      </li>
    </ul>

    <p v-if="authStore.error" class="error">{{ authStore.error }}</p>

    <!-- Actions -->
    <div class="space-y-2 pt-1">
      <button
        type="button"
        class="flex w-full justify-center rounded-lg bg-indigo-500 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-35"
        :disabled="authStore.loading || !canContinueLogin"
        @click="handleContinueAfterRevoke"
      >
        {{ authStore.loading ? t('auth.signingIn') : t('auth.sessionLimitContinue') }}
      </button>

      <p
        class="text-center text-xs"
        :class="canContinueLogin ? 'text-emerald-400' : 'text-gray-500'"
      >
        <template v-if="!canContinueLogin && recommendedSession">
          <button
            type="button"
            class="font-medium text-gray-300 underline-offset-2 hover:text-white hover:underline disabled:opacity-50"
            :disabled="authStore.loading"
            @click="handleRevokeRecommended"
          >
            {{ t('auth.sessionLimitFreeSlot') }}
          </button>
          <span class="mx-1.5 text-gray-600">·</span>
        </template>
        {{ helperText }}
      </p>

      <button
        type="button"
        class="flex w-full justify-center py-1.5 text-sm text-gray-500 transition hover:text-gray-300"
        :disabled="authStore.loading"
        @click="handleBackToCredentials"
      >
        {{ t('auth.sessionLimitBack') }}
      </button>
    </div>
  </div>

  <div v-else class="space-y-6">
    <div
      v-if="loginNotice"
      class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200"
    >
      {{ loginNotice }}
    </div>

    <div v-if="googleEnabled" class="space-y-4">
      <button
        type="button"
        class="flex w-full items-center justify-center gap-3 rounded-md bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 outline outline-1 outline-gray-300 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:outline-white/20 dark:hover:bg-gray-100"
        :disabled="authStore.loading || googleStarting"
        @click="handleContinueWithGoogle"
      >
        <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 2.9.7 3.6 1.4l2.4-2.4C16.5 3.8 14.5 3 12 3 6.9 3 2.8 7.1 2.8 12.2S6.9 21.4 12 21.4c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z" />
          <path fill="#34A853" d="M3.9 7.5l3 2.2C7.7 7.5 9.7 6.2 12 6.2c1.8 0 2.9.7 3.6 1.4l2.4-2.4C16.5 3.8 14.5 3 12 3 8.3 3 5.1 5.1 3.9 7.5z" />
          <path fill="#4A90E2" d="M12 21.4c2.4 0 4.4-.8 5.8-2.1l-2.8-2.2c-.7.5-1.7.9-3 .9-3.5 0-6.5-2.4-7.5-5.6l-3 2.3C3.9 18.9 7.6 21.4 12 21.4z" />
          <path fill="#FBBC05" d="M4.5 14.4c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9l-3-2.3C1.1 9.7.8 10.9.8 12.5s.3 2.8.9 4l2.8-2.1z" />
        </svg>
        {{ googleStarting ? t('auth.signingIn') : t('auth.continueWithGoogle') }}
      </button>

      <div class="relative">
        <div class="absolute inset-0 flex items-center" aria-hidden="true">
          <div class="w-full border-t border-gray-200 dark:border-white/10" />
        </div>
        <div class="relative flex justify-center text-xs">
          <span class="bg-white px-2 text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            {{ t('auth.orContinueWithEmail') }}
          </span>
        </div>
      </div>
    </div>

    <form class="space-y-6" @submit.prevent="handleLogin">
      <div>
        <label for="email" class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('auth.emailLabel') }}</label>
        <div class="mt-2">
          <input type="email" id="email" v-model="email" autocomplete="email" required :placeholder="t('auth.emailPlaceholder')"
            class="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6
              dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"/>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between">
          <label for="password" class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('auth.passwordLabel') }}</label>
          <div class="text-sm">
            <router-link to="/forgot-password" class="font-semibold text-indigo-400 hover:text-indigo-300">{{ t('auth.forgotPassword') }}</router-link>
          </div>
        </div>
        <div class="relative mt-2">
          <input
            :type="showPassword ? 'text' : 'password'"
            id="password"
            v-model="password"
            autocomplete="current-password"
            required
            :placeholder="t('auth.passwordPlaceholder')"
            class="block w-full rounded-md bg-gray-100 px-3 py-1.5 pr-10 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
          />
          <button
            type="button"
            class="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            @click="showPassword = !showPassword"
          >
            <EyeSlashIcon v-if="showPassword" class="h-4 w-4" aria-hidden="true" />
            <EyeIcon v-else class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div>
        <button type="submit" :disabled="authStore.loading" class="flex w-full justify-center rounded-md bg-indigo-500 px-3 py-2.5 text-md/0 font-semibold text-white hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
          {{ authStore.loading ? t('auth.signingIn') : t('auth.signIn') }}
        </button>
        <p v-if="authStore.error" class="error">{{ authStore.error }}</p>
      </div>
    </form>
  </div>
</template>
