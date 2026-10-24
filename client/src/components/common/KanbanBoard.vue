<template>
  <div class="kanban-board bg-gray-50/50 dark:bg-gray-900/50 overflow-hidden">
    <div class="overflow-x-auto pb-6">
      <!-- Group control (optional) -->
      <div v-if="$slots['group-control']" class="flex items-center gap-3 mb-5">
        <slot name="group-control" :stages="stages" />
      </div>

      <!-- Only replace the board on first load; soft reloads keep cards mounted (no flash). -->
      <div v-if="loading && !hasVisibleItems" class="flex items-center justify-center h-64">
        <div class="text-gray-500 dark:text-gray-400">{{ loadingLabel }}</div>
      </div>
      <div v-else class="flex gap-5 items-start" :class="loading && hasVisibleItems ? 'opacity-70 pointer-events-none' : ''">
        <template v-for="(stage, idx) in stages" :key="stage">
          <!-- Collapsed empty column: narrow bar with vertical label, count, expand button -->
          <div
            v-if="isColumnCollapsed(stage)"
            class="kanban-column-collapsed flex-none rounded-xl flex flex-col shadow-sm border border-gray-100 dark:border-gray-700/80 overflow-hidden shrink-0"
            :style="{ ...getColumnBgStyle(stage), width: collapsedColumnWidthPx, minWidth: collapsedColumnWidthPx, maxWidth: collapsedColumnWidthPx }"
            :class="resolveStageColor(stage) ? '' : 'bg-white dark:bg-gray-800/80'"
            :data-stage="stage"
          >
            <div
              class="flex flex-col items-center gap-2 py-3 px-1"
              :style="resolveStageColor(stage) ? { backgroundColor: resolveStageColor(stage) } : {}"
              :class="!resolveStageColor(stage) && 'bg-gray-100 dark:bg-gray-700/80'"
            >
              <!-- Vertical label: height grows with stage name length (rotated text extent) -->
              <div
                class="flex items-center justify-center py-1"
                :style="{ minHeight: getCollapsedLabelMinHeight(stage) }"
              >
                <span
                  class="font-semibold text-xs whitespace-nowrap w-full"
                  :class="resolveStageColor(stage) ? 'text-white/95' : 'text-gray-700 dark:text-gray-200'"
                  style="display: inline-block; transform: rotate(90deg); transform-origin: center center;"
                >
                  {{ stage }}
                </span>
              </div>
              <span
                :class="[
                  'text-xs font-bold tabular-nums inline-block',
                  resolveStageColor(stage) ? 'text-white/90' : 'text-gray-600 dark:text-gray-300'
                ]"
                style="transform: rotate(-90deg); transform-origin: center center;"
              >
                {{ (columnLists[stage] || []).length }}
              </span>
              <button
                type="button"
                class="p-1.5 rounded-lg shrink-0  hover:bg-white dark:hover:bg-gray-500/80 text-gray-600 dark:text-gray-300 transition-colors"
                :class="resolveStageColor(stage) ? 'text-white/90 bg-white/30 dark:bg-gray-600/30 hover:bg-white/50 dark:hover:bg-gray-500/50' : ''"
                :aria-label="t('common.kanbanExpandColumn')"
                @click="expandColumn(stage)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          <!-- Expanded column (default or non-empty) -->
          <div
            v-else
            class="kanban-column flex-none rounded-xl flex flex-col shadow-sm border border-gray-100 dark:border-gray-700/80 overflow-hidden"
            :style="{ ...getColumnBgStyle(stage), width: columnWidthPx, minWidth: columnWidthPx, maxWidth: columnWidthPx }"
            :class="!resolveStageColor(stage) && 'bg-white dark:bg-gray-800/80'"
            :data-stage="stage"
            :data-stage-index="idx"
          >
            <!-- Pill-shaped column header (uses picklist color when available) -->
            <div
              class="px-4 py-3 flex items-center justify-between gap-2 shrink-0"
              :style="resolveStageColor(stage) ? { backgroundColor: resolveStageColor(stage) } : {}"
              :class="!resolveStageColor(stage) && 'bg-gray-100 dark:bg-gray-700/80'"
            >
              <slot
                name="column-header"
                :stage="stage"
                :count="(columnLists[stage] || []).length"
                :stats="getColumnStats ? getColumnStats(stage) : undefined"
                :stage-color="resolveStageColor(stage)"
                :is-first="idx === 0"
                :is-last="idx === stages.length - 1"
              >
                <div
                  :class="[
                    'flex items-center gap-2.5 px-3 py-1.5 rounded-full min-w-0',
                    resolveStageColor(stage) ? 'bg-white/20 text-white' : 'bg-white/80 dark:bg-gray-600/80 text-gray-700 dark:text-gray-200'
                  ]"
                >
                  <span class="font-semibold text-sm truncate">{{ stage }}</span>
                  <span
                    :class="[
                      'flex-shrink-0 text-xs font-bold tabular-nums',
                      resolveStageColor(stage) ? 'text-white/90' : 'text-gray-600 dark:text-gray-300'
                    ]"
                  >
                    {{ (columnLists[stage] || []).length }}
                  </span>
                </div>
              </slot>
            </div>

            <!-- Droppable list (grows with content, scrolls when tall); taller when stats closed -->
            <div
              class="p-3 overflow-y-auto flex flex-col"
              :class="[
                statsOpen ? 'max-h-[calc(100vh-380px)]' : 'max-h-[calc(100vh-260px)]',
                !resolveStageColor(stage) && 'bg-white dark:bg-gray-800/50'
              ]"
              :style="getColumnBgStyle(stage)"
            >
              <draggable
                :list="columnLists[stage]"
                :item-key="itemIdKey"
                :group="{ name: groupName, pull: true, put: true }"
                class="kanban-column-list flex flex-col gap-3"
                ghost-class="kanban-ghost"
                drag-class="kanban-drag"
                chosen-class="kanban-chosen"
                @change="(evt) => onListChange(evt, stage)"
              >
                <template #item="{ element }">
                  <div
                    class="kanban-card min-w-0 bg-white dark:bg-gray-900 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-gray-700/80 cursor-grab hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200 active:cursor-grabbing"
                    :data-id="element[itemIdKey]"
                    @click="(e) => $emit('card-click', { item: element, event: e })"
                  >
                    <slot name="card" :item="element" :stage="stage">
                      {{ element[itemIdKey] }}
                    </slot>
                  </div>
                </template>
                <template #footer>
                  <div v-if="(columnLists[stage] || []).length === 0 && !$slots['add-item']" class="flex-1 flex items-center justify-center py-12 text-gray-400 dark:text-gray-500 pointer-events-none">
                    <slot name="empty" :stage="stage">
                      <p class="text-sm">{{ t('common.kanbanNoItems') }}</p>
                    </slot>
                  </div>
                  <div v-if="$slots['add-item']" class="shrink-0">
                    <slot name="add-item" :stage="stage" :count="(columnLists[stage] || []).length" :is-empty="(columnLists[stage] || []).length === 0" :stage-color="resolveStageColor(stage)" />
                  </div>
                </template>
              </draggable>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import draggable from 'vuedraggable';

const props = defineProps({
  /** Full list of items (records) */
  items: { type: Array, default: () => [] },
  /** Ordered list of stage/column ids (e.g. ['Qualification', 'Proposal', ...]) */
  stages: { type: Array, required: true },
  /** Field on each item that holds the stage (e.g. 'stage', 'status') */
  stageKey: { type: String, required: true },
  /** Field on each item for unique id (e.g. '_id') */
  itemIdKey: { type: String, default: '_id' },
  loading: { type: Boolean, default: false },
  loadingLabel: { type: String, default: 'Loading...' },
  /** Optional: return stats for column header (e.g. { value: 12345 }) */
  getColumnStats: { type: Function, default: null },
  /** Unique group name when multiple boards on page */
  groupName: { type: String, default: 'kanban' },
  /** Optional: (stage) => color string (hex) or null. When provided, column header uses this background color from picklist. */
  getStageColor: { type: Function, default: () => null },
  /** Card size from Customize Kanban: 'small' | 'medium' | 'large' */
  cardSize: { type: String, default: 'medium' },
  /** When true, columns with 0 items render as narrow bars with expand button */
  collapseEmptyColumns: { type: Boolean, default: false },
  /** When true, stats panel is open and column list uses shorter max-height; when false, Kanban gets more height */
  statsOpen: { type: Boolean, default: true },
});

const emit = defineEmits(['update', 'card-click']);

const hasVisibleItems = computed(() => Array.isArray(props.items) && props.items.length > 0);

// Card size controls column width only (not card padding). Default: medium.
const columnWidthPx = computed(() => {
  const s = props.cardSize || 'medium';
  if (s === 'small') return '280px';
  if (s === 'large') return '360px';
  return '320px'; // medium
});

// Wide enough for longest stage name when rotated (layout still uses pre-rotation width)
const collapsedColumnWidthPx = '42px';

/** Min-height for collapsed label area so rotated text fits; grows with stage name length. */
function getCollapsedLabelMinHeight(stage) {
  const len = (stage && stage.length) || 0;
  const px = Math.max(40, Math.ceil(len * 6.5) + 16);
  return `${px}px`;
}

function resolveStageColor(stage) {
  return props.getStageColor ? props.getStageColor(stage) : null;
}

function hexToRgba(hex, alpha) {
  if (!hex) return null;
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getColumnBgStyle(stage) {
  const color = resolveStageColor(stage);
  if (!color) return {};
  return { backgroundColor: hexToRgba(color, 0.03) };
}

// Per-column arrays; mutated by draggable. Synced from props.items.
function syncFromItems() {
  const stages = props.stages || [];
  const items = props.items || [];
  const stageKey = props.stageKey;
  const next = {};
  for (const s of stages) {
    next[s] = items.filter((i) => i[stageKey] === s).slice();
  }
  return next;
}

const columnLists = ref(syncFromItems());

// When collapseEmptyColumns is true, empty columns are collapsed unless user expanded them.
const forceExpandedStages = ref(new Set());
function isColumnCollapsed(stage) {
  if (!props.collapseEmptyColumns) return false;
  const count = (columnLists.value[stage] || []).length;
  if (count > 0) return false;
  return !forceExpandedStages.value.has(stage);
}
function expandColumn(stage) {
  forceExpandedStages.value = new Set([...forceExpandedStages.value, stage]);
}
// When a column gets items, remove from force-expanded so it auto-collapses when empty again
watch(
  columnLists,
  () => {
    if (!props.collapseEmptyColumns || !props.stages) return;
    let changed = false;
    const next = new Set(forceExpandedStages.value);
    for (const stage of props.stages) {
      if ((columnLists.value[stage] || []).length > 0 && next.has(stage)) {
        next.delete(stage);
        changed = true;
      }
    }
    if (changed) forceExpandedStages.value = next;
  },
  { deep: true }
);

onMounted(() => {
  columnLists.value = syncFromItems();
});
// Sync when items reference or stages/stageKey change (not on deep item changes, so drag doesn’t overwrite lists)
watch(
  () => [props.items, props.stages, props.stageKey],
  () => { columnLists.value = syncFromItems(); },
  { deep: false }
);

function onListChange(evt, stage) {
  if (evt.added) {
    const item = evt.added.element;
    const newIndex = evt.added.newIndex;
    const previousStage = item[props.stageKey];
    item[props.stageKey] = stage;
    emit('update', {
      item,
      previousStage,
      newStage: stage,
      newIndex,
      previousIndex: evt.removed?.oldIndex,
    });
  } else if (evt.moved) {
    const item = evt.moved.element;
    emit('update', {
      item,
      previousStage: stage,
      newStage: stage,
      newIndex: evt.moved.newIndex,
      previousIndex: evt.moved.oldIndex,
    });
  }
}
</script>

<style scoped>
.kanban-ghost {
  opacity: 0.5;
  background: rgb(219 234 254); /* blue-100 */
  transform: rotate(1deg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
:global(.dark) .kanban-ghost {
  background: rgb(30 58 138); /* blue-900 */
}
.kanban-drag {
  opacity: 1;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
.kanban-chosen {
  cursor: grabbing;
}
</style>
