<!--
  ============================================================================
  EVENT QUICK CREATE DRAWER
  ============================================================================
  
  ARCHITECTURAL INTENT:
  - Opens CreateRecordDrawer in quick-create mode (same tab, not navigation)
  - Uses Settings-driven quick-create fields for events (no hardcoded field list)
  - Supports full form via drawer toggle ("Show all fields")
  
  See: docs/architecture/event-settings.md
  ============================================================================
-->

<template>
  <CreateRecordDrawer
    :isOpen="isOpen"
    moduleKey="events"
    :initial-data="initialData"
    :quickCreateMode="true"
    @close="handleClose"
    @saved="handleSaved"
  />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  initialData: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['close', 'saved']);

const { t } = useI18n();

const handleClose = () => {
  emit('close');
};

const handleSaved = (event: unknown) => {
  emit('saved', event);
};
</script>
