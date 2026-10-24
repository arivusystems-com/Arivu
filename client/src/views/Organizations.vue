<template>
  <div class="mx-auto w-full">
    <!-- Registry-Driven ModuleList -->
    <ModuleList
      ref="moduleListRef"
      module-key="organizations"
      app-key="PLATFORM"
      @create="openCreateModal"
      @import="showImportModal = true"
      @export="exportOrganizations"
      @row-click="handleRowClick"
      @edit="editOrganizationFromList"
      @delete="handleInlineDelete"
      @bulk-action="handleBulkAction"
    >
      <!-- Custom Organization Cell -->
      <template #cell-name="{ row }">
        <div class="flex items-center gap-3">
          <Avatar
            :record="{
              name: row.name,
              avatar: row.avatar || row.logo || row.image
            }"
            size="md"
          />
          <div class="min-w-0 flex-1">
            <div
              class="min-w-0 font-semibold text-gray-900 dark:text-white truncate"
            >
              {{ row.name }}
            </div>
            <div
              v-if="row.domain"
              class="min-w-0 text-sm text-gray-500 dark:text-gray-400 truncate"
            >
              {{ row.domain }}
            </div>
          </div>
        </div>
      </template>

      <!-- Custom Industry Cell with truncation and tooltip -->
      <template #cell-industry="{ value }">
        <span 
          v-if="value" 
          class="text-gray-700 dark:text-gray-300 truncate block max-w-xs" 
          :title="value"
        >
          {{ value }}
        </span>
        <span v-else class="text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Participation column (storage key types = denormalized union; UI prefers participations) -->
      <template #cell-types="{ row }">
        <OrganizationListParticipationTypeCell
          :row="row"
          :badge-options="organizationTypesPicklistOptions"
        />
      </template>

      <!-- Custom Subscription Cell with Badge -->
      <template #cell-subscription="{ row }">
        <BadgeCell 
          :value="(row.subscription?.tier || 'trial').charAt(0).toUpperCase() + (row.subscription?.tier || 'trial').slice(1)" 
          :variant-map="{
            'Trial': 'warning',
            'Starter': 'info',
            'Professional': 'primary',
            'Enterprise': 'success'
          }"
        />
      </template>

      <!-- Custom Status Cell with Badge -->
      <template #cell-isActive="{ value }">
        <BadgeCell 
          :value="value ? 'Active' : 'Inactive'" 
          :variant-map="{
            'Active': 'success',
            'Inactive': 'danger'
          }"
        />
      </template>

      <!-- Derived lifecycle status -->
      <template #cell-derivedStatus="{ row }">
        <BadgeCell
          v-if="resolveOrganizationKeyFieldStatus(row)"
          :value="resolveOrganizationKeyFieldStatus(row)"
          :options="resolveOrganizationListStatusOptions(row)"
        />
        <span v-else class="text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Last Activity -->
      <template #cell-lastActivity="{ value }">
        <DateCell :value="value" format="short" />
      </template>

      <!-- Custom Contact Count Cell -->
      <template #cell-contactCount="{ value }">
        <span class="text-gray-700 dark:text-gray-300 font-medium">{{ value || 0 }}</span>
      </template>

      <!-- Custom Created Date Cell -->
      <template #cell-createdAt="{ value }">
        <DateCell :value="value" format="short" />
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
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ getUserDisplayName(row.createdBy) }}</span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Assigned To Cell - handle different case variations -->
      <template #cell-assignedTo="{ row }">
        <div v-if="row.assignedTo && typeof row.assignedTo === 'object' && row.assignedTo !== null && !Array.isArray(row.assignedTo)" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.assignedTo.firstName || row.assignedTo.name || row.assignedTo.first_name,
              lastName: row.assignedTo.lastName || row.assignedTo.last_name,
              email: row.assignedTo.email,
              avatar: row.assignedTo.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ getUserDisplayName(row.assignedTo) }}</span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('records.editableUnassigned') }}</span>
      </template>
      <!-- Also support lowercase variant -->
      <template #cell-assignedto="{ row }">
        <div v-if="row.assignedTo && typeof row.assignedTo === 'object' && row.assignedTo !== null && !Array.isArray(row.assignedTo)" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.assignedTo.firstName || row.assignedTo.name || row.assignedTo.first_name,
              lastName: row.assignedTo.lastName || row.assignedTo.last_name,
              email: row.assignedTo.email,
              avatar: row.assignedTo.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ getUserDisplayName(row.assignedTo) }}</span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('records.editableUnassigned') }}</span>
      </template>

      <!-- Custom Account Manager Cells -->
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
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ getUserDisplayName(row.accountManager) }}</span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ typeof row.accountManager === 'string' ? getUserDisplayName(row.accountManager) : 'Unassigned' }}
        </span>
      </template>

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
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ getUserDisplayName(row.account_manager) }}</span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ typeof row.account_manager === 'string' ? getUserDisplayName(row.account_manager) : 'Unassigned' }}
        </span>
      </template>
    </ModuleList>

    <OrganizationQuickCreateDrawer
      :isOpen="showEditDrawer"
      :organization-id="editingOrganizationId"
      @close="closeEditDrawer"
      @saved="handleOrganizationEditSaved"
    />

    <!-- CSV Import Modal -->
    <CSVImportModal 
      v-if="showImportModal"
      entity-type="Organizations"
      @close="showImportModal = false"
      @import-complete="handleImportComplete"
    />
  </div>
</template>

<script setup>
defineOptions({ name: 'OrganizationsView' });
import { useI18n } from 'vue-i18n';

import { useNotifications } from '@/composables/useNotifications';
const { t } = useI18n();
const notifications = useNotifications();

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import { fetchModulesListCached } from '@/utils/tenantSchemaApiCache';
import { startBulkDelete } from '@/utils/runBulkDelete';
import ModuleList from '@/components/module-list/ModuleList.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import CSVImportModal from '@/components/import/CSVImportModal.vue';
import Avatar from '@/components/common/Avatar.vue';
import OrganizationQuickCreateDrawer from '@/components/organizations/OrganizationQuickCreateDrawer.vue';
import OrganizationListParticipationTypeCell from '@/components/organizations/OrganizationListParticipationTypeCell.vue';
import {
  getPrimaryOrganizationStatusFieldKey,
  resolveOrganizationKeyFieldStatus,
} from '@/platform/fields/organizationFieldModel';
import { getDefaultOrganizationStatusFieldOptions } from '@/utils/organizationStatusDefaults';
import { backfillPicklistOptionColors } from '@/utils/picklistColorPalette';

const router = useRouter();
const authStore = useAuthStore();
const { openTab } = useTabs();

// State
const moduleListRef = ref(null);
const showImportModal = ref(false);
const showEditDrawer = ref(false);
const editingOrganizationId = ref(null);
const deleting = ref(false);
const organizationModuleFields = ref([]);

function findOrganizationModuleField(fieldKey) {
  const target = String(fieldKey || '').toLowerCase();
  return organizationModuleFields.value.find(
    (field) => String(field?.key || '').toLowerCase() === target
  );
}

function organizationFieldPicklistOptions(fieldKey, fallbackValues = []) {
  const field = findOrganizationModuleField(fieldKey);
  if (Array.isArray(field?.options) && field.options.length > 0) {
    return backfillPicklistOptionColors(field.options, fieldKey, 'organizations');
  }
  if (fallbackValues.length > 0) {
    return backfillPicklistOptionColors(fallbackValues, fieldKey, 'organizations');
  }
  return [];
}

const organizationTypesPicklistOptions = computed(() =>
  organizationFieldPicklistOptions('types', ['Customer', 'Partner', 'Vendor'])
);

const resolveOrganizationListStatusOptions = (row) => {
  const fieldKey = getPrimaryOrganizationStatusFieldKey(row?.types);
  if (!fieldKey) return [];
  const fromModule = organizationFieldPicklistOptions(
    fieldKey,
    getDefaultOrganizationStatusFieldOptions(fieldKey).map((row) => row.value)
  );
  if (fromModule.length > 0) return fromModule;
  return getDefaultOrganizationStatusFieldOptions(fieldKey);
};

const loadOrganizationModuleFields = async () => {
  if (!authStore.isAuthenticated) return;
  try {
    const response = await fetchModulesListCached({ key: 'organizations' });
    const modules = Array.isArray(response?.data) ? response.data : [];
    const orgModule = modules.find((mod) => String(mod?.key || '').toLowerCase() === 'organizations')
      || modules[0];
    organizationModuleFields.value = Array.isArray(orgModule?.fields) ? orgModule.fields : [];
  } catch (error) {
    if (error?.status === 401 || error?.message?.includes('Session expired')) return;
    console.error('Error loading organization module fields for list colors:', error);
  }
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
    map[id] = { ...map[id], ...user, _id: id };
  }

  usersById.value = map;
};

const loadUsers = async () => {
  // Don't fetch if user is not authenticated
  if (!authStore.isAuthenticated) {
    return;
  }
  
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
    // Silently ignore 401 errors (user logged out)
    if (error.status === 401 || error.message?.includes('Session expired')) {
      return;
    }
    console.error('Error loading users for organizations list:', error);
  } finally {
    usersLoaded.value = true;
  }
};

// Event handlers
const handleRowClick = (row, event = null) => {
  // Navigate to OrganizationSurface only (no edit/delete from list)
  viewOrganization(row, event);
};

const viewOrganization = (organization, event = null) => {
  const orgId = organization?._id;
  if (!orgId) return;

  const title = organization?.name?.trim() || 'Organization Detail';
  
  const openInBackground = event && (
    event.button === 1 ||
    event.metaKey ||
    event.ctrlKey
  );
  
  openTab(`/organizations/${orgId}`, {
    title,
    icon: 'building',
    params: { name: title },
    background: openInBackground,
    insertAdjacent: true
  });
};

const openCreateModal = () => {
  // ARCHITECTURAL INTENT: All entry points open drawer in Quick Create mode
  // Open drawer in same tab, not navigating to new route
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('arivu:open-organization-quick-create'));
  }
};

const editOrganizationFromList = (row) => {
  const id = row?._id || row?.id;
  if (!id) return;
  editingOrganizationId.value = id;
  showEditDrawer.value = true;
};

const closeEditDrawer = () => {
  showEditDrawer.value = false;
  editingOrganizationId.value = null;
};

const handleOrganizationEditSaved = () => {
  closeEditDrawer();
  if (moduleListRef.value?.refresh) {
    moduleListRef.value.refresh();
  }
};

const handleImportComplete = () => {
  showImportModal.value = false;
  if (moduleListRef.value?.refreshAfterImport) {
    void moduleListRef.value.refreshAfterImport();
  } else {
    moduleListRef.value?.refresh?.();
  }
};

// Handle record creation events to refresh list view
const handleRecordCreated = (event) => {
  const { moduleKey, record } = event.detail || {};
  
  // Only refresh if it's an organizations record
  if (moduleKey === 'organizations') {
    if (moduleListRef.value && moduleListRef.value.refresh) {
      moduleListRef.value.refresh();
    }
  }
};

// Bulk action handler
const handleBulkAction = async (actionId, selectedRows) => {
  if (actionId === 'export' || actionId === 'bulk-export') {
    await bulkExportOrganizations(selectedRows);
  }
};

const handleInlineDelete = async (row) => {
  if (!row) return;
  await bulkDeleteOrganizations([row]);
};

// Bulk delete
const bulkDeleteOrganizations = async (selectedRows) => {
  if (!selectedRows || selectedRows.length === 0) {
    notifications.warning(t('common.listBulkDeleteNoSelection'));
    return;
  }

  const idsToDelete = selectedRows.map((row) => row?._id || row?.id || row).filter(Boolean);
  if (idsToDelete.length === 0) {
    notifications.warning(t('common.listBulkDeleteNoSelection'));
    return;
  }

  startBulkDelete({
    moduleKey: 'organizations',
    ids: idsToDelete,
    options: { appKey: 'PLATFORM', routePath: '/organizations' },
    onComplete: (outcome) => {
      void (async () => {
        if (outcome.cancelled) {
          if (outcome.deletedCount > 0 && moduleListRef.value?.refresh) {
            moduleListRef.value.refresh();
          }
          return;
        }
        const { deletedCount, failedCount, firstError } = outcome;
        if (failedCount > 0) {
          const errorMessage =
            firstError?.response?.data?.message ||
            firstError?.message ||
            'Failed to delete some organizations';
          if (firstError?.response?.status === 403) {
            notifications.error(`Permission denied: ${errorMessage}`);
          } else {
            notifications.error(`Failed to delete ${failedCount} of ${idsToDelete.length} organizations. ${errorMessage}`);
          }
          if (deletedCount > 0 && moduleListRef.value?.refresh) {
            moduleListRef.value.refresh();
          }
          return;
        }
        if (moduleListRef.value?.refresh) {
          moduleListRef.value.refresh();
        }
      })();
    },
    onError: (error) => {
      console.error('Error bulk deleting organizations:', error);
      notifications.error(`Error deleting organizations: ${error.message || t('common.organizationsToastUnknownError')}`);
    },
  });
};

// Bulk export - identity fields only
const bulkExportOrganizations = async (selectedRows) => {
  if (!selectedRows || selectedRows.length === 0) return;
  
  try {
    // Extract identity fields only (core + system fields)
    const identityFields = [
      'name', 'industry', 'website', 'phone', 'address',
      'assignedTo', 'accountManager', 'tags', 'createdAt', 'updatedAt'
    ];
    
    const csvRows = [];
    
    // Header row
    const headers = ['Name', 'Industry', 'Website', 'Phone', 'Address', 'Assigned To', 'Account Manager', 'Tags', 'Created At', 'Updated At'];
    csvRows.push(headers.join(','));
    
    // Data rows
    selectedRows.forEach(row => {
      const assignedToName = row.assignedTo && typeof row.assignedTo === 'object' 
        ? getUserDisplayName(row.assignedTo)
        : (row.assignedTo || '');
      
      const accountManagerName = row.accountManager && typeof row.accountManager === 'object'
        ? getUserDisplayName(row.accountManager)
        : (row.account_manager && typeof row.account_manager === 'object'
          ? getUserDisplayName(row.account_manager)
          : (row.accountManager || row.account_manager || ''));
      
      const tags = Array.isArray(row.tags) ? row.tags.join('; ') : '';
      const createdAt = row.createdAt ? new Date(row.createdAt).toISOString() : '';
      const updatedAt = row.updatedAt ? new Date(row.updatedAt).toISOString() : '';
      
      const rowData = [
        escapeCsv(row.name || ''),
        escapeCsv(row.industry || ''),
        escapeCsv(row.website || ''),
        escapeCsv(row.phone || ''),
        escapeCsv(row.address || ''),
        escapeCsv(assignedToName),
        escapeCsv(accountManagerName),
        escapeCsv(tags),
        createdAt,
        updatedAt
      ];
      
      csvRows.push(rowData.join(','));
    });
    
    // Create and download CSV
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `organizations_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error bulk exporting organizations:', error);
    notifications.error(t('common.organizationsToastErrorExportingOrganizationsPleaseTry'));
  }
};

// Helper to escape CSV values
const escapeCsv = (value) => {
  if (value == null || value === '') return '';
  const stringValue = String(value);
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const exportOrganizations = async () => {
  try {
    const response = await fetch('/api/csv/export/organizations', {
      headers: {
        'Authorization': `Bearer ${authStore.user?.token}`
      }
    });
    
    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `organizations_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting organizations:', error);
    notifications.error(t('common.organizationsToastErrorExportingOrganizationsPleaseTry2'));
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

// Lifecycle
onMounted(async () => {
  await Promise.all([loadUsers(), loadOrganizationModuleFields()]);
  
  // Listen for record creation events
  if (typeof window !== 'undefined') {
    window.addEventListener('arivu:record-created', handleRecordCreated);
  }
});

onUnmounted(() => {
  // Clean up event listeners
  if (typeof window !== 'undefined') {
    window.removeEventListener('arivu:record-created', handleRecordCreated);
  }
});

</script>


