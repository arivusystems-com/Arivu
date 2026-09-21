<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import { Bars3Icon, XMarkIcon } from '@heroicons/vue/24/outline';
import { useColorMode } from '@/composables/useColorMode'
const navigation = [
  { name: 'Product', href: '#' },
  { name: 'Features', href: '#' },
  { name: 'Pricing', href: '/pricing', router: true },
  { name: 'About Us', href: '#' },
]

const mobileMenuOpen = ref(false);

const { colorMode, toggleColorMode } = useColorMode();
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <header class="absolute inset-x-0 top-0 z-50">
      <nav class="flex items-center justify-between p-6 lg:px-8" :aria-label="t('platform.landingPageGlobal')">
        <div class="flex lg:flex-1">
          <a href="#" class="-m-1.5 p-1.5">
            <span class="sr-only">{{ t('platform.landingPageNurtura2') }}</span>
            <img 
              :src="colorMode === 'dark' || colorMode === 'system' ? '/assets/nurtura_logo_dark.svg' : '/assets/nurtura_logo_light.svg'" 
              alt="Arivu Logo" 
              class="h-8 w-auto brightness-0 dark:brightness-100" 
            />  
          </a>
        </div>
        <div class="flex lg:hidden">
          <button type="button" class="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700 dark:text-gray-200" @click="mobileMenuOpen = true">
            <span class="sr-only">{{ t('platform.landingPageOpenMainMenu') }}</span>
            <Bars3Icon class="size-6" aria-hidden="true" />
          </button>
        </div>
        <div class="hidden lg:flex lg:gap-x-12">
          <template v-for="item in navigation" :key="item.name">
            <router-link
              v-if="item.router"
              :to="item.href"
              class="text-sm/6 font-semibold text-gray-900 dark:text-white"
            >{{ item.name }}</router-link>
            <a
              v-else
              :href="item.href"
              class="text-sm/6 font-semibold text-gray-900 dark:text-white"
            >{{ item.name }}</a>
          </template>
        </div>
          <div class="hidden lg:flex lg:flex-1 lg:justify-end">
            <router-link to="/login" class="text-sm/6 font-semibold text-gray-900 dark:text-white">{{ t('platform.landingPageLogIn2') }}<span aria-hidden="true">&rarr;</span></router-link>
          </div>
      </nav>
      <Dialog class="lg:hidden" @close="mobileMenuOpen = false" :open="mobileMenuOpen">
        <div class="fixed inset-0 z-50" />
        <DialogPanel class="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white dark:bg-gray-900 p-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
          <div class="flex items-center justify-between">
            <a href="#" class="-m-1.5 p-1.5">
              <span class="sr-only">{{ t('platform.landingPageNurtura') }}</span>
              <img 
              :src="colorMode === 'dark' || colorMode === 'system' ? '/assets/nurtura_logo_dark.svg' : '/assets/nurtura_logo_light.svg'" 
              alt="Arivu Logo" 
              class="h-8 w-auto brightness-0 dark:brightness-100" 
            />  
            </a>
            <button type="button" class="-m-2.5 rounded-md p-2.5 text-gray-700 dark:text-gray-200" @click="mobileMenuOpen = false">
              <span class="sr-only">{{ t('platform.landingPageCloseMenu') }}</span>
              <XMarkIcon class="size-6" aria-hidden="true" />
            </button>
          </div>
          <div class="mt-6 flow-root">
            <div class="-my-6 divide-y divide-gray-500/10 dark:divide-white/10">
              <div class="space-y-2 py-6">
                <template v-for="item in navigation" :key="item.name">
                  <router-link
                    v-if="item.router"
                    :to="item.href"
                    class="-mx-3 block rounded-lg px-3 py-2 text-base/7 font-semibold text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-white/5"
                    @click="mobileMenuOpen = false"
                  >{{ item.name }}</router-link>
                  <a
                    v-else
                    :href="item.href"
                    class="-mx-3 block rounded-lg px-3 py-2 text-base/7 font-semibold text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-white/5"
                  >{{ item.name }}</a>
                </template>
              </div>
              <div class="py-6">
                <router-link to="/login" class="-mx-3 block rounded-lg px-3 py-2.5 text-base/7 font-semibold text-gray-900 hover:bg-white/5 dark:text-white">{{ t('platform.landingPageLogIn') }}<span aria-hidden="true">→</span></router-link>
              </div>
            </div>
          </div>
        </DialogPanel>
      </Dialog>
    </header>

    <div class="relative isolate px-6 lg:px-8 pt-14 flex items-center justify-center">
      <div class="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
        <div class="relative left-[calc(50%-11rem)] aspect-1155/678 w-144.5 -translate-x-1/2 rotate-30 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] dark:from-[#ff80b5] dark:to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-288.75" style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" />
      </div>
      <div class="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
          <div class="hidden sm:mb-8 sm:flex sm:justify-center">
            <div class="relative rounded-full px-3 py-1 text-sm/6 text-gray-600 dark:text-gray-400 ring-1 ring-gray-900/10 dark:ring-white/10 hover:ring-gray-900/20 dark:hover:ring-white/20">{{ t('platform.landingPagePlugAndPlayToolForAny') }}<a href="#" class="font-semibold text-indigo-600 dark:text-indigo-400"><span class="absolute inset-0" aria-hidden="true" />{{ t('platform.landingPageReadMore') }}<span aria-hidden="true">&rarr;</span></a>
            </div>
          </div>
          <div class="text-center">
            <h1 class="text-balance text-5xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-7xl">{{ t('platform.landingPageDesignYourPerfectSalesFlow') }}</h1>
            <p class="mt-8 text-lg font-medium text-pretty text-gray-500 dark:text-gray-400 sm:text-xl-8">{{ t('platform.landingPageStopWrestlingWithBloatedCrmPlug') }}</p>
              <div class="mt-10 flex items-center justify-center gap-x-6">
                <router-link to="/start-trial" class="rounded-lg bg-indigo-600 dark:bg-indigo-500 px-8 py-3 text-lg font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">{{ t('platform.landingPageRequestDemo') }}</router-link>
                <router-link to="/login" class="text-md font-semibold text-gray-900 dark:text-white">{{ t('platform.landingPageAdminLogin') }}<span aria-hidden="true">→</span></router-link>
              </div>
          </div>
      </div>
      <div class="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]" aria-hidden="true">
        <div class="relative left-[calc(50%+3rem)] aspect-1155/678 w-144.5 -translate-x-1/2 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%+36rem)] sm:w-288.75" style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" />
      </div>
    </div>
  </div>
</template>



