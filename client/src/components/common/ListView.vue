<template>
  <div
    class="mx-auto w-full"
    :class="fillHeight ? 'flex min-h-0 flex-col' : ''"
  >
    <!-- Header -->
    <div
      v-if="!hidePageHeader"
      class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-4"
      :class="fillHeight ? 'shrink-0' : ''"
    >
      <div class="flex-1 min-w-0">
        <div class="flex min-w-0 items-center gap-3">
          <!-- View Selector Dropdown (People module only) -->
          <Menu v-if="savedViews && savedViews.length > 0" as="div" class="relative inline-block min-w-0 max-w-full text-left">
            <div class="min-w-0 max-w-full">
              <MenuButton
                class="inline-flex max-w-full min-w-0 items-center gap-1.5 text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-200 transition-colors focus:outline-none"
              >
                <span class="inline-flex min-w-0 max-w-full items-center gap-1.5">
                  <TruncatedLabel
                    :text="activePeopleViewTitle"
                    :max-chars="SAVED_VIEW_NAME_HEADER_DISPLAY_MAX_LENGTH"
                    tag="span"
                    text-class="text-base sm:text-lg md:text-xl font-bold"
                    class="min-w-0 max-w-full"
                  />
                  <span
                    v-if="showActiveViewModifiedIndicator"
                    class="text-indigo-500 dark:text-indigo-400 text-lg leading-none"
                    :title="t('common.listViewModifiedHint')"
                    aria-hidden="true"
                  >•</span>
                </span>
                <ChevronDownIcon class="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              </MenuButton>
            </div>
            <Transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="transform opacity-0 scale-95"
              enter-to-class="transform opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="transform opacity-100 scale-100"
              leave-to-class="transform opacity-0 scale-95"
            >
              <MenuItems class="absolute left-0 z-50 mt-2 w-56 origin-top-left rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none">
                <div class="py-1">
                  <!-- System and Custom Views -->
                  <MenuItem
                    v-for="view in savedViews"
                    :key="view.id"
                    v-slot="{ active, close }"
                  >
                    <div
                      class="group flex min-w-0 w-full items-center"
                      :class="[
                        active ? 'bg-gray-100 dark:bg-gray-700' : '',
                        activeSavedViewId === view.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                      ]"
                    >
                      <TruncatedLabel
                        :text="view.label"
                        tag="button"
                        type="button"
                        tooltip-placement="above"
                        tooltip-align="start"
                        :class="[
                          activeSavedViewId === view.id ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100',
                          'flex-1 min-w-0 text-left px-4 py-2 text-sm',
                        ]"
                        @click="() => { handleSavedViewClick(view); close(); }"
                      />
                      <div :class="savedViewActionsColumnClass(view.id)">
                        <!-- Edit/Delete actions for custom views only -->
                        <div v-if="!isSystemView(view.id)" class="flex items-center gap-0.5">
                          <button
                            @click.stop="handleEditView(view)"
                            class="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            :title="t('common.listEditView')"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button
                            @click.stop="handleDeleteView(view)"
                            class="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            :title="t('common.listDeleteViewAction')"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                        <!-- Set as default (all views) -->
                        <HoverTooltip
                          :content="isEffectiveDefaultView(view.id) ? t('common.listDefaultViewTooltip') : t('common.listSetDefaultViewTooltip')"
                          anchor-selector="button"
                          preferred-placement="above"
                          :show-delay="50"
                          :hide-delay="80"
                          :gap="4"
                          :class="[
                            'flex items-center p-1 -m-1 rounded transition-opacity',
                            isEffectiveDefaultView(view.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          ]"
                        >
                          <button
                            @click.stop="() => { handleSetDefaultView(view); close(); }"
                            :class="[
                              isEffectiveDefaultView(view.id) ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 hover:text-amber-500 dark:hover:text-amber-400',
                              'p-0.5 transition-colors'
                            ]"
                          >
                            <StarIcon v-if="!isEffectiveDefaultView(view.id)" class="w-4 h-4" />
                            <StarIconSolid v-else class="w-4 h-4" />
                          </button>
                        </HoverTooltip>
                      </div>
                    </div>
                  </MenuItem>
                </div>
              </MenuItems>
            </Transition>
          </Menu>
          <!-- Regular title (other modules) -->
          <h1 v-else class="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white truncate">{{ title }}</h1>
          
          <!-- Saved view actions: update / save as new / save (derived from dirty state) -->
          <div
            v-if="savedViews && savedViews.length > 0 && showViewSaveActions"
            class="inline-flex shrink-0 items-center gap-2"
          >
            <button
              v-if="canUpdateActiveView"
              type="button"
              @click="handleUpdateActiveView"
              class="inline-flex items-center gap-1 px-2.5 py-1 text-xs sm:text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              :title="t('common.listUpdateViewHint')"
            >
              <span>{{ t('common.listUpdateView') }}</span>
            </button>
            <button
              v-if="shouldShowSaveAsNew && !shouldShowSaveNewOnly"
              type="button"
              @click="handleSaveAsNewView"
              class="inline-flex items-center gap-1 px-2.5 py-1 text-xs sm:text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              :title="t('common.listSaveAsNewViewHint')"
            >
              <StarIcon class="w-3.5 h-3.5" />
              <span>{{ t('common.listSaveAsNewView') }}</span>
            </button>
            <button
              v-if="shouldShowSaveNewOnly"
              type="button"
              @click="handleSaveCurrentView"
              class="inline-flex items-center gap-1 px-2.5 py-1 text-xs sm:text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              :title="t('common.listSaveViewHint')"
            >
              <StarIcon class="w-3.5 h-3.5" />
              <span>{{ t('common.listSaveView') }}</span>
            </button>
            <button
              v-if="showActiveViewModifiedIndicator"
              type="button"
              @click="handleRevertToSavedView"
              class="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              {{ t('common.listRevertView') }}
            </button>
          </div>
          
          <!-- Mobile Action Buttons with Stats Icon -->
          <div class="sm:hidden flex flex-nowrap items-center gap-2 ml-auto shrink-0">
            <!-- Stats Toggle Button (Mobile) -->
            <button
              v-if="showStats && statsConfig && statsConfig.length > 0"
              @click="statsPanelVisible = !statsPanelVisible"
              class="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              :title="statsToggleTitle"
            >
              <ChartBarIcon v-if="!statsPanelVisible" class="w-4 h-4" />
              <XMarkIcon v-else class="w-4 h-4" />
            </button>
            
            <button
              v-if="!hidePageHeader"
              ref="customizeButtonMobileRef"
              @click="handleCustomizeClick"
              class="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              :title="customizeButtonLabel"
              :aria-label="customizeButtonLabel"
            >
              <Cog6ToothIcon class="w-4 h-4" />
            </button>

            <slot name="header-actions">
                <ModuleActions 
                  :module="moduleKey"
                  :create-label="createLabel"
                  :show-create="showCreate !== false"
                  :show-import="showImport !== false"
                  :show-export="showExport !== false"
                  @create="$emit('create')"
                  @import="$emit('import')"
                  @export="$emit('export')"
                />
              </slot>
          </div>
          
          <!-- Stats Toggle Button (Tablet) -->
          <button
            v-if="showStats && statsConfig && statsConfig.length > 0"
            @click="statsPanelVisible = !statsPanelVisible"
            class="hidden sm:inline-flex md:hidden size-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            :title="statsToggleTitle"
          >
            <ChartBarIcon v-if="!statsPanelVisible" class="w-4 h-4" />
            <XMarkIcon v-else class="w-4 h-4" />
          </button>
        </div>
        <p
          v-if="description"
          class="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-400 mt-1 sm:mt-2"
        >{{ description }}</p>
      </div>
      <div class="hidden sm:flex items-center gap-2.5 flex-shrink-0">
        <!-- Stats Toggle Button (Desktop) -->
        <button
          v-if="showStats && statsConfig && statsConfig.length > 0"
          @click="statsPanelVisible = !statsPanelVisible"
          class="hidden md:inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors bg-white border border-gray-200 dark:border-0 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-pointer"
          :title="statsToggleTitle"
        >
          <ChartBarIcon v-if="!statsPanelVisible" class="w-4 h-4" />
          <XMarkIcon v-else class="w-4 h-4" />
          <span>{{ statsPanelVisible ? t('common.listHideShort') : t('common.listStatsShort') }}</span>
        </button>
        
        <button
          v-if="!hidePageHeader"
          ref="customizeButtonDesktopRef"
          @click="handleCustomizeClick"
          class="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors bg-white border border-gray-200 dark:border-0 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-pointer"
          :title="customizeButtonLabel"
          :aria-label="customizeButtonLabel"
        >
          <Cog6ToothIcon class="w-4 h-4" />
          <span class="hidden md:inline">{{ customizeButtonShortLabel }}</span>
        </button>

        <slot name="header-actions">
            <ModuleActions 
              :module="moduleKey"
              :create-label="createLabel"
              :show-create="showCreate !== false"
              :show-import="showImport !== false"
              :show-export="showExport !== false"
              @create="$emit('create')"
              @import="$emit('import')"
              @export="$emit('export')"
            />
          </slot>
      </div>
    </div>

    <slot name="active-filters" />

    <!-- Statistics strip -->
    <div
      v-if="showStats && statsConfig && statsConfig.length > 0 && statsPanelVisible"
      class="mb-4"
      :class="fillHeight ? 'shrink-0' : ''"
    >
      <div
        v-if="statsBarSkeleton"
        class="flex items-stretch overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
        aria-hidden="true"
      >
        <div
          v-for="n in statsConfig.length"
          :key="`stat-sk-${n}`"
          class="flex min-w-[5.5rem] flex-1 flex-col gap-2 border-r border-gray-100 px-3 py-2.5 last:border-r-0 dark:border-gray-800 sm:min-w-[7rem] sm:px-4 sm:py-3"
        >
          <div class="h-3.5 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-600" />
          <div class="h-6 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-600" />
        </div>
      </div>
      <div
        v-else
        role="toolbar"
        :aria-label="t('common.listStatisticsRegion')"
        class="flex items-stretch overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
      >
        <button
          v-for="item in computedStats"
          :key="item.key"
          type="button"
          class="group flex min-w-[5.5rem] flex-1 flex-col items-start gap-1 border-r border-gray-100 px-3 py-2.5 text-left transition-[background-color,color] duration-150 last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:border-gray-800 sm:min-w-[7rem] sm:gap-1.5 sm:px-4 sm:py-3"
          :class="item.key === selectedStatKey
            ? 'bg-indigo-50 dark:bg-indigo-900/30'
            : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/25'"
          :title="item.name"
          :aria-pressed="item.key === selectedStatKey ? 'true' : 'false'"
          @click="handleStatClick(item)"
        >
          <TruncatedLabel
            :text="item.name"
            tag="span"
            text-class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
          />
          <span
            class="text-base font-semibold tabular-nums transition-colors sm:text-lg"
            :class="item.key === selectedStatKey
              ? 'text-indigo-700 dark:text-indigo-300'
              : 'text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400'"
          >
            {{ item.stat }}
          </span>
        </button>
      </div>
    </div>

    <!-- Search and Filters -->
    <div
      v-if="!hideSearchToolbar"
      class="relative flex flex-col gap-4"
      :class="[
        fillHeight ? 'mb-3 shrink-0' : 'mb-4'
      ]"
    >
      <!-- Mobile, Tablet & Small Desktop: Search, Filters Button, Columns Button in a single row -->
      <div class="flex items-center gap-2.5 lg:hidden">
        <div class="flex-1 min-w-0">
          <div class="relative">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500 pointer-events-none z-10">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              v-model="searchQuery" 
              type="text" 
              :placeholder="searchPlaceholder"
              @input="debouncedSearch"
              class="block h-8 w-full pl-8 pr-9 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-xs sm:text-sm outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
            />
            <button
              v-if="searchQuery"
              type="button"
              @click="clearSearch"
              class="absolute inset-y-0 right-2 flex items-center justify-center rounded-sm p-1 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer"
              :aria-label="t('common.listClearSearch', { title })"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <slot name="search-actions" />

        <div class="ml-auto flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
        <!-- Mobile & Tablet Filters Button -->
        <Popover v-if="resolvedShowFilterBuilder || resolvedToolbarFilterConfig.length > 0" class="relative shrink-0">
          <PopoverButton
            class="relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-xs sm:text-sm cursor-pointer sm:h-8 sm:w-auto sm:gap-1.5 sm:px-2.5"
            @click="openFilterBuilder"
          >
            <FunnelIcon class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">{{ filterButtonLabel }}</span>
            <span
              v-if="resolvedShowFilterBuilder && activeFilterRulesCount > 0"
              class="absolute -top-1 -right-1 flex sm:static items-center justify-center min-w-[1.125rem] h-4 px-1 text-[10px] font-medium text-white bg-indigo-600 rounded-full"
            >
              {{ activeFilterRulesCount }}
            </span>
            <span
              v-else-if="!resolvedShowFilterBuilder && hasActiveFilters"
              class="absolute -top-1 -right-1 flex sm:static items-center justify-center w-4 h-4 text-[10px] font-medium text-white bg-indigo-600 rounded-full"
            >
              {{ getActiveFiltersCount() }}
            </span>
          </PopoverButton>

          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 translate-y-1"
          >
            <PopoverPanel
              :class="resolvedShowFilterBuilder
                ? 'absolute right-0 z-[60] mt-2 w-[48rem] max-w-[min(48rem,calc(100vw-2rem))] overflow-visible rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10'
                : 'absolute right-0 z-[60] mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-visible rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10'"
            >
              <FilterBuilderPanel
                v-if="resolvedShowFilterBuilder"
                ref="mobileFilterBuilderPanelRef"
                :filter-config="builderFilterConfigList"
                :filters="filters"
                :filter-by-key="builderFilterByKey"
                :filter-operators="filterOperatorsMap"
                :query="filterBuilderQuery"
                @apply="handleBuilderFilterApply"
                @clear-field="handleBuilderClearField"
                @clear-all="clearFilters"
                @update-query="handleFilterQueryUpdate"
                @filter-opened="handleFilterOpened"
              />
              <div v-else class="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <div
                  v-for="filter in resolvedToolbarFilterConfig"
                  :key="filter.key"
                  class="relative"
                >
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {{ filter.label || filter.key }}
                  </label>
                  <ListColumnFilter
                    :filter="filter"
                    :model-value="filters[filter.key]"
                    compact
                    @update:model-value="(value) => handleFilterInput(filter.key, value, filter.filterType, 'builder')"
                    @opened="handleFilterOpened(filter.key)"
                  />
                </div>
                <button
                  v-if="hasActiveFilters"
                  @click="clearFilters"
                  class="w-full inline-flex h-8 items-center justify-center gap-1.5 px-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors text-xs sm:text-sm cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-3.5 h-3.5">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {{ t('common.listClearFilters') }}
                </button>
              </div>
            </PopoverPanel>
          </Transition>
        </Popover>

        <ActiveFilterChipBar
          v-if="resolvedShowFilterBuilder && hasActiveFilters"
          :filters="filters"
          :filter-config="builderFilterConfigList"
          :filter-operators="filterOperatorsMap"
          :search-query="searchQuery"
          @remove="handleActiveFilterChipRemove"
          @clear-all="clearFilters"
        />
          <slot name="toolbar-trailing" />
        </div>
      </div>

      <!-- Large Desktop: Search and Filters in a row -->
      <div class="hidden lg:flex lg:flex-row gap-3">
        <div class="w-full sm:w-80 lg:w-80">
          <div class="relative">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500 pointer-events-none z-10">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              v-model="searchQuery" 
              type="text" 
              :placeholder="searchPlaceholder"
              @input="debouncedSearch"
              class="block h-8 w-full pl-8 pr-9 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-xs sm:text-sm outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
            />
            <button
              v-if="searchQuery"
              type="button"
              @click="clearSearch"
              class="absolute inset-y-0 right-2 flex items-center justify-center rounded-full p-1 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer"
              :aria-label="t('common.listClearSearch', { title })"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <slot name="search-actions" />

        <!-- Filters (Desktop) -->
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          <Popover v-if="resolvedShowFilterBuilder || resolvedShowLegacyToolbarFilters || resolvedShowDesktopFiltersPopover" class="relative shrink-0">
            <PopoverButton
              class="inline-flex h-8 items-center gap-1.5 px-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-xs sm:text-sm cursor-pointer"
              @click="openFilterBuilder"
            >
              <FunnelIcon class="w-3.5 h-3.5" />
              <span>{{ filterButtonLabel }}</span>
            </PopoverButton>
            <Transition
              enter-active-class="transition duration-200 ease-out"
              enter-from-class="opacity-0 translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition duration-150 ease-in"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 translate-y-1"
            >
              <PopoverPanel
                :class="resolvedShowFilterBuilder
                  ? 'absolute left-0 z-[60] mt-2 w-[48rem] max-w-[min(48rem,calc(100vw-2rem))] overflow-visible rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10'
                  : 'absolute left-0 z-[60] mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-visible rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10'"
              >
                <FilterBuilderPanel
                  v-if="resolvedShowFilterBuilder"
                  ref="desktopFilterBuilderPanelRef"
                  :filter-config="builderFilterConfigList"
                  :filters="filters"
                  :filter-by-key="builderFilterByKey"
                  :filter-operators="filterOperatorsMap"
                  :query="filterBuilderQuery"
                  @apply="handleBuilderFilterApply"
                  @clear-field="handleBuilderClearField"
                  @clear-all="clearFilters"
                  @update-query="handleFilterQueryUpdate"
                  @filter-opened="handleFilterOpened"
                />
                <div v-else-if="resolvedShowDesktopFiltersPopover" class="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                  <div
                    v-for="filter in popoverFilterConfig"
                    :key="`popover-${filter.key}`"
                    class="relative"
                  >
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {{ filter.label || filter.key }}
                    </label>
                    <ListColumnFilter
                      :filter="filter"
                      :model-value="filters[filter.key]"
                      compact
                      @update:model-value="(value) => handleFilterInput(filter.key, value, filter.filterType, 'builder')"
                      @opened="handleFilterOpened(filter.key)"
                    />
                  </div>
                </div>
                <div v-else class="flex flex-wrap items-center gap-2.5 p-4">
                  <div
                    v-for="filter in resolvedToolbarFilterConfig"
                    :key="filter.key"
                    :data-filter-key="filter.key"
                    class="relative"
                  >
                    <ListColumnFilter
                      :filter="filter"
                      :model-value="filters[filter.key]"
                      compact
                      @update:model-value="(value) => handleFilterInput(filter.key, value, filter.filterType, 'builder')"
                      @opened="handleFilterOpened(filter.key)"
                    />
                  </div>
                </div>
              </PopoverPanel>
            </Transition>
          </Popover>

          <ActiveFilterChipBar
            v-if="resolvedShowFilterBuilder && hasActiveFilters"
            :filters="filters"
            :filter-config="builderFilterConfigList"
            :filter-operators="filterOperatorsMap"
            :search-query="searchQuery"
            @remove="handleActiveFilterChipRemove"
            @clear-all="clearFilters"
          />

        <button
          v-if="!resolvedShowFilterBuilder && hasActiveFilters"
          @click="clearFilters"
          class="inline-flex h-8 items-center gap-1.5 px-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-xs sm:text-sm cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-3.5 h-3.5">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          {{ t('common.listClear') }}
        </button>

          <!-- Suggested Filters Section (Feature-flagged, opt-in only) -->
          <!-- 
            ARCHITECTURE NOTE: This section is informational only.
            - Does NOT auto-apply filters
            - Does NOT modify filter state
            - User must explicitly click to open filter configuration
            - Controlled by ENABLE_DEFAULT_FILTERS flag in useDefaultListFilters
            See: /composables/useDefaultListFilters.ts
          -->
          <div 
            v-if="suggestedFiltersEnabled && hasSuggestedFilters && !hasActiveFilters"
            class="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200 dark:border-gray-700"
          >
            <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap" :title="t('common.listSuggestedHint')">
              {{ t('common.listSuggestedLabel') }}
            </span>
            <div class="flex flex-wrap items-center gap-1.5">
              <button
                v-for="filterKey in suggestedFilters"
                :key="filterKey"
                @click="handleSuggestedFilterClick(filterKey)"
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer"
                :title="t('common.listSuggestedConfigure', { filter: getSuggestedFilterLabel(filterKey) })"
              >
                <span>{{ getSuggestedFilterLabel(filterKey) }}</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3 opacity-50">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div class="ml-auto flex shrink-0 items-center gap-2">
          <slot name="toolbar-trailing" />
        </div>
      </div>
    </div>

    <div
      v-show="showListTableBody"
      ref="tableAreaRef"
      class="list-view-table-area px-4 sm:px-6 lg:px-8"
      :class="[
        fillHeight
          ? 'mt-0 flex min-h-0 flex-1 flex-col overflow-hidden'
          : 'mt-4'
      ]"
      :style="tableAreaMergedStyle"
    >
      <!-- Stable key: must not depend on row data or count — remounting resets scroll and inline filter focus. -->
      <TableView
          v-if="computedColumns.length > 0"
          :key="`table-${tableId}`"
          internal-scroll
          :max-body-height="resolvedTableMaxBodyHeight"
          :data="data"
          :columns="computedColumns"
          :loading="tableLoading"
          :selectable="selectable"
          :has-actions="hasActions"
          :row-actions-gutter="rowActionsGutter"
          :sort-field="sortField"
          :sort-order="sortOrder"
          :sorts="resolvedSorts"
          :mass-actions="massActions"
          :row-key="rowKey"
          :empty-title="emptyStateTitle"
          :empty-message="emptyStateMessage"
          :empty-illustration-src="emptyStateIllustrationSrc"
          :table-id="tableId"
          :resizable-columns="resizableColumns"
          :row-height="rowHeight"
          :reset-widths="resetWidthsTrigger"
          :clear-selection-trigger="clearSelectionTrigger"
          :load-more-enabled="infiniteScroll"
          :pagination="pagination"
          :loading-more="loadingMore"
          :selection-column-variant="selectionColumnVariant"
          :row-number-offset="effectiveRowNumberOffset"
          :selection-mode="selectionMode"
          :selected-row-ids="selectedRowIdsForTable"
          :excluded-row-ids="excludedRowIdsForTable"
          :scroll-session-key="scrollSessionKey"
          :column-filters-enabled="resolvedColumnHeaderFilters"
          :filter-config-by-key="enrichedColumnFilterConfigByKey"
          :column-filters="filters"
          @row-click="handleRowClick"
          @edit="handleEdit"
          @delete="handleDelete"
          @sort="handleSort"
          @filter-change="handleColumnFilterChange"
          @filter-opened="handleFilterOpened"
          @clear-column-filters="clearColumnFilters"
          @toggle-row="toggleListRowSelection"
          @toggle-select-all-loaded="() => toggleListSelectAllLoaded(data)"
          @bulk-action="handleBulkAction"
          @load-more="emit('load-more')"
        >
          <!-- Forward parent slots (actions handled separately for stable vnode patching) -->
          <template
            v-for="slotName in forwardedSlotNames"
            :key="slotName"
            #[slotName]="slotProps"
          >
            <slot :name="slotName" v-bind="slotProps" />
          </template>

          <!-- Custom Actions -->
          <template #actions="{ row }">
            <slot name="actions" :row="row">
              <div class="inline-flex items-center">
                <RowActions
                  v-if="hasActions"
                  :row="row"
                  :module="moduleKey"
                  :can-delete-row="props.rowCanDelete"
                  @view="handleView(row)"
                  @edit="handleEdit(row)"
                  @delete="handleDeleteClick(row)"
                />
              </div>
            </slot>
          </template>
          
          <!-- Empty actions only (title/illustration rendered by TableView) -->
          <template v-if="canClearFilters" #empty-actions>
            <div class="flex justify-center">
              <button
                @click="clearFilters"
                class="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 cursor-pointer"
              >
                <XMarkIcon class="h-4 w-4" />
                <span>{{ t('common.listClearSearchAndFilters') }}</span>
              </button>
            </div>
          </template>
        </TableView>
    </div>

    <!-- Delete Confirmation Modal -->
    <DeleteConfirmationModal
      :show="showDeleteModal"
      :record-name="deleteRecordName"
      :record-type="moduleKey"
      :deleting="deleteModalBusy"
      :is-bulk="isBulkDelete"
      :bulk-count="bulkDeleteCount"
      :title="customDeleteDialogTitle"
      :message="customDeleteDialogMessage"
      @close="handleDeleteModalClose"
      @confirm="confirmDelete"
    />

    <!-- Save/Edit View Modal (People module only) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="savedViews && savedViews.length > 0 && showSaveViewModal"
          class="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          @click.self="handleCloseSaveViewModal"
        >
          <div class="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md shadow-2xl" @click.stop>
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
                {{ saveViewModalTitle }}
              </h2>
            </div>
            <form @submit.prevent="handleSaveView" class="p-6 space-y-4">
              <div>
                <div class="mb-2 flex items-baseline justify-between gap-3">
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{ t('common.listViewName') }} <span class="text-red-500">*</span>
                  </label>
                  <span
                    class="shrink-0 text-xs tabular-nums"
                    :class="viewFormNameAtLimit
                      ? 'font-medium text-amber-600 dark:text-amber-400'
                      : 'text-gray-500 dark:text-gray-400'"
                    aria-live="polite"
                  >
                    {{ t('common.listViewNameCharCount', {
                      current: viewFormNameCharCount,
                      max: SAVED_VIEW_NAME_MAX_LENGTH,
                    }) }}
                  </span>
                </div>
                <input
                  v-model="viewFormData.name"
                  type="text"
                  required
                  :maxlength="SAVED_VIEW_NAME_MAX_LENGTH"
                  :placeholder="t('common.listViewNameExample')"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p
                  v-if="viewFormNameError"
                  class="mt-2 text-xs text-red-600 dark:text-red-400"
                >
                  {{ viewFormNameError }}
                </p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {{ t('common.listViewDescOptional') }}
                </label>
                <textarea
                  v-model="viewFormData.description"
                  rows="3"
                  :placeholder="t('common.listViewDescPlaceholder')"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div class="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  @click="handleCloseSaveViewModal"
                  class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors cursor-pointer"
                >
                  {{ t('actions.cancel') }}
                </button>
                <button
                  type="submit"
                  :disabled="!canSaveView"
                  class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
                >
                  {{ saveMode === 'rename' ? t('actions.update') : t('actions.save') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete View Confirmation Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="savedViews && savedViews.length > 0 && showDeleteViewModal && viewToDelete"
          class="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          @click.self="handleCloseDeleteViewModal"
        >
          <div class="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md shadow-2xl" @click.stop>
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('common.listDeleteView') }}</h2>
            </div>
            <div class="p-6">
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {{ t('common.listDeleteViewConfirm', { viewName: viewToDelete?.label }) }}
              </p>
              <div class="flex items-center justify-end gap-3">
                <button
                  type="button"
                  @click="handleCloseDeleteViewModal"
                  class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors cursor-pointer"
                >
                  {{ t('actions.cancel') }}
                </button>
                <button
                  type="button"
                  @click="confirmDeleteView"
                  class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
                >
                  {{ t('actions.delete') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Mass Actions Bar - Floating Style -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-4 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 translate-y-4 scale-95"
      >
        <div
          v-if="hasSelection"
          class="fixed bottom-4 sm:bottom-6 left-2 right-2 sm:left-1/2 sm:-translate-x-1/2 z-[9999] bg-gray-800 dark:bg-gray-800 rounded-xl shadow-lg sm:max-w-[min(800px,100%)]"
          :style="windowWidth >= 640 ? { 
            marginLeft: headerLeft === '0px' ? '0' : `calc(${headerLeft} / 2)`
          } : {}"
        >
          <div
            v-if="showSelectAllMatchingLink"
            class="border-b border-white/10 px-4 py-2 text-center text-sm text-gray-200"
          >
            <button
              type="button"
              class="font-medium text-indigo-300 hover:text-indigo-200 underline-offset-2 hover:underline cursor-pointer"
              @click="selectAllMatchingRecords()"
            >
              {{
                t('common.listSelectAllMatching', {
                  count: selectionTotalMatching,
                  module: title,
                })
              }}
            </button>
          </div>
          <div class="flex items-center px-4 sm:px-6 py-2 sm:py-2.5 gap-3">
            <!-- Left: Selection Count with Close Icon -->
            <button
              @click="clearSelection"
              class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/20 dark:border-gray-600 text-white dark:text-white font-medium text-sm flex-shrink-0 cursor-pointer hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors"
              :title="t('common.listClearSelection')"
            >
              <span class="font-semibold">{{ selectionCount }}</span>
              <span class="font-medium">
                <template v-if="isSelectAllMatching">
                  {{
                    t('common.listAllMatchingSelected', {
                      count: selectionCount,
                      module: title,
                    })
                  }}
                </template>
                <template v-else>
                  {{
                    t('common.listRowsSelected', selectionCount, {
                      count: selectionCount,
                      singular: title.endsWith('s') ? title.slice(0, -1) : title,
                      plural: title,
                    })
                  }}
                </template>
              </span>
              <XMarkIcon class="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            </button>

            <!-- Right: Mass Actions -->
            <div class="flex items-center gap-1 sm:gap-2 flex-1 overflow-x-auto sm:overflow-visible justify-end">
              <!-- Non-delete actions -->
              <button
                v-for="action in massActions.filter(a => a.action !== 'delete' && a.icon !== 'delete' && a.icon !== 'trash')"
                :key="action.action"
                @click="handleBulkActionClick(action.action)"
                class="flex flex-col items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors group flex-shrink-0 cursor-pointer"
                :class="action.variant === 'primary' ? 'text-teal-400 dark:text-teal-400' : 'text-gray-300 dark:text-gray-300'"
              >
                <component
                  :is="getActionIcon(action.icon)"
                  class="w-4 h-4 sm:w-5 sm:h-5"
                />
                <span class="text-[10px] sm:text-xs font-medium leading-tight">{{ action.label }}</span>
              </button>
              
              <!-- Delete action (always on the right side of actions) -->
              <button
                v-for="action in massActions.filter(a => a.action === 'delete' || a.icon === 'delete' || a.icon === 'trash')"
                :key="action.action"
                @click="handleBulkActionClick(action.action)"
                class="flex flex-col items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors group text-red-400 dark:text-red-400 flex-shrink-0 cursor-pointer"
              >
                <component
                  :is="getActionIcon(action.icon)"
                  class="w-4 h-4 sm:w-5 sm:h-5"
                />
                <span class="text-[10px] sm:text-xs font-medium leading-tight">{{ action.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Customize View / Kanban drawers (v-if avoids disabled→enabled moveTeleport crash) -->
    <Teleport v-if="workspaceDrawerHostReady" :to="workspaceDrawerHost">
      <div
        v-if="showColumnSettings || showKanbanSettings"
        class="absolute inset-x-0 bottom-0 z-40"
        :style="customizeDrawerInsetStyle"
        aria-hidden="true"
        @click="closeCustomizeDrawers"
      />
      <Transition
        enter-active-class="transition-transform ease-out duration-300"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-transform ease-in duration-300"
        leave-from-class="translate-x-0"
        leave-to-class="translate-x-full"
      >
        <div
          v-if="showColumnSettings"
          @click.stop
          class="absolute bottom-0 right-0 w-full max-w-xs bg-white dark:bg-neutral-900 shadow-lg flex flex-col z-50 overflow-hidden border-l border-t border-neutral-200 dark:border-neutral-700 rounded-tl-xl"
          :style="customizeDrawerInsetStyle"
        >
              <!-- Drawer Header -->
              <div class="flex items-center justify-between px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-700">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('common.listCustomizeView') }}</h3>
                <button
                  @click="showColumnSettings = false"
                  class="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <XMarkIcon class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <!-- Drawer Body -->
              <div class="flex-1 overflow-y-auto">
                <!-- Layout Options Section -->
                <div class="border-b border-neutral-200 dark:border-neutral-700">
                  <button
                    @click="layoutOptionsExpanded = !layoutOptionsExpanded"
                    class="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer"
                  >
                    <div class="flex items-center gap-2.5">
                      <WrenchScrewdriverIcon class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('common.listLayoutOptions') }}</span>
                    </div>
                    <ChevronDownIcon 
                      :class="['w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform', layoutOptionsExpanded ? 'rotate-180' : '']" 
                    />
                  </button>
                  
                  <div v-if="layoutOptionsExpanded" class="pb-3 space-y-0">
                    <!-- Row Height -->
                    <Menu as="div" class="relative px-3">
                      <MenuButton class="w-full flex items-center justify-between px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors cursor-pointer">
                        <span>{{ t('common.listRowHeight') }}</span>
                        <div class="flex items-center gap-2">
                          <span class="text-sm text-gray-500 dark:text-gray-400">{{ rowHeightLabels[rowHeight] }}</span>
                          <ChevronRightIcon class="w-4 h-4" />
                        </div>
                      </MenuButton>
                      <Transition
                        enter-active-class="transition duration-100 ease-out"
                        enter-from-class="transform scale-95 opacity-0"
                        enter-to-class="transform scale-100 opacity-100"
                        leave-active-class="transition duration-75 ease-in"
                        leave-from-class="transform scale-100 opacity-100"
                        leave-to-class="transform scale-95 opacity-0"
                      >
                        <MenuItems class="absolute right-2 z-10 mt-1 w-40 origin-top-right rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg focus:outline-none">
                          <div class="py-1">
                            <MenuItem
                              v-for="(label, value) in rowHeightLabels"
                              :key="value"
                              v-slot="{ active }"
                            >
                              <button
                                @click="rowHeight = value"
                                :class="[
                                  active ? 'bg-neutral-100 dark:bg-neutral-700' : '',
                                  rowHeight === value ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300',
                                  'block w-full text-left px-3 py-2 text-sm cursor-pointer'
                                ]"
                              >
                                {{ label }}
                              </button>
                            </MenuItem>
                          </div>
                        </MenuItems>
                      </Transition>
                    </Menu>

                    <!-- Reset -->
                    <Menu as="div" class="relative px-3">
                      <MenuButton class="w-full flex items-center justify-between px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors cursor-pointer">
                        <span>{{ t('common.listReset') }}</span>
                        <ChevronRightIcon class="w-4 h-4" />
                      </MenuButton>
                      <Transition
                        enter-active-class="transition duration-100 ease-out"
                        enter-from-class="transform scale-95 opacity-0"
                        enter-to-class="transform scale-100 opacity-100"
                        leave-active-class="transition duration-75 ease-in"
                        leave-from-class="transform scale-100 opacity-100"
                        leave-to-class="transform scale-95 opacity-0"
                      >
                        <MenuItems class="absolute right-2 z-10 mt-1 w-52 origin-top-right rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg focus:outline-none">
                          <div class="py-1">
                            <MenuItem v-slot="{ active }">
                              <button
                                @click="autosizeAllColumns"
                                :class="[
                                  active ? 'bg-neutral-100 dark:bg-neutral-700' : '',
                                  'block w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer'
                                ]"
                              >
                                {{ t('common.listColumnWidths') }}
                              </button>
                            </MenuItem>
                            <MenuItem v-slot="{ active }">
                              <button
                                @click="resetColumnSettings"
                                :class="[
                                  active ? 'bg-neutral-100 dark:bg-neutral-700' : '',
                                  'block w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer'
                                ]"
                              >
                                {{ t('common.listDefaultView') }}
                              </button>
                            </MenuItem>
                          </div>
                        </MenuItems>
                      </Transition>
                    </Menu>

                  </div>
                </div>

                <!-- Manage Fields Section -->
                <div>
                  <button
                    @click="manageFieldsExpanded = !manageFieldsExpanded"
                    class="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer"
                  >
                    <div class="flex items-center gap-2.5">
                      <PencilSquareIcon class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('common.listManageFields') }}</span>
                    </div>
                    <ChevronDownIcon 
                      :class="['w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform', manageFieldsExpanded ? 'rotate-180' : '']" 
                    />
                  </button>
                  
                  <div v-if="manageFieldsExpanded" class="pb-3 space-y-3">
                    <!-- Search Fields -->
                    <div class="relative px-4">
                      <MagnifyingGlassIcon class="absolute left-8 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        v-model="fieldSearchQuery"
                        type="text"
                        :placeholder="t('common.listSearchFields')"
                        class="w-full pl-8 pr-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                      />
                    </div>

                    <!-- Shown Fields -->
                    <div>
                      <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-4">
                        {{ t('common.listShownCount', { count: shownFields.length }) }}
                      </h4>
                      <div class="space-y-0.5 px-2">
                        <template v-for="(field, index) in shownFields" :key="field.key">
                          <div
                            :draggable="!field.locked && !(props.moduleKey === 'forms' && field.key?.toLowerCase() === 'name')"
                            @dragstart="handleDragStart($event, index)"
                            @dragover.prevent="handleDragOver"
                            @dragenter.prevent="handleDragEnter($event, index)"
                            @dragleave.prevent="handleDragLeave"
                            @drop.prevent="handleDrop($event, index)"
                            @dragend="handleDragEnd"
                            :class="[
                              'flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors',
                              dragOverIndex === index ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                              field.locked || (props.moduleKey === 'forms' && field.key?.toLowerCase() === 'name')
                                ? 'cursor-not-allowed opacity-70'
                                : 'cursor-move'
                            ]"
                          >
                          <!-- Grip handle icon (6 dots vertical) -->
                          <svg class="w-4 h-4 text-gray-400 flex-shrink-0 cursor-move" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="9" cy="5" r="1.5" />
                            <circle cx="9" cy="12" r="1.5" />
                            <circle cx="9" cy="19" r="1.5" />
                            <circle cx="15" cy="5" r="1.5" />
                            <circle cx="15" cy="12" r="1.5" />
                            <circle cx="15" cy="19" r="1.5" />
                          </svg>
                          <component
                            :is="getFieldIcon(field.dataType)"
                            class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0"
                          />
                          <span class="flex-1 min-w-0 truncate text-sm text-gray-900 dark:text-white">{{ field.label }}</span>
                          <span v-if="props.moduleKey === 'forms' && field.key?.toLowerCase() === 'name'" class="text-xs text-gray-500 dark:text-gray-400 shrink-0">{{ t('common.listFieldRequired') }}</span>
                          <span v-if="field.locked" class="text-xs text-gray-500 dark:text-gray-400 shrink-0">{{ t('common.listFieldLocked') }}</span>
                          <HeadlessSwitch
                            :checked="field.visible"
                            @change="toggleFieldVisibility(field.key)"
                            :disabled="(props.moduleKey === 'forms' && field.key?.toLowerCase() === 'name') || field.locked"
                          />
                          </div>
                        </template>
                      </div>
                    </div>

                    <!-- Hidden Fields -->
                    <div>
                      <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-4">
                        {{ t('common.listFieldHidden') }}
                      </h4>
                      <div class="space-y-0.5 px-2">
                        <template v-for="field in hiddenFields" :key="field.key">
                          <div
                            class="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                          >
                          <span class="w-4 flex-shrink-0" aria-hidden="true" />
                          <component
                            :is="getFieldIcon(field.dataType)"
                            class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0"
                          />
                          <span class="flex-1 min-w-0 truncate text-sm text-gray-900 dark:text-white">{{ field.label }}</span>
                          <span v-if="field.locked" class="text-xs text-gray-500 dark:text-gray-400 shrink-0">{{ t('common.listFieldLocked') }}</span>
                          <HeadlessSwitch
                            :checked="field.visible"
                            @change="toggleFieldVisibility(field.key)"
                            :disabled="(props.moduleKey === 'forms' && field.key?.toLowerCase() === 'name') || field.locked"
                          />
                            </div>
                        </template>
                        <div v-if="hiddenFields.length === 0" class="text-sm text-gray-500 dark:text-gray-400 py-2 text-center">
                          {{ t('common.listNoHiddenFields') }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Drawer Footer -->
              <div class="border-t border-neutral-200 dark:border-neutral-700 px-4 py-3">
                <button
                  @click="openNewCustomField"
                  class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-800 text-white rounded-md transition-colors text-sm font-medium cursor-pointer"
                >
                  <PlusIcon class="w-4 h-4" />
                  <span>{{ t('common.listNewCustomField') }}</span>
                </button>
              </div>
        </div>
      </Transition>
      <Transition
        enter-active-class="transition-transform ease-out duration-300"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-transform ease-in duration-300"
        leave-from-class="translate-x-0"
        leave-to-class="translate-x-full"
      >
        <div
          v-if="showKanbanSettings"
          @click.stop
          class="absolute bottom-0 right-0 w-full max-w-xs bg-white dark:bg-neutral-900 shadow-lg flex flex-col z-50 overflow-hidden border-l border-t border-neutral-200 dark:border-neutral-700 rounded-tl-xl"
          :style="customizeDrawerInsetStyle"
        >
          <div class="flex items-center justify-between px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-700">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('common.listCustomizeKanban') }}</h3>
            <button
              @click="showKanbanSettings = false"
              class="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <XMarkIcon class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          <div class="flex-1 overflow-y-auto">
            <!-- Kanban options -->
            <div class="border-b border-neutral-200 dark:border-neutral-700">
              <button
                @click="kanbanOptionsExpanded = !kanbanOptionsExpanded"
                class="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer"
              >
                <div class="flex items-center gap-2.5">
                  <ViewColumnsIcon class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('common.listKanbanOptions') }}</span>
                </div>
                <ChevronDownIcon
                  :class="['w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform', kanbanOptionsExpanded ? 'rotate-180' : '']"
                />
              </button>
              <div v-if="kanbanOptionsExpanded" class="pb-3 space-y-0 px-3">
                <Menu as="div" class="relative">
                  <MenuButton class="w-full flex items-center justify-between px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors cursor-pointer">
                    <span>{{ t('common.listCardSize') }}</span>
                    <div class="flex items-center gap-2">
                      <span class="text-sm text-gray-500 dark:text-gray-400">{{ kanbanCardSizeLabels[kanbanCardSize] || kanbanCardSize }}</span>
                      <ChevronRightIcon class="w-4 h-4" />
                    </div>
                  </MenuButton>
                  <Transition
                    enter-active-class="transition duration-100 ease-out"
                    enter-from-class="transform scale-95 opacity-0"
                    enter-to-class="transform scale-100 opacity-100"
                    leave-active-class="transition duration-75 ease-in"
                    leave-from-class="transform scale-100 opacity-100"
                    leave-to-class="transform scale-95 opacity-0"
                  >
                    <MenuItems class="absolute right-0 z-10 mt-1 w-40 origin-top-right rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg focus:outline-none">
                      <div class="py-1">
                        <MenuItem
                          v-for="(label, value) in kanbanCardSizeLabels"
                          :key="value"
                          v-slot="{ active }"
                        >
                          <button
                            @click="setKanbanCardSize(value)"
                            :class="[
                              active ? 'bg-neutral-100 dark:bg-neutral-700' : '',
                              kanbanCardSize === value ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300',
                              'block w-full text-left px-3 py-2 text-sm cursor-pointer'
                            ]"
                          >
                            {{ label }}
                          </button>
                        </MenuItem>
                      </div>
                    </MenuItems>
                  </Transition>
                </Menu>
                <div class="flex items-center justify-between px-2 py-2 text-sm text-gray-700 dark:text-gray-300">
                  <span>{{ t('common.listStackFields') }}</span>
                  <HeadlessSwitch
                    v-model="kanbanStackFields"
                    @change="saveKanbanOptions()"
                  />
                </div>
                <div class="flex items-center justify-between px-2 py-2 text-sm text-gray-700 dark:text-gray-300">
                  <span>{{ t('common.listCollapseEmpty') }}</span>
                  <HeadlessSwitch
                    v-model="kanbanCollapseEmptyColumns"
                    @change="saveKanbanOptions()"
                  />
                </div>
                <div class="flex items-center justify-between px-2 py-2 text-sm text-gray-700 dark:text-gray-300">
                  <span>{{ t('common.listShowEmptyFields') }}</span>
                  <HeadlessSwitch
                    v-model="kanbanShowEmptyFields"
                    @change="saveKanbanOptions()"
                  />
                </div>
                <div class="flex items-center justify-between px-2 py-2 text-sm text-gray-700 dark:text-gray-300">
                  <span>{{ t('common.listShowClosedRecords') }}</span>
                  <HeadlessSwitch
                    v-model="kanbanClosedTasks"
                    @change="saveKanbanOptions()"
                  />
                </div>
                <!-- Reset -->
                <Menu as="div" class="relative">
                  <MenuButton class="w-full flex items-center justify-between px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors cursor-pointer">
                    <span>{{ t('common.listReset') }}</span>
                    <ChevronRightIcon class="w-4 h-4" />
                  </MenuButton>
                  <Transition
                    enter-active-class="transition duration-100 ease-out"
                    enter-from-class="transform scale-95 opacity-0"
                    enter-to-class="transform scale-100 opacity-100"
                    leave-active-class="transition duration-75 ease-in"
                    leave-from-class="transform scale-100 opacity-100"
                    leave-to-class="transform scale-95 opacity-0"
                  >
                    <MenuItems class="absolute right-0 z-10 mt-1 w-52 origin-top-right rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg focus:outline-none">
                      <div class="py-1">
                        <MenuItem v-slot="{ active }">
                          <button
                            @click="resetKanbanToDefault"
                            :class="[
                              active ? 'bg-neutral-100 dark:bg-neutral-700' : '',
                              'block w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer'
                            ]"
                          >
                            {{ t('common.listDefaultView') }}
                          </button>
                        </MenuItem>
                      </div>
                    </MenuItems>
                  </Transition>
                </Menu>
              </div>
            </div>
            <!-- Manage fields -->
            <div>
              <button
                @click="kanbanManageFieldsExpanded = !kanbanManageFieldsExpanded"
                class="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer"
              >
                <div class="flex items-center gap-2.5">
                  <PencilSquareIcon class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('common.listManageFields') }}</span>
                </div>
                <ChevronDownIcon
                  :class="['w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform', kanbanManageFieldsExpanded ? 'rotate-180' : '']"
                />
              </button>
              <div v-if="kanbanManageFieldsExpanded" class="pb-3 space-y-3">
                <div class="relative px-4">
                  <MagnifyingGlassIcon class="absolute left-8 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    v-model="kanbanFieldSearchQuery"
                    type="text"
                    :placeholder="t('common.listSearchFields')"
                    class="w-full pl-8 pr-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-4">
                    {{ t('common.listShownCount', { count: kanbanShownFields.length }) }}
                  </h4>
                  <div class="space-y-0.5 px-2">
                    <div
                      v-for="(field, index) in kanbanShownFields"
                      :key="field.key"
                      :draggable="!field.locked"
                      @dragstart="handleKanbanDragStart($event, index)"
                      @dragover.prevent="handleKanbanDragOver"
                      @dragenter.prevent="handleKanbanDragEnter($event, index)"
                      @dragleave.prevent="handleKanbanDragLeave"
                      @drop.prevent="handleKanbanDrop($event, index)"
                      @dragend="handleKanbanDragEnd"
                      :class="[
                        'flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors',
                        field.locked ? 'cursor-not-allowed opacity-70' : 'cursor-move hover:bg-neutral-100 dark:hover:bg-neutral-800',
                        kanbanDragOverIndex === index ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                      ]"
                    >
                      <!-- Grip handle icon (6 dots vertical) - same as Customize List -->
                      <svg class="w-4 h-4 text-gray-400 flex-shrink-0 cursor-move" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="9" cy="5" r="1.5" />
                        <circle cx="9" cy="12" r="1.5" />
                        <circle cx="9" cy="19" r="1.5" />
                        <circle cx="15" cy="5" r="1.5" />
                        <circle cx="15" cy="12" r="1.5" />
                        <circle cx="15" cy="19" r="1.5" />
                      </svg>
                      <component :is="getFieldIcon(field.dataType)" class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                      <span class="flex-1 min-w-0 truncate text-sm text-gray-900 dark:text-white">{{ field.label || field.key }}</span>
                      <span v-if="field.locked" class="text-xs text-gray-500 dark:text-gray-400 shrink-0">{{ t('common.listFieldLocked') }}</span>
                      <HeadlessSwitch
                        :checked="field.visible"
                        @change="toggleKanbanFieldVisibility(field.key)"
                        :disabled="field.locked"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-4">
                    {{ t('common.listFieldHidden') }}
                  </h4>
                  <div class="space-y-0.5 px-2">
                    <div
                      v-for="field in kanbanHiddenFields"
                      :key="field.key"
                      class="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <span class="w-4 flex-shrink-0" aria-hidden="true" />
                      <component :is="getFieldIcon(field.dataType)" class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                      <span class="flex-1 min-w-0 truncate text-sm text-gray-900 dark:text-white">{{ field.label || field.key }}</span>
                      <HeadlessSwitch
                        :checked="false"
                        @change="toggleKanbanFieldVisibility(field.key)"
                      />
                    </div>
                    <div v-if="kanbanHiddenFields.length === 0" class="text-sm text-gray-500 dark:text-gray-400 py-2 text-center">{{ t('common.listNoHiddenFields') }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <MassEditDrawer
      ref="massEditDrawerRef"
      :is-open="showMassEditDrawer"
      :module-key="moduleKey"
      :selection-count="selectionCount"
      :module-title="title"
      @close="showMassEditDrawer = false"
      @submit="handleMassEditSubmit"
    />

    <!-- Quick Preview Drawer -->
    <QuickPreviewDrawer
      v-if="activeTabId && quickPreviewEnabled"
      :key="`drawer-${activeTabId}`"
      :show="showPreviewDrawer"
      :row="previewRow"
      :columns="computedColumns"
      :module-title="title"
      :module-key="moduleKey"
      :can-navigate-previous="quickPreviewCanPrevious"
      :can-navigate-next="quickPreviewCanNext"
      @close="() => { showPreviewDrawer = false; saveDrawerState(); }"
      @update="handlePreviewUpdate"
      @navigate-prev="handleQuickPreviewPrev"
      @navigate-next="handleQuickPreviewNext"
    />

  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onBeforeMount, onMounted, onUnmounted, onActivated, onDeactivated, nextTick, useSlots } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  resolveListViewLabel,
  resolveListColumnLabel,
  resolveListFilterLabel,
} from '@/utils/moduleListLabels';
import { APP_NAME_KEYS } from '@/utils/navigationLabels';
import { getModuleEmptyIllustrationSrc } from '@/utils/moduleEmptyIllustrations';

const { t, te } = useI18n();
import { useRouter, useRoute } from 'vue-router';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/vue/20/solid';
import { StarIcon as StarIconSolid } from '@heroicons/vue/24/solid';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption, Popover, PopoverButton, PopoverPanel, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { ChevronUpDownIcon, CheckIcon, Cog6ToothIcon, FunnelIcon, ChartBarIcon, XMarkIcon, WrenchScrewdriverIcon, ChevronDownIcon, ChevronRightIcon, PencilSquareIcon, MagnifyingGlassIcon, PlusIcon, TrashIcon, ArrowDownTrayIcon, DocumentDuplicateIcon, ArrowUpTrayIcon, ArchiveBoxIcon, ArrowPathIcon, ArrowRightIcon, StarIcon, PuzzlePieceIcon, RectangleStackIcon, ViewColumnsIcon } from '@heroicons/vue/24/outline';
import { 
  DocumentTextIcon, 
  UserIcon, 
  CalendarIcon, 
  TagIcon, 
  FlagIcon, 
  CheckCircleIcon,
  NoSymbolIcon,
  GlobeAltIcon,
  LinkIcon
} from '@heroicons/vue/24/outline';
import { Transition, Teleport } from 'vue';
import TableView from '@/components/common/TableView.vue';
import ModuleActions from '@/components/common/ModuleActions.vue';
import RowActions from '@/components/common/RowActions.vue';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';
import HoverTooltip from '@/components/common/HoverTooltip.vue';
import TruncatedLabel from '@/components/common/TruncatedLabel.vue';
import QuickPreviewDrawer from '@/components/common/QuickPreviewDrawer.vue';
import { useBulkActions } from '@/composables/useBulkActions';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import { fetchModuleDefinitionCached } from '@/utils/tenantSchemaApiCache';
import { moduleSupportsGenericRecordPreview } from '@/utils/recordPresence';
import { getFieldDisplayLabel } from '@/utils/fieldDisplay';
import { formatCurrencyValue, resolveOrgCurrencyCode } from '@/utils/currencyOptions';
import { formatNumber } from '@/utils/localeFormat';
import { isFieldExcludedFromListCustomize, buildListColumnsFromModuleFields } from '@/utils/buildListColumnsFromModuleFields';
import { useDefaultListFilters } from '@/composables/useDefaultListFilters';
import { useListSelection } from '@/composables/useListSelection';
import { useBulkDeleteProgressStore } from '@/stores/bulkDeleteProgress';
import { normalizeListPagination } from '@/utils/normalizeListPagination';
import {
  normalizeSortSpecs,
  parsePersistedSort,
  persistSortPayload,
  primarySort
} from '@/utils/listMultiSort';
import DateFilterDropdown from '@/components/common/DateFilterDropdown.vue';
import ListColumnFilter from '@/components/common/ListColumnFilter.vue';
import ActiveFilterChipBar from '@/components/common/ActiveFilterChipBar.vue';
import FilterBuilderPanel from '@/components/filters/FilterBuilderPanel.vue';
import { parseDateFilterValue, getDateFilterLabel, expandEventsSpecialViewFilters } from '@/utils/dateFilterOptions';
import { useListColumnFilters } from '@/composables/useListColumnFilters';
import { useFilterFieldOptions } from '@/composables/useFilterFieldOptions';
import { getDefaultOperatorForFilter, operatorRequiresValue } from '@/platform/filters/filterOperators';
import { inferFallbackFilterConfig } from '@/platform/filters/columnFilterResolver';
import { createDefaultRootGroup } from '@/platform/filters/filterQueryAst';
import { compileFilterQueryAst, syncRootGroupFromActiveFilters } from '@/platform/filters/filterQueryAstCompiler';
import { compileOperatorValueForApi, isFilterRuleActive } from '@/platform/filters/filterQueryCompiler';
import { countActiveFilterRules, createRuleId } from '@/platform/filters/filterQueryModel';
import { resolveFilterAllLabel } from '@/platform/filters/filterAllLabelResolver';
import { isFilterValueActive } from '@/platform/filters/filterValueUtils';
import {
  loadCustomSavedViews,
  persistCustomSavedViews,
  saveActiveSavedViewId,
} from '@/utils/listViewSavedViewsStorage';
import { applyFilterQueryContainsToFlatFilters } from '@/utils/searchRelevance';
import {
  SAVED_VIEW_NAME_MAX_LENGTH,
  SAVED_VIEW_NAME_HEADER_DISPLAY_MAX_LENGTH,
  isSavedViewNameValid,
  normalizeSavedViewName,
  suggestCopyViewName,
} from '@/utils/listViewNameLimits';
import { useNotifications } from '@/composables/useNotifications';
import MassEditDrawer from '@/components/common/MassEditDrawer.vue';
import { PLATFORM_WORKSPACE_DRAWER_HOST_ID } from '@/utils/sidebarLayout';

const workspaceDrawerHost = `#${PLATFORM_WORKSPACE_DRAWER_HOST_ID}`;

/** PlatformShell is async-loaded; defer drawer Teleport until the host node exists. */
const workspaceDrawerHostReady = ref(false);

function refreshWorkspaceDrawerHostReady() {
  if (typeof document === 'undefined') return;
  workspaceDrawerHostReady.value = Boolean(
    document.getElementById(PLATFORM_WORKSPACE_DRAWER_HOST_ID),
  );
}

onBeforeMount(() => {
  refreshWorkspaceDrawerHostReady();
});

onMounted(() => {
  if (!workspaceDrawerHostReady.value) {
    refreshWorkspaceDrawerHostReady();
  }
});

const authStore = useAuthStore();
const notifications = useNotifications();
const { activeTabId } = useTabs();

const props = defineProps({
  // Basic configuration
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  moduleKey: {
    type: String,
    required: true
  },
  createLabel: {
    type: String,
    default: 'New Record'
  },
  showCreate: {
    type: Boolean,
    default: true
  },
  showImport: {
    type: Boolean,
    default: true
  },
  showExport: {
    type: Boolean,
    default: true
  },
  /** When false, hides row selection checkboxes / row numbers */
  selectable: {
    type: Boolean,
    default: true
  },
  /** When false, hides hover row actions (view/edit/delete) */
  hasActions: {
    type: Boolean,
    default: true
  },
  /** CSS length reserved for hover row actions in the first column */
  rowActionsGutter: {
    type: String,
    default: '7rem'
  },
  /** When false, disables inline per-column header filters */
  columnHeaderFilters: {
    type: Boolean,
    default: undefined
  },
  /** Optional per-row delete guard; return false to hide row delete action */
  rowCanDelete: {
    type: Function,
    default: () => true
  },
  /** Optional i18n key for delete dialog title (receives count, recordType, recordTypePlural, name) */
  deleteConfirmTitleKey: {
    type: String,
    default: ''
  },
  /** Optional i18n key for delete dialog body (receives count, recordType, recordTypePlural, name) */
  deleteConfirmMessageKey: {
    type: String,
    default: ''
  },
  /** When false, hides filter builder / filter toolbar controls (search remains) */
  showFilters: {
    type: Boolean,
    default: true
  },
  /** When false, hides stats toggle and statistics strip entirely */
  showStats: {
    type: Boolean,
    default: true
  },
  /** Hides title, description, customize, and header action row (embedded list layouts) */
  hidePageHeader: {
    type: Boolean,
    default: false
  },
  /** Table claims remaining viewport under list chrome; body scrolls all records. */
  fillHeight: {
    type: Boolean,
    default: false
  },
  /** External customize button element ref for drawer positioning when hidePageHeader is true */
  externalCustomizeButtonRef: {
    type: Object,
    default: null
  },
  /** Hides the search input and filter toolbar above the table (parent owns search/filters) */
  hideSearchToolbar: {
    type: Boolean,
    default: false
  },
  searchPlaceholder: {
    type: String,
    default: 'Search...'
  },
  
  // Data
  data: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  
  // Statistics configuration
  statistics: {
    type: Object,
    default: () => ({})
  },
  statsConfig: {
    type: Array,
    default: null // Array of { name, key, previousKey, formatter } or null to disable stats
  },
  /** Active quick-filter stat card key (visual selection only; does not change counts). */
  selectedStatKey: {
    type: String,
    default: null
  },
  
  // Table configuration
  columns: {
    type: Array,
    required: true
  },
  filterFields: {
    type: Array,
    default: () => []
  },
  rowKey: {
    type: String,
    default: '_id'
  },
  tableId: {
    type: String,
    required: true
  },
  resizableColumns: {
    type: Boolean,
    default: true
  },
  emptyTitle: {
    type: String,
    default: 'No records yet'
  },
  emptyMessage: {
    type: String,
    default: 'Start by adding your first record'
  },
  
  // Pagination
  pagination: {
    type: Object,
    default: () => ({
      currentPage: 1,
      totalPages: 1,
      totalRecords: 0,
      limit: 20
    })
  },
  
  // Sort
  sortField: {
    type: String,
    default: 'createdAt'
  },
  sortOrder: {
    type: String,
    default: 'desc'
  },
  sorts: {
    type: Array,
    default: null
  },
  resizableColumns: {
    type: Boolean,
    default: true
  },
  
  // Saved Views (People module only)
  savedViews: {
    type: Array,
    default: () => []
  },
  activeSavedViewId: {
    type: String,
    default: null
  },
  /** View ID marked as default (loads when opening module) */
  defaultViewId: {
    type: String,
    default: null
  },
  // External filters (synced from ModuleList when stat is clicked)
  externalFilters: {
    type: Object,
    default: () => ({})
  },
  /** When 'kanban', show "Customize Kanban" and open Kanban options drawer; otherwise "Customize List" and list column drawer */
  viewMode: {
    type: String,
    default: null
  },
  /** Infinite scroll: load next server page when the table sentinel enters the scroll area */
  infiniteScroll: {
    type: Boolean,
    default: false
  },
  loadingMore: {
    type: Boolean,
    default: false
  },
  /** Table selection gutter: 'numbered-hover' shows row index until hover/focus (see TableView) */
  selectionColumnVariant: {
    type: String,
    default: 'numbered-hover',
    validator: (v) => !v || v === 'checkbox' || v === 'numbered-hover'
  },
  /** Column keys to show while active (e.g. appointment columns when filtering appointments) */
  boostVisibleColumnKeys: {
    type: Array,
    default: () => []
  },
  /** Persists table scroll position across tab switches */
  scrollSessionKey: {
    type: String,
    default: ''
  },
  /** When set (ModuleList), search input syncs from parent on view/search reset */
  parentSearchQuery: {
    type: String,
    default: undefined
  },
  /** ModuleList schedules initialListFetch — skip redundant mount emit('fetch') */
  skipMountFetch: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'update:searchQuery',
  'search-submit',
  'update:filters',
  'update:sort',
  'update:pagination',
  'fetch',
  'row-click',
  'edit',
  'delete',
  'view',
  'create',
  'import',
  'export',
  'bulk-action',
  'row-updated',
  'filter-opened',
  'saved-view-selected',
  'set-default-view',
  'stat-click',
  'saved-views-updated',
  'kanban-settings-changed',
  'stats-visibility-changed',
  'load-more'
]);

/** Table area claims remaining viewport under list chrome (title / stats / search). */
const tableAreaRef = ref(null);
const tableAreaHeightPx = ref(null);
const MIN_TABLE_AREA_HEIGHT_PX = 200;
let tableAreaFitRaf = 0;
let tableAreaResizeObserver = null;

/**
 * Stable bottom edge for residual height. Must NOT use the content child's
 * getBoundingClientRect().bottom — that shrinks after we set table height and
 * creates a measure→apply→shrink feedback loop on every reload/reflow.
 */
function getStableShellBottom(anchorEl) {
  if (typeof window === 'undefined') return 0;
  const vv = window.visualViewport;
  const visualBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const scrollRoot = anchorEl?.closest?.('[data-platform-scroll-root]');
  if (!(scrollRoot instanceof HTMLElement)) return visualBottom;

  const rootBottom = scrollRoot.getBoundingClientRect().bottom;
  let padBottom = 0;
  const shellContent = scrollRoot.firstElementChild;
  if (shellContent instanceof HTMLElement) {
    padBottom = parseFloat(window.getComputedStyle(shellContent).paddingBottom) || 0;
  }
  return Math.min(visualBottom, rootBottom) - padBottom;
}

function measureTableAreaHeight() {
  if (!props.fillHeight) {
    tableAreaHeightPx.value = null;
    return;
  }
  const el = tableAreaRef.value;
  if (!(el instanceof HTMLElement) || typeof window === 'undefined') return;
  const top = el.getBoundingClientRect().top;
  const bottom = getStableShellBottom(el);
  if (bottom <= top) return;
  const next = Math.max(MIN_TABLE_AREA_HEIGHT_PX, Math.floor(bottom - top));
  if (tableAreaHeightPx.value !== next) {
    tableAreaHeightPx.value = next;
  }
}

function queueTableAreaMeasure() {
  if (typeof window === 'undefined') return;
  if (tableAreaFitRaf) return;
  tableAreaFitRaf = window.requestAnimationFrame(() => {
    tableAreaFitRaf = 0;
    measureTableAreaHeight();
  });
}

function teardownTableAreaHeight() {
  tableAreaResizeObserver?.disconnect();
  tableAreaResizeObserver = null;
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', queueTableAreaMeasure);
    window.removeEventListener('scroll', queueTableAreaMeasure, true);
    window.visualViewport?.removeEventListener('resize', queueTableAreaMeasure);
    window.visualViewport?.removeEventListener('scroll', queueTableAreaMeasure);
  }
  if (tableAreaFitRaf && typeof window !== 'undefined') {
    window.cancelAnimationFrame(tableAreaFitRaf);
    tableAreaFitRaf = 0;
  }
}

function setupTableAreaHeight() {
  teardownTableAreaHeight();
  if (!props.fillHeight || typeof window === 'undefined') {
    tableAreaHeightPx.value = null;
    return;
  }
  measureTableAreaHeight();
  if (typeof ResizeObserver !== 'undefined') {
    tableAreaResizeObserver = new ResizeObserver(() => queueTableAreaMeasure());
    // Observe ancestors above the table so stats/header/banner reflows re-fit.
    // Stop at platform scroll root (stable panel size) — never use content height.
    let node = tableAreaRef.value?.parentElement ?? null;
    let depth = 0;
    while (node && depth < 10) {
      tableAreaResizeObserver.observe(node);
      if (node.hasAttribute('data-platform-scroll-root')) break;
      node = node.parentElement;
      depth += 1;
    }
  }
  window.addEventListener('resize', queueTableAreaMeasure, { passive: true });
  // Page scroll shifts table top; ignore pure internal table body scrolls (same top).
  window.addEventListener('scroll', queueTableAreaMeasure, { passive: true, capture: true });
  window.visualViewport?.addEventListener('resize', queueTableAreaMeasure);
  window.visualViewport?.addEventListener('scroll', queueTableAreaMeasure);
}

const tableAreaMergedStyle = computed(() => {
  const style = { isolation: 'auto' };
  if (props.fillHeight && tableAreaHeightPx.value != null) {
    style.height = `${tableAreaHeightPx.value}px`;
    style.maxHeight = `${tableAreaHeightPx.value}px`;
  }
  return style;
});

/** Percentage fill of the measured table slot. */
const resolvedTableMaxBodyHeight = computed(() => {
  if (!props.fillHeight) return undefined;
  if (tableAreaHeightPx.value != null) return '100%';
  return undefined;
});

const slots = useSlots();
/** Slot names frozen on first setup — dynamic v-for over reactive slot keys causes patch races on refresh. */
const forwardedSlotNames = Object.keys(slots)
  .filter((name) => name !== 'actions' && name !== 'empty' && name !== 'empty-actions')
  .sort();

// Use bulk actions composable
const { bulkActions: massActions } = useBulkActions(props.moduleKey);

// Use default list filters composable (opt-in, feature-flagged)
// This provides suggested filters based on field metadata
// See: /platform/fields/DefaultFilterPolicy.ts
const {
  isEnabled: suggestedFiltersEnabled,
  defaultFilters: suggestedFilters,
  hasDefaultFilters: hasSuggestedFilters,
  isDefaultFilter: isSuggestedFilter,
} = useDefaultListFilters(props.moduleKey);

// Local search input — debounced to parent via update:searchQuery (ModuleList owns fetch params)
const searchQuery = ref('');

watch(
  () => props.parentSearchQuery,
  (value) => {
    if (value === undefined) return;
    const next = value ?? '';
    if (next !== searchQuery.value) {
      searchQuery.value = next;
    }
  },
  { immediate: true }
);
const showColumnSettings = ref(false);
const showKanbanSettings = ref(false);
const visibleColumns = ref([]);
const columnsInitialized = ref(false);
/** Single gate for first TableView mount — after columns + persisted session restore. */
const listSessionReady = ref(false);
const layoutOptionsExpanded = ref(true);
const manageFieldsExpanded = ref(true);
const fieldSearchQuery = ref('');
const dragOverIndex = ref(null);
// Kanban customize state
const kanbanOptionsExpanded = ref(true);
const kanbanManageFieldsExpanded = ref(true);
const kanbanFieldSearchQuery = ref('');
const kanbanCardSize = ref('medium');
const kanbanStackFields = ref(true);
const kanbanCollapseEmptyColumns = ref(false);
const kanbanShowEmptyFields = ref(true);
const kanbanClosedTasks = ref(true);
const kanbanVisibleColumns = ref([]);
const kanbanDragOverIndex = ref(null);
const kanbanDragStartIndex = ref(null);
const backendModuleConfig = ref(null); // Store backend module configuration with all fields
const resetWidthsTrigger = ref(0); // Trigger to reset column widths in TableView
const showDeleteModal = ref(false);
const showMassEditDrawer = ref(false);
const massEditDrawerRef = ref(null);
const rowToDelete = ref(null);
const deleting = ref(false);
const bulkDeleteStore = useBulkDeleteProgressStore();
const deleteModalBusy = computed(() =>
  deleting.value || (isBulkDelete.value && bulkDeleteStore.isActive)
);

function resetBulkDeleteModalState() {
  showDeleteModal.value = false;
  rowToDelete.value = null;
  isBulkDelete.value = false;
  bulkDeleteRows.value = [];
  bulkDeletePayload.value = null;
}

watch(() => bulkDeleteStore.isActive, (active) => {
  if (!active && showDeleteModal.value && isBulkDelete.value) {
    resetBulkDeleteModalState();
  }
});
const isBulkDelete = ref(false);
const bulkDeleteRows = ref([]);
const bulkDeletePayload = ref(null);

const bulkDeleteCount = computed(() => {
  if (isBulkDelete.value && bulkDeletePayload.value) {
    return bulkDeletePayload.value.selectionCount ?? 0;
  }
  return bulkDeleteRows.value.length;
});
const showPreviewDrawer = ref(false);
const previewRow = ref(null);

// Saved View Management (People module only)
const showSaveViewModal = ref(false);
const editingView = ref(null);
const saveMode = ref('create');
const viewFormData = ref({ name: '', description: '' });
const viewFormNameError = ref('');

const canSaveView = computed(() => isSavedViewNameValid(viewFormData.value.name));

const viewFormNameCharCount = computed(() => viewFormData.value.name.length);

const viewFormNameAtLimit = computed(
  () => viewFormNameCharCount.value >= SAVED_VIEW_NAME_MAX_LENGTH
);
const viewToDelete = ref(null);
const showDeleteViewModal = ref(false);

// Store drawer state per tab
const drawerStateByTab = ref(new Map());
// Flag to prevent saving during restoration
const isRestoring = ref(false);

// Save drawer state for current tab
const saveDrawerState = () => {
  if (activeTabId.value && !isRestoring.value) {
    drawerStateByTab.value.set(activeTabId.value, {
      show: showPreviewDrawer.value,
      row: previewRow.value ? { ...previewRow.value } : null
    });
  }
};

// Restore drawer state for current tab
const restoreDrawerState = () => {
  if (activeTabId.value) {
    isRestoring.value = true;
    const savedState = drawerStateByTab.value.get(activeTabId.value);
    if (savedState && savedState.show) {
      showPreviewDrawer.value = savedState.show;
      previewRow.value = savedState.row;
    } else {
      // No saved state for this tab, close drawer
      showPreviewDrawer.value = false;
      previewRow.value = null;
    }
    nextTick(() => {
      isRestoring.value = false;
    });
  } else {
    // No active tab, close drawer
    showPreviewDrawer.value = false;
    previewRow.value = null;
  }
};

// Watch for tab changes
watch(() => activeTabId.value, (newTabId, oldTabId) => {
  // Save state for old tab before switching
  if (oldTabId) {
    isRestoring.value = true;
    saveDrawerState();
    isRestoring.value = false;
  }
  // Immediately close drawers when switching tabs (preview restores per-tab below)
  showPreviewDrawer.value = false;
  previewRow.value = null;
  showColumnSettings.value = false;
  showKanbanSettings.value = false;
  // Then restore state for new tab
  nextTick(() => {
    restoreDrawerState();
  });
});

// Watch for drawer state changes and save to current tab (but not during restoration)
watch([showPreviewDrawer, previewRow], () => {
  if (activeTabId.value && !isRestoring.value) {
    saveDrawerState();
  }
}, { deep: true });

onDeactivated(() => {
  teardownTableAreaHeight();
  showColumnSettings.value = false;
  showKanbanSettings.value = false;
});

onActivated(() => {
  nextTick(() => setupTableAreaHeight());
});

// Get record name for delete modal
const deleteRecordName = computed(() => {
  if (!rowToDelete.value) return '';
  
  const row = rowToDelete.value;
  
  // Try common name fields in order of preference
  if (row.name) return row.name;
  if (row.title) return row.title;
  if (row.firstName || row.lastName) {
    return `${row.firstName || ''} ${row.lastName || ''}`.trim();
  }
  if (row.first_name || row.last_name) {
    return `${row.first_name || ''} ${row.last_name || ''}`.trim();
  }
  
  return '';
});

const customDeleteDialogTitle = computed(() => {
  const key = props.deleteConfirmTitleKey;
  if (!key || !te(key)) return '';
  return t(key, {
    count: bulkDeleteCount.value,
    name: deleteRecordName.value,
    recordType: 'User',
    recordTypePlural: 'Users'
  });
});

const customDeleteDialogMessage = computed(() => {
  const key = props.deleteConfirmMessageKey;
  if (!key || !te(key)) return '';
  return t(key, {
    count: bulkDeleteCount.value,
    name: deleteRecordName.value,
    recordType: 'User',
    recordTypePlural: 'Users'
  });
});

/** Hide table body when parent uses kanban/calendar (chrome + stats stay visible). */
const showListTableBody = computed(() => {
  const mode = props.viewMode;
  if (mode == null || mode === '') return true;
  return String(mode).toLowerCase() === 'list';
});

// Customize button label and click (List vs Kanban)
const customizeButtonLabel = computed(() =>
  props.viewMode === 'kanban' ? t('common.listCustomizeKanban') : t('common.listCustomizeView')
);
const customizeButtonShortLabel = computed(() => t('common.listCustomizeShort'));
const customizeButtonDesktopRef = ref(null);
const customizeButtonMobileRef = ref(null);
const customizeDrawerTopPx = ref(0);

function resolveCustomizeButtonEl() {
  const externalRef = props.externalCustomizeButtonRef;
  const externalEl = externalRef?.value ?? externalRef;
  if (externalEl instanceof HTMLElement) {
    const rect = externalEl.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return externalEl;
  }
  for (const el of [customizeButtonDesktopRef.value, customizeButtonMobileRef.value]) {
    if (!(el instanceof HTMLElement)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return null;
}

function syncCustomizeDrawerPosition() {
  if (typeof document === 'undefined') return;

  const host = document.getElementById(PLATFORM_WORKSPACE_DRAWER_HOST_ID);
  const button = resolveCustomizeButtonEl();
  if (!(host instanceof HTMLElement) || !button) {
    customizeDrawerTopPx.value = 0;
    return;
  }

  const hostRect = host.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  customizeDrawerTopPx.value = Math.max(0, Math.round(buttonRect.top - hostRect.top));
}

const customizeDrawerInsetStyle = computed(() => ({
  top: `${customizeDrawerTopPx.value}px`,
}));

let customizeDrawerPositionListenersBound = false;

function bindCustomizeDrawerPositionListeners() {
  if (customizeDrawerPositionListenersBound) return;
  customizeDrawerPositionListenersBound = true;
  window.addEventListener('resize', syncCustomizeDrawerPosition, { passive: true });
  const scrollRoot = document.querySelector('[data-platform-scroll-root]');
  scrollRoot?.addEventListener('scroll', syncCustomizeDrawerPosition, { passive: true });
}

function unbindCustomizeDrawerPositionListeners() {
  if (!customizeDrawerPositionListenersBound) return;
  customizeDrawerPositionListenersBound = false;
  window.removeEventListener('resize', syncCustomizeDrawerPosition);
  const scrollRoot = document.querySelector('[data-platform-scroll-root]');
  scrollRoot?.removeEventListener('scroll', syncCustomizeDrawerPosition);
}

const closeCustomizeDrawers = () => {
  showColumnSettings.value = false;
  showKanbanSettings.value = false;
};

const handleCustomizeClick = () => {
  syncCustomizeDrawerPosition();
  if (props.viewMode === 'kanban') {
    showKanbanSettings.value = !showKanbanSettings.value;
    if (showKanbanSettings.value) {
      loadKanbanSettings();
    }
  } else {
    showColumnSettings.value = !showColumnSettings.value;
  }
};

watch([showColumnSettings, showKanbanSettings], ([columnOpen, kanbanOpen]) => {
  if (columnOpen || kanbanOpen) {
    syncCustomizeDrawerPosition();
    nextTick(() => requestAnimationFrame(syncCustomizeDrawerPosition));
    bindCustomizeDrawerPositionListeners();
    return;
  }
  unbindCustomizeDrawerPositionListeners();
});

// Row height - load from localStorage
const rowHeightStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-row-height`);
const DEFAULT_ROW_HEIGHT = 'small';

const getDefaultRowHeight = () => {
  if (typeof window === 'undefined') return DEFAULT_ROW_HEIGHT;
  const saved = localStorage.getItem(rowHeightStorageKey.value);
  return (saved && ['small', 'medium', 'large', 'huge'].includes(saved)) ? saved : DEFAULT_ROW_HEIGHT;
};
const rowHeight = ref(DEFAULT_ROW_HEIGHT); // Initialize with default, will be set on mount

// Watch row height and save to localStorage
watch(rowHeight, (value) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(rowHeightStorageKey.value, value);
  }
});

// Row height options
const rowHeightLabels = computed(() => ({
  small: t('common.listRowHeightSmall'),
  medium: t('common.listRowHeightMedium'),
  large: t('common.listRowHeightLarge'),
  huge: t('common.listRowHeightHuge'),
}));

// Check if we're on desktop (md breakpoint and above)
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024);
const isLargeDesktop = computed(() => windowWidth.value >= 1024);

// Stats visibility - show by default on desktop, hide on mobile/tablet
// Load from localStorage if available, otherwise use default based on screen size
const getDefaultShowStats = () => {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem(`arivu-stats-visible-${props.moduleKey}`);
  if (saved !== null) {
    return saved === 'true';
  }
  return window.innerWidth >= 768; // Show by default on desktop
};

const statsPanelVisible = ref(getDefaultShowStats());

const statsToggleTitle = computed(() =>
  statsPanelVisible.value ? t('common.listHideStatistics') : t('common.listShowStatistics')
);

// Save stats visibility preference to localStorage
const saveStatsPreference = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`arivu-stats-visible-${props.moduleKey}`, statsPanelVisible.value.toString());
  }
};

// Watch for changes to statsPanelVisible and save to localStorage; emit so parent (e.g. Deals) can adjust Kanban height
watch(statsPanelVisible, (val) => {
  saveStatsPreference();
  emit('stats-visibility-changed', val);
  nextTick(() => queueTableAreaMeasure());
});

watch(
  () => [props.fillHeight, props.hidePageHeader, props.showStats, props.statsConfig?.length],
  () => {
    nextTick(() => setupTableAreaHeight());
  },
  { flush: 'post' }
);

// Update window width on resize
const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth;
};

onMounted(() => {
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth;
    // Initialize statsPanelVisible from localStorage or default
    statsPanelVisible.value = getDefaultShowStats();
    window.addEventListener('resize', updateWindowWidth);
  }
  nextTick(() => setupTableAreaHeight());
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateWindowWidth);
  }
  unbindCustomizeDrawerPositionListeners();
  teardownTableAreaHeight();
});

const QUOTES_LIST_COLUMNS_PREFS_VERSION = 5;
const quotesListColumnsPrefsVersionKey = 'arivu-listview-quotes-columns-prefs-version';
const LIVE_CHAT_CLOSED_COLUMNS_PREFS_VERSION = 4;
const liveChatClosedColumnsPrefsVersionKey = 'arivu-listview-live-chat-closed-columns-prefs-version';

// Load saved column settings from localStorage
const loadSavedColumnSettings = () => {
  if (typeof window === 'undefined' || !Array.isArray(props.columns)) {
    return null;
  }

  try {
    if (props.moduleKey === 'quotes') {
      const prefsVersion = Number(localStorage.getItem(quotesListColumnsPrefsVersionKey) || 0);
      if (prefsVersion < QUOTES_LIST_COLUMNS_PREFS_VERSION) {
        localStorage.removeItem(columnsStorageKey.value);
        localStorage.setItem(
          quotesListColumnsPrefsVersionKey,
          String(QUOTES_LIST_COLUMNS_PREFS_VERSION)
        );
        return null;
      }
    }

    if (props.moduleKey === 'live-chat-closed') {
      const prefsVersion = Number(localStorage.getItem(liveChatClosedColumnsPrefsVersionKey) || 0);
      if (prefsVersion < LIVE_CHAT_CLOSED_COLUMNS_PREFS_VERSION) {
        localStorage.removeItem(columnsStorageKey.value);
        localStorage.setItem(
          liveChatClosedColumnsPrefsVersionKey,
          String(LIVE_CHAT_CLOSED_COLUMNS_PREFS_VERSION)
        );
        return null;
      }
    }

    const saved = localStorage.getItem(columnsStorageKey.value);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed)) {
        const propKeys = new Set(props.columns.map((col) => col.key));
        const sanitized = parsed.filter((col) => col?.key && propKeys.has(col.key));
        const missingPropColumn = props.columns.some(
          (col) => !sanitized.some((savedCol) => savedCol.key === col.key),
        );
        if (missingPropColumn || sanitized.length !== parsed.length) {
          localStorage.removeItem(columnsStorageKey.value);
          return null;
        }
        // Cases: guard against old saved settings that included internal/system keys
        if (props.moduleKey === 'cases') {
          return sanitized
            .filter((c) => c && c.key && !String(c.key).includes('.'))
            .map((savedCol) => {
              const propCol = props.columns.find((col) => col.key === savedCol.key);
              return {
                ...savedCol,
                label: propCol?.label || savedCol.label,
              };
            });
        }
        return sanitized.map((savedCol) => {
          const propCol = props.columns.find((col) => col.key === savedCol.key);
          return {
            ...savedCol,
            label: propCol?.label || savedCol.label,
          };
        });
      }
    }
  } catch (error) {
    console.warn('Failed to parse saved column settings', error);
  }
  return null;
};

// Save column settings to localStorage
const saveColumnSettings = () => {
  if (typeof window === 'undefined' || visibleColumns.value.length === 0) {
    return;
  }

  try {
    const settingsToSave = visibleColumns.value.map(col => ({
      key: col.key,
      label: col.label,
      visible: col.visible,
      dataType: col.dataType,
      showInTable: col.showInTable
    }));
    localStorage.setItem(columnsStorageKey.value, JSON.stringify(settingsToSave));
  } catch (error) {
    console.warn('Failed to save column settings', error);
  }
};

// Kanban customize: load/save options and card fields
const loadKanbanSettings = () => {
  if (typeof window === 'undefined') return;
  try {
    const optsRaw = localStorage.getItem(kanbanOptionsStorageKey.value);
    if (optsRaw) {
      const opts = JSON.parse(optsRaw);
      if (opts.cardSize) kanbanCardSize.value = opts.cardSize;
      if (typeof opts.stackFields === 'boolean') kanbanStackFields.value = opts.stackFields;
      if (typeof opts.collapseEmptyColumns === 'boolean') kanbanCollapseEmptyColumns.value = opts.collapseEmptyColumns;
      if (typeof opts.showEmptyFields === 'boolean') kanbanShowEmptyFields.value = opts.showEmptyFields;
      if (typeof opts.closedTasks === 'boolean') kanbanClosedTasks.value = opts.closedTasks;
    }
    const fieldsRaw = localStorage.getItem(kanbanFieldsStorageKey.value);
    if (fieldsRaw) {
      const parsed = JSON.parse(fieldsRaw);
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        kanbanVisibleColumns.value = normalizeKanbanColumnsForTitle(parsed.map(c => ({ ...c, sortable: c.sortable !== false })));
        return;
      }
    }
    // Default: for deals/tasks use fixed card order; otherwise copy from list visible columns or props.columns
    const source = visibleColumns.value.length > 0 ? visibleColumns.value : props.columns.map(c => ({ ...c, visible: c.visible !== false, showInTable: c.showInTable !== false }));
    if (props.moduleKey === 'deals') {
      kanbanVisibleColumns.value = buildDealsDefaultKanbanColumns(source);
    } else if (props.moduleKey === 'tasks') {
      kanbanVisibleColumns.value = buildTasksDefaultKanbanColumns(source);
    } else {
      kanbanVisibleColumns.value = normalizeKanbanColumnsForTitle(source.map(col => ({
        key: col.key,
        label: col.label || col.key,
        visible: col.visible !== false,
        dataType: col.dataType,
        sortable: col.sortable !== false,
        showInTable: col.showInTable !== false
      })));
    }
  } catch (e) {
    console.warn('Failed to load kanban settings', e);
    const source = visibleColumns.value.length > 0 ? visibleColumns.value : props.columns.map(c => ({ ...c, visible: c.visible !== false, showInTable: c.showInTable !== false }));
    if (props.moduleKey === 'deals') {
      kanbanVisibleColumns.value = buildDealsDefaultKanbanColumns(source);
    } else if (props.moduleKey === 'tasks') {
      kanbanVisibleColumns.value = buildTasksDefaultKanbanColumns(source);
    } else {
      kanbanVisibleColumns.value = normalizeKanbanColumnsForTitle(source.map(col => ({
        key: col.key,
        label: col.label || col.key,
        visible: col.visible !== false,
        dataType: col.dataType,
        sortable: col.sortable !== false,
        showInTable: col.showInTable !== false
      })));
    }
  }
};
const saveKanbanOptions = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(kanbanOptionsStorageKey.value, JSON.stringify({
      cardSize: kanbanCardSize.value,
      stackFields: kanbanStackFields.value,
      collapseEmptyColumns: kanbanCollapseEmptyColumns.value,
      showEmptyFields: kanbanShowEmptyFields.value,
      closedTasks: kanbanClosedTasks.value
    }));
    emit('kanban-settings-changed');
  } catch (e) {
    console.warn('Failed to save kanban options', e);
  }
};
const saveKanbanFields = () => {
  if (typeof window === 'undefined' || kanbanVisibleColumns.value.length === 0) return;
  try {
    const normalized = normalizeKanbanColumnsForTitle(kanbanVisibleColumns.value);
    const toSave = normalized.map(col => ({
      key: col.key,
      label: col.label,
      visible: col.visible,
      dataType: col.dataType,
      showInTable: col.showInTable
    }));
    localStorage.setItem(kanbanFieldsStorageKey.value, JSON.stringify(toSave));
    emit('kanban-settings-changed');
  } catch (e) {
    console.warn('Failed to save kanban fields', e);
  }
};
// Record title field is always first, visible, and cannot be reordered or disabled (name or title)
const KANBAN_TITLE_KEYS = ['name', 'title'];
const isKanbanTitleField = (key) => key && KANBAN_TITLE_KEYS.includes(key);
const normalizeKanbanColumnsForTitle = (cols) => {
  if (!Array.isArray(cols) || cols.length === 0) return cols;
  const titleKey = cols.find(c => isKanbanTitleField(c.key))?.key;
  if (!titleKey) return cols;
  const titleCol = cols.find(c => c.key === titleKey);
  if (!titleCol) return cols;
  const rest = cols.filter(c => c.key !== titleKey);
  return [{ ...titleCol, visible: true, showInTable: true }, ...rest];
};

const getSyntheticColumnLabel = (moduleKey, key) =>
  resolveListColumnLabel(moduleKey, key, key, t, te);

// Default Kanban card field order for deals: Title, Amount, Expected Close Date, Probability, Priority, Organization, Deal Owner
const DEALS_KANBAN_DEFAULT_VISIBLE_KEYS = ['name', 'amount', 'expectedCloseDate', 'probability', 'priority', 'accountId', 'assignedTo'];

// Default Kanban card field order for tasks: Title, Assigned to, Due Date, Priority
const TASKS_KANBAN_DEFAULT_VISIBLE_KEYS = ['title', 'assignedTo', 'dueDate', 'priority'];
const EVENTS_APPOINTMENT_BOOST_KEYS = [
  'appointmentBookedBy',
  'appointmentBookingSource',
  'appointmentType',
  'appointmentMeetingLink',
];
/** Ensure every key in defaultVisibleColumns exists in the column map (add synthetic columns if missing). */
function ensureDefaultColumnsInMap(moduleKey, defaultVisibleColumns, columnMap) {
  if (!defaultVisibleColumns || !columnMap) return;
  defaultVisibleColumns.forEach((key) => {
    if (!columnMap.has(key)) {
      columnMap.set(key, {
        key,
        label: getSyntheticColumnLabel(moduleKey, key),
        dataType: 'Lookup',
        sortable: false,
        showInTable: true
      });
    }
  });
}

/** Recover from stale saved column prefs (e.g. after catalog column renames). */
async function applyRegistryDefaultVisibleColumns() {
  const { getModuleListConfig, buildDefaultColumns } = await import('@/platform/modules/moduleListRegistry').catch(() => ({
    getModuleListConfig: () => null,
    buildDefaultColumns: () => []
  }));
  const moduleListConfig = getModuleListConfig(props.moduleKey);
  if (!moduleListConfig?.defaultColumns || !Array.isArray(props.columns) || props.columns.length === 0) {
    return false;
  }

  const allAvailableColumnsMap = new Map();
  props.columns.forEach((col) => {
    allAvailableColumnsMap.set(col.key, {
      key: col.key,
      label: col.label || col.key,
      dataType: col.dataType,
      sortable: col.sortable !== false,
      showInTable: col.showInTable !== false
    });
  });
  ensureDefaultColumnsInMap(
    props.moduleKey,
    moduleListConfig.defaultColumns.defaultVisibleColumns,
    allAvailableColumnsMap
  );
  const defaultColumns = buildDefaultColumns(
    Array.from(allAvailableColumnsMap.values()),
    moduleListConfig.defaultColumns
  );
  visibleColumns.value = normalizeColumnOrder(defaultColumns);
  saveColumnSettings();
  return true;
}

function buildDealsDefaultKanbanColumns(sourceColumns) {
  const byKey = new Map(sourceColumns.map(c => [c.key, c]));
  const ordered = [];
  const added = new Set();
  DEALS_KANBAN_DEFAULT_VISIBLE_KEYS.forEach(key => {
    const col = byKey.get(key);
    if (col) {
      ordered.push({ ...col, key: col.key, label: col.label || getSyntheticColumnLabel('deals', key), visible: true, dataType: col.dataType, sortable: col.sortable !== false, showInTable: true });
      added.add(key);
    } else {
      // Column not in list definition (e.g. accountId) - add synthetic column so it shows on card
      ordered.push({
        key,
        label: getSyntheticColumnLabel('deals', key),
        visible: true,
        dataType: 'Lookup',
        sortable: false,
        showInTable: true
      });
      added.add(key);
    }
  });
  sourceColumns.forEach(col => {
    if (!added.has(col.key)) {
      ordered.push({ ...col, key: col.key, label: col.label || col.key, visible: false, dataType: col.dataType, sortable: col.sortable !== false, showInTable: false });
    }
  });
  return normalizeKanbanColumnsForTitle(ordered);
}

function buildTasksDefaultKanbanColumns(sourceColumns) {
  const byKey = new Map(sourceColumns.map(c => [c.key, c]));
  const ordered = [];
  const added = new Set();
  TASKS_KANBAN_DEFAULT_VISIBLE_KEYS.forEach(key => {
    const col = byKey.get(key);
    if (col) {
      ordered.push({
        ...col,
        key: col.key,
        label: col.label || getSyntheticColumnLabel('tasks', key),
        visible: true,
        dataType: col.dataType,
        sortable: col.sortable !== false,
        showInTable: true
      });
      added.add(key);
    } else {
      ordered.push({
        key,
        label: getSyntheticColumnLabel('tasks', key),
        visible: true,
        dataType: key === 'assignedTo' ? 'user' : key === 'dueDate' ? 'date' : 'text',
        sortable: false,
        showInTable: true
      });
      added.add(key);
    }
  });
  sourceColumns.forEach(col => {
    if (!added.has(col.key)) {
      ordered.push({ ...col, key: col.key, label: col.label || col.key, visible: false, dataType: col.dataType, sortable: col.sortable !== false, showInTable: false });
    }
  });
  return normalizeKanbanColumnsForTitle(ordered);
}

const kanbanShownFields = computed(() => {
  const q = kanbanFieldSearchQuery.value.trim().toLowerCase();
  const shown = kanbanVisibleColumns.value.filter(c =>
    c.visible &&
    !isSystemFieldForList(props.moduleKey, c.key) &&
    (!q || (c.label || c.key).toLowerCase().includes(q))
  );
  return shown.map(c => ({ ...c, locked: isKanbanTitleField(c.key) }));
});
const kanbanHiddenFields = computed(() => {
  const q = kanbanFieldSearchQuery.value.trim().toLowerCase();
  return kanbanVisibleColumns.value.filter(c =>
    !c.visible &&
    !isKanbanTitleField(c.key) &&
    !isSystemFieldForList(props.moduleKey, c.key) &&
    (!q || (c.label || c.key).toLowerCase().includes(q))
  );
});
const toggleKanbanFieldVisibility = (fieldKey) => {
  if (isKanbanTitleField(fieldKey)) return;
  const col = kanbanVisibleColumns.value.find(c => c.key === fieldKey);
  if (!col) return;
  col.visible = !col.visible;
  col.showInTable = col.visible;
  saveKanbanFields();
};
const kanbanCardSizeLabels = computed(() => ({
  small: t('common.listRowHeightSmall'),
  medium: t('common.listRowHeightMedium'),
  large: t('common.listRowHeightLarge'),
}));
const setKanbanCardSize = (value) => {
  kanbanCardSize.value = value;
  saveKanbanOptions();
};

const resetKanbanToDefault = () => {
  kanbanCardSize.value = 'medium';
  kanbanStackFields.value = true;
  kanbanCollapseEmptyColumns.value = false;
  kanbanShowEmptyFields.value = true;
  kanbanClosedTasks.value = true;
  const source = visibleColumns.value.length > 0 ? visibleColumns.value : props.columns.map(c => ({ ...c, visible: c.visible !== false, showInTable: c.showInTable !== false }));
  if (props.moduleKey === 'deals') {
    kanbanVisibleColumns.value = buildDealsDefaultKanbanColumns(source);
  } else if (props.moduleKey === 'tasks') {
    kanbanVisibleColumns.value = buildTasksDefaultKanbanColumns(source);
  } else {
    kanbanVisibleColumns.value = normalizeKanbanColumnsForTitle(source.map(col => ({
      key: col.key,
      label: col.label || col.key,
      visible: col.visible !== false,
      dataType: col.dataType,
      sortable: col.sortable !== false,
      showInTable: col.showInTable !== false
    })));
  }
  saveKanbanOptions();
  saveKanbanFields();
};

// Drag-and-drop reorder for Kanban Shown fields
const handleKanbanDragStart = (event, index) => {
  if (kanbanShownFields.value[index]?.locked) return;
  kanbanDragStartIndex.value = index;
  event.dataTransfer.effectAllowed = 'move';
  if (event.target) event.target.style.opacity = '0.5';
};
const handleKanbanDragOver = (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
};
const handleKanbanDragEnter = (event, index) => {
  event.preventDefault();
  if (kanbanShownFields.value[index]?.locked) return;
  kanbanDragOverIndex.value = index;
};
const handleKanbanDragLeave = () => {
  kanbanDragOverIndex.value = null;
};
const handleKanbanDrop = (event, dropIndex) => {
  event.preventDefault();
  kanbanDragOverIndex.value = null;
  const start = kanbanDragStartIndex.value;
  if (start == null || start === dropIndex) {
    kanbanDragStartIndex.value = null;
    return;
  }
  const shown = kanbanShownFields.value;
  if (shown[start]?.locked) {
    kanbanDragStartIndex.value = null;
    return;
  }
  const visibleCols = kanbanVisibleColumns.value.filter(c => c.visible);
  const hiddenCols = kanbanVisibleColumns.value.filter(c => !c.visible);
  if (start < 0 || start >= visibleCols.length || dropIndex < 0 || dropIndex >= visibleCols.length) {
    kanbanDragStartIndex.value = null;
    return;
  }
  const dragged = visibleCols[start];
  visibleCols.splice(start, 1);
  const insertIndex = start < dropIndex ? dropIndex - 1 : dropIndex;
  visibleCols.splice(Math.max(0, Math.min(insertIndex, visibleCols.length)), 0, dragged);
  kanbanVisibleColumns.value = normalizeKanbanColumnsForTitle([...visibleCols, ...hiddenCols]);
  saveKanbanFields();
  kanbanDragStartIndex.value = null;
};
const handleKanbanDragEnd = (event) => {
  if (event.target) event.target.style.opacity = '1';
  kanbanDragStartIndex.value = null;
  kanbanDragOverIndex.value = null;
};

// Fetch field configuration from backend and sync visibility
const fetchFieldConfiguration = async () => {
  try {
    const moduleKey = props.moduleKey;
    if (!moduleKey) return null;

    const module = await fetchModuleDefinitionCached(moduleKey);
    if (module) {
      // Store backend config for later use
      backendModuleConfig.value = module;
    }
    return module || null;
  } catch (error) {
    console.warn('Error fetching field configuration:', error);
    return null;
  }
};

// Normalize column order - ensure 'name' field is at top for forms module
const normalizeColumnOrder = (columns) => {
  if (!Array.isArray(columns)) {
    return [];
  }

  if (props.moduleKey === 'live-chat-closed') {
    const lockedKeys = ['visitor', 'sessionKey'];
    const orderedColumns = [];
    const processedKeys = new Set();

    lockedKeys.forEach((key) => {
      const col = columns.find((column) => column.key === key);
      if (col) {
        orderedColumns.push({ ...col, locked: true });
        processedKeys.add(key);
      }
    });

    columns.forEach((col) => {
      if (!processedKeys.has(col.key)) {
        orderedColumns.push(col);
      }
    });

    return orderedColumns;
  }

  if (props.moduleKey === 'quotes') {
    const quotesOrder = [
      'quoteTitle',
      'quoteNumber',
      'organizationRefId',
      'status',
      'grandTotal',
      'validUntil',
      'assignedTo',
      'updatedAt'
    ];
    const orderedColumns = [];
    const processedKeys = new Set();
    const lockedKey = 'quoteTitle';

    const lockedCol = columns.find((col) => col.key === lockedKey);
    if (lockedCol) {
      orderedColumns.push({ ...lockedCol, locked: true });
      processedKeys.add(lockedKey);
    }

    quotesOrder.forEach((key) => {
      if (processedKeys.has(key)) return;
      const col = columns.find((c) => c.key === key);
      if (col) {
        orderedColumns.push({ ...col, locked: false });
        processedKeys.add(key);
      }
    });

    columns.forEach((col) => {
      if (!processedKeys.has(col.key)) {
        orderedColumns.push({ ...col, locked: false });
      }
    });

    return orderedColumns;
  }

  // Forms: 'name' is always first and locked (required list + detail title column)
  if (props.moduleKey === 'forms') {
    const orderedColumns = [];
    const processedKeys = new Set();

    const nameColumn = columns.find((col) => col.key?.toLowerCase() === 'name');
    if (nameColumn) {
      orderedColumns.push({ ...nameColumn, locked: true, visible: nameColumn.visible !== false });
      processedKeys.add(nameColumn.key);
    }

    columns.forEach((col) => {
      if (!processedKeys.has(col.key)) {
        orderedColumns.push(col);
      }
    });

    return orderedColumns;
  }

  // Handle specific ordering for the 'people' module
  if (props.moduleKey === 'people') {
    const peopleSpecificOrder = [
      'name',
      'sales_type',
      'derivedStatus',
      'email',
      'mobile',
      'organization',
      'source',
      'lead_score',
      'assignedTo',
      'lastActivity',
      'createdAt',
    ];
    const orderedColumns = [];
    const processedKeys = new Set();

    // Ensure 'name' is always first and locked
    const nameColumn = columns.find(col => col.key === 'name');
    if (nameColumn) {
      orderedColumns.push({ ...nameColumn, locked: true });
      processedKeys.add('name');
    }

    // Add other columns according to the peopleSpecificOrder
    peopleSpecificOrder.forEach(key => {
      if (!processedKeys.has(key)) {
        const col = columns.find(c => c.key === key);
        if (col) {
          orderedColumns.push(col);
          processedKeys.add(key);
        }
      }
    });

    // Add any remaining columns that were not explicitly ordered
    columns.forEach(col => {
      if (!processedKeys.has(col.key)) {
        orderedColumns.push(col);
      }
    });

    return orderedColumns;
  }

  // Handle specific ordering for the 'organizations' module
  if (props.moduleKey === 'organizations') {
    const organizationsSpecificOrder = [
      'name',
      'types',
      'derivedStatus',
      'industry',
      'phone',
      'website',
      'assignedTo',
      'lastActivity',
      'createdAt',
    ];
    const orderedColumns = [];
    const processedKeys = new Set();

    const nameColumn = columns.find((col) => col.key === 'name');
    if (nameColumn) {
      orderedColumns.push({ ...nameColumn, locked: true });
      processedKeys.add('name');
    }

    organizationsSpecificOrder.forEach((key) => {
      if (!processedKeys.has(key)) {
        const col = columns.find((c) => c.key === key);
        if (col) {
          orderedColumns.push(col);
          processedKeys.add(key);
        }
      }
    });

    columns.forEach((col) => {
      if (!processedKeys.has(col.key)) {
        orderedColumns.push(col);
      }
    });

    return orderedColumns;
  }

  // Default behavior: move 'name' to the top if not explicitly handled above
  const nameFieldIndex = columns.findIndex(col => col.key?.toLowerCase() === 'name');
  if (nameFieldIndex > 0) {
    const nameField = columns[nameFieldIndex];
    const reordered = [...columns];
    reordered.splice(nameFieldIndex, 1);
    reordered.unshift(nameField);
    return reordered;
  }

  return columns;
};

// Default column builders are now in the module list registry

function mapPropsColumnsToVisible(cols) {
  return normalizeColumnOrder(
    cols.map((col) => ({
      key: col.key,
      label: col.label || col.key,
      visible: col.visible !== false,
      sortable: col.sortable !== false,
      dataType: col.dataType || 'Text',
      showInTable: col.showInTable !== false,
      locked: Boolean(col.locked) || col.key === 'name',
    })),
  );
}

function seedVisibleColumnsFromProps() {
  if (!Array.isArray(props.columns) || props.columns.length === 0) return;
  visibleColumns.value = mapPropsColumnsToVisible(props.columns);
}

// Seed synchronously so the first data fetch does not patch against an empty column set.
seedVisibleColumnsFromProps();

let isInitializingColumns = false;

// Initialize visible columns from props.columns, saved settings, or backend configuration
const initializeColumns = async () => {
  if (!Array.isArray(props.columns) || props.columns.length === 0) {
    visibleColumns.value = [];
    columnsInitialized.value = false;
    return;
  }

  seedVisibleColumnsFromProps();
  isInitializingColumns = true;

  try {
  const savedSettings = loadSavedColumnSettings();
  
  if (savedSettings && savedSettings.length > 0) {
    // Use saved settings, but also fetch backend config to include all fields
    const moduleConfig = await fetchFieldConfiguration();
    const backendFields = moduleConfig?.fields || [];
    const { getModuleListConfig } = await import('@/platform/modules/moduleListRegistry').catch(() => ({ getModuleListConfig: () => null }));
    const moduleListConfig = getModuleListConfig(props.moduleKey);
    const lockedColumnKey = moduleListConfig?.defaultColumns?.lockedColumn ?? 'name';

    // Create maps for quick lookup
    const savedMap = new Map(savedSettings.map(s => [s.key, s]));
    const backendFieldsMap = new Map(backendFields.map(f => [f.key, f]));
    const propsColumnsMap = new Map(props.columns.map(c => [c.key, c]));

    if (moduleListConfig?.defaultColumns?.defaultVisibleColumns) {
      ensureDefaultColumnsInMap(
        props.moduleKey,
        moduleListConfig.defaultColumns.defaultVisibleColumns,
        propsColumnsMap
      );
      moduleListConfig.defaultColumns.defaultVisibleColumns.forEach((key) => {
        if (!backendFieldsMap.has(key) && propsColumnsMap.has(key)) {
          backendFieldsMap.set(key, { key, label: propsColumnsMap.get(key)?.label || key });
        }
      });
    }
    
    const orderedColumns = [];
    const processedKeys = new Set();
    
    // First, add columns from saved settings in saved order
    savedSettings.forEach(saved => {
      const originalCol = propsColumnsMap.get(saved.key);
      const backendField = backendFieldsMap.get(saved.key);
      
      if (originalCol || backendField) {
        orderedColumns.push({
          key: saved.key,
          label: originalCol?.label || saved.label || backendField?.label || saved.key,
          visible: saved.visible !== undefined ? saved.visible : false,
          sortable: originalCol?.sortable !== false,
          dataType: saved.dataType || originalCol?.dataType || backendField?.dataType || 'Text',
          showInTable: saved.showInTable !== undefined ? saved.showInTable : (saved.visible !== false),
          locked: Boolean(originalCol?.locked) || saved.key === lockedColumnKey
        });
        processedKeys.add(saved.key);
      }
    });
    
    // Then add backend fields that aren't in saved settings (these are hidden by default)
    backendFields.forEach(field => {
      if (field.key && !processedKeys.has(field.key)) {
        const propsCol = propsColumnsMap.get(field.key);
        orderedColumns.push({
          key: field.key,
          label: getFieldDisplayLabel(field, props.moduleKey) || propsCol?.label || field.key,
          visible: false, // Not in saved settings, so hidden
          sortable: propsCol?.sortable !== false,
          dataType: field.dataType || propsCol?.dataType || 'Text',
          showInTable: field.visibility?.list !== false,
          locked: Boolean(propsCol?.locked) || field.key === lockedColumnKey
        });
        processedKeys.add(field.key);
      }
    });
    
    // Finally, add any columns from props that aren't in backend or saved settings
    props.columns.forEach(col => {
      if (!processedKeys.has(col.key)) {
        orderedColumns.push({
          key: col.key,
          label: col.label || col.key,
          visible: col.visible !== false,
          sortable: col.sortable !== false,
          dataType: col.dataType || 'Text',
          showInTable: col.showInTable !== false,
          locked: Boolean(col.locked) || col.key === lockedColumnKey
        });
      }
    });
    
    visibleColumns.value = normalizeColumnOrder(orderedColumns);

    if (!visibleColumns.value.some((col) => col.visible)) {
      const recovered = await applyRegistryDefaultVisibleColumns();
      if (!recovered && visibleColumns.value.length > 0) {
        const lockedKey = moduleListConfig?.defaultColumns?.lockedColumn;
        visibleColumns.value = visibleColumns.value.map((col) => ({
          ...col,
          visible: col.key === lockedKey || col.visible
        }));
        if (!visibleColumns.value.some((col) => col.visible)) {
          visibleColumns.value[0].visible = true;
        }
        saveColumnSettings();
      }
    }
  } else {
    // No saved settings - fetch backend configuration and/or use props.columns
    const moduleConfig = await fetchFieldConfiguration();
    const backendFields = moduleConfig?.fields || [];

    const allAvailableColumnsMap = new Map();
    backendFields.forEach(field => allAvailableColumnsMap.set(field.key, {
      key: field.key,
      label: getFieldDisplayLabel(field, props.moduleKey) || field.key,
      dataType: field.dataType,
      sortable: true, // Assume sortable by default from backend
      showInTable: field.visibility?.list !== false,
      // ... other properties you want to preserve from backend
    }));
    props.columns.forEach(col => {
      if (!allAvailableColumnsMap.has(col.key)) {
        allAvailableColumnsMap.set(col.key, {
          key: col.key,
          label: col.label || col.key,
          dataType: col.dataType,
          sortable: col.sortable !== false,
          showInTable: col.showInTable !== false,
          // ... other properties you want to preserve from props
        });
      }
    });

    // Cases: remove nested/internal keys from the available column pool (prevents leaking
    // e.g. assignmentControl.lockReason into the table when backend exposes it as a field key).
    if (props.moduleKey === 'cases') {
      for (const key of Array.from(allAvailableColumnsMap.keys())) {
        const k = String(key || '');
        if (!k) continue;
        if (k.includes('.')) {
          allAvailableColumnsMap.delete(key);
        }
      }
    }
    // Check if module has registry configuration for default columns
    const { getModuleListConfig, buildDefaultColumns } = await import('@/platform/modules/moduleListRegistry').catch(() => ({ getModuleListConfig: () => null, buildDefaultColumns: () => [] }));
    const moduleListConfig = getModuleListConfig(props.moduleKey);
    if (moduleListConfig?.defaultColumns) {
      ensureDefaultColumnsInMap(props.moduleKey, moduleListConfig.defaultColumns.defaultVisibleColumns, allAvailableColumnsMap);
    }
    const allAvailableColumns = Array.from(allAvailableColumnsMap.values());

    if (moduleListConfig?.defaultColumns) {
      // Use registry defaults (Title, Organization, Amount, etc. in same order for all new instances)
      const defaultColumns = buildDefaultColumns(allAvailableColumns, moduleListConfig.defaultColumns);
      visibleColumns.value = normalizeColumnOrder(defaultColumns);
      saveColumnSettings();
    } else if (moduleConfig && Array.isArray(moduleConfig.fields) && moduleConfig.fields.length > 0) {
      // Existing logic for other modules with backend config
      const fieldVisibilityMap = new Map();
      moduleConfig.fields.forEach(field => {
        if (field.key) {
          const isVisible = field.visibility?.list !== false; // Default to true if not set
          fieldVisibilityMap.set(field.key, isVisible);
        }
      });

      const initializedColumns = allAvailableColumns.map(col => ({
        key: col.key,
        label: col.label || col.key,
        visible: fieldVisibilityMap.get(col.key) || false, // Use backend visibility or default to hidden
        sortable: col.sortable !== false,
        dataType: col.dataType || 'Text',
        showInTable: (fieldVisibilityMap.get(col.key) || false),
        locked: Boolean(col.locked) || col.key === 'name', // Default lock 'name' for non-people modules too
      }));
      visibleColumns.value = normalizeColumnOrder(initializedColumns);
      saveColumnSettings();
    } else {
      // Fallback to props with visibility.list check (no backend config and not people module)
      const mappedColumns = props.columns.map(col => ({
        key: col.key,
        label: col.label || col.key,
        visible: col.visible !== false,
        sortable: col.sortable !== false,
        dataType: col.dataType || 'Text',
        showInTable: col.showInTable !== false,
        locked: Boolean(col.locked) || col.key === 'name', // Default lock 'name'
      }));
      visibleColumns.value = normalizeColumnOrder(mappedColumns);
      saveColumnSettings();
    }
  }

  if (!visibleColumns.value.some((col) => col.visible)) {
    await applyRegistryDefaultVisibleColumns();
  }
  } finally {
    columnsInitialized.value = true;
    isInitializingColumns = false;
  }
};

// Watch for column changes from props (new columns added)
watch(
  () => (Array.isArray(props.columns) ? props.columns.map((c) => c.key).join('|') : ''),
  async () => {
  // Only update if we don't have saved settings, or if new columns are added
  const savedSettings = loadSavedColumnSettings();
  if (!savedSettings || savedSettings.length === 0) {
    await initializeColumns();
  } else {
    // Check if there are new columns
    const currentKeys = new Set(visibleColumns.value.map(c => c.key));
    const newColumns = props.columns.filter(c => !currentKeys.has(c.key));
    if (newColumns.length > 0) {
      // Add new columns to the end
      newColumns.forEach(col => {
        const isVisible = col.visible !== false;
        
        // Check registry for default column visibility
        let shouldBeVisible = isVisible;
        let shouldBeLocked = false;
        
        try {
          const moduleListRegistry = require('@/platform/modules/moduleListRegistry');
          const moduleConfig = moduleListRegistry.getModuleListConfig(props.moduleKey);
          
          if (moduleConfig?.defaultColumns) {
            const defaultVisible = moduleConfig.defaultColumns.defaultVisibleColumns || [];
            const lockedColumn = moduleConfig.defaultColumns.lockedColumn;
            
            // Check if column should be visible by default
            if (defaultVisible.length > 0) {
              shouldBeVisible = defaultVisible.includes(col.key);
            }
            
            // Check if column should be locked
            if (lockedColumn && col.key === lockedColumn) {
              shouldBeLocked = true;
            }
          }
        } catch (error) {
          // Registry not available, use existing logic
        }
        
        if (isFieldExcludedFromListCustomize(props.moduleKey, col.key)) {
          return;
        }
        
        visibleColumns.value.push({
          key: col.key,
          label: col.label || col.key,
          visible: shouldBeVisible,
          sortable: col.sortable !== false,
          dataType: col.dataType || 'Text',
          showInTable: shouldBeVisible,
          locked: shouldBeLocked
        });
      });
      // Normalize order after adding new columns
      visibleColumns.value = normalizeColumnOrder(visibleColumns.value);
      saveColumnSettings();
    }
  }
  },
);

// Watch visibleColumns and save whenever they change (debounced to avoid excessive saves)
let saveTimeout = null;
watch(visibleColumns, () => {
  if (isInitializingColumns) return;
  // Debounce saves to avoid excessive localStorage writes during drag operations
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveColumnSettings();
  }, 300);
}, { deep: true });

function findOrCreateBoostColumn(key) {
  let col = visibleColumns.value.find((c) => c.key === key);
  if (col) return col;
  const fromProps = props.columns.find((c) => c.key === key);
  const label = getSyntheticColumnLabel('events', key);
  const base = fromProps
    ? { ...fromProps }
    : { key, label, dataType: 'Text', sortable: false };
  col = {
    ...base,
    key,
    label: base.label || label,
    visible: false,
    showInTable: false,
    sortable: base.sortable !== false
  };
  visibleColumns.value.push(col);
  return col;
}

function boostColumnStateSignature(cols) {
  if (!Array.isArray(cols)) return '';
  return cols
    .map(
      (c) =>
        `${c.key}:${c.visible ? 1 : 0}:${c.showInTable ? 1 : 0}:${c.locked ? 1 : 0}`
    )
    .join('|');
}

function applyBoostVisibleColumnKeys(keys = []) {
  const boostSet = new Set(Array.isArray(keys) ? keys : []);
  // Non-events lists use boost only when empty; running normalizeColumnOrder on every
  // visibleColumns churn always returns a fresh array for `people`, which retriggered
  // the boost watcher and caused "Maximum recursive updates exceeded".
  if (boostSet.size === 0 && props.moduleKey !== 'events') {
    return;
  }
  boostSet.forEach((key) => {
    const col = findOrCreateBoostColumn(key);
    col.visible = true;
    col.showInTable = true;
  });
  if (props.moduleKey === 'events') {
    EVENTS_APPOINTMENT_BOOST_KEYS.forEach((key) => {
      if (boostSet.has(key)) return;
      const col = visibleColumns.value.find((c) => c.key === key);
      if (col) {
        col.visible = false;
        col.showInTable = false;
      }
    });
  }
  const next = normalizeColumnOrder(visibleColumns.value);
  if (boostColumnStateSignature(next) !== boostColumnStateSignature(visibleColumns.value)) {
    visibleColumns.value = next;
  }
  // If only the array reference changed (e.g. people module), keep the current ref to avoid watcher churn.
}

watch(
  [() => props.boostVisibleColumnKeys, () => visibleColumns.value.length],
  ([keys]) => {
    if (visibleColumns.value.length === 0) return;
    applyBoostVisibleColumnKeys(keys);
  },
  { deep: true, immediate: true }
);

/** Stats cards show scope-level aggregates; list filters do not change card values. */
const statsSource = computed(() => props.statistics ?? {});

// Computed stats for HeadlessUI template
const computedStats = computed(() => {
  if (!props.statsConfig || props.statsConfig.length === 0) return [];
  
  return props.statsConfig.map(config => {
    const currentValue = statsSource.value[config.key] || 0;
    const previousValue = config.previousKey 
      ? (statsSource.value[config.previousKey] || 0)
      : Math.max(0, currentValue - Math.floor(currentValue * (config.changePercent || 0.1)));
    
    // Calculate change percentage
    const change = previousValue > 0 
      ? Math.round(((currentValue - previousValue) / previousValue) * 100) 
      : 0;
    
    // Format the stat value
    let formattedStat = currentValue;
    if (config.formatter === 'currency') {
      const orgCurrencyCode = resolveOrgCurrencyCode(authStore.organization);
      const currencyCode = String(config.currencyCode || config.currency || orgCurrencyCode).toUpperCase();
      formattedStat = formatCurrencyValue(currentValue, {
        currencyCode,
        orgCurrency: authStore.organization,
      }) || '—';
    } else if (config.formatter === 'number') {
      formattedStat = formatNumber(currentValue);
    } else if (config.formatter === 'percentage') {
      formattedStat = `${currentValue}%`;
    } else if (typeof config.formatter === 'function') {
      formattedStat = config.formatter(currentValue);
    } else {
      formattedStat = formatNumber(currentValue);
    }

    // Format previous stat
    let formattedPrevious = previousValue;
    if (config.formatter === 'currency') {
      const orgCurrencyCode = resolveOrgCurrencyCode(authStore.organization);
      const currencyCode = String(config.currencyCode || config.currency || orgCurrencyCode).toUpperCase();
      formattedPrevious = formatCurrencyValue(previousValue, {
        currencyCode,
        orgCurrency: authStore.organization,
      }) || '—';
    } else if (config.formatter === 'number') {
      formattedPrevious = formatNumber(previousValue);
    } else if (config.formatter === 'percentage') {
      formattedPrevious = `${previousValue}%`;
    } else if (typeof config.formatter === 'function') {
      formattedPrevious = config.formatter(previousValue);
    } else {
      formattedPrevious = formatNumber(previousValue);
    }
    
    return {
      key: config.key, // Include key for stat-click handler
      name: config.name,
      stat: formattedStat,
      previousStat: formattedPrevious,
      change: `${Math.abs(change)}%`,
      changeType: change >= 0 ? 'increase' : 'decrease'
    };
  });
});



const dataLength = computed(() => (Array.isArray(props.data) ? props.data.length : 0));

const initialRender = ref(true);

const tableLoading = computed(() => {
  if (initialRender.value && !Array.isArray(props.data)) {
    return true;
  }
  // Background refetch: keep showing cached rows (TableView does the same).
  if (props.loading && dataLength.value === 0) {
    return true;
  }
  return false;
});

// Computed columns based on visible columns (preserve locked for title column width in TableView)
function findPropsColumnDefinition(key) {
  const normalized = String(key || '').trim();
  if (!normalized) return null;
  const direct = props.columns.find((c) => c.key === normalized);
  if (direct) return direct;
  if (normalized === 'folderName') {
    return props.columns.find((c) => c.key === 'folderId') || null;
  }
  return null;
}

function mergeVisibleColumnWithProps(visibleCol) {
  const originalCol = findPropsColumnDefinition(visibleCol.key);
  if (!originalCol) return { ...visibleCol };
  const canonicalKey = originalCol.key;
  const visibleLabel = String(visibleCol.label || '');
  const propsLabel = String(originalCol.label || '');
  const label =
    !visibleLabel || visibleLabel.startsWith('[missing:')
      ? propsLabel || visibleLabel || canonicalKey
      : visibleLabel;
  return {
    ...visibleCol,
    ...originalCol,
    key: canonicalKey,
    label,
    locked: visibleCol.locked ?? originalCol.locked,
  };
}

const computedColumns = computed(() => {
  const mapped = visibleColumns.value
    .filter(col => col.visible)
    .map((col) => mergeVisibleColumnWithProps(col));
  if (mapped.length > 0) return mapped;
  if (Array.isArray(props.columns) && props.columns.length > 0) {
    return props.columns.map((c) => ({ ...c }));
  }
  return [];
});

// Dynamic positioning based on sidebar state (reads localStorage like TabBar)
const recomputeTrigger = ref(0);

const headerLeft = computed(() => {
  // Force dependency on recomputeTrigger
  const _ = recomputeTrigger.value;
  
  // On mobile/tablet (< 1024px), always at left: 0 (like TabBar)
  if (windowWidth.value < 1024) {
    return '0px';
  }
  
  // On desktop (≥ 1024px), align with sidebar chrome (rail ± docked drawer)
  return 'var(--arivu-sidebar-chrome-width, calc(3.5rem + 1rem))';
});

const columnFilterSources = computed(() =>
  computedColumns.value.map((col) => ({
    key: col.key,
    label: col.label,
    dataType: col.dataType,
    filterType: col.filterType,
    options: col.options,
  }))
);

const filterFieldSources = computed(() => {
  const fields = Array.isArray(props.filterFields) ? props.filterFields : [];
  if (fields.length > 0) {
    return fields.map((field) => ({
      key: field.key,
      label: field.label,
      dataType: field.dataType,
      filterType: field.filterType,
      options: field.options,
    }));
  }
  return columnFilterSources.value;
});

const {
  featureEnabled: columnFiltersFeatureEnabled,
  effectiveFilterConfig,
  filterConfigByKey,
  builderFilterConfigByKey,
  showInlineColumnFilters,
  popoverFilterConfig,
  showDesktopFiltersPopover,
  showLegacyToolbarFilters,
  showFilterBuilder,
} = useListColumnFilters({
  columns: columnFilterSources,
  filterFields: filterFieldSources,
  viewMode: computed(() => props.viewMode),
  isDesktop: isLargeDesktop,
});

const resolvedColumnHeaderFilters = computed(
  () => listSessionReady.value && props.columnHeaderFilters !== false && showInlineColumnFilters.value,
);
const resolvedShowFilterBuilder = computed(
  () => props.showFilters && showFilterBuilder.value,
);
const resolvedShowLegacyToolbarFilters = computed(
  () => props.showFilters && showLegacyToolbarFilters.value,
);
const resolvedShowDesktopFiltersPopover = computed(
  () => props.columnHeaderFilters !== false && props.showFilters && showDesktopFiltersPopover.value,
);
const resolvedToolbarFilterConfig = computed(
  () => (props.showFilters ? effectiveFilterConfig.value : []),
);

const { handleFilterOpened: loadFilterFieldOptions, enrichFilterMap, seedOptionsFromMetadata } = useFilterFieldOptions(
  computed(() => props.moduleKey),
  computed(() => String(authStore.user?._id || ''))
);

const enrichedColumnFilterConfigByKey = computed(() => enrichFilterMap(filterConfigByKey.value));
const enrichedBuilderFilterConfigByKey = computed(() => enrichFilterMap(builderFilterConfigByKey.value));

const builderFilterConfigList = computed(() =>
  Object.values(enrichedBuilderFilterConfigByKey.value)
);

const filterDebounceTimers = {};
const DEBOUNCED_FILTER_TYPES = new Set(['text', 'number']);
const COLUMN_FILTER_DEBOUNCE_MS = 500;
const mobileFilterBuilderPanelRef = ref(null);
const desktopFilterBuilderPanelRef = ref(null);
const filterRuleMeta = reactive({});
const filterBuilderQuery = ref(createDefaultRootGroup());
/** Matches last payload from emitCompiledFilters to detect parent echo vs external filter changes. */
let lastEmittedFiltersSignature = null;

const builderFilterByKey = computed(() => enrichedBuilderFilterConfigByKey.value);

const filterOperatorsMap = computed(() => {
  const map = {};
  Object.entries(filterRuleMeta).forEach(([key, meta]) => {
    if (meta?.operator) map[key] = meta.operator;
  });
  return map;
});

const mergedFilterByKey = computed(() => ({
  ...enrichedColumnFilterConfigByKey.value,
  ...builderFilterByKey.value,
}));

watch(
  filterFieldSources,
  (fields) => {
    if (!props.moduleKey || !Array.isArray(fields) || fields.length === 0) return;
    seedOptionsFromMetadata({
      [props.moduleKey]: {
        fields: fields.map((field) => ({
          key: field.key,
          options: field.options,
        })),
      },
    });
  },
  { immediate: true, deep: true }
);

function buildCompiledListFilters() {
  const filterByKey = mergedFilterByKey.value;
  const operators = filterOperatorsMap.value;
  const { flat, filterQuery } = compileFilterQueryAst(
    filterBuilderQuery.value,
    filters,
    operators,
    filterByKey
  );

  const astFlatKeys = new Set(Object.keys(flat));
  const supplemental = {};

  for (const [key, value] of Object.entries(filters)) {
    if (key === 'filterQuery' || astFlatKeys.has(key)) continue;
    const operator = operators[key] ?? 'is';
    if (!isFilterRuleActive(value, operator)) continue;
    const filter = filterByKey[key] || inferFallbackFilterConfig(key);
    if (!filter) continue;
    supplemental[key] = compileOperatorValueForApi(filter, value, operator);
  }

  const flatAll = { ...flat, ...supplemental };
  const apiPayload = filterQuery
    ? { filterQuery: JSON.stringify(filterQuery), ...supplemental }
    : flatAll;

  return { flat, flatAll, supplemental, filterQuery, apiPayload };
}

const activeFilterRulesCount = computed(() =>
  countActiveFilterRules(filters, filterOperatorsMap.value, {
    allowedKeys: Object.keys(mergedFilterByKey.value),
  })
);

const filterButtonLabel = computed(() => {
  if (activeFilterRulesCount.value > 0) {
    return t('common.listFiltersCount', { count: activeFilterRulesCount.value });
  }
  return t('common.listFilters');
});

// Filters
const filters = reactive({});
const STORAGE_PREFIX = 'arivu-listview';
const filterStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-filters`);
const searchStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-search`);
const sortStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-sort`);
const columnsStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-columns`);
const kanbanOptionsStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-kanban-options`);
const kanbanFieldsStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-kanban-fields`);

const resolvedSorts = computed(() =>
  normalizeSortSpecs(
    Array.isArray(props.sorts) && props.sorts.length > 0
      ? props.sorts
      : props.sortField
        ? [{ field: props.sortField, order: props.sortOrder }]
        : []
  )
);

const searchTerm = computed(() => searchQuery.value.trim());

const activeFilterCount = computed(() => {
  const internalFilterCount = countActiveFilterRules(filters);
  const externalFilterCount = props.externalFilters
    ? Object.values(props.externalFilters).filter((value) => isFilterValueActive(value)).length
    : 0;
  return internalFilterCount + externalFilterCount;
});

const hasFiltersApplied = computed(() => activeFilterCount.value > 0);

// Check if any filters are active (including search, internal filters, and external filters)
const hasActiveFilters = computed(() => {
  const hasSearch = searchTerm.value !== '';
  const hasInternalFilters = countActiveFilterRules(filters, filterOperatorsMap.value) > 0;
  const hasExternalFilters = props.externalFilters
    ? (Boolean(props.externalFilters.filterQuery)
      || Object.entries(props.externalFilters)
        .filter(([key]) => key !== 'filterQuery')
        .some(([, value]) => isFilterValueActive(value)))
    : false;
  return hasSearch || hasInternalFilters || hasExternalFilters;
});

/** For numbered selection gutter: continuous 1…n when infinite scroll; paged offset otherwise */
const effectiveRowNumberOffset = computed(() => {
  if (props.selectionColumnVariant !== 'numbered-hover') return 0;
  if (props.infiniteScroll) return 0;
  const p = props.pagination;
  const cur = Number(p?.currentPage);
  const lim = Number(p?.limit);
  if (!Number.isFinite(cur) || !Number.isFinite(lim) || cur < 1 || lim < 1) return 0;
  return (cur - 1) * lim;
});
/** Stats strip shimmer while list data is loading */
const statsBarSkeleton = computed(
  () =>
    Boolean(props.statsConfig?.length) &&
    props.loading &&
    dataLength.value === 0
);
const showEmptyState = computed(() => !tableLoading.value && dataLength.value === 0);
onMounted(() => {
  requestAnimationFrame(() => {
    // Set initialRender to false once we have data (even if empty)
    if (Array.isArray(props.data)) {
      initialRender.value = false;
    }
  });
});
watch(() => props.data, (newVal) => {
  // Set initialRender to false as soon as we receive data (even if empty array)
  if (Array.isArray(newVal)) {
    initialRender.value = false;
  }
}, { immediate: true });

const resourceName = computed(() => (typeof props.title === 'string' ? props.title.toLowerCase() : 'records'));

/** User-picked default, or the system default view (e.g. All Quotes) when none is set. */
const effectiveDefaultViewId = computed(() => {
  if (props.defaultViewId) return props.defaultViewId;
  const views = props.savedViews;
  if (!views?.length) return null;
  const flagged = views.find((v) => v.isDefault);
  if (flagged) return flagged.id;
  return views[0]?.id ?? null;
});

function isEffectiveDefaultView(viewId) {
  return viewId === effectiveDefaultViewId.value;
}

const COMMON_SYSTEM_VIEW_IDS = [
  'all',
  'assigned-to-me',
  'my-people',
  'my-organizations',
  'my-tasks',
  'unassigned',
  'active',
  'trial',
];

function isSystemViewId(viewId) {
  if (!viewId) return false;
  if (COMMON_SYSTEM_VIEW_IDS.includes(viewId)) return true;
  const view = props.savedViews?.find((v) => v.id === viewId);
  return view?.isSystem === true;
}

const isActiveSystemView = computed(() => isSystemViewId(props.activeSavedViewId));

// Active People view title - source of truth for page title
// When a saved view is active, title reflects the view name
// When manual filters/search are applied, title is "Custom"
// When no view is active and no filters, title shows default view name
const activePeopleViewTitle = computed(() => {
  // Only show view name if saved views are available
  if (!props.savedViews || props.savedViews.length === 0) {
    return props.title;
  }

  // If an active view is set, return the view's label (Custom when a system view was modified)
  if (props.activeSavedViewId) {
    const activeView = props.savedViews.find(view => view.id === props.activeSavedViewId);
    if (activeView) {
      if (isActiveSystemView.value && isActiveViewModified.value) {
        return t('common.listViewCustom');
      }
      return activeView.label;
    }
  }

  // Check if manual filters or search are applied
  const hasActiveFilters = hasFiltersApplied.value;
  const hasActiveSearch = searchTerm.value !== '';
  
  if (hasActiveFilters || hasActiveSearch) {
    return t('common.listViewCustom');
  }

  const moduleLabel = props.title || props.moduleKey.charAt(0).toUpperCase() + props.moduleKey.slice(1);
  return resolveListViewLabel(
    props.moduleKey,
    'all',
    `All ${moduleLabel}`,
    t,
    te
  );
});

// STEP 1: Normalize state - PURE FUNCTION
// Extracts canonical view state (filters, sort, columns) for comparison
// Explicitly EXCLUDES: pagination, selection, scroll, loading
function normalizePeopleViewState(state) {
  const normalizedFilters = {};
  Object.keys(state.filters || {}).forEach((key) => {
    const value = state.filters[key];
    if (value !== undefined && value !== '') {
      normalizedFilters[key] = value === null ? null : String(value);
    }
  });

  const sortedFilterKeys = Object.keys(normalizedFilters).sort();
  const normalizedFiltersObj = {};
  sortedFilterKeys.forEach((key) => {
    normalizedFiltersObj[key] = normalizedFilters[key];
  });

  const sortSpecs = normalizeSortSpecs(
    state.sorts?.length
      ? state.sorts
      : { field: state.sortField, order: state.sortOrder },
    { fallback: { field: 'createdAt', order: 'desc' } }
  );
  const primary = primarySort(sortSpecs);
  const normalizedSort = {
    field: primary.field,
    order: primary.order,
    sorts: sortSpecs,
  };

  const normalizedColumns = (state.columns || [])
    .filter((col) => col.visible !== false)
    .map((col) => ({
      key: String(col.key || ''),
      visible: col.visible !== false,
      order: typeof col.order === 'number' ? col.order : 999,
    }))
    .sort((a, b) => a.order - b.order)
    .map((col) => col.key);

  return {
    filters: normalizedFiltersObj,
    sort: normalizedSort,
    columns: normalizedColumns,
  };
}

function canonicalizeFilterQueryString(value) {
  if (value === undefined || value === null || value === '') return '';
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return JSON.stringify(parsed);
  } catch {
    return String(value);
  }
}

function viewStateMatches(view, normalizedState, currentUserId, currentSearch = '') {
  if (!view) return false;

  const normalizeFilterValue = (key, value, userId) => {
    if (key === 'filterQuery') {
      return canonicalizeFilterQueryString(value);
    }
    if (key === 'assignedTo') {
      if (value === 'me' && userId) return userId;
      if (value === 'unassigned') return null;
      if (value === userId && userId) return userId;
      return value === null ? null : String(value);
    }
    return value === null ? null : String(value);
  };

  const filtersMatch = (currentFilters, viewFilters, userId) => {
    const currentKeys = Object.keys(currentFilters).sort();
    const viewKeys = Object.keys(viewFilters || {}).filter((k) => {
      const v = viewFilters[k];
      return v !== undefined && v !== '';
    }).sort();

    if (currentKeys.length !== viewKeys.length) return false;

    for (let i = 0; i < currentKeys.length; i += 1) {
      if (currentKeys[i] !== viewKeys[i]) return false;

      const key = currentKeys[i];
      const currentValue = normalizeFilterValue(key, currentFilters[key], userId);
      const viewValue = normalizeFilterValue(key, viewFilters[key], userId);
      if (currentValue !== viewValue) return false;
    }

    return true;
  };

  const hasExplicitConfig = Boolean(view.config || view.id?.startsWith('custom-'));
  const viewConfig = view.config || {
    filters: view.filters || {},
    sort: view.sort || { field: 'createdAt', order: 'desc' },
    columns: view.columns || [],
    search: view.search,
  };
  const viewFilters = {};
  if (viewConfig.filterQuery) {
    viewFilters.filterQuery = typeof viewConfig.filterQuery === 'string'
      ? viewConfig.filterQuery
      : JSON.stringify(viewConfig.filterQuery);
  }
  const savedFilters = viewConfig.filters || {};
  for (const [key, value] of Object.entries(savedFilters)) {
    if (key === 'filterQuery' || value === undefined || value === '') continue;
    viewFilters[key] = value;
  }
  if (!viewConfig.filterQuery && Object.keys(viewFilters).length === 0) {
    Object.assign(viewFilters, savedFilters);
  }
  const normalizedViewFilters = normalizePeopleViewState({
    filters: viewFilters,
    sortField: 'createdAt',
    sortOrder: 'desc',
    columns: [],
  }).filters;

  if (!filtersMatch(normalizedState.filters, normalizedViewFilters, currentUserId)) {
    return false;
  }

  if (hasExplicitConfig) {
    const normalizedViewState = normalizePeopleViewState({
      filters: viewFilters,
      sortField: viewConfig.sort?.field || 'createdAt',
      sortOrder: viewConfig.sort?.order || 'desc',
      sorts: viewConfig.sort?.sorts,
      columns: viewConfig.columns || [],
    });

    if (JSON.stringify(normalizedState.sort.sorts) !== JSON.stringify(normalizedViewState.sort.sorts)) {
      return false;
    }

    if (viewConfig.columns?.length) {
      if (normalizedState.columns.length !== normalizedViewState.columns.length) {
        return false;
      }

      const columnsMatch = normalizedState.columns.every(
        (key, index) => key === normalizedViewState.columns[index]
      );
      if (!columnsMatch) return false;
    }
  }

  const savedSearch = String(viewConfig.search ?? '').trim();
  if (savedSearch !== String(currentSearch ?? '').trim()) return false;

  return true;
}

function doesStateMatchAnySavedView(normalizedState, savedViews, currentUserId, currentSearch = '') {
  if (!savedViews || savedViews.length === 0) return false;

  return savedViews.some((view) => viewStateMatches(
    view,
    normalizedState,
    currentUserId,
    currentSearch
  ));
}

const normalizedCurrentViewState = computed(() => {
  const { apiPayload } = buildCompiledListFilters();

  return normalizePeopleViewState({
    filters: apiPayload,
    sortField: props.sortField,
    sortOrder: props.sortOrder,
    sorts: resolvedSorts.value,
    columns: visibleColumns.value,
  });
});

const activeSavedViewRecord = computed(() => {
  if (!props.activeSavedViewId || !props.savedViews?.length) return null;
  return props.savedViews.find((view) => view.id === props.activeSavedViewId) ?? null;
});

function buildCurrentViewStateSignature() {
  return JSON.stringify({
    state: normalizedCurrentViewState.value,
    search: searchQuery.value.trim(),
  });
}

/** Snapshot of UI state when a custom view was last applied or saved — used for dirty detection. */
const viewCleanBaseline = ref(null);

const isActiveViewHydrating = ref(
  Boolean(props.activeSavedViewId && !isSystemViewId(props.activeSavedViewId))
);

function syncViewCleanBaseline(viewId = props.activeSavedViewId) {
  if (!viewId || isSystemViewId(viewId)) {
    viewCleanBaseline.value = null;
    return;
  }
  viewCleanBaseline.value = {
    viewId,
    signature: buildCurrentViewStateSignature(),
  };
}

function currentStateMatchesActiveSavedView() {
  if (!activeSavedViewRecord.value) return false;
  return viewStateMatches(
    activeSavedViewRecord.value,
    normalizedCurrentViewState.value,
    authStore.user?._id,
    searchQuery.value.trim()
  );
}

const isActiveViewModified = computed(() => {
  if (isActiveViewHydrating.value) return false;
  if (!activeSavedViewRecord.value || isActiveSystemView.value) return false;

  if (currentStateMatchesActiveSavedView()) return false;

  const baseline = viewCleanBaseline.value;
  const currentSignature = buildCurrentViewStateSignature();

  if (baseline?.viewId === props.activeSavedViewId) {
    return baseline.signature !== currentSignature;
  }

  return true;
});

// Current state doesn't match any saved view (orphan / Custom)
const shouldShowSaveCTA = computed(() => {
  if (!props.savedViews?.length) return false;
  return !doesStateMatchAnySavedView(
    normalizedCurrentViewState.value,
    props.savedViews,
    authStore.user?._id,
    searchQuery.value.trim()
  );
});

const canUpdateActiveView = computed(() => (
  isActiveViewModified.value
  && activeSavedViewRecord.value
  && !isActiveSystemView.value
));

const shouldShowSaveAsNew = computed(() => (
  !isActiveSystemView.value
  && isActiveViewModified.value
  && activeSavedViewRecord.value
));

const shouldShowSaveNewOnly = computed(() => {
  if (!props.savedViews?.length) return false;
  if (isActiveSystemView.value) {
    return isActiveViewModified.value || shouldShowSaveCTA.value;
  }
  return shouldShowSaveCTA.value && !isActiveViewModified.value;
});

const showActiveViewModifiedIndicator = computed(() => (
  isActiveViewModified.value && !isActiveSystemView.value
));

const showViewSaveActions = computed(() => (
  shouldShowSaveNewOnly.value
  || (isActiveViewModified.value && Boolean(activeSavedViewRecord.value))
));

const saveViewModalTitle = computed(() => {
  if (saveMode.value === 'rename') return t('common.listRenameViewTitle');
  if (!isActiveSystemView.value && isActiveViewModified.value && activeSavedViewRecord.value) {
    return t('common.listSaveAsNewViewTitle');
  }
  return t('common.listSaveCurrentView');
});

const emptyStateTitle = computed(() => {
  if (hasActiveFilters.value) {
    return t('common.listEmptyNoMatchFilters', { module: resourceName.value });
  }
  return props.emptyTitle || t('common.listEmptyTitle');
});

const emptyStateMessage = computed(() => {
  if (searchTerm.value && hasFiltersApplied.value) {
    return t('common.listEmptyNoMatchSearchAndFilters', { module: resourceName.value });
  }
  if (searchTerm.value) {
    return t('common.listEmptyNoMatchSearch', {
      module: resourceName.value,
      query: searchTerm.value,
    });
  }
  if (hasFiltersApplied.value) {
    return t('common.listEmptyNoMatchFiltersOnly', { module: resourceName.value });
  }
  return props.emptyMessage || t('common.listEmptyMessage');
});

const emptyStateIllustrationSrc = computed(() =>
  getModuleEmptyIllustrationSrc(props.moduleKey, { noMatch: hasActiveFilters.value })
);

const getFilterAllLabel = (filter) => resolveFilterAllLabel(filter, t);

const canClearFilters = computed(() => hasActiveFilters.value);

// Debounced search
let searchTimeout;
const emitSearchToParent = (query) => {
  const term = query ?? '';
  emit('update:searchQuery', term);
  emit('search-submit', term);
};

const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    emitSearchToParent(searchQuery.value);
  }, 500);
};

const clearSearch = () => {
  if (!searchQuery.value) return;
  searchQuery.value = '';
  emitSearchToParent('');
  localStorage.removeItem(searchStorageKey.value);
};

// Get filter label for display
const getFilterLabel = (filter, value) => {
  if (value === undefined || value === null || value === '') return null;
  if (filter.filterType === 'date' && typeof value === 'object') {
    return getDateFilterLabel(parseDateFilterValue(value)) || null;
  }
  const option = filter.options?.find(opt => opt.value === value);
  return option ? (option.label || option.value) : null;
};

// =============================================================================
// SUGGESTED FILTERS (Feature-flagged, opt-in only)
// =============================================================================

/**
 * Get display label for a suggested filter field key.
 * Looks up the label from filterConfig or falls back to formatted field key.
 * 
 * @param fieldKey - The field key from suggested filters
 * @returns Human-readable label for the filter
 */
const getSuggestedFilterLabel = (fieldKey) => {
  const filter = builderFilterByKey.value[fieldKey];
  return resolveListFilterLabel(
    props.moduleKey,
    fieldKey,
    filter?.label || fieldKey,
    t,
    te
  );
};

/**
 * Handle click on a suggested filter chip.
 * Opens the filter configuration UI for the selected field.
 * 
 * IMPORTANT: This does NOT apply the filter automatically.
 * It only opens the filter dropdown so the user can select a value.
 * 
 * @param fieldKey - The field key to configure
 */
const handleSuggestedFilterClick = (fieldKey) => {
  if (!builderFilterByKey.value[fieldKey]) {
    console.warn(`[ListView] Suggested filter "${fieldKey}" not found in column filters`);
    return;
  }
  
  // Focus the filter dropdown to open it
  // The filter dropdowns are rendered with data-filter-key attribute
  // We use nextTick to ensure DOM is ready
  nextTick(() => {
    const filterButton = document.querySelector(`[data-filter-key="${fieldKey}"] button`);
    if (filterButton) {
      filterButton.click();
    }
  });
};

// Handle stat click (works for all modules with statsConfig)
const handleStatClick = (item) => {
  if (props.statsConfig && props.statsConfig.length > 0) {
    emit('stat-click', item);
  }
};

// Get count of active filters for mobile badge
const getActiveFiltersCount = () => countActiveFilterRules(filters, filterOperatorsMap.value, {
  allowedKeys: Object.keys(mergedFilterByKey.value),
});

function syncFilterBuilderFromActiveFilters() {
  filterBuilderQuery.value = syncRootGroupFromActiveFilters(
    filterBuilderQuery.value,
    Object.values(mergedFilterByKey.value),
    filters,
    filterOperatorsMap.value
  );
}

function emitFiltersToParent(explicitClears = null) {
  syncFilterBuilderFromActiveFilters();
  const { apiPayload } = buildCompiledListFilters();
  const payload = explicitClears ? { ...apiPayload, ...explicitClears } : apiPayload;
  lastEmittedFiltersSignature = JSON.stringify(payload);
  emit('update:filters', payload);
}

const emitCompiledFilters = () => {
  emitFiltersToParent();
};

// Handle filter change
const handleFilterChange = (key, value) => {
  if (value !== undefined) {
    filters[key] = value;
  }
  emitCompiledFilters();
};

const trackFilterRuleMeta = (key, source, operator = 'is') => {
  const existing = filterRuleMeta[key];
  filterRuleMeta[key] = {
    id: existing?.id || createRuleId(),
    source,
    operator,
    updatedAt: Date.now(),
  };
};

const handleFilterInput = (key, value, filterType, source = 'column') => {
  const previousValue = filters[key];
  filters[key] = value;
  if (!isFilterValueActive(value)) {
    delete filterRuleMeta[key];
    clearTimeout(filterDebounceTimers[key]);
    if (
      isFilterValueActive(previousValue)
      && enrichedColumnFilterConfigByKey.value[key]
    ) {
      emitFiltersToParent({ [key]: '' });
    } else {
      handleFilterChange(key, value);
    }
    return;
  }
  const filter = mergedFilterByKey.value[key];
  const operator = filterRuleMeta[key]?.operator ?? getDefaultOperatorForFilter(filter);
  trackFilterRuleMeta(key, source, operator);
  if (!columnFiltersFeatureEnabled || !DEBOUNCED_FILTER_TYPES.has(String(filterType || ''))) {
    handleFilterChange(key, value);
    return;
  }
  clearTimeout(filterDebounceTimers[key]);
  filterDebounceTimers[key] = setTimeout(() => {
    emitCompiledFilters();
  }, COLUMN_FILTER_DEBOUNCE_MS);
};

const handleBuilderFilterApply = ({ key, value, operator }) => {
  const filter = builderFilterByKey.value[key];
  const op = operator ?? getDefaultOperatorForFilter(filter);
  trackFilterRuleMeta(key, 'builder', op);
  if (!operatorRequiresValue(op)) {
    filters[key] = '';
    emitCompiledFilters();
    return;
  }
  const active = isFilterRuleActive(value, op);
  filters[key] = active ? value : '';
  if (active) {
    emitCompiledFilters();
  }
};

const handleBuilderClearField = (key) => {
  filters[key] = '';
  delete filterRuleMeta[key];
  emitFiltersToParent({ [key]: '' });
};

const handleFilterOpened = async (key) => {
  const filter = mergedFilterByKey.value[key] ?? enrichedColumnFilterConfigByKey.value[key];
  await loadFilterFieldOptions(key, filter);
  emit('filter-opened', key);
};

const openFilterBuilder = () => {
  nextTick(() => {
    mobileFilterBuilderPanelRef.value?.syncRowsFromFilters?.();
    desktopFilterBuilderPanelRef.value?.syncRowsFromFilters?.();
  });
};

const handleFilterQueryUpdate = (query) => {
  filterBuilderQuery.value = query;
};

const handleColumnFilterChange = ({ key, value, filterType }) => {
  handleFilterInput(key, value, filterType, 'column');
};

const handleActiveFilterChipRemove = (id) => {
  if (id === '__search__') {
    clearSearch();
    return;
  }
  delete filterRuleMeta[id];
  filters[id] = '';
  emitFiltersToParent({ [id]: '' });
};

const clearColumnFilters = () => {
  const cleared = {};
  Object.keys(enrichedColumnFilterConfigByKey.value).forEach((key) => {
    filters[key] = '';
    delete filterRuleMeta[key];
    cleared[key] = '';
  });
  filterBuilderQuery.value = createDefaultRootGroup();
  emitFiltersToParent(cleared);
};

// Update filters (kept for backward compatibility if needed)
const updateFilters = (key, value) => {
  filters[key] = value;
  emit('update:filters', { ...filters });
  emit('fetch');
};

function ensureFilterKeys(configMap) {
  if (!configMap) return;
  Object.keys(configMap).forEach((key) => {
    if (!(key in filters)) {
      filters[key] = '';
    }
  });
}

watch(
  enrichedBuilderFilterConfigByKey,
  (configMap) => ensureFilterKeys(configMap),
  { immediate: true, deep: true }
);

watch(
  enrichedColumnFilterConfigByKey,
  (configMap) => {
    if (!columnFiltersFeatureEnabled || !listSessionReady.value) return;
    ensureFilterKeys(configMap);
  },
  { immediate: true, deep: true }
);

onMounted(async () => {
  let shouldRefetch = false;
  let pendingSortEmit = null;
  let pendingSearchEmit = null;

  try {
  // Initialize columns (async - fetches from backend if needed)
  await initializeColumns();
  
  // Restore drawer state for current tab
  restoreDrawerState();

  // Restore row height
  rowHeight.value = getDefaultRowHeight();

  const activeSavedView = props.activeSavedViewId
    ? props.savedViews?.find((view) => view.id === props.activeSavedViewId)
    : null;

  const shouldApplyActiveSavedView = Boolean(
    activeSavedView
    && (
      activeSavedView.config
      || activeSavedView.id?.startsWith('custom-')
      || isSystemViewId(activeSavedView.id)
    )
  );

  if (shouldApplyActiveSavedView) {
    // applyViewConfig → update:filters already triggers ModuleList fetchData()
    applySavedViewFromRecord(activeSavedView, { preserveSearch: true });
  } else {
    // Restore filters
    const savedFilters = localStorage.getItem(filterStorageKey.value);
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        const savedValues = parsed?.filters ?? parsed;
        const savedOperators = parsed?.operators ?? {};
        let changed = false;
        Object.keys(filters).forEach(key => {
          if (savedValues[key] !== undefined) {
            filters[key] = savedValues[key];
            if (isFilterValueActive(savedValues[key])) {
              changed = true;
            }
          }
        });
        Object.entries(savedOperators).forEach(([key, operator]) => {
          if (operator) {
            trackFilterRuleMeta(key, 'builder', String(operator));
            changed = true;
          }
        });
        if (parsed?.query) {
          filterBuilderQuery.value = parsed.query;
          if (countActiveFilterRules(savedValues, savedOperators)) {
            changed = true;
          }
        }
        if (changed) {
          shouldRefetch = true;
        }
      } catch (error) {
        console.warn('Failed to parse saved filters', error);
      }
    }

    const savedSort = localStorage.getItem(sortStorageKey.value);
    if (savedSort) {
      try {
        const parsed = JSON.parse(savedSort);
        const sorts = parsePersistedSort(parsed);
        if (sorts.length > 0) {
          const primary = primarySort(sorts);
          pendingSortEmit = {
            sortField: primary.field,
            sortOrder: primary.order,
            sorts
          };
          shouldRefetch = true;
        }
      } catch (error) {
        console.warn('Failed to parse saved sort', error);
      }
    }
  }

  // Restore persisted search for all views (including My People / My Organizations)
  const savedSearch = localStorage.getItem(searchStorageKey.value);
  if (savedSearch !== null && savedSearch.trim() !== '') {
    searchQuery.value = savedSearch;
    pendingSearchEmit = savedSearch;
  }

  if (shouldApplyActiveSavedView) {
    await nextTick();
    syncViewCleanBaseline(activeSavedView.id);
    isActiveViewHydrating.value = false;
  } else {
    isActiveViewHydrating.value = false;
  }

  if (!shouldApplyActiveSavedView) {
    if (pendingSortEmit) {
      emit('update:sort', pendingSortEmit);
    }
    if (shouldRefetch) {
      emitCompiledFilters();
    } else if (pendingSearchEmit) {
      emitSearchToParent(pendingSearchEmit);
    } else if (!props.skipMountFetch) {
      emit('fetch');
    }
  } else {
    if (pendingSearchEmit) {
      emitSearchToParent(pendingSearchEmit);
    } else if (!props.skipMountFetch) {
      emit('fetch');
    }
  }
  } finally {
    await nextTick();
    listSessionReady.value = true;
    if (columnFiltersFeatureEnabled) {
      ensureFilterKeys(enrichedColumnFilterConfigByKey.value);
    }
  }
});

watch(
  [
    normalizedCurrentViewState,
    searchQuery,
    () => props.activeSavedViewId,
    () => activeSavedViewRecord.value,
  ],
  () => {
    if (isActiveViewHydrating.value || !activeSavedViewRecord.value || isActiveSystemView.value) {
      return;
    }
    if (currentStateMatchesActiveSavedView()) {
      syncViewCleanBaseline(props.activeSavedViewId);
    }
  },
  { flush: 'post', deep: true }
);

watch(searchQuery, (value) => {
  if (!listSessionReady.value) return;
  try {
    if (value) {
      localStorage.setItem(searchStorageKey.value, value);
    } else {
      localStorage.removeItem(searchStorageKey.value);
    }
  } catch (error) {
    console.warn('[ListView] Failed to persist search session:', error);
  }
});

watch(
  [filters, filterRuleMeta],
  () => {
    if (!listSessionReady.value) return;
    safePersistFilterBuilderSession();
  },
  { deep: true }
);

function hydrateExternalFilterQueryPayload(externalFilters) {
  if (!externalFilters?.filterQuery) return false;

  const hydrated = applyFilterQueryContainsToFlatFilters(
    externalFilters.filterQuery,
    filters,
    ['name', 'title', 'eventName', 'item_name']
  );
  if (!hydrated) return false;

  for (const [key, value] of Object.entries(externalFilters)) {
    if (key === 'filterQuery') continue;
    if (value !== undefined) {
      filters[key] = value;
    }
  }

  for (const [key, value] of Object.entries(filters)) {
    if (key === 'filterQuery') continue;
    if (!isFilterValueActive(value)) continue;
    const filter = mergedFilterByKey.value[key] || inferFallbackFilterConfig(key);
    const operator = filterRuleMeta[key]?.operator
      ?? getDefaultOperatorForFilter(filter);
    trackFilterRuleMeta(key, 'column', operator);
  }

  filterBuilderQuery.value = syncRootGroupFromActiveFilters(
    filterBuilderQuery.value,
    builderFilterConfigList.value,
    filters,
    filterOperatorsMap.value
  );
  return true;
}

// Watch externalFilters prop and sync to internal filters object
watch(
  () => props.externalFilters,
  (newExternalFilters) => {
    if (!newExternalFilters) return;

    const incomingSignature = JSON.stringify(newExternalFilters);
    if (incomingSignature === lastEmittedFiltersSignature) return;

    if (hydrateExternalFilterQueryPayload(newExternalFilters)) {
      lastEmittedFiltersSignature = incomingSignature;
      return;
    }

    let incomingFilters = newExternalFilters;
    if (props.moduleKey === 'events') {
      incomingFilters = expandEventsSpecialViewFilters(
        { ...newExternalFilters },
        props.activeSavedViewId
      );
    }

    if (Object.keys(incomingFilters).length === 0) {
      Object.keys(filters).forEach((key) => {
        delete filters[key];
      });
      Object.keys(filterRuleMeta).forEach((key) => {
        delete filterRuleMeta[key];
      });
      filterBuilderQuery.value = createDefaultRootGroup();
      lastEmittedFiltersSignature = incomingSignature;
      return;
    }

    if (isFilterQueryOnlyPayload(incomingFilters)) {
      const activeView = props.activeSavedViewId
        ? props.savedViews?.find((view) => view.id === props.activeSavedViewId)
        : null;
      if (activeView) {
        applySavedViewFromRecord(activeView, { force: true, preserveSearch: true });
        lastEmittedFiltersSignature = incomingSignature;
        return;
      }

      try {
        const saved = localStorage.getItem(filterStorageKey.value);
        if (saved) {
          const parsed = JSON.parse(saved);
          applyFilterBuilderState({
            filters: parsed?.filters,
            operators: parsed?.operators,
            query: parsed?.query,
          });
          lastEmittedFiltersSignature = incomingSignature;
          return;
        }
      } catch {
        /* use filterQuery payload as-is */
      }
      return;
    }

    Object.keys(filters).forEach((key) => {
      if (key !== 'filterQuery') {
        filters[key] = '';
      }
    });

    if (Object.keys(incomingFilters).length > 0) {
      Object.keys(incomingFilters).forEach((key) => {
        if (key === 'filterQuery') return;
        const value = incomingFilters[key];
        if (value !== undefined) {
          filters[key] = value;
        }
      });
    }

    lastEmittedFiltersSignature = null;
    Object.keys(filterRuleMeta).forEach((key) => {
      delete filterRuleMeta[key];
    });

    filterBuilderQuery.value = syncRootGroupFromActiveFilters(
      createDefaultRootGroup(),
      builderFilterConfigList.value,
      filters,
      filterOperatorsMap.value
    );
  },
  { deep: true, immediate: true }
);

watch(
  () => props.activeSavedViewId,
  (viewId, previousViewId) => {
    if (!viewId || viewId === previousViewId || !props.savedViews?.length) return;
    const view = props.savedViews.find((entry) => entry.id === viewId);
    if (!view) return;
    applySavedViewFromRecord(view, { force: true });
  }
);

// Clear filters
const clearFilters = () => {
  lastAppliedSavedViewSignature.value = '';
  viewCleanBaseline.value = null;
  searchQuery.value = '';
  const cleared = {};
  Object.keys(filters).forEach(key => {
    if (key === 'filterQuery') return;
    filters[key] = '';
    cleared[key] = '';
  });
  Object.keys(filterRuleMeta).forEach((key) => {
    delete filterRuleMeta[key];
  });
  filterBuilderQuery.value = createDefaultRootGroup();
  emitSearchToParent('');
  emitFiltersToParent(cleared);
  localStorage.removeItem(searchStorageKey.value);
  localStorage.removeItem(filterStorageKey.value);
  localStorage.removeItem(sortStorageKey.value);
  nextTick(() => {
    mobileFilterBuilderPanelRef.value?.syncRowsFromFilters?.();
    desktopFilterBuilderPanelRef.value?.syncRowsFromFilters?.();
  });
};

/** Exclude infrastructure fields from Customize View; config-visible system fields remain. */
function isSystemFieldForList(moduleKey, fieldKey) {
  return isFieldExcludedFromListCustomize(moduleKey, fieldKey);
}

// Field management - sync with visibleColumns and backend configuration
const allFields = computed(() => {
  // Start with all fields from backend configuration if available, otherwise use props.columns
  const backendFields = backendModuleConfig.value?.fields || [];
  const propsColumns = Array.isArray(props.columns) ? props.columns : [];
  
  // Create a map of all available fields (from backend + props.columns)
  const allFieldsMap = new Map();
  
  // First, add all fields from backend configuration
  backendFields.forEach(field => {
    if (field.key && !isSystemFieldForList(props.moduleKey, field.key)) {
      // Find corresponding column from props for additional metadata
      const propsCol = propsColumns.find(c => c.key === field.key);
      allFieldsMap.set(field.key, {
        key: field.key,
        label: getFieldDisplayLabel(field, props.moduleKey) || propsCol?.label || field.key,
        visible: false, // Will be set from visibleColumns
        sortable: propsCol?.sortable !== false,
        dataType: field.dataType || propsCol?.dataType || 'Text',
        showInTable: field.visibility?.list !== false
      });
    }
  });
  
  // Then add any fields from props.columns that aren't in backend (skip system fields)
  propsColumns.forEach(col => {
    if (!allFieldsMap.has(col.key) && !isSystemFieldForList(props.moduleKey, col.key)) {
      allFieldsMap.set(col.key, {
        key: col.key,
        label: col.label || col.key,
        visible: false, // Will be set from visibleColumns
        sortable: col.sortable !== false,
        dataType: col.dataType || 'Text',
        showInTable: col.showInTable !== false
      });
    }
  });

  // Registry audit/system fields omitted from the module API (e.g. createdAt, createdBy)
  buildListColumnsFromModuleFields([], props.moduleKey).forEach((col) => {
    if (!col?.key || allFieldsMap.has(col.key) || isSystemFieldForList(props.moduleKey, col.key)) return;
    allFieldsMap.set(col.key, {
      key: col.key,
      label: col.label || col.key,
      visible: false,
      sortable: col.sortable !== false,
      dataType: col.dataType || 'Text',
      showInTable: col.showInTable !== false,
    });
  });
  
  // Include list-visible columns from visibleColumns even when omitted from backend field defs
  visibleColumns.value.forEach((col) => {
    if (!col?.key || allFieldsMap.has(col.key)) return;
    if (isSystemFieldForList(props.moduleKey, col.key)) return;
    allFieldsMap.set(col.key, {
      key: col.key,
      label: col.label || col.key,
      visible: col.visible === true,
      sortable: col.sortable !== false,
      dataType: col.dataType || 'Text',
      showInTable: col.showInTable !== false,
      locked: col.locked === true
    });
  });

  // Now update visibility from visibleColumns (source of truth)
  let fields = Array.from(allFieldsMap.values()).map(field => {
    const visibleCol = visibleColumns.value.find(vc => vc.key === field.key);
    
    // IMPORTANT: Use visibleColumns as source of truth for visibility
    // If field is not in visibleColumns, it defaults to hidden (false)
    const isVisible = visibleCol ? (visibleCol.visible === true) : false;
    
    return {
      ...field,
      visible: isVisible, // This is the source of truth - defaults to false if not in visibleColumns
      showInTable: visibleCol ? (visibleCol.showInTable !== false) : field.showInTable,
      // Include locked property if present
      locked: visibleCol?.locked || false
    };
  });
  
  // Filter by search query
  if (fieldSearchQuery.value.trim()) {
    const query = fieldSearchQuery.value.toLowerCase();
    fields = fields.filter(field => 
      field.label.toLowerCase().includes(query) || 
      field.key.toLowerCase().includes(query)
    );
  }
  
  return fields;
});

const shownFields = computed(() => {
  // Same visibility as the table (visibleColumns is the single source of truth)
  const visibleCols = visibleColumns.value.filter((col) => col.visible === true);
  
  // Get fields from allFields but maintain the order from visibleColumns
  const orderedFields = visibleCols.map(col => {
    const field = allFields.value.find(f => f.key === col.key);
    return field || {
      key: col.key,
      label: col.label || col.key,
      visible: true,
      sortable: col.sortable !== false,
      dataType: col.dataType || 'Text',
      showInTable: col.showInTable !== false,
      locked: col.locked === true
    };
  });
  
  return orderedFields;
});

const hiddenFields = computed(() => {
  return allFields.value.filter(field => !field.visible);
});

// Group fields for People module Customize View
const getGroupLabel = (groupId) => {
  if (!groupId) return null;
  
  if (groupId === 'core') {
    return t('common.listCoreFields');
  } else if (groupId === 'participation-summary') {
    return t('common.listParticipationFields');
  } else if (groupId.startsWith('participation:')) {
    const appKey = groupId.replace('participation:', '');
    const appKeyUpper = appKey.toUpperCase();
    const appLabel = APP_NAME_KEYS[appKeyUpper] && te(APP_NAME_KEYS[appKeyUpper])
      ? t(APP_NAME_KEYS[appKeyUpper])
      : appKey;
    return t('common.listParticipationApp', { app: appLabel });
  } else if (groupId === 'system') {
    return t('common.listSystemFields');
  }
  
  return null;
};

// Group shown fields for People module
const groupedShownFields = computed(() => {
  return shownFields.value;
});

// Group hidden fields for People module
const groupedHiddenFields = computed(() => {
  return hiddenFields.value;
});

// Field icon mapping
const getFieldIcon = (dataType) => {
  const iconMap = {
    'Text': DocumentTextIcon,
    'Number': DocumentTextIcon,
    'Date': CalendarIcon,
    'DateTime': CalendarIcon,
    'Picklist': TagIcon,
    'Multi-Picklist': TagIcon,
    'User': UserIcon,
    'Lookup': LinkIcon,
    'Checkbox': CheckCircleIcon,
    'URL': GlobeAltIcon,
    'Email': DocumentTextIcon,
    'Phone': DocumentTextIcon,
    'Currency': DocumentTextIcon,
    'Percent': DocumentTextIcon,
    'Status': FlagIcon,
    'Priority': FlagIcon,
    'Related': LinkIcon,
    'Parent': ArrowPathIcon
  };
  return iconMap[dataType] || DocumentTextIcon;
};

// Column settings
const resetColumnSettings = async () => {
  // Use registry for default columns if available
  const moduleListRegistry = await import('@/platform/modules/moduleListRegistry').catch(() => null);
  if (moduleListRegistry) {
    const { getModuleListConfig, buildDefaultColumns } = moduleListRegistry;
    const moduleListConfig = getModuleListConfig(props.moduleKey);
    
    if (moduleListConfig?.defaultColumns) {
      const allAvailableColumnsMap = new Map();
      props.columns.forEach(col => {
        allAvailableColumnsMap.set(col.key, {
          key: col.key,
          label: col.label || col.key,
          dataType: col.dataType,
          sortable: col.sortable !== false,
          showInTable: col.showInTable !== false,
        });
      });
      ensureDefaultColumnsInMap(props.moduleKey, moduleListConfig.defaultColumns.defaultVisibleColumns, allAvailableColumnsMap);
      const allAvailableColumns = Array.from(allAvailableColumnsMap.values());
      const defaultColumns = buildDefaultColumns(allAvailableColumns, moduleListConfig.defaultColumns);
      visibleColumns.value = normalizeColumnOrder(defaultColumns);
      saveColumnSettings();
      if (typeof window !== 'undefined') {
        localStorage.removeItem(rowHeightStorageKey.value);
      }
      if (props.tableId) {
        localStorage.removeItem(`table-column-widths-${props.tableId}`);
      }
      rowHeight.value = DEFAULT_ROW_HEIGHT;
      resetWidthsTrigger.value++;
      return;
    }
  }

  // Fallback: make all columns visible with 'name' locked if it exists
  // This applies to all modules that don't have registry config
  visibleColumns.value = props.columns.map(col => ({
    ...col,
    visible: true,
    locked: col.key === 'name' || col.locked === true // Lock 'name' by default, or if explicitly set
  }));
  saveColumnSettings();
  
  rowHeight.value = DEFAULT_ROW_HEIGHT;
  
  // Clear saved settings (after applying new defaults)
  if (typeof window !== 'undefined') {
    localStorage.removeItem(columnsStorageKey.value);
    localStorage.removeItem(rowHeightStorageKey.value);
  }
  
  // Reset column widths if needed
  if (props.tableId) {
    localStorage.removeItem(`table-column-widths-${props.tableId}`);
  }
  
  // Reinitialize columns after reset to ensure proper ordering and defaults
  initializeColumns();
};

const toggleFieldVisibility = async (fieldKey) => {
  let column = visibleColumns.value.find(col => col.key === fieldKey);
  
  // Check if field is locked (e.g., 'name' for People module)
  if (column?.locked) {
    // Locked columns cannot be hidden
    return;
  }
  
  // Prevent hiding 'name' field for forms module
  if (props.moduleKey === 'forms' && fieldKey?.toLowerCase() === 'name') {
    if (column && !column.visible) {
      // Allow showing it, but prevent hiding
      return;
    }
    if (!column || column.visible) {
      // Trying to hide - prevent it
      notifications.error('The "name" field must always be visible in table and detail views for Forms.');
      return;
    }
  }
  
  // If field doesn't exist in visibleColumns, add it
  if (!column) {
    // Find field from backend config or props.columns
    const backendField = backendModuleConfig.value?.fields?.find(f => f.key === fieldKey);
    const propsCol = props.columns.find(c => c.key === fieldKey);
    
    if (backendField || propsCol) {
      const newColumn = {
        key: fieldKey,
        label: getFieldDisplayLabel(backendField, props.moduleKey) || propsCol?.label || fieldKey,
        visible: true, // Toggling on, so make it visible
        sortable: propsCol?.sortable !== false,
        dataType: backendField?.dataType || propsCol?.dataType || 'Text',
        showInTable: true
      };
      
      // Add to visibleColumns
      visibleColumns.value.push(newColumn);
      // Normalize order after adding new column
      visibleColumns.value = normalizeColumnOrder(visibleColumns.value);
      column = newColumn;
    } else {
      console.warn(`Field ${fieldKey} not found in backend or props`);
      return;
    }
  } else {
    // Toggle visibility
    column.visible = !column.visible;
    column.showInTable = column.visible;
  }
  
  // Normalize order after toggling (ensures name stays at top for forms)
  visibleColumns.value = normalizeColumnOrder(visibleColumns.value);
  
  // Explicitly save the change
  saveColumnSettings();
  
  // Sync with backend field configuration
  await syncFieldVisibilityToBackend(fieldKey, column.visible);
};

// Sync field visibility with backend field configuration
const syncFieldVisibilityToBackend = async (fieldKey, visible) => {
  try {
    // Get the module key from props
    const moduleKey = props.moduleKey;
    if (!moduleKey) return;

    const module = await fetchModuleDefinitionCached(moduleKey);
    if (!module) {
      console.warn(`Module ${moduleKey} not found for field sync`);
      return;
    }
    
    const fields = module.fields || [];
    
    // Find and update the field
    const fieldIndex = fields.findIndex(f => f.key === fieldKey);
    if (fieldIndex === -1) {
      console.warn(`Field ${fieldKey} not found in module configuration`);
      return;
    }
    
    // Update field visibility
    if (!fields[fieldIndex].visibility) {
      fields[fieldIndex].visibility = {};
    }
    fields[fieldIndex].visibility.list = visible;
    
    // Save updated module configuration
    const updateResponse = await fetch(`/api/modules/system/${moduleKey}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        fields: fields,
        relationships: module.relationships || [],
        quickCreate: module.quickCreate || [],
        quickCreateLayout: module.quickCreateLayout || { version: 1, rows: [] },
        name: module.name,
        enabled: module.enabled !== false,
        pipelineSettings: module.pipelineSettings || []
      })
    });
    
    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      console.warn('Failed to sync field visibility to backend:', errorData.message || 'Unknown error');
    }
  } catch (error) {
    console.warn('Error syncing field visibility to backend:', error);
    // Don't throw - this is a background sync, shouldn't break the UI
  }
};

const autosizeAllColumns = () => {
  // Clear stored widths to let columns auto-size
  if (props.tableId) {
    localStorage.removeItem(`table-column-widths-${props.tableId}`);
  }
  // Trigger TableView to reset column widths by incrementing the trigger
  resetWidthsTrigger.value++;
};

const router = useRouter();
const route = useRoute();

const quickPreviewEnabled = computed(() => moduleSupportsGenericRecordPreview(props.moduleKey));

// Core modules are configured in Settings > Core Modules; app modules (e.g. Deals) in Settings > Applications
const CORE_MODULE_KEYS = ['people', 'organizations', 'tasks', 'events', 'forms', 'items', 'quotes', 'sales_orders', 'invoices', 'payments'];
const APP_MODULE_CONFIG = {
  deals: { appKey: 'SALES', app: 'sales', config: 'schema' }
};

const openNewCustomField = () => {
  // Close the drawer
  showColumnSettings.value = false;
  const moduleKey = (props.moduleKey || '').toLowerCase();
  const isCoreModule = CORE_MODULE_KEYS.includes(moduleKey);
  const appConfig = APP_MODULE_CONFIG[moduleKey];

  if (isCoreModule) {
    // Settings > Core Modules > [module] > Field Configurations tab
    router.push({
      path: '/settings',
      query: {
        tab: 'core-modules',
        moduleKey: props.moduleKey,
        module: props.moduleKey,
        mode: 'fields',
        action: 'add'
      }
    });
  } else if (appConfig) {
    // Settings > Applications > [app] > [module] > Field Configurations tab
    router.push({
      path: '/settings',
      query: {
        tab: 'applications',
        appKey: appConfig.appKey,
        app: appConfig.app,
        config: appConfig.config,
        module: props.moduleKey,
        mode: 'fields',
        action: 'add'
      }
    });
  } else {
    // Fallback: try core-modules (e.g. for future core modules not yet in list)
    router.push({
      path: '/settings',
      query: {
        tab: 'core-modules',
        moduleKey: props.moduleKey,
        module: props.moduleKey,
        mode: 'fields',
        action: 'add'
      }
    });
  }
};

// Drag and drop for columns
const dragStartIndex = ref(null);

const handleDragStart = (event, index) => {
  const field = shownFields.value[index];
  if (field?.locked || (props.moduleKey === 'forms' && field?.key?.toLowerCase() === 'name')) {
    event.preventDefault();
    return;
  }

  // Store the index in shownFields array
  dragStartIndex.value = index;
  event.dataTransfer.effectAllowed = 'move';
  // Set opacity on the dragged element
  if (event.target) {
    event.target.style.opacity = '0.5';
  }
};

const handleDragOver = (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
};

const handleDragEnter = (event, index) => {
  event.preventDefault();
  dragOverIndex.value = index;
};

const handleDragLeave = (event) => {
  dragOverIndex.value = null;
};

const handleDrop = (event, dropIndex) => {
  event.preventDefault();
  dragOverIndex.value = null;
  
  if (dragStartIndex.value === null || dragStartIndex.value === dropIndex) {
    dragStartIndex.value = null;
    return;
  }
  
  // Prevent reordering 'name' field for forms module
  if (props.moduleKey === 'forms') {
    const visibleCols = visibleColumns.value.filter(col => col.visible);
    const draggedField = shownFields.value[dragStartIndex.value];
    const dropField = shownFields.value[dropIndex];
    
    // Prevent dragging 'name' field away from position 0
    if (draggedField?.key?.toLowerCase() === 'name' && dragStartIndex.value === 0) {
      dragStartIndex.value = null;
      return;
    }
    
    // Prevent dropping other fields at position 0 if 'name' is already there
    if (dropIndex === 0 && draggedField?.key?.toLowerCase() !== 'name') {
      const nameFieldIndex = shownFields.value.findIndex(f => f.key?.toLowerCase() === 'name');
      if (nameFieldIndex === 0) {
        dragStartIndex.value = null;
        return;
      }
    }
  }
  
  // Get the current visible columns in their current order
  const visibleCols = visibleColumns.value.filter(col => col.visible);
  const hiddenCols = visibleColumns.value.filter(col => !col.visible);
  
  // Validate indices against visible columns (not shownFields, which might have different order)
  if (dragStartIndex.value >= 0 && dragStartIndex.value < visibleCols.length &&
      dropIndex >= 0 && dropIndex < visibleCols.length) {
    
    // Get the dragged column directly from visibleCols using the index
    const draggedColumn = visibleCols[dragStartIndex.value];
    
    // Remove from old position
    visibleCols.splice(dragStartIndex.value, 1);
    
    // Calculate the new insertion index
    // If dragging down (startIndex < dropIndex), dropIndex decreases by 1 after removal
    // If dragging up (startIndex > dropIndex), dropIndex stays the same
    const newIndex = dragStartIndex.value < dropIndex ? dropIndex - 1 : dropIndex;
    
    // Ensure newIndex is within bounds
    const insertIndex = Math.max(0, Math.min(newIndex, visibleCols.length));
    
    // Insert at new position
    visibleCols.splice(insertIndex, 0, draggedColumn);
    
    // Reconstruct visibleColumns with new order (visible first, then hidden)
    const reorderedColumns = [...visibleCols, ...hiddenCols];
    visibleColumns.value = normalizeColumnOrder(reorderedColumns);
    
    // Save the new order immediately
    saveColumnSettings();
  }
  
  dragStartIndex.value = null;
};

const handleDragEnd = (event) => {
  if (event.target) {
    event.target.style.opacity = '1';
  }
  dragStartIndex.value = null;
  dragOverIndex.value = null;
};

// Event handlers
const handleRowClick = (row, event) => {
  emit('row-click', row, event);
};

const handleEdit = (row) => {
  emit('edit', row);
};

const handleDeleteClick = (row) => {
  rowToDelete.value = row;
  isBulkDelete.value = false;
  bulkDeleteRows.value = [];
  bulkDeletePayload.value = null;
  showDeleteModal.value = true;
};

const handleDeleteModalClose = () => {
  if (bulkDeleteStore.isActive) {
    bulkDeleteStore.releaseToBanner();
    resetBulkDeleteModalState();
    return;
  }
  resetBulkDeleteModalState();
};

function bulkDeleteInitialTotal(payload) {
  if (!payload) return bulkDeleteRows.value.length;
  if (payload.mode === 'all') {
    return Number(payload.selectionCount || payload.totalMatching || 0);
  }
  return (payload.selectedIds || []).length || bulkDeleteRows.value.length;
}

const confirmDelete = async () => {
  if (isBulkDelete.value) {
    if (bulkDeleteStore.isActive) return;
    const payload = bulkDeletePayload.value ?? {
      mode: 'page',
      selectedIds: bulkDeleteRows.value.map((r) => r?._id || r?.id || r?.eventId).filter(Boolean),
      excludedIds: [],
      totalMatching: bulkDeleteRows.value.length,
      selectionCount: bulkDeleteRows.value.length
    };
    bulkDeleteStore.start({
      moduleKey: props.moduleKey,
      phase: 'deleting',
      total: bulkDeleteInitialTotal(payload)
    });
    bulkDeleteStore.pinToModal();
    await nextTick();
    emit('bulk-action', 'bulk-delete', payload);
    clearSelection();
    return;
  }

  deleting.value = true;
  try {
    if (!rowToDelete.value) return;
    emit('delete', rowToDelete.value);
    await new Promise((resolve) => setTimeout(resolve, 300));
  } finally {
    deleting.value = false;
    showDeleteModal.value = false;
    rowToDelete.value = null;
  }
};

const handleDelete = (row) => {
  emit('delete', row);
};

let previewListPath = '';

const handleView = (row) => {
  if (!quickPreviewEnabled.value) return;
  previewListPath = String(route.path || '').split('?')[0];
  previewRow.value = row;
  showPreviewDrawer.value = true;
  saveDrawerState();
};

watch(
  () => route.path,
  (path) => {
    if (!showPreviewDrawer.value || !previewListPath) return;
    const pathOnly = String(path || '').split('?')[0];
    if (pathOnly !== previewListPath) {
      showPreviewDrawer.value = false;
      previewRow.value = null;
      previewListPath = '';
    }
  }
);

// Quick preview Prev/Next (e.g. tasks): index in current list
const quickPreviewIndex = computed(() => {
  const row = previewRow.value;
  const list = props.data || [];
  if (!row?._id || !Array.isArray(list)) return -1;
  return list.findIndex((r) => String(r?._id || '') === String(row._id));
});
const quickPreviewCanPrevious = computed(() => quickPreviewIndex.value > 0);
const quickPreviewCanNext = computed(() => {
  const idx = quickPreviewIndex.value;
  const list = props.data || [];
  return idx >= 0 && idx < list.length - 1;
});
const handleQuickPreviewPrev = () => {
  const list = props.data || [];
  const idx = quickPreviewIndex.value;
  if (idx <= 0 || idx >= list.length) return;
  previewRow.value = list[idx - 1];
};
const handleQuickPreviewNext = () => {
  const list = props.data || [];
  const idx = quickPreviewIndex.value;
  if (idx < 0 || idx >= list.length - 1) return;
  previewRow.value = list[idx + 1];
};

// Handle field updates from QuickPreviewDrawer
const handlePreviewUpdate = async (updateData) => {
  if (!previewRow.value?._id || !updateData.field) return;
  
  const { field, value, onSuccess } = updateData;
  const recordId = previewRow.value._id;
  
  try {
    // Determine API endpoint based on moduleKey (generic approach)
    // Use plural form of moduleKey for endpoint
    const moduleKeyPlural = props.moduleKey.endsWith('y') 
      ? props.moduleKey.slice(0, -1) + 'ies' // e.g., "people" from "person" (though people is already plural)
      : props.moduleKey.endsWith('s')
      ? props.moduleKey // Already plural
      : props.moduleKey + 's'; // Add 's' for plural
    
    const endpoint = `/${moduleKeyPlural}/${recordId}`;
    
    // Save to backend
    const response = await apiClient.put(endpoint, {
      [field]: value
    });
    
    if (response.success && response.data) {
      // Update local preview row
      previewRow.value = { ...previewRow.value, ...response.data };
      
      // Note: We can't directly mutate props.data, so we emit the update event
      // The parent component should handle updating its data array
      
      // Emit update event to parent component
      emit('row-updated', { row: response.data, field, value });
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        await onSuccess(response.data);
      }
    }
  } catch (error) {
    console.error('Error updating field:', error);
    // Revert the change in previewRow
    if (previewRow.value) {
      // Could restore from original value if we track it
    }
  }
};

const handleViewFull = (row) => {
  emit('view', row);
};

const handlePageChange = (page) => {
  emit('update:pagination', { ...props.pagination, currentPage: page });
};

const handleSort = ({ key, order, sorts: nextSorts }) => {
  const sorts = normalizeSortSpecs(
    Array.isArray(nextSorts) && nextSorts.length
      ? nextSorts
      : order
        ? [{ field: key, order }]
        : []
  );
  const primary = primarySort(sorts, { field: '', order: 'asc' });
  const sortField = primary.field || '';
  const sortOrder = primary.order || 'asc';

  emit('update:sort', { sortField, sortOrder, sorts });

  const payload = persistSortPayload(sorts);
  if (payload) {
    localStorage.setItem(sortStorageKey.value, JSON.stringify(payload));
  } else {
    localStorage.removeItem(sortStorageKey.value);
  }
};

const listSelection = useListSelection({
  getRowId: (row) => {
    const key = props.rowKey || '_id';
    const raw = row?.[key] ?? row?._id ?? row?.id;
    return raw != null ? String(raw) : '';
  },
  getTotalMatching: () =>
    normalizeListPagination(props.pagination).totalRecords,
  getLoadedCount: () => (Array.isArray(props.data) ? props.data.length : 0)
});

const {
  mode: selectionMode,
  selectedIds: selectionSelectedIds,
  excludedIds: selectionExcludedIds,
  selectionCount,
  selectAllMatching: isSelectAllMatching,
  showSelectAllMatchingLink,
  hasSelection,
  totalMatching: selectionTotalMatching,
  clear: clearListSelection,
  toggleRow: toggleListRowSelection,
  toggleSelectAllLoaded: toggleListSelectAllLoaded,
  selectAllMatchingRecords,
  pruneToLoadedRows,
  getSelectedRowsFromLoaded,
  getBulkPayload
} = listSelection;

const selectedRowIdsForTable = computed(() => [...selectionSelectedIds.value]);
const excludedRowIdsForTable = computed(() => [...selectionExcludedIds.value]);

const clearSelectionTrigger = ref(0);

const clearSelection = () => {
  clearListSelection();
  clearSelectionTrigger.value++;
};

watch(
  () => props.data,
  (rows) => {
    if (!Array.isArray(rows) || !hasSelection.value) return;
    pruneToLoadedRows(rows);
  }
);

// Clear selection when route changes (switching modules/tabs)
watch(() => router.currentRoute.value.path, () => {
  clearSelection();
  showColumnSettings.value = false;
  showKanbanSettings.value = false;
}, { immediate: false });

// Clear selection when moduleKey changes (switching modules)
watch(() => props.moduleKey, () => {
  clearSelection();
}, { immediate: false });

// Clear selection when component unmounts
onUnmounted(() => {
  clearSelection();
});

const handleBulkAction = (actionId, selectedRows) => {
  emit('bulk-action', actionId, selectedRows);
};

function handleMassEditSubmit(updates) {
  const payload = {
    ...getBulkPayload(),
    updates,
  };
  showMassEditDrawer.value = false;
  emit('bulk-action', 'mass-edit', payload);
}

const handleBulkActionClick = (actionId) => {
  const payload = getBulkPayload();
  if (actionId === 'mass-edit') {
    showMassEditDrawer.value = true;
    return;
  }
  if (actionId === 'delete' || actionId === 'bulk-delete') {
    isBulkDelete.value = true;
    bulkDeletePayload.value = payload;
    bulkDeleteRows.value = getSelectedRowsFromLoaded(
      Array.isArray(props.data) ? props.data : []
    );
    rowToDelete.value = null;
    showDeleteModal.value = true;
  } else {
    handleBulkAction(actionId, payload);
  }
};

// Get icon component for action
const getActionIcon = (iconName) => {
  const iconMap = {
    'trash': TrashIcon,
    'delete': TrashIcon,
    'activate': CheckCircleIcon,
    'deactivate': NoSymbolIcon,
    'export': ArrowUpTrayIcon,
    'download': ArrowUpTrayIcon,
    'duplicate': DocumentDuplicateIcon,
    'archive': ArchiveBoxIcon,
    'convert': ArrowPathIcon,
    'move': ArrowRightIcon,
    'sequence': RectangleStackIcon,
    'sidekick': StarIcon,
    'apps': PuzzlePieceIcon,
    'edit': PencilSquareIcon,
    'pencil': PencilSquareIcon,
  };
  return iconMap[iconName] || TrashIcon;
};

// Saved View Management (works for all modules with savedViews prop)
const savedViewsUserId = computed(() => authStore.user?._id ?? null);
const systemViewIds = computed(() => {
  if (!props.savedViews?.length) return [];
  return props.savedViews
    .filter((view) => isSystemViewId(view.id))
    .map((view) => view.id);
});

const isSystemView = (viewId) => isSystemViewId(viewId);

function savedViewActionsColumnClass(viewId) {
  const base = 'flex shrink-0 items-center gap-0.5 overflow-hidden pr-2 transition-[max-width,opacity] duration-150';
  const isDefault = isEffectiveDefaultView(viewId);
  const isCustom = !isSystemView(viewId);

  if (isCustom) {
    return isDefault
      ? `${base} max-w-7 opacity-100 group-hover:max-w-20`
      : `${base} max-w-0 opacity-0 group-hover:max-w-20 group-hover:opacity-100`;
  }

  return isDefault
    ? `${base} max-w-7 opacity-100`
    : `${base} max-w-0 opacity-0 group-hover:max-w-7 group-hover:opacity-100`;
}

// Load custom saved views from localStorage
const loadCustomViews = () =>
  loadCustomSavedViews(props.moduleKey, savedViewsUserId.value);

// Save custom views (local cache + server)
const saveCustomViews = async (views) => {
  const customViews = views.filter((v) => !isSystemView(v.id));
  await persistCustomSavedViews(props.moduleKey, savedViewsUserId.value, customViews);
};

// Get current view configuration (filters, columns, sort, search)
const getCurrentViewConfig = () => {
  const { flatAll, filterQuery } = buildCompiledListFilters();

  return {
    filters: { ...flatAll },
    operators: { ...filterOperatorsMap.value },
    query: JSON.parse(JSON.stringify(filterBuilderQuery.value)),
    filterQuery: filterQuery ? JSON.stringify(filterQuery) : undefined,
    search: searchQuery.value,
    sort: (() => {
      const payload = persistSortPayload(resolvedSorts.value);
      return payload || {
        field: props.sortField,
        order: props.sortOrder,
        sorts: resolvedSorts.value
      };
    })(),
    columns: visibleColumns.value.map(col => ({
      key: col.key,
      visible: col.visible,
      width: col.width,
      order: col.order
    }))
  };
};

function resolveSavedViewConfig(view) {
  if (!view) return null;
  if (view.config) return view.config;
  return {
    filters: view.filters || {},
    search: view.search,
    sort: view.sort,
    columns: view.columns,
  };
}

function viewConfigHasActiveFilters(config) {
  if (!config) return false;
  if (config.filterQuery) return true;
  if (config.query) return true;
  return Object.keys(config.filters || {}).some((key) => {
    const value = config.filters[key];
    return value !== undefined && value !== '';
  });
}

function isFilterQueryOnlyPayload(payload) {
  return Boolean(payload?.filterQuery) && Object.keys(payload).length === 1;
}

const FILTER_SESSION_STORAGE_MAX_CHARS = 120_000;

function buildFilterSessionStoragePayload() {
  const activeFilters = {};
  for (const [key, value] of Object.entries(filters)) {
    if (key === 'filterQuery') continue;
    if (!isFilterValueActive(value)) continue;
    activeFilters[key] = value;
  }

  const activeOperators = {};
  for (const [key, operator] of Object.entries(filterOperatorsMap.value)) {
    if (!operator) continue;
    if (activeFilters[key] !== undefined || filterRuleMeta[key]) {
      activeOperators[key] = operator;
    }
  }

  return {
    filters: activeFilters,
    operators: activeOperators,
    query: filterBuilderQuery.value,
  };
}

function shouldPersistEphemeralFilterSession() {
  if (!props.activeSavedViewId || isSystemViewId(props.activeSavedViewId)) {
    return true;
  }
  return false;
}

function safePersistFilterBuilderSession() {
  if (!shouldPersistEphemeralFilterSession()) {
    try {
      localStorage.removeItem(filterStorageKey.value);
    } catch {
      /* ignore */
    }
    return;
  }

  const payload = buildFilterSessionStoragePayload();
  const serialized = JSON.stringify(payload);
  if (serialized.length > FILTER_SESSION_STORAGE_MAX_CHARS) {
    console.warn('[ListView] Skipping filter session localStorage — payload too large');
    return;
  }

  try {
    localStorage.setItem(filterStorageKey.value, serialized);
  } catch (error) {
    if (error?.name === 'QuotaExceededError') {
      try {
        localStorage.removeItem(filterStorageKey.value);
        localStorage.setItem(filterStorageKey.value, serialized);
      } catch {
        console.warn('[ListView] Filter session localStorage quota exceeded');
      }
      return;
    }
    console.warn('[ListView] Failed to persist filter session:', error);
  }
}

function persistFilterBuilderSession() {
  safePersistFilterBuilderSession();
}

function applyFilterBuilderState(config) {
  if (!config) return;

  Object.keys(filterRuleMeta).forEach((key) => {
    delete filterRuleMeta[key];
  });

  if (config.filters) {
    Object.keys(filters).forEach((key) => {
      if (key !== 'filterQuery') {
        filters[key] = '';
      }
    });
    Object.entries(config.filters).forEach(([key, value]) => {
      if (key === 'filterQuery') return;
      filters[key] = value;
    });
  }

  if (config.operators) {
    Object.entries(config.operators).forEach(([key, operator]) => {
      if (operator) {
        trackFilterRuleMeta(key, 'builder', String(operator));
      }
    });
  }

  if (config.query) {
    filterBuilderQuery.value = JSON.parse(JSON.stringify(config.query));
  } else if (config.filters) {
    if (!viewConfigHasActiveFilters(config)) {
      filterBuilderQuery.value = createDefaultRootGroup();
    } else {
      // Start from a clean root so incomplete empty rows from a prior session are dropped
      filterBuilderQuery.value = syncRootGroupFromActiveFilters(
        createDefaultRootGroup(),
        builderFilterConfigList.value,
        filters,
        filterOperatorsMap.value
      );
    }
  }
}

const lastAppliedSavedViewSignature = ref('');

function applySavedViewFromRecord(view, options = {}) {
  if (!view) return;
  const rawConfig = resolveSavedViewConfig(view) || { filters: {} };
  const config = {
    ...rawConfig,
    filters:
      props.moduleKey === 'events'
        ? expandEventsSpecialViewFilters({ ...(rawConfig.filters || {}) }, view.id)
        : { ...(rawConfig.filters || {}) },
  };

  const signature = `${view.id}:${JSON.stringify(config)}`;
  if (!options.force && signature === lastAppliedSavedViewSignature.value) return;
  lastAppliedSavedViewSignature.value = signature;

  if (!isSystemViewId(view.id)) {
    isActiveViewHydrating.value = true;
  }

  Object.keys(filterRuleMeta).forEach((key) => {
    delete filterRuleMeta[key];
  });

  if (!viewConfigHasActiveFilters(config)) {
    Object.keys(filters).forEach((key) => {
      delete filters[key];
    });
    filterBuilderQuery.value = createDefaultRootGroup();
  } else {
    applyFilterBuilderState(config);
  }

  applyViewConfig(config);

  if (
    !options.preserveSearch
    && !Object.prototype.hasOwnProperty.call(config, 'search')
  ) {
    searchQuery.value = '';
    emitSearchToParent('');
  }

  persistFilterBuilderSession();

  nextTick(() => {
    mobileFilterBuilderPanelRef.value?.syncRowsFromFilters?.();
    desktopFilterBuilderPanelRef.value?.syncRowsFromFilters?.();
    syncViewCleanBaseline(view.id);
    isActiveViewHydrating.value = false;
  });
}

function emitParentListFilters(config) {
  const { apiPayload } = buildCompiledListFilters();
  const payload = { ...apiPayload };

  if (config?.filterQuery && !payload.filterQuery) {
    payload.filterQuery = typeof config.filterQuery === 'string'
      ? config.filterQuery
      : JSON.stringify(config.filterQuery);
  }

  const savedFilters = config?.filters || {};
  for (const [key, value] of Object.entries(savedFilters)) {
    if (key === 'filterQuery' || value === undefined || value === '') continue;
    if (payload[key] === undefined) {
      payload[key] = value;
    }
  }

  lastEmittedFiltersSignature = JSON.stringify(payload);
  emit('update:filters', payload);
}

// Apply view configuration (filters, columns, sort, search)
const applyViewConfig = (config) => {
  if (viewConfigHasActiveFilters(config)) {
    emitParentListFilters(config);
  } else if (config.filters !== undefined) {
    Object.keys(filters).forEach((key) => {
      delete filters[key];
    });
    Object.keys(config.filters).forEach((key) => {
      filters[key] = config.filters[key];
    });
    if (!config.query && !viewConfigHasActiveFilters(config)) {
      filterBuilderQuery.value = createDefaultRootGroup();
    }
    emitCompiledFilters();
  }

  if (Object.prototype.hasOwnProperty.call(config, 'search')) {
    searchQuery.value = config.search ?? '';
    emitSearchToParent(config.search ?? '');
  }
  
  // Apply sort
  if (config.sort) {
    const sorts = parsePersistedSort(config.sort);
    const primary = primarySort(sorts, {
      field: config.sort.field || 'createdAt',
      order: config.sort.order || 'desc'
    });
    emit('update:sort', {
      sortField: primary.field,
      sortOrder: primary.order,
      sorts: sorts.length ? sorts : [primary]
    });
  }
  
  // Apply columns
  if (config.columns && Array.isArray(config.columns)) {
    // Restore column visibility and order from saved view
    const columnMap = new Map(config.columns.map(col => [col.key, col]));
    visibleColumns.value.forEach(col => {
      const saved = columnMap.get(col.key);
      if (saved) {
        col.visible = saved.visible !== false;
        if (saved.width) col.width = saved.width;
        if (saved.order !== undefined) col.order = saved.order;
      }
    });
    // Sort by saved order
    visibleColumns.value.sort((a, b) => {
      const aOrder = columnMap.get(a.key)?.order ?? 999;
      const bOrder = columnMap.get(b.key)?.order ?? 999;
      return aOrder - bOrder;
    });
  }
};

// Handle save current view (orphan Custom state — new view only)
const handleSaveCurrentView = () => {
  if (!props.savedViews?.length) return;

  saveMode.value = 'create';
  editingView.value = null;
  const activeView = activeSavedViewRecord.value;
  const suggestName = activeView?.label ? suggestCopyViewName(activeView.label) : '';
  viewFormNameError.value = '';
  viewFormData.value = {
    name: isActiveSystemView.value ? suggestName : '',
    description: '',
  };
  showSaveViewModal.value = true;
};

// Save as new view (from dirty active view)
const handleSaveAsNewView = () => {
  if (!props.savedViews?.length) return;

  saveMode.value = 'create';
  editingView.value = null;
  const activeView = activeSavedViewRecord.value;
  viewFormNameError.value = '';
  viewFormData.value = {
    name: activeView?.label ? suggestCopyViewName(activeView.label) : '',
    description: '',
  };
  showSaveViewModal.value = true;
};

// One-click update of active custom view (no modal)
const handleUpdateActiveView = async () => {
  const view = activeSavedViewRecord.value;
  if (!view || isSystemView(view.id)) return;

  const currentConfig = getCurrentViewConfig();
  const customViews = loadCustomViews();
  const index = customViews.findIndex((v) => v.id === view.id);
  if (index === -1) return;

  const savedView = {
    ...customViews[index],
    filters: currentConfig.filters,
    config: currentConfig,
    updatedAt: new Date().toISOString(),
  };
  customViews[index] = savedView;

  await saveCustomViews(customViews);
  emit('saved-views-updated', customViews);
  saveActiveSavedViewId(props.moduleKey, savedViewsUserId.value, savedView.id);
  emit('saved-view-selected', savedView);
  nextTick(() => syncViewCleanBaseline(savedView.id));
  notifications.success(t('common.listViewUpdated'));
};

const handleRevertToSavedView = () => {
  const view = activeSavedViewRecord.value;
  if (!view) return;
  applySavedViewFromRecord(view, { force: true });
};

// Rename view metadata only (pencil in dropdown)
const handleEditView = (view) => {
  if (!props.savedViews?.length || isSystemView(view.id)) return;

  saveMode.value = 'rename';
  editingView.value = view;
  viewFormNameError.value = '';
  viewFormData.value = {
    name: view.label || '',
    description: view.description || '',
  };
  showSaveViewModal.value = true;
};

// Handle delete view
const handleDeleteView = (view) => {
  if (!props.savedViews || props.savedViews.length === 0 || isSystemView(view.id)) return;
  
  viewToDelete.value = view;
  showDeleteViewModal.value = true;
};

// Save or update view
const handleSaveView = async () => {
  if (!props.savedViews || props.savedViews.length === 0) return;

  const viewName = normalizeSavedViewName(viewFormData.value.name);
  if (!viewName) {
    viewFormNameError.value = t('validation.required');
    return;
  }
  if (viewName.length > SAVED_VIEW_NAME_MAX_LENGTH) {
    viewFormNameError.value = t('validation.maxLength', { max: SAVED_VIEW_NAME_MAX_LENGTH });
    return;
  }
  viewFormNameError.value = '';

  const currentConfig = getCurrentViewConfig();
  const customViews = loadCustomViews();
  let savedView = null;
  
  if (saveMode.value === 'rename' && editingView.value) {
    const index = customViews.findIndex((v) => v.id === editingView.value.id);
    if (index !== -1) {
      savedView = {
        ...customViews[index],
        label: viewName,
        description: viewFormData.value.description.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };
      customViews[index] = savedView;
    }
  } else {
    // Create new view
    savedView = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      label: viewName,
      description: viewFormData.value.description.trim() || undefined,
      filters: currentConfig.filters,
      config: currentConfig,
      createdAt: new Date().toISOString()
    };
    customViews.push(savedView);
  }
  
  await saveCustomViews(customViews);
  emit('saved-views-updated', customViews);

  if (savedView) {
    saveActiveSavedViewId(props.moduleKey, savedViewsUserId.value, savedView.id);
    emit('saved-view-selected', savedView);
    nextTick(() => syncViewCleanBaseline(savedView.id));
  }

  handleCloseSaveViewModal();
};

// Confirm delete view
const confirmDeleteView = async () => {
  if (!props.savedViews || props.savedViews.length === 0 || !viewToDelete.value || isSystemView(viewToDelete.value.id)) return;
  
  const customViews = loadCustomViews();
  const filtered = customViews.filter(v => v.id !== viewToDelete.value.id);
  await saveCustomViews(filtered);
  emit('saved-views-updated', filtered);
  
  // If deleted view was active, clear it
  if (props.activeSavedViewId === viewToDelete.value.id) {
    emit('saved-view-selected', null);
  }
  
  handleCloseDeleteViewModal();
};

// Close save view modal
const handleCloseSaveViewModal = () => {
  showSaveViewModal.value = false;
  editingView.value = null;
  saveMode.value = 'create';
  viewFormData.value = { name: '', description: '' };
  viewFormNameError.value = '';
};

// Close delete view modal
const handleCloseDeleteViewModal = () => {
  showDeleteViewModal.value = false;
  viewToDelete.value = null;
};

// Handle saved view click - apply full config
const handleSavedViewClick = (view) => {
  applySavedViewFromRecord(view, { force: true });
  emit('saved-view-selected', view);
};

// Handle set as default - mark view as default and switch to it
const handleSetDefaultView = (view) => {
  emit('set-default-view', view.id);
  applySavedViewFromRecord(view, { force: true });
  emit('saved-view-selected', view);
};

defineExpose({
  openCustomize: handleCustomizeClick,
});
</script>
