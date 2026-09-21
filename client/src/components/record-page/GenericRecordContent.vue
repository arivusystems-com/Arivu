<template>
  <div ref="genericRecordContentRootRef" class="generic-record-content flex-1 min-h-0 overflow-hidden flex flex-col">
    <RecordPageShell
      :loading="loading"
      :error="error"
      :loading-message="recordLoadingMessage"
      :error-title="recordErrorTitle"
      :layout-props="layoutProps"
      @retry="fetchRecord"
    >
      <!-- No RecordHeader in embed (quick preview): drawer already has prev/next + close; header would fix to viewport and show as extra over the list -->
      <template v-if="record && !embed" #header>
        <RecordHeader
          :show-navigation="true"
          :show-back="true"
          :can-previous="!!neighbors.previousId"
          :can-next="!!neighbors.nextId"
          :previous-label="recordNavPreviousLabel"
          :next-label="recordNavNextLabel"
          @back="goBackToModuleList"
          @previous="goToPrevious"
          @next="goToNext"
        >
          <template #breadcrumbs>
            <span class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 min-w-0">
              <button
                type="button"
                class="shrink-0 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                :aria-label="t('records.genericBackTo', { singular: moduleLabel })"
                :title="t('records.genericBackTo', { singular: moduleLabel })"
                @click="goBackToModuleList"
              >
                {{ moduleLabel }}
              </button>
              <span class="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 shrink-0"></span>
              <span class="truncate">{{ recordTitle || (record?._id || '').slice(-8) || 'N/A' }}</span>
            </span>
          </template>
          <template #pageActions>
            <RecordPresenceAvatars
              v-if="showRecordPresenceAvatars"
              :sessions="recordPresenceOthers"
            />
            <button
              v-if="canPublishDocument"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              @click="handlePublishDocument"
            >
              <CheckCircleIcon class="h-4 w-4" />
              {{ t('documents.publish') }}
            </button>
            <button
              v-if="canOpenDocumentEditor"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              @click="openDocumentEditor"
            >
              <PencilSquareIcon class="h-4 w-4" />
              {{ t('documents.openEditor') }}
            </button>
            <button
              v-if="canViewFormResponses"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              @click="viewFormResponses"
            >
              {{ t('common.summaryViewResponses') }}
            </button>
            <button
              v-if="supportsEmail"
              type="button"
              class="hidden lg:inline-flex p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('records.genericSendEmail')"
              :title="t('records.genericSendEmail')"
              @click="openEmailComposeModal()"
            >
              <EnvelopeIcon class="w-5 h-5" />
            </button>
            <button
              v-if="canEditFormRecord"
              type="button"
              class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('actions.edit')"
              :title="t('actions.edit')"
              @click="handleEditRecord"
            >
              <PencilSquareIcon class="w-5 h-5" />
            </button>
            <button
              v-if="supportsTags"
              ref="tagHeaderButtonRef"
              type="button"
              :class="[
                'relative inline-flex items-center justify-center p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                hasRecordTags
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              ]"
              :aria-label="t('records.genericTagsAria')"
              :title="t('records.genericTagsAria')"
              @click="handleTagIconClick($event)"
            >
              <TagIcon class="block w-5 h-5" />
              <span
                v-if="hasRecordTags"
                class="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400"
              />
            </button>
            <button
              type="button"
              class="hidden lg:inline-flex p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('records.genericCopyUrl')"
              :title="t('records.genericCopyUrl')"
              @click="copyUrl"
            >
              <ClipboardDocumentIcon class="w-5 h-5" />
            </button>
            <RecordPrintButton
              v-if="record?._id"
              ref="recordPrintButtonRef"
              hide-on-mobile
              :module-key="moduleKey"
              :record-id="String(record._id)"
            />
            <Menu as="div" class="relative">
              <MenuButton
                class="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                :aria-label="t('records.genericMoreActions')"
                :title="t('records.genericMoreActions')"
              >
                <EllipsisVerticalIcon class="w-5 h-5" />
              </MenuButton>
              <transition
                enter-active-class="transition ease-out duration-100"
                enter-from-class="transform opacity-0 scale-95"
                enter-to-class="transform opacity-100 scale-100"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="transform opacity-100 scale-100"
                leave-to-class="transform opacity-0 scale-95"
              >
                <MenuItems
                  class="absolute right-0 top-full mt-2 w-48 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 z-50"
                >
                  <MenuItem v-if="canPrintRecord" v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2 sm:hidden',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                      @click="openRecordPrint"
                    >
                      <PrinterIcon class="w-4 h-4" />
                      <span>{{ t('actions.print') }}</span>
                    </button>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2 lg:hidden',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                      @click="copyUrl"
                    >
                      <ClipboardDocumentIcon class="w-4 h-4" />
                      <span>{{ t('records.genericCopyUrl') }}</span>
                    </button>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                      @click="handleDuplicate"
                    >
                      <DocumentDuplicateIcon class="w-4 h-4" />
                      <span>{{ t('actions.duplicate') }}</span>
                    </button>
                  </MenuItem>
                  <MenuItem v-if="canDiscussInChat" v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                      @click="handleDiscussInChat"
                    >
                      <ChatBubbleOvalLeftEllipsisIcon class="w-4 h-4" />
                      <span>{{ t('internalChat.discussAction') }}</span>
                    </button>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                      @click="handleExport"
                    >
                      <ArrowDownTrayIcon class="w-4 h-4" />
                      <span>{{ t('actions.export') }}</span>
                    </button>
                  </MenuItem>
                  <MenuItem v-if="supportsEmail" v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                      @click="openEmailComposeModal()"
                    >
                      <EnvelopeIcon class="w-4 h-4" />
                      <span>{{ t('records.genericSendEmail') }}</span>
                    </button>
                  </MenuItem>
                  <MenuItem v-if="canArchiveFormRecord" v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                      @click="handleArchiveForm"
                    >
                      <ArchiveBoxIcon class="w-4 h-4" />
                      <span>{{ t('actions.archive') }}</span>
                    </button>
                  </MenuItem>
                  <hr class="my-1 border-gray-200 dark:border-gray-700" />
                  <MenuItem v-if="canDeleteFormRecord" v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-red-600 dark:text-red-400'
                      ]"
                      @click="showDeleteModal = true"
                    >
                      <TrashIcon class="w-4 h-4" />
                      <span>{{ t('actions.delete') }}</span>
                    </button>
                  </MenuItem>
                </MenuItems>
              </transition>
            </Menu>
          </template>
        </RecordHeader>
      </template>

      <template v-if="record" #left>
        <div
          :class="
            expandedLeftSection === 'lines' || isTemplatesModule
              ? 'flex flex-col flex-1 min-h-0 h-full overflow-hidden'
              : ''
          "
        >
        <div
          v-if="expandedLeftSection"
          :class="[
            'flex-shrink-0 z-20 bg-white/95 dark:bg-gray-900/95 supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:dark:bg-gray-900/90 backdrop-blur',
            expandedLeftSection === 'lines' ? 'mb-2' : 'mb-4 sticky',
            embed ? 'top-0' : expandedLeftSection === 'lines' ? '' : 'top-0 lg:-top-6'
          ]"
        >
          <div class="flex items-center justify-between gap-2 py-2">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              @click="closeExpandedLeftSection"
            >
              <ArrowLeftIcon class="h-4 w-4" />
              <span>{{ t('records.genericBackTo', { singular: moduleLabelSingular }) }}</span>
            </button>
            <button
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              :aria-label="t('records.genericCollapseSection')"
              :title="t('records.genericCollapse')"
              @click="closeExpandedLeftSection"
            >
              <ArrowsPointingInIcon class="h-4 w-4" />
            </button>
          </div>
        </div>

        <!-- Content version history full page (description + rich text) -->
        <ContentVersionHistoryView
          v-if="record && isContentVersionHistoryOpen"
          :page-title="recordTitle || moduleLabelSingular"
          :versions="contentVersionHistoryList"
          v-model:selected-index="selectedDescriptionVersionIndex"
          :loading="descriptionVersionsLoading"
          :restore-loading="descriptionRestoreLoading"
          :radio-name="contentVersionHistoryRadioName"
          @restore="restoreContentVersion"
        />

        <!-- Rich document full-page editor -->
        <div
          v-if="record && expandedLeftSection === 'content-editor' && isDocumentsRichRecord"
          class="document-editor-page-shell flex-1 min-h-0 mt-4 flex flex-col"
        >
          <DocumentEditorPage
            ref="documentEditorPageRef"
            :record="record"
            :can-edit="canEditRecord"
            :can-publish="canPublishDocument"
            :saving="documentEditorSaving"
            :type-label-map="documentTypeLabelMap"
            :presence-sessions="recordPresenceOthers"
            :on-save="handleDocumentEditorSave"
            @save="handleDocumentEditorSave"
            @publish="handlePublishDocument"
            @inline-comment-request="handleInlineCommentRequest"
            @draft-saved="handleDocumentDraftSaved"
          />
        </div>

        <div v-if="embed && !expandedLeftSection" class="pt-0 flex-shrink-0" aria-hidden="true" />
        <RecordPageTitleRow
          v-if="!expandedLeftSection"
          :sticky="isLeftTitleSticky"
          :embed="embed"
          class="shrink-0"
        >
          <Avatar
            v-if="recordAvatarUser"
            :user="recordAvatarUser"
            size="lg"
            class="shrink-0"
          />
          <Avatar
            v-else
            :record="{ name: recordTitle }"
            :icon="recordAvatarIcon"
            size="lg"
            class="shrink-0"
          />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
              <button
                v-if="documentNumberPrefix"
                type="button"
                class="shrink-0 inline-flex items-center rounded px-2 py-1 -ml-2 text-2xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                :aria-label="t('records.copyRecordNumber')"
                :title="t('records.copyRecordNumber')"
                @click="copyDocumentNumber"
              >
                {{ documentNumberPrefix }}
              </button>
              <span
                v-if="documentNumberPrefix"
                class="shrink-0 text-3xl leading-none font-semibold text-gray-300 dark:text-gray-600 select-none"
                aria-hidden="true"
              >·</span>
              <div class="min-w-0 flex-1">
                <EditableTitle
                  :title="recordTitle"
                  :can-edit="canEditRecordTitle"
                  @save="handleTitleSave"
                />
              </div>
              <template v-if="isFormsModule && formRecordSubtitle">
                <span class="text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
                <span class="text-sm text-gray-600 dark:text-gray-400 truncate">{{ formRecordSubtitle }}</span>
              </template>
              <BadgeCell
                v-if="isFormsModule && record?.status"
                :value="record.status"
                :variant-map="formStatusBadgeVariantMap"
              />
              <BadgeCell
                v-if="isEventsModule && eventLifecycleStatus"
                :value="eventLifecycleStatus"
                :variant-map="eventStatusBadgeVariantMap"
              />
              <PeopleRecordAccessChips
                v-if="isPeopleModule && showPeopleAccessTab"
                :portal-access="peoplePortalAccess"
                :marketing-access="peopleMarketingAccess"
                @open-access="openPeopleAccessTab"
              />
            </div>
            <CaseSlaContextBanner
              v-if="moduleKeyLower === 'cases' && record?.slaContext"
              :sla-context="record.slaContext"
              :cycle-status="record.currentSlaCycle?.status"
              :case-status="record.status"
            />
          </div>
          <template v-if="moduleKeyLower === 'quotes'" #below>
            <div class="space-y-2">
              <QuoteRecordStatusBanner :record="record" />
              <QuoteCustomerResponseBanner :record="record" />
            </div>
          </template>
        </RecordPageTitleRow>

        <EventRecordExecutionPanel
          v-if="isEventsModule && !expandedLeftSection && record && !isEventAppointment"
          ref="eventExecutionPanelRef"
          class="mt-4"
          :event="record"
          :event-id="eventExecutionRouteId"
          @updated="fetchRecord"
        />

        <div
          v-if="genericStateFields.length && (!expandedLeftSection || expandedLeftSection === 'key-fields')"
          :class="['group/left-section', expandedLeftSection ? 'mt-8' : 'mt-2 lg:mt-4']"
        >
          <RecordStateSection
            :heading="t('records.genericKeyFields')"
            :module-key="moduleKey"
            :fields="genericStateFields"
            :field-values="genericStateValues"
          />
        </div>

        <!-- App Participation: people only, shows roles per app (e.g. Sales → Lead) -->
        <div
          v-if="isPeopleModule && record && (!expandedLeftSection || expandedLeftSection === 'key-fields')"
          :class="['group/left-section', expandedLeftSection ? 'mt-8' : 'mt-4']"
        >
          <section
            class="record-state-section mb-8 mt-4 group/app-participation"
            aria-labelledby="app-participation-heading"
          >
            <div class="pb-2 flex items-center justify-between gap-3 flex-wrap">
              <h3
                id="app-participation-heading"
                :class="[
                  'font-semibold text-gray-900 dark:text-white',
                  expandedLeftSection ? 'text-2xl' : 'text-base'
                ]"
              >
                {{ t('records.genericAppParticipation') }}
              </h3>
              <div
                v-if="attachableAppsForRecordContext.length"
                :class="[
                  'inline-flex flex-wrap items-center justify-end gap-1.5 transition-opacity',
                  expandedLeftSection
                    ? 'opacity-100 lg:opacity-100'
                    : 'opacity-100 lg:opacity-0 lg:group-hover/app-participation:opacity-100'
                ]"
              >
                <button
                  v-for="app in attachableAppsForRecordContext"
                  :key="`attach-header-${app}`"
                  type="button"
                  class="inline-flex items-center justify-center gap-1.5 min-h-8 px-2.5 rounded-md border border-gray-200 bg-white text-gray-600 hover:text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-800 transition-colors"
                  :title="t('records.genericAddToApp', { app: getAppLabel(app) })"
                  :aria-label="t('records.genericAddToApp', { app: getAppLabel(app) })"
                  @click="openAttachToAppModal(app)"
                >
                  <PlusIcon class="h-4 w-4 shrink-0" />
                  <span class="text-xs font-semibold">{{ t('records.genericAddToApp', { app: getAppLabel(app) }) }}</span>
                </button>
              </div>
            </div>
            <div class="space-y-2">
              <template v-if="peopleParticipationEntriesVisible.length">
                <div
                  v-for="(entry, i) in peopleParticipationEntriesVisible"
                  :key="`${entry.appKey}-${i}`"
                  class="flex flex-wrap items-center gap-x-3 gap-y-2 justify-between rounded-lg border border-gray-200/80 dark:border-gray-700/80 bg-gray-50/60 dark:bg-gray-800/40 px-3 py-2.5"
                >
                  <div class="flex flex-wrap items-center gap-2 min-w-0">
                    <template v-if="peopleContextIsAppView">
                      <span class="text-sm font-medium text-gray-900 dark:text-white">{{ entry.role }}</span>
                    </template>
                    <template v-else>
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        :class="participationAppBadgeClass(entry.appLabel)"
                      >
                        {{ entry.appLabel }}
                      </span>
                      <BadgeCell
                        :value="entry.role"
                        :options="badgeOptionsForParticipationApp(entry.appKey)"
                        :variant-map="participationRoleBadgeVariantMap"
                      />
                    </template>
                  </div>
                  <div class="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      v-if="entry.appKey === 'SALES' && showPeopleConvertLeadPrimary"
                      type="button"
                      class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-md shadow-sm transition-colors"
                      @click="showConvertLeadModal = true"
                    >
                      <ArrowRightCircleIcon class="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      {{ t('records.genericConvertToContact') }}
                    </button>
                    <button
                      v-if="canEditParticipationFor(entry.appKey)"
                      type="button"
                      class="inline-flex items-center justify-center gap-1.5 min-h-8 px-2.5 rounded-md border border-gray-200 bg-white text-gray-600 hover:text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-800 transition-colors"
                      :title="t('records.genericEditParticipation')"
                      :aria-label="t('records.genericEditParticipation')"
                      @click="openParticipationEdit(entry.appKey)"
                    >
                      <PencilSquareIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span class="text-xs font-semibold">{{ t('actions.edit') }}</span>
                    </button>
                  </div>
                </div>
              </template>
              <template v-else>
                <span class="text-sm text-gray-500 dark:text-gray-400 italic">
                  <template v-if="peopleContextIsAppView">
                    {{ t('records.genericNotParticipatingIn', { app: getAppLabel(routeParticipationContext) }) }}
                  </template>
                  <template v-else>
                    {{ t('records.genericNotInAnyApp') }}
                  </template>
                </span>
              </template>
            </div>
          </section>
        </div>

        <AppointmentDetailCard
          v-if="isEventAppointment"
          class="mt-4"
          :appointment="record.appointment"
          :status="record.status"
          :status-category="record.statusCategory"
          :event-id="String(record._id || record.eventId || '')"
          @cancel="cancelAppointment"
          @complete="completeAppointment"
          @no-show="markAppointmentNoShow"
          @rescheduled="onAppointmentRescheduled"
        />

        <FormRecordShareLinkPanel
          v-if="isFormsModule && !expandedLeftSection && record && isEngagementForm"
          class="mt-4"
          :record="record"
          :can-manage="canManageEngagementShareLink"
          @updated="handleFormShareLinkUpdated"
        />

        <div
          v-if="isFormsModule && !expandedLeftSection && record && showFormNotActiveBanner"
          class="mt-4 rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800"
        >
          <DocumentTextIcon class="mx-auto mb-4 h-10 w-10 text-gray-400 dark:text-gray-500" />
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('common.summaryFormNotActive') }}</h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ formNotActiveHint }}</p>
        </div>

        <FormRecordAnalyticsStrip
          v-if="canViewFormResponses && !expandedLeftSection"
          class="mt-4"
          :loading="formAnalyticsLoading || formResponseSummaryLoading"
          :statistics="formAnalytics?.statistics"
          :form-meta="formAnalytics?.form"
          :summary-overview="formResponseSummary?.overview"
          :is-engagement-form="isEngagementForm"
        />

        <section
          v-if="isTemplatesModule && record && !expandedLeftSection"
          class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
        >
          <TemplateHtmlPreviewPanel
            class="min-h-0 h-full flex-1"
            :template-id="String(record._id)"
            :template="record"
          />
        </section>

        <!-- Section stack: show when collapsed, or when expanded to details/related (adapter returns only that section) -->
        <section
          v-if="record && !isTemplatesModule && genericSections.length && (!expandedLeftSection || ['description', 'catalog', 'vendor-catalog', 'details', 'related', 'lines', 'revisions', 'conversion', 'preview', 'responses'].includes(expandedLeftSection))"
          :class="[
            expandedLeftSection === 'lines'
              ? 'flex-1 min-h-0 flex flex-col overflow-hidden mt-2'
              : expandedLeftSection
                ? 'mt-8'
                : 'mt-4'
          ]"
        >
          <SectionStack
            :sections="genericSections"
            :record="record"
            :adapter="genericAdapter"
            :context="sectionContext"
          />
        </section>
        </div>
      </template>

      <template v-if="record" #right>
        <RecordRightPane
          ref="rightPaneRef"
          :tabs="rightPaneTabs"
          :default-tab="recordLayoutIsMobile ? undefined : 'activity'"
          :show-header="embed"
          :show-close-button="embed"
          :title="embed ? (isTemplatesModule ? recordTitle : moduleLabel) : ''"
          :summary-layout="isTemplatesModule ? 'fill' : 'scroll'"
          :persistence-key="`generic-${moduleKey}-${record._id}`"
          :record-id="record._id"
          @close="$emit('close')"
        >
          <template v-if="embed && quickPreviewNav" #header-prefix>
            <div class="flex items-center gap-1 mr-2">
              <button
                type="button"
                class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 transition-colors dark:border-gray-700 dark:text-gray-400 shrink-0"
                :class="quickPreviewNav.canPrevious ? 'hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200' : 'opacity-40 cursor-not-allowed'"
                :disabled="!quickPreviewNav.canPrevious"
                :aria-label="recordNavPreviousLabel"
                :title="recordNavPreviousLabel"
                @click="quickPreviewNav.onPrev()"
              >
                <ArrowLeftIcon class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 transition-colors dark:border-gray-700 dark:text-gray-400 shrink-0"
                :class="quickPreviewNav.canNext ? 'hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200' : 'opacity-40 cursor-not-allowed'"
                :disabled="!quickPreviewNav.canNext"
                :aria-label="recordNavNextLabel"
                :title="recordNavNextLabel"
                @click="quickPreviewNav.onNext()"
              >
                <ArrowRightIcon class="h-4 w-4" />
              </button>
            </div>
          </template>
          <template v-if="embed" #header-actions>
            <button
              type="button"
              class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('records.genericOpenInNewTab')"
              :title="t('records.genericOpenInNewTab')"
              @click="openRecordInNewTab"
            >
              <ArrowTopRightOnSquareIcon class="w-5 h-5" />
            </button>
            <button
              v-if="supportsEmail"
              type="button"
              class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('records.genericSendEmail')"
              :title="t('records.genericSendEmail')"
              @click="openEmailComposeModal()"
            >
              <EnvelopeIcon class="w-5 h-5" />
            </button>
            <button
              v-if="canEditFormRecord"
              type="button"
              class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('actions.edit')"
              :title="t('actions.edit')"
              @click="handleEditRecord"
            >
              <PencilSquareIcon class="w-5 h-5" />
            </button>
            <button
              v-if="supportsTags"
              ref="tagHeaderButtonRef"
              type="button"
              :class="[
                'relative inline-flex items-center justify-center p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                hasRecordTags
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              ]"
              :aria-label="t('records.genericTagsAria')"
              :title="t('records.genericTagsAria')"
              @click="handleTagIconClick($event)"
            >
              <TagIcon class="block w-5 h-5" />
              <span
                v-if="hasRecordTags"
                class="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-indigo-600 dark:text-indigo-400"
              />
            </button>
            <button
              type="button"
              class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('records.genericCopyUrl')"
              :title="t('records.genericCopyUrl')"
              @click="copyRecordUrl"
            >
              <ClipboardDocumentIcon class="w-5 h-5" />
            </button>
            <Menu as="div" class="relative">
              <MenuButton
                class="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                :aria-label="t('records.genericMoreActions')"
                :title="t('records.genericMoreActions')"
              >
                <EllipsisVerticalIcon class="w-5 h-5" />
              </MenuButton>
              <transition
                enter-active-class="transition ease-out duration-100"
                enter-from-class="transform opacity-0 scale-95"
                enter-to-class="transform opacity-100 scale-100"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="transform opacity-100 scale-100"
                leave-to-class="transform opacity-0 scale-95"
              >
                <MenuItems
                  class="absolute right-0 top-full mt-2 w-48 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 z-50"
                >
                  <MenuItem v-if="canPrintRecord" v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2 sm:hidden',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                      @click="openRecordPrint"
                    >
                      <PrinterIcon class="w-4 h-4" />
                      <span>{{ t('actions.print') }}</span>
                    </button>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                      @click="handleDuplicate"
                    >
                      <DocumentDuplicateIcon class="w-4 h-4" />
                      <span>{{ t('actions.duplicate') }}</span>
                    </button>
                  </MenuItem>
                  <MenuItem v-if="canDiscussInChat" v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                      @click="handleDiscussInChat"
                    >
                      <ChatBubbleOvalLeftEllipsisIcon class="w-4 h-4" />
                      <span>{{ t('internalChat.discussAction') }}</span>
                    </button>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                      @click="handleExport"
                    >
                      <ArrowDownTrayIcon class="w-4 h-4" />
                      <span>{{ t('actions.export') }}</span>
                    </button>
                  </MenuItem>
                  <MenuItem v-if="supportsEmail" v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                      @click="openEmailComposeModal()"
                    >
                      <EnvelopeIcon class="w-4 h-4" />
                      <span>{{ t('records.genericSendEmail') }}</span>
                    </button>
                  </MenuItem>
                  <MenuItem v-if="canArchiveFormRecord" v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                      @click="handleArchiveForm"
                    >
                      <ArchiveBoxIcon class="w-4 h-4" />
                      <span>{{ t('actions.archive') }}</span>
                    </button>
                  </MenuItem>
                  <hr class="my-1 border-gray-200 dark:border-gray-700" />
                  <MenuItem v-if="canDeleteFormRecord" v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-red-600 dark:text-red-400'
                      ]"
                      @click="showDeleteModal = true"
                    >
                      <TrashIcon class="w-4 h-4" />
                      <span>{{ t('actions.delete') }}</span>
                    </button>
                  </MenuItem>
                </MenuItems>
              </transition>
            </Menu>
          </template>
          <template #tab-activity>
            <ActivitySection
              ref="activitySectionRef"
              :events="activityEventsForDisplay"
              :ui="activityUi"
              :is-thread-view-active="isThreadViewActive"
              :active-thread-root-comment="activeThreadRootComment"
              :thread-reply-count="threadReplyCount"
              :activity-pane-ready="true"
              :activity-search-open="activitySearchOpen"
              :activity-search-query="activitySearchQuery"
              :activity-filter-comments="activityFilterComments"
              :activity-filter-updates="activityFilterUpdates"
              :activity-filter-email="activityFilterEmail"
              :activity-filter-done-threads="activityFilterDoneThreads"
              :activity-filter-assigned-to-me="activityFilterAssignedToMe"
              :activity-filter-tagged="activityFilterTagged"
              :activity-filter-untagged="activityFilterUntagged"
              :new-comment-text="newCommentText"
              :show-notifications="false"
              @comment="handleAddComment"
              @close-thread="closeCommentThread"
              @update:activitySearchOpen="activitySearchOpen = $event"
              @update:activitySearchQuery="activitySearchQuery = $event"
              @update:activityFilterComments="activityFilterComments = $event"
              @update:activityFilterUpdates="activityFilterUpdates = $event"
              @update:activityFilterEmail="activityFilterEmail = $event"
              @update:activityFilterDoneThreads="activityFilterDoneThreads = $event"
              @update:activityFilterAssignedToMe="activityFilterAssignedToMe = $event"
              @update:activityFilterTagged="activityFilterTagged = $event"
              @update:activityFilterUntagged="activityFilterUntagged = $event"
              @update:newCommentText="newCommentText = $event"
            />
          </template>
          <template v-if="isFormsModule" #tab-preview>
            <div class="flex h-full flex-col">
              <div class="record-context-panel__header flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.tabPreview') }}</h2>
              </div>
              <div class="min-h-0 flex-1 overflow-y-auto p-4">
                <FormRecordPreviewSection :record="record" :adapter="genericAdapter" :context="sectionContext" />
              </div>
            </div>
          </template>
          <template v-if="canViewFormResponses" #tab-responses>
            <div class="flex h-full flex-col">
              <div class="record-context-panel__header flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.tabResponses') }}</h2>
                <button
                  type="button"
                  class="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                  @click="viewFormResponses"
                >
                  {{ t('common.summaryViewAllResponses') }}
                </button>
              </div>
              <div class="min-h-0 flex-1 overflow-y-auto p-4">
                <FormRecordResponsesHub :record="record" :adapter="genericAdapter" :context="sectionContext" />
              </div>
            </div>
          </template>
          <template #tab-related>
            <div class="flex flex-col h-full">
              <div class="record-context-panel__header flex items-center justify-between gap-2 px-3 sm:px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-900">
                <h2 class="min-w-0 truncate text-base font-semibold text-gray-900 dark:text-white">{{ t('records.relatedTitle') }}</h2>
                <div v-if="canLinkRecords" class="flex shrink-0 items-center gap-1 sm:gap-1.5">
                  <button
                    type="button"
                    class="inline-flex h-8 w-8 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20 lg:w-auto lg:px-2.5"
                    :aria-label="t('records.genericAddRecord')"
                    :title="t('records.genericAddRecord')"
                    @click="openAddRecordDrawer"
                  >
                    <PlusIcon class="h-4 w-4 shrink-0" />
                    <span class="hidden lg:inline">{{ t('records.genericAddRecord') }}</span>
                  </button>
                  <button
                    type="button"
                    class="inline-flex h-8 w-8 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20 lg:w-auto lg:px-2.5"
                    :aria-label="t('records.genericLinkRecord')"
                    :title="t('records.genericLinkRecord')"
                    @click="openLinkRecordDrawer"
                  >
                    <LinkIcon class="h-4 w-4 shrink-0" />
                    <span class="hidden lg:inline">{{ t('records.genericLinkRecord') }}</span>
                  </button>
                </div>
              </div>
              <div class="p-4 overflow-y-auto flex-1 min-h-0">
                <RelatedSection
                  :record="record"
                  :adapter="genericAdapter"
                  :related-groups="genericRelatedGroupsFromContext"
                  :context-revision="contextRevision"
                  :context="{ hideHeader: true }"
                />
              </div>
            </div>
          </template>
          <template #tab-details>
            <RecordDetailsTabPanel
              :record="record"
              :adapter="genericAdapter"
              :context="recordDetailsTabContext"
            />
          </template>
          <template v-if="showRecordDocumentsTab" #tab-documents>
            <div class="flex h-full flex-col">
              <div class="record-context-panel__header flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.genericTabDocuments') }}</h2>
              </div>
              <div class="min-h-0 flex-1 overflow-y-auto p-4">
                <RecordDocumentsPanel
                  v-if="record?._id"
                  :module-key="moduleKey"
                  :record-id="String(record._id)"
                  :app-key="recordContextAppKey"
                  :can-create="canCreateDocuments"
                  :can-edit="canEditDocuments"
                  @documents-changed="handleRecordDocumentsChanged"
                />
              </div>
            </div>
          </template>
          <template v-if="showPeopleAccessTab" #tab-access>
            <div class="flex h-full flex-col">
              <div class="record-context-panel__header flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.genericTabAccess') }}</h2>
              </div>
              <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                <PeopleExternalAccessPanel
                  v-if="recordId && peoplePortalAccess?.visible"
                  :people-id="recordId"
                  display="compact"
                  @manage="openPeopleAccessManage('portal')"
                />
                <PeopleMarketingSubscriptionsPanel
                  v-if="recordId && peopleMarketingAccess?.visible"
                  :people-id="recordId"
                  display="compact"
                  @manage="openPeopleAccessManage('marketing')"
                />
              </div>
            </div>
          </template>
          <template #tab-integrations>
            <div class="flex flex-col h-full">
              <div class="record-context-panel__header flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-900">
                <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.genericIntegrations') }}</h2>
              </div>
              <div class="p-4 overflow-y-auto flex-1 min-h-0 space-y-4">
                <LiveChatLinkedSessionCard
                  v-if="isPeopleModule && record?.liveChat?.sessionId && peopleLiveChatSessionPath"
                  :fetch-path="peopleLiveChatSessionPath"
                  :session-ref="record.liveChat"
                />
                <AutomationContext
                  v-if="record?._id"
                  :entity-type="moduleKey"
                  :entity-id="record._id"
                />
                <p
                  v-if="!hasRecordIntegrationsContent"
                  class="text-sm italic text-gray-600 dark:text-gray-400"
                >
                  {{ t('records.genericNoIntegrations') }}
                </p>
              </div>
            </div>
          </template>
        </RecordRightPane>
      </template>
    </RecordPageShell>

    <CreateRecordDrawer
      v-if="record"
      :is-open="showEditModal"
      :module-key="moduleKey"
      :record="record"
      @close="showEditModal = false"
      @saved="handleRecordUpdated"
    />
    <CreateRecordDrawer
      v-if="showDuplicateCreateModal"
      :key="`duplicate-create-${moduleKey}-${duplicateSourceId}`"
      :is-open="showDuplicateCreateModal"
      :module-key="moduleKey"
      :duplicate-mode="true"
      :initial-data="duplicateInitialData"
      @close="closeDuplicateCreate"
      @saved="handleDuplicateCreated"
    />
    <CreateRecordDrawer
      v-if="showAddRelatedRecordDrawer && addRelatedRecordModuleKey"
      :is-open="showAddRelatedRecordDrawer"
      :module-key="addRelatedRecordModuleKey"
      @close="closeAddRelatedRecordDrawer"
      @saved="handleAddRelatedRecordSaved"
    />

    <DeleteConfirmationModal
      :show="showDeleteModal"
      :record-name="recordTitle"
      :record-type="moduleKey"
      :deleting="deleting"
      @close="showDeleteModal = false"
      @confirm="confirmDelete"
    />

    <AttachToAppModal
      v-if="record && isPeopleModule"
      :key="attachModalTargetApp"
      :is-open="showAttachModal"
      :person-id="record._id"
      :app-key="attachModalTargetApp"
      :participation-type="attachModalParticipationType"
      @close="closeAttachToAppModal"
      @attached="handleAttachModalComplete"
    />

    <ParticipationEditModal
      v-if="record && isPeopleModule && participationEditAppKey"
      :is-open="!!participationEditAppKey"
      :person-id="record._id"
      :app-key="participationEditAppKey"
      :participation-data="participationEditData"
      @close="participationEditAppKey = null"
      @updated="handleParticipationEditUpdated"
    />

    <SalesConvertLeadModal
      v-if="record && isPeopleModule"
      :is-open="showConvertLeadModal"
      :person-id="String(record._id)"
      @close="showConvertLeadModal = false"
      @converted="handleConvertLeadCompleted"
    />

    <PeopleAccessManageDrawer
      v-if="isPeopleModule && peopleRecordId"
      :open="peopleAccessManageOpen"
      :section="peopleAccessManageSection"
      :people-id="peopleRecordId"
      @close="closePeopleAccessManage"
    />

    <EmailComposeDrawer
      v-if="record && supportsEmail"
      :is-open="showEmailModal"
      :related-to="record?._id ? { moduleKey, recordId: String(record._id) } : null"
      :initial-to="emailComposeInitialTo"
      :initial-draft="emailComposeDraft"
      @close="showEmailModal = false; emailComposeDraft = null"
      @submit="handleEmailSubmit"
    />

    <LinkRecordsDrawer
      v-if="record"
      :is-open="showLinkRecordDrawer"
      :module-key="''"
      :source-app-key="recordContextAppKey"
      :source-module-key="moduleKey"
      :multiple="true"
      :allow-create="allowCreateFromLinkDrawer"
      :create-and-link="allowCreateFromLinkDrawer"
      :title="linkRecordDrawerTitle"
      :context="linkRecordDrawerContext"
      :preselected-ids="linkRecordPreselectedIds"
      :supplement-record-types="linkRecordDrawerSupplementTypes"
      @close="closeLinkRecordDrawer"
      @linked="handleLinkRecordDrawerLinked"
      @create="handleLinkRecordDrawerCreate"
    />

    <Teleport to="body">
      <div
        v-if="supportsTags && record && showTagPopover"
        ref="tagPopoverRef"
        :style="tagPopoverStyle"
        :class="['fixed', FLOATING_OVERLAY_Z_CLASS, 'w-[360px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl']"
      >
        <RecordTagPopover
          :record="record"
          :tag-storage-key="tagStorageKey"
          :can-edit="canEditRecord"
          :persist-tags="persistRecordTags"
          :instance-tag-source="moduleKeyLower"
          :fetch-record="fetchRecord"
          :open="showTagPopover"
        />
      </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="showCommentReactionPicker"
        ref="commentReactionPickerRef"
        :style="commentReactionPickerStyle"
        :class="['fixed', FLOATING_OVERLAY_Z_CLASS, 'rounded-xl border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-900']"
      >
        <emoji-picker
          :class="['comment-reaction-emoji-picker', isDarkTheme ? 'dark' : 'light']"
          :theme="emojiPickerTheme"
          :style="{ colorScheme: emojiPickerColorScheme }"
          @emoji-click="handleCommentReactionEmojiClick"
        />
      </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="showCommentReactionTooltip && commentReactionTooltipData"
        ref="commentReactionTooltipRef"
        :class="[
          'fixed', FLOATING_OVERLAY_Z_CLASS, 'rounded-lg bg-slate-950 px-3 py-2 text-white shadow-2xl',
          getReactionTooltipMode(commentReactionTooltipData) === 'single' ? 'w-[10rem]' : 'w-[17rem]'
        ]"
        :style="commentReactionTooltipStyle"
        @mouseenter="cancelCommentReactionTooltipHide"
        @mouseleave="handleHideCommentReactionTooltip"
      >
        <template v-if="getReactionTooltipMode(commentReactionTooltipData) === 'single'">
          <p class="text-center text-3xl leading-none">{{ commentReactionTooltipData.emoji }}</p>
          <p class="mt-2 text-center text-xs leading-4 text-slate-200">
            {{ getReactionTooltipSingleText(commentReactionTooltipData) }}
          </p>
        </template>
        <template v-else-if="getReactionTooltipMode(commentReactionTooltipData) === 'few'">
          <p class="text-center text-3xl leading-none">{{ commentReactionTooltipData.emoji }}</p>
          <p class="mt-2 text-xs leading-4 text-slate-200">
            {{ getReactionTooltipInlineText(commentReactionTooltipData) }}
          </p>
        </template>
        <template v-else>
          <p class="text-xs font-semibold leading-4">
            {{ commentReactionTooltipData.emoji }} {{ commentReactionTooltipData.count }}
            {{ commentReactionTooltipData.count === 1 ? t('records.genericPersonReacted') : t('records.genericPeopleReacted') }}
          </p>
          <ul
            v-if="commentReactionTooltipData.reactors.length > 0"
            class="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1"
          >
            <li
              v-for="reactor in commentReactionTooltipData.reactors.slice(0, 12)"
              :key="`${commentReactionTooltipData.emoji}-${reactor.id || reactor.name}`"
              class="flex items-center gap-2 text-xs text-slate-200"
            >
              <span class="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-800 text-[10px] font-medium uppercase text-slate-100">
                {{ getReactionUserInitial(reactor) }}
              </span>
              <span class="truncate">{{ getReactionUserDisplayName(reactor) }}</span>
            </li>
          </ul>
          <p v-else class="mt-1.5 text-xs leading-4 text-slate-300">{{ t('records.genericReactorUnavailable') }}</p>
        </template>
        <span
          :class="[
            'pointer-events-none absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-950',
            commentReactionTooltipPlacement === 'above' ? 'top-full -mt-1' : 'bottom-full -mb-1'
          ]"
        ></span>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, onActivated, onDeactivated, inject, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useOrganizationTypes } from '@/composables/useOrganizationTypes';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import { fetchModulesListCached } from '@/utils/tenantSchemaApiCache';
import {
  fetchUsersListCached,
  fetchOrganizationsListCached,
  fetchPeopleListCached,
} from '@/utils/recordLookupCache';
import {
  formatPeopleFullNameWithSalutation,
  normalizePeopleFirstNameSavePayload,
  resolvePeopleSalutation,
} from '@/platform/fields/peopleSalutationField';
import { getProcessActivityMessage } from '@/utils/processActivityMessages';
import { resolveOrganizationDerivedStatusSaveFieldKey } from '@/platform/fields/organizationFieldModel';
import { getQuoteActivityMessage, getQuoteActivityActorLabel } from '@/components/activity/adapters/quoteActivityUiAdapter';
import { getSalesOrderActivityMessage } from '@/components/activity/adapters/salesOrderActivityUiAdapter';
import { getInvoiceActivityMessage } from '@/components/activity/adapters/invoiceActivityUiAdapter';
import { getPaymentActivityMessage } from '@/components/activity/adapters/paymentActivityUiAdapter';
import { getDocumentActivityMessage } from '@/components/activity/adapters/documentActivityUiAdapter';
import { resolveModuleDisplayName } from '@/utils/configurableLabelResolver';
import { getModuleRecordCrudPathBase, getModuleRecordDetailPath } from '@/utils/moduleRecordApiPath';
import { resolveRecordDetailRefreshOnActivate } from '@/utils/recordDetailRefreshPolicy';
import { extractRecordUpdatedAtMs, recordRecordDetailFingerprint } from '@/utils/recordDetailFreshness';
import { dispatchRecordUpdated } from '@/utils/moduleListFreshness';
import { canShowFormResponses } from '@/utils/engagementFormDisplay';
import { canEditForm, canHardDeleteForm } from '@/utils/formEditPermissions';
import {
  extractIdFromFormValue,
  getOrgContactCoordinatedPatches,
  normalizeFieldKeyLoose,
  resolveOrgContactPair,
  resolvePersonFromContactLookupList,
  unwrapRecordFromListOrGetResponse,
} from '@/utils/orgContactFormPairing';
import RecordPageShell from '@/components/record-page/RecordPageShell.vue';
import RecordHeader from '@/components/record-page/RecordHeader.vue';
import RecordPrintButton from '@/components/record-page/RecordPrintButton.vue';
import RecordStateSection from '@/components/record-page/RecordStateSection.vue';
import RecordPageTitleRow from '@/components/record-page/RecordPageTitleRow.vue';
import { useStickyTitleRow } from '@/components/record-page/composables/useStickyTitleRow';
import { useRecordModuleBack } from '@/components/record-page/composables/useRecordModuleBack';
import { FLOATING_OVERLAY_Z_CLASS } from '@/constants/zIndexLayers';
import SectionStack from '@/components/record-page/sections/SectionStack.vue';
import TemplateHtmlPreviewPanel from '@/modules/template/components/TemplateHtmlPreviewPanel.vue';
import AppointmentDetailCard from '@/components/appointments/AppointmentDetailCard.vue';
import CaseSlaContextBanner from '@/components/helpdesk/CaseSlaContextBanner.vue';
import LiveChatLinkedSessionCard from '@/components/live-chat/LiveChatLinkedSessionCard.vue';
import QuoteRecordStatusBanner from '@/components/record-page/sections/QuoteRecordStatusBanner.vue';
import QuoteCustomerResponseBanner from '@/components/record-page/sections/QuoteCustomerResponseBanner.vue';
import RelatedSection from '@/components/record-page/sections/RelatedSection.vue';
import RecordDetailsTabPanel from '@/components/record-page/RecordDetailsTabPanel.vue';
import RecordRightPane from '@/components/record-page/RecordRightPane.vue';
import RecordDocumentsPanel from '@/components/record-page/RecordDocumentsPanel.vue';
import EditableTitle from '@/components/record-page/EditableTitle.vue';
import RecordTagPopover from '@/components/record-page/RecordTagPopover.vue';
import { useRecordTagPopoverPosition } from '@/components/record-page/composables/useRecordTagPopoverPosition';
import { useRecordContext, invalidateRecordContext, mergeLinkedRecordsIntoContext } from '@/composables/useRecordContext';
import { refreshRelatedRecordsAfterLookupFieldSave } from '@/composables/useLookupFieldRelatedSync';
import { refreshRelatedRecordsAfterDocumentChange } from '@/composables/useDocumentRelatedSync';
import { resolveDocumentRelationshipKey } from '@/constants/documentAttachments';
import ActivitySection from '@/components/activity/ActivitySection.vue';
import {
  buildCommentReactions,
  isCommentReactionSelectedForUser
} from '@/components/activity/utils/commentReactionModel';
import { createCommentReactionApi } from '@/components/activity/utils/commentReactionApi';
import { useCommentReactionActions } from '@/components/activity/composables/useCommentReactionActions';
import { useCommentReactionTooltip } from '@/components/activity/composables/useCommentReactionTooltip';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import { buildDuplicateInitialData } from '@/utils/duplicateRecord';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';
import EmailComposeDrawer from '@/components/communications/EmailComposeDrawer.vue';
import AutomationContext from '@/components/automation/AutomationContext.vue';
import LinkRecordsDrawer from '@/components/common/LinkRecordsDrawer.vue';
import { createGenericRecordAdapter } from '@/components/record-page/adapters/genericRecordAdapter';
import { createFormRecordAdapter } from '@/components/record-page/adapters/formRecordAdapter';
import FormRecordAnalyticsStrip from '@/components/record-page/sections/FormRecordAnalyticsStrip.vue';
import FormRecordPreviewSection from '@/components/record-page/sections/FormRecordPreviewSection.vue';
import FormRecordShareLinkPanel from '@/components/record-page/sections/FormRecordShareLinkPanel.vue';
import FormRecordResponsesHub from '@/components/record-page/sections/FormRecordResponsesHub.vue';
import { createItemsRecordAdapter } from '@/components/record-page/adapters/itemsRecordAdapter';
import { createOrganizationsRecordAdapter } from '@/components/record-page/adapters/organizationsRecordAdapter';
import { createQuotesRecordAdapter } from '@/components/record-page/adapters/quotesRecordAdapter';
import { createSalesOrdersRecordAdapter } from '@/components/record-page/adapters/salesOrdersRecordAdapter';
import { createPurchaseOrdersRecordAdapter } from '@/components/record-page/adapters/purchaseOrdersRecordAdapter';
import { createPurchaseReturnsRecordAdapter } from '@/components/record-page/adapters/purchaseReturnsRecordAdapter';
import { createDeliveryReturnsRecordAdapter } from '@/components/record-page/adapters/deliveryReturnsRecordAdapter';
import { createSalesReturnsRecordAdapter } from '@/components/record-page/adapters/salesReturnsRecordAdapter';
import { createDeliveryNotesRecordAdapter } from '@/components/record-page/adapters/deliveryNotesRecordAdapter';
import { createReceiptNotesRecordAdapter } from '@/components/record-page/adapters/receiptNotesRecordAdapter';
import { createStockAdjustmentsRecordAdapter } from '@/components/record-page/adapters/stockAdjustmentsRecordAdapter';
import { createStockTransfersRecordAdapter } from '@/components/record-page/adapters/stockTransfersRecordAdapter';
import { createInvoicesRecordAdapter } from '@/components/record-page/adapters/invoicesRecordAdapter';
import { createPaymentsRecordAdapter } from '@/components/record-page/adapters/paymentsRecordAdapter';
import { createDocumentsRecordAdapter } from '@/components/record-page/adapters/documentsRecordAdapter';
import { createRecordSectionLabels } from '@/utils/recordSectionLabels';
import {
  applyQuoteLineDeleteToRecord,
  applyQuoteLinesAddToRecord,
  applyQuoteLinesMutationToRecord,
  applyQuoteLinesRecalculateToRecord,
  applyQuoteHeaderPatchToRecord,
  applyQuoteDiscountsToRecord,
  applyQuoteSectionsToRecord
} from '@/utils/quoteRecordPatch';
import { useRecordTags, getDefaultTagChipClass } from '@/components/record-page/composables/useRecordTags';
import {
  normalizeSystemActivityEvent,
  normalizeCommentActivityEvent,
  normalizeEmailThreadActivityEvent,
  sortActivityEventsByDate
} from '@/components/record-page/activityEventModel';
import { normalizeActivityUiContract } from '@/components/activity/activityUiContract';
import { useNotifications } from '@/composables/useNotifications';
import { useOpenEmailCompose } from '@/composables/useOpenEmailCompose';
import dateUtils from '@/utils/dateUtils';
import { formatRelativeTime } from '@/utils/relativeTime';
import {
  PencilSquareIcon,
  ClipboardDocumentIcon,
  TrashIcon,
  UserCircleIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  CubeIcon,
  DocumentTextIcon,
  TagIcon,
  EllipsisVerticalIcon,
  DocumentDuplicateIcon,
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  EnvelopeIcon,
  PrinterIcon,
  LinkIcon,
  PlusIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowsPointingInIcon,
  ArrowTopRightOnSquareIcon,
  ArrowRightCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  ClipboardDocumentListIcon,
  PuzzlePieceIcon,
  Bars3BottomLeftIcon,
  KeyIcon,
  ChatBubbleOvalLeftEllipsisIcon
} from '@heroicons/vue/24/outline';
import { getModuleIconComponent } from '@/utils/moduleIcons';
import Avatar from '@/components/common/Avatar.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import { toRichContentPayload, isRichDocument, getRichContentHtml } from '@/utils/documentRichContent';
import { useDocuments } from '@/composables/useDocuments';
import DocumentEditorPage from '@/components/documents/DocumentEditorPage.vue';
import ContentVersionHistoryView from '@/components/record-page/ContentVersionHistoryView.vue';
import {
  buildContentVersionHistoryList,
  buildDescriptionActivityDiff,
  getPlainTextFromHtml,
  isDescriptionActivityFieldChange
} from '@/utils/contentVersionHistory';
import { formatActivityChangeValue } from '@/utils/fieldDisplay';
import RecordPresenceAvatars from '@/components/record-page/RecordPresenceAvatars.vue';
import { useRecordPresence } from '@/composables/useRecordPresence';
import { isRecordPresenceSupported } from '@/utils/recordPresence';
import { resolveFieldContext } from '@/utils/fieldContextFilter';
import { supportsDocumentAttachments } from '@/constants/documentAttachments';
import { getParticipation } from '@/utils/getParticipation';
import { getAppLabel } from '@/utils/getRoleDisplay';
import {
  getPeopleParticipationEntries,
  filterParticipationEntriesByContext,
  isPeopleListAppContext,
  isPeopleSalesLeadFromFields,
  PEOPLE_PARTICIPATION_APP_KEYS
} from '@/utils/peopleParticipationUi';
import { usePeopleTypes } from '@/composables/usePeopleTypes';
import { typeDefsToBadgeOptions } from '@/utils/peopleTypeColors';
import AttachToAppModal from '@/components/people/AttachToAppModal.vue';
import ParticipationEditModal from '@/components/people/ParticipationEditModal.vue';
import SalesConvertLeadModal from '@/components/people/SalesConvertLeadModal.vue';
import PeopleExternalAccessPanel from '@/components/people/PeopleExternalAccessPanel.vue';
import PeopleMarketingSubscriptionsPanel from '@/components/people/PeopleMarketingSubscriptionsPanel.vue';
import PeopleRecordAccessChips from '@/components/people/PeopleRecordAccessChips.vue';
import PeopleAccessManageDrawer from '@/components/people/PeopleAccessManageDrawer.vue';
import { resolvePeoplePortalAccess } from '@/composables/usePeoplePortalAccess';
import { resolvePeopleMarketingSubscriptions } from '@/composables/usePeopleMarketingSubscriptions';
import { getParticipationFields } from '@/platform/fields/peopleFieldModel';
import { hasPeoplePermission } from '@/platform/permissions/peoplePermissionHelper';
import { PEOPLE_PERMISSIONS } from '@/platform/permissions/peoplePermissions';
import EventRecordExecutionPanel from '@/components/events/EventRecordExecutionPanel.vue';
import 'emoji-picker-element';

import { confirmAction } from '@/composables/useConfirmAction';
import { formatUserDate, formatUserDateTime } from '@/utils/localeFormat';
import { isAddonEntitled } from '@/utils/addonEntitlement';
import { openRecordDiscussChat } from '@/utils/internalChatApi';
const { t, te } = useI18n();

const formatAppLabel = (appKey) => getAppLabel(appKey) || appKey || 'App';

const props = defineProps({
  moduleKey: { type: String, required: true },
  recordId: { type: String, required: true },
  embed: { type: Boolean, default: false }
});

const emit = defineEmits(['close']);

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { typeDefs: organizationTypeDefs } = useOrganizationTypes();
const {
  reserveDocument,
  releaseReservation,
  takeoverReservation,
  notifyReservationHolder
} = useDocuments();
const notifications = useNotifications();
const { guardAndOpenEmailCompose } = useOpenEmailCompose();
const { openTab, activeTabId, findTabById, findTabByPath, switchToTab, updateTabTitle, replaceActiveTab } = useTabs();
const { goBackToModuleList } = useRecordModuleBack();
const recordLayoutIsMobile = inject('recordLayoutIsMobile', ref(false));
const quickPreviewNav = inject('quickPreviewNav', null);

const record = ref(null);
const loading = ref(true);
const error = ref(null);
const moduleDefinition = ref(null);
const activityRaw = ref([]);
  const emailThreads = ref([]);
  const neighbors = ref({ previousId: null, nextId: null });
  const expandedLeftSection = ref('');
  const suppressDocumentEditorAutoOpen = ref(false);
  const descriptionVersionsData = ref({ currentDescription: '', currentContent: '', versions: [] });
  const contentVersionHistoryMode = ref('description');
  const selectedDescriptionVersionIndex = ref(0);
  const descriptionVersionsLoading = ref(false);
  const descriptionRestoreLoading = ref(false);
  const richContentFlushSave = ref(null);
  const newCommentText = ref('');
  const activitySectionRef = ref(null);
  const editingCommentId = ref(null);
  const editingCommentText = ref('');
  const editingCommentAttachments = ref([]);
  const editingCommentOriginalText = ref('');
  const editingCommentOriginalAttachments = ref([]);
  const editingCommentHasPendingFiles = ref(false);
  const activitySearchOpen = ref(false);
  const activitySearchQuery = ref('');
  const activityFilterComments = ref(true);
  const activityFilterUpdates = ref(true);
  const activityFilterEmail = ref(true);
  const activityFilterDoneThreads = ref(false);
  const activityFilterAssignedToMe = ref(false);
  const activityFilterTagged = ref(false);
  const activityFilterUntagged = ref(false);
  const expandedTaskEmailThreads = ref(new Set());
  const showDeleteModal = ref(false);
const showEditModal = ref(false);
const showDuplicateCreateModal = ref(false);
const duplicateInitialData = ref({});
const duplicateSourceId = ref('');
const showEmailModal = ref(false);
const emailComposeDraft = ref(null);

function openEmailComposeModal(draft = null) {
  void guardAndOpenEmailCompose(() => {
    emailComposeDraft.value = draft && typeof draft === 'object' ? draft : null;
    showEmailModal.value = true;
  });
}

function onOpenEmailComposeEvent(event) {
  if (!supportsEmail.value) return;
  const detail = event?.detail && typeof event.detail === 'object' ? event.detail : null;
  openEmailComposeModal(detail);
}
const showLinkRecordDrawer = ref(false);
const activeThreadRootCommentId = ref(null);
const showCommentReactionPicker = ref(false);
const commentReactionPickerCommentKey = ref('');
const commentReactionPickerPosition = ref({ top: 0, left: 0 });
const commentReactionButtonRefs = new Map();
const commentReactionPickerRef = ref(null);
const isDarkTheme = ref(false);
const emojiPickerTheme = computed(() => (isDarkTheme.value ? 'dark' : 'light'));
const emojiPickerColorScheme = computed(() => (isDarkTheme.value ? 'dark' : 'light'));
let emojiThemeObserver = null;
const allowCreateFromLinkDrawer = ref(false);
const showAddRelatedRecordDrawer = ref(false);
const addRelatedRecordModuleKey = ref('');
const pendingAddRelatedLinkPayload = ref(null);
const showAttachModal = ref(false);
const showConvertLeadModal = ref(false);
const attachModalTargetApp = ref('SALES');
/** Preset SALES classifier (Lead/Contact); null for HELPDESK (picker uses tenant types). */
const attachModalParticipationType = ref('LEAD');

function openAttachToAppModal(appKey) {
  attachModalTargetApp.value = appKey;
  attachModalParticipationType.value = appKey === 'SALES' ? 'LEAD' : null;
  showAttachModal.value = true;
}

function closeAttachToAppModal() {
  showAttachModal.value = false;
}
const participationEditAppKey = ref(null);

/** Build participationData for ParticipationEditModal */
function buildParticipationDataForEdit(person, appKey) {
  const part = getParticipation(person, appKey);
  const fields = {};
  const upper = String(appKey || '').toUpperCase();

  if (part && upper === 'SALES') {
    if (part.role != null && part.role !== '') fields.sales_type = part.role;
    if (part.lead_status != null && part.lead_status !== '') fields.lead_status = part.lead_status;
    if (part.contact_status != null && part.contact_status !== '') fields.contact_status = part.contact_status;
  }
  if (part && upper === 'HELPDESK') {
    if (part.role != null && part.role !== '') fields.helpdesk_role = part.role;
  }

  const fieldKeys = getParticipationFields(appKey);
  for (const fk of fieldKeys) {
    const v = person?.[fk];
    if (v != null && v !== '' && fields[fk] == null) fields[fk] = v;
  }

  // Flattened people API aliases when participations block above did not set state
  if (upper === 'SALES' && (fields.sales_type == null || fields.sales_type === '')) {
    const st = person?.sales_type;
    if (st != null && st !== '') fields.sales_type = st;
  }
  if (upper === 'HELPDESK' && (fields.helpdesk_role == null || fields.helpdesk_role === '')) {
    const hr = person?.helpdesk_role;
    if (hr != null && hr !== '') fields.helpdesk_role = hr;
  }

  return { fields };
}

const participationEditData = computed(() => {
  if (!record.value || !participationEditAppKey.value) return { fields: {} };
  return buildParticipationDataForEdit(record.value, participationEditAppKey.value);
});

function canEditParticipationFor(appKey) {
  const perm = PEOPLE_PERMISSIONS.EDIT_PARTICIPATION[appKey] || PEOPLE_PERMISSIONS.EDIT_PARTICIPATION.BASE;
  return hasPeoplePermission(perm, authStore);
}

function openParticipationEdit(appKey) {
  participationEditAppKey.value = appKey;
}

async function handleParticipationEditUpdated(updated) {
  participationEditAppKey.value = null;
  if (updated && record.value) Object.assign(record.value, updated);
  await fetchRecord();
}
/** Organization list for people record page (organization field dropdown). Fetched when moduleKey is people. */
const peopleOrganizationList = ref([]);
/** People + org lists for helpdesk case contact / organization ref fields (Details inline edit). */
const caseContactLookupList = ref([]);
const caseOrganizationLookupList = ref([]);
/** Quotes: contact/org/deal lists for Details inline edit. */
const quoteContactLookupList = ref([]);
const quoteOrganizationLookupList = ref([]);
const quoteDealLookupList = ref([]);

/** CRM org id on a person row from /people list (populated or id). */
function casePersonRowOrgId(p) {
  if (!p) return '';
  const o = p.organization;
  if (o == null || o === '') return '';
  if (typeof o === 'object' && o._id != null) return String(o._id);
  return String(o);
}

/**
 * When an account is set on the case, limit contact choices to that org; always include the current contact so the value is not blanked in the UI.
 * Org + contact: org filters the list; org/contact coordination is in DynamicForm and saveDetailField (clear contact on org mismatch; set org from contact).
 */
function caseContactOptionsForRecord(rec, allContacts) {
  if (!Array.isArray(allContacts) || allContacts.length === 0) return allContacts || [];
  if (!rec) return allContacts;
  const rawOrg = rec.organizationRefId;
  const orgId = rawOrg
    ? (typeof rawOrg === 'object' && rawOrg?._id != null ? rawOrg._id : rawOrg)
    : null;
  if (orgId == null || orgId === '') return allContacts;
  const orgStr = String(orgId);
  const filtered = allContacts.filter((p) => {
    const pid = casePersonRowOrgId(p);
    return pid && pid === orgStr;
  });
  const rawContact = rec.contactId;
  const contactId = rawContact
    ? (typeof rawContact === 'object' && rawContact?._id != null ? rawContact._id : rawContact)
    : null;
  if (!contactId) return filtered;
  if (filtered.some((p) => String(p._id) === String(contactId))) return filtered;
  const selected = allContacts.find((p) => String(p._id) === String(contactId));
  return selected ? [...filtered, selected] : filtered;
}
/** Document folders for folderId lookup on document record Details. */
const documentFolderLookupList = ref([]);
/** Tenant user list used to render user lookup labels (e.g., assignedTo) in generic sections. */
const userLookupList = ref([]);
/** Catalog category tree flattened for items.categoryId key/detail fields. */
const catalogCategoryLookupList = ref([]);
const deleting = ref(false);
const rightPaneRef = ref(null);
let fetchRecordRunId = 0;

const genericRecordContentRootRef = ref(null);
const {
  isLeftTitleSticky,
  attachWhenReady: attachStickyTitleWhenReady,
  detach: detachStickyTitle,
  reset: resetStickyTitle
} = useStickyTitleRow(genericRecordContentRootRef);

const moduleKeyLower = computed(() => (props.moduleKey || '').toLowerCase());
const isTemplatesModule = computed(() => moduleKeyLower.value === 'templates');
const isEventsModule = computed(() => moduleKeyLower.value === 'events');
const isEventAppointment = computed(
  () => isEventsModule.value && !!record.value?.appointment?.isAppointment
);
const eventExecutionRouteId = computed(() => {
  const r = record.value;
  if (!r) return '';
  return String(r.eventId || r._id || '').trim();
});
const eventLifecycleStatus = computed(() => {
  const status = String(record.value?.status || '').trim();
  return status || null;
});
const eventStatusBadgeVariantMap = {
  planned: 'info',
  scheduled: 'info',
  completed: 'success',
  cancelled: 'danger',
  canceled: 'danger',
  'in-progress': 'warning',
  'in progress': 'warning'
};
const eventExecutionPanelRef = ref(null);
/** REST + in-app paths for record CRUD (helpdesk cases use /helpdesk/cases, not /cases). */
const recordCrudPathBase = computed(() =>
  getModuleRecordCrudPathBase(props.moduleKey, {
    appKey: route.meta?.appKey,
    routePath: route.path
  })
);
const recordRouteOptions = computed(() => ({
  appKey: route.meta?.appKey,
  routePath: route.path
}));
function recordDetailPathForId(recordId) {
  return getModuleRecordDetailPath(props.moduleKey, recordId, recordRouteOptions.value);
}
const isFormsModule = computed(() => moduleKeyLower.value === 'forms');
const isFormActive = computed(() => isFormsModule.value && record.value?.status === 'Active');
const isEngagementForm = computed(() => {
  if (!isFormsModule.value || !record.value) return false;
  const type = String(record.value.formType || '').toLowerCase();
  return type === 'survey' || type === 'feedback';
});
const hasFormPublicLink = computed(() => {
  const link = record.value?.publicLink;
  return Boolean(link?.enabled && link?.slug);
});
const showFormNotActiveBanner = computed(() => {
  if (!isFormsModule.value || isFormActive.value) return false;
  if (isEngagementForm.value && hasFormPublicLink.value) return false;
  return true;
});
const formNotActiveHint = computed(() => {
  if (isEngagementForm.value) {
    return t('forms.recordNotActiveEngagementHint');
  }
  return t('common.summaryFormNotActiveHint');
});
const canEditFormRecord = computed(() => {
  if (!isFormsModule.value || !record.value) return true;
  return canEditForm(record.value.status, record.value.formType);
});
const canManageEngagementShareLink = computed(() => {
  if (!isFormsModule.value || !isEngagementForm.value || !record.value) return false;
  if (String(record.value.status || '') === 'Archived') return false;
  return canEditRecord.value;
});
const canArchiveFormRecord = computed(() => {
  if (!isFormsModule.value || !record.value) return false;
  return String(record.value.status || '') !== 'Archived';
});
const canViewFormResponses = computed(() => {
  if (!isFormsModule.value || !record.value) return false;
  return canShowFormResponses(record.value);
});
const canDeleteFormRecord = computed(() => {
  if (!isFormsModule.value) return true;
  return canHardDeleteForm(record.value, formResponseSummary.value);
});
const formRecordSubtitle = computed(() => {
  if (!isFormsModule.value || !record.value) return '';
  return record.value.formType || '';
});
const formStatusBadgeVariantMap = {
  Draft: 'default',
  Ready: 'info',
  Active: 'success',
  Archived: 'default'
};

const formAnalyticsLoading = ref(false);
const formAnalytics = ref(null);
const formResponseSummary = ref(null);
const formResponseSummaryLoading = ref(false);
const formResponses = ref([]);
const formResponsesLoading = ref(false);
const formResponsesPagination = ref({
  currentPage: 1,
  limit: 10,
  total: 0,
  totalPages: 1
});

function notifyListRecordUpdated(updatedRecord = null) {
  dispatchRecordUpdated({
    moduleKey: moduleKeyLower.value || props.moduleKey,
    recordId: props.recordId,
    record: updatedRecord || record.value,
    appKey: route.meta?.appKey || ''
  });
}

async function updateRecordFields(payload) {
  const path = `${recordCrudPathBase.value}/${props.recordId}`;
  const response = moduleKeyLower.value === 'documents'
    ? await apiClient.patch(path, payload)
    : await apiClient.put(path, payload);
  const updatedRecord = response?.data?.data ?? response?.data ?? null;
  notifyListRecordUpdated(updatedRecord);
  return response;
}
const isPeopleModule = computed(() => moduleKeyLower.value === 'people');

const peopleRecordId = computed(() => {
  if (!isPeopleModule.value || !record.value?._id) return null;
  return String(record.value._id);
});
const peoplePortalAccess = resolvePeoplePortalAccess(peopleRecordId);
const peopleMarketingAccess = resolvePeopleMarketingSubscriptions(peopleRecordId);
const showPeopleAccessTab = computed(
  () =>
    Boolean(peoplePortalAccess.value?.isEligible || peopleMarketingAccess.value?.isEligible)
);
const peopleAccessManageOpen = ref(false);
const peopleAccessManageSection = ref('portal');

const hasRecordIntegrationsContent = computed(() => Boolean(record.value?._id));

function openPeopleAccessTab() {
  rightPaneRef.value?.openTab?.('access');
}

function openPeopleAccessManage(section) {
  peopleAccessManageSection.value = section;
  peopleAccessManageOpen.value = true;
}

function closePeopleAccessManage() {
  peopleAccessManageOpen.value = false;
}

const peopleLiveChatSessionPath = computed(() => {
  if (!isPeopleModule.value || !record.value?._id) return '';
  return `${recordCrudPathBase.value}/${String(record.value._id)}/live-chat-session`;
});
const supportsTags = computed(() => ['people', 'organizations', 'documents'].includes(moduleKeyLower.value));

const peopleParticipationEntries = computed(() => {
  const r = record.value;
  if (!r || !isPeopleModule.value) return [];
  return getPeopleParticipationEntries(r);
});

const routeParticipationContext = computed(() =>
  String(route.query?.context || route.query?.participationContext || 'ALL').toUpperCase()
);

/** Route context is SALES | HELPDESK: show only that app’s participation (role-only in header/section). */
const peopleContextIsAppView = computed(() =>
  isPeopleListAppContext(routeParticipationContext.value)
);

/** Participation rows visible for current route context (ALL = every app with data). */
const peopleParticipationEntriesVisible = computed(() =>
  filterParticipationEntriesByContext(
    peopleParticipationEntries.value,
    routeParticipationContext.value
  )
);

const participationRoleBadgeVariantMap = {
  Lead: 'warning',
  Contact: 'success',
  Qualified: 'info',
  Opportunity: 'primary',
  Customer: 'success',
  Agent: 'info',
  Lost: 'danger'
};

const { typeDefs: salesPeopleTypeDefsRecord } = usePeopleTypes('SALES');
const { typeDefs: helpdeskPeopleTypeDefsRecord } = usePeopleTypes('HELPDESK');

const peopleTypeBadgeOptionsByAppRecord = computed(() => ({
  SALES: typeDefsToBadgeOptions(salesPeopleTypeDefsRecord.value),
  HELPDESK: typeDefsToBadgeOptions(helpdeskPeopleTypeDefsRecord.value)
}));

function badgeOptionsForParticipationApp(appKey) {
  return peopleTypeBadgeOptionsByAppRecord.value[appKey] || [];
}

function participationAppBadgeClass(appLabel) {
  const classMap = {
    Sales: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    Helpdesk: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
    Audit: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
    Portal: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
    Projects: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200'
  };
  return classMap[appLabel] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-200';
}

/** Sales Lead: show “Convert to Contact” on the Sales app row (same lifecycle permission as ParticipationCard). */
const showPeopleConvertLeadPrimary = computed(() => {
  if (!isPeopleModule.value || !record.value) return false;
  const r = record.value;
  const salesType = r.sales_type ?? getParticipation(r, 'SALES')?.role;
  if (!isPeopleSalesLeadFromFields({ sales_type: salesType })) return false;
  return hasPeoplePermission(PEOPLE_PERMISSIONS.LIFECYCLE.SALES, authStore);
});

async function handleConvertLeadCompleted() {
  await fetchRecord();
}

/** Apps from PEOPLE_PARTICIPATION_APP_KEYS where the person has no participation and user may attach */
const attachableAppsMissingParticipation = computed(() => {
  const r = record.value;
  if (!isPeopleModule.value || !r) return [];
  return [...PEOPLE_PARTICIPATION_APP_KEYS].filter((app) => {
    if (getParticipation(r, app)) return false;
    const perm = PEOPLE_PERMISSIONS.ATTACH[app] || PEOPLE_PERMISSIONS.ATTACH.BASE;
    return hasPeoplePermission(perm, authStore);
  });
});

/** In app route context, only offer attach for that app */
const attachableAppsForRecordContext = computed(() => {
  const raw = attachableAppsMissingParticipation.value;
  const ctx = routeParticipationContext.value;
  if (isPeopleListAppContext(ctx)) {
    return raw.filter((app) => app === ctx);
  }
  return raw;
});
const supportsEmail = computed(() => {
  const key = moduleKeyLower.value;
  // Cases keep their own email UX; do not surface generic header compose here.
  if (key === 'cases') return false;
  if (key === 'people') return true;

  const defRels = Array.isArray(moduleDefinition.value?.relationships)
    ? moduleDefinition.value.relationships
    : [];
  if (relationshipsIncludePeople(defRels)) return true;

  const fields = Array.isArray(moduleDefinition.value?.fields)
    ? moduleDefinition.value.fields
    : [];
  if (fields.some((field) => {
    const lookup = String(field?.lookupModule || field?.targetModule || '').toLowerCase();
    return lookup === 'people';
  })) {
    return true;
  }

  const ctxRels = Array.isArray(genericRecordContext.value?.relationships)
    ? genericRecordContext.value.relationships
    : [];
  return ctxRels.some((rel) => {
    const linkedModule = String(
      rel?.target?.moduleKey
      || rel?.source?.moduleKey
      || rel?.moduleKey
      || ''
    ).toLowerCase();
    if (linkedModule === 'people') return true;
    const records = Array.isArray(rel?.records) ? rel.records : [];
    return records.some((r) => String(r?.moduleKey || '').toLowerCase() === 'people');
  });
});

function relationshipsIncludePeople(relationships) {
  if (!Array.isArray(relationships) || relationships.length === 0) return false;
  return relationships.some((rel) => {
    const target = String(rel?.targetModuleKey || rel?.target?.moduleKey || '').toLowerCase();
    const source = String(rel?.sourceModuleKey || rel?.source?.moduleKey || '').toLowerCase();
    return target === 'people' || source === 'people';
  });
}

/** Default To: line for EmailComposeDrawer (person email or first related people contact). */
const emailComposeInitialTo = computed(() => {
  const r = record.value;
  if (!r) return '';
  if (moduleKeyLower.value === 'people' && r.email) {
    return String(r.email).trim();
  }
  const ctxRels = Array.isArray(genericRecordContext.value?.relationships)
    ? genericRecordContext.value.relationships
    : [];
  for (const rel of ctxRels) {
    const records = Array.isArray(rel?.records) ? rel.records : [];
    for (const item of records) {
      const itemModule = String(item?.moduleKey || rel?.target?.moduleKey || rel?.source?.moduleKey || '').toLowerCase();
      if (itemModule !== 'people') continue;
      const email = String(item?.email || '').trim();
      if (email) return email;
    }
  }
  if (r.email) return String(r.email).trim();
  if (r.primaryContact?.email) return String(r.primaryContact.email).trim();
  if (r.contactId && typeof r.contactId === 'object' && r.contactId.email) {
    return String(r.contactId.email).trim();
  }
  return '';
});

/** App key for record context / link drawer (must match RelationshipDefinition source/target appKey). */
const recordContextAppKey = computed(() => {
  const metaApp = String(route.meta?.appKey || '').toUpperCase();
  if (metaApp) return metaApp;
  const key = moduleKeyLower.value;
  // Core Sales domain entities share relationship definitions under SALES
  if (key === 'people' || key === 'organizations' || key === 'deals' || key === 'items') return 'SALES';
  const p = String(route.path || '').toLowerCase();
  if (p.startsWith('/helpdesk/')) return 'HELPDESK';
  if (p.startsWith('/audit/')) return 'AUDIT';
  if (p.startsWith('/portal/')) return 'PORTAL';
  if (p.startsWith('/projects/')) return 'PROJECTS';
  return 'PLATFORM';
});

const linkRecordDrawerContext = computed(() => {
  const id = record.value?._id;
  if (!id) return {};
  const key = (props.moduleKey || '').toLowerCase();
  if (key === 'people') return { personId: id };
  if (key === 'organizations') return { sourceRecordId: id, organizationId: id };
  return { sourceRecordId: id };
});

const linkRecordPreselectedIds = computed(() => {
  const key = (props.moduleKey || '').toLowerCase();
  if (key === 'people') {
    const rawOrg = record.value?.organization;
    if (!rawOrg) return [];
    const orgId = typeof rawOrg === 'object' ? rawOrg._id : rawOrg;
    return orgId ? [String(orgId)] : [];
  }
  if (key === 'organizations') {
    const rels = Array.isArray(genericRecordContext.value?.relationships)
      ? genericRecordContext.value.relationships
      : [];
    const peopleRel = rels.find(
      (rel) => String(rel?.relationshipKey || '').toLowerCase() === 'people_organizations'
    );
    const records = Array.isArray(peopleRel?.records) ? peopleRel.records : [];
    return records
      .map((r) => r.recordId ?? r.id ?? r._id)
      .filter(Boolean)
      .map((id) => String(id));
  }
  return [];
});

const openLinkRecordDrawer = () => {
  allowCreateFromLinkDrawer.value = false;
  showLinkRecordDrawer.value = true;
};

const openAddRecordDrawer = () => {
  allowCreateFromLinkDrawer.value = true;
  showLinkRecordDrawer.value = true;
};

const closeLinkRecordDrawer = () => {
  showLinkRecordDrawer.value = false;
  allowCreateFromLinkDrawer.value = false;
};

const closeAddRelatedRecordDrawer = () => {
  showAddRelatedRecordDrawer.value = false;
  addRelatedRecordModuleKey.value = '';
  pendingAddRelatedLinkPayload.value = null;
};

const canLinkRecords = computed(() => {
  if (isFormsModule.value) return false;
  if (moduleKeyLower.value === 'purchase_orders') {
    return authStore.can?.('inventory', 'adjust') ?? false;
  }
  if (moduleKeyLower.value === 'receipt_notes') {
    return authStore.can?.('inventory', 'adjust') ?? false;
  }
  if (moduleKeyLower.value === 'purchase_returns') {
    return authStore.can?.('inventory', 'adjust') ?? false;
  }
  if (moduleKeyLower.value === 'delivery_returns') {
    return authStore.can?.('inventory', 'adjust') ?? false;
  }
  if (moduleKeyLower.value === 'delivery_notes') {
    return authStore.can?.('inventory', 'adjust') ?? false;
  }
  return authStore.can(props.moduleKey, 'edit');
});

const { context: genericRecordContext, contextRevision, load: loadGenericRecordContext, canUnlink: genericRecordContextCanUnlink } = useRecordContext(
  () => recordContextAppKey.value,
  () => props.moduleKey,
  () => props.recordId || record.value?._id || ''
);
watch(() => props.recordId, () => {
  suppressDocumentEditorAutoOpen.value = false;
  expandedLeftSection.value = '';
  if (props.recordId) loadGenericRecordContext(true);
}, { immediate: true });

function resolveRelatedGroupLabel(relationshipKey, rel, isOrganizationModule) {
  const key = String(relationshipKey || '').toLowerCase();
  const labelByKey = {
    deal_contacts: 'Linked Deals',
    people_deals: 'Related Deals',
    people_documents: 'Related Documents',
    quote_people: 'Related Quotes',
    case_people: 'Related Cases'
  };
  if (labelByKey[key]) return labelByKey[key];

  const fromContext = rel?.ui?.label || rel?.label;
  if (fromContext && String(fromContext).toLowerCase() !== key) {
    return fromContext;
  }
  if (isOrganizationModule && key === 'people_organizations') {
    return t('organizations.relatedContactsWidgetRelatedContacts');
  }
  if (!isOrganizationModule && key === 'people_organizations') {
    return t('organizations.relatedOrganizationWidgetRelatedOrganizations');
  }
  return fromContext || relationshipKey || 'Related';
}

const genericRelatedGroupsFromContext = computed(() => {
  const isOrganizationModule = moduleKeyLower.value === 'organizations';

  const contextRelationships = Array.isArray(genericRecordContext.value?.relationships)
    ? genericRecordContext.value.relationships
    : [];

  const relationshipsForGroups = contextRelationships.filter((rel) => {
    const relKey = String(rel?.relationshipKey || '').toLowerCase();
    if (relKey.endsWith('_documents')) return Array.isArray(rel.records) && rel.records.length > 0;
    return String(rel?.ui?.showAs || 'TAB').toUpperCase() !== 'NONE';
  });

  const groups = relationshipsForGroups
    .filter((rel) => Array.isArray(rel.records) && rel.records.length > 0)
    .map((rel) => {
      const key = rel.relationshipKey || rel.label || 'related';
      const label = resolveRelatedGroupLabel(key, rel, isOrganizationModule);
      const direction = (rel.direction || 'SOURCE').toUpperCase();
      const items = (rel.records || [])
        .map((r) => {
        const id = r.recordId ?? r.id ?? r._id;
        const moduleKey = (r.moduleKey || '').toLowerCase();
        const appKey = (r.appKey || 'SALES').toUpperCase();
        const path = moduleKey && id
          ? getModuleRecordDetailPath(moduleKey, id, { appKey: r.appKey })
          : null;
        const personName = [r.first_name || r.firstName || '', r.last_name || r.lastName || '']
          .filter(Boolean)
          .join(' ')
          .trim();
        const displayTitle = r.label || r.name || r.title || r.quoteTitle || r.item_name || personName || r.email;
        const fallbackTitle = id ? String(id).slice(0, 8) : 'Untitled';
        return {
          id: id?.toString?.() ?? String(id),
          title: r._isBroken
            ? (displayTitle || r.email || personName || fallbackTitle)
            : (displayTitle || fallbackTitle),
          meta: r._isBroken
            ? (r.secondaryText || 'Related record unavailable')
            : (r.secondaryText || r.status || r.email || ''),
          recordData: r,
          onOpen: path && !r._isBroken
            ? () => openTab(path, { background: false, insertAdjacent: true })
            : undefined,
          relationshipKey: key,
          appKey,
          moduleKey,
          direction
        };
      });
      if (items.length === 0) return null;
      return { key, label, items };
    })
    .filter(Boolean);

  return groups.filter((group) => (group.items || []).length > 0);
});

const {
  tagHeaderButtonRef,
  tagPopoverRef,
  showTagPopover,
  tagPopoverStyle,
  updateTagPopoverPosition,
  handleTagIconClick,
  openTagPopoverFromField,
  handleTagPopoverMousedown,
  handleTagPopoverOutsideClick
} = useRecordTagPopoverPosition();

const hasRecordTags = computed(() => Array.isArray(record.value?.tags) && record.value.tags.length > 0);

const tagStorageKey = computed(() => {
  const organizationId = authStore.user?.organizationId || authStore.organization?._id || 'default-org';
  return `arivu-${moduleKeyLower.value || 'record'}-tag-definitions-${organizationId}`;
});

const persistRecordTags = async (cleaned) => {
  if (!record.value || !props.recordId) return;
  try {
    const moduleKey = moduleKeyLower.value;
    const supportsDedicatedTagsEndpoint = moduleKey === 'deals' || moduleKey === 'tasks';
    const response = supportsDedicatedTagsEndpoint
      ? await apiClient.put(`${recordCrudPathBase.value}/${props.recordId}/tags`, { tags: cleaned })
      : await updateRecordFields({ tags: cleaned });
    if (response?.success && response?.data) {
      record.value.tags = Array.isArray(response.data.tags) ? response.data.tags : cleaned;
    } else {
      record.value.tags = cleaned;
    }
    if (supportsDedicatedTagsEndpoint) {
      notifyListRecordUpdated(record.value);
    }
  } catch (e) {
    console.error('Save record tags error:', e);
    await fetchRecord();
  }
};

const moduleLabel = computed(() =>
  resolveModuleDisplayName(props.moduleKey, t, te)
);
const moduleLabelSingular = computed(() => {
  const s = moduleLabel.value;
  return s.endsWith('s') ? s.slice(0, -1) : s;
});

const recordLoadingMessage = computed(() => t('records.genericLoading', { module: moduleLabel.value }));
const recordErrorTitle = computed(() => t('records.genericErrorTitle', { module: moduleLabel.value }));
const recordNavPreviousLabel = computed(() => t('records.genericNavPrevious', { singular: moduleLabelSingular.value }));
const recordNavNextLabel = computed(() => t('records.genericNavNext', { singular: moduleLabelSingular.value }));

const recordTitle = computed(() => {
  const r = record.value;
  if (!r) return '';
  const moduleKey = (props.moduleKey || '').toLowerCase();
  if (moduleKey === 'people') {
    const peopleName = formatPeopleFullNameWithSalutation(
      resolvePeopleSalutation(r),
      r.first_name ?? r.firstName,
      r.last_name ?? r.lastName
    );
    if (peopleName) return peopleName;
    return r.email ?? (r._id || '').slice(-8) ?? 'Record';
  }
  const first = (r.first_name ?? r.firstName ?? '').trim();
  const last = (r.last_name ?? r.lastName ?? '').trim();
  const namePart = [first, last].filter(Boolean).join(' ').trim() || null;
  const primaryByModule = {
    events: r.eventName,
    items: r.item_name,
    quotes: r.quoteTitle || r.quoteNumber,
    sales_orders: r.orderTitle || r.salesOrderNumber,
    purchase_orders: r.subject || r.poNumber,
    receipt_notes: r.receiptNoteNumber,
    stockrooms: r.name || r.locationCode,
    stock_adjustments: r.reasonCode || r.inventoryAdjustmentId,
    stock_transfers: r.inventoryTransferId || r.fromLocationName,
    purchase_returns: r.subject || r.purchaseReturnNumber,
    delivery_notes: r.subject || r.deliveryNoteNumber,
    delivery_returns: r.subject || r.deliveryReturnNumber,
    sales_returns: r.salesReturnNumber,
    invoices: r.invoiceTitle || r.invoiceNumber
  };
  return (
    primaryByModule[moduleKey] ??
    r.name ??
    r.title ??
    namePart ??
    r.email ??
    (r._id || '').slice(-8)
  ) || 'Record';
});

/** Modules with immutable document number + editable title/subject. */
const DOCUMENT_NUMBER_TITLE_FIELDS = {
  quotes: { numberKey: 'quoteNumber', titleKey: 'quoteTitle' },
  invoices: { numberKey: 'invoiceNumber', titleKey: 'invoiceTitle' },
  sales_orders: { numberKey: 'salesOrderNumber', titleKey: 'orderTitle' },
  purchase_orders: { numberKey: 'poNumber', titleKey: 'subject' },
  purchase_returns: { numberKey: 'purchaseReturnNumber', titleKey: 'subject' },
  delivery_notes: { numberKey: 'deliveryNoteNumber', titleKey: 'subject' },
  delivery_returns: { numberKey: 'deliveryReturnNumber', titleKey: 'subject' }
};

const documentNumberTitleFields = computed(
  () => DOCUMENT_NUMBER_TITLE_FIELDS[moduleKeyLower.value] || null
);

/** Immutable document number prefix; hidden when title already is the number. */
const documentNumberPrefix = computed(() => {
  const fields = documentNumberTitleFields.value;
  const r = record.value;
  if (!fields || !r) return '';
  const num = String(r[fields.numberKey] || '').trim();
  if (!num) return '';
  if (recordTitle.value === num) return '';
  return num;
});

/** For People module: user-shaped object for Avatar (photo or initials). */
const recordAvatarUser = computed(() => {
  const r = record.value;
  if (!r || (props.moduleKey || '').toLowerCase() !== 'people') return null;
  const firstName = r.first_name ?? r.firstName ?? '';
  const lastName = r.last_name ?? r.lastName ?? '';
  if (!firstName && !lastName && !r.email) return null;
  return {
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    email: r.email,
    avatar: r.avatar ?? r.image ?? ''
  };
});

/** Icon for Avatar when no user avatar (non-people modules). */
const recordAvatarIcon = computed(() => {
  const key = (props.moduleKey || '').toLowerCase();
  const map = {
    people: UserCircleIcon,
    organizations: BuildingOfficeIcon,
    events: CalendarIcon,
    items: CubeIcon,
    forms: DocumentTextIcon
  };
  return map[key] || getModuleIconComponent(key);
});

const canEditRecord = computed(() => {
  const key = moduleKeyLower.value;
  if (key === 'purchase_orders') {
    return authStore.can?.('inventory', 'adjust') ?? false;
  }
  if (key === 'receipt_notes') {
    return authStore.can?.('inventory', 'adjust') ?? false;
  }
  if (key === 'purchase_returns') {
    return authStore.can?.('inventory', 'adjust') ?? false;
  }
  if (key === 'delivery_returns') {
    return authStore.can?.('inventory', 'adjust') ?? false;
  }
  if (key === 'delivery_notes') {
    return authStore.can?.('inventory', 'adjust') ?? false;
  }
  if (key === 'sales_returns') {
    return authStore.can?.('inventory', 'adjust') ?? false;
  }
  if (key === 'stockrooms') {
    return authStore.can?.('inventory', 'manageLocations') ?? false;
  }
  if (key === 'stock_adjustments') {
    return authStore.can?.('inventory', 'adjust') ?? false;
  }
  if (key === 'stock_transfers') {
    return authStore.can?.('inventory', 'transfer') ?? false;
  }
  return authStore.can?.(props.moduleKey, 'edit') ?? false;
});
const canPrintRecord = computed(() => {
  if (!props.moduleKey || !record.value?._id) return false;
  return authStore.can('templates', 'view') && authStore.can('templates', 'render');
});
const recordPrintButtonRef = ref(null);
function openRecordPrint() {
  recordPrintButtonRef.value?.open?.();
}
const canEditRecordTitle = computed(() => {
  if (isFormsModule.value) return canEditFormRecord.value && canEditRecord.value;
  return canEditRecord.value;
});
const canViewDocuments = computed(() => authStore.can?.('documents', 'view') ?? false);
const canCreateDocuments = computed(() => authStore.can?.('documents', 'create') ?? false);
const canEditDocuments = computed(() => authStore.can?.('documents', 'edit') ?? false);
const showRecordDocumentsTab = computed(
  () => supportsDocumentAttachments(props.moduleKey) && canViewDocuments.value && !!record.value?._id
);
const canPublishDocument = computed(
  () => moduleKeyLower.value === 'documents'
    && canEditRecord.value
    && isRichDocument(record.value)
    && String(record.value?.status || '').toLowerCase() === 'draft'
);
const isDocumentsRichRecord = computed(
  () => moduleKeyLower.value === 'documents' && isRichDocument(record.value)
);
const canOpenDocumentEditor = computed(
  () => isDocumentsRichRecord.value
    && canEditRecord.value
    && expandedLeftSection.value !== 'content-editor'
);

const showRecordPresenceAvatars = computed(
  () =>
    Boolean(props.recordId && record.value && authStore.can(props.moduleKey, 'view'))
    && isRecordPresenceSupported(props.moduleKey)
);

const recordPresenceActivityType = computed(() => {
  if (expandedLeftSection.value === 'content-editor') return 'editing';
  if (expandedLeftSection.value === 'lines') return 'editing';
  return 'viewing';
});

const { otherSessions: recordPresenceOthers } = useRecordPresence(
  () => props.moduleKey,
  () => String(props.recordId || record.value?._id || ''),
  () => recordPresenceActivityType.value
);

const documentEditorSaving = ref(false);
const documentEditorPageRef = ref(null);
const pendingCommentAnchor = ref(null);
const localDraftSavedAt = ref(null);

const documentTypeLabelMap = {
  file: 'documents.typeFile',
  rich_document: 'documents.typeRichDocument',
  sop: 'documents.typeSop',
  meeting_notes: 'documents.typeMeetingNotes',
  checklist: 'documents.typeChecklist',
  template: 'documents.typeTemplate',
  knowledge_article: 'documents.typeKnowledgeArticle',
  playbook: 'documents.typePlaybook'
};

function openDocumentEditor() {
  suppressDocumentEditorAutoOpen.value = false;
  expandedLeftSection.value = 'content-editor';
}

async function handleDocumentEditorSave(html) {
  if (!props.recordId || moduleKeyLower.value !== 'documents') return;
  documentEditorSaving.value = true;
  try {
    const response = await updateRecordFields({
      richContent: toRichContentPayload(html)
    });
    const updated = response?.data;
    if (record.value && updated && typeof updated === 'object') {
      Object.assign(record.value, updated);
    } else if (record.value) {
      record.value.richContent = toRichContentPayload(html);
    }
    await refreshRecordActivity();
  } catch (error) {
    notifications.error(error?.message || t('documents.editorSaveFailed'));
  } finally {
    documentEditorSaving.value = false;
  }
}

async function handlePublishDocument() {
  if (!canPublishDocument.value || !props.recordId) return;
  try {
    const response = await updateRecordFields({ status: 'published' });
    if (record.value) {
      const updated = response?.data;
      if (updated && typeof updated === 'object') {
        Object.assign(record.value, updated);
      } else {
        record.value.status = 'published';
      }
    }
    notifications.success(t('documents.publishSuccess'));
    await refreshRecordActivity();
  } catch (error) {
    notifications.error(error?.message || t('documents.publishFailed'));
  }
}

function handleInlineCommentRequest(anchor) {
  pendingCommentAnchor.value = anchor || null;
  if (expandedLeftSection.value === 'content-editor') {
    suppressDocumentEditorAutoOpen.value = true;
    expandedLeftSection.value = '';
    if (route.query.edit === '1') {
      const { edit, ...rest } = route.query;
      router.replace({ query: rest });
    }
  }
}

function handleDocumentDraftSaved(savedAt) {
  localDraftSavedAt.value = savedAt || new Date().toISOString();
}

// Use real tag colors for People (must be after canEditRecord)
const { getTagChipClass: getTagChipClassFromComposable } = useRecordTags(record, {
  tagStorageKey,
  canEdit: canEditRecord,
  persistTags: (names) => (supportsTags.value ? persistRecordTags(names) : Promise.resolve()),
  instanceTagSource: moduleKeyLower.value,
  fetchRecord
});
const getPeopleTagChipClass = computed(() => (supportsTags.value ? getTagChipClassFromComposable : getDefaultTagChipClass));

const layoutProps = computed(() => ({
  leftExpanded: !!expandedLeftSection.value,
  expandedSectionKey: expandedLeftSection.value,
  forceMobile: props.embed,
  class: [
    props.embed ? 'flex-1 min-h-0 overflow-hidden flex flex-col' : '',
    '[&.record-page-layout--left-expanded_.record-page-layout__right]:hidden'
  ]
}));

async function handleUnlinkGenericRelated(item, group, rec) {
  if (!rec?._id || !item?.id || !group?.key) return;
  const relKey = String(group.key || '').toLowerCase();
  const curMod = (props.moduleKey || '').toLowerCase();
  const currentRef = { appKey: (recordContextAppKey.value || 'SALES').toUpperCase(), moduleKey: curMod, recordId: rec._id };
  const relatedRef = { appKey: (item.appKey || 'SALES').toUpperCase(), moduleKey: (item.moduleKey || '').toLowerCase(), recordId: item.id };
  const isCurrentSource = (item.direction || 'SOURCE').toUpperCase() === 'SOURCE';
  const source = isCurrentSource ? currentRef : relatedRef;
  const target = isCurrentSource ? relatedRef : currentRef;

  const applyLocalUnlink = () => {
    if (relKey === 'people_organizations' && curMod === 'people' && record.value) {
      record.value.organization = null;
    }
    const rels = genericRecordContext.value?.relationships;
    if (Array.isArray(rels)) {
      const rel = rels.find((r) => String(r.relationshipKey || '').toLowerCase() === relKey);
      if (rel && Array.isArray(rel.records)) {
        rel.records = rel.records.filter(
          (r) => String(r.recordId ?? r.id ?? r._id) !== String(item.id)
        );
      }
    }
  };

  try {
    await apiClient.post('/relationships/unlink', {
      relationshipKey: group.key,
      source,
      target
    });
    applyLocalUnlink();
    invalidateRecordContext(recordContextAppKey.value, props.moduleKey, rec._id);
    await Promise.all([
      loadGenericRecordContext(true),
      fetchRecord()
    ]);
  } catch (err) {
    const notFound = err?.status === 404
      || String(err?.response?.data?.message || err?.message || '').toLowerCase().includes('not found');
    if (notFound && relKey === 'people_organizations' && curMod === 'people') {
      try {
        await updateRecordFields({ organization: null });
        applyLocalUnlink();
        invalidateRecordContext(recordContextAppKey.value, props.moduleKey, rec._id);
        await Promise.all([
          loadGenericRecordContext(true),
          fetchRecord()
        ]);
        return;
      } catch (clearErr) {
        console.error('Error clearing people organization lookup:', clearErr);
      }
    }
    console.error('Error unlinking related record:', err);
    notifications.error(err?.response?.data?.message || t('records.genericUnlinkFailed'));
  }
}

const rightPaneTabs = computed(() => {
  const tabs = [
    { id: 'activity', name: t('records.genericTabActivity'), icon: ClockIcon },
    { id: 'related', name: t('records.relatedTitle'), icon: LinkIcon }
  ];
  if (isFormsModule.value) {
    tabs.splice(1, 0, { id: 'preview', name: t('records.tabPreview'), icon: EyeIcon });
    if (canViewFormResponses.value) {
      tabs.splice(2, 0, { id: 'responses', name: t('records.tabResponses'), icon: ClipboardDocumentListIcon });
    }
  }
  if (showRecordDocumentsTab.value) {
    tabs.push({ id: 'documents', name: t('records.genericTabDocuments'), icon: DocumentDuplicateIcon });
  }
  if (showPeopleAccessTab.value) {
    tabs.push({ id: 'access', name: t('records.genericTabAccess'), icon: KeyIcon });
  }
  tabs.push(
    { id: 'details', name: t('records.detailsTitle'), icon: Bars3BottomLeftIcon },
    { id: 'integrations', name: t('records.genericIntegrations'), icon: PuzzlePieceIcon }
  );
  return tabs;
});

const linkRecordDrawerTitle = computed(() =>
  allowCreateFromLinkDrawer.value ? t('records.genericLinkDrawerAddAndLink') : t('records.genericLinkDrawerLink')
);

/** Same relationship set as Related Records — fills gaps when linkable-targets API is stale. */
const linkRecordDrawerSupplementTypes = computed(() => {
  const rels = Array.isArray(genericRecordContext.value?.relationships)
    ? genericRecordContext.value.relationships
    : [];

  return rels
    .filter((rel) => String(rel?.ui?.showAs || 'TAB').toUpperCase() !== 'NONE')
    .filter((rel) => rel.userLinkable !== false)
    .filter((rel) => !(rel.display && rel.display.linkRecord === false))
    .map((rel) => {
      const relationshipKey = String(rel.relationshipKey || '').toLowerCase();
      const isSource = String(rel.direction || 'SOURCE').toUpperCase() === 'SOURCE';
      const linkedModuleKey = isSource ? rel.target?.moduleKey : rel.source?.moduleKey;
      const linkedAppKey = isSource ? rel.target?.appKey : rel.source?.appKey;
      if (!relationshipKey || !linkedModuleKey) return null;
      return {
        key: String(linkedModuleKey).toLowerCase(),
        label: rel.ui?.label || rel.label || relationshipKey,
        relationshipKey,
        targetAppKey: String(linkedAppKey || recordContextAppKey.value || 'SALES').toUpperCase(),
        sourceIsCurrent: isSource
      };
    })
    .filter(Boolean);
});

const isContentVersionHistoryOpen = computed(
  () => expandedLeftSection.value === 'description-history'
    || expandedLeftSection.value === 'rich-content-history'
);

const contentVersionHistoryRadioName = computed(
  () => `${contentVersionHistoryMode.value}-version-${record.value?._id || ''}`
);

const contentVersionHistoryList = computed(() => {
  const rec = record.value;
  const data = descriptionVersionsData.value;
  if (!rec) return [];
  const currentUserName = authStore.user
    ? [authStore.user.firstName, authStore.user.lastName].filter(Boolean).join(' ').trim() || authStore.user.email
    : 'You';
  const currentContent = contentVersionHistoryMode.value === 'richContent'
    ? (data.currentContent ?? getRichContentHtml(rec.richContent))
    : (rec.description ?? rec.customFields?.description ?? data.currentDescription ?? '');
  return buildContentVersionHistoryList({
    record: rec,
    versions: data.versions,
    currentContent,
    currentUserName
  });
});

const canViewDescriptionHistory = true;

function registerRichContentFlush(fn) {
  richContentFlushSave.value = typeof fn === 'function' ? fn : null;
}

async function flushRichContentSave() {
  if (typeof richContentFlushSave.value === 'function') {
    await richContentFlushSave.value();
  }
}

function openDescriptionHistory() {
  contentVersionHistoryMode.value = 'description';
  selectedDescriptionVersionIndex.value = 0;
  expandedLeftSection.value = 'description-history';
  fetchContentVersions();
}

async function flushDocumentEditorSave() {
  if (typeof documentEditorPageRef.value?.flushPendingSave === 'function') {
    await documentEditorPageRef.value.flushPendingSave();
  }
}

async function openRichContentHistory() {
  if (expandedLeftSection.value === 'content-editor') {
    await flushDocumentEditorSave();
  }
  await flushRichContentSave();
  contentVersionHistoryMode.value = 'richContent';
  selectedDescriptionVersionIndex.value = 0;
  expandedLeftSection.value = 'rich-content-history';
  await fetchContentVersions();
}

async function closeExpandedLeftSection() {
  if (expandedLeftSection.value === 'content-editor') {
    await flushDocumentEditorSave();
    suppressDocumentEditorAutoOpen.value = true;
    if (route.query.edit) {
      const { edit, ...rest } = route.query;
      router.replace({ query: rest });
    }
  }
  expandedLeftSection.value = '';
}

async function fetchContentVersions() {
  if (!record.value?._id) return;
  descriptionVersionsLoading.value = true;
  try {
    if (contentVersionHistoryMode.value === 'richContent' && moduleKeyLower.value === 'documents') {
      const res = await apiClient.get(`/documents/${props.recordId}/rich-content-versions`);
      descriptionVersionsData.value = res?.data ?? { currentContent: '', versions: [] };
      return;
    }
    if (!props.moduleKey) return;
    const res = await apiClient.get(`/modules/${props.moduleKey}/records/${props.recordId}/description-versions`);
    descriptionVersionsData.value = res?.data ?? { currentDescription: '', versions: [] };
  } catch (err) {
    console.error('Fetch content versions failed:', err);
    descriptionVersionsData.value = { currentDescription: '', currentContent: '', versions: [] };
  } finally {
    descriptionVersionsLoading.value = false;
  }
}

async function restoreContentVersion() {
  if (!record.value?._id || selectedDescriptionVersionIndex.value === 0) return;
  descriptionRestoreLoading.value = true;
  try {
    const apiIndex = selectedDescriptionVersionIndex.value - 1;
    if (contentVersionHistoryMode.value === 'richContent' && moduleKeyLower.value === 'documents') {
      const response = await apiClient.post(
        `/documents/${props.recordId}/rich-content-versions/restore`,
        { versionIndex: apiIndex }
      );
      const updated = response?.data?.data ?? response?.data;
      if (updated && record.value) {
        Object.assign(record.value, updated);
        closeExpandedLeftSection();
        await refreshRecordActivity();
      }
      return;
    }
    if (!props.moduleKey) return;
    const response = await apiClient.post(
      `/modules/${props.moduleKey}/records/${props.recordId}/description-versions/restore`,
      { versionIndex: apiIndex }
    );
    const updated = response?.data?.data ?? response?.data;
    if (updated) {
      record.value = updated;
      closeExpandedLeftSection();
    }
  } catch (err) {
    console.error('Restore content version failed:', err);
  } finally {
    descriptionRestoreLoading.value = false;
  }
}

async function refreshRecordActivity() {
  if (!props.recordId || !props.moduleKey) return;
  try {
    const activityRes = await apiClient.get(`/modules/${props.moduleKey}/records/${props.recordId}/activity`);
    if (activityRes?.success && Array.isArray(activityRes.data)) {
      activityRaw.value = activityRes.data;
    }
  } catch (e) {
    console.warn('Refresh activity failed:', e);
  }
}

function buildRawActivityFromCreatedComment(comment) {
  if (!comment || typeof comment !== 'object') return null;
  const commentId = comment._id || comment.id;
  if (!commentId) return null;

  const author = comment.author || null;
  const actorProfile = author && typeof author === 'object' ? author : null;

  return {
    id: `comment-${commentId}`,
    type: 'comment',
    actor: actorProfile ? getAuthorName(actorProfile) : (author || 'Unknown'),
    actorProfile,
    createdAt: comment.createdAt ? new Date(comment.createdAt).toISOString() : new Date().toISOString(),
    payload: {
      body: comment.content || '',
      parentCommentId: comment.parentCommentId ? String(comment.parentCommentId) : null,
      attachments: comment.attachments || [],
      reactions: comment.reactions || [],
      commentId: String(commentId)
    },
    meta: {
      authorId: actorProfile?._id ? String(actorProfile._id) : null
    }
  };
}

function appendRawActivityEvent(event) {
  if (!event?.id) return;
  const eventCommentId = event.payload?.commentId ? String(event.payload.commentId) : null;
  const withoutDuplicate = (activityRaw.value || []).filter((existing) => {
    if (existing?.id === event.id) return false;
    const existingCommentId = existing?.payload?.commentId ? String(existing.payload.commentId) : null;
    return !eventCommentId || existingCommentId !== eventCommentId;
  });
  activityRaw.value = [...withoutDuplicate, event].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}

async function handleRecordDocumentsChanged(payload = {}) {
  const recordId = props.recordId || record.value?._id;
  if (!recordId) return;
  await refreshRelatedRecordsAfterDocumentChange({
    moduleKey: payload.moduleKey || props.moduleKey,
    recordId: payload.recordId || recordId,
    appKey: payload.appKey || recordContextAppKey.value,
    contextRef: genericRecordContext,
    loadRecordContext: loadGenericRecordContext,
    documents: payload.action === 'attach' ? (payload.documents || []) : [],
    detachedDocumentIds: payload.action === 'detach' ? (payload.detachedDocumentIds || []) : [],
    onContextRevision: () => { contextRevision.value += 1; }
  });
}

async function syncRelatedRecordsForLookupField(fieldKey, value) {
  const recordId = props.recordId || record.value?._id;
  if (!recordId) return;
  await refreshRelatedRecordsAfterLookupFieldSave({
    moduleKey: props.moduleKey,
    fieldKey,
    value,
    moduleDefinition: moduleDefinition.value,
    recordContextRef: genericRecordContext,
    contextRevisionRef: contextRevision,
    appKey: recordContextAppKey.value,
    recordId,
    loadRecordContext: loadGenericRecordContext,
    lookupLists: {
      organizations: peopleOrganizationList.value.length
        ? peopleOrganizationList.value
        : [...caseOrganizationLookupList.value, ...quoteOrganizationLookupList.value],
      people: caseContactLookupList.value.length
        ? caseContactLookupList.value
        : quoteContactLookupList.value,
      deals: quoteDealLookupList.value
    }
  });
}

const genericAdapter = computed(() => {
  if (!record.value || !moduleDefinition.value) return null;
  // Track related-record context so main-area RelatedSection re-renders on link/unlink.
  genericRelatedGroupsFromContext.value;
  contextRevision.value;
  const adapterFactory = moduleKeyLower.value === 'forms'
    ? createFormRecordAdapter
    : moduleKeyLower.value === 'items'
    ? createItemsRecordAdapter
    : moduleKeyLower.value === 'organizations'
    ? createOrganizationsRecordAdapter
    : moduleKeyLower.value === 'documents'
      ? createDocumentsRecordAdapter
      : moduleKeyLower.value === 'quotes'
      ? createQuotesRecordAdapter
      : moduleKeyLower.value === 'sales_orders'
        ? createSalesOrdersRecordAdapter
        : moduleKeyLower.value === 'purchase_orders'
          ? createPurchaseOrdersRecordAdapter
        : moduleKeyLower.value === 'receipt_notes'
          ? createReceiptNotesRecordAdapter
        : moduleKeyLower.value === 'stock_adjustments'
          ? createStockAdjustmentsRecordAdapter
        : moduleKeyLower.value === 'stock_transfers'
          ? createStockTransfersRecordAdapter
        : moduleKeyLower.value === 'purchase_returns'
          ? createPurchaseReturnsRecordAdapter
        : moduleKeyLower.value === 'delivery_returns'
          ? createDeliveryReturnsRecordAdapter
        : moduleKeyLower.value === 'delivery_notes'
          ? createDeliveryNotesRecordAdapter
        : moduleKeyLower.value === 'sales_returns'
          ? createSalesReturnsRecordAdapter
        : moduleKeyLower.value === 'invoices'
          ? createInvoicesRecordAdapter
          : moduleKeyLower.value === 'payments'
            ? createPaymentsRecordAdapter
            : createGenericRecordAdapter;
  return adapterFactory({
    sectionLabels: createRecordSectionLabels(t),
    formatDate: (d) => (d ? formatUserDate(d) : '—'),
    formatDateTime: (d) => (d ? formatUserDateTime(d) : '—'),
    moduleDefinition: moduleDefinition.value,
    inventoryEnabled: authStore.inventoryEnabled,
    ...(moduleKeyLower.value === 'organizations'
      ? { organizationTypeDefs: organizationTypeDefs.value }
      : {}),
    canEditDetails: (rec, fieldKey) => {
      if (!canEditRecord.value) return false;
      if (moduleKeyLower.value === 'forms') return canEditFormRecord.value;
      if (moduleKeyLower.value !== 'invoices') return true;
      const key = normalizeFieldKeyLoose(fieldKey);
      const status = String(rec?.status || 'Draft');
      if (status === 'Draft') return true;
      if (['Posted', 'Partially Paid'].includes(status)) {
        if (key === 'organizationrefid') return !extractIdFromFormValue(rec?.organizationRefId);
        if (key === 'contactid') return !extractIdFromFormValue(rec?.contactId);
      }
      return false;
    },
    saveDetailField: async (fieldKey, value) => {
      const moduleKeyLower = (props.moduleKey || '').toLowerCase();

      if (moduleKeyLower === 'organizations' && normalizeFieldKeyLoose(fieldKey) === 'derivedstatus') {
        const saveKey = resolveOrganizationDerivedStatusSaveFieldKey(record.value);
        if (!saveKey) return;
        fieldKey = saveKey;
      }

      // For people records, keep title, first_name, last_name, and salutation in sync.
      if (moduleKeyLower === 'people' && fieldKey === 'first_name') {
        const current = record.value || {};
        const next = normalizePeopleFirstNameSavePayload(value, resolvePeopleSalutation(current));
        const fullName = formatPeopleFullNameWithSalutation(
          next.salutation,
          next.firstName,
          current.last_name
        ) || undefined;

        const payload = {
          first_name: next.firstName,
          salutation: next.salutation,
        };
        if (fullName) payload.name = fullName;

        const response = await apiClient.put(`${recordCrudPathBase.value}/${props.recordId}`, payload);
        const updatedRecord = response?.data?.data ?? response?.data ?? null;
        if (record.value && updatedRecord && typeof updatedRecord === 'object') {
          Object.assign(record.value, updatedRecord);
        } else if (record.value) {
          record.value.first_name = next.firstName;
          record.value.salutation = next.salutation;
          if (fullName) record.value.name = fullName;
        }
        notifyListRecordUpdated(record.value);
        await refreshRecordActivity();
        return;
      }

      if (moduleKeyLower === 'people' && fieldKey === 'last_name') {
        const current = record.value || {};
        const next = {
          first_name: current.first_name,
          last_name: value
        };
        const fullName = formatPeopleFullNameWithSalutation(
          resolvePeopleSalutation(current),
          next.first_name,
          next.last_name
        ) || undefined;

        const payload = {
          first_name: next.first_name,
          last_name: next.last_name
        };
        if (fullName) payload.name = fullName;

        const response = await apiClient.put(`${recordCrudPathBase.value}/${props.recordId}`, payload);
        const updatedRecord = response?.data?.data ?? response?.data ?? null;
        if (record.value && updatedRecord && typeof updatedRecord === 'object') {
          Object.assign(record.value, updatedRecord);
        } else if (record.value) {
          record.value.first_name = next.first_name;
          record.value.last_name = next.last_name;
          if (fullName) record.value.name = fullName;
        }
        notifyListRecordUpdated(record.value);
        await refreshRecordActivity();
        return;
      }

      if (moduleKeyLower === 'cases' && fieldKey === 'status') {
        const patchBody = { status: value };
        const rs = String(
          record.value?.resolutionSummary ?? ''
        ).trim();
        if ((value === 'Resolved' || value === 'Closed') && rs) {
          patchBody.resolutionSummary = rs;
        }
        const response = await apiClient.patch(
          `${recordCrudPathBase.value}/${props.recordId}/status`,
          patchBody
        );
        const updatedRecord = response?.data ?? null;
        if (record.value) {
          record.value.status = value;
          if (updatedRecord && typeof updatedRecord === 'object') {
            Object.assign(record.value, updatedRecord);
          }
        }
        notifyListRecordUpdated(record.value);
        await refreshRecordActivity();
        return;
      }

      const fieldLoose = String(fieldKey || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      const commercialCanonical = { contactid: 'contactId', organizationrefid: 'organizationRefId', dealid: 'dealId' }[fieldLoose];
      const caseCanonical = { contactid: 'contactId', organizationrefid: 'organizationRefId', assignedto: 'assignedTo' }[fieldLoose];
      let payloadKey = fieldKey;
      if (moduleKeyLower === 'cases' && caseCanonical) {
        payloadKey = caseCanonical;
      } else if (['invoices', 'quotes'].includes(moduleKeyLower) && commercialCanonical) {
        payloadKey = commercialCanonical;
      }
      const payload = { [payloadKey]: value };

      const pair = resolveOrgContactPair(moduleKeyLower, moduleDefinition.value?.fields || []);
      let coordinationValue = value;
      if (pair && normalizeFieldKeyLoose(payloadKey) === normalizeFieldKeyLoose(pair.contactKey)) {
        coordinationValue = resolvePersonFromContactLookupList(value, quoteContactLookupList.value);
      }
      if (pair) {
        const formAfter = { ...record.value, [payloadKey]: coordinationValue };
        const fetchPersonById = async (id) => {
          if (!id) return null;
          const cached = resolvePersonFromContactLookupList(id, quoteContactLookupList.value);
          if (cached && typeof cached === 'object' && cached._id != null) {
            return cached;
          }
          try {
            const r = await apiClient.get(`/people/${id}`);
            return unwrapRecordFromListOrGetResponse(r);
          } catch {
            return null;
          }
        };
        const extra = await getOrgContactCoordinatedPatches({
          pair,
          formAfter,
          changedKey: payloadKey,
          newValue: coordinationValue,
          fetchPersonById,
        });
        Object.assign(payload, extra);
        if (record.value) {
          record.value[payloadKey] = coordinationValue;
          Object.assign(record.value, extra);
        }
      }
      const response = await updateRecordFields(payload);
      const updatedRecord = response?.data?.data ?? response?.data ?? null;
      if (record.value) {
        if (moduleKeyLower === 'cases' && caseCanonical && caseCanonical !== fieldKey) {
          try {
            delete record.value[fieldKey];
          } catch {
            /* ignore */
          }
        }
        if (updatedRecord && typeof updatedRecord === 'object') {
          Object.assign(record.value, updatedRecord);
        } else {
          record.value[payloadKey] = value;
        }
      }
      // One delayed soft GET — picks up process/assignment side-effects without polling
      scheduleSoftRecordRefresh(500);
      await syncRelatedRecordsForLookupField(payloadKey, coordinationValue ?? value);
      await refreshRecordActivity();
    },
    getRelatedGroups: () => genericRelatedGroupsFromContext.value,
    openRelatedItem: (item) => {
      const path = item?.recordPath
        || (item?.moduleKey && item?.id
          ? getModuleRecordDetailPath(item.moduleKey, item.id, { appKey: item.appKey })
          : null);
      if (path) openTab(path, { background: false, insertAdjacent: true });
    },
    canUnlinkRelated: () => genericRecordContextCanUnlink.value || canEditRecord.value,
    onUnlinkRelated: handleUnlinkGenericRelated,
    canLinkRecords: canLinkRecords.value,
    openLinkRecordDrawer,
    openAddRecordDrawer,
    handleDescriptionSave: async (value) => {
      try {
        await updateRecordFields({ description: value });
        if (record.value) record.value.description = value;
        await refreshRecordActivity();
        await nextTick();
        requestAnimationFrame(() => {
          activitySectionRef.value?.scrollToBottom?.({ behavior: 'smooth' });
        });
      } catch (e) {
        console.error('Save description error:', e);
      }
    },
    canEditDescription: canEditRecordTitle.value,
    expandedLeftSection,
    openLeftSection: (key) => { expandedLeftSection.value = key; },
    canViewDescriptionHistory,
    openDescriptionHistory,
    openRichContentHistory: moduleKeyLower.value === 'documents' ? openRichContentHistory : undefined,
    getEntityOptions: (fieldKey) => {
      const key = String(fieldKey || '').toLowerCase().trim();
      if ((props.moduleKey || '').toLowerCase() === 'people' && key === 'organization') {
        return peopleOrganizationList.value;
      }
      if ((props.moduleKey || '').toLowerCase() === 'cases' && key === 'contactid') {
        return caseContactOptionsForRecord(record.value, caseContactLookupList.value);
      }
      if ((props.moduleKey || '').toLowerCase() === 'cases' && (key === 'organizationrefid' || key === 'accountid')) {
        return caseOrganizationLookupList.value;
      }
      const mk = (props.moduleKey || '').toLowerCase();
      if ((mk === 'quotes' || mk === 'invoices') && key === 'contactid') {
        return quoteContactLookupList.value;
      }
      if ((mk === 'quotes' || mk === 'invoices') && key === 'organizationrefid') {
        return quoteOrganizationLookupList.value;
      }
      if (mk === 'purchase_orders' && (key === 'vendorid' || key === 'vendor')) {
        return quoteOrganizationLookupList.value;
      }
      if (mk === 'purchase_orders' && (key === 'vendorcontactid' || key === 'vendorcontact')) {
        return quoteContactLookupList.value;
      }
      if (mk === 'purchase_returns' && (key === 'vendorid' || key === 'vendor')) {
        return quoteOrganizationLookupList.value;
      }
      if (mk === 'purchase_returns' && (key === 'vendorcontactid' || key === 'vendorcontact')) {
        return quoteContactLookupList.value;
      }
      if (mk === 'delivery_returns' && (key === 'customerid' || key === 'customer')) {
        return quoteOrganizationLookupList.value;
      }
      if (mk === 'delivery_returns' && (key === 'contactpersonid' || key === 'contactperson')) {
        return quoteContactLookupList.value;
      }
      if (mk === 'delivery_notes' && (key === 'customerid' || key === 'customer')) {
        return quoteOrganizationLookupList.value;
      }
      if (mk === 'delivery_notes' && (key === 'contactpersonid' || key === 'contactperson')) {
        return quoteContactLookupList.value;
      }
      if ((mk === 'quotes' || mk === 'invoices') && key === 'dealid') {
        return quoteDealLookupList.value;
      }
      if (mk === 'items' && (key === 'categoryid' || key === 'category')) {
        return catalogCategoryLookupList.value;
      }
      const fieldDef = (moduleDefinition.value?.fields || []).find(
        (f) => String(f?.key || '').toLowerCase().trim() === key
      );
      const dataType = String(fieldDef?.dataType || fieldDef?.type || '').toLowerCase();
      if (
        mk === 'documents' &&
        (key === 'folderid' || key === 'folder' || String(fieldDef?.lookupModule || '').toLowerCase() === 'document_folders')
      ) {
        return documentFolderLookupList.value;
      }
      if (
        dataType.includes('user') ||
        key === 'assignedto' ||
        key === 'ownerid' ||
        key === 'owner' ||
        key === 'assignedto' ||
        key === 'createdby' ||
        key === 'updatedby' ||
        key === 'modifiedby' ||
        key === 'deletedby'
      ) {
        return userLookupList.value;
      }
      return [];
    },
    openDocumentEditor: moduleKeyLower.value === 'documents' ? openDocumentEditor : undefined
  });
});

const recordFieldContext = computed(() => resolveFieldContext(route.path, route.query));

/** People records: infer sales/helpdesk context when route is platform-wide so status fields appear. */
const effectiveRecordFieldContext = computed(() => {
  if (!isPeopleModule.value) return recordFieldContext.value;

  const routeCtx = recordFieldContext.value;
  if (routeCtx !== 'platform') return routeCtx;

  const partCtx = routeParticipationContext.value;
  if (partCtx === 'SALES') return 'sales';
  if (partCtx === 'HELPDESK') return 'helpdesk';

  const r = record.value;
  if (r) {
    if (getParticipation(r, 'SALES')) return 'sales';
    if (getParticipation(r, 'HELPDESK')) return 'helpdesk';
  }

  return 'all';
});

function moduleFetchContextForRecord() {
  if (isPeopleModule.value) return 'all';
  const ctx = recordFieldContext.value;
  return ctx && ctx !== 'platform' ? ctx : undefined;
}

const salesOrderBillingRefreshToken = ref(0);

const sectionContext = computed(() => {
  const base = {
    expandedLeftSection: expandedLeftSection.value,
    openLeftSection: (key) => { expandedLeftSection.value = key; },
    module: 'generic',
    moduleKey: props.moduleKey,
    openTab,
    fieldContext: effectiveRecordFieldContext.value,
    onSectionUpdated: handleSectionUpdated,
    relatedGroups: genericRelatedGroupsFromContext.value,
    contextRevision: contextRevision.value
  };
  if (supportsTags.value) {
    base.openTagsEditor = (event) => openTagPopoverFromField(event);
    base.getTagChipClass = typeof getPeopleTagChipClass.value === 'function' ? getPeopleTagChipClass.value : getDefaultTagChipClass;
  }
  if (moduleKeyLower.value === 'items') {
    base.onCatalogUpdated = () => fetchRecord();
    base.canEditCatalog = canEditRecord.value;
  }
  if (moduleKeyLower.value === 'organizations') {
    base.canEdit = canEditRecord.value;
    base.canEditVendorCatalog = canEditRecord.value;
  }
  if (moduleKeyLower.value === 'documents') {
    base.canEdit = canEditRecord.value;
    base.pendingCommentAnchor = pendingCommentAnchor.value;
    base.localDraftSavedAt = localDraftSavedAt.value;
    base.onCommentAnchorCleared = () => {
      pendingCommentAnchor.value = null;
    };
    base.onFileUpdated = () => fetchRecord();
    base.canEditFile = canEditRecord.value;
    base.canEditRichContent = canEditRecord.value;
    base.canEditVisibility = canEditRecord.value;
    base.canEditLifecycle = canEditRecord.value;
    base.canCheckExternalLink = canEditRecord.value || authStore.can?.('documents', 'view');
    base.canManageReservation = canEditRecord.value;
    base.presenceActivityType = recordPresenceActivityType.value;
    base.onExternalLinkUpdated = () => fetchRecord();
    base.onLifecycleSave = async (payload) => {
      const response = await updateRecordFields(payload);
      const updated = response?.data;
      if (record.value && updated && typeof updated === 'object') {
        Object.assign(record.value, updated);
      } else if (record.value && payload) {
        Object.assign(record.value, payload);
      }
      await refreshRecordActivity();
    };
    base.onReserve = async (reason = '') => {
      const response = await reserveDocument(props.recordId, reason);
      if (response?.success && response?.data && record.value) {
        Object.assign(record.value, response.data);
      } else {
        throw new Error(response?.message || 'Failed to reserve document');
      }
    };
    base.onReleaseReservation = async () => {
      const response = await releaseReservation(props.recordId);
      if (response?.success && response?.data && record.value) {
        Object.assign(record.value, response.data);
      } else {
        throw new Error(response?.message || 'Failed to release reservation');
      }
    };
    base.onTakeoverReservation = async (reason = '') => {
      const response = await takeoverReservation(props.recordId, reason);
      if (response?.success && response?.data && record.value) {
        Object.assign(record.value, response.data);
      } else {
        throw new Error(response?.message || 'Failed to take over reservation');
      }
    };
    base.onNotifyReserver = async () => {
      const response = await notifyReservationHolder(props.recordId);
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to notify reserver');
      }
    };
    base.onVisibilitySave = async (payload) => {
      const response = await updateRecordFields(payload);
      const updated = response?.data;
      if (record.value && updated && typeof updated === 'object') {
        Object.assign(record.value, updated);
      } else if (record.value && payload?.visibility) {
        record.value.visibility = payload.visibility;
      }
      await refreshRecordActivity();
    };
    base.onRichContentSave = async (html) => {
      const response = await updateRecordFields({
        richContent: toRichContentPayload(html)
      });
      const updated = response?.data;
      if (record.value && updated && typeof updated === 'object') {
        Object.assign(record.value, updated);
      } else if (record.value) {
        record.value.richContent = toRichContentPayload(html);
      }
      await refreshRecordActivity();
    };
    base.registerRichContentFlush = registerRichContentFlush;
  }
  if (isFormsModule.value) {
    base.formResponses = formResponses.value;
    base.formResponsesLoading = formResponsesLoading.value;
    base.formResponsesPagination = formResponsesPagination.value;
    base.fetchFormResponses = fetchFormResponses;
    base.viewFormResponseDetail = viewFormResponseDetail;
    base.viewAllFormResponses = viewFormResponses;
    base.formResponseSummary = formResponseSummary.value;
    base.formResponseSummaryLoading = formResponseSummaryLoading.value;
    base.fetchFormResponseSummary = fetchFormResponseSummary;
  }
  if (moduleKeyLower.value === 'sales_orders') {
    base.billingRefreshToken = salesOrderBillingRefreshToken.value;
  }
  return base;
});

const recordDetailsTabContext = computed(() => ({
  ...sectionContext.value,
  hideHeader: true
}));

const genericStateFields = computed(() => (genericAdapter.value ? genericAdapter.value.getStateFields(record.value, sectionContext.value) : []));
const genericStateValues = computed(() => (genericAdapter.value ? genericAdapter.value.getStateValues(record.value, sectionContext.value) : []));
const genericSections = computed(() => (genericAdapter.value ? genericAdapter.value.getSections(record.value) : []));

function getInitials(author) {
  if (!author) return '?';
  if (typeof author === 'string') {
    const parts = author.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((p) => p.charAt(0).toUpperCase()).join('') || author.charAt(0).toUpperCase() || '?';
  }
  const name = [author.firstName, author.lastName, author.first_name, author.last_name].filter(Boolean).join(' ') || author.email || author.username || '';
  return name ? name.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?' : '?';
}

function getAuthorName(author) {
  if (!author) return 'Unknown';
  if (typeof author === 'string') return author.trim() || 'Unknown';
  const name = [author.firstName, author.lastName, author.first_name, author.last_name].filter(Boolean).join(' ').trim();
  return name || author.username || author.email || 'Unknown';
}

function formatFullTimestamp(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return formatUserDateTime(d);
}

function formatRelativeActivityTime(date) {
  if (!date) return '';
  return formatRelativeTime(date, t);
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const {
  commentReactionTooltipRef,
  commentReactionTooltipStyle,
  commentReactionTooltipPlacement,
  showCommentReactionTooltip,
  commentReactionTooltipData,
  getReactionTooltipMode,
  getReactionTooltipSingleText,
  getReactionTooltipInlineText,
  getReactionUserDisplayName,
  getReactionUserInitial,
  updateCommentReactionTooltipPosition,
  cancelCommentReactionTooltipHide,
  handleShowCommentReactionTooltip,
  handleHideCommentReactionTooltip,
  cleanupCommentReactionTooltip
} = useCommentReactionTooltip({
  getCurrentUserId: () => authStore.user?._id || authStore.user?.id || ''
});

const resolveActivityFieldDataType = (event) => {
  const details = event?.details || event?.payload?.details || {};
  const fieldKey = String(details.field || '').trim();
  if (!fieldKey) return undefined;
  const fields = moduleDefinition.value?.fields || [];
  const match = fields.find(
    (f) => String(f?.key || '') === fieldKey || String(f?.label || '') === fieldKey
  );
  return match?.dataType;
};

const activityUi = computed(() => {
  const searchQuery = activitySearchQuery.value || '';
  const moduleUi = {
    moduleKey: props.moduleKey,
    recordId: props.recordId,
    currentUser: authStore.user || null,
    expandedTaskEmailThreads: expandedTaskEmailThreads.value,
    editingCommentId: editingCommentId.value,
    editingCommentText: editingCommentText.value,
    editingCommentAttachments: editingCommentAttachments.value,
    isEditingCommentDirty: isEditingCommentDirty.value,
    setEditingCommentText,
    setEditingCommentAttachments,
    handleEditCommentFilesChange,
    saveEditComment,
    handleSaveEditCommentClick,
    cancelEditComment,
    canEditComment,
    startEditComment,
    addComment: (content, attachments, parentCommentId) => addComment(content, attachments, parentCommentId),
    getInitials,
    getAuthorName,
    formatFullTimestamp,
    formatRelativeActivityTime: (date) => formatRelativeActivityTime(date),
    handleTimestampPointerUp: () => {},
    highlightSearchText: (text) => {
      if (!text) return '';
      const q = searchQuery.trim();
      if (!q) return String(text);
      const regex = new RegExp(`(${escapeRegExp(q)})`, 'gi');
      return String(text).replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 font-semibold">$1</mark>');
    },
    commentMentionsCurrentUser: () => false,
    hasAttachmentUrl: (att) => Boolean(att?.url || att?.path),
    getAttachmentUrl: (att) => att?.url || att?.path || '',
    isImageAttachment: (att) => /^image\//i.test(String(att?.mimetype || att?.type || '')) || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(String(att?.filename || att?.name || '')),
    isSvgAttachment: (att) => /svg/i.test(String(att?.mimetype || att?.type || '')) || /\.svg$/i.test(String(att?.filename || att?.name || '')),
    getAttachmentName: (att) => String(att?.filename || att?.name || 'attachment'),
    downloadAttachment: (att) => {
      const url = att?.url || att?.path;
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.download = String(att?.filename || att?.name || 'attachment');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    formatFileSize: (bytes) => {
      const n = Number(bytes || 0);
      if (n <= 0) return '0 B';
      if (n < 1024) return `${n} B`;
      if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
      return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    },
    getAttachmentLabel: (att) => {
      const parts = [];
      if (att?.mimetype) parts.push(String(att.mimetype));
      if (att?.size != null) parts.push(moduleUi.formatFileSize(att.size));
      return parts.join(' • ') || 'Attachment';
    },
    hasCommentReactions: (event) => buildCommentReactions(event, { includeLikesFallback: true }).length > 0,
    getCommentReactions: (event) => buildCommentReactions(event, { includeLikesFallback: true }),
    isCommentReactionSelected: (event, emoji) => {
      return isCommentReactionSelectedForUser({
        event,
        emoji,
        currentUserId: authStore.user?._id || authStore.user?.id || '',
        getCommentReactions: (targetEvent) => buildCommentReactions(targetEvent, { includeLikesFallback: true })
      });
    },
    toggleCommentReaction,
    handleShowCommentReactionTooltip,
    handleHideCommentReactionTooltip,
    setCommentReactionButtonRef,
    toggleCommentReactionPicker,
    openCommentThread,
    getCommentThreadReplyCount,
    getCommentThreadLatestReplyAuthor,
    isFieldChangeSystemEvent: (event) => {
      if (!event || event.type !== 'system') return false;
      const details = event?.details || event?.payload?.details || {};
      return (
        event.action === 'field_changed' ||
        event.action === 'status_changed' ||
        event.action === 'participation_changed' ||
        Boolean(details?.field)
      );
    },
    getSystemEventActorLabel: (event) => {
      if (!event) return 'System';
      if (moduleKeyLower.value === 'quotes') {
        const customer = getQuoteActivityActorLabel(event);
        if (customer) return customer;
      }
      const author = event.author ?? event.actor;
      if (author && typeof author === 'object') {
        const name = [author.firstName, author.lastName].filter(Boolean).join(' ').trim() || author.username || author.email;
        return name || 'System';
      }
      return typeof author === 'string' ? author : (event.actor || 'System');
    },
    getSystemEventFieldLabel: (event) => {
      const details = event?.details || event?.payload?.details || {};
      const raw = details.fieldLabel ?? details.field;
      return String(raw ?? '').trim() || 'field';
    },
    getSystemEventFromValue: (event) => {
      const details = event?.details || event?.payload?.details || {};
      const v = details.from ?? details.oldValue;
      if (v === undefined || v === null || v === '') return 'Empty';
      if (isDescriptionActivityFieldChange(event?.action || event?.payload?.action, details)) {
        const plain = getPlainTextFromHtml(String(v));
        return plain || 'Empty';
      }
      return formatActivityChangeValue(v, 'Empty', resolveActivityFieldDataType(event));
    },
    getSystemEventToValue: (event) => {
      const details = event?.details || event?.payload?.details || {};
      const v = details.to ?? details.newValue;
      if (v === undefined || v === null || v === '') return 'Empty';
      if (isDescriptionActivityFieldChange(event?.action || event?.payload?.action, details)) {
        const plain = getPlainTextFromHtml(String(v));
        return plain || 'Empty';
      }
      return formatActivityChangeValue(v, 'Empty', resolveActivityFieldDataType(event));
    },
    getSystemEventMessage: (event) => {
      if (!event) return 'Updated this record';
      const msg = String(event?.message ?? event?.payload?.message ?? '').trim();
      if (msg) return msg;
      const action = String(event?.action || event?.payload?.action || 'updated').trim();
      const processMsg = getProcessActivityMessage(event);
      if (processMsg) return processMsg;
      if (moduleKeyLower.value === 'quotes') {
        const quoteMsg = getQuoteActivityMessage(event);
        if (quoteMsg) return quoteMsg;
      }
      if (moduleKeyLower.value === 'sales_orders') {
        const soMsg = getSalesOrderActivityMessage(event);
        if (soMsg) return soMsg;
      }
      if (moduleKeyLower.value === 'invoices') {
        const invMsg = getInvoiceActivityMessage(event);
        if (invMsg) return invMsg;
      }
      if (moduleKeyLower.value === 'payments') {
        const payMsg = getPaymentActivityMessage(event);
        if (payMsg) return payMsg;
      }
      if (moduleKeyLower.value === 'documents') {
        const docMsg = getDocumentActivityMessage(event);
        if (docMsg) return docMsg;
      }
      const mod = (props.moduleKey || '').toLowerCase();
      if (action === 'record_created') {
        return mod === 'people' ? 'Created this person' : 'Created this record';
      }
      if (action === 'participation_attached') {
        return mod === 'people' ? 'Joined an app' : 'Updated app participation';
      }
      return `${action} this record`;
    },
    getTagChipClass: (tagNameOrObject) => (typeof getPeopleTagChipClass.value === 'function' ? getPeopleTagChipClass.value(tagNameOrObject) : getDefaultTagChipClass(tagNameOrObject)),
    handleShowMore: () => {},
    toggleTaskEmailThread: (threadId) => {
      const next = new Set(expandedTaskEmailThreads.value);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      expandedTaskEmailThreads.value = next;
    },
    createTaskFromEmailMessage: () => {},
    createCaseFromEmailMessage: () => {},
    assignEmailThread: async ({ threadId, assignedToUserId }) => {
      if (!threadId) return;
      try {
        const res = await apiClient.patch(`/communications/threads/${encodeURIComponent(threadId)}/assign`, {
          assignedToUserId: assignedToUserId || null
        });
        const apiData = res?.data?.data ?? res?.data ?? {};
        const nextAssignee = apiData?.assignedToUserId ?? assignedToUserId ?? null;
        const meId = authStore.user?._id || authStore.user?.id;
        const meLabel = `${authStore.user?.firstName || ''} ${authStore.user?.lastName || ''}`.trim()
          || authStore.user?.username
          || authStore.user?.email
          || null;
        emailThreads.value = (emailThreads.value || []).map((thread) => {
          if (thread.threadId !== threadId) return thread;
          const isMe = nextAssignee && meId && String(nextAssignee) === String(meId);
          return { ...thread, assignedToUserId: nextAssignee, assignedToDisplay: isMe ? meLabel : (thread.assignedToDisplay || null) };
        });
        notifications.success(nextAssignee ? t('records.genericThreadAssigned') : t('records.genericThreadUnassigned'));
      } catch (err) {
        notifications.error(err?.response?.data?.message || err?.message || t('records.genericThreadAssignFailed'));
      }
    },
    unassignEmailThread: async ({ threadId }) => {
      if (!threadId) return;
      try {
        const res = await apiClient.patch(`/communications/threads/${encodeURIComponent(threadId)}/assign`, {
          assignedToUserId: null
        });
        const apiData = res?.data?.data ?? res?.data ?? {};
        const nextAssignee = apiData?.assignedToUserId ?? null;
        emailThreads.value = (emailThreads.value || []).map((thread) =>
          thread.threadId === threadId ? { ...thread, assignedToUserId: nextAssignee, assignedToDisplay: null } : thread
        );
        notifications.success(t('records.genericThreadUnassigned'));
      } catch (err) {
        notifications.error(err?.response?.data?.message || err?.message || t('records.genericThreadUnassignFailed'));
      }
    },
    addTagToEmailThread: async ({ threadId, tag }) => {
      if (!threadId || !tag) return;
      try {
        const res = await apiClient.patch(`/communications/threads/${encodeURIComponent(threadId)}/tags`, {
          action: 'add',
          tag
        });
        const apiData = res?.data?.data ?? res?.data ?? {};
        const tagValue = String(tag || '').trim();
        const currentTags = (emailThreads.value || []).find((thread) => thread.threadId === threadId)?.tags || [];
        const optimisticNext = Array.from(new Set([...currentTags, tagValue].filter(Boolean)));
        const nextTags = Array.isArray(apiData?.tags) ? apiData.tags : optimisticNext;
        emailThreads.value = (emailThreads.value || []).map((thread) =>
          thread.threadId === threadId ? { ...thread, tags: nextTags } : thread
        );
        notifications.success(t('records.genericTagAdded'));
      } catch (err) {
        notifications.error(err?.response?.data?.message || err?.message || t('records.genericTagAddFailed'));
      }
    },
    removeTagFromEmailThread: async ({ threadId, tag }) => {
      if (!threadId || !tag) return;
      try {
        const res = await apiClient.patch(`/communications/threads/${encodeURIComponent(threadId)}/tags`, {
          action: 'remove',
          tag
        });
        const apiData = res?.data?.data ?? res?.data ?? {};
        const normalizedTag = String(tag || '').trim().toLowerCase();
        const currentTags = (emailThreads.value || []).find((thread) => thread.threadId === threadId)?.tags || [];
        const optimisticNext = currentTags.filter((value) => String(value || '').trim().toLowerCase() !== normalizedTag);
        const nextTags = Array.isArray(apiData?.tags) ? apiData.tags : optimisticNext;
        emailThreads.value = (emailThreads.value || []).map((thread) =>
          thread.threadId === threadId ? { ...thread, tags: nextTags } : thread
        );
        notifications.success(t('records.genericTagRemoved'));
      } catch (err) {
        notifications.error(err?.response?.data?.message || err?.message || t('records.genericTagRemoveFailed'));
      }
    },
    handleReplyToEmailMessage: (payload) => {
      if (!supportsEmail.value) return;
      openEmailComposeModal(payload);
    },
    handleToggleThreadDone: async ({ threadId, done }) => {
      if (!threadId) return;
      try {
        const res = await apiClient.patch(`/communications/threads/${encodeURIComponent(threadId)}/done`, { done });
        const doneValue = done !== false && Boolean(res?.data?.done ?? done);
        emailThreads.value = (emailThreads.value || []).map((thread) =>
          thread.threadId === threadId
            ? { ...thread, done: doneValue, doneAt: doneValue ? (res?.data?.doneAt || new Date().toISOString()) : null, unread: doneValue ? false : thread.unread }
            : thread
        );
        notifications.success(doneValue ? t('records.genericThreadMarkedDone') : t('records.genericThreadReopened'));
      } catch (err) {
        notifications.error(err?.response?.data?.message || err?.message || t('records.genericThreadStatusFailed'));
      }
    }
  };
  return normalizeActivityUiContract(moduleUi);
});

const activityEvents = computed(() => {
  const raw = activityRaw.value || [];
  const recordRef = { module: props.moduleKey, id: String(props.recordId) };
  const events = raw.map((e) => {
    if (e.type === 'system') {
      const details = e.payload?.details || {};
      const action = e.payload?.action;
      const descriptionDiff = isDescriptionActivityFieldChange(action, details)
        ? buildDescriptionActivityDiff(details.from ?? details.oldValue, details.to ?? details.newValue)
        : { diffHtml: null, imageChanges: [] };
      return normalizeSystemActivityEvent({
        _id: e.id,
        action,
        message: e.payload?.message,
        details,
        user: e.actorProfile || e.actor,
        timestamp: e.createdAt
      }, {
        recordRef,
        descriptionDiffHtml: descriptionDiff.diffHtml,
        descriptionImageChanges: descriptionDiff.imageChanges
      });
    }
    if (e.type === 'comment') {
      const author = e.actorProfile && typeof e.actorProfile === 'object' ? e.actorProfile : e.actor;
      return normalizeCommentActivityEvent({
        _id: e.payload?.commentId || e.id,
        content: e.payload?.body,
        author,
        createdAt: e.createdAt,
        editedAt: e.payload?.editedAt,
        parentCommentId: e.payload?.parentCommentId,
        attachments: e.payload?.attachments || [],
        reactions: e.payload?.reactions || [],
        recordRef
      });
    }
    return null;
  }).filter(Boolean);
  return sortActivityEventsByDate(events);
});

const getCommentEventId = (event) => {
  if (!event) return '';
  const rawId = event.id || event._id || event.payload?.commentId || event.commentId;
  return rawId ? String(rawId) : '';
};

const getParentCommentId = (event) => {
  const rawParentId = event?.parentCommentId ?? event?.payload?.parentCommentId;
  if (!rawParentId) return '';
  if (typeof rawParentId === 'object') {
    return String(rawParentId._id || rawParentId.id || '');
  }
  return String(rawParentId);
};

const commentEventsById = computed(() => {
  const map = new Map();
  (activityEvents.value || []).forEach((event) => {
    if (event?.type !== 'comment') return;
    const id = getCommentEventId(event);
    if (!id) return;
    map.set(id, event);
  });
  return map;
});

const commentThreadRepliesByRootId = computed(() => {
  const grouped = new Map();
  (activityEvents.value || []).forEach((event) => {
    if (event?.type !== 'comment') return;
    const parentId = getParentCommentId(event);
    if (!parentId) return;
    const rootId = String(parentId);
    if (!grouped.has(rootId)) grouped.set(rootId, []);
    grouped.get(rootId).push(event);
  });
  grouped.forEach((replies, rootId) => {
    replies.sort((a, b) => new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0));
    grouped.set(rootId, replies);
  });
  return grouped;
});

const activeThreadRootComment = computed(() => {
  if (!activeThreadRootCommentId.value) return null;
  return commentEventsById.value.get(String(activeThreadRootCommentId.value)) || null;
});

const threadReplyEvents = computed(() => {
  if (!activeThreadRootCommentId.value) return [];
  return commentThreadRepliesByRootId.value.get(String(activeThreadRootCommentId.value)) || [];
});

const threadReplyCount = computed(() => threadReplyEvents.value.length);
const isThreadViewActive = computed(() => Boolean(activeThreadRootCommentId.value && activeThreadRootComment.value));
const commentReactionPickerStyle = computed(() => ({
  top: `${commentReactionPickerPosition.value.top}px`,
  left: `${commentReactionPickerPosition.value.left}px`
}));

/** Combined activity (logs + comments + email threads) for modules that support email. */
const combinedActivityEvents = computed(() => {
  const recordRef = { module: props.moduleKey, id: String(props.recordId) };
  const threadedCommunicationIds = new Set(
    (emailThreads.value || [])
      .flatMap((thread) => (thread.messages || []).map((msg) => String(msg?._id || '')))
      .filter(Boolean)
  );
  const base = (activityEvents.value || []).filter((ev) => {
    if (ev?.type === 'system' && ev?.payload?.action === 'email_sent' && ev?.payload?.details?.communicationId) {
      const commId = String(ev.payload.details.communicationId || '');
      if (commId && threadedCommunicationIds.has(commId)) {
        return false;
      }
    }
    return true;
  });
  if (!supportsEmail.value) {
    return base;
  }
  const threadEvents = (emailThreads.value || [])
    .map((thread) =>
      normalizeEmailThreadActivityEvent({
        ...thread,
        recordRef,
        source: 'integration'
      })
    );
  return sortActivityEventsByDate([...base, ...threadEvents]);
});

/** Apply search + type filters for the Activity tab (generic modules). */
const filteredActivityEvents = computed(() => {
  const events = combinedActivityEvents.value || [];
  const showComments = activityFilterComments.value;
  const showUpdates = activityFilterUpdates.value;
  const showEmail = activityFilterEmail.value;

  if (!showComments && !showUpdates && !showEmail) return [];

  const q = (activitySearchQuery.value || '').trim().toLowerCase();

  // When searching, show only comment events whose content or author matches.
  if (q) {
    return events.filter((e) => {
      if (e.type !== 'comment') return false;
      if (getParentCommentId(e)) return false;
      const author = e.author;
      let authorText = '';
      if (author) {
        if (typeof author === 'string') {
          authorText = author;
        } else {
          authorText = [
            author.firstName,
            author.first_name,
            author.lastName,
            author.last_name,
            author.username,
            author.email
          ]
            .filter(Boolean)
            .join(' ');
        }
      }
      const text = `${e.content || e.text || ''} ${authorText}`.toLowerCase();
      return text.includes(q);
    });
  }

  // No search query: respect the type toggles.
  return events.filter((e) => {
    if (e.type === 'comment') return showComments && !getParentCommentId(e);
    if (e.type === 'system') return showUpdates;
    if (e.type === 'email_thread') return showEmail;
    return false;
  });
});

const activityEventsForDisplay = computed(() => {
  if (!isThreadViewActive.value || !activeThreadRootComment.value) {
    return filteredActivityEvents.value;
  }
  return [activeThreadRootComment.value, ...threadReplyEvents.value];
});

watch(
  () => [record.value, route.query.focus],
  () => {
    if (!record.value || route.query.focus !== 'execution') return;
    nextTick(() => {
      const panel = eventExecutionPanelRef.value;
      const el = panel?.panelRootRef || panel?.$el;
      el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  },
  { flush: 'post' }
);

async function cancelAppointment() {
  if (!record.value?._id) return;
  if (!await confirmAction(t('records.genericConfirmCancelAppt'))) return;
  try {
    const res = await apiClient.post(`/appointments/events/${record.value._id}/cancel`, {
      reason: 'Cancelled from event record'
    });
    if (res.success) {
      notifications.success(t('records.genericApptCancelled'));
      await fetchRecord();
    } else {
      notifications.error(res.message || t('records.genericApptCancelFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.genericApptCancelFailed'));
  }
}

async function completeAppointment() {
  if (!record.value?._id) return;
  if (!await confirmAction(t('records.genericConfirmCompleteAppt'))) return;
  try {
    const res = await apiClient.post(`/appointments/events/${record.value._id}/complete`);
    if (res.success) {
      notifications.success(t('records.genericApptCompleted'));
      await fetchRecord();
    } else {
      notifications.error(res.message || t('records.genericApptCompleteFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.genericApptCompleteFailed'));
  }
}

async function markAppointmentNoShow() {
  if (!record.value?._id) return;
  if (!await confirmAction(t('records.genericConfirmNoShowAppt'))) return;
  try {
    const res = await apiClient.post(`/appointments/events/${record.value._id}/no-show`, {
      reason: 'Marked from event record'
    });
    if (res.success) {
      notifications.success(t('records.genericApptNoShow'));
      await fetchRecord();
    } else {
      notifications.error(res.message || t('records.genericApptNoShowFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.genericApptNoShowFailed'));
  }
}

async function onAppointmentRescheduled() {
  notifications.success(t('records.genericApptRescheduled'));
  await fetchRecord();
}

function getRecordLeftPaneScrollEl() {
  return genericRecordContentRootRef.value?.querySelector('.record-page-layout__left') ?? null;
}

function handleSectionUpdated(event) {
  const payload = event?.payload;

  if (moduleKeyLower.value === 'sales_orders' && record.value) {
    if (payload?.type === 'soft-refresh') {
      if (payload.salesOrder) Object.assign(record.value, payload.salesOrder);
      if (payload.totals) Object.assign(record.value, payload.totals);
      if (Array.isArray(payload.lines)) record.value.lines = payload.lines;
      if (Array.isArray(payload.sections)) record.value.sections = payload.sections;
      if (event?.sectionKey === 'fulfillment') {
        salesOrderBillingRefreshToken.value += 1;
      }
      return;
    }
    if (payload?.type === 'billing-refresh') {
      salesOrderBillingRefreshToken.value += 1;
      return;
    }
    if (payload?.type === 'line-deleted') {
      if (
        applyQuoteLineDeleteToRecord(record.value, {
          deletedLine: payload.deletedLine || payload.deleted,
          totals: payload.totals,
          sections: payload.sections,
          lineIdField: 'salesOrderLineId'
        })
      ) {
        return;
      }
      if (payload.totals) Object.assign(record.value, payload.totals);
      if (Array.isArray(payload.sections)) record.value.sections = payload.sections;
      if (payload.deleted && Array.isArray(record.value.lines)) {
        const parentId = payload.deleted._id ? String(payload.deleted._id) : null;
        record.value.lines = record.value.lines.filter((row) => {
          if (String(row.salesOrderLineId) === String(payload.deleted.salesOrderLineId)) return false;
          if (parentId && String(row.parentBundleLineId || '') === parentId) return false;
          return true;
        });
      }
      return;
    }
    if (payload?.type === 'lines-added') {
      applyQuoteLinesAddToRecord(record.value, {
        lines: payload.lines,
        totals: payload.totals,
        sections: payload.sections,
        lineIdField: 'salesOrderLineId'
      });
      return;
    }
    if (payload?.type === 'line-updated') {
      applyQuoteLinesMutationToRecord(record.value, {
        line: payload.line,
        totals: payload.totals,
        sections: payload.sections,
        lineIdField: 'salesOrderLineId',
        sectionUuidField: 'salesOrderSectionId'
      });
      return;
    }
    if (payload?.type === 'sections-updated') {
      if (payload.totals) Object.assign(record.value, payload.totals);
      if (Array.isArray(payload.sections)) record.value.sections = payload.sections;
      return;
    }
    fetchRecord({ preserveScroll: true, soft: true });
    return;
  }

  if (moduleKeyLower.value === 'invoices' && record.value) {
    if (payload?.type === 'soft-refresh') {
      if (payload.invoice) Object.assign(record.value, payload.invoice);
      if (payload.totals) Object.assign(record.value, payload.totals);
      if (Array.isArray(payload.lines)) record.value.lines = payload.lines;
      if (Array.isArray(payload.sections)) record.value.sections = payload.sections;
      return;
    }
    if (payload?.type === 'line-deleted') {
      if (
        applyQuoteLineDeleteToRecord(record.value, {
          deletedLine: payload.deletedLine || payload.deleted,
          totals: payload.totals,
          sections: payload.sections,
          lineIdField: 'invoiceLineId'
        })
      ) {
        return;
      }
      if (payload.totals) Object.assign(record.value, payload.totals);
      if (Array.isArray(payload.sections)) record.value.sections = payload.sections;
      if (payload.deleted && Array.isArray(record.value.lines)) {
        const parentId = payload.deleted._id ? String(payload.deleted._id) : null;
        record.value.lines = record.value.lines.filter((row) => {
          if (String(row.invoiceLineId) === String(payload.deleted.invoiceLineId)) return false;
          if (parentId && String(row.parentBundleLineId || '') === parentId) return false;
          return true;
        });
      }
      return;
    }
    if (payload?.type === 'lines-added') {
      applyQuoteLinesAddToRecord(record.value, {
        lines: payload.lines,
        totals: payload.totals,
        sections: payload.sections,
        lineIdField: 'invoiceLineId'
      });
      return;
    }
    if (payload?.type === 'line-updated') {
      applyQuoteLinesMutationToRecord(record.value, {
        line: payload.line,
        totals: payload.totals,
        sections: payload.sections,
        lineIdField: 'invoiceLineId',
        sectionUuidField: 'invoiceSectionId'
      });
      return;
    }
    if (payload?.type === 'sections-updated') {
      if (payload.totals) Object.assign(record.value, payload.totals);
      if (Array.isArray(payload.sections)) record.value.sections = payload.sections;
      return;
    }
    fetchRecord({ preserveScroll: true, soft: true });
    return;
  }

  if (moduleKeyLower.value === 'purchase_orders' && record.value) {
    if (payload?.type === 'soft-refresh') {
      if (payload.purchaseOrder) Object.assign(record.value, payload.purchaseOrder);
      if (payload.totals) Object.assign(record.value, payload.totals);
      if (Array.isArray(payload.lines)) record.value.lines = payload.lines;
      if (!payload.purchaseOrder) {
        fetchRecord({ preserveScroll: true, soft: true });
      }
      return;
    }
    if (payload?.type === 'quote-discounts-updated') {
      if (payload.quote) {
        Object.assign(record.value, {
          overallDiscountType: payload.quote.globalDiscountType ?? payload.quote.overallDiscountType ?? record.value.overallDiscountType,
          overallDiscountValue: payload.quote.globalDiscountValue ?? payload.quote.overallDiscountValue ?? record.value.overallDiscountValue,
          overallDiscountTotal: payload.quote.globalDiscountTotal ?? payload.quote.overallDiscountTotal ?? record.value.overallDiscountTotal,
          globalDiscountType: payload.quote.globalDiscountType,
          globalDiscountValue: payload.quote.globalDiscountValue,
          globalDiscountTotal: payload.quote.globalDiscountTotal,
          adjustmentTotal: payload.quote.adjustmentTotal ?? record.value.adjustmentTotal,
          transactionTaxSnapshot: payload.quote.transactionTaxSnapshot ?? record.value.transactionTaxSnapshot,
          chargeDocumentSnapshot: payload.quote.chargeDocumentSnapshot ?? record.value.chargeDocumentSnapshot,
          subtotal: payload.quote.subtotal ?? record.value.subtotal,
          grandTotal: payload.quote.grandTotal ?? record.value.grandTotal,
          preTaxTotal: payload.quote.preTaxTotal ?? record.value.preTaxTotal,
          taxTotal: payload.quote.taxTotal ?? record.value.taxTotal,
          chargesTotal: payload.quote.chargesTotal ?? record.value.chargesTotal
        });
      }
      if (payload.totals) Object.assign(record.value, payload.totals);
      if (Array.isArray(payload.lines)) record.value.lines = payload.lines;
      return;
    }
    if (payload?.type === 'quote-taxes-charges-updated') {
      if (payload.quote) {
        Object.assign(record.value, {
          transactionTaxSnapshot: payload.quote.transactionTaxSnapshot,
          chargeDocumentSnapshot: payload.quote.chargeDocumentSnapshot,
          chargesTotal: payload.quote.chargesTotal ?? record.value.chargesTotal,
          taxTotal: payload.quote.taxTotal ?? record.value.taxTotal,
          grandTotal: payload.quote.grandTotal ?? record.value.grandTotal,
          subtotal: payload.quote.subtotal ?? record.value.subtotal,
          taxDocumentSnapshot: payload.quote.taxDocumentSnapshot
        });
      }
      if (payload.totals) Object.assign(record.value, payload.totals);
      if (Array.isArray(payload.lines)) record.value.lines = payload.lines;
      return;
    }
    if (payload?.type === 'line-deleted') {
      if (
        applyQuoteLineDeleteToRecord(record.value, {
          deletedLine: payload.deletedLine || payload.deleted,
          totals: payload.totals,
          sections: payload.sections,
          lineIdField: 'purchaseOrderLineId'
        })
      ) {
        return;
      }
      if (Array.isArray(payload.lines)) record.value.lines = payload.lines;
      return;
    }
    if (payload?.type === 'lines-added') {
      applyQuoteLinesAddToRecord(record.value, {
        lines: payload.lines,
        totals: payload.totals,
        sections: payload.sections,
        lineIdField: 'purchaseOrderLineId'
      });
      return;
    }
    if (payload?.type === 'line-updated') {
      applyQuoteLinesMutationToRecord(record.value, {
        line: payload.line,
        totals: payload.totals,
        sections: payload.sections,
        lineIdField: 'purchaseOrderLineId',
        sectionUuidField: 'purchaseOrderSectionId'
      });
      return;
    }
    if (payload?.type === 'lines-recalculated') {
      if (Array.isArray(payload.lines)) record.value.lines = payload.lines;
      if (payload.totals) {
        Object.assign(record.value, payload.totals);
        if (payload.totals.globalDiscountTotal != null) {
          record.value.overallDiscountTotal = payload.totals.globalDiscountTotal;
        }
      }
      if (payload.purchaseOrder) Object.assign(record.value, payload.purchaseOrder);
      if (payload.quote) {
        Object.assign(record.value, {
          overallDiscountType:
            payload.quote.globalDiscountType ?? payload.quote.overallDiscountType ?? record.value.overallDiscountType,
          overallDiscountValue:
            payload.quote.globalDiscountValue ?? payload.quote.overallDiscountValue ?? record.value.overallDiscountValue,
          overallDiscountTotal:
            payload.quote.globalDiscountTotal ?? payload.quote.overallDiscountTotal ?? record.value.overallDiscountTotal,
          adjustmentTotal: payload.quote.adjustmentTotal ?? record.value.adjustmentTotal,
          transactionTaxSnapshot: payload.quote.transactionTaxSnapshot ?? record.value.transactionTaxSnapshot,
          chargeDocumentSnapshot: payload.quote.chargeDocumentSnapshot ?? record.value.chargeDocumentSnapshot,
          subtotal: payload.quote.subtotal ?? record.value.subtotal,
          grandTotal: payload.quote.grandTotal ?? record.value.grandTotal,
          preTaxTotal: payload.quote.preTaxTotal ?? record.value.preTaxTotal,
          taxTotal: payload.quote.taxTotal ?? record.value.taxTotal,
          chargesTotal: payload.quote.chargesTotal ?? record.value.chargesTotal
        });
      }
      return;
    }
    fetchRecord({ preserveScroll: true, soft: true });
    return;
  }

  if (moduleKeyLower.value === 'purchase_returns' && record.value) {
    if (payload && typeof payload === 'object' && (payload.purchaseReturnNumber || Array.isArray(payload.lines) || payload.status)) {
      Object.assign(record.value, payload);
      return;
    }
    fetchRecord({ preserveScroll: true, soft: true });
    return;
  }

  if (moduleKeyLower.value === 'delivery_returns' && record.value) {
    if (payload && typeof payload === 'object' && (payload.deliveryReturnNumber || Array.isArray(payload.lines) || payload.status)) {
      Object.assign(record.value, payload);
      return;
    }
    fetchRecord({ preserveScroll: true, soft: true });
    return;
  }

  if (moduleKeyLower.value === 'delivery_notes' && record.value) {
    if (payload && typeof payload === 'object' && (payload.deliveryNoteNumber || Array.isArray(payload.lines) || payload.status)) {
      Object.assign(record.value, payload);
      return;
    }
    fetchRecord({ preserveScroll: true, soft: true });
    return;
  }

  if (moduleKeyLower.value === 'receipt_notes' && record.value) {
    if (payload && typeof payload === 'object' && (payload.receiptNoteNumber || Array.isArray(payload.lines) || payload.status)) {
      Object.assign(record.value, payload);
      return;
    }
    fetchRecord({ preserveScroll: true, soft: true });
    return;
  }

  if (moduleKeyLower.value !== 'quotes' || !record.value) {
    fetchRecord();
    return;
  }

  if (payload?.type === 'soft-refresh') {
    fetchRecord({ preserveScroll: true, soft: true });
    return;
  }

  if (
    payload?.type === 'line-deleted' &&
    applyQuoteLineDeleteToRecord(record.value, {
      deletedLine: payload.deletedLine,
      totals: payload.totals,
      sections: payload.sections
    })
  ) {
    return;
  }

  if (
    payload?.type === 'lines-added' &&
    applyQuoteLinesAddToRecord(record.value, {
      lines: payload.lines,
      totals: payload.totals,
      sections: payload.sections
    })
  ) {
    return;
  }

  if (
    payload?.type === 'line-updated' &&
    applyQuoteLinesMutationToRecord(record.value, {
      line: payload.line,
      totals: payload.totals,
      sections: payload.sections
    })
  ) {
    return;
  }

  if (
    payload?.type === 'lines-recalculated' &&
    applyQuoteLinesRecalculateToRecord(record.value, {
      lines: payload.lines,
      totals: payload.totals,
      sections: payload.sections
    })
  ) {
    return;
  }

  if (
    payload?.type === 'quote-updated' &&
    applyQuoteHeaderPatchToRecord(record.value, payload.quote)
  ) {
    return;
  }

  if (
    (payload?.type === 'quote-discounts-updated' ||
      payload?.type === 'quote-taxes-charges-updated') &&
    applyQuoteDiscountsToRecord(record.value, {
      quote: payload.quote,
      lines: payload.lines,
      totals: payload.totals,
      sections: payload.sections
    })
  ) {
    return;
  }

  if (
    payload?.type === 'sections-updated' &&
    applyQuoteSectionsToRecord(record.value, payload.sections)
  ) {
    if (payload.totals) {
      applyQuoteLinesRecalculateToRecord(record.value, {
        lines: payload.lines,
        totals: payload.totals,
        sections: payload.sections
      });
    }
    return;
  }

  fetchRecord({ preserveScroll: true, soft: true });
}

/** Debounced soft refetch when SSE says this open record changed (process / other tab). */
let softRefreshTimer = null;
let softRefreshFollowUpTimer = null;
function scheduleSoftRecordRefresh(delayMs = 350) {
  if (!props.recordId || props.recordId === 'new') return;
  if (softRefreshTimer) clearTimeout(softRefreshTimer);
  softRefreshTimer = setTimeout(() => {
    softRefreshTimer = null;
    void fetchRecord({ preserveScroll: true, soft: true });
    // Second pass for async process/assignment writes (still only 2 GETs, no polling loop)
    if (softRefreshFollowUpTimer) clearTimeout(softRefreshFollowUpTimer);
    softRefreshFollowUpTimer = setTimeout(() => {
      softRefreshFollowUpTimer = null;
      void fetchRecord({ preserveScroll: true, soft: true });
    }, 1200);
  }, delayMs);
}

function moduleKeyAliasesMatch(a, b) {
  const canon = (k) => {
    const x = String(k || '').toLowerCase();
    if (x === 'organization') return 'organizations';
    if (x === 'deal') return 'deals';
    if (x === 'quote') return 'quotes';
    if (x === 'case') return 'cases';
    return x;
  };
  return canon(a) === canon(b);
}

function onArivuDataChange(event) {
  const detail = event?.detail;
  if (!detail?.recordId || !detail?.moduleKey) return;
  if (String(detail.recordId) !== String(props.recordId)) return;
  if (!moduleKeyAliasesMatch(detail.moduleKey, props.moduleKey)) return;
  // Instant UI update from Astra/local writes, then soft GET for full consistency
  if (detail.patch && typeof detail.patch === 'object' && record.value) {
    Object.assign(record.value, detail.patch);
  }
  scheduleSoftRecordRefresh(detail.op === 'create' ? 0 : 150);
}

async function fetchRecord(options = {}) {
  const preserveScroll = options.preserveScroll === true;
  const soft = options.soft === true;

  if (!props.recordId || props.recordId === 'new') {
    loading.value = false;
    error.value = 'Invalid record';
    return;
  }

  const scrollEl = preserveScroll ? getRecordLeftPaneScrollEl() : null;
  const savedScrollTop = scrollEl?.scrollTop ?? 0;

  const runId = ++fetchRecordRunId;
  if (!soft) {
    loading.value = true;
  }
  if (!soft) {
    error.value = null;
    activityRaw.value = [];
    emailThreads.value = [];
    neighbors.value = { previousId: null, nextId: null };
  }
  try {
    const moduleContext = moduleFetchContextForRecord();
    const modulesParams = moduleContext ? { context: moduleContext } : {};
    const [recordRes, modulesRes] = await Promise.all([
      apiClient.get(`${recordCrudPathBase.value}/${props.recordId}`, { cache: 'no-store' }),
      fetchModulesListCached(modulesParams)
    ]);

    if (runId !== fetchRecordRunId) return;

    if (recordRes?.success && recordRes?.data) {
      record.value = recordRes.data;
    } else if (recordRes && !recordRes.success) {
      record.value = null;
      error.value = recordRes?.message || 'Failed to load record';
    } else {
      const data = recordRes?.data ?? recordRes;
      record.value = data && !Array.isArray(data) ? data : null;
    }

    if (record.value?._id) {
      recordRecordDetailFingerprint(props.moduleKey, props.recordId, route.meta?.appKey || '', {
        updatedAtMs: extractRecordUpdatedAtMs(record.value),
      });
    }

    const modules = Array.isArray(modulesRes) ? modulesRes : modulesRes?.data ?? modulesRes?.data?.data ?? modulesRes?.modules ?? [];
    moduleDefinition.value = modules.find((m) => String(m?.key || '').toLowerCase() === props.moduleKey.toLowerCase()) || null;
  } catch (e) {
    if (runId !== fetchRecordRunId) return;
    error.value = e?.message || 'Failed to load record';
    record.value = null;
  } finally {
    if (runId === fetchRecordRunId) {
      // Always clear when this is the latest run. Soft refreshes that supersede an
      // in-flight hard load (onMounted + onActivated) must not leave loading stuck.
      loading.value = false;
      if (record.value?._id) {
        loadDeferredRecordData(runId, record.value).catch((deferredErr) => {
          console.warn('Deferred record data load failed:', deferredErr);
        });
      }
      if (preserveScroll && scrollEl) {
        nextTick(() => {
          scrollEl.scrollTop = savedScrollTop;
        });
      }
    }
  }
}

async function loadDeferredRecordData(runId, loadedRecord) {
  const isCurrentRun = () => runId === fetchRecordRunId && String(record.value?._id || '') === String(loadedRecord?._id || '');
  const lowerModuleKey = (props.moduleKey || '').toLowerCase();
  const deferredLoads = [
    loadActivityForRecord(isCurrentRun),
    loadNeighborsForRecord(isCurrentRun),
    loadEmailThreadsForRecord(loadedRecord, isCurrentRun),
    loadPeopleOrganizationLookup(lowerModuleKey, isCurrentRun),
    loadCaseLookups(lowerModuleKey, isCurrentRun),
    loadQuoteLookups(lowerModuleKey, isCurrentRun),
    loadDocumentFolderLookups(lowerModuleKey, isCurrentRun),
    loadFormRecordDeferredData(lowerModuleKey, isCurrentRun)
  ];

  if (moduleNeedsUserLookup(moduleDefinition.value)) {
    deferredLoads.push(loadUserLookup(isCurrentRun));
  } else if (isCurrentRun()) {
    userLookupList.value = [];
  }

  if (lowerModuleKey === 'items') {
    deferredLoads.push(loadCatalogCategoryLookup(isCurrentRun));
  } else if (isCurrentRun()) {
    catalogCategoryLookupList.value = [];
  }

  await Promise.allSettled(deferredLoads);
}

function moduleNeedsUserLookup(mod) {
  const fields = mod?.fields;
  if (!Array.isArray(fields) || fields.length === 0) return false;

  return fields.some((field) => {
    const key = String(field?.key || '').toLowerCase();
    const dataType = String(field?.dataType || field?.type || '').toLowerCase();
    const lookupModule = String(field?.lookupModule || field?.targetModule || '').toLowerCase();

    if (dataType === 'user' || dataType === 'users') return true;
    if (lookupModule === 'users' || lookupModule === 'user') return true;
    if (dataType.includes('user') && dataType.includes('lookup')) return true;

    return (
      key === 'assignedto'
      || key === 'owner_id'
      || key === 'ownerid'
      || key === 'owner'
      || key === 'assignedto'
      || key === 'createdby'
      || key === 'updatedby'
      || key === 'modifiedby'
      || key === 'deletedby'
      || key.endsWith('userid')
    );
  });
}

async function loadFormRecordDeferredData(lowerModuleKey, isCurrentRun) {
  if (lowerModuleKey !== 'forms') {
    if (isCurrentRun()) {
      formAnalytics.value = null;
      formResponseSummary.value = null;
      formResponses.value = [];
    }
    return;
  }
  formResponsesPagination.value.currentPage = 1;
  await Promise.allSettled([
    fetchFormAnalytics(),
    fetchFormResponses(1),
    fetchFormResponseSummary()
  ]);
  if (!isCurrentRun()) return;
}

async function loadActivityForRecord(isCurrentRun) {
  try {
    const activityRes = await apiClient.get(`/modules/${props.moduleKey}/records/${props.recordId}/activity`);
    if (!isCurrentRun()) return;
    activityRaw.value = activityRes?.success && Array.isArray(activityRes.data) ? activityRes.data : [];
  } catch {
    if (isCurrentRun()) activityRaw.value = [];
  }
}

async function loadNeighborsForRecord(isCurrentRun) {
  try {
    const neighborsRes = await apiClient.get(`/modules/${props.moduleKey}/records/${props.recordId}/neighbors`);
    if (!isCurrentRun()) return;
    neighbors.value = neighborsRes?.success && neighborsRes.data
      ? neighborsRes.data
      : { previousId: null, nextId: null };
  } catch {
    if (isCurrentRun()) neighbors.value = { previousId: null, nextId: null };
  }
}

async function loadEmailThreadsForRecord(loadedRecord, isCurrentRun) {
  if (!supportsEmail.value || !loadedRecord?._id) {
    if (isCurrentRun()) emailThreads.value = [];
    return;
  }

  try {
    const threadsRes = await apiClient.getOptional('/communications/threads', {
      params: { moduleKey: props.moduleKey, recordId: loadedRecord._id, includeDone: true }
    });
    if (!isCurrentRun()) return;
    emailThreads.value = threadsRes?.success && Array.isArray(threadsRes?.data?.threads)
      ? threadsRes.data.threads
      : [];
  } catch {
    if (isCurrentRun()) emailThreads.value = [];
  }
}

async function loadPeopleOrganizationLookup(lowerModuleKey, isCurrentRun) {
  if (lowerModuleKey !== 'people') {
    if (isCurrentRun()) peopleOrganizationList.value = [];
    return;
  }

  try {
    const orgRes = await fetchOrganizationsListCached({ limit: 500 });
    if (!isCurrentRun()) return;
    const data = orgRes?.data ?? orgRes;
    peopleOrganizationList.value = Array.isArray(data) ? data : (data?.data ? (Array.isArray(data.data) ? data.data : []) : []);
  } catch (e) {
    console.error('Fetch people organization list error:', e);
    if (isCurrentRun()) peopleOrganizationList.value = [];
  }
}

async function loadCaseLookups(lowerModuleKey, isCurrentRun) {
  if (lowerModuleKey !== 'cases') {
    if (isCurrentRun()) {
      caseContactLookupList.value = [];
      caseOrganizationLookupList.value = [];
    }
    return;
  }

  try {
    const [contactRes, caseOrgRes] = await Promise.all([
      fetchPeopleListCached({ limit: 500, sortBy: 'firstName', sortOrder: 'asc' }),
      fetchOrganizationsListCached({ limit: 500 }),
    ]);
    if (!isCurrentRun()) return;
    const contactRows = Array.isArray(contactRes?.data) ? contactRes.data : (contactRes?.data?.data && Array.isArray(contactRes.data.data) ? contactRes.data.data : []);
    caseContactLookupList.value = contactRows.map((p) => {
      const id = p?._id ?? p?.id;
      const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim()
        || p?.name
        || p?.email
        || (id != null ? String(id) : '—');
      return { _id: id, name, ...p };
    }).filter((p) => Boolean(p._id));
    const orgData = caseOrgRes?.data ?? caseOrgRes;
    const orgRows = Array.isArray(orgData) ? orgData : (orgData?.data && Array.isArray(orgData.data) ? orgData.data : []);
    caseOrganizationLookupList.value = orgRows.map((o) => {
      const id = o?._id ?? o?.id;
      return { _id: id, name: o?.name ?? (id != null ? String(id) : '—'), ...o };
    }).filter((o) => Boolean(o._id));
  } catch (e) {
    console.error('Fetch case contact/organization lists error:', e);
    if (isCurrentRun()) {
      caseContactLookupList.value = [];
      caseOrganizationLookupList.value = [];
    }
  }
}

async function loadQuoteLookups(lowerModuleKey, isCurrentRun) {
  if (!['quotes', 'invoices', 'purchase_orders', 'purchase_returns', 'delivery_returns', 'delivery_notes'].includes(lowerModuleKey)) {
    if (isCurrentRun()) {
      quoteContactLookupList.value = [];
      quoteOrganizationLookupList.value = [];
      quoteDealLookupList.value = [];
    }
    return;
  }

  try {
    const needsDeals = lowerModuleKey === 'quotes' || lowerModuleKey === 'invoices';
    const [contactRes, orgRes, dealRes] = await Promise.all([
      apiClient.get('/people', { params: { limit: 200, sortBy: 'firstName', sortOrder: 'asc' } }),
      apiClient.get('/v2/organization', { params: { limit: 200 } }),
      needsDeals
        ? apiClient.get('/deals', { params: { limit: 200 } })
        : Promise.resolve({ data: [] })
    ]);
    if (!isCurrentRun()) return;

    const contactRows = Array.isArray(contactRes?.data)
      ? contactRes.data
      : (contactRes?.data?.data && Array.isArray(contactRes.data.data) ? contactRes.data.data : []);
    quoteContactLookupList.value = contactRows
      .map((p) => {
        const id = p?._id ?? p?.id;
        const name =
          [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() ||
          p?.name ||
          p?.email ||
          (id != null ? String(id) : '—');
        return { _id: id, name, ...p };
      })
      .filter((p) => Boolean(p._id));

    const orgData = orgRes?.data ?? orgRes;
    const orgRows = Array.isArray(orgData)
      ? orgData
      : (orgData?.data && Array.isArray(orgData.data) ? orgData.data : []);
    quoteOrganizationLookupList.value = orgRows
      .map((o) => {
        const id = o?._id ?? o?.id;
        return { _id: id, name: o?.name ?? (id != null ? String(id) : '—'), ...o };
      })
      .filter((o) => Boolean(o._id));

    if (lowerModuleKey === 'purchase_orders' || lowerModuleKey === 'purchase_returns') {
      quoteOrganizationLookupList.value = quoteOrganizationLookupList.value.filter((o) => {
        const types = Array.isArray(o.types) ? o.types : [];
        if (types.some((t) => String(t || '').toLowerCase() === 'vendor')) return true;
        const invRole = o.participations?.INVENTORY?.role || o.participations?.inventory?.role;
        return String(invRole || '').toLowerCase() === 'vendor';
      });
    }
    if (lowerModuleKey === 'delivery_returns' || lowerModuleKey === 'delivery_notes') {
      quoteOrganizationLookupList.value = quoteOrganizationLookupList.value.filter((o) => {
        const types = Array.isArray(o.types) ? o.types : [];
        if (types.some((t) => String(t || '').toLowerCase() === 'customer')) return true;
        const salesRole = o.participations?.SALES?.role || o.participations?.sales?.role;
        const invRole = o.participations?.INVENTORY?.role || o.participations?.inventory?.role;
        return (
          String(salesRole || '').toLowerCase() === 'customer' ||
          String(invRole || '').toLowerCase() === 'customer'
        );
      });
    }
    if (!needsDeals) {
      quoteDealLookupList.value = [];
      return;
    }

    const dealData = dealRes?.data ?? dealRes;
    const dealRows = Array.isArray(dealData)
      ? dealData
      : (dealData?.data && Array.isArray(dealData.data) ? dealData.data : []);
    quoteDealLookupList.value = dealRows
      .map((d) => {
        const id = d?._id ?? d?.id;
        return { _id: id, name: d?.name ?? (id != null ? String(id) : '—'), ...d };
      })
      .filter((d) => Boolean(d._id));
  } catch (e) {
    console.error('Fetch quote lookup lists error:', e);
    if (isCurrentRun()) {
      quoteContactLookupList.value = [];
      quoteOrganizationLookupList.value = [];
      quoteDealLookupList.value = [];
    }
  }
}

async function loadDocumentFolderLookups(lowerModuleKey, isCurrentRun) {
  if (lowerModuleKey !== 'documents') {
    if (isCurrentRun()) documentFolderLookupList.value = [];
    return;
  }

  try {
    const res = await apiClient.get('/document-folders', { params: { all: '1' } });
    if (!isCurrentRun()) return;
    const rows = res?.success && Array.isArray(res?.data)
      ? res.data
      : (Array.isArray(res?.data) ? res.data : []);
    documentFolderLookupList.value = rows.map((folder) => {
      const id = folder?._id ?? folder?.id;
      const name = String(folder?.name || '').trim() || (id != null ? String(id) : '—');
      const path = String(folder?.path || '').trim();
      const label = path && path !== `/${name}` ? `${name} (${path})` : name;
      return { _id: id, name: label, ...folder };
    }).filter((folder) => Boolean(folder._id));
  } catch (e) {
    console.error('Fetch document folder lookup list error:', e);
    if (isCurrentRun()) documentFolderLookupList.value = [];
  }
}

async function loadUserLookup(isCurrentRun) {
  try {
    const usersRes = await fetchUsersListCached({ limit: 500 });
    if (!isCurrentRun()) return;
    const usersData = usersRes?.data ?? usersRes;
    const users = Array.isArray(usersData)
      ? usersData
      : (Array.isArray(usersData?.data) ? usersData.data : []);
    userLookupList.value = users.map((u) => ({
      _id: u?._id || u?.id,
      firstName: u?.firstName || u?.first_name,
      lastName: u?.lastName || u?.last_name,
      email: u?.email,
      avatar: u?.avatar,
      name: [u?.firstName || u?.first_name, u?.lastName || u?.last_name].filter(Boolean).join(' ').trim()
        || u?.username
        || u?.email
        || (u?._id || u?.id || '')
    })).filter((u) => Boolean(u._id));
  } catch (userErr) {
    console.error('Fetch user lookup list error:', userErr);
    if (isCurrentRun()) userLookupList.value = [];
  }
}

function flattenCatalogCategoryTreeForLookup(tree) {
  const out = [];
  const walk = (node, parentLabel = '') => {
    if (!node || typeof node !== 'object') return;
    const id = node._id || node.id;
    const name = node.name || node.label;
    const label = parentLabel && name ? `${parentLabel} / ${name}` : (name || '');
    if (id) {
      out.push({ _id: id, name: label || name, path: node.path, label: label || name });
    }
    const children = Array.isArray(node.children) ? node.children : [];
    for (const child of children) walk(child, label || name || parentLabel);
  };
  if (Array.isArray(tree)) {
    for (const root of tree) walk(root, '');
  } else if (tree) {
    walk(tree, '');
  }
  return out;
}

async function loadCatalogCategoryLookup(isCurrentRun) {
  try {
    const response = await apiClient.get('/catalog/categories/tree');
    if (!isCurrentRun()) return;
    const payload = response?.data?.data ?? response?.data ?? response;
    catalogCategoryLookupList.value = flattenCatalogCategoryTreeForLookup(payload);
  } catch (err) {
    console.error('Fetch catalog category lookup list error:', err);
    if (isCurrentRun()) catalogCategoryLookupList.value = [];
  }
}

async function addComment(content, attachments, parentCommentId) {
  try {
    const text = typeof content === 'string' ? content : (content?.content || '');
    const response = await apiClient.post(`/modules/${props.moduleKey}/records/${props.recordId}/comments`, {
      content: text,
      attachments: Array.isArray(attachments) && attachments.length > 0 ? attachments : undefined,
      parentCommentId: parentCommentId || null
    });
    const createdComment = response?.data?.data ?? response?.data ?? null;
    appendRawActivityEvent(buildRawActivityFromCreatedComment(createdComment));
    newCommentText.value = '';
    // Super Agent mentions reply in Activity asynchronously — refresh to pick up replies.
    if (/\(agent:[^)]+\)/.test(String(text))) {
      const refresh = () => {
        void loadActivityForRecord(() => true);
      };
      setTimeout(refresh, 1500);
      setTimeout(refresh, 6000);
    }
  } catch (e) {
    console.error('Add comment error:', e);
  }
}

function handleAddComment(payload) {
  const content = typeof payload === 'string' ? payload.trim() : String(payload?.content || '').trim();
  const files = typeof payload === 'object' && Array.isArray(payload?.files) ? payload.files : [];
  if (!content && files.length === 0) return;
  addCommentWithUploads(content, files, isThreadViewActive.value ? activeThreadRootCommentId.value : null);
}

async function uploadModuleCommentAttachmentFile(file) {
  if (!props.moduleKey || !props.recordId || !file) return null;
  const token = authStore.user?.token;
  const formData = new FormData();
  formData.append('file', file);

  const uploadRes = await fetch(`/api/modules/${props.moduleKey}/records/${props.recordId}/comment-attachments`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });

  if (!uploadRes.ok) {
    const errData = await uploadRes.json().catch(() => ({}));
    console.error('Module comment attachment upload failed:', uploadRes.status, errData.error || errData.message || uploadRes.statusText);
    return null;
  }

  const result = await uploadRes.json();
  if (!result?.success || !result?.url) return null;
  return {
    url: result.url,
    filename: result.originalname || file.name,
    size: result.size ?? file.size,
    mimetype: result.mimetype || file.type,
    documentId: result.documentId || undefined
  };
}

async function addCommentWithUploads(content, files, parentCommentId) {
  try {
    const attachments = [];
    for (const file of files) {
      const uploaded = await uploadModuleCommentAttachmentFile(file);
      if (uploaded) attachments.push(uploaded);
    }
    const finalContent = content || (attachments.length > 0 ? 'Attached file(s)' : '');
    if (!finalContent) return;
    await addComment(finalContent, attachments, parentCommentId);
  } catch (e) {
    console.error('Add comment with uploads error:', e);
  }
}

function closeCommentThread() {
  activeThreadRootCommentId.value = null;
}

function openCommentThread(event) {
  if (!event || event.type !== 'comment') return;
  const commentId = getCommentEventId(event);
  if (!commentId) return;
  activeThreadRootCommentId.value = commentId;
  nextTick(() => {
    activitySectionRef.value?.focusCommentInput?.();
  });
}

function getCommentThreadReplyCount(event) {
  const rootId = getCommentEventId(event);
  if (!rootId) return 0;
  return (commentThreadRepliesByRootId.value.get(rootId) || []).length;
}

function getCommentThreadLatestReplyAuthor(event) {
  const rootId = getCommentEventId(event);
  if (!rootId) return null;
  const replies = commentThreadRepliesByRootId.value.get(rootId) || [];
  const latestReply = replies[replies.length - 1];
  return latestReply?.author || latestReply?.actor || null;
}

const setEditingCommentText = (value) => {
  editingCommentText.value = typeof value === 'string' ? value : '';
};

const setEditingCommentAttachments = (value) => {
  editingCommentAttachments.value = Array.isArray(value) ? value : [];
};

const normalizeCommentTextForCompare = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const normalizeCommentAttachmentForCompare = (attachment) => ({
  url: attachment?.url || '',
  filename: attachment?.filename || attachment?.name || '',
  size: Number(attachment?.size) || 0,
  mimetype: attachment?.mimetype || attachment?.type || ''
});

const areCommentAttachmentListsEqual = (left, right) => {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((attachment, idx) => {
    const normalizedLeft = normalizeCommentAttachmentForCompare(attachment);
    const normalizedRight = normalizeCommentAttachmentForCompare(right[idx]);
    return normalizedLeft.url === normalizedRight.url
      && normalizedLeft.filename === normalizedRight.filename
      && normalizedLeft.size === normalizedRight.size
      && normalizedLeft.mimetype === normalizedRight.mimetype;
  });
};

const isEditingCommentDirty = computed(() => {
  if (!editingCommentId.value) return false;
  const textChanged = normalizeCommentTextForCompare(editingCommentText.value) !== normalizeCommentTextForCompare(editingCommentOriginalText.value);
  const attachmentsChanged = !areCommentAttachmentListsEqual(editingCommentAttachments.value, editingCommentOriginalAttachments.value);
  return textChanged || attachmentsChanged || editingCommentHasPendingFiles.value;
});

function canEditComment(event) {
  if (!event || event.type !== 'comment') return false;
  const currentUserId = String(authStore.user?._id || authStore.user?.id || '');
  if (!currentUserId) return false;
  const author = event.author || event.actor || event.payload?.author || event.payload?.actor;
  const authorId = String(author?._id || author?.id || event?.meta?.authorId || event?.payload?.authorId || '');
  return Boolean(authorId) && authorId === currentUserId;
}

function startEditComment(event) {
  if (!canEditComment(event)) return;
  const commentId = getCommentEventId(event);
  if (!commentId) return;
  const initialText = String(event.content || event.text || '');
  const initialAttachmentsSource = event.attachments ?? event.payload?.attachments;
  const initialAttachments = Array.isArray(initialAttachmentsSource)
    ? initialAttachmentsSource.map((attachment) => ({ ...attachment }))
    : [];
  editingCommentId.value = commentId;
  editingCommentText.value = initialText;
  editingCommentAttachments.value = initialAttachments;
  editingCommentOriginalText.value = initialText;
  editingCommentOriginalAttachments.value = initialAttachments.map((attachment) => ({ ...attachment }));
  editingCommentHasPendingFiles.value = false;
}

function cancelEditComment() {
  editingCommentId.value = null;
  editingCommentText.value = '';
  editingCommentAttachments.value = [];
  editingCommentOriginalText.value = '';
  editingCommentOriginalAttachments.value = [];
  editingCommentHasPendingFiles.value = false;
}

function handleEditCommentFilesChange(files) {
  editingCommentHasPendingFiles.value = Array.isArray(files) && files.length > 0;
}

const isEditCommentSubmitPayload = (payload) => (
  Boolean(payload)
  && typeof payload === 'object'
  && (
    typeof payload.content === 'string'
    || Array.isArray(payload.files)
    || Array.isArray(payload.existingAttachments)
  )
);

const handleSaveEditCommentClick = () => {
  saveEditComment();
};

async function saveEditComment(submitPayload) {
  if (!props.moduleKey || !props.recordId || !editingCommentId.value) return;
  if (!isEditingCommentDirty.value) return;
  try {
    const resolvedPayload = isEditCommentSubmitPayload(submitPayload) ? submitPayload : null;
    const content = String(
      typeof resolvedPayload?.content === 'string'
        ? resolvedPayload.content
        : editingCommentText.value
    ).trim();
    const files = Array.isArray(resolvedPayload?.files) ? resolvedPayload.files : [];
    const existingAttachments = Array.isArray(resolvedPayload?.existingAttachments)
      ? resolvedPayload.existingAttachments
      : editingCommentAttachments.value;

    const uploadedAttachments = [];
    for (const file of files) {
      const uploaded = await uploadModuleCommentAttachmentFile(file);
      if (uploaded) uploadedAttachments.push(uploaded);
    }

    const finalAttachments = [...existingAttachments, ...uploadedAttachments];
    const response = await apiClient.put(
      `/modules/${props.moduleKey}/records/${props.recordId}/comments/${editingCommentId.value}`,
      {
        content,
        attachments: finalAttachments
      }
    );
    if (response?.success) {
      await refreshRecordActivity();
      cancelEditComment();
    }
  } catch (editErr) {
    console.error('Save edited comment failed:', editErr);
  }
}

const commentReactionApi = createCommentReactionApi({
  type: 'module-record',
  getModuleKey: () => props.moduleKey,
  getRecordId: () => props.recordId
});

const { toggleCommentReaction } = useCommentReactionActions({
  getCommentId: (event) => getCommentEventId(event),
  normalizeEmoji: (emoji) => String(emoji || '').trim(),
  canToggle: () => Boolean(props.moduleKey && props.recordId),
  requestToggle: ({ commentId, emoji }) => commentReactionApi.toggleReaction({ commentId, emoji }),
  onSuccess: async () => {
    await refreshRecordActivity();
  },
  logPrefix: 'Failed to toggle comment reaction:'
});

function setCommentReactionButtonRef(event, el) {
  const key = getCommentEventId(event);
  if (!key) return;
  if (el) {
    commentReactionButtonRefs.set(key, el);
    return;
  }
  commentReactionButtonRefs.delete(key);
}

function updateCommentReactionPickerPosition() {
  if (!showCommentReactionPicker.value || !commentReactionPickerCommentKey.value) return;
  const anchor = commentReactionButtonRefs.get(commentReactionPickerCommentKey.value);
  if (!anchor) return;

  const rect = anchor.getBoundingClientRect();
  const pickerWidth = commentReactionPickerRef.value?.offsetWidth || 320;
  const pickerHeight = commentReactionPickerRef.value?.offsetHeight || 90;
  const spaceAbove = rect.top;
  const spaceBelow = window.innerHeight - rect.bottom;

  let top;
  if (spaceAbove >= pickerHeight + 8 || spaceAbove >= spaceBelow) {
    top = rect.top - pickerHeight - 6;
  } else {
    top = rect.bottom + 6;
  }
  top = Math.max(8, Math.min(top, window.innerHeight - pickerHeight - 8));

  let left = rect.left;
  left = Math.max(8, Math.min(left, window.innerWidth - pickerWidth - 8));
  commentReactionPickerPosition.value = { top, left };
}

function closeCommentReactionPicker() {
  showCommentReactionPicker.value = false;
  commentReactionPickerCommentKey.value = '';
}

function toggleCommentReactionPicker(event) {
  const key = getCommentEventId(event);
  if (!key) return;
  if (showCommentReactionPicker.value && commentReactionPickerCommentKey.value === key) {
    closeCommentReactionPicker();
    return;
  }
  commentReactionPickerCommentKey.value = key;
  showCommentReactionPicker.value = true;
  nextTick(() => {
    updateCommentReactionPickerPosition();
  });
}

async function addCommentReactionFromPicker(emoji) {
  const key = commentReactionPickerCommentKey.value;
  if (!key || !emoji) return;
  const event = commentEventsById.value.get(key) || null;
  if (!event) return;
  await toggleCommentReaction(event, emoji);
  closeCommentReactionPicker();
}

async function handleCommentReactionEmojiClick(event) {
  const emoji = event?.detail?.unicode || '';
  if (!emoji) return;
  await addCommentReactionFromPicker(emoji);
}

function handleCommentReactionPickerOutsideClick(event) {
  if (!showCommentReactionPicker.value) return;
  const target = event.target;
  if (commentReactionPickerRef.value?.contains(target)) return;
  const anchor = commentReactionButtonRefs.get(commentReactionPickerCommentKey.value);
  if (anchor?.contains(target)) return;
  closeCommentReactionPicker();
}

function syncEmojiPickerTheme() {
  if (typeof document === 'undefined') return;
  isDarkTheme.value = document.documentElement.classList.contains('dark');
}

function handleTitleSave(value) {
  if (!record.value) return;

  const moduleKeyLower = (props.moduleKey || '').toLowerCase();
  const title = String(value || '').trim();
  if (!title) return;

  // People: parse title into first_name / last_name and keep name in sync.
  if (moduleKeyLower === 'people') {
    const parts = title.split(/\s+/).filter(Boolean);
    let firstName = '';
    let lastName = '';
    if (parts.length === 1) {
      firstName = parts[0];
    } else if (parts.length > 1) {
      lastName = parts.pop();
      firstName = parts.join(' ');
    }

    const payload = {
      name: title,
      first_name: firstName || undefined,
      last_name: lastName || undefined
    };

    apiClient.put(`${recordCrudPathBase.value}/${props.recordId}`, payload).then(() => {
      if (!record.value) return;
      record.value.name = title;
      if (firstName !== undefined) record.value.first_name = firstName;
      if (lastName !== undefined) record.value.last_name = lastName;
      notifyListRecordUpdated(record.value);
    }).catch((e) => console.error('Save people title error:', e));
    return;
  }

  if (moduleKeyLower === 'cases') {
    apiClient
      .put(`${recordCrudPathBase.value}/${props.recordId}`, { title })
      .then(() => {
        if (record.value) record.value.title = title;
        notifyListRecordUpdated(record.value);
      })
      .catch((e) => console.error('Save case title error:', e));
    return;
  }

  if (moduleKeyLower === 'documents') {
    updateRecordFields({ title })
      .then(() => {
        if (record.value) record.value.title = title;
      })
      .catch((e) => console.error('Save document title error:', e));
    return;
  }

  // Items: primary display field is item_name (not generic name).
  if (moduleKeyLower === 'items') {
    const previous = record.value.item_name;
    record.value.item_name = title;
    record.value.name = title;
    apiClient
      .put(`${recordCrudPathBase.value}/${props.recordId}`, { item_name: title })
      .then(() => {
        notifyListRecordUpdated(record.value);
      })
      .catch((e) => {
        console.error('Save item title error:', e);
        if (record.value) {
          record.value.item_name = previous;
          record.value.name = previous;
        }
      });
    return;
  }

  // Events: primary display field is eventName.
  if (moduleKeyLower === 'events') {
    const previous = record.value.eventName;
    record.value.eventName = title;
    record.value.name = title;
    apiClient
      .put(`${recordCrudPathBase.value}/${props.recordId}`, { eventName: title })
      .then(() => {
        notifyListRecordUpdated(record.value);
      })
      .catch((e) => {
        console.error('Save event title error:', e);
        if (record.value) {
          record.value.eventName = previous;
          record.value.name = previous;
        }
      });
    return;
  }

  // Quotes / invoices / SO / PO / etc.: editable title field; document number stays immutable.
  const docFields = DOCUMENT_NUMBER_TITLE_FIELDS[moduleKeyLower];
  if (docFields) {
    const { titleKey } = docFields;
    const previous = record.value[titleKey];
    record.value[titleKey] = title;
    apiClient
      .put(`${recordCrudPathBase.value}/${props.recordId}`, { [titleKey]: title })
      .then(() => {
        notifyListRecordUpdated(record.value);
      })
      .catch((e) => {
        console.error(`Save ${moduleKeyLower} title error:`, e);
        if (record.value) record.value[titleKey] = previous;
      });
    return;
  }

  // Other modules: only update the generic name/title field.
  apiClient.put(`${recordCrudPathBase.value}/${props.recordId}`, { name: title }).then(() => {
    if (record.value) record.value.name = title;
    notifyListRecordUpdated(record.value);
  }).catch((e) => console.error('Save title error:', e));
}

function goToPrevious() {
  if (!neighbors.value.previousId) return;
  const path = recordDetailPathForId(neighbors.value.previousId);
  replaceActiveTab(path, { title: moduleLabelSingular.value || 'Record' });
}
function goToNext() {
  if (!neighbors.value.nextId) return;
  const path = recordDetailPathForId(neighbors.value.nextId);
  replaceActiveTab(path, { title: moduleLabelSingular.value || 'Record' });
}

function copyUrl() {
  const url = window.location.href;
  if (typeof navigator.clipboard !== 'undefined' && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).catch(fallbackCopyUrl);
  } else {
    fallbackCopyUrl();
  }
  function fallbackCopyUrl() {
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

function copyDocumentNumber() {
  const value = documentNumberPrefix.value;
  if (!value) return;
  if (typeof navigator.clipboard !== 'undefined' && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(value).catch(() => {});
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

function getRecordPageUrl() {
  if (!record.value?._id) return '';
  const path = recordDetailPathForId(record.value._id);
  const resolved = router.resolve(path);
  const href = resolved.href.startsWith('http') ? resolved.href : new URL(resolved.href, window.location.origin).href;
  return href;
}

function openRecordInNewTab() {
  if (!record.value?._id) return;
  const path = recordDetailPathForId(record.value._id);
  openTab(path, { title: moduleLabelSingular.value || 'Record', background: false, insertAdjacent: true });
  emit('close');
}

function copyRecordUrl() {
  const url = getRecordPageUrl();
  if (!url) return;
  if (typeof navigator.clipboard !== 'undefined' && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).catch(() => {});
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

function handleFormShareLinkUpdated(updatedForm) {
  if (!updatedForm || !record.value) return;
  record.value = { ...record.value, ...updatedForm };
}

function handleEditRecord() {
  if (!record.value) return;
  if (isFormsModule.value) {
    if (!canEditForm(record.value.status, record.value.formType)) return;
    const editPath = `/forms/create?editFrom=${record.value._id}`;
    const existingTab = findTabByPath(editPath);
    if (existingTab) {
      switchToTab(existingTab.id);
    } else {
      openTab(editPath, {
        title: t('forms.hubTabEditForm', { name: record.value.name || t('forms.hubUntitledForm') }),
        icon: 'clipboard-document',
        insertAdjacent: true
      });
    }
    return;
  }
  showEditModal.value = true;
}

function viewFormResponses() {
  if (!record.value?._id || !canShowFormResponses(record.value)) return;
  const formId = record.value._id;
  openTab(`/forms/${formId}/responses`, {
    name: `form-responses-${formId}`,
    title: `${record.value.name || t('forms.hubUntitledForm')} - ${t('records.tabResponses')}`,
    insertAdjacent: true,
    params: { formId }
  });
  router.push(`/forms/${formId}/responses`);
}

async function fetchFormResponseSummary(options = {}) {
  if (!canViewFormResponses.value || !props.recordId || !isEngagementForm.value) {
    formResponseSummary.value = null;
    return;
  }
  formResponseSummaryLoading.value = true;
  try {
    const response = await apiClient.get(`/forms/${props.recordId}/response-summary`, {
      params: {
        textPreviewLimit: options.textPreviewLimit ?? 10
      }
    });
    if (response?.success) {
      formResponseSummary.value = response.data || null;
    } else {
      formResponseSummary.value = null;
    }
  } catch (err) {
    console.error('Error fetching form response summary:', err);
    formResponseSummary.value = null;
  } finally {
    formResponseSummaryLoading.value = false;
  }
}

async function fetchFormAnalytics() {
  if (!canViewFormResponses.value || !props.recordId) {
    formAnalytics.value = null;
    return;
  }
  formAnalyticsLoading.value = true;
  try {
    const response = await apiClient.get(`/forms/${props.recordId}/analytics`);
    if (response?.success) {
      formAnalytics.value = response.data || null;
    } else {
      formAnalytics.value = null;
    }
  } catch (err) {
    console.error('Error fetching form analytics:', err);
    formAnalytics.value = null;
  } finally {
    formAnalyticsLoading.value = false;
  }
}

async function fetchFormResponses(page = formResponsesPagination.value.currentPage) {
  if (!canViewFormResponses.value || !props.recordId) {
    formResponses.value = [];
    return;
  }
  formResponsesLoading.value = true;
  try {
    const response = await apiClient.get(`/forms/${props.recordId}/responses`, {
      params: {
        page,
        limit: formResponsesPagination.value.limit,
        sortBy: 'submittedAt',
        sortOrder: 'desc'
      }
    });
    if (response?.success) {
      formResponses.value = Array.isArray(response.data) ? response.data : [];
      if (response.pagination) {
        formResponsesPagination.value.total = response.pagination.totalResponses || 0;
        formResponsesPagination.value.totalPages = response.pagination.totalPages || 1;
        formResponsesPagination.value.currentPage = response.pagination.currentPage || page;
      }
    } else {
      formResponses.value = [];
    }
  } catch (err) {
    console.error('Error fetching form responses:', err);
    formResponses.value = [];
  } finally {
    formResponsesLoading.value = false;
  }
}

function viewFormResponseDetail(responseItem) {
  if (!record.value?._id || !responseItem?._id) return;
  const formId = record.value._id;
  const responseId = responseItem._id;
  openTab(`/forms/${formId}/responses/${responseId}`, {
    name: `form-response-${responseId}`,
    title: `${t('navigation.moduleResponses')} - ${formatUserDate(responseItem.submittedAt)}`,
    insertAdjacent: true,
    params: { formId, responseId }
  });
  router.push(`/forms/${formId}/responses/${responseId}`);
}

async function handleArchiveForm() {
  if (!canArchiveFormRecord.value || !record.value?._id) return;
  try {
    const response = await apiClient.put(`/forms/${record.value._id}`, { status: 'Archived' });
    if (response?.success && response.data) {
      record.value = { ...record.value, ...response.data };
    } else if (record.value) {
      record.value.status = 'Archived';
    }
    notifyListRecordUpdated(record.value);
    formAnalytics.value = null;
    formResponses.value = [];
  } catch (err) {
    console.error('Error archiving form:', err);
    notifications.error(err?.response?.data?.message || err?.message || t('records.genericErrorTitle', { module: t('navigation.moduleForms') }));
  }
}

function closeDuplicateCreate() {
  showDuplicateCreateModal.value = false;
  duplicateInitialData.value = {};
  duplicateSourceId.value = '';
}

function handleDuplicateCreated() {
  closeDuplicateCreate();
}

async function handleDuplicate() {
  if (!record.value) return;
  if (isFormsModule.value) {
    openTab(`/forms/create?duplicateFrom=${record.value._id}`, {
      title: t('forms.hubTabDuplicateForm', { name: record.value.name || t('forms.hubUntitledForm') }),
      icon: 'clipboard-document',
      insertAdjacent: true
    });
    return;
  }
  // Open Create form prefilled — no DB write until user saves
  let source = record.value;
  const mk = String(props.moduleKey || '').toLowerCase();
  const commercialNeedsLines = ['quotes', 'invoices', 'sales_orders', 'purchase_orders'].includes(mk);
  if (commercialNeedsLines && (!Array.isArray(source.lines) || !source.lines.length)) {
    try {
      const res = await apiClient.get(`${recordCrudPathBase.value}/${source._id || source.id}`);
      const data = res?.data ?? res;
      if (data && typeof data === 'object') {
        source = {
          ...source,
          ...data,
          lines: data.lines || source.lines,
          sections: data.sections || source.sections
        };
      }
    } catch (e) {
      console.warn('[Duplicate] Could not refetch source lines:', e);
    }
  }
  duplicateSourceId.value = String(source._id || source.id || '');
  duplicateInitialData.value = buildDuplicateInitialData(source, {
    moduleKey: props.moduleKey
  });
  showDuplicateCreateModal.value = true;
}

const canDiscussInChat = computed(() => {
  return !authStore.isExternalUser
    && isAddonEntitled(authStore.user, 'internal_chat')
    && Boolean(record.value?._id || props.recordId);
});

async function handleDiscussInChat() {
  const recordId = String(record.value?._id || props.recordId || '');
  const moduleKey = String(props.moduleKey || '').toLowerCase();
  if (!recordId || !moduleKey) return;
  try {
    await openRecordDiscussChat({
      moduleKey,
      recordId,
      openTab,
      router,
      tabTitle: t('navigation.internalChat'),
    });
  } catch (err) {
    notifications.error(err?.response?.data?.message || t('internalChat.discussFailed'));
  }
}

function handleExport() {
  if (!record.value) return;
  try {
    const json = JSON.stringify(record.value, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `${props.moduleKey}-${(record.value._id || 'record').toString().slice(-8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch (e) {
    console.error('Export record error:', e);
  }
}

async function handleEmailSubmit(payload) {
  showEmailModal.value = false;
  emailComposeDraft.value = null;
  try {
    const res = await apiClient.post('/communications/email', payload);
    if (res?.success) {
      if (res?.scheduled && res?.scheduledAt) {
        let when = res.scheduledAt;
        try {
          when = new Intl.DateTimeFormat(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          }).format(new Date(res.scheduledAt));
        } catch {
          /* keep ISO */
        }
        notifications.success(t('inbox.emailComposeScheduleSuccess', { when }));
      } else {
        notifications.success(t('records.genericEmailSent'));
      }
      await fetchRecord();
    } else {
      notifications.error(res?.message || t('records.genericEmailSendFailed'));
    }
  } catch (err) {
    const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message;
    notifications.error(msg || t('records.genericEmailSendFailed'));
  }
}

function handleRecordUpdated(updated) {
  if (updated && record.value) Object.assign(record.value, updated);
  showEditModal.value = false;
  // Events update response may omit nested relation shapes depending on path — refresh for attendees etc.
  if (String(props.moduleKey || '').toLowerCase() === 'events') {
    fetchRecord?.();
  }
}

async function handleAttachModalComplete() {
  showAttachModal.value = false;
  await fetchRecord();
}

const TARGET_APP_BY_MODULE_KEY = {
  organizations: 'SALES',
  people: 'SALES',
  deals: 'SALES',
  items: 'SALES',
  cases: 'HELPDESK',
  quotes: 'PLATFORM',
  tasks: 'PLATFORM',
  events: 'PLATFORM',
  forms: 'PLATFORM',
  projects: 'PROJECTS',
  documents: 'PLATFORM'
};

async function handleLinkRecordDrawerLinked({ moduleKey: targetModuleKey, ids, context, relationshipKey: payloadRelationshipKey, targetAppKey: payloadTargetAppKey, sourceIsCurrent: payloadSourceIsCurrent }) {
  const currentId = record.value?._id;
  const contextId = context?.personId ?? context?.sourceRecordId;
  if (!currentId || !contextId || !ids?.length) return;
  if (String(currentId) !== String(contextId)) return;

  const normalizedTarget = (targetModuleKey || '').toLowerCase().trim();
  const relationshipKey = (payloadRelationshipKey || normalizedTarget).toLowerCase();
  const sourceAppKey = (recordContextAppKey.value || 'PLATFORM').toUpperCase();
  const sourceModuleKey = (props.moduleKey || '').toLowerCase();
  const linkedModuleAppKey = (payloadTargetAppKey || TARGET_APP_BY_MODULE_KEY[normalizedTarget] || 'PLATFORM').toUpperCase();
  const sourceIsCurrent = payloadSourceIsCurrent !== false;
  const optimisticRecords = [];

  for (const recordId of ids) {
    try {
      if (normalizedTarget === 'documents') {
        const linkRes = await apiClient.post(`/documents/${recordId}/link`, {
          moduleKey: sourceModuleKey,
          recordId: String(currentId),
          appKey: sourceAppKey
        });
        if (!linkRes?.success) {
          notifications.error(linkRes?.message || t('documents.linkFailed'));
          return;
        }
        const linkedDoc = linkRes.data?.document || linkRes.document;
        optimisticRecords.push({
          recordId: String(recordId),
          moduleKey: 'documents',
          appKey: 'PLATFORM',
          label: linkedDoc?.title || linkedDoc?.documentNumber || String(recordId).slice(-8),
          title: linkedDoc?.title,
          documentNumber: linkedDoc?.documentNumber
        });
        continue;
      }

      const linkPayload = sourceIsCurrent
        ? {
            relationshipKey,
            source: { appKey: sourceAppKey, moduleKey: sourceModuleKey, recordId: currentId },
            target: { appKey: linkedModuleAppKey, moduleKey: normalizedTarget, recordId }
          }
        : {
            relationshipKey,
            source: { appKey: linkedModuleAppKey, moduleKey: normalizedTarget, recordId },
            target: { appKey: sourceAppKey, moduleKey: sourceModuleKey, recordId: currentId }
          };
      await apiClient.post('/relationships/link', linkPayload);

      optimisticRecords.push({
        recordId: String(recordId),
        moduleKey: normalizedTarget,
        appKey: linkedModuleAppKey,
        label: String(recordId).slice(-8)
      });
    } catch (err) {
      console.error('Error linking record:', err);
      const responseMessage = err?.response?.data?.message;
      const validationErrors = Array.isArray(err?.response?.data?.errors)
        ? err.response.data.errors.filter(Boolean)
        : [];
      const detailedMessage = validationErrors.length > 0
        ? `${responseMessage || 'Failed to link record.'}\n\n${validationErrors.join('\n')}`
        : (responseMessage || 'Failed to link record.');
      notifications.error(detailedMessage);
      return;
    }
  }

  if (optimisticRecords.length > 0) {
    const docRelationshipKey = normalizedTarget === 'documents'
      ? resolveDocumentRelationshipKey(sourceModuleKey)
      : relationshipKey;
    mergeLinkedRecordsIntoContext(genericRecordContext, docRelationshipKey || relationshipKey, optimisticRecords, {
      moduleKey: normalizedTarget,
      appKey: linkedModuleAppKey,
      direction: sourceIsCurrent ? 'SOURCE' : 'TARGET',
      onUpdated: () => { contextRevision.value += 1; }
    });
  }

  closeLinkRecordDrawer();
  invalidateRecordContext(recordContextAppKey.value, props.moduleKey, currentId);
  void loadGenericRecordContext(true);
  void fetchRecord();
}

function handleLinkRecordDrawerCreate(payload = {}) {
  const moduleKey = String(payload?.moduleKey || '').toLowerCase().trim();
  if (!moduleKey) return;
  pendingAddRelatedLinkPayload.value = payload;
  addRelatedRecordModuleKey.value = moduleKey;
  closeLinkRecordDrawer();
  showAddRelatedRecordDrawer.value = true;
}

async function handleAddRelatedRecordSaved(savedRecord) {
  const createdId = savedRecord?._id || savedRecord?.id;
  const payload = pendingAddRelatedLinkPayload.value;
  if (!createdId || !payload?.moduleKey) {
    closeAddRelatedRecordDrawer();
    return;
  }
  closeAddRelatedRecordDrawer();
  await handleLinkRecordDrawerLinked({
    moduleKey: payload.moduleKey,
    ids: [createdId],
    context: payload.context || linkRecordDrawerContext.value,
    relationshipKey: payload.relationshipKey || undefined,
    targetAppKey: payload.targetAppKey || undefined,
    sourceIsCurrent: payload.sourceIsCurrent ?? true
  });
}

async function confirmDelete() {
  deleting.value = true;
  try {
    await apiClient.delete(`${recordCrudPathBase.value}/${props.recordId}`);
    router.push(recordCrudPathBase.value);
    emit('close');
  } catch (e) {
    if (e?.response?.data?.code === 'FORM_HAS_SUBMITTED_RESPONSES') {
      notifications.warning(t('forms.deleteBlockedSubmittedResponses.message'));
    } else {
      error.value = e?.message || 'Failed to delete';
    }
  } finally {
    deleting.value = false;
    showDeleteModal.value = false;
  }
}

watch(loading, (isLoading) => {
  if (isLoading) return;
  attachStickyTitleWhenReady();
});

watch(record, (r) => {
  if (!r) {
    resetStickyTitle();
    detachStickyTitle();
    return;
  }
  attachStickyTitleWhenReady();
  if (
    moduleKeyLower.value === 'documents'
    && route.query.edit === '1'
    && isRichDocument(r)
    && !suppressDocumentEditorAutoOpen.value
  ) {
    expandedLeftSection.value = 'content-editor';
  }
}, { immediate: true });

// Keep tab title in sync with the current record display title.
watch(
  () => recordTitle.value,
  (displayName) => {
    if (!displayName || !record.value) return;
    const tabId = activeTabId.value;
    if (!tabId || !props.recordId) return;
    const tab = findTabById(tabId);
    if (!tab?.path) return;
    const tabPathBase = tab.path.split('?')[0].replace(/\/$/, '');
    const currentPathBase = String(route.fullPath || route.path || '').split('?')[0].replace(/\/$/, '');
    const idSuffix = `/${props.recordId}`;

    // If the tab was originally opened on the list (e.g. /quotes) and then navigated
    // to the record detail via router.push, the tab path may still be the list path.
    // Keep the tab in sync with the actual route so title updates work everywhere.
    if (currentPathBase && tabPathBase && tabPathBase.toLowerCase() !== currentPathBase.toLowerCase()) {
      replaceActiveTab(route.fullPath || route.path || tab.path, { title: displayName });
      return;
    }

    if (!tabPathBase.toLowerCase().endsWith(idSuffix.toLowerCase())) return;
    updateTabTitle(tabId, displayName);
  },
  { immediate: true }
);

watch(() => [props.moduleKey, props.recordId], () => fetchRecord(), { immediate: false });

const attachRecordGlobalListeners = () => {
  window.addEventListener('scroll', updateTagPopoverPosition, true);
  window.addEventListener('resize', updateTagPopoverPosition);
  window.addEventListener('scroll', updateCommentReactionPickerPosition, true);
  window.addEventListener('scroll', updateCommentReactionTooltipPosition, true);
  window.addEventListener('resize', updateCommentReactionPickerPosition);
  window.addEventListener('resize', updateCommentReactionTooltipPosition);
  document.addEventListener('mousedown', handleTagPopoverMousedown);
  document.addEventListener('click', handleTagPopoverOutsideClick);
  document.addEventListener('mousedown', handleCommentReactionPickerOutsideClick);
};

const detachRecordGlobalListeners = () => {
  window.removeEventListener('scroll', updateTagPopoverPosition, true);
  window.removeEventListener('resize', updateTagPopoverPosition);
  window.removeEventListener('scroll', updateCommentReactionPickerPosition, true);
  window.removeEventListener('scroll', updateCommentReactionTooltipPosition, true);
  window.removeEventListener('resize', updateCommentReactionPickerPosition);
  window.removeEventListener('resize', updateCommentReactionTooltipPosition);
  document.removeEventListener('mousedown', handleTagPopoverMousedown);
  document.removeEventListener('click', handleTagPopoverOutsideClick);
  document.removeEventListener('mousedown', handleCommentReactionPickerOutsideClick);
};

onMounted(() => {
  fetchRecord();
  syncEmojiPickerTheme();
  if (typeof window !== 'undefined') {
    window.addEventListener('arivu:data-change', onArivuDataChange);
    window.addEventListener('arivu:open-email-compose', onOpenEmailComposeEvent);
  }
  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    emojiThemeObserver = new MutationObserver(() => syncEmojiPickerTheme());
    emojiThemeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  }
});

onActivated(async () => {
  const recordId = props.recordId;
  if (recordId && recordId !== 'new') {
    // Skip soft refresh while initial hard load is in flight (keep-alive remount
    // runs onMounted + onActivated; a soft supersede used to leave loading stuck).
    if (!loading.value) {
      const decision = await resolveRecordDetailRefreshOnActivate({
        moduleKey: props.moduleKey,
        appKey: route.meta?.appKey || '',
        getUpdatedAtMs: () => extractRecordUpdatedAtMs(record.value),
      }, recordId);
      if (decision === 'refresh') {
        await fetchRecord({ soft: true });
      }
    }
  }
  attachRecordGlobalListeners();
});

onDeactivated(() => {
  detachRecordGlobalListeners();
  closeCommentReactionPicker();
  cleanupCommentReactionTooltip();
});

onBeforeUnmount(() => {
  resetStickyTitle();
  detachStickyTitle();
  detachRecordGlobalListeners();
  closeCommentReactionPicker();
  cleanupCommentReactionTooltip();
  if (softRefreshTimer) {
    clearTimeout(softRefreshTimer);
    softRefreshTimer = null;
  }
  if (softRefreshFollowUpTimer) {
    clearTimeout(softRefreshFollowUpTimer);
    softRefreshFollowUpTimer = null;
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('arivu:data-change', onArivuDataChange);
    window.removeEventListener('arivu:open-email-compose', onOpenEmailComposeEvent);
  }
  if (emojiThemeObserver) {
    emojiThemeObserver.disconnect();
    emojiThemeObserver = null;
  }
});
</script>

<style scoped>
.comment-reaction-emoji-picker {
  --input-border-color: rgb(99 102 241 / 0.45);
  --input-border-radius: 12px;
  --outline-color: rgb(99 102 241 / 0.2);
  --indicator-color: rgb(99 102 241);
  --category-font-size: 15px;
  --button-active-background: rgb(99 102 241 / 0.16);
}

.comment-reaction-emoji-picker.light {
  --background: #ffffff;
  --border-color: #e5e7eb;
  --text-color: #111827;
  --input-background: #ffffff;
  --input-font-color: #111827;
}

.comment-reaction-emoji-picker.dark {
  --background: #111827;
  --border-color: #374151;
  --text-color: #f9fafb;
  --input-background: #111827;
  --input-font-color: #f9fafb;
}
</style>
