import { describe, expect, it } from 'vitest';
import {
  buildCaseEmailConversationItems,
  getCaseEmailMessageAvatarUser,
  isCaseEmailMessageActivity,
  type CaseEmailConversationItem
} from './caseEmailConversation';

describe('caseEmailConversation', () => {
  it('detects mailroom-backed email activities', () => {
    expect(
      isCaseEmailMessageActivity({
        activityType: 'channel_message_received',
        metadata: { mailroomMessageId: 'm1' }
      })
    ).toBe(true);
    expect(isCaseEmailMessageActivity({ activityType: 'comment' })).toBe(false);
  });

  it('merges threads and dedupes threaded communications', () => {
    const items = buildCaseEmailConversationItems({
      emailThreads: [
        {
          threadId: 't1',
          lastActivityAt: '2026-01-02T10:00:00Z',
          messages: [{ _id: 'comm-1', direction: 'inbound' }]
        }
      ],
      activities: [
        {
          _id: 'a1',
          activityType: 'status_changed',
          createdAt: '2026-01-01T09:00:00Z',
          metadata: { fromStatus: 'New', toStatus: 'Assigned' }
        },
        {
          _id: 'a2',
          activityType: 'email_sent',
          createdAt: '2026-01-02T09:30:00Z',
          metadata: { communicationId: 'comm-1' },
          message: 'dup'
        }
      ]
    });
    expect(items.some((i: CaseEmailConversationItem) => i.kind === 'system')).toBe(true);
    expect(items.some((i: CaseEmailConversationItem) => i.kind === 'message')).toBe(true);
    expect(items.filter((i: CaseEmailConversationItem) => i.kind === 'message')).toHaveLength(1);
  });

  it('dedupes mailroom timeline activities when email threads are present', () => {
    const items = buildCaseEmailConversationItems({
      emailThreads: [
        {
          threadId: 't1',
          messages: [
            {
              _id: 'comm-1',
              direction: 'inbound',
              fromAddress: 'customer@example.com',
              body: 'Yep',
              receivedAt: '2026-01-02T10:00:00Z'
            }
          ]
        }
      ],
      activities: [
        {
          _id: 'mailroom:m1',
          activityType: 'channel_message_received',
          createdAt: '2026-01-02T10:00:00Z',
          message: 'Yep',
          metadata: {
            mailroomMessageId: 'm1',
            source: 'mailroom'
          },
          actorName: 'Customer'
        }
      ]
    });
    expect(items.filter((i: CaseEmailConversationItem) => i.kind === 'message')).toHaveLength(1);
    expect(items[0]?.kind).toBe('message');
    if (items[0]?.kind === 'message') {
      expect(items[0].message._id).toBe('comm-1');
    }
  });

  it('includes internal comments in the conversation feed', () => {
    const items = buildCaseEmailConversationItems({
      activities: [
        {
          _id: 'ic1',
          activityType: 'comment',
          internal: true,
          createdAt: '2026-01-02T11:00:00Z',
          message: 'Hello @[Jane](user:u1)',
          actorName: 'Support Agent'
        }
      ]
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe('internal_comment');
  });

  it('keeps outbound agent identity on sentByUser when case assignee changes', () => {
    const avatar = getCaseEmailMessageAvatarUser(
      {
        direction: 'outbound',
        fromAddress: '"Agent A" <a@example.com>',
        sentByUser: { firstName: 'Agent', lastName: 'A', email: 'a@example.com' }
      },
      {
        assignedTo: { firstName: 'Agent', lastName: 'B', email: 'b@example.com' }
      }
    );
    expect(avatar?.firstName).toBe('Agent');
    expect(avatar?.lastName).toBe('A');
    expect(avatar?.email).toBe('a@example.com');
  });

  it('falls back to fromAddress for outbound when sentByUser is missing', () => {
    const avatar = getCaseEmailMessageAvatarUser(
      {
        direction: 'outbound',
        fromAddress: 'Original Sender <orig@example.com>'
      },
      {
        assignedTo: { firstName: 'New', lastName: 'Assignee', email: 'new@example.com' }
      }
    );
    expect(avatar?.firstName).toBe('Original');
    expect(avatar?.lastName).toBe('Sender');
    expect(avatar?.email).toBe('orig@example.com');
  });
});
