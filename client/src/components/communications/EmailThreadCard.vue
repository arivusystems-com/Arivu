<template>
  <div :class="['flex-1 min-w-0', compact ? 'py-0' : 'py-1.5']">
    <div
      v-if="isSingleMessageThread"
      class="group/thread w-full overflow-visible rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-colors"
    >
      <button
        type="button"
        class="w-full text-left transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        @click="$emit('toggle')"
      >
        <div class="flex items-center gap-3 px-4 pt-3 pb-2">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/10 dark:ring-indigo-400/10">
              <EnvelopeIcon class="w-4 h-4" />
            </div>
            <Avatar
              v-if="singleMessage.direction === 'outbound' && currentUser"
              :user="currentUser"
              size="sm"
            />
            <div
              v-else
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium"
              :class="[
                singleMessage.direction === 'outbound'
                  ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              ]"
            >
              {{ getMessageInitials(singleMessage) }}
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {{ getMessageSenderLabel(singleMessage) }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ singleMessage.subject || '(no subject)' }}
              </p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2 pl-2">
            <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ formatDate(singleMessage.sentAt || singleMessage.receivedAt) }}
            </span>
            <span class="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 group-hover/thread:text-gray-600 dark:group-hover/thread:text-gray-300 transition-colors">
              <ChevronRightIcon
                :class="['w-5 h-5 transition-transform duration-200', expanded && 'rotate-90']"
              />
            </span>
          </div>
        </div>
        <div v-if="shouldShowHeaderChips(thread)" class="px-4 pb-2 flex items-center gap-1.5 flex-wrap">
          <span
            v-if="shouldShowPriorityChip(thread) && thread.triage.priorityHint === 'high'"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
          >{{ t('inbox.emailThreadCardHighPriority2') }}</span>
          <span
            v-else-if="shouldShowPriorityChip(thread) && thread.triage.priorityHint === 'medium'"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          >{{ t('inbox.emailThreadCardFollowUp2') }}</span>
          <span
            v-if="thread.triage?.slaHint === 'overdue'"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
          >{{ t('inbox.emailThreadCardReplyOverdue2') }}</span>
          <span
            v-else-if="thread.triage?.slaHint === 'reply_due_soon'"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          >{{ t('inbox.emailThreadCardReplyDueSoon2') }}</span>
          <span
            v-if="hasStrongDeliveryRisk(thread)"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
          >{{ t('inbox.emailThreadCardDeliveryRisk2') }}</span>
          <span
            v-if="thread.assignedToDisplay"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300"
          >
            {{ isAssignedToCurrentUser(thread) ? 'Assigned to me' : `Assigned: ${thread.assignedToDisplay}` }}
          </span>
          <span
            v-for="tag in (thread.tags || []).slice(0, 2)"
            :key="`single-header-tag-${thread.threadId}-${tag}`"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
          >
            #{{ tag }}
          </span>
        </div>
      </button>
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="expanded" class="group/single-message relative border-t border-gray-200 dark:border-gray-700 px-4 pb-3.5 pt-2.5">
          <div class="flex items-center justify-end gap-1.5 pb-2 opacity-0 group-hover/single-message:opacity-100 group-focus-within/single-message:opacity-100 transition-opacity">
            <button
              type="button"
              @click="triggerSingleReply()"
              :title="t('records.activityReply')"
              class="inline-flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowUturnLeftIcon class="w-4 h-4" />
            </button>
            <button
              v-if="shouldShowReplyAll(singleMessage)"
              type="button"
              @click="triggerSingleReplyAll()"
              :title="t('inbox.emailThreadCardReplyAll2')"
              class="inline-flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <span class="relative block w-4 h-4">
                <ArrowUturnLeftIcon class="absolute top-0 left-1 w-3.5 h-3.5" />
                <ArrowUturnLeftIcon class="absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5" />
              </span>
            </button>
            <Menu as="div" class="relative inline-block text-left">
              <MenuButton
                :title="t('records.genericMoreActions')"
                class="inline-flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <PlusIcon class="w-4 h-4" />
              </MenuButton>
              <transition
                enter-active-class="transition ease-out duration-100"
                enter-from-class="transform opacity-0 scale-95"
                enter-to-class="transform opacity-100 scale-100"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="transform opacity-100 scale-100"
                leave-to-class="transform opacity-0 scale-95"
              >
                <MenuItems class="absolute right-0 z-20 mt-1 w-40 origin-top-right rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg focus:outline-none">
                  <div class="py-1">
                    <MenuItem v-slot="{ active }">
                      <button
                        type="button"
                        @click="$emit('create-task', singleMessage)"
                        :class="[
                          'w-full text-left px-3 py-1.5 text-xs',
                          active ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
                        ]"
                      >{{ t('process.actionCreateTaskLower') }}</button>
                    </MenuItem>
                    <MenuItem v-slot="{ active }">
                      <button
                        type="button"
                        @click="$emit('assign-thread', { threadId: thread.threadId, assignedToUserId: currentUser?._id || currentUser?.id || null })"
                        :class="[
                          'w-full text-left px-3 py-1.5 text-xs',
                          active ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
                        ]"
                      >{{ t('common.formAssignToMe') }}</button>
                    </MenuItem>
                    <MenuItem v-slot="{ active }">
                      <button
                        type="button"
                        @click="$emit('unassign-thread', { threadId: thread.threadId })"
                        :class="[
                          'w-full text-left px-3 py-1.5 text-xs',
                          active ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
                        ]"
                      >{{ t('inbox.emailThreadCardUnassign2') }}</button>
                    </MenuItem>
                    <MenuItem v-slot="{ active }">
                      <button
                        type="button"
                        @click="openTagManager($event)"
                        :class="[
                          'w-full text-left px-3 py-1.5 text-xs',
                          active ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
                        ]"
                      >{{ t('inbox.emailThreadCardAddTag2') }}</button>
                    </MenuItem>
                    <MenuItem v-slot="{ active }">
                      <button
                        type="button"
                        @click="$emit('create-case', singleMessage)"
                        :class="[
                          'w-full text-left px-3 py-1.5 text-xs',
                          active ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
                        ]"
                      >{{ t('inbox.emailThreadCardCreateCase2') }}</button>
                    </MenuItem>
                  </div>
                </MenuItems>
              </transition>
            </Menu>
          </div>
          <div v-if="showTagManager" ref="tagPopoverRef" class="absolute right-4 top-10 z-30 w-[360px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
            <RecordTagPopover
              :record="threadTagRecord"
              tag-storage-key="communication_thread_tags"
              :can-edit="true"
              :persist-tags="persistThreadTags"
              instance-tag-source="tasks"
              :open="showTagManager"
            />
          </div>
          <div
            class="max-w-[72ch] text-sm leading-[1.55] text-gray-700 dark:text-gray-300 break-words prose prose-sm dark:prose-invert max-w-none [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 dark:[&_blockquote]:border-gray-600 [&_blockquote]:bg-gray-50 dark:[&_blockquote]:bg-gray-800/60 [&_blockquote]:px-3 [&_blockquote]:py-2 [&_blockquote]:my-2 [&_blockquote[data-collapsed='true']]:cursor-pointer [&_blockquote[data-collapsed='true']]:py-1.5 [&_blockquote[data-collapsed='true']]:text-gray-500 [&_blockquote[data-collapsed='true']>[data-quote-placeholder='true']]:block [&_blockquote[data-collapsed='true']>[data-quote-placeholder='true']]:font-semibold [&_blockquote[data-collapsed='true']>[data-quote-placeholder='true']]:tracking-wide [&_blockquote[data-collapsed='true']>*:not([data-quote-placeholder='true'])]:hidden"
            @click="handleRenderedBodyClick"
            v-html="renderMessageBody(singleMessage.body)"
          />
        </div>
      </Transition>
    </div>
    <div v-else class="group/thread w-full overflow-visible rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-colors">
      <!-- Collapsed card header (always shown) -->
      <button
        type="button"
        class="w-full text-left transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        @click="$emit('toggle')"
        @keydown.r.prevent="triggerThreadReply(false)"
        @keydown.a.prevent="triggerThreadReply(true)"
        @keydown.d.prevent="$emit('toggle-done', { threadId: thread.threadId, done: !thread.done })"
      >
        <div class="flex items-center gap-3 px-4 pt-3 pb-2">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/10 dark:ring-indigo-400/10">
            <EnvelopeIcon class="w-4 h-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {{ thread.participantDisplay || `${thread.messageCount || 0} message${(thread.messageCount || 0) !== 1 ? 's' : ''}` }}
              </span>
              <span
                v-if="thread.unread"
                class="w-2 h-2 rounded-full bg-indigo-500 shrink-0"
                :title="t('inbox.emailThreadCardUnread')"
              />
            </div>
            <p
              :class="[
                'text-sm mt-0.5 line-clamp-2 leading-5 max-w-[62ch]',
                thread.unread
                  ? 'font-semibold text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400'
              ]"
            >
              {{ thread.subject }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2 pl-2">
            <button
              type="button"
              @click.stop="$emit('toggle-done', { threadId: thread.threadId, done: !thread.done })"
              :class="[
                'inline-flex items-center justify-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                thread.done
                  ? 'border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
              ]"
            >
              {{ thread.done ? 'Reopen' : 'Done' }}
            </button>
            <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              <span
                class="cursor-help"
                :title="formatFullDate ? formatFullDate(thread.lastActivityAt || thread.firstActivityAt) : ''"
                @pointerup.stop="handleTimestampPointerUp($event, thread.lastActivityAt || thread.firstActivityAt)"
              >
                {{ formatDate(thread.lastActivityAt || thread.firstActivityAt) }}
              </span>
            </span>
            <span class="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 group-hover/thread:text-gray-600 dark:group-hover/thread:text-gray-300 transition-colors">
              <ChevronRightIcon
                :class="['w-5 h-5 transition-transform duration-200', expanded && 'rotate-90']"
              />
            </span>
          </div>
        </div>
        <div v-if="shouldShowHeaderChips(thread)" class="px-4 pb-2 flex items-center gap-1.5 flex-wrap">
          <span
            v-if="shouldShowPriorityChip(thread) && thread.triage.priorityHint === 'high'"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
          >{{ t('inbox.emailThreadCardHighPriority') }}</span>
          <span
            v-else-if="shouldShowPriorityChip(thread) && thread.triage.priorityHint === 'medium'"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          >{{ t('inbox.emailThreadCardFollowUp') }}</span>
          <span
            v-if="thread.triage?.slaHint === 'overdue'"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
          >{{ t('inbox.emailThreadCardReplyOverdue') }}</span>
          <span
            v-else-if="thread.triage?.slaHint === 'reply_due_soon'"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          >{{ t('inbox.emailThreadCardReplyDueSoon') }}</span>
          <span
            v-if="hasStrongDeliveryRisk(thread)"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
          >{{ t('inbox.emailThreadCardDeliveryRisk') }}</span>
          <span
            v-if="thread.assignedToDisplay"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300"
          >
            {{ isAssignedToCurrentUser(thread) ? 'Assigned to me' : `Assigned: ${thread.assignedToDisplay}` }}
          </span>
          <span
            v-for="tag in (thread.tags || []).slice(0, 2)"
            :key="`thread-header-tag-${thread.threadId}-${tag}`"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
          >
            #{{ tag }}
          </span>
        </div>
      </button>

      <!-- Expanded thread: inline content inside same card -->
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="expanded" class="border-t border-gray-200 dark:border-gray-700">
          <div class="relative px-4 pb-3.5 pt-2.5">
            <div v-if="showTagManager" ref="tagPopoverRef" class="absolute right-0 top-0 z-30 w-[360px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
              <RecordTagPopover
                :record="threadTagRecord"
                tag-storage-key="communication_thread_tags"
                :can-edit="true"
                :persist-tags="persistThreadTags"
                instance-tag-source="tasks"
                :open="showTagManager"
              />
            </div>
            <div
              v-for="(msg, mi) in thread.messages"
              :key="msg._id || mi"
              :class="[
                mi > 0 ? 'mt-3.5 pt-3.5 border-t border-gray-100 dark:border-gray-800' : '',
                'transition-colors group/msg'
              ]"
            >
              <!-- Message header (avatar + meta) -->
              <div class="flex items-start justify-between gap-2 pb-1.5">
                <div class="flex items-center gap-3 min-w-0">
                  <Avatar
                    v-if="msg.direction === 'outbound' && currentUser"
                    :user="currentUser"
                    size="sm"
                  />
                  <div
                    v-else
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium"
                    :class="[
                      msg.direction === 'outbound'
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    ]"
                  >
                    {{ getMessageInitials(msg) }}
                  </div>
                  <div class="min-w-0 flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {{ getMessageSenderLabel(msg) }}
                    </span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      <span
                        class="cursor-help"
                        :title="formatFullDate ? formatFullDate(msg.sentAt || msg.receivedAt) : ''"
                        @pointerup.stop="handleTimestampPointerUp($event, msg.sentAt || msg.receivedAt)"
                      >
                      {{ formatDate(msg.sentAt || msg.receivedAt) }}
                      </span>
                    </span>
                    <span
                      v-if="msg.direction === 'outbound'"
                      class="text-xs font-medium text-indigo-600 dark:text-indigo-400"
                    >
                      {{ msg.direction === 'outbound' ? 'Sent' : 'Received' }}
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover/msg:opacity-100 group-focus-within/msg:opacity-100 transition-opacity">
                  <button
                    type="button"
                    @click="$emit('reply', buildReplyPayload(msg))"
                    :title="t('records.activityReply')"
                    class="inline-flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <ArrowUturnLeftIcon class="w-4 h-4" />
                  </button>
                  <button
                    v-if="shouldShowReplyAll(msg)"
                    type="button"
                    @click="$emit('reply', buildReplyPayload(msg, { replyAll: true }))"
                    :title="t('inbox.emailThreadCardReplyAll')"
                    class="inline-flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <span class="relative block w-4 h-4">
                      <ArrowUturnLeftIcon class="absolute top-0 left-1 w-3.5 h-3.5" />
                      <ArrowUturnLeftIcon class="absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5" />
                    </span>
                  </button>
                  <Menu as="div" class="relative inline-block text-left">
                    <MenuButton
                      :title="t('records.genericMoreActions')"
                      class="inline-flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <PlusIcon class="w-4 h-4" />
                    </MenuButton>
                    <transition
                      enter-active-class="transition ease-out duration-100"
                      enter-from-class="transform opacity-0 scale-95"
                      enter-to-class="transform opacity-100 scale-100"
                      leave-active-class="transition ease-in duration-75"
                      leave-from-class="transform opacity-100 scale-100"
                      leave-to-class="transform opacity-0 scale-95"
                    >
                      <MenuItems class="absolute right-0 z-20 mt-1 w-40 origin-top-right rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg focus:outline-none">
                        <div class="py-1">
                          <MenuItem v-slot="{ active }">
                            <button
                              type="button"
                              @click="$emit('create-task', msg)"
                              :class="[
                                'w-full text-left px-3 py-1.5 text-xs',
                                active ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
                              ]"
                            >{{ t('process.actionCreateTaskLower') }}</button>
                          </MenuItem>
                          <MenuItem v-slot="{ active }">
                            <button
                              type="button"
                              @click="$emit('assign-thread', { threadId: thread.threadId, assignedToUserId: currentUser?._id || currentUser?.id || null })"
                              :class="[
                                'w-full text-left px-3 py-1.5 text-xs',
                                active ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
                              ]"
                            >{{ t('common.formAssignToMe') }}</button>
                          </MenuItem>
                          <MenuItem v-slot="{ active }">
                            <button
                              type="button"
                              @click="$emit('unassign-thread', { threadId: thread.threadId })"
                              :class="[
                                'w-full text-left px-3 py-1.5 text-xs',
                                active ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
                              ]"
                            >{{ t('inbox.emailThreadCardUnassign') }}</button>
                          </MenuItem>
                          <MenuItem v-slot="{ active }">
                            <button
                              type="button"
                              @click="openTagManager($event)"
                              :class="[
                                'w-full text-left px-3 py-1.5 text-xs',
                                active ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
                              ]"
                            >{{ t('inbox.emailThreadCardAddTag') }}</button>
                          </MenuItem>
                          <MenuItem v-slot="{ active }">
                            <button
                              type="button"
                              @click="$emit('create-case', msg)"
                              :class="[
                                'w-full text-left px-3 py-1.5 text-xs',
                                active ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
                              ]"
                            >{{ t('inbox.emailThreadCardCreateCase') }}</button>
                          </MenuItem>
                        </div>
                      </MenuItems>
                    </transition>
                  </Menu>
                </div>
              </div>

              <!-- Message body -->
              <div
                class="max-w-[72ch] text-sm leading-[1.55] text-gray-700 dark:text-gray-300 break-words prose prose-sm dark:prose-invert max-w-none [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 dark:[&_blockquote]:border-gray-600 [&_blockquote]:bg-gray-50 dark:[&_blockquote]:bg-gray-800/60 [&_blockquote]:px-3 [&_blockquote]:py-2 [&_blockquote]:my-2 [&_blockquote[data-collapsed='true']]:cursor-pointer [&_blockquote[data-collapsed='true']]:py-1.5 [&_blockquote[data-collapsed='true']]:text-gray-500 [&_blockquote[data-collapsed='true']>[data-quote-placeholder='true']]:block [&_blockquote[data-collapsed='true']>[data-quote-placeholder='true']]:font-semibold [&_blockquote[data-collapsed='true']>[data-quote-placeholder='true']]:tracking-wide [&_blockquote[data-collapsed='true']>*:not([data-quote-placeholder='true'])]:hidden"
                @click="handleRenderedBodyClick"
                v-html="renderMessageBody(msg.body)"
              />

              <!-- Attachments -->
              <div v-if="msg.attachments && msg.attachments.length > 0" class="mt-3 grid gap-2.5">
                <component
                  v-for="(att, ai) in msg.attachments"
                  :key="ai"
                  :is="getCommunicationAttachmentHref(att) ? 'a' : 'div'"
                  :href="getCommunicationAttachmentHref(att) || undefined"
                  :role="getCommunicationAttachmentHref(att) ? undefined : 'button'"
                  :tabindex="getCommunicationAttachmentHref(att) ? undefined : 0"
                  target="_blank"
                  rel="noopener noreferrer"
                  :class="[
                    'group/attachment block overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 transition',
                    isEmailImageAttachment(att) ? '' : 'p-2.5',
                    isEmailImageAttachment(att)
                      ? 'cursor-pointer'
                      : 'hover:-translate-y-px hover:border-indigo-300 hover:shadow-sm dark:hover:border-indigo-500'
                  ]"
                  @click="!getCommunicationAttachmentHref(att) && handleEmailAttachmentClick($event, att)"
                  @keydown.enter="!getCommunicationAttachmentHref(att) && handleEmailAttachmentClick($event, att)"
                >
                  <div
                    v-if="isEmailImageAttachment(att)"
                    class="relative max-h-[240px] overflow-hidden bg-slate-50 dark:bg-gray-800"
                  >
                    <img
                      v-if="getEmailAttachmentDisplayUrl(att)"
                      :src="getEmailAttachmentDisplayUrl(att)"
                      :alt="getEmailAttachmentName(att)"
                      class="block max-h-[240px] w-full object-contain"
                      loading="lazy"
                    />
                    <div
                      v-else
                      class="flex h-32 items-center justify-center text-xs text-gray-500 dark:text-gray-400"
                    >
                      {{ t('inbox.emailThreadCardAttachment') }}
                    </div>
                    <div class="flex items-center justify-between gap-2 border-t border-gray-100 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                      <span class="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{{ getEmailAttachmentName(att) }}</span>
                    </div>
                  </div>
                  <div v-else class="flex items-center gap-2.5">
                    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                      <PaperClipIcon class="w-4 h-4" />
                    </div>
                    <div class="min-w-0 flex flex-col gap-0.5">
                      <span class="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{{ getEmailAttachmentName(att) }}</span>
                      <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('inbox.emailThreadCardAttachment') }}</span>
                    </div>
                  </div>
                </component>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { EnvelopeIcon, ChevronRightIcon, PaperClipIcon, ArrowUturnLeftIcon, PlusIcon } from '@heroicons/vue/24/outline';
import Avatar from '@/components/common/Avatar.vue';
import RecordTagPopover from '@/components/record-page/RecordTagPopover.vue';
import {
  getCommunicationAttachmentHref,
  downloadCommunicationAttachment,
  fetchCommunicationAttachmentBlob,
  isOciCommunicationStoragePath
} from '@/utils/communicationAttachments';

const props = defineProps({
  thread: {
    type: Object,
    required: true
  },
  expanded: {
    type: Boolean,
    default: false
  },
  currentUser: {
    type: Object,
    default: null
  },
  /** When true, reduces padding (for use inside ActivityTimeline) */
  compact: {
    type: Boolean,
    default: false
  },
  formatDate: {
    type: Function,
    required: true
  },
  formatFullDate: {
    type: Function,
    default: null
  },
  onTimestampPointerUp: {
    type: Function,
    default: null
  }
});

const { t } = useI18n();

const handleTimestampPointerUp = (event, date) => {
  if (typeof props.onTimestampPointerUp === 'function') {
    props.onTimestampPointerUp(event, date);
  }
};

const emit = defineEmits(['toggle', 'create-task', 'create-case', 'assign-thread', 'unassign-thread', 'add-tag', 'remove-tag', 'reply', 'toggle-done']);
const showTagManager = ref(false);
const tagPopoverRef = ref(null);
const tagPopoverAnchorEl = ref(null);

const threadTagRecord = computed(() => ({
  _id: props.thread?.threadId || '',
  tags: Array.isArray(props.thread?.tags) ? props.thread.tags : []
}));

async function persistThreadTags(nextTagNames) {
  const current = new Set((props.thread?.tags || []).map((t) => String(t || '').trim().toLowerCase()).filter(Boolean));
  const next = new Set((nextTagNames || []).map((t) => String(t || '').trim().toLowerCase()).filter(Boolean));
  const threadId = props.thread?.threadId;
  if (!threadId) return;
  const toAdd = [...next].filter((t) => !current.has(t));
  const toRemove = [...current].filter((t) => !next.has(t));
  toAdd.forEach((tag) => emit('add-tag', { threadId, tag }));
  toRemove.forEach((tag) => emit('remove-tag', { threadId, tag }));
}

const isSingleMessageThread = computed(() => (
  Array.isArray(props.thread?.messages) && props.thread.messages.length <= 1
));
const singleMessage = computed(() => {
  if (!isSingleMessageThread.value) return null;
  return props.thread?.messages?.[0] || null;
});

function extractEmailAddress(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/<([^>]+)>/);
  const candidate = (match?.[1] || raw).trim().toLowerCase();
  return candidate.includes('@') ? candidate : '';
}

function extractEmailList(values) {
  if (!Array.isArray(values)) return [];
  return values.map(extractEmailAddress).filter(Boolean);
}

function uniqueEmails(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function normalizeReplySubject(subject) {
  const raw = String(subject || '').trim();
  if (!raw) return 'Re:';
  return /^re:/i.test(raw) ? raw : `Re: ${raw}`;
}

function buildReplyPayload(msg, options = {}) {
  if (!msg || typeof msg !== 'object') return null;
  const replyAll = options.replyAll === true;
  const userEmail = extractEmailAddress(props.currentUser?.email);
  const inboundSender = extractEmailAddress(msg.fromAddress);
  const outboundRecipients = extractEmailList(msg.toAddresses);
  const outboundCc = extractEmailList(msg.ccAddresses);

  let to = '';
  let cc = '';
  if (msg.direction === 'inbound') {
    to = inboundSender;
    if (replyAll) {
      const ccList = uniqueEmails(
        [...extractEmailList(msg.toAddresses), ...extractEmailList(msg.ccAddresses)].filter(
          (email) => email !== to && email !== userEmail
        )
      );
      cc = ccList.join(', ');
    }
  } else {
    to = outboundRecipients[0] || inboundSender;
    if (replyAll) {
      const ccList = uniqueEmails(
        [...outboundRecipients.slice(1), ...outboundCc].filter(
          (email) => email !== to && email !== userEmail
        )
      );
      cc = ccList.join(', ');
    }
  }
  const quotedHeader = `On ${props.formatDate(msg.sentAt || msg.receivedAt)}, ${getMessageSenderLabel(msg)} wrote:`;
  const quotedBodyHtml = buildQuotedBodyHtml(msg.body);
  const quotedBlockHtml = `<blockquote data-reply-quote="true" data-collapsed="true">${quotedBodyHtml}</blockquote>`;
  return {
    to,
    ...(cc ? { cc } : {}),
    subject: normalizeReplySubject(msg.subject),
    body: `<p><br></p><p>${escapeHtml(quotedHeader)}</p>${quotedBlockHtml}`,
    parentCommunicationId: msg._id
  };
}

function shouldShowReplyAll(msg) {
  if (!msg || typeof msg !== 'object') return false;
  const replyAllPayload = buildReplyPayload(msg, { replyAll: true });
  if (!replyAllPayload?.to) return false;
  const cc = String(replyAllPayload.cc || '').trim();
  return cc.length > 0;
}

function triggerSingleReply() {
  const msg = singleMessage.value;
  if (!msg) return;
  const payload = buildReplyPayload(msg);
  if (!payload?.to) return;
  emit('reply', payload);
}

function triggerSingleReplyAll() {
  const msg = singleMessage.value;
  if (!msg) return;
  const payload = buildReplyPayload(msg, { replyAll: true });
  if (!payload?.to) return;
  emit('reply', payload);
}

function getLatestThreadMessage() {
  const msgs = Array.isArray(props.thread?.messages) ? props.thread.messages : [];
  if (msgs.length === 0) return null;
  return msgs[msgs.length - 1];
}

function triggerThreadReply(replyAll = false) {
  const latest = getLatestThreadMessage();
  if (!latest) return;
  const payload = buildReplyPayload(latest, { replyAll });
  if (!payload?.to) return;
  // Keyboard shortcuts on focused thread header:
  // - r: reply
  // - a: reply all
  // - d: done / reopen
  emit('reply', payload);
}

function getMessageBody(body) {
  if (!body || typeof body !== 'string') return '(no content)';
  const t = body
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  return t.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim() || '(no content)';
}

function sanitizeHtml(html) {
  const raw = String(html || '');
  if (!raw.trim()) return '<p>(no content)</p>';

  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'text/html');

  doc.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((el) => el.remove());

  doc.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || '');
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        return;
      }
      if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(value)) {
        el.removeAttribute(attr.name);
      }
    });
  });

  doc.querySelectorAll('blockquote[data-collapsed="true"]').forEach((el) => {
    el.setAttribute('title', 'Show quoted text');
    if (!el.querySelector('[data-quote-placeholder="true"]')) {
      const marker = doc.createElement('div');
      marker.setAttribute('data-quote-placeholder', 'true');
      marker.textContent = '...';
      el.prepend(marker);
    }
  });
  doc.querySelectorAll('blockquote[data-collapsed="false"]').forEach((el) => {
    el.setAttribute('title', 'Hide quoted text');
  });

  return doc.body.innerHTML || '<p>(no content)</p>';
}

function renderMessageBody(body) {
  const raw = String(body || '').trim();
  if (!raw) return '(no content)';
  if (/<[^>]+>/.test(raw)) return sanitizeHtml(raw);
  return `<p>${escapeHtml(getMessageBody(raw)).replace(/\n/g, '<br>')}</p>`;
}

function handleRenderedBodyClick(event) {
  const target = event?.target;
  if (!(target instanceof Element)) return;
  const quote = target.closest('blockquote[data-collapsed]');
  if (!quote) return;
  const current = String(quote.getAttribute('data-collapsed') || 'false').toLowerCase() === 'true';
  const nextCollapsed = current ? 'false' : 'true';
  quote.setAttribute('data-collapsed', nextCollapsed);
  quote.setAttribute('title', nextCollapsed === 'true' ? 'Show quoted text' : 'Hide quoted text');
}

function openTagManager(event) {
  const target = event?.currentTarget;
  if (target instanceof HTMLElement) {
    tagPopoverAnchorEl.value = target;
  }
  showTagManager.value = !showTagManager.value;
}

function handleDocumentPointerDown(event) {
  if (!showTagManager.value) return;
  const target = event?.target;
  if (!(target instanceof Node)) return;
  const panelEl = tagPopoverRef.value;
  const anchorEl = tagPopoverAnchorEl.value;
  if (panelEl instanceof HTMLElement && panelEl.contains(target)) return;
  if (anchorEl instanceof HTMLElement && anchorEl.contains(target)) return;
  showTagManager.value = false;
}

function handleDocumentKeyDown(event) {
  if (!showTagManager.value) return;
  const key = String(event?.key || '').toLowerCase();
  if (key !== 'escape') return;
  showTagManager.value = false;
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown, true);
  document.addEventListener('keydown', handleDocumentKeyDown, true);
});

const ociImageUrls = ref({});

async function ensureOciImagePreview(att) {
  if (!isOciCommunicationStoragePath(att?.storagePath)) return;
  if (!isEmailImageAttachment(att)) return;
  if (ociImageUrls.value[att.storagePath]) return;
  try {
    const { blob } = await fetchCommunicationAttachmentBlob(att.storagePath, {
      disposition: 'inline',
      fileName: getEmailAttachmentName(att),
      contentType: att.fileType || att.mimeType || att.mimetype
    });
    ociImageUrls.value = { ...ociImageUrls.value, [att.storagePath]: URL.createObjectURL(blob) };
  } catch {
    /* preview optional */
  }
}

async function handleEmailAttachmentClick(event, att) {
  if (getCommunicationAttachmentHref(att)) return;
  event?.preventDefault?.();
  if (isEmailImageAttachment(att)) {
    await ensureOciImagePreview(att);
    const url = ociImageUrls.value[att.storagePath];
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  await downloadCommunicationAttachment(att);
}

function preloadVisibleOciImages() {
  if (!props.expanded) return;
  const messages = props.thread?.messages || [];
  for (const msg of messages) {
    for (const att of msg.attachments || []) {
      void ensureOciImagePreview(att);
    }
  }
}

watch(() => props.expanded, (expanded) => {
  if (expanded) preloadVisibleOciImages();
}, { immediate: true });

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
  document.removeEventListener('keydown', handleDocumentKeyDown, true);
  for (const url of Object.values(ociImageUrls.value)) {
    if (url) URL.revokeObjectURL(url);
  }
});

function shouldShowPriorityChip(threadLike) {
  const triage = threadLike?.triage;
  if (!triage) return false;
  if (triage.slaHint === 'overdue' || triage.slaHint === 'reply_due_soon') return false;
  return triage.priorityHint === 'high' || triage.priorityHint === 'medium';
}

function hasStrongDeliveryRisk(threadLike) {
  const flags = Array.isArray(threadLike?.triage?.riskFlags) ? threadLike.triage.riskFlags : [];
  return flags.includes('has_bounce') || flags.includes('has_complaint');
}

function shouldShowHeaderChips(threadLike) {
  const hasTriageChip =
    shouldShowPriorityChip(threadLike)
    || threadLike?.triage?.slaHint === 'overdue'
    || threadLike?.triage?.slaHint === 'reply_due_soon'
    || hasStrongDeliveryRisk(threadLike);
  const hasAssigneeChip = Boolean(threadLike?.assignedToDisplay);
  const hasTagChip = Array.isArray(threadLike?.tags) && threadLike.tags.length > 0;
  return hasTriageChip || hasAssigneeChip || hasTagChip;
}

function isAssignedToCurrentUser(threadLike) {
  const currentUserId = props.currentUser?._id || props.currentUser?.id;
  if (!currentUserId || !threadLike?.assignedToUserId) return false;
  return String(threadLike.assignedToUserId) === String(currentUserId);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isLikelyHtml(value) {
  const raw = String(value || '');
  return /<[^>]+>/.test(raw);
}

function plainTextToHtml(value) {
  const text = String(value || '').replace(/\r\n/g, '\n').trim();
  if (!text) return '<p>(no content)</p>';

  const lines = text.split('\n');
  const out = [];
  let depth = 0;

  const setDepth = (nextDepth) => {
    while (depth < nextDepth) {
      out.push('<blockquote data-type="reply-quote-nested" style="margin:8px 0 0;padding:8px 10px;border-left:3px solid #d1d5db;background:#f9fafb;">');
      depth += 1;
    }
    while (depth > nextDepth) {
      out.push('</blockquote>');
      depth -= 1;
    }
  };

  for (const rawLine of lines) {
    const line = String(rawLine || '');
    const match = line.match(/^(\s*>+)\s?(.*)$/);
    const lineDepth = match ? (match[1].match(/>/g) || []).length : 0;
    const content = match ? match[2] : line;
    setDepth(lineDepth);
    out.push(content.trim() ? `<p>${escapeHtml(content)}</p>` : '<p><br></p>');
  }

  setDepth(0);
  return out.join('');
}

function buildQuotedBodyHtml(value) {
  const raw = String(value || '').trim();
  if (!raw) return '<p>(no content)</p>';
  if (isLikelyHtml(raw)) return raw;
  return plainTextToHtml(raw);
}

function getMessageSenderLabel(msg) {
  if (msg.direction === 'outbound') {
    const u = props.currentUser;
    if (u) {
      const first = u.firstName || u.first_name || '';
      const last = u.lastName || u.last_name || '';
      if (first || last) return `${first} ${last}`.trim();
      if (u.username) return u.username;
      if (u.email) return u.email;
    }
    return 'You';
  }
  const from = msg.fromAddress || '';
  const match = from.match(/^([^<]+)\s*<[^>]+>$/);
  if (match) return match[1].trim();
  return from || 'Unknown';
}

function getMessageInitials(msg) {
  if (msg.direction === 'outbound' && props.currentUser) {
    const u = props.currentUser;
    const first = u.firstName || u.first_name || '';
    const last = u.lastName || u.last_name || '';
    if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
    if (first) return first[0].toUpperCase();
    if (u.email) return u.email[0].toUpperCase();
    return 'Y';
  }
  const from = msg.fromAddress || '';
  const email = from.replace(/^[^<]*<([^>]+)>.*$/, '$1').trim() || from;
  return email[0]?.toUpperCase() || '?';
}

function getEmailAttachmentDisplayUrl(att) {
  const href = getCommunicationAttachmentHref(att);
  if (href) return href;
  return ociImageUrls.value[att?.storagePath] || '';
}

function getEmailAttachmentName(att) {
  return att?.fileName || att?.name || 'Attachment';
}

function isEmailImageAttachment(att) {
  if (!att) return false;
  const mime = (att.mimeType || att.mimetype || att.fileType || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  const name = getEmailAttachmentName(att).toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name);
}
</script>
