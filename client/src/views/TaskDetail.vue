<template>
  <SummaryView
    :record="task"
    :record-type="'tasks'"
    :loading="loading"
    :error="error"
    :stats="taskStats"
    @close="goBack"
    @update="handleUpdate"
    @edit="editTask"
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
    :record-name="task?.title || ''"
    record-type="tasks"
    :deleting="deleting"
    @close="showDeleteModal = false"
    @confirm="deleteTask"
  />
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, onMounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useTabs } from '@/composables/useTabs';
import SummaryView from '@/components/common/SummaryView.vue';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';

const router = useRouter();
const route = useRoute();
const { findTabByPath, switchToTab, openTab, updateTabTitle, activeTabId, findTabById, closeTab } = useTabs();

const task = ref(null);
const taskStats = ref({
  linked_deals: 0,
  linked_contacts: 0
});
const loading = ref(false);
const error = ref(null);
const summaryViewRef = ref(null);
const showDeleteModal = ref(false);
const deleting = ref(false);

const fetchTask = async () => {
  loading.value = true;
  error.value = null;
  try {
    const data = await apiClient(`/tasks/${route.params.id}`, {
      method: 'GET'
    });
    
    if (data.success) {
      // SummaryView expects 'name' property for display
      // Tasks use 'title' as their primary field, so we normalize it
      task.value = {
        ...data.data,
        name: data.data.title // Map title to name for SummaryView compatibility
      };
      taskStats.value = {
        linked_deals: data.data.linkedDeals?.length || 0,
        linked_contacts: data.data.linkedContacts?.length || 0
      };
      
      // Update tab title
      updateTabTitle(activeTabId.value, data.data.title || 'Task');
    }
  } catch (err) {
    console.error('Error fetching task:', err);
    error.value = err.message || 'Failed to load task';
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push('/tasks');
};

function applyRecordField({ field, value }) {
  if (task.value && field != null) task.value[field] = value;
}

const handleUpdate = async (updateData) => {
  try {
    // Update local state immediately for UI responsiveness
    if (task.value) {
      task.value[updateData.field] = updateData.value;
    }
    
    // Persist to server
    const response = await apiClient.put(`/tasks/${route.params.id}`, {
      [updateData.field]: updateData.value
    });
    
    // Update local state with the response (which has populated fields)
    if (response.success && response.data && task.value) {
      Object.assign(task.value, response.data);
      // Keep name in sync with title for SummaryView
      task.value.name = response.data.title;
    }
    
    // Call onSuccess callback if provided (for activity logging)
    if (updateData.onSuccess) {
      await updateData.onSuccess(response.success ? response.data : null);
    }
    
    // Update tab title if title changed
    if (updateData.field === 'title' && task.value?.title) {
      updateTabTitle(activeTabId.value, task.value.title);
      task.value.name = task.value.title; // Keep name in sync
    }
  } catch (err) {
    console.error('Error updating task:', err);
    error.value = err.message || 'Failed to update task';
    throw err;
  }
};

const editTask = () => {
  // SummaryView will handle opening the edit drawer
  if (summaryViewRef.value) {
    summaryViewRef.value.edit();
  }
};

const deleteTask = async () => {
  deleting.value = true;
  try {
    await apiClient.delete(`/tasks/${route.params.id}`);
    showDeleteModal.value = false;
    
    // Close the tab
    const tab = findTabById(activeTabId.value);
    if (tab) {
      closeTab(tab.id);
    }
    
    // Navigate back to tasks list
    router.push('/tasks');
  } catch (err) {
    console.error('Error deleting task:', err);
    error.value = err.message || 'Failed to delete task';
  } finally {
    deleting.value = false;
  }
};

const handleAddRelation = async (relationType, relatedId) => {
  try {
    if (relationType === 'deals') {
      await apiClient.post(`/tasks/${route.params.id}/link-deal`, {
        dealId: relatedId
      });
    } else if (relationType === 'people') {
      await apiClient.post(`/tasks/${route.params.id}/link-contact`, {
        contactId: relatedId
      });
    }
    // Refresh task data
    await fetchTask();
  } catch (err) {
    console.error('Error adding relation:', err);
    error.value = err.message || 'Failed to add relation';
  }
};

const handleOpenRelatedRecord = (record) => {
  if (record.type === 'deals') {
    openTab(`/deals/${record.id}`, {
      title: record.name || 'Deal',
      background: false,
      insertAdjacent: true
    });
  } else if (record.type === 'people') {
    openTab(`/people/${record.id}`, {
      title: record.name || 'Person',
      background: false,
      insertAdjacent: true
    });
  } else if (record.type === 'organizations') {
    openTab(`/organizations/${record.id}`, {
      title: record.name || 'Organization',
      background: false,
      insertAdjacent: true
    });
  }
};

const handleRecordUpdated = async () => {
  // Refresh task data when record is updated from SummaryView
  await fetchTask();
};

onMounted(() => {
  fetchTask();
});
</script>
