<template>
  <details
    :open="isOpen"
    @toggle="handleToggle"
    class="accordion-section"
  >
    <summary class="accordion-section__summary cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-2 list-none py-2">
      <ChevronDownIcon
        :class="[
          'accordion-section__chevron w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-150 flex-shrink-0',
          isOpen ? 'rotate-0' : '-rotate-90'
        ]"
        aria-hidden="true"
      />
      <span :class="['flex-1 font-semibold text-gray-900 dark:text-white', titleClass]">{{ title }}</span>
      <slot name="badge" />
      <slot name="actions" />
    </summary>
    <div :class="['accordion-section__content mt-2', contentClass]">
      <slot />
    </div>
  </details>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, onMounted } from 'vue';
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
  },
  titleClass: {
    type: String,
    default: ''
  }
});

const { t } = useI18n();

const isOpen = ref(props.defaultOpen);

// Load state from localStorage
const loadState = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = localStorage.getItem(props.storageKey);
    if (stored !== null) {
      isOpen.value = stored === 'true';
    } else {
      // If no stored state, use defaultOpen
      isOpen.value = props.defaultOpen;
    }
  }
};

// Save state to localStorage
const saveState = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(props.storageKey, String(isOpen.value));
  }
};

const handleToggle = (event) => {
  isOpen.value = event.target.open;
  saveState();
};

onMounted(() => {
  loadState();
});
</script>

<style scoped>
.accordion-section__summary {
  user-select: none;
}

.accordion-section__summary::-webkit-details-marker {
  display: none;
}

.accordion-section__summary::marker {
  display: none;
}

.accordion-section__chevron {
  flex-shrink: 0;
}
</style>
