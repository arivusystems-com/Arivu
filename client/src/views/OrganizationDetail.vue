<template>
  <SummaryView
    :record="organization"
    :record-type="'organizations'"
    :loading="loading"
    :error="error"
    :stats="organizationStats"
    @close="goBack"
    @update="handleUpdate"
    @edit="editOrganization"
    @delete="showDeleteModal = true"
    @add-relation="handleAddRelation"
    @open-related-record="handleOpenRelatedRecord"
    @record-updated="handleRecordUpdated"
    @record-field="applyRecordField"
    ref="summaryViewRef"
  />

  <!-- Delete Confirmation Modal -->
  <DeleteConfirmationModal
    :show="showDeleteModal"
    :record-name="organization?.name || ''"
    record-type="organizations"
    :deleting="deleting"
    @close="showDeleteModal = false"
    @confirm="deleteOrganization"
  />
</template>

<script setup>
import { useI18n } from 'vue-i18n';

import { useNotifications } from '@/composables/useNotifications';
const { t } = useI18n();
const notifications = useNotifications();

import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useTabs } from '@/composables/useTabs';
import { BuildingOfficeIcon } from '@heroicons/vue/24/outline';
import SummaryView from '@/components/common/SummaryView.vue';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';

const router = useRouter();
const route = useRoute();
const { findTabByPath, switchToTab, openTab, updateTabTitle, activeTabId, findTabById, closeTab } = useTabs();

const organization = ref(null);
const organizationStats = ref({
  contacts: 0,
  users: 0,
  deals: 0
});
const loading = ref(false);
const error = ref(null);
const summaryViewRef = ref(null);
const showDeleteModal = ref(false);
const deleting = ref(false);

const fetchOrganization = async () => {
  loading.value = true;
  error.value = null;
  try {
    // Note: apiClient already prepends /api, so we use /v2/organization
    const data = await apiClient(`/v2/organization/${route.params.id}`, {
      method: 'GET'
    });
    
    if (data.success) {
      organization.value = data.data;
      organizationStats.value = data.stats || organizationStats.value;
    }
  } catch (err) {
    console.error('Error fetching organization:', err);
    error.value = err.message || 'Failed to load organization';
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push('/organizations');
};

function applyRecordField({ field, value }) {
  if (organization.value && field != null) organization.value[field] = value;
}

const handleUpdate = async (updateData) => {
  try {
    // Update local state immediately for UI responsiveness
    if (organization.value) {
      organization.value[updateData.field] = updateData.value;
    }
    
    // Persist to server
    // Note: apiClient already prepends /api, so we use /v2/organization
    const response = await apiClient.put(`/v2/organization/${route.params.id}`, {
      [updateData.field]: updateData.value
    });
    
    // Update local state with the response (which has populated fields)
    if (response.success && response.data && organization.value) {
      // Update the organization record with the populated data from the server
      Object.assign(organization.value, response.data);
    }
    
    // Call onSuccess callback if provided (for activity logging)
    // Pass the updated record so it can use populated fields for formatting
    if (updateData.onSuccess) {
      await updateData.onSuccess(response.success ? response.data : null);
    }
  } catch (err) {
    console.error('Error updating organization:', err);
    // Revert on error
    fetchOrganization();
  }
};

const editOrganization = () => {
  console.log('Edit organization:', organization.value);
};

const deleteOrganization = async () => {
  deleting.value = true;
  
  try {
    // Note: apiClient already prepends /api, so we use /v2/organization
    await apiClient.delete(`/v2/organization/${route.params.id}`);
    
    // Close the modal
    showDeleteModal.value = false;
    
    // Get current tab (the record detail tab)
    const currentTabId = activeTabId.value;
    const currentTab = currentTabId ? findTabById(currentTabId) : null;
    
    // Check if Organizations module tab already exists
    const modulePath = '/organizations';
    const moduleTab = findTabByPath(modulePath);
    
    if (moduleTab) {
      // Module tab exists: switch to it and close the record detail tab
      switchToTab(moduleTab.id);
      // Update tab title to module name in case it was changed
      if (moduleTab.title !== 'Organizations') {
        updateTabTitle(moduleTab.id, 'Organizations');
      }
      // Close the record detail tab
      if (currentTab && currentTab.path !== modulePath) {
        closeTab(currentTab.id);
      }
      // Force refresh the module tab by navigating with a refresh query parameter
      // This ensures the list is updated to reflect the deletion
      await nextTick();
      const refreshPath = `${modulePath}?refresh=${Date.now()}`;
      router.push(refreshPath).then(() => {
        // Remove the refresh parameter after navigation
        nextTick(() => {
          router.replace(modulePath);
        });
      });
    } else {
      // Module tab doesn't exist: update current tab to module page
      if (currentTab) {
        currentTab.path = modulePath;
        currentTab.title = 'Organizations';
        currentTab.icon = BuildingOfficeIcon; // Update icon to module icon
        currentTab.params = {}; // Clear record params
        // Navigate to module page
        router.push(modulePath);
      } else {
        // No current tab (shouldn't happen, but fallback)
        openTab(modulePath, {
          title: 'Organizations',
          icon: 'building'
        });
      }
    }
  } catch (err) {
    console.error('Error deleting organization:', err);
    notifications.error(err.message || t('common.organizationDetailToastFailedToDeleteOrganizationPlease'));
  } finally {
    deleting.value = false;
  }
};

const handleAddRelation = (relationData) => {
  console.log('Add relation:', relationData);
};

const handleOpenRelatedRecord = (relatedRecord) => {
  console.log('Open related record:', relatedRecord);
  
  // SummaryView will handle tab creation internally
  // We don't need to call addDynamicTab here since handleOpenRelatedRecord
  // in SummaryView already does it
  // Just log for debugging
};

const handleRecordUpdated = (updatedRecord) => {
  // Update local state with the updated record
  if (updatedRecord && organization.value) {
    // Merge the updated record data into the existing organization object
    organization.value = { ...organization.value, ...updatedRecord };
  } else if (updatedRecord) {
    // If organization is null, set it to the updated record
    organization.value = updatedRecord;
  }
};

// Listen for refresh events from command palette or other sources
const handleRefreshOrganization = (event) => {
  const { organizationId } = event.detail || {};
  // Only refresh if this is the current organization
  if (organizationId && organizationId === route.params.id) {
    fetchOrganization();
  }
};

onMounted(() => {
  fetchOrganization();
  
  // Listen for refresh events
  if (typeof window !== 'undefined') {
    window.addEventListener('arivu:refresh-organization', handleRefreshOrganization);
  }
});

onUnmounted(() => {
  // Clean up event listener
  if (typeof window !== 'undefined') {
    window.removeEventListener('arivu:refresh-organization', handleRefreshOrganization);
  }
});
</script>