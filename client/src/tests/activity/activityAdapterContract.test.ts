import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';

import { buildRecordActivityUi } from '@/components/activity/useRecordActivityAdapter';
import { createTaskActivityUi } from '@/components/activity/adapters/taskActivityUiAdapter';
import { createDealActivityUi } from '@/components/activity/adapters/dealActivityUiAdapter';
import { ACTIVITY_UI_HANDLER_KEYS } from '@/components/activity/activityUiContract';

describe('activity adapter contract', () => {
  it('buildRecordActivityUi enforces stable defaults even with invalid overrides', () => {
    const ui = buildRecordActivityUi({
      currentUser: undefined,
      expandedTaskEmailThreads: undefined,
      editingCommentId: undefined,
      editingCommentText: 123,
      editingCommentAttachments: null,
      isEditingCommentDirty: 'yes',
      arbitraryFlag: true,
    });

    expect(ui.currentUser).toBeNull();
    expect(ui.expandedTaskEmailThreads).toBeInstanceOf(Set);
    expect(ui.editingCommentId).toBeNull();
    expect(ui.editingCommentText).toBe('');
    expect(ui.editingCommentAttachments).toEqual([]);
    expect(ui.isEditingCommentDirty).toBe(true);
    expect(ui.arbitraryFlag).toBe(true);

    for (const key of ACTIVITY_UI_HANDLER_KEYS) {
      const handler = ui[key];
      expect(typeof handler).toBe('function');
      if (typeof handler === 'function') {
        expect(() => handler()).not.toThrow();
      }
    }
  });

  it('createTaskActivityUi maps reactive task state into canonical ui contract', () => {
    const toggleTaskEmailThread = vi.fn();
    const createTaskFromEmailMessage = vi.fn();
    const saveEditComment = vi.fn();

    const taskUi = createTaskActivityUi({
      authStore: { user: { id: 'user-1' } },
      expandedTaskEmailThreads: ref(new Set(['thread-1'])),
      editingCommentId: ref('comment-7'),
      editingCommentText: ref('hello'),
      editingCommentAttachments: ref([{ id: 'a1' }]),
      isEditingCommentDirty: ref(true),

      setEditingCommentText: vi.fn(),
      setEditingCommentAttachments: vi.fn(),
      handleEditCommentFilesChange: vi.fn(),
      saveEditComment,
      handleSaveEditCommentClick: vi.fn(),
      cancelEditComment: vi.fn(),
      canEditComment: vi.fn(),
      startEditComment: vi.fn(),

      getInitials: vi.fn(),
      getAuthorName: vi.fn(),
      formatFullTimestamp: vi.fn(),
      formatRelativeActivityTime: vi.fn(),
      handleTimestampPointerUp: vi.fn(),
      highlightSearchText: vi.fn(),
      commentMentionsCurrentUser: vi.fn(),

      hasAttachmentUrl: vi.fn(),
      getAttachmentUrl: vi.fn(),
      isImageAttachment: vi.fn(),
      isSvgAttachment: vi.fn(),
      getAttachmentName: vi.fn(),
      downloadAttachment: vi.fn(),
      formatFileSize: vi.fn(),
      getAttachmentLabel: vi.fn(),

      hasCommentReactions: vi.fn(),
      getCommentReactions: vi.fn(),
      isCommentReactionSelected: vi.fn(),
      toggleCommentReaction: vi.fn(),
      handleShowCommentReactionTooltip: vi.fn(),
      handleHideCommentReactionTooltip: vi.fn(),
      setCommentReactionButtonRef: vi.fn(),
      toggleCommentReactionPicker: vi.fn(),

      openCommentThread: vi.fn(),
      getCommentThreadReplyCount: vi.fn(),
      getCommentThreadLatestReplyAuthor: vi.fn(),

      isFieldChangeSystemEvent: vi.fn(),
      getSystemEventActorLabel: vi.fn(),
      getSystemEventFieldLabel: vi.fn(),
      getSystemEventFromValue: vi.fn(),
      getSystemEventToValue: vi.fn(),
      getSystemEventMessage: vi.fn(),
      handleShowMore: vi.fn(),

      toggleTaskEmailThread,
      createTaskFromEmailMessage,
    });

    expect(taskUi.value.currentUser).toEqual({ id: 'user-1' });
    expect(taskUi.value.expandedTaskEmailThreads).toEqual(new Set(['thread-1']));
    expect(taskUi.value.editingCommentId).toBe('comment-7');
    expect(taskUi.value.editingCommentText).toBe('hello');
    expect(taskUi.value.editingCommentAttachments).toEqual([{ id: 'a1' }]);
    expect(taskUi.value.isEditingCommentDirty).toBe(true);
    expect(taskUi.value.saveEditComment).toBe(saveEditComment);
    expect(taskUi.value.toggleTaskEmailThread).toBe(toggleTaskEmailThread);
    expect(taskUi.value.createTaskFromEmailMessage).toBe(createTaskFromEmailMessage);
  });

  it('createDealActivityUi maps deal note handlers and exposes safe task-email noops', () => {
    const saveEditedNote = vi.fn();
    const cancelEditNote = vi.fn();
    const canEditNote = vi.fn();
    const startEditNote = vi.fn();

    const dealUi = createDealActivityUi({
      authStore: { user: { id: 'user-2' } },
      editingNoteId: ref('note-9'),
      editingNoteText: ref('deal note'),
      editingNoteAttachments: ref([{ id: 'f1' }]),
      isEditingCommentDirty: ref(false),

      setEditingCommentText: vi.fn(),
      setEditingCommentAttachments: vi.fn(),
      handleEditCommentFilesChange: vi.fn(),
      saveEditedNote,
      handleSaveEditCommentClick: vi.fn(),
      cancelEditNote,
      canEditNote,
      startEditNote,

      getInitials: vi.fn(),
      getAuthorName: vi.fn(),
      formatFullTimestamp: vi.fn(),
      formatRelativeActivityTime: vi.fn(),
      handleTimestampPointerUp: vi.fn(),
      highlightSearchText: vi.fn(),
      commentMentionsCurrentUser: vi.fn(),

      hasAttachmentUrl: vi.fn(),
      getAttachmentUrl: vi.fn(),
      isImageAttachment: vi.fn(),
      isSvgAttachment: vi.fn(),
      getAttachmentName: vi.fn(),
      downloadAttachment: vi.fn(),
      formatFileSize: vi.fn(),
      getAttachmentLabel: vi.fn(),

      hasCommentReactions: vi.fn(),
      getCommentReactions: vi.fn(),
      isCommentReactionSelected: vi.fn(),
      toggleCommentReaction: vi.fn(),
      handleShowCommentReactionTooltip: vi.fn(),
      handleHideCommentReactionTooltip: vi.fn(),
      setCommentReactionButtonRef: vi.fn(),
      toggleCommentReactionPicker: vi.fn(),

      openCommentThread: vi.fn(),
      getCommentThreadReplyCount: vi.fn(),
      getCommentThreadLatestReplyAuthor: vi.fn(),

      isFieldChangeSystemEvent: vi.fn(),
      getSystemEventActorLabel: vi.fn(),
      getSystemEventFieldLabel: vi.fn(),
      getSystemEventFromValue: vi.fn(),
      getSystemEventToValue: vi.fn(),
      getSystemEventMessage: vi.fn(),
      handleShowMore: vi.fn(),
    });

    expect(dealUi.value.currentUser).toEqual({ id: 'user-2' });
    expect(dealUi.value.editingCommentId).toBe('note-9');
    expect(dealUi.value.editingCommentText).toBe('deal note');
    expect(dealUi.value.editingCommentAttachments).toEqual([{ id: 'f1' }]);

    expect(dealUi.value.saveEditComment).toBe(saveEditedNote);
    expect(dealUi.value.cancelEditComment).toBe(cancelEditNote);
    expect(dealUi.value.canEditComment).toBe(canEditNote);
    expect(dealUi.value.startEditComment).toBe(startEditNote);

    const toggleTaskEmailThread = dealUi.value.toggleTaskEmailThread;
    const createTaskFromEmailMessage = dealUi.value.createTaskFromEmailMessage;
    expect(typeof toggleTaskEmailThread).toBe('function');
    expect(typeof createTaskFromEmailMessage).toBe('function');
    if (typeof toggleTaskEmailThread === 'function') {
      expect(() => toggleTaskEmailThread()).not.toThrow();
    }
    if (typeof createTaskFromEmailMessage === 'function') {
      expect(() => createTaskFromEmailMessage()).not.toThrow();
    }
  });
});
