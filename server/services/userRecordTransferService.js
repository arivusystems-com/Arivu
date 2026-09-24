'use strict';

/**
 * Ownership transfer for user lifecycle (deactivate → transfer → delete).
 * Comments, emails, and change logs are never rewritten — only ownership fields.
 */

const mongoose = require('mongoose');
const People = require('../models/People');
const Organization = require('../models/Organization');
const Deal = require('../models/Deal');
const Task = require('../models/Task');
const Case = require('../models/Case');
const Event = require('../models/Event');
const Item = require('../models/Item');
const Document = require('../models/Document');
const { DEAL_STATUS } = require('../constants/dealStatus');

const CASE_CLOSED = new Set(['Resolved', 'Closed']);
const TASK_CLOSED = new Set(['completed', 'done', 'cancelled', 'canceled']);
const EVENT_CLOSED = new Set(['Completed', 'Cancelled', 'Canceled']);

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (!mongoose.Types.ObjectId.isValid(String(id))) return null;
  return new mongoose.Types.ObjectId(String(id));
}

function notDeleted() {
  return {
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
  };
}

async function buildModuleDefs(organizationId, fromUserId) {
  const orgId = toObjectId(organizationId);
  const userId = toObjectId(fromUserId);
  const base = { organizationId: orgId, assignedTo: userId, ...notDeleted() };

  const closedRecordsService = require('./closedRecordsService');
  const { isEligibleModule } = require('../constants/closedRecordsModules');

  async function openClosedFor(moduleKey, fallbackOpen, fallbackClosed) {
    if (!isEligibleModule(moduleKey)) {
      return { openQuery: fallbackOpen, closedQuery: fallbackClosed };
    }
    try {
      const config = await closedRecordsService.getConfig(moduleKey, { organizationId });
      const { openQuery, closedQuery } = closedRecordsService.buildLifecycleQueries(config);
      return {
        openQuery: { ...base, ...openQuery },
        closedQuery: { ...base, ...closedQuery }
      };
    } catch {
      return { openQuery: fallbackOpen, closedQuery: fallbackClosed };
    }
  }

  const dealsOc = await openClosedFor(
    'deals',
    { ...base, status: { $in: [DEAL_STATUS.OPEN, 'Active', 'Open'] } },
    { ...base, status: { $in: [DEAL_STATUS.WON, DEAL_STATUS.LOST, 'Won', 'Lost', 'Abandoned'] } }
  );
  const tasksOc = await openClosedFor(
    'tasks',
    { ...base, status: { $nin: [...TASK_CLOSED] } },
    { ...base, status: { $in: [...TASK_CLOSED] } }
  );
  const casesOc = await openClosedFor(
    'cases',
    { ...base, status: { $nin: [...CASE_CLOSED] } },
    { ...base, status: { $in: [...CASE_CLOSED] } }
  );
  const eventsOc = await openClosedFor(
    'events',
    { ...base, status: { $nin: [...EVENT_CLOSED] } },
    { ...base, status: { $in: [...EVENT_CLOSED] } }
  );

  return [
    {
      key: 'people',
      labelKey: 'people',
      Model: People,
      ownerField: 'assignedTo',
      openQuery: { ...base },
      closedQuery: null
    },
    {
      key: 'organizations',
      labelKey: 'organizations',
      Model: Organization,
      ownerField: 'assignedTo',
      openQuery: {
        organizationId: orgId,
        assignedTo: userId,
        $and: [
          notDeleted(),
          {
            $or: [
              { isTenant: false },
              { isTenant: { $exists: false } }
            ]
          }
        ]
      },
      closedQuery: null
    },
    {
      key: 'deals',
      labelKey: 'deals',
      Model: Deal,
      ownerField: 'assignedTo',
      ...dealsOc
    },
    {
      key: 'tasks',
      labelKey: 'tasks',
      Model: Task,
      ownerField: 'assignedTo',
      ...tasksOc
    },
    {
      key: 'cases',
      labelKey: 'cases',
      Model: Case,
      ownerField: 'assignedTo',
      ...casesOc
    },
    {
      key: 'events',
      labelKey: 'events',
      Model: Event,
      ownerField: 'assignedTo',
      ...eventsOc
    },
    {
      key: 'items',
      labelKey: 'items',
      Model: Item,
      ownerField: 'assignedTo',
      openQuery: { ...base },
      closedQuery: null
    },
    {
      key: 'documents',
      labelKey: 'documents',
      Model: Document,
      ownerField: 'assignedTo',
      openQuery: { ...base },
      closedQuery: null
    }
  ];
}

async function safeCount(Model, query) {
  try {
    return await Model.countDocuments(query);
  } catch (err) {
    console.warn('[userRecordTransfer] count failed:', Model?.modelName, err.message);
    return 0;
  }
}

/**
 * @returns {{ modules: Array<{key, open, closed}>, openTotal: number, closedTotal: number }}
 */
async function getOwnershipSummary(organizationId, fromUserId) {
  const defs = await buildModuleDefs(organizationId, fromUserId);
  const modules = [];
  let openTotal = 0;
  let closedTotal = 0;

  for (const def of defs) {
    const open = await safeCount(def.Model, def.openQuery);
    const closed = def.closedQuery ? await safeCount(def.Model, def.closedQuery) : 0;
    openTotal += open;
    closedTotal += closed;
    modules.push({
      key: def.key,
      open,
      closed,
      supportsClosed: Boolean(def.closedQuery)
    });
  }

  return { modules, openTotal, closedTotal };
}

/**
 * @param {object} opts
 * @param {string} opts.organizationId
 * @param {string} opts.fromUserId
 * @param {string} opts.toUserId
 * @param {boolean} [opts.includeClosed=false]
 * @param {string[]} [opts.moduleKeys] - empty/undefined = all modules with open (and closed if flagged)
 */
async function transferOwnership({
  organizationId,
  fromUserId,
  toUserId,
  includeClosed = false,
  moduleKeys = null,
  actorUserId = null
}) {
  const fromId = toObjectId(fromUserId);
  const toId = toObjectId(toUserId);
  if (!fromId || !toId) {
    return { ok: false, code: 'INVALID_USER_ID', message: 'Invalid source or destination user' };
  }
  if (String(fromId) === String(toId)) {
    return { ok: false, code: 'SAME_USER', message: 'Cannot transfer records to the same user' };
  }

  const defs = await buildModuleDefs(organizationId, fromUserId);
  const allowed = moduleKeys && moduleKeys.length
    ? new Set(moduleKeys.map(String))
    : null;

  const transferred = [];
  let total = 0;

  for (const def of defs) {
    if (allowed && !allowed.has(def.key)) continue;

    const queries = [def.openQuery];
    if (includeClosed && def.closedQuery) {
      queries.push(def.closedQuery);
    }

    let moduleCount = 0;
    for (const query of queries) {
      try {
        const result = await def.Model.updateMany(query, {
          $set: {
            [def.ownerField]: toId,
            ...(actorUserId ? { updatedBy: toObjectId(actorUserId) } : {})
          }
        });
        moduleCount += result.modifiedCount || 0;
      } catch (err) {
        console.warn('[userRecordTransfer] update failed:', def.key, err.message);
      }
    }

    if (moduleCount > 0) {
      transferred.push({ key: def.key, count: moduleCount });
      total += moduleCount;
    }
  }

  const summary = await getOwnershipSummary(organizationId, fromUserId);

  return {
    ok: true,
    transferred,
    total,
    remainingOpen: summary.openTotal,
    remainingClosed: summary.closedTotal,
    summary
  };
}

module.exports = {
  getOwnershipSummary,
  transferOwnership
};
