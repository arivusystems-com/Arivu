<template>
  <div class="space-y-5">
    <div>
      <p class="text-sm font-medium text-neutral-800 dark:text-neutral-100">
        {{ t('analytics.dashboardFieldVisibility') }}
      </p>
      <RadioGroup
        :model-value="visibility"
        class="mt-2 space-y-1.5"
        @update:model-value="emit('update:visibility', $event)"
      >
        <RadioGroupOption
          v-for="option in visibilityOptions"
          :key="option.value"
          v-slot="{ checked, active }"
          :value="option.value"
          as="template"
        >
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
            :class="
              checked
                ? 'border-primary-500 bg-primary-50 text-primary-900 ring-1 ring-primary-500/30 dark:border-primary-400 dark:bg-primary-950/40 dark:text-primary-100'
                : active
                  ? 'border-neutral-300 bg-neutral-50 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600'
            "
          >
            <span
              class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
              :class="
                checked
                  ? 'border-primary-600 bg-primary-600 dark:border-primary-400 dark:bg-primary-400'
                  : 'border-neutral-300 bg-white dark:border-neutral-500 dark:bg-neutral-900'
              "
              aria-hidden="true"
            >
              <span
                v-if="checked"
                class="h-1.5 w-1.5 rounded-full bg-white dark:bg-neutral-900"
              />
            </span>
            <span class="font-medium">{{ option.label }}</span>
          </button>
        </RadioGroupOption>
      </RadioGroup>
    </div>

    <div v-for="picker in activePickers" :key="picker.type" class="space-y-2">
      <p class="text-sm font-medium text-neutral-800 dark:text-neutral-100">
        {{ picker.label }}
      </p>

      <Listbox
        :model-value="picker.selectedIds"
        multiple
        as="div"
        class="relative"
        @update:model-value="(ids) => replaceSharedByType(picker.type, ids)"
      >
        <ListboxButton
          class="relative w-full cursor-default rounded-xl border bg-white py-2.5 pl-3 pr-10 text-left text-sm text-neutral-900 shadow-sm transition-[border-color,box-shadow] focus:outline-none focus:ring-2 dark:bg-neutral-900 dark:text-white"
          :class="
            missingTargetType === picker.type
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20 dark:border-red-400'
              : 'border-neutral-200 focus:border-primary-500 focus:ring-primary-500/20 dark:border-neutral-600 dark:focus:border-primary-400 dark:focus:ring-primary-400/20'
          "
        >
          <span
            class="block truncate"
            :class="!picker.selectedIds.length && 'text-neutral-500 dark:text-neutral-400'"
          >
            {{ pickerButtonLabel(picker) }}
          </span>
          <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
            <ChevronUpDownIcon class="h-5 w-5 text-neutral-400" aria-hidden="true" />
          </span>
        </ListboxButton>

        <Transition
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <ListboxOptions
            class="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 focus:outline-none dark:bg-neutral-800 dark:ring-white/10"
          >
            <div
              v-if="!picker.options.length"
              class="px-3 py-2 text-neutral-500 dark:text-neutral-400"
            >
              {{ t('analytics.shareNoOptions') }}
            </div>
            <ListboxOption
              v-for="opt in picker.options"
              :key="opt.value"
              v-slot="{ active, selected }"
              :value="opt.value"
              as="template"
            >
              <li
                :class="[
                  'relative cursor-default select-none py-2 pl-3 pr-10',
                  active
                    ? 'bg-primary-50 text-primary-900 dark:bg-primary-900/30 dark:text-primary-100'
                    : 'text-neutral-900 dark:text-neutral-100',
                ]"
              >
                <span :class="['block truncate', selected ? 'font-semibold' : 'font-normal']">
                  {{ opt.label }}
                </span>
                <span
                  v-if="selected"
                  class="absolute inset-y-0 right-0 flex items-center pr-3 text-primary-600 dark:text-primary-400"
                >
                  <CheckIcon class="h-5 w-5" aria-hidden="true" />
                </span>
              </li>
            </ListboxOption>
          </ListboxOptions>
        </Transition>
      </Listbox>

      <div v-if="picker.selectedIds.length" class="flex flex-wrap gap-1.5">
        <button
          v-for="id in picker.selectedIds"
          :key="`${picker.type}-${id}`"
          type="button"
          class="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          @click="removeShareTarget(picker.type, id)"
        >
          {{ optionLabel(picker.options, id) }}
          <XMarkIcon class="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
          <span class="sr-only">{{ t('actions.remove') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  RadioGroup,
  RadioGroupOption,
} from '@headlessui/vue';
import { CheckIcon, ChevronUpDownIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { getMissingShareTargetType } from '@/components/analytics/report-builder/reportShareValidation';
import type { AnalyticsShareTarget, AnalyticsVisibility } from '@/types/analytics.types';

type ShareTargetType = 'team' | 'role' | 'user';

interface ShareOption {
  value: string;
  label: string;
}

interface SharePicker {
  type: ShareTargetType;
  label: string;
  options: ShareOption[];
  selectedIds: string[];
}

const props = defineProps<{
  visibility: AnalyticsVisibility;
  sharedWith: AnalyticsShareTarget[];
  showValidation?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visibility', value: AnalyticsVisibility): void;
  (e: 'update:sharedWith', value: AnalyticsShareTarget[]): void;
}>();

const { t } = useI18n();

const teams = ref<ShareOption[]>([]);
const roles = ref<ShareOption[]>([]);
const users = ref<ShareOption[]>([]);

const visibilityOptions = computed(() => [
  { value: 'private' as AnalyticsVisibility, label: t('analytics.visibilityPrivate') },
  { value: 'team' as AnalyticsVisibility, label: t('analytics.visibilityTeam') },
  { value: 'role' as AnalyticsVisibility, label: t('analytics.visibilityRole') },
  { value: 'organization' as AnalyticsVisibility, label: t('analytics.visibilityOrganization') },
]);

const selectedTeamIds = computed(() =>
  props.sharedWith.filter((target) => target.type === 'team').map((target) => String(target.id)),
);

const selectedRoleIds = computed(() =>
  props.sharedWith.filter((target) => target.type === 'role').map((target) => String(target.id)),
);

const selectedUserIds = computed(() =>
  props.sharedWith.filter((target) => target.type === 'user').map((target) => String(target.id)),
);

const missingTargetType = computed(() =>
  props.showValidation
    ? getMissingShareTargetType(props.visibility, props.sharedWith)
    : null,
);

const activePickers = computed<SharePicker[]>(() => {
  const pickers: SharePicker[] = [];
  if (props.visibility === 'team') {
    pickers.push({
      type: 'team',
      label: t('analytics.dashboardShareTeams'),
      options: teams.value,
      selectedIds: selectedTeamIds.value,
    });
  }
  if (props.visibility === 'role') {
    pickers.push({
      type: 'role',
      label: t('analytics.dashboardShareRoles'),
      options: roles.value,
      selectedIds: selectedRoleIds.value,
    });
  }
  pickers.push({
    type: 'user',
    label: t('analytics.builderShareUsers'),
    options: users.value,
    selectedIds: selectedUserIds.value,
  });
  return pickers;
});

function optionLabel(options: ShareOption[], id: string) {
  return options.find((opt) => opt.value === id)?.label || id;
}

function pickerButtonLabel(picker: SharePicker) {
  const count = picker.selectedIds.length;
  if (!count) return t('analytics.shareNoneSelected');
  if (count === 1) {
    const onlyId = picker.selectedIds[0];
    if (onlyId) return optionLabel(picker.options, onlyId);
  }
  return t('analytics.shareSelectedCount', { count });
}

function replaceSharedByType(type: ShareTargetType, ids: string[]) {
  const uniqueIds = Array.from(new Set((ids || []).map(String).filter(Boolean)));
  const others = props.sharedWith.filter((target) => target.type !== type);
  emit('update:sharedWith', [...others, ...uniqueIds.map((id) => ({ type, id }))]);
}

function removeShareTarget(type: ShareTargetType, id: string) {
  const next = props.sharedWith.filter(
    (target) => !(target.type === type && String(target.id) === String(id)),
  );
  emit('update:sharedWith', next);
}

async function loadShareOptions() {
  try {
    const [groupsRes, rolesRes, usersRes] = await Promise.all([
      apiClient.get('/groups', { params: { limit: 200 } }),
      apiClient.get('/roles'),
      apiClient.get('/users', { params: { limit: 200, status: 'active' } }),
    ]);
    const groupRows = Array.isArray(groupsRes?.data) ? groupsRes.data : (groupsRes?.groups || []);
    const roleRows = Array.isArray(rolesRes?.data) ? rolesRes.data : (rolesRes?.roles || []);
    const userRows = Array.isArray(usersRes?.data) ? usersRes.data : (usersRes?.users || []);

    teams.value = groupRows.map((group: { _id: string; name?: string }) => ({
      value: String(group._id),
      label: group.name || group._id,
    }));
    roles.value = roleRows.map((role: { _id: string; name?: string }) => ({
      value: String(role._id),
      label: role.name || role._id,
    }));
    users.value = userRows.map((user: {
      _id: string;
      firstName?: string;
      lastName?: string;
      email?: string;
    }) => ({
      value: String(user._id),
      label: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user._id,
    }));
  } catch {
    teams.value = [];
    roles.value = [];
    users.value = [];
  }
}

watch(
  () => props.visibility,
  (value) => {
    if (value === 'private') {
      emit(
        'update:sharedWith',
        props.sharedWith.filter((target) => target.type === 'user'),
      );
      return;
    }
    if (value === 'organization') {
      emit(
        'update:sharedWith',
        props.sharedWith.filter((target) => target.type === 'user'),
      );
    }
  },
);

onMounted(loadShareOptions);
</script>
