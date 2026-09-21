<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[10100] flex justify-end bg-black/40"
      @click.self="emit('close')"
    >
      <aside
        class="h-full w-full max-w-2xl bg-white dark:bg-gray-900 shadow-xl border-l border-gray-200 dark:border-gray-700 flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <header class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('duplicates.compareTitle') }}</h2>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('duplicates.compareHint') }}</p>
          </div>
          <button type="button" class="text-sm text-gray-500 hover:text-gray-800" @click="emit('close')">
            {{ t('actions.close') }}
          </button>
        </header>

        <div v-if="loading" class="flex-1 flex items-center justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>

        <div v-else class="flex-1 overflow-y-auto p-5 space-y-5">
          <RadioGroup v-model="masterSide" class="grid grid-cols-2 gap-3">
            <RadioGroupOption
              v-slot="{ checked }"
              value="A"
              as="template"
            >
              <button
                type="button"
                class="rounded-lg border p-3 text-left cursor-pointer"
                :class="checked ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700'"
              >
                <p class="text-xs font-medium text-gray-500">{{ t('duplicates.recordA') }}</p>
                <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ labelA }}</p>
                <p class="text-xs text-indigo-600 mt-1">{{ t('duplicates.selectAsMaster') }}</p>
              </button>
            </RadioGroupOption>
            <RadioGroupOption
              v-slot="{ checked }"
              value="B"
              as="template"
            >
              <button
                type="button"
                class="rounded-lg border p-3 text-left cursor-pointer"
                :class="checked ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700'"
              >
                <p class="text-xs font-medium text-gray-500">{{ t('duplicates.recordB') }}</p>
                <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ labelB }}</p>
                <p class="text-xs text-indigo-600 mt-1">{{ t('duplicates.selectAsMaster') }}</p>
              </button>
            </RadioGroupOption>
          </RadioGroup>

          <table class="min-w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <thead class="bg-gray-50 dark:bg-white/5">
              <tr>
                <th class="px-3 py-2 text-left">{{ t('duplicates.fieldCol') }}</th>
                <th class="px-3 py-2 text-left">{{ t('duplicates.recordA') }}</th>
                <th class="px-3 py-2 text-left">{{ t('duplicates.recordB') }}</th>
                <th class="px-3 py-2 text-left">{{ t('duplicates.selected') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in comparison"
                :key="row.field"
                class="border-t border-gray-200 dark:border-gray-700"
              >
                <td class="px-3 py-2 font-medium">{{ row.field }}</td>
                <td class="px-3 py-2">{{ formatVal(row.recordA) }}</td>
                <td class="px-3 py-2">{{ formatVal(row.recordB) }}</td>
                <td class="px-3 py-2">
                  <HeadlessSelect
                    :id="`merge-field-${row.field}`"
                    v-model="selections[row.field]"
                    :options="fieldSelectionOptions"
                    teleport
                    :teleport-match-width="true"
                    wrapper-class="w-full"
                    button-class="!py-1.5 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
                    options-class="!z-[10200]"
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <div class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
            {{ t('duplicates.mergeSafety') }}
          </div>
        </div>

        <footer class="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap justify-between gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600"
            :disabled="merging"
            @click="markNotDup"
          >
            {{ t('duplicates.markNotDuplicate') }}
          </button>
          <div class="flex gap-2">
            <button
              type="button"
              class="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600"
              @click="emit('close')"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              type="button"
              class="px-3 py-1.5 text-sm rounded bg-indigo-600 text-white disabled:opacity-50"
              :disabled="merging"
              @click="confirmMerge"
            >
              {{ merging ? t('states.saving') : t('duplicates.mergeRecords') }}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RadioGroup, RadioGroupOption } from '@headlessui/vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  moduleKey: { type: String, required: true },
  recordIdA: { type: String, default: null },
  recordIdB: { type: String, default: null },
});

const emit = defineEmits(['close', 'merged', 'not-duplicate']);
const { t } = useI18n();
const { success, error: notifyError } = useNotifications();

const loading = ref(false);
const merging = ref(false);
const comparison = ref([]);
const recordA = ref(null);
const recordB = ref(null);
const masterSide = ref('A');
const selections = reactive({});

const labelA = computed(() => recordA.value?.name || recordA.value?.email || props.recordIdA);
const labelB = computed(() => recordB.value?.name || recordB.value?.email || props.recordIdB);

const fieldSelectionOptions = computed(() => [
  { value: 'master', label: t('duplicates.keepMaster') },
  { value: 'duplicate', label: t('duplicates.keepDuplicate') },
]);

function formatVal(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

async function load() {
  if (!props.open || !props.recordIdA || !props.recordIdB) return;
  loading.value = true;
  try {
    const res = await apiClient.post(`/duplicates/${props.moduleKey}/compare`, {
      recordIdA: props.recordIdA,
      recordIdB: props.recordIdB,
    });
    const data = res.data?.data || res.data;
    recordA.value = data.recordA;
    recordB.value = data.recordB;
    comparison.value = data.comparison || [];
    for (const row of comparison.value) {
      selections[row.field] = 'master';
    }
    masterSide.value = 'A';
  } catch (e) {
    notifyError(e?.response?.data?.message || t('duplicates.compareFailed'));
  } finally {
    loading.value = false;
  }
}

async function confirmMerge() {
  merging.value = true;
  try {
    const masterId = masterSide.value === 'A' ? props.recordIdA : props.recordIdB;
    const duplicateId = masterSide.value === 'A' ? props.recordIdB : props.recordIdA;
    // When master is B, flip selection semantics: "master" means survivor
    const fieldSelections = {};
    for (const [field, choice] of Object.entries(selections)) {
      if (masterSide.value === 'A') {
        fieldSelections[field] = choice;
      } else {
        fieldSelections[field] = choice === 'master' ? 'master' : 'duplicate';
        // When B is master, UI "master" option means keep B's value = master after flip
        // choice master → keep master (B); choice duplicate → keep A = duplicate
        fieldSelections[field] = choice;
      }
    }
    await apiClient.post(`/duplicates/${props.moduleKey}/merge`, {
      masterId,
      duplicateId,
      fieldSelections,
    });
    success(t('duplicates.mergeSuccess'));
    emit('merged', { masterId, duplicateId });
    emit('close');
  } catch (e) {
    notifyError(e?.response?.data?.message || t('duplicates.mergeFailed'));
  } finally {
    merging.value = false;
  }
}

async function markNotDup() {
  try {
    await apiClient.post(`/duplicates/${props.moduleKey}/not-duplicate`, {
      recordIdA: props.recordIdA,
      recordIdB: props.recordIdB,
    });
    success(t('duplicates.notDuplicateSaved'));
    emit('not-duplicate');
    emit('close');
  } catch (e) {
    notifyError(e?.response?.data?.message || t('duplicates.notDuplicateFailed'));
  }
}

watch(() => [props.open, props.recordIdA, props.recordIdB], load, { immediate: true });
</script>
