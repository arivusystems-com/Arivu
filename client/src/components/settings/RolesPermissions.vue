<template>
  <div :class="embedded ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'p-6'">
    <!-- Header -->
    <div class="mb-6 shrink-0">
      <template v-if="!embedded">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.usersTabRoles') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('settings.rolesPageSubtitle') }}
        </p>
      </template>

      <!-- Toolbar -->
      <div
        class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        :class="embedded ? 'mt-0' : 'mt-5'"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-1 sm:min-w-0">
          <!-- View toggle -->
          <div
            class="inline-flex self-start rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 p-1"
            role="tablist"
            :aria-label="t('settings.rolesViewToggleAria')"
          >
            <button
              type="button"
              role="tab"
              :aria-selected="viewMode === 'list'"
              :class="viewToggleClass('list')"
              @click="viewMode = 'list'"
            >
              <ListBulletIcon class="h-4 w-4" />
              {{ t('settings.rolesViewList') }}
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="viewMode === 'hierarchy'"
              :class="viewToggleClass('hierarchy')"
              @click="viewMode = 'hierarchy'"
            >
              <Squares2X2Icon class="h-4 w-4" />
              {{ t('settings.rolesViewHierarchy') }}
            </button>
          </div>

          <div v-if="viewMode === 'list'" class="relative flex-1 max-w-md">
            <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              v-model="searchQuery"
              type="search"
              :placeholder="t('settings.rolesSearchPh')"
              class="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 pl-9 pr-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <p v-else class="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
            {{ t('settings.settingsHierarchyToolbarHint') }}
          </p>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <button
            v-if="roles.length === 0"
            type="button"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            @click="initializeDefaultRoles"
          >
            {{ t('settings.rolesInitDefaults') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            @click="openCreateRoleModal"
          >
            <PlusIcon class="h-5 w-5" />
            {{ t('settings.rolesCreate') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <div v-if="loading" class="flex items-center justify-center py-16">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>

      <div
        v-else-if="roles.length === 0"
        class="text-center py-16 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50"
      >
        <ShieldCheckIcon class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.rolesEmptyTitle') }}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">{{ t('settings.rolesEmptyBody') }}</p>
        <button
          type="button"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          @click="openCreateRoleModal"
        >
          <PlusIcon class="h-5 w-5" />
          {{ t('settings.rolesCreate') }}
        </button>
      </div>

      <template v-else>
        <p v-if="viewMode === 'list'" class="mb-3 text-xs text-gray-500 dark:text-gray-400">
          {{ t('settings.rolesCount', { count: filteredRoles.length }) }}
        </p>

        <RolesListTable
          v-if="viewMode === 'list' && (filteredRoles.length > 0 || !searchQuery)"
          :roles="filteredRoles"
          @edit="openEditRoleModal"
          @users="viewRoleUsers"
          @delete="deleteRole"
        />

        <div v-else-if="viewMode === 'list' && filteredRoles.length === 0 && searchQuery" class="text-center py-12 text-sm text-gray-500">
          {{ t('settings.rolesSearchEmpty', { query: searchQuery }) }}
        </div>

        <OrganizationHierarchy
          v-else-if="viewMode === 'hierarchy'"
          embedded
          :roles="roles"
          @refresh="fetchRoles"
          @node-click="openEditRoleModal"
          @add-child="openCreateRoleUnderParent"
          @delete="deleteRole"
          @user-click="handleEditUser"
          @invite-to-role="openInviteToRole"
        />
      </template>
    </div>

    <RoleFormDrawer
      :open="showRoleDrawer"
      :role="selectedRole"
      :initial-tab="drawerInitialTab"
      :default-parent-role-id="defaultParentRoleId"
      @close="closeRoleDrawer"
      @saved="handleRoleSaved"
    />

    <RoleUsersModal
      :is-open="showUsersModal"
      :role="selectedRoleForUsers"
      @close="showUsersModal = false"
      @edit-user="handleEditUser"
      @change-role="handleChangeRole"
      @refresh="fetchRoles"
    />

    <EditUserModal
      v-if="showEditUserModal"
      :is-open="showEditUserModal"
      :user="selectedUserToEdit"
      @close="showEditUserModal = false"
      @user-updated="handleUserUpdated"
    />

    <InviteUserDrawer
      :is-open="showInviteDrawer"
      :initial-role-id="inviteRoleId"
      @close="closeInviteDrawer"
      @user-invited="handleUserInvited"
    />
  </div>
</template>

<script setup>
import { useNotifications } from '@/composables/useNotifications';

import { confirmAction } from '@/composables/useConfirmAction';
defineProps({
  embedded: {
    type: Boolean,
    default: false
  }
});

import { ref, onMounted, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ListBulletIcon,
  Squares2X2Icon,
  MagnifyingGlassIcon,
  PlusIcon,
  ShieldCheckIcon
} from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import RoleFormDrawer from './RoleFormDrawer.vue';
import RolesListTable from './RolesListTable.vue';
import OrganizationHierarchy from './OrganizationHierarchy.vue';
import RoleUsersModal from './RoleUsersModal.vue';
import EditUserModal from './EditUserModal.vue';
import InviteUserDrawer from './InviteUserDrawer.vue';

const { t } = useI18n();
const notifications = useNotifications();


const ROLES_VIEW_KEY = 'arivu-settings-roles-view';
const viewMode = ref(localStorage.getItem(ROLES_VIEW_KEY) || 'list');
const searchQuery = ref('');
const roles = ref([]);
const loading = ref(false);
const showRoleDrawer = ref(false);
const drawerInitialTab = ref('general');
const selectedRole = ref(null);
const showUsersModal = ref(false);
const selectedRoleForUsers = ref(null);
const showEditUserModal = ref(false);
const selectedUserToEdit = ref(null);
const defaultParentRoleId = ref(null);
const showInviteDrawer = ref(false);
const inviteRoleId = ref('');

const filteredRoles = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return roles.value;
  return roles.value.filter((role) => {
    const name = String(role.name || '').toLowerCase();
    const desc = String(role.description || '').toLowerCase();
    const parent = typeof role.parentRole === 'object'
      ? String(role.parentRole?.name || '').toLowerCase()
      : '';
    return name.includes(q) || desc.includes(q) || parent.includes(q);
  });
});

function viewToggleClass(mode) {
  const active = viewMode.value === mode;
  return [
    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    active
      ? 'bg-white dark:bg-gray-800 text-indigo-700 dark:text-indigo-300 shadow-sm'
      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
  ];
}

const fetchRoles = async () => {
  loading.value = true;
  try {
    const response = await apiClient.get('/roles');
    if (response.success) {
      roles.value = response.data;
    }
  } catch (error) {
    console.error('Error fetching roles:', error);
  } finally {
    loading.value = false;
  }
};

const initializeDefaultRoles = async () => {
  if (!await confirmAction(t('settings.rolesInitConfirm'))) return;
  try {
    const response = await apiClient.post('/roles/initialize');
    if (response.success) {
      fetchRoles();
    }
  } catch (error) {
    console.error('Error initializing roles:', error);
    notifications.error(t('settings.rolesInitFailed'));
  }
};

const openCreateRoleModal = () => {
  selectedRole.value = null;
  defaultParentRoleId.value = null;
  drawerInitialTab.value = 'general';
  showRoleDrawer.value = true;
};

const openCreateRoleUnderParent = (parent) => {
  selectedRole.value = null;
  defaultParentRoleId.value = parent?._id || null;
  drawerInitialTab.value = 'general';
  showRoleDrawer.value = true;
};

const closeRoleDrawer = () => {
  showRoleDrawer.value = false;
  defaultParentRoleId.value = null;
};

const openEditRoleModal = (role, tab = 'general') => {
  selectedRole.value = role;
  drawerInitialTab.value = tab;
  showRoleDrawer.value = true;
};

const handleRoleSaved = () => {
  closeRoleDrawer();
  selectedRole.value = null;
  fetchRoles();
};

const deleteRole = async (role) => {
  if (!await confirmAction(t('settings.rolesDeleteConfirm', { name: role.name }))) return;
  try {
    const response = await apiClient.delete(`/roles/${role._id}`);
    if (response.success) {
      fetchRoles();
    } else {
      notifications.error(response.message || t('settings.rolesDeleteFailed'));
    }
  } catch (error) {
    console.error('Error deleting role:', error);
    notifications.error(error.response?.message || t('settings.rolesDeleteFailed'));
  }
};

const viewRoleUsers = (role) => {
  selectedRoleForUsers.value = role;
  showUsersModal.value = true;
};

const handleEditUser = (user) => {
  selectedUserToEdit.value = user;
  showEditUserModal.value = true;
};

const handleChangeRole = (user) => {
  selectedUserToEdit.value = user;
  showEditUserModal.value = true;
};

const handleUserUpdated = () => {
  showEditUserModal.value = false;
  selectedUserToEdit.value = null;
  fetchRoles();
};

const openInviteToRole = (role) => {
  inviteRoleId.value = role?._id ? String(role._id) : '';
  showInviteDrawer.value = true;
};

const closeInviteDrawer = () => {
  showInviteDrawer.value = false;
  inviteRoleId.value = '';
};

const handleUserInvited = () => {
  closeInviteDrawer();
  fetchRoles();
};

onMounted(() => {
  fetchRoles();
});

watch(viewMode, (v) => {
  localStorage.setItem(ROLES_VIEW_KEY, v);
});
</script>
