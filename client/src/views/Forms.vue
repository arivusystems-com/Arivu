<template>
  <div class="mx-auto w-full">
    <ListView
      :title="t('forms.hubTitle')"
      module-key="forms"
      :create-label="t('forms.hubCreateLabel')"
      :search-placeholder="t('forms.hubSearchPlaceholder')"
      :data="forms"
      :columns="columns"
      :loading="loading"
      :statistics="statistics"
      :stats-config="statsConfig"
      :pagination="{ currentPage: pagination.currentPage, totalPages: pagination.totalPages, totalRecords: pagination.totalForms, limit: pagination.formsPerPage }"
      :sort-field="sortField"
      :sort-order="sortOrder"
      table-id="forms-table"
      row-key="_id"
      :empty-title="t('forms.hubEmptyTitle')"
      :empty-message="t('forms.hubEmptyMessage')"
      :show-import="false"
      @create="openCreateForm"
      @export="exportForms"
      @update:searchQuery="handleSearchQueryUpdate"
      @update:filters="(newFilters) => { Object.assign(filters, newFilters); fetchForms(); }"
      @update:sort="({ sortField: key, sortOrder: order }) => { handleSort({ key, order }); }"
      @update:pagination="(p) => { pagination.currentPage = p.currentPage; pagination.formsPerPage = p.limit || pagination.formsPerPage; fetchForms(); }"
      @fetch="fetchForms"
      @row-click="viewFormDetail"
      @edit="openFormBuilder"
      @delete="handleDelete"
      @bulk-action="handleBulkAction"
      :row-can-delete="canHardDeleteForm"
    >
      <!-- Custom Form ID Cell -->
      <template #cell-formId="{ value }">
        <span class="font-mono text-sm text-gray-600 dark:text-gray-400">{{ value }}</span>
      </template>

      <!-- Custom Form Type Cell with Badge -->
      <template #cell-formType="{ value }">
        <BadgeCell
          :value="formTypeLabel(value)"
          :variant="formTypeVariant(value)"
        />
      </template>

      <!-- Custom Status Cell with Badge -->
      <template #cell-status="{ value }">
        <BadgeCell
          :value="formStatusLabel(value)"
          :variant="formStatusVariant(value)"
        />
      </template>

      <!-- Custom Visibility Cell -->
      <template #cell-visibility="{ value }">
        <BadgeCell
          :value="formVisibilityLabel(value)"
          :variant="formVisibilityVariant(value)"
        />
      </template>

      <!-- Custom Assigned To Cell -->
      <template #cell-assignedTo="{ row }">
        <div v-if="row.assignedTo" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.assignedTo.firstName,
              lastName: row.assignedTo.lastName,
              avatar: row.assignedTo.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-900 dark:text-white">
            {{ row.assignedTo.firstName }} {{ row.assignedTo.lastName }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('records.editableUnassigned') }}</span>
      </template>

      <!-- Custom Organization ID Cell -->
      <template #cell-organizationId="{ row }">
        <span v-if="row.organizationId && typeof row.organizationId === 'object' && row.organizationId.name" class="text-sm text-gray-900 dark:text-white">
          {{ row.organizationId.name }}
        </span>
        <span v-else-if="row.organizationId && typeof row.organizationId === 'string'" class="text-sm text-gray-500 dark:text-gray-400 font-mono">
          {{ row.organizationId }}
        </span>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>


      <!-- Custom Actions -->
      <template #row-actions="{ row }">
        <div class="flex items-center gap-2">
          <button
            @click.stop="viewFormDetail(row)"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            :title="t('forms.hubActionViewForm')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            @click.stop="openFormBuilder(row)"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            :title="t('actions.edit')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            @click.stop="duplicateForm(row)"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            :title="t('actions.duplicate')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            @click.stop="viewResponses(row)"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            :title="t('forms.hubActionViewResponses')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        </div>
      </template>
    </ListView>

    <!-- Type Picker Modal -->
    <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showTypePicker"
        class="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
        @click.self="showTypePicker = false"
      >
        <div class="bg-white dark:bg-gray-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.hubPickerHeading') }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('forms.hubPickerSubheading') }}</p>
            </div>
            <button
              @click="showTypePicker = false"
              class="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>

          <div class="flex flex-col gap-3 p-6">
            <button
              v-for="type in typeOptions"
              :key="type.value"
              @click="startFormWithType(type.value)"
              class="group relative text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition p-4 flex items-start gap-3"
            >
              <span v-if="defaultType && type.value === defaultType.modelValue" class="absolute top-2 right-2 text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded">
                {{ t('forms.hubPickerDefault') }}
              </span>
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
                :class="type.badge"
              >
                <component :is="type.icon" class="w-5 h-5" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ type.label }}</p>
                <p class="text-xs text-gray-600 dark:text-gray-300 leading-5 mt-1">
                  {{ type.description }}
                </p>
                <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  {{ type.subtitle }}
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import ListView from '@/components/common/ListView.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import Avatar from '@/components/common/Avatar.vue';
import { XMarkIcon, ClipboardDocumentCheckIcon, ChatBubbleLeftRightIcon, HandThumbUpIcon } from '@heroicons/vue/24/outline';
import { useProjectionCreate } from '@/composables/useProjectionCreate';
import { canHardDeleteForm } from '@/utils/formEditPermissions';

import { useNotifications } from '@/composables/useNotifications';
const FORM_DELETE_BLOCKED_CODE = 'FORM_HAS_SUBMITTED_RESPONSES';

const { t } = useI18n();
const notifications = useNotifications();

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { openTab, findTabByPath, switchToTab, closeTab, tabs } = useTabs();

const FORM_TYPE_VARIANTS = {
  Audit: 'warning',
  Survey: 'info',
  Feedback: 'success',
  Inspection: 'danger',
  Custom: 'default',
};

const FORM_STATUS_VARIANTS = {
  Draft: 'default',
  Active: 'success',
  Closed: 'danger',
};

const FORM_VISIBILITY_VARIANTS = {
  Internal: 'default',
  Partner: 'info',
  Public: 'success',
};

function formTypeLabel(value) {
  const keyByValue = {
    Audit: 'forms.typeAudit',
    Survey: 'forms.typeSurvey',
    Feedback: 'forms.typeFeedback',
    Inspection: 'forms.typeInspection',
    Custom: 'forms.typeCustom',
  };
  const key = keyByValue[value];
  return key ? t(key) : value;
}

function formTypeVariant(value) {
  return FORM_TYPE_VARIANTS[value] || 'default';
}

function formStatusLabel(value) {
  const keyByValue = {
    Draft: 'forms.statusDraft',
    Active: 'forms.statusActive',
    Closed: 'forms.statusClosed',
  };
  const key = keyByValue[value];
  return key ? t(key) : value;
}

function formStatusVariant(value) {
  return FORM_STATUS_VARIANTS[value] || 'default';
}

function formVisibilityLabel(value) {
  const keyByValue = {
    Internal: 'forms.visibilityInternal',
    Partner: 'forms.visibilityPartner',
    Public: 'forms.visibilityPublic',
  };
  const key = keyByValue[value];
  return key ? t(key) : value;
}

function formVisibilityVariant(value) {
  return FORM_VISIBILITY_VARIANTS[value] || 'default';
}

// State
const forms = ref([]);
const loading = ref(false);
const showTypePicker = ref(false);

const {
  allowedTypes,
  defaultType,
  isPlatformOwned,
  hideTypeSelector,
  load: loadProjection
} = useProjectionCreate('forms');

const baseTypeOptions = computed(() => [
  {
    value: 'Audit',
    projectionType: 'AUDIT',
    label: t('forms.typeAudit'),
    subtitle: t('forms.hubTypeAuditSubtitle'),
    description: t('forms.hubTypeAuditDesc'),
    badge: 'bg-amber-500',
    icon: ClipboardDocumentCheckIcon
  },
  {
    value: 'Survey',
    projectionType: 'SURVEY',
    label: t('forms.typeSurvey'),
    subtitle: t('forms.hubTypeSurveySubtitle'),
    description: t('forms.hubTypeSurveyDesc'),
    badge: 'bg-blue-500',
    icon: ChatBubbleLeftRightIcon
  },
  {
    value: 'Feedback',
    projectionType: 'FEEDBACK',
    label: t('forms.typeFeedback'),
    subtitle: t('forms.hubTypeFeedbackSubtitle'),
    description: t('forms.hubTypeFeedbackDesc'),
    badge: 'bg-emerald-500',
    icon: HandThumbUpIcon
  }
]);

const typeOptions = computed(() => {
  if (!isPlatformOwned.value || !allowedTypes.value || allowedTypes.value.length === 0) {
    return baseTypeOptions.value;
  }

  const allowedProjectionTypes = allowedTypes.value.map(type => type.projectionType.toUpperCase());
  return baseTypeOptions.value.filter(option =>
    allowedProjectionTypes.includes(option.projectionType.toUpperCase())
  );
});

const searchQuery = ref('');
const sortField = ref('createdAt');
const sortOrder = ref('desc');
const filters = ref({
  formType: '',
  status: '',
  assignedTo: ''
});

const pagination = ref({
  currentPage: 1,
  formsPerPage: 25,
  totalForms: 0,
  totalPages: 1
});

const statistics = ref({
  total: 0,
  active: 0,
  draft: 0,
  totalResponses: 0
});

const statsConfig = computed(() => [
  { name: t('forms.hubStatTotalForms'), key: 'total', formatter: 'number' },
  { name: t('forms.statusActive'), key: 'active', formatter: 'number' },
  { name: t('forms.statusDraft'), key: 'draft', formatter: 'number' },
  { name: t('forms.hubStatTotalResponses'), key: 'totalResponses', formatter: 'number' }
]);

const columns = computed(() => [
  { key: 'formId', label: t('forms.fieldFormId'), sortable: true, visible: true, showInTable: true, visibility: { list: true } },
  { key: 'name', label: t('forms.hubColName'), sortable: true, visible: true, showInTable: true, visibility: { list: true } },
  {
    key: 'formType',
    label: t('forms.hubColType'),
    dataType: 'select',
    sortable: true,
    visible: true,
    showInTable: true,
    visibility: { list: true },
    options: [
      { value: 'Audit', label: t('forms.typeAudit') },
      { value: 'Survey', label: t('forms.typeSurvey') },
      { value: 'Feedback', label: t('forms.typeFeedback') },
      { value: 'Inspection', label: t('forms.typeInspection') },
      { value: 'Custom', label: t('forms.typeCustom') }
    ]
  },
  {
    key: 'status',
    label: t('forms.fieldStatus'),
    dataType: 'status',
    sortable: true,
    visible: true,
    showInTable: true,
    visibility: { list: true },
    options: [
      { value: 'Draft', label: t('forms.statusDraft') },
      { value: 'Active', label: t('forms.statusActive') },
      { value: 'Closed', label: t('forms.statusClosed') }
    ]
  },
  { key: 'visibility', label: t('forms.hubColVisibility'), dataType: 'select', sortable: true, visible: true, showInTable: true, visibility: { list: true } },
  { key: 'assignedTo', label: t('forms.hubColAssignedTo'), dataType: 'user', sortable: true, visible: true, showInTable: true, visibility: { list: true } },
  { key: 'createdAt', label: t('forms.hubColCreated'), dataType: 'date', sortable: true, visible: true, showInTable: true, visibility: { list: true } }
]);

// Methods
const fetchForms = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.value.currentPage,
      limit: pagination.value.formsPerPage,
      sortBy: sortField.value,
      sortOrder: sortOrder.value,
      search: searchQuery.value,
      ...filters.value
    };

    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null) {
        delete params[key];
      }
    });

    const response = await apiClient('/forms', {
      method: 'GET',
      params
    });

    if (response.success) {
      forms.value = Array.isArray(response.data) ? response.data : [];

      if (response.pagination) {
        pagination.value.totalForms = response.pagination.totalForms || 0;
        pagination.value.totalPages = response.pagination.totalPages || 1;
      }

      if (response.statistics) {
        statistics.value = {
          total: response.statistics.totalForms || 0,
          active: response.statistics.activeForms || 0,
          draft: response.statistics.draftForms || 0,
          totalResponses: response.statistics.totalResponses || 0
        };
      } else {
        statistics.value = {
          total: forms.value.length,
          active: forms.value.filter(f => f.status === 'Active').length,
          draft: forms.value.filter(f => f.status === 'Draft').length,
          totalResponses: 0
        };
      }
    }
  } catch (error) {
    console.error('Error fetching forms:', error);
  } finally {
    loading.value = false;
  }
};

const handleSearchQueryUpdate = (query) => {
  searchQuery.value = query;
  pagination.value.currentPage = 1;
  fetchForms();
};

const handleSort = ({ key, order }) => {
  sortField.value = key;
  sortOrder.value = order;
  fetchForms();
};

const openCreateForm = async () => {
  await loadProjection();

  if (hideTypeSelector.value && defaultType.value) {
    startFormWithType(defaultType.value.modelValue);
    return;
  }

  showTypePicker.value = true;
};

const startFormWithType = (type) => {
  showTypePicker.value = false;
  const pathBase = '/forms/create';
  const query = { formType: type };
  const typeLabel = formTypeLabel(type);
  const pathWithQuery = `${pathBase}?formType=${encodeURIComponent(type)}`;

  const closeOtherCreateTabs = (keepId = null) => {
    tabs.value
      .filter(tab => tab.path && tab.path.startsWith(pathBase) && tab.id !== keepId)
      .forEach(tab => closeTab(tab.id));
  };

  const existingTab = findTabByPath(pathBase);

  if (existingTab) {
    closeOtherCreateTabs(existingTab.id);
    existingTab.title = t('forms.hubTabNewForm', { type: typeLabel });
    existingTab.path = pathWithQuery;
    switchToTab(existingTab.id);
  } else {
    closeOtherCreateTabs();
    openTab(pathWithQuery, {
      name: 'form-create',
      title: t('forms.hubTabNewForm', { type: typeLabel }),
      component: 'FormCreate',
      params: {}
    });
  }

  router.replace({ path: pathBase, query }).catch(() => {});
};

const openFormBuilder = (form) => {
  openTab(`/forms/builder/${form._id}`, {
    name: `form-builder-${form._id}`,
    title: form.name || t('forms.hubTabFormBuilder'),
    component: 'FormBuilder',
    params: { formId: form._id },
    insertAdjacent: true
  });
  router.push(`/forms/builder/${form._id}`);
};

const duplicateForm = (form) => {
  if (!form?._id) return;
  const path = `/forms/create?duplicateFrom=${form._id}`;
  openTab(path, {
    title: t('forms.hubTabDuplicateForm', { name: form.name || t('forms.hubUntitledForm') }),
    icon: 'clipboard-document',
    insertAdjacent: true
  });
  router.push(path);
};

const viewFormDetail = (form) => {
  openTab(`/forms/${form._id}/detail`, {
    name: `form-detail-${form._id}`,
    title: form.name || t('forms.hubTabFormDetails'),
    icon: 'clipboard-document',
    insertAdjacent: true
  });
  router.push(`/forms/${form._id}/detail`);
};

const viewResponses = (form) => {
  openTab(`/forms/${form._id}/responses`, {
    name: `form-responses-${form._id}`,
    title: t('forms.hubTabResponsesTitle', { name: form.name }),
    component: 'FormResponses',
    params: { formId: form._id },
    insertAdjacent: true
  });
  router.push(`/forms/${form._id}/responses`);
};

const handleDelete = async (form) => {
  if (!canHardDeleteForm(form)) {
    notifications.warning(t('forms.deleteBlockedSubmittedResponses'));
    return;
  }

  try {
    const response = await apiClient(`/forms/${form._id}`, {
      method: 'DELETE'
    });

    if (response.success) {
      await fetchForms();
    }
  } catch (error) {
    console.error('Error deleting form:', error);
    if (error?.response?.data?.code === FORM_DELETE_BLOCKED_CODE) {
      notifications.warning(t('forms.deleteBlockedSubmittedResponses'));
      return;
    }
    notifications.error(t('forms.hubDeleteFormFailed'));
  }
};

const handleBulkAction = async (actionId, selectedRows) => {
  const formIds = selectedRows.map(form => form._id);

  try {
    if (actionId === 'bulk-delete' || actionId === 'delete') {
      if (!formIds.length) return;

      const deletableRows = selectedRows.filter((form) => canHardDeleteForm(form));
      const skippedCount = selectedRows.length - deletableRows.length;

      if (skippedCount > 0) {
        notifications.warning(t('forms.hubDeleteBlockedSubmittedCount', { count: skippedCount }));
      }

      if (!deletableRows.length) return;

      const results = await Promise.allSettled(
        deletableRows.map((form) =>
          apiClient(`/forms/${form._id}`, { method: 'DELETE' })
        )
      );

      const blocked = results.filter(
        (result) => result.status === 'rejected'
          && result.reason?.response?.data?.code === FORM_DELETE_BLOCKED_CODE
      ).length;

      if (blocked > 0) {
        notifications.warning(t('forms.hubDeleteBlockedSubmittedCount', { count: blocked }));
      }

      await fetchForms();
    }
  } catch (error) {
    console.error('Error performing bulk action on forms:', error);
    notifications.error(t('forms.hubBulkActionError'));
  }
};

const exportForms = async () => {
  try {
    const response = await fetch(`/api/forms/export?${new URLSearchParams(filters.value).toString()}`, {
      headers: {
        'Authorization': `Bearer ${authStore.user?.token}`
      }
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `forms-export-${new Date().toISOString()}.csv`;
      a.click();
    }
  } catch (error) {
    console.error('Error exporting forms:', error);
  }
};

let skipNextActivatedFetch = true;

onMounted(() => {
  fetchForms();
});

onActivated(() => {
  if (skipNextActivatedFetch) {
    skipNextActivatedFetch = false;
    return;
  }
  fetchForms();
});

watch(() => route.path, (newPath) => {
  if (newPath === '/forms') {
    fetchForms();
  }
});
</script>
