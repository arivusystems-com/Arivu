/**
 * Backfill lifecycleState for cases (Resolved/Closed) and deals (Won/Lost or closed stages).
 *
 * Usage (from server/ with tenant context already selected, or via ops runner):
 *   node scripts/backfillClosedRecordsLifecycle.js
 *
 * Safe to re-run: only sets lifecycleState where missing or mismatched.
 */

'use strict';

async function backfillCases(Case) {
  const closedStatuses = ['Resolved', 'Closed'];
  const res = await Case.updateMany(
    {
      status: { $in: closedStatuses },
      $or: [{ lifecycleState: { $exists: false } }, { lifecycleState: { $ne: 'closed' } }]
    },
    { $set: { lifecycleState: 'closed', closedAt: new Date() } }
  );
  const open = await Case.updateMany(
    {
      status: { $nin: closedStatuses },
      $or: [{ lifecycleState: { $exists: false } }, { lifecycleState: null }]
    },
    { $set: { lifecycleState: 'active' } }
  );
  return { closed: res.modifiedCount || res.nModified || 0, active: open.modifiedCount || open.nModified || 0 };
}

async function backfillDeals(Deal) {
  const { DEAL_STATUS } = require('../constants/dealStatus');
  const closed = await Deal.updateMany(
    {
      $or: [
        { status: { $in: [DEAL_STATUS.WON, DEAL_STATUS.LOST, 'Won', 'Lost'] } },
        { stage: /closed/i }
      ],
      $and: [{ $or: [{ lifecycleState: { $exists: false } }, { lifecycleState: { $ne: 'closed' } }] }]
    },
    { $set: { lifecycleState: 'closed', closedAt: new Date() } }
  );
  const open = await Deal.updateMany(
    {
      status: { $in: [DEAL_STATUS.OPEN, 'Open', 'Active'] },
      $or: [{ lifecycleState: { $exists: false } }, { lifecycleState: null }]
    },
    { $set: { lifecycleState: 'active' } }
  );
  return {
    closed: closed.modifiedCount || closed.nModified || 0,
    active: open.modifiedCount || open.nModified || 0
  };
}

async function main() {
  const Case = require('../models/Case');
  const Deal = require('../models/Deal');
  const cases = await backfillCases(Case);
  const deals = await backfillDeals(Deal);
  console.log('[backfillClosedRecordsLifecycle]', { cases, deals });
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { backfillCases, backfillDeals };
