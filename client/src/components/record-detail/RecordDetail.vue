<template>
  <div v-if="loadingDefinition" class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      <p class="text-gray-600 dark:text-gray-400 mt-4">{{ t('records.recordDetailLoading') }}</p>
    </div>
  </div>

  <div v-else-if="!detailDefinition" class="flex items-center justify-center min-h-screen p-4">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ t('records.recordDetailRecordNotFound') }}</h2>
      <p class="text-gray-600 dark:text-gray-400 mb-6">{{ t('records.recordDetailThisRecordTypeIsNotConfigured') }}</p>
    </div>
  </div>

  <SummaryView
    v-else
    :record="formattedRecord"
    :record-type="moduleKey"
    :loading="dataLoading"
    :error="error"
    @close="handleClose"
    @update="handleUpdate"
    @edit="handleEdit"
    @delete="handleDelete"
    @add-relation="handleAddRelation"
    @open-related-record="handleOpenRelatedRecord"
    @record-updated="handleRecordUpdated"
    @record-field="applyRecordField"
    ref="summaryViewRef"
  />

  <!-- Delete Confirmation Modal -->
  <DeleteConfirmationModal
    v-if="detailDefinition"
    :show="showDeleteModal"
    :record-name="recordName"
    :record-type="moduleKey"
    :deleting="deleting"
    @close="showDeleteModal = false"
    @confirm="confirmDelete"
  />
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import SummaryView from '@/components/common/SummaryView.vue';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';
import { buildRecordDetailFromRegistry } from '@/utils/buildRecordDetailFromRegistry';
import { getAppRegistry } from '@/utils/getAppRegistry';
import { createPermissionSnapshot } from '@/types/permission-snapshot.types';

import { useNotifications } from '@/composables/useNotifications';
const props = defineProps({
  moduleKey: {
    type: String,
    required: true
  },
  appKey: {
    type: String,
    default: 'SALES' // Default to SALES for now
  }
});

const { t } = useI18n();
const notifications = useNotifications();


const emit = defineEmits(['record-updated', 'record-deleted']);

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { findTabByPath, switchToTab, openTab, updateTabTitle, activeTabId, findTabById, closeTab } = useTabs();

const loadingDefinition = ref(true);
const dataLoading = ref(false);
const detailDefinition = ref(null);
const record = ref(null);
const error = ref(null);
const summaryViewRef = ref(null);
const showDeleteModal = ref(false);
const deleting = ref(false);

// Build detail definition from registry
const buildDetailDefinition = async () => {
  if (!authStore.user || !authStore.isAuthenticated) {
    detailDefinition.value = null;
    loadingDefinition.value = false;
    return;
  }

  loadingDefinition.value = true;
  try {
    const registry = await getAppRegistry();

    if (!authStore.user || !authStore.isAuthenticated) {
      return;
    }

    const snapshot = createPermissionSnapshot(authStore.user);

    const definition = buildRecordDetailFromRegistry(
      props.moduleKey,
      props.appKey,
      registry,
      snapshot
    );

    console.log('[RecordDetail] Building detail for module:', props.moduleKey);
    console.log('[RecordDetail] Detail definition:', definition);
    console.log('[RecordDetail] Tabs:', definition?.tabs);
    console.log('[RecordDetail] Actions:', definition?.actions);
    console.log('[RecordDetail] Related Records:', definition?.relatedRecords);
    console.log('[RecordDetail] Empty State:', definition?.emptyState);

    if (authStore.user && authStore.isAuthenticated) {
      detailDefinition.value = definition;

      // Fetch record data after definition is built
      await fetchRecord();
    }
  } catch (error) {
    console.error('[RecordDetail] Error building detail definition:', error);
    if (authStore.isAuthenticated) {
      detailDefinition.value = null;
    }
  } finally {
    if (authStore.isAuthenticated) {
      loadingDefinition.value = false;
    }
  }
};

// Format record data for SummaryView
const formattedRecord = computed(() => {
  if (!record.value || !detailDefinition.value) return null;

  const header = detailDefinition.value.header;
  const titleField = header.titleField;
  const subtitleField = header.subtitleField;

  // Build name from title field
  let name = '';
  if (titleField === 'name') {
    // For people, combine first_name and last_name
    if (props.moduleKey === 'people') {
      name = `${record.value.first_name || ''} ${record.value.last_name || ''}`.trim() || record.value.email || 'Person';
    } else {
      name = record.value[titleField] || record.value.name || 'Record';
    }
  } else {
    name = record.value[titleField] || record.value.name || 'Record';
  }

  // Build subtitle from subtitle field
  let subtitle = '';
  if (subtitleField && record.value[subtitleField]) {
    subtitle = record.value[subtitleField];
  }

  return {
    ...record.value,
    name,
    subtitle,
  };
});

// Get record name for delete modal
const recordName = computed(() => {
  if (!record.value || !detailDefinition.value) return '';
  const header = detailDefinition.value.header;
  const titleField = header.titleField;
  
  if (titleField === 'name') {
    if (props.moduleKey === 'people') {
      return `${record.value.first_name || ''} ${record.value.last_name || ''}`.trim() || record.value.email || '';
    }
    return record.value[titleField] || record.value.name || '';
  }
  return record.value[titleField] || record.value.name || '';
});

// Fetch record data from API
const fetchRecord = async () => {
  if (!detailDefinition.value) return;
  
  // Guard against undefined ID
  if (!route.params.id) {
    console.warn(`[RecordDetail] Cannot fetch record: route.params.id is undefined for module ${props.moduleKey}`);
    error.value = 'Record ID is missing';
    dataLoading.value = false;
    return;
  }
  
  // Guard against "new" ID (create route)
  if (route.params.id === 'new') {
    console.log(`[RecordDetail] Skipping fetch for create route: /${props.moduleKey}/new`);
    dataLoading.value = false;
    error.value = null;
    // Don't set record.value - this is a create form, not a detail view
    return;
  }

  dataLoading.value = true;
  error.value = null;
  try {
    const endpoint = `/${props.moduleKey}/${route.params.id}`;
    
    const data = await apiClient(endpoint, {
      method: 'GET'
    });
    
    if (data.success) {
      record.value = data.data;
    } else {
      error.value = data.message || 'Failed to load record';
    }
  } catch (err) {
    console.error('[RecordDetail] Error fetching record:', err);
    error.value = err.message || 'Failed to load record';
  } finally {
    dataLoading.value = false;
  }
};

// Event handlers
const handleClose = () => {
  router.push(`/${props.moduleKey}`);
};

function applyRecordField({ field, value }) {
  if (record.value && field != null) record.value[field] = value;
}

const handleUpdate = async (updateData) => {
  try {
    const endpoint = `/${props.moduleKey}/${route.params.id}`;
    
    // Update local state immediately for UI responsiveness
    if (record.value) {
      record.value[updateData.field] = updateData.value;
    }
    
    // Persist to server
    const response = await apiClient.put(endpoint, {
      [updateData.field]: updateData.value
    });
    
    // Update local state with the response
    if (response.success && response.data && record.value) {
      Object.assign(record.value, response.data);
    }
    
    // Call onSuccess callback if provided
    if (updateData.onSuccess) {
      await updateData.onSuccess(response.success ? response.data : null);
    }

    emit('record-updated', response.data);
  } catch (err) {
    console.error('[RecordDetail] Error updating record:', err);
    // Revert on error
    fetchRecord();
  }
};

const handleEdit = () => {
  if (!detailDefinition.value) return;
  const editRoute = detailDefinition.value.editRoute?.replace(':id', route.params.id);
  if (editRoute) {
    openTab(editRoute, { title: `Edit ${recordName.value}`, background: false, insertAdjacent: true });
  }
};

const handleDelete = () => {
  showDeleteModal.value = true;
};

const confirmDelete = async () => {
  deleting.value = true;
  
  try {
    const endpoint = `/${props.moduleKey}/${route.params.id}`;
    
    await apiClient.delete(endpoint);
    
    // Close the modal
    showDeleteModal.value = false;
    
    // Get current tab (the record detail tab)
    const currentTabId = activeTabId.value;
    const currentTab = currentTabId ? findTabById(currentTabId) : null;
    
    // Check if module tab already exists
    const modulePath = `/${props.moduleKey}`;
    const moduleTab = findTabByPath(modulePath);
    
    if (moduleTab) {
      // Module tab exists: switch to it and close the record detail tab
      switchToTab(moduleTab.id);
      // Close the record detail tab
      if (currentTab && currentTab.path !== modulePath) {
        closeTab(currentTab.id);
      }
      // Force refresh the module tab
      await router.push(`${modulePath}?refresh=${Date.now()}`).then(() => {
        router.replace(modulePath);
      });
    } else {
      // Module tab doesn't exist: update current tab to module page
      if (currentTab) {
        currentTab.path = modulePath;
        currentTab.title = detailDefinition.value.title;
        router.push(modulePath);
      } else {
        // No current tab (shouldn't happen, but fallback)
        openTab(modulePath, {
          title: detailDefinition.value.title,
        });
      }
    }

    emit('record-deleted');
  } catch (err) {
    console.error('[RecordDetail] Error deleting record:', err);
    notifications.error(err.message || t('records.recordDetailToastFailedToDeleteRecordPlease'));
  } finally {
    deleting.value = false;
  }
};

const handleAddRelation = (relationData) => {
  console.log('[RecordDetail] Add relation:', relationData);
  // TODO: Implement relation adding
};

const handleOpenRelatedRecord = (relatedRecord) => {
  console.log('[RecordDetail] Open related record:', relatedRecord);
  // TODO: Implement related record opening
};

const handleRecordUpdated = (updatedRecord) => {
  // Update local state with the updated record
  if (updatedRecord && record.value) {
    record.value = { ...record.value, ...updatedRecord };
  } else if (updatedRecord) {
    record.value = updatedRecord;
  }
  emit('record-updated', updatedRecord);
};

// Watchers
watch(() => authStore.user, () => {
  if (authStore.user && authStore.isAuthenticated) {
    buildDetailDefinition();
  }
}, { immediate: true });

watch(() => props.moduleKey, () => {
  if (authStore.user && authStore.isAuthenticated) {
    buildDetailDefinition();
  }
});

watch(() => props.appKey, () => {
  if (authStore.user && authStore.isAuthenticated) {
    buildDetailDefinition();
  }
});

watch(() => route.params.id, (newId) => {
  // Only fetch if we have a valid ID and it's not "new" (create route)
  if (newId && newId !== 'new' && authStore.user && authStore.isAuthenticated && detailDefinition.value) {
    fetchRecord();
  }
});

// Initial load
onMounted(() => {
  if (authStore.user && authStore.isAuthenticated) {
    buildDetailDefinition();
  }
});
</script>

