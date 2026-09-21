'use strict';

/**
 * Astra Mission Control — intent → multi-specialist plan → merge.
 * Does not mutate Platform data; delegates writes to specialists under confirm.
 */

const { SPECIALIST_KEYS, MISSION_CONTROL_KEY } = require('../agents/defaultAgentCatalog');

const MAX_SPECIALISTS = 6;

/** Heuristic intent → ordered specialist keys (Platform defaults). */
const INTENT_SPECIALISTS = {
  crm_search: ['search', 'summary'],
  knowledge: ['knowledge-intelligence', 'search'],
  email_draft: ['email'],
  task_create: ['task-activity'],
  calendar_create: ['task-activity'],
  activity_log: ['task-activity'],
  case_create: ['case-intelligence', 'record-creation'],
  deal_update: ['deal-intelligence', 'record-update'],
  record_update: ['record-update'],
  quote_draft: ['deal-intelligence', 'record-creation'],
  research: ['customer-360', 'relationship-intelligence', 'search'],
  meeting_prep: [
    'customer-360',
    'relationship-intelligence',
    'conversation-intelligence',
    'meeting-intelligence',
    'deal-intelligence',
    'workday-orchestrator',
  ],
  playbook: ['process-intelligence', 'workday-orchestrator'],
  workflow: ['process-intelligence'],
  chitchat: ['summary'],
  clarify: ['search'],
};

const QUERY_HINTS = [
  { re: /\b(creat(e|ing)|add|new)\b[\s\S]{0,40}\b(record|lead|contact|deal|case|organiz)/i, keys: ['record-creation'] },
  { re: /\b(update|change|set|move|edit)\b[\s\S]{0,40}\b(record|field|stage|status|owner)/i, keys: ['record-update'] },
  { re: /\b(find|search|list|show|where is|look up)\b/i, keys: ['search'] },
  { re: /\b(summar(y|ize)|overview|understand|brief me|what.?s going on)\b/i, keys: ['summary'] },
  { re: /\b(email|reply|draft|outreach|inbox)\b/i, keys: ['email'] },
  { re: /\b(task|todo|follow[- ]?up|remind|schedule|meeting|call)\b/i, keys: ['task-activity'] },
  { re: /\b(pipeline|forecast|quota|coverage|slippage)\b/i, keys: ['forecast-pipeline', 'deal-intelligence'] },
  { re: /\b(deal|opportun)/i, keys: ['deal-intelligence'] },
  { re: /\b(case|ticket|sla|escalat)/i, keys: ['case-intelligence'] },
  { re: /\b(customer 360|account health|churn|renewal)\b/i, keys: ['customer-360'] },
  { re: /\b(relationship|stakeholder|champion|influencer)\b/i, keys: ['relationship-intelligence'] },
  { re: /\b(conversation|sentiment|transcript|call notes)\b/i, keys: ['conversation-intelligence'] },
  { re: /\b(knowledge|faq|article|documentation|how do i)\b/i, keys: ['knowledge-intelligence'] },
  { re: /\b(learn(ing)?|course|lms|training|curriculum|onboarding course|lesson)\b/i, keys: ['knowledge-intelligence', 'search'] },
  { re: /\b(process|workflow|automation|playbook)\b/i, keys: ['process-intelligence'] },
  { re: /\b(kpi|analytics|dashboard|metric|trend|anomaly)\b/i, keys: ['analytics-decision'] },
  { re: /\b(duplicate|data quality|incomplete|stale|dedup)\b/i, keys: ['data-quality'] },
  { re: /\b(integration|sync|webhook|api mapping)\b/i, keys: ['integration-intelligence'] },
  { re: /\b(today|workday|priorit(y|ize)|my day|what should i)\b/i, keys: ['workday-orchestrator'] },
  { re: /\b(prep|prepare)\b[\s\S]{0,40}\b(meeting|call|renewal)\b/i, keys: [
    'customer-360',
    'relationship-intelligence',
    'meeting-intelligence',
    'deal-intelligence',
  ] },
];

function uniqueKeys(keys, agents) {
  const out = [];
  const seen = new Set();
  for (const k of keys) {
    if (!k || seen.has(k)) continue;
    if (!SPECIALIST_KEYS.includes(k)) continue;
    if (agents && typeof agents.hasAgent === 'function' && !agents.hasAgent(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= MAX_SPECIALISTS) break;
  }
  return out;
}

/**
 * Build an execution plan for Mission Control.
 * @returns {{ specialists: string[], parallel: boolean, reason: string, source: string }}
 */
function planSpecialists({
  query = '',
  intent = 'crm_search',
  focus = null,
  agents = null,
  request = {},
} = {}) {
  const explicit = String(request.specialist || request.delegate || '').trim();
  if (explicit && SPECIALIST_KEYS.includes(explicit)) {
    return {
      specialists: uniqueKeys([explicit], agents),
      parallel: false,
      reason: 'request.specialist',
      source: 'explicit',
    };
  }

  const ordered = [];
  const q = String(query || '');

  for (const hint of QUERY_HINTS) {
    if (hint.re.test(q)) ordered.push(...hint.keys);
  }

  const fromIntent = INTENT_SPECIALISTS[intent] || INTENT_SPECIALISTS.crm_search;
  ordered.push(...fromIntent);

  const focusEntity = String(focus?.moduleKey || focus?.kind || '').toLowerCase();
  if (focus?.id || focus?.recordId) {
    ordered.unshift('summary');
    if (focusEntity === 'deals' || focusEntity === 'deal') ordered.unshift('deal-intelligence');
    if (focusEntity === 'cases' || focusEntity === 'case') ordered.unshift('case-intelligence');
    if (focusEntity === 'organizations' || focusEntity === 'organization' || focusEntity === 'accounts') {
      ordered.unshift('customer-360', 'relationship-intelligence');
    }
  }

  if (!ordered.length) ordered.push('search', 'summary');

  const specialists = uniqueKeys(ordered, agents);
  const parallel = specialists.length > 1
    && !specialists.some((k) => k === 'record-creation' || k === 'record-update' || k === 'email' || k === 'task-activity');

  return {
    specialists: specialists.length ? specialists : uniqueKeys(['search'], agents),
    parallel,
    reason: `intent:${intent}`,
    source: 'heuristic',
  };
}

/**
 * Optional LLM refine of the specialist plan (falls back to heuristic).
 */
async function planSpecialistsWithLlm(args = {}) {
  const base = planSpecialists(args);
  const { llm, query, focus, agents } = args;
  // Opt-in only — heuristic plan is the production default (latency/cost).
  if (args.mcPlanLlm !== true || typeof llm !== 'function' || args.llmIntent === false) {
    return base;
  }

  const allow = SPECIALIST_KEYS.filter((k) => !agents || agents.hasAgent?.(k));
  try {
    const focusLine = focus?.moduleKey
      ? `FOCUS: ${focus.moduleKey} ${focus.id || focus.recordId || ''} ${focus.name || focus.title || ''}`.trim()
      : 'FOCUS: none';
    const result = await llm({
      messages: [
        {
          role: 'system',
          content: [
            'You are Astra Mission Control planner for the Arivu Platform.',
            'Pick 1-6 specialist agent keys from ALLOWED for this USER ask.',
            'Prefer the minimum set. Never invent keys.',
            'Return JSON only: {"specialists":["key",...],"parallel":true|false,"reason":"..."}',
            `ALLOWED: ${allow.join(', ')}`,
          ].join('\n'),
        },
        {
          role: 'user',
          content: `${focusLine}\nASK: ${String(query || '').slice(0, 800)}`,
        },
      ],
      temperature: 0,
      maxTokens: 200,
    });
    const text = String(result?.text || result?.content || result || '');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return base;
    const parsed = JSON.parse(text.slice(start, end + 1));
    const specialists = uniqueKeys(
      Array.isArray(parsed.specialists) ? parsed.specialists : [],
      agents,
    );
    if (!specialists.length) return base;
    return {
      specialists,
      parallel: Boolean(parsed.parallel) && specialists.length > 1,
      reason: String(parsed.reason || 'llm_plan').slice(0, 200),
      source: 'llm',
    };
  } catch {
    return base;
  }
}

function buildMergeSystemHint(missionControlHint = '') {
  return [
    missionControlHint || 'You are Astra Mission Control.',
    'Merge specialist outputs into ONE unified Platform answer.',
    'Hide orchestration complexity. Users should never feel multiple agents.',
    'Never invent Platform facts. Prefer verified tool evidence.',
    'If specialists disagree, prefer verified data and state uncertainty.',
    'Structure: Objective, Analysis Summary, Key Insights, Recommended Actions, Supporting Evidence, Confidence, Suggested Follow-up Questions.',
    'Never use the word CRM — say Platform.',
  ].join('\n');
}

/**
 * Merge specialist drafts into a single answer (LLM polish when available).
 */
async function mergeSpecialistOutputs({
  query,
  plan,
  specialistResults = [],
  llm,
  missionControlHint = '',
} = {}) {
  const blocks = specialistResults.map((r) => {
    const body = String(r.answer || r.draft || r.guidance || '').trim();
    return `### ${r.title || r.agentKey}\n${body || '(no output)'}`;
  }).filter(Boolean);

  const grounded = blocks.join('\n\n') || 'No specialist output.';

  if (typeof llm !== 'function') {
    return {
      answer: [
        '## Objective',
        String(query || '').trim() || 'Assist with Platform work',
        '',
        '## Analysis Summary',
        grounded,
        '',
        `## Confidence`,
        plan?.specialists?.length > 1 ? 'Medium' : 'High',
      ].join('\n'),
      source: 'concat',
    };
  }

  try {
    const result = await llm({
      messages: [
        { role: 'system', content: buildMergeSystemHint(missionControlHint) },
        {
          role: 'user',
          content: [
            `USER ASK:\n${String(query || '').slice(0, 1200)}`,
            `PLAN: ${JSON.stringify({ specialists: plan?.specialists, reason: plan?.reason })}`,
            'SPECIALIST OUTPUTS:',
            grounded.slice(0, 12000),
          ].join('\n\n'),
        },
      ],
      temperature: 0.2,
      maxTokens: 1200,
    });
    const text = String(result?.text || result?.content || '').trim();
    if (text) return { answer: text, source: 'llm_merge' };
  } catch {
    // fall through
  }
  return { answer: grounded, source: 'concat_fallback' };
}

function isMissionControlKey(key) {
  return key === MISSION_CONTROL_KEY || key === 'coworker';
}

module.exports = {
  MISSION_CONTROL_KEY,
  MAX_SPECIALISTS,
  planSpecialists,
  planSpecialistsWithLlm,
  mergeSpecialistOutputs,
  buildMergeSystemHint,
  isMissionControlKey,
  INTENT_SPECIALISTS,
};
