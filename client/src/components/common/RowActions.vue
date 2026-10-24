<template>
  <div class="flex items-center gap-1">
    <!-- View Button - Always visible (read permission is required to see the list) -->
    <button 
      @click.stop="$emit('view', row)"
      class="inline-flex items-center h-8 gap-1.5 px-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-sm" 
      :title="t('common.viewRecord')"
    >
      <EyeIcon class="w-4 h-4" />
    </button>

    <!-- Edit Button - Only if user has edit permission -->
    <button 
      v-if="authStore.can(module, 'edit')"
      @click.stop="$emit('edit', row)"
      class="inline-flex items-center h-8 gap-1.5 px-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-sm" 
      :title="t('actions.edit')"
    >
      <PencilSquareIcon class="w-4 h-4" />
    </button>

    <!-- Delete Button - edit permission is sufficient for marketing campaigns -->
    <button 
      v-if="canDeleteModule(module) && isRowDeletable(row)"
      @click.stop="$emit('delete', row)"
      class="inline-flex items-center h-8 gap-1.5 px-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-sm" 
      :title="t('actions.delete')"
    >
      <TrashIcon class="w-4 h-4" />
    </button>

    <!-- Custom Actions Slot -->
    <slot :row="row"></slot>
  </div>
</template>

<script setup>
import { useAuthStore } from '@/stores/authRegistry';
import { EyeIcon, PencilSquareIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  row: {
    type: Object,
    required: true
  },
  module: {
    type: String,
    required: true
  },
  canDeleteRow: {
    type: Function,
    default: () => true
  }
});

defineEmits(['view', 'edit', 'delete']);

const authStore = useAuthStore();

const CAMPAIGN_DELETABLE_STATUSES = new Set(['draft', 'completed', 'cancelled', 'failed', 'archived']);

function isRowDeletable(row) {
  if (props.module === 'campaigns') {
    return CAMPAIGN_DELETABLE_STATUSES.has(String(row?.status || ''));
  }
  return props.canDeleteRow(row);
}

function canDeleteModule(moduleKey) {
  if (moduleKey === 'campaigns') {
    return authStore.can('campaigns', 'edit');
  }
  return authStore.can(moduleKey, 'delete');
}
</script>

