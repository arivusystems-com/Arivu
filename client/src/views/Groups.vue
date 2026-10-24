<template>
  <div class="mx-auto">
    <!-- Header -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ t('organizations.groupsGroups') }}</h1>
        <p class="text-lg text-gray-600 dark:text-gray-400 mt-2">{{ t('organizations.groupsOrganizeUsersIntoTeamsAndDepartments') }}</p>
      </div>
      <ModuleActions 
        module="groups"
        create-:label="t('settings.groupsNewGroup')"
        :show-import="false"
        @create="openCreateModal"
        @export="exportGroups"
      />
    </div>

    <!-- Statistics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.totalGroups || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('settings.groupsStatTotal') }}</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.activeGroups || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('settings.groupsStatActive') }}</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.totalMembers || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('settings.groupsStatMembers') }}</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ statistics.avgMembersPerGroup || 0 }}</p>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('settings.groupsStatAvg') }}</p>
        </div>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="flex flex-col lg:flex-row gap-4 mb-6">
      <div class="w-full lg:w-80">
        <div class="relative">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            v-model="searchQuery" 
            type="text" 
            :placeholder="t('settings.groupsSearchPh')"
            @input="debouncedSearch"
            class="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>
      </div>

      <div class="flex flex-wrap gap-3 flex-1">
        <select v-model="filters.type" @change="fetchGroups" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">{{ t('settings.groupsFilterAllTypes') }}</option>
          <option value="Team">{{ t('settings.settingsBhScopeTeam') }}</option>
          <option value="Department">{{ t('settings.groupsTypeDepartment') }}</option>
          <option value="Project">{{ t('settings.groupsTypeProject') }}</option>
          <option value="Custom">{{ t('settings.modFieldsBadgeCustomField') }}</option>
        </select>

        <select v-model="filters.isActive" @change="fetchGroups" class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer text-sm">
          <option value="">{{ t('settings.groupsFilterAllStatus') }}</option>
          <option value="true">{{ t('settings.settingsBhStatusActive') }}</option>
          <option value="false">{{ t('settings.settingsBhStatusInactive') }}</option>
        </select>

        <button 
          @click="clearFilters" 
          :disabled="!hasActiveFilters"
          class="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>{{ t('settings.modFieldsClear') }}</button>
      </div>
    </div>

    <!-- Groups Table -->
    <DataTable
      :data="groups"
      :columns="columns"
      :loading="loading"
      :paginated="true"
      :per-page="pagination.limit"
      :total-records="pagination.totalGroups"
      :show-controls="false"
      :selectable="true"
      :resizable="true"
      :column-settings="false"
      :server-side="true"
      table-id="groups-table"
      :mass-actions="massActions"
      row-key="_id"
      empty-:title="t('organizations.groupsNoGroupsFound')"
      empty-message="Get started by creating your first group"
      @select="handleSelect"
      @bulk-action="handleBulkAction"
      @row-click="handleRowClick"
      @edit="editGroup"
      @delete="handleDelete"
      @page-change="changePage"
      @sort="handleSort"
      :statistics="statistics"
      :stats-config="statsConfig"
      :sort-field="sortField"
      :sort-order="sortOrder"
      :pagination="pagination.value"
    >
      <!-- Custom Group Name Cell -->
      <template #cell-name="{ row }">
        <div class="flex items-center gap-3">
          <Avatar
            :record="{
              name: row.name,
              avatar: row.avatar,
              color: row.color
            }"
            size="md"
          />
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="min-w-0 font-semibold text-gray-900 dark:text-white truncate">{{ row.name }}</span>
            <span v-if="row.description" class="min-w-0 text-xs text-gray-500 dark:text-gray-400 truncate">{{ row.description }}</span>
          </div>
        </div>
      </template>

      <!-- Custom Type Cell -->
      <template #cell-type="{ value }">
        <BadgeCell 
          :value="value || 'Team'" 
          :variant-map="{
            'Team': 'primary',
            'Department': 'info',
            'Project': 'warning',
            'Custom': 'secondary'
          }"
        />
      </template>

      <!-- Custom Members Cell -->
      <template #cell-members="{ row }">
        <div class="flex items-center gap-2">
          <div class="flex -space-x-2">
            <div 
              v-for="(member, index) in (row.members || []).slice(0, 3)" 
              :key="member._id || index"
              class="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 overflow-hidden flex-shrink-0"
            >
              <img 
                v-if="member.avatar" 
                :src="member.avatar" 
                :alt="getUserDisplayName(member)"
                class="w-full h-full object-cover"
              />
              <div 
                v-else
                class="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold"
              >
                {{ getUserInitials(member) }}
              </div>
            </div>
          </div>
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ row.memberCount || (row.members?.length || 0) }} member{{ (row.memberCount || row.members?.length || 0) !== 1 ? 's' : '' }}
          </span>
        </div>
      </template>

      <!-- Custom Lead Cell -->
      <template #cell-lead="{ row }">
        <div v-if="row.lead" class="flex items-center gap-2">
          <div 
            v-if="row.lead.avatar"
            class="w-6 h-6 rounded-full overflow-hidden flex-shrink-0"
          >
            <img :src="row.lead.avatar" :alt="getUserDisplayName(row.lead)" class="w-full h-full object-cover" />
          </div>
          <div 
            v-else
            class="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
          >
            {{ getUserInitials(row.lead) }}
          </div>
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ getUserDisplayName(row.lead) }}</span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.groupFormNoLeadAssigned') }}</span>
      </template>

      <!-- Custom Status Cell -->
      <template #cell-isActive="{ value }">
        <BadgeCell 
          :value="value ? 'Active' : 'Inactive'" 
          :variant-map="{
            'Active': 'success',
            'Inactive': 'danger'
          }"
        />
      </template>
    </DataTable>

    <!-- Group Form Modal -->
    <GroupFormModal
      v-if="showFormModal"
      :group="editingGroup"
      @close="closeFormModal"
      @saved="handleGroupSaved"
    />
  </div>
</template>

<script setup>
defineOptions({ name: 'GroupsView' });
import { useI18n } from 'vue-i18n';

import { useNotifications } from '@/composables/useNotifications';
const { t } = useI18n();
const notifications = useNotifications();

import { ref, reactive, computed, onMounted, watch, onActivated } from 'vue';
import { useRouter } from 'vue-router';
import { useBulkActions } from '@/composables/useBulkActions';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import DataTable from '@/components/common/DataTable.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import ModuleActions from '@/components/common/ModuleActions.vue';
import GroupFormModal from '@/components/groups/GroupFormModal.vue';
import Avatar from '@/components/common/Avatar.vue';

const router = useRouter();

// Use tabs composable
const { openTab } = useTabs();

// Use bulk actions composable
const { bulkActions: massActions } = useBulkActions('groups');

// State
const groups = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const showFormModal = ref(false);
const editingGroup = ref(null);

const filters = reactive({
  type: '',
  isActive: ''
});

const pagination = ref({
  currentPage: 1,
  totalPages: 1,
  totalGroups: 0,
  limit: 20
});

const statistics = ref({
  totalGroups: 0,
  activeGroups: 0,
  totalMembers: 0,
  avgMembersPerGroup: 0
});

const sortField = ref('createdAt');
const sortOrder = ref('desc');

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' || 
         (filters?.type || '') !== '' || 
         (filters?.isActive || '') !== '';
});

// Column definitions
const columns = computed(() => {
  return [
    { key: 'name', label: 'Group Name', sortable: true, minWidth: '250px' },
    { key: 'type', label: 'Type', sortable: true, minWidth: '120px' },
    { key: 'members', label: 'Members', sortable: false, minWidth: '200px' },
    { key: 'lead', label: 'Lead', sortable: false, minWidth: '180px' },
    { key: 'isActive', label: 'Status', sortable: true, minWidth: '100px' },
    { key: 'createdAt', label: 'Created', sortable: true, minWidth: '140px' }
  ];
});

// Fetch groups
const fetchGroups = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    params.append('page', pagination.value.currentPage.toString());
    params.append('limit', pagination.value.limit.toString());
    params.append('sortBy', sortField.value);
    params.append('sortOrder', sortOrder.value);
    
    if (searchQuery.value.trim()) {
      params.append('search', searchQuery.value.trim());
    }
    if (filters.type) {
      params.append('type', filters.type);
    }
    if (filters.isActive) {
      params.append('isActive', filters.isActive);
    }

    const data = await apiClient(`/api/groups?${params.toString()}`, {
      method: 'GET'
    });

    if (data.success) {
      groups.value = data.data;
      pagination.value = data.pagination;
      
      // Calculate statistics
      statistics.value = {
        totalGroups: data.pagination.totalGroups,
        activeGroups: data.data.filter(g => g.isActive).length,
        totalMembers: data.data.reduce((sum, g) => sum + (g.memberCount || g.members?.length || 0), 0),
        avgMembersPerGroup: data.data.length > 0 
          ? Math.round(data.data.reduce((sum, g) => sum + (g.memberCount || g.members?.length || 0), 0) / data.data.length)
          : 0
      };
    }
  } catch (error) {
    console.error('❌ Error fetching groups:', error);
  } finally {
    loading.value = false;
  }
};

let searchTimeout = null;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    pagination.value.currentPage = 1;
    fetchGroups();
  }, 500);
};

const changePage = (page) => {
  pagination.value.currentPage = page;
  fetchGroups();
};

const handleSort = (field, order) => {
  sortField.value = field;
  sortOrder.value = order;
  fetchGroups();
};

const clearFilters = () => {
  searchQuery.value = '';
  filters.type = '';
  filters.isActive = '';
  pagination.value.currentPage = 1;
  fetchGroups();
};

const handleRowClick = (group, event) => {
  const groupId = group._id;
  const title = group.name || 'Group';
  
  // Check for modifier keys (Cmd/Ctrl for background tab)
  const openInBackground = event && (
    event.button === 1 || // Middle mouse button
    event.metaKey ||      // Cmd on Mac
    event.ctrlKey         // Ctrl on Windows/Linux
  );
  
  openTab(`/groups/${groupId}`, {
    title,
    icon: 'users',
    params: { name: title },
    background: openInBackground,
    insertAdjacent: true
  });
};

const openCreateModal = () => {
  editingGroup.value = null;
  showFormModal.value = true;
};

const editGroup = (group) => {
  editingGroup.value = group;
  showFormModal.value = true;
};

const closeFormModal = () => {
  showFormModal.value = false;
  editingGroup.value = null;
};

const handleGroupSaved = (savedGroup) => {
  closeFormModal();
  fetchGroups(); // Refresh the list
};

const handleSelect = (selectedRows) => {
  console.log(`${selectedRows.length} groups selected`);
};

const handleBulkAction = async (actionId, selectedRows) => {
  const groupIds = selectedRows.map(group => group._id);
  
  try {
    if (actionId === 'bulk-delete' || actionId === 'delete') {
      await Promise.all(
        groupIds.map(id => apiClient(`/api/groups/${id}`, { method: 'DELETE' }))
      );
      
      fetchGroups();
    }
  } catch (error) {
    console.error('Error performing bulk action:', error);
    notifications.error(t('common.groupsToastErrorPerformingBulkActionPlease'));
  }
};

const handleDelete = async (group) => {
  try {
    await apiClient(`/api/groups/${group._id}`, {
      method: 'DELETE'
    });
    fetchGroups();
  } catch (error) {
    console.error('Error deleting group:', error);
    notifications.error(t('common.groupsToastErrorDeletingGroupPleaseTry'));
  }
};

const exportGroups = () => {
  console.log('Export groups');
  // TODO: Implement export functionality
};

// Helper functions
const getInitials = (name) => {
  if (!name) return '?';
  const words = name.trim().split(' ');
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const getUserInitials = (user) => {
  if (!user) return '?';
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.username) {
    return user.username.substring(0, 2).toUpperCase();
  }
  if (user.email) {
    return user.email.substring(0, 2).toUpperCase();
  }
  return '?';
};

const getUserDisplayName = (user) => {
  if (!user) return 'Unknown';
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`.trim();
  }
  if (user.username) return user.username;
  if (user.email) return user.email;
  return 'Unknown User';
};

// Lifecycle
onMounted(() => {
  fetchGroups();
});

onActivated(() => {
  fetchGroups();
});
</script>

