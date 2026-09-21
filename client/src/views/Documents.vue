<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import {
  fetchCustomSavedViews,
  persistCustomSavedViews,
  loadActiveSavedViewId,
  saveActiveSavedViewId
} from '@/utils/listViewSavedViewsStorage';
import { resolveListViewLabel } from '@/utils/moduleListLabels';
import {
  extractSearchTermFromFilterQuery,
  resolveListSearchTerm as resolveModuleColumnSearchTerm
} from '@/utils/searchRelevance';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';
import {
  DocumentDuplicateIcon,
  ArrowUpTrayIcon,
  PlusIcon,
  FolderIcon,
  StarIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ChartPieIcon,
  ClockIcon,
  BookOpenIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  ShareIcon,
  LinkIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowDownTrayIcon,
  SparklesIcon,
  MagnifyingGlassIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import ListView from '@/components/common/ListView.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DocumentLinkedRecordFilter from '@/components/documents/DocumentLinkedRecordFilter.vue';
import CreateDocumentDrawer from '@/components/documents/CreateDocumentDrawer.vue';
import CreateExternalLinkDrawer from '@/components/documents/CreateExternalLinkDrawer.vue';
import DocumentGridThumbnail from '@/components/documents/DocumentGridThumbnail.vue';
import DocumentGridCard from '@/components/documents/DocumentGridCard.vue';
import DocumentTypeIcon from '@/components/documents/DocumentTypeIcon.vue';
import DocumentsListView from '@/components/documents/DocumentsListView.vue';
import DocumentFolderTree from '@/components/documents/DocumentFolderTree.vue';
import DocumentFolderBrowsePane from '@/components/documents/DocumentFolderBrowsePane.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';
import { useDocuments } from '@/composables/useDocuments';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import { DOCUMENT_ATTACHMENT_MODULES } from '@/constants/documentAttachments';
import { useTabs } from '@/composables/useTabs';
import { useOnboarding } from '@/composables/useOnboarding';
import { captureFirstTimeEmptyStateSeen } from '@/config/posthogOnboarding';
import { captureDocumentsModuleVisited, captureDocumentUploaded, captureKnowledgeBaseViewed } from '@/config/posthogDocuments';
import apiClient from '@/utils/apiClient';

import { confirmAction } from '@/composables/useConfirmAction';
import { formatUserDateTime } from '@/utils/localeFormat';
const { t, te } = useI18n();
const route = useRoute();
const authStore = useAuthStore();
const notifications = useNotifications();
const { openTab } = useTabs();
const { recordModuleVisit, hasModuleVisit } = useOnboarding();

const {
  documents,
  summary,
  recentDocuments,
  recentActivity,
  folders,
  loading,
  summaryLoading,
  uploading,
  pagination,
  fetchDocuments,
  fetchKnowledgeBase,
  fetchSummary,
  uploadDocuments,
  deleteDocument,
  createFolder,
  deleteFolder,
  fetchFolders,
  fetchAllFolders,
  getPreviewUrl,
  getDownloadUrl,
  toggleFavorite,
  isFavorite,
  favoriteCount,
  recentCount,
  sharedCount,
  semanticSearchDocuments
} = useDocuments();

const activeView = ref('dashboard');
const searchQuery = ref('');
const searchMode = ref('keyword');
const fileInputRef = ref(null);
const selectedFolderId = ref(null);
const statusFilter = ref('');
const selectedDashboardStatKey = ref(null);
const documentTypeFilter = ref('');
const fileTypeFilter = ref('');
const ownerFilter = ref('');
const tagFilter = ref('');
const linkedModuleFilter = ref('');
const linkedRecordIdFilter = ref('');
const linkedRecordLabel = ref('');
const favoritesOnlyFilter = ref(false);
const recentOnlyFilter = ref(false);
const sharedWithMeFilter = ref(false);
const expiringOnlyFilter = ref(false);
const ownerOptions = ref([]);
const isDragging = ref(false);
const foldersFullyLoaded = ref(false);
const isFirstDocumentsVisit = ref(false);
const isTouchDevice = ref(false);
const creatingFolder = ref(false);
const deletingFolder = ref(false);
const deletingFolderId = ref(null);
const folderPendingDelete = ref(null);
const showFolderDeleteModal = ref(false);
const showPreviewModal = ref(false);
const showCreateDocumentDrawer = ref(false);
const showCreateExternalLinkDrawer = ref(false);
const previewLoading = ref(false);
const previewState = ref({ title: '', url: '', mimeType: '' });
const listViewRef = ref(null);
const folderTreeRef = ref(null);
const savedViews = ref([]);
const activeSavedViewId = ref(null);
const defaultViewId = ref(null);

const canCreate = computed(() => authStore.can('documents', 'create'));
const canDelete = computed(() => authStore.can('documents', 'delete'));
const showFilters = computed(() => activeView.value === 'grid');

const listActiveFilterChips = computed(() => {
  const chips = [];
  const isListLikeTable = activeView.value === 'list' || activeView.value === 'folder';

  // Column filters and toolbar search are shown by ListView (same as People / ModuleList).
  if (!isListLikeTable) {
    const columnTitle = getColumnTitleFilterTerm();
    if (columnTitle) {
      chips.push({
        id: 'title',
        label: t('documents.activeFilterName', { value: columnTitle })
      });
    }

    const searchTerm = searchQuery.value.trim();
    if (searchTerm && !columnTitle) {
      chips.push({
        id: '__search__',
        label: t('common.listActiveFilterSearch', { query: searchTerm })
      });
    }

    if (statusFilter.value) {
      const match = statusFilterOptions.value.find((opt) => opt.value === statusFilter.value);
      chips.push({
        id: 'status',
        label: t('documents.activeFilterStatus', { value: match?.label || statusFilter.value })
      });
    }

    if (ownerFilter.value) {
      const user = ownerOptions.value.find((entry) => String(entry._id) === String(ownerFilter.value));
      chips.push({
        id: 'assignedTo',
        label: t('documents.activeFilterOwner', { value: user ? getUserDisplayName(user) : '—' })
      });
    }

    if (tagFilter.value.trim()) {
      chips.push({
        id: 'tag',
        label: t('documents.activeFilterTag', { value: tagFilter.value.trim() })
      });
    }

    if (documentTypeFilter.value) {
      chips.push({
        id: 'documentType',
        label: t('documents.activeFilterDocumentType', { value: formatDocumentType(documentTypeFilter.value) })
      });
    }
  }

  if (selectedFolderId.value && activeView.value !== 'folder') {
    const folder = folders.value.find((entry) => String(entry._id) === String(selectedFolderId.value));
    chips.push({
      id: 'folderId',
      label: t('documents.activeFilterFolder', { name: folder?.name || '—' })
    });
  }

  if (fileTypeFilter.value && !isListLikeTable) {
    const match = fileTypeFilterOptions.value.find((opt) => opt.value === fileTypeFilter.value);
    chips.push({
      id: 'fileType',
      label: t('documents.activeFilterFileType', { value: match?.label || fileTypeFilter.value })
    });
  }

  if (linkedModuleFilter.value) {
    const match = linkedModuleFilterOptions.value.find((opt) => opt.value === linkedModuleFilter.value);
    chips.push({
      id: 'linkedModuleKey',
      label: t('documents.activeFilterLinkedModule', { value: match?.label || linkedModuleFilter.value })
    });
  }

  if (linkedRecordIdFilter.value.trim()) {
    chips.push({
      id: 'linkedRecordId',
      label: t('documents.activeFilterLinkedRecord', {
        value: linkedRecordLabel.value || linkedRecordIdFilter.value.trim()
      })
    });
  }

  if (favoritesOnlyFilter.value) {
    chips.push({ id: 'favoritesOnly', label: t('documents.activeFilterFavorites') });
  }
  if (recentOnlyFilter.value) {
    chips.push({ id: 'recentOnly', label: t('documents.activeFilterRecent') });
  }
  if (sharedWithMeFilter.value) {
    chips.push({ id: 'sharedWithMe', label: t('documents.activeFilterShared') });
  }
  if (expiringOnlyFilter.value) {
    chips.push({ id: 'expiringOnly', label: t('documents.activeFilterExpiring') });
  }

  return chips;
});

const displaySavedViews = computed(() => savedViews.value.map((view) => ({
  ...view,
  label: ['all', 'assigned-to-me'].includes(view.id)
    ? resolveListViewLabel('documents', view.id, view.label, t, te)
    : view.label
})));

const statusFilterOptions = computed(() => [
  { value: '', label: t('documents.filterAllStatuses') },
  { value: 'draft', label: t('documents.statusDraft') },
  { value: 'pending_review', label: t('documents.statusPendingReview') },
  { value: 'approved', label: t('documents.statusApproved') },
  { value: 'published', label: t('documents.statusPublished') },
  { value: 'archived', label: t('documents.statusArchived') }
]);

const fileTypeFilterOptions = computed(() => [
  { value: '', label: t('documents.filterAllFileTypes') },
  { value: 'PDF', label: 'PDF' },
  { value: 'DOCX', label: 'DOCX' },
  { value: 'XLSX', label: 'XLSX' },
  { value: 'PPTX', label: 'PPTX' },
  { value: 'IMAGE', label: t('documents.filterImage') }
]);

const LINKED_MODULE_LABEL_KEYS = {
  people: 'navigation.modulePeople',
  organizations: 'navigation.moduleOrganizations',
  deals: 'navigation.moduleDeals',
  tasks: 'navigation.moduleTasks',
  events: 'navigation.moduleEvents',
  forms: 'navigation.moduleForms',
  cases: 'navigation.moduleCases',
  quotes: 'navigation.moduleQuotes',
  items: 'navigation.moduleItems'
};

const linkedModuleFilterOptions = computed(() => [
  { value: '', label: t('documents.filterAllModules') },
  ...Array.from(DOCUMENT_ATTACHMENT_MODULES).map((moduleKey) => ({
    value: moduleKey,
    label: t(LINKED_MODULE_LABEL_KEYS[moduleKey] || 'documents.pageTitle')
  }))
]);

const viewTabs = computed(() => [
  { id: 'dashboard', label: t('documents.viewDashboard'), icon: ChartPieIcon },
  { id: 'list', label: t('documents.viewList'), icon: ListBulletIcon },
  { id: 'grid', label: t('documents.viewGrid'), icon: Squares2X2Icon },
  { id: 'folder', label: t('documents.viewFolder'), icon: FolderIcon },
  { id: 'knowledge', label: t('documents.viewKnowledge'), icon: BookOpenIcon }
]);

const statsConfig = computed(() => [
  { key: 'total', label: t('documents.statTotal'), icon: DocumentDuplicateIcon, color: 'indigo' },
  { key: 'published', label: t('documents.statPublished'), icon: CheckCircleIcon, color: 'green' },
  { key: 'drafts', label: t('documents.statDrafts'), icon: DocumentTextIcon, color: 'amber' },
  { key: 'pendingReview', label: t('documents.statPendingReview'), icon: ClockIcon, color: 'purple' },
  { key: 'expiringSoon', label: t('documents.statExpiringSoon'), icon: ExclamationTriangleIcon, color: 'red' }
]);

const statistics = computed(() => ({
  total: summary.value?.total ?? 0,
  published: summary.value?.published ?? 0,
  drafts: summary.value?.drafts ?? 0,
  pendingReview: summary.value?.pendingReview ?? 0,
  expiringSoon: summary.value?.expiringSoon ?? 0
}));

const quickAccessCards = computed(() => [
  { key: 'favorites', label: t('documents.quickFavorites'), count: favoriteCount.value, icon: StarIcon, tone: 'amber' },
  { key: 'recent', label: t('documents.quickRecent'), count: recentCount.value, icon: ClockIcon, tone: 'indigo' },
  { key: 'shared', label: t('documents.quickShared'), count: sharedCount.value, icon: ShareIcon, tone: 'blue' },
  { key: 'drafts', label: t('documents.quickDrafts'), count: statistics.value.drafts, icon: DocumentTextIcon, tone: 'orange' },
  { key: 'pending', label: t('documents.quickPendingApprovals'), count: statistics.value.pendingReview, icon: ClockIcon, tone: 'purple' },
  { key: 'expiring', label: t('documents.quickExpiring'), count: statistics.value.expiringSoon, icon: ExclamationTriangleIcon, tone: 'red' },
  { key: 'trash', label: t('documents.quickRecycleBin'), count: summary.value?.trashed ?? 0, icon: TrashIcon, tone: 'gray' }
]);

const listEmptyTitle = computed(() => {
  if (searchMode.value === 'semantic' && searchQuery.value.trim()) {
    return t('documents.semanticSearchEmptyTitle');
  }
  if ((pagination.value.total || 0) === 0 && !searchQuery.value && !statusFilter.value && !fileTypeFilter.value && !ownerFilter.value && !linkedModuleFilter.value) {
    return isFirstDocumentsVisit.value
      ? t('onboarding.firstTimeDocumentsTitle')
      : t('documents.emptyTitle');
  }
  return t('documents.emptyFilteredTitle');
});

const listEmptyMessage = computed(() => {
  if (searchMode.value === 'semantic' && searchQuery.value.trim()) {
    return t('documents.semanticSearchEmptyMessage');
  }
  if ((pagination.value.total || 0) === 0 && !searchQuery.value && !statusFilter.value && !fileTypeFilter.value && !ownerFilter.value && !linkedModuleFilter.value) {
    return isFirstDocumentsVisit.value
      ? t('onboarding.firstTimeDocumentsDescription')
      : t('documents.emptyMessage');
  }
  return t('documents.emptyFilteredMessage');
});

const knowledgeEmptyTitle = computed(() => t('documents.knowledgeBaseTitle'));
const knowledgeEmptyMessage = computed(() => {
  if (!searchQuery.value && !tagFilter.value) {
    return t('documents.knowledgeBaseEmpty');
  }
  return t('documents.emptyFilteredMessage');
});

const listColumnFilters = ref({});
let suppressColumnFilterWatch = false;

const statusVariantMap = {
  published: 'success',
  draft: 'warning',
  pending_review: 'info',
  approved: 'primary',
  archived: 'default'
};

const typeLabelMap = {
  file: 'documents.typeFile',
  rich_document: 'documents.typeRichDocument',
  sop: 'documents.typeSop',
  checklist: 'documents.typeChecklist',
  template: 'documents.typeTemplate',
  external_link: 'documents.typeExternalLink',
  generated_document: 'documents.typeGenerated',
  knowledge_article: 'documents.typeKnowledgeArticle',
  playbook: 'documents.typePlaybook',
  meeting_notes: 'documents.typeMeetingNotes'
};

const statusLabelMap = {
  draft: 'documents.statusDraft',
  pending_review: 'documents.statusPendingReview',
  approved: 'documents.statusApproved',
  published: 'documents.statusPublished',
  archived: 'documents.statusArchived'
};

function formatDocumentType(value) {
  const key = typeLabelMap[value];
  return key ? t(key) : value;
}

function formatStatus(value) {
  const key = statusLabelMap[value];
  return key ? t(key) : value;
}

const documentStatusColumnOptions = computed(() =>
  statusFilterOptions.value
    .filter((option) => option.value)
    .map((option) => ({ value: option.value, label: option.label }))
);

const documentTypeColumnOptions = computed(() => [
  'rich_document',
  'file',
  'external_link',
  'sop',
  'checklist',
  'template',
  'generated_document',
  'knowledge_article',
  'playbook',
  'meeting_notes'
].map((value) => ({
  value,
  label: formatDocumentType(value)
})));

const folderColumnOptions = computed(() =>
  folders.value.map((folder) => {
    const id = String(folder._id);
    const name = String(folder.name || '').trim() || id;
    const path = String(folder.path || '').trim();
    const label = path && path !== `/${name}` ? `${name} (${path})` : name;
    return { value: id, label };
  })
);

const columns = computed(() => [
  { key: 'title', label: t('documents.columnName'), sortable: true, dataType: 'Text', filterType: 'text' },
  {
    key: 'documentType',
    label: t('documents.columnType'),
    sortable: true,
    dataType: 'Select',
    filterType: 'select',
    options: documentTypeColumnOptions.value
  },
  {
    key: 'folderId',
    label: t('documents.columnFolder'),
    sortable: false,
    dataType: 'Lookup',
    filterType: 'select',
    options: folderColumnOptions.value
  },
  {
    key: 'status',
    label: t('documents.columnStatus'),
    sortable: true,
    dataType: 'Select',
    filterType: 'select',
    options: documentStatusColumnOptions.value
  },
  {
    key: 'versionNumber',
    label: t('documents.columnVersion'),
    sortable: true,
    dataType: 'Number',
    filterType: 'number'
  },
  {
    key: 'assignedTo',
    label: t('documents.columnOwner'),
    sortable: false,
    dataType: 'User',
    filterType: 'user'
  },
  {
    key: 'tags',
    label: t('documents.columnTags'),
    sortable: false,
    dataType: 'Text',
    filterType: 'text'
  },
  {
    key: 'updatedAt',
    label: t('documents.columnModified'),
    sortable: true,
    dataType: 'Date',
    filterType: 'date'
  }
]);

function getColumnTitleFilterTerm() {
  return extractSearchTermFromFilterQuery(listColumnFilters.value.filterQuery, ['title'])
    || String(listColumnFilters.value.title ?? '').trim();
}

function stripFilterQueryField(filterQueryRaw, fieldKey) {
  if (!filterQueryRaw) return null;
  let ast = filterQueryRaw;
  try {
    ast = typeof ast === 'string' ? JSON.parse(ast) : JSON.parse(JSON.stringify(ast));
  } catch {
    return null;
  }

  const stripNode = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (node.fieldKey) {
      if (String(node.fieldKey).toLowerCase() === String(fieldKey).toLowerCase()) return null;
      return node;
    }
    const children = (node.children || []).map(stripNode).filter(Boolean);
    if (children.length === 0) return null;
    return { ...node, children };
  };

  const cleaned = stripNode(ast);
  if (!cleaned?.children?.length) return null;
  return JSON.stringify(cleaned);
}

function clearColumnTitleFilter() {
  const next = { ...listColumnFilters.value };
  delete next.title;
  const stripped = stripFilterQueryField(next.filterQuery, 'title');
  if (stripped) next.filterQuery = stripped;
  else delete next.filterQuery;
  listColumnFilters.value = next;
}

function normalizeColumnTagsValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean).join(',');
  }
  return value ? String(value).trim() : '';
}

function toListViewFilterUi(viewFilters = {}) {
  const ui = {};
  if (viewFilters.assignedTo) {
    ui.assignedTo = authStore.user?._id && String(viewFilters.assignedTo) === String(authStore.user._id)
      ? 'me'
      : viewFilters.assignedTo;
  }
  if (viewFilters.status) ui.status = viewFilters.status;
  if (viewFilters.documentType) ui.documentType = viewFilters.documentType;
  if (viewFilters.tags || viewFilters.tag) {
    ui.tags = viewFilters.tags || viewFilters.tag;
  }
  if (viewFilters.folderId) ui.folderId = viewFilters.folderId;
  return ui;
}

function filtersPayloadSignature(payload) {
  return JSON.stringify(payload ?? {});
}

function applyColumnFiltersToDocumentState(apiFilters = {}) {
  statusFilter.value = apiFilters.status || '';
  documentTypeFilter.value = apiFilters.documentType || '';

  const owner = apiFilters.assignedTo;
  if (!owner) {
    ownerFilter.value = '';
  } else if (owner === 'me' && authStore.user?._id) {
    ownerFilter.value = authStore.user._id;
  } else if (owner === 'unassigned') {
    ownerFilter.value = '';
  } else {
    ownerFilter.value = String(owner);
  }

  const tagValue = apiFilters.tags ?? apiFilters.tag;
  tagFilter.value = tagValue != null && tagValue !== ''
    ? normalizeColumnTagsValue(tagValue)
    : '';

  // List view: folder column filter drives selectedFolderId. Folder browse view keeps tree selection.
  if (activeView.value === 'list') {
    selectedFolderId.value = apiFilters.folderId ? String(apiFilters.folderId) : null;
  }
}

function handleListFiltersUpdate(newFilters, options = {}) {
  const payload = newFilters && typeof newFilters === 'object' ? { ...newFilters } : {};
  const prevSignature = filtersPayloadSignature(listColumnFilters.value);
  const nextSignature = filtersPayloadSignature(payload);
  const filtersChanged = prevSignature !== nextSignature;

  suppressColumnFilterWatch = true;
  listColumnFilters.value = payload;
  applyColumnFiltersToDocumentState(payload);
  nextTick(() => {
    suppressColumnFilterWatch = false;
  });

  if (filtersChanged || options.forceFetch) {
    pagination.value.page = 1;
    void loadListOrSemantic({ page: 1 });
  }
}

function formatOwner(row) {
  const owner = row?.assignedTo;
  if (!owner || typeof owner !== 'object') return '—';
  return [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.email || '—';
}

function formatDate(value) {
  if (!value) return '—';
  return formatUserDateTime(value);
}

function formatVersion(version) {
  if (!version) return '—';
  return t('documents.versionLabel', { version });
}

function getActivityMessage(item) {
  const name = [item?.actorId?.firstName, item?.actorId?.lastName].filter(Boolean).join(' ') || '—';
  const doc = item?.documentId;
  const title = (typeof doc === 'object' ? doc?.title || doc?.documentNumber : '') || item?.metadata?.title || item?.metadata?.documentNumber || '';
  const action = String(item?.action || '').trim();
  const meta = item?.metadata || {};

  if (action === 'upload') return t('documents.activityUpload', { name, title });
  if (action === 'create') return t('documents.activityCreate', { name, title });
  if (action === 'update') {
    if (meta.action === 'external_link_check') {
      return t('documents.activityExternalLinkCheck', { name, title, status: meta.externalLinkStatus || 'unknown' });
    }
    if (meta.action === 'unlink') return t('documents.activityUnlink', { name, title });
    return t('documents.activityUpdate', { name, title });
  }
  if (action === 'version_change') {
    return t('documents.activityVersionChange', {
      name,
      title,
      version: meta.versionNumber || meta.restoredVersion || '—'
    });
  }
  if (action === 'delete') return t('documents.activityDelete', { name, title });
  if (action === 'share') return t('documents.activityShare', { name, title });
  if (action === 'reservation_created') return t('documents.activityReservationCreated', { name, title });
  if (action === 'reservation_released') return t('documents.activityReservationReleased', { name, title });
  if (action === 'reservation_expired') return t('documents.activityReservationExpired', { name, title });
  if (action === 'reservation_taken_over') return t('documents.activityReservationTakenOver', { name, title });
  if (action === 'presence_detected') return t('documents.activityPresenceDetected', { name, title });
  if (action === 'version_conflict_detected') return t('documents.activityConflictDetected', { name, title });
  if (action === 'version_conflict_resolved') return t('documents.activityConflictResolved', { name, title });
  if (action === 'version_conflict_cancelled') return t('documents.activityConflictCancelled', { name, title });
  if (action === 'portal_access_revoked') return t('documents.activityPortalAccessRevoked', { name, title });
  if (action === 'ownership_change') return t('documents.activityOwnershipChange', { name, title });
  if (action === 'preview') return t('documents.activityPreview', { name, title });
  if (action === 'download') return t('documents.activityDownload', { name, title });
  return t('documents.activityDefault', { name, title });
}

function getActivityTone(action) {
  const value = String(action || '').trim();
  if (value === 'delete') return 'text-red-600 dark:text-red-400';
  if (value === 'upload' || value === 'create') return 'text-green-600 dark:text-green-400';
  if (value === 'version_change') return 'text-indigo-600 dark:text-indigo-400';
  return 'text-gray-600 dark:text-gray-300';
}

function getFileTypeTone(fileType) {
  const type = String(fileType || '').toUpperCase();
  if (type === 'PDF') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  if (type === 'DOCX') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  if (type === 'XLSX') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  if (type === 'PPTX') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

function getKnowledgeFilters(overrides = {}) {
  return {
    page: pagination.value.page,
    limit: pagination.value.limit,
    search: searchQuery.value,
    folderId: selectedFolderId.value || '',
    tag: tagFilter.value || '',
    ...overrides
  };
}

function resolveListSearchTerm(overrides = {}) {
  if (overrides.search !== undefined) {
    return String(overrides.search ?? '').trim();
  }
  const toolbarTerm = searchQuery.value.trim();
  if (toolbarTerm) return toolbarTerm;
  // Column title filter is compiled to filterQuery — do not also send as $text search.
  if (extractSearchTermFromFilterQuery(listColumnFilters.value.filterQuery, ['title'])) {
    return '';
  }
  return resolveModuleColumnSearchTerm(
    {
      filterQuery: listColumnFilters.value.filterQuery,
      title: listColumnFilters.value.title
    },
    'documents'
  );
}

function getListFilters(overrides = {}) {
  const search = resolveListSearchTerm(overrides);
  const filterQuery = listColumnFilters.value.filterQuery;
  return {
    page: pagination.value.page,
    limit: pagination.value.limit,
    search,
    filterQuery: filterQuery ? String(filterQuery) : '',
    folderId: selectedFolderId.value || listColumnFilters.value.folderId || '',
    status: statusFilter.value || '',
    documentType: documentTypeFilter.value || '',
    fileType: fileTypeFilter.value || '',
    assignedTo: ownerFilter.value || '',
    tag: tagFilter.value || '',
    linkedModuleKey: linkedModuleFilter.value || '',
    linkedRecordId: linkedRecordIdFilter.value.trim() || '',
    favoritesOnly: favoritesOnlyFilter.value,
    recentOnly: recentOnlyFilter.value,
    sharedWithMe: sharedWithMeFilter.value,
    expiringOnly: expiringOnlyFilter.value,
    ...overrides
  };
}

const folderTreeSelectedId = computed(() => (
  selectedFolderId.value ? String(selectedFolderId.value) : 'root'
));

function getUserDisplayName(user) {
  if (!user || typeof user !== 'object') return '—';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || '—';
}

async function loadOwnerOptions() {
  try {
    const res = await apiClient.get('/users', {
      params: { limit: 200, page: 1, sortBy: 'firstName', sortOrder: 'asc' }
    });
    const rows = Array.isArray(res?.data) ? res.data : (res?.data?.data || res?.users || []);
    ownerOptions.value = rows.filter((user) => user?._id);
  } catch {
    ownerOptions.value = [];
  }
}

function clearQuickFilters() {
  favoritesOnlyFilter.value = false;
  recentOnlyFilter.value = false;
  sharedWithMeFilter.value = false;
  expiringOnlyFilter.value = false;
  documentTypeFilter.value = '';
}

function handleStatClick(statKey) {
  clearQuickFilters();
  statusFilter.value = '';
  documentTypeFilter.value = '';
  selectedDashboardStatKey.value = statKey || null;
  if (statKey === 'published') {
    statusFilter.value = 'published';
  } else if (statKey === 'drafts') {
    statusFilter.value = 'draft';
  } else if (statKey === 'pendingReview') {
    statusFilter.value = 'pending_review';
  } else if (statKey === 'expiringSoon') {
    expiringOnlyFilter.value = true;
  } else if (statKey === 'total') {
    selectedDashboardStatKey.value = 'total';
  }
  switchView('list');
  applyFilters();
}

async function handleFolderDashboardClick(folder) {
  if (!folder?._id) return;
  selectedFolderId.value = folder._id;
  switchView('folder');
  await ensureFolderTreeLoaded();
  await loadViewData();
}

function handleDocumentTypeClick(type) {
  if (!type) return;
  clearQuickFilters();
  statusFilter.value = '';
  documentTypeFilter.value = type;
  switchView('list');
  applyFilters();
}

function openAdvancedSearch() {
  switchView('list');
  searchMode.value = 'semantic';
}

function handleQuickAccess(card) {
  if (!card?.key) return;
  if (card.key === 'trash') {
    openTab('/trash?moduleKey=documents', { title: t('navigation.userTrash'), insertAdjacent: true });
    return;
  }
  if (card.key === 'favorites') {
    clearQuickFilters();
    favoritesOnlyFilter.value = true;
    statusFilter.value = '';
    switchView('list');
    applyFilters();
    return;
  }
  if (card.key === 'recent') {
    clearQuickFilters();
    recentOnlyFilter.value = true;
    statusFilter.value = '';
    switchView('list');
    applyFilters();
    return;
  }
  if (card.key === 'shared') {
    clearQuickFilters();
    sharedWithMeFilter.value = true;
    statusFilter.value = '';
    switchView('list');
    applyFilters();
    return;
  }
  if (card.key === 'drafts') {
    clearQuickFilters();
    statusFilter.value = 'draft';
    switchView('list');
    applyFilters();
    return;
  }
  if (card.key === 'pending') {
    clearQuickFilters();
    statusFilter.value = 'pending_review';
    switchView('list');
    applyFilters();
    return;
  }
  if (card.key === 'expiring') {
    clearQuickFilters();
    expiringOnlyFilter.value = true;
    statusFilter.value = '';
    switchView('list');
    applyFilters();
  }
}

async function handleToggleFavorite(doc, event) {
  event?.stopPropagation?.();
  if (!doc?._id) return;
  try {
    const result = await toggleFavorite(doc._id);
    if (!result?.success) {
      notifications.error(result?.message || t('documents.favoriteFailed'));
    }
  } catch (error) {
    notifications.error(error?.message || t('documents.favoriteFailed'));
  }
}

async function ensureFolderTreeLoaded() {
  if (foldersFullyLoaded.value) return;
  await fetchAllFolders();
  foldersFullyLoaded.value = true;
}

async function loadListOrSemantic(overrides = {}) {
  const activeSearch = resolveListSearchTerm(overrides);

  if (
    searchMode.value === 'semantic'
    && activeSearch
    && ['grid', 'folder'].includes(activeView.value)
  ) {
    await semanticSearchDocuments({
      q: activeSearch,
      page: overrides.page ?? pagination.value.page,
      limit: overrides.limit ?? pagination.value.limit
    });
    return;
  }
  await fetchDocuments(getListFilters(overrides));
}

async function loadFolderViewData() {
  await ensureFolderTreeLoaded();
  await loadListOrSemantic({
    folderId: selectedFolderId.value || '',
    page: pagination.value.page,
    limit: pagination.value.limit
  });
}

function handleGridFolderFilterChange(folderId) {
  selectedFolderId.value = folderId ? String(folderId) : null;
  loadViewData();
}

function handleFolderTreeSelect(folderId) {
  selectedFolderId.value = folderId === 'root' ? null : folderId;
  pagination.value.page = 1;
  loadFolderViewData();
}

async function loadViewData() {
  if (activeView.value === 'dashboard') {
    await fetchSummary();
    return;
  }
  if (activeView.value === 'knowledge') {
    await fetchKnowledgeBase(getKnowledgeFilters());
    return;
  }
  if (activeView.value === 'folder') {
    await loadFolderViewData();
    return;
  }
  if (selectedFolderId.value && (activeView.value === 'list' || activeView.value === 'grid')) {
    await ensureFolderTreeLoaded();
  }
  await loadListOrSemantic();
}

async function loadListData() {
  if (selectedFolderId.value) {
    await ensureFolderTreeLoaded();
  }
  await loadListOrSemantic();
}

function switchView(viewId) {
  activeView.value = viewId;
  if (viewId === 'folder') {
    void ensureFolderTreeLoaded();
  }
  if (viewId === 'knowledge') {
    captureKnowledgeBaseViewed({
      organization_id: authStore.user?.organizationId || authStore.organization?._id || undefined
    });
  }
}

function openActivityDocument(item) {
  const doc = item?.documentId;
  const docId = typeof doc === 'object' ? doc?._id : doc;
  if (!docId) return;
  const title = typeof doc === 'object' ? (doc.title || doc.documentNumber) : t('documents.pageTitle');
  openTab(`/documents/${docId}`, { title, insertAdjacent: true });
}

function openUploadPicker() {
  fileInputRef.value?.click();
}

function isPreviewableMime(mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  return mime.startsWith('image/') || mime === 'application/pdf';
}

async function processUploadFiles(files) {
  const fileList = Array.from(files || []);
  if (!fileList.length || !canCreate.value) return;

  try {
    const results = await uploadDocuments(fileList, {
      folderId: selectedFolderId.value || undefined
    });
    const failed = results.filter((result) => !result?.success);
    if (failed.length) {
      const first = failed[0];
      if (first?.code === 'DOCUMENT_IN_TRASH') {
        notifications.error(
          t('documents.uploadInTrash', {
            title: first.title || fileList[0]?.name || '',
            documentNumber: first.documentNumber || ''
          })
        );
      } else if (first?.code === 'DOCUMENT_ALREADY_EXISTS') {
        const uploadAsVersion = await confirmAction(t('documents.uploadAsNewVersionConfirm', {
            title: first.title || fileList[0]?.name || '',
            documentNumber: first.documentNumber || ''
          }));
        if (uploadAsVersion) {
          const retry = await uploadDocuments(fileList, {
            folderId: selectedFolderId.value || undefined,
            duplicateAction: 'new_version'
          });
          if (retry.some((result) => result?.success)) {
            notifications.success(t('documents.versionUploadSuccess'));
            await loadViewData();
            return;
          }
        }
        notifications.error(
          t('documents.uploadAlreadyExists', {
            title: first.title || fileList[0]?.name || '',
            documentNumber: first.documentNumber || ''
          })
        );
      } else {
        notifications.error(first?.message || t('documents.uploadFailed'));
      }
    }
    if (results.some((result) => result?.success)) {
      notifications.success(t('documents.uploadSuccess'));
      captureDocumentUploaded({ count: results.filter((result) => result?.success).length });
      await loadViewData();
    }
  } catch (error) {
    notifications.error(error?.message || t('documents.uploadFailed'));
  }
}

async function handleFileSelected(event) {
  await processUploadFiles(event.target?.files || []);
  if (event.target) event.target.value = '';
}

function handleDragOver() {
  if (canCreate.value) isDragging.value = true;
}

function handleDragLeave() {
  isDragging.value = false;
}

async function handleDrop(event) {
  isDragging.value = false;
  if (!canCreate.value) return;
  await processUploadFiles(event.dataTransfer?.files || []);
}

function openDocument(doc, event) {
  if (!doc?._id) return;
  const openInBackground = event && (event.button === 1 || event.metaKey || event.ctrlKey);
  openTab(`/documents/${doc._id}`, {
    title: doc.title || t('documents.pageTitle'),
    background: openInBackground,
    insertAdjacent: true
  });
}

async function handlePreview(doc) {
  if (!doc?._id) return;
  previewLoading.value = true;
  showPreviewModal.value = true;
  previewState.value = { title: doc.title || '', url: '', mimeType: doc.mimeType || '' };
  try {
    const data = await getPreviewUrl(doc._id);
    if (isPreviewableMime(data?.mimeType)) {
      previewState.value = {
        title: doc.title || '',
        url: data.url,
        mimeType: data.mimeType || ''
      };
    } else if (data?.url) {
      window.open(data.url, '_blank', 'noopener,noreferrer');
      showPreviewModal.value = false;
    }
  } catch (error) {
    showPreviewModal.value = false;
    notifications.error(error?.message || t('documents.previewFailed'));
  } finally {
    previewLoading.value = false;
  }
}

async function handleDownload(doc) {
  if (!doc?._id) return;
  try {
    const data = await getDownloadUrl(doc._id);
    if (data?.url) {
      window.open(data.url, '_blank', 'noopener,noreferrer');
    }
  } catch (error) {
    notifications.error(error?.message || t('documents.downloadFailed'));
  }
}

async function handleCreateFolderFromTree({ name, parentFolderId }) {
  if (!name?.trim()) return;
  creatingFolder.value = true;
  try {
    const result = await createFolder(name.trim(), parentFolderId || null);
    if (result?.success) {
      notifications.success(t('documents.folderCreateSuccess'));
      await fetchAllFolders();
      foldersFullyLoaded.value = true;
      await loadFolderViewData();
      if (parentFolderId) {
        folderTreeRef.value?.expandFolder?.(parentFolderId);
      }
      folderTreeRef.value?.cancelCreate?.();
    } else {
      notifications.error(result?.message || t('documents.folderCreateFailed'));
    }
  } catch (error) {
    notifications.error(error?.message || t('documents.folderCreateFailed'));
  } finally {
    creatingFolder.value = false;
  }
}

function handleDeleteFolderFromTree(folder) {
  if (!folder?._id || !canDelete.value) return;
  folderPendingDelete.value = folder;
  showFolderDeleteModal.value = true;
}

function closeFolderDeleteModal() {
  if (deletingFolder.value) return;
  showFolderDeleteModal.value = false;
  folderPendingDelete.value = null;
}

async function confirmDeleteFolder() {
  const folder = folderPendingDelete.value;
  if (!folder?._id) return;

  deletingFolder.value = true;
  deletingFolderId.value = String(folder._id);
  try {
    const result = await deleteFolder(folder._id);
    if (result?.success) {
      const unfiledCount = Number(result?.data?.unfiledDocumentCount || 0);
      notifications.success(
        unfiledCount > 0
          ? t('documents.folderDeleteSuccessWithDocuments', { count: unfiledCount })
          : t('documents.folderDeleteSuccess')
      );

      const deletedIds = new Set((result?.data?.deletedFolderIds || []).map(String));
      if (selectedFolderId.value && deletedIds.has(String(selectedFolderId.value))) {
        selectedFolderId.value = null;
      }

      await fetchAllFolders();
      foldersFullyLoaded.value = true;
      await loadViewData();
      showFolderDeleteModal.value = false;
      folderPendingDelete.value = null;
    } else {
      notifications.error(result?.message || t('documents.folderDeleteFailed'));
    }
  } catch (error) {
    notifications.error(error?.message || t('documents.folderDeleteFailed'));
  } finally {
    deletingFolder.value = false;
    deletingFolderId.value = null;
  }
}

function handleGridPageChange(page) {
  pagination.value.page = page;
  loadListOrSemantic({ page });
}

function handleGridPageNext() {
  if (pagination.value.page >= pagination.value.totalPages) return;
  handleGridPageChange(pagination.value.page + 1);
}

function handleGridPagePrevious() {
  if (pagination.value.page <= 1) return;
  handleGridPageChange(pagination.value.page - 1);
}

async function handleDelete(row) {
  if (!row?._id) return;
  try {
    const result = await deleteDocument(row._id);
    if (result?.success) {
      notifications.success(t('documents.deleteSuccess'));
      await loadViewData();
    } else {
      notifications.error(result?.message || t('documents.deleteFailed'));
    }
  } catch (error) {
    notifications.error(error?.message || t('documents.deleteFailed'));
  }
}

function handlePaginationUpdate(p) {
  pagination.value.page = p.currentPage;
  pagination.value.limit = p.limit || pagination.value.limit;
  if (activeView.value === 'knowledge') {
    fetchKnowledgeBase(getKnowledgeFilters());
    return;
  }
  if (activeView.value === 'folder') {
    loadFolderViewData();
    return;
  }
  loadListOrSemantic();
}

function applyFilters() {
  pagination.value.page = 1;
  if (activeView.value === 'knowledge') {
    fetchKnowledgeBase(getKnowledgeFilters({ page: 1 }));
    return;
  }
  loadListOrSemantic({ page: 1 });
}

function handleSearchQueryUpdate(query) {
  const term = String(query ?? '').trim();
  searchQuery.value = term;
  if (term && getColumnTitleFilterTerm()) {
    clearColumnTitleFilter();
  }
  pagination.value.page = 1;
  if (activeView.value === 'knowledge') {
    void fetchKnowledgeBase(getKnowledgeFilters({ page: 1, search: term }));
    return;
  }
  void loadListOrSemantic({ page: 1, search: term });
}

function handleSearchQuerySync(query) {
  searchQuery.value = String(query ?? '');
}

let pageSearchDebounceTimer = null;
function handlePageSearchInput() {
  if (activeView.value === 'list') return;
  clearTimeout(pageSearchDebounceTimer);
  pageSearchDebounceTimer = setTimeout(() => {
    applyFilters();
  }, 500);
}

watch(searchMode, () => {
  if (activeView.value === 'list' || activeView.value === 'grid' || activeView.value === 'folder' || activeView.value === 'knowledge') {
    applyFilters();
  }
});

watch([statusFilter, fileTypeFilter, ownerFilter, linkedModuleFilter, tagFilter, documentTypeFilter], () => {
  if (suppressColumnFilterWatch) return;
  favoritesOnlyFilter.value = false;
  recentOnlyFilter.value = false;
  if (activeView.value === 'list' || activeView.value === 'grid' || activeView.value === 'folder' || activeView.value === 'knowledge') {
    applyFilters();
  }
});

watch(linkedModuleFilter, () => {
  linkedRecordIdFilter.value = '';
  linkedRecordLabel.value = '';
});

let linkedRecordFilterTimer = null;
watch(linkedRecordIdFilter, () => {
  if (activeView.value !== 'list' && activeView.value !== 'grid' && activeView.value !== 'folder' && activeView.value !== 'knowledge') return;
  clearTimeout(linkedRecordFilterTimer);
  linkedRecordFilterTimer = setTimeout(() => {
    applyFilters();
  }, 200);
});

watch(activeView, () => {
  loadViewData();
});

function getDocumentSystemViews() {
  const moduleLabel = t('navigation.moduleDocuments');
  const views = [
    {
      id: 'all',
      label: resolveListViewLabel('documents', 'all', `All ${moduleLabel}`, t, te),
      filters: {},
      isDefault: true
    }
  ];
  if (authStore.user?._id) {
    views.push({
      id: 'assigned-to-me',
      label: resolveListViewLabel('documents', 'assigned-to-me', `My ${moduleLabel}`, t, te),
      filters: { assignedTo: 'me' }
    });
  }
  return views;
}

function resolveDocumentSavedViewFilters(view) {
  if (!view) return {};

  const config = view.config;
  let viewFilters = {};

  if (config?.filters && Object.keys(config.filters).length > 0) {
    viewFilters = { ...config.filters };
  } else if (view.filters) {
    viewFilters = { ...view.filters };
  }

  if (viewFilters.assignedTo === 'me' && authStore.user?._id) {
    viewFilters = { ...viewFilters, assignedTo: authStore.user._id };
  }

  return viewFilters;
}

function applySavedViewFilters(viewFilters = {}) {
  clearQuickFilters();
  listColumnFilters.value = toListViewFilterUi(viewFilters);
  statusFilter.value = viewFilters.status || '';
  documentTypeFilter.value = viewFilters.documentType || '';
  fileTypeFilter.value = viewFilters.fileType || '';
  ownerFilter.value = viewFilters.assignedTo || '';
  tagFilter.value = viewFilters.tag || '';
  selectedFolderId.value = viewFilters.folderId ? String(viewFilters.folderId) : null;
  linkedModuleFilter.value = viewFilters.linkedModuleKey || '';
  linkedRecordIdFilter.value = viewFilters.linkedRecordId || '';
  favoritesOnlyFilter.value = Boolean(viewFilters.favoritesOnly);
  recentOnlyFilter.value = Boolean(viewFilters.recentOnly);
  sharedWithMeFilter.value = Boolean(viewFilters.sharedWithMe);
  expiringOnlyFilter.value = Boolean(viewFilters.expiringOnly);
}

async function initListSavedViews() {
  const systemViews = getDocumentSystemViews();
  const customViews = await fetchCustomSavedViews('documents', authStore.user?._id);
  savedViews.value = [...systemViews, ...customViews];

  const defaultView = systemViews.find((view) => view.isDefault) || systemViews[0];
  if (!defaultView) return;

  const defaultViewStorageKey = 'arivu-listview-documents-default-view';
  try {
    const userDefaultViewId = localStorage.getItem(defaultViewStorageKey);
    defaultViewId.value = userDefaultViewId || null;
    const savedActiveViewId = loadActiveSavedViewId('documents', authStore.user?._id);
    const viewToLoad = (savedActiveViewId && savedViews.value.find((view) => view.id === savedActiveViewId))
      ? savedActiveViewId
      : (userDefaultViewId && savedViews.value.find((view) => view.id === userDefaultViewId))
        ? userDefaultViewId
        : defaultView.id;
    activeSavedViewId.value = viewToLoad;
    const savedView = savedViews.value.find((view) => view.id === viewToLoad);
    if (savedView) {
      applySavedViewFilters(resolveDocumentSavedViewFilters(savedView));
    }
  } catch (error) {
    console.warn('[Documents] Failed to load saved view:', error);
    activeSavedViewId.value = defaultView.id;
    applySavedViewFilters({});
  }
}

async function handleSavedViewSelected(view) {
  activeSavedViewId.value = view?.id || null;
  if (!view) {
    applySavedViewFilters({});
    pagination.value.page = 1;
    await loadViewData();
    return;
  }
  applySavedViewFilters(resolveDocumentSavedViewFilters(view));
  pagination.value.page = 1;
  await loadViewData();
}

async function handleSavedViewsUpdated(customViews) {
  savedViews.value = [...getDocumentSystemViews(), ...customViews];
  await persistCustomSavedViews('documents', authStore.user?._id, customViews);
}

function handleSetDefaultView(viewId) {
  if (!viewId) return;
  const defaultViewStorageKey = 'arivu-listview-documents-default-view';
  try {
    localStorage.setItem(defaultViewStorageKey, viewId);
    defaultViewId.value = viewId;
  } catch (error) {
    console.warn('[Documents] Failed to save default view:', error);
  }
}

function handleRemoveListActiveFilter(filterId) {
  switch (filterId) {
    case '__search__':
      searchQuery.value = '';
      break;
    case 'title':
      clearColumnTitleFilter();
      break;
    case 'folderId':
      selectedFolderId.value = null;
      {
        const next = { ...listColumnFilters.value };
        delete next.folderId;
        listColumnFilters.value = next;
      }
      break;
    case 'status':
      statusFilter.value = '';
      {
        const next = { ...listColumnFilters.value };
        delete next.status;
        listColumnFilters.value = next;
      }
      break;
    case 'fileType':
      fileTypeFilter.value = '';
      break;
    case 'assignedTo':
      ownerFilter.value = '';
      {
        const next = { ...listColumnFilters.value };
        delete next.assignedTo;
        listColumnFilters.value = next;
      }
      break;
    case 'tag':
    case 'tags':
      tagFilter.value = '';
      {
        const next = { ...listColumnFilters.value };
        delete next.tags;
        listColumnFilters.value = next;
      }
      break;
    case 'documentType':
      documentTypeFilter.value = '';
      {
        const next = { ...listColumnFilters.value };
        delete next.documentType;
        listColumnFilters.value = next;
      }
      break;
    case 'linkedModuleKey':
      linkedModuleFilter.value = '';
      linkedRecordIdFilter.value = '';
      linkedRecordLabel.value = '';
      break;
    case 'linkedRecordId':
      linkedRecordIdFilter.value = '';
      linkedRecordLabel.value = '';
      break;
    case 'favoritesOnly':
      favoritesOnlyFilter.value = false;
      break;
    case 'recentOnly':
      recentOnlyFilter.value = false;
      break;
    case 'sharedWithMe':
      sharedWithMeFilter.value = false;
      break;
    case 'expiringOnly':
      expiringOnlyFilter.value = false;
      break;
    default:
      break;
  }
  pagination.value.page = 1;
  void loadViewData();
}

function handleClearListActiveFilters() {
  const activeViewEntry = savedViews.value.find((view) => view.id === activeSavedViewId.value);
  applySavedViewFilters(activeViewEntry ? resolveDocumentSavedViewFilters(activeViewEntry) : {});
  selectedFolderId.value = null;
  searchQuery.value = '';
  pagination.value.page = 1;
  void loadViewData();
}

watch(() => activeSavedViewId.value, (newValue) => {
  saveActiveSavedViewId('documents', authStore.user?._id, newValue);
});

function applyRouteQueryFilters() {
  const status = String(route.query.status || '').trim();
  const expiringOnly = route.query.expiringOnly === '1' || route.query.expiringOnly === 'true';
  if (status) {
    statusFilter.value = status;
    activeView.value = 'list';
  }
  if (expiringOnly) {
    expiringOnlyFilter.value = true;
    activeView.value = 'list';
  }
}

onMounted(async () => {
  isTouchDevice.value = typeof window !== 'undefined'
    && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  isFirstDocumentsVisit.value = !hasModuleVisit('documents', 'PLATFORM');
  captureDocumentsModuleVisited({
    organization_id: authStore.user?.organizationId || authStore.organization?._id || undefined
  });
  void recordModuleVisit('documents', 'PLATFORM');
  await initListSavedViews();
  applyRouteQueryFilters();
  await Promise.all([loadOwnerOptions(), loadViewData()]);
  if ((summary.value?.total ?? 0) === 0 && (pagination.value.total ?? 0) === 0) {
    captureFirstTimeEmptyStateSeen('documents', 'PLATFORM', {
      organizationId: authStore.user?.organizationId || authStore.organization?._id || null
    });
  }
});
</script>

<template>
  <div
    class="relative mx-auto w-full"
    @dragover.prevent="handleDragOver"
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <div
      v-if="isDragging && canCreate"
      class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-50/80 dark:border-indigo-500 dark:bg-indigo-950/50"
    >
      <div class="text-center">
        <ArrowUpTrayIcon class="mx-auto h-10 w-10 text-indigo-600 dark:text-indigo-400" />
        <p class="mt-2 text-sm font-medium text-indigo-700 dark:text-indigo-300">{{ t('documents.dropToUpload') }}</p>
      </div>
    </div>

    <div
      v-if="uploading"
      class="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-800 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-200"
    >
      {{ t('documents.uploading') }}
    </div>
    <div class="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{{ t('documents.pageTitle') }}</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('documents.pageDescription') }}</p>
      </div>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div v-if="activeView !== 'list'" class="relative min-w-[280px]">
          <input
            v-model="searchQuery"
            type="search"
            :placeholder="searchMode === 'semantic' ? t('documents.semanticSearchPlaceholder') : t('documents.searchPlaceholder')"
            class="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            @input="handlePageSearchInput"
          />
          <MagnifyingGlassIcon
            v-if="searchMode === 'keyword'"
            class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400"
          />
          <SparklesIcon
            v-else
            class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-indigo-500"
          />
        </div>
        <div
          v-if="showFilters"
          class="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-900"
          role="group"
          :aria-label="t('documents.searchModeLabel')"
        >
          <button
            type="button"
            class="rounded-md px-2.5 py-1.5 text-xs font-medium"
            :class="searchMode === 'keyword' ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white' : 'text-gray-600 dark:text-gray-400'"
            @click="searchMode = 'keyword'"
          >
            {{ t('documents.searchModeKeyword') }}
          </button>
          <button
            type="button"
            class="rounded-md px-2.5 py-1.5 text-xs font-medium"
            :class="searchMode === 'semantic' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200' : 'text-gray-600 dark:text-gray-400'"
            @click="searchMode = 'semantic'"
          >
            {{ t('documents.searchModeSemantic') }}
          </button>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            v-if="canCreate"
            type="button"
            class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 sm:w-auto"
            :class="isTouchDevice ? 'min-h-11' : ''"
            @click="openUploadPicker"
          >
            <ArrowUpTrayIcon class="h-4 w-4" />
            {{ t('documents.upload') }}
          </button>
          <button
            v-if="canCreate"
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            @click="showCreateExternalLinkDrawer = true"
          >
            <LinkIcon class="h-4 w-4" />
            {{ t('documents.addExternalLink') }}
          </button>
          <button
            v-if="canCreate"
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            @click="showCreateDocumentDrawer = true"
          >
            <PlusIcon class="h-4 w-4" />
            {{ t('documents.newDocument') }}
          </button>
        </div>
      </div>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      class="hidden"
      multiple
      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.zip"
      @change="handleFileSelected"
    />

    <div class="mb-5 border-b border-gray-200 dark:border-gray-700">
      <nav class="-mb-px flex flex-wrap gap-4">
        <button
          v-for="tab in viewTabs"
          :key="tab.id"
          type="button"
          class="inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors"
          :class="activeView === tab.id
            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
          @click="switchView(tab.id)"
        >
          <component :is="tab.icon" class="h-4 w-4" />
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <div v-if="showFilters" class="mb-5 flex flex-wrap items-center gap-3">
      <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <span>{{ t('documents.filterStatus') }}</span>
        <select
          v-model="statusFilter"
          class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option v-for="opt in statusFilterOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </label>
      <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <span>{{ t('documents.filterFileType') }}</span>
        <select
          v-model="fileTypeFilter"
          class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option v-for="opt in fileTypeFilterOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </label>
      <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <span>{{ t('documents.filterOwner') }}</span>
        <select
          v-model="ownerFilter"
          class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">{{ t('documents.filterAllOwners') }}</option>
          <option v-for="user in ownerOptions" :key="user._id" :value="user._id">
            {{ getUserDisplayName(user) }}
          </option>
        </select>
      </label>
      <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <span>{{ t('documents.filterTag') }}</span>
        <input
          v-model="tagFilter"
          type="text"
          :placeholder="t('documents.filterTagPlaceholder')"
          class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
      </label>
      <label v-if="folders.length" class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <span class="shrink-0">{{ t('documents.filterFolder') }}</span>
        <HeadlessSelect
          :model-value="selectedFolderId || ''"
          :options="folderColumnOptions"
          allow-empty
          searchable
          teleport
          :empty-label="t('documents.allDocuments')"
          button-class="min-w-[10rem] rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          @update:model-value="handleGridFolderFilterChange"
        />
      </label>
      <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <span>{{ t('documents.filterLinkedModule') }}</span>
        <select
          v-model="linkedModuleFilter"
          class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option v-for="opt in linkedModuleFilterOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </label>
      <label v-if="linkedModuleFilter" class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <span>{{ t('documents.filterLinkedRecord') }}</span>
        <DocumentLinkedRecordFilter
          :module-key="linkedModuleFilter"
          v-model="linkedRecordIdFilter"
          v-model:selected-label="linkedRecordLabel"
        />
      </label>
    </div>

    <div v-if="activeView === 'dashboard'" class="space-y-6">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <button
          v-for="stat in statsConfig"
          :key="stat.key"
          type="button"
          class="rounded-xl border p-4 text-left shadow-sm transition"
          :class="selectedDashboardStatKey === stat.key
            ? 'border-indigo-400 bg-indigo-50/70 dark:border-indigo-500 dark:bg-indigo-950/30'
            : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/20'"
          :aria-pressed="selectedDashboardStatKey === stat.key ? 'true' : 'false'"
          @click="handleStatClick(stat.key)"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ stat.label }}</p>
              <p class="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                {{ summaryLoading ? '—' : statistics[stat.key] }}
              </p>
            </div>
            <div class="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
              <component :is="stat.icon" class="h-5 w-5" />
            </div>
          </div>
        </button>
      </div>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div class="xl:col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('documents.recentDocuments') }}</h2>
            <button type="button" class="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400" @click="switchView('list')">
              {{ t('documents.viewAll') }}
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('documents.columnName') }}</th>
                  <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('documents.columnType') }}</th>
                  <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('documents.columnStatus') }}</th>
                  <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('documents.columnModified') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-if="!recentDocuments.length">
                  <td colspan="4" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">{{ t('documents.emptyMessage') }}</td>
                </tr>
                <tr
                  v-for="doc in recentDocuments"
                  :key="doc._id"
                  class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40"
                  @click="openDocument(doc, $event)"
                >
                  <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{{ doc.title }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ formatDocumentType(doc.documentType) }}</td>
                  <td class="px-4 py-3">
                    <BadgeCell :value="formatStatus(doc.status)" :variant-map="statusVariantMap" />
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{{ formatDate(doc.updatedAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('documents.quickAccess') }}</h2>
          </div>
          <div class="grid grid-cols-2 gap-3 p-4">
            <button
              v-for="card in quickAccessCards"
              :key="card.key"
              type="button"
              class="rounded-lg border border-gray-200 p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-gray-700 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/20"
              @click="handleQuickAccess(card)"
            >
              <component :is="card.icon" class="mb-2 h-5 w-5 text-gray-500" />
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ card.label }}</p>
              <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ card.count }}</p>
            </button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('documents.foldersTitle') }}</h2>
            <button type="button" class="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400" @click="switchView('folder')">
              {{ t('documents.viewAll') }}
            </button>
          </div>
          <div class="grid grid-cols-2 gap-3 p-4">
            <button
              v-for="folder in folders"
              :key="folder._id"
              type="button"
              class="rounded-lg border border-gray-200 p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-gray-700 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/20"
              @click="handleFolderDashboardClick(folder)"
            >
              <FolderIcon class="mb-2 h-5 w-5 text-amber-500" />
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ folder.name }}</p>
            </button>
            <p v-if="!folders.length" class="col-span-2 text-sm text-gray-500 dark:text-gray-400">{{ t('documents.emptyFolderMessage') }}</p>
          </div>
        </div>

        <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('documents.documentsByType') }}</h2>
          <div class="mt-4 space-y-2">
            <button
              v-for="row in summary?.byType || []"
              :key="row.type"
              type="button"
              class="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition hover:bg-indigo-50/60 dark:hover:bg-indigo-950/20"
              @click="handleDocumentTypeClick(row.type)"
            >
              <span class="text-gray-600 dark:text-gray-300">{{ formatDocumentType(row.type) }}</span>
              <span class="font-medium text-gray-900 dark:text-white">{{ row.count }}</span>
            </button>
            <p v-if="!(summary?.byType || []).length" class="text-sm text-gray-500 dark:text-gray-400">{{ t('documents.emptyMessage') }}</p>
          </div>
        </div>

        <div class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('documents.recentActivity') }}</h2>
          </div>
          <div class="divide-y divide-gray-200 dark:divide-gray-700">
            <button
              v-for="item in recentActivity"
              :key="item._id"
              type="button"
              class="w-full px-4 py-3 text-left text-sm text-gray-600 transition hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-gray-800/40"
              :disabled="!item.documentId"
              @click="openActivityDocument(item)"
            >
              {{ getActivityMessage(item) }}
              <div class="mt-1 text-xs text-gray-400">{{ formatDate(item.timestamp) }}</div>
            </button>
            <p v-if="!recentActivity.length" class="px-4 py-8 text-sm text-gray-500 dark:text-gray-400">{{ t('documents.emptyMessage') }}</p>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
        <div class="flex items-start gap-2">
          <InformationCircleIcon class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{ t('documents.searchTip') }} <button type="button" class="font-medium underline" @click="openAdvancedSearch">{{ t('documents.advancedSearch') }}</button></span>
        </div>
      </div>
    </div>

    <DocumentsListView
      v-else-if="activeView === 'list'"
      ref="listViewRef"
      :title="t('documents.pageTitle')"
      :search-placeholder="t('documents.searchPlaceholder')"
      :data="documents"
      :columns="columns"
      :loading="loading"
      :pagination="{ currentPage: pagination.page, totalPages: pagination.totalPages, totalRecords: pagination.total, limit: pagination.limit }"
      table-id="documents-table"
      :empty-title="listEmptyTitle"
      :empty-message="listEmptyMessage"
      :parent-search-query="searchQuery"
      show-search-toolbar
      :saved-views="displaySavedViews"
      :active-saved-view-id="activeSavedViewId"
      :default-view-id="defaultViewId"
      :external-filters="listColumnFilters"
      :active-filter-chips="listActiveFilterChips"
      :is-favorite="isFavorite"
      :format-document-type="formatDocumentType"
      :format-status="formatStatus"
      :format-owner="formatOwner"
      :format-date="formatDate"
      :format-version="formatVersion"
      :status-variant-map="statusVariantMap"
      @row-click="openDocument"
      @edit="openDocument"
      @delete="handleDelete"
      @search-submit="handleSearchQueryUpdate"
      @update:search-query="handleSearchQuerySync"
      @update:filters="handleListFiltersUpdate"
      @update:pagination="handlePaginationUpdate"
      @fetch="loadListData"
      @toggle-favorite="handleToggleFavorite"
      @saved-view-selected="handleSavedViewSelected"
      @saved-views-updated="handleSavedViewsUpdated"
      @set-default-view="handleSetDefaultView"
      @remove-active-filter="handleRemoveListActiveFilter"
      @clear-active-filters="handleClearListActiveFilters"
    />

    <div v-else-if="activeView === 'grid'" class="space-y-4">
      <div
        v-if="loading"
        class="documents-grid"
      >
        <div v-for="n in 12" :key="n" class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div class="aspect-[4/3] animate-pulse bg-gray-100 dark:bg-gray-800" />
          <div class="space-y-2 p-3">
            <div class="h-4 w-4/5 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
            <div class="h-3 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>
      </div>
      <div v-else-if="!documents.length" class="rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
        <DocumentDuplicateIcon class="mx-auto h-10 w-10 text-gray-400" />
        <h3 class="mt-3 text-lg font-medium text-gray-900 dark:text-white">{{ listEmptyTitle }}</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ listEmptyMessage }}</p>
      </div>
      <template v-else>
        <div class="documents-grid">
          <DocumentGridCard
            v-for="doc in documents"
            :key="doc._id"
            :doc="doc"
            :favorite="isFavorite(doc._id)"
            :get-preview-url="getPreviewUrl"
            :format-document-type="formatDocumentType"
            :format-status="formatStatus"
            :status-variant-map="statusVariantMap"
            :get-file-type-tone="getFileTypeTone"
            @click="openDocument(doc, $event)"
            @toggle-favorite="handleToggleFavorite(doc, $event)"
            @preview="handlePreview(doc)"
            @download="handleDownload(doc)"
          />
        </div>

        <div
          v-if="pagination.totalPages > 1"
          class="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <button
            type="button"
            class="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700 enabled:hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
            :disabled="pagination.page <= 1 || loading"
            @click="handleGridPagePrevious"
          >
            {{ t('documents.timelinePrevious') }}
          </button>
          <span class="text-gray-500 dark:text-gray-400">
            {{ t('documents.timelinePage', { page: pagination.page, total: pagination.totalPages }) }}
          </span>
          <button
            type="button"
            class="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700 enabled:hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
            :disabled="pagination.page >= pagination.totalPages || loading"
            @click="handleGridPageNext"
          >
            {{ t('documents.timelineNext') }}
          </button>
        </div>
      </template>
    </div>

    <div v-else-if="activeView === 'knowledge'" class="space-y-4">
      <div class="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('documents.knowledgeBaseTitle') }}</h2>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('documents.knowledgeBaseDescription') }}</p>
      </div>

      <ListView
        skip-mount-fetch
        :title="t('documents.knowledgeBaseTitle')"
        module-key="documents"
        :search-placeholder="t('documents.searchPlaceholder')"
        :data="documents"
        :columns="columns"
        :loading="loading"
        :pagination="{ currentPage: pagination.page, totalPages: pagination.totalPages, totalRecords: pagination.total, limit: pagination.limit }"
        table-id="documents-knowledge-table"
        row-key="_id"
        :empty-title="knowledgeEmptyTitle"
        :empty-message="knowledgeEmptyMessage"
        :show-create="false"
        :show-import="false"
        :show-export="false"
        :show-stats="false"
        hide-page-header
        hide-search-toolbar
        :parent-search-query="searchQuery"
        @row-click="openDocument"
        @edit="openDocument"
        @delete="handleDelete"
        @update:search-query="handleSearchQuerySync"
        @update:pagination="handlePaginationUpdate"
        @fetch="() => fetchKnowledgeBase(getKnowledgeFilters())"
      >
        <template #cell-title="{ row }">
          <div class="flex min-w-0 items-center gap-2">
            <DocumentTypeIcon :doc="row" />
            <span class="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-white">{{ row.title }}</span>
          </div>
        </template>
        <template #cell-status="{ row }">
          <BadgeCell :value="formatStatus(row.status)" :variant-map="statusVariantMap" />
        </template>
        <template #cell-documentType="{ row }">
          {{ formatDocumentType(row.documentType) }}
        </template>
        <template #cell-tags="{ row }">
          <span v-if="!row.tags?.length" class="text-gray-400">—</span>
          <span v-else class="text-xs text-gray-600 dark:text-gray-300">{{ row.tags.join(', ') }}</span>
        </template>
        <template #cell-updatedAt="{ row }">
          {{ formatDate(row.updatedAt) }}
        </template>
      </ListView>
    </div>

    <div
      v-else-if="activeView === 'folder'"
      class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]"
    >
      <DocumentFolderTree
        ref="folderTreeRef"
        :folders="folders"
        :selected-folder-id="folderTreeSelectedId"
        :loading="loading && !folders.length"
        :can-create="canCreate"
        :can-delete="canDelete"
        :creating-folder="creatingFolder"
        :deleting-folder-id="deletingFolderId"
        @select-folder="handleFolderTreeSelect"
        @create-folder="handleCreateFolderFromTree"
        @delete-folder="handleDeleteFolderFromTree"
      />
      <DocumentFolderBrowsePane
        :folders="folders"
        :documents="documents"
        :selected-folder-id="folderTreeSelectedId"
        :loading="loading"
        :list-title="t('documents.folderBrowseAllFiles')"
        :search-placeholder="t('documents.searchPlaceholder')"
        :columns="columns"
        :pagination="{ currentPage: pagination.page, totalPages: pagination.totalPages, totalRecords: pagination.total, limit: pagination.limit }"
        table-id="documents-folder-table"
        :empty-title="listEmptyTitle"
        :empty-message="listEmptyMessage"
        :parent-search-query="searchQuery"
        show-search-toolbar
        :external-filters="listColumnFilters"
        :active-filter-chips="listActiveFilterChips"
        :is-favorite="isFavorite"
        :format-document-type="formatDocumentType"
        :format-status="formatStatus"
        :format-owner="formatOwner"
        :format-date="formatDate"
        :format-version="formatVersion"
        :status-variant-map="statusVariantMap"
        @select-folder="handleFolderTreeSelect"
        @row-click="openDocument"
        @edit="openDocument"
        @delete="handleDelete"
        @fetch="loadFolderViewData"
        @update:pagination="handlePaginationUpdate"
        @update:search-query="handleSearchQuerySync"
        @search-submit="handleSearchQueryUpdate"
        @update:filters="handleListFiltersUpdate"
        @toggle-favorite="handleToggleFavorite"
        @remove-active-filter="handleRemoveListActiveFilter"
        @clear-active-filters="handleClearListActiveFilters"
      />
    </div>

    <Dialog :open="showPreviewModal" class="relative z-50" @close="showPreviewModal = false">
      <div class="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
          <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <DialogTitle class="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {{ previewState.title }}
            </DialogTitle>
            <button
              type="button"
              class="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              @click="showPreviewModal = false"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>
          <div class="min-h-0 flex-1 bg-gray-50 dark:bg-gray-950">
            <div v-if="previewLoading" class="flex h-full items-center justify-center text-sm text-gray-500">
              {{ t('documents.previewLoading') }}
            </div>
            <iframe
              v-else-if="previewState.mimeType === 'application/pdf'"
              :src="previewState.url"
              class="h-full w-full border-0"
              :title="previewState.title"
            />
            <img
              v-else-if="previewState.url && String(previewState.mimeType || '').startsWith('image/')"
              :src="previewState.url"
              :alt="previewState.title"
              class="mx-auto h-full max-h-full w-auto object-contain"
            />
          </div>
        </DialogPanel>
      </div>
    </Dialog>

    <CreateDocumentDrawer
      :is-open="showCreateDocumentDrawer"
      @close="showCreateDocumentDrawer = false"
      @created="loadViewData"
    />
    <CreateExternalLinkDrawer
      :is-open="showCreateExternalLinkDrawer"
      :folder-id="selectedFolderId || ''"
      @close="showCreateExternalLinkDrawer = false"
      @created="loadViewData"
    />

    <DeleteConfirmationModal
      :show="showFolderDeleteModal"
      :record-name="folderPendingDelete?.name || ''"
      record-type="folder"
      :deleting="deletingFolder"
      @close="closeFolderDeleteModal"
      @confirm="confirmDeleteFolder"
    />
  </div>
</template>

<style scoped>
.documents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr));
  gap: 0.875rem;
}

@media (min-width: 640px) {
  .documents-grid {
    grid-template-columns: repeat(auto-fill, minmax(12.75rem, 1fr));
    gap: 1rem;
  }
}

@media (min-width: 1024px) {
  .documents-grid {
    grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr));
  }
}
</style>
