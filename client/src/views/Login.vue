<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useColorMode } from '@/composables/useColorMode';
import LoginForm from '@/components/LoginForm.vue';

const { t } = useI18n();
const { colorMode } = useColorMode();

/** Matches Tailwind dark mode: explicit dark, or system when OS prefers dark */
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

const isSettling = ref(false);
const showSlowHint = ref(false);
let slowHintTimer = null;

watch(isSettling, (settling) => {
  if (slowHintTimer) {
    clearTimeout(slowHintTimer);
    slowHintTimer = null;
  }
  showSlowHint.value = false;
  if (settling) {
    slowHintTimer = setTimeout(() => {
      showSlowHint.value = true;
    }, 1600);
  }
});

onUnmounted(() => {
  if (slowHintTimer) clearTimeout(slowHintTimer);
});

const onSettling = (value) => {
  isSettling.value = Boolean(value);
};
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <div class="relative isolate px-6 lg:px-8 pt-14 flex items-center justify-center">
      <div
        class="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
        aria-hidden="true"
      >
        <div
          class="relative left-[calc(50%-11rem)] aspect-1155/678 w-144.5 -translate-x-1/2 rotate-30 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] dark:from-[#ff80b5] dark:to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-288.75"
          style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)"
        />
      </div>
      <div class="mx-auto max-w-2xl sm:w-full sm:max-w-sm md:min-w-md py-32 sm:py-48 lg:py-32 transition-all duration-300">
        <div class="flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div class="sm:mx-auto sm:w-full sm:max-w-sm">
            <img
              :src="brandLogoSrc"
              alt="Arivu"
              class="mx-auto h-10 w-auto origin-center"
              :class="{ 'login-logo-breathe': isSettling }"
            />

            <h2
              v-if="!isSettling"
              class="mt-6 text-center text-2xl/9 font-bold tracking-tight text-gray-900 dark:text-white"
            >
              {{ t('auth.signInTitle') }}
            </h2>
          </div>

          <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm md:max-w-md">
            <div
              v-if="isSettling"
              class="flex flex-col items-center py-2"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <p class="text-sm font-medium tracking-tight text-gray-700 dark:text-gray-200">
                {{ t('auth.signingYouIn') }}
              </p>
              <p
                class="mt-1.5 min-h-4 text-center text-xs text-gray-400 dark:text-gray-500 transition-opacity duration-500"
                :class="showSlowHint ? 'opacity-100' : 'opacity-0'"
              >
                {{ t('auth.signingYouInSlow') }}
              </p>
              <div
                class="mt-7 h-[2px] w-36 overflow-hidden rounded-full bg-gray-200/90 dark:bg-gray-700/90"
                aria-hidden="true"
              >
                <div class="login-indeterminate-bar h-full w-1/2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
              </div>
            </div>

            <LoginForm @settling="onSettling" />

            <p
              v-if="!isSettling"
              class="mt-10 text-center text-smd/6 text-gray-500"
            >
              {{ t('auth.noAccount') }}
              {{ ' ' }}
              <router-link to="/start-trial" class="font-semibold text-indigo-600 hover:text-indigo-500">
                {{ t('auth.requestDemo') }}
              </router-link>
            </p>
          </div>
        </div>
      </div>

      <div
        class="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]"
        aria-hidden="true"
      >
        <div
          class="relative left-[calc(50%+3rem)] aspect-1155/678 w-144.5 -translate-x-1/2 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%+36rem)] sm:w-288.75"
          style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes login-logo-breathe {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.82;
    transform: scale(0.985);
  }
}

@keyframes login-indeterminate {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(240%);
  }
}

.login-logo-breathe {
  animation: login-logo-breathe 2.4s ease-in-out infinite;
}

.login-indeterminate-bar {
  animation: login-indeterminate 1.15s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@media (prefers-reduced-motion: reduce) {
  .login-logo-breathe,
  .login-indeterminate-bar {
    animation: none;
  }

  .login-logo-breathe {
    opacity: 0.9;
  }

  .login-indeterminate-bar {
    width: 40%;
    margin-inline: auto;
    opacity: 0.7;
  }
}
</style>
