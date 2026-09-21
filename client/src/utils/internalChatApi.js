import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch } from '@/config/apiBase';

export async function fetchChatTeammates() {
  const res = await apiClient.get('/internal-chat/teammates', {
    params: { limit: 200 },
    cache: 'no-store',
  });
  return Array.isArray(res?.data?.users) ? res.data.users : [];
}

export async function fetchChatSpaces() {
  const res = await apiClient.get('/internal-chat/spaces');
  return Array.isArray(res?.data?.spaces) ? res.data.spaces : [];
}

export async function createChatChannel({ name, topic, isPrivate, memberIds }) {
  const res = await apiClient.post('/internal-chat/spaces/channels', {
    name,
    topic,
    isPrivate,
    memberIds,
  });
  return res?.data?.space || null;
}

export async function joinChatChannel(spaceId) {
  const res = await apiClient.post(`/internal-chat/spaces/${spaceId}/join`, {});
  return res?.data?.space || null;
}

export async function fetchChatMembers(spaceId) {
  const res = await apiClient.get(`/internal-chat/spaces/${spaceId}/members`);
  return {
    spaceId: res?.data?.spaceId ? String(res.data.spaceId) : String(spaceId || ''),
    spaceType: res?.data?.spaceType || null,
    canInvite: res?.data?.canInvite === true,
    canRemoveOthers: res?.data?.canRemoveOthers === true,
    canLeave: res?.data?.canLeave === true,
    currentUserRole: res?.data?.currentUserRole || 'member',
    memberCount: Number(res?.data?.memberCount) || 0,
    members: Array.isArray(res?.data?.members) ? res.data.members : [],
  };
}

export async function inviteChatMembers(spaceId, memberIds) {
  const res = await apiClient.post(`/internal-chat/spaces/${spaceId}/members`, { memberIds });
  return res?.data || null;
}

export async function removeChatMember(spaceId, userId) {
  const res = await apiClient.delete(`/internal-chat/spaces/${spaceId}/members/${userId}`);
  return res?.data || null;
}

export async function renameChatChannel(spaceId, { name, topic } = {}) {
  const res = await apiClient.patch(`/internal-chat/spaces/${spaceId}`, { name, topic });
  return res?.data?.space || null;
}

export async function createChatDm(userId) {
  const res = await apiClient.post('/internal-chat/spaces/dms', { userId });
  return res?.data?.space || null;
}

export async function createChatGroupDm(memberIds) {
  const res = await apiClient.post('/internal-chat/spaces/group-dms', { memberIds });
  return res?.data?.space || null;
}

export async function discussRecord({ moduleKey, recordId }) {
  const res = await apiClient.post('/internal-chat/spaces/discuss', { moduleKey, recordId });
  return res?.data || null;
}

/**
 * Open (or create) a record-linked Internal Chat space and navigate to it.
 * @returns {Promise<string|null>} spaceId when opened
 */
export async function openRecordDiscussChat({
  moduleKey,
  recordId,
  openTab,
  router,
  tabTitle = 'Chat',
}) {
  const key = String(moduleKey || '').toLowerCase();
  const id = String(recordId || '');
  if (!key || !id) return null;
  const result = await discussRecord({ moduleKey: key, recordId: id });
  const spaceId = result?.space?._id ? String(result.space._id) : null;
  if (!spaceId) return null;
  const path = `/internal-chat?spaceId=${encodeURIComponent(spaceId)}`;
  if (typeof openTab === 'function') {
    openTab(path, {
      title: tabTitle,
      icon: 'chat-bubble-oval-left-ellipsis',
      insertAdjacent: true,
    });
  } else if (router) {
    router.push({ path: '/internal-chat', query: { spaceId } });
  }
  return spaceId;
}

export async function fetchChatMessages(spaceId, { threadRootId, before, aroundMessageId, limit } = {}) {
  const params = {};
  if (threadRootId) params.threadRootId = threadRootId;
  if (before) params.before = before;
  if (aroundMessageId) params.aroundMessageId = aroundMessageId;
  if (limit) params.limit = limit;
  const res = await apiClient.get(`/internal-chat/spaces/${spaceId}/messages`, { params });
  return {
    space: res?.data?.space || null,
    messages: Array.isArray(res?.data?.messages) ? res.data.messages : [],
    pinnedMessages: Array.isArray(res?.data?.pinnedMessages) ? res.data.pinnedMessages : [],
    readState: res?.data?.readState || { mode: 'private', memberCount: 0, members: [] },
    focus: res?.data?.focus || null,
  };
}

export async function sendChatMessage(spaceId, {
  body,
  threadRootId,
  quoteMessageId,
  mentionUserIds,
  recordRefs,
  attachments,
}) {
  const res = await apiClient.post(`/internal-chat/spaces/${spaceId}/messages`, {
    body,
    threadRootId,
    quoteMessageId,
    mentionUserIds,
    recordRefs,
    attachments,
  });
  return res?.data?.message || null;
}

export async function markChatRead(spaceId, messageId = null) {
  const res = await apiClient.post(`/internal-chat/spaces/${spaceId}/read`, { messageId });
  return res?.data || null;
}

export async function searchChatMessages({ q, spaceId, limit } = {}) {
  const res = await apiClient.get('/internal-chat/search', {
    params: { q, spaceId, limit },
  });
  return Array.isArray(res?.data?.results) ? res.data.results : [];
}

export async function toggleChatReaction(spaceId, messageId, emoji) {
  const res = await apiClient.post(
    `/internal-chat/spaces/${spaceId}/messages/${messageId}/reactions`,
    { emoji }
  );
  return res?.data || null;
}

export async function publishChatTyping(spaceId) {
  await apiClient.post(`/internal-chat/spaces/${spaceId}/typing`, {});
}

export async function setChatPresence(spaceId) {
  const res = await apiClient.post(`/internal-chat/spaces/${spaceId}/presence`, { spaceId });
  return res?.data?.viewers || [];
}

export async function pinChatSpace(spaceId, pin = true) {
  const res = await apiClient.post(`/internal-chat/spaces/${spaceId}/pin`, { pin });
  return res?.data || null;
}

export async function muteChatSpace(spaceId, { muted = true, durationKey = 'forever' } = {}) {
  const res = await apiClient.post(`/internal-chat/spaces/${spaceId}/mute`, { muted, durationKey });
  return res?.data || null;
}

export async function markChatSpaceUnread(spaceId, { messageId } = {}) {
  const res = await apiClient.post(`/internal-chat/spaces/${spaceId}/unread`, {
    ...(messageId ? { messageId } : {}),
  });
  return res?.data || null;
}

export async function pinChatMessage(spaceId, messageId, pin = true) {
  const res = await apiClient.post(
    `/internal-chat/spaces/${spaceId}/messages/${messageId}/pin`,
    { pin }
  );
  return res?.data || null;
}

export async function editChatMessage(spaceId, messageId, { body, mentionUserIds } = {}) {
  const res = await apiClient.patch(`/internal-chat/spaces/${spaceId}/messages/${messageId}`, {
    body,
    mentionUserIds,
  });
  return res?.data?.message || null;
}

export async function deleteChatMessage(spaceId, messageId) {
  await apiClient.delete(`/internal-chat/spaces/${spaceId}/messages/${messageId}`);
}

export async function exportChatSpace(spaceId) {
  const res = await apiClient.get(`/internal-chat/spaces/${spaceId}/export`);
  return res;
}

export async function fetchChatSettings() {
  const res = await apiClient.get('/internal-chat/settings');
  return res?.data || { retentionDays: 0, notifyChannelMessages: false, seenReceiptsMode: 'private' };
}

export async function updateChatSettings(patch) {
  const res = await apiClient.put('/internal-chat/settings', patch);
  return res?.data || null;
}

/**
 * Upload a file for the space; returns attachment metadata to pass into sendChatMessage.
 */
export async function uploadChatAttachment(spaceId, file, token) {
  const form = new FormData();
  form.append('file', file);
  const url = getApiUrlForFetch(`/api/internal-chat/spaces/${spaceId}/attachments`);
  const res = await fetch(url, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
    credentials: 'include',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.message || 'Upload failed');
    err.response = { data: json, status: res.status };
    throw err;
  }
  return json?.data || null;
}
