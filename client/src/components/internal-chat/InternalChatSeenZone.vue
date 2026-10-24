<template>
  <div
    v-if="zone.visible"
    class="mt-1 flex items-center gap-1.5"
    :class="alignEnd ? 'justify-end' : 'justify-start'"
    :title="tooltipText"
  >
    <template v-if="zone.variant === 'dm'">
      <span
        class="inline-flex items-center gap-0.5 text-[11px] font-medium"
        :class="zone.allSeen
          ? 'text-primary-500 dark:text-primary-400'
          : 'text-neutral-400 dark:text-neutral-500'"
      >
        <CheckIcon
          class="h-3.5 w-3.5"
          :class="zone.allSeen ? '' : 'opacity-60'"
          aria-hidden="true"
        />
        <CheckIcon
          v-if="zone.seenBy.length || zone.allSeen"
          class="-ml-2 h-3.5 w-3.5"
          aria-hidden="true"
        />
        <span>{{ zone.allSeen ? t('internalChat.seenZoneSeen') : t('internalChat.seenZoneSent') }}</span>
      </span>
    </template>

    <template v-else-if="zone.variant === 'stack'">
      <div class="flex items-center -space-x-1.5">
        <span
          v-for="m in zone.seenBy.slice(0, 5)"
          :key="m.userId"
          class="inline-flex"
          :title="memberDisplayName(m)"
        >
          <AvatarInitials
            :first-name="m.firstName || ''"
            :last-name="m.lastName || ''"
            :email="m.email || ''"
            :avatar="m.avatar || ''"
            size="sm"
            class="[&>div]:!h-5 [&>div]:!w-5 [&>div]:!text-[9px] [&>img]:!h-5 [&>img]:!w-5 ring-2 ring-white dark:ring-neutral-950 rounded-full"
          />
        </span>
      </div>
      <span
        v-if="zone.seenBy.length > 5"
        class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400"
      >
        +{{ zone.seenBy.length - 5 }}
      </span>
      <span
        v-else-if="!zone.seenBy.length"
        class="text-[10px] text-neutral-400 dark:text-neutral-500"
      >
        {{ t('internalChat.seenZoneSent') }}
      </span>
    </template>

    <template v-else-if="zone.variant === 'aggregate'">
      <span class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
        {{ aggregateLabel }}
      </span>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckIcon } from '@heroicons/vue/24/solid';
import AvatarInitials from '@/components/ui/AvatarInitials.vue';
import { computeSeenZone, memberDisplayName } from '@/utils/internalChatSeenZone';
import { formatTime } from '@/utils/localeFormat';

const props = defineProps({
  mode: { type: String, default: 'private' },
  spaceType: { type: String, default: 'channel' },
  message: { type: Object, default: null },
  messages: { type: Array, default: () => [] },
  members: { type: Array, default: () => [] },
  myUserId: { type: [String, Object], default: '' },
  isAnchor: { type: Boolean, default: false },
  alignEnd: { type: Boolean, default: true },
  mentionFocused: { type: Boolean, default: false },
});

const { t } = useI18n();

const zone = computed(() => computeSeenZone({
  mode: props.mode,
  spaceType: props.spaceType,
  message: props.message,
  messages: props.messages,
  members: props.members,
  myUserId: props.myUserId,
  isAnchor: props.isAnchor,
}));

const aggregateLabel = computed(() => {
  if (!zone.value.visible || zone.value.variant !== 'aggregate') return '';
  if (zone.value.mentionFocused || props.mentionFocused) {
    return t('internalChat.seenZoneMentioned', {
      seen: zone.value.seenBy.length,
      total: zone.value.memberCount,
    });
  }
  return t('internalChat.seenZoneAggregate', {
    seen: zone.value.seenBy.length,
    total: zone.value.memberCount,
  });
});

const tooltipText = computed(() => {
  const z = zone.value;
  if (!z.visible) return '';
  if (z.variant === 'aggregate') return aggregateLabel.value;
  if (!z.seenBy.length) return t('internalChat.seenZoneNotYet');
  if (z.variant === 'dm' && z.allSeen && z.seenBy[0]?.lastReadAt) {
    try {
      const when = formatTime(z.seenBy[0].lastReadAt, {
        hour: 'numeric',
        minute: '2-digit',
      });
      return t('internalChat.seenZoneSeenAt', { time: when });
    } catch {
      /* fall through */
    }
  }
  const names = z.seenBy.slice(0, 4).map(memberDisplayName).filter(Boolean);
  if (z.seenBy.length <= 4) {
    return t('internalChat.seenZoneByNames', { names: names.join(', ') });
  }
  return t('internalChat.seenZoneByNamesMore', {
    names: names.join(', '),
    count: z.seenBy.length - 4,
  });
});
</script>
