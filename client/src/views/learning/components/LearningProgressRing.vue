<template>
  <svg :class="sizeClass" viewBox="0 0 36 36" aria-hidden="true">
    <path
      class="fill-none stroke-gray-200 dark:stroke-gray-700"
      stroke-width="3"
      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
    />
    <path
      class="fill-none stroke-indigo-600 dark:stroke-indigo-400"
      stroke-width="3"
      stroke-linecap="round"
      :stroke-dasharray="`${clamped}, 100`"
      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
    />
    <text
      v-if="showLabel"
      x="18"
      y="20.5"
      class="fill-gray-700 text-[8px] font-semibold dark:fill-gray-200"
      text-anchor="middle"
    >
      {{ clamped }}%
    </text>
  </svg>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  percent: { type: Number, default: 0 },
  size: { type: String, default: 'md' },
  showLabel: { type: Boolean, default: false },
});

const clamped = computed(() => Math.max(0, Math.min(100, Math.round(Number(props.percent) || 0))));
const sizeClass = computed(() => (props.size === 'lg' ? 'h-14 w-14' : props.size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'));
</script>
