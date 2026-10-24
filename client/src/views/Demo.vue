<script setup>
defineOptions({ name: 'DemoView' });
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useColorMode } from '@/composables/useColorMode';
import DemoRequestForm from '@/components/DemoRequestForm.vue';

const { t } = useI18n();
const { colorMode } = useColorMode();
const verificationPending = ref(false);

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
</script>

<template>
    <div class="min-h-screen bg-white dark:bg-gray-900">
    <div class="relative isolate px-6 lg:px-8 pt-14 flex items-center justify-center">
      <div class="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
        aria-hidden="true">
        <div
          class="relative left-[calc(50%-11rem)] aspect-1155/678 w-144.5 -translate-x-1/2 rotate-30 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] dark:from-[#ff80b5] dark:to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-288.75"
          style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" />
      </div>
      <div class="mx-auto max-w-2xl sm:w-full sm:max-w-sm md:min-w-lg py-4 sm:py-4 lg:py-4 md:py-4 transition-all duration-300">
        <div class="flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div class="sm:mx-auto sm:w-full sm:max-w-sm">
            <img
              :src="brandLogoSrc"
              alt="Arivu"
              class="mx-auto h-10 w-auto"
            />

            <h2
              v-if="!verificationPending"
              class="mt-6 text-center text-2xl/9 font-bold tracking-tight text-gray-900 dark:text-white"
            >
              {{ t('auth.startTrialPageTitle') }}
            </h2>
          </div>

          <div
            class="sm:mx-auto sm:w-full sm:max-w-sm md:max-w-md"
            :class="verificationPending ? 'mt-8' : 'mt-10'"
          >
            <DemoRequestForm @verification-pending-change="verificationPending = $event" />

            <p v-if="!verificationPending" class="mt-10 text-center text-md/6 text-gray-500">
              Already have an account?
              {{ ' ' }}
              <router-link to="/login" class="font-semibold text-indigo-600 hover:text-indigo-500">Log in</router-link>
            </p>
          </div>
        </div>
      </div>
      
      <div
        class="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]"
        aria-hidden="true">
        <div
          class="relative left-[calc(50%+3rem)] aspect-1155/678 w-144.5 -translate-x-1/2 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%+36rem)] sm:w-288.75"
          style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" />
      </div>
    </div>
  </div>




  <!-- <div class="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-indigo-900/20">
    

    <div class="absolute top-4 right-4 flex gap-2 animate-fade-in">
      <button 
        @click="toggleColorMode('light')" 
        :class="{'ring-2 ring-indigo-500 scale-105': colorMode === 'light'}" 
        class="p-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm hover:shadow-md"
      >
        <span class="text-lg">☀️</span>
        <span class="ml-1.5 text-gray-700 dark:text-gray-300">Light</span>
      </button>
      <button 
        @click="toggleColorMode('dark')" 
        :class="{'ring-2 ring-indigo-500 scale-105': colorMode === 'dark'}" 
        class="p-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm hover:shadow-md"
      >
        <span class="text-lg">🌙</span>
        <span class="ml-1.5 text-gray-700 dark:text-gray-300">Dark</span>
      </button>
      <button 
        @click="toggleColorMode('system')" 
        :class="{'ring-2 ring-indigo-500 scale-105': colorMode === 'system'}" 
        class="p-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm hover:shadow-md"
      >
        <span class="text-lg">💻</span>
        <span class="ml-1.5 text-gray-700 dark:text-gray-300">Auto</span>
      </button>
    </div>


    <div class="w-full max-w-2xl animate-slide-up">
      <div class="card p-8 shadow-2xl">
        

        <div class="flex flex-col items-center mb-8">
          <div class="bg-gradient-to-br from-indigo-500 to-indigo-600 p-3 rounded-2xl shadow-lg mb-4">
            <img 
              :src="colorMode === 'dark' || colorMode === 'system' ? '/assets/nurtura_logo_dark.svg' : '/assets/nurtura_logo_light.svg'" 
              alt="Arivu Logo" 
              class="h-10 w-auto brightness-0 invert" 
            />  
          </div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Request a Demo</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1 text-center">See how Arivu can transform your business</p>
        </div>


        <div class="transition-all duration-300">
          <DemoRequestForm />
        </div>


        <div class="mt-6 text-center">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Already have an account? 
            <router-link to="/login" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold hover:underline">
              Sign In
            </router-link>
          </p>
        </div>
      </div>


      <div class="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        <p>© 2025 Arivu. All rights reserved.</p>
      </div>
    </div>
  </div> -->
</template>
