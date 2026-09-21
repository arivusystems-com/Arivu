<template>
  <component
    :is="hasLink ? 'router-link' : 'div'"
    v-bind="hasLink ? { to } : {}"
    class="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition dark:border-gray-700 dark:bg-gray-900"
    :class="hasLink ? 'hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-500/50' : 'opacity-80'"
  >
    <div
      class="relative flex h-28 items-end bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 px-4 py-3"
    >
      <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(circle at 20% 20%, white 0, transparent 40%), radial-gradient(circle at 80% 60%, white 0, transparent 35%)" />
      <p class="relative line-clamp-2 text-sm font-semibold text-white">{{ title }}</p>
    </div>
    <div class="flex flex-1 items-center justify-between gap-3 p-4">
      <div class="min-w-0">
        <p v-if="meta" class="truncate text-xs text-gray-500 dark:text-gray-400">{{ meta }}</p>
        <p v-if="statusLabel" class="mt-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
          {{ statusLabel }}
        </p>
      </div>
      <LearningProgressRing v-if="percent != null" :percent="percent" size="sm" />
    </div>
  </component>
</template>

<script setup>
import { computed } from 'vue';
import LearningProgressRing from './LearningProgressRing.vue';
import { isLearningCourseId } from '@/utils/learningIds';

const props = defineProps({
  to: { type: String, required: true },
  title: { type: String, required: true },
  meta: { type: String, default: '' },
  statusLabel: { type: String, default: '' },
  percent: { type: Number, default: null },
});

const hasLink = computed(() => {
  const path = String(props.to || '');
  const id = path.split('/').pop();
  return isLearningCourseId(id);
});
</script>
