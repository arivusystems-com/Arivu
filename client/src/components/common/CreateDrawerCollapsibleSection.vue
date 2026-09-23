<template>
  <section class="create-drawer-section">
    <button
      type="button"
      class="group -mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-2 rounded-lg px-1.5 py-2 text-left outline-none transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
      :aria-expanded="isOpen"
      :aria-controls="contentId"
      :aria-label="toggleAriaLabel"
      @click="toggle"
    >
      <span
        class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 ring-1 ring-gray-200 transition-colors group-hover:bg-white group-hover:text-gray-700 group-hover:shadow-sm dark:text-gray-400 dark:ring-gray-600 dark:group-hover:bg-gray-700 dark:group-hover:text-gray-200"
      >
        <ChevronDownIcon
          :class="[
            'h-3.5 w-3.5 transition-transform duration-200 ease-out',
            isOpen ? 'rotate-0' : '-rotate-90'
          ]"
          aria-hidden="true"
        />
      </span>
      <span
        class="min-w-0 flex-1 text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white"
      >
        {{ title }}
      </span>
      <slot name="actions" />
    </button>
    <div
      :id="contentId"
      class="grid transition-[grid-template-rows] duration-200 ease-out"
      :class="isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
      :aria-hidden="!isOpen"
      :inert="!isOpen"
    >
      <div class="min-h-0 overflow-hidden">
        <div :class="['pt-3', contentClass]">
          <slot />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronDownIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  storageKey: {
    type: String,
    required: true
  },
  defaultOpen: {
    type: Boolean,
    default: true
  },
  contentClass: {
    type: String,
    default: ''
  }
});

const { t } = useI18n();

const isOpen = ref(props.defaultOpen);
const contentId = `create-drawer-section-${props.storageKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

const toggleAriaLabel = computed(() => {
  const action = isOpen.value
    ? t('records.genericCollapseSection')
    : t('records.sectionExpand');
  return `${action}: ${props.title}`;
});

function loadState() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const stored = localStorage.getItem(props.storageKey);
  if (stored !== null) {
    isOpen.value = stored === 'true';
  } else {
    isOpen.value = props.defaultOpen;
  }
}

function saveState() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.setItem(props.storageKey, String(isOpen.value));
}

function toggle() {
  isOpen.value = !isOpen.value;
  saveState();
}

onMounted(loadState);
</script>
