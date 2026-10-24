<!--
  Deal Relationship Editor
  Manages dealPeople and dealOrganizations with add/remove/primary.
  Deal Organization Role is on the relationship (not Organization Type).
  UI-only; backend syncs legacy contactId/accountId.
-->
<template>
  <div class="space-y-6">
    <!-- A. People on this Deal -->
    <section class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('deals.dealRelationshipEditorPeopleOnThisDeal') }}</h3>
      </div>
      <div class="p-4 space-y-3">
        <ul v-if="sortedPeople.length" class="space-y-2">
          <li
            v-for="(entry, idx) in sortedPeople"
            :key="peopleKey(entry, idx)"
            class="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/80"
          >
            <div class="min-w-0 flex-1 space-y-1.5">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-medium text-gray-900 dark:text-white truncate">
                  {{ personName(entry.personId) }}
                </span>
                <span
                  v-if="entry.isPrimary"
                  class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                >{{ t('forms.rtColorPrimary') }}</span>
              </div>
              <select
                v-if="!readOnly"
                :value="normalizeDealPersonRole(entry.role)"
                class="w-full max-w-[12rem] px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                :aria-label="t('deals.dealRelationshipEditorSelectPersonRole')"
                @change="onChangePersonRole(entry, $event)"
              >
                <option v-for="role in personRoleOptions" :key="role.value" :value="role.value">
                  {{ role.label }}
                </option>
              </select>
              <span v-else class="text-xs text-gray-500 dark:text-gray-400">{{ personRoleLabel(entry.role) }}</span>
            </div>
            <div v-if="!readOnly" class="flex items-center gap-1 shrink-0">
              <button
                type="button"
                @click="setPrimaryPerson(entry)"
                :disabled="entry.isPrimary"
                class="p-1.5 rounded text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                :title="t('deals.dealRelationshipEditorSetAsPrimaryContact')"
              >
                <StarIconSolid v-if="entry.isPrimary" class="w-4 h-4 text-indigo-600" />
                <StarIcon v-else class="w-4 h-4" />
              </button>
              <button
                type="button"
                @click="removePerson(entry)"
                class="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                :title="t('deals.dealRelationshipEditorRemoveFromDeal2')"
              >
                <TrashIcon class="w-4 h-4" />
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400 py-2">{{ t('deals.dealRelationshipEditorNoPeopleLinkedYet') }}</p>

        <div v-if="!readOnly" class="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <select
            :value="pendingPersonId"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            @change="onSelectPendingPerson($event)"
          >
            <option value="">{{ t('deals.dealRelationshipEditorSelectPersonToAdd') }}</option>
            <option v-for="p in peopleOptions" :key="p._id" :value="p._id">
              {{ (p.first_name || '') + ' ' + (p.last_name || '') }} {{ p.email ? `(${p.email})` : '' }}
            </option>
          </select>
          <div v-if="pendingPersonId" class="flex items-end gap-2">
            <div class="flex-1 min-w-0">
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {{ t('deals.dealRelationshipEditorSelectPersonRole') }}
              </label>
              <select
                v-model="pendingPersonRole"
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option v-for="role in personRoleOptions" :key="role.value" :value="role.value">
                  {{ role.label }}
                </option>
              </select>
            </div>
            <button
              type="button"
              class="shrink-0 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500"
              @click="confirmAddPerson"
            >
              {{ t('deals.dealRelationshipEditorAddPerson') }}
            </button>
          </div>
          <p v-if="contextOrgIdForPeopleFilter" class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('deals.dealRelationshipEditorShowingContactsFor') }}
            <span class="font-medium text-gray-700 dark:text-gray-300">{{ orgNameForFilterHint }}</span>
          </p>
          <p v-else class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('deals.dealRelationshipEditorPeopleAddHint') }}
          </p>
        </div>
      </div>
      <p v-if="validationErrors.primaryContact" class="px-4 pb-3 text-sm text-red-600 dark:text-red-400">
        {{ validationErrors.primaryContact }}
      </p>
    </section>

    <!-- B. Organizations on this Deal -->
    <section class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('deals.dealRelationshipEditorOrganizationsOnThisDeal') }}</h3>
      </div>
      <div class="p-4 space-y-3">
        <ul v-if="sortedOrgs.length" class="space-y-2">
          <li
            v-for="(entry, idx) in sortedOrgs"
            :key="orgKey(entry, idx)"
            class="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/80"
          >
            <div class="min-w-0 flex-1 space-y-1.5">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-medium text-gray-900 dark:text-white truncate">
                  {{ orgName(entry.organizationId) }}
                </span>
                <span
                  v-if="entry.isPrimary"
                  class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                >{{ t('forms.rtColorPrimary') }}</span>
              </div>
              <select
                v-if="!readOnly"
                :value="normalizeDealOrganizationRole(entry.role)"
                class="w-full max-w-[12rem] px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                :aria-label="t('deals.dealRelationshipEditorSelectRole')"
                @change="onChangeOrgRole(entry, $event)"
              >
                <option v-for="role in orgRoleOptions" :key="role.value" :value="role.value">
                  {{ role.label }}
                </option>
              </select>
              <span v-else class="text-xs text-gray-500 dark:text-gray-400">{{ orgRoleLabel(entry.role) }}</span>
            </div>
            <div v-if="!readOnly" class="flex items-center gap-1 shrink-0">
              <button
                type="button"
                @click="setPrimaryOrg(entry)"
                :disabled="entry.isPrimary"
                class="p-1.5 rounded text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                :title="t('deals.dealRelationshipEditorSetAsPrimary')"
              >
                <StarIconSolid v-if="entry.isPrimary" class="w-4 h-4 text-indigo-600" />
                <StarIcon v-else class="w-4 h-4" />
              </button>
              <button
                type="button"
                @click="removeOrg(entry)"
                class="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                :title="t('deals.dealRelationshipEditorRemoveFromDeal')"
              >
                <TrashIcon class="w-4 h-4" />
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400 py-2">{{ t('deals.dealRelationshipEditorNoOrganizationsLinkedYet') }}</p>

        <div v-if="!readOnly" class="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <select
            :value="pendingOrgId"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            @change="onSelectPendingOrganization($event)"
          >
            <option value="">{{ t('deals.dealRelationshipEditorSelectOrganizationToAdd') }}</option>
            <option v-for="o in organizationOptions" :key="o._id" :value="o._id">
              {{ o.name }}
            </option>
          </select>
          <div v-if="pendingOrgId" class="flex items-end gap-2">
            <div class="flex-1 min-w-0">
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {{ t('deals.dealRelationshipEditorSelectRole') }}
              </label>
              <select
                v-model="pendingRole"
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option v-for="role in orgRoleOptions" :key="role.value" :value="role.value">
                  {{ role.label }}
                </option>
              </select>
            </div>
            <button
              type="button"
              class="shrink-0 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500"
              @click="confirmAddOrganization"
            >
              {{ t('deals.dealRelationshipEditorAddOrganization') }}
            </button>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('deals.dealRelationshipEditorOrgAddHint') }}
          </p>
        </div>
      </div>
      <p v-if="validationErrors.activeCustomer" class="px-4 pb-3 text-sm text-red-600 dark:text-red-400">
        {{ validationErrors.activeCustomer }}
      </p>
    </section>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch } from 'vue';
import { StarIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/vue/24/solid';
import apiClient from '@/utils/apiClient';
import {
  DEAL_ORGANIZATION_ROLES,
  DEAL_ORGANIZATION_ROLE_CUSTOMER,
  defaultDealOrganizationRoleFromOrgTypes,
  normalizeDealOrganizationRole,
} from '@/utils/dealOrganizationRoles';
import {
  DEAL_PEOPLE_ROLES,
  DEAL_PERSON_ROLE_DECISION_MAKER,
  defaultDealPersonRole,
  normalizeDealPersonRole,
} from '@/utils/dealPeopleRoles';

const PERSON_ROLE_LABEL_KEYS = {
  decision_maker: 'deals.dealRelationshipPersonRoleDecisionMaker',
  champion: 'deals.dealRelationshipPersonRoleChampion',
  influencer: 'deals.dealRelationshipPersonRoleInfluencer',
  technical_contact: 'deals.dealRelationshipPersonRoleTechnicalContact',
  partner_contact: 'deals.dealRelationshipPersonRolePartnerContact',
  procurement: 'deals.dealRelationshipPersonRoleProcurement',
  legal: 'deals.dealRelationshipPersonRoleLegal',
  other: 'deals.dealRelationshipPersonRoleOther',
};

const ORG_ROLE_LABEL_KEYS = {
  customer: 'deals.dealRelationshipRoleCustomer',
  partner: 'deals.dealRelationshipRolePartner',
  reseller: 'deals.dealRelationshipRoleReseller',
  distributor: 'deals.dealRelationshipRoleDistributor',
  vendor: 'deals.dealRelationshipRoleVendor',
  other: 'deals.dealRelationshipRoleOther',
};

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({ dealPeople: [], dealOrganizations: [] }),
  },
  people: { type: Array, default: () => [] },
  organizations: { type: Array, default: () => [] },
  readOnly: { type: Boolean, default: false },
});

const { t } = useI18n();
const emit = defineEmits(['update:modelValue', 'validate']);

const dealPeople = computed({
  get: () => (Array.isArray(props.modelValue?.dealPeople) ? [...props.modelValue.dealPeople] : []),
  set: (v) => emit('update:modelValue', { ...props.modelValue, dealPeople: v }),
});
const dealOrganizations = computed({
  get: () =>
    Array.isArray(props.modelValue?.dealOrganizations) ? [...props.modelValue.dealOrganizations] : [],
  set: (v) => emit('update:modelValue', { ...props.modelValue, dealOrganizations: v }),
});

const validationErrors = ref({ primaryContact: '', activeCustomer: '' });
const pendingPersonId = ref('');
const pendingPersonRole = ref(DEAL_PERSON_ROLE_DECISION_MAKER);
const pendingOrgId = ref('');
const pendingRole = ref(DEAL_ORGANIZATION_ROLE_CUSTOMER);

const personRoleOptions = computed(() =>
  DEAL_PEOPLE_ROLES.map((value) => ({
    value,
    label: t(PERSON_ROLE_LABEL_KEYS[value]),
  }))
);

const orgRoleOptions = computed(() =>
  DEAL_ORGANIZATION_ROLES.map((value) => ({
    value,
    label: t(ORG_ROLE_LABEL_KEYS[value]),
  }))
);

function normalizeId(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    return String(value._id || value.id || value.recordId || '');
  }
  return String(value);
}

const activePrimaryPersonId = computed(() => {
  const primary = dealPeople.value.find((p) => p.isActive !== false && p.isPrimary);
  return normalizeId(primary?.personId);
});

const activePrimaryCustomerOrgId = computed(() => {
  const primary = dealOrganizations.value.find(
    (o) =>
      o.isActive !== false &&
      o.isPrimary &&
      normalizeDealOrganizationRole(o.role) === DEAL_ORGANIZATION_ROLE_CUSTOMER
  );
  return normalizeId(primary?.organizationId);
});

function personOrgId(person) {
  if (!person) return '';
  const o = person.organization;
  if (o == null || o === '') return '';
  if (typeof o === 'object' && o._id != null) return normalizeId(o._id);
  return normalizeId(o);
}

function findOrganization(id) {
  const nid = normalizeId(id);
  if (!nid) return null;
  return (props.organizations || []).find((x) => String(x._id) === String(nid)) || null;
}

function resolveDefaultRoleForOrg(id) {
  const org = findOrganization(id);
  return defaultDealOrganizationRoleFromOrgTypes(org?.types);
}

const contextOrgIdForPeopleFilter = computed(() => {
  const primaryCust = activePrimaryCustomerOrgId.value;
  if (primaryCust) return primaryCust;
  const activeCustomers = dealOrganizations.value.filter(
    (o) =>
      o.isActive !== false &&
      normalizeDealOrganizationRole(o.role) === DEAL_ORGANIZATION_ROLE_CUSTOMER &&
      normalizeId(o.organizationId)
  );
  if (activeCustomers.length === 1) {
    return normalizeId(activeCustomers[0].organizationId);
  }
  return '';
});

const orgNameForFilterHint = computed(() => {
  const id = contextOrgIdForPeopleFilter.value;
  if (!id) return '';
  const o = findOrganization(id);
  return o?.name || 'this account';
});

const sortedPeople = computed(() => {
  const list = dealPeople.value.filter((p) => p.personId && p.isActive !== false);
  return [...list].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
});
const sortedOrgs = computed(() => {
  const list = dealOrganizations.value.filter((o) => o.organizationId && o.isActive !== false);
  return [...list].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
});

const linkedPersonIds = computed(() => {
  const ids = new Set();
  for (const p of dealPeople.value) {
    if (p.isActive === false) continue;
    const id = normalizeId(p.personId);
    if (id) ids.add(id);
  }
  return ids;
});

const linkedOrgIds = computed(() => {
  const ids = new Set();
  for (const o of dealOrganizations.value) {
    if (o.isActive === false) continue;
    const id = normalizeId(o.organizationId);
    if (id) ids.add(id);
  }
  return ids;
});

const peopleOptions = computed(() => {
  const all = props.people || [];
  const fid = contextOrgIdForPeopleFilter.value;
  const list = fid
    ? all.filter((p) => {
        const oid = personOrgId(p);
        return oid && String(oid) === String(fid);
      })
    : all;
  return list.filter((p) => !linkedPersonIds.value.has(String(p._id)));
});

const organizationOptions = computed(() =>
  (props.organizations || []).filter((o) => !linkedOrgIds.value.has(String(o._id)))
);

function personName(pid) {
  if (!pid) return '—';
  const p = typeof pid === 'object' ? pid : props.people.find((x) => x._id === pid);
  if (!p) return '—';
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || '—';
}
function orgName(oid) {
  if (!oid) return '—';
  const o = typeof oid === 'object' ? oid : findOrganization(oid);
  return o?.name || '—';
}
function personRoleLabel(role) {
  const normalized = normalizeDealPersonRole(role);
  return t(PERSON_ROLE_LABEL_KEYS[normalized]);
}
function orgRoleLabel(role) {
  const normalized = normalizeDealOrganizationRole(role);
  return t(ORG_ROLE_LABEL_KEYS[normalized]);
}
function peopleKey(entry, idx) {
  const id = entry.personId?._id ?? entry.personId;
  return `p-${id}-${idx}`;
}
function orgKey(entry, idx) {
  const id = entry.organizationId?._id ?? entry.organizationId;
  return `o-${id}-${entry.role}-${idx}`;
}

function clearPendingPerson() {
  pendingPersonId.value = '';
  pendingPersonRole.value = defaultDealPersonRole(!!activePrimaryPersonId.value);
}

function clearPendingOrganization() {
  pendingOrgId.value = '';
  pendingRole.value = DEAL_ORGANIZATION_ROLE_CUSTOMER;
}

function onSelectPendingPerson(event) {
  const id = normalizeId(event?.target?.value);
  pendingPersonId.value = id;
  pendingPersonRole.value = defaultDealPersonRole(!!activePrimaryPersonId.value);
}

function confirmAddPerson() {
  const id = normalizeId(pendingPersonId.value);
  if (!id) return;
  const makePrimary = !activePrimaryPersonId.value;
  const role = normalizeDealPersonRole(pendingPersonRole.value);
  addPersonById(id, { role, isPrimary: makePrimary });
  clearPendingPerson();
  maybeLinkPersonOrg(id);
}

function onSelectPendingOrganization(event) {
  const id = normalizeId(event?.target?.value);
  pendingOrgId.value = id;
  if (!id) {
    pendingRole.value = DEAL_ORGANIZATION_ROLE_CUSTOMER;
    return;
  }
  const needsPrimary = !activePrimaryCustomerOrgId.value;
  pendingRole.value = needsPrimary
    ? DEAL_ORGANIZATION_ROLE_CUSTOMER
    : resolveDefaultRoleForOrg(id);
}

function confirmAddOrganization() {
  const id = normalizeId(pendingOrgId.value);
  if (!id) return;
  const needsPrimary = !activePrimaryCustomerOrgId.value;
  const role = needsPrimary
    ? DEAL_ORGANIZATION_ROLE_CUSTOMER
    : normalizeDealOrganizationRole(pendingRole.value);
  addOrganizationById(id, { role, isPrimary: needsPrimary });
  clearPendingOrganization();
}

async function maybeLinkPersonOrg(personId) {
  const person = (props.people || []).find((x) => String(x._id) === String(personId));
  let oid = personOrgId(person);
  if (!oid) {
    try {
      const res = await apiClient.get(`/people/${personId}`);
      const body = res && typeof res === 'object' ? res : {};
      const detail = body.data !== undefined && body.data !== null ? body.data : body;
      oid = personOrgId(detail);
    } catch (e) {
      console.warn('[DealRelationshipEditor] Could not load contact to resolve account:', e);
      return;
    }
  }
  if (!oid || linkedOrgIds.value.has(String(oid))) return;
  const needsPrimary = !activePrimaryCustomerOrgId.value;
  const role = needsPrimary
    ? DEAL_ORGANIZATION_ROLE_CUSTOMER
    : resolveDefaultRoleForOrg(oid);
  addOrganizationById(oid, {
    role,
    isPrimary: needsPrimary,
  });
}

function addPersonById(id, { role = DEAL_PERSON_ROLE_DECISION_MAKER, isPrimary = false } = {}) {
  if (!id) return;
  if (validationErrors.value.primaryContact) validationErrors.value.primaryContact = '';
  const nextRole = normalizeDealPersonRole(role);
  const existing = dealPeople.value.find((p) => normalizeId(p.personId) === id);
  let list = dealPeople.value.map((p) => ({ ...p }));
  if (isPrimary) list = list.map((p) => ({ ...p, isPrimary: false }));
  if (existing) {
    list = list.map((p) =>
      normalizeId(p.personId) === id
        ? { ...p, role: nextRole, isPrimary, isActive: true }
        : p
    );
  } else {
    list.push({
      personId: id,
      role: nextRole,
      isPrimary,
      isActive: true,
      addedAt: new Date(),
    });
  }
  dealPeople.value = list;
}

function onChangePersonRole(entry, event) {
  const nextRole = normalizeDealPersonRole(event?.target?.value);
  const personId = normalizeId(entry.personId);
  dealPeople.value = dealPeople.value.map((p) => {
    if (normalizeId(p.personId) !== personId) return p;
    // Role change must never affect Primary
    return { ...p, role: nextRole };
  });
}

function setPrimaryPerson(entry) {
  if (entry.isPrimary) return;
  if (validationErrors.value.primaryContact) validationErrors.value.primaryContact = '';
  const id = normalizeId(entry.personId);
  // Primary change must never overwrite role
  dealPeople.value = dealPeople.value.map((p) => {
    const sameRow = normalizeId(p.personId) === id;
    if (sameRow) return { ...p, isPrimary: true, isActive: true };
    return { ...p, isPrimary: false };
  });
}

function removePerson(entry) {
  const id = normalizeId(entry.personId);
  dealPeople.value = dealPeople.value.filter((p) => normalizeId(p.personId) !== id);
}

function addOrganizationById(id, { role = DEAL_ORGANIZATION_ROLE_CUSTOMER, isPrimary = false } = {}) {
  if (!id) return;
  if (validationErrors.value.activeCustomer) validationErrors.value.activeCustomer = '';
  let nextRole = normalizeDealOrganizationRole(role);
  let primary = !!isPrimary;
  if (primary) {
    nextRole = DEAL_ORGANIZATION_ROLE_CUSTOMER;
  } else if (nextRole === DEAL_ORGANIZATION_ROLE_CUSTOMER && !activePrimaryCustomerOrgId.value) {
    primary = true;
  }

  const existing = dealOrganizations.value.find(
    (o) => normalizeId(o.organizationId) === id
  );
  let list = dealOrganizations.value.map((o) => ({ ...o }));
  if (primary) {
    list = list.map((o) => ({ ...o, isPrimary: false }));
  }
  if (existing) {
    list = list.map((o) =>
      normalizeId(o.organizationId) === id
        ? { ...o, role: nextRole, isPrimary: primary, isActive: true }
        : o
    );
  } else {
    list.push({
      organizationId: id,
      role: nextRole,
      isPrimary: primary,
      isActive: true,
      addedAt: new Date(),
    });
  }
  dealOrganizations.value = list;
}

function onChangeOrgRole(entry, event) {
  const nextRole = normalizeDealOrganizationRole(event?.target?.value);
  const id = normalizeId(entry.organizationId);
  dealOrganizations.value = dealOrganizations.value.map((o) => {
    if (normalizeId(o.organizationId) !== id) return o;
    if (o.isPrimary && nextRole !== DEAL_ORGANIZATION_ROLE_CUSTOMER) {
      return { ...o, role: DEAL_ORGANIZATION_ROLE_CUSTOMER, isPrimary: true };
    }
    return { ...o, role: nextRole };
  });
}

function setPrimaryOrg(entry) {
  if (entry.isPrimary) return;
  if (validationErrors.value.activeCustomer) validationErrors.value.activeCustomer = '';
  const id = normalizeId(entry.organizationId);
  dealOrganizations.value = dealOrganizations.value.map((o) => {
    const sameRow = normalizeId(o.organizationId) === id;
    if (sameRow) {
      return {
        ...o,
        isPrimary: true,
        role: DEAL_ORGANIZATION_ROLE_CUSTOMER,
        isActive: true,
      };
    }
    return { ...o, isPrimary: false };
  });
}

function removeOrg(entry) {
  const id = normalizeId(entry.organizationId);
  dealOrganizations.value = dealOrganizations.value.filter(
    (o) => normalizeId(o.organizationId) !== id
  );
}

function enforceSinglePrimaryState() {
  let changed = false;
  const nextPeople = dealPeople.value.map((p) => {
    const role = normalizeDealPersonRole(p.role);
    if (role !== p.role) {
      changed = true;
      return { ...p, role };
    }
    return { ...p };
  });
  const nextOrganizations = dealOrganizations.value.map((o) => ({ ...o }));

  // Primary is independent of role — count all isPrimary rows
  const peoplePrimaryIndexes = [];
  for (let i = 0; i < nextPeople.length; i += 1) {
    const row = nextPeople[i];
    if (row?.isActive === false || !row?.isPrimary) continue;
    peoplePrimaryIndexes.push(i);
  }
  if (peoplePrimaryIndexes.length > 1) {
    const keep = peoplePrimaryIndexes[0];
    for (const idx of peoplePrimaryIndexes) {
      const keepPrimary = idx === keep;
      if (nextPeople[idx].isPrimary !== keepPrimary) {
        nextPeople[idx].isPrimary = keepPrimary;
        changed = true;
      }
    }
  }

  const orgPrimaryIndexes = [];
  for (let i = 0; i < nextOrganizations.length; i += 1) {
    const row = nextOrganizations[i];
    if (row?.isActive === false || !row?.isPrimary) continue;
    orgPrimaryIndexes.push(i);
  }
  if (orgPrimaryIndexes.length > 1) {
    const keep = orgPrimaryIndexes[0];
    for (const idx of orgPrimaryIndexes) {
      const keepPrimary = idx === keep;
      if (nextOrganizations[idx].isPrimary !== keepPrimary) {
        nextOrganizations[idx].isPrimary = keepPrimary;
        changed = true;
      }
    }
  }

  for (let i = 0; i < nextOrganizations.length; i += 1) {
    const row = nextOrganizations[i];
    if (row?.isActive === false || !row?.isPrimary) continue;
    const role = normalizeDealOrganizationRole(row.role);
    if (role !== DEAL_ORGANIZATION_ROLE_CUSTOMER) {
      nextOrganizations[i] = { ...row, role: DEAL_ORGANIZATION_ROLE_CUSTOMER };
      changed = true;
    }
  }

  if (changed) {
    dealPeople.value = nextPeople;
    dealOrganizations.value = nextOrganizations;
  }
}

function validate() {
  validationErrors.value = { primaryContact: '', activeCustomer: '' };
  const people = dealPeople.value.filter((p) => p.isActive !== false);
  const orgs = dealOrganizations.value.filter((o) => o.isActive !== false);
  if (people.length === 0 && orgs.length === 0) {
    emit('validate', true);
    return true;
  }
  const primaryContacts = people.filter((p) => p.isPrimary);
  const primaryOrgs = orgs.filter((o) => o.isPrimary);
  const primaryCustomers = primaryOrgs.filter(
    (o) => normalizeDealOrganizationRole(o.role) === DEAL_ORGANIZATION_ROLE_CUSTOMER
  );
  if (people.length > 0 && primaryContacts.length !== 1) {
    validationErrors.value.primaryContact = t('deals.dealRelationshipEditorPrimaryContactRequired');
  }
  if (orgs.length > 0) {
    if (primaryOrgs.length !== 1 || primaryCustomers.length !== 1) {
      validationErrors.value.activeCustomer = t('deals.dealRelationshipEditorPrimaryCustomerRequired');
    }
  }
  const valid = !validationErrors.value.primaryContact && !validationErrors.value.activeCustomer;
  emit('validate', valid);
  return valid;
}

watch(
  () => props.modelValue,
  () => {
    enforceSinglePrimaryState();
    validationErrors.value = { primaryContact: '', activeCustomer: '' };
  },
  { deep: true, immediate: true }
);

defineExpose({ validate });
</script>
