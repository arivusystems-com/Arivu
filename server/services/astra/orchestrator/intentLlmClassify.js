'use strict';

/**
 * Precise intent classification — LLM for every query.
 *
 * Contract:
 * - Intent MUST be from the allow-list
 * - Never invent CRM facts here (routing only)
 * - LLM is primary; heuristics are fallback-only when LLM returns null
 * - Safety: action language must never silently become crm_search
 * - If uncertain → clarify (never silent open-deals)
 * - Conversation history + focus are passed so anaphora resolves correctly
 */

const {
  classifyIntentDetailed,
  INTENT_AGENT,
} = require('./intentRegistry');

const ALLOWED_INTENTS = new Set([
  'workflow',
  'playbook',
  'email_draft',
  'task_create',
  'calendar_create',
  'activity_log',
  'case_create',
  'deal_update',
  'record_update',
  'quote_draft',
  'research',
  'meeting_prep',
  'chitchat',
  'knowledge',
  'crm_search',
  'clarify',
]);

const ACTION_INTENTS = new Set([
  'email_draft',
  'task_create',
  'calendar_create',
  'activity_log',
  'case_create',
  'deal_update',
  'record_update',
  'quote_draft',
  'meeting_prep',
  'playbook',
  'research',
]);

const WRITE_VERBS = /\b(create|add|book|schedule|make|new|update|mark|draft|log|send|remind|open)\b/i;
const PREP_VERBS = /\b(prep|prepare|preparation|help me prepare)\b/i;
const LIST_VERBS = /\b(list|show|find|get|give me|how many|count|status of|what('?s| is) the status)\b/i;

/** Exact tool (or handler) each intent must use. */
const INTENT_TOOL_ROUTE = {
  workflow: 'workflow.run',
  playbook: 'playbook.run',
  email_draft: 'email.draft',
  task_create: 'crm.tasks.create',
  calendar_create: 'calendar.createEvent',
  activity_log: 'crm.activity.log',
  case_create: 'crm.cases.create',
  deal_update: 'crm.deals.update',
  record_update: 'module.update',
  quote_draft: 'quotes.draft',
  research: 'relationships.context',
  meeting_prep: 'search.crm',
  chitchat: null,
  knowledge: 'knowledge.search',
  crm_search: 'search.crm',
  clarify: null,
};

const MAX_HISTORY_TURNS = 24;
const MAX_TURN_CHARS = 4000;

function pack(intent, confidence, reason, extra = {}) {
  return {
    intent,
    confidence,
    agentKey: INTENT_AGENT[intent] || 'clarifier',
    reason,
    tool: INTENT_TOOL_ROUTE[intent] ?? null,
    ...extra,
  };
}

function parseLlmIntentJson(text) {
  const raw = String(text || '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    const intent = String(parsed.intent || '').trim();
    if (!ALLOWED_INTENTS.has(intent)) return null;
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0.7));
    const durationRaw = parsed.durationMinutes ?? parsed.duration_minutes;
    const durationMinutes = Number.isFinite(Number(durationRaw))
      ? Math.min(24 * 60, Math.max(5, Number(durationRaw)))
      : null;
    return {
      intent,
      confidence,
      title: parsed.title ? String(parsed.title).slice(0, 255) : null,
      entity: parsed.entity ? String(parsed.entity).slice(0, 40) : null,
      relatedName: (parsed.relatedName || parsed.related_name)
        ? String(parsed.relatedName || parsed.related_name).slice(0, 255)
        : null,
      topic: parsed.topic ? String(parsed.topic).slice(0, 1000) : null,
      day: parsed.day ? String(parsed.day).slice(0, 40) : null,
      time: parsed.time ? String(parsed.time).slice(0, 20) : null,
      meridiem: parsed.meridiem ? String(parsed.meridiem).slice(0, 4) : null,
      durationMinutes,
      reason: 'llm_primary',
    };
  } catch {
    return null;
  }
}

/**
 * Build schedule from LLM slots; returns null if time/day insufficient.
 */
function scheduleFromLlmSlots(slots = {}) {
  if (!slots || (!slots.time && slots.durationMinutes == null && !slots.day)) {
    return null;
  }

  let hours = null;
  let minutes = 0;
  const timeRaw = String(slots.time || '').trim();
  const timeMatch = timeRaw.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (timeMatch) {
    hours = Number(timeMatch[1]);
    minutes = Number(timeMatch[2] || 0);
  }
  const mer = String(slots.meridiem || '').toLowerCase().replace(/\./g, '');
  if (hours != null) {
    if (mer === 'pm' && hours < 12) hours += 12;
    if (mer === 'am' && hours === 12) hours = 0;
  }

  const durationMinutes = Number.isFinite(Number(slots.durationMinutes))
    ? Number(slots.durationMinutes)
    : 30;

  if (hours == null) return null;

  const start = new Date();
  start.setSeconds(0, 0);
  const day = String(slots.day || '').toLowerCase();
  if (day === 'tomorrow' || /\btomorrow\b/.test(day)) {
    start.setDate(start.getDate() + 1);
  } else if (day === 'today' || /\btoday\b/.test(day)) {
    // keep
  }
  start.setHours(hours, minutes, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return {
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    durationMinutes,
    source: 'llm',
  };
}

/** Prefer LLM title/topic; never keep filler phrases from regex. */
function resolveEventTitle(slots, fallbackTitle) {
  const { isGarbageTitle } = require('./extractEventSlots');
  const llmTitle = String(slots?.llmTitle || slots?.title || '').trim();
  const related = String(slots?.llmRelatedName || slots?.relatedName || '').trim();
  const topic = String(slots?.llmTopic || slots?.topic || '').trim();
  if (llmTitle && !isGarbageTitle(llmTitle)) return llmTitle.slice(0, 255);
  if (related && topic && !isGarbageTitle(topic)) return `${topic}`.slice(0, 255);
  if (topic && !isGarbageTitle(topic)) return topic.slice(0, 255);
  if (related) return `${related} meeting`.slice(0, 255);
  const fb = String(fallbackTitle || '').trim();
  if (fb && !isGarbageTitle(fb)) return fb.slice(0, 255);
  return 'Meeting';
}

function formatFocus(focus) {
  if (!focus || typeof focus !== 'object') return 'none';
  const kind = focus.kind || focus.moduleKey || null;
  if (!kind && !focus.name && !focus.id && !focus.recordId) return 'none';
  const bits = [];
  if (kind) bits.push(`kind=${kind}`);
  if (focus.name) bits.push(`name=${String(focus.name).slice(0, 120)}`);
  const id = focus.id || focus.recordId;
  if (id) bits.push(`id=${String(id).slice(0, 64)}`);
  if (focus.moduleKey && focus.moduleKey !== kind) bits.push(`module=${focus.moduleKey}`);
  return bits.join(' ') || 'none';
}

function formatHistory(history = []) {
  const turns = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : [];
  if (!turns.length) return 'none';
  return turns.map((t) => {
    const role = String(t?.role || 'user').toUpperCase();
    const content = String(t?.content || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TURN_CHARS);
    return `${role}: ${content}`;
  }).join('\n');
}

/**
 * LLM result wins when present. Heuristic only used when llmClass is null.
 * Sole safety overlay: guardActionVsSearch.
 */
function mergeIntent(heuristic, llmClass, query) {
  const q = String(query || '');
  const h = heuristic || pack('clarify', 0.4, 'missing_heuristic');

  if (!llmClass) {
    return guardActionVsSearch({
      ...h,
      reason: h.reason || 'heuristic_fallback',
      intentSource: 'heuristic',
    }, q);
  }

  const llmPacked = pack(llmClass.intent, llmClass.confidence, llmClass.reason || 'llm_primary', {
    llmTitle: llmClass.title || null,
    entityHint: llmClass.entity || null,
    llmRelatedName: llmClass.relatedName || null,
    llmTopic: llmClass.topic || null,
    llmDay: llmClass.day || null,
    llmTime: llmClass.time || null,
    llmMeridiem: llmClass.meridiem || null,
    llmDurationMinutes: llmClass.durationMinutes,
    intentSource: 'llm',
  });

  if (llmPacked.confidence < 0.55) {
    return pack('clarify', llmPacked.confidence, 'llm_low_confidence');
  }

  return guardActionVsSearch(llmPacked, q);
}

/** Last-line defense: action language must never become crm_search. */
function guardActionVsSearch(classification, query) {
  const q = String(query || '');
  if (classification.intent !== 'crm_search') {
    return { ...classification, tool: INTENT_TOOL_ROUTE[classification.intent] ?? classification.tool };
  }

  const looksLikeAction = (WRITE_VERBS.test(q) || PREP_VERBS.test(q)) && !LIST_VERBS.test(q);
  if (!looksLikeAction) {
    return { ...classification, tool: 'search.crm' };
  }

  const again = classifyIntentDetailed(q, {});
  if (again.intent !== 'crm_search') {
    return pack(again.intent, again.confidence, 'guard_action_vs_search', {
      agentKey: again.agentKey,
    });
  }

  return pack('clarify', 0.45, 'guard_blocked_wrong_search');
}

async function classifyIntentWithLlm({
  query,
  heuristic,
  llm,
  organizationId = null,
  history = [],
  focus = null,
}) {
  if (typeof llm !== 'function') return null;

  const allowed = [...ALLOWED_INTENTS].filter((i) => i !== 'workflow').join(', ');
  const messages = [
    {
      role: 'system',
      content: [
        'You are Astra\'s intent router for Arivu CRM.',
        'Choose exactly ONE intent from the allow-list. Return ONLY JSON.',
        'You MUST classify every user message AND extract slots for write intents. Use CONVERSATION_HISTORY and FOCUS for pronouns/anaphora.',
        'Rules (strict):',
        '1) create/add/book/schedule + event/meeting/appointment → calendar_create (NOT crm_search).',
        '2) create/add + task/todo/remind → task_create.',
        '3) draft/write/compose + email/mail → email_draft.',
        '4) create/open + case/ticket → case_create.',
        '5) prepare/prep for meeting/event/call → meeting_prep (NOT a plain list).',
        '6) "the same/this/that meeting|event|call" referring to a just-created or focused event → meeting_prep.',
        '7) draft/create quote/proposal → quote_draft.',
        '8) mark/update deal won/lost/stage → deal_update.',
        '8b) update/change/set/mark status or any field on an existing event/task/case/person/org/record → record_update (NOT crm_search). Include entity when clear.',
        '9) research/enrich company/contact → research.',
        '10) list/show/find/how many/status of → crm_search.',
        '11) how to/configure/explain product → knowledge.',
        '12) hi/thanks/what time → chitchat.',
        '13) If unsure between action and search, pick the ACTION intent or clarify — NEVER invent a deals/events list.',
        'Slot rules for calendar_create / task_create:',
        '- title: short clean event/task name (NOT a verbatim clause dump). Prefer topic + org, e.g. "NextGen Platform kickoff — Vtiger CRM".',
        '- relatedName: organization or contact name if mentioned.',
        '- topic: agenda/subject if given.',
        '- day: today|tomorrow|empty.',
        '- time: HH:MM as spoken (e.g. "11:00" for 11AM).',
        '- meridiem: am|pm when stated or clearly implied.',
        '- durationMinutes: integer minutes when stated.',
        '- entity: organizations|people|events|deals|tasks|cases when relevant.',
        `Allow-list: ${allowed}`,
        'JSON shape: {"intent":"...","confidence":0.0,"title":"optional","entity":"optional","relatedName":"optional","topic":"optional","day":"optional","time":"optional","meridiem":"optional","durationMinutes":null}',
        'Examples:',
        'USER: Create a event for vtiger tomorrow at 10am → {"intent":"calendar_create","confidence":0.96,"title":"Vtiger CRM meeting","relatedName":"Vtiger CRM","day":"tomorrow","time":"10:00","meridiem":"am","durationMinutes":30,"entity":"organizations"}',
        'USER: Create an event with Vtiger CRM organization tomorrow 11AM for 30 min regarding initiating NextGen Platform → {"intent":"calendar_create","confidence":0.97,"title":"NextGen Platform — Vtiger CRM","relatedName":"Vtiger CRM","topic":"initiating NextGen Platform with AI capabilities","day":"tomorrow","time":"11:00","meridiem":"am","durationMinutes":30,"entity":"organizations"}',
        'USER: Help me prepare for these events now → {"intent":"meeting_prep","confidence":0.94}',
        'USER: Now help me prepare for the same meeting (FOCUS events) → {"intent":"meeting_prep","confidence":0.95}',
        'USER: The title of the event is : July 19th deal Followup make this event as completed → {"intent":"record_update","confidence":0.96,"title":"July 19th deal Followup","entity":"events"}',
        'USER: mark this task as completed → {"intent":"record_update","confidence":0.95,"entity":"tasks"}',
        'USER: set priority of this case to high → {"intent":"record_update","confidence":0.94,"entity":"cases"}',
        'USER: list events today → {"intent":"crm_search","confidence":0.95,"entity":"events"}',
        'USER: create a task to call Ada → {"intent":"task_create","confidence":0.95,"title":"Call Ada"}',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `USER: ${query}`,
        `FOCUS: ${formatFocus(focus)}`,
        'CONVERSATION_HISTORY:',
        formatHistory(history),
        `HEURISTIC_HINT (fallback only, do not blindly copy): ${heuristic?.intent || 'unknown'} @ ${heuristic?.confidence ?? 0}`,
        'Respond with JSON only. For creates, always fill title/time/day/duration when the user stated them.',
      ].join('\n'),
    },
  ];

  try {
    const completion = await llm(messages, {
      organizationId,
      temperature: 0,
      maxTokens: 280,
    });
    return parseLlmIntentJson(completion?.text);
  } catch {
    return null;
  }
}

/**
 * LLM for every query (unless explicitly disabled for tests).
 * @param {string} query
 * @param {object} request
 * @param {{ llm?: function, llmIntent?: boolean, organizationId?: string, history?: array, focus?: object|null }} [options]
 */
async function classifyIntentPrecise(query, request = {}, options = {}) {
  const q = String(query || '').trim();
  const heuristic = classifyIntentDetailed(q, request);

  // Explicit steps / playbook already decided by structured request
  if (heuristic.intent === 'workflow' || heuristic.intent === 'playbook') {
    return { ...heuristic, tool: INTENT_TOOL_ROUTE[heuristic.intent] };
  }

  if (!q) {
    return pack('chitchat', 0.9, 'empty');
  }

  // Default: always call AI. Tests may set llmIntent:false.
  const useLlm = options.llmIntent !== false && typeof options.llm === 'function';
  if (!useLlm) {
    return guardActionVsSearch({ ...heuristic, reason: heuristic.reason || 'heuristic_fallback' }, q);
  }

  const llmClass = await classifyIntentWithLlm({
    query: q,
    heuristic,
    llm: options.llm,
    organizationId: options.organizationId || request.organizationId || null,
    history: options.history || request.history || [],
    focus: options.focus !== undefined ? options.focus : (request.focus || null),
  });

  return mergeIntent(heuristic, llmClass, q);
}

/** @deprecated use classifyIntentPrecise — kept for boost detection in tests */
function needsLlmIntentBoost() {
  return true;
}

module.exports = {
  ALLOWED_INTENTS,
  ACTION_INTENTS,
  INTENT_TOOL_ROUTE,
  WRITE_VERBS,
  PREP_VERBS,
  parseLlmIntentJson,
  classifyIntentWithLlm,
  mergeIntent,
  guardActionVsSearch,
  classifyIntentPrecise,
  needsLlmIntentBoost,
  formatFocus,
  formatHistory,
  scheduleFromLlmSlots,
  resolveEventTitle,
};
