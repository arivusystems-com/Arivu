<template>
  <div :class="embedded ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'p-6'">
    <div
      v-if="!embedded"
      class="mb-6 shrink-0"
    >
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.usersTabManagement') }}</h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {{ t('settings.usersPageSubtitle') }}
    </p>
    </div>

    <ListView
      :hide-page-header="embedded"
      :fill-height="embedded"
      :title="t('settings.usersTabManagement')"
      module-key="settings-users"
      :create-label="t('settings.usersInvite')"
      :search-placeholder="t('settings.usersSearchPlaceholder')"
      :data="users"
      :columns="columns"
      :filter-fields="filterFields"
      :loading="loading"
      :statistics="stats"
      :stats-config="statsConfig"
      :selected-stat-key="selectedStatKey"
      :pagination="pagination"
      :sort-field="sortField"
      :sort-order="sortOrder"
      :external-filters="externalFilters"
      :parent-search-query="searchQuery"
      table-id="settings-users-table"
      row-key="_id"
      :show-import="true"
      :show-export="false"
      :selectable="false"
      :has-actions="true"
      row-actions-gutter="7.5rem"
      :row-can-delete="() => false"
      :empty-title="hasActiveFilters ? t('settings.usersEmptyFilteredTitle') : t('settings.usersEmptyTitle')"
      :empty-message="hasActiveFilters ? t('settings.usersEmptyFilteredBody') : t('settings.usersEmptyBody')"
      @create="openInviteModal"
      @import="openImportModal"
      @search-submit="handleSearch"
      @update:search-query="handleSearch"
      @update:filters="handleFiltersUpdate"
      @update:sort="handleSortUpdate"
      @update:pagination="handlePaginationUpdate"
      @stat-click="handleStatClick"
      @fetch="fetchUsers"
      @row-click="handleRowClick"
      @edit="openEditModal"
    >
      <template v-if="embedded" #toolbar-trailing>
        <PermissionButton
          module="settings-users"
          action="create"
          variant="secondary"
          size="compact"
          icon="import"
          icon-only-mobile
          :title="t('settings.usersImportTitle')"
          @click="openImportModal"
        >
          <span class="hidden sm:inline">{{ t('common.importData') }}</span>
        </PermissionButton>
        <PermissionButton
          module="settings-users"
          action="create"
          variant="primary"
          size="compact"
          icon="plus"
          icon-only-mobile
          :title="t('settings.usersInvite')"
          @click="openInviteModal"
        >
          <span class="hidden sm:inline">{{ t('settings.usersInvite') }}</span>
        </PermissionButton>
      </template>

      <template #actions="{ row }">
        <div class="inline-flex items-center gap-1">
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-600 dark:bg-white dark:text-gray-700 dark:hover:bg-gray-50"
            :title="t('actions.edit')"
            @click.stop="openEditModal(row)"
          >
            <PencilSquareIcon class="h-4 w-4" />
          </button>

          <template v-if="!row.isOwner && row.status !== 'deleted'">
            <button
              v-if="canDeactivateUser(row)"
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-amber-600 transition-colors hover:bg-amber-50 hover:text-amber-700 dark:border-gray-600 dark:bg-white"
              :title="t('settings.editUserDeactivate')"
              @click.stop="openLifecycleModal('deactivate', row)"
            >
              <NoSymbolIcon class="h-4 w-4" />
            </button>

            <template v-else-if="row.status === 'inactive'">
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:border-gray-600 dark:bg-white"
                :title="t('settings.editUserReactivate')"
                @click.stop="reactivateUserFromList(row)"
              >
                <ArrowPathIcon class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 dark:border-gray-600 dark:bg-white"
                :title="t('settings.editUserTransferRecords')"
                @click.stop="openLifecycleModal('transfer', row)"
              >
                <ArrowsRightLeftIcon class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:border-gray-600 dark:bg-white"
                :title="t('settings.editUserDeleteAccount')"
                @click.stop="openLifecycleModal('delete', row)"
              >
                <TrashIcon class="h-4 w-4" />
              </button>
            </template>
          </template>
        </div>
      </template>

      <template #cell-user="{ row }">
        <div class="flex min-w-0 items-center gap-3">
          <div class="relative shrink-0">
            <img
              v-if="row.avatar"
              :src="row.avatar"
              :alt="userDisplayName(row)"
              class="h-9 w-9 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
            />
            <div
              v-else
              class="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white dark:ring-gray-800"
              :style="{ backgroundColor: avatarColor(row.email) }"
            >
              {{ userInitials(row) }}
            </div>
            <span
              v-if="isUserOnline(row)"
              class="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-white bg-green-500 dark:border-gray-800"
              :title="t('settings.usersStatActive')"
            />
          </div>
          <div class="min-w-0 flex-1 overflow-hidden">
            <div class="flex min-w-0 flex-nowrap items-center gap-1.5">
              <p class="min-w-0 truncate font-medium text-gray-900 dark:text-white">
                {{ userDisplayName(row) }}
              </p>
              <span
                v-if="row.isOwner"
                class="inline-flex shrink-0 items-center rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
              >
                {{ t('settings.usersStatAdmins') }}
              </span>
              <span
                v-if="!row.emailVerifiedAt && row.status !== 'invited'"
                class="inline-flex shrink-0 items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
              >
                {{ t('settings.usersEmailUnverified') }}
              </span>
            </div>
            <p class="truncate text-sm text-gray-500 dark:text-gray-400">{{ row.email }}</p>
          </div>
        </div>
      </template>

      <template #cell-roleId="{ row }">
        <div v-if="isExternalUserRow(row)" class="flex flex-wrap gap-1">
          <span
            v-for="role in row.externalRoles || []"
            :key="String(role._id)"
            class="inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-xs font-medium text-white"
            :style="{ backgroundColor: role.color || '#0ea5e9' }"
          >
            {{ role.name }}
          </span>
          <span
            v-if="!row.externalRoles?.length"
            class="text-xs text-gray-500 dark:text-gray-400"
          >
            {{ t('settings.externalUserNoPortalRoles') }}
          </span>
        </div>
        <template v-else>
          <span
            v-if="row.roleId"
            class="inline-flex max-w-full items-center truncate rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
            :style="{ backgroundColor: row.roleId.color || '#6049E7' }"
          >
            {{ row.roleId.name }}
          </span>
          <BadgeCell
            v-else
            :value="formatRoleLabel(row.role)"
            :variant="roleVariant(row.role)"
          />
        </template>
      </template>

      <template #cell-status="{ row }">
        <BadgeCell
          :value="formatStatusLabel(row.status)"
          :variant="statusVariant(row.status)"
        />
      </template>

      <template #cell-userType="{ row }">
        <BadgeCell
          :value="formatUserTypeLabel(row)"
          :variant="resolveDisplayUserType(row) === 'EXTERNAL' ? 'warning' : (resolveDisplayUserType(row) === 'ADMIN' ? 'danger' : 'info')"
        />
      </template>

      <template #cell-lastLogin="{ row }">
        <span
          class="text-sm text-gray-600 dark:text-gray-400"
          :title="formatAbsoluteDate(row.lastLogin)"
        >
          {{ formatLastLogin(row.lastLogin) }}
        </span>
      </template>

      <template #cell-createdAt="{ row }">
        <span
          class="text-sm text-gray-600 dark:text-gray-400"
          :title="formatAbsoluteDate(row.createdAt)"
        >
          {{ formatAbsoluteDate(row.createdAt) }}
        </span>
      </template>
    </ListView>

    <InviteUserDrawer
      :is-open="showInviteModal"
      @close="showInviteModal = false"
      @user-invited="handleUserInvited"
    />

    <UserImportModal
      :open="showImportModal"
      @close="showImportModal = false"
      @imported="handleUsersImported"
    />

    <EditUserModal
      :is-open="showEditModal"
      :user="selectedUser"
      @close="showEditModal = false"
      @user-updated="handleUserUpdated"
      @user-deleted="handleUserDeleted"
      @start-lifecycle="openLifecycleFromEdit"
      @portal-roles-updated="fetchUsers"
    />

    <UserTransferRecordsModal
      :open="showLifecycleModal"
      :mode="lifecycleMode"
      :user="lifecycleUser"
      @close="closeLifecycleModal"
      @completed="handleLifecycleCompleted"
    />
  </div>
</template>

<script setup>
defineProps({
  embedded: {
    type: Boolean,
    default: false
  }
});

import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { PencilSquareIcon, NoSymbolIcon, ArrowPathIcon, ArrowsRightLeftIcon, TrashIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import ListView from '@/components/common/ListView.vue';
import PermissionButton from '@/components/common/PermissionButton.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import InviteUserDrawer from './InviteUserDrawer.vue';
import UserImportModal from './UserImportModal.vue';
import EditUserModal from './EditUserModal.vue';
import UserTransferRecordsModal from './UserTransferRecordsModal.vue';
import { useNotifications } from '@/composables/useNotifications';
import { formatRelativeTime } from '@/utils/relativeTime';
import { dateFilterValueToParams, parseDateFilterValue } from '@/utils/dateFilterOptions';
import { formatUserDate } from '@/utils/localeFormat';

const { t } = useI18n();
const { success: notifySuccess, error: notifyError } = useNotifications();

const users = ref([]);
const loading = ref(false);
const totalUsers = ref(0);
const currentPage = ref(1);
const perPage = ref(25);
const searchQuery = ref('');
const sortField = ref('createdAt');
const sortOrder = ref('desc');
const stats = ref({
  total: 0,
  active: 0,
  inactive: 0,
  deleted: 0,
  invited: 0,
  admins: 0
});

const filters = ref({
  user: '',
  roleId: '',
  status: 'active',
  userType: '',
  lastLogin: '',
  createdAt: ''
});
const adminOnlyFilter = ref(false);
const selectedStatKey = ref('total');

const showInviteModal = ref(false);
const showImportModal = ref(false);
const showEditModal = ref(false);
const selectedUser = ref(null);

const showLifecycleModal = ref(false);
/** @type {import('vue').Ref<'deactivate' | 'transfer' | 'delete'>} */
const lifecycleMode = ref('deactivate');
const lifecycleUser = ref(null);

function resolveListFilters(newFilters) {
  const resolved = { ...(newFilters || {}) };

  if (resolved.filterQuery) {
    try {
      const parsed = typeof resolved.filterQuery === 'string'
        ? JSON.parse(resolved.filterQuery)
        : resolved.filterQuery;

      const walk = (node) => {
        if (!node || typeof node !== 'object') return;
        if (node.fieldKey) {
          resolved[node.fieldKey] = node.value;
          return;
        }
        if (Array.isArray(node.children)) {
          node.children.forEach(walk);
        }
      };

      walk(parsed);
    } catch {
      // ignore malformed filterQuery payloads
    }
    delete resolved.filterQuery;
  }

  return resolved;
}

const availableRoles = ref([]);

const roleFilterOptions = computed(() =>
  availableRoles.value.map((role) => ({
    value: role._id,
    label: role.name
  }))
);

const statusFilterOptions = computed(() => [
  { value: 'active', label: t('settings.usersStatActive') },
  { value: 'inactive', label: t('settings.usersStatInactive') },
  { value: 'deleted', label: t('settings.usersStatDeleted') },
  { value: 'invited', label: t('settings.usersStatusInvited') },
  { value: 'suspended', label: t('settings.usersStatusSuspended') }
]);

const userTypeFilterOptions = computed(() => [
  { value: 'STANDARD', label: t('settings.userTypeStandard') },
  { value: 'ADMIN', label: t('settings.userTypeAdmin') },
  { value: 'EXTERNAL', label: t('settings.inviteExternal') }
]);

const columns = computed(() => [
  {
    key: 'user',
    label: t('settings.usersColUser'),
    sortable: true,
    visible: true,
    showInTable: true,
    visibility: { list: true },
    minWidth: '16rem',
    locked: true,
    filterType: 'text',
    dataType: 'text'
  },
  {
    key: 'roleId',
    label: t('settings.usersColRole'),
    sortable: true,
    visible: true,
    showInTable: true,
    visibility: { list: true },
    dataType: 'select',
    filterType: 'select',
    options: roleFilterOptions.value
  },
  {
    key: 'status',
    label: t('settings.usersColStatus'),
    sortable: true,
    visible: true,
    showInTable: true,
    visibility: { list: true },
    dataType: 'select',
    filterType: 'select',
    options: statusFilterOptions.value
  },
  {
    key: 'userType',
    label: t('settings.usersColType'),
    sortable: false,
    visible: true,
    showInTable: true,
    visibility: { list: true },
    dataType: 'select',
    filterType: 'select',
    options: userTypeFilterOptions.value
  },
  {
    key: 'lastLogin',
    label: t('settings.usersColLastLogin'),
    sortable: true,
    visible: true,
    showInTable: true,
    visibility: { list: true },
    dataType: 'date',
    filterType: 'date'
  },
  {
    key: 'createdAt',
    label: t('settings.usersColJoined'),
    sortable: true,
    visible: true,
    showInTable: true,
    visibility: { list: true },
    dataType: 'date',
    filterType: 'date'
  }
]);

const filterFields = computed(() => [
  {
    key: 'user',
    label: t('settings.usersColUser'),
    type: 'text',
    filterType: 'text'
  },
  {
    key: 'roleId',
    label: t('settings.usersFilterRoleLabel'),
    type: 'select',
    filterType: 'select',
    options: roleFilterOptions.value
  },
  {
    key: 'status',
    label: t('settings.usersColStatus'),
    type: 'select',
    filterType: 'select',
    dataType: 'select',
    options: statusFilterOptions.value
  },
  {
    key: 'userType',
    label: t('settings.usersColType'),
    type: 'select',
    filterType: 'select',
    options: userTypeFilterOptions.value
  },
  {
    key: 'lastLogin',
    label: t('settings.usersColLastLogin'),
    type: 'date',
    filterType: 'date',
    dataType: 'date'
  },
  {
    key: 'createdAt',
    label: t('settings.usersColJoined'),
    type: 'date',
    filterType: 'date',
    dataType: 'date'
  }
]);

const statsConfig = computed(() => [
  { name: t('settings.usersStatTotal'), key: 'total', formatter: 'number' },
  { name: t('settings.usersStatActive'), key: 'active', formatter: 'number' },
  { name: t('settings.usersStatPending'), key: 'invited', formatter: 'number' },
  { name: t('settings.usersStatInactive'), key: 'inactive', formatter: 'number' },
  { name: t('settings.usersStatDeleted'), key: 'deleted', formatter: 'number' },
  { name: t('settings.usersStatAdmins'), key: 'admins', formatter: 'number' }
]);

const pagination = computed(() => ({
  currentPage: currentPage.value,
  totalPages: Math.max(1, Math.ceil(totalUsers.value / perPage.value)),
  totalRecords: totalUsers.value,
  limit: perPage.value
}));

const externalFilters = computed(() => ({
  user: filters.value.user,
  ...filters.value,
  ...(adminOnlyFilter.value ? { adminOnly: 'true' } : {})
}));

const hasActiveFilters = computed(() =>
  Boolean(
    searchQuery.value
    || filters.value.user
    || filters.value.roleId
    || filters.value.status
    || filters.value.userType
    || filters.value.lastLogin
    || filters.value.createdAt
    || adminOnlyFilter.value
  )
);

const appendDateFilterParams = (params, fieldKey, rawValue) => {
  const parsed = dateFilterValueToParams(fieldKey, parseDateFilterValue(rawValue));
  Object.entries(parsed).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.append(key, String(value));
    }
  });
};

const userDisplayName = (user) => `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '';

const userInitials = (user) => {
  const first = user.firstName?.[0] || '';
  const last = user.lastName?.[0] || '';
  if (first || last) return `${first}${last}`.toUpperCase();
  return (user.email?.[0] || 'U').toUpperCase();
};

const avatarColor = (email = '') => {
  const palette = ['#6049E7', '#2563EB', '#0891B2', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777'];
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
};

const isUserOnline = (user) => {
  if (!user.lastLogin) return false;
  const lastLoginMs = new Date(user.lastLogin).getTime();
  if (Number.isNaN(lastLoginMs)) return false;
  return Date.now() - lastLoginMs < 15 * 60 * 1000;
};

const buildListParams = () => {
  const params = new URLSearchParams({
    page: String(currentPage.value),
    limit: String(perPage.value),
    sortBy: sortField.value,
    sortOrder: sortOrder.value
  });

  const term = String(searchQuery.value || filters.value.user || '').trim();
  if (term) {
    params.append('search', term);
  }

  if (filters.value.roleId) {
    params.append('roleId', filters.value.roleId);
  }

  if (filters.value.status) {
    params.append('status', filters.value.status);
  }

  if (filters.value.userType) {
    params.append('userType', filters.value.userType);
  }

  appendDateFilterParams(params, 'lastLogin', filters.value.lastLogin);
  appendDateFilterParams(params, 'createdAt', filters.value.createdAt);

  if (adminOnlyFilter.value) {
    params.append('adminOnly', 'true');
  }

  return params;
};

const fetchStats = async () => {
  try {
    const response = await apiClient.get('/users?limit=500&page=1&sortBy=createdAt&sortOrder=desc');
    if (response.success) {
      const all = Array.isArray(response.data) ? response.data : [];
      stats.value = {
        total: response.total ?? all.length,
        active: all.filter((u) => u.status === 'active' || !u.status).length,
        inactive: all.filter((u) => u.status === 'inactive').length,
        deleted: all.filter((u) => u.status === 'deleted').length,
        invited: all.filter((u) => u.status === 'invited').length,
        admins: all.filter((u) => resolveDisplayUserType(u) === 'ADMIN').length
      };
    }
  } catch (error) {
    console.error('Error fetching user stats:', error);
  }
};

const fetchRoles = async () => {
  try {
    const response = await apiClient.get('/roles');
    if (response.success) {
      availableRoles.value = response.data || [];
    }
  } catch (error) {
    console.error('Error fetching roles:', error);
  }
};

const fetchUsers = async () => {
  loading.value = true;
  try {
    const response = await apiClient.get(`/users?${buildListParams().toString()}`);

    if (response.success) {
      users.value = response.data;
      totalUsers.value = response.total || response.data.length;
    }
  } catch (error) {
    console.error('Error fetching users:', error);
  } finally {
    loading.value = false;
  }
};

const refreshAll = async () => {
  await Promise.all([fetchUsers(), fetchStats()]);
};

const handleStatClick = (statItem) => {
  adminOnlyFilter.value = false;
  selectedStatKey.value = statItem?.key || 'total';

  switch (statItem.key) {
    case 'total':
      filters.value = { user: '', roleId: '', status: '', userType: '', lastLogin: '', createdAt: '' };
      searchQuery.value = '';
      break;
    case 'active':
      filters.value = { ...filters.value, status: 'active' };
      break;
    case 'inactive':
      filters.value = { ...filters.value, status: 'inactive' };
      break;
    case 'deleted':
      filters.value = { ...filters.value, status: 'deleted' };
      break;
    case 'invited':
      filters.value = { ...filters.value, status: 'invited' };
      break;
    case 'admins':
      filters.value = { ...filters.value, status: '' };
      adminOnlyFilter.value = true;
      break;
    default:
      break;
  }

  currentPage.value = 1;
  fetchUsers();
};

const ALL_FILTER_KEYS = ['user', 'roleId', 'status', 'userType', 'lastLogin', 'createdAt'];

const handleFiltersUpdate = (newFilters) => {
  const resolved = resolveListFilters(newFilters ?? {});
  const next = { ...filters.value };

  for (const key of ALL_FILTER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(resolved, key)) {
      next[key] = resolved[key] ?? '';
    }
  }

  const clearedAllFilters = ALL_FILTER_KEYS.every(
    (key) => Object.prototype.hasOwnProperty.call(resolved, key) && !resolved[key]
  );
  if (clearedAllFilters) {
    adminOnlyFilter.value = false;
  } else if (Object.prototype.hasOwnProperty.call(resolved, 'adminOnly')) {
    adminOnlyFilter.value = Boolean(resolved.adminOnly);
  }

  selectedStatKey.value = null;
  filters.value = next;
  currentPage.value = 1;
  fetchUsers();
};

const handleSearch = (query) => {
  searchQuery.value = typeof query === 'string' ? query : '';
  currentPage.value = 1;
  fetchUsers();
};

const handlePaginationUpdate = (p) => {
  if (p.currentPage) currentPage.value = p.currentPage;
  if (p.limit) perPage.value = p.limit;
  fetchUsers();
};

const handleSortUpdate = ({ sortField: field, sortOrder: order }) => {
  sortField.value = field;
  sortOrder.value = order;
  fetchUsers();
};

const openInviteModal = () => {
  showInviteModal.value = true;
};

const openImportModal = () => {
  showImportModal.value = true;
};

const openEditModal = (user) => {
  selectedUser.value = user;
  showEditModal.value = true;
};

const handleRowClick = (row, event) => {
  const target = event?.target;
  if (target instanceof Element && target.closest('input, button, a, label, [role="checkbox"]')) {
    return;
  }
  openEditModal(row);
};

const handleUserInvited = () => {
  showInviteModal.value = false;
  refreshAll();
  notifySuccess(t('settings.inviteSuccessCreated'));
};

const handleUsersImported = () => {
  refreshAll();
};

const handleUserUpdated = () => {
  showEditModal.value = false;
  selectedUser.value = null;
  refreshAll();
};

const handleUserDeleted = async () => {
  showEditModal.value = false;
  selectedUser.value = null;
  await refreshAll();
};

function openLifecycleModal(mode, user) {
  if (!user?._id) return;
  lifecycleMode.value = mode;
  lifecycleUser.value = user;
  showLifecycleModal.value = true;
}

function closeLifecycleModal() {
  showLifecycleModal.value = false;
  lifecycleUser.value = null;
}

function canDeactivateUser(row) {
  const status = row?.status || 'active';
  return ['active', 'invited', 'suspended'].includes(status);
}

async function reactivateUserFromList(row) {
  if (!row?._id) return;
  try {
    const response = await apiClient.put(`/users/${row._id}`, { status: 'active' });
    if (response.success) {
      notifySuccess(t('settings.editUserReactivateSuccess'));
      await refreshAll();
    } else {
      notifyError(t('settings.editUserReactivateFailed'));
    }
  } catch (err) {
    console.error('Error reactivating user:', err);
    notifyError(t('settings.editUserReactivateFailed'));
  }
}

function openLifecycleFromEdit(payload) {
  const mode = payload?.mode || 'deactivate';
  const user = payload?.user || selectedUser.value;
  showEditModal.value = false;
  openLifecycleModal(mode, user);
}

async function handleLifecycleCompleted() {
  closeLifecycleModal();
  selectedUser.value = null;
  await refreshAll();
}

const formatStatusLabel = (status) => {
  const normalized = status || 'active';
  const labels = {
    active: t('settings.usersStatActive'),
    inactive: t('settings.usersStatInactive'),
    deleted: t('settings.usersStatDeleted'),
    suspended: t('settings.usersStatusSuspended'),
    invited: t('settings.usersStatusInvited')
  };
  return labels[normalized] || normalized;
};

const statusVariant = (status) => {
  const normalized = status || 'active';
  const variants = {
    active: 'success',
    inactive: 'default',
    deleted: 'danger',
    suspended: 'danger',
    invited: 'warning'
  };
  return variants[normalized] || 'default';
};

const formatRoleLabel = (role) => {
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1);
};

const roleVariant = (role) => {
  const variants = {
    owner: 'primary',
    admin: 'danger',
    manager: 'info',
    user: 'success',
    viewer: 'default'
  };
  return variants[role?.toLowerCase()] || 'default';
};

const isExternalUserRow = (row) =>
  resolveDisplayUserType(row) === 'EXTERNAL';

/** Effective Type for UI: Owner/Admin roles → Admin even if DB still has legacy STANDARD/INTERNAL. */
function resolveDisplayUserType(row) {
  if (row?.isOwner) return 'ADMIN';
  const roleName = String(row?.roleId?.name || row?.role || '').trim().toLowerCase();
  if (roleName === 'owner' || roleName === 'admin' || roleName === 'administrator') {
    return 'ADMIN';
  }
  const tType = String(row?.userType || '').toUpperCase();
  if (tType === 'EXTERNAL' || tType === 'PORTAL') return 'EXTERNAL';
  if (tType === 'ADMIN' || tType === 'SYSTEM') return 'ADMIN';
  return 'STANDARD';
}

const formatUserTypeLabel = (rowOrType) => {
  const tType = typeof rowOrType === 'object' && rowOrType
    ? resolveDisplayUserType(rowOrType)
    : String(rowOrType || '').toUpperCase();
  if (tType === 'EXTERNAL' || tType === 'PORTAL') return t('settings.inviteExternal');
  if (tType === 'ADMIN' || tType === 'SYSTEM') return t('settings.userTypeAdmin');
  if (tType === 'STANDARD' || tType === 'INTERNAL') return t('settings.userTypeStandard');
  return t('settings.userTypeStandard');
};

const formatAbsoluteDate = (date) => {
  if (!date) return t('settings.usersLastLoginNever');
  return formatUserDate(date) || t('settings.usersLastLoginNever');
};

const formatLastLogin = (date) => {
  if (!date) return t('settings.usersLastLoginNever');
  const relative = formatRelativeTime(date, t);
  return relative || formatAbsoluteDate(date);
};

onMounted(() => {
  fetchRoles();
  refreshAll();
});
</script>
