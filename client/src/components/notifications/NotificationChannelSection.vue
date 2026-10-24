<template>
  <div
    v-if="available"
    class="border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 overflow-hidden"
  >
    <!-- Section header (collapsible) -->
    <button
      type="button"
      class="w-full flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      @click="isOpen = !isOpen"
      :aria-expanded="isOpen"
    >
      <div class="flex items-center gap-3 flex-1 text-left">
        <component :is="iconComponent" class="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <div>
          <h3 class="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
            {{ title }}
          </h3>
          <p class="mt-0.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            {{ description }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <span
          v-if="statusText"
          class="text-xs px-2 py-1 rounded-full"
          :class="statusClasses"
        >
          {{ statusText }}
        </span>
        <svg
          class="w-5 h-5 text-gray-400 transition-transform"
          :class="{ 'rotate-180': isOpen }"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.188l3.71-3.957a.75.75 0 1 1 1.1 1.02l-4.25 4.53a.75.75 0 0 1-1.1 0l-4.25-4.53a.75.75 0 0 1 .02-1.06Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </button>

    <!-- Section content -->
    <transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="transform scale-y-95 opacity-0"
      enter-to-class="transform scale-y-100 opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="transform scale-y-100 opacity-100"
      leave-to-class="transform scale-y-95 opacity-0"
    >
      <div
        v-if="isOpen"
        class="border-t border-gray-200 dark:border-gray-700 px-4 py-4 sm:px-5 sm:py-5 space-y-4"
      >
        <!-- Helper text -->
        <p
          v-if="helperText"
          class="text-xs sm:text-sm text-gray-600 dark:text-gray-400"
        >
          {{ helperText }}
        </p>

        <!-- Global toggle -->
        <div
          v-if="showGlobalToggle"
          class="flex items-center justify-between py-2"
        >
          <div>
            <label class="text-sm font-medium text-gray-900 dark:text-white">
              Enable {{ channelLabel }}
            </label>
            <p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
              {{ globalToggleDescription }}
            </p>
          </div>
          <button
            type="button"
            class="relative inline-flex h-11 w-11 sm:h-6 sm:w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:cursor-not-allowed"
            :class="globalToggleEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'"
            role="switch"
            :aria-checked="globalToggleEnabled"
            :aria-label="t('notifications.channelToggleAria', { channel: channelLabel })"
            :disabled="!available"
            @click="handleGlobalToggle"
          >
            <span
              aria-hidden="true"
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200"
              :class="globalToggleEnabled ? 'translate-x-5' : 'translate-x-0'"
            ></span>
          </button>
        </div>

        <!-- Channel-specific content slot -->
        <slot />
      </div>
    </transition>
  </div>

  <!-- Coming soon state -->
  <div
    v-else-if="showComingSoon"
    class="border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800/50 px-4 py-3 sm:px-5 sm:py-4"
  >
    <div class="flex items-center gap-3">
      <component :is="iconComponent" class="w-5 h-5 text-gray-400" />
      <div>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ title }}
        </h3>
        <p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
          {{ t('notifications.channelComingSoon') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed } from 'vue';
import {
  BellIcon,
  ChatBubbleLeftIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon
} from '@heroicons/vue/20/solid';

const { t } = useI18n();

const props = defineProps({
  channel: {
    type: String,
    required: true,
    validator: (v) => ['push', 'whatsapp', 'sms', 'email'].includes(v)
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  helperText: {
    type: String,
    default: ''
  },
  available: {
    type: Boolean,
    default: false
  },
  enabled: {
    type: Boolean,
    default: false
  },
  statusText: {
    type: String,
    default: ''
  },
  showGlobalToggle: {
    type: Boolean,
    default: true
  },
  globalToggleDescription: {
    type: String,
    default: ''
  },
  showComingSoon: {
    type: Boolean,
    default: false
  },
  defaultOpen: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['toggle']);

const isOpen = ref(props.defaultOpen);

const channelConfig = computed(() => ({
  push: { label: t('notifications.channelPush'), icon: BellIcon },
  whatsapp: { label: t('notifications.channelWhatsApp'), icon: ChatBubbleLeftIcon },
  sms: { label: t('notifications.channelSms'), icon: DevicePhoneMobileIcon },
  email: { label: t('notifications.channelEmail'), icon: EnvelopeIcon }
}));

const config = computed(() => channelConfig.value[props.channel] || channelConfig.value.email);
const channelLabel = computed(() => config.value.label);
const iconComponent = computed(() => config.value.icon);

const globalToggleEnabled = computed(() => props.enabled);

const statusClasses = computed(() => {
  if (props.statusText === 'Granted' || props.statusText === 'Active') {
    return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
  }
  if (props.statusText === 'Denied' || props.statusText === 'Disabled') {
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
  }
  return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
});

function handleGlobalToggle() {
  emit('toggle', !props.enabled);
}
</script>

