<template>
  <div
    class="case-record-page-root flex min-h-0 flex-1 flex-col overflow-hidden"
    :class="embed ? 'w-full min-w-0' : 'h-full'"
  >
    <RecordPageShell
      :loading="loading"
      :show-loading="embed"
      :error="error"
      :loading-message="t('cases.recordLoading')"
      :error-title="t('cases.recordErrorTitle')"
      :use-layout="!embed"
      :layout-props="recordLayoutProps"
      @retry="fetchCase"
    >
      <!-- List preview: flat layout (no teleport) so timeline scrolls and reply stays pinned -->
      <div
        v-if="embed && caseRecord"
        class="case-record-embed flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white dark:bg-gray-900"
      >
        <RecordRightPane
          ref="rightPaneRef"
          class="h-full min-h-0 w-full flex-1"
          full-width
          :tabs="embedPreviewTabs"
          default-tab="summary"
          summary-layout="fill"
          :show-header="true"
          :show-close-button="true"
          :title="caseModuleLabel"
          :persistence-key="`case-${caseRecord._id}`"
          :record-id="String(caseRecord._id)"
          @close="handleEmbedClose"
        >
          <template v-if="quickPreviewNav" #header-prefix>
            <div class="mr-2 flex items-center gap-1">
              <button
                type="button"
                class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-gray-200 text-gray-500 transition-colors dark:border-gray-700 dark:text-gray-400"
                :class="
                  quickPreviewNav.canPrevious
                    ? 'hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200'
                    : 'cursor-not-allowed opacity-40'
                "
                :disabled="!quickPreviewNav.canPrevious"
                :aria-label="t('actions.previous')"
                @click="quickPreviewNav.onPrev()"
              >
                <ChevronLeftIcon class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-gray-200 text-gray-500 transition-colors dark:border-gray-700 dark:text-gray-400"
                :class="
                  quickPreviewNav.canNext
                    ? 'hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200'
                    : 'cursor-not-allowed opacity-40'
                "
                :disabled="!quickPreviewNav.canNext"
                :aria-label="t('actions.next')"
                @click="quickPreviewNav.onNext()"
              >
                <ChevronRightIcon class="h-4 w-4" />
              </button>
            </div>
          </template>
          <template #header-actions>
            <button
              type="button"
              class="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              :aria-label="t('records.genericOpenInNewTab')"
              :title="t('records.genericOpenInNewTab')"
              @click="openCaseInNewTab"
            >
              <ArrowTopRightOnSquareIcon class="h-5 w-5" />
            </button>
            <button
              v-if="canEdit && !isClosed"
              type="button"
              class="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              :aria-label="t('actions.edit')"
              @click="openEditDrawer"
            >
              <PencilSquareIcon class="h-5 w-5" />
            </button>
          </template>

          <template #tab-summary>
            <CaseRecordMainWorkspace
              ref="mainWorkspaceRef"
              embed
              :case-record="caseRecord"
              :case-id="effectiveCaseId"
              v-model:active-tab="activeTab"
              :main-tabs="mainTabs"
              :tab-activities="tabActivities"
              :allowed-status-transitions="allowedStatusTransitions"
              :priorities="priorities"
              :status-updating="statusUpdating"
              :is-closed="isClosed"
              :sending="sending"
              :can-edit="canEdit"
              :can-delete="canDelete"
              :can-email="!!contactEmail"
              :empty-conversation-title="t('cases.recordEmptyConversationTitle')"
              :empty-conversation-message="t('cases.recordEmptyConversationMessage')"
              :empty-activity-title="t('cases.recordEmptyActivityTitle')"
              :empty-activity-message="t('cases.recordEmptyActivityMessage')"
              :empty-notes-title="t('cases.recordEmptyNotesTitle')"
              :empty-notes-message="t('cases.recordEmptyNotesMessage')"
              :notes-placeholder="t('cases.recordInternalCommentPlaceholder')"
              :contact-email="contactEmail"
              :email-threads="emailThreads"
              :email-threads-loading="emailThreadsLoading"
              @status-change="onStatusSelect"
              @priority-change="updatePriority"
              @edit-record="openEditDrawer"
              @email="openEmailCompose"
              @delete="showDeleteModal = true"
              @copy-url="copyUrl"
              @reopen="handleReopenCase"
              @chat-updated="onChatUpdated"
              @typing="onTyping"
              @send-message="onSendMessage"
              @send-email="onSendEmail"
              @send-note="onSendNote"
              @open-record="openRelatedRecord"
              @link-task="openLinkTaskDrawer"
            />
          </template>

          <template #tab-details>
            <CaseDetailsPanel
              :case-record="caseRecord"
              :case-id="effectiveCaseId"
              :is-closed="isClosed"
              :can-edit="canEdit"
              @edit-record="openEditDrawer"
            />
          </template>

          <template #tab-sla>
            <CaseSlaPanel :case-record="caseRecord" />
          </template>

          <template #tab-contact>
            <CaseContactProfilePanel :case-record="caseRecord" :can-edit="canEditPeople" />
          </template>

          <template #tab-related>
            <div class="flex h-full flex-col">
              <div
                class="record-context-panel__header flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
              >
                <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                  {{ t('records.relatedTitle') }}
                </h2>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                  @click="openLinkRecordDrawer"
                >
                  {{ t('records.genericLinkRecord') }}
                </button>
              </div>
              <div class="min-h-0 flex-1 overflow-y-auto p-4">
                <RelatedRecordsPanel
                  app-key="HELPDESK"
                  module-key="cases"
                  :record-id="caseRecord._id"
                />
              </div>
            </div>
          </template>

          <template #tab-knowledge>
            <CaseKnowledgePanel
              :case-title="caseRecord?.title || ''"
              :case-description="caseRecord?.description || ''"
              :case-record-id="caseRecord?._id ? String(caseRecord._id) : ''"
              :suggested-reply="caseRecord?.aiAssist?.suggestedReply || null"
            />
          </template>

          <template v-if="showLearningTab" #tab-learning>
            <div class="flex h-full flex-col">
              <RelatedLearningPanel app-key="HELPDESK" />
            </div>
          </template>
        </RecordRightPane>
      </div>

      <template v-if="caseRecord && !embed" #header>
        <RecordHeader
          :show-navigation="true"
          :show-back="true"
          :can-previous="!!neighbors.previousId"
          :can-next="!!neighbors.nextId"
          :previous-label="t('actions.previous')"
          :next-label="t('actions.next')"
          @back="goBackToModuleList"
          @previous="goToPrevious"
          @next="goToNext"
        >
          <template #breadcrumbs>
            <span class="flex min-w-0 items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <button
                type="button"
                class="shrink-0 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                :aria-label="t('records.genericBackTo', { singular: caseModuleLabel })"
                :title="t('records.genericBackTo', { singular: caseModuleLabel })"
                @click="goBackToModuleList"
              >
                {{ caseModuleLabel }}
              </button>
              <span class="h-1 w-1 shrink-0 rounded-full bg-gray-400 dark:bg-gray-500" />
              <span class="truncate">{{ caseRecord.title || 'N/A' }}</span>
              <span
                v-if="caseRecord.caseId"
                class="hidden shrink-0 font-mono text-xs text-gray-400 sm:inline dark:text-gray-500"
              >
                {{ caseRecord.caseId }}
              </span>
            </span>
          </template>

          <template #pageActions>
            <RecordPresenceAvatars
              v-if="recordPresenceOthers.length"
              :sessions="recordPresenceOthers"
            />
            <CaseRecordWorkflowChips
              :case-record="caseRecord"
              :allowed-status-transitions="allowedStatusTransitions"
              :priorities="priorities"
              :status-updating="statusUpdating"
              :is-closed="isClosed"
              @status-change="onStatusSelect"
              @priority-change="updatePriority"
            />
            <button
              v-if="contactEmail"
              type="button"
              class="hidden rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 lg:inline-flex"
              :aria-label="t('cases.recordHeaderEmail')"
              :title="t('cases.recordHeaderEmail')"
              @click="openEmailCompose"
            >
              <EnvelopeIcon class="h-5 w-5" />
            </button>
            <button
              v-if="canEdit && !isClosed"
              type="button"
              class="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              :aria-label="t('actions.edit')"
              :title="t('actions.edit')"
              @click="openEditDrawer"
            >
              <PencilSquareIcon class="h-5 w-5" />
            </button>
            <button
              type="button"
              class="hidden rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 lg:inline-flex"
              :aria-label="t('records.genericCopyUrl')"
              :title="t('records.genericCopyUrl')"
              @click="copyUrl"
            >
              <ClipboardDocumentIcon class="h-5 w-5" />
            </button>
            <RecordPrintButton
              v-if="caseRecord?._id"
              hide-on-mobile
              module-key="cases"
              :record-id="String(caseRecord._id)"
            />
            <Menu as="div" class="relative">
              <MenuButton
                class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                :aria-label="t('records.genericMoreActions')"
              >
                <EllipsisVerticalIcon class="h-5 w-5" />
              </MenuButton>
              <transition
                enter-active-class="transition ease-out duration-100"
                enter-from-class="transform opacity-0 scale-95"
                enter-to-class="transform opacity-100 scale-100"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="transform opacity-100 scale-100"
                leave-to-class="transform opacity-0 scale-95"
              >
                <MenuItems class="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg bg-white py-1 shadow-xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10">
                  <MenuItem v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'w-full px-4 py-2 text-left text-sm transition-colors lg:hidden',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                      @click="copyUrl"
                    >
                      {{ t('records.genericCopyUrl') }}
                    </button>
                  </MenuItem>
                  <MenuItem v-if="canDiscussInChat" v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                      @click="handleDiscussInChat"
                    >
                      <ChatBubbleOvalLeftEllipsisIcon class="h-4 w-4" />
                      <span>{{ t('internalChat.discussAction') }}</span>
                    </button>
                  </MenuItem>
                  <MenuItem v-if="canDelete" v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'w-full px-4 py-2 text-left text-sm transition-colors',
                        active ? 'bg-red-50 dark:bg-red-900/30' : 'text-red-600 dark:text-red-400'
                      ]"
                      @click="showDeleteModal = true"
                    >
                      {{ t('actions.delete') }}
                    </button>
                  </MenuItem>
                </MenuItems>
              </transition>
            </Menu>
          </template>
        </RecordHeader>
        <RecordClosedBanner
          v-if="isClosed"
          module-key="cases"
          :can-reopen="canEdit"
          @reopen="handleReopenCase"
        />
      </template>

      <template v-if="caseRecord && !embed" #left>
        <div class="case-record-left flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <CaseRecordMainWorkspace
            ref="mainWorkspaceRef"
            :case-record="caseRecord"
            :case-id="effectiveCaseId"
            v-model:active-tab="activeTab"
            :main-tabs="mainTabs"
            :tab-activities="tabActivities"
            :allowed-status-transitions="allowedStatusTransitions"
            :priorities="priorities"
            :status-updating="statusUpdating"
            :is-closed="isClosed"
            :sending="sending"
            :can-edit="canEdit"
            :can-delete="canDelete"
            :can-email="!!contactEmail"
            :empty-conversation-title="t('cases.recordEmptyConversationTitle')"
            :empty-conversation-message="t('cases.recordEmptyConversationMessage')"
            :empty-activity-title="t('cases.recordEmptyActivityTitle')"
            :empty-activity-message="t('cases.recordEmptyActivityMessage')"
            :empty-notes-title="t('cases.recordEmptyNotesTitle')"
            :empty-notes-message="t('cases.recordEmptyNotesMessage')"
            :notes-placeholder="t('cases.recordInternalCommentPlaceholder')"
            :contact-email="contactEmail"
            :email-threads="emailThreads"
            :email-threads-loading="emailThreadsLoading"
            @status-change="onStatusSelect"
            @priority-change="updatePriority"
            @edit-record="openEditDrawer"
            @email="openEmailCompose"
            @delete="showDeleteModal = true"
            @copy-url="copyUrl"
            @reopen="handleReopenCase"
            @chat-updated="onChatUpdated"
            @typing="onTyping"
            @send-message="onSendMessage"
            @send-email="onSendEmail"
            @send-note="onSendNote"
            @open-record="openRelatedRecord"
            @link-task="openLinkTaskDrawer"
          />
        </div>
      </template>

      <template v-if="caseRecord && !embed" #right>
          <RecordRightPane
            ref="rightPaneRef"
            :tabs="rightPaneTabs"
            default-tab="details"
            :show-header="false"
            :persistence-key="`case-${caseRecord._id}`"
            :record-id="String(caseRecord._id)"
          >
            <template #tab-details>
              <CaseDetailsPanel
                :case-record="caseRecord"
                :case-id="effectiveCaseId"
                :is-closed="isClosed"
                :can-edit="canEdit"
                @edit-record="openEditDrawer"
              />
            </template>

            <template #tab-sla>
              <CaseSlaPanel :case-record="caseRecord" />
            </template>

            <template #tab-contact>
              <CaseContactProfilePanel
                :case-record="caseRecord"
                :can-edit="canEditPeople"
              />
            </template>

            <template #tab-related>
              <div class="flex h-full flex-col">
                <div class="record-context-panel__header flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                  <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.relatedTitle') }}</h2>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                      @click="openLinkRecordDrawer"
                    >
                      {{ t('records.genericLinkRecord') }}
                    </button>
                  </div>
                </div>
                <div class="min-h-0 flex-1 overflow-y-auto p-4">
                  <RelatedRecordsPanel
                    app-key="HELPDESK"
                    module-key="cases"
                    :record-id="caseRecord._id"
                  />
                </div>
              </div>
            </template>

            <template #tab-knowledge>
              <CaseKnowledgePanel
              :case-title="caseRecord?.title || ''"
              :case-description="caseRecord?.description || ''"
              :case-record-id="caseRecord?._id ? String(caseRecord._id) : ''"
              :suggested-reply="caseRecord?.aiAssist?.suggestedReply || null"
            />
            </template>

            <template v-if="showLearningTab" #tab-learning>
              <div class="flex h-full flex-col">
                <RelatedLearningPanel app-key="HELPDESK" />
              </div>
            </template>
          </RecordRightPane>
      </template>
    </RecordPageShell>

    <CreateRecordDrawer
      v-if="caseRecord"
      :is-open="showEditDrawer"
      module-key="cases"
      :record="caseRecord"
      @close="closeEditDrawer"
      @saved="onCaseSaved"
    />

    <EmailComposeDrawer
      :is-open="showEmailModal"
      :related-to="emailRelatedTo"
      :initial-to="contactEmail"
      @close="showEmailModal = false"
      @submit="handleEmailSubmit"
    />

    <LinkRecordsDrawer
      :is-open="showLinkDrawer"
      :module-key="linkDrawerModuleKey"
      source-app-key="HELPDESK"
      source-module-key="cases"
      :multiple="true"
      :title="linkDrawerTitle"
      :context="{ sourceRecordId: effectiveCaseId }"
      @close="closeLinkDrawer"
      @linked="onRecordsLinked"
    />

    <DeleteConfirmationModal
      :show="showDeleteModal"
      :record-name="caseRecord?.title || caseRecord?.caseId"
      record-type="cases"
      :deleting="deleting"
      @close="showDeleteModal = false"
      @confirm="confirmDelete"
    />

    <CaseResolutionDialog
      :show="showResolutionDialog"
      v-model="resolutionSummaryInput"
      :pending-status="pendingStatus || ''"
      :submitting="resolving"
      @close="closeResolutionDialog"
      @confirm="confirmResolution"
    />

    <Teleport to="body">
      <div
        v-if="showReopenDialog"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 backdrop-blur-[1px] px-4 py-6"
        @click.self="closeReopenDialog"
      >
        <div class="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('cases.recordReopenDialogTitle') }}
          </h3>
          <p class="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
            {{ t('cases.recordReopenDialogDescription') }}
          </p>
          <label class="mt-5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('cases.recordReopenDialogLabel') }}
            <textarea
              v-model="reopenReasonInput"
              rows="5"
              class="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          <div class="mt-5 flex justify-end gap-2.5">
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              @click="closeReopenDialog"
            >
              {{ t('cases.recordReopenDialogCancel') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              :disabled="reopening"
              @click="confirmReopenCase"
            >
              {{ t('cases.recordReopenDialogConfirm') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, inject, onActivated, onBeforeUnmount, provide, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useArivuDataChangeRefresh } from '@/composables/useArivuDataChangeRefresh';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import {
  DocumentTextIcon,
  LinkIcon,
  UserIcon,
  BookOpenIcon,
  AcademicCapIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowTopRightOnSquareIcon,
  PencilSquareIcon,
  EnvelopeIcon,
  ClipboardDocumentIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  EllipsisVerticalIcon,
  Squares2X2Icon
} from '@heroicons/vue/24/outline';
import RecordPageShell from '@/components/record-page/RecordPageShell.vue';
import RecordHeader from '@/components/record-page/RecordHeader.vue';
import RecordRightPane from '@/components/record-page/RecordRightPane.vue';
import RecordClosedBanner from '@/components/record-page/RecordClosedBanner.vue';
import RecordPresenceAvatars from '@/components/record-page/RecordPresenceAvatars.vue';
import RecordPrintButton from '@/components/record-page/RecordPrintButton.vue';
import CaseRecordMainWorkspace from '@/components/cases/CaseRecordMainWorkspace.vue';
import CaseRecordWorkflowChips from '@/components/cases/CaseRecordWorkflowChips.vue';
import CaseDetailsPanel from '@/components/cases/CaseDetailsPanel.vue';
import CaseContactProfilePanel from '@/components/cases/CaseContactProfilePanel.vue';
import CaseKnowledgePanel from '@/components/cases/CaseKnowledgePanel.vue';
import CaseSlaPanel from '@/components/cases/CaseSlaPanel.vue';
import RelatedRecordsPanel from '@/components/relationships/RelatedRecordsPanel.vue';
import RelatedLearningPanel from '@/components/learning/RelatedLearningPanel.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import EmailComposeDrawer from '@/components/communications/EmailComposeDrawer.vue';
import LinkRecordsDrawer from '@/components/common/LinkRecordsDrawer.vue';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';
import CaseResolutionDialog from '@/components/cases/CaseResolutionDialog.vue';
import { useCaseRecord } from '@/composables/useCaseRecord';
import { useRecordPresence } from '@/composables/useRecordPresence';
import {
  useCaseStatusResolution,
  CASE_STATUS_RESOLUTION_KEY
} from '@/composables/useCaseStatusResolution';
import { useNotifications } from '@/composables/useNotifications';
import { useTabs } from '@/composables/useTabs';
import { useAuthStore } from '@/stores/authRegistry';
import { isAddonEntitled } from '@/utils/addonEntitlement';
import { openRecordDiscussChat } from '@/utils/internalChatApi';
import { useRecordModuleBack } from '@/components/record-page/composables/useRecordModuleBack';
import { filterActivitiesForTab } from '@/utils/caseTimeline';
import { buildCaseEmailReplyDraft } from '@/utils/caseEmailReply';
import apiClient from '@/utils/apiClient';
import { invalidateRecordContext } from '@/composables/useRecordContext';
import { resolveRecordDetailRefreshOnActivate } from '@/utils/recordDetailRefreshPolicy';
import { extractRecordUpdatedAtMs } from '@/utils/recordDetailFreshness';

const props = defineProps({
  embed: { type: Boolean, default: false },
  caseId: { type: String, default: null }
});

const emit = defineEmits(['close']);

const { t } = useI18n();
const caseModuleLabel = computed(() => t('navigation.moduleCases'));
const route = useRoute();
const router = useRouter();
const notifications = useNotifications();
const { openTab, replaceActiveTab } = useTabs();
const { goBackToModuleList } = useRecordModuleBack();
const authStore = useAuthStore();

const rightPaneRef = ref(null);
const mainWorkspaceRef = ref(null);
const quickPreviewNav = inject('quickPreviewNav', null);

/** List preview: conversation in #tab-summary slot, not teleported from RecordPageLayout. */
if (props.embed) {
  provide('recordLayoutIsMobile', ref(false));
}

const recordLayoutProps = computed(() => ({
  forceMobile: props.embed,
  leftExpanded: false,
  dense: !props.embed,
  class: props.embed
    ? '!relative !inset-auto flex h-full w-full min-h-0 flex-col overflow-hidden'
    : ''
}));

const effectiveCaseId = computed(() => {
  if (props.embed && props.caseId) return props.caseId;
  return route.params?.id || '';
});

const {
  loading,
  error,
  caseRecord,
  sending,
  statusUpdating,
  neighbors,
  contactEmail,
  allowedStatusTransitions,
  isClosed,
  priorities,
  fetchCase,
  refreshCaseSilently,
  loadEmailThreads,
  updateStatus,
  updatePriority,
  postActivity,
  reopenCase,
  deleteCase,
  emailThreads,
  emailThreadsLoading
} = useCaseRecord(effectiveCaseId);

const { otherSessions: recordPresenceOthers } = useRecordPresence(
  () => 'cases',
  () => String(effectiveCaseId.value || caseRecord.value?._id || ''),
  () => 'viewing'
);

const {
  showResolutionDialog,
  resolutionSummaryInput,
  pendingStatus,
  resolving,
  changeStatus: changeCaseStatus,
  confirmResolution,
  closeResolutionDialog
} = useCaseStatusResolution({ caseRecord, updateStatus, notifications, t });

provide(CASE_STATUS_RESOLUTION_KEY, { changeStatus: changeCaseStatus });

let chatRefreshTimer = null;

function onChatUpdated() {
  if (chatRefreshTimer) clearTimeout(chatRefreshTimer);
  chatRefreshTimer = setTimeout(() => {
    chatRefreshTimer = null;
    refreshCaseSilently();
  }, 600);
}

onActivated(async () => {
  const id = effectiveCaseId.value;
  if (!id) return;
  const decision = await resolveRecordDetailRefreshOnActivate({
    moduleKey: 'cases',
    appKey: 'HELPDESK',
    getUpdatedAtMs: () => extractRecordUpdatedAtMs(caseRecord.value),
  }, id);
  if (decision === 'refresh') {
    await refreshCaseSilently();
  }
});

useArivuDataChangeRefresh({
  getModuleKey: () => 'cases',
  getRecordId: () => String(effectiveCaseId.value || caseRecord.value?._id || ''),
  onChange: (detail) => {
    if (detail?.patch && typeof detail.patch === 'object' && caseRecord.value) {
      Object.assign(caseRecord.value, detail.patch);
    }
    void refreshCaseSilently();
  },
});

onBeforeUnmount(() => {
  if (chatRefreshTimer) clearTimeout(chatRefreshTimer);
});

const activeTab = ref('conversation');
const showEditDrawer = ref(false);
const showEmailModal = ref(false);
const showLinkDrawer = ref(false);
const linkDrawerModuleKey = ref('');
const linkDrawerTitle = computed(() =>
  linkDrawerModuleKey.value === 'tasks'
    ? t('cases.recordTasksLink')
    : t('records.genericLinkRecord')
);
const showDeleteModal = ref(false);
const deleting = ref(false);
const showReopenDialog = ref(false);
const reopenReasonInput = ref('');
const reopening = ref(false);

const canEdit = computed(() => authStore.can('cases', 'edit'));
const canEditPeople = computed(() => authStore.can('people', 'edit'));
const canDelete = computed(() => authStore.can('cases', 'delete'));
const showLearningTab = computed(() => authStore.hasAppAccess('LMS'));

const emailRelatedTo = computed(() => {
  const id = effectiveCaseId.value;
  return id ? { moduleKey: 'cases', recordId: String(id) } : null;
});

const mainTabs = computed(() => [
  { id: 'conversation', label: t('cases.recordTabConversation') },
  { id: 'tasks', label: t('cases.recordTabTasks') },
  { id: 'activity', label: t('cases.recordTabActivity') },
  { id: 'notes', label: t('cases.recordTabNotes') }
]);

const rightPaneTabs = computed(() => {
  const tabs = [
    { id: 'details', name: t('cases.recordTabDetails'), icon: DocumentTextIcon },
    { id: 'sla', name: t('cases.recordSlaSection'), icon: ClockIcon },
    { id: 'contact', name: t('cases.recordTabContact'), icon: UserIcon },
    { id: 'related', name: t('records.relatedTitle'), icon: LinkIcon },
    { id: 'knowledge', name: t('cases.recordRailKnowledge'), icon: BookOpenIcon }
  ];
  if (showLearningTab.value) {
    tabs.push({ id: 'learning', name: t('learning.relatedLearning'), icon: AcademicCapIcon });
  }
  return tabs;
});

const embedPreviewTabs = computed(() => [
  { id: 'summary', name: t('records.tabSummary'), icon: Squares2X2Icon },
  ...rightPaneTabs.value
]);

const tabActivities = computed(() =>
  filterActivitiesForTab(caseRecord.value?.activities, activeTab.value)
);

function focusRightPaneTab(tabId) {
  if (rightPaneRef.value?.activeTab) {
    rightPaneRef.value.activeTab = tabId;
  }
}

function openEmailCompose() {
  if (!contactEmail.value) {
    notifications.error(t('cases.recordNoContactEmail'));
    return;
  }
  showEmailModal.value = true;
}

async function handleEmailSubmit(payload) {
  showEmailModal.value = false;
  try {
    const res = await apiClient.post('/communications/email', payload);
    if (res.success) {
      notifications.success(t('records.genericEmailSent'));
      await fetchCase();
    } else {
      notifications.error(res.message || t('records.genericEmailSendFailed'));
    }
  } catch (err) {
    const msg = err.response?.data?.error || err.response?.data?.message || err.message;
    notifications.error(msg || t('records.genericEmailSendFailed'));
  }
}

async function onStatusSelect(status) {
  await changeCaseStatus(status);
}

async function onSendEmail(payload) {
  if (!payload?.relatedTo?.recordId) return;
  sending.value = true;
  try {
    const res = await apiClient.post('/communications/email', payload);
    if (res?.success) {
      notifications.success(t('records.genericEmailSent'));
      await refreshCaseSilently();
      await loadEmailThreads();
      mainWorkspaceRef.value?.clearReplyComposer?.();
    } else {
      notifications.error(res?.message || t('records.genericEmailSendFailed'));
    }
  } catch (err) {
    const msg = err.response?.data?.error || err.response?.data?.message || err.message;
    notifications.error(msg || t('records.genericEmailSendFailed'));
  } finally {
    sending.value = false;
  }
}

async function onSendMessage(payload) {
  if (payload.internal) {
    const ok = await postActivity({
      ...payload,
      activityType: 'comment',
      internal: true
    });
    if (ok) mainWorkspaceRef.value?.clearReplyComposer?.();
    return;
  }

  const viaChannel = String(payload.channel || '').trim().toLowerCase();
  if (viaChannel === 'email') {
    if (!contactEmail.value) {
      notifications.error(t('cases.recordNoContactEmail'));
      return;
    }
    const draft = buildCaseEmailReplyDraft({
      caseRecord: caseRecord.value,
      contactEmail: contactEmail.value,
      emailThreads: emailThreads.value
    });
    const escaped = String(payload.message || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    await onSendEmail({
      relatedTo: emailRelatedTo.value,
      to: [contactEmail.value],
      subject: draft.subject || `Re: ${caseRecord.value?.title || 'Case'}`,
      body: `<p>${escaped.replace(/\n/g, '<br>')}</p>`,
      ...(draft.parentCommunicationId ? { parentCommunicationId: draft.parentCommunicationId } : {})
    });
    return;
  }

  await postActivity({
    ...payload,
    activityType: payload.internal ? 'comment' : 'agent_message',
    internal: payload.internal
  });
}

function onTyping() {
  // Legacy case-bound live chat typing removed (LC0).
}

async function onSendNote(payload) {
  const ok = await postActivity({
    message: payload.message,
    channel: payload.channel,
    internal: true,
    activityType: 'comment'
  });
  if (ok) mainWorkspaceRef.value?.clearReplyComposer?.();
}

async function handleReopenCase() {
  reopenReasonInput.value = '';
  showReopenDialog.value = true;
}

function closeReopenDialog() {
  if (reopening.value) return;
  showReopenDialog.value = false;
}

async function confirmReopenCase() {
  const reason = String(reopenReasonInput.value || '').trim();
  if (!reason) {
    notifications.warning(t('cases.recordReopenReasonRequired'));
    return;
  }
  reopening.value = true;
  try {
    await reopenCase(reason);
    showReopenDialog.value = false;
  } finally {
    reopening.value = false;
  }
}

function openEditDrawer() {
  if (!canEdit.value) {
    notifications.warning('You do not have permission to edit cases.');
    return;
  }
  if (isClosed.value) {
    notifications.warning(t('cases.recordEditClosedHint'));
    return;
  }
  showEditDrawer.value = true;
}

function closeEditDrawer() {
  showEditDrawer.value = false;
}

function onCaseSaved() {
  closeEditDrawer();
  fetchCase();
}

function openRelatedRecord(task) {
  if (!task?.recordId) return;
  openTab(`/tasks/${task.recordId}`, { background: false, insertAdjacent: true });
}

function openLinkRecordDrawer() {
  linkDrawerModuleKey.value = '';
  showLinkDrawer.value = true;
}

function openLinkTaskDrawer() {
  linkDrawerModuleKey.value = 'tasks';
  showLinkDrawer.value = true;
}

function closeLinkDrawer() {
  showLinkDrawer.value = false;
  linkDrawerModuleKey.value = '';
}

async function onRecordsLinked(payload = {}) {
  const ids = Array.isArray(payload?.ids) ? payload.ids : [];
  const moduleKey = String(payload?.moduleKey || 'tasks').toLowerCase();
  const relationshipKey = String(
    payload?.relationshipKey || (moduleKey === 'tasks' ? 'task_cases' : moduleKey)
  ).toLowerCase();
  const linkedModuleAppKey = String(
    payload?.targetAppKey || (moduleKey === 'tasks' ? 'PLATFORM' : 'SALES')
  ).toUpperCase();
  // task_cases is defined as platform.tasks → helpdesk.cases; case is TARGET when linking tasks.
  const sourceIsCurrent =
    payload?.sourceIsCurrent !== undefined
      ? payload.sourceIsCurrent !== false
      : !(relationshipKey === 'task_cases' || moduleKey === 'tasks');
  const caseId = effectiveCaseId.value;

  for (const recordId of ids) {
    try {
      if (moduleKey === 'documents') {
        const linkRes = await apiClient.post(`/documents/${recordId}/link`, {
          moduleKey: 'cases',
          recordId: String(caseId),
          appKey: 'HELPDESK'
        });
        if (!linkRes?.success) {
          notifications.error(linkRes?.message || t('documents.linkFailed'));
          return;
        }
        continue;
      }

      const linkPayload = sourceIsCurrent
        ? {
            relationshipKey,
            source: { appKey: 'HELPDESK', moduleKey: 'cases', recordId: caseId },
            target: { appKey: linkedModuleAppKey, moduleKey, recordId }
          }
        : {
            relationshipKey,
            source: { appKey: linkedModuleAppKey, moduleKey, recordId },
            target: { appKey: 'HELPDESK', moduleKey: 'cases', recordId: caseId }
          };
      await apiClient.post('/relationships/link', linkPayload);
    } catch (err) {
      notifications.error(err?.response?.data?.message || 'Failed to link record');
      return;
    }
  }

  closeLinkDrawer();
  invalidateRecordContext('HELPDESK', 'cases', caseId);
  notifications.success(t('cases.recordLinkSuccess'));
  focusRightPaneTab('related');
}

function goToPrevious() {
  if (!neighbors.value.previousId) return;
  const path = `/helpdesk/cases/${neighbors.value.previousId}`;
  if (props.embed) replaceActiveTab(path, { title: t('navigation.moduleCases') });
  else router.push(path);
}

function goToNext() {
  if (!neighbors.value.nextId) return;
  const path = `/helpdesk/cases/${neighbors.value.nextId}`;
  if (props.embed) replaceActiveTab(path, { title: t('navigation.moduleCases') });
  else router.push(path);
}

function copyUrl() {
  navigator.clipboard?.writeText(window.location.href).catch(() => {});
  notifications.success(t('records.useRecordHeaderActionsToastUrlCopiedToClipboard'));
}

const canDiscussInChat = computed(() => (
  isAddonEntitled(authStore.user, 'internal_chat')
  && Boolean(effectiveCaseId.value || caseRecord.value?._id)
));

async function handleDiscussInChat() {
  try {
    await openRecordDiscussChat({
      moduleKey: 'cases',
      recordId: caseRecord.value?._id || effectiveCaseId.value,
      openTab,
      router,
      tabTitle: t('navigation.internalChat'),
    });
  } catch (err) {
    notifications.error(err?.response?.data?.message || t('internalChat.discussFailed'));
  }
}

function handleEmbedClose() {
  if (props.embed) emit('close');
}

function openCaseInNewTab() {
  const id = effectiveCaseId.value;
  if (!id) return;
  openTab(`/helpdesk/cases/${id}`, { background: false, insertAdjacent: true });
}

async function confirmDelete() {
  deleting.value = true;
  const ok = await deleteCase();
  deleting.value = false;
  showDeleteModal.value = false;
  if (ok) {
    if (props.embed) emit('close');
    else router.push('/helpdesk/cases');
  }
}
</script>

<style scoped>
.case-record-page-root {
  isolation: isolate;
}

/* Let the conversation workspace use full left column width (not max-w-4xl form width). */
.case-record-page-root :deep(.record-page-layout__left-content) {
  max-width: none;
  padding-left: 0;
  padding-right: 0;
}

/* Full page: left column is a flex shell; timeline scrolls inside CaseRecordMainWorkspace. */
.case-record-page-root:not(:has(.case-record-embed)) :deep(.record-page-layout__left) {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1 1 0%;
  overflow: hidden;
  padding-bottom: 0;
}

.case-record-page-root:not(:has(.case-record-embed)) :deep(.record-page-layout__left-content) {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}

.case-record-page-root:not(:has(.case-record-embed)) .case-record-left {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.case-record-page-root:has(.case-record-left--embed) :deep(.record-page-layout) {
  position: relative;
  inset: auto;
  height: 100%;
  width: 100%;
}

.case-record-page-root:has(.case-record-left--embed) :deep(.record-page-layout__header--positioned) {
  position: relative;
  top: auto;
  left: auto;
  right: auto;
}

.case-record-page-root:has(.case-record-left--embed) :deep(.record-page-layout__body--with-header),
.case-record-page-root:has(.case-record-left--embed) :deep(.record-page-layout__body--positioned) {
  padding-top: 0;
  margin-left: 0;
  margin-top: 0;
  width: 100%;
}

.case-record-page-root:has(.case-record-left--embed) :deep(.record-page-layout__left) {
  padding-top: 0;
  padding-right: 0;
}

.case-record-page-root:has(.case-record-left--embed) .case-record-left--embed {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.case-record-page-root:has(.case-record-left--embed) :deep(.record-page-layout__left-content) {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  flex: 1;
}

.case-record-embed {
  height: 100%;
  min-height: 0;
}

.case-record-embed :deep(.record-right-pane) {
  height: 100%;
  min-height: 0;
}
</style>
