<!--
  Organization create/edit: app participation cards + per-app type/fields.
  Replaces flat OrganizationTypesSection multi-select.
-->
<template>
  <CreateDrawerCollapsibleSection
    v-if="fullMode"
    :title="t('records.genericAppParticipation')"
    storage-key="create-drawer-section:organizations:composite-app_participation"
    :default-open="true"
    :content-class="typeof sectionClass === 'string' ? `flex flex-col gap-4 ${sectionClass}` : 'flex flex-col gap-4'"
  >
    <p class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('organizations.organizationQuickCreateSelectAppsHint') }}
    </p>
    <template v-if="availableApps.length === 0">
      <div class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('organizations.organizationQuickCreateNoParticipationApps') }}
      </div>
    </template>
    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          v-for="appKey in availableApps"
          :key="appKey"
          type="button"
          class="relative flex items-center gap-3 rounded-lg border p-3.5 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          :class="
            isAppSelected(appKey)
              ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-950/25'
              : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600'
          "
          :aria-pressed="isAppSelected(appKey)"
          @click="toggleApp(appKey)"
        >
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            :class="meta(appKey).iconBg"
          >
            <component
              :is="meta(appKey).icon"
              class="h-5 w-5"
              :class="meta(appKey).iconColor"
              aria-hidden="true"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {{ getAppLabel(appKey) }}
            </div>
            <div
              v-if="isAppSelected(appKey) && appForms[appKey]?.participationType"
              class="truncate text-xs text-indigo-600 dark:text-indigo-400"
            >
              {{ appForms[appKey].participationType }}
            </div>
            <div v-else-if="!isAppSelected(appKey)" class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('people.peopleQuickCreateDrawerTapToAdd') }}
            </div>
          </div>
          <CheckCircleIcon
            v-if="isAppSelected(appKey)"
            class="absolute right-2 top-2 h-5 w-5 text-indigo-600 dark:text-indigo-400"
            aria-hidden="true"
          />
        </button>
      </div>
    </template>

    <p v-if="errors.types || errors.participation" class="text-sm text-red-600 dark:text-red-400">
      {{ errors.types || errors.participation }}
    </p>

    <div v-if="selectedApps.length > 0" class="space-y-4">
      <div
        v-for="appKey in selectedApps"
        :key="`config-${appKey}`"
        class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/40"
      >
        <div class="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
          <div
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
            :class="meta(appKey).iconBg"
          >
            <component
              :is="meta(appKey).icon"
              class="h-4 w-4"
              :class="meta(appKey).iconColor"
              aria-hidden="true"
            />
          </div>
          <span class="text-sm font-medium text-gray-900 dark:text-white">
            {{ getAppLabel(appKey) }}
          </span>
          <button
            type="button"
            class="ml-auto text-xs font-medium text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
            @click="toggleApp(appKey)"
          >
            {{ t('actions.remove') }}
          </button>
        </div>
        <div class="p-4">
          <OrganizationAppSection
            :app-key="appKey"
            :model-value="appForms[appKey] || { participationType: null }"
            embedded
            collapsible-dependent-fields
            hide-section-title
            :single-column="singleColumn"
            :module-override="moduleOverride"
            :errors="appErrors[appKey] || {}"
            @update:model-value="(v) => setAppForm(appKey, v)"
          />
        </div>
      </div>
    </div>
  </CreateDrawerCollapsibleSection>

  <section v-else :class="sectionClass">
    <div class="space-y-1">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('records.genericAppParticipation') }}
      </h3>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('organizations.organizationQuickCreateSelectAppsHint') }}
      </p>
    </div>

    <div v-if="availableApps.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('organizations.organizationQuickCreateNoParticipationApps') }}
    </div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        v-for="appKey in availableApps"
        :key="appKey"
        type="button"
        class="relative flex items-center gap-3 rounded-lg border p-3.5 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        :class="
          isAppSelected(appKey)
            ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-950/25'
            : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600'
        "
        :aria-pressed="isAppSelected(appKey)"
        @click="toggleApp(appKey)"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          :class="meta(appKey).iconBg"
        >
          <component
            :is="meta(appKey).icon"
            class="h-5 w-5"
            :class="meta(appKey).iconColor"
            aria-hidden="true"
          />
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {{ getAppLabel(appKey) }}
          </div>
          <div
            v-if="isAppSelected(appKey) && appForms[appKey]?.participationType"
            class="truncate text-xs text-indigo-600 dark:text-indigo-400"
          >
            {{ appForms[appKey].participationType }}
          </div>
          <div v-else-if="!isAppSelected(appKey)" class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('people.peopleQuickCreateDrawerTapToAdd') }}
          </div>
        </div>
        <CheckCircleIcon
          v-if="isAppSelected(appKey)"
          class="absolute right-2 top-2 h-5 w-5 text-indigo-600 dark:text-indigo-400"
          aria-hidden="true"
        />
      </button>
    </div>

    <p v-if="errors.types || errors.participation" class="text-sm text-red-600 dark:text-red-400">
      {{ errors.types || errors.participation }}
    </p>

    <div v-if="selectedApps.length > 0" class="mt-5 space-y-4">
      <div
        v-for="appKey in selectedApps"
        :key="`config-${appKey}`"
        class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/40"
      >
        <div class="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
          <div
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
            :class="meta(appKey).iconBg"
          >
            <component
              :is="meta(appKey).icon"
              class="h-4 w-4"
              :class="meta(appKey).iconColor"
              aria-hidden="true"
            />
          </div>
          <span class="text-sm font-medium text-gray-900 dark:text-white">
            {{ getAppLabel(appKey) }}
          </span>
          <button
            type="button"
            class="ml-auto text-xs font-medium text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
            @click="toggleApp(appKey)"
          >
            {{ t('actions.remove') }}
          </button>
        </div>
        <div class="p-4">
          <OrganizationAppSection
            :app-key="appKey"
            :model-value="appForms[appKey] || { participationType: null }"
            embedded
            collapsible-dependent-fields
            hide-section-title
            :single-column="singleColumn"
            :module-override="moduleOverride"
            :errors="appErrors[appKey] || {}"
            @update:model-value="(v) => setAppForm(appKey, v)"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed, ref, watch, onMounted } from 'vue';
import {
  BriefcaseIcon,
  LifebuoyIcon,
  CubeIcon,
  MegaphoneIcon,
  GlobeAltIcon,
  CheckCircleIcon,
} from '@heroicons/vue/24/outline';
import CreateDrawerCollapsibleSection from '@/components/common/CreateDrawerCollapsibleSection.vue';
import OrganizationAppSection from '@/components/organizations/OrganizationAppSection.vue';
import { getAppLabel } from '@/utils/getRoleDisplay';
import { useAuthStore } from '@/stores/authRegistry';
import {
  ORGANIZATION_PARTICIPATION_APP_KEYS,
  normalizeOrganizationEnabledAppKeys,
} from '@/platform/organizations/organizationParticipation';

const props = defineProps({
  formData: { type: Object, required: true },
  errors: { type: Object, default: () => ({}) },
  moduleOverride: { type: Object, default: null },
  singleColumn: { type: Boolean, default: true },
  fullMode: { type: Boolean, default: false },
  sectionClass: { type: [String, Array, Object], default: '' },
});

const emit = defineEmits(['update:formData']);

const { t } = useI18n();
const authStore = useAuthStore();

const selectedApps = ref([]);
const appForms = ref({});
const appErrors = ref({});

const APP_META = {
  SALES: {
    icon: BriefcaseIcon,
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/50',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
  },
  HELPDESK: {
    icon: LifebuoyIcon,
    iconBg: 'bg-sky-100 dark:bg-sky-900/50',
    iconColor: 'text-sky-600 dark:text-sky-400',
  },
  INVENTORY: {
    icon: CubeIcon,
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  MARKETING: {
    icon: MegaphoneIcon,
    iconBg: 'bg-violet-100 dark:bg-violet-900/50',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
  PORTAL: {
    icon: GlobeAltIcon,
    iconBg: 'bg-amber-100 dark:bg-amber-900/50',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
};

function meta(appKey) {
  return (
    APP_META[appKey] || {
      icon: BriefcaseIcon,
      iconBg: 'bg-gray-100 dark:bg-gray-800',
      iconColor: 'text-gray-600 dark:text-gray-400',
    }
  );
}

const availableApps = computed(() => {
  const enabled = normalizeOrganizationEnabledAppKeys(authStore.organization?.enabledApps);
  if (enabled.size === 0) {
    return ORGANIZATION_PARTICIPATION_APP_KEYS.filter((k) => k === 'SALES');
  }
  return ORGANIZATION_PARTICIPATION_APP_KEYS.filter((k) => enabled.has(k));
});

function isAppSelected(appKey) {
  return selectedApps.value.includes(appKey);
}

function syncFormDataFromParticipation() {
  const participations = {};
  const types = [];
  const seen = new Set();
  const fieldPatch = {};

  for (const appKey of selectedApps.value) {
    const form = appForms.value[appKey] || {};
    const role = form.participationType;
    if (!role) continue;
    participations[appKey] = { role };
    const low = String(role).toLowerCase();
    if (!seen.has(low)) {
      seen.add(low);
      types.push(role);
    }
    for (const [k, v] of Object.entries(form)) {
      if (k === 'participationType') continue;
      if (v !== undefined) fieldPatch[k] = v;
    }
  }

  emit('update:formData', {
    ...props.formData,
    ...fieldPatch,
    types,
    participations,
  });
}

function toggleApp(appKey) {
  if (isAppSelected(appKey)) {
    selectedApps.value = selectedApps.value.filter((k) => k !== appKey);
    const next = { ...appForms.value };
    delete next[appKey];
    appForms.value = next;
  } else {
    selectedApps.value = [...selectedApps.value, appKey];
    appForms.value = {
      ...appForms.value,
      [appKey]: appForms.value[appKey] || { participationType: null },
    };
  }
  syncFormDataFromParticipation();
}

function setAppForm(appKey, value) {
  appForms.value = { ...appForms.value, [appKey]: value };
  syncFormDataFromParticipation();
}

function hydrateFromRecord() {
  const parts = props.formData?.participations;
  if (parts && typeof parts === 'object' && Object.keys(parts).length) {
    const apps = [];
    const forms = {};
    for (const appKey of ORGANIZATION_PARTICIPATION_APP_KEYS) {
      const role = parts[appKey]?.role;
      if (!role) continue;
      apps.push(appKey);
      forms[appKey] = { participationType: role };
    }
    selectedApps.value = apps;
    appForms.value = forms;
    return;
  }
  // Legacy types[] only — map to owning apps among available
  const types = Array.isArray(props.formData?.types) ? props.formData.types : [];
  if (!types.length) return;
  const apps = [];
  const forms = {};
  for (const appKey of availableApps.value) {
    // pick first matching type for this app from registry defaults via role names present
    // Simple: if Customer and app allows Customer, etc. — handled by sync on server;
    // for UI hydrate: attach each type to first available owning app not yet used for another exclusive role
  }
  // Prefer Sales Customer if Customer in types
  for (const type of types) {
    const t = String(type).trim().toLowerCase();
    let owner = null;
    if (t === 'lead' && availableApps.value.includes('SALES')) owner = 'SALES';
    else if (t === 'marketing lead' && availableApps.value.includes('MARKETING')) owner = 'MARKETING';
    else if (t === 'vendor' && availableApps.value.includes('INVENTORY')) owner = 'INVENTORY';
    else if (t === 'partner' && availableApps.value.includes('PORTAL')) owner = 'PORTAL';
    else if (t === 'customer') {
      owner = ['SALES', 'HELPDESK', 'MARKETING'].find((a) => availableApps.value.includes(a));
    }
    if (owner && !apps.includes(owner)) {
      apps.push(owner);
      forms[owner] = { participationType: type };
    }
  }
  selectedApps.value = apps;
  appForms.value = forms;
}

onMounted(() => {
  hydrateFromRecord();
});

watch(
  () => [props.formData?.participations, props.formData?.types],
  () => {
    if (selectedApps.value.length === 0) hydrateFromRecord();
  }
);
</script>
