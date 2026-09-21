<template>
  <Teleport to="body" defer>
    <div
      class="fixed inset-0 z-[10040] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
    >
      <div
        class="absolute inset-0 bg-neutral-950/55 backdrop-blur-[2px] dark:bg-black/70"
        aria-hidden="true"
        @click="onBackdrop"
      />
      <div class="relative z-10 w-full max-w-lg animate-[announcement-popover-in_180ms_ease-out]">
        <AnnouncementPopoverCard
          :key="announcement.id"
          :title="announcement.title"
          :short-description="announcement.shortDescription"
          :body="bodyText"
          :priority="announcement.priority"
          :image-url="announcement.content?.imageUrl"
          :youtube-url="announcement.content?.youtubeUrl"
          :attachments="announcement.content?.attachments"
          :ctas="announcement.ctas"
          :is-platform="isPlatform"
          :dismissible="announcement.userBehaviour?.dismissible !== false"
          :require-acknowledgement="announcement.userBehaviour?.requireAcknowledgement === true"
          :title-id="titleId"
          interactive
          @dismiss="onDismiss"
          @acknowledge="onAcknowledge"
          @cta="onCta"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  useAnnouncements,
  type AnnouncementCta,
  type AnnouncementViewModel,
} from '@/composables/useAnnouncements';
import AnnouncementPopoverCard from '@/components/announcements/AnnouncementPopoverCard.vue';

const props = defineProps<{
  announcement: AnnouncementViewModel;
}>();

const router = useRouter();
const { recordView, dismiss, acknowledge, clickCta } = useAnnouncements();

const titleId = 'announcement-popover-title';
const isPlatform = computed(() => (
  Boolean(props.announcement?.isPlatform || props.announcement?.ownership?.scope === 'platform')
));
const bodyText = computed(
  () => props.announcement?.content?.body || props.announcement?.detailedDescription || '',
);

async function trackView() {
  if (!props.announcement?.id) return;
  try {
    await recordView(props.announcement.id);
  } catch {
    // non-blocking
  }
}

onMounted(() => {
  void trackView();
});

watch(
  () => props.announcement?.id,
  () => {
    void trackView();
  },
);

function onBackdrop() {
  if (props.announcement?.userBehaviour?.dismissible === false) return;
  if (props.announcement?.userBehaviour?.requireAcknowledgement) return;
  void onDismiss();
}

async function onDismiss() {
  if (!props.announcement?.id) return;
  await dismiss(props.announcement.id);
}

async function onAcknowledge() {
  if (!props.announcement?.id) return;
  await acknowledge(props.announcement.id);
}

async function onCta(cta: AnnouncementCta | { id?: string; label: string; target?: string }) {
  if (!props.announcement?.id || !cta.id) return;
  const result = await clickCta(props.announcement.id, cta.id);
  const target = result?.target || cta.target;
  const actionType = result?.actionType || (cta as AnnouncementCta).actionType;
  if (!target) return;
  if (actionType === 'external_url' || /^https?:\/\//i.test(target)) {
    window.open(target, '_blank', 'noopener,noreferrer');
    return;
  }
  await router.push(target);
}
</script>

<style>
@keyframes announcement-popover-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
