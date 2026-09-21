<template>
  <div class="space-y-2">
    <label v-if="label" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>
    <div
      class="relative flex flex-col sm:flex-row sm:items-stretch rounded-lg border border-gray-200 bg-white shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:focus-within:border-indigo-400 dark:focus-within:ring-indigo-400/20"
    >
      <!-- Type: Headless UI Listbox -->
      <Listbox
        :model-value="localType"
        @update:model-value="(v) => { localType = v; onTypeChange(); }"
        as="div"
        class="relative w-full sm:w-40 flex-shrink-0"
        :disabled="disabled"
      >
        <ListboxButton
          :class="[
            'relative w-full h-[2.5rem] flex items-center border-0 bg-transparent py-0 pl-3 pr-10 text-left text-sm text-gray-900 focus:outline-none dark:text-white',
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            localType && localType !== 'none' ? 'sm:border-r sm:border-gray-200 dark:sm:border-gray-600' : ''
          ]"
        >
          <span class="block truncate">{{ typeOptions.find(o => o.value === localType)?.label ?? 'None' }}</span>
          <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon class="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
          </span>
        </ListboxButton>
        <Transition leave-active-class="transition duration-100 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
          <ListboxOptions
            class="absolute z-[10050] mt-1 max-h-60 w-full min-w-[10rem] overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
          >
            <ListboxOption
              v-for="opt in typeOptions"
              :key="opt.value"
              :value="opt.value"
              v-slot="{ active, selected }"
            >
              <li
                :class="[
                  'relative cursor-default select-none py-2 pl-4 pr-10',
                  active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                ]"
              >
                <span :class="['block truncate', selected ? 'font-medium' : 'font-normal']">{{ opt.label }}</span>
                <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400">
                  <CheckIcon class="h-5 w-5" aria-hidden="true" />
                </span>
              </li>
            </ListboxOption>
          </ListboxOptions>
        </Transition>
      </Listbox>

      <!-- Record: Headless UI Combobox (searchable) -->
      <div v-if="localType && localType !== 'none'" class="flex-1 min-w-0 relative border-t border-gray-200 sm:border-t-0 dark:border-gray-600">
        <Combobox
          :model-value="localId"
          @update:model-value="onRecordSelect"
          :disabled="disabled || optionsLoading"
          nullable
        >
          <div class="relative">
            <ComboboxButton
              :class="[
                'relative w-full h-[2.5rem] flex items-center border-0 bg-transparent py-0 pl-3 pr-20 text-left text-sm text-gray-900 focus:outline-none dark:text-white',
                (disabled || optionsLoading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                !selectedRecordLabel && !(disabled || optionsLoading) ? 'text-gray-400 dark:text-gray-500' : ''
              ]"
            >
              <span class="block truncate">
                {{ selectedRecordLabel || (optionsLoading ? 'Loading...' : `Select ${typeLabel}...`) }}
              </span>
              <button
                v-if="canCreateRelatedRecord"
                type="button"
                @click.stop="openCreateDrawer"
                class="absolute inset-y-0 right-8 flex items-center pr-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                :title="t('common.formCreateAndSelect')"
              >
                <PlusIcon class="h-4 w-4" />
              </button>
              <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon class="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
              </span>
            </ComboboxButton>
            <Transition leave-active-class="transition duration-100 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0" @after-enter="focusRecordSearch">
              <ComboboxOptions
                class="absolute z-[10050] mt-1 w-full overflow-hidden rounded-lg bg-white dark:bg-gray-700 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
              >
                <div class="p-2 border-b border-gray-200 dark:border-gray-600" @click.stop @mousedown.stop>
                  <div class="relative">
                    <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none z-20" />
                    <ComboboxInput
                      ref="recordSearchInputRef"
                      :display-value="() => recordSearchQuery"
                      @change="recordSearchQuery = $event.target.value"
                      @keydown.escape.stop
                      @click.stop
                      @mousedown.stop
                      :placeholder="`Search ${typeLabel}...`"
                      class="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20 relative z-10"
                      autocomplete="off"
                    />
                  </div>
                </div>
                <div class="max-h-60 overflow-auto py-1">
                  <div v-if="filteredOptions.length === 0" class="relative cursor-default select-none px-4 py-2 text-gray-700 dark:text-gray-300">
                    {{ optionsLoading ? 'Loading...' : 'No matching records found.' }}
                  </div>
                  <button
                    v-if="!optionsLoading && filteredOptions.length === 0 && canCreateRelatedRecord"
                    type="button"
                    class="w-full text-left px-4 py-2 text-sm text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                    @click.stop="openCreateDrawer"
                  >
                    Create new {{ recordSearchQuery ? `"${recordSearchQuery}"` : typeLabel }}
                  </button>
                  <ComboboxOption v-for="opt in filteredOptions" :key="opt._id" :value="opt._id" v-slot="{ active, selected }">
                    <li
                      :class="[
                        'relative cursor-default select-none py-2 pl-4 pr-10',
                        active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                      ]"
                    >
                      <span :class="['block truncate', selected ? 'font-medium' : 'font-normal']">{{ getOptionLabel(opt) }}</span>
                      <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400">
                        <CheckIcon class="h-5 w-5" aria-hidden="true" />
                      </span>
                    </li>
                  </ComboboxOption>
                </div>
              </ComboboxOptions>
            </Transition>
          </div>
        </Combobox>
      </div>
    </div>
    <CreateRecordDrawer
      v-if="canCreateRelatedRecord"
      :isOpen="showCreateDrawer"
      :moduleKey="createDrawerModuleKey"
      :prefillText="recordSearchQuery"
      :prefillFieldKey="createDrawerPrefillFieldKey"
      :open-record-on-save="false"
      @close="closeCreateDrawer"
      @saved="handleRelatedRecordCreated"
    />
    <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, watch, computed, nextTick } from 'vue';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption, Combobox, ComboboxButton, ComboboxInput, ComboboxOptions, ComboboxOption } from '@headlessui/vue';
import { CheckIcon, ChevronUpDownIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({ type: 'none', id: null })
  },
  label: { type: String, default: 'Related To' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  error: { type: String, default: '' }
});

const { t } = useI18n();

const emit = defineEmits(['update:modelValue']);

// Use "People" for the contact/people module
const RELATED_TYPE_OPTIONS = {
  contact: { label: 'People', endpoint: '/people', displayField: 'name', moduleKey: 'people', prefillFieldKey: 'name' },
  deal: { label: 'Deal', endpoint: '/deals', displayField: 'name', moduleKey: 'deals', prefillFieldKey: 'name' },
  organization: { label: 'Organization', endpoint: '/v2/organization', displayField: 'name', moduleKey: 'organizations', prefillFieldKey: 'name' },
  project: { label: 'Project', endpoint: '/projects', displayField: 'name', moduleKey: 'projects', prefillFieldKey: 'title' }
};

const typeOptions = [
  { value: 'none', label: 'None' },
  { value: 'contact', label: 'People' },
  { value: 'deal', label: 'Deal' },
  { value: 'organization', label: 'Organization' },
  { value: 'project', label: 'Project' }
];

const localType = ref(normalizeType(props.modelValue?.type));
const localId = ref(normalizeId(props.modelValue?.id));
const options = ref([]);
const optionsLoading = ref(false);
const recordSearchQuery = ref('');
const recordSearchInputRef = ref(null);
const showCreateDrawer = ref(false);

function normalizeType(t) {
  const v = (t || 'none').toLowerCase();
  return ['contact', 'deal', 'organization', 'project', 'none'].includes(v) ? v : 'none';
}

function normalizeId(id) {
  if (id == null || id === '') return null;
  if (typeof id === 'object' && id._id) return id._id;
  return String(id);
}

const typeLabel = computed(() => RELATED_TYPE_OPTIONS[localType.value]?.label || localType.value);

const filteredOptions = computed(() => {
  const q = (recordSearchQuery.value || '').trim().toLowerCase();
  if (!q) return options.value;
  return options.value.filter((opt) => (getOptionLabel(opt) || '').toLowerCase().includes(q));
});

const selectedRecordLabel = computed(() => {
  if (!localId.value) return '';
  const opt = options.value.find((o) => String(o._id) === String(localId.value));
  return opt ? getOptionLabel(opt) : '';
});

const createDrawerModuleKey = computed(() => {
  return RELATED_TYPE_OPTIONS[localType.value]?.moduleKey || '';
});

const createDrawerPrefillFieldKey = computed(() => {
  return RELATED_TYPE_OPTIONS[localType.value]?.prefillFieldKey || 'name';
});

const canCreateRelatedRecord = computed(() => {
  return !props.disabled && !!createDrawerModuleKey.value && localType.value !== 'none';
});

function getOptionLabel(opt) {
  const config = RELATED_TYPE_OPTIONS[localType.value];
  const field = config?.displayField || 'name';
  return opt.name || opt.title || opt[field] || (opt.first_name && opt.last_name ? `${opt.first_name} ${opt.last_name}`.trim() : null) || opt.email || opt._id;
}

// Normalize API response: support both { data: [...] } and { data: { data: [...] } }
function parseListResponse(res) {
  if (!res) return [];
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.data?.data)) return res.data.data;
  return [];
}

async function fetchOptions() {
  const config = RELATED_TYPE_OPTIONS[localType.value];
  if (!config) {
    options.value = [];
    return;
  }
  optionsLoading.value = true;
  recordSearchQuery.value = '';
  try {
    const res = await apiClient.get(config.endpoint, { params: { limit: 500 } });
    options.value = parseListResponse(res);
  } catch {
    options.value = [];
  } finally {
    optionsLoading.value = false;
  }
}

function onTypeChange() {
  localId.value = null;
  options.value = [];
  recordSearchQuery.value = '';
  if (localType.value && localType.value !== 'none') fetchOptions();
  emitValue();
}

function onRecordSelect(id) {
  localId.value = id;
  emitValue();
}

function emitValue() {
  const type = localType.value === 'none' ? 'none' : localType.value;
  const id = type === 'none' ? null : (localId.value || null);
  const displayLabel = type !== 'none' && id ? (selectedRecordLabel.value || undefined) : undefined;
  emit('update:modelValue', { type, id, displayLabel });
}

function openCreateDrawer() {
  if (!canCreateRelatedRecord.value) return;
  showCreateDrawer.value = true;
}

function closeCreateDrawer() {
  showCreateDrawer.value = false;
}

async function handleRelatedRecordCreated(savedRecord) {
  if (!savedRecord?._id) return;
  const exists = options.value.some((opt) => String(opt?._id) === String(savedRecord._id));
  if (!exists) {
    options.value = [savedRecord, ...options.value];
  }
  localId.value = savedRecord._id;
  emitValue();
  closeCreateDrawer();
}

function resolveSearchInputEl(refVal) {
  if (!refVal) return null;
  if (typeof refVal.focus === 'function' && refVal.nodeType === 1) return refVal;
  const el = refVal.el ?? refVal.$el ?? null;
  if (!el) return null;
  if (typeof el.focus === 'function') return el;
  return typeof el.querySelector === 'function' ? el.querySelector('input') : null;
}

function focusRecordSearch() {
  nextTick(() => {
    resolveSearchInputEl(recordSearchInputRef.value)?.focus?.();
  });
}

watch(
  () => props.modelValue,
  (v) => {
    localType.value = normalizeType(v?.type);
    localId.value = normalizeId(v?.id);
    if (localType.value && localType.value !== 'none' && options.value.length === 0) fetchOptions();
  },
  { deep: true }
);

watch(localType, (t) => {
  if (t && t !== 'none' && options.value.length === 0) fetchOptions();
}, { immediate: true });
</script>
