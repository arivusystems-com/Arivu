<template>
  <div ref="taskRecordPageRootRef" class="task-record-page-root flex-1 min-h-0 overflow-hidden flex flex-col">
    <RecordPageShell
      :loading="loading"
      :show-loading="embed"
      :error="error"
      :loading-message="taskLoadingMessage"
      :error-title="taskErrorTitle"
      :layout-props="{
        leftExpanded: !!expandedLeftSection,
        forceMobile: embed,
        class: [
          embed ? 'flex-1 min-h-0 overflow-hidden flex flex-col' : '',
          { 'record-page-layout--left-expanded': !!expandedLeftSection },
          '[&.record-page-layout--left-expanded_.record-page-layout__right]:hidden',
          '[&.record-page-layout--left-expanded_.record-page-layout__left]:flex-[1_1_100%] [&.record-page-layout--left-expanded_.record-page-layout__left]:max-w-full [&.record-page-layout--left-expanded_.record-page-layout__left]:pr-0 [&.record-page-layout--left-expanded_.record-page-layout__left]:min-h-0 [&.record-page-layout--left-expanded_.record-page-layout__left]:overflow-hidden',
          '[&.record-page-layout--left-expanded_.record-page-layout__left-content]:max-w-full [&.record-page-layout--left-expanded_.record-page-layout__left-content]:pl-0 [&.record-page-layout--left-expanded_.record-page-layout__left-content]:pr-0 [&.record-page-layout--left-expanded_.record-page-layout__left-content]:flex [&.record-page-layout--left-expanded_.record-page-layout__left-content]:flex-col [&.record-page-layout--left-expanded_.record-page-layout__left-content]:flex-1 [&.record-page-layout--left-expanded_.record-page-layout__left-content]:min-h-0',
          '[&.record-page-layout--left-expanded_.record-page-layout__body]:px-4'
        ]
      }"
      @retry="fetchTask"
    >
    <template v-if="!embed" #header>
      <RecordHeader
        :show-navigation="true"
        :show-back="true"
        :can-previous="canNavigatePreviousTask"
        :can-next="canNavigateNextTask"
        :previous-label="taskNavPreviousLabel"
        :next-label="taskNavNextLabel"
        :shortcut-prev="navShortcutPrev"
        :shortcut-next="navShortcutNext"
        @back="goBackToModuleList"
        @previous="goToPreviousTask"
        @next="goToNextTask"
      >
        <template #breadcrumbs>
          <span class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 min-w-0">
            <button
              type="button"
              class="shrink-0 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              :aria-label="t('records.genericBackTo', { singular: taskModuleLabel })"
              :title="t('records.genericBackTo', { singular: taskModuleLabel })"
              @click="goBackToModuleList"
            >
              {{ taskModuleLabel }}
            </button>
            <span class="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 shrink-0"></span>
            <span class="truncate">{{ (task?.title || '').trim() || (task?._id || '').slice(-8) || 'N/A' }}</span>
          </span>
        </template>
        
        <!-- Page actions (top right) -->
        <template #pageActions>
          <RecordPresenceAvatars
            v-if="showRecordPresenceAvatars"
            :sessions="recordPresenceOthers"
          />
          <button
            type="button"
            @click="showEditDrawer = true"
            class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            :aria-label="t('records.taskEditAria')"
            :title="t('records.taskEditAria')"
          >
            <PencilSquareIcon class="w-5 h-5" />
          </button>
          <button
            type="button"
            ref="tagHeaderButtonRef"
            @click="handleTagIconClick($event)"
            :class="[
              'relative inline-flex items-center justify-center p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
              hasTaskTags
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            ]"
            :aria-label="t('records.genericTagsAria')"
            :title="t('records.genericTagsAria')"
          >
            <TagIcon class="block w-5 h-5" />
            <span
              v-if="hasTaskTags"
              class="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400"
            ></span>
          </button>
          <button
            type="button"
            @click="handleCopyUrl"
            class="hidden lg:inline-flex p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            :aria-label="t('records.genericCopyUrl')"
            :title="t('records.genericCopyUrl')"
          >
            <ClipboardDocumentIcon class="w-5 h-5" />
          </button>
          <RecordPrintButton
            v-if="task?._id"
            hide-on-mobile
            module-key="tasks"
            :record-id="String(task._id)"
          />
          <button
            type="button"
            @click="handleToggleFollow"
            :class="[
              'hidden lg:inline-flex p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
              isFollowing ? 'text-yellow-500 dark:text-yellow-400' : ''
            ]"
            :aria-label="taskStarAriaLabel"
            :title="taskStarAriaLabel"
          >
            <StarIcon v-if="!isFollowing" class="w-5 h-5" />
            <StarIconSolid v-else class="w-5 h-5" />
          </button>
          <Menu as="div" class="relative">
            <MenuButton
              class="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('records.genericMoreActions')"
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
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    :class="[
                      'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2 lg:hidden',
                      active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                    ]"
                    @click="handleCopyUrl"
                  >
                    <ClipboardDocumentIcon class="w-4 h-4" />
                    <span>{{ t('records.genericCopyUrl') }}</span>
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button
                    @click="handleDuplicate"
                    :class="[
                      'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                      active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                    ]"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
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
                    @click="handleExport"
                    :class="[
                      'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                      active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                    ]"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>{{ t('actions.export') }}</span>
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button
                    @click="showEmailModal = true"
                    :class="[
                      'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                      active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                    ]"
                  >
                    <EnvelopeIcon class="w-4 h-4" />
                    <span>{{ t('records.taskEmailAssignee') }}</span>
                  </button>
                </MenuItem>
                <hr class="my-1 border-gray-200 dark:border-gray-700" />
                <MenuItem v-slot="{ active }">
                  <button
                    @click="handleDelete"
                    :class="[
                      'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                      active ? 'bg-gray-100 dark:bg-gray-700' : 'text-red-600 dark:text-red-400'
                    ]"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>{{ t('actions.delete') }}</span>
                  </button>
                </MenuItem>
              </MenuItems>
            </transition>
          </Menu>
        </template>
      </RecordHeader>
    </template>

    <template #left>
      <div
        v-if="expandedLeftSection"
        :class="[
          'flex-shrink-0 mb-4 sticky z-20 bg-white/95 dark:bg-gray-900/95 supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:dark:bg-gray-900/90 backdrop-blur',
          embed ? 'top-0' : 'top-0 lg:-top-6'
        ]"
      >
        <div class="flex items-center justify-between gap-2 py-2">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            @click="closeExpandedLeftSection"
          >
            <ArrowLeftIcon class="h-4 w-4" />
            <span>{{ t('records.taskBackTo') }}</span>
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

      <!-- Description version history full page -->
      <div
        v-if="task && expandedLeftSection === 'description-history'"
        class="description-history-page flex-1 min-h-0 mt-4 flex flex-col gap-6"
      >
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white flex-shrink-0">{{ task.title || taskModuleLabel }}</h2>
        <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[1fr] gap-6 min-h-0 flex-1">
          <!-- Left: content column – fixed height, internal scroll -->
          <div class="flex flex-col min-h-0 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden h-full">
            <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <!-- Diff view (added = green, removed = red strikethrough) when a past version is selected -->
              <div
                v-if="descriptionHistoryShowDiff && descriptionHistoryDiffHtml"
                class="text-md text-gray-900 dark:text-white px-6 py-4 leading-[1.75] [&_del]:px-0.5 [&_ins]:px-0.5"
                v-html="descriptionHistoryDiffHtml"
              />
              <!-- Rich content when current version or when diff is empty -->
              <div
                v-else-if="descriptionHistorySelectedHasContent"
                class="text-md text-gray-900 dark:text-white px-6 py-4 leading-[1.75] [&_p]:mb-2 [&_p:last-child]:mb-0 [&_p]:leading-[1.75] [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:my-4 [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:my-4 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:my-4 [&_h3]:mb-2 [&_ul]:my-2 [&_ol]:my-2 [&_ul]:pl-6 [&_ol]:pl-6 [&_ul]:list-disc [&_ol]:list-decimal [&_blockquote]:border-l-4 [&_blockquote]:border-gray-200 [&_blockquote]:pl-4 [&_blockquote]:my-2 [&_blockquote]:text-gray-500 dark:[&_blockquote]:border-gray-600 dark:[&_blockquote]:text-gray-400 [&_a]:text-indigo-600 [&_a]:underline dark:[&_a]:text-indigo-400 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:my-2 [&_img]:block [&_img]:cursor-zoom-in"
                v-html="descriptionHistorySelectedContent"
                @click="handleRichHtmlClick"
              />
              <p v-else class="px-6 py-4 text-sm text-gray-400 dark:text-gray-500 italic m-0">
                {{ t('records.genericNoDescInVersion') }}
              </p>
            </div>
          </div>
          <!-- Right: version list column – fixed height, internal scroll -->
          <div class="flex flex-col min-h-0 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden h-full">
            <h3 class="font-semibold text-gray-900 dark:text-white px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              {{ t('records.genericVersionHistory') }}
            </h3>
            <div v-if="descriptionVersionsLoading" class="flex items-center justify-center py-8 flex-1 min-h-0 overflow-hidden">
              <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            </div>
            <div v-else class="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-0">
              <label
                v-for="(ver, idx) in descriptionHistoryList"
                :key="ver.isCurrent ? 'current' : `version-${idx}-${ver.createdAt}`"
                :class="[
                  'flex items-start gap-3 py-3 px-3 rounded-lg cursor-pointer transition-colors',
                  selectedDescriptionVersionIndex === idx
                    ? 'bg-indigo-50 dark:bg-indigo-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                ]"
              >
                <input
                  v-model="selectedDescriptionVersionIndex"
                  type="radio"
                  :name="'desc-version-' + (task._id || '')"
                  :value="idx"
                  class="mt-1 h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 focus:ring-indigo-500"
                />
                <div class="min-w-0 flex-1">
                  <span class="text-sm text-gray-900 dark:text-white block">
                    {{ formatDescriptionVersionDate(ver.createdAt) }}
                  </span>
                  <span class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                    <span v-if="ver.isCurrent" class="font-medium text-gray-600 dark:text-gray-300">{{ t('records.genericCurrentVersion') }}</span>
                    <template v-else>
                      <Avatar
                        v-if="ver.createdBy"
                        :record="{ name: ver.createdBy }"
                        size="sm"
                        class="shrink-0"
                      />
                      {{ ver.createdBy || t('records.genericSomeone') }}
                    </template>
                  </span>
                </div>
              </label>
            </div>
            <p class="text-xs text-gray-400 dark:text-gray-500 px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
              {{ t('records.taskVersionRetentionNote') }}
            </p>
            <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
              <button
                type="button"
                :disabled="selectedDescriptionVersionIndex === 0 || descriptionRestoreLoading"
                class="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none"
                @click="restoreDescriptionVersion"
              >
                <span v-if="descriptionRestoreLoading">{{ t('records.genericRestoring') }}</span>
                <span v-else>{{ t('records.genericRestoreVersion') }}</span>
              </button>
            </div>
          </div>
        </div>
        <RichDescriptionImageLightbox
          :open="showImagePreview"
          :src="previewImageSrc"
          @close="closeImagePreview"
        />
      </div>

      <div v-if="embed && task && !expandedLeftSection" class="pt-0 flex-shrink-0" aria-hidden="true" />
      <!-- Editable Title Section -->
      <RecordPageTitleRow
        v-if="task && !expandedLeftSection"
        :sticky="isLeftTitleSticky"
        :embed="embed"
      >
        <Avatar :record="{ name: taskModuleLabel }" :icon="CheckCircleIcon" size="lg" class="shrink-0" />
        <div class="min-w-0 flex-1">
          <EditableTitle
            :title="task.title || ''"
            :can-edit="canEditTask"
            @save="handleTitleSave"
          />
        </div>
      </RecordPageTitleRow>

      <!-- RecordStateSection - Core properties in two-column layout -->
      <div
        v-if="task && (!expandedLeftSection || expandedLeftSection === 'key-fields')"
        :class="['group/left-section', expandedLeftSection ? 'mt-8' : 'mt-2 lg:mt-4']"
      >
        <RecordStateSection
          :heading="t('records.genericKeyFields')"
          :fields="keySectionFields"
          :field-values="keyFieldDisplayValues"
          :signals="computeSignals(task)"
          :next-action-hint="getNextActionHint(task)"
        >
        <!-- Editable Status slot - dropdown opens on click, value stays visible -->
        <template #status>
          <Listbox
            v-if="canEditTask"
            :model-value="task.status"
            @update:model-value="(v) => handleFieldSave('status', v)"
          >
            <div class="relative w-full">
              <ListboxButton
                :class="[
                  'inline-flex items-center rounded-md text-xs font-semibold transition-colors focus:outline-none focus:ring-0',
                  getStatusPillClass(task.status)
                ]"
                :style="getStatusPillStyle(task.status)"
              >
                <span class="truncate px-2.5 py-1">{{ formatStatus(task.status) }}</span>
                <span
                  :class="['inline-flex items-center justify-center px-2 py-1 border-l', getStatusPillDividerClass(task.status)]"
                  :style="getStatusPillDividerStyle(task.status)"
                >
                  <ChevronDownIcon class="h-4 w-4" />
                </span>
              </ListboxButton>
              <Transition
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
              >
                <ListboxOptions
                  class="absolute z-10 mt-1 max-h-60 w-full min-w-[140px] overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
                >
                  <ListboxOption
                    v-for="opt in statusSelectOptions"
                    :key="opt.value"
                    :value="opt.value"
                    v-slot="{ active, selected }"
                  >
                    <li :class="['relative cursor-default select-none py-2 pl-4 pr-10', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                      <span :class="['flex items-center gap-2 truncate', selected ? 'font-medium' : 'font-normal']">
                        <span
                          class="inline-block h-2.5 w-2.5 rounded-full border border-black/10 dark:border-white/20"
                          :style="opt.color ? { backgroundColor: opt.color } : null"
                        />
                        <span class="truncate">{{ opt.label }}</span>
                      </span>
                      <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400">
                        <CheckIcon class="h-5 w-5" aria-hidden="true" />
                      </span>
                    </li>
                  </ListboxOption>
                </ListboxOptions>
              </Transition>
            </div>
          </Listbox>
          <span
            v-else
            :class="[
              'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold cursor-default select-none bg-gray-50 dark:bg-gray-800/60',
              getStatusPillClass(task.status)
            ]"
            :style="getStatusPillStyle(task.status)"
          >
            {{ formatStatus(task.status) }}
          </span>
        </template>
        
        <!-- Editable Start Date slot -->
        <template #startDate>
          <div v-if="canEditTask" class="flex-1 min-w-0 w-full min-h-8 flex items-center">
            <div v-if="isEditingStartDate" class="w-full min-w-0" @click.stop>
              <DatePicker
                ref="startDateInputRef"
                v-model="localStartDate"
                :placeholder="keySectionFields.find((f) => f.key === 'startDate')?.label"
                input-class="text-xs h-8 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full cursor-pointer"
                @blur="handleStartDateBlur"
                @enter="handleStartDateBlur"
                @escape="handleStartDateCancel"
              />
            </div>
            <span
              v-else
              @click="startStartDateEdit"
              :class="[
                'block w-full min-h-8 text-sm cursor-text rounded px-2 transition-colors flex items-center',
                task.startDate ? 'text-gray-900 dark:text-white' : 'text-record-empty'
              ]"
            >
              {{ formatStateDate(task.startDate) || keyFieldsEmptyLabel }}
            </span>
          </div>
          <span
            v-else
            :class="[
              'block w-full min-h-8 text-sm rounded px-2 py-1 cursor-default select-none bg-gray-50 dark:bg-gray-800/60 flex items-center',
              task.startDate ? 'text-gray-900 dark:text-white' : 'text-record-empty'
            ]"
          >{{ formatStateDate(task.startDate) || keyFieldsEmptyLabel }}</span>
        </template>

        <!-- Editable Due Date slot -->
        <template #dueDate>
          <div v-if="canEditTask" class="flex-1 min-w-0 w-full min-h-8 flex items-center">
            <div v-if="isEditingDueDate" class="w-full min-w-0" @click.stop>
              <DatePicker
                ref="dueDateInputRef"
                v-model="localDueDate"
                :placeholder="keySectionFields.find((f) => f.key === 'dueDate')?.label"
                input-class="text-xs h-8 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full cursor-pointer"
                @blur="handleDueDateBlur"
                @enter="handleDueDateBlur"
                @escape="handleDueDateCancel"
              />
            </div>
            <span
              v-else
              @click="startDueDateEdit"
              :class="[
                'block w-full min-h-8 text-sm cursor-text rounded px-2 transition-colors flex items-center',
                task.dueDate ? 'text-gray-900 dark:text-white' : 'text-record-empty'
              ]"
            >
              {{ formatStateDate(task.dueDate) || keyFieldsEmptyLabel }}
            </span>
          </div>
          <span
            v-else
            :class="[
              'block w-full min-h-8 text-sm rounded px-2 py-1 cursor-default select-none bg-gray-50 dark:bg-gray-800/60 flex items-center',
              task.dueDate ? 'text-gray-900 dark:text-white' : 'text-record-empty'
            ]"
          >{{ formatStateDate(task.dueDate) || keyFieldsEmptyLabel }}</span>
        </template>
        
        <!-- Editable Time Estimate slot -->
        <template #timeEstimate>
          <div v-if="canEditTask" class="flex-1 min-w-0 w-full min-h-8 flex items-center" @click="onTimeEstimateCellClick">
            <input
              v-show="isEditingTimeEstimate"
              ref="timeEstimateInputRef"
              v-model.number="localTimeEstimate"
              type="number"
              min="0"
              step="0.5"
              @blur="handleTimeEstimateBlur"
              @keydown.enter="handleTimeEstimateBlur"
              @keydown.esc="handleTimeEstimateCancel"
              @click.stop
              class="text-sm h-8 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full min-w-0 flex-1"
            />
            <span
              v-show="!isEditingTimeEstimate"
              :class="[
                'block w-full min-h-8 text-sm cursor-text rounded px-2 transition-colors flex items-center',
                task.estimatedHours ? 'text-gray-900 dark:text-white' : 'text-record-empty'
              ]"
            >
              {{ task.estimatedHours ? `${task.estimatedHours}h` : keyFieldsEmptyLabel }}
            </span>
          </div>
          <span
            v-else
            :class="[
              'block w-full min-h-8 text-sm rounded px-2 py-1 cursor-default select-none bg-gray-50 dark:bg-gray-800/60 flex items-center',
              task.estimatedHours ? 'text-gray-900 dark:text-white' : 'text-record-empty'
            ]"
          >{{ task.estimatedHours ? `${task.estimatedHours}h` : keyFieldsEmptyLabel }}</span>
        </template>
        
        <!-- Editable owner slot - dropdown opens on click, value stays visible -->
        <template #owner>
          <Listbox
            v-if="canEditTask"
            :model-value="task.assignedTo ? (typeof task.assignedTo === 'object' ? task.assignedTo._id : task.assignedTo) : null"
            @update:model-value="(v) => handleFieldSave('assignedTo', v)"
          >
            <div class="relative w-full">
              <ListboxButton
                class="flex items-center gap-2 w-full min-h-8 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 py-1 -mx-2 -my-1 transition-colors focus:outline-none focus:ring-0"
              >
                <Avatar
                  v-if="task.assignedTo && typeof task.assignedTo === 'object'"
                  :user="{
                    firstName: task.assignedTo.firstName || task.assignedTo.first_name,
                    lastName: task.assignedTo.lastName || task.assignedTo.last_name,
                    email: task.assignedTo.email,
                    avatar: task.assignedTo.avatar
                  }"
                  size="sm"
                />
                <span
                  :class="[
                    'text-sm flex-1 truncate',
                    task.assignedTo ? 'text-gray-900 dark:text-white' : 'text-record-empty'
                  ]"
                >
                  {{ task.assignedTo ? getUserDisplayName(task.assignedTo) : keyFieldsEmptyLabel }}
                </span>
              </ListboxButton>
              <Transition
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
              >
                <ListboxOptions
                  class="absolute z-10 mt-1 max-h-60 w-full min-w-[160px] overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
                >
                  <ListboxOption :value="null" v-slot="{ active }">
                    <li :class="['relative cursor-default select-none py-2 pl-4 pr-10 flex items-center gap-2', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                      <span class="block truncate">{{ t('records.editableUnassigned') }}</span>
                    </li>
                  </ListboxOption>
                  <ListboxOption
                    v-for="user in users"
                    :key="user._id"
                    :value="user._id"
                    v-slot="{ active, selected }"
                  >
                    <li :class="['relative cursor-default select-none py-2 pl-4 pr-10 flex items-center gap-2', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                      <Avatar :user="user" size="sm" />
                      <span :class="['block truncate flex-1', selected ? 'font-medium' : 'font-normal']">{{ getUserDisplayName(user) }}</span>
                      <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400">
                        <CheckIcon class="h-5 w-5" aria-hidden="true" />
                      </span>
                    </li>
                  </ListboxOption>
                </ListboxOptions>
              </Transition>
            </div>
          </Listbox>
          <div v-else class="flex items-center gap-2 min-h-8 rounded px-2 py-1 cursor-default select-none bg-gray-50 dark:bg-gray-800/60">
            <Avatar
              v-if="task.assignedTo && typeof task.assignedTo === 'object'"
              :user="{
                firstName: task.assignedTo.firstName || task.assignedTo.first_name,
                lastName: task.assignedTo.lastName || task.assignedTo.last_name,
                email: task.assignedTo.email,
                avatar: task.assignedTo.avatar
              }"
              size="sm"
            />
            <span
              :class="[
                'text-sm',
                task.assignedTo ? 'text-gray-900 dark:text-white' : 'text-record-empty'
              ]"
            >
              {{ task.assignedTo ? getUserDisplayName(task.assignedTo) : keyFieldsEmptyLabel }}
            </span>
          </div>
        </template>
        
        <!-- Editable Priority slot - dropdown opens on click, value stays visible -->
        <template #priority>
          <Listbox
            v-if="canEditTask"
            :model-value="task.priority"
            @update:model-value="(v) => handleFieldSave('priority', v)"
          >
            <div class="relative w-full">
              <ListboxButton
                :class="[
                  'inline-flex items-center gap-2 rounded px-2 py-1 min-h-8 text-sm transition-colors w-full text-left focus:outline-none focus:ring-0 hover:bg-gray-50 dark:hover:bg-gray-800',
                  getPriorityTextClass(task.priority)
                ]"
              >
                <FlagIconSolid
                  v-if="task.priority"
                  class="h-4 w-4 shrink-0"
                  :style="getPriorityFlagStyle(task.priority)"
                />
                <span class="block truncate">{{ formatPriority(task.priority) || keyFieldsEmptyLabel }}</span>
              </ListboxButton>
              <Transition
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
              >
                <ListboxOptions
                  class="absolute z-10 mt-1 max-h-60 w-full min-w-[140px] overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
                >
                  <ListboxOption :value="null" v-slot="{ active }">
                    <li :class="['relative cursor-default select-none py-2 pl-4 pr-10', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                      <span class="block truncate">{{ keyFieldsEmptyLabel }}</span>
                    </li>
                  </ListboxOption>
                  <ListboxOption
                    v-for="opt in prioritySelectOptions"
                    :key="opt.value"
                    :value="opt.value"
                    v-slot="{ active, selected }"
                  >
                    <li :class="['relative cursor-default select-none py-2 pl-4 pr-10', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                      <span :class="['flex items-center gap-2 truncate', selected ? 'font-medium' : 'font-normal']">
                        <FlagIconSolid
                          class="h-4 w-4 shrink-0"
                          :style="getPriorityFlagStyle(opt.value)"
                        />
                        <span class="truncate">{{ opt.label }}</span>
                      </span>
                      <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400">
                        <CheckIcon class="h-5 w-5" aria-hidden="true" />
                      </span>
                    </li>
                  </ListboxOption>
                </ListboxOptions>
              </Transition>
            </div>
          </Listbox>
          <span
            v-else
            :class="[
              'inline-flex items-center gap-2 min-h-8 text-sm rounded px-2 py-1 cursor-default select-none bg-gray-50 dark:bg-gray-800/60',
              getPriorityTextClass(task.priority)
            ]"
          >
            <FlagIconSolid
              v-if="task.priority"
              class="h-4 w-4 shrink-0"
              :style="getPriorityFlagStyle(task.priority)"
            />
            {{ formatPriority(task.priority) }}
          </span>
        </template>

        <!-- Editable Tags slot: click value text → open record; click elsewhere → inline edit. Hover over value container → primary color -->
        <template #relatedTo>
          <button
            v-if="canEditTask"
            type="button"
            @click="openRelatedToPopover($event, 'relatedTo', task)"
            class="w-full min-w-0 min-h-8 flex items-center text-sm text-left text-gray-900 dark:text-white rounded px-2 py-1 -mx-2 -my-1 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <span
              v-if="getRelatedToDisplay(task) && getRelatedToRecordPath(task)"
              class="min-w-0 flex-1 truncate transition-colors hover:text-primary-600 dark:hover:text-primary-400"
            >
              <span
                role="button"
                tabindex="0"
                class="inline cursor-pointer"
                @click.stop="openRelatedToRecord"
              >
                {{ getRelatedToDisplay(task) }}
              </span>
            </span>
            <span v-else-if="getRelatedToDisplay(task)" class="min-w-0 flex-1 truncate">{{ getRelatedToDisplay(task) }}</span>
            <span v-else class="min-w-0 flex-1 text-record-empty">{{ t('records.detailsLinkRecord') }}</span>
          </button>

          <div v-else class="w-full min-w-0 min-h-8 text-sm text-gray-900 dark:text-white rounded px-2 py-1 cursor-default select-none bg-gray-50 dark:bg-gray-800/60 flex items-center">
            <span
              v-if="getRelatedToDisplay(task) && getRelatedToRecordPath(task)"
              class="min-w-0 flex-1 truncate transition-colors hover:text-primary-600 dark:hover:text-primary-400"
            >
              <span
                role="button"
                tabindex="0"
                class="inline cursor-pointer"
                @click="openRelatedToRecord"
              >
                {{ getRelatedToDisplay(task) }}
              </span>
            </span>
            <span v-else-if="getRelatedToDisplay(task)" class="truncate">{{ getRelatedToDisplay(task) }}</span>
            <span v-else class="text-record-empty">{{ keyFieldsEmptyLabel }}</span>
          </div>
        </template>

        <template #tags>
          <button
            v-if="canEditTask"
            ref="tagFieldButtonRef"
            type="button"
            @click="openTagPopoverFromField($event)"
            class="w-full min-w-0 min-h-8 flex items-center text-sm text-left text-gray-900 dark:text-white rounded px-2 py-1 -mx-2 -my-1 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <div v-if="detailTagChips.length > 0" class="flex flex-wrap gap-1.5 text-left">
              <span
                v-for="item in detailTagChips"
                :key="item.key"
                :class="['inline-block text-xs px-2 py-0.5 rounded', item.chipClass]"
              >
                {{ item.label }}
              </span>
            </div>
            <span v-else class="text-record-empty">{{ t('records.tagsSearchPh') }}</span>
          </button>

          <div v-else class="w-full min-w-0 min-h-8 text-sm text-gray-900 dark:text-white rounded px-2 py-1 cursor-default select-none bg-gray-50 dark:bg-gray-800/60 flex items-center">
            <div v-if="detailTagChips.length > 0" class="flex flex-wrap gap-1.5 text-left">
              <span
                v-for="item in detailTagChips"
                :key="item.key"
                :class="['inline-block text-xs px-2 py-0.5 rounded', item.chipClass]"
              >
                {{ item.label }}
              </span>
            </div>
            <span v-else class="text-record-empty">{{ keyFieldsEmptyLabel }}</span>
          </div>
        </template>
        </RecordStateSection>
      </div>

      <section
        v-if="task && shouldRenderTaskSectionStack"
        :class="[expandedLeftSection ? 'mt-8' : 'mt-4']"
      >
        <SectionStack
          :sections="taskSectionStackSections"
          :record="task"
          :adapter="taskSectionStackAdapter"
          :context="taskSectionStackContext"
        />
      </section>
    </template>

    <template #right>
      <RecordRightPane
        v-if="task && !expandedLeftSection"
        ref="rightPaneRef"
        :tabs="rightPaneTabs"
        :default-tab="recordLayoutIsMobile ? undefined : 'activity'"
        :show-header="embed"
        :show-close-button="embed"
        :title="embed ? taskModuleLabel : ''"
        :persistence-key="`task-${task._id}`"
        :record-id="task._id"
        @close="handleEmbedClose"
      >
        <!-- Quick preview: Prev/Next in header (left of "Task") -->
        <template v-if="embed && quickPreviewNav" #header-prefix>
          <div class="flex items-center gap-1 mr-2">
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 transition-colors dark:border-gray-700 dark:text-gray-400 shrink-0"
              :class="quickPreviewNav.canPrevious ? 'hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200' : 'opacity-40 cursor-not-allowed'"
              :disabled="!quickPreviewNav.canPrevious"
              :aria-label="taskNavPreviousLabel"
              :title="taskNavPreviousLabel"
              @click="quickPreviewNav.onPrev()"
            >
              <ArrowLeftIcon class="h-4 w-4" />
            </button>
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 transition-colors dark:border-gray-700 dark:text-gray-400 shrink-0"
              :class="quickPreviewNav.canNext ? 'hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200' : 'opacity-40 cursor-not-allowed'"
              :disabled="!quickPreviewNav.canNext"
              :aria-label="taskNavNextLabel"
              :title="taskNavNextLabel"
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
            @click="openTaskInNewTab"
          >
            <ArrowTopRightOnSquareIcon class="w-5 h-5" />
          </button>
          <button
            type="button"
            @click="showEditDrawer = true"
            class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            :aria-label="t('records.taskEditAria')"
            :title="t('records.taskEditAria')"
          >
            <PencilSquareIcon class="w-5 h-5" />
          </button>
          <button
            type="button"
            ref="tagHeaderButtonRef"
            @click="handleTagIconClick($event)"
            :class="[
              'relative inline-flex items-center justify-center p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
              hasTaskTags
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            ]"
            :aria-label="t('records.genericTagsAria')"
            :title="t('records.genericTagsAria')"
          >
            <TagIcon class="block w-5 h-5" />
            <span
              v-if="hasTaskTags"
              class="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-indigo-600 dark:text-indigo-400"
            ></span>
          </button>
          <button
            type="button"
            @click="copyTaskUrl"
            class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            :aria-label="t('records.genericCopyUrl')"
            :title="t('records.genericCopyUrl')"
          >
            <ClipboardDocumentIcon class="w-5 h-5" />
          </button>
          <button
            type="button"
            @click="handleToggleFollow"
            :class="[
              'p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
              isFollowing ? 'text-yellow-500 dark:text-yellow-400' : ''
            ]"
            :aria-label="taskStarAriaLabel"
            :title="taskStarAriaLabel"
          >
            <StarIcon v-if="!isFollowing" class="w-5 h-5" />
            <StarIconSolid v-else class="w-5 h-5" />
          </button>
          <Menu as="div" class="relative">
            <MenuButton
              class="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('records.genericMoreActions')"
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
                <MenuItem v-slot="{ active }">
                  <button
                    @click="handleDuplicate"
                    :class="[
                      'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                      active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                    ]"
                  >
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
                    @click="handleExport"
                    :class="[
                      'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                      active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                    ]"
                  >
                    <span>{{ t('actions.export') }}</span>
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button
                    @click="showEmailModal = true"
                    :class="[
                      'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                      active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                    ]"
                  >
                    <EnvelopeIcon class="w-4 h-4" />
                    <span>{{ t('records.taskEmailAssignee') }}</span>
                  </button>
                </MenuItem>
                <hr class="my-1 border-gray-200 dark:border-gray-700" />
                <MenuItem v-slot="{ active }">
                  <button
                    @click="handleDelete"
                    :class="[
                      'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                      active ? 'bg-gray-100 dark:bg-gray-700' : 'text-red-600 dark:text-red-400'
                    ]"
                  >
                    <span>{{ t('actions.delete') }}</span>
                  </button>
                </MenuItem>
              </MenuItems>
            </transition>
          </Menu>
        </template>
        <!-- Activity Tab (Combined Comments + Timeline) -->
        <template #tab-activity>
          <ActivitySection
            ref="activitySectionRef"
            :events="activityTimelineEvents"
            :ui="taskActivityUi"
            :is-thread-view-active="isThreadViewActive"
            :active-thread-root-comment="activeThreadRootComment"
            :thread-reply-count="threadReplyCount"
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
            :notification-count="task?.notificationCount || 0"
            :show-notifications="true"
            :on-timeline-ref="setActivityTimelineRef"
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
        <template #tab-related>
          <div class="flex flex-col h-full">
            <!-- Related Records header with Link action -->
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
            <!-- Related Records content -->
            <div class="flex-1 min-h-0 overflow-y-auto p-4">
              <!-- Empty state when no related records -->
              <div
                v-if="!hasRelatedRecords"
                class="flex flex-col items-center justify-center py-12 text-center"
              >
                <div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                  <LinkIcon class="w-6 h-6 text-gray-400 dark:text-gray-500" />
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">{{ t('records.relatedEmpty') }}</p>
                <p class="text-xs text-gray-400 dark:text-gray-500">
                  {{ t('records.relatedEmptyHint') }}
                </p>
              </div>
              <!-- Related records list (flat groups, no nested accordion) -->
              <div v-else class="space-y-5">
                <details
                  v-if="task.projectId"
                  class="group/right-related-module"
                  :open="rightRelatedModuleOpen.project"
                  @toggle="(event) => handleRightRelatedModuleToggle('project', event)"
                >
                  <summary class="flex cursor-pointer list-none items-center rounded-lg px-1 py-1 hover:bg-gray-50 dark:hover:bg-gray-800/60 [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
                    <div class="flex items-center gap-2">
                      <ChevronRightIcon :class="['h-4 w-4 shrink-0 text-gray-400 transition-transform duration-150', rightRelatedModuleOpen.project ? 'rotate-90' : '']" />
                      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('records.taskRelatedGroupProject') }}</h3>
                      <span class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">1</span>
                    </div>
                  </summary>
                  <div class="mt-2 space-y-2">
                    <div
                      class="group/right-related-card flex items-start justify-between gap-3 rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-800/60 px-3 py-2.5 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20 transition-colors"
                    >
                      <button
                        type="button"
                        @click="handleOpenRelated('project', getRelatedRecordId(typeof task.projectId === 'object' ? task.projectId : { _id: task.projectId }))"
                        class="min-w-0 flex-1 text-left"
                      >
                        <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {{ getRelatedRecordTitle('project', typeof task.projectId === 'object' ? task.projectId : { _id: task.projectId }) }}
                        </p>
                        <p
                          v-if="getRelatedRecordMeta('project', typeof task.projectId === 'object' ? task.projectId : { _id: task.projectId })"
                          class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate"
                        >
                          {{ getRelatedRecordMeta('project', typeof task.projectId === 'object' ? task.projectId : { _id: task.projectId }) }}
                        </p>
                      </button>
                      <div class="flex items-center gap-1.5 shrink-0">
                        <Menu v-if="canLinkRecords" as="div" class="relative">
                          <MenuButton
                            class="inline-flex items-center justify-center rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 opacity-0 transition-opacity duration-150 group-hover/right-related-card:opacity-100 focus:opacity-100"
                            :aria-label="t('records.relatedActionsAria')"
                            @click.stop
                          >
                            <EllipsisVerticalIcon class="h-4 w-4" />
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
                              class="absolute right-0 top-full z-20 mt-1 w-32 rounded-lg bg-white py-1 shadow-xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10"
                            >
                              <MenuItem v-slot="{ active }">
                                <button
                                  type="button"
                                  @click.stop="handleUnlinkRelated('project', typeof task.projectId === 'object' ? task.projectId : { _id: task.projectId })"
                                  :class="[
                                    'w-full px-3 py-2 text-left text-sm transition-colors duration-150',
                                    active ? 'bg-gray-100 dark:bg-gray-700 text-red-600 dark:text-red-400' : 'text-red-600 dark:text-red-400'
                                  ]"
                                >
                                  {{ t('records.relatedUnlink') }}
                                </button>
                              </MenuItem>
                            </MenuItems>
                          </transition>
                        </Menu>
                      </div>
                    </div>
                  </div>
                </details>

                <details
                  v-if="taskPeople && taskPeople.length > 0"
                  class="group/right-related-module"
                  :open="rightRelatedModuleOpen.people"
                  @toggle="(event) => handleRightRelatedModuleToggle('people', event)"
                >
                  <summary class="flex cursor-pointer list-none items-center rounded-lg px-1 py-1 hover:bg-gray-50 dark:hover:bg-gray-800/60 [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
                    <div class="flex items-center gap-2">
                      <ChevronRightIcon :class="['h-4 w-4 shrink-0 text-gray-400 transition-transform duration-150', rightRelatedModuleOpen.people ? 'rotate-90' : '']" />
                      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('records.taskRelatedGroupPeople') }}</h3>
                      <span class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">{{ taskPeople.length }}</span>
                    </div>
                  </summary>
                  <div class="mt-2 space-y-2">
                    <div
                      v-for="person in (taskPeople || []).slice(0, 10)"
                      :key="person._id"
                      class="group/right-related-card flex items-start justify-between gap-3 rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-800/60 px-3 py-2.5 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20 transition-colors"
                    >
                      <button
                        type="button"
                        @click="handleOpenRelated('people', person._id)"
                        class="min-w-0 flex-1 text-left"
                      >
                        <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {{ getRelatedRecordTitle('people', person) }}
                        </p>
                        <p v-if="getRelatedRecordMeta('people', person)" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                          {{ getRelatedRecordMeta('people', person) }}
                        </p>
                      </button>
                      <div class="flex items-center gap-1.5 shrink-0">
                        <Menu v-if="canLinkRecords" as="div" class="relative">
                          <MenuButton
                            class="inline-flex items-center justify-center rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 opacity-0 transition-opacity duration-150 group-hover/right-related-card:opacity-100 focus:opacity-100"
                            :aria-label="t('records.relatedActionsAria')"
                            @click.stop
                          >
                            <EllipsisVerticalIcon class="h-4 w-4" />
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
                              class="absolute right-0 top-full z-20 mt-1 w-32 rounded-lg bg-white py-1 shadow-xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10"
                            >
                              <MenuItem v-slot="{ active }">
                                <button
                                  type="button"
                                  @click.stop="handleUnlinkRelated('people', person)"
                                  :class="[
                                    'w-full px-3 py-2 text-left text-sm transition-colors duration-150',
                                    active ? 'bg-gray-100 dark:bg-gray-700 text-red-600 dark:text-red-400' : 'text-red-600 dark:text-red-400'
                                  ]"
                                >
                                  {{ t('records.relatedUnlink') }}
                                </button>
                              </MenuItem>
                            </MenuItems>
                          </transition>
                        </Menu>
                      </div>
                    </div>
                  </div>
                </details>

                <details
                  v-if="taskEvents && taskEvents.length > 0"
                  class="group/right-related-module"
                  :open="rightRelatedModuleOpen.events"
                  @toggle="(event) => handleRightRelatedModuleToggle('events', event)"
                >
                  <summary class="flex cursor-pointer list-none items-center rounded-lg px-1 py-1 hover:bg-gray-50 dark:hover:bg-gray-800/60 [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
                    <div class="flex items-center gap-2">
                      <ChevronRightIcon :class="['h-4 w-4 shrink-0 text-gray-400 transition-transform duration-150', rightRelatedModuleOpen.events ? 'rotate-90' : '']" />
                      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('records.taskRelatedGroupEvents') }}</h3>
                      <span class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">{{ taskEvents.length }}</span>
                    </div>
                  </summary>
                  <div class="mt-2 space-y-2">
                    <div
                      v-for="event in (taskEvents || []).slice(0, 10)"
                      :key="event._id"
                      class="group/right-related-card flex items-start justify-between gap-3 rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-800/60 px-3 py-2.5 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20 transition-colors"
                    >
                      <button
                        type="button"
                        @click="handleOpenRelated('event', event._id)"
                        class="min-w-0 flex-1 text-left"
                      >
                        <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {{ getRelatedRecordTitle('event', event) }}
                        </p>
                        <p v-if="getRelatedRecordMeta('event', event)" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                          {{ getRelatedRecordMeta('event', event) }}
                        </p>
                      </button>
                      <div class="flex items-center gap-1.5 shrink-0">
                        <Menu v-if="canLinkRecords" as="div" class="relative">
                          <MenuButton
                            class="inline-flex items-center justify-center rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 opacity-0 transition-opacity duration-150 group-hover/right-related-card:opacity-100 focus:opacity-100"
                            :aria-label="t('records.relatedActionsAria')"
                            @click.stop
                          >
                            <EllipsisVerticalIcon class="h-4 w-4" />
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
                              class="absolute right-0 top-full z-20 mt-1 w-32 rounded-lg bg-white py-1 shadow-xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10"
                            >
                              <MenuItem v-slot="{ active }">
                                <button
                                  type="button"
                                  @click.stop="handleUnlinkRelated('event', event)"
                                  :class="[
                                    'w-full px-3 py-2 text-left text-sm transition-colors duration-150',
                                    active ? 'bg-gray-100 dark:bg-gray-700 text-red-600 dark:text-red-400' : 'text-red-600 dark:text-red-400'
                                  ]"
                                >
                                  {{ t('records.relatedUnlink') }}
                                </button>
                              </MenuItem>
                            </MenuItems>
                          </transition>
                        </Menu>
                      </div>
                    </div>
                  </div>
                </details>

                <details
                  v-if="taskDeals && taskDeals.length > 0"
                  class="group/right-related-module"
                  :open="rightRelatedModuleOpen.deals"
                  @toggle="(event) => handleRightRelatedModuleToggle('deals', event)"
                >
                  <summary class="flex cursor-pointer list-none items-center rounded-lg px-1 py-1 hover:bg-gray-50 dark:hover:bg-gray-800/60 [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
                    <div class="flex items-center gap-2">
                      <ChevronRightIcon :class="['h-4 w-4 shrink-0 text-gray-400 transition-transform duration-150', rightRelatedModuleOpen.deals ? 'rotate-90' : '']" />
                      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('records.taskRelatedGroupDeals') }}</h3>
                      <span class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">{{ taskDeals.length }}</span>
                    </div>
                  </summary>
                  <div class="mt-2 space-y-2">
                    <div
                      v-for="deal in (taskDeals || []).slice(0, 10)"
                      :key="deal._id"
                      class="group/right-related-card flex items-start justify-between gap-3 rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-800/60 px-3 py-2.5 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20 transition-colors"
                    >
                      <button
                        type="button"
                        @click="handleOpenRelated('deal', deal._id)"
                        class="min-w-0 flex-1 text-left"
                      >
                        <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {{ getRelatedRecordTitle('deal', deal) }}
                        </p>
                        <p v-if="getRelatedRecordMeta('deal', deal)" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                          {{ getRelatedRecordMeta('deal', deal) }}
                        </p>
                      </button>
                      <div class="flex items-center gap-1.5 shrink-0">
                        <Menu v-if="canLinkRecords" as="div" class="relative">
                          <MenuButton
                            class="inline-flex items-center justify-center rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 opacity-0 transition-opacity duration-150 group-hover/right-related-card:opacity-100 focus:opacity-100"
                            :aria-label="t('records.relatedActionsAria')"
                            @click.stop
                          >
                            <EllipsisVerticalIcon class="h-4 w-4" />
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
                              class="absolute right-0 top-full z-20 mt-1 w-32 rounded-lg bg-white py-1 shadow-xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10"
                            >
                              <MenuItem v-slot="{ active }">
                                <button
                                  type="button"
                                  @click.stop="handleUnlinkRelated('deal', deal)"
                                  :class="[
                                    'w-full px-3 py-2 text-left text-sm transition-colors duration-150',
                                    active ? 'bg-gray-100 dark:bg-gray-700 text-red-600 dark:text-red-400' : 'text-red-600 dark:text-red-400'
                                  ]"
                                >
                                  {{ t('records.relatedUnlink') }}
                                </button>
                              </MenuItem>
                            </MenuItems>
                          </transition>
                        </Menu>
                      </div>
                    </div>
                  </div>
                </details>

                <details
                  v-if="taskForms && taskForms.length > 0"
                  class="group/right-related-module"
                  :open="rightRelatedModuleOpen.forms"
                  @toggle="(event) => handleRightRelatedModuleToggle('forms', event)"
                >
                  <summary class="flex cursor-pointer list-none items-center rounded-lg px-1 py-1 hover:bg-gray-50 dark:hover:bg-gray-800/60 [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
                    <div class="flex items-center gap-2">
                      <ChevronRightIcon :class="['h-4 w-4 shrink-0 text-gray-400 transition-transform duration-150', rightRelatedModuleOpen.forms ? 'rotate-90' : '']" />
                      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('records.taskRelatedGroupForms') }}</h3>
                      <span class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">{{ taskForms.length }}</span>
                    </div>
                  </summary>
                  <div class="mt-2 space-y-2">
                    <div
                      v-for="form in (taskForms || []).slice(0, 10)"
                      :key="form._id"
                      class="group/right-related-card flex items-start justify-between gap-3 rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-800/60 px-3 py-2.5 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20 transition-colors"
                    >
                      <button
                        type="button"
                        @click="handleOpenRelated('form', form._id)"
                        class="min-w-0 flex-1 text-left"
                      >
                        <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {{ getRelatedRecordTitle('form', form) }}
                        </p>
                        <p v-if="getRelatedRecordMeta('form', form)" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                          {{ getRelatedRecordMeta('form', form) }}
                        </p>
                      </button>
                      <div class="flex items-center gap-1.5 shrink-0">
                        <Menu v-if="canLinkRecords" as="div" class="relative">
                          <MenuButton
                            class="inline-flex items-center justify-center rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 opacity-0 transition-opacity duration-150 group-hover/right-related-card:opacity-100 focus:opacity-100"
                            :aria-label="t('records.relatedActionsAria')"
                            @click.stop
                          >
                            <EllipsisVerticalIcon class="h-4 w-4" />
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
                              class="absolute right-0 top-full z-20 mt-1 w-32 rounded-lg bg-white py-1 shadow-xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10"
                            >
                              <MenuItem v-slot="{ active }">
                                <button
                                  type="button"
                                  @click.stop="handleUnlinkRelated('form', form)"
                                  :class="[
                                    'w-full px-3 py-2 text-left text-sm transition-colors duration-150',
                                    active ? 'bg-gray-100 dark:bg-gray-700 text-red-600 dark:text-red-400' : 'text-red-600 dark:text-red-400'
                                  ]"
                                >
                                  {{ t('records.relatedUnlink') }}
                                </button>
                              </MenuItem>
                            </MenuItems>
                          </transition>
                        </Menu>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </template>
        <template v-if="showRecordDocumentsTab" #tab-documents>
          <div class="flex h-full flex-col">
            <div class="record-context-panel__header flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.genericTabDocuments') }}</h2>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto p-4">
              <RecordDocumentsPanel
                v-if="task?._id"
                module-key="tasks"
                :record-id="String(task._id)"
                app-key="PLATFORM"
                :can-create="canCreateDocuments"
                :can-edit="canEditDocuments"
              />
            </div>
          </div>
        </template>
        <template #tab-details>
          <RecordDetailsTabPanel
            :record="task"
            :adapter="taskDetailsPaneAdapter"
            :context="taskDetailsPaneContext"
          />
        </template>
        <template #tab-integrations>
          <div class="flex flex-col h-full">
            <!-- Integrations header -->
            <div class="record-context-panel__header flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-900">
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.genericIntegrations') }}</h2>
            </div>
            <!-- Integrations content -->
            <div class="flex-1 min-h-0 overflow-y-auto p-4">
              <div class="text-sm text-gray-600 dark:text-gray-400 italic">{{ t('records.genericNoIntegrations') }}</div>
            </div>
          </div>
        </template>
      </RecordRightPane>
    </template>
  </RecordPageShell>
  <Teleport to="body">
    <div
      v-if="showCommentReactionPicker"
      ref="commentReactionPickerRef"
      :class="['fixed', FLOATING_OVERLAY_Z_CLASS, 'overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800']"
      :style="commentReactionPickerStyle"
    >
      <emoji-picker
        :class="['comment-reaction-emoji-picker', isDarkTheme ? 'dark' : 'light']"
        :theme="emojiPickerTheme"
        :style="{ colorScheme: emojiPickerColorScheme }"
        @emoji-click="handleCommentReactionEmojiClick"
      ></emoji-picker>
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
  
  <!-- Link Record Drawer (right side, same pattern as Link Organization) -->
  <LinkRecordsDrawer
    :isOpen="showLinkRecordDrawer"
    :module-key="''"
    source-app-key="platform"
    source-module-key="tasks"
    :multiple="true"
    :allow-create="allowCreateFromLinkDrawer"
    :create-and-link="allowCreateFromLinkDrawer"
    :title="linkRecordDrawerTitle"
    :context="linkRecordDrawerContext"
    :preselected-ids="linkedRecordIds"
    @close="closeLinkRecordDrawer"
    @linked="handleLinkRecordDrawerLinked"
    @create="handleLinkRecordDrawerCreate"
  />
  <CreateRecordDrawer
    v-if="showAddRelatedRecordDrawer && addRelatedRecordModuleKey"
    :isOpen="showAddRelatedRecordDrawer"
    :moduleKey="addRelatedRecordModuleKey"
    @close="closeAddRelatedRecordDrawer"
    @saved="handleAddRelatedRecordSaved"
  />

  <Teleport to="body">
    <div
      v-if="showTagPopover"
      ref="tagPopoverRef"
      :style="tagPopoverStyle"
      :class="['fixed', FLOATING_OVERLAY_Z_CLASS, 'w-[360px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl']"
    >
      <RecordTagPopover
        :record="task"
        :tag-storage-key="tagStorageKey"
        :can-edit="canEditTask"
        :persist-tags="persistRecordTagsForTask"
        instance-tag-source="tasks"
        :fetch-record="fetchTask"
        :open="showTagPopover"
      />
    </div>
  </Teleport>

  <!-- Related To field popover (details section inline edit) -->
  <Teleport to="body">
    <div
      v-if="showRelatedToPopover"
      ref="relatedToPopoverRef"
      :style="relatedToPopoverStyle"
      :class="['fixed', FLOATING_OVERLAY_Z_CLASS, 'w-[min(440px,calc(100vw-24px))] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl']"
    >
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('common.taskRelatedToFallback') }}</h3>
        <button
          type="button"
          class="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          :aria-label="t('actions.close')"
          @click="closeRelatedToPopover"
        >
          <XMarkIcon class="w-5 h-5" />
        </button>
      </div>
      <div class="p-4">
        <TaskRelatedToField
          :model-value="relatedToPopoverValue"
          label=""
          :required="false"
          :error="relatedToPopoverError"
          @update:model-value="relatedToPopoverValue = $event"
        />
        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
            @click="closeRelatedToPopover"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="relatedToSaving || !hasRelatedToPopoverChanges"
            @click="saveRelatedToFromPopover"
          >
            {{ relatedToSaving ? t('states.saving') : t('actions.save') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Edit task drawer (quick + full mode) -->
  <CreateRecordDrawer
    v-if="task"
    :isOpen="showEditDrawer"
    moduleKey="tasks"
    :record="task"
    @close="showEditDrawer = false"
    @saved="handleTaskEditSaved"
  />
  <CreateRecordDrawer
    v-if="showDuplicateCreateModal"
    :key="`duplicate-task-${duplicateSourceId}`"
    :isOpen="showDuplicateCreateModal"
    moduleKey="tasks"
    :duplicate-mode="true"
    :initial-data="duplicateInitialData"
    @close="closeDuplicateCreate"
    @saved="closeDuplicateCreate"
  />

  <!-- Email Compose Drawer -->
  <EmailComposeDrawer
    v-if="task"
    :is-open="showEmailModal"
    :related-to="{ moduleKey: 'tasks', recordId: String(task._id) }"
    :initial-to="assigneeEmail || ''"
    :initial-draft="emailComposeDraft"
    @close="showEmailModal = false; emailComposeDraft = null"
    @submit="handleEmailSubmit"
  />

  <!-- Delete Confirmation Modal -->
  <DeleteConfirmationModal
    :show="showDeleteModal"
    :record-name="task?.title || ''"
    record-type="tasks"
    :deleting="deleting"
    @close="showDeleteModal = false"
    @confirm="confirmDeleteTask"
  />

  <Teleport to="body">
    <div v-if="showTimestampSheet" class="fixed inset-0 z-[140]">
      <button
        type="button"
        class="absolute inset-0 bg-black/40"
        :aria-label="t('records.taskCloseTimestampDetails')"
        @click="closeTimestampSheet"
      ></button>
      <section class="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 pt-3 pb-5 shadow-2xl">
        <div class="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600" aria-hidden="true"></div>
        <p class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{{ timestampSheetValue }}</p>
        <button
          type="button"
          class="mt-4 w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          @click="closeTimestampSheet"
        >
          {{ t('actions.close') }}
        </button>
      </section>
    </div>
  </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { resolveFieldLabel } from '@/utils/fieldLabelResolver';
import { useRoute, useRouter } from 'vue-router';
import { Menu, MenuButton, MenuItem, MenuItems, Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue';
import {
  RecordPageShell,
  RecordHeader,
  RecordStateSection,
  RecordFieldsSection,
  RecordRightPane,
  EditableLabeledValue,
  RecordTagPopover
} from '@/components/record-page';
import RecordPrintButton from '@/components/record-page/RecordPrintButton.vue';
import SectionStack from '@/components/record-page/sections/SectionStack.vue';
import { useRecordTagPopoverPosition } from '@/components/record-page/composables/useRecordTagPopoverPosition';
import { useRecordTags } from '@/components/record-page/composables/useRecordTags';
import ActivitySection from '@/components/activity/ActivitySection.vue';
import { createActivityTimelineRefSetter } from '@/components/activity/useRecordActivityAdapter';
import { createTaskActivityUi } from '@/components/activity/adapters/taskActivityUiAdapter';
import { useCommentReactionPicker } from '@/components/activity/composables/useCommentReactionPicker';
import { useCommentReactionTooltip } from '@/components/activity/composables/useCommentReactionTooltip';
import { useCommentReactionActions } from '@/components/activity/composables/useCommentReactionActions';
import { createCommentReactionApi } from '@/components/activity/utils/commentReactionApi';
import {
  buildCommentReactions,
  isCommentReactionSelectedForUser,
  normalizeMyReactions,
  normalizeReactionEmoji
} from '@/components/activity/utils/commentReactionModel';
import { useTaskSections } from '@/components/record-page/composables/useTaskSections';
import { createRecordSectionLabels } from '@/utils/recordSectionLabels';
import { useTaskSectionDataProviders } from '@/components/record-page/composables/useTaskSectionDataProviders';
import { createGenericRecordAdapter } from '@/components/record-page/adapters/genericRecordAdapter';
import { picklistChipStyle } from '@/utils/picklistColorPalette';
import RecordDetailsTabPanel from '@/components/record-page/RecordDetailsTabPanel.vue';
import { resolveFieldContext } from '@/utils/fieldContextFilter';
import { useRecordLoading } from '@/components/record-page/composables/useRecordLoading';
import { useRecordHeaderActions } from '@/components/record-page/composables/useRecordHeaderActions';
import { useRecordModuleBack } from '@/components/record-page/composables/useRecordModuleBack';
import { useRecordPageLifecycle } from '@/components/record-page/composables/useRecordPageLifecycle';
import {
  extractRecordUpdatedAtMs,
  recordRecordDetailFingerprint,
} from '@/utils/recordDetailFreshness';
import { dispatchRecordUpdated } from '@/utils/moduleListFreshness';
import { useStickyTitleRow } from '@/components/record-page/composables/useStickyTitleRow';
import { FLOATING_OVERLAY_Z_CLASS } from '@/constants/zIndexLayers';
import RecordPageTitleRow from '@/components/record-page/RecordPageTitleRow.vue';
import EditableTitle from '@/components/record-page/EditableTitle.vue';
import RecordPresenceAvatars from '@/components/record-page/RecordPresenceAvatars.vue';
import { useRecordPresence } from '@/composables/useRecordPresence';
import TaskDescriptionEditor from '@/components/record-page/TaskDescriptionEditor.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import {
  normalizeSystemActivityEvent,
  normalizeCommentActivityEvent,
  normalizeEmailThreadActivityEvent,
  sortActivityEventsByDate
} from '@/components/record-page/activityEventModel';
import LinkRecordsDrawer from '@/components/common/LinkRecordsDrawer.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import { buildDuplicateInitialData } from '@/utils/duplicateRecord';
import RecordDocumentsPanel from '@/components/record-page/RecordDocumentsPanel.vue';
import { supportsDocumentAttachments } from '@/constants/documentAttachments';
import TaskRelatedToField from '@/components/tasks/TaskRelatedToField.vue';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';
import EmailComposeDrawer from '@/components/communications/EmailComposeDrawer.vue';
import DOMPurify from 'dompurify';
import { sanitizeRichDescriptionHtml } from '@/utils/richDescriptionHtml';
import { formatDate as formatLocaleDate, formatTime, formatUserDate, formatUserDateTime } from '@/utils/localeFormat';
import { buildDescriptionActivityDiff, isDescriptionActivityFieldChange } from '@/utils/contentVersionHistory';
import { useRichDescriptionImagePreview } from '@/composables/useRichDescriptionImagePreview';
import RichDescriptionImageLightbox from '@/components/common/RichDescriptionImageLightbox.vue';
import {
  ChatBubbleLeftRightIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ClockIcon,
  LinkIcon,
  PuzzlePieceIcon,
  StarIcon,
  CheckIcon,
  XMarkIcon,
  EllipsisVerticalIcon,
  CalendarIcon,
  UserIcon,
  FlagIcon,
  CheckCircleIcon,
  PaperClipIcon,
  MagnifyingGlassIcon,
  BellIcon,
  FunnelIcon,
  TagIcon,
  PencilSquareIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  PlusIcon,
  TrashIcon,
  ArrowsPointingInIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  HandThumbUpIcon,
  FaceSmileIcon,
  EnvelopeIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  DocumentDuplicateIcon,
  Bars3BottomLeftIcon
} from '@heroicons/vue/24/outline';
import {
  StarIcon as StarIconSolid,
  FlagIcon as FlagIconSolid
} from '@heroicons/vue/24/solid';
import Avatar from '@/components/common/Avatar.vue';
import 'emoji-picker-element';
import DateCell from '@/components/common/table/DateCell.vue';
import { getKeyFields, formatActivityChangeValue } from '@/utils/fieldDisplay';
import { formatCurrencyValue, resolveCurrencyCodeForField, resolveOrgCurrencyCode } from '@/utils/currencyOptions';
import apiClient from '@/utils/apiClient';
import { isAddonEntitled } from '@/utils/addonEntitlement';
import { openRecordDiscussChat } from '@/utils/internalChatApi';
import { fetchModuleDefinitionCached } from '@/utils/tenantSchemaApiCache';
import DatePicker from '@/components/common/DatePicker.vue';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import { useNotifications } from '@/composables/useNotifications';
import { useArivuDataChangeRefresh } from '@/composables/useArivuDataChangeRefresh';
import { 
  TASK_FIELD_METADATA, 
  getCoreTaskFields,
  getTaskFieldMetadata
} from '@/platform/fields/taskFieldModel';

const { t, te } = useI18n();
const {
  showImagePreview,
  previewImageSrc,
  closeImagePreview,
  handleRichHtmlClick
} = useRichDescriptionImagePreview();

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notifications = useNotifications();
const { openTab, replaceActiveTab, activeTabId, updateTabTitle, findTabById } = useTabs();
const recordLayoutIsMobile = inject('recordLayoutIsMobile', ref(false));
const quickPreviewNav = inject('quickPreviewNav', null);

const props = defineProps({
  /** When true, renders in embed mode for QuickPreviewDrawer (mobile layout, no header, close button) */
  embed: { type: Boolean, default: false },
  /** Task ID when embed - used instead of route.params.id */
  taskId: { type: String, default: null }
});

const emit = defineEmits(['close']);

const taskModuleLabel = computed(() => t('records.taskModuleLabel'));
const taskLoadingMessage = computed(() => t('records.taskLoading'));
const taskErrorTitle = computed(() => t('records.taskErrorTitle'));
const taskNavPreviousLabel = computed(() => t('records.taskNavPrevious'));
const taskNavNextLabel = computed(() => t('records.taskNavNext'));
const keyFieldsEmptyLabel = computed(() => t('common.keyFieldsEmptyValue'));

const effectiveTaskId = computed(() => props.embed && props.taskId ? props.taskId : route.params.id);

const assigneeEmail = computed(() => {
  const a = task.value?.assignedTo;
  if (!a) return '';
  return typeof a === 'object' ? (a.email || '') : '';
});

const handleEmbedClose = () => {
  if (props.embed) emit('close');
};

const task = ref(null);
const taskRecordPageRootRef = ref(null);
const taskNavigationIds = ref([]);
const { loading, error, runWithLoading } = useRecordLoading();
const showEditDrawer = ref(false);
const showDuplicateCreateModal = ref(false);
const duplicateInitialData = ref({});
const duplicateSourceId = ref('');

function closeDuplicateCreate() {
  showDuplicateCreateModal.value = false;
  duplicateInitialData.value = {};
  duplicateSourceId.value = '';
}
const showEmailModal = ref(false);
const emailComposeDraft = ref(null);
const taskEvents = ref([]);
const taskDeals = ref([]);
const taskForms = ref([]);
const taskPeople = ref([]);
const DEFAULT_TASK_STATUS_OPTIONS = Object.freeze([
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
]);
const DEFAULT_TASK_PRIORITY_OPTIONS = Object.freeze([
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' }
]);
const DEFAULT_TASK_STATUS_COLOR_MAP = Object.freeze({
  todo: '#6B7280',
  in_progress: '#2563EB',
  waiting: '#D97706',
  completed: '#16A34A',
  cancelled: '#DC2626'
});
const DEFAULT_TASK_PRIORITY_COLOR_MAP = Object.freeze({
  low: '#6B7280',
  medium: '#2563EB',
  high: '#D97706',
  urgent: '#DC2626'
});
const taskStatusFieldOptions = ref([]);
const taskPriorityFieldOptions = ref([]);
const taskModuleDefinition = ref(null);
const RIGHT_RELATED_DEFAULT_OPEN_STATE = Object.freeze({
  project: true,
  people: true,
  events: true,
  deals: true,
  forms: true
});
const rightRelatedModuleOpen = ref({
  ...RIGHT_RELATED_DEFAULT_OPEN_STATE
});
const activityEvents = ref([]);
const emailThreads = ref([]);
const expandedTaskEmailThreads = ref(new Set());
const customFields = ref([]);
const users = ref([]);
const activitySectionRef = ref(null);
const activityTimelineRef = ref(null);
const rightPaneRef = ref(null);
const {
  isLeftTitleSticky,
  attach: attachStickyTitle,
  attachWhenReady: attachStickyTitleWhenReady,
  detach: detachStickyTitle,
  reset: resetStickyTitle
} = useStickyTitleRow(taskRecordPageRootRef);
const isCreatingSubtask = ref(false);
const isSavingNewSubtask = ref(false);
const isDeletingSubtask = ref(false);
const deletingSubtaskId = ref('');
const newSubtaskTitle = ref('');
// Activity search state (searches comments)
const activitySearchQuery = ref('');
const activitySearchInputRef = ref(null);
const activitySearchOpen = ref(false);
const showTimestampSheet = ref(false);
const timestampSheetValue = ref('');

const ACTIVITY_FILTER_STORAGE_KEY = 'arivu-activity-filter';
function loadActivityFilter() {
  try {
    const raw = localStorage.getItem(ACTIVITY_FILTER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.comments === 'boolean' && typeof parsed?.updates === 'boolean') {
        return {
          comments: parsed.comments,
          updates: parsed.updates,
          email: typeof parsed?.email === 'boolean' ? parsed.email : true,
          doneThreads: typeof parsed?.doneThreads === 'boolean' ? parsed.doneThreads : false,
          assignedToMe: typeof parsed?.assignedToMe === 'boolean' ? parsed.assignedToMe : false,
          tagged: typeof parsed?.tagged === 'boolean' ? parsed.tagged : false,
          untagged: typeof parsed?.untagged === 'boolean' ? parsed.untagged : false
        };
      }
    }
  } catch (_) {}
  return { comments: true, updates: true, email: true, doneThreads: false, assignedToMe: false, tagged: false, untagged: false };
}
const savedFilter = loadActivityFilter();
const activityFilterComments = ref(savedFilter.comments);
const activityFilterUpdates = ref(savedFilter.updates);
const activityFilterEmail = ref(savedFilter.email);
const activityFilterDoneThreads = ref(savedFilter.doneThreads);
const activityFilterAssignedToMe = ref(savedFilter.assignedToMe);
const activityFilterTagged = ref(savedFilter.tagged);
const activityFilterUntagged = ref(savedFilter.untagged);
const newCommentText = ref('');
const activeThreadRootCommentId = ref(null);
const editingCommentId = ref(null);
const editingCommentText = ref('');
const editingCommentAttachments = ref([]);
const editingCommentOriginalText = ref('');
const editingCommentOriginalAttachments = ref([]);
const editingCommentHasPendingFiles = ref(false);
const editCommentInputRef = ref(null);
const isEditingDescription = ref(false);
const descriptionDisplayRef = ref(null);
const descriptionMinHeight = ref(null);
const isDescriptionExpanded = ref(false);
const expandedLeftSection = ref(null);

const showRecordPresenceAvatars = computed(
  () => Boolean(effectiveTaskId.value && task.value && authStore.can('tasks', 'view'))
);

const recordPresenceActivityType = computed(() => {
  const section = expandedLeftSection.value;
  if (!section || section === 'key-fields') return 'viewing';
  return 'editing';
});

const { otherSessions: recordPresenceOthers } = useRecordPresence(
  () => 'tasks',
  () => String(effectiveTaskId.value || task.value?._id || ''),
  () => recordPresenceActivityType.value
);

const DESCRIPTION_PREVIEW_LINES = 7;
const DESCRIPTION_PREVIEW_LINE_HEIGHT_REM = 1.5;
const DESCRIPTION_PREVIEW_CHAR_THRESHOLD = 600;

const showLinkRecordDrawer = ref(false);
const allowCreateFromLinkDrawer = ref(false);
const showAddRelatedRecordDrawer = ref(false);
const addRelatedRecordModuleKey = ref('');
const pendingAddRelatedLinkPayload = ref(null);
const linkRecordDrawerContext = computed(() => (task.value?._id ? { taskId: task.value._id } : {}));
const linkRecordDrawerTitle = computed(() => (
  allowCreateFromLinkDrawer.value
    ? t('records.genericLinkDrawerAddAndLink')
    : t('records.genericLinkDrawerLink')
));
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
const openLeftSection = (sectionKey) => {
  expandedLeftSection.value = sectionKey;
};
const closeExpandedLeftSection = () => {
  expandedLeftSection.value = null;
};

const descriptionVersionsLoading = ref(false);
const descriptionRestoreLoading = ref(false);
const descriptionVersionsData = ref({ currentDescription: '', versions: [] });
const selectedDescriptionVersionIndex = ref(0);

const openDescriptionHistory = () => {
  expandedLeftSection.value = 'description-history';
  selectedDescriptionVersionIndex.value = 0;
  fetchDescriptionVersions();
};

const saveTaskDescriptionFromSection = async (value) => {
  if (!task.value || !canEditTask.value) return;
  const trimmedDescription = String(value || '').trim();
  const originalDescription = task.value?.description || '';
  localDescription.value = trimmedDescription;
  if (trimmedDescription !== originalDescription) {
    task.value.description = trimmedDescription;
    await handleFieldSave('description', trimmedDescription);
  }
};

const descriptionHistoryList = computed(() => {
  const taskVal = task.value;
  const data = descriptionVersionsData.value;
  if (!taskVal) return [];
  const current = {
    isCurrent: true,
    createdAt: taskVal.updatedAt || taskVal.createdAt || new Date(),
    createdBy: null,
    content: taskVal.description || ''
  };
  const currentUserName = authStore.user
    ? [authStore.user.firstName, authStore.user.lastName].filter(Boolean).join(' ').trim() || authStore.user.email
    : 'You';
  const list = [
    { ...current, createdBy: currentUserName }
  ];
  (data.versions || []).forEach((v) => {
    list.push({
      isCurrent: false,
      createdAt: v.createdAt,
      createdBy: v.createdBy,
      content: v.content
    });
  });
  return list;
});

function formatDescriptionVersionDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return formatUserDateTime(d);
}

async function fetchDescriptionVersions() {
  const id = task.value?._id;
  if (!id) return;
  descriptionVersionsLoading.value = true;
  try {
    const res = await apiClient.get(`/tasks/${id}/description-versions`);
    descriptionVersionsData.value = res?.data ?? { currentDescription: '', versions: [] };
  } catch (err) {
    console.error('Fetch description versions failed:', err);
    descriptionVersionsData.value = { currentDescription: '', versions: [] };
  } finally {
    descriptionVersionsLoading.value = false;
  }
}

async function restoreDescriptionVersion() {
  if (selectedDescriptionVersionIndex.value === 0) return;
  const id = task.value?._id;
  if (!id) return;
  const apiIndex = selectedDescriptionVersionIndex.value - 1;
  descriptionRestoreLoading.value = true;
  try {
    const res = await apiClient.post(`/tasks/${id}/description-versions/restore`, { versionIndex: apiIndex });
    if (res?.data) {
      task.value = res.data;
      localDescription.value = (res.data.description || '').trim();
      closeExpandedLeftSection();
    }
  } catch (err) {
    console.error('Restore description version failed:', err);
  } finally {
    descriptionRestoreLoading.value = false;
  }
}

const statusSelectOptions = computed(() => {
  const normalized = (taskStatusFieldOptions.value || [])
    .filter(option => option && option.value)
    .filter(option => option.enabled !== false)
    .map(option => ({ value: option.value, label: option.label || option.value, color: option.color || null }));

  return normalized.length > 0
    ? normalized
    : DEFAULT_TASK_STATUS_OPTIONS.map(option => ({ ...option, color: null }));
});

const prioritySelectOptions = computed(() => {
  const normalized = (taskPriorityFieldOptions.value || [])
    .filter(option => option && option.value)
    .filter(option => option.enabled !== false)
    .map(option => ({ value: option.value, label: option.label || option.value, color: option.color || null }));

  return normalized.length > 0
    ? normalized
    : DEFAULT_TASK_PRIORITY_OPTIONS.map(option => ({ ...option, color: DEFAULT_TASK_PRIORITY_COLOR_MAP[option.value] || null }));
});

const getRightRelatedAccordionStorageKey = () => {
  const id = task.value?._id || route.params.id || 'unknown';
  return `task-record-right-related-modules-${id}`;
};

const loadRightRelatedAccordionState = () => {
  try {
    const raw = sessionStorage.getItem(getRightRelatedAccordionStorageKey());
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    rightRelatedModuleOpen.value = {
      ...rightRelatedModuleOpen.value,
      ...parsed
    };
  } catch {}
};

const persistRightRelatedAccordionState = () => {
  try {
    sessionStorage.setItem(
      getRightRelatedAccordionStorageKey(),
      JSON.stringify(rightRelatedModuleOpen.value)
    );
  } catch {}
};

const handleRightRelatedModuleToggle = (key, event) => {
  rightRelatedModuleOpen.value = {
    ...rightRelatedModuleOpen.value,
    [key]: !!event?.target?.open
  };
};

const localDescription = ref('');
const descriptionEditorRef = ref(null);

const isEditingStartDate = ref(false);
const isEditingDueDate = ref(false);
const localStartDate = ref('');
const localDueDate = ref('');
const startDateInputRef = ref(null);
const dueDateInputRef = ref(null);

const isEditingTimeEstimate = ref(false);
const localTimeEstimate = ref(0);
const timeEstimateInputRef = ref(null);

const startStartDateEdit = async () => {
  if (!canEditTask.value || isEditingStartDate.value) return;
  isEditingStartDate.value = true;
  resetLocalStartDate();
  await nextTick();
  startDateInputRef.value?.focus?.();
  startDateInputRef.value?.open?.();
};

const startDueDateEdit = async () => {
  if (!canEditTask.value || isEditingDueDate.value) return;
  isEditingDueDate.value = true;
  resetLocalDueDate();
  await nextTick();
  dueDateInputRef.value?.focus?.();
  dueDateInputRef.value?.open?.();
};
const onTimeEstimateCellClick = () => {
  if (!isEditingTimeEstimate.value) isEditingTimeEstimate.value = true;
};

const relatedToPopoverAnchorEl = ref(null);
const relatedToPopoverRef = ref(null);
const showRelatedToPopover = ref(false);
const relatedToPopoverStyle = ref({ top: '0px', left: '0px' });
const relatedToPopoverValue = ref({ type: 'none', id: null });
const relatedToPopoverInitialValue = ref({ type: 'none', id: null });
const relatedToPopoverError = ref('');
const relatedToSaving = ref(false);

const {
  tagHeaderButtonRef,
  tagFieldButtonRef,
  tagPopoverRef,
  showTagPopover,
  tagPopoverStyle,
  updateTagPopoverPosition,
  handleTagIconClick,
  openTagPopoverFromField,
  handleTagPopoverMousedown,
  handleTagPopoverOutsideClick
} = useRecordTagPopoverPosition();

const tagStorageKey = computed(() => {
  const raw = authStore.user?.organizationId || authStore.organization?._id || 'default-org';
  const organizationId = raw && typeof raw === 'object' && raw._id != null ? String(raw._id) : String(raw);
  return `arivu-task-tag-definitions-${organizationId}`;
});
const hasTaskTags = computed(() => Array.isArray(task.value?.tags) && task.value.tags.length > 0);

function notifyTaskListUpdated() {
  if (!task.value?._id) return;
  dispatchRecordUpdated({
    moduleKey: 'tasks',
    recordId: task.value._id,
    record: task.value,
    appKey: 'PLATFORM'
  });
}

const persistRecordTagsForTask = async (cleaned) => {
  if (!task.value || !canEditTask.value) return;
  const response = await apiClient.put(`/tasks/${task.value._id}/tags`, { tags: cleaned });
  if (response?.success && response.data) {
    task.value.tags = Array.isArray(response.data.tags) ? response.data.tags : cleaned;
  } else {
    task.value.tags = cleaned;
  }
  notifyTaskListUpdated();
};

const getFieldLabel = (fieldKey) => {
  const moduleField = taskModuleDefinition.value?.fields?.find(
    (f) => (f.key || '').toLowerCase() === (fieldKey || '').toLowerCase()
  );
  return resolveFieldLabel('tasks', { key: fieldKey, label: moduleField?.label }, t, te);
};

// Get custom field object by key (for Details section display)
const getCustomFieldByKey = (fieldKey) => {
  return (customFields.value || []).find(
    (f) => (f?.key || '').toLowerCase() === (fieldKey || '').toLowerCase()
  ) || null;
};

// Get module field definition for a custom field (from taskModuleDefinition)
const getModuleFieldForKey = (fieldKey) => {
  return (taskModuleDefinition.value?.fields || []).find(
    (f) => (f?.key || '').toLowerCase() === (fieldKey || '').toLowerCase()
  ) || null;
};

// Map custom field dataType to EditableLabeledValue type
const getCustomFieldEditableType = (fieldKey) => {
  const modField = getModuleFieldForKey(fieldKey);
  const dt = (modField?.dataType || 'Text').toLowerCase();
  if (['integer', 'decimal', 'currency'].includes(dt)) return 'number';
  if (['date', 'date-time', 'datetime'].includes(dt)) return 'date';
  if (dt === 'picklist') return 'select';
  return 'text';
};

// Get options for Picklist/Multi-Picklist custom fields
const getCustomFieldOptions = (fieldKey) => {
  const modField = getModuleFieldForKey(fieldKey);
  const opts = modField?.options;
  if (!Array.isArray(opts)) return undefined;
  return opts.map((o) => ({
    value: typeof o === 'object' && o !== null ? (o.value ?? o.label ?? o) : o,
    label: typeof o === 'object' && o !== null ? (o.label ?? o.value ?? String(o)) : String(o)
  }));
};

// Get min/step for number-type custom fields
const getCustomFieldNumberMin = (fieldKey) => {
  const modField = getModuleFieldForKey(fieldKey);
  const dt = (modField?.dataType || '').toLowerCase();
  if (['integer', 'decimal', 'currency'].includes(dt)) return 0;
  return undefined;
};

const getCustomFieldNumberStep = (fieldKey) => {
  const modField = getModuleFieldForKey(fieldKey);
  const dt = (modField?.dataType || '').toLowerCase();
  if (dt === 'integer') return 1;
  if (['decimal', 'currency'].includes(dt)) return 0.01;
  return undefined;
};

// Get field type for EditableLabeledValue component based on field metadata
const getFieldType = (fieldKey) => {
  const metadata = getTaskFieldMetadata(fieldKey);
  if (!metadata) return 'text';
  
  // Map field intents/types to EditableLabeledValue types
  if (fieldKey === 'assignedTo') return 'user';
  if (fieldKey === 'dueDate' || fieldKey === 'startDate') return 'date';
  if (fieldKey === 'priority' || fieldKey === 'status') return 'select';
  if (fieldKey === 'estimatedHours' || fieldKey === 'actualHours') return 'number';
  if (fieldKey === 'tags') return 'tags';
  
  return 'text';
};

// Get select options for select-type fields
const getFieldOptions = (fieldKey) => {
  if (fieldKey === 'priority') {
    return prioritySelectOptions.value.map(option => ({
      value: option.value,
      label: option.label
    }));
  }
  if (fieldKey === 'status') {
    return statusSelectOptions.value.map(option => ({
      value: option.value,
      label: option.label
    }));
  }
  return undefined;
};

const isTaskFieldEditableByConfig = (fieldKey) => {
  if (!fieldKey) return false;
  const moduleField = getModuleFieldForKey(fieldKey);
  if (moduleField && typeof moduleField.editable === 'boolean') {
    return moduleField.editable;
  }
  const metadata = getTaskFieldMetadata(fieldKey);
  if (metadata && typeof metadata.editable === 'boolean') {
    return metadata.editable;
  }
  return true;
};

const resolveFieldPrefixIcon = (fieldKey, fieldType = '') => {
  const key = String(fieldKey || '').trim();
  const keyLower = key.toLowerCase();
  const map = {
    status: CheckCircleIcon,
    startdate: CalendarIcon,
    duedate: CalendarIcon,
    estimatedhours: ClockIcon,
    actualhours: ClockIcon,
    assignedto: UserIcon,
    priority: FlagIcon,
    tags: TagIcon,
    relatedto: LinkIcon
  };
  if (map[keyLower]) return map[keyLower];

  const moduleField = getModuleFieldForKey(key);
  const dataType = String(moduleField?.dataType || '').toLowerCase();
  if (['date', 'date-time', 'datetime'].includes(dataType)) return CalendarIcon;
  if (['integer', 'decimal', 'currency'].includes(dataType)) return CurrencyDollarIcon;
  if (['picklist', 'multi-picklist'].includes(dataType)) return TagIcon;
  if (['lookup', 'lookup (relationship)', 'user'].includes(dataType)) return UserIcon;

  const type = String(fieldType || getFieldType(key) || '').toLowerCase();
  if (type === 'date') return CalendarIcon;
  if (type === 'number') return CurrencyDollarIcon;
  if (type === 'select') return TagIcon;
  if (type === 'user') return UserIcon;
  return DocumentTextIcon;
};

const getPlainTextFromHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

// Word-level diff for version history: compare oldText (selected) vs newText (current), return HTML with added/removed highlights
function diffWordsToHtml(oldText, newText) {
  if (oldText == null) oldText = '';
  if (newText == null) newText = '';
  const a = String(oldText).split(/(\s+)/);
  const b = String(newText).split(/(\s+)/);
  const escape = (s) => {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  };
  const parts = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      parts.push({ op: 0, text: a[i] });
      i++;
      j++;
      continue;
    }
    if (i >= a.length) {
      parts.push({ op: 1, text: b[j] });
      j++;
      continue;
    }
    if (j >= b.length) {
      parts.push({ op: -1, text: a[i] });
      i++;
      continue;
    }
    const nextI = a.indexOf(b[j], i + 1);
    const nextJ = b.indexOf(a[i], j + 1);
    const distI = nextI === -1 ? Infinity : nextI - i;
    const distJ = nextJ === -1 ? Infinity : nextJ - j;
    if (distI <= distJ && distI !== Infinity) {
      for (let k = i; k < nextI; k++) parts.push({ op: -1, text: a[k] });
      i = nextI;
    } else if (distJ !== Infinity) {
      for (let k = j; k < nextJ; k++) parts.push({ op: 1, text: b[k] });
      j = nextJ;
    } else {
      parts.push({ op: -1, text: a[i] });
      parts.push({ op: 1, text: b[j] });
      i++;
      j++;
    }
  }
  let html = '';
  for (const p of parts) {
    const escaped = escape(p.text);
    if (p.op === 0) html += escaped;
    else if (p.op === -1) html += `<del class="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 line-through">${escaped}</del>`;
    else html += `<ins class="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 no-underline">${escaped}</ins>`;
  }
  return html;
}

const hasDescription = computed(() => {
  const desc = task.value?.description || '';
  return getPlainTextFromHtml(desc).length > 0;
});

const shouldShowDescriptionViewMore = computed(() => {
  const descriptionText = task.value?.description || '';
  if (!descriptionText) return false;
  const plainText = getPlainTextFromHtml(descriptionText);
  return plainText.length > DESCRIPTION_PREVIEW_CHAR_THRESHOLD;
});

const sanitizedDescription = computed(() => sanitizeRichDescriptionHtml(task.value?.description || ''));

// In version history view, show the selected version's content (not always current)
const descriptionHistorySelectedContent = computed(() => {
  const list = descriptionHistoryList.value;
  const idx = selectedDescriptionVersionIndex.value;
  const ver = list[idx];
  if (!ver || ver.content == null) return '';
  const raw = String(ver.content);
  if (!raw.trim()) return '';
  return sanitizeRichDescriptionHtml(raw);
});

// Show diff for every version when we have at least two to compare (current vs previous, or selected past vs current)
const descriptionHistoryShowDiff = computed(() => {
  const list = descriptionHistoryList.value;
  return list.length > 1;
});
const descriptionHistoryDiffHtml = computed(() => {
  if (!descriptionHistoryShowDiff.value) return '';
  const list = descriptionHistoryList.value;
  const idx = selectedDescriptionVersionIndex.value;
  const currentVer = list[0];
  const oldVer = idx === 0 ? list[1] : list[idx];
  if (!currentVer || !oldVer) return '';
  const oldPlain = getPlainTextFromHtml(oldVer.content);
  const newPlain = getPlainTextFromHtml(currentVer.content);
  const diffHtml = diffWordsToHtml(oldPlain, newPlain);
  return DOMPurify.sanitize(diffHtml, { ALLOWED_TAGS: ['ins', 'del'], ALLOWED_ATTR: ['class'] });
});

const descriptionHistorySelectedHasContent = computed(() => {
  const list = descriptionHistoryList.value;
  const idx = selectedDescriptionVersionIndex.value;
  const ver = list[idx];
  return ver && String(ver.content || '').trim().length > 0;
});

const descriptionContentStyle = computed(() => {
  if (!shouldShowDescriptionViewMore.value) return null;
  return {
    maxHeight: isDescriptionExpanded.value
      ? '1000px'
      : `${DESCRIPTION_PREVIEW_LINES * DESCRIPTION_PREVIEW_LINE_HEIGHT_REM}rem`,
    overflow: 'hidden',
    transition: 'max-height 450ms cubic-bezier(0.25, 0.1, 0.25, 1)'
  };
});

const KEY_FIELD_SECTION_EXCLUDED_KEYS = Object.freeze(['title', 'description', 'subtasks']);
const TASK_KEY_FIELD_DISPLAY_ORDER = Object.freeze([
  'status',
  'priority',
  'startDate',
  'dueDate',
  'assignedTo',
  'estimatedHours'
]);

const keyFieldKeys = computed(() => {
  const configured = getKeyFields(taskModuleDefinition.value)
    .map(field => String(field?.key || '').trim())
    .filter(Boolean)
    .filter(key => !KEY_FIELD_SECTION_EXCLUDED_KEYS.includes(key));

  return [...configured].sort((a, b) => {
    const aPinnedIndex = TASK_KEY_FIELD_DISPLAY_ORDER.indexOf(a);
    const bPinnedIndex = TASK_KEY_FIELD_DISPLAY_ORDER.indexOf(b);
    const aPinned = aPinnedIndex !== -1;
    const bPinned = bPinnedIndex !== -1;

    if (aPinned && bPinned) return aPinnedIndex - bPinnedIndex;
    if (aPinned) return -1;
    if (bPinned) return 1;
    return configured.indexOf(a) - configured.indexOf(b);
  });
});

const keyFieldSlotMap = {
  assignedTo: 'owner',
  estimatedHours: 'timeEstimate'
};

const KEY_SECTION_EDITABLE_TYPES = Object.freeze(new Set(['text', 'number', 'date', 'select', 'user']));

const getKeyFieldRawValue = (fieldKey) => {
  if (!task.value || !fieldKey) return null;
  if (fieldKey === 'assignedTo') {
    const assignedTo = task.value.assignedTo;
    if (assignedTo && typeof assignedTo === 'object') {
      return assignedTo._id || assignedTo.id || null;
    }
    return assignedTo || null;
  }

  if (fieldKey === 'dueDate' || fieldKey === 'startDate') return task.value[fieldKey] || null;
  if (fieldKey === 'priority' || fieldKey === 'status') return task.value[fieldKey] || null;
  if (fieldKey === 'estimatedHours' || fieldKey === 'actualHours') {
    return task.value[fieldKey] != null && task.value[fieldKey] !== '' ? Number(task.value[fieldKey]) : null;
  }
  if (fieldKey === 'tags') {
    return Array.isArray(task.value.tags) ? task.value.tags : [];
  }
  if (fieldKey === 'relatedTo') return task.value.relatedTo || null;

  const customField = getCustomFieldByKey(fieldKey);
  if (customField) {
    return task.value[fieldKey] ?? customField.value ?? null;
  }

  return task.value[fieldKey] ?? null;
};

const getKeyFieldResolvedType = (fieldKey) => {
  if (getCustomFieldByKey(fieldKey)) {
    return getCustomFieldEditableType(fieldKey);
  }
  return getFieldType(fieldKey);
};

const getKeyFieldResolvedOptions = (fieldKey) => {
  if (getCustomFieldByKey(fieldKey)) {
    return getCustomFieldOptions(fieldKey);
  }
  return getFieldOptions(fieldKey);
};

const canEditKeyField = (fieldKey) => {
  if (!canEditTask.value) return false;
  if (!isTaskFieldEditableByConfig(fieldKey)) return false;
  return KEY_SECTION_EDITABLE_TYPES.has(getKeyFieldResolvedType(fieldKey));
};

const canOpenKeyFieldEditor = (fieldKey) => {
  if (!canEditTask.value) return false;
  if (!isTaskFieldEditableByConfig(fieldKey)) return false;
  if (fieldKey === 'relatedTo') return true;
  if (fieldKey === 'tags') return true;
  return false;
};

const keySectionFields = computed(() => {
  return keyFieldKeys.value.map((fieldKey) => {
    const moduleField = getKeyFields(taskModuleDefinition.value).find(field => field?.key === fieldKey);
    const fieldType = getKeyFieldResolvedType(fieldKey);
    const canEdit = canEditKeyField(fieldKey);
    const canOpenEditor = canOpenKeyFieldEditor(fieldKey);
    return {
      key: fieldKey,
      label: getFieldLabel(fieldKey),
      icon: resolveFieldPrefixIcon(fieldKey, fieldType),
      slotKey: keyFieldSlotMap[fieldKey] || fieldKey,
      type: fieldType,
      options: getKeyFieldResolvedOptions(fieldKey),
      min: getCustomFieldNumberMin(fieldKey),
      step: getCustomFieldNumberStep(fieldKey),
      value: getKeyFieldRawValue(fieldKey),
      displayValue: getKeyFieldDisplayValue(fieldKey),
      canEdit,
      canOpenEditor,
      onEdit: canOpenEditor
        ? (event) => {
          if (fieldKey === 'relatedTo') {
            openRelatedToPopover(event, fieldKey, task.value);
            return;
          }
          if (fieldKey === 'tags') {
            openTagPopoverFromField(event, fieldKey, task.value);
          }
        }
        : null,
      onSave: canEdit
        ? (value) => handleFieldSave(fieldKey, value)
        : null
    };
  });
});

const getKeyFieldDisplayValue = (fieldKey) => {
  if (!task.value) return null;

  if (fieldKey === 'status') return formatStatus(task.value.status) || keyFieldsEmptyLabel.value;
  if (fieldKey === 'assignedTo') return getAssignedToDisplay(task.value.assignedTo) || keyFieldsEmptyLabel.value;
  if (fieldKey === 'startDate') return formatStateDate(task.value.startDate) || keyFieldsEmptyLabel.value;
  if (fieldKey === 'dueDate') return formatStateDate(task.value.dueDate) || keyFieldsEmptyLabel.value;
  if (fieldKey === 'priority') return formatPriority(task.value.priority) || keyFieldsEmptyLabel.value;
  if (fieldKey === 'estimatedHours') return task.value.estimatedHours ? `${task.value.estimatedHours}h` : keyFieldsEmptyLabel.value;
  if (fieldKey === 'tags') {
    return Array.isArray(task.value.tags) && task.value.tags.length > 0 ? task.value.tags.join(', ') : keyFieldsEmptyLabel.value;
  }
  if (fieldKey === 'relatedTo') return getRelatedToDisplay(task.value) || keyFieldsEmptyLabel.value;

  const rawValue = task.value[fieldKey];
  if (rawValue == null || rawValue === '') return keyFieldsEmptyLabel.value;
  if (typeof rawValue === 'object') {
    return rawValue.name || rawValue.label || rawValue.title || rawValue._id || keyFieldsEmptyLabel.value;
  }
  return String(rawValue);
};

function getRelatedToDisplay(t) {
  if (!t) return null;
  const rt = t.relatedTo ?? (t.relatedToType != null || t.relatedToId != null ? { type: t.relatedToType || 'none', id: t.relatedToId } : null);
  if (!rt || rt.type === 'none' || !rt.id) return null;
  const typeLabel = { contact: 'People', deal: 'Deal', organization: 'Organization', project: 'Project' }[rt.type] || rt.type;
  // Prefer display name: populated object (name/title), or stored name (e.g. from popover save), else raw id
  let nameVal = null;
  if (rt.id && typeof rt.id === 'object') {
    nameVal = rt.id.name || rt.id.title || rt.id._id;
  } else if (rt.name) {
    nameVal = rt.name;
  } else {
    nameVal = rt.id;
  }
  return nameVal ? `${typeLabel}: ${nameVal}` : typeLabel;
}

function getNormalizedRelatedTo(t) {
  if (!t) return { type: 'none', id: null };
  const rt = t.relatedTo ?? (t.relatedToType != null || t.relatedToId != null ? { type: t.relatedToType || 'none', id: t.relatedToId } : null);
  if (!rt || typeof rt !== 'object') return { type: 'none', id: null };
  const id = rt.id != null && typeof rt.id === 'object' && rt.id._id != null ? rt.id._id : (rt.id ?? null);
  return { type: rt.type || 'none', id };
}

function getRelatedToRecordPath(t) {
  const rt = getNormalizedRelatedTo(t);
  if (!rt || rt.type === 'none' || !rt.id) return null;
  const routes = {
    contact: '/people',
    deal: '/deals',
    organization: '/organizations',
    project: '/projects'
  };
  const base = routes[rt.type];
  return base ? `${base}/${rt.id}` : null;
}

const openRelatedToRecord = () => {
  const path = getRelatedToRecordPath(task.value);
  if (path) openTab(path, { background: false, insertAdjacent: true });
};

const keyFieldDisplayValues = computed(() => {
  const values = {};
  keyFieldKeys.value.forEach((fieldKey) => {
    values[fieldKey] = getKeyFieldDisplayValue(fieldKey);
  });
  return values;
});

// Check if user can edit tasks
const canEditTask = computed(() => {
  return authStore.can('tasks', 'edit');
});

const { getTagChipClass, instanceTagDefinitions } = useRecordTags(task, {
  tagStorageKey,
  canEdit: canEditTask,
  persistTags: persistRecordTagsForTask,
  instanceTagSource: 'tasks'
});
const getTaskTagChipClass = getTagChipClass;

/** Force Details chips to track shared tag definitions (color updates + assign without refresh). */
const detailTagChips = computed(() => {
  void instanceTagDefinitions.value;
  const tags = Array.isArray(task.value?.tags) ? task.value.tags : [];
  return tags.map((tag, index) => ({
    key: `${String(tag)}-${index}`,
    label: tag,
    chipClass: getTagChipClass(tag)
  }));
});

// Check if user can link records (same as edit for now, can be refined)
const canLinkRecords = computed(() => {
  return authStore.can('tasks', 'edit');
});

const {
  showAllDetails,
  showAllSubtasks,
  detailFieldCount,
  shouldShowDetailsViewAll,
  shouldShowSubtasksViewAll,
  canLoadMoreSubtasks,
  completedSubtasksCount,
  totalSubtasksCount,
  setShowAllDetails,
  setShowAllSubtasks,
  loadMoreSubtasks,
  resetSectionState,
  getDetailFields,
  getSubtasks,
  getRelatedGroups
} = useTaskSectionDataProviders({
  task,
  expandedLeftSection,
  taskModuleDefinition,
  keyFieldKeys,
  customFields,
  taskEvents,
  taskPeople,
  taskDeals,
  taskForms,
  getCoreTaskFields,
  getTaskFieldMetadata,
  getAssignedToDisplay: (...args) => getAssignedToDisplay(...args),
  formatDate: (...args) => formatDate(...args),
  formatPriority: (...args) => formatPriority(...args),
  formatStatus: (...args) => formatStatus(...args),
  getRelatedToDisplay,
  getCustomFieldByKey,
  getFieldLabel,
  getFieldType,
  getFieldOptions,
  getCustomFieldEditableType,
  getCustomFieldOptions,
  getCustomFieldNumberMin,
  getCustomFieldNumberStep,
  canEditRecord: () => canEditTask.value,
  canEditField: (fieldKey) => canEditTask.value && isTaskFieldEditableByConfig(fieldKey),
  isFieldEditableByConfig: (fieldKey) => isTaskFieldEditableByConfig(fieldKey),
  resolveFieldPrefixIcon,
  openRelatedToEditor: (...args) => openRelatedToPopover(...args),
  openTagsEditor: (...args) => openTagPopoverFromField(...args),
  getTagChipClass: getTaskTagChipClass,
  saveDetailField: (fieldKey, value) => handleFieldSave(fieldKey, value),
  getRelatedRecordId: (...args) => getRelatedRecordId(...args),
  getRelatedRecordTitle: (...args) => getRelatedRecordTitle(...args),
  getRelatedRecordMeta: (...args) => getRelatedRecordMeta(...args),
  getRelatedToRecordPath: (t) => getRelatedToRecordPath(t)
});

const taskSectionSources = {
  sectionLabels: createRecordSectionLabels(t),
  task,
  expandedLeftSection,
  shouldShowDetailsViewAll,
  shouldShowSubtasksViewAll,
  canLoadMoreSubtasks,
  canLinkRecords,
  completedSubtasksCount,
  totalSubtasksCount,
  detailFieldCount,
  showAllDetails,
  showAllSubtasks,
  setShowAllDetails,
  setShowAllSubtasks,
  openLeftSection,
  startCreateSubtask: (...args) => startCreateSubtask(...args),
  loadMoreSubtasks,
  openLinkRecordDrawer,
  openAddRecordDrawer,
  getDescription: (record) => String(record?.description || ''),
  canEditDescription: () => canEditTask.value,
  saveDescription: saveTaskDescriptionFromSection,
  canViewDescriptionHistory: () => true,
  openDescriptionHistory,
  getDetailFields,
  getSubtasks,
  toggleSubtask: (subtask) => {
    if (subtask?.raw) {
      handleSubtaskToggle(subtask.raw);
    }
  },
  canEditSubtasks: () => canEditTask.value,
  updateSubtaskTitle: (subtask, title) => handleUpdateSubtaskTitle(subtask?.raw || subtask, title),
  deleteSubtask: (subtask) => handleDeleteSubtask(subtask?.raw || subtask),
  isDeletingSubtask: () => isDeletingSubtask.value,
  deletingSubtaskId: () => deletingSubtaskId.value,
  isCreatingSubtask: () => isCreatingSubtask.value,
  getNewSubtaskTitle: () => newSubtaskTitle.value,
  setNewSubtaskTitle: (value) => { newSubtaskTitle.value = value; },
  isSavingNewSubtask: () => isSavingNewSubtask.value,
  cancelCreateSubtask: (...args) => cancelCreateSubtask(...args),
  saveNewSubtask: (...args) => saveNewSubtask(...args),
  getRelatedGroups,
  openRelatedItem: (item) => {
    if (!item?.type || !item?.recordId) return;
    handleOpenRelated(item.type, item.recordId);
  },
  canUnlinkRelated: () => canLinkRecords.value,
  onUnlinkRelated: (item, group) => {
    const moduleKey = item?.type || group?.key;
    const recordRef = { _id: item?.recordId ?? item?.id, recordId: item?.recordId ?? item?.id };
    if (moduleKey && recordRef._id) handleUnlinkRelated(moduleKey, recordRef);
  },
  openTab,
  getRelatedToRecordPath
};

const {
  taskSectionStackAdapter,
  taskSectionStackSections,
  taskSectionStackContext,
  shouldRenderTaskSectionStack
} = useTaskSections(taskSectionSources);

// Check if there are any related records
const hasRelatedToLink = computed(() => {
  const rt = getNormalizedRelatedTo(task.value);
  return rt.type !== 'none' && !!rt.id;
});

const hasRelatedRecords = computed(() => {
  return !!(
    task.value?.projectId ||
    hasRelatedToLink.value ||
    (taskPeople.value && taskPeople.value.length > 0) ||
    (taskEvents.value && taskEvents.value.length > 0) ||
    (taskDeals.value && taskDeals.value.length > 0) ||
    (taskForms.value && taskForms.value.length > 0)
  );
});

const updateRelatedToPopoverPosition = () => {
  if (!showRelatedToPopover.value) return;
  const anchor = relatedToPopoverAnchorEl.value;
  if (!anchor || typeof anchor.getBoundingClientRect !== 'function') return;
  const rect = anchor.getBoundingClientRect();
  const width = 440;
  const margin = 12;
  const gap = 8;
  const popoverEl = relatedToPopoverRef.value;
  const popoverHeight = popoverEl?.offsetHeight || 280;
  // Fixed positioning uses viewport coordinates (no scroll offset)
  const left = Math.min(
    Math.max(rect.left, margin),
    window.innerWidth - width - margin
  );
  const belowTop = rect.bottom + gap;
  const aboveTop = rect.top - popoverHeight - gap;
  const canPlaceBelow = rect.bottom + popoverHeight + margin <= window.innerHeight;
  const top = canPlaceBelow ? belowTop : Math.max(margin, aboveTop);
  relatedToPopoverStyle.value = { top: `${top}px`, left: `${left}px` };
};

const openRelatedToPopover = (event) => {
  if (!task.value) return;
  const el = event?.currentTarget;
  if (el && typeof el.getBoundingClientRect === 'function') {
    relatedToPopoverAnchorEl.value = el;
  } else {
    relatedToPopoverAnchorEl.value = null;
  }
  const initial = getNormalizedRelatedTo(task.value);
  relatedToPopoverValue.value = { ...initial };
  relatedToPopoverInitialValue.value = { type: initial.type, id: initial.id };
  relatedToPopoverError.value = '';
  showRelatedToPopover.value = true;
  nextTick(() => {
    updateRelatedToPopoverPosition();
    requestAnimationFrame(updateRelatedToPopoverPosition);
  });
};

const hasRelatedToPopoverChanges = computed(() => {
  const current = relatedToPopoverValue.value;
  const initial = relatedToPopoverInitialValue.value;
  const currentType = current?.type || 'none';
  const initialType = initial?.type || 'none';
  const currentId = current?.id != null && current?.id !== '' ? String(current.id) : null;
  const initialId = initial?.id != null && initial?.id !== '' ? String(initial.id) : null;
  return currentType !== initialType || currentId !== initialId;
});

const closeRelatedToPopover = () => {
  showRelatedToPopover.value = false;
  relatedToPopoverAnchorEl.value = null;
};

const saveRelatedToFromPopover = async () => {
  if (!task.value || !canEditTask.value) return;
  relatedToPopoverError.value = '';
  relatedToSaving.value = true;
  try {
    const payload = { type: relatedToPopoverValue.value?.type || 'none', id: relatedToPopoverValue.value?.id ?? null };
    const response = await apiClient.put(`/tasks/${task.value._id}`, { relatedTo: payload });
    if (response.success && response.data) {
      const displayName = relatedToPopoverValue.value?.displayLabel;
      task.value.relatedTo = displayName ? { ...payload, name: displayName } : payload;
      if (!displayName && payload.id) await resolveRelatedToDisplayName();
      notifyTaskListUpdated();
      closeRelatedToPopover();
    } else {
      relatedToPopoverError.value = response.message || 'Failed to save';
    }
  } catch (e) {
    relatedToPopoverError.value = e?.message || 'Failed to save';
  } finally {
    relatedToSaving.value = false;
  }
};

const handleRelatedToPopoverOutsideClick = (event) => {
  if (!showRelatedToPopover.value) return;
  const target = event?.target;
  if (!target) return;
  const popoverEl = relatedToPopoverRef.value;
  const clickedInsidePopover = popoverEl && popoverEl.contains(target);
  const anchorEl = relatedToPopoverAnchorEl.value;
  const clickedAnchor = anchorEl && anchorEl.contains(target);
  if (clickedInsidePopover || clickedAnchor) return;
  closeRelatedToPopover();
};

// Available modules for linking
const linkableModules = [
  { key: 'projects', label: 'Project', endpoint: '/projects' },
  { key: 'people', label: 'People', endpoint: '/people' },
  { key: 'deals', label: 'Deal', endpoint: '/deals' },
  { key: 'events', label: 'Event', endpoint: '/events' },
  { key: 'forms', label: 'Form', endpoint: '/forms' }
];

// Get IDs of already linked records to exclude from search
const linkedRecordIds = computed(() => {
  const ids = [];
  if (task.value?.projectId) {
    ids.push(typeof task.value.projectId === 'object' ? task.value.projectId._id : task.value.projectId);
  }
  if (taskEvents.value) {
    ids.push(...taskEvents.value.map(e => e._id));
  }
  if (taskPeople.value) {
    ids.push(...taskPeople.value.map(p => p._id));
  }
  if (taskDeals.value) {
    ids.push(...taskDeals.value.map(d => d._id));
  }
  if (taskForms.value) {
    ids.push(...taskForms.value.map(f => f._id));
  }
  const rt = getNormalizedRelatedTo(task.value);
  if (rt.type !== 'none' && rt.id) {
    ids.push(rt.id);
  }
  return ids;
});

const getRelatedRecordId = (record) => record?._id || record?.recordId || record?.id || null;

const formatCompactDate = (dateValue) => {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return formatUserDate(date);
};

const formatCompactCurrency = (value, currencyCode = null) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return (
    formatCurrencyValue(num, {
      currencyCode: String(currencyCode || resolveOrgCurrencyCode()).toUpperCase(),
      maximumFractionDigits: num >= 1000 ? 0 : 2
    }) || ''
  );
};

const getRelatedTypeLabel = (type) => ({
  project: 'Project',
  people: 'People',
  event: 'Event',
  deal: 'Deal',
  form: 'Form'
}[type] || 'Record');

const getRelatedTypeBadgeClass = (type) => {
  const base = 'inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide';
  const variants = {
    project: 'bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200',
    people: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    event: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    deal: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    form: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  };
  return `${base} ${variants[type] || variants.project}`;
};

const getRelatedRecordTitle = (type, record) => {
  const id = getRelatedRecordId(record);
  const suffix = id ? String(id).slice(-8) : '';

  if (type === 'event') {
    return record?.eventName || record?.name || record?.title || `Event ${suffix}`;
  }
  if (type === 'people') {
    const fullName = [record?.first_name, record?.last_name].filter(Boolean).join(' ').trim();
    return fullName || record?.name || record?.email || `Person ${suffix}`;
  }
  if (type === 'deal') {
    return record?.name || record?.title || `Deal ${suffix}`;
  }
  if (type === 'form') {
    return record?.name || record?.title || `Form ${suffix}`;
  }
  if (type === 'project') {
    return record?.name || record?.title || `Project ${suffix}`;
  }
  return record?.name || record?.title || suffix || 'Record';
};

const getRelatedRecordMeta = (type, record) => {
  if (!record) return '';

  if (type === 'event') {
    const parts = [
      record.eventType || record.status,
      formatCompactDate(record.startDateTime || record.startDate || record.createdAt)
    ].filter(Boolean);
    return parts.join(' • ');
  }

  if (type === 'people') {
    return record?.email || record?.phone || record?.mobile || '';
  }

  if (type === 'deal') {
    const resolvedCurrencyCode = resolveCurrencyCodeForField({ record });
    const amount =
      formatCompactCurrency(record.amount, resolvedCurrencyCode) ||
      formatCompactCurrency(record.value, resolvedCurrencyCode) ||
      formatCompactCurrency(record.totalValue, resolvedCurrencyCode);
    const parts = [record.stage || record.status, amount].filter(Boolean);
    return parts.join(' • ');
  }

  if (type === 'form') {
    const parts = [record.formType || record.type, record.status].filter(Boolean);
    return parts.join(' • ');
  }

  if (type === 'project') {
    return record.status || '';
  }

  return '';
};

// Batch-enrich related records via POST /api/modules/:moduleKey/records/batch.
// Returns only records that exist; missing/inaccessible IDs are left as stubs (no 404s).
const BATCH_ENRICH_MODULES = ['events', 'deals', 'forms', 'people'];

const enrichRelatedRecords = async (moduleKey, rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (!BATCH_ENRICH_MODULES.includes(moduleKey)) return rows;

  const ids = rows.map((row) => getRelatedRecordId(row)).filter(Boolean);
  if (ids.length === 0) return rows;

  try {
    const res = await apiClient.post(`/modules/${moduleKey}/records/batch`, { ids });
    const data = res?.success && Array.isArray(res.data) ? res.data : [];
    const byId = new Map(data.map((r) => [String(r._id), r]));

    return rows.map((row) => {
      const id = getRelatedRecordId(row);
      const record = id ? byId.get(String(id)) : null;
      if (!record) return row;
      return { ...row, ...record, _id: id };
    });
  } catch {
    return rows;
  }
};

// Combined activity events (comments + timeline + email threads) sorted chronologically (oldest first, newest at bottom)
const combinedActivityEvents = computed(() => {
  const allEvents = [];
  const threadedCommunicationIds = new Set(
    (emailThreads.value || [])
      .flatMap((thread) => (thread.messages || []).map((msg) => String(msg?._id || '')))
      .filter(Boolean)
  );

  for (const ev of activityEvents.value) {
    if (ev.type === 'system' && ev.action === 'email_sent' && ev.details?.communicationId) {
      const commId = String(ev.details.communicationId || '');
      if (commId && threadedCommunicationIds.has(commId)) {
        continue; // Skip when this message is represented by a thread entry
      }
    }
    allEvents.push(ev);
  }

  // Add email thread entries
  for (const thread of (emailThreads.value || [])) {
    allEvents.push(normalizeEmailThreadActivityEvent({
      ...thread,
      recordRef: {
        module: 'tasks',
        id: String(task.value?._id || '')
      },
      source: 'integration'
    }));
  }

  return sortActivityEventsByDate(allEvents);
});

const getCommentEventId = (event) => {
  if (!event) return '';
  return String(event.id || event._id || '');
};

const getParentCommentId = (event) => {
  const rawParentId = event?.parentCommentId;
  if (!rawParentId) return '';
  if (typeof rawParentId === 'object') {
    return String(rawParentId._id || rawParentId.id || '');
  }
  return String(rawParentId);
};

const commentActivityEvents = computed(() => (
  combinedActivityEvents.value.filter((event) => event.type === 'comment')
));

const commentEventsById = computed(() => {
  const map = new Map();
  commentActivityEvents.value.forEach((event) => {
    const id = getCommentEventId(event);
    if (id) map.set(id, event);
  });
  return map;
});

const getThreadRootCommentId = (event) => {
  const eventId = getCommentEventId(event);
  if (!eventId) return '';
  let cursor = getParentCommentId(event) || eventId;
  const visited = new Set();

  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    const current = commentEventsById.value.get(cursor);
    if (!current) break;
    const parentId = getParentCommentId(current);
    if (!parentId) return cursor;
    cursor = parentId;
  }

  return getParentCommentId(event) || eventId;
};

const activeThreadRootComment = computed(() => {
  if (!activeThreadRootCommentId.value) return null;
  return commentEventsById.value.get(String(activeThreadRootCommentId.value)) || null;
});

const threadReplyEvents = computed(() => {
  if (!activeThreadRootCommentId.value) return [];
  const rootId = String(activeThreadRootCommentId.value);
  return commentActivityEvents.value
    .filter((event) => getParentCommentId(event) === rootId)
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });
});

const threadReplyCount = computed(() => threadReplyEvents.value.length);
const isThreadViewActive = computed(() => Boolean(activeThreadRootCommentId.value && activeThreadRootComment.value));

const commentThreadRepliesByRootId = computed(() => {
  const map = new Map();
  commentActivityEvents.value.forEach((event) => {
    const eventId = getCommentEventId(event);
    if (!eventId) return;
    const rootId = getThreadRootCommentId(event);
    if (!rootId || rootId === eventId) return;
    const bucket = map.get(rootId) || [];
    bucket.push(event);
    map.set(rootId, bucket);
  });

  map.forEach((events, rootId) => {
    events.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });
    map.set(rootId, events);
  });

  return map;
});

const getCommentThreadReplyCount = (event) => {
  const rootId = getCommentEventId(event);
  if (!rootId) return 0;
  return (commentThreadRepliesByRootId.value.get(rootId) || []).length;
};

const getCommentThreadLatestReplyAuthor = (event) => {
  const rootId = getCommentEventId(event);
  if (!rootId) return null;
  const replies = commentThreadRepliesByRootId.value.get(rootId) || [];
  const latestReply = replies[replies.length - 1];
  return latestReply?.author || null;
};

// Filtered activity events based on selected activity types (Comments and/or Updates; both selected by default)
const filteredActivityEvents = computed(() => {
  const events = combinedActivityEvents.value;
  const showComments = activityFilterComments.value;
  const showUpdates = activityFilterUpdates.value;
  const showEmail = activityFilterEmail.value;
  if (!showComments && !showUpdates && !showEmail) return [];

  const q = (activitySearchQuery.value || '').trim().toLowerCase();

  // If there's an active search query, show only comments and filter by content/author
  if (q) {
    return events.filter(e => {
      if (e.type === 'comment' && !getParentCommentId(e)) {
        const text = ((e.content || e.text || '') + ' ' + (e.author && (typeof e.author === 'string' ? e.author : (e.author.firstName || e.author.first_name || e.author.lastName || e.author.last_name || e.author.username || e.author.email || '')))).toLowerCase();
        return text.indexOf(q) !== -1;
      }
      return false; // hide system events when searching
    });
  }

  // No search query: filter by the activity type toggles
  return events.filter(e =>
    ((e.type === 'comment' && !getParentCommentId(e)) && showComments) ||
    (e.type === 'system' && showUpdates) ||
    (e.type === 'email_thread' && showEmail)
  );
});

const activityTimelineEvents = computed(() => {
  if (!isThreadViewActive.value || !activeThreadRootComment.value) {
    return filteredActivityEvents.value;
  }
  return [activeThreadRootComment.value, ...threadReplyEvents.value];
});

// Persist activity filter so it survives reload
watch([activityFilterComments, activityFilterUpdates, activityFilterEmail, activityFilterDoneThreads, activityFilterAssignedToMe, activityFilterTagged, activityFilterUntagged], ([comments, updates, email, doneThreads, assignedToMe, tagged, untagged]) => {
  try {
    localStorage.setItem(ACTIVITY_FILTER_STORAGE_KEY, JSON.stringify({ comments, updates, email, doneThreads, assignedToMe, tagged, untagged }));
  } catch (_) {}
});

watch(activeThreadRootComment, (threadRoot) => {
  if (!activeThreadRootCommentId.value) return;
  if (threadRoot) return;
  activeThreadRootCommentId.value = null;
});

const canViewDocuments = computed(() => authStore.can?.('documents', 'view') ?? false);
const canCreateDocuments = computed(() => authStore.can?.('documents', 'create') ?? false);
const canEditDocuments = computed(() => authStore.can?.('documents', 'edit') ?? false);
const showRecordDocumentsTab = computed(
  () => supportsDocumentAttachments('tasks') && canViewDocuments.value && !!task.value?._id
);

const rightPaneTabs = computed(() => {
  const tabs = [
    { id: 'activity', name: t('records.genericTabActivity'), icon: ClockIcon },
    { id: 'related', name: t('records.taskRelatedRecordsTab'), icon: LinkIcon }
  ];
  if (showRecordDocumentsTab.value) {
    tabs.push({ id: 'documents', name: t('records.genericTabDocuments'), icon: DocumentDuplicateIcon });
  }
  tabs.push(
    { id: 'details', name: t('records.detailsTitle'), icon: Bars3BottomLeftIcon },
    { id: 'integrations', name: t('records.genericIntegrations'), icon: PuzzlePieceIcon }
  );
  return tabs;
});

const taskDetailsPaneContext = computed(() => ({
  expandedLeftSection: '',
  module: 'task',
  moduleKey: 'tasks',
  openTab,
  fieldContext: resolveFieldContext(route.path, route.query),
  hideHeader: true
}));

const taskDetailsPaneAdapter = computed(() => {
  if (!task.value?._id || !taskModuleDefinition.value) return null;
  return createGenericRecordAdapter({
    sectionLabels: createRecordSectionLabels(t),
    formatDate: (d) =>
      (d ? formatUserDate(d) : '—'),
    moduleDefinition: taskModuleDefinition.value,
    canEditDetails: () => canEditTask.value,
    saveDetailField: (fieldKey, value) => handleFieldSave(fieldKey, value),
    getEntityOptions: (fieldKey) => {
      const key = String(fieldKey || '').toLowerCase().trim();
      if (
        key === 'assignedto' ||
        key === 'ownerid' ||
        key === 'createdby' ||
        key === 'updatedby' ||
        key === 'modifiedby'
      ) {
        return users.value;
      }
      return [];
    }
  });
});

const contextRelatedGroups = computed(() => {
  const groups = [];
  if (task.value?.projectId) {
    groups.push({ key: 'project', label: t('records.taskRelatedGroupProject'), count: 1 });
  }
  if (taskPeople.value && taskPeople.value.length > 0) {
    groups.push({ key: 'people', label: t('records.taskRelatedGroupPeople'), count: taskPeople.value.length });
  }
  if (taskEvents.value && taskEvents.value.length > 0) {
    groups.push({ key: 'events', label: t('records.taskRelatedGroupEvents'), count: taskEvents.value.length });
  }
  if (taskDeals.value && taskDeals.value.length > 0) {
    groups.push({ key: 'deals', label: t('records.taskRelatedGroupDeals'), count: taskDeals.value.length });
  }
  if (taskForms.value && taskForms.value.length > 0) {
    groups.push({ key: 'forms', label: t('records.taskRelatedGroupForms'), count: taskForms.value.length });
  }
  return groups;
});

// Header navigation (prev/next task) – same pattern as DealRecordPage
const TASK_NAV_CONTEXT_STORAGE_PREFIX = 'arivu-task-nav-context:';
const taskNavigationContextToken = computed(() => String(route.query?.navCtx || '').trim());
const currentTaskNavigationId = computed(() => String(effectiveTaskId.value || task.value?._id || ''));
const currentTaskNavigationIndex = computed(() => {
  const currentId = currentTaskNavigationId.value;
  if (!currentId) return -1;
  return taskNavigationIds.value.findIndex((id) => id === currentId);
});
const previousTaskId = computed(() => {
  const index = currentTaskNavigationIndex.value;
  if (index <= 0) return '';
  return taskNavigationIds.value[index - 1] || '';
});
const nextTaskId = computed(() => {
  const index = currentTaskNavigationIndex.value;
  if (index < 0 || index >= taskNavigationIds.value.length - 1) return '';
  return taskNavigationIds.value[index + 1] || '';
});
const canNavigatePreviousTask = computed(() => Boolean(previousTaskId.value));
const canNavigateNextTask = computed(() => Boolean(nextTaskId.value));
const navShortcutPrev = computed(() =>
  typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent) ? '⌘+Left' : 'Ctrl+Left'
);
const navShortcutNext = computed(() =>
  typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent) ? '⌘+Right' : 'Ctrl+Right'
);

const fetchTaskNavigationIds = async () => {
  if (!effectiveTaskId.value || props.embed) {
    taskNavigationIds.value = [];
    return;
  }
  const currentId = String(effectiveTaskId.value);
  const navToken = taskNavigationContextToken.value;
  if (navToken) {
    try {
      const raw = sessionStorage.getItem(`${TASK_NAV_CONTEXT_STORAGE_PREFIX}${navToken}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        const contextIds = Array.isArray(parsed?.ids)
          ? parsed.ids.map((id) => String(id || '').trim()).filter(Boolean)
          : [];
        if (contextIds.includes(currentId)) {
          const existing = taskNavigationIds.value;
          if (Array.isArray(existing) && existing.length > 0 && existing.includes(currentId)) {
            return;
          }
          taskNavigationIds.value = contextIds;
          return;
        }
      }
    } catch {
      // ignore
    }
  }
  try {
    const response = await apiClient.get('/tasks', {
      params: {
        page: 1,
        limit: 500,
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      }
    });
    const rows = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response)
        ? response
        : [];
    const ids = rows
      .map((entry) => String(entry?._id || entry?.id || '').trim())
      .filter(Boolean);
    if (ids.includes(currentId)) {
      taskNavigationIds.value = ids;
      return;
    }
    taskNavigationIds.value = [currentId];
  } catch {
    taskNavigationIds.value = [currentId];
  }
};

const navigateToTaskById = (taskId) => {
  const targetId = String(taskId || '').trim();
  if (!targetId) return;
  const navToken = taskNavigationContextToken.value;
  const path = navToken
    ? `/tasks/${targetId}?navCtx=${encodeURIComponent(navToken)}`
    : `/tasks/${targetId}`;
  replaceActiveTab(path, { title: taskModuleLabel.value });
};

const goToPreviousTask = () => {
  if (!canNavigatePreviousTask.value) return;
  navigateToTaskById(previousTaskId.value);
};

const goToNextTask = () => {
  if (!canNavigateNextTask.value) return;
  navigateToTaskById(nextTaskId.value);
};

const handleHeaderKeydown = (e) => {
  if (e.repeat) return;
  const ctrlOrMeta = e.ctrlKey || e.metaKey;
  if (!ctrlOrMeta) return;
  // Only the visible task record page should handle: with keep-alive, multiple instances can have listeners.
  const myId = String(effectiveTaskId.value || '');
  if (!myId) return;
  const tab = findTabById(activeTabId.value);
  const pathShowsMe = tab?.path && tab.path.includes(myId);
  const routeShowsMe = route.params.id === myId;
  if (!pathShowsMe && !routeShowsMe) return;
  const tag = document.activeElement?.tagName?.toLowerCase();
  const isEditable =
    tag === 'input' ||
    tag === 'textarea' ||
    document.activeElement?.getAttribute?.('contenteditable') === 'true';
  if (isEditable) return;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    goToPreviousTask();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    goToNextTask();
  }
};

// Fetch task data
/** When task.relatedTo has type+id but no display name, fetch the record and set relatedTo.name so details show name instead of raw id */
const resolveRelatedToDisplayName = async () => {
  const t = task.value;
  if (!t?.relatedTo) return;
  const rt = t.relatedTo;
  if (rt.type === 'none' || !rt.id) return;
  if (rt.name) return;
  if (rt.id && typeof rt.id === 'object' && (rt.id.name || rt.id.title)) return;
  const id = typeof rt.id === 'object' ? rt.id._id : rt.id;
  if (!id) return;
  const endpoints = {
    contact: (id) => apiClient.get(`/people/${id}`),
    deal: (id) => apiClient.get(`/deals/${id}`),
    organization: (id) => apiClient.get(`/v2/organization/${id}`),
    project: (id) => apiClient.get(`/projects/${id}`)
  };
  const fetchFn = endpoints[rt.type];
  if (!fetchFn) return;
  try {
    const res = await fetchFn(id);
    const data = res?.data?.data ?? res?.data;
    const name = data?.name || data?.title || (data?.first_name && data?.last_name ? `${data.first_name} ${data.last_name}`.trim() : null) || data?.email;
    if (name && task.value?.relatedTo) {
      task.value.relatedTo = { ...task.value.relatedTo, name };
    }
  } catch {
    // non-fatal
  }
};

const fetchTask = async (options = {}) => {
  const id = effectiveTaskId.value;
  if (!id) return;
  await runWithLoading(async () => {
    const response = await apiClient(`/tasks/${id}`);
    if (!response?.success) return;

    task.value = response.data;
    recordRecordDetailFingerprint('tasks', effectiveTaskId.value, '', {
      updatedAtMs: extractRecordUpdatedAtMs(task.value),
    });
    await Promise.all([
      fetchRelatedRecords(),
      fetchActivityEvents(),
      fetchCustomFields(),
      fetchUsers(),
      fetchTaskNavigationIds()
    ]);
    await resolveRelatedToDisplayName();
  }, 'Failed to load task', options);
};

useArivuDataChangeRefresh({
  getModuleKey: () => 'tasks',
  getRecordId: () => String(effectiveTaskId.value || task.value?._id || ''),
  onChange: (detail) => {
    if (detail?.patch && typeof detail.patch === 'object' && task.value) {
      Object.assign(task.value, detail.patch);
    }
    void fetchTask({ soft: true });
  },
});

const TASK_RELATIONSHIP_CONTEXTS = [
  { appKey: 'platform', moduleKey: 'tasks' },
  { appKey: 'sales', moduleKey: 'tasks' },
  { appKey: 'crm', moduleKey: 'tasks' }
];

async function fetchTaskRelationshipBundle(appKey, moduleKey, recordId) {
  const [linksRes, contextRes] = await Promise.all([
    apiClient.get('/relationships/links', {
      params: { appKey, moduleKey, recordId }
    }).catch(() => null),
    apiClient.get('/relationships/record-context', {
      params: { appKey, moduleKey, recordId }
    }).catch(() => null)
  ]);

  const links = linksRes?.success && Array.isArray(linksRes.data) ? linksRes.data : [];
  const contextRelationships = contextRes?.success && Array.isArray(contextRes.data?.relationships)
    ? contextRes.data.relationships
    : [];

  return { links, contextRelationships };
}

const fetchRelatedRecords = async () => {
  if (!task.value) return;
  try {
    const recordId = task.value._id;
    let links = [];
    let contextRelationships = [];

    for (const candidate of TASK_RELATIONSHIP_CONTEXTS) {
      const bundle = await fetchTaskRelationshipBundle(
        candidate.appKey,
        candidate.moduleKey,
        recordId
      );
      links = links.concat(bundle.links);
      contextRelationships = contextRelationships.concat(bundle.contextRelationships);
      if (bundle.links.length > 0 || bundle.contextRelationships.length > 0) {
        break;
      }
    }

    const toRow = (record) => {
      const id = record?.recordId || record?.id || record?._id;
      if (!id) return null;
      return {
        ...record,
        _id: id
      };
    };

    const collectFromLinksByKeys = (...keys) => {
      const keySet = new Set(keys.map(k => String(k).toLowerCase()));
      const rows = [];
      links.forEach((link) => {
        const relKey = String(link?.relationshipKey || '').toLowerCase();
        const moduleKey = String(link?.relatedRecord?.moduleKey || '').toLowerCase();
        if (!keySet.has(relKey) && !keySet.has(moduleKey)) return;
        const row = toRow(link?.relatedRecord);
        if (row) rows.push(row);
      });
      return rows;
    };

    const collectFromContextByKeys = (...keys) => {
      const keySet = new Set(keys.map(k => String(k).toLowerCase()));
      const rows = [];
      contextRelationships.forEach((rel) => {
        const relKey = String(rel?.relationshipKey || '').toLowerCase();
        const targetKey = String(rel?.target?.moduleKey || '').toLowerCase();
        if (!keySet.has(relKey) && !keySet.has(targetKey)) return;
        (rel.records || []).forEach((rec) => {
          const row = toRow(rec);
          if (row) rows.push(row);
        });
      });
      return rows;
    };

    const dedupeRows = (rows) => {
      const seen = new Set();
      return rows.filter((row) => {
        const key = String(row._id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const rawEvents = dedupeRows([
      ...collectFromLinksByKeys('events', 'event'),
      ...collectFromContextByKeys('events', 'event')
    ]);
    const rawPeople = dedupeRows([
      ...collectFromLinksByKeys('people', 'person', 'contact', 'tasks_people', 'people_tasks'),
      ...collectFromContextByKeys('people', 'person', 'contact', 'tasks_people', 'people_tasks')
    ]);
    const rawDeals = dedupeRows([
      ...collectFromLinksByKeys('deals', 'deal', 'task_deals'),
      ...collectFromContextByKeys('deals', 'deal', 'task_deals')
    ]);
    const rawForms = dedupeRows([
      ...collectFromLinksByKeys('forms', 'form'),
      ...collectFromContextByKeys('forms', 'form')
    ]);

    const relatedTo = getNormalizedRelatedTo(task.value);
    if (relatedTo.type !== 'none' && relatedTo.id) {
      const relatedToId = String(relatedTo.id);
      const relatedToName = task.value?.relatedTo?.name || null;
      const pushRelatedToFallback = (rows) => {
        if (rows.some((row) => String(row._id) === relatedToId)) return rows;
        return [...rows, relatedToName ? { _id: relatedToId, name: relatedToName } : { _id: relatedToId }];
      };

      if (relatedTo.type === 'deal') {
        rawDeals.splice(0, rawDeals.length, ...pushRelatedToFallback(rawDeals));
      } else if (relatedTo.type === 'contact') {
        rawPeople.splice(0, rawPeople.length, ...pushRelatedToFallback(rawPeople));
      }
    }

    const [enrichedEvents, enrichedPeople, enrichedDeals, enrichedForms] = await Promise.all([
      enrichRelatedRecords('events', rawEvents),
      enrichRelatedRecords('people', rawPeople),
      enrichRelatedRecords('deals', rawDeals),
      enrichRelatedRecords('forms', rawForms)
    ]);

    taskEvents.value = enrichedEvents;
    taskPeople.value = enrichedPeople;
    taskDeals.value = enrichedDeals;
    taskForms.value = enrichedForms;
  } catch (err) {
    taskEvents.value = [];
    taskPeople.value = [];
    taskDeals.value = [];
    taskForms.value = [];
    console.error('Error fetching related records:', err);
  }
};

const fetchActivityEvents = async () => {
  if (!task.value) return;
  
  const events = [];
  
  // Fetch activity logs (system events)
  try {
    const response = await apiClient(`/tasks/${task.value._id}/activity-logs`);
    if (response.success && response.data) {
      // Convert activity logs to activity events format
      const systemEvents = response.data.map((log) => {
        const baseMessage = formatActivityLog(log);
        let descriptionDiffHtml = null;
        let descriptionImageChanges = [];
        let message = baseMessage;
        if (isDescriptionActivityFieldChange(log.action, log.details)) {
          const fromValue = log.details.from ?? log.details.oldValue ?? '';
          const toValue = log.details.to ?? log.details.newValue ?? '';
          const descriptionDiff = buildDescriptionActivityDiff(fromValue, toValue);
          message = `${resolveActorLabel(log.user, log.userId)} changed description`;
          descriptionDiffHtml = descriptionDiff.diffHtml;
          descriptionImageChanges = descriptionDiff.imageChanges;
        }
        return normalizeSystemActivityEvent(log, {
          message,
          descriptionDiffHtml,
          descriptionImageChanges,
          recordRef: {
            module: 'tasks',
            id: String(task.value?._id || '')
          },
          source: log?.user || log?.userId ? 'user' : 'system'
        });
      });
      events.push(...systemEvents);
    }
  } catch (err) {
    // If 404, fall through to generate from task metadata
    if (err.status !== 404 && !err.is404) {
      console.error('Error fetching activity logs:', err);
    }
  }
  
  // If no activity logs found, generate from task metadata
  if (events.length === 0) {
    const generatedEvents = generateUpdateLogsFromTask();
    events.push(...generatedEvents);
  }
  
  // Fetch comments
  try {
    const commentsResponse = await apiClient(`/tasks/${task.value._id}/comments`);
    if (commentsResponse.success && Array.isArray(commentsResponse.data)) {
      const commentEvents = commentsResponse.data.map((comment) => normalizeCommentActivityEvent({
        ...comment,
        recordRef: {
          module: 'tasks',
          id: String(task.value?._id || '')
        }
      }));
      events.push(...commentEvents);
    }
  } catch (err) {
    // Comments endpoint might not exist yet, that's okay
    if (err.status !== 404 && !err.is404) {
      console.error('Error fetching comments:', err);
    }
  }
  
  // Sort all events by date (oldest first, newest at bottom)
  activityEvents.value = sortActivityEventsByDate(events);

  // Fetch email threads for this task
  try {
    const threadsRes = await apiClient.get('/communications/threads', {
      params: { moduleKey: 'tasks', recordId: task.value._id, includeDone: true }
    });
    if (threadsRes?.success && threadsRes.data?.threads?.length) {
      emailThreads.value = threadsRes.data.threads;
    } else {
      emailThreads.value = [];
    }
  } catch {
    emailThreads.value = [];
  }
};

const generateUpdateLogsFromTask = () => {
  if (!task.value) return [];
  
  const events = [];
  
  // Task created
  if (task.value.createdAt) {
    const createdBy = task.value.createdBy;

    events.push(normalizeSystemActivityEvent({
      _id: `task_created_${task.value._id || ''}`,
      action: 'created',
      user: createdBy || 'System',
      userId: typeof createdBy === 'object' ? createdBy?._id : null,
      timestamp: task.value.createdAt,
      details: {}
    }, {
      message: 'created this task',
      recordRef: {
        module: 'tasks',
        id: String(task.value?._id || '')
      },
      source: createdBy ? 'user' : 'system'
    }));
  }
  
  // Task updated (if updatedAt differs from createdAt)
  if (task.value.updatedAt && 
      new Date(task.value.updatedAt).getTime() !== new Date(task.value.createdAt).getTime()) {
    events.push(normalizeSystemActivityEvent({
      _id: `task_updated_${task.value._id || ''}`,
      action: 'updated',
      timestamp: task.value.updatedAt,
      details: {}
    }, {
      message: 'updated this task',
      recordRef: {
        module: 'tasks',
        id: String(task.value?._id || '')
      },
      source: 'system'
    }));
  }
  
  // Status changes (if completed)
  if (task.value.status === 'completed' && task.value.completedDate) {
    events.push(normalizeSystemActivityEvent({
      _id: `task_completed_${task.value._id || ''}`,
      action: 'status_changed',
      timestamp: task.value.completedDate,
      details: { status: 'completed' }
    }, {
      message: 'marked this task as completed',
      recordRef: {
        module: 'tasks',
        id: String(task.value?._id || '')
      },
      source: 'system'
    }));
  }
  
  return events;
};

const getCurrentUserId = () => String(authStore.user?._id || authStore.user?.id || '');

const isCurrentUserById = (value) => {
  const currentUserId = getCurrentUserId();
  if (!currentUserId || !value) return false;

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value) === currentUserId;
  }

  if (typeof value === 'object') {
    const id = value._id || value.id;
    return id ? String(id) === currentUserId : false;
  }

  return false;
};

const isCurrentUserByName = (value) => {
  const candidate = String(value || '').trim().toLowerCase();
  if (!candidate) return false;
  const firstName = authStore.user?.firstName || authStore.user?.first_name || '';
  const lastName = authStore.user?.lastName || authStore.user?.last_name || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim().toLowerCase();
  const username = String(authStore.user?.username || '').trim().toLowerCase();
  const email = String(authStore.user?.email || '').trim().toLowerCase();
  return Boolean(candidate && (candidate === fullName || candidate === username || candidate === email));
};

const resolveActorLabel = (name, userId) => {
  if (isCurrentUserById(userId) || isCurrentUserByName(name)) return 'You';
  return name || 'System';
};

const isFieldChangeSystemEvent = (event) => {
  if (!event || event.type !== 'system') return false;
  return event.action === 'field_changed' || event.action === 'status_changed';
};

const getSystemEventActorLabel = (event) => {
  if (!event) return 'System';
  const author = event.author;
  if (author && typeof author === 'object') {
    return resolveActorLabel(getUserDisplayName(author), author._id || author.id);
  }
  if (typeof author === 'string') {
    return resolveActorLabel(author, event.userId || event.user);
  }
  return 'System';
};

const getSystemEventFieldLabel = (event) => {
  const details = event?.details || {};
  const raw = details.fieldLabel ?? details.field;
  const label = String(raw ?? '').trim();
  return label || 'field';
};

const formatSystemEventValue = (value, event) => {
  if (value === undefined || value === null || value === '') return keyFieldsEmptyLabel.value;
  const details = event?.details || {};
  const fieldKey = String(details.field || '').trim();
  const fields = taskModuleDefinition.value?.fields || [];
  const match = fieldKey
    ? fields.find((f) => String(f?.key || '') === fieldKey || String(f?.label || '') === fieldKey)
    : null;
  return formatActivityChangeValue(value, keyFieldsEmptyLabel.value, match?.dataType);
};

const getSystemEventFromValue = (event) => formatSystemEventValue(event?.details?.from ?? event?.details?.oldValue, event);
const getSystemEventToValue = (event) => formatSystemEventValue(event?.details?.to ?? event?.details?.newValue, event);

const formatActivityLog = (log) => {
  if (!log) return 'Activity logged';
  const action = log.action || 'updated';
  const user = resolveActorLabel(log.user, log.userId);
  const details = log.details || {};

  const normalizeDisplayValue = (value) => {
    if (value === undefined || value === null || value === '') return keyFieldsEmptyLabel.value;
    const fieldKey = String(details.field || '').trim();
    const fields = taskModuleDefinition.value?.fields || [];
    const match = fieldKey
      ? fields.find((f) => String(f?.key || '') === fieldKey || String(f?.label || '') === fieldKey)
      : null;
    return formatActivityChangeValue(value, keyFieldsEmptyLabel.value, match?.dataType);
  };

  const toFieldLabel = (value) => {
    if (!value) return 'field';
    return String(value).replace(/_/g, ' ');
  };

  if (action === 'field_changed' || action === 'status_changed') {
    const fieldLabel = details.fieldLabel || toFieldLabel(details.field);
    const fromValue = normalizeDisplayValue(details.from ?? details.oldValue);
    const toValue = normalizeDisplayValue(details.to ?? details.newValue);
    return `${user} changed ${fieldLabel} from ${fromValue} to ${toValue}`;
  }

  if (action === 'subtask_changed') {
    const title = details.title ? `"${details.title}"` : 'a subtask';
    const fromValue = normalizeDisplayValue(details.from);
    const toValue = normalizeDisplayValue(details.to);
    return `${user} changed ${title} from ${fromValue} to ${toValue}`;
  }

  if (action === 'record_linked') {
    const rawModuleKey = String(details.relatedModuleKey || details.moduleKey || '').toLowerCase();
    const moduleLabel = ({
      project: 'project',
      projects: 'project',
      event: 'event',
      events: 'event',
      deal: 'deal',
      deals: 'deal',
      form: 'form',
      forms: 'form'
    })[rawModuleKey] || 'record';
    const label = details.relatedRecordLabel && String(details.relatedRecordLabel).trim();
    const fallbackId = String(details.relatedRecordId || details.recordId || '').trim();
    const idSuffix = fallbackId ? ` (${fallbackId.slice(-8)})` : '';
    const recordPart = label ? ` "${label}"` : idSuffix;
    return `${user} linked a ${moduleLabel}${recordPart}`;
  }

  if (action === 'record_unlinked') {
    const rawModuleKey = String(details.relatedModuleKey || details.moduleKey || '').toLowerCase();
    const moduleLabel = ({
      project: 'project',
      projects: 'project',
      event: 'event',
      events: 'event',
      deal: 'deal',
      deals: 'deal',
      form: 'form',
      forms: 'form'
    })[rawModuleKey] || 'record';
    const label = details.relatedRecordLabel && String(details.relatedRecordLabel).trim();
    const fallbackId = String(details.relatedRecordId || details.recordId || '').trim();
    const idSuffix = fallbackId ? ` (${fallbackId.slice(-8)})` : '';
    const recordPart = label ? ` "${label}"` : idSuffix;
    return `${user} unlinked a ${moduleLabel}${recordPart}`;
  }

  // Format legacy actions
  const actionMap = {
    created: 'created this task',
    updated: 'updated this task',
    assigned: `assigned to ${details.assignedTo || 'user'}`,
    commented: 'added a comment'
  };

  const actionText = actionMap[action] || action.replace(/_/g, ' ');
  return `${user} ${actionText}`;
};

const normalizeStatusOption = (option) => {
  if (typeof option === 'string') {
    const value = option.trim();
    if (!value) return null;
    const normalizedKey = value.toLowerCase().replace(/\s+/g, '_');
    return {
      value,
      label: formatStatus(value) || value,
      enabled: true,
      color: DEFAULT_TASK_STATUS_COLOR_MAP[normalizedKey] || null
    };
  }

  if (!option || typeof option !== 'object') return null;

  const value = String(option.value ?? option.key ?? option.id ?? '').trim();
  if (!value) return null;

  const label = String(option.label ?? option.name ?? formatStatus(value) ?? value).trim();
  const enabled = option.enabled !== false;
  const normalizedKey = value.toLowerCase().replace(/\s+/g, '_');
  const color = typeof option.color === 'string' && option.color.trim()
    ? option.color.trim()
    : (DEFAULT_TASK_STATUS_COLOR_MAP[normalizedKey] || null);

  return { value, label: label || value, enabled, color };
};

const normalizePriorityOption = (option) => {
  if (typeof option === 'string') {
    const value = option.trim();
    if (!value) return null;
    const normalizedKey = value.toLowerCase().replace(/\s+/g, '_');
    return {
      value,
      label: formatPriority(value) || value,
      enabled: true,
      color: DEFAULT_TASK_PRIORITY_COLOR_MAP[normalizedKey] || null
    };
  }

  if (!option || typeof option !== 'object') return null;

  const value = String(option.value ?? option.key ?? option.id ?? '').trim();
  if (!value) return null;

  const label = String(option.label ?? option.name ?? formatPriority(value) ?? value).trim();
  const enabled = option.enabled !== false;
  const normalizedKey = value.toLowerCase().replace(/\s+/g, '_');
  const color = typeof option.color === 'string' && option.color.trim()
    ? option.color.trim()
    : (DEFAULT_TASK_PRIORITY_COLOR_MAP[normalizedKey] || null);

  return { value, label: label || value, enabled, color };
};

const fetchTaskLifecycleFieldOptions = async () => {
  try {
    const tasksModule = await fetchModuleDefinitionCached('tasks');
    taskModuleDefinition.value = tasksModule || null;
    const taskFields = Array.isArray(tasksModule?.fields) ? tasksModule.fields : [];

    const statusField = taskFields.find(field => String(field?.key || '').toLowerCase() === 'status');
    const statusRawOptions = Array.isArray(statusField?.options) ? statusField.options : [];
    const priorityField = taskFields.find(field => String(field?.key || '').toLowerCase() === 'priority');
    const priorityRawOptions = Array.isArray(priorityField?.options) ? priorityField.options : [];

    const normalizedStatus = statusRawOptions
      .map(normalizeStatusOption)
      .filter(Boolean);

    const normalizedPriority = priorityRawOptions
      .map(normalizePriorityOption)
      .filter(Boolean);

    taskStatusFieldOptions.value = normalizedStatus;
    taskPriorityFieldOptions.value = normalizedPriority;
  } catch (err) {
    console.error('Error fetching task lifecycle field options:', err);
    taskModuleDefinition.value = null;
  }
};

const fetchCustomFields = async () => {
  if (!task.value) return;
  try {
    const response = await apiClient(`/tasks/${task.value._id}/custom-fields`);
    if (response.success) {
      customFields.value = response.data || [];
    }
  } catch (err) {
    // If 404, endpoint doesn't exist yet - that's okay, just use empty array
    if (err.status !== 404 && !err.is404) {
      console.error('Error fetching custom fields:', err);
    }
    customFields.value = [];
  }
};

const fetchUsers = async () => {
  try {
    const response = await apiClient.get('/users/list');
    if (response.success && Array.isArray(response.data)) {
      users.value = response.data;
    } else if (Array.isArray(response)) {
      users.value = response;
    } else {
      users.value = [];
    }
  } catch (err) {
    console.error('Error fetching users:', err);
    users.value = [];
  }
};

// Scroll activity feed (inside RecordActivityTimeline) to bottom (newest at bottom, chat-style)
// options.behavior: 'smooth' for tab open, 'auto' for new comment / data updates
const scrollActivityToBottom = (options = {}) => {
  const behavior = options.behavior ?? 'auto';
  nextTick(() => {
    const comp = activityTimelineRef.value;
    if (comp?.scrollToBottom) {
      comp.scrollToBottom({ behavior });
      return;
    }
    const feedEl = comp?.feedEl;
    const el = feedEl?.value ?? feedEl;
    if (!el) return;
    const top = el.scrollHeight;
    if (behavior === 'smooth') {
      el.scrollTo({ top, behavior: 'smooth' });
    } else {
      el.scrollTop = top;
    }
  });
};

const scrollActivityToTop = (options = {}) => {
  const behavior = options.behavior ?? 'auto';
  nextTick(() => {
    const feedEl = activityTimelineRef.value?.feedEl;
    const el = feedEl?.value ?? feedEl;
    if (!el) return;
    if (behavior === 'smooth') {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      el.scrollTop = 0;
    }
  });
};

const openCommentThread = (event) => {
  if (!event || event.type !== 'comment') return;
  const rootId = getThreadRootCommentId(event);
  if (!rootId) return;
  activeThreadRootCommentId.value = rootId;
  closeCommentReactionPicker();
  handleHideCommentReactionTooltip();
  nextTick(() => {
    scrollActivityToTop();
    activitySectionRef.value?.focusCommentInput?.();
  });
};

const closeCommentThread = () => {
  activeThreadRootCommentId.value = null;
  nextTick(() => {
    scrollActivityToBottom();
  });
};

// When Activity tab becomes visible: scroll feed to bottom without hiding the pane (avoids blank panel + layout shift)
watch(activityTimelineRef, (comp) => {
  if (!comp) return;
  nextTick(() => {
    const feedEl = comp.feedEl?.value ?? comp.feedEl;
    if (!feedEl) return;
    requestAnimationFrame(() => {
      feedEl.scrollTop = isThreadViewActive.value ? 0 : feedEl.scrollHeight;
    });
  });
}, { immediate: true });

const handleAddComment = async (payload) => {
  const content = typeof payload === 'string' ? payload.trim() : (payload?.content ?? '').trim();
  const files = typeof payload === 'object' && Array.isArray(payload?.files) ? payload.files : [];
  if (!task.value || (!content && files.length === 0)) return;
  try {
    const attachments = [];
    const token = authStore.user?.token;
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch(`/api/tasks/${task.value._id}/comment-attachments`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      if (uploadRes.ok) {
        const result = await uploadRes.json();
        if (result.success && result.url) {
          attachments.push({
            url: result.url,
            filename: result.originalname || file.name,
            size: result.size ?? file.size,
            mimetype: result.mimetype || file.type,
            documentId: result.documentId || undefined
          });
        }
      } else {
        const errData = await uploadRes.json().catch(() => ({}));
        console.error('Comment attachment upload failed:', uploadRes.status, errData.error || errData.message || uploadRes.statusText);
      }
    }
    const response = await apiClient.post(`/tasks/${task.value._id}/comments`, {
      content: content || 'Attached file(s)',
      attachments: attachments.length > 0 ? attachments : undefined,
      parentCommentId: isThreadViewActive.value ? activeThreadRootCommentId.value : undefined
    });
    if (response.success) {
      await fetchActivityEvents();
      scrollActivityToBottom();
    }
  } catch (err) {
    console.error('Error adding comment:', err);
  }
};

const canEditComment = (event) => {
  if (event.type !== 'comment') return false;
  const author = event.author || event.actor || event.payload?.author || event.payload?.actor;
  const authorId = author?._id || author?.id;
  return authorId && authStore.user?._id && String(authorId) === String(authStore.user._id);
};

const startEditComment = (event) => {
  editingCommentId.value = event.id;
  const initialText = event.content || event.text || '';
  const initialAttachments = Array.isArray(event.attachments)
    ? event.attachments.map((attachment) => ({ ...attachment }))
    : [];
  editingCommentText.value = initialText;
  editingCommentAttachments.value = initialAttachments;
  editingCommentOriginalText.value = initialText;
  editingCommentOriginalAttachments.value = initialAttachments.map((attachment) => ({ ...attachment }));
  editingCommentHasPendingFiles.value = false;
};

const cancelEditComment = () => {
  editingCommentId.value = null;
  editingCommentText.value = '';
  editingCommentAttachments.value = [];
  editingCommentOriginalText.value = '';
  editingCommentOriginalAttachments.value = [];
  editingCommentHasPendingFiles.value = false;
  editCommentInputRef.value = null;
};

const handleEditCommentFilesChange = (files) => {
  editingCommentHasPendingFiles.value = Array.isArray(files) && files.length > 0;
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

const isEditCommentSubmitPayload = (payload) => (
  Boolean(payload)
  && typeof payload === 'object'
  && (
    typeof payload.content === 'string'
    || Array.isArray(payload.files)
    || Array.isArray(payload.existingAttachments)
  )
);

const getEditCommentInputInstance = () => {
  const currentRef = editCommentInputRef.value;
  if (Array.isArray(currentRef)) return currentRef[0] || null;
  return currentRef || null;
};

const handleSaveEditCommentClick = () => {
  const payload = getEditCommentInputInstance()?.getSubmitPayload?.();
  saveEditComment(isEditCommentSubmitPayload(payload) ? payload : undefined);
};

const saveEditComment = async (submitPayload) => {
  if (!task.value || !editingCommentId.value) return;
  if (!isEditingCommentDirty.value) return;
  try {
    const fallbackPayload = getEditCommentInputInstance()?.getSubmitPayload?.();
    const resolvedPayload = isEditCommentSubmitPayload(submitPayload)
      ? submitPayload
      : (isEditCommentSubmitPayload(fallbackPayload) ? fallbackPayload : null);

    const rawContent = typeof resolvedPayload?.content === 'string'
      ? resolvedPayload.content
      : editingCommentText.value;
    const content = rawContent.trim();
    const files = Array.isArray(resolvedPayload?.files) ? resolvedPayload.files : [];
    const existingAttachments = Array.isArray(resolvedPayload?.existingAttachments)
      ? resolvedPayload.existingAttachments
      : editingCommentAttachments.value;

    const uploadedAttachments = [];
    const token = authStore.user?.token;
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch(`/api/tasks/${task.value._id}/comment-attachments`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      if (uploadRes.ok) {
        const result = await uploadRes.json();
        if (result.success && result.url) {
          uploadedAttachments.push({
            url: result.url,
            filename: result.originalname || file.name,
            size: result.size ?? file.size,
            mimetype: result.mimetype || file.type,
            documentId: result.documentId || undefined
          });
        }
      } else {
        const errData = await uploadRes.json().catch(() => ({}));
        console.error('Comment attachment upload failed:', uploadRes.status, errData.error || errData.message || uploadRes.statusText);
      }
    }

    const finalAttachments = [
      ...(Array.isArray(existingAttachments) ? existingAttachments : []),
      ...uploadedAttachments
    ].filter((attachment) => attachment && typeof attachment.url === 'string' && typeof attachment.filename === 'string');

    const finalContent = content || (finalAttachments.length > 0 ? 'Attached file(s)' : '');
    if (!finalContent) return;

    const response = await apiClient.put(
      `/tasks/${task.value._id}/comments/${editingCommentId.value}`,
      {
        content: finalContent,
        attachments: finalAttachments
      }
    );
    if (response.success) {
      await fetchActivityEvents();
      cancelEditComment();
    }
  } catch (err) {
    console.error('Error updating comment:', err);
  }
};

const handleShowMore = (event) => {
  // TODO: Implement show more functionality
  console.log('Show more for event:', event.id);
};

// Format helpers
const formatStatus = (status) => {
  if (!status) return null;
  const configured = findConfiguredStatusOption(status);
  if (configured?.label) return configured.label;
  const map = {
    todo: 'To Do',
    in_progress: 'In Progress',
    waiting: 'Waiting',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };
  return map[status] || status;
};

const getStatusPillClass = (status) => {
  const configured = findConfiguredStatusOption(status);
  if (configured?.color) return '';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-100';
};

const getStatusPillDividerClass = (status) => {
  const configured = findConfiguredStatusOption(status);
  if (configured?.color) return '';
  return 'border-gray-300 dark:border-gray-500';
};

const getStatusPillStyle = (status) => {
  const configured = findConfiguredStatusOption(status);
  if (!configured?.color) return null;
  return picklistChipStyle(configured.color);
};

const getStatusPillDividerStyle = (status) => {
  const configured = findConfiguredStatusOption(status);
  if (!configured?.color) return null;
  const style = picklistChipStyle(configured.color);
  return style.borderColor ? { borderColor: style.borderColor } : null;
};

const normalizeStatusLookupKey = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const findConfiguredStatusOption = (status) => {
  if (!status) return null;
  const raw = String(status).trim();
  if (!raw) return null;

  const options = statusSelectOptions.value || [];

  const exact = options.find(option => String(option?.value || '') === raw);
  if (exact) return exact;

  const normalizedRaw = normalizeStatusLookupKey(raw);
  if (!normalizedRaw) return null;

  return options.find(option => {
    const valueKey = normalizeStatusLookupKey(option?.value);
    const labelKey = normalizeStatusLookupKey(option?.label);
    return valueKey === normalizedRaw || labelKey === normalizedRaw;
  }) || null;
};

const formatPriority = (priority) => {
  if (!priority) return null;
  const configured = findConfiguredPriorityOption(priority);
  if (configured?.label) return configured.label;
  return priority.charAt(0).toUpperCase() + priority.slice(1);
};

const getPriorityTextClass = (priority) => {
  if (!priority) return 'text-record-empty';
  return 'text-gray-900 dark:text-white';
};

const getPriorityFlagStyle = (priority) => {
  if (!priority) return null;
  const configured = findConfiguredPriorityOption(priority);
  const normalizedKey = normalizeStatusLookupKey(priority);
  const color = configured?.color || DEFAULT_TASK_PRIORITY_COLOR_MAP[normalizedKey] || null;
  return color ? { color } : null;
};

const findConfiguredPriorityOption = (priority) => {
  if (!priority) return null;
  const raw = String(priority).trim();
  if (!raw) return null;

  const options = prioritySelectOptions.value || [];
  const exact = options.find(option => String(option?.value || '') === raw);
  if (exact) return exact;

  const normalizedRaw = normalizeStatusLookupKey(raw);
  if (!normalizedRaw) return null;

  return options.find(option => {
    const valueKey = normalizeStatusLookupKey(option?.value);
    const labelKey = normalizeStatusLookupKey(option?.label);
    return valueKey === normalizedRaw || labelKey === normalizedRaw;
  }) || null;
};

const formatDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  // Show relative time for recent items
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'min' : 'mins'}`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'}`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'}`;
  
  // Show full date with time for older items
  return formatUserDateTime(d);
};

const formatRelativeActivityTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();
  let diffSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSeconds < 0) diffSeconds = 0;

  const formatTimePart = (value) => formatTime(value, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const startOfDay = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

  if (diffSeconds < 60) return 'Just now';

  const mins = Math.floor(diffSeconds / 60);
  if (mins < 60) return `${mins} ${mins === 1 ? 'min' : 'mins'} ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ago`;

  const dayDiff = Math.floor((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86400000);

  if (dayDiff <= 0) {
    return `Today at ${formatTimePart(d)}`;
  }

  if (dayDiff === 1) {
    return `Yesterday at ${formatTimePart(d)}`;
  }

  if (dayDiff < 7) {
    const weekday = formatLocaleDate(d, { weekday: 'long' });
    return `${weekday} at ${formatTimePart(d)}`;
  }

  if (d.getFullYear() === now.getFullYear()) {
    const dayMonth = formatLocaleDate(d, { day: 'numeric', month: 'short' });
    return `${dayMonth} at ${formatTimePart(d)}`;
  }

  const dayMonthYear = formatLocaleDate(d, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${dayMonthYear} at ${formatTimePart(d)}`;
};

const formatFullTimestamp = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return formatUserDateTime(d);
};

const isTouchOrPenPointer = (event) => {
  if (event?.pointerType) {
    return event.pointerType === 'touch' || event.pointerType === 'pen';
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return true;
  }
  return (typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints || 0) > 0);
};

const openTimestampSheet = (date) => {
  const fullValue = formatFullTimestamp(date);
  if (!fullValue) return;
  timestampSheetValue.value = fullValue;
  showTimestampSheet.value = true;
};

const closeTimestampSheet = () => {
  showTimestampSheet.value = false;
  timestampSheetValue.value = '';
};

const handleTimestampPointerUp = (event, date) => {
  if (!isTouchOrPenPointer(event)) return;
  event?.preventDefault?.();
  event?.stopPropagation?.();
  openTimestampSheet(date);
};

const formatCreatedDate = (date) => {
  if (!date) return '';
  return formatUserDate(date);
};

const formatStateDate = (date) => {
  if (!date) return null;
  return formatUserDate(date) || null;
};

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const getAttachmentName = (attachment) => {
  if (!attachment) return 'Attachment';
  return attachment.name || attachment.filename || 'Attachment';
};

const getAttachmentUrl = (attachment) => {
  if (!attachment) return '#';
  return attachment.url || attachment.href || '#';
};

const hasAttachmentUrl = (attachment) => {
  const url = getAttachmentUrl(attachment);
  return Boolean(url && url !== '#');
};

const downloadAttachment = (attachment) => {
  const url = getAttachmentUrl(attachment);
  if (!url || url === '#') return;

  const link = document.createElement('a');
  link.href = url;
  link.download = getAttachmentName(attachment) || 'attachment';
  link.rel = 'noopener noreferrer';
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

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

const updateCommentEventReactions = (commentId, updatedComment) => {
  if (!commentId || !updatedComment) return;
  const commentIdString = String(commentId);
  activityEvents.value = activityEvents.value.map((event) => {
    if (event.type !== 'comment') return event;
    const eventId = String(event.id || event._id || '');
    if (eventId !== commentIdString) return event;

    return {
      ...event,
      reactions: updatedComment.reactions || updatedComment.reactionSummary || [],
      myReactions: Array.isArray(updatedComment.myReactions) ? updatedComment.myReactions : [],
      likesCount: updatedComment.likesCount ?? event.likesCount
    };
  });
};

const findCommentEventByKey = (commentKey) => (
  activityEvents.value.find((event) => {
    if (event?.type !== 'comment') return false;
    const key = event?.id || event?._id || event?.createdAt;
    return String(key || '') === String(commentKey || '');
  }) || null
);

const getCommentMyReactions = (event) => {
  return normalizeMyReactions(event?.myReactions || []);
};

const isCommentReactionSelected = (event, emoji) => {
  return isCommentReactionSelectedForUser({
    event,
    emoji,
    currentUserId: authStore.user?._id || authStore.user?.id || '',
    getCommentReactions
  });
};

const commentReactionApi = createCommentReactionApi({
  type: 'task',
  getTaskId: () => task.value?._id || ''
});

const { toggleCommentReaction } = useCommentReactionActions({
  getCommentId: (event) => getCommentEventId(event),
  normalizeEmoji: (emoji) => normalizeReactionEmoji(emoji),
  canToggle: () => Boolean(task.value?._id),
  requestToggle: ({ commentId, emoji }) => commentReactionApi.toggleReaction({ commentId, emoji }),
  onSuccess: ({ response, commentId }) => {
    if (response?.data) {
      updateCommentEventReactions(commentId, response.data);
    }
  },
  logPrefix: 'Error toggling comment reaction:'
});

const {
  commentReactionPickerRef,
  commentReactionPickerStyle,
  showCommentReactionPicker,
  isDarkTheme,
  emojiPickerTheme,
  emojiPickerColorScheme,
  setCommentReactionButtonRef,
  toggleCommentReactionPicker,
  updateCommentReactionPickerPosition,
  handleCommentReactionPickerOutsideClick,
  handleCommentReactionEmojiClick,
  closeCommentReactionPicker,
  startEmojiThemeObserver,
  stopEmojiThemeObserver,
  cleanupCommentReactionPicker
} = useCommentReactionPicker({
  findCommentEventByKey,
  isCommentReactionSelected,
  toggleCommentReaction
});

const getCommentReactions = (event) => {
  return buildCommentReactions(event, {
    includeLikesFallback: true,
    includeOnlyComments: true
  });
};

const hasCommentReactions = (event) => getCommentReactions(event).length > 0;

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const commentMentionsCurrentUser = (event) => {
  if (!event || event.type !== 'comment') return false;
  const content = String(event.content || event.text || '');
  if (!content) return false;

  const currentUserId = authStore.user?._id || authStore.user?.id;
  if (currentUserId) {
    const mentionByIdRegex = new RegExp(`@\\[[^\\]]+\\]\\(user:${escapeRegExp(currentUserId)}\\)`, 'i');
    if (mentionByIdRegex.test(content)) return true;
  }
  if (/@\[[^\]]+\]\(all:[^)]+\)/i.test(content)) return true;

  // Legacy fallback for plain-text mentions without encoded IDs.
  const candidateNames = [
    [authStore.user?.firstName, authStore.user?.lastName].filter(Boolean).join(' ').trim(),
    authStore.user?.name,
    authStore.user?.username
  ].filter(Boolean);

  const lowered = content.toLowerCase();
  return candidateNames.some((name) => lowered.includes(`@${String(name).toLowerCase()}`));
};

const isImageAttachment = (attachment) => {
  if (!attachment) return false;
  const mimeType = (attachment.mimetype || attachment.mimeType || '').toLowerCase();
  if (mimeType.startsWith('image/')) return true;
  const name = getAttachmentName(attachment).toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name);
};

const isSvgAttachment = (attachment) => {
  if (!attachment) return false;
  const mimeType = (attachment.mimetype || attachment.mimeType || '').toLowerCase();
  if (mimeType === 'image/svg+xml') return true;
  const name = getAttachmentName(attachment).toLowerCase();
  return name.endsWith('.svg');
};

const getAttachmentLabel = (attachment) => {
  if (!attachment) return '';
  const details = [];
  const mimeType = attachment.mimetype || attachment.mimeType;
  if (mimeType) {
    details.push(mimeType.startsWith('image/') ? 'Image' : mimeType.split('/')[1]?.toUpperCase() || 'File');
  }
  if (attachment.size) {
    details.push(formatFileSize(attachment.size));
  }
  return details.join(' • ') || 'File attachment';
};

const getInitials = (author) => {
  if (!author) return '?';
  if (typeof author === 'string') return author.substring(0, 2).toUpperCase();
  const firstName = author.firstName || author.first_name || '';
  const lastName = author.lastName || author.last_name || '';
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  if (author.email) return author.email[0].toUpperCase();
  return '?';
};

const getAuthorName = (author) => {
  if (!author) return 'Unknown';
  if (typeof author === 'string') return author;
  const firstName = author.firstName || author.first_name || '';
  const lastName = author.lastName || author.last_name || '';
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  if (author.username) return author.username;
  if (author.email) return author.email;
  return 'Unknown';
};

const formatSystemEvent = (event) => {
  if (event.action === 'created') {
    return `You created this task${event.source ? ` by copying ${event.source}` : ''}`;
  }
  return `${event.action || 'updated'} this record`;
};

const getSystemEventMessage = (event) => {
  if (!event) return 'Updated this record';
  const message = (event.message || '').trim();
  if (message) return message;
  return formatSystemEvent(event);
};

const getAssignedToDisplay = (assignedTo) => {
  if (!assignedTo) return null;
  if (typeof assignedTo === 'object') {
    return getUserDisplayName(assignedTo);
  }
  return null;
};

const getUserDisplayName = (user) => {
  if (!user) return null;
  const name = [user.firstName || user.first_name, user.lastName || user.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return name || user.username || user.email || user._id || 'Unknown';
};

const computeSignals = (task) => {
  if (!task) return [];
  const signals = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (task.dueDate && task.status !== 'completed') {
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    if (due < today) {
      signals.push('Overdue');
    } else if (due.getTime() === today.getTime()) {
      signals.push('Due today');
    }
  }
  
  if (!task.assignedTo) {
    signals.push('Unassigned');
  }
  
  return signals;
};

const getNextActionHint = (task) => {
  if (!task) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (task.dueDate && task.status !== 'completed') {
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    if (due < today) {
      return 'Complete or reschedule';
    }
  }
  return null;
};

const formatEventActor = (event) => {
  if (event.actor) {
    if (typeof event.actor === 'object') {
      return getUserDisplayName(event.actor) || 'System';
    }
    return event.actor;
  }
  return 'System';
};

const formatEventAction = (event) => {
  const action = event.action || event.type || 'updated';
  return action.replace(/_/g, ' ');
};

// Event handlers
const handleTitleSave = async (newTitle) => {
  if (!task.value || !canEditTask.value) return;
  
  try {
    const response = await apiClient.put(`/tasks/${task.value._id}`, {
      title: newTitle
    });
    
    if (response.success && response.data) {
      task.value.title = newTitle;
      notifyTaskListUpdated();
      // Optionally update tab title if needed
      // updateTabTitle(activeTabId.value, newTitle);
    }
  } catch (err) {
    console.error('Error updating task title:', err);
    // Revert to original title on error
    // The EditableTitle component will handle this via the prop update
  }
};

const handleFieldSave = async (fieldName, newValue) => {
  if (!task.value || !canEditTask.value) return;
  
  try {
    const updateData = { [fieldName]: newValue };
    const response = await apiClient.put(`/tasks/${task.value._id}`, updateData);
    
    if (response.success && response.data) {
      // Update local state
      if (fieldName === 'assignedTo') {
        // If newValue is a user ID, find the user object
        if (newValue && typeof newValue === 'string') {
          const user = users.value.find(u => u._id === newValue);
          task.value[fieldName] = user || newValue;
        } else {
          task.value[fieldName] = newValue;
        }
      } else {
        task.value[fieldName] = newValue;
      }
      // Keep customFields in sync when saving a custom field
      const cf = getCustomFieldByKey(fieldName);
      if (cf) {
        const idx = (customFields.value || []).findIndex(
          (f) => (f?.key || '').toLowerCase() === (fieldName || '').toLowerCase()
        );
        if (idx >= 0 && customFields.value) {
          customFields.value = [...customFields.value];
          customFields.value[idx] = { ...cf, value: newValue != null ? String(newValue) : '' };
        }
      }
      notifyTaskListUpdated();
      await fetchActivityEvents();
      runActivityScrollToBottom({ behavior: 'smooth' });
    }
  } catch (err) {
    console.error(`Error updating task ${fieldName}:`, err);
    // Refresh task data to revert changes
    await fetchTask();
  }
};

// Watch task description to update local description
watch(() => task.value?.description, (newDesc) => {
  if (!isEditingDescription.value) {
    localDescription.value = newDesc || '';
  }
  isDescriptionExpanded.value = false;
});

function runActivityScrollToBottom(options = {}) {
  const behavior = options.behavior ?? 'auto';
  const activeTab = rightPaneRef.value?.activeTab?.value;
  const hasContent = (activityEvents.value?.length ?? 0) > 0 || (emailThreads.value?.length ?? 0) > 0;
  if (activeTab !== 'activity' || !hasContent || !activityTimelineRef.value || isThreadViewActive.value) return;
  const run = () => {
    scrollActivityToBottom({ behavior });
    if (behavior === 'smooth') {
      setTimeout(() => scrollActivityToBottom({ behavior: 'smooth' }), 180);
      return;
    }
    setTimeout(() => scrollActivityToBottom({ behavior }), 150);
    setTimeout(() => scrollActivityToBottom({ behavior }), 400);
  };
  nextTick(() => {
    requestAnimationFrame(() => requestAnimationFrame(run));
  });
}

// Initialize local description
watch(() => task.value, (newTask) => {
  if (newTask) {
    localDescription.value = newTask.description || '';
    resetSectionState();
    isDescriptionExpanded.value = false;
    expandedLeftSection.value = null;
  }
}, { immediate: true });

const startEditDescription = () => {
  const el = descriptionDisplayRef.value;
  descriptionMinHeight.value = el?.offsetHeight ?? null;
  isEditingDescription.value = true;
};

const handleDescriptionBlur = async () => {
  if (!isEditingDescription.value) return;

  const trimmedDescription = localDescription.value.trim();
  const originalDescription = task.value?.description || '';

  // Optimistic update: show new content immediately, then save in background
  if (trimmedDescription !== originalDescription) {
    task.value.description = trimmedDescription;
  }
  isEditingDescription.value = false;
  descriptionMinHeight.value = null;

  if (trimmedDescription !== originalDescription) {
    await handleFieldSave('description', trimmedDescription);
  } else {
    localDescription.value = originalDescription;
  }
};

const handleDescriptionCancel = () => {
  isEditingDescription.value = false;
  descriptionMinHeight.value = null;
  localDescription.value = task.value?.description || '';
};

// Focus textarea when editing starts
watch(isEditingDescription, async (isEditing) => {
  if (isEditing) {
    await nextTick();
    if (descriptionEditorRef.value) {
      descriptionEditorRef.value.focus();
    }
  }
});

// Initialize RecordStateSection editable fields
watch(() => task.value, (newTask) => {
  if (newTask) {
    localTimeEstimate.value = newTask.estimatedHours || 0;
    
    // Initialize dates
    if (newTask.startDate) {
      const startDate = new Date(newTask.startDate);
      localStartDate.value = startDate.toISOString().split('T')[0];
    } else {
      localStartDate.value = '';
    }
    if (newTask.dueDate) {
      const dueDate = new Date(newTask.dueDate);
      localDueDate.value = dueDate.toISOString().split('T')[0];
    } else {
      localDueDate.value = '';
    }
  }
}, { immediate: true });

// Handlers for RecordStateSection editable fields
const toIsoDateString = (dateValue) => {
  if (!dateValue) return null;
  return new Date(`${dateValue}T00:00:00`).toISOString();
};

const resetLocalStartDate = () => {
  if (task.value?.startDate) {
    localStartDate.value = new Date(task.value.startDate).toISOString().split('T')[0];
  } else {
    localStartDate.value = '';
  }
};

const resetLocalDueDate = () => {
  if (task.value?.dueDate) {
    localDueDate.value = new Date(task.value.dueDate).toISOString().split('T')[0];
  } else {
    localDueDate.value = '';
  }
};

const handleStartDateBlur = async () => {
  if (!isEditingStartDate.value) return;
  isEditingStartDate.value = false;

  const startDateISO = toIsoDateString(localStartDate.value);
  if (startDateISO !== (task.value?.startDate || null)) {
    await handleFieldSave('startDate', startDateISO);
  } else {
    resetLocalStartDate();
  }
};

const handleStartDateCancel = () => {
  isEditingStartDate.value = false;
  resetLocalStartDate();
};

const handleDueDateBlur = async () => {
  if (!isEditingDueDate.value) return;
  isEditingDueDate.value = false;

  const dueDateISO = toIsoDateString(localDueDate.value);
  if (dueDateISO !== (task.value?.dueDate || null)) {
    await handleFieldSave('dueDate', dueDateISO);
  } else {
    resetLocalDueDate();
  }
};

const handleDueDateCancel = () => {
  isEditingDueDate.value = false;
  resetLocalDueDate();
};

const handleTimeEstimateBlur = async () => {
  if (!isEditingTimeEstimate.value) return;
  isEditingTimeEstimate.value = false;
  const newValue = localTimeEstimate.value || 0;
  if (newValue !== (task.value?.estimatedHours || 0)) {
    await handleFieldSave('estimatedHours', newValue);
  } else {
    localTimeEstimate.value = task.value?.estimatedHours || 0;
  }
};

const handleTimeEstimateCancel = () => {
  isEditingTimeEstimate.value = false;
  localTimeEstimate.value = task.value?.estimatedHours || 0;
};

watch(isEditingTimeEstimate, async (isEditing) => {
  if (isEditing) {
    await nextTick();
    if (timeEstimateInputRef.value) {
      timeEstimateInputRef.value.focus();
      timeEstimateInputRef.value.select();
    }
  }
});

const handleMarkComplete = async () => {
  if (!task.value || task.value.status === 'completed') return;
  try {
    await apiClient.patch(`/tasks/${task.value._id}/status`, { status: 'completed' });
    task.value.status = 'completed';
    task.value.completedDate = new Date().toISOString();
    notifyTaskListUpdated();
    await fetchActivityEvents();
  } catch (err) {
    console.error('Error marking complete:', err);
  }
};

const handleSubtaskToggle = async (subtask) => {
  if (!task.value) return;
  try {
    await apiClient.patch(`/tasks/${task.value._id}/subtasks/${subtask._id}`, {
      completed: !subtask.completed
    });
    subtask.completed = !subtask.completed;
  } catch (err) {
    console.error('Error toggling subtask:', err);
    subtask.completed = !subtask.completed; // Revert on error
  }
};

const startCreateSubtask = () => {
  setShowAllSubtasks(true);
  isCreatingSubtask.value = true;
};

const cancelCreateSubtask = () => {
  isCreatingSubtask.value = false;
  newSubtaskTitle.value = '';
  isSavingNewSubtask.value = false;
};

const saveNewSubtask = async () => {
  if (!task.value || isSavingNewSubtask.value) return;
  const title = newSubtaskTitle.value.trim();
  if (!title) return;

  isSavingNewSubtask.value = true;
  try {
    const existingSubtasks = Array.isArray(task.value.subtasks) ? task.value.subtasks : [];
    const normalizedSubtasks = existingSubtasks
      .filter((subtask) => subtask && typeof subtask.title === 'string' && subtask.title.trim())
      .map((subtask) => ({
        ...(subtask._id ? { _id: subtask._id } : {}),
        title: subtask.title,
        completed: Boolean(subtask.completed)
      }));

    const response = await apiClient.put(`/tasks/${task.value._id}`, {
      subtasks: [
        ...normalizedSubtasks,
        { title, completed: false }
      ]
    });

    if (response?.success && response.data) {
      task.value = response.data;
      await fetchActivityEvents();
      cancelCreateSubtask();
    }
  } catch (err) {
    console.error('Error creating subtask:', err);
  } finally {
    isSavingNewSubtask.value = false;
  }
};

const handleUpdateSubtaskTitle = async (subtaskToUpdate, nextTitleRaw) => {
  if (!task.value || !canEditTask.value) return;

  const nextTitle = String(nextTitleRaw || '').trim();
  if (!nextTitle) return;

  const existingSubtasks = Array.isArray(task.value.subtasks) ? task.value.subtasks : [];
  const targetId = String(subtaskToUpdate?._id || subtaskToUpdate?.id || '').trim();
  const targetTitle = String(subtaskToUpdate?.title || '').trim();
  let didUpdate = false;

  const normalizedSubtasks = existingSubtasks
    .filter((subtask) => subtask && typeof subtask.title === 'string' && subtask.title.trim())
    .map((subtask) => {
      const matchesTarget = targetId
        ? String(subtask._id || '') === targetId
        : (!didUpdate && (subtask === subtaskToUpdate
          || (String(subtask.title || '').trim() === targetTitle && Boolean(subtask.completed) === Boolean(subtaskToUpdate?.completed))));

      if (matchesTarget && !didUpdate) {
        didUpdate = true;
      }

      return {
        ...(subtask._id ? { _id: subtask._id } : {}),
        title: matchesTarget && !didUpdate ? nextTitle : (matchesTarget ? nextTitle : subtask.title),
        completed: Boolean(subtask.completed)
      };
    });

  if (!didUpdate) return;

  try {
    const response = await apiClient.put(`/tasks/${task.value._id}`, {
      subtasks: normalizedSubtasks
    });

    if (response?.success && response.data) {
      task.value = response.data;
      await fetchActivityEvents();
    }
  } catch (err) {
    console.error('Error updating subtask title:', err);
  }
};

const handleDeleteSubtask = async (subtaskToDelete) => {
  if (!task.value || !canEditTask.value || isDeletingSubtask.value) return;

  const existingSubtasks = Array.isArray(task.value.subtasks) ? task.value.subtasks : [];
  const targetId = String(subtaskToDelete?._id || '').trim();
  const targetTitle = String(subtaskToDelete?.title || '').trim();

  const nextSubtasksRaw = existingSubtasks.filter((subtask) => {
    if (!subtask) return false;
    if (targetId) {
      return String(subtask._id || '') !== targetId;
    }
    if (subtask === subtaskToDelete) return false;
    return String(subtask.title || '').trim() !== targetTitle || Boolean(subtask.completed) !== Boolean(subtaskToDelete?.completed);
  });

  const normalizedSubtasks = nextSubtasksRaw
    .filter((subtask) => subtask && typeof subtask.title === 'string' && subtask.title.trim())
    .map((subtask) => ({
      ...(subtask._id ? { _id: subtask._id } : {}),
      title: subtask.title,
      completed: Boolean(subtask.completed)
    }));

  isDeletingSubtask.value = true;
  deletingSubtaskId.value = targetId;
  try {
    const response = await apiClient.put(`/tasks/${task.value._id}`, {
      subtasks: normalizedSubtasks
    });

    if (response?.success && response.data) {
      task.value = response.data;
      await fetchActivityEvents();
    }
  } catch (err) {
    console.error('Error deleting subtask:', err);
  } finally {
    isDeletingSubtask.value = false;
    deletingSubtaskId.value = '';
  }
};

const handleOpenRelated = (type, id) => {
  const routes = {
    project: `/projects/${id}`,
    people: `/people/${id}`,
    event: `/events/${id}`,
    deal: `/deals/${id}`,
    form: `/forms/${id}`
  };
  if (routes[type]) {
    router.push(routes[type]);
  }
};

const handleUnlinkRelated = async (type, record) => {
  if (!task.value?._id) return;

  try {
    if (type === 'project') {
      const response = await apiClient.put(`/tasks/${task.value._id}`, { projectId: null });
      if (response?.success && response.data) {
        task.value = response.data;
        notifyTaskListUpdated();
      }
      await fetchRelatedRecords();
      return;
    }

    const moduleKey = ({
      people: 'people',
      event: 'events',
      deal: 'deals',
      form: 'forms'
    })[type];

    if (!moduleKey) return;

    const targetRecordId = getRelatedRecordId(record);
    if (!targetRecordId) return;

    const targetAppKeyByModule = {
      people: 'sales',
      events: 'platform',
      deals: 'sales',
      forms: 'platform'
    };

    await apiClient.post('/relationships/unlink', {
      relationshipKey: moduleKey,
      source: {
        appKey: 'platform',
        moduleKey: 'tasks',
        recordId: task.value._id
      },
      target: {
        appKey: targetAppKeyByModule[moduleKey],
        moduleKey,
        recordId: targetRecordId
      }
    });

    await fetchRelatedRecords();
  } catch (err) {
    console.error('Error unlinking related record:', err);
    notifications.error(t('records.genericUnlinkFailed'));
  }
};

// Handle linking records from the right-side Link Record drawer (same pattern as Link Organization)
const handleLinkRecordDrawerLinked = async ({ moduleKey, ids, context, relationshipKey: payloadRelationshipKey, targetAppKey: payloadTargetAppKey }) => {
  if (!task.value || !context?.taskId || task.value._id !== context.taskId) return;
  if (!ids?.length) return;

  try {
    const normalizedModuleKey = ({
      project: 'projects',
      people: 'people',
      deal: 'deals',
      event: 'events',
      form: 'forms'
    })[moduleKey] || moduleKey;

    // Refresh related cache first, then skip records already linked for this module.
    await fetchRelatedRecords();

    const existingIdsByModule = {
      projects: new Set(task.value?.projectId ? [String(typeof task.value.projectId === 'object' ? task.value.projectId._id : task.value.projectId)] : []),
      people: new Set((taskPeople.value || []).map(person => String(person?._id || person?.recordId || person?.id)).filter(Boolean)),
      events: new Set((taskEvents.value || []).map(event => String(event?._id || event?.recordId || event?.id)).filter(Boolean)),
      deals: new Set((taskDeals.value || []).map(deal => String(deal?._id || deal?.recordId || deal?.id)).filter(Boolean)),
      forms: new Set((taskForms.value || []).map(form => String(form?._id || form?.recordId || form?.id)).filter(Boolean))
    };

    const existingIds = existingIdsByModule[normalizedModuleKey] || new Set();
    const idsToLink = ids.filter(id => !existingIds.has(String(id)));

    if (idsToLink.length === 0) {
      closeLinkRecordDrawer();
      return;
    }

    if (normalizedModuleKey === 'projects') {
      // Task has a single project; use first selected id
      const response = await apiClient.put(`/tasks/${task.value._id}`, { projectId: idsToLink[0] });
      if (response.success && response.data) {
        Object.assign(task.value, response.data);
        notifyTaskListUpdated();
      }
    } else if (payloadRelationshipKey && payloadTargetAppKey) {
      for (const recordId of idsToLink) {
        try {
          if (normalizedModuleKey === 'documents') {
            const linkRes = await apiClient.post(`/documents/${recordId}/link`, {
              moduleKey: 'tasks',
              recordId: String(task.value._id),
              appKey: 'PLATFORM'
            });
            if (!linkRes?.success) {
              throw new Error(linkRes?.message || 'Failed to link document');
            }
            continue;
          }

          await apiClient.post('/relationships/link', {
            relationshipKey: payloadRelationshipKey,
            source: {
              appKey: 'platform',
              moduleKey: 'tasks',
              recordId: task.value._id
            },
            target: {
              appKey: payloadTargetAppKey,
              moduleKey: normalizedModuleKey,
              recordId
            }
          });
        } catch (linkErr) {
          if (linkErr?.status === 409) continue; // already linked
          throw linkErr;
        }
      }
    } else {
      // Fallback when drawer does not provide relationshipKey/targetAppKey (e.g. legacy recordTypes)
      const targetAppKeyByModule = {
        events: 'platform',
        deals: 'sales',
        forms: 'platform',
        documents: 'platform'
      };
      const targetAppKey = targetAppKeyByModule[normalizedModuleKey];
      const relationshipKey = payloadRelationshipKey
        || (normalizedModuleKey === 'documents' ? 'task_documents' : normalizedModuleKey);
      if (targetAppKey) {
        for (const recordId of idsToLink) {
          try {
            if (normalizedModuleKey === 'documents') {
              const linkRes = await apiClient.post(`/documents/${recordId}/link`, {
                moduleKey: 'tasks',
                recordId: String(task.value._id),
                appKey: 'PLATFORM'
              });
              if (!linkRes?.success) {
                throw new Error(linkRes?.message || 'Failed to link document');
              }
              continue;
            }

            await apiClient.post('/relationships/link', {
              relationshipKey,
              source: {
                appKey: 'platform',
                moduleKey: 'tasks',
                recordId: task.value._id
              },
              target: {
                appKey: targetAppKey,
                moduleKey: normalizedModuleKey,
                recordId
              }
            });
          } catch (linkErr) {
            if (linkErr?.status === 409) continue;
            throw linkErr;
          }
        }
      } else {
        console.warn(`Unknown module type from drawer: ${normalizedModuleKey}`);
        return;
      }
    }
    await fetchRelatedRecords();
    closeLinkRecordDrawer();
  } catch (err) {
    console.error('Error linking record:', err);
    notifications.error(t('records.taskLinkModuleFailed', { moduleKey }));
  }
};

const handleLinkRecordDrawerCreate = (payload = {}) => {
  const moduleKey = String(payload?.moduleKey || '').toLowerCase().trim();
  if (!moduleKey) return;
  pendingAddRelatedLinkPayload.value = payload;
  addRelatedRecordModuleKey.value = moduleKey;
  closeLinkRecordDrawer();
  showAddRelatedRecordDrawer.value = true;
};

const handleAddRelatedRecordSaved = async (savedRecord) => {
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
    targetAppKey: payload.targetAppKey || undefined
  });
};

const {
  isFollowing,
  showDeleteModal,
  deleting,
  handleClose,
  handleToggleFollow,
  handleCopyUrl,
  handleDuplicate,
  handleExport,
  handleDelete,
  confirmDeleteRecord: confirmDeleteTask
} = useRecordHeaderActions({
  recordRef: task,
  closeRoute: '/tasks',
  router,
  onCopySuccess: () => notifications.success(t('records.taskCopyUrlSuccess')),
  toggleFollow: async (_record, current) => !current,
  duplicate: async (record) => {
    if (!record) return;
    duplicateSourceId.value = String(record._id || record.id || '');
    duplicateInitialData.value = buildDuplicateInitialData(record, { moduleKey: 'tasks' });
    showDuplicateCreateModal.value = true;
  },
  exportConfig: (record, helpers) => {
    const assignedTo = record.assignedTo ? getUserDisplayName(record.assignedTo) : '';
    const tags = Array.isArray(record.tags) ? record.tags.join(', ') : '';
    const safeId = record._id ? String(record._id).slice(-8) : 'task';

    return {
      headers: [
        'id',
        'title',
        'description',
        'status',
        'priority',
        'start_date',
        'due_date',
        'completed_date',
        'assigned_to',
        'tags',
        'estimated_hours',
        'actual_hours',
        'created_at',
        'updated_at'
      ],
      row: [
        record._id || '',
        record.title || '',
        record.description || '',
        record.status || '',
        record.priority || '',
        helpers.formatExportDate(record.startDate),
        helpers.formatExportDate(record.dueDate),
        helpers.formatExportDate(record.completedDate),
        assignedTo,
        tags,
        record.estimatedHours ?? '',
        record.actualHours ?? '',
        helpers.formatExportDate(record.createdAt),
        helpers.formatExportDate(record.updatedAt)
      ],
      filename: `task_${safeId}_${new Date().toISOString().split('T')[0]}.csv`
    };
  },
  deleteRecord: async (record) => {
    await apiClient.delete(`/tasks/${record._id}`);
    router.push('/tasks');
  }
});

const canDiscussInChat = computed(() => (
  isAddonEntitled(authStore.user, 'internal_chat')
  && Boolean(task.value?._id)
));

async function handleDiscussInChat() {
  try {
    await openRecordDiscussChat({
      moduleKey: 'tasks',
      recordId: task.value?._id,
      openTab,
      router,
      tabTitle: t('navigation.internalChat'),
    });
  } catch (err) {
    notifications.error(err?.response?.data?.message || t('internalChat.discussFailed'));
  }
}

const { goBackToModuleList } = useRecordModuleBack();

const taskStarAriaLabel = computed(() => (
  isFollowing.value ? t('records.taskUnstarAria') : t('records.taskStarAria')
));

function getTaskPageUrl() {
  if (!task.value?._id) return '';
  const path = `/tasks/${task.value._id}`;
  const resolved = router.resolve(path);
  return resolved.href.startsWith('http') ? resolved.href : new URL(resolved.href, window.location.origin).href;
}

function openTaskInNewTab() {
  if (!task.value?._id) return;
  const path = `/tasks/${task.value._id}`;
  openTab(path, { title: taskModuleLabel.value, background: false, insertAdjacent: true });
  handleEmbedClose();
}

async function copyTaskUrl() {
  const url = getTaskPageUrl();
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    notifications.success(t('records.taskCopyUrlSuccess'));
  } catch (err) {
    console.error('Error copying URL:', err);
  }
}

const handleTaskEditSaved = async () => {
  showEditDrawer.value = false;
  await fetchTask();
};

const handleEmailSubmit = async (payload) => {
  showEmailModal.value = false;
  emailComposeDraft.value = null;
  try {
    const res = await apiClient.post('/communications/email', payload);
    if (res.success) {
      notifications.success(t('records.genericEmailSent'));
      await fetchTask();
    } else {
      notifications.error(res.message || t('records.genericEmailSendFailed'));
    }
  } catch (err) {
    const msg = err.response?.data?.error || err.response?.data?.message || err.message;
    notifications.error(msg || t('records.genericEmailSendFailed'));
  }
};

const handleReplyToEmailMessage = (payload) => {
  emailComposeDraft.value = payload && typeof payload === 'object' ? payload : null;
  showEmailModal.value = true;
};

const handleToggleThreadDone = async ({ threadId, done }) => {
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
};

const stripHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]+>/g, '').trim().slice(0, 200) || '(no content)';
};

const toggleTaskEmailThread = async (threadId) => {
  const next = new Set(expandedTaskEmailThreads.value);
  if (next.has(threadId)) {
    next.delete(threadId);
  } else {
    next.add(threadId);
    const thread = emailThreads.value?.find((t) => t.threadId === threadId);
    if (thread?.unread) {
      try {
        await apiClient.patch(`/communications/threads/${encodeURIComponent(threadId)}/view`, {});
        emailThreads.value = emailThreads.value.map((t) =>
          t.threadId === threadId ? { ...t, unread: false } : t
        );
      } catch {
        // Non-critical
      }
    }
  }
  expandedTaskEmailThreads.value = next;
};

const createTaskFromEmailMessage = async (msg) => {
  if (!msg?._id) return;
  try {
    const res = await apiClient.post(`/communications/${msg._id}/create-task`, {});
    if (res?.success && res?.data?.taskId) {
      window.open(`/tasks/${res.data.taskId}`, '_blank');
    }
  } catch (err) {
    notifications.error(err.response?.data?.message || err.message || t('records.dealCreateTaskFailed'));
  }
};

const createCaseFromEmailMessage = async (msg) => {
  if (!msg?._id) return;
  try {
    const res = await apiClient.post(`/communications/${msg._id}/create-case`, {});
    if (res?.success && res?.data?.caseRecordId) {
      window.open(`/helpdesk/cases/${res.data.caseRecordId}`, '_blank');
    }
  } catch (err) {
    notifications.error(err.response?.data?.message || err.message || t('records.dealCreateCaseFailed'));
  }
};

const assignEmailThread = async ({ threadId, assignedToUserId }) => {
  if (!threadId) return;
  try {
    const res = await apiClient.patch(`/communications/threads/${encodeURIComponent(threadId)}/assign`, {
      assignedToUserId: assignedToUserId || null
    });
    const nextAssignee = res?.data?.data?.assignedToUserId ?? assignedToUserId ?? null;
    const meId = authStore.user?._id || authStore.user?.id;
    const meLabel = `${authStore.user?.firstName || ''} ${authStore.user?.lastName || ''}`.trim() || authStore.user?.username || authStore.user?.email || null;
    emailThreads.value = (emailThreads.value || []).map((thread) => {
      if (thread.threadId !== threadId) return thread;
      const isMe = nextAssignee && meId && String(nextAssignee) === String(meId);
      return { ...thread, assignedToUserId: nextAssignee, assignedToDisplay: isMe ? meLabel : (thread.assignedToDisplay || null) };
    });
    notifications.success(nextAssignee ? t('records.genericThreadAssigned') : t('records.genericThreadUnassigned'));
  } catch (err) {
    notifications.error(err.response?.data?.message || err.message || t('records.genericThreadAssignFailed'));
  }
};

const unassignEmailThread = async ({ threadId }) => {
  if (!threadId) return;
  try {
    const res = await apiClient.patch(`/communications/threads/${encodeURIComponent(threadId)}/assign`, {
      assignedToUserId: null
    });
    const nextAssignee = res?.data?.data?.assignedToUserId ?? null;
    emailThreads.value = (emailThreads.value || []).map((thread) => (
      thread.threadId === threadId ? { ...thread, assignedToUserId: nextAssignee, assignedToDisplay: null } : thread
    ));
    notifications.success(t('records.genericThreadUnassigned'));
  } catch (err) {
    notifications.error(err.response?.data?.message || err.message || t('records.genericThreadUnassignFailed'));
  }
};

const addTagToEmailThread = async ({ threadId, tag }) => {
  if (!threadId) return;
  if (!tag || !String(tag).trim()) return;
  try {
    const res = await apiClient.patch(`/communications/threads/${encodeURIComponent(threadId)}/tags`, {
      action: 'add',
      tag
    });
    const nextTags = Array.isArray(res?.data?.data?.tags) ? res.data.data.tags : [];
    emailThreads.value = (emailThreads.value || []).map((thread) => (
      thread.threadId === threadId ? { ...thread, tags: nextTags } : thread
    ));
    notifications.success(t('records.genericTagAdded'));
  } catch (err) {
    notifications.error(err.response?.data?.message || err.message || t('records.genericTagAddFailed'));
  }
};

const removeTagFromEmailThread = async ({ threadId, tag }) => {
  if (!threadId || !tag) return;
  try {
    const res = await apiClient.patch(`/communications/threads/${encodeURIComponent(threadId)}/tags`, {
      action: 'remove',
      tag
    });
    const nextTags = Array.isArray(res?.data?.data?.tags) ? res.data.data.tags : [];
    emailThreads.value = (emailThreads.value || []).map((thread) => (
      thread.threadId === threadId ? { ...thread, tags: nextTags } : thread
    ));
    notifications.success(t('records.genericTagRemoved'));
  } catch (err) {
    notifications.error(err.response?.data?.message || err.message || t('records.genericTagRemoveFailed'));
  }
};

watch(() => task.value?._id, (taskId) => {
  if (!taskId) return;
  rightRelatedModuleOpen.value = { ...RIGHT_RELATED_DEFAULT_OPEN_STATE };
  loadRightRelatedAccordionState();
}, { immediate: true });

watch(rightRelatedModuleOpen, () => {
  if (!task.value?._id) return;
  persistRightRelatedAccordionState();
}, { deep: true });

watch(loading, (isLoading) => {
  if (isLoading) return;
  attachStickyTitleWhenReady();
});

useRecordPageLifecycle({
  route,
  recordId: effectiveTaskId,
  embed: () => props.embed,
  routePrefix: '/tasks',
  freshness: {
    moduleKey: 'tasks',
    getUpdatedAtMs: () => extractRecordUpdatedAtMs(task.value),
  },
  fetchRecord: fetchTask,
  embedRecordIdSource: () => props.taskId,
  contentReadySources: [() => activityEvents.value, () => emailThreads.value],
  onContentReady: () => {
    if (isThreadViewActive.value || !activityTimelineRef.value) return;
    scrollActivityToBottom();
  },
  onReactivated: () => {
    runActivityScrollToBottom();
  },
  onRouteReturn: () => {
    runActivityScrollToBottom();
  },
  onActivated: () => {
    nextTick(() => {
      if (!attachStickyTitle()) resetStickyTitle();
    });
  },
  onMount: [
    fetchTaskLifecycleFieldOptions,
    () => document.addEventListener('keydown', handleHeaderKeydown),
    () => {
      startEmojiThemeObserver();
      window.addEventListener('scroll', updateCommentReactionPickerPosition, true);
      window.addEventListener('scroll', updateCommentReactionTooltipPosition, true);
      window.addEventListener('scroll', updateTagPopoverPosition, true);
      window.addEventListener('scroll', updateRelatedToPopoverPosition, true);
      window.addEventListener('resize', updateCommentReactionPickerPosition);
      window.addEventListener('resize', updateCommentReactionTooltipPosition);
      window.addEventListener('resize', updateTagPopoverPosition);
      window.addEventListener('resize', updateRelatedToPopoverPosition);
      document.addEventListener('click', handleCommentReactionPickerOutsideClick);
      document.addEventListener('mousedown', handleTagPopoverMousedown);
      document.addEventListener('click', handleTagPopoverOutsideClick);
      document.addEventListener('click', handleRelatedToPopoverOutsideClick);
    }
  ],
  onUnmounted: [
    () => document.removeEventListener('keydown', handleHeaderKeydown),
    () => {
      cleanupCommentReactionTooltip();
      detachStickyTitle();
      window.removeEventListener('scroll', updateCommentReactionPickerPosition, true);
      window.removeEventListener('scroll', updateCommentReactionTooltipPosition, true);
      window.removeEventListener('scroll', updateTagPopoverPosition, true);
      window.removeEventListener('scroll', updateRelatedToPopoverPosition, true);
      window.removeEventListener('resize', updateCommentReactionPickerPosition);
      window.removeEventListener('resize', updateCommentReactionTooltipPosition);
      window.removeEventListener('resize', updateTagPopoverPosition);
      window.removeEventListener('resize', updateRelatedToPopoverPosition);
      document.removeEventListener('click', handleCommentReactionPickerOutsideClick);
      document.removeEventListener('mousedown', handleTagPopoverMousedown);
      document.removeEventListener('click', handleTagPopoverOutsideClick);
      document.removeEventListener('click', handleRelatedToPopoverOutsideClick);
      cleanupCommentReactionPicker();
      stopEmojiThemeObserver();
    }
  ]
});

// Keep tab title in sync with task title when task loads or title changes.
// Only update when the tab's path actually contains this task id – never update the list tab (/tasks).
// This prevents the list tab being renamed when the record tab is closed (race: activeTabId switches before route updates).
watch(
  () => [activeTabId.value, task.value?._id, task.value?.title],
  ([tabId, taskId, title]) => {
    if (!tabId || !taskId) return;
    const tab = findTabById(tabId);
    if (!tab || !tab.path) return;
    const pathBase = tab.path.split('?')[0].replace(/\/$/, '');
    if (pathBase === '/tasks') return; // list tab – never overwrite with record name
    if (!tab.path.includes(String(taskId))) return; // only update the tab that shows this record
    const displayTitle = String(title ?? taskModuleLabel.value).trim() || taskModuleLabel.value;
    updateTabTitle(tabId, displayTitle);
  },
  { immediate: true }
);

// Activity search helpers (use functions so template expressions don't access `.value` directly)
const closeActivitySearch = () => {
  activitySearchQuery.value = '';
};

const clearActivitySearch = () => {
  activitySearchQuery.value = '';
  nextTick(() => {
    if (activitySearchInputRef.value) activitySearchInputRef.value.focus();
  });
};

const setActivityTimelineRef = createActivityTimelineRefSetter(activityTimelineRef);

// Highlight search text within content
const highlightSearchText = (text) => {
  if (!text) return '';
  const q = (activitySearchQuery.value || '').trim();
  if (!q) return text;
  
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 font-semibold">$1</mark>');
};

const setEditingCommentText = (value) => {
  editingCommentText.value = value;
};

const setEditingCommentAttachments = (value) => {
  editingCommentAttachments.value = Array.isArray(value) ? value : [];
};

const taskActivityUi = createTaskActivityUi({
  authStore,
  expandedTaskEmailThreads,
  editingCommentId,
  editingCommentText,
  editingCommentAttachments,
  isEditingCommentDirty,
  setEditingCommentText,
  setEditingCommentAttachments,
  handleEditCommentFilesChange,
  saveEditComment,
  handleSaveEditCommentClick,
  cancelEditComment,
  canEditComment,
  startEditComment,
  getInitials,
  getAuthorName,
  formatFullTimestamp,
  formatRelativeActivityTime,
  handleTimestampPointerUp,
  highlightSearchText,
  commentMentionsCurrentUser,
  hasAttachmentUrl,
  getAttachmentUrl,
  isImageAttachment,
  isSvgAttachment,
  getAttachmentName,
  downloadAttachment,
  formatFileSize,
  getAttachmentLabel,
  hasCommentReactions,
  getCommentReactions,
  isCommentReactionSelected,
  toggleCommentReaction,
  handleShowCommentReactionTooltip,
  handleHideCommentReactionTooltip,
  setCommentReactionButtonRef,
  toggleCommentReactionPicker,
  openCommentThread,
  getCommentThreadReplyCount,
  getCommentThreadLatestReplyAuthor,
  isFieldChangeSystemEvent,
  getSystemEventActorLabel,
  getSystemEventFieldLabel,
  getSystemEventFromValue,
  getSystemEventToValue,
  getSystemEventMessage,
  handleShowMore,
  toggleTaskEmailThread,
  createTaskFromEmailMessage,
  createCaseFromEmailMessage,
  assignEmailThread,
  unassignEmailThread,
  addTagToEmailThread,
  removeTagFromEmailThread,
  handleReplyToEmailMessage,
  handleToggleThreadDone,
  getTagChipClass: getTaskTagChipClass
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

