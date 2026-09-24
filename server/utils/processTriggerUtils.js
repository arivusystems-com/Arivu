'use strict';

/**
 * Process trigger matching and migration helpers (core trigger model).
 */

const CORE_TRIGGER_TYPES = [
  'record_created',
  'record_updated',
  'record_created_or_updated',
  'record_closed',
  'record_reopened',
  'schedule',
  'webhook',
  'manual'
];

/** Legacy domain eventType → core UX + optional field watch */
const LEGACY_EVENT_TO_CORE = {
  'people.lifecycle.changed': {
    core: 'record_updated',
    fields: ['lifecycle', 'lead_status', 'contact_status']
  },
  'people.sales_type.changed': { core: 'record_updated', fields: ['sales_type'] },
  'organization.lifecycle.changed': {
    core: 'record_updated',
    fields: ['customerStatus', 'partnerStatus', 'vendorStatus']
  },
  'organization.type.changed': { core: 'record_updated', fields: ['types'] },
  'deal.stage.changed': { core: 'record_updated', fields: ['stage'] },
  'deal.pipeline.changed': { core: 'record_updated', fields: ['pipeline'] },
  'deal.deal.won': { core: 'record_updated', fields: ['stage'] },
  'deal.deal.lost': { core: 'record_updated', fields: ['stage'] },
  'form.submitted': { core: 'manual' },
  'record.created': { core: 'record_created' },
  'record.updated': { core: 'record_updated' },
  'record.closed': { core: 'record_closed' },
  'record.reopened': { core: 'record_reopened' }
};

function createdEventType(entityType) {
  if (!entityType) return null;
  return `${entityType}.created`;
}

function updatedEventType(entityType) {
  if (!entityType) return null;
  return `${entityType}.updated`;
}

function isCreatedEventType(eventType) {
  return typeof eventType === 'string' && eventType.endsWith('.created');
}

function isUpdatedEventType(eventType) {
  return typeof eventType === 'string' && eventType.endsWith('.updated');
}

/** Map people.created → people.updated */
function toUpdatedEventType(eventType) {
  if (!isCreatedEventType(eventType)) return null;
  return `${eventType.slice(0, -'.created'.length)}.updated`;
}

/**
 * Whether a domain event matches process trigger updateWatch.
 * Created events always match when includeCreated is set (create = criteria met).
 */
function matchesUpdateWatch(trigger, event) {
  if (!trigger || trigger.type !== 'domain_event') return true;
  if (trigger.includeCreated && isCreatedEventType(event?.eventType)) {
    return true;
  }
  const watch = trigger.updateWatch;
  if (!watch || watch.mode === 'any' || !Array.isArray(watch.fields) || watch.fields.length === 0) {
    return true;
  }
  const changed = event?.changedFields || [];
  if (!changed.length) {
    // No diff metadata — allow run (backward compat with granular events)
    return true;
  }
  return watch.fields.some((f) => changed.includes(f));
}

/**
 * Mongo filter clause so includeCreated processes fire on *.created as well as *.updated.
 */
function domainEventProcessMatchFilter(eventType) {
  const clauses = [{ 'trigger.eventType': eventType }];
  const updatedCounterpart = toUpdatedEventType(eventType);
  if (updatedCounterpart) {
    clauses.push({
      'trigger.includeCreated': true,
      'trigger.eventType': updatedCounterpart
    });
  }
  return { $or: clauses };
}

/**
 * Infer core trigger key from stored process.trigger
 */
function resolveCoreTriggerFromProcess(process) {
  const t = process?.trigger;
  if (!t) return 'manual';
  if (t.type === 'manual') return 'manual';
  if (t.type === 'webhook') return 'webhook';
  if (t.type === 'schedule') return 'schedule';

  if (t.type === 'domain_event' && t.eventType) {
    if (t.includeCreated && isUpdatedEventType(t.eventType)) {
      return 'record_created_or_updated';
    }
    const created = createdEventType(process.entityType);
    const updated = updatedEventType(process.entityType);
    if (t.eventType === created) return 'record_created';
    if (t.eventType === updated) return 'record_updated';
    const legacy = LEGACY_EVENT_TO_CORE[t.eventType];
    if (legacy) return legacy.core;
    if (t.eventType.endsWith('.created')) return 'record_created';
    if (t.eventType.endsWith('.updated')) return 'record_updated';
    if (t.eventType.endsWith('.closed')) return 'record_closed';
    if (t.eventType.endsWith('.reopened')) return 'record_reopened';
  }
  return 'manual';
}

function resolveUpdateWatchFromProcess(process) {
  const t = process?.trigger;
  if (t?.updateWatch) {
    return {
      mode: t.updateWatch.mode === 'fields' ? 'fields' : 'any',
      fields: Array.isArray(t.updateWatch.fields) ? [...t.updateWatch.fields] : []
    };
  }
  if (t?.type === 'domain_event' && t.eventType) {
    const legacy = LEGACY_EVENT_TO_CORE[t.eventType];
    if (legacy?.fields?.length) {
      return { mode: 'fields', fields: [...legacy.fields] };
    }
  }
  return { mode: 'any', fields: [] };
}

function resolveScheduleFromProcess(process) {
  const s = process?.trigger?.schedule;
  if (!s || typeof s !== 'object') {
    return { preset: 'daily', hour: 9, minute: 0, dayOfWeek: 1, dayOfMonth: 1, timezone: 'UTC' };
  }
  return {
    preset: s.preset || s.frequency || 'daily',
    hour: s.hour ?? 9,
    minute: s.minute ?? 0,
    dayOfWeek: s.dayOfWeek ?? 1,
    dayOfMonth: s.dayOfMonth ?? 1,
    timezone: s.timezone || 'UTC'
  };
}

/**
 * Heuristic: whether currentState / loaded doc represents a closed / terminal record.
 * Prefers Closed Records config when module is eligible.
 */
async function isClosedRecordStateAsync(entityType, state, organizationId = null) {
  if (!state || typeof state !== 'object') return false;
  if (state.deletedAt) return true;
  if (state.isClosed === true || state.isClosedWon === true || state.isClosedLost === true) {
    return true;
  }
  const type = String(entityType || '').toLowerCase();
  if (type === 'people' || type === 'person') {
    return false;
  }
  try {
    const {
      resolveModuleKeyFromEntityType,
      isEligibleModule
    } = require('../constants/closedRecordsModules');
    const closedRecordsService = require('../services/closedRecordsService');
    const moduleKey = resolveModuleKeyFromEntityType(type) || (isEligibleModule(type) ? type : null);
    if (moduleKey) {
      return closedRecordsService.isLifecycleClosed(moduleKey, state, { organizationId });
    }
  } catch {
    /* fall through to heuristic */
  }
  return isClosedRecordState(entityType, state);
}

function isClosedRecordState(entityType, state) {
  if (!state || typeof state !== 'object') return false;
  if (state.deletedAt) return true;
  if (state.isClosed === true || state.isClosedWon === true || state.isClosedLost === true) {
    return true;
  }
  if (state.lifecycleState === 'closed') return true;
  const type = String(entityType || '').toLowerCase();
  // People: only treat deleted / explicit closed flags as terminal — lifecycle labels
  // like "Inactive" / "Lost" are common CRM values and must not block process triggers.
  if (type === 'people' || type === 'person') {
    return false;
  }
  const status = String(
    state.status || state.lifecycle || state.lifecycleStatus || state.derivedStatus || ''
  ).toLowerCase();
  if (
    [
      'closed',
      'won',
      'lost',
      'archived',
      'inactive',
      'completed',
      'cancelled',
      'canceled',
      'resolved',
      'done'
    ].includes(status)
  ) {
    return true;
  }
  if (type === 'deal' || type === 'deals') {
    const stage = String(state.stage || '').toLowerCase();
    if (stage.includes('closed') || stage === 'won' || stage === 'lost') return true;
  }
  if (type === 'cases' || type === 'case') {
    if (['resolved', 'closed'].includes(status)) return true;
  }
  return false;
}

const ENTITY_MODEL_LOADERS = {
  people: () => require('../models/People'),
  organization: () => require('../models/Organization'),
  organizations: () => require('../models/Organization'),
  deal: () => require('../models/Deal'),
  deals: () => require('../models/Deal'),
  quote: () => require('../models/Quote'),
  quotes: () => require('../models/Quote'),
  case: () => require('../models/Case'),
  cases: () => require('../models/Case'),
  task: () => require('../models/Task'),
  tasks: () => require('../models/Task'),
  event: () => require('../models/Event'),
  events: () => require('../models/Event'),
  item: () => require('../models/Item'),
  items: () => require('../models/Item'),
  form: () => require('../models/Form'),
  forms: () => require('../models/Form'),
  response: () => require('../models/FormResponse'),
  responses: () => require('../models/FormResponse')
};

/**
 * Load entity snapshot for closed-record checks.
 * @returns {Promise<object|null>}
 */
async function loadEntitySnapshotForClosedCheck(entityType, entityId, organizationId) {
  const key = String(entityType || '').toLowerCase();
  const loader = ENTITY_MODEL_LOADERS[key];
  if (!loader || entityId == null || entityId === '') return null;

  try {
    const Model = loader();
    const mongoose = require('mongoose');
    const id =
      mongoose.Types.ObjectId.isValid(String(entityId))
        ? new mongoose.Types.ObjectId(String(entityId))
        : entityId;
    const query = { _id: id };
    if (organizationId && Model.schema?.path?.('organizationId')) {
      query.organizationId = organizationId;
    }
    return await Model.findOne(query).lean();
  } catch (err) {
    return null;
  }
}

/**
 * Skip when process excludes closed records.
 * Always loads the DB record when entityId is present so closed status is not missed
 * when event.currentState is thin or absent.
 *
 * @param {Object} process
 * @param {Object|null} event
 * @param {{ entityType?: string, entityId?: string, organizationId?: string }} [fallback]
 * @returns {Promise<{ skip: boolean, reason?: string }>}
 */
async function shouldSkipClosedRecord(process, event, fallback = {}) {
  if (process?.includeClosedRecords === true) return { skip: false };

  const entityType = event?.entityType || process?.entityType || fallback.entityType || null;
  const entityId = event?.entityId || fallback.entityId || null;
  const organizationId = event?.organizationId || fallback.organizationId || null;

  if (!entityId) return { skip: false };

  let state = event?.currentState && typeof event.currentState === 'object'
    ? { ...event.currentState }
    : null;

  const loaded = await loadEntitySnapshotForClosedCheck(entityType, entityId, organizationId);
  if (loaded) {
    if (loaded.deletedAt) {
      return { skip: true, reason: 'closed_record_excluded' };
    }
    state = { ...loaded, ...(state || {}) };

    const type = String(entityType || '').toLowerCase();
    if (type === 'deal' || type === 'deals') {
      try {
        const { isClosedDeal } = require('../services/targets/targetForecastService');
        if (await isClosedDeal(loaded, process?.appKey || 'SALES')) {
          return { skip: true, reason: 'closed_record_excluded' };
        }
      } catch {
        /* fall through to heuristic */
      }
    }
  }

  if (!state) return { skip: false };

  if (await isClosedRecordStateAsync(entityType, state, organizationId)) {
    return { skip: true, reason: 'closed_record_excluded' };
  }
  return { skip: false };
}

/**
 * first_time / every_time is for record-event triggers only — not schedule.
 * @param {Object|null|undefined} process
 * @returns {boolean}
 */
function triggerBehaviourApplies(process) {
  return resolveCoreTriggerFromProcess(process) !== 'schedule';
}

/**
 * Normalize trigger behaviour. Default every_time (legacy processes).
 * Schedule always every_time (recurrence is the schedule itself).
 * @param {Object|null|undefined} process
 * @returns {'first_time'|'every_time'}
 */
function resolveTriggerBehaviour(process) {
  if (!triggerBehaviourApplies(process)) return 'every_time';
  return process?.triggerBehaviour === 'first_time' ? 'first_time' : 'every_time';
}

/**
 * Unique key for first-time-only runs (one execution per process + entity + org).
 * @returns {string|null}
 */
function buildFirstTimeKey(processId, entityId, organizationId) {
  if (!processId || entityId == null || entityId === '') return null;
  return `${String(processId)}:${String(entityId)}:${String(organizationId || '')}`;
}

module.exports = {
  CORE_TRIGGER_TYPES,
  LEGACY_EVENT_TO_CORE,
  createdEventType,
  updatedEventType,
  isCreatedEventType,
  isUpdatedEventType,
  toUpdatedEventType,
  matchesUpdateWatch,
  domainEventProcessMatchFilter,
  resolveCoreTriggerFromProcess,
  resolveUpdateWatchFromProcess,
  resolveScheduleFromProcess,
  triggerBehaviourApplies,
  resolveTriggerBehaviour,
  buildFirstTimeKey,
  isClosedRecordState,
  isClosedRecordStateAsync,
  loadEntitySnapshotForClosedCheck,
  shouldSkipClosedRecord
};
