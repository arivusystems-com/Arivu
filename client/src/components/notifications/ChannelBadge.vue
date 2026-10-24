<template>
  <div
    class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors"
    :class="[badgeClasses, clickable ? 'cursor-pointer hover:opacity-80' : '']"
    :title="tooltip"
    @click="clickable && $emit('click')"
  >
    <component :is="iconComponent" class="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
    <span>{{ label }}</span>
    <svg
      v-if="enabled"
      class="w-3 h-3"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16.704 5.29a1 1 0 0 0-1.408-1.42L8 11.293 4.707 8a1 1 0 0 0-1.414 1.414l4 4a1 1 0 0 0 1.414 0l8-8.125Z"
        fill="currentColor"
      />
    </svg>
    <svg
      v-else-if="!available"
      class="w-3 h-3"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 3a7 7 0 1 0 0 14A7 7 0 0 0 10 3ZM5 10a5 5 0 1 1 10 0A5 5 0 0 1 5 10Z"
        fill="currentColor"
      />
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  BellAlertIcon,
  BellIcon,
  ChatBubbleLeftIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon
} from '@heroicons/vue/20/solid';

defineEmits(['click']);

const { t } = useI18n();

const props = defineProps({
  channel: {
    type: String,
    required: true,
    validator: (v) => ['inApp', 'email', 'push', 'whatsapp', 'sms'].includes(v)
  },
  enabled: {
    type: Boolean,
    default: false
  },
  available: {
    type: Boolean,
    default: true
  },
  clickable: {
    type: Boolean,
    default: false
  }
});

const channelConfig = computed(() => ({
  inApp: {
    label: t('notifications.channelInApp'),
    icon: BellAlertIcon
  },
  email: {
    label: t('notifications.channelEmail'),
    icon: EnvelopeIcon
  },
  push: {
    label: t('notifications.channelPush'),
    icon: BellIcon
  },
  whatsapp: {
    label: t('notifications.channelWhatsApp'),
    icon: ChatBubbleLeftIcon
  },
  sms: {
    label: t('notifications.channelSms'),
    icon: DevicePhoneMobileIcon
  }
}));

const config = computed(() => channelConfig.value[props.channel] || channelConfig.value.inApp);
const label = computed(() => config.value.label);
const iconComponent = computed(() => config.value.icon);

const badgeClasses = computed(() => {
  if (!props.available) {
    return 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed';
  }
  if (props.enabled) {
    return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300';
  }
  return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400';
});

const tooltip = computed(() => {
  const channel = label.value;
  if (!props.available) {
    return t('notifications.channelUnavailableTooltip', { channel });
  }
  if (props.enabled) {
    return t('notifications.channelEnabledTooltip', { channel });
  }
  return t('notifications.channelDisabledTooltip', { channel });
});
</script>
