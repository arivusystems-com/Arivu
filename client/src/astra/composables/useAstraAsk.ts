import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import {
  captureAstraAskInvoked,
  captureAstraActionCompleted,
  captureAstraActionRejected,
  type AstraSurface,
} from '@/config/posthogAi';
import { formatCurrencyValue } from '@/utils/currencyOptions';
import { dispatchRecordUpdated } from '@/utils/moduleListFreshness';
import { emitLocalDataChange } from '@/services/dataChangeRealtimeService';

function extractConfirmPayload(proposal: AstraProposal): Record<string, unknown> {
  const raw = proposal.fields;
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

function extractMutationPatch(proposal: AstraProposal): Record<string, unknown> | null {
  const payload = extractConfirmPayload(proposal);
  const nested = payload.fields;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  const skip = new Set(['moduleKey', 'recordId', 'id', 'action', 'confirmed', 'toolName']);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (skip.has(k) || v === undefined) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

function notifyAstraRecordMutation(
  moduleKey?: string,
  recordId?: string,
  op: 'update' | 'create' = 'update',
  patch: Record<string, unknown> | null = null,
) {
  const mod = String(moduleKey || '').trim().toLowerCase();
  const id = String(recordId || '').trim();
  if (!mod || !id) return;
  emitLocalDataChange({ moduleKey: mod, recordId: id, op, patch });
  dispatchRecordUpdated({ moduleKey: mod, recordId: id });
}

export interface AstraProposalDetail {
  label: string;
  value: string;
}

export interface AstraProposal {
  id: string;
  kind: string;
  label: string;
  rationale?: string;
  details?: AstraProposalDetail[];
  moduleKey?: string;
  recordId?: string;
  fields?: Record<string, unknown>;
  status?: 'pending' | 'completed' | 'dismissed';
  href?: string;
  navigateLabel?: string;
}

export type AstraSuggestion = string | { label: string; prompt: string };

export interface AstraAskResult {
  answer: string;
  blocks: import('@/astra/blocks/types').AstraUiBlock[];
  proposals: AstraProposal[];
  suggestions: AstraSuggestion[];
  conversationId?: string;
  conversationTitle?: string;
  agentKey?: string;
  agentName?: string;
  provider?: string;
  model?: string;
  raw?: Record<string, unknown>;
}

export interface AstraNbaItem {
  id: string;
  kind: string;
  label: string;
  rationale?: string;
  prompt?: string;
  moduleKey?: string;
  recordId?: string;
  iconKey?: string;
}

export interface AstraAskContext {
  moduleKey?: string;
  recordId?: string;
  recordName?: string;
  conversationId?: string;
  history?: Array<{ role: string; content: string }>;
  surface?: string;
}

export interface AstraConfirmResult {
  ok: boolean;
  message?: string;
  recordId?: string;
  moduleKey?: string;
  href?: string;
  navigateLabel?: string;
  raw?: Record<string, unknown>;
}

const ASK_PATH = '/ai/v2/ask';
const CONFIRM_PATH = '/ai/v2/actions/confirm';
const NBA_PATH = '/ai/v2/next-best-actions';

/** Astra is an optional surface — never tear down the CRM session on failure. */
const ASTRA_OPT_OPTS = { skipAuthLogout: true as const };

function toStringSafe(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function normalizeProposalDetails(source: unknown): AstraProposalDetail[] | undefined {
  if (!Array.isArray(source) || !source.length) return undefined;
  const rows = source
    .map((raw): AstraProposalDetail | null => {
      if (!raw || typeof raw !== 'object') return null;
      const item = raw as Record<string, unknown>;
      const label = toStringSafe(item.label).trim();
      const value = toStringSafe(item.value).trim();
      if (!label || !value) return null;
      return { label, value };
    })
    .filter((row): row is AstraProposalDetail => row !== null);
  return rows.length ? rows : undefined;
}

function detailsFromFields(kind: string, fields?: Record<string, unknown>): AstraProposalDetail[] | undefined {
  if (!fields || typeof fields !== 'object') return undefined;
  const rows: AstraProposalDetail[] = [];
  const push = (label: string, value: unknown) => {
    const v = toStringSafe(value).trim();
    if (v) rows.push({ label, value: v });
  };
  const related = fields.relatedTo as Record<string, unknown> | undefined;
  const contact = fields.relatedContact as Record<string, unknown> | undefined;
  const orgRef = fields.organizationRef as Record<string, unknown> | undefined;
  push('Title', fields.title || fields.name);
  if (fields.startDateTime) push('When', fields.startDateTime);
  if (fields.durationMinutes) push('Duration', `${fields.durationMinutes} min`);
  if (fields.dueDate) push('Due', fields.dueDate);
  if (fields.priority) push('Priority', fields.priority);
  if (fields.amount != null && fields.amount !== '') {
    push('Amount', formatCurrencyValue(fields.amount) || String(fields.amount));
  }
  if (fields.stage) push('Stage', fields.stage);
  push('Related', related?.name || related?.title || orgRef?.name);
  push('Contact', contact?.name || contact?.title);
  if (fields.description) push('Notes', fields.description);
  if (fields.to) push('To', fields.to);
  if (fields.subject) push('Subject', fields.subject);
  if (kind.includes('email') && !rows.length) return undefined;
  return rows.length ? rows : undefined;
}

function normalizeProposals(source: unknown): AstraProposal[] {
  if (!Array.isArray(source)) return [];
  return source
    .map((raw, index): AstraProposal | null => {
      if (!raw || typeof raw !== 'object') return null;
      const item = raw as Record<string, unknown>;
      const label = toStringSafe(item.label || item.summary).trim();
      if (!label) return null;
      const fields =
        item.fields && typeof item.fields === 'object'
          ? (item.fields as Record<string, unknown>)
          : item.payload && typeof item.payload === 'object'
            ? (item.payload as Record<string, unknown>)
            : undefined;
      const kind = toStringSafe(item.kind || item.toolName) || 'generic';
      return {
        id: toStringSafe(item.id) || `proposal-${index}`,
        kind,
        label,
        rationale: toStringSafe(item.rationale || item.guidance) || undefined,
        details: normalizeProposalDetails(item.details) || detailsFromFields(kind, fields),
        moduleKey: toStringSafe(item.moduleKey) || undefined,
        recordId: toStringSafe(item.recordId) || undefined,
        fields,
        status: toStringSafe(item.status) === 'completed'
          ? 'completed'
          : toStringSafe(item.status) === 'dismissed'
            ? 'dismissed'
            : 'pending',
        href: toStringSafe(item.href) || undefined,
        navigateLabel: toStringSafe(item.navigateLabel) || undefined,
      };
    })
    .filter((p): p is AstraProposal => p !== null);
}

function proposalsFromAskPayload(data: Record<string, unknown>): AstraProposal[] {
  const direct = normalizeProposals(data?.proposals ?? data?.actions);
  if (direct.length) return direct;

  const toolResult = data?.toolResult as Record<string, unknown> | undefined;
  if (toolResult?.type === 'confirm_action') {
    return normalizeProposals([toolResult]);
  }

  const workflow = data?.workflow as { steps?: Array<{ result?: unknown }> } | undefined;
  if (Array.isArray(workflow?.steps)) {
    return normalizeProposals(
      workflow.steps
        .map((step) => step?.result)
        .filter((result) => result && typeof result === 'object' && (result as { type?: string }).type === 'confirm_action'),
    );
  }

  return [];
}

function suggestionsFromAskPayload(data: Record<string, unknown>): AstraSuggestion[] {
  return normalizeSuggestions(data?.suggestions);
}

function normalizeSuggestions(source: unknown): AstraSuggestion[] {
  if (!Array.isArray(source)) return [];
  return source
    .map((s): AstraSuggestion | null => {
      if (typeof s === 'string') {
        const text = s.trim();
        return text || null;
      }
      if (s && typeof s === 'object') {
        const row = s as Record<string, unknown>;
        const prompt = toStringSafe(row.prompt || row.label || row.title).trim();
        const label = toStringSafe(row.label || row.title || row.prompt).trim();
        if (!prompt) return null;
        return label && label !== prompt ? { label, prompt } : prompt;
      }
      return null;
    })
    .filter((s): s is AstraSuggestion => s != null);
}

function normalizeNba(source: unknown): AstraNbaItem[] {
  if (!Array.isArray(source)) return [];
  return source
    .map((raw, index): AstraNbaItem | null => {
      if (!raw || typeof raw !== 'object') return null;
      const item = raw as Record<string, unknown>;
      const label = toStringSafe(item.label || item.title).trim();
      if (!label) return null;
      const input = item.input && typeof item.input === 'object'
        ? (item.input as Record<string, unknown>)
        : undefined;
      const prompt = toStringSafe(item.prompt || input?.query || label).trim() || label;
      return {
        id: toStringSafe(item.id) || `nba-${index}`,
        kind: toStringSafe(item.kind || item.tool) || 'generic',
        label,
        rationale: toStringSafe(item.rationale) || undefined,
        prompt,
        moduleKey: toStringSafe(item.moduleKey) || undefined,
        recordId: toStringSafe(item.recordId) || undefined,
        iconKey: toStringSafe(item.iconKey || item.icon) || undefined,
      };
    })
    .filter((n): n is AstraNbaItem => n !== null);
}

export function useAstraAsk(surface: AstraSurface = 'copilot') {
  const { t } = useI18n();

  const asking = ref(false);
  const confirming = ref(false);
  const error = ref('');

  async function askSync(prompt: string, context: AstraAskContext = {}): Promise<AstraAskResult | null> {
    const text = String(prompt || '').trim();
    if (!text || asking.value) return null;
    asking.value = true;
    error.value = '';
    captureAstraAskInvoked({
      surface,
      moduleKey: context.moduleKey,
      recordId: context.recordId,
      promptLength: text.length,
    });
    try {
      const data = (await apiClient.post(ASK_PATH, {
        query: text,
        surface,
        moduleKey: context.moduleKey,
        recordId: context.recordId,
        recordName: context.recordName,
        conversationId: context.conversationId,
        history: Array.isArray(context.history) ? context.history : undefined,
        // Do not force page module as search entity — "open deals" on a person
        // must search deals, not dump the people list.
        focus: context.recordId || context.moduleKey
          ? {
              kind: context.moduleKey,
              moduleKey: context.moduleKey,
              id: context.recordId,
              recordId: context.recordId,
              name: context.recordName || undefined,
            }
          : undefined,
      }, ASTRA_OPT_OPTS)) as Record<string, unknown>;
      return {
        answer: toStringSafe(data?.answer ?? data?.reply ?? data?.body),
        blocks: Array.isArray(data?.blocks) ? (data.blocks as import('@/astra/blocks/types').AstraUiBlock[]) : [],
        proposals: proposalsFromAskPayload(data),
        suggestions: suggestionsFromAskPayload(data),
        conversationId: toStringSafe(data?.conversationId) || context.conversationId,
        conversationTitle: toStringSafe(data?.conversationTitle) || undefined,
        agentKey: toStringSafe(data?.agentKey) || undefined,
        agentName: toStringSafe(data?.agentName) || undefined,
        provider: toStringSafe(data?.provider) || undefined,
        model: toStringSafe(data?.model) || undefined,
        raw: data,
      };
    } catch (err: unknown) {
      const e = err as { message?: string };
      error.value = e?.message || t('astra.failGeneric');
      return null;
    } finally {
      asking.value = false;
    }
  }

  async function confirmProposal(
    proposal: AstraProposal,
    context: { conversationId?: string } = {},
  ): Promise<AstraConfirmResult> {
    if (!proposal || confirming.value) return { ok: false };
    confirming.value = true;
    error.value = '';
    try {
      const confirmPayload = extractConfirmPayload(proposal);
      const data = (await apiClient.post(CONFIRM_PATH, {
        toolName: proposal.kind,
        proposalId: proposal.id,
        kind: proposal.kind,
        moduleKey: proposal.moduleKey
          || toStringSafe(confirmPayload.moduleKey)
          || undefined,
        recordId: proposal.recordId
          || toStringSafe(confirmPayload.recordId)
          || undefined,
        payload: confirmPayload,
        fields: confirmPayload,
        conversationId: context.conversationId,
        confirmed: true,
      }, ASTRA_OPT_OPTS)) as Record<string, unknown>;
      captureAstraActionCompleted({
        surface,
        actionKind: proposal.kind,
        actionId: proposal.id,
        moduleKey: proposal.moduleKey,
        recordId: toStringSafe(data?.recordId) || proposal.recordId,
      });
      const resolvedModuleKey = toStringSafe(data?.moduleKey)
        || proposal.moduleKey
        || toStringSafe(confirmPayload.moduleKey)
        || undefined;
      const resolvedRecordId = toStringSafe(data?.recordId)
        || proposal.recordId
        || toStringSafe(confirmPayload.recordId)
        || undefined;
      const resultObj = data?.result && typeof data.result === 'object'
        ? (data.result as Record<string, unknown>)
        : null;
      const resultRecord = resultObj?.record && typeof resultObj.record === 'object'
        ? (resultObj.record as Record<string, unknown>)
        : null;
      const patch = extractMutationPatch(proposal)
        || (resultRecord
          ? {
            ...(resultRecord.status != null ? { status: resultRecord.status } : {}),
            ...(resultRecord.title != null ? { title: resultRecord.title } : {}),
            ...(resultRecord.name != null ? { name: resultRecord.name } : {}),
          }
          : null);
      const op = /create/i.test(String(proposal.kind || '')) ? 'create' : 'update';
      notifyAstraRecordMutation(resolvedModuleKey, resolvedRecordId, op, patch && Object.keys(patch).length ? patch : null);
      return {
        ok: true,
        message: toStringSafe(data?.message) || undefined,
        recordId: resolvedRecordId,
        moduleKey: resolvedModuleKey || proposal.moduleKey,
        href: toStringSafe(data?.href) || undefined,
        navigateLabel: toStringSafe(data?.navigateLabel) || undefined,
        raw: data,
      };
    } catch (err: unknown) {
      const e = err as { message?: string };
      error.value = e?.message || t('astra.failGeneric');
      captureAstraActionRejected({
        surface,
        actionKind: proposal.kind,
        actionId: proposal.id,
        reason: error.value,
      });
      return { ok: false, message: error.value };
    } finally {
      confirming.value = false;
    }
  }

  async function fetchNba(context: AstraAskContext = {}): Promise<AstraNbaItem[]> {
    try {
      const data = (await apiClient.get(NBA_PATH, {
        params: {
          moduleKey: context.moduleKey,
          recordId: context.recordId,
          recordName: context.recordName,
          surface: context.surface || 'home',
        },
        ...ASTRA_OPT_OPTS,
      })) as Record<string, unknown>;
      return normalizeNba(data?.items ?? data?.cards ?? data?.nba ?? data);
    } catch {
      return [];
    }
  }

  return {
    asking,
    confirming,
    error,
    askSync,
    confirmProposal,
    fetchNba,
  };
}
