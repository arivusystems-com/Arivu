'use strict';

/**
 * Cross-module create conflict + duplicate detection for Astra writes.
 * Always tenant-scoped (organizationId). Events also check assignee time overlap.
 */

const mongoose = require('mongoose');
const { getModule, resolveModel, normalizeModuleHit } = require('../tools/moduleCatalog');
const {
  findCalendarConflicts,
  buildConflictLead,
  titlesLookDuplicate,
  formatWhen,
} = require('./findCalendarConflicts');

function toObjectId(value) {
  const raw = String(value || '');
  if (mongoose.Types.ObjectId.isValid(raw)) {
    return new mongoose.Types.ObjectId(raw);
  }
  return raw;
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function emptyReport() {
  return { conflicts: [], duplicates: [], hits: [], moduleKey: null };
}

function hasCreateIssues(report) {
  return (report?.conflicts?.length || 0) > 0 || (report?.duplicates?.length || 0) > 0;
}

async function runFind(model, filter) {
  if (!model || typeof model.find !== 'function') return [];
  let q = model.find(filter).limit(12);
  if (typeof q.sort === 'function') q = q.sort({ updatedAt: -1, createdAt: -1 });
  if (typeof q.lean === 'function') q = q.lean();
  const rows = await q;
  return Array.isArray(rows) ? rows : [];
}

/**
 * Generic title/email duplicate search for CRM modules.
 */
async function findTitleDuplicates({
  moduleKey,
  organizationId,
  userId = null,
  title = '',
  email = '',
  deps = {},
} = {}) {
  const empty = emptyReport();
  empty.moduleKey = moduleKey;
  const mod = getModule(moduleKey);
  if (!mod || mod.support !== 'ready') return empty;

  const model = resolveModel(moduleKey, deps);
  if (!model) return empty;

  const base = {
    organizationId: toObjectId(organizationId),
    deletedAt: null,
  };

  if (moduleKey === 'organizations') {
    delete base.organizationId;
    base.isTenant = false;
  }

  const rows = [];
  const titleText = String(title || '').trim();
  const emailText = String(email || '').trim().toLowerCase();

  if (moduleKey === 'people' && emailText) {
    rows.push(...await runFind(model, { ...base, email: emailText }));
  }

  if (titleText.length >= 2) {
    const titleFields = mod.titleFields?.length ? mod.titleFields : ['name', 'title'];
    if (moduleKey === 'people') {
      const parts = titleText.split(/\s+/).filter(Boolean);
      const or = [];
      if (parts[0]) or.push({ first_name: { $regex: escapeRegex(parts[0]), $options: 'i' } });
      if (parts.length > 1) {
        or.push({ last_name: { $regex: escapeRegex(parts[parts.length - 1]), $options: 'i' } });
      }
      or.push({ email: { $regex: escapeRegex(titleText), $options: 'i' } });
      rows.push(...await runFind(model, { ...base, $or: or }));
    } else if (moduleKey === 'tasks') {
      const taskFilter = {
        ...base,
        title: { $regex: escapeRegex(titleText), $options: 'i' },
        status: { $nin: ['completed', 'cancelled', 'done'] },
      };
      if (userId) taskFilter.assignedTo = toObjectId(userId);
      rows.push(...await runFind(model, taskFilter));
    } else {
      const primary = titleFields[0];
      rows.push(...await runFind(model, {
        ...base,
        [primary]: { $regex: escapeRegex(titleText), $options: 'i' },
      }));
    }
  }

  const byId = new Map();
  for (const row of rows) {
    const hit = normalizeModuleHit(moduleKey, row);
    if (!hit?.id) continue;
    // Prefer near-duplicate titles / exact email
    const rowEmail = String(row.email || '').toLowerCase();
    const isEmailDup = emailText && rowEmail && rowEmail === emailText;
    const isTitleDup = titlesLookDuplicate(titleText, hit.title);
    if (!isEmailDup && !isTitleDup && titleText.length >= 2) {
      // regex may be loose — keep only strong matches
      const normHit = String(hit.title || '').toLowerCase();
      const normTitle = titleText.toLowerCase();
      if (!(normHit.includes(normTitle) || normTitle.includes(normHit))) continue;
    }
    byId.set(hit.id, hit);
  }

  const duplicates = [...byId.values()];
  return {
    moduleKey,
    conflicts: [],
    duplicates,
    hits: duplicates,
  };
}

/**
 * Unified create-issue detector for any ready module.
 */
async function findModuleCreateIssues({
  moduleKey,
  organizationId,
  userId = null,
  title = '',
  email = '',
  startDateTime = null,
  endDateTime = null,
  deps = {},
} = {}) {
  const key = String(moduleKey || '').trim();
  if (!key || !organizationId) return emptyReport();

  const work = (async () => {
    if (key === 'events') {
      const Event = resolveModel('events', deps);
      const report = await findCalendarConflicts({
        Event,
        organizationId,
        userId,
        title,
        startDateTime,
        endDateTime,
      });
      return { ...report, moduleKey: 'events' };
    }

    if (
      key === 'people'
      || key === 'organizations'
      || key === 'items'
      || key === 'deals'
      || key === 'tasks'
      || key === 'cases'
    ) {
      try {
        const { evaluateDuplicates } = require('../../duplicates');
        const candidate = { name: title, email, item_name: title, first_name: title, title };
        if (key === 'people' && title) {
          const parts = String(title).trim().split(/\s+/);
          candidate.first_name = parts[0];
          candidate.last_name = parts.slice(1).join(' ') || undefined;
        }
        if (key === 'organizations' || key === 'deals') candidate.name = title;
        if (key === 'tasks' || key === 'cases') candidate.title = title;
        const result = await evaluateDuplicates({
          organizationId,
          moduleKey: key,
          candidate,
          limit: 8,
        });
        if (result.enabled) {
          const duplicates = (result.matches || []).map((m) => ({
            id: String(m.record._id),
            title: m.record.name || m.record.title || m.record.email || m.record.item_code || m.record.caseId || String(m.record._id),
            subtitle: (m.matchedFields || []).map((f) => `${f.field}=${f.value}`).join(', '),
          }));
          return {
            moduleKey: key,
            conflicts: [],
            duplicates,
            hits: duplicates,
          };
        }
      } catch (_) { /* fall through to title heuristics */ }
    }

    return findTitleDuplicates({
      moduleKey: key,
      organizationId,
      userId,
      title,
      email,
      deps,
    });
  })();

  try {
    return await Promise.race([
      work,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('create_issue_lookup_timeout')), 800);
      }),
    ]);
  } catch {
    return { ...emptyReport(), moduleKey: key };
  }
}

function moduleNoun(moduleKey) {
  const mod = getModule(moduleKey);
  if (mod?.label) {
    // "organizations" -> "organization", "people" stays awkward — map
    if (moduleKey === 'people') return 'person';
    if (moduleKey === 'organizations') return 'organization';
    if (moduleKey === 'cases') return 'case';
    if (moduleKey === 'deals') return 'deal';
    if (moduleKey === 'tasks') return 'task';
    if (moduleKey === 'events') return 'event';
    return mod.label.replace(/s$/, '') || moduleKey;
  }
  return moduleKey;
}

/**
 * Premium warning copy for any module create.
 */
function buildCreateWarningLead({
  moduleKey,
  title,
  when = null,
  durationMinutes = null,
  conflicts = [],
  duplicates = [],
}) {
  if (moduleKey === 'events') {
    return buildConflictLead({
      title,
      when: when || 'the requested time',
      durationMinutes: durationMinutes || 30,
      conflicts,
      duplicates,
    });
  }

  const noun = moduleNoun(moduleKey);
  const lines = [];
  if (conflicts.length) {
    const first = conflicts[0];
    lines.push(
      `This conflicts with an existing ${noun}`
      + (first?.title ? ` — "${first.title}"${first.subtitle ? ` (${first.subtitle})` : ''}` : '')
      + '.',
    );
  }
  if (duplicates.length) {
    const dup = duplicates[0];
    lines.push(
      `I found ${duplicates.length === 1 ? `an existing ${noun}` : `${duplicates.length} similar ${noun}s`}`
      + (dup?.title ? ` that looks like a duplicate — "${dup.title}"` : '')
      + (dup?.subtitle ? ` (${dup.subtitle})` : '')
      + '.',
    );
    if (duplicates.length > 1) {
      for (const d of duplicates.slice(0, 4)) {
        lines.push(`• ${d.title}${d.subtitle ? ` — ${d.subtitle}` : ''}`);
      }
    }
  }
  lines.push(
    `I can still create "${title}" if you want to override, or cancel to keep the existing record.`,
  );
  return lines.join('\n');
}

function relatedDisplayName(ref) {
  if (!ref || typeof ref !== 'object') return null;
  const name = ref.name || ref.title || ref.companyName || ref.email;
  return name ? String(name) : null;
}

/**
 * Structured rows for Proposed Action cards (never a payload dump).
 */
function buildProposalDetails(moduleKey, payload = {}) {
  const p = payload || {};
  const details = [];
  const push = (label, value) => {
    if (value == null || value === '') return;
    details.push({ label, value: String(value) });
  };

  const title = p.title || p.name;
  push('Title', title);

  if (moduleKey === 'events' || p.startDateTime) {
    if (p.startDateTime) push('When', formatWhen(p.startDateTime));
    if (p.durationMinutes) push('Duration', `${p.durationMinutes} min`);
    push('Related org', relatedDisplayName(p.relatedTo));
    push('Contact', relatedDisplayName(p.relatedContact));
    if (p.description) {
      const note = String(p.description).replace(/\s+/g, ' ').trim();
      push('Notes', note.length > 160 ? `${note.slice(0, 157)}…` : note);
    }
  } else if (moduleKey === 'tasks') {
    if (p.dueDate) push('Due', formatWhen(p.dueDate) || String(p.dueDate));
    if (p.priority) push('Priority', String(p.priority));
    push('Related', relatedDisplayName(p.relatedTo));
  } else if (moduleKey === 'deals') {
    if (p.amount != null && p.amount !== '') push('Amount', `$${p.amount}`);
    if (p.stage) push('Stage', String(p.stage));
    push('Organization', relatedDisplayName(p.organizationRef) || relatedDisplayName(p.relatedTo));
  } else if (moduleKey === 'cases') {
    if (p.priority) push('Priority', String(p.priority));
    push('Related', relatedDisplayName(p.relatedTo));
  } else if (moduleKey === 'organizations' || moduleKey === 'people') {
    if (p.email) push('Email', String(p.email));
    if (p.phone) push('Phone', String(p.phone));
    if (p.industry) push('Industry', String(p.industry));
  }

  if (p.to) push('To', String(p.to));
  if (p.subject) push('Subject', String(p.subject));
  if (p.summary && moduleKey === 'activity') push('Summary', String(p.summary));

  return details;
}

function buildRichCreateSummary(moduleKey, title, payload = {}, issues = false) {
  const noun = moduleNoun(moduleKey);
  const head = issues
    ? `Override and create ${noun} "${title}"`
    : `Create ${noun} "${title}"`;
  const bits = [head];
  const p = payload || {};

  if (moduleKey === 'events') {
    if (p.startDateTime) bits.push(formatWhen(p.startDateTime));
    if (p.durationMinutes) bits.push(`${p.durationMinutes} min`);
    const org = relatedDisplayName(p.relatedTo);
    if (org) bits.push(org);
  } else if (moduleKey === 'tasks') {
    if (p.dueDate) bits.push(`due ${formatWhen(p.dueDate) || p.dueDate}`);
    if (p.priority) bits.push(`${p.priority} priority`);
  } else if (moduleKey === 'deals' && p.amount != null && p.amount !== '') {
    bits.push(`$${p.amount}`);
  } else if (moduleKey === 'cases' && p.priority) {
    bits.push(`${p.priority} priority`);
  }

  return bits.join(' · ');
}

/**
 * Shared confirm-gate shape for create tools with duplicate/conflict warnings.
 */
function buildCreateConfirmation({
  toolName,
  risk,
  buildConfirmation,
  title,
  moduleKey,
  payload,
  report,
}) {
  const issues = hasCreateIssues(report);
  const summary = buildRichCreateSummary(moduleKey, title, payload, issues);
  const details = buildProposalDetails(moduleKey, payload);
  const guidance = issues
    ? buildCreateWarningLead({
      moduleKey,
      title,
      when: payload?.startDateTime ? formatWhen(payload.startDateTime) : null,
      durationMinutes: payload?.durationMinutes || null,
      conflicts: report.conflicts || [],
      duplicates: report.duplicates || [],
    })
    : undefined;
  return {
    ...buildConfirmation({
      toolName,
      risk,
      summary,
      payload: {
        ...payload,
        override: issues ? true : Boolean(payload?.override),
      },
      effects: issues
        ? [{
          type: 'create_warning',
          moduleKey,
          conflicts: report.conflicts || [],
          duplicates: report.duplicates || [],
        }]
        : [],
    }),
    conflicts: report.conflicts || [],
    duplicates: report.duplicates || [],
    scheduleWarning: issues,
    createWarning: issues,
    moduleKey,
    details,
    guidance,
  };
}

module.exports = {
  findModuleCreateIssues,
  findTitleDuplicates,
  buildCreateWarningLead,
  buildCreateConfirmation,
  buildProposalDetails,
  buildRichCreateSummary,
  hasCreateIssues,
  moduleNoun,
  emptyReport,
};
