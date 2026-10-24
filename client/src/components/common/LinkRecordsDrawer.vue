<template>
  <WorkspaceScopedDrawerShell
    :is-open="isOpen"
    panel-offset-class="pl-10 sm:pl-16"
    :draft-module-key="effectiveModuleKey || 'link-records'"
    @backdrop="handleDialogClose"
    @escape="handleDialogClose"
  >
              <div class="pointer-events-auto w-screen max-w-3xl">
                <div class="rounded-tl-xl overflow-hidden relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 shadow-xl">
                  <!-- Header -->
                  <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <div class="flex items-center gap-2 min-w-0">
                      <button
                        v-if="showTypeSelector && selectedModuleKey"
                        type="button"
                        class="shrink-0 rounded-lg p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                        :aria-label="t('common.linkRecordsBackToType')"
                        @click="clearRecordTypeSelection"
                      >
                        <ChevronLeftIcon class="size-5" />
                      </button>
                      <h2 class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white truncate">{{ computedTitle }}</h2>
                    </div>
                    <button type="button" class="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 shrink-0" @click="closeDrawer">
                      <span class="sr-only">{{ t('common.closePanel') }}</span>
                      <XMarkIcon class="size-6" />
                    </button>
                  </div>

                  <!-- Body -->
                  <div class="flex-1 overflow-hidden flex flex-col">
                    <!-- Record type selector (when no moduleKey and no type selected yet) -->
                    <div v-if="showTypeSelector && !effectiveModuleKey" class="flex-1 overflow-auto p-4">
                      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">{{ typeSelectorPrompt }}</p>
                      <div v-if="linkableTargetsLoading" class="flex items-center justify-center py-8">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      </div>
                      <div v-else-if="recordTypeOptions.length === 0" class="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
                        {{ t('common.linkRecordsNoTypes') }}
                      </div>
                      <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          v-for="opt in recordTypeOptions"
                          :key="opt.relationshipKey || opt.key"
                          type="button"
                          :disabled="isRecordTypeOptionDisabled(opt)"
                          :title="isRecordTypeOptionDisabled(opt) ? recordTypeOptionDisableReason(opt) : ''"
                          :class="[
                            'flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                            isRecordTypeOptionDisabled(opt)
                              ? 'cursor-not-allowed border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30 opacity-60'
                              : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700'
                          ]"
                          @click="selectRecordType(opt)"
                        >
                          <span class="text-base font-medium text-gray-900 dark:text-white">{{ opt.label }}</span>
                          <span
                            v-if="isRecordTypeOptionDisabled(opt)"
                            class="ml-auto shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-600 dark:text-gray-200"
                          >
                            {{ t('common.linkRecordsLinked') }}
                          </span>
                        </button>
                      </div>
                    </div>

                    <template v-else>
                    <!-- Search -->
                    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
                      <input v-model="searchQuery" type="text" :placeholder="t('common.searchPlaceholder')" class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:bg-gray-800 dark:outline-white/10" />
                    </div>

                    <!-- List -->
                    <div class="flex-1 overflow-auto p-4">
                      <div v-if="loading" class="flex items-center justify-center py-12">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      </div>
                      <div v-else>
                        <div v-if="visibleItems.length === 0" class="text-center text-sm text-gray-500 dark:text-gray-400 py-8">{{ t('common.linkRecordsNoMatch') }}</div>
                        <ul class="divide-y divide-gray-200 dark:divide-gray-700">
                          <li 
                            v-for="item in visibleItems" 
                            :key="item._id" 
                            :class="[
                              'flex items-center gap-3 py-3 px-2 rounded-md',
                              (isPrelinked(item._id) || isSelectionBlocked(item)) ? 'bg-gray-50 dark:bg-gray-900/40 opacity-80' : ''
                            ]"
                          >
                            <!-- Checkbox on the left for easy selection -->
                            <div class="shrink-0">
                              <HeadlessCheckbox
                                v-if="effectiveMultiple || useCheckboxListUi"
                                checkbox-class="w-4 h-4"
                                :checked="isSelected(item._id) || isPrelinked(item._id)"
                                :disabled="isPrelinked(item._id) || isSelectionBlocked(item)"
                                @change="toggleSelect(item)"
                              />
                            </div>
                            <div class="min-w-0 flex-1">
                              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ getDisplayName(item) }}</p>
                              <p v-if="getSecondaryText(item)" class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ getSecondaryText(item) }}</p>
                            </div>
                            <div class="shrink-0" v-if="!effectiveMultiple && !useCheckboxListUi">
                              <button
                                type="button"
                                :disabled="isPrelinked(item._id) || isSelectionBlocked(item)"
                                :title="isSelectionBlocked(item) ? selectionBlockedReason(item) : ''"
                                class="rounded-md bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                @click="selectSingle(item)"
                              >
                                {{ t('actions.select') }}
                              </button>
                            </div>
                          </li>
                        </ul>
                      </div>
                    </div>
                    </template>
                  </div>

                  <!-- Footer (only when list view) -->
                  <div v-if="effectiveModuleKey" class="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                    <div class="text-xs text-gray-500 dark:text-gray-400" v-if="effectiveMultiple || useCheckboxListUi">{{ t('common.linkRecordsSelectedCount', { count: deltaCount }) }}</div>
                    <div class="ml-auto flex gap-3">
                      <button 
                        v-if="allowCreate"
                        type="button" 
                        class="inline-flex justify-center rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                        @click="handleCreate"
                      >
                        {{ t('common.linkRecordsCreateNew') }}
                      </button>
                      <button type="button" class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700" @click="closeDrawer">{{ t('actions.cancel') }}</button>
                      <button type="button" :disabled="(effectiveMultiple || useCheckboxListUi) && deltaCount === 0" class="inline-flex justify-center rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50" @click="confirmLink">{{ t('common.linkRecordsLink') }}</button>
                    </div>
                  </div>
                </div>
              </div>
  </WorkspaceScopedDrawerShell>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { XMarkIcon, ChevronLeftIcon } from '@heroicons/vue/24/outline';
import WorkspaceScopedDrawerShell from '@/components/common/WorkspaceScopedDrawerShell.vue';
import apiClient from '@/utils/apiClient';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { useAuthStore } from '@/stores/authRegistry';
import { getRecordLabel } from '@/utils/recordDisplay';
import { formatUserDate } from '@/utils/localeFormat';

function defaultRecordTypeOptions() {
  return [
    { key: 'organizations', label: t('forms.settingsLinkOrganization') },
    { key: 'people', label: t('deals.sysFieldContactId') },
    { key: 'deals', label: t('forms.settingsLinkDeal') },
    { key: 'tasks', label: t('forms.settingsLinkTask') },
    { key: 'events', label: t('forms.settingsLinkEvent') }
  ];
}

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  moduleKey: { type: String, default: '' }, // When empty, show record type selector first
  recordTypes: { type: Array, default: null }, // Optional override for type selector (e.g. [{ key: 'project', label: 'Project' }, ...])
  supplementRecordTypes: { type: Array, default: () => [] }, // Merged with API results (e.g. record-context relationships)
  sourceAppKey: { type: String, default: '' }, // When set with sourceModuleKey, record types are fetched from settings/relationships (linkable-targets)
  sourceModuleKey: { type: String, default: '' }, // Source module for linkable-targets (e.g. 'deals', 'tasks')
  multiple: { type: Boolean, default: true },
  title: { type: String, default: null },
  context: { type: Object, default: () => ({}) }, // e.g., { organizationId, contactId, taskId }
  preselectedIds: { type: Array, default: () => [] }, // already linked IDs
  allowCreate: { type: Boolean, default: false }, // If true, show "Create New" button
  createAndLink: { type: Boolean, default: false } // If true, selecting module type starts create+link
});

const emit = defineEmits(['close', 'linked', 'create']);

const loading = ref(false);
const items = ref([]);
const searchQuery = ref('');
const selectedIds = ref(new Set());
const prelinkedIds = ref(new Set());
const selectedModuleKey = ref(''); // When moduleKey prop is empty, user selects type first
const linkableTargets = ref([]); // Fetched from /relationships/linkable-targets when sourceAppKey + sourceModuleKey set
const linkableTargetsLoading = ref(false);
const selectedRecordTypeOption = ref(null); // { key, label, relationshipKey?, targetAppKey? } when from API
let searchDebounce = null;

const MODULE_KEY_ALIASES = Object.freeze({
  organization: 'organizations',
  organizations: 'organizations',
  contact: 'people',
  contacts: 'people',
  person: 'people',
  people: 'people',
  deal: 'deals',
  deals: 'deals',
  event: 'events',
  events: 'events',
  task: 'tasks',
  tasks: 'tasks',
  form: 'forms',
  forms: 'forms',
  project: 'projects',
  projects: 'projects'
});

const normalizeModuleKey = (moduleKey) => {
  const normalized = (moduleKey || '').toLowerCase().trim();
  return MODULE_KEY_ALIASES[normalized] || normalized;
};

const showTypeSelector = computed(() => !props.moduleKey);
const effectiveModuleKey = computed(() => normalizeModuleKey(props.moduleKey || selectedModuleKey.value));

const isPeopleToOrganizationLink = computed(() => {
  const source = normalizeModuleKey(props.sourceModuleKey);
  const target = effectiveModuleKey.value;
  const relKey = (selectedRecordTypeOption.value?.relationshipKey || '').toLowerCase();
  if (source === 'people' && target === 'organizations') return true;
  return relKey === 'people_organizations' && source === 'people';
});

const effectiveMultiple = computed(() => {
  if (isPeopleToOrganizationLink.value) return false;
  return props.multiple;
});

const useCheckboxListUi = computed(() => isPeopleToOrganizationLink.value);

const useLinkableTargetsFromApi = computed(
  () =>
    Boolean(
      props.sourceAppKey &&
        props.sourceModuleKey &&
        !(props.recordTypes && props.recordTypes.length)
    )
);

function mergeRecordTypeOptions(primary, supplement) {
  const byRelKey = new Map();
  for (const opt of primary || []) {
    const relKey = String(opt?.relationshipKey || opt?.key || '').toLowerCase();
    if (relKey) byRelKey.set(relKey, opt);
  }
  for (const opt of supplement || []) {
    const relKey = String(opt?.relationshipKey || opt?.key || '').toLowerCase();
    if (relKey && !byRelKey.has(relKey)) byRelKey.set(relKey, opt);
  }
  return Array.from(byRelKey.values());
}

const recordTypeOptions = computed(() => {
  if (props.recordTypes && props.recordTypes.length) return props.recordTypes;
  // Wait for relationships API so supplement types (e.g. Related Documents) don't flash alone
  if (useLinkableTargetsFromApi.value) {
    if (linkableTargetsLoading.value) return [];
    return mergeRecordTypeOptions(linkableTargets.value, props.supplementRecordTypes);
  }
  if (props.supplementRecordTypes?.length) {
    return mergeRecordTypeOptions([], props.supplementRecordTypes);
  }
  return defaultRecordTypeOptions();
});

// Auth role
const authStore = useAuthStore();
const isAdmin = computed(() => authStore.isOwner || authStore.userRole === 'admin');

const deltaSelectedIds = computed(() => {
  const out = new Set();
  for (const id of selectedIds.value) {
    if (!prelinkedIds.value.has(id)) out.add(id);
  }
  return out;
});

const deltaCount = computed(() => deltaSelectedIds.value.size);

const computedTitle = computed(() => {
  if (props.title) return props.title;
  if (effectiveModuleKey.value) return `Link ${capitalize(effectiveModuleKey.value)}`;
  return 'Link Record';
});

const typeSelectorPrompt = computed(() => (
  props.createAndLink ? 'Select a record type to add and link' : 'Select a record type to link'
));

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const normalizeId = (value) => {
  if (!value) return '';
  if (typeof value === 'object') {
    const objectId = value._id ?? value.id ?? value.value;
    return objectId ? String(objectId) : '';
  }
  return String(value);
};

const getContextPersonId = () => normalizeId(props.context?.personId ?? props.context?.contactId);
const getContextSourceRecordId = () => normalizeId(props.context?.sourceRecordId ?? props.context?.organizationId);

const isRecordTypeOptionDisabled = () => false;

const recordTypeOptionDisableReason = (opt) => {
  if (!isRecordTypeOptionDisabled(opt)) return '';
  return 'This person already has a linked organization. Unlink it first.';
};

// Client-side filtered view to ensure search works even if backend doesn't support it
const visibleItems = computed(() => {
  const q = (searchQuery.value || '').trim().toLowerCase();
  if (!q) return items.value;
  return items.value.filter((it) => {
    const primary = (getDisplayName(it) || '').toLowerCase();
    const secondary = (getSecondaryText(it) || '').toLowerCase();
    return primary.includes(q) || secondary.includes(q);
  });
});

const closeDrawer = () => {
  emit('close');
  selectedIds.value = new Set();
  searchQuery.value = '';
  prelinkedIds.value = new Set();
  selectedModuleKey.value = '';
  selectedRecordTypeOption.value = null;
};

const selectRecordType = (opt) => {
  if (isRecordTypeOptionDisabled(opt)) return;
  if (props.createAndLink && props.allowCreate) {
    handleCreate(opt);
    closeDrawer();
    return;
  }
  selectedModuleKey.value = opt.key;
  selectedRecordTypeOption.value = opt.relationshipKey != null ? opt : null;
};

const clearRecordTypeSelection = () => {
  selectedModuleKey.value = '';
  selectedRecordTypeOption.value = null;
};

const fetchLinkableTargets = async () => {
  if (!props.sourceAppKey || !props.sourceModuleKey) return;
  linkableTargetsLoading.value = true;
  linkableTargets.value = [];
  try {
    const res = await apiClient.get('/relationships/linkable-targets', {
      params: {
        appKey: props.sourceAppKey,
        moduleKey: props.sourceModuleKey,
        _ts: Date.now()
      }
    });
    if (res?.success && Array.isArray(res.data)) {
      linkableTargets.value = res.data;
    }
  } catch (e) {
    linkableTargets.value = [];
  } finally {
    linkableTargetsLoading.value = false;
  }
};

const handleCreate = (optOverride = null) => {
  const moduleKey = normalizeModuleKey(optOverride?.key || effectiveModuleKey.value);
  const relationshipKey = optOverride?.relationshipKey ?? selectedRecordTypeOption.value?.relationshipKey ?? null;
  const targetAppKey = optOverride?.targetAppKey ?? selectedRecordTypeOption.value?.targetAppKey ?? null;
  const sourceIsCurrent = optOverride?.sourceIsCurrent ?? selectedRecordTypeOption.value?.sourceIsCurrent ?? true;
  emit('create', {
    moduleKey,
    context: props.context,
    relationshipKey,
    targetAppKey,
    sourceIsCurrent
  });
};

// Allow closing only when no selection changes were made
const handleDialogClose = () => {
  if ((effectiveMultiple.value || useCheckboxListUi.value) && deltaCount.value > 0) {
    return; // block close on unsaved changes
  }
  closeDrawer();
};

const mergePrelinkedIds = (ids) => {
  const normalizedIds = ids.map((id) => String(id)).filter(Boolean);
  if (normalizedIds.length === 0) return;
  const mergedPrelinked = new Set([...prelinkedIds.value, ...normalizedIds]);
  prelinkedIds.value = mergedPrelinked;
  selectedIds.value = new Set([...mergedPrelinked, ...selectedIds.value]);
};

const mergePersonOrganizationFromLookup = async (modKey) => {
  const sourceModuleKey = normalizeModuleKey(props.sourceModuleKey);
  const targetModuleKey = normalizeModuleKey(modKey);
  if (sourceModuleKey !== 'people' || targetModuleKey !== 'organizations') return;
  const personId = getContextPersonId();
  if (!personId) return;
  try {
    const contactRes = await apiClient.get(`/people/${personId}`);
    if (contactRes?.success && contactRes.data?.organization) {
      const orgId = normalizeId(contactRes.data.organization);
      if (orgId) mergePrelinkedIds([orgId]);
    }
  } catch (e) {
    // ignore
  }
};

const mergeOrganizationPeopleFromLookup = async (modKey) => {
  const sourceModuleKey = normalizeModuleKey(props.sourceModuleKey);
  const targetModuleKey = normalizeModuleKey(modKey);
  if (sourceModuleKey !== 'organizations' || targetModuleKey !== 'people') return;
  const organizationId = getContextSourceRecordId();
  if (!organizationId) return;
  try {
    const res = await apiClient.get('/people', {
      params: { organization: organizationId, limit: 1000 }
    });
    if (!res?.success) return;
    const rows = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    const ids = rows.map((row) => normalizeId(row?._id)).filter(Boolean);
    mergePrelinkedIds(ids);
  } catch (e) {
    // ignore
  }
};

const endpointForModule = (moduleKey) => {
  const normalized = normalizeModuleKey(moduleKey);
  if (normalized === 'organizations') return '/v2/organization';
  if (normalized === 'projects') return '/projects';
  if (normalized === 'events') return '/events';
  if (normalized === 'forms') return '/forms';
  return `/${normalized}`;
};

// Build params to fetch already-linked records for the current context
const buildLinkedFilterParams = (moduleKey, context) => {
  const params = { limit: 1000 };
  if (!context) return params;
  // When linking from a source record (e.g. deal), don't use generic list - prelinked are fetched via relationships/links
  if (context.dealId && props.sourceModuleKey) return null;
  // Link targets based on module and context
  if (moduleKey === 'people' && context.organizationId) {
    params.organization = context.organizationId;
  } else if (moduleKey === 'deals') {
    if (context.contactId) params.contactId = context.contactId;
    else if (context.organizationId) params.accountId = context.organizationId;
  } else if (moduleKey === 'tasks') {
    if (context.contactId) params.contactId = context.contactId;
    else if (context.organizationId) params.organizationId = context.organizationId;
  } else if (moduleKey === 'events') {
    if (context.contactId) { params.relatedType = 'Contact'; params.relatedId = context.contactId; }
    else if (context.organizationId) { params.relatedType = 'Organization'; params.relatedId = context.organizationId; }
  } else if (moduleKey === 'organizations' && context.contactId) {
    // For organizations linked to a contact, we need to fetch the contact first to get its organization
    // Return null to indicate we should fetch the contact instead
    return null;
  }
  return params;
};

const fetchPrelinked = async () => {
  try {
    const modKey = effectiveModuleKey.value;
    if (!modKey) return;
    const peopleContextId = props.context?.personId ?? props.context?.contactId;
    // When context has taskId (Task page passes preselectedIds from parent), skip prelinked fetch here
    if (props.context?.taskId && props.sourceModuleKey === 'tasks') {
      return;
    }
    // When linking from a source record (Deal, Task, Person, etc.), fetch already-linked target IDs via relationships/links
    const sourceRecordId = props.context?.dealId ?? props.context?.taskId ?? props.context?.personId ?? props.context?.sourceRecordId;
    if (sourceRecordId && props.sourceAppKey && props.sourceModuleKey) {
      try {
        const res = await apiClient.get('/relationships/links', {
          params: {
            appKey: props.sourceAppKey,
            moduleKey: props.sourceModuleKey,
            recordId: sourceRecordId
          }
        });
        if (res?.success && Array.isArray(res.data)) {
          const relKey = (selectedRecordTypeOption.value?.relationshipKey || '').toLowerCase();
          const modKeyLower = normalizeModuleKey(modKey);
          const ids = res.data
            .filter((link) => {
              if (!link?.relatedRecord?.recordId) return false;
              if (relKey) return (link.relationshipKey || '').toLowerCase() === relKey;
              // Fallback when relationshipKey isn't available yet (e.g. before type option metadata resolves)
              const relatedModuleKey = normalizeModuleKey(link?.relatedRecord?.moduleKey || '');
              return relatedModuleKey === modKeyLower;
            })
            .map((link) => link.relatedRecord.recordId);
          const normalizedIds = ids.map((id) => String(id));
          const mergedPrelinked = new Set([...prelinkedIds.value, ...normalizedIds]);
          prelinkedIds.value = mergedPrelinked;
          selectedIds.value = new Set([...mergedPrelinked, ...selectedIds.value]);
        }
      } catch (e) {
        // ignore
      }
      await mergePersonOrganizationFromLookup(modKey);
      await mergeOrganizationPeopleFromLookup(modKey);
      return;
    }
    // Special case: when linking organizations to a contact, fetch the contact to get its current organization
    if (modKey === 'organizations' && peopleContextId) {
      try {
        const contactRes = await apiClient.get(`/people/${peopleContextId}`);
        if (contactRes?.success && contactRes.data?.organization) {
          const orgId = typeof contactRes.data.organization === 'object'
            ? contactRes.data.organization._id
            : contactRes.data.organization;
          if (orgId) {
            const orgIdStr = String(orgId);
            const mergedPrelinked = new Set([...prelinkedIds.value, orgIdStr]);
            prelinkedIds.value = mergedPrelinked;
            selectedIds.value = new Set([orgIdStr, ...selectedIds.value]);
          }
        }
      } catch (e) {
        // ignore
      }
      return;
    }

    const params = buildLinkedFilterParams(modKey, props.context);
    if (params === null) return;

    const endpoint = endpointForModule(modKey);
    const res = await apiClient.get(endpoint, { params });
    let rows = [];
    if (res?.success) rows = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    const ids = rows.map(r => r?._id).filter(Boolean);
    prelinkedIds.value = new Set(ids);
    selectedIds.value = new Set([...ids, ...selectedIds.value]);
  } catch (e) {
    // ignore
  }
};

const fetchItems = async () => {
  const modKey = effectiveModuleKey.value;
  if (!modKey) return;
  loading.value = true;
  try {
    const params = { limit: 50 };
    if (searchQuery.value && searchQuery.value.trim()) {
      params.search = searchQuery.value.trim();
    }
    const endpoint = endpointForModule(modKey);
    const res = await apiClient.get(endpoint, { params });
    if (res.success) {
      let rows = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      if ((modKey === 'organizations' || modKey === 'organization') && !isAdmin.value && !Array.isArray(res.data) && res.data && res.data._id) {
        rows = [res.data];
      }
      items.value = rows;
    } else {
      items.value = Array.isArray(res) ? res : [];
    }
    // Initialize prelinked selection/disable state
    if (prelinkedIds.value.size > 0) {
      // Ensure prelinked are also in selected set for consistency
      selectedIds.value = new Set([...prelinkedIds.value, ...selectedIds.value]);
    }
  } catch (e) {
    items.value = [];
  } finally {
    loading.value = false;
  }
};

watch(() => props.isOpen, async (open) => {
  if (open) {
    prelinkedIds.value = new Set(props.preselectedIds || []);
    selectedIds.value = new Set(props.preselectedIds || []);
    if (useLinkableTargetsFromApi.value) {
      await fetchLinkableTargets();
    }
    if (!showTypeSelector.value || selectedModuleKey.value) {
      await fetchPrelinked();
      await fetchItems();
    }
  } else {
    selectedModuleKey.value = '';
    selectedRecordTypeOption.value = null;
  }
});

watch(effectiveModuleKey, async (key) => {
  if (key && props.isOpen) {
    prelinkedIds.value = new Set(props.preselectedIds || []);
    selectedIds.value = new Set(props.preselectedIds || []);
    await fetchPrelinked();
    await fetchItems();
  }
});

watch(searchQuery, () => {
  if (!effectiveModuleKey.value) return;
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => fetchItems(), 250);
});

const getDisplayName = (item) => getRecordLabel(item);
const getSecondaryText = (item) => item.email || item.status || (item.startDateTime ? formatUserDate(item.startDateTime) : '') || '';

const isSelected = (id) => selectedIds.value.has(id);
const isPrelinked = (id) => prelinkedIds.value.has(id);
const isOrganizationSelectionLockedForPerson = (item) => {
  const targetModuleKey = normalizeModuleKey(effectiveModuleKey.value);
  if (targetModuleKey !== 'organizations') return false;
  if (!getContextPersonId() || prelinkedIds.value.size === 0) return false;
  const itemId = normalizeId(item?._id);
  if (!itemId) return false;
  return !prelinkedIds.value.has(itemId);
};

const isPersonAlreadyLinkedToAnotherOrganization = (item) => {
  const sourceModuleKey = normalizeModuleKey(props.sourceModuleKey);
  const targetModuleKey = normalizeModuleKey(effectiveModuleKey.value);
  if (sourceModuleKey !== 'organizations' || targetModuleKey !== 'people') return false;
  const sourceOrganizationId = getContextSourceRecordId();
  if (!sourceOrganizationId) return false;
  const personOrganizationId = normalizeId(item?.organization);
  if (!personOrganizationId) return false;
  return personOrganizationId !== sourceOrganizationId;
};

const isSelectionBlocked = (item) =>
  isOrganizationSelectionLockedForPerson(item) || isPersonAlreadyLinkedToAnotherOrganization(item);

const selectionBlockedReason = (item) => {
  if (isOrganizationSelectionLockedForPerson(item)) {
    return 'This person already has a linked organization. Unlink it first.';
  }
  if (isPersonAlreadyLinkedToAnotherOrganization(item)) {
    return 'This contact is already linked to another organization. Unlink it first.';
  }
  return '';
};

const toggleSelect = (item) => {
  const id = item._id;
  if (isPrelinked(id) || isSelectionBlocked(item)) return;
  if (!effectiveMultiple.value) {
    selectedIds.value = new Set([...prelinkedIds.value, id]);
    return;
  }
  if (selectedIds.value.has(id)) selectedIds.value.delete(id);
  else selectedIds.value.add(id);
  selectedIds.value = new Set(selectedIds.value);
};
const selectSingle = (item) => {
  if (isPrelinked(item._id) || isSelectionBlocked(item)) return;
  selectedIds.value = new Set([item._id]);
  confirmLink();
};

const confirmLink = () => {
  const idsToLink = Array.from(deltaSelectedIds.value);
  if ((effectiveMultiple.value || useCheckboxListUi.value) && idsToLink.length === 0) return;
  const payload = {
    moduleKey: effectiveModuleKey.value,
    ids: idsToLink,
    context: props.context
  };
  if (selectedRecordTypeOption.value?.relationshipKey) {
    payload.relationshipKey = selectedRecordTypeOption.value.relationshipKey;
    payload.targetAppKey = selectedRecordTypeOption.value.targetAppKey;
    payload.sourceIsCurrent = selectedRecordTypeOption.value.sourceIsCurrent ?? true;
  }
  emit('linked', payload);
  closeDrawer();
};
</script>

<style scoped>
</style>

