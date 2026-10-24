<template>
  <div class="min-h-screen bg-gray-100/50 dark:bg-gray-900">
    <!-- Loading State -->
    <div
      v-if="loading"
      class="flex min-h-screen items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="flex flex-col items-center text-center">
        <ArivuShimmerLogo size="lg" />
        <p class="mt-4 font-medium text-gray-600 dark:text-gray-400">
          {{ t('common.summaryLoadingRecord', { type: recordType }) }}
        </p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ t('common.summaryErrorLoadingTitle', { type: recordType }) }}</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">{{ error }}</p>
        <button @click="$emit('close')" class="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">
          {{ t('actions.close') }}
        </button>
      </div>
    </div>

    <!-- Main Summary View -->
    <div v-else-if="record" class="max-w-full mx-auto">
      <!-- Header Component - Fixed below TabBar -->
      <div 
        class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 fixed top-[65px] md:top-[113px] lg:top-[49px] z-40 transition-all duration-300 ease-in-out"
        :style="{ 
          left: headerLeft,
          right: '0px'
        }"
      >
        <div class="px-6 py-4">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <!-- Left Group: Record Identity & Quick Actions -->
            <div class="flex items-center gap-4 flex-1 min-w-0">
              <!-- Icon/Avatar -->
              <div class="flex-shrink-0">
                <div v-if="record.avatar" class="w-12 h-12 rounded-lg overflow-hidden">
                  <img :src="record.avatar" :alt="record.name" class="w-full h-full object-cover" />
                </div>
                <div v-else :class="['w-12 h-12 rounded-lg flex items-center justify-center text-xl font-medium', getColorForName(record.name).bg, getColorForName(record.name).text]">
                  {{ getInitials(record.name) }}
                </div>
              </div>

              <!-- Record Name with Actions -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-xl font-bold text-gray-900 dark:text-white truncate">
                  {{ record.name }}
                </h1>

                  <!-- Action Icons - Right next to title -->
                  <div class="flex items-center gap-1">
                <!-- Follow Toggle -->
                <button
                  @click="toggleFollow"
                  :class="[
                        'p-1.5 rounded-lg transition-colors',
                    isFollowing 
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  ]"
                  :title="isFollowing ? t('actions.unfollow') : t('actions.follow')"
                >
                      <HeartIconSolid v-if="isFollowing" class="w-4 h-4" />
                      <HeartIcon v-else class="w-4 h-4" />
                </button>

                    <!-- Tag Dropdown -->
                    <Menu as="div" class="relative">
                      <MenuButton 
                        :class="[
                          'p-1.5 rounded-lg transition-colors',
                          tags.length > 0
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        ]"
                        :title="tags.length > 0 ? t('common.summaryManageTags') : t('common.summaryAddTag')"
                      >
                        <TagIconSolid v-if="tags.length > 0" class="w-4 h-4" />
                        <TagIcon v-else class="w-4 h-4" />
                      </MenuButton>

                      <transition
                        enter-active-class="transition ease-out duration-100"
                        enter-from-class="transform opacity-0 scale-95"
                        enter-to-class="transform opacity-100 scale-100"
                        leave-active-class="transition ease-in duration-75"
                        leave-from-class="transform opacity-100 scale-100"
                        leave-to-class="transform opacity-0 scale-95"
                      >
                        <MenuItems class="absolute left-0 mt-2 w-64 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 z-50">
                          <!-- Existing Tags -->
                          <div v-if="tags.length > 0" class="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{{ t('common.tagsTitle') }}</p>
                            <div class="flex flex-wrap gap-1">
                              <span 
                                v-for="(tag, index) in tags" 
                                :key="index"
                                class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm"
                              >
                                {{ tag }}
                                <button
                                  @click="removeTag(index)"
                                  class="ml-1 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded p-0.5"
                                >
                                  <XMarkIcon class="w-3 h-3" />
                                </button>
                              </span>
                            </div>
                          </div>
                          
                          <!-- Empty State or Add New -->
                          <div class="px-3 py-2">
                            <div v-if="tags.length === 0" class="text-center py-2 mb-2">
                              <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('common.summaryNoTagsYet') }}</p>
                            </div>
                            <MenuItem v-slot="{ active }">
                <button
                  @click="showTagModal = true"
                                :class="[
                                  'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                                  active ? 'bg-gray-100 dark:bg-gray-700' : ''
                                ]"
                              >
                                <PlusIcon class="w-4 h-4" />
                                {{ tags.length > 0 ? t('common.summaryAddAnotherTag') : t('common.summaryAddTag') }}
                </button>
                            </MenuItem>
                          </div>
                        </MenuItems>
                      </transition>
                    </Menu>

                <!-- Copy URL Link -->
                <button
                  @click="copyUrl"
                      class="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  :title="t('common.summaryCopyLink')"
                >
                      <LinkIcon class="w-4 h-4" />
                </button>
                  </div>
                </div>
                
                <p v-if="record.subtitle" class="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
                  {{ record.subtitle }}
                </p>
              </div>
            </div>

            <!-- Right Group: Primary Record Actions -->
            <div class="flex items-center gap-3 justify-end md:justify-start flex-wrap">
              <!-- Status/Lifecycle Stage Dropdowns (Dynamic based on module) -->
              <Menu
                v-for="field in getLifecycleStatusFields"
                :key="field.key"
                as="div"
                class="relative"
              >
                <MenuButton 
                  :class="getButtonColorClasses(field)"
                  :style="getButtonColorStyle(field)"
                >
                  <span>{{ field.value || t('common.summarySelectPlaceholder') }}</span>
                </MenuButton>
                <Transition
                  enter-active-class="transition ease-out duration-100"
                  enter-from-class="transform opacity-0 scale-95"
                  enter-to-class="transform opacity-100 scale-100"
                  leave-active-class="transition ease-in duration-75"
                  leave-from-class="transform opacity-100 scale-100"
                  leave-to-class="transform opacity-0 scale-95"
                >
                  <MenuItems class="absolute left-0 mt-2 w-auto min-w-[12rem] rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 z-10" style="min-width: max(12rem, 100%)">
                    <div class="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {{ field.label }}
                    </div>
                    <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                    <MenuItem
                      v-for="option in field.options"
                      :key="typeof option === 'string' ? option : option.value"
                      v-slot="{ active }"
                      as="template"
                    >
                      <button
                        @click="handleHeaderFieldChange(field.key, typeof option === 'string' ? option : option.value)"
                        :class="[
                          'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center justify-between',
                          active ? 'bg-gray-100 dark:bg-gray-700' : '',
                          getOptionIsSelected(field, option) ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                        ]"
                      >
                        <div class="flex items-center gap-2">
                          <span v-if="getColorForOption(option)" class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: getColorForOption(option) }"></span>
                          <span>{{ typeof option === 'string' ? option : option.value }}</span>
                        </div>
                        <CheckIcon v-if="getOptionIsSelected(field, option)" class="h-5 w-5" />
                      </button>
                    </MenuItem>
                  </MenuItems>
                </Transition>
              </Menu>

              <!-- Add Relation Dropdown (Desktop only) - Hidden for forms -->
              <Menu v-if="props.recordType !== 'forms'" as="div" class="relative hidden lg:block">
                <MenuButton class="inline-flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium text-sm transition-colors border border-gray-200 dark:border-gray-600">
                    <PlusIcon class="w-4 h-4 mr-2" />
                    {{ t('common.summaryAddRelation') }}
                  <ChevronDownIcon class="ml-2 h-4 w-4" aria-hidden="true" />
                </MenuButton>
                <Transition
                  enter-active-class="transition ease-out duration-100"
                  enter-from-class="transform opacity-0 scale-95"
                  enter-to-class="transform opacity-100 scale-100"
                  leave-active-class="transition ease-in duration-75"
                  leave-from-class="transform opacity-100 scale-100"
                  leave-to-class="transform opacity-0 scale-95"
                >
                  <MenuItems class="absolute right-0 mt-2 w-56 origin-top-right rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 z-50">
                    <template v-for="relationship in availableRelationships" :key="relationship.moduleKey">
                      <MenuItem v-slot="{ active }" as="template">
                        <div :class="[
                          'px-4 py-2',
                          active ? 'bg-gray-50 dark:bg-gray-700/50' : ''
                        ]">
                          <div class="flex items-center justify-between mb-1">
                            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ relationship.label }}</span>
                          </div>
                          <div class="flex items-center gap-2 mt-1">
              <button
                              @click.stop="handleCreateRecord(relationship.moduleKey)"
                              class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                              <PlusIcon class="w-3.5 h-3.5" />
                              {{ t('actions.add') }}
              </button>
                            <button
                              @click.stop="handleLinkRecords(relationship.moduleKey)"
                              class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              <LinkIcon class="w-3.5 h-3.5" />
                              {{ t('actions.link') }}
                            </button>
                          </div>
                        </div>
                      </MenuItem>
                      <div v-if="relationship !== availableRelationships[availableRelationships.length - 1]" class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                    </template>
                  </MenuItems>
                </Transition>
              </Menu>

              <!-- Record Edit Button (Desktop only) - For forms: only show for Draft/Ready status -->
              <button
                v-if="props.recordType !== 'forms' || canEditForm(props.record?.status, props.record?.formType)"
                @click="openEditDrawer"
                class="hidden lg:inline-flex px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors items-center border border-gray-200 dark:border-gray-600"
              >
                <PencilSquareIcon class="w-4 h-4 mr-2" />
                {{ t('actions.edit') }}
              </button>

              <!-- View Responses Button (Forms only, Active status only, Desktop only) -->
              <button
                v-if="props.recordType === 'forms' && props.record?.status === 'Active'"
                @click="viewFormResponses"
                class="hidden lg:inline-flex px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors items-center border border-indigo-700 dark:border-indigo-600"
              >
                <DocumentTextIcon class="w-4 h-4 mr-2" />
                {{ t('common.summaryViewResponses') }}
              </button>

              <!-- More Dropdown -->
              <Menu as="div" class="relative">
                <MenuButton class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600">
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
                  <MenuItems class="absolute right-0 mt-2 w-48 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10">
                    <!-- Edit (Mobile/Tablet only) - For forms: only show for Draft/Ready status -->
                    <MenuItem v-if="props.recordType !== 'forms' || canEditForm(props.record?.status, props.record?.formType)" v-slot="{ active }" class="lg:hidden">
                      <button
                        @click="openEditDrawer"
                        :class="[
                          'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                          active ? 'bg-gray-100 dark:bg-gray-700' : '',
                          'text-gray-700 dark:text-gray-300'
                        ]"
                      >
                        <PencilSquareIcon class="w-4 h-4" />
                        {{ t('actions.edit') }}
                      </button>
                    </MenuItem>

                    <!-- View Responses (Forms only, Active status only, Mobile/Tablet only) -->
                    <MenuItem v-if="props.recordType === 'forms' && props.record?.status === 'Active'" v-slot="{ active }" class="lg:hidden">
                      <button
                        @click="viewFormResponses"
                        :class="[
                          'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                          active ? 'bg-gray-100 dark:bg-gray-700' : '',
                          'text-gray-700 dark:text-gray-300'
                        ]"
                      >
                        <DocumentTextIcon class="w-4 h-4" />
                        {{ t('common.summaryViewResponses') }}
                      </button>
                    </MenuItem>
                    
                    <!-- Add Relation Submenu (Mobile/Tablet only) - Hidden for forms -->
                    <template v-if="availableRelationships.length > 0 && props.recordType !== 'forms'">
                      <div class="lg:hidden border-t border-gray-200 dark:border-gray-700 my-1"></div>
                      <template v-for="relationship in availableRelationships" :key="relationship.moduleKey">
                        <div class="lg:hidden">
                          <MenuItem v-slot="{ active }" as="template">
                            <div :class="[
                              'px-4 py-2',
                              active ? 'bg-gray-50 dark:bg-gray-700/50' : ''
                            ]">
                              <div class="flex items-center justify-between mb-1">
                                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ relationship.label }}</span>
                              </div>
                              <div class="flex items-center gap-2 mt-1">
                      <button
                                  @click.stop="handleCreateRecord(relationship.moduleKey)"
                                  class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                  <PlusIcon class="w-3.5 h-3.5" />
                                  {{ t('actions.add') }}
                      </button>
                                <button
                                  @click.stop="handleLinkRecords(relationship.moduleKey)"
                                  class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                  <LinkIcon class="w-3.5 h-3.5" />
                                  {{ t('actions.link') }}
                                </button>
                              </div>
                            </div>
                    </MenuItem>
                        </div>
                        <div v-if="relationship !== availableRelationships[availableRelationships.length - 1]" class="lg:hidden border-t border-gray-200 dark:border-gray-700 my-1"></div>
                      </template>
                      <div class="lg:hidden border-t border-gray-200 dark:border-gray-700 my-1"></div>
                    </template>

                    <!-- Separator before form-specific actions -->
                    <div v-if="props.recordType === 'forms'" class="border-t border-gray-200 dark:border-gray-700 my-1"></div>

                    <!-- Duplicate (Forms only, always visible) -->
                    <MenuItem v-if="props.recordType === 'forms'" v-slot="{ active }">
                      <button
                        @click="$emit('duplicate')"
                        :class="[
                          'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                          active ? 'bg-gray-100 dark:bg-gray-700' : '',
                          'text-gray-700 dark:text-gray-300'
                        ]"
                      >
                        <Square2StackIcon class="w-4 h-4" />
                        {{ t('actions.duplicate') }}
                      </button>
                    </MenuItem>

                    <!-- Archive (Forms only, Draft status only) -->
                    <MenuItem v-if="props.recordType === 'forms' && props.record?.status === 'Draft'" v-slot="{ active }">
                      <button
                        @click="archiveForm"
                        :class="[
                          'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                          active ? 'bg-gray-100 dark:bg-gray-700' : '',
                          'text-gray-700 dark:text-gray-300'
                        ]"
                      >
                        <ArchiveBoxIcon class="w-4 h-4" />
                        {{ t('actions.archive') }}
                      </button>
                    </MenuItem>

                    <!-- Delete Record (For forms: only Draft status, for other types: always visible) -->
                    <MenuItem v-if="props.recordType !== 'forms' || props.record?.status === 'Draft'" v-slot="{ active }">
                      <button
                        @click="$emit('delete')"
                        :class="[
                          'w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                          active ? 'bg-gray-100 dark:bg-gray-700' : '',
                          'text-red-600 dark:text-red-400'
                        ]"
                      >
                        {{ t('common.summaryDeleteRecord') }}
                      </button>
                    </MenuItem>
                  </MenuItems>
                </transition>
              </Menu>
            </div>
          </div>
        </div>

        <!-- Tabs Component - Fixed below header -->
        <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div class="px-6">
            <nav class="flex space-x-8" :aria-label="t('common.summaryTabsAria')">
              <!-- Fixed Default Tabs -->
              <button
                v-for="tab in fixedTabs"
                :key="tab.id"
                @click="activeTab = tab.id"
                :class="[
                  'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                ]"
              >
                {{ tab.name }}
              </button>

            </nav>
          </div>
        </div>
      </div>

      <!-- Tab Content -->
      <div :class="tabContentPadding">
        <!-- Summary Tab with GridStack Dashboard -->
        <div v-if="activeTab === 'summary'" class="">
          <!-- For forms: Show empty state if not Active -->
          <div v-if="props.recordType === 'forms' && props.record?.status !== 'Active'" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <div class="max-w-md mx-auto">
              <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <DocumentTextIcon class="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('common.summaryFormNotActive') }}</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
                {{ t('common.summaryFormNotActiveHint') }}
              </p>
            </div>
          </div>

          <!-- GridStack Container (for Active forms or non-form records) -->
          <div v-else ref="gridStackContainer" class="grid-stack bg-gray-100/70 dark:bg-gray-900 sm:p-3">
            <!-- Widgets will be rendered here by GridStack -->
          </div>

          <!-- Floating Add Widget Button (hidden for non-Active forms) -->
          <div v-if="props.recordType !== 'forms' || props.record?.status === 'Active'" class="fixed bottom-6 right-6 z-50">
            <button
              @click="showWidgetModal = true"
              class="inline-flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-medium transition-colors shadow-lg hover:shadow-xl"
              :title="t('common.summaryAddCustomWidget')"
            >
              <PlusIcon class="w-5 h-5" />
              <span class="hidden sm:inline">{{ t('common.summaryAddWidget') }}</span>
            </button>
          </div>
        </div>

        <!-- Tenant Details Tab (only for tenant organizations) -->
        <div v-else-if="activeTab === 'tenant-details' && props.record?.isTenant === true" class="space-y-6">
          <!-- Top Bar: Search and Toggle -->
          <div class="flex items-center justify-between mb-4">
            <!-- Search Field -->
            <div class="relative w-100">
              <input
                v-model="detailsSearch"
                type="text"
                :placeholder="t('common.summarySearchTenantFields')"
                class="block w-full rounded-md bg-white border border-gray-200 dark:bg-gray-700 dark:border-transparent px-3 py-1.5 pl-10 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:focus:outline-indigo-500"
              />
              <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <MagnifyingGlassIcon class="w-5 h-5 text-gray-400" />
              </div>
            </div>
            
            <!-- Right Side: Toggle -->
            <div class="flex items-center gap-3">
              <label class="hidden lg:flex items-center gap-2 cursor-pointer">
                <HeadlessCheckbox
                  v-model="showEmptyFields"
                  checkbox-class="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('common.summaryShowEmptyFields') }}</span>
              </label>
            </div>
          </div>

          <!-- Tenant Fields Block -->
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div class="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('common.summaryTenantFields') }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('common.summaryTenantFieldsHint') }}</p>
            </div>
            <!-- Tenant Fields Grid -->
            <div :class="detailsGridClass" :style="detailsGridStyle">
              <div 
                v-for="fieldData in getTenantFields" 
                :key="fieldData.key"
                :class="[
                  fieldData.field.dataType === 'Text-Area' || 
                  fieldData.field.dataType === 'Rich Text' ||
                  fieldData.field.dataType === 'Image'
                    ? 'md:col-span-2' 
                    : ''
                ]"
              >
<DynamicFormField
@picklist-option-created="onPicklistOptionCreated"
                  :field="fieldData.field"
                  :value="fieldData.value"
                  @update:value="updateField(fieldData.key, $event)"
                  @blur="saveFieldOnBlur(fieldData.key)"
                  :errors="fieldErrors"
                  :dependency-state="fieldData.dependencyState"
                />
              </div>
              
              <!-- Empty state -->
              <div v-if="getTenantFields.length === 0" class="md:col-span-2 text-center py-8 text-gray-500 dark:text-gray-400">
                <p v-if="detailsSearch">{{ t('common.summaryTenantFieldsNoMatch') }}</p>
                <p v-else-if="!showEmptyFields">{{ t('common.summaryTenantFieldsNoValues') }}</p>
                <p v-else>{{ t('common.summaryTenantFieldsNone') }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Details Tab -->
        <div v-else-if="activeTab === 'details'" class="space-y-6">
          <slot name="details-prefix" />
                        <!-- Top Bar: Search, Toggle, and Manage Button -->
                        <div class="flex items-center justify-between mb-4">
              <!-- Search Field -->
              <div class="relative w-100">
                <input
                  v-model="detailsSearch"
                  type="text"
                  :placeholder="t('common.summarySearchFields')"
                  class="block w-full rounded-md bg-white border border-gray-200 dark:bg-gray-700 dark:border-transparent px-3 py-1.5 pl-10 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:focus:outline-indigo-500"
                />
                <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <MagnifyingGlassIcon class="w-5 h-5 text-gray-400" />
                </div>
              </div>
              
              <!-- Right Side: Toggle and Manage Button -->
              <div class="flex items-center gap-3">
                <!-- Show empty fields toggle (Desktop only) -->
                <div class="hidden lg:flex items-center gap-2">
                  <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('common.summaryShowEmptyFields') }}</span>
                  <Switch
                    v-model="showEmptyFields"
                    :class="[
                      showEmptyFields ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600',
                      'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                    ]"
                  >
                    <span class="sr-only">{{ t('common.summaryShowEmptyFields') }}</span>
                    <span
                      aria-hidden="true"
                      :class="[
                        showEmptyFields ? 'translate-x-4' : 'translate-x-0',
                        'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition'
                      ]"
                    />
                  </Switch>
                </div>
                
                <!-- Manage Fields Button (Desktop only) -->
                <div v-if="hasManageFieldsPermission" class="hidden lg:block">
                  <PermissionButton
                    module="settings"
                    action="edit"
                    variant="secondary"
                    class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    icon="cog"
                    @click="goToManageFields"
                  >
                    {{ t('common.summaryManageFields') }}
                  </PermissionButton>
                </div>

                <!-- More Dropdown (Mobile/Tablet only) -->
                <Menu as="div" class="relative lg:hidden">
                  <MenuButton class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
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
                    <MenuItems class="absolute right-0 mt-2 w-48 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 z-50">
                      <!-- Show empty fields toggle -->
                      <MenuItem v-slot="{ active }" as="template">
                        <div :class="['flex items-center justify-between gap-3 px-4 py-2', active ? 'bg-gray-100 dark:bg-gray-700' : '']">
                          <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('common.summaryShowEmptyFields') }}</span>
                          <Switch
                            v-model="showEmptyFields"
                            :class="[
                              showEmptyFields ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600',
                              'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                            ]"
                            @click.stop
                          >
                            <span class="sr-only">{{ t('common.summaryShowEmptyFields') }}</span>
                            <span
                              aria-hidden="true"
                              :class="[
                                showEmptyFields ? 'translate-x-4' : 'translate-x-0',
                                'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition'
                              ]"
                            />
                          </Switch>
                        </div>
                      </MenuItem>
                      
                      <!-- Manage Fields (only if user has permission) -->
                      <MenuItem v-slot="{ active }" v-if="hasManageFieldsPermission" as="template">
                  <button
                          @click="goToManageFields"
                          :class="[
                            'w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
                            active ? 'bg-gray-100 dark:bg-gray-700' : '',
                            'text-gray-700 dark:text-gray-300'
                          ]"
                        >
                          <Cog6ToothIcon class="w-4 h-4" />
                          {{ t('common.summaryManageFields') }}
                  </button>
                      </MenuItem>
                    </MenuItems>
                  </transition>
                </Menu>
                </div>
              </div>
          <!-- CRM Fields Block -->
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <!-- Fields Grid using DynamicFormField -->
            <div :class="detailsGridClass" :style="detailsGridStyle">
              <div 
                v-for="fieldData in getFieldsWithDefinitions" 
                :key="fieldData.key"
                :class="[
                  fieldData.field.dataType === 'Text-Area' || 
                  fieldData.field.dataType === 'Rich Text' 
                    ? 'md:col-span-2' 
                    : ''
                ]"
              >
                <!-- Special handling for createdBy field -->
                <div v-if="fieldData.key?.toLowerCase() === 'createdby'" class="mt-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ fieldData.field.label || fieldData.field.key }}
                  </label>
                  <div class="flex items-center gap-2">
                    <template v-if="fieldData.value && typeof fieldData.value === 'object' && fieldData.value !== null && !Array.isArray(fieldData.value) && fieldData.value._id">
                      <!-- Populated user object -->
                      <div v-if="fieldData.value.avatar" class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                        <img :src="fieldData.value.avatar" :alt="getUserDisplayName(fieldData.value)" class="w-full h-full object-cover" />
            </div>
                      <div v-else class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {{ getUserInitials(fieldData.value) }}
                      </div>
                      <span class="text-sm text-gray-900 dark:text-white">{{ getUserDisplayName(fieldData.value) }}</span>
                    </template>
                    <template v-else-if="fieldData.value && (typeof fieldData.value === 'string' || (typeof fieldData.value === 'object' && fieldData.value && !fieldData.value._id))">
                      <!-- Unpopulated ObjectId string or invalid object - this shouldn't happen if backend populates correctly -->
                      <div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 text-xs font-semibold flex-shrink-0">
                        ?
                      </div>
                      <span class="text-sm text-gray-500 dark:text-gray-400 italic">{{ t('common.summaryNotAvailable') }}</span>
                    </template>
                    <template v-else>
                      <!-- No createdBy value -->
                      <span class="text-sm text-gray-400 dark:text-gray-500">-</span>
                    </template>
                  </div>
                </div>
                <!-- Regular field rendering -->
<DynamicFormField
@picklist-option-created="onPicklistOptionCreated"
                  v-else
                  :field="fieldData.field"
                  :value="fieldData.value"
                  @update:value="updateField(fieldData.key, $event)"
                  @blur="saveFieldOnBlur(fieldData.key)"
                  :errors="fieldErrors"
                  :dependency-state="fieldData.dependencyState"
                />
              </div>
              
              <!-- Empty state -->
              <div v-if="getFieldsWithDefinitions.length === 0" class="md:col-span-2 text-center py-8 text-gray-500 dark:text-gray-400">
                <p v-if="detailsSearch">{{ t('common.summaryFieldsNoMatch') }}</p>
                <p v-else-if="!showEmptyFields">{{ t('common.summaryFieldsNoValues') }}</p>
                <p v-else>{{ t('common.summaryFieldsNone') }}</p>
              </div>
            </div>
          </div>

        </div>

        <!-- Usage Tab (Forms only, Active status only) -->
        <div v-else-if="activeTab === 'usage' && props.recordType === 'forms' && props.record?.status === 'Active'" class="space-y-4">
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div class="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('common.summaryFormUsage') }}</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ t('common.summaryFormUsageHint') }}
              </p>
            </div>
            
            <!-- Loading State -->
            <div v-if="formResponsesLoading" class="p-12 text-center">
              <div class="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('common.summaryLoadingSubmissions') }}</p>
            </div>
            
            <!-- Submissions Table -->
            <div v-else-if="formResponses.length > 0" class="overflow-x-auto">
              <table class="w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('common.summaryColSubmitted') }}</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('common.summaryColSubmittedBy') }}</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('common.summaryColStatus') }}</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('common.summaryColScore') }}</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('common.summaryColActions') }}</th>
                  </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  <tr 
                    v-for="response in formResponses" 
                    :key="response._id"
                    class="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                    @click="viewResponseDetail(response)"
                  >
                    <td class="px-6 py-4 whitespace-nowrap">
                      <DateCell :value="response.submittedAt" format="short" />
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div v-if="response.submittedBy" class="flex items-center gap-2">
                        <Avatar
                          :user="{
                            firstName: response.submittedBy.firstName,
                            lastName: response.submittedBy.lastName,
                            email: response.submittedBy.email,
                            avatar: response.submittedBy.avatar
                          }"
                          size="sm"
                        />
                        <span class="text-sm text-gray-900 dark:text-white">
                          {{ response.submittedBy.firstName }} {{ response.submittedBy.lastName }}
                        </span>
                      </div>
                      <span v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('common.summaryAnonymous') }}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <BadgeCell 
                        :value="response.status" 
                        :variant-map="{
                          'New': 'default',
                          'Pending Corrective Action': 'warning',
                          'Needs Auditor Review': 'info',
                          'Approved': 'success',
                          'Rejected': 'danger',
                          'Closed': 'default'
                        }"
                      />
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div v-if="response.sectionScores && typeof response.sectionScores === 'object'" class="text-sm">
                        <span class="text-gray-900 dark:text-white font-medium">
                          {{ calculateOverallScore(response.sectionScores) }}%
                        </span>
                      </div>
                      <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        @click.stop="viewResponseDetail(response)"
                        class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                      >
                        {{ t('common.viewRecord') }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              
              <!-- Pagination -->
              <div v-if="formResponsesPagination.totalPages > 1" class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div class="text-sm text-gray-700 dark:text-gray-300">
                  Showing page {{ formResponsesPagination.currentPage }} of {{ formResponsesPagination.totalPages }}
                </div>
                <div class="flex gap-2">
                  <button
                    @click="formResponsesPagination.currentPage > 1 && (formResponsesPagination.currentPage--, fetchFormResponses())"
                    :disabled="formResponsesPagination.currentPage === 1"
                    class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {{ t('actions.previous') }}
                  </button>
                  <button
                    @click="formResponsesPagination.currentPage < formResponsesPagination.totalPages && (formResponsesPagination.currentPage++, fetchFormResponses())"
                    :disabled="formResponsesPagination.currentPage >= formResponsesPagination.totalPages"
                    class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {{ t('actions.next') }}
                  </button>
                </div>
              </div>
            </div>
            
            <!-- Empty State -->
            <div v-else class="p-12 text-center">
              <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <DocumentTextIcon class="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('common.summaryNoSubmissions') }}</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ t('common.summaryNoSubmissionsHint') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Preview Tab (Forms only) -->
        <div v-else-if="activeTab === 'preview' && props.recordType === 'forms'" class="space-y-4">
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div class="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('common.summaryFormPreview') }}</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ t('common.summaryFormPreviewHint') }}
              </p>
            </div>
            
            <div class="p-6">
              <FormPreview
                :form="props.record"
                :readOnly="true"
              />
            </div>
          </div>
        </div>

        <!-- Responses Tab (Forms only, Active status only) -->
        <div v-else-if="activeTab === 'responses' && props.recordType === 'forms' && props.record?.status === 'Active'" class="space-y-4">
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div class="p-6 border-b border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('common.summaryFormResponses') }}</h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    {{ t('common.summaryFormResponsesHint') }}
                  </p>
                </div>
                <button
                  @click="viewFormResponses"
                  class="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                >
                  {{ t('common.summaryViewAllResponses') }} →
                </button>
              </div>
            </div>
            
            <!-- Loading State -->
            <div v-if="formResponsesLoading" class="p-12 text-center">
              <div class="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('common.summaryLoadingResponses') }}</p>
            </div>
            
            <!-- Responses Table -->
            <div v-else-if="formResponses.length > 0" class="overflow-x-auto">
              <table class="w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('common.summaryColSubmitted') }}</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('common.summaryColSubmittedBy') }}</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('common.summaryColStatus') }}</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('common.summaryColScore') }}</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('common.summaryColKpis') }}</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('common.summaryColActions') }}</th>
                  </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  <tr 
                    v-for="response in formResponses" 
                    :key="response._id"
                    class="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                    @click="viewResponseDetail(response)"
                  >
                    <td class="px-6 py-4 whitespace-nowrap">
                      <DateCell :value="response.submittedAt" format="short" />
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div v-if="response.submittedBy" class="flex items-center gap-2">
                        <Avatar
                          :user="{
                            firstName: response.submittedBy.firstName,
                            lastName: response.submittedBy.lastName,
                            email: response.submittedBy.email,
                            avatar: response.submittedBy.avatar
                          }"
                          size="sm"
                        />
                        <span class="text-sm text-gray-900 dark:text-white">
                          {{ response.submittedBy.firstName }} {{ response.submittedBy.lastName }}
                        </span>
                      </div>
                      <span v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('common.summaryAnonymous') }}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <BadgeCell 
                        :value="response.status" 
                        :variant-map="{
                          'New': 'default',
                          'Pending Corrective Action': 'warning',
                          'Needs Auditor Review': 'info',
                          'Approved': 'success',
                          'Rejected': 'danger',
                          'Closed': 'default'
                        }"
                      />
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div v-if="response.sectionScores && typeof response.sectionScores === 'object'" class="text-sm">
                        <span class="text-gray-900 dark:text-white font-medium">
                          {{ calculateOverallScore(response.sectionScores) }}%
                        </span>
                      </div>
                      <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
                    </td>
                    <td class="px-6 py-4">
                      <div v-if="response.kpis && typeof response.kpis === 'object'" class="text-xs space-y-0.5">
                        <div v-if="response.kpis.compliancePercentage !== undefined" class="text-gray-700 dark:text-gray-300">
                          Compliance: {{ response.kpis.compliancePercentage }}%
                        </div>
                        <div v-if="response.kpis.avgRating !== undefined" class="text-gray-700 dark:text-gray-300">
                          Rating: {{ response.kpis.avgRating }}/5
                        </div>
                        <div v-if="response.kpis.passRate !== undefined" class="text-gray-700 dark:text-gray-300">
                          Pass: {{ response.kpis.passRate }}%
                        </div>
                      </div>
                      <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        @click.stop="viewResponseDetail(response)"
                        class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                      >
                        {{ t('common.viewRecord') }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              
              <!-- Pagination -->
              <div v-if="formResponsesPagination.totalPages > 1" class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div class="text-sm text-gray-700 dark:text-gray-300">
                  Showing page {{ formResponsesPagination.currentPage }} of {{ formResponsesPagination.totalPages }}
                </div>
                <div class="flex gap-2">
                  <button
                    @click="formResponsesPagination.currentPage > 1 && (formResponsesPagination.currentPage--, fetchFormResponses())"
                    :disabled="formResponsesPagination.currentPage === 1"
                    class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {{ t('actions.previous') }}
                  </button>
                  <button
                    @click="formResponsesPagination.currentPage < formResponsesPagination.totalPages && (formResponsesPagination.currentPage++, fetchFormResponses())"
                    :disabled="formResponsesPagination.currentPage >= formResponsesPagination.totalPages"
                    class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {{ t('actions.next') }}
                  </button>
                </div>
              </div>
              
              <!-- View All Link -->
              <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 text-center">
                <button
                  @click="viewFormResponses"
                  class="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  {{ t('common.summaryViewAllResponses') }} →
                </button>
              </div>
            </div>
            
            <!-- Empty State -->
            <div v-else class="p-12 text-center">
              <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <DocumentTextIcon class="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('common.summaryNoResponses') }}</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {{ t('common.summaryNoResponsesHint') }}
              </p>
              <button
                @click="viewFormResponses"
                class="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
              >
                {{ t('common.summaryViewAllResponses') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Updates/Timeline Tab -->
        <div v-else-if="activeTab === 'updates'" class="space-y-4">
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <!-- Filters -->
            <div class="mb-6 flex justify-end">
              <Menu as="div" class="relative">
                <MenuButton class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                  <FunnelIcon class="w-5 h-5" />
                  <span>{{ t('common.listFilters') }}</span>
                  <ChevronDownIcon class="w-4 h-4" />
                </MenuButton>
                <Transition
                  enter-active-class="transition duration-100 ease-out"
                  enter-from-class="transform scale-95 opacity-0"
                  enter-to-class="transform scale-100 opacity-100"
                  leave-active-class="transition duration-75 ease-in"
                  leave-from-class="transform scale-100 opacity-100"
                  leave-to-class="transform scale-95 opacity-0"
                >
                  <MenuItems class="absolute right-0 mt-2 w-80 origin-top-right bg-white dark:bg-gray-800 rounded-lg shadow-xl ring-1 ring-black/5 dark:ring-white/10 focus:outline-none z-10">
                    <div class="p-4 space-y-4">
                      <!-- Search -->
                      <div>
                        <label for="activity-search" class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('actions.search') }}</label>
                        <div class="relative mt-1">
                          <MagnifyingGlassIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                          <input
                            id="activity-search"
                            v-model="activitySearchQuery"
                            type="text"
                            :placeholder="t('common.summarySearchActivities')"
                            class="block w-full rounded-md bg-gray-100 px-3 py-2 pl-10 text-gray-900 text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:text-white dark:bg-gray-700 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                          />
                  </div>
                </div>
                      
                      <!-- User Filter -->
                      <div>
                        <label for="activity-user" class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('common.summaryUser') }}</label>
                        <Listbox v-model="activityFilterUser" as="div" class="mt-1 relative">
                          <ListboxButton
                            class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500 relative cursor-default text-left"
                          >
                            <span :class="['block truncate', !activityFilterUser && 'text-gray-500 dark:text-gray-500']">{{ activityFilterUser || 'All Users' }}</span>
                            <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <ChevronUpDownIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                            </span>
                          </ListboxButton>
                          <Transition
                            leave-active-class="transition duration-100 ease-in"
                            leave-from-class="opacity-100"
                            leave-to-class="opacity-0"
                          >
                            <ListboxOptions class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm">
                              <ListboxOption
                                v-slot="{ active, selected }"
                                :value="''"
                              >
                                <li
                                  :class="[
                                    'relative cursor-default select-none py-2 pl-10 pr-4',
                                    active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                                  ]"
                                >
                                  <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">{{ t('common.summaryAllUsers') }}</span>
                                  <span
                                    v-if="selected"
                                    class="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600 dark:text-indigo-400"
                                  >
                                    <CheckIcon class="h-5 w-5" aria-hidden="true" />
                                  </span>
                                </li>
                              </ListboxOption>
                              <ListboxOption
                                v-for="user in uniqueActivityUsers"
                                :key="user"
                                :value="user"
                                v-slot="{ active, selected }"
                              >
                                <li
                                  :class="[
                                    'relative cursor-default select-none py-2 pl-10 pr-4',
                                    active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                                  ]"
                                >
                                  <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">{{ user }}</span>
                                  <span
                                    v-if="selected"
                                    class="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600 dark:text-indigo-400"
                                  >
                                    <CheckIcon class="h-5 w-5" aria-hidden="true" />
                                  </span>
                                </li>
                              </ListboxOption>
                            </ListboxOptions>
                          </Transition>
                        </Listbox>
                </div>
                      
                      <!-- Type Filter -->
                      <div>
                        <label for="activity-type" class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('common.summaryType') }}</label>
                        <Listbox v-model="activityFilterType" as="div" class="mt-1 relative">
                          <ListboxButton
                            class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500 relative cursor-default text-left"
                          >
                            <span :class="['block truncate', !activityFilterType && 'text-gray-500 dark:text-gray-500']">{{ activityFilterType || 'All Types' }}</span>
                            <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <ChevronUpDownIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                            </span>
                          </ListboxButton>
                          <Transition
                            leave-active-class="transition duration-100 ease-in"
                            leave-from-class="opacity-100"
                            leave-to-class="opacity-0"
                          >
                            <ListboxOptions class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm">
                              <ListboxOption
                                v-slot="{ active, selected }"
                                :value="''"
                              >
                                <li
                                  :class="[
                                    'relative cursor-default select-none py-2 pl-10 pr-4',
                                    active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                                  ]"
                                >
                                  <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">{{ t('common.summaryAllTypes') }}</span>
                                  <span
                                    v-if="selected"
                                    class="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600 dark:text-indigo-400"
                                  >
                                    <CheckIcon class="h-5 w-5" aria-hidden="true" />
                                  </span>
                                </li>
                              </ListboxOption>
                              <ListboxOption
                                v-slot="{ active, selected }"
                                value="comment"
                              >
                                <li
                                  :class="[
                                    'relative cursor-default select-none py-2 pl-10 pr-4',
                                    active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                                  ]"
                                >
                                  <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">{{ t('common.summaryComments') }}</span>
                                  <span
                                    v-if="selected"
                                    class="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600 dark:text-indigo-400"
                                  >
                                    <CheckIcon class="h-5 w-5" aria-hidden="true" />
                                  </span>
                                </li>
                              </ListboxOption>
                              <ListboxOption
                                v-slot="{ active, selected }"
                                value="assignment"
                              >
                                <li
                                  :class="[
                                    'relative cursor-default select-none py-2 pl-10 pr-4',
                                    active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                                  ]"
                                >
                                  <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">{{ t('common.summaryFieldChanges') }}</span>
                                  <span
                                    v-if="selected"
                                    class="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600 dark:text-indigo-400"
                                  >
                                    <CheckIcon class="h-5 w-5" aria-hidden="true" />
                                  </span>
                                </li>
                              </ListboxOption>
                              <ListboxOption
                                v-slot="{ active, selected }"
                                value="tags"
                              >
                                <li
                                  :class="[
                                    'relative cursor-default select-none py-2 pl-10 pr-4',
                                    active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                                  ]"
                                >
                                  <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">{{ t('common.tagsTitle') }}</span>
                                  <span
                                    v-if="selected"
                                    class="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600 dark:text-indigo-400"
                                  >
                                    <CheckIcon class="h-5 w-5" aria-hidden="true" />
                                  </span>
                                </li>
                              </ListboxOption>
                            </ListboxOptions>
                          </Transition>
                        </Listbox>
              </div>
                    </div>
                  </MenuItems>
                </Transition>
              </Menu>
            </div>
            
            <div v-if="activityItems.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
                {{ t('common.summaryNoActivity') }}
              </div>
            <div v-else class="flow-root">
              <div class="max-w-2xl mx-auto">
              <ul role="list" class="-mb-8">
                <li v-for="(activityItem, activityItemIdx) in activityItems" :key="activityItem.id">
                  <div class="relative pb-8">
                    <span v-if="activityItemIdx !== activityItems.length - 1" class="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true"></span>
                    <div class="relative flex items-start space-x-3">
                      <template v-if="activityItem.type === 'comment'">
                        <div class="relative">
                          <div :class="['flex size-10 items-center justify-center rounded-full ring-8 ring-white dark:ring-gray-800 outline -outline-offset-1 outline-black/5 dark:outline-white/5', getColorForName(activityItem.person.name).bg]">
                            <span :class="['text-sm font-medium', getColorForName(activityItem.person.name).text]">
                              {{ getInitials(activityItem.person.name) }}
                            </span>
            </div>
                          <span class="absolute -right-1 -bottom-0.5 rounded-tl bg-white dark:bg-gray-800 px-0.5 py-px">
                            <ChatBubbleLeftEllipsisIcon class="size-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                          </span>
                </div>
                        <div class="min-w-0 flex-1">
                          <div>
                            <div class="text-sm">
                              <span class="font-medium text-gray-900 dark:text-white">{{ activityItem.person.name }}</span>
              </div>
                            <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ activityItem.date }}</p>
              </div>
                          <div class="mt-2 text-sm text-gray-700 dark:text-gray-300">
                            <p>
                              {{ activityItem.displayComment || activityItem.comment }}
                              <template v-if="activityItem.linkItems && activityItem.linkItems.length === 1">
                                {{ ' ' }}
                                <a
                                  :href="activityItem.linkItems[0].href"
                                  @click.prevent="handleActivityLinkClick(activityItem.linkItems[0])"
                                  class="text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-xs cursor-pointer"
                                >
                                  {{ activityItem.linkItems[0].text }}
                                </a>
                              </template>
                            </p>
                            <div v-if="activityItem.linkItems && activityItem.linkItems.length > 1" class="mt-2 flex flex-wrap gap-2">
                              <a 
                                v-for="(li, liIdx) in activityItem.linkItems" 
                                :key="liIdx" 
                                :href="li.href" 
                                @click.prevent="handleActivityLinkClick(li)"
                                class="text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-xs cursor-pointer"
                              >
                                {{ li.text }}
                              </a>
                            </div>
                          </div>
                        </div>
                      </template>
                      <template v-else-if="activityItem.type === 'assignment'">
                        <div>
                          <div class="relative px-1">
                            <div class="flex size-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 ring-8 ring-white dark:ring-gray-800">
                              <UserCircleIcon class="size-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                            </div>
                          </div>
                        </div>
                        <div class="min-w-0 flex-1 py-1.5">
                          <div>
                            <div class="text-sm">
                              <span class="font-medium text-gray-900 dark:text-white">{{ activityItem.person.name }}</span>
                              {{ ' ' }}
                              <span class="text-gray-500 dark:text-gray-400">{{ activityItem.action }}</span>
                              {{ ' ' }}
                              <span class="font-medium text-gray-900 dark:text-white">{{ activityItem.fieldName || '' }}</span>
                              {{ ' ' }}
                              <span class="whitespace-nowrap text-gray-500 dark:text-gray-400">{{ activityItem.date }}</span>
                            </div>
                            <!-- Display multiple changes as a list -->
                            <div v-if="activityItem.multipleChanges && activityItem.multipleChanges.length > 0" class="mt-2 space-y-1">
                              <div 
                                v-for="(change, changeIdx) in activityItem.multipleChanges" 
                                :key="changeIdx"
                                class="text-sm text-gray-700 dark:text-gray-300 pl-4 border-l-2 border-gray-200 dark:border-gray-600"
                              >
                                <span class="font-medium text-gray-900 dark:text-white">{{ change.field }}</span>
                                <span v-if="change.action === 'set'">
                                  : set to "<span class="font-medium">{{ change.newValue }}</span>"
                                </span>
                                <span v-else-if="change.action === 'changed'">
                                  : changed from "<span class="font-medium">{{ change.oldValue }}</span>" to "<span class="font-medium">{{ change.newValue }}</span>"
                                </span>
                                <span v-else-if="change.action === 'cleared'">
                                  : cleared (was "<span class="font-medium">{{ change.oldValue }}</span>")
                                </span>
                                <span v-else-if="change.description">
                                  : {{ change.description }}
                                </span>
                              </div>
                            </div>
                            <!-- Single change comment (fallback) -->
                            <div v-else-if="activityItem.comment && activityItem.comment !== activityItem.action" class="mt-1 text-sm text-gray-700 dark:text-gray-300">
                              <p>{{ activityItem.comment }}</p>
                            </div>
                          </div>
                        </div>
                      </template>
                      <template v-else-if="activityItem.type === 'tags'">
                        <div>
                          <div class="relative px-1">
                            <div class="flex size-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 ring-8 ring-white dark:ring-gray-800">
                              <TagIconSolid class="size-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                            </div>
                          </div>
                        </div>
                        <div class="min-w-0 flex-1 py-0">
                          <div class="text-sm/8 text-gray-500 dark:text-gray-400">
                            <span class="mr-0.5">
                              <span class="font-medium text-gray-900 dark:text-white">{{ activityItem.person.name }}</span>
                              {{ ' ' }}
                              {{ activityItem.action }}
                            </span>
                            {{ ' ' }}
                            <span class="mr-0.5">
                              <template v-for="tag in activityItem.tags" :key="tag.name">
                                <span :class="['inline-flex items-center gap-x-1.5 rounded-full px-2 py-1 text-xs font-medium', getDefaultTagChipClass(tag)]">
                                  <svg :class="[getDefaultTagDotClass(tag), 'size-1.5']" viewBox="0 0 6 6" aria-hidden="true">
                                    <circle cx="3" cy="3" r="3" />
                                  </svg>
                                  {{ tag.name }}
                                </span>
                                {{ ' ' }}
                              </template>
                            </span>
                            <span class="whitespace-nowrap">{{ activityItem.date }}</span>
                  </div>
                </div>
                      </template>
                </div>
              </div>
                </li>
              </ul>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Widget Management Modal -->
    <!-- Add Widget Drawer -->
    <TransitionRoot as="template" :show="showWidgetModal">
      <Dialog class="relative z-50" @close="showWidgetModal = false">
        <!-- Background overlay -->
        <TransitionChild
          as="template"
          enter="ease-out duration-200"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-200"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-hidden">
          <div class="absolute inset-0 overflow-hidden">
            <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <TransitionChild 
                as="template" 
                enter="transform transition ease-in-out duration-300 sm:duration-300" 
                enter-from="translate-x-full" 
                enter-to="translate-x-0" 
                leave="transform transition ease-in-out duration-300 sm:duration-300" 
                leave-from="translate-x-0" 
                leave-to="translate-x-full"
              >
                <DialogPanel class="pointer-events-auto w-screen max-w-2xl">
                  <div class="rounded-tl-xl overflow-hidden relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 shadow-xl">
                    <!-- Header -->
                    <div class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-6 sm:px-6">
                      <div class="flex items-center justify-between">
                        <DialogTitle class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{{ t('common.summaryAddWidget') }}</DialogTitle>
                        <div class="ml-3 flex h-7 items-center">
              <button
                            type="button" 
                            class="relative rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer" 
                            @click="showWidgetModal = false"
                          >
                            <span class="absolute -inset-2.5"></span>
                            <span class="sr-only">{{ t('common.closePanel') }}</span>
                            <XMarkIcon class="size-6" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <div class="mt-1">
                        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('common.summarySelectWidget') }}</p>
                      </div>
                    </div>

                    <!-- Body -->
                    <div class="flex-1 overflow-y-auto p-6">
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div
                v-for="widget in availableWidgets"
                :key="widget.type"
                          :class="[
                            'p-4 border rounded-lg text-left transition-colors relative',
                            isWidgetAdded(widget.type) 
                              ? 'border-gray-300 dark:border-gray-500 bg-gray-50 dark:bg-gray-700/50' 
                              : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                          ]"
                        >
                          <div class="flex items-start justify-between gap-3">
                            <div class="flex items-center space-x-3 flex-1 min-w-0">
                              <div class="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <LinkIcon class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                              <div class="min-w-0 flex-1">
                    <h4 class="text-sm font-medium text-gray-900 dark:text-white">{{ widget.name }}</h4>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ widget.description }}</p>
                  </div>
                </div>
                            <div class="flex-shrink-0">
                              <button
                                v-if="isWidgetAdded(widget.type)"
                                @click="removeWidget(widget.type)"
                                class="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                {{ t('actions.remove') }}
                              </button>
                              <button
                                v-else
                                @click="addWidget(widget.type)"
                                class="px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                              >
                                {{ t('actions.add') }}
              </button>
            </div>
          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Footer -->
                    <div class="flex shrink-0 justify-between items-center gap-3 px-4 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                      <button 
                        type="button" 
                        :disabled="!hasLayoutChanges"
                        :class="[
                          'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                          hasLayoutChanges
                            ? 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        ]"
                        @click="resetToDefaultLayout"
                        :title="t('common.summaryResetLayoutTooltip')"
                      >
                        {{ t('common.summaryResetToDefault') }}
                      </button>
                      <div class="flex gap-3">
                        <button 
                          type="button" 
                          class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700" 
                          @click="showWidgetModal = false"
                        >
                          {{ t('actions.close') }}
                        </button>
                      </div>
                    </div>
        </div>
                </DialogPanel>
              </TransitionChild>
      </div>
    </div>
        </div>
      </Dialog>
    </TransitionRoot>

    <!-- Tag Modal -->
    <div v-if="showTagModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="showTagModal = false"></div>
        <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div class="px-6 py-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">{{ t('common.summaryAddTag') }}</h3>
            <input
              v-model="newTag"
              @keyup.enter="addTag"
              type="text"
              :placeholder="t('common.tagsEnterTagName')"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div class="px-6 py-3 bg-gray-50 dark:bg-gray-700 flex justify-end space-x-3">
            <button @click="showTagModal = false" class="px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 font-medium">
              {{ t('actions.cancel') }}
            </button>
            <button @click="addTag" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
              {{ t('actions.add') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Record Drawer -->
  <CreateRecordDrawer
    :isOpen="showCreateDrawer"
    :moduleKey="createDrawerModuleKey"
    :initialData="createDrawerInitialData"
    :record="createDrawerRecord"
    :title="getCreateDrawerTitle()"
    @close="handleCreateDrawerClose"
    @saved="handleCreateDrawerSaved"
  />
  
  <!-- Link Records Drawer -->
  <LinkRecordsDrawer
    :isOpen="showLinkDrawer"
    :moduleKey="linkDrawerModuleKey"
    :multiple="true"
    :title="getLinkDrawerTitle()"
    :context="linkDrawerContext"
    @close="handleLinkDrawerClose"
    @linked="handleLinkDrawerLinked"
  />

  <!-- Reset Layout Confirmation Modal -->
  <TransitionRoot as="template" :show="showResetConfirmModal">
    <Dialog class="relative z-50" @close="showResetConfirmModal = false">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/40 z-[45] transition-opacity" />
      </TransitionChild>

      <div class="fixed inset-0 z-[50] overflow-y-auto">
        <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <TransitionChild
            as="template"
            enter="ease-out duration-300"
            enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel class="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div class="sm:flex sm:items-start">
                <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0 sm:h-10 sm:w-10">
                  <ExclamationTriangleIcon class="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                </div>
                <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <DialogTitle as="h3" class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                    {{ t('common.summaryResetWidgetLayout') }}
                  </DialogTitle>
                  <div class="mt-2">
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ t('common.summaryResetLayoutConfirmBody') }}
                    </p>
                  </div>
                </div>
              </div>
              <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  class="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto"
                  @click="confirmResetLayout"
                >
                  {{ t('common.summaryResetToDefault') }}
                </button>
                <button
                  type="button"
                  class="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 sm:mt-0 sm:w-auto"
                  @click="showResetConfirmModal = false"
                >
                  {{ t('actions.cancel') }}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>

  <!-- Dependency Popup Modal -->
  <DependencyPopupModal
    :is-open="showPopupModal"
    :title="popupModalConfig.title"
    :description="popupModalConfig.description"
    :fields="popupModalConfig.fields"
    :initial-data="props.record || {}"
    :all-fields="moduleDefinition?.fields || []"
    :module-key="props.recordType"
    @close="closePopupModal"
    @save="handlePopupSave"
  />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch, createApp, h, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import ArivuShimmerLogo from '@/components/common/ArivuShimmerLogo.vue';
import { Menu, MenuButton, MenuItem, MenuItems, Listbox, ListboxButton, ListboxOptions, ListboxOption, Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot, Switch } from '@headlessui/vue';
import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';
import RelatedContactsWidget from '@/components/organizations/RelatedContactsWidget.vue';
import RelatedDealsWidget from '@/components/deals/RelatedDealsWidget.vue';
import RelatedTasksWidget from '@/components/tasks/RelatedTasksWidget.vue';
import RelatedEventsWidget from '@/components/events/RelatedEventsWidget.vue';
import RelatedOrganizationWidget from '@/components/organizations/RelatedOrganizationWidget.vue';
import OrganizationAuditWidget from '@/components/organizations/OrganizationAuditWidget.vue';
import MetricsWidget from '@/components/common/metrics/MetricsWidget.vue';
import LifecycleStageWidget from '@/components/common/metrics/LifecycleStageWidget.vue';
import KeyFieldsWidget from '@/components/common/metrics/KeyFieldsWidget.vue';
import FormAnalyticsWidget from '@/components/forms/widgets/FormAnalyticsWidget.vue';
import FormPreview from '@/components/forms/FormPreview.vue';
import { canEditForm } from '@/utils/formEditPermissions';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import LinkRecordsDrawer from '@/components/common/LinkRecordsDrawer.vue';
import apiClient from '@/utils/apiClient';
import { fetchModuleDefinitionCached } from '@/utils/tenantSchemaApiCache';
import { sanitizeInternationalPhone, validatePhoneValue } from '@/utils/phoneInput';
import { PEOPLE_SALES_ROLE_MODULE_DEFINITION_KEYS } from '@/utils/peopleParticipationUi';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import PermissionButton from '@/components/common/PermissionButton.vue';
import DynamicFormField from '@/components/common/DynamicFormField.vue';
import { appendCreatedPicklistOption } from '@/utils/picklistInlineOptionCreate';
import DependencyPopupModal from '@/components/common/DependencyPopupModal.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import Avatar from '@/components/common/Avatar.vue';
import { getDefaultTagChipClass, getDefaultTagDotClass } from '@/composables/useRecordTags';
import { getFieldDependencyState, evaluateDependency } from '@/utils/dependencyEvaluation';
import { mergeOrgContactLookupForField } from '@/utils/orgContactFormPairing';
import { useRouter, useRoute } from 'vue-router';
import { resolveFieldContext, filterFieldsByContext } from '@/utils/fieldContextFilter';
import {
  MagnifyingGlassIcon,
  HeartIcon,
  TagIcon,
  LinkIcon,
  PencilSquareIcon,
  EllipsisVerticalIcon,
  PlusIcon,
  ClockIcon,
  XMarkIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  Square2StackIcon,
  DocumentTextIcon,
  ArchiveBoxIcon
} from '@heroicons/vue/24/outline';
import { HeartIcon as HeartIconSolid, TagIcon as TagIconSolid, ChatBubbleLeftEllipsisIcon } from '@heroicons/vue/24/solid';

import { useNotifications } from '@/composables/useNotifications';
import { formatUserDate, formatUserDateTime } from '@/utils/localeFormat';

function onPicklistOptionCreated(payload) {
  appendCreatedPicklistOption(payload?.field, payload?.option);
}

const { t } = useI18n();
const notifications = useNotifications();


// Props
const props = defineProps({
  record: {
    type: Object,
    default: null
  },
  recordType: {
    type: String,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  },
  stats: {
    type: Object,
    default: () => ({})
  }
});

// Emits
const emit = defineEmits(['close', 'update', 'edit', 'delete', 'addRelation', 'openRelatedRecord', 'recordUpdated', 'recordField', 'duplicate']);

function writeRecordField(field, value) {
  if (!props.record || field == null) return;
  emit('recordField', { field, value });
}

// Create a reactive reference to the record prop to ensure reactivity
// This ensures that computed properties that depend on record fields update properly
const record = toRef(props, 'record');

// Get openTab from useTabs
const { openTab } = useTabs();

// Initialize router, route, and auth store
const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

// Get current context from route
const currentContext = computed(() => resolveFieldContext(route.path, route.query));

// Force recompute trigger (similar to TabBar viewportWidth)
const recomputeTrigger = ref(0);
const widgetListUpdateTrigger = ref(0); // Trigger to force drawer re-render when widgets change
const layoutChangeTrigger = ref(0); // Trigger to detect layout changes for reset button

// Track pending field changes (field -> { originalValue, currentValue })
// Only save and log when field loses focus (blur)
const pendingFieldChanges = ref({});
/** Per-field messages for inline edit (e.g. phone validation on blur) — keyed by field key */
const fieldErrors = ref({});

// Viewport width for responsive calculations
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920);

// Handle resize for viewport width
const handleResize = () => {
  viewportWidth.value = window.innerWidth;
};

// Listen for sidebar toggle custom event
const handleSidebarToggle = (e) => {
  // Force recompute by toggling trigger value
  // This causes headerLeft computed to recalculate
  recomputeTrigger.value++;
};

// Dynamic positioning based on sidebar state (reads localStorage like TabBar)
const headerLeft = computed(() => {
  // Force dependency on recomputeTrigger
  const _ = recomputeTrigger.value;
  
  // On mobile/tablet (< 1024px), always at left: 0 (like TabBar)
  if (viewportWidth.value < 1024) {
    return '0px';
  }
  
  // On desktop (≥ 1024px), position based on sidebar state
  return 'var(--arivu-sidebar-chrome-width, calc(3.5rem + 1rem))';
});


// Get storage key for this record
const getStorageKey = () => {
  const recordId = props.record?._id || props.record?.id || 'default';
  return `summaryview-tab-${props.recordType}-${recordId}`;
};

// Get storage key for widget layout
const getLayoutStorageKey = () => {
  // Store layout per module (recordType) instead of per record
  return `summaryview-layout-${props.recordType}`;
};

// Get storage key for activity logs
const getActivityLogsStorageKey = () => {
  const recordId = props.record?._id || props.record?.id || 'default';
  return `summaryview-activity-${props.recordType}-${recordId}`;
};

// Load active tab from localStorage or default to 'summary'
const loadActiveTab = () => {
  try {
    const savedTab = localStorage.getItem(getStorageKey());
    if (savedTab) {
      // Check if it's a fixed tab
      if (fixedTabs.value.some(t => t.id === savedTab)) {
        return savedTab;
      }
      // For dynamic tabs, we'll validate when we load them
      // But we can still restore it if it was saved
      return savedTab;
    }
  } catch (e) {
    console.error('Error loading active tab:', e);
  }
  return 'summary';
};

// Save active tab to localStorage
const saveActiveTab = (tabId) => {
  try {
    localStorage.setItem(getStorageKey(), tabId);
  } catch (e) {
    console.error('Error saving active tab:', e);
  }
};

// State - initialize with summary, will be updated when record loads
const activeTab = ref('summary');
const isFollowing = ref(false);
const showTagModal = ref(false);
const showWidgetModal = ref(false);
const showResetConfirmModal = ref(false);
const newTag = ref('');
const tags = ref([]);

// Create drawer state
const showCreateDrawer = ref(false);
const createDrawerModuleKey = ref('');
const createDrawerInitialData = ref({});
const createDrawerRecord = ref(null);

// Link drawer state
const showLinkDrawer = ref(false);
const linkDrawerModuleKey = ref('');
const linkDrawerContext = ref({});

// Available relationships based on record type
const availableRelationships = computed(() => {
  const relationships = [];
  
  if (props.recordType === 'organizations') {
    relationships.push(
      { moduleKey: 'people', label: t('deals.sysFieldContactId') },
      { moduleKey: 'deals', label: t('forms.settingsLinkDeal') },
      { moduleKey: 'tasks', label: t('forms.settingsLinkTask') },
      { moduleKey: 'events', label: t('forms.settingsLinkEvent') }
    );
  } else if (props.recordType === 'people') {
    relationships.push(
      { moduleKey: 'organizations', label: t('forms.settingsLinkOrganization') },
      { moduleKey: 'deals', label: t('forms.settingsLinkDeal') },
      { moduleKey: 'tasks', label: t('forms.settingsLinkTask') },
      { moduleKey: 'events', label: t('forms.settingsLinkEvent') }
    );
  }
  
  return relationships;
});

// Fixed tabs - add Tenant Details tab if viewing tenant organization
// For forms: add Usage and Responses tabs if status is Active
const fixedTabs = computed(() => {
  const baseTabs = [
    { id: 'summary', name: t('records.tabSummary') },
    { id: 'details', name: t('records.tabDetails') },
    { id: 'updates', name: t('records.tabUpdates') }
  ];

  // For forms: add Preview, Usage and Responses tabs
  if (props.recordType === 'forms') {
    const formStatus = props.record?.status;
    baseTabs.splice(2, 0, { id: 'preview', name: t('records.tabPreview') });
    if (formStatus === 'Active') {
      baseTabs.splice(2, 0,
        { id: 'usage', name: t('records.tabUsage') },
        { id: 'responses', name: t('records.tabResponses') }
      );
    }
  } else if (props.record?.isTenant === true) {
    baseTabs.splice(2, 0, { id: 'tenant-details', name: t('records.tabTenantDetails') });
  }

  return baseTabs;
});

// Module definitions
const moduleDefinition = ref(null);
const allModuleDefinitions = ref({});

// Popup modal state
const showPopupModal = ref(false);
const popupModalConfig = ref({
  title: '',
  description: '',
  fields: []
});
const processedPopupTriggers = ref(new Set()); // Track processed popup triggers to avoid duplicates
const isInitialLoad = ref(true); // Track if this is the initial load to prevent popups on page reload
const hasEvaluatedPopupsForCurrentState = ref(false); // Track if we've already evaluated popups for current record state
const userInitiatedFieldChange = ref(false); // Track if the popup check was triggered by a user field change
const componentInitialized = ref(false); // Track if component is fully initialized

// Field values tracking for discard functionality
const originalFieldValues = ref({});

// Details tab search
const detailsSearch = ref('');
const showEmptyFields = ref(true); // Show empty fields by default

// Form responses state (for Usage and Responses tabs)
const formResponses = ref([]);
const formResponsesLoading = ref(false);
const formResponsesPagination = ref({
  currentPage: 1,
  limit: 10,
  total: 0,
  totalPages: 1
});

// Permission check for managing fields
const hasManageFieldsPermission = computed(() => {
  return authStore.can('settings', 'edit');
});

// Get field dependency state for a field (reactive). Same pipeline as DynamicForm, including org/contact paired lookupQuery (people by org, orgs by id when contact selected).
const getFieldState = (field) => {
  if (!field) {
    return {
      visible: true,
      readonly: false,
      required: false,
      allowedOptions: null,
      label: null,
      lookupQuery: null,
      setValue: null,
    };
  }
  const currentFormData = props.record || {};
  const fields = moduleDefinition.value?.fields || [];
  const base = getFieldDependencyState(field, currentFormData, fields, {
    currentUser: authStore.user,
    organization: authStore.organization,
    moduleKey: props.recordType,
  });
  return mergeOrgContactLookupForField(field, base, currentFormData, props.recordType, fields);
};

// Get fields with their definitions for details tab
const getFieldsWithDefinitions = computed(() => {
  if (!props.record || !moduleDefinition.value?.fields) return [];
  
  // Filter fields by context first
  const contextFilteredFields = filterFieldsByContext(moduleDefinition.value.fields, currentContext.value);
  
  // Create a map of field keys to field definitions
  const fieldMap = new Map();
  contextFilteredFields.forEach(field => {
    if (field.key) {
      const keyLower = field.key.toLowerCase();
      fieldMap.set(keyLower, field);
      fieldMap.set(field.key, field); // Also store with original case
    }
  });
  
  // System fields to exclude from detail view display
  // Note: activitylogs is excluded from detail view but available in edit forms
  // Note: createdby is visible in detail view but not editable
  const systemFieldKeys = ['_id', 'id', '__v', 'createdat', 'updatedat', 'organizationid', 'activitylogs'];
  
  // Helper function to process and filter fields
  const processFields = (fieldDefs, filterTenant, filterCRM) => {
    const processed = [];
    const processedKeys = new Set();
    const isTenantOrg = props.record?.isTenant === true;
    
    for (const fieldDef of fieldDefs) {
      if (!fieldDef.key) continue;
      
      const keyLower = fieldDef.key.toLowerCase();
      
      // Skip if we've already processed this field (case-insensitive)
      if (processedKeys.has(keyLower)) continue;
      processedKeys.add(keyLower);
      
      // Skip system fields
      if (systemFieldKeys.includes(keyLower)) continue;
      
      // Filter tenant fields: only show if isTenant is true
      // Check by isTenantField flag OR by key patterns
      const tenantFieldPatterns = ['subscription.', 'limits.', 'settings.', 'slug', 'isactive', 'enabledmodules'];
      const isTenantField = fieldDef.isTenantField === true || 
                           tenantFieldPatterns.some(pattern => keyLower.startsWith(pattern) || keyLower === pattern);
      
      if (filterTenant && isTenantField && !isTenantOrg) continue;
      if (!filterTenant && isTenantField) continue; // Exclude tenant fields from CRM list
      
      // Filter CRM fields: only show if isTenant is false (or undefined, meaning CRM)
      if (filterCRM && fieldDef.isCRMField && isTenantOrg) continue;
      if (!filterCRM && fieldDef.isCRMField) continue; // Exclude CRM fields from tenant list
      
      // Extract value for nested field paths (e.g., subscription.status, limits.maxUsers)
      let displayValue;
      if (fieldDef.key && fieldDef.key.includes('.')) {
        // Handle nested paths like subscription.status
        displayValue = fieldDef.key.split('.').reduce((obj, k) => obj?.[k], props.record);
      } else {
        // Regular field access
        displayValue = props.record[fieldDef.key] || props.record[keyLower];
      }
      
      // Format createdBy value if it's an ObjectId string - convert to object format for display
      if (keyLower === 'createdby' && typeof displayValue === 'string' && displayValue.length === 24 && /^[0-9a-fA-F]{24}$/.test(displayValue)) {
        // It's an ObjectId string - we can't resolve it here, but we'll let the template handle it
        // The backend should populate it, so this is just a fallback
        displayValue = displayValue;
      }
      
      // Evaluate dependency-based visibility (for tenant fields, always show by default)
      const depState = getFieldState(fieldDef);
      if (!filterTenant && !depState.visible && depState.visible !== undefined) {
        continue; // Skip hidden fields for CRM fields
      }
      // For tenant fields, show even if dependency says hidden (they're always visible when isTenant is true)
      
      // Filter empty fields if toggle is off
      if (!showEmptyFields.value) {
        const isEmpty = displayValue === null || 
                       displayValue === undefined || 
                       displayValue === '' || 
                       (Array.isArray(displayValue) && displayValue.length === 0);
        if (isEmpty) continue;
      }
      
      // Apply search filter
      if (detailsSearch.value) {
        const searchLower = detailsSearch.value.toLowerCase();
        const fieldName = (fieldDef.label || fieldDef.key).toLowerCase();
        const fieldValue = String(displayValue || '').toLowerCase();
        
        if (!fieldName.includes(searchLower) && !fieldValue.includes(searchLower)) {
          continue;
        }
      }
      
      processed.push({
        field: fieldDef,
        key: fieldDef.key,
        value: displayValue,
        dependencyState: depState
      });
    }
    
    // Sort by field order if available
    processed.sort((a, b) => {
      const orderA = a.field.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.field.order ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });
    
    return processed;
  };
  
  // Separate CRM fields and tenant fields
  const allFields = moduleDefinition.value?.fields || [];
  const crmFields = processFields(allFields, false, true); // Include CRM fields, exclude tenant fields
  const tenantFields = processFields(allFields, true, false); // Include tenant fields, exclude CRM fields
  
  // Return CRM fields by default (tenant fields will be shown separately)
  return crmFields;
});

// Separate computed property for tenant fields
const getTenantFields = computed(() => {
  // Debug: Log the record and isTenant value
  if (props.record) {
    console.log('🔍 getTenantFields - record.isTenant:', props.record.isTenant, 'type:', typeof props.record.isTenant);
    console.log('🔍 getTenantFields - moduleDefinition:', moduleDefinition.value?.fields?.length, 'fields');
  }
  
  if (!moduleDefinition.value || !props.record) {
    return [];
  }
  
  // Check isTenant more flexibly (could be boolean, string, or undefined)
  const isTenant = props.record.isTenant === true || props.record.isTenant === 'true' || props.record.isTenant === 1;
  if (!isTenant) {
    return [];
  }
  
  const systemFieldKeys = ['_id', 'id', '__v', 'createdat', 'updatedat', 'organizationid', 'activitylogs'];
  const processed = [];
  const processedKeys = new Set();
  
  console.log('🔍 Processing tenant fields. Total fields:', moduleDefinition.value.fields?.length || 0);
  
  for (const fieldDef of moduleDefinition.value.fields || []) {
    if (!fieldDef.key) continue;
    
    // Check if field is a tenant field by flag OR by key pattern
    const tenantFieldPatterns = ['subscription.', 'limits.', 'settings.', 'slug', 'isactive', 'enabledmodules'];
    const keyLower = fieldDef.key.toLowerCase();
    const isTenantField = fieldDef.isTenantField === true || 
                         tenantFieldPatterns.some(pattern => keyLower.startsWith(pattern) || keyLower === pattern);
    
    // Debug: Log tenant field check
    if (fieldDef.key.includes('subscription') || fieldDef.key.includes('limits') || fieldDef.key.includes('settings')) {
      console.log('🔍 Field:', fieldDef.key, 'isTenantField flag:', fieldDef.isTenantField, 'detected as tenant:', isTenantField);
    }
    
    if (!isTenantField) continue;
    
    // Skip if already processed
    if (processedKeys.has(keyLower)) continue;
    processedKeys.add(keyLower);
    
    // Skip system fields
    if (systemFieldKeys.includes(keyLower)) continue;
    
    // Extract value for nested field paths
    let displayValue;
    if (fieldDef.key && fieldDef.key.includes('.')) {
      displayValue = fieldDef.key.split('.').reduce((obj, k) => obj?.[k], props.record);
    } else {
      displayValue = props.record[fieldDef.key] || props.record[keyLower];
    }
    
    // Filter empty fields if toggle is off
    if (!showEmptyFields.value) {
      const isEmpty = displayValue === null || 
                     displayValue === undefined || 
                     displayValue === '' || 
                     (Array.isArray(displayValue) && displayValue.length === 0);
      if (isEmpty) continue;
    }
    
    // Apply search filter
    if (detailsSearch.value) {
      const searchLower = detailsSearch.value.toLowerCase();
      const fieldName = (fieldDef.label || fieldDef.key).toLowerCase();
      const fieldValue = String(displayValue || '').toLowerCase();
      
      if (!fieldName.includes(searchLower) && !fieldValue.includes(searchLower)) {
        continue;
      }
    }
    
    // Always visible for tenant fields (no dependency checks)
    processed.push({
      field: fieldDef,
      key: fieldDef.key,
      value: displayValue,
      dependencyState: { visible: true, readonly: false } // Always visible and editable
    });
    
    console.log('✅ Added tenant field:', fieldDef.key, 'value:', displayValue);
  }
  
  console.log('🔍 Total tenant fields found:', processed.length);
  
  // Sort by field order
  processed.sort((a, b) => {
    const orderA = a.field.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.field.order ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });
  
  return processed;
});

// Helper functions for user display
const getUserInitials = (user) => {
  if (!user) return '?';
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.first_name && user.last_name) {
    return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
  }
  if (user.username) {
    return user.username.substring(0, 2).toUpperCase();
  }
  if (user.email) {
    return user.email.substring(0, 2).toUpperCase();
  }
  return '?';
};

const getUserDisplayName = (user) => {
  if (!user) return 'Unknown';
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`.trim();
  }
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`.trim();
  }
  if (user.username) return user.username;
  if (user.email) return user.email;
  return 'Unknown User';
};

// Navigate to manage fields in a new tab
const goToManageFields = () => {
  window.open(router.resolve(`/settings?tab=modules&module=${props.recordType}`).href, '_blank');
};

// GridStack
const gridStackContainer = ref(null);
let gridStack = null;
let isInitializing = false;

// Timeline updates - store all activity logs
const timelineUpdates = ref([]);
const loggedRecordIds = ref(new Set()); // Track which records we've logged initial load for

// Filter state
const activityFilterUser = ref('');
const activityFilterType = ref('');
const activitySearchQuery = ref('');

// Get current user name for activity logs
const getCurrentUserName = () => {
  if (authStore.user) {
    const firstName = authStore.user.firstName || '';
    const lastName = authStore.user.lastName || '';
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    return authStore.user.username || 'User';
  }
  return 'System';
};

// Get activity logs API endpoint
const getActivityLogsEndpoint = (recordId) => {
  // Always use tenant-scoped endpoint for data isolation
  if (props.recordType === 'people') {
    return `/people/${recordId}/activity-logs`;
  } else if (props.recordType === 'organizations') {
    // Always use tenant-scoped endpoint for data isolation
    return `/v2/organization/${recordId}/activity-logs`;
  }
  return null;
};

// Load activity logs from API (with localStorage fallback)
const loadActivityLogs = async () => {
  if (!props.record?._id && !props.record?.id) return;
  
  const recordId = props.record._id || props.record.id;
  const endpoint = getActivityLogsEndpoint(recordId);
  
  if (!endpoint) return;
  
  try {
    // Try API first
    const response = await apiClient.get(endpoint);
    if (response.success && response.data) {
      // Convert ISO strings back to Date objects and create a map by unique identifier
      const logsFromAPI = response.data.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp)
      }));
      
      // Create unique key for each log (timestamp + action + user)
      // This helps prevent duplicates when merging
      const createLogKey = (log) => {
        const timestamp = log.timestamp instanceof Date ? log.timestamp.getTime() : new Date(log.timestamp).getTime();
        return `${timestamp}_${log.action}_${log.user}`;
      };
      
      // Merge with existing logs, avoiding duplicates
      const existingLogKeys = new Set(timelineUpdates.value.map(createLogKey));
      const newLogs = logsFromAPI.filter(log => !existingLogKeys.has(createLogKey(log)));
      
      // Combine existing and new logs, then sort by timestamp
      timelineUpdates.value = [...timelineUpdates.value, ...newLogs]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 100); // Limit to 100 most recent
      
      return;
    }
  } catch (apiError) {
    console.warn('Error loading activity logs from API, trying localStorage:', apiError);
  }
  
  // Fallback to localStorage
  try {
    const saved = localStorage.getItem(getActivityLogsStorageKey());
    if (saved) {
      const parsed = JSON.parse(saved);
      // Convert ISO strings back to Date objects
      timelineUpdates.value = parsed.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp)
      }));
    }
  } catch (e) {
    console.error('Error loading activity logs from localStorage:', e);
    timelineUpdates.value = [];
  }
};

// Save activity log to API (with localStorage fallback)
const saveActivityLogToAPI = async (logEntry) => {
  if (!props.record?._id && !props.record?.id) return false;
  
  const recordId = props.record._id || props.record.id;
  const endpoint = getActivityLogsEndpoint(recordId);
  
  if (!endpoint) return false;
  
  try {
    // Convert Date to ISO string for API
    const payload = {
      user: logEntry.user,
      action: logEntry.action,
      details: logEntry.details || null
    };
    
    const response = await apiClient.post(endpoint, payload);
    
    // Check if the API call was successful
    if (response && response.success) {
      return true;
    } else {
      console.warn('Activity log API returned non-success response:', response);
      // Fall through to localStorage fallback
    }
  } catch (apiError) {
    console.warn('Error saving activity log to API, saving to localStorage:', apiError);
  }
  
  // Fallback to localStorage
  try {
    const logsToSave = timelineUpdates.value.map(log => ({
      ...log,
      timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : log.timestamp
    }));
    localStorage.setItem(getActivityLogsStorageKey(), JSON.stringify(logsToSave));
    return false; // Indicate we used localStorage fallback
  } catch (e) {
    console.error('Error saving activity logs to localStorage:', e);
    return false;
  }
};

// Add activity log entry
const addActivityLog = async (action, details = null, skipReload = false) => {
  const update = {
    user: getCurrentUserName(),
    action: action,
    details: details,
    timestamp: new Date()
  };
  
  // Save to API first (with localStorage fallback)
  const saved = await saveActivityLogToAPI(update);
  
  // If saved successfully to API, reload logs to get server timestamp (unless skipReload is true)
  // Otherwise, add to local timeline immediately (for localStorage fallback)
  if (saved) {
    // Only reload if not skipping (for batch operations)
    if (!skipReload) {
      // Reload from API to get the server-generated timestamp and ensure consistency
      await loadActivityLogs();
    }
  } else {
    // Add to local timeline if saved to localStorage
    timelineUpdates.value.unshift(update); // Add to beginning for newest first
    
    // Optional: Limit to last 100 updates to prevent memory issues
    if (timelineUpdates.value.length > 100) {
      timelineUpdates.value = timelineUpdates.value.slice(0, 100);
    }
  }
};

function getPathForModule(moduleKey, id) {
  if (!moduleKey || !id) return '';
  switch ((moduleKey || '').toString()) {
    case 'people':
    case 'contacts':
      return `/people/${id}`;
    case 'deals':
      return `/deals/${id}`;
    case 'tasks':
      return `/tasks`; // no per-task view route defined
    case 'events':
      return `/events/${id}`;
    case 'organizations':
    case 'organization':
      return `/organizations/${id}`;
    default:
      return '';
  }
}

// Helper: get record detail endpoint
function getDetailEndpoint(moduleKey, id) {
  const key = (moduleKey || '').toString();
  switch (key) {
    case 'people':
    case 'contacts':
      return `/people/${id}`;
    case 'deals':
      return `/deals/${id}`;
    case 'tasks':
      return `/tasks/${id}`;
    case 'events':
      return `/events/${id}`;
    case 'organizations':
    case 'organization':
      return `/v2/organization/${id}`;
    default:
      return '';
  }
}

// Helper: derive display name from a record object
function getRecordDisplayName(rec) {
  return rec?.name || rec?.title || `${rec?.first_name || ''} ${rec?.last_name || ''}`.trim() || rec?.email || rec?._id;
}

// Helper: fetch records by ids for activity links
async function fetchRecordsByIds(moduleKey, ids) {
  const out = [];
  for (const id of ids || []) {
    const ep = getDetailEndpoint(moduleKey, id);
    if (!ep) continue;
    try {
      const res = await apiClient.get(ep);
      const rec = res?.data || res;
      if (rec) out.push({ id, name: getRecordDisplayName(rec), module: moduleKey });
    } catch {
      out.push({ id, name: id, module: moduleKey });
    }
  }
  return out;
}

// Computed property for sorted timeline (newest first - already sorted since we unshift)
const sortedTimelineUpdates = computed(() => {
  return [...timelineUpdates.value].sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
});

// Open activity link in tab bar (reuse if already open)
function handleActivityLinkClick(li) {
  if (!li?.href) return;
  try {
    openTab(li.href, { title: li.text, insertAdjacent: true });
  } catch {
    // Fallback to router navigation
    router.push(li.href);
  }
}

// Get unique users from activity
const uniqueActivityUsers = computed(() => {
  const users = new Set();
  sortedTimelineUpdates.value.forEach(update => {
    if (update.user) {
      users.add(update.user);
    }
  });
  return Array.from(users).sort();
});

// Computed padding for tab content (accounts for taller header on mobile/tablet)
const tabContentPadding = computed(() => {
  // On tablet/desktop (md+), header is single row, needs less padding
  // On mobile, header is two rows, needs more padding
  if (viewportWidth.value >= 768) {
    return 'pt-32'; // ~128px top padding, p-6 for other sides
  } else {
    return 'pt-48'; // ~192px top padding, p-6 for other sides
  }
});

// Computed class and style for details grid columns
const detailsGridClass = computed(() => {
  if (viewportWidth.value >= 1440) {
    // At 1440px+, don't apply xl:grid-cols-3 to avoid conflict with inline style
    return 'grid grid-cols-1 md:grid-cols-2 gap-6';
  } else if (viewportWidth.value >= 1280) {
    // 3 columns at 1280px - 1439px
    return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6';
  } else if (viewportWidth.value >= 768) {
    // 2 columns at 768px - 1279px
    return 'grid grid-cols-1 md:grid-cols-2 gap-6';
  }
  // 1 column below 768px
  return 'grid grid-cols-1 gap-6';
});

const detailsGridStyle = computed(() => {
  if (viewportWidth.value >= 1440) {
    // Override to 4 columns at 1440px+
    return { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' };
  }
  return {};
});

// Transform activity logs into activity items for the feeds UI
const activityItems = computed(() => {
  const items = sortedTimelineUpdates.value.map((update, index) => {
    const action = update.action || '';
    const lowerAction = action.toLowerCase();
    
    // Determine activity type based on action content
    let type = 'comment';
    let comment = action;
    let fieldName = '';
    let tags = [];
    let actionText = '';
    
    // Check for tag operations (e.g., "added tag "name"" or "removed tag "name"")
    if (lowerAction.includes('tag')) {
      type = 'tags';
      const tagMatch = action.match(/(?:added|removed)\s+tag\s+"?([^"]+)"?/i);
      if (tagMatch) {
        const tagName = tagMatch[1].replace(/^"|"$/g, ''); // Remove quotes if present
        const isRemoved = lowerAction.includes('removed');
        tags = [{ name: tagName }];
        actionText = isRemoved ? 'removed tag' : 'added tag';
      } else {
        // Fallback for tag actions without proper format
        comment = action;
      }
    }
    // Check for field changes (e.g., "set First Name to "John"" or "changed First Name from "Old" to "New"")
    else if (lowerAction.includes('changed') || lowerAction.includes('set') || lowerAction.includes('updated')) {
      type = 'assignment';
      
      // Check if this is a multiple changes entry with details
      if (update.details && typeof update.details === 'object' && update.details.type === 'multiple_changes' && Array.isArray(update.details.changes)) {
        // Multiple changes - parse each change
        actionText = 'updated';
        fieldName = `${update.details.changes.length} field${update.details.changes.length > 1 ? 's' : ''}`;
        // Store the changes array for display
        const changesList = update.details.changes.map(change => {
          // Parse each change action
          const setMatch = change.match(/set\s+([^"]+?)\s+to\s+"([^"]*)"/i);
          const changeMatch = change.match(/changed\s+([^"]+?)\s+from\s+"([^"]*)"\s+to\s+"([^"]*)"/i);
          const clearMatch = change.match(/cleared\s+([^"(\s]+)\s*\(was\s+"([^"]*)"\)/i);
          
          if (setMatch) {
            return {
              field: formatFieldName(setMatch[1].trim()),
              action: 'set',
              newValue: setMatch[2],
              oldValue: null
            };
          } else if (changeMatch) {
            return {
              field: formatFieldName(changeMatch[1].trim()),
              action: 'changed',
              oldValue: changeMatch[2] || 'empty',
              newValue: changeMatch[3]
            };
          } else if (clearMatch) {
            return {
              field: formatFieldName(clearMatch[1].trim()),
              action: 'cleared',
              oldValue: clearMatch[2],
              newValue: null
            };
          } else {
            return {
              field: 'Unknown',
              action: 'changed',
              description: change
            };
          }
        });
        
        // Create comment with all changes listed
        comment = `Updated ${update.details.changes.length} field${update.details.changes.length > 1 ? 's' : ''}`;
        
        // Handle ObjectId strings in user field (fallback if backend didn't resolve it)
        let userName = update.user || 'System';
        if (typeof userName === 'string' && /^[0-9a-fA-F]{24}$/.test(userName)) {
          // If user field is an ObjectId string, use a fallback
          userName = 'Unknown User';
        }
        
        // Store parsed changes for rendering
        return {
          id: `activity-${update.timestamp?.getTime() || index}`,
          type,
          person: {
            name: userName,
            href: '#'
          },
          comment,
          action: actionText,
          fieldName,
          tags,
          date: formatDate(update.timestamp),
          multipleChanges: changesList // Store parsed changes for display
        };
      }
      
      // Single change - parse normally
      // Try to extract field name and values
      const setMatch = action.match(/set\s+([^"]+?)\s+to\s+"([^"]*)"/i);
      const changeMatch = action.match(/changed\s+([^"]+?)\s+from\s+"([^"]*)"\s+to\s+"([^"]*)"/i);
      
      if (setMatch) {
        fieldName = formatFieldName(setMatch[1].trim());
        actionText = 'set';
        comment = `Set ${fieldName} to "${setMatch[2]}"`;
      } else if (changeMatch) {
        fieldName = formatFieldName(changeMatch[1].trim());
        actionText = 'changed';
        const oldVal = changeMatch[2] || 'empty';
        comment = `Changed ${fieldName} from "${oldVal}" to "${changeMatch[3]}"`;
      } else {
        // Fallback: try to extract just the field name
        const fieldMatch = action.match(/(?:changed|set|updated)\s+([^\s]+)/i);
        if (fieldMatch) {
          fieldName = formatFieldName(fieldMatch[1]);
          actionText = lowerAction.includes('set') ? 'set' : (lowerAction.includes('updated') ? 'updated' : 'changed');
        }
      }
    }
    // Everything else is a comment (follow, viewed, created, linked, unlinked, etc.)
    else {
      comment = action;
    }
    
    // Handle ObjectId strings in user field (fallback if backend didn't resolve it)
    let userName = update.user || 'System';
    if (typeof userName === 'string' && /^[0-9a-fA-F]{24}$/.test(userName)) {
      // If user field is an ObjectId string, use a fallback
      userName = 'Unknown User';
    }
    
    // Build link items if provided in details
    let linkItems = [];
    if (update.details && typeof update.details === 'object' && (update.details.type === 'link' || update.details.type === 'unlink')) {
      const entries = Array.isArray(update.details.items) ? update.details.items : [];
      linkItems = entries.map((it) => ({
        text: it.name || it.title || it.id,
        href: getPathForModule(it.module || update.details.moduleKey, it.id)
      })).filter(li => !!li.href);
    }

    // Remove duplicate name suffix from comment when rendering single inline link
    let displayComment = comment;
    if (linkItems.length === 1 && typeof comment === 'string') {
      const nm = linkItems[0]?.text;
      const suff = nm ? ` - ${nm}` : '';
      if (suff && comment.endsWith(suff)) {
        displayComment = comment.slice(0, -suff.length);
      }
    }

    return {
      id: `activity-${update.timestamp?.getTime() || index}`,
      type,
      person: {
        name: userName,
        href: '#'
      },
      comment,
      displayComment,
      action: actionText,
      fieldName,
      tags,
      date: formatDate(update.timestamp),
      linkItems
    };
  });
  
  // Apply filters
  return items.filter(item => {
    // Filter by user
    if (activityFilterUser.value && item.person.name.toLowerCase() !== activityFilterUser.value.toLowerCase()) {
      return false;
    }
    
    // Filter by type
    if (activityFilterType.value && item.type !== activityFilterType.value) {
      return false;
    }
    
    // Filter by search query
    if (activitySearchQuery.value) {
      const query = activitySearchQuery.value.toLowerCase();
      const searchableText = `${item.person.name} ${item.comment} ${item.fieldName}`.toLowerCase();
      if (!searchableText.includes(query)) {
        return false;
      }
    }
    
    return true;
  });
});

// Available widgets - dynamic based on record type
const availableWidgets = computed(() => {
  const widgets = [];
  
  // Relationship widgets based on record type
  if (props.recordType === 'organizations') {
    // Organizations can have related contacts and deals
    widgets.push(
      {
        type: 'related-contacts',
        name: 'Related Contacts',
        description: 'Show contacts associated with this organization',
      },
      {
        type: 'related-deals',
        name: 'Related Deals',
        description: 'Show deals linked to this organization',
      }
    );
  } else if (props.recordType === 'people') {
    // People can have related organization, deals, tasks, and events
    widgets.push(
      {
        type: 'related-organization',
        name: 'Related Organization',
        description: 'Show the organization linked to this contact',
      },
      {
        type: 'related-deals',
        name: 'Related Deals',
        description: 'Show deals associated with this contact',
      },
      {
        type: 'related-tasks',
        name: 'Related Tasks',
        description: 'Show tasks linked to this contact',
      },
      {
        type: 'related-events',
        name: 'Related Events',
        description: 'Show events associated with this contact',
      }
    );
  } else if (props.recordType === 'deals') {
    // Deals can have related contacts and organizations
    widgets.push(
      {
        type: 'related-contacts',
        name: 'Related Contacts',
        description: 'Show contacts associated with this deal',
      },
      {
        type: 'related-organization',
        name: 'Related Organization',
        description: 'Show the organization linked to this deal',
      },
      {
        type: 'related-tasks',
        name: 'Related Tasks',
        description: 'Show tasks linked to this deal',
      },
      {
        type: 'related-events',
        name: 'Related Events',
        description: 'Show events associated with this deal',
      }
    );
  } else if (props.recordType === 'tasks') {
    // Tasks can have related contacts, deals, organizations, and events
    widgets.push(
      {
        type: 'related-contacts',
        name: 'Related Contacts',
        description: 'Show contacts associated with this task',
      },
      {
        type: 'related-organization',
        name: 'Related Organization',
        description: 'Show the organization linked to this task',
      },
      {
        type: 'related-deals',
        name: 'Related Deals',
        description: 'Show deals linked to this task',
      },
      {
        type: 'related-events',
        name: 'Related Events',
        description: 'Show events associated with this task',
      }
    );
  } else if (props.recordType === 'events') {
    // Events can have related contacts, deals, organizations, and tasks
    widgets.push(
      {
        type: 'related-contacts',
        name: 'Related Contacts',
        description: 'Show contacts associated with this event',
      },
      {
        type: 'related-organization',
        name: 'Related Organization',
        description: 'Show the organization linked to this event',
      },
      {
        type: 'related-deals',
        name: 'Related Deals',
        description: 'Show deals linked to this event',
      },
      {
        type: 'related-tasks',
        name: 'Related Tasks',
        description: 'Show tasks associated with this event',
      }
    );
  } else if (props.recordType === 'forms') {
    // Form-specific analytics widgets (only for Active forms)
    if (props.record?.status === 'Active') {
      widgets.push(
        {
          type: 'form-total-responses',
          name: 'Total Responses',
          description: 'Total number of form responses',
        },
        {
          type: 'form-avg-compliance',
          name: 'Avg Compliance',
          description: 'Average compliance percentage',
        },
        {
          type: 'form-avg-rating',
          name: 'Avg Rating',
          description: 'Average rating out of 5',
        },
        {
          type: 'form-response-rate',
          name: 'Response Rate',
          description: 'Percentage of completed responses',
        }
      );
    }
  }
  
  // Common widgets available for all record types
  widgets.push(
  {
    type: 'key-fields',
    name: 'Key Fields',
    description: 'Important record fields',
    },
    {
      type: 'lifecycle-stage',
      name: 'Lifecycle Stage',
      description: 'Current stage and progression',
    },
    {
      type: 'metrics',
      name: 'Metrics',
      description: 'Key performance indicators',
    }
  );
  
  return widgets;
});

// Initialize GridStack
const initializeGridStack = async () => {
  // Prevent multiple simultaneous initializations
  if (isInitializing) {
    return;
  }
  
  // Wait for DOM to be ready
  await nextTick();
  await nextTick(); // Extra tick to ensure v-if has rendered
  
  // Check if container exists
  if (!gridStackContainer.value) {
    setTimeout(() => initializeGridStack(), 100);
    return;
  }
  
  // Destroy existing instance if any
  if (gridStack) {
    destroyGridStack();
  }
  
  // Additional check to ensure element is in DOM
  if (!document.contains(gridStackContainer.value)) {
    setTimeout(() => initializeGridStack(), 100);
    return;
  }

  isInitializing = true;
  
  try {
    gridStack = GridStack.init({
      column: 12,
      cellHeight: 70,
      marginRight: '0.8rem',
      marginLeft: '0rem',
      marginTop: '0rem',
      marginBottom: '0.8rem',
      animate: true,
      disableResize: false,
      disableDrag: false,
      resizable: { handles: 'all' },
      columnOpts: {
        breakpoints: [
          { w: 600, c: 1 },  // Mobile: 1 column (< 600px)
          { w: 1024, c: 2 }  // Tablet: 2 columns (< 1024px)
        ]
      }
    }, gridStackContainer.value);
    
    // Add event listeners to save layout on changes
    // Debounce saves to avoid too many API calls
    let saveTimeout = null;
    const debouncedSave = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveLayoutState();
        // Trigger layout change detection update
        layoutChangeTrigger.value++;
      }, 500); // Wait 500ms after last change before saving
    };
    
    gridStack.on('change', (event, items) => {
      layoutChangeTrigger.value++; // Trigger reactive update
      debouncedSave();
    });
    
    gridStack.on('added', () => {
      layoutChangeTrigger.value++; // Trigger reactive update
      debouncedSave();
    });
    
    gridStack.on('removed', () => {
      layoutChangeTrigger.value++; // Trigger reactive update
      debouncedSave();
    });
    
    // No custom CSS vars needed; GridStack 'margin' option handles gutters

    // Load default widgets after a short delay to ensure GridStack is ready
    setTimeout(async () => {
      isInitializing = false;
      
      // Check if GridStack is initialized
      if (!gridStack) {
        console.warn('GridStack not initialized, retrying...');
        setTimeout(() => initializeGridStack(), 100);
        return;
      }
      
      try {
        // Ensure record is available before loading widgets
        if (!props.record?._id && props.recordType === 'organizations') {
          console.warn('Record not available yet, retrying widget initialization...');
          setTimeout(() => {
            if (props.record?._id) {
              initializeGridStack();
            }
          }, 200);
          return;
        }
        
        // Check if there are any widgets already (by checking GridStack items)
        const existingWidgets = gridStack.getGridItems();
        
        // Clean up any deprecated 'related-records' widgets that might exist
        const deprecatedWidgets = existingWidgets.filter(item => 
          item.getAttribute('data-widget-type') === 'related-records'
        );
        if (deprecatedWidgets.length > 0) {
          console.log(`Removing ${deprecatedWidgets.length} deprecated 'related-records' widget(s)`);
          deprecatedWidgets.forEach(widget => {
            try {
              gridStack.removeWidget(widget, false);
            } catch (e) {
              console.warn('Error removing deprecated widget:', e);
              // Try direct DOM removal as fallback
              if (widget.parentNode) {
                widget.remove();
              }
            }
          });
          await nextTick();
          gridStack.compact();
          // Save layout after removing deprecated widgets
          saveLayoutState();
        }
        
        if (existingWidgets.length === 0 || (existingWidgets.length === deprecatedWidgets.length)) {
          // Try to load saved layout first
          const savedLayout = await loadSavedLayout();
          console.log('Initializing GridStack - savedLayout:', savedLayout ? savedLayout.map(w => w.type) : 'null');
          if (savedLayout && savedLayout.length > 0) {
            console.log('Loading saved widgets:', savedLayout.map(w => w.type));
            loadSavedWidgets(savedLayout);
          } else {
            console.log('No saved layout found, loading default widgets');
            loadDefaultWidgets();
          }
        } else {
          console.log('GridStack already has widgets, skipping initialization');
        }
      } catch (err) {
        console.error('Error checking GridStack items:', err);
        // If error, try to load saved layout or default widgets
        const savedLayout = await loadSavedLayout();
        if (savedLayout && savedLayout.length > 0) {
          loadSavedWidgets(savedLayout);
        } else {
          loadDefaultWidgets();
        }
      }
    }, 150);
  } catch (err) {
    console.error('Error initializing GridStack:', err);
    isInitializing = false;
  }
};

// Destroy GridStack
const destroyGridStack = () => {
  // Unmount all Vue widget apps
  widgetApps.forEach((widgetData, element) => {
    try {
      if (widgetData.app) {
        widgetData.app.unmount();
      }
    } catch (e) {
      console.error('Error unmounting widget:', e);
    }
  });
  widgetApps.clear();
  
  if (gridStack) {
    try {
      gridStack.destroy();
      gridStack = null;
    } catch (err) {
      console.error('Error destroying GridStack:', err);
    }
  }
  isInitializing = false;
};

// Save layout state to backend API
const saveLayoutState = async () => {
  // No longer require record._id - layout is saved per module
  if (!gridStack || !gridStackContainer.value || !props.recordType) return;
  
  try {
    // Get all grid items with their elements
    const gridItems = gridStack.getGridItems();
    const layoutData = gridItems.map(gridItem => {
      // Get the actual widget element (the one with data-widget-type)
      const widgetElement = gridItem;
      const widgetType = widgetElement?.getAttribute('data-widget-type');
      
      // Get GridStack position and size
      const x = parseInt(gridItem.getAttribute('gs-x')) || 0;
      const y = parseInt(gridItem.getAttribute('gs-y')) || 0;
      const w = parseInt(gridItem.getAttribute('gs-w')) || 4;
      const h = parseInt(gridItem.getAttribute('gs-h')) || 3;
      
      return {
        x,
        y,
        w,
        h,
        type: widgetType || null
      };
    }).filter(item => {
      // Filter out invalid types and deprecated 'related-records' widget
      if (!item.type) return false;
      if (item.type === 'related-records') {
        console.log('Filtering out deprecated widget type from saved layout: related-records');
        return false;
      }
      return true;
    });
    
    // Debug: Log what we're saving
    console.log('Saving widget layout:', layoutData, 'Widget types:', layoutData.map(w => w.type));
    
    // Always save to localStorage first (immediate persistence)
    localStorage.setItem(getLayoutStorageKey(), JSON.stringify(layoutData));
    console.log('Widget layout saved to localStorage:', layoutData.map(w => w.type));
    
    // Save to backend API (silently fail - don't log errors for 404s)
    // Note: Backend requires recordId, but we use "module" for module-level layouts
    try {
      await apiClient.post('/user-preferences/widget-layout', {
        recordType: props.recordType,
        recordId: 'module', // "module" indicates module-level layout (not per-record)
        widgets: layoutData
      });
      console.log('Widget layout saved to API successfully');
    } catch (apiError) {
      // Only log if it's not a 404 (backend route might not be available yet)
      if (!apiError.is404 && apiError.status !== 404) {
        console.error('Error saving layout to API:', apiError);
      }
      // localStorage already saved above, so we're good
    }
  } catch (error) {
    console.error('Error saving layout state:', error);
  }
};

// Reset widget layouts for all modules (clears saved layouts)
const resetAllWidgetLayouts = async () => {
  const recordTypes = ['people', 'organizations', 'deals', 'tasks', 'events'];
  
  // Clear localStorage for all record types
  recordTypes.forEach(recordType => {
    const key = `summaryview-layout-${recordType}`;
    localStorage.removeItem(key);
    console.log(`Cleared localStorage layout for ${recordType}`);
  });
  
  // Note: Backend API endpoint for widget layouts may not exist yet
  // Widget layouts are currently stored in localStorage only
  // If you implement the backend endpoint later, uncomment this code:
  /*
  for (const recordType of recordTypes) {
    try {
      await apiClient.delete('/user-preferences/widget-layout', {
        params: {
          recordType: recordType
        }
      });
      console.log(`Cleared API layout for ${recordType}`);
    } catch (error) {
      // Silently fail - endpoint may not exist
      if (error.response?.status !== 404) {
        console.log(`Could not clear API layout for ${recordType}:`, error.message);
      }
    }
  }
  */
  
  console.log('All widget layouts have been reset');
};

// Check if saved layout follows the new default order (Key Fields, Lifecycle Stage, Metrics in first row)
// Only reset if it's genuinely an old layout format, not user customizations
const shouldResetLayout = (savedLayout) => {
  if (!savedLayout || savedLayout.length === 0) return false;
  
  // Check if first widget is 'key-fields' - if not, it's an old layout format
  // This is the main indicator of old vs new format
  const firstWidget = savedLayout[0];
  if (firstWidget && firstWidget.type !== 'key-fields') {
    console.log('Detected old widget layout format (first widget is not key-fields) - will reset to new default order');
    return true;
  }
  
  // Check if the layout has the deprecated 'related-records' widget
  // This indicates it's from before we split it into specific relationship widgets
  const hasRelatedRecords = savedLayout.some(w => w.type === 'related-records');
  if (hasRelatedRecords) {
    console.log('Detected deprecated related-records widget - will reset to new format');
    return true;
  }
  
  // Don't reset if user has customized positions/sizes - those are valid saved layouts
  // Only reset if it's genuinely missing key widgets or has old format indicators
  
  return false;
};

// Load saved layout from backend API or localStorage (fallback)
const loadSavedLayout = async () => {
  // No longer require record._id - layout is loaded per module
  if (!props.recordType) return null;
  
  try {
    // Prioritize localStorage first (it's more up-to-date and immediate)
    const saved = localStorage.getItem(getLayoutStorageKey());
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log('Loaded layout from localStorage:', parsed.map(w => w.type));
      
      // Check if layout needs to be reset (old format)
      if (shouldResetLayout(parsed)) {
        console.log('Resetting to new default widget order');
        // Clear the old layout
        localStorage.removeItem(getLayoutStorageKey());
        // Try to clear from backend too
        try {
          await apiClient.delete('/user-preferences/widget-layout', {
            params: {
              recordType: props.recordType,
              recordId: 'module'
            }
          });
        } catch (error) {
          // Ignore errors
        }
        // Return null to trigger default layout
        return null;
      }
      
      return parsed;
    }
    
    // Try to load from backend API as fallback
    // Note: Backend requires recordId, but we use "module" for module-level layouts
    try {
      const response = await apiClient.get('/user-preferences/widget-layout', {
        params: {
          recordType: props.recordType,
          recordId: 'module' // "module" indicates module-level layout (not per-record)
        }
      });
      
      if (response.success && response.data && Array.isArray(response.data)) {
        console.log('Loaded layout from API:', response.data.map(w => w.type));
        
        // Check if layout needs to be reset (old format)
        if (shouldResetLayout(response.data)) {
          console.log('Resetting to new default widget order');
          // Clear the old layout
          localStorage.removeItem(getLayoutStorageKey());
          // Try to clear from backend too
          try {
            await apiClient.delete('/user-preferences/widget-layout', {
              params: {
                recordType: props.recordType,
                recordId: 'module'
              }
            });
          } catch (error) {
            // Ignore errors
          }
          // Return null to trigger default layout
          return null;
        }
        
        // Also save to localStorage for faster access next time
        localStorage.setItem(getLayoutStorageKey(), JSON.stringify(response.data));
        return response.data;
      }
    } catch (apiError) {
      // Only log if it's not a 404 (backend route might not be available yet)
      if (!apiError.is404 && apiError.status !== 404) {
        console.warn('Error loading layout from API:', apiError);
      }
    }
  } catch (error) {
    console.error('Error loading saved layout:', error);
  }
  return null;
};

// Load saved widgets with their positions and sizes
const loadSavedWidgets = (savedLayout) => {
  if (!gridStack) return;
  
  // Valid widget types - filter out deprecated types like 'related-records'
  let validWidgetTypes = [
    'related-contacts', 'related-deals', 'related-tasks', 'related-events', 
    'related-organization', 'lifecycle-stage', 'key-fields', 'metrics'
  ];
  
  // Add form-specific widgets if this is a form record type with Active status
  if (props.recordType === 'forms' && props.record?.status === 'Active') {
    validWidgetTypes = [
      ...validWidgetTypes,
      'form-total-responses',
      'form-avg-compliance',
      'form-avg-rating',
      'form-response-rate'
    ];
  }
  
  savedLayout.forEach(widgetData => {
    // Only load valid widget types, skip deprecated ones like 'related-records'
    if (widgetData.type && validWidgetTypes.includes(widgetData.type)) {
      addWidgetToGrid(widgetData.type, widgetData.x, widgetData.y, widgetData.w, widgetData.h);
    } else if (widgetData.type === 'related-records') {
      // Skip deprecated 'related-records' widget - it's been replaced by specific relationship widgets
      console.log('Skipping deprecated widget type: related-records');
    } else {
      // Log if we're skipping a widget type that's not in valid types
      console.log('Skipping widget type not in validWidgetTypes:', widgetData.type);
    }
  });
  
  // Update GridStack to ensure margins are applied
  if (gridStack) {
    setTimeout(() => {
      gridStack.compact();
      if (typeof gridStack.update === 'function') {
        gridStack.update();
      }
      saveLayoutState(); // Save after loading
    }, 100);
  }
};

// Load default widgets
const loadDefaultWidgets = () => {
  if (!gridStack) return;

  // Default widgets based on record type
  // First row: Key Fields, Lifecycle Stage, and Metrics (all in one row)
  // Then followed by related widgets
  const defaultWidgets = [];
  let yPosition = 0;
  
  // First row: Key Fields (25%), Lifecycle Stage (50%), Metrics (25%)
  // Key Fields: 3 columns (25%), Lifecycle Stage: 6 columns (50%), Metrics: 3 columns (25%)
  defaultWidgets.push(
    { type: 'key-fields', x: 0, y: yPosition, w: 3, h: 4 },
    { type: 'lifecycle-stage', x: 3, y: yPosition, w: 6, h: 4 },
    { type: 'metrics', x: 9, y: yPosition, w: 3, h: 4 }
  );
  yPosition += 4;
  
  // Then add related widgets based on record type
  if (props.recordType === 'organizations') {
    // Organizations: Related Contacts, Related Deals
    defaultWidgets.push(
      { type: 'related-contacts', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-deals', x: 6, y: yPosition, w: 6, h: 4 }
    );
  } else if (props.recordType === 'people') {
    // People: Related Organization, Related Deals, Related Tasks, Related Events
    defaultWidgets.push(
      { type: 'related-organization', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-deals', x: 6, y: yPosition, w: 6, h: 4 }
    );
    yPosition += 4;
    defaultWidgets.push(
      { type: 'related-tasks', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-events', x: 6, y: yPosition, w: 6, h: 4 }
    );
  } else if (props.recordType === 'deals') {
    // Deals: Related Contacts, Related Organization, Related Tasks, Related Events
    defaultWidgets.push(
      { type: 'related-contacts', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-organization', x: 6, y: yPosition, w: 6, h: 4 }
    );
    yPosition += 4;
    defaultWidgets.push(
      { type: 'related-tasks', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-events', x: 6, y: yPosition, w: 6, h: 4 }
    );
  } else if (props.recordType === 'tasks') {
    // Tasks: Related Contacts, Related Organization, Related Deals, Related Events
    defaultWidgets.push(
      { type: 'related-contacts', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-organization', x: 6, y: yPosition, w: 6, h: 4 }
    );
    yPosition += 4;
    defaultWidgets.push(
      { type: 'related-deals', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-events', x: 6, y: yPosition, w: 6, h: 4 }
    );
  } else if (props.recordType === 'events') {
    // Events: Related Contacts, Related Organization, Related Deals, Related Tasks
    defaultWidgets.push(
      { type: 'related-contacts', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-organization', x: 6, y: yPosition, w: 6, h: 4 }
    );
    yPosition += 4;
    defaultWidgets.push(
      { type: 'related-deals', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-tasks', x: 6, y: yPosition, w: 6, h: 4 }
    );
  } else if (props.recordType === 'forms' && props.record?.status === 'Active') {
    // Forms: Analytics widgets (Total Responses, Avg Compliance, Avg Rating, Response Rate)
    defaultWidgets.push(
      { type: 'form-total-responses', x: 0, y: yPosition, w: 3, h: 3 },
      { type: 'form-avg-compliance', x: 3, y: yPosition, w: 3, h: 3 },
      { type: 'form-avg-rating', x: 6, y: yPosition, w: 3, h: 3 },
      { type: 'form-response-rate', x: 9, y: yPosition, w: 3, h: 3 }
    );
  }

  defaultWidgets.forEach(widget => {
    addWidgetToGrid(widget.type, widget.x, widget.y, widget.w, widget.h);
  });
  
  // Update GridStack to ensure margins are applied
  if (gridStack) {
    // Force GridStack to recalculate with margins
    setTimeout(() => {
      gridStack.compact();
      // Update GridStack to recalculate positions with margins
      if (typeof gridStack.update === 'function') {
        gridStack.update();
      }
      saveLayoutState(); // Save default layout
    }, 100);
  }
};

// Add widget to GridStack
const addWidgetToGrid = (widgetType, x = 0, y = 0, w = 4, h = 3) => {
  if (!gridStack || !gridStackContainer.value) return;
  
  // Ensure record is available before creating widgets that need it
  if ((widgetType === 'related-contacts' || widgetType === 'related-deals' || widgetType === 'related-tasks' || widgetType === 'related-events') && !props.record?._id) {
    console.warn(`Cannot create ${widgetType} widget: record._id not available`);
    return;
  }

  const widgetElement = createWidgetElement(widgetType);
  
  // Create proper GridStack item structure to ensure margins/gutters render
  const itemEl = document.createElement('div');
  itemEl.className = 'grid-stack-item';
  // Let GridStack's margin control the gutter
  itemEl.style.margin = '';
  itemEl.style.padding = '0';
  // Store widget type as data attribute for persistence
  itemEl.setAttribute('data-widget-type', widgetType);
  // Set GridStack attributes before appending
  itemEl.setAttribute('gs-x', x);
  itemEl.setAttribute('gs-y', y);
  itemEl.setAttribute('gs-w', w);
  itemEl.setAttribute('gs-h', h);

  // Inner content wrapper per GridStack spec
  const contentEl = document.createElement('div');
  contentEl.className = 'grid-stack-item-content';
  // Make content start/end exactly with the grid item bounds
  contentEl.style.padding = '0';
  contentEl.style.height = '100%';
  contentEl.style.width = '100%';
  contentEl.style.overflow = 'hidden';
  contentEl.appendChild(widgetElement);

  itemEl.appendChild(contentEl);

  // Append item to grid container
  gridStackContainer.value.appendChild(itemEl);
  
  // Convert to GridStack widget using makeWidget()
  const widget = gridStack.makeWidget(itemEl);
  
  // Update GridStack layout
  gridStack.compact();

  return widget;
};

// Store widget app instances for cleanup
const widgetApps = new Map();

// Create widget DOM element
const createWidgetElement = (widgetType) => {
  // Create container div with card styling - this becomes the widget card
  const container = document.createElement('div');
  container.className = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200/70 dark:border-gray-700/70 p-3 sm:p-4';
  container.style.boxSizing = 'border-box';
  container.style.height = '100%';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'flex-start';
  container.style.justifyContent = 'flex-start';
  container.style.overflow = 'auto';
  
  // Determine which Vue component to use based on widget type and record type
  let Component = null;
  const componentProps = {};
  
  if (props.recordType === 'organizations' && props.record?._id) {
    switch (widgetType) {
      case 'related-contacts':
        Component = RelatedContactsWidget;
        componentProps.organizationId = props.record._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['people'];
        break;
      case 'related-deals':
        Component = RelatedDealsWidget;
        // For organizations, use accountId to link deals to the organization record
        if (props.recordType === 'organizations') {
          componentProps.accountId = props.record._id;
        } else {
          componentProps.organizationId = props.record.legacyOrganizationId || props.record._id;
        }
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['deals'];
        break;
      case 'related-tasks':
        Component = RelatedTasksWidget;
        componentProps.organizationId = props.record._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['tasks'];
        break;
      case 'related-events':
        Component = RelatedEventsWidget;
        componentProps.relatedType = 'Organization';
        componentProps.relatedId = props.record._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['events'];
        break;
      case 'audit-history':
      case 'organization-audits':
        Component = OrganizationAuditWidget;
        componentProps.organizationId = props.record._id;
        componentProps.limit = 5;
        break;
      case 'metrics':
        Component = MetricsWidget;
        componentProps.stats = props.stats || {};
        componentProps.record = props.record;
        componentProps.recordType = props.recordType;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
      case 'lifecycle-stage':
        Component = LifecycleStageWidget;
        componentProps.record = props.record;
        componentProps.recordType = props.recordType;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
      case 'key-fields':
        Component = KeyFieldsWidget;
        componentProps.record = props.record;
        componentProps.recordType = props.recordType;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
      default:
        // Fallback to simple HTML widget
        container.innerHTML = getWidgetContent(widgetType);
        return container;
    }
  } else if (props.recordType === 'forms' && props.record?._id) {
    // Form-specific widgets - check this BEFORE the generic record type check
    switch (widgetType) {
      case 'form-total-responses':
      case 'form-avg-compliance':
      case 'form-avg-rating':
      case 'form-response-rate':
        Component = FormAnalyticsWidget;
        componentProps.formId = props.record._id;
        componentProps.metricType = widgetType.replace('form-', '');
        console.log('Creating FormAnalyticsWidget:', {
          widgetType,
          formId: componentProps.formId,
          metricType: componentProps.metricType,
          recordId: props.record._id
        });
        break;
      case 'lifecycle-stage':
        Component = LifecycleStageWidget;
        componentProps.record = props.record;
        componentProps.recordType = props.recordType;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
      case 'metrics':
        Component = MetricsWidget;
        componentProps.stats = props.stats || {};
        componentProps.record = props.record;
        componentProps.recordType = props.recordType;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
      case 'key-fields':
        Component = KeyFieldsWidget;
        componentProps.record = props.record;
        componentProps.recordType = props.recordType;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
      default:
        // Fallback to simple HTML widget
        container.innerHTML = getWidgetContent(widgetType);
        return container;
    }
  } else if (props.record?._id) {
    // For other record types, support lifecycle-stage, metrics, and related-organization widgets
    switch (widgetType) {
      case 'lifecycle-stage':
        Component = LifecycleStageWidget;
        componentProps.record = props.record;
        componentProps.recordType = props.recordType;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
      case 'metrics':
        Component = MetricsWidget;
        componentProps.stats = props.stats || {};
        componentProps.record = props.record;
        componentProps.recordType = props.recordType;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
      case 'key-fields':
        Component = KeyFieldsWidget;
        componentProps.record = props.record;
        componentProps.recordType = props.recordType;
        componentProps.moduleDefinition = moduleDefinition.value;
        break;
      case 'related-organization':
        Component = RelatedOrganizationWidget;
        // Handle organization field - it might be an object (populated) or just an ID
        const orgField = props.record.organization;
        if (orgField && typeof orgField === 'object' && orgField._id) {
          // Already populated object
          componentProps.organization = orgField;
        } else if (orgField && typeof orgField === 'string') {
          // Just an ID - we'll need to fetch it, but for now pass null
          // The widget will show empty state, and user can link an organization
          componentProps.organization = null;
        } else {
          // null or undefined
          componentProps.organization = null;
        }
        componentProps.moduleDefinition = allModuleDefinitions.value['organizations'];
        break;
      case 'related-deals':
        Component = RelatedDealsWidget;
        componentProps.contactId = props.record._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['deals'];
        break;
      case 'related-tasks':
        Component = RelatedTasksWidget;
        componentProps.contactId = props.record._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['tasks'];
        break;
      case 'related-events':
        Component = RelatedEventsWidget;
        componentProps.relatedType = 'Contact';
        componentProps.relatedId = props.record._id;
        componentProps.limit = 5;
        componentProps.moduleDefinition = allModuleDefinitions.value['events'];
        break;
    }
  } else {
    // Fallback to simple HTML widget for other record types
    container.innerHTML = getWidgetContent(widgetType);
    return container;
  }
  
  // Mount Vue component
  if (Component) {
    // Create wrapper component that handles events
    // IMPORTANT: Since we're using createApp, events don't bubble to parent
    // So we need to call the handler function directly
    // We need to get the record data from the widget props/state
    // Since widgets emit just IDs, we'll fetch the name in handleOpenRelatedRecord
    const handleViewContact = (id) => {
      handleOpenRelatedRecord({ type: 'people', id });
    };
    const handleViewUser = (id) => {
      handleOpenRelatedRecord({ type: 'users', id });
    };
    const handleViewDeal = (id) => {
      handleOpenRelatedRecord({ type: 'deals', id });
    };
    const handleViewOrganization = (id) => {
      handleOpenRelatedRecord({ type: 'organizations', id });
    };
    const handleViewTask = (id) => {
      handleOpenRelatedRecord({ type: 'tasks', id });
    };
    const handleViewEvent = (id) => {
      handleOpenRelatedRecord({ type: 'events', id });
    };
    const handleLinkContacts = () => {
      handleLinkRecords('people');
    };
    const handleLinkUsers = () => {
      handleLinkRecords('users');
    };
    const handleLinkDeals = () => {
      handleLinkRecords('deals');
    };
    const handleLinkTasks = () => {
      handleLinkRecords('tasks');
    };
    const handleLinkEvents = () => {
      handleLinkRecords('events');
    };
    const handleLinkOrganizations = () => {
      handleLinkRecords('organizations');
    };

    // Unlink / Delete handlers
    const handleUnlinkContact = async (id) => {
      try {
        let items = [];
        try { items = await fetchRecordsByIds('people', [id]); } catch {}
        await apiClient.put(`/people/${id}`, { organization: null });
        const suffixContact = items[0]?.name ? ` - ${items[0].name}` : '';
        try { await addActivityLog(`unlinked contact${suffixContact}`, { type: 'unlink', moduleKey: 'people', items }); } catch {}
        // Use nextTick to ensure DOM is updated before refreshing
        await nextTick();
        refreshAllWidgets();
      } catch (e) {
        console.error('Error unlinking contact:', e);
      }
    };
    const handleDeleteContact = async (id) => {
      try {
        await apiClient.delete(`/people/${id}`);
      } catch (e) {}
      refreshAllWidgets();
    };
    const handleUnlinkDeal = async (id) => {
      try {
        let items = [];
        try { items = await fetchRecordsByIds('deals', [id]); } catch {}
        if (props.recordType === 'organizations') {
          await apiClient.put(`/deals/${id}`, { accountId: null });
        } else if (props.recordType === 'people') {
          await apiClient.put(`/deals/${id}`, { contactId: null });
        }
        const suffixDeal = items[0]?.name ? ` - ${items[0].name}` : '';
        try { await addActivityLog(`unlinked deal${suffixDeal}`, { type: 'unlink', moduleKey: 'deals', items }); } catch {}
        await nextTick();
        refreshAllWidgets();
      } catch (e) {
        console.error('Error unlinking deal:', e);
      }
    };
    const handleDeleteDeal = async (id) => {
      try {
        await apiClient.delete(`/deals/${id}`);
      } catch (e) {}
      refreshAllWidgets();
    };
    const handleUnlinkTask = async (id) => {
      try {
        let items = [];
        try { items = await fetchRecordsByIds('tasks', [id]); } catch {}
        if (props.recordType === 'organizations') {
          await apiClient.put(`/tasks/${id}`, { organizationId: null });
        } else if (props.recordType === 'people') {
          await apiClient.put(`/tasks/${id}`, { contactId: null });
        }
        const suffixTask = items[0]?.name ? ` - ${items[0].name}` : '';
        try { await addActivityLog(`unlinked task${suffixTask}`, { type: 'unlink', moduleKey: 'tasks', items }); } catch {}
        await nextTick();
        refreshAllWidgets();
      } catch (e) {
        console.error('Error unlinking task:', e);
      }
    };
    const handleDeleteTask = async (id) => {
      try {
        await apiClient.delete(`/tasks/${id}`);
      } catch (e) {}
      refreshAllWidgets();
    };
    const handleUnlinkEvent = async (id) => {
      try {
        let items = [];
        try { items = await fetchRecordsByIds('events', [id]); } catch {}
        await apiClient.put(`/events/${id}`, { relatedType: null, relatedId: null });
        const suffixEvent = items[0]?.name ? ` - ${items[0].name}` : '';
        try { await addActivityLog(`unlinked event${suffixEvent}`, { type: 'unlink', moduleKey: 'events', items }); } catch {}
        await nextTick();
        refreshAllWidgets();
      } catch (e) {
        console.error('Error unlinking event:', e);
      }
    };
    const handleDeleteEvent = async (id) => {
      try {
        await apiClient.delete(`/events/${id}`);
      } catch (e) {}
      refreshAllWidgets();
    };
    const handleUnlinkOrganization = async (id) => {
      try {
        let items = [];
        try { items = await fetchRecordsByIds('organizations', [id]); } catch {}
        if (props.recordType === 'people') {
          await apiClient.put(`/people/${props.record._id}`, { organization: null });
          writeRecordField('organization', null);
        } else if (props.recordType === 'deals') {
          // Deals link to organizations via accountId
          await apiClient.put(`/deals/${props.record._id}`, { accountId: null });
          writeRecordField('accountId', null);
        } else if (props.recordType === 'tasks') {
          // Tasks link to organizations via organizationId
          await apiClient.put(`/tasks/${props.record._id}`, { organizationId: null });
          writeRecordField('organizationId', null);
        } else if (props.recordType === 'events') {
          // Events link generically via relatedType/relatedId
          await apiClient.put(`/events/${props.record._id}`, { relatedType: null, relatedId: null });
          writeRecordField('relatedType', null);
          writeRecordField('relatedId', null);
        }
        const suffixOrg = items[0]?.name ? ` - ${items[0].name}` : '';
        try { await addActivityLog(`unlinked organization${suffixOrg}`, { type: 'unlink', moduleKey: 'organizations', items }); } catch {}
        // Fetch the fresh record and notify parent so props update flows down to widgets
        try {
          let endpoint = '';
          if (props.recordType === 'people') endpoint = `/people/${props.record._id}`;
          else if (props.recordType === 'deals') endpoint = `/deals/${props.record._id}`;
          else if (props.recordType === 'tasks') endpoint = `/tasks/${props.record._id}`;
          else if (props.recordType === 'events') endpoint = `/events/${props.record._id}`;
          if (endpoint) {
            const res = await apiClient.get(endpoint);
            if (res && res.success && res.data) {
              emit('recordUpdated', res.data);
            }
          }
        } catch (fetchErr) {
          // Non-blocking; UI will still refresh widgets
        }
        await nextTick();
        refreshAllWidgets();
      } catch (e) {
        console.error('Error unlinking organization:', e);
      }
    };
    const handleDeleteOrganization = async (id) => {
      try {
        await apiClient.delete(`/v2/organization/${id}`);
      } catch (e) {}
      refreshAllWidgets();
    };
    
    const wrapperComponent = {
      setup(_, { expose }) {
        // Store reference to child component instance
        const childComponentRef = ref(null);
        
        // Pass props directly - widgets will watch for changes
        const handleUpdate = async (data) => {
          // Handle lifecycle stage updates - save immediately (no blur needed)
          if (data.field && data.value !== undefined) {
            // Update local state immediately for UI responsiveness
            writeRecordField(data.field, data.value);
            
            // Save immediately by emitting update event to parent
            // This will trigger the backend save and activity logging
            emit('update', {
              field: data.field,
              value: data.value,
              onSuccess: async () => {
                // Log activity for lifecycle stage change
                const fieldName = formatFieldName(data.field);
                const displayValue = formatValueForActivityLog(data.value, data.field);
                await addActivityLog(`changed ${fieldName} to "${displayValue}"`);
              }
            });
          }
        };
        
        // Expose refresh method that calls the child component's refresh
        expose({
          refresh: () => {
            if (childComponentRef.value && typeof childComponentRef.value.refresh === 'function') {
              childComponentRef.value.refresh();
            }
          }
        });
        
        return () => h(Component, {
          ref: childComponentRef,
          ...componentProps,
          // Pass reactive record from props if lifecycle-stage widget
          record: widgetType === 'lifecycle-stage' ? props.record : componentProps.record,
          recordType: widgetType === 'lifecycle-stage' ? props.recordType : componentProps.recordType,
          moduleDefinition: widgetType === 'lifecycle-stage' ? moduleDefinition.value : componentProps.moduleDefinition,
          // Pass reactive organization from props if related-organization widget
          // Handle organization field - it might be an object (populated) or just an ID
          organization: widgetType === 'related-organization' ? (() => {
            const orgField = props.record?.organization;
            if (orgField && typeof orgField === 'object' && orgField._id) {
              // Already populated object
              return orgField;
            } else if (orgField && typeof orgField === 'string') {
              // Just an ID - pass null for now, widget will show empty state
              // TODO: Could fetch organization here if needed
              return null;
            } else {
              // null or undefined
              return null;
            }
          })() : componentProps.organization,
          onViewContact: handleViewContact,
          onViewUser: handleViewUser,
          onViewDeal: handleViewDeal,
          onViewOrganization: handleViewOrganization,
          onViewTask: handleViewTask,
          onViewEvent: handleViewEvent,
          onLinkContacts: handleLinkContacts,
          onLinkUser: handleLinkUsers,
          onLinkDeals: handleLinkDeals,
          onLinkTasks: handleLinkTasks,
          onLinkEvents: handleLinkEvents,
          onLinkOrganizations: handleLinkOrganizations,
          // Unlink/Delete events from widgets
          onUnlinkContacts: handleUnlinkContact,
          onDeleteContact: handleDeleteContact,
          onUnlinkDeal: handleUnlinkDeal,
          onDeleteDeal: handleDeleteDeal,
          onUnlinkTask: handleUnlinkTask,
          onDeleteTask: handleDeleteTask,
          onUnlinkEvent: handleUnlinkEvent,
          onDeleteEvent: handleDeleteEvent,
          onUnlinkOrganization: handleUnlinkOrganization,
          onDeleteOrganization: handleDeleteOrganization,
          onCreateContact: () => handleCreateRecord('people'),
          onCreateUser: () => handleCreateRecord('users'),
          onCreateDeal: () => handleCreateRecord('deals'),
          onCreateTask: () => handleCreateRecord('tasks'),
          onCreateEvent: () => handleCreateRecord('events'),
          // Organization creation is disabled (no v2). Do not expose create action.
          onUpdate: handleUpdate
        });
      }
    };
    
    const app = createApp(wrapperComponent);
    app.mount(container);
    
    // Store app instance for cleanup
    widgetApps.set(container, { app });
  }
  
  return container;
};

// Get widget content based on type
const getWidgetContent = (widgetType) => {
  switch (widgetType) {
    case 'lifecycle-stage':
      return `<p>Status: ${props.record?.status || 'Active'}</p>`;
    case 'metrics':
      return `<p>${t('common.summaryNoMetrics')}</p>`;
    case 'key-fields':
      return `<p>${t('common.summaryKeyFieldsPlaceholder')}</p>`;
    default:
      return `<p>${t('common.summaryWidgetContent')}</p>`;
  }
};

// Add widget
// Get currently added widget types (reactive)
const addedWidgetTypes = computed(() => {
  // Access the trigger to make this computed reactive
  // This forces Vue to track this dependency
  const _widgetListRevision = widgetListUpdateTrigger.value;
  
  if (!gridStack) return [];
  
  // Get current widgets from GridStack
  // This will be re-evaluated whenever widgetListUpdateTrigger changes
  const widgets = gridStack.getGridItems();
  const types = widgets
    .map(item => {
      const type = item.getAttribute('data-widget-type');
      return type;
    })
    .filter(Boolean);
  
  // Return a new array to ensure reference equality triggers updates
  return [...types];
});

// Check if a widget is already added
const isWidgetAdded = (widgetType) => {
  return addedWidgetTypes.value.includes(widgetType);
};

// Get the default widget layout for the current record type
const getDefaultWidgetLayout = () => {
  const defaultWidgets = [];
  let yPosition = 0;
  
  // First row: Key Fields (25%), Lifecycle Stage (50%), Metrics (25%)
  // Key Fields: 3 columns (25%), Lifecycle Stage: 6 columns (50%), Metrics: 3 columns (25%)
  defaultWidgets.push(
    { type: 'key-fields', x: 0, y: yPosition, w: 3, h: 4 },
    { type: 'lifecycle-stage', x: 3, y: yPosition, w: 6, h: 4 },
    { type: 'metrics', x: 9, y: yPosition, w: 3, h: 4 }
  );
  yPosition += 4;
  
  // Then add related widgets based on record type
  if (props.recordType === 'organizations') {
    defaultWidgets.push(
      { type: 'related-contacts', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-deals', x: 6, y: yPosition, w: 6, h: 4 }
    );
  } else if (props.recordType === 'people') {
    defaultWidgets.push(
      { type: 'related-organization', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-deals', x: 6, y: yPosition, w: 6, h: 4 }
    );
    yPosition += 4;
    defaultWidgets.push(
      { type: 'related-tasks', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-events', x: 6, y: yPosition, w: 6, h: 4 }
    );
  } else if (props.recordType === 'deals') {
    defaultWidgets.push(
      { type: 'related-contacts', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-organization', x: 6, y: yPosition, w: 6, h: 4 }
    );
    yPosition += 4;
    defaultWidgets.push(
      { type: 'related-tasks', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-events', x: 6, y: yPosition, w: 6, h: 4 }
    );
  } else if (props.recordType === 'tasks') {
    defaultWidgets.push(
      { type: 'related-contacts', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-organization', x: 6, y: yPosition, w: 6, h: 4 }
    );
    yPosition += 4;
    defaultWidgets.push(
      { type: 'related-deals', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-events', x: 6, y: yPosition, w: 6, h: 4 }
    );
  } else if (props.recordType === 'events') {
    defaultWidgets.push(
      { type: 'related-contacts', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-organization', x: 6, y: yPosition, w: 6, h: 4 }
    );
    yPosition += 4;
    defaultWidgets.push(
      { type: 'related-deals', x: 0, y: yPosition, w: 6, h: 4 },
      { type: 'related-tasks', x: 6, y: yPosition, w: 6, h: 4 }
    );
  }
  
  return defaultWidgets;
};

// Check if current layout differs from default layout
const hasLayoutChanges = computed(() => {
  // Access the trigger to make this computed reactive to layout changes
  const _layoutRevision = layoutChangeTrigger.value;
  const _widgetListRevisionForLayout = widgetListUpdateTrigger.value;
  
  if (!gridStack) return false;
  
  const currentWidgets = gridStack.getGridItems();
  const currentLayout = currentWidgets.map(widget => {
    const type = widget.getAttribute('data-widget-type');
    const x = parseInt(widget.getAttribute('gs-x')) || 0;
    const y = parseInt(widget.getAttribute('gs-y')) || 0;
    const w = parseInt(widget.getAttribute('gs-w')) || 4;
    const h = parseInt(widget.getAttribute('gs-h')) || 3;
    return { type, x, y, w, h };
  }).filter(w => w.type).sort((a, b) => {
    // Sort by y first, then by x
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
  
  const defaultLayout = getDefaultWidgetLayout().sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
  
  // Compare layouts
  if (currentLayout.length !== defaultLayout.length) return true;
  
  // Check if each widget matches the default position and size
  for (let i = 0; i < currentLayout.length; i++) {
    const current = currentLayout[i];
    const defaultWidget = defaultLayout.find(d => d.type === current.type);
    
    if (!defaultWidget) return true; // Widget not in default layout
    if (current.x !== defaultWidget.x || current.y !== defaultWidget.y || 
        current.w !== defaultWidget.w || current.h !== defaultWidget.h) {
      return true; // Position or size differs
    }
  }
  
  return false;
});

// Open reset confirmation modal
const resetToDefaultLayout = () => {
  if (!gridStack) return;
  showResetConfirmModal.value = true;
};

// Confirm and perform reset layout
const confirmResetLayout = async () => {
  showResetConfirmModal.value = false;
  
  if (!gridStack) return;
  
  try {
    // Remove all existing widgets
    const existingWidgets = gridStack.getGridItems();
    existingWidgets.forEach(widget => {
      try {
        gridStack.removeWidget(widget, false);
      } catch (e) {
        // Fallback: remove from DOM
        if (widget.parentNode) {
          widget.remove();
        }
      }
    });
    
    await nextTick();
    gridStack.compact();
    
    // Clear the saved layout from localStorage and API
    // This ensures the page loads fresh defaults on reload
    const storageKey = getLayoutStorageKey();
    localStorage.removeItem(storageKey);
    
    // Try to clear from API as well
    try {
      await apiClient.delete('/user-preferences/widget-layout', {
        params: {
          recordType: props.recordType,
          recordId: 'module'
        }
      });
    } catch (error) {
      // Ignore errors - API might not support DELETE or might not exist
      console.log('Could not clear API layout (may not exist)');
    }
    
    // Close the widget drawer if open
    showWidgetModal.value = false;
    
    // Wait a moment for cleanup to complete
    await nextTick();
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Reload the page to show the new default layout
    // This ensures a clean state and proper loading of default widgets
    window.location.reload();
  } catch (error) {
    console.error('Error resetting layout to default:', error);
    notifications.error(t('common.summaryResetLayoutFailed'));
  }
};

// Remove widget from grid
const removeWidget = async (widgetType) => {
  if (!gridStack) return;
  
  const widgets = gridStack.getGridItems();
  const widgetToRemove = widgets.find(item => 
    item.getAttribute('data-widget-type') === widgetType
  );
  
  if (widgetToRemove) {
    // Find and unmount the Vue app if it exists
    const contentEl = widgetToRemove.querySelector('.grid-stack-item-content');
    const container = contentEl?.firstElementChild;
    if (container) {
      const widgetAppsEntry = widgetApps.get(container);
      if (widgetAppsEntry?.app) {
        try {
          widgetAppsEntry.app.unmount();
          widgetApps.delete(container);
        } catch (e) {
          console.error('Error unmounting widget app:', e);
        }
      }
    }
    
    // Remove from GridStack - try multiple approaches
    try {
      // Method 1: Use GridStack's removeWidget method
      gridStack.removeWidget(widgetToRemove, false);
    } catch (e) {
      console.warn('removeWidget failed, trying direct DOM removal:', e);
      // Method 2: Remove directly from DOM if GridStack method fails
      if (widgetToRemove && widgetToRemove.parentNode) {
        widgetToRemove.remove();
        // Force GridStack to update
        await nextTick();
        gridStack.compact();
      }
    }
    
    // Wait for GridStack to fully process the removal
    await nextTick();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify the widget is actually removed
    const remainingWidgets = gridStack.getGridItems();
    let stillExists = remainingWidgets.some(item => 
      item.getAttribute('data-widget-type') === widgetType
    );
    
    // If still exists, try direct DOM removal
    if (stillExists) {
      console.warn('Widget still exists after GridStack removal, trying direct DOM removal');
      const widgetToRemoveDirect = remainingWidgets.find(item => 
        item.getAttribute('data-widget-type') === widgetType
      );
      
      if (widgetToRemoveDirect && widgetToRemoveDirect.parentNode) {
        // Remove from DOM directly
        widgetToRemoveDirect.remove();
        // Force GridStack to update
        await nextTick();
        gridStack.compact();
        await nextTick();
        
        // Verify again
        const finalWidgets = gridStack.getGridItems();
        stillExists = finalWidgets.some(item => 
          item.getAttribute('data-widget-type') === widgetType
        );
      }
    }
    
    if (stillExists) {
      console.error('Failed to remove widget - it still exists in the grid');
      // Don't return - continue anyway and save what we have
      // The widget might be in a weird state, but we should still save the layout
    }
    
    // Force Vue to re-render the drawer by triggering a reactive update
    // This will make the button change from "Remove" to "Add"
    // Increment the trigger to force computed property re-evaluation
    widgetListUpdateTrigger.value = widgetListUpdateTrigger.value + 1;
    
    // Wait for Vue to process the reactive update
    await nextTick();
    await nextTick(); // Double tick to ensure all updates propagate
    
    // Get fresh widget list to ensure we're saving the correct state
    const currentWidgets = gridStack.getGridItems();
    const currentTypes = currentWidgets
      .map(item => item.getAttribute('data-widget-type'))
      .filter(Boolean);
    
    // Double-check that removed widget is NOT in the list
    if (currentTypes.includes(widgetType)) {
      console.error('ERROR: Removed widget still in grid items!', currentTypes);
      return; // Don't save if widget is still there
    }
    
    console.log('Current widgets after removal:', currentTypes);
    console.log('Removed widget type:', widgetType);
    console.log('✓ Removed widget confirmed NOT in list');
    
    // Force save immediately (don't wait for debounced save)
    await saveLayoutState();
    layoutChangeTrigger.value++; // Trigger layout change detection
    
    // Verify what was saved
    await nextTick();
    const savedLayout = localStorage.getItem(getLayoutStorageKey());
    if (savedLayout) {
      const parsed = JSON.parse(savedLayout);
      const savedTypes = parsed.map(w => w.type);
      console.log('Saved widget types:', savedTypes);
      if (savedTypes.includes(widgetType)) {
        console.error('ERROR: Removed widget found in saved layout!');
      } else {
        console.log('✓ Removed widget confirmed NOT in saved layout');
      }
    } else {
      console.warn('No saved layout found in localStorage');
    }
    
    // Refresh remaining widgets to ensure they're up to date
    await nextTick();
    refreshAllWidgets();
  }
};

const addWidget = async (widgetType) => {
  // Don't add if already added
  if (isWidgetAdded(widgetType)) {
    return;
  }
  
  if (!gridStack) {
    console.warn('GridStack not initialized, cannot add widget');
    return;
  }
  
  // Find the bottom-most widget position (highest y + h value)
  const existingWidgets = gridStack.getGridItems();
  let bottomY = 0;
  
  if (existingWidgets.length > 0) {
    // Find the maximum bottom position (y + h) of all existing widgets
    existingWidgets.forEach(widget => {
      const y = parseInt(widget.getAttribute('gs-y')) || 0;
      const h = parseInt(widget.getAttribute('gs-h')) || 3;
      const bottom = y + h;
      if (bottom > bottomY) {
        bottomY = bottom;
      }
    });
  }
  
  // Default widget size
  const defaultW = 6;
  const defaultH = 4;
  
  // Check if there's space on the current row (bottomY)
  // Find widgets on the bottom row
  const widgetsOnBottomRow = existingWidgets.filter(widget => {
    const y = parseInt(widget.getAttribute('gs-y')) || 0;
    const h = parseInt(widget.getAttribute('gs-h')) || 3;
    return (y + h) === bottomY;
  });
  
  // Calculate position for new widget
  let x = 0;
  let y = bottomY;
  
  // If there's a widget on the left side (x=0) of the bottom row, place new widget on the right (x=6)
  const hasLeftWidget = widgetsOnBottomRow.some(widget => {
    const widgetX = parseInt(widget.getAttribute('gs-x')) || 0;
    return widgetX === 0;
  });
  
  if (hasLeftWidget && widgetsOnBottomRow.length === 1) {
    // Place on the right side of the existing widget
    x = 6;
  } else {
    // Place on a new row
    y = bottomY;
    x = 0;
  }
  
  // Add widget at calculated position
  const newWidget = addWidgetToGrid(widgetType, x, y, defaultW, defaultH);
  
  // Wait for widget to be added to grid
  await nextTick();
  
  // Auto-scroll to the newly added widget
  if (newWidget) {
    await nextTick();
    // Use smooth scroll to bring the widget into view
    setTimeout(() => {
      // Find the nearest scrollable parent or use window
      let scrollableParent = null;
      let element = newWidget.parentElement;
      
      // Traverse up to find a scrollable container
      while (element && element !== document.body) {
        const style = window.getComputedStyle(element);
        const overflowY = style.overflowY;
        const hasScroll = element.scrollHeight > element.clientHeight;
        
        if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && hasScroll) {
          scrollableParent = element;
          break;
        }
        element = element.parentElement;
      }
      
      // Use scrollIntoView with smooth behavior
      if (newWidget.scrollIntoView) {
        newWidget.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center', // Center the widget in viewport
          inline: 'nearest' 
        });
      } else if (scrollableParent) {
        // Fallback: scroll the scrollable parent
        const widgetRect = newWidget.getBoundingClientRect();
        const parentRect = scrollableParent.getBoundingClientRect();
        const scrollTop = scrollableParent.scrollTop + (widgetRect.top - parentRect.top) - (scrollableParent.clientHeight / 2);
        scrollableParent.scrollTo({ top: scrollTop, behavior: 'smooth' });
      } else {
        // Final fallback: use window scroll
        const widgetRect = newWidget.getBoundingClientRect();
        const scrollTop = window.scrollY + widgetRect.top - (window.innerHeight / 2);
        window.scrollTo({ top: scrollTop, behavior: 'smooth' });
      }
    }, 150); // Slightly longer delay to ensure widget is fully rendered
  }
  
  // Update trigger to reflect the change in the drawer (if still open)
  widgetListUpdateTrigger.value++;
  layoutChangeTrigger.value++; // Trigger layout change detection
  
  // Save layout state
  await saveLayoutState();
  
  // Refresh all widgets including the newly added one
  await nextTick();
  refreshAllWidgets();
  
  showWidgetModal.value = false;
};

// Toggle follow
const toggleFollow = () => {
  isFollowing.value = !isFollowing.value;
  
  // Log activity
  if (isFollowing.value) {
    addActivityLog('started following this record');
  } else {
    addActivityLog('stopped following this record');
  }
};

// Copy URL
const copyUrl = () => {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    notifications.success(t('common.summaryUrlCopied'));
  });
};

// Add tag
const addTag = () => {
  if (newTag.value.trim()) {
    const tagName = newTag.value.trim();
    tags.value.push(tagName);
    newTag.value = '';
    showTagModal.value = false;
    
    // Log activity
    addActivityLog(`added tag "${tagName}"`);
  }
};

// Remove tag
const removeTag = (index) => {
  const tagName = tags.value[index];
  tags.value.splice(index, 1);
  
  // Log activity
  if (tagName) {
    addActivityLog(`removed tag "${tagName}"`);
  }
};

// Helper function to normalize values for comparison
const normalizeValue = (val) => {
  if (val === null || val === undefined || val === '') return '';
  
  // Handle arrays (for multi-picklist fields)
  if (Array.isArray(val)) {
    return JSON.stringify(val.sort());
  }
  
  // Handle objects
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  
  return String(val).trim();
};

// Format field value for display in activity logs
const formatValueForActivityLog = (value, fieldKey = null) => {
  if (value === null || value === undefined || value === '') return '';
  
  // First, check if the record has a populated version of this field
  // (e.g., if value is an ObjectId string, check if record[fieldKey] is populated)
  if (fieldKey && props.record && typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
    // Helper to find field value case-insensitively
    const getFieldValue = (record, fieldName) => {
      if (!record) return null;
      
      // Map common UI field names to database field names
      const fieldMap = {
        'assigned to': 'assignedTo',
        'assignedto': 'assignedTo',
        'lead owner': 'lead_owner',
        'leadowner': 'lead_owner',
        'created by': 'createdBy',
        'createdby': 'createdBy'
      };
      
      const normalizedFieldName = fieldName.toLowerCase().replace(/\s+/g, '');
      const dbFieldName = fieldMap[normalizedFieldName] || fieldName;
      
      // Try exact match first (database field name)
      if (record[dbFieldName] !== undefined) return record[dbFieldName];
      if (record[fieldName] !== undefined) return record[fieldName];
      
      // Try case-insensitive match
      const fieldKey = Object.keys(record).find(k => 
        k.toLowerCase() === dbFieldName.toLowerCase() || 
        k.toLowerCase() === fieldName.toLowerCase() ||
        k.toLowerCase().replace(/\s+/g, '') === normalizedFieldName
      );
      return fieldKey ? record[fieldKey] : null;
    };
    
    const recordValue = getFieldValue(props.record, fieldKey);
    // If record has a populated object, use that instead
    if (recordValue && typeof recordValue === 'object' && !Array.isArray(recordValue)) {
      // Recursively call with the populated object
      return formatValueForActivityLog(recordValue, fieldKey);
    }
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    // Format array items
    return value.map(item => formatValueForActivityLog(item, fieldKey)).join(', ');
  }
  
  // Handle objects (especially lookup fields)
  if (typeof value === 'object') {
    // Check if it's a populated lookup field with user info
    if (value.firstName || value.lastName) {
      const firstName = value.firstName || '';
      const lastName = value.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName) return fullName;
    }
    
    // Check for first_name/last_name (snake_case)
    if (value.first_name || value.last_name) {
      const firstName = value.first_name || '';
      const lastName = value.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName) return fullName;
    }
    
    // Check for name field (organizations, deals, etc.)
    if (value.name) return value.name;
    
    // Check for title field
    if (value.title) return value.title;
    
    // Check for username field
    if (value.username) return value.username;
    
    // Check for email field
    if (value.email) return value.email;
    
    // Check if it's an ObjectId (has _id but no other display fields)
    if (value._id) {
      // If it's a 24-character hex string (ObjectId), try to get field definition
      const idStr = String(value._id);
      if (/^[0-9a-fA-F]{24}$/.test(idStr)) {
        // Check if this is a lookup field - if so, we can't resolve it without an API call
        const fieldDef = getFieldDefinition(fieldKey);
        if (fieldDef && (fieldDef.dataType === 'Lookup (Relationship)' || fieldDef.dataType === 'Lookup')) {
          return '[User]'; // Better placeholder for lookup fields
        }
        return '[User ID]';
      }
      return idStr;
    }
    
    // Fallback: try to extract a meaningful value
    return '[Object]';
  }
  
  // Handle strings - check if it's an ObjectId
  if (typeof value === 'string') {
    if (/^[0-9a-fA-F]{24}$/.test(value)) {
      // Before returning placeholder, try one more time to get populated value from record
      if (fieldKey && props.record) {
        // Helper to find field value case-insensitively
        const getFieldValue = (record, fieldName) => {
          if (!record) return null;
          const fieldMap = {
            'assigned to': 'assignedTo',
            'assignedto': 'assignedTo',
            'lead owner': 'lead_owner',
            'leadowner': 'lead_owner',
            'created by': 'createdBy',
            'createdby': 'createdBy'
          };
          const normalizedFieldName = fieldName.toLowerCase().replace(/\s+/g, '');
          const dbFieldName = fieldMap[normalizedFieldName] || fieldName;
          if (record[dbFieldName] !== undefined) return record[dbFieldName];
          if (record[fieldName] !== undefined) return record[fieldName];
          const foundKey = Object.keys(record).find(k => 
            k.toLowerCase() === dbFieldName.toLowerCase() || 
            k.toLowerCase() === fieldName.toLowerCase() ||
            k.toLowerCase().replace(/\s+/g, '') === normalizedFieldName
          );
          return foundKey ? record[foundKey] : null;
        };
        
        const populatedValue = getFieldValue(props.record, fieldKey);
        if (populatedValue && typeof populatedValue === 'object' && !Array.isArray(populatedValue)) {
          // We found a populated object! Format it
          return formatValueForActivityLog(populatedValue, fieldKey);
        }
      }
      
      // Check if this is a lookup field - if so, we can't resolve it without an API call
      const fieldDef = getFieldDefinition(fieldKey);
      if (fieldDef && (fieldDef.dataType === 'Lookup (Relationship)' || fieldDef.dataType === 'Lookup')) {
        return '[User]'; // Better placeholder for lookup fields
      }
      return '[User ID]';
    }
    return value.trim();
  }
  
  return String(value);
};

/** Treat as phone when module says Phone or common CRM keys (covers mis-typed module definitions). */
function shouldCoercePhoneField(fieldKey) {
  const k = String(fieldKey || '').toLowerCase();
  const fd = moduleDefinition.value?.fields?.find(
    (f) => f?.key && f.key.toLowerCase() === k
  );
  return fd?.dataType === 'Phone' || k === 'phone' || k === 'mobile';
}

function coerceSummaryPhoneValue(fieldKey, raw) {
  if (!shouldCoercePhoneField(fieldKey)) return raw;
  return sanitizeInternationalPhone(raw == null ? '' : String(raw));
}

// Update field value (for immediate UI updates during typing - no save, no log)
const updateField = (field, value) => {
  const nextValue = coerceSummaryPhoneValue(field, value);
  if (shouldCoercePhoneField(field) && fieldErrors.value[field]) {
    const next = { ...fieldErrors.value };
    delete next[field];
    fieldErrors.value = next;
  }

  const oldValue = props.record ? props.record[field] : null;
  
  // Normalize values for comparison
  const normalizedOldValue = normalizeValue(oldValue);
  const normalizedNewValue = normalizeValue(nextValue);
  
  // Only proceed if value actually changed
  if (normalizedOldValue === normalizedNewValue) {
    // Clear pending change if value reverted to original
    if (pendingFieldChanges.value[field]) {
      delete pendingFieldChanges.value[field];
    }
    return; // No change, don't update
  }
  
  // Update local state immediately for UI responsiveness
  writeRecordField(field, nextValue);
  
  // Track pending change (store original value if this is the first change)
  if (!pendingFieldChanges.value[field]) {
    pendingFieldChanges.value[field] = {
      originalValue: oldValue,
      currentValue: nextValue
    };
  } else {
    // Update current value
    pendingFieldChanges.value[field].currentValue = nextValue;
  }
  
  // Mark that we're no longer in initial load - field values are being changed
  isInitialLoad.value = false;
  // Reset popup evaluation flag so we check again after this change
  hasEvaluatedPopupsForCurrentState.value = false;
  // Mark that this is a user-initiated field change (not a render/initialization)
  userInitiatedFieldChange.value = true;
  
  // Check for popup triggers after field update
  setTimeout(() => {
    checkForPopupTriggers();
  }, 100);
};

// Handle field changes from header dropdowns - save immediately
const handleHeaderFieldChange = (field, value) => {
  console.log('📝 handleHeaderFieldChange called:', { field, value, valueType: typeof value });
  const oldValue = props.record ? props.record[field] : null;
  
  // Normalize values for comparison
  const normalizedOldValue = normalizeValue(oldValue);
  const normalizedNewValue = normalizeValue(value);
  
  // Only proceed if value actually changed
  if (normalizedOldValue === normalizedNewValue) {
    return; // No change, don't update
  }
  
  // Format values for display in activity log BEFORE updating the record
  // (so we can use populated objects if they exist)
  const displayOldValue = formatValueForActivityLog(oldValue, field);
  
  // For the new value, check if it's an ObjectId and if we have a populated version in the record
  // (this happens when selecting from a dropdown - the value is an ObjectId but the record might have the populated object)
  let displayNewValue = formatValueForActivityLog(value, field);
  
  // If new value is an ObjectId string, check if we can find the populated object in the record
  // (sometimes the record gets updated with populated data before we format)
  if (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value) && props.record) {
    // Check if there's a populated version somewhere in the record
    // Some fields might be stored with different casing
    const fieldKeys = Object.keys(props.record);
    const matchingKey = fieldKeys.find(k => k.toLowerCase() === field.toLowerCase());
    if (matchingKey) {
      const recordFieldValue = props.record[matchingKey];
      if (recordFieldValue && typeof recordFieldValue === 'object' && !Array.isArray(recordFieldValue)) {
        // Check if this object's _id matches the value
        if (recordFieldValue._id && String(recordFieldValue._id) === value) {
          displayNewValue = formatValueForActivityLog(recordFieldValue, field);
        }
      }
    }
  }
  
  // Update local state immediately for UI responsiveness
  writeRecordField(field, value);
  
  // For header field changes (lifecycle/status fields), save immediately
  // Emit update event so parent can update its record and save to backend
  const fieldName = formatFieldName(field);
  
  emit('update', {
    field,
    value,
    onSuccess: async (updatedRecord = null) => {
      // Wait a tick to ensure Vue reactivity has updated props.record
      await nextTick();
      
      // Format values again AFTER the record is updated with populated fields from the backend
      // This ensures we use the populated objects instead of ObjectIds
      const finalOldValue = oldValue; // Keep original oldValue (before update)
      
      // Try to get the populated value from the updated record (passed as parameter or from props.record)
      // Handle case-insensitive field matching and field name variations
      let finalNewValue = value;
      
      // Helper to find field value case-insensitively and handle field name variations
      const getFieldValue = (record, fieldName) => {
        if (!record) return null;
        
        // Map common UI field names to database field names
        const fieldMap = {
          'assigned to': 'assignedTo',
          'assignedto': 'assignedTo',
          'lead owner': 'lead_owner',
          'leadowner': 'lead_owner',
          'created by': 'createdBy',
          'createdby': 'createdBy'
        };
        
        const normalizedFieldName = fieldName.toLowerCase().replace(/\s+/g, '');
        const dbFieldName = fieldMap[normalizedFieldName] || fieldName;
        
        // Try exact match first (database field name)
        if (record[dbFieldName] !== undefined) return record[dbFieldName];
        if (record[fieldName] !== undefined) return record[fieldName];
        
        // Try case-insensitive match
        const fieldKey = Object.keys(record).find(k => 
          k.toLowerCase() === dbFieldName.toLowerCase() || 
          k.toLowerCase() === fieldName.toLowerCase() ||
          k.toLowerCase().replace(/\s+/g, '') === normalizedFieldName
        );
        return fieldKey ? record[fieldKey] : null;
      };
      
      // Prioritize updatedRecord (from backend response) over props.record
      const updatedValue = updatedRecord ? getFieldValue(updatedRecord, field) : null;
      const recordValue = props.record ? getFieldValue(props.record, field) : null;
      
      // Debug: Log what we're getting (temporary - remove after fixing)
      console.log('🔍 Activity log formatting debug:', {
        field,
        fieldType: typeof field,
        value,
        valueType: typeof value,
        isValueObjectId: typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value),
        hasUpdatedRecord: !!updatedRecord,
        updatedRecordKeys: updatedRecord ? Object.keys(updatedRecord).filter(k => k.toLowerCase().includes('assign') || k.toLowerCase().includes('lead')).slice(0, 5) : null,
        updatedValue,
        updatedValueType: updatedValue ? typeof updatedValue : null,
        updatedValueIsObject: updatedValue ? (typeof updatedValue === 'object' && !Array.isArray(updatedValue)) : null,
        hasPropsRecord: !!props.record,
        recordValue,
        recordValueType: recordValue ? typeof recordValue : null,
        recordValueIsObject: recordValue ? (typeof recordValue === 'object' && !Array.isArray(recordValue)) : null
      });
      
      // Prefer populated object over ObjectId string
      if (updatedValue !== null && updatedValue !== undefined) {
        // If it's an object (populated), use it
        if (typeof updatedValue === 'object' && !Array.isArray(updatedValue) && updatedValue !== null) {
          console.log('✅ Using populated updatedValue:', updatedValue);
          finalNewValue = updatedValue;
        } else if (typeof updatedValue === 'string' && !/^[0-9a-fA-F]{24}$/.test(updatedValue)) {
          // It's a regular string value, use it
          finalNewValue = updatedValue;
        } else {
          // It's an ObjectId, try to find populated version from props.record
          if (recordValue && typeof recordValue === 'object' && !Array.isArray(recordValue)) {
            console.log('✅ Using populated recordValue:', recordValue);
            finalNewValue = recordValue;
          } else {
            console.warn('⚠️ No populated value found, using ObjectId:', updatedValue);
            finalNewValue = updatedValue;
          }
        }
      } else if (recordValue !== null && recordValue !== undefined) {
        // If it's an object (populated), use it
        if (typeof recordValue === 'object' && !Array.isArray(recordValue) && recordValue !== null) {
          console.log('✅ Using populated recordValue (fallback):', recordValue);
          finalNewValue = recordValue;
        } else {
          finalNewValue = recordValue;
        }
      } else {
        console.warn('⚠️ No value found in updatedRecord or props.record, using original value');
      }
      
      // Format with the updated record context
      const finalDisplayOldValue = formatValueForActivityLog(finalOldValue, field);
      const finalDisplayNewValue = formatValueForActivityLog(finalNewValue, field);
      
      // Log activity for field change
      let action = '';
      if (normalizedOldValue === '' || normalizedOldValue === null || normalizedOldValue === undefined) {
        action = `set ${fieldName} to "${finalDisplayNewValue}"`;
      } else {
        action = `changed ${fieldName} from "${finalDisplayOldValue}" to "${finalDisplayNewValue}"`;
      }
      await addActivityLog(action);
    }
  });
  
  // Mark that we're no longer in initial load - field values are being changed
  isInitialLoad.value = false;
  // Reset popup evaluation flag so we check again after this change
  hasEvaluatedPopupsForCurrentState.value = false;
  // Mark that this is a user-initiated field change (not a render/initialization)
  userInitiatedFieldChange.value = true;
  
  // Check for popup triggers after field update
  setTimeout(() => {
    checkForPopupTriggers();
  }, 100);
};

// Check for popup triggers across all fields
const checkForPopupTriggers = () => {
  // Don't check if modal is already open
  if (!moduleDefinition.value?.fields || showPopupModal.value) return;
  
  // Don't check if component hasn't been fully initialized yet
  if (!componentInitialized.value) {
    return;
  }
  
  // Skip popup check on initial load - only show popups when values actually change
  if (isInitialLoad.value) {
    return;
  }
  
  // Only check popups when user explicitly changes a field value via updateField()
  // This prevents popups from appearing when switching tabs or when Vue re-renders
  if (!userInitiatedFieldChange.value) {
    return;
  }
  
  // Store the flag value before resetting (we need it for the final check)
  const wasUserInitiated = userInitiatedFieldChange.value;
  
  // Reset the flag after checking
  userInitiatedFieldChange.value = false;
  
  // If we've already evaluated popups for this record state, don't check again
  if (hasEvaluatedPopupsForCurrentState.value) {
    return;
  }
  
  // Mark that we're evaluating popups for this state
  hasEvaluatedPopupsForCurrentState.value = true;
  
  const allFields = moduleDefinition.value.fields;
  const currentFormData = props.record || {};
  
  // Check each field for popup dependencies
  for (const field of allFields) {
    if (!field.dependencies || !Array.isArray(field.dependencies)) continue;
    
    // Check each dependency of this field
    for (const dep of field.dependencies) {
      if (dep.type === 'popup' && dep.popupFields && Array.isArray(dep.popupFields) && dep.popupFields.length > 0) {
        // Evaluate if dependency conditions are met
        const conditionMet = evaluateDependency(dep, currentFormData, allFields, {
          moduleKey: props.recordType,
        });
        
        if (conditionMet) {
          const triggerKey = `${field.key}-${dep.name || 'popup'}-${dep.popupFields.join(',')}`;
          
          // Only show popup once per trigger (unless form data was reset)
          if (!processedPopupTriggers.value.has(triggerKey)) {
            // Get the fields to show in the popup
            const popupFields = allFields.filter(f => 
              dep.popupFields.includes(f.key)
            );
            
            if (popupFields.length > 0) {
              // Mark this trigger as processed
              processedPopupTriggers.value.add(triggerKey);
              
              // Final safeguard: Only show popup if this was triggered by user action
              // This prevents any edge cases where popups might appear during initialization
              if (!wasUserInitiated || isInitialLoad.value) {
                console.warn('Popup trigger blocked: not user-initiated or still in initial load', {
                  wasUserInitiated,
                  isInitialLoad: isInitialLoad.value,
                  componentInitialized: componentInitialized.value
                });
                return;
              }
              
              // Show the popup
              popupModalConfig.value = {
                title: dep.name || 'Update Fields',
                description: `Please update the following fields:`,
                fields: popupFields
              };
              showPopupModal.value = true;
              return; // Exit after showing one popup
            }
          }
        }
      }
    }
  }
};

const closePopupModal = () => {
  showPopupModal.value = false;
};

const handlePopupSave = async (updatedData) => {
  // Update the record with the values from the popup
  if (props.record && props.record._id) {
    try {
      // Determine the API endpoint based on recordType
      const recordId = props.record._id;
      
      let endpoint = '';
      if (props.recordType === 'people') {
        // Always use tenant-scoped endpoint for data isolation
        endpoint = `/people/${recordId}`;
      } else {
        // For other record types, construct endpoint from recordType
        const moduleKey = props.recordType === 'organizations' ? 'organizations' 
          : props.recordType === 'deals' ? 'deals'
          : props.recordType === 'tasks' ? 'tasks'
          : props.recordType === 'events' ? 'events'
          : props.recordType;
        endpoint = `/${moduleKey}/${recordId}`;
      }
      
      // Store old values before updating for activity logging
      const oldValues = {};
      for (const [key, value] of Object.entries(updatedData)) {
        oldValues[key] = props.record[key] !== undefined ? props.record[key] : null;
      }
      
      // Update local state immediately for UI responsiveness
      for (const [key, value] of Object.entries(updatedData)) {
        writeRecordField(key, value);
      }
      
      // Save all fields to backend in a single API call
      const response = await apiClient.put(endpoint, updatedData);
      
      // Update local state with the response (which has populated fields)
      if (response.success && response.data && props.record) {
        // Update the record with the populated data from the server
        Object.assign(props.record, response.data);
      }
      
      // Log activity for each field change
      // Format values AFTER the record is updated with populated fields from the backend
      for (const [key, value] of Object.entries(updatedData)) {
        const oldValue = oldValues[key];
        const fieldName = formatFieldName(key);
        let action = '';
        const normalizedOldValue = normalizeValue(oldValue);
        const normalizedNewValue = normalizeValue(value);
        
        // Format values for display in activity log
        // Use the updated record value (which may be populated) instead of the raw value
        const finalOldValue = oldValue; // Keep original oldValue (before update)
        const finalNewValue = props.record ? props.record[key] : value; // Use updated record value (may be populated)
        
        const displayOldValue = formatValueForActivityLog(finalOldValue, key);
        const displayNewValue = formatValueForActivityLog(finalNewValue, key);
        
        if (normalizedOldValue === '' || normalizedOldValue === null || normalizedOldValue === undefined) {
          action = `set ${fieldName} to "${displayNewValue}"`;
        } else if (normalizedOldValue !== normalizedNewValue) {
          action = `changed ${fieldName} from "${displayOldValue}" to "${displayNewValue}"`;
        }
        
        if (action) {
          await addActivityLog(action);
        }
      }
      
      // Emit recordUpdated event to notify parent
      emit('recordUpdated', props.record);
      
      // Also emit individual update events for each field to maintain consistency
      // (some parent components might listen to these)
      for (const [key, value] of Object.entries(updatedData)) {
        emit('update', {
          field: key,
          value: value
        });
      }
    } catch (err) {
      console.error('Error saving dependency popup fields:', err);
      // Revert local changes on error
      // Note: We'd need to store original values to properly revert
      // For now, just show an error - the parent component should handle refresh
      notifications.error(t('common.summarySaveFieldsFailed'));
      return;
    }
  }
  closePopupModal();
};

// Save field and log activity (called on blur)
const saveFieldOnBlur = async (field) => {
  console.log('📝 saveFieldOnBlur called for field:', field);
  const pendingChange = pendingFieldChanges.value[field];
  
  // If no pending change, nothing to save
  if (!pendingChange) {
    console.log('   No pending change for field:', field);
    return;
  }
  
  const fieldName = formatFieldName(field);
  const { originalValue } = pendingChange;
  let { currentValue } = pendingChange;

  if (shouldCoercePhoneField(field)) {
    currentValue = coerceSummaryPhoneValue(field, currentValue);
    writeRecordField(field, currentValue);
    pendingFieldChanges.value[field] = { originalValue, currentValue };

    const phoneValidation = validatePhoneValue(currentValue);
    if (!phoneValidation.isValid) {
      fieldErrors.value = { ...fieldErrors.value, [field]: phoneValidation.error };
      return;
    }
    const nextErr = { ...fieldErrors.value };
    delete nextErr[field];
    fieldErrors.value = nextErr;
  }
  
  // Normalize values for final comparison
  const normalizedOldValue = normalizeValue(originalValue);
  const normalizedNewValue = normalizeValue(currentValue);
  
  // If values are the same, don't save
  if (normalizedOldValue === normalizedNewValue) {
    delete pendingFieldChanges.value[field];
    return;
  }
  
  // Clear pending change before saving (to prevent double-save if blur fires multiple times)
  delete pendingFieldChanges.value[field];
  
  // Emit update event with a callback to handle post-update activity logging
  // The parent should call this callback after successful backend save
  emit('update', { 
    field, 
    value: currentValue,
    onSuccess: async (updatedRecord = null) => {
      console.log('✅ onSuccess callback called for saveFieldOnBlur:', { field, updatedRecord: !!updatedRecord, hasPropsRecord: !!props.record });
      
      // Wait a tick to ensure Vue reactivity has updated props.record
      await nextTick();
      
      // Log activity only if value changed
      // Format values again AFTER the record is updated with populated fields from the backend
      // This ensures we use the populated objects instead of ObjectIds
      const finalOriginalValue = originalValue; // Keep original value (before update)
      
      // Helper to find field value case-insensitively and handle field name variations
      const getFieldValue = (record, fieldName) => {
        if (!record) return null;
        
        // Map common UI field names to database field names
        const fieldMap = {
          'assigned to': 'assignedTo',
          'assignedto': 'assignedTo',
          'lead owner': 'lead_owner',
          'leadowner': 'lead_owner',
          'created by': 'createdBy',
          'createdby': 'createdBy'
        };
        
        const normalizedFieldName = fieldName.toLowerCase().replace(/\s+/g, '');
        const dbFieldName = fieldMap[normalizedFieldName] || fieldName;
        
        // Try exact match first (database field name)
        if (record[dbFieldName] !== undefined) return record[dbFieldName];
        if (record[fieldName] !== undefined) return record[fieldName];
        
        // Try case-insensitive match
        const fieldKey = Object.keys(record).find(k => 
          k.toLowerCase() === dbFieldName.toLowerCase() || 
          k.toLowerCase() === fieldName.toLowerCase() ||
          k.toLowerCase().replace(/\s+/g, '') === normalizedFieldName
        );
        return fieldKey ? record[fieldKey] : null;
      };
      
      // Try to get the populated value from updatedRecord (from backend) or props.record
      let finalCurrentValue = currentValue;
      const updatedValue = updatedRecord ? getFieldValue(updatedRecord, field) : null;
      const recordValue = props.record ? getFieldValue(props.record, field) : null;
      
      console.log('🔍 Activity log formatting (saveFieldOnBlur):', {
        field,
        currentValue,
        currentValueType: typeof currentValue,
        isCurrentValueObjectId: typeof currentValue === 'string' && /^[0-9a-fA-F]{24}$/.test(currentValue),
        hasUpdatedRecord: !!updatedRecord,
        updatedRecordKeys: updatedRecord ? Object.keys(updatedRecord).filter(k => k.toLowerCase().includes('assign')).slice(0, 5) : null,
        updatedValue,
        updatedValueType: updatedValue ? typeof updatedValue : null,
        updatedValueIsObject: updatedValue ? (typeof updatedValue === 'object' && !Array.isArray(updatedValue)) : null,
        hasPropsRecord: !!props.record,
        recordValue,
        recordValueType: recordValue ? typeof recordValue : null,
        recordValueIsObject: recordValue ? (typeof recordValue === 'object' && !Array.isArray(recordValue)) : null
      });
      
      // Prefer populated object over ObjectId string
      if (updatedValue !== null && updatedValue !== undefined) {
        // If it's an object (populated), use it
        if (typeof updatedValue === 'object' && !Array.isArray(updatedValue) && updatedValue !== null) {
          console.log('✅ Using populated updatedValue:', updatedValue);
          finalCurrentValue = updatedValue;
        } else if (typeof updatedValue === 'string' && !/^[0-9a-fA-F]{24}$/.test(updatedValue)) {
          // It's a regular string value, use it
          finalCurrentValue = updatedValue;
        } else {
          // It's an ObjectId, try to find populated version from props.record
          if (recordValue && typeof recordValue === 'object' && !Array.isArray(recordValue)) {
            console.log('✅ Using populated recordValue (fallback):', recordValue);
            finalCurrentValue = recordValue;
          } else {
            console.warn('⚠️ No populated value found, using ObjectId:', updatedValue);
            finalCurrentValue = updatedValue;
          }
        }
      } else if (recordValue !== null && recordValue !== undefined) {
        // If it's an object (populated), use it
        if (typeof recordValue === 'object' && !Array.isArray(recordValue) && recordValue !== null) {
          console.log('✅ Using populated recordValue:', recordValue);
          finalCurrentValue = recordValue;
        } else {
          finalCurrentValue = recordValue;
        }
      } else {
        console.warn('⚠️ No value found in updatedRecord or props.record for field:', field);
      }
      
      // Format with the updated record context
      // Before formatting, double-check that we're using the populated object
      // If finalCurrentValue is still an ObjectId string, try once more to get the populated version
      if (typeof finalCurrentValue === 'string' && /^[0-9a-fA-F]{24}$/.test(finalCurrentValue)) {
        // Still an ObjectId, try to get populated version from props.record one more time
        const getFieldValue = (record, fieldName) => {
          if (!record) return null;
          const fieldMap = {
            'assigned to': 'assignedTo',
            'assignedto': 'assignedTo',
            'lead owner': 'lead_owner',
            'leadowner': 'lead_owner'
          };
          const normalizedFieldName = fieldName.toLowerCase().replace(/\s+/g, '');
          const dbFieldName = fieldMap[normalizedFieldName] || fieldName;
          if (record[dbFieldName] !== undefined) return record[dbFieldName];
          if (record[fieldName] !== undefined) return record[fieldName];
          const fieldKey = Object.keys(record).find(k => 
            k.toLowerCase() === dbFieldName.toLowerCase() || 
            k.toLowerCase() === fieldName.toLowerCase()
          );
          return fieldKey ? record[fieldKey] : null;
        };
        
        const lastChanceValue = props.record ? getFieldValue(props.record, field) : null;
        if (lastChanceValue && typeof lastChanceValue === 'object' && !Array.isArray(lastChanceValue)) {
          console.log('🔄 Last chance: Found populated value in props.record:', lastChanceValue);
          finalCurrentValue = lastChanceValue;
        } else if (updatedRecord) {
          const lastChanceUpdated = getFieldValue(updatedRecord, field);
          if (lastChanceUpdated && typeof lastChanceUpdated === 'object' && !Array.isArray(lastChanceUpdated)) {
            console.log('🔄 Last chance: Found populated value in updatedRecord:', lastChanceUpdated);
            finalCurrentValue = lastChanceUpdated;
          }
        }
      }
      
      const displayOriginalValue = formatValueForActivityLog(finalOriginalValue, field);
      const displayCurrentValue = formatValueForActivityLog(finalCurrentValue, field);
      
      console.log('📝 Final formatted values:', {
        displayOriginalValue,
        displayCurrentValue,
        finalCurrentValue,
        finalCurrentValueType: typeof finalCurrentValue,
        isFinalCurrentValueObject: typeof finalCurrentValue === 'object' && !Array.isArray(finalCurrentValue)
      });
      
      let action = '';
      if (normalizedOldValue === '' || normalizedOldValue === null || normalizedOldValue === undefined) {
        action = `set ${fieldName} to "${displayCurrentValue}"`;
      } else {
        action = `changed ${fieldName} from "${displayOriginalValue}" to "${displayCurrentValue}"`;
      }
      
      console.log('📝 Activity log action:', action);
      
      // addActivityLog will reload activity logs after successful save
      await addActivityLog(action);
    }
  });
};

// Discard field changes (revert to original value)
const discardField = (field, event) => {
  // Restore original value
  writeRecordField(field, originalFieldValues.value[field]);
  // Update the input/textarea element
  if (event && event.target) {
    event.target.value = originalFieldValues.value[field] || '';
  }
};

// Format field name
const formatFieldName = (key) => {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
};

// Format field value - never show raw ObjectIds or JSON
const formatFieldValue = (value) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const display = value.name || value.title || value.firstName || value.first_name || value.label || value.email || value.username;
    if (display) return display;
    return '—';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '-';
    return value.map(v => {
      if (typeof v === 'object' && v !== null) return v.name || v.title || v.label || '—';
      if (typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v)) return '—';
      return String(v);
    }).join(', ');
  }
  if (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value.trim())) return '—';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(value.trim())) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return value.includes('T')
        ? formatUserDateTime(d)
        : formatUserDate(d);
    }
  }
  return String(value);
};

// Check if field is editable
const isEditableField = (key) => {
  const nonEditableFields = ['_id', 'id', 'createdAt', 'updatedAt', 'avatar'];
  return !nonEditableFields.includes(key);
};

// Fetch module definition
const fetchModuleDefinition = async () => {
  try {
    // Pass current context to API
    const context = currentContext.value;
    const neededKeys = [
      props.recordType,
      'people',
      'organizations',
      'deals',
      'tasks',
      'events',
    ].filter(Boolean);
    const uniqueKeys = [...new Set(neededKeys.map((k) => String(k).toLowerCase()))];
    const modules = (
      await Promise.all(
        uniqueKeys.map((key) =>
          fetchModuleDefinitionCached(key, context ? { context } : {}).catch(() => null)
        )
      )
    ).filter(Boolean);
    
    // Create a map of all module definitions by key
    const moduleMap = {};
    modules.forEach(mod => {
      moduleMap[mod.key] = mod;
    });
    allModuleDefinitions.value = moduleMap;
    
    // Set the current module definition
    const module = modules.find(m => m.key === props.recordType);
    if (module) {
      moduleDefinition.value = module;
      // Don't check for popup triggers when module loads - only check when field values change
      // Popups should only appear when user actively changes field values, not on tab switches or initial loads
    }
  } catch (error) {
    console.error('Error fetching module definition:', error);
  }
};

// Get field definition for a given key
const getFieldDefinition = (key) => {
  if (!moduleDefinition.value?.fields) return null;
  return moduleDefinition.value.fields.find(f => 
    f.key?.toLowerCase() === key.toLowerCase()
  );
};

// Get input type based on field definition and value
const getInputType = (key, value) => {
  const fieldDef = getFieldDefinition(key);
  
  if (fieldDef) {
    switch (fieldDef.dataType) {
      case 'Date':
        return 'date';
      case 'DateTime':
        return 'datetime-local';
      case 'Number':
      case 'Currency':
        return 'number';
      case 'Checkbox':
      case 'Boolean':
        return 'checkbox';
      case 'Email':
        return 'email';
      case 'Phone':
        return 'text';
      case 'URL':
      case 'Website':
        return 'url';
      case 'Text':
      case 'Text-Area':
      case 'Rich Text':
        return 'text';
      default:
        return 'text';
    }
  }
  
  // Fallback to value-based detection
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'checkbox';
  if (key.includes('email')) return 'email';
  if (key.includes('date')) return 'date';
  if (key.includes('phone')) return 'text';
  if (key.includes('url')) return 'url';
  return 'text';
};

// Check if field is a picklist
const isPicklistField = (key) => {
  const fieldDef = getFieldDefinition(key);
  if (!fieldDef) return false;
  return fieldDef.dataType === 'Picklist' || fieldDef.dataType === 'Multi-Picklist';
};

// Check if field is a text area
const isTextAreaField = (key) => {
  const fieldDef = getFieldDefinition(key);
  if (!fieldDef) return false;
  return fieldDef.dataType === 'Text-Area' || fieldDef.dataType === 'Rich Text';
};

// Get picklist options
const getPicklistOptions = (key) => {
  const fieldDef = getFieldDefinition(key);
  if (!fieldDef || !fieldDef.options) return [];
  return fieldDef.options;
};

// Get lifecycle and status fields for display in header
const getLifecycleStatusFields = computed(() => {
  if (!moduleDefinition.value?.fields || !record.value) return [];
  
  const statusFields = [];
  // Use record.value (reactive ref) to ensure reactivity
  const currentRecord = record.value;
  
  // For People module, show sales_type + lead_status/contact_status
  if (props.recordType === 'people') {
    const salesKind =
      currentRecord?.sales_type;
    const typeField = PEOPLE_SALES_ROLE_MODULE_DEFINITION_KEYS.map((k) => getFieldDefinition(k)).find(Boolean);
    if (typeField) {
      statusFields.push({
        key: 'sales_type',
        label: typeField.label || 'Type',
        value: salesKind,
        options: typeField.options || [],
        fieldDef: typeField
      });
    }
    
    // Lead status (if SALES role is Lead)
    if (salesKind === 'Lead') {
      const leadStatusField = getFieldDefinition('lead_status');
      if (leadStatusField) {
        statusFields.push({
          key: 'lead_status',
          label: t('people.peopleDetailLeadStatus'),
          value: record.value?.lead_status, // Use reactive ref
          options: leadStatusField.options || [],
          fieldDef: leadStatusField
        });
      }
    }
    
    // Contact status (if SALES role is Contact)
    if (salesKind === 'Contact') {
      const contactStatusField = getFieldDefinition('contact_status');
      if (contactStatusField) {
        statusFields.push({
          key: 'contact_status',
          label: t('people.peopleDetailContactStatus'),
          value: record.value?.contact_status, // Use reactive ref
          options: contactStatusField.options || [],
          fieldDef: contactStatusField
        });
      }
    }
  } else if (props.recordType === 'organizations') {
    // For Organizations module, show types + relevant status fields
    // Note: types is a Multi-Picklist (array), so we'll show it as a display field and show status fields
    // Show relevant status fields based on types
    if (Array.isArray(record.value?.types) && record.value.types.length > 0) {
      // Customer status (if Customer is in types)
      if (record.value.types.includes('Customer')) {
        const customerStatusField = getFieldDefinition('customerStatus');
        if (customerStatusField) {
          statusFields.push({
            key: 'customerStatus',
            label: t('settings.modFieldsCustomerStatus'),
            value: record.value?.customerStatus, // Use reactive ref
            options: customerStatusField.options || [],
            fieldDef: customerStatusField
          });
        }
      }
      
      // Partner status (if Partner is in types)
      if (record.value.types.includes('Partner')) {
        const partnerStatusField = getFieldDefinition('partnerStatus');
        if (partnerStatusField) {
          statusFields.push({
            key: 'partnerStatus',
            label: t('settings.modFieldsPartnerStatus'),
            value: record.value?.partnerStatus, // Use reactive ref
            options: partnerStatusField.options || [],
            fieldDef: partnerStatusField
          });
        }
      }
      
      // Vendor status (if Vendor is in types)
      if (record.value.types.includes('Vendor')) {
        const vendorStatusField = getFieldDefinition('vendorStatus');
        if (vendorStatusField) {
          statusFields.push({
            key: 'vendorStatus',
            label: t('settings.modFieldsVendorStatus'),
            value: record.value?.vendorStatus, // Use reactive ref
            options: vendorStatusField.options || [],
            fieldDef: vendorStatusField
          });
        }
      }
    }
  } else {
    // For other modules, look for common status/lifecycle fields
    const statusField = getFieldDefinition('status');
    const lifecycleField = getFieldDefinition('lifecycle_stage');
    
    if (lifecycleField) {
      statusFields.push({
        key: 'lifecycle_stage',
        label: t('common.lifecycleStageTitle'),
        value: record.value?.lifecycle_stage, // Use reactive ref
        options: lifecycleField.options || [],
        fieldDef: lifecycleField
      });
    }
    
    if (statusField) {
      statusFields.push({
        key: 'status',
        label: t('common.status'),
        value: record.value?.status, // Use reactive ref
        options: statusField.options || [],
        fieldDef: statusField
      });
    }
  }
  
  return statusFields;
});

// Format date with time for activity timeline
const formatDate = (date) => {
  if (!date) return '-';
  const dateObj = new Date(date);
  const now = new Date();
  const diffMs = now - dateObj;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  // Show relative time for recent activities
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  // For older activities, show full date and time
  return formatUserDateTime(dateObj);
};

// Get initials
const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 1);
};

// Color mapping for alphabets A-Z
const getColorForLetter = (letter) => {
  const colors = {
    'A': { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-700 dark:text-red-300' },
    'B': { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-700 dark:text-orange-300' },
    'C': { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-700 dark:text-amber-300' },
    'D': { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-700 dark:text-yellow-300' },
    'E': { bg: 'bg-lime-100 dark:bg-lime-900', text: 'text-lime-700 dark:text-lime-300' },
    'F': { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-700 dark:text-green-300' },
    'G': { bg: 'bg-emerald-100 dark:bg-emerald-900', text: 'text-emerald-700 dark:text-emerald-300' },
    'H': { bg: 'bg-teal-100 dark:bg-teal-900', text: 'text-teal-700 dark:text-teal-300' },
    'I': { bg: 'bg-cyan-100 dark:bg-cyan-900', text: 'text-cyan-700 dark:text-cyan-300' },
    'J': { bg: 'bg-sky-100 dark:bg-sky-900', text: 'text-sky-700 dark:text-sky-300' },
    'K': { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-700 dark:text-blue-300' },
    'L': { bg: 'bg-indigo-100 dark:bg-indigo-900', text: 'text-indigo-700 dark:text-indigo-300' },
    'M': { bg: 'bg-violet-100 dark:bg-violet-900', text: 'text-violet-700 dark:text-violet-300' },
    'N': { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-700 dark:text-purple-300' },
    'O': { bg: 'bg-fuchsia-100 dark:bg-fuchsia-900', text: 'text-fuchsia-700 dark:text-fuchsia-300' },
    'P': { bg: 'bg-pink-100 dark:bg-pink-900', text: 'text-pink-700 dark:text-pink-300' },
    'Q': { bg: 'bg-rose-100 dark:bg-rose-900', text: 'text-rose-700 dark:text-rose-300' },
    'R': { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200' },
    'S': { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-200' },
    'T': { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-800 dark:text-amber-200' },
    'U': { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200' },
    'V': { bg: 'bg-lime-100 dark:bg-lime-900', text: 'text-lime-800 dark:text-lime-200' },
    'W': { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' },
    'X': { bg: 'bg-emerald-100 dark:bg-emerald-900', text: 'text-emerald-800 dark:text-emerald-200' },
    'Y': { bg: 'bg-teal-100 dark:bg-teal-900', text: 'text-teal-800 dark:text-teal-200' },
    'Z': { bg: 'bg-cyan-100 dark:bg-cyan-900', text: 'text-cyan-800 dark:text-cyan-200' }
  };
  return colors[letter.toUpperCase()] || { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300' };
};

// Get color for a name based on first letter
const getColorForName = (name) => {
  if (!name) return getColorForLetter('?');
  const firstLetter = name.trim()[0];
  return getColorForLetter(firstLetter);
};

// Get color for a picklist option
const getColorForOption = (option) => {
  // Handle null/undefined
  if (!option) return null;
  
  // Support both string (backward compatibility) and object formats
  if (typeof option === 'object' && option.color) {
    return option.color;
  }
  return null;
};

// Convert hex color to RGB
const hexToRgb = (hexColor) => {
  if (!hexColor) return null;
  
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return { r, g, b };
};

// Get contrast color (black or white) based on background brightness
const getContrastColor = (hexColor) => {
  if (!hexColor) return '#1f2937';
  
  const rgb = hexToRgb(hexColor);
  if (!rgb) return '#1f2937';
  
  // Calculate brightness using relative luminance formula
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  
  // Return black for light colors, white for dark colors
  return brightness > 155 ? '#1f2937' : '#ffffff';
};

// Get selected option for a field
const getSelectedOption = (field) => {
  if (!field.value || !field.options) return null;
  
  return field.options.find(opt => {
    const optValue = typeof opt === 'string' ? opt : opt.value;
    return String(optValue) === String(field.value);
  });
};

// Get button color classes
const getButtonColorClasses = (field) => {
  const selectedOption = getSelectedOption(field);
  const optionColor = getColorForOption(selectedOption);
  
  // Base classes for all buttons
  const baseClasses = 'px-3 py-2 rounded-lg text-sm font-medium transition-colors border';
  
  // If no color, use default classes
  if (!optionColor) {
    return `${baseClasses} bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600`;
  }
  
  // If we have a custom color, return base classes only (inline styles will handle colors)
  return `${baseClasses} hover:opacity-90`;
};

// Get button color style (inline styles for custom colors)
const getButtonColorStyle = (field) => {
  const selectedOption = getSelectedOption(field);
  const optionColor = getColorForOption(selectedOption);
  
  // If no color, return empty style
  if (!optionColor) {
    return {};
  }
  
  // Convert hex to RGB for opacity calculation
  const rgb = hexToRgb(optionColor);
  if (!rgb) {
    return {};
  }
  
  // Apply the color as text and use 15% opacity for background
  return {
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`,
    borderColor: optionColor,
    color: optionColor
  };
};

// Check if an option is selected
const getOptionIsSelected = (field, option) => {
  if (!field.value) return false;
  
  const optValue = typeof option === 'string' ? option : option.value;
  return String(optValue) === String(field.value);
};

// Handler functions for dynamic tabs
const handleUpdate = (updateData) => {
  emit('update', updateData);
};

const handleEdit = () => {
  emit('edit');
};

const handleDelete = () => {
  emit('delete');
};

const handleAddRelation = (relationData) => {
  emit('addRelation', relationData);
};

const handleCreateRecord = (moduleKey) => {
  const initialData = {};
  
  // Pre-fill form based on current record context
  if (props.record && props.record._id) {
    if (props.recordType === 'organizations') {
      // If creating from organization context
      if (moduleKey === 'people') {
        // Pass populated object so lookup shows name immediately
        initialData.organization = {
          _id: props.record._id,
          name: props.record.name || ''
        };
      } else if (moduleKey === 'deals') {
        initialData.accountId = props.record._id;
      } else if (moduleKey === 'tasks' || moduleKey === 'events') {
        initialData.relatedTo = {
          type: 'organization',
          id: props.record._id
        };
      }
    } else if (props.recordType === 'people') {
      // If creating from people/contact context
      if (moduleKey === 'deals') {
        initialData.contactId = props.record._id;
      } else if (moduleKey === 'tasks' || moduleKey === 'events') {
        initialData.relatedTo = {
          type: 'contact',
          id: props.record._id
        };
      }
    }
  }
  
  createDrawerModuleKey.value = moduleKey;
  createDrawerInitialData.value = initialData;
  createDrawerRecord.value = null;
  showCreateDrawer.value = true;
};

const handleCreateDrawerSaved = async (newRecord) => {
  // If editing an existing record, detect changes and log them
  if (createDrawerRecord.value && newRecord) {
    const oldRecord = createDrawerRecord.value;
    
    // System fields to exclude from comparison
    const systemFields = ['_id', 'id', '__v', 'createdAt', 'updatedAt', 'createdBy', 'organizationId', 'organizationid', 'activityLogs', 'avatar'];
    
    // Computed/virtual fields that shouldn't be compared (these are widgets/related data)
    const computedFields = ['relatedtasks', 'relateddeals', 'relatedcontacts', 'relatedevents', 'relatedorganizations', 'relatedtasks', 'relateddeals'];
    
    // Get list of actual editable fields from module definition
    const editableFieldKeys = new Set();
    if (moduleDefinition.value?.fields) {
      for (const field of moduleDefinition.value.fields) {
        if (field.key) {
          editableFieldKeys.add(field.key.toLowerCase());
        }
      }
    }
    
    // Helper to check if field should be compared
    const shouldCompareField = (key) => {
      const keyLower = key.toLowerCase();
      
      // Skip system fields
      if (systemFields.includes(keyLower)) {
        return false;
      }
      
      // Skip computed/virtual fields
      if (computedFields.includes(keyLower)) {
        return false;
      }
      
      // Skip fields that start with "related" (relationship widgets)
      if (keyLower.startsWith('related')) {
        return false;
      }
      
      // Only compare fields that are in the module definition (actual editable fields)
      // If we have module definition, use it; otherwise compare all non-system fields
      if (editableFieldKeys.size > 0) {
        return editableFieldKeys.has(keyLower);
      }
      
      // Fallback: compare all non-system, non-computed fields
      return true;
    };
    
    // Helper to extract value for comparison (handle populated objects and arrays)
    const extractValue = (value) => {
      // Handle arrays - compare length and content
      if (Array.isArray(value)) {
        return value.length === 0 ? null : JSON.stringify(value.sort());
      }
      
      // Handle populated relationship objects
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        if (value._id) return value._id;
        if (value.name) return value.name;
        if (value.firstName && value.lastName) return `${value.firstName} ${value.lastName}`;
        if (value.first_name && value.last_name) return `${value.first_name} ${value.last_name}`;
        if (value.title) return value.title;
      }
      
      return value;
    };
    
    // Helper to extract display value for activity logs (gets human-readable names)
    const extractDisplayValue = (value, fieldKey) => {
      // If null/undefined, return empty string
      if (value === null || value === undefined) {
        return '';
      }
      
      // Handle arrays
      if (Array.isArray(value)) {
        return value.length === 0 ? '' : value.map(v => extractDisplayValue(v, fieldKey)).join(', ');
      }
      
      // Handle populated relationship objects
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        // For User objects (accountmanager, assignedTo, assignedTo, etc.)
        if (value.firstName && value.lastName) {
          return `${value.firstName} ${value.lastName}`;
        }
        if (value.first_name && value.last_name) {
          return `${value.first_name} ${value.last_name}`;
        }
        if (value.username) {
          return value.username;
        }
        if (value.name) {
          return value.name;
        }
        if (value.title) {
          return value.title;
        }
        // If it's an object with _id but no name fields, it might be a populated reference
        // Return the ID as fallback (shouldn't happen if properly populated)
        if (value._id) {
          return String(value._id);
        }
      }
      
      // If it's a string that looks like an ObjectId (24 hex characters)
      if (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
        // This is likely an ObjectId that wasn't populated
        // Try to get the field definition to see if we can determine the type
        const fieldDef = moduleDefinition.value?.fields?.find(f => 
          f.key?.toLowerCase() === fieldKey?.toLowerCase()
        );
        
        // If it's a lookup/relationship field, we can't fetch it now, so return a placeholder
        if (fieldDef && (fieldDef.dataType === 'Lookup (Relationship)' || fieldDef.dataType === 'Lookup')) {
          return '[User]'; // Generic placeholder for unpopulated User fields
        }
        
        return value; // Return the ID as-is
      }
      
      return String(value);
    };
    
    // Detect changed fields and create activity logs
    const changedFields = [];
    
    // Get keys from both records, but prioritize keys from module definition
    const keysToCheck = editableFieldKeys.size > 0 
      ? Array.from(editableFieldKeys)
      : new Set([...Object.keys(oldRecord || {}), ...Object.keys(newRecord || {})]);
    
    for (const key of keysToCheck) {
      // Skip if shouldn't compare
      if (!shouldCompareField(key)) {
        continue;
      }
      
      // Get actual key name (case-insensitive lookup)
      const actualKey = Object.keys(oldRecord || {}).find(k => k.toLowerCase() === key.toLowerCase()) ||
                       Object.keys(newRecord || {}).find(k => k.toLowerCase() === key.toLowerCase()) ||
                       key;
      
      // Get raw values (before extraction)
      const rawOldValue = oldRecord[actualKey];
      const rawNewValue = newRecord[actualKey];
      
      // Special handling for "name" field which might be computed
      // For people records, name might be computed from first_name + last_name
      // If name field doesn't exist in both records, skip it (it's computed, not editable)
      if (actualKey.toLowerCase() === 'name') {
        // If name doesn't exist in module definition as editable, skip it
        // Or if it's missing in newRecord but exists in oldRecord (computed), skip it
        if (rawOldValue && !rawNewValue && (newRecord.first_name || newRecord.last_name)) {
          // Name exists in old but not new - this is likely a computed field
          // Compare first_name and last_name instead
          const oldName = `${oldRecord.first_name || ''} ${oldRecord.last_name || ''}`.trim();
          const newName = `${newRecord.first_name || ''} ${newRecord.last_name || ''}`.trim();
          if (oldName !== newName) {
            const fieldName = formatFieldName('name');
            changedFields.push(`changed ${fieldName} from "${oldName}" to "${newName}"`);
          }
          continue; // Skip the name field comparison since we handled it above
        }
        // If name doesn't exist in either, skip it
        if (!rawOldValue && !rawNewValue) {
          continue;
        }
      }
      
      const oldValue = extractValue(rawOldValue);
      const newValue = extractValue(rawNewValue);
      
      // Normalize values for comparison
      const normalizedOldValue = normalizeValue(oldValue);
      const normalizedNewValue = normalizeValue(newValue);
      
      // If values changed, track it
      if (normalizedOldValue !== normalizedNewValue) {
        const fieldName = formatFieldName(actualKey);
        let action = '';
        
        // Get display values for the log message (use helper to get proper names for relationship fields)
        const displayOldValue = extractDisplayValue(rawOldValue, actualKey).substring(0, 100);
        const displayNewValue = extractDisplayValue(rawNewValue, actualKey).substring(0, 100);
        
        if (normalizedOldValue === '' || normalizedOldValue === null || normalizedOldValue === undefined) {
          // Field was empty/null, now has a value
          action = `set ${fieldName} to "${displayNewValue}"`;
        } else if (normalizedNewValue === '' || normalizedNewValue === null || normalizedNewValue === undefined) {
          // Field had a value, now is empty/null
          action = `cleared ${fieldName} (was "${displayOldValue}")`;
        } else {
          // Field value changed
          action = `changed ${fieldName} from "${displayOldValue}" to "${displayNewValue}"`;
        }
        
        changedFields.push(action);
      }
    }
    
    // Create a single activity log entry for all changes from the edit drawer
    if (changedFields.length > 0) {
      // Combine all changes into a single log entry
      let action = '';
      let details = null;
      
      if (changedFields.length === 1) {
        // Single change - use the action directly
        action = changedFields[0];
      } else {
        // Multiple changes - create a summary action and store all changes in details
        const fieldNames = changedFields.map(field => {
          // Extract field name from action (e.g., "changed Name from X to Y" -> "Name")
          const match = field.match(/^(set|changed|cleared)\s+([^"(\s]+)/i);
          return match ? match[2] : 'field';
        });
        
        // Create a summary message
        action = `updated ${changedFields.length} field${changedFields.length > 1 ? 's' : ''}`;
        
        // Store all individual field changes in details for display
        details = {
          type: 'multiple_changes',
          changes: changedFields
        };
      }
      
      // Save single activity log entry with details
      await addActivityLog(action, details);
    }
    
    // Emit the updated record so parent can update its local state
    emit('recordUpdated', newRecord);
    // Also refresh widgets to show any related data updates
    refreshAllWidgets();
  } else {
    // For new records created via the drawer, log creation
    try {
      const createdType = (createDrawerModuleKey.value || 'record').replace(/s$/, '');
      const createdName = newRecord?.name || newRecord?.title || newRecord?._id;
      await addActivityLog(`created ${createdType} "${createdName}"`, { type: 'created', moduleKey: createDrawerModuleKey.value, recordId: newRecord?._id });
    } catch {}
    // Just refresh widgets
    refreshAllWidgets();
  }
  
  // The drawer will close automatically via the closeDrawer function
};

const handleLinkRecords = (moduleKey) => {
  // Build context based on current record
  const context = {};
  if (props.record && props.record._id) {
    if (props.recordType === 'organizations') {
      context.organizationId = props.record._id;
      context.relatedType = 'organization';
    } else if (props.recordType === 'people') {
      context.contactId = props.record._id;
      context.relatedType = 'contact';
    }
  }
  linkDrawerModuleKey.value = moduleKey;
  linkDrawerContext.value = context;
  showLinkDrawer.value = true;
};

const handleLinkDrawerClose = () => {
  showLinkDrawer.value = false;
  linkDrawerModuleKey.value = '';
  linkDrawerContext.value = {};
};

const handleLinkDrawerLinked = async ({ moduleKey, ids, context }) => {
  // Perform linking via API based on context
  try {
    // Example linking rules
    if (context.organizationId && moduleKey === 'people') {
      // Link contacts to organization by updating each contact's organization field
      await Promise.all(
        ids.map((contactId) => apiClient.put(`/people/${contactId}`, { organization: context.organizationId }))
      );
    } else if (context.organizationId && moduleKey === 'deals') {
      await apiClient.post('/deals/link', { accountId: context.organizationId, dealIds: ids });
    } else if (context.contactId && moduleKey === 'deals') {
      await apiClient.post('/deals/link', { contactId: context.contactId, dealIds: ids });
    } else if (context.contactId && moduleKey === 'tasks') {
      await apiClient.post('/tasks/link', { contactId: context.contactId, taskIds: ids });
    } else if (context.organizationId && moduleKey === 'tasks') {
      await apiClient.post('/tasks/link', { organizationId: context.organizationId, taskIds: ids });
    } else if (moduleKey === 'events') {
      await apiClient.post('/events/link', { relatedType: context.relatedType === 'organization' ? 'Organization' : 'Contact', relatedId: context.organizationId || context.contactId, eventIds: ids });
    } else if (context.contactId && moduleKey === 'organizations') {
      // Link organization to contact by setting the contact's organization
      if (ids[0]) {
        await apiClient.put(`/people/${context.contactId}`, { organization: ids[0] });
      }
    }
  } catch (e) {
    // Silently ignore for now
  }
  // Log linking activity with item names and links
  try {
    const labelMap = { people: 'contact', deals: 'deal', tasks: 'task', events: 'event', organizations: 'organization', users: 'user' };
    const label = labelMap[moduleKey] || moduleKey;
    const count = ids?.length || 0;
    if (count > 0) {
      const items = await fetchRecordsByIds(moduleKey, ids);
      const actionSuffix = count === 1 && items[0]?.name ? ` - ${items[0].name}` : '';
      await addActivityLog(`linked ${count} ${label}${count > 1 ? 's' : ''}${actionSuffix}`, { type: 'link', moduleKey, items });
    }
  } catch {}
  // After linking, fetch the updated record and notify parent so UI updates immediately
  try {
    if (context.contactId) {
      const res = await apiClient.get(`/people/${context.contactId}`);
      if (res?.success && res.data) {
        emit('recordUpdated', res.data);
      }
    } else if (context.organizationId) {
      // If needed, support organization record refresh in the future
    }
  } catch {}
  // Refresh widgets to re-render any internal state
  refreshAllWidgets();
};

const getLinkDrawerTitle = () => {
  const map = { people: 'Link Contacts', deals: 'Link Deals', tasks: 'Link Tasks', events: 'Link Events', organizations: 'Link Organization', users: 'Link Users' };
  return map[linkDrawerModuleKey.value] || 'Link Records';
};

const handleCreateDrawerClose = () => {
  showCreateDrawer.value = false;
  createDrawerModuleKey.value = '';
  createDrawerInitialData.value = {};
  createDrawerRecord.value = null;
};

const refreshAllWidgets = () => {
  if (!gridStack) return;
  
  const widgets = gridStack.getGridItems();
  widgets.forEach(item => {
    const widgetType = item.getAttribute('data-widget-type');
    if (widgetType) {
      // Find the container element inside the grid item (container is stored in widgetApps)
      // The structure is: grid-stack-item > grid-stack-item-content > container
      const contentEl = item.querySelector('.grid-stack-item-content');
      const container = contentEl?.firstElementChild;
      
      if (container) {
      // Find the Vue app instance and call refresh if available
        const widgetAppsEntry = widgetApps.get(container);
      if (widgetAppsEntry) {
          const { app } = widgetAppsEntry;
        // Try to access the exposed refresh method from the wrapper component
        try {
          const rootComponent = app._instance;
          if (rootComponent?.exposed && typeof rootComponent.exposed.refresh === 'function') {
            rootComponent.exposed.refresh();
          }
        } catch (error) {
          console.warn('Error refreshing widget:', widgetType, error);
          }
        }
      }
    }
  });
};

const getCreateDrawerTitle = () => {
  if (createDrawerRecord.value) return null; // let drawer compute edit title
  const titles = {
    'people': 'New Person',
    'organizations': 'New Organization',
    'deals': 'New Deal',
    'tasks': 'New Task',
    'events': 'New Event',
    'users': 'New User'
  };
  return titles[createDrawerModuleKey.value] || 'Create Record';
};

const openEditDrawer = () => {
  if (!props.record || !props.recordType) return;
  
  // For forms, emit the edit event so the parent can handle it with custom logic
  // (opening FormCreate tab instead of the drawer)
  if (props.recordType === 'forms') {
    handleEdit();
    return;
  }
  
  // For other record types, open the drawer as usual
  createDrawerModuleKey.value = props.recordType;
  createDrawerInitialData.value = {};
  createDrawerRecord.value = props.record;
  showCreateDrawer.value = true;
};

// View form responses (forms only, Active status only)
const viewFormResponses = () => {
  if (!props.record || props.recordType !== 'forms' || props.record.status !== 'Active') return;
  
  const formId = props.record._id;
  openTab(`/forms/${formId}/responses`, {
    name: `form-responses-${formId}`,
    title: `${props.record.name || 'Form'} - Responses`,
    component: 'FormResponses',
    insertAdjacent: true,
    params: { formId }
  });
  router.push(`/forms/${formId}/responses`);
};

// Fetch form responses for Usage and Responses tabs
const fetchFormResponses = async () => {
  if (!props.record || props.recordType !== 'forms' || props.record.status !== 'Active') {
    formResponses.value = [];
    return;
  }
  
  const formId = props.record._id;
  if (!formId) return;
  
  formResponsesLoading.value = true;
  try {
    const params = {
      page: formResponsesPagination.value.currentPage,
      limit: formResponsesPagination.value.limit,
      sortBy: 'submittedAt',
      sortOrder: 'desc'
    };
    
    const response = await apiClient(`/forms/${formId}/responses`, {
      method: 'GET',
      params
    });
    
    if (response.success) {
      formResponses.value = Array.isArray(response.data) ? response.data : [];
      
      if (response.pagination) {
        formResponsesPagination.value.total = response.pagination.totalResponses || 0;
        formResponsesPagination.value.totalPages = response.pagination.totalPages || 1;
      }
    } else {
      formResponses.value = [];
    }
  } catch (error) {
    console.error('Error fetching form responses:', error);
    formResponses.value = [];
  } finally {
    formResponsesLoading.value = false;
  }
};

// Calculate overall score from section scores
const calculateOverallScore = (sectionScores) => {
  if (!sectionScores || typeof sectionScores !== 'object') return 0;
  
  const scores = Object.values(sectionScores).filter(s => typeof s === 'number');
  if (scores.length === 0) return 0;
  
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return Math.round(sum / scores.length);
};

// View response detail
const viewResponseDetail = (response) => {
  if (!props.record || props.recordType !== 'forms') return;
  
  const formId = props.record._id;
  const responseId = response._id;
  
  openTab(`/forms/${formId}/responses/${responseId}`, {
    name: `form-response-${responseId}`,
    title: `Response - ${formatUserDate(response.submittedAt)}`,
    component: 'FormResponseDetail',
    insertAdjacent: true,
    params: { formId, responseId }
  });
  router.push(`/forms/${formId}/responses/${responseId}`);
};

// Archive form (forms only, Draft status only)
const archiveForm = async () => {
  if (!props.record || props.recordType !== 'forms' || props.record.status !== 'Draft') return;
  
  // TODO: Implement archive functionality
  // For now, just emit an event that the parent can handle
  console.log('Archive form:', props.record._id);
  // Could emit an event: emit('archive', props.record);
};

const handleOpenRelatedRecord = async (relatedRecord) => {
  // Emit to parent for any additional handling
  emit('openRelatedRecord', relatedRecord);
  
  // Open record in global TabBar
  if (relatedRecord.type && relatedRecord.id) {
    const path = `/${relatedRecord.type}/${relatedRecord.id}`;
    const icon = relatedRecord.type === 'deals' ? 'briefcase' : 
                 relatedRecord.type === 'contacts' ? 'users' : 
                 relatedRecord.type === 'people' ? 'users' :
                 relatedRecord.type === 'users' ? 'users' : 'document';
    
    // If we don't have the name, fetch it first
    let title = relatedRecord.name || 'Record';
    
    if (!relatedRecord.name) {
      try {
        // Determine API endpoint based on record type
        let endpoint = '';
        if (relatedRecord.type === 'organizations') {
          // Always use tenant-scoped endpoint for data isolation
          endpoint = `/v2/organization/${relatedRecord.id}`;
        } else if (relatedRecord.type === 'contacts' || relatedRecord.type === 'people') {
          // Always use tenant-scoped endpoint for data isolation
          endpoint = `/people/${relatedRecord.id}`;
        } else {
          endpoint = `/${relatedRecord.type}/${relatedRecord.id}`;
        }
        
        const response = await apiClient.get(endpoint);
        
        // Extract name from response
        if (response.success && response.data) {
          const record = response.data;
          // Different record types have different name fields
          if (relatedRecord.type === 'contacts' || relatedRecord.type === 'people') {
            title = `${record.first_name || ''} ${record.last_name || ''}`.trim() || record.email || 'Contact';
          } else if (relatedRecord.type === 'users') {
            title = record.name || record.email || 'User';
          } else {
            title = record.name || 'Record';
          }
        }
      } catch (err) {
        console.error('Error fetching record name:', err);
        // Use default title if fetch fails
      }
    }
    
    // Open tab - openTab already handles router.push which will trigger component load
    openTab(path, {
      title: title,
      icon: icon,
      params: { name: title }, // Pass name in params for potential title updates
      insertAdjacent: true
    });
  }
};


// Watch for tab changes to initialize/destroy GridStack and save active tab
watch(activeTab, (newTab, oldTab) => {
  // Save active tab to localStorage
  saveActiveTab(newTab);
  
  if (newTab === 'summary') {
    // Initialize GridStack when switching to summary tab
    // Wait a bit longer to ensure the tab content is rendered
    setTimeout(() => {
      initializeGridStack();
    }, 100);
  } else if (oldTab === 'summary' && newTab !== 'summary') {
    // Destroy GridStack when leaving summary tab
    destroyGridStack();
  }
  
  // Fetch form responses when switching to Usage or Responses tab
  if ((newTab === 'usage' || newTab === 'responses') && props.recordType === 'forms' && props.record?.status === 'Active') {
    fetchFormResponses();
  }
});

// Watch for record changes to reload saved tab and log initial load
// Watch for record changes to check popup triggers
watch(() => props.record, (newRecord, oldRecord) => {
  if (newRecord && moduleDefinition.value) {
    // Only reset processed triggers if this is a different record (by ID)
    const newRecordId = newRecord._id || newRecord.id;
    const oldRecordId = oldRecord?._id || oldRecord?.id;
    
    if (newRecordId !== oldRecordId) {
      // Record ID changed - this is a different record
      processedPopupTriggers.value.clear();
      isInitialLoad.value = true;
      hasEvaluatedPopupsForCurrentState.value = false;
      userInitiatedFieldChange.value = false;
      // Component is already initialized, but we reset flags for new record
    }
    
    // Don't check for popups when record prop changes - only check when field values are explicitly changed
    // This prevents popups from appearing on tab switches or when the record object is re-referenced
    // Popups should only appear when user actively changes field values via updateField()
  }
}, { deep: true });

watch(() => props.record, async (newRecord, oldRecord) => {
  if (newRecord && (newRecord._id || newRecord.id)) {
    const recordId = newRecord._id || newRecord.id;
    const oldRecordId = oldRecord?._id || oldRecord?.id;
    
    // If record changed (different ID), reset logs and load new ones
    if (oldRecordId !== recordId) {
      timelineUpdates.value = [];
      loggedRecordIds.value.clear();
      // Reset initial load flag when switching to a different record
      isInitialLoad.value = true;
      hasEvaluatedPopupsForCurrentState.value = false;
      userInitiatedFieldChange.value = false;
      await loadActivityLogs();
    } else if (!oldRecordId) {
      // First load - load existing logs from API
      // Keep isInitialLoad as true on first load
      isInitialLoad.value = true;
      hasEvaluatedPopupsForCurrentState.value = false;
      userInitiatedFieldChange.value = false;
      await loadActivityLogs();
    }
    
    // Log initial load if this is a new record we haven't logged yet
    // Only add "viewed" log if:
    // 1. We haven't logged this record ID before
    // 2. AND there are no existing logs (meaning it's a fresh record, not loaded from storage)
    if (!loggedRecordIds.value.has(recordId) && timelineUpdates.value.length === 0) {
      loggedRecordIds.value.add(recordId);
      const recordName = newRecord.name || 'this record';
      await addActivityLog(`viewed ${recordName}`, { type: 'view', recordId });
    } else if (!loggedRecordIds.value.has(recordId)) {
      // If we have logs but haven't tracked this record ID, just mark it as logged
      loggedRecordIds.value.add(recordId);
    }
    
    const savedTab = loadActiveTab();
    // Validate that the saved tab still exists
    const isValidTab = fixedTabs.value.some(t => t.id === savedTab);
    if (isValidTab && savedTab !== activeTab.value) {
      activeTab.value = savedTab;
    }
  }
}, { immediate: true }); // Run immediately to catch initial load

// Lifecycle hooks
onMounted(async () => {
  // Check if we need to do a one-time reset of all widget layouts
  // This is a one-time migration to apply the new default widget ordering
  // Version v5: Reset all records to new default layout (Key Fields 25%, Lifecycle Stage 50%, Metrics 25%)
  const resetFlag = localStorage.getItem('widget-layout-reset-v5');
  if (!resetFlag) {
    console.log('Performing one-time widget layout reset for all records to apply new default ordering (25%-50%-25% first row layout)...');
    await resetAllWidgetLayouts();
    // Set flag to prevent resetting again
    localStorage.setItem('widget-layout-reset-v5', 'true');
    console.log('Widget layouts reset complete for all records. New default order (25%-50%-25% first row layout) will be applied.');
  }
  
  // Fetch module definition for field mapping
  await fetchModuleDefinition();
  
  // Initialize tags from record if available
  if (props.record && props.record.tags && Array.isArray(props.record.tags)) {
    tags.value = [...props.record.tags];
  }
  
  // Listen for sidebar toggle events and window resize
  window.addEventListener('sidebar-toggle', handleSidebarToggle);
  window.addEventListener('resize', handleResize);
  
  // Set initial viewport width
  viewportWidth.value = window.innerWidth;
  
  // Load saved tab if record is already loaded
  if (props.record && (props.record._id || props.record.id)) {
    const savedTab = loadActiveTab();
    const isValidTab = fixedTabs.value.some(t => t.id === savedTab);
    if (isValidTab && savedTab !== 'summary') {
      activeTab.value = savedTab;
    }
  }
  
  // Validate current tab
  const currentTab = activeTab.value;
  const isValidTab = fixedTabs.value.some(t => t.id === currentTab);
  if (!isValidTab) {
    activeTab.value = 'summary';
  }
  
  // Mark component as initialized after a short delay to ensure all watchers have run
  // This prevents popups from triggering during initial render
  setTimeout(() => {
    componentInitialized.value = true;
  }, 500);
  
  if (activeTab.value === 'summary') {
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
      initializeGridStack();
    }, 100);
  }
});

onUnmounted(() => {
  // Remove event listeners
  window.removeEventListener('sidebar-toggle', handleSidebarToggle);
  window.removeEventListener('resize', handleResize);
  destroyGridStack();
});

// Expose methods for parent components
defineExpose({
  reloadActivityLogs: loadActivityLogs
});

</script>
