'use strict';

/**
 * Cross-tenant Tally scheduled sync.
 * Tick every 60s; each bound company syncs at most once per syncIntervalMinutes
 * when scheduledSyncEnabled is on and dryRunDefault is off.
 */

const Organization = require('../../../models/Organization');
const TallyConnection = require('../../../models/TallyConnection');
const TallyCompanyBinding = require('../../../models/TallyCompanyBinding');
const ConnectorSyncJob = require('../../../models/ConnectorSyncJob');
const { runWithOrganizationTenantContext } = require('../../../utils/runWithOrganizationTenant');
const { CONNECTOR_KEYS } = require('../connectorConstants');
const { getMergedSettings } = require('./tallyModuleMappingService');
const { triggerBidirectionalSync } = require('./tallySyncOrchestrator');
const { acquireSchedulerLock } = require('../../../lib/schedulerLock');

const TICK_MS = 60 * 1000;
const HEARTBEAT_FRESH_MS = 2 * 60 * 1000;
const DEBUG = process.env.TALLY_SYNC_SCHEDULER_DEBUG === 'true';

let schedulerTimer = null;
let tickInFlight = false;

function isHeartbeatFresh(connection) {
  if (!connection?.heartbeatAt) return false;
  return Date.now() - new Date(connection.heartbeatAt).getTime() < HEARTBEAT_FRESH_MS;
}

async function hasInFlightSync(organizationId, companyGuid) {
  const filter = {
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    status: { $in: ['queued', 'running'] },
    jobType: { $in: ['incremental', 'full', 'pull_masters', 'dry_run'] },
  };
  if (companyGuid) filter.companyGuid = companyGuid;
  const count = await ConnectorSyncJob.countDocuments(filter);
  return count > 0;
}

async function processOrganization(organizationId) {
  const connection = await TallyConnection.findOne({ organizationId }).lean();
  if (!connection) return { skipped: 'no_connection' };
  if (!['online', 'paired'].includes(connection.status) && !isHeartbeatFresh(connection)) {
    return { skipped: 'offline' };
  }
  if (!isHeartbeatFresh(connection)) {
    return { skipped: 'stale_heartbeat' };
  }

  const settings = await getMergedSettings(organizationId);
  if (!settings.scheduledSyncEnabled) {
    return { skipped: 'disabled' };
  }
  // Minimal risk: never auto-run live sync while dry-run default is on
  if (settings.dryRunDefault !== false) {
    return { skipped: 'dry_run_default' };
  }

  const intervalMinutes = Math.min(1440, Math.max(1, Number(settings.syncIntervalMinutes) || 5));
  const dueBefore = new Date(Date.now() - intervalMinutes * 60 * 1000);

  const bindings = await TallyCompanyBinding.find({
    organizationId,
    enabled: true,
  })
    .select('_id companyGuid companyName lastScheduledSyncAt')
    .lean();

  let triggered = 0;
  let skippedDue = 0;
  let skippedBusy = 0;

  for (const binding of bindings) {
    if (binding.lastScheduledSyncAt && new Date(binding.lastScheduledSyncAt) > dueBefore) {
      skippedDue += 1;
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    if (await hasInFlightSync(organizationId, binding.companyGuid)) {
      skippedBusy += 1;
      continue;
    }

    try {
      // Mark due time first to avoid double-fire across overlapping ticks
      // eslint-disable-next-line no-await-in-loop
      await TallyCompanyBinding.updateOne(
        { _id: binding._id, organizationId },
        { $set: { lastScheduledSyncAt: new Date() } }
      );

      // eslint-disable-next-line no-await-in-loop
      await triggerBidirectionalSync({
        organizationId,
        companyGuid: binding.companyGuid,
        jobType: 'incremental',
        dryRun: false,
        createdBy: null,
      });
      triggered += 1;
      if (DEBUG) {
        console.log(
          `[tallySyncScheduler] org=${organizationId} company=${binding.companyGuid} triggered`
        );
      }
    } catch (err) {
      console.warn(
        `[tallySyncScheduler] org=${organizationId} company=${binding.companyGuid}:`,
        err?.message || err
      );
    }
  }

  return { triggered, skippedDue, skippedBusy, bindings: bindings.length };
}

async function runScheduledTallySyncTick() {
  if (tickInFlight) return { skipped: 'tick_in_flight' };
  const acquired = await acquireSchedulerLock('tally-sync', 50_000);
  if (!acquired) return { skipped: 'lock_held' };
  tickInFlight = true;

  const summary = {
    tenantsProcessed: 0,
    triggered: 0,
    errors: 0,
  };

  try {
    const tenants = await Organization.find({
      isTenant: true,
      isActive: true,
      'database.name': { $exists: true, $nin: [null, ''] },
    })
      .select('_id')
      .lean();

    for (const tenant of tenants) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await runWithOrganizationTenantContext(tenant._id, () =>
          processOrganization(tenant._id)
        );
        summary.tenantsProcessed += 1;
        if (result?.triggered) summary.triggered += result.triggered;
      } catch (err) {
        summary.errors += 1;
        console.warn(`[tallySyncScheduler] tenant ${tenant._id}:`, err?.message || err);
      }
    }
  } finally {
    tickInFlight = false;
  }

  if (DEBUG && (summary.triggered || summary.errors)) {
    console.log('[tallySyncScheduler] tick', summary);
  }
  return summary;
}

function startTallySyncScheduler() {
  if (schedulerTimer) return;
  schedulerTimer = setInterval(() => {
    runScheduledTallySyncTick().catch((err) => {
      console.error('[tallySyncScheduler] tick failed:', err?.message || err);
    });
  }, TICK_MS);

  if (typeof schedulerTimer.unref === 'function') {
    schedulerTimer.unref();
  }

  setTimeout(() => {
    runScheduledTallySyncTick().catch((err) => {
      console.error('[tallySyncScheduler] initial tick failed:', err?.message || err);
    });
  }, 45_000);

  console.log('✅ Tally sync scheduler started (tick 60s; interval from tenant settings)');
}

function stopTallySyncScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

module.exports = {
  TICK_MS,
  runScheduledTallySyncTick,
  startTallySyncScheduler,
  stopTallySyncScheduler,
  processOrganization,
};
