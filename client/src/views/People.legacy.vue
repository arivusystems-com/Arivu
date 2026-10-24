<!--
 * ============================================================================
 * LEGACY COMPONENT — DO NOT USE
 * ============================================================================
 *
 * This file is archived for feature reference only.
 * It predates the resolver-driven People Runtime Contract.
 * Do not import, route to, or reuse directly.
 *
 * Features from this file will be reintroduced incrementally
 * through the new People runtime steps (Step 18+).
 *
 * Archived: January 2026
 * ============================================================================
 -->

<template>
  <div class="mx-auto">
    <!-- Phase 1C: Generic ModuleList (registry-driven) -->
    <!-- Removed: Hardcoded columns, filters, actions, permission checks -->
    <!-- Replaced with: buildModuleListFromRegistry + ModuleList component -->
    <ModuleList
      ref="moduleListRef"
      module-key="people"
      app-key="PLATFORM"
      @create="openCreateModal"
      @import="showImportModal = true"
      @export="exportContacts"
      @row-click="handleRowClick"
      @edit="editContact"
      @delete="handleDelete"
      @bulk-action="handleBulkAction"
    >
      <!-- Custom Name Cell -->
      <template #cell-name="{ row }">
        <div class="flex items-center gap-3">
          <Avatar
            :user="{
              firstName: row.first_name,
              lastName: row.last_name,
              avatar: row.avatar || row.image
            }"
            size="md"
          />
          <div class="min-w-0 flex-1">
            <div class="font-semibold text-gray-900 dark:text-white truncate">
              {{ row.first_name }} {{ row.last_name }}
            </div>
            <div v-if="row.email" class="text-sm text-gray-500 dark:text-gray-400 truncate">
              {{ row.email }}
            </div>
          </div>
        </div>
      </template>

      <!-- Custom Organization Cell -->
      <template #cell-organization="{ row }">
        <span class="font-medium text-gray-900 dark:text-white">
          <template v-if="row.organization && typeof row.organization === 'object' && row.organization.name">
            {{ row.organization.name }}
          </template>
          <template v-else-if="row.organization && typeof row.organization === 'string'">
            {{ row.organization }}
          </template>
          <template v-else>
            <span class="text-gray-400 dark:text-gray-500">-</span>
          </template>
        </span>
      </template>

      <!-- Custom Email Cell -->
      <template #cell-email="{ value }">
        <a
          :href="`mailto:${value}`"
          class="block min-w-0 truncate text-indigo-600 dark:text-indigo-400 hover:underline"
          @click.stop
        >
          {{ value }}
        </a>
      </template>

      <!-- Custom Phone Cell -->
      <template #cell-phone="{ row }">
        <span class="text-gray-700 dark:text-gray-300">{{ row.phone || row.mobile || '-' }}</span>
      </template>

      <!-- Custom Company Cell -->
      <template #cell-account_id="{ row }">
        <span class="text-gray-700 dark:text-gray-300">{{ row.account_id?.name || '-' }}</span>
      </template>

      <!-- Custom Stage Cell with Badge -->
      <template #cell-lifecycle_stage="{ value }">
        <BadgeCell 
          :value="value || 'Lead'" 
          :variant-map="{
            'Lead': 'warning',
            'Qualified': 'info',
            'Opportunity': 'primary',
            'Customer': 'success',
            'Lost': 'danger'
          }"
        />
      </template>

      <!-- Custom Owner Cell -->
      <template #cell-owner_id="{ row }">
        <div v-if="row.owner_id" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.owner_id.firstName || row.owner_id.first_name,
              lastName: row.owner_id.lastName || row.owner_id.last_name,
              email: row.owner_id.email,
              avatar: row.owner_id.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ getUserDisplayName(row.owner_id) }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">Unassigned</span>
      </template>

      <!-- Custom Assigned To Cell -->
      <template #cell-assignedTo="{ row }">
        <div v-if="row.assignedTo" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.assignedTo.firstName || row.assignedTo.first_name,
              lastName: row.assignedTo.lastName || row.assignedTo.last_name,
              email: row.assignedTo.email,
              avatar: row.assignedTo.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ getUserDisplayName(row.assignedTo) }}</span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">Unassigned</span>
      </template>

      <!-- Custom Account Manager Cell (camelCase) -->
      <template #cell-accountManager="{ row }">
        <div v-if="row.accountManager && typeof row.accountManager === 'object'" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.accountManager.firstName || row.accountManager.first_name || row.accountManager.name,
              lastName: row.accountManager.lastName || row.accountManager.last_name,
              email: row.accountManager.email,
              avatar: row.accountManager.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ getUserDisplayName(row.accountManager) }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ typeof row.accountManager === 'string' ? row.accountManager : 'Unassigned' }}
        </span>
      </template>

      <!-- Custom Account Manager Cell (snake_case) -->
      <template #cell-account_manager="{ row }">
        <div v-if="row.account_manager && typeof row.account_manager === 'object'" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.account_manager.firstName || row.account_manager.first_name || row.account_manager.name,
              lastName: row.account_manager.lastName || row.account_manager.last_name,
              email: row.account_manager.email,
              avatar: row.account_manager.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ getUserDisplayName(row.account_manager) }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ typeof row.account_manager === 'string' ? row.account_manager : 'Unassigned' }}
        </span>
      </template>

      <!-- Custom Created By Cell -->
      <template #cell-createdBy="{ row }">
        <div v-if="row.createdBy" class="flex items-center gap-2">
          <Avatar
            v-if="typeof row.createdBy === 'object'"
            :user="{
              firstName: row.createdBy.firstName || row.createdBy.first_name,
              lastName: row.createdBy.lastName || row.createdBy.last_name,
              email: row.createdBy.email,
              avatar: row.createdBy.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ getUserDisplayName(row.createdBy) }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Last Contact Cell -->
      <template #cell-last_contacted_at="{ value }">
        <DateCell :value="value" format="short" />
      </template>

      <!-- Dynamic Picklist/Multi-Picklist cells with colors -->
      <template v-for="field in picklistFields" :key="field.key" #[`cell-${field.key}`]="{ value }">
        <div v-if="field.dataType === 'Picklist' || field.dataType === 'Multi-Picklist'" class="flex flex-wrap gap-1">
          <template v-if="Array.isArray(value) && value.length > 0">
            <BadgeCell 
              v-for="(item, index) in value" 
              :key="index"
              :value="item" 
              :options="field.options || []"
            />
          </template>
          <BadgeCell 
            v-else-if="value && !Array.isArray(value)"
            :value="value" 
            :options="field.options || []"
          />
          <span v-else class="text-gray-400 dark:text-gray-500">-</span>
        </div>
        <span v-else class="text-gray-700 dark:text-gray-300">{{ value || '-' }}</span>
      </template>
    </ModuleList>

    <!-- Create/Edit Drawer -->
    <CreateRecordDrawer 
      :isOpen="showFormModal"
      moduleKey="people"
      :record="editingContact"
      @close="closeFormModal"
      @saved="handleContactSaved"
    />

    <!-- CSV Import Modal -->
    <CSVImportModal 
      v-if="showImportModal"
      entity-type="Contacts"
      @close="showImportModal = false"
      @import-complete="handleImportComplete"
    />
  </div>
</template>

<script setup>
defineOptions({ name: 'PeopleLegacyView' });
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import ModuleList from '@/components/module-list/ModuleList.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import CSVImportModal from '@/components/import/CSVImportModal.vue';
import Avatar from '@/components/common/Avatar.vue';

import { useNotifications } from '@/composables/useNotifications';

const notifications = useNotifications();
const router = useRouter();
const authStore = useAuthStore();
const { openTab } = useTabs();

// State
const moduleListRef = ref(null);
const showFormModal = ref(false);
const showImportModal = ref(false);
const editingContact = ref(null);
const contacts = ref([]);

const refreshList = () => {
  moduleListRef.value?.refresh?.();
};

// User management (for display names)
const usersById = ref({});
const usersLoaded = ref(false);

const upsertUsers = (users) => {
  if (!Array.isArray(users)) return;
  const map = { ...usersById.value };
  for (const user of users) {
    if (!user || typeof user !== 'object') continue;
    const id = user._id || user.id;
    if (!id) continue;
    map[id] = { ...user, _id: id };
  }
  usersById.value = map;
};

const loadUsers = async () => {
  if (usersLoaded.value && Object.keys(usersById.value).length > 0) {
    return;
  }

  try {
    const response = await apiClient.get('/users/list');
    let users = [];
    if (Array.isArray(response)) {
      users = response;
    } else if (Array.isArray(response?.data)) {
      users = response.data;
    } else if (response?.success && Array.isArray(response?.data)) {
      users = response.data;
    } else if (response?.data && Array.isArray(response.data.users)) {
      users = response.data.users;
    } else if (response?.data && Array.isArray(response.data.data)) {
      users = response.data.data;
    }

    if (users.length > 0) {
      upsertUsers(users);
    }
  } catch (error) {
    console.error('Error loading users for People list:', error);
  } finally {
    usersLoaded.value = true;
  }
};

const getUserDisplayName = (user) => {
  if (!user) return 'Unassigned';
  if (typeof user === 'string') {
    const cached = usersById.value[user];
    if (cached) {
      return getUserDisplayName(cached);
    }
    return user;
  }
  const firstName = user.firstName || user.first_name || user.name || '';
  const lastName = user.lastName || user.last_name || '';
  const combined = `${firstName} ${lastName}`.trim();
  if (combined) return combined;
  if (user.email) return user.email;
  if (user.username) return user.username;
  if (user._id && usersById.value[user._id]) {
    return getUserDisplayName(usersById.value[user._id]);
  }
  return 'Unassigned';
};

// Picklist fields for dynamic cell rendering (from module definition)
// TODO: This should come from the list definition, but keeping for now for custom cell rendering
const picklistFields = computed(() => {
  // This will be populated from module definition if needed
  return [];
});

// Event handlers
const handleRowClick = (row, event = null) => {
  viewContact(row._id, event);
};

const handleDelete = (row) => {
  deleteContact(row._id);
};

const handleBulkAction = (actionId, selectedRows) => {
  if (actionId === 'delete' || actionId === 'bulk-delete') {
    bulkDelete(selectedRows);
  } else if (actionId === 'export') {
    bulkExport(selectedRows);
  }
};

const viewContact = (contactId, event = null) => {
  const contact = contacts.value.find(c => c._id === contactId);
  const title = contact 
    ? `${contact.first_name} ${contact.last_name}` 
    : 'Person Detail';
  
  const openInBackground = event && (
    event.button === 1 ||
    event.metaKey ||
    event.ctrlKey
  );
  
  openTab(`/people/${contactId}`, {
    title,
    icon: 'users',
    params: { name: title },
    background: openInBackground
  });
};

const openCreateModal = () => {
  editingContact.value = null;
  showFormModal.value = true;
};

const editContact = (contact) => {
  editingContact.value = contact;
  showFormModal.value = true;
};

const closeFormModal = () => {
  showFormModal.value = false;
  editingContact.value = null;
};

const handleContactSaved = () => {
  closeFormModal();
  refreshList();
};

const handleImportComplete = () => {
  showImportModal.value = false;
  refreshList();
};

const deleteContact = async (contactId) => {
  try {
    await apiClient(`/people/${contactId}`, {
      method: 'DELETE'
    });
    refreshList();
  } catch (error) {
    console.error('Error deleting contact:', error);
    notifications.error('Failed to delete contact');
  }
};

const bulkDelete = async (selectedRows) => {
  try {
    const idsToDelete = selectedRows.map(row => row._id || row);
    for (const id of idsToDelete) {
      await apiClient(`/people/${id}`, { method: 'DELETE' });
    }
    refreshList();
  } catch (error) {
    console.error('Error bulk deleting contacts:', error);
    notifications.error('Failed to delete contacts');
  }
};

const bulkExport = (selectedRows) => {
  // TODO: Implement bulk export
  console.log('Bulk export:', selectedRows);
};

const exportContacts = async () => {
  try {
    const response = await fetch('/api/csv/export/contacts', {
      headers: {
        'Authorization': `Bearer ${authStore.user?.token}`
      }
    });
    
    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contacts_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting contacts:', error);
    notifications.error('Error exporting contacts. Please try again.');
  }
};

// Lifecycle
onMounted(async () => {
  await loadUsers();
});
</script>

