<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[10100] flex items-center justify-center bg-black/40 p-4"
      @click.self="emit('cancel')"
    >
      <div
        role="dialog"
        aria-modal="true"
        class="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700"
      >
        <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('duplicates.warningTitle') }}
          </h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ t('duplicates.warningBody', { module: moduleLabel }) }}
          </p>
        </div>
        <div class="px-5 py-4 space-y-3 max-h-64 overflow-y-auto">
          <div
            v-for="(m, i) in matches"
            :key="m.record?._id || i"
            class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/20 px-3 py-2"
          >
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ displayName(m.record) }}
            </p>
            <p v-if="m.record?.email" class="text-xs text-gray-600 dark:text-gray-400">{{ m.record.email }}</p>
            <p v-if="m.record?.phone" class="text-xs text-gray-600 dark:text-gray-400">{{ m.record.phone }}</p>
            <p class="text-xs text-amber-800 dark:text-amber-300 mt-1">
              {{ (m.matchedFields || []).map((f) => f.field).join(', ') }}
            </p>
          </div>
        </div>
        <div class="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600"
            @click="emit('cancel')"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            v-if="primaryMatchId"
            type="button"
            class="px-3 py-1.5 text-sm rounded border border-indigo-300 text-indigo-700 dark:text-indigo-300"
            @click="emit('view', primaryMatchId)"
          >
            {{ t('duplicates.viewRecord') }}
          </button>
          <button
            v-if="primaryMatchId && canCompareMerge"
            type="button"
            class="px-3 py-1.5 text-sm rounded bg-indigo-600 text-white"
            @click="emit('compare', primaryMatchId)"
          >
            {{ t('duplicates.compareMerge') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  open: { type: Boolean, default: false },
  moduleKey: { type: String, default: 'people' },
  matches: { type: Array, default: () => [] },
});

const emit = defineEmits(['cancel', 'view', 'compare']);
const { t } = useI18n();

const moduleLabel = computed(() => {
  if (props.moduleKey === 'people') return t('duplicates.modulePeople');
  if (props.moduleKey === 'organizations') return t('duplicates.moduleOrganizations');
  if (props.moduleKey === 'items') return t('duplicates.moduleItems');
  if (props.moduleKey === 'deals') return t('duplicates.moduleDeals');
  if (props.moduleKey === 'tasks') return t('duplicates.moduleTasks');
  if (props.moduleKey === 'cases') return t('duplicates.moduleCases');
  return props.moduleKey;
});

const MERGEABLE_MODULES = new Set(['people', 'organizations', 'items']);
const canCompareMerge = computed(() => MERGEABLE_MODULES.has(String(props.moduleKey || '').toLowerCase()));

const primaryMatchId = computed(() => props.matches[0]?.record?._id || null);

function displayName(record) {
  if (!record) return '';
  return record.name || record.title || record.item_name || record.caseId || record.email || record.item_code || String(record._id);
}
</script>
