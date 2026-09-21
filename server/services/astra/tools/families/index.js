'use strict';

/**
 * Astra v2 tool families — the hardened, production tool surface.
 *
 * Families:
 *   - search.crm     unified CRM lookup (deals/cases/people) with list/open plan
 *   - crm.deals      open pipeline
 *   - crm.cases      case lookup
 *   - crm.people     people/contacts lookup
 *   - knowledge      grounded knowledge search (vector store)
 *   - email          draft/send (write, confirmation-gated)
 *   - calendar       create event (write, confirmation-gated)
 *   - workflow       run a named multi-step workflow
 *   - reports        run a saved/aggregate report (read)
 *
 * SECURITY INVARIANTS (every CRM query):
 *   - scoped to organizationId (tenant isolation)
 *   - excludes soft-deleted rows (deletedAt: null)
 *   - NEVER regexes the full user sentence against a record name
 */

const mongoose = require('mongoose');
const { RISK } = require('../../governance/risk');
const { buildConfirmation } = require('../../governance/confirmAction');
const {
  detectModuleKey,
  getModule,
  buildModuleFilter,
  normalizeModuleHit,
  resolveModel,
  coverageReport,
  escapeRegex: catalogEscapeRegex,
} = require('../moduleCatalog');
const {
  findModuleCreateIssues,
  buildCreateConfirmation,
  hasCreateIssues,
  buildCreateWarningLead,
} = require('../../utils/findModuleCreateIssues');
const {
  findCalendarConflicts,
  buildConflictLead,
} = require('../../utils/findCalendarConflicts');
const {
  runModuleSearch,
  runModuleGet,
  runModuleCreate,
  runModuleUpdate,
} = require('../moduleFabric');
const { groundedRetrieve } = require('../../retrieval/groundedRetriever');
const { applyAskFidelity, stageMongoHintFromAsk } = require('../../experience/answerFidelity');
const {
  executeDealUpdate,
  executeNotesCreate,
  executeActivityLog,
  executeCaseAssign,
  executeCaseResolve,
  executeQuotesSend,
  executeInvoiceSend,
  executeInvoiceVoid,
  executePaymentRecord,
  executePaymentLinkCreate,
  executeNotImplemented,
} = require('../executeConfirmedWrites');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Convert an org id to an ObjectId when valid, otherwise pass through. */
function toOrgId(organizationId) {
  const raw = String(organizationId || '');
  if (mongoose.Types.ObjectId.isValid(raw)) {
    return new mongoose.Types.ObjectId(raw);
  }
  return raw;
}

const escapeRegex = catalogEscapeRegex;

const LIST_WORDS = ['list', 'show', 'view', 'display', 'all', 'my', 'find', 'get', 'browse', 'how many', 'count', 'pipeline'];
const CLOSED_WORDS = ['won', 'lost', 'closed'];

function detectEntity(lower, entityHint) {
  return detectModuleKey(lower, entityHint);
}

/**
 * Extract an explicit name term ONLY from quotes, named/called, or
 * "status/details of <Name> [entity]" — never the full sentence.
 */
function extractSearchTerm(query, entityHint = null) {
  const q = String(query || '').trim();
  if (!q) return null;

  const quoted = q.match(/["'“”‘’]([^"'“”‘’]{2,80})["'“”‘’]/);
  if (quoted && quoted[1].trim()) return quoted[1].trim();

  const named = q.match(/\b(?:named|called|titled|name is|title is)\s+([A-Za-z0-9][A-Za-z0-9 &._-]{1,60})/i);
  if (named && named[1].trim()) {
    return named[1].trim().replace(/[?.!,]+$/, '').trim();
  }

  const statusOf = q.match(
    /\b(?:status|details|info|information|about)\s+(?:of|for)\s+(.+?)$/i,
  );
  if (statusOf && statusOf[1]) {
    let term = statusOf[1].trim().replace(/[?.!,]+$/, '').trim();
    term = stripTrailingEntityWords(term, entityHint);
    if (term.length >= 2) return term;
  }

  return null;
}

function stripTrailingEntityWords(term, entityHint = null) {
  let out = String(term || '').trim();
  const tails = [
    'organization', 'organisations', 'organizations', 'company', 'companies',
    'account', 'accounts', 'deal', 'deals', 'case', 'cases', 'person', 'people',
    'contact', 'contacts', 'task', 'tasks', 'event', 'events', 'quote', 'quotes',
    'item', 'items', 'product', 'products', 'document', 'documents',
  ];
  if (entityHint) {
    const mod = getModule(entityHint);
    if (mod?.synonyms?.length) tails.push(...mod.synonyms);
  }
  const unique = [...new Set(tails.map((t) => t.toLowerCase()))].sort((a, b) => b.length - a.length);
  for (const syn of unique) {
    const re = new RegExp(`\\s+${escapeRegex(syn)}$`, 'i');
    if (re.test(out)) {
      out = out.replace(re, '').trim();
      break;
    }
  }
  return out;
}

/**
 * Plan a CRM search from a natural-language query WITHOUT leaking the whole
 * sentence into a name regex.
 */
function planCrmSearch(rawQuery, options = {}) {
  const query = String(rawQuery || '').trim();
  const lower = query.toLowerCase();

  const entity = detectEntity(lower, options.entityHint);
  const mod = getModule(entity);
  const searchTerm = extractSearchTerm(query, entity);

  const hasClosed = CLOSED_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(lower));
  const listIntent = LIST_WORDS.some((w) => lower.includes(w)) || (!searchTerm && lower.length > 0);
  const wantsToday = /\btoday\b/.test(lower);
  const wantsOverdue = /\boverdue\b/.test(lower);

  let openOnly = /\bopen\b/.test(lower);
  if (entity === 'deals' && !openOnly && listIntent && !hasClosed && !searchTerm) {
    openOnly = true;
  }
  if (entity === 'cases' && openOnly) {
    // keep openOnly — buildModuleFilter applies open case statuses
  }
  if (hasClosed && !/\bopen\b/.test(lower)) {
    openOnly = false;
  }

  const built = buildModuleFilter(entity, {
    organizationId: options.organizationId,
    openOnly,
    overdueOnly: wantsOverdue,
    wantsToday,
    searchTerm,
    toOrgId,
  });

  const parts = [];
  if (built.unsupported) {
    parts.push(mod?.label || entity);
    parts.push('(not yet searchable in Astra)');
  } else if (entity === 'tasks' && built.overdueOnly) parts.push('overdue tasks');
  else if (entity === 'tasks' && wantsToday) parts.push('tasks due today');
  else if (entity === 'events' && wantsToday) parts.push('events today');
  else if (built.openOnly && entity === 'deals') parts.push('open deals');
  else if (built.openOnly && entity === 'cases') parts.push('open cases');
  else parts.push(mod?.label || entity);
  if (searchTerm) parts.push(`matching "${searchTerm}"`);
  else if (listIntent && !built.unsupported) parts.push('(list view)');
  const guidance = `Searching ${parts.join(' ')} in this workspace (excluding trash).`;

  return {
    entity,
    listIntent,
    openOnly: built.openOnly,
    overdueOnly: built.overdueOnly,
    searchTerm,
    filter: built.filter,
    sort: built.sort,
    unsupported: Boolean(built.unsupported),
    guidance,
  };
}

/** Run a find with a defensive, chainable-or-plain query object (mock-friendly). */
async function runList(model, filter, { limit = 25, sort = { updatedAt: -1 } } = {}) {
  let q = model.find(filter);
  if (q && typeof q.sort === 'function') q = q.sort(sort);
  if (q && typeof q.limit === 'function') q = q.limit(limit);
  if (q && typeof q.lean === 'function') q = q.lean();
  return q;
}

async function runCount(model, filter) {
  if (typeof model.countDocuments === 'function') {
    return model.countDocuments(filter);
  }
  return 0;
}

function normalizeHit(entity, row) {
  return normalizeModuleHit(entity, row);
}

function modelFor(entity, deps = {}) {
  return resolveModel(entity, deps);
}

// ---------------------------------------------------------------------------
// tool implementations
// ---------------------------------------------------------------------------

async function runCrmSearch(input = {}, ctx = {}) {
  const plan = planCrmSearch(input.query || '', {
    organizationId: ctx.organizationId,
    entityHint: input.entity,
  });

  if (plan.unsupported) {
    return {
      entity: plan.entity,
      listIntent: plan.listIntent,
      openOnly: false,
      overdueOnly: false,
      searchTerm: plan.searchTerm,
      hits: [],
      counts: { total: 0, returned: 0 },
      guidance: plan.guidance,
      unsupported: true,
    };
  }

  let filter = plan.filter;
  const stageHint = stageMongoHintFromAsk(input.query || '', plan.entity);
  if (stageHint) {
    filter = { ...filter, ...stageHint };
  }
  if (plan.entity === 'organizations' && ctx.organizationId) {
    const { buildTenantAccessibleCrmOrganizationQuery } = require('../../../../utils/crmOrganizationAccess');
    filter = await buildTenantAccessibleCrmOrganizationQuery(ctx.organizationId);
    if (plan.searchTerm) {
      filter = {
        ...filter,
        name: { $regex: escapeRegex(plan.searchTerm), $options: 'i' },
      };
    }
  }

  const model = modelFor(plan.entity, ctx.deps);
  if (!model || typeof model.find !== 'function') {
    return {
      entity: plan.entity,
      listIntent: plan.listIntent,
      openOnly: plan.openOnly,
      overdueOnly: plan.overdueOnly,
      searchTerm: plan.searchTerm,
      hits: [],
      counts: { total: 0, returned: 0 },
      guidance: `No data model is wired for ${plan.entity} yet.`,
      unsupported: true,
    };
  }

  // Pull a wider page when the ask is semantic so post-filter still has candidates.
  const baseLimit = Math.min(Math.max(Number(input.limit) || 25, 1), 100);
  const limit = stageHint ? Math.min(100, Math.max(baseLimit, 50)) : baseLimit;

  const [rows, total] = await Promise.all([
    runList(model, filter, { limit, sort: plan.sort || { updatedAt: -1 } }),
    runCount(model, filter),
  ]);

  const hits = (Array.isArray(rows) ? rows : []).map((row) => normalizeHit(plan.entity, row));
  const raw = {
    entity: plan.entity,
    listIntent: plan.listIntent,
    openOnly: plan.openOnly,
    overdueOnly: plan.overdueOnly,
    searchTerm: plan.searchTerm,
    hits,
    counts: { total: Number(total) || hits.length, returned: hits.length },
    guidance: plan.guidance,
    query: String(input.query || ''),
  };
  return applyAskFidelity(raw, input.query || '');
}

async function runKnowledgeSearch(input = {}, ctx = {}) {
  const audience = String(input.audience || 'internal').toLowerCase() === 'public'
    ? 'public'
    : 'internal';
  const result = await groundedRetrieve({
    organizationId: ctx.organizationId,
    query: String(input.query || ''),
    topK: Math.min(Math.max(Number(input.topK) || 5, 1), 20),
    audience,
    vectorStore: ctx.deps?.vectorStore || null,
  });
  return {
    hits: (result.hits || []).map((m) => ({
      id: m.id,
      title: m.title || m.citation?.title || '',
      text: m.text || '',
      score: m.score,
      citation: m.citation || null,
      sourceType: m.sourceType,
    })),
    counts: result.counts || { total: 0 },
    citations: result.citations || [],
    guidance: result.guidance,
    weak: Boolean(result.weak),
    refuse: Boolean(result.refuse),
    audience,
  };
}

async function runEmailDraft(input = {}) {
  return {
    draft: {
      to: input.to || '',
      subject: input.subject || '',
      body: input.body || '',
    },
    guidance: 'Draft ready. Review before sending.',
  };
}

async function runEmailSend(input = {}, ctx = {}) {
  const to = String(input.to || '').trim();
  const subject = String(input.subject || '').trim();
  const body = String(input.body || input.text || '').trim();

  if (input.confirmed !== true) {
    return buildConfirmation({
      toolName: 'email.send',
      risk: RISK.WRITE,
      summary: to ? `Send email to ${to}` : 'Send this email (add recipient first)',
      payload: { ...input, to, subject, body },
    });
  }

  if (!to || !to.includes('@')) {
    return {
      ok: false,
      sent: false,
      error: 'ASTRA_EMAIL_NO_RECIPIENT',
      guidance: 'Cannot send — add a recipient email first, then confirm again.',
    };
  }
  if (!subject) {
    return {
      ok: false,
      sent: false,
      error: 'ASTRA_EMAIL_NO_SUBJECT',
      guidance: 'Cannot send — subject is required.',
    };
  }

  try {
    const emailService = require('../../../emailService');
    const result = await emailService.sendCrmEmail({
      to,
      subject,
      text: body,
      html: body ? `<pre style="font-family:inherit;white-space:pre-wrap">${body
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</pre>` : undefined,
      organizationId: ctx.organizationId || null,
      moduleKey: 'people',
      metadata: { source: 'astra', tool: 'email.send' },
    });

    if (!result?.success) {
      return {
        ok: false,
        sent: false,
        error: 'ASTRA_EMAIL_SEND_FAILED',
        guidance: result?.error
          ? `Email was not sent: ${result.error}`
          : 'Email was not sent — outbound email is not configured for this organization.',
      };
    }

    return {
      ok: true,
      sent: true,
      to,
      messageId: result.messageId || null,
      provider: result.provider || null,
      guidance: `Email sent to ${to}.`,
    };
  } catch (err) {
    return {
      ok: false,
      sent: false,
      error: 'ASTRA_EMAIL_SEND_FAILED',
      guidance: `Email was not sent: ${err?.message || 'unexpected error'}`,
    };
  }
}

function relatedModuleKey(relatedTo) {
  return String(relatedTo?.moduleKey || relatedTo?.kind || '').toLowerCase();
}

function orgRelatedId(relatedTo) {
  if (!relatedTo?.id) return null;
  const key = relatedModuleKey(relatedTo);
  if (/^(organizations|organization|orgs?|accounts?)$/.test(key)) {
    return relatedTo.id;
  }
  return null;
}

async function runCalendarCreate(input = {}, ctx = {}) {
  const title = String(input.title || 'Meeting').trim() || 'Meeting';
  const start = input.startDateTime ? new Date(input.startDateTime) : new Date();
  const end = input.endDateTime
    ? new Date(input.endDateTime)
    : new Date(start.getTime() + (Number(input.durationMinutes) || 30) * 60 * 1000);
  const override = input.override === true || input.force === true;
  const Event = modelFor('events', ctx.deps);

  let conflictReport = { conflicts: [], duplicates: [], hits: [], moduleKey: 'events' };
  if (
    Event
    && ctx.organizationId
    && ctx.userId
    && !Number.isNaN(start.getTime())
    && !Number.isNaN(end.getTime())
  ) {
    try {
      conflictReport = await findModuleCreateIssues({
        moduleKey: 'events',
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        title,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        deps: ctx.deps,
      });
    } catch {
      conflictReport = { conflicts: [], duplicates: [], hits: [], moduleKey: 'events' };
    }
  }

  const issues = hasCreateIssues(conflictReport);

  if (input.confirmed !== true) {
    return buildCreateConfirmation({
      toolName: 'calendar.createEvent',
      risk: RISK.WRITE,
      buildConfirmation,
      title,
      moduleKey: 'events',
      payload: {
        title,
        description: input.description || null,
        startDateTime: input.startDateTime || start.toISOString(),
        endDateTime: input.endDateTime || end.toISOString(),
        relatedTo: input.relatedTo || null,
        relatedContact: input.relatedContact || null,
        durationMinutes: Math.round((end - start) / 60000) || 30,
        override: Boolean(override),
      },
      report: conflictReport,
    });
  }

  if (!Event || typeof Event.create !== 'function') {
    return {
      created: false,
      error: 'EVENT_MODEL_UNAVAILABLE',
      guidance: 'Could not create the event — calendar storage is unavailable.',
    };
  }
  if (!ctx.organizationId || !ctx.userId) {
    return {
      created: false,
      error: 'EVENT_CONTEXT_REQUIRED',
      guidance: 'Could not create the event — missing organization or user context.',
    };
  }
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return {
      created: false,
      error: 'EVENT_SCHEDULE_INVALID',
      guidance: 'Could not create the event — start/end time is invalid.',
    };
  }

  if (issues && !override) {
    return {
      created: false,
      error: 'EVENT_SCHEDULE_CONFLICT',
      conflicts: conflictReport.conflicts,
      duplicates: conflictReport.duplicates,
      guidance: 'That time conflicts with an existing meeting (or looks like a duplicate). Override to create anyway, or cancel.',
    };
  }

  try {
    const description = String(input.description || '').trim();
    const contact = input.relatedContact && typeof input.relatedContact === 'object'
      ? input.relatedContact
      : null;
    const doc = await Event.create({
      eventName: title,
      eventType: 'Meeting',
      organizationId: toOrgId(ctx.organizationId),
      assignedTo: toOrgId(ctx.userId),
      createdBy: toOrgId(ctx.userId),
      modifiedBy: toOrgId(ctx.userId),
      startDateTime: start,
      endDateTime: end,
      relatedToId: orgRelatedId(input.relatedTo),
      metadata: {
        astraDescription: description || null,
        astraRelatedOrg: input.relatedTo || null,
        astraRelatedContact: contact,
      },
      deletedAt: null,
    });
    return {
      created: true,
      id: String(doc._id || doc.id || ''),
      title: doc.eventName || title,
      guidance: override && issues
        ? 'Event created (override applied).'
        : 'Event created.',
      overridden: Boolean(override && issues),
    };
  } catch (err) {
    return {
      created: false,
      error: 'EVENT_CREATE_FAILED',
      guidance: `Could not create the event: ${err?.message || 'unknown error'}`,
    };
  }
}

async function runTaskCreate(input = {}, ctx = {}) {
  const title = String(input.title || 'New task').trim() || 'New task';
  const override = input.override === true || input.force === true;

  let report = { conflicts: [], duplicates: [], hits: [], moduleKey: 'tasks' };
  if (ctx.organizationId) {
    try {
      report = await findModuleCreateIssues({
        moduleKey: 'tasks',
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        title,
        deps: ctx.deps,
      });
    } catch {
      report = { conflicts: [], duplicates: [], hits: [], moduleKey: 'tasks' };
    }
  }
  const issues = hasCreateIssues(report);

  if (input.confirmed !== true) {
    return buildCreateConfirmation({
      toolName: 'crm.tasks.create',
      risk: RISK.WRITE,
      buildConfirmation,
      title,
      moduleKey: 'tasks',
      payload: {
        title,
        dueDate: input.dueDate || null,
        priority: input.priority || 'medium',
        relatedTo: input.relatedTo || null,
        override: Boolean(override),
      },
      report,
    });
  }

  const Task = modelFor('tasks', ctx.deps);
  if (!Task || typeof Task.create !== 'function') {
    return {
      created: false,
      error: 'TASK_MODEL_UNAVAILABLE',
      guidance: 'Could not create the task — task storage is unavailable.',
    };
  }
  if (!ctx.organizationId || !ctx.userId) {
    return {
      created: false,
      error: 'TASK_CONTEXT_REQUIRED',
      guidance: 'Could not create the task — missing organization or user context.',
    };
  }

  if (issues && !override) {
    return {
      created: false,
      error: 'TASK_DUPLICATE',
      conflicts: report.conflicts,
      duplicates: report.duplicates,
      guidance: 'A similar open task already exists. Override to create anyway, or cancel.',
    };
  }

  const related = input.relatedTo || null;
  const relatedKey = relatedModuleKey(related);
  let relatedTo;
  if (related?.id) {
    if (/^(people|person|contacts?)$/.test(relatedKey)) {
      relatedTo = { type: 'contact', id: related.id };
    } else if (/^(deals?)$/.test(relatedKey)) {
      relatedTo = { type: 'deal', id: related.id };
    } else if (/^(organizations|organization|orgs?|accounts?)$/.test(relatedKey)) {
      relatedTo = { type: 'organization', id: related.id };
    }
  }

  try {
    const doc = await Task.create({
      title,
      organizationId: toOrgId(ctx.organizationId),
      createdBy: toOrgId(ctx.userId),
      assignedTo: toOrgId(ctx.userId),
      status: 'todo',
      priority: input.priority || 'medium',
      dueDate: input.dueDate || undefined,
      relatedTo: relatedTo || { type: 'none' },
      deletedAt: null,
    });
    return {
      created: true,
      id: String(doc._id || doc.id || ''),
      title,
      guidance: override && issues ? 'Task created (override applied).' : 'Task created.',
      overridden: Boolean(override && issues),
    };
  } catch (err) {
    return {
      created: false,
      error: 'TASK_CREATE_FAILED',
      guidance: `Could not create the task: ${err?.message || 'unknown error'}`,
    };
  }
}

async function runNotesCreate(input = {}, ctx = {}) {
  const body = String(input.body || input.text || '').trim();
  if (input.confirmed !== true) {
    return buildConfirmation({
      toolName: 'crm.notes.create',
      risk: RISK.WRITE,
      summary: `Add note${body ? `: ${body.slice(0, 60)}` : ''}`,
      payload: { body, relatedTo: input.relatedTo || null },
    });
  }
  return executeNotesCreate(input, ctx);
}

async function runActivityLog(input = {}, ctx = {}) {
  const summary = String(input.summary || input.title || 'Activity').trim();
  if (input.confirmed !== true) {
    return buildConfirmation({
      toolName: 'crm.activity.log',
      risk: RISK.WRITE,
      summary: `Log activity: ${summary}`,
      payload: {
        summary,
        type: input.type || 'note',
        relatedTo: input.relatedTo || null,
      },
    });
  }
  return executeActivityLog(input, ctx);
}

async function runReports(input = {}, ctx = {}) {
  // Read-only aggregate stub grounded in a real count when models are present.
  const entity = String(input.entity || 'deals');
  const model = modelFor(entity, ctx.deps);
  if (!model) {
    return { report: input.report || 'count', total: 0, filter: {}, guidance: `No model for ${entity}.` };
  }
  const built = buildModuleFilter(entity, {
    organizationId: ctx.organizationId,
    openOnly: Boolean(input.openOnly),
    toOrgId,
  });
  const total = await runCount(model, built.filter);
  return {
    report: input.report || 'count',
    total: Number(total) || 0,
    filter: built.filter,
    guidance: 'Aggregate computed from live data.',
  };
}

async function runWorkflow(input = {}, ctx = {}) {
  // Delegates to the workflow agent to avoid duplicating orchestration logic.
  const { runWorkflowAgent } = require('../../agents/workflowAgent');
  return runWorkflowAgent({ workflow: input.workflow, steps: input.steps }, ctx);
}

async function runRecordGet(input = {}, ctx = {}) {
  const moduleKey = String(input.moduleKey || input.entity || '').trim();
  const recordId = String(input.recordId || input.id || '').trim();
  if (!moduleKey || !recordId) {
    return { ok: false, guidance: 'moduleKey and recordId are required.' };
  }
  const model = modelFor(moduleKey, ctx.deps);
  if (!model || typeof model.findOne !== 'function') {
    return { ok: false, moduleKey, recordId, guidance: `No model wired for ${moduleKey}.` };
  }
  let q = model.findOne({ _id: recordId, deletedAt: null });
  if (q && typeof q.lean === 'function') q = q.lean();
  const row = await q;
  if (!row) {
    return { ok: false, moduleKey, recordId, guidance: 'Record not found.', record: null };
  }
  return {
    ok: true,
    moduleKey,
    recordId,
    record: normalizeHit(moduleKey, row),
    raw: {
      id: String(row._id || row.id),
      title: normalizeHit(moduleKey, row).title,
    },
    guidance: `Loaded ${moduleKey} record.`,
  };
}

async function runRelationshipsContext(input = {}, ctx = {}) {
  const moduleKey = String(input.moduleKey || input.entity || '').trim();
  const recordId = String(input.recordId || input.id || '').trim();
  if (!moduleKey || !recordId) {
    return { related: [], guidance: 'moduleKey and recordId are required.' };
  }

  // Prefer injected stub for tests
  if (typeof ctx.deps?.getRecordContext === 'function') {
    const ctxResult = await ctx.deps.getRecordContext({
      organizationId: ctx.organizationId,
      moduleKey,
      recordId,
      appKey: input.appKey || 'SALES',
    });
    return {
      moduleKey,
      recordId,
      record: ctxResult?.record || null,
      related: ctxResult?.related || ctxResult?.relationships || [],
      guidance: 'Relationship context loaded.',
    };
  }

  try {
    const mongoose = require('mongoose');
    if (mongoose.connection?.readyState !== 1) {
      const got = await runRecordGet({ moduleKey, recordId }, ctx);
      return {
        moduleKey,
        recordId,
        record: got.record || null,
        related: [],
        guidance: got.ok ? 'Record loaded; relationships unavailable offline.' : 'Could not load relationship context.',
      };
    }
    const { getRecordContext } = require('../../../recordContextService');
    const appKey = String(input.appKey || 'sales').toLowerCase();
    const full = await getRecordContext(
      ctx.organizationId,
      appKey,
      moduleKey,
      recordId,
    );
    const relationships = Array.isArray(full?.relationships) ? full.relationships : [];
    const related = relationships.flatMap((rel) => {
      const records = Array.isArray(rel.records) ? rel.records : [];
      return records.slice(0, 5).map((r) => ({
        relationshipKey: rel.relationshipKey,
        moduleKey: rel.targetModuleKey || rel.moduleKey,
        id: String(r._id || r.id || ''),
        title: r.name || r.title || r.first_name || String(r._id || ''),
      }));
    });
    return {
      moduleKey,
      recordId,
      record: full?.record ? { id: recordId, title: full.record.name || full.record.title || recordId } : null,
      related,
      guidance: related.length
        ? `Found ${related.length} related record(s).`
        : 'No related records found.',
    };
  } catch {
    // Degrade: try loading the record alone
    const got = await runRecordGet({ moduleKey, recordId }, ctx);
    return {
      moduleKey,
      recordId,
      record: got.record || null,
      related: [],
      guidance: got.ok ? 'Record loaded; relationships unavailable.' : 'Could not load relationship context.',
    };
  }
}

async function runDealCreate(input = {}, ctx = {}) {
  const name = String(input.name || input.title || 'New deal').trim() || 'New deal';
  const override = input.override === true || input.force === true;
  let report = { conflicts: [], duplicates: [], hits: [], moduleKey: 'deals' };
  if (ctx.organizationId) {
    try {
      report = await findModuleCreateIssues({
        moduleKey: 'deals',
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        title: name,
        deps: ctx.deps,
      });
    } catch {
      report = { conflicts: [], duplicates: [], hits: [], moduleKey: 'deals' };
    }
  }
  const issues = hasCreateIssues(report);

  if (input.confirmed !== true) {
    return buildCreateConfirmation({
      toolName: 'crm.deals.create',
      risk: RISK.WRITE,
      buildConfirmation,
      title: name,
      moduleKey: 'deals',
      payload: {
        name,
        amount: input.amount ?? null,
        stage: input.stage || null,
        organizationRef: input.organizationRef || null,
        override: Boolean(override),
      },
      report,
    });
  }

  if (issues && !override) {
    return {
      created: false,
      error: 'DEAL_DUPLICATE',
      duplicates: report.duplicates,
      guidance: 'A similar deal already exists. Override to create anyway, or cancel.',
    };
  }

  const Deal = modelFor('deals', ctx.deps);
  if (Deal && typeof Deal.create === 'function' && ctx.organizationId) {
    let pipeline = input.pipeline || null;
    let stage = input.stage || null;
    if (!pipeline || !stage) {
      try {
        const { getDefaultPipelineSettings } = require('../../../../controllers/moduleController');
        const defaultSettings = getDefaultPipelineSettings();
        const defaultPipeline = defaultSettings.find((p) => p.isDefault) || defaultSettings[0];
        if (defaultPipeline?.stages?.length) {
          pipeline = pipeline || defaultPipeline.key;
          stage = stage || (defaultPipeline.stages[0].name || 'New');
        }
      } catch {
        stage = stage || 'New';
      }
    }
    const expectedCloseDate = input.expectedCloseDate
      ? new Date(input.expectedCloseDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const amount =
      input.amount === undefined || input.amount === null || input.amount === ''
        ? 0
        : Number(input.amount);
    const doc = await Deal.create({
      name,
      organizationId: toOrgId(ctx.organizationId),
      amount: Number.isFinite(amount) ? amount : 0,
      pipeline,
      stage,
      expectedCloseDate,
      status: 'Open',
      deletedAt: null,
      assignedTo: ctx.userId ? toOrgId(ctx.userId) : undefined,
      createdBy: ctx.userId ? toOrgId(ctx.userId) : undefined,
    });
    return {
      created: true,
      id: String(doc._id || ''),
      name,
      guidance: override && issues ? 'Deal created (override applied).' : 'Deal created.',
      overridden: Boolean(override && issues),
    };
  }
  return {
    created: false,
    error: 'DEAL_MODEL_UNAVAILABLE',
    guidance: 'Could not create the deal — deal storage is unavailable.',
  };
}

async function runDealUpdate(input = {}, ctx = {}) {
  const dealId = String(input.dealId || input.id || '').trim();
  const patch = {
    stage: input.stage,
    status: input.status,
    amount: input.amount,
    name: input.name,
  };
  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
  if (input.confirmed !== true) {
    return buildConfirmation({
      toolName: 'crm.deals.update',
      risk: RISK.WRITE,
      summary: `Update deal ${dealId || '(focus)'}`,
      payload: { dealId, ...patch },
    });
  }
  return executeDealUpdate(input, ctx);
}

async function runPeopleCreate(input = {}, ctx = {}) {
  const first = String(input.first_name || input.firstName || '').trim();
  const last = String(input.last_name || input.lastName || '').trim();
  const email = String(input.email || '').trim();
  const label = [first, last].filter(Boolean).join(' ') || email || 'New person';
  const override = input.override === true || input.force === true;
  let report = { conflicts: [], duplicates: [], hits: [], moduleKey: 'people' };
  if (ctx.organizationId) {
    try {
      report = await findModuleCreateIssues({
        moduleKey: 'people',
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        title: label,
        email,
        deps: ctx.deps,
      });
    } catch {
      report = { conflicts: [], duplicates: [], hits: [], moduleKey: 'people' };
    }
  }
  const issues = hasCreateIssues(report);

  if (input.confirmed !== true) {
    return buildCreateConfirmation({
      toolName: 'crm.people.create',
      risk: RISK.WRITE,
      buildConfirmation,
      title: label,
      moduleKey: 'people',
      payload: { first_name: first, last_name: last, email, override: Boolean(override) },
      report,
    });
  }

  if (issues && !override) {
    return {
      created: false,
      error: 'PERSON_DUPLICATE',
      duplicates: report.duplicates,
      guidance: 'A similar person already exists. Override to create anyway, or cancel.',
    };
  }

  const People = modelFor('people', ctx.deps);
  if (People && typeof People.create === 'function' && ctx.organizationId) {
    const doc = await People.create({
      first_name: first || 'Unknown',
      last_name: last || '',
      email: email || undefined,
      organizationId: toOrgId(ctx.organizationId),
      deletedAt: null,
    });
    return {
      created: true,
      id: String(doc._id || ''),
      label,
      guidance: override && issues ? 'Person created (override applied).' : 'Person created.',
      overridden: Boolean(override && issues),
    };
  }
  return {
    created: false,
    error: 'PERSON_MODEL_UNAVAILABLE',
    guidance: 'Could not create the person — people storage is unavailable.',
  };
}

async function runOrgCreate(input = {}, ctx = {}) {
  const name = String(input.name || 'New organization').trim() || 'New organization';
  const override = input.override === true || input.force === true;
  let report = { conflicts: [], duplicates: [], hits: [], moduleKey: 'organizations' };
  if (ctx.organizationId) {
    try {
      report = await findModuleCreateIssues({
        moduleKey: 'organizations',
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        title: name,
        deps: ctx.deps,
      });
    } catch {
      report = { conflicts: [], duplicates: [], hits: [], moduleKey: 'organizations' };
    }
  }
  const issues = hasCreateIssues(report);

  if (input.confirmed !== true) {
    return buildCreateConfirmation({
      toolName: 'crm.organizations.create',
      risk: RISK.WRITE,
      buildConfirmation,
      title: name,
      moduleKey: 'organizations',
      payload: { name, industry: input.industry || null, override: Boolean(override) },
      report,
    });
  }

  if (issues && !override) {
    return {
      created: false,
      error: 'ORG_DUPLICATE',
      duplicates: report.duplicates,
      guidance: 'A similar organization already exists. Override to create anyway, or cancel.',
    };
  }

  const Organization = modelFor('organizations', ctx.deps);
  if (Organization && typeof Organization.create === 'function' && ctx.userId) {
    const doc = await Organization.create({
      name,
      industry: input.industry || undefined,
      isTenant: false,
      createdBy: toOrgId(ctx.userId),
      deletedAt: null,
    });
    return {
      created: true,
      id: String(doc._id || ''),
      name,
      guidance: override && issues ? 'Organization created (override applied).' : 'Organization created.',
      overridden: Boolean(override && issues),
    };
  }
  return {
    created: false,
    error: 'ORG_MODEL_UNAVAILABLE',
    guidance: 'Could not create the organization — storage is unavailable.',
  };
}

async function runCaseCreate(input = {}, ctx = {}) {
  const title = String(input.title || 'New case').trim() || 'New case';
  const override = input.override === true || input.force === true;
  let report = { conflicts: [], duplicates: [], hits: [], moduleKey: 'cases' };
  if (ctx.organizationId) {
    try {
      report = await findModuleCreateIssues({
        moduleKey: 'cases',
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        title,
        deps: ctx.deps,
      });
    } catch {
      report = { conflicts: [], duplicates: [], hits: [], moduleKey: 'cases' };
    }
  }
  const issues = hasCreateIssues(report);

  if (input.confirmed !== true) {
    return buildCreateConfirmation({
      toolName: 'crm.cases.create',
      risk: RISK.WRITE,
      buildConfirmation,
      title,
      moduleKey: 'cases',
      payload: {
        title,
        priority: input.priority || 'Medium',
        relatedTo: input.relatedTo || null,
        override: Boolean(override),
      },
      report,
    });
  }

  if (issues && !override) {
    return {
      created: false,
      error: 'CASE_DUPLICATE',
      duplicates: report.duplicates,
      guidance: 'A similar case already exists. Override to create anyway, or cancel.',
    };
  }

  const Case = modelFor('cases', ctx.deps);
  if (Case && typeof Case.create === 'function' && ctx.organizationId) {
    const doc = await Case.create({
      title,
      priority: input.priority || 'Medium',
      organizationId: toOrgId(ctx.organizationId),
      status: 'New',
      deletedAt: null,
      createdBy: ctx.userId ? toOrgId(ctx.userId) : undefined,
    });
    return {
      created: true,
      id: String(doc._id || ''),
      title,
      guidance: override && issues ? 'Case created (override applied).' : 'Case created.',
      overridden: Boolean(override && issues),
    };
  }
  return {
    created: false,
    error: 'CASE_MODEL_UNAVAILABLE',
    guidance: 'Could not create the case — case storage is unavailable.',
  };
}

async function runQuotesDraft(input = {}, ctx = {}) {
  const dealName = input.dealName || input.focusName || 'this deal';
  if (input.confirmed !== true) {
    return buildConfirmation({
      toolName: 'quotes.draft',
      risk: RISK.WRITE,
      summary: `Draft quote for ${dealName}`,
      payload: {
        dealId: input.dealId || null,
        dealName,
        amount: input.amount ?? null,
      },
    });
  }
  return executeNotImplemented(
    'quotes.draft',
    'Drafting a full quote',
  );
}

async function runDomainConfirmAction(toolName, summary, input = {}, executor) {
  if (input.confirmed !== true) {
    return buildConfirmation({
      toolName,
      risk: RISK.WRITE,
      summary,
      payload: input,
    });
  }
  if (typeof executor === 'function') {
    return executor(input);
  }
  return executeNotImplemented(toolName, summary);
}

async function runQuotesSend(input = {}, ctx = {}) {
  return runDomainConfirmAction(
    'quotes.send',
    `Send quote ${input.quoteId || input.quoteNumber || ''}`.trim(),
    input,
    (payload) => executeQuotesSend(payload, ctx),
  );
}

async function runQuotesConvert(input = {}) {
  return runDomainConfirmAction(
    'quotes.convert_to_order',
    `Convert quote ${input.quoteId || ''} to sales order`,
    input,
  );
}

async function runInvoiceSend(input = {}, ctx = {}) {
  return runDomainConfirmAction(
    'invoices.send',
    `Send invoice ${input.invoiceId || input.invoiceNumber || ''}`.trim(),
    input,
    (payload) => executeInvoiceSend(payload, ctx),
  );
}

async function runInvoiceVoid(input = {}, ctx = {}) {
  return runDomainConfirmAction(
    'invoices.void',
    `Void invoice ${input.invoiceId || input.invoiceNumber || ''}`.trim(),
    input,
    (payload) => executeInvoiceVoid(payload, ctx),
  );
}

async function runPaymentRecord(input = {}, ctx = {}) {
  return runDomainConfirmAction(
    'payments.record',
    `Record payment ${input.amount != null ? input.amount : ''}`.trim(),
    input,
    (payload) => executePaymentRecord(payload, ctx),
  );
}

async function runPaymentAllocate(input = {}) {
  return runDomainConfirmAction(
    'payments.allocate',
    `Allocate payment ${input.paymentId || ''}`.trim(),
    input,
  );
}

async function runRefundCreate(input = {}) {
  return runDomainConfirmAction(
    'refunds.create',
    `Create refund ${input.amount != null ? input.amount : ''}`.trim(),
    input,
  );
}

async function runPaymentLinkCreate(input = {}, ctx = {}) {
  return runDomainConfirmAction(
    'payment_links.create',
    'Create payment link',
    input,
    (payload) => executePaymentLinkCreate(payload, ctx),
  );
}

async function runSalesOrderFulfill(input = {}) {
  return runDomainConfirmAction(
    'sales_orders.fulfill',
    `Fulfill sales order ${input.salesOrderId || ''}`.trim(),
    input,
  );
}

async function runCasesAssign(input = {}, ctx = {}) {
  return runDomainConfirmAction(
    'cases.assign',
    `Assign case ${input.caseId || ''}`.trim(),
    input,
    (payload) => executeCaseAssign(payload, ctx),
  );
}

async function runCasesResolve(input = {}, ctx = {}) {
  return runDomainConfirmAction(
    'cases.resolve',
    `Resolve case ${input.caseId || ''}`.trim(),
    input,
    (payload) => executeCaseResolve(payload, ctx),
  );
}

async function runReviewerCritique(input = {}) {
  const summary = String(input.summary || input.toolName || 'write action');
  const payload = input.payload || {};
  const issues = [];
  if (input.toolName === 'email.send' && !payload.to) {
    issues.push('Recipient email is empty — add To before sending.');
  }
  if (input.toolName === 'crm.deals.update' && payload.status === 'Won' && payload.amount == null) {
    issues.push('Won deal has no amount — confirm amount before closing.');
  }
  return {
    ok: true,
    verdict: issues.length ? `Reviewer flags: ${issues.join(' ')}` : 'Reviewer: no blocking issues.',
    issues,
    toolName: input.toolName || null,
    summary,
  };
}

async function runPlaybookTool(input = {}, ctx = {}) {
  const { runThinPlaybook } = require('../../orchestrator/runThinPlaybook');
  const sessionMemory = require('../../memory/sessionMemory');
  return runThinPlaybook({
    playbookKey: input.playbook || input.playbookKey || 'qualify-research-outreach',
    query: input.query || '',
    ctx,
    memory: ctx.deps?.sessionMemory || sessionMemory,
    conversationId: input.conversationId || ctx.conversationId || 'playbook',
    llm: ctx.deps?.llm || null,
    history: input.history || [],
  });
}

async function runAgentHandoff(input = {}, ctx = {}) {
  const fromAgent = String(input.fromAgent || input.from || '').trim() || 'unknown';
  const toAgent = String(input.toAgent || input.to || '').trim() || 'unknown';
  const packet = {
    focus: input.focus || ctx.focus || null,
    findings: input.findings || {},
    note: input.note || null,
  };
  if (ctx.organizationId && ctx.conversationId && ctx.deps?.sessionMemory) {
    const mem = ctx.deps.sessionMemory;
    const scratch = mem.getScratchpad(ctx.organizationId, ctx.conversationId) || {};
    const hops = Array.isArray(scratch.handoffs) ? scratch.handoffs : [];
    hops.push({ from: fromAgent, to: toAgent, at: Date.now(), packet });
    mem.setScratchpad(ctx.organizationId, ctx.conversationId, { ...scratch, handoffs: hops });
  }
  return {
    type: 'agent.handoff',
    from: fromAgent,
    to: toAgent,
    packet,
    guidance: `Handed off from ${fromAgent} to ${toAgent}.`,
  };
}

async function runLmsSearch(input = {}, ctx = {}) {
  if (!ctx.organizationId) {
    return { ok: false, error: 'ASTRA_ORG_REQUIRED', guidance: 'Organization context required for Learning search.' };
  }
  const learningService = require('../../../learning/learningService');
  const data = await learningService.searchLearningContent({
    organizationId: ctx.organizationId,
    query: input.query || input.q || '',
    limit: input.limit,
  });
  const hits = [
    ...(data.courses || []).map((c) => ({
      kind: 'course',
      id: c.id,
      title: c.title,
      description: c.description,
      route: c.route,
    })),
    ...(data.paths || []).map((p) => ({
      kind: 'path',
      id: p.id,
      title: p.title,
      description: p.description,
      route: p.route,
    })),
  ];
  return {
    ok: true,
    query: data.query,
    hits,
    counts: { courses: (data.courses || []).length, paths: (data.paths || []).length, total: hits.length },
    guidance: hits.length
      ? `Found ${hits.length} Learning result(s).`
      : 'No published Learning matches. Try a shorter query or browse Explore.',
  };
}

async function runLmsRecommend(input = {}, ctx = {}) {
  if (!ctx.organizationId || !ctx.userId) {
    return { ok: false, error: 'ASTRA_CONTEXT_REQUIRED', guidance: 'User and organization context required.' };
  }
  const learningService = require('../../../learning/learningService');
  const data = await learningService.recommendLearning({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    limit: input.limit,
  });
  return {
    ok: true,
    ...data,
    guidance: data.recommendations?.length
      ? 'Prioritize overdue/in-progress first, then catalog suggestions.'
      : 'No recommendations yet — publish courses or enroll learners.',
  };
}

async function runLmsSummarizeCourse(input = {}, ctx = {}) {
  if (!ctx.organizationId) {
    return { ok: false, error: 'ASTRA_ORG_REQUIRED', guidance: 'Organization context required.' };
  }
  const courseId = input.courseId || input.id || input.recordId;
  if (!courseId) {
    return { ok: false, error: 'COURSE_ID_REQUIRED', guidance: 'Pass courseId to summarize a course.' };
  }
  try {
    const learningService = require('../../../learning/learningService');
    const data = await learningService.summarizeCourseForAi({
      organizationId: ctx.organizationId,
      courseId,
    });
    return { ok: true, ...data, guidance: 'Course outline ready for the learner or author.' };
  } catch (err) {
    return {
      ok: false,
      error: err.code || 'SUMMARIZE_FAILED',
      guidance: err.message || 'Could not summarize course.',
    };
  }
}

function thinModuleTool(toolName, moduleLabel) {
  return async function runThin(input = {}, ctx = {}) {
    const toolRegistry = ctx.toolRegistry || require('../toolRegistry');
    const action = String(input.action || 'search').toLowerCase();
    if (action === 'search' || action === 'list' || action === 'get') {
      if (action === 'get') {
        const get = toolRegistry.getTool('crm.record.get');
        if (get) return get.run(input, ctx);
      }
      const search = toolRegistry.getTool('search.crm');
      if (search && (action === 'search' || action === 'list')) {
        return search.run({
          query: input.query || `list ${moduleLabel}`,
          entity: input.moduleKey || input.entity,
          limit: input.limit,
        }, ctx);
      }
      return {
        module: moduleLabel,
        hits: [],
        guidance: `${moduleLabel} ${action} — grounded search not available for this module yet.`,
        unsupported: true,
      };
    }
    if (input.confirmed !== true) {
      return buildConfirmation({
        toolName,
        risk: RISK.WRITE,
        summary: `${action} on ${moduleLabel}`,
        payload: { ...input, action },
      });
    }
    if (action === 'create') {
      const create = toolRegistry.getTool('module.create');
      if (create) {
        return create.run({
          ...input,
          moduleKey: input.moduleKey || input.entity,
          confirmed: true,
        }, ctx);
      }
    }
    if (action === 'update') {
      const update = toolRegistry.getTool('module.update');
      if (update) {
        return update.run({
          ...input,
          moduleKey: input.moduleKey || input.entity,
          confirmed: true,
        }, ctx);
      }
    }
    return executeNotImplemented(toolName, `${moduleLabel} ${action}`);
  };
}

async function runLiveChatSuggest(input = {}, ctx = {}) {
  const text = String(input.message || input.query || '').trim();
  const result = await groundedRetrieve({
    organizationId: ctx.organizationId,
    query: text,
    audience: 'public',
    topK: 5,
  });
  if (result.refuse || result.weak) {
    return {
      suggestion: null,
      escalate: true,
      citations: result.citations || [],
      guidance: result.guidance || 'No confident public knowledge hit — escalate to a human.',
      hits: result.hits || [],
    };
  }
  const top = result.hits[0];
  return {
    suggestion: top?.text
      ? String(top.text).slice(0, 600)
      : 'Thanks for reaching out — I found related help content. Review citations before sending.',
    escalate: false,
    citations: result.citations || [],
    guidance: 'Grounded public knowledge suggestion. Review before sending.',
    hits: result.hits || [],
  };
}

async function runMailroomClassify(input = {}) {
  const subject = String(input.subject || input.query || '').toLowerCase();
  let route = 'inbox';
  if (/\b(invoice|payment|quote)\b/.test(subject)) route = 'commercial';
  else if (/\b(support|help|issue|bug|ticket)\b/.test(subject)) route = 'helpdesk';
  else if (/\b(unsubscribe|campaign)\b/.test(subject)) route = 'marketing';
  return {
    route,
    confidence: 0.7,
    guidance: `Classified toward ${route}. Confirm before routing.`,
  };
}

async function runAnalyticsQuery(input = {}, ctx = {}) {
  const entity = String(input.entity || 'deals');
  const toolRegistry = ctx.toolRegistry || require('../toolRegistry');
  const reports = toolRegistry.getTool('reports.run');
  if (reports) {
    const r = await reports.run({ entity, openOnly: Boolean(input.openOnly), report: input.report }, ctx);
    return { ...r, tool: 'analytics.query' };
  }
  return { total: 0, entity, guidance: 'Analytics unavailable.' };
}

// ---------------------------------------------------------------------------
// registration
// ---------------------------------------------------------------------------

function registerFamilies(registry) {
  registry.registerTool({
    name: 'search.crm',
    family: 'search',
    risk: RISK.READ,
    description: 'Search deals, cases, people, tasks, or events. Lists open deals by default when entity is unclear; never name-matches the whole sentence.',
    run: runCrmSearch,
  });

  registry.registerTool({
    name: 'module.search',
    family: 'module',
    risk: RISK.READ,
    description: 'Universal module search. Requires moduleKey (invoices, payments, deals, …).',
    run: runModuleSearch,
  });

  registry.registerTool({
    name: 'module.get',
    family: 'module',
    risk: RISK.READ,
    description: 'Universal module get by moduleKey + recordId.',
    run: runModuleGet,
  });

  registry.registerTool({
    name: 'module.create',
    family: 'module',
    risk: RISK.WRITE,
    description: 'Universal module create (requires confirmation).',
    run: runModuleCreate,
  });

  registry.registerTool({
    name: 'module.update',
    family: 'module',
    risk: RISK.WRITE,
    description: 'Universal module update (requires confirmation).',
    run: runModuleUpdate,
  });

  registry.registerTool({
    name: 'crm.deals',
    family: 'crm',
    risk: RISK.READ,
    description: 'List open pipeline deals for the workspace.',
    run: (input, ctx) => runCrmSearch({ ...input, entity: 'deals', query: `open deals ${input.query || ''}` }, ctx),
  });

  registry.registerTool({
    name: 'crm.cases',
    family: 'crm',
    risk: RISK.READ,
    description: 'Look up support cases.',
    run: (input, ctx) => runCrmSearch({ ...input, entity: 'cases' }, ctx),
  });

  registry.registerTool({
    name: 'crm.people',
    family: 'crm',
    risk: RISK.READ,
    description: 'Look up people / contacts / leads.',
    run: (input, ctx) => runCrmSearch({ ...input, entity: 'people' }, ctx),
  });

  registry.registerTool({
    name: 'crm.tasks',
    family: 'crm',
    risk: RISK.READ,
    description: 'List open or overdue tasks.',
    run: (input, ctx) => runCrmSearch({ ...input, entity: 'tasks' }, ctx),
  });

  registry.registerTool({
    name: 'crm.events',
    family: 'crm',
    risk: RISK.READ,
    description: 'List calendar events / meetings.',
    run: (input, ctx) => runCrmSearch({ ...input, entity: 'events' }, ctx),
  });

  registry.registerTool({
    name: 'crm.tasks.create',
    family: 'crm',
    risk: RISK.WRITE,
    description: 'Create a task (requires confirmation).',
    run: runTaskCreate,
  });

  registry.registerTool({
    name: 'crm.notes.create',
    family: 'crm',
    risk: RISK.WRITE,
    description: 'Add a note (requires confirmation).',
    run: runNotesCreate,
  });

  registry.registerTool({
    name: 'crm.activity.log',
    family: 'crm',
    risk: RISK.WRITE,
    description: 'Log a call/meeting/note activity (requires confirmation).',
    run: runActivityLog,
  });

  registry.registerTool({
    name: 'crm.record.get',
    family: 'crm',
    risk: RISK.READ,
    description: 'Fetch a single CRM record by moduleKey + id.',
    run: runRecordGet,
  });

  registry.registerTool({
    name: 'relationships.context',
    family: 'crm',
    risk: RISK.READ,
    description: 'Load relationship context for a record.',
    run: runRelationshipsContext,
  });

  registry.registerTool({
    name: 'crm.deals.create',
    family: 'crm',
    risk: RISK.WRITE,
    description: 'Create a deal (requires confirmation).',
    run: runDealCreate,
  });

  registry.registerTool({
    name: 'crm.deals.update',
    family: 'crm',
    risk: RISK.WRITE,
    description: 'Update a deal stage/status/amount (requires confirmation).',
    run: runDealUpdate,
  });

  registry.registerTool({
    name: 'crm.people.create',
    family: 'crm',
    risk: RISK.WRITE,
    description: 'Create a person (requires confirmation).',
    run: runPeopleCreate,
  });

  registry.registerTool({
    name: 'crm.organizations.create',
    family: 'crm',
    risk: RISK.WRITE,
    description: 'Create a CRM organization (requires confirmation).',
    run: runOrgCreate,
  });

  registry.registerTool({
    name: 'crm.cases.create',
    family: 'crm',
    risk: RISK.WRITE,
    description: 'Create a helpdesk case (requires confirmation).',
    run: runCaseCreate,
  });

  registry.registerTool({
    name: 'quotes.draft',
    family: 'commercial',
    risk: RISK.WRITE,
    description: 'Draft a quote for a deal (requires confirmation).',
    run: runQuotesDraft,
  });

  registry.registerTool({
    name: 'quotes.send',
    family: 'commercial',
    risk: RISK.WRITE,
    description: 'Send a quote (requires confirmation).',
    run: runQuotesSend,
  });

  registry.registerTool({
    name: 'quotes.convert_to_order',
    family: 'commercial',
    risk: RISK.WRITE,
    description: 'Convert a quote to a sales order (requires confirmation).',
    run: runQuotesConvert,
  });

  registry.registerTool({
    name: 'invoices.send',
    family: 'commercial',
    risk: RISK.WRITE,
    description: 'Send an invoice (requires confirmation).',
    run: runInvoiceSend,
  });

  registry.registerTool({
    name: 'invoices.void',
    family: 'commercial',
    risk: RISK.WRITE,
    description: 'Void an invoice (requires confirmation).',
    run: runInvoiceVoid,
  });

  registry.registerTool({
    name: 'payments.record',
    family: 'commercial',
    risk: RISK.WRITE,
    description: 'Record a payment (requires confirmation).',
    run: runPaymentRecord,
  });

  registry.registerTool({
    name: 'payments.allocate',
    family: 'commercial',
    risk: RISK.WRITE,
    description: 'Allocate a payment (requires confirmation).',
    run: runPaymentAllocate,
  });

  registry.registerTool({
    name: 'refunds.create',
    family: 'commercial',
    risk: RISK.WRITE,
    description: 'Create a refund (requires confirmation).',
    run: runRefundCreate,
  });

  registry.registerTool({
    name: 'payment_links.create',
    family: 'commercial',
    risk: RISK.WRITE,
    description: 'Create a payment link (requires confirmation).',
    run: runPaymentLinkCreate,
  });

  registry.registerTool({
    name: 'sales_orders.fulfill',
    family: 'commercial',
    risk: RISK.WRITE,
    description: 'Fulfill a sales order (requires confirmation).',
    run: runSalesOrderFulfill,
  });

  registry.registerTool({
    name: 'cases.assign',
    family: 'helpdesk',
    risk: RISK.WRITE,
    description: 'Assign a case (requires confirmation).',
    run: runCasesAssign,
  });

  registry.registerTool({
    name: 'cases.resolve',
    family: 'helpdesk',
    risk: RISK.WRITE,
    description: 'Resolve a case (requires confirmation).',
    run: runCasesResolve,
  });

  registry.registerTool({
    name: 'reviewer.critique_write',
    family: 'workforce',
    risk: RISK.READ,
    description: 'Critique a write payload before human confirm (Reviewer seat).',
    run: runReviewerCritique,
  });

  registry.registerTool({
    name: 'playbook.run',
    family: 'workforce',
    risk: RISK.READ,
    description: 'Run a named thin multi-seat playbook.',
    run: runPlaybookTool,
  });

  registry.registerTool({
    name: 'agent.handoff',
    family: 'workforce',
    risk: RISK.READ,
    description: 'Pass focus/findings from one seat to another.',
    run: runAgentHandoff,
  });

  registry.registerTool({
    name: 'campaigns.search',
    family: 'marketing',
    risk: RISK.READ,
    description: 'Search marketing campaigns.',
    run: thinModuleTool('campaigns.search', 'campaigns'),
  });

  registry.registerTool({
    name: 'audiences.search',
    family: 'marketing',
    risk: RISK.READ,
    description: 'Search marketing audiences.',
    run: thinModuleTool('audiences.search', 'audiences'),
  });

  registry.registerTool({
    name: 'inventory.stock.get',
    family: 'inventory',
    risk: RISK.READ,
    description: 'Get inventory stock snapshot (thin).',
    run: thinModuleTool('inventory.stock.get', 'inventory'),
  });

  registry.registerTool({
    name: 'audits.search',
    family: 'audit',
    risk: RISK.READ,
    description: 'Search audits / assignments (thin).',
    run: thinModuleTool('audits.search', 'audits'),
  });

  registry.registerTool({
    name: 'documents.search',
    family: 'documents',
    risk: RISK.READ,
    description: 'Search documents.',
    run: thinModuleTool('documents.search', 'documents'),
  });

  registry.registerTool({
    name: 'analytics.query',
    family: 'analytics',
    risk: RISK.READ,
    description: 'Run an analytics aggregate query.',
    run: runAnalyticsQuery,
  });

  registry.registerTool({
    name: 'automation.list',
    family: 'automation',
    risk: RISK.READ,
    description: 'List automations / approvals status (thin).',
    run: async (input = {}) => ({
      items: [],
      guidance: 'Automation list — wire to /api/automation when surfacing live data.',
      filter: input,
    }),
  });

  registry.registerTool({
    name: 'liveChat.suggestReply',
    family: 'livechat',
    risk: RISK.READ,
    description: 'Suggest a live-chat agent reply.',
    run: runLiveChatSuggest,
  });

  registry.registerTool({
    name: 'mailroom.classify',
    family: 'mailroom',
    risk: RISK.READ,
    description: 'Classify inbound mailroom message toward a route.',
    run: runMailroomClassify,
  });

  registry.registerTool({
    name: 'projects.search',
    family: 'projects',
    risk: RISK.READ,
    description: 'Search projects (thin OOTB).',
    run: thinModuleTool('projects.search', 'projects'),
  });

  registry.registerTool({
    name: 'lms.search',
    family: 'lms',
    risk: RISK.READ,
    description: 'Search published Learning courses and paths.',
    run: runLmsSearch,
  });

  registry.registerTool({
    name: 'lms.recommend',
    family: 'lms',
    risk: RISK.READ,
    description: 'Recommend Learning courses for the current user (continue + explore).',
    run: runLmsRecommend,
  });

  registry.registerTool({
    name: 'lms.summarizeCourse',
    family: 'lms',
    risk: RISK.READ,
    description: 'Summarize a Learning course outline (modules and learning objects).',
    run: runLmsSummarizeCourse,
  });

  registry.registerTool({
    name: 'portal.content.search',
    family: 'portal',
    risk: RISK.READ,
    description: 'Search portal content (thin OOTB).',
    run: thinModuleTool('portal.content.search', 'portal'),
  });

  registry.registerTool({
    name: 'control_plane.instances.search',
    family: 'control_plane',
    risk: RISK.READ,
    description: 'Search control-plane instances (ops only, thin).',
    run: thinModuleTool('control_plane.instances.search', 'instances'),
  });

  registry.registerTool({
    name: 'knowledge.search',
    family: 'knowledge',
    risk: RISK.READ,
    description: 'Grounded search across the tenant knowledge base.',
    run: runKnowledgeSearch,
  });

  registry.registerTool({
    name: 'email.draft',
    family: 'email',
    risk: RISK.READ,
    description: 'Draft an email for review (no send).',
    run: runEmailDraft,
  });

  registry.registerTool({
    name: 'email.send',
    family: 'email',
    risk: RISK.WRITE,
    description: 'Send an email (requires confirmation).',
    run: runEmailSend,
  });

  registry.registerTool({
    name: 'calendar.createEvent',
    family: 'calendar',
    risk: RISK.WRITE,
    description: 'Create a calendar event (requires confirmation).',
    run: runCalendarCreate,
  });

  registry.registerTool({
    name: 'reports.run',
    family: 'reports',
    risk: RISK.READ,
    description: 'Run a read-only aggregate report.',
    run: runReports,
  });

  registry.registerTool({
    name: 'workflow.run',
    family: 'workflow',
    risk: RISK.READ,
    description: 'Run a named multi-step workflow.',
    run: runWorkflow,
  });

  return registry.listTools();
}

module.exports = {
  registerFamilies,
  planCrmSearch,
  toOrgId,
  escapeRegex,
  extractSearchTerm,
  detectEntity,
  normalizeHit,
  coverageReport,
  findCalendarConflicts,
  buildConflictLead,
  findModuleCreateIssues,
  buildCreateWarningLead,
  hasCreateIssues,
};
