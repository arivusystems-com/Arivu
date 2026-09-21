<template>
  <Menu as="div" class="relative inline-block text-left" @click.stop>
    <MenuButton
      type="button"
      class="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
      :aria-label="t('analytics.rowActionsLabel')"
    >
      <EllipsisVerticalIcon class="h-5 w-5" />
    </MenuButton>
    <transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <MenuItems
        class="absolute right-0 z-20 mt-1 w-44 origin-top-right rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10"
      >
        <MenuItem v-if="canRun" v-slot="{ active }">
          <button
            type="button"
            :class="menuItemClass(active)"
            @click="$emit('run')"
          >
            {{ t('analytics.actionRun') }}
          </button>
        </MenuItem>
        <MenuItem v-if="canEdit" v-slot="{ active }">
          <button
            type="button"
            :class="menuItemClass(active)"
            @click="$emit('edit')"
          >
            {{ t('actions.edit') }}
          </button>
        </MenuItem>
        <MenuItem v-if="canCreate" v-slot="{ active }">
          <button
            type="button"
            :class="menuItemClass(active)"
            @click="$emit('duplicate')"
          >
            {{ t('analytics.actionDuplicate') }}
          </button>
        </MenuItem>
        <MenuItem v-if="canShare" v-slot="{ active }">
          <button
            type="button"
            :class="menuItemClass(active)"
            @click="$emit('share')"
          >
            {{ t('analytics.actionShare') }}
          </button>
        </MenuItem>
        <MenuItem v-if="canExport" v-slot="{ active }">
          <button
            type="button"
            :class="menuItemClass(active)"
            @click="$emit('export')"
          >
            {{ t('analytics.exportCsv') }}
          </button>
        </MenuItem>
        <MenuItem v-if="canArchive" v-slot="{ active }">
          <button
            type="button"
            :class="[menuItemClass(active), 'text-red-600 dark:text-red-400']"
            @click="$emit('archive')"
          >
            {{ t('analytics.actionArchive') }}
          </button>
        </MenuItem>
      </MenuItems>
    </transition>
  </Menu>
</template>

<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { EllipsisVerticalIcon } from '@heroicons/vue/24/outline';
import { useI18n } from 'vue-i18n';

defineProps<{
  canRun?: boolean;
  canEdit?: boolean;
  canCreate?: boolean;
  canShare?: boolean;
  canExport?: boolean;
  canArchive?: boolean;
}>();

defineEmits<{
  (e: 'run'): void;
  (e: 'edit'): void;
  (e: 'duplicate'): void;
  (e: 'share'): void;
  (e: 'export'): void;
  (e: 'archive'): void;
}>();

const { t } = useI18n();

function menuItemClass(active: boolean) {
  return [
    'block w-full px-3 py-2 text-left text-sm',
    active
      ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white'
      : 'text-neutral-700 dark:text-neutral-200',
  ];
}
</script>
