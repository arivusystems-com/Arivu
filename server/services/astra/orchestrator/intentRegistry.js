'use strict';

/**
 * Intent registry — workforce router (Phase A+B).
 * UNKNOWN never defaults to crm_search — uses clarifier.
 */

const { isEmailDraftIntent } = require('../experience/buildEmailDraftTurn');
const { detectPlaybook } = require('./playbooks');

/** @typedef {string} AstraIntent */

const CRM_WORDS = /\b(deal|deals|pipeline|opportunity|opportunities|case|cases|ticket|tickets|people|person|contact|contacts|lead|leads|customer|customers|task|tasks|todo|overdue|event|events|meeting|meetings|calendar|appointment|organization|organizations|account|accounts|company|companies|quote|quotes|sales order|sales orders|document|documents|item|items|product|products|form|forms|campaign|campaigns|import|imports|inventory|article|articles|asset|assets|response|responses|submission|submissions|open|list|show|how many|count|status|about)\b/i;

const KNOWLEDGE_WORDS = /\b(how do i|how to|what is|explain|guide|documentation|article|set ?up|configure|steps? to|enable|turn on)\b/i;

const CHITCHAT_WORDS = /\b(hi|hello|hey|thanks|thank you|good (morning|afternoon|evening)|who are you|what('?s| is) (the )?(date|time|day)( today)?)\b/i;

const TASK_CREATE = /\b((create|add|make|new)\b[\s\S]{0,40}\b(task|todo|to-do|reminder)\b|\bremind me\b|\badd a reminder\b)/i;

/** create/book/schedule + meeting|event|appointment|call — not list/show queries */
const CALENDAR_CREATE = /\b((book|schedule|set\s*up|setup|create|add|make|new)\b[\s\S]{0,60}\b(meeting|meetings|appointment|appointments|call|event|events)\b)/i;

const LIST_CALENDAR = /\b(list|show|give\s+me|what|upcoming|how many)\b[\s\S]{0,40}\b(event|events|meeting|meetings|appointment|appointments)\b/i;

const ACTIVITY_LOG = /\b((log|record)\b[\s\S]{0,30}\b(call|meeting|note|activity)\b|(add|create)\b[\s\S]{0,20}\bnote\b)/i;

const CASE_CREATE = /\b((create|open|file|raise|new)\b[\s\S]{0,30}\b(case|ticket|complaint)\b)/i;

const DEAL_UPDATE = /\b((update|move|mark|set)\b[\s\S]{0,40}\b(deal|stage|won|lost)\b|\bmark\s+(as\s+)?(won|lost)\b)/i;

/** Generic field/status update on any module (after deal_update / create intents). */
const RECORD_UPDATE = /\b((update|change|set|edit|modify|rename|patch)\b[\s\S]{0,80}\b(to|as|=|:)\b|\b(mark|make)\b[\s\S]{0,50}\b(as\s+)?(completed?|done|cancelled?|canceled|planned|open|closed|todo|in[\s_-]?progress)\b|\b(update|change|set|edit|modify)\b[\s\S]{0,50}\b(status|priority|stage|owner|title|name|amount|due|field|eventName)\b)/i;

const QUOTE_DRAFT = /\b((draft|create|prepare|make)\b[\s\S]{0,30}\b(quote|quotation|proposal)\b)/i;

const RESEARCH = /\b(research|enrich|look\s*up)\b[\s\S]{0,40}\b(company|organization|account|contact|lead|person)\b/i;

/** Prep for meeting/call/event — not "prepare a quote" (handled by QUOTE_DRAFT). */
const MEETING_PREP = /\b((prep|prepare|preparation)\b[\s\S]{0,40}\b(meeting|meetings|call|event|events)\b|\bmeeting prep\b|\bhelp me (prep|prepare)\b)/i;

/** Intent → default seat (agentKey). Mission Control is the Ask entry; these are specialist hints. */
const INTENT_AGENT = {
  workflow: 'process-intelligence',
  playbook: 'process-intelligence',
  email_draft: 'email',
  task_create: 'task-activity',
  calendar_create: 'task-activity',
  activity_log: 'task-activity',
  case_create: 'case-intelligence',
  deal_update: 'deal-intelligence',
  record_update: 'record-update',
  quote_draft: 'deal-intelligence',
  research: 'customer-360',
  meeting_prep: 'meeting-intelligence',
  chitchat: 'mission-control',
  knowledge: 'knowledge-intelligence',
  crm_search: 'mission-control',
  clarify: 'mission-control',
};

/**
 * @returns {{
 *   intent: string,
 *   confidence: number,
 *   agentKey: string,
 *   reason: string,
 *   playbookKey?: string,
 * }}
 */
function classifyIntentDetailed(query, request = {}) {
  if (Array.isArray(request.steps) && request.steps.length) {
    return pack('workflow', 1, 'request.steps');
  }

  const q = String(query || '').trim();
  if (!q) {
    return pack('chitchat', 0.9, 'empty');
  }

  const playbook = detectPlaybook(q) || (request.playbook ? require('./playbooks').getPlaybook(request.playbook) : null);
  if (playbook) {
    return { ...pack('playbook', 0.95, 'playbook'), playbookKey: playbook.key };
  }

  if (isEmailDraftIntent(q)) {
    return pack('email_draft', 0.95, 'email_draft');
  }

  if (QUOTE_DRAFT.test(q)) {
    return pack('quote_draft', 0.9, 'quote_draft');
  }

  // Before other create/search paths that share "prepare" / "events"
  if (MEETING_PREP.test(q) && !/\b(quote|quotation|proposal)\b/i.test(q)) {
    return pack('meeting_prep', 0.9, 'meeting_prep');
  }

  if (CASE_CREATE.test(q) && !/\b(list|show|open cases|open tickets)\b/i.test(q)) {
    return pack('case_create', 0.9, 'case_create');
  }

  if (DEAL_UPDATE.test(q)) {
    return pack('deal_update', 0.88, 'deal_update');
  }

  // Status/field updates beat create heuristics ("make this event as completed")
  if (
    RECORD_UPDATE.test(q)
    && !TASK_CREATE.test(q)
    && !CASE_CREATE.test(q)
  ) {
    return pack('record_update', 0.9, 'record_update');
  }

  if (TASK_CREATE.test(q) && !/\b(list|show|overdue|due|open)\b[\s\S]{0,20}\b(task|tasks|todo)/i.test(q)) {
    return pack('task_create', 0.92, 'task_create');
  }

  if (CALENDAR_CREATE.test(q) && !LIST_CALENDAR.test(q)) {
    return pack('calendar_create', 0.92, 'calendar_create');
  }

  if (ACTIVITY_LOG.test(q)) {
    return pack('activity_log', 0.88, 'activity_log');
  }

  if (RESEARCH.test(q)) {
    return pack('research', 0.88, 'research');
  }

  if (CHITCHAT_WORDS.test(q) && !CRM_WORDS.test(q)) {
    return pack('chitchat', 0.9, 'chitchat');
  }

  if (KNOWLEDGE_WORDS.test(q) && !/\b(deal|deals|case|cases|task|tasks|event|events|people|contact)\b/i.test(q)) {
    return pack('knowledge', 0.85, 'knowledge');
  }

  if (CRM_WORDS.test(q)) {
    // Pipeline analyst for pure deal/pipeline list asks
    if (/\b(pipeline|open deals|won deals|deal)\b/i.test(q) && !/\b(case|task|people|organization)\b/i.test(q)) {
      return { ...pack('crm_search', 0.85, 'crm_pipeline'), agentKey: 'pipeline-closer' };
    }
    if (/\b(case|cases|ticket|tickets)\b/i.test(q)) {
      return { ...pack('crm_search', 0.85, 'crm_cases'), agentKey: 'case-triage' };
    }
    return pack('crm_search', 0.85, 'crm_words');
  }

  return pack('clarify', 0.4, 'unknown');
}

function pack(intent, confidence, reason) {
  return {
    intent,
    confidence,
    agentKey: INTENT_AGENT[intent] || 'clarifier',
    reason,
  };
}

function classifyIntent(query, request = {}) {
  return classifyIntentDetailed(query, request).intent;
}

function scoreAgentAgainstQuery(agent, query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return 0;
  const tokens = q.split(/\W+/).filter((t) => t.length > 2);
  if (!tokens.length) return 0;

  const title = String(agent.title || '').toLowerCase();
  const description = String(agent.description || '').toLowerCase();
  const phrases = (agent.triggerPhrases || []).map((p) => String(p || '').toLowerCase().trim()).filter(Boolean);
  const hint = String(agent.systemHint || '').toLowerCase();
  const hay = `${title} ${description} ${phrases.join(' ')} ${hint}`;

  let hits = 0;
  for (const t of tokens) {
    if (hay.includes(t)) hits += 1;
  }
  let score = hits / tokens.length;

  // Exact / near-exact trigger phrase match → strong specialist preference
  let phraseBoost = 0;
  for (const p of phrases) {
    if (!p) continue;
    if (q === p || q.includes(p) || p.includes(q)) {
      phraseBoost = Math.max(phraseBoost, 0.55);
    } else {
      const overlap = phraseOverlapTokens(q, p);
      if (overlap >= 0.6) phraseBoost = Math.max(phraseBoost, 0.35);
    }
  }
  score += phraseBoost;

  // Title keyword hit (e.g. "pipeline" agent vs pipeline ask)
  const titleTokens = title.split(/\W+/).filter((t) => t.length > 3);
  if (titleTokens.some((t) => q.includes(t))) score += 0.15;

  const specialistBonus = agent.name === 'coworker' || agent.name === 'clarifier' ? 0 : 0.18;
  return Math.min(1, score + specialistBonus);
}

function phraseOverlapTokens(a, b) {
  const ta = new Set(String(a || '').toLowerCase().split(/\W+/).filter((t) => t.length > 2));
  const tb = new Set(String(b || '').toLowerCase().split(/\W+/).filter((t) => t.length > 2));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const x of ta) if (tb.has(x)) inter += 1;
  return inter / Math.max(ta.size, tb.size);
}

/**
 * Prefer explicit request.agent, then Mission Control (Ask entry).
 * Lexical specialist scoring retained for admin/debug when MC is absent.
 */
function resolveAgentKey(classification, request = {}, agentRegistry = null) {
  const requested = String(request.agent || '').trim();
  if (requested && requested !== 'auto') {
    if (!agentRegistry || agentRegistry.hasAgent(requested)) {
      return requested;
    }
  }

  if (agentRegistry?.hasAgent?.('mission-control')) return 'mission-control';
  if (agentRegistry?.hasAgent?.('coworker')) return 'coworker';

  const query = String(request.query || classification.query || '').trim();
  const GENERIC_SEATS = new Set(['coworker', 'clarifier', 'mission-control', '']);

  if (agentRegistry && typeof agentRegistry.listAgents === 'function' && query) {
    let best = null;
    let bestScore = 0;
    for (const ag of agentRegistry.listAgents()) {
      if (!ag?.name || GENERIC_SEATS.has(ag.name)) continue;
      const score = scoreAgentAgainstQuery(ag, query);
      if (score > bestScore) {
        bestScore = score;
        best = ag.name;
      }
    }
    if (best && bestScore >= 0.22) {
      return best;
    }
  }

  const classified = classification.agentKey || null;
  if (classified && !GENERIC_SEATS.has(classified)) {
    if (!agentRegistry || agentRegistry.hasAgent(classified)) {
      return classified;
    }
  }

  const first = agentRegistry?.listAgents?.()?.find((a) => a.name !== 'clarifier');
  return first?.name || classified || 'mission-control';
}

function extractTaskTitle(query) {
  const q = String(query || '').trim();
  const toMatch = q.match(/\b(?:remind me|reminder)\s+to\s+(.+)$/i)
    || q.match(/\b(?:task|todo|to-do)\s+(?:to\s+|for\s+|about\s+|:?\s*)(.+)$/i)
    || q.match(/\b(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?(?:task|todo|to-do)\s*:?\s*(.+)$/i);
  let title = toMatch?.[1]?.trim().replace(/[?.!]+$/, '').trim();
  if (!title || title.length < 2) title = 'New task';
  if (title.length > 255) title = title.slice(0, 255);
  return title;
}

function extractEventTitle(query) {
  const q = String(query || '').trim();
  // "create an event for Vtiger CRM …" / "book a meeting with Ada …"
  const forMatch = q.match(
    /\b(?:meeting|appointment|call|event)s?\s+(?:with\s+|about\s+|for\s+)(.+?)(?:\s+for\s+tomorrow|\s+tomorrow|\s+at\s+\d|\s+on\s+)/i,
  );
  const createMatch = q.match(
    /\b(?:book|schedule|set\s*up|setup|create|add|make|new)\s+(?:a\s+|an\s+)?(?:meeting|appointment|call|event)s?\s+(?:with\s+|about\s+|for\s+)?(.+?)(?:\s+for\s+tomorrow|\s+tomorrow|\s+at\s+\d|\s+on\s+|$)/i,
  );
  let title = (forMatch?.[1] || createMatch?.[1] || '').trim().replace(/[?.!,]+$/, '').trim();
  // Drop trailing "along with …" noise for a cleaner title, keep org/person core
  title = title.replace(/\balong with\b[\s\S]*$/i, '').trim();
  if (!title || title.length < 2) title = 'Meeting';
  if (title.length > 255) title = title.slice(0, 255);
  return title;
}

/**
 * Parse light schedule hints: tomorrow / at 10:00AM / for 30 mins.
 * @returns {{ startDateTime: string|null, endDateTime: string|null, durationMinutes: number }}
 */
function extractEventSchedule(query) {
  const q = String(query || '');
  const durationMatch = q.match(/\bfor\s+(\d{1,3})\s*(min|mins|minutes|hour|hours|hr|hrs)\b/i);
  let durationMinutes = 30;
  if (durationMatch) {
    const n = Number(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();
    durationMinutes = /hour|hr/.test(unit) ? n * 60 : n;
  }

  const timeMatch = q.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i)
    || q.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
  let hours = 10;
  let minutes = 0;
  if (timeMatch) {
    hours = Number(timeMatch[1]);
    minutes = Number(timeMatch[2] || 0);
    const mer = (timeMatch[3] || '').toLowerCase().replace(/\./g, '');
    if (mer === 'pm' && hours < 12) hours += 12;
    if (mer === 'am' && hours === 12) hours = 0;
  }

  const start = new Date();
  start.setSeconds(0, 0);
  if (/\btomorrow\b/i.test(q)) {
    start.setDate(start.getDate() + 1);
  } else if (/\btoday\b/i.test(q)) {
    // keep date
  }
  start.setHours(hours, minutes, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return {
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    durationMinutes,
  };
}

function extractCaseTitle(query) {
  const q = String(query || '').trim();
  const m = q.match(/\b(?:case|ticket|complaint)\s+(?:for\s+|about\s+|:?\s*)(.+)$/i)
    || q.match(/\b(?:create|open|file|raise)\s+(?:a\s+)?(?:new\s+)?(?:case|ticket)\s*:?\s*(.+)$/i);
  let title = m?.[1]?.trim().replace(/[?.!]+$/, '').trim();
  if (!title || title.length < 2) title = 'New case';
  return title.slice(0, 255);
}

/**
 * Normalize status values per module conventions.
 */
function normalizeUpdateStatus(moduleKey, raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  const mod = String(moduleKey || '').toLowerCase();

  if (mod === 'events') {
    if (/^complet/.test(lower) || lower === 'done') return 'Completed';
    if (/^cancel/.test(lower)) return 'Cancelled';
    if (/^plan/.test(lower)) return 'Planned';
    return value;
  }
  if (mod === 'tasks') {
    if (/^complet/.test(lower) || lower === 'done') return 'completed';
    if (/^cancel/.test(lower)) return 'cancelled';
    if (/^(todo|open|pending)$/.test(lower)) return 'todo';
    if (/progress|doing|in[\s_-]?progress/.test(lower)) return 'in_progress';
    return lower;
  }
  if (mod === 'deals') {
    if (/^won$/.test(lower)) return 'Won';
    if (/^lost$/.test(lower)) return 'Lost';
    if (/^open$/.test(lower)) return 'Open';
    return value;
  }
  if (mod === 'cases') {
    if (/resolv|clos/.test(lower)) return 'resolved';
    if (/^open$/.test(lower)) return 'open';
    return lower;
  }
  return value;
}

/**
 * Prefer explicit entity words in the ask over incidental words inside a title
 * (e.g. "deal" inside "July 19th deal Followup" when user said "event").
 */
function detectUpdateModuleKey(query, focus = null) {
  const q = String(query || '');
  const lower = q.toLowerCase();
  const focusModule = String(focus?.moduleKey || focus?.kind || '').trim().toLowerCase() || null;

  if (/\bevents?\b|\bmeetings?\b|\bappointments?\b/i.test(q)) return 'events';
  if (/\btasks?\b|\btodos?\b|\bto-dos?\b/i.test(q)) return 'tasks';
  if (/\bcases?\b|\btickets?\b/i.test(q)) return 'cases';
  if (/\bpeople\b|\bcontacts?\b|\bleads?\b/i.test(q)) return 'people';
  if (/\borganizations?\b|\baccounts?\b|\bcompan(y|ies)\b/i.test(q)) return 'organizations';
  if (/\bdeals?\b|\bpipeline\b|\bopportunit/i.test(q) && !/\bevents?\b|\btasks?\b/i.test(q)) return 'deals';
  if (/\binvoices?\b/i.test(q)) return 'invoices';
  if (/\bquotes?\b/i.test(q)) return 'quotes';

  if (focusModule) return focusModule;

  const { detectModuleKey } = require('../tools/moduleCatalog');
  return detectModuleKey(lower, null) || null;
}

/**
 * Extract a title/name the user named for the target record.
 */
function extractUpdateRecordTitle(query) {
  const q = String(query || '').trim();
  const titled = q.match(
    /\b(?:title|name)\s+of\s+(?:the\s+)?(?:event|task|deal|case|meeting|record|contact|organization|company)?\s*(?:is\s*:|is|:)\s*["']?(.+?)["']?\s*(?=\s+(?:make|mark|update|change|set|edit)\b|[?.!]|$)/i,
  );
  if (titled?.[1]) {
    return titled[1].replace(/^[:\s]+/, '').trim().slice(0, 255);
  }

  const named = q.match(
    /\b(?:named|called|titled)\s+["']([^"']{2,120})["']/i,
  )
    || q.match(/\b(?:named|called|titled)\s+([A-Za-z0-9][\w\s.'-]{1,120}?)(?=\s+(?:make|mark|update|change|set|as|to)\b|[?.!]|$)/i);
  if (named?.[1]) return named[1].trim().slice(0, 255);

  const quoted = q.match(/["“]([^"”]{2,120})["”]/);
  if (quoted?.[1]) return quoted[1].trim().slice(0, 255);

  return null;
}

/**
 * Heuristic field patch from natural language update asks.
 * @returns {{ moduleKey: string|null, recordTitle: string|null, fields: Record<string, unknown> }}
 */
function extractRecordUpdatePatch(query, focus = null) {
  const q = String(query || '').trim();
  const moduleKey = detectUpdateModuleKey(q, focus);
  const fields = {};
  const recordTitle = extractUpdateRecordTitle(q) || (focus?.name ? String(focus.name).trim() : null);

  const statusMatch = q.match(
    /\b(?:mark|make|set|change|update)\b[\s\S]{0,60}\b(?:status\s+)?(?:to\s+|as\s+)?(completed?|done|cancelled?|canceled|planned|open|closed|won|lost|todo|in[\s_-]?progress|resolved)\b/i,
  )
    || q.match(/\bas\s+(completed?|done|cancelled?|canceled|planned|open|closed|won|lost)\b/i);
  if (statusMatch?.[1]) {
    const status = normalizeUpdateStatus(moduleKey, statusMatch[1]);
    if (status) fields.status = status;
  }

  const priorityMatch = q.match(/\bpriority\b[\s\S]{0,40}\b(high|medium|low|urgent|critical)\b/i);
  if (priorityMatch?.[1]) fields.priority = priorityMatch[1].toLowerCase();

  const stageMatch = q.match(/\bstage\s+(?:to\s+)?([A-Za-z0-9 _-]{2,40})/i);
  if (stageMatch?.[1]) fields.stage = stageMatch[1].trim();

  const amountMatch = q.match(/\bamount\s+(?:to\s+)?\$?\s*([\d,]+(?:\.\d+)?)\b/i);
  if (amountMatch?.[1]) {
    const n = Number(String(amountMatch[1]).replace(/,/g, ''));
    if (Number.isFinite(n)) fields.amount = n;
  }

  const fieldTo = q.match(
    /\b(?:set|change|update|edit|rename)\s+([a-zA-Z][\w.]{1,40})\s+(?:to|as|=)\s+["']?([^"'?\n,]{1,200})["']?/i,
  );
  if (fieldTo?.[1] && fieldTo?.[2]) {
    const key = fieldTo[1].trim();
    const skip = new Set(['status', 'priority', 'stage', 'amount', 'this', 'the', 'a', 'an', 'of']);
    if (!skip.has(key.toLowerCase())) {
      fields[key] = fieldTo[2].trim();
    }
  }

  const rename = q.match(
    /\b(?:rename|retitle)\s+(?:(?:the\s+)?(?:event|task|deal|case|record)\s+)?(?:to\s+)?["']?([^"'?\n]{2,200})["']?/i,
  );
  if (rename?.[1] && !fields.title && !fields.name && !fields.eventName) {
    if (moduleKey === 'events') fields.eventName = rename[1].trim();
    else if (moduleKey === 'tasks') fields.title = rename[1].trim();
    else fields.name = rename[1].trim();
  }

  return {
    moduleKey: moduleKey || null,
    recordTitle: recordTitle || null,
    fields,
  };
}

module.exports = {
  classifyIntent,
  classifyIntentDetailed,
  resolveAgentKey,
  extractTaskTitle,
  extractEventTitle,
  extractEventSchedule,
  extractCaseTitle,
  extractRecordUpdatePatch,
  extractUpdateRecordTitle,
  normalizeUpdateStatus,
  INTENT_AGENT,
  CRM_WORDS,
  CALENDAR_CREATE,
  LIST_CALENDAR,
  RECORD_UPDATE,
};
