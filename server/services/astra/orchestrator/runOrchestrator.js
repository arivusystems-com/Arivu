'use strict';

/**
 * runOrchestrator — Astra v2 turn pipeline (workforce Phase A).
 *
 *   classify → seat → tool(s) → grounded answer → LLM polish → suggestions
 *
 * Unknown intent → clarifier (never invent open deals).
 */

const crypto = require('crypto');
const toolRegistry = require('../tools/toolRegistry');
const agentRegistry = require('../agents/agentRegistry');
const modelRouter = require('../models/modelRouter');
const { buildAnswerMessages, PROMPT_VERSION } = require('../prompts/promptLibrary');
const { runWorkflowAgent } = require('../agents/workflowAgent');
const { recordTurn } = require('../governance/audit');
function ensureBootstrapped() {
  // Call-time resolve — avoid circular bootstrap capturing undefined
  require('../bootstrap').ensureBootstrapped();
}
const sessionMemory = require('../memory/sessionMemory');
const { buildUiBlocks, wantsChartAsk } = require('../experience/buildUiBlocks');
const { applyAskFidelity } = require('../experience/answerFidelity');
const { wantsRecordBrief, buildRecordStatusBrief } = require('../experience/buildRecordStatusBrief');
const { synthesizePipelineNarrative } = require('../experience/coworkerSynthesis');
const {
  classifyIntent,
  classifyIntentDetailed,
  extractTaskTitle,
  extractEventTitle,
  extractEventSchedule,
  extractCaseTitle,
  extractRecordUpdatePatch,
} = require('./intentRegistry');
const {
  classifyIntentPrecise,
  INTENT_TOOL_ROUTE,
  scheduleFromLlmSlots,
  resolveEventTitle,
} = require('./intentLlmClassify');
const { pickAgentWithLlm } = require('./pickAgentWithLlm');
const { resolveEventCreateSlots, isGarbageTitle } = require('./extractEventSlots');
const { runAgentToolLoop } = require('./agentLoop');
const {
  planSpecialistsWithLlm,
  mergeSpecialistOutputs,
  isMissionControlKey,
} = require('./missionControl');
const {
  refersToSameFocus,
  resolveTurnFocus,
} = require('../context/resolveTurnFocus');

const { buildEmailDraftTurn } = require('../experience/buildEmailDraftTurn');
const { buildSituationContext } = require('../context/situationContext');
const { runThinPlaybook } = require('./runThinPlaybook');
const { extractSearchTerm } = require('../tools/families');
const { buildProposalDetails } = require('../utils/findModuleCreateIssues');

const FOCUS_BRIEF_ENTITIES = Object.freeze([
  'organizations', 'deals', 'people', 'cases', 'quotes', 'tasks',
]);

/**
 * When the user names a quote number (QT-0003) but the client omitted focus,
 * resolve the record so we still ground the turn.
 */
async function resolveQuoteFocusFromQuery(query, organizationId, deps = {}) {
  const match = String(query || '').match(/\b(QT[-\s]?\d{3,})\b/i);
  if (!match || !organizationId) return null;
  const raw = match[1].replace(/\s+/g, '').toUpperCase();
  const normalized = raw.includes('-') ? raw : raw.replace(/^QT/, 'QT-');
  try {
    const Quote = deps.models?.Quote || require('../../../models/Quote');
    const row = await Quote.findOne({
      organizationId,
      deletedAt: null,
      quoteNumber: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    })
      .select('_id quoteNumber quoteTitle status')
      .lean();
    if (!row) return null;
    return {
      kind: 'quotes',
      moduleKey: 'quotes',
      id: String(row._id),
      recordId: String(row._id),
      name: row.quoteTitle || row.quoteNumber || normalized,
    };
  } catch {
    return null;
  }
}

function buildChitchatAnswer(query) {
  const q = String(query || '').toLowerCase();
  if (/\b(date|day)\b/.test(q)) {
    const now = new Date();
    const formatted = now.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return `Today is ${formatted}.`;
  }
  if (/\btime\b/.test(q)) {
    return `It's ${new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`;
  }
  return "Hey — I'm Astra. Ask me about deals, tasks, events, cases, or people and I'll pull what's in Arivu.";
}

function buildClarifyTurn(query) {
  const answer = "I'm not sure what you need yet — pick one of these and I'll take it from there.";
  const suggestions = [
    'List my open deals',
    'Show overdue tasks',
    'Draft an email',
    'Create a task',
    'Book a meeting',
  ];
  return {
    answer,
    blocks: [{
      type: 'clarify',
      prompt: answer,
      query: String(query || ''),
      options: suggestions,
    }],
    suggestions,
  };
}

function confirmationToProposal(confirmation, kind, extras = {}) {
  if (!confirmation || confirmation.type !== 'confirm_action') return null;
  const payload = extras.payload || confirmation.payload || {};
  const moduleKey = confirmation.moduleKey
    || extras.moduleKey
    || payload.moduleKey
    || (kind === 'calendar.createEvent' ? 'events'
      : kind === 'crm.tasks.create' ? 'tasks'
        : kind === 'crm.deals.create' ? 'deals'
          : kind === 'crm.cases.create' ? 'cases'
            : kind === 'crm.people.create' ? 'people'
              : kind === 'crm.organizations.create' ? 'organizations'
                : kind === 'module.update' || kind === 'module.create' ? (payload.moduleKey || null)
                  : null);
  const details = Array.isArray(extras.details) && extras.details.length
    ? extras.details
    : (Array.isArray(confirmation.details) && confirmation.details.length
      ? confirmation.details
      : buildProposalDetails(moduleKey, payload));
  return {
    id: crypto.randomUUID(),
    kind: kind || confirmation.toolName,
    label: extras.label || confirmation.summary,
    rationale: extras.rationale || confirmation.guidance || undefined,
    details,
    status: 'pending',
    summary: confirmation.summary,
    risk: confirmation.risk,
    toolName: confirmation.toolName,
    moduleKey: moduleKey || undefined,
    recordId: String(payload.recordId || payload.id || extras.recordId || '').trim() || undefined,
    payload,
    fields: payload,
    confirmation,
  };
}

/** Shared UX for create proposals that may warn on duplicates/conflicts. */
function proposalsFromCreateToolResult(toolResult, toolName, title) {
  const warning = Boolean(toolResult?.createWarning || toolResult?.scheduleWarning);
  const proposal = confirmationToProposal(
    toolResult,
    toolName,
    warning
      ? {
        label: toolResult.summary || `Override and create "${title}" anyway`,
        rationale: toolResult.guidance
          || 'Creates a new record even though a similar or conflicting one already exists.',
        payload: { ...(toolResult?.payload || {}), override: true },
        details: toolResult.details,
      }
      : {
        details: toolResult.details,
      },
  );
  const conflictHits = [
    ...(toolResult?.conflicts || []),
    ...(toolResult?.duplicates || []),
  ].filter((h, i, arr) => h?.id && arr.findIndex((x) => x.id === h.id) === i);
  return { proposal, warning, conflictHits };
}

/** User asked for an inventory/list (not a pipeline coaching essay). */
function wantsListAnswer(query) {
  const q = String(query || '');
  if (/\b(summarize|summary|overview|priorit|what needs attention|where (should|do) i focus|coach)\b/i.test(q)
    && !/\b(list|show(\s+me)?|give(\s+me)?|display|enumerate)\b/i.test(q)) {
    return false;
  }
  return /\b(list|show(\s+me)?|give(\s+me)?|display|enumerate|which (are|ones?)|what are (the|my))\b/i.test(q)
    || /\b(open deals|deals which are open|deals that are open)\b/i.test(q);
}

/** Explicit pipeline coaching / summary ask. */
function wantsPipelineCoach(query) {
  const q = String(query || '');
  if (wantsListAnswer(q) && !/\b(summarize|summary|overview|priorit)\b/i.test(q)) return false;
  return /\b(summarize|summary|overview|priorit|what needs attention|pipeline health|where (should|do) i focus|coach)\b/i.test(q)
    || /\bpipeline\b/i.test(q) && !/\b(list|show|give)\b/i.test(q);
}

/** Serialize a tool result to a compact, fact-only block for the prompt. */
function serializeToolResult(intent, toolResult, { list = false } = {}) {
  if (!toolResult) return '(none)';
  if (intent === 'crm_search' || intent === 'knowledge') {
    const hits = toolResult.hits || [];
    const lines = hits.slice(0, 15).map((h) => {
      const bits = [h.title];
      if (h.subtitle) bits.push(h.subtitle);
      if (h.amount != null && h.amount !== '') bits.push(`$${h.amount}`);
      if (h.status) bits.push(h.status);
      return `• ${bits.join(' — ')}`;
    });
    const entity = toolResult.entity || 'records';
    const count = toolResult.counts?.total ?? hits.length;
    const scope = toolResult.overdueOnly
      ? 'overdue'
      : toolResult.openOnly
        ? 'open'
        : 'matching';
    const header = toolResult.brief
      ? `Status brief for ${entity} (${count} focus record)`
      : list
        ? `${count} ${scope} ${entity} (present as a clear bullet list — user asked for a list)`
        : `${count} ${scope} ${entity} (facts for narration — do not dump as a numbered inventory)`;

    const related = toolResult.related;
    const relatedLines = [];
    if (related) {
      const rec = related.record || {};
      if (rec.derivedStatus || rec.customerStatus || rec.status) {
        relatedLines.push(`Status: ${rec.derivedStatus || rec.customerStatus || rec.status}`);
      }
      if (rec.industry) relatedLines.push(`Industry: ${rec.industry}`);
      relatedLines.push(
        `Open deals: ${related.openDeals?.total ?? 0} (pipeline $${related.openDeals?.amount ?? 0})`,
      );
      relatedLines.push(`Open cases: ${related.openCases?.total ?? 0}`);
      relatedLines.push(
        `Open tasks: ${related.openTasks?.total ?? 0} (${related.openTasks?.overdue ?? 0} overdue)`,
      );
      relatedLines.push(`Linked people: ${related.people?.total ?? 0}`);
      for (const d of (related.openDeals?.items || []).slice(0, 5)) {
        relatedLines.push(`Deal: ${d.title}${d.amount != null ? ` · $${d.amount}` : ''}${d.subtitle ? ` · ${d.subtitle}` : ''}`);
      }
      for (const c of (related.openCases?.items || []).slice(0, 3)) {
        relatedLines.push(`Case: ${c.title}${c.subtitle ? ` · ${c.subtitle}` : ''}`);
      }
      for (const t of (related.openTasks?.items || []).slice(0, 3)) {
        relatedLines.push(`Task: ${t.title}${t.subtitle ? ` · ${t.subtitle}` : ''}`);
      }
    }

    return [header, ...lines, ...relatedLines].join('\n');
  }
  return JSON.stringify(toolResult).slice(0, 12000);
}

function formatHitLine(hit) {
  const bits = [hit.title];
  if (hit.subtitle) bits.push(hit.subtitle);
  if (hit.amount != null && hit.amount !== '') bits.push(`$${hit.amount}`);
  return `• ${bits.join(' · ')}`;
}

/** Human fallback when LLM polish is unavailable — never a DB dump. */
function buildContextualLead(intent, query, toolResult, baseLead) {
  const hits = toolResult?.hits || [];
  const total = toolResult?.counts?.total ?? hits.length;
  const entity = toolResult?.entity || 'records';
  const openOnly = Boolean(toolResult?.openOnly);
  const overdueOnly = Boolean(toolResult?.overdueOnly);
  if (!hits.length) return baseLead || "I couldn't find a match for that yet.";

  const qualifier = overdueOnly ? 'overdue ' : (openOnly ? 'open ' : '');
  const wantsCount = /\b(how many|count|number of)\b/i.test(String(query || ''));

  // List asks: short count only — UI record_list shows the rows (avoid double inventory).
  if (wantsListAnswer(query) || toolResult?.listIntent) {
    return `You have ${total} ${qualifier}${entity}.`;
  }

  const names = hits.slice(0, 3).map((h) => h.title).filter(Boolean);

  if (wantsCount) {
    return `You have ${total} ${qualifier}${entity}.${names[0] ? ` Top of the list: ${names[0]}.` : ''} Want me to dig into any of them?`;
  }
  if (total === 1 && names[0]) {
    const sub = hits[0]?.subtitle ? ` — ${hits[0].subtitle}` : '';
    return `${names[0]}${sub}. I can dig into status, draft a follow-up, or pull related records next.`;
  }
  if (names.length) {
    const more = total > names.length ? ` (+${total - names.length} more)` : '';
    return `Here are your ${total} ${qualifier}${entity} worth attention: ${names.join(', ')}${more}. Say which one to open, update, or follow up on.`;
  }
  return baseLead || `Here's what I found across your ${entity}.`;
}

function looksLikeDbDump(text, { allowList = false } = {}) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (/^(found \d+|results?:|entity=|total=|openOnly=)/im.test(t)) return true;
  if (/\bentity=\w+|openOnly=true|count=\d+/i.test(t)) return true;
  if (allowList) return false;
  // Raw dump: many bare numbered titles with almost no prose verbs
  const numbered = t.match(/^\s*\d+\.\s+/gm) || [];
  if (numbered.length >= 5) {
    const hasProse = /\b(here|looking|across|pipeline|worth|focus|recommend|priority|next|risk|healthy)\b/i.test(t);
    if (!hasProse && t.length < 400) return true;
  }
  return false;
}

/**
 * When the user asks about deals/cases/tasks while focused on another module
 * (e.g. person), return the related module — never list the focus module itself.
 * @param {string} query
 * @param {string} focusEntity
 * @returns {string|null}
 */
function detectRelatedModuleAsk(query, focusEntity) {
  const q = String(query || '').toLowerCase();
  const focus = String(focusEntity || '').toLowerCase();
  /** @type {Array<[RegExp, string]>} */
  const checks = [
    [/\b(open\s+)?deals?\b|\bpipeline\b|\bopportunit/i, 'deals'],
    [/\b(open\s+)?cases?\b|\btickets?\b/i, 'cases'],
    [/\b(open\s+)?tasks?\b|\btodos?\b|\bto-?dos?\b/i, 'tasks'],
    [/\bevents?\b|\bmeetings?\b|\bcalls?\b/i, 'events'],
    [/\borganizations?\b|\baccounts?\b|\bcompanies\b/i, 'organizations'],
    [/\bpeople\b|\bcontacts?\b|\bpersons?\b/i, 'people'],
  ];
  for (const [re, mod] of checks) {
    if (re.test(q) && mod !== focus) return mod;
  }
  return null;
}

function relatedHitsToToolResult(relatedModule, relatedRows, query) {
  const openOnly = /\bopen\b/i.test(String(query || ''));
  const hits = (relatedRows || [])
    .filter((r) => String(r.moduleKey || '').toLowerCase() === relatedModule)
    .map((r) => ({
      id: String(r.id || r.recordId || ''),
      title: String(r.title || r.name || '').trim() || 'Untitled',
      subtitle: r.relationshipKey || '',
      status: r.status || null,
      amount: r.amount ?? null,
      href: r.href || null,
    }))
    .filter((h) => h.id);
  return {
    entity: relatedModule,
    hits,
    counts: { total: hits.length, returned: hits.length },
    listIntent: true,
    openOnly,
    searchTerm: null,
    guidance: hits.length
      ? `Related ${relatedModule} for focused record.`
      : `No related ${relatedModule} for this record.`,
    relatedAsk: true,
  };
}

/** Deterministic lead text + claims. Visual facts go in UI blocks, not Markdown. */
function buildGroundedAnswer(intent, query, toolResult) {
  const focused = applyAskFidelity(toolResult, query);
  const listIntent = wantsListAnswer(query) || focused?.listIntent === true;
  if (focused && listIntent) focused.listIntent = true;

  const { lead, blocks } = buildUiBlocks(intent, focused, {
    listIntent,
    query,
  });

  if (intent === 'crm_search' || intent === 'knowledge') {
    const hits = focused?.hits || [];
    const total = focused?.counts?.total ?? hits.length;
    const entity = focused?.entity || (intent === 'knowledge' ? 'articles' : 'records');
    const claims = hits.length
      ? [{ type: 'count', entity, value: total }]
        .concat(hits.slice(0, 5).map((h) => ({ type: 'record', id: h.id, title: h.title })))
      : [];

    if (listIntent) {
      const chartAsk = wantsChartAsk(query);
      const premiumList = Boolean(focused?.askFocus);
      return {
        draft: [
          lead,
          '',
          premiumList
            ? 'User asked for a focused set. Reply with 1–2 premium sentences answering the ask; name up to 2 standout records. Do NOT dump every row.'
            : chartAsk
              ? 'User asked for a list and a chart. Reply with ONE short sentence confirming the count and that the chart is below.'
              : 'User asked for a list. Reply with a premium count sentence.',
          'Do NOT reprint every deal as bullets — the interactive UI list already shows them.',
          chartAsk
            ? 'Do NOT invent a markdown table or ASCII chart — the UI chart block already shows the breakdown.'
            : 'Invite one next move (open a card / brief me / draft follow-up).',
        ].join('\n'),
        lead,
        blocks,
        claims,
        toolResult: focused,
      };
    }

    const contextual = buildContextualLead(intent, query, focused, lead);
    const draftFacts = hits.length
      ? [
        contextual,
        '',
        'Key facts for narration (do NOT reprint as a numbered database dump — UI cards show the list):',
        ...hits.slice(0, 5).map((h) => formatHitLine(h)),
        '',
        'Write a sensible contextual answer for the user.',
      ].join('\n')
      : contextual;

    return { draft: draftFacts, lead: contextual, blocks, claims, toolResult: focused };
  }

  return { draft: lead, lead, blocks, claims: [], toolResult: focused };
}

/** Deterministic follow-up chips. */
function buildSuggestions(intent, query, toolResult) {
  const entity = toolResult?.entity || 'deals';
  const hits = toolResult?.hits || [];
  const first = hits[0];
  const suggestions = [];

  if (intent === 'crm_search') {
    if (entity === 'deals') {
      if (toolResult?.askFocus === 'near_close') {
        suggestions.push('Which of these should I prioritize this week?');
        if (first?.title) {
          suggestions.push(`Draft a closing email for ${first.title}`);
          suggestions.push(`What’s blocking ${first.title}?`);
        }
        suggestions.push('Show all open deals');
      } else if (toolResult?.openOnly) {
        suggestions.push('Which of these need attention this week?');
        suggestions.push('Show deals near closure');
        suggestions.push('Show won deals instead');
      } else {
        suggestions.push('Show only open deals');
      }
      if (first?.title && toolResult?.askFocus !== 'near_close') {
        suggestions.push(`Tell me more about ${first.title}`);
        suggestions.push(`Draft a follow-up for ${first.title}`);
      } else if (!first?.title) {
        suggestions.push('List my open deals');
      }
      if (!suggestions.includes('How many open deals do I have?')) {
        suggestions.push('How many open deals do I have?');
      }
    } else if (entity === 'cases') {
      suggestions.push('Show high-priority open cases');
      if (first?.title) suggestions.push(`Summarize ${first.title}`);
      suggestions.push('List open deals');
    } else if (entity === 'people') {
      suggestions.push('Show open deals for this contact');
      if (first?.title) suggestions.push(`What do we know about ${first.title}?`);
      suggestions.push('List open cases');
    } else if (entity === 'tasks') {
      suggestions.push('Show overdue tasks');
      suggestions.push('What tasks are due today?');
      if (first?.title) suggestions.push(`Open ${first.title}`);
      suggestions.push('List my open deals');
    } else if (entity === 'events') {
      suggestions.push('What events do I have today?');
      suggestions.push('Show upcoming meetings');
      if (first?.title) suggestions.push(`Open ${first.title}`);
      suggestions.push('List overdue tasks');
    }
  } else if (intent === 'knowledge') {
    suggestions.push('Show me related CRM records');
    suggestions.push('List my open deals');
  } else if (intent === 'clarify') {
    suggestions.push('List my open deals', 'Show overdue tasks', 'Draft an email', 'Create a task');
  } else {
    suggestions.push('List my open deals');
    suggestions.push('Show overdue tasks');
    suggestions.push('What events do I have today?');
  }

  const seen = new Set();
  return suggestions.filter((s) => {
    const key = s.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

function mentionsAnyClaim(text, claims) {
  const lower = String(text || '').toLowerCase();
  return claims.some((c) => {
    if (c.type === 'count') return lower.includes(String(c.value));
    if (c.type === 'record' && c.title) return lower.includes(String(c.title).toLowerCase());
    return false;
  });
}

/**
 * LLM-first premium polish. Never truncates the model reply.
 * Falls back to lead only when empty or fact-breaking.
 */
async function polishCoworkerAnswer({
  llm,
  request,
  query,
  draft,
  lead,
  toolResults = '(none)',
  history = [],
  claims = [],
  brief = false,
  write = false,
  list = false,
  toolResult = null,
  intent = null,
  situationText = '',
  agentSystemHint = '',
  forcePolish = false,
}) {
  const listMode = Boolean(list) || wantsListAnswer(query);
  const safeLead = (!write && toolResult && (intent === 'crm_search' || intent === 'knowledge'))
    ? buildContextualLead(intent, query, toolResult, lead)
    : lead;

  const groundedTools = situationText
    ? `${String(toolResults || '(none)')}\n\nSITUATION CONTEXT:\n${situationText}`
    : toolResults;

  try {
    const messages = buildAnswerMessages({
      query,
      groundedDraft: draft || safeLead,
      toolResults: groundedTools,
      history,
      brief: listMode ? false : brief,
      write,
      list: listMode,
      agentSystemHint,
    });
    const completion = await llm(messages, {
      ...request,
      temperature: write ? 0.35 : (listMode ? 0.2 : (brief ? 0.5 : 0.4)),
      maxTokens: 1800,
    });
    const polished = String(completion?.text || '').replace(/\*\*/g, '').trim();
    const usage = completion?.usage || {};
    const creditsDebited = Number(completion?.creditsDebited || 0);
    if (!polished) {
      return { answer: safeLead, polishedUsed: false, usage, creditsDebited };
    }
    // Studio panel fills: keep LLM bullets even when dump heuristic misfires on agendas.
    if (looksLikeDbDump(polished, { allowList: listMode || forcePolish })) {
      if (!forcePolish) {
        return { answer: safeLead, polishedUsed: false, usage, creditsDebited };
      }
    }
    const hitsExist = (claims || []).length > 0;
    const keepsFacts = !hitsExist || mentionsAnyClaim(polished, claims);
    // Studio panel fills must keep LLM polish — claim mismatch often rejects valid coworker prose.
    if (!keepsFacts && !forcePolish) {
      return { answer: safeLead, polishedUsed: false, usage, creditsDebited };
    }
    return {
      answer: polished,
      polishedUsed: true,
      usage: usage.totalTokens
        ? usage
        : { promptTokens: 0, completionTokens: 0, totalTokens: 0, ...usage },
      creditsDebited,
    };
  } catch (error) {
    return { answer: safeLead, polishedUsed: false, usage: {}, creditsDebited: 0, error };
  }
}

function resolveLlm(deps) {
  if (typeof deps.llm === 'function') return deps.llm;
  // Offline / unit tests: never call live providers when llmIntent is disabled.
  if (deps.llmIntent === false) {
    return async () => ({ text: '', usage: {} });
  }
  return async (messages, request) => modelRouter.complete(
    request.organizationId,
    'astra_v2_ask',
    {
      messages,
      temperature: Number.isFinite(request.temperature) ? request.temperature : 0.45,
      maxTokens: request.maxTokens || 1800,
      modelOverride: request.modelOverride,
      // One rolled-up audit row is written in finish() via createMeteredLlm.
      skipAudit: true,
    },
  );
}

/**
 * Sum every LLM hop in one ask (intent classify, polish, retries, slots, etc.)
 * so audit Tokens / Tokens billed match ledger Consumed.
 */
function createMeteredLlm(baseLlm) {
  const meter = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    creditsDebited: 0,
  };
  const llm = async (messages, request) => {
    const result = await baseLlm(messages, request);
    const usage = result?.usage || {};
    meter.promptTokens += Math.max(0, Number(usage.promptTokens || usage.prompt_tokens || 0) || 0);
    meter.completionTokens += Math.max(0, Number(usage.completionTokens || usage.completion_tokens || 0) || 0);
    meter.totalTokens += Math.max(0, Number(usage.totalTokens || usage.total_tokens || 0) || 0);
    meter.creditsDebited += Math.max(0, Number(result?.creditsDebited || 0) || 0);
    return result;
  };
  return { llm, meter };
}

function resolveConversationId(request) {
  const existing = String(request.conversationId || '').trim();
  if (existing) return existing;
  return crypto.randomUUID();
}

function agentAllowsTool(agent, toolName) {
  if (!agent || !Array.isArray(agent.tools) || agent.tools.length === 0) return true;
  if (agent.tools.includes(toolName)) return true;
  // Fabric aliases: CapIndex module.* covers legacy search.crm / crm.record.get
  if (toolName === 'search.crm' && agent.tools.includes('module.search')) return true;
  if (toolName === 'crm.record.get' && agent.tools.includes('module.get')) return true;
  if (toolName === 'module.search' && agent.tools.includes('search.crm')) return true;
  if (toolName === 'module.get' && agent.tools.includes('crm.record.get')) return true;
  return false;
}

/**
 * Prefer CapIndex fabric tools when the seat allow-lists them.
 */
function pickInitialToolName(agent, intent, query) {
  const q = String(query || '');
  if (intent === 'knowledge') {
    if (agentAllowsTool(agent, 'knowledge.search')) return 'knowledge.search';
    if (agentAllowsTool(agent, 'module.search')) return 'module.search';
    return 'knowledge.search';
  }
  const commercial = /\b(invoice|payment|refund)s?\b/i.test(q);
  const candidates = commercial
    ? ['module.search', 'search.crm']
    : ['module.search', 'search.crm', 'crm.deals', 'crm.cases'];
  for (const name of candidates) {
    if (agentAllowsTool(agent, name)) return name;
  }
  return candidates[0];
}

function updateFocusFromToolResult(memory, organizationId, conversationId, toolResult) {
  if (!organizationId || !toolResult?.hits?.length) return;
  const hit = toolResult.hits[0];
  const entity = toolResult.entity;
  if (!hit?.id || !entity) return;
  if (toolResult.brief || toolResult.searchTerm || toolResult.hits.length === 1) {
    memory.setFocus(organizationId, conversationId, {
      kind: entity,
      id: hit.id,
      name: hit.title,
      moduleKey: entity,
    });
  }
}

/**
 * @param {Object} request
 * @param {Object} [deps]
 */
async function runOrchestrator(request = {}, deps = {}) {
  ensureBootstrapped();
  const registry = deps.toolRegistry || toolRegistry;
  const agents = deps.agentRegistry || agentRegistry;
  const memory = deps.sessionMemory || sessionMemory;
  const started = Number.isFinite(deps.now) ? deps.now : Date.now();

  const query = String(request.query || '').trim();
  const { llm, meter: llmMeter } = createMeteredLlm(resolveLlm(deps));
  const conversationId = resolveConversationId(request);
  const priorHistory = Array.isArray(request.history) && request.history.length
    ? request.history
    : (request.organizationId ? memory.history(request.organizationId, conversationId) : []);
  let focus = request.focus
    || (request.organizationId
      ? memory.getFocus(request.organizationId, conversationId)
      : null)
    || null;

  // Astra Studio surface: generate/mutate Living Canvas first, then narrate.
  if (String(request.surface || '') === 'astra-studio' && query && request.organizationId) {
    const canvasToolName = request.canvasId || request.flags?.canvasId
      ? 'canvas.mutate'
      : 'canvas.generate';
    const tool = registry.getTool(canvasToolName) || registry.getTool('canvas.generate');
    if (tool) {
      const toolResult = await tool.run(
        {
          canvasId: request.canvasId || request.flags?.canvasId || null,
          prompt: query,
          title: query,
          focus: focus?.moduleKey && focus?.recordId
            ? [{ moduleKey: focus.moduleKey, recordId: focus.recordId }]
            : request.focusRecords || [],
          instruction: query,
          ops: request.ops,
          targetWidgetId: request.targetWidgetId || request.flags?.targetWidgetId || null,
        },
        {
          organizationId: request.organizationId,
          userId: request.userId,
          query,
          flags: {
            ...(request.flags || {}),
            canvasId: request.canvasId || request.flags?.canvasId,
            targetWidgetId: request.targetWidgetId || request.flags?.targetWidgetId || null,
          },
          focus,
        }
      );
      const answer = toolResult?.ok
        ? (toolResult.claims?.[0]?.text
          || `I've updated your Living Canvas (${toolResult.canvasType || 'workspace'}). ${
            toolResult.summary?.widgetCount != null
              ? `It now has ${toolResult.summary.widgetCount} widgets.`
              : ''
          }`)
        : `I couldn't update the canvas: ${toolResult?.error || 'unknown error'}`;
      return {
        intent: 'workflow',
        agentKey: 'mission-control',
        agentName: 'Astra Mission Control',
        confidence: 0.9,
        conversationId,
        grounded: true,
        answer,
        claims: toolResult?.claims || [],
        blocks: [],
        suggestions: [],
        proposals: [],
        canvas: toolResult?.ok
          ? { canvasId: toolResult.canvasId, canvasType: toolResult.canvasType, summary: toolResult.summary }
          : null,
        tool: tool.name,
        toolResult,
      };
    }
  }

  // Quote-number fallback when home/history asks omit recordId.
  if ((!focus?.id && !focus?.recordId) && request.organizationId && deps.skipQuoteResolve !== true) {
    const fromQuote = await resolveQuoteFocusFromQuery(query, request.organizationId, deps);
    if (fromQuote) focus = fromQuote;
  }

  // Hydrate related records + activity + emails for focused page context (best-effort).
  let situation = null;
  const situationModule = String(focus?.moduleKey || focus?.kind || '').trim();
  const situationId = String(focus?.id || focus?.recordId || '').trim();
  if (request.organizationId && situationModule && situationId && deps.skipSituation !== true) {
    try {
      situation = await buildSituationContext({
        organizationId: request.organizationId,
        moduleKey: situationModule,
        recordId: situationId,
        name: focus?.name || '',
        deps: { models: deps.models || {} },
      });
      if (situation?.ok && situation.focus?.title && focus && !focus.name) {
        focus.name = situation.focus.title;
      }
    } catch (error) {
      if (deps.debug) {
        console.error('[astra.orchestrator] situation context failed:', error.message);
      }
      situation = null;
    }
  }

  // LLM for every query (history + focus for anaphora). Heuristic = fallback only.
  // Tests may set llmIntent:false to stay offline.
  const classification = await classifyIntentPrecise(query, request, {
    llm,
    llmIntent: deps.llmIntent,
    organizationId: request.organizationId,
    history: priorHistory,
    focus,
  });

  // Never "clarify" away from a focused CRM record — that invents "I don't have details".
  let intent = classification.intent;
  const focusEntityEarly = String(focus?.moduleKey || focus?.kind || '').trim().toLowerCase();
  const focusIdEarly = String(focus?.id || focus?.recordId || '').trim();
  if (
    (intent === 'clarify' || intent === 'chitchat')
    && focusIdEarly
    && FOCUS_BRIEF_ENTITIES.includes(focusEntityEarly)
  ) {
    intent = 'crm_search';
  }
  let agentPick = await pickAgentWithLlm({
    query,
    request,
    classification,
    agents,
    focus,
    llm,
    llmIntent: deps.llmIntent,
    organizationId: request.organizationId,
  });
  let agentKey = agentPick.agentKey;
  let agent = agents.getAgent(agentKey);
  let mcPlan = null;
  let executionAgentKey = agentKey;

  // Mission Control: plan specialists; execute with primary specialist tools/prompt.
  if (isMissionControlKey(agentKey) || !agent) {
    if (!agent && agents.hasAgent?.('mission-control')) {
      agentKey = 'mission-control';
      agent = agents.getAgent('mission-control');
      agentPick = { ...agentPick, agentKey, reason: 'mc_fallback' };
    }
    mcPlan = await planSpecialistsWithLlm({
      query,
      intent,
      focus,
      agents,
      request,
      llm,
      llmIntent: deps.llmIntent,
    });
    const primaryKey = mcPlan.specialists?.[0];
    const primary = primaryKey ? agents.getAgent(primaryKey) : null;
    if (primary) {
      executionAgentKey = primaryKey;
      agent = primary;
    }
    agentKey = 'mission-control';
    agentPick = {
      ...agentPick,
      agentKey: 'mission-control',
      reason: mcPlan.reason || agentPick.reason,
      specialists: mcPlan.specialists,
      parallel: mcPlan.parallel,
    };
  }

  // Email drafts need email.draft — route through Email specialist under Mission Control.
  if (
    intent === 'email_draft'
    && !agentAllowsTool(agent, 'email.draft')
  ) {
    const emailAgent = agents.getAgent?.('email') || agents.getAgent?.('coworker');
    if (emailAgent && agentAllowsTool(emailAgent, 'email.draft')) {
      executionAgentKey = emailAgent.name;
      agent = emailAgent;
      agentPick = { ...agentPick, reason: 'email_draft_tool_guard', specialists: ['email'] };
    }
  }

  const forcePolish = Boolean(request.flags?.studioFill || request.flags?.forcePolish);
  const polishWithAgent = (opts) => polishCoworkerAnswer({
    ...opts,
    forcePolish: opts.forcePolish ?? forcePolish,
    agentSystemHint: opts.agentSystemHint ?? agent?.systemHint ?? '',
  });
  const expectedTool = classification.tool || INTENT_TOOL_ROUTE[intent] || null;

  const ctx = {
    organizationId: request.organizationId,
    userId: request.userId || null,
    surface: request.surface || 'chat',
    agentKey,
    executionAgentKey,
    focus,
    situation,
    deps: {
      models: deps.models || {},
      vectorStore: deps.vectorStore || null,
    },
    toolRegistry: registry,
  };

  const baseMeta = {
    intent,
    agentKey,
    executionAgentKey,
    agentName: agents.getAgent?.(agentKey)?.title || agent?.title || agentKey,
    specialists: mcPlan?.specialists || null,
    confidence: classification.confidence,
    conversationId,
    intentReason: classification.reason || null,
    intentSource: classification.intentSource || null,
    agentPickSource: agentPick.source || null,
    agentPickReason: agentPick.reason || null,
    expectedTool,
  };

  async function finish(partial) {
    const answer = partial.answer || '';
    if (request.organizationId && query && !partial.skipMemory) {
      memory.append(request.organizationId, conversationId, { role: 'user', content: query });
      memory.append(request.organizationId, conversationId, { role: 'assistant', content: answer });
    }

    const usage = llmMeter.totalTokens > 0
      ? {
        promptTokens: llmMeter.promptTokens,
        completionTokens: llmMeter.completionTokens,
        totalTokens: llmMeter.totalTokens,
      }
      : (partial.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 });
    const creditsDebited = llmMeter.creditsDebited > 0
      ? llmMeter.creditsDebited
      : Number(partial.creditsDebited || 0);

    if (deps.audit !== false && request.organizationId) {
      await recordTurn({
        organizationId: request.organizationId,
        userId: request.userId,
        abilityKey: 'astra_v2_ask',
        status: 'success',
        model: partial.polishedUsed ? 'llm+grounded' : 'grounded',
        promptVersion: PROMPT_VERSION,
        usage,
        creditsDebited,
        latencyMs: Date.now() - started,
        metadata: {
          ...baseMeta,
          tool: partial.tool || null,
          claims: (partial.claims || []).length,
          polishedUsed: Boolean(partial.polishedUsed),
          reason: classification.reason,
          llmHopsMetered: llmMeter.totalTokens > 0,
        },
      });
    }

    return {
      intent,
      agentKey,
      agentName: agent?.title || agentKey,
      confidence: classification.confidence,
      intentReason: classification.reason || null,
      intentSource: classification.intentSource || null,
      expectedTool,
      conversationId,
      focus: memory.getFocus?.(request.organizationId, conversationId) || focus,
      grounded: partial.grounded !== false,
      ...partial,
      agentKey,
      agentName: agent?.title || agentKey,
      usage,
      creditsDebited,
    };
  }

  if (intent === 'workflow') {
    const wf = await runWorkflowAgent({ workflow: request.workflow, steps: request.steps }, ctx);
    return finish({
      answer: wf.summary,
      blocks: [],
      suggestions: buildSuggestions(intent, query, null),
      workflow: wf,
      claims: [],
      tool: 'workflow.run',
    });
  }

  if (intent === 'playbook') {
    // Explicit specialist seat (e.g. Living Canvas hydrate) must not run thin playbooks —
    // studio-* playbooks only have stub seats ("no runner yet") and would pollute widget bodies.
    const forcedAgent = String(request.agent || request.specialist || '').trim().toLowerCase();
    const forceSpecialist = forcedAgent
      && forcedAgent !== 'auto'
      && !isMissionControlKey(forcedAgent)
      && forcedAgent !== 'workflow';
    if (!forceSpecialist) {
      const playbookKey = classification.playbookKey || request.playbook || 'qualify-research-outreach';
      const pb = await runThinPlaybook({
        playbookKey,
        query,
        ctx: { ...ctx, conversationId },
        memory,
        conversationId,
        llm,
        history: priorHistory,
      });
      return finish({
        answer: pb.answer,
        blocks: pb.blocks || [],
        proposals: pb.proposals || [],
        actions: pb.proposals || [],
        suggestions: pb.suggestions || [],
        claims: pb.focus?.name ? [{ type: 'record', id: pb.focus.id || 'focus', title: pb.focus.name }] : [],
        tool: 'playbook.run',
        toolResult: { seats: pb.seats, scratchpad: pb.scratchpad, playbookKey: pb.playbookKey },
        seats: pb.seats,
        playbookKey: pb.playbookKey,
        agentKey: 'workflow',
      });
    }
    // Remap intent so meeting_prep / research specialist loops can run.
    intent = classification.playbookKey?.startsWith('studio-meeting')
      ? 'meeting_prep'
      : classification.playbookKey?.startsWith('studio-war')
        ? 'research'
        : 'crm_search';
  }

  if (intent === 'clarify') {
    const turn = buildClarifyTurn(query);
    const polish = await polishWithAgent({
      llm,
      request,
      query,
      draft: turn.answer,
      lead: turn.answer,
      toolResults: '(none)',
      history: priorHistory,
      claims: [],
    });
    return finish({
      answer: polish.answer,
      blocks: turn.blocks,
      suggestions: turn.suggestions,
      claims: [],
      tool: null,
      polishedUsed: polish.polishedUsed,
      usage: polish.usage,
      creditsDebited: Number(polish.creditsDebited || 0),
    });
  }

  if (intent === 'chitchat') {
    const lead = buildChitchatAnswer(query);
    const polish = await polishWithAgent({
      llm,
      request,
      query,
      draft: lead,
      lead,
      toolResults: '(none)',
      history: priorHistory,
      claims: [],
    });
    return finish({
      answer: polish.answer,
      blocks: [],
      suggestions: buildSuggestions(intent, query, null),
      claims: [],
      tool: null,
      polishedUsed: polish.polishedUsed,
      usage: polish.usage,
      creditsDebited: Number(polish.creditsDebited || 0),
    });
  }

  if (intent === 'case_create') {
    const toolName = 'crm.cases.create';
    const tool = registry.getTool(toolName);
    const title = classification.llmTitle || extractCaseTitle(query);
    const relatedTo = focus?.id
      ? { moduleKey: focus.moduleKey || focus.kind, id: focus.id, name: focus.name }
      : null;
    const wantsOverride = /\b(override|create anyway|force it)\b/i.test(query);
    const toolResult = tool
      ? await tool.run({ title, relatedTo, override: wantsOverride }, ctx)
      : null;
    const { proposal, warning, conflictHits } = proposalsFromCreateToolResult(toolResult, toolName, title);
    const lead = warning && toolResult?.guidance
      ? toolResult.guidance
      : `I can open a case titled "${title}". Confirm to create it.`;
    const { blocks } = conflictHits.length
      ? buildUiBlocks('crm_search', {
        entity: 'cases',
        hits: conflictHits,
        counts: { total: conflictHits.length, returned: conflictHits.length },
      })
      : { blocks: [] };
    const claims = [
      { type: 'record', id: 'draft-case', title },
      ...conflictHits.slice(0, 3).map((h) => ({ type: 'record', id: h.id, title: h.title })),
    ];
    const polish = await polishWithAgent({
      llm,
      request,
      query,
      draft: lead,
      lead,
      toolResults: JSON.stringify({ title, duplicates: toolResult?.duplicates || [], warning }),
      history: priorHistory,
      claims,
      write: true,
    });
    return finish({
      answer: polish.answer,
      blocks,
      proposals: proposal ? [proposal] : [],
      actions: proposal ? [proposal] : [],
      suggestions: warning
        ? ['Cancel — keep existing case', 'List open cases']
        : ['List open cases', 'Draft a reply'],
      claims,
      tool: toolName,
      toolResult,
      polishedUsed: polish.polishedUsed,
      usage: polish.usage,
      creditsDebited: Number(polish.creditsDebited || 0),
      createWarning: warning,
    });
  }

  if (intent === 'deal_update') {
    const toolName = 'crm.deals.update';
    const tool = registry.getTool(toolName);
    const dealId = focus?.kind === 'deals' ? focus.id : null;
    const wantsWon = /\bwon\b/i.test(query);
    const wantsLost = /\blost\b/i.test(query);
    const patch = {
      dealId,
      status: wantsWon ? 'Won' : wantsLost ? 'Lost' : undefined,
      stage: query.match(/\bstage\s+(?:to\s+)?([A-Za-z0-9 _-]{2,40})/i)?.[1]?.trim() || undefined,
    };
    const toolResult = tool ? await tool.run(patch, ctx) : null;
    const proposal = confirmationToProposal(toolResult, 'crm.deals.update');
    const lead = dealId
      ? `I can update deal "${focus.name || dealId}". Confirm to apply the change.`
      : 'I can update a deal — set focus on a deal first (or name it), then confirm.';
    const polish = await polishWithAgent({
      llm,
      request,
      query,
      draft: lead,
      lead,
      toolResults: JSON.stringify({ patch, dealId }),
      history: priorHistory,
      claims: dealId ? [{ type: 'record', id: dealId, title: focus?.name || dealId }] : [],
      write: true,
    });
    return finish({
      answer: polish.answer,
      blocks: [],
      proposals: proposal ? [proposal] : [],
      actions: proposal ? [proposal] : [],
      suggestions: ['List my open deals', 'Create a follow-up task'],
      claims: dealId ? [{ type: 'record', id: dealId, title: focus?.name || dealId }] : [],
      tool: toolName,
      toolResult,
      polishedUsed: polish.polishedUsed,
      usage: polish.usage,
      creditsDebited: Number(polish.creditsDebited || 0),
    });
  }

  if (intent === 'record_update') {
    const toolName = 'module.update';
    const tool = registry.getTool(toolName);
    const parsed = extractRecordUpdatePatch(query, focus);
    const llmEntity = String(classification.entityHint || classification.entity || '').trim().toLowerCase();
    const moduleKey = parsed.moduleKey
      || llmEntity
      || String(focus?.moduleKey || focus?.kind || '').trim().toLowerCase()
      || null;
    let recordId = String(focus?.id || focus?.recordId || '').trim() || null;
    let recordName = focus?.name || parsed.recordTitle || classification.llmTitle || null;
    const fields = { ...(parsed.fields || {}) };

    // Prefer LLM title slot when user named a record and focus id is missing
    if (!recordId && classification.llmTitle) {
      recordName = String(classification.llmTitle).trim() || recordName;
    }
    if (!recordId && parsed.recordTitle) {
      recordName = parsed.recordTitle;
    }

    let resolveGuidance = null;
    let candidateHits = [];
    if (!recordId && moduleKey && recordName) {
      const search = registry.getTool('module.search') || registry.getTool('search.crm');
      if (search) {
        const found = await search.run({
          moduleKey,
          entity: moduleKey,
          query: recordName,
          searchTerm: recordName,
          limit: 5,
        }, ctx);
        candidateHits = Array.isArray(found?.hits) ? found.hits : [];
        if (candidateHits.length === 1 && candidateHits[0]?.id) {
          recordId = String(candidateHits[0].id);
          recordName = candidateHits[0].title || recordName;
        } else if (candidateHits.length > 1) {
          const needle = String(recordName).toLowerCase();
          const exact = candidateHits.find((h) => String(h.title || '').toLowerCase() === needle);
          if (exact?.id) {
            recordId = String(exact.id);
            recordName = exact.title || recordName;
          } else {
            resolveGuidance = `I found ${candidateHits.length} matching ${moduleKey}. Which one should I update?`;
          }
        } else {
          resolveGuidance = `I couldn't find a ${moduleKey || 'record'} named "${recordName}". Open it or give the exact title.`;
        }
      }
    }

    if (!moduleKey) {
      const lead = 'Which module should I update (events, tasks, deals, cases, people, organizations, …)?';
      return finish({
        answer: lead,
        blocks: [],
        proposals: [],
        actions: [],
        suggestions: ['Mark this event completed', 'Mark this task completed', 'Update deal stage'],
        claims: [],
        tool: toolName,
        toolResult: { ok: false, guidance: lead },
      });
    }

    if (!Object.keys(fields).length) {
      const lead = `What should I change on this ${moduleKey.slice(0, -1) || 'record'}? Say the field and new value (e.g. status to Completed).`;
      return finish({
        answer: lead,
        blocks: [],
        proposals: [],
        actions: [],
        suggestions: [
          `Mark this ${moduleKey === 'events' ? 'event' : moduleKey === 'tasks' ? 'task' : 'record'} as completed`,
          `Set ${moduleKey} priority to high`,
        ],
        claims: [],
        tool: toolName,
        toolResult: { ok: false, guidance: lead },
      });
    }

    if (resolveGuidance || !recordId) {
      const lead = resolveGuidance
        || (recordName
          ? `I need the record id for "${recordName}" before I can update it.`
          : `Focus a ${moduleKey} record (or name its title) so I can update it.`);
      const blocks = candidateHits.length > 1
        ? [{
          type: 'list',
          entity: moduleKey,
          title: `Matching ${moduleKey}`,
          items: candidateHits.slice(0, 5).map((h) => ({
            id: h.id,
            title: h.title,
            subtitle: h.subtitle || h.status || null,
          })),
        }]
        : [];
      return finish({
        answer: lead,
        blocks,
        proposals: [],
        actions: [],
        suggestions: candidateHits.slice(0, 3).map((h) => `Update ${h.title}`),
        claims: [],
        tool: toolName,
        toolResult: { ok: false, guidance: lead, hits: candidateHits },
        focus: memory.getFocus?.(request.organizationId, conversationId) || focus,
      });
    }

    if (request.organizationId && recordId) {
      memory.setFocus?.(request.organizationId, conversationId, {
        kind: moduleKey,
        moduleKey,
        id: recordId,
        recordId,
        name: recordName || recordId,
      });
    }

    const toolResult = tool
      ? await tool.run({ moduleKey, recordId, fields }, ctx)
      : { ok: false, guidance: 'module.update is not available.' };

    if (toolResult?.ok === false && !toolResult?.needsConfirmation && toolResult?.type !== 'confirm_action') {
      const lead = toolResult.guidance || 'Could not prepare that update.';
      return finish({
        answer: lead,
        blocks: [],
        proposals: [],
        actions: [],
        suggestions: ['List matching records', 'Try again with the exact title'],
        claims: [],
        tool: toolName,
        toolResult,
      });
    }

    const fieldSummary = Object.entries(fields).map(([k, v]) => `${k} → ${v}`).join(', ');
    const proposal = confirmationToProposal(toolResult, 'module.update', {
      moduleKey,
      label: `Update ${moduleKey}: ${recordName || recordId}`,
      rationale: fieldSummary,
      payload: { moduleKey, recordId, fields, action: 'update' },
      details: Object.entries(fields).map(([k, v]) => ({ label: k, value: String(v) })),
    });
    const lead = `I can update "${recordName || recordId}" (${moduleKey}): ${fieldSummary}. Confirm to apply.`;
    const polish = await polishWithAgent({
      llm,
      request,
      query,
      draft: lead,
      lead,
      toolResults: JSON.stringify({ moduleKey, recordId, fields }),
      history: priorHistory,
      claims: [{ type: 'record', id: recordId, title: recordName || recordId }],
      write: true,
    });
    return finish({
      answer: polish.answer,
      blocks: [],
      proposals: proposal ? [proposal] : [],
      actions: proposal ? [proposal] : [],
      suggestions: [`Open ${moduleKey}`, 'Undo is not available — review before confirming'],
      claims: [{ type: 'record', id: recordId, title: recordName || recordId }],
      tool: toolName,
      toolResult,
      polishedUsed: polish.polishedUsed,
      usage: polish.usage,
      creditsDebited: Number(polish.creditsDebited || 0),
    });
  }

  if (intent === 'quote_draft') {
    const toolName = 'quotes.draft';
    const tool = registry.getTool(toolName);
    const toolResult = tool
      ? await tool.run({
        dealId: focus?.kind === 'deals' ? focus.id : null,
        dealName: focus?.name || 'this deal',
      }, ctx)
      : null;
    const proposal = confirmationToProposal(toolResult, 'quotes.draft');
    const lead = `I can draft a quote${focus?.name ? ` for ${focus.name}` : ''}. Confirm to continue.`;
    const polish = await polishWithAgent({
      llm,
      request,
      query,
      draft: lead,
      lead,
      toolResults: JSON.stringify({ dealId: focus?.id || null, dealName: focus?.name || null }),
      history: priorHistory,
      claims: focus?.id ? [{ type: 'record', id: focus.id, title: focus.name || focus.id }] : [],
      write: true,
    });
    return finish({
      answer: polish.answer,
      blocks: [],
      proposals: proposal ? [proposal] : [],
      actions: proposal ? [proposal] : [],
      suggestions: ['List my quotes', 'List open deals'],
      claims: focus?.id ? [{ type: 'record', id: focus.id, title: focus.name || focus.id }] : [],
      tool: toolName,
      toolResult,
      polishedUsed: polish.polishedUsed,
      usage: polish.usage,
      creditsDebited: Number(polish.creditsDebited || 0),
    });
  }

  if (intent === 'research') {
    const term = extractSearchTerm(query) || focus?.name;
    const focusEntity = String(focus?.moduleKey || focus?.kind || '').trim().toLowerCase();
    const focusId = String(focus?.id || focus?.recordId || '').trim();

    if (focusId && FOCUS_BRIEF_ENTITIES.includes(focusEntity)) {
      const getTool = registry.getTool('crm.record.get');
      let subjectHit = {
        id: focusId,
        title: situation?.focus?.title || focus?.name || 'this record',
        subtitle: situation?.focus?.subtitle || '',
        status: null,
      };
      if (getTool) {
        const got = await getTool.run({ moduleKey: focusEntity, recordId: focusId }, ctx);
        if (got?.ok && got.record) {
          subjectHit = {
            id: String(got.record.id || focusId),
            title: got.record.title || subjectHit.title,
            subtitle: got.record.subtitle || subjectHit.subtitle || '',
            status: got.record.status || null,
            href: got.record.href || null,
          };
        }
      }
      const brief = await buildRecordStatusBrief({
        entity: focusEntity,
        hit: subjectHit,
        organizationId: request.organizationId,
        deps: ctx.deps,
      });
      const related = situation?.related?.length
        ? situation.related
        : [];
      const lead = [
        brief?.lead || `${subjectHit.title}.`,
        situation?.signals?.expiredQuotes?.[0]
          ? `Expired quote in play: ${situation.signals.expiredQuotes[0].title}.`
          : '',
        situation?.signals?.openDeals?.[0]
          ? `Open deal: ${situation.signals.openDeals[0].title}.`
          : '',
      ].filter(Boolean).join(' ');
      const draft = [
        brief?.draft || lead,
        situation?.llmText || '',
        'Write a concise research brief: current situation, risks, and 2–3 practical next steps. Do not dump inventories.',
      ].filter(Boolean).join('\n\n');
      const claims = [
        ...(brief?.claims || []),
        ...(focus?.name ? [{ type: 'record', id: focusId, title: focus.name }] : []),
        ...related.slice(0, 4).map((r) => ({
          type: 'record',
          id: r.id || r.recordId,
          title: r.title || r.name,
        })).filter((c) => c.id && c.title),
      ];
      const polish = await polishWithAgent({
        llm,
        request,
        query,
        draft,
        lead,
        toolResults: situation?.llmText || JSON.stringify({ focus: subjectHit, related: related.slice(0, 10) }),
        history: priorHistory,
        claims,
        brief: true,
        toolResult: brief ? { entity: focusEntity, hits: [subjectHit], related: brief.related } : null,
        intent: 'research',
        situationText: situation?.llmText || '',
      });
      return finish({
        answer: polish.answer,
        blocks: [],
        suggestions: (situation?.suggestionCards?.length
          ? situation.suggestionCards.map((c) => ({ label: c.title, prompt: c.prompt }))
          : (situation?.suggestions || [
            `Draft an email about ${subjectHit.title}`,
            'Create a follow-up task',
            `What is the next best action for ${subjectHit.title}?`,
          ])).slice(0, 4),
        claims,
        tool: 'relationships.context',
        toolResult: { situation: Boolean(situation?.ok), relatedCount: related.length },
        polishedUsed: polish.polishedUsed,
        usage: polish.usage,
        creditsDebited: Number(polish.creditsDebited || 0),
      });
    }

    if (term) {
      const searchTool = registry.getTool('search.crm');
      const toolResult = searchTool
        ? await searchTool.run({ query: `status of ${term}`, limit: 5 }, ctx)
        : null;
      const hit = toolResult?.hits?.[0];
      const lead = hit
        ? `Research hit: ${hit.title}. Dig into relationships and status next.`
        : `I couldn't find "${term}" to research yet.`;
      const claims = (toolResult?.hits || []).slice(0, 3).map((h) => ({
        type: 'record',
        id: h.id,
        title: h.title,
      }));
      const polish = await polishWithAgent({
        llm,
        request,
        query,
        draft: lead,
        lead,
        toolResults: serializeToolResult('crm_search', toolResult),
        history: priorHistory,
        claims,
        brief: true,
        toolResult,
        intent: 'research',
      });
      return finish({
        answer: polish.answer,
        blocks: [],
        suggestions: ['Qualify this lead', 'List organizations'],
        claims,
        tool: 'search.crm',
        toolResult,
        polishedUsed: polish.polishedUsed,
        usage: polish.usage,
        creditsDebited: Number(polish.creditsDebited || 0),
      });
    }

    const lead = 'Who should I research? Name a company or person, or open a record first.';
    const polish = await polishWithAgent({
      llm,
      request,
      query,
      draft: lead,
      lead,
      toolResults: '(none)',
      history: priorHistory,
      claims: [],
    });
    return finish({
      answer: polish.answer,
      blocks: [],
      suggestions: ['List organizations', 'Show me people'],
      claims: [],
      tool: null,
      polishedUsed: polish.polishedUsed,
      usage: polish.usage,
      creditsDebited: Number(polish.creditsDebited || 0),
    });
  }

  if (intent === 'meeting_prep') {
    const searchTool = registry.getTool('search.crm');
    const listBroad = /\b(today|these|all|upcoming|my meetings|my events)\b/i.test(query);
    const turnFocus = resolveTurnFocus({ focus, history: priorHistory, query });
    const focusedEvent = (focus?.kind === 'events' && (focus.name || focus.id))
      ? focus
      : (turnFocus?.kind === 'events' || refersToSameFocus(query) ? turnFocus : null);
    const useFocused = Boolean(
      focusedEvent?.name || focusedEvent?.id,
    ) && (refersToSameFocus(query) || (!listBroad && focusedEvent?.kind === 'events'));

    let toolResult = null;
    let hits = [];

    if (useFocused && focusedEvent) {
      if (focusedEvent.id && !String(focusedEvent.id).startsWith('pending:')) {
        hits = [{
          id: focusedEvent.id,
          title: focusedEvent.name || 'Meeting',
          subtitle: focusedEvent.startDateTime || '',
        }];
        if (searchTool && focusedEvent.name) {
          const found = await searchTool.run({
            query: focusedEvent.name,
            entity: 'events',
            limit: 5,
          }, ctx);
          const needle = String(focusedEvent.name).toLowerCase();
          const match = (found?.hits || []).find((h) => {
            const t = String(h.title || '').toLowerCase();
            return t === needle || t.includes(needle) || needle.includes(t);
          }) || (found?.hits || []).find((h) => String(h.id) === String(focusedEvent.id));
          if (match) hits = [match];
        }
      } else if (focusedEvent.name && searchTool) {
        const found = await searchTool.run({
          query: focusedEvent.name,
          entity: 'events',
          limit: 5,
        }, ctx);
        const needle = String(focusedEvent.name).toLowerCase();
        const match = (found?.hits || []).find((h) => {
          const t = String(h.title || '').toLowerCase();
          return t === needle || t.includes(needle) || needle.includes(t);
        }) || (found?.hits || [])[0];
        hits = match
          ? [match]
          : [{ id: focusedEvent.id || 'focus-event', title: focusedEvent.name, subtitle: focusedEvent.startDateTime || '' }];
      } else if (focusedEvent.name) {
        hits = [{
          id: focusedEvent.id || 'focus-event',
          title: focusedEvent.name,
          subtitle: focusedEvent.startDateTime || '',
        }];
      }
      toolResult = {
        entity: 'events',
        hits,
        counts: { total: hits.length, returned: hits.length },
        focused: true,
      };
      if (request.organizationId && hits[0]) {
        memory.setFocus(request.organizationId, conversationId, {
          kind: 'events',
          moduleKey: 'events',
          id: hits[0].id,
          name: hits[0].title,
          startDateTime: focusedEvent.startDateTime,
        });
      }
    }

    if (!hits.length && searchTool) {
      toolResult = await searchTool.run({ query: 'list of events today', entity: 'events', limit: 10 }, ctx);
      if (!toolResult?.hits?.length) {
        toolResult = await searchTool.run({ query: 'list events', entity: 'events', limit: 10 }, ctx);
      }
      hits = toolResult?.hits || [];
    }

    const names = hits.slice(0, 4).map((h) => h.title).filter(Boolean);
    const todayLine = useFocused && names[0]
      ? `Let's prep for ${names[0]}.`
      : names.length
        ? `You've got ${hits.length} event${hits.length === 1 ? '' : 's'} to prep for${names.length ? ` — starting with ${names.slice(0, 2).join(' and ')}` : ''}.`
        : focus?.name
          ? `Let's prep for ${focus.name}.`
          : "I don't see upcoming events in Arivu yet — open one or ask me to list events.";

    const prepSteps = hits.length
      ? [
        todayLine,
        '',
        'Prep checklist:',
        useFocused
          ? '1. Confirm attendees, agenda, and goal for this meeting.'
          : '1. Open each event and confirm attendees + agenda.',
        '2. Skim related deals/org notes for talking points.',
        '3. Draft a short reminder or follow-up email if needed.',
        '4. Add a prep task if anything is still open.',
      ].join('\n')
      : todayLine;

    const { blocks } = hits.length
      ? buildUiBlocks('crm_search', {
        ...toolResult,
        hits,
        counts: { total: hits.length, returned: hits.length },
        entity: 'events',
      })
      : { blocks: [] };

    const suggestions = [];
    if (names[0]) suggestions.push(`Draft an email about ${names[0]}`);
    suggestions.push('Create a task to prep talking points');
    suggestions.push('What events do I have today?');
    if (focus?.name && focus.kind !== 'events') suggestions.push(`Research ${focus.name}`);

    const claims = hits.slice(0, 5).map((h) => ({ type: 'record', id: h.id, title: h.title }));
    const polish = await polishWithAgent({
      llm,
      request,
      query,
      draft: prepSteps,
      lead: prepSteps,
      toolResults: serializeToolResult('crm_search', toolResult),
      history: priorHistory,
      claims,
      brief: true,
      toolResult,
      intent: 'meeting_prep',
    });

    return finish({
      answer: polish.answer,
      blocks,
      proposals: [],
      suggestions: suggestions.slice(0, 4),
      claims,
      tool: 'search.crm',
      toolResult,
      polishedUsed: polish.polishedUsed,
      usage: polish.usage,
      creditsDebited: Number(polish.creditsDebited || 0),
    });
  }

  if (intent === 'task_create') {
    const toolName = 'crm.tasks.create';
    if (!agentAllowsTool(agent, toolName)) {
      return finish({
        answer: 'This seat cannot create tasks. Try asking from Astra Mission Control.',
        blocks: [],
        suggestions: ['Create a task to follow up'],
        claims: [],
        tool: toolName,
      });
    }
    const tool = registry.getTool(toolName);
    const title = resolveEventTitle(classification, extractTaskTitle(query));
    const relatedTo = focus?.id
      ? { moduleKey: focus.moduleKey || focus.kind, id: focus.id, name: focus.name }
      : null;
    const wantsOverride = /\b(override|create anyway|force it)\b/i.test(query);
    const toolResult = tool
      ? await tool.run({ title, relatedTo, override: wantsOverride }, ctx)
      : null;
    const { proposal, warning, conflictHits } = proposalsFromCreateToolResult(toolResult, toolName, title);
    const lead = warning && toolResult?.guidance
      ? toolResult.guidance
      : `I can create a task titled "${title}". Confirm to save it in Arivu.`;
    const { blocks } = conflictHits.length
      ? buildUiBlocks('crm_search', {
        entity: 'tasks',
        hits: conflictHits,
        counts: { total: conflictHits.length, returned: conflictHits.length },
      })
      : { blocks: [] };
    const claims = [
      { type: 'record', id: 'draft-task', title },
      ...conflictHits.slice(0, 3).map((h) => ({ type: 'record', id: h.id, title: h.title })),
    ];
    const polish = await polishWithAgent({
      llm,
      request,
      query,
      draft: lead,
      lead,
      toolResults: JSON.stringify({
        title,
        relatedTo,
        duplicates: toolResult?.duplicates || [],
        warning,
      }),
      history: priorHistory,
      claims,
      write: true,
    });
    return finish({
      answer: polish.answer,
      blocks,
      proposals: proposal ? [proposal] : [],
      actions: proposal ? [proposal] : [],
      suggestions: warning
        ? ['Cancel — keep existing task', 'List my open tasks']
        : ['List my open tasks', 'Show overdue tasks'],
      claims,
      tool: toolName,
      toolResult,
      polishedUsed: polish.polishedUsed,
      usage: polish.usage,
      creditsDebited: Number(polish.creditsDebited || 0),
      createWarning: warning,
    });
  }

  if (intent === 'calendar_create') {
    const toolName = 'calendar.createEvent';
    const tool = registry.getTool(toolName);

    const slots = await resolveEventCreateSlots({
      query,
      classification,
      llm: deps.llmIntent === false ? null : llm,
      organizationId: request.organizationId,
    });

    const title = isGarbageTitle(slots.title) ? 'Meeting' : slots.title;
    const schedule = scheduleFromLlmSlots({
      day: slots.day,
      time: slots.time,
      meridiem: slots.meridiem,
      durationMinutes: slots.durationMinutes,
    }) || extractEventSchedule(query);

    let relatedTo = focus?.id && focus?.kind === 'organizations'
      ? { moduleKey: focus.moduleKey || focus.kind, id: focus.id, name: focus.name }
      : null;
    let relatedContact = null;
    const searchTool = registry.getTool('search.crm');

    if (!relatedTo && slots.relatedName && searchTool) {
      try {
        const found = await Promise.race([
          searchTool.run({
            query: slots.relatedName,
            entity: 'organizations',
            limit: 5,
          }, ctx),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('related_lookup_timeout')), 800);
          }),
        ]);
        const needle = String(slots.relatedName).toLowerCase();
        const match = (found?.hits || []).find((h) => {
          const t = String(h.title || '').toLowerCase();
          return t === needle || t.includes(needle) || needle.includes(t);
        }) || (found?.hits || [])[0];
        if (match?.id) {
          relatedTo = {
            moduleKey: 'organizations',
            id: match.id,
            name: match.title,
          };
        }
      } catch {
        // best-effort
      }
    }

    if (slots.contactName && searchTool) {
      try {
        const found = await Promise.race([
          searchTool.run({
            query: slots.contactName,
            entity: 'people',
            limit: 5,
          }, ctx),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('contact_lookup_timeout')), 800);
          }),
        ]);
        const needle = String(slots.contactName).toLowerCase();
        const match = (found?.hits || []).find((h) => {
          const t = String(h.title || '').toLowerCase();
          return t === needle || t.includes(needle) || needle.includes(t);
        }) || (found?.hits || [])[0];
        if (match?.id) {
          relatedContact = {
            moduleKey: 'people',
            id: match.id,
            name: match.title,
          };
        }
      } catch {
        // best-effort
      }
    }

    // If user asked for related contact but didn't name one, pull a person linked via org search term
    if (!relatedContact && /\brelated\s+contact\b/i.test(query) && relatedTo?.name && searchTool) {
      try {
        const found = await Promise.race([
          searchTool.run({
            query: relatedTo.name,
            entity: 'people',
            limit: 5,
          }, ctx),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('contact_lookup_timeout')), 800);
          }),
        ]);
        const match = (found?.hits || [])[0];
        if (match?.id) {
          relatedContact = {
            moduleKey: 'people',
            id: match.id,
            name: match.title,
          };
        }
      } catch {
        // best-effort
      }
    }

    const description = slots.description
      || [
        slots.relatedName ? `Organization: ${slots.relatedName}` : null,
        relatedContact?.name ? `Contact: ${relatedContact.name}` : null,
      ].filter(Boolean).join('\n')
      || null;

    const wantsOverride = /\b(override|create anyway|schedule anyway|force it|book it anyway)\b/i.test(query);
    const toolResult = tool
      ? await tool.run({
        title,
        description,
        relatedTo,
        relatedContact,
        startDateTime: schedule.startDateTime,
        endDateTime: schedule.endDateTime,
        durationMinutes: schedule.durationMinutes,
        override: wantsOverride,
      }, ctx)
      : null;

    const { proposal, warning: scheduleWarning, conflictHits } = proposalsFromCreateToolResult(
      toolResult,
      'calendar.createEvent',
      title,
    );

    if (request.organizationId && title) {
      memory.setFocus(request.organizationId, conversationId, {
        kind: 'events',
        moduleKey: 'events',
        id: `pending:${title}`,
        name: title,
        startDateTime: schedule.startDateTime || undefined,
        endDateTime: schedule.endDateTime || undefined,
      });
    }
    const when = schedule.startDateTime
      ? new Date(schedule.startDateTime).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
      : 'the requested time';
    const relatedBit = relatedTo?.name ? ` with ${relatedTo.name}` : (slots.relatedName ? ` with ${slots.relatedName}` : '');
    const contactBit = relatedContact?.name
      ? ` Contact: ${relatedContact.name}.`
      : (slots.contactName ? ` Contact: ${slots.contactName}.` : '');
    const descBit = description ? ` Notes: ${description.split('\n')[0]}` : '';

    let lead;
    if (scheduleWarning && toolResult?.guidance) {
      lead = toolResult.guidance;
    } else {
      lead = `I can create "${title}"${relatedBit} for ${when} (${schedule.durationMinutes} min).${contactBit}${descBit} Confirm to save the event.`;
    }

    const { blocks } = conflictHits.length
      ? buildUiBlocks('crm_search', {
        entity: 'events',
        hits: conflictHits,
        counts: { total: conflictHits.length, returned: conflictHits.length },
      })
      : { blocks: [] };

    const claims = [
      { type: 'record', id: 'draft-event', title },
      ...conflictHits.slice(0, 3).map((h) => ({ type: 'record', id: h.id, title: h.title })),
    ];
    const polish = await polishWithAgent({
      llm,
      request,
      query,
      draft: lead,
      lead,
      toolResults: JSON.stringify({
        title,
        description,
        when,
        durationMinutes: schedule.durationMinutes,
        relatedTo,
        relatedContact,
        startDateTime: schedule.startDateTime,
        slotSource: slots.source,
        conflicts: toolResult?.conflicts || [],
        duplicates: toolResult?.duplicates || [],
        scheduleWarning,
      }),
      history: priorHistory,
      claims,
      write: true,
    });

    const suggestions = scheduleWarning
      ? [
        'Cancel — keep my existing meeting',
        'What events do I have today?',
        conflictHits[0]?.title ? `Open ${conflictHits[0].title}` : 'Show upcoming meetings',
      ].filter(Boolean)
      : ['What events do I have today?', 'Create a follow-up task'];

    return finish({
      answer: polish.answer,
      blocks,
      proposals: proposal ? [proposal] : [],
      actions: proposal ? [proposal] : [],
      suggestions: suggestions.slice(0, 4),
      claims,
      tool: toolName,
      toolResult,
      intentSource: classification.intentSource || null,
      polishedUsed: polish.polishedUsed,
      usage: polish.usage,
      creditsDebited: Number(polish.creditsDebited || 0),
      scheduleWarning,
      createWarning: scheduleWarning,
      slotSource: slots.source,
    });
  }

  if (intent === 'activity_log') {
    const toolName = 'crm.activity.log';
    const tool = registry.getTool(toolName);
    const summary = query.replace(/^(please\s+)?/i, '').slice(0, 200);
    const relatedTo = focus?.id
      ? { moduleKey: focus.moduleKey || focus.kind, id: focus.id, name: focus.name }
      : null;
    const toolResult = tool
      ? await tool.run({ summary, relatedTo, type: /\bcall\b/i.test(query) ? 'call' : 'note' }, ctx)
      : null;
    const proposal = confirmationToProposal(toolResult, 'crm.activity.log');
    return finish({
      answer: `Ready to log: "${summary}". Confirm to save the activity.`,
      blocks: [],
      proposals: proposal ? [proposal] : [],
      actions: proposal ? [proposal] : [],
      suggestions: ['Create a follow-up task', 'List my open deals'],
      claims: [],
      tool: toolName,
      toolResult,
    });
  }

  if (intent === 'email_draft') {
    const emailTurn = await buildEmailDraftTurn({
      query,
      history: priorHistory,
      llm,
      organizationId: request.organizationId,
      focus,
      toolRegistry: registry,
      deps: ctx.deps,
      situation,
    });
    return finish({
      answer: emailTurn.answer,
      blocks: emailTurn.blocks,
      proposals: emailTurn.proposals,
      actions: emailTurn.proposals,
        suggestions: (situation?.suggestionCards?.length
          ? situation.suggestionCards.map((c) => ({ label: c.title, prompt: c.prompt }))
          : (emailTurn.suggestions?.length
            ? emailTurn.suggestions
            : (situation?.suggestions || []))).slice(0, 4),
      claims: [
        ...(emailTurn.focus?.name
          ? [{ type: 'record', id: emailTurn.focus.id || 'focus', title: emailTurn.focus.name }]
          : []),
        ...(emailTurn.topic?.title
          ? [{ type: 'record', id: emailTurn.topic.id || 'topic', title: emailTurn.topic.title }]
          : []),
      ],
      polishedUsed: true,
      tool: 'email.draft',
      toolResult: emailTurn.confirmation,
    });
  }

  const toolName = pickInitialToolName(agent, intent, query);
  if (!agentAllowsTool(agent, toolName)) {
    const allowed = Array.isArray(agent?.tools) ? agent.tools.filter(Boolean).slice(0, 6) : [];
    return finish({
      answer: allowed.length
        ? `The ${agent?.title || agentKey} seat is limited to: ${allowed.join(', ')}. Ask something that fits those tools, or add module.search / search.crm in Settings → AI → Agents → Tools.`
        : `The ${agent?.title || agentKey} seat cannot run ${toolName}. Try a different ask or agent.`,
      blocks: [],
      suggestions: buildSuggestions('clarify', query, null),
      claims: [],
      tool: toolName,
    });
  }

  let briefMode = false;
  let coachMode = false;
  let draft;
  let lead;
  let blocks;
  let claims;
  let actionSuggestions = null;
  let toolResult = null;

  // Page / side-panel focus wins for summarize/status asks — never fan out to pipeline lists.
  const focusEntity = String(focus?.moduleKey || focus?.kind || '').trim().toLowerCase();
  const focusId = String(focus?.id || focus?.recordId || '').trim();
  const focusBriefEntities = FOCUS_BRIEF_ENTITIES;
  if (
    intent === 'crm_search'
    && focusId
    && focusBriefEntities.includes(focusEntity)
    && (wantsRecordBrief(query) || situation?.ok)
  ) {
    const getTool = registry.getTool('crm.record.get');
    let subjectHit = {
      id: focusId,
      title: focus?.name || 'this record',
      subtitle: '',
      status: null,
    };
    if (getTool) {
      const got = await getTool.run({ moduleKey: focusEntity, recordId: focusId }, ctx);
      if (got?.ok && got.record) {
        subjectHit = {
          id: String(got.record.id || focusId),
          title: focus?.name
            || situation?.focus?.title
            || got.record.title
            || 'this record',
          subtitle: got.record.subtitle || situation?.focus?.subtitle || '',
          status: got.record.status || null,
          href: got.record.href || null,
        };
      }
    }
    const brief = await buildRecordStatusBrief({
      entity: focusEntity,
      hit: subjectHit,
      organizationId: request.organizationId,
      deps: ctx.deps,
    });
    if (brief || situation?.ok) {
      briefMode = true;
      const sitLead = situation?.ok
        ? [
          `${situation.focus?.title || subjectHit.title} is on file.`,
          situation.signals?.expiredQuotes?.[0]
            ? `Expired quote: ${situation.signals.expiredQuotes[0].title}.`
            : '',
          situation.signals?.openDeals?.[0]
            ? `Open deal: ${situation.signals.openDeals[0].title}.`
            : '',
          situation.communications?.[0]
            ? `Recent email: ${situation.communications[0].subject}.`
            : '',
          situation.activities?.[0]
            ? `Latest activity: ${situation.activities[0].message || situation.activities[0].action}.`
            : '',
        ].filter(Boolean).join(' ')
        : null;
      lead = sitLead || brief?.lead || `${subjectHit.title}.`;
      draft = [
        brief?.draft || lead,
        situation?.llmText || '',
        'Write a practical situation brief for the user. Use RELATED RECORDS / EMAILS / ACTIVITY above. Never say the record is missing if FOCUS is present. End with one best next action.',
      ].filter(Boolean).join('\n\n');
      blocks = [];
      claims = [
        ...(brief?.claims || []),
        { type: 'record', id: focusId, title: subjectHit.title },
        ...(situation?.related || []).slice(0, 4).map((r) => ({
          type: 'record',
          id: r.id,
          title: r.title,
        })),
      ].filter((c) => c.id && c.title);
      actionSuggestions = situation?.suggestionCards?.length
        ? situation.suggestionCards.slice(0, 4).map((c) => ({ label: c.title, prompt: c.prompt }))
        : (brief?.suggestions || null);
      toolResult = {
        entity: focusEntity,
        brief: true,
        related: situation?.related || brief?.related || [],
        hits: [subjectHit],
        counts: { total: 1, returned: 1 },
        searchTerm: focus?.name || subjectHit.title,
        listIntent: false,
        openOnly: false,
        guidance: `Focused ${focusEntity} situation brief.`,
        situation: situation?.ok
          ? {
            relatedCount: situation.related?.length || 0,
            activityCount: situation.activities?.length || 0,
            emailCount: situation.communications?.length || 0,
          }
          : null,
      };
      updateFocusFromToolResult(memory, request.organizationId, conversationId, toolResult);
    }
  }

  const tool = registry.getTool(toolName);
  if (!briefMode && tool) {
    const relatedModule = focusId
      ? detectRelatedModuleAsk(query, focusEntity)
      : null;

    if (relatedModule) {
      const relTool = registry.getTool('relationships.context');
      const relResult = relTool
        ? await relTool.run({ moduleKey: focusEntity, recordId: focusId }, ctx)
        : null;
      toolResult = relatedHitsToToolResult(relatedModule, relResult?.related || [], query);
      if (!toolResult.hits.length) {
        const name = focus?.name || 'this record';
        lead = relatedModule === 'deals'
          ? `There aren't any open deals tied to ${name} right now.`
          : `I couldn't find related ${relatedModule} for ${name}.`;
        draft = [
          lead,
          `Stay on ${name} — suggest a concrete next step (follow-up, research, or create a ${relatedModule.replace(/s$/, '')}).`,
        ].join(' ');
        blocks = [];
        claims = focus?.name
          ? [{ type: 'record', id: focusId, title: focus.name }]
          : [];
        actionSuggestions = [
          `Research ${name}`,
          `Draft a follow-up email to ${name}`,
          `What is the next best action for ${name}?`,
        ];
        briefMode = true;
      }
    } else {
      // Prefer query/classifier entity over page module — page focus is for grounding, not listing.
      const entityHint = classification.entityHint
        || (focusId ? null : request.entity)
        || null;
      const focusedQuery = focusId && focus?.name && wantsRecordBrief(query)
        ? String(focus.name)
        : query;

      const loop = await runAgentToolLoop({
        registry,
        ctx,
        agent,
        intent,
        query: focusedQuery,
        initialToolName: toolName,
        agentAllowsTool,
      });
      toolResult = loop.toolResult;
      if (toolResult && !toolResult.entity && toolResult.moduleKey) {
        toolResult.entity = toolResult.moduleKey;
      }
      if (toolResult && !toolResult.entity) {
        const fromQuery = /\bpipeline\b|\bdeals?\b/i.test(focusedQuery)
          ? 'deals'
          : (entityHint || null);
        if (fromQuery) toolResult.entity = fromQuery;
      }
      if (toolResult && entityHint && !toolResult.entity) {
        toolResult.entity = entityHint;
      }
      // Attach loop meta for audit/debug
      if (toolResult && loop.steps?.length) {
        toolResult.agentLoopSteps = loop.steps;
      }
      if (!toolResult) {
        const fallbackTool = registry.getTool(toolName);
        toolResult = fallbackTool
          ? await fallbackTool.run(
            {
              query: focusedQuery,
              entity: entityHint,
              moduleKey: entityHint,
              limit: request.limit,
              focus: focusId
                ? { moduleKey: focusEntity, recordId: focusId, name: focus?.name || null }
                : null,
            },
            ctx,
          )
          : null;
      }
    }
  }

  const hitCount = toolResult?.hits?.length || 0;
  const subjectHit = hitCount === 1
    ? toolResult.hits[0]
    : (toolResult?.searchTerm && hitCount > 0 ? toolResult.hits[0] : null);

  if (toolResult && wantsListAnswer(query)) {
    toolResult.listIntent = true;
  }

  if (
    !briefMode
    && intent === 'crm_search'
    && wantsRecordBrief(query)
    && subjectHit
    && ['organizations', 'deals', 'people'].includes(toolResult.entity)
  ) {
    const brief = await buildRecordStatusBrief({
      entity: toolResult.entity,
      hit: subjectHit,
      organizationId: request.organizationId,
      deps: ctx.deps,
    });
    if (brief) {
      briefMode = true;
      draft = brief.draft;
      lead = brief.lead;
      blocks = brief.blocks;
      claims = brief.claims;
      actionSuggestions = brief.suggestions || null;
      toolResult = {
        ...toolResult,
        brief: true,
        related: brief.related,
        hits: [subjectHit],
        counts: { total: 1, returned: 1 },
      };
      updateFocusFromToolResult(memory, request.organizationId, conversationId, toolResult);
    }
  }

  if (
    !briefMode
    && intent === 'crm_search'
    && wantsPipelineCoach(query)
    && !wantsListAnswer(query)
    && toolResult?.entity === 'deals'
    && Array.isArray(toolResult.hits)
    && toolResult.hits.length > 0
  ) {
    const coach = synthesizePipelineNarrative({
      hits: toolResult.hits,
      total: toolResult.counts?.total ?? toolResult.hits.length,
    });
    coachMode = true;
    draft = coach.draft;
    lead = coach.lead;
    actionSuggestions = coach.suggestions;
    const grounded = buildGroundedAnswer(intent, query, toolResult);
    blocks = grounded.blocks;
    claims = grounded.claims.concat(
      toolResult.hits.slice(0, 3).map((h) => ({ type: 'record', id: h.id, title: h.title })),
    );
    if (toolResult.hits.length === 1) {
      updateFocusFromToolResult(memory, request.organizationId, conversationId, toolResult);
    }
  }

  if (!briefMode && !coachMode) {
    const grounded = buildGroundedAnswer(intent, query, toolResult);
    draft = grounded.draft;
    lead = grounded.lead;
    blocks = grounded.blocks;
    claims = grounded.claims;
    if (grounded.toolResult) toolResult = grounded.toolResult;
    if (intent === 'crm_search' && subjectHit) {
      updateFocusFromToolResult(memory, request.organizationId, conversationId, {
        ...toolResult,
        hits: [subjectHit],
      });
    }
  }

  // Mission Control multi-specialist: run at most one extra seat, then merge.
  if (
    mcPlan
    && Array.isArray(mcPlan.specialists)
    && mcPlan.specialists.length > 1
    && (intent === 'meeting_prep' || intent === 'research')
  ) {
    const specialistResults = [{
      agentKey: executionAgentKey,
      title: agent?.title || executionAgentKey,
      answer: draft || lead || '',
    }];
    const extraKeys = mcPlan.specialists.slice(1, 2);
    const runExtra = async (key) => {
      const seat = agents.getAgent(key);
      if (!seat) return null;
      const initial = pickInitialToolName(seat, intent, query);
      const loop = await runAgentToolLoop({
        registry,
        ctx: { ...ctx, agentKey: key },
        agent: seat,
        intent,
        query,
        initialToolName: initial,
        agentAllowsTool,
      });
      const grounded = buildGroundedAnswer(intent, query, loop.toolResult);
      return {
        agentKey: key,
        title: seat.title || key,
        answer: grounded.draft || grounded.lead || loop.toolResult?.guidance || '',
      };
    };
    if (mcPlan.parallel) {
      const extras = await Promise.all(extraKeys.map((k) => runExtra(k)));
      for (const r of extras) if (r) specialistResults.push(r);
    } else {
      for (const k of extraKeys) {
        const r = await runExtra(k);
        if (r) specialistResults.push(r);
      }
    }
    const mcAgent = agents.getAgent('mission-control');
    const merged = await mergeSpecialistOutputs({
      query,
      plan: mcPlan,
      specialistResults,
      llm,
      missionControlHint: mcAgent?.systemHint || '',
    });
    if (merged?.answer) {
      draft = merged.answer;
      lead = merged.answer;
    }
  }

  let answer = lead;
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let polishedUsed = false;
  const listMode = wantsListAnswer(query);

  const polish = await polishWithAgent({
    llm,
    request,
    query,
    draft: briefMode && situation?.llmText
      ? `${draft || lead}\n\n${situation.llmText}\n\nRespond with practical judgment for this situation — not a data dump.`
      : (coachMode
        ? `${draft || lead}\n\nWrite a concise coworker summary of this pipeline — priorities and risks, not a numbered database dump.`
        : draft),
    lead,
    toolResults: serializeToolResult(intent, toolResult, { list: listMode }),
    history: priorHistory,
    claims,
    brief: listMode ? false : (briefMode || coachMode || Boolean(situation?.ok && focusId)),
    list: listMode,
    toolResult,
    intent,
    situationText: situation?.llmText || '',
  });
  answer = polish.answer;
  polishedUsed = polish.polishedUsed;
  usage = polish.usage || usage;
  if (polish.error) {
    console.warn('[astra.orchestrator] llm polish failed:', polish.error?.message || polish.error);
  }

  // If polish was skipped/failed, retry once with a short coworker prompt (still grounded).
  if (!polishedUsed && (forcePolish || intent === 'crm_search' || intent === 'knowledge') && (forcePolish || (toolResult?.hits?.length || 0) > 0)) {
    const retry = await polishCoworkerAnswer({
      llm,
      request,
      query,
      draft: listMode
        ? [
          lead || draft || '',
          '',
          'One short sentence with the count. Do not reprint rows — UI list shows them.',
        ].join('\n')
        : [
          lead || draft || '',
          '',
          forcePolish
            ? 'Write 3–6 short bullets for this canvas panel. No preamble. No tool narration.'
            : 'Facts (UI will show cards — do not dump as a numbered list):',
          ...(forcePolish
            ? []
            : (toolResult?.hits || []).slice(0, 8).map((h) => `- ${h.title}${h.subtitle ? ` (${h.subtitle})` : ''}${h.amount != null ? ` · ${h.amount}` : ''}`)),
          '',
          forcePolish
            ? 'Ground only on the situation context and named party in the ask.'
            : 'Write 2–4 short sentences: overall picture, what needs attention, one next step.',
        ].join('\n'),
      lead,
      toolResults: serializeToolResult(intent, toolResult, { list: listMode }),
      history: priorHistory.slice(-4),
      claims,
      brief: !listMode,
      list: listMode,
      toolResult,
      intent,
      situationText: situation?.llmText || '',
      agentSystemHint: agent?.systemHint || '',
      forcePolish,
    });
    if (retry.polishedUsed) {
      answer = retry.answer;
      polishedUsed = true;
      usage = retry.usage || usage;
    } else if (retry.error) {
      console.warn('[astra.orchestrator] llm polish retry failed:', retry.error?.message || retry.error);
    }
  }

  if (polishedUsed && looksLikeDbDump(answer, { allowList: listMode || forcePolish }) && lead && !forcePolish) {
    answer = lead;
    polishedUsed = false;
  } else if (polishedUsed && !forcePolish && /open deals:\s*0|total organizations|found \d+ (organization|deal)/i.test(answer) && lead) {
    answer = lead;
    polishedUsed = false;
  }

  const suggestions = Array.isArray(actionSuggestions) && actionSuggestions.length
    ? actionSuggestions.slice(0, 4)
    : (situation?.suggestionCards?.length
      ? situation.suggestionCards.slice(0, 4).map((c) => ({ label: c.title, prompt: c.prompt }))
      : (situation?.suggestions?.length
        ? situation.suggestions.slice(0, 4)
        : buildSuggestions(intent, query, toolResult)));

  return finish({
    answer,
    // Avoid dumping large unrelated lists when we answered from focused situation.
    blocks: briefMode && situation?.ok ? [] : blocks,
    suggestions,
    toolResult,
    claims,
    grounded: !polishedUsed || claims.length > 0,
    polishedUsed,
    usage,
    creditsDebited: Number(polish.creditsDebited || 0),
    tool: toolName,
  });
}

module.exports = {
  runOrchestrator,
  classifyIntent,
  classifyIntentDetailed,
  classifyIntentPrecise,
  buildGroundedAnswer,
  buildSuggestions,
  serializeToolResult,
  mentionsAnyClaim,
};
