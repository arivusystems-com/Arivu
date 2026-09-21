<template>
  <div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-950">
    <div class="flex min-h-0 flex-1 overflow-hidden">
    <!-- Sidebar: full-width list on mobile; fixed column on md+ -->
    <aside
      class="h-full w-full shrink-0 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 md:w-[280px]"
      :class="mobileShowConversation ? 'hidden md:flex' : 'flex'"
    >
      <div class="flex items-center justify-between px-3 py-2.5">
        <div class="flex min-w-0 items-center gap-2">
          <h1 class="text-sm font-semibold text-neutral-900 dark:text-white">
            {{ t('internalChat.pageHeading') }}
          </h1>
          <span
            class="h-2 w-2 shrink-0 rounded-full"
            :class="streamLive ? 'bg-success-500' : 'bg-neutral-400 dark:bg-neutral-600'"
            :title="streamLive ? t('internalChat.streamConnected') : t('internalChat.streamDisconnected')"
          />
        </div>
        <div class="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            :title="t('internalChat.settings')"
            @click="openSettings"
          >
            <Cog6ToothIcon class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            :title="t('internalChat.newChannel')"
            @click="showChannelModal = true"
          >
            <PlusIcon class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            :title="t('internalChat.newDm')"
            @click="showDmModal = true"
          >
            <ChatBubbleOvalLeftEllipsisIcon class="h-4 w-4" />
          </button>
        </div>
      </div>

      <div class="px-3 pb-2">
        <div class="relative">
          <MagnifyingGlassIcon class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            v-model="spaceFilter"
            type="search"
            class="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-1.5 pl-8 pr-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-500 dark:focus:bg-neutral-900"
            :placeholder="t('internalChat.spaceFilterPlaceholder')"
          >
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-auto px-2 pb-2">
        <div
          v-if="loadingSpaces"
          class="space-y-2 px-1 py-1"
        >
          <div
            v-for="n in 6"
            :key="n"
            class="h-8 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800"
          />
        </div>

        <template v-else-if="spaces.length">
          <!-- Direct messages (always shown) -->
          <section class="mb-3">
            <div class="flex items-center justify-between px-2 py-1">
              <span class="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {{ t('internalChat.directsSection') }}
              </span>
              <button
                type="button"
                class="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                :title="t('internalChat.newDm')"
                @click="showDmModal = true"
              >
                <PlusIcon class="h-3.5 w-3.5" />
              </button>
            </div>
            <ul
              v-if="directSpaces.length"
              class="space-y-0.5"
            >
              <li
                v-for="space in directSpaces"
                :key="space._id"
                class="group relative"
              >
                <div
                  class="flex w-full items-center gap-0.5 rounded-lg px-1 py-0.5 text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
                  :class="isSpaceSelected(space) ? 'bg-primary-50 font-medium text-primary-900 dark:bg-primary-900/30 dark:text-primary-100' : ''"
                >
                  <button
                    type="button"
                    class="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left"
                    @click="selectSpace(space._id)"
                  >
                    <span class="flex min-w-0 items-center gap-2">
                      <span
                        v-if="spaceGroupAvatarPeers(space).length >= 2"
                        class="relative inline-block h-8 w-8 shrink-0"
                        aria-hidden="true"
                      >
                        <AvatarInitials
                          v-bind="personAvatarProps(spaceGroupAvatarPeers(space)[0])"
                          size="xs"
                          class="absolute left-0 top-0 z-[1] rounded-full ring-2 ring-white dark:ring-neutral-900"
                        />
                        <AvatarInitials
                          v-bind="personAvatarProps(spaceGroupAvatarPeers(space)[1])"
                          size="xs"
                          class="absolute bottom-0 right-0 z-[2] rounded-full ring-2 ring-white dark:ring-neutral-900"
                        />
                      </span>
                      <AvatarInitials
                        v-else
                        v-bind="spaceAvatarProps(space)"
                        size="sm"
                      />
                      <span class="truncate">{{ spaceDisplayName(space) }}</span>
                      <BellSlashIcon
                        v-if="isSpaceMuted(space)"
                        class="h-3.5 w-3.5 shrink-0 text-neutral-400"
                        :title="t('internalChat.muted')"
                      />
                    </span>
                    <span
                      v-if="space.unreadCount > 0 && sidebarChannelMenuId !== String(space._id)"
                      class="inline-flex min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[10px] font-semibold text-white"
                      :class="space.type === 'group_dm' || space.type === 'dm' ? 'group-hover:hidden' : ''"
                    >
                      {{ space.unreadCount > 99 ? '99+' : space.unreadCount }}
                    </span>
                  </button>
                  <div
                    class="relative shrink-0"
                    data-channel-menu
                  >
                    <button
                      type="button"
                      class="rounded-md p-1 text-neutral-400 opacity-0 hover:bg-neutral-200/80 hover:text-neutral-700 group-hover:opacity-100 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                      :class="sidebarChannelMenuId === String(space._id) ? 'opacity-100' : ''"
                      :title="t('internalChat.channelMenu')"
                      :aria-expanded="sidebarChannelMenuId === String(space._id)"
                      @click.stop="toggleSidebarChannelMenu(space)"
                    >
                      <EllipsisHorizontalIcon class="h-4 w-4" />
                    </button>
                    <div
                      v-if="sidebarChannelMenuId === String(space._id)"
                      class="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
                    >
                      <button
                        v-if="space.type === 'group_dm'"
                        type="button"
                        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                        @click.stop="openMembersFromSidebar(space)"
                      >
                        <UsersIcon class="h-4 w-4 text-neutral-400" />
                        {{ t('internalChat.viewMembers') }}
                      </button>
                      <button
                        v-if="space.type === 'group_dm'"
                        type="button"
                        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                        @click.stop="openInviteFromSidebar(space)"
                      >
                        <UserPlusIcon class="h-4 w-4 text-neutral-400" />
                        {{ t('internalChat.inviteMembers') }}
                      </button>
                      <div
                        v-if="space.type === 'group_dm'"
                        class="my-1 border-t border-neutral-100 dark:border-neutral-800"
                      />
                      <template v-if="isSpaceMuted(space)">
                        <button
                          type="button"
                          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                          @click.stop="unmuteSpaceNotifications(space)"
                        >
                          {{ t('internalChat.unmuteNotifications') }}
                        </button>
                      </template>
                      <template v-else-if="isMuteDurationOpen(space._id)">
                        <button
                          v-for="opt in muteDurationOptions"
                          :key="`dm-mute-${opt.key}`"
                          type="button"
                          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                          @click.stop="muteSpaceNotifications(space, opt.key)"
                        >
                          {{ t(opt.labelKey) }}
                        </button>
                      </template>
                      <button
                        v-else
                        type="button"
                        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                        @click.stop="openMuteDurationPicker(space._id, $event)"
                      >
                        {{ t('internalChat.muteNotifications') }}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
            <button
              v-else
              type="button"
              class="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-lg border border-dashed border-neutral-200 px-2.5 py-2 text-left text-xs text-neutral-500 hover:border-primary-300 hover:bg-primary-50/50 hover:text-primary-700 dark:border-neutral-700 dark:hover:border-primary-700 dark:hover:bg-primary-900/20 dark:hover:text-primary-300"
              @click="showDmModal = true"
            >
              <PlusIcon class="h-3.5 w-3.5 shrink-0" />
              {{ t('internalChat.newDm') }}
            </button>
          </section>

          <!-- Channels -->
          <section
            v-if="channelSpaces.length"
            class="mb-3"
          >
            <div class="flex items-center justify-between px-2 py-1">
              <span class="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {{ t('internalChat.channelsSection') }}
              </span>
              <button
                type="button"
                class="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                :title="t('internalChat.newChannel')"
                @click="showChannelModal = true"
              >
                <PlusIcon class="h-3.5 w-3.5" />
              </button>
            </div>
            <ul class="space-y-0.5">
              <li
                v-for="space in channelSpaces"
                :key="space._id"
                class="group relative"
              >
                <div
                  class="flex w-full items-center gap-0.5 rounded-lg px-1 py-0.5 text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
                  :class="isSpaceSelected(space) ? 'bg-primary-50 font-medium text-primary-900 dark:bg-primary-900/30 dark:text-primary-100' : ''"
                >
                  <button
                    type="button"
                    class="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left"
                    @click="selectSpace(space._id)"
                  >
                    <span class="flex min-w-0 items-center gap-2">
                      <LockClosedIcon
                        v-if="space.isPrivate"
                        class="h-3.5 w-3.5 shrink-0 text-neutral-400"
                      />
                      <HashtagIcon
                        v-else
                        class="h-3.5 w-3.5 shrink-0 text-neutral-400"
                      />
                      <span
                        class="truncate"
                        :class="space.canJoin ? 'text-neutral-500' : ''"
                      >{{ spaceDisplayName(space) }}</span>
                      <BellSlashIcon
                        v-if="isSpaceMuted(space)"
                        class="h-3.5 w-3.5 shrink-0 text-neutral-400"
                        :title="t('internalChat.muted')"
                      />
                    </span>
                    <span
                      v-if="space.canJoin"
                      class="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400"
                    >
                      {{ t('internalChat.join') }}
                    </span>
                    <span
                      v-else-if="space.unreadCount > 0 && sidebarChannelMenuId !== String(space._id)"
                      class="inline-flex min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[10px] font-semibold text-white group-hover:hidden"
                    >
                      {{ space.unreadCount > 99 ? '99+' : space.unreadCount }}
                    </span>
                  </button>
                  <div
                    v-if="space.isMember !== false && !space.canJoin"
                    class="relative shrink-0"
                    data-channel-menu
                  >
                    <button
                      type="button"
                      class="rounded-md p-1 text-neutral-400 opacity-0 hover:bg-neutral-200/80 hover:text-neutral-700 group-hover:opacity-100 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                      :class="sidebarChannelMenuId === String(space._id) ? 'opacity-100' : ''"
                      :title="t('internalChat.channelMenu')"
                      :aria-expanded="sidebarChannelMenuId === String(space._id)"
                      @click.stop="toggleSidebarChannelMenu(space)"
                    >
                      <EllipsisHorizontalIcon class="h-4 w-4" />
                    </button>
                    <div
                      v-if="sidebarChannelMenuId === String(space._id)"
                      class="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
                    >
                      <button
                        type="button"
                        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                        @click.stop="openRenameChannelModal(space)"
                      >
                        <PencilSquareIcon class="h-4 w-4 text-neutral-400" />
                        {{ t('internalChat.renameChannel') }}
                      </button>
                      <button
                        type="button"
                        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                        @click.stop="openMembersFromSidebar(space)"
                      >
                        <UsersIcon class="h-4 w-4 text-neutral-400" />
                        {{ t('internalChat.viewMembers') }}
                      </button>
                      <button
                        type="button"
                        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                        @click.stop="openInviteFromSidebar(space)"
                      >
                        <UserPlusIcon class="h-4 w-4 text-neutral-400" />
                        {{ t('internalChat.inviteMembers') }}
                      </button>
                      <div class="my-1 border-t border-neutral-100 dark:border-neutral-800" />
                      <template v-if="isSpaceMuted(space)">
                        <button
                          type="button"
                          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                          @click.stop="unmuteSpaceNotifications(space)"
                        >
                          {{ t('internalChat.unmuteNotifications') }}
                        </button>
                      </template>
                      <template v-else-if="isMuteDurationOpen(space._id)">
                        <button
                          v-for="opt in muteDurationOptions"
                          :key="`ch-mute-${opt.key}`"
                          type="button"
                          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                          @click.stop="muteSpaceNotifications(space, opt.key)"
                        >
                          {{ t(opt.labelKey) }}
                        </button>
                      </template>
                      <button
                        v-else
                        type="button"
                        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                        @click.stop="openMuteDurationPicker(space._id, $event)"
                      >
                        {{ t('internalChat.muteNotifications') }}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </section>

          <!-- Records -->
          <section
            v-if="recordSpaces.length"
            class="mb-3"
          >
            <div class="px-2 py-1">
              <span class="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {{ t('internalChat.recordsSection') }}
              </span>
            </div>
            <ul class="space-y-0.5">
              <li
                v-for="space in recordSpaces"
                :key="space._id"
              >
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
                  :class="isSpaceSelected(space) ? 'bg-primary-50 dark:bg-primary-900/30' : ''"
                  @click="selectSpace(space._id)"
                >
                  <span class="flex min-w-0 items-center gap-2">
                    <Avatar
                      :user="{ firstName: spaceDisplayName(space) }"
                      :icon="HashtagIcon"
                      size="sm"
                    />
                    <span class="truncate">{{ spaceDisplayName(space) }}</span>
                  </span>
                  <span
                    v-if="space.unreadCount > 0"
                    class="inline-flex min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[10px] font-semibold text-white"
                  >
                    {{ space.unreadCount > 99 ? '99+' : space.unreadCount }}
                  </span>
                </button>
              </li>
            </ul>
          </section>

          <p
            v-if="!directSpaces.length && !channelSpaces.length && !recordSpaces.length"
            class="px-2 py-4 text-sm text-neutral-500 dark:text-neutral-400"
          >
            {{ t('internalChat.noSpacesYet') }}
          </p>
        </template>

        <p
          v-else
          class="px-2 py-4 text-sm text-neutral-500 dark:text-neutral-400"
        >
          {{ t('internalChat.noSpacesYet') }}
        </p>
      </div>
    </aside>

    <!-- Main pane: full-width conversation on mobile when a space is open -->
    <main
      class="h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-neutral-950"
      :class="mobileShowConversation ? 'flex' : 'hidden md:flex'"
    >
      <div
        v-if="error"
        class="m-3 rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-800 dark:border-danger-800 dark:bg-danger-950/40 dark:text-danger-200"
      >
        {{ error }}
      </div>

      <template v-else-if="loadingSpaces">
        <div class="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800">
          <div class="h-8 w-8 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
          <div class="space-y-1.5">
            <div class="h-3.5 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <div class="h-2.5 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          </div>
        </div>
        <div class="min-h-0 flex-1 space-y-3 px-4 py-4">
          <div
            v-for="n in 6"
            :key="n"
            class="flex gap-2"
          >
            <div class="h-8 w-8 shrink-0 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
            <div class="flex-1 space-y-1.5 pt-0.5">
              <div class="h-3 w-28 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
              <div class="h-4 w-3/4 max-w-sm animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="!selectedSpace">
        <div class="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <ChatBubbleOvalLeftEllipsisIcon class="mb-4 h-12 w-12 text-neutral-300 dark:text-neutral-600" />
          <h2 class="text-base font-semibold text-neutral-900 dark:text-white">
            {{ t('internalChat.emptyHeading') }}
          </h2>
          <p class="mt-2 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
            {{ t('internalChat.emptyBody') }}
          </p>
        </div>
      </template>

      <template v-else>
        <!-- Conversation header -->
        <div class="flex h-14 shrink-0 items-center gap-2 border-b border-neutral-200 px-3 dark:border-neutral-800 sm:gap-3 sm:px-4">
          <button
            type="button"
            class="shrink-0 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 md:hidden dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            :title="t('actions.back')"
            :aria-label="t('actions.back')"
            @click="backToMobileList"
          >
            <ArrowLeftIcon class="h-5 w-5" />
          </button>
          <Avatar
            v-if="selectedSpace.type === 'channel' || selectedSpace.type === 'record'"
            :user="{ firstName: spaceDisplayName(selectedSpace) }"
            :icon="HashtagIcon"
            size="sm"
          />
          <span
            v-else-if="spaceGroupAvatarPeers(selectedSpace).length >= 2"
            class="relative inline-block h-8 w-8 shrink-0"
            aria-hidden="true"
          >
            <AvatarInitials
              v-bind="personAvatarProps(spaceGroupAvatarPeers(selectedSpace)[0])"
              size="xs"
              class="absolute left-0 top-0 z-[1] rounded-full ring-2 ring-white dark:ring-neutral-900"
            />
            <AvatarInitials
              v-bind="personAvatarProps(spaceGroupAvatarPeers(selectedSpace)[1])"
              size="xs"
              class="absolute bottom-0 right-0 z-[2] rounded-full ring-2 ring-white dark:ring-neutral-900"
            />
          </span>
          <AvatarInitials
            v-else
            v-bind="spaceAvatarProps(selectedSpace)"
            size="sm"
          />
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-sm font-semibold text-neutral-900 dark:text-white">
              {{ spaceDisplayName(selectedSpace) }}
            </h2>
            <p
              v-if="selectedSpace.topic"
              class="truncate text-xs text-neutral-500 dark:text-neutral-400"
            >
              {{ selectedSpace.topic }}
            </p>
            <p
              v-else-if="selectedSpace.type === 'record'"
              class="truncate text-xs text-neutral-500 dark:text-neutral-400"
            >
              {{ t('internalChat.recordSpaceHint', { module: selectedSpace.moduleKey }) }}
            </p>
            <p
              v-else-if="presenceLabel"
              class="truncate text-xs text-neutral-500 dark:text-neutral-400"
            >
              {{ presenceLabel }}
            </p>
          </div>
          <div
            v-if="presenceViewers.length"
            class="hidden items-center -space-x-1.5 sm:flex"
          >
            <AvatarInitials
              v-for="viewer in presenceViewers.slice(0, 4)"
              :key="viewer.userId"
              v-bind="personAvatarProps(presenceAvatarUser(viewer))"
              size="sm"
              class="ring-2 ring-white dark:ring-neutral-900"
            />
          </div>
          <div
            v-if="selectedSpace.isMember !== false"
            class="relative shrink-0"
            data-channel-menu
          >
            <button
              type="button"
              class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              :title="t('internalChat.channelMenu')"
              :aria-expanded="showChannelMenu"
              @click.stop="showChannelMenu = !showChannelMenu; muteDurationMenuId = null"
            >
              <EllipsisHorizontalIcon class="h-5 w-5" />
            </button>
            <div
              v-if="showChannelMenu"
              class="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
            >
              <button
                v-if="selectedSpace.type === 'channel'"
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                @click="openRenameChannelModal()"
              >
                <PencilSquareIcon class="h-4 w-4 text-neutral-400" />
                {{ t('internalChat.renameChannel') }}
              </button>
              <button
                v-if="canManageSpaceMembers"
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                @click="openMembersFromChannelMenu"
              >
                <UsersIcon class="h-4 w-4 text-neutral-400" />
                {{ t('internalChat.viewMembers') }}
              </button>
              <button
                v-if="canManageSpaceMembers"
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                @click="openInviteFromChannelMenu"
              >
                <UserPlusIcon class="h-4 w-4 text-neutral-400" />
                {{ t('internalChat.inviteMembers') }}
              </button>
              <div
                v-if="canManageSpaceMembers || selectedSpace.type === 'channel'"
                class="my-1 border-t border-neutral-100 dark:border-neutral-800"
              />
              <template v-if="isSpaceMuted(selectedSpace)">
                <button
                  type="button"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                  @click="unmuteSpaceNotifications(selectedSpace)"
                >
                  {{ t('internalChat.unmuteNotifications') }}
                </button>
              </template>
              <template v-else-if="isMuteDurationOpen('header')">
                <button
                  v-for="opt in muteDurationOptions"
                  :key="`hdr-mute-${opt.key}`"
                  type="button"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                  @click="muteSpaceNotifications(selectedSpace, opt.key)"
                >
                  {{ t(opt.labelKey) }}
                </button>
              </template>
              <button
                v-else
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                @click.stop="openMuteDurationPicker('header', $event)"
              >
                {{ t('internalChat.muteNotifications') }}
              </button>
            </div>
          </div>
          <div class="relative min-w-0 shrink sm:shrink-0">
            <MagnifyingGlassIcon class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              v-model="searchQuery"
              type="search"
              class="w-28 rounded-lg border border-neutral-200 bg-neutral-50 py-1 pl-7 pr-2 text-xs text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white sm:w-40"
              :placeholder="t('internalChat.searchPlaceholder')"
              @input="onSearchInput"
              @keydown.enter.prevent="runSearch"
            >
          </div>
          <button
            type="button"
            class="hidden shrink-0 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 sm:inline-flex dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            :title="t('internalChat.exportTranscript')"
            @click="downloadExport"
          >
            <ArrowDownTrayIcon class="h-4 w-4" />
          </button>
        </div>

        <!-- Pinned messages strip -->
        <div
          v-if="pinnedMessages.length"
          class="shrink-0 border-b border-neutral-200/90 bg-white dark:border-neutral-800 dark:bg-neutral-950/40"
        >
          <div class="mx-auto w-full max-w-4xl px-3 py-2 sm:px-6 md:px-10 lg:px-14">
            <div class="flex items-start gap-2.5">
              <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-950/50">
                <MapPinSolidIcon class="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
              </div>
              <div class="min-w-0 flex-1 space-y-0.5">
                <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                  {{ t('internalChat.pinnedStripTitle') }}
                </p>
                <button
                  v-for="pin in visiblePinnedMessages"
                  :key="pin._id"
                  type="button"
                  class="flex w-full min-w-0 items-baseline gap-1.5 rounded-md py-0.5 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-900/80"
                  @click="jumpToPinnedMessage(pin._id)"
                >
                  <span class="shrink-0 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                    {{ pinnedAuthorLabel(pin) }}
                  </span>
                  <span class="min-w-0 truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {{ pinnedPreviewText(pin) }}
                  </span>
                </button>
              </div>
              <button
                v-if="pinnedMessages.length > 1"
                type="button"
                class="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                @click="pinnedStripExpanded = !pinnedStripExpanded"
              >
                {{
                  pinnedStripExpanded
                    ? t('internalChat.pinnedStripCollapse')
                    : t('internalChat.pinnedStripMore', { count: pinnedMessages.length - 1 })
                }}
              </button>
            </div>
          </div>
        </div>

        <!-- Search results (cross-space / API hits) -->
        <div
          v-if="searchQuery.trim().length >= 2 && (conversationMatchIds.size || searchResults.length)"
          class="shrink-0 border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50"
        >
          <div class="mx-auto w-full max-w-4xl px-3 py-2 sm:px-6 md:px-10 lg:px-14">
          <div class="mb-1 flex items-center justify-between gap-2">
            <span class="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
              {{ t('internalChat.searchMatchCount', { count: conversationMatchIds.size || searchResults.length }) }}
            </span>
            <button
              type="button"
              class="text-xs text-primary-600 dark:text-primary-400"
              @click="clearSearch"
            >
              {{ t('internalChat.clearSearch') }}
            </button>
          </div>
          <ul
            v-if="searchResults.length"
            class="max-h-36 space-y-0.5 overflow-auto"
          >
            <li
              v-for="hit in searchResults"
              :key="hit._id"
            >
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-neutral-200 dark:hover:bg-neutral-800"
                :class="String(focusedSearchMessageId) === String(hit._id) ? 'bg-amber-100 dark:bg-amber-950/40' : ''"
                @click="jumpToSearchHit(hit)"
              >
                <AvatarInitials
                  v-bind="personAvatarProps(hit.author || { firstName: hit.space?.name || '?' })"
                  size="sm"
                />
                <span class="min-w-0">
                  <span class="font-medium text-neutral-800 dark:text-neutral-100">
                    {{ hit.space?.name || spaceDisplayName(hit.space) || '…' }}
                  </span>
                  <span class="ml-1 text-neutral-500">{{ truncate(plainTextFromInternalChatHtml(formatMentionText(hit.body)), 80) }}</span>
                </span>
              </button>
            </li>
          </ul>
          </div>
        </div>

        <!-- Messages + optional Gmail-style thread panel -->
        <div class="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          :class="threadRootId ? 'md:mr-[min(42%,36rem)]' : ''"
        >
        <!-- Messages -->
        <div
          ref="messageListEl"
          class="min-h-0 flex-1 overflow-auto"
          :class="(loadingMessages || messageListReady) ? '' : 'invisible'"
        >
          <div class="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-end px-3 pb-3 pt-6 sm:px-6 sm:pt-10 md:px-10 lg:px-14">
            <div
              v-if="loadingMessages"
              class="space-y-3"
            >
              <div
                v-for="n in 4"
                :key="n"
                class="flex gap-2"
              >
                <div class="h-8 w-8 shrink-0 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
                <div class="flex-1 space-y-1.5 pt-0.5">
                  <div class="h-3 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                  <div class="h-4 w-2/3 max-w-xs animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                </div>
              </div>
            </div>

            <template v-else-if="messages.length">
              <div
                v-for="msg in messages"
                :key="msg._id"
                :data-message-id="msg._id"
                class="group flex w-full py-1.5"
                :class="isSystemMessage(msg)
                  ? 'justify-center'
                  : [
                    isOwnMessage(msg) ? 'justify-end' : 'justify-start',
                    String(msg._id) === String(threadRootId || '') || String(msg._id) === String(editingMessageId || '')
                      ? 'rounded-xl bg-primary-50/70 ring-1 ring-primary-200 dark:bg-primary-900/40 dark:ring-primary-700'
                      : '',
                    String(msg._id) === String(focusedSearchMessageId || '')
                      ? 'rounded-xl bg-amber-50 ring-2 ring-amber-400/80 dark:bg-amber-900/40 dark:ring-amber-600'
                      : '',
                    String(msg._id) === String(pinFlashMessageId || '')
                      ? 'rounded-xl bg-primary-50/50 ring-1 ring-primary-300/70 transition dark:bg-primary-950/30 dark:ring-primary-700/60'
                      : '',
                  ]"
              >
                <div
                  v-if="isSystemMessage(msg)"
                  class="max-w-lg px-3 text-center text-xs leading-relaxed text-neutral-500 dark:text-neutral-400"
                >
                  <span>{{ systemMessageText(msg) }}</span>
                  <span class="ml-1.5 whitespace-nowrap text-neutral-400 dark:text-neutral-500">{{ formatTime(msg.createdAt) }}</span>
                </div>
                <div
                  v-else
                  class="flex max-w-[min(92%,22rem)] gap-2 sm:max-w-[min(85%,32rem)]"
                  :class="isOwnMessage(msg) ? 'flex-row-reverse' : 'flex-row'"
                >
                  <AvatarInitials
                    v-if="!isOwnMessage(msg)"
                    v-bind="authorAvatarProps(msg)"
                    size="sm"
                    class="mt-5 shrink-0"
                  />
                  <div
                    class="min-w-0"
                    :class="isOwnMessage(msg) ? 'text-right' : 'text-left'"
                  >
                    <div
                      class="mb-0.5 flex items-baseline gap-1.5"
                      :class="isOwnMessage(msg) ? 'justify-end' : 'justify-start'"
                    >
                      <span
                        v-if="!isOwnMessage(msg)"
                        class="text-xs font-semibold text-neutral-700 dark:text-neutral-200"
                      >
                        {{ authorLabel(msg) }}
                      </span>
                      <span class="text-[11px] text-neutral-400 dark:text-neutral-500">
                        {{ formatTime(msg.createdAt) }}
                        <span
                          v-if="msg.editedAt"
                          class="ml-1 font-medium text-neutral-400 dark:text-neutral-500"
                        >· {{ t('internalChat.editedLabel') }}</span>
                        <span
                          v-if="isPinned(msg)"
                          class="ml-1 inline-flex items-center text-primary-500 dark:text-primary-400"
                          :title="t('internalChat.pinnedLabel')"
                        >
                          <MapPinSolidIcon class="inline h-3 w-3" aria-hidden="true" />
                          <span class="sr-only">{{ t('internalChat.pinnedLabel') }}</span>
                        </span>
                      </span>
                    </div>

                    <div
                      class="relative inline-block max-w-full text-left"
                      :class="isOwnMessage(msg) ? 'ml-auto' : ''"
                    >
                      <div
                        v-if="!msg.deletedAt"
                        class="absolute bottom-[calc(100%+4px)] z-20 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                        :class="isOwnMessage(msg) ? 'right-0' : 'left-0'"
                      >
                        <!-- Reactions first (Google Chat / Slack) -->
                        <div class="flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-0.5 shadow-md dark:border-neutral-600 dark:bg-neutral-800">
                          <HoverTooltip
                            v-for="emoji in quickEmojis.slice(0, 3)"
                            :key="`hover-${emoji}`"
                            :content="t('internalChat.reactWith', { emoji })"
                            preferred-placement="above"
                            :z-index="Z_INDEX_FLOATING_OVERLAY"
                            :show-delay="80"
                          >
                            <button
                              type="button"
                              class="rounded-md px-1.5 py-1 text-sm leading-none hover:bg-neutral-100 dark:hover:bg-neutral-700"
                              @click="react(msg, emoji)"
                            >
                              {{ emoji }}
                            </button>
                          </HoverTooltip>
                        </div>
                        <!-- Actions: add reaction + reply first (Google Chat) -->
                        <div class="flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-0.5 shadow-md dark:border-neutral-600 dark:bg-neutral-800">
                          <HoverTooltip
                            :content="t('internalChat.addReaction')"
                            preferred-placement="above"
                            :z-index="Z_INDEX_FLOATING_OVERLAY"
                            :show-delay="80"
                          >
                            <button
                              type="button"
                              class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                              @click.stop="openMessageReactionPicker(msg, $event)"
                            >
                              <FaceSmileIcon class="h-3.5 w-3.5" />
                            </button>
                          </HoverTooltip>
                          <HoverTooltip
                            :content="t('internalChat.quoteInReply')"
                            preferred-placement="above"
                            :z-index="Z_INDEX_FLOATING_OVERLAY"
                            :show-delay="80"
                          >
                            <button
                              type="button"
                              class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                              @click="startQuoteReply(msg)"
                            >
                              <ArrowUturnLeftIcon class="h-3.5 w-3.5" />
                            </button>
                          </HoverTooltip>
                          <HoverTooltip
                            :content="t('internalChat.replyInThread')"
                            preferred-placement="above"
                            :z-index="Z_INDEX_FLOATING_OVERLAY"
                            :show-delay="80"
                          >
                            <button
                              type="button"
                              class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                              @click="openThread(msg)"
                            >
                              <ChatBubbleLeftIcon class="h-3.5 w-3.5" />
                            </button>
                          </HoverTooltip>
                          <HoverTooltip
                            v-if="isOwnMessage(msg)"
                            :content="t('internalChat.editMessage')"
                            preferred-placement="above"
                            :z-index="Z_INDEX_FLOATING_OVERLAY"
                            :show-delay="80"
                          >
                            <button
                              type="button"
                              class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                              @click="startEditMessage(msg)"
                            >
                              <PencilSquareIcon class="h-3.5 w-3.5" />
                            </button>
                          </HoverTooltip>
                          <HoverTooltip
                            :content="isPinned(msg) ? t('internalChat.unpin') : t('internalChat.pin')"
                            preferred-placement="above"
                            :z-index="Z_INDEX_FLOATING_OVERLAY"
                            :show-delay="80"
                          >
                            <button
                              type="button"
                              class="rounded-md p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                              :class="isPinned(msg)
                                ? 'text-primary-600 dark:text-primary-400'
                                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-300 dark:hover:text-neutral-100'"
                              @click="togglePin(msg)"
                            >
                              <MapPinSolidIcon
                                v-if="isPinned(msg)"
                                class="h-3.5 w-3.5"
                              />
                              <MapPinIcon
                                v-else
                                class="h-3.5 w-3.5"
                              />
                            </button>
                          </HoverTooltip>
                          <HoverTooltip
                            :content="t('internalChat.markAsUnread')"
                            preferred-placement="above"
                            :z-index="Z_INDEX_FLOATING_OVERLAY"
                            :show-delay="80"
                          >
                            <button
                              type="button"
                              class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                              @click="markMessageAsUnread(msg)"
                            >
                              <EnvelopeIcon class="h-3.5 w-3.5" />
                            </button>
                          </HoverTooltip>
                          <HoverTooltip
                            v-if="isOwnMessage(msg)"
                            :content="t('actions.delete')"
                            preferred-placement="above"
                            :z-index="Z_INDEX_FLOATING_OVERLAY"
                            :show-delay="80"
                          >
                            <button
                              type="button"
                              class="rounded-md p-1.5 text-neutral-500 hover:bg-danger-50 hover:text-danger-600 dark:text-neutral-300 dark:hover:bg-danger-950/40 dark:hover:text-danger-400"
                              @click="removeMessage(msg)"
                            >
                              <TrashIcon class="h-3.5 w-3.5" />
                            </button>
                          </HoverTooltip>
                        </div>
                      </div>

                      <div
                        v-if="msg.deletedAt"
                        class="rounded-2xl px-3 py-2 text-sm italic leading-snug text-neutral-500 dark:text-neutral-400"
                        :class="isOwnMessage(msg)
                          ? 'rounded-br-md bg-neutral-100 dark:bg-neutral-800/80'
                          : 'rounded-bl-md bg-neutral-100 dark:bg-neutral-800/80'"
                      >
                        {{ t('internalChat.messageDeletedByAuthor') }}
                      </div>
                      <div
                        v-else
                        class="rounded-2xl px-3 py-2 text-sm leading-snug shadow-sm"
                        :class="isOwnMessage(msg)
                          ? 'rounded-br-md bg-primary-600 text-white'
                          : 'rounded-bl-md bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'"
                      >
                        <button
                          v-if="msg.quote?.messageId"
                          type="button"
                          class="mb-2 flex w-full items-start gap-1.5 rounded-xl px-2 py-1.5 text-left transition"
                          :class="isOwnMessage(msg)
                            ? 'bg-black/15 hover:bg-black/25'
                            : 'bg-neutral-200/70 hover:bg-neutral-200 dark:bg-neutral-900/70 dark:hover:bg-neutral-900'"
                          @click="jumpToQuotedMessage(msg.quote.messageId)"
                        >
                          <svg
                            class="mt-0.5 h-3.5 w-3.5 shrink-0"
                            :class="isOwnMessage(msg) ? 'text-white/55' : 'text-primary-400 dark:text-primary-500'"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M7.17 6C4.42 6.86 3 9.03 3 12.1V18h6.5v-5.9H6.35c.1-1.63.86-2.72 2.42-3.32L7.17 6zm10.66 0C15.08 6.86 13.67 9.03 13.67 12.1V18H20.2v-5.9h-3.15c.1-1.63.86-2.72 2.42-3.32L17.83 6z" />
                          </svg>
                          <span class="min-w-0 flex-1">
                            <span
                              class="block truncate text-[11px] font-semibold"
                              :class="isOwnMessage(msg) ? 'text-white' : 'text-neutral-900 dark:text-neutral-100'"
                            >
                              {{ msg.quote.authorName || t('internalChat.unknownAuthor') }}
                            </span>
                            <span
                              class="mt-0.5 block line-clamp-2 text-[11px] leading-snug"
                              :class="isOwnMessage(msg) ? 'text-white/75' : 'text-neutral-600 dark:text-neutral-400'"
                            >
                              {{ msg.quote.bodyPreview || '…' }}
                            </span>
                          </span>
                        </button>
                        <div
                          class="ic-md break-words text-sm leading-snug"
                          :class="isOwnMessage(msg) ? 'ic-md--own' : 'ic-md--other'"
                          v-html="messageBodyHtml(msg)"
                          @click.capture="onMessageBodyClick"
                        />
                        <div
                          v-if="messageImageAttachments(msg).length"
                          class="mt-1.5 grid gap-1"
                          :class="messageImageAttachments(msg).length === 1
                            ? 'grid-cols-1'
                            : messageImageAttachments(msg).length === 2
                              ? 'grid-cols-2'
                              : 'grid-cols-2 sm:grid-cols-3'"
                        >
                          <button
                            v-for="(att, aidx) in messageImageAttachments(msg)"
                            :key="`img-${aidx}`"
                            type="button"
                            class="group relative block overflow-hidden rounded-lg text-left"
                            :class="messageImageAttachments(msg).length === 1 ? 'max-w-xs' : ''"
                            @click="openImageGallery(msg, aidx)"
                          >
                            <img
                              :src="att.url"
                              :alt="att.fileName || 'image'"
                              class="max-h-56 w-full object-cover"
                              loading="lazy"
                            >
                          </button>
                        </div>
                        <div
                          v-if="messageFileAttachments(msg).length"
                          class="mt-1.5 flex flex-wrap gap-1.5"
                        >
                          <button
                            v-for="(att, aidx) in messageFileAttachments(msg)"
                            :key="`file-${aidx}`"
                            type="button"
                            class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs"
                            :class="isOwnMessage(msg)
                              ? 'bg-white/15 text-white hover:bg-white/25'
                              : 'border border-neutral-200 bg-white text-primary-700 dark:border-neutral-600 dark:bg-neutral-900 dark:text-primary-300'"
                            @click="openAttachmentPreview(att)"
                          >
                            <PaperClipIcon class="h-3 w-3" />
                            {{ att.fileName }}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div
                      v-if="!msg.deletedAt && msg.reactions?.length"
                      class="mt-1 flex flex-wrap items-center gap-1"
                      :class="isOwnMessage(msg) ? 'justify-end' : 'justify-start'"
                    >
                      <button
                        v-for="r in msg.reactions"
                        :key="r.emoji"
                        type="button"
                        class="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs"
                        :class="r.reacted
                          ? 'border-primary-300 bg-primary-50 text-primary-800 dark:border-primary-700 dark:bg-primary-900/40 dark:text-primary-200'
                          : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'"
                        @click="react(msg, r.emoji)"
                      >
                        <span>{{ r.emoji }}</span>
                        <span>{{ r.count }}</span>
                      </button>
                    </div>
                    <div
                      v-if="msg.recordRefs?.length"
                      class="mt-1 flex flex-wrap gap-1"
                      :class="isOwnMessage(msg) ? 'justify-end' : 'justify-start'"
                    >
                      <span
                        v-for="(ref, idx) in msg.recordRefs"
                        :key="idx"
                        class="rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                      >
                        {{ ref.label || `${ref.moduleKey}` }}
                      </span>
                    </div>
                    <div
                      v-if="Number(msg.replyCount) > 0"
                      class="mt-1.5 flex w-full"
                      :class="isOwnMessage(msg) ? 'justify-end' : 'justify-start'"
                    >
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-semibold text-primary-600 transition hover:bg-primary-50 hover:text-primary-700 dark:text-primary-400 dark:hover:bg-primary-950/40 dark:hover:text-primary-300"
                        @click="openThread(msg)"
                      >
                        <ChatBubbleLeftIcon class="h-3.5 w-3.5" />
                        {{ threadReplyCountLabel(msg.replyCount) }}
                      </button>
                    </div>
                    <InternalChatSeenZone
                      v-if="isOwnMessage(msg)"
                      :mode="readStateMode"
                      :space-type="selectedSpace?.type || 'channel'"
                      :message="msg"
                      :messages="messages"
                      :members="readStateMembers"
                      :my-user-id="authStore.user?._id"
                      :is-anchor="String(msg._id) === String(seenZoneAnchorId || '')"
                      :align-end="true"
                    />
                  </div>
                </div>
              </div>
            </template>

            <div
              v-else
              class="flex flex-1 flex-col items-center justify-center py-12 text-center"
            >
              <ChatBubbleOvalLeftEllipsisIcon class="mb-3 h-10 w-10 text-neutral-300 dark:text-neutral-600" />
              <p class="text-sm text-neutral-500 dark:text-neutral-400">
                {{ t('internalChat.noMessages') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Composer area (channel timeline) -->
        <div class="mx-auto w-full max-w-4xl shrink-0 px-3 pb-3 sm:px-6 sm:pb-4 md:px-10 lg:px-14">
          <p
            v-if="typingLabel && !threadRootId"
            class="mb-1.5 px-1 text-xs text-neutral-500 dark:text-neutral-400"
          >
            {{ typingLabel }}
          </p>

          <div
            v-if="editingMessageId"
            class="mb-2 flex items-center justify-between gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 dark:border-primary-800 dark:bg-primary-950/40"
          >
            <span class="flex min-w-0 items-center gap-1.5 text-xs font-medium text-primary-800 dark:text-primary-200">
              <PencilSquareIcon class="h-3.5 w-3.5 shrink-0" />
              {{ t('internalChat.editingMessage') }}
            </span>
            <button
              type="button"
              class="shrink-0 text-xs font-medium text-primary-700 hover:text-primary-900 dark:text-primary-300 dark:hover:text-primary-100"
              @click="cancelEditMessage"
            >
              {{ t('actions.cancel') }}
            </button>
          </div>

          <div
            v-if="composerNonMemberMentions.length"
            class="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800/60 dark:bg-amber-950/30"
          >
            <div
              v-for="u in composerNonMemberMentions"
              :key="`nm-${u._id}`"
              class="flex items-center justify-between gap-2 py-0.5"
            >
              <p class="min-w-0 truncate text-xs text-amber-900 dark:text-amber-100">
                {{ t('internalChat.mentionNotInGroup', { name: userLabel(u) }) }}
              </p>
              <button
                type="button"
                class="shrink-0 rounded-md bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-500 dark:text-neutral-900 dark:hover:bg-amber-400"
                :disabled="addingMentionUserId === String(u._id)"
                @click="addMentionedUserToGroup(u)"
              >
                {{ t('internalChat.addToGroup') }}
              </button>
            </div>
          </div>

          <form @submit.prevent="submitMessage">
            <div
              class="rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:focus-within:border-primary-600"
            >
              <div
                v-if="quotingMessage"
                class="px-2.5 pt-2.5"
              >
                <div class="flex items-start gap-2 rounded-xl bg-neutral-100 px-2.5 py-2 dark:bg-neutral-800/80">
                  <svg
                    class="mt-0.5 h-4 w-4 shrink-0 text-primary-400 dark:text-primary-500"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M7.17 6C4.42 6.86 3 9.03 3 12.1V18h6.5v-5.9H6.35c.1-1.63.86-2.72 2.42-3.32L7.17 6zm10.66 0C15.08 6.86 13.67 9.03 13.67 12.1V18H20.2v-5.9h-3.15c.1-1.63.86-2.72 2.42-3.32L17.83 6z" />
                  </svg>
                  <AvatarInitials
                    v-bind="authorAvatarProps(quotingMessage)"
                    size="sm"
                    class="mt-0.5 shrink-0 [&>div]:!h-7 [&>div]:!w-7 [&>div]:!text-[10px] [&>img]:!h-7 [&>img]:!w-7"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-xs font-semibold text-neutral-900 dark:text-white">
                      {{ quoteAuthorLabel(quotingMessage) }}
                    </p>
                    <p class="mt-0.5 line-clamp-2 text-xs leading-snug text-neutral-600 dark:text-neutral-300">
                      {{ quotePreviewText(quotingMessage) }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 rounded-full p-1 text-neutral-400 transition hover:bg-neutral-200/80 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                    :aria-label="t('actions.close')"
                    @click="cancelQuoteReply"
                  >
                    <XMarkIcon class="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div
                v-if="pendingImageAttachments.length"
                class="border-b border-neutral-100 px-3 py-2 dark:border-neutral-800"
              >
                <div
                  class="grid gap-2"
                  :class="pendingImageAttachments.length === 1
                    ? 'grid-cols-1 max-w-[220px]'
                    : pendingImageAttachments.length === 2
                      ? 'grid-cols-2 max-w-sm'
                      : 'grid-cols-3 max-w-md'"
                >
                  <div
                    v-for="att in pendingImageAttachments"
                    :key="att.localId"
                    class="group relative overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800"
                  >
                    <img
                      :src="att.previewUrl || att.url"
                      :alt="att.fileName || 'image'"
                      class="aspect-square w-full object-cover"
                    >
                    <div
                      v-if="att.uploading"
                      class="absolute inset-0 flex items-center justify-center bg-neutral-950/40"
                    >
                      <span class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </div>
                    <button
                      type="button"
                      class="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-950/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      :title="t('actions.remove')"
                      @click="removePendingAttachment(att.localId)"
                    >
                      <XMarkIcon class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <div
                v-if="pendingFileAttachments.length"
                class="flex flex-wrap gap-1.5 border-b border-neutral-100 px-3 py-2 dark:border-neutral-800"
              >
                <span
                  v-for="att in pendingFileAttachments"
                  :key="att.localId"
                  class="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  <PaperClipIcon class="h-3 w-3" />
                  {{ att.fileName }}
                  <button
                    type="button"
                    class="text-neutral-400 hover:text-danger-600"
                    @click="removePendingAttachment(att.localId)"
                  >
                    ×
                  </button>
                </span>
              </div>

              <label class="sr-only" for="internal-chat-composer">{{ t('internalChat.composerLabel') }}</label>
              <div
                class="relative"
                @paste="onComposerPaste"
              >
                <InternalChatComposerEditor
                  id="internal-chat-composer"
                  ref="composerEditorRef"
                  v-model="draft"
                  :placeholder="composerPlaceholder"
                  :disabled="!selectedSpaceId"
                  :mention-labels="composerMentionLabels"
                  @submit="submitMessage"
                  @input="onComposerInput"
                  @update:text="onComposerPlainText"
                />
                <ul
                  v-if="mentionSuggestions.length || showMentionAllOption"
                  class="absolute bottom-full left-2 z-30 mb-1 max-h-40 w-64 overflow-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <li v-if="showMentionAllOption">
                    <button
                      type="button"
                      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      @mousedown.prevent="insertMentionAll"
                    >
                      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                        @
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="block truncate font-medium text-neutral-900 dark:text-white">@all</span>
                        <span class="block truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                          {{ t('internalChat.mentionAllHint') }}
                        </span>
                      </span>
                    </button>
                  </li>
                  <li
                    v-for="u in mentionSuggestions"
                    :key="u._id"
                  >
                    <div
                      class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <button
                        type="button"
                        class="flex min-w-0 flex-1 items-center gap-2 text-left"
                        @mousedown.prevent="insertMention(u)"
                      >
                        <AvatarInitials v-bind="personAvatarProps(u)" size="sm" />
                        <span class="min-w-0 flex-1">
                          <span class="block truncate text-neutral-900 dark:text-white">{{ userLabel(u) }}</span>
                          <span
                            v-if="isNonMemberMentionCandidate(u)"
                            class="block truncate text-[11px] text-neutral-500 dark:text-neutral-400"
                          >
                            {{ t('internalChat.mentionNotInGroupShort') }}
                          </span>
                        </span>
                      </button>
                      <button
                        v-if="isNonMemberMentionCandidate(u)"
                        type="button"
                        class="shrink-0 rounded-md bg-primary-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                        :disabled="addingMentionUserId === String(u._id)"
                        @mousedown.prevent="addMentionedUserToGroup(u, { insertMentionAfter: true })"
                      >
                        {{ t('internalChat.addToGroup') }}
                      </button>
                    </div>
                  </li>
                </ul>
              </div>

              <div class="flex items-center justify-between px-2 pb-2">
                <div class="flex items-center gap-0.5">
                  <input
                    ref="fileInputEl"
                    type="file"
                    class="hidden"
                    :multiple="remainingAttachmentSlots > 1"
                    :accept="composerFileAccept"
                    @change="onFileSelected"
                  >
                  <button
                    type="button"
                    class="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                    :disabled="uploading || !selectedSpaceId || Boolean(editingMessageId) || !canAttachMoreFiles"
                    :title="canAttachMoreFiles
                      ? t('internalChat.attachRemaining', { count: remainingAttachmentSlots, max: MAX_CHAT_ATTACHMENTS })
                      : t('internalChat.attachLimit', { count: MAX_CHAT_ATTACHMENTS })"
                    @mousedown.prevent="canAttachMoreFiles && fileInputEl?.click()"
                  >
                    <PaperClipIcon class="h-4 w-4" />
                  </button>
                  <button
                    ref="mentionButtonRef"
                    type="button"
                    class="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                    :disabled="!selectedSpaceId"
                    :title="t('records.commentMentionTitle', { atSymbol: '@' })"
                    @mousedown.prevent="insertAtSign"
                  >
                    <AtSymbolIcon class="h-4 w-4" />
                  </button>
                  <div class="relative">
                    <button
                      ref="emojiButtonRef"
                      type="button"
                      class="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                      :disabled="!selectedSpaceId"
                      :title="t('records.commentAddEmoji')"
                      @mousedown.prevent="toggleEmojiPicker"
                    >
                      <FaceSmileIcon class="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                  :disabled="sending || uploading || (!editingMessageId && isInternalChatBodyEmpty(draft) && !pendingAttachments.length)"
                  :title="editingMessageId ? t('internalChat.saveEdit') : t('internalChat.send')"
                >
                  <PencilSquareIcon
                    v-if="editingMessageId"
                    class="h-4 w-4"
                  />
                  <PaperAirplaneIcon
                    v-else
                    class="h-4 w-4"
                  />
                </button>
              </div>
            </div>
          </form>
        </div>
        </div>

        <!-- Thread side panel (Gmail-style) -->
        <Transition
          name="ic-thread-panel"
          @after-leave="onThreadPanelAfterLeave"
        >
          <aside
            v-if="threadRootId"
            key="thread-panel"
            class="ic-thread-panel flex min-h-0 w-full flex-col border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 absolute inset-0 z-20 md:inset-y-0 md:left-auto md:right-0 md:w-[min(42%,36rem)] md:min-w-[22rem] md:border-l"
          >
          <div class="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-neutral-200 px-3 dark:border-neutral-800">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                {{ t('internalChat.threadOpen') }}
              </p>
              <p
                v-if="Number(threadRootMessage?.replyCount) > 0"
                class="truncate text-[11px] text-neutral-500 dark:text-neutral-400"
              >
                {{ threadReplyCountLabel(threadRootMessage.replyCount) }}
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/40"
              @click="closeThread"
            >
              {{ t('internalChat.closeThread') }}
            </button>
          </div>

          <div
            ref="threadListEl"
            class="min-h-0 flex-1 space-y-3 overflow-auto px-3 py-3"
          >
            <div
              v-if="threadRootMessage"
              class="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60"
            >
              <div class="mb-1 flex items-center gap-2">
                <AvatarInitials
                  v-bind="authorAvatarProps(threadRootMessage)"
                  size="sm"
                />
                <div class="min-w-0">
                  <p class="truncate text-xs font-semibold text-neutral-800 dark:text-neutral-100">
                    {{ authorLabel(threadRootMessage) }}
                  </p>
                  <p class="text-[11px] text-neutral-400">
                    {{ formatTime(threadRootMessage.createdAt) }}
                  </p>
                </div>
              </div>
              <div
                class="ic-md ic-md--other break-words text-sm text-neutral-800 dark:text-neutral-100"
                v-html="messageBodyHtml(threadRootMessage)"
                @click.capture="onMessageBodyClick"
              />
            </div>

            <div
              v-if="loadingThread"
              class="space-y-2 py-2"
            >
              <div
                v-for="n in 3"
                :key="n"
                class="h-12 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-900"
              />
            </div>

            <template v-else-if="threadMessages.length">
              <div
                v-for="msg in threadMessages"
                :key="msg._id"
                :data-message-id="msg._id"
                class="flex gap-2 rounded-xl"
                :class="[
                  isOwnMessage(msg) ? 'flex-row-reverse' : 'flex-row',
                  String(msg._id) === String(focusedSearchMessageId || '')
                    ? 'bg-amber-50 ring-2 ring-amber-400/80 dark:bg-amber-900/40 dark:ring-amber-600'
                    : '',
                ]"
              >
                <AvatarInitials
                  v-if="!isOwnMessage(msg)"
                  v-bind="authorAvatarProps(msg)"
                  size="sm"
                  class="mt-0.5 shrink-0"
                />
                <div
                  class="min-w-0 max-w-[85%]"
                  :class="isOwnMessage(msg) ? 'text-right' : 'text-left'"
                >
                  <div
                    class="mb-0.5 flex items-baseline gap-1.5"
                    :class="isOwnMessage(msg) ? 'justify-end' : 'justify-start'"
                  >
                    <span
                      v-if="!isOwnMessage(msg)"
                      class="text-[11px] font-semibold text-neutral-700 dark:text-neutral-200"
                    >
                      {{ authorLabel(msg) }}
                    </span>
                    <span class="text-[10px] text-neutral-400">
                      {{ formatTime(msg.createdAt) }}
                      <span
                        v-if="msg.editedAt"
                        class="ml-1"
                      >· {{ t('internalChat.editedLabel') }}</span>
                    </span>
                    <button
                      v-if="isOwnMessage(msg)"
                      type="button"
                      class="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                      :title="t('internalChat.editMessage')"
                      @click="startEditMessage(msg)"
                    >
                      <PencilSquareIcon class="h-3 w-3" />
                    </button>
                  </div>
                  <div
                    class="inline-block rounded-2xl px-3 py-2 text-left text-sm leading-snug"
                    :class="isOwnMessage(msg)
                      ? 'rounded-br-md bg-primary-600 text-white'
                      : 'rounded-bl-md bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'"
                  >
                    <div
                      class="ic-md break-words"
                      :class="isOwnMessage(msg) ? 'ic-md--own' : 'ic-md--other'"
                      v-html="messageBodyHtml(msg)"
                      @click.capture="onMessageBodyClick"
                    />
                    <div
                      v-if="messageImageAttachments(msg).length"
                      class="mt-2 grid gap-1.5"
                      :class="messageImageAttachments(msg).length === 1 ? 'grid-cols-1' : 'grid-cols-2'"
                    >
                      <button
                        v-for="(att, aidx) in messageImageAttachments(msg)"
                        :key="`${msg._id}-img-${aidx}`"
                        type="button"
                        class="overflow-hidden rounded-lg"
                        @click="openImageGallery(msg, aidx)"
                      >
                        <img
                          :src="att.url"
                          :alt="att.fileName || 'image'"
                          class="aspect-square w-full object-cover"
                        >
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <p
              v-else
              class="py-6 text-center text-xs text-neutral-500 dark:text-neutral-400"
            >
              {{ t('internalChat.threadEmpty') }}
            </p>
          </div>

          <form
            class="shrink-0 border-t border-neutral-200 p-3 dark:border-neutral-800"
            @submit.prevent="submitThreadReply"
          >
            <div class="rounded-xl border border-neutral-200 bg-white focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900">
              <InternalChatComposerEditor
                ref="threadComposerEditorRef"
                v-model="threadDraft"
                bubble-plugin-key="internalChatThreadBubble"
                :placeholder="t('internalChat.threadReplyPlaceholder')"
                :mention-labels="composerMentionLabels"
                @submit="submitThreadReply"
              />
              <div class="flex items-center justify-end px-2 pb-2">
                <button
                  type="submit"
                  class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                  :disabled="sendingThread || isInternalChatBodyEmpty(threadDraft)"
                  :title="t('internalChat.send')"
                >
                  <PaperAirplaneIcon class="h-4 w-4" />
                </button>
              </div>
            </div>
          </form>
        </aside>
        </Transition>
        </div>
      </template>
    </main>
    </div>

    <Teleport to="body">
      <div
        v-if="showEmojiPicker"
        ref="emojiPickerRef"
        :class="[
          'fixed rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800',
          FLOATING_OVERLAY_Z_CLASS,
        ]"
        :style="emojiPickerStyle"
      >
        <emoji-picker
          :class="['internal-chat-composer-emoji-picker', isDarkTheme ? 'dark' : 'light']"
          :theme="isDarkTheme ? 'dark' : 'light'"
          :style="{ colorScheme: isDarkTheme ? 'dark' : 'light' }"
          @emoji-click="handleEmojiPickerSelect"
        />
      </div>
    </Teleport>

    <InternalChatMediaLightbox
      :open="showImageAttachmentPreview"
      :items="previewGalleryItems"
      :start-index="previewGalleryIndex"
      @close="closeAttachmentPreview"
    />

    <Teleport to="body">
      <div
        v-if="showFileAttachmentPreview"
        class="fixed inset-0 z-[10100] flex items-center justify-center bg-neutral-950/70 p-4"
        @click.self="closeAttachmentPreview"
      >
        <div class="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-neutral-900">
          <div class="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
            <PaperClipIcon class="h-5 w-5 shrink-0 text-neutral-400" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                {{ previewAttachment?.fileName || t('internalChat.attach') }}
              </p>
              <p
                v-if="previewAttachment?.mimeType"
                class="truncate text-xs text-neutral-500 dark:text-neutral-400"
              >
                {{ previewAttachment.mimeType }}
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              :aria-label="t('actions.close')"
              @click="closeAttachmentPreview"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>
          <div class="flex flex-col items-center gap-4 px-6 py-8 text-center">
            <iframe
              v-if="isPreviewPdf(previewAttachment)"
              :src="previewAttachment.url"
              class="h-[min(60vh,520px)] w-full rounded-lg border border-neutral-200 bg-white dark:border-neutral-700"
              :title="previewAttachment.fileName"
            />
            <template v-else>
              <DocumentIcon class="h-12 w-12 text-neutral-300 dark:text-neutral-600" />
              <p class="text-sm text-neutral-600 dark:text-neutral-300">
                {{ t('cases.recordAttachmentPreviewUnavailable') }}
              </p>
            </template>
            <a
              v-if="previewAttachment?.url"
              :href="previewAttachment.url"
              class="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              download
            >
              <ArrowDownTrayIcon class="h-4 w-4" />
              {{ t('cases.recordAttachmentDownload') }}
            </a>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- New channel modal -->
    <div
      v-if="showChannelModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-[2px]"
      @click.self="closeChannelModal"
    >
      <div class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
        <div class="border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <h3 class="text-base font-semibold text-neutral-900 dark:text-white">
            {{ t('internalChat.newChannel') }}
          </h3>
          <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {{ t('internalChat.channelModalSubtitle') }}
          </p>
        </div>
        <div class="space-y-4 px-5 py-4">
          <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {{ t('internalChat.channelName') }}
            <input
              v-model="channelName"
              type="text"
              class="mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            >
          </label>
          <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {{ t('internalChat.channelTopic') }}
            <input
              v-model="channelTopic"
              type="text"
              class="mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            >
          </label>
          <label class="flex items-start gap-2.5 text-sm text-neutral-700 dark:text-neutral-300">
            <input
              v-model="channelPrivate"
              type="checkbox"
              class="mt-0.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            >
            <span>
              <span class="font-medium">{{ t('internalChat.channelPrivate') }}</span>
              <span class="mt-0.5 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                {{ channelPrivate ? t('internalChat.channelPrivateHint') : t('internalChat.channelPublicHint') }}
              </span>
            </span>
          </label>
          <div>
            <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {{ t('internalChat.channelInviteLabel') }}
            </p>
            <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {{ channelPrivate ? t('internalChat.channelInvitePrivateHint') : t('internalChat.channelInvitePublicHint') }}
            </p>
            <div class="relative mt-2">
              <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                v-model="channelInviteFilter"
                type="search"
                class="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                :placeholder="t('internalChat.dmSearchPlaceholder')"
              >
            </div>
            <div class="mt-2 max-h-40 space-y-0.5 overflow-auto rounded-xl border border-neutral-100 p-1 dark:border-neutral-800">
              <button
                v-for="u in filteredChannelInviteCandidates"
                :key="u._id"
                type="button"
                class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
                :class="channelInviteIds.includes(String(u._id)) ? 'bg-primary-50 dark:bg-primary-900/30' : ''"
                @click="toggleChannelInvite(u._id)"
              >
                <AvatarInitials v-bind="personAvatarProps(u)" size="sm" />
                <span class="min-w-0 flex-1 truncate">{{ userLabel(u) }}</span>
                <span
                  v-if="channelInviteIds.includes(String(u._id))"
                  class="text-xs text-primary-600"
                >✓</span>
              </button>
              <p
                v-if="!filteredChannelInviteCandidates.length"
                class="px-2 py-3 text-center text-xs text-neutral-500"
              >
                {{ t('internalChat.noUsers') }}
              </p>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-neutral-100 bg-neutral-50/80 px-5 py-3 dark:border-neutral-800 dark:bg-neutral-950/40">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800"
            @click="closeChannelModal"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
            :disabled="creating || !channelName.trim()"
            @click="createChannel"
          >
            {{ t('actions.create') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Rename channel modal -->
    <div
      v-if="showRenameChannelModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-[2px]"
      @click.self="closeRenameChannelModal"
    >
      <div class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
        <div class="border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <h3 class="text-base font-semibold text-neutral-900 dark:text-white">
            {{ t('internalChat.renameChannel') }}
          </h3>
          <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {{ t('internalChat.renameChannelHint') }}
          </p>
        </div>
        <div class="space-y-3 px-5 py-4">
          <label class="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            {{ t('internalChat.channelName') }}
            <input
              ref="renameChannelInputEl"
              v-model="renameChannelName"
              type="text"
              maxlength="120"
              class="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              @keydown.enter.prevent="submitRenameChannel"
            >
          </label>
          <label class="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            {{ t('internalChat.channelTopic') }}
            <input
              v-model="renameChannelTopic"
              type="text"
              maxlength="500"
              class="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              @keydown.enter.prevent="submitRenameChannel"
            >
          </label>
        </div>
        <div class="flex justify-end gap-2 border-t border-neutral-100 bg-neutral-50/80 px-5 py-3 dark:border-neutral-800 dark:bg-neutral-950/40">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800"
            @click="closeRenameChannelModal"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
            :disabled="renamingChannel || !renameChannelName.trim()"
            @click="submitRenameChannel"
          >
            {{ t('actions.save') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Invite members modal -->
    <div
      v-if="showInviteModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-[2px]"
      @click.self="closeInviteModal"
    >
      <div class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
        <div class="border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <h3 class="text-base font-semibold text-neutral-900 dark:text-white">
            {{ t('internalChat.inviteMembers') }}
          </h3>
          <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {{
              selectedSpace?.type === 'group_dm'
                ? t('internalChat.inviteModalSubtitleGroup')
                : t('internalChat.inviteModalSubtitle')
            }}
          </p>
        </div>
        <div class="space-y-3 px-5 py-4">
          <div class="relative">
            <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              v-model="inviteFilter"
              type="search"
              class="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              :placeholder="t('internalChat.dmSearchPlaceholder')"
            >
          </div>
          <div class="max-h-56 space-y-0.5 overflow-auto rounded-xl border border-neutral-100 p-1 dark:border-neutral-800">
            <button
              v-for="u in filteredInviteCandidates"
              :key="u._id"
              type="button"
              class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
              :class="inviteMemberIds.includes(String(u._id)) ? 'bg-primary-50 dark:bg-primary-900/30' : ''"
              @click="toggleInviteMember(u._id)"
            >
              <AvatarInitials v-bind="personAvatarProps(u)" size="sm" />
              <span class="min-w-0 flex-1 truncate">{{ userLabel(u) }}</span>
              <span
                v-if="inviteMemberIds.includes(String(u._id))"
                class="text-xs text-primary-600"
              >✓</span>
            </button>
            <p
              v-if="!filteredInviteCandidates.length"
              class="px-2 py-3 text-center text-xs text-neutral-500"
            >
              {{ t('internalChat.noUsers') }}
            </p>
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-neutral-100 bg-neutral-50/80 px-5 py-3 dark:border-neutral-800 dark:bg-neutral-950/40">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800"
            @click="closeInviteModal"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
            :disabled="inviting || !inviteMemberIds.length"
            @click="submitInviteMembers"
          >
            {{ t('internalChat.inviteSend') }}
          </button>
        </div>
      </div>
    </div>

    <!-- View members modal -->
    <div
      v-if="showMembersModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-[2px]"
      @click.self="closeMembersModal"
    >
      <div class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
        <div class="border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <h3 class="text-base font-semibold text-neutral-900 dark:text-white">
            {{ t('internalChat.membersTitle') }}
          </h3>
          <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {{ t('internalChat.membersCount', { count: spaceMembers.length }) }}
          </p>
        </div>
        <div class="px-5 py-4">
          <div
            v-if="loadingMembers"
            class="space-y-2 py-2"
          >
            <div
              v-for="n in 4"
              :key="n"
              class="flex items-center gap-2"
            >
              <div class="h-8 w-8 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
              <div class="h-3 w-36 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            </div>
          </div>
          <div
            v-else
            class="max-h-64 space-y-0.5 overflow-auto rounded-xl border border-neutral-100 p-1 dark:border-neutral-800"
          >
            <div
              v-for="m in spaceMembers"
              :key="m.userId"
              class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
            >
              <AvatarInitials
                v-bind="personAvatarProps({
                  firstName: m.firstName,
                  lastName: m.lastName,
                  email: m.email,
                  avatar: m.avatar,
                })"
                size="sm"
              />
              <span class="min-w-0 flex-1 truncate text-neutral-900 dark:text-neutral-100">
                {{ userLabel(m) }}
              </span>
              <span
                v-if="String(m.userId) === String(authStore.user?._id)"
                class="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-400"
              >
                {{ t('internalChat.membersYou') }}
              </span>
              <div
                v-if="m.canRemove"
                class="relative shrink-0"
                data-member-menu
              >
                <button
                  type="button"
                  class="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                  :disabled="removingMemberId === String(m.userId)"
                  :title="t('internalChat.memberMenu')"
                  :aria-label="t('internalChat.memberMenu')"
                  :aria-expanded="memberMenuUserId === String(m.userId)"
                  @click.stop="toggleMemberMenu(m)"
                >
                  <EllipsisHorizontalIcon class="h-4 w-4" />
                </button>
                <div
                  v-if="memberMenuUserId === String(m.userId)"
                  class="absolute right-0 z-40 mt-1 w-40 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger-700 hover:bg-danger-50 disabled:opacity-50 dark:text-danger-300 dark:hover:bg-danger-950/40"
                    :disabled="removingMemberId === String(m.userId)"
                    @click.stop="onMemberMenuRemove(m)"
                  >
                    <UserMinusIcon class="h-4 w-4" />
                    {{
                      String(m.userId) === String(authStore.user?._id)
                        ? t('internalChat.leaveSpace')
                        : t('internalChat.removeMember')
                    }}
                  </button>
                </div>
              </div>
            </div>
            <p
              v-if="!spaceMembers.length"
              class="px-2 py-3 text-center text-xs text-neutral-500"
            >
              {{ t('internalChat.noMembers') }}
            </p>
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-neutral-100 bg-neutral-50/80 px-5 py-3 dark:border-neutral-800 dark:bg-neutral-950/40">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800"
            @click="closeMembersModal"
          >
            {{ t('actions.close') }}
          </button>
          <button
            v-if="membersCanInvite"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
            @click="openInviteFromMembersModal"
          >
            <UserPlusIcon class="h-4 w-4" />
            {{ t('internalChat.inviteMembers') }}
          </button>
        </div>
      </div>
    </div>

    <!-- New DM modal -->
    <div
      v-if="showDmModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-[2px]"
      @click.self="closeDmModal"
    >
      <div class="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
        <div class="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <div class="min-w-0">
            <h3 class="text-base font-semibold text-neutral-900 dark:text-white">
              {{ t('internalChat.newDm') }}
            </h3>
            <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {{ t('internalChat.dmModalSubtitle') }}
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            :aria-label="t('actions.cancel')"
            @click="closeDmModal"
          >
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-3 px-5 pt-4">
          <div class="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
            <button
              type="button"
              class="rounded-lg px-3 py-2 text-sm font-medium transition"
              :class="dmMode === 'dm'
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-white'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'"
              @click="dmMode = 'dm'"
            >
              {{ t('internalChat.dmModeSingle') }}
            </button>
            <button
              type="button"
              class="rounded-lg px-3 py-2 text-sm font-medium transition"
              :class="dmMode === 'group'
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-white'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'"
              @click="dmMode = 'group'"
            >
              {{ t('internalChat.dmModeGroup') }}
            </button>
          </div>

          <div class="relative">
            <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              v-model="dmPickerFilter"
              type="search"
              class="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-500"
              :placeholder="t('internalChat.dmSearchPlaceholder')"
            >
          </div>
        </div>

        <div class="mt-3 max-h-72 min-h-[12rem] overflow-auto px-3 pb-2">
          <button
            v-for="u in filteredDmCandidates"
            :key="u._id"
            type="button"
            class="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800/80"
            :class="isDmCandidateSelected(u)
              ? 'bg-primary-50 ring-1 ring-primary-200 dark:bg-primary-900/40 dark:ring-primary-800'
              : ''"
            @click="dmMode === 'dm' ? (dmUserId = u._id) : toggleGroupMember(u._id)"
          >
            <AvatarInitials
              v-bind="personAvatarProps(u)"
              size="sm"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-neutral-900 dark:text-white">
                {{ userLabel(u) }}
              </span>
              <span
                v-if="u.email"
                class="block truncate text-xs text-neutral-500 dark:text-neutral-400"
              >
                {{ u.email }}
              </span>
            </span>
            <span
              v-if="isDmCandidateSelected(u)"
              class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white"
            >✓</span>
          </button>
          <div
            v-if="!filteredDmCandidates.length"
            class="flex h-40 flex-col items-center justify-center px-4 text-center"
          >
            <ChatBubbleOvalLeftEllipsisIcon class="mb-2 h-8 w-8 text-neutral-300 dark:text-neutral-600" />
            <p class="text-sm text-neutral-500 dark:text-neutral-400">
              {{ dmCandidates.length ? t('internalChat.noUsersMatch') : t('internalChat.noUsers') }}
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50/80 px-5 py-3 dark:border-neutral-800 dark:bg-neutral-950/40">
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            <template v-if="dmMode === 'group' && groupDmIds.length">
              {{ t('internalChat.selectedCount', { count: groupDmIds.length }) }}
            </template>
            <template v-else-if="dmMode === 'dm' && dmUserId">
              {{ t('internalChat.dmReady') }}
            </template>
            <template v-else>
              {{ t('internalChat.dmPickHint') }}
            </template>
          </p>
          <div class="flex shrink-0 gap-2">
            <button
              type="button"
              class="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800"
              @click="closeDmModal"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
              :disabled="creating || (dmMode === 'dm' ? !dmUserId : groupDmIds.length < 2)"
              @click="createDm"
            >
              {{ t('internalChat.dmStart') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Settings modal -->
    <div
      v-if="showSettingsModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="showSettingsModal = false"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900">
        <h3 class="text-lg font-semibold text-neutral-900 dark:text-white">
          {{ t('internalChat.settings') }}
        </h3>
        <label class="mt-5 block text-sm text-neutral-700 dark:text-neutral-300">
          {{ t('internalChat.retentionDays') }}
          <input
            v-model.number="retentionDays"
            type="number"
            min="0"
            max="3650"
            class="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
          >
        </label>
        <p class="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          {{ t('internalChat.retentionHint') }}
        </p>
        <label class="mt-5 flex items-start gap-2.5 text-sm text-neutral-700 dark:text-neutral-300">
          <input
            v-model="notifyChannelMessages"
            type="checkbox"
            class="mt-0.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          >
          <span>
            <span class="font-medium">{{ t('internalChat.notifyChannelMessages') }}</span>
            <span class="mt-0.5 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
              {{ t('internalChat.notifyChannelMessagesHint') }}
            </span>
          </span>
        </label>
        <label class="mt-5 block text-sm text-neutral-700 dark:text-neutral-300">
          {{ t('internalChat.seenReceiptsMode') }}
          <select
            v-model="seenReceiptsMode"
            class="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
          >
            <option value="off">{{ t('internalChat.seenReceiptsOff') }}</option>
            <option value="private">{{ t('internalChat.seenReceiptsPrivate') }}</option>
            <option value="on">{{ t('internalChat.seenReceiptsOn') }}</option>
          </select>
        </label>
        <p class="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          {{ t('internalChat.seenReceiptsHint') }}
        </p>
        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            @click="showSettingsModal = false"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            :disabled="savingSettings"
            @click="saveSettings"
          >
            {{ t('actions.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowUturnLeftIcon,
  AtSymbolIcon,
  BellSlashIcon,
  ChatBubbleLeftIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  Cog6ToothIcon,
  DocumentIcon,
  EllipsisHorizontalIcon,
  EnvelopeIcon,
  FaceSmileIcon,
  HashtagIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import { MapPinIcon as MapPinSolidIcon } from '@heroicons/vue/24/solid';
import apiClient from '@/utils/apiClient';
import { FLOATING_OVERLAY_Z_CLASS, Z_INDEX_FLOATING_OVERLAY } from '@/constants/zIndexLayers';
import { useAuthStore } from '@/stores/auth';
import Avatar from '@/components/common/Avatar.vue';
import AvatarInitials from '@/components/ui/AvatarInitials.vue';
import HoverTooltip from '@/components/common/HoverTooltip.vue';
import InternalChatMediaLightbox from '@/components/internal-chat/InternalChatMediaLightbox.vue';
import InternalChatSeenZone from '@/components/internal-chat/InternalChatSeenZone.vue';
import InternalChatComposerEditor from '@/components/internal-chat/InternalChatComposerEditor.vue';
import 'emoji-picker-element';
import {
  encodeInternalChatMentionsForSend,
  formatInternalChatMentions,
  internalChatUserDisplayName,
} from '@/utils/internalChatMentions';
import {
  isInternalChatBodyEmpty,
  plainTextFromInternalChatHtml,
  renderInternalChatMessageHtml,
  sanitizeInternalChatHtml,
} from '@/utils/internalChatHtml';
import {
  applyReadUpdated,
  findSeenZoneAnchorId,
} from '@/utils/internalChatSeenZone';
import { extractImageFilesFromClipboard, isImageFile } from '@/modules/contentStudio/editor/imageFileTransfer';
import { createInternalChatStream } from '@/composables/useInternalChatStream';
import { useTabs } from '@/composables/useTabs';
import { isRecordDetailTabPath } from '@/utils/navigationLabels';
import { shouldSkipTabRoute } from '@/utils/standaloneRoutes';
import { openRecordInTab } from '@/utils/tabNavigation';
import {
  createChatChannel,
  createChatDm,
  createChatGroupDm,
  deleteChatMessage,
  editChatMessage,
  exportChatSpace,
  fetchChatMessages,
  fetchChatMembers,
  fetchChatSettings,
  fetchChatSpaces,
  fetchChatTeammates,
  inviteChatMembers,
  removeChatMember,
  joinChatChannel,
  markChatRead,
  markChatSpaceUnread,
  muteChatSpace,
  pinChatMessage,
  publishChatTyping,
  renameChatChannel,
  searchChatMessages,
  sendChatMessage,
  setChatPresence,
  toggleChatReaction,
  updateChatSettings,
  uploadChatAttachment,
} from '@/utils/internalChatApi';
import {
  clearInternalChatFocus,
  setInternalChatFocus,
} from '@/utils/internalChatFocus';
import { alertForInternalChatSseMessage } from '@/utils/internalChatNotificationAlerts';
import { confirmAction } from '@/composables/useConfirmAction';
import { useNotifications } from '@/composables/useNotifications';

const { t } = useI18n();
const authStore = useAuthStore();
const route = useRoute();
const { clearInternalChatMainTabAlert, openTab } = useTabs();
const router = useRouter();
const { success, error: notifyError, info: notifyInfo, warning: notifyWarning } = useNotifications();

const quickEmojis = ['👍', '❤️', '😂', '🎉', '👀'];

const loadingSpaces = ref(true);
const loadingMessages = ref(false);
const messageListReady = ref(true);
const error = ref('');
const spaces = ref([]);
const selectedSpaceId = ref(null);
const messages = ref([]);
const draft = ref('');
const editingMessageId = ref(null);
const quotingMessage = ref(null);
const sending = ref(false);
const streamLive = ref(false);
const threadRootId = ref(null);
const threadRootMessage = ref(null);
const threadMessages = ref([]);
const threadDraft = ref('');
const loadingThread = ref(false);
const sendingThread = ref(false);
const threadListEl = ref(null);
const messageListEl = ref(null);
const fileInputEl = ref(null);
const composerEditorRef = ref(null);
const threadComposerEditorRef = ref(null);
const composerPlainText = ref('');
const mentionButtonRef = ref(null);
const emojiButtonRef = ref(null);
const emojiPickerRef = ref(null);
const showEmojiPicker = ref(false);
const emojiPickerStyle = ref({});
/** 'composer' inserts into draft; 'react' applies reaction to emojiReactMessage */
const emojiPickerMode = ref('composer');
const emojiReactMessage = ref(null);
const emojiAnchorEl = ref(null);
const pendingAttachments = ref([]);
const uploading = ref(false);
const MAX_CHAT_ATTACHMENTS = 5;

const pendingImageAttachments = computed(() => (
  pendingAttachments.value.filter((a) => a.isImage)
));
const pendingFileAttachments = computed(() => (
  pendingAttachments.value.filter((a) => !a.isImage)
));

/** Pending batch is either all images or all documents — never mixed. */
function pendingAttachmentKind() {
  if (!pendingAttachments.value.length) return null;
  return pendingAttachments.value[0].isImage ? 'image' : 'file';
}

const composerFileAccept = computed(() => {
  const kind = pendingAttachmentKind();
  if (kind === 'image') return 'image/*';
  if (kind === 'file') {
    return '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.json,.xml,.md';
  }
  return undefined;
});

const remainingAttachmentSlots = computed(() => (
  Math.max(0, MAX_CHAT_ATTACHMENTS - pendingAttachments.value.length)
));

const canAttachMoreFiles = computed(() => remainingAttachmentSlots.value > 0);

function isAttachmentImage(att) {
  const mime = String(att?.mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  const name = String(att?.fileName || '').toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif|svg)$/i.test(name);
}

function messageImageAttachments(msg) {
  return (msg?.attachments || []).filter((a) => isAttachmentImage(a) && a.url);
}

function messageFileAttachments(msg) {
  return (msg?.attachments || []).filter((a) => !isAttachmentImage(a));
}

const previewAttachment = ref(null);
const previewGalleryItems = ref([]);
const previewGalleryIndex = ref(0);

const showImageAttachmentPreview = computed(() => previewGalleryItems.value.length > 0);

const showFileAttachmentPreview = computed(() => (
  Boolean(previewAttachment.value?.url && !isAttachmentImage(previewAttachment.value))
));

function openImageGallery(msg, startIndex = 0) {
  const images = messageImageAttachments(msg)
    .filter((a) => a?.url)
    .map((a) => ({
      url: a.url,
      fileName: a.fileName || '',
      mimeType: a.mimeType || '',
    }));
  if (!images.length) return;
  previewGalleryIndex.value = Math.min(Math.max(0, startIndex), images.length - 1);
  previewGalleryItems.value = images;
  previewAttachment.value = null;
}

function openAttachmentPreview(att) {
  if (!att?.url) return;
  if (isAttachmentImage(att)) {
    previewGalleryIndex.value = 0;
    previewGalleryItems.value = [{
      url: att.url,
      fileName: att.fileName || '',
      mimeType: att.mimeType || '',
    }];
    previewAttachment.value = null;
    return;
  }
  previewGalleryItems.value = [];
  previewAttachment.value = att;
}

function closeAttachmentPreview() {
  previewAttachment.value = null;
  previewGalleryItems.value = [];
  previewGalleryIndex.value = 0;
}

function isPreviewPdf(att) {
  const mime = String(att?.mimeType || '').toLowerCase();
  if (mime === 'application/pdf' || mime === 'application/x-pdf') return true;
  return /\.pdf$/i.test(String(att?.fileName || ''));
}

function revokePreviewUrl(att) {
  if (att?.previewUrl && String(att.previewUrl).startsWith('blob:')) {
    URL.revokeObjectURL(att.previewUrl);
  }
}

function clearPendingAttachments() {
  pendingAttachments.value.forEach(revokePreviewUrl);
  pendingAttachments.value = [];
}

function removePendingAttachment(localId) {
  const next = [];
  for (const att of pendingAttachments.value) {
    if (String(att.localId) === String(localId)) {
      revokePreviewUrl(att);
    } else {
      next.push(att);
    }
  }
  pendingAttachments.value = next;
}

function toSendAttachments(list) {
  return list
    .filter((a) => a.url || a.storagePath)
    .map((a) => ({
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      url: a.url,
      storagePath: a.storagePath,
    }));
}
const searchQuery = ref('');
const searchResults = ref([]);
const focusedSearchMessageId = ref(null);
let searchDebounceTimer = null;
const typingUsers = ref({});
const presenceViewers = ref([]);
const spaceFilter = ref('');

const showChannelModal = ref(false);
const showDmModal = ref(false);
const showInviteModal = ref(false);
const showMembersModal = ref(false);
const spaceMembers = ref([]);
const spaceMemberIds = ref([]);
const memberMenuUserId = ref(null);
const membersCanInvite = ref(false);
const removingMemberId = ref(null);
const loadingMembers = ref(false);
const showChannelMenu = ref(false);
const suppressAutoMarkReadForSpaceId = ref(null);
const muteDurationMenuId = ref(null);
const muteDurationOptions = [
  { key: '1h', labelKey: 'internalChat.muteFor1Hour' },
  { key: '8h', labelKey: 'internalChat.muteFor8Hours' },
  { key: '24h', labelKey: 'internalChat.muteFor24Hours' },
  { key: 'forever', labelKey: 'internalChat.muteForever' },
];
const sidebarChannelMenuId = ref(null);
const showRenameChannelModal = ref(false);
const renameChannelName = ref('');
const renameChannelTopic = ref('');
const renamingChannel = ref(false);
const renameChannelInputEl = ref(null);
const showSettingsModal = ref(false);
/** On <md viewports: true = conversation pane, false = space list */
const mobileShowConversation = ref(false);
const channelName = ref('');
const channelTopic = ref('');
const channelPrivate = ref(false);
const channelInviteIds = ref([]);
const channelInviteFilter = ref('');
const inviteMemberIds = ref([]);
const inviteFilter = ref('');
const inviting = ref(false);
const joining = ref(false);
const creating = ref(false);
const dmUserId = ref(null);
const groupDmIds = ref([]);
const dmMode = ref('dm');
const dmPickerFilter = ref('');
const orgUsers = ref([]);
const retentionDays = ref(0);
const notifyChannelMessages = ref(false);
const seenReceiptsMode = ref('private');
const savingSettings = ref(false);
const readStateMode = ref('private');
const readStateMembers = ref([]);
const seenZoneAnchorId = computed(() => (
  findSeenZoneAnchorId(messages.value, authStore.user?._id)
));

const mentionSuggestions = ref([]);
const mentionQuery = ref('');
const mentionMenuActive = ref(false);
const addingMentionUserId = ref('');

const showMentionAllOption = computed(() => {
  if (!mentionMenuActive.value) return false;
  const q = String(mentionQuery.value || '').toLowerCase();
  return q === '' || 'all'.startsWith(q);
});
const pinnedIds = ref([]);
const pinnedMessages = ref([]);
const pinnedStripExpanded = ref(false);
const pinFlashMessageId = ref(null);
let pinFlashTimer = null;

const visiblePinnedMessages = computed(() => {
  if (pinnedStripExpanded.value || pinnedMessages.value.length <= 1) {
    return pinnedMessages.value;
  }
  return pinnedMessages.value.slice(0, 1);
});

function flashPinnedMessage(messageId) {
  const mid = String(messageId || '');
  if (!mid) return;
  if (pinFlashTimer) {
    clearTimeout(pinFlashTimer);
    pinFlashTimer = null;
  }
  pinFlashMessageId.value = mid;
  pinFlashTimer = window.setTimeout(() => {
    if (String(pinFlashMessageId.value) === mid) pinFlashMessageId.value = null;
    pinFlashTimer = null;
  }, 1600);
}

const selectedSpace = computed(() =>
  spaces.value.find((s) => String(s._id) === String(selectedSpaceId.value || '')) || null
);

const filteredSpaces = computed(() => {
  const q = spaceFilter.value.trim().toLowerCase();
  if (!q) return spaces.value;
  return spaces.value.filter((s) => spaceDisplayName(s).toLowerCase().includes(q));
});

const directSpaces = computed(() =>
  filteredSpaces.value.filter((s) => s.type === 'dm' || s.type === 'group_dm')
);

const channelSpaces = computed(() =>
  filteredSpaces.value.filter((s) => s.type === 'channel')
);

const canManageSpaceMembers = computed(() => {
  const type = selectedSpace.value?.type;
  return type === 'channel' || type === 'group_dm';
});

function isSpaceMuted(space) {
  return space?.membership?.muted === true;
}

function applySpaceMembershipPatch(spaceId, patch) {
  const space = spaces.value.find((s) => String(s._id) === String(spaceId));
  if (!space) return;
  space.membership = { ...(space.membership || {}), ...patch };
}

function closeSpaceMenus() {
  showChannelMenu.value = false;
  sidebarChannelMenuId.value = null;
  muteDurationMenuId.value = null;
}

function openMuteDurationPicker(menuId, event) {
  event?.stopPropagation?.();
  muteDurationMenuId.value = String(menuId);
}

function isMuteDurationOpen(menuId) {
  return muteDurationMenuId.value === String(menuId);
}

async function muteSpaceNotifications(space, durationKey = 'forever') {
  if (!space?._id) return;
  const sid = String(space._id);
  closeSpaceMenus();
  try {
    const result = await muteChatSpace(sid, { muted: true, durationKey });
    applySpaceMembershipPatch(sid, {
      muted: true,
      mutedUntil: result?.mutedUntil || null,
    });
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.muteFailed');
  }
}

async function unmuteSpaceNotifications(space) {
  if (!space?._id) return;
  const sid = String(space._id);
  closeSpaceMenus();
  try {
    await muteChatSpace(sid, { muted: false });
    applySpaceMembershipPatch(sid, { muted: false, mutedUntil: null });
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.muteFailed');
  }
}

async function markMessageAsUnread(msg) {
  if (!selectedSpaceId.value || !msg?._id || String(msg._id).startsWith('temp_')) return;
  if (msg.deletedAt || isSystemMessage(msg)) return;
  const sid = String(selectedSpaceId.value);
  try {
    await markChatSpaceUnread(sid, { messageId: msg._id });
    const row = spaces.value.find((s) => String(s._id) === sid);
    if (row) {
      row.unreadCount = Math.max(1, Number(row.unreadCount) || 0);
      applySpaceMembershipPatch(sid, { forceUnread: true });
    }
    suppressAutoMarkReadForSpaceId.value = sid;
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.markUnreadFailed');
  }
}

function safeMarkChatRead(spaceId, messageId) {
  if (
    suppressAutoMarkReadForSpaceId.value
    && String(suppressAutoMarkReadForSpaceId.value) === String(spaceId)
  ) {
    return Promise.resolve();
  }
  if (messageId) return markChatRead(spaceId, messageId);
  return markChatRead(spaceId);
}

function isNonMemberMentionCandidate(user) {
  if (!user?._id || !canManageSpaceMembers.value || !membersCanInvite.value) return false;
  const id = String(user._id);
  return !spaceMemberIds.value.map(String).includes(id);
}

const composerNonMemberMentions = computed(() => {
  if (!canManageSpaceMembers.value || !membersCanInvite.value) return [];
  if (isInternalChatBodyEmpty(draft.value) && !composerPlainText.value.includes('@')) return [];
  const { mentionUserIds } = prepareOutgoingBody(draft.value);
  if (!mentionUserIds.length) return [];
  const memberSet = new Set(spaceMemberIds.value.map(String));
  const byId = new Map(orgUsers.value.map((u) => [String(u._id), u]));
  return mentionUserIds
    .map((id) => byId.get(String(id)))
    .filter((u) => u && !memberSet.has(String(u._id)));
});

const recordSpaces = computed(() =>
  filteredSpaces.value.filter((s) => s.type === 'record')
);

const composerPlaceholder = computed(() => {
  if (selectedSpace.value) {
    return t('internalChat.composerPlaceholderNamed', { name: spaceDisplayName(selectedSpace.value) });
  }
  return t('internalChat.composerPlaceholder');
});

const dmCandidates = computed(() => {
  const me = String(authStore.user?._id || '');
  return orgUsers.value.filter((u) => (
    String(u._id) !== me
    && String(u.userType || 'INTERNAL').toUpperCase() !== 'EXTERNAL'
  ));
});

const filteredDmCandidates = computed(() => {
  const q = dmPickerFilter.value.trim().toLowerCase();
  if (!q) return dmCandidates.value;
  return dmCandidates.value.filter((u) => {
    const label = userLabel(u).toLowerCase();
    const email = String(u.email || '').toLowerCase();
    return label.includes(q) || email.includes(q);
  });
});

const filteredChannelInviteCandidates = computed(() => {
  const q = channelInviteFilter.value.trim().toLowerCase();
  if (!q) return dmCandidates.value;
  return dmCandidates.value.filter((u) => {
    const label = userLabel(u).toLowerCase();
    const email = String(u.email || '').toLowerCase();
    return label.includes(q) || email.includes(q);
  });
});

const filteredInviteCandidates = computed(() => {
  const memberSet = new Set(spaceMemberIds.value.map(String));
  const base = dmCandidates.value.filter((u) => !memberSet.has(String(u._id)));
  const q = inviteFilter.value.trim().toLowerCase();
  if (!q) return base;
  return base.filter((u) => {
    const label = userLabel(u).toLowerCase();
    const email = String(u.email || '').toLowerCase();
    return label.includes(q) || email.includes(q);
  });
});

function isDmCandidateSelected(u) {
  const id = String(u._id);
  if (dmMode.value === 'dm') return String(dmUserId.value) === id;
  return groupDmIds.value.includes(id);
}

function closeDmModal() {
  showDmModal.value = false;
  dmPickerFilter.value = '';
  dmUserId.value = null;
  groupDmIds.value = [];
  dmMode.value = 'dm';
}

function closeChannelModal() {
  showChannelModal.value = false;
  channelName.value = '';
  channelTopic.value = '';
  channelPrivate.value = false;
  channelInviteIds.value = [];
  channelInviteFilter.value = '';
}

function toggleChannelInvite(id) {
  const sid = String(id);
  if (channelInviteIds.value.includes(sid)) {
    channelInviteIds.value = channelInviteIds.value.filter((x) => x !== sid);
  } else {
    channelInviteIds.value = [...channelInviteIds.value, sid];
  }
}

async function refreshSpaceMemberIds(spaceId = selectedSpaceId.value) {
  const sid = String(spaceId || '');
  if (!sid) {
    spaceMemberIds.value = [];
    return [];
  }
  try {
    const result = await fetchChatMembers(sid);
    const ids = (result.members || []).map((m) => String(m.userId));
    spaceMemberIds.value = ids;
    membersCanInvite.value = result.canInvite === true;
    return result.members || [];
  } catch {
    spaceMemberIds.value = [];
    return [];
  }
}

function openInviteModal() {
  showChannelMenu.value = false;
  sidebarChannelMenuId.value = null;
  inviteMemberIds.value = [];
  inviteFilter.value = '';
  showInviteModal.value = true;
  loadOrgUsers();
  refreshSpaceMemberIds();
}

function openInviteFromChannelMenu() {
  showChannelMenu.value = false;
  sidebarChannelMenuId.value = null;
  openInviteModal();
}

function openInviteFromSidebar(space) {
  sidebarChannelMenuId.value = null;
  showChannelMenu.value = false;
  if (space?._id) selectSpace(space._id);
  openInviteModal();
}

function openMembersFromChannelMenu() {
  showChannelMenu.value = false;
  sidebarChannelMenuId.value = null;
  openMembersModal();
}

function openMembersFromSidebar(space) {
  sidebarChannelMenuId.value = null;
  showChannelMenu.value = false;
  if (space?._id) selectSpace(space._id);
  openMembersModal(space?._id);
}

async function openMembersModal(spaceId = selectedSpaceId.value) {
  const sid = String(spaceId || selectedSpaceId.value || '');
  if (!sid) return;
  showMembersModal.value = true;
  loadingMembers.value = true;
  spaceMembers.value = [];
  try {
    const result = await fetchChatMembers(sid);
    spaceMembers.value = result.members || [];
    spaceMemberIds.value = spaceMembers.value.map((m) => String(m.userId));
    membersCanInvite.value = result.canInvite === true;
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.membersLoadFailed');
    showMembersModal.value = false;
  } finally {
    loadingMembers.value = false;
  }
}

async function removeSpaceMember(member) {
  const sid = String(selectedSpaceId.value || '');
  const uid = String(member?.userId || '');
  if (!sid || !uid || removingMemberId.value) return;
  const isSelf = uid === String(authStore.user?._id || '');
  memberMenuUserId.value = null;
  removingMemberId.value = uid;
  error.value = '';
  try {
    await removeChatMember(sid, uid);
    if (isSelf) {
      closeMembersModal();
      spaces.value = spaces.value.filter((s) => String(s._id) !== sid);
      if (String(selectedSpaceId.value || '') === sid) {
        selectedSpaceId.value = spaces.value[0]?._id || null;
      }
      return;
    }
    await openMembersModal(sid);
    await loadSpaces();
  } catch (err) {
    error.value = err?.response?.data?.message
      || (isSelf ? t('internalChat.leaveFailed') : t('internalChat.removeMemberFailed'));
  } finally {
    removingMemberId.value = null;
  }
}

function toggleMemberMenu(member) {
  const uid = String(member?.userId || '');
  if (!uid) return;
  memberMenuUserId.value = memberMenuUserId.value === uid ? null : uid;
}

function onMemberMenuRemove(member) {
  memberMenuUserId.value = null;
  removeSpaceMember(member);
}

function closeMembersModal() {
  showMembersModal.value = false;
  loadingMembers.value = false;
  removingMemberId.value = null;
  memberMenuUserId.value = null;
}

function openInviteFromMembersModal() {
  closeMembersModal();
  openInviteModal();
}

function toggleSidebarChannelMenu(space) {
  const sid = String(space?._id || '');
  showChannelMenu.value = false;
  muteDurationMenuId.value = null;
  sidebarChannelMenuId.value = sidebarChannelMenuId.value === sid ? null : sid;
}

function openRenameChannelModal(space = null) {
  showChannelMenu.value = false;
  sidebarChannelMenuId.value = null;
  const target = space && space._id ? space : selectedSpace.value;
  if (!target || target.type !== 'channel') return;
  if (space?._id && String(selectedSpaceId.value || '') !== String(space._id)) {
    selectSpace(space._id);
  }
  renameChannelName.value = String(target.name || '');
  renameChannelTopic.value = String(target.topic || '');
  showRenameChannelModal.value = true;
  nextTick(() => {
    renameChannelInputEl.value?.focus();
    renameChannelInputEl.value?.select();
  });
}

function closeRenameChannelModal() {
  showRenameChannelModal.value = false;
  renamingChannel.value = false;
}

function applySpaceNamePatch(spaceId, patch) {
  const sid = String(spaceId || '');
  if (!sid) return;
  spaces.value = spaces.value.map((s) => (
    String(s._id) === sid ? { ...s, ...patch } : s
  ));
}

async function submitRenameChannel() {
  const name = renameChannelName.value.trim();
  if (!name || !selectedSpaceId.value || renamingChannel.value) return;
  renamingChannel.value = true;
  try {
    const space = await renameChatChannel(selectedSpaceId.value, {
      name,
      topic: renameChannelTopic.value,
    });
    if (space) {
      applySpaceNamePatch(selectedSpaceId.value, {
        name: space.name,
        topic: space.topic,
      });
    }
    closeRenameChannelModal();
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.renameChannelFailed');
  } finally {
    renamingChannel.value = false;
  }
}

function closeChannelMenuOnOutsideClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (showChannelMenu.value || sidebarChannelMenuId.value) {
    if (!target.closest('[data-channel-menu]')) {
      showChannelMenu.value = false;
      sidebarChannelMenuId.value = null;
      muteDurationMenuId.value = null;
    }
  }
  if (memberMenuUserId.value && !target.closest('[data-member-menu]')) {
    memberMenuUserId.value = null;
  }
}

function closeInviteModal() {
  showInviteModal.value = false;
  inviteMemberIds.value = [];
  inviteFilter.value = '';
}

function toggleInviteMember(id) {
  const sid = String(id);
  if (inviteMemberIds.value.includes(sid)) {
    inviteMemberIds.value = inviteMemberIds.value.filter((x) => x !== sid);
  } else {
    inviteMemberIds.value = [...inviteMemberIds.value, sid];
  }
}

const typingLabel = computed(() => {
  const me = String(authStore.user?._id || '');
  const active = Object.values(typingUsers.value).filter(
    (row) => row && row.userId !== me && Date.now() - row.at < 4000
  );
  if (!active.length) return '';
  if (active.length === 1) return t('internalChat.typingOne', { name: active[0].name });
  return t('internalChat.typingMany');
});

const presenceLabel = computed(() => {
  const me = String(authStore.user?._id || '');
  const others = presenceViewers.value.filter((v) => String(v.userId) !== me);
  if (!others.length) return '';
  if (others.length === 1) return t('internalChat.presenceOne', { name: others[0].name });
  return t('internalChat.presenceMany', { count: others.length });
});

function isSpaceSelected(space) {
  return String(selectedSpaceId.value) === String(space._id);
}

function truncate(text, n) {
  const s = String(text || '');
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

const conversationMatchIds = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (q.length < 2) return new Set();
  return new Set(
    messages.value
      .filter((m) => {
        const plain = plainTextFromInternalChatHtml(
          formatInternalChatMentions(m.body || '', mentionDirectory.value)
        ).toLowerCase();
        return plain.includes(q) || String(m.body || '').toLowerCase().includes(q);
      })
      .map((m) => String(m._id))
  );
});

const mentionDirectory = computed(() => {
  const byId = new Map();
  for (const u of orgUsers.value) {
    if (u?._id) byId.set(String(u._id), u);
  }
  for (const msg of messages.value) {
    const author = msg?.author;
    if (author?._id && !byId.has(String(author._id))) {
      byId.set(String(author._id), author);
    }
  }
  return [...byId.values()];
});

/** Labels for live @mention chips in the TipTap composer. */
const composerMentionLabels = computed(() => (
  mentionDirectory.value
    .map((u) => internalChatUserDisplayName(u))
    .filter(Boolean)
));

function formatMentionText(text) {
  return formatInternalChatMentions(text, mentionDirectory.value);
}

function messageBodyHtml(msg) {
  return renderInternalChatMessageHtml(msg?.body, mentionDirectory.value);
}

/** Same-origin app path from an anchor href, or null for external / non-navigable links. */
function resolveSameOriginAppPath(href) {
  const raw = String(href || '').trim();
  if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) {
    return null;
  }
  try {
    const url = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    if (typeof window !== 'undefined' && url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Prefer human labels; never use a raw URL/path as the tab title (record pages fill the name). */
function tabTitleFromAnchor(anchor, path) {
  const text = String(anchor?.textContent || '').trim();
  if (!text) return undefined;
  if (/^https?:\/\//i.test(text)) return undefined;
  const href = String(anchor?.getAttribute?.('href') || '').trim();
  if (text === href || (path && (text === path || text.endsWith(path)))) return undefined;
  try {
    const asUrl = new URL(text, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    if (`${asUrl.pathname}${asUrl.search}${asUrl.hash}` === path) return undefined;
  } catch {
    /* plain label */
  }
  return text;
}

/** Open in-app record (and other SPA) links in the tab bar instead of target=_blank bounce. */
function onMessageBodyClick(event) {
  if (event.defaultPrevented) return;
  if (typeof event.button === 'number' && event.button !== 0) return;
  const anchor = event.target?.closest?.('a[href]');
  if (!anchor || !event.currentTarget?.contains?.(anchor)) return;

  const path = resolveSameOriginAppPath(anchor.getAttribute('href'));
  if (!path || shouldSkipTabRoute(path)) return;

  event.preventDefault();
  event.stopPropagation();

  const title = tabTitleFromAnchor(anchor, path);
  const openInBackground = Boolean(event.metaKey || event.ctrlKey || event.shiftKey);
  const options = { background: openInBackground, insertAdjacent: true };
  if (title) options.title = title;

  if (isRecordDetailTabPath(path)) {
    openRecordInTab(path, options);
  } else {
    openTab(path, options);
  }
}

function prepareOutgoingBody(html) {
  const sanitized = sanitizeInternalChatHtml(html || '');
  return encodeInternalChatMentionsForSend(sanitized, orgUsers.value);
}

const isDarkTheme = computed(() => (
  typeof document !== 'undefined'
  && document.documentElement.classList.contains('dark')
));

function onComposerPlainText(text) {
  composerPlainText.value = String(text || '');
}

function insertTextAtCursor(text) {
  composerEditorRef.value?.insertText(text);
  nextTick(() => updateMentionSuggestions());
}

function insertAtSign() {
  if (!orgUsers.value.length) loadOrgUsers();
  insertTextAtCursor('@');
  closeEmojiPicker();
}

function updateEmojiPickerPosition() {
  if (!showEmojiPicker.value) return;
  const anchor = emojiAnchorEl.value || emojiButtonRef.value;
  if (!anchor) return;
  const rect = anchor.getBoundingClientRect();
  const pickerWidth = emojiPickerRef.value?.offsetWidth || 320;
  const pickerHeight = emojiPickerRef.value?.offsetHeight || 288;
  const gap = 8;
  const spaceAbove = rect.top;
  const spaceBelow = window.innerHeight - rect.bottom;
  let top = spaceAbove >= pickerHeight + gap || spaceAbove >= spaceBelow
    ? rect.top - pickerHeight - gap
    : rect.bottom + gap;
  let left = rect.left;
  top = Math.max(8, Math.min(top, window.innerHeight - pickerHeight - 8));
  left = Math.max(8, Math.min(left, window.innerWidth - pickerWidth - 8));
  emojiPickerStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
  };
}

function closeEmojiPicker() {
  showEmojiPicker.value = false;
  emojiPickerMode.value = 'composer';
  emojiReactMessage.value = null;
  emojiAnchorEl.value = null;
}

function toggleEmojiPicker() {
  if (showEmojiPicker.value && emojiPickerMode.value === 'composer') {
    closeEmojiPicker();
    return;
  }
  emojiPickerMode.value = 'composer';
  emojiReactMessage.value = null;
  emojiAnchorEl.value = emojiButtonRef.value;
  showEmojiPicker.value = true;
  nextTick(() => {
    updateEmojiPickerPosition();
    requestAnimationFrame(() => updateEmojiPickerPosition());
  });
}

function openMessageReactionPicker(msg, event) {
  if (!msg?._id) return;
  const anchor = event?.currentTarget || null;
  if (
    showEmojiPicker.value
    && emojiPickerMode.value === 'react'
    && String(emojiReactMessage.value?._id || '') === String(msg._id)
  ) {
    closeEmojiPicker();
    return;
  }
  emojiPickerMode.value = 'react';
  emojiReactMessage.value = msg;
  emojiAnchorEl.value = anchor;
  showEmojiPicker.value = true;
  nextTick(() => {
    updateEmojiPickerPosition();
    requestAnimationFrame(() => updateEmojiPickerPosition());
  });
}

function handleEmojiPickerSelect(event) {
  const emoji = event?.detail?.unicode || event?.detail?.emoji?.unicode || '';
  if (!emoji) return;
  if (emojiPickerMode.value === 'react' && emojiReactMessage.value) {
    const msg = emojiReactMessage.value;
    closeEmojiPicker();
    react(msg, emoji);
    return;
  }
  insertTextAtCursor(emoji);
  closeEmojiPicker();
}

function closeEmojiPickerOnOutsideClick(event) {
  if (!showEmojiPicker.value) return;
  const target = event.target;
  if (emojiPickerRef.value?.contains(target)) return;
  if (emojiButtonRef.value?.contains(target)) return;
  if (emojiAnchorEl.value?.contains?.(target)) return;
  closeEmojiPicker();
}

function isSearchMatch(msg) {
  return conversationMatchIds.value.has(String(msg._id));
}

async function scrollToSearchMatch(messageId) {
  if (!messageId) return;
  await nextTick();
  const mid = CSS.escape(String(messageId));
  const fromThread = threadListEl.value?.querySelector(`[data-message-id="${mid}"]`);
  const fromMain = messageListEl.value?.querySelector(`[data-message-id="${mid}"]`);
  const el = fromThread || fromMain;
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Deep-link from mention/message notification: ?spaceId=&messageId=
 */
async function focusMessageFromRouteQuery() {
  const spaceId = route.query.spaceId ? String(route.query.spaceId) : '';
  const messageId = route.query.messageId ? String(route.query.messageId) : '';
  if (!messageId || !spaceId) return;

  mobileShowConversation.value = true;

  if (String(selectedSpaceId.value || '') !== spaceId) {
    closeThread();
    cancelEditMessage();
    cancelQuoteReply();
    selectedSpaceId.value = spaceId;
    typingUsers.value = {};
  }

  // After any space-watch loadMessages has started — invalidate it, then load around the target.
  const seq = ++messagesLoadSeq;
  loadingMessages.value = true;
  messageListReady.value = false;
  try {
    const result = await fetchChatMessages(spaceId, {
      aroundMessageId: messageId,
      limit: 50,
    });
    if (seq !== messagesLoadSeq) return;

    messages.value = result.messages || [];
    readStateMode.value = result.readState?.mode || 'private';
    readStateMembers.value = Array.isArray(result.readState?.members)
      ? result.readState.members
      : [];
    pinnedIds.value = (result.space?.pinnedMessageIds || []).map(String);
    pinnedMessages.value = Array.isArray(result.pinnedMessages) ? result.pinnedMessages : [];

    const threadRoot = result.focus?.threadRootId
      ? String(result.focus.threadRootId)
      : null;

    focusedSearchMessageId.value = messageId;
    messageListReady.value = true;

    if (threadRoot) {
      const rootMsg = messages.value.find((m) => String(m._id) === threadRoot);
      if (rootMsg) {
        openThread(rootMsg);
        await nextTick();
        await loadThreadMessages();
      }
    }

    if (seq !== messagesLoadSeq) return;
    await scrollToSearchMatch(messageId);
    window.setTimeout(() => {
      if (String(focusedSearchMessageId.value) === messageId) {
        focusedSearchMessageId.value = null;
      }
    }, 4500);

    const nextQuery = { ...route.query, spaceId };
    delete nextQuery.messageId;
    router.replace({ query: nextQuery }).catch(() => {});

    await safeMarkChatRead(spaceId, messageId);
  } catch (err) {
    if (seq !== messagesLoadSeq) return;
    error.value = err?.response?.data?.message || t('internalChat.loadFailed');
    messageListReady.value = true;
  } finally {
    if (seq === messagesLoadSeq) loadingMessages.value = false;
  }
}

function onSearchInput() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  const q = searchQuery.value.trim();
  if (q.length < 2) {
    searchResults.value = [];
    focusedSearchMessageId.value = null;
    return;
  }
  searchDebounceTimer = setTimeout(() => {
    runSearch();
  }, 250);
}

function spaceDisplayName(space) {
  if (!space) return '';
  if (space.displayName) return space.displayName;
  if (space.name) return space.name;
  if (space.type === 'dm') return t('internalChat.dmFallback');
  if (space.type === 'group_dm') return t('internalChat.groupDmFallback');
  if (space.type === 'record' && space.moduleKey) {
    return space.name || `${space.moduleKey}`;
  }
  return space.type || '';
}

function personAvatarProps(person) {
  if (!person) {
    return { firstName: '', lastName: '', email: '', username: '', avatar: '' };
  }
  let firstName = String(person.firstName || person.first_name || '').trim();
  let lastName = String(person.lastName || person.last_name || '').trim();
  if (!firstName && !lastName && person.name) {
    const parts = String(person.name).trim().split(/\s+/).filter(Boolean);
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ');
  }
  return {
    firstName,
    lastName,
    email: person.email || '',
    username: person.username || '',
    avatar: person.avatar || '',
  };
}

function authorAvatarProps(msg) {
  const base = personAvatarProps(msg?.author || { firstName: authorLabel(msg) });
  const authorId = String(msg?.authorId || msg?.author?._id || '');
  const me = String(authStore.user?._id || '');
  if (!base.avatar && authorId && me && authorId === me) {
    return {
      ...base,
      firstName: base.firstName || authStore.user?.firstName || '',
      lastName: base.lastName || authStore.user?.lastName || '',
      email: base.email || authStore.user?.email || '',
      username: base.username || authStore.user?.username || '',
      avatar: authStore.user?.avatar || '',
    };
  }
  return base;
}

function spaceAvatarProps(space) {
  if (!space) return personAvatarProps(null);
  const peer = space.peer || (Array.isArray(space.peerUsers) ? space.peerUsers[0] : null);
  if (peer) return personAvatarProps(peer);
  const label = spaceDisplayName(space);
  const parts = String(label || '').trim().split(/\s+/).filter(Boolean);
  return personAvatarProps({
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  });
}

/** Up to two peer users for stacked group-DM avatars (excludes current user). */
function spaceGroupAvatarPeers(space) {
  if (!space || space.type !== 'group_dm') return [];
  const peers = Array.isArray(space.peerUsers) ? space.peerUsers : [];
  if (peers.length >= 2) return peers.slice(0, 2);
  if (peers.length === 1 && space.peer) return [peers[0]];
  return peers.slice(0, 2);
}

function presenceAvatarUser(viewer) {
  if (!viewer) return null;
  return {
    _id: viewer.userId,
    firstName: viewer.firstName,
    lastName: viewer.lastName,
    email: viewer.email,
    avatar: viewer.avatar,
  };
}

function authorLabel(msg) {
  const a = msg.author;
  if (!a) return t('internalChat.unknownAuthor');
  const name = [a.firstName, a.lastName].filter(Boolean).join(' ').trim();
  return name || a.email || t('internalChat.unknownAuthor');
}

function isOwnMessage(msg) {
  const me = String(authStore.user?._id || '');
  if (!me) return false;
  return String(msg?.authorId || msg?.author?._id || '') === me;
}

function isSystemMessage(msg) {
  return msg?.kind === 'system' || Boolean(msg?.systemEvent?.type);
}

function systemMessageText(msg) {
  const ev = msg?.systemEvent || {};
  const actor = ev.actorName || authorLabel(msg) || t('internalChat.someone');
  const target = ev.targetName || t('internalChat.someone');
  switch (ev.type) {
    case 'group_created':
      return t('internalChat.systemGroupCreated', { name: actor });
    case 'channel_created':
      return t('internalChat.systemChannelCreated', { name: actor });
    case 'member_added':
      return t('internalChat.systemMemberAdded', { actor, target });
    case 'member_removed':
      return t('internalChat.systemMemberRemoved', { actor, target });
    case 'member_left':
      return t('internalChat.systemMemberLeft', { name: actor });
    case 'chat_pinned':
      return t('internalChat.systemChatPinned', { name: actor });
    default:
      return msg?.body || '';
  }
}

function userLabel(u) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email || String(u._id || u.userId || '');
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (msgDay.getTime() === todayStart.getTime()) return timeStr;
    if (msgDay.getTime() === yesterdayStart.getTime()) {
      return `${t('internalChat.yesterday')} ${timeStr}`;
    }
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${dateStr} ${timeStr}`;
  } catch {
    return '';
  }
}

/** Instant pin — no visible scroll. For channel open, keep list invisible until pinned. */
function pinListToBottom(el) {
  if (!el) return;
  // Direct assignment can lose to layout; force max scroll.
  el.scrollTop = el.scrollHeight;
  // Some engines need a second write after scrollHeight settles.
  el.scrollTop = el.scrollHeight;
}

function scrollLastMessageIntoView(root) {
  if (!root) return;
  const nodes = root.querySelectorAll('[data-message-id]');
  const last = nodes.length ? nodes[nodes.length - 1] : null;
  if (last && typeof last.scrollIntoView === 'function') {
    last.scrollIntoView({ block: 'end', inline: 'nearest' });
  }
}

async function waitForMessageListEl(maxFrames = 45) {
  for (let i = 0; i < maxFrames; i += 1) {
    if (messageListEl.value) return messageListEl.value;
    await nextTick();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return messageListEl.value;
}

function waitForListImages(root, timeoutMs = 600) {
  if (!root || typeof root.querySelectorAll !== 'function') return Promise.resolve();
  const imgs = [...root.querySelectorAll('img')].filter((img) => !img.complete);
  if (!imgs.length) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    };
    let left = imgs.length;
    const done = () => {
      left -= 1;
      if (left <= 0) finish();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    imgs.forEach((img) => {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  });
}

async function scrollToBottom({ reveal = false, loadSeq = null } = {}) {
  // On refresh, loadMessages can finish while the spaces skeleton is still up —
  // messageListEl is not mounted yet. Wait for the conversation pane.
  const el = await waitForMessageListEl();
  if (!el) {
    if (reveal && (loadSeq == null || loadSeq === messagesLoadSeq)) {
      messageListReady.value = true;
    }
    return;
  }
  if (loadSeq != null && loadSeq !== messagesLoadSeq) return;

  pinListToBottom(el);
  await nextTick();
  if (loadSeq != null && loadSeq !== messagesLoadSeq) return;
  pinListToBottom(messageListEl.value);
  scrollLastMessageIntoView(messageListEl.value);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  pinListToBottom(messageListEl.value);
  scrollLastMessageIntoView(messageListEl.value);

  // Attachments/images grow the list after first paint — re-pin before reveal.
  await waitForListImages(messageListEl.value);
  if (loadSeq != null && loadSeq !== messagesLoadSeq) return;
  pinListToBottom(messageListEl.value);
  scrollLastMessageIntoView(messageListEl.value);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  pinListToBottom(messageListEl.value);

  if (reveal && (loadSeq == null || loadSeq === messagesLoadSeq)) {
    messageListReady.value = true;
    // One more pin after becoming visible (layout can change with visibility).
    await nextTick();
    pinListToBottom(messageListEl.value);
    scrollLastMessageIntoView(messageListEl.value);
  }
}

let messagesLoadSeq = 0;

async function loadSpaces() {
  const showLoader = spaces.value.length === 0;
  if (showLoader) loadingSpaces.value = true;
  error.value = '';
  try {
    spaces.value = await fetchChatSpaces();
    const current = selectedSpaceId.value ? String(selectedSpaceId.value) : null;
    const currentValid = current && spaces.value.some((s) => String(s._id) === current);
    // Keep in-memory selection — do not clobber with stale route.query during router.replace race
    if (currentValid) {
      selectedSpaceId.value = current;
    } else {
      const qSpace = route.query.spaceId ? String(route.query.spaceId) : null;
      if (qSpace && spaces.value.some((s) => String(s._id) === qSpace)) {
        selectedSpaceId.value = qSpace;
      } else if (spaces.value.length) {
        selectedSpaceId.value = String(spaces.value[0]._id);
      } else {
        selectedSpaceId.value = null;
      }
    }
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.loadFailed');
    spaces.value = [];
  } finally {
    if (showLoader) loadingSpaces.value = false;
  }
}

async function loadMessages() {
  const seq = ++messagesLoadSeq;
  if (!selectedSpaceId.value) {
    messages.value = [];
    readStateMembers.value = [];
    readStateMode.value = 'private';
    pinnedIds.value = [];
    pinnedMessages.value = [];
    pinnedStripExpanded.value = false;
    messageListReady.value = true;
    return;
  }
  messageListReady.value = false;
  loadingMessages.value = true;
  // Drop previous channel content so we never flash its top while loading.
  messages.value = [];
  try {
    const result = await fetchChatMessages(selectedSpaceId.value);
    if (seq !== messagesLoadSeq) return;
    messages.value = result.messages;
    readStateMode.value = result.readState?.mode || 'private';
    readStateMembers.value = Array.isArray(result.readState?.members)
      ? result.readState.members
      : [];
    pinnedIds.value = (result.space?.pinnedMessageIds || []).map(String);
    pinnedMessages.value = Array.isArray(result.pinnedMessages) ? result.pinnedMessages : [];
    pinnedStripExpanded.value = false;
    if (threadRootId.value) {
      const root = messages.value.find((m) => String(m._id) === String(threadRootId.value));
      if (root) threadRootMessage.value = root;
    }
    const space = spaces.value.find((s) => String(s._id) === String(selectedSpaceId.value));
    if (space) {
      const suppressed = suppressAutoMarkReadForSpaceId.value
        && String(suppressAutoMarkReadForSpaceId.value) === String(space._id);
      if (!suppressed) {
        space.unreadCount = 0;
        if (space.membership) space.membership.forceUnread = false;
      }
      space.pinnedMessageIds = result.space?.pinnedMessageIds || [];
    }
    const spaceType = space?.type || result.space?.type;
    if (spaceType === 'channel' || spaceType === 'group_dm') {
      refreshSpaceMemberIds(selectedSpaceId.value).catch(() => {});
    } else {
      spaceMemberIds.value = [];
      membersCanInvite.value = false;
    }
  } catch (err) {
    if (seq !== messagesLoadSeq) return;
    error.value = err?.response?.data?.message || t('internalChat.loadFailed');
    messageListReady.value = true;
  } finally {
    if (seq === messagesLoadSeq) loadingMessages.value = false;
  }
  if (seq !== messagesLoadSeq) return;
  // Pin while invisible, then reveal already at bottom.
  await scrollToBottom({ reveal: true, loadSeq: seq });
  if (seq === messagesLoadSeq && selectedSpaceId.value) {
    safeMarkChatRead(selectedSpaceId.value).catch(() => {});
  }
}

async function loadThreadMessages() {
  if (!selectedSpaceId.value || !threadRootId.value) {
    threadMessages.value = [];
    return;
  }
  loadingThread.value = true;
  try {
    const result = await fetchChatMessages(selectedSpaceId.value, {
      threadRootId: threadRootId.value,
    });
    threadMessages.value = result.messages || [];
    await nextTick();
    scrollThreadToBottom();
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.loadFailed');
    threadMessages.value = [];
  } finally {
    loadingThread.value = false;
  }
}

/**
 * Notification-stream catch-up: append messages missing from the open timeline
 * without wiping the list (covers toast-before-chat-SSE lag).
 */
let mergeCatchUpTimer = null;
let mergeCatchUpSpaceId = null;

function mergeLatestMessagesForSpace(spaceId) {
  if (!spaceId || String(spaceId) !== String(selectedSpaceId.value || '')) return;
  mergeCatchUpSpaceId = String(spaceId);
  if (mergeCatchUpTimer) clearTimeout(mergeCatchUpTimer);
  mergeCatchUpTimer = setTimeout(async () => {
    mergeCatchUpTimer = null;
    const sid = mergeCatchUpSpaceId;
    mergeCatchUpSpaceId = null;
    if (!sid || String(sid) !== String(selectedSpaceId.value || '')) return;
    try {
      const result = await fetchChatMessages(sid, { limit: 50 });
      const existing = new Set(messages.value.map((m) => String(m._id)));
      const incoming = Array.isArray(result.messages) ? result.messages : [];
      const toAdd = incoming.filter((m) => !existing.has(String(m._id)));
      if (!toAdd.length) return;
      messages.value = [...messages.value, ...toAdd];
      if (result.readState) {
        readStateMode.value = result.readState.mode || readStateMode.value;
        readStateMembers.value = Array.isArray(result.readState.members)
          ? result.readState.members
          : readStateMembers.value;
      }
      scrollToBottom();
      const last = toAdd[toAdd.length - 1];
      if (last?._id) safeMarkChatRead(sid, last._id);
    } catch {
      /* best-effort */
    }
  }, 80);
}

function onInternalChatWorkspaceEvent(ev) {
  const detail = ev?.detail || {};
  const spaceId = detail.spaceId ? String(detail.spaceId) : '';
  if (!spaceId) {
    loadSpacesDebounced();
    return;
  }
  if (String(selectedSpaceId.value || '') === spaceId) {
    mergeLatestMessagesForSpace(spaceId);
  } else {
    loadSpacesDebounced();
  }
}

let loadSpacesDebounceTimer = null;
function loadSpacesDebounced(delayMs = 400) {
  if (loadSpacesDebounceTimer) clearTimeout(loadSpacesDebounceTimer);
  loadSpacesDebounceTimer = setTimeout(() => {
    loadSpacesDebounceTimer = null;
    loadSpaces();
  }, delayMs);
}

function bumpRootReplyCount(rootId, delta = 1) {
  const rid = String(rootId || '');
  if (!rid) return;
  messages.value = messages.value.map((m) => {
    if (String(m._id) !== rid) return m;
    const next = Math.max(0, (Number(m.replyCount) || 0) + delta);
    return { ...m, replyCount: next };
  });
  if (threadRootMessage.value && String(threadRootMessage.value._id) === rid) {
    threadRootMessage.value = {
      ...threadRootMessage.value,
      replyCount: Math.max(0, (Number(threadRootMessage.value.replyCount) || 0) + delta),
    };
  }
}

function scrollThreadToBottom() {
  const el = threadListEl.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

function backToMobileList() {
  mobileShowConversation.value = false;
}

async function selectSpace(id) {
  const nextId = String(id || '');
  if (!nextId) return;

  const space = spaces.value.find((s) => String(s._id) === nextId);
  let targetId = nextId;
  if (space?.canJoin) {
    if (joining.value) return;
    joining.value = true;
    try {
      const joined = await joinChatChannel(nextId);
      await loadSpaces();
      if (joined?._id) targetId = String(joined._id);
    } catch (err) {
      error.value = err?.response?.data?.message || t('internalChat.joinFailed');
      return;
    } finally {
      joining.value = false;
    }
  }

  mobileShowConversation.value = true;

  if (
    suppressAutoMarkReadForSpaceId.value
    && String(selectedSpaceId.value || '') === String(suppressAutoMarkReadForSpaceId.value)
    && String(selectedSpaceId.value || '') !== targetId
  ) {
    suppressAutoMarkReadForSpaceId.value = null;
  }

  if (String(selectedSpaceId.value || '') === targetId && !space?.canJoin) {
    // Already selected — still sync URL if needed
    if (String(route.query.spaceId || '') !== targetId) {
      router.replace({ query: { ...route.query, spaceId: targetId } });
    }
    return;
  }

  closeThread();
  cancelEditMessage();
  cancelQuoteReply();
  selectedSpaceId.value = targetId;
  typingUsers.value = {};
  if (String(route.query.spaceId || '') !== targetId) {
    router.replace({ query: { ...route.query, spaceId: targetId } });
  }
  setChatPresence(targetId).then((viewers) => {
    presenceViewers.value = viewers;
  }).catch(() => {
    presenceViewers.value = [];
  });
}

function openThread(msg) {
  if (!msg?._id) return;
  cancelQuoteReply();
  threadRootId.value = String(msg._id);
  threadRootMessage.value = msg;
  threadDraft.value = '';
  // Defer fetch so the panel can paint/slide first.
  nextTick(() => {
    loadThreadMessages();
  });
}

function closeThread() {
  threadRootId.value = null;
}

function onThreadPanelAfterLeave() {
  threadRootMessage.value = null;
  threadMessages.value = [];
  threadDraft.value = '';
}

function threadReplyCountLabel(count) {
  const n = Number(count) || 0;
  return t(
    n === 1 ? 'internalChat.threadReplyCountOne' : 'internalChat.threadReplyCountOther',
    { count: n }
  );
}

let typingTimer = null;
function onComposerInput() {
  if (!selectedSpaceId.value) return;
  updateMentionSuggestions();
  if (typingTimer) return;
  typingTimer = setTimeout(() => {
    typingTimer = null;
  }, 2000);
  publishChatTyping(selectedSpaceId.value).catch(() => {});
}

function updateMentionSuggestions() {
  const editorApi = composerEditorRef.value;
  let q = null;
  if (typeof editorApi?.getActiveMentionQuery === 'function') {
    const fromEditor = editorApi.getActiveMentionQuery();
    if (fromEditor === null) {
      mentionSuggestions.value = [];
      mentionQuery.value = '';
      mentionMenuActive.value = false;
      return;
    }
    q = String(fromEditor).toLowerCase();
  } else {
    const plain = composerPlainText.value || plainTextFromInternalChatHtml(draft.value);
    const match = plain.match(/(?:^|\s)@([^\s@]*)$/);
    if (!match) {
      mentionSuggestions.value = [];
      mentionQuery.value = '';
      mentionMenuActive.value = false;
      return;
    }
    q = match[1].toLowerCase();
  }
  mentionQuery.value = q;
  mentionMenuActive.value = true;
  if (!orgUsers.value.length) loadOrgUsers();
  const me = String(authStore.user?._id || '');
  mentionSuggestions.value = orgUsers.value
    .filter((u) => String(u._id) !== me)
    .filter((u) => String(u.userType || 'INTERNAL').toUpperCase() !== 'EXTERNAL')
    .filter((u) => {
      const label = userLabel(u).toLowerCase();
      return !q || label.includes(q);
    })
    .slice(0, 6);
}

function replaceActiveMentionToken(label) {
  composerEditorRef.value?.replaceTrailingMentionQuery(label);
  mentionSuggestions.value = [];
  mentionQuery.value = '';
  mentionMenuActive.value = false;
  nextTick(() => {
    composerEditorRef.value?.focus();
    onComposerPlainText(composerEditorRef.value?.getPlainText?.() || plainTextFromInternalChatHtml(draft.value));
    updateMentionSuggestions();
  });
}

function insertMention(user) {
  const label = `@${internalChatUserDisplayName(user) || userLabel(user)}`;
  replaceActiveMentionToken(label);
}

async function addMentionedUserToGroup(user, { insertMentionAfter = false } = {}) {
  if (!user?._id || !selectedSpaceId.value || !isNonMemberMentionCandidate(user)) return;
  const name = userLabel(user);
  const ok = await confirmAction({
    title: t('internalChat.addToGroupTitle'),
    message: t('internalChat.addToGroupConfirm', { name }),
    confirmLabel: t('internalChat.addToGroup'),
    tone: 'success',
  });
  if (!ok) return;

  addingMentionUserId.value = String(user._id);
  try {
    await inviteChatMembers(selectedSpaceId.value, [user._id]);
    spaceMemberIds.value = [...new Set([...spaceMemberIds.value.map(String), String(user._id)])];
    membersCanInvite.value = true;
    if (insertMentionAfter) insertMention(user);
    success(t('internalChat.addToGroupSuccess', { name }));
    loadSpaces().catch(() => {});
  } catch (err) {
    const msg = err?.response?.data?.message || t('internalChat.inviteFailed');
    error.value = msg;
    notifyError(msg);
  } finally {
    addingMentionUserId.value = '';
  }
}

function insertMentionAll() {
  replaceActiveMentionToken('@all');
}

function isPinned(msg) {
  return pinnedIds.value.includes(String(msg._id));
}

async function togglePin(msg) {
  if (!selectedSpaceId.value || String(msg._id).startsWith('temp_')) return;
  const nextPin = !isPinned(msg);
  try {
    const result = await pinChatMessage(
      selectedSpaceId.value,
      msg._id,
      nextPin
    );
    const ids = result?.pinnedMessageIds ?? result?.data?.pinnedMessageIds;
    if (Array.isArray(ids)) {
      pinnedIds.value = ids.map(String);
    } else if (nextPin) {
      pinnedIds.value = [...new Set([...pinnedIds.value, String(msg._id)])];
    } else {
      pinnedIds.value = pinnedIds.value.filter((id) => id !== String(msg._id));
    }
    syncPinnedMessagesFromIds(msg, nextPin);
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('internalChat.pinFailed');
  }
}

function syncPinnedMessagesFromIds(touchedMsg, justPinned) {
  const idSet = new Set(pinnedIds.value.map(String));
  let next = pinnedMessages.value.filter((m) => idSet.has(String(m._id)));
  if (justPinned && touchedMsg?._id && idSet.has(String(touchedMsg._id))) {
    const exists = next.some((m) => String(m._id) === String(touchedMsg._id));
    if (!exists) next = [touchedMsg, ...next];
  }
  // Keep server pin order when possible
  const byId = new Map(next.map((m) => [String(m._id), m]));
  pinnedMessages.value = pinnedIds.value
    .map((id) => byId.get(String(id)))
    .filter(Boolean);
}

function pinnedAuthorLabel(msg) {
  return authorLabel(msg);
}

function pinnedPreviewText(msg) {
  if (!msg) return '';
  if (msg.kind === 'system') {
    return systemMessageText(msg) || t('internalChat.pinnedLabel');
  }
  const text = plainTextFromInternalChatHtml(
    formatInternalChatMentions(msg.body || '', mentionDirectory.value)
  ).trim();
  if (text) return text.length > 100 ? `${text.slice(0, 100)}…` : text;
  const images = messageImageAttachments(msg);
  if (images.length) return t('internalChat.quoteAttachmentPreview');
  if (messageFileAttachments(msg).length) {
    return messageFileAttachments(msg)[0]?.fileName || t('internalChat.quoteAttachmentPreview');
  }
  return t('internalChat.pinnedLabel');
}

async function jumpToPinnedMessage(messageId) {
  const mid = String(messageId || '');
  if (!mid || !selectedSpaceId.value) return;
  closeThread();
  await nextTick();
  const el = messageListEl.value?.querySelector(`[data-message-id="${CSS.escape(mid)}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flashPinnedMessage(mid);
    return;
  }

  const seq = ++messagesLoadSeq;
  loadingMessages.value = true;
  messageListReady.value = false;
  try {
    const result = await fetchChatMessages(selectedSpaceId.value, {
      aroundMessageId: mid,
      limit: 50,
    });
    if (seq !== messagesLoadSeq) return;
    messages.value = result.messages || [];
    readStateMode.value = result.readState?.mode || 'private';
    readStateMembers.value = Array.isArray(result.readState?.members)
      ? result.readState.members
      : [];
    pinnedIds.value = (result.space?.pinnedMessageIds || []).map(String);
    pinnedMessages.value = Array.isArray(result.pinnedMessages)
      ? result.pinnedMessages
      : pinnedMessages.value;
    messageListReady.value = true;
    await nextTick();
    await scrollToSearchMatch(mid);
    flashPinnedMessage(mid);
  } catch (err) {
    if (seq !== messagesLoadSeq) return;
    error.value = err?.response?.data?.message || t('internalChat.loadFailed');
    messageListReady.value = true;
  } finally {
    if (seq === messagesLoadSeq) loadingMessages.value = false;
  }
}

function startEditMessage(msg) {
  if (!msg?._id || !isOwnMessage(msg) || String(msg._id).startsWith('temp_')) return;
  cancelQuoteReply();
  editingMessageId.value = String(msg._id);
  clearPendingAttachments();
  const users = [
    ...orgUsers.value,
    msg.author,
    authStore.user,
  ].filter(Boolean);
  draft.value = formatInternalChatMentions(msg.body || '', users);
  nextTick(() => {
    composerEditorRef.value?.focus();
  });
}

function cancelEditMessage() {
  editingMessageId.value = null;
  draft.value = '';
  clearPendingAttachments();
}

function quoteAuthorLabel(msg) {
  if (!msg) return '';
  return authorLabel(msg);
}

function quotePreviewText(msg) {
  if (!msg) return '';
  const users = [...orgUsers.value, msg.author, authStore.user].filter(Boolean);
  const text = plainTextFromInternalChatHtml(
    formatInternalChatMentions(msg.body || '', users)
  ).trim();
  if (text) return text.length > 160 ? `${text.slice(0, 160)}…` : text;
  const images = messageImageAttachments(msg);
  if (images.length) return t('internalChat.quoteAttachmentPreview');
  if (messageFileAttachments(msg).length) {
    return messageFileAttachments(msg)[0]?.fileName || t('internalChat.quoteAttachmentPreview');
  }
  return '…';
}

function startQuoteReply(msg) {
  if (!msg?._id || String(msg._id).startsWith('temp_')) return;
  cancelEditMessage();
  // Quote posts to the channel timeline (not into a thread).
  if (threadRootId.value) closeThread();
  quotingMessage.value = msg;
  nextTick(() => {
    composerEditorRef.value?.focus();
  });
}

function cancelQuoteReply() {
  quotingMessage.value = null;
}

function jumpToQuotedMessage(messageId) {
  const mid = String(messageId || '');
  if (!mid) return;
  focusedSearchMessageId.value = mid;
  scrollToSearchMatch(mid);
}

function applyMessageEditLocally(messageId, patch) {
  const mid = String(messageId);
  const merge = (m) => (String(m._id) === mid ? { ...m, ...patch } : m);
  messages.value = messages.value.map(merge);
  threadMessages.value = threadMessages.value.map(merge);
  if (threadRootMessage.value && String(threadRootMessage.value._id) === mid) {
    threadRootMessage.value = { ...threadRootMessage.value, ...patch };
  }
}

async function removeMessage(msg) {
  if (!selectedSpaceId.value || String(msg._id).startsWith('temp_')) return;
  const ok = await confirmAction({
    title: t('internalChat.deleteMessageTitle'),
    message: t('internalChat.deleteMessageConfirm'),
    confirmLabel: t('actions.delete'),
    tone: 'danger',
  });
  if (!ok) return;
  try {
    await deleteChatMessage(selectedSpaceId.value, msg._id);
    const mid = String(msg._id);
    applyMessageEditLocally(mid, {
      deletedAt: new Date().toISOString(),
      deletedBy: authStore.user?._id || null,
      body: '',
      attachments: [],
      quote: null,
      reactions: [],
    });
    pinnedMessages.value = pinnedMessages.value.filter((m) => String(m._id) !== mid);
    pinnedIds.value = pinnedIds.value.filter((id) => id !== mid);
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.deleteFailed');
  }
}

async function downloadExport() {
  if (!selectedSpaceId.value) return;
  try {
    const data = await exportChatSpace(selectedSpaceId.value);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${selectedSpaceId.value}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.exportFailed');
  }
}

async function openSettings() {
  showSettingsModal.value = true;
  try {
    const settings = await fetchChatSettings();
    retentionDays.value = Number(settings.retentionDays) || 0;
    notifyChannelMessages.value = settings.notifyChannelMessages === true;
    seenReceiptsMode.value = ['off', 'private', 'on'].includes(settings.seenReceiptsMode)
      ? settings.seenReceiptsMode
      : 'private';
  } catch {
    retentionDays.value = 0;
    notifyChannelMessages.value = false;
    seenReceiptsMode.value = 'private';
  }
}

async function saveSettings() {
  savingSettings.value = true;
  try {
    const saved = await updateChatSettings({
      retentionDays: Number(retentionDays.value) || 0,
      notifyChannelMessages: notifyChannelMessages.value === true,
      seenReceiptsMode: seenReceiptsMode.value,
    });
    readStateMode.value = saved?.seenReceiptsMode || seenReceiptsMode.value;
    showSettingsModal.value = false;
    if (selectedSpaceId.value) await loadMessages();
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.settingsFailed');
  } finally {
    savingSettings.value = false;
  }
}

async function runSearch() {
  const q = searchQuery.value.trim();
  if (q.length < 2) {
    searchResults.value = [];
    focusedSearchMessageId.value = null;
    return;
  }
  try {
    searchResults.value = await searchChatMessages({
      q,
      spaceId: selectedSpaceId.value || undefined,
      limit: 30,
    });
    const localIds = [...conversationMatchIds.value];
    const firstId = localIds[0] || (searchResults.value[0] ? String(searchResults.value[0]._id) : null);
    focusedSearchMessageId.value = firstId;
    if (firstId) await scrollToSearchMatch(firstId);
  } catch (err) {
    // Local highlight still works even if API search fails
    const localIds = [...conversationMatchIds.value];
    focusedSearchMessageId.value = localIds[0] || null;
    if (localIds[0]) await scrollToSearchMatch(localIds[0]);
    if (!localIds.length) {
      error.value = err?.response?.data?.message || t('internalChat.searchFailed');
    }
  }
}

function clearSearch() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchQuery.value = '';
  searchResults.value = [];
  focusedSearchMessageId.value = null;
}

async function jumpToSearchHit(hit) {
  const hitId = hit?._id ? String(hit._id) : null;
  if (hit.spaceId && String(hit.spaceId) !== String(selectedSpaceId.value || '')) {
    await selectSpace(String(hit.spaceId));
    await nextTick();
    await loadMessages();
  }
  focusedSearchMessageId.value = hitId;
  if (hitId) await scrollToSearchMatch(hitId);
}

async function react(msg, emoji) {
  if (!selectedSpaceId.value || String(msg._id).startsWith('temp_')) return;
  try {
    const result = await toggleChatReaction(selectedSpaceId.value, msg._id, emoji);
    if (result?.reactions) {
      messages.value = messages.value.map((m) =>
        (m._id === msg._id ? { ...m, reactions: result.reactions } : m)
      );
    }
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.reactFailed');
  }
}

async function attachComposerFile(file) {
  if (!file || !selectedSpaceId.value) return;
  const isImage = isImageFile(file);
  const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const previewUrl = isImage ? URL.createObjectURL(file) : '';
  const named = file.name && file.name !== 'image.png'
    ? file
    : new File(
      [file],
      `paste-${Date.now()}.${(file.type || 'image/png').split('/')[1] || 'png'}`,
      { type: file.type || 'image/png' }
    );

  pendingAttachments.value = [
    ...pendingAttachments.value,
    {
      localId,
      isImage,
      previewUrl,
      uploading: true,
      fileName: named.name,
      mimeType: named.type || '',
      size: named.size || 0,
      url: '',
      storagePath: '',
    },
  ];
  uploading.value = true;
  try {
    const meta = await uploadChatAttachment(
      selectedSpaceId.value,
      named,
      authStore.user?.token
    );
    pendingAttachments.value = pendingAttachments.value.map((att) => {
      if (String(att.localId) !== localId) return att;
      return {
        ...att,
        uploading: false,
        fileName: meta?.fileName || att.fileName,
        mimeType: meta?.mimeType || att.mimeType,
        size: meta?.size || att.size,
        url: meta?.url || '',
        storagePath: meta?.storagePath || '',
      };
    });
  } catch (err) {
    removePendingAttachment(localId);
    error.value = err?.response?.data?.message || t('internalChat.uploadFailed');
  } finally {
    uploading.value = pendingAttachments.value.some((a) => a.uploading);
  }
}

/**
 * Attach one or more files. Enforces: max 5, and no mixing images with documents.
 * Over-limit picks: keep the first N that fit, toast that extras were skipped (native
 * OS pickers cannot cap selection count).
 * @param {File[]} files
 */
async function attachComposerFiles(files) {
  const list = (Array.isArray(files) ? files : [...(files || [])]).filter(Boolean);
  if (!list.length || !selectedSpaceId.value) return;

  const batchKinds = new Set(list.map((f) => (isImageFile(f) ? 'image' : 'file')));
  if (batchKinds.size > 1) {
    notifyWarning(t('internalChat.attachMixedTypes'), 4500);
    return;
  }
  const batchKind = [...batchKinds][0];
  const existingKind = pendingAttachmentKind();
  if (existingKind && existingKind !== batchKind) {
    notifyWarning(t('internalChat.attachSameTypeOnly'), 4500);
    return;
  }

  const remaining = remainingAttachmentSlots.value;
  if (remaining <= 0) {
    notifyInfo(t('internalChat.attachLimit', { count: MAX_CHAT_ATTACHMENTS }), 4000);
    return;
  }

  const skipped = Math.max(0, list.length - remaining);
  const toAdd = list.slice(0, remaining);
  if (skipped > 0) {
    notifyInfo(
      t('internalChat.attachLimitSkipped', {
        kept: toAdd.length,
        skipped,
        max: MAX_CHAT_ATTACHMENTS,
      }),
      4500
    );
  }

  for (const file of toAdd) {
    // Sequential so pendingAttachments updates don't race.
    // eslint-disable-next-line no-await-in-loop
    await attachComposerFile(file);
  }
}

async function onFileSelected(ev) {
  const selected = ev.target?.files ? [...ev.target.files] : [];
  if (fileInputEl.value) fileInputEl.value.value = '';
  await attachComposerFiles(selected);
}

async function onComposerPaste(event) {
  const files = extractImageFilesFromClipboard(event.clipboardData);
  if (!files.length) return;
  event.preventDefault();
  await attachComposerFiles(files);
}

async function submitMessage() {
  if (editingMessageId.value) {
    await saveEditedMessage();
    return;
  }
  const draftHtml = draft.value;
  const { body, mentionUserIds } = prepareOutgoingBody(draftHtml);
  if (pendingAttachments.value.some((a) => a.uploading)) return;
  const attachments = toSendAttachments(pendingAttachments.value);
  if ((isInternalChatBodyEmpty(body) && !attachments.length) || !selectedSpaceId.value || sending.value) return;

  if (canManageSpaceMembers.value && membersCanInvite.value && mentionUserIds.length) {
    const memberSet = new Set(spaceMemberIds.value.map(String));
    const missingIds = mentionUserIds.filter((id) => !memberSet.has(String(id)));
    if (missingIds.length) {
      const byId = new Map(orgUsers.value.map((u) => [String(u._id), u]));
      const names = missingIds
        .map((id) => {
          const u = byId.get(String(id));
          return u ? userLabel(u) : null;
        })
        .filter(Boolean)
        .join(', ');
      const ok = await confirmAction({
        title: t('internalChat.addToGroupTitle'),
        message: t('internalChat.addToGroupConfirmSend', {
          names: names || t('internalChat.someone'),
        }),
        confirmLabel: t('internalChat.addToGroupAndSend'),
        tone: 'success',
      });
      if (!ok) return;
      try {
        await inviteChatMembers(selectedSpaceId.value, missingIds);
        spaceMemberIds.value = [
          ...new Set([...spaceMemberIds.value.map(String), ...missingIds.map(String)]),
        ];
      } catch (err) {
        const msg = err?.response?.data?.message || t('internalChat.inviteFailed');
        error.value = msg;
        notifyError(msg);
        return;
      }
    }
  }

  sending.value = true;
  const tempId = `temp_${Date.now()}`;
  const optimisticAttachments = pendingAttachments.value.map((a) => ({
    fileName: a.fileName,
    mimeType: a.mimeType,
    size: a.size,
    url: a.previewUrl || a.url,
    storagePath: a.storagePath,
  }));
  const quoteSource = quotingMessage.value;
  const optimisticQuote = quoteSource
    ? {
      messageId: quoteSource._id,
      authorId: quoteSource.authorId || quoteSource.author?._id || null,
      authorName: quoteAuthorLabel(quoteSource),
      bodyPreview: quotePreviewText(quoteSource),
    }
    : null;
  const optimistic = {
    _id: tempId,
    body,
    quote: optimisticQuote,
    attachments: optimisticAttachments,
    reactions: [],
    replyCount: 0,
    createdAt: new Date().toISOString(),
    authorId: authStore.user?._id,
    author: {
      _id: authStore.user?._id,
      firstName: authStore.user?.firstName,
      lastName: authStore.user?.lastName,
      email: authStore.user?.email,
      avatar: authStore.user?.avatar || '',
    },
    threadRootId: null,
  };
  messages.value = [...messages.value, optimistic];
  draft.value = '';
  composerPlainText.value = '';
  const quoteMessageId = quoteSource?._id ? String(quoteSource._id) : undefined;
  quotingMessage.value = null;
  const sentPending = [...pendingAttachments.value];
  pendingAttachments.value = [];
  await scrollToBottom();
  try {
    const saved = await sendChatMessage(selectedSpaceId.value, {
      body,
      mentionUserIds,
      quoteMessageId,
      attachments,
    });
    sentPending.forEach(revokePreviewUrl);
    const savedId = String(saved?._id || '');
    messages.value = [
      ...messages.value.filter((m) => m._id !== tempId && String(m._id) !== savedId),
      {
        ...saved,
        reactions: saved.reactions || [],
        replyCount: Number(saved?.replyCount) || 0,
        quote: saved?.quote || optimisticQuote,
      },
    ];
    await loadSpaces();
  } catch (err) {
    messages.value = messages.value.filter((m) => m._id !== tempId);
    draft.value = draftHtml;
    pendingAttachments.value = sentPending;
    if (quoteSource) quotingMessage.value = quoteSource;
    error.value = err?.response?.data?.message || t('internalChat.sendFailed');
  } finally {
    sending.value = false;
  }
}

async function saveEditedMessage() {
  const messageId = String(editingMessageId.value || '');
  if (!messageId || !selectedSpaceId.value || sending.value) return;
  const draftHtml = draft.value;
  const { body, mentionUserIds } = prepareOutgoingBody(draftHtml);
  const existing = messages.value.find((m) => String(m._id) === messageId)
    || threadMessages.value.find((m) => String(m._id) === messageId);
  const hasAttachments = Array.isArray(existing?.attachments) && existing.attachments.length > 0;
  if (isInternalChatBodyEmpty(body) && !hasAttachments) return;

  sending.value = true;
  try {
    const saved = await editChatMessage(selectedSpaceId.value, messageId, {
      body,
      mentionUserIds,
    });
    applyMessageEditLocally(messageId, {
      body: saved?.body ?? body,
      editedAt: saved?.editedAt || new Date().toISOString(),
      mentionUserIds: saved?.mentionUserIds || mentionUserIds,
      reactions: saved?.reactions || existing?.reactions || [],
    });
    cancelEditMessage();
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.editFailed');
  } finally {
    sending.value = false;
  }
}

async function submitThreadReply() {
  const draftHtml = threadDraft.value;
  const { body, mentionUserIds } = prepareOutgoingBody(draftHtml);
  if (isInternalChatBodyEmpty(body) || !selectedSpaceId.value || !threadRootId.value || sendingThread.value) return;
  sendingThread.value = true;
  const tempId = `temp_thread_${Date.now()}`;
  const optimistic = {
    _id: tempId,
    body,
    attachments: [],
    reactions: [],
    createdAt: new Date().toISOString(),
    authorId: authStore.user?._id,
    author: {
      _id: authStore.user?._id,
      firstName: authStore.user?.firstName,
      lastName: authStore.user?.lastName,
      email: authStore.user?.email,
      avatar: authStore.user?.avatar || '',
    },
    threadRootId: threadRootId.value,
  };
  threadMessages.value = [...threadMessages.value, optimistic];
  threadDraft.value = '';
  bumpRootReplyCount(threadRootId.value, 1);
  await nextTick();
  scrollThreadToBottom();
  try {
    const saved = await sendChatMessage(selectedSpaceId.value, {
      body,
      mentionUserIds,
      threadRootId: threadRootId.value,
    });
    const savedId = String(saved?._id || '');
    threadMessages.value = [
      ...threadMessages.value.filter((m) => m._id !== tempId && String(m._id) !== savedId),
      {
        ...saved,
        reactions: saved.reactions || [],
      },
    ];
    await nextTick();
    scrollThreadToBottom();
  } catch (err) {
    threadMessages.value = threadMessages.value.filter((m) => m._id !== tempId);
    bumpRootReplyCount(threadRootId.value, -1);
    threadDraft.value = draftHtml;
    error.value = err?.response?.data?.message || t('internalChat.sendFailed');
  } finally {
    sendingThread.value = false;
  }
}

async function createChannel() {
  creating.value = true;
  try {
    const space = await createChatChannel({
      name: channelName.value.trim(),
      topic: channelTopic.value.trim(),
      isPrivate: channelPrivate.value,
      memberIds: channelInviteIds.value,
    });
    closeChannelModal();
    await loadSpaces();
    if (space?._id) await selectSpace(space._id);
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.createFailed');
  } finally {
    creating.value = false;
  }
}

async function submitInviteMembers() {
  if (!selectedSpaceId.value || !inviteMemberIds.value.length) return;
  inviting.value = true;
  try {
    await inviteChatMembers(selectedSpaceId.value, inviteMemberIds.value);
    closeInviteModal();
    await loadSpaces();
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.inviteFailed');
  } finally {
    inviting.value = false;
  }
}

async function createDm() {
  creating.value = true;
  try {
    let space = null;
    if (dmMode.value === 'group') {
      space = await createChatGroupDm(groupDmIds.value);
    } else if (dmUserId.value) {
      space = await createChatDm(dmUserId.value);
    }
    closeDmModal();
    await loadSpaces();
    if (space?._id) selectSpace(space._id);
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.createFailed');
  } finally {
    creating.value = false;
  }
}

function toggleGroupMember(id) {
  const sid = String(id);
  if (groupDmIds.value.includes(sid)) {
    groupDmIds.value = groupDmIds.value.filter((x) => x !== sid);
  } else {
    groupDmIds.value = [...groupDmIds.value, sid];
  }
}

async function loadOrgUsers() {
  try {
    orgUsers.value = await fetchChatTeammates();
  } catch {
    orgUsers.value = [];
  }
}

function onStreamEvent(payload) {
  if (!payload?.type) return;
  if (payload.type === 'read.updated') {
    if (String(payload.spaceId) !== String(selectedSpaceId.value)) return;
    readStateMembers.value = applyReadUpdated(readStateMembers.value, payload);
    return;
  }
  if (payload.type === 'message.deleted') {
    if (String(payload.spaceId) !== String(selectedSpaceId.value)) return;
    const mid = String(payload.messageId);
    applyMessageEditLocally(mid, {
      deletedAt: payload.deletedAt || new Date().toISOString(),
      deletedBy: payload.deletedBy || null,
      body: '',
      attachments: [],
      quote: null,
      reactions: [],
    });
    pinnedMessages.value = pinnedMessages.value.filter((m) => String(m._id) !== mid);
    pinnedIds.value = pinnedIds.value.filter((id) => id !== mid);
    return;
  }
  if (payload.type === 'space.updated' && Array.isArray(payload.pinnedMessageIds)) {
    if (String(payload.spaceId) === String(selectedSpaceId.value)) {
      pinnedIds.value = payload.pinnedMessageIds.map(String);
      const idSet = new Set(pinnedIds.value);
      const byId = new Map();
      for (const m of pinnedMessages.value) {
        if (idSet.has(String(m._id))) byId.set(String(m._id), m);
      }
      for (const m of messages.value) {
        if (idSet.has(String(m._id))) byId.set(String(m._id), m);
      }
      pinnedMessages.value = pinnedIds.value
        .map((id) => byId.get(String(id)))
        .filter(Boolean);
    }
    loadSpaces();
    return;
  }
  if (payload.type === 'space.updated') {
    if (payload.action === 'member_removed') {
      const sid = String(payload.spaceId || '');
      const removedId = String(payload.removedUserId || '');
      const meId = String(authStore.user?._id || '');
      if (removedId && removedId === meId && sid) {
        closeMembersModal();
        spaces.value = spaces.value.filter((s) => String(s._id) !== sid);
        if (String(selectedSpaceId.value || '') === sid) {
          selectedSpaceId.value = spaces.value[0]?._id || null;
        }
        return;
      }
      if (showMembersModal.value && String(selectedSpaceId.value || '') === sid) {
        openMembersModal(sid);
      }
    }
    if (payload.action === 'renamed' || payload.name != null) {
      applySpaceNamePatch(payload.spaceId, {
        ...(payload.name != null ? { name: payload.name } : {}),
        ...(payload.topic != null ? { topic: payload.topic } : {}),
      });
    }
    loadSpaces();
    return;
  }
  if (payload.type === 'unread.bump') {
    loadSpaces();
    return;
  }
  if (payload.type === 'typing') {
    if (String(payload.spaceId) !== String(selectedSpaceId.value)) return;
    typingUsers.value = {
      ...typingUsers.value,
      [payload.userId]: {
        userId: String(payload.userId),
        name: payload.name || t('internalChat.unknownAuthor'),
        at: payload.at || Date.now(),
      },
    };
    return;
  }
  if (payload.type === 'presence') {
    if (String(payload.spaceId) !== String(selectedSpaceId.value)) return;
    presenceViewers.value = Array.isArray(payload.viewers) ? payload.viewers : [];
    return;
  }
  if (payload.type === 'message.updated') {
    if (String(payload.spaceId) !== String(selectedSpaceId.value)) return;
    const mid = String(payload.messageId || '');
    const patch = {};
    if (payload.deletedAt) {
      patch.deletedAt = payload.deletedAt;
      patch.deletedBy = payload.deletedBy || null;
      patch.body = '';
      patch.attachments = [];
      patch.quote = null;
      patch.reactions = [];
      pinnedMessages.value = pinnedMessages.value.filter((m) => String(m._id) !== mid);
      pinnedIds.value = pinnedIds.value.filter((id) => id !== mid);
    } else {
      if (payload.reactions) patch.reactions = payload.reactions;
      if (payload.body !== undefined) patch.body = payload.body;
      if (payload.editedAt) patch.editedAt = payload.editedAt;
      if (payload.mentionUserIds) patch.mentionUserIds = payload.mentionUserIds;
      if (payload.attachments) patch.attachments = payload.attachments;
      if (payload.quote !== undefined) patch.quote = payload.quote;
    }
    if (!Object.keys(patch).length) return;
    applyMessageEditLocally(mid, patch);
    return;
  }
  if (payload.type === 'message.created') {
    const sid = String(payload.spaceId || '');
    const authorId = payload.message?.authorId || payload.message?.author?._id;
    const spaceRow = spaces.value.find((s) => String(s._id) === sid);
    if (payload.message?.kind !== 'system' && !isSpaceMuted(spaceRow)) {
      alertForInternalChatSseMessage({
        spaceId: sid,
        authorId,
        currentUserId: authStore.user?._id,
      });
    }
    if (sid === String(selectedSpaceId.value)) {
      const rawThread = payload.message?.threadRootId;
      const msgThread = rawThread != null && rawThread !== ''
        ? String(rawThread)
        : null;
      const currentThread = threadRootId.value ? String(threadRootId.value) : null;

      if (msgThread) {
        // Avoid double-count when this client already optimistically bumped.
        const mid = String(payload.message?._id || '');
        const alreadyInThread = threadMessages.value.some((m) => String(m._id) === mid)
          || threadMessages.value.some((m) => (
            String(m._id).startsWith('temp_')
            && String(m.authorId || m.author?._id || '') === String(authorId || '')
            && String(m.body || '') === String(payload.message?.body || '')
          ));
        if (!alreadyInThread) {
          bumpRootReplyCount(msgThread, 1);
        }
        if (currentThread === msgThread && payload.message) {
          const existingIdx = threadMessages.value.findIndex((m) => String(m._id) === mid);
          if (existingIdx >= 0) {
            const next = [...threadMessages.value];
            next[existingIdx] = {
              ...next[existingIdx],
              ...payload.message,
              reactions: payload.message.reactions || next[existingIdx].reactions || [],
            };
            threadMessages.value = next;
          } else {
            const tempIdx = threadMessages.value.findIndex((m) => (
              String(m._id).startsWith('temp_')
              && String(m.authorId || m.author?._id || '') === String(payload.message.authorId || payload.message.author?._id || '')
              && String(m.body || '') === String(payload.message.body || '')
            ));
            const normalized = {
              ...payload.message,
              reactions: payload.message.reactions || [],
            };
            if (tempIdx >= 0) {
              const next = [...threadMessages.value];
              next[tempIdx] = normalized;
              threadMessages.value = next;
            } else {
              threadMessages.value = [...threadMessages.value, normalized];
            }
            nextTick(() => scrollThreadToBottom());
            safeMarkChatRead(selectedSpaceId.value, payload.message._id);
          }
        }
        return;
      }

      if (payload.message) {
        const mid = String(payload.message._id);
        const existingIdx = messages.value.findIndex((m) => String(m._id) === mid);
        if (existingIdx >= 0) {
          const next = [...messages.value];
          next[existingIdx] = {
            ...next[existingIdx],
            ...payload.message,
            reactions: payload.message.reactions || next[existingIdx].reactions || [],
            replyCount: next[existingIdx].replyCount || 0,
          };
          messages.value = next;
        } else {
          const tempIdx = messages.value.findIndex((m) => (
            String(m._id).startsWith('temp_')
            && String(m.authorId || m.author?._id || '') === String(payload.message.authorId || payload.message.author?._id || '')
            && String(m.body || '') === String(payload.message.body || '')
          ));
          const normalized = {
            ...payload.message,
            reactions: payload.message.reactions || [],
            replyCount: Number(payload.message.replyCount) || 0,
          };
          if (tempIdx >= 0) {
            const next = [...messages.value];
            next[tempIdx] = {
              ...normalized,
              replyCount: next[tempIdx].replyCount || 0,
            };
            messages.value = next;
          } else {
            messages.value = [...messages.value, normalized];
          }
          scrollToBottom();
          safeMarkChatRead(selectedSpaceId.value, payload.message._id);
        }
      }
    }
    loadSpacesDebounced();
  }
}

let streamControls = null;
let mobileMql = null;

function onMobileMqChange(e) {
  // Entering mobile with a selection → show conversation pane
  if (e.matches && selectedSpaceId.value) {
    mobileShowConversation.value = true;
  }
}

watch(selectedSpaceId, (id) => {
  showChannelMenu.value = false;
  sidebarChannelMenuId.value = null;
  muteDurationMenuId.value = null;
  setInternalChatFocus({ spaceId: id, routeActive: true });
  loadMessages();
  if (id) {
    setChatPresence(id).then((viewers) => {
      presenceViewers.value = viewers;
    }).catch(() => {
      presenceViewers.value = [];
    });
  } else {
    presenceViewers.value = [];
    mobileShowConversation.value = false;
  }
});

// Browser back/forward / deep-link query changes
watch(
  () => [route.query.spaceId, route.query.messageId],
  ([qSpaceRaw, qMessageRaw]) => {
    const qSpace = qSpaceRaw ? String(qSpaceRaw) : null;
    const qMessage = qMessageRaw ? String(qMessageRaw) : null;
    if (qSpace && qMessage) {
      focusMessageFromRouteQuery();
      return;
    }
    if (!qSpace) return;
    if (String(selectedSpaceId.value || '') === qSpace) {
      mobileShowConversation.value = true;
      return;
    }
    if (spaces.value.some((s) => String(s._id) === qSpace)) {
      closeThread();
      selectedSpaceId.value = qSpace;
      mobileShowConversation.value = true;
    }
  }
);

watch(showDmModal, (open) => {
  if (open) loadOrgUsers();
});

watch(showChannelModal, (open) => {
  if (open) loadOrgUsers();
});

watch(conversationMatchIds, async (ids) => {
  if (!searchQuery.value.trim() || ids.size === 0) return;
  if (focusedSearchMessageId.value && ids.has(String(focusedSearchMessageId.value))) return;
  const first = [...ids][0];
  focusedSearchMessageId.value = first;
  await scrollToSearchMatch(first);
});

watch(draft, () => {
  if (!orgUsers.value.length && draft.value.includes('@')) loadOrgUsers();
});

onMounted(async () => {
  if (typeof window !== 'undefined') {
    mobileMql = window.matchMedia('(max-width: 767px)');
    mobileMql.addEventListener('change', onMobileMqChange);
    if (mobileMql.matches && (selectedSpaceId.value || route.query.spaceId)) {
      mobileShowConversation.value = true;
    }
  }

  setInternalChatFocus({
    spaceId: selectedSpaceId.value || route.query.spaceId || null,
    routeActive: true,
  });
  clearInternalChatMainTabAlert();

  await loadSpaces();
  if (!orgUsers.value.length) {
    loadOrgUsers();
  }
  if (route.query.spaceId && route.query.messageId) {
    if (mobileMql?.matches) mobileShowConversation.value = true;
    await focusMessageFromRouteQuery();
  } else if (selectedSpaceId.value) {
    if (mobileMql?.matches) mobileShowConversation.value = true;
    // Spaces skeleton is gone — pin after mount (watch may have loaded while list was unmounted).
    await loadMessages();
  }

  streamControls = createInternalChatStream({
    getToken: () => authStore.user?.token,
    onConnected: () => {
      streamLive.value = true;
    },
    onDisconnected: () => {
      streamLive.value = false;
    },
    onEvent: onStreamEvent,
  });
  streamControls.connect();
  document.addEventListener('click', closeEmojiPickerOnOutsideClick);
  document.addEventListener('click', closeChannelMenuOnOutsideClick);
  window.addEventListener('resize', updateEmojiPickerPosition);
  window.addEventListener('scroll', updateEmojiPickerPosition, true);
  window.addEventListener('arivu:internal-chat-workspace', onInternalChatWorkspaceEvent);
});

onActivated(() => {
  setInternalChatFocus({
    spaceId: selectedSpaceId.value || route.query.spaceId || null,
    routeActive: true,
  });
  clearInternalChatMainTabAlert();
  // Catch up after keep-alive / missed SSE while the tab was inactive.
  if (selectedSpaceId.value) {
    loadMessages();
    loadSpaces();
  }
  if (!streamLive.value) {
    streamControls?.connect();
  }
});

onDeactivated(() => {
  // keep-alive: still mounted, but not the visible tab — allow toasts for this space.
  setInternalChatFocus({ spaceId: selectedSpaceId.value, routeActive: false });
  closeEmojiPicker();
});

onUnmounted(() => {
  clearInternalChatFocus();
  clearPendingAttachments();
  streamControls?.disconnect();
  streamControls = null;
  mobileMql?.removeEventListener('change', onMobileMqChange);
  mobileMql = null;
  document.removeEventListener('click', closeEmojiPickerOnOutsideClick);
  document.removeEventListener('click', closeChannelMenuOnOutsideClick);
  window.removeEventListener('resize', updateEmojiPickerPosition);
  window.removeEventListener('scroll', updateEmojiPickerPosition, true);
  window.removeEventListener('arivu:internal-chat-workspace', onInternalChatWorkspaceEvent);
  if (loadSpacesDebounceTimer) clearTimeout(loadSpacesDebounceTimer);
  if (mergeCatchUpTimer) clearTimeout(mergeCatchUpTimer);
  if (pinFlashTimer) clearTimeout(pinFlashTimer);
  closeEmojiPicker();
});
</script>

<style scoped>
.internal-chat-composer-emoji-picker {
  --emoji-size: 1.125rem;
  --num-columns: 8;
  width: min(20rem, calc(100vw - 2rem));
  height: 18rem;
}

.internal-chat-composer-emoji-picker.light {
  --background: #ffffff;
}

.internal-chat-composer-emoji-picker.dark {
  --background: #1f2937;
}

/* Thread panel: GPU slide only (no max-width — that reflows the chat and lags) */
.ic-thread-panel-enter-active,
.ic-thread-panel-leave-active {
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.ic-thread-panel-enter-from,
.ic-thread-panel-leave-to {
  transform: translate3d(100%, 0, 0);
}

.ic-md :deep(strong) {
  font-weight: 700;
}

.ic-md :deep(em) {
  font-style: italic;
}

.ic-md :deep(s),
.ic-md :deep(del) {
  text-decoration: line-through;
}

.ic-md :deep(p) {
  margin: 0;
}

.ic-md :deep(p + p) {
  margin-top: 0.35rem;
}

.ic-md :deep(h1) {
  margin: 0.2rem 0;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.3;
}

.ic-md :deep(h2) {
  margin: 0.2rem 0;
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.35;
}

.ic-md :deep(h3) {
  margin: 0.15rem 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
}

.ic-md :deep(blockquote) {
  margin: 0.35rem 0;
  border-left: 3px solid rgb(209 213 219);
  padding: 0.2rem 0.65rem;
  background: rgb(0 0 0 / 0.04);
}

.ic-md--own :deep(blockquote) {
  border-left-color: rgb(255 255 255 / 0.45);
  background: rgb(255 255 255 / 0.12);
}

.ic-md :deep(ul) {
  list-style: disc;
  padding-left: 1.25rem;
  margin: 0.25rem 0;
}

.ic-md :deep(ol) {
  list-style: decimal;
  padding-left: 1.25rem;
  margin: 0.25rem 0;
}

.ic-md :deep(code) {
  border-radius: 0.25rem;
  padding: 0.05rem 0.3rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85em;
}

.ic-md--other :deep(code) {
  background: rgb(0 0 0 / 0.06);
}

.ic-md--own :deep(code) {
  background: rgb(255 255 255 / 0.2);
}

.ic-md :deep(a),
.ic-md :deep(.ic-md-link) {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.ic-md--other :deep(a),
.ic-md--other :deep(.ic-md-link) {
  color: rgb(37 99 235);
}

.ic-md--own :deep(a),
.ic-md--own :deep(.ic-md-link) {
  color: rgb(255 255 255);
}

.ic-md :deep(.ic-mention) {
  border-radius: 0.25rem;
  padding: 0.05rem 0.3rem;
  font-weight: 600;
}

.ic-md--other :deep(.ic-mention) {
  background: rgb(219 234 254);
  color: rgb(30 64 175);
}

.ic-md--own :deep(.ic-mention) {
  background: rgb(255 255 255 / 0.25);
  color: rgb(255 255 255);
}
</style>
