<template>
  <div ref="dealRecordPageRootRef" class="deal-record-page-root flex-1 min-h-0 overflow-hidden flex flex-col">
    <RecordPageShell
      :loading="loading"
      :error="error"
      :loading-message="dealLoadingMessage"
      :error-title="dealErrorTitle"
      :layout-props="{
        leftExpanded: !!expandedLeftSection,
        forceMobile: props.embed,
        class: [
          props.embed ? 'flex-1 min-h-0 overflow-hidden flex flex-col' : '',
          { 'record-page-layout--left-expanded': !!expandedLeftSection },
          '[&.record-page-layout--left-expanded_.record-page-layout__right]:hidden',
          '[&.record-page-layout--left-expanded_.record-page-layout__left]:flex-[1_1_100%] [&.record-page-layout--left-expanded_.record-page-layout__left]:max-w-full [&.record-page-layout--left-expanded_.record-page-layout__left]:pr-0 [&.record-page-layout--left-expanded_.record-page-layout__left]:min-h-0 [&.record-page-layout--left-expanded_.record-page-layout__left]:overflow-hidden',
          '[&.record-page-layout--left-expanded_.record-page-layout__left-content]:max-w-full [&.record-page-layout--left-expanded_.record-page-layout__left-content]:pl-0 [&.record-page-layout--left-expanded_.record-page-layout__left-content]:pr-0 [&.record-page-layout--left-expanded_.record-page-layout__left-content]:flex [&.record-page-layout--left-expanded_.record-page-layout__left-content]:flex-col [&.record-page-layout--left-expanded_.record-page-layout__left-content]:flex-1 [&.record-page-layout--left-expanded_.record-page-layout__left-content]:min-h-0',
          '[&.record-page-layout--left-expanded_.record-page-layout__body]:px-4'
        ]
      }"
      @retry="fetchDeal"
    >
      <!-- No RecordHeader in embed (quick preview): drawer shows prev/next + close only; header would fix to viewport and show as extra over the list -->
      <template v-if="deal && !props.embed" #header>
        <RecordHeader
          :show-navigation="true"
          :show-back="true"
          :can-previous="canNavigatePreviousDeal"
          :can-next="canNavigateNextDeal"
          :previous-label="dealNavPreviousLabel"
          :next-label="dealNavNextLabel"
          :shortcut-prev="navShortcutPrev"
          :shortcut-next="navShortcutNext"
          @back="goBackToModuleList"
          @previous="goToPreviousDeal"
          @next="goToNextDeal"
        >
          <template #breadcrumbs>
            <span class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 min-w-0">
              <button
                type="button"
                class="shrink-0 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                :aria-label="t('records.genericBackTo', { singular: dealModuleLabel })"
                :title="t('records.genericBackTo', { singular: dealModuleLabel })"
                @click="goBackToModuleList"
              >
                {{ dealModuleLabel }}
              </button>
              <span class="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 shrink-0"></span>
              <span class="truncate">{{ deal?._id?.slice(-8) || 'N/A' }}</span>
            </span>
          </template>

          <template #pageActions>
            <RecordPresenceAvatars
              v-if="showRecordPresenceAvatars"
              :sessions="recordPresenceOthers"
            />
            <button
              type="button"
              class="hidden lg:inline-flex p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('records.dealEmailContact')"
              :title="t('records.dealEmailContact')"
              @click="showEmailModal = true"
            >
              <EnvelopeIcon class="w-5 h-5" />
            </button>
            <button
              type="button"
              class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('records.dealEditAria')"
              :title="t('records.dealEditAria')"
              @click="showEditModal = true"
            >
              <PencilSquareIcon class="w-5 h-5" />
            </button>
            <button
              type="button"
              ref="tagHeaderButtonRef"
              @click="handleTagIconClick($event)"
              :class="[
                'relative inline-flex items-center justify-center p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                hasDealTags
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              ]"
              :aria-label="t('records.genericTagsAria')"
              :title="t('records.genericTagsAria')"
            >
              <TagIcon class="block w-5 h-5" />
              <span
                v-if="hasDealTags"
                class="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400"
              ></span>
            </button>
            <button
              type="button"
              class="hidden lg:inline-flex p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('records.genericCopyUrl')"
              :title="t('records.genericCopyUrl')"
              @click="handleCopyUrl"
            >
              <ClipboardDocumentIcon class="w-5 h-5" />
            </button>
            <RecordPrintButton
              v-if="deal?._id"
              hide-on-mobile
              module-key="deals"
              :record-id="String(deal._id)"
            />
            <button
              type="button"
              :class="[
                'hidden lg:inline-flex p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                isFollowing ? 'text-yellow-500 dark:text-yellow-400' : ''
              ]"
              :aria-label="dealStarAriaLabel"
              :title="dealStarAriaLabel"
              @click="isFollowing = !isFollowing"
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
                <MenuItems class="absolute right-0 top-full mt-2 w-48 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 z-50">
                  <MenuItem v-slot="{ active }">
                    <button
                      type="button"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150 lg:hidden',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                      @click="handleCopyUrl"
                    >
                      {{ t('records.genericCopyUrl') }}
                    </button>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <button
                      @click="handleDuplicate"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                    >
                      {{ t('actions.duplicate') }}
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
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                    >
                      {{ t('actions.export') }}
                    </button>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <button
                      @click="showEmailModal = true"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                    >
                      {{ t('records.dealEmailContact') }}
                    </button>
                  </MenuItem>
                  <hr class="my-1 border-gray-200 dark:border-gray-700" />
                  <MenuItem v-slot="{ active }">
                    <button
                      @click="showDeleteModal = true"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-red-600 dark:text-red-400'
                      ]"
                    >
                      {{ t('actions.delete') }}
                    </button>
                  </MenuItem>
                </MenuItems>
              </transition>
            </Menu>
          </template>
        </RecordHeader>
      </template>

      <template v-if="deal" #left>
        <RecordAiPanel
          v-if="deal?._id && aiSuiteEntitled"
          module-key="deals"
          source-type="deal"
          :record-id="String(deal._id)"
        />
        <div
          v-if="expandedLeftSection"
          :class="[
            'flex-shrink-0 mb-4 sticky z-20 bg-white/95 dark:bg-gray-900/95 supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:dark:bg-gray-900/90 backdrop-blur',
            props.embed ? 'top-0' : 'top-0 lg:-top-6'
          ]"
        >
            <div class="flex items-center justify-between gap-2 py-2">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                @click="closeExpandedLeftSection"
              >
                <ArrowLeftIcon class="h-4 w-4" />
                <span>{{ t('records.dealBackTo') }}</span>
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

          <div
            v-if="deal && expandedLeftSection === 'description-history'"
            class="description-history-page flex-1 min-h-0 mt-4 flex flex-col gap-6"
          >
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white flex-shrink-0">{{ deal.name || dealModuleLabel }}</h2>
            <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[1fr] gap-6 min-h-0 flex-1">
              <div class="flex flex-col min-h-0 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden h-full">
                <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                  <div
                    v-if="descriptionHistoryShowDiff && descriptionHistoryDiffHtml"
                    class="text-md text-gray-900 dark:text-white px-6 py-4 leading-[1.75] [&_del]:px-0.5 [&_ins]:px-0.5"
                    v-html="descriptionHistoryDiffHtml"
                  />
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
                      :name="'deal-desc-version-' + (deal._id || '')"
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
                  {{ t('records.dealVersionRetentionNote') }}
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

          <div v-if="props.embed && deal && !expandedLeftSection" class="pt-0 flex-shrink-0" aria-hidden="true" />
          <div
            v-if="deal && !expandedLeftSection"
            :class="[
              'mb-2 lg:mb-6 sticky z-10 border-b transition-[padding,background-color,border-color,backdrop-filter] duration-200 ease-out',
              props.embed ? 'top-0 py-2 lg:py-4 lg:mb-0 mb-0' : 'top-0 lg:-top-6',
              isLeftTitleSticky || props.embed
                ? 'border-b border-gray-200/80 dark:border-gray-700/80 bg-white/95 dark:bg-gray-900/95 supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:dark:bg-gray-900/90 backdrop-blur py-4'
                : 'border-b border-gray-200/80 dark:border-gray-700/80 bg-white/95 dark:bg-gray-900/95 supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:dark:bg-gray-900/90 backdrop-blur py-4 lg:border-transparent lg:dark:border-transparent lg:bg-transparent lg:dark:bg-transparent lg:supports-[backdrop-filter]:dark:bg-transparent lg:backdrop-blur-none lg:shadow-none lg:py-0'
            ]"
          >
            <div class="flex items-center gap-3">
              <Avatar :record="{ name: dealModuleLabel }" :icon="BanknotesIcon" size="lg" class="shrink-0" />
              <div class="min-w-0 flex-1">
                <EditableTitle
                  :title="deal.name || ''"
                  :can-edit="authStore.can('deals', 'edit')"
                  @save="handleDealTitleSave"
                />
              </div>
            </div>
            <div class="flex items-center gap-3">
              <p class="text-3xl font-bold text-green-600 dark:text-green-400">{{ formatDealAmount(deal?.amount) || '—' }}</p>
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ dealWeightedLabel }}</span>
            </div>
          </div>

          <!-- RecordStateSection - Key fields (same logic as task details section) -->
          <div
            v-if="deal && (!expandedLeftSection || expandedLeftSection === 'key-fields')"
            :class="['group/left-section', expandedLeftSection ? 'mt-8' : 'mt-2 lg:mt-4']"
          >
            <RecordStateSection
              :heading="t('records.genericKeyFields')"
              module-key="deals"
              :fields="dealStateFields"
              :field-values="dealStateValues"
            >
              <template #stage>
                <Listbox
                  v-if="canEditDealStage"
                  :model-value="deal?.stage || ''"
                  @update:model-value="handleDealStageSave"
                >
                  <div class="relative w-full">
                    <ListboxButton
                      :class="[
                        'inline-flex items-center rounded-md text-xs font-semibold transition-colors focus:outline-none focus:ring-0',
                        getStagePillClass(deal?.stage)
                      ]"
                      :style="getStagePillStyle(deal?.stage)"
                    >
                      <span class="truncate px-2.5 py-1">{{ formatDealStage(deal?.stage) || '—' }}</span>
                      <span
                        :class="['inline-flex items-center justify-center px-2 py-1 border-l', getStagePillDividerClass(deal?.stage)]"
                        :style="getStagePillDividerStyle(deal?.stage)"
                      >
                        <ChevronDownIcon class="h-4 w-4" />
                      </span>
                    </ListboxButton>
                    <transition
                      leave-active-class="transition duration-100 ease-in"
                      leave-from-class="opacity-100"
                      leave-to-class="opacity-0"
                    >
                      <ListboxOptions
                        class="absolute z-10 mt-1 max-h-60 w-full min-w-[140px] overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
                      >
                        <ListboxOption
                          v-for="opt in dealStageOptions"
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
                    </transition>
                  </div>
                </Listbox>
                <span
                  v-else
                  :class="[
                    'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold cursor-default select-none bg-gray-50 dark:bg-gray-800/60',
                    getStagePillClass(deal?.stage)
                  ]"
                  :style="getStagePillStyle(deal?.stage)"
                >
                  {{ formatDealStage(deal?.stage) || '—' }}
                </span>
              </template>

              <template #amount>
                <div v-if="canEditDealKeyFields" class="w-full min-h-8 px-2 py-1 -mx-2 -my-1 flex items-center">
                  <input
                    v-show="isEditingAmount"
                    ref="amountInputRef"
                    v-model="localAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    @blur="handleAmountBlur"
                    @keydown.enter="handleAmountBlur"
                    @keydown.esc="handleAmountCancel"
                    class="text-xs h-8 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full min-w-0 flex-1"
                    :placeholder="t('records.dealExpectedValuePh')"
                  />
                  <span
                    v-show="!isEditingAmount"
                    @click="startAmountEdit"
                    :class="[
                      'block w-full h-8 text-sm cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 transition-colors flex items-center',
                      deal?.amount != null ? 'text-gray-900 dark:text-white' : 'text-record-empty'
                    ]"
                  >
                    {{ formatDealAmount(deal?.amount) || keyFieldsEmptyLabel }}
                  </span>
                </div>
                <span
                  v-else
                  :class="['block w-full text-sm', formatDealAmount(deal?.amount) ? 'text-gray-900 dark:text-white' : 'text-record-empty']"
                >
                  {{ formatDealAmount(deal?.amount) || '—' }}
                </span>
              </template>

              <template #probability>
                <div v-if="canEditDealKeyFields" class="w-full min-h-8 px-2 py-1 -mx-2 -my-1 flex items-center">
                  <input
                    v-show="isEditingProbability"
                    ref="probabilityInputRef"
                    v-model="localProbability"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    @blur="handleProbabilityBlur"
                    @keydown.enter="handleProbabilityBlur"
                    @keydown.esc="handleProbabilityCancel"
                    class="text-xs h-8 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full min-w-0 flex-1"
                    :placeholder="t('records.dealProbabilityPh')"
                  />
                  <span
                    v-show="!isEditingProbability"
                    @click="startProbabilityEdit"
                    :class="[
                      'block w-full h-8 text-sm cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 transition-colors flex items-center',
                      deal?.probability != null ? 'text-gray-900 dark:text-white' : 'text-record-empty'
                    ]"
                  >
                    {{ formatDealProbability(deal?.probability) || keyFieldsEmptyLabel }}
                  </span>
                </div>
                <span
                  v-else
                  :class="['block w-full text-sm', formatDealProbability(deal?.probability) ? 'text-gray-900 dark:text-white' : 'text-record-empty']"
                >
                  {{ formatDealProbability(deal?.probability) || '—' }}
                </span>
              </template>

              <template #expectedCloseDate>
                <div v-if="canEditDealKeyFields" class="w-full min-h-8 px-2 py-1 -mx-2 -my-1 flex items-center">
                  <DatePicker
                    v-if="isEditingExpectedCloseDate"
                    ref="expectedCloseDateInputRef"
                    v-model="localExpectedCloseDate"
                    :placeholder="t('records.dealCloseDatePh')"
                    input-class="text-xs h-8 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full min-w-0 flex-1 cursor-pointer"
                    @blur="handleExpectedCloseDateBlur"
                    @enter="handleExpectedCloseDateBlur"
                    @escape="handleExpectedCloseDateCancel"
                  />
                  <span
                    v-else
                    @click="startExpectedCloseDateEdit"
                    :class="[
                      'block w-full h-8 text-sm cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 transition-colors flex items-center',
                      deal?.expectedCloseDate ? 'text-gray-900 dark:text-white' : 'text-record-empty'
                    ]"
                  >
                    {{ formatDealCloseDate(deal?.expectedCloseDate) || keyFieldsEmptyLabel }}
                  </span>
                </div>
                <span
                  v-else
                  :class="['block w-full text-sm', formatDealCloseDate(deal?.expectedCloseDate) ? 'text-gray-900 dark:text-white' : 'text-record-empty']"
                >
                  {{ formatDealCloseDate(deal?.expectedCloseDate) || '—' }}
                </span>
              </template>

              <template #assignedTo>
                <Listbox
                  v-if="canInlineEditDealOwner"
                  :model-value="selectedDealOwnerId"
                  @update:model-value="(v) => handleDealDetailFieldSave('assignedTo', v || null)"
                >
                  <div class="relative w-full">
                    <ListboxButton
                      class="flex items-center gap-2 w-full min-h-8 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 py-1 -mx-2 -my-1 transition-colors focus:outline-none focus:ring-0"
                      @mousedown="ensureDealLookups"
                    >
                      <Avatar
                        v-if="dealOwnerAvatarUser"
                        :user="dealOwnerAvatarUser"
                        size="sm"
                      />
                      <span
                        :class="[
                          'text-sm flex-1 truncate',
                          formatDealOwnerName(deal) ? 'text-gray-900 dark:text-white' : 'text-record-empty'
                        ]"
                      >
                        {{ formatDealOwnerName(deal) || keyFieldsEmptyLabel }}
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
                          v-for="user in dealUsers"
                          :key="user._id"
                          :value="user._id"
                          v-slot="{ active, selected }"
                        >
                          <li :class="['relative cursor-default select-none py-2 pl-4 pr-10 flex items-center gap-2', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                            <Avatar :user="user" size="sm" />
                            <span :class="['block truncate flex-1', selected ? 'font-medium' : 'font-normal']">{{ getDealUserDisplayName(user) }}</span>
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
                    v-if="dealOwnerAvatarUser"
                    :user="dealOwnerAvatarUser"
                    size="sm"
                  />
                  <span
                    :class="[
                      'text-sm',
                      formatDealOwnerName(deal) ? 'text-gray-900 dark:text-white' : 'text-record-empty'
                    ]"
                  >
                    {{ formatDealOwnerName(deal) || keyFieldsEmptyLabel }}
                  </span>
                </div>
              </template>

              <template #accountId>
                <Listbox
                  v-if="canInlineEditDealOrganization"
                  :model-value="selectedDealOrganizationId"
                  @update:model-value="(v) => handleDealDetailFieldSave('accountId', v || null)"
                >
                  <div class="relative w-full">
                    <ListboxButton
                      class="flex items-center gap-2 w-full min-h-8 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 py-1 -mx-2 -my-1 transition-colors focus:outline-none focus:ring-0"
                      @mousedown="ensureDealLookups"
                    >
                      <span
                        v-if="selectedDealOrganizationId && formatDealOrganizationName(deal)"
                        class="text-sm min-w-0 flex-1 truncate text-gray-900 dark:text-white transition-colors hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        <span
                          role="button"
                          tabindex="0"
                          class="text-sm inline cursor-pointer"
                          @click.stop="openTab(`/organizations/${selectedDealOrganizationId}`, { background: false, insertAdjacent: true })"
                        >
                          {{ formatDealOrganizationName(deal) }}
                        </span>
                      </span>
                      <span
                        v-else
                        :class="[
                          'text-sm min-w-0 flex-1 truncate',
                          formatDealOrganizationName(deal) ? 'text-gray-900 dark:text-white' : 'text-record-empty'
                        ]"
                      >
                        {{ formatDealOrganizationName(deal) || keyFieldsEmptyLabel }}
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
                          <li :class="['relative cursor-default select-none py-2 pl-4 pr-10', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                            <span class="block truncate">{{ keyFieldsEmptyLabel }}</span>
                          </li>
                        </ListboxOption>
                        <ListboxOption
                          v-for="organization in dealOrganizationOptions"
                          :key="organization._id"
                          :value="organization._id"
                          v-slot="{ active, selected }"
                        >
                          <li :class="['relative cursor-default select-none py-2 pl-4 pr-10', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                            <span :class="['block truncate', selected ? 'font-medium' : 'font-normal']">{{ organization.name || t('records.dealUnnamedOrganization') }}</span>
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
                  v-else-if="selectedDealOrganizationId && formatDealOrganizationName(deal)"
                  class="block w-full text-sm text-gray-900 dark:text-white truncate transition-colors hover:text-primary-600 dark:hover:text-primary-400"
                >
                  <span
                    role="button"
                    tabindex="0"
                    class="text-sm inline cursor-pointer"
                    @click="openTab(`/organizations/${selectedDealOrganizationId}`, { background: false, insertAdjacent: true })"
                  >
                    {{ formatDealOrganizationName(deal) }}
                  </span>
                </span>
                <span
                  v-else
                  :class="['block w-full text-sm', formatDealOrganizationName(deal) ? 'text-gray-900 dark:text-white' : 'text-record-empty']"
                >
                  {{ formatDealOrganizationName(deal) || '—' }}
                </span>
              </template>

              <template #contactId>
                <Listbox
                  v-if="canInlineEditDealContact"
                  :model-value="selectedDealContactId"
                  @update:model-value="(v) => handleDealDetailFieldSave('contactId', v || null)"
                >
                  <div class="relative w-full">
                    <ListboxButton
                      class="flex items-center gap-2 w-full min-h-8 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 py-1 -mx-2 -my-1 transition-colors focus:outline-none focus:ring-0"
                      @mousedown="ensureDealLookups"
                    >
                      <span
                        v-if="selectedDealContactId && formatDealContactName(deal)"
                        class="text-sm min-w-0 flex-1 truncate text-gray-900 dark:text-white transition-colors hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        <span
                          role="button"
                          tabindex="0"
                          class="text-sm inline cursor-pointer"
                          @click.stop="openTab(`/people/${selectedDealContactId}`, { background: false, insertAdjacent: true })"
                        >
                          {{ formatDealContactName(deal) }}
                        </span>
                      </span>
                      <span
                        v-else
                        :class="[
                          'text-sm min-w-0 flex-1 truncate',
                          formatDealContactName(deal) ? 'text-gray-900 dark:text-white' : 'text-record-empty'
                        ]"
                      >
                        {{ formatDealContactName(deal) || keyFieldsEmptyLabel }}
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
                          <li :class="['relative cursor-default select-none py-2 pl-4 pr-10', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                            <span class="block truncate">{{ keyFieldsEmptyLabel }}</span>
                          </li>
                        </ListboxOption>
                        <ListboxOption
                          v-for="person in dealPeopleOptions"
                          :key="person._id"
                          :value="person._id"
                          v-slot="{ active, selected }"
                        >
                          <li :class="['relative cursor-default select-none py-2 pl-4 pr-10', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                            <span :class="['block truncate', selected ? 'font-medium' : 'font-normal']">{{ person.name || t('records.dealUnnamedPerson') }}</span>
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
                  v-else-if="selectedDealContactId && formatDealContactName(deal)"
                  class="block w-full text-sm text-gray-900 dark:text-white truncate transition-colors hover:text-primary-600 dark:hover:text-primary-400"
                >
                  <span
                    role="button"
                    tabindex="0"
                    class="text-sm inline cursor-pointer"
                    @click="openTab(`/people/${selectedDealContactId}`, { background: false, insertAdjacent: true })"
                  >
                    {{ formatDealContactName(deal) }}
                  </span>
                </span>
                <span
                  v-else
                  :class="['block w-full text-sm', formatDealContactName(deal) ? 'text-gray-900 dark:text-white' : 'text-record-empty']"
                >
                  {{ formatDealContactName(deal) || '—' }}
                </span>
              </template>
            </RecordStateSection>
          </div>

          <section
            v-if="deal && shouldRenderDealSectionStack"
            :class="[expandedLeftSection ? 'mt-8' : 'mt-4']"
          >
            <SectionStack
              :sections="dealSections"
              :record="deal"
              :adapter="dealRecordAdapter"
              :context="dealSectionContext"
            />
          </section>
      </template>

      <template v-if="deal" #right>
        <RecordRightPane
          ref="rightPaneRef"
          :tabs="rightPaneTabs"
          :default-tab="recordLayoutIsMobile ? undefined : 'activity'"
          :show-header="props.embed"
          :show-close-button="props.embed"
          :title="props.embed ? dealModuleLabel : ''"
          :persistence-key="`deal-${deal._id}`"
          :record-id="deal._id"
          @close="handleEmbedClose"
        >
          <template v-if="props.embed && quickPreviewNav" #header-prefix>
            <div class="flex items-center gap-1 mr-2">
              <button
                type="button"
                class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 transition-colors dark:border-gray-700 dark:text-gray-400 shrink-0"
                :class="quickPreviewNav.canPrevious ? 'hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200' : 'opacity-40 cursor-not-allowed'"
                :disabled="!quickPreviewNav.canPrevious"
                :aria-label="dealNavPreviousLabel"
                :title="dealNavPreviousLabel"
                @click="quickPreviewNav.onPrev()"
              >
                <ArrowLeftIcon class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 transition-colors dark:border-gray-700 dark:text-gray-400 shrink-0"
                :class="quickPreviewNav.canNext ? 'hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200' : 'opacity-40 cursor-not-allowed'"
                :disabled="!quickPreviewNav.canNext"
                :aria-label="dealNavNextLabel"
                :title="dealNavNextLabel"
                @click="quickPreviewNav.onNext()"
              >
                <ArrowRightIcon class="h-4 w-4" />
              </button>
            </div>
          </template>
          <template v-if="props.embed" #header-actions>
            <button
              type="button"
              class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('records.genericOpenInNewTab')"
              :title="t('records.genericOpenInNewTab')"
              @click="openDealInNewTab"
            >
              <ArrowTopRightOnSquareIcon class="w-5 h-5" />
            </button>
            <button
              type="button"
              class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('records.dealEmailContact')"
              :title="t('records.dealEmailContact')"
              @click="showEmailModal = true"
            >
              <EnvelopeIcon class="w-5 h-5" />
            </button>
            <button
              type="button"
              class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('records.dealEditAria')"
              :title="t('records.dealEditAria')"
              @click="showEditModal = true"
            >
              <PencilSquareIcon class="w-5 h-5" />
            </button>
            <button
              type="button"
              ref="tagHeaderButtonRef"
              @click="handleTagIconClick($event)"
              :class="[
                'relative inline-flex items-center justify-center p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                hasDealTags
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              ]"
              :aria-label="t('records.genericTagsAria')"
              :title="t('records.genericTagsAria')"
            >
              <TagIcon class="block w-5 h-5" />
              <span
                v-if="hasDealTags"
                class="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-indigo-600 dark:text-indigo-400"
              ></span>
            </button>
            <button
              type="button"
              class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('records.genericCopyUrl')"
              :title="t('records.genericCopyUrl')"
              @click="copyDealUrl"
            >
              <ClipboardDocumentIcon class="w-5 h-5" />
            </button>
            <button
              type="button"
              :class="[
                'p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                isFollowing ? 'text-yellow-500 dark:text-yellow-400' : ''
              ]"
              :aria-label="dealStarAriaLabel"
              :title="dealStarAriaLabel"
              @click="isFollowing = !isFollowing"
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
                <MenuItems class="absolute right-0 top-full mt-2 w-48 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 z-50">
                  <MenuItem v-slot="{ active }">
                    <button
                      @click="handleDuplicate"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                    >
                      {{ t('actions.duplicate') }}
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
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                    >
                      {{ t('actions.export') }}
                    </button>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <button
                      @click="showEmailModal = true"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
                      ]"
                    >
                      {{ t('records.dealEmailContact') }}
                    </button>
                  </MenuItem>
                  <hr class="my-1 border-gray-200 dark:border-gray-700" />
                  <MenuItem v-slot="{ active }">
                    <button
                      @click="showDeleteModal = true"
                      :class="[
                        'w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                        active ? 'bg-gray-100 dark:bg-gray-700' : 'text-red-600 dark:text-red-400'
                      ]"
                    >
                      {{ t('actions.delete') }}
                    </button>
                  </MenuItem>
                </MenuItems>
              </transition>
            </Menu>
          </template>
          <template #tab-activity>
            <ActivitySection
              ref="activitySectionRef"
              :events="activitySectionEvents"
              :ui="dealActivityUi"
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
              <div class="record-context-panel__header flex items-center justify-between gap-2 px-3 sm:px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-900">
                <h2 class="min-w-0 truncate text-base font-semibold text-gray-900 dark:text-white">{{ t('records.relatedTitle') }}</h2>
                <div class="flex shrink-0 items-center gap-1 sm:gap-1.5">
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
              <section v-if="deal._id">
                <RelatedSection
                  :record="deal"
                  :adapter="dealRecordAdapter"
                  :related-groups="dealRelatedGroupsFromContext"
                  :context-revision="dealContextRevision"
                  :context="{ hideHeader: true }"
                />
              </section>
            </div>
            </div>
          </template>

          <template v-if="showLearningTab" #tab-learning>
            <div class="flex h-full flex-col">
              <RelatedLearningPanel app-key="SALES" />
            </div>
          </template>

          <template v-if="showRecordDocumentsTab" #tab-documents>
            <div class="flex h-full flex-col">
              <div class="record-context-panel__header flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.genericTabDocuments') }}</h2>
              </div>
              <div class="min-h-0 flex-1 overflow-y-auto p-4">
                <RecordDocumentsPanel
                  v-if="deal._id"
                  module-key="deals"
                  :record-id="String(deal._id)"
                  app-key="SALES"
                  :can-create="canCreateDocuments"
                  :can-edit="canEditDocuments"
                  @documents-changed="handleDealDocumentsChanged"
                />
              </div>
            </div>
          </template>

          <template #tab-details>
            <RecordDetailsTabPanel
              :record="deal"
              :adapter="dealDetailsPaneAdapter"
              :context="dealDetailsPaneContext"
            />
          </template>

          <template #tab-integrations>
            <div class="flex flex-col h-full">
              <div class="record-context-panel__header flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-900">
                <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.genericIntegrations') }}</h2>
              </div>
              <div class="p-4 overflow-y-auto flex-1 min-h-0">
                <AutomationContext
                  v-if="deal._id"
                  entity-type="deal"
                  :entity-id="deal._id"
                />
              </div>
            </div>
          </template>
        </RecordRightPane>
      </template>
    </RecordPageShell>

    <CreateRecordDrawer
      :isOpen="showEditModal"
      moduleKey="deals"
      :record="deal"
      :module-definition-prefetch="dealModuleDefinition"
      @close="showEditModal = false"
      @saved="handleDealUpdated"
    />
    <CreateRecordDrawer
      v-if="showDuplicateCreateModal"
      :key="`duplicate-deal-${duplicateSourceId}`"
      :isOpen="showDuplicateCreateModal"
      moduleKey="deals"
      :duplicate-mode="true"
      :initial-data="duplicateInitialData"
      :module-definition-prefetch="dealModuleDefinition"
      @close="closeDuplicateCreate"
      @saved="closeDuplicateCreate"
    />

    <CreateRecordDrawer
      :isOpen="showEventModal"
      moduleKey="events"
      :record="eventToEdit"
      @close="showEventModal = false"
      @saved="handleEventSaved"
    />
    <CreateRecordDrawer
      v-if="showAddRelatedRecordDrawer && addRelatedRecordModuleKey"
      :isOpen="showAddRelatedRecordDrawer"
      :moduleKey="addRelatedRecordModuleKey"
      @close="closeAddRelatedRecordDrawer"
      @saved="handleAddRelatedRecordSaved"
    />

    <EmailComposeDrawer
      :is-open="showEmailModal"
      :related-to="(deal?.id ?? deal?._id) ? { moduleKey: 'deals', recordId: String(deal?.id ?? deal?._id ?? '') } : null"
      :initial-to="primaryContact?.email || ''"
      :initial-draft="emailComposeDraft"
      @close="showEmailModal = false; emailComposeDraft = null"
      @submit="handleEmailSubmit"
    />

    <LinkRecordsDrawer
      :isOpen="showLinkRecordDrawer"
      :module-key="''"
      source-app-key="SALES"
      source-module-key="deals"
      :multiple="true"
      :allow-create="allowCreateFromLinkDrawer"
      :create-and-link="allowCreateFromLinkDrawer"
      :title="linkRecordDrawerTitle"
      :context="linkRecordDrawerContext"
      @close="closeLinkRecordDrawer"
      @linked="handleLinkRecordDrawerLinked"
      @create="handleLinkRecordDrawerCreate"
    />

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

    <Teleport to="body">
      <div
        v-if="showTagPopover"
        ref="tagPopoverRef"
        :style="tagPopoverStyle"
        :class="['fixed', FLOATING_OVERLAY_Z_CLASS, 'w-[360px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl']"
      >
        <RecordTagPopover
          :record="deal"
          :tag-storage-key="tagStorageKey"
          :can-edit="canEditDeal"
          :persist-tags="persistRecordTagsForDeal"
          instance-tag-source="deals"
          :fetch-record="fetchDeal"
          :open="showTagPopover"
        />
      </div>
    </Teleport>

    <DeleteConfirmationModal
      :show="showDeleteModal"
      :record-name="deal?.name || ''"
      record-type="deals"
      :deleting="deleting"
      @close="showDeleteModal = false"
      @confirm="confirmDeleteDeal"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, inject, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Menu, MenuButton, MenuItem, MenuItems, Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/vue';
import DOMPurify from 'dompurify';
import { sanitizeRichDescriptionHtml } from '@/utils/richDescriptionHtml';
import { buildDescriptionActivityDiff, isDescriptionActivityFieldChange } from '@/utils/contentVersionHistory';
import { useRichDescriptionImagePreview } from '@/composables/useRichDescriptionImagePreview';
import RichDescriptionImageLightbox from '@/components/common/RichDescriptionImageLightbox.vue';
import {
  RecordPageShell,
  RecordHeader,
  RecordStateSection,
  RecordRightPane,
  RecordTagPopover
} from '@/components/record-page';
import RecordPrintButton from '@/components/record-page/RecordPrintButton.vue';
import ActivitySection from '@/components/activity/ActivitySection.vue';
import DatePicker from '@/components/common/DatePicker.vue';
import 'emoji-picker-element';
import { useCommentReactionPicker } from '@/components/activity/composables/useCommentReactionPicker';
import { useCommentReactionTooltip } from '@/components/activity/composables/useCommentReactionTooltip';
import { useCommentReactionActions } from '@/components/activity/composables/useCommentReactionActions';
import { createCommentReactionApi } from '@/components/activity/utils/commentReactionApi';
import {
  buildCommentReactions,
  isCommentReactionSelectedForUser
} from '@/components/activity/utils/commentReactionModel';
import SectionStack from '@/components/record-page/sections/SectionStack.vue';
import RelatedSection from '@/components/record-page/sections/RelatedSection.vue';
import { useRecordTagPopoverPosition } from '@/components/record-page/composables/useRecordTagPopoverPosition';
import { findTitleScrollContainer } from '@/components/record-page/composables/useStickyTitleRow';
import { FLOATING_OVERLAY_Z_CLASS } from '@/constants/zIndexLayers';
import { useRecordTags } from '@/components/record-page/composables/useRecordTags';
import EditableTitle from '@/components/record-page/EditableTitle.vue';
import RecordPresenceAvatars from '@/components/record-page/RecordPresenceAvatars.vue';
import RecordAiPanel from '@/astra/surfaces/RecordAiPanel.vue';
import { useRecordPresence } from '@/composables/useRecordPresence';
import { useArivuDataChangeRefresh } from '@/composables/useArivuDataChangeRefresh';
import { createActivityTimelineRefSetter } from '@/components/activity/useRecordActivityAdapter';
import { createDealActivityUi } from '@/components/activity/adapters/dealActivityUiAdapter';
import { createDealRecordAdapter } from '@/components/record-page/adapters/dealRecordAdapter';
import { createGenericRecordAdapter } from '@/components/record-page/adapters/genericRecordAdapter';
import RecordDetailsTabPanel from '@/components/record-page/RecordDetailsTabPanel.vue';
import { createRecordSectionLabels } from '@/utils/recordSectionLabels';
import { resolveFieldContext } from '@/utils/fieldContextFilter';
import { formatRelativeTime } from '@/utils/relativeTime';
import { resolveFieldLabel } from '@/utils/fieldLabelResolver';
import { formatActivityChangeValue } from '@/utils/fieldDisplay';
import { resolveStageOrPicklistLabel } from '@/utils/configurableLabelResolver';
import { picklistChipStyle } from '@/utils/picklistColorPalette';
import { i18n } from '@/i18n/index';
import { useRecordPageLifecycle } from '@/components/record-page/composables/useRecordPageLifecycle';
import {
  extractRecordUpdatedAtMs,
  recordRecordDetailFingerprint,
} from '@/utils/recordDetailFreshness';
import { dispatchRecordUpdated } from '@/utils/moduleListFreshness';
import {
  normalizeSystemActivityEvent,
  normalizeCommentActivityEvent,
  normalizeEmailThreadActivityEvent,
  sortActivityEventsByDate
} from '@/components/record-page/activityEventModel';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowsPointingInIcon,
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  ChevronDownIcon,
  EnvelopeIcon,
  PencilSquareIcon,
  BanknotesIcon,
  PlusIcon,
  ClipboardDocumentIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  StarIcon,
  EllipsisVerticalIcon,
  ClockIcon,
  LinkIcon,
  PuzzlePieceIcon,
  TagIcon,
  DocumentDuplicateIcon,
  Bars3BottomLeftIcon,
  AcademicCapIcon
} from '@heroicons/vue/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/vue/24/solid';
import Avatar from '@/components/common/Avatar.vue';
import { useTabs } from '@/composables/useTabs';
import { useRecordModuleBack } from '@/components/record-page/composables/useRecordModuleBack';
import { useAuthStore } from '@/stores/authRegistry';
import { isAiSuiteEntitled } from '@/utils/aiSuiteEntitlement';
import apiClient from '@/utils/apiClient';
import { isAddonEntitled } from '@/utils/addonEntitlement';
import { openRecordDiscussChat } from '@/utils/internalChatApi';
import RelatedLearningPanel from '@/components/learning/RelatedLearningPanel.vue';
import { buildDuplicateInitialData } from '@/utils/duplicateRecord';
import { fetchModuleDefinitionCached } from '@/utils/tenantSchemaApiCache';
import {
  fetchUsersListCached,
  fetchOrganizationsListCached,
  fetchPeopleListCached,
  DEAL_RELATIONSHIP_PEOPLE_PARAMS,
  DEAL_RELATIONSHIP_ORG_PARAMS,
  DEAL_RELATIONSHIP_USERS_PARAMS,
} from '@/utils/recordLookupCache';
import { getProcessActivityMessage } from '@/utils/processActivityMessages';
import { useNotifications } from '@/composables/useNotifications';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import LinkRecordsDrawer from '@/components/common/LinkRecordsDrawer.vue';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';
import EmailComposeDrawer from '@/components/communications/EmailComposeDrawer.vue';
import { useRecordContext, invalidateRecordContext } from '@/composables/useRecordContext';
import { refreshRelatedRecordsAfterLookupFieldSave } from '@/composables/useLookupFieldRelatedSync';
import { refreshRelatedRecordsAfterDocumentChange } from '@/composables/useDocumentRelatedSync';
import AutomationContext from '@/components/automation/AutomationContext.vue';
import RecordDocumentsPanel from '@/components/record-page/RecordDocumentsPanel.vue';
import { supportsDocumentAttachments } from '@/constants/documentAttachments';
import { formatUserDate, formatUserDateTime } from '@/utils/localeFormat';
import { formatCurrencyValue, resolveOrgCurrencyCode } from '@/utils/currencyOptions';

const { t, te } = useI18n();
const {
  showImagePreview,
  previewImageSrc,
  closeImagePreview,
  handleRichHtmlClick
} = useRichDescriptionImagePreview();

const route = useRoute();
const router = useRouter();
const { openTab, replaceActiveTab, activeTabId, updateTabTitle, findTabById } = useTabs();
const { goBackToModuleList } = useRecordModuleBack();
const authStore = useAuthStore();
const aiSuiteEntitled = computed(() => isAiSuiteEntitled(authStore.user));
const notifications = useNotifications();
const recordLayoutIsMobile = inject('recordLayoutIsMobile', ref(false));
const quickPreviewNav = inject('quickPreviewNav', null);

const props = defineProps({
  embed: { type: Boolean, default: false },
  dealId: { type: String, default: null }
});

const emit = defineEmits(['close']);

const deal = ref(null);
const expandedLeftSection = ref('');
const effectiveDealId = computed(() => props.embed && props.dealId ? props.dealId : route.params.id);

const showRecordPresenceAvatars = computed(
  () => Boolean(effectiveDealId.value && deal.value && authStore.can('deals', 'view'))
);

const recordPresenceActivityType = computed(() => {
  const section = expandedLeftSection.value;
  if (!section || section === 'key-fields') return 'viewing';
  return 'editing';
});

const { otherSessions: recordPresenceOthers } = useRecordPresence(
  () => 'deals',
  () => String(effectiveDealId.value || deal.value?._id || ''),
  () => recordPresenceActivityType.value
);

const loading = ref(true);
const error = ref(null);
const showEditModal = ref(false);
const showDuplicateCreateModal = ref(false);
const duplicateInitialData = ref({});
const duplicateSourceId = ref('');
const showDeleteModal = ref(false);
const deleting = ref(false);
const showEventModal = ref(false);
const showEmailModal = ref(false);
const emailComposeDraft = ref(null);
const isFollowing = ref(false);
const eventToEdit = ref(null);
const rightPaneRef = ref(null);
const activitySectionRef = ref(null);
const activityTimelineRef = ref(null);
const activityLogs = ref([]);
const comments = ref([]);
const emailThreads = ref([]);
const expandedTaskEmailThreads = ref(new Set());
const dealNavigationIds = ref([]);
const newCommentText = ref('');
const activityFilterComments = ref(true);
const activityFilterUpdates = ref(true);
const activityFilterEmail = ref(true);
const activityFilterDoneThreads = ref(false);
const activityFilterAssignedToMe = ref(false);
const activityFilterTagged = ref(false);
const activityFilterUntagged = ref(false);
const activitySearchQuery = ref('');
const activitySearchOpen = ref(false);
const activeThreadRootCommentId = ref(null);
const showLinkRecordDrawer = ref(false);
const allowCreateFromLinkDrawer = ref(false);
const showAddRelatedRecordDrawer = ref(false);
const addRelatedRecordModuleKey = ref('');
const pendingAddRelatedLinkPayload = ref(null);
const relatedRefreshKey = ref(0);
const dealRecordPageRootRef = ref(null);
const leftPaneScrollElement = ref(null);
const isLeftTitleSticky = ref(false);
const STICKY_TITLE_ENABLE_OFFSET = 10;
const STICKY_TITLE_DISABLE_OFFSET = 2;
const editingNoteId = ref('');
const editingNoteText = ref('');
const editingNoteAttachments = ref([]);
const editingNoteOriginalText = ref('');
const editingNoteOriginalAttachments = ref([]);
const editingNoteHasPendingFiles = ref(false);
const savingEditedNote = ref(false);
const lastRoutedDealId = ref(String(effectiveDealId.value || ''));
const dealModuleDefinition = ref(null);
const dealModuleLabel = computed(() => t('records.dealModuleLabel'));
const dealLoadingMessage = computed(() => t('records.dealLoading'));
const dealErrorTitle = computed(() => t('records.dealErrorTitle'));
const dealNavPreviousLabel = computed(() => t('records.dealNavPrevious'));
const dealNavNextLabel = computed(() => t('records.dealNavNext'));
const keyFieldsEmptyLabel = computed(() => t('common.keyFieldsEmptyValue'));
const SLOT_RENDERED_KEY_FIELDS = Object.freeze(new Set(['stage', 'amount', 'probability', 'expectedCloseDate', 'assignedTo', 'accountId', 'contactId']));
const dealUsers = ref([]);
const dealOrganizationsList = ref([]);
const dealPeopleList = ref([]);
const dealLookupsLoaded = ref(false);
let dealLookupsInflight = null;
let dealNavigationIdsScheduled = false;

const isEditingAmount = ref(false);
const isEditingProbability = ref(false);
const isEditingExpectedCloseDate = ref(false);
const localAmount = ref('');
const localProbability = ref('');
const localExpectedCloseDate = ref('');
const amountInputRef = ref(null);
const probabilityInputRef = ref(null);
const expectedCloseDateInputRef = ref(null);

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
  const organizationId = authStore.user?.organizationId || authStore.organization?._id || 'default-org';
  return `arivu-deal-tag-definitions-${organizationId}`;
});
const hasDealTags = computed(() => Array.isArray(deal.value?.tags) && deal.value.tags.length > 0);
const canEditDeal = computed(() => authStore.can('deals', 'edit'));

const persistRecordTagsForDeal = async (cleaned) => {
  if (!deal.value || !canEditDeal.value) return;
  const response = await apiClient.put(`/deals/${deal.value._id}/tags`, { tags: cleaned });
  if (response?.success && response?.data) {
    deal.value.tags = Array.isArray(response.data.tags) ? response.data.tags : cleaned;
  } else {
    deal.value.tags = cleaned;
  }
  dispatchRecordUpdated({ moduleKey: 'deals', recordId: deal.value._id, record: deal.value });
};

const { getTagChipClass: getDealTagChipClass } = useRecordTags(deal, {
  tagStorageKey,
  canEdit: canEditDeal,
  persistTags: persistRecordTagsForDeal,
  instanceTagSource: 'deals'
});

const ACTIVITY_FILTER_STORAGE_KEY = 'arivu-deal-activity-filter';

const linkRecordDrawerContext = computed(() => (deal.value?._id ? { dealId: deal.value._id } : {}));
const canLinkRecords = computed(() => authStore.can('deals', 'edit'));

const { context: dealRecordContext, contextRevision: dealContextRevision, load: loadDealRecordContext } = useRecordContext(
  'SALES',
  'deals',
  () => deal.value?._id
);
watch(deal, (d) => {
  if (d?._id) loadDealRecordContext();
}, { immediate: true });

async function handleDealDocumentsChanged(payload = {}) {
  if (!deal.value?._id) return;
  await refreshRelatedRecordsAfterDocumentChange({
    moduleKey: 'deals',
    recordId: deal.value._id,
    appKey: 'SALES',
    contextRef: dealRecordContext,
    loadRecordContext: loadDealRecordContext,
    documents: payload.action === 'attach' ? (payload.documents || []) : [],
    detachedDocumentIds: payload.action === 'detach' ? (payload.detachedDocumentIds || []) : [],
    onContextRevision: () => { dealContextRevision.value += 1; }
  });
}

const dealRelatedGroupsFromContext = computed(() => {
  const rels = dealRecordContext.value?.relationships;
  if (!Array.isArray(rels) || rels.length === 0) return [];
  return rels
    .filter((rel) => rel.records && rel.records.length > 0)
    .map((rel) => {
      const key = rel.relationshipKey || rel.label || 'related';
      const label = rel.ui?.label || rel.label || key;
      const direction = (rel.direction || 'SOURCE').toUpperCase();
      const items = (rel.records || []).map((r) => {
        const id = r.recordId ?? r.id ?? r._id;
        const moduleKey = (r.moduleKey || '').toLowerCase();
        const appKey = (r.appKey || 'SALES').toUpperCase();
        const path = moduleKey ? `/${moduleKey}/${id}` : null;
        return {
          id: id?.toString?.() ?? String(id),
          title: r.label || r.name || r.title || (id ? String(id).slice(0, 8) : 'Untitled'),
          meta: r.secondaryText || r.status || '',
          recordData: r,
          onOpen: path ? () => router.push(path) : undefined,
          relationshipKey: key,
          appKey,
          moduleKey,
          direction
        };
      });
      return { key, label, items };
    });
});

const canViewDocuments = computed(() => authStore.can?.('documents', 'view') ?? false);
const canCreateDocuments = computed(() => authStore.can?.('documents', 'create') ?? false);
const canEditDocuments = computed(() => authStore.can?.('documents', 'edit') ?? false);
const showRecordDocumentsTab = computed(
  () => supportsDocumentAttachments('deals') && canViewDocuments.value && !!deal.value?._id
);
const showLearningTab = computed(() => authStore.hasAppAccess?.('LMS') ?? false);

const rightPaneTabs = computed(() => {
  const tabs = [
    { id: 'activity', name: t('records.genericTabActivity'), icon: ClockIcon },
    { id: 'related', name: t('records.dealRelatedRecordsTab'), icon: LinkIcon }
  ];
  if (showLearningTab.value) {
    tabs.push({ id: 'learning', name: t('learning.relatedLearning'), icon: AcademicCapIcon });
  }
  if (showRecordDocumentsTab.value) {
    tabs.push({ id: 'documents', name: t('records.genericTabDocuments'), icon: DocumentDuplicateIcon });
  }
  tabs.push(
    { id: 'details', name: t('records.detailsTitle'), icon: Bars3BottomLeftIcon },
    { id: 'integrations', name: t('records.genericIntegrations'), icon: PuzzlePieceIcon }
  );
  return tabs;
});

const DEAL_NAV_CONTEXT_STORAGE_PREFIX = 'arivu-deal-nav-context:';
const dealNavigationContextToken = computed(() => String(route.query?.navCtx || '').trim());

const currentDealNavigationId = computed(() => String(effectiveDealId.value || deal.value?._id || ''));

const currentDealNavigationIndex = computed(() => {
  const currentId = currentDealNavigationId.value;
  if (!currentId) return -1;
  return dealNavigationIds.value.findIndex((id) => id === currentId);
});

const previousDealId = computed(() => {
  const index = currentDealNavigationIndex.value;
  if (index <= 0) return '';
  return dealNavigationIds.value[index - 1] || '';
});

const nextDealId = computed(() => {
  const index = currentDealNavigationIndex.value;
  if (index < 0 || index >= dealNavigationIds.value.length - 1) return '';
  return dealNavigationIds.value[index + 1] || '';
});

const canNavigatePreviousDeal = computed(() => Boolean(previousDealId.value));
const canNavigateNextDeal = computed(() => Boolean(nextDealId.value));

const navShortcutPrev = computed(() =>
  typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent) ? '⌘+Left' : 'Ctrl+Left'
);
const navShortcutNext = computed(() =>
  typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent) ? '⌘+Right' : 'Ctrl+Right'
);

const navigateToDealById = (dealId) => {
  const targetId = String(dealId || '').trim();
  if (!targetId) return;
  const navToken = dealNavigationContextToken.value;
  const path = navToken
    ? `/deals/${targetId}?navCtx=${encodeURIComponent(navToken)}`
    : `/deals/${targetId}`;
  replaceActiveTab(path, { title: dealModuleLabel.value });
};

const goToPreviousDeal = async () => {
  if (!previousDealId.value) {
    await fetchDealNavigationIds();
  }
  if (!canNavigatePreviousDeal.value) return;
  navigateToDealById(previousDealId.value);
};

const goToNextDeal = async () => {
  if (!nextDealId.value) {
    await fetchDealNavigationIds();
  }
  if (!canNavigateNextDeal.value) return;
  navigateToDealById(nextDealId.value);
};

const handleHeaderKeydown = (e) => {
  if (e.repeat) return;
  const ctrlOrMeta = e.ctrlKey || e.metaKey;
  if (!ctrlOrMeta) return;
  // Only the visible deal record page should handle: with keep-alive, multiple instances can have listeners.
  const myId = String(effectiveDealId.value || '');
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
    goToPreviousDeal();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    goToNextDeal();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleHeaderKeydown);
  window.addEventListener('arivu:open-email-compose', onOpenEmailComposeEvent);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleHeaderKeydown);
  window.removeEventListener('arivu:open-email-compose', onOpenEmailComposeEvent);
});

useArivuDataChangeRefresh({
  getModuleKey: () => 'deals',
  getRecordId: () => String(effectiveDealId.value || deal.value?._id || ''),
  onChange: (detail) => {
    if (detail?.patch && typeof detail.patch === 'object' && deal.value) {
      Object.assign(deal.value, detail.patch);
    }
    void fetchDeal();
  },
});

watch(showEditModal, (open) => {
  if (open) ensureDealLookups();
});

watch(effectiveDealId, (nextId, prevId) => {
  if (nextId && nextId !== prevId) {
    resetDealRelationshipState();
  }
});

// Keep tab title in sync with deal name when deal loads or name changes.
// Only update when the tab's path actually contains this deal id – never update the list tab (/deals).
watch(
  () => [activeTabId.value, deal.value?._id, deal.value?.name],
  ([tabId, dealId, name]) => {
    if (!tabId || name === undefined || !dealId) return;
    const tab = findTabById(tabId);
    if (!tab || !tab.path) return;
    const pathBase = tab.path.split('?')[0].replace(/\/$/, '');
    if (pathBase === '/deals') return; // list tab – never overwrite with record name
    if (!tab.path.includes(String(dealId))) return; // only update the tab that shows this record
    updateTabTitle(tabId, String(name || dealModuleLabel.value).trim() || dealModuleLabel.value);
  },
  { immediate: true }
);

const openLeftSection = (sectionKey) => {
  const normalized = String(sectionKey || '').trim();
  expandedLeftSection.value = normalized;
};

const closeExpandedLeftSection = () => {
  expandedLeftSection.value = '';
};

const selectedDescriptionVersionIndex = ref(0);
const descriptionVersionsLoading = ref(false);
const descriptionRestoreLoading = ref(false);
const descriptionVersionsData = ref({ currentDescription: '', versions: [] });

const descriptionHistoryList = computed(() => {
  if (!deal.value) return [];

  const current = {
    isCurrent: true,
    createdAt: deal.value.updatedAt || deal.value.createdAt || new Date(),
    createdBy: authStore.user
      ? [authStore.user.firstName, authStore.user.lastName].filter(Boolean).join(' ').trim() || authStore.user.email
      : 'You',
    content: descriptionVersionsData.value?.currentDescription ?? deal.value.description ?? ''
  };

  const historical = (descriptionVersionsData.value?.versions || [])
    .map((log) => ({
      isCurrent: false,
      createdAt: log?.createdAt || null,
      createdBy: String(log?.createdBy || 'Unknown'),
      content: String(log?.content ?? '')
    }));

  return [current, ...historical];
});

const canViewDescriptionHistory = computed(() => descriptionHistoryList.value.length > 1);

const formatDescriptionVersionDate = (date) => {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return formatUserDateTime(parsed);
};

const getPlainTextFromHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

const diffWordsToHtml = (oldText, newText) => {
  const oldParts = String(oldText || '').split(/(\s+)/);
  const newParts = String(newText || '').split(/(\s+)/);
  const escape = (value) => {
    const element = document.createElement('div');
    element.textContent = value;
    return element.innerHTML;
  };

  const result = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldParts.length || newIndex < newParts.length) {
    if (oldIndex < oldParts.length && newIndex < newParts.length && oldParts[oldIndex] === newParts[newIndex]) {
      result.push(escape(oldParts[oldIndex]));
      oldIndex += 1;
      newIndex += 1;
      continue;
    }

    if (newIndex < newParts.length && !oldParts.slice(oldIndex).includes(newParts[newIndex])) {
      result.push(`<ins class="bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200 no-underline">${escape(newParts[newIndex])}</ins>`);
      newIndex += 1;
      continue;
    }

    if (oldIndex < oldParts.length) {
      result.push(`<del class="bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 line-through">${escape(oldParts[oldIndex])}</del>`);
      oldIndex += 1;
      continue;
    }

    if (newIndex < newParts.length) {
      result.push(`<ins class="bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200 no-underline">${escape(newParts[newIndex])}</ins>`);
      newIndex += 1;
    }
  }

  return result.join('');
};

const descriptionHistorySelectedContent = computed(() => {
  const selected = descriptionHistoryList.value[selectedDescriptionVersionIndex.value];
  const raw = String(selected?.content || '');
  if (!raw.trim()) return '';
  return sanitizeRichDescriptionHtml(raw);
});

const descriptionHistoryShowDiff = computed(() => descriptionHistoryList.value.length > 1 && selectedDescriptionVersionIndex.value > 0);

const descriptionHistoryDiffHtml = computed(() => {
  if (!descriptionHistoryShowDiff.value) return '';
  const list = descriptionHistoryList.value;
  const currentVersion = list[0];
  const selectedVersion = list[selectedDescriptionVersionIndex.value];
  if (!currentVersion || !selectedVersion) return '';

  const oldPlain = getPlainTextFromHtml(selectedVersion.content);
  const newPlain = getPlainTextFromHtml(currentVersion.content);
  const diffHtml = diffWordsToHtml(oldPlain, newPlain);

  return DOMPurify.sanitize(diffHtml, { ALLOWED_TAGS: ['ins', 'del'], ALLOWED_ATTR: ['class'] });
});

const descriptionHistorySelectedHasContent = computed(() => {
  const selected = descriptionHistoryList.value[selectedDescriptionVersionIndex.value];
  return Boolean(selected && String(selected.content || '').trim());
});

const openDescriptionHistory = () => {
  selectedDescriptionVersionIndex.value = 0;
  openLeftSection('description-history');
  fetchDescriptionVersions();
};

const fetchDescriptionVersions = async () => {
  if (!deal.value?._id) return;
  descriptionVersionsLoading.value = true;
  try {
    const response = await apiClient.get(`/deals/${deal.value._id}/description-versions`);
    descriptionVersionsData.value = response?.data || { currentDescription: deal.value?.description || '', versions: [] };
  } catch (error) {
    console.error('Fetch deal description versions failed:', error);
    descriptionVersionsData.value = { currentDescription: deal.value?.description || '', versions: [] };
  } finally {
    descriptionVersionsLoading.value = false;
  }
};

const restoreDescriptionVersion = async () => {
  if (selectedDescriptionVersionIndex.value === 0) return;
  if (!deal.value?._id) return;

  const apiIndex = selectedDescriptionVersionIndex.value - 1;
  if (apiIndex < 0) return;

  descriptionRestoreLoading.value = true;
  try {
    const response = await apiClient.post(`/deals/${deal.value._id}/description-versions/restore`, {
      versionIndex: apiIndex
    });
    if (response?.data) {
      deal.value = response.data;
      selectedDescriptionVersionIndex.value = 0;
      closeExpandedLeftSection();
    }
  } finally {
    descriptionRestoreLoading.value = false;
  }
};

const handlePlaybookActionStatusChange = async (record, actionKey, status) => {
  if (!record?._id || !actionKey) return null;
  try {
    const response = await apiClient.patch(`/deals/${record._id}/playbook-state/actions/${actionKey}`, {
      status
    });
    if (response?.success && response?.data) {
      deal.value = response.data;
      return response.data;
    }
    await fetchDeal();
    return deal.value;
  } catch (err) {
    console.error('Failed to update playbook action status:', err);
    return null;
  }
};

const dealSectionContext = computed(() => ({
  module: 'deal',
  expandedLeftSection: expandedLeftSection.value,
  openLeftSection,
  closeExpandedLeftSection,
  openTab,
  canEditPlaybook: authStore.can('deals', 'edit'),
  canEditDetails: () => authStore.can('deals', 'edit'),
  onSectionUpdated: ({ sectionKey, payload }) => {
    if (sectionKey !== 'lines' || !payload?.deal || !deal.value) return;
    deal.value = {
      ...deal.value,
      amount: payload.deal.amount ?? deal.value.amount,
      amountMode: payload.deal.amountMode ?? deal.value.amountMode,
      linesGrandTotal: payload.deal.linesGrandTotal ?? deal.value.linesGrandTotal
    };
    dispatchRecordUpdated({ moduleKey: 'deals', recordId: deal.value._id, record: deal.value });
  },
  openTagsEditor: (...args) => openTagPopoverFromField(...args),
  getTagChipClass: getDealTagChipClass,
  getStateFieldOptions: (fieldKey) => {
    if (fieldKey === 'contactId') return dealPeopleOptions.value.map((p) => ({ value: p._id, label: p.name }));
    if (fieldKey === 'accountId') return dealOrganizationOptions.value.map((o) => ({ value: o._id, label: o.name }));
    return [];
  },
  getDetailFieldOptions: (fieldKey) => {
    if (fieldKey === 'contactId') return dealPeopleOptions.value.map((p) => ({ value: p._id, label: p.name }));
    if (fieldKey === 'accountId') return dealOrganizationOptions.value.map((o) => ({ value: o._id, label: o.name }));
    return [];
  }
}));

const dealDetailsPaneContext = computed(() => ({
  expandedLeftSection: '',
  module: 'deal',
  moduleKey: 'deals',
  openTab,
  fieldContext: resolveFieldContext(route.path, route.query),
  hideHeader: true
}));

const dealDetailsPaneAdapter = computed(() => {
  if (!deal.value?._id || !dealModuleDefinition.value) return null;
  return createGenericRecordAdapter({
    sectionLabels: createRecordSectionLabels(t),
    formatDate: (d) =>
      (d ? formatUserDate(d) : '—'),
    moduleDefinition: dealModuleDefinition.value,
    canEditDetails: () => canEditDeal.value,
    saveDetailField: handleDealDetailFieldSave,
    getEntityOptions: (fieldKey) => {
      const key = String(fieldKey || '').toLowerCase().trim();
      if (key === 'contactid') return dealPeopleOptions.value;
      if (key === 'accountid' || key === 'organizationrefid') return dealOrganizationOptions.value;
      if (
        key === 'assignedto' ||
        key === 'assignedto' ||
        key === 'createdby' ||
        key === 'updatedby' ||
        key === 'modifiedby'
      ) {
        return dealUsers.value;
      }
      return [];
    }
  });
});

const handleEmbedClose = () => {
  if (props.embed) emit('close');
};

const handleDealDescriptionSave = async (value) => {
  if (!deal.value?._id) return;
  const nextDescription = String(value || '').trim();
  if (nextDescription === String(deal.value?.description || '').trim()) return;
  try {
    const response = await apiClient.put(`/deals/${deal.value._id}`, {
      description: nextDescription
    });
    if (response?.success && response?.data) {
      deal.value = response.data;
    } else {
      await fetchDeal();
    }
    dispatchRecordUpdated({ moduleKey: 'deals', recordId: deal.value?._id, record: deal.value });
    await fetchActivityLogs();
    await nextTick();
    requestAnimationFrame(() => {
      activityTimelineRef.value?.scrollToBottom?.({ behavior: 'smooth' });
    });
  } catch (err) {
    console.error('Failed to save deal description:', err);
  }
};

const handleDealTitleSave = async (value) => {
  if (!deal.value?._id) return;
  const nextName = String(value || '').trim();
  const currentName = String(deal.value?.name || '').trim();
  if (!nextName || nextName === currentName) return;

  try {
    const response = await apiClient.put(`/deals/${deal.value._id}`, {
      name: nextName
    });
    if (response?.success && response?.data) {
      deal.value = response.data;
    } else {
      await fetchDeal();
    }
    dispatchRecordUpdated({ moduleKey: 'deals', recordId: deal.value?._id, record: deal.value });
  } catch (err) {
    console.error('Failed to save deal title:', err);
  }
};

const handleDealDetailFieldSave = async (fieldKey, value) => {
  if (!deal.value?._id) return;
  if (!fieldKey) return;

  const currentRawValue = deal.value?.[fieldKey];

  const resolveReferenceId = (input) => {
    if (input == null || input === '') return null;
    if (typeof input === 'object') {
      return input._id || input.id || null;
    }
    return String(input);
  };

  let nextValue = value;
  if (fieldKey === 'expectedCloseDate') {
    const normalizedDateValue = value ? String(value).trim() : '';
    nextValue = normalizedDateValue ? normalizedDateValue : null;
    const currentDateValue = currentRawValue ? String(currentRawValue).slice(0, 10) : null;
    if ((nextValue || null) === (currentDateValue || null)) {
      return;
    }
  } else if (fieldKey === 'assignedTo' || fieldKey === 'accountId' || fieldKey === 'contactId') {
    const currentComparable = resolveReferenceId(currentRawValue);
    const nextComparable = resolveReferenceId(value);
    if ((currentComparable || null) === (nextComparable || null)) {
      return;
    }
    nextValue = nextComparable;
  } else {
    const currentComparable = currentRawValue == null ? null : String(currentRawValue);
    const nextComparable = value == null ? null : String(value);
    if (currentComparable === nextComparable) {
      return;
    }
  }

  try {
    const response = await apiClient.put(`/deals/${deal.value._id}`, {
      [fieldKey]: nextValue
    });
    if (response?.success && response?.data) {
      deal.value = response.data;
    } else {
      await fetchDeal();
    }
    dispatchRecordUpdated({ moduleKey: 'deals', recordId: deal.value?._id, record: deal.value });
    await refreshRelatedRecordsAfterLookupFieldSave({
      moduleKey: 'deals',
      fieldKey,
      value: nextValue,
      moduleDefinition: dealModuleDefinition,
      recordContextRef: dealRecordContext,
      contextRevisionRef: dealContextRevision,
      appKey: 'SALES',
      recordId: deal.value._id,
      loadRecordContext: loadDealRecordContext,
      lookupLists: {
        organizations: dealOrganizationOptions.value,
        people: dealPeopleOptions.value
      }
    });
  } catch (err) {
    console.error('Failed to save deal detail field:', err);
  }
};

const openDealDetailFieldEditor = () => {
  showEditModal.value = true;
};

const setRightPaneActiveTab = (tabId) => {
  if (!tabId || !rightPaneRef.value) return;
  const activeTabRef = rightPaneRef.value.activeTab;
  if (activeTabRef && typeof activeTabRef === 'object' && 'value' in activeTabRef) {
    activeTabRef.value = tabId;
    return;
  }
  rightPaneRef.value.activeTab = tabId;
};

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

const getDealRelatedGroups = () => dealRelatedGroupsFromContext.value;

const openDealRelatedItem = (item) => {
  if (!item) return;
  if (item.action === 'add-event') {
    openCreateEvent();
    return;
  }
  setRightPaneActiveTab('related');
};

const handleUnlinkDealRelated = async (item, group, record) => {
  if (!record?._id || !item?.id || !group?.key) return;
  const dealRef = { appKey: 'SALES', moduleKey: 'deals', recordId: record._id };
  const relatedRef = { appKey: item.appKey || 'SALES', moduleKey: item.moduleKey || '', recordId: item.id };
  const isDealSource = (item.direction || 'SOURCE').toUpperCase() === 'SOURCE';
  const source = isDealSource ? dealRef : relatedRef;
  const target = isDealSource ? relatedRef : dealRef;
  try {
    await apiClient.post('/relationships/unlink', {
      relationshipKey: group.key,
      source,
      target
    });
    invalidateRecordContext('SALES', 'deals', record._id);
    await loadDealRecordContext(true);
  } catch (err) {
    console.error('Error unlinking related record:', err);
    notifications.error(t('records.genericUnlinkFailed'));
  }
};

const dealRecordAdapter = computed(() => createDealRecordAdapter({
  sectionLabels: createRecordSectionLabels(t),
  formatDate,
  moduleDefinition: dealModuleDefinition,
  participantPersonName,
  participantOrgName,
  participantRoleLabel,
  allPeople,
  allOrgs,
  canEditDetails: () => authStore.can('deals', 'edit'),
  saveDetailField: handleDealDetailFieldSave,
  openDetailFieldEditor: openDealDetailFieldEditor,
  openCreateEvent,
  getRelatedGroups: getDealRelatedGroups,
  openRelatedItem: openDealRelatedItem,
  canUnlinkRelated: () => canLinkRecords.value,
  onUnlinkRelated: handleUnlinkDealRelated,
  canLinkRecords: canLinkRecords.value,
  openLinkRecordDrawer,
  openAddRecordDrawer,
  handleDescriptionSave: handleDealDescriptionSave,
  canEditDescription: true,
  canViewDescriptionHistory: () => true,
  openDescriptionHistory,
  expandedLeftSection,
  openLeftSection,
  onPlaybookActionStatusChange: handlePlaybookActionStatusChange
}));

const dealStateFields = computed(() => {
  const fields = dealRecordAdapter.value.getStateFields?.(deal.value, dealSectionContext.value);
  if (!Array.isArray(fields)) return [];
  return fields.map((field) => {
    if (!SLOT_RENDERED_KEY_FIELDS.has(field?.key)) return field;
    return {
      ...field,
      canEdit: false
    };
  });
});

const selectedDealOwnerId = computed(() => {
  const owner = deal.value?.assignedTo;
  if (!owner) return null;
  if (typeof owner === 'object') return owner._id || owner.id || null;
  return owner;
});

const selectedDealOrganizationId = computed(() => {
  const organization = deal.value?.accountId;
  if (!organization) return null;
  if (typeof organization === 'object') return organization._id || organization.id || null;
  return organization;
});

const selectedDealContactId = computed(() => {
  const contact = deal.value?.contactId;
  if (!contact) return null;
  if (typeof contact === 'object') return contact._id || contact.id || null;
  return contact;
});

const dealStageField = computed(() => dealStateFields.value.find((field) => field?.key === 'stage') || null);

// Stage options only from the deal's pipeline — fully dependent on pipeline; no fallback to module field options
const dealStageOptions = computed(() => {
  const pipelineSettings = dealModuleDefinition.value?.pipelineSettings;
  const dealPipelineKey = deal.value?.pipeline;
  if (!dealPipelineKey || !Array.isArray(pipelineSettings) || pipelineSettings.length === 0) {
    return [];
  }
  const pipeline = pipelineSettings.find((p) => p.key === dealPipelineKey)
    || pipelineSettings.find((p) => p.isDefault)
    || pipelineSettings[0];
  const pipelineStages = pipeline?.stages || [];
  if (pipelineStages.length === 0) return [];
  return pipelineStages.map((s) => {
    const name = (s.name || '').trim();
    if (!name) return null;
    const label = resolveStageOrPicklistLabel(name, t, te) || name;
    return {
      value: name,
      label,
      color: (s.color && /^#[0-9A-Fa-f]{6}$/.test(String(s.color).trim())) ? String(s.color).trim() : null
    };
  }).filter(Boolean);
});

const canEditDealStage = computed(() => authStore.can('deals', 'edit') && dealStageOptions.value.length > 0);
const canEditDealKeyFields = computed(() => authStore.can('deals', 'edit'));
const canInlineEditDealOwner = computed(() => canEditDealKeyFields.value);
const dealOrganizationOptions = computed(() => {
  const merged = [];
  const seen = new Set();

  const addOrganization = (organization) => {
    if (!organization || typeof organization !== 'object') return;
    const id = organization._id || organization.id;
    if (!id) return;
    const normalizedId = String(id);
    if (seen.has(normalizedId)) return;
    seen.add(normalizedId);
    merged.push({
      _id: normalizedId,
      name: organization.name || organization.title || t('records.dealUnnamedOrganization')
    });
  };

  for (const organization of dealOrganizationsList.value) {
    addOrganization(organization);
  }

  if (deal.value?.accountId && typeof deal.value.accountId === 'object') {
    addOrganization(deal.value.accountId);
  }

  const relations = Array.isArray(deal.value?.dealOrganizations) ? deal.value.dealOrganizations : [];
  for (const relation of relations) {
    if (relation?.organizationId && typeof relation.organizationId === 'object') {
      addOrganization(relation.organizationId);
    }
  }

  return merged;
});
const canInlineEditDealOrganization = computed(() => canEditDealKeyFields.value);

const dealPeopleOptions = computed(() => {
  const merged = [];
  const seen = new Set();

  const addPerson = (person) => {
    if (!person || typeof person !== 'object') return;
    const id = person._id || person.id;
    if (!id) return;
    const normalizedId = String(id);
    if (seen.has(normalizedId)) return;
    seen.add(normalizedId);
    const first = person.firstName || person.first_name || '';
    const last = person.lastName || person.last_name || '';
    const name = [first, last].filter(Boolean).join(' ').trim() || person.email || person.name || t('records.dealUnnamedPerson');
    merged.push({ _id: normalizedId, name });
  };

  for (const person of dealPeopleList.value) {
    addPerson(person);
  }
  if (deal.value?.contactId && typeof deal.value.contactId === 'object') {
    addPerson(deal.value.contactId);
  }
  const relations = Array.isArray(deal.value?.dealPeople) ? deal.value.dealPeople : [];
  for (const relation of relations) {
    if (relation?.personId && typeof relation.personId === 'object') {
      addPerson(relation.personId);
    }
  }
  return merged;
});
const canInlineEditDealContact = computed(() => canEditDealKeyFields.value);

const dealStateValues = computed(() => {
  const values = dealRecordAdapter.value.getStateValues?.(deal.value, dealSectionContext.value);
  return values && typeof values === 'object' ? values : {};
});

const findDealStageOption = (stageValue) => {
  const lookup = String(stageValue || '').trim();
  if (!lookup) return null;
  return dealStageOptions.value.find((option) => String(option.value) === lookup) || null;
};

function translatePicklistValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return resolveStageOrPicklistLabel(raw, t, te) || raw;
}

const formatDealStage = (stageValue) => {
  const configured = findDealStageOption(stageValue);
  const label = configured?.label || stageValue;
  return translatePicklistValue(label) || label || null;
};

const getStagePillClass = (stageValue) => {
  const configured = findDealStageOption(stageValue);
  if (configured?.color) return '';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-100';
};

const getStagePillDividerClass = (stageValue) => {
  const configured = findDealStageOption(stageValue);
  if (configured?.color) return '';
  return 'border-gray-300 dark:border-gray-500';
};

const getStagePillStyle = (stageValue) => {
  const configured = findDealStageOption(stageValue);
  if (!configured?.color) return null;
  return picklistChipStyle(configured.color);
};

const getStagePillDividerStyle = (stageValue) => {
  const configured = findDealStageOption(stageValue);
  if (!configured?.color) return null;
  const style = picklistChipStyle(configured.color);
  return style.borderColor ? { borderColor: style.borderColor } : null;
};

const handleDealStageSave = async (stageValue) => {
  await handleDealDetailFieldSave('stage', stageValue);
};

const formatDealAmount = (amountValue) => {
  if (amountValue == null || amountValue === '') return null;
  const numericValue = Number(amountValue);
  if (!Number.isFinite(numericValue)) return String(amountValue);
  const currencyCode = resolveOrgCurrencyCode(deal.value?.currency || authStore.organization);
  return formatCurrencyValue(numericValue, { currencyCode });
};

const formatDealProbability = (probabilityValue) => {
  if (probabilityValue == null || probabilityValue === '') return null;
  const numericValue = Number(probabilityValue);
  if (!Number.isFinite(numericValue)) return String(probabilityValue);
  return `${Math.round(numericValue)}%`;
};

const formatDealCloseDate = (dateValue) => {
  if (!dateValue) return null;
  return formatDate(dateValue);
};

const formatDealOwnerName = (dealValue) => {
  const owner = dealValue?.assignedTo;
  if (!owner) return null;
  if (typeof owner === 'string') return owner;
  return [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.email || null;
};

const getDealUserDisplayName = (user) => {
  if (!user) return t('records.editableUnknownUser');
  return [user.firstName || user.first_name, user.lastName || user.last_name].filter(Boolean).join(' ')
    || user.email
    || user.username
    || t('records.editableUnknownUser');
};

const dealOwnerAvatarUser = computed(() => {
  const owner = deal.value?.assignedTo;
  if (!owner || typeof owner !== 'object') return null;
  return {
    firstName: owner.firstName || owner.first_name || '',
    lastName: owner.lastName || owner.last_name || '',
    email: owner.email || '',
    avatar: owner.avatar || ''
  };
});

const formatDealOrganizationName = (dealValue) => {
  const organization = dealValue?.accountId;
  if (!organization) return null;
  if (typeof organization === 'string') return organization;
  return organization.name || null;
};

const formatDealContactName = (dealValue) => {
  const contact = dealValue?.contactId;
  if (!contact) return null;
  if (typeof contact === 'string') {
    const option = dealPeopleOptions.value.find((p) => String(p._id) === contact);
    return option?.name ?? null;
  }
  const first = contact.firstName || contact.first_name || '';
  const last = contact.lastName || contact.last_name || '';
  const name = [first, last].filter(Boolean).join(' ').trim();
  return name || contact.name || contact.email || null;
};

const syncInlineKeyFieldEditors = () => {
  localAmount.value = deal.value?.amount != null ? String(deal.value.amount) : '';
  localProbability.value = deal.value?.probability != null ? String(deal.value.probability) : '';
  localExpectedCloseDate.value = deal.value?.expectedCloseDate
    ? String(deal.value.expectedCloseDate).slice(0, 10)
    : '';
};

watch(deal, () => {
  if (!isEditingAmount.value && !isEditingProbability.value && !isEditingExpectedCloseDate.value) {
    syncInlineKeyFieldEditors();
  }
}, { immediate: true });

const startAmountEdit = async () => {
  if (!canEditDealKeyFields.value) return;
  isEditingAmount.value = true;
  localAmount.value = deal.value?.amount != null ? String(deal.value.amount) : '';
  await nextTick();
  amountInputRef.value?.focus?.();
};

const handleAmountCancel = () => {
  localAmount.value = deal.value?.amount != null ? String(deal.value.amount) : '';
  isEditingAmount.value = false;
};

const handleAmountBlur = async () => {
  if (!isEditingAmount.value) return;
  const trimmed = String(localAmount.value || '').trim();
  const nextValue = trimmed === '' ? null : Number(trimmed);
  if (trimmed !== '' && !Number.isFinite(nextValue)) {
    handleAmountCancel();
    return;
  }
  await handleDealDetailFieldSave('amount', nextValue);
  isEditingAmount.value = false;
};

const startProbabilityEdit = async () => {
  if (!canEditDealKeyFields.value) return;
  isEditingProbability.value = true;
  localProbability.value = deal.value?.probability != null ? String(deal.value.probability) : '';
  await nextTick();
  probabilityInputRef.value?.focus?.();
};

const handleProbabilityCancel = () => {
  localProbability.value = deal.value?.probability != null ? String(deal.value.probability) : '';
  isEditingProbability.value = false;
};

const handleProbabilityBlur = async () => {
  if (!isEditingProbability.value) return;
  const trimmed = String(localProbability.value || '').trim();
  if (trimmed === '') {
    await handleDealDetailFieldSave('probability', null);
    isEditingProbability.value = false;
    return;
  }
  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue)) {
    handleProbabilityCancel();
    return;
  }
  const clampedValue = Math.min(100, Math.max(0, Math.round(numericValue)));
  await handleDealDetailFieldSave('probability', clampedValue);
  isEditingProbability.value = false;
};

const startExpectedCloseDateEdit = async () => {
  if (!canEditDealKeyFields.value) return;
  isEditingExpectedCloseDate.value = true;
  localExpectedCloseDate.value = deal.value?.expectedCloseDate
    ? String(deal.value.expectedCloseDate).slice(0, 10)
    : '';
  await nextTick();
  expectedCloseDateInputRef.value?.focus?.();
  expectedCloseDateInputRef.value?.open?.();
};

const handleExpectedCloseDateCancel = () => {
  localExpectedCloseDate.value = deal.value?.expectedCloseDate
    ? String(deal.value.expectedCloseDate).slice(0, 10)
    : '';
  isEditingExpectedCloseDate.value = false;
};

const handleExpectedCloseDateBlur = async () => {
  if (!isEditingExpectedCloseDate.value) return;
  const trimmed = String(localExpectedCloseDate.value || '').trim();
  await handleDealDetailFieldSave('expectedCloseDate', trimmed || null);
  isEditingExpectedCloseDate.value = false;
};

/** Section keys that are part of the left-column SectionStack (not full-page views like description-history). */
const DEAL_STACK_SECTION_KEYS = ['description', 'details', 'stage-history', 'related'];

const shouldRenderDealSectionStack = computed(() => {
  const sectionKey = expandedLeftSection.value;
  if (!sectionKey) return true;
  return DEAL_STACK_SECTION_KEYS.includes(sectionKey);
});

const dealSections = computed(() => dealRecordAdapter.value.getSections());

const isDealDetailRoute = () => {
  if (route.name === 'deal-detail') return true;
  return typeof route.path === 'string' && route.path.startsWith('/deals/');
};

const primaryContact = computed(() => {
  if (!deal.value) return null;
  if (deal.value.dealPeople && Array.isArray(deal.value.dealPeople)) {
    const primary = deal.value.dealPeople.find(
      (p) => p.isPrimary && p.isActive && p.personId
    );
    if (primary && primary.personId) {
      return typeof primary.personId === 'object' ? primary.personId : null;
    }
  }
  if (deal.value.contactId) {
    return typeof deal.value.contactId === 'object' ? deal.value.contactId : null;
  }
  return null;
});

const primaryCustomer = computed(() => {
  if (!deal.value) return null;
  if (deal.value.dealOrganizations && Array.isArray(deal.value.dealOrganizations)) {
    const primary = deal.value.dealOrganizations.find(
      (o) => o.isPrimary && o.isActive && o.role === 'customer' && o.organizationId
    );
    if (primary && primary.organizationId) {
      return typeof primary.organizationId === 'object' ? primary.organizationId : null;
    }
  }
  if (deal.value.accountId) {
    return typeof deal.value.accountId === 'object' ? deal.value.accountId : null;
  }
  return null;
});

const allPeople = computed(() => {
  if (!deal.value?.dealPeople || !Array.isArray(deal.value.dealPeople)) return [];
  return deal.value.dealPeople.filter((p) => p.personId && p.isActive !== false);
});

const allOrgs = computed(() => {
  if (!deal.value?.dealOrganizations || !Array.isArray(deal.value.dealOrganizations)) return [];
  return deal.value.dealOrganizations.filter((o) => o.organizationId && o.isActive !== false);
});

const hasMultipleParticipants = computed(() => allPeople.value.length > 1 || allOrgs.value.length > 1);

const weightedAmount = computed(() => {
  const amount = Number(deal.value?.amount || 0);
  const probability = Number(deal.value?.probability || 0);
  return Math.round((amount * probability) / 100);
});

const dealWeightedLabel = computed(() => t('records.dealWeightedAmount', {
  amount: formatCurrencyValue(weightedAmount.value, {
    currencyCode: resolveOrgCurrencyCode(deal.value?.currency || authStore.organization),
  }) ?? '—',
}));

const dealStarAriaLabel = computed(() => (
  isFollowing.value ? t('records.dealUnstarAria') : t('records.dealStarAria')
));

const linkRecordDrawerTitle = computed(() => (
  allowCreateFromLinkDrawer.value
    ? t('records.genericLinkDrawerAddAndLink')
    : t('records.genericLinkDrawerLink')
));

const commentEvents = computed(() => {
  return (comments.value || []).map((comment) => normalizeCommentActivityEvent({
    ...comment,
    recordRef: {
      module: 'deals',
      id: String(deal.value?._id || '')
    }
  }));
});

const systemEvents = computed(() => {
  return (activityLogs.value || []).flatMap((log) => {
    const fields = Array.isArray(log?.details?.fields)
      ? log.details.fields.map((field) => String(field || '').trim()).filter(Boolean)
      : [];

    if (!log?.details?.field && fields.length > 0) {
      const hasFieldDiffMap = Boolean(log?.details?.fromByField && log?.details?.toByField);
      if (!hasFieldDiffMap) {
        return [];
      }

      return fields
        .filter((field) => log?.details?.fromByField?.[field] != null || log?.details?.toByField?.[field] != null)
        .map((field, index) => {
        const normalized = {
          ...log,
          _id: `${String(log?._id || log?.id || log?.timestamp || Date.now())}-${index}`,
          action: 'field_changed',
          details: {
            ...log?.details,
            field,
            fieldLabel: toReadableFieldLabel(field),
            from: log?.details?.fromByField?.[field] ?? keyFieldsEmptyLabel.value,
            to: log?.details?.toByField?.[field] ?? keyFieldsEmptyLabel.value
          }
        };

        return normalizeSystemActivityEvent(normalized, {
          message: formatActivityLog(normalized),
          recordRef: {
            module: 'deals',
            id: String(deal.value?._id || '')
          },
          source: normalized?.user || normalized?.userId ? 'user' : 'system'
        });
      });
    }

    let descriptionDiffHtml = null;
    let descriptionImageChanges = [];
    let message = formatActivityLog(log);
    if (isDescriptionActivityFieldChange(log?.action, log?.details)) {
      const fromValue = log?.details?.from ?? log?.details?.oldValue ?? '';
      const toValue = log?.details?.to ?? log?.details?.newValue ?? '';
      const descriptionDiff = buildDescriptionActivityDiff(fromValue, toValue);
      const descActor = (String(authStore?.user?._id || '') && log?.userId != null && String(log.userId) === String(authStore?.user?._id || '')) ? 'You' : (log?.user || 'Someone');
      message = `${descActor} changed description`;
      descriptionDiffHtml = descriptionDiff.diffHtml;
      descriptionImageChanges = descriptionDiff.imageChanges;
    }

    return [normalizeSystemActivityEvent(log, {
      message,
      descriptionDiffHtml,
      descriptionImageChanges,
      recordRef: {
        module: 'deals',
        id: String(deal.value?._id || '')
      },
      source: log?.user || log?.userId ? 'user' : 'system'
    })];
  });
});

const emailThreadEvents = computed(() => {
  return (emailThreads.value || [])
    .map((thread) => normalizeEmailThreadActivityEvent({
      ...thread,
      recordRef: {
        module: 'deals',
        id: String(deal.value?._id || '')
      },
      source: 'integration'
    }));
});

const activityTimelineEvents = computed(() => {
  const threadedCommunicationIds = new Set(
    (emailThreads.value || [])
      .flatMap((thread) => (thread.messages || []).map((msg) => String(msg?._id || '')))
      .filter(Boolean)
  );
  const filteredSystemEvents = (systemEvents.value || []).filter((event) => {
    if (event?.type !== 'system') return true;
    const commId = String(event?.details?.communicationId || event?.payload?.details?.communicationId || '');
    if (!commId) return true;
    return !threadedCommunicationIds.has(commId);
  });
  return sortActivityEventsByDate([
    ...commentEvents.value,
    ...filteredSystemEvents,
    ...emailThreadEvents.value
  ]);
});

const getCommentEventId = (event) => String(event?.id || event?._id || event?.commentId || '');

const getParentCommentId = (event) => {
  const rawParentId = event?.parentCommentId;
  if (!rawParentId) return '';
  if (typeof rawParentId === 'object') {
    return String(rawParentId._id || rawParentId.id || '');
  }
  return String(rawParentId);
};

const commentActivityEvents = computed(() => (
  activityTimelineEvents.value.filter((event) => event.type === 'comment')
));

const commentEventsById = computed(() => {
  const map = new Map();
  commentActivityEvents.value.forEach((event) => {
    const id = getCommentEventId(event);
    if (id) map.set(id, event);
  });
  return map;
});

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
    const parentId = getParentCommentId(event);
    if (!parentId || parentId === eventId) return;
    const bucket = map.get(parentId) || [];
    bucket.push(event);
    map.set(parentId, bucket);
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

const filteredActivityTimelineEvents = computed(() => {
  const q = (activitySearchQuery.value || '').trim().toLowerCase();
  return activityTimelineEvents.value.filter((event) => {
    if (event.type === 'comment') {
      if (!activityFilterComments.value) return false;
      if (!q && getParentCommentId(event)) return false;
    }
    if (event.type === 'system' && !activityFilterUpdates.value) return false;
    if (event.type === 'email_thread' && !activityFilterEmail.value) return false;

    if (!q) return true;
    if (event.type === 'comment') {
      if (getParentCommentId(event)) return false;
      const content = String(event.content || event.text || '').toLowerCase();
      const author = String(eventAuthorName(event) || '').toLowerCase();
      return content.includes(q) || author.includes(q);
    }
    if (event.type === 'system') {
      return String(event.message || '').toLowerCase().includes(q);
    }
    return true;
  });
});

const activitySectionEvents = computed(() => {
  if (!isThreadViewActive.value || !activeThreadRootComment.value) {
    return filteredActivityTimelineEvents.value;
  }
  return [activeThreadRootComment.value, ...threadReplyEvents.value];
});

const currentUserId = computed(() => String(authStore?.user?._id || ''));

const loadActivityFilter = () => {
  try {
    const raw = localStorage.getItem(ACTIVITY_FILTER_STORAGE_KEY);
    if (!raw) return { comments: true, updates: true, email: true };
    const parsed = JSON.parse(raw);
    return {
      comments: parsed?.comments !== false,
      updates: parsed?.updates !== false,
      email: parsed?.email !== false
    };
  } catch {
    return { comments: true, updates: true, email: true };
  }
};

const personRoleLabels = {
  decision_maker: 'Decision maker',
  champion: 'Champion',
  influencer: 'Influencer',
  technical_contact: 'Technical contact',
  partner_contact: 'Partner contact',
  procurement: 'Procurement',
  legal: 'Legal',
  other: 'Other',
  // Legacy display fallback
  primary_contact: 'Decision maker',
};
const orgRoleLabels = {
  customer: 'Customer',
  partner: 'Partner',
  reseller: 'Reseller',
  distributor: 'Distributor',
  vendor: 'Vendor',
  other: 'Other',
};

function participantPersonName(entry) {
  const p = entry.personId;
  if (!p) return '—';
  const o = typeof p === 'object' ? p : null;
  if (o) return [o.first_name, o.last_name].filter(Boolean).join(' ') || o.email || '—';
  return '—';
}

function participantOrgName(entry) {
  const o = entry.organizationId;
  if (!o) return '—';
  const obj = typeof o === 'object' ? o : null;
  return obj?.name || '—';
}

function participantRoleLabel(role, kind) {
  if (kind === 'person') return personRoleLabels[role] || role;
  return orgRoleLabels[role] || role;
}

const formatActivityLog = (log) => {
  const currentId = String(authStore?.user?._id || authStore?.user?.id || '');
  const logUserId = log?.userId != null ? String(log.userId) : '';
  const actor = (currentId && logUserId && currentId === logUserId) ? 'You' : (log?.user || 'Someone');
  const action = log?.action || 'updated this deal';
  const details = log?.details || {};

  if (log?.details?.field) {
    const fromValue = log.details?.from ?? log.details?.oldValue ?? '—';
    const toValue = log.details?.to ?? log.details?.newValue ?? '—';
    return `${actor} changed ${log.details.field} from "${fromValue}" to "${toValue}"`;
  }
  if (Array.isArray(log?.details?.fields) && log.details.fields.length > 0) {
    const fields = log.details.fields
      .map((field) => String(field || '').trim())
      .filter(Boolean)
      .join(', ');
    return `${actor} updated ${fields}`;
  }

  const relatedModuleLabel = (rawModuleKey) => {
    const key = String(rawModuleKey || '').toLowerCase();
    const map = { project: 'project', projects: 'project', event: 'event', events: 'event', deal: 'deal', deals: 'deal', form: 'form', forms: 'form', task: 'task', tasks: 'task' };
    return map[key] || 'record';
  };
  const relatedPart = (d) => {
    const label = d?.relatedRecordLabel && String(d.relatedRecordLabel).trim();
    const id = String(d?.relatedRecordId || d?.recordId || '').trim();
    if (label) return ` "${label}"`;
    if (id) return ` (${id.slice(-8)})`;
    return '';
  };

  if (action === 'record_linked') {
    const moduleLabel = relatedModuleLabel(details.relatedModuleKey || details.moduleKey);
    return `${actor} linked a ${moduleLabel}${relatedPart(details)}`;
  }
  if (action === 'record_unlinked') {
    const moduleLabel = relatedModuleLabel(details.relatedModuleKey || details.moduleKey);
    return `${actor} unlinked a ${moduleLabel}${relatedPart(details)}`;
  }

  return `${actor} ${action}`;
};

const fetchActivityLogs = async () => {
  if (!effectiveDealId.value) {
    activityLogs.value = [];
    return;
  }
  try {
    const res = await apiClient.get(`/deals/${effectiveDealId.value}/activity-logs`);
    activityLogs.value = Array.isArray(res?.data) ? res.data : [];
  } catch {
    activityLogs.value = [];
  }
};

const fetchComments = async () => {
  if (!effectiveDealId.value) {
    comments.value = [];
    return;
  }
  try {
    const res = await apiClient.get(`/deals/${effectiveDealId.value}/comments`);
    comments.value = Array.isArray(res?.data) ? res.data : [];
  } catch (err) {
    if (err.status !== 404 && !err.is404) {
      console.error('Error fetching deal comments:', err);
    }
    comments.value = [];
  }
};

const fetchEmailThreads = async () => {
  if (!effectiveDealId.value) {
    emailThreads.value = [];
    return;
  }

  try {
    const response = await apiClient.get('/communications/threads', {
      params: {
        moduleKey: 'deals',
        recordId: effectiveDealId.value,
        includeDone: true
      }
    });

    if (response?.success && response?.data?.threads?.length) {
      emailThreads.value = response.data.threads;
    } else {
      emailThreads.value = [];
    }
  } catch {
    emailThreads.value = [];
  }
};

const fetchDealNavigationIds = async () => {
  if (!effectiveDealId.value || props.embed) {
    dealNavigationIds.value = [];
    return;
  }

  const currentId = String(effectiveDealId.value);
  const navToken = dealNavigationContextToken.value;
  if (navToken) {
    try {
      const raw = sessionStorage.getItem(`${DEAL_NAV_CONTEXT_STORAGE_PREFIX}${navToken}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        const contextIds = Array.isArray(parsed?.ids)
          ? parsed.ids.map((id) => String(id || '').trim()).filter(Boolean)
          : [];
        if (contextIds.includes(currentId)) {
          // Keep existing list when navigating within same list (prevents overwriting with a smaller list)
          const existing = dealNavigationIds.value;
          if (Array.isArray(existing) && existing.length > 0 && existing.includes(currentId)) {
            return;
          }
          dealNavigationIds.value = contextIds;
          return;
        }
      }
    } catch {
    }
  }

  try {
    const response = await apiClient.get('/deals', {
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
      dealNavigationIds.value = ids;
      return;
    }

    dealNavigationIds.value = [currentId];
  } catch {
    dealNavigationIds.value = [currentId];
  }
};

const fetchDealUsers = async () => {
  try {
    const response = await fetchUsersListCached(DEAL_RELATIONSHIP_USERS_PARAMS);
    if (response?.success && Array.isArray(response.data)) {
      dealUsers.value = response.data;
      return;
    }
    if (Array.isArray(response)) {
      dealUsers.value = response;
      return;
    }
    dealUsers.value = [];
  } catch (err) {
    console.error('Error fetching users for deal key fields:', err);
    dealUsers.value = [];
  }
};

const fetchDealOrganizations = async () => {
  try {
    const normalizeCandidates = (response) => {
      if (Array.isArray(response)) return response;
      const candidates = [
        response?.data,
        response?.data?.data,
        response?.data?.items,
        response?.data?.rows,
        response?.organizations,
        response?.data?.organizations
      ];
      for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate;
      }
      return [];
    };

    const primary = await fetchOrganizationsListCached(DEAL_RELATIONSHIP_ORG_PARAMS);
    const primaryList = normalizeCandidates(primary);
    if (primaryList.length > 0) {
      dealOrganizationsList.value = primaryList;
      return;
    }

    const fallback = await apiClient.get('/organization');
    dealOrganizationsList.value = normalizeCandidates(fallback);
  } catch (err) {
    console.error('Error fetching organizations for deal key fields:', err);
    dealOrganizationsList.value = [];
  }
};

const fetchDealPeople = async () => {
  try {
    const normalizeCandidates = (response) => {
      if (Array.isArray(response)) return response;
      const candidates = [
        response?.data,
        response?.data?.data,
        response?.data?.items,
        response?.data?.rows,
        response?.people,
        response?.data?.people
      ];
      for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate;
      }
      return [];
    };
    const response = await fetchPeopleListCached(DEAL_RELATIONSHIP_PEOPLE_PARAMS);
    dealPeopleList.value = normalizeCandidates(response);
  } catch (err) {
    console.error('Error fetching people for deal key fields:', err);
    dealPeopleList.value = [];
  }
};

async function ensureDealLookups() {
  if (!authStore.can('deals', 'edit')) return;
  if (dealLookupsLoaded.value) return;
  if (dealLookupsInflight) {
    await dealLookupsInflight;
    return;
  }
  dealLookupsInflight = Promise.all([
    fetchDealUsers(),
    fetchDealOrganizations(),
    fetchDealPeople(),
  ])
    .catch((err) => {
      console.error('Error loading deal relationship lookups:', err);
    })
    .finally(() => {
      dealLookupsInflight = null;
      dealLookupsLoaded.value = true;
    });
  await dealLookupsInflight;
}

function scheduleDealNavigationIdsFetch() {
  if (props.embed || dealNavigationIdsScheduled) return;
  dealNavigationIdsScheduled = true;
  const run = () => {
    fetchDealNavigationIds().finally(() => {
      dealNavigationIdsScheduled = false;
    });
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 100);
  }
}

function resetDealRelationshipState() {
  dealLookupsLoaded.value = false;
  dealLookupsInflight = null;
  dealUsers.value = [];
  dealOrganizationsList.value = [];
  dealPeopleList.value = [];
  dealNavigationIds.value = [];
  dealNavigationIdsScheduled = false;
}

const fetchDealModuleDefinition = async () => {
  try {
    dealModuleDefinition.value = await fetchModuleDefinitionCached('deals');
  } catch (err) {
    console.error('Error fetching deal module definition:', err);
    dealModuleDefinition.value = null;
  }
};

const fetchDeal = async () => {
  // Only show full-page loading when we have no deal yet (initial load). When navigating
  // prev/next, keep the current layout mounted so content doesn’t jump below the header.
  if (!deal.value) loading.value = true;
  error.value = null;
  activeThreadRootCommentId.value = null;
  cancelEditNote();
  try {
    if (!effectiveDealId.value) {
      error.value = 'Deal not found or access denied.';
      return;
    }
    const data = await apiClient.get(`/deals/${effectiveDealId.value}`);
    if (data.success) {
      deal.value = data.data;
      recordRecordDetailFingerprint('deals', effectiveDealId.value, '', {
        updatedAtMs: extractRecordUpdatedAtMs(deal.value),
      });
    }
    const secondaryTasks = [
      fetchActivityLogs(),
      fetchComments(),
      fetchEmailThreads(),
      fetchDealModuleDefinition()
    ];
    await Promise.all(secondaryTasks);
    scheduleDealNavigationIdsFetch();
  } catch (err) {
    if (err?.status === 404 || err?.is404) {
      error.value = err?.response?.data?.message || err?.message || 'Deal not found or access denied.';
    } else {
      error.value = err?.message || 'Failed to load deal';
    }
  } finally {
    loading.value = false;
  }
};

const formatDate = (date) => {
  if (!date) return '-';
  return formatUserDate(date) || '-';
};

const formatTimeAgo = (date) => formatRelativeTime(date, t);

const handleEmailSubmit = async (payload) => {
  showEmailModal.value = false;
  emailComposeDraft.value = null;
  try {
    const res = await apiClient.post('/communications/email', payload);
    if (res.success) {
      notifications.success(t('records.genericEmailSent'));
      fetchDeal();
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

function onOpenEmailComposeEvent(event) {
  const detail = event?.detail && typeof event.detail === 'object' ? event.detail : null;
  emailComposeDraft.value = detail;
  showEmailModal.value = true;
}

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
        emailThreads.value = emailThreads.value.map((t) => (
          t.threadId === threadId ? { ...t, unread: false } : t
        ));
      } catch {
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

const handleDealUpdated = () => {
  showEditModal.value = false;
  fetchDeal();
  dispatchRecordUpdated({ moduleKey: 'deals', recordId: deal.value?._id, record: deal.value });
};

const handleCopyUrl = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
  } catch {
    notifications.error(t('records.dealCopyUrlFailed'));
  }
};

function getDealPageUrl() {
  if (!deal.value?._id) return '';
  const path = `/deals/${deal.value._id}`;
  const resolved = router.resolve(path);
  return resolved.href.startsWith('http') ? resolved.href : new URL(resolved.href, window.location.origin).href;
}

function openDealInNewTab() {
  if (!deal.value?._id) return;
  const path = `/deals/${deal.value._id}`;
  openTab(path, { title: dealModuleLabel.value, background: false, insertAdjacent: true });
  handleEmbedClose();
}

async function copyDealUrl() {
  const url = getDealPageUrl();
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    notifications.error(t('records.dealCopyUrlFailed'));
  }
}

function closeDuplicateCreate() {
  showDuplicateCreateModal.value = false;
  duplicateInitialData.value = {};
  duplicateSourceId.value = '';
}

const handleDuplicate = () => {
  if (!deal.value) return;
  duplicateSourceId.value = String(deal.value._id || deal.value.id || '');
  duplicateInitialData.value = buildDuplicateInitialData(deal.value, { moduleKey: 'deals' });
  showDuplicateCreateModal.value = true;
};

const handleExport = () => {
  notifications.error(t('records.dealExportNotImplemented'));
};

const canDiscussInChat = computed(() => (
  isAddonEntitled(authStore.user, 'internal_chat')
  && Boolean(deal.value?._id || effectiveDealId.value)
));

async function handleDiscussInChat() {
  try {
    await openRecordDiscussChat({
      moduleKey: 'deals',
      recordId: deal.value?._id || effectiveDealId.value,
      openTab,
      router,
      tabTitle: t('navigation.internalChat'),
    });
  } catch (err) {
    notifications.error(err?.response?.data?.message || t('internalChat.discussFailed'));
  }
}

const confirmDeleteDeal = async () => {
  if (!deal.value?._id || deleting.value) return;
  deleting.value = true;
  try {
    await apiClient.delete(`/deals/${effectiveDealId.value}`);
    showDeleteModal.value = false;
    router.push('/deals');
  } catch {
    notifications.error(t('records.dealDeleteFailed'));
  } finally {
    deleting.value = false;
  }
};

const addComment = async (content = '', attachments = [], parentCommentId = null) => {
  if (!content.trim() && (!attachments || attachments.length === 0)) return;
  try {
    const response = await apiClient.post(`/deals/${effectiveDealId.value}/comments`, {
      content: content.trim(),
      attachments: attachments || [],
      parentCommentId: parentCommentId || null
    });
    if (response.success) {
      await fetchComments();
    }
  } catch (err) {
    console.error('Failed to add comment:', err);
    notifications.error(t('records.dealCommentAddFailed'));
  }
};

const addCommentWithUploads = async (content = '', files = [], parentCommentId = null) => {
  try {
    const attachments = [];
    for (const file of files) {
      const uploaded = await uploadDealCommentAttachmentFile(file);
      if (uploaded) attachments.push(uploaded);
    }
    const finalContent = content || (attachments.length > 0 ? t('records.dealAttachedFilesFallback') : '');
    if (!finalContent) return;
    await addComment(finalContent, attachments, parentCommentId);
  } catch (err) {
    console.error('Failed to add comment with attachments:', err);
    notifications.error(t('records.dealCommentAddFailed'));
  }
};

const handleAddComment = async (payload) => {
  const content = typeof payload === 'string'
    ? payload.trim()
    : String(payload?.content || '').trim();
  const files = Array.isArray(payload?.files) ? payload.files : [];
  if (!content && files.length === 0) return;
  await addCommentWithUploads(content, files, isThreadViewActive.value ? activeThreadRootCommentId.value : null);
  newCommentText.value = '';
  await nextTick();
  if (activityTimelineRef.value?.scrollToBottom) {
    activityTimelineRef.value.scrollToBottom({ behavior: 'smooth' });
  }
};

const eventAuthorName = (event) => {
  const author = event?.author;
  if (!author) return t('records.editableUnknownUser');
  if (typeof author === 'string') return author;
  return [author.firstName, author.lastName].filter(Boolean).join(' ')
    || [author.first_name, author.last_name].filter(Boolean).join(' ')
    || author.email
    || author.username
    || t('records.editableUnknownUser');
};

const canEditNote = (event) => {
  if (!event || event.type !== 'comment') return false;
  const author = event.author || event.actor;
  const authorId = String(author?._id || author?.id || '');
  return Boolean(getCommentEventId(event) && authorId && currentUserId.value && authorId === currentUserId.value);
};

const startEditNote = (event) => {
  if (!canEditNote(event)) return;
  editingNoteId.value = getCommentEventId(event);
  editingNoteText.value = String(event.content || event.text || '');
  const initialAttachments = Array.isArray(event.attachments)
    ? event.attachments.map((attachment) => ({ ...attachment }))
    : [];
  editingNoteAttachments.value = initialAttachments;
  editingNoteOriginalText.value = editingNoteText.value;
  editingNoteOriginalAttachments.value = initialAttachments.map((attachment) => ({ ...attachment }));
  editingNoteHasPendingFiles.value = false;
};

const cancelEditNote = () => {
  editingNoteId.value = '';
  editingNoteText.value = '';
  editingNoteAttachments.value = [];
  editingNoteOriginalText.value = '';
  editingNoteOriginalAttachments.value = [];
  editingNoteHasPendingFiles.value = false;
};

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
  if (!editingNoteId.value) return false;
  const textChanged = String(editingNoteText.value || '').trim() !== String(editingNoteOriginalText.value || '').trim();
  const attachmentsChanged = !areCommentAttachmentListsEqual(editingNoteAttachments.value, editingNoteOriginalAttachments.value);
  return textChanged || attachmentsChanged || editingNoteHasPendingFiles.value;
});

const uploadDealCommentAttachmentFile = async (file) => {
  if (!deal.value?._id || !file) return null;
  const token = authStore.user?.token;
  const formData = new FormData();
  formData.append('file', file);
  const uploadRes = await fetch(`/api/deals/${deal.value._id}/comment-attachments`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });

  if (!uploadRes.ok) {
    const errData = await uploadRes.json().catch(() => ({}));
    console.error('Deal comment attachment upload failed:', uploadRes.status, errData.error || errData.message || uploadRes.statusText);
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
};

const saveEditedNote = async (submitPayload) => {
  const commentId = String(editingNoteId.value || '');
  if (!commentId || savingEditedNote.value || !isEditingCommentDirty.value) return;

  savingEditedNote.value = true;
  try {
    const payload = submitPayload && typeof submitPayload === 'object' ? submitPayload : {};
    const rawContent = typeof payload?.content === 'string' ? payload.content : editingNoteText.value;
    const content = String(rawContent || '').trim();
    const files = Array.isArray(payload?.files) ? payload.files : [];
    const existingAttachments = Array.isArray(payload?.existingAttachments)
      ? payload.existingAttachments
      : editingNoteAttachments.value;

    const uploadedAttachments = [];
    for (const file of files) {
      const uploaded = await uploadDealCommentAttachmentFile(file);
      if (uploaded) uploadedAttachments.push(uploaded);
    }

    const finalAttachments = [
      ...(Array.isArray(existingAttachments) ? existingAttachments : []),
      ...uploadedAttachments
    ].filter((attachment) => attachment && typeof attachment.url === 'string' && typeof attachment.filename === 'string');

    const finalContent = content || (finalAttachments.length > 0 ? t('records.dealAttachedFilesFallback') : '');
    if (!finalContent) return;

    const response = await apiClient.put(`/deals/${effectiveDealId.value}/comments/${commentId}`, {
      content: finalContent,
      attachments: finalAttachments
    });
    if (response?.success) {
      await fetchComments();
      cancelEditNote();
    }
  } catch (err) {
    console.error('Failed to update comment:', err);
    notifications.error(t('records.dealCommentUpdateFailed'));
  } finally {
    savingEditedNote.value = false;
  }
};

const setEditingCommentText = (value) => {
  editingNoteText.value = typeof value === 'string' ? value : '';
};

const setEditingCommentAttachments = (value) => {
  editingNoteAttachments.value = Array.isArray(value) ? value : [];
};

const handleEditCommentFilesChange = (files) => {
  editingNoteHasPendingFiles.value = Array.isArray(files) && files.length > 0;
};

const handleSaveEditCommentClick = () => {
  saveEditedNote();
};

const closeCommentThread = () => {
  activeThreadRootCommentId.value = null;
};

const openCommentThread = (event) => {
  if (!event || event.type !== 'comment') return;
  const commentId = getCommentEventId(event);
  if (!commentId) return;
  activeThreadRootCommentId.value = commentId;
  nextTick(() => {
    activitySectionRef.value?.focusCommentInput?.();
  });
};

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
  return latestReply?.author || latestReply?.actor || null;
};

const formatRelativeActivityTime = (date) => formatTimeAgo(date);

const formatFullTimestamp = (date) => {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return formatUserDateTime(parsed);
};

const handleTimestampPointerUp = () => {};

const getInitials = (author) => {
  if (!author) return 'U';
  const name = typeof author === 'string'
    ? author
    : ([author.firstName, author.lastName].filter(Boolean).join(' ') || [author.first_name, author.last_name].filter(Boolean).join(' ') || author.email || author.username || 'U');
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U';
};

const getAuthorName = (author) => eventAuthorName({ author });

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightSearchText = (text) => {
  if (!text) return '';
  const q = (activitySearchQuery.value || '').trim();
  if (!q) return text;
  const regex = new RegExp(`(${escapeRegExp(q)})`, 'gi');
  return String(text).replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 font-semibold">$1</mark>');
};

const commentMentionsCurrentUser = (event) => {
  const content = String(event?.content || event?.text || '').trim();
  if (!content) return false;
  const userId = String(authStore.user?._id || authStore.user?.id || '');
  if (userId) {
    const mentionByIdRegex = new RegExp(`@\\[[^\\]]+\\]\\(user:${escapeRegExp(userId)}\\)`, 'i');
    if (mentionByIdRegex.test(content)) return true;
  }
  if (/@\[[^\]]+\]\(all:[^)]+\)/i.test(content)) return true;
  const names = [
    [authStore.user?.firstName, authStore.user?.lastName].filter(Boolean).join(' ').trim(),
    authStore.user?.username,
    authStore.user?.email
  ].filter(Boolean).map((value) => String(value).toLowerCase());
  const normalizedContent = content.toLowerCase();
  return names.some((name) => normalizedContent.includes(`@${name}`));
};

const getAttachmentName = (attachment) => String(attachment?.filename || attachment?.name || 'attachment');
const getAttachmentUrl = (attachment) => String(attachment?.url || attachment?.path || '');
const hasAttachmentUrl = (attachment) => Boolean(getAttachmentUrl(attachment));
const isImageAttachment = (attachment) => /^image\//i.test(String(attachment?.mimetype || attachment?.type || '')) || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(getAttachmentName(attachment));
const isSvgAttachment = (attachment) => /svg/i.test(String(attachment?.mimetype || attachment?.type || '')) || /\.svg$/i.test(getAttachmentName(attachment));
const formatFileSize = (bytes) => {
  const value = Number(bytes || 0);
  if (value <= 0) return '0 B';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};
const getAttachmentLabel = (attachment) => {
  const details = [];
  if (attachment?.mimetype) details.push(String(attachment.mimetype));
  if (attachment?.size) details.push(formatFileSize(attachment.size));
  return details.join(' • ') || 'Attachment';
};
const downloadAttachment = (attachment) => {
  const url = getAttachmentUrl(attachment);
  if (!url) return;
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.download = getAttachmentName(attachment);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const getCommentReactions = (event) => {
  return buildCommentReactions(event, { includeLikesFallback: true });
};

const hasCommentReactions = (event) => getCommentReactions(event).length > 0;

const isCommentReactionSelected = (event, emoji) => {
  return isCommentReactionSelectedForUser({
    event,
    emoji,
    currentUserId: authStore.user?._id || authStore.user?.id || '',
    getCommentReactions
  });
};

const commentReactionApi = createCommentReactionApi({
  type: 'deal',
  getDealId: () => effectiveDealId.value || ''
});

const { toggleCommentReaction } = useCommentReactionActions({
  getCommentId: (event) => getCommentEventId(event),
  normalizeEmoji: (emoji) => String(emoji || '').trim(),
  canToggle: () => Boolean(effectiveDealId.value),
  requestToggle: ({ commentId, emoji }) => commentReactionApi.toggleReaction({ commentId, emoji }),
  onSuccess: async () => {
    await fetchComments();
  },
  logPrefix: 'Failed to toggle deal comment reaction:'
});

const findCommentEventByKey = (commentKey) => (
  activitySectionEvents.value.find((event) => {
    if (event?.type !== 'comment') return false;
    const key = event?.id || event?._id || event?.createdAt;
    return String(key || '') === String(commentKey || '');
  }) || null
);

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
  startEmojiThemeObserver,
  stopEmojiThemeObserver,
  cleanupCommentReactionPicker
} = useCommentReactionPicker({
  findCommentEventByKey,
  isCommentReactionSelected,
  toggleCommentReaction
});

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

const isCurrentUserById = (userId) => {
  const currentId = String(authStore.user?._id || authStore.user?.id || '').trim();
  const candidate = String(userId || '').trim();
  return Boolean(currentId && candidate && currentId === candidate);
};

const isCurrentUserByName = (name) => {
  const candidate = String(name || '').trim().toLowerCase();
  if (!candidate) return false;
  const fullName = [authStore.user?.firstName, authStore.user?.lastName].filter(Boolean).join(' ').trim().toLowerCase();
  const username = String(authStore.user?.username || '').trim().toLowerCase();
  const email = String(authStore.user?.email || '').trim().toLowerCase();
  return Boolean(candidate && (candidate === fullName || candidate === username || candidate === email));
};

const resolveActorLabel = (name, userId) => {
  if (isCurrentUserById(userId) || isCurrentUserByName(name)) return t('common.pronounYou');
  return name || t('records.activitySystemActorSystem');
};

const isFieldChangeSystemEvent = (event) => {
  if (!event || event.type !== 'system') return false;
  return event.action === 'field_changed' || event.action === 'status_changed' || Boolean(event?.details?.field || event?.payload?.details?.field);
};

const getSystemEventActorLabel = (event) => {
  if (!event) return t('records.activitySystemActorSystem');
  const author = event.author;
  if (author && typeof author === 'object') {
    const authorName = [author.firstName, author.lastName].filter(Boolean).join(' ').trim() || author.username || author.email || t('records.activitySystemActorSystem');
    return resolveActorLabel(authorName, author._id || author.id);
  }
  if (typeof author === 'string') {
    return resolveActorLabel(author, event.userId || event.user || event.actor);
  }
  if (typeof event.actor === 'string') {
    return resolveActorLabel(event.actor, event.userId || event.user);
  }
  return t('records.activitySystemActorSystem');
};

const getSystemEventFieldLabel = (event) => {
  const details = event?.details || event?.payload?.details || {};
  const raw = details.fieldLabel ?? details.field;
  const key = String(details.field || raw || '').trim();
  return resolveFieldLabel('deals', { key, label: String(raw ?? '').trim() }, t, te) || t('records.activitySystemFieldFallback');
};

const formatSystemEventValue = (value, event) => {
  if (value === undefined || value === null || value === '') return keyFieldsEmptyLabel.value;
  const details = event?.details || event?.payload?.details || {};
  const fieldKey = String(details.field || '').trim();
  const fields = dealModuleDefinition.value?.fields || [];
  const match = fieldKey
    ? fields.find((f) => String(f?.key || '') === fieldKey || String(f?.label || '') === fieldKey)
    : null;
  return formatActivityChangeValue(value, keyFieldsEmptyLabel.value, match?.dataType);
};

const getSystemEventFromValue = (event) => formatSystemEventValue(event?.details?.from ?? event?.details?.oldValue ?? event?.payload?.details?.from ?? event?.payload?.details?.oldValue, event);
const getSystemEventToValue = (event) => formatSystemEventValue(event?.details?.to ?? event?.details?.newValue ?? event?.payload?.details?.to ?? event?.payload?.details?.newValue, event);
const getSystemEventMessage = (event) => {
  if (!event) return t('records.activityUpdatedRecord');
  const processMsg = getProcessActivityMessage(event);
  if (processMsg) return processMsg;
  const actor = getSystemEventActorLabel(event);
  const action = String(event?.action || '').toLowerCase();
  const rawMsg = String(event?.message || event?.payload?.message || '').trim().toLowerCase();
  if (action === 'created' || rawMsg.includes('created this deal')) {
    return t('deals.activityYouCreatedDeal', { actor });
  }
  if (action === 'updated' || rawMsg.includes('updated this deal')) {
    return t('deals.activityYouUpdatedDeal', { actor });
  }
  const message = String(event?.message || event?.payload?.message || '').trim();
  if (message) return message;
  return t('records.activitySystemWithAction', { action: t('records.activityUpdated') });
};
const handleShowMore = () => {};

const setActivityTimelineRef = createActivityTimelineRefSetter(activityTimelineRef);

const dealActivityUi = createDealActivityUi({
  authStore,
  expandedTaskEmailThreads,
  editingNoteId,
  editingNoteText,
  editingNoteAttachments,
  isEditingCommentDirty,
  setEditingCommentText,
  setEditingCommentAttachments,
  handleEditCommentFilesChange,
  saveEditedNote,
  handleSaveEditCommentClick,
  cancelEditNote,
  canEditNote,
  startEditNote,
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
  getTagChipClass: getDealTagChipClass
});

const openCreateEvent = () => {
  eventToEdit.value = {
    relatedTo: {
      type: 'Deal',
      id: deal.value._id
    }
  };
  showEventModal.value = true;
};

const viewEvent = (eventId) => {
  openTab(`/events/${eventId}`, {
    title: 'Event Detail',
    icon: '📅',
    insertAdjacent: true
  });
};

const handleEventSaved = () => {
  showEventModal.value = false;
  eventToEdit.value = null;
  loadDealRecordContext(true);
};

const normalizeModuleKey = (moduleKey) => {
  const map = {
    organization: 'organizations',
    organizations: 'organizations',
    contact: 'people',
    contacts: 'people',
    people: 'people',
    task: 'tasks',
    tasks: 'tasks',
    event: 'events',
    events: 'events',
    form: 'forms',
    forms: 'forms'
  };
  return map[String(moduleKey || '').toLowerCase().trim()] || String(moduleKey || '').toLowerCase().trim();
};

const handleLinkRecordDrawerLinked = async ({ moduleKey, ids, context, relationshipKey: payloadRelationshipKey, targetAppKey: payloadTargetAppKey }) => {
  if (!deal.value || !context?.dealId || deal.value._id !== context.dealId) return;
  if (!ids?.length) return;

  const normalizedModuleKey = normalizeModuleKey(moduleKey);
  const targetAppKeyByModule = {
    events: 'platform',
    tasks: 'platform',
    forms: 'platform',
    projects: 'projects',
    organizations: 'sales',
    people: 'sales',
    documents: 'platform'
  };
  const targetAppKey = payloadTargetAppKey || targetAppKeyByModule[normalizedModuleKey];
  const relationshipKey = payloadRelationshipKey
    || (normalizedModuleKey === 'documents' ? 'deal_documents' : normalizedModuleKey);
  if (!targetAppKey) return;

  for (const recordId of ids) {
    try {
      if (normalizedModuleKey === 'documents') {
        const linkRes = await apiClient.post(`/documents/${recordId}/link`, {
          moduleKey: 'deals',
          recordId: String(deal.value._id),
          appKey: 'SALES'
        });
        if (!linkRes?.success) {
          throw new Error(linkRes?.message || 'Failed to link document');
        }
        continue;
      }

      await apiClient.post('/relationships/link', {
        relationshipKey,
        source: {
          appKey: 'sales',
          moduleKey: 'deals',
          recordId: deal.value._id
        },
        target: {
          appKey: targetAppKey,
          moduleKey: normalizedModuleKey,
          recordId
        }
      });
    } catch (linkErr) {
      if (linkErr?.status === 409) continue;
      console.error('Error linking record:', linkErr);
      notifications.error(linkErr?.response?.data?.message || linkErr?.message || t('records.taskLinkModuleFailed', { moduleKey: normalizedModuleKey }));
      return;
    }
  }

  closeLinkRecordDrawer();
  invalidateRecordContext('SALES', 'deals', deal.value._id);
  // Invalidate linked records’ context so their Related Records refresh when user navigates there
  if (normalizedModuleKey === 'events') {
    ids.forEach((id) => invalidateRecordContext('PLATFORM', 'events', id));
  }
  relatedRefreshKey.value += 1;
  await fetchDeal();
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

const updateStickyTitleState = (scrollTop) => {
  if (isLeftTitleSticky.value) {
    if (scrollTop <= STICKY_TITLE_DISABLE_OFFSET) {
      isLeftTitleSticky.value = false;
    }
    return;
  }

  if (scrollTop >= STICKY_TITLE_ENABLE_OFFSET) {
    isLeftTitleSticky.value = true;
  }
};

const handleLeftPaneScrollForStickyTitle = (event) => {
  const nextScrollTop = event?.target?.scrollTop || 0;
  updateStickyTitleState(nextScrollTop);
};

const detachLeftPaneScrollListener = () => {
  if (!leftPaneScrollElement.value) return;
  leftPaneScrollElement.value.removeEventListener('scroll', handleLeftPaneScrollForStickyTitle);
  leftPaneScrollElement.value = null;
};

const attachLeftPaneScrollListener = () => {
  const rootEl = dealRecordPageRootRef.value;
  const scrollEl = findTitleScrollContainer(rootEl);
  if (!scrollEl) return false;
  if (leftPaneScrollElement.value === scrollEl) {
    const nextScrollTop = scrollEl.scrollTop || 0;
    updateStickyTitleState(nextScrollTop);
    return true;
  }
  detachLeftPaneScrollListener();
  leftPaneScrollElement.value = scrollEl;
  const nextScrollTop = scrollEl.scrollTop || 0;
  updateStickyTitleState(nextScrollTop);
  scrollEl.addEventListener('scroll', handleLeftPaneScrollForStickyTitle, { passive: true });
  return true;
};

watch([activityFilterComments, activityFilterUpdates, activityFilterEmail], ([comments, updates, email]) => {
  try {
    localStorage.setItem(ACTIVITY_FILTER_STORAGE_KEY, JSON.stringify({ comments, updates, email }));
  } catch {}
});

watch(loading, (isLoading) => {
  if (isLoading) return;
  nextTick(() => {
    if (attachLeftPaneScrollListener()) return;
    requestAnimationFrame(() => {
      if (attachLeftPaneScrollListener()) return;
      setTimeout(attachLeftPaneScrollListener, 150);
      setTimeout(attachLeftPaneScrollListener, 400);
    });
  });
});

useRecordPageLifecycle({
  route,
  recordId: effectiveDealId,
  embed: () => props.embed,
  routePrefix: '/deals',
  embedRecordIdSource: () => props.dealId,
  freshness: {
    moduleKey: 'deals',
    getUpdatedAtMs: () => extractRecordUpdatedAtMs(deal.value),
  },
  fetchRecord: async () => {
    if (!props.embed && !isDealDetailRoute()) return;
    await fetchDeal();
    lastRoutedDealId.value = String(effectiveDealId.value || '');
  },
  onRouteChange: async ({ recordId }) => {
    if (!props.embed && !isDealDetailRoute()) return;
    const nextId = String(recordId || '');
    if (!nextId || nextId === lastRoutedDealId.value) return;
    lastRoutedDealId.value = nextId;
    await fetchDeal();
  },
  onMount: [
    () => {
      startEmojiThemeObserver();
      window.addEventListener('scroll', updateCommentReactionPickerPosition, true);
      window.addEventListener('scroll', updateCommentReactionTooltipPosition, true);
      window.addEventListener('resize', updateCommentReactionPickerPosition);
      window.addEventListener('resize', updateCommentReactionTooltipPosition);
      document.addEventListener('click', handleCommentReactionPickerOutsideClick);
      window.addEventListener('scroll', updateTagPopoverPosition, true);
      window.addEventListener('resize', updateTagPopoverPosition);
      document.addEventListener('mousedown', handleTagPopoverMousedown);
      document.addEventListener('click', handleTagPopoverOutsideClick);
    }
  ],
  onUnmounted: [
    () => {
      detachLeftPaneScrollListener();
      cleanupCommentReactionPicker();
      cleanupCommentReactionTooltip();
    },
    () => {
      window.removeEventListener('scroll', updateCommentReactionPickerPosition, true);
      window.removeEventListener('scroll', updateCommentReactionTooltipPosition, true);
      window.removeEventListener('resize', updateCommentReactionPickerPosition);
      window.removeEventListener('resize', updateCommentReactionTooltipPosition);
      document.removeEventListener('click', handleCommentReactionPickerOutsideClick);
      stopEmojiThemeObserver();
      window.removeEventListener('scroll', updateTagPopoverPosition, true);
      window.removeEventListener('resize', updateTagPopoverPosition);
      document.removeEventListener('mousedown', handleTagPopoverMousedown);
      document.removeEventListener('click', handleTagPopoverOutsideClick);
    }
  ]
});

const initialFilter = loadActivityFilter();
activityFilterComments.value = initialFilter.comments;
activityFilterUpdates.value = initialFilter.updates;
activityFilterEmail.value = initialFilter.email;
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
