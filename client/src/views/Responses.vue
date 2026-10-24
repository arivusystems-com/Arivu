<template>
  <div class="mx-auto w-full">
    <!-- Info Banner -->
    <div class="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="flex-1">
          <p class="text-sm font-medium text-blue-900 dark:text-blue-300">
            <strong>{{ t('settings.modFieldsNoteLabel') }}</strong>{{ t('audit.responsesResponseExecutionMustAlwaysStartFrom') }}</p>
          <p class="text-xs text-blue-700 dark:text-blue-400 mt-1">
            {{ isAuditScoped
              ? 'Audit Responses shows only responses linked to your assigned audits. Review details here; execution actions remain in audit workflow.'
              : 'To start a new response, check in to an Event that has an assigned form. This module is for viewing and managing existing responses only.' }}
          </p>
        </div>
      </div>
    </div>
    
    <ListView
      :title="isAuditScoped ? 'Audit Responses' : 'Responses'"
      :description="isAuditScoped
        ? 'View responses linked to your audit assignments'
        : 'View and manage all form responses across all forms'"
      module-key="forms"
      search-:placeholder="t('forms.hubResponsesSearchPlaceholder')"
      :data="responses"
      :columns="columns"
      :loading="loading"
      :statistics="statistics"
      :stats-config="[
        { name: 'Total', key: 'total', formatter: 'number' },
        { name: 'Pending', key: 'pending', formatter: 'number' },
        { name: 'Needs Review', key: 'needsReview', formatter: 'number' },
        { name: 'Approved', key: 'approved', formatter: 'number' },
        { name: 'Rejected', key: 'rejected', formatter: 'number' },
        { name: 'Closed', key: 'closed', formatter: 'number' }
      ]"
      :pagination="{ currentPage: pagination.currentPage, totalPages: pagination.totalPages, totalRecords: pagination.totalResponses, limit: pagination.responsesPerPage }"
      :sort-field="sortField"
      :sort-order="sortOrder"
      table-id="responses-table"
      row-key="_id"
      empty-:title="t('forms.hubResponsesEmptyTitle')"
      empty-message="No form responses have been submitted yet. Responses are created automatically when you check in to an Event with an assigned form."
      :show-create="false"
      :show-import="false"
      :show-export="!isAuditScoped"
      @update:searchQuery="handleSearchQueryUpdate"
      @update:filters="(newFilters) => { Object.assign(filters, newFilters); fetchResponses(); }"
      @update:sort="({ sortField: key, sortOrder: order }) => { handleSort({ key, order }); }"
      @update:pagination="(p) => { pagination.currentPage = p.currentPage; pagination.responsesPerPage = p.limit || pagination.responsesPerPage; fetchResponses(); }"
      @fetch="fetchResponses"
      @row-click="viewResponseDetail"
      @edit="viewResponseDetail"
      @delete="handleDelete"
      @export="exportResponses"
      :hide-delete="isAuditScoped"
    >
      <!-- Form: name + type badge inline -->
      <template #cell-formName="{ row }">
        <div v-if="row.formId && typeof row.formId === 'object'" class="flex min-w-0 items-center gap-2">
          <span class="truncate text-sm font-medium text-gray-900 dark:text-white">
            {{ row.formId.name || row.formId.formId || 'Unknown Form' }}
          </span>
          <BadgeCell
            v-if="row.formId.formType"
            class="shrink-0"
            :value="row.formId.formType"
            :variant-map="{
              'Audit': 'warning',
              'Survey': 'info',
              'Feedback': 'success',
              'Inspection': 'danger',
              'Custom': 'default'
            }"
          />
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Response ID Cell -->
      <template #cell-responseId="{ value }">
        <span class="font-mono text-sm text-gray-600 dark:text-gray-400">{{ value }}</span>
      </template>

      <!-- Custom Submitted At Cell -->
      <template #cell-submittedAt="{ value }">
        <DateCell v-if="value" :value="value" format="short" />
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Submitted By Cell -->
      <template #cell-submittedBy="{ row }">
        <div v-if="row.submittedBy" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.submittedBy.firstName,
              lastName: row.submittedBy.lastName,
              email: row.submittedBy.email,
              avatar: row.submittedBy.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-900 dark:text-white">
            {{ row.submittedBy.firstName }} {{ row.submittedBy.lastName }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('forms.hubAnonymous') }}</span>
      </template>

      <!-- Execution status -->
      <template #cell-executionStatus="{ row }">
        <BadgeCell
          :value="row.executionStatus || 'Not Started'"
          :variant-map="{
            'Not Started': 'default',
            'In Progress': 'info',
            'Submitted': 'success',
            'Abandoned': 'danger'
          }"
        />
      </template>

      <!-- Review status -->
      <template #cell-reviewStatus="{ row }">
        <BadgeCell
          v-if="row.executionStatus === 'Submitted' && row.reviewStatus"
          :value="row.reviewStatus"
          :variant-map="{
            'Pending Corrective Action': 'warning',
            'Needs Auditor Review': 'info',
            'Approved': 'success',
            'Rejected': 'danger',
            'Closed': 'default'
          }"
        />
        <span v-else class="text-sm text-gray-400 dark:text-gray-500">—</span>
      </template>

      <!-- Final score: score + compliance on one line -->
      <template #cell-finalScore="{ row }">
        <div
          v-if="row.kpis && row.kpis.finalScore !== undefined"
          class="flex min-w-0 items-center gap-1.5 text-sm tabular-nums"
        >
          <span class="font-semibold text-gray-900 dark:text-white">
            {{ Math.round(row.kpis.finalScore) }}%
          </span>
          <template v-if="row.kpis.compliancePercentage !== undefined">
            <span class="text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
            <span
              class="truncate"
              :class="[
                row.kpis.compliancePercentage >= 80 ? 'text-green-600 dark:text-green-400' :
                row.kpis.compliancePercentage >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              ]"
            >
              {{ t('forms.hubKpiCompliance', { value: Math.round(row.kpis.compliancePercentage) }) }}
            </span>
          </template>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Linked entity -->
      <template #cell-linkedTo="{ row }">
        <div v-if="row.linkedTo && row.linkedTo.type" class="flex min-w-0 items-center gap-2">
          <BadgeCell
            class="shrink-0"
            :value="row.linkedTo.type"
            :variant-map="{
              'Organization': 'info',
              'Deal': 'success',
              'Task': 'warning',
              'Event': 'primary',
              'Lead': 'default',
              'Contact': 'default'
            }"
          />
          <span
            v-if="row.linkedTo.id && typeof row.linkedTo.id === 'object' && row.linkedTo.id.eventName"
            class="truncate text-sm text-gray-600 dark:text-gray-400"
          >
            {{ row.linkedTo.id.eventName }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Archive/Invalidate Status -->
      <template #cell-archiveStatus="{ row }">
        <div v-if="row.archived" class="flex items-center gap-2">
          <BadgeCell value="Archived" variant-map="{ 'Archived': 'default' }" />
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(row.archivedAt) }}</span>
        </div>
        <div v-else-if="row.invalidated" class="flex items-center gap-2">
          <BadgeCell value="Invalidated" variant-map="{ 'Invalidated': 'danger' }" />
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(row.invalidatedAt) }}</span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Actions -->
      <template #row-actions="{ row }">
        <div class="flex items-center gap-2">
          <button
            @click.stop="viewResponseDetail(row)"
            class="p-1.5 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            :title="t('process.execLogsViewDetails')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            v-if="!isAuditScoped && row.executionStatus === 'Submitted' && row.reviewStatus === 'Needs Auditor Review'"
            @click.stop="approveResponse(row)"
            class="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
            :title="t('settings.roleDrawerPermApprove')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button
            v-if="!isAuditScoped && row.executionStatus === 'Submitted' && row.reviewStatus === 'Needs Auditor Review'"
            @click.stop="rejectResponse(row)"
            class="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            :title="t('forms.hubActionReject')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <!-- Archive/Invalidate for Audit responses -->
          <button
            v-if="!isAuditScoped && isAuditResponse(row) && !row.archived && !row.invalidated"
            @click.stop="showArchiveInvalidateModalFn(row)"
            class="p-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            :title="t('audit.responsesArchiveInvalidate')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </button>
          <!-- Restore for archived/invalidated responses -->
          <button
            v-if="!isAuditScoped && (row.archived || row.invalidated) && canRestore(row)"
            @click.stop="restoreResponse(row)"
            class="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            :title="t('audit.responsesRestore')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <!-- Delete button for non-audit, non-submitted responses -->
          <button
            v-if="!isAuditScoped && !isAuditResponse(row) && row.executionStatus !== 'Submitted' && !row.archived && !row.invalidated"
            @click.stop="handleDelete(row)"
            class="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            :title="t('settings.modFieldsDelete')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </template>
    </ListView>

    <!-- Archive/Invalidate Modal -->
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
          v-if="showArchiveInvalidateModal"
          class="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          @click.self="showArchiveInvalidateModal = false; selectedResponse = null; archiveInvalidateReason = ''; archiveInvalidateAction = null"
        >
          <div class="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('audit.responsesArchiveInvalidateResponse') }}</h3>
              <button
                @click="showArchiveInvalidateModal = false; selectedResponse = null; archiveInvalidateReason = ''; archiveInvalidateAction = null"
                class="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="p-6 space-y-4">
              <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p class="text-sm text-yellow-800 dark:text-yellow-300">
                  <strong>{{ t('audit.responsesAuditIntegrity') }}</strong>{{ t('audit.responsesAuditResponsesCannotBeDeletedUse') }}</p>
              </div>

              <div class="space-y-3">
                <button
                  @click="archiveInvalidateAction = 'archive'"
                  :class="[
                    'w-full px-4 py-3 rounded-lg border-2 transition-colors text-left',
                    archiveInvalidateAction === 'archive'
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  ]"
                >
                  <div class="font-medium text-gray-900 dark:text-white">{{ t('actions.archive') }}</div>
                  <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">{{ t('audit.responsesHideFromActiveListsWhilePreserving') }}</div>
                </button>

                <button
                  @click="archiveInvalidateAction = 'invalidate'"
                  :class="[
                    'w-full px-4 py-3 rounded-lg border-2 transition-colors text-left',
                    archiveInvalidateAction === 'invalidate'
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  ]"
                >
                  <div class="font-medium text-gray-900 dark:text-white">{{ t('audit.responsesInvalidate') }}</div>
                  <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">{{ t('audit.responsesMarkAsInvalidWithReasonFor') }}</div>
                </button>
              </div>

              <div v-if="archiveInvalidateAction" class="space-y-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('audit.responsesReason') }}<span class="text-red-500">*</span>
                </label>
                <textarea
                  v-model="archiveInvalidateReason"
                  rows="3"
                  :placeholder="t('audit.responsesEnterReasonForArchivingInvalidatingThis')"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                ></textarea>
              </div>
            </div>

            <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <button
                @click="showArchiveInvalidateModal = false; selectedResponse = null; archiveInvalidateReason = ''; archiveInvalidateAction = null"
                class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >{{ t('performance.cancelWizard') }}</button>
              <button
                @click="handleArchiveInvalidate"
                :disabled="!archiveInvalidateAction || !archiveInvalidateReason.trim()"
                class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ archiveInvalidateAction === 'archive' ? 'Archive' : 'Invalidate' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
defineOptions({ name: 'ResponsesView' });
import { useI18n } from 'vue-i18n';

import { useNotifications } from '@/composables/useNotifications';
import { confirmAction } from '@/composables/useConfirmAction';
const { t } = useI18n();
const notifications = useNotifications();

import { ref, computed, onMounted, onActivated, onBeforeMount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import ListView from '@/components/common/ListView.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import Avatar from '@/components/common/Avatar.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import { formatUserDate } from '@/utils/localeFormat';

const route = useRoute();
const router = useRouter();
const { openTab } = useTabs();
const isAuditScoped = computed(() => (
  String(route.meta?.appKey || '').toUpperCase() === 'AUDIT' ||
  String(route.path || '').startsWith('/audit/')
));

// State
const responses = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const sortField = ref('submittedAt');
const sortOrder = ref('desc');
const filters = ref({
  executionStatus: '',
  reviewStatus: '',
  formId: '',
  fromDate: '',
  toDate: '',
  linkedToType: ''
});

const pagination = ref({
  currentPage: 1,
  responsesPerPage: 25,
  totalResponses: 0,
  totalPages: 1
});

const statistics = ref({
  total: 0,
  pending: 0,
  needsReview: 0,
  approved: 0,
  rejected: 0,
  closed: 0
});

// Archive/Invalidate modal state
const showArchiveInvalidateModal = ref(false);
const selectedResponse = ref(null);
const archiveInvalidateReason = ref('');
const archiveInvalidateAction = ref(null); // 'archive' or 'invalidate'

// Columns configuration
const columns = [
  { key: 'responseId', label: 'Response ID', sortable: true, minWidth: '120px', visible: true, showInTable: true, visibility: { list: true } },
  { key: 'formName', label: 'Form', sortable: false, minWidth: '200px', visible: true, showInTable: true, visibility: { list: true } },
  { key: 'linkedTo', label: 'Linked To', sortable: false, minWidth: '120px', visible: true, showInTable: true, visibility: { list: true } },
  {
    key: 'executionStatus',
    label: 'Execution Status',
    dataType: 'select',
    sortable: true,
    minWidth: '140px',
    visible: true,
    showInTable: true,
    visibility: { list: true },
    options: [
      { value: 'Not Started', label: 'Not Started' },
      { value: 'In Progress', label: 'In Progress' },
      { value: 'Submitted', label: 'Submitted' }
    ]
  },
  {
    key: 'reviewStatus',
    label: 'Review Status',
    dataType: 'select',
    sortable: true,
    minWidth: '160px',
    visible: true,
    showInTable: true,
    visibility: { list: true },
    options: [
      { value: 'Pending Corrective Action', label: 'Pending Corrective Action' },
      { value: 'Needs Auditor Review', label: 'Needs Auditor Review' },
      { value: 'Approved', label: 'Approved' },
      { value: 'Rejected', label: 'Rejected' },
      { value: 'Closed', label: 'Closed' }
    ]
  },
  { key: 'finalScore', label: 'Final Score', sortable: false, minWidth: '120px', visible: true, showInTable: true, visibility: { list: true } },
  { key: 'submittedBy', label: 'Submitted By', dataType: 'user', sortable: true, minWidth: '150px', visible: true, showInTable: true, visibility: { list: true } },
  { key: 'submittedAt', label: 'Submitted At', dataType: 'date', sortable: true, minWidth: '140px', visible: true, showInTable: true, visibility: { list: true } },
  {
    key: 'linkedToType',
    label: 'Linked To Type',
    dataType: 'select',
    visible: true,
    showInTable: false,
    sortable: false,
    options: [
      { value: 'Organization', label: 'Organization' },
      { value: 'Deal', label: 'Deal' },
      { value: 'Task', label: 'Task' },
      { value: 'Event', label: 'Event' },
      { value: 'Lead', label: 'Lead' },
      { value: 'Contact', label: 'Contact' }
    ]
  },
  { key: 'fromDate', label: 'From Date', dataType: 'date', visible: true, showInTable: false, sortable: false },
  { key: 'toDate', label: 'To Date', dataType: 'date', visible: true, showInTable: false, sortable: false }
];

// Methods
const fetchResponses = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.value.currentPage,
      limit: pagination.value.responsesPerPage,
      sortBy: sortField.value,
      sortOrder: sortOrder.value,
      search: searchQuery.value,
      ...filters.value
    };

    // Remove empty filters
    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null || params[key] === undefined) {
        delete params[key];
      }
    });

    const endpoint = isAuditScoped.value ? '/audit/responses' : '/forms/responses/all';
    const response = await apiClient(endpoint, {
      method: 'GET',
      params
    });

    if (response.success) {
      responses.value = Array.isArray(response.data) ? response.data : [];
      
      // Handle pagination
      if (response.pagination) {
        pagination.value.totalResponses = response.pagination.totalResponses || 0;
        pagination.value.totalPages = response.pagination.totalPages || 1;
      }
      
      // Handle statistics
      if (response.statistics) {
        statistics.value = {
          total: response.statistics.total || 0,
          pending: response.statistics.pending || 0,
          needsReview: response.statistics.needsReview || 0,
          approved: response.statistics.approved || 0,
          rejected: response.statistics.rejected || 0,
          closed: response.statistics.closed || 0
        };
      }
    } else {
      console.error('Failed to fetch responses:', response.message || 'Unknown error');
      responses.value = [];
    }
  } catch (error) {
    console.error('Error fetching responses:', error);
    responses.value = [];
  } finally {
    loading.value = false;
  }
};

const handleSearchQueryUpdate = (query) => {
  searchQuery.value = query;
  pagination.value.currentPage = 1;
  fetchResponses();
};

const handleSort = ({ key, order }) => {
  sortField.value = key;
  sortOrder.value = order;
  fetchResponses();
};

const getFormId = (response) => {
  if (!response) return null;

  const formIdValue = response.formId;
  if (formIdValue == null) return null;

  if (typeof formIdValue === 'object') {
    if (formIdValue._id != null) return String(formIdValue._id);
    if (formIdValue.$oid != null) return String(formIdValue.$oid);
    if (typeof formIdValue.toString === 'function') {
      const asString = formIdValue.toString();
      if (asString && asString !== '[object Object]') return asString;
    }
    return null;
  }

  const asString = String(formIdValue).trim();
  return asString || null;
};

const responseDetailPath = (formId, responseId) => {
  if (isAuditScoped.value) return `/audit/forms/${formId}/responses/${responseId}`;
  return `/responses/${responseId}`;
};

const viewResponseDetail = (response) => {
  if (!response?._id) return;

  const formId = getFormId(response);
  if (isAuditScoped.value && !formId) return;

  const path = responseDetailPath(formId, response._id);
  const tabParams = { responseId: response._id };
  if (formId) tabParams.formId = formId;

  openTab(path, {
    name: `form-response-${response._id}`,
    title: `Response - ${response.responseId || formatUserDate(response.submittedAt)}`,
    component: 'ModuleRecordPage',
    params: tabParams,
    insertAdjacent: true
  });
  router.push(formId && !isAuditScoped.value ? `${path}?formId=${formId}` : path);
};

const approveResponse = async (response) => {
  if (!await confirmAction('Are you sure you want to approve this response?')) {
    return;
  }

  const formId = getFormId(response);
  if (!formId) {
    notifications.error(t('common.responsesToastFormIdNotFoundPlease'));
    return;
  }

  try {
    const result = await apiClient(`/forms/${formId}/responses/${response._id}/approve`, {
      method: 'POST'
    });

    if (result.success) {
      await fetchResponses();
    }
  } catch (error) {
    console.error('Error approving response:', error);
    notifications.error(t('common.responsesToastFailedToApproveResponsePlease'));
  }
};

const rejectResponse = async (response) => {
  if (!await confirmAction('Are you sure you want to reject this response?')) {
    return;
  }

  const formId = getFormId(response);
  if (!formId) {
    notifications.error(t('common.responsesToastFormIdNotFoundPlease2'));
    return;
  }

  try {
    const result = await apiClient(`/forms/${formId}/responses/${response._id}/reject`, {
      method: 'POST'
    });

    if (result.success) {
      await fetchResponses();
    }
  } catch (error) {
    console.error('Error rejecting response:', error);
    notifications.error(t('common.responsesToastFailedToRejectResponsePlease'));
  }
};

// Check if response is from an audit form
const isAuditResponse = (response) => {
  const formType = response.formId?.formType || (response.formId && typeof response.formId === 'object' ? response.formId.formType : null);
  return formType === 'Audit';
};

// Check if response can be restored
const canRestore = (response) => {
  return response.archived || response.invalidated;
};

// Show archive/invalidate modal
const showArchiveInvalidateModalFn = (response) => {
  selectedResponse.value = response;
  archiveInvalidateReason.value = '';
  archiveInvalidateAction.value = null;
  showArchiveInvalidateModal.value = true;
};

// Handle archive/invalidate
const handleArchiveInvalidate = async () => {
  if (!selectedResponse.value || !archiveInvalidateAction.value || !archiveInvalidateReason.value.trim()) {
    return;
  }

  const formId = getFormId(selectedResponse.value);
  if (!formId) {
    notifications.error(t('common.responsesToastFormIdNotFoundPlease3'));
    return;
  }

  try {
    const endpoint = archiveInvalidateAction.value === 'archive' ? 'archive' : 'invalidate';
    const result = await apiClient(`/forms/${formId}/responses/${selectedResponse.value._id}/${endpoint}`, {
      method: 'POST',
      body: JSON.stringify({
        reason: archiveInvalidateReason.value.trim()
      })
    });

    if (result.success) {
      await fetchResponses();
      showArchiveInvalidateModal.value = false;
      selectedResponse.value = null;
      archiveInvalidateReason.value = '';
      archiveInvalidateAction.value = null;
    }
  } catch (error) {
    console.error(`Error ${archiveInvalidateAction.value}ing response:`, error);
    notifications.error(`Failed to ${archiveInvalidateAction.value} response. Please try again.`);
  }
};

// Restore archived/invalidated response
const restoreResponse = async (response) => {
  if (!await confirmAction(`Are you sure you want to restore this response?`)) {
    return;
  }

  const formId = getFormId(response);
  if (!formId) {
    notifications.error(t('common.responsesToastFormIdNotFoundPlease4'));
    return;
  }

  try {
    const result = await apiClient(`/forms/${formId}/responses/${response._id}/restore`, {
      method: 'POST'
    });

    if (result.success) {
      await fetchResponses();
    }
  } catch (error) {
    console.error('Error restoring response:', error);
    notifications.error(t('common.responsesToastFailedToRestoreResponsePlease'));
  }
};

const handleDelete = async (response) => {
  // Check if it's an audit response
  if (isAuditResponse(response)) {
    // Show archive/invalidate modal instead
    showArchiveInvalidateModalFn(response);
    return;
  }

  // For non-audit responses, check if submitted
  if (response.executionStatus === 'Submitted') {
    notifications.error(t('common.responsesToastSubmittedResponsesCannotBeDeleted'));
    return;
  }

  if (!await confirmAction(`Are you sure you want to delete this response?`)) {
    return;
  }

  const formId = getFormId(response);
  if (!formId) {
    console.error('Form ID not found in response:', response);
    notifications.error(t('common.responsesToastFormIdNotFoundPlease5'));
    return;
  }

  try {
    const result = await apiClient(`/forms/${formId}/responses/${response._id}`, {
      method: 'DELETE'
    });

    if (result.success) {
      await fetchResponses();
    } else if (result.code === 'AUDIT_DELETE_FORBIDDEN' || result.code === 'SUBMITTED_DELETE_FORBIDDEN') {
      // Show archive/invalidate modal if delete is forbidden
      showArchiveInvalidateModalFn(response);
    }
  } catch (error) {
    console.error('Error deleting response:', error);
    // Check if error is about audit or submitted response
    if (error.response?.data?.code === 'AUDIT_DELETE_FORBIDDEN' || error.response?.data?.code === 'SUBMITTED_DELETE_FORBIDDEN') {
      showArchiveInvalidateModalFn(response);
    } else {
      notifications.error(t('common.responsesToastFailedToDeleteResponsePlease'));
    }
  }
};

const exportResponses = async () => {
  try {
    const params = new URLSearchParams({
      ...filters.value,
      search: searchQuery.value
    });
    
    // Note: This would need a new export endpoint for all responses
    notifications.error(t('common.responsesToastExportFunctionalityForAllResponses'));
  } catch (error) {
    console.error('Error exporting responses:', error);
    notifications.error(t('common.responsesToastAnErrorOccurredDuringExport'));
  }
};

// Format date helper
const formatDate = (date) => {
  if (!date) return '';
  return formatUserDate(date);
};

// Lifecycle - Clear old column settings BEFORE ListView initializes
onBeforeMount(() => {
  // Force clear old column settings and save our 8 decision-focused columns
  // This must run BEFORE ListView's onMounted which loads the settings
  if (typeof window !== 'undefined') {
    const expectedKeys = new Set([
      'responseId',
      'formName', 
      'linkedTo',
      'executionStatus',
      'reviewStatus',
      'finalScore',
      'submittedBy',
      'submittedAt'
    ]);
    
    // Clear ListView column settings (uses module-key "forms")
    const listViewKey = 'arivu-listview-forms-columns';
    const savedListView = localStorage.getItem(listViewKey);
    let shouldReset = false;
    
    // Check if saved columns match our expected columns
    if (savedListView) {
      try {
        const parsed = JSON.parse(savedListView);
        if (Array.isArray(parsed)) {
          const savedKeys = new Set(parsed.map(c => c.key || c));
          
          // Check if saved columns match expected columns (bidirectional check)
          const hasAllExpected = [...expectedKeys].every(key => savedKeys.has(key));
          const hasOnlyExpected = [...savedKeys].every(key => expectedKeys.has(key));
          const sizeMatches = savedKeys.size === expectedKeys.size;
          
          if (!hasAllExpected || !hasOnlyExpected || !sizeMatches) {
            console.log('Columns mismatch - resetting. Expected:', [...expectedKeys].sort(), 'Saved:', [...savedKeys].sort());
            shouldReset = true;
          } else {
            // Even if keys match, check if visibility is correct
            const allVisible = parsed.every(c => {
              const key = c.key || c;
              return expectedKeys.has(key) && (c.visible !== false);
            });
            if (!allVisible) {
              console.log('Some columns are hidden - resetting visibility');
              shouldReset = true;
            }
          }
        } else {
          shouldReset = true;
        }
      } catch (e) {
        console.log('Error parsing saved columns - resetting:', e);
        shouldReset = true;
      }
    } else {
      shouldReset = true; // No saved settings, need to set our columns
    }
    
    if (shouldReset) {
      // Save our 8 decision-focused columns to localStorage
      // This ensures ListView uses ONLY these columns, not the 32 from backend
      const columnsToSave = columns.map(col => ({
        key: col.key,
        label: col.label,
        visible: true,
        sortable: col.sortable !== false,
        dataType: col.dataType || 'Text',
        showInTable: true
      }));
      
      localStorage.setItem(listViewKey, JSON.stringify(columnsToSave));
      console.log('Saved decision-focused columns to localStorage:', columnsToSave.map(c => c.key));
    }
    
    // Always clear DataTable settings (they're not used by ListView)
    ['datatable-responses-table-hidden', 'datatable-responses-table-order', 'datatable-responses-table-frozen']
      .forEach(key => localStorage.removeItem(key));
  }
});

onMounted(() => {
  fetchResponses();
});

onActivated(() => {
  fetchResponses();
});
</script>

